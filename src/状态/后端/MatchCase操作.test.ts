// P5 Task 3：MatchCase 运行时状态的行为测试 —— 列表/历史/详情的 scope 快照、
// 从第一页重建已载窗口、游标追加、单飞与读锁接管、S0–S3 命令的意图键生命周期
// （稳定键 + 409/503 不确定后的对账与同键重放）、mutation 后的强制权威重读、
// 401/会话清理与对象租约回收。受控 deferred promise 证明原子提交与迟到丢弃；
// 派发 只是 spy，全部断言读 最新状态()。快照只进内存（后端状态），绝不进持久化。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF主体 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type {
  MatchCaseSummary,
  P5列表项,
  P5列表页,
  P5详情,
  MatchCase数据源,
} from '../../数据/招聘数据源/MatchCase';
import { 解P5详情 } from '../../数据/招聘数据源/MatchCase';
import type { BFF二进制响应 } from '../../数据/HTTP客户端';
import { BFF错误 } from '../../数据/HTTP客户端';
import { BFF主体样本, P5候选详情Wire, P5招聘详情Wire } from '../../测试/BFF样本';
import type { BFFS0筛选记录 } from '../../数据/BFF契约';
import { S0候选完整记录Wire, S0招聘完整记录Wire, S0仅问题记录Wire } from '../../测试/S0筛选记录样本';
import { 初始状态 } from '../初始状态';
import type { 动作 } from '../应用状态';
import {
  P5范围键,
  创建MatchCase操作,
  创建空P5MatchCase状态,
  失效P5开案工作区,
  清P5MatchCase引用,
} from './MatchCase操作';
import { 创建空P7会话状态 } from './真人会话操作';
import { 创建空P8控制面状态 } from './P8控制面操作';
import { 创建空接触记录状态 } from './接触记录操作';
import type { 后端操作依赖, 后端状态, MatchCase操作 } from './类型';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** crypto.randomUUID 的签名返回 UUID 模板串；测试键值（非 UUID 形）走同一显式宽化。 */
const UUID键 = (值: string) => 值 as ReturnType<typeof globalThis.crypto.randomUUID>;

const 候选主体: BFF主体 = { ...BFF主体样本, last_used_role: 'candidate' };
const 招聘主体: BFF主体 = { ...BFF主体样本, last_used_role: 'recruiter' };

const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 职位ID = 'job_0123456789abcdef0123456789abcdef';

const 初始摘要: MatchCaseSummary = {
  openTotal: 51,
  openAnonymousScreeningTotal: 17,
  openNeedsActionTotal: 9,
  endedTotal: 4,
  completedTotal: 3,
};

const 更新摘要: MatchCaseSummary = {
  openTotal: 50,
  openAnonymousScreeningTotal: 16,
  openNeedsActionTotal: 8,
  endedTotal: 5,
  completedTotal: 4,
};

// ── DTO 样本：在 facade 边界直接给已 decode 的归一化 P5 DTO（decode 归 Task 1）──

function 候选状态(caseId: string): P5列表项['state'] {
  return {
    caseId, lifecycle: 'open', stage: 'anonymous_screening', status: 'running',
    step: 'policy_check', round: 0, roundBudget: 3, needsUser: false,
    outcome: null, outcomeCode: null,
    createdAt: '2026-08-29T01:00:00Z', updatedAt: '2026-08-29T02:00:00Z', finalizedAt: null,
    agentAttention: null,
  };
}

const 职位快照 = {
  jobId: 职位ID,
  job: { title: 'AI 产品实习生', location: '上海', publicSalaryRange: '300-500 元/天', requiredSkills: ['Python'] },
};

function 候选行(caseId: string): P5列表项 {
  return { role: 'candidate', state: 候选状态(caseId), needsAction: true, intentionId: 意向ID, job: 职位快照 };
}

function 招聘行(caseId: string): P5列表项 {
  return { role: 'recruiter', state: 候选状态(caseId), needsAction: false, candidateAlias: 'candidate-0123456789ab', job: 职位快照 };
}

function 候选页(items: P5列表项[], nextCursor: string | null): P5列表页 {
  return { role: 'candidate', items, nextCursor };
}

/** Task 1 wire 样本解出的权威详情：respond_fact + prompt_1 仍待答、updated_at 02:00。 */
const 权威候选详情 = 解P5详情(P5候选详情Wire, 'candidate');

/** 带自定义叮嘱回执的候选 wire 详情（回执全部落在 S0 区；owner/expression 逐条给定）。 */
function 带叮嘱Wire(回执: { owner: 'candidate' | 'recruiter'; expression: string }[]) {
  return {
    ...P5候选详情Wire,
    stages: P5候选详情Wire.stages.map((区, 下标) => 下标 === 0
      ? {
        ...区,
        instruction_receipts: 回执.map((条, 序) => ({
          instruction_id: `aci_fix_${序}`,
          owner: 条.owner,
          stage: 'anonymous_screening' as const,
          expression: 条.expression,
          occurred_at: '2026-08-29T01:05:00Z',
        })),
      }
      : 区),
  };
}
/** 对账用「问题已解」详情：动作只剩 end_screening、时间线不再有待答问题、updated_at 03:00。 */
const 已解事实详情: P5详情 = 解P5详情({
  ...P5候选详情Wire,
  available_actions: ['end_screening'],
  stages: P5候选详情Wire.stages.map((区) => ({
    ...区,
    transcript: 区.transcript.filter((项) => 项.kind !== 'supplementary_question'),
  })),
  state: { ...P5候选详情Wire.state, updated_at: '2026-08-29T03:00:00Z' },
}, 'candidate');

/** 把 S0 展开块放进唯一 S0 的候选 wire 详情；round／updated_at 可调（证明同帧整包替换）。 */
function 带S0记录Wire(块: BFFS0筛选记录, 选项: { round?: number; updated_at?: string } = {}) {
  return {
    ...P5候选详情Wire,
    state: {
      ...P5候选详情Wire.state,
      round: 选项.round ?? 1,
      updated_at: 选项.updated_at ?? P5候选详情Wire.state.updated_at,
    },
    stages: P5候选详情Wire.stages.map((区, 下标) =>
      (下标 === 0 ? { ...区, screening_records: 块 } : 区)),
  };
}

/** 招聘端展开 wire：同批 messages、恒空 summaries（候选端小结绝不下发招聘端）。 */
function 招聘带S0记录Wire(块: BFFS0筛选记录) {
  return {
    ...P5招聘详情Wire,
    state: { ...P5招聘详情Wire.state, round: 1 },
    stages: P5招聘详情Wire.stages.map((区, 下标) =>
      (下标 === 0 ? { ...区, screening_records: 块 } : 区)),
  };
}

const PDF响应: BFF二进制响应 = {
  blob: { type: 'application/pdf' } as Blob,
  contentType: 'application/pdf',
  contentDisposition: null,
  requestId: 'fixture',
};

/** 本文件内的数据源桩：桩 P5 facade 全部方法 + 清空目录缓存，默认全成功，逐测试覆盖替换。 */
function 创建P5数据源(覆盖: Record<string, unknown> = {}): HTTP招聘数据源 {
  return {
    读取P5摘要: vi.fn(async (): Promise<MatchCaseSummary> => 初始摘要),
    读取P5Open列表: vi.fn(async (): Promise<P5列表页> => 候选页([], null)),
    读取P5历史: vi.fn(async (): Promise<P5列表页> => 候选页([], null)),
    读取P5详情: vi.fn(async (): Promise<P5详情> => 权威候选详情),
    回答P5事实: vi.fn(async (): Promise<void> => undefined),
    提交P5简历: vi.fn(async (): Promise<void> => undefined),
    决定P5S0: vi.fn(async (): Promise<void> => undefined),
    决定P5S1: vi.fn(async (): Promise<void> => undefined),
    决定P5S2: vi.fn(async (): Promise<void> => undefined),
    决定P5S3: vi.fn(async (): Promise<void> => undefined),
    新增P5叮嘱: vi.fn(async (): Promise<void> => undefined),
    读取P5简历PDF: vi.fn(async (): Promise<BFF二进制响应> => PDF响应),
    清空目录缓存: vi.fn(),
    ...覆盖,
  } as unknown as HTTP招聘数据源;
}

interface P5操作测试环境 {
  数据源: MatchCase数据源 & HTTP招聘数据源;
  deps: 后端操作依赖;
  派发: ReturnType<typeof vi.fn>;
  操作: MatchCase操作;
  最新状态(): 后端状态;
}

function 创建P5操作测试环境(是后端 = true, 源 = 创建P5数据源()): P5操作测试环境 {
  const 状态引用 = { current: 初始状态 };
  const 派发 = vi.fn<(动作: 动作) => void>();
  let 后端值: 后端状态 = {
    初始化: '完成',
    已登录: true,
    主体: 候选主体,
    简历快照: null,
    意向快照: {},
    岗位快照: {},
    隐私快照: null,
    附件简历库: null,
    候选规则快照: {},
    招聘规则快照: {},
    候选规则提案: {},
    招聘规则提案: {},
    Agent规则水合: {
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    },
    // P0 修复 Task 1：招聘方档案 / 组织链两个水合阶段（这里的用例不触达它们）
    招聘方档案水合阶段: '未开始' as const,
    招聘方组织水合: { 阶段: '未开始' as const, 错误: null },
    ...创建空P4发现状态(),
    ...创建空P5MatchCase状态(),
    // P7：Task 2 起 后端状态 extends P7会话状态（这里的用例不触达它们）
    ...创建空P7会话状态(),
    // P8：Task 3 起 后端状态 extends P8控制面状态（这里的用例不触达它们）
    ...创建空P8控制面状态(),
    ...创建空接触记录状态(),
  };
  const deps: 后端操作依赖 = {
    是后端,
    后端: 是后端 ? 源 : null,
    派发,
    设后端状态: vi.fn((更新: (旧: 后端状态) => 后端状态): 后端状态 => {
      后端值 = 更新(后端值);
      return 后端值;
    }),
    后端状态引用: {
      get current() {
        return 后端值;
      },
      set current(值: 后端状态) {
        后端值 = 值;
      },
    },
    状态引用,
    锁: { current: new Set<string>() },
    尝试引用: { current: null },
    主体标识引用: { current: 'sub_1' },
    会话代际: { current: 1 },
    读取恢复企业关系编号: vi.fn(() => null),
    P4范围代际: { current: new Map<string, number>() },
    P4幂等意图: { current: new Map<string, string>() },
    P4可见范围: { current: { candidate: null, recruiter: null } },
    P5范围代际: { current: new Map<string, number>() },
    P5幂等意图: { current: new Map<string, string>() },
    P5可见范围: { current: { candidate: null, recruiter: null } },
    P5对象租约: { current: new Set() },
  };
  return {
    数据源: 源,
    deps,
    派发,
    操作: 创建MatchCase操作(deps),
    最新状态: () => 后端值,
  };
}

