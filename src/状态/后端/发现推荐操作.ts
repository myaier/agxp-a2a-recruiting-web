// 后端发现推荐域操作（P4 Task 3）：raw scope 快照的栅栏化读取、可见范围注册与会话清理底座。
// 铁律（设计 §6/§9/§10）：
//   · Backend 才发请求（!是后端 || !后端 一律早退）；接口失败绝不回退 Mock，Mock 发现页
//     继续走 归约发现推荐，本域不触达 Mock reducer。
//   · 栅栏 = subject_id + active role + session generation + scope id + scope generation，
//     每个请求发送前捕获；任一不匹配的迟到成败只释放本轮锁 —— 不写快照、不派发、不提示、
//     不做 401 清理（迟到的 401 绝不能登出新会话）。
//   · scope 全量读按 scope 单飞（同锁去重）；已 成功 的快照在刷新途中保留旧 items 不降级，
//     刷新失败也不降级；首次加载失败落 失败 + 错误文案，页面给明确重试。
//   · 加载招聘已筛 把在招岗位排序去重成 jobKey 后并发读取全部 rejected 腿，
//     全部成功后才做唯一一次 设后端状态 原子提交；任一腿失败绝不落半份聚合。
//   · 详情 404 按统一不可用收口（标记 + 不抛）；其余非 401 错误原样抛给屏。
// Task 4 落 refresh/feedback mutation、Task 5 落委托与轮询；本文件先落地读子集。

