// MatchCase 域数据源：BFF /api/v1 的 P5 双端（候选 me / 招聘 recruiter）match-cases ——
// open 工作区、ended/completed 历史架子、四阶段详情、S0–S3 命令、Case 叮嘱与披露后的
// 原始简历 PDF。第十一个域 facade：协议代码（path / method / body / 调用方幂等键 /
// GET 不缓存）按已准入 P5 冻结契约实现。每个响应先 strict decode（exact key set、
// 闭合 enum、17 行 lifecycle+stage+status→step 状态矩阵、viewer 专属 available_actions、
// 四阶段区固定 S0→S3、条件可空块只接受缺席），不 `as` 直转；接口失败绝不回退 Mock。
// 本模块不 import React 或 Mock。mutation 一律 void：权威态由调用方的 detail 重读提供。

import { BFF错误 } from '../HTTP客户端';
import type { BFF二进制响应, BFF客户端 } from '../HTTP客户端';
import type {
  P5动作,
  P5历史生命周期,
  P5生命周期,
  P5阶段,
  P5状态,
  P5角色,
  P5步骤,
} from '../BFF契约';

export type { P5角色, P5历史生命周期, P5步骤, P5动作 } from '../BFF契约';

const P5前缀 = { candidate: '/api/v1/me', recruiter: '/api/v1/recruiter' } as const;
const 游标模式 = /^[A-Za-z0-9_-]+$/;
/** P7 发布会话坐标的闭合模式（与 真人会话.ts 的发布坐标同款，1–64 位十进制）。 */
const 会话坐标模式 = /^[1-9][0-9]{0,63}$/;
const 意向ID模式 = /^int_[0-9a-f]{32}$/;
const 职位ID模式 = /^job_[0-9a-f]{32}$/;
const 候选别名模式 = /^candidate-[0-9a-f]{12}$/;
const 协同问题ID模式 = /^cdi_[0-9a-f]{32}$/;
const 简历文件ID模式 = /^rf_[0-9a-f]{32}$/;
const 简历版本ID模式 = /^rfv_[0-9a-f]{32}$/;

function 契约错误(message = '服务返回了不符合契约的 MatchCase 数据'): BFF错误 {
  return new BFF错误(200, 'invalid_response', message);
}

// ── 本域小 guard：与 发现推荐.ts / 附件简历.ts 同一闭合纪律；本域统一 status=200 的 invalid_response ──

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：缺必需键或多出未知键（可选键仅按白名单放行）都按契约漂移 fail closed。 */
function 要求闭合对象(
  input: unknown,
  必需键: readonly string[],
  可选键: readonly string[] = [],
): Record<string, unknown> {
  if (!是记录(input)) throw 契约错误();
  for (const 键 of 必需键) if (!(键 in input)) throw 契约错误();
  const 允许键 = new Set([...必需键, ...可选键]);
  for (const 键 of Object.keys(input)) if (!允许键.has(键)) throw 契约错误();
  return input;
}

function 要求字符串(值: unknown): string {
  if (typeof 值 !== 'string') throw 契约错误();
  return 值;
}

/** 不透明 ID 一律要求非空；声明了 pattern 的 ID 再过 要求模式串。 */
function 要求非空字符串(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (字符串.length === 0) throw 契约错误();
  return 字符串;
}

/** OpenAPI 声明了 pattern 的响应 ID：非空且形状匹配，二者缺一即契约漂移。 */
function 要求模式串(值: unknown, 模式: RegExp): string {
  const 字符串 = 要求非空字符串(值);
  if (!模式.test(字符串)) throw 契约错误();
  return 字符串;
}

function 要求可空字符串(值: unknown): string | null {
  if (值 === null) return null;
  return 要求字符串(值);
}

function 要求布尔(值: unknown): boolean {
  if (typeof 值 !== 'boolean') throw 契约错误();
  return 值;
}

function 要求数组(值: unknown): unknown[] {
  if (!Array.isArray(值)) throw 契约错误();
  return 值;
}

function 要求枚举<T extends string>(值: unknown, 取值: readonly T[]): T {
  if (typeof 值 !== 'string') throw 契约错误();
  for (const 候选 of 取值) if (候选 === 值) return 候选;
  throw 契约错误();
}

/** OpenAPI integer：安全整数；带界字段再过 要求范围整数。 */
function 要求整数(值: unknown): number {
  if (typeof 值 !== 'number' || !Number.isSafeInteger(值)) throw 契约错误();
  return 值;
}

function 要求范围整数(值: unknown, 最小: number, 最大: number): number {
  const 整数 = 要求整数(值);
  if (整数 < 最小 || 整数 > 最大) throw 契约错误();
  return 整数;
}

const RFC3339模式 = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

