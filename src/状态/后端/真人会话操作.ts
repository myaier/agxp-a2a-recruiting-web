// 后端真人会话域操作（P7 Task 2）：双端 conversations 的内存态 scope 快照、
// 收件箱/详情/消息分页、意图键化的纯文本发送与结果未知对账、forward-only 已读
// 与事件失效通知。
// 铁律（spec §7/§12 与已准入 P7 冻结契约）：
//   · Backend 才发请求（!是后端 || !后端 一律早退）；Mock 模式零 P7 请求，
//     接口失败绝不回退 Mock。快照 / 锁 / 意图 / 已读位置只在内存（后端状态 +
//     运行时引用），绝不进 资料持久化、浏览器存储、Cache API 或 Service Worker。
//   · 栅栏 = subject_id + active role + session generation + scope generation +
//     read generation，每个请求发送前捕获；任一不匹配的迟到成败只释放本轮锁 ——
//     不写快照、不派发、不做 401 清理（迟到的 401 绝不能登出新会话）。
//   · 发送不乐观追加。每个 (role + conversation + trim 后正文) 同时最多一个待定
//     意图：key 由 crypto.randomUUID 铸造（16–128 可见 ASCII）、watermark 是发送前
//     最新 user_text 坐标、正文不可变；同一意图的所有重试沿用同一把 key。
//   · operation_outcome_unknown / 网络不确定：立即 no-store 重拉消息与收件箱对账；
//     水位后见到「本端 + 完全相同 trim 正文」才收敛 confirmed；重拉成功无证据
//     = outcome_unknown 可放弃；重拉失败 = outcome_unknown 不可放弃（只允许同键重试）。
//     非空水位不在重拉窗口时绝不宣称成功。最终 idempotency_in_progress 保留原键，
//     返回不可放弃的 in_progress。idempotency_conflict 终局：刷新权威消息、原样抛出、
//     键释放（换内容即新键）。其余 4xx 明确拒绝释放键；role_required / role_suspended
//     不清有效会话、不代重试。401 统一 清账号状态 + 清 P7 引用。
//   · 已读只接受 decimal user_text 坐标，十进制 ID 保持 string 比较、绝不转 number；
//     与上次成功 / 在飞 / 终局拒绝相同 target 零请求；role_required / role_suspended
//     把 target 记终局拒绝，直到换 target 或会话清理复位；成功后刷新详情与收件箱。
//   · 列表读按 scope 单飞（属主登记 + 过期接管，StrictMode 卸载重挂不死锁）；
//     已 成功 的快照刷新途中保留旧 items 不降级；404 清空旧内容（不泄漏上一会话），
//     其余失败保留旧成功只落重试错误。
//   · 会话不能由浏览器创建：详情/消息只按会话坐标读取；context 不提供真名、电话、
//     微信或简历正文，本层原样透传 viewer-safe 投影，绝不从 Mock 补值。

import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type { BFF角色 } from '../../数据/BFF契约';
import type { P7角色, P7会话项, P7会话页, P7消息, P7消息页 } from '../../数据/招聘数据源/真人会话';
import { 清账号状态 } from './会话操作';
import type {
  P7发送结果,
  P7分页快照,
  P7详情快照,
  P7待定意图,
  P7运行时引用,
  P7会话状态,
  后端操作依赖,
  后端状态,
  真人会话操作,
} from './类型';

/** opaque id 的键内转义：与 MatchCase操作 同一纪律，含 `:`/`,` 的 id 逐段转义绝不撞键。 */
function 段(值: string): string {
  return encodeURIComponent(值);
}

/** scope 键的冻结表：收件箱按角色、详情/消息按 role + 会话坐标。 */
export const P7范围键 = {
  收件箱: (role: P7角色): string => `p7:inbox:${role}`,
  详情: (role: P7角色, conversationId: string): string =>
    `p7:detail:${role}:${段(conversationId)}`,
  消息: (role: P7角色, conversationId: string): string =>
    `p7:messages:${role}:${段(conversationId)}`,
} as const;

/** 已读位置表键（与 详情/消息 同形：role + 会话坐标）。 */
function 已读位置键(role: P7角色, conversationId: string): string {
  return `p7:read:${role}:${段(conversationId)}`;
}

/** 复合意图键（内存 Map 的键，可含中文正文）：role + 会话坐标 + trim 后正文。 */
function 意图键(role: P7角色, conversationId: string, 正文: string): string {
  return ['p7:意图', role, 段(conversationId), 段(正文)].join(':');
}

/** 发布坐标的十进制闭合模式（与数据源 真人会话.ts 同款，1–64 位）。 */
const 坐标模式 = /^[1-9][0-9]{0,63}$/;

/** 发送正文 trim 后的 Unicode code point 上限；计数用 Array.from，不用 UTF-16 length。 */
const 正文码点上限 = 2000;

/**
 * Backend 消息 Tab 角标：只汇总当前已加载收件箱页的 unreadCount。
 * 它是「已加载会话的未读」，不是账号全量总数 —— UI 不得宣称全量；
 * 加载更多自然扩大统计范围，read-through 后由权威收件箱刷新下降。
 */
