// MatchCase 展示映射：Task 1 归一化 P5 DTO（已 decode、已过 17 行状态矩阵）→ 纯展示视图的
// 纯函数投影。展示权威仍是 state.lifecycle/stage/status/step + viewer needs_action +
// available_actions；按钮可见性 = 行侧白名单 ∩ available_actions 的交集，绝不从 summary、
// 时间线文本、对方决定或 needs_user infer 出任何动作。运行时再遭未知词/矩阵外四元组/
// 终态带动作/阶段区漂移等非法数据时 fail closed 成契约错误视图 + 空动作表。P5 移交只有
// completed + handoff_pending 一种：只给「正在创建会话」的文案，canChat 恒 false，绝不生成、
// 缓存或推断任何会话标识。本模块不 import React / Mock / HTTP，不发请求，可被列表与详情共用。

import { 取当前补充问题 } from './MatchCase基础';
import type { P5问题阶段输入 } from './MatchCase基础';
import type { P5生命周期, P5阶段, P5状态 } from './BFF契约';
import type {
  P5列表项,
  P5详情,
  P5叮嘱回执,
  P5简历附件,
  P5阶段区,
  P5时间线项,
  P5状态视图,
  P5终局摘要,
  P5工作区职位,
} from './招聘数据源/MatchCase';

export type { P5角色, P5动作, P5步骤 } from './招聘数据源/MatchCase';
export type { P5生命周期, P5阶段, P5状态 } from './BFF契约';
import type { P5角色, P5动作, P5步骤 } from './招聘数据源/MatchCase';

// ── 闭合文案表：契约内枚举 → 展示文案，satisfies 双向钉死（缺词与多词都编译失败）──

/** 四阶段中文标题（S0→S3 固定顺序同 阶段顺序表）。 */
const 阶段标题表 = {
  anonymous_screening: '匿名初筛',
  resume_submission: '简历提交',
  needs_coordination: '差异协同',
  intent_confirmation: '意向确认',
} as const satisfies Record<P5阶段, string>;

/** 状态胶囊文案（六闭词）。 */
const 状态文案表 = {
  running: '进行中',
  needs_user: '待处理',
  passed: '已通过',
  attention_required: '需注意',
  ended: '已结束',
  waiting: '等待中',
} as const satisfies Record<P5状态, string>;

/** 17 个 step 闭词的逐词解释文案（步骤说明须与阶段无关：awaiting_recruiter_decision 同时落在 S1 与 S2）。 */
const 步骤说明表 = {
  policy_check: '系统正在核对投递政策',
  candidate_evaluation: '候选方 AI 正在评估岗位',
  candidate_question: '等待候选人补充事实',
  recruiter_answer: '等待招聘方 AI 回答补充问题',
  candidate_reevaluation: '系统正在复评候选信息',
  human_decision: '等待人工决定是否继续',
  complete: '本阶段已完成',
  awaiting_candidate_resume_invitation: '等待候选人回应简历邀请',
  awaiting_resume_parse: '正在解析简历',
  screening_resume: '招聘方 AI 正在初筛已提交简历',
  awaiting_recruiter_decision: '等待招聘方决定',
  coordinating: '双方 AI 正在核对剩余差异',
  awaiting_candidate_decision: '等待候选人确认协同事项',
  awaiting_confirmations: '等待双方确认意向',
  awaiting_candidate_confirmation: '等待候选人确认意向',
  awaiting_recruiter_confirmation: '等待招聘方确认意向',
  handoff_pending: '双方已确认，正在创建会话',
} as const satisfies Record<P5步骤, string>;

