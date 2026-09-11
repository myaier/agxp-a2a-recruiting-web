// 后端附件简历域操作（P2）：resume-files 库快照的权威提交、六个页面操作与歧义恢复。
// 铁律（Spec §10）：不做乐观写 —— mutation 后只信一次权威 GET；
//   · 列表 GET 立即并发发出，绝不等 stalled poll；只有成功响应的同步 commit 通过
//     factory 内短队列按读取序号串行落地：序号新于最近提交才提交，迟到旧成功复用
//     最近提交快照，失败不推进提交序号、不进入队列、不污染其它读取。
//   · 会话 fence（subject + generation）与 P3/P6 共用：过时成败整包丢弃；
//     读取并提交 返回 null（换代）一律静默 return '已换代'，不读 items、不抛错。
//   · 错误按 Spec 10.2–10.4 分派：401 统一 清账号状态；权威重读码 / 结果未知码
//     GET+commit 后按目标核对，delete 目标消失、parse 达成态才收口成功；
//     create/replace 库集合变化抛 attachment_state_changed；upload_in_progress 只重读；
//     任何分支都不得自动重放 mutation，安全重读失败保留原错误。
//   · 键位（冻结）：库锁 resume-files:create，文件锁 resume-file:${fileId}。
// Mock / 无 backend：mutation 返回 已换代、read 静默、download 抛 backend_unavailable，
// 绝不生成假 Blob 或错误成功提示。接口失败绝不回退 Mock。
//
// J-PILOT-02 Task 6（Global 4/5/6 + 设计 §4.2）：onboarding 调用方传 绑定来源 回调时，
// create / replace / parse 接建档写入跟踪 ——
//   · 发送前把命令登记进唯一未结算槽：只有坐标与文件核对（name/type/size/lastModified/
//     SHA-256），PDF 字节与解析正文绝不进 请求体/文件核对；
//   · 槽未结算时另一份字节零发送（本地拦截，不做歧义恢复）；重选同一份字节按原幂等键/
//     原 ifMatch 重放，绝不自动重传 multipart；
//   · 收到回执立刻清槽并把 exact source 交回调用方（随后的权威 GET 失败也不丢
//     file/version/parse）；服务端确定拒绝同样清槽，结果未知保留槽待用户核对。
// 不传 绑定来源 的日常调用（我的简历）逐字保持原路径：零跟踪、零草稿写入。

import { BFF错误 } from '../../数据/HTTP客户端';
import type { BFF附件解析状态, BFF附件简历, BFF附件简历库 } from '../../数据/BFF契约';
import type { 建档文件核对, 建档待写入, 建档写入跟踪 } from '../../数据/招聘数据源类型';
import type { 候选引导建档草稿 } from '../../数据/资料缓存';
import type { 后端操作依赖, 候选预填绑定来源, 附件简历操作, 附件变更结果 } from './类型';
import { 清账号状态 } from './会话操作';
import { 轻提示 } from '../../组件/轻提示';

function 捕获栅栏(deps: 后端操作依赖) {
  return { subject: deps.主体标识引用.current, generation: deps.会话代际.current };
}

function 仍有效(deps: 后端操作依赖, fence: ReturnType<typeof 捕获栅栏>): boolean {
  return deps.主体标识引用.current === fence.subject && deps.会话代际.current === fence.generation;
}

function 提交附件库(deps: 后端操作依赖, fence: ReturnType<typeof 捕获栅栏>, value: BFF附件简历库): void {
  if (!仍有效(deps, fence)) return;
  deps.设后端状态((old) => ({ ...old, 附件简历库: value }));
}

/** 权威重读码（Spec 10.2）：重读提交权威列表，不重放 mutation；只有 delete 且目标消失才收口成功。 */
const 权威重读码 = new Set([
  'resume_file_version_conflict', 'resume_file_selection_stale', 'resume_file_not_found', 'resume_file_limit_reached',
]);

/** create/replace 的库集合签名：file_id + current version_id 的排序串，用于结果未知时的「状态已变」判定。 */
function 库集合签名(库: BFF附件简历库 | null): string {
  return (库?.items ?? [])
    .map((条) => `${条.file_id}:${条.current_version.version_id}`)
    .sort()
    .join('|');
}

