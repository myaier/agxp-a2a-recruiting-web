import { describe, expect, it, vi } from 'vitest';
import {
  写资料缓存,
  读资料缓存,
  资料缓存键,
  迁移旧资料缓存,
  候选引导草稿键,
  删候选引导草稿,
  读候选引导草稿,
  写候选引导草稿,
  type 资料缓存快照,
  type 候选引导草稿快照,
} from './资料缓存';

function 内存存储() {
  const 数据 = new Map<string, string>();
  return {
    getItem: (键: string) => 数据.get(键) ?? null,
    setItem: (键: string, 值: string) => { 数据.set(键, 值); },
    removeItem: (键: string) => { 数据.delete(键); },
  };
}

const 快照: 资料缓存快照 = {
  公司自述: null,
  企业认证: { 姓名: '甲', 公司: '甲公司' },
  招聘头像: 'data:image/jpeg;base64,aaa',
  公司LOGO: null,
  求职头像: '章:2',
  飞书已接入: true,
  企业飞书已接入: false,
};

describe('账号资料缓存', () => {
  it('按模式、环境和账号三重隔离', () => {
    const 存储 = 内存存储();
    const 甲 = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_A' };
    const 乙 = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_B' };
    const 本地甲 = { 模式: 'backend' as const, 环境: 'local' as const, 账号: 'sub_A' };
    写资料缓存(存储, 甲, 快照);
    expect(读资料缓存(存储, 甲).企业认证?.姓名).toBe('甲');
    expect(读资料缓存(存储, 乙)).toEqual({});
    expect(读资料缓存(存储, 本地甲)).toEqual({});
    expect(资料缓存键(甲)).not.toBe(资料缓存键(乙));
  });

  it('损坏或伪造字段不会进入应用状态', () => {
    const 存储 = 内存存储();
    const 范围 = { 模式: 'mock' as const, 环境: 'stg' as const, 账号: 'demo' };
    存储.setItem(资料缓存键(范围), JSON.stringify({
      招聘头像: 'https://evil.example/avatar',
      求职头像: '非法',
      企业认证: { 姓名: 123, 公司: null },
      飞书已接入: '1',
    }));
    expect(读资料缓存(存储, 范围)).toEqual({});
  });

  it('旧全局键只在新分仓写成功后删除', () => {
    const 存储 = 内存存储();
    const 范围 = { 模式: 'mock' as const, 环境: 'stg' as const, 账号: 'demo' };
    存储.setItem('AGXP企业认证v1', JSON.stringify({ 姓名: '老用户', 公司: '老公司' }));
    const 结果 = 迁移旧资料缓存(存储, 范围);
    expect(结果.企业认证?.姓名).toBe('老用户');
    expect(存储.getItem('AGXP企业认证v1')).toBe(null);
    expect(读资料缓存(存储, 范围).企业认证?.姓名).toBe('老用户');
  });

  it('新组织选择字段合法值 round trip', () => {
    const 存储 = 内存存储();
    const 范围 = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_1' };
    写资料缓存(存储, 范围, { 当前企业关系编号: 'aff_1', 未认证公司声明: '云衢科技' });
    expect(读资料缓存(存储, 范围)).toEqual({
      当前企业关系编号: 'aff_1',
      未认证公司声明: '云衢科技',
    });
    写资料缓存(存储, 范围, { 当前企业关系编号: null });
    expect(读资料缓存(存储, 范围)).toEqual({ 当前企业关系编号: null });
  });

  it('Backend 快照保留非 P1C 账号资料和可恢复组织选择', () => {
    const setItem = vi.fn();
    const 存储 = { getItem: vi.fn(() => null), setItem, removeItem: vi.fn() };
    const 范围 = { 模式: 'backend', 环境: 'local', 账号: 'sub_1' } as const;
    写资料缓存(存储, 范围, {
      当前企业关系编号: null, 未认证公司声明: '', 求职头像: '章:林',
      飞书已接入: true, 企业飞书已接入: false,
    });
    expect(JSON.parse(setItem.mock.calls[0][1])).toEqual({
      当前企业关系编号: null, 未认证公司声明: '', 求职头像: '章:林',
      飞书已接入: true, 企业飞书已接入: false,
    });
  });

  it('损坏的 Backend 选择字段被逐键丢弃', () => {
    const 存储 = {
      getItem: vi.fn(() => JSON.stringify({ 当前企业关系编号: 3, 未认证公司声明: [] })),
      setItem: vi.fn(), removeItem: vi.fn(),
    };
    expect(读资料缓存(存储, { 模式: 'backend', 环境: 'local', 账号: 'sub_1' })).toEqual({});
  });
});

// ── Task 4：候选 onboarding 草稿的 sessionStorage 白名单编解码 ─────────────────
// 这是「服务端尚未接管的页面答案」缓存，不是简历缓存：简历正文、凭据、PDF 文本、
// 未脱敏联系方式、模型输出一律不允许落盘；任何损坏字段整条拒绝并删除。

