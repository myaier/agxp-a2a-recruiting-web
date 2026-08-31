// 后端 P8 控制面域运行时 owner（Task 3）：账号安全资源（凭证/会话）的内存态快照、
// 单飞读取、subject/会话/范围三代栅栏，与手机号换绑、退出其他设备的意图键化命令。
// 铁律（spec §7–§8 与已准入 P8 冻结契约）：
//   · Backend 才发请求：读路径早退、写路径拒绝 backend_unavailable；Mock 模式零 P8
//     请求，接口失败绝不回退 Mock。快照 / 锁 / 意图只在内存（后端状态 + 运行时引用），
//     绝不进 资料持久化、浏览器存储、Cache API 或 Service Worker。
//   · 读栅栏 = subject_id + 会话代际 + P8 范围代际，每个请求发送前捕获；任一不匹配的
//     迟到成败只释放本轮读锁 —— 不写快照、不派发、不清会话（迟到的 401 绝不能登出新会话）。
//     credentials / sessions 各自单飞，重复调用并入同一 Promise；force 刷新递增范围代际
//     使旧在飞读整包过时并由新读接管锁；已成功快照刷新途中保留旧 data 不降级为空。
//   · 写栅栏 = subject_id + 会话代际（范围代际只是 UI 刷新换代，绝不终结写）：当前会话
//     401 走统一 清账号状态 并原样抛出，让屏幕沿既有登录恢复路径；栅栏已换代的迟到写
//     401 只丢弃。完成换绑成功先强制重读凭证+会话（一次换代、两路共享同一新代）再
//     resolve，绝不乐观写回执里的掩码手机号；退出其他设备成功权威重读会话，
//     回执计数原样返回，不影响当前会话、不清账号状态。
//   · 写意图：key 由 crypto.randomUUID 铸造（16–128 可见 ASCII）；意图坐标（可含中文）
//     只作内存 Map 键，绝不进数据源键参数。换绑开始坐标=手机号、换绑完成坐标=
//     attempt+验证码（begin/complete 各自独立键）、退出其他设备坐标恒定 —— 换手机号 /
//     换 attempt / 换验证码即新意图新键；operation_outcome_unknown / idempotency_in_progress /
//     限流 / 下游不可用 / 传输层异常保留原键与不可变请求只允许同键重试；成功与终局拒绝
//     （400/403/409 冲突）清意图；同一动作在飞时重复点击只并入同一 Promise。
//   · 入参校验在本层收口：换绑开始只收 11 位中国大陆裸号（facade 只负责 +86 E.164 构造），
//     换绑完成证明执行产品全局 短信验证码位数 规则 —— 非法输入零请求、零意图。
//   · 错误文案是本模块闭合的固定中文表：未知 BFF错误.message 绝不透传。
//   · 导出/注销（Task 5）与反馈/举报（Task 6–7）不在本表：绝不预留空桩。

import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type {
  P8Credential,
  P8DataExport,
  P8Session,
} from '../../数据/招聘数据源/P8控制面';
import { 短信验证码位数 } from '../../数据/验证码规则';
import { 清账号状态 } from './会话操作';
import type {
  P8账号安全操作,
  P8待定意图,
  P8控制面状态,
  P8运行时引用,
  P8资源快照,
  后端操作依赖,
  后端状态,
} from './类型';

/** 与 会话.开始手机登录 同款产品手机号规则：中国大陆 11 位裸号（1 开头）。 */
const 大陆手机号模式 = /^1\d{10}$/;

/** 产品全局短信验证码位数（登录与换绑共用，绝不在 P8 自立位数）。 */
const 验证码模式 = new RegExp(`^\\d{${短信验证码位数}}$`);

/** opaque id 的键内转义：意图坐标里的 id 逐段转义绝不撞键（与 P7 同一纪律）。 */
function 段(值: string): string {
  return encodeURIComponent(值);
}

/** 意图坐标（内存 Map 的键，可含中文）：换绑开始=手机号、换绑完成=attempt+验证码、退出恒定。 */
const 意图坐标 = {
  换绑开始: (手机号: string): string => `p8:换绑开始:${手机号}`,
  换绑完成: (attemptId: string, code: string): string => `p8:换绑完成:${段(attemptId)}:${code}`,
  退出其他设备: 'p8:退出其他设备',
} as const;

