// 后端候选实名域操作：候选 me/identity-verification 的 owner summary 内存态快照、
// 单飞读取、create/cancel 各自单飞的 mutation 与权威重读对账。铁律（FE-IV-01 spec §6）：
//   · Backend + 已登录 candidate 才发请求；Mock / 无后端 / 非 candidate 一律零实名
//     请求（mutation 返回 已换代），接口失败绝不回退 Mock。快照 / 锁 / 待定 key 只在
//     内存，绝不进 资料持久化、浏览器存储或任何日志。
//   · 栅栏 = subject_id + last_used_role(candidate) + 会话代际，每个请求发送前捕获；
//     任一不匹配的迟到成败只释放本轮锁 —— 不写快照、不派发、不做 401 清理
//     （迟到的 401 绝不能登出新会话），mutation 返回 已换代。
//   · summary GET 同域单飞；finally 只在引用仍指向本次 Promise 时释放锁，防止旧请求
//     释放新锁。已有成功摘要的刷新途中保持 阶段=成功、摘要=旧值、刷新中=true。
//   · create 待定意图只保存一把 16–128 可见 ASCII 的幂等 key（crypto.randomUUID 铸造），
//     不保存姓名、证件类型、文件名或 File；未编辑表单的失败重试复用同 key，
//     页面编辑或卸载显式 重置候选实名提交意图 后才铸新键。create 成功清 key。
//   · mutation 一律服务端先行，成功响应直接提交；create 409 / cancel 404·409·503
//     先权威 GET 对账：对账撞上在飞 GET 时等它结算（吞掉 rejection、不采用结果），
//     重新检查栅栏后另发一笔新 GET，绝不重放 mutation，重读失败不宣称成功。
//   · 当前轮 401 统一 清账号状态（本域状态/引用随行清理）。GET 失败文案统一冻结为
//     安全的「请求失败，请稍后再试」；mutation 失败一律原样抛给页面按闭合映射渲染。

import { BFF错误 } from '../../数据/HTTP客户端';
import type { 候选实名摘要 } from '../../数据/招聘数据源/候选实名';
import { 清账号状态 } from './会话操作';
import type {
  候选实名快照,
  候选实名操作,
  候选实名运行时引用,
  后端操作依赖,
  后端状态,
} from './类型';

/** pristine 快照的干净底座：Provider 首帧与全部会话转移口共用同一形状。 */
export function 创建空候选实名快照(): 候选实名快照 {
  return { 阶段: '未开始', 摘要: null, 刷新中: false, 错误: null };
}

/**
 * 候选实名快照的唯一读取口：后端状态.候选实名 在共享类型上是可选字段（兼容聚焦
 * 其它域的既有测试桩），Provider 恒播种；可选绝不表示运行时存在第二种默认形状，
 * 页面与 operation 统一走本回退，不得自行构造默认值。
 */
export function 取候选实名快照(state: 后端状态): 候选实名快照 {
  return state.候选实名 ?? 创建空候选实名快照();
}

/**
 * 引用级清理：GET 单飞读锁复位 + create/cancel 两把 mutation 锁清空 + 待定 key 清除。
 * 会话转移（登出 / 401 / 换主体 / 切角色）统一走这里；可选成员缺省时（旧依赖桩）
 * 静默跳过，快照仍由 清账号状态 的状态摊平兜底。
 */
export function 清候选实名引用(
  deps: Pick<后端操作依赖, '候选实名读取锁' | '候选实名变更锁' | '候选实名提交意图'>,
): void {
  if (deps.候选实名读取锁) deps.候选实名读取锁.current = null;
  deps.候选实名变更锁?.current.clear();
  if (deps.候选实名提交意图) deps.候选实名提交意图.current = null;
}

/** Provider 恒注入三个引用；缺引用是接线缺陷，在工厂入口尽早暴露而不是静默错栅栏。 */
function 取候选实名引用(deps: 后端操作依赖): 后端操作依赖 & 候选实名运行时引用 {
  if (!deps.候选实名读取锁 || !deps.候选实名变更锁 || !deps.候选实名提交意图) {
    throw new Error('候选实名运行时引用未初始化（Provider 必须一次性注入）');
  }
  return deps as 后端操作依赖 & 候选实名运行时引用;
}

/** 401 统一判据：会话失效一律 清账号状态（与其它域同口径）。 */
function 是401(错误: unknown): boolean {
  return 错误 instanceof BFF错误 && 错误.status === 401;
}

/** mutation 结果不确定判据：这些失败需要权威 GET 对账（spec §6.4），其余原样抛。 */
function 是结果不确定(错误: BFF错误): boolean {
  return 错误.status === 404 || 错误.status === 409 || 错误.status === 503;
}

/** 每个请求发送前捕获的栅栏：主体 + 当前角色（只认 candidate）+ 会话代际。 */
interface 候选实名栅栏 {
  subjectId: string;
  sessionGeneration: number;
}