describe('候选引导草稿 sessionStorage 编解码', () => {
  const 范围A = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_A' };
  const 范围B = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_B' };

  const 草稿: 候选引导草稿快照 = {
    城市们: ['上海'],
    职位: ['后端工程师'],
    城市引用们: [{ id: 'loc_sh', display_name: '上海' }],
    职位引用们: [{ id: 'job_be', display_name: '后端工程师' }],
    筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['混合'] },
    薪资: { 下限: 30, 上限: 40, 单位: '月薪K' },
    到岗: '在职 · 考虑机会',
  };

  it('候选草稿键按 subject 隔离', () => {
    expect(候选引导草稿键(范围A)).not.toBe(候选引导草稿键(范围B));
    expect(候选引导草稿键(范围A)).not.toBe(候选引导草稿键({ 模式: 'backend', 环境: 'local', 账号: 'sub_A' }));
  });

  it('合法草稿 round trip，读不到其它主体的记录', () => {
    const 存储 = 内存存储();
    expect(写候选引导草稿(存储, 范围A, 草稿)).toBe(true);
    expect(读候选引导草稿(存储, 范围A)).toEqual(草稿);
    expect(读候选引导草稿(存储, 范围B)).toBe(null);
    // 删除后归零
    删候选引导草稿(存储, 范围A);
    expect(读候选引导草稿(存储, 范围A)).toBe(null);
    expect(存储.getItem(候选引导草稿键(范围A))).toBe(null);
  });

  it('写入只落白名单键：简历 / credentials / PDF 文本等附加字段绝不落盘', () => {
    const 存储 = 内存存储();
    const 污染输入 = {
      ...草稿,
      简历: '简历正文不得落盘',
      credentials: { token: 'secret' },
      parsed_pdf_text: 'PDF 解析文本',
    } as typeof 草稿;
    写候选引导草稿(存储, 范围A, 污染输入);
    const 原文 = 存储.getItem(候选引导草稿键(范围A))!;
    expect(Object.keys(JSON.parse(原文)).sort()).toEqual(
      ['城市们', '城市引用们', '到岗', '筛选偏好', '薪资', '职位', '职位引用们'].sort()
    );
    expect(原文).not.toContain('简历正文');
    expect(原文).not.toContain('credentials');
    expect(原文).not.toContain('PDF');
    // 写入构造的是全新对象，不共享调用方引用
    expect(JSON.parse(原文)).not.toBe(污染输入);
  });

  it('原始内容不是 JSON 时返回 null 并删除整条', () => {
    const 存储 = 内存存储();
    存储.setItem(候选引导草稿键(范围A), '不是 JSON');
    expect(读候选引导草稿(存储, 范围A)).toBe(null);
    expect(存储.getItem(候选引导草稿键(范围A))).toBe(null);
  });

  const 损坏表: [名称: string, 值: Record<string, unknown>][] = [
    ['城市数组不是数组', { ...草稿, 城市们: '上海' }],
    ['城市数组混入非字符串', { ...草稿, 城市们: ['上海', 42] }],
    ['必填城市/职位数组缺失', { 筛选偏好: 草稿.筛选偏好, 薪资: 草稿.薪资 }],
    ['引用 id 为空串', { ...草稿, 城市引用们: [{ id: '', display_name: '上海' }] }],
    ['引用 display_name 非字符串', { ...草稿, 职位引用们: [{ id: 'job_be', display_name: 7 }] }],
    ['引用带未知字段', { ...草稿, 城市引用们: [{ id: 'loc_sh', display_name: '上海', extra: 1 }] }],
    ['薪资下限非数字', { ...草稿, 薪资: { 下限: '30', 上限: 40, 单位: '月薪K' } }],
    ['薪资上限非有限数', { ...草稿, 薪资: { 下限: 30, 上限: Number.POSITIVE_INFINITY } }],
    ['薪资单位未知', { ...草稿, 薪资: { 下限: 30, 上限: 40, 单位: '时薪' } }],
    ['根上多出未知字段', { ...草稿, credentials: 'token' }],
    ['求职类型枚举非法', { ...草稿, 筛选偏好: { 求职类型: ['全职'], 办公方式: ['混合'] } }],
    ['办公方式枚举非法', { ...草稿, 筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['远程'] } }],
    ['毕业时间格式非法', {
      ...草稿,
      筛选偏好: { 求职类型: ['校园招聘'], 办公方式: ['混合'], 毕业时间: '2026/07' },
    }],
    ['实习月数非整数', {
      ...草稿,
      筛选偏好: { 求职类型: ['实习生'], 办公方式: ['混合'], 实习月数: 2.5 },
    }],
    ['每周到岗天数类型错误', {
      ...草稿,
      筛选偏好: { 求职类型: ['实习生'], 办公方式: ['混合'], 每周到岗天数: '4' },
    }],
    ['到岗类型错误', { ...草稿, 到岗: 123 }],
    ['筛选偏好类型错误', { ...草稿, 筛选偏好: '社招全职' }],
  ];

  it.each(损坏表)('损坏记录（%s）返回 null 并删除整条', (名称, 值) => {
    void 名称;
    const 存储 = 内存存储();
    存储.setItem(候选引导草稿键(范围A), JSON.stringify(值));
    expect(读候选引导草稿(存储, 范围A)).toBe(null);
    // 整条删除：重复 mount 不会反复撞同一条损坏记录
    expect(存储.getItem(候选引导草稿键(范围A))).toBe(null);
  });
});