/** 十个动作闭词的动作卡文案（标题 + 说明）。 */
const 动作卡文案表 = {
  respond_fact: { 标题: '补充事实', 说明: '回答当前阶段待补充的问题' },
  end_screening: { 标题: '结束初筛', 说明: '结束本次匿名初筛' },
  accept_resume_invitation: { 标题: '接受简历邀请', 说明: '同意披露简历并进入简历评估' },
  decline_resume_invitation: { 标题: '婉拒简历邀请', 说明: '拒绝本次简历披露邀请' },
  retry_resume_readiness: { 标题: '重试简历校验', 说明: '简历校验未通过时重新尝试' },
  replace_resume: { 标题: '更换简历', 说明: '改用另一份简历重新提交' },
  decide_resume_screening: { 标题: '出具简历初筛结论', 说明: '决定简历是否通过初筛' },
  decide_coordination: { 标题: '回应协同事项', 说明: '对当前协同事项作出接受或拒绝' },
  confirm_intent: { 标题: '确认意向', 说明: '确认匹配并进入会话创建' },
  decline_intent: { 标题: '婉拒意向', 说明: '拒绝本次匹配' },
} as const satisfies Record<P5动作, { 标题: string; 说明: string }>;

/** 阶段区自身 state 的展示文案。 */
const 阶段区状态文案表 = {
  pending: '未开始',
  active: '进行中',
  passed: '已通过',
  ended: '已结束',
} as const satisfies Record<P5阶段区['state'], string>;

/** 生命周期 → 是否终局（ended / completed 终态不再有 mutation 控件）。 */
const 生命周期终局表 = {
  open: false,
  ended: true,
  completed: true,
} as const satisfies Record<P5生命周期, boolean>;

/** 四阶段固定 S0→S3 顺序（与已准入 OpenAPI 的 MatchCaseStageSection 家族一致）。 */
const 阶段顺序表 = [
  'anonymous_screening', 'resume_submission', 'needs_coordination', 'intent_confirmation',
] as const satisfies readonly P5阶段[];

/** 动作卡的固定渲染顺序 = wire 枚举声明顺序。 */
const 动作顺序表 = [
  'respond_fact', 'end_screening', 'accept_resume_invitation', 'decline_resume_invitation',
  'retry_resume_readiness', 'replace_resume', 'decide_resume_screening', 'decide_coordination',
  'confirm_intent', 'decline_intent',
] as const satisfies readonly P5动作[];

const 已知动作集合 = new Set<string>(动作顺序表);

/** 契约错误视图的唯一提示文案（视图层据此渲染 fail-closed 状态）。 */
export const P5契约错误提示 = '该 Case 数据不符合契约，已停用全部操作';

/** completed + handoff_pending 的移交文案（准备中：只能等，不能聊）。 */
export const P5移交文案 = '双方已确认，正在创建会话';
/** P7 Task 6：completed + complete + conversation_ref 的移交就绪文案。 */
export const P5移交就绪文案 = '真人会话已建立';

// ── 已准入 17 行状态矩阵（展示侧）：steps 同 Task 1 decode 权威；可出动作是行侧白名单 ──

export interface P5展示状态行 {
  readonly lifecycle: P5生命周期;
  readonly stage: P5阶段;
  readonly status: P5状态;
  readonly steps: readonly P5步骤[];
  /** 本行语义上可出的动作卡；按钮可见性 = 此白名单 ∩ available_actions。 */
  readonly 可出动作: readonly P5动作[];
}

/**
 * 17 行 lifecycle+stage+status 矩阵的展示侧数据（元组形态）：四元组与 Task 1 decode 矩阵同源；
 * 可出动作列 = 已准入投影器 matchcase/lifecycle.go lifecycleViewerActions 在该行三元组下
 * 一切事实组合所能出卡的角色无关并集（over-narrow 会藏掉后端真给的卡，一律取并集；
 * over-broad 在交集规则下惰性）。逐行依据：终态恒空；S0 只有 needs_user 行可出
 * respond_fact/end_screening（预算内双卡、预算尽只剩 end_screening，并集为双卡）与
 * passed 行的邀请二卡（ResumeInvitationPending ⇔ step=awaiting_candidate_resume_invitation，
 * 仅此行），running/waiting/attention_required 行落空；S1 waiting 行候选端可出
 * retry_resume_readiness（披露前解析等待），needs_user 行并集候选端 retry/replace 与
 * 招聘端 decide_resume_screening，attention_required 行落空；S2 协同块不绑 status，
 * 三行皆可出 decide_coordination；S3 只有意向二卡。
 * 行数由 P5展示矩阵行数 在编译期钉死为 17；对外以 P5展示状态矩阵 的具名行形态导出。
 */