/**
 * 权威视图里同一 current version 的解析是否已达成目标态。
 * active|succeeded 直接算达成；failed 只有 terminal updated_at 相对发送前发生了变化才算
 * （同一条旧失败不算本次意图的结果）。
 */
function 解析达成(
  库: BFF附件简历库,
  fileId: string,
  versionId: string,
  发送前更新时间: string | null,
): boolean {
  const 文件 = 库.items.find((条) => 条.file_id === fileId);
  if (!文件 || 文件.current_version.version_id !== versionId) return false;
  const 解析: BFF附件解析状态 = 文件.current_version.parse;
  if (解析.status === 'pending' || 解析.status === 'processing' || 解析.status === 'succeeded') return true;
  if (解析.status === 'failed') return 解析.updated_at !== 发送前更新时间;
  return false;
}

/** already_in_progress 的达成态：active / succeeded。 */
function 解析在途或成功(库: BFF附件简历库, fileId: string, versionId: string): boolean {
  const 文件 = 库.items.find((条) => 条.file_id === fileId);
  if (!文件 || 文件.current_version.version_id !== versionId) return false;
  const 状态 = 文件.current_version.parse.status;
  return 状态 === 'pending' || 状态 === 'processing' || 状态 === 'succeeded';
}

/** not_allowed 的达成态：只有 succeeded。 */
function 解析已成功(库: BFF附件简历库, fileId: string, versionId: string): boolean {
  const 文件 = 库.items.find((条) => 条.file_id === fileId);
  return !!文件 && 文件.current_version.version_id === versionId &&
    文件.current_version.parse.status === 'succeeded';
}

/** 服务端确定拒绝：本地/远端已确定失败。409 冲突、503 未知、网络断开一律保留槽待核对。 */
function 是确定拒绝(错误: unknown): boolean {
  return 错误 instanceof BFF错误
    && 错误.status !== 401
    && 错误.status !== 409
    && !(错误.status === 503 && 错误.code === 'operation_outcome_unknown')
    && 错误.code !== 'network_error';
}

/**
 * 同一条文件命令：种类 + 目标文件 + 文件核对（parse 用请求体）一致即同一条。
 * ifMatch / 幂等键 不参与比较 —— 未知结果恢复要沿槽里的原 ifMatch 与原幂等键重放，
 * 而不是拿新快照的 revision 重算（Global 6）。
 */
function 同一文件命令(a: 建档待写入, b: 建档待写入): boolean {
  return a.种类 === b.种类
    && (a.资源编号 ?? null) === (b.资源编号 ?? null)
    && JSON.stringify(a.文件核对 ?? null) === JSON.stringify(b.文件核对 ?? null)
    && JSON.stringify(a.请求体 ?? null) === JSON.stringify(b.请求体 ?? null);
}

/**
 * 文件核对元数据：只有 name/type/size/lastModified 与内容 SHA-256 —— 绝不留字节，
 * 供「未知结果后用户重选同一份文件」核对。摘要不可用（非安全上下文）时返回 null，
 * 由调用方放弃本次登记（宁可没有恢复坐标，也不登记一条认不出字节的命令）。
 */
async function 算文件核对(file: File): Promise<建档文件核对 | null> {
  try {
    const 摘要 = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      sha256: [...new Uint8Array(摘要)].map((字节) => 字节.toString(16).padStart(2, '0')).join(''),
    };
  } catch {
    return null;
  }
}