/** MatchCase 时间戳按 OpenAPI 声明为 RFC 3339 UTC；形状或可解析性不对都拒绝。 */
function 要求RFC3339(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (!RFC3339模式.test(字符串) || Number.isNaN(Date.parse(字符串))) throw 契约错误();
  return 字符串;
}

function 要求可空RFC3339(值: unknown): string | null {
  if (值 === null) return null;
  return 要求RFC3339(值);
}

// ── 闭合 vocabulary（与 mobile-v1 OpenAPI 一一对应）──

const 生命周期全表 = ['open', 'ended', 'completed'] as const satisfies readonly P5生命周期[];
const 阶段全表 = [
  'anonymous_screening', 'resume_submission', 'needs_coordination', 'intent_confirmation',
] as const satisfies readonly P5阶段[];
const 状态全表 = [
  'running', 'needs_user', 'passed', 'attention_required', 'ended', 'waiting',
] as const satisfies readonly P5状态[];
const 步骤全表 = [
  'policy_check', 'candidate_evaluation', 'candidate_question', 'recruiter_answer',
  'candidate_reevaluation', 'human_decision', 'complete',
  'awaiting_candidate_resume_invitation', 'awaiting_resume_parse', 'screening_resume',
  'awaiting_recruiter_decision', 'coordinating', 'awaiting_candidate_decision',
  'awaiting_confirmations', 'awaiting_candidate_confirmation', 'awaiting_recruiter_confirmation',
  'handoff_pending',
] as const satisfies readonly P5步骤[];
const 动作全表 = [
  'respond_fact', 'end_screening', 'accept_resume_invitation', 'decline_resume_invitation',
  'retry_resume_readiness', 'replace_resume', 'decide_resume_screening', 'decide_coordination',
  'confirm_intent', 'decline_intent',
] as const satisfies readonly P5动作[];
const 阶段区状态全表 = ['pending', 'active', 'passed', 'ended'] as const;
const 时间线角色全表 = ['', 'candidate', 'recruiter'] as const;
const 叮嘱主人全表 = ['candidate', 'recruiter'] as const satisfies readonly P5角色[];
const 协同类目全表 = [
  'work_mode', 'work_schedule', 'travel', 'team_and_reporting', 'technical_direction',
] as const;
const 意向词全表 = ['', 'confirm', 'decline'] as const;

/** 详情四个阶段区的固定 S0→S3 顺序（严格客户端同款）：数量与顺序都不可漂。 */
const 阶段顺序 = ['anonymous_screening', 'resume_submission', 'needs_coordination', 'intent_confirmation'] as const;

/**
 * 已准入的 17 行 lifecycle+stage+status→steps 状态矩阵（decode 权威，与
 * matchcase-state-matrix.json 同源）：合法 step 落错行、未知词、completed+complete、
 * open+handoff_pending 等一切矩阵外四元组都按契约漂移 fail closed。
 */
const 状态矩阵行: readonly (readonly [P5生命周期, P5阶段, P5状态, readonly P5步骤[]])[] = [
  ['open', 'anonymous_screening', 'running',
    ['policy_check', 'candidate_evaluation', 'candidate_question', 'recruiter_answer', 'candidate_reevaluation']],
  ['open', 'anonymous_screening', 'waiting', ['candidate_reevaluation']],
  ['open', 'anonymous_screening', 'needs_user', ['human_decision']],
  ['open', 'anonymous_screening', 'passed',
    ['complete', 'awaiting_candidate_resume_invitation', 'awaiting_resume_parse']],
  ['open', 'anonymous_screening', 'attention_required',
    ['candidate_evaluation', 'candidate_question', 'recruiter_answer', 'candidate_reevaluation']],
  ['open', 'resume_submission', 'waiting', ['awaiting_resume_parse', 'screening_resume']],
  ['open', 'resume_submission', 'needs_user', ['awaiting_resume_parse', 'awaiting_recruiter_decision']],
  ['open', 'resume_submission', 'attention_required', ['screening_resume']],
  ['open', 'needs_coordination', 'waiting',
    ['coordinating', 'awaiting_candidate_decision', 'awaiting_recruiter_decision']],
  ['open', 'needs_coordination', 'needs_user', ['coordinating']],
  ['open', 'needs_coordination', 'attention_required', ['coordinating']],
  ['open', 'intent_confirmation', 'needs_user',
    ['awaiting_confirmations', 'awaiting_candidate_confirmation', 'awaiting_recruiter_confirmation']],
  ['ended', 'anonymous_screening', 'ended', ['complete']],
  ['ended', 'resume_submission', 'ended', ['complete']],
  ['ended', 'needs_coordination', 'ended', ['complete']],
  ['ended', 'intent_confirmation', 'ended', ['complete']],
  // P7 Task 6：completed 行两步移交 —— handoff_pending（ref 必缺席）与 complete（ref 必在场）
  ['completed', 'intent_confirmation', 'passed', ['handoff_pending', 'complete']],
];

