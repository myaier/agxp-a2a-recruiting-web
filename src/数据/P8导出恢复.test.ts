import { describe, expect, it, vi } from 'vitest';
import { 账号存储键 } from './资料缓存';
import { 创建P8导出恢复存储, type P8导出恢复句柄 } from './P8导出恢复';

function 内存存储() {
  const 数据 = new Map<string, string>();
  return {
    getItem: (键: string) => 数据.get(键) ?? null,
    setItem: (键: string, 值: string) => { 数据.set(键, 值); },
    removeItem: (键: string) => { 数据.delete(键); },
    键列表: () => [...数据.keys()],
  };
}

function 抛错存储(失败: Partial<Record<'getItem' | 'setItem' | 'removeItem', boolean>>) {
  const 异常 = new Error('存储不可用');
  return {
    getItem: () => { if (失败.getItem) throw 异常; return null; },
    setItem: () => { if (失败.setItem) throw 异常; },
    removeItem: () => { if (失败.removeItem) throw 异常; },
  };
}

const 范围甲 = { 模式: 'backend', 环境: 'local', 账号: 'sub_A' } as const;
const 范围乙 = { 模式: 'backend', 环境: 'local', 账号: 'sub_B' } as const;
const UUID键 = '3f2b8c1a-9d4e-4f5a-8b7c-2e1d0a9b8c7d';
const 导出ID = `exp_${'a'.repeat(32)}`;

function 句柄(覆盖: Partial<P8导出恢复句柄> = {}): P8导出恢复句柄 {
  return { subjectId: 'sub_A', createKey: 'p8-export-key-0001', exportId: null, ...覆盖 };
}