function 创建空P4发现状态() {
  // 仅为种子状态形状；类型来自既有 P4 底座（避免本文件 import 域实现）
  return {
    候选岗位推荐: {}, 候选岗位详情: {}, 候选岗位不可用: [],
    招聘可用候选: {}, 招聘已筛候选: {},
    招聘已筛聚合: { 阶段: '未开始' as const, jobKey: '', error: null },
    招聘候选详情: {}, 招聘候选不可用: [],
    P4委托回执: {}, P4真实Case引用: {},
  };
}

let env: P5操作测试环境;

beforeEach(() => {
  env = 创建P5操作测试环境();
  env.操作.设置P5范围('candidate', P5范围键.open('candidate', null));
  env.操作.设置P5范围('recruiter', P5范围键.open('recruiter', null));
});

function 设主体角色(主体: BFF主体): void {
  env.deps.后端状态引用.current = { ...env.deps.后端状态引用.current, 主体 };
}

describe('P5范围键 与 设置P5范围', () => {
  it('生成冻结的复合 scope 键：role + 角色专属过滤 + 架子/详情坐标', () => {
    expect(P5范围键.open('candidate', null)).toBe('p5:open:candidate:*');
    expect(P5范围键.open('candidate', 意向ID)).toBe(`p5:open:candidate:${意向ID}`);
    expect(P5范围键.open('recruiter', 职位ID)).toBe(`p5:open:recruiter:${职位ID}`);
    expect(P5范围键.history('candidate', 'ended', null)).toBe('p5:history:candidate:ended:*');
    expect(P5范围键.history('recruiter', 'completed', 职位ID)).toBe(`p5:history:recruiter:completed:${职位ID}`);
    expect(P5范围键.detail('candidate', 'mc_1')).toBe('p5:detail:candidate:mc_1');
    expect(P5范围键.summary('candidate')).toBe('p5:summary:candidate');
    expect(P5范围键.summary('recruiter')).toBe('p5:summary:recruiter');
  });

  it('含分隔符的 id 逐段转义，绝不撞键', () => {
    expect(P5范围键.open('candidate', 'a:b')).not.toBe(P5范围键.open('candidate', 'a') + ':b');
    expect(P5范围键.detail('candidate', 'a:b')).not.toBe(P5范围键.detail('candidate', 'a') + ':b');
    expect(P5范围键.open('candidate', 'a:b')).not.toBe(P5范围键.open('candidate', 'ab'));
  });

  it('设置P5范围 只更新指名角色；换键/清键递增代际；同键重复注册不递增', () => {
    expect(env.deps.P5可见范围!.current.candidate).toBe('p5:open:candidate:*');
    expect(env.deps.P5范围代际!.current.get('p5:open:candidate:*')).toBe(1);
    env.操作.设置P5范围('candidate', P5范围键.open('candidate', 意向ID));
    expect(env.deps.P5范围代际!.current.get('p5:open:candidate:*')).toBe(2);
    expect(env.deps.P5范围代际!.current.get(`p5:open:candidate:${意向ID}`)).toBe(1);
    expect(env.deps.P5可见范围!.current.recruiter).toBe('p5:open:recruiter:*');
    env.操作.设置P5范围('candidate', P5范围键.open('candidate', 意向ID)); // 同键：不是变更
    expect(env.deps.P5范围代际!.current.get(`p5:open:candidate:${意向ID}`)).toBe(1);
  });

  it('换键不清 P5 幂等意图：跨 scope 的不确定结果重试必须沿用同一键', () => {
    env.deps.P5幂等意图!.current.set('p5:意图:candidate:mc_1:respond_fact:prompt_1', 'idem_1');
    env.操作.设置P5范围('candidate', P5范围键.open('candidate', 意向ID));
    expect(env.deps.P5幂等意图!.current.has('p5:意图:candidate:mc_1:respond_fact:prompt_1')).toBe(true);
  });
});

