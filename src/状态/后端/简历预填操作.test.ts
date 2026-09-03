// 候选 onboarding 简历预填操作的行为边界 —— 真实 factory + fake refs 驱动 创建简历预填操作(deps)
// （与 附件简历操作.test.ts 同一纪律：setter 冻结为与真实 Provider 同步更新 ref 的语义）。
// 铁律（设计 §6.4–§6.5 / §9–§10）：
//   · Mock / 无后端 / 非候选：零预填请求、零恢复元数据触碰；
//   · 激活 = 显式新一轮：递增预填代际、按权威简历快照记 eligibility、旧建议/确认清零、旧元数据删除；
//   · 同步 = 权威解析推进：succeeded 先把真实 parse_id 写进内存 source 与恢复元数据，再单飞读取；
//   · 读栅栏六坐标（subject / candidate 角色 / 会话代际 / 预填代际 / exact tuple）任一失配的
//     迟到成败整包丢弃 —— 不提交建议、不清新会话；
//   · 401 当前栅栏统一 清账号状态、迟到 401 只丢弃；404/409 一次权威附件刷新后重派；终局与
//     可重试失败语义（在线简历数据不动、绝不应用半份数据）；
//   · 恢复只认 pristine inactive 轮：pending 分支按 允许等待解析 决定 waiting_parse / 立即 manual。

import { describe, expect, it, vi } from 'vitest';
import type {
  BFF主体,
  BFF附件简历库,
  BFF附件简历,
  BFF附件解析状态,
  BFF简历,
  BFF简历预填建议,
} from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { BFF错误 } from '../../数据/HTTP客户端';
import { 构造映射变体基底 } from '../../数据/招聘数据源/简历预填.fixture';
import { 初始状态 } from '../初始状态';
import { 创建空P4发现状态 } from './发现推荐操作';
import { 创建空P5MatchCase状态 } from './MatchCase操作';
import { 创建空P7会话状态 } from './真人会话操作';
import { 创建空P8控制面状态 } from './P8控制面操作';
import type {
  后端操作依赖,
  后端状态,
  候选预填Eligibility,
  候选预填恢复元数据,
  候选预填状态,
  候选预填阶段,
  候选预填运行时引用,
} from './类型';
import { 创建空候选预填状态 } from './类型';
import { 创建简历预填操作 } from './简历预填操作';

// ── 坐标与样本（与 简历预填成功信封 的 source 三元组逐字一致）──

const 文件ID = 'rf_0123456789abcdef0123456789abcdef';
const 版本ID = 'rfv_0123456789abcdef0123456789abcdef';
const 解析ID = 'rp_0123456789abcdef0123456789abcdef';
const 新文件ID = 'rf_fedcba9876543210fedcba9876543210';
const 新版本ID = 'rfv_fedcba9876543210fedcba9876543210';
const 新解析ID = 'rp_fedcba9876543210fedcba9876543210';

const limits: BFF附件简历库['limits'] = {
  max_files: 3,
  max_file_bytes: 10485760,
  accepted_media_types: ['application/pdf'],
};

function 解析状态(
  名: 'succeeded' | 'pending' | 'processing' | 'not_started' | 'failed',
  parseId = 解析ID,
): BFF附件解析状态 {
  switch (名) {
    case 'succeeded':
      return { status: 'succeeded', parse_id: parseId, updated_at: '2026-09-01T00:02:00Z' };
    case 'pending':
      return { status: 'pending', updated_at: '2026-09-01T00:01:00Z' };
    case 'processing':
      return { status: 'processing', updated_at: '2026-09-01T00:01:30Z' };
    case 'failed':
      return { status: 'failed', failure_code: 'document_unreadable', updated_at: '2026-09-01T00:03:00Z' };
    case 'not_started':
      return { status: 'not_started' };
  }
}

function 附件(
  parse: BFF附件解析状态,
  fileId = 文件ID,
  versionId = 版本ID,
): BFF附件简历 {
  return {
    file_id: fileId,
    display_name: '沈亦舟_简历_2026.pdf',
    revision: 1,
    current_version: {
      version_id: versionId,
      version: 1,
      size_bytes: 1024,
      media_type: 'application/pdf',
      sha256: 'a'.repeat(64),
      created_at: '2026-09-01T00:00:00Z',
      parse,
    },
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };
}

/** 全空白的权威简历快照：source 绑定时全部字段/列表都可被建议填充。 */
const 空白简历快照: BFF简历 = {
  profile: {
    real_name: '',
    work_start_year: null,
    status: '',
    current_education: null,
    graduation_year: null,
    gender: null,
    birth_year: null,
    birth_month: null,
  },
  profile_revision: 0,
  summary: '',
  summary_revision: 0,
  skills: [],
  skills_revision: 0,
  experiences: [],
  educations: [],
  certificates: [],
  aggregate_revision: 0,
};

const 全可填Eligibility: 候选预填Eligibility = {
  profile: { real_name: true, work_start_year: true, gender: true, birth_year: true, birth_month: true },
  summary: true,
  skills: true,
  experiences: true,
  educations: true,
  certificates: true,
};

function 恢复元数据(覆盖: Partial<候选预填恢复元数据> = {}): 候选预填恢复元数据 {
  return {
    mode: 'auto',
    source: { file_id: 文件ID, version_id: 版本ID, parse_id: null },
    eligibility: 全可填Eligibility,
    confirmed: 创建空候选预填状态().confirmed,
    generation: 2,
    ...覆盖,
  };
}

