// 后端 Agent 规则 / 提案域操作（P6）：完整角色水合 + 八个页面操作方法。
// 铁律（设计 §6/§8）：任何 mutation 都不做乐观 Rule 追加；失败恢复一律重读权威资源，
// 绝不自动重放 mutation；接口失败绝不回退 Mock。
//   · 水合 = Rules + interpreting Proposals + ready Proposals 三路独立 allSettled；
//     两阶段 未开始|进行中|成功|失败 各自推进，「进行中」只允许从 未开始|失败 起跑，
//     已 成功 的域在刷新途中不得降级（rows/cards/count 不闪退）。
//   · 会话 fence（subject + generation）与 P3 共用：过时响应整包丢弃（含快照与阶段）。
//   · 每个 Proposal 另有 per-ID 提案代际：轮询/读捕获当前值，接受/放弃发送前自增，
//     让迟到的旧 GET 不能用过期的 interpreting 回执盖掉终端结果。
//   · 完整刷新（手动 + accept/回执 follow-up）统一过 per-role 串行队列：整表提交是
//     last-writer-wins、没有先后栅栏，排队保证后一轮的读在前一轮整轮提交完才起跑 ——
//     「读先起跑、更晚提交」的旧轮次再也不可能复活刚 accepted 收口的卡片。
//   · 键位（冻结）：Agent规则:new:<role> / Agent规则:<rule_id> / Agent提案:<proposal_id> /
//     Agent规则水合:<role>。刷新Agent规则提案 是权威 GET，绝不获取 Agent提案 写锁 ——
//     否则 accept/dismiss 的恢复路径会被自己的锁静默短路。
// 401 统一走 清账号状态。Mock 分支只派发现有同步动作，create/replacement 返回合成空串
// （Mock 页面立即关闭，从不轮询提案卡），accept/dismiss 在 Mock 下是 no-op。