import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type { BFF角色, BFF候选岗位推荐, BFF招聘候选推荐 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { 清账号状态 } from './会话操作';
import type {
  后端操作依赖,
  P4发现读操作,
  P4发现状态,
  P4运行时引用,
  P4ScopeSnapshot,
} from './类型';

/** 屏幕注册可见范围的冻结键表：注册唯一精确键、effect cleanup 时清成 null。 */
export const P4范围键 = {
  候选列表: (intentionId: string) => `candidate:list:${intentionId}`,
  候选详情: (jobId: string) => `candidate:detail:${jobId}`,
  招聘列表: (jobId: string) => `recruiter:list:${jobId}`,
  招聘详情: (jobId: string, recommendationId: string) =>
    `recruiter:detail:${jobId}:${recommendationId}`,
  招聘已筛: (jobIds: string[]) => `recruiter:rejected:${[...jobIds].sort().join(',')}`,
} as const;

/** P4 discovery 的可复用初始化/重置底座：Provider 首帧与三个会话转移口共用同一形状。 */
export function 创建空P4发现状态(): P4发现状态 {
  return {
    候选岗位推荐: {}, 候选岗位详情: {}, 候选岗位不可用: [],
    招聘可用候选: {}, 招聘已筛候选: {},
    招聘已筛聚合: { 阶段: '未开始', jobKey: '', error: null },
    招聘候选详情: {}, 招聘候选不可用: [],
    P4委托回执: {}, P4真实Case引用: {},
  };
}

/** Provider 恒注入三个 P4 引用；缺引用是接线缺陷，在工厂入口尽早暴露而不是静默错栅栏。 */
function 取P4引用(deps: 后端操作依赖): 后端操作依赖 & P4运行时引用 {
  if (!deps.P4范围代际 || !deps.P4幂等意图 || !deps.P4可见范围) {
    throw new Error('P4 discovery 运行时引用未初始化（Provider 必须一次性注入）');
  }
  return deps as 后端操作依赖 & P4运行时引用;
}

/**
 * 每个异步读写发送前捕获的栅栏：subject_id + active role + session generation +
 * scope id + scope generation。请求自身的 scope 键不必等于可见范围（详情/已筛等
 * 子 scope 在同一可见范围下读取），栅栏比对的可见范围是「此刻屏幕注册的那一个」。
 */
interface P4Fence {
  subjectId: string | null;
  role: BFF角色 | null;
  sessionGeneration: number;
  scopeKey: string;
  scopeGeneration: number;
  visibleScope: string | null;
}

function fenceStillCurrent(deps: 后端操作依赖 & P4运行时引用, fence: P4Fence): boolean {
  const subject = deps.后端状态引用.current.主体;
  return deps.主体标识引用.current === fence.subjectId &&
    subject?.last_used_role === fence.role &&
    deps.会话代际.current === fence.sessionGeneration &&
    (fence.role === null || deps.P4可见范围.current[fence.role] === fence.visibleScope) &&
    deps.P4范围代际.current.get(fence.scopeKey) === fence.scopeGeneration;
}

function 捕获栅栏(deps: 后端操作依赖 & P4运行时引用, scopeKey: string): P4Fence {
  const role = deps.后端状态引用.current.主体?.last_used_role ?? null;
  // 首次触达的 scope 代际从 0 起跑并落表：fenceStillCurrent 用 get(scopeKey) === captured
  // 精确比对，未落表的键读回 undefined 会把所有首读 completion 误判成 stale —— 这里把
  // 0 值种子写进表（同值回写不使任何在飞请求过期，只有 设置发现推荐范围 的 +1 才作废）。
  const scopeGeneration = deps.P4范围代际.current.get(scopeKey) ?? 0;
  deps.P4范围代际.current.set(scopeKey, scopeGeneration);
  return {
    subjectId: deps.主体标识引用.current,
    role,
    sessionGeneration: deps.会话代际.current,
    scopeKey,
    scopeGeneration,
    visibleScope: role === null ? null : deps.P4可见范围.current[role],
  };
}

/** 401 统一判据：会话失效一律 清账号状态，不只 轻提示（与其它域同口径）。 */
function 是401(错误: unknown): boolean {
  return 错误 instanceof BFF错误 && 错误.status === 401;
}

// ── scope 快照的三个纯构造器：起步 / 成功 / 失败（成功快照永不降级）──

function 起步快照<T>(旧: P4ScopeSnapshot<T> | undefined, generation: number): P4ScopeSnapshot<T> {
  // 已成功 → 只翻 刷新中，阶段与 items 原样保留；其余（未开始/失败）→ 首载进行中。
  if (旧?.阶段 === '成功') return { ...旧, 刷新中: true, error: null };
  return { 阶段: '进行中', 刷新中: true, items: 旧?.items ?? [], error: null, generation };
}

function 成功快照<T>(items: T[], generation: number): P4ScopeSnapshot<T> {
  return { 阶段: '成功', 刷新中: false, items, error: null, generation };
}

function 失败快照<T>(
  旧: P4ScopeSnapshot<T> | undefined,
  错误: unknown,
  generation: number,
): P4ScopeSnapshot<T> {
  const error = 取后端错误文案(错误);
  if (旧?.阶段 === '成功') return { ...旧, 刷新中: false, error };
  return { 阶段: '失败', 刷新中: false, items: 旧?.items ?? [], error, generation };
}

export function 创建发现推荐操作(deps: 后端操作依赖): P4发现读操作 {
  const { 是后端, 后端, 设后端状态, 后端状态引用, 锁, 主体标识引用, 会话代际 } = deps;
  // Provider 恒注入；收窄一次，域内不再到处断言。
  const 引用 = 取P4引用(deps);
  const { P4范围代际, P4幂等意图, P4可见范围 } = 引用;
  // 清账号状态 需要的子集（与其它域同口径，另带三个 P4 引用做 discovery 清理）
  const 账号清理依赖 = {
    派发: deps.派发, 设后端状态, 后端, 主体标识引用, 会话代际, P4范围代际, P4幂等意图, P4可见范围,
  };

  /** scope 全量读的单飞锁键（与其它域共用的 锁 集合按前缀隔离）。 */
  function 读锁键(scopeKey: string): string {
    return `P4读:${scopeKey}`;
  }

  /**
   * scope 读取统一核：拿单飞锁 → 捕获栅栏 → 起步提交 → 读 → 栅栏内才结算。
   * 迟到成败（含迟到 401）只走 finally 释放本把锁；栅栏内的 401 走统一 清账号状态。
   */
  async function 运行范围读<T>(input: {
    scopeKey: string;
    读: (数据源: HTTP招聘数据源) => Promise<T>;
    开始: (fence: ReturnType<typeof 捕获栅栏>) => void;
    成功: (结果: T, fence: ReturnType<typeof 捕获栅栏>) => void;
    失败: (错误: unknown, fence: ReturnType<typeof 捕获栅栏>) => void;
  }): Promise<void> {
    const 键 = 读锁键(input.scopeKey);
    if (锁.current.has(键)) return;
    锁.current.add(键);
    // 栅栏捕获只是读引用 + 回写同值代际种子，不可能抛；起步提交放进 try，锁由 finally 收口
    const fence = 捕获栅栏(引用, input.scopeKey);
    try {
      // 数据源守卫必须先于起步提交：否则这条（当前不可达的）路径会把快照永远搁在 进行中
      if (!后端) return;
      input.开始(fence);
      const 结果 = await input.读(后端);
      if (!fenceStillCurrent(引用, fence)) return;
      input.成功(结果, fence);
    } catch (错误) {
      if (!fenceStillCurrent(引用, fence)) return;
      if (是401(错误)) {
        清账号状态(账号清理依赖);
        return;
      }
      input.失败(错误, fence);
    } finally {
      锁.current.delete(键);
    }
  }

  return {
    设置发现推荐范围(role, scopeKey) {
      const 旧 = P4可见范围.current[role];
      if (旧 === scopeKey) return; // 同键重复注册不是变更，不递增代际
      if (旧 !== null) {
        // 旧键代际 +1：还在飞的旧 scope 读写按旧代际整包作废
        P4范围代际.current.set(旧, (P4范围代际.current.get(旧) ?? 0) + 1);
        // 旧可见范围的 pending 幂等意图（Task 4 键形 `${scopeKey}:...`）整体作废
        for (const 键 of [...P4幂等意图.current.keys()]) {
          if (键.startsWith(`${旧}:`)) P4幂等意图.current.delete(键);
        }
      }
      if (scopeKey !== null) {
        P4范围代际.current.set(scopeKey, (P4范围代际.current.get(scopeKey) ?? 0) + 1);
      }
      P4可见范围.current = { ...P4可见范围.current, [role]: scopeKey };
    },

    async 加载候选岗位(intentionId, force) {
      if (!是后端 || !后端) return;
      const scopeKey = P4范围键.候选列表(intentionId);
      if (force !== true && 后端状态引用.current.候选岗位推荐[intentionId]?.阶段 === '成功') return;
      await 运行范围读<BFF候选岗位推荐[]>({
        scopeKey,
        读: (源) => 源.读取候选岗位推荐(intentionId),
        开始: (fence) => 设后端状态((旧) => ({
          ...旧,
          候选岗位推荐: {
            ...旧.候选岗位推荐,
            [intentionId]: 起步快照(旧.候选岗位推荐[intentionId], fence.scopeGeneration),
          },
        })),
        成功: (items, fence) => 设后端状态((旧) => ({
          ...旧,
          候选岗位推荐: {
            ...旧.候选岗位推荐,
            [intentionId]: 成功快照(items, fence.scopeGeneration),
          },
        })),
        失败: (错误, fence) => 设后端状态((旧) => ({
          ...旧,
          候选岗位推荐: {
            ...旧.候选岗位推荐,
            [intentionId]: 失败快照(旧.候选岗位推荐[intentionId], 错误, fence.scopeGeneration),
          },
        })),
      });
    },

    async 读取候选岗位详情(jobId, force) {
      if (!是后端 || !后端) return;
      if (force !== true && 后端状态引用.current.候选岗位详情[jobId]) return;
      const scopeKey = P4范围键.候选详情(jobId);
      const 键 = 读锁键(scopeKey);
      if (锁.current.has(键)) return;
      锁.current.add(键);
      const fence = 捕获栅栏(引用, scopeKey);
      try {
        const job = await 后端.读取候选岗位详情(jobId);
        if (!fenceStillCurrent(引用, fence)) return;
        设后端状态((旧) => ({
          ...旧,
          候选岗位详情: { ...旧.候选岗位详情, [jobId]: job },
          // 权威 Job 已回到手：早先的不可用标记一并撤销
          候选岗位不可用: 旧.候选岗位不可用.filter((编号) => 编号 !== jobId),
        }));
      } catch (错误) {
        if (!fenceStillCurrent(引用, fence)) return;
        if (是401(错误)) {
          清账号状态(账号清理依赖);
          throw 错误;
        }
        // 404 按统一不可用收口：标记安全不可用页所需的事实，不抛、不泄露差异
        if (错误 instanceof BFF错误 && 错误.status === 404) {
          设后端状态((旧) => ({
            ...旧,
            候选岗位不可用: 旧.候选岗位不可用.includes(jobId)
              ? 旧.候选岗位不可用
              : [...旧.候选岗位不可用, jobId],
          }));
          return;
        }
        throw 错误;
      } finally {
        锁.current.delete(键);
      }
    },

    async 加载招聘候选(jobId, force) {
      if (!是后端 || !后端) return;
      const scopeKey = P4范围键.招聘列表(jobId);
      if (force !== true && 后端状态引用.current.招聘可用候选[jobId]?.阶段 === '成功') return;
      await 运行范围读<BFF招聘候选推荐[]>({
        scopeKey,
        读: (源) => 源.读取招聘候选(jobId),
        开始: (fence) => 设后端状态((旧) => ({
          ...旧,
          招聘可用候选: {
            ...旧.招聘可用候选,
            [jobId]: 起步快照(旧.招聘可用候选[jobId], fence.scopeGeneration),
          },
        })),
        成功: (items, fence) => 设后端状态((旧) => ({
          ...旧,
          招聘可用候选: {
            ...旧.招聘可用候选,
            [jobId]: 成功快照(items, fence.scopeGeneration),
          },
        })),
        失败: (错误, fence) => 设后端状态((旧) => ({
          ...旧,
          招聘可用候选: {
            ...旧.招聘可用候选,
            [jobId]: 失败快照(旧.招聘可用候选[jobId], 错误, fence.scopeGeneration),
          },
        })),
      });
    },

    async 加载招聘已筛(jobIds, force) {
      if (!是后端 || !后端) return;
      // 排序 + 去重成唯一 jobKey：同组岗位换序/重复传入共享同一把单飞锁与同一份快照，
      // 并发腿的结算顺序也随排序固定，聚合 items 顺序稳定。
      const 活跃岗位 = [...new Set(jobIds)].sort();
      const jobKey = P4范围键.招聘已筛(活跃岗位);
      if (force !== true && 后端状态引用.current.招聘已筛候选[jobKey]?.阶段 === '成功') return;
      await 运行范围读<BFF招聘候选推荐[][]>({
        scopeKey: jobKey,
        读: (源) => Promise.all(活跃岗位.map((岗位) => 源.读取招聘候选(岗位, 'rejected'))),
        开始: (fence) => 设后端状态((旧) => {
          const 下快照 = 起步快照(旧.招聘已筛候选[jobKey], fence.scopeGeneration);
          return {
            ...旧,
            招聘已筛候选: { ...旧.招聘已筛候选, [jobKey]: 下快照 },
            招聘已筛聚合: { 阶段: 下快照.阶段, jobKey, error: null },
          };
        }),
        成功: (按岗位, fence) => 设后端状态((旧) => ({
          ...旧,
          招聘已筛候选: {
            ...旧.招聘已筛候选,
            [jobKey]: 成功快照(按岗位.flat(), fence.scopeGeneration),
          },
          招聘已筛聚合: { 阶段: '成功', jobKey, error: null },
        })),
        失败: (错误, fence) => 设后端状态((旧) => {
          const 下快照 = 失败快照(旧.招聘已筛候选[jobKey], 错误, fence.scopeGeneration);
          return {
            ...旧,
            招聘已筛候选: { ...旧.招聘已筛候选, [jobKey]: 下快照 },
            招聘已筛聚合: { 阶段: 下快照.阶段, jobKey, error: 下快照.error },
          };
        }),
      });
    },

    async 读取招聘候选详情(jobId, recommendationId, force) {
      if (!是后端 || !后端) return;
      if (force !== true && 后端状态引用.current.招聘候选详情[recommendationId]) return;
      const scopeKey = P4范围键.招聘详情(jobId, recommendationId);
      const 键 = 读锁键(scopeKey);
      if (锁.current.has(键)) return;
      锁.current.add(键);
      const fence = 捕获栅栏(引用, scopeKey);
      try {
        const 卡 = await 后端.读取招聘候选详情(jobId, recommendationId);
        if (!fenceStillCurrent(引用, fence)) return;
        设后端状态((旧) => ({
          ...旧,
          招聘候选详情: { ...旧.招聘候选详情, [recommendationId]: 卡 },
          招聘候选不可用: 旧.招聘候选不可用.filter((编号) => 编号 !== recommendationId),
        }));
      } catch (错误) {
        if (!fenceStillCurrent(引用, fence)) return;
        if (是401(错误)) {
          清账号状态(账号清理依赖);
          throw 错误;
        }
        if (错误 instanceof BFF错误 && 错误.status === 404) {
          设后端状态((旧) => ({
            ...旧,
            招聘候选不可用: 旧.招聘候选不可用.includes(recommendationId)
              ? 旧.招聘候选不可用
              : [...旧.招聘候选不可用, recommendationId],
          }));
          return;
        }
        throw 错误;
      } finally {
        锁.current.delete(键);
      }
    },
  };
}