describe('工作区列表读取', () => {
  it('首次加载：起步 进行中，成功原子提交 items/nextCursor/已加载页数', async () => {
    vi.mocked(env.数据源.读取P5Open列表).mockResolvedValue(候选页([候选行('mc_1')], 'cur_2'));
    const 门 = deferred<P5列表页>();
    vi.mocked(env.数据源.读取P5Open列表).mockReturnValueOnce(门.promise);
    const 运行 = env.操作.加载工作区('candidate', null);
    expect(env.最新状态().P5工作区['p5:open:candidate:*']).toMatchObject({
      阶段: '进行中', items: [], 刷新中: true, 已加载页数: 0, nextCursor: null,
    });
    门.resolve(候选页([候选行('mc_1')], 'cur_2'));
    await 运行;
    expect(env.数据源.读取P5Open列表).toHaveBeenCalledWith('candidate', null, null);
    expect(env.最新状态().P5工作区['p5:open:candidate:*']).toEqual({
      阶段: '成功', 刷新中: false, items: [候选行('mc_1')], nextCursor: 'cur_2',
      已加载页数: 1, error: null, generation: 1, ownerSubjectId: 'sub_1',
    });
  });

  it('角色专属过滤原样透传：candidate 过滤走 intention_id 坐标', async () => {
    vi.mocked(env.数据源.读取P5Open列表).mockResolvedValue(候选页([候选行('mc_1')], null));
    await env.操作.加载工作区('candidate', 意向ID);
    expect(env.数据源.读取P5Open列表).toHaveBeenCalledWith('candidate', 意向ID, null);
    expect(env.最新状态().P5工作区[`p5:open:candidate:${意向ID}`]).toMatchObject({
      阶段: '成功', items: [候选行('mc_1')],
    });
  });

  it('刷新保留旧成功：途中不降级、不闪退；失败也保留 items 只落重试错误', async () => {
    vi.mocked(env.数据源.读取P5Open列表).mockResolvedValueOnce(候选页([候选行('mc_1')], null));
    await env.操作.加载工作区('candidate', null);
    const 门 = deferred<P5列表页>();
    vi.mocked(env.数据源.读取P5Open列表).mockReturnValueOnce(门.promise);
    const 刷新 = env.操作.刷新工作区('candidate', null);
    expect(env.最新状态().P5工作区['p5:open:candidate:*']).toMatchObject({
      阶段: '成功', items: [候选行('mc_1')], 刷新中: true,
    });
    门.reject(new BFF错误(503, 'downstream_unavailable', 'down'));
    await 刷新;
    const 快照 = env.最新状态().P5工作区['p5:open:candidate:*'];
    expect(快照).toMatchObject({ 阶段: '成功', items: [候选行('mc_1')], 刷新中: false });
    expect(快照?.error).not.toBeNull();
  });

  it('游标追加：带 next_cursor 追加一页；游标已尽时零请求', async () => {
    vi.mocked(env.数据源.读取P5Open列表)
      .mockResolvedValueOnce(候选页([候选行('mc_1')], 'cur_2'))
      .mockResolvedValueOnce(候选页([候选行('mc_2')], null));
    await env.操作.加载工作区('candidate', null);
    await env.操作.追加工作区('candidate', null);
    expect(env.数据源.读取P5Open列表).toHaveBeenLastCalledWith('candidate', null, 'cur_2');
    expect(env.最新状态().P5工作区['p5:open:candidate:*']).toEqual({
      阶段: '成功', 刷新中: false, items: [候选行('mc_1'), 候选行('mc_2')],
      nextCursor: null, 已加载页数: 2, error: null, generation: 1, ownerSubjectId: 'sub_1',
    });
    const 调用数 = vi.mocked(env.数据源.读取P5Open列表).mock.calls.length;
    await env.操作.追加工作区('candidate', null); // 游标已尽：no-op
    expect(vi.mocked(env.数据源.读取P5Open列表).mock.calls.length).toBe(调用数);
  });

  it('刷新从第一页重建已载窗口：两页窗口重读两页、一次原子提交', async () => {
    vi.mocked(env.数据源.读取P5Open列表)
      .mockResolvedValueOnce(候选页([候选行('mc_1')], 'cur_2'))
      .mockResolvedValueOnce(候选页([候选行('mc_2')], null))
      .mockResolvedValueOnce(候选页([候选行('mc_9')], 'cur_2b'))
      .mockResolvedValueOnce(候选页([候选行('mc_8')], null));
    await env.操作.加载工作区('candidate', null);
    await env.操作.追加工作区('candidate', null);
    const 设状态数 = (env.deps.设后端状态 as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    await env.操作.刷新工作区('candidate', null);
    expect(vi.mocked(env.数据源.读取P5Open列表).mock.calls.slice(2).map((调用) => 调用[2]))
      .toEqual([null, 'cur_2b']); // 从第一页起，按窗口深度跟进刷新读到的新游标
    expect(env.最新状态().P5工作区['p5:open:candidate:*']).toEqual({
      阶段: '成功', 刷新中: false, items: [候选行('mc_9'), 候选行('mc_8')],
      nextCursor: null, 已加载页数: 2, error: null, generation: 1, ownerSubjectId: 'sub_1',
    });
    const 新设状态数 = (env.deps.设后端状态 as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    expect(新设状态数 - 设状态数).toBe(2); // 起步 + 唯一一次原子提交
  });

  it('重复保护：并发同 scope 单飞一次；成功后非 force 不重发，force 才重读', async () => {
    const 门 = deferred<P5列表页>();
    vi.mocked(env.数据源.读取P5Open列表).mockReturnValue(门.promise);
    const 第一次 = env.操作.加载工作区('candidate', null);
    const 第二次 = env.操作.加载工作区('candidate', null);
    门.resolve(候选页([候选行('mc_1')], null));
    await Promise.all([第一次, 第二次]);
    expect(vi.mocked(env.数据源.读取P5Open列表)).toHaveBeenCalledTimes(1);
    await env.操作.加载工作区('candidate', null); // 非 force：命中成功快照
    expect(vi.mocked(env.数据源.读取P5Open列表)).toHaveBeenCalledTimes(1);
    await env.操作.加载工作区('candidate', null, true);
    expect(vi.mocked(env.数据源.读取P5Open列表)).toHaveBeenCalledTimes(2);
  });

  it('同角色换主体不复用旧成功快照，旧响应不能覆盖新主体', async () => {
    vi.mocked(env.数据源.读取P5Open列表)
      .mockResolvedValueOnce(候选页([候选行('mc_old')], null))
      .mockResolvedValueOnce(候选页([候选行('mc_new')], null));
    await env.操作.加载工作区('candidate', null);
    expect(env.最新状态().P5工作区['p5:open:candidate:*'])
      .toMatchObject({ ownerSubjectId: 'sub_1', items: [候选行('mc_old')] });

    env.deps.主体标识引用.current = 'sub_2';
    env.deps.会话代际.current += 1;
    env.deps.后端状态引用.current = {
      ...env.deps.后端状态引用.current,
      主体: { ...候选主体, subject_id: 'sub_2' },
    };
    await env.操作.加载工作区('candidate', null);

    expect(env.数据源.读取P5Open列表).toHaveBeenCalledTimes(2);
    expect(env.最新状态().P5工作区['p5:open:candidate:*'])
      .toMatchObject({ 阶段: '成功', ownerSubjectId: 'sub_2', items: [候选行('mc_new')] });
  });

  it('首载失败落 失败 + 错误文案，不派发也不清账号', async () => {
    vi.mocked(env.数据源.读取P5Open列表)
      .mockRejectedValueOnce(new BFF错误(503, 'downstream_unavailable', 'down'));
    await env.操作.加载工作区('candidate', null);
    const 快照 = env.最新状态().P5工作区['p5:open:candidate:*'];
    expect(快照).toMatchObject({ 阶段: '失败', items: [], 刷新中: false });
    expect(快照?.error).not.toBeNull();
    expect(env.派发).not.toHaveBeenCalled();
    expect(env.deps.主体标识引用.current).toBe('sub_1');
    expect(env.最新状态().已登录).toBe(true);
  });
});

describe('历史架子', () => {
  it('ended 与 completed 是两个独立 scope：各走各的 lifecycle，快照互不覆盖', async () => {
    vi.mocked(env.数据源.读取P5历史).mockImplementation(async (_role, lifecycle) =>
      候选页([{ ...候选行(`mc_${lifecycle}`) }], null));
    await env.操作.加载历史('candidate', 'ended', null);
    await env.操作.加载历史('candidate', 'completed', null);
    expect(env.数据源.读取P5历史).toHaveBeenCalledWith('candidate', 'ended', null, null);
    expect(env.数据源.读取P5历史).toHaveBeenCalledWith('candidate', 'completed', null, null);
    const 历史 = env.最新状态().P5历史;
    expect(历史['p5:history:candidate:ended:*']?.items.map((行) => 行.state.caseId)).toEqual(['mc_ended']);
    expect(历史['p5:history:candidate:completed:*']?.items.map((行) => 行.state.caseId)).toEqual(['mc_completed']);
    // ended 架子刷新绝不碰 completed 快照
    vi.mocked(env.数据源.读取P5历史).mockResolvedValueOnce(候选页([], null));
    await env.操作.刷新历史('candidate', 'ended', null);
    expect(历史['p5:history:candidate:completed:*']?.items).toHaveLength(1);
  });

  it('历史同样支持游标追加与从第一页重建窗口', async () => {
    vi.mocked(env.数据源.读取P5历史)
      .mockResolvedValueOnce(候选页([候选行('mc_e1')], 'cur_h2'))
      .mockResolvedValueOnce(候选页([候选行('mc_e2')], null))
      .mockResolvedValueOnce(候选页([候选行('mc_e9')], null));
    await env.操作.加载历史('candidate', 'ended', null);
    await env.操作.追加历史('candidate', 'ended', null);
    await env.操作.刷新历史('candidate', 'ended', null);
    const 快照 = env.最新状态().P5历史['p5:history:candidate:ended:*'];
    expect(快照?.items.map((行) => 行.state.caseId)).toEqual(['mc_e9']);
    expect(快照?.已加载页数).toBe(1); // 重建后服务端只剩一页：窗口按实际页数收敛
  });
});

describe('详情读取', () => {
  it('直读详情不依赖任何列表记忆：仅 URL case_id + 已认证角色', async () => {
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(权威候选详情);
    await env.操作.读取详情('candidate', 'mc_1');
    expect(env.数据源.读取P5详情).toHaveBeenCalledWith('candidate', 'mc_1');
    expect(env.数据源.读取P5Open列表).not.toHaveBeenCalled();
    expect(env.最新状态().P5详情['p5:detail:candidate:mc_1']).toEqual({
      阶段: '成功', 刷新中: false, detail: 权威候选详情, error: null, generation: 0,
    });
  });

  it('非 force 命中成功快照不重发；force 恒权威重读', async () => {
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(权威候选详情);
    await env.操作.读取详情('candidate', 'mc_1');
    await env.操作.读取详情('candidate', 'mc_1');
    expect(vi.mocked(env.数据源.读取P5详情)).toHaveBeenCalledTimes(1);
    await env.操作.读取详情('candidate', 'mc_1', true);
    expect(vi.mocked(env.数据源.读取P5详情)).toHaveBeenCalledTimes(2);
  });

  it('详情失败落 失败快照（契约错误走重试错误态），旧成功 detail 保留不闪退', async () => {
    vi.mocked(env.数据源.读取P5详情).mockResolvedValueOnce(权威候选详情);
    await env.操作.读取详情('candidate', 'mc_1');
    vi.mocked(env.数据源.读取P5详情)
      .mockRejectedValueOnce(new BFF错误(200, 'invalid_response', '契约漂移'));
    await env.操作.读取详情('candidate', 'mc_1', true);
    const 快照 = env.最新状态().P5详情['p5:detail:candidate:mc_1'];
    expect(快照).toMatchObject({ 阶段: '成功', detail: 权威候选详情, 刷新中: false });
    expect(快照?.error).not.toBeNull();
  });

  it('首读失败落 失败 + 错误，不抛', async () => {
    vi.mocked(env.数据源.读取P5详情)
      .mockRejectedValueOnce(new BFF错误(200, 'invalid_response', '契约漂移'));
    await expect(env.操作.读取详情('recruiter', 'mc_x')).resolves.toBeUndefined();
    expect(env.最新状态().P5详情['p5:detail:recruiter:mc_x']).toMatchObject({
      阶段: '失败', detail: null,
    });
    expect(env.最新状态().P5详情['p5:detail:recruiter:mc_x']?.error).not.toBeNull();
  });

  // ── S0 筛选记录的权威快照运输：整包替换、只读保留与隐私栅栏 ──

  it('同 updatedAt／round 的两次 force read：detail 引用与 messages 整包替换为后者', async () => {
    const 仅问题 = 解P5详情(带S0记录Wire(S0仅问题记录Wire), 'candidate');
    const 有回答 = 解P5详情(带S0记录Wire(S0候选完整记录Wire), 'candidate');
    expect(仅问题.state.updatedAt).toBe(有回答.state.updatedAt);
    expect(仅问题.state.round).toBe(有回答.state.round);
    vi.mocked(env.数据源.读取P5详情)
      .mockResolvedValueOnce(仅问题)
      .mockResolvedValueOnce(有回答);
    await env.操作.读取详情('candidate', 'mc_1', true);
    await env.操作.读取详情('candidate', 'mc_1', true);
    const 快照 = env.最新状态().P5详情['p5:detail:candidate:mc_1'];
    expect(快照?.detail).toBe(有回答); // 成功详情 恒以新引用整包替换，绝不原地拼接
    expect(快照?.detail).not.toBe(仅问题);
    expect(快照?.detail?.stages[0].screeningRecords?.messages)
      .toEqual(有回答.stages[0].screeningRecords?.messages);
    expect(快照?.detail?.stages[0].screeningRecords?.messages).toHaveLength(2);
  });

  it('mutation 后的权威重读整包替换 records；迟到的旧轮询读不能把旧 records 写回', async () => {
    const 仅问题 = 解P5详情(带S0记录Wire(S0仅问题记录Wire), 'candidate');
    const 有回答 = 解P5详情(带S0记录Wire(S0候选完整记录Wire, { updated_at: '2026-08-29T03:00:00Z' }), 'candidate');
    const 旧读门 = deferred<P5详情>();
    vi.mocked(env.数据源.读取P5详情)
      .mockReturnValueOnce(旧读门.promise) // 轮询读 A：在飞，服务端尚未应用 mutation
      .mockResolvedValueOnce(有回答); // mutation 成功后的权威重读
    vi.mocked(env.数据源.回答P5事实).mockResolvedValue(undefined);
    void env.操作.读取详情('candidate', 'mc_1');
    await env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天');
    expect(env.最新状态().P5详情['p5:detail:candidate:mc_1']?.detail).toBe(有回答);
    旧读门.resolve(仅问题); // A 迟到返回旧 records：整包丢弃
    await new Promise((完成) => setTimeout(完成, 0));
    expect(env.最新状态().P5详情['p5:detail:candidate:mc_1']?.detail).toBe(有回答);
  });

  it('同 scope 的网络／500／503 刷新失败只读保留旧 records，落重试错误', async () => {
    const 有回答 = 解P5详情(带S0记录Wire(S0候选完整记录Wire), 'candidate');
    vi.mocked(env.数据源.读取P5详情).mockResolvedValueOnce(有回答);
    await env.操作.读取详情('candidate', 'mc_1');
    for (const 错误 of [
      new BFF错误(0, 'network_error', '网络中断'),
      new BFF错误(500, 'server_error', '服务错误'),
      new BFF错误(503, 'downstream_unavailable', '下游不可用'),
    ]) {
      vi.mocked(env.数据源.读取P5详情).mockRejectedValueOnce(错误);
      await env.操作.读取详情('candidate', 'mc_1', true);
      const 快照 = env.最新状态().P5详情['p5:detail:candidate:mc_1'];
      expect(快照?.detail).toBe(有回答); // 旧只读 records 保留，不闪退
      expect(快照?.detail?.stages[0].screeningRecords?.messages).toHaveLength(2);
      expect(快照?.error).not.toBeNull();
    }
  });

  it('详情 404 是隐私清理例外：detail 清空为 null 且可重试，旧 records 不再展示', async () => {
    const 有回答 = 解P5详情(带S0记录Wire(S0候选完整记录Wire), 'candidate');
    vi.mocked(env.数据源.读取P5详情).mockResolvedValueOnce(有回答);
    await env.操作.读取详情('candidate', 'mc_1');
    vi.mocked(env.数据源.读取P5详情)
      .mockRejectedValueOnce(new BFF错误(404, 'case_not_found', 'Case 不可见'));
    await env.操作.读取详情('candidate', 'mc_1', true);
    const 快照 = env.最新状态().P5详情['p5:detail:candidate:mc_1'];
    expect(快照).toMatchObject({ 阶段: '失败', detail: null, 刷新中: false });
    expect(快照?.error).not.toBeNull();
    // 失败快照不再命中成功短路：下一次读取真实 GET 并恢复
    const 仅问题 = 解P5详情(带S0记录Wire(S0仅问题记录Wire), 'candidate');
    vi.mocked(env.数据源.读取P5详情).mockResolvedValueOnce(仅问题);
    await env.操作.读取详情('candidate', 'mc_1');
    expect(env.最新状态().P5详情['p5:detail:candidate:mc_1']?.detail).toBe(仅问题);
  });

  it('mutation 成功后的权威重读 404：清掉旧 detail，mutation 仍 resolve', async () => {
    const 有回答 = 解P5详情(带S0记录Wire(S0候选完整记录Wire), 'candidate');
    vi.mocked(env.数据源.读取P5详情).mockResolvedValueOnce(有回答);
    await env.操作.读取详情('candidate', 'mc_1');
    vi.mocked(env.数据源.回答P5事实).mockResolvedValue(undefined);
    vi.mocked(env.数据源.读取P5详情)
      .mockRejectedValue(new BFF错误(404, 'case_not_found', 'Case 不可见'));
    await expect(env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天')).resolves.toBeUndefined();
    const 快照 = env.最新状态().P5详情['p5:detail:candidate:mc_1'];
    expect(快照).toMatchObject({ 阶段: '失败', detail: null, 刷新中: false });
    expect(快照?.error).not.toBeNull();
    expect(env.数据源.回答P5事实).toHaveBeenCalledTimes(1); // POST 已成功，不因重读失败重发
  });

  it('401 清理后旧 records 绝不残留（换主体／换会话都看不到）', async () => {
    const 有回答 = 解P5详情(带S0记录Wire(S0候选完整记录Wire), 'candidate');
    vi.mocked(env.数据源.读取P5详情)
      .mockResolvedValueOnce(有回答)
      .mockRejectedValueOnce(new BFF错误(401, 'invalid_session', 'expired'));
    await env.操作.读取详情('candidate', 'mc_1');
    expect(env.最新状态().P5详情['p5:detail:candidate:mc_1']?.detail?.stages[0].screeningRecords?.messages)
      .toHaveLength(2);
    await env.操作.读取详情('candidate', 'mc_1', true); // 401：统一清理
    expect(env.最新状态().已登录).toBe(false);
    expect(env.最新状态().P5详情).toEqual({});
  });

  it('records 不跨 role 存在：recruiter 详情 scope 只见自己的展开块（恒无小结）', async () => {
    const 候选有回答 = 解P5详情(带S0记录Wire(S0候选完整记录Wire), 'candidate');
    vi.mocked(env.数据源.读取P5详情).mockResolvedValueOnce(候选有回答);
    await env.操作.读取详情('candidate', 'mc_1');
    设主体角色(招聘主体);
    const 招聘同批 = 解P5详情(招聘带S0记录Wire(S0招聘完整记录Wire), 'recruiter');
    vi.mocked(env.数据源.读取P5详情).mockResolvedValueOnce(招聘同批);
    await env.操作.读取详情('recruiter', 'mc_1');
    const 详情表 = env.最新状态().P5详情;
    expect(详情表['p5:detail:candidate:mc_1']?.detail?.stages[0].screeningRecords?.summaries).toHaveLength(2);
    const 招聘记录 = 详情表['p5:detail:recruiter:mc_1']?.detail?.stages[0].screeningRecords;
    expect(招聘记录?.messages).toHaveLength(2);
    expect(招聘记录?.summaries).toEqual([]);
  });
});

describe('P5 summary 读取与刷新', () => {
  beforeEach(() => {
    env.操作.设置P5范围('candidate', P5范围键.summary('candidate'));
  });

  it('首载成功写当前 owner；刷新立即清旧值，失败保持 null，重试恢复', async () => {
    await env.操作.加载摘要('candidate');
    expect(env.最新状态().P5摘要.candidate).toMatchObject({
      ownerSubjectId: 'sub_1', 阶段: '成功', 刷新中: false, summary: 初始摘要, error: null,
    });

    const 刷新 = deferred<MatchCaseSummary>();
    vi.mocked(env.数据源.读取P5摘要).mockReturnValueOnce(刷新.promise);
    const 在飞 = env.操作.加载摘要('candidate');
    expect(env.最新状态().P5摘要.candidate).toMatchObject({
      ownerSubjectId: 'sub_1', 阶段: '进行中', 刷新中: true, summary: null, error: null,
    });
    刷新.reject(new BFF错误(500, 'server_error', '失败'));
    await 在飞;
    expect(env.最新状态().P5摘要.candidate).toMatchObject({
      阶段: '失败', 刷新中: false, summary: null,
    });

    vi.mocked(env.数据源.读取P5摘要).mockResolvedValueOnce(更新摘要);
    await env.操作.加载摘要('candidate');
    expect(env.最新状态().P5摘要.candidate?.summary).toEqual(更新摘要);
  });

  it('同 role/owner 单飞，candidate 与 recruiter 使用独立槽', async () => {
    const 读取 = deferred<MatchCaseSummary>();
    vi.mocked(env.数据源.读取P5摘要).mockReturnValueOnce(读取.promise);
    const 甲 = env.操作.加载摘要('candidate');
    const 乙 = env.操作.加载摘要('candidate');
    expect(env.数据源.读取P5摘要).toHaveBeenCalledTimes(1);
    读取.resolve(初始摘要);
    await Promise.all([甲, 乙]);

    设主体角色(招聘主体);
    env.操作.设置P5范围('recruiter', P5范围键.summary('recruiter'));
    vi.mocked(env.数据源.读取P5摘要).mockResolvedValueOnce(更新摘要);
    await env.操作.加载摘要('recruiter');
    expect(env.最新状态().P5摘要.candidate?.summary).toEqual(初始摘要);
    expect(env.最新状态().P5摘要.recruiter?.summary).toEqual(更新摘要);
  });

  it('同角色换主体后迟到 success 不污染新主体', async () => {
    const 旧读 = deferred<MatchCaseSummary>();
    vi.mocked(env.数据源.读取P5摘要).mockReturnValueOnce(旧读.promise);
    const 在飞 = env.操作.加载摘要('candidate');
    env.deps.主体标识引用.current = 'sub_2';
    env.deps.会话代际.current += 1;
    env.deps.后端状态引用.current = {
      ...env.deps.后端状态引用.current,
      主体: { ...候选主体, subject_id: 'sub_2' },
    };
    env.操作.设置P5范围('candidate', null);
    env.操作.设置P5范围('candidate', P5范围键.summary('candidate'));
    旧读.resolve(初始摘要);
    await 在飞;
    expect(env.最新状态().P5摘要.candidate?.summary).not.toEqual(初始摘要);
  });

  it('当前 401 清空账号和 P5 summary；迟到 401 不清新会话', async () => {
    vi.mocked(env.数据源.读取P5摘要)
      .mockRejectedValueOnce(new BFF错误(401, 'unauthorized', '当前会话'));
    await env.操作.加载摘要('candidate');
    expect(env.最新状态().已登录).toBe(false);
    expect(env.最新状态().P5摘要).toEqual({});

    env = 创建P5操作测试环境();
    env.操作.设置P5范围('candidate', P5范围键.summary('candidate'));
    const 旧401 = deferred<MatchCaseSummary>();
    vi.mocked(env.数据源.读取P5摘要).mockReturnValueOnce(旧401.promise);
    const 在飞 = env.操作.加载摘要('candidate');
    env.deps.会话代际.current += 1;
    旧401.reject(new BFF错误(401, 'unauthorized', '旧会话'));
    await 在飞;
    expect(env.最新状态().已登录).toBe(true);
  });

  it('mutation 只刷新已载同角色 summary，刷新失败不改变 mutation 成功', async () => {
    await env.操作.加载摘要('candidate');
    env.操作.设置P5范围('candidate', P5范围键.open('candidate', null));
    vi.mocked(env.数据源.读取P5Open列表).mockResolvedValue(候选页([候选行('mc_1')], null));
    await env.操作.加载工作区('candidate', null);
    env.操作.设置P5范围('candidate', P5范围键.detail('candidate', 'mc_1'));
    vi.mocked(env.数据源.读取P5详情).mockResolvedValueOnce(权威候选详情);
    await env.操作.读取详情('candidate', 'mc_1');
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(已解事实详情);
    vi.mocked(env.数据源.读取P5摘要)
      .mockRejectedValueOnce(new BFF错误(500, 'server_error', 'summary refresh failed'));
    await expect(env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '回答')).resolves.toBeUndefined();
    expect(env.数据源.回答P5事实).toHaveBeenCalledTimes(1);
    expect(env.数据源.读取P5摘要).toHaveBeenCalledTimes(2);
    expect(env.最新状态().P5摘要.candidate?.summary).toBeNull();
    expect(env.最新状态().P5工作区[P5范围键.open('candidate', null)]?.阶段).toBe('成功');
    expect(env.最新状态().P5详情[P5范围键.detail('candidate', 'mc_1')]?.detail)
      .toEqual(已解事实详情);

    const 未载 = 创建P5操作测试环境();
    未载.操作.设置P5范围('candidate', P5范围键.detail('candidate', 'mc_1'));
    vi.mocked(未载.数据源.读取P5详情).mockResolvedValue(已解事实详情);
    await 未载.操作.回答事实('candidate', 'mc_1', 'prompt_1', '回答');
    expect(未载.数据源.读取P5摘要).not.toHaveBeenCalled();
  });

  it('并发 mutation：后确认的刷新作废在飞旧 summary 读，不提交陈旧计数', async () => {
    await env.操作.加载摘要('candidate');
    env.操作.设置P5范围('candidate', P5范围键.detail('candidate', 'mc_1'));
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(已解事实详情);
    vi.mocked(env.数据源.回答P5事实).mockResolvedValue(undefined);
    // 甲的 summary GET（第 2 次）挂起：出发早于乙的 POST 生效，回包将是陈旧计数
    const 旧读 = deferred<MatchCaseSummary>();
    let 摘要读数 = 1;
    vi.mocked(env.数据源.读取P5摘要).mockImplementation(async () => {
      摘要读数 += 1;
      return 摘要读数 === 2 ? 旧读.promise : 更新摘要;
    });
    const 甲 = env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '回答');
    await vi.waitFor(() => expect(env.数据源.读取P5摘要).toHaveBeenCalledTimes(2));
    // 乙（不同 prompt）随后确认成功：其刷新必须作废甲的在飞读并重发，不得被单飞让路
    const 乙 = env.操作.回答事实('candidate', 'mc_1', 'prompt_2', '回答');
    await vi.waitFor(() => expect(env.数据源.读取P5摘要).toHaveBeenCalledTimes(3));
    旧读.resolve(初始摘要); // 甲的陈旧回包迟到：整包丢弃
    await Promise.all([甲, 乙]);
    expect(env.最新状态().P5摘要.candidate?.summary).toEqual(更新摘要);
  });

  it('Mock 模式加载 summary 零请求', async () => {
    const mockEnv = 创建P5操作测试环境(false);
    mockEnv.操作.设置P5范围('candidate', P5范围键.summary('candidate'));
    await mockEnv.操作.加载摘要('candidate');
    expect(mockEnv.数据源.读取P5摘要).not.toHaveBeenCalled();
  });
});

describe('scope 隔离与迟到完成', () => {
  it('role/filter scope 隔离：三个键互不覆盖，招聘行走招聘路径', async () => {
    vi.mocked(env.数据源.读取P5Open列表).mockImplementation(async (role) =>
      role === 'candidate' ? 候选页([候选行('mc_c')], null) : { role: 'recruiter', items: [招聘行('mc_r')], nextCursor: null });
    await env.操作.加载工作区('candidate', null);
    await env.操作.加载工作区('candidate', 意向ID);
    设主体角色(招聘主体);
    env.操作.设置P5范围('recruiter', P5范围键.open('recruiter', 职位ID));
    await env.操作.加载工作区('recruiter', 职位ID);
    const 工作区 = env.最新状态().P5工作区;
    expect(工作区['p5:open:candidate:*']?.items.map((行) => 行.state.caseId)).toEqual(['mc_c']);
    expect(工作区[`p5:open:candidate:${意向ID}`]?.items.map((行) => 行.state.caseId)).toEqual(['mc_c']);
    expect(工作区[`p5:open:recruiter:${职位ID}`]?.items.map((行) => 行.state.caseId)).toEqual(['mc_r']);
    // candidate_alias 只是展示文本：快照键与坐标全部以 case_id / role+过滤 为准
    expect(工作区[`p5:open:recruiter:${职位ID}`]?.items[0]).toHaveProperty('candidateAlias', 'candidate-0123456789ab');
  });

  it('scope 变化后的迟到完成只释放锁不写状态', async () => {
    const 门 = deferred<P5列表页>();
    vi.mocked(env.数据源.读取P5Open列表).mockReturnValue(门.promise);
    const 运行 = env.操作.加载工作区('candidate', null);
    env.操作.设置P5范围('candidate', P5范围键.open('candidate', 意向ID));
    门.resolve(候选页([候选行('mc_迟到')], null));
    await 运行;
    expect(env.最新状态().P5工作区['p5:open:candidate:*']).toMatchObject({
      阶段: '进行中', items: [],
    });
    expect(env.派发).not.toHaveBeenCalled();
    // 锁已释放：force 可再次加载
    vi.mocked(env.数据源.读取P5Open列表).mockResolvedValue(候选页([候选行('mc_1')], null));
    await env.操作.加载工作区('candidate', null, true);
    expect(env.最新状态().P5工作区['p5:open:candidate:*']).toMatchObject({ 阶段: '成功' });
  });

  it('登出/换会话代际后的迟到完成整包丢弃（不写、不清新会话）', async () => {
    const 门 = deferred<P5列表页>();
    vi.mocked(env.数据源.读取P5Open列表).mockReturnValue(门.promise);
    const 运行 = env.操作.加载工作区('candidate', null);
    env.deps.主体标识引用.current = null;
    env.deps.会话代际.current += 1;
    门.resolve(候选页([候选行('mc_迟到')], null));
    await 运行;
    expect(env.最新状态().P5工作区['p5:open:candidate:*']?.items ?? []).toEqual([]);
    expect(env.派发).not.toHaveBeenCalledWith({ 型: '清后端组织状态' });
  });

  it('角色切换后的迟到完成整包丢弃', async () => {
    const 门 = deferred<P5列表页>();
    vi.mocked(env.数据源.读取P5Open列表).mockReturnValue(门.promise);
    const 运行 = env.操作.加载工作区('candidate', null);
    设主体角色(招聘主体);
    门.resolve(候选页([候选行('mc_迟到')], null));
    await 运行;
    expect(env.最新状态().P5工作区['p5:open:candidate:*']?.items ?? []).toEqual([]);
  });

  it('读锁过期接管（StrictMode 卸载重挂）：新读取接管重发，旧迟到响应不写状态', async () => {
    const 旧门 = deferred<P5列表页>();
    const 新门 = deferred<P5列表页>();
    vi.mocked(env.数据源.读取P5Open列表)
      .mockReturnValueOnce(旧门.promise)
      .mockReturnValueOnce(新门.promise);
    const 旧读 = env.操作.加载工作区('candidate', null);
    // StrictMode cleanup 清范围 → remount 重注册：scope 代际两连跳
    env.操作.设置P5范围('candidate', null);
    env.操作.设置P5范围('candidate', P5范围键.open('candidate', null));
    const 新读 = env.操作.加载工作区('candidate', null);
    expect(vi.mocked(env.数据源.读取P5Open列表)).toHaveBeenCalledTimes(2);
    新门.resolve(候选页([候选行('mc_新')], null));
    await 新读;
    expect(env.最新状态().P5工作区['p5:open:candidate:*']).toMatchObject({
      阶段: '成功', items: [候选行('mc_新')],
    });
    旧门.resolve(候选页([候选行('mc_旧属主')], null));
    await 旧读;
    expect(env.最新状态().P5工作区['p5:open:candidate:*']?.items).toEqual([候选行('mc_新')]);
  });

  it('读取 401 走统一清账号状态并清 P5 快照与全部运行时引用', async () => {
    env.deps.P5幂等意图!.current.set('p5:意图:candidate:mc_1:respond_fact:prompt_1', 'idem_1');
    env.deps.P5范围代际!.current.set('p5:detail:candidate:mc_9', 4);
    vi.mocked(env.数据源.读取P5详情)
      .mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await env.操作.读取详情('candidate', 'mc_1');
    const 最新 = env.最新状态();
    expect(最新.已登录).toBe(false);
    expect(最新.主体).toBeNull();
    expect(最新.P5工作区).toEqual({});
    expect(最新.P5历史).toEqual({});
    expect(最新.P5详情).toEqual({});
    expect(env.deps.P5幂等意图!.current.size).toBe(0);
    expect(env.deps.P5范围代际!.current.size).toBe(0);
    expect(env.deps.P5可见范围!.current).toEqual({ candidate: null, recruiter: null });
    expect(env.deps.主体标识引用.current).toBeNull();
    expect(env.deps.会话代际.current).toBe(2);
    expect(env.派发).toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(env.数据源.清空目录缓存).toHaveBeenCalled();
  });

  it('迟到 401 不清新会话', async () => {
    const 门 = deferred<P5详情>();
    vi.mocked(env.数据源.读取P5详情).mockReturnValue(门.promise);
    const 运行 = env.操作.读取详情('candidate', 'mc_1');
    env.deps.主体标识引用.current = 'sub_new';
    env.deps.会话代际.current += 1;
    门.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await 运行;
    expect(env.deps.主体标识引用.current).toBe('sub_new');
    expect(env.最新状态().已登录).toBe(true);
    expect(env.数据源.清空目录缓存).not.toHaveBeenCalled();
  });

  it('mutation 后的权威重读作废同 scope 在飞的旧轮询读（迟到旧读不得回写新状态）', async () => {
    const 旧门 = deferred<P5详情>();
    vi.mocked(env.数据源.读取P5详情)
      .mockReturnValueOnce(旧门.promise)
      .mockResolvedValue(已解事实详情);
    vi.mocked(env.数据源.回答P5事实).mockResolvedValue(undefined);
    // 轮询读 A 先出发（在飞，服务端尚未应用 mutation）
    void env.操作.读取详情('candidate', 'mc_1');
    // mutation 成功 → 权威重读 B 拿到新态并落库
    await env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天');
    expect(env.最新状态().P5详情['p5:detail:candidate:mc_1']?.detail).toEqual(已解事实详情);
    // A 迟到返回旧态：必须被作废，不得把新状态覆盖回旧状态
    旧门.resolve(权威候选详情);
    await new Promise((完成) => setTimeout(完成, 0));
    expect(env.最新状态().P5详情['p5:detail:candidate:mc_1']?.detail).toEqual(已解事实详情);
  });
});

describe('Mock 模式：零 P5 请求', () => {
  it('非 Backend 下全部操作 no-op / 惰性返回，不发任何 P5 请求', async () => {
    const mock环境 = 创建P5操作测试环境(false, 创建P5数据源());
    await expect(mock环境.操作.加载工作区('candidate', null)).resolves.toBeUndefined();
    await expect(mock环境.操作.追加工作区('candidate', null)).resolves.toBeUndefined();
    await expect(mock环境.操作.刷新工作区('candidate', null)).resolves.toBeUndefined();
    await expect(mock环境.操作.加载历史('candidate', 'ended', null)).resolves.toBeUndefined();
    await expect(mock环境.操作.读取详情('candidate', 'mc_1', true)).resolves.toBeUndefined();
    await expect(mock环境.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天')).resolves.toBeUndefined();
    await expect(mock环境.操作.读取简历PDF('candidate', 'mc_1')).rejects.toMatchObject({ code: 'backend_unavailable' });
  });
});

describe('S0–S3 命令与幂等意图', () => {
  async function 种已载范围(): Promise<void> {
    vi.mocked(env.数据源.读取P5Open列表).mockResolvedValue(候选页([候选行('mc_1')], null));
    vi.mocked(env.数据源.读取P5历史).mockResolvedValue(候选页([候选行('mc_1')], null));
    await env.操作.加载工作区('candidate', null);
    await env.操作.加载历史('candidate', 'ended', null);
  }

  it('成功后强制权威重读：mutation 一律 void，详情/工作区/历史全部重读，响应绝不替换详情', async () => {
    await 种已载范围();
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(已解事实详情);
    const 打开数 = vi.mocked(env.数据源.读取P5Open列表).mock.calls.length;
    const 历史数 = vi.mocked(env.数据源.读取P5历史).mock.calls.length;
    await env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '每周三天');
    expect(env.数据源.回答P5事实).toHaveBeenCalledWith('candidate', 'mc_1', 'prompt_1', '每周三天', expect.any(String));
    // 详情权威重读：快照来自 GET，且是重读回来的新状态（updated_at 03:00）
    expect(env.数据源.读取P5详情).toHaveBeenCalledWith('candidate', 'mc_1');
    expect(env.最新状态().P5详情['p5:detail:candidate:mc_1']?.detail?.state.updatedAt).toBe('2026-08-29T03:00:00Z');
    // 列表与历史 scope 同步从第一页刷新
    expect(vi.mocked(env.数据源.读取P5Open列表).mock.calls.length).toBe(打开数 + 1);
    expect(vi.mocked(env.数据源.读取P5历史).mock.calls.length).toBe(历史数 + 1);
  });

  it('每个 role+case+action+target 一把稳定键：普通网络错误保留键，重试沿用同一键成功才释放', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('fact-key-0001'))
      .mockReturnValue(UUID键('fact-key-0002'));
    vi.mocked(env.数据源.回答P5事实)
      .mockRejectedValueOnce(new Error('网络中断'))
      .mockResolvedValueOnce(undefined);
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(已解事实详情);
    await expect(env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天'))
      .rejects.toThrow('网络中断');
    expect(env.deps.P5幂等意图!.current.has('p5:意图:candidate:mc_1:respond_fact:prompt_1')).toBe(true);
    await env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天');
    expect(vi.mocked(env.数据源.回答P5事实).mock.calls.map((调用) => 调用[4]))
      .toEqual(['fact-key-0001', 'fact-key-0001']);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(env.deps.P5幂等意图!.current.has('p5:意图:candidate:mc_1:respond_fact:prompt_1')).toBe(false);
    randomUUID.mockRestore();
  });

  it('不同目标各自成键：不同 prompt / 不同 Case / 不同动作互不影响', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('k-a'))
      .mockReturnValueOnce(UUID键('k-b'))
      .mockReturnValueOnce(UUID键('k-c'))
      .mockReturnValue(UUID键('k-d'));
    vi.mocked(env.数据源.回答P5事实).mockRejectedValue(new Error('网络中断'));
    await expect(env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '甲')).rejects.toThrow();
    await expect(env.操作.回答事实('candidate', 'mc_1', 'prompt_2', '乙')).rejects.toThrow();
    vi.mocked(env.数据源.决定P5S2).mockRejectedValue(new Error('网络中断'));
    await expect(env.操作.决定S2('candidate', 'mc_1', 'cdi_1', 'accept')).rejects.toThrow();
    expect([...env.deps.P5幂等意图!.current.keys()].sort()).toEqual([
      'p5:意图:candidate:mc_1:decide_coordination:cdi_1',
      'p5:意图:candidate:mc_1:respond_fact:prompt_1',
      'p5:意图:candidate:mc_1:respond_fact:prompt_2',
    ]);
    randomUUID.mockRestore();
  });

  it('对账 GET 401：清账号后原样抛出，绝不解析成「已确认」的假成功', async () => {
    vi.mocked(env.数据源.回答P5事实)
      .mockRejectedValueOnce(new BFF错误(503, 'downstream_unavailable', 'down'));
    vi.mocked(env.数据源.读取P5详情)
      .mockRejectedValueOnce(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天'))
      .rejects.toMatchObject({ status: 401 });
    expect(env.最新状态().已登录).toBe(false);
    expect(env.deps.会话代际.current).toBe(2);
    expect(env.数据源.清空目录缓存).toHaveBeenCalled();
  });

  it('命令单飞按会话代际隔离：旧会话在飞的承诺不吞新会话的同名命令', async () => {
    const 甲门 = deferred<void>();
    vi.mocked(env.数据源.回答P5事实).mockReturnValue(甲门.promise);
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(已解事实详情);
    void env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天');
    expect(vi.mocked(env.数据源.回答P5事实)).toHaveBeenCalledTimes(1);
    env.deps.会话代际.current += 1; // 登出后换会话
    const 乙 = env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天');
    expect(vi.mocked(env.数据源.回答P5事实)).toHaveBeenCalledTimes(2); // 新会话必须发自己的 POST
    甲门.resolve();
    await 乙;
  });

  it('并发多目标命令：一方的权威重读换代不把另一方迟到的未知结果伪装成成功', async () => {
    const 事实门 = deferred<void>();
    vi.mocked(env.数据源.回答P5事实).mockReturnValueOnce(事实门.promise);
    const 叮嘱门 = deferred<void>();
    vi.mocked(env.数据源.新增P5叮嘱).mockReturnValueOnce(叮嘱门.promise);
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(已解事实详情);
    const 事实 = env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天');
    const 叮嘱 = env.操作.新增叮嘱('candidate', 'mc_1', '工作日全天可联系');
    事实门.resolve(); // 事实先成功 → 权威重读换代落库（作废在飞旧读）
    await 事实;
    叮嘱门.reject(new BFF错误(503, 'downstream_unavailable', 'down')); // 叮嘱迟到未知
    // 绝不静默 resolve：走对账，效果未确认就原样抛，屏层保留草稿
    await expect(叮嘱).rejects.toMatchObject({ status: 503 });
  });

  it('旧会话的迟到成功只删自己的键，不动新会话为同一意图新铸的键', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('old-key'))
      .mockReturnValue(UUID键('new-key'));
    const 旧门 = deferred<void>();
    vi.mocked(env.数据源.新增P5叮嘱).mockReturnValueOnce(旧门.promise);
    const 旧 = env.操作.新增叮嘱('candidate', 'mc_1', '工作日全天可联系');
    // 登出换会话：意图表清空、会话代际 +1
    env.deps.会话代际.current += 1;
    env.deps.P5幂等意图!.current.clear();
    // 新会话重发同一意图：新铸 new-key，自己的 POST 在飞
    const 新门 = deferred<void>();
    vi.mocked(env.数据源.新增P5叮嘱).mockReturnValueOnce(新门.promise);
    const 新 = env.操作.新增叮嘱('candidate', 'mc_1', '工作日全天可联系');
    expect(env.deps.P5幂等意图!.current.size).toBe(1);
    expect([...env.deps.P5幂等意图!.current.values()][0]).toBe(UUID键('new-key'));
    旧门.resolve(); // 旧会话迟到成功
    await 旧;
    // 旧成功绝不删新会话的键（否则新会话的结果未知重试会另铸键造成重复提交）
    expect(env.deps.P5幂等意图!.current.size).toBe(1);
    expect([...env.deps.P5幂等意图!.current.values()][0]).toBe(UUID键('new-key'));
    新门.resolve();
    await 新;
    randomUUID.mockRestore();
  });

  it('对账读迟到于更新的权威重读：不回写旧详情，按原不确定性收口且键保留', async () => {
    // 顺序：叮嘱 POST 未知 → 对账 GET 出发挂起 → 另一命令成功并完成更晚的权威重读落库
    const 叮嘱门 = deferred<void>();
    vi.mocked(env.数据源.新增P5叮嘱).mockReturnValueOnce(叮嘱门.promise);
    vi.mocked(env.数据源.回答P5事实).mockResolvedValue(undefined);
    const 对账门 = deferred<P5详情>();
    vi.mocked(env.数据源.读取P5详情)
      .mockReturnValueOnce(对账门.promise)  // 第 1 次 GET：叮嘱的对账（服务端早执行，迟到回包）
      .mockResolvedValueOnce(已解事实详情); // 第 2 次 GET：事实命令的权威重读（新态）
    const 叮嘱 = env.操作.新增叮嘱('candidate', 'mc_1', '工作日全天可联系');
    await vi.waitFor(() => expect(vi.mocked(env.数据源.新增P5叮嘱)).toHaveBeenCalledTimes(1));
    叮嘱门.reject(new BFF错误(503, 'downstream_unavailable', 'down')); // 未知 → 对账 GET 出发挂起
    await vi.waitFor(() => expect(vi.mocked(env.数据源.读取P5详情)).toHaveBeenCalledTimes(1));
    const 事实 = env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天'); // 成功 → 权威重读换代落新态
    await 事实;
    expect(env.最新状态().P5详情['p5:detail:candidate:mc_1']?.detail).toEqual(已解事实详情);
    对账门.resolve(权威候选详情); // 迟到的旧对账视图
    await expect(叮嘱).rejects.toMatchObject({ status: 503 }); // 绝不按旧对账确认成功
    expect(env.最新状态().P5详情['p5:detail:candidate:mc_1']?.detail).toEqual(已解事实详情); // 不回写旧详情
  });

  it('503 结果不确定：先权威 detail GET 对账，动作仍在则原样抛且键保留，重试沿用同一键', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('fact-key-503'))
      .mockReturnValue(UUID键('fact-key-503b'));
    vi.mocked(env.数据源.回答P5事实)
      .mockRejectedValueOnce(new BFF错误(503, 'downstream_unavailable', 'down'))
      .mockResolvedValueOnce(undefined);
    // 对账读到的是「问题仍待答」的权威详情（默认桩）
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(权威候选详情);
    await expect(env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天'))
      .rejects.toMatchObject({ code: 'downstream_unavailable' });
    expect(env.数据源.读取P5详情).toHaveBeenCalledWith('candidate', 'mc_1'); // 对账 GET 已发生
    expect(env.最新状态().P5详情['p5:detail:candidate:mc_1']?.detail).toEqual(权威候选详情);
    expect(env.deps.P5幂等意图!.current.get('p5:意图:candidate:mc_1:respond_fact:prompt_1')).toBe('fact-key-503');
    // 重试：同一把键
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(已解事实详情);
    await env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天');
    expect(vi.mocked(env.数据源.回答P5事实).mock.calls.map((调用) => 调用[4]))
      .toEqual(['fact-key-503', 'fact-key-503']);
    expect(env.deps.P5幂等意图!.current.has('p5:意图:candidate:mc_1:respond_fact:prompt_1')).toBe(false);
    randomUUID.mockRestore();
  });

  it('409 不确定但对账显示动作已生效：按已确认成功收口（不抛、键释放、scope 刷新）', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID键('fact-key-409'));
    vi.mocked(env.数据源.回答P5事实)
      .mockRejectedValueOnce(new BFF错误(409, 'idempotency_conflict', 'conflict'));
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(已解事实详情);
    vi.mocked(env.数据源.读取P5Open列表).mockResolvedValue(候选页([候选行('mc_1')], null));
    await env.操作.加载工作区('candidate', null);
    const 打开数 = vi.mocked(env.数据源.读取P5Open列表).mock.calls.length;
    await expect(env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天')).resolves.toBeUndefined();
    expect(env.最新状态().P5详情['p5:detail:candidate:mc_1']?.detail).toEqual(已解事实详情);
    expect(vi.mocked(env.数据源.读取P5Open列表).mock.calls.length).toBe(打开数 + 1); // 已确认路径同样刷新列表
    expect(env.deps.P5幂等意图!.current.size).toBe(0);
    randomUUID.mockRestore();
  });

  it('同目标单飞：并发同 (role, case, prompt) 只发一次 POST，两个调用方共享结果', async () => {
    const 门 = deferred<void>();
    vi.mocked(env.数据源.回答P5事实).mockReturnValue(门.promise);
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(已解事实详情);
    const 甲 = env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天');
    const 乙 = env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天');
    expect(vi.mocked(env.数据源.回答P5事实)).toHaveBeenCalledTimes(1);
    门.resolve();
    await Promise.all([甲, 乙]);
    expect(vi.mocked(env.数据源.回答P5事实)).toHaveBeenCalledTimes(1);
  });

  it('不同 Case 并行：两把锁互不阻塞，两发 POST 同时在飞', async () => {
    const 甲门 = deferred<void>();
    const 乙门 = deferred<void>();
    vi.mocked(env.数据源.回答P5事实).mockImplementation(async (_r, caseId) => {
      return caseId === 'mc_1' ? 甲门.promise : 乙门.promise;
    });
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(已解事实详情);
    const 甲 = env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天');
    const 乙 = env.操作.回答事实('candidate', 'mc_2', 'prompt_2', '五天');
    expect(vi.mocked(env.数据源.回答P5事实)).toHaveBeenCalledTimes(2);
    甲门.resolve();
    乙门.resolve();
    await Promise.all([甲, 乙]);
  });

  it('命令 401：统一清账号并清 P5 引用后原样抛出', async () => {
    vi.mocked(env.数据源.决定P5S3)
      .mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(env.操作.决定S3('candidate', 'mc_1', 'confirm')).rejects.toMatchObject({ status: 401 });
    expect(env.最新状态().已登录).toBe(false);
    expect(env.最新状态().P5详情).toEqual({});
    expect(env.deps.P5幂等意图!.current.size).toBe(0);
    expect(env.deps.会话代际.current).toBe(2);
    expect(env.数据源.清空目录缓存).toHaveBeenCalled();
  });

  it('明确拒绝（400）释放键：下一次尝试是全新意图', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('bad-key-1'))
      .mockReturnValue(UUID键('bad-key-2'));
    vi.mocked(env.数据源.新增P5叮嘱)
      .mockRejectedValueOnce(new BFF错误(400, 'invalid_request', '文本过长'))
      .mockResolvedValueOnce(undefined);
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(权威候选详情);
    await expect(env.操作.新增叮嘱('candidate', 'mc_1', '太长的叮嘱'))
      .rejects.toMatchObject({ code: 'invalid_request' });
    expect(env.deps.P5幂等意图!.current.size).toBe(0);
    await env.操作.新增叮嘱('candidate', 'mc_1', '太长的叮嘱');
    expect(vi.mocked(env.数据源.新增P5叮嘱).mock.calls.map((调用) => 调用[3]))
      .toEqual(['bad-key-1', 'bad-key-2']);
    randomUUID.mockRestore();
  });

  it('迟到失败（换代后 reject）只随单飞收口：不写状态、不抛', async () => {
    const 门 = deferred<void>();
    vi.mocked(env.数据源.决定P5S0).mockReturnValue(门.promise);
    const 运行 = env.操作.决定S0('mc_1', 'end');
    env.deps.会话代际.current += 1;
    门.reject(new BFF错误(503, 'downstream_unavailable', 'down'));
    await expect(运行).resolves.toBeUndefined();
    expect(env.数据源.读取P5详情).not.toHaveBeenCalled();
  });

  it('S0–S3 各命令按 facade 契约透传字面参数与键', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID键('cmd-key'));
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(权威候选详情);
    await env.操作.决定S0('mc_1', 'end');
    expect(env.数据源.决定P5S0).toHaveBeenCalledWith('mc_1', 'end', 'cmd-key');
    await env.操作.提交简历('mc_1', 'rf_1', 'rfv_1', true);
    expect(env.数据源.提交P5简历).toHaveBeenCalledWith('mc_1', 'rf_1', 'rfv_1', true, 'cmd-key');
    设主体角色(招聘主体);
    await env.操作.决定S1('mc_1', 'not_fit');
    expect(env.数据源.决定P5S1).toHaveBeenCalledWith('mc_1', 'not_fit', 'cmd-key');
    await env.操作.决定S2('recruiter', 'mc_1', 'cdi_1', 'accept');
    expect(env.数据源.决定P5S2).toHaveBeenCalledWith('recruiter', 'mc_1', 'cdi_1', 'accept', 'cmd-key');
    await env.操作.决定S3('recruiter', 'mc_1', 'decline');
    expect(env.数据源.决定P5S3).toHaveBeenCalledWith('recruiter', 'mc_1', 'decline', 'cmd-key');
    await env.操作.新增叮嘱('recruiter', 'mc_1', '请工作日联系');
    expect(env.数据源.新增P5叮嘱).toHaveBeenCalledWith('recruiter', 'mc_1', '请工作日联系', 'cmd-key');
    randomUUID.mockRestore();
  });

  it('新增叮嘱 503 对账：对方叮嘱落了不算本端已生效 —— 不确认、键保留、同键可重放', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID键('ins-key'));
    // 发送前基线：对方已有 1 条叮嘱，本端 0 条
    vi.mocked(env.数据源.读取P5详情)
      .mockResolvedValueOnce(解P5详情(带叮嘱Wire([{ owner: 'recruiter', expression: '对方早期叮嘱' }]), 'candidate'));
    await env.操作.读取详情('candidate', 'mc_1');
    vi.mocked(env.数据源.新增P5叮嘱)
      .mockRejectedValueOnce(new BFF错误(503, 'downstream_unavailable', 'down'));
    // 对账权威详情：对方又落了 1 条（总数 1→2），本端仍 0 —— 回执总数增长不得冒充本端生效
    vi.mocked(env.数据源.读取P5详情).mockResolvedValueOnce(解P5详情(带叮嘱Wire([
      { owner: 'recruiter', expression: '对方早期叮嘱' },
      { owner: 'recruiter', expression: '对方后来的叮嘱' },
    ]), 'candidate'));
    await expect(env.操作.新增叮嘱('candidate', 'mc_1', '工作日全天可联系'))
      .rejects.toMatchObject({ code: 'downstream_unavailable' });
    expect(env.deps.P5幂等意图!.current.size).toBe(1); // 键保留：同键重放仍可发生
    randomUUID.mockRestore();
  });

  it('新增叮嘱 503 对账：本端同文叮嘱已落才算已生效 —— 确认收口、键释放', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID键('ins-key-2'));
    vi.mocked(env.数据源.读取P5详情)
      .mockResolvedValueOnce(解P5详情(带叮嘱Wire([]), 'candidate'));
    await env.操作.读取详情('candidate', 'mc_1');
    vi.mocked(env.数据源.新增P5叮嘱)
      .mockRejectedValueOnce(new BFF错误(503, 'downstream_unavailable', 'down'));
    // 对账权威详情：本端同文回执已在（对面那条是干扰项，绝不能单独顶替确认）
    vi.mocked(env.数据源.读取P5详情).mockResolvedValueOnce(解P5详情(带叮嘱Wire([
      { owner: 'recruiter', expression: '工作日全天可联系' },
      { owner: 'candidate', expression: '工作日全天可联系' },
    ]), 'candidate'));
    await expect(env.操作.新增叮嘱('candidate', 'mc_1', '工作日全天可联系')).resolves.toBeUndefined();
    expect(env.deps.P5幂等意图!.current.size).toBe(0);
    randomUUID.mockRestore();
  });
});

