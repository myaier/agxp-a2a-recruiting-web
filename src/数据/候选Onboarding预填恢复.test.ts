// 候选 onboarding 预填恢复元数据的账号范围存储测试。
// 只允许控制面五元组（mode / source 三元组 / eligibility 布尔快照 / confirmed 分区 /
// generation）落盘；suggestion 载荷、draft、candidate 文本绝不上存储。
// 物理键复用 账号存储键('候选预填恢复v1', 范围)（模式+环境+候选预填分类+账号 四重隔离）；
// 恰好闭合键集校验，任何损坏 JSON、多余字段、坏 ID grammar、坏类型一律丢弃并删除；
// 无存储或存储抛异常 fail closed：读 null、写 false、删 no-op。
// candidate 角色的强制在 Provider 创建绑定适配器之前（Task 3 接线），本模块只按范围绑定。

import { describe, expect, it, vi } from 'vitest';
import { 账号存储键 } from './资料缓存';
import { 创建候选预填恢复存储 } from './候选Onboarding预填恢复';
import type { 候选预填恢复元数据 } from '../状态/后端/类型';

function 内存存储() {
  const 数据 = new Map<string, string>();
  const 原始 = {
    getItem: (键: string): string | null => 数据.get(键) ?? null,
    setItem: (键: string, 值: string): void => { 数据.set(键, 值); },
    removeItem: (键: string): void => { 数据.delete(键); },
  };
  return {
    原始,
    /** 本测试的内存桩只实现 Storage 的三个方法；按调用点收窄成 Storage 传入。 */
    storage: 原始 as unknown as Storage,
    键列表: (): string[] => [...数据.keys()],
    设删除抛错: (): void => {
      原始.removeItem = () => { throw new Error('删除被拒'); };
    },
  };
}

function 抛错存储(失败: Partial<Record<'getItem' | 'setItem' | 'removeItem', boolean>>): Storage {
  const 异常 = new Error('存储不可用');
  return {
    getItem: () => { if (失败.getItem) throw 异常; return null; },
    setItem: () => { if (失败.setItem) throw 异常; },
    removeItem: () => { if (失败.removeItem) throw 异常; },
  } as unknown as Storage;
}

const 范围甲 = { 模式: 'backend', 环境: 'local', 账号: 'sub_A' } as const;
const 键 = 账号存储键('候选预填恢复v1', 范围甲);

function 元数据(覆盖: Partial<候选预填恢复元数据> = {}): 候选预填恢复元数据 {
  return {
    mode: 'auto',
    source: {
      file_id: `rf_${'a'.repeat(32)}`,
      version_id: `rfv_${'b'.repeat(32)}`,
      parse_id: `rp_${'c'.repeat(32)}`,
    },
    eligibility: {
      profile: { real_name: true, work_start_year: true, gender: false, birth_year: false, birth_month: false, current_education: true },
      summary: false,
      skills: true,
      experiences: true,
      educations: false,
      certificates: false,
    },
    confirmed: {
      basic: true,
      degree: false,
      institution: false,
      major: false,
      education_period: false,
      work: false,
      summary: false,
    },
    generation: 3,
    ...覆盖,
  };
}