export function 数P7已加载未读(items: P7会话项[]): number {
  return items.reduce((和, 条) => 和 + 条.unreadCount, 0);
}

/** P7 真人会话的可复用初始化/重置底座：Provider 首帧与会话转移口共用同一形状。 */
export function 创建空P7会话状态(): P7会话状态 {
  return {
    P7收件箱: {
      candidate: 空分页快照(),
      recruiter: 空分页快照(),
    },
    P7会话详情: {},
    P7消息页: {},
  };
}

function 空分页快照(): P7分页快照<never> {
  return {
    阶段: '未开始', 刷新中: false, items: [], nextCursor: null, 已加载页数: 0,
    error: null, generation: 0,
  };
}

/**
 * P7 引用级清理：scope 代际 / 待定发送意图 / 已读位置三个 Map 清空、双端可见
 * 收件箱与可见会话复位。会话转移（登出 / 401 / 换主体 / 切角色）统一走这里；
 * 可选成员缺省时（旧依赖桩）静默跳过，raw 快照仍由 创建空P7会话状态() 兜底。
 */
export function 清P7会话引用(
  deps: Partial<Pick<后端操作依赖,
    'P7范围代际' | 'P7待定意图' | 'P7可见收件箱' | 'P7可见会话' | 'P7已读位置'>>,
): void {
  deps.P7范围代际?.current.clear();
  deps.P7待定意图?.current.clear();
  deps.P7已读位置?.current.clear();
  if (deps.P7可见收件箱) deps.P7可见收件箱.current = { candidate: false, recruiter: false };
  if (deps.P7可见会话) deps.P7可见会话.current = { candidate: null, recruiter: null };
}

/** Provider 恒注入五个 P7 引用；缺引用是接线缺陷，在工厂入口尽早暴露而不是静默错栅栏。 */
function 取P7引用(deps: 后端操作依赖): 后端操作依赖 & P7运行时引用 {
  if (!deps.P7范围代际 || !deps.P7待定意图 || !deps.P7可见收件箱 || !deps.P7可见会话 || !deps.P7已读位置) {
    throw new Error('P7 真人会话运行时引用未初始化（Provider 必须一次性注入）');
  }
  return deps as 后端操作依赖 & P7运行时引用;
}

/** 401 统一判据：会话失效一律 清账号状态（与其它域同口径）。 */
function 是401(错误: unknown): boolean {
  return 错误 instanceof BFF错误 && 错误.status === 401;
}

/**
 * 结果不确定判据：409/500/503/transport(0) 与闭合的结果未知码（含普通网络异常）。
 * idempotency_in_progress 不在此列 —— 它在发送路径里单独分派为 in_progress。
 */
function 是结果不确定(错误: BFF错误): boolean {
  if (错误.code === 'operation_outcome_unknown') return true;
  return 错误.status === 0 || 错误.status === 409 || 错误.status === 500 || 错误.status === 503;
}

/**
 * P7 专属公开错误文案（spec §12 表）：未知错误码统一「请求失败，请稍后重试」，
 * 绝不透传后端英文 message；断网 / 502/503/504 / invalid_response / invalid_session
 * 复用 取后端错误文案 的既有闭合分支。
 */
const P7专属文案: Record<string, string> = {
  conversation_not_found: '这段会话不存在或已不可访问',
  invalid_request_body: '当前消息无法发送，请检查内容后重试',
  idempotency_conflict: '发送状态发生冲突，请刷新后确认',
  operation_outcome_unknown: '暂时无法确认是否发送成功',
  request_too_large: '消息太长，请缩短后再发送',
  idempotency_in_progress: '消息仍在处理中，请稍后重试',
  invalid_origin: '当前后端环境配置不正确',
  role_required: '当前身份不可用，请切换身份或重新登录',
  role_suspended: '当前身份不可用，请切换身份或重新登录',
  identity_service_unavailable: '账号服务暂时不可用，请重试',
  recruitment_service_unavailable: '招聘信息暂时不可用，请重试',
  message_service_unavailable: '消息服务暂时不可用，请重试',
};

export function 取P7错误文案(错误: unknown): string {
  if (!(错误 instanceof BFF错误)) return 取后端错误文案(错误);
  const 专属 = P7专属文案[错误.code];
  if (专属 !== undefined) return 专属;
  if (错误.status === 0 || 错误.code === 'network_error') return '无法连接后端服务，请检查网络或稍后重试';
  if (错误.status === 502 || 错误.status === 503 || 错误.status === 504) return '后端服务暂时不可用，请稍后重试';
  if (错误.code === 'invalid_response') return '服务返回异常，请稍后重试';
  if (错误.code === 'invalid_session') return '登录已失效，请重新登录';
  return '请求失败，请稍后重试';
}

/** 每个异步读写发送前捕获的栅栏：subject + active role + 会话代际 + scope/读代际。 */
interface P7栅栏 {
  subjectId: string | null;
  role: BFF角色 | null;
  sessionGeneration: number;
  scopeKey: string;
  scopeGeneration: number;
  readGeneration: number;
}

