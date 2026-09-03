// P5 Task 3：MatchCase 运行时状态的行为测试 —— 列表/历史/详情的 scope 快照、
// 从第一页重建已载窗口、游标追加、单飞与读锁接管、S0–S3 命令的意图键生命周期
// （稳定键 + 409/503 不确定后的对账与同键重放）、mutation 后的强制权威重读、
// 401/会话清理与对象租约回收。受控 deferred promise 证明原子提交与迟到丢弃；
// 派发 只是 spy，全部断言读 最新状态()。快照只进内存（后端状态），绝不进持久化。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF主体 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type {
  P5列表项,
  P5列表页,
  P5详情,
  MatchCase数据源,
} from '../../数据/招聘数据源/MatchCase';
import { 解P5详情 } from '../../数据/招聘数据源/MatchCase';
import type { BFF二进制响应 } from '../../数据/HTTP客户端';
import { BFF错误 } from '../../数据/HTTP客户端';
import { BFF主体样本, P5候选详情Wire } from '../../测试/BFF样本';
import { 初始状态 } from '../初始状态';
import type { 动作 } from '../应用状态';
import {
  P5范围键,
  创建MatchCase操作,
  创建空P5MatchCase状态,
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

const PDF响应: BFF二进制响应 = {
  blob: { type: 'application/pdf' } as Blob,
  contentType: 'application/pdf',
  contentDisposition: null,
  requestId: 'fixture',
};

/** 本文件内的数据源桩：桩 P5 facade 全部方法 + 清空目录缓存，默认全成功，逐测试覆盖替换。 */
function 创建P5数据源(覆盖: Record<string, unknown> = {}): HTTP招聘数据源 {
  return {
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
