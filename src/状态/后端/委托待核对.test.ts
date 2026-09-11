// J-PILOT-01 Task 3（协议 B）：委托待核对最小恢复记录的行为测试。
// 纯 helper：sessionStorage 键 AGXP委托待核对v1:<encoded environment>:<encoded subject>:candidate
// 按后端环境 + 已认证 subject 隔离，值为有限未决命令数组；坏 JSON / 越权键集 / 坏类型
// 整笔丢弃（fail closed），storage 为 null 或抛异常返回持久化失败标记，不吞业务记录、
// 不写正文。这里全部用受控内存 storage 桩（getItem/setItem/removeItem spy），不触 jsdom。

import { describe, expect, it, vi } from 'vitest';
import {
  委托创建目标键,
  委托待核对键,
  委托待核对目标键,
  委托重试目标键,
  清除待核对,
  读取待核对,
  保存待核对,
  type 委托待核对owner,
  type 委托待核对存储接口,
  type 待核对命令,
} from './委托待核对';

/** 受控内存 storage 桩：恰好 Pick<Storage,'getItem'|'setItem'|'removeItem'>。 */
function 创建存储(初始: Record<string, string> = {}): 委托待核对存储接口 & {
  表: Map<string, string>;
} {
  const 表 = new Map<string, string>(Object.entries(初始));
  return {
    表,
    getItem: vi.fn((键: string) => 表.get(键) ?? null),
    setItem: vi.fn((键: string, 值: string) => {
      表.set(键, 值);
    }),
    removeItem: vi.fn((键: string) => {
      表.delete(键);
    }),
  };
}

const 甲owner: 委托待核对owner = { environment: 'stg', subjectId: 'sub_1', role: 'candidate' };
const 乙owner: 委托待核对owner = { environment: 'stg', subjectId: 'sub_2', role: 'candidate' };

const create命令: 待核对命令 = {
  operation: 'create',
  key: 'idem-key-1',
  intention_id: 'int_1',
  selection: { items: [{ job_id: 'job_1' }] },
  resume_file_id: 'rf_1',
  resume_file_version_id: 'rfv_7',
  disclosure_acknowledged: true,
};

const retry命令: 待核对命令 = {
  operation: 'retry',
  key: 'idem-key-2',
  record_id: 'dlg_0123456789abcdef0123456789abcdef',
  expected_retry_generation: 3,
};

describe('委托待核对键 与 目标键', () => {
  it('存储键按 冻结前缀 + 逐段转义 environment/subject + candidate 组装', () => {
    expect(委托待核对键(甲owner)).toBe('AGXP委托待核对v1:stg:sub_1:candidate');
    // 含分隔符的 id 逐段转义：绝不与别的环境/主体撞键
    expect(委托待核对键({ environment: 'a:b', subjectId: 'x/y', role: 'candidate' }))
      .toBe('AGXP委托待核对v1:a%3Ab:x%2Fy:candidate');
    expect(委托待核对键({ environment: 'a', subjectId: 'b:c', role: 'candidate' }))
      .not.toBe(委托待核对键({ environment: 'a:b', subjectId: 'c', role: 'candidate' }));
  });

  it('目标键按命令目标（create=intention+job / retry=record）逐段转义，两类不撞', () => {
    expect(委托待核对目标键(create命令)).toBe(委托创建目标键('int_1', 'job_1'));
    expect(委托待核对目标键(retry命令)).toBe(委托重试目标键(retry命令.record_id));
    expect(委托创建目标键('a:b', 'c')).not.toBe(委托创建目标键('a', 'b:c'));
    expect(委托创建目标键('int_1', 'job_1').startsWith('retry:')).toBe(false);
  });
});

