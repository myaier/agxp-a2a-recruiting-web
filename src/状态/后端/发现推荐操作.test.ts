// P4 Task 3/4/5：发现推荐 Backend raw scope 快照、可见范围栅栏化读取、会话清理、
// refresh/feedback mutation（服务端先行 + 意图键生命周期）与委托回执/轮询的行为测试。
// 受控 deferred promise 证明原子提交与 stale 丢弃；派发 只是 spy，全部 P4 断言读 最新状态()。
// 纪律：另一个 scope 的用例必须先 设置发现推荐范围 再发请求 —— 通过即证明生产可见范围栅栏，而非绕过它。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BFF主体,
  BFF候选岗位推荐,
  BFF委托回执,
  BFF委托摘要,
  BFF发现批次,
  BFF发现偏好,
  BFFOwnerJob,
  BFF招聘候选推荐,
  BFF招聘推荐详情,
} from '../../数据/BFF契约';
import { 创建空P7会话状态 } from './真人会话操作';
import { 创建空P8控制面状态 } from './P8控制面操作';
import { 创建空接触记录状态 } from './接触记录操作';
import { 创建空P5MatchCase状态 } from './MatchCase操作';
import {
  保存待核对,
  读取待核对,
  type 委托待核对owner,
  type 委托待核对存储接口,
  type 待核对命令,
} from './委托待核对';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { BFF错误 } from '../../数据/HTTP客户端';
import {
  BFFCandidateJob样本,
  BFF主体样本,
  BFF发现批次样本,
  BFF发现偏好样本,
  BFF候选岗位推荐样本,
  BFF候选委托回执样本,
  BFF委托失败回执样本,
  BFF岗位样本,
  BFF招聘发现批次样本,
  BFF招聘候选推荐样本,
  BFF招聘委托回执样本,
  招聘候选摘要样本,
} from '../../测试/BFF样本';
import {
  BFF招聘推荐详情无简历样本,
  BFF招聘推荐详情样本,
} from '../../测试/展示资料样本';
import type { 页面岗位快照 } from '../../数据/招聘数据源类型';
import { 从P4招聘候选 } from '../../数据/发现推荐映射';
import { 初始状态 } from '../初始状态';
import type { 动作 } from '../应用状态';
import {
  delegationKey,
  创建空P4发现状态,
  创建发现推荐操作,
  P4委托回执文案,
  P4委托终态文案,
  P4错误文案,
  P4范围键,
  P4拒绝文案,
} from './发现推荐操作';
import type { 后端操作依赖, 后端状态, 发现推荐操作 } from './类型';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** crypto.randomUUID 的签名返回 UUID 模板串；brief 的测试键值（非 UUID 形）走同一显式宽化。 */
const UUID键 = (值: string) => 值 as ReturnType<typeof globalThis.crypto.randomUUID>;

const 候选主体: BFF主体 = { ...BFF主体样本, last_used_role: 'candidate' };
const 招聘主体: BFF主体 = { ...BFF主体样本, last_used_role: 'recruiter' };

// ── J-PILOT-01 Task 3：委托待核对测试底座 ──

/** 受控内存 storage 桩（恰好 Pick<Storage,'getItem'|'setItem'|'removeItem'>）。 */
function 创建内存存储(初始: Record<string, string> = {}): 委托待核对存储接口 & { 表: Map<string, string> } {
  const 表 = new Map<string, string>(Object.entries(初始));
  return {
    表,
    getItem: (键: string) => 表.get(键) ?? null,
    setItem: (键: string, 值: string) => {
      表.set(键, 值);
    },
    removeItem: (键: string) => {
      表.delete(键);
    },
  };
}

const 待核对owner: 委托待核对owner = { environment: 'stg', subjectId: 'sub_1', role: 'candidate' };

/** 委托待核对的 canonical 聚合详情桩：record_id/delegation_id 同坐标，pre-Case 可重试卡。 */
function 连续聚合桩(recordId: string) {
  return {
    needs_action: true,
    record_id: recordId,
    record_kind: 'delegation' as const,
    intention_id: 'int_1',
    job: {
      job_id: 'job_1', title: 'AI 产品实习生', location: '上海',
      public_salary_range: '300-500 元/天', availability: 'available' as const,
    },
    delegation_id: recordId,
    evaluation_id: null,
    case_id: null,
    shelf: 'active' as const,
    phase: 'accepted' as const,
    case_state: null,
    failure: null,
    refusal_code: null,
    actions: { retry: false, archive: false, open_case: false },
    retry_generation: 0,
    created_at: '2026-08-29T01:00:00Z',
    updated_at: '2026-08-29T02:00:00Z',
    archived_at: null,
    evaluation: null,
    case_detail: null,
    failure_history: [],
    agent_summary: { public_evaluation: null, condition_confirmation: null },
  };
}

/** 本文件内的数据源桩：桩 P4 读取/refresh/feedback/委托 + 清空目录缓存，默认全成功，逐测试用覆盖项替换。 */
function 创建P4数据源(覆盖: Record<string, unknown> = {}): HTTP招聘数据源 {
  return {
    读取候选岗位推荐: vi.fn(async (): Promise<BFF候选岗位推荐[]> => []),
    读取候选岗位详情: vi.fn(async () => BFFCandidateJob样本),
    刷新候选岗位推荐: vi.fn(async (): Promise<BFF发现批次> => BFF发现批次样本),
    标记候选岗位不感兴趣: vi.fn(async (): Promise<BFF发现偏好> => BFF发现偏好样本),
    创建候选岗位委托: vi.fn(async (): Promise<BFF委托回执[]> => [BFF候选委托回执样本]),
    读取候选岗位委托: vi.fn(async (): Promise<BFF委托回执> => BFF候选委托回执样本),
    读取招聘候选: vi.fn(async (): Promise<BFF招聘候选推荐[]> => []),
    读取招聘候选详情: vi.fn(async () => BFF招聘推荐详情样本),
    刷新招聘候选: vi.fn(async (): Promise<BFF发现批次> => BFF招聘发现批次样本),
    设置招聘候选收藏: vi.fn(async (): Promise<BFF发现偏好> => BFF发现偏好样本),
    设置招聘候选淘汰: vi.fn(async (): Promise<BFF发现偏好> => BFF发现偏好样本),
    撤销招聘候选淘汰: vi.fn(async (): Promise<BFF发现偏好> => BFF发现偏好样本),
    创建招聘候选委托: vi.fn(async (): Promise<BFF委托回执[]> => [BFF招聘委托回执样本]),
    读取招聘候选委托: vi.fn(async (): Promise<BFF委托回执> => BFF招聘委托回执样本),
    // J-PILOT-01 Task 3：有回执后的 canonical 读（默认按 delegation 坐标回一条聚合详情）
    读取候选连续列表: vi.fn(async (): Promise<{ items: never[]; next_cursor: null }> => ({ items: [], next_cursor: null })),
    读取候选连续详情: vi.fn(async (recordId: string): Promise<unknown> => ({
      ...连续聚合桩(recordId),
    })),
    清空目录缓存: vi.fn(),
    // Task 6 组织对账的唯一权威重读腿：默认空页，逐用例覆盖
    读取岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    ...覆盖,
  } as unknown as HTTP招聘数据源;
}

interface P4操作测试环境 {
  数据源: HTTP招聘数据源;
  deps: 后端操作依赖;
  派发: ReturnType<typeof vi.fn>;
  操作: 发现推荐操作;
  最新状态(): 后端状态;
  /** J-PILOT-01 Task 3：本环境的委托待核对内存表与 owner 存储（硬刷新用例跨 env 共享存储） */
  委托待核对内存: { current: Map<string, 待核对命令> };
  委托待核对存储: { current: { storage: 委托待核对存储接口 | null; owner: 委托待核对owner } | null };
}

function 创建P4操作测试环境(选项: { 待核对存储?: 委托待核对存储接口 | null } = {}): P4操作测试环境 {
  const 数据源 = 创建P4数据源();
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
    // P2：附件库权威快照（只追加，本文件的用例不触达它）
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
    // P5：Task 3 起 后端状态 extends P5MatchCase状态（这里的用例不触达它们）
    ...创建空P5MatchCase状态(),
    // P7：Task 2 起 后端状态 extends P7会话状态（这里的用例不触达它们）
    ...创建空P7会话状态(),
    // P8：Task 3 起 后端状态 extends P8控制面状态（这里的用例不触达它们）
    ...创建空P8控制面状态(),
    ...创建空接触记录状态(),
  };
  const deps: 后端操作依赖 = {
    是后端: true,
    后端: 数据源,
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
    // Task 5：开案成功要经 失效P5开案工作区 触达 P5 open 缓存 —— 生产 Provider 恒注入
    // 这三个引用，桩同样给全，缺引用时该函数抛接线错误而不是静默不失效。
    P5范围代际: { current: new Map<string, number>() },
    P5幂等意图: { current: new Map<string, string>() },
    P5可见范围: { current: { candidate: null, recruiter: null } },
    P5对象租约: { current: new Set() },
    // J-PILOT-01 Task 3：委托待核对运行时引用 —— 内存表 + owner 存储会话
    //（待核对存储 跨 env 可共享：硬刷新 = 新内存表 + 同一 owner 存储）
    委托待核对内存: { current: new Map<string, 待核对命令>() },
    委托待核对存储: {
      current: {
        storage: 选项.待核对存储 === undefined ? 创建内存存储() : 选项.待核对存储,
        owner: 待核对owner,
      },
    },
  };
  return {
    数据源,
    deps,
    派发,
    操作: 创建发现推荐操作(deps),
    最新状态: () => 后端值,
    委托待核对内存: deps.委托待核对内存 as { current: Map<string, 待核对命令> },
    委托待核对存储: deps.委托待核对存储 as P4操作测试环境['委托待核对存储'],
  };
}

let env: P4操作测试环境;

beforeEach(() => {
  env = 创建P4操作测试环境();
  env.操作.设置发现推荐范围('candidate', P4范围键.候选列表('int_1'));
  env.操作.设置发现推荐范围('recruiter', P4范围键.招聘列表('job_1'));
});

function 设主体角色(主体: BFF主体): void {
  env.deps.后端状态引用.current = { ...env.deps.后端状态引用.current, 主体 };
}

function 设后端状态调用数(): number {
  return (env.deps.设后端状态 as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
}

describe('P4范围键 与 设置发现推荐范围', () => {
  it('P4范围键 生成冻结的复合 scope 键，已筛键排序拼接', () => {
    expect(P4范围键.候选列表('int_1')).toBe('candidate:list:int_1');
    expect(P4范围键.候选详情('job_9')).toBe('candidate:detail:job_9');
    expect(P4范围键.招聘列表('job_1')).toBe('recruiter:list:job_1');
    expect(P4范围键.招聘详情('job_1', 'rec_2')).toBe('recruiter:detail:job_1:rec_2');
    expect(P4范围键.招聘已筛(['job_b', 'job_a'])).toBe('recruiter:rejected:job_a,job_b');
  });

  it('含 : / , 的 opaque id 生成互异 scope 键，rejected 成员判定不误配', async () => {
    // 解码器不约束 opaque id 形态：含分隔符的 id 必须逐段转义，绝不允许两组坐标撞成同一把键
    expect(P4范围键.招聘详情('a:b', 'c')).not.toBe(P4范围键.招聘详情('a', 'b:c'));
    expect(P4范围键.招聘已筛(['a,b'])).not.toBe(P4范围键.招聘已筛(['a', 'b']));
    expect(P4范围键.候选列表('a:b')).not.toBe(P4范围键.候选列表('a') + ':b');

    设主体角色(招聘主体);
    const jobKey = P4范围键.招聘已筛(['a,b']);
    env.操作.设置发现推荐范围('recruiter', jobKey);
    vi.mocked(env.数据源.读取招聘候选).mockResolvedValue([]);
    await env.操作.加载招聘已筛(['a,b']);
    expect(env.最新状态().招聘已筛候选[jobKey]).toMatchObject({ 阶段: '成功', items: [] });

    // 岗位 'a' 的淘汰绝不能并进 'a,b' 这份聚合（旧的逗号回解会把它当成成员）
    await env.操作.淘汰候选('a', 'rec_r1', 'other');
    expect(env.最新状态().招聘已筛候选[jobKey]?.items).toEqual([]);
  });

  it('设置发现推荐范围 只更新指名角色的可见范围', () => {
    env.操作.设置发现推荐范围('candidate', P4范围键.候选详情('job_5'));
    expect(env.deps.P4可见范围!.current.candidate).toBe('candidate:detail:job_5');
    expect(env.deps.P4可见范围!.current.recruiter).toBe('recruiter:list:job_1');
  });

  it('换键/清键递增新旧 scope 代际', () => {
    const 代际 = env.deps.P4范围代际!;
    expect(代际.current.get('candidate:list:int_1')).toBe(1);
    env.操作.设置发现推荐范围('candidate', P4范围键.候选列表('int_2'));
    expect(代际.current.get('candidate:list:int_1')).toBe(2);
    expect(代际.current.get('candidate:list:int_2')).toBe(1);
    env.操作.设置发现推荐范围('candidate', null);
    expect(代际.current.get('candidate:list:int_2')).toBe(2);
    expect(env.deps.P4可见范围!.current.candidate).toBeNull();
    expect(env.deps.P4可见范围!.current.recruiter).toBe('recruiter:list:job_1');
  });

  it('换键移除旧可见范围前缀的 pending 幂等意图，另一角色保留', () => {
    env.deps.P4幂等意图!.current.set('candidate:list:int_1:refresh', 'k1');
    env.deps.P4幂等意图!.current.set('recruiter:list:job_1:refresh', 'k2');
    env.操作.设置发现推荐范围('candidate', P4范围键.候选列表('int_2'));
    expect(env.deps.P4幂等意图!.current.has('candidate:list:int_1:refresh')).toBe(false);
    expect(env.deps.P4幂等意图!.current.has('recruiter:list:job_1:refresh')).toBe(true);
  });
});

describe('候选岗位推荐读取', () => {
  it('candidate load commits only after the full facade read succeeds', async () => {
    const pending = deferred<BFF候选岗位推荐[]>();
    vi.mocked(env.数据源.读取候选岗位推荐).mockReturnValue(pending.promise);
    const call = env.操作.加载候选岗位('int_scope');
    expect(env.最新状态().候选岗位推荐.int_scope).toMatchObject({
      阶段: '进行中', items: [], 刷新中: true,
    });
    pending.resolve([BFF候选岗位推荐样本]);
    await call;
    expect(env.最新状态().候选岗位推荐.int_scope).toMatchObject({
      阶段: '成功', items: [BFF候选岗位推荐样本], 刷新中: false, error: null,
    });
  });

  it('stale subject/scope response never overwrites the new scope', async () => {
    const old = deferred<BFF候选岗位推荐[]>();
    vi.mocked(env.数据源.读取候选岗位推荐)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce([{ ...BFF候选岗位推荐样本, intention_id: 'int_new' }]);
    const oldCall = env.操作.加载候选岗位('int_old');
    env.deps.主体标识引用.current = 'sub_new';
    env.deps.会话代际.current += 1;
    await env.操作.加载候选岗位('int_new');
    old.resolve([{ ...BFF候选岗位推荐样本, intention_id: 'int_old' }]);
    await oldCall;
    expect(env.最新状态().候选岗位推荐.int_new.items[0].intention_id).toBe('int_new');
    expect(env.最新状态().候选岗位推荐.int_old?.items ?? []).toEqual([]);
  });

  it('首次加载失败落 失败 并保留错误文案，不派发也不清账号', async () => {
    vi.mocked(env.数据源.读取候选岗位推荐)
      .mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    await env.操作.加载候选岗位('int_1');
    const 快照 = env.最新状态().候选岗位推荐.int_1;
    expect(快照).toMatchObject({ 阶段: '失败', items: [], 刷新中: false });
    expect(快照?.error).not.toBeNull();
    expect(env.派发).not.toHaveBeenCalled();
    expect(env.deps.主体标识引用.current).toBe('sub_1');
    expect(env.最新状态().已登录).toBe(true);
  });

  it('成功快照的强制刷新保留旧 items，失败也不降级', async () => {
    vi.mocked(env.数据源.读取候选岗位推荐).mockResolvedValueOnce([BFF候选岗位推荐样本]);
    await env.操作.加载候选岗位('int_1', true);
    expect(env.最新状态().候选岗位推荐.int_1).toMatchObject({
      阶段: '成功', items: [BFF候选岗位推荐样本],
    });
    const 刷新门 = deferred<BFF候选岗位推荐[]>();
    vi.mocked(env.数据源.读取候选岗位推荐).mockReturnValue(刷新门.promise);
    const 刷新 = env.操作.加载候选岗位('int_1', true);
    // 刷新途中阶段不降级、旧列表不闪退
    expect(env.最新状态().候选岗位推荐.int_1).toMatchObject({
      阶段: '成功', items: [BFF候选岗位推荐样本], 刷新中: true,
    });
    刷新门.reject(new BFF错误(503, 'downstream_unavailable', 'down'));
    await 刷新;
    expect(env.最新状态().候选岗位推荐.int_1).toMatchObject({
      阶段: '成功', items: [BFF候选岗位推荐样本], 刷新中: false,
    });
    expect(env.最新状态().候选岗位推荐.int_1?.error).not.toBeNull();
  });

  it('非 force 命中成功快照不再请求；force 才重读；在飞期间单飞', async () => {
    const 门 = deferred<BFF候选岗位推荐[]>();
    vi.mocked(env.数据源.读取候选岗位推荐).mockReturnValue(门.promise);
    const 第一次 = env.操作.加载候选岗位('int_1');
    const 第二次 = env.操作.加载候选岗位('int_1');
    门.resolve([BFF候选岗位推荐样本]);
    await Promise.all([第一次, 第二次]);
    expect(vi.mocked(env.数据源.读取候选岗位推荐)).toHaveBeenCalledTimes(1);
    await env.操作.加载候选岗位('int_1'); // 非 force：成功快照命中
    expect(vi.mocked(env.数据源.读取候选岗位推荐)).toHaveBeenCalledTimes(1);
    await env.操作.加载候选岗位('int_1', true);
    expect(vi.mocked(env.数据源.读取候选岗位推荐)).toHaveBeenCalledTimes(2);
  });

  it('可见范围变化/卸载后，旧完成只释放锁不写状态', async () => {
    const 门 = deferred<BFF候选岗位推荐[]>();
    vi.mocked(env.数据源.读取候选岗位推荐).mockReturnValue(门.promise);
    const 运行 = env.操作.加载候选岗位('int_scope');
    env.操作.设置发现推荐范围('candidate', P4范围键.候选列表('int_2'));
    门.resolve([BFF候选岗位推荐样本]);
    await 运行;
    expect(env.最新状态().候选岗位推荐.int_scope).toMatchObject({
      阶段: '进行中', items: [], 刷新中: true,
    });
    expect(env.派发).not.toHaveBeenCalled();
    // 锁已释放：同 scope 可再次加载（此刻可见范围是 int_2，栅栏按当前可见范围捕获）
    await env.操作.加载候选岗位('int_scope', true);
    expect(env.最新状态().候选岗位推荐.int_scope).toMatchObject({ 阶段: '成功' });
  });
});

describe('招聘可用候选读取', () => {
  it('招聘列表按 jobId 读取并原子提交可用候选快照', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选).mockResolvedValue([BFF招聘候选推荐样本]);
    await env.操作.加载招聘候选('job_1');
    expect(env.数据源.读取招聘候选).toHaveBeenCalledWith('job_1');
    expect(env.最新状态().招聘可用候选.job_1).toMatchObject({
      阶段: '成功', items: [BFF招聘候选推荐样本], 刷新中: false, error: null,
    });
  });

  it('刷新整组替换 items：新快照摘要为 null 后旧摘要不得残留', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选).mockResolvedValueOnce([
      { ...BFF招聘候选推荐样本, candidate_summary: 招聘候选摘要样本 },
    ]);
    await env.操作.加载招聘候选('job_1');
    expect(env.最新状态().招聘可用候选.job_1?.items[0]?.candidate_summary).toEqual(招聘候选摘要样本);

    vi.mocked(env.数据源.读取招聘候选).mockResolvedValueOnce([
      { ...BFF招聘候选推荐样本, candidate_summary: null },
    ]);
    await env.操作.加载招聘候选('job_1', true);
    expect(env.最新状态().招聘可用候选.job_1?.items[0]?.candidate_summary).toBeNull();
  });

  it('收藏更新只改 favorite，每处出现的摘要原样保留', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选).mockResolvedValue([
      { ...BFF招聘候选推荐样本, candidate_summary: 招聘候选摘要样本 },
    ]);
    await env.操作.加载招聘候选('job_1');
    vi.mocked(env.数据源.设置招聘候选收藏).mockResolvedValue({
      ...BFF发现偏好样本, favorite: true, rejected: false, rejection_reason: null,
    });
    await env.操作.设置候选收藏('job_1', 'rec_r1', true);
    const 卡 = env.最新状态().招聘可用候选.job_1?.items[0];
    expect(卡?.favorite).toBe(true);
    expect(卡?.candidate_summary).toEqual(招聘候选摘要样本);
  });
});

