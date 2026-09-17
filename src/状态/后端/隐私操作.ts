// 后端隐私域操作：自身隐私快照的读写 / 组织屏蔽与解除。
// P3 Task 2：从 Provider deps 组合出页面调用的方法；2026-09-13 合同 A/B：隐私域搜索代理
// （搜索可屏蔽组织）删除 —— 目录查询一律走 组织操作 的 搜索组织/创建组织（合同 A），
// 不留重复实现。
// 铁律：无乐观写 —— 服务端成功（或一次 GET 确认真实效果）先于任何本地提交；
// 冲突 / 已屏蔽 / 风控确认按 BFF code 分派恢复（409 version_conflict、
// 409 organization_already_blocked、422 risk_acknowledgement_required）：
// 各自重读权威视图并提交，然后原样抛出，绝不重放变更；
// 解除 404 以权威视图为准 —— 已不含该组织才算解除成功；
// 只有变更 status 0（网络错误）/ 503（结果未知）才允许一次 GET 校验效果是否达成；
// 任一方法 401 走统一 清账号状态。接口失败绝不回退 Mock。

import { BFF错误 } from '../../数据/HTTP客户端';
import type {
  BFF披露档,
  BFF披露偏好,
  BFF屏蔽来源,
  BFF隐私快照,
} from '../../数据/BFF契约';
import type { 页面隐私快照 } from '../../数据/招聘数据源类型';
import { 从BFF隐私, 披露档到BFF, 披露编号到BFF, 屏蔽来源到BFF } from '../../数据/隐私映射';
import { 清账号状态 } from './会话操作';
import type { 后端操作依赖, 隐私操作 } from './类型';

/** 每次变更携带的效果目标：歧义恢复时用它在权威视图里逐字段核对「是否真的达成」。 */
type 隐私变更效果 =
  | { kind: 'employer'; enabled: boolean }
  | { kind: 'disclosure'; field: keyof BFF披露偏好; value: BFF披露档 }
  | { kind: 'block'; id: string; source: BFF屏蔽来源 }
  | { kind: 'unblock'; id: string };

/** 回执只带一行 + revision；隐私尚未水合成功时的中性兜底，绝不用 Mock 数据充当基线。 */
const 空白隐私快照: BFF隐私快照 = {
  employer_privacy_enabled: false,
  disclosure_preferences: { current_employer: 'never', education: 'never', portfolio_links: 'never' },
  organization_blocks: [],
  revision: 0,
};

/** 一个 helper 同时更新 React 渲染镜像与页面 reducer：保持两者来自同一份服务端响应。
 *  Task 5（顺序屏蔽链）：只 setState 时 ref 要等下一次 React 提交才更新 —— 同一 tick 内
 *  连续的第二笔写会从 ref 读到旧 revision 被 BFF 409。最小修法：本次权威快照先同步写进
 *  ref 再派发；下一帧渲染的 ref 赋值与本功能式更新收敛到同一份状态，不引入批处理协议。 */
function 提交隐私快照(deps: 后端操作依赖, 快照: 页面隐私快照): void {
  deps.后端状态引用.current = { ...deps.后端状态引用.current, 隐私快照: 快照.服务端 };
  deps.设后端状态((旧) => ({ ...旧, 隐私快照: 快照.服务端 }));
  deps.派发({ 型: '水合后端隐私', 快照 });
}

