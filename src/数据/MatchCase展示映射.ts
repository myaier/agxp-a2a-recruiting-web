// MatchCase 展示映射：Task 1 归一化 P5 DTO（已 decode、已过 17 行状态矩阵）→ 纯展示视图的
// 纯函数投影。展示权威仍是 state.lifecycle/stage/status/step + viewer needs_action +
// available_actions；按钮可见性 = 行侧白名单 ∩ available_actions 的交集，绝不从 summary、
// 时间线文本、对方决定或 needs_user infer 出任何动作。运行时再遭未知词/矩阵外四元组/
// 终态带动作/阶段区漂移等非法数据时 fail closed 成契约错误视图 + 空动作表。P5 移交只有
// completed + handoff_pending 一种：只给「正在创建会话」的文案，canChat 恒 false，绝不生成、
// 缓存或推断任何会话标识。本模块不 import React / Mock / HTTP，不发请求，可被列表与详情共用。

import type { P5生命周期, P5阶段, P5状态, BFF安全职位资料 } from './BFF契约';
import { 代谈终局文案 } from './代谈结果文案';
import { 映射招聘候选摘要 } from './招聘候选摘要映射';
import type { 招聘候选摘要视图 } from './招聘候选摘要映射';
import type {
  P5列表项,
  P5详情,
  P5叮嘱回执,
  P5简历附件,
  P5阶段区,
  P5时间线项,
  P5待办,
  P5待办用途,
  P5对话进度,
  P5对话步骤,
  P5确认总结,
  P5重新考虑,
  P5状态视图,
  P5终局摘要,
  P5工作区职位,
  P5Agent注意码,
  P5回答来源,
  P5回答状态,
  P5筛选阶段,
  P5S0筛选记录,
  P5S0筛选消息,
  P5S0筛选总结,
} from './招聘数据源/MatchCase';

export type { P5角色, P5动作, P5步骤, P5待办用途 } from './招聘数据源/MatchCase';
export type { P5生命周期, P5阶段, P5状态 } from './BFF契约';
import type { P5角色, P5动作, P5步骤 } from './招聘数据源/MatchCase';

// ── 闭合文案表：契约内枚举 → 展示文案，satisfies 双向钉死（缺词与多词都编译失败）──

/** 四阶段中文标题（S0→S3 固定顺序同 阶段顺序表）。J-PILOT-01（Spec §9）：
 *  S1 阶段标题为「递交简历」，列表卡色系闭表（列表卡片映射.P5标题色系表）同键同步。 */