/** 绑定中的 auto 轮（缺省 waiting_parse、parse_id 未升级）。 */
function 绑定轮(
  parseId: string | null = null,
  phase: 候选预填阶段 = 'waiting_parse',
  generation = 2,
): 候选预填状态 {
  return {
    ...创建空候选预填状态(generation),
    phase,
    source: { file_id: 文件ID, version_id: 版本ID, parse_id: parseId },
    eligibility: 全可填Eligibility,
  };
}

/** 内存恢复元数据的假适配器（含读取最终落盘值的探针）。 */
function 创建假恢复存储(初始: 候选预填恢复元数据 | null = null) {
  let 值 = 初始;
  return {
    读取: vi.fn((): 候选预填恢复元数据 | null => 值),
    写入: vi.fn((metadata: 候选预填恢复元数据): boolean => {
      值 = metadata;
      return true;
    }),
    删除: vi.fn((): void => {
      值 = null;
    }),
    取值: (): 候选预填恢复元数据 | null => 值,
  };
}

/** 标准 deferred helper：手动控制一次预填读取的结算时机。 */
function 可控Promise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

type 解析名 = 'succeeded' | 'pending' | 'processing' | 'not_started' | 'failed';

interface 预填场景选项 {
  parse?: 解析名;
  角色?: 'candidate' | 'recruiter' | null;
  是后端?: boolean;
  /** 缺省：绑定 (文件ID, 版本ID, parse_id:null) 的 waiting_parse 自动轮。 */
  预填?: 候选预填状态;
  元数据?: 候选预填恢复元数据 | null;
  简历快照?: BFF简历 | null;
  附件库?: BFF附件简历库 | null;
}

function 创建预填场景(选项: 预填场景选项 = {}) {
  const {
    parse = 'succeeded',
    角色 = 'candidate',
    是后端 = true,
    预填 = 绑定轮(null),
    元数据 = null,
    简历快照 = 空白简历快照,
    附件库 = { items: [附件(解析状态(parse))], limits },
  } = 选项;
  const 后端 = {
    读取简历预填: vi.fn(),
    读取附件简历库: vi.fn(),
    清空目录缓存: vi.fn(),
  };
  const 恢复存储 = 创建假恢复存储(元数据);
  const 主体: BFF主体 | null = 角色 === null
    ? null
    : { subject_id: 'sub_1', roles: [], last_used_role: 角色 };
  const 后端状态引用 = { current: {
    初始化: '完成' as const,
    已登录: true,
    主体,
    简历快照,
    意向快照: {},
    岗位快照: {},
    隐私快照: null,
    候选规则快照: {},
    招聘规则快照: {},
    候选规则提案: {},
    招聘规则提案: {},
    Agent规则水合: {
      candidate: { rules: '未开始' as const, proposals: '未开始' as const },
      recruiter: { rules: '未开始' as const, proposals: '未开始' as const },
    },
    ...创建空P4发现状态(),
    ...创建空P5MatchCase状态(),
    ...创建空P7会话状态(),
    ...创建空P8控制面状态(),
    附件简历库: 附件库,
    招聘方档案水合阶段: '未开始' as const,
    招聘方组织水合: { 阶段: '未开始' as const, 错误: null },
    候选预填状态: 预填,
  } as 后端状态 };
  const 设后端状态 = vi.fn((更新: (旧: 后端状态) => 后端状态) => {
    后端状态引用.current = 更新(后端状态引用.current);
  });
  const 候选预填代际 = { current: 2 };
  const 依赖 = {
    是后端,
    后端: 后端 as unknown as HTTP招聘数据源,
    派发: vi.fn(),
    设后端状态,
    后端状态引用,
    状态引用: { current: 初始状态 },
    锁: { current: new Set<string>() },
    尝试引用: { current: null as string | null },
    主体标识引用: { current: 'sub_1' as string | null },
    会话代际: { current: 1 },
    读取恢复企业关系编号: vi.fn(() => null),
    候选预填代际,
    候选预填读取锁: { current: new Map<string, Promise<void>>() },
    候选预填恢复: { current: 恢复存储 },
  } satisfies 后端操作依赖 & 候选预填运行时引用;
  const 操作 = 创建简历预填操作(依赖);
  return {
    后端,
    操作,
    依赖,
    设后端状态,
    后端状态引用,
    会话代际: 依赖.会话代际,
    主体标识引用: 依赖.主体标识引用,
    候选预填代际,
    候选预填读取锁: 依赖.候选预填读取锁,
    恢复存储,
  };
}

type 场景 = ReturnType<typeof 创建预填场景>;

/** 断言用：读当前预填轮（缺席按 pristine 收口，与读取方同一口径）。 */
function 预填(场景: 场景): 候选预填状态 {
  return 场景.后端状态引用.current.候选预填状态 ?? 创建空候选预填状态();
}

// ── Mock / 无后端 / 非候选：零请求、零恢复元数据 ─────────────────────

