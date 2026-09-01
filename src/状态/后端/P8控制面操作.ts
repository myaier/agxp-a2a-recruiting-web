// 后端 P8 控制面域运行时 owner（Task 3 + Task 5 + Task 6）：账号安全资源（凭证/会话/导出）
// 的内存态快照、单飞读取、subject/会话/范围三代栅栏，与手机号换绑、退出其他设备、
// 数据导出（恢复/创建/刷新/废弃/下载地址）、账号注销、产品反馈的意图键化命令。
// 铁律（spec §7–§8 与已准入 P8 冻结契约）：
//   · Backend 才发请求：读路径早退、写路径拒绝 backend_unavailable；Mock 模式零 P8
//     请求，接口失败绝不回退 Mock。快照 / 锁 / 意图只在内存（后端状态 + 运行时引用），
//     绝不进 资料持久化、浏览器存储、Cache API 或 Service Worker —— 唯一例外是导出
//     恢复句柄（Task 5）：恰三字段 {subjectId, createKey, exportId}，按 subject 隔离的
//     localStorage 键由 Provider 供给适配器（P8导出恢复.current），跨登出保留。
//   · 读栅栏 = subject_id + 会话代际 + P8 范围代际，每个请求发送前捕获；任一不匹配的
//     迟到成败只释放本轮读锁 —— 数据不写快照、不派发、不清会话（迟到的 401 绝不能
//     登出新会话）。credentials / sessions / export 各自单飞，重复调用并入同一 Promise；
//     force 刷新递增范围代际使旧在飞读整包过时并由新读接管锁，被作废的结算把快照滚回
//     起飞前状态（姊妹资源的 force 换代绝不把本资源永久滞留在 loading/refreshing）；
//     已成功快照刷新途中保留旧 data 不降级为空。
//   · 写栅栏 = subject_id + 会话代际（范围代际只是 UI 刷新换代，绝不终结写）：当前会话
//     401 走统一 清账号状态 并原样抛出，让屏幕沿既有登录恢复路径；栅栏已换代的迟到写
//     401 只丢弃。完成换绑成功先强制重读凭证+会话（一次换代、两路共享同一新代）再
//     resolve，绝不乐观写回执里的掩码手机号；退出其他设备成功权威重读会话，
//     回执计数原样返回，不影响当前会话、不清账号状态。
//   · 写意图：key 由 crypto.randomUUID 铸造（16–128 可见 ASCII）；意图坐标（可含中文）
//     只作内存 Map 键，绝不进数据源键参数。换绑开始坐标=手机号、换绑完成坐标=
//     attempt+验证码（begin/complete 各自独立键）、退出其他设备坐标恒定、创建导出
//     坐标=落盘 createKey（幂等键即句柄里的 createKey，跨刷新同键重放由句柄承载）、
//     注销坐标恒定 —— 换手机号 / 换 attempt / 换验证码 / 明确重新生成即新意图新键；
//     operation_outcome_unknown / idempotency_in_progress / 限流 / 下游不可用 / 传输层
//     异常保留原键与不可变请求只允许同键重试；成功与终局拒绝（400/403/409 冲突）清
//     意图（创建导出的终局拒绝同时回滚预写句柄，不留死键）；同一动作在飞时重复点击
//     只并入同一 Promise。
//   · 导出创建先落盘后 POST：写入失败/适配器缺席/主体缺席 → 固定「数据导出暂不可用」
//     文案 + 零请求；有 ID 句柄只 GET 绝不 POST；404/expired/明确重新生成/注销 202 清
//     当前 subject 句柄；注销未知结果同键 1s/2s 显式重放至多两次，持续不确定保留意图；
//     注销 202 的本地收口以会话栅栏为界 —— 迟到的 202 绝不摊平新会话、不删新主体句柄。
//   · 入参校验在本层收口：换绑开始只收 11 位中国大陆裸号（facade 只负责 +86 E.164 构造），
//     换绑完成证明执行产品全局 短信验证码位数 规则 —— 非法输入零请求、零意图。
//   · 错误文案是本模块闭合的固定中文表：未知 BFF错误.message 绝不透传。
//   · 合规两法按法各立意图：反馈（Task 6）坐标=线协议分类+trim 后正文，入参校验在本层
//     收口（trim 后按 Unicode 码点计 5–500，非法零请求零意图），成功清意图、未知/网络
//     异常同键同 body 重试，409 冲突与 429 限流是终局（清意图；合规 429 不带 Retry-After，
//     绝不排定时器自动重试）。举报（Task 7）坐标=目标(type+ref)+线协议原因+是否同时屏蔽，
//     请求恰 {target, reason, also_block}（无身份/角色/组织名/展示名/证据/正文/屏蔽对象，
//     屏蔽对象由服务端按目标解析），409 block_unavailable 是终局（无半成功；用户取消勾选
//     屏蔽＝新意图新键）、404 report_target_not_found 是统一终局；回执 blockStatus=applied
//     且当前角色是候选时恰做一次权威隐私读取并走既有 P3 水合路径（招聘端绝不读候选隐私；
//     两种角色都绝不本地派发 拉黑）。

import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type {
  P8Credential,
  P8DataExport,
  P8FeedbackCategory,
  P8ReportReason,
  P8ReportReceipt,
  P8ReportTarget,
  P8Session,
} from '../../数据/招聘数据源/P8控制面';
import type { P8导出恢复句柄 } from '../../数据/P8导出恢复';
import { 短信验证码位数 } from '../../数据/验证码规则';
import { 清账号状态 } from './会话操作';
import type {
  P8账号控制面操作,
  P8合规操作,
  P8待定意图,
  P8控制面状态,
  P8运行时引用,
  P8资源快照,
  后端操作依赖,
} from './类型';