export function 创建隐私操作(deps: 后端操作依赖): 隐私操作 {
  const { 是后端, 后端, 设后端状态, 后端状态引用, 锁, 主体标识引用, 会话代际 } = deps;
  // 清账号状态 需要的子集（与会话域共用口径：含 派发，见下）。P4 Task 3 fix：
  // 三个 P4 引用随行 —— 隐私 401 的统一清理同样要清 discovery 双 Map 与可见范围。
  const 账号清理依赖 = {
    派发: deps.派发, 设后端状态, 后端, 主体标识引用, 会话代际,
    P4范围代际: deps.P4范围代际, P4幂等意图: deps.P4幂等意图, P4可见范围: deps.P4可见范围,
    候选预填代际: deps.候选预填代际, 候选预填读取锁: deps.候选预填读取锁, 候选预填恢复: deps.候选预填恢复,
  };

  /** 当前 CAS 基线 revision：读 Provider 的渲染镜像 ref（水合成功后必非 null）。 */
  function 当前修订(): number {
    return 后端状态引用.current.隐私快照?.revision ?? 0;
  }

  /** review-r1：隐私快照提交栅栏（单调代际 + 主体/会话栅栏）。
   *  读取发起时登记代际；写操作开始时（加锁执行）使更早在飞的读取作废；
   *  回包只有代际仍是最新且主体/会话未变才提交，否则按「未采用」返回 null。
   *  换账号后的迟到回执（含 401）同样不落新会话——清账号只对仍有效的会话执行。 */
  const 快照代际 = { 当前: 0 };
  async function 栅栏化读取(吞错误: boolean): Promise<页面隐私快照 | null> {
    const 主体 = 主体标识引用.current;
    const 代 = 会话代际.current;
    const 本代 = ++快照代际.当前;
    const 仍有效 = () => 主体标识引用.current === 主体 && 会话代际.current === 代;
    try {
      const 权威 = await 后端!.读取隐私();
      if (快照代际.当前 !== 本代 || !仍有效()) return null;
      提交隐私快照(deps, 权威);
      return 权威;
    } catch (错误) {
      // 完整新鲜度 = 代际未被超越 + 主体/会话未变；只求值一次（清账号 会改写主体引用）
      const 有效 = 快照代际.当前 === 本代 && 仍有效();
      if (有效 && 错误 instanceof BFF错误 && 错误.status === 401) {
        清账号状态(账号清理依赖);
        // 重读隐私 直抛 401；安全重读权威 保持 null —— 重读失败不得顶替原始写错误
        if (!吞错误) throw 错误;
        return null;
      }
      if (!有效 || 吞错误) return null;
      throw 错误;
    }
  }

  /** 重读一次权威隐私视图并提交。重读自身失败不能顶替原始错误，返回 null 让调用方原样抛出；
   *  唯 401 例外——会话在重读途中过期时仍走统一 清账号状态，不把陈旧隐私留在失效登录态里。 */
  async function 安全重读权威(): Promise<页面隐私快照 | null> {
    return 栅栏化读取(true);
  }

  /**
   * 隐私写操作统一错误分派：
   *   非 BFF 错误 → 原样抛出；
   *   401 → 清账号状态（含 清后端隐私），再抛；
   *   version_conflict / organization_already_blocked / risk_acknowledgement_required
   *     （按 code 判断，不按状态码）→ 重读权威视图提交后原样抛出，绝不重放变更；
   *   unblock 404 → 重读提交：权威视图已不含该组织才视为解除成功，否则原样抛出；
   *   status 0 / 503（结果未知）→ 只做一次 GET 核对效果是否达成，未达成原样抛出。
   * 返回即表示「本次调用兑现成功」，抛出即失败 —— 由 finally 的锁释放收口。
   */
  async function 处理隐私写入错误(错误: unknown, 效果: 隐私变更效果): Promise<void> {
    if (!(错误 instanceof BFF错误)) throw 错误;
    if (错误.status === 401) {
      清账号状态(账号清理依赖);
      throw 错误;
    }
    if (
      错误.code === 'version_conflict' ||
      错误.code === 'organization_already_blocked' ||
      错误.code === 'risk_acknowledgement_required'
    ) {
      await 安全重读权威();
      throw 错误;
    }
    if (效果.kind === 'unblock' && 错误.status === 404) {
      const 权威 = await 安全重读权威();
      if (权威 !== null && !权威.服务端.organization_blocks.some((块) => 块.organization_id === 效果.id)) {
        return; // 权威视图已无该组织：他端已解除，视为成功
      }
      throw 错误;
    }
    if (错误.status === 0 || 错误.status === 503) {
      const 最新 = await 安全重读权威();
      if (最新 === null) throw 错误;
      const 服务端 = 最新.服务端;
      const 已达成 =
        效果.kind === 'employer' ? 服务端.employer_privacy_enabled === 效果.enabled :
        效果.kind === 'disclosure' ? 服务端.disclosure_preferences[效果.field] === 效果.value :
        效果.kind === 'block' ? 服务端.organization_blocks.some((块) =>
          块.organization_id === 效果.id && 块.source === 效果.source) :
        !服务端.organization_blocks.some((块) => 块.organization_id === 效果.id);
      if (!已达成) throw 错误;
      return;
    }
    throw 错误;
  }

  /** 并发写锁：同一目标的变更进行中时拒绝重复提交（与会话/岗位域同口径）。 */
  async function 加锁执行(键: string, 执行体: () => Promise<void>): Promise<void> {
    if (锁.current.has(键)) return;
    锁.current.add(键);
    try {
      // review-r1：写一旦开始，一切更早发起的在飞权威读取作废——
      // 其回包早于本写取数，迟归队时不得覆盖写后权威视图。
      快照代际.当前 += 1;
      await 执行体();
    } finally {
      锁.current.delete(键);
    }
  }

  return {
    async 设置雇主隐私(enabled) {
      if (!是后端 || !后端) return;
      await 加锁执行('privacy:patch', async () => {
        try {
          const 快照 = await 后端!.修改隐私({ employer_privacy_enabled: enabled }, 当前修订());
          提交隐私快照(deps, 快照);
        } catch (错误) {
          await 处理隐私写入错误(错误, { kind: 'employer', enabled });
        }
      });
    },

    async 设置披露偏好(id, 档) {
      if (!是后端 || !后端) return;
      const 字段 = 披露编号到BFF(id);
      const 码档 = 披露档到BFF(档);
      await 加锁执行('privacy:patch', async () => {
        try {
          // 只发送这一个披露成员 —— 不带上另外两个字段，更不带任何展示文案
          const 单字段: Partial<BFF披露偏好> = { [字段]: 码档 };
          const 快照 = await 后端!.修改隐私({ disclosure_preferences: 单字段 }, 当前修订());
          提交隐私快照(deps, 快照);
        } catch (错误) {
          await 处理隐私写入错误(错误, { kind: 'disclosure', field: 字段, value: 码档 });
        }
      });
    },

    async 添加组织屏蔽(organizationId, source) {
      if (!是后端 || !后端) return;
      await 加锁执行(`privacy:block:${organizationId}`, async () => {
        try {
          const 回执 = await 后端!.添加组织屏蔽(organizationId, 屏蔽来源到BFF(source), 当前修订());
          // 回执合并按 organization_id upsert：同 ID 替换原行，不追加重复；
          // aggregate 只取回执 privacy_revision，不发明 updated_at。
          const 基线 = 后端状态引用.current.隐私快照 ?? 空白隐私快照;
          const 合成: BFF隐私快照 = {
            ...基线,
            organization_blocks: [
              ...基线.organization_blocks.filter((块) => 块.organization_id !== 回执.organization_block.organization_id),
              回执.organization_block,
            ],
            revision: 回执.privacy_revision,
          };
          提交隐私快照(deps, 从BFF隐私(合成));
        } catch (错误) {
          await 处理隐私写入错误(错误, { kind: 'block', id: organizationId, source: 屏蔽来源到BFF(source) });
        }
      });
    },

    async 解除组织屏蔽(item) {
      const 组织编号 = item.组织编号;
      if (!是后端 || !后端) return;
      await 加锁执行(`privacy:unblock:${组织编号}`, async () => {
        try {
          // 手动加入的屏蔽解除无需风险确认；建档自动屏蔽的解除必须显式确认风险
          const 快照 = await 后端!.解除组织屏蔽(组织编号, item.来源 !== '手动添加', 当前修订());
          提交隐私快照(deps, 快照);
        } catch (错误) {
          await 处理隐私写入错误(错误, { kind: 'unblock', id: 组织编号 });
        }
      });
    },

    /** 契约B：企业屏蔽表单入口的权威重读。幂等读不带写锁（可与在途写并存）；
     *  成功经 提交隐私快照 走既有 水合后端隐私 通道并返回快照；失败原样抛出
     *  （唯 401 走统一 清账号状态），绝不把空快照冒充「无屏蔽」提交。
     *  review-r1：回包过栅栏——被更新的读取/写或换账号作废的迟到回执按 null 收口。 */
    async 重读隐私() {
      if (!是后端 || !后端) return null;
      return 栅栏化读取(false);
    },
  };
}