describe('读取招聘已筛', () => {
  it('排序去重后并发读取全部在招岗位的 rejected，全部成功后一次提交', async () => {
    设主体角色(招聘主体);
    env.操作.设置发现推荐范围('recruiter', P4范围键.招聘已筛(['job_a', 'job_b']));
    const 甲门 = deferred<BFF招聘候选推荐[]>();
    const 乙门 = deferred<BFF招聘候选推荐[]>();
    vi.mocked(env.数据源.读取招聘候选).mockImplementation(
      async (jobId: string) => (jobId === 'job_a' ? 甲门.promise : 乙门.promise),
    );
    const 运行 = env.操作.加载招聘已筛(['job_b', 'job_a', 'job_b']);
    expect(env.数据源.读取招聘候选).toHaveBeenCalledTimes(2);
    expect(env.数据源.读取招聘候选).toHaveBeenCalledWith('job_a', 'rejected');
    expect(env.数据源.读取招聘候选).toHaveBeenCalledWith('job_b', 'rejected');
    const jobKey = P4范围键.招聘已筛(['job_a', 'job_b']);
    expect(env.最新状态().招聘已筛聚合).toMatchObject({ 阶段: '进行中', jobKey });
    甲门.resolve([BFF招聘候选推荐样本]);
    await 甲门.promise; // 甲已结算、乙未结算：不许出现半份提交
    expect(env.最新状态().招聘已筛候选[jobKey]?.items).toEqual([]);
    乙门.resolve([{ ...BFF招聘候选推荐样本, recommendation_id: 'rec_r2' }]);
    await 运行;
    expect(env.最新状态().招聘已筛候选[jobKey]).toMatchObject({ 阶段: '成功', 刷新中: false, error: null });
    expect(env.最新状态().招聘已筛候选[jobKey]?.items.map((条) => 条.recommendation_id))
      .toEqual(['rec_r1', 'rec_r2']);
    expect(env.最新状态().招聘已筛聚合).toEqual({ 阶段: '成功', jobKey, error: null });
    expect(设后端状态调用数()).toBe(2); // 起步 + 唯一一次原子提交
  });

  it('一条 rejected 腿失败时不提交半份聚合', async () => {
    设主体角色(招聘主体);
    env.操作.设置发现推荐范围('recruiter', P4范围键.招聘已筛(['job_a', 'job_b']));
    vi.mocked(env.数据源.读取招聘候选).mockImplementation(async (jobId: string) =>
      jobId === 'job_a'
        ? [BFF招聘候选推荐样本]
        : Promise.reject(new BFF错误(503, 'source_unavailable', 'down')));
    await env.操作.加载招聘已筛(['job_a', 'job_b']);
    const jobKey = P4范围键.招聘已筛(['job_a', 'job_b']);
    expect(env.最新状态().招聘已筛候选[jobKey]).toMatchObject({ 阶段: '失败', items: [] });
    expect(env.最新状态().招聘已筛聚合).toMatchObject({ 阶段: '失败', jobKey });
    expect(设后端状态调用数()).toBe(2); // 起步 + 失败收口，甲的成功腿从未单独落地
  });

  it('聚合刷新失败保留已成功的聚合与快照', async () => {
    设主体角色(招聘主体);
    const jobKey = P4范围键.招聘已筛(['job_a']);
    env.操作.设置发现推荐范围('recruiter', jobKey);
    vi.mocked(env.数据源.读取招聘候选).mockResolvedValueOnce([BFF招聘候选推荐样本]);
    await env.操作.加载招聘已筛(['job_a']);
    expect(env.最新状态().招聘已筛聚合).toMatchObject({ 阶段: '成功', jobKey });
    vi.mocked(env.数据源.读取招聘候选).mockRejectedValue(new BFF错误(503, 'source_unavailable', 'down'));
    await env.操作.加载招聘已筛(['job_a'], true);
    expect(env.最新状态().招聘已筛聚合).toMatchObject({ 阶段: '成功', jobKey });
    expect(env.最新状态().招聘已筛候选[jobKey]).toMatchObject({
      阶段: '成功', items: [BFF招聘候选推荐样本], 刷新中: false,
    });
    expect(env.最新状态().招聘已筛候选[jobKey]?.error).not.toBeNull();
  });
});

describe('详情读取与 404 不可用标记', () => {
  it('候选岗位详情直读落缓存；非 force 命中缓存不重发', async () => {
    await env.操作.读取候选岗位详情('job_9');
    await env.操作.读取候选岗位详情('job_9');
    expect(env.数据源.读取候选岗位详情).toHaveBeenCalledTimes(1);
    expect(env.数据源.读取候选岗位详情).toHaveBeenCalledWith('job_9');
    expect(env.最新状态().候选岗位详情.job_9).toEqual(BFFCandidateJob样本);
  });

  it('候选岗位详情 404 标记不可用且不抛；后续成功移除标记并落缓存', async () => {
    vi.mocked(env.数据源.读取候选岗位详情)
      .mockRejectedValueOnce(new BFF错误(404, 'job_not_found', 'gone'))
      .mockResolvedValueOnce(BFFCandidateJob样本);
    await expect(env.操作.读取候选岗位详情('job_x')).resolves.toBeUndefined();
    expect(env.最新状态().候选岗位不可用).toEqual(['job_x']);
    expect(env.最新状态().候选岗位详情.job_x).toBeUndefined();
    await env.操作.读取候选岗位详情('job_x', true);
    expect(env.最新状态().候选岗位不可用).toEqual([]);
    expect(env.最新状态().候选岗位详情.job_x).toEqual(BFFCandidateJob样本);
  });

  it('招聘候选详情 缓存后非 force 不重发、force 恒重读；404 标记不可用', async () => {
    设主体角色(招聘主体);
    await env.操作.读取招聘候选详情('job_1', 'rec_r1');
    await env.操作.读取招聘候选详情('job_1', 'rec_r1');
    expect(env.数据源.读取招聘候选详情).toHaveBeenCalledTimes(1);
    await env.操作.读取招聘候选详情('job_1', 'rec_r1', true); // 屏端恒 force
    expect(env.数据源.读取招聘候选详情).toHaveBeenCalledTimes(2);
    expect(env.数据源.读取招聘候选详情).toHaveBeenCalledWith('job_1', 'rec_r1');
    expect(env.最新状态().招聘候选详情.rec_r1).toEqual(BFF招聘推荐详情样本);
    vi.mocked(env.数据源.读取招聘候选详情)
      .mockRejectedValue(new BFF错误(404, 'recommendation_not_found', 'gone'));
    await expect(env.操作.读取招聘候选详情('job_1', 'rec_gone', true)).resolves.toBeUndefined();
    expect(env.最新状态().招聘候选不可用).toEqual(['rec_gone']);
    expect(env.最新状态().招聘候选详情.rec_gone).toBeUndefined();
  });

  // fail closed：热缓存 + 重读 404 时，只加不可用标记会让旧详情继续渲染成活页
  it('招聘候选详情 热缓存后重读 404：缓存条目删除，只留不可用标记', async () => {
    设主体角色(招聘主体);
    await env.操作.读取招聘候选详情('job_1', 'rec_r1');
    expect(env.最新状态().招聘候选详情.rec_r1).toEqual(BFF招聘推荐详情样本);
    vi.mocked(env.数据源.读取招聘候选详情)
      .mockRejectedValue(new BFF错误(404, 'recommendation_not_found', 'gone'));
    await expect(env.操作.读取招聘候选详情('job_1', 'rec_r1', true)).resolves.toBeUndefined();
    expect(env.最新状态().招聘候选详情.rec_r1).toBeUndefined();
    expect(env.最新状态().招聘候选不可用).toEqual(['rec_r1']);
  });

  it('候选岗位详情 热缓存后重读 404：缓存条目删除，只留不可用标记', async () => {
    await env.操作.读取候选岗位详情('job_9');
    expect(env.最新状态().候选岗位详情.job_9).toEqual(BFFCandidateJob样本);
    vi.mocked(env.数据源.读取候选岗位详情)
      .mockRejectedValue(new BFF错误(404, 'job_not_found', 'gone'));
    await expect(env.操作.读取候选岗位详情('job_9', true)).resolves.toBeUndefined();
    expect(env.最新状态().候选岗位详情.job_9).toBeUndefined();
    expect(env.最新状态().候选岗位不可用).toEqual(['job_9']);
  });
});

describe('401 会话清理与迟到 401', () => {
  it('读取 401 走统一清账号状态并清 P4 状态与引用', async () => {
    env.deps.P4幂等意图!.current.set('candidate:list:int_1:refresh', 'idem_1');
    env.deps.P4范围代际!.current.set('candidate:list:int_9', 4);
    vi.mocked(env.数据源.读取候选岗位推荐)
      .mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await env.操作.加载候选岗位('int_1');
    const 最新 = env.最新状态();
    expect(最新.已登录).toBe(false);
    expect(最新.主体).toBeNull();
    expect(最新.候选岗位推荐).toEqual({});
    expect(最新.P4委托回执).toEqual({});
    expect(env.deps.P4幂等意图!.current.size).toBe(0);
    expect(env.deps.P4范围代际!.current.size).toBe(0);
    expect(env.deps.P4可见范围!.current).toEqual({ candidate: null, recruiter: null });
    expect(env.deps.主体标识引用.current).toBeNull();
    expect(env.deps.会话代际.current).toBe(2);
    expect(env.派发).toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(env.数据源.清空目录缓存).toHaveBeenCalled();
  });

  it('迟到 401 不清新会话', async () => {
    const 目录拒绝 = deferred<BFF候选岗位推荐[]>();
    vi.mocked(env.数据源.读取候选岗位推荐).mockReturnValue(目录拒绝.promise);
    const 运行 = env.操作.加载候选岗位('int_1');
    env.deps.主体标识引用.current = 'sub_new';
    env.deps.会话代际.current += 1;
    目录拒绝.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await 运行;
    expect(env.deps.主体标识引用.current).toBe('sub_new');
    expect(env.deps.会话代际.current).toBe(2);
    expect(env.最新状态().已登录).toBe(true);
    expect(env.派发).not.toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(env.数据源.清空目录缓存).not.toHaveBeenCalled();
  });
});

describe('读锁过期接管（StrictMode 卸载重挂）', () => {
  it('在飞属主栅栏过期后新读取接管锁并重发 GET，旧迟到响应不写状态', async () => {
    const 旧门 = deferred<BFF候选岗位推荐[]>();
    const 新门 = deferred<BFF候选岗位推荐[]>();
    vi.mocked(env.数据源.读取候选岗位推荐)
      .mockReturnValueOnce(旧门.promise)
      .mockReturnValueOnce(新门.promise);
    // (1) 首次挂载：可见范围已注册，读取起跑、GET 在飞
    const 旧读 = env.操作.加载候选岗位('int_1');
    // (2) StrictMode cleanup 清范围 → remount 重注册：scope 代际两连跳
    env.操作.设置发现推荐范围('candidate', null);
    env.操作.设置发现推荐范围('candidate', P4范围键.候选列表('int_1'));
    // (3) 重挂的读取不被在飞锁吞掉：接管锁、重发 GET
    const 新读 = env.操作.加载候选岗位('int_1');
    expect(vi.mocked(env.数据源.读取候选岗位推荐)).toHaveBeenCalledTimes(2);
    // (4) 新属主的响应原子落地
    新门.resolve([BFF候选岗位推荐样本]);
    await 新读;
    expect(env.最新状态().候选岗位推荐.int_1).toMatchObject({
      阶段: '成功', items: [BFF候选岗位推荐样本], 刷新中: false, error: null,
    });
    // (5) 被放弃的旧属主迟到响应：整包丢弃 —— 不写状态、不派发、不动新属主的锁
    旧门.resolve([{ ...BFF候选岗位推荐样本, recommendation_id: 'rec_旧属主' }]);
    await 旧读;
    expect(env.最新状态().候选岗位推荐.int_1?.items).toEqual([BFF候选岗位推荐样本]);
    expect(env.派发).not.toHaveBeenCalled();
    expect(设后端状态调用数()).toBe(3); // 旧起步 + 接管起步 + 新成功；旧完成零写入
    // 锁已归新属主并正常释放：后续 force 读取照常工作
    await env.操作.加载候选岗位('int_1', true);
    expect(env.最新状态().候选岗位推荐.int_1).toMatchObject({ 阶段: '成功' });
  });

  it('详情读同样过期接管（屏以详情键注册可见范围），旧迟到响应不写缓存', async () => {
    env.操作.设置发现推荐范围('candidate', P4范围键.候选详情('job_1'));
    const 旧门 = deferred<typeof BFFCandidateJob样本>();
    const 新门 = deferred<typeof BFFCandidateJob样本>();
    vi.mocked(env.数据源.读取候选岗位详情)
      .mockReturnValueOnce(旧门.promise)
      .mockReturnValueOnce(新门.promise);
    const 旧读 = env.操作.读取候选岗位详情('job_1');
    env.操作.设置发现推荐范围('candidate', null);
    env.操作.设置发现推荐范围('candidate', P4范围键.候选详情('job_1'));
    const 新读 = env.操作.读取候选岗位详情('job_1');
    expect(vi.mocked(env.数据源.读取候选岗位详情)).toHaveBeenCalledTimes(2);
    新门.resolve(BFFCandidateJob样本);
    await 新读;
    expect(env.最新状态().候选岗位详情.job_1).toEqual(BFFCandidateJob样本);
    旧门.resolve({ ...BFFCandidateJob样本, job_id: 'job_旧属主' });
    await 旧读;
    expect(env.最新状态().候选岗位详情.job_1).toEqual(BFFCandidateJob样本);
  });
});

describe('创建空P4发现状态', () => {
  it('返回十个字段的空底座', () => {
    expect(创建空P4发现状态()).toEqual({
      候选岗位推荐: {}, 候选岗位详情: {}, 候选岗位不可用: [],
      招聘可用候选: {}, 招聘已筛候选: {},
      招聘已筛聚合: { 阶段: '未开始', jobKey: '', error: null },
      招聘候选详情: {}, 招聘候选不可用: [],
      P4委托回执: {}, P4真实Case引用: {},
    });
  });
});