describe('创建简历预填操作 · Mock / 无后端 / 非候选', () => {
  it('无后端（是后端=false）时全部方法零请求零元数据触碰，内存轮原样', async () => {
    const 场景 = 创建预填场景({ 是后端: false, 元数据: 恢复元数据() });
    await 场景.操作.恢复候选Onboarding预填({ 允许等待解析: true });
    场景.操作.激活候选Onboarding预填();
    await 场景.操作.同步候选Onboarding解析();
    await 场景.操作.重试候选Onboarding预填();
    场景.操作.继续手填候选Onboarding();
    场景.操作.确认候选Onboarding预填分区('basic');
    expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
    expect(场景.后端.读取附件简历库).not.toHaveBeenCalled();
    expect(场景.恢复存储.读取).not.toHaveBeenCalled();
    expect(场景.恢复存储.写入).not.toHaveBeenCalled();
    expect(场景.恢复存储.删除).not.toHaveBeenCalled();
    expect(预填(场景)).toEqual(绑定轮(null));
    expect(场景.候选预填代际.current).toBe(2);
  });

  it('非候选（recruiter）会话同样零请求零元数据', async () => {
    const 场景 = 创建预填场景({ 角色: 'recruiter', 元数据: 恢复元数据() });
    await 场景.操作.恢复候选Onboarding预填({ 允许等待解析: true });
    场景.操作.激活候选Onboarding预填();
    await 场景.操作.同步候选Onboarding解析();
    场景.操作.继续手填候选Onboarding();
    expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
    expect(场景.恢复存储.读取).not.toHaveBeenCalled();
    expect(场景.恢复存储.写入).not.toHaveBeenCalled();
    expect(场景.恢复存储.删除).not.toHaveBeenCalled();
    expect(预填(场景)).toEqual(绑定轮(null));
  });

  it('主体未水合（主体 null）时恢复静默返回，不删元数据', async () => {
    const 场景 = 创建预填场景({ 角色: null, 预填: 创建空候选预填状态(2), 元数据: 恢复元数据() });
    await 场景.操作.恢复候选Onboarding预填({ 允许等待解析: true });
    expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
    expect(场景.恢复存储.删除).not.toHaveBeenCalled();
    expect(预填(场景).phase).toBe('inactive');
  });
});

// ── 工厂引用断言 ────────────────────────────────────────────────

describe('创建简历预填操作 · 运行时引用断言', () => {
  it('缺少候选预填运行时引用时工厂入口抛错（绝不静默降级成 no-op）', () => {
    const 场景 = 创建预填场景();
    expect(() => 创建简历预填操作({ ...场景.依赖, 候选预填代际: undefined }))
      .toThrow(/候选预填运行时引用未初始化/);
    expect(() => 创建简历预填操作({ ...场景.依赖, 候选预填读取锁: undefined }))
      .toThrow(/候选预填运行时引用未初始化/);
    expect(() => 创建简历预填操作({ ...场景.依赖, 候选预填恢复: undefined }))
      .toThrow(/候选预填运行时引用未初始化/);
  });
});

// ── 激活：显式新一轮 ────────────────────────────────────────────

describe('创建简历预填操作 · 激活（显式新一轮）', () => {
  it('激活进入 arming：递增代际、按简历快照记 eligibility、清建议/确认、删旧元数据', () => {
    const 已就绪轮 = { ...绑定轮(解析ID, 'ready', 2), suggestion: 构造映射变体基底() };
    const 场景 = 创建预填场景({ 预填: 已就绪轮, 元数据: 恢复元数据() });
    场景.操作.激活候选Onboarding预填();
    const 状态 = 预填(场景);
    expect(状态.phase).toBe('arming');
    expect(状态.source).toBeNull();
    expect(状态.suggestion).toBeNull();
    expect(状态.confirmed).toEqual(创建空候选预填状态().confirmed);
    expect(状态.eligibility).toEqual(全可填Eligibility);
    expect(状态.generation).toBe(3);
    expect(场景.候选预填代际.current).toBe(3);
    expect(场景.恢复存储.删除).toHaveBeenCalledTimes(1);
    expect(场景.恢复存储.取值()).toBeNull();
  });

  it('非空简历快照的字段/列表记为不可覆盖（服务端已有事实优先）', () => {
    const 场景 = 创建预填场景({
      简历快照: {
        ...空白简历快照,
        profile: { ...空白简历快照.profile, real_name: '沈亦舟' },
        skills: ['Go'],
      },
    });
    场景.操作.激活候选Onboarding预填();
    expect(预填(场景).eligibility).toEqual({
      ...全可填Eligibility,
      profile: { ...全可填Eligibility.profile, real_name: false },
      skills: false,
    });
  });

  it('无附件库时激活仍进入 arming，随后的同步零读取（绑定等权威附件在场）', async () => {
    const 场景 = 创建预填场景({ 附件库: null, 预填: 创建空候选预填状态(2) });
    场景.操作.激活候选Onboarding预填();
    expect(预填(场景).phase).toBe('arming');
    await 场景.操作.同步候选Onboarding解析();
    expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
    expect(预填(场景).phase).toBe('arming');
  });
});

// ── 同步：权威解析推进 ──────────────────────────────────────────