describe('读取简历PDF 与对象租约', () => {
  function 桩URL() {
    const 建造 = vi.fn(() => 'blob:p5-mock');
    const 回收 = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: 建造, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: 回收, configurable: true, writable: true });
    return { 建造, 回收 };
  }

  it('成功取回 PDF：创建 Plan 1 租约并登记，手动 revoke 幂等', async () => {
    const { 建造, 回收 } = 桩URL();
    const 租约 = await env.操作.读取简历PDF('recruiter', 'mc_1');
    expect(env.数据源.读取P5简历PDF).toHaveBeenCalledWith('recruiter', 'mc_1');
    expect(建造).toHaveBeenCalledTimes(1);
    expect(租约.url).toBe('blob:p5-mock');
    租约.revoke();
    租约.revoke();
    expect(回收).toHaveBeenCalledTimes(1);
    expect(env.deps.P5对象租约!.current.has(租约)).toBe(true); // 已手动回收的租约仍可安全再清
  });

  it('PDF 取件途中同 scope 卸载重挂（ABA）：迟到成功不建租约不登记', async () => {
    const { 建造 } = 桩URL();
    const 门 = deferred<BFF二进制响应>();
    vi.mocked(env.数据源.读取P5简历PDF).mockReturnValue(门.promise);
    const 详情键 = P5范围键.detail('recruiter', 'mc_1');
    env.操作.设置P5范围('recruiter', 详情键); // 挂载
    const 取 = env.操作.读取简历PDF('recruiter', 'mc_1');
    env.操作.设置P5范围('recruiter', null); // 卸载：生命周期换代 + 可见范围清空
    env.操作.设置P5范围('recruiter', 详情键); // 同 role/case 重挂：可见范围回到同值（ABA）
    门.resolve(PDF响应);
    await expect(取).rejects.toThrow();
    expect(建造).not.toHaveBeenCalled();
    expect(env.deps.P5对象租约!.current.size).toBe(0);
  });

  it('迟到成功（会话已换代）不建租约不登记，按失败收口', async () => {
    const { 建造 } = 桩URL();
    const 门 = deferred<BFF二进制响应>();
    vi.mocked(env.数据源.读取P5简历PDF).mockReturnValue(门.promise);
    const 取 = env.操作.读取简历PDF('recruiter', 'mc_1');
    env.deps.会话代际.current += 1; // 取回途中登出换代
    门.resolve(PDF响应);
    await expect(取).rejects.toThrow();
    expect(建造).not.toHaveBeenCalled();
    expect(env.deps.P5对象租约!.current.size).toBe(0);
  });

  it('非 PDF 响应不创建租约、不登记', async () => {
    const { 建造 } = 桩URL();
    vi.mocked(env.数据源.读取P5简历PDF).mockResolvedValue({
      ...PDF响应, contentType: 'text/html',
    });
    await expect(env.操作.读取简历PDF('candidate', 'mc_1')).rejects.toThrow();
    expect(建造).not.toHaveBeenCalled();
    expect(env.deps.P5对象租约!.current.size).toBe(0);
  });

  it('清P5MatchCase引用 回收全部在途对象 URL 并清空登记', async () => {
    const { 回收 } = 桩URL();
    const 租约 = await env.操作.读取简历PDF('candidate', 'mc_1');
    清P5MatchCase引用({
      P5范围代际: env.deps.P5范围代际, P5幂等意图: env.deps.P5幂等意图,
      P5可见范围: env.deps.P5可见范围, P5对象租约: env.deps.P5对象租约,
    });
    expect(回收).toHaveBeenCalledWith('blob:p5-mock');
    expect(env.deps.P5对象租约!.current.size).toBe(0);
    租约.revoke(); // 二次回收安全
  });
});