describe('刷新与幂等意图键', () => {
  it('refresh reuses one key after outcome uncertainty and replaces only after GET succeeds', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('refresh-key-0001'))
      .mockReturnValue(UUID键('refresh-key-0002'));
    vi.mocked(env.数据源.刷新候选岗位推荐)
      .mockRejectedValueOnce(new BFF错误(0, 'network_error', 'unknown'))
      .mockResolvedValueOnce(BFF发现批次样本);
    vi.mocked(env.数据源.读取候选岗位推荐)
      .mockResolvedValueOnce([BFF候选岗位推荐样本]);

    await expect(env.操作.刷新候选岗位('int_1')).rejects.toMatchObject({ code: 'network_error' });
    await env.操作.刷新候选岗位('int_1');

    expect(vi.mocked(env.数据源.刷新候选岗位推荐).mock.calls).toEqual([
      ['int_1', 'refresh-key-0001'], ['int_1', 'refresh-key-0001'],
    ]);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(env.最新状态().候选岗位推荐.int_1.items).toEqual([BFF候选岗位推荐样本]);
    randomUUID.mockRestore();
  });

  it('refresh POST 成功 + GET 失败保留旧 items，落「已发起新一轮」文案且键保留', async () => {
    vi.mocked(env.数据源.读取候选岗位推荐).mockResolvedValueOnce([BFF候选岗位推荐样本]);
    await env.操作.加载候选岗位('int_1');
    vi.mocked(env.数据源.刷新候选岗位推荐).mockResolvedValueOnce(BFF发现批次样本);
    vi.mocked(env.数据源.读取候选岗位推荐)
      .mockRejectedValueOnce(new BFF错误(503, 'source_unavailable', 'down'));

    await env.操作.刷新候选岗位('int_1'); // follow-up GET 失败不抛：错误走快照 error

    const 快照 = env.最新状态().候选岗位推荐.int_1;
    expect(快照).toMatchObject({ 阶段: '成功', items: [BFF候选岗位推荐样本], 刷新中: false });
    expect(快照?.error).toBe('已发起新一轮，结果暂未刷新');
    // POST 已建批次、结果未上屏：同一意图重试沿用原键
    expect(env.deps.P4幂等意图!.current.has('candidate:list:int_1:refresh')).toBe(true);
  });

  it('refresh follow-up GET 的栅栏内 401 走统一清账号状态，不落未决文案', async () => {
    vi.mocked(env.数据源.读取候选岗位推荐).mockResolvedValueOnce([BFF候选岗位推荐样本]);
    await env.操作.加载候选岗位('int_1');
    vi.mocked(env.数据源.刷新候选岗位推荐).mockResolvedValueOnce(BFF发现批次样本);
    vi.mocked(env.数据源.读取候选岗位推荐)
      .mockRejectedValueOnce(new BFF错误(401, 'invalid_session', 'expired'));

    await env.操作.刷新候选岗位('int_1');

    const 最新 = env.最新状态();
    expect(最新.已登录).toBe(false);
    expect(最新.主体).toBeNull();
    expect(最新.候选岗位推荐).toEqual({});
    expect(env.deps.会话代际.current).toBe(2);
    expect(env.deps.P4幂等意图!.current.size).toBe(0);
    expect(env.数据源.清空目录缓存).toHaveBeenCalled();
  });

  it('refresh follow-up GET 的迟到 401 不清新会话也不写状态', async () => {
    const POST门 = deferred<BFF发现批次>();
    const GET门 = deferred<BFF候选岗位推荐[]>();
    vi.mocked(env.数据源.刷新候选岗位推荐).mockReturnValueOnce(POST门.promise);
    vi.mocked(env.数据源.读取候选岗位推荐).mockReturnValueOnce(GET门.promise);
    const 运行 = env.操作.刷新候选岗位('int_1');
    POST门.resolve(BFF发现批次样本);
    await POST门.promise; // follow-up GET 已在飞
    const 提交数 = 设后端状态调用数();
    env.deps.主体标识引用.current = 'sub_new';
    env.deps.会话代际.current += 1;
    GET门.reject(new BFF错误(401, 'invalid_session', 'expired'));

    await 运行;

    expect(env.deps.主体标识引用.current).toBe('sub_new');
    expect(env.deps.会话代际.current).toBe(2);
    expect(env.最新状态().已登录).toBe(true);
    expect(设后端状态调用数()).toBe(提交数);
    expect(env.数据源.清空目录缓存).not.toHaveBeenCalled();
  });

  it('idempotency_conflict 重读遇栅栏内 401 走统一清账号状态，且不再向屏叠一条冲突错误', async () => {
    vi.mocked(env.数据源.刷新候选岗位推荐)
      .mockRejectedValueOnce(new BFF错误(409, 'idempotency_conflict', 'conflict'));
    vi.mocked(env.数据源.读取候选岗位推荐)
      .mockRejectedValueOnce(new BFF错误(401, 'invalid_session', 'expired'));

    // 会话已被拆掉：再抛冲突文案只会在登录页上叠一条无意义提示
    await expect(env.操作.刷新候选岗位('int_1')).resolves.toBeUndefined();

    const 最新 = env.最新状态();
    expect(最新.已登录).toBe(false);
    expect(最新.候选岗位推荐).toEqual({});
    expect(env.deps.会话代际.current).toBe(2);
    expect(env.数据源.清空目录缓存).toHaveBeenCalled();
  });

  it('idempotency_conflict 的对账失败迟到时既不抛也不写状态', async () => {
    const POST门 = deferred<BFF发现批次>();
    const GET门 = deferred<BFF候选岗位推荐[]>();
    vi.mocked(env.数据源.刷新候选岗位推荐).mockReturnValueOnce(POST门.promise);
    vi.mocked(env.数据源.读取候选岗位推荐).mockReturnValueOnce(GET门.promise);
    const 运行 = env.操作.刷新候选岗位('int_1');
    POST门.reject(new BFF错误(409, 'idempotency_conflict', 'conflict'));
    await POST门.promise.catch(() => undefined); // 对账重读已在飞
    const 提交数 = 设后端状态调用数();
    env.deps.会话代际.current += 1; // 屏已换代：这条对账结果与它无关
    GET门.reject(new BFF错误(503, 'source_unavailable', 'down'));

    await expect(运行).resolves.toBeUndefined();

    expect(设后端状态调用数()).toBe(提交数);
    expect(env.最新状态().已登录).toBe(true);
  });

  it('idempotency_conflict 不换键：重读权威 scope 后才释放，下一次刷新才铸新键', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('conflict-key-0001'))
      .mockReturnValue(UUID键('conflict-key-0002'));
    vi.mocked(env.数据源.刷新候选岗位推荐)
      .mockRejectedValueOnce(new BFF错误(409, 'idempotency_conflict', 'conflict'))
      .mockResolvedValueOnce(BFF发现批次样本);
    vi.mocked(env.数据源.读取候选岗位推荐).mockResolvedValue([BFF候选岗位推荐样本]);

    await expect(env.操作.刷新候选岗位('int_1')).rejects.toMatchObject({ code: 'idempotency_conflict' });
    // 权威重读已落快照，冲突对账成功后键已释放
    expect(env.最新状态().候选岗位推荐.int_1).toMatchObject({
      阶段: '成功', items: [BFF候选岗位推荐样本],
    });
    expect(env.deps.P4幂等意图!.current.has('candidate:list:int_1:refresh')).toBe(false);

    await env.操作.刷新候选岗位('int_1'); // 新的用户意图才铸造新键
    expect(vi.mocked(env.数据源.刷新候选岗位推荐).mock.calls).toEqual([
      ['int_1', 'conflict-key-0001'], ['int_1', 'conflict-key-0002'],
    ]);
    expect(randomUUID).toHaveBeenCalledTimes(2);
    expect(env.deps.P4幂等意图!.current.has('candidate:list:int_1:refresh')).toBe(false);
    randomUUID.mockRestore();
  });

  it('招聘刷新 POST+GET 成功提交可用候选快照并释放键', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选).mockResolvedValue([BFF招聘候选推荐样本]);
    await env.操作.刷新招聘候选('job_1');
    expect(vi.mocked(env.数据源.刷新招聘候选)).toHaveBeenCalledWith('job_1', expect.any(String));
    expect(env.最新状态().招聘可用候选.job_1).toMatchObject({
      阶段: '成功', items: [BFF招聘候选推荐样本], 刷新中: false, error: null,
    });
    expect(env.deps.P4幂等意图!.current.has('recruiter:list:job_1:refresh')).toBe(false);
  });

  it('scope GET 与 refresh 按 scope 串行：refresh 在飞时强制重读直接返回', async () => {
    const 门 = deferred<BFF发现批次>();
    vi.mocked(env.数据源.刷新候选岗位推荐).mockReturnValue(门.promise);
    const 刷新 = env.操作.刷新候选岗位('int_1');
    await env.操作.加载候选岗位('int_1', true); // 读锁被 refresh 持有：不重发 GET
    expect(vi.mocked(env.数据源.读取候选岗位推荐)).not.toHaveBeenCalled();
    门.resolve(BFF发现批次样本);
    await 刷新;
    expect(vi.mocked(env.数据源.读取候选岗位推荐)).toHaveBeenCalledTimes(1); // refresh 自己的 follow-up GET
  });
});

describe('招聘反馈与服务端先行', () => {
  it('feedback never moves a recruiter card before server success', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选).mockResolvedValue([BFF招聘候选推荐样本]);
    await env.操作.加载招聘候选('job_1');
    vi.mocked(env.数据源.设置招聘候选淘汰)
      .mockRejectedValue(new BFF错误(503, 'source_unavailable', 'down'));
    await expect(env.操作.淘汰候选('job_1', 'rec_1', 'direction_mismatch'))
      .rejects.toMatchObject({ code: 'source_unavailable' });
    expect(env.最新状态().招聘可用候选.job_1.items).toEqual([BFF招聘候选推荐样本]);
    expect(env.最新状态().招聘已筛候选.job_1?.items ?? []).toEqual([]);
  });

  it('淘汰成功后经权威重读把服务端更新卡从 available 移入 rejected', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选).mockImplementation(async (_jobId, state) =>
      state === 'rejected' ? [] : [BFF招聘候选推荐样本]);
    await env.操作.加载招聘候选('job_1');
    env.操作.设置发现推荐范围('recruiter', P4范围键.招聘已筛(['job_1']));
    await env.操作.加载招聘已筛(['job_1']);
    vi.mocked(env.数据源.设置招聘候选淘汰).mockResolvedValue({
      ...BFF发现偏好样本, rejected: true, rejection_reason: 'direction_mismatch',
    });
    // 服务端更新卡保留收藏（淘汰不能清收藏）并带权威 state/reason；淘汰的权威重读走详情接口
    const 已淘汰卡: BFF招聘推荐详情 = {
      ...BFF招聘推荐详情样本,
      favorite: true, rejected: true, rejection_reason: 'direction_mismatch', state: 'rejected',
    };
    vi.mocked(env.数据源.读取招聘候选详情).mockResolvedValue(已淘汰卡);

    await env.操作.淘汰候选('job_1', 'rec_r1', 'direction_mismatch');

    expect(vi.mocked(env.数据源.设置招聘候选淘汰))
      .toHaveBeenCalledWith('job_1', 'rec_r1', 'direction_mismatch');
    expect(vi.mocked(env.数据源.读取招聘候选详情)).toHaveBeenCalledWith('job_1', 'rec_r1');
    expect(env.最新状态().招聘可用候选.job_1?.items ?? []).toEqual([]);
    const jobKey = P4范围键.招聘已筛(['job_1']);
    // rejected 快照只装列表卡形状：详情专属正文剥掉，映射层对它必须取列表分支
    const { candidate_resume: _正文, ...已淘汰列表卡 } = 已淘汰卡;
    expect(env.最新状态().招聘已筛候选[jobKey]?.items).toEqual([已淘汰列表卡]);
    expect(从P4招聘候选(env.最新状态().招聘已筛候选[jobKey]!.items[0]).candidateResume).toBeNull();
    // 详情缓存照旧落权威完整正文
    expect(env.最新状态().招聘候选详情.rec_r1).toEqual(已淘汰卡);
  });

  it('同一推荐二次淘汰落位：替换既有 rejected 卡时保留它已展开的 candidate_summary', async () => {
    设主体角色(招聘主体);
    // rejected 快照是 include=candidate_summary 装载的：既有卡带已展开摘要
    vi.mocked(env.数据源.读取招聘候选).mockImplementation(async (_jobId, state) =>
      state === 'rejected'
        ? [{ ...BFF招聘候选推荐样本, candidate_summary: 招聘候选摘要样本 }]
        : []);
    await env.操作.加载招聘候选('job_1');
    env.操作.设置发现推荐范围('recruiter', P4范围键.招聘已筛(['job_1']));
    await env.操作.加载招聘已筛(['job_1']);
    vi.mocked(env.数据源.设置招聘候选淘汰).mockResolvedValue({
      ...BFF发现偏好样本, rejected: true, rejection_reason: 'direction_mismatch',
    });
    // 详情重读没有 candidate_summary 键（include 语法只属于列表）
    const 已淘汰卡: BFF招聘推荐详情 = {
      ...BFF招聘推荐详情样本,
      rejected: true, rejection_reason: 'direction_mismatch', state: 'rejected',
    };
    vi.mocked(env.数据源.读取招聘候选详情).mockResolvedValue(已淘汰卡);

    await env.操作.淘汰候选('job_1', 'rec_r1', 'direction_mismatch');

    const jobKey = P4范围键.招聘已筛(['job_1']);
    // 已展开的摘要保住：替换不能让 rejected 卡的摘要槽凭空消失
    expect(env.最新状态().招聘已筛候选[jobKey]?.items[0]?.candidate_summary)
      .toEqual(招聘候选摘要样本);
  });

  it('撤销淘汰成功只移出 rejected，不回塞当前 available 批次', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选).mockImplementation(async (_jobId, state) =>
      state === 'rejected' ? [BFF招聘候选推荐样本] : []);
    await env.操作.加载招聘候选('job_1');
    env.操作.设置发现推荐范围('recruiter', P4范围键.招聘已筛(['job_1']));
    await env.操作.加载招聘已筛(['job_1']);
    vi.mocked(env.数据源.撤销招聘候选淘汰).mockResolvedValue({
      ...BFF发现偏好样本, rejected: false, rejection_reason: null,
    });

    await env.操作.撤销淘汰候选('job_1', 'rec_r1');

    const jobKey = P4范围键.招聘已筛(['job_1']);
    expect(env.最新状态().招聘已筛候选[jobKey]?.items ?? []).toEqual([]);
    expect(env.最新状态().招聘可用候选.job_1?.items ?? []).toEqual([]); // 等未来批次，不回塞
  });

  it('收藏成功同步 available/rejected/detail 每一处出现', async () => {
    设主体角色(招聘主体);
    // 同一卡同时出现在 available、rejected 聚合与详情缓存：收藏必须全量同步
    vi.mocked(env.数据源.读取招聘候选).mockImplementation(async (_jobId) => [BFF招聘候选推荐样本]);
    await env.操作.加载招聘候选('job_1');
    env.操作.设置发现推荐范围('recruiter', P4范围键.招聘已筛(['job_1']));
    await env.操作.加载招聘已筛(['job_1']);
    await env.操作.读取招聘候选详情('job_1', 'rec_r1');
    vi.mocked(env.数据源.设置招聘候选收藏).mockResolvedValue({
      ...BFF发现偏好样本, favorite: true, rejected: false, rejection_reason: null,
    });

    await env.操作.设置候选收藏('job_1', 'rec_r1', true);

    expect(vi.mocked(env.数据源.设置招聘候选收藏)).toHaveBeenCalledWith('job_1', 'rec_r1', true);
    expect(env.最新状态().招聘可用候选.job_1?.items[0]?.favorite).toBe(true);
    expect(env.最新状态().招聘已筛候选[P4范围键.招聘已筛(['job_1'])]?.items[0]?.favorite).toBe(true);
    expect(env.最新状态().招聘候选详情.rec_r1?.favorite).toBe(true);
  });

  it('反馈只修补自己的字段：详情缓存的 candidate_resume 正文不被列表浅对象覆盖', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选).mockImplementation(async (_jobId) => [BFF招聘候选推荐样本]);
    await env.操作.加载招聘候选('job_1');
    await env.操作.读取招聘候选详情('job_1', 'rec_r1');
    expect(env.最新状态().招聘候选详情.rec_r1?.candidate_resume).toEqual(BFF招聘推荐详情样本.candidate_resume);

    vi.mocked(env.数据源.设置招聘候选收藏).mockResolvedValue({
      ...BFF发现偏好样本, favorite: true, rejected: false, rejection_reason: null,
    });
    await env.操作.设置候选收藏('job_1', 'rec_r1', true);

    // 收藏后详情正文原样保留；同坐标列表卡仍是无正文浅对象
    expect(env.最新状态().招聘候选详情.rec_r1?.candidate_resume).toEqual(BFF招聘推荐详情样本.candidate_resume);
    expect('candidate_resume' in (env.最新状态().招聘可用候选.job_1?.items[0] ?? {})).toBe(false);
  });

  it('详情缺源档（candidate_resume: null）原样入缓存，不折算成列表卡', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选详情).mockResolvedValue(BFF招聘推荐详情无简历样本);
    await env.操作.读取招聘候选详情('job_1', 'rec_r1');
    expect(env.最新状态().招聘候选详情.rec_r1).toEqual(BFF招聘推荐详情无简历样本);
  });

  it('同一推荐的反馈写单飞：在飞期间第二次调用直接返回', async () => {
    设主体角色(招聘主体);
    const 门 = deferred<BFF发现偏好>();
    vi.mocked(env.数据源.设置招聘候选淘汰).mockReturnValue(门.promise);
    const 第一次 = env.操作.淘汰候选('job_1', 'rec_r1', 'other');
    const 第二次 = env.操作.淘汰候选('job_1', 'rec_r1', 'other');
    expect(vi.mocked(env.数据源.设置招聘候选淘汰)).toHaveBeenCalledTimes(1);
    门.resolve({ ...BFF发现偏好样本 });
    await Promise.all([第一次, 第二次]);
    expect(vi.mocked(env.数据源.设置招聘候选淘汰)).toHaveBeenCalledTimes(1);
  });

  it('不同推荐的反馈写可并行', async () => {
    设主体角色(招聘主体);
    const 门 = deferred<BFF发现偏好>();
    vi.mocked(env.数据源.设置招聘候选淘汰).mockReturnValue(门.promise);
    const 甲 = env.操作.淘汰候选('job_1', 'rec_r1', 'other');
    const 乙 = env.操作.淘汰候选('job_1', 'rec_r2', 'other');
    expect(vi.mocked(env.数据源.设置招聘候选淘汰)).toHaveBeenCalledTimes(2);
    门.resolve({ ...BFF发现偏好样本 });
    await Promise.all([甲, 乙]);
  });

  it('反馈 404 按不可用收口：安全移除各处出现并重读 scope，不抛', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选).mockResolvedValueOnce([BFF招聘候选推荐样本]);
    await env.操作.加载招聘候选('job_1');
    await env.操作.读取招聘候选详情('job_1', 'rec_r1');
    vi.mocked(env.数据源.设置招聘候选收藏)
      .mockRejectedValue(new BFF错误(404, 'recommendation_not_found', 'gone'));
    vi.mocked(env.数据源.读取招聘候选).mockResolvedValue([]); // 收口重读：卡已不存在

    await env.操作.设置候选收藏('job_1', 'rec_r1', true);

    expect(env.最新状态().招聘可用候选.job_1?.items ?? []).toEqual([]);
    expect(env.最新状态().招聘候选详情.rec_r1).toBeUndefined();
    expect(env.最新状态().招聘候选不可用).toEqual(['rec_r1']);
    expect(vi.mocked(env.数据源.读取招聘候选)).toHaveBeenCalledTimes(2); // 种子读 + 收口重读
  });
});