const 矩阵索引 = new Map(
  状态矩阵行.map(([lifecycle, stage, status, steps]) => [`${lifecycle}|${stage}|${status}`, steps]),
);

/** viewer 专属动作归属：S1 筛选卡归招聘端，邀请/重试/重选卡归候选端，其余双端。 */
const 动作归属: Record<P5动作, P5角色 | '双端'> = {
  respond_fact: '双端',
  end_screening: '双端',
  accept_resume_invitation: 'candidate',
  decline_resume_invitation: 'candidate',
  retry_resume_readiness: 'candidate',
  replace_resume: 'candidate',
  decide_resume_screening: 'recruiter',
  decide_coordination: '双端',
  confirm_intent: '双端',
  decline_intent: '双端',
};

// ── 归一化 DTO：保留 wire 值，候选/招聘上下文走不同分支，跨角色可选字段进不了 UI ──

/** MatchCaseWorkspaceJob：Case 创建时冻结的公开职位四事实快照，不触发额外 GET。 */
export interface P5工作区职位 {
  jobId: string;
  job: {
    title: string;
    location: string;
    publicSalaryRange: string;
    requiredSkills: string[];
  };
}

export interface P5状态视图 {
  caseId: string;
  lifecycle: P5生命周期;
  stage: P5阶段;
  status: P5状态;
  step: P5步骤;
  round: number;
  roundBudget: number;
  needsUser: boolean;
  outcome: string | null;
  outcomeCode: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  agentAttention?: {
    code: 'agent_unavailable' | 'agent_result_invalid';
    retryable: false;
  } | null;
}

export interface P5清单项 { label: string; done: boolean }

export interface P5时间线项 {
  eventId: string;
  stage: P5阶段;
  kind: string;
  role: '' | P5角色;
  reasonCode?: string;
  ref?: string;
  text?: string;
  occurredAt: string;
}

export interface P5叮嘱回执 {
  instructionId: string;
  owner: P5角色;
  stage: P5阶段;
  expression?: string;
  occurredAt: string;
}

export interface P5简历附件 {
  fileId: string;
  fileVersionId: string;
  displayName: string;
}

export interface P5阶段区 {
  stage: P5阶段;
  state: 'pending' | 'active' | 'passed' | 'ended';
  occurredAt: string | null;
  summary: string;
  checklist: P5清单项[];
  transcript: P5时间线项[];
  instructionReceipts: P5叮嘱回执[];
  attachment: P5简历附件 | null;
}

export interface P5协同 {
  issueId: string;
  kind: 'work_mode' | 'work_schedule' | 'travel' | 'team_and_reporting' | 'technical_direction';
  requiredRoles: P5角色[];
  candidateDecided: boolean;
  recruiterDecided: boolean;
}

export interface P5意向确认 {
  candidate: '' | 'confirm' | 'decline';
  recruiter: '' | 'confirm' | 'decline';
}

export interface P5终局摘要 {
  stage: P5阶段;
  outcome: string;
  reasonSummary: string;
  finalizedAt: string;
}

interface P5详情主体 {
  state: P5状态视图;
  needsAction: boolean;
  availableActions: P5动作[];
  stages: P5阶段区[];
  currentCoordination: P5协同 | null;
  intentConfirmations: P5意向确认;
  terminalSummary: P5终局摘要 | null;
  /**
   * P7 Task 6：已发布会话坐标 —— 仅 completed + complete 详情非 null（wire 必在场且
   * 规范）；handoff_pending / open / ended 归一为 null。列表/历史行不携带该字段。
   */
  conversationRef: string | null;
}

export type P5详情 =
  | (P5详情主体 & { role: 'candidate'; context: { intentionId: string; job: P5工作区职位 } })
  | (P5详情主体 & { role: 'recruiter'; context: { candidateAlias: string; job: P5工作区职位 } });

interface P5列表项主体 {
  state: P5状态视图;
  needsAction: boolean;
  job: P5工作区职位;
}

export type P5列表项 =
  | (P5列表项主体 & { role: 'candidate'; intentionId: string })
  | (P5列表项主体 & { role: 'recruiter'; candidateAlias: string });

export interface P5列表页 {
  role: P5角色;
  items: P5列表项[];
  nextCursor: string | null;
}

// ── 具体 decoder：逐字段过 guard，不做 `as` 直转 ──