const 矩阵元组表 = [
  ['open', 'anonymous_screening', 'running',
    ['policy_check', 'candidate_evaluation', 'candidate_question', 'recruiter_answer', 'candidate_reevaluation'],
    []],
  ['open', 'anonymous_screening', 'waiting', ['candidate_reevaluation'], []],
  ['open', 'anonymous_screening', 'needs_user', ['human_decision'], ['respond_fact', 'end_screening']],
  ['open', 'anonymous_screening', 'passed',
    ['complete', 'awaiting_candidate_resume_invitation', 'awaiting_resume_parse'],
    ['accept_resume_invitation', 'decline_resume_invitation']],
  ['open', 'anonymous_screening', 'attention_required',
    ['candidate_evaluation', 'candidate_question', 'recruiter_answer', 'candidate_reevaluation'],
    []],
  ['open', 'resume_submission', 'waiting', ['awaiting_resume_parse', 'screening_resume'], ['retry_resume_readiness']],
  ['open', 'resume_submission', 'needs_user', ['awaiting_resume_parse', 'awaiting_recruiter_decision'],
    ['retry_resume_readiness', 'replace_resume', 'decide_resume_screening']],
  ['open', 'resume_submission', 'attention_required', ['screening_resume'], []],
  ['open', 'needs_coordination', 'waiting',
    ['coordinating', 'awaiting_candidate_decision', 'awaiting_recruiter_decision'], ['decide_coordination']],
  ['open', 'needs_coordination', 'needs_user', ['coordinating'], ['decide_coordination']],
  ['open', 'needs_coordination', 'attention_required', ['coordinating'], ['decide_coordination']],
  ['open', 'intent_confirmation', 'needs_user',
    ['awaiting_confirmations', 'awaiting_candidate_confirmation', 'awaiting_recruiter_confirmation'],
    ['confirm_intent', 'decline_intent']],
  ['ended', 'anonymous_screening', 'ended', ['complete'], []],
  ['ended', 'resume_submission', 'ended', ['complete'], []],
  ['ended', 'needs_coordination', 'ended', ['complete'], []],
  ['ended', 'intent_confirmation', 'ended', ['complete'], []],
  // P7 Task 6：completed 行两步移交 —— handoff_pending（ref 必缺席）与 complete（ref 必在场）；
  // 不新造第 18 行，矩阵仍 17 行。
  ['completed', 'intent_confirmation', 'passed', ['handoff_pending', 'complete'], []],
] as const satisfies readonly (readonly [P5生命周期, P5阶段, P5状态, readonly P5步骤[], readonly P5动作[]])[];

/** 编译期行数钉子：矩阵行数漂移（≠17）时 `17` 不再可赋值，typecheck 即红。 */
export const P5展示矩阵行数: (typeof 矩阵元组表)['length'] = 17;

/** 具名行形态的 17 行矩阵（tests 与调用方按字段名消费）。 */
export const P5展示状态矩阵: readonly P5展示状态行[] = 矩阵元组表.map(
  ([lifecycle, stage, status, steps, 可出动作]) => ({ lifecycle, stage, status, steps, 可出动作 }),
);

const 矩阵索引 = new Map<string, P5展示状态行>(
  P5展示状态矩阵.map((行) => [`${行.lifecycle}|${行.stage}|${行.status}`, 行]),
);

// ── 视图类型（Tasks 3–7 的展示契约）──

export interface P5职位视图 {
  jobId: string;
  职位名: string;
  城市: string;
  薪资带: string;
  技能: readonly string[];
}

export interface P5动作卡 {
  action: P5动作;
  标题: string;
  说明: string;
}

export interface P5补充问题视图 {
  promptId: string;
  text: string;
}

/** P7 Task 6：completed 行的两步移交 —— pending 只读等会话（canChat 恒 false 语义），
 *  ready 已发布（带权威 conversationId，唯一导航依据）；无 published 合成字段。 */
export type P5移交视图 =
  | { state: 'pending'; copy: '双方已确认，正在创建会话' }
  | { state: 'ready'; copy: '真人会话已建立'; conversationId: string };