/** 对账强制重读的内部结果：committed=false 表示未提交（栅栏过时 / 读取失败 / 401 清账号）。 */
interface 重读结果 {
  committed: boolean;
  summary: 候选实名摘要 | null;
}

export function 创建候选实名操作(deps: 后端操作依赖): 候选实名操作 {
  const { 是后端, 后端, 设后端状态, 后端状态引用, 主体标识引用, 会话代际 } = deps;
  const 引用 = 取候选实名引用(deps);
  const { 候选实名读取锁, 候选实名变更锁, 候选实名提交意图 } = 引用;
  // 清账号状态 需要的子集（与其它域同口径；本域状态/引用由 清账号状态 一并随行清理）
  const 账号清理依赖 = {
    派发: deps.派发, 设后端状态, 后端, 主体标识引用, 会话代际,
    候选实名读取锁, 候选实名变更锁, 候选实名提交意图,
  };

  function 写快照(构造: (旧: 候选实名快照) => 候选实名快照): void {
    设后端状态((旧态) => ({ ...旧态, 候选实名: 构造(取候选实名快照(旧态)) }));
  }

  /** 401 的统一收口：清账号状态（含本域状态/引用）+ 本域快照再摊平一次（幂等双保险）。 */
  function 清账号与候选实名(): void {
    清账号状态(账号清理依赖);
    设后端状态((旧) => ({ ...旧, 候选实名: 创建空候选实名快照() }));
    清候选实名引用(引用);
  }

  /** 只认 candidate 的当前主体：换主体 / 离开 candidate 角色时读写一律零请求。 */
  function 当前候选主体(): string | null {
    const 主体 = 后端状态引用.current.主体;
    if (主体 === null || 主体.last_used_role !== 'candidate') return null;
    return 主体.subject_id;
  }

  function 捕获栅栏(subjectId: string): 候选实名栅栏 {
    return { subjectId, sessionGeneration: 会话代际.current };
  }

  function 栅栏仍当前(fence: 候选实名栅栏): boolean {
    return 当前候选主体() !== null &&
      主体标识引用.current === fence.subjectId &&
      会话代际.current === fence.sessionGeneration;
  }

  /** 读取统一核：起步保留同 owner 旧成功摘要（不降级），完整成功后原子提交。 */
  async function 运行读取(fence: 候选实名栅栏): Promise<重读结果> {
    const 旧 = 取候选实名快照(后端状态引用.current);
    const 有成功摘要 = 旧.阶段 === '成功' && 旧.摘要 !== null;
    try {
      if (!后端) return { committed: false, summary: null };
      写快照(() => (有成功摘要
        ? { ...旧, 刷新中: true, 错误: null }
        : { 阶段: '进行中', 摘要: null, 刷新中: true, 错误: null }));
      const summary = await 后端.读取候选实名();
      if (!栅栏仍当前(fence)) return { committed: false, summary: null }; // 迟到成功只释放锁
      写快照(() => ({ 阶段: '成功', 摘要: summary, 刷新中: false, 错误: null }));
      return { committed: true, summary };
    } catch (错误) {
      if (!栅栏仍当前(fence)) return { committed: false, summary: null }; // 迟到失败只释放锁
      if (是401(错误)) {
        清账号与候选实名();
        return { committed: false, summary: null };
      }
      // GET 失败文案冻结为安全通用文案；mutation 失败文案一律由页面渲染，不进快照
      写快照(() => (有成功摘要
        ? { ...旧, 刷新中: false, 错误: '请求失败，请稍后再试' }
        : { 阶段: '失败', 摘要: null, 刷新中: false, 错误: '请求失败，请稍后再试' }));
      return { committed: false, summary: null };
    }
  }

  /**
   * 新起一笔读取并登记单飞锁；finally 只在引用仍指向本次 Promise 时释放，
   * 防止旧请求释放新锁。锁 ref 只存 Promise 身份（类型为 Promise<void>），
   * { committed, summary } 核心结果直接返回给调用方。
   */
  function 新起读取(fence: 候选实名栅栏): Promise<重读结果> {
    const 核 = 运行读取(fence);
    const 入锁 = 核 as unknown as Promise<void>;
    候选实名读取锁.current = 入锁;
    void 核.finally(() => {
      if (候选实名读取锁.current === 入锁) 候选实名读取锁.current = null;
    });
    return 核;
  }

  /**
   * mutation 对账的强制重读：不得直接清空锁并并发第二笔读取（旧响应可能晚于新响应
   * 提交）。若已有 GET 在飞，先 await 旧读结算 —— 旧读的成功与失败都不作为对账
   * 证据（reject 必须吞掉），结算后重新检查 mutation 栅栏，再另发一笔新 GET。
   */
  async function 对账重读(fence: 候选实名栅栏): Promise<重读结果> {
    const 在飞 = 候选实名读取锁.current;
    if (在飞 !== null) {
      await 在飞.catch(() => undefined);
      if (!栅栏仍当前(fence)) return { committed: false, summary: null };
    }
    return 新起读取(fence);
  }

  return {
    async 加载候选实名(force) {
      if (!是后端 || !后端) return;
      const subjectId = 当前候选主体();
      if (subjectId === null) return;
      const 旧 = 取候选实名快照(后端状态引用.current);
      // 缓存短路只认成功摘要：失败/未开始照常重读
      if (force !== true && 旧.阶段 === '成功') return;
      const fence = 捕获栅栏(subjectId);
      // 同域单飞：已有读取在飞时让路共享，不再发第二笔
      const 在飞 = 候选实名读取锁.current;
      if (在飞 !== null) {
        await 在飞;
        return;
      }
      await 新起读取(fence);
    },

    async 提交候选实名(input) {
      if (!是后端 || !后端) return '已换代';
      const subjectId = 当前候选主体();
      if (subjectId === null) return '已换代';
      if (候选实名变更锁.current.has('create')) return '已换代'; // 重复点击只发一笔
      const fence = 捕获栅栏(subjectId);
      候选实名变更锁.current.add('create');
      try {
        // 同一意图沿用既有键；只有无键时才铸造（16–128 可见 ASCII 由 UUID 天然满足）
        const key = 候选实名提交意图.current ?? globalThis.crypto.randomUUID();
        候选实名提交意图.current = key;
        const summary = await 后端.创建候选实名申请(input, key);
        if (!栅栏仍当前(fence)) return '已换代';
        写快照(() => ({ 阶段: '成功', 摘要: summary, 刷新中: false, 错误: null }));
        候选实名提交意图.current = null; // 成功 create 清 key
        return '已提交';
      } catch (错误) {
        if (!栅栏仍当前(fence)) return '已换代';
        if (是401(错误)) {
          清账号与候选实名();
          throw 错误;
        }
        if (错误 instanceof BFF错误 && 错误.code === 'version_conflict') {
          // create 409：权威重读后仅在不可再提交（pending/verified）时按新状态收口
          const 对账 = await 对账重读(fence);
          if (对账.committed && 对账.summary !== null &&
            (对账.summary.status === 'pending' || 对账.summary.status === 'verified')) {
            return '状态已更新';
          }
          throw 错误; // 仍可创建（unverified/rejected）或重读失败：原样抛原冲突，key 保留
        }
        // operation_outcome_unknown / network_error / 其它失败：保留 key 原样抛，不自动重放
        throw 错误;
      } finally {
        候选实名变更锁.current.delete('create');
      }
    },

    async 取消候选实名() {
      if (!是后端 || !后端) return '已换代';
      const subjectId = 当前候选主体();
      if (subjectId === null) return '已换代';
      if (候选实名变更锁.current.has('cancel')) return '已换代'; // 重复点击只发一笔
      // 起飞前检查：无成功摘要或当前申请已不是 pending 时零 mutation 请求
      const 快照 = 取候选实名快照(后端状态引用.current);
      const 原 = 快照.阶段 === '成功' ? 快照.摘要 : null;
      if (原 === null || 原.currentRequest === null || 原.currentRequest.status !== 'pending') {
        return '状态已更新';
      }
      const fence = 捕获栅栏(subjectId);
      候选实名变更锁.current.add('cancel');
      try {
        // If-Match 用 summary 顶层 revision（spec §5），不用嵌套 request revision
        const summary = await 后端.取消候选实名申请(原.currentRequest.requestId, 原.revision);
        if (!栅栏仍当前(fence)) return '已换代';
        写快照(() => ({ 阶段: '成功', 摘要: summary, 刷新中: false, 错误: null }));
        return '已取消';
      } catch (错误) {
        if (!栅栏仍当前(fence)) return '已换代';
        if (是401(错误)) {
          清账号与候选实名();
          throw 错误;
        }
        if (错误 instanceof BFF错误 && 是结果不确定(错误)) {
          // 404 / 409 / 503：权威重读对账 —— 原 pending 是否变化要同时比较
          // requestId、status==='pending' 与顶层 revision，不能只看 status
          const 对账 = await 对账重读(fence);
          const 新 = 对账.committed ? 对账.summary : null;
          const 仍是原pending = 新 !== null &&
            新.currentRequest !== null &&
            新.currentRequest.requestId === 原.currentRequest.requestId &&
            新.currentRequest.status === 'pending' &&
            新.revision === 原.revision;
          if (!仍是原pending && 新 !== null) return '状态已更新';
          throw 错误; // 仍是原 pending 或重读失败：原样抛原错误，绝不自动重放
        }
        throw 错误;
      } finally {
        候选实名变更锁.current.delete('cancel');
      }
    },

    重置候选实名提交意图() {
      候选实名提交意图.current = null;
    },
  };
}