describe('复合写锁与委托单飞键的无歧义组装', () => {
  it('含分隔符的 id 不撞写锁：a:b/c 与 a/b:c 是两个资源，各自发写', async () => {
    设主体角色(招聘主体);
    const 门 = deferred<BFF发现偏好>();
    vi.mocked(env.数据源.设置招聘候选淘汰).mockReturnValue(门.promise);

    const 甲 = env.操作.淘汰候选('a:b', 'c', 'other');
    const 乙 = env.操作.淘汰候选('a', 'b:c', 'other');

    expect(vi.mocked(env.数据源.设置招聘候选淘汰)).toHaveBeenCalledTimes(2);
    门.resolve({ ...BFF发现偏好样本 });
    await Promise.all([甲, 乙]);
  });

  it('跨角色不撞写锁：jobId 恰好是 candidate 时招聘写与候选不感兴趣仍各自发写', async () => {
    const 候选门 = deferred<BFF发现偏好>();
    const 招聘门 = deferred<BFF发现偏好>();
    vi.mocked(env.数据源.标记候选岗位不感兴趣).mockReturnValue(候选门.promise);
    vi.mocked(env.数据源.设置招聘候选收藏).mockReturnValue(招聘门.promise);

    const 候选写 = env.操作.标记岗位不感兴趣('int_1', 'rec_x');
    const 招聘写 = env.操作.设置候选收藏('candidate', 'rec_x', true);

    expect(vi.mocked(env.数据源.标记候选岗位不感兴趣)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.设置招聘候选收藏)).toHaveBeenCalledTimes(1);
    候选门.resolve({ ...BFF发现偏好样本, rejected: true, rejection_reason: 'not_interested' });
    招聘门.resolve({ ...BFF发现偏好样本 });
    await Promise.all([候选写, 招聘写]);
  });

  it('同一资源仍单飞：含分隔符的坐标重复调用只发一次写', async () => {
    设主体角色(招聘主体);
    const 门 = deferred<BFF发现偏好>();
    vi.mocked(env.数据源.设置招聘候选淘汰).mockReturnValue(门.promise);

    const 第一次 = env.操作.淘汰候选('a:b', 'c', 'other');
    const 第二次 = env.操作.淘汰候选('a:b', 'c', 'other');

    expect(vi.mocked(env.数据源.设置招聘候选淘汰)).toHaveBeenCalledTimes(1);
    门.resolve({ ...BFF发现偏好样本 });
    await Promise.all([第一次, 第二次]);
  });

  it('含分隔符的 id 不撞委托单飞：两组坐标各发一次 POST，同组坐标仍共享在飞', async () => {
    vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValue([
      { ...BFF候选委托回执样本, state: 'accepted' },
    ]);
    const 输入 = (intentionId: string, jobId: string) =>
      ({ intentionId, recommendationId: 'rec_c1', jobId,
        resumeFileId: 'rf_1', resumeFileVersionId: 'rfv_7', disclosureAcknowledged: true as const });

    await Promise.all([
      env.操作.委托候选岗位(输入('a:b', 'c')),
      env.操作.委托候选岗位(输入('a', 'b:c')),
    ]);
    expect(vi.mocked(env.数据源.创建候选岗位委托)).toHaveBeenCalledTimes(2);

    const 门 = deferred<BFF委托回执[]>();
    vi.mocked(env.数据源.创建候选岗位委托).mockReturnValue(门.promise);
    const 并发 = [env.操作.委托候选岗位(输入('a:b', 'c')), env.操作.委托候选岗位(输入('a:b', 'c'))];
    expect(vi.mocked(env.数据源.创建候选岗位委托)).toHaveBeenCalledTimes(3); // 同 pair 共享在飞
    门.resolve([{ ...BFF候选委托回执样本, state: 'accepted' }]);
    await Promise.all(并发);
  });
});

describe('候选不感兴趣', () => {
  it('回执确认 not_interested 后才从当前 scope 移除', async () => {
    vi.mocked(env.数据源.读取候选岗位推荐).mockResolvedValue([BFF候选岗位推荐样本]);
    await env.操作.加载候选岗位('int_1');
    vi.mocked(env.数据源.标记候选岗位不感兴趣).mockResolvedValue({
      ...BFF发现偏好样本, rejected: true, rejection_reason: 'not_interested',
    });

    await env.操作.标记岗位不感兴趣('int_1', 'rec_c1');

    expect(vi.mocked(env.数据源.标记候选岗位不感兴趣)).toHaveBeenCalledWith('rec_c1');
    expect(env.最新状态().候选岗位推荐.int_1?.items ?? []).toEqual([]);
  });

  it('不感兴趣失败保留卡片并原样抛出', async () => {
    vi.mocked(env.数据源.读取候选岗位推荐).mockResolvedValue([BFF候选岗位推荐样本]);
    await env.操作.加载候选岗位('int_1');
    vi.mocked(env.数据源.标记候选岗位不感兴趣)
      .mockRejectedValue(new BFF错误(503, 'source_unavailable', 'down'));

    await expect(env.操作.标记岗位不感兴趣('int_1', 'rec_c1'))
      .rejects.toMatchObject({ code: 'source_unavailable' });

    expect(env.最新状态().候选岗位推荐.int_1?.items).toEqual([BFF候选岗位推荐样本]);
  });
});

describe('反馈 401 与迟到 401', () => {
  it('反馈 401 走统一清账号状态并清 P4 引用，原样抛出', async () => {
    env.deps.P4幂等意图!.current.set('candidate:list:int_1:refresh', 'idem_1');
    vi.mocked(env.数据源.设置招聘候选淘汰)
      .mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));

    await expect(env.操作.淘汰候选('job_1', 'rec_1', 'other')).rejects.toMatchObject({ status: 401 });

    expect(env.最新状态().已登录).toBe(false);
    expect(env.最新状态().招聘可用候选).toEqual({});
    expect(env.deps.P4幂等意图!.current.size).toBe(0);
    expect(env.派发).toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(env.deps.会话代际.current).toBe(2);
  });

  it('反馈迟到 401 不清新会话', async () => {
    const 门 = deferred<BFF发现偏好>();
    vi.mocked(env.数据源.设置招聘候选淘汰).mockReturnValue(门.promise);
    const 运行 = env.操作.淘汰候选('job_1', 'rec_1', 'other');
    env.deps.主体标识引用.current = 'sub_new';
    env.deps.会话代际.current += 1;
    门.reject(new BFF错误(401, 'invalid_session', 'expired'));

    await 运行; // 迟到成败只释放本轮锁

    expect(env.deps.主体标识引用.current).toBe('sub_new');
    expect(env.最新状态().已登录).toBe(true);
    expect(env.派发).not.toHaveBeenCalledWith({ 型: '清后端组织状态' });
  });
});

describe('P4 闭合错误文案', () => {
  it('P4错误文案 逐码冻结，未知 HTTP code 与非 BFF 错误回落 取后端错误文案', () => {
    expect(P4错误文案(new BFF错误(404, 'recommendation_not_found', 'gone')))
      .toBe('这条推荐当前已不可用，请刷新后查看');
    expect(P4错误文案(new BFF错误(404, 'recommendation_unavailable', 'gone')))
      .toBe('这条推荐当前已不可用，请刷新后查看');
    expect(P4错误文案(new BFF错误(404, 'delegation_not_found', 'gone')))
      .toBe('这次委托已不可用，请刷新后查看');
    expect(P4错误文案(new BFF错误(422, 'disclosure_acknowledgement_required', 'required')))
      .toBe('请先确认简历与联系方式披露说明');
    expect(P4错误文案(new BFF错误(409, 'idempotency_conflict', 'conflict')))
      .toBe('这次操作与之前的请求冲突，请刷新后重试');
    expect(P4错误文案(new BFF错误(503, 'source_unavailable', 'down')))
      .toBe('服务暂时不可用，请稍后再试');
    expect(P4错误文案(new BFF错误(503, 'recruitment_service_unavailable', 'down')))
      .toBe('服务暂时不可用，请稍后再试');
    expect(P4错误文案(new BFF错误(503, 'operation_outcome_unknown', 'unknown')))
      .toBe('操作结果暂未确认，请稍后重试');
    // Task 6 组织错误收敛进闭合表：精确 409 的组织文案不再裸抛后端英文 message
    expect(P4错误文案(new BFF错误(
      409, 'organization_verification_required',
      'A verified organization is required to discover candidates.')))
      .toBe('匿名候选推荐需要已验证的用人组织');
    // 闭合表之外先走 取后端错误文案 的既有分类：network_error / 非 200 的 invalid_response 原样保留
    expect(P4错误文案(new BFF错误(0, 'network_error', '网络连接失败，请稍后再试')))
      .toBe('无法连接后端服务，请检查网络或稍后重试');
    expect(P4错误文案(new BFF错误(409, 'invalid_response', 'raw drift')))
      .toBe('服务返回异常，请稍后重试');
    // status-200 的合成委托/拒绝回执错误带已闭合中文文案：按原样暴露，绝不落通用句
    expect(P4错误文案(new BFF错误(200, 'needs_user', '需要你处理，请查看当前可用入口')))
      .toBe('需要你处理，请查看当前可用入口');
    expect(P4错误文案(new BFF错误(200, 'refused', '本次未能继续，请查看页面状态')))
      .toBe('本次未能继续，请查看页面状态');
    // 闭合表之外、且 取后端错误文案 只能回落原始英文 message 的非 200 错误：
    // 页面不直接显示后端英文（§8）；5xx 按全局安全收口为不可用文案
    expect(P4错误文案(new BFF错误(500, 'unexpected_code', 'boom'))).toBe('后端服务暂时不可用，请稍后重试');
    // P0 修复 Task 6：运行时错误回落通用请求失败文案，不冒充网络故障。
    expect(P4错误文案(new TypeError('x'))).toBe('请求失败，请稍后再试');
  });

  it('P4拒绝文案 与 P4委托终态文案 逐项冻结', () => {
    expect(P4拒绝文案('recommendation_not_found')).toBe('这条推荐当前已不可用，请刷新后查看');
    expect(P4拒绝文案('recommendation_unavailable')).toBe('这条推荐当前已不可用，请刷新后查看');
    expect(P4拒绝文案('recommendation_stale')).toBe('这条推荐已过期，请刷新后查看');
    expect(P4拒绝文案('delegation_not_allowed')).toBe('当前政策或资格不允许发起这次委托');
    expect(P4拒绝文案('active_case_quota_reached')).toBe('当前在谈已达到上限，请先处理已有在谈');
    expect(P4拒绝文案('delegation_cooldown')).toBe('近期已联系过对方，暂时不能重复发起');
    // 终态文案 = 共享状态文案 + 安全下一步提示：不发明动作、failed 不许诺可重试
    expect(P4委托终态文案('needs_user')).toBe('需要你处理，请查看当前可用入口');
    expect(P4委托终态文案('refused')).toBe('本次未能继续，请查看页面状态');
    expect(P4委托终态文案('failed')).toBe('本次处理未完成');
  });

  it('P4委托回执文案 只认合法槽位：refused+拒绝码、failed+失败码、needs_user 双码空；交叉组合是契约漂移', () => {
    const 回执 = (覆盖: Partial<BFF委托回执>): BFF委托回执 => ({ ...BFF候选委托回执样本, ...覆盖 });
    expect(P4委托回执文案(回执({ state: 'refused', refusal_code: 'recommendation_stale', failure_code: null })))
      .toBe('这条推荐已过期，请刷新后查看');
    expect(P4委托回执文案(回执({ state: 'failed', failure_code: 'delegation_evaluation_failed', refusal_code: null })))
      .toBe('本次评估未完成，不代表候选或岗位不合适');
    expect(P4委托回执文案(回执({ state: 'needs_user', refusal_code: null, failure_code: null })))
      .toBe('需要你处理，请查看当前可用入口');
    expect(P4委托回执文案(回执({
      state: 'failed', refusal_code: null, failure_code: 'delegation_agent_unavailable',
    }))).toBe('AI 服务暂时不可用，本次没有创建 Case');
  });
});