/** MatchCaseView：矩阵四元组、needs_user 镜像、round 预算与生命周期↔终局列组合全部闭合。 */
function 解P5状态视图(input: unknown): P5状态视图 {
  const raw = 要求闭合对象(input, [
    'case_id', 'lifecycle', 'stage', 'status', 'step', 'round', 'round_budget',
    'needs_user', 'outcome', 'outcome_code', 'created_at', 'updated_at',
  ], ['finalized_at', 'agent_attention']);
  const lifecycle = 要求枚举(raw.lifecycle, 生命周期全表);
  const stage = 要求枚举(raw.stage, 阶段全表);
  const status = 要求枚举(raw.status, 状态全表);
  const step = 要求枚举(raw.step, 步骤全表);
  const 合法步骤 = 矩阵索引.get(`${lifecycle}|${stage}|${status}`);
  if (合法步骤 === undefined || !合法步骤.includes(step)) throw 契约错误();
  const round = 要求范围整数(raw.round, 0, Infinity);
  const roundBudget = 要求范围整数(raw.round_budget, 0, Infinity);
  if (round > roundBudget) throw 契约错误();
  const needsUser = 要求布尔(raw.needs_user);
  if (needsUser !== (status === 'needs_user')) throw 契约错误();
  const outcome = 要求可空字符串(raw.outcome);
  const outcomeCode = 要求可空字符串(raw.outcome_code);
  const finalizedAt = raw.finalized_at === undefined ? null : 要求可空RFC3339(raw.finalized_at);
  let agentAttention: P5状态视图['agentAttention'] = null;
  if (raw.agent_attention !== undefined) {
    const attention = 要求闭合对象(raw.agent_attention, ['code', 'retryable']);
    const retryable = 要求布尔(attention.retryable);
    if (retryable !== false) throw 契约错误();
    agentAttention = {
      code: 要求枚举(attention.code, ['agent_unavailable', 'agent_result_invalid']),
      retryable: false,
    };
  }
  if ((status === 'attention_required') !== (agentAttention !== null)) throw 契约错误();
  // 终局列组合：open 三列全空，ended 三列齐备，completed 只留 finalized_at（严格客户端同款）。
  if (lifecycle === 'open' && (outcome !== null || outcomeCode !== null || finalizedAt !== null)) {
    throw 契约错误();
  }
  if (lifecycle === 'ended' && (outcome === null || outcomeCode === null || finalizedAt === null)) {
    throw 契约错误();
  }
  if (lifecycle === 'completed' && (outcome !== null || outcomeCode !== null || finalizedAt === null)) {
    throw 契约错误();
  }
  return {
    caseId: 要求非空字符串(raw.case_id),
    lifecycle,
    stage,
    status,
    step,
    round,
    roundBudget,
    needsUser,
    outcome,
    outcomeCode,
    createdAt: 要求RFC3339(raw.created_at),
    updatedAt: 要求RFC3339(raw.updated_at),
    finalizedAt,
    agentAttention,
  };
}

function 解工作区职位(input: unknown): P5工作区职位 {
  const raw = 要求闭合对象(input, ['job_id', 'job']);
  const 职位 = 要求闭合对象(raw.job, ['title', 'location', 'public_salary_range', 'required_skills']);
  const 技能 = 要求数组(职位.required_skills).map(要求字符串);
  // required_skills 声明 minItems 1 / maxItems 64
  if (技能.length < 1 || 技能.length > 64) throw 契约错误();
  return {
    jobId: 要求模式串(raw.job_id, 职位ID模式),
    job: {
      title: 要求字符串(职位.title),
      location: 要求字符串(职位.location),
      publicSalaryRange: 要求字符串(职位.public_salary_range),
      requiredSkills: 技能,
    },
  };
}

function 解清单项(input: unknown): P5清单项 {
  const raw = 要求闭合对象(input, ['label', 'done']);
  return { label: 要求字符串(raw.label), done: 要求布尔(raw.done) };
}

/** transcript 事件只能属于它所在的阶段区；role 是 ''/candidate/recruiter 闭词。 */
function 解时间线项(input: unknown, 区阶段: P5阶段): P5时间线项 {
  const raw = 要求闭合对象(input, ['event_id', 'stage', 'kind', 'role', 'occurred_at'], ['reason_code', 'ref', 'text']);
  const stage = 要求枚举(raw.stage, 阶段全表);
  if (stage !== 区阶段) throw 契约错误();
  const 项: P5时间线项 = {
    eventId: 要求非空字符串(raw.event_id),
    stage,
    kind: 要求字符串(raw.kind),
    role: 要求枚举(raw.role, 时间线角色全表),
    occurredAt: 要求RFC3339(raw.occurred_at),
  };
  if (raw.reason_code !== undefined) 项.reasonCode = 要求字符串(raw.reason_code);
  if (raw.ref !== undefined) 项.ref = 要求字符串(raw.ref);
  if (raw.text !== undefined) 项.text = 要求字符串(raw.text);
  return 项;
}

function 解叮嘱回执(input: unknown): P5叮嘱回执 {
  const raw = 要求闭合对象(input, ['instruction_id', 'owner', 'stage', 'occurred_at'], ['expression']);
  const 回执: P5叮嘱回执 = {
    instructionId: 要求非空字符串(raw.instruction_id),
    owner: 要求枚举(raw.owner, 叮嘱主人全表),
    stage: 要求枚举(raw.stage, 阶段全表),
    occurredAt: 要求RFC3339(raw.occurred_at),
  };
  if (raw.expression !== undefined) 回执.expression = 要求字符串(raw.expression);
  return 回执;
}