describe('保存与读取待核对', () => {
  it('保存后按 owner 读回同一批命令；主体分仓：B 主体读不到 A 的命令', () => {
    const 存储 = 创建存储();
    expect(保存待核对(存储, 甲owner, [create命令, retry命令])).toBe(true);
    const 读甲 = 读取待核对(存储, 甲owner);
    expect(读甲).toEqual({ 命令: [create命令, retry命令], 持久化失败: false });
    expect(读取待核对(存储, 乙owner)).toEqual({ 命令: [], 持久化失败: false });
  });

  it('回执补 ID 后的 create（delegation_id/record_id/已确认回执）按白名单原样往返', () => {
    const 存储 = 创建存储();
    const 已确认: 待核对命令 = {
      ...create命令,
      delegation_id: 'dlg_0123456789abcdef0123456789abcdeff',
      record_id: 'dlg_0123456789abcdef0123456789abcdeff',
      已确认回执: true,
    };
    expect(保存待核对(存储, 甲owner, [已确认])).toBe(true);
    expect(读取待核对(存储, 甲owner).命令).toEqual([已确认]);
  });

  it('保存侧白名单：越权字段 / 坏类型 / 非单岗位 selection / 非字面 disclosure 整笔拒绝，零写入', () => {
    const 存储 = 创建存储();
    const 越权: Record<string, unknown> = { ...create命令, 私有正文: '简历内容' };
    expect(保存待核对(存储, 甲owner, [越权 as unknown as 待核对命令])).toBe(false);
    expect(存储.表.size).toBe(0);

    expect(保存待核对(存储, 甲owner, [{ ...create命令, disclosure_acknowledged: false } as unknown as 待核对命令]))
      .toBe(false);
    expect(保存待核对(存储, 甲owner, [{
      ...create命令,
      selection: { items: [{ job_id: 'job_1' }, { job_id: 'job_2' }] },
    } as unknown as 待核对命令])).toBe(false);
    expect(保存待核对(存储, 甲owner, [{ ...retry命令, expected_retry_generation: -1 }]))
      .toBe(false);
    expect(保存待核对(存储, 甲owner, [{ ...retry命令, operation: 'archive' } as unknown as 待核对命令]))
      .toBe(false);
    expect(存储.表.size).toBe(0);
  });

  it('读侧白名单：持久层里的越权键集 / 坏类型整笔丢弃并删除，返回持久化失败标记', () => {
    const 键 = 委托待核对键(甲owner);
    const 存储 = 创建存储({
      [键]: JSON.stringify([{ ...create命令, 私有正文: 'x' }]),
    });
    const 读 = 读取待核对(存储, 甲owner);
    expect(读).toEqual({ 命令: [], 持久化失败: true });
    expect(存储.表.has(键)).toBe(false);

    const 坏类型存储 = 创建存储({
      [委托待核对键(甲owner)]: JSON.stringify([{ ...retry命令, expected_retry_generation: '三' }]),
    });
    expect(读取待核对(坏类型存储, 甲owner)).toEqual({ 命令: [], 持久化失败: true });
  });

  it('坏 JSON：解析失败整笔丢弃并删除键，返回持久化失败标记', () => {
    const 键 = 委托待核对键(甲owner);
    const 存储 = 创建存储({ [键]: '{oops' });
    expect(读取待核对(存储, 甲owner)).toEqual({ 命令: [], 持久化失败: true });
    expect(存储.表.has(键)).toBe(false);
  });

  it('读取抛异常：返回持久化失败标记，不把存储故障抛进页面，也不删除没看到的值', () => {
    const 键 = 委托待核对键(甲owner);
    const 存储 = 创建存储({ [键]: '[]' });
    存储.getItem = vi.fn(() => {
      throw new Error('quota');
    });
    expect(读取待核对(存储, 甲owner)).toEqual({ 命令: [], 持久化失败: true });
    expect(存储.表.has(键)).toBe(true); // 没读到值：不能凭空清掉别人的数据
  });

  it('null storage：读返回持久化失败标记，写返回 false，清除 no-op 不抛', () => {
    expect(读取待核对(null, 甲owner)).toEqual({ 命令: [], 持久化失败: true });
    expect(保存待核对(null, 甲owner, [create命令])).toBe(false);
    expect(() => 清除待核对(null, 甲owner)).not.toThrow();
  });

  it('写侧抛异常返回 false（不吞业务记录由调用方内存兜底），owner 缺席同样失败', () => {
    const 存储 = 创建存储();
    存储.setItem = vi.fn(() => {
      throw new Error('quota');
    });
    expect(保存待核对(存储, 甲owner, [create命令])).toBe(false);
    expect(保存待核对(存储, null, [create命令])).toBe(false);
    expect(读取待核对(存储, null)).toEqual({ 命令: [], 持久化失败: true });
  });

  it('清除只删自己 owner 的键：另一主体的记录原样留在自己的键里', () => {
    const 存储 = 创建存储();
    保存待核对(存储, 甲owner, [create命令]);
    保存待核对(存储, 乙owner, [retry命令]);
    清除待核对(存储, 甲owner);
    expect(存储.表.has(委托待核对键(甲owner))).toBe(false);
    expect(读取待核对(存储, 乙owner).命令).toEqual([retry命令]);
    // removeItem 抛异常同样吞掉：删除失败不把存储故障抛进页面
    存储.removeItem = vi.fn(() => {
      throw new Error('quota');
    });
    expect(() => 清除待核对(存储, 乙owner)).not.toThrow();
  });
});