// 后端接触记录域操作：候选 me/contact-events 的单主体内存态分页快照、首载/force
// 刷新的原子替换与追加的原子提交。铁律（Backend contact-events Plan 与 spec §B）：
//   · Backend 才发请求（!是后端 || !后端 一律早退）；Mock 模式零 contact-events
//     请求，接口失败绝不回退 Mock。快照 / 锁 / cursor 只在内存（后端状态 + 运行时
//     引用），绝不进 资料持久化、浏览器存储、Cache API 或 Service Worker。
//   · 栅栏 = subject_id + active role(candidate) + session generation + 域读代际，
//     每个请求发送前捕获；任一不匹配的迟到成败只释放本轮锁 —— 不写快照、不派发、
//     不做 401 清理（迟到的 401 绝不能登出新会话）。
//   · 同一 owner 单飞（属主登记 + 过期接管）；已 成功 的快照在刷新/追加途中保留旧
//     items 不降级，失败只落错误，绝不提交半页。
//   · 续页只能消费当前成功快照的 next_cursor：请求前登记，重复消费零请求；服务端
//     返回与请求相同的不前进 cursor、页内与已载窗口重叠、invalid_cursor 或坏页均按
//     invalid_response 整次失败，旧成功窗口原样保留。
//   · 当前轮 401 统一 清账号状态 + 本域摊平；非 401 只写闭合中文错误态。

import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type { 接触事件页 } from '../../数据/招聘数据源/接触记录';
import { 清账号状态 } from './会话操作';
import type {
  接触记录快照,
  接触记录状态,
  接触记录运行时引用,
  接触记录操作,
  后端操作依赖,
  后端状态,
} from './类型';

/** pristine 快照的干净底座：Provider 首帧与全部会话转移口共用同一形状。 */
function 创建空接触记录快照(): 接触记录快照 {
  return {
    ownerSubjectId: null,
    阶段: '未开始',
    刷新中: false,
    items: [],
    nextCursor: null,
    已加载页数: 0,
    error: null,
    generation: 0,
  };
}

/** 接触记录域的可复用空底座（与 创建空P5MatchCase状态 同款 state slice）。 */
export function 创建空接触记录状态(): 接触记录状态 {
  return { 接触记录: 创建空接触记录快照() };
}

/**
 * 引用级清理：域读代际递增（在飞读整包作废）+ 单飞读锁复位 + 已消费 cursor 集清空。
 * 会话转移（登出 / 401 / 换主体 / 切角色）统一走这里；可选成员缺省时（旧依赖桩）
 * 静默跳过，raw 快照仍由 创建空接触记录状态() 的状态摊平兜底。
 */
export function 清接触记录引用(
  deps: Partial<Pick<后端操作依赖, '接触记录代际' | '接触记录读取锁' | '接触记录已消费游标'>>,
): void {
  if (deps.接触记录代际) deps.接触记录代际.current += 1;
  if (deps.接触记录读取锁) deps.接触记录读取锁.current = null;
  deps.接触记录已消费游标?.current.clear();
}

/** Provider 恒注入三个引用；缺引用是接线缺陷，在工厂入口尽早暴露而不是静默错栅栏。 */
function 取接触记录引用(deps: 后端操作依赖): 后端操作依赖 & 接触记录运行时引用 {
  if (!deps.接触记录代际 || !deps.接触记录读取锁 || !deps.接触记录已消费游标) {
    throw new Error('接触记录运行时引用未初始化（Provider 必须一次性注入）');
  }
  return deps as 后端操作依赖 & 接触记录运行时引用;
}

/** 401 统一判据：会话失效一律 清账号状态（与其它域同口径）。 */
function 是401(错误: unknown): boolean {
  return 错误 instanceof BFF错误 && 错误.status === 401;
}

/** 分页异常的闭合判据（不前进 cursor / 窗口重叠 / 坏页）：统一落 invalid_response 文案。 */
function 分页契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', '接触记录分页返回了不前进的游标');
}

/** 每个读取发送前捕获的栅栏：主体 + 当前角色（只认 candidate）+ 会话代际 + 域读代际。 */
interface 接触栅栏 {
  subjectId: string;
  sessionGeneration: number;
  代际: number;
}