function 解简历附件(input: unknown): P5简历附件 {
  const raw = 要求闭合对象(input, ['file_id', 'file_version_id', 'display_name']);
  return {
    fileId: 要求模式串(raw.file_id, 简历文件ID模式),
    fileVersionId: 要求模式串(raw.file_version_id, 简历版本ID模式),
    displayName: 要求字符串(raw.display_name),
  };
}

/** 阶段区：三个必在数组不接受 null；attachment 坐标闭合，招聘端的匿名初筛区不得携带。 */
function 解P5阶段区(input: unknown, viewer: P5角色): P5阶段区 {
  const raw = 要求闭合对象(
    input,
    ['stage', 'state', 'summary', 'checklist', 'transcript', 'instruction_receipts'],
    ['occurred_at', 'attachment'],
  );
  const stage = 要求枚举(raw.stage, 阶段全表);
  const 区: P5阶段区 = {
    stage,
    state: 要求枚举(raw.state, 阶段区状态全表),
    occurredAt: raw.occurred_at === undefined ? null : 要求可空RFC3339(raw.occurred_at),
    summary: 要求字符串(raw.summary),
    checklist: 要求数组(raw.checklist).map(解清单项),
    transcript: 要求数组(raw.transcript).map((项) => 解时间线项(项, stage)),
    instructionReceipts: 要求数组(raw.instruction_receipts).map(解叮嘱回执),
    attachment: null,
  };
  if (raw.attachment !== undefined) {
    // S1 披露栅栏：招聘端在匿名初筛区永远看不到简历附件（严格客户端同款）。
    if (viewer === 'recruiter' && stage === 'anonymous_screening') throw 契约错误();
    区.attachment = 解简历附件(raw.attachment);
  }
  return 区;
}

/** 协同块只接受缺席（显式 null 是漂移），且只能在 open 的 needs_coordination 阶段出现。 */
function 解协同(input: unknown, state: P5状态视图): P5协同 {
  const raw = 要求闭合对象(input, ['issue_id', 'kind', 'required_roles', 'candidate_decided', 'recruiter_decided']);
  if (state.lifecycle !== 'open' || state.stage !== 'needs_coordination') throw 契约错误();
  const roles = 要求数组(raw.required_roles).map((值) => 要求枚举(值, 叮嘱主人全表));
  if (roles.length === 0 || new Set(roles).size !== roles.length) throw 契约错误();
  return {
    issueId: 要求模式串(raw.issue_id, 协同问题ID模式),
    kind: 要求枚举(raw.kind, 协同类目全表),
    requiredRoles: roles,
    candidateDecided: 要求布尔(raw.candidate_decided),
    recruiterDecided: 要求布尔(raw.recruiter_decided),
  };
}

/** S3 意向确认：闭词；记录过词必须在 S3，decline 必已 ended，completed 恰为双方 confirm。 */
function 解意向确认(input: unknown, state: P5状态视图): P5意向确认 {
  const raw = 要求闭合对象(input, ['candidate', 'recruiter']);
  const 确认: P5意向确认 = {
    candidate: 要求枚举(raw.candidate, 意向词全表),
    recruiter: 要求枚举(raw.recruiter, 意向词全表),
  };
  if ((确认.candidate !== '' || 确认.recruiter !== '') && state.stage !== 'intent_confirmation') {
    throw 契约错误();
  }
  if ((确认.candidate === 'decline' || 确认.recruiter === 'decline') && state.lifecycle !== 'ended') {
    throw 契约错误();
  }
  if (state.lifecycle === 'completed' && (确认.candidate !== 'confirm' || 确认.recruiter !== 'confirm')) {
    throw 契约错误();
  }
  return 确认;
}

/** 终局摘要必须与 state 对齐：ended 复述 outcome/outcome_code，completed 两词为空。 */
function 解终局摘要(input: unknown, state: P5状态视图): P5终局摘要 {
  const raw = 要求闭合对象(input, ['stage', 'outcome', 'reason_summary', 'finalized_at']);
  const 摘要: P5终局摘要 = {
    stage: 要求枚举(raw.stage, 阶段全表),
    outcome: 要求字符串(raw.outcome),
    reasonSummary: 要求字符串(raw.reason_summary),
    finalizedAt: 要求RFC3339(raw.finalized_at),
  };
  if (摘要.stage !== state.stage || 摘要.finalizedAt !== state.finalizedAt) throw 契约错误();
  if (state.lifecycle === 'ended') {
    if (摘要.outcome !== state.outcome || 摘要.reasonSummary !== state.outcomeCode) throw 契约错误();
  } else if (state.lifecycle === 'completed') {
    if (摘要.outcome !== '' || 摘要.reasonSummary !== '') throw 契约错误();
  }
  return 摘要;
}