describe('候选预填恢复存储', () => {
  it('一个 模式+环境+账号 只有一个物理键，且复用 账号存储键 约定', () => {
    const 存储 = 内存存储();
    const 侦察 = { getItem: vi.fn(存储.原始.getItem), setItem: vi.fn(存储.原始.setItem), removeItem: vi.fn(存储.原始.removeItem) };
    const 甲 = 创建候选预填恢复存储({ storage: 侦察 as unknown as Storage, 范围: 范围甲 });
    expect(甲.写入(元数据())).toBe(true);
    expect(侦察.setItem).toHaveBeenCalledTimes(1);
    expect(侦察.setItem.mock.calls[0][0]).toBe(账号存储键('候选预填恢复v1', 范围甲));
    expect(存储.键列表()).toEqual([键]);
  });

  it('模式、环境或账号变化产生不同物理键，互不读取', () => {
    const 存储 = 内存存储();
    const 本地 = 创建候选预填恢复存储({ storage: 存储.storage, 范围: 范围甲 });
    expect(本地.写入(元数据())).toBe(true);
    const 预发 = 创建候选预填恢复存储({ storage: 存储.storage, 范围: { ...范围甲, 环境: 'stg' } });
    const 演示 = 创建候选预填恢复存储({ storage: 存储.storage, 范围: { ...范围甲, 模式: 'mock' } });
    const 乙 = 创建候选预填恢复存储({ storage: 存储.storage, 范围: { ...范围甲, 账号: 'sub_B' } });
    expect(预发.读取()).toBeNull();
    expect(演示.读取()).toBeNull();
    expect(乙.读取()).toBeNull();
    expect(存储.键列表()).toEqual([键]);
  });

  it('完整往返：读回与写入的元数据逐项相等（含 parse_id:null 与 manual 模式）', () => {
    const 存储 = 内存存储();
    const 甲 = 创建候选预填恢复存储({ storage: 存储.storage, 范围: 范围甲 });
    expect(甲.写入(元数据())).toBe(true);
    expect(甲.读取()).toEqual(元数据());

    const 无解析 = 元数据({ mode: 'manual', source: { file_id: `rf_${'a'.repeat(32)}`, version_id: `rfv_${'b'.repeat(32)}`, parse_id: null } });
    expect(甲.写入(无解析)).toBe(true);
    expect(甲.读取()).toEqual(无解析);
  });

  it('序列化值只含控制面五元组，绝无 draft/建议载荷/candidate 文本', () => {
    const 存储 = 内存存储();
    const 侦察 = { getItem: vi.fn(存储.原始.getItem), setItem: vi.fn(存储.原始.setItem), removeItem: vi.fn(存储.原始.removeItem) };
    创建候选预填恢复存储({ storage: 侦察 as unknown as Storage, 范围: 范围甲 }).写入(元数据());
    const 原文 = 侦察.setItem.mock.calls[0][1] as string;
    const 解析 = JSON.parse(原文) as Record<string, unknown>;
    expect(Object.keys(解析).sort()).toEqual(['confirmed', 'eligibility', 'generation', 'mode', 'source']);
    expect(Object.keys(解析.eligibility as object).sort()).toEqual(
      ['certificates', 'educations', 'experiences', 'profile', 'skills', 'summary'],
    );
    expect(Object.keys((解析.eligibility as { profile: object }).profile).sort()).toEqual(
      ['birth_month', 'birth_year', 'current_education', 'gender', 'real_name', 'work_start_year'],
    );
    expect(Object.keys(解析.confirmed as object).sort()).toEqual(
      ['basic', 'degree', 'education_period', 'institution', 'major', 'summary', 'work'],
    );
    for (const 禁词 of [
      'draft', 'schema_version', 'warnings', 'confidence', 'source_name', 'match', 'suggestion',
      'Synthetic Candidate', 'Builds reliable synthetic systems.', 'Example Systems', 'Synthetic Gateway',
      '真名', '个人优势', '简历正文',
    ]) {
      expect(原文).not.toContain(禁词);
    }
    // eligibility.summary 是布尔开关，不是 summary 文本
    expect((解析.eligibility as { summary: unknown }).summary).toBe(false);
  });

  it('写入构造全新白名单对象：写入后改输入不影响已存值', () => {
    const 存储 = 内存存储();
    const 甲 = 创建候选预填恢复存储({ storage: 存储.storage, 范围: 范围甲 });
    const 输入 = 元数据();
    expect(甲.写入(输入)).toBe(true);
    输入.eligibility.profile.real_name = false;
    输入.confirmed.basic = false;
    输入.generation = 99;
    expect(甲.读取()).toEqual(元数据());
  });

  it('读取侧：多余字段（含 suggestion 载荷）、坏类型、坏 grammar 一律丢弃并删除', () => {
    const 损坏样例 = [
      JSON.stringify({ ...元数据(), suggestion: { schema_version: 'resume-prefill.v1' } }),
      JSON.stringify({ ...元数据(), draft: { profile: { real_name: 'Synthetic Candidate' } } }),
      JSON.stringify({ ...元数据(), error: 'boom' }),
      JSON.stringify({ mode: 'auto', source: 元数据().source, eligibility: 元数据().eligibility, confirmed: 元数据().confirmed }),
      JSON.stringify({ ...元数据(), mode: 'other' }),
      JSON.stringify({ ...元数据(), mode: 1 }),
      JSON.stringify({ ...元数据(), source: { ...元数据().source, file_id: 'rf_1' } }),
      JSON.stringify({ ...元数据(), source: { ...元数据().source, version_id: `rfv_${'B'.repeat(32)}` } }),
      JSON.stringify({ ...元数据(), source: { ...元数据().source, parse_id: 'rp_zzz' } }),
      JSON.stringify({ ...元数据(), eligibility: { ...元数据().eligibility, extra: true } }),
      JSON.stringify({ ...元数据(), eligibility: { ...元数据().eligibility, skills: 'yes' } }),
      JSON.stringify({ ...元数据(), eligibility: { profile: { real_name: 1, work_start_year: true, gender: true, birth_year: true, birth_month: true }, summary: true, skills: true, experiences: true, educations: true, certificates: true } }),
      // codex review-r2：current_education 键存在但非布尔（缺布尔循环校验时会被错误接受）
      JSON.stringify({ ...元数据(), eligibility: { profile: { real_name: true, work_start_year: true, gender: true, birth_year: true, birth_month: true, current_education: 'true' }, summary: true, skills: true, experiences: true, educations: true, certificates: true } }),
      JSON.stringify({ ...元数据(), confirmed: { basic: true, degree: false, institution: false, major: false, education_period: false, work: false } }),
      JSON.stringify({ ...元数据(), confirmed: { ...元数据().confirmed, extra: false } }),
      JSON.stringify({ ...元数据(), confirmed: { ...元数据().confirmed, basic: 'yes' } }),
      JSON.stringify({ ...元数据(), generation: -1 }),
      JSON.stringify({ ...元数据(), generation: 1.5 }),
      JSON.stringify({ ...元数据(), generation: '3' }),
      JSON.stringify([元数据()]),
      JSON.stringify('candidate-prefill'),
      '{broken json',
      '',
    ];
    for (const 原文 of 损坏样例) {
      const 存储 = 内存存储();
      存储.原始.setItem(键, 原文);
      const 甲 = 创建候选预填恢复存储({ storage: 存储.storage, 范围: 范围甲 });
      expect(甲.读取()).toBeNull();
      expect(存储.键列表()).toEqual([]);
    }
  });

  it('写入侧：带多余字段或非法值的元数据整笔拒绝', () => {
    const 存储 = 内存存储();
    const 甲 = 创建候选预填恢复存储({ storage: 存储.storage, 范围: 范围甲 });
    expect(甲.写入({ ...元数据(), suggestion: { schema_version: 'resume-prefill.v1' } } as unknown as 候选预填恢复元数据)).toBe(false);
    expect(甲.写入(元数据({ mode: 'other' as 'auto' }))).toBe(false);
    expect(甲.写入(元数据({ source: { file_id: 'bad', version_id: `rfv_${'b'.repeat(32)}`, parse_id: null } }))).toBe(false);
    expect(甲.写入(元数据({ generation: -1 }))).toBe(false);
    expect(存储.键列表()).toEqual([]);
    expect(甲.读取()).toBeNull();
  });

  it('不做存储枚举，只按唯一键精确读写', () => {
    const 存储 = 内存存储();
    const 侦察 = { getItem: vi.fn(存储.原始.getItem), setItem: 存储.原始.setItem, removeItem: 存储.原始.removeItem };
    const 甲 = 创建候选预填恢复存储({ storage: 侦察 as unknown as Storage, 范围: 范围甲 });
    甲.写入(元数据());
    expect(甲.读取()).not.toBeNull();
    expect(侦察.getItem).toHaveBeenCalledTimes(1);
    expect(侦察.getItem).toHaveBeenCalledWith(键);
  });

  it('删除后不可恢复；无记录时删除仍是安全 no-op', () => {
    const 存储 = 内存存储();
    const 甲 = 创建候选预填恢复存储({ storage: 存储.storage, 范围: 范围甲 });
    expect(() => 甲.删除()).not.toThrow();
    expect(甲.写入(元数据())).toBe(true);
    甲.删除();
    expect(存储.键列表()).toEqual([]);
    expect(甲.读取()).toBeNull();
  });

  it('storage 为 null 时 fail closed：读 null、写 false、删 no-op', () => {
    const 甲 = 创建候选预填恢复存储({ storage: null, 范围: 范围甲 });
    expect(甲.读取()).toBeNull();
    expect(甲.写入(元数据())).toBe(false);
    expect(() => 甲.删除()).not.toThrow();
  });

  it('存储抛异常时 fail closed 且不崩页面', () => {
    const 甲 = 创建候选预填恢复存储({ storage: 抛错存储({ getItem: true, setItem: true, removeItem: true }), 范围: 范围甲 });
    expect(甲.读取()).toBeNull();
    expect(甲.写入(元数据())).toBe(false);
    expect(() => 甲.删除()).not.toThrow();
  });

  it('只有 getItem 抛异常时读取 fail closed；写入仍可成功', () => {
    const 甲 = 创建候选预填恢复存储({ storage: 抛错存储({ getItem: true }), 范围: 范围甲 });
    expect(甲.读取()).toBeNull();
    expect(甲.写入(元数据())).toBe(true);
  });

  it('只有 setItem 抛异常时写入返回 false 且不残留', () => {
    const 甲 = 创建候选预填恢复存储({ storage: 抛错存储({ setItem: true }), 范围: 范围甲 });
    expect(甲.写入(元数据())).toBe(false);
  });

  it('只有 removeItem 抛异常时删除静默 no-op', () => {
    const 存储 = 内存存储();
    const 甲 = 创建候选预填恢复存储({ storage: 存储.storage, 范围: 范围甲 });
    expect(甲.写入(元数据())).toBe(true);
    存储.设删除抛错();
    expect(() => 创建候选预填恢复存储({ storage: 存储.storage, 范围: 范围甲 }).删除()).not.toThrow();
    expect(甲.读取()).toEqual(元数据());
  });
});
