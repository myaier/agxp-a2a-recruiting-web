// 后端发现推荐域操作（P4 Task 3 读取 + Task 4 refresh/feedback mutation + Task 5 委托与轮询）：
// raw scope 快照、可见范围注册、会话清理底座、服务端先行的反馈写与真实委托回执。
// 铁律（设计 §6/§7/§8/§9/§10）：
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
//   · 一次刷新/委托用户意图持有唯一显式幂等键：受控重试与结果不确定后的重试沿用同一键，
//     idempotency_conflict 绝不换新键强发；权威回执在手（成功或明确拒绝）才释放。
//     POST 成功 + follow-up GET 失败不清旧列表，只落「已发起新一轮」文案。
//   · 反馈（收藏/淘汰/撤销/不感兴趣）服务端先行：失败绝不移动卡片；成功后经权威重读或
//     回执同步 available/rejected/detail 每一处出现；同推荐写单飞、跨推荐并行。
//   · 委托（Task 5 §8）：候选选择坐标是 job_id，回执 recommendation_id 可空且被完全忽略，
//     页面落位一律用操作输入的 recommendationId；招聘选择坐标是 recommendation_id，
//     回执非空坐标必须与所选一致。回执按 delegation_id 提交与轮询；accepted/evaluating
//     显示进行中摘要，case_started 只写 P4真实Case引用，needs_user/refused/failed 清摘要；
//     绝不派发 委托入谈/接触推荐候选/任何 MatchCase 动作，绝不在 P4 制造本地 Case。
//     委托创建按 candidate-intention-job / recruiter-job-recommendation pair 单飞，
//     delegation GET 不取创建锁（安全由轮询单飞 + 栅栏保证）。