/** viewer 专属动作表：闭词、不重复、归属正确；终态零动作零待办，open 与非空列表精确耦合。 */
function 解可用动作(input: unknown, viewer: P5角色, state: P5状态视图, needsAction: boolean): P5动作[] {
  const actions = 要求数组(input).map((值) => 要求枚举(值, 动作全表));
  const 已见 = new Set<P5动作>();
  for (const action of actions) {
    if (已见.has(action)) throw 契约错误();
    已见.add(action);
    const 归属 = 动作归属[action];
    if (归属 !== '双端' && 归属 !== viewer) throw 契约错误();
  }
  if (state.lifecycle !== 'open') {
    if (needsAction || actions.length > 0) throw 契约错误();
    return actions;
  }
  if (needsAction !== (actions.length > 0)) throw 契约错误();
  return actions;
}

/** 终局摘要块：open 必缺席，终态必在场（严格客户端同款）；缺席解成内部 null。 */
function 解终局摘要块(raw: Record<string, unknown>, state: P5状态视图): P5终局摘要 | null {
  if (state.lifecycle === 'open') {
    if (raw.terminal_summary !== undefined) throw 契约错误();
    return null;
  }
  if (raw.terminal_summary === undefined) throw 契约错误();
  return 解终局摘要(raw.terminal_summary, state);
}

const 详情共用必需键 = [
  'state', 'needs_action', 'available_actions', 'stages', 'intent_confirmations', 'job',
] as const;
const 详情可选键 = ['current_coordination', 'terminal_summary', 'conversation_ref'] as const;

/**
 * 解P5详情：把双端 role detail 的 wire 值解成归一化 P5详情。候选端带 intention_id、
 * 招聘端带 candidate_alias，对端上下文键即漂移；current_coordination / terminal_summary
 * 只接受缺席（公开 wire 不收显式 null），缺席解成内部 null。
 */
export function 解P5详情(input: unknown, role: P5角色): P5详情 {
  const raw = role === 'candidate'
    ? 要求闭合对象(input, [...详情共用必需键, 'intention_id'], 详情可选键)
    : 要求闭合对象(input, [...详情共用必需键, 'candidate_alias'], 详情可选键);
  const state = 解P5状态视图(raw.state);
  const needsAction = 要求布尔(raw.needs_action);
  const availableActions = 解可用动作(raw.available_actions, role, state, needsAction);
  const stages = 要求数组(raw.stages).map((区) => 解P5阶段区(区, role));
  if (stages.length !== 4) throw 契约错误();
  阶段顺序.forEach((stage, 下标) => {
    if (stages[下标].stage !== stage) throw 契约错误();
  });
  const intentConfirmations = 解意向确认(raw.intent_confirmations, state);
  const job = 解工作区职位(raw.job);
  const currentCoordination = raw.current_coordination === undefined
    ? null
    : 解协同(raw.current_coordination, state);
  const terminalSummary = 解终局摘要块(raw, state);
  // P7 Task 6：发布联合不变式 —— conversation_ref 只属于 completed + complete（在场且
  // 规范 decimal）；handoff_pending / open / ended 一律必缺席。
  const conversationRef = raw.conversation_ref === undefined
    ? null
    : 要求模式串(raw.conversation_ref, 会话坐标模式);
  const 已发布 = state.lifecycle === 'completed' && state.step === 'complete';
  if ((conversationRef !== null) !== 已发布) throw 契约错误();
  if (role === 'candidate') {
    return {
      role,
      context: { intentionId: 要求模式串(raw.intention_id, 意向ID模式), job },
      state,
      needsAction,
      availableActions,
      stages,
      currentCoordination,
      intentConfirmations,
      terminalSummary,
      conversationRef,
    };
  }
  return {
    role,
    context: { candidateAlias: 要求模式串(raw.candidate_alias, 候选别名模式), job },
    state,
    needsAction,
    availableActions,
    stages,
    currentCoordination,
    intentConfirmations,
    terminalSummary,
    conversationRef,
  };
}

// ── 列表页 decoder：工作区与历史刻意共用 role item/page 形状，架子规则在 decode 内闭合 ──