describe('委托候选岗位', () => {
  const 候选委托输入 = {
    intentionId: 'int_1',
    recommendationId: 'rec_c1',
    jobId: 'job_1',
    resumeFileId: 'rf_1',
    resumeFileVersionId: 'rfv_7',
    disclosureAcknowledged: true as const,
  };

  async function 种候选卡(): Promise<void> {
    vi.mocked(env.数据源.读取候选岗位推荐).mockResolvedValue([BFF候选岗位推荐样本]);
    await env.操作.加载候选岗位('int_1');
  }

  it('candidate delegation sends only after literal confirmation and records no fake Case', async () => {
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockResolvedValue([{
        ...BFF候选委托回执样本,
        recommendation_id: null, state: 'accepted', case_id: null,
      }]);
    const receipt = await env.操作.委托候选岗位({
      intentionId: 'int_1', recommendationId: 'rec_1', jobId: 'job_1',
      resumeFileId: 'rf_1', resumeFileVersionId: 'rfv_7',
      disclosureAcknowledged: true,
    });
    expect(receipt?.state).toBe('accepted');
    expect(env.最新状态().P4真实Case引用).toEqual({});
    expect(env.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '委托入谈' }));
  });

  it('委托候选岗位原样透传精确简历坐标，绝不代选文件', async () => {
    vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValue([
      { ...BFF候选委托回执样本, delegation_id: 'del_rf1', state: 'accepted' },
    ]);
    await env.操作.委托候选岗位({
      intentionId: 'int_1', recommendationId: 'rec_1', jobId: 'job_1',
      resumeFileId: 'rf_1', resumeFileVersionId: 'rfv_7',
      disclosureAcknowledged: true,
    });
    expect(vi.mocked(env.数据源.创建候选岗位委托)).toHaveBeenCalledWith(expect.objectContaining({
      resumeFileId: 'rf_1',
      resumeFileVersionId: 'rfv_7',
    }));
  });

  it('outcome-uncertain 重放保留同一幂等键与同一简历坐标对（键坐标仍是 intention-job，不随重放漂移）', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('deleg-key-0001'))
      .mockReturnValue(UUID键('deleg-key-0002'));
    const 意图 = delegationKey('candidate:list:int_1', 'job_1');
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(0, 'network_error', 'unknown'))
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'del_k3', state: 'accepted' }]);

    await expect(env.操作.委托候选岗位(候选委托输入)).rejects.toMatchObject({ code: 'network_error' });
    await env.操作.委托候选岗位(候选委托输入);

    const 调用 = vi.mocked(env.数据源.创建候选岗位委托).mock.calls.map((调用) => 调用[0]);
    expect(调用.map((调用) => 调用.idempotencyKey)).toEqual(['deleg-key-0001', 'deleg-key-0001']);
    expect(调用.map((调用) => [调用.resumeFileId, 调用.resumeFileVersionId]))
      .toEqual([['rf_1', 'rfv_7'], ['rf_1', 'rfv_7']]);
    expect(env.deps.P4幂等意图!.current.has(意图)).toBe(false);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    randomUUID.mockRestore();
  });

  it('单飞坐标仍是 intention-job 而非文件：换文件对的并发点击共享同一在飞', async () => {
    const 门 = deferred<BFF委托回执[]>();
    vi.mocked(env.数据源.创建候选岗位委托).mockReturnValue(门.promise);
    const 第一次 = env.操作.委托候选岗位(候选委托输入);
    const 第二次 = env.操作.委托候选岗位({ ...候选委托输入, resumeFileId: 'rf_2', resumeFileVersionId: 'rfv_8' });
    expect(vi.mocked(env.数据源.创建候选岗位委托)).toHaveBeenCalledTimes(1);
    门.resolve([{ ...BFF候选委托回执样本, delegation_id: 'del_sf2', state: 'accepted' }]);
    const [甲, 乙] = await Promise.all([第一次, 第二次]);
    expect(乙).toBe(甲);
  });

  it('创建回执批次必须恰好一条：空批次按契约漂移失败、不落状态、键按不确定保留', async () => {
    vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValue([]);
    await expect(env.操作.委托候选岗位(候选委托输入))
      .rejects.toMatchObject({ code: 'invalid_response' });
    expect(env.最新状态().P4委托回执).toEqual({});
    expect(env.deps.P4幂等意图!.current.has(delegationKey('candidate:list:int_1', 'job_1'))).toBe(true);
    expect(env.派发).not.toHaveBeenCalled();
  });

  it('候选回执 recommendation_id 为 null 或非 null 都按操作输入坐标落卡，回执字段本身原样保存', async () => {
    await 种候选卡();
    vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValueOnce([
      { ...BFF候选委托回执样本, delegation_id: 'del_n1', recommendation_id: null, state: 'accepted' },
    ]);
    await env.操作.委托候选岗位(候选委托输入);
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]).toMatchObject({
      recommendation_id: 'rec_c1',
      state: 'delegating',
      delegation: { delegation_id: 'del_n1', state: 'accepted', case_id: null },
    });
    expect(env.最新状态().P4委托回执.del_n1).toMatchObject({ recommendation_id: null });

    vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValueOnce([
      { ...BFF候选委托回执样本, delegation_id: 'del_n2', recommendation_id: 'rec_别人', state: 'accepted' },
    ]);
    await env.操作.委托候选岗位(候选委托输入);
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]?.delegation)
      .toMatchObject({ delegation_id: 'del_n2' });
    expect(env.最新状态().P4委托回执.del_n2?.recommendation_id).toBe('rec_别人');
  });

  it('evaluating 同样落进行中摘要', async () => {
    await 种候选卡();
    vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValue([
      { ...BFF候选委托回执样本, delegation_id: 'del_ev', state: 'evaluating' },
    ]);
    await env.操作.委托候选岗位(候选委托输入);
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]).toMatchObject({
      state: 'delegating',
      delegation: { delegation_id: 'del_ev', state: 'evaluating', case_id: null },
    });
  });

  it('case_started 必须带非空 case_id，只写 P4真实Case引用，绝不派发任何动作', async () => {
    await 种候选卡();
    vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValue([
      { ...BFF候选委托回执样本, delegation_id: 'del_cs1', state: 'case_started', case_id: 'case_9' },
    ]);
    await env.操作.委托候选岗位(候选委托输入);
    expect(env.最新状态().P4真实Case引用).toEqual({ del_cs1: 'case_9' });
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]).toMatchObject({
      state: 'delegated',
      delegation: { delegation_id: 'del_cs1', state: 'case_started', case_id: 'case_9' },
    });
    expect(env.派发).not.toHaveBeenCalled();
  });

  it('case_started 缺 case_id、非开案状态带 case_id、缺码/交叉错槽组合都是契约漂移且不落状态', async () => {
    await 种候选卡();
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'd1', state: 'case_started', case_id: null }])
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'd2', state: 'accepted', case_id: 'case_x' }])
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'd3', state: 'refused', refusal_code: null, failure_code: null }])
      // 交叉错槽（brief 迁移清单第 2 条：交叉 code 组合归 operation 非法合同用例）：
      // refused/failed 只许带各自码槽的码，其余状态双码皆空 —— 旧「错槽也忽略」语义已不合法
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'd4', state: 'failed', failure_code: 'delegation_failed', refusal_code: 'delegation_cooldown' }])
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'd5', state: 'needs_user', refusal_code: 'delegation_cooldown', failure_code: null }])
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'd6', state: 'refused', refusal_code: 'delegation_cooldown', failure_code: 'delegation_failed' }]);
    for (const 编号 of ['d1', 'd2', 'd3', 'd4', 'd5', 'd6']) {
      await expect(env.操作.委托候选岗位(候选委托输入)).rejects.toMatchObject({ code: 'invalid_response' });
      expect(env.最新状态().P4委托回执[编号]).toBeUndefined();
    }
    expect(env.最新状态().P4真实Case引用).toEqual({});
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]?.delegation ?? null).toBeNull();
  });

  it('needs_user 双码空与 failed+failure_code 恒走安全文案，权威摘要保留在卡上、卡回到 available', async () => {
    await 种候选卡();
    vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValueOnce([
      { ...BFF候选委托回执样本, delegation_id: 'del_in1', state: 'accepted' },
    ]);
    await env.操作.委托候选岗位(候选委托输入);
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]?.delegation).not.toBeNull();

    vi.mocked(env.数据源.创建候选岗位委托)
      .mockResolvedValueOnce([{
        ...BFF候选委托回执样本, delegation_id: 'del_nu',
        state: 'needs_user', refusal_code: null, failure_code: null,
      }])
      .mockResolvedValueOnce([{
        ...BFF候选委托回执样本, delegation_id: 'del_fa',
        state: 'failed', failure_code: 'delegation_evaluation_failed', refusal_code: null,
      }]);
    await expect(env.操作.委托候选岗位(候选委托输入))
      .rejects.toMatchObject({ code: 'needs_user', message: '需要你处理，请查看当前可用入口' });
    await expect(env.操作.委托候选岗位(候选委托输入))
      .rejects.toMatchObject({ code: 'delegation_evaluation_failed', message: '本次评估未完成，不代表候选或岗位不合适' });
    // 屏的 catch 是 轻提示(P4错误文案(error))：state/failure 形式的 code 不在 HTTP 闭合表里，
    // 恰好回落 message —— 终态的闭合文案绝不会被 HTTP 拒绝码文案截胡
    expect(P4错误文案(new BFF错误(200, 'needs_user', '需要你处理，请查看当前可用入口')))
      .toBe('需要你处理，请查看当前可用入口');
    // 六个非空状态都保留权威摘要；终态只是不再进行中 —— 卡业务态回 available
    expect(env.最新状态().P4委托回执.del_nu?.state).toBe('needs_user');
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]).toEqual({
      ...BFF候选岗位推荐样本,
      state: 'available',
      delegation: { delegation_id: 'del_fa', state: 'failed', case_id: null },
    });
    expect(env.最新状态().P4委托回执.del_fa?.state).toBe('failed');
    expect(env.派发).not.toHaveBeenCalled();
  });

  it.each([
    ['delegation_agent_unavailable', 'AI 服务暂时不可用，本次没有创建 Case'],
    ['delegation_evaluation_failed', '本次评估未完成，不代表候选或岗位不合适'],
    ['delegation_failed', '本次委托未完成'],
  ] as const)('terminal failure %s 先落权威 receipt、清进行中摘要，再抛安全文案', async (failure_code, copy) => {
    await 种候选卡();
    vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValue([{
      ...BFF委托失败回执样本,
      failure_code,
    }]);
    await expect(env.操作.委托候选岗位({
      intentionId: 'int_1', recommendationId: 'rec_c1', jobId: 'job_1', resumeFileId: 'rf_1',
      resumeFileVersionId: 'rfv_1', disclosureAcknowledged: true,
    })).rejects.toMatchObject({ status: 200, message: copy });
    expect(env.最新状态().P4委托回执.del_failure_1?.failure_code).toBe(failure_code);
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]?.delegation?.state).toBe('failed');
    expect(env.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '委托入谈' }));
  });

  it('refused 有闭合拒绝码走拒绝码文案并释放意图键，权威摘要保留', async () => {
    await 种候选卡();
    const 意图 = delegationKey('candidate:list:int_1', 'job_1');
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockResolvedValueOnce([{
        ...BFF候选委托回执样本, delegation_id: 'del_r1x',
        state: 'refused', refusal_code: 'active_case_quota_reached', failure_code: null,
      }]);
    await expect(env.操作.委托候选岗位(候选委托输入))
      .rejects.toMatchObject({ code: 'active_case_quota_reached', message: '当前在谈已达到上限，请先处理已有在谈' });
    // 有码：卡上的权威摘要保留 state:refused（具体拒绝文案由页面按回执映射，不落卡）
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]).toEqual({
      ...BFF候选岗位推荐样本,
      state: 'available',
      delegation: { delegation_id: 'del_r1x', state: 'refused', case_id: null },
    });
    expect(env.最新状态().P4委托回执.del_r1x?.state).toBe('refused');
    expect(env.deps.P4幂等意图!.current.has(意图)).toBe(false);
  });

  it('同一 intention-job 对单飞：并发点击共享同一在飞回执', async () => {
    await 种候选卡();
    const 门 = deferred<BFF委托回执[]>();
    vi.mocked(env.数据源.创建候选岗位委托).mockReturnValue(门.promise);
    const 第一次 = env.操作.委托候选岗位(候选委托输入);
    const 第二次 = env.操作.委托候选岗位(候选委托输入);
    expect(vi.mocked(env.数据源.创建候选岗位委托)).toHaveBeenCalledTimes(1);
    门.resolve([{ ...BFF候选委托回执样本, delegation_id: 'del_sf', state: 'accepted' }]);
    const [甲, 乙] = await Promise.all([第一次, 第二次]);
    expect(乙).toBe(甲);
    expect(vi.mocked(env.数据源.创建候选岗位委托)).toHaveBeenCalledTimes(1);
    expect(env.最新状态().P4委托回执.del_sf).toBeDefined();
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]?.delegation)
      .toMatchObject({ delegation_id: 'del_sf' });
  });

  it('不同 intention-job 对可并行，各自回执落各自的卡', async () => {
    vi.mocked(env.数据源.读取候选岗位推荐).mockResolvedValue([
      BFF候选岗位推荐样本,
      { ...BFF候选岗位推荐样本, recommendation_id: 'rec_c2', job: { ...BFFCandidateJob样本, job_id: 'job_2' } },
    ]);
    await env.操作.加载候选岗位('int_1');
    const 甲门 = deferred<BFF委托回执[]>();
    const 乙门 = deferred<BFF委托回执[]>();
    vi.mocked(env.数据源.创建候选岗位委托).mockImplementation(async (输入) =>
      输入.jobId === 'job_1' ? 甲门.promise : 乙门.promise);
    const 甲 = env.操作.委托候选岗位(候选委托输入);
    const 乙 = env.操作.委托候选岗位({ ...候选委托输入, jobId: 'job_2', recommendationId: 'rec_c2' });
    expect(vi.mocked(env.数据源.创建候选岗位委托)).toHaveBeenCalledTimes(2);
    甲门.resolve([{ ...BFF候选委托回执样本, delegation_id: 'del_p1', state: 'accepted' }]);
    乙门.resolve([{ ...BFF候选委托回执样本, delegation_id: 'del_p2', state: 'accepted' }]);
    await Promise.all([甲, 乙]);
    const items = env.最新状态().候选岗位推荐.int_1?.items ?? [];
    expect(items.find((卡) => 卡.recommendation_id === 'rec_c1')?.delegation)
      .toMatchObject({ delegation_id: 'del_p1' });
    expect(items.find((卡) => 卡.recommendation_id === 'rec_c2')?.delegation)
      .toMatchObject({ delegation_id: 'del_p2' });
  });

  it('transport 失败保留意图键，同一意图重试沿用原键，成功才释放', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('deleg-key-0001'))
      .mockReturnValue(UUID键('deleg-key-0002'));
    const 意图 = delegationKey('candidate:list:int_1', 'job_1');
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(0, 'network_error', 'unknown'))
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'del_k1', state: 'accepted' }]);

    await expect(env.操作.委托候选岗位(候选委托输入)).rejects.toMatchObject({ code: 'network_error' });
    expect(env.deps.P4幂等意图!.current.get(意图)).toBe('deleg-key-0001');
    expect(env.最新状态().P4委托回执).toEqual({});

    await env.操作.委托候选岗位(候选委托输入);
    expect(vi.mocked(env.数据源.创建候选岗位委托).mock.calls.map((调用) => 调用[0].idempotencyKey))
      .toEqual(['deleg-key-0001', 'deleg-key-0001']);
    expect(env.deps.P4幂等意图!.current.has(意图)).toBe(false);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    randomUUID.mockRestore();
  });

  it('idempotency_conflict 绝不换键强发：键保留原样抛出，重试沿用直到成功', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('deleg-key-0001'))
      .mockReturnValue(UUID键('deleg-key-0002'));
    const 意图 = delegationKey('candidate:list:int_1', 'job_1');
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(409, 'idempotency_conflict', 'conflict'))
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'del_k2', state: 'accepted' }]);

    await expect(env.操作.委托候选岗位(候选委托输入)).rejects.toMatchObject({ code: 'idempotency_conflict' });
    expect(env.deps.P4幂等意图!.current.get(意图)).toBe('deleg-key-0001');

    await env.操作.委托候选岗位(候选委托输入);
    expect(vi.mocked(env.数据源.创建候选岗位委托).mock.calls.map((调用) => 调用[0].idempotencyKey))
      .toEqual(['deleg-key-0001', 'deleg-key-0001']);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(env.deps.P4幂等意图!.current.has(意图)).toBe(false);
    randomUUID.mockRestore();
  });

  it('委托 401 走统一清账号状态并原样抛出', async () => {
    await 种候选卡();
    env.deps.P4幂等意图!.current.set('candidate:list:int_1:refresh', 'idem_1');
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(env.操作.委托候选岗位(候选委托输入)).rejects.toMatchObject({ status: 401 });
    expect(env.最新状态().已登录).toBe(false);
    expect(env.最新状态().P4委托回执).toEqual({});
    expect(env.deps.P4幂等意图!.current.size).toBe(0);
    expect(env.deps.会话代际.current).toBe(2);
    expect(env.派发).toHaveBeenCalledWith({ 型: '清后端组织状态' });
  });

  it('迟到成功只不落本地：栅栏失效后返回回执但不写状态', async () => {
    await 种候选卡();
    const 门 = deferred<BFF委托回执[]>();
    vi.mocked(env.数据源.创建候选岗位委托).mockReturnValue(门.promise);
    const 运行 = env.操作.委托候选岗位(候选委托输入);
    env.操作.设置发现推荐范围('candidate', P4范围键.候选列表('int_2'));
    门.resolve([{ ...BFF候选委托回执样本, delegation_id: 'del_stale', state: 'accepted' }]);
    await expect(运行).resolves.toMatchObject({ delegation_id: 'del_stale' });
    expect(env.最新状态().P4委托回执).toEqual({});
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]?.delegation ?? null).toBeNull();
  });
});

describe('委托招聘候选', () => {
  async function 种招聘卡(): Promise<void> {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选).mockResolvedValue([BFF招聘候选推荐样本]);
    await env.操作.加载招聘候选('job_1');
  }

  it('recruiter delegation reconciles to the selected recommendation, updates card and detail, sends no disclosure field', async () => {
    await 种招聘卡();
    await env.操作.读取招聘候选详情('job_1', 'rec_r1');
    vi.mocked(env.数据源.创建招聘候选委托).mockResolvedValue([
      { ...BFF招聘委托回执样本, delegation_id: 'del_rr1', state: 'evaluating' },
    ]);
    const 回执 = await env.操作.委托招聘候选('job_1', 'rec_r1');
    expect(回执.state).toBe('evaluating');
    // body separation：招聘侧恰好 job/recommendation/幂等键三个坐标，绝无披露字段
    expect(vi.mocked(env.数据源.创建招聘候选委托)).toHaveBeenCalledWith({
      jobId: 'job_1', recommendationId: 'rec_r1', idempotencyKey: expect.any(String),
    });
    const 摘要 = { delegation_id: 'del_rr1', state: 'evaluating', case_id: null };
    expect(env.最新状态().招聘可用候选.job_1?.items[0]).toMatchObject({
      recommendation_id: 'rec_r1',
      state: 'available', // 招聘卡无 delegating 态：进行中只体现在委托摘要
      delegation: 摘要,
    });
    expect(env.最新状态().招聘候选详情.rec_r1?.delegation).toEqual(摘要);
    expect(env.派发).not.toHaveBeenCalled();
  });

  it('recruiter 回执 recommendation_id 为 null 时按 delegation_id 提交，不算契约漂移', async () => {
    await 种招聘卡();
    vi.mocked(env.数据源.创建招聘候选委托).mockResolvedValue([
      { ...BFF招聘委托回执样本, delegation_id: 'del_rn1', recommendation_id: null, state: 'accepted' },
    ]);

    const 回执 = await env.操作.委托招聘候选('job_1', 'rec_r1');

    expect(回执.state).toBe('accepted');
    expect(env.最新状态().P4委托回执.del_rn1).toMatchObject({ recommendation_id: null });
    expect(env.最新状态().招聘可用候选.job_1?.items[0]?.delegation)
      .toEqual({ delegation_id: 'del_rn1', state: 'accepted', case_id: null });
  });

  it('recruiter receipt recommendation mismatch 按契约漂移失败且不落状态', async () => {
    await 种招聘卡();
    vi.mocked(env.数据源.创建招聘候选委托).mockResolvedValue([
      { ...BFF招聘委托回执样本, recommendation_id: 'rec_别人' },
    ]);
    await expect(env.操作.委托招聘候选('job_1', 'rec_r1')).rejects.toMatchObject({ code: 'invalid_response' });
    expect(env.最新状态().P4委托回执).toEqual({});
    expect(env.最新状态().招聘可用候选.job_1?.items[0]?.delegation ?? null).toBeNull();
  });

  it('recruiter 终态回执同样保留权威摘要：available 卡与详情缓存两处都在，卡业务态不变', async () => {
    await 种招聘卡();
    await env.操作.读取招聘候选详情('job_1', 'rec_r1');
    vi.mocked(env.数据源.创建招聘候选委托)
      .mockResolvedValueOnce([{
        ...BFF招聘委托回执样本, delegation_id: 'del_rnu', state: 'needs_user', refusal_code: null,
      }])
      .mockResolvedValueOnce([{
        ...BFF招聘委托回执样本, delegation_id: 'del_rrf', state: 'refused',
        refusal_code: 'delegation_cooldown',
      }])
      .mockResolvedValueOnce([{
        ...BFF招聘委托回执样本, delegation_id: 'del_rfa', state: 'failed',
        failure_code: 'delegation_failed',
      }]);
    // 三次终态各自落同一张卡：每次落位后卡与详情缓存都带该次的权威摘要
    const 各次: [string, string, BFF委托摘要][] = [
      ['del_rnu', '需要你处理，请查看当前可用入口',
        { delegation_id: 'del_rnu', state: 'needs_user', case_id: null }],
      ['del_rrf', '近期已联系过对方，暂时不能重复发起',
        { delegation_id: 'del_rrf', state: 'refused', case_id: null }],
      ['del_rfa', '本次委托未完成',
        { delegation_id: 'del_rfa', state: 'failed', case_id: null }],
    ];
    for (const [编号, 文案, 摘要] of 各次) {
      await expect(env.操作.委托招聘候选('job_1', 'rec_r1'))
        .rejects.toMatchObject({ message: 文案 });
      expect(env.最新状态().P4委托回执[编号]?.state).toBe(摘要.state);
      expect(env.最新状态().招聘可用候选.job_1?.items[0]?.delegation).toEqual(摘要);
      expect(env.最新状态().招聘候选详情.rec_r1?.delegation).toEqual(摘要);
      expect(env.最新状态().招聘可用候选.job_1?.items[0]?.state).toBe('available');
    }
    expect(env.派发).not.toHaveBeenCalled();
  });

  it('create-time refused 空 ID 显示当前业务拒绝但不写 receipt cache', async () => {
    vi.mocked(env.数据源.创建招聘候选委托).mockResolvedValue([{
      delegation_id: '', recommendation_id: 'rec_1', state: 'refused', evaluation_id: null,
      case_id: null, refusal_code: 'delegation_not_allowed', failure_code: null,
    }]);
    await expect(env.操作.委托招聘候选('job_1', 'rec_1')).rejects.toMatchObject({
      message: '当前政策或资格不允许发起这次委托',
    });
    expect(env.最新状态().P4委托回执['']).toBeUndefined();
  });
});