describe('P8 导出恢复存储', () => {
  it('一个 模式+环境+账号 只有一个物理键，且复用 账号存储键 约定', () => {
    const 存储 = 内存存储();
    const 侦察 = { getItem: vi.fn(存储.getItem), setItem: vi.fn(存储.setItem), removeItem: vi.fn(存储.removeItem) };
    const 甲 = 创建P8导出恢复存储({ storage: 侦察, 范围: 范围甲 });
    expect(甲.写入(句柄())).toBe(true);
    expect(侦察.setItem).toHaveBeenCalledTimes(1);
    expect(侦察.setItem.mock.calls[0][0]).toBe(账号存储键('P8数据导出v1', 范围甲));
    expect(存储.键列表()).toEqual([账号存储键('P8数据导出v1', 范围甲)]);
  });

  it('brief 用例：同环境不同账号互相不可见', () => {
    const storage = 内存存储();
    const A存储 = 创建P8导出恢复存储({ storage, 范围: { 模式: 'backend', 环境: 'local', 账号: 'sub_A' } });
    expect(A存储.写入({ subjectId: 'sub_A', createKey: 'p8-export-key-0001', exportId: null })).toBe(true);
    expect(A存储.读取()?.createKey).toBe('p8-export-key-0001');
    expect(创建P8导出恢复存储({ storage, 范围: { 模式: 'backend', 环境: 'local', 账号: 'sub_B' } }).读取()).toBeNull();
  });

  it('模式或环境变化产生不同物理键，互不读取', () => {
    const 存储 = 内存存储();
    const 本地 = 创建P8导出恢复存储({ storage: 存储, 范围: 范围甲 });
    expect(本地.写入(句柄({ createKey: UUID键 }))).toBe(true);
    const 预发 = 创建P8导出恢复存储({ storage: 存储, 范围: { ...范围甲, 环境: 'stg' } });
    const 演示 = 创建P8导出恢复存储({ storage: 存储, 范围: { ...范围甲, 模式: 'mock' } });
    expect(预发.读取()).toBeNull();
    expect(演示.读取()).toBeNull();
    expect(存储.键列表()).toEqual([账号存储键('P8数据导出v1', 范围甲)]);
  });

  it('createKey 只收非空可见 ASCII（UUID 形状可用），其余拒写', () => {
    const 存储 = 内存存储();
    const 甲 = 创建P8导出恢复存储({ storage: 存储, 范围: 范围甲 });
    expect(甲.写入(句柄({ createKey: UUID键 }))).toBe(true);
    expect(甲.读取()?.createKey).toBe(UUID键);
    for (const 非法 of ['', 'short', '带 空格', 'a\tb', '键é', 'k'.repeat(129), '  ']) {
      expect(甲.写入(句柄({ createKey: 非法 }))).toBe(false);
    }
    expect(存储.键列表()).toEqual([账号存储键('P8数据导出v1', 范围甲)]);
    expect(甲.读取()?.createKey).toBe(UUID键);
  });

  it('exportId 只收 null 或 exp_ 加 32 位小写十六进制', () => {
    const 存储 = 内存存储();
    const 甲 = 创建P8导出恢复存储({ storage: 存储, 范围: 范围甲 });
    expect(甲.写入(句柄({ exportId: 导出ID }))).toBe(true);
    expect(甲.读取()?.exportId).toBe(导出ID);
    for (const 非法 of ['exp_', `exp_${'A'.repeat(32)}`, `exp_${'g'.repeat(32)}`, 'report_1', 'del_1', 123, '']) {
      expect(甲.写入(句柄({ exportId: 非法 as unknown as string | null }))).toBe(false);
    }
    expect(甲.读取()?.exportId).toBe(导出ID);
    expect(甲.写入(句柄({ exportId: null }))).toBe(true);
    expect(甲.读取()?.exportId).toBeNull();
  });

  it('拒绝 subjectId 与 范围.账号 不一致的句柄', () => {
    const 存储 = 内存存储();
    const 甲 = 创建P8导出恢复存储({ storage: 存储, 范围: 范围甲 });
    expect(甲.写入(句柄({ subjectId: 'sub_B' }))).toBe(false);
    expect(甲.写入(句柄({ subjectId: '' }))).toBe(false);
    expect(存储.键列表()).toEqual([]);
    expect(甲.读取()).toBeNull();
  });

  it('读取侧：多余字段、错类型或 subject 不匹配的值一律丢弃并删除', () => {
    const 键 = 账号存储键('P8数据导出v1', 范围甲);
    const 损坏样例 = [
      JSON.stringify({ ...句柄({ exportId: 导出ID }), downloadUrl: 'https://evil.example/x.zip' }),
      JSON.stringify({ ...句柄({ exportId: 导出ID }), phone: '13800000000' }),
      JSON.stringify({ subjectId: 'sub_A', createKey: UUID键 }),
      JSON.stringify({ subjectId: 'sub_A', createKey: UUID键, exportId: 导出ID, sessionId: 'ses_1' }),
      JSON.stringify({ subjectId: 'sub_B', createKey: UUID键, exportId: null }),
      JSON.stringify({ subjectId: 42, createKey: UUID键, exportId: null }),
      JSON.stringify({ subjectId: 'sub_A', createKey: 42, exportId: null }),
      JSON.stringify({ subjectId: 'sub_A', createKey: UUID键, exportId: 'nope' }),
      JSON.stringify([句柄({ exportId: 导出ID })]),
      JSON.stringify('p8-export-key-0001'),
      '{broken json',
      '',
    ];
    for (const 原文 of 损坏样例) {
      const 存储 = 内存存储();
      存储.setItem(键, 原文);
      const 甲 = 创建P8导出恢复存储({ storage: 存储, 范围: 范围甲 });
      expect(甲.读取()).toBeNull();
      expect(存储.键列表()).toEqual([]);
    }
  });

  it('写入侧：带多余字段的句柄整笔拒绝', () => {
    const 存储 = 内存存储();
    const 甲 = 创建P8导出恢复存储({ storage: 存储, 范围: 范围甲 });
    expect(甲.写入({ ...句柄({ exportId: 导出ID }), credentialId: 'cre_1' } as unknown as P8导出恢复句柄)).toBe(false);
    expect(存储.键列表()).toEqual([]);
  });

  it('序列化值只含 subjectId/createKey/exportId，绝无敏感或导出载荷字段', () => {
    const 存储 = 内存存储();
    const 侦察 = { getItem: vi.fn(存储.getItem), setItem: vi.fn(存储.setItem), removeItem: vi.fn(存储.removeItem) };
    创建P8导出恢复存储({ storage: 侦察, 范围: 范围甲 }).写入(句柄({ exportId: 导出ID }));
    const 原文 = 侦察.setItem.mock.calls[0][1] as string;
    expect(Object.keys(JSON.parse(原文)).sort()).toEqual(['createKey', 'exportId', 'subjectId']);
    for (const 禁词 of [
      'phone', 'mobile', 'credential', 'session', 'ticket', 'report', 'zip',
      'objectkey', 'object_key', 'download', 'url', 'token', 'credentialid',
      '手机', '凭证', '会话', '工单', '举报', '压缩',
    ]) {
      expect(原文.toLowerCase()).not.toContain(禁词);
    }
  });

  it('不做存储枚举，也不建跨账号索引', () => {
    const 存储 = 内存存储();
    const 甲 = 创建P8导出恢复存储({ storage: 存储, 范围: 范围甲 });
    const 乙 = 创建P8导出恢复存储({ storage: 存储, 范围: 范围乙 });
    expect(甲.写入(句柄({ exportId: 导出ID }))).toBe(true);
    expect(乙.写入(句柄({ subjectId: 'sub_B', createKey: UUID键, exportId: null }))).toBe(true);
    expect(存储.键列表().sort()).toEqual([
      账号存储键('P8数据导出v1', 范围甲),
      账号存储键('P8数据导出v1', 范围乙),
    ].sort());
    const 侦察 = { getItem: vi.fn(存储.getItem), setItem: 存储.setItem, removeItem: 存储.removeItem };
    expect(创建P8导出恢复存储({ storage: 侦察, 范围: 范围甲 }).读取()).not.toBeNull();
    expect(侦察.getItem).toHaveBeenCalledTimes(1);
    expect(侦察.getItem).toHaveBeenCalledWith(账号存储键('P8数据导出v1', 范围甲));
  });

  it('删除后不可恢复；句柄不存在时删除仍是安全 no-op', () => {
    const 存储 = 内存存储();
    const 甲 = 创建P8导出恢复存储({ storage: 存储, 范围: 范围甲 });
    expect(() => 甲.删除()).not.toThrow();
    expect(甲.写入(句柄({ exportId: 导出ID }))).toBe(true);
    甲.删除();
    expect(存储.键列表()).toEqual([]);
    expect(甲.读取()).toBeNull();
  });

  it('storage 为 null 时 fail closed：读 null、写 false、删 no-op', () => {
    const 甲 = 创建P8导出恢复存储({ storage: null, 范围: 范围甲 });
    expect(甲.读取()).toBeNull();
    expect(甲.写入(句柄({ exportId: 导出ID }))).toBe(false);
    expect(() => 甲.删除()).not.toThrow();
  });

  it('存储抛异常时 fail closed 且不崩页面', () => {
    const 甲 = 创建P8导出恢复存储({ storage: 抛错存储({ getItem: true, setItem: true, removeItem: true }), 范围: 范围甲 });
    expect(甲.读取()).toBeNull();
    expect(甲.写入(句柄({ exportId: 导出ID }))).toBe(false);
    expect(() => 甲.删除()).not.toThrow();
  });

  it('只有 getItem 抛异常时读取 fail closed；写入仍可成功', () => {
    const 存储 = 抛错存储({ getItem: true });
    const 甲 = 创建P8导出恢复存储({ storage: 存储, 范围: 范围甲 });
    expect(甲.读取()).toBeNull();
    expect(甲.写入(句柄({ exportId: 导出ID }))).toBe(true);
  });

  it('只有 setItem 抛异常时写入返回 false 且不残留', () => {
    const 甲 = 创建P8导出恢复存储({ storage: 抛错存储({ setItem: true }), 范围: 范围甲 });
    expect(甲.写入(句柄({ exportId: 导出ID }))).toBe(false);
  });

  it('只有 removeItem 抛异常时删除静默 no-op', () => {
    const 存储 = 内存存储();
    const 甲 = 创建P8导出恢复存储({ storage: 存储, 范围: 范围甲 });
    expect(甲.写入(句柄({ exportId: 导出ID }))).toBe(true);
    存储.removeItem = () => { throw new Error('删除被拒'); };
    expect(() => 创建P8导出恢复存储({ storage: 存储, 范围: 范围甲 }).删除()).not.toThrow();
    expect(甲.读取()?.exportId).toBe(导出ID);
  });
});