export function 创建接触记录操作(deps: 后端操作依赖): 接触记录操作 {
  const { 是后端, 后端, 设后端状态, 后端状态引用, 主体标识引用, 会话代际 } = deps;
  const 引用 = 取接触记录引用(deps);
  const { 接触记录代际, 接触记录读取锁, 接触记录已消费游标 } = 引用;
  // 清账号状态 需要的子集（与其它域同口径；本域引用由 清账号状态 一并随行清理）
  const 账号清理依赖 = {
    派发: deps.派发, 设后端状态, 后端, 主体标识引用, 会话代际,
    接触记录代际, 接触记录读取锁, 接触记录已消费游标,
  };

  /** 401 的统一收口：清账号状态（含本域状态/引用）+ 本域快照再摊平一次（幂等）。 */
  function 清账号与接触记录(): void {
    清账号状态(账号清理依赖);
    设后端状态((旧) => ({ ...旧, ...创建空接触记录状态() }));
    清接触记录引用(引用);
  }

  /** 只认 candidate 的当前主体：换主体 / 离开 candidate 角色时读取一律零请求。 */
  function 当前候选主体(): { subjectId: string; 主体: 后端状态['主体'] } | null {
    const 主体 = 后端状态引用.current.主体;
    if (主体 === null || 主体.last_used_role !== 'candidate') return null;
    return { subjectId: 主体.subject_id, 主体 };
  }

  function 捕获栅栏(subjectId: string): 接触栅栏 {
    return {
      subjectId,
      sessionGeneration: 会话代际.current,
      代际: 接触记录代际.current,
    };
  }

  function 栅栏仍当前(fence: 接触栅栏): boolean {
    const 当前 = 当前候选主体();
    return 当前 !== null &&
      主体标识引用.current === fence.subjectId &&
      会话代际.current === fence.sessionGeneration &&
      接触记录代际.current === fence.代际;
  }

  // ── 同 owner 单飞锁（属主登记 + 过期接管）──
  // ref 类型只存 Promise 身份（plan 冻结），属主坐标挂模块级 WeakMap：
  // 在飞属主与当前主体/会话/代际一致时单飞让路（共享同一把锁）；任一过期即接管重发，
  // 旧属主的 finally 只在 ref 仍指向自己的收口 Promise 时才释放，绝不删新属主的锁。

  interface 读锁属主 {
    subjectId: string;
    sessionGeneration: number;
    代际: number;
  }

  const 读锁属主表 = new WeakMap<Promise<void>, 读锁属主>();

  /** 返回 null 表示让路（共享在飞锁）；否则返回本次收口 Promise（接管旧锁）。 */
  function 获取读锁(属主: 读锁属主): Promise<void> | null {
    const 在飞 = 接触记录读取锁.current;
    const 在飞属主 = 在飞 === null ? undefined : 读锁属主表.get(在飞);
    if (在飞属主 &&
      在飞属主.subjectId === 属主.subjectId &&
      在飞属主.sessionGeneration === 属主.sessionGeneration &&
      在飞属主.代际 === 属主.代际) {
      return 在飞; // 同 owner + 同代际在飞读：单飞让路
    }
    return null;
  }

  function 登记读锁(属主: 读锁属主, 本次: Promise<void>): void {
    读锁属主表.set(本次, 属主);
    接触记录读取锁.current = 本次;
  }

  // ── 快照落位的小工具 ──

  function 写快照(构造: (旧: 接触记录快照) => 接触记录快照): void {
    设后端状态((旧态) => ({ ...旧态, 接触记录: 构造(旧态.接触记录) }));
  }

  /** 读取统一核（首载/force 刷新 = 窗口重建；追加 = 向后一页）：完整成功后原子提交。 */
  async function 运行读取(input: {
    模式: '窗口' | '追加';
    subjectId: string;
    fence: 接触栅栏;
  }): Promise<void> {
    const { fence } = input;
    const 旧 = 后端状态引用.current.接触记录;
    const 同owner旧成功 = 旧.阶段 === '成功' && 旧.ownerSubjectId === fence.subjectId;
    try {
      if (!后端) return;
      const 请求游标 = input.模式 === '追加' ? 旧.nextCursor : null;
      if (input.模式 === '追加') {
        if (!同owner旧成功 || 请求游标 === null) return; // 游标已尽 / owner 不匹配：零请求
        // 请求前验证 cursor 尚未消费并立即登记：重复消费零请求，只落分页错误
        if (接触记录已消费游标.current.has(请求游标)) {
          写快照((快照) => ({
            ...快照,
            刷新中: false,
            error: 取后端错误文案(new BFF错误(0, 'invalid_request', '分页游标已被消费，请刷新后重试')),
          }));
          return;
        }
        接触记录已消费游标.current.add(请求游标);
      }
      // 起步：已有同 owner 成功窗口在途中原样保留（不降级、不半页）
      写快照(() => (同owner旧成功
        ? { ...旧, 刷新中: true, error: null, generation: fence.代际 }
        : {
          ownerSubjectId: fence.subjectId,
          阶段: '进行中', 刷新中: true,
          items: [], nextCursor: null, 已加载页数: 0,
          error: null, generation: fence.代际,
        }));
      const 页: 接触事件页 = input.模式 === '追加'
        ? await 后端.读取接触事件(请求游标 ?? undefined)
        : await 后端.读取接触事件();
      if (!栅栏仍当前(fence)) return; // 迟到成功只释放锁
      if (input.模式 === '追加') {
        // 分页纪律：与请求相同的不前进 cursor、页内与已载窗口重叠都整页拒绝
        if (页.nextCursor === 请求游标 || 页.items.some((项) =>
          旧.items.some((已载) => 已载.eventId === 项.eventId))) {
          写快照((快照) => ({ ...快照, 刷新中: false, error: 取后端错误文案(分页契约错误()) }));
          return;
        }
        写快照(() => ({
          ...旧,
          阶段: '成功', 刷新中: false,
          items: [...旧.items, ...页.items],
          nextCursor: 页.nextCursor,
          已加载页数: 旧.已加载页数 + 1,
          error: null, generation: fence.代际,
        }));
        return;
      }
      // 首载 / force 刷新：完整成功页原子替换
      写快照(() => ({
        ownerSubjectId: fence.subjectId,
        阶段: '成功', 刷新中: false,
        items: 页.items,
        nextCursor: 页.nextCursor,
        已加载页数: 1,
        error: null, generation: fence.代际,
      }));
    } catch (错误) {
      if (!栅栏仍当前(fence)) return; // 迟到失败只释放锁；迟到 401 绝不清新会话
      if (是401(错误)) {
        清账号与接触记录();
        return;
      }
      // 同 owner 旧成功窗口保留，其余按失败空记录收口
      写快照(() => (同owner旧成功
        ? { ...旧, 刷新中: false, error: 取后端错误文案(错误), generation: fence.代际 }
        : {
          ownerSubjectId: fence.subjectId,
          阶段: '失败', 刷新中: false,
          items: [], nextCursor: null, 已加载页数: 0,
          error: 取后端错误文案(错误), generation: fence.代际,
        }));
    }
  }

  /** 读锁包装：单飞让路共享在飞锁；否则登记新属主并接管，finally 只释放自己的锁。 */
  function 单飞读取(input: { 模式: '窗口' | '追加'; subjectId: string }): Promise<void> {
    const fence = 捕获栅栏(input.subjectId);
    const 属主: 读锁属主 = {
      subjectId: fence.subjectId,
      sessionGeneration: fence.sessionGeneration,
      代际: fence.代际,
    };
    const 让路 = 获取读锁(属主);
    if (让路 !== null) return 让路;
    const 收口 = 运行读取({ ...input, fence }).finally(() => {
      if (接触记录读取锁.current === 收口) 接触记录读取锁.current = null;
    });
    登记读锁(属主, 收口);
    return 收口;
  }

  return {
    async 加载接触记录(force) {
      if (!是后端 || !后端) return;
      const 当前 = 当前候选主体();
      if (当前 === null) return;
      const 旧 = 后端状态引用.current.接触记录;
      // 缓存短路只认当前 owner 的成功快照：同角色换主体必须重读
      if (force !== true && 旧.阶段 === '成功' &&
        旧.ownerSubjectId === 当前.subjectId) return;
      if (force === true) {
        // force 先递增域读代际（接管过期锁、作废在飞读），第一页重建前清空已消费 cursor 集
        接触记录代际.current += 1;
        接触记录已消费游标.current.clear();
      }
      await 单飞读取({ 模式: '窗口', subjectId: 当前.subjectId });
    },

    async 追加接触记录() {
      if (!是后端 || !后端) return;
      const 当前 = 当前候选主体();
      if (当前 === null) return;
      const 旧 = 后端状态引用.current.接触记录;
      if (旧.阶段 !== '成功' || 旧.ownerSubjectId !== 当前.subjectId) return;
      await 单飞读取({ 模式: '追加', subjectId: 当前.subjectId });
    },
  };
}