export interface P5终局摘要视图 {
  /** 终局结束语（wire outcome 原样，不翻译不改写）。 */
  结束语: string;
  /** 终局原因码（wire reason_summary 原样）。 */
  原因: string;
  定格于: string;
}

export interface P5阶段区块视图 {
  stage: P5阶段;
  标题: string;
  状态: P5阶段区['state'];
  状态文案: string;
  发生于: string | null;
  摘要: string;
  清单: readonly { 文本: string; 完成: boolean }[];
  /** 仅作展示的时间线（原样透传，永不参与状态/动作判定）。 */
  时间线: readonly P5时间线项[];
  叮嘱: readonly P5叮嘱回执[];
  附件: P5简历附件 | null;
}

export interface P5详情正常视图 {
  kind: '正常';
  /** 键与导航唯一归属：case_id；意向 ID / 候选别名只是角色上下文展示。 */
  caseId: string;
  role: P5角色;
  职位: P5职位视图;
  intentionId: string | null;
  /** P5 别名：不透明展示文本，原样带出，永不解析/截断/派生。 */
  candidateAlias: string | null;
  阶段标题: string;
  状态文案: string;
  步骤说明: string;
  轮次: { 当前: number; 预算: number };
  待办: boolean;
  /** lifecycle 终局（ended/completed）：只读口径 —— mutation/叮嘱输入隐藏。 */
  终局: boolean;
  /**
   * P7 Task 6：详情轮询的停止口径 —— ended，或 completed + complete + conversation_ref
   * （已发布会话）。pending（handoff_pending，含 same-party 长期 pending）继续低频重读。
   */
  详情终局: boolean;
  更新于: string;
  handoff: P5移交视图 | null;
  actions: readonly P5动作卡[];
  补充问题: P5补充问题视图 | null;
  阶段区块: readonly P5阶段区块视图[];
  终局摘要: P5终局摘要视图 | null;
}

/** 契约错误视图：动作表恒空、无补充问题、无移交（与正常视图共享字段名以便联合窄化）。 */
export interface P5详情契约错误视图 {
  kind: '契约错误';
  错误提示: string;
  handoff: null;
  actions: readonly P5动作卡[];
  补充问题: null;
}

export type P5详情视图 = P5详情正常视图 | P5详情契约错误视图;

export interface P5列表正常视图 {
  kind: '正常';
  caseId: string;
  role: P5角色;
  职位: P5职位视图;
  intentionId: string | null;
  candidateAlias: string | null;
  阶段标题: string;
  状态文案: string;
  待办: boolean;
  终局: boolean;
  更新于: string;
}

export interface P5列表契约错误视图 {
  kind: '契约错误';
  错误提示: string;
}

export type P5列表视图 = P5列表正常视图 | P5列表契约错误视图;

// ── 运行时防线：decode 已挡住的漂移若仍抵达此处，一律 fail closed ──

function 契约错误详情(): P5详情契约错误视图 {
  return { kind: '契约错误', 错误提示: P5契约错误提示, handoff: null, actions: [], 补充问题: null };
}

function 契约错误列表(): P5列表契约错误视图 {
  return { kind: '契约错误', 错误提示: P5契约错误提示 };
}

/** 四元组落在 17 行矩阵内且 step 属于该行 → 命中行；未知词或矩阵外一律 null。 */
function 查展示行(state: P5状态视图): P5展示状态行 | null {
  if (state === null || typeof state !== 'object') return null;
  const { lifecycle, stage, status, step } = state;
  if (typeof lifecycle !== 'string' || typeof stage !== 'string'
    || typeof status !== 'string' || typeof step !== 'string') return null;
  const 行 = 矩阵索引.get(`${lifecycle}|${stage}|${status}`);
  if (行 === undefined) return null;
  return 行.steps.includes(step) ? 行 : null;
}

function 查列表行(item: P5列表项): { 行: P5展示状态行; state: P5状态视图 } | null {
  if (item === null || typeof item !== 'object') return null;
  const 行 = 查展示行(item.state);
  if (行 === null) return null;
  const state = item.state;
  if (typeof state.caseId !== 'string' || state.caseId === '') return null;
  return { 行, state };
}