function 解P5列表项(input: unknown, role: P5角色, 架子: 'open' | P5历史生命周期): P5列表项 {
  const raw = role === 'candidate'
    ? 要求闭合对象(input, ['state', 'needs_action', 'intention_id', 'job'])
    : 要求闭合对象(input, ['state', 'needs_action', 'job', 'candidate_alias']);
  const state = 解P5状态视图(raw.state);
  const needsAction = 要求布尔(raw.needs_action);
  // 架子规则：open 列表只装 open 行、历史只装对应终态行，终态行永无 viewer 待办；
  // 列表行也禁止 resume_submission 投影（键出现在白名单外即漂移）。
  if (state.lifecycle !== 架子) throw 契约错误();
  if (架子 !== 'open' && needsAction) throw 契约错误();
  const job = 解工作区职位(raw.job);
  if (role === 'candidate') {
    return {
      role,
      state,
      needsAction,
      intentionId: 要求模式串(raw.intention_id, 意向ID模式),
      job,
    };
  }
  return {
    role,
    state,
    needsAction,
    candidateAlias: 要求模式串(raw.candidate_alias, 候选别名模式),
    job,
  };
}

function 解P5列表页(input: unknown, role: P5角色, 架子: 'open' | P5历史生命周期): P5列表页 {
  const raw = 要求闭合对象(input, ['items', 'next_cursor']);
  return {
    role,
    items: 要求数组(raw.items).map((项) => 解P5列表项(项, role, 架子)),
    nextCursor: 解下一游标(raw.next_cursor),
  };
}

/** 响应 cursor 恰为 string | null：缺键、坏类型、空、超 4096 或坏形状都是契约漂移。 */
function 解下一游标(值: unknown): string | null {
  if (值 === null) return null;
  if (typeof 值 !== 'string' || 值.length === 0 || 值.length > 4096 || !游标模式.test(值)) {
    throw 契约错误();
  }
  return 值;
}

/** 调用方 cursor 在任何 fetch 前校验：非空 base64url 字符串且 ≤4096，非法即抛、零请求。 */
function 校验调用方游标(cursor: string): string {
  if (typeof cursor !== 'string' || cursor.length === 0 || cursor.length > 4096 || !游标模式.test(cursor)) {
    throw new BFF错误(0, 'invalid_request', 'cursor 需为非空 base64url 且不超过 4096 字节');
  }
  return cursor;
}

// ── 查询构造：键顺序固定（filter → limit → cursor；历史 lifecycle 在最前），limit 首页与后续页都是 50 ──

/** P5 页大小固定 50（与发现推荐域的常量分页纪律一致；后端上限 50，缺省 20 不采用）。 */
const P5页上限 = 50;
const 角色过滤键: Record<P5角色, string> = { candidate: 'intention_id', recruiter: 'job_id' };

function P5路径(role: P5角色, suffix: string): `/api/v1/${string}` {
  return `${P5前缀[role]}${suffix}` as `/api/v1/${string}`;
}

function 工作区查询(role: P5角色, filterRef: string | null, cursor: string | null): `/api/v1/${string}` {
  const 片段 = [
    ...(filterRef === null ? [] : [`${角色过滤键[role]}=${encodeURIComponent(filterRef)}`]),
    `limit=${P5页上限}`,
    ...(cursor === null ? [] : [`cursor=${encodeURIComponent(cursor)}`]),
  ];
  return P5路径(role, `/match-cases?${片段.join('&')}`);
}

function 历史查询(
  role: P5角色,
  lifecycle: P5历史生命周期,
  filterRef: string | null,
  cursor: string | null,
): `/api/v1/${string}` {
  const 片段 = [
    `lifecycle=${lifecycle}`,
    ...(filterRef === null ? [] : [`${角色过滤键[role]}=${encodeURIComponent(filterRef)}`]),
    `limit=${P5页上限}`,
    ...(cursor === null ? [] : [`cursor=${encodeURIComponent(cursor)}`]),
  ];
  return P5路径(role, `/match-cases/history?${片段.join('&')}`);
}

export interface MatchCase数据源 {
  读取P5Open列表(role: P5角色, filterRef: string | null, cursor: string | null): Promise<P5列表页>;
  读取P5历史(role: P5角色, lifecycle: P5历史生命周期, filterRef: string | null, cursor: string | null): Promise<P5列表页>;
  读取P5详情(role: P5角色, caseId: string): Promise<P5详情>;
  回答P5事实(role: P5角色, caseId: string, promptId: string, response: string, key: string): Promise<void>;
  提交P5简历(caseId: string, fileId: string, fileVersionId: string, disclosureConfirmed: true, key: string): Promise<void>;
  决定P5S0(caseId: string, action: 'continue' | 'end', key: string): Promise<void>;
  决定P5S1(caseId: string, action: 'continue' | 'not_fit', key: string): Promise<void>;
  决定P5S2(role: P5角色, caseId: string, issueId: string, action: 'accept' | 'reject', key: string): Promise<void>;
  决定P5S3(role: P5角色, caseId: string, action: 'confirm' | 'decline', key: string): Promise<void>;
  新增P5叮嘱(role: P5角色, caseId: string, text: string, key: string): Promise<void>;
  读取P5简历PDF(role: P5角色, caseId: string): Promise<BFF二进制响应>;
}

