// 后端 MatchCase 域操作（P5 Task 3）：双端 match-cases 的内存态 scope 快照、权威读取、
// 意图键化的 S0–S3 命令、已载列表/历史的失效刷新与 PDF 对象租约。
// 铁律（spec §10/§12 与已准入 P5 冻结契约）：
//   · Backend 才发请求（!是后端 || !后端 一律早退 / 惰性返回）；Mock 模式零 P5 请求，
//     接口失败绝不回退 Mock。快照 / 锁 / 意图 / 租约只在内存（后端状态 + 运行时引用），
//     绝不进 资料持久化、浏览器存储、Cache API 或 Service Worker。
//   · 栅栏 = subject_id + active role + session generation + scope id + scope generation +
//     可见范围，每个请求发送前捕获；任一不匹配的迟到成败只释放本轮锁 —— 不写快照、
//     不派发、不做 401 清理（迟到的 401 绝不能登出新会话）。
//   · 列表读按 scope 单飞（属主登记 + 过期接管，StrictMode 卸载重挂不死锁）；
//     已 成功 的快照刷新途中保留旧 items 不降级，刷新失败只落重试错误；刷新一律
//     从第一页重建「已载窗口」（同页数深度），追加透传快照里的 next_cursor 逐页 +1。
//   · 调用方不携带幂等键：每个 mutation 按 role + case_id + action + target/ref 派生
//     一把稳定意图键（crypto.randomUUID，同意图沿用，绝不换键强发）。普通网络错误
//     保留键；409/503/500/0/结果未知码 先做一次权威 detail GET 对账 —— 动作已不在
//     （或问题已解）按已确认成功收口，仍在则原样抛、重试沿用同一键；明确拒绝
//     （其余 4xx）释放键，下一次是全新意图。401 统一 清账号状态 + 清 P5 引用。
//   · mutation 一律服务端先行且响应为 void：成功（或确认重放）后必做权威 detail 重读
//     并刷新该角色全部已载工作区/历史 scope（mutation 响应绝不替换详情快照）；
//     POST 已成功后的重读失败绝不 reject（那会诱导换键重发）—— 详情快照落重试错误。
//   · 同一 (role, case, action, target) 单飞共享在飞 POST；跨 Case / 跨目标并行。
//   · 详情直读只认 URL case_id + 已认证角色，绝不读列表记忆填上下文；契约错误按
//     facade fail closed，本层不再 decode，一律落重试错误态。
//   · candidate_alias 只是展示文本：键、坐标、请求参数全部以 case_id / role+角色专属
//     过滤 为准；绝不生成、缓存或推断任何会话标识，不添移交发布标记或服务端下一步字段。