/** 按钮可见性 = 行侧白名单 ∩ available_actions，按 wire 枚举顺序渲染。 */
function 渲染动作卡(offered: readonly P5动作[], 行: P5展示状态行): P5动作卡[] {
  return 动作顺序表
    .filter((动作) => offered.includes(动作) && 行.可出动作.includes(动作))
    .map((动作) => ({ action: 动作, 标题: 动作卡文案表[动作].标题, 说明: 动作卡文案表[动作].说明 }));
}

function 映射职位(job: P5工作区职位): P5职位视图 | null {
  if (job === null || typeof job !== 'object') return null;
  const 快照 = job.job;
  if (快照 === null || typeof 快照 !== 'object') return null;
  if (typeof job.jobId !== 'string' || typeof 快照.title !== 'string' || typeof 快照.location !== 'string'
    || typeof 快照.publicSalaryRange !== 'string' || !Array.isArray(快照.requiredSkills)
    || !快照.requiredSkills.every((技能) => typeof 技能 === 'string')) return null;
  return {
    jobId: job.jobId,
    职位名: 快照.title,
    城市: 快照.location,
    薪资带: 快照.publicSalaryRange,
    技能: [...快照.requiredSkills],
  };
}

function 映射终局摘要(摘要: P5终局摘要 | null): P5终局摘要视图 | null {
  if (摘要 === null || typeof 摘要 !== 'object') return null;
  return { 结束语: 摘要.outcome, 原因: 摘要.reasonSummary, 定格于: 摘要.finalizedAt };
}

function 映射阶段区(区: P5阶段区): P5阶段区块视图 {
  return {
    stage: 区.stage,
    标题: 阶段标题表[区.stage],
    状态: 区.state,
    状态文案: 阶段区状态文案表[区.state],
    发生于: 区.occurredAt,
    摘要: 区.summary,
    清单: 区.checklist.map((项) => ({ 文本: 项.label, 完成: 项.done })),
    时间线: 区.transcript,
    叮嘱: 区.instructionReceipts,
    附件: 区.attachment,
  };
}

// ── 补充问题接入：只把已准入的 stage/kind/role/ref/text 五字段适配进 Plan 1 ──

function 取补充问题(detail: P5详情, role: P5角色): P5补充问题视图 | null {
  const 输入: P5问题阶段输入 = {
    currentStage: detail.state.stage,
    availableActions: detail.availableActions,
    stages: detail.stages.map((区) => ({
      stage: 区.stage,
      transcript: 区.transcript.map((项) => ({
        kind: 项.kind,
        role: 项.role,
        ref: 项.ref,
        text: 项.text,
      })),
    })),
  };
  const 结果 = 取当前补充问题(输入, role);
  if (结果.kind !== 'one') return null;
  return { promptId: 结果.promptId, text: 结果.text };
}

// ── 对外映射（纯函数）──

/** P5列表项 → 列表行视图：case_id、角色上下文、阶段标题/状态文案、待办与终局标记。 */
export function 映射P5列表项(item: P5列表项): P5列表视图 {
  const 命中 = 查列表行(item);
  if (命中 === null) return 契约错误列表();
  const { 行, state } = 命中;
  const 职位 = 映射职位(item.job);
  if (职位 === null) return 契约错误列表();
  let intentionId: string | null = null;
  let candidateAlias: string | null = null;
  if (item.role === 'candidate') {
    if (typeof item.intentionId !== 'string' || item.intentionId === '') return 契约错误列表();
    intentionId = item.intentionId;
  } else if (item.role === 'recruiter') {
    if (typeof item.candidateAlias !== 'string') return 契约错误列表();
    candidateAlias = item.candidateAlias;
  } else {
    return 契约错误列表();
  }
  return {
    kind: '正常',
    caseId: state.caseId,
    role: item.role,
    职位,
    intentionId,
    candidateAlias,
    阶段标题: 阶段标题表[行.stage],
    状态文案: 状态文案表[行.status],
    待办: item.needsAction === true,
    终局: 生命周期终局表[行.lifecycle],
    更新于: state.updatedAt,
  };
}