import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type {
  BFF发现偏好,
  BFF委托回执,
  BFF委托摘要,
  BFF角色,
  BFF候选岗位推荐,
  BFF招聘候选推荐,
} from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { 清账号状态 } from './会话操作';
import type {
  后端操作依赖,
  后端状态,
  发现推荐操作,
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

/** Task 4 已落地的变更子集；Task 5 落委托后由完整 发现推荐操作 取代（见 类型.ts 收敛）。 */
export type P4发现变更操作 = Pick<发现推荐操作,
  '刷新候选岗位' | '标记岗位不感兴趣' | '刷新招聘候选' | '设置候选收藏' | '淘汰候选' | '撤销淘汰候选'>;

// ── Task 4：一次刷新/委托用户意图的冻结幂等键坐标（与 P4范围键 同一冻结纪律）──
// 键以目标 scope 为前缀，随 设置发现推荐范围 的旧 scope 前缀清理整体作废（§9.3）。
// Task 4 消费 refresh 坐标；Task 5 委托取 delegation 坐标：
// 候选 (可见范围, jobId)、招聘 (可见范围, recommendationId)。

export const refreshKey = (visibleScope: string) => `${visibleScope}:refresh`;
export const delegationKey = (visibleScope: string, objectId: string) =>
  `${visibleScope}:delegation:${objectId}`;

/** 同一意图沿用既有键；只有无键时才铸造（crypto.randomUUID），冲突/重试绝不在这里换键。 */
function idempotencyKeyFor(deps: 后端操作依赖 & P4运行时引用, intent: string): string {
  const existing = deps.P4幂等意图.current.get(intent);
  if (existing) return existing;
  const created = globalThis.crypto.randomUUID();
  deps.P4幂等意图.current.set(intent, created);
  return created;
}

/** POST 成功但 follow-up GET 失败时的快照 error 文案（§6.4 冻结；旧 items 保留，屏负责呈现）。 */
const 刷新结果未决文案 = '已发起新一轮，结果暂未刷新';

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

// ── scope 读锁的属主登记：单飞 + 过期接管 ──────────────────────────
// 单纯的 Set 锁会让 StrictMode 卸载重挂死锁：旧挂载的在飞读取持锁，cleanup/重挂把
// scope 代际两连跳后，重挂的读取被锁吞掉，旧响应又因栅栏过期整包丢弃 —— 一发 GET、
// 零提交、页面永远 进行中。属主登记让新请求在「在飞属主栅栏已过期」时接管锁。

/** 在飞属主：捕获栅栏 + 属主凭据（token，对象身份即凭据）。 */
interface 读锁属主 {
  fence: P4Fence;
  token: object;
}

/** 按 Provider 锁集隔离的属主表：WeakMap 随锁集（即 Provider / 测试环境）回收。 */
const 读锁属主表 = new WeakMap<Set<string>, Map<string, 读锁属主>>();

/** 一次成功的读锁获取：键 + 本次属主凭据 + 本次捕获的栅栏。 */
interface 读锁凭证 {
  键: string;
  token: object;
  fence: P4Fence;
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

/** 同 失败快照，但文案已按 P4 闭合映射收敛好（mutation 失败不走 取后端错误文案 的通用表）。 */
function 失败快照文案<T>(
  旧: P4ScopeSnapshot<T> | undefined,
  文案: string,
  generation: number,
): P4ScopeSnapshot<T> {
  if (旧?.阶段 === '成功') return { ...旧, 刷新中: false, error: 文案 };
  return { 阶段: '失败', 刷新中: false, items: 旧?.items ?? [], error: 文案, generation };
}

// ── Task 4：反馈落位的纯 helper —— 每次提交都是 设后端状态 的一次纯函数更新 ──

/** jobKey（recruiter:rejected:<排序逗号串>）覆盖某岗位的全部 rejected 快照键。 */
function rejected键覆盖岗位(旧: 后端状态, jobId: string): string[] {
  return Object.keys(旧.招聘已筛候选).filter((键) =>
    键.startsWith('recruiter:rejected:') &&
    键.slice('recruiter:rejected:'.length).split(',').includes(jobId));
}

/** 把同一 recommendation 的每处出现（available/rejected/detail）按 修补 替换 —— 收藏与撤销的同步核。 */
function 替换招聘候选各处(
  旧: 后端状态,
  recommendationId: string,
  修补: (卡: BFF招聘候选推荐) => BFF招聘候选推荐,
): 后端状态 {
  const 逐条 = (items: BFF招聘候选推荐[]) =>
    items.map((卡) => (卡.recommendation_id === recommendationId ? 修补(卡) : 卡));
  const 招聘可用候选: 后端状态['招聘可用候选'] = {};
  for (const [键, 快照] of Object.entries(旧.招聘可用候选)) {
    招聘可用候选[键] = { ...快照, items: 逐条(快照.items) };
  }
  const 招聘已筛候选: 后端状态['招聘已筛候选'] = {};
  for (const [键, 快照] of Object.entries(旧.招聘已筛候选)) {
    招聘已筛候选[键] = { ...快照, items: 逐条(快照.items) };
  }
  const 招聘候选详情 = { ...旧.招聘候选详情 };
  if (招聘候选详情[recommendationId]) {
    招聘候选详情[recommendationId] = 修补(招聘候选详情[recommendationId]);
  }
  return { ...旧, 招聘可用候选, 招聘已筛候选, 招聘候选详情 };
}

/** 404 收口的安全移除：available/rejected 快照过滤 + 详情缓存删除 + 不可用标记（不泄露差异）。 */
function 移除招聘候选各处(旧: 后端状态, recommendationId: string): 后端状态 {
  const 过滤 = (items: BFF招聘候选推荐[]) =>
    items.filter((卡) => 卡.recommendation_id !== recommendationId);
  const 招聘可用候选: 后端状态['招聘可用候选'] = {};
  for (const [键, 快照] of Object.entries(旧.招聘可用候选)) {
    招聘可用候选[键] = { ...快照, items: 过滤(快照.items) };
  }
  const 招聘已筛候选: 后端状态['招聘已筛候选'] = {};
  for (const [键, 快照] of Object.entries(旧.招聘已筛候选)) {
    招聘已筛候选[键] = { ...快照, items: 过滤(快照.items) };
  }
  const 招聘候选详情 = { ...旧.招聘候选详情 };
  delete 招聘候选详情[recommendationId];
  const 招聘候选不可用 = 旧.招聘候选不可用.includes(recommendationId)
    ? 旧.招聘候选不可用
    : [...旧.招聘候选不可用, recommendationId];
  return { ...旧, 招聘可用候选, 招聘已筛候选, 招聘候选详情, 招聘候选不可用 };
}

/** 候选不感兴趣落位：只从当前 scope 快照移除该推荐。 */
function 从候选范围移除(旧: 后端状态, intentionId: string, recommendationId: string): 后端状态 {
  const 快照 = 旧.候选岗位推荐[intentionId];
  if (!快照) return 旧;
  const items = 快照.items.filter((卡) => 卡.recommendation_id !== recommendationId);
  if (items.length === 快照.items.length) return 旧;
  return { ...旧, 候选岗位推荐: { ...旧.候选岗位推荐, [intentionId]: { ...快照, items } } };
}

/** 淘汰落位（权威重读成功后）：available 全部出现移除；覆盖该岗位的 rejected 快照并入
 *  服务端更新卡（rank 稳定序）；详情缓存落权威卡并撤销不可用标记。 */
function 淘汰落位(旧: 后端状态, jobId: string, 卡: BFF招聘候选推荐): 后端状态 {
  const 编号 = 卡.recommendation_id;
  const 招聘可用候选: 后端状态['招聘可用候选'] = {};
  for (const [键, 快照] of Object.entries(旧.招聘可用候选)) {
    招聘可用候选[键] = { ...快照, items: 快照.items.filter((条) => 条.recommendation_id !== 编号) };
  }
  const 招聘已筛候选: 后端状态['招聘已筛候选'] = { ...旧.招聘已筛候选 };
  for (const 键 of rejected键覆盖岗位(旧, jobId)) {
    const 快照 = 招聘已筛候选[键];
    const items = 快照.items.some((条) => 条.recommendation_id === 编号)
      ? 快照.items.map((条) => (条.recommendation_id === 编号 ? 卡 : 条))
      : [...快照.items, 卡].sort((甲, 乙) => 甲.rank - 乙.rank);
    招聘已筛候选[键] = { ...快照, items };
  }
  return {
    ...旧,
    招聘可用候选,
    招聘已筛候选,
    招聘候选详情: { ...旧.招聘候选详情, [编号]: 卡 },
    // 权威卡已回到手：早先的不可用标记一并撤销
    招聘候选不可用: 旧.招聘候选不可用.filter((标记) => 标记 !== 编号),
  };
}

/** 撤销落位：全部 rejected 快照移除；available/detail 出现按回执修正 —— 不回塞不在场卡，
 *  该推荐等未来批次才可再进入 available（§7.3）。 */
function 撤销淘汰落位(旧: 后端状态, recommendationId: string, 回执: BFF发现偏好): 后端状态 {
  const 招聘已筛候选: 后端状态['招聘已筛候选'] = {};
  for (const [键, 快照] of Object.entries(旧.招聘已筛候选)) {
    招聘已筛候选[键] = {
      ...快照,
      items: 快照.items.filter((卡) => 卡.recommendation_id !== recommendationId),
    };
  }
  // BFF发现偏好.rejection_reason 的 'not_interested' 分支对撤销端点是冗余联合成员：
  // 卡片类型只容纳标准淘汰原因，其余取值按 null 落卡（decoder 已闭合输入域）。
  const 卡原因: BFF招聘候选推荐['rejection_reason'] =
    回执.rejection_reason === 'not_interested' ? null : 回执.rejection_reason;
  return 替换招聘候选各处({ ...旧, 招聘已筛候选 }, recommendationId, (卡) => ({
    ...卡,
    favorite: 回执.favorite,
    rejected: 回执.rejected,
    rejection_reason: 卡原因,
    state: 回执.rejected ? 'rejected' : 'available',
  }));
}

// ── Task 4：闭合文案映射（§10）——HTTP BFF错误.code 与 200 回执 refusal/state 分列，P4 页面 ──
//    绝不直接显示后端英文 message；未知 refusal/state 是契约漂移，由 decoder fail closed。

/** P4 HTTP 错误的闭合文案：逐码冻结；只有闭合表之外的 HTTP/运行时错误回落 取后端错误文案。 */
export function P4错误文案(error: unknown): string {
  if (!(error instanceof BFF错误)) return 取后端错误文案(error);
  const copy: Record<string, string> = {
    recommendation_not_found: '这条推荐当前已不可用，请刷新后查看',
    recommendation_unavailable: '这条推荐当前已不可用，请刷新后查看',
    delegation_not_found: '这次委托已不可用，请刷新后查看',
    disclosure_acknowledgement_required: '请先确认简历与联系方式披露说明',
    idempotency_conflict: '这次操作与之前的请求冲突，请刷新后重试',
    source_unavailable: '服务暂时不可用，请稍后再试',
    recruitment_service_unavailable: '服务暂时不可用，请稍后再试',
    operation_outcome_unknown: '操作结果暂未确认，请稍后重试',
  };
  return copy[error.code] ?? 取后端错误文案(error);
}

/** P4 200 回执 refusal_code 的闭合文案（与 HTTP 错误文案分列）。 */
export function P4拒绝文案(code: NonNullable<BFF委托回执['refusal_code']>): string {
  const copy: Record<NonNullable<BFF委托回执['refusal_code']>, string> = {
    recommendation_not_found: '这条推荐当前已不可用，请刷新后查看',
    recommendation_unavailable: '这条推荐当前已不可用，请刷新后查看',
    delegation_not_allowed: '当前无法发起委托，请刷新后重试',
    active_case_quota_reached: '当前在谈已达到上限，请先处理已有在谈',
    delegation_cooldown: '近期已联系过对方，暂时不能重复发起',
  };
  return copy[code];
}

/** P4 200 回执终态的闭合文案。 */
export function P4委托终态文案(state: 'needs_user' | 'refused' | 'failed'): string {
  const copy = {
    needs_user: '这次委托需要你确认后才能继续',
    refused: '这次委托未被接受，请稍后重试',
    failed: '这次委托没有成功，请稍后重试',
  } as const;
  return copy[state];
}

// ── Task 5：委托回执的跨字段校验、闭合文案与落位 ──
// decoder 只闭合字段级契约；跨字段一致性（state↔refusal/case、回执坐标↔所选推荐）归操作层
// fail closed，一律 Chinese invalid_response，绝不把英文后端 message 带上屏（§10）。

/** 回执跨字段约束被破坏时的契约漂移错误（与 facade 的 契约错误 同一口径）。 */
function 委托契约漂移(): BFF错误 {
  return new BFF错误(200, 'invalid_response', '服务返回了不符合契约的发现推荐数据');
}

/**
 * 回执内部一致性与坐标校验（create 与 轮询 GET 共用）：
 *   · state null 必须带闭合非空 refusal_code；
 *   · case_started 必须带非空 case_id；
 *   · 其余状态（accepted/evaluating/needs_user/refused/failed）不得带 case_id；
 *   · 期望推荐编号传入时（招聘侧：选择坐标就是 recommendation_id），回执非空坐标必须一致
 *     （候选侧不传：选择坐标是 job_id，回执 recommendation_id 可空且被完全忽略）。
 */
function 校验委托回执(回执: BFF委托回执, 期望推荐编号?: string): void {
  if (回执.state === null) {
    if (回执.refusal_code === null) throw 委托契约漂移();
  } else if (回执.state === 'case_started') {
    if (回执.case_id === null) throw 委托契约漂移();
  } else if (回执.case_id !== null) {
    throw 委托契约漂移();
  }
  if (期望推荐编号 !== undefined && 回执.recommendation_id !== 期望推荐编号) throw 委托契约漂移();
}

/**
 * 终态/拒绝回执 → 闭合展示文案（§8.2 的精确规则）：
 * state null 只走拒绝码；refused 有码走拒绝码、无码走终态文案；
 * needs_user/failed 无视 schema-valid 可空拒绝码恒走终态文案。
 * active/case_started 没有失败文案，误用按契约漂移当面抛错。
 */
export function P4委托回执文案(回执: BFF委托回执): string {
  const state = 回执.state;
  if (state === null) {
    if (回执.refusal_code === null) throw 委托契约漂移();
    return P4拒绝文案(回执.refusal_code);
  }
  if (state === 'refused' && 回执.refusal_code !== null) return P4拒绝文案(回执.refusal_code);
  if (state === 'needs_user' || state === 'refused' || state === 'failed') return P4委托终态文案(state);
  throw 委托契约漂移();
}

/**
 * 回执 → 卡片委托摘要（§8.2）：accepted/evaluating/case_started 保留摘要供页面显示进行中/
 * 已开案并轮询，needs_user/refused/failed/state null 清摘要（null）——绝不伪造终态摘要。
 */
function 回执摘要(回执: BFF委托回执): BFF委托摘要 | null {
  const state = 回执.state;
  if (state === 'accepted' || state === 'evaluating' || state === 'case_started') {
    return { delegation_id: 回执.delegation_id, state, case_id: 回执.case_id };
  }
  return null;
}

/** 候选卡落摘要：active → delegating、case_started → delegated、终态/清摘要 → 回 available。 */
function 修补候选卡(卡: BFF候选岗位推荐, 摘要: BFF委托摘要 | null): BFF候选岗位推荐 {
  const state = 摘要 === null
    ? 'available'
    : 摘要.state === 'case_started' ? 'delegated' : 'delegating';
  return { ...卡, state, delegation: 摘要 };
}

/** 招聘卡落摘要：招聘卡 state 只有 available/rejected，进行中只体现在委托摘要上。 */
function 修补招聘卡(卡: BFF招聘候选推荐, 摘要: BFF委托摘要 | null): BFF招聘候选推荐 {
  return { ...卡, delegation: 摘要 };
}

/** 回执提交共用的底座：回执表恒按 delegation_id 提交；case_started 额外写且只写 Case 引用。 */
function 提交委托回执(旧: 后端状态, 回执: BFF委托回执): 后端状态 {
  return {
    ...旧,
    P4委托回执: { ...旧.P4委托回执, [回执.delegation_id]: 回执 },
    P4真实Case引用: 回执.state === 'case_started' && 回执.case_id !== null
      ? { ...旧.P4真实Case引用, [回执.delegation_id]: 回执.case_id }
      : 旧.P4真实Case引用,
  };
}

/** 候选创建落位：只修所选 intention scope 里选中推荐的那一张卡（操作输入坐标，§8.2）。 */
function 落候选委托(
  旧: 后端状态, intentionId: string, recommendationId: string, 回执: BFF委托回执,
): 后端状态 {
  const 底座 = 提交委托回执(旧, 回执);
  const 快照 = 底座.候选岗位推荐[intentionId];
  if (!快照) return 底座;
  const 摘要 = 回执摘要(回执);
  const items = 快照.items.map((卡) =>
    (卡.recommendation_id === recommendationId ? 修补候选卡(卡, 摘要) : 卡));
  return { ...底座, 候选岗位推荐: { ...底座.候选岗位推荐, [intentionId]: { ...快照, items } } };
}

/** 招聘创建落位：所选 job 的 available 卡 + 该推荐的详情缓存两处出现。 */
function 落招聘委托(旧: 后端状态, jobId: string, recommendationId: string, 回执: BFF委托回执): 后端状态 {
  let 下 = 提交委托回执(旧, 回执);
  const 摘要 = 回执摘要(回执);
  const 快照 = 下.招聘可用候选[jobId];
  if (快照) {
    下 = {
      ...下,
      招聘可用候选: {
        ...下.招聘可用候选,
        [jobId]: {
          ...快照,
          items: 快照.items.map((卡) =>
            (卡.recommendation_id === recommendationId ? 修补招聘卡(卡, 摘要) : 卡)),
        },
      },
    };
  }
  const 详情 = 下.招聘候选详情[recommendationId];
  if (详情) {
    下 = { ...下, 招聘候选详情: { ...下.招聘候选详情, [recommendationId]: 修补招聘卡(详情, 摘要) } };
  }
  return 下;
}

/**
 * 轮询/单项 GET 的落位：按 delegation_id 找到该角色快照里的每处卡片改摘要 —— 回执坐标
 * （候选侧可空）不可靠，卡片委托摘要里的 delegation_id 才是唯一可靠关联（§8.2）。
 * 回执为 null 表示 404 不可用收口：删除回执行并摘掉每处摘要。
 */
function 按委托编号改摘要(
  旧: 后端状态, role: BFF角色, delegationId: string, 摘要: BFF委托摘要 | null, 回执: BFF委托回执 | null,
): 后端状态 {
  let 底座: 后端状态;
  if (回执 === null) {
    const P4委托回执 = { ...旧.P4委托回执 };
    delete P4委托回执[delegationId];
    底座 = { ...旧, P4委托回执 };
  } else {
    底座 = 提交委托回执(旧, 回执);
  }
  const 命中 = (卡: { delegation: BFF委托摘要 | null }) => 卡.delegation?.delegation_id === delegationId;
  if (role === 'candidate') {
    let 改动 = false;
    const 候选岗位推荐: 后端状态['候选岗位推荐'] = {};
    for (const [键, 快照] of Object.entries(底座.候选岗位推荐)) {
      if (!快照.items.some(命中)) {
        候选岗位推荐[键] = 快照;
        continue;
      }
      改动 = true;
      候选岗位推荐[键] = {
        ...快照,
        items: 快照.items.map((卡) => (命中(卡) ? 修补候选卡(卡, 摘要) : 卡)),
      };
    }
    return 改动 ? { ...底座, 候选岗位推荐 } : 底座;
  }
  const 修招聘快照表 = (表: 后端状态['招聘可用候选']): 后端状态['招聘可用候选'] => {
    let 改动 = false;
    const 下表 = { ...表 };
    for (const [键, 快照] of Object.entries(表)) {
      if (!快照.items.some(命中)) continue;
      改动 = true;
      下表[键] = {
        ...快照,
        items: 快照.items.map((卡) => (命中(卡) ? 修补招聘卡(卡, 摘要) : 卡)),
      };
    }
    return 改动 ? 下表 : 表;
  };
  let 下 = {
    ...底座,
    招聘可用候选: 修招聘快照表(底座.招聘可用候选),
    招聘已筛候选: 修招聘快照表(底座.招聘已筛候选),
  };
  const 详情编号 = Object.keys(下.招聘候选详情).find((键) => 命中(下.招聘候选详情[键]));
  if (详情编号 !== undefined) {
    下 = {
      ...下,
      招聘候选详情: { ...下.招聘候选详情, [详情编号]: 修补招聘卡(下.招聘候选详情[详情编号], 摘要) },
    };
  }
  return 下;
}

export function 创建发现推荐操作(deps: 后端操作依赖): 发现推荐操作 {
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

  function 属主表(): Map<string, 读锁属主> {
    let 表 = 读锁属主表.get(锁.current);
    if (!表) {
      表 = new Map();
      读锁属主表.set(锁.current, 表);
    }
    return 表;
  }

  /**
   * scope 读锁获取 + 过期接管：
   *   · 无在飞属主 → 获取，捕获栅栏即本次属主凭据；
   *   · 在飞属主栅栏仍新（subject/role/会话代际/可见范围/scope 代际 全部一致）→ 单飞让路（null）；
   *   · 在飞属主栅栏已过期（StrictMode 卸载重挂 / 登出换代 / 换 scope）→ 新请求接管锁：
   *     换上自己的栅栏与 token 重发 GET；旧属主的迟到结算按它自己的栅栏整包丢弃，
   *     其 finally 发现 token 已易主，绝不动新属主的锁。
   */
  function 获取读锁(scopeKey: string): 读锁凭证 | null {
    const 键 = 读锁键(scopeKey);
    const 表 = 属主表();
    const 现属主 = 表.get(键);
    if (现属主 && fenceStillCurrent(引用, 现属主.fence)) return null;
    const fence = 捕获栅栏(引用, scopeKey);
    const token: object = {};
    表.set(键, { fence, token });
    return { 键, token, fence };
  }

  /** 释放 scope 读锁：仅当属主仍是自己（未被接管）时才真正释放键。 */
  function 释放读锁(取得: 读锁凭证): void {
    const 表 = 属主表();
    if (表.get(取得.键)?.token === 取得.token) {
      表.delete(取得.键);
      锁.current.delete(取得.键);
    }
  }

  /**
   * scope 读取统一核：获取读锁（含过期接管）→ 起步提交 → 读 → 栅栏内才结算。
   * 迟到成败（含迟到 401）只走 finally 且仅在锁属主仍是自己时释放；栅栏内的 401 走统一 清账号状态。
   */
  async function 运行范围读<T>(input: {
    scopeKey: string;
    读: (数据源: HTTP招聘数据源) => Promise<T>;
    开始: (fence: ReturnType<typeof 捕获栅栏>) => void;
    成功: (结果: T, fence: ReturnType<typeof 捕获栅栏>) => void;
    失败: (错误: unknown, fence: ReturnType<typeof 捕获栅栏>) => void;
  }): Promise<void> {
    const 取得 = 获取读锁(input.scopeKey);
    if (!取得) return;
    try {
      // 数据源守卫必须先于起步提交：否则这条（当前不可达的）路径会把快照永远搁在 进行中
      if (!后端) return;
      input.开始(取得.fence);
      const 结果 = await input.读(后端);
      if (!fenceStillCurrent(引用, 取得.fence)) return;
      input.成功(结果, 取得.fence);
    } catch (错误) {
      if (!fenceStillCurrent(引用, 取得.fence)) return;
      if (是401(错误)) {
        清账号状态(账号清理依赖);
        return;
      }
      input.失败(错误, 取得.fence);
    } finally {
      释放读锁(取得);
    }
  }

  /**
   * 刷新统一核：POST 建新批次（一次用户意图一把显式幂等键）→ 权威 GET → 栅栏内原子提交。
   * 键生命周期（§9.3）：network_error / operation_outcome_unknown / 中断 保留键，同一意图的
   * 重试沿用；idempotency_conflict 绝不换新键强发 —— 先重读权威 scope 对账，对账成功才释放；
   * 完整 POST+GET 成功才释放，下一次刷新才是新意图。POST 成功 + follow-up GET 失败不清旧列表，
   * 快照 error 落 刷新结果未决文案 且不抛（呈现是屏的关注点）。
   */
  async function 运行范围刷新<T>(input: {
    scopeKey: string;
    发起: (源: HTTP招聘数据源, 幂等键: string) => Promise<unknown>;
    重读: (源: HTTP招聘数据源) => Promise<T>;
    开始: (fence: P4Fence) => void;
    成功: (items: T, fence: P4Fence) => void;
    失败: (文案: string, fence: P4Fence) => void;
  }): Promise<void> {
    // scope 全量 GET 与 refresh 按 scope 串行（§9.2）：与读核共用同一把读锁 + 同一张属主表。
    // 在飞属主栅栏仍新 → 刷新让位（原样）；栅栏已过期（StrictMode 重挂 / 换代）→ 接管重发 ——
    // 旧属主的 POST 迟到结算按它自己的栅栏丢弃，token 易主后它也动不了新属主的锁。
    const 取得 = 获取读锁(input.scopeKey);
    if (!取得) return;
    const fence = 取得.fence;
    try {
      if (!后端) return;
      input.开始(fence);
      const intent = refreshKey(input.scopeKey);
      const 幂等键 = idempotencyKeyFor(引用, intent);
      try {
        await input.发起(后端, 幂等键);
      } catch (错误) {
        if (!fenceStillCurrent(引用, fence)) return; // 迟到失败只释放锁；键随意图保留
        if (是401(错误)) {
          清账号状态(账号清理依赖); // 统一清理已清空 P4幂等意图
          throw 错误;
        }
        if (错误 instanceof BFF错误 && 错误.code === 'idempotency_conflict') {
          // 冲突先重读权威 scope 对账；对账请求成功（含栅栏外完成）才释放键；冲突原文照抛给屏
          let 已对账 = false;
          try {
            const items = await input.重读(后端);
            已对账 = true;
            if (fenceStillCurrent(引用, fence)) input.成功(items, fence);
          } catch {
            if (fenceStillCurrent(引用, fence)) input.失败(P4错误文案(错误), fence);
          }
          if (已对账) P4幂等意图.current.delete(intent);
          throw 错误;
        }
        input.失败(P4错误文案(错误), fence);
        throw 错误;
      }
      let items: T;
      try {
        items = await input.重读(后端);
      } catch {
        if (!fenceStillCurrent(引用, fence)) return;
        input.失败(刷新结果未决文案, fence);
        return;
      }
      P4幂等意图.current.delete(intent);
      if (!fenceStillCurrent(引用, fence)) return;
      input.成功(items, fence);
    } finally {
      释放读锁(取得);
    }
  }

  /**
   * 反馈写统一核：按资源单飞（同一推荐的 favorite/rejection/not-interested 串行，跨推荐并行，
   * §9.2）→ 捕获栅栏 → 服务端先行 → 栅栏内才落任何本地变化。失败绝不移动卡片；
   * 401 统一 清账号状态 后照抛；404 按统一不可用收口（安全移除 + scope 重读）即达成意图不抛；
   * 其余错误原样抛给屏。锁用独立的 P4写: 资源键，不与读锁属主表交互。
   */
  async function 运行反馈写<T>(input: {
    资源键: string;
    scopeKey: string;
    写: (源: HTTP招聘数据源) => Promise<T>;
    收口404: (fence: P4Fence) => Promise<void>;
    成功: (回执: T, 源: HTTP招聘数据源, fence: P4Fence) => void | Promise<void>;
  }): Promise<void> {
    if (锁.current.has(input.资源键)) return; // 同一推荐在飞：本次写直接让位
    锁.current.add(input.资源键);
    const fence = 捕获栅栏(引用, input.scopeKey);
    try {
      if (!后端) return;
      let 回执: T;
      try {
        回执 = await input.写(后端);
      } catch (错误) {
        if (!fenceStillCurrent(引用, fence)) return;
        if (是401(错误)) {
          清账号状态(账号清理依赖);
          throw 错误;
        }
        if (错误 instanceof BFF错误 && 错误.status === 404) {
          await input.收口404(fence);
          return;
        }
        throw 错误;
      }
      if (!fenceStillCurrent(引用, fence)) return;
      await input.成功(回执, 后端, fence);
    } finally {
      锁.current.delete(input.资源键);
    }
  }

  /** 404 统一不可用收口（招聘侧）：先安全移除每一处出现并标记不可用，再重读 available scope
   *  收敛；重读失败静默 —— 安全移除已达成不可用事实，下一轮加载自愈。 */
  async function 招聘反馈404收口(jobId: string, recommendationId: string, fence: P4Fence): Promise<void> {
    if (!后端) return;
    设后端状态((旧) => 移除招聘候选各处(旧, recommendationId));
    try {
      const items = await 后端.读取招聘候选(jobId);
      if (!fenceStillCurrent(引用, fence)) return;
      设后端状态((旧) => ({
        ...旧,
        招聘可用候选: { ...旧.招聘可用候选, [jobId]: 成功快照(items, fence.scopeGeneration) },
      }));
    } catch {
      // 收口重读失败不补提示：移除事实已落，重读交给下一轮
    }
  }

  /** 404 统一不可用收口（候选侧）：从当前 scope 移除后重读同一 scope 收敛，口径同上。 */
  async function 候选反馈404收口(
    intentionId: string, recommendationId: string, fence: P4Fence,
  ): Promise<void> {
    if (!后端) return;
    设后端状态((旧) => 从候选范围移除(旧, intentionId, recommendationId));
    try {
      const items = await 后端.读取候选岗位推荐(intentionId);
      if (!fenceStillCurrent(引用, fence)) return;
      设后端状态((旧) => ({
        ...旧,
        候选岗位推荐: { ...旧.候选岗位推荐, [intentionId]: 成功快照(items, fence.scopeGeneration) },
      }));
    } catch {
      // 同上
    }
  }

  // ── Task 5：委托创建的单飞与统一核 ──

  /**
   * 委托创建单飞表：同 pair（candidate-intention-job / recruiter-job-recommendation）的并发
   * 点击共享同一次在飞 POST（§9.2），完成即摘除。共用 Promise 而不是静默让位 —— 委托的
   * 调用方要拿到回执。delegation GET（刷新委托）绝不查这张表、不取任何创建锁。
   */
  const 委托在飞 = new Map<string, Promise<BFF委托回执>>();

  function 单飞委托创建(键: string, 运行: () => Promise<BFF委托回执>): Promise<BFF委托回执> {
    const 在飞 = 委托在飞.get(键);
    if (在飞) return 在飞;
    const 本次 = 运行().finally(() => {
      委托在飞.delete(键);
    });
    委托在飞.set(键, 本次);
    return 本次;
  }

  /**
   * 委托创建统一核：捕获栅栏 → 发起 POST（一次用户意图一把显式幂等键）→ 恰好一条回执 →
   * 跨字段/坐标校验 → 权威回执在手释放意图键（明确成功与明确拒绝都是完成）→ 栅栏内才落
   * 本地状态。transport/conflict/401 一律保留意图键（结果不确定 / 冲突绝不换键强发，§9.3）；
   * 栅栏内的 401 走统一 清账号状态。终态/拒绝回执先提交再按 §8.2 文案抛 BFF错误 —— 屏的
   * catch(P4错误文案) 恰好原样呈现；迟到成功只不落本地、照常返回回执。
   */
  async function 运行委托创建(input: {
    scopeKey: string;
    意图对象: string;
    发起: (源: HTTP招聘数据源, 幂等键: string) => Promise<BFF委托回执[]>;
    校验: (回执: BFF委托回执) => void;
    提交: (回执: BFF委托回执) => void;
  }): Promise<BFF委托回执> {
    if (!后端) throw new Error('委托只在 Backend 数据源下可用'); // 与各域同一守卫：调用方已早退，这里兜底
    const fence = 捕获栅栏(引用, input.scopeKey);
    const intent = delegationKey(fence.visibleScope ?? input.scopeKey, input.意图对象);
    let 批次: BFF委托回执[];
    try {
      批次 = await input.发起(后端, idempotencyKeyFor(引用, intent));
    } catch (错误) {
      if (!fenceStillCurrent(引用, fence)) throw 错误; // 迟到失败只随单飞收口；键随意图保留
      if (是401(错误)) {
        清账号状态(账号清理依赖);
      }
      throw 错误;
    }
    // facade 的 解委托批次 已按恰好一条闭合；防御性再守一道，绝不取 [0] 于空批次
    if (批次.length !== 1) throw 委托契约漂移();
    const 回执 = 批次[0];
    input.校验(回执);
    P4幂等意图.current.delete(intent);
    if (!fenceStillCurrent(引用, fence)) return 回执; // 迟到成功只不落本地
    input.提交(回执);
    if (回执.state === 'accepted' || 回执.state === 'evaluating' || 回执.state === 'case_started') {
      return 回执;
    }
    // 终态/拒绝回执在提交后按闭合文案抛出。错误 code 优先取 state 而不是 refusal_code：
    // 屏的 catch 是 轻提示(P4错误文案(error))，state 形式的 code 不在 HTTP 闭合表里、
    // 恰好回落 message 展示，needs_user/failed 带拒绝码时也绝不会被 HTTP 拒绝码文案截胡。
    throw new BFF错误(200, 回执.state ?? 回执.refusal_code ?? 'invalid_response', P4委托回执文案(回执));
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
      const 取得 = 获取读锁(scopeKey);
      if (!取得) return;
      try {
        const job = await 后端.读取候选岗位详情(jobId);
        if (!fenceStillCurrent(引用, 取得.fence)) return;
        设后端状态((旧) => ({
          ...旧,
          候选岗位详情: { ...旧.候选岗位详情, [jobId]: job },
          // 权威 Job 已回到手：早先的不可用标记一并撤销
          候选岗位不可用: 旧.候选岗位不可用.filter((编号) => 编号 !== jobId),
        }));
      } catch (错误) {
        if (!fenceStillCurrent(引用, 取得.fence)) return;
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
        释放读锁(取得);
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
      const 取得 = 获取读锁(scopeKey);
      if (!取得) return;
      try {
        const 卡 = await 后端.读取招聘候选详情(jobId, recommendationId);
        if (!fenceStillCurrent(引用, 取得.fence)) return;
        设后端状态((旧) => ({
          ...旧,
          招聘候选详情: { ...旧.招聘候选详情, [recommendationId]: 卡 },
          招聘候选不可用: 旧.招聘候选不可用.filter((编号) => 编号 !== recommendationId),
        }));
      } catch (错误) {
        if (!fenceStillCurrent(引用, 取得.fence)) return;
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
        释放读锁(取得);
      }
    },

    // ── Task 4：刷新 mutation（POST 建批次 + GET 重读，键生命周期见 运行范围刷新）──

    async 刷新候选岗位(intentionId) {
      if (!是后端 || !后端) return;
      await 运行范围刷新<BFF候选岗位推荐[]>({
        scopeKey: P4范围键.候选列表(intentionId),
        发起: (源, 幂等键) => 源.刷新候选岗位推荐(intentionId, 幂等键),
        重读: (源) => 源.读取候选岗位推荐(intentionId),
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
        失败: (文案, fence) => 设后端状态((旧) => ({
          ...旧,
          候选岗位推荐: {
            ...旧.候选岗位推荐,
            [intentionId]: 失败快照文案(旧.候选岗位推荐[intentionId], 文案, fence.scopeGeneration),
          },
        })),
      });
    },

    async 刷新招聘候选(jobId) {
      if (!是后端 || !后端) return;
      await 运行范围刷新<BFF招聘候选推荐[]>({
        scopeKey: P4范围键.招聘列表(jobId),
        发起: (源, 幂等键) => 源.刷新招聘候选(jobId, 幂等键),
        重读: (源) => 源.读取招聘候选(jobId),
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
        失败: (文案, fence) => 设后端状态((旧) => ({
          ...旧,
          招聘可用候选: {
            ...旧.招聘可用候选,
            [jobId]: 失败快照文案(旧.招聘可用候选[jobId], 文案, fence.scopeGeneration),
          },
        })),
      });
    },

    // ── Task 4：反馈 mutation（服务端先行，失败绝不移动卡片）──

    /** 候选不感兴趣：PUT 成功且回执确认 rejection_reason: not_interested 才从当前 scope 移除。 */
    async 标记岗位不感兴趣(intentionId, recommendationId) {
      await 运行反馈写<BFF发现偏好>({
        资源键: `P4写:candidate:${recommendationId}`,
        scopeKey: P4范围键.候选列表(intentionId),
        写: (源) => 源.标记候选岗位不感兴趣(recommendationId),
        收口404: (fence) => 候选反馈404收口(intentionId, recommendationId, fence),
        成功: (回执) => {
          // 其余取值是契约漂移：fail closed 保留卡片，绝不按成功移除
          if (回执.rejection_reason !== 'not_interested') {
            throw new BFF错误(200, 'invalid_response', '服务返回了不符合契约的发现推荐数据');
          }
          设后端状态((旧) => 从候选范围移除(旧, intentionId, recommendationId));
        },
      });
    },

    /** 收藏：服务端权威偏好回执同步 available/rejected/detail 每一处出现的 favorite。 */
    async 设置候选收藏(jobId, recommendationId, favorite) {
      await 运行反馈写<BFF发现偏好>({
        资源键: `P4写:${jobId}:${recommendationId}`,
        scopeKey: P4范围键.招聘列表(jobId),
        写: (源) => 源.设置招聘候选收藏(jobId, recommendationId, favorite),
        收口404: (fence) => 招聘反馈404收口(jobId, recommendationId, fence),
        成功: (回执) => {
          // favorite 与 rejection 相互独立：只修 favorite，不动 rejected 状态字段
          设后端状态((旧) => 替换招聘候选各处(旧, recommendationId, (卡) => ({
            ...卡, favorite: 回执.favorite,
          })));
        },
      });
    },

    /** 淘汰：PUT 成功后权威重读详情，拿到服务端更新卡才整体从 available 移入 rejected；
     *  重读失败则卡原地不动，绝不半搬。 */
    async 淘汰候选(jobId, recommendationId, reason) {
      await 运行反馈写<BFF发现偏好>({
        资源键: `P4写:${jobId}:${recommendationId}`,
        scopeKey: P4范围键.招聘列表(jobId),
        写: (源) => 源.设置招聘候选淘汰(jobId, recommendationId, reason),
        收口404: (fence) => 招聘反馈404收口(jobId, recommendationId, fence),
        成功: async (_回执, 源, fence) => {
          let 卡: BFF招聘候选推荐;
          try {
            卡 = await 源.读取招聘候选详情(jobId, recommendationId);
          } catch (错误) {
            if (!fenceStillCurrent(引用, fence)) return;
            if (是401(错误)) {
              清账号状态(账号清理依赖);
              throw 错误;
            }
            if (错误 instanceof BFF错误 && 错误.status === 404) {
              await 招聘反馈404收口(jobId, recommendationId, fence);
              return;
            }
            throw 错误;
          }
          if (!fenceStillCurrent(引用, fence)) return;
          设后端状态((旧) => 淘汰落位(旧, jobId, 卡));
        },
      });
    },

    /** 撤销淘汰：DELETE 成功后按回执从 rejected 移除并修正详情缓存；不回塞当前 available
     *  批次 —— 后端语义是该推荐可进入未来批次（§7.3）。 */
    async 撤销淘汰候选(jobId, recommendationId) {
      await 运行反馈写<BFF发现偏好>({
        资源键: `P4写:${jobId}:${recommendationId}`,
        scopeKey: P4范围键.招聘列表(jobId),
        写: (源) => 源.撤销招聘候选淘汰(jobId, recommendationId),
        收口404: (fence) => 招聘反馈404收口(jobId, recommendationId, fence),
        成功: (回执) => {
          设后端状态((旧) => 撤销淘汰落位(旧, recommendationId, 回执));
        },
      });
    },

    // ── Task 5：委托（真实回执，绝不在 P4 制造 MatchCase）──

    /**
     * 候选委托岗位（§8.1/§8.2）：disclosureAcknowledged 是字面 true —— 只有 确认层 的字面
     * 确认才走到这里，确认不复用。选择坐标是 job_id；回执 recommendation_id 可空且被完全
     * 忽略，落位一律用操作输入的 recommendationId。终态/拒绝回执在提交后按闭合文案抛出。
     */
    async 委托候选岗位(input) {
      if (!是后端 || !后端) throw new Error('委托只在 Backend 数据源下可用');
      const { intentionId, recommendationId, jobId, disclosureAcknowledged } = input;
      return 单飞委托创建(`P4委托:candidate:${intentionId}:${jobId}`, () =>
        运行委托创建({
          scopeKey: P4范围键.候选列表(intentionId),
          意图对象: jobId,
          发起: (源, 幂等键) => 源.创建候选岗位委托({
            intentionId, jobId, idempotencyKey: 幂等键, disclosureAcknowledged,
          }),
          校验: (回执) => 校验委托回执(回执),
          提交: (回执) =>
            设后端状态((旧) => 落候选委托(旧, intentionId, recommendationId, 回执)),
        }));
    },

    /** 招聘委托候选：无披露确认；选择坐标是 recommendation_id，回执非空坐标必须一致。 */
    async 委托招聘候选(jobId, recommendationId) {
      if (!是后端 || !后端) throw new Error('委托只在 Backend 数据源下可用');
      return 单飞委托创建(`P4委托:recruiter:${jobId}:${recommendationId}`, () =>
        运行委托创建({
          scopeKey: P4范围键.招聘列表(jobId),
          意图对象: recommendationId,
          发起: (源, 幂等键) => 源.创建招聘候选委托({ jobId, recommendationId, idempotencyKey: 幂等键 }),
          校验: (回执) => 校验委托回执(回执, recommendationId),
          提交: (回执) => 设后端状态((旧) => 落招聘委托(旧, jobId, recommendationId, 回执)),
        }));
    },

    /**
     * 刷新委托（§8.3 轮询的操作层半边）：单项权威 GET。不取创建单飞、不取任何写锁 ——
     * 安全由页面的轮询单飞与本栅栏保证。回执按 delegation_id 提交并落到每处卡片；
     * 404 按统一不可用收口（删回执行 + 摘摘要，不抛）；栅栏内 401 走统一清理且不向轮询抛
     * （读路径口径）；迟到成败只丢弃。
     */
    async 刷新委托(role, delegationId) {
      if (!是后端 || !后端) return;
      const scopeKey = P4可见范围.current[role] ?? `P4委托轮询:${role}`;
      const fence = 捕获栅栏(引用, scopeKey);
      try {
        const 回执 = role === 'candidate'
          ? await 后端.读取候选岗位委托(delegationId)
          : await 后端.读取招聘候选委托(delegationId);
        校验委托回执(回执);
        if (回执.delegation_id !== delegationId) throw 委托契约漂移();
        if (!fenceStillCurrent(引用, fence)) return; // 迟到回执只丢弃（§9.1）
        设后端状态((旧) => 按委托编号改摘要(旧, role, delegationId, 回执摘要(回执), 回执));
      } catch (错误) {
        if (!fenceStillCurrent(引用, fence)) return;
        if (是401(错误)) {
          清账号状态(账号清理依赖);
          return;
        }
        if (错误 instanceof BFF错误 && 错误.status === 404) {
          设后端状态((旧) => 按委托编号改摘要(旧, role, delegationId, null, null));
          return;
        }
        throw 错误;
      }
    },
  };
}