describe('刷新委托', () => {
  async function 种在途候选委托(): Promise<void> {
    vi.mocked(env.数据源.读取候选岗位推荐).mockResolvedValue([
      {
        ...BFF候选岗位推荐样本,
        state: 'delegating',
        delegation: { delegation_id: 'del_p1', state: 'accepted', case_id: null },
      },
    ]);
    await env.操作.加载候选岗位('int_1');
  }

  it('轮询回执按 delegation_id 落回执表并更新卡片摘要', async () => {
    await 种在途候选委托();
    vi.mocked(env.数据源.读取候选岗位委托).mockResolvedValue(
      { ...BFF候选委托回执样本, delegation_id: 'del_p1', state: 'evaluating' });
    await env.操作.刷新委托('candidate', 'del_p1');
    expect(vi.mocked(env.数据源.读取候选岗位委托)).toHaveBeenCalledWith('del_p1');
    expect(env.最新状态().P4委托回执.del_p1).toMatchObject({ state: 'evaluating' });
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]?.delegation)
      .toEqual({ delegation_id: 'del_p1', state: 'evaluating', case_id: null });
  });

  it('轮询到 case_started 写 Case 引用并把卡摘要换成终态', async () => {
    await 种在途候选委托();
    vi.mocked(env.数据源.读取候选岗位委托).mockResolvedValue(
      { ...BFF候选委托回执样本, delegation_id: 'del_p1', state: 'case_started', case_id: 'case_77' });
    await env.操作.刷新委托('candidate', 'del_p1');
    expect(env.最新状态().P4真实Case引用).toEqual({ del_p1: 'case_77' });
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]).toMatchObject({
      state: 'delegated',
      delegation: { state: 'case_started', case_id: 'case_77' },
    });
    expect(env.派发).not.toHaveBeenCalled();
  });

  it('轮询到终态保留权威摘要并把卡业务态回 available，resolve 不抛（轮询不把已接手改成失败）', async () => {
    await 种在途候选委托();
    vi.mocked(env.数据源.读取候选岗位委托).mockResolvedValue(
      { ...BFF候选委托回执样本, delegation_id: 'del_p1', state: 'refused', refusal_code: 'delegation_cooldown' });
    await expect(env.操作.刷新委托('candidate', 'del_p1')).resolves.toBeUndefined();
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]).toEqual({
      ...BFF候选岗位推荐样本,
      state: 'available',
      delegation: { delegation_id: 'del_p1', state: 'refused', case_id: null },
    });
    expect(env.最新状态().P4委托回执.del_p1?.state).toBe('refused');
  });

  it.each([
    { state: 'needs_user', refusal_code: null, failure_code: null },
    { state: 'refused', refusal_code: 'delegation_cooldown', failure_code: null },
    { state: 'failed', refusal_code: null, failure_code: 'delegation_failed' },
  ] as const)('轮询把 evaluating 推进到 $state：摘要保留权威 state，卡回 available', async ({ state, ...码 }) => {
    vi.mocked(env.数据源.读取候选岗位推荐).mockResolvedValue([
      {
        ...BFF候选岗位推荐样本,
        state: 'delegating',
        delegation: { delegation_id: 'del_ev', state: 'evaluating', case_id: null },
      },
    ]);
    await env.操作.加载候选岗位('int_1');
    vi.mocked(env.数据源.读取候选岗位委托).mockResolvedValue(
      { ...BFF候选委托回执样本, delegation_id: 'del_ev', state, ...码 });
    await expect(env.操作.刷新委托('candidate', 'del_ev')).resolves.toBeUndefined();
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]).toEqual({
      ...BFF候选岗位推荐样本,
      state: 'available',
      delegation: { delegation_id: 'del_ev', state, case_id: null },
    });
    expect(env.最新状态().P4委托回执.del_ev?.state).toBe(state);
  });

  it('招聘侧轮询到终态同样保留摘要：available 卡业务态不变', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选).mockResolvedValue([
      {
        ...BFF招聘候选推荐样本,
        state: 'available',
        delegation: { delegation_id: 'del_rp', state: 'accepted', case_id: null },
      },
    ]);
    await env.操作.加载招聘候选('job_1');
    vi.mocked(env.数据源.读取招聘候选委托).mockResolvedValue(
      { ...BFF招聘委托回执样本, delegation_id: 'del_rp', state: 'failed', failure_code: 'delegation_failed' });
    await expect(env.操作.刷新委托('recruiter', 'del_rp')).resolves.toBeUndefined();
    expect(env.最新状态().招聘可用候选.job_1?.items[0]?.delegation)
      .toEqual({ delegation_id: 'del_rp', state: 'failed', case_id: null });
    expect(env.最新状态().招聘可用候选.job_1?.items[0]?.state).toBe('available');
    expect(env.最新状态().P4委托回执.del_rp?.state).toBe('failed');
  });

  it('轮询 404 统一不可用收口：摘掉各处摘要并删除回执行，不抛', async () => {
    await 种在途候选委托();
    env.deps.后端状态引用.current = {
      ...env.deps.后端状态引用.current,
      P4委托回执: { del_p1: { ...BFF候选委托回执样本, delegation_id: 'del_p1' } },
    };
    vi.mocked(env.数据源.读取候选岗位委托)
      .mockRejectedValue(new BFF错误(404, 'delegation_not_found', 'gone'));
    await expect(env.操作.刷新委托('candidate', 'del_p1')).resolves.toBeUndefined();
    expect(env.最新状态().P4委托回执).toEqual({});
    expect(env.最新状态().候选岗位推荐.int_1?.items[0]).toMatchObject({ state: 'available', delegation: null });
  });

  it('delegation GET 不取创建单飞：创建在飞时权威 GET 照发', async () => {
    const 门 = deferred<BFF委托回执[]>();
    vi.mocked(env.数据源.创建候选岗位委托).mockReturnValue(门.promise);
    const 创建 = env.操作.委托候选岗位({
      intentionId: 'int_1', recommendationId: 'rec_c1', jobId: 'job_1',
      resumeFileId: 'rf_1', resumeFileVersionId: 'rfv_7', disclosureAcknowledged: true,
    });
    await env.操作.刷新委托('candidate', 'del_c1'); // 默认桩的回执编号，证明 GET 真的发出去并结算
    expect(vi.mocked(env.数据源.读取候选岗位委托)).toHaveBeenCalledWith('del_c1');
    门.resolve([{ ...BFF候选委托回执样本, delegation_id: 'del_g2', state: 'accepted' }]);
    await 创建;
  });

  it('刷新委托 401 走统一清理且不向轮询抛出', async () => {
    vi.mocked(env.数据源.读取候选岗位委托)
      .mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(env.操作.刷新委托('candidate', 'del_p1')).resolves.toBeUndefined();
    expect(env.最新状态().已登录).toBe(false);
    expect(env.最新状态().P4委托回执).toEqual({});
    expect(env.deps.会话代际.current).toBe(2);
  });

  it('迟到的轮询完成只丢弃：scope 变更后成败都不落', async () => {
    const 门 = deferred<BFF委托回执>();
    vi.mocked(env.数据源.读取候选岗位委托).mockReturnValue(门.promise);
    const 运行 = env.操作.刷新委托('candidate', 'del_p9');
    env.操作.设置发现推荐范围('candidate', P4范围键.候选列表('int_2'));
    门.resolve({ ...BFF候选委托回执样本, delegation_id: 'del_p9', state: 'case_started', case_id: 'case_late' });
    await 运行;
    expect(env.最新状态().P4真实Case引用).toEqual({});
    expect(env.最新状态().P4委托回执).toEqual({});
  });

  it('招聘侧轮询按 delegation_id 落到 available 卡并写 Case 引用', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选).mockResolvedValue([
      {
        ...BFF招聘候选推荐样本,
        state: 'available',
        delegation: { delegation_id: 'del_rp', state: 'accepted', case_id: null },
      },
    ]);
    await env.操作.加载招聘候选('job_1');
    vi.mocked(env.数据源.读取招聘候选委托).mockResolvedValue(
      { ...BFF招聘委托回执样本, delegation_id: 'del_rp', state: 'case_started', case_id: 'case_r1' });
    await env.操作.刷新委托('recruiter', 'del_rp');
    expect(vi.mocked(env.数据源.读取招聘候选委托)).toHaveBeenCalledWith('del_rp');
    expect(env.最新状态().招聘可用候选.job_1?.items[0]?.delegation)
      .toEqual({ delegation_id: 'del_rp', state: 'case_started', case_id: 'case_r1' });
    expect(env.最新状态().P4真实Case引用).toEqual({ del_rp: 'case_r1' });
  });
});

// ── Task 6：组织认证竞态对账 —— 精确组织 409 终止 POST，只做一次 Owner Jobs 权威重读 ──
//    不变量（设计 §7/§8/§9.4）：每个用户意图最多一次 refresh POST + 一次 Owner Jobs GET；
//    绝不换幂等键重发；迟到成败整包丢弃；栅栏内 401 走统一清会话；除精确组织 409 外
//    的一切直接失败零重读。

describe('组织认证竞态对账（一次 Owner Jobs 重读）', () => {
  /** Task 5 strict contract 铸出的精确组织 409（仅 recruiter refresh 路由透传该码）。 */
  const 组织409 = () => new BFF错误(
    409, 'organization_verification_required',
    'A verified organization is required to discover candidates.');
  const 岗位页 = (服务端: Record<string, BFFOwnerJob>): 页面岗位快照 => ({ 列表: [], 服务端 });

  it.each([
    ['unverified', BFF岗位样本],
    ['missing ref', {
      ...BFF岗位样本, hiring_organization_verification_status: 'verified' as const,
    }],
  ] as const)('精确组织 409 + 权威重读 %s：一次 POST、一次读取岗位、水合一次并替换岗位快照，原组织错误照抛', async (_名, ownerJob) => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.刷新招聘候选).mockRejectedValueOnce(组织409());
    const 快照 = 岗位页({ job_1: { ...ownerJob, job_id: 'job_1' } });
    vi.mocked(env.数据源.读取岗位).mockResolvedValueOnce(快照);

    await expect(env.操作.刷新招聘候选('job_1')).rejects.toMatchObject({
      status: 409, code: 'organization_verification_required',
    });

    expect(vi.mocked(env.数据源.刷新招聘候选)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.读取岗位)).toHaveBeenCalledTimes(1);
    expect(env.派发).toHaveBeenCalledTimes(1);
    expect(env.派发).toHaveBeenCalledWith({ 型: '水合后端岗位', 快照 });
    expect(env.最新状态().岗位快照).toEqual(快照.服务端);
    // 运行范围刷新 的 POST 失败路径已把组织文案落进快照；对账确认受阻后不再二次落
    expect(env.最新状态().招聘可用候选.job_1?.error).toBe('匿名候选推荐需要已验证的用人组织');
    // 组织 409 绝不换幂等键重发：同一意图的键原样保留
    expect(env.deps.P4幂等意图!.current.has('recruiter:list:job_1:refresh')).toBe(true);
  });

  it('权威重读后仍 verified + ref：一次 POST、一次读取岗位、零二次 POST，invalid_response 带中文「数据状态异常」', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.刷新招聘候选).mockRejectedValueOnce(组织409());
    vi.mocked(env.数据源.读取岗位).mockResolvedValueOnce(岗位页({
      job_1: {
        ...BFF岗位样本, hiring_organization_verification_status: 'verified' as const,
        hiring_organization_ref: 'org_1',
      },
    }));

    await expect(env.操作.刷新招聘候选('job_1')).rejects.toMatchObject({
      status: 409, code: 'invalid_response', message: '数据状态异常，请稍后再试',
    });

    expect(vi.mocked(env.数据源.刷新招聘候选)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.读取岗位)).toHaveBeenCalledTimes(1);
    expect(env.派发).toHaveBeenCalledTimes(1); // 权威 owner 页照常水合
    expect(env.最新状态().岗位快照).toEqual({
      job_1: {
        ...BFF岗位样本, hiring_organization_verification_status: 'verified' as const,
        hiring_organization_ref: 'org_1',
      },
    });
    // 仍 ready = 合同漂移：持久快照改述真实收口，绝不再留组织受阻文案
    expect(env.最新状态().招聘可用候选.job_1?.error).toBe('数据状态异常，请稍后再试');
  });

  it('权威重读页里没有所请求的岗位：按 invalid_response 收口，不是组织 CTA', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.刷新招聘候选).mockRejectedValueOnce(组织409());
    vi.mocked(env.数据源.读取岗位).mockResolvedValueOnce(岗位页({}));

    const 捕获 = await env.操作.刷新招聘候选('job_1').catch((错误: unknown) => 错误);

    expect(捕获).toMatchObject({
      status: 409, code: 'invalid_response', message: '数据状态异常，请稍后再试',
    });
    expect(vi.mocked(env.数据源.刷新招聘候选)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.读取岗位)).toHaveBeenCalledTimes(1);
    expect(env.派发).toHaveBeenCalledTimes(1); // 权威页水合照常：所请求岗位确实不在页里
    expect(env.最新状态().岗位快照).toEqual({});
    expect(env.最新状态().招聘可用候选.job_1?.error).toBe('数据状态异常，请稍后再试');
  });

  it('对账重读 401 且原栅栏仍新：走统一清账号状态，不再向屏叠抛', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.刷新招聘候选).mockRejectedValueOnce(组织409());
    vi.mocked(env.数据源.读取岗位).mockRejectedValueOnce(new BFF错误(401, 'invalid_session', 'expired'));

    await expect(env.操作.刷新招聘候选('job_1')).resolves.toBeUndefined();

    expect(vi.mocked(env.数据源.刷新招聘候选)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.读取岗位)).toHaveBeenCalledTimes(1);
    expect(env.最新状态().已登录).toBe(false);
    expect(env.最新状态().主体).toBeNull();
    expect(env.最新状态().招聘可用候选).toEqual({});
    expect(env.deps.会话代际.current).toBe(2);
    expect(env.deps.P4幂等意图!.current.size).toBe(0);
    expect(env.数据源.清空目录缓存).toHaveBeenCalled();
  });

  it('对账重读 503：无水合、岗位快照不动，通用可恢复错误落快照并照抛', async () => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.刷新招聘候选).mockRejectedValueOnce(组织409());
    vi.mocked(env.数据源.读取岗位).mockRejectedValueOnce(new BFF错误(503, 'source_unavailable', 'down'));

    await expect(env.操作.刷新招聘候选('job_1')).rejects.toMatchObject({
      status: 503, code: 'source_unavailable',
    });

    expect(vi.mocked(env.数据源.刷新招聘候选)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.读取岗位)).toHaveBeenCalledTimes(1);
    expect(env.派发).not.toHaveBeenCalled();
    expect(env.最新状态().岗位快照).toEqual({});
    expect(env.最新状态().招聘可用候选.job_1?.error).toBe('服务暂时不可用，请稍后再试');
    expect(env.最新状态().已登录).toBe(true);
  });

  // 栅栏五维（设计 §8）：subject / active role / session generation / visible scope /
  // scope generation —— 任一换代后，对账重读的迟到结果整包丢弃
  const 换代表: readonly [string, () => void][] = [
    ['换主体', () => { env.deps.主体标识引用.current = 'sub_new'; }],
    ['换角色', () => { 设主体角色(候选主体); }],
    ['会话换代', () => { env.deps.会话代际.current += 1; }],
    ['换可见范围', () => {
      env.deps.P4可见范围!.current = { ...env.deps.P4可见范围!.current, recruiter: 'recruiter:list:job_9' };
    }],
    ['scope 代际 +1', () => {
      const 键 = P4范围键.招聘列表('job_1');
      env.deps.P4范围代际!.current.set(键, (env.deps.P4范围代际!.current.get(键) ?? 0) + 1);
    }],
  ];

  it.each(换代表)('对账重读在飞时%s：迟到成功整包丢弃 —— 不水合、不写快照、不抛组织错', async (_名, 换代) => {
    设主体角色(招聘主体);
    const POST门 = deferred<BFF发现批次>();
    const 重读门 = deferred<页面岗位快照>();
    vi.mocked(env.数据源.刷新招聘候选).mockReturnValueOnce(POST门.promise);
    vi.mocked(env.数据源.读取岗位).mockReturnValueOnce(重读门.promise);
    const 运行 = env.操作.刷新招聘候选('job_1');
    POST门.reject(组织409());
    await POST门.promise.catch(() => undefined); // 对账重读已在飞
    const 提交数 = 设后端状态调用数();
    换代();
    重读门.resolve(岗位页({ job_1: BFF岗位样本 })); // 权威页说组织受阻

    await expect(运行).resolves.toBeUndefined();

    expect(vi.mocked(env.数据源.刷新招聘候选)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.读取岗位)).toHaveBeenCalledTimes(1);
    expect(设后端状态调用数()).toBe(提交数); // 迟到成功零写入
    expect(env.派发).not.toHaveBeenCalled(); // 无水合 = 屏上不出现组织 CTA 信号
    expect(env.最新状态().岗位快照).toEqual({});
  });

  it.each(换代表)('对账重读在飞时%s：迟到 401 不清新会话也不写状态', async (_名, 换代) => {
    设主体角色(招聘主体);
    const POST门 = deferred<BFF发现批次>();
    const 重读门 = deferred<页面岗位快照>();
    vi.mocked(env.数据源.刷新招聘候选).mockReturnValueOnce(POST门.promise);
    vi.mocked(env.数据源.读取岗位).mockReturnValueOnce(重读门.promise);
    const 运行 = env.操作.刷新招聘候选('job_1');
    POST门.reject(组织409());
    await POST门.promise.catch(() => undefined); // 对账重读已在飞
    const 提交数 = 设后端状态调用数();
    换代();
    重读门.reject(new BFF错误(401, 'invalid_session', 'expired'));

    await expect(运行).resolves.toBeUndefined();

    expect(vi.mocked(env.数据源.刷新招聘候选)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.读取岗位)).toHaveBeenCalledTimes(1);
    expect(设后端状态调用数()).toBe(提交数);
    expect(env.最新状态().已登录).toBe(true);
    expect(env.派发).not.toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(env.数据源.清空目录缓存).not.toHaveBeenCalled();
  });

  it('对账重读在飞时第二次点击让路：不重复 POST、不发起第二次 Owner Jobs 重读', async () => {
    设主体角色(招聘主体);
    const POST门 = deferred<BFF发现批次>();
    const 重读门 = deferred<页面岗位快照>();
    vi.mocked(env.数据源.刷新招聘候选).mockReturnValueOnce(POST门.promise);
    vi.mocked(env.数据源.读取岗位).mockReturnValueOnce(重读门.promise);
    const 第一次 = env.操作.刷新招聘候选('job_1');
    POST门.reject(组织409());
    await POST门.promise.catch(() => undefined); // 对账重读已在飞（此时读锁已被 finally 释放）

    // 窗口期内同一未结算意图的第二次点击：让路收场，绝不沿用保留键重复 POST
    await expect(env.操作.刷新招聘候选('job_1')).resolves.toBeUndefined();
    expect(vi.mocked(env.数据源.刷新招聘候选)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.读取岗位)).toHaveBeenCalledTimes(1);

    重读门.resolve(岗位页({ job_1: BFF岗位样本 })); // 权威页说组织受阻
    await expect(第一次).rejects.toMatchObject({
      status: 409, code: 'organization_verification_required',
    });

    // 第一次的对账照常结算：一次 POST、一次重读、一次水合，键仍按组织 409 语义保留
    expect(vi.mocked(env.数据源.刷新招聘候选)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.读取岗位)).toHaveBeenCalledTimes(1);
    expect(env.派发).toHaveBeenCalledTimes(1);
    expect(env.deps.P4幂等意图!.current.has('recruiter:list:job_1:refresh')).toBe(true);
  });

  it.each([
    ['recommendation_unavailable', new BFF错误(409, 'recommendation_unavailable', 'gone')],
    ['invalid_response（合同漂移）', new BFF错误(409, 'invalid_response', 'drift')],
    ['401', new BFF错误(401, 'invalid_session', 'expired')],
    ['503', new BFF错误(503, 'source_unavailable', 'down')],
  ] as const)('%s 直接失败零 Owner Jobs 重读，一次 POST 原样收口', async (_名, 错误) => {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.刷新招聘候选).mockRejectedValueOnce(错误);

    await expect(env.操作.刷新招聘候选('job_1')).rejects.toMatchObject({
      status: 错误.status, code: 错误.code,
    });

    expect(vi.mocked(env.数据源.刷新招聘候选)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.读取岗位)).not.toHaveBeenCalled();
  });
});