import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type { BFFAgent规则, BFFAgent规则提案, BFFAgent规则作用域, BFF角色 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { 映射候选Agent规则, 映射招聘Agent规则 } from '../../数据/Agent规则映射';
import type { 后端状态, 后端操作依赖, 可变引用, Agent规则操作, Agent规则水合阶段, Agent规则角色水合状态 } from './类型';
import { 清账号状态 } from './会话操作';
import { 轻提示 } from '../../组件/轻提示';

/** 与 组织水合依赖 同构的子集：session 层与刷新都共用这一把 deps 形状。 */
export type Agent规则水合依赖 = Pick<后端操作依赖,
  '后端' | '派发' | '设后端状态' | '主体标识引用' | '会话代际'> &
  { 后端: HTTP招聘数据源 };

/** 只带会话 fence 引用的最小形状（内部 helpers 用）。 */
interface 会话Fence依赖 {
  主体标识引用: 可变引用<string | null>;
  会话代际: 可变引用<number>;
}

type 水合域 = 'rules' | 'proposals';

function 当前角色(state: 后端状态): BFF角色 | null {
  return state.主体?.last_used_role ?? null;
}

function 仍是当前会话(deps: 会话Fence依赖, subjectId: string, generation: number): boolean {
  return deps.主体标识引用.current === subjectId && deps.会话代际.current === generation;
}

function 转表<T extends { rule_id: string }>(items: T[]): Record<string, T> {
  const 表: Record<string, T> = {};
  for (const 条 of items) 表[条.rule_id] = 条;
  return 表;
}

function 转提案表(items: BFFAgent规则提案[]): Record<string, BFFAgent规则提案> {
  const 表: Record<string, BFFAgent规则提案> = {};
  for (const 条 of items) 表[条.proposal_id] = 条;
  return 表;
}

const 空水合状态: Agent规则角色水合状态 = { rules: '未开始', proposals: '未开始' };

/**
 * 冻结的 P6 中文文案只覆盖七个命名服务错误，其余一律回落通用映射；
 * BFF 的固定英文 error.message 不允许直接出现在 P6 页面上。
 */
export function 取Agent规则错误文案(error: unknown): string {
  if (error instanceof BFF错误) {
    switch (error.code) {
      case 'agent_rule_proposal_not_ready':
        return 'AI代理还在理解这条规则，请稍后再试';
      case 'agent_rule_proposal_not_actionable':
        return '这条内容暂时不能成为长期规则，请放弃或换一种说法';
      case 'agent_rule_proposal_terminal':
        return '这条规则提案已经处理，请查看最新状态';
      case 'idempotency_conflict':
        return '这次操作与之前的请求冲突，请检查最新状态后重试';
      case 'agent_rule_scope_denied':
        return '这个意向已不可用，请重新选择规则范围';
      case 'agent_rule_not_found':
        return '这条规则已不存在，请查看最新状态';
      case 'agent_rule_proposal_not_found':
        return '这条规则提案已不存在，请查看最新状态';
    }
  }
  return 取后端错误文案(error);
}

// ── 水合阶段机 ──────────────────────────────────────────────────

/** 「进行中」只从 未开始|失败 推进；已 成功 的域保持不动（§6 刷新不得降级）。 */
function 推进阶段(旧: 后端状态, role: BFF角色): 后端状态['Agent规则水合'] {
  const 现状 = 旧.Agent规则水合[role] ?? 空水合状态;
  const 下一 = (阶段: Agent规则水合阶段): Agent规则水合阶段 =>
    阶段 === '未开始' || 阶段 === '失败' ? '进行中' : 阶段;
  return {
    ...旧.Agent规则水合,
    [role]: { rules: 下一(现状.rules), proposals: 下一(现状.proposals) },
  };
}

/** 结算：fulfilled → 成功；rejected 时只有原本不是 成功 的域才落到 失败（残留 进行中 一并收口）。 */
function 收束阶段(旧: 后端状态, role: BFF角色, 域: 水合域, 拒绝: boolean): 后端状态['Agent规则水合'] {
  const 现状 = 旧.Agent规则水合[role] ?? 空水合状态;
  const 目标: Agent规则水合阶段 =
    拒绝 && 现状[域] !== '成功' ? '失败' : '成功';
  return { ...旧.Agent规则水合, [role]: { ...现状, [域]: 目标 } };
}

async function 落定<T>(承诺: Promise<T>): Promise<PromiseSettledResult<T>> {
  try {
    return { status: 'fulfilled', value: await 承诺 };
  } catch (reason) {
    return { status: 'rejected', reason };
  }
}

/** 401 统一判据：恢复读 / 结算扫描共用这一把（会话失效一律 清账号状态，不只 轻提示）。 */
function 是401原因(原因: unknown): boolean {
  return 原因 instanceof BFF错误 && 原因.status === 401;
}

function 是401落败(结果: PromiseSettledResult<unknown>): boolean {
  return 结果.status === 'rejected' && 是401原因(结果.reason);
}

/**
 * 完整角色水合核：Rules、interpreting、ready 三路并发读，各自 fence 后提交：
 *   Rules fulfilled → 整表替换 raw 快照 + rules 成功；
 *   两份清单都 fulfilled → 合并 actionable 提案表（整体替换）+ proposals 成功；
 *   任一 rejected → 对应域落 失败（除非已 成功）；全部结算后本轮不留 未开始|进行中。
 * 返回三路 settled 结果给 session 层做统一 401 扫描。这里只提交 raw snapshot，
 * 页面数组由 Provider 的派生 effect 从 raw state 重算（Rule 与意向请求完成顺序互不约束）。
 */
async function 运行角色水合核(
  deps: Agent规则水合依赖,
  role: BFF角色,
  subjectId: string,
  generation: number,
): Promise<PromiseSettledResult<unknown>[]> {
  const { 后端, 设后端状态 } = deps;

  // 起跑即推进阶段（首个 await 之前，fence 必然一致）：只从 未开始|失败 进 行中。
  设后端状态((旧) => ({ ...旧, Agent规则水合: 推进阶段(旧, role) }));

  // 三路并发读同步发出：任一请求慢都不能拖住其它两路的起点（§6 allSettled 组合）。
  const 读规则 = 后端.读取Agent规则(role);
  const 读解读中 = 后端.读取Agent规则提案列表(role, 'interpreting');
  const 读就绪 = 后端.读取Agent规则提案列表(role, 'ready');

  // 落定 即刻挂上拒绝处理器：快 Proposal 读在 Rule 还在飞时拒绝，也不产生 unhandledrejection。
  const 规则落定 = 落定(读规则);
  const 解读中落定 = 落定(读解读中);
  const 就绪落定 = 落定(读就绪);

  const 规则落点 = await 规则落定;
  if (仍是当前会话(deps, subjectId, generation)) {
    if (规则落点.status === 'fulfilled') {
      const 规则们 = 规则落点.value;
      设后端状态((旧) => ({
        ...旧,
        ...(role === 'candidate'
          ? { 候选规则快照: 转表(规则们) }
          : { 招聘规则快照: 转表(规则们) }),
        Agent规则水合: 收束阶段(旧, role, 'rules', false),
      }));
    } else {
      设后端状态((旧) => ({ ...旧, Agent规则水合: 收束阶段(旧, role, 'rules', true) }));
    }
  }

  const 解读落点 = await 解读中落定;
  const 就绪落点 = await 就绪落定;
  if (仍是当前会话(deps, subjectId, generation)) {
    if (解读落点.status === 'fulfilled' && 就绪落点.status === 'fulfilled') {
      // ready 后到：同 ID 冲突时以就绪视图为准（interpreting 是无正文的早期形状）
      const 合并表 = { ...转提案表(解读落点.value), ...转提案表(就绪落点.value) };
      设后端状态((旧) => ({
        ...旧,
        ...(role === 'candidate'
          ? { 候选规则提案: 合并表 }
          : { 招聘规则提案: 合并表 }),
        Agent规则水合: 收束阶段(旧, role, 'proposals', false),
      }));
    } else {
      设后端状态((旧) => ({ ...旧, Agent规则水合: 收束阶段(旧, role, 'proposals', true) }));
    }
  }

  return [规则落点, 解读落点, 就绪落点];
}

/**
 * Session 层入口（登录 / mount / 切身份调用）。页面数组的显示由 Provider effect 负责，
 * 这里只交 raw snapshot + 两个水合阶段。
 */
export function 水合Agent规则角色数据(
  deps: Agent规则水合依赖,
  role: BFF角色,
  subjectId: string,
  generation: number,
): Promise<PromiseSettledResult<unknown>[]> {
  return 运行角色水合核(deps, role, subjectId, generation);
}

export function 创建Agent规则操作(deps: 后端操作依赖): Agent规则操作 {
  const { 是后端, 后端, 派发, 设后端状态, 后端状态引用, 状态引用, 锁, 主体标识引用, 会话代际 } = deps;
  const 账号清理依赖 = { 派发, 设后端状态, 后端, 主体标识引用, 会话代际 };

  /** per-Proposal 代际：轮询捕获当前值，接受/放弃与其恢复 GET 发送前各自增一次。 */
  const 提案代际 = new Map<string, number>();

  /** per-role 完整水合串行队列：整轮提交顺序恒等于排队顺序（见 串行完整水合并发布）。 */
  const 完整水合队列 = new Map<BFF角色, Promise<unknown>>();

  function 当前提案代际(id: string): number {
    return 提案代际.get(id) ?? 0;
  }

  function 推进提案代际(id: string): number {
    const next = 当前提案代际(id) + 1;
    提案代际.set(id, next);
    return next;
  }

  function 提案响应仍新鲜(id: string, captured: number): boolean {
    return 当前提案代际(id) === captured;
  }

  /** 当前会话的水合 deps 子集（闭包里 后端 已由调用处早退保证非空）。 */
  function 取水合依赖(): Agent规则水合依赖 {
    return { 后端: 后端!, 派发, 设后端状态, 主体标识引用, 会话代际 };
  }

  /**
   * 权威规则落地后立刻把页面数组一并投影（分组用「此刻」的权威意向字典）——
   * 即使此刻意向还没到导致 orphan 省略，Provider effect 会在 后端意向服务端
   * 变化时重算纠回，所以先行投递只负责让 rows 尽快可见，永不锁定错误的分组。
   */
  function 发布规则投影(规则们: BFFAgent规则[], role: BFF角色): void {
    if (role === 'candidate') {
      const 投影 = 映射候选Agent规则(规则们, 状态引用.current.后端意向服务端);
      派发({ 型: '水合后端候选规则', 全局: 投影.全局, 意向级: 投影.意向级 });
    } else {
      派发({ 型: '水合后端招聘规则', 规则: 映射招聘Agent规则(规则们) });
    }
  }

  async function 运行完整水合并发布(
    role: BFF角色,
    subjectId: string,
    generation: number,
  ): Promise<PromiseSettledResult<unknown>[]> {
    const 结果 = await 运行角色水合核(取水合依赖(), role, subjectId, generation);
    const 规则落点 = 结果[0];
    if (规则落点.status === 'fulfilled' && 仍是当前会话(deps, subjectId, generation)) {
      发布规则投影(规则落点.value as BFFAgent规则[], role);
    }
    // 所有 follow-up 刷新（accept 成功收口 / 提案读到 accepted / 手动重试）都从这里过：
    // mutation 本体已成功、会话却在读回执途中过期时，必须统一清账号，
    // 不能留下 已登录=true 而两个 P6 阶段停在 失败 的撕裂态。
    // 但 401 要过会话 fence：发送后用户已登出/重登/切身份时，转移路径自己清过账号，
    // 迟到的旧会话 401 绝不能顺手登出新一代（跳过清理即可，错误语义不变）。
    if (结果.some(是401落败) && 仍是当前会话(deps, subjectId, generation)) 清账号状态(账号清理依赖);
    // 非 401 的 follow-up 刷新失败不能无声吞掉：已 成功 的域按 §6 不降级，页面看着正常，
    // 但用户没有任何信号也就没有重试入口 —— 提示第一份非 401 拒绝（401 已在上面统一
    // 清账号，不再重复提示）。首次挂载走 水合Agent规则角色数据，由 会话操作 呈现其拒绝，
    // 不经过这里，不存在双弹。提示同样过会话 fence（review-r3 R3-3）：已换代后迟到的
    // 旧轮拒绝整包丢弃 —— 不提示、不动阶段、不动快照，绝不弹进新会话。
    if (仍是当前会话(deps, subjectId, generation)) {
      for (const 落点 of 结果) {
        if (落点.status === 'rejected' && !是401原因(落点.reason)) {
          轻提示(取Agent规则错误文案(落点.reason));
          break;
        }
      }
    }
    return 结果;
  }

  /**
   * 完整刷新的统一入口（手动刷新与全部 follow-up 都从这里过）：per-role 排队串行。
   * 两个并发完整刷新的整表提交是 last-writer-wins、没有先后栅栏 —— 读先起跑的那轮
   * 可能更晚提交，短暂复活刚 accepted 收口的卡片或藏起刚 materialize 的规则。
   * 排队给出严格先后：后一轮的读在前一轮整轮提交完才起跑，提交顺序 = 排队顺序。
   * 锁序（无死锁）：本队列不等任何锁 —— 水合核从不获取 Agent提案:* 写锁，持有
   * Agent提案:* 的 accept/dismiss follow-up 与持有 Agent规则水合:<role> 的手动刷新
   * 都只是在这里排队等前一轮提交，不构成环。follow-up 一律排队等待而非静默跳过
   * （对账必须完成）；只有排队期间会话已过期的轮次整轮丢弃：不发读、不触发
   * 401 清理，交给新会话自己的水合。
   */
  function 串行完整水合并发布(
    role: BFF角色,
    subjectId: string,
    generation: number,
  ): Promise<PromiseSettledResult<unknown>[]> {
    const 前一轮 = 完整水合队列.get(role) ?? Promise.resolve();
    const 本轮 = 前一轮.then(async () => {
      if (!仍是当前会话(deps, subjectId, generation)) return [];
      return await 运行完整水合并发布(role, subjectId, generation);
    });
    // 队尾吞掉 rejection：一轮的失败只抛给它自己的调用方，绝不拖垮排在其后的轮次
    const 队尾 = 本轮.catch(() => undefined);
    完整水合队列.set(role, 队尾);
    void 队尾.then(() => {
      if (完整水合队列.get(role) === 队尾) 完整水合队列.delete(role);
    });
    return 本轮;
  }

  /** 读整张规则表并原样替换 raw 快照（不带阶段变化；mutation 恢复用）。 */
  function 构建规则对账(
    role: BFF角色,
    subjectId: string,
    generation: number,
  ): () => Promise<void> {
    return async () => {
      const 规则们 = await 后端!.读取Agent规则(role);
      if (!仍是当前会话(deps, subjectId, generation)) return;
      const 表 = 转表(规则们);
      设后端状态((旧) => ({
        ...旧,
        ...(role === 'candidate' ? { 候选规则快照: 表 } : { 招聘规则快照: 表 }),
      }));
      发布规则投影(规则们, role);
    };
  }

  /** 重读两份 actionable 清单并整体替换提案表（create/replacement 与 not-found 恢复用）。 */
  function 构建清单对账(
    role: BFF角色,
    subjectId: string,
    generation: number,
  ): () => Promise<void> {
    return async () => {
      const 解读中 = await 后端!.读取Agent规则提案列表(role, 'interpreting');
      const 就绪 = await 后端!.读取Agent规则提案列表(role, 'ready');
      if (!仍是当前会话(deps, subjectId, generation)) return;
      const 合并表 = { ...转提案表(解读中), ...转提案表(就绪) };
      设后端状态((旧) => ({
        ...旧,
        ...(role === 'candidate' ? { 候选规则提案: 合并表 } : { 招聘规则提案: 合并表 }),
      }));
    };
  }

  /**
   * accept/dismiss 类不确定结果的对账：自增提案代际后 GET 权威回执，
   * 按 terminal state 收口（accepted → 完整刷新；dismissed → 移除；failed/ready/interpreting → 原位写回）。
   */
  function 构建回执对账(
    proposalId: string,
    role: BFF角色,
    subjectId: string,
    generation: number,
  ): () => Promise<void> {
    return async () => {
      const captured = 推进提案代际(proposalId);
      const 落点 = await 落定(后端!.读取Agent规则提案(role, proposalId));
      if (落点.status === 'rejected') {
        // 恢复读自身撞上 401 = 会话在读回执途中失效：与 规则/清单对账 经 收口写入错误
        // 的恢复口径一致，统一登出清理（同样过会话 fence，已换代绝不清新会话）；
        // 原始错误仍由 收口写入错误 抛出，恢复失败永不顶替。
        if (是401原因(落点.reason) && 仍是当前会话(deps, subjectId, generation)) {
          清账号状态(账号清理依赖);
        }
        return; // 恢复读不到就算了，原始错误照抛
      }
      const 回执 = 落点.value;
      if (!仍是当前会话(deps, subjectId, generation) || !提案响应仍新鲜(proposalId, captured)) return;
      if (回执.state === 'accepted') {
        await 串行完整水合并发布(role, subjectId, generation);
        return;
      }
      if (回执.state === 'dismissed') {
        移除提案(proposalId, role);
        return;
      }
      并入单个提案(回执, role);
    };
  }

  function 并入单个提案(回执: BFFAgent规则提案, role: BFF角色): void {
    设后端状态((旧) => ({
      ...旧,
      ...(role === 'candidate'
        ? { 候选规则提案: { ...旧.候选规则提案, [回执.proposal_id]: 回执 } }
        : { 招聘规则提案: { ...旧.招聘规则提案, [回执.proposal_id]: 回执 } }),
    }));
  }

  function 移除提案(proposalId: string, role: BFF角色): void {
    设后端状态((旧) => ({
      ...旧,
      ...(role === 'candidate'
        ? {
            候选规则提案: Object.fromEntries(
              Object.entries(旧.候选规则提案).filter(([编号]) => 编号 !== proposalId),
            ) as Record<string, BFFAgent规则提案>,
          }
        : {
            招聘规则提案: Object.fromEntries(
              Object.entries(旧.招聘规则提案).filter(([编号]) => 编号 !== proposalId),
            ) as Record<string, BFFAgent规则提案>,
          }),
    }));
  }

  /**
   * 命名冲突处理（必须在通用 status 兜底之前）：
   *   scope_denied → candidate 重读权威意向并经捕获 fence 落地，迟到响应整包丢弃；
   *   idempotency_conflict → 有已知 proposal ID 先经 刷新Agent规则提案 提交 addressed 快照，
   *   再跑一轮完整 actionable 重读；冲突本身从不被改写为成功，也不重试原 mutation。
   */
  async function 处理提案冲突(
    错误: BFF错误,
    role: BFF角色,
    subjectId: string,
    generation: number,
    proposalId?: string,
  ): Promise<never> {
    if (错误.code === 'agent_rule_scope_denied' && role === 'candidate') {
      const intentions = await 后端!.读取意向();
      if (!仍是当前会话(deps, subjectId, generation)) throw 错误;
      派发({ 型: '水合后端意向', 快照: intentions });
      设后端状态((旧) => ({ ...旧, 意向快照: intentions.服务端 }));
    }
    if (错误.code === 'idempotency_conflict') {
      if (proposalId !== undefined) await 刷新Agent规则提案(proposalId);
      await 刷新Agent规则();
    }
    throw 错误;
  }

  const 需对账码 = new Set([
    'agent_rule_not_found',
    'agent_rule_proposal_not_found',
    'agent_rule_proposal_not_ready',
    'agent_rule_proposal_not_actionable',
    'agent_rule_proposal_terminal',
  ]);

  /** 不确定或丢失结果的统一判据：命名恢复码 / 409 / 404 / 5xx / 网络。 */
  function 需要对账(error: BFF错误): boolean {
    return 需对账码.has(error.code) ||
      error.status === 409 ||
      error.status === 404 ||
      error.status >= 500 ||
      (error.status === 0 && error.code === 'network_error');
  }

  /**
   * 写操作 catch 统一收口：401 → 清账号状态；命名冲突 → 处理提案冲突（其自身负责抛出）；
   * 其余不确定结果 → 对账一次（对账失败不顶替原始错误），最后永远抛出原始错误。
   */
  async function 收口写入错误(
    错误: unknown,
    role: BFF角色,
    subjectId: string,
    generation: number,
    对账: () => Promise<void>,
    proposalId?: string,
  ): Promise<never> {
    if (错误 instanceof BFF错误 && 错误.status === 401) {
      // 清理要过会话 fence：发送后用户已换代（登出/重登/切身份，转移路径自己清过
      // 账号）时，迟到的旧会话 401 绝不能登出新会话 —— 跳过清理，错误照抛不变。
      if (仍是当前会话(deps, subjectId, generation)) 清账号状态(账号清理依赖);
      throw 错误;
    }
    if (!(错误 instanceof BFF错误)) throw 错误;
    if (错误.code === 'agent_rule_scope_denied' || 错误.code === 'idempotency_conflict') {
      await 处理提案冲突(错误, role, subjectId, generation, proposalId);
    }
    if (需要对账(错误)) {
      try {
        await 对账();
      } catch (恢复错误) {
        // 恢复动作自身的失败不能顶替原始错误；但恢复读撞上 401 = 会话已失效，
        // 必须走统一登出清理（与 401 扫描同口径），不能顶着已登录壳吞掉。
        // 同样过会话 fence：已换代的迟到 401 不清新会话。
        if (是401原因(恢复错误) && 仍是当前会话(deps, subjectId, generation)) {
          清账号状态(账号清理依赖);
        }
      }
    }
    throw 错误;
  }

  /** 把响应中的单条 Rule 并进 raw 快照并同步投影页面数组。 */
  function 并入单条规则(规则: BFFAgent规则, role: BFF角色): void {
    // 快照表在函数式更新器内从 旧 构建（同 并入单个提案）：ref 只在渲染提交后刷新，
    // 同帧两条不同规则的并入若都从 ref 取整表，先落地的新版本会被后落地的覆盖回去。
    设后端状态((旧) => ({
      ...旧,
      ...(role === 'candidate'
        ? { 候选规则快照: { ...旧.候选规则快照, [规则.rule_id]: 规则 } }
        : { 招聘规则快照: { ...旧.招聘规则快照, [规则.rule_id]: 规则 } }),
    }));
    // 投影另用「此刻 ref + 本条规则」拼整表（同步可得，唯一来源仍是更新器里的 旧）：
    // 投影是派生 UI，Provider 的派生 effect 会从已提交 state 重算纠回，这里只管让行尽快可见。
    const 投影表 = role === 'candidate'
      ? { ...后端状态引用.current.候选规则快照, [规则.rule_id]: 规则 }
      : { ...后端状态引用.current.招聘规则快照, [规则.rule_id]: 规则 };
    发布规则投影(Object.values(投影表), role);
  }

  /**
   * Rule CAS 的版本来源：优先 raw 快照里的原始 DTO；快照缺席（如水合失败后先操作）
   * 时用一次单条权威 GET 兜底取当前 version，同样并回快照。快照在手时逐字复用该对象，
   * 替换提案的 If-Match 语义就是「创建时的当前版本」。兜底 GET 的落地同样要过
   * 调用方发送前捕获的会话 fence —— 过期就不写快照（DTO 仍交给调用方走各自的 fence）。
   */
  async function 取原始规则(
    role: BFF角色,
    ruleId: string,
    subjectId: string,
    generation: number,
  ): Promise<BFFAgent规则 | null> {
    const 快照 = role === 'candidate'
      ? 后端状态引用.current.候选规则快照[ruleId]
      : 后端状态引用.current.招聘规则快照[ruleId];
    if (快照) return 快照;
    try {
      const 单条 = await 后端!.读取单条Agent规则(role, ruleId);
      if (subjectId && 仍是当前会话(deps, subjectId, generation)) {
        并入单条规则(单条, role);
      }
      return 单条;
    } catch {
      // 单条都拿不到就没法做带 If-Match 的写：交给调用方按「目标不存在」早退
      return null;
    }
  }

  async function 刷新Agent规则(): Promise<void> {
    if (!是后端 || !后端) return;
    const role = 当前角色(后端状态引用.current);
    if (!role) return;
    const subjectId = 主体标识引用.current;
    if (!subjectId) return;
    const 键 = `Agent规则水合:${role}`;
    if (锁.current.has(键)) return;
    锁.current.add(键);
    try {
      const generation = 会话代际.current;
      // 401 扫描收在 运行完整水合并发布 内部：手动刷新与各 follow-up 刷新同一口径。
      await 串行完整水合并发布(role, subjectId, generation);
    } finally {
      锁.current.delete(键);
    }
  }

  async function 创建Agent规则提案(input: { 文本: string; 作用域?: BFFAgent规则作用域 }): Promise<string> {
    if (!是后端 || !后端) {
      // Mock 入口按候选端语义区分：带作用域 = 候选页，缺省 = 企业设置页（facade 的闭合校验同款）
      if (input.作用域 !== undefined) {
        派发({ 型: '新增规则', 内容: input.文本, 来源: '你手动添加 · 刚刚' });
      } else {
        派发({ 型: '企业新增规则', 内容: input.文本, 来源: '手动添加' });
      }
      // Mock 页面保存即关闭：返回合成空串，从不进入提案卡流程
      return '';
    }
    const role = 当前角色(后端状态引用.current);
    if (!role) return '';
    // recruiter 永远不接受作用域：调用方错误在 facade 之前拒绝（不发请求）
    if (role === 'recruiter' && input.作用域 !== undefined) {
      throw new BFF错误(0, 'invalid_request', '招聘方的 Agent 规则提案不接受范围');
    }
    const 键 = `Agent规则:new:${role}`;
    if (锁.current.has(键)) return '';
    锁.current.add(键);
    // 发送前捕获 subject + generation：同主体重登会递增代际，
    // 用捕获值 fence，迟到响应才不会把旧会话的回执写进新会话的快照。
    const subjectId = 主体标识引用.current ?? '';
    const generation = 会话代际.current;
    try {
      const 回执 = await 后端.创建Agent规则提案(role, input.文本, input.作用域);
      if (subjectId && 仍是当前会话(deps, subjectId, generation)) {
        并入单个提案(回执, role);
      }
      return 回执.proposal_id;
    } catch (错误) {
      // 必抛收口：永远以原始错误结束，这里不可能落到返回值
      return await 收口写入错误(
        错误, role, subjectId, generation,
        构建清单对账(role, subjectId, generation),
      );
    } finally {
      锁.current.delete(键);
    }
  }

  async function 创建Agent规则替换提案(ruleId: string, text: string): Promise<string> {
    if (!是后端 || !后端) {
      // Mock：编辑即保存制。按目标规则的归属选镜像 action（企业规则优先）
      const 是企业规则 = 状态引用.current.企业规则.some((条) => 条.编号 === ruleId);
      if (是企业规则) 派发({ 型: '企业改规则', 编号: ruleId, 内容: text });
      else 派发({ 型: '改规则', 编号: ruleId, 内容: text });
      return '';
    }
    const role = 当前角色(后端状态引用.current);
    if (!role) return '';
    const 键 = `Agent规则:${ruleId}`;
    if (锁.current.has(键)) return '';
    锁.current.add(键);
    // 发送前捕获 subject + generation（同 创建Agent规则提案 的 fence 纪律）
    const subjectId = 主体标识引用.current ?? '';
    const generation = 会话代际.current;
    try {
      // 替换必须点名创建时的当前版本：用 raw 快照里的原始 DTO，不用页面投影
      const 原始 = await 取原始规则(role, ruleId, subjectId, generation);
      if (!原始 || !subjectId) return '';
      const 回执 = await 后端.创建Agent规则替换提案(role, 原始, text);
      if (仍是当前会话(deps, subjectId, generation)) 并入单个提案(回执, role);
      return 回执.proposal_id;
    } catch (错误) {
      // replacement 同时挂着 Rule 版本：清单与 Rules 都要重读；必抛收口同上
      return await 收口写入错误(
        错误, role, subjectId, generation,
        async () => {
          await 构建清单对账(role, subjectId, generation)();
          await 构建规则对账(role, subjectId, generation)();
        },
      );
    } finally {
      锁.current.delete(键);
    }
  }

  async function 刷新Agent规则提案(proposalId: string): Promise<void> {
    if (!是后端 || !后端) return;
    const role = 当前角色(后端状态引用.current);
    if (!role) return;
    const subjectId = 主体标识引用.current;
    if (!subjectId) return;
    // 权威 GET：绝不取 Agent提案 写锁（accept/dismiss 的恢复路径就在这些锁内）；
    // 并发安全由页面轮询单飞 + 这里读前捕获的提案代际与会话 fence 保证。
    const generation = 会话代际.current;
    const captured = 当前提案代际(proposalId);
    const 落点 = await 落定(后端.读取Agent规则提案(role, proposalId));
    if (落点.status !== 'fulfilled') {
      const 原因 = 落点.status === 'rejected' ? 落点.reason : new BFF错误(0, 'invalid_response', '提案响应缺失');
      // 权威读撞上 401 = 会话在读途中失效：轮询方/页面按约定安静处理，但这里必须先
      // 统一登出清理，不能顶着已登录壳吞掉（review-r3 R3-1）—— 清完照常安静返回，
      // 不把 401 抛给轮询方。已换代的迟到 401 则跳过清理、错误照抛不变（转移路径
      // 自己清过账号，绝不能顺手吞掉旧会话的错误语义）。
      if (是401原因(原因)) {
        if (仍是当前会话(deps, subjectId, generation)) {
          清账号状态(账号清理依赖);
          return;
        }
        throw 原因;
      }
      // 找不到这张卡 = 它已经不在 actionable 集合里：重读两份清单把它权威清掉
      if (原因 instanceof BFF错误 && 原因.code === 'agent_rule_proposal_not_found' &&
          仍是当前会话(deps, subjectId, generation)) {
        try {
          await 构建清单对账(role, subjectId, generation)();
        } catch (恢复错误) {
          // 恢复读失败就安静离开，不打断轮询方；但恢复读撞上 401 = 会话已失效，
          // 同样统一登出清理（过 fence），不能顶着已登录壳吞掉。
          if (是401原因(恢复错误) && 仍是当前会话(deps, subjectId, generation)) {
            清账号状态(账号清理依赖);
          }
        }
        return;
      }
      throw 原因;
    }
    if (
      !仍是当前会话(deps, subjectId, generation) ||
      !提案响应仍新鲜(proposalId, captured)
    ) {
      // 过时的回执既不改快照也不动阶段
      return;
    }
    const 回执 = 落点.value;
    if (回执.state === 'dismissed') {
      移除提案(proposalId, role);
      return;
    }
    if (回执.state === 'accepted') {
      // accepted = 权威 Rule 已经生成：触发一轮完整刷新收口卡片
      await 串行完整水合并发布(role, subjectId, generation);
      return;
    }
    // interpreting / ready / failed 原位写回（failed 文案留给页面本地确认后再清）
    并入单个提案(回执, role);
  }

  async function 接受Agent规则提案(proposalId: string): Promise<void> {
    if (!是后端 || !后端) return; // Mock 没有提案卡：no-op
    const role = 当前角色(后端状态引用.current);
    if (!role) return;
    const 键 = `Agent提案:${proposalId}`;
    if (锁.current.has(键)) return;
    锁.current.add(键);
    // 发送前捕获 subject + generation（同 创建Agent规则提案 的 fence 纪律）
    const subjectId = 主体标识引用.current ?? '';
    const generation = 会话代际.current;
    try {
      // 终端操作发送前自增提案代际：轮询/恢复捕获的旧单卡 GET 晚于收口落地时，
      // 过不了 提案响应仍新鲜 的检查，不能把 ready/interpreting 回执盖回已收口的卡。
      推进提案代际(proposalId);
      await 后端.接受Agent规则提案(role, proposalId);
      if (subjectId && 仍是当前会话(deps, subjectId, generation)) {
        // 接受后必须看权威 Rules：跑完整链路（顺便清掉 actionable 里的这张卡）
        await 串行完整水合并发布(role, subjectId, generation);
      }
    } catch (错误) {
      await 收口写入错误(
        错误, role, subjectId, generation,
        构建回执对账(proposalId, role, subjectId, generation),
        proposalId,
      );
    } finally {
      锁.current.delete(键);
    }
  }

  async function 放弃Agent规则提案(proposalId: string): Promise<void> {
    if (!是后端 || !后端) return;
    const role = 当前角色(后端状态引用.current);
    if (!role) return;
    const 键 = `Agent提案:${proposalId}`;
    if (锁.current.has(键)) return;
    锁.current.add(键);
    // 发送前捕获 subject + generation（同 创建Agent规则提案 的 fence 纪律）
    const subjectId = 主体标识引用.current ?? '';
    const generation = 会话代际.current;
    try {
      // 同 接受Agent规则提案：发送前自增提案代际，压掉在飞的旧单卡 GET
      推进提案代际(proposalId);
      const 回执 = await 后端.放弃Agent规则提案(role, proposalId);
      if (!subjectId || !仍是当前会话(deps, subjectId, generation)) return;
      if (回执.state === 'dismissed') 移除提案(proposalId, role);
      else 并入单个提案(回执, role);
    } catch (错误) {
      await 收口写入错误(
        错误, role, subjectId, generation,
        构建回执对账(proposalId, role, subjectId, generation),
        proposalId,
      );
    } finally {
      锁.current.delete(键);
    }
  }

  async function 切换Agent规则(ruleId: string, operation: 'pause' | 'resume'): Promise<void> {
    if (!是后端 || !后端) {
      // Mock 开关不分 pause/resume：沿用原型的一次翻转
      const 是企业规则 = 状态引用.current.企业规则.some((条) => 条.编号 === ruleId);
      if (是企业规则) 派发({ 型: '企业切规则开关', 编号: ruleId });
      else 派发({ 型: '切规则开关', 编号: ruleId });
      return;
    }
    const role = 当前角色(后端状态引用.current);
    if (!role) return;
    const 键 = `Agent规则:${ruleId}`;
    if (锁.current.has(键)) return;
    锁.current.add(键);
    // 发送前捕获 subject + generation（同 创建Agent规则提案 的 fence 纪律）
    const subjectId = 主体标识引用.current ?? '';
    const generation = 会话代际.current;
    try {
      const 原始 = await 取原始规则(role, ruleId, subjectId, generation);
      if (!原始 || !subjectId) return;
      const 下一 = await 后端.修改Agent规则(role, ruleId, 原始.version, operation);
      if (仍是当前会话(deps, subjectId, generation)) {
        // 并入单条规则 内部同样用本地表投影，避免依赖设后端状态 后未提交的 ref
        并入单条规则(下一, role);
      }
    } catch (错误) {
      // 这类 effect 没有 receipt：失败一律重读一次全部 Rules 收敛，绝不再发 mutation
      await 收口写入错误(
        错误, role, subjectId, generation,
        构建规则对账(role, subjectId, generation),
      );
    } finally {
      锁.current.delete(键);
    }
  }

  async function 删除Agent规则(ruleId: string): Promise<void> {
    if (!是后端 || !后端) {
      const 是企业规则 = 状态引用.current.企业规则.some((条) => 条.编号 === ruleId);
      if (是企业规则) 派发({ 型: '企业删规则', 编号: ruleId });
      else 派发({ 型: '删规则', 编号: ruleId });
      return;
    }
    const role = 当前角色(后端状态引用.current);
    if (!role) return;
    const 键 = `Agent规则:${ruleId}`;
    if (锁.current.has(键)) return;
    锁.current.add(键);
    // 发送前捕获 subject + generation（同 创建Agent规则提案 的 fence 纪律）
    const subjectId = 主体标识引用.current ?? '';
    const generation = 会话代际.current;
    try {
      const 原始 = await 取原始规则(role, ruleId, subjectId, generation);
      if (!原始 || !subjectId) return;
      await 后端.删除Agent规则(role, ruleId, 原始.version);
      if (仍是当前会话(deps, subjectId, generation)) {
        // 在写之前本地算好「余下」：设后端状态 的 ref 要到下一个渲染提交才更新，
        // 写后再读会拿到没删干净的旧表并投给页面
        const 当前表 = role === 'candidate'
          ? 后端状态引用.current.候选规则快照
          : 后端状态引用.current.招聘规则快照;
        const 余下表: Record<string, BFFAgent规则> = {};
        for (const [编号, 条] of Object.entries(当前表)) {
          if (编号 !== ruleId) 余下表[编号] = 条;
        }
        设后端状态((旧) => ({
          ...旧,
          ...(role === 'candidate'
            ? { 候选规则快照: 余下表 }
            : { 招聘规则快照: 余下表 }),
        }));
        发布规则投影(Object.values(余下表), role);
      }
    } catch (错误) {
      await 收口写入错误(
        错误, role, subjectId, generation,
        构建规则对账(role, subjectId, generation),
      );
    } finally {
      锁.current.delete(键);
    }
  }

  return {
    刷新Agent规则,
    创建Agent规则提案,
    创建Agent规则替换提案,
    刷新Agent规则提案,
    接受Agent规则提案,
    放弃Agent规则提案,
    切换Agent规则,
    删除Agent规则,
  };
}
