// P4 Task 3/4：发现推荐 Backend raw scope 快照、可见范围栅栏化读取、会话清理与
// refresh/feedback mutation（服务端先行 + 意图键生命周期）的行为测试。
// 受控 deferred promise 证明原子提交与 stale 丢弃；派发 只是 spy，全部 P4 断言读 最新状态()。
// 纪律：另一个 scope 的用例必须先 设置发现推荐范围 再发请求 —— 通过即证明生产可见范围栅栏，而非绕过它。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BFF主体,
  BFF候选岗位推荐,
  BFF发现批次,
  BFF发现偏好,
  BFF招聘候选推荐,
} from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { BFF错误 } from '../../数据/HTTP客户端';
import {
  BFFCandidateJob样本,
  BFF主体样本,
  BFF发现批次样本,
  BFF发现偏好样本,
  BFF候选岗位推荐样本,
  BFF招聘发现批次样本,
  BFF招聘候选推荐样本,
} from '../../测试/BFF样本';
import { 初始状态 } from '../初始状态';
import type { 动作 } from '../应用状态';
import {
  创建空P4发现状态,
  创建发现推荐操作,
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

/** 本文件内的数据源桩：桩 P4 读取/refresh/feedback + 清空目录缓存，默认全成功，逐测试用覆盖项替换。 */
function 创建P4数据源(覆盖: Record<string, unknown> = {}): HTTP招聘数据源 {
  return {
    读取候选岗位推荐: vi.fn(async (): Promise<BFF候选岗位推荐[]> => []),
    读取候选岗位详情: vi.fn(async () => BFFCandidateJob样本),
    刷新候选岗位推荐: vi.fn(async (): Promise<BFF发现批次> => BFF发现批次样本),
    标记候选岗位不感兴趣: vi.fn(async (): Promise<BFF发现偏好> => BFF发现偏好样本),
    读取招聘候选: vi.fn(async (): Promise<BFF招聘候选推荐[]> => []),
    读取招聘候选详情: vi.fn(async () => BFF招聘候选推荐样本),
    刷新招聘候选: vi.fn(async (): Promise<BFF发现批次> => BFF招聘发现批次样本),
    设置招聘候选收藏: vi.fn(async (): Promise<BFF发现偏好> => BFF发现偏好样本),
    设置招聘候选淘汰: vi.fn(async (): Promise<BFF发现偏好> => BFF发现偏好样本),
    撤销招聘候选淘汰: vi.fn(async (): Promise<BFF发现偏好> => BFF发现偏好样本),
    清空目录缓存: vi.fn(),
    ...覆盖,
  } as unknown as HTTP招聘数据源;
}

interface P4操作测试环境 {
  数据源: HTTP招聘数据源;
  deps: 后端操作依赖;
  派发: ReturnType<typeof vi.fn>;
  操作: 发现推荐操作;
  最新状态(): 后端状态;
}

function 创建P4操作测试环境(): P4操作测试环境 {
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
    候选规则快照: {},
    招聘规则快照: {},
    候选规则提案: {},
    招聘规则提案: {},
    Agent规则水合: {
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    },
    ...创建空P4发现状态(),
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
  };
  return {
    数据源,
    deps,
    派发,
    // Task 5 的 delegation 尚未实现；本文件用例覆盖 Task 3 读取 + Task 4 refresh/feedback
    操作: 创建发现推荐操作(deps) as 发现推荐操作,
    最新状态: () => 后端值,
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
    expect(env.最新状态().招聘候选详情.rec_r1).toEqual(BFF招聘候选推荐样本);
    vi.mocked(env.数据源.读取招聘候选详情)
      .mockRejectedValue(new BFF错误(404, 'recommendation_not_found', 'gone'));
    await expect(env.操作.读取招聘候选详情('job_1', 'rec_gone', true)).resolves.toBeUndefined();
    expect(env.最新状态().招聘候选不可用).toEqual(['rec_gone']);
    expect(env.最新状态().招聘候选详情.rec_gone).toBeUndefined();
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
    // 服务端更新卡保留收藏（淘汰不能清收藏）并带权威 state/reason
    const 已淘汰卡: BFF招聘候选推荐 = {
      ...BFF招聘候选推荐样本,
      favorite: true, rejected: true, rejection_reason: 'direction_mismatch', state: 'rejected',
    };
    vi.mocked(env.数据源.读取招聘候选详情).mockResolvedValue(已淘汰卡);

    await env.操作.淘汰候选('job_1', 'rec_r1', 'direction_mismatch');

    expect(vi.mocked(env.数据源.设置招聘候选淘汰))
      .toHaveBeenCalledWith('job_1', 'rec_r1', 'direction_mismatch');
    expect(vi.mocked(env.数据源.读取招聘候选详情)).toHaveBeenCalledWith('job_1', 'rec_r1');
    expect(env.最新状态().招聘可用候选.job_1?.items ?? []).toEqual([]);
    const jobKey = P4范围键.招聘已筛(['job_1']);
    expect(env.最新状态().招聘已筛候选[jobKey]?.items).toEqual([已淘汰卡]);
    expect(env.最新状态().招聘候选详情.rec_r1).toEqual(已淘汰卡);
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
    // 闭合表之外的 HTTP code 与运行时错误才回落现有映射
    expect(P4错误文案(new BFF错误(500, 'unexpected_code', 'boom'))).toBe('boom');
    expect(P4错误文案(new TypeError('x'))).toBe('网络连接失败，请稍后再试');
  });

  it('P4拒绝文案 与 P4委托终态文案 逐项冻结', () => {
    expect(P4拒绝文案('recommendation_not_found')).toBe('这条推荐当前已不可用，请刷新后查看');
    expect(P4拒绝文案('recommendation_unavailable')).toBe('这条推荐当前已不可用，请刷新后查看');
    expect(P4拒绝文案('delegation_not_allowed')).toBe('当前无法发起委托，请刷新后重试');
    expect(P4拒绝文案('active_case_quota_reached')).toBe('当前在谈已达到上限，请先处理已有在谈');
    expect(P4拒绝文案('delegation_cooldown')).toBe('近期已联系过对方，暂时不能重复发起');
    expect(P4委托终态文案('needs_user')).toBe('这次委托需要你确认后才能继续');
    expect(P4委托终态文案('refused')).toBe('这次委托未被接受，请稍后重试');
    expect(P4委托终态文案('failed')).toBe('这次委托没有成功，请稍后重试');
  });
});