import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type { BFF二进制响应 } from '../../数据/HTTP客户端';
import type { BFF角色 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type {
  P5列表项,
  P5列表页,
  P5详情,
  P5历史生命周期,
  P5角色,
} from '../../数据/招聘数据源/MatchCase';
import { 创建PDF对象租约 } from '../../数据/PDF对象租约';
import { 取当前补充问题 } from '../../数据/MatchCase基础';
import { 清账号状态 } from './会话操作';
import type {
  P5列表快照,
  P5详情快照,
  P5运行时引用,
  P5MatchCase状态,
  后端操作依赖,
  后端状态,
  MatchCase操作,
} from './类型';

type 列表架子 = 'open' | P5历史生命周期;

/** opaque id 的键内转义：与 发现推荐操作 同一纪律，含 `:`/`,` 的 id 逐段转义绝不撞键。 */
function 段(值: string): string {
  return encodeURIComponent(值);
}

/** scope 键的冻结表：role + 角色专属过滤（candidate=意向 / recruiter=岗位）+ 架子/详情坐标。 */
export const P5范围键 = {
  open: (role: P5角色, filterRef: string | null): string =>
    `p5:open:${role}:${filterRef === null ? '*' : 段(filterRef)}`,
  history: (role: P5角色, lifecycle: P5历史生命周期, filterRef: string | null): string =>
    `p5:history:${role}:${lifecycle}:${filterRef === null ? '*' : 段(filterRef)}`,
  detail: (role: P5角色, caseId: string): string =>
    `p5:detail:${role}:${段(caseId)}`,
} as const;

/** 复合意图键（幂等坐标）：前缀 + 角色 + case + 动作 + 目标，逐段转义后用 `:` 连接。 */
function 意图键(role: P5角色, caseId: string, 动作: string, 目标: string): string {
  return ['p5:意图', role, 段(caseId), 段(动作), 段(目标)].join(':');
}

/** 同一意图沿用既有键；只有无键时才铸造（crypto.randomUUID），冲突/重试绝不在这里换键。 */
function idempotencyKeyFor(引用: P5运行时引用, intent: string): string {
  const existing = 引用.P5幂等意图.current.get(intent);
  if (existing) return existing;
  const created = globalThis.crypto.randomUUID();
  引用.P5幂等意图.current.set(intent, created);
  return created;
}

/** P5 MatchCase 的可复用初始化/重置底座：Provider 首帧与会话转移口共用同一形状。 */
export function 创建空P5MatchCase状态(): P5MatchCase状态 {
  return { P5工作区: {}, P5历史: {}, P5详情: {} };
}

/**
 * P5 引用级清理：scope 代际与 pending 幂等意图双 Map 清空、双端可见范围回 null、
 * 在途 PDF 对象租约全部回收。会话转移（登出 / 401 / 换主体 / 切角色）统一走这里；
 * 可选成员缺省时（旧依赖桩）静默跳过，raw 快照仍由 创建空P5MatchCase状态() 兜底。
 */
export function 清P5MatchCase引用(
  deps: Partial<Pick<后端操作依赖, 'P5范围代际' | 'P5幂等意图' | 'P5可见范围' | 'P5对象租约'>>,
): void {
  deps.P5范围代际?.current.clear();
  deps.P5幂等意图?.current.clear();
  if (deps.P5可见范围) deps.P5可见范围.current = { candidate: null, recruiter: null };
  if (deps.P5对象租约) {
    for (const 租约 of deps.P5对象租约.current) 租约.revoke();
    deps.P5对象租约.current.clear();
  }
}

/** Provider 恒注入四个 P5 引用；缺引用是接线缺陷，在工厂入口尽早暴露而不是静默错栅栏。 */
function 取P5引用(deps: 后端操作依赖): 后端操作依赖 & P5运行时引用 {
  if (!deps.P5范围代际 || !deps.P5幂等意图 || !deps.P5可见范围 || !deps.P5对象租约) {
    throw new Error('P5 MatchCase 运行时引用未初始化（Provider 必须一次性注入）');
  }
  return deps as 后端操作依赖 & P5运行时引用;
}

/** 401 统一判据：会话失效一律 清账号状态（与其它域同口径）。 */
function 是401(错误: unknown): boolean {
  return 错误 instanceof BFF错误 && 错误.status === 401;
}

/**
 * 结果不确定判据（spec §12）：这些失败无法区分「已生效 / 未生效」——
 * 409/500/503/transport(0) 与闭合的结果未知码。普通网络异常（非 BFF错误）同判。
 */
function 是结果不确定(错误: BFF错误): boolean {
  if (错误.code === 'operation_outcome_unknown' || 错误.code === 'idempotency_in_progress') return true;
  return 错误.status === 0 || 错误.status === 409 || 错误.status === 500 || 错误.status === 503;
}

/** 每个异步读写发送前捕获的栅栏（与 P4 同构；可见范围按 P5 自己的引用表比对）。 */
interface P5栅栏 {
  subjectId: string | null;
  role: BFF角色 | null;
  sessionGeneration: number;
  scopeKey: string;
  scopeGeneration: number;
  visibleScope: string | null;
}

// ── scope 读锁的属主登记：单飞 + 过期接管（与 发现推荐操作 同一模式）──────────────
// 属主登记让新请求在「在飞属主栅栏已过期」（StrictMode 卸载重挂 / 登出换代 / 换 scope）
// 时接管锁：旧属主的迟到结算按它自己的栅栏整包丢弃，token 易主后动不了新属主的锁。

interface 读锁属主 {
  fence: P5栅栏;
  token: object;
}

const 读锁属主表 = new WeakMap<Set<string>, Map<string, 读锁属主>>();

interface 读锁凭证 {
  键: string;
  token: object;
  fence: P5栅栏;
}

// ── 列表/详情快照的纯构造器：起步 / 成功 / 失败（成功快照永不降级）──────────────────

function 起步列表(旧: P5列表快照 | undefined, generation: number): P5列表快照 {
  if (旧?.阶段 === '成功') return { ...旧, 刷新中: true, error: null, generation };
  return {
    阶段: '进行中', 刷新中: true,
    items: 旧?.items ?? [], nextCursor: 旧?.nextCursor ?? null, 已加载页数: 旧?.已加载页数 ?? 0,
    error: null, generation,
  };
}

function 成功列表(
  items: P5列表项[], nextCursor: string | null, 已加载页数: number, generation: number,
): P5列表快照 {
  return { 阶段: '成功', 刷新中: false, items, nextCursor, 已加载页数, error: null, generation };
}

function 失败列表(旧: P5列表快照 | undefined, 错误: unknown, generation: number): P5列表快照 {
  const error = 取后端错误文案(错误);
  if (旧?.阶段 === '成功') return { ...旧, 刷新中: false, error, generation };
  return {
    阶段: '失败', 刷新中: false,
    items: 旧?.items ?? [], nextCursor: 旧?.nextCursor ?? null, 已加载页数: 旧?.已加载页数 ?? 0,
    error, generation,
  };
}

function 起步详情(旧: P5详情快照 | undefined, generation: number): P5详情快照 {
  if (旧?.阶段 === '成功') return { ...旧, 刷新中: true, error: null, generation };
  return { 阶段: '进行中', 刷新中: true, detail: 旧?.detail ?? null, error: null, generation };
}

function 成功详情(detail: P5详情, generation: number): P5详情快照 {
  return { 阶段: '成功', 刷新中: false, detail, error: null, generation };
}

function 失败详情(旧: P5详情快照 | undefined, 错误: unknown, generation: number): P5详情快照 {
  const error = 取后端错误文案(错误);
  if (旧?.阶段 === '成功') return { ...旧, 刷新中: false, error, generation };
  return { 阶段: '失败', 刷新中: false, detail: 旧?.detail ?? null, error, generation };
}

export function 创建MatchCase操作(deps: 后端操作依赖): MatchCase操作 {
  const { 是后端, 后端, 设后端状态, 后端状态引用, 主体标识引用, 会话代际 } = deps;
  const 引用 = 取P5引用(deps);
  const { P5范围代际, P5幂等意图, P5可见范围, P5对象租约 } = 引用;
  // 清账号状态 需要的子集（与其它域同口径；P4 引用随 deps 透传，P5 引用另行走 清P5MatchCase引用）
  const 账号清理依赖 = {
    派发: deps.派发, 设后端状态, 后端, 主体标识引用, 会话代际,
    P4范围代际: deps.P4范围代际, P4幂等意图: deps.P4幂等意图, P4可见范围: deps.P4可见范围,
  };

  /** 401 的统一收口：清账号状态（含 P4 状态/引用）+ P5 状态摊平与引用级清理（意图/代际/租约）。 */
  function 清账号与P5(): void {
    清账号状态(账号清理依赖);
    设后端状态((旧) => ({ ...旧, ...创建空P5MatchCase状态() }));
    清P5MatchCase引用(引用);
  }

  // ── 栅栏 ──

  function 捕获栅栏(scopeKey: string): P5栅栏 {
    const role = 后端状态引用.current.主体?.last_used_role ?? null;
    // 首次触达的 scope 代际从 0 起跑并落表（与 P4 同款：未落表的键读回 undefined 会把
    // 首读 completion 误判成 stale）。
    const scopeGeneration = P5范围代际.current.get(scopeKey) ?? 0;
    P5范围代际.current.set(scopeKey, scopeGeneration);
    return {
      subjectId: 主体标识引用.current,
      role,
      sessionGeneration: 会话代际.current,
      scopeKey,
      scopeGeneration,
      visibleScope: role === null ? null : P5可见范围.current[role as P5角色],
    };
  }

  function 栅栏仍当前(fence: P5栅栏): boolean {
    const 主体 = 后端状态引用.current.主体;
    return 主体标识引用.current === fence.subjectId &&
      主体?.last_used_role === fence.role &&
      会话代际.current === fence.sessionGeneration &&
      (fence.role === null || P5可见范围.current[fence.role as P5角色] === fence.visibleScope) &&
      P5范围代际.current.get(fence.scopeKey) === fence.scopeGeneration;
  }

  /**
   * 权威重读/对账前的 scope 换代：作废同 scope 在飞的旧读（3 秒轮询的迟到 GET
   * 服务端可能早于 mutation 执行，迟到回写会把已确认的新状态覆盖回旧状态）。
   */
  function 换代并捕获(scopeKey: string): P5栅栏 {
    P5范围代际.current.set(scopeKey, (P5范围代际.current.get(scopeKey) ?? 0) + 1);
    return 捕获栅栏(scopeKey);
  }

  // ── 读锁（属主登记 + 过期接管）──

  function 读锁键(scopeKey: string): string {
    return `P5读:${scopeKey}`;
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

  function 落列表(
    架子: 列表架子, scopeKey: string, 快照: (旧: 后端状态) => P5列表快照,
  ): void {
    设后端状态((旧态) => {
      const 表 = 架子 === 'open' ? 旧态.P5工作区 : 旧态.P5历史;
      const 下表 = { ...表, [scopeKey]: 快照(旧态) };
      return 架子 === 'open' ? { ...旧态, P5工作区: 下表 } : { ...旧态, P5历史: 下表 };
    });
  }

  function 读列表快照(架子: 列表架子, scopeKey: string): P5列表快照 | undefined {
    const 现态 = 后端状态引用.current;
    return 架子 === 'open' ? 现态.P5工作区[scopeKey] : 现态.P5历史[scopeKey];
  }

  async function 读一页(
    源: HTTP招聘数据源, 架子: 列表架子, role: P5角色, filterRef: string | null, 游标: string | null,
  ): Promise<P5列表页> {
    return 架子 === 'open'
      ? 源.读取P5Open列表(role, filterRef, 游标)
      : 源.读取P5历史(role, 架子, filterRef, 游标);
  }

  /**
   * 列表读取统一核（加载 / 刷新 / 追加共用）：
   *   · 加载与刷新都从第一页起，按旧快照的 已加载页数 重建同样深度的窗口（首载恰一页），
   *     页间校验栅栏，全部读完后唯一一次原子提交 —— 绝不落半份窗口；
   *   · 追加从旧快照 next_cursor 起恰读一页，items 追加、页数 +1；
   *   · 已 成功 的快照在途中保留旧 items/游标；失败不降级、只落重试错误。
   */
  async function 运行列表读(input: {
    架子: 列表架子;
    role: P5角色;
    filterRef: string | null;
    模式: '窗口' | '追加';
  }): Promise<void> {
    const scopeKey = input.架子 === 'open'
      ? P5范围键.open(input.role, input.filterRef)
      : P5范围键.history(input.role, input.架子, input.filterRef);
    if (input.模式 === '追加') {
      const 预检 = 读列表快照(input.架子, scopeKey);
      if (预检 === undefined || 预检.nextCursor === null) return; // 游标已尽：零请求
    }
    const 取得 = 获取读锁(scopeKey);
    if (!取得) return;
    const fence = 取得.fence;
    try {
      if (!后端) return;
      // 锁内重读快照：锁定前的同 scope 读写可能已改变 items / 游标 / 窗口深度。
      const 旧 = 读列表快照(input.架子, scopeKey);
      落列表(input.架子, scopeKey, () => 起步列表(旧, fence.scopeGeneration));
      if (input.模式 === '追加') {
        if (旧 === undefined || 旧.nextCursor === null) return; // 锁内复查：游标已尽零请求
        const 页 = await 读一页(后端, input.架子, input.role, input.filterRef, 旧.nextCursor);
        if (!栅栏仍当前(fence)) return;
        落列表(input.架子, scopeKey, () => 成功列表(
          [...旧.items, ...页.items], 页.nextCursor, 旧.已加载页数 + 1, fence.scopeGeneration));
        return;
      }
      // 窗口重建：第一页起，按旧窗口深度跟进游标（服务端页数变少时按实际收敛）。
      const 目标页数 = Math.max(1, 旧?.已加载页数 ?? 1);
      const items: P5列表项[] = [];
      let nextCursor: string | null = null;
      let 游标: string | null = null;
      let 页数 = 0;
      while (页数 < 目标页数) {
        const 页 = await 读一页(后端, input.架子, input.role, input.filterRef, 游标);
        页数 += 1;
        items.push(...页.items);
        nextCursor = 页.nextCursor;
        if (nextCursor === null) break;
        游标 = nextCursor;
        if (页数 < 目标页数 && !栅栏仍当前(fence)) return; // 页间换代：整包丢弃
      }
      if (!栅栏仍当前(fence)) return;
      落列表(input.架子, scopeKey, () => 成功列表(items, nextCursor, 页数, fence.scopeGeneration));
    } catch (错误) {
      if (!栅栏仍当前(fence)) return; // 迟到失败只释放锁
      if (是401(错误)) {
        清账号与P5();
        return;
      }
      落列表(input.架子, scopeKey, (旧态) => {
        const 表 = input.架子 === 'open' ? 旧态.P5工作区 : 旧态.P5历史;
        return 失败列表(表[scopeKey], 错误, fence.scopeGeneration);
      });
    } finally {
      释放读锁(取得);
    }
  }

  // ── 命令（mutation）统一核 ──

  /** 命令在飞表：同 (role, case, action, target) 的并发调用共享同一次 POST。 */
  const 命令在飞 = new Map<string, Promise<void>>();

  function 单飞命令(键: string, 运行: () => Promise<void>): Promise<void> {
    // 会话代际入键：旧会话未收口的在飞承诺绝不吞掉新会话的同名命令（新会话必须发自己的 POST）。
    const 会话键 = `${会话代际.current}:${键}`;
    const 在飞 = 命令在飞.get(会话键);
    if (在飞) return 在飞;
    const 本次 = 运行().finally(() => {
      命令在飞.delete(会话键);
    });
    命令在飞.set(会话键, 本次);
    return 本次;
  }

  /** mutation 后的已载列表/历史刷新：只刷该角色已 成功 的 scope（从第一页重建同深窗口）。 */
  async function 刷新已载列表(role: P5角色): Promise<void> {
    const 现态 = 后端状态引用.current;
    const 目标: { 架子: 列表架子; filterRef: string | null }[] = [];
    for (const 键 of Object.keys(现态.P5工作区)) {
      const 解 = 解析列表键(键);
      if (解 !== null && 解.role === role && 现态.P5工作区[键].阶段 === '成功') {
        目标.push({ 架子: 'open', filterRef: 解.filterRef });
      }
    }
    for (const 键 of Object.keys(现态.P5历史)) {
      const 解 = 解析列表键(键);
      if (解 !== null && 解.role === role && 现态.P5历史[键].阶段 === '成功') {
        目标.push({ 架子: 解.架子, filterRef: 解.filterRef });
      }
    }
    // 失败静默：权威 detail 已落地，列表等下一轮（页面节拍或手动刷新）自愈。
    await Promise.allSettled(目标.map((项) =>
      运行列表读({ 架子: 项.架子, role, filterRef: 项.filterRef, 模式: '窗口' })));
  }

  /** scope 键回解（p5:open:role:filter / p5:history:role:lifecycle:filter）；'*' 表示无过滤。 */
  function 解析列表键(键: string): { 架子: 列表架子; role: P5角色; filterRef: string | null } | null {
    const 段组 = 键.split(':');
    if (段组.length === 4 && 段组[0] === 'p5' && 段组[1] === 'open' &&
      (段组[2] === 'candidate' || 段组[2] === 'recruiter')) {
      return { 架子: 'open', role: 段组[2], filterRef: 还原过滤(段组[3]) };
    }
    if (段组.length === 5 && 段组[0] === 'p5' && 段组[1] === 'history' &&
      (段组[2] === 'candidate' || 段组[2] === 'recruiter') &&
      (段组[3] === 'ended' || 段组[3] === 'completed')) {
      return { 架子: 段组[3], role: 段组[2], filterRef: 还原过滤(段组[4]) };
    }
    return null;
  }

  function 还原过滤(编码: string): string | null {
    return 编码 === '*' ? null : decodeURIComponent(编码);
  }

  /** mutation 成功（或对账确认）后的权威 detail 重读 + 已载列表刷新；重读失败绝不 reject。 */
  async function 权威重读详情(role: P5角色, caseId: string): Promise<void> {
    const scopeKey = P5范围键.detail(role, caseId);
    // 先换代再读：mutation 已确认，同 scope 在飞的旧轮询读全部作废，迟到旧 GET 不得回写。
    const fence = 换代并捕获(scopeKey);
    try {
      const 详情 = await 后端!.读取P5详情(role, caseId);
      if (!栅栏仍当前(fence)) return;
      设后端状态((旧态) => ({
        ...旧态,
        P5详情: { ...旧态.P5详情, [scopeKey]: 成功详情(详情, fence.scopeGeneration) },
      }));
    } catch (错误) {
      if (!栅栏仍当前(fence)) return;
      if (是401(错误)) {
        清账号与P5();
        return;
      }
      // POST 已成功：这里绝不能 reject（会诱导换键重发）；旧 detail 保留 + 重试错误。
      设后端状态((旧态) => ({
        ...旧态,
        P5详情: {
          ...旧态.P5详情,
          [scopeKey]: 失败详情(旧态.P5详情[scopeKey], 错误, fence.scopeGeneration),
        },
      }));
      return;
    }
    if (!栅栏仍当前(fence)) return;
    await 刷新已载列表(role);
  }

  /**
   * 命令统一核：稳定意图键 → 服务端先行 POST → 键生命周期（§12）→ 成功/确认后的
   * 权威重读。错误分派见文件头铁律；迟到成败只随单飞收口，绝不写新会话。
   */
  async function 运行命令(input: {
    role: P5角色;
    caseId: string;
    动作: string;
    目标: string;
    写: (源: HTTP招聘数据源, 键: string) => Promise<void>;
    /** 权威 detail 对账谓词：true = 该意图的效果已在权威视图里（可按已确认成功收口）。 */
    已生效: (详情: P5详情) => boolean;
  }): Promise<void> {
    const scopeKey = P5范围键.detail(input.role, input.caseId);
    const fence = 捕获栅栏(scopeKey);
    const intent = 意图键(input.role, input.caseId, input.动作, input.目标);
    const 键 = idempotencyKeyFor(引用, intent);
    try {
      await input.写(后端!, 键);
    } catch (错误) {
      if (!栅栏仍当前(fence)) return; // 迟到失败只随单飞收口；键随意图保留
      if (是401(错误)) {
        // 会话已失效：统一清理（P5 状态/引用/意图键一并作废）后原样抛给屏收口。
        清账号与P5();
        throw 错误;
      }
      if (!(错误 instanceof BFF错误)) throw 错误; // 普通网络错误：键保留、原样抛，绝不换键重发
      if (!是结果不确定(错误)) {
        P5幂等意图.current.delete(intent); // 明确拒绝：意图结束，下一次尝试是全新意图
        throw 错误;
      }
      // 结果不确定：先做一次权威 detail GET 对账（§12）。换代作废在飞旧读，同 权威重读详情。
      const 对账栅栏 = 换代并捕获(scopeKey);
      let 详情: P5详情;
      try {
        详情 = await 后端!.读取P5详情(input.role, input.caseId);
      } catch (对账错误) {
        if (!栅栏仍当前(对账栅栏)) return;
        if (是401(对账错误)) {
          // 会话已失效：清账号后按失败收口 —— 效果从未确认，绝不解析成「已成功」。
          清账号与P5();
          throw 对账错误;
        }
        throw 错误; // 对账失败：保留键与原错误，重试沿用同一键
      }
      if (!栅栏仍当前(对账栅栏)) return;
      设后端状态((旧态) => ({
        ...旧态,
        P5详情: { ...旧态.P5详情, [scopeKey]: 成功详情(详情, 对账栅栏.scopeGeneration) },
      }));
      if (!input.已生效(详情)) throw 错误; // 动作仍在：原样抛，同键重放由下一次调用完成
      P5幂等意图.current.delete(intent); // 对账确认：按已生效收口
      await 刷新已载列表(input.role);
      return;
    }
    // POST 明确成功：键即刻释放；权威态全部由下面的 detail 重读提供（响应本体是 void）。
    P5幂等意图.current.delete(intent);
    if (!栅栏仍当前(fence)) return; // 迟到成功只不落本地
    await 权威重读详情(input.role, input.caseId);
  }

  /** 命令包装：同目标单飞 + 命令核。 */
  function 命令(input: Parameters<typeof 运行命令>[0]): Promise<void> {
    if (!是后端 || !后端) return Promise.resolve();
    const 键 = ['P5写', input.role, 段(input.caseId), 段(input.动作), 段(input.目标)].join(':');
    return 单飞命令(键, () => 运行命令(input));
  }

  /** 权威详情里当前待答问题（Plan 1 契约）；respond_fact 的对账谓词以它为准。 */
  function 当前问题(详情: P5详情): string | null {
    const 结果 = 取当前补充问题({
      currentStage: 详情.state.stage,
      availableActions: 详情.availableActions,
      stages: 详情.stages.map((区) => ({
        stage: 区.stage,
        transcript: 区.transcript.map((项) => ({ kind: 项.kind, role: 项.role, ref: 项.ref, text: 项.text })),
      })),
    }, 详情.role);
    return 结果.kind === 'one' ? 结果.promptId : null;
  }

  /**
   * 本端同文叮嘱的回执数：新增叮嘱 的对账谓词只认 `owner === role 且 expression === text`
   * 的回执。总回执数会把对方的落条冒充成本端生效（false-confirm → 静默丢用户输入），
   * 绝不采用；对不上时按 §12 保守偏置走同键重放。
   */
  function 本端同文回执数(详情: P5详情, role: P5角色, text: string): number {
    return 详情.stages.reduce((和, 区) =>
      和 + 区.instructionReceipts.filter((回执) => 回执.owner === role && 回执.expression === text).length, 0);
  }

  return {
    设置P5范围(role, 范围键) {
      const 旧 = P5可见范围.current[role];
      if (旧 === 范围键) return; // 同键重复注册不是变更，不递增代际
      if (旧 !== null) {
        // 旧键代际 +1：还在飞的旧 scope 读写按旧代际整包作废。
        P5范围代际.current.set(旧, (P5范围代际.current.get(旧) ?? 0) + 1);
        // P5 意图键刻意不清：它们按 role+case+action+target 归属，不随 scope 失效 ——
        // 不确定结果的重试跨 scope 也必须沿用同一键（§12），与 P4 的 scope 前缀清理不同。
      }
      if (范围键 !== null) {
        P5范围代际.current.set(范围键, (P5范围代际.current.get(范围键) ?? 0) + 1);
      }
      P5可见范围.current = { ...P5可见范围.current, [role]: 范围键 };
    },

    async 加载工作区(role, filterRef, force) {
      if (!是后端 || !后端) return;
      const scopeKey = P5范围键.open(role, filterRef);
      if (force !== true && 后端状态引用.current.P5工作区[scopeKey]?.阶段 === '成功') return;
      await 运行列表读({ 架子: 'open', role, filterRef, 模式: '窗口' });
    },

    追加工作区(role, filterRef) {
      if (!是后端 || !后端) return Promise.resolve();
      return 运行列表读({ 架子: 'open', role, filterRef, 模式: '追加' });
    },

    刷新工作区(role, filterRef) {
      if (!是后端 || !后端) return Promise.resolve();
      return 运行列表读({ 架子: 'open', role, filterRef, 模式: '窗口' });
    },

    async 加载历史(role, lifecycle, filterRef, force) {
      if (!是后端 || !后端) return;
      const scopeKey = P5范围键.history(role, lifecycle, filterRef);
      if (force !== true && 后端状态引用.current.P5历史[scopeKey]?.阶段 === '成功') return;
      await 运行列表读({ 架子: lifecycle, role, filterRef, 模式: '窗口' });
    },

    追加历史(role, lifecycle, filterRef) {
      if (!是后端 || !后端) return Promise.resolve();
      return 运行列表读({ 架子: lifecycle, role, filterRef, 模式: '追加' });
    },

    刷新历史(role, lifecycle, filterRef) {
      if (!是后端 || !后端) return Promise.resolve();
      return 运行列表读({ 架子: lifecycle, role, filterRef, 模式: '窗口' });
    },

    async 读取详情(role, caseId, force) {
      if (!是后端 || !后端) return;
      const scopeKey = P5范围键.detail(role, caseId);
      if (force !== true) {
        const 快照 = 后端状态引用.current.P5详情[scopeKey];
        if (快照?.阶段 === '成功' && 快照.detail !== null) return;
      }
      const 取得 = 获取读锁(scopeKey);
      if (!取得) return;
      const fence = 取得.fence;
      try {
        if (!后端) return;
        设后端状态((旧态) => ({
          ...旧态,
          P5详情: {
            ...旧态.P5详情,
            [scopeKey]: 起步详情(旧态.P5详情[scopeKey], fence.scopeGeneration),
          },
        }));
        const 详情 = await 后端.读取P5详情(role, caseId);
        if (!栅栏仍当前(fence)) return;
        设后端状态((旧态) => ({
          ...旧态,
          P5详情: { ...旧态.P5详情, [scopeKey]: 成功详情(详情, fence.scopeGeneration) },
        }));
      } catch (错误) {
        if (!栅栏仍当前(fence)) return;
        if (是401(错误)) {
          清账号与P5();
          return;
        }
        // 契约错误 / 服务错误一律落重试错误态（facade 已 fail closed，本层不再 decode）。
        设后端状态((旧态) => ({
          ...旧态,
          P5详情: {
            ...旧态.P5详情,
            [scopeKey]: 失败详情(旧态.P5详情[scopeKey], 错误, fence.scopeGeneration),
          },
        }));
      } finally {
        释放读锁(取得);
      }
    },

    回答事实(role, caseId, promptId, response) {
      return 命令({
        role, caseId, 动作: 'respond_fact', 目标: promptId,
        写: (源, 键) => 源.回答P5事实(role, caseId, promptId, response, 键),
        // 对账：当前待答问题不再是这条 prompt（已答 / 已轮换）即视为已生效。
        已生效: (详情) => 当前问题(详情) !== promptId,
      });
    },

    提交简历(caseId, fileId, fileVersionId, disclosureConfirmed) {
      return 命令({
        role: 'candidate', caseId, 动作: 'submit_resume', 目标: fileVersionId,
        // disclosureConfirmed 只由屏层的 Case 专属披露确认传入（类型级字面 true），本层不代确认。
        写: (源, 键) => 源.提交P5简历(caseId, fileId, fileVersionId, disclosureConfirmed, 键),
        // 对账：披露/校验/更换这一族 S1 简历动作不再提供（S1 已推进）即视为已生效。
        已生效: (详情) => !详情.availableActions.some((动作) =>
          动作 === 'accept_resume_invitation' || 动作 === 'retry_resume_readiness' ||
          动作 === 'replace_resume'),
      });
    },

    决定S0(caseId, action) {
      return 命令({
        role: 'candidate', caseId, 动作: 'decide_s0', 目标: action,
        写: (源, 键) => 源.决定P5S0(caseId, action, 键),
        已生效: (详情) => !详情.availableActions.includes('end_screening') ||
          详情.state.lifecycle !== 'open',
      });
    },

    决定S1(caseId, action) {
      return 命令({
        role: 'recruiter', caseId, 动作: 'decide_s1', 目标: action,
        写: (源, 键) => 源.决定P5S1(caseId, action, 键),
        已生效: (详情) => !详情.availableActions.includes('decide_resume_screening'),
      });
    },

    决定S2(role, caseId, issueId, action) {
      return 命令({
        role, caseId, 动作: 'decide_coordination', 目标: issueId,
        写: (源, 键) => 源.决定P5S2(role, caseId, issueId, action, 键),
        // 对账：卡不再提供回应，或协同块已换 / 本端已表态。
        已生效: (详情) => {
          if (!详情.availableActions.includes('decide_coordination')) return true;
          const 块 = 详情.currentCoordination;
          if (块 === null || 块.issueId !== issueId) return true;
          return role === 'candidate' ? 块.candidateDecided : 块.recruiterDecided;
        },
      });
    },

    决定S3(role, caseId, action) {
      return 命令({
        role, caseId, 动作: 'decide_intent', 目标: action,
        写: (源, 键) => 源.决定P5S3(role, caseId, action, 键),
        // 对账：本端意向词已记录（confirm/decline）或 Case 已终局。
        已生效: (详情) => 详情.intentConfirmations[role] !== '' || 详情.state.lifecycle !== 'open',
      });
    },

    新增叮嘱(role, caseId, text) {
      // 发送前基线：详情快照在场才有可比对的本端同文回执数；缺失时对账恒不通过（同键重放兜底）。
      const 发送前详情 = 后端状态引用.current.P5详情[P5范围键.detail(role, caseId)]?.detail ?? null;
      const 发送前回执数 = 发送前详情 === null ? null : 本端同文回执数(发送前详情, role, text);
      return 命令({
        role, caseId, 动作: 'add_instruction', 目标: text,
        写: (源, 键) => 源.新增P5叮嘱(role, caseId, text, 键),
        // 对账：本端同文回执比发送前多一条才算已生效；对方的落条绝不冒充本端生效。
        已生效: (详情) => 发送前回执数 !== null && 本端同文回执数(详情, role, text) > 发送前回执数,
      });
    },

    async 读取简历PDF(role, caseId) {
      if (!是后端 || !后端) {
        throw new BFF错误(0, 'backend_unavailable', 'MatchCase 简历仅在后端模式可用');
      }
      const fence = 捕获栅栏(P5范围键.detail(role, caseId));
      let 响应: BFF二进制响应;
      try {
        响应 = await 后端.读取P5简历PDF(role, caseId);
      } catch (错误) {
        if (!栅栏仍当前(fence)) throw 错误; // 迟到失败照抛但不清新会话
        if (是401(错误)) 清账号与P5();
        throw 错误;
      }
      if (!栅栏仍当前(fence)) {
        // 迟到成功：会话/scope 已换代 —— 不建租约不登记（此刻新登记会逃过下一次会话清扫）。
        throw new BFF错误(0, 'session_stale', '会话已变化，请重新打开简历');
      }
      // 租约即刻登记：哪怕调用方忘记 revoke，会话边界也会统一回收（§ 内存纪律）。
      const 租约 = 创建PDF对象租约(响应);
      P5对象租约.current.add(租约);
      return 租约;
    },
  };
}