describe('创建简历预填操作 · 同步（权威解析推进）', () => {
  it('pending 附件：arming 轮绑定来源进入 waiting_parse，零次预填读取，元数据落盘', async () => {
    const 场景 = 创建预填场景({ parse: 'pending', 预填: { ...创建空候选预填状态(2), phase: 'arming' } });
    await 场景.操作.同步候选Onboarding解析();
    const 状态 = 预填(场景);
    expect(状态.phase).toBe('waiting_parse');
    expect(状态.source).toEqual({ file_id: 文件ID, version_id: 版本ID, parse_id: null });
    expect(状态.eligibility).toEqual(全可填Eligibility);
    expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
    expect(场景.恢复存储.取值()).toEqual(恢复元数据({ generation: 2 }));
  });

  it('succeeded 附件：先把真实 parse_id 写进内存与元数据，再单飞读取并提交 ready', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded', 预填: { ...创建空候选预填状态(2), phase: 'arming' } });
    const 门 = 可控Promise<BFF简历预填建议>();
    场景.后端.读取简历预填.mockReturnValue(门.promise);
    const 同步中 = 场景.操作.同步候选Onboarding解析();
    // 读取已起飞，且内存与恢复元数据都在结算前升级到权威 parse_id
    expect(场景.后端.读取简历预填).toHaveBeenCalledWith({
      file_id: 文件ID, version_id: 版本ID, parse_id: 解析ID,
    });
    expect(预填(场景).phase).toBe('loading');
    expect(预填(场景).source).toEqual({ file_id: 文件ID, version_id: 版本ID, parse_id: 解析ID });
    expect(场景.恢复存储.取值()?.source.parse_id).toBe(解析ID);
    门.resolve(构造映射变体基底());
    await 同步中;
    expect(预填(场景).phase).toBe('ready');
    expect(预填(场景).suggestion).toEqual(构造映射变体基底());
    expect(预填(场景).error).toBeNull();
  });

  it('waiting_parse 轮在权威 succeeded 后升级 parse_id 并读取', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    场景.后端.读取简历预填.mockResolvedValue(构造映射变体基底());
    await 场景.操作.同步候选Onboarding解析();
    expect(预填(场景).phase).toBe('ready');
    expect(场景.后端.读取简历预填).toHaveBeenCalledTimes(1);
  });

  it('同 tuple 已 ready 时同步幂等：零重读、建议保留', async () => {
    const 场景 = 创建预填场景({
      parse: 'succeeded',
      预填: { ...绑定轮(解析ID, 'ready', 2), suggestion: 构造映射变体基底() },
    });
    await 场景.操作.同步候选Onboarding解析();
    expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
    expect(预填(场景).suggestion).toEqual(构造映射变体基底());
  });

  it.each(['manual', 'inactive', 'failed'] as const)('%s 轮同步零动作', async (阶段) => {
    const 场景 = 创建预填场景({
      parse: 'succeeded',
      预填: 阶段 === 'inactive' ? 创建空候选预填状态(2) : 绑定轮(解析ID, 阶段, 2),
    });
    await 场景.操作.同步候选Onboarding解析();
    expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
    expect(预填(场景).phase).toBe(阶段);
  });

  it('权威 parse failed：进入 failed、零预填读取（不请求建议）', async () => {
    const 场景 = 创建预填场景({ parse: 'failed', 预填: { ...创建空候选预填状态(2), phase: 'arming' } });
    await 场景.操作.同步候选Onboarding解析();
    expect(预填(场景).phase).toBe('failed');
    expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
  });
});

// ── 单飞 ───────────────────────────────────────────────────────

describe('创建简历预填操作 · exact tuple 单飞', () => {
  it('同 tuple 并发同步只发一次读取，两路都收口；锁在 finally 释放', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    const 门 = 可控Promise<BFF简历预填建议>();
    场景.后端.读取简历预填.mockReturnValue(门.promise);
    const 第一 = 场景.操作.同步候选Onboarding解析();
    const 第二 = 场景.操作.同步候选Onboarding解析();
    expect(场景.后端.读取简历预填).toHaveBeenCalledTimes(1);
    门.resolve(构造映射变体基底());
    await Promise.all([第一, 第二]);
    expect(预填(场景).phase).toBe('ready');
    expect(场景.候选预填读取锁.current.size).toBe(0);
  });
});

// ── 替换与迟到栅栏 ──────────────────────────────────────────────