// ── Task 5：开案成功 → P5 open 工作区失效 ────────────────────────────────────
// 只失效、不立刻 GET：移除匹配 owner 的 open 工作区槽 + 读代际 +1（旧在飞读因此过期，
// 不会把旧空列表重新落成成功缓存）。accepted/evaluating/缺 case_id 一律不触发。
describe('创建发现推荐操作 · 开案成功让 P5 open 工作区失效', () => {
  const 候选委托输入 = {
    intentionId: 'int_1',
    recommendationId: 'rec_c1',
    jobId: 'job_1',
    resumeFileId: 'rf_1',
    resumeFileVersionId: 'rfv_7',
    disclosureAcknowledged: true as const,
  };

  async function 种候选卡(): Promise<void> {
    vi.mocked(env.数据源.读取候选岗位推荐).mockResolvedValue([BFF候选岗位推荐样本]);
    await env.操作.加载候选岗位('int_1');
  }

  async function 种招聘卡(): Promise<void> {
    设主体角色(招聘主体);
    vi.mocked(env.数据源.读取招聘候选).mockResolvedValue([BFF招聘候选推荐样本]);
    await env.操作.加载招聘候选('job_1');
  }

  async function 种在途候选委托(): Promise<void> {
    vi.mocked(env.数据源.读取候选岗位推荐).mockResolvedValue([
      {
        ...BFF候选岗位推荐样本,
        state: 'delegating',
        delegation: { delegation_id: 'del_p1', state: 'accepted', case_id: null },
      },
    ]);
    await env.操作.加载候选岗位('int_1');
  }

  const 成功空工作区 = (ownerSubjectId: string | null) => ({
    ownerSubjectId, 阶段: '成功' as const, 刷新中: false,
    items: [], nextCursor: null, 已加载页数: 1, error: null, generation: 1,
  });

  const 种P5工作区 = (表: Record<string, ReturnType<typeof 成功空工作区>>) => {
    env.deps.设后端状态((旧) => ({ ...旧, P5工作区: { ...旧.P5工作区, ...表 } }));
  };

  const 读代际 = (键: string) => env.deps.P5范围代际!.current.get(`${键}#读`);

  it('候选创建直接成功：失效本意向档与全部档，别的意向仍缓存', async () => {
    await 种候选卡();
    const 本档 = 'p5:open:candidate:int_1';
    const 全部 = 'p5:open:candidate:*';
    const 别档 = 'p5:open:candidate:int_2';
    种P5工作区({
      [本档]: 成功空工作区('sub_1'), [全部]: 成功空工作区('sub_1'), [别档]: 成功空工作区('sub_1'),
    });
    vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValue([
      { ...BFF候选委托回执样本, delegation_id: 'del_ok', state: 'case_started', case_id: 'case_ok' },
    ]);
    await env.操作.委托候选岗位(候选委托输入);
    expect(env.最新状态().P5工作区[本档]).toBeUndefined();
    expect(env.最新状态().P5工作区[全部]).toBeUndefined();
    expect(env.最新状态().P5工作区[别档]).toBeDefined();
    expect(读代际(本档)).toBe(1);
    expect(读代际(全部)).toBe(1);
  });

  it('招聘创建直接成功：失效本岗档与全部档', async () => {
    设主体角色(招聘主体);
    await 种招聘卡();
    const 本档 = 'p5:open:recruiter:job_1';
    const 全部 = 'p5:open:recruiter:*';
    种P5工作区({ [本档]: 成功空工作区('sub_1'), [全部]: 成功空工作区('sub_1') });
    vi.mocked(env.数据源.创建招聘候选委托).mockResolvedValue([
      { ...BFF招聘委托回执样本, delegation_id: 'del_rok', state: 'case_started', case_id: 'case_rok' },
    ]);
    await env.操作.委托招聘候选('job_1', 'rec_r1');
    expect(env.最新状态().P5工作区[本档]).toBeUndefined();
    expect(env.最新状态().P5工作区[全部]).toBeUndefined();
  });

  it('accepted / evaluating / 缺 case_id 都不失效任何 P5 缓存', async () => {
    const 本档 = 'p5:open:candidate:int_1';
    const 全部 = 'p5:open:candidate:*';
    for (const 回执 of [
      { delegation_id: 'del_a', state: 'accepted' as const, case_id: null },
      { delegation_id: 'del_e', state: 'evaluating' as const, case_id: null },
    ]) {
      env = 创建P4操作测试环境();
      env.操作.设置发现推荐范围('candidate', P4范围键.候选列表('int_1'));
      await 种候选卡();
      种P5工作区({ [本档]: 成功空工作区('sub_1'), [全部]: 成功空工作区('sub_1') });
      vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValue([
        { ...BFF候选委托回执样本, ...回执 },
      ]);
      await env.操作.委托候选岗位(候选委托输入);
      expect(env.最新状态().P5工作区[本档]).toBeDefined();
      expect(env.最新状态().P5工作区[全部]).toBeDefined();
    }
  });

  it('轮询到 case_started：按旧卡的 delegation_id 反查关联意向档并失效', async () => {
    await 种在途候选委托();
    const 本档 = 'p5:open:candidate:int_1';
    const 全部 = 'p5:open:candidate:*';
    种P5工作区({ [本档]: 成功空工作区('sub_1'), [全部]: 成功空工作区('sub_1') });
    vi.mocked(env.数据源.读取候选岗位委托).mockResolvedValue(
      { ...BFF候选委托回执样本, delegation_id: 'del_p1', state: 'case_started', case_id: 'case_77' });
    await env.操作.刷新委托('candidate', 'del_p1');
    expect(env.最新状态().P5工作区[本档]).toBeUndefined();
    expect(env.最新状态().P5工作区[全部]).toBeUndefined();
  });

  it('同一 delegation + case_id 的重复成功回执不再触发失效（无刷新风暴）', async () => {
    await 种在途候选委托();
    const 全部 = 'p5:open:candidate:*';
    种P5工作区({ [全部]: 成功空工作区('sub_1') });
    vi.mocked(env.数据源.读取候选岗位委托).mockResolvedValue(
      { ...BFF候选委托回执样本, delegation_id: 'del_p1', state: 'case_started', case_id: 'case_77' });
    await env.操作.刷新委托('candidate', 'del_p1');
    const 第一次代际 = 读代际(全部);
    // 缓存重新落成后再收到同一条回执：读代际不再变化
    种P5工作区({ [全部]: 成功空工作区('sub_1') });
    await env.操作.刷新委托('candidate', 'del_p1');
    expect(读代际(全部)).toBe(第一次代际);
    expect(env.最新状态().P5工作区[全部]).toBeDefined();
  });

  it('主体在飞期间已换：陈旧成功回执不失效新主体的工作区', async () => {
    await 种候选卡();
    const 全部 = 'p5:open:candidate:*';
    种P5工作区({ [全部]: 成功空工作区('sub_1') });
    let 放行!: (值: unknown) => void;
    vi.mocked(env.数据源.创建候选岗位委托).mockReturnValue(new Promise((ok) => {
      放行 = () => ok([{
        ...BFF候选委托回执样本, delegation_id: 'del_late', state: 'case_started', case_id: 'case_late',
      }]);
    }) as never);
    const 写 = env.操作.委托候选岗位(候选委托输入);
    env.deps.主体标识引用.current = 'sub_2';
    放行(undefined);
    await 写.catch(() => undefined);
    expect(env.最新状态().P5工作区[全部]).toBeDefined();
  });
});

// ── J-PILOT-01 Task 3（Spec §8）：委托 create 的原命令冻结、失败核对与回执收口 ──