const 阶段标题表 = {
  anonymous_screening: '匿名初筛',
  resume_submission: '递交简历',
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

/** 17 个 step 闭词的逐词解释文案（步骤说明须与阶段无关：awaiting_recruiter_decision 同时落在 S1 与 S2）。
 *  兼任阶段区 summary 的展示 allowlist：summary 是阶段最后一个 step word（同 17 闭词），
 *  未知词不得原样进 DOM。candidate_question 是 AI 侧生成动作，不是候选人的人工待办。 */
const 步骤说明表 = {
  policy_check: '系统正在核对投递政策',
  candidate_evaluation: '候选方 AI 正在评估岗位',
  candidate_question: '候选方 AI 正在生成补充问题',
  recruiter_answer: '等待招聘方 AI 回答补充问题',
  candidate_reevaluation: '系统正在复评候选信息',
  human_decision: '等待人工决定是否继续',
  complete: '本阶段已完成',
  awaiting_candidate_resume_invitation: '等待候选人回应简历邀请',
  awaiting_resume_parse: '正在解析简历',
  screening_resume: '招聘方 AI 正在初筛已提交简历',
  awaiting_recruiter_decision: '等待招聘方决定',
  coordinating: '双方 AI 正在确认是否还有待协调事项',
  awaiting_candidate_decision: '等待候选人确认协同事项',
  awaiting_confirmations: '等待双方确认意向',
  awaiting_candidate_confirmation: '等待候选人确认意向',
  awaiting_recruiter_confirmation: '等待招聘方确认意向',
  handoff_pending: '双方已确认，正在创建会话',
} as const satisfies Record<P5步骤, string>;

/** 十个动作闭词的动作卡文案（标题 + 说明）。 */
const 动作卡文案表 = {
  respond_fact: { 标题: '补充事实', 说明: '回答当前阶段待补充的问题' },
  // v1 旧卡的原词（该卡在 v1 已停止交互，只保留词表完整）；v2 的同一动作词是「继续或结束」
  // 的中立决定卡，标题走 连续决定卡文案表。
  end_screening: { 标题: '结束初筛', 说明: '结束本次匿名初筛' },
  accept_resume_invitation: { 标题: '接受简历邀请', 说明: '同意披露简历并进入简历评估' },
  decline_resume_invitation: { 标题: '婉拒简历邀请', 说明: '拒绝本次简历披露邀请' },
  retry_resume_readiness: { 标题: '重试简历校验', 说明: '简历校验未通过时重新尝试' },
  replace_resume: { 标题: '更换简历', 说明: '改用另一份简历重新提交' },
  decide_resume_screening: { 标题: '出具简历初筛结论', 说明: '决定简历是否通过初筛' },
  decide_coordination: { 标题: '回应协同事项', 说明: '对当前协同事项作出接受或拒绝' },
  confirm_intent: { 标题: '确认意向', 说明: '确认匹配并进入会话创建' },
  decline_intent: { 标题: '婉拒意向', 说明: '拒绝本次匹配' },
  // S0–S3 连续筛选（v2）：S2 人工补答与 S1 七天重新考虑。「继续」只表示愿意进一步了解
  // 和协调，不代表接受差异，也不授权 Agent 自行让步（冻结合同 Global Constraints）。
  answer_dialogue: { 标题: '回答对方的问题', 说明: '你的回答是本次匹配的正式回答，双方都能看到' },
  reconsider: { 标题: '重新考虑', 说明: '在七天窗口内继续这一单：不重投简历、不重跑初筛' },
} as const satisfies Record<P5动作, { 标题: string; 说明: string }>;

/**
 * continuity_version 2 覆盖的动作卡文案：S0 的人工卡是「继续 or 结束」的中立决定，
 * 标题不能只说结束（主键是「继续」），也不能把继续说成接受或把恢复说成重新申请。
 */
const 连续决定卡文案表 = {
  end_screening: {
    标题: '是否继续这一单',
    说明: '继续表示愿意进一步了解和协调，不代表接受差异；结束后这一单无法恢复',
  },
} as const;

/** 阶段区自身 state 的展示文案。 */
const 阶段区状态文案表 = {
  pending: '未开始',
  active: '进行中',
  passed: '已通过',
  ended: '已结束',
} as const satisfies Record<P5阶段区['state'], string>;

/**
 * 未回答 answer 的固定文案（不编造正文）；这四个 answer_status 都不带 text。
 * unknown 对外固定「暂时无法回答」—— 它是一条被记录的回答，不等于同意（冻结合同 §6.1）；
 * incomplete 是技术失败留下的未完成项，同样不等于已解决。
 */
const 未回答文案表 = {
  declined: '已拒绝回答',
  unknown: '暂时无法回答',
  not_available: '暂无可用信息',
  incomplete: '技术原因未完成',
} as const satisfies Record<Exclude<P5回答状态, 'answered'>, string>;

/** 8 个 checklist label 闭词的固定中文（后端确认词表，spec §2.4）；未知 label 整项省略。 */
const 清单文案表 = {
  anonymous_screening_passed: '匿名初筛已通过',
  resume_bound: '简历已绑定',
  resume_parse_ready: '简历已解析',
  resume_disclosed: '简历已披露',
  resume_screened: '简历初筛已完成',
  differences_resolved: '分歧已核对',
  candidate_confirmed: '候选人已确认',
  recruiter_confirmed: '招聘方已确认',
} as const satisfies Record<string, string>;

/**
 * Hosted Agent 失败合同（owner-safe）：两个 code 的安全说明 —— 只描述事实（AI 服务
 * 不可用 / AI 结果无法安全使用），不暴露内部错误词、不暗示「代理处理中」、不提供重试。
 */
const Agent注意文案表 = {
  agent_unavailable: 'AI 服务暂时不可用，本 Case 尚未继续',
  agent_result_invalid: '本次 AI 结果无法安全用于推进 Case',
} as const satisfies Record<P5Agent注意码, string>;

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
  'confirm_intent', 'decline_intent', 'answer_dialogue', 'reconsider',
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
 * over-broad 在交集规则下惰性）。逐行依据：终态恒空；J-PILOT-01（Spec §7）双端 S0 不再
 * 提供人工补事实 —— needs_user 行不再出 respond_fact，review-r1 起也不再出 end_screening
 *（Spec §7 明文「若遇旧 S0 needs_user/human_decision 卡，不自动结束或伪装新终局，明确标为
 * 旧状态待核实、停止该卡交互并交负责人处理」——end_screening 是该卡上的交互，必须停；
 * 旧后端若仍返回这两个动作由交集惰性挡下，人工待核实说明走 注意说明），只剩 passed 行的
 * 邀请二卡（ResumeInvitationPending ⇔ step=awaiting_candidate_resume_invitation，仅此行），
 * running/waiting/attention_required 行落空；S1 waiting 行候选端可出
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
  // review-r1（Spec §7 停止该卡交互）：旧 S0 needs_user/human_decision 行可出动作清空 ——
  // end_screening 不再出卡，待核实说明与禁用输入之外的交互全部停止。
  // v2 的 S0 人工卡就落在这一行（continue / end）；v1 的同一行是旧 needs_user 遗留卡，
  // 按 Spec §7 停止全部交互 —— 版本差异由 本行可出动作 施加，不另立第 18 行。
  ['open', 'anonymous_screening', 'needs_user', ['human_decision'], ['end_screening']],
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
  // S2 三行都可能带 v2 的人工补答卡（s2_answer 待办不绑 status；缺待办由 hook 零控件挡下）
  ['open', 'needs_coordination', 'waiting',
    ['coordinating', 'awaiting_candidate_decision', 'awaiting_recruiter_decision'],
    ['decide_coordination', 'answer_dialogue']],
  ['open', 'needs_coordination', 'needs_user', ['coordinating'], ['decide_coordination', 'answer_dialogue']],
  ['open', 'needs_coordination', 'attention_required', ['coordinating'],
    ['decide_coordination', 'answer_dialogue']],
  ['open', 'intent_confirmation', 'needs_user',
    ['awaiting_confirmations', 'awaiting_candidate_confirmation', 'awaiting_recruiter_confirmation'],
    ['confirm_intent', 'decline_intent']],
  ['ended', 'anonymous_screening', 'ended', ['complete'], []],
  // 七天重新考虑只由 S1 的可恢复结束产生（冻结合同 C1）：只有这一行留该卡，
  // S0/S2/S3 的终局不给恢复入口。这一行的取值刻意与后端 ReconsiderableEnding
  // （matchcase/continuity_deadlines.go）是同一个集合 —— 后端放宽可恢复结束的范围时，
  // 必须同步放宽这里的白名单，否则真给出的卡会被交集惰性挡掉。
  ['ended', 'resume_submission', 'ended', ['complete'], ['reconsider']],
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

/**
 * 展开块的单条公开问答视图：技术字段原样保留，正文按 answer_status 投影。
 * stage/askingRole/round 全部来自服务端记录本身 —— 前端不重排、不重编号、不按位置猜块。
 * answerSource 'human' 是本人写的公开回答（双方可见）。exchangeRef 只在 S1/S2 的 question
 * 与它的 answer 上出现，是人工待办与问答块的不透明引用：只做精确相等比对，绝不解析、
 * 绝不从 id 推导、绝不显示给用户。
 */
export interface P5S0消息视图 {
  id: string;
  kind: 'question' | 'answer';
  role: P5角色;
  stage: P5筛选阶段;
  askingRole: P5角色;
  round: number;
  answerStatus: P5回答状态 | null;
  answerSource: P5回答来源 | null;
  exchangeRef: string | null;
  occurredAt: string;
  内容: string;
}

/** S0 候选私有总结视图：initial 无轮次；标签固定 初评／第 N 轮复评。 */
export interface P5S0总结视图 {
  id: string;
  phase: 'initial' | 'reevaluation';
  round: number | null;
  occurredAt: string;
  标签: string;
  内容: string;
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
  /** S0 展开块的 Agent 问答与候选私有总结：仅展示，永不参与状态/动作判定（S1–S3 恒空）。 */
  Agent消息: readonly P5S0消息视图[];
  Agent总结: readonly P5S0总结视图[];
}

// ── S0–S3 连续筛选（continuity_version 2）的展示视图（冻结合同 §6.2 / C4-C6）──

/** 待办用途的中文说明（闭词表；未知词在 decode 阶段已被拒）。 */
const 待办用途文案表 = {
  s0_continue: '决定是否继续这一单',
  s1_continue: '出具简历初筛结论',
  s2_answer: '回答对方的问题',
  s3_confirm: '确认意向',
} as const satisfies Record<P5待办用途, string>;

/** 到期口径（产品常量 72 小时）：逾期由服务端做到期转换，前端绝不本地推进 Case。 */
export const P5待办到期说明 = '逾期未回应，这一单会自动结束';

/**
 * 一条人工待办的展示：deadline 用服务端绝对时刻（本地时区可读），不做本地倒计时 ——
 * 本地时钟越过它只会禁用提交并等下一次权威重读，绝不由前端改变 Case 生命周期。
 */
export interface P5待办视图 {
  id: string;
  role: P5角色;
  purpose: P5待办用途;
  /** 原始 RFC3339（提交前的过期判定用它，只用于禁用控件）。 */
  deadline: string;
  截止于: string;
  说明: string;
  到期说明: string;
  exchangeRef: string | null;
  summaryVersion: number | null;
}

/**
 * 发问块计数（只属 S1/S2）：当前步骤与轮次分开表达 —— 步骤说明来自服务端 step 闭词
 * （缺席为 null：不显示推测的当前动作，也不从 asking_role 猜执行方）；轮次由服务端唯一
 * 记账，前端不本地加一。awaiting_human 不说明等谁（待办归属唯一读 pending_actions）。
 */
export interface P5对话进度视图 {
  stage: 'resume_submission' | 'needs_coordination';
  当前步骤说明: string | null;
  轮次说明: string;
}

/** S1 七天重新考虑窗口：双方都读得到，但只有招聘端会拿到 reconsider 卡。 */
export interface P5重新考虑视图 {
  可恢复: boolean;
  deadline: string;
  截止于: string;
  说明: string;
}

export interface P5确认总结分节 {
  键: 'confirmed' | 'agreed' | 'unresolved' | 'incomplete';
  标题: string;
  空说明: string;
  条目们: readonly { 编号: string; 文本: string }[];
}

/** S3 固定总结（C6）：双方内容完全相同；确认只表示愿意继续讨论，不代表接受全部条件。 */
export interface P5确认总结视图 {
  version: number;
  含义说明: string;
  分节们: readonly P5确认总结分节[];
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
  /**
   * release/0.2.5（Task 6）：同一响应的权威推荐分（0 合法，null 无溯源，二者不互换）
   * 与 Case 创建时冻结的岗位展示（legacy 显式 null，绝不补读当前 Job）。顶栏分数与
   * 第二 Tab 资料区从这里投影 —— 与 职位（旧四事实）同源，不外查、不拼其它记录。
   */
  匹配分: number | null;
  冻结职位资料: BFF安全职位资料 | null;
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
  阶段区块: readonly P5阶段区块视图[];
  终局摘要: P5终局摘要视图 | null;
  /**
   * Hosted Agent 失败合同：attention_required 行的 owner-safe 说明（missing → 通用
   * 「本阶段需要注意」；非 attention 状态恒 null）。是否需注意由 注意说明 !== null
   * 唯一推导，不保存第二个同源字段。
   */
  注意说明: string | null;
  /** 1 = 历史 Case（绝不发 v2 body）；2 = S0–S3 连续筛选。 */
  continuity版本: 1 | 2;
  /** 本 Case 的全部开放人工待办（双方可见：在等谁、到几时）。 */
  待办们: readonly P5待办视图[];
  对话进度: P5对话进度视图 | null;
  重新考虑: P5重新考虑视图 | null;
  确认总结: P5确认总结视图 | null;
}

/** 契约错误视图：动作表恒空、无移交（与正常视图共享字段名以便联合窄化）。 */
export interface P5详情契约错误视图 {
  kind: '契约错误';
  错误提示: string;
  handoff: null;
  actions: readonly P5动作卡[];
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
  /** release/0.2.5：本查看者的原推荐批次分（recruiter 行才有 wire 成员）；无溯源为 null，不造 0。 */
  匹配分: number | null;
  /** 同 P5详情正常视图.注意说明：attention_required 行的安全说明，其余恒 null。 */
  注意说明: string | null;
  /** 仅已展开 recruiter open 行出现（摘要视图或显式 null）；candidate 行与历史行必缺席。 */
  候选摘要?: 招聘候选摘要视图 | null;
}

export interface P5列表契约错误视图 {
  kind: '契约错误';
  错误提示: string;
}

export type P5列表视图 = P5列表正常视图 | P5列表契约错误视图;

// ── 运行时防线：decode 已挡住的漂移若仍抵达此处，一律 fail closed ──

function 契约错误详情(): P5详情契约错误视图 {
  return { kind: '契约错误', 错误提示: P5契约错误提示, handoff: null, actions: [] };
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

/**
 * 本行在该 continuity 版本下真正可出的动作。唯一版本差异：S0 的 open/needs_user 行 ——
 * v2 是真正的 S0 人工卡（continue / end），v1 是 Spec §7 的旧遗留卡，必须停止该卡交互
 * （只留 注意说明 的待核实提示）。其余行两版同白名单。
 */
function 本行可出动作(行: P5展示状态行, 连续版本: 1 | 2): readonly P5动作[] {
  if (连续版本 === 1 && 行.lifecycle === 'open'
    && 行.stage === 'anonymous_screening' && 行.status === 'needs_user') {
    return [];
  }
  return 行.可出动作;
}

/** 按钮可见性 = 行侧白名单 ∩ available_actions，按 wire 枚举顺序渲染。 */
function 渲染动作卡(offered: readonly P5动作[], 行: P5展示状态行, 连续版本: 1 | 2): P5动作卡[] {
  const 白名单 = 本行可出动作(行, 连续版本);
  return 动作顺序表
    .filter((动作) => offered.includes(动作) && 白名单.includes(动作))
    .map((动作) => {
      const 文案 = 连续版本 === 2 && 已有键(连续决定卡文案表, 动作)
        ? 连续决定卡文案表[动作]
        : 动作卡文案表[动作];
      return { action: 动作, 标题: 文案.标题, 说明: 文案.说明 };
    });
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

/** 绝对时刻的展示格式化器（本 mapper 的 定格于 与待办 截止于 共用，不是通用日期能力）。 */
const 终局时间格式 = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/**
 * RFC3339 → `YYYY-MM-DD HH:mm`（用户运行环境本地时区，不设固定产品时区、
 * 不硬编码加八小时）。用 formatToParts 自己拼分隔符，locale 的排版差异影响不到形状。
 * 异常值（绕过 decoder 抵达这里的）给「时间待确认」——不抛破页面的异常，也不回原文。
 */
function 格式化终局时间(原文: string): string {
  // 非字符串同样会绕过 decoder（与 映射终局摘要 的 typeof 守卫同口径）：
  // new Date(null) / new Date(0) 是合法的 1970 时间，直接格式化等于编造终局时刻。
  if (typeof 原文 !== 'string') return '时间待确认';
  const 时刻 = new Date(原文);
  if (Number.isNaN(时刻.getTime())) return '时间待确认';
  const 段 = 终局时间格式.formatToParts(时刻);
  const 取 = (类型: Intl.DateTimeFormatPartTypes) => 段.find((条) => 条.type === 类型)?.value ?? '';
  const 年 = 取('year');
  const 月 = 取('month');
  const 日 = 取('day');
  const 时 = 取('hour');
  const 分 = 取('minute');
  if ([年, 月, 日, 时, 分].some((值) => 值 === '')) return '时间待确认';
  return `${年}-${月}-${日} ${时}:${分}`;
}

/** 角色的对外称呼（展示用；招聘端看到的候选人仍是去名的「候选人」）。 */
const 角色称呼表 = { candidate: '候选人', recruiter: '招聘方' } as const satisfies Record<P5角色, string>;

/**
 * 一条待办 → 展示视图。说明按「是不是本人的待办」分化：本人的是要你做什么，对端的是
 * 在等谁做什么 —— 对端的卡没有按钮（available_actions 为空），只交代等待对象与截止时刻。
 */
function 映射待办(待办: P5待办, viewer: P5角色): P5待办视图 {
  const 用途 = 待办用途文案表[待办.purpose];
  return {
    id: 待办.id,
    role: 待办.role,
    purpose: 待办.purpose,
    deadline: 待办.deadline,
    截止于: 格式化终局时间(待办.deadline),
    说明: 待办.role === viewer ? `需要你${用途}` : `等待${角色称呼表[待办.role]}${用途}`,
    到期说明: P5待办到期说明,
    exchangeRef: 待办.exchangeRef,
    summaryVersion: 待办.summaryVersion,
  };
}

/**
 * dialogue_progress.step 闭词 → 当前步骤说明（Spec §8B.2）。assessing 是发问侧 Agent 在
 * 判断；answering 的执行方是发问侧的对端 Agent（故按 asking_role 反查）；awaiting_human
 * 不说明具体等谁；complete 只表示本轮问答完成，不是整个 S2 完成、更不触发 S3。
 */
const 对话步骤文案表 = {
  assessing: { recruiter: '招聘 Agent 判断中', candidate: '候选 Agent 判断中' },
  answering: { recruiter: '候选 Agent 回答中', candidate: '招聘 Agent 回答中' },
  awaiting_human: '等待真人补充回答',
  complete: '本轮问答已完成',
} as const satisfies Record<P5对话步骤, unknown>;

/** 发问块计数 → 分离的当前步骤/轮次说明（服务端唯一记账；前端不本地加一、不猜执行方）。 */
function 映射对话进度(进度: P5对话进度 | null): P5对话进度视图 | null {
  if (进度 === null) return null;
  const 本侧轮 = 进度.askingRole === 'recruiter' ? 进度.recruiterRound : 进度.candidateRound;
  const 步骤 = 进度.step;
  return {
    stage: 进度.stage,
    当前步骤说明: 步骤 === null
      ? null
      : 步骤 === 'assessing' || 步骤 === 'answering'
        ? 对话步骤文案表[步骤][进度.askingRole]
        : 对话步骤文案表[步骤],
    轮次说明: `${角色称呼表[进度.askingRole]}已问 ${本侧轮}/${进度.roundBudget} 轮`,
  };
}

/** GET 只会给出 expired / case_unavailable 两个非空词（另两个只作命令 409 码）。 */
const 重新考虑不可用文案表 = {
  expired: '七天重新考虑窗口已过',
  case_unavailable: '这一单目前不能恢复',
} as const;

/**
 * 七天窗口的展示投影（S0–S3 展示统一 Task 4 加 viewer 口径）：候选端没有该按钮，
 * 中性说明点名动作归属（招聘方），不把窗口读成候选人可做的事。它只描述服务端给的
 * 窗口，不判定资格 —— 是否出卡由 available_actions ∩ 行白名单决定，而那一行的集合
 * 与后端 ReconsiderableEnding（matchcase/continuity_deadlines.go）必须同进同退
 * （见 矩阵元组表 的同名注释）。
 */
function 映射重新考虑(块: P5重新考虑 | null, viewer: P5角色): P5重新考虑视图 | null {
  if (块 === null) return null;
  const 截止于 = 格式化终局时间(块.deadline);
  const 原因 = 块.unavailableReason;
  return {
    可恢复: 块.eligible,
    deadline: 块.deadline,
    截止于,
    说明: 块.eligible
      ? viewer === 'candidate'
        ? `招聘方可在 ${截止于} 前重新考虑这一单`
        : `可在 ${截止于} 前重新考虑这一单`
      : 原因 !== null && 已有键(重新考虑不可用文案表, 原因)
        ? 重新考虑不可用文案表[原因]
        : '这一单目前不能恢复',
  };
}

/** C6 四个分节的固定标题与空态说明（继续/确认都不是接受证据，所以「安排」合法为空）。
 *  confirmed 是「公开记录中已有回答依据的事项」（Spec §8B.4）：回答可来自 Agent 或真人，
 *  不表示真人确认、双方接受或条件达成一致，故标题统一「已回答事项」。 */
const 确认分节文案表 = [
  { 键: 'confirmed' as const, 标题: '已回答事项', 空说明: '暂无已回答事项' },
  { 键: 'agreed' as const, 标题: '已达成的安排', 空说明: '没有双方公开接受的安排（继续或确认都不是接受证据）' },
  { 键: 'unresolved' as const, 标题: '仍未解决', 空说明: '暂无未决事项' },
  { 键: 'incomplete' as const, 标题: '未完成', 空说明: '没有因技术原因未完成的事项' },
];

/** confirmation_meaning 的唯一闭词 → 冻结中文（确认不等于接受全部条件）。 */
const 确认含义文案表 = {
  continue_discussion_without_accepting_all_terms:
    '确认表示你愿意继续讨论，不代表接受全部条件',
} as const;

function 映射确认总结(总结: P5确认总结 | null): P5确认总结视图 | null {
  if (总结 === null) return null;
  const 分组 = {
    confirmed: 总结.confirmedFacts.map((条, 序) => ({ 编号: `confirmed:${序}`, 文本: 条.text })),
    agreed: 总结.agreedArrangements.map((条, 序) => ({ 编号: `agreed:${序}`, 文本: 条.text })),
    unresolved: 总结.unresolvedItems.map((条) => ({ 编号: `unresolved:${条.ref}`, 文本: 条.text })),
    incomplete: 总结.incompleteItems.map((条) => ({ 编号: `incomplete:${条.ref}`, 文本: 条.text })),
  };
  return {
    version: 总结.version,
    含义说明: 确认含义文案表[总结.confirmationMeaning],
    分节们: 确认分节文案表.map((节) => ({ ...节, 条目们: 分组[节.键] })),
  };
}

function 映射终局摘要(摘要: P5终局摘要 | null): P5终局摘要视图 | null {
  if (摘要 === null || typeof 摘要 !== 'object') return null;
  // 内部 DTO 仍保留原始 RFC3339；只有这个展示槽换成本地可读值
  if (摘要.outcome === '') {
    // completed（decoder 钉 outcome/reason 为空串）的成功事实不由 outcome 猜：摘要留空，
    // 成功口径由移交槽表达（代谈终局文案 只管 ended 终局）。
    return { 结束语: '', 原因: '', 定格于: 格式化终局时间(摘要.finalizedAt) };
  }
  // ended 终局按 Spec 附录 A.2.1 字典（代谈结果文案）投影胶囊状态文 + 一句原因
  //（已知安全 code 细化、同义去重），原始 outcome/reason 码不进展示槽。
  const 文案 = 代谈终局文案(摘要.outcome, 摘要.reasonSummary);
  return { 结束语: 文案.状态文, 原因: 文案.原因, 定格于: 格式化终局时间(摘要.finalizedAt) };
}

// ── J-PILOT-01（Spec §7）：双端 S0 保留原输入框与发送键、禁用，占位随真实阶段/结果 ──
// 委托前的初评占位（尚未开案）由 连续代谈展示映射 产出；此处只管已开 Case 的 S0 行。

/** S0 信息不足终局的底栏占位文案（终局摘要的胶囊/原因归 代谈结果文案 字典；原始码不露）。 */
export const S0信息不足终局文案 = '信息不足，未能确认条件';

const S0底栏文案表 = {
  运行中: '双方 AI 代理正在确认条件',
  技术故障: '条件确认遇到问题，待排查',
  不适配: '条件不适配，本次代谈已结束',
  其它终局: '本次代谈已结束',
} as const;

/**
 * S0（匿名初筛）的底栏禁用说明／占位：非 S0 返回 null（其余阶段走既有叮嘱输入或
 * 终局只读口径）。open 行按状态区分运行中与 AI 技术故障（attention）；ended 行按
 * 顶格 outcome 区分信息不足／不适配／其它终局（原因在现有结果区显示，不承诺刷新重跑）。
 */
export function 映射S0底栏说明(state: P5状态视图): string | null {
  if (state.stage !== 'anonymous_screening') return null;
  if (state.lifecycle === 'open') {
    return state.status === 'attention_required' ? S0底栏文案表.技术故障 : S0底栏文案表.运行中;
  }
  if (state.outcome === 'semantic_uncertain_stop') return S0信息不足终局文案;
  if (state.outcome === 'semantic_not_fit') return S0底栏文案表.不适配;
  return S0底栏文案表.其它终局;
}

/**
 * attention_required 行的 owner-safe 说明：missing（legacy）给通用「本阶段需要注意」，
 * 已知 code 给安全文案；非 attention 状态恒 null（不读 agentAttention 块）。
 */
function 映射Agent注意(state: P5状态视图): string | null {
  if (state.status !== 'attention_required') return null;
  return state.agentAttention === null
    ? '本阶段需要注意'
    : Agent注意文案表[state.agentAttention.code];
}

/** 旧 S0 needs_user／human_decision 的 owner-safe 待核实说明（Spec §7）：不自动结束、
 *  不伪装新终局，停止该卡交互并交负责人处理。 */
const 旧S0待核实说明 = '旧版状态待核实，请交负责人处理';

/** 详情视图的注意说明：旧 S0 needs_user（人工补事实遗留行）固定给待核实提示，
 *  其余沿 attention 的 owner-safe 口径。 */
function 映射详情注意说明(state: P5状态视图, 连续版本: 1 | 2): string | null {
  // v2 的同一行是真正的 S0 人工卡（有 continue/end 可做），不是旧遗留待核实状态。
  if (连续版本 === 1 && state.lifecycle === 'open' && state.stage === 'anonymous_screening'
    && state.status === 'needs_user') {
    return 旧S0待核实说明;
  }
  return 映射Agent注意(state);
}

function 已有键<T extends object>(表: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(表, key);
}

/**
 * 阶段区 summary 的纯展示 allowlist：公开 OpenAPI 仍是 string（decoder 不收紧），
 * 已知 step word 复用步骤说明表；空串用阶段状态中性文案；未知非空词显示安全兜底，
 * 原样 token 绝不进视图/DOM。不参与任何状态/动作判定。
 */
function 映射阶段摘要(summary: string, state: P5阶段区['state']): string {
  if (summary === '') return 阶段区状态文案表[state];
  return 已有键(步骤说明表, summary) ? 步骤说明表[summary] : '阶段信息待更新';
}

/**
 * checklist label 的纯展示 allowlist：未知 label 整项省略（避免多条不可区分的伪清单）。
 * 唯一语境差异（Spec §A.7）：终局段 + semantic_not_fit + resume_screened 未完成 →
 * 「简历初筛未通过」（由 ended+semantic_not_fit 与 checklist 联合决定，不把所有 false
 * 通用翻译为未通过）；其余照旧。是否终局未通过由调用方按权威 state 判定传入。
 */
function 映射清单(checklist: P5阶段区['checklist'], 初筛未通过: boolean) {
  return checklist.flatMap((项) => {
    if (!已有键(清单文案表, 项.label)) return [];
    const 初筛行 = 项.label === 'resume_screened' && !项.done && 初筛未通过;
    return [{ 文本: 初筛行 ? '简历初筛未通过' : 清单文案表[项.label], 完成: 项.done }];
  });
}

/** S0 单条问答的投影：question／answered answer 取原 text，未回答查文案表，不编造正文。 */
function 映射S0消息(消息: P5S0筛选消息): P5S0消息视图 {
  return {
    id: 消息.id,
    kind: 消息.kind,
    role: 消息.role,
    stage: 消息.stage,
    askingRole: 消息.askingRole,
    round: 消息.round,
    answerStatus: 消息.kind === 'answer' ? 消息.answerStatus : null,
    answerSource: 消息.kind === 'answer' ? 消息.answerSource : null,
    exchangeRef: 消息.exchangeRef,
    occurredAt: 消息.occurredAt,
    内容: 消息.kind === 'question'
      ? 消息.text
      : 消息.answerStatus === 'answered' ? 消息.text : 未回答文案表[消息.answerStatus],
  };
}

/** S0 单条总结的投影：原文照搬，标签只由 phase/round 推出，不显示总结时间。 */
function 映射S0总结(总结: P5S0筛选总结): P5S0总结视图 {
  return {
    id: 总结.id,
    phase: 总结.phase,
    round: 总结.phase === 'initial' ? null : 总结.round,
    occurredAt: 总结.occurredAt,
    标签: 总结.phase === 'initial' ? '初评' : `第 ${总结.round} 轮复评`,
    内容: 总结.summary,
  };
}

/**
 * 阶段区状态文案：默认走 阶段区状态文案表；唯一例外是终局段 —— Case 结束所在段（区
 * state=ended）按 Spec 附录 A.2.1 的 outcome 七闭表给阶段胶囊（不匹配/未通过/信息不足/
 * 筛选未完成/逾期结束/已结束），未知词安全兜底 已结束。只读权威 outcome，不读阶段区
 * summary，也不是通用 outcome 翻译器；结束原因一句归段内小结（详情展示映射）。
 */
function 映射阶段区状态(区: P5阶段区, state: P5状态视图): string {
  if (区.state === 'ended' && state.lifecycle === 'ended') {
    return 代谈终局文案(state.outcome, null).状态文;
  }
  return 阶段区状态文案表[区.state];
}

/**
 * 阶段区 → 区块视图。S0 展开块只属于 S0、且招聘端总结必空（decoder 已挡，映射层再守一道），
 * 漂移时返回 null 交由调用方 fail closed，绝不静默过滤。Agent 记录只作展示，不写入旧 摘要，
 * 旧 清单/时间线/叮嘱/附件 语义不变。
 */
function 映射阶段区(
  区: P5阶段区,
  state: P5状态视图,
  viewer: P5角色,
  记录: P5S0筛选记录 | null,
): P5阶段区块视图 | null {
  // wire 只把整包记录挂在 S0 区（冻结合同 §6.5）；其余段携带即漂移。
  if (区.stage !== 'anonymous_screening' && 区.screeningRecords !== null) return null;
  if (viewer === 'recruiter' && (记录?.summaries.length ?? 0) > 0) return null;
  // 每条记录自述属于哪个发问块：按真实 stage 落到对应阶段段（S3 段天然没有公开问答）。
  const 本段消息 = 记录 === null
    ? []
    : 记录.messages.filter((条) => 条.stage === 区.stage);
  return {
    stage: 区.stage,
    标题: 阶段标题表[区.stage],
    状态: 区.state,
    状态文案: 映射阶段区状态(区, state),
    发生于: 区.occurredAt,
    摘要: 映射阶段摘要(区.summary, 区.state),
    // 终局段 + semantic_not_fit：简历初筛行给「简历初筛未通过」（Spec §A.7 联合判定）
    清单: 映射清单(区.checklist, 区.state === 'ended' && state.outcome === 'semantic_not_fit'),
    时间线: 区.transcript,
    叮嘱: 区.instructionReceipts,
    附件: 区.attachment,
    Agent消息: 本段消息.map(映射S0消息),
    // 初评/复评小结只属 S0，且只有候选本人的详情带（decoder 已挡，映射层再守一道）
    Agent总结: 记录 === null || 区.stage !== 'anonymous_screening'
      ? []
      : 记录.summaries.map(映射S0总结),
  };
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
  let 候选摘要: 招聘候选摘要视图 | null | undefined;
  if (item.role === 'candidate') {
    if (typeof item.intentionId !== 'string' || item.intentionId === '') return 契约错误列表();
    intentionId = item.intentionId;
  } else if (item.role === 'recruiter') {
    if (typeof item.candidateAlias !== 'string') return 契约错误列表();
    candidateAlias = item.candidateAlias;
    // 仅已展开 recruiter open 行有键：视图区分「未请求」与「请求后显式 null」
    候选摘要 = item.candidateSummary === undefined ? undefined : 映射招聘候选摘要(item.candidateSummary);
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
    // match_score 只在 recruiter 行上；candidate 行的 Case 无该 wire 成员，恒 null
    匹配分: item.role === 'recruiter' ? item.matchScore : null,
    注意说明: 映射Agent注意(state),
    ...(候选摘要 === undefined ? {} : { 候选摘要 }),
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
  // 终态零动作 —— 唯一例外是 S1 七天重新考虑：终局 Case 仍可带这一张卡（§6.3），
  // 它本身不改 needs_action（终局恒 false）。
  if (行.lifecycle !== 'open' && offered.some((动作) => 动作 !== 'reconsider')) {
    return 契约错误详情();
  }

  // 四阶段区固定 S0→S3。
  const 区组 = detail.stages;
  if (!Array.isArray(区组) || 区组.length !== 4) return 契约错误详情();
  for (let 下标 = 0; 下标 < 4; 下标 += 1) {
    if (区组[下标]?.stage !== 阶段顺序表[下标]) return 契约错误详情();
  }

  const 职位 = 映射职位(detail.context.job);
  if (职位 === null) return 契约错误详情();

  // 阶段区块：S0 展开块归属漂移（S1–S3 非空 records / 招聘端非空总结）fail closed。
  // 公开问答记录整包挂在 S0 区（§6.5），按每条自述的 stage 分发到对应阶段段。
  const 记录 = 区组[0].screeningRecords;
  const 区块: P5阶段区块视图[] = [];
  for (const 区 of 区组) {
    const 区块视图 = 映射阶段区(区, state, detail.role, 记录);
    if (区块视图 === null) return 契约错误详情();
    区块.push(区块视图);
  }

  // 按钮可见性 = 行白名单 ∩ available_actions（交集，绝不加、绝不 infer）。
  // J-PILOT-01（Spec §7）：S0 行白名单已不再含 respond_fact；review-r1 起旧 S0 needs_user
  // 行也不含 end_screening（停止该卡交互）—— 双端零人工补事实输入，旧后端若仍返回这些
  // 动作由交集惰性挡下；人工待核实说明走 注意说明。
  const 动作卡 = 渲染动作卡(offered, 行, detail.continuityVersion);

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
    // 同一响应的权威分与冻结岗位展示原样透传（顶栏分数与资料区同源；不外查）
    匹配分: detail.matchScore,
    冻结职位资料: detail.jobDetail,
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
    阶段区块: 区块,
    终局摘要: 映射终局摘要(detail.terminalSummary),
    注意说明: 映射详情注意说明(state, detail.continuityVersion),
    continuity版本: detail.continuityVersion,
    // 终局 Case 没有开放待办（§6.3：终局 needs_action 恒 false）—— 终局卡绝不把对端
    // 显示成「待回应」，哪怕上游留下了过期条目。
    待办们: 行.lifecycle === 'open'
      ? detail.pendingActions.map((待办) => 映射待办(待办, detail.role))
      : [],
    对话进度: 映射对话进度(detail.dialogueProgress),
    重新考虑: 映射重新考虑(detail.reconsideration, detail.role),
    确认总结: 映射确认总结(detail.confirmationSummary),
  };
}