/** 与 会话.开始手机登录 同款产品手机号规则：中国大陆 11 位裸号（1 开头）。 */
const 大陆手机号模式 = /^1\d{10}$/;

/** 产品全局短信验证码位数（登录与换绑共用，绝不在 P8 自立位数）。 */
const 验证码模式 = new RegExp(`^\\d{${短信验证码位数}}$`);

/** 合规反馈的线协议分类表（与 facade 同一口径）；UI 中文分类→线协议的映射归屏。 */
const 反馈分类全表: readonly P8FeedbackCategory[] = ['bug', 'suggestion', 'other'];

/** 合规举报的线协议原因表（与 facade 同一口径）；UI 中文原因→线协议的映射归共用举报层。 */
const 举报原因全表: readonly P8ReportReason[] = [
  'false_information', 'salary_misrepresentation', 'harassment', 'other',
];

/** 举报目标的闭合分支表（job / match_case / conversation；与 facade 同一口径）。 */
const 举报目标分支全表: readonly P8ReportTarget['type'][] = ['job', 'match_case', 'conversation'];

/** 反馈正文规则：trim 后 5–500 个 Unicode 码点（按码点数计，绝不是 UTF-16 单元数）。 */
const 反馈正文码点上下限 = { 下限: 5, 上限: 500 } as const;

/** opaque id 的键内转义：意图坐标里的 id 逐段转义绝不撞键（与 P7 同一纪律）。 */
function 段(值: string): string {
  return encodeURIComponent(值);
}

/**
 * 意图坐标（内存 Map 的键，可含中文）：换绑开始=手机号、换绑完成=attempt+验证码、
 * 退出恒定、创建导出=落盘 createKey、注销恒定、提交反馈=线协议分类+trim 后正文、
 * 提交举报=目标(type+ref)+线协议原因+是否同时屏蔽（取消勾选屏蔽即新意图新键）。
 */
const 意图坐标 = {
  换绑开始: (手机号: string): string => `p8:换绑开始:${手机号}`,
  换绑完成: (attemptId: string, code: string): string => `p8:换绑完成:${段(attemptId)}:${code}`,
  退出其他设备: 'p8:退出其他设备',
  创建数据导出: (createKey: string): string => `p8:创建数据导出:${段(createKey)}`,
  注销账号: 'p8:注销账号',
  提交反馈: (分类: string, 正文: string): string => `p8:提交反馈:${段(分类)}:${段(正文)}`,
  提交举报: (目标: P8ReportTarget, 原因: P8ReportReason, 屏蔽: boolean): string =>
    `p8:提交举报:${段(目标.type)}:${段(目标.ref)}:${段(原因)}:${屏蔽 ? '1' : '0'}`,
} as const;

/** P8 读锁表里的资源键：credentials / sessions / export（export 于 Task 5 接线）。 */
type P8资源 = 'credentials' | 'sessions' | 'export';

/** 注销未知结果的显式重放间隔（spec §7.5：无 Retry-After 时分别等 1 秒、2 秒）。 */
const 等待毫秒 = (毫秒: number): Promise<void> => new Promise((完成) => { setTimeout(完成, 毫秒); });

/** P8 账号安全域可复用初始化/重置底座：Provider 首帧与会话转移口共用同一形状。 */
export function 创建空P8控制面状态(): P8控制面状态 {
  const 空 = <T>(): P8资源快照<T> => ({
    phase: 'idle', refreshing: false, data: null, error: null, generation: 0,
  });
  return {
    credentials: 空<P8Credential[]>(),
    sessions: 空<P8Session[]>(),
    dataExport: 空<P8DataExport>(),
  };
}

/**
 * P8 引用级清理：范围代际递增（在飞读写按旧代整包作废）+ 读锁与待定意图清空 +
 * 账号可见复位。登出 / 401 / 换主体 / Provider 卸载统一走这里；可选成员缺省时
 * （旧依赖桩）静默跳过，快照仍由 创建空P8控制面状态() 的状态摊平兜底。
 * P8导出恢复 不在此列：它是按 subject 隔离的恢复坐标，跨登出保留（spec §8.3）；
 * 只有注销 202 与 export 404/expired/明确重新生成在域内删当前 subject 句柄。
 */
export function 清P8控制面引用(
  deps: Partial<Pick<后端操作依赖, 'P8范围代际' | 'P8账号可见' | 'P8读取锁' | 'P8待定意图'>>,
): void {
  if (deps.P8范围代际) deps.P8范围代际.current += 1;
  deps.P8读取锁?.current.clear();
  deps.P8待定意图?.current.clear();
  if (deps.P8账号可见) deps.P8账号可见.current = false;
}

/** 401 统一判据：会话失效一律走 清账号状态（与其它域同口径）。 */
function 是401(错误: unknown): boolean {
  return 错误 instanceof BFF错误 && 错误.status === 401;
}

/**
 * P8 专属公开错误文案（spec §7–§8 错误语义表）：未知错误码统一「请求失败，请稍后重试」，
 * 绝不透传后端英文 message；断网 / 502/503/504 / invalid_response / invalid_session
 * 复用 取后端错误文案 的既有闭合分支。
 */