/** 读代际在 P7范围代际 表里的虚拟键（随 清P7会话引用 一并清）。 */
function 读代际键(scopeKey: string): string {
  return `${scopeKey}#读`;
}

// ── scope 读锁的属主登记：单飞 + 过期接管（与 MatchCase操作 同一模式）──────────────

interface 读锁属主 {
  fence: P7栅栏;
  token: object;
}

const 读锁属主表 = new WeakMap<Set<string>, Map<string, 读锁属主>>();

interface 读锁凭证 {
  键: string;
  token: object;
  fence: P7栅栏;
}

// ── 快照的纯构造器：起步 / 成功 / 失败（成功快照永不降级；404 清空旧内容）──────────────

function 起步分页<T>(旧: P7分页快照<T> | undefined, generation: number): P7分页快照<T> {
  if (旧?.阶段 === '成功') return { ...旧, 刷新中: true, error: null, generation };
  return {
    阶段: '进行中', 刷新中: true,
    items: 旧?.items ?? [], nextCursor: 旧?.nextCursor ?? null, 已加载页数: 旧?.已加载页数 ?? 0,
    error: null, generation,
  };
}

function 成功分页<T>(
  items: T[], nextCursor: string | null, 已加载页数: number, generation: number,
): P7分页快照<T> {
  return { 阶段: '成功', 刷新中: false, items, nextCursor, 已加载页数, error: null, generation };
}

function 失败分页<T>(旧: P7分页快照<T> | undefined, 错误: unknown, generation: number): P7分页快照<T> {
  const error = 取P7错误文案(错误);
  // 404：foreign / wrong-role / unpublished 全部 fail closed —— 不泄漏上一会话残留。
  if (错误 instanceof BFF错误 && 错误.code === 'conversation_not_found') {
    return { 阶段: '失败', 刷新中: false, items: [], nextCursor: null, 已加载页数: 0, error, generation };
  }
  if (旧?.阶段 === '成功') return { ...旧, 刷新中: false, error, generation };
  return {
    阶段: '失败', 刷新中: false,
    items: 旧?.items ?? [], nextCursor: 旧?.nextCursor ?? null, 已加载页数: 旧?.已加载页数 ?? 0,
    error, generation,
  };
}

function 起步详情(旧: P7详情快照 | undefined, generation: number): P7详情快照 {
  if (旧?.阶段 === '成功') return { ...旧, 刷新中: true, error: null, generation };
  return { 阶段: '进行中', 刷新中: true, detail: 旧?.detail ?? null, error: null, generation };
}

function 成功详情(detail: P7会话项, generation: number): P7详情快照 {
  return { 阶段: '成功', 刷新中: false, detail, error: null, generation };
}

function 失败详情(旧: P7详情快照 | undefined, 错误: unknown, generation: number): P7详情快照 {
  const error = 取P7错误文案(错误);
  if (错误 instanceof BFF错误 && 错误.code === 'conversation_not_found') {
    return { 阶段: '失败', 刷新中: false, detail: null, error, generation };
  }
  if (旧?.阶段 === '成功') return { ...旧, 刷新中: false, error, generation };
  return { 阶段: '失败', 刷新中: false, detail: 旧?.detail ?? null, error, generation };
}