describe('J-PILOT-01 Task 3：委托待核对命令（create）', () => {
  const 候选委托输入 = {
    intentionId: 'int_1',
    recommendationId: 'rec_c1',
    jobId: 'job_1',
    resumeFileId: 'rf_1',
    resumeFileVersionId: 'rfv_7',
    disclosureAcknowledged: true as const,
  };

  /** POST 悬而未决的门：证明「保存 B 命令后才发 POST」的发送前冻结顺序。 */
  function 悬置POST() {
    let 放行!: (值: BFF委托回执[]) => void;
    vi.mocked(env.数据源.创建候选岗位委托).mockReturnValue(new Promise((ok) => {
      放行 = ok;
    }) as never);
    return () => 放行([{ ...BFF候选委托回执样本, delegation_id: 'del_frozen' }]);
  }

  it('发送前冻结原命令：POST 悬而未决时内存与 owner 存储已持有原 key/body', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('frozen-key-0001'));
    const 放行 = 悬置POST();
    const 写 = env.操作.委托候选岗位(候选委托输入);
    await Promise.resolve(); // POST 门未放行：冻结必须已完成
    const 期望命令: 待核对命令 = {
      operation: 'create',
      key: 'frozen-key-0001',
      intention_id: 'int_1',
      selection: { items: [{ job_id: 'job_1' }] },
      resume_file_id: 'rf_1',
      resume_file_version_id: 'rfv_7',
      disclosure_acknowledged: true,
    };
    expect(env.委托待核对内存.current.get('create:int_1:job_1')).toEqual(期望命令);
    expect(读取待核对(env.委托待核对存储.current!.storage, 待核对owner).命令).toEqual([期望命令]);
    放行();
    await 写;
    expect(env.委托待核对内存.current.size).toBe(0); // 收口后未决命令删除
    randomUUID.mockRestore();
  });

  it('POST 无响应→硬刷新→原 body/key 完整重放：新环境零新键、逐字段比较完整 body', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('orig-key-0001'))
      .mockReturnValue(UUID键('fresh-key-0002'));
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(0, 'network_error', 'unknown'));
    await expect(env.操作.委托候选岗位(候选委托输入))
      .rejects.toMatchObject({ code: 'network_error' });
    // 未决命令在内存与存储都在场（普通页面 scope 清理不删它）
    expect(env.操作.取候选待核对命令('int_1', 'job_1')).toMatchObject({ key: 'orig-key-0001' });
    const 共享存储 = env.委托待核对存储.current!.storage!;
    expect(读取待核对(共享存储, 待核对owner).命令).toHaveLength(1);

    // 硬刷新 = 同一 owner 存储、全新内存表 + 全新幂等意图表
    const env2 = 创建P4操作测试环境({ 待核对存储: 共享存储 });
    expect(env2.操作.取候选待核对命令('int_1', 'job_1')).toMatchObject({ key: 'orig-key-0001' });
    await env2.操作.核对候选委托('int_1', 'job_1');
    // 完整 body 逐字段一致（不只同 key）：从固定命令生成请求，不再次读取 PDF latest/推荐 top
    expect(vi.mocked(env2.数据源.创建候选岗位委托).mock.calls).toEqual([[{
      intentionId: 'int_1', jobId: 'job_1',
      resumeFileId: 'rf_1', resumeFileVersionId: 'rfv_7',
      idempotencyKey: 'orig-key-0001', disclosureAcknowledged: true,
    }]]);
    // 重放回执收口：pending 删除（成功回读持久记录后）
    expect(env2.操作.取候选待核对命令('int_1', 'job_1')).toBeNull();
    expect(读取待核对(共享存储, 待核对owner).命令).toEqual([]);
    randomUUID.mockRestore();
  });

  it('同 job 不等于原命令：别的意向下零核对 POST，也不挡它自己的新命令', async () => {
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(0, 'network_error', 'unknown'));
    await expect(env.操作.委托候选岗位(候选委托输入)).rejects.toMatchObject({ code: 'network_error' });
    expect(env.操作.取候选待核对命令('int_1', 'job_1')).not.toBeNull();

    // int_2 下同一 job_1：绝不能按同 job 认定命中 —— 零 POST
    await env.操作.核对候选委托('int_2', 'job_1');
    expect(env.数据源.创建候选岗位委托).toHaveBeenCalledTimes(1);

    // int_2 的 fresh 委托是另一个命令目标：照常另起命令
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'del_int2' }]);
    await env.操作.委托候选岗位({ ...候选委托输入, intentionId: 'int_2' });
    expect(vi.mocked(env.数据源.创建候选岗位委托).mock.calls[1][0]).toMatchObject({ intentionId: 'int_2' });
    expect(env.操作.取候选待核对命令('int_2', 'job_1')).toBeNull();
  });

  it('无未决命令时核对口零请求（取消零 POST）', async () => {
    await env.操作.核对候选委托('int_1', 'job_1');
    expect(env.数据源.创建候选岗位委托).not.toHaveBeenCalled();
    expect(env.数据源.读取候选岗位推荐).not.toHaveBeenCalled();
  });

  it('有回执补 ID、读 canonical 并失效 active 首屏；成功回读后删 pending', async () => {
    // 先种一份当前主体的 active 成功快照：回执收口后必须被失效（下一次加载重读首屏）
    env.deps.设后端状态((旧) => ({
      ...旧,
      P5连续列表: {
        'p5:negotiations:candidate:active': {
          ownerSubjectId: 'sub_1', 阶段: '成功', 刷新中: false, items: [],
          nextCursor: null, 已加载页数: 1, error: null, generation: 0,
        },
      },
    }));
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'del_rec_1' }]);
    await env.操作.委托候选岗位(候选委托输入);
    expect(env.数据源.读取候选连续详情).toHaveBeenCalledWith('del_rec_1');
    expect(env.最新状态().P5连续列表['p5:negotiations:candidate:active']).toBeUndefined();
    expect(env.操作.取候选待核对命令('int_1', 'job_1')).toBeNull();
  });

  it('业务拒绝无 delegation_id 不造卡：pending 收口删除、零 canonical 读', async () => {
    vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValueOnce([
      { ...BFF候选委托回执样本, delegation_id: '', state: 'refused', refusal_code: 'delegation_cooldown' },
    ]);
    await expect(env.操作.委托候选岗位(候选委托输入))
      .rejects.toMatchObject({ code: 'delegation_cooldown' });
    expect(env.数据源.读取候选连续详情).not.toHaveBeenCalled();
    expect(env.操作.取候选待核对命令('int_1', 'job_1')).toBeNull();
    // 卡摘要保留 create-time 拒绝事实（delegation_id 为空 = 无持久记录，页面沿用既有安全文案）
    expect(env.最新状态().P4委托回执).toEqual({});
    expect(env.最新状态().P4真实Case引用).toEqual({});
  });

  it('存储失败保留本次内存并提示不能保证刷新恢复；同页核对照常原键重放', async () => {
    const 坏存储 = 创建内存存储();
    坏存储.setItem = () => {
      throw new Error('quota');
    };
    env.委托待核对存储.current!.storage = 坏存储;
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('quota-key-0001'));
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(0, 'network_error', 'unknown'));
    await expect(env.操作.委托候选岗位(候选委托输入)).rejects.toMatchObject({ code: 'network_error' });
    expect(document.body.textContent).toContain('无法保证刷新后自动恢复本次提交');
    // 内存兜底仍在：不因此自动重发新 key —— 核对路径用原键原 body 重放一次
    expect(env.操作.取候选待核对命令('int_1', 'job_1')).toMatchObject({ key: 'quota-key-0001' });
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'del_quota' }]);
    await env.操作.核对候选委托('int_1', 'job_1');
    expect(vi.mocked(env.数据源.创建候选岗位委托).mock.calls[1][0]).toMatchObject({
      idempotencyKey: 'quota-key-0001',
      resumeFileId: 'rf_1', resumeFileVersionId: 'rfv_7',
    });
    randomUUID.mockRestore();
  });

  it('GET 404 不证明未受理：已确认回执 + canonical 读失败保留 pending，核对只回读零 POST', async () => {
    vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValueOnce([
      { ...BFF候选委托回执样本, delegation_id: 'del_404' },
    ]);
    vi.mocked(env.数据源.读取候选连续详情)
      .mockRejectedValueOnce(new BFF错误(404, 'negotiation_not_found', 'missing'));
    await env.操作.委托候选岗位(候选委托输入);
    const 未决 = env.操作.取候选待核对命令('int_1', 'job_1');
    expect(未决).toMatchObject({
      delegation_id: 'del_404', 已确认回执: true, key: 未决?.key,
    });
    expect(env.数据源.创建候选岗位委托).toHaveBeenCalledTimes(1);

    // 再核对：write 已确认 → 只回读（GET），绝不重发已确认 write
    vi.mocked(env.数据源.读取候选连续详情)
      .mockResolvedValueOnce(连续聚合桩('del_404') as never);
    await env.操作.核对候选委托('int_1', 'job_1');
    expect(env.数据源.创建候选岗位委托).toHaveBeenCalledTimes(1); // 零 POST
    expect(env.数据源.读取候选连续详情).toHaveBeenCalledTimes(2);
    expect(env.操作.取候选待核对命令('int_1', 'job_1')).toBeNull();
  });

  it('存储兄弟 pending 随整批种回：收口 create 不清掉它们，裸新意图也不覆盖', async () => {
    const 兄弟retry: 待核对命令 = {
      operation: 'retry', key: 'sibling-retry-key',
      record_id: 'dlg_0123456789abcdef0123456789abcdef', expected_retry_generation: 1,
    };
    const 已确认create: 待核对命令 = {
      operation: 'create', key: 'confirmed-create-key', intention_id: 'int_1',
      selection: { items: [{ job_id: 'job_1' }] },
      resume_file_id: 'rf_1', resume_file_version_id: 'rfv_7',
      disclosure_acknowledged: true,
      delegation_id: 'del_sibling', 已确认回执: true,
    };
    const 共享存储 = env.委托待核对存储.current!.storage!;
    保存待核对(共享存储, 待核对owner, [已确认create, 兄弟retry]);

    // 硬刷新 = 全新内存表 + 同一 owner 存储：收口 create 后 retry 兄弟原样保留
    const env2 = 创建P4操作测试环境({ 待核对存储: 共享存储 });
    vi.mocked(env2.数据源.读取候选连续详情)
      .mockResolvedValueOnce(连续聚合桩('del_sibling') as never);
    await env2.操作.核对候选委托('int_1', 'job_1');
    expect(读取待核对(共享存储, 待核对owner).命令).toEqual([兄弟retry]); // 整批覆盖只删命中那条
    expect(env2.操作.取候选待核对命令('int_1', 'job_1')).toBeNull();

    // 裸新意图（另一岗位的 fresh 委托）：入口先读后冻结（整批种回兜底），兄弟不被覆盖
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('sibling-new-key'));
    let 放行!: (值: BFF委托回执[]) => void;
    vi.mocked(env2.数据源.创建候选岗位委托).mockReturnValue(new Promise((ok) => {
      放行 = ok;
    }) as never);
    const 写 = env2.操作.委托候选岗位({ ...候选委托输入, jobId: 'job_2' });
    await new Promise((完成) => setTimeout(完成, 0));
    const 在飞 = 读取待核对(共享存储, 待核对owner).命令;
    expect(在飞).toHaveLength(2); // 发送前冻结不清兄弟：retry 兄弟 + 新 job_2 命令同在
    expect(在飞.find((条) => 条.operation === 'retry')).toEqual(兄弟retry);
    放行([{ ...BFF候选委托回执样本, delegation_id: 'del_new' }]);
    await 写;
    // 新 create 收口（canonical 默认桩成功）后：只剩 retry 兄弟
    expect(读取待核对(共享存储, 待核对owner).命令).toEqual([兄弟retry]);
    randomUUID.mockRestore();
  });

  it('硬刷新后已确认 create 只回读并收口存储：零重发已确认 write', async () => {
    // 第一段：POST 受理但 canonical 读失败 → pending 保留 已确认回执 + delegation_id（内存 + 存储）
    vi.mocked(env.数据源.创建候选岗位委托).mockResolvedValueOnce([
      { ...BFF候选委托回执样本, delegation_id: 'del_refresh' },
    ]);
    vi.mocked(env.数据源.读取候选连续详情)
      .mockRejectedValueOnce(new BFF错误(503, 'downstream_unavailable', 'down'));
    await env.操作.委托候选岗位(候选委托输入);
    const 共享存储 = env.委托待核对存储.current!.storage!;
    expect(读取待核对(共享存储, 待核对owner).命令).toEqual([
      expect.objectContaining({ operation: 'create', delegation_id: 'del_refresh', 已确认回执: true }),
    ]);

    // 硬刷新 = 同一 owner 存储、全新内存表：核对只回读（GET-only），成功后收口必须落回存储
    const env2 = 创建P4操作测试环境({ 待核对存储: 共享存储 });
    expect(env2.操作.取候选待核对命令('int_1', 'job_1')).toMatchObject({ delegation_id: 'del_refresh' });
    vi.mocked(env2.数据源.读取候选连续详情)
      .mockResolvedValueOnce(连续聚合桩('del_refresh') as never);
    await env2.操作.核对候选委托('int_1', 'job_1');
    expect(env2.数据源.创建候选岗位委托).not.toHaveBeenCalled(); // 零重发已确认 write
    expect(env2.委托待核对内存.current.has('create:int_1:job_1')).toBe(false);
    expect(读取待核对(共享存储, 待核对owner).命令).toEqual([]); // 存储被清，pending 收口
  });

  it('409 idempotency_conflict 不自动新 key：pending 与原键保留，重放沿用原键', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('conflict-key-0001'))
      .mockReturnValue(UUID键('never-key-0002'));
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(409, 'idempotency_conflict', 'conflict'));
    await expect(env.操作.委托候选岗位(候选委托输入))
      .rejects.toMatchObject({ code: 'idempotency_conflict' });
    // 冲突不自动另起命令：未决命令与原键原样保留（不把冲突当已受理/未受理的证明）
    expect(env.操作.取候选待核对命令('int_1', 'job_1')).toMatchObject({ key: 'conflict-key-0001' });
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'del_conflict' }]);
    await env.操作.核对候选委托('int_1', 'job_1');
    expect(vi.mocked(env.数据源.创建候选岗位委托).mock.calls[1][0]).toMatchObject({
      idempotencyKey: 'conflict-key-0001',
    });
    expect(randomUUID).toHaveBeenCalledTimes(1); // 零新键
    randomUUID.mockRestore();
  });

  // ── review-r1 F2（Spec §8「409 按 code 区分…回读真实状态，不绕过门槛」+ 恢复顺序）：
  //    create 的 409 先权威回读（原意向推荐列表 + active 连续列表辅助核对），回读唯一辨认出
  //    该 intention-job 的记录才收口，绝不把 409 当受理/未受理证明，也不立即二次 POST。──

  /** active 连续列表行的最小桩：辅助回读只读 intention/job/record/delegation 坐标。 */
  function 连续列表行桩(覆盖: {
    recordId: string;
    intentionId?: string;
    jobId?: string;
    delegationId?: string | null;
  }) {
    const 基座 = 连续聚合桩(覆盖.recordId);
    return {
      ...基座,
      intention_id: 覆盖.intentionId ?? 'int_1',
      job: { ...基座.job, job_id: 覆盖.jobId ?? 'job_1' },
      delegation_id: 覆盖.delegationId === undefined ? 覆盖.recordId : 覆盖.delegationId,
    };
  }

  it('create 409 先权威回读：POST 之后是推荐列表+active 连续列表（无立即二次 POST），未命中保留原命令', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('r1-409-key-0001'));
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(409, 'idempotency_conflict', 'conflict'));
    await expect(env.操作.委托候选岗位(候选委托输入))
      .rejects.toMatchObject({ code: 'idempotency_conflict' });
    // 顺序：POST → 权威回读（原意向推荐列表、active 连续列表首屏），零第二次 POST
    expect(env.数据源.创建候选岗位委托).toHaveBeenCalledTimes(1);
    const POST序 = vi.mocked(env.数据源.创建候选岗位委托).mock.invocationCallOrder[0];
    const 推荐读序 = vi.mocked(env.数据源.读取候选岗位推荐).mock.invocationCallOrder.at(-1);
    const 连续读序 = vi.mocked(env.数据源.读取候选连续列表).mock.invocationCallOrder.at(-1);
    expect(推荐读序).toBeGreaterThan(POST序!);
    expect(连续读序).toBeGreaterThan(POST序!);
    expect(vi.mocked(env.数据源.读取候选岗位推荐)).toHaveBeenCalledWith('int_1');
    expect(vi.mocked(env.数据源.读取候选连续列表)).toHaveBeenCalledWith('active', null);
    // 回读未命中（两腿都空）：原命令完整保留（原 key/body）待用户显式核对，零 canonical 收口
    expect(env.数据源.读取候选连续详情).not.toHaveBeenCalled();
    expect(env.操作.取候选待核对命令('int_1', 'job_1')).toMatchObject({ key: 'r1-409-key-0001' });
    randomUUID.mockRestore();
  });

  it('409 回读只刷新权威状态：存在同 intention-job 记录也不关闭/不标记 pending（归属只认重放回执）', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('r2-409-key-0001'))
      .mockReturnValue(UUID键('r2-never-key-0002'));
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(409, 'idempotency_conflict', 'conflict'));
    // active 首屏已有一条同 intention-job 的旧记录：Spec §8「存在同岗位记录都不能证明原写
    // 未受理或某次 retry 成功」——它不能建立与未决命令的归属，绝不据此收口/标记
    vi.mocked(env.数据源.读取候选连续列表).mockResolvedValueOnce({
      items: [连续列表行桩({ recordId: 'dlg_r2_old' })], next_cursor: null,
    } as never);
    await expect(env.操作.委托候选岗位(候选委托输入))
      .rejects.toMatchObject({ code: 'idempotency_conflict' });
    // 零错误归属：不删、不补 ID、不标记已确认（无 delegation_id/record_id/已确认回执 键）
    expect(env.操作.取候选待核对命令('int_1', 'job_1')).toEqual({
      operation: 'create',
      key: 'r2-409-key-0001',
      intention_id: 'int_1',
      selection: { items: [{ job_id: 'job_1' }] },
      resume_file_id: 'rf_1',
      resume_file_version_id: 'rfv_7',
      disclosure_acknowledged: true,
    });
    // 收口专用 canonical 腿不存在：零 读取候选连续详情、零命中记录提交
    expect(env.数据源.读取候选连续详情).not.toHaveBeenCalled();
    expect(env.最新状态().P4委托回执).toEqual({});
    // 意图键与原命令保留：同目标的下一次点击被未决规则转为核对原命令（原键重放），零新键
    expect(randomUUID).toHaveBeenCalledTimes(1);
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'del_r2_replay' }]);
    await env.操作.委托候选岗位(候选委托输入);
    expect(vi.mocked(env.数据源.创建候选岗位委托).mock.calls[1][0]).toMatchObject({
      idempotencyKey: 'r2-409-key-0001',
    });
    expect(randomUUID).toHaveBeenCalledTimes(1); // 仍是零新键
    // 归属由真实回执确认：重放回执收口（canonical 读 + 删 pending）走 fresh 同款路径
    expect(env.数据源.读取候选连续详情).toHaveBeenCalledWith('del_r2_replay');
    expect(env.操作.取候选待核对命令('int_1', 'job_1')).toBeNull();
    randomUUID.mockRestore();
  });

  it('辅助回读腿 401（原意向推荐列表）→ 统一清账号状态、清旧 owner pending，零后续腿/零重放/零提交', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('r2-401a-key-0001'));
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(409, 'idempotency_conflict', 'conflict'));
    vi.mocked(env.数据源.读取候选岗位推荐)
      .mockRejectedValueOnce(new BFF错误(401, 'invalid_session', 'expired'));
    const 共享存储 = env.委托待核对存储.current!.storage!;
    await expect(env.操作.委托候选岗位(候选委托输入))
      .rejects.toMatchObject({ status: 401, code: 'invalid_session' });
    // 统一账号清理被触发（Spec §10：登出/清敏感视图），旧 owner pending 一并清除
    expect(env.最新状态().已登录).toBe(false);
    expect(env.deps.主体标识引用.current).toBeNull();
    expect(env.委托待核对内存.current.size).toBe(0);
    expect(读取待核对(共享存储, 待核对owner).命令).toEqual([]);
    // 立即终止恢复流程：第二腿（active 连续列表）零调用、零重放 POST、零意图键铸造外的提交
    expect(env.数据源.读取候选连续列表).not.toHaveBeenCalled();
    expect(env.数据源.创建候选岗位委托).toHaveBeenCalledTimes(1);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    randomUUID.mockRestore();
  });

  it('辅助回读腿 401（active 连续列表）→ 同样统一清账号状态并终止：第一腿已读、零重放', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('r2-401b-key-0001'));
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(409, 'idempotency_conflict', 'conflict'));
    vi.mocked(env.数据源.读取候选连续列表)
      .mockRejectedValueOnce(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(env.操作.委托候选岗位(候选委托输入))
      .rejects.toMatchObject({ status: 401, code: 'invalid_session' });
    // 第一腿（推荐列表）已读、第二腿 401 触发统一清理
    expect(vi.mocked(env.数据源.读取候选岗位推荐)).toHaveBeenCalledWith('int_1');
    expect(env.最新状态().已登录).toBe(false);
    expect(env.委托待核对内存.current.size).toBe(0);
    expect(env.数据源.创建候选岗位委托).toHaveBeenCalledTimes(1); // 零重放
    randomUUID.mockRestore();
  });

  it('核对未确认命令先权威回读：同岗位记录不抢先收口，仍原 key+body 恰重放一次拿真实回执收口', async () => {
    // 硬刷新后存储里只有未确认 create，active 首屏已有一条同 pair 旧记录
    const 共享存储 = 创建内存存储();
    const 未确认命令: 待核对命令 = {
      operation: 'create', key: 'r2-verify-key', intention_id: 'int_1',
      selection: { items: [{ job_id: 'job_1' }] },
      resume_file_id: 'rf_1', resume_file_version_id: 'rfv_7',
      disclosure_acknowledged: true,
    };
    保存待核对(共享存储, 待核对owner, [未确认命令]);
    const env2 = 创建P4操作测试环境({ 待核对存储: 共享存储 });
    vi.mocked(env2.数据源.读取候选连续列表).mockResolvedValueOnce({
      items: [连续列表行桩({ recordId: 'dlg_r2_stale' })], next_cursor: null,
    } as never);
    vi.mocked(env2.数据源.创建候选岗位委托)
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'del_r2_receipt' }]);
    await env2.操作.核对候选委托('int_1', 'job_1');
    // 旧记录不拦截重放：原 key+body 恰重放一次（归属只认重放回执）
    expect(env2.数据源.创建候选岗位委托).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env2.数据源.创建候选岗位委托).mock.calls[0][0]).toEqual({
      intentionId: 'int_1', jobId: 'job_1',
      resumeFileId: 'rf_1', resumeFileVersionId: 'rfv_7',
      idempotencyKey: 'r2-verify-key', disclosureAcknowledged: true,
    });
    // canonical 读带的是重放回执的坐标，不是旧记录坐标；收口后 pending 删除
    expect(env2.数据源.读取候选连续详情).toHaveBeenCalledWith('del_r2_receipt');
    expect(env2.操作.取候选待核对命令('int_1', 'job_1')).toBeNull();
    expect(读取待核对(共享存储, 待核对owner).命令).toEqual([]);
  });

  // ── review-r3（Spec §8 切主体清旧请求 / §10 阻止旧请求落位）：显式核对在回读腿的迟到
  //    401 或换代后必须真正中止——栅栏只拦状态落位、拦不住网络写，旧 intention/PDF 坐标
  //    不得以新会话 Cookie 重放。──

  /** r3 用例通用的存储态未确认 create 命令 + 新环境（模拟硬刷新后显式核对）。 */
  function 挂核对环境(键: string) {
    const 共享存储 = 创建内存存储();
    const 命令: 待核对命令 = {
      operation: 'create', key: 键, intention_id: 'int_1',
      selection: { items: [{ job_id: 'job_1' }] },
      resume_file_id: 'rf_1', resume_file_version_id: 'rfv_7',
      disclosure_acknowledged: true,
    };
    保存待核对(共享存储, 待核对owner, [命令]);
    const 环境 = 创建P4操作测试环境({ 待核对存储: 共享存储 });
    return { 环境, 共享存储, 命令 };
  }

  it('显式核对第一腿迟到 401：中止核对（零第二腿、零种键、零重放 POST），新会话零清理', async () => {
    const { 环境: env2, 共享存储, 命令 } = 挂核对环境('r3-late401a-key');
    const 第一腿 = deferred<BFF候选岗位推荐[]>();
    vi.mocked(env2.数据源.读取候选岗位推荐).mockReturnValue(第一腿.promise);
    const 核对 = env2.操作.核对候选委托('int_1', 'job_1');
    env2.deps.主体标识引用.current = 'sub_new'; // 第一腿在飞期间换代：401 属于旧会话
    第一腿.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await 核对; // 中止：静默收口（无 401 抛给新会话的屏）
    expect(env2.数据源.读取候选连续列表).not.toHaveBeenCalled(); // 零第二腿
    expect(env2.数据源.创建候选岗位委托).not.toHaveBeenCalled(); // 零重放 POST
    expect(env2.deps.P4幂等意图!.current.size).toBe(0); // 零旧键种入
    // 迟到 401 不登出新主体（既有语义）：零统一清理、登录态原样
    expect(env2.最新状态().已登录).toBe(true);
    expect(env2.派发).not.toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(env2.数据源.清空目录缓存).not.toHaveBeenCalled();
    // 旧命令只在旧 owner 存储里原样保留，不进新会话的任何写入
    expect(读取待核对(共享存储, 待核对owner).命令).toEqual([命令]);
  });

  it('显式核对第二腿迟到 401：第一腿已读、同样中止核对（零种键、零重放 POST）', async () => {
    const { 环境: env2 } = 挂核对环境('r3-late401b-key');
    const 第二腿 = deferred<{ items: never[]; next_cursor: null }>();
    vi.mocked(env2.数据源.读取候选连续列表).mockReturnValue(第二腿.promise);
    const 核对 = env2.操作.核对候选委托('int_1', 'job_1');
    // 等第一腿完成、第二腿已挂上 await（同 2278 用例的 setTimeout 门），再换代＋迟到 401
    await new Promise((完成) => setTimeout(完成, 0));
    env2.deps.主体标识引用.current = 'sub_new';
    第二腿.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await 核对;
    expect(vi.mocked(env2.数据源.读取候选岗位推荐)).toHaveBeenCalledWith('int_1'); // 第一腿已读
    expect(env2.数据源.创建候选岗位委托).not.toHaveBeenCalled(); // 零重放 POST
    expect(env2.deps.P4幂等意图!.current.size).toBe(0);
    expect(env2.最新状态().已登录).toBe(true); // 新会话零清理
  });

  it('换代即中止：第一腿成功返回时栅栏已过期 → 不再发第二腿 GET、零重放、新会话零清理', async () => {
    const { 环境: env2 } = 挂核对环境('r3-fence-key');
    const 第一腿 = deferred<BFF候选岗位推荐[]>();
    vi.mocked(env2.数据源.读取候选岗位推荐).mockReturnValue(第一腿.promise);
    const 核对 = env2.操作.核对候选委托('int_1', 'job_1');
    env2.deps.主体标识引用.current = 'sub_new'; // 第一腿在飞期间换代
    第一腿.resolve([]); // 成功返回但栅栏已过期 → 中止，不再发下一条 GET
    await 核对;
    expect(env2.数据源.读取候选连续列表).not.toHaveBeenCalled();
    expect(env2.数据源.创建候选岗位委托).not.toHaveBeenCalled();
    expect(env2.deps.P4幂等意图!.current.size).toBe(0);
    expect(env2.最新状态().已登录).toBe(true);
    expect(env2.派发).not.toHaveBeenCalledWith({ 型: '清后端组织状态' });
  });

  it('明确拒绝（400）收口未决命令：下一次委托是新意图新键', async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID键('reject-key-0001'))
      .mockReturnValueOnce(UUID键('fresh-key-0003'));
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(400, 'invalid_request_body', 'bad'));
    await expect(env.操作.委托候选岗位(候选委托输入))
      .rejects.toMatchObject({ status: 400 });
    expect(env.操作.取候选待核对命令('int_1', 'job_1')).toBeNull();
    vi.mocked(env.数据源.创建候选岗位委托)
      .mockResolvedValueOnce([{ ...BFF候选委托回执样本, delegation_id: 'del_new' }]);
    await env.操作.委托候选岗位(候选委托输入);
    expect(vi.mocked(env.数据源.创建候选岗位委托).mock.calls[1][0]).toMatchObject({
      idempotencyKey: 'fresh-key-0003',
    });
    randomUUID.mockRestore();
  });
});