const P8专属文案: Record<string, string> = {
  invalid_session: '登录已失效，请重新登录',
  identity_service_unavailable: '账号服务暂时不可用，请稍后重试',
  operation_outcome_unknown: '暂时无法确认操作是否成功，请稍后重试',
  idempotency_in_progress: '操作仍在处理中，请稍后重试',
  idempotency_conflict: '操作状态发生冲突，请刷新后确认',
  credential_replacement_conflict: '验证码不正确或已过期，请重新获取后再试',
  export_in_progress: '已有导出正在生成或等待下载，请稍后重试',
  data_export_not_found: '导出已失效，请重新生成',
  // 合规举报两码（Task 7）：屏蔽暂不可用是可绕开的终局（取消勾选即纯举报）；
  // 目标不存在是统一终局 —— 屏层关掉过期层并刷新来源
  block_unavailable: '暂时无法同时屏蔽，可取消勾选后仅提交举报',
  report_target_not_found: '举报对象已不存在，请刷新后重试',
  rate_limited: '操作过于频繁，请稍后再试',
  invalid_request_body: '请求内容无法处理，请检查输入后重试',
  invalid_origin: '当前后端环境配置不正确',
  invalid_response: '服务返回异常，请稍后重试',
  backend_unavailable: '当前数据源不支持该操作',
};

export function 取P8错误文案(错误: unknown): string {
  if (!(错误 instanceof BFF错误)) return 取后端错误文案(错误);
  const 专属 = P8专属文案[错误.code];
  if (专属 !== undefined) return 专属;
  // 请求前自铸的 invalid_request（本模块与 facade 的入参拦截）带固定中文文案，
  // 不是后端 message，可以展示；其余 status 0 走断网文案。
  if (错误.status === 0 && 错误.code === 'invalid_request') return 错误.message;
  if (错误.status === 0 || 错误.code === 'network_error') return '无法连接后端服务，请检查网络或稍后重试';
  if (错误.status === 502 || 错误.status === 503 || 错误.status === 504) return '后端服务暂时不可用，请稍后重试';
  return '请求失败，请稍后重试';
}

/**
 * 举报目标不存在的统一终局判据（Task 7）：共用举报层据此关层并回调 目标失效
 * （屏层各自刷新来源）；文案统一走 取P8错误文案 的闭合表，绝不透传 error.message。
 */
export function 是举报目标失效(错误: unknown): boolean {
  return 错误 instanceof BFF错误 && 错误.status === 404 && 错误.code === 'report_target_not_found';
}

/** 快照的纯构造器：起步 / 失败（成功构造内联在读取核里；成功快照永不降级）。 */
function 起步快照<T>(旧: P8资源快照<T>, generation: number): P8资源快照<T> {
  if (旧.phase === 'success') return { ...旧, refreshing: true, error: null, generation };
  return { phase: 'loading', refreshing: true, data: 旧.data, error: null, generation };
}

function 失败快照<T>(旧: P8资源快照<T>, 错误: unknown, generation: number): P8资源快照<T> {
  // 已成功的快照刷新失败只落重试错误，旧 data 保留（不降级为空）
  if (旧.phase === 'success') return { ...旧, refreshing: false, error: 取P8错误文案(错误), generation };
  return { phase: 'error', refreshing: false, data: 旧.data, error: 取P8错误文案(错误), generation };
}

/** 每个异步读写发送前捕获的栅栏：读判定看全三代，写判定只看 subject + 会话代际。 */
interface P8栅栏 {
  subject: string | null;
  session: number;
  scope: number;
}

/** Provider 恒注入五个 P8 引用；缺引用是接线缺陷，在工厂入口尽早暴露而不是静默错栅栏。 */
function 取P8引用(deps: 后端操作依赖): 后端操作依赖 & P8运行时引用 {
  if (!deps.P8范围代际 || !deps.P8账号可见 || !deps.P8读取锁 || !deps.P8待定意图 || !deps.P8导出恢复) {
    throw new Error('P8 控制面运行时引用未初始化（Provider 必须一次性注入）');
  }
  return deps as 后端操作依赖 & P8运行时引用;
}