describe('创建简历预填操作 · 替换与迟到栅栏（整包丢弃）', () => {
  it('drops a success that settles after replacement activation', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    const 门 = 可控Promise<BFF简历预填建议>();
    场景.后端.读取简历预填.mockReturnValue(门.promise);
    const oldRead = 场景.操作.同步候选Onboarding解析();
    场景.操作.激活候选Onboarding预填();
    门.resolve(构造映射变体基底());
    await oldRead;
    expect(场景.后端状态引用.current.候选预填状态?.suggestion).toBeNull();
    expect(预填(场景).phase).toBe('arming');
  });

  it('subject 换代后迟到的成功被丢弃', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    const 门 = 可控Promise<BFF简历预填建议>();
    场景.后端.读取简历预填.mockReturnValue(门.promise);
    const 读取 = 场景.操作.同步候选Onboarding解析();
    场景.主体标识引用.current = 'sub_other';
    门.resolve(构造映射变体基底());
    await 读取;
    expect(预填(场景).suggestion).toBeNull();
    expect(预填(场景).phase).toBe('loading');
  });

  it('角色切离 candidate 后迟到的成功被丢弃', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    const 门 = 可控Promise<BFF简历预填建议>();
    场景.后端.读取简历预填.mockReturnValue(门.promise);
    const 读取 = 场景.操作.同步候选Onboarding解析();
    场景.后端状态引用.current = {
      ...场景.后端状态引用.current,
      主体: { subject_id: 'sub_1', roles: [], last_used_role: 'recruiter' },
    };
    门.resolve(构造映射变体基底());
    await 读取;
    expect(预填(场景).suggestion).toBeNull();
  });

  it('会话代际递增后迟到的成功被丢弃', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    const 门 = 可控Promise<BFF简历预填建议>();
    场景.后端.读取简历预填.mockReturnValue(门.promise);
    const 读取 = 场景.操作.同步候选Onboarding解析();
    场景.会话代际.current += 1;
    门.resolve(构造映射变体基底());
    await 读取;
    expect(预填(场景).suggestion).toBeNull();
  });

  it('清候选Onboarding预填 后迟到的成功被丢弃（内存/锁/元数据全清）', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded', 元数据: 恢复元数据() });
    const 门 = 可控Promise<BFF简历预填建议>();
    场景.后端.读取简历预填.mockReturnValue(门.promise);
    const 读取 = 场景.操作.同步候选Onboarding解析();
    场景.操作.清候选Onboarding预填();
    expect(预填(场景)).toEqual(创建空候选预填状态(3));
    expect(场景.候选预填代际.current).toBe(3);
    expect(场景.候选预填读取锁.current.size).toBe(0);
    expect(场景.恢复存储.取值()).toBeNull();
    门.resolve(构造映射变体基底());
    await 读取;
    expect(预填(场景).suggestion).toBeNull();
    expect(预填(场景).phase).toBe('inactive');
  });

  it('附件被替换（file/version 换新）后迟到的成功被丢弃', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    const 门 = 可控Promise<BFF简历预填建议>();
    场景.后端.读取简历预填.mockReturnValue(门.promise);
    const 读取 = 场景.操作.同步候选Onboarding解析();
    场景.后端状态引用.current = {
      ...场景.后端状态引用.current,
      附件简历库: { items: [附件(解析状态('succeeded', 新解析ID), 新文件ID, 新版本ID)], limits },
    };
    门.resolve(构造映射变体基底());
    await 读取;
    expect(预填(场景).suggestion).toBeNull();
  });

  it('manual opt-out blocks a late suggestion', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    const 门 = 可控Promise<BFF简历预填建议>();
    场景.后端.读取简历预填.mockReturnValue(门.promise);
    const read = 场景.操作.同步候选Onboarding解析();
    场景.操作.继续手填候选Onboarding();
    门.resolve(构造映射变体基底());
    await read;
    expect(场景.后端状态引用.current.候选预填状态?.phase).toBe('manual');
    expect(场景.后端状态引用.current.候选预填状态?.suggestion).toBeNull();
  });
});

// ── 401：当前栅栏统一清账号，迟到 401 只丢弃 ─────────────────────

describe('创建简历预填操作 · 401 与会话换代', () => {
  it('当前栅栏 401：统一 清账号状态（内存摊平 + 代际递增 + 锁清空 + 元数据删除）', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded', 元数据: 恢复元数据() });
    场景.后端.读取简历预填.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await 场景.操作.同步候选Onboarding解析();
    expect(场景.后端状态引用.current.已登录).toBe(false);
    expect(场景.后端状态引用.current.主体).toBeNull();
    expect(预填(场景)).toEqual(创建空候选预填状态());
    expect(场景.候选预填代际.current).toBeGreaterThan(2);
    expect(场景.候选预填读取锁.current.size).toBe(0);
    expect(场景.恢复存储.删除).toHaveBeenCalledTimes(1);
    expect(场景.后端.清空目录缓存).toHaveBeenCalled();
  });

  it('会话换代后到达的迟到 401 只丢弃：不清新会话、不删元数据', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded', 元数据: 恢复元数据() });
    const 门 = 可控Promise<never>();
    场景.后端.读取简历预填.mockReturnValue(门.promise);
    const 读取 = 场景.操作.同步候选Onboarding解析();
    场景.会话代际.current += 1;
    门.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await 读取;
    expect(场景.后端状态引用.current.已登录).toBe(true);
    expect(场景.后端.清空目录缓存).not.toHaveBeenCalled();
    expect(场景.恢复存储.删除).not.toHaveBeenCalled();
    expect(预填(场景).phase).toBe('loading');
  });
});

// ── 终局失败 ───────────────────────────────────────────────────

describe('创建简历预填操作 · 终局失败（400/403/invalid_response）', () => {
  it.each([
    ['400 invalid_request_body', new BFF错误(400, 'invalid_request_body', 'bad')],
    ['403 forbidden', new BFF错误(403, 'forbidden', 'no')],
  ])('%s：进入 failed、错误文案落位、在线简历不动、建议不落', async (_名, 错误) => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    场景.后端.读取简历预填.mockRejectedValue(错误);
    await 场景.操作.同步候选Onboarding解析();
    const 状态 = 预填(场景);
    expect(状态.phase).toBe('failed');
    expect(状态.error).toBeTruthy();
    expect(状态.suggestion).toBeNull();
    // 在线简历数据原样（同一对象引用），绝不清空、不回退 Mock
    expect(场景.后端状态引用.current.简历快照).toBe(空白简历快照);
  });

  it('invalid_response（status 200 契约漂移）：failed 关闭，绝不应用半份解码数据', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    场景.后端.读取简历预填.mockRejectedValue(
      new BFF错误(200, 'invalid_response', '简历预填响应不符合 resume-prefill.v1 契约'),
    );
    await 场景.操作.同步候选Onboarding解析();
    const 状态 = 预填(场景);
    expect(状态.phase).toBe('failed');
    expect(状态.suggestion).toBeNull();
    expect(场景.后端状态引用.current.简历快照).toBe(空白简历快照);
  });
});

// ── 404 / 409：一次性权威刷新后重派 ─────────────────────────────