export function 创建MatchCase数据源(client: Pick<BFF客户端, '请求' | '请求二进制'>): MatchCase数据源 {
  const 请求 = client.请求;

  async function 读取P5Open列表(
    role: P5角色,
    filterRef: string | null,
    cursor: string | null,
  ): Promise<P5列表页> {
    const 游标 = cursor === null ? null : 校验调用方游标(cursor);
    const { result } = await 请求<unknown>({
      path: 工作区查询(role, filterRef, 游标),
      不缓存: true,
    });
    return 解P5列表页(result, role, 'open');
  }

  async function 读取P5历史(
    role: P5角色,
    lifecycle: P5历史生命周期,
    filterRef: string | null,
    cursor: string | null,
  ): Promise<P5列表页> {
    const 游标 = cursor === null ? null : 校验调用方游标(cursor);
    const { result } = await 请求<unknown>({
      path: 历史查询(role, lifecycle, filterRef, 游标),
      不缓存: true,
    });
    return 解P5列表页(result, role, lifecycle);
  }

  async function 读取P5详情(role: P5角色, caseId: string): Promise<P5详情> {
    const { result } = await 请求<unknown>({
      path: P5路径(role, `/match-cases/${encodeURIComponent(caseId)}`),
      不缓存: true,
    });
    return 解P5详情(result, role);
  }

  async function 回答P5事实(
    role: P5角色,
    caseId: string,
    promptId: string,
    response: string,
    key: string,
  ): Promise<void> {
    await 请求<unknown>({
      path: P5路径(role, `/match-cases/${encodeURIComponent(caseId)}/fact-responses`),
      method: 'POST',
      body: { prompt_id: promptId, response },
      幂等: true,
      幂等键: key,
    });
  }

  async function 提交P5简历(
    caseId: string,
    fileId: string,
    fileVersionId: string,
    disclosureConfirmed: true,
    key: string,
  ): Promise<void> {
    await 请求<unknown>({
      path: `/api/v1/me/match-cases/${encodeURIComponent(caseId)}/resume-submission`,
      method: 'POST',
      body: {
        file_id: fileId,
        file_version_id: fileVersionId,
        disclosure_confirmed: disclosureConfirmed,
      },
      幂等: true,
      幂等键: key,
    });
  }

  async function 决定P5S0(caseId: string, action: 'continue' | 'end', key: string): Promise<void> {
    await 请求<unknown>({
      path: `/api/v1/me/match-cases/${encodeURIComponent(caseId)}/decisions`,
      method: 'POST',
      body: { action },
      幂等: true,
      幂等键: key,
    });
  }

  async function 决定P5S1(caseId: string, action: 'continue' | 'not_fit', key: string): Promise<void> {
    await 请求<unknown>({
      path: `/api/v1/recruiter/match-cases/${encodeURIComponent(caseId)}/resume-screening-decisions`,
      method: 'POST',
      body: { action },
      幂等: true,
      幂等键: key,
    });
  }

  async function 决定P5S2(
    role: P5角色,
    caseId: string,
    issueId: string,
    action: 'accept' | 'reject',
    key: string,
  ): Promise<void> {
    await 请求<unknown>({
      path: P5路径(role, `/match-cases/${encodeURIComponent(caseId)}/coordination/${encodeURIComponent(issueId)}/decisions`),
      method: 'POST',
      body: { action },
      幂等: true,
      幂等键: key,
    });
  }

  async function 决定P5S3(
    role: P5角色,
    caseId: string,
    action: 'confirm' | 'decline',
    key: string,
  ): Promise<void> {
    await 请求<unknown>({
      path: P5路径(role, `/match-cases/${encodeURIComponent(caseId)}/intent-decisions`),
      method: 'POST',
      body: { action },
      幂等: true,
      幂等键: key,
    });
  }

  async function 新增P5叮嘱(role: P5角色, caseId: string, text: string, key: string): Promise<void> {
    await 请求<unknown>({
      path: P5路径(role, `/match-cases/${encodeURIComponent(caseId)}/agent-instructions`),
      method: 'POST',
      body: { text },
      幂等: true,
      幂等键: key,
    });
  }

  async function 读取P5简历PDF(role: P5角色, caseId: string): Promise<BFF二进制响应> {
    const 响应 = await client.请求二进制(
      P5路径(role, `/match-cases/${encodeURIComponent(caseId)}/resume-submission/content`),
      { 不缓存: true },
    );
    if (响应.contentType !== 'application/pdf') {
      throw new BFF错误(200, 'invalid_response', 'MatchCase 简历响应不是 PDF');
    }
    return 响应;
  }

  return {
    读取P5Open列表,
    读取P5历史,
    读取P5详情,
    回答P5事实,
    提交P5简历,
    决定P5S0,
    决定P5S1,
    决定P5S2,
    决定P5S3,
    新增P5叮嘱,
    读取P5简历PDF,
  };
}