export function 创建真人会话操作(deps: 后端操作依赖): 真人会话操作 {
  const { 是后端, 后端, 设后端状态, 后端状态引用, 主体标识引用, 会话代际 } = deps;
  const 引用 = 取P7引用(deps);
  const { P7范围代际, P7待定意图, P7可见收件箱, P7可见会话, P7已读位置 } = 引用;
  // 清账号状态 需要的子集（与其它域同口径；P7 引用由 清P7会话引用 单独收口）
  const 账号清理依赖 = {
    派发: deps.派发, 设后端状态, 后端, 主体标识引用, 会话代际,
    P4范围代际: deps.P4范围代际, P4幂等意图: deps.P4幂等意图, P4可见范围: deps.P4可见范围,
    P7范围代际, P7待定意图, P7可见收件箱, P7可见会话, P7已读位置,
    候选预填代际: deps.候选预填代际, 候选预填读取锁: deps.候选预填读取锁, 候选预填恢复: deps.候选预填恢复,
  };

  /** 401 的统一收口：清账号状态（含 P4/P7 状态与引用）+ P7 状态摊平与引用级清理。 */
  function 清账号与P7(): void {
    清账号状态(账号清理依赖);
    设后端状态((旧) => ({ ...旧, ...创建空P7会话状态() }));
    清P7会话引用(引用);
  }

  // ── 栅栏 ──

  function 捕获栅栏(scopeKey: string): P7栅栏 {
    const role = 后端状态引用.current.主体?.last_used_role ?? null;
    // 首次触达的 scope/读代际从 0 起跑并落表（与 P4/P5 同款）。
    const scopeGeneration = P7范围代际.current.get(scopeKey) ?? 0;
    P7范围代际.current.set(scopeKey, scopeGeneration);
    const readGeneration = P7范围代际.current.get(读代际键(scopeKey)) ?? 0;
    P7范围代际.current.set(读代际键(scopeKey), readGeneration);
    return {
      subjectId: 主体标识引用.current,
      role,
      sessionGeneration: 会话代际.current,
      scopeKey,
      scopeGeneration,
      readGeneration,
    };
  }

  function 栅栏仍当前(fence: P7栅栏): boolean {
    const 主体 = 后端状态引用.current.主体;
    return 主体标识引用.current === fence.subjectId &&
      主体?.last_used_role === fence.role &&
      会话代际.current === fence.sessionGeneration &&
      P7范围代际.current.get(fence.scopeKey) === fence.scopeGeneration &&
      P7范围代际.current.get(读代际键(fence.scopeKey)) === fence.readGeneration;
  }

  /**
   * 权威重读/失效通知前的读换代：作废同 scope 在飞的旧读。只 +1 读代际 ——
   * scope 代际不动，绝不牵连并发命令与已读提交。
   */
  function 换读代际(scopeKey: string): void {
    P7范围代际.current.set(读代际键(scopeKey), (P7范围代际.current.get(读代际键(scopeKey)) ?? 0) + 1);
  }

  /** 命令/已读类栅栏校验：不含读代际 —— 读换代只作废在飞「读」。 */
  function 会话栅栏仍当前(fence: P7栅栏): boolean {
    const 主体 = 后端状态引用.current.主体;
    return 主体标识引用.current === fence.subjectId &&
      主体?.last_used_role === fence.role &&
      会话代际.current === fence.sessionGeneration &&
      P7范围代际.current.get(fence.scopeKey) === fence.scopeGeneration;
  }

  /** 只删自己那把键：旧会话的迟到成败绝不动新会话为同一意图新铸的键（防重复提交）。 */
  function 删意图键(intent: string, 键: string): void {
    if (P7待定意图.current.get(intent)?.key === 键) P7待定意图.current.delete(intent);
  }

  // ── 读锁（属主登记 + 过期接管）──

  function 读锁键(scopeKey: string): string {
    return `P7读:${scopeKey}`;
  }

  function 属主表(): Map<string, 读锁属主> {
    let 表 = 读锁属主表.get(deps.锁.current);
    if (!表) {
      表 = new Map();
      读锁属主表.set(deps.锁.current, 表);
    }
    return 表;
  }

  function 获取读锁(scopeKey: string): 读锁凭证 | null {
    const 键 = 读锁键(scopeKey);
    const 表 = 属主表();
    const 现属主 = 表.get(键);
    if (现属主 && 栅栏仍当前(现属主.fence)) return null; // 在飞属主仍新：单飞让路
    const fence = 捕获栅栏(scopeKey);
    const token: object = {};
    表.set(键, { fence, token }); // 属主栅栏已过期：接管锁重发，旧属主迟到结算整包丢弃
    return { 键, token, fence };
  }

  function 释放读锁(取得: 读锁凭证): void {
    const 表 = 属主表();
    if (表.get(取得.键)?.token === 取得.token) 表.delete(取得.键);
  }

  // ── 快照落位的小工具 ──

  function 落收件箱(role: P7角色, 快照: (旧: 后端状态) => P7分页快照<P7会话项>): void {
    设后端状态((旧态) => ({
      ...旧态,
      P7收件箱: { ...旧态.P7收件箱, [role]: 快照(旧态) },
    }));
  }

  function 落详情(scopeKey: string, 快照: (旧: 后端状态) => P7详情快照): void {
    设后端状态((旧态) => ({
      ...旧态,
      P7会话详情: { ...旧态.P7会话详情, [scopeKey]: 快照(旧态) },
    }));
  }

  function 落消息(scopeKey: string, 快照: (旧: 后端状态) => P7分页快照<P7消息>): void {
    设后端状态((旧态) => ({
      ...旧态,
      P7消息页: { ...旧态.P7消息页, [scopeKey]: 快照(旧态) },
    }));
  }

  function 读收件箱快照(role: P7角色): P7分页快照<P7会话项> {
    return 后端状态引用.current.P7收件箱[role];
  }

  function 读消息快照(scopeKey: string): P7分页快照<P7消息> | undefined {
    return 后端状态引用.current.P7消息页[scopeKey];
  }

  // ── 列表/消息分页读取统一核（窗口 / 追加共用；原子提交，绝不落半份窗口）──

  async function 运行收件箱读(role: P7角色, 模式: '窗口' | '追加'): Promise<void> {
    const scopeKey = P7范围键.收件箱(role);
    if (模式 === '追加' && 读收件箱快照(role).nextCursor === null) return; // 游标已尽：零请求
    const 取得 = 获取读锁(scopeKey);
    if (!取得) return;
    const fence = 取得.fence;
    try {
      // 锁内重读快照：锁定前的同 scope 读写可能已改变 items / 游标 / 窗口深度。
      const 旧 = 读收件箱快照(role);
      落收件箱(role, () => 起步分页(旧, fence.scopeGeneration));
      if (模式 === '追加') {
        if (旧.nextCursor === null) return; // 锁内复查：游标已尽零请求
        const 页 = await 后端!.读取会话列表(role, 旧.nextCursor);
        if (!栅栏仍当前(fence)) return;
        落收件箱(role, () => 成功分页(
          [...旧.items, ...页.items], 页.nextCursor, 旧.已加载页数 + 1, fence.scopeGeneration));
        return;
      }
      // 窗口重建：第一页起，按旧窗口深度跟进游标（服务端页数变少时按实际收敛）。
      const 目标页数 = Math.max(1, 旧.已加载页数);
      const items: P7会话项[] = [];
      let nextCursor: string | null = null;
      let 游标: string | null = null;
      let 页数 = 0;
      while (页数 < 目标页数) {
        const 页: P7会话页 = 游标 === null
          ? await 后端!.读取会话列表(role)
          : await 后端!.读取会话列表(role, 游标);
        页数 += 1;
        items.push(...页.items);
        nextCursor = 页.nextCursor;
        if (nextCursor === null) break;
        游标 = nextCursor;
        if (页数 < 目标页数 && !栅栏仍当前(fence)) return; // 页间换代：整包丢弃
      }
      if (!栅栏仍当前(fence)) return;
      落收件箱(role, () => 成功分页(items, nextCursor, 页数, fence.scopeGeneration));
    } catch (错误) {
      if (!栅栏仍当前(fence)) return; // 迟到失败只释放锁
      if (是401(错误)) {
        清账号与P7();
        return;
      }
      落收件箱(role, (旧态) => 失败分页(旧态.P7收件箱[role], 错误, fence.scopeGeneration));
    } finally {
      释放读锁(取得);
    }
  }

  async function 运行详情读(role: P7角色, conversationId: string): Promise<void> {
    const scopeKey = P7范围键.详情(role, conversationId);
    const 取得 = 获取读锁(scopeKey);
    if (!取得) return;
    const fence = 取得.fence;
    try {
      落详情(scopeKey, (旧态) => 起步详情(旧态.P7会话详情[scopeKey], fence.scopeGeneration));
      const 详情 = await 后端!.读取会话(role, conversationId);
      if (!栅栏仍当前(fence)) return;
      落详情(scopeKey, () => 成功详情(详情, fence.scopeGeneration));
    } catch (错误) {
      if (!栅栏仍当前(fence)) return;
      if (是401(错误)) {
        清账号与P7();
        return;
      }
      // 契约错误 / 服务错误一律落重试错误态（facade 已 fail closed，本层不再 decode）。
      落详情(scopeKey, (旧态) => 失败详情(旧态.P7会话详情[scopeKey], 错误, fence.scopeGeneration));
    } finally {
      释放读锁(取得);
    }
  }

  async function 运行消息读(role: P7角色, conversationId: string, 模式: '窗口' | '追加'): Promise<void> {
    const scopeKey = P7范围键.消息(role, conversationId);
    if (模式 === '追加') {
      const 预检 = 读消息快照(scopeKey);
      if (预检 === undefined || 预检.nextCursor === null) return; // 游标已尽：零请求
    }
    const 取得 = 获取读锁(scopeKey);
    if (!取得) return;
    const fence = 取得.fence;
    try {
      const 旧 = 读消息快照(scopeKey);
      落消息(scopeKey, (旧态) => 起步分页(旧态.P7消息页[scopeKey], fence.scopeGeneration));
      if (模式 === '追加') {
        if (旧 === undefined || 旧.nextCursor === null) return; // 锁内复查：游标已尽零请求
        const 页 = await 后端!.读取消息(role, conversationId, 旧.nextCursor);
        if (!栅栏仍当前(fence)) return;
        // 更早页按服务端时间序 prepend，页数 +1；视口保持由屏层按快照引用完成。
        落消息(scopeKey, () => 成功分页(
          [...页.messages, ...旧.items], 页.nextCursor, 旧.已加载页数 + 1, fence.scopeGeneration));
        return;
      }
      const 目标页数 = Math.max(1, 旧?.已加载页数 ?? 1);
      const messages: P7消息[] = [];
      let nextCursor: string | null = null;
      let 游标: string | undefined;
      let 页数 = 0;
      while (页数 < 目标页数) {
        const 页: P7消息页 = 游标 === undefined
          ? await 后端!.读取消息(role, conversationId)
          : await 后端!.读取消息(role, conversationId, 游标);
        页数 += 1;
        // review-r1 F4：消息页是时间序、游标向更老 —— 重建窗口时更早页必须 prepend
        //（首页最新、后续页更老），否则深窗口强制刷新后 [最新, 更早] 乱序。
        messages.unshift(...页.messages);
        nextCursor = 页.nextCursor;
        if (nextCursor === null) break;
        游标 = nextCursor;
        if (页数 < 目标页数 && !栅栏仍当前(fence)) return; // 页间换代：整包丢弃
      }
      if (!栅栏仍当前(fence)) return;
      落消息(scopeKey, () => 成功分页(messages, nextCursor, 页数, fence.scopeGeneration));
    } catch (错误) {
      if (!栅栏仍当前(fence)) return;
      if (是401(错误)) {
        清账号与P7();
        return;
      }
      落消息(scopeKey, (旧态) => 失败分页(旧态.P7消息页[scopeKey], 错误, fence.scopeGeneration));
    } finally {
      释放读锁(取得);
    }
  }

  /** 作废该会话详情/消息与收件箱的在飞读：权威重拉必能接管读锁（迟到旧读整包丢弃）。 */
  function 作废会话与收件箱读(role: P7角色, conversationId: string): void {
    换读代际(P7范围键.详情(role, conversationId));
    换读代际(P7范围键.消息(role, conversationId));
    换读代际(P7范围键.收件箱(role));
  }

  /** mutation/已读成功后的权威重读三连：消息窗口 + 详情 + 收件箱（失败静默，绝不 reject）。 */
  async function 权威重读会话(role: P7角色, conversationId: string): Promise<void> {
    作废会话与收件箱读(role, conversationId);
    await Promise.allSettled([
      运行消息读(role, conversationId, '窗口'),
      运行详情读(role, conversationId),
      运行收件箱读(role, '窗口'),
    ]);
  }

  // ── 发送意图与结果未知对账 ──

  /**
   * 当前消息快照里最新的 user_text 坐标（发送前水位）。review-r1 F2：区分两形 ——
   * undefined = 快照不在场/未成功（无权威水位，对账绝不据此确认，否则历史同文消息
   * 会被误认成本次发送）；null = 权威空水位（成功快照里没有任何 user_text）。
   */
  function 当前水位(role: P7角色, conversationId: string): string | null | undefined {
    const 快照 = 读消息快照(P7范围键.消息(role, conversationId));
    if (快照 === undefined || 快照.阶段 !== '成功') return undefined;
    for (let 下标 = 快照.items.length - 1; 下标 >= 0; 下标 -= 1) {
      const 行 = 快照.items[下标];
      if (行.kind === 'user_text') return 行.messageId;
    }
    return null;
  }

  /**
   * 同一意图沿用既有键；只有无键时才铸造（crypto.randomUUID，16–128 可见 ASCII）。
   * 复合意图串（含中文正文）只作 Map 键，绝不进请求参数。
   */
  function 待定意图For(intent坐标: string, 正文: string, 水位: string | null | undefined): P7待定意图 {
    const existing = P7待定意图.current.get(intent坐标);
    if (existing) return existing;
    const created: P7待定意图 = { key: globalThis.crypto.randomUUID(), content: 正文, watermark: 水位 };
    P7待定意图.current.set(intent坐标, created);
    return created;
  }

  /**
   * 对账谓词：重拉窗口里、水位之后，存在「本端 + 完全相同 trim 正文」的权威消息。
   * 非空水位不在重拉窗口时绝不宣称成功（按 Plan 纪律保守收口为 unknown）。
   * 十进制坐标保持 string 比较，绝不转 number。
   */
  function 是水位后同文消息(messages: P7消息[], 意图: P7待定意图, role: P7角色): boolean {
    let 起点: number;
    if (意图.watermark === undefined) {
      // review-r1 F2：无权威水位（发送前快照不在场/未成功）—— 不可验证即不确认
      return false;
    }
    if (意图.watermark === null) {
      起点 = 0;
    } else {
      const 水位位置 = messages.findIndex((行) => 行.messageId === 意图.watermark);
      if (水位位置 === -1) return false;
      起点 = 水位位置 + 1;
    }
    return messages.slice(起点).some((行) =>
      行.kind === 'user_text' && 行.senderRole === role && 行.content === 意图.content);
  }

  /** 发送在飞表：同 (role, conversation, trim 正文) 的并发调用共享同一次 POST。 */
  const 发送在飞 = new Map<string, Promise<P7发送结果>>();

  function 单飞发送(键: string, 运行: () => Promise<P7发送结果>): Promise<P7发送结果> {
    // 会话代际入键：旧会话未收口的在飞承诺绝不吞掉新会话的同文发送。
    const 会话键 = `${会话代际.current}:${键}`;
    const 在飞 = 发送在飞.get(会话键);
    if (在飞) return 在飞;
    const 本次 = 运行().finally(() => {
      发送在飞.delete(会话键);
    });
    发送在飞.set(会话键, 本次);
    return 本次;
  }

  async function 运行发送(role: P7角色, conversationId: string, 正文: string): Promise<P7发送结果> {
    const scopeKey = P7范围键.消息(role, conversationId);
    const fence = 捕获栅栏(scopeKey);
    const intent坐标 = 意图键(role, conversationId, 正文);
    const 意图 = 待定意图For(intent坐标, 正文, 当前水位(role, conversationId));
    const 未知 = (reason: 'outcome_unknown' | 'in_progress', canAbandon: boolean): P7发送结果 => ({
      status: 'unknown', reason, canAbandon, pendingContent: 正文,
    });
    try {
      // 响应消息本体不写快照（权威态一律由重读提供）；这里只确认 POST 是否成功。
      await 后端!.发送消息(role, conversationId, 正文, 意图.key);
    } catch (错误) {
      if (!会话栅栏仍当前(fence)) return 未知('outcome_unknown', false); // 迟到失败：只随单飞收口
      if (是401(错误)) {
        清账号与P7();
        throw 错误;
      }
      if (!(错误 instanceof BFF错误)) return 未知('outcome_unknown', false); // 网络异常：键保留
      // 最终 in_progress：同一 effect 仍在执行 —— 保留原键与不可变正文，零重拉。
      if (错误.code === 'idempotency_in_progress') return 未知('in_progress', false);
      if (错误.code === 'idempotency_conflict') {
        // 终局冲突：不自动重试；刷新权威消息与收件箱后原样抛，键释放（换内容即新键）。
        删意图键(intent坐标, 意图.key);
        作废会话与收件箱读(role, conversationId);
        await Promise.allSettled([
          运行消息读(role, conversationId, '窗口'),
          运行收件箱读(role, '窗口'),
        ]);
        throw 错误;
      }
      if (!是结果不确定(错误)) {
        删意图键(intent坐标, 意图.key); // 明确拒绝（含 role_*）：意图结束，下一次尝试是全新意图
        throw 错误;
      }
      // 结果不确定：立即 no-store 重拉消息与收件箱对账（§7.3）。先作废在飞读，重拉必能接管。
      作废会话与收件箱读(role, conversationId);
      const 对账 = await Promise.allSettled([
        后端!.读取消息(role, conversationId),
        运行收件箱读(role, '窗口'),
      ]);
      const 消息落点 = 对账[0];
      if (消息落点.status !== 'fulfilled') return 未知('outcome_unknown', false); // 重拉失败：只允许同键重试
      // review-r1 F3：对账 GET 在飞期间换了会话 —— 迟到证据只随单飞收口，
      // 绝不删键收口、绝不为旧 scope 发权威重读（那会污染新会话的 P7 快照）。
      if (!会话栅栏仍当前(fence)) return 未知('outcome_unknown', false);
      const 页 = 消息落点.value as P7消息页;
      if (!是水位后同文消息(页.messages, 意图, role)) {
        return 未知('outcome_unknown', true); // 重拉成功无证据：可放弃或同键重试
      }
      删意图键(intent坐标, 意图.key); // 对账确认：按已生效收口
      await 权威重读会话(role, conversationId);
      return { status: 'confirmed' };
    }
    // POST 明确成功：键即刻释放；权威态由消息/详情/收件箱重读提供（响应本体不写快照）。
    删意图键(intent坐标, 意图.key);
    if (!会话栅栏仍当前(fence)) return { status: 'confirmed' }; // 迟到成功：不落本地
    await 权威重读会话(role, conversationId);
    return { status: 'confirmed' };
  }

  // ── forward-only 已读 ──

  async function 运行已读(role: P7角色, conversationId: string, messageId: string): Promise<void> {
    const 位置键 = 已读位置键(role, conversationId);
    let 位置 = P7已读位置.current.get(位置键);
    if (位置 === undefined) {
      位置 = { lastSuccessful: null, inFlight: null, terminalRejected: null };
      P7已读位置.current.set(位置键, 位置);
    }
    // 同 target 去重：与上次成功 / 在飞 / 终局拒绝相同即零请求（十进制 ID 按 string 比对）。
    if (messageId === 位置.lastSuccessful || messageId === 位置.inFlight || messageId === 位置.terminalRejected) {
      return;
    }
    位置.inFlight = messageId;
    const fence = 捕获栅栏(P7范围键.消息(role, conversationId));
    // review-r2 R2-1：结算只动自己捕获的记录对象 —— 会话清理后重建的同名记录
    // 绝不被旧会话的迟到结算触碰（在飞标记 / 成功位归各自的提交方维护）。
    const 捕获记录 = 位置;
    try {
      await 后端!.标为已读(role, conversationId, messageId);
      const 现位置 = P7已读位置.current.get(位置键);
      if (现位置 === 捕获记录 && 现位置.inFlight === messageId) {
        现位置.inFlight = null;
        现位置.lastSuccessful = messageId;
      }
      if (!会话栅栏仍当前(fence)) return;
      // 成功后刷新当前会话与收件箱（未读由权威 read-through 回执收敛）；
      // 先作废详情/收件箱在飞读，刷新必能接管读锁。
      换读代际(P7范围键.详情(role, conversationId));
      换读代际(P7范围键.收件箱(role));
      await Promise.allSettled([运行详情读(role, conversationId), 运行收件箱读(role, '窗口')]);
    } catch (错误) {
      const 现位置 = P7已读位置.current.get(位置键);
      if (现位置 === 捕获记录 && 现位置.inFlight === messageId) 现位置.inFlight = null;
      // review-r1 F1：迟到的失败（含 401）先过栅栏 —— 会话已换代就整包丢弃，
      // 绝不登出新会话、也不往新会话的已读位置表写终局拒绝。
      if (!会话栅栏仍当前(fence)) return;
      if (是401(错误)) {
        清账号与P7();
        return;
      }
      // role_* 是当前角色的终局拒绝：同 target 不再自动重发，直到换 target 或会话清理复位。
      // （栅栏已过 + 记录未被清理 ⇒ 现位置即捕获记录；再守一次身份，防御性收口。）
      if (错误 instanceof BFF错误 && (错误.code === 'role_required' || 错误.code === 'role_suspended')) {
        if (现位置 === 捕获记录) 现位置.terminalRejected = messageId;
        return;
      }
      // 其余失败静默：不写状态、不重试（下一次渲染的 target 会再触发一次提交）。
    }
  }

  // ── 公开操作 ──

  return {
    设置P7收件箱范围(role, visible) {
      P7可见收件箱.current = { ...P7可见收件箱.current, [role]: visible };
    },

    设置P7会话范围(role, conversationId) {
      const 旧 = P7可见会话.current[role];
      if (旧 === conversationId) return; // 同坐标重复注册不是变更，不递增代际
      if (旧 !== null) {
        // 旧坐标（详情 + 消息）读代际 +1：还在飞的旧会话读按旧代整包作废。
        换读代际(P7范围键.详情(role, 旧));
        换读代际(P7范围键.消息(role, 旧));
      }
      if (conversationId !== null) {
        换读代际(P7范围键.详情(role, conversationId));
        换读代际(P7范围键.消息(role, conversationId));
      }
      P7可见会话.current = { ...P7可见会话.current, [role]: conversationId };
    },

    async 加载会话列表(role, force) {
      if (!是后端 || !后端) return;
      if (force !== true && 读收件箱快照(role).阶段 === '成功') return;
      await 运行收件箱读(role, '窗口');
    },

    追加会话列表(role) {
      if (!是后端 || !后端) return Promise.resolve();
      return 运行收件箱读(role, '追加');
    },

    async 读取真人会话(role, conversationId, force) {
      if (!是后端 || !后端) return;
      const 详情键 = P7范围键.详情(role, conversationId);
      const 消息键 = P7范围键.消息(role, conversationId);
      const 详情已成功 = 后端状态引用.current.P7会话详情[详情键]?.阶段 === '成功';
      const 消息已成功 = 后端状态引用.current.P7消息页[消息键]?.阶段 === '成功';
      const 目标: Promise<void>[] = [];
      if (force === true || !详情已成功) 目标.push(运行详情读(role, conversationId));
      if (force === true || !消息已成功) 目标.push(运行消息读(role, conversationId, '窗口'));
      await Promise.all(目标);
    },

    追加更早消息(role, conversationId) {
      if (!是后端 || !后端) return Promise.resolve();
      return 运行消息读(role, conversationId, '追加');
    },

    发送真人消息(role, conversationId, content) {
      if (!是后端 || !后端) return Promise.resolve({ status: 'confirmed' });
      const 正文 = typeof content === 'string' ? content.trim() : '';
      const 码点 = Array.from(正文).length;
      if (码点 < 1 || 码点 > 正文码点上限) {
        // 发送前拦截：不铸意图、零请求（与 facade 的闭合校验同一规则）。
        return Promise.reject(new BFF错误(0, 'invalid_request', `消息需要 1 到 ${正文码点上限} 个字符`));
      }
      return 单飞发送(意图键(role, conversationId, 正文), () => 运行发送(role, conversationId, 正文));
    },

    放弃真人消息意图(role, conversationId, pendingContent) {
      // 只清该不可变正文对应的待定键：屏层当前编辑中的草稿与本层无关，原样保留。
      const intent坐标 = 意图键(role, conversationId, pendingContent.trim());
      P7待定意图.current.delete(intent坐标);
    },

    提交真人已读(role, conversationId, messageId) {
      if (!是后端 || !后端) return Promise.resolve();
      // 只接受 decimal user_text 坐标：system 行与非规范 ID 零请求。
      if (typeof messageId !== 'string' || !坐标模式.test(messageId)) return Promise.resolve();
      return 运行已读(role, conversationId, messageId);
    },

    使真人会话失效(role, conversationId) {
      if (conversationId === undefined) {
        // 未指定坐标：作废该角色收件箱在飞读（随后由调用方 force 重拉）。
        换读代际(P7范围键.收件箱(role));
        return;
      }
      // 带坐标：作废该会话详情/消息 + 角色收件箱（见分支内 F5 注释）。
      // review-r1 F5：conversation_changed 的语义是「该会话的收件箱投影变了」——
      // 带坐标失效时同时作废收件箱在飞读，事件后的强制收件箱刷新才能接管读锁，
      // 不会被在飞的旧读单飞挡掉、让过期未读/摘要落屏。
      换读代际(P7范围键.详情(role, conversationId));
      换读代际(P7范围键.消息(role, conversationId));
      换读代际(P7范围键.收件箱(role));
    },
  };
}