describe('创建简历预填操作 · 404/409 一次性刷新', () => {
  it.each([404, 409])('%i 同 tuple 仍不可读：刷新一次附件库后终局 failed，不循环请求', async (status) => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    场景.后端.读取简历预填.mockRejectedValue(new BFF错误(status, 'not_found', 'gone'));
    场景.后端.读取附件简历库.mockResolvedValue({ items: [附件(解析状态('succeeded'))], limits });
    await 场景.操作.同步候选Onboarding解析();
    expect(场景.后端.读取简历预填).toHaveBeenCalledTimes(1);
    expect(场景.后端.读取附件简历库).toHaveBeenCalledTimes(1);
    expect(预填(场景).phase).toBe('failed');
    // 权威库照常提交进全局快照
    expect(场景.后端状态引用.current.附件简历库?.items[0]?.file_id).toBe(文件ID);
  });

  it('404 后 source 已变且新 parse pending：重绑新 current source 进入 waiting_parse', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    场景.后端.读取简历预填.mockRejectedValueOnce(new BFF错误(404, 'not_found', 'gone'));
    场景.后端.读取附件简历库.mockResolvedValueOnce({
      items: [附件(解析状态('pending'), 新文件ID, 新版本ID)],
      limits,
    });
    await 场景.操作.同步候选Onboarding解析();
    expect(场景.后端.读取简历预填).toHaveBeenCalledTimes(1);
    const 状态 = 预填(场景);
    expect(状态.phase).toBe('waiting_parse');
    expect(状态.source).toEqual({ file_id: 新文件ID, version_id: 新版本ID, parse_id: null });
    expect(场景.恢复存储.取值()?.source).toEqual({ file_id: 新文件ID, version_id: 新版本ID, parse_id: null });
  });

  it('409 后 source 已变且新 parse succeeded：重绑并按新 tuple 读取', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    场景.后端.读取简历预填
      .mockRejectedValueOnce(new BFF错误(409, 'resume_parse_stale', 'stale'))
      .mockResolvedValueOnce(构造映射变体基底());
    场景.后端.读取附件简历库.mockResolvedValueOnce({
      items: [附件(解析状态('succeeded', 新解析ID), 新文件ID, 新版本ID)],
      limits,
    });
    await 场景.操作.同步候选Onboarding解析();
    expect(场景.后端.读取简历预填).toHaveBeenCalledTimes(2);
    expect(场景.后端.读取简历预填).toHaveBeenLastCalledWith({
      file_id: 新文件ID, version_id: 新版本ID, parse_id: 新解析ID,
    });
    expect(预填(场景).phase).toBe('ready');
  });

  it('刷新附件库自身失败：进入 failed，不再二次读取', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    场景.后端.读取简历预填.mockRejectedValueOnce(new BFF错误(404, 'not_found', 'gone'));
    场景.后端.读取附件简历库.mockRejectedValueOnce(new BFF错误(0, 'network_error', 'offline'));
    await 场景.操作.同步候选Onboarding解析();
    expect(预填(场景).phase).toBe('failed');
    expect(场景.后端.读取简历预填).toHaveBeenCalledTimes(1);
  });

  // review Issue 3：404/409 的一次性刷新途中 401 不能落成可重试 failed —— 当前栅栏
  // 401 与读路径同口径走统一 清账号状态；栅栏已失配的迟到 401 仍是静默丢弃。
  it('刷新附件库遇当前栅栏 401：统一 清账号状态，不落 failed', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded', 元数据: 恢复元数据() });
    场景.后端.读取简历预填.mockRejectedValueOnce(new BFF错误(404, 'not_found', 'gone'));
    场景.后端.读取附件简历库.mockRejectedValueOnce(new BFF错误(401, 'invalid_session', 'expired'));
    await 场景.操作.同步候选Onboarding解析();
    expect(场景.后端状态引用.current.已登录).toBe(false);
    expect(场景.后端状态引用.current.主体).toBeNull();
    expect(预填(场景)).toEqual(创建空候选预填状态());
    expect(场景.候选预填代际.current).toBeGreaterThan(2);
    expect(场景.候选预填读取锁.current.size).toBe(0);
    expect(场景.恢复存储.删除).toHaveBeenCalledTimes(1);
    expect(场景.后端.清空目录缓存).toHaveBeenCalled();
    expect(场景.后端.读取简历预填).toHaveBeenCalledTimes(1); // 不循环请求
  });

  it('刷新附件库的迟到 401（栅栏已失配）只丢弃：不清账号、不删元数据、不落 failed', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded', 元数据: 恢复元数据() });
    const 读门 = 可控Promise<never>();
    场景.后端.读取简历预填.mockReturnValue(读门.promise);
    const 库门 = 可控Promise<never>();
    场景.后端.读取附件简历库.mockReturnValue(库门.promise);
    const 读取 = 场景.操作.同步候选Onboarding解析();
    // 409 过当前栅栏进入一次性刷新；等刷新真正在飞后再换代 —— 401 到达时栅栏已失配，
    // 与读路径的迟到 401 同语义（绝不登出新会话）
    读门.reject(new BFF错误(409, 'resume_parse_stale', 'stale'));
    await vi.waitFor(() => expect(场景.后端.读取附件简历库).toHaveBeenCalledTimes(1));
    场景.会话代际.current += 1;
    库门.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await 读取;
    expect(场景.后端状态引用.current.已登录).toBe(true);
    expect(场景.后端.清空目录缓存).not.toHaveBeenCalled();
    expect(场景.恢复存储.删除).not.toHaveBeenCalled();
    expect(预填(场景).phase).toBe('loading');
  });
});

// ── 可重试失败与显式重试 ────────────────────────────────────────