/** P5详情 → 详情视图：完整状态文案、动作卡交集、补充问题、终局与移交展示。 */
export function 映射P5详情(detail: P5详情): P5详情视图 {
  if (detail === null || typeof detail !== 'object') return 契约错误详情();
  const 行 = 查展示行(detail.state);
  if (行 === null) return 契约错误详情();
  const state = detail.state;
  if (typeof state.caseId !== 'string' || state.caseId === '') return 契约错误详情();

  // 角色与上下文：候选端带意向 ID、招聘端带不透明别名，对端字段进不了视图。
  let intentionId: string | null = null;
  let candidateAlias: string | null = null;
  if (detail.role === 'candidate') {
    if (typeof detail.context?.intentionId !== 'string' || detail.context.intentionId === '') {
      return 契约错误详情();
    }
    intentionId = detail.context.intentionId;
  } else if (detail.role === 'recruiter') {
    if (typeof detail.context?.candidateAlias !== 'string') return 契约错误详情();
    candidateAlias = detail.context.candidateAlias;
  } else {
    return 契约错误详情();
  }

  // 动作表：闭词、终态零动作。
  const offered = detail.availableActions;
  if (!Array.isArray(offered) || !offered.every((动作) => 已知动作集合.has(动作))) {
    return 契约错误详情();
  }
  if (行.lifecycle !== 'open' && offered.length > 0) return 契约错误详情();

  // 四阶段区固定 S0→S3。
  const 区组 = detail.stages;
  if (!Array.isArray(区组) || 区组.length !== 4) return 契约错误详情();
  for (let 下标 = 0; 下标 < 4; 下标 += 1) {
    if (区组[下标]?.stage !== 阶段顺序表[下标]) return 契约错误详情();
  }

  const 职位 = 映射职位(detail.context.job);
  if (职位 === null) return 契约错误详情();

  // 按钮可见性 = 行白名单 ∩ available_actions（交集，绝不加、绝不 infer）。
  const 动作卡 = 渲染动作卡(offered, 行);

  // respond_fact 卡真的会渲染时才接补充问题：Plan 1 唯一匹配放行，其余 fail closed。
  let 补充问题: P5补充问题视图 | null = null;
  if (动作卡.some((卡) => 卡.action === 'respond_fact')) {
    const 问题 = 取补充问题(detail, detail.role);
    if (问题 === null) return 契约错误详情();
    补充问题 = 问题;
  }

  // P7 Task 6：completed 行两步移交 —— handoff_pending（无 ref）pending；
  // complete（带 ref）ready；组合漂移（decode 已挡）在映射层再 fail closed 一次。
  let handoff: P5移交视图 | null = null;
  if (行.lifecycle === 'completed') {
    if (state.step === 'handoff_pending' && detail.conversationRef === null) {
      handoff = { state: 'pending', copy: P5移交文案 };
    } else if (state.step === 'complete' && detail.conversationRef !== null) {
      handoff = { state: 'ready', copy: P5移交就绪文案, conversationId: detail.conversationRef };
    } else {
      return 契约错误详情();
    }
  }
  const 会话已发布 = 行.lifecycle === 'completed'
    && state.step === 'complete'
    && detail.conversationRef !== null;

  return {
    kind: '正常',
    caseId: state.caseId,
    role: detail.role,
    职位,
    intentionId,
    candidateAlias,
    阶段标题: 阶段标题表[行.stage],
    状态文案: 状态文案表[行.status],
    步骤说明: 步骤说明表[state.step],
    轮次: { 当前: state.round, 预算: state.roundBudget },
    待办: detail.needsAction === true,
    终局: 生命周期终局表[行.lifecycle],
    详情终局: 行.lifecycle === 'ended' || 会话已发布,
    更新于: state.updatedAt,
    handoff,
    actions: 动作卡,
    补充问题,
    阶段区块: 区组.map(映射阶段区),
    终局摘要: 映射终局摘要(detail.terminalSummary),
  };
}