export function 创建附件简历操作(deps: 后端操作依赖): 附件简历操作 {
  const { 是后端, 后端, 派发, 设后端状态, 后端状态引用, 锁, 主体标识引用, 会话代际 } = deps;
  // 清账号状态 需要的子集（与会话/隐私域共用口径）
  // codex review-r1 P2：候选预填引用随行 —— 附件域 401 高发于 onboarding 上传/解析途中，
  // 不删恢复元数据会让旧 session key 跨登出残留（同账号重登复活旧轮，设计 §6.4）。
  const 账号清理依赖 = {
    派发, 设后端状态, 后端, 主体标识引用, 会话代际,
    候选预填代际: deps.候选预填代际, 候选预填读取锁: deps.候选预填读取锁, 候选预填恢复: deps.候选预填恢复,
  };

  // ── 提交协调器（factory 闭包私有，不是公共 state / dependency）────────────
  // GET 立即发出；只有成功响应的同步 commit 排进 附件提交队列，串行按读取序号落地。
  let 下一个读取序号 = 0;
  let 最近提交序号 = 0;
  let 最近提交快照: BFF附件简历库 | null = null;
  let 附件提交队列: Promise<void> = Promise.resolve();
  function 读取并提交(fence: ReturnType<typeof 捕获栅栏>): Promise<BFF附件简历库 | null> {
    const reading = ++下一个读取序号;
    const request = deps.后端!.读取附件简历库(); // 立即发出；不等 stalled poll
    return request.then((value) => {
      let committed: BFF附件简历库 | null = null;
      const commit = 附件提交队列.then(() => {
        if (!仍有效(deps, fence)) return;
        if (reading <= 最近提交序号) { committed = 最近提交快照; return; }
        最近提交序号 = reading;
        最近提交快照 = value;
        committed = value;
        提交附件库(deps, fence, value);
      });
      附件提交队列 = commit.then(() => undefined, () => undefined);
      return commit.then(() => committed);
    });
  }

  /** mutation 成功收尾 / 缺行安全 GET 用的权威读取：当前会话 401 走统一登出清理。 */
  async function 确认权威(fence: ReturnType<typeof 捕获栅栏>): Promise<BFF附件简历库 | null> {
    try {
      return await 读取并提交(fence);
    } catch (错误) {
      if (错误 instanceof BFF错误 && 错误.status === 401 && 仍有效(deps, fence)) {
        清账号状态(账号清理依赖);
      }
      throw 错误;
    }
  }

  type 重读结果 = { kind: '达成'; 库: BFF附件简历库 } | { kind: '换代' } | { kind: '失败' };

  /** 歧义恢复用的安全重读：失败一律由调用方保留原错误（这里只区分 换代 / 达成 / 失败）。 */
  async function 恢复重读(fence: ReturnType<typeof 捕获栅栏>): Promise<重读结果> {
    try {
      const 库 = await 读取并提交(fence);
      if (库 === null) return { kind: '换代' };
      return { kind: '达成', 库 };
    } catch (重读错误) {
      // 恢复读撞上当前会话 401 = 会话在读途中失效：统一登出清理（过 fence，已换代绝不清新会话），
      // 原始错误仍由调用方抛出，恢复失败永不顶替。
      if (重读错误 instanceof BFF错误 && 重读错误.status === 401 && 仍有效(deps, fence)) {
        清账号状态(账号清理依赖);
      }
      return { kind: '失败' };
    }
  }

  /**
   * 变更效果目标：歧义恢复时用它和权威视图核对「是否真的达成」。
   * create/replace 带 动作前 snapshot 的集合签名；parse 带 目标 version 与发送前的 terminal updated_at。
   */
  type 变更效果 =
    | { kind: 'create'; 动作前: BFF附件简历库 | null }
    | { kind: 'replace'; 动作前: BFF附件简历库 | null }
    | { kind: 'delete'; fileId: string }
    | { kind: 'parse'; fileId: string; versionId: string; 发送前更新时间: string | null };

  function 目标已消失(库: BFF附件简历库, fileId: string): boolean {
    return !库.items.some((条) => 条.file_id === fileId);
  }

  /**
   * mutation 错误统一分派（Spec 10.2–10.4，顺序即优先级）：
   *   非 BFF 错误 → 原样抛出；
   *   401 → 清账号状态后抛原错误；
   *   权威重读码 → GET+commit；delete 且目标消失才 return '已提交'，其余抛原错误；
   *   status 0 / 503 / idempotency_in_progress → GET+commit；按 Spec 10.3 核对目标是否已达成；
   *     · delete：目标已不存在 → 收口成功；
   *     · parse：同 version 变 active/succeeded，或 terminal updated_at 已变化 → 收口成功；
   *     · create/replace：库与动作前 snapshot 的 file/version 集合不同 →
   *       throw new BFF错误(error.status, 'attachment_state_changed', '附件状态已更新，请确认')；
   *   upload_in_progress → GET+commit 后始终抛原 code，不做集合差异效果判定；
   *   parse_already_in_progress → GET+commit；active/succeeded 按目标达成，否则抛原错误；
   *   parse_not_allowed → GET+commit；只有 succeeded 按目标达成，否则抛原错误；
   *   读取并提交 返回 null（会话换代）→ 不读 items、不抛错、不提示，return '已换代'；
   *   无法确认或安全 GET 失败 → 抛原错误。任何分支都不得自动重放 mutation。
   */
  async function 收口变更错误(
    错误: unknown,
    fence: ReturnType<typeof 捕获栅栏>,
    效果: 变更效果,
  ): Promise<附件变更结果> {
    if (!(错误 instanceof BFF错误)) throw 错误;
    if (错误.status === 401) {
      // 过会话 fence：mutation 在飞期间已换代（登出/重登/切身份，转移路径自己清过账号）时，
      // 迟到的旧会话 401 绝不能顺手登出新一代 —— 跳过清理即可，错误语义不变（同 P6 收口写入错误）。
      if (仍有效(deps, fence)) 清账号状态(账号清理依赖);
      throw 错误;
    }
    // Task 6：status 0 的本地拦截（单槽守卫、幂等键入参拦截）代表请求一次都没发出 ——
    // 它不是「结果未知」，不做任何歧义恢复 GET，原样抛给调用方的闭合文案。
    if (错误.status === 0 && 错误.code === 'invalid_request') throw 错误;
    if (权威重读码.has(错误.code)) {
      const 重读 = await 恢复重读(fence);
      if (重读.kind === '换代') return '已换代';
      if (重读.kind === '失败') throw 错误;
      if (效果.kind === 'delete' && 目标已消失(重读.库, 效果.fileId)) return '已提交';
      throw 错误;
    }
    if (错误.status === 0 || 错误.status === 503 || 错误.code === 'idempotency_in_progress') {
      const 重读 = await 恢复重读(fence);
      if (重读.kind === '换代') return '已换代';
      if (重读.kind === '失败') throw 错误;
      const 权威 = 重读.库;
      if (效果.kind === 'delete') {
        if (目标已消失(权威, 效果.fileId)) return '已提交';
        throw 错误;
      }
      if (效果.kind === 'parse') {
        if (解析达成(权威, 效果.fileId, 效果.versionId, 效果.发送前更新时间)) return '已提交';
        throw 错误;
      }
      // create/replace：只有库集合确实变了才能提示确认，仍不声称一定是本设备成功
      if (库集合签名(效果.动作前) !== 库集合签名(权威)) {
        throw new BFF错误(错误.status, 'attachment_state_changed', '附件状态已更新，请确认');
      }
      throw 错误;
    }
    if (错误.code === 'upload_in_progress') {
      const 重读 = await 恢复重读(fence);
      if (重读.kind === '换代') return '已换代';
      throw 错误;
    }
    if (错误.code === 'parse_already_in_progress') {
      const 重读 = await 恢复重读(fence);
      if (重读.kind === '换代') return '已换代';
      if (重读.kind === '失败') throw 错误;
      if (效果.kind === 'parse' && 解析在途或成功(重读.库, 效果.fileId, 效果.versionId)) return '已提交';
      throw 错误;
    }
    if (错误.code === 'parse_not_allowed') {
      const 重读 = await 恢复重读(fence);
      if (重读.kind === '换代') return '已换代';
      if (重读.kind === '失败') throw 错误;
      if (效果.kind === 'parse' && 解析已成功(重读.库, 效果.fileId, 效果.versionId)) return '已提交';
      throw 错误;
    }
    throw 错误;
  }

  /** 快照里按 id 取最新行：revision / version 一律以快照为准。 */
  function 快照行(fileId: string): BFF附件简历 | undefined {
    return 后端状态引用.current.附件简历库?.items.find((条) => 条.file_id === fileId);
  }

  // ── J-PILOT-02 Task 6：onboarding 单槽跟踪（与 候选操作 的建档草稿同序写入）──

  /** 同步固定内存 ref → 尝试写 subject-scoped session（失败仅轻提示刷新风险）→ 派发。 */
  function 写建档草稿(建档: 候选引导建档草稿): void {
    if (deps.建档草稿引用) deps.建档草稿引用.current = 建档;
    const 存储 = deps.候选建档草稿?.current ?? null;
    if (存储 !== null && !存储.写入(建档)) {
      轻提示('本次无法保存恢复进度，刷新可能丢失');
    }
    派发({ 型: '更新候选建档草稿', 建档 });
  }

  function 取消槽(建档: 候选引导建档草稿): 候选引导建档草稿 {
    const { 待写入: _已清, ...无槽 } = 建档;
    return 无槽;
  }

  interface 跟踪包 {
    跟踪?: 建档写入跟踪;
    取本槽命令(): 建档待写入 | null;
  }

  const 无跟踪: 跟踪包 = { 取本槽命令: () => null };

  /**
   * 构造本次文件命令的跟踪：只有 onboarding 调用方（传了 绑定来源）且当前有 active
   * 建档草稿时才登记。发送前 —— 未结算的另一条命令一律本地拦下（零请求），同一条命令
   * 沿用槽里的原幂等键与原 ifMatch 重放；已确认 —— 收到回执立刻清槽（文件域的持久化
   * 真相是预填 exact source 元数据，槽只承担「结果未知时按原字节重选」的恢复坐标）。
   */
  function 构造跟踪(
    fence: ReturnType<typeof 捕获栅栏>,
    绑定来源: ((来源: 候选预填绑定来源) => void) | undefined,
    文件核对: 建档文件核对 | null,
  ): 跟踪包 {
    if (绑定来源 === undefined) return 无跟踪; // 日常调用：零跟踪、零草稿写入
    if ((deps.建档草稿引用?.current ?? null) === null) return 无跟踪; // 无 active 建档草稿
    let 本槽命令: 建档待写入 | null = null;
    const 跟踪: 建档写入跟踪 = {
      发送前(命令) {
        const 现有 = deps.建档草稿引用?.current ?? null;
        if (!仍有效(deps, fence) || 现有 === null) return 命令; // 栅栏破防/草稿已不在场：不落盘
        const 定基: 建档待写入 = 文件核对 === null ? 命令 : { ...命令, 文件核对 };
        const 槽 = 现有.待写入;
        if (槽 !== undefined && !同一文件命令(槽, 定基)) {
          // Global 6：一个槽未结算时禁止另一 mutation 覆盖 —— 请求一次都不发，
          // 用户要么按原步骤重选同一份文件，要么先核对上一条的结果。
          throw new BFF错误(0, 'invalid_request', '上一条写入结果未确认，请先重试或核对原步骤');
        }
        const 定: 建档待写入 = {
          ...定基,
          幂等键: 槽?.幂等键 ?? 定基.幂等键 ?? globalThis.crypto.randomUUID(),
          ...(槽?.ifMatch !== undefined ? { ifMatch: 槽.ifMatch } : {}),
          阶段: 'prepared',
        };
        写建档草稿({ ...现有, 待写入: 定 });
        本槽命令 = 定;
        return 定;
      },
      已确认(命令) {
        if (!仍有效(deps, fence)) return;
        const 现有 = deps.建档草稿引用?.current ?? null;
        if (现有 === null || 现有.待写入 === undefined) return;
        if (!同一文件命令(现有.待写入, 命令)) return;
        写建档草稿(取消槽(现有));
      },
    };
    return { 跟踪, 取本槽命令: () => 本槽命令 };
  }

  /** 服务端确定拒绝：本条命令没写成，清掉自己的槽，别把后续上传永久锁死。 */
  function 清确定拒绝的槽(错误: unknown, fence: ReturnType<typeof 捕获栅栏>, 命令: 建档待写入 | null): void {
    if (命令 === null || !是确定拒绝(错误) || !仍有效(deps, fence)) return;
    const 现有 = deps.建档草稿引用?.current ?? null;
    if (现有?.待写入 === undefined || !同一文件命令(现有.待写入, 命令)) return;
    写建档草稿(取消槽(现有));
  }

  /** 本次写入回执的 exact source：先于权威 GET 交出，GET 失败也不丢 file/version/parse。 */
  function 交出来源(
    fence: ReturnType<typeof 捕获栅栏>,
    绑定来源: ((来源: 候选预填绑定来源) => void) | undefined,
    来源: 候选预填绑定来源,
  ): void {
    if (绑定来源 === undefined || !仍有效(deps, fence)) return;
    绑定来源(来源);
  }

  return {
    /**
     * 委托前的权威库准备（P5 Task 3）：立即 GET 一次并经既有 读取并提交 协调器落地，
     * 把已提交的权威快照本体还给屏 —— 屏只依据这一份决定零/一/多文件的委托走向，
     * 不再另起第二套读取。换代（读途中 / 失败迟到）一律返回 null 由屏静默返回；
     * 当前 fence 的 401 与 刷新附件简历 同口径清账号后原样抛。
     */
    async 准备候选委托简历(): Promise<BFF附件简历库 | null> {
      if (!是后端 || !后端) return null;
      const fence = 捕获栅栏(deps);
      try {
        return await 读取并提交(fence);
      } catch (错误) {
        // 迟到的旧会话失败静默丢弃（null 交屏静默）；当前 fence 的 401 才清账号，其余原样抛
        if (!仍有效(deps, fence)) return null;
        if (错误 instanceof BFF错误 && 错误.status === 401) 清账号状态(账号清理依赖);
        throw 错误;
      }
    },

    async 刷新附件简历() {
      if (!是后端 || !后端) return;
      const fence = 捕获栅栏(deps);
      try {
        await 读取并提交(fence);
      } catch (错误) {
        // 迟到的旧会话失败静默丢弃；当前 fence 的 401 才清账号，其余原样抛
        if (!仍有效(deps, fence)) return;
        if (错误 instanceof BFF错误 && 错误.status === 401) 清账号状态(账号清理依赖);
        throw 错误;
      }
    },

    async 创建附件简历(file, consent, 绑定来源) {
      if (!是后端 || !后端) return '已换代';
      const 键 = 'resume-files:create';
      if (锁.current.has(键)) return '已换代';
      锁.current.add(键);
      const fence = 捕获栅栏(deps);
      try {
        const 动作前 = 后端状态引用.current.附件简历库;
        const 包 = 构造跟踪(fence, 绑定来源, 绑定来源 === undefined ? null : await 算文件核对(file));
        let 文件: BFF附件简历;
        try {
          文件 = 包.跟踪
            ? await 后端.创建附件简历(file, consent, 包.跟踪)
            : await 后端.创建附件简历(file, consent);
        } catch (错误) {
          清确定拒绝的槽(错误, fence, 包.取本槽命令());
          return await 收口变更错误(错误, fence, { kind: 'create', 动作前 });
        }
        交出来源(fence, 绑定来源, {
          file_id: 文件.file_id, version_id: 文件.current_version.version_id, parse_id: null,
        });
        const 权威 = await 确认权威(fence);
        if (权威 === null) return '已换代';
        return '已提交';
      } finally {
        锁.current.delete(键);
      }
    },

    async 替换附件简历(fileId, file, consent, 绑定来源) {
      if (!是后端 || !后端) return '已换代';
      const 键 = `resume-file:${fileId}`;
      if (锁.current.has(键)) return '已换代';
      锁.current.add(键);
      const fence = 捕获栅栏(deps);
      try {
        // display_name 由槽位保留：replace 只发 file + consent，绝不把新挑的文件名当显示名
        const 目标 = 快照行(fileId);
        if (!目标) {
          const 权威 = await 确认权威(fence); // 只安全 GET 一次，不自动重放
          if (权威 === null) return '已换代';
          throw new BFF错误(409, 'resume_file_selection_stale', '附件状态已更新，请重新选择');
        }
        const 动作前 = 后端状态引用.current.附件简历库;
        const 包 = 构造跟踪(fence, 绑定来源, 绑定来源 === undefined ? null : await 算文件核对(file));
        let 文件: BFF附件简历;
        try {
          文件 = 包.跟踪
            ? await 后端.替换附件简历(fileId, 目标.revision, file, consent, 包.跟踪)
            : await 后端.替换附件简历(fileId, 目标.revision, file, consent);
        } catch (错误) {
          清确定拒绝的槽(错误, fence, 包.取本槽命令());
          return await 收口变更错误(错误, fence, { kind: 'replace', 动作前 });
        }
        交出来源(fence, 绑定来源, {
          file_id: 文件.file_id, version_id: 文件.current_version.version_id, parse_id: null,
        });
        const 权威 = await 确认权威(fence);
        if (权威 === null) return '已换代';
        return '已提交';
      } finally {
        锁.current.delete(键);
      }
    },

    async 删除附件简历(fileId) {
      if (!是后端 || !后端) return '已换代';
      const 键 = `resume-file:${fileId}`;
      if (锁.current.has(键)) return '已换代';
      锁.current.add(键);
      const fence = 捕获栅栏(deps);
      try {
        const 目标 = 快照行(fileId);
        if (!目标) {
          const 权威 = await 确认权威(fence); // 只安全 GET 一次，不自动重放
          if (权威 === null) return '已换代';
          throw new BFF错误(409, 'resume_file_selection_stale', '附件状态已更新，请重新选择');
        }
        try {
          await 后端.删除附件简历(fileId, 目标.revision);
        } catch (错误) {
          return await 收口变更错误(错误, fence, { kind: 'delete', fileId });
        }
        const 权威 = await 确认权威(fence);
        if (权威 === null) return '已换代';
        return '已提交';
      } finally {
        锁.current.delete(键);
      }
    },

    async 请求附件解析(fileId, consent, 绑定来源) {
      if (!是后端 || !后端) return '已换代';
      const 键 = `resume-file:${fileId}`;
      if (锁.current.has(键)) return '已换代';
      锁.current.add(键);
      const fence = 捕获栅栏(deps);
      try {
        const 目标 = 快照行(fileId);
        if (!目标) {
          const 权威 = await 确认权威(fence); // 只安全 GET 一次，不自动重放
          if (权威 === null) return '已换代';
          throw new BFF错误(409, 'resume_file_selection_stale', '附件状态已更新，请重新选择');
        }
        const versionId = 目标.current_version.version_id;
        // terminal updated_at 的发送前基线：not_started 没有 updated_at
        const 发送前解析 = 目标.current_version.parse;
        const 发送前更新时间 = 'updated_at' in 发送前解析 ? 发送前解析.updated_at : null;
        const 包 = 构造跟踪(fence, 绑定来源, null); // 解析命令没有文件字节，也就没有文件核对
        let 状态: BFF附件解析状态;
        try {
          状态 = 包.跟踪
            ? await 后端.请求附件解析(fileId, versionId, consent, 包.跟踪)
            : await 后端.请求附件解析(fileId, versionId, consent);
        } catch (错误) {
          清确定拒绝的槽(错误, fence, 包.取本槽命令());
          return await 收口变更错误(错误, fence, { kind: 'parse', fileId, versionId, 发送前更新时间 });
        }
        // 解析只针对本次 receipt 的版本：parse_id 只在服务端真的 succeeded 时才有
        交出来源(fence, 绑定来源, {
          file_id: fileId,
          version_id: versionId,
          parse_id: 状态.status === 'succeeded' ? 状态.parse_id : null,
        });
        const 权威 = await 确认权威(fence);
        if (权威 === null) return '已换代';
        return '已提交';
      } finally {
        锁.current.delete(键);
      }
    },

    async 下载附件简历(fileId) {
      if (!是后端 || !后端) {
        throw new BFF错误(0, 'backend_unavailable', '附件仅在后端模式可用');
      }
      const fence = 捕获栅栏(deps);
      try {
        return await 后端.下载附件简历(fileId);
      } catch (错误) {
        // 只读不落锁：当前 fence 的 401 才清账号，其余原样抛
        if (错误 instanceof BFF错误 && 错误.status === 401 && 仍有效(deps, fence)) {
          清账号状态(账号清理依赖);
        }
        throw 错误;
      }
    },
  };
}