describe('创建简历预填操作 · 可重试失败与重试', () => {
  it.each([
    ['503 downstream_unavailable', new BFF错误(503, 'downstream_unavailable', 'down')],
    ['network_error', new BFF错误(0, 'network_error', 'offline')],
  ])('%s：failed 但保留 source/eligibility/confirmed；显式重试后成功', async (_名, 错误) => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    场景.后端.读取简历预填.mockRejectedValueOnce(错误).mockResolvedValueOnce(构造映射变体基底());
    await 场景.操作.同步候选Onboarding解析();
    let 状态 = 预填(场景);
    expect(状态.phase).toBe('failed');
    expect(状态.error).toBeTruthy();
    expect(状态.source).toEqual({ file_id: 文件ID, version_id: 版本ID, parse_id: 解析ID });
    expect(状态.eligibility).toEqual(全可填Eligibility);
    await 场景.操作.重试候选Onboarding预填();
    状态 = 预填(场景);
    expect(状态.phase).toBe('ready');
    expect(状态.suggestion).toEqual(构造映射变体基底());
    expect(场景.后端.读取简历预填).toHaveBeenCalledTimes(2);
  });

  it('重试在读取在飞时并入同一单飞，不铸第二次请求', async () => {
    const 场景 = 创建预填场景({ parse: 'succeeded' });
    const 门 = 可控Promise<BFF简历预填建议>();
    场景.后端.读取简历预填.mockReturnValue(门.promise);
    const 同步中 = 场景.操作.同步候选Onboarding解析();
    const 重试中 = 场景.操作.重试候选Onboarding预填();
    expect(场景.后端.读取简历预填).toHaveBeenCalledTimes(1);
    门.resolve(构造映射变体基底());
    await Promise.all([同步中, 重试中]);
    expect(预填(场景).phase).toBe('ready');
  });

  it('无 parse_id 的轮（waiting_parse）重试零请求', async () => {
    const 场景 = 创建预填场景({ parse: 'pending' });
    await 场景.操作.重试候选Onboarding预填();
    expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
  });
});

// ── 手填与分区确认 ─────────────────────────────────────────────

describe('创建简历预填操作 · 手填与分区确认', () => {
  it('继续手填：phase manual、清建议、元数据 mode 落 manual', () => {
    const 场景 = 创建预填场景({
      parse: 'pending',
      预填: { ...绑定轮(null, 'ready', 2), suggestion: 构造映射变体基底() },
      元数据: 恢复元数据(),
    });
    场景.操作.继续手填候选Onboarding();
    const 状态 = 预填(场景);
    expect(状态.phase).toBe('manual');
    expect(状态.suggestion).toBeNull();
    expect(状态.source).toEqual({ file_id: 文件ID, version_id: 版本ID, parse_id: null });
    expect(场景.恢复存储.取值()?.mode).toBe('manual');
  });

  it('确认分区：内存与元数据同步标记该分区，其余分区不动', () => {
    const 场景 = 创建预填场景({
      parse: 'succeeded',
      预填: { ...绑定轮(解析ID, 'ready', 2), suggestion: 构造映射变体基底() },
      元数据: 恢复元数据({ source: { file_id: 文件ID, version_id: 版本ID, parse_id: 解析ID } }),
    });
    场景.操作.确认候选Onboarding预填分区('basic');
    const 状态 = 预填(场景);
    expect(状态.confirmed.basic).toBe(true);
    expect(状态.confirmed.degree).toBe(false);
    expect(场景.恢复存储.取值()?.confirmed.basic).toBe(true);
    expect(场景.恢复存储.取值()?.confirmed.work).toBe(false);
  });

  it('无本轮（inactive）时确认分区零动作', () => {
    const 场景 = 创建预填场景({ 预填: 创建空候选预填状态(2), 元数据: 恢复元数据() });
    场景.操作.确认候选Onboarding预填分区('basic');
    expect(预填(场景).confirmed.basic).toBe(false);
    expect(场景.恢复存储.写入).not.toHaveBeenCalled();
  });
});

// ── 恢复（路由恢复边界）────────────────────────────────────────