export function 创建P8账号安全操作(deps: 后端操作依赖): P8账号控制面操作 & P8合规操作 {
  const { 是后端, 后端, 设后端状态, 后端状态引用, 主体标识引用, 会话代际 } = deps;
  const 引用 = 取P8引用(deps);
  const { P8范围代际, P8账号可见, P8读取锁, P8待定意图, P8导出恢复 } = 引用;
  // 清账号状态 需要的子集（与其它域同口径；P4/P7/P8 引用做三域清理）
  const 账号清理依赖 = {
    派发: deps.派发, 设后端状态, 后端, 主体标识引用, 会话代际,
    P4范围代际: deps.P4范围代际, P4幂等意图: deps.P4幂等意图, P4可见范围: deps.P4可见范围,
    P7范围代际: deps.P7范围代际, P7待定意图: deps.P7待定意图, P7可见收件箱: deps.P7可见收件箱,
    P7可见会话: deps.P7可见会话, P7已读位置: deps.P7已读位置,
    P8范围代际, P8账号可见, P8读取锁, P8待定意图,
  };

  /** 401 的统一收口：清账号状态（含 P4/P7/P8 状态与引用）+ P8 状态摊平与引用级清理。 */
  function 清账号与P8(): void {
    清账号状态(账号清理依赖);
    设后端状态((旧) => ({ ...旧, ...创建空P8控制面状态() }));
    清P8控制面引用(引用);
  }

  // ── 栅栏 ──

  function 捕获栅栏(): P8栅栏 {
    return { subject: 主体标识引用.current, session: 会话代际.current, scope: P8范围代际.current };
  }

  /** 写路径判定：subject + 会话代际。范围代际只是 UI 刷新换代，绝不终结写。 */
  function 会话栅栏仍当前(fence: P8栅栏): boolean {
    return 主体标识引用.current === fence.subject && 会话代际.current === fence.session;
  }

  /** 读路径判定：全三代 —— 范围换代（force / 引用清理）后旧读整包作废。 */
  function 栅栏仍当前(fence: P8栅栏): boolean {
    return 会话栅栏仍当前(fence) && P8范围代际.current === fence.scope;
  }

  // ── 快照落位的小工具 ──

  /** 读路径的统一核（credentials / sessions / export 行为一致，按资源参数化）：
   *  起步 / 成功 / 失败 / 换代回滚；迟到成败按栅栏整包作废，锁随单飞收口。
   *  结算处理 只在栅栏仍立（且非 401）的落位前调用 —— export 用它做 404/expired
   *  的句柄清理，其余资源不传。 */
  function 发起读取<T>(
    资源: P8资源,
    发请求: () => Promise<T>,
    读取快照: () => P8资源快照<T>,
    写快照: (快照: P8资源快照<T>) => void,
    结算处理?: (结果: { ok: true; data: T } | { ok: false; error: unknown }) => void,
  ): Promise<void> {
    const fence = 捕获栅栏();
    const 本次 = (async (): Promise<void> => {
      const 起飞前 = 读取快照();
      /** 范围换代作废本轮结算时滚回起飞前状态：姊妹资源的 force 换代绝不把本资源
       *  永久滞留在 loading/refreshing（spec §7.1 两块独立结算；「整包过时」只管数据
       *  新旧，不留转不动的 spinner）。两道闸门：会话/主体已换代 ⇒ 清理已摊平，
       *  旧会话数据绝不回写新会话；本资源已停到更新一代（接管的 force 新读已落位）
       *  ⇒ 绝不覆盖新读的结果。 */
      const 回滚起飞前 = (): void => {
        if (!会话栅栏仍当前(fence)) return;
        if (读取快照().generation !== fence.scope) return;
        写快照({ ...起飞前, refreshing: false });
      };
      写快照(起步快照(起飞前, fence.scope));
      try {
        const 数据 = await 发请求();
        if (!栅栏仍当前(fence)) {
          回滚起飞前(); // 迟到成功：数据整包作废，快照滚回起飞前
          return;
        }
        结算处理?.({ ok: true, data: 数据 });
        写快照({ phase: 'success', refreshing: false, data: 数据, error: null, generation: fence.scope });
      } catch (错误) {
        if (!栅栏仍当前(fence)) {
          回滚起飞前(); // 迟到失败（含 401）只丢弃：绝不登出新会话，也不滞留 spinner
          return;
        }
        if (是401(错误)) {
          // 当前会话 401：统一清账号（P8 快照随摊平为空底座）；读路径不抛出
          清账号与P8();
          return;
        }
        结算处理?.({ ok: false, error: 错误 });
        写快照(失败快照(读取快照(), 错误, fence.scope));
      }
    })();
    const 收口 = 本次.finally(() => {
      if (P8读取锁.current.get(资源) === 收口) P8读取锁.current.delete(资源);
    });
    P8读取锁.current.set(资源, 收口); // force 换代后新读接管锁；旧读迟到只整包作废
    return 收口;
  }

  function 发起凭证读(): Promise<void> {
    return 发起读取(
      'credentials',
      () => 后端!.读取P8凭证(),
      () => 后端状态引用.current.credentials,
      (快照) => 设后端状态((旧态) => ({ ...旧态, credentials: 快照 })),
    );
  }

  function 发起会话读(): Promise<void> {
    return 发起读取(
      'sessions',
      () => 后端!.读取P8会话(),
      () => 后端状态引用.current.sessions,
      (快照) => 设后端状态((旧态) => ({ ...旧态, sessions: 快照 })),
    );
  }

  async function 运行读取(资源: 'credentials' | 'sessions', force: boolean): Promise<void> {
    if (!force) {
      const 在飞 = P8读取锁.current.get(资源);
      if (在飞) return 在飞; // 单飞：重复调用并入同一 Promise
    } else {
      P8范围代际.current += 1; // force 提升 P8 范围代际：旧在飞读整包过时（结算回滚不滞留）
    }
    return 资源 === 'credentials' ? 发起凭证读() : 发起会话读();
  }

  /** 完成换绑成功后的双资源强制重读：一次换代、两路共享同一新代，绝不互相作废。 */
  async function 强制重读账号安全(): Promise<void> {
    P8范围代际.current += 1;
    await Promise.all([发起凭证读(), 发起会话读()]);
  }

  // ── 写意图与单飞命令 ──

  /**
   * 结果不确定判据：未知 / 进行中 / 限流 / 下游不可用 / 传输层异常 ——
   * 一律保留原键与不可变请求，只允许同键重试（spec §8.2/§8.4）。
   */
  function 是结果不确定(错误: unknown): boolean {
    if (!(错误 instanceof BFF错误)) return true; // 网络异常：结果未知
    if (错误.code === 'operation_outcome_unknown' || 错误.code === 'idempotency_in_progress'
      || 错误.code === 'rate_limited' || 错误.code === 'identity_service_unavailable') return true;
    return 错误.status === 0 || 错误.status >= 500;
  }

  /**
   * 合规端点（反馈 Task 6 / 举报 Task 7）的结果不确定判据：合规 429 不带 Retry-After，
   * 没有可等的窗口 —— 限流是终局拒绝（清意图、绝不排定时器自动重试），用户手动再
   * 提交才铸新键。其余与账号控制面同口径。
   */
  function 是合规结果不确定(错误: unknown): boolean {
    if (错误 instanceof BFF错误 && 错误.status === 429 && 错误.code === 'rate_limited') return false;
    return 是结果不确定(错误);
  }

  /** 同一意图沿用既有键；只有无键时才铸造（crypto.randomUUID，16–128 可见 ASCII）。 */
  function 待定意图For<T>(坐标: string, request: T): P8待定意图<T> {
    const 既有 = P8待定意图.current.get(坐标);
    if (既有 !== undefined) return 既有 as P8待定意图<T>; // 坐标已编码全部请求语义，形状必然同构
    const 铸造: P8待定意图<T> = { key: globalThis.crypto.randomUUID(), request };
    P8待定意图.current.set(坐标, 铸造 as P8待定意图<unknown>);
    return 铸造;
  }

  /** 只删自己那把键：会话清理后新铸的同坐标意图绝不被旧结算误删。 */
  function 删意图键(坐标: string, 键: string): void {
    if (P8待定意图.current.get(坐标)?.key === 键) P8待定意图.current.delete(坐标);
  }

  /** 同一动作在飞时重复点击只并入同一 Promise，不铸第二把键。 */
  const 在飞命令 = new Map<string, Promise<unknown>>();
  function 单飞命令<T>(坐标: string, 运行: () => Promise<T>): Promise<T> {
    // 会话代际入键：旧会话未收口的在飞承诺绝不吞掉新会话的同坐标命令。
    const 会话键 = `${会话代际.current}:${坐标}`;
    const 在飞 = 在飞命令.get(会话键);
    if (在飞) return 在飞 as Promise<T>;
    const 本次 = 运行().finally(() => {
      在飞命令.delete(会话键);
    });
    在飞命令.set(会话键, 本次);
    return 本次;
  }

  /**
   * 意图键化命令的共用收口：成功 → 清意图，会话栅栏仍立时执行成功后权威重读
   * （重读完成前不 resolve）；当前会话 401 → 清账号并摊平后原样抛出（屏幕走登录恢复）；
   * 结果不确定 → 保留原键与不可变请求；终局拒绝（400/403/409 冲突）→ 清意图。
   * 绝不重放变更、绝不乐观写。不确定判据可按法替换（反馈的 429 是终局）。
   */
  async function 运行命令<T>(
    坐标: string,
    request: unknown,
    发出: (键: string) => Promise<T>,
    成功后?: () => Promise<void>,
    不确定判据: (错误: unknown) => boolean = 是结果不确定,
  ): Promise<T> {
    const fence = 捕获栅栏();
    const 意图 = 待定意图For(坐标, request);
    try {
      const 回执 = await 发出(意图.key);
      删意图键(坐标, 意图.key);
      if (成功后 && 会话栅栏仍当前(fence)) await 成功后();
      return 回执;
    } catch (错误) {
      if (是401(错误)) {
        if (会话栅栏仍当前(fence)) 清账号与P8();
        throw 错误;
      }
      if (!不确定判据(错误)) 删意图键(坐标, 意图.key);
      throw 错误;
    }
  }

  /**
   * 反馈的意图键化命令：无成功后重读（回执 ticketId 就是权威结果，无快照要落位），
   * 不确定判据换成 合规版（429 终局）。
   */
  function 运行反馈命令<T>(坐标: string, request: unknown, 发出: (键: string) => Promise<T>): Promise<T> {
    return 运行命令(坐标, request, 发出, undefined, 是合规结果不确定);
  }

  /**
   * 举报确认后的隐私收口（Task 7）：回执 blockStatus='applied' 说明服务端已把屏蔽
   * 落进候选侧组织屏蔽名单 —— 当前角色是候选时恰做一次权威隐私读取，并走既有 P3
   * 水合路径（派发 水合后端隐私 + 写 后端状态.隐私快照，与会话水合同一收口）。
   * 招聘端绝不读候选隐私；本地绝不派发 {型:'拉黑'}（P8 之前/之后的屏蔽名单都只认
   * 权威视图）。重读失败不冒充举报失败 —— 举报已权威受理，镜像滞后留给下次隐私读取。
   */
  async function 举报后重读隐私(回执: P8ReportReceipt): Promise<void> {
    if (回执.blockStatus !== 'applied') return;
    if (后端状态引用.current.主体?.last_used_role !== 'candidate') return;
    try {
      const 权威 = await 后端!.读取隐私();
      deps.派发({ 型: '水合后端隐私', 快照: 权威 });
      设后端状态((旧) => ({ ...旧, 隐私快照: 权威.服务端 }));
    } catch {
      // 屏蔽已权威生效：隐私镜像的滞后不影响已确认的举报结果
    }
  }

  // ── 数据导出（Task 5）：恢复句柄与三态读写 ──────────────────────

  /** 当前 subject 的恢复句柄；适配器缺席时 null（存储本身 fail closed，绝不外抛）。 */
  function 取恢复句柄(): P8导出恢复句柄 | null {
    const 存储 = P8导出恢复.current;
    if (存储 === null) return null;
    return 存储.读取();
  }

  /** 清当前 subject 句柄：export 404/expired、明确重新生成、注销 202 用。 */
  function 清恢复句柄(): void {
    const 存储 = P8导出恢复.current;
    if (存储 === null) return;
    存储.删除();
  }

  function 是导出不存在(错误: unknown): boolean {
    return 错误 instanceof BFF错误 && 错误.status === 404 && 错误.code === 'data_export_not_found';
  }

  /** 已知 exportId：快照（权威）优先，句柄兜底；都没有时调用方零请求。 */
  function 取当前导出ID(): string | null {
    const 快照ID = 后端状态引用.current.dataExport.data?.exportId ?? null;
    if (快照ID !== null) return 快照ID;
    const 句柄 = 取恢复句柄();
    if (句柄 === null) return null;
    return 句柄.exportId;
  }

  function 发起导出读(exportId: string): Promise<void> {
    return 发起读取(
      'export',
      () => 后端!.读取P8数据导出(exportId),
      () => 后端状态引用.current.dataExport,
      (快照) => 设后端状态((旧态) => ({ ...旧态, dataExport: 快照 })),
      // 404 / expired：清句柄回到可创建态（spec §5.3/§7.4）；快照照常落位（错误文案/终态）
      (结果) => {
        if (结果.ok) {
          if (结果.data.status === 'expired') 清恢复句柄();
          return;
        }
        if (是导出不存在(结果.error)) 清恢复句柄();
      },
    );
  }

  /** 导出状态读取（'export' 单飞）：无已知 exportId 零请求。 */
  async function 运行导出读(): Promise<void> {
    const 在飞 = P8读取锁.current.get('export');
    if (在飞) return 在飞; // 单飞：重复调用并入同一 Promise
    const exportId = 取当前导出ID();
    if (exportId === null) return;
    return 发起导出读(exportId);
  }

  /** 创建回执落位：句柄补 exportId（best-effort —— POST 已成，落盘失败只损失跨刷新
   *  恢复）+ 权威快照写入；只在会话栅栏仍立时提交。 */
  function 落位导出回执(subjectId: string, createKey: string, 回执: P8DataExport, fence: P8栅栏): void {
    if (!会话栅栏仍当前(fence)) return;
    const 存储 = P8导出恢复.current;
    if (存储 !== null) 存储.写入({ subjectId, createKey, exportId: 回执.exportId });
    设后端状态((旧) => ({
      ...旧,
      dataExport: { phase: 'success', refreshing: false, data: 回执, error: null, generation: fence.scope },
    }));
  }

  /**
   * 导出创建/续接的共用核（spec §7.4 三分支）：
   *   有 ID 句柄 → 只权威 GET，绝不 POST；
   *   exportId:null 句柄 → 用落盘 createKey 同键重放 POST（响应丢失/跨刷新续接）；
   *   无句柄且 允许新建 → 先落盘 {exportId:null} 再 POST（写入失败固定暂不可用 + 零请求）。
   */
  async function 确保数据导出(允许新建: boolean): Promise<void> {
    const 存储 = P8导出恢复.current;
    if (存储 === null) {
      if (允许新建) throw 数据导出暂不可用();
      return; // 被动恢复：无适配器零导出请求
    }
    const 既有 = 存储.读取();
    if (既有 !== null && 既有.exportId !== null) {
      await 运行导出读(); // 有 ID：只 GET
      return;
    }
    if (既有 === null && !允许新建) return; // 被动恢复：无句柄零请求
    const subjectId = 主体标识引用.current;
    if (subjectId === null) throw 数据导出暂不可用();
    const createKey = 既有 === null ? globalThis.crypto.randomUUID() : 既有.createKey;
    const 坐标 = 意图坐标.创建数据导出(createKey);
    // 落盘严格先于 POST（spec §5.3）：预写失败绝不为了继续请求而静默跳过恢复句柄
    if (存储.写入({ subjectId, createKey, exportId: null }) !== true) throw 数据导出暂不可用();
    // 幂等键就是落盘的 createKey：跨刷新重放由句柄承载，Map 只保会话内同键纪律
    if (!P8待定意图.current.has(坐标)) {
      P8待定意图.current.set(坐标, { key: createKey, request: { createKey } } as P8待定意图<unknown>);
    }
    const fence = 捕获栅栏();
    try {
      const 回执 = await 单飞命令(坐标, () => 运行命令(
        坐标,
        { createKey },
        (键) => 后端!.创建P8数据导出(键),
      ));
      落位导出回执(subjectId, createKey, 回执, fence);
    } catch (错误) {
      // 终局拒绝（409 冲突 / 403 / 400）：预写的 {exportId:null} 句柄是死键，回滚删除，
      // 下一次创建铸新键；未知/进行中/401 保留 —— 那正是同键重放要用的键
      if (错误 instanceof BFF错误 && !是401(错误) && !是结果不确定(错误)) {
        const 当前 = 存储.读取();
        if (当前 !== null && 当前.createKey === createKey && 当前.exportId === null) 存储.删除();
      }
      throw 错误;
    }
  }

  /**
   * 注销（spec §7.5）：body {} 已由 facade 冻结；未知结果同键 1s/2s 显式重放至多两次
   * （HTTP 客户端自带 Retry-After 重试发生在单次调用内，这里绝不另铸键）；持续不确定
   * 保留意图供手动重试并原样抛出。202 收口以会话栅栏为界：栅栏仍立时先统一清 P4–P8
   * 再 resolve（句柄清理尽力而为）；重放窗内会话/主体已换代的迟到 202 绝不摊平新会话、
   * 绝不顺着已换绑的 ref 删新主体句柄，固定文案抛出让屏幕不做「自己登出成功」式导航。
   */
  async function 运行注销(): Promise<void> {
    const 坐标 = 意图坐标.注销账号;
    const fence = 捕获栅栏();
    const 意图 = 待定意图For(坐标, {});
    let 最后不确定: unknown = null;
    let 已受理 = false;
    for (let 次 = 0; 次 < 3 && !已受理; 次 += 1) {
      if (次 > 0) await 等待毫秒(次 === 1 ? 1_000 : 2_000);
      try {
        await 后端!.请求P8账号注销(意图.key);
        已受理 = true; // 202：跳出重放循环，收口在循环外做（收口自身的抛出不是可重放结果）
      } catch (错误) {
        if (是401(错误)) {
          if (会话栅栏仍当前(fence)) 清账号与P8();
          throw 错误;
        }
        if (!是结果不确定(错误)) {
          删意图键(坐标, 意图.key);
          throw 错误;
        }
        最后不确定 = 错误; // 未知/进行中/网络异常：同键同请求，稍后显式重放
      }
    }
    if (!已受理) {
      // 持续不确定：停止自动请求，保留原键供手动重试；原样抛出（固定文案由闭合表映射）
      throw 最后不确定;
    }
    // ── 202 收口 ──
    删意图键(坐标, 意图.key); // 202 是终局：无论本地能否收口，意图不再重放
    if (!会话栅栏仍当前(fence)) {
      // 迟到的 202：注销确已受理，但会话/主体已换代 —— 绝不摊平新会话的登录态，也绝不
      // 删除（ref 已被 Provider 换绑的）新主体导出句柄；旧主体的句柄留在原地，由其
      // 重新登录后的 404 兜底清除。固定文案抛出，屏幕不做本地登出式导航。
      throw 注销收口已换代();
    }
    // 统一清理（支持域 + P4/P6/P7/P8 快照与引用 + 会话代际 + 目录缓存）先于 resolve；
    // 当前 subject 导出句柄一并删除（可选 no-op，存储失败不冒充注销失败）；
    // 导航与页面收口归屏幕。
    清账号状态(账号清理依赖);
    const 存储 = P8导出恢复.current;
    if (存储 !== null) {
      try {
        存储.删除();
      } catch {
        // 句柄清理失败不影响已确认的注销结果
      }
    }
  }

  // ── 公开操作 ──

  return {
    设置P8账号范围(visible) {
      // 只写 UI 可见引用：不递增范围代际、不清锁 —— UI 卸载不是会话边界，
      // 共享账号快照仍按 subject/会话栅栏提交；迟到的提示是否弹由该引用抑制。
      P8账号可见.current = visible === true;
    },

    async 加载P8凭证(force) {
      if (!是后端 || !后端) return;
      if (force !== true && 后端状态引用.current.credentials.phase === 'success') return;
      await 运行读取('credentials', force === true);
    },

    async 加载P8会话(force) {
      if (!是后端 || !后端) return;
      if (force !== true && 后端状态引用.current.sessions.phase === 'success') return;
      await 运行读取('sessions', force === true);
    },

    开始P8手机号换绑(phone) {
      if (!是后端 || !后端) return Promise.reject(仅后端可用());
      const 手机号 = typeof phone === 'string' ? phone.trim() : '';
      if (!大陆手机号模式.test(手机号)) {
        // 发送前拦截：不铸意图、零请求（+86 E.164 由 facade 构造，本层只放行 11 位裸号）
        return Promise.reject(new BFF错误(0, 'invalid_request', '请输入 11 位中国大陆手机号'));
      }
      const 坐标 = 意图坐标.换绑开始(手机号);
      return 单飞命令(坐标, () => 运行命令(
        坐标,
        { phone: 手机号 },
        (键) => 后端!.开始P8手机号换绑(手机号, 键),
      ));
    },

    完成P8手机号换绑(attemptId, code) {
      if (!是后端 || !后端) return Promise.reject(仅后端可用());
      const 尝试 = typeof attemptId === 'string' ? attemptId.trim() : '';
      const 验证码 = typeof code === 'string' ? code.trim() : '';
      if (尝试.length === 0) {
        return Promise.reject(new BFF错误(0, 'invalid_request', '换绑尝试 ID 不能为空'));
      }
      if (!验证码模式.test(验证码)) {
        return Promise.reject(new BFF错误(0, 'invalid_request', `验证码需要 ${短信验证码位数} 位数字`));
      }
      const 坐标 = 意图坐标.换绑完成(尝试, 验证码);
      return 单飞命令(坐标, () => 运行命令(
        坐标,
        { attemptId: 尝试, code: 验证码 },
        (键) => 后端!.完成P8手机号换绑(尝试, 验证码, 键),
        // 不乐观写回执里的掩码手机号：先强制重读凭证+会话，重读完成才 resolve
        强制重读账号安全,
      ));
    },

    退出P8其他设备() {
      if (!是后端 || !后端) return Promise.reject(仅后端可用());
      const 坐标 = 意图坐标.退出其他设备;
      return 单飞命令(坐标, () => 运行命令(
        坐标,
        {}, // 无参数命令：请求语义恒定，未知/进行中一律同键重放
        (键) => 后端!.退出P8其他设备(键),
        // 回执计数归屏幕提示；列表以权威重读为准（只重读会话，凭证不受影响）
        () => 运行读取('sessions', true),
      ));
    },

    async 恢复P8数据导出() {
      if (!是后端 || !后端) return; // 读路径早退：Mock 零请求
      await 确保数据导出(false);
    },

    async 创建P8数据导出() {
      if (!是后端 || !后端) return Promise.reject(仅后端可用());
      await 确保数据导出(true);
    },

    async 刷新P8数据导出() {
      if (!是后端 || !后端) return; // 读路径早退：Mock 零请求
      await 运行导出读();
    },

    废弃P8数据导出() {
      if (!是后端 || !后端) return;
      const 旧句柄 = 取恢复句柄();
      清恢复句柄();
      // 旧 createKey 的意图一并终结：明确重新生成 = 新键（spec §8.2）
      if (旧句柄 !== null) 删意图键(意图坐标.创建数据导出(旧句柄.createKey), 旧句柄.createKey);
      // 在飞导出读按旧代整包作废；快照摊平回可创建态（generation 用新代，迟到的回滚不覆盖）
      P8范围代际.current += 1;
      设后端状态((旧) => ({
        ...旧,
        dataExport: { phase: 'idle', refreshing: false, data: null, error: null, generation: P8范围代际.current },
      }));
    },

    取P8数据导出下载地址(): string | null {
      if (!是后端 || !后端) return null;
      // ready+downloadReady 是唯一可下载组合；其余（含携带 expiresAt 的）一律不可下载
      const 数据 = 后端状态引用.current.dataExport.data;
      if (数据 === null || 数据.status !== 'ready' || !数据.downloadReady) return null;
      // 同源相对 URL 由 facade 严格校验构造（非法 exportId 在 facade 零请求拒绝）
      return 后端.取P8数据导出下载地址(数据.exportId);
    },

    请求P8账号注销() {
      if (!是后端 || !后端) return Promise.reject(仅后端可用());
      const 坐标 = 意图坐标.注销账号;
      // 终局确认单飞：未知重放窗口内的重复点击只并入同一 Promise，不铸第二把键
      return 单飞命令(坐标, () => 运行注销());
    },

    提交P8反馈(category, details) {
      if (!是后端 || !后端) return Promise.reject(仅后端可用());
      // 入参校验在本层收口（facade 只挡 wire 形状）：分类必须在表内；正文先 trim 再按
      // Unicode 码点计数（Array.from，绝不是 UTF-16 单元数）—— 非法输入零请求、零意图。
      const 分类 = typeof category === 'string' ? category : ('' as P8FeedbackCategory);
      if (!反馈分类全表.includes(分类)) {
        return Promise.reject(new BFF错误(0, 'invalid_request', '反馈分类不合法'));
      }
      const 正文 = typeof details === 'string' ? details.trim() : '';
      const 码点数 = Array.from(正文).length;
      if (码点数 < 反馈正文码点上下限.下限 || 码点数 > 反馈正文码点上下限.上限) {
        return Promise.reject(new BFF错误(0, 'invalid_request',
          `反馈内容需要 ${反馈正文码点上下限.下限}–${反馈正文码点上下限.上限} 字`));
      }
      const 坐标 = 意图坐标.提交反馈(分类, 正文);
      // body 与线协议逐字一致（恰 {category, details}）；回执 ticketId 原样返回给屏幕，
      // 成功清意图，未知/网络异常同键同 body 重试，409 冲突与 429 限流是终局
      return 单飞命令(坐标, () => 运行反馈命令(
        坐标,
        { category: 分类, details: 正文 },
        (键) => 后端!.提交P8反馈(分类, 正文, 键),
      ));
    },

    提交P8举报(target, reason, alsoBlock) {
      if (!是后端 || !后端) return Promise.reject(仅后端可用());
      // 入参校验在本层收口（facade 同款 exact key set）：目标恰 {type, ref} 且分支
      // 在表内、ref 非空；原因在四值表内；屏蔽是布尔 —— 展示名等多出的键绝不随目标
      // 上车，非法输入零请求、零意图。
      if (!是合法举报目标(target) || !举报原因全表.includes(reason) || typeof alsoBlock !== 'boolean') {
        return Promise.reject(new BFF错误(0, 'invalid_request', '举报参数不合法'));
      }
      const 坐标 = 意图坐标.提交举报(target, reason, alsoBlock);
      // 意图请求恰 {target, reason, also_block}：无身份/角色/组织名/展示名/证据/正文，
      // 也没有第二个屏蔽目标（服务端按目标解析）。成功清意图并按回执收口隐私镜像；
      // 未知/网络异常同键同请求重试；409 冲突（含 block_unavailable）、404 目标不存在
      // 与 429 限流是终局；取消勾选屏蔽＝新坐标新键。
      let 回执: P8ReportReceipt;
      return 单飞命令(坐标, () => 运行命令(
        坐标,
        { target, reason, also_block: alsoBlock },
        (键) => 后端!.提交P8举报(target, reason, alsoBlock, 键).then((值) => {
          回执 = 值;
          return 值;
        }),
        () => 举报后重读隐私(回执),
        是合规结果不确定,
      ));
    },
  };
}