// ── Task 5：P4 开案成功后的 P5 open 工作区失效 ────────────────────────────────
// 失效 = 读代际 +1（作废在飞的旧读，防止旧空列表随后重新落成成功缓存）+ 移除匹配 owner
// 的工作区槽（下一次 加载工作区 不命中缓存而真实 GET）。只碰 open 工作区。
describe('失效P5开案工作区', () => {
  const 成功空工作区 = (ownerSubjectId: string | null) => ({
    ownerSubjectId, 阶段: '成功' as const, 刷新中: false,
    items: [], nextCursor: null, 已加载页数: 1, error: null, generation: 1,
  });

  function 场景(工作区: Record<string, ReturnType<typeof 成功空工作区>>) {
    const 环境 = 创建P5操作测试环境();
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      P5工作区: 工作区,
    };
    环境.deps.设后端状态((旧) => ({ ...旧, P5工作区: 工作区 }));
    return 环境;
  }

  it('对应 scope 与「全部」档一起失效：两个槽都被移除，读代际各 +1', () => {
    const 对应 = P5范围键.open('candidate', 'int_1');
    const 全部 = P5范围键.open('candidate', null);
    const 别的 = P5范围键.open('candidate', 'int_2');
    const 环境 = 场景({
      [对应]: 成功空工作区('sub_1'),
      [全部]: 成功空工作区('sub_1'),
      [别的]: 成功空工作区('sub_1'),
    });
    失效P5开案工作区(环境.deps, {
      role: 'candidate', subjectId: 'sub_1', sessionGeneration: 1, filterRefs: ['int_1'],
    });
    expect(环境.最新状态().P5工作区[对应]).toBeUndefined();
    expect(环境.最新状态().P5工作区[全部]).toBeUndefined();
    // 别的 scope 仍缓存：失效只针对关联到的范围与全部档
    expect(环境.最新状态().P5工作区[别的]).toBeDefined();
    expect(环境.deps.P5范围代际!.current.get(`${对应}#读`)).toBe(1);
    expect(环境.deps.P5范围代际!.current.get(`${全部}#读`)).toBe(1);
    expect(环境.deps.P5范围代际!.current.get(`${别的}#读`)).toBeUndefined();
  });

  it('只失效匹配 owner 的槽：别的主体留下的窗口不动', () => {
    const 对应 = P5范围键.open('recruiter', 'job_1');
    const 环境 = 场景({ [对应]: 成功空工作区('sub_别人') });
    失效P5开案工作区(环境.deps, {
      role: 'recruiter', subjectId: 'sub_1', sessionGeneration: 1, filterRefs: ['job_1'],
    });
    expect(环境.最新状态().P5工作区[对应]).toBeDefined();
  });

  it('不动另一角色的工作区、历史架子与 Case 详情', () => {
    const 候选档 = P5范围键.open('candidate', null);
    const 招聘档 = P5范围键.open('recruiter', null);
    const 环境 = 场景({ [候选档]: 成功空工作区('sub_1'), [招聘档]: 成功空工作区('sub_1') });
    环境.deps.设后端状态((旧) => ({
      ...旧,
      P5历史: { [P5范围键.history('candidate', 'ended', null)]: 成功空工作区('sub_1') },
    }));
    失效P5开案工作区(环境.deps, {
      role: 'candidate', subjectId: 'sub_1', sessionGeneration: 1, filterRefs: [],
    });
    expect(环境.最新状态().P5工作区[候选档]).toBeUndefined();
    expect(环境.最新状态().P5工作区[招聘档]).toBeDefined();
    expect(Object.keys(环境.最新状态().P5历史)).toHaveLength(1);
  });

  it('捕获的主体或会话代际已变：一个槽都不动（陈旧回执不失效新 scope）', () => {
    const 对应 = P5范围键.open('candidate', 'int_1');
    const 换主体 = 场景({ [对应]: 成功空工作区('sub_1') });
    换主体.deps.主体标识引用.current = 'sub_2';
    失效P5开案工作区(换主体.deps, {
      role: 'candidate', subjectId: 'sub_1', sessionGeneration: 1, filterRefs: ['int_1'],
    });
    expect(换主体.最新状态().P5工作区[对应]).toBeDefined();

    const 换代际 = 场景({ [对应]: 成功空工作区('sub_1') });
    换代际.deps.会话代际.current = 9;
    失效P5开案工作区(换代际.deps, {
      role: 'candidate', subjectId: 'sub_1', sessionGeneration: 1, filterRefs: ['int_1'],
    });
    expect(换代际.最新状态().P5工作区[对应]).toBeDefined();
  });

  it('重复 filterRef 去重：同一 scope 的读代际只 +1', () => {
    const 对应 = P5范围键.open('candidate', 'int_1');
    const 环境 = 场景({ [对应]: 成功空工作区('sub_1') });
    失效P5开案工作区(环境.deps, {
      role: 'candidate', subjectId: 'sub_1', sessionGeneration: 1,
      filterRefs: ['int_1', 'int_1'],
    });
    expect(环境.deps.P5范围代际!.current.get(`${对应}#读`)).toBe(1);
  });

  it('缺 P5 运行时引用即抛接线错误，绝不静默宣称已失效', () => {
    const 环境 = 创建P5操作测试环境();
    const 缺引用 = { ...环境.deps, P5范围代际: undefined };
    expect(() => 失效P5开案工作区(缺引用 as never, {
      role: 'candidate', subjectId: 'sub_1', sessionGeneration: 1, filterRefs: ['int_1'],
    })).toThrow(/P5/);
  });

  it('失效后 加载工作区 不再命中成功缓存，真实 GET', async () => {
    const 对应 = P5范围键.open('candidate', 'int_1');
    const 环境 = 场景({ [对应]: 成功空工作区('sub_1') });
    // 命中缓存：不发请求
    await 环境.操作.加载工作区('candidate', 'int_1');
    const 失效前次数 = vi.mocked(环境.数据源.读取P5Open列表).mock.calls.length;
    失效P5开案工作区(环境.deps, {
      role: 'candidate', subjectId: 'sub_1', sessionGeneration: 1, filterRefs: ['int_1'],
    });
    await 环境.操作.加载工作区('candidate', 'int_1');
    expect(vi.mocked(环境.数据源.读取P5Open列表).mock.calls.length).toBe(失效前次数 + 1);
  });
});