/** P8 读锁表里的资源键（export 的读锁 Task 5 接线，锁表先收录该坐标）。 */
type P8资源 = 'credentials' | 'sessions';

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
 * P8导出恢复 不在此列：它是按 subject 隔离的恢复坐标，跨登出保留（spec §8.3，Task 5 接线）。
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

export function 创建P8账号安全操作(deps: 后端操作依赖): P8账号安全操作 {
  const { 是后端, 后端, 设后端状态, 后端状态引用, 主体标识引用, 会话代际 } = deps;
  const 引用 = 取P8引用(deps);
  const { P8范围代际, P8账号可见, P8读取锁, P8待定意图 } = 引用;
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

  function 落(资源: P8资源, 构造: <T>(旧: P8资源快照<T>) => P8资源快照<T>): void {
    设后端状态((旧态: 后端状态) => 资源 === 'credentials'
      ? { ...旧态, credentials: 构造(旧态.credentials) }
      : { ...旧态, sessions: 构造(旧态.sessions) });
  }

  // ── 单飞读取核（credentials / sessions 各自一把锁；属主换代接管）──────────────

  /** 发起读取（不换代）：捕获栅栏、落起步快照、登记读锁；迟到成败按栅栏整包丢弃。 */
  function 发起读取(资源: P8资源): Promise<void> {
    const fence = 捕获栅栏();
    const 本次 = (async (): Promise<void> => {
      落(资源, (旧) => 起步快照(旧, fence.scope));
      try {
        if (资源 === 'credentials') {
          const 凭证 = await 后端!.读取P8凭证();
          if (!栅栏仍当前(fence)) return; // 迟到成功：只随单飞收口，不写共享快照
          设后端状态((旧态) => ({
            ...旧态,
            credentials: { phase: 'success', refreshing: false, data: 凭证, error: null, generation: fence.scope },
          }));
        } else {
          const 会话们 = await 后端!.读取P8会话();
          if (!栅栏仍当前(fence)) return;
          设后端状态((旧态) => ({
            ...旧态,
            sessions: { phase: 'success', refreshing: false, data: 会话们, error: null, generation: fence.scope },
          }));
        }
      } catch (错误) {
        if (!栅栏仍当前(fence)) return; // 迟到失败（含 401）只丢弃：绝不登出新会话
        if (是401(错误)) {
          // 当前会话 401：统一清账号（P8 快照随摊平为空底座）；读路径不抛出
          清账号与P8();
          return;
        }
        落(资源, (旧) => 失败快照(旧, 错误, fence.scope));
      }
    })();
    const 收口 = 本次.finally(() => {
      if (P8读取锁.current.get(资源) === 收口) P8读取锁.current.delete(资源);
    });
    P8读取锁.current.set(资源, 收口); // force 换代后新读接管锁；旧读迟到只整包丢弃
    return 收口;
  }

  async function 运行读取(资源: P8资源, force: boolean): Promise<void> {
    if (!force) {
      const 在飞 = P8读取锁.current.get(资源);
      if (在飞) return 在飞; // 单飞：重复调用并入同一 Promise
    } else {
      P8范围代际.current += 1; // force 提升 P8 范围代际：旧在飞读整包过时
    }
    return 发起读取(资源);
  }

  /** 完成换绑成功后的双资源强制重读：一次换代、两路共享同一新代，绝不互相作废。 */
  async function 强制重读账号安全(): Promise<void> {
    P8范围代际.current += 1;
    await Promise.all([发起读取('credentials'), 发起读取('sessions')]);
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
   * 绝不重放变更、绝不乐观写。
   */
  async function 运行命令<T>(
    坐标: string,
    request: unknown,
    发出: (键: string) => Promise<T>,
    成功后?: () => Promise<void>,
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
      if (!是结果不确定(错误)) 删意图键(坐标, 意图.key);
      throw 错误;
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
  };
}

/** Mock / 无后端模式的写路径拒绝：不伪造成功回执（读路径静默早退）。 */
function 仅后端可用(): BFF错误 {
  return new BFF错误(0, 'backend_unavailable', '账号安全操作仅在后端模式可用');
}