describe('创建简历预填操作 · 恢复候选Onboarding预填', () => {
  it('pristine inactive + 权威 succeeded：升级真实 parse_id 进内存与元数据后 loading 读取、ready 提交', async () => {
    const 场景 = 创建预填场景({
      parse: 'succeeded',
      预填: 创建空候选预填状态(2),
      元数据: 恢复元数据(), // 存储里的 parse_id 是 null
    });
    const 门 = 可控Promise<BFF简历预填建议>();
    场景.后端.读取简历预填.mockReturnValue(门.promise);
    const 恢复中 = 场景.操作.恢复候选Onboarding预填({ 允许等待解析: true });
    // null 存储 parse_id 绝不强制 manual：按权威 succeeded 恢复 loading 并读取
    expect(场景.后端.读取简历预填).toHaveBeenCalledWith({
      file_id: 文件ID, version_id: 版本ID, parse_id: 解析ID,
    });
    expect(预填(场景).phase).toBe('loading');
    // 读取结算前，内存与恢复元数据都已升级到真实 parse_id
    expect(预填(场景).source?.parse_id).toBe(解析ID);
    expect(场景.恢复存储.取值()?.source.parse_id).toBe(解析ID);
    门.resolve(构造映射变体基底());
    await 恢复中;
    expect(预填(场景).phase).toBe('ready');
    expect(预填(场景).suggestion).toEqual(构造映射变体基底());
  });

  it('元数据 parse_id 已与权威一致：直接恢复 loading 读取', async () => {
    const 场景 = 创建预填场景({
      parse: 'succeeded',
      预填: 创建空候选预填状态(2),
      元数据: 恢复元数据({ source: { file_id: 文件ID, version_id: 版本ID, parse_id: 解析ID } }),
    });
    场景.后端.读取简历预填.mockResolvedValue(构造映射变体基底());
    await 场景.操作.恢复候选Onboarding预填({ 允许等待解析: false });
    expect(场景.后端.读取简历预填).toHaveBeenCalledWith({
      file_id: 文件ID, version_id: 版本ID, parse_id: 解析ID,
    });
    expect(预填(场景).phase).toBe('ready');
  });

  it.each(['pending', 'processing'] as const)(
    '权威 %s + 允许等待解析:true → 恢复 waiting_parse，零次预填读取',
    async (解析) => {
      const 场景 = 创建预填场景({
        parse: 解析,
        预填: 创建空候选预填状态(2),
        元数据: 恢复元数据(),
      });
      await 场景.操作.恢复候选Onboarding预填({ 允许等待解析: true });
      const 状态 = 预填(场景);
      expect(状态.phase).toBe('waiting_parse');
      expect(状态.source).toEqual({ file_id: 文件ID, version_id: 版本ID, parse_id: null });
      expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
    },
  );

  it.each(['pending', 'processing'] as const)(
    '权威 %s + 允许等待解析:false → 立即进入并落盘 manual',
    async (解析) => {
      const 场景 = 创建预填场景({
        parse: 解析,
        预填: 创建空候选预填状态(2),
        元数据: 恢复元数据(),
      });
      await 场景.操作.恢复候选Onboarding预填({ 允许等待解析: false });
      const 状态 = 预填(场景);
      expect(状态.phase).toBe('manual');
      expect(状态.source).toEqual({ file_id: 文件ID, version_id: 版本ID, parse_id: null });
      expect(场景.恢复存储.取值()?.mode).toBe('manual');
      expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
    },
  );

  it('manual 元数据恢复为 manual，零读取', async () => {
    const 场景 = 创建预填场景({
      parse: 'succeeded',
      预填: 创建空候选预填状态(2),
      元数据: 恢复元数据({ mode: 'manual', source: { file_id: 文件ID, version_id: 版本ID, parse_id: null } }),
    });
    await 场景.操作.恢复候选Onboarding预填({ 允许等待解析: true });
    const 状态 = 预填(场景);
    expect(状态.phase).toBe('manual');
    expect(状态.suggestion).toBeNull();
    expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
  });

  it.each([
    ['file 不匹配', { file_id: 新文件ID, version_id: 版本ID }],
    ['version 不匹配', { file_id: 文件ID, version_id: 新版本ID }],
  ])('%s：删除元数据并保持 inactive', async (_名, 来源) => {
    const 场景 = 创建预填场景({
      parse: 'succeeded',
      预填: 创建空候选预填状态(2),
      元数据: 恢复元数据({ source: { ...来源, parse_id: null } }),
    });
    await 场景.操作.恢复候选Onboarding预填({ 允许等待解析: true });
    expect(场景.恢复存储.删除).toHaveBeenCalledTimes(1);
    expect(预填(场景).phase).toBe('inactive');
    expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
  });

  it('权威 parse failed：记录无法被当前附件满足 → 删除并保持 inactive', async () => {
    const 场景 = 创建预填场景({
      parse: 'failed',
      预填: 创建空候选预填状态(2),
      元数据: 恢复元数据(),
    });
    await 场景.操作.恢复候选Onboarding预填({ 允许等待解析: true });
    expect(场景.恢复存储.删除).toHaveBeenCalledTimes(1);
    expect(预填(场景).phase).toBe('inactive');
  });

  it('无元数据：保持 inactive 零读取', async () => {
    const 场景 = 创建预填场景({ 预填: 创建空候选预填状态(2), 元数据: null });
    await 场景.操作.恢复候选Onboarding预填({ 允许等待解析: true });
    expect(预填(场景).phase).toBe('inactive');
    expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
  });

  it('附件未水合（库 null）：静默返回等下次调用，不删元数据', async () => {
    const 场景 = 创建预填场景({
      附件库: null,
      预填: 创建空候选预填状态(2),
      元数据: 恢复元数据(),
    });
    await 场景.操作.恢复候选Onboarding预填({ 允许等待解析: true });
    expect(场景.恢复存储.删除).not.toHaveBeenCalled();
    expect(预填(场景).phase).toBe('inactive');
  });

  it.each(['arming', 'waiting_parse', 'loading', 'ready', 'failed', 'manual'] as const)(
    '已有 %s 内存轮：恢复零替换零读取（含元数据读取都不发生）',
    async (阶段) => {
      const 场景 = 创建预填场景({
        parse: 'succeeded',
        预填: 阶段 === 'ready'
          ? { ...绑定轮(解析ID, 'ready', 2), suggestion: 构造映射变体基底() }
          : 绑定轮(阶段 === 'waiting_parse' ? null : 解析ID, 阶段, 2),
        元数据: 恢复元数据(),
      });
      const 之前 = 预填(场景);
      await 场景.操作.恢复候选Onboarding预填({ 允许等待解析: true });
      expect(预填(场景)).toEqual(之前);
      expect(场景.恢复存储.读取).not.toHaveBeenCalled();
      expect(场景.后端.读取简历预填).not.toHaveBeenCalled();
    },
  );
});