/** 举报目标的入参形状：恰 {type, ref}（exact key set）、分支在表内、ref 非空串。 */
function 是合法举报目标(值: P8ReportTarget): 值 is P8ReportTarget {
  if (typeof 值 !== 'object' || 值 === null) return false;
  const 键们 = Object.keys(值);
  if (键们.length !== 2 || !键们.includes('type') || !键们.includes('ref')) return false;
  const 目标 = 值 as { type: unknown; ref: unknown };
  if (typeof 目标.ref !== 'string' || 目标.ref.length === 0) return false;
  return 举报目标分支全表.some((分支) => 目标.type === 分支);
}

/** Mock / 无后端模式的写路径拒绝：不伪造成功回执（读路径静默早退）。 */
function 仅后端可用(): BFF错误 {
  return new BFF错误(0, 'backend_unavailable', '账号安全操作仅在后端模式可用');
}

/** 导出创建的持久化闸门失败（适配器缺席 / 主体缺席 / 写入失败）：固定文案 + 零请求。 */
function 数据导出暂不可用(): BFF错误 {
  return new BFF错误(0, 'invalid_request', '数据导出暂不可用，请稍后重试');
}

/** 重放窗内会话/主体已换代时收到的迟到 202：注销确已受理，但本地收口必须放弃。 */
function 注销收口已换代(): BFF错误 {
  return new BFF错误(0, 'invalid_request', '注销已受理，但会话已切换，请在重新登录后确认');
}
