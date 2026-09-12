// 连续代谈域数据源：BFF /api/v1 的 J-PILOT-01 protocol B —— 已验证候选人自己的连续代谈架子
// （me/negotiations 列表 / 详情 / 重试 / 归档）。第十七个域 facade：协议代码（path / method /
// body / 调用方幂等键 / GET 不缓存）按冻结 mobile-v1 契约实现：列表 limit=50、恒省略
// intention_id、cursor 为 null 时省略；详情不带 include（case_detail 已含 screening_records）；
// retry body 严格 {expected_retry_generation}＋Idempotency-Key，archive body 严格 {} 且无 key。
// 每个响应先 strict decode（exact key set、闭合 enum、record_id pattern、history needs_action=false、
// 条件可空块），不 `as` 直转；接口失败绝不回退 Mock。公开 DTO 保留 YAML 原字段名；
// 嵌套 case_state/case_detail/promotion 复用 MatchCase 域既有 decoder，不复制实现。
// 本模块不 import React 或 Mock。

import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { BFF安全职位资料, BFF公司摘要 } from '../BFF契约';
import { 解P5详情, 解P5状态视图, 解S0小结, 解下一游标, 校验调用方游标 } from './MatchCase';
import type { P5S0筛选总结, P5状态视图, P5详情 } from './MatchCase';
import { 解公司摘要, 解职位资料 } from './展示资料';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

const 连续前缀 = '/api/v1/me/negotiations';
/** 页大小固定 50（与发现推荐 / MatchCase 域的常量分页纪律一致；后端上限 50）。 */
const 连续页上限 = 50;

function 契约错误(message = '服务返回了不符合契约的连续代谈数据'): BFF错误 {
  return new BFF错误(200, 'invalid_response', message);
}

// ── 本域小 guard：与 发现推荐.ts / MatchCase.ts 同一闭合纪律；本域统一 status=200 的 invalid_response ──

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

function 要求可空非空字符串(值: unknown): string | null {
  if (值 === null) return null;
  return 要求非空字符串(值);
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

function 要求可空整数(值: unknown): number | null {
  if (值 === null) return null;
  return 要求整数(值);
}

/** 可空闭集：null 与闭词外的取值都区分（null 合法原样，表外词漂移）。 */
function 要求可空枚举<T extends string>(值: unknown, 取值: readonly T[]): T | null {
  if (值 === null) return null;
  return 要求枚举(值, 取值);
}

const RFC3339模式 = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

/** 协议 B 时间戳按 OpenAPI 声明为 RFC 3339 UTC；形状或可解析性不对都拒绝。 */
function 要求RFC3339(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (!RFC3339模式.test(字符串) || Number.isNaN(Date.parse(字符串))) throw 契约错误();
  return 字符串;
}

function 要求可空RFC3339(值: unknown): string | null {
  if (值 === null) return null;
  return 要求RFC3339(值);
}

// ── 闭合 vocabulary（与冻结 mobile-v1 OpenAPI 一一对应）──

const 记录ID模式 = /^(dlg_|mc_)[0-9a-f]{32}$/;
const 记录类别全表 = ['delegation', 'case'] as const;
const 连续阶段全表 = ['accepted', 'evaluating', 'evaluation_failed', 'refused', 'case_started'] as const;
const 委托失败码全表 = ['delegation_agent_unavailable', 'delegation_evaluation_failed', 'delegation_failed'] as const;
const 委托拒绝码全表 = [
  'recommendation_not_found', 'recommendation_unavailable', 'delegation_not_allowed',
  'active_case_quota_reached', 'delegation_cooldown', 'recommendation_stale',
] as const;
const 岗位可用性全表 = ['available', 'unavailable'] as const;
const 评估状态全表 = ['pending', 'completed', 'failed', 'expired'] as const;
const 评估来源全表 = ['structured_precheck', 'candidate_agent'] as const;
const 评估决定全表 = ['fit', 'not_fit', 'uncertain'] as const;
const 评估后续动作全表 = ['stop', 'review', 'promote_to_a2a'] as const;
const 评估失败码全表 = [
  'agent_execution_failed', 'evaluation_processing_failed', 'agent_unavailable', 'deadline_expired',
] as const;
const 输入警示全表 = [
  'resume_skills_missing', 'resume_experience_missing', 'resume_education_missing',
  'resume_summary_missing', 'candidate_context_truncated',
] as const;
const 阶段状态全表 = ['pending', 'active', 'passed', 'ended'] as const;
// release/0.2.5 R1 展示成员：NegotiationJob 的闭集与 SafeJobDetail/CatalogReference 家族同词汇。
const 招聘类型全表 = ['social_full_time', 'campus', 'internship', 'part_time'] as const;
const 办公方式全表 = ['onsite', 'hybrid', 'remote'] as const;

// ── 公开 DTO：保留 YAML 原字段名；嵌套 Case 块复用既有 P5 decoder 的形状 ──

export type NegotiationShelf = 'active' | 'history';

export interface NegotiationJob {
  job_id: string;
  title: string | null;
  location: string | null;
  public_salary_range: string | null;
  availability: 'available' | 'unavailable';
  /** release/0.2.5 R1 展示成员：五键全 required 且可空；null 与 []、0 不互换。 */
  organization: BFF公司摘要 | null;
  required_skills: string[] | null;
  recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time' | null;
  workplace_mode: 'onsite' | 'hybrid' | 'remote' | null;
  annual_salary_months: number | null;
}

export interface NegotiationFailure {
  code: 'delegation_agent_unavailable' | 'delegation_evaluation_failed' | 'delegation_failed';
  retryable: boolean;
}

export interface NegotiationActions {
  retry: boolean;
  archive: boolean;
  open_case: boolean;
}

export interface NegotiationFailureEvent {
  retry_generation: number;
  evaluation_id: string | null;
  code: 'delegation_agent_unavailable' | 'delegation_evaluation_failed' | 'delegation_failed';
  occurred_at: string;
}

export interface NegotiationCard {
  needs_action: boolean;
  record_id: string;
  record_kind: 'delegation' | 'case';
  intention_id: string;
  job: NegotiationJob;
  delegation_id: string | null;
  evaluation_id: string | null;
  case_id: string | null;
  shelf: NegotiationShelf;
  phase: 'accepted' | 'evaluating' | 'evaluation_failed' | 'refused' | 'case_started';
  /** 复用既有 MatchCaseView decoder 的归一化形状（camelCase），见 MatchCase.ts。 */
  case_state: P5状态视图 | null;
  failure: NegotiationFailure | null;
  refusal_code:
    | 'recommendation_not_found' | 'recommendation_unavailable' | 'delegation_not_allowed'
    | 'active_case_quota_reached' | 'delegation_cooldown' | 'recommendation_stale'
    | null;
  actions: NegotiationActions;
  retry_generation: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  /** release/0.2.5：本查看者可溯源的原始推荐分（0 是合法真实分，无溯源为 null）。 */
  match_score: number | null;
}

export interface NegotiationPage {
  items: NegotiationCard[];
  next_cursor: string | null;
}

export interface JobEvaluationInputs {
  resume_revision: number;
  intention_id: string;
  intention_revision: number;
  job_id: string;
  job_revision: number;
  contract_version: 'candidate_job_evaluation.v1';
}

export interface JobEvaluationEvidenceItem {
  dimension: string;
  code: string;
  source: 'structured_precheck' | 'candidate_agent';
}

export interface JobEvaluationEvidence {
  matches: JobEvaluationEvidenceItem[];
  conflicts: JobEvaluationEvidenceItem[];
  unknowns: JobEvaluationEvidenceItem[];
}

export interface JobEvaluationResult {
  decision: 'fit' | 'not_fit' | 'uncertain';
  summary: string;
  coverage: 'public_job_and_candidate_data';
  evidence: JobEvaluationEvidence;
  next_action: 'stop' | 'review' | 'promote_to_a2a';
}

export interface JobEvaluationFailure {
  code: 'agent_execution_failed' | 'evaluation_processing_failed' | 'agent_unavailable' | 'deadline_expired';
  retryable: boolean;
}

/** 已有 JobEvaluationView schema 的本地闭合类型：不新增 evaluation API，只在详情内整读。 */
export interface JobEvaluationView {
  evaluation_id: string;
  state: 'pending' | 'completed' | 'failed' | 'expired';
  source: 'structured_precheck' | 'candidate_agent';
  inputs: JobEvaluationInputs;
  input_warnings: ('resume_skills_missing' | 'resume_experience_missing' | 'resume_education_missing' | 'resume_summary_missing' | 'candidate_context_truncated')[];
  result: JobEvaluationResult | null;
  failure: JobEvaluationFailure | null;
  /** 复用既有 MatchCaseView decoder 的归一化形状（camelCase）。 */
  promotion: P5状态视图 | null;
  created_at: string;
  updated_at: string;
  /** pending 评估缺席（wire 不带零时间）；缺席归一为 null。 */
  terminal_at: string | null;
}

export interface NegotiationPublicEvaluation {
  evaluation_id: string;
  decision: 'fit' | 'not_fit' | 'uncertain';
  summary: string;
  coverage: 'public_job_and_candidate_data';
  evidence: JobEvaluationEvidence;
  next_action: 'stop' | 'review' | 'promote_to_a2a';
  completed_at: string;
}

export interface NegotiationConditionConfirmation {
  case_id: string;
  stage_status: 'pending' | 'active' | 'passed' | 'ended';
  /** 复用既有 S0 小结 decoder 的归一化形状（camelCase）。 */
  latest_summary: P5S0筛选总结 | null;
  summaries: P5S0筛选总结[];
}

export interface NegotiationAgentSummary {
  public_evaluation: NegotiationPublicEvaluation | null;
  condition_confirmation: NegotiationConditionConfirmation | null;
}

export interface NegotiationDetail extends NegotiationCard {
  evaluation: JobEvaluationView | null;
  /** 复用既有候选 P5详情 decoder；招聘端 Case 详情不能充当候选聚合。 */
  case_detail: P5详情 | null;
  failure_history: NegotiationFailureEvent[];
  agent_summary: NegotiationAgentSummary;
  /** release/0.2.5：详情专属冻结岗位展示（Case-bound 与 case_detail.job_detail 同一冻结区；legacy 为显式 null）。 */
  job_detail: BFF安全职位资料 | null;
}

export interface NegotiationRetryReceipt {
  record_id: string;
  retry_generation: number;
}

export interface NegotiationArchiveReceipt {
  record_id: string;
  archived_at: string;
}

// ── 具体 decoder：逐字段过 guard，不做 `as` 直转 ──

function 解NegotiationJob(input: unknown): NegotiationJob {
  const raw = 要求闭合对象(input, [
    'job_id', 'title', 'location', 'public_salary_range', 'availability',
    'organization', 'required_skills', 'recruitment_type', 'workplace_mode', 'annual_salary_months',
  ]);
  // release/0.2.5：五个展示成员全 required；null（unavailable / legacy 冻结缺席）与 []、0
  // 原样保留区分，非 null 整包过各自的闭合解码。
  const requiredSkills = raw.required_skills;
  return {
    job_id: 要求非空字符串(raw.job_id),
    title: 要求可空字符串(raw.title),
    location: 要求可空字符串(raw.location),
    public_salary_range: 要求可空字符串(raw.public_salary_range),
    availability: 要求枚举(raw.availability, 岗位可用性全表),
    organization: raw.organization === null ? null : 解公司摘要(raw.organization),
    required_skills: requiredSkills === null
      ? null
      : 要求数组(requiredSkills).map(要求字符串),
    recruitment_type: 要求可空枚举(raw.recruitment_type, 招聘类型全表),
    workplace_mode: 要求可空枚举(raw.workplace_mode, 办公方式全表),
    annual_salary_months: 要求可空整数(raw.annual_salary_months),
  };
}

function 解NegotiationFailure(input: unknown): NegotiationFailure {
  const raw = 要求闭合对象(input, ['code', 'retryable']);
  return { code: 要求枚举(raw.code, 委托失败码全表), retryable: 要求布尔(raw.retryable) };
}

function 解NegotiationActions(input: unknown): NegotiationActions {
  const raw = 要求闭合对象(input, ['retry', 'archive', 'open_case']);
  return {
    retry: 要求布尔(raw.retry),
    archive: 要求布尔(raw.archive),
    open_case: 要求布尔(raw.open_case),
  };
}

function 解NegotiationFailureEvent(input: unknown): NegotiationFailureEvent {
  const raw = 要求闭合对象(input, ['retry_generation', 'evaluation_id', 'code', 'occurred_at']);
  return {
    retry_generation: 要求范围整数(raw.retry_generation, 0, Infinity),
    evaluation_id: 要求可空非空字符串(raw.evaluation_id),
    code: 要求枚举(raw.code, 委托失败码全表),
    occurred_at: 要求RFC3339(raw.occurred_at),
  };
}

const 卡片必需键 = [
  'needs_action', 'record_id', 'record_kind', 'intention_id', 'job', 'delegation_id',
  'evaluation_id', 'case_id', 'shelf', 'phase', 'case_state', 'failure', 'refusal_code',
  'actions', 'retry_generation', 'created_at', 'updated_at', 'archived_at', 'match_score',
] as const;
const 详情附加键 = ['evaluation', 'case_detail', 'failure_history', 'agent_summary', 'job_detail'] as const;

/** 卡片主体：列表行与详情共用的键集与规则（history 恒无待办），保证详情/列表一致。 */
function 解卡片字段(raw: Record<string, unknown>): NegotiationCard {
  const shelf = 要求枚举(raw.shelf, ['active', 'history'] as const);
  const needsAction = 要求布尔(raw.needs_action);
  // 冻结条件分支：shelf=history 则 needs_action 恒 false（待办只属于 active）。
  if (shelf === 'history' && needsAction) throw 契约错误();
  return {
    needs_action: needsAction,
    record_id: 要求模式串(raw.record_id, 记录ID模式),
    record_kind: 要求枚举(raw.record_kind, 记录类别全表),
    intention_id: 要求非空字符串(raw.intention_id),
    job: 解NegotiationJob(raw.job),
    delegation_id: 要求可空非空字符串(raw.delegation_id),
    evaluation_id: 要求可空非空字符串(raw.evaluation_id),
    case_id: 要求可空非空字符串(raw.case_id),
    shelf,
    phase: 要求枚举(raw.phase, 连续阶段全表),
    case_state: raw.case_state === null ? null : 解P5状态视图(raw.case_state),
    failure: raw.failure === null ? null : 解NegotiationFailure(raw.failure),
    refusal_code: raw.refusal_code === null ? null : 要求枚举(raw.refusal_code, 委托拒绝码全表),
    actions: 解NegotiationActions(raw.actions),
    retry_generation: 要求范围整数(raw.retry_generation, 0, Infinity),
    created_at: 要求RFC3339(raw.created_at),
    updated_at: 要求RFC3339(raw.updated_at),
    archived_at: 要求可空RFC3339(raw.archived_at),
    // release/0.2.5：可溯源原始推荐分（0..100）；0 是合法真实分，null 是无溯源，二者不互换。
    match_score: raw.match_score === null ? null : 要求范围整数(raw.match_score, 0, 100),
  };
}

export function 解NegotiationCard(input: unknown): NegotiationCard {
  return 解卡片字段(要求闭合对象(input, 卡片必需键));
}

function 解JobEvaluationInputs(input: unknown): JobEvaluationInputs {
  const raw = 要求闭合对象(input, [
    'resume_revision', 'intention_id', 'intention_revision', 'job_id', 'job_revision', 'contract_version',
  ]);
  return {
    resume_revision: 要求范围整数(raw.resume_revision, 0, Infinity),
    intention_id: 要求非空字符串(raw.intention_id),
    intention_revision: 要求范围整数(raw.intention_revision, 0, Infinity),
    job_id: 要求非空字符串(raw.job_id),
    job_revision: 要求范围整数(raw.job_revision, 0, Infinity),
    contract_version: 要求枚举(raw.contract_version, ['candidate_job_evaluation.v1'] as const),
  };
}

function 解JobEvaluationEvidenceItem(input: unknown): JobEvaluationEvidenceItem {
  const raw = 要求闭合对象(input, ['dimension', 'code', 'source']);
  return {
    dimension: 要求非空字符串(raw.dimension),
    code: 要求非空字符串(raw.code),
    source: 要求枚举(raw.source, 评估来源全表),
  };
}

function 解JobEvaluationEvidence(input: unknown): JobEvaluationEvidence {
  const raw = 要求闭合对象(input, ['matches', 'conflicts', 'unknowns']);
  return {
    matches: 要求数组(raw.matches).map(解JobEvaluationEvidenceItem),
    conflicts: 要求数组(raw.conflicts).map(解JobEvaluationEvidenceItem),
    unknowns: 要求数组(raw.unknowns).map(解JobEvaluationEvidenceItem),
  };
}

function 解JobEvaluationResult(input: unknown): JobEvaluationResult {
  const raw = 要求闭合对象(input, ['decision', 'summary', 'coverage', 'evidence', 'next_action']);
  return {
    decision: 要求枚举(raw.decision, 评估决定全表),
    summary: 要求字符串(raw.summary),
    coverage: 要求枚举(raw.coverage, ['public_job_and_candidate_data'] as const),
    evidence: 解JobEvaluationEvidence(raw.evidence),
    next_action: 要求枚举(raw.next_action, 评估后续动作全表),
  };
}

function 解JobEvaluationFailure(input: unknown): JobEvaluationFailure {
  const raw = 要求闭合对象(input, ['code', 'retryable']);
  return { code: 要求枚举(raw.code, 评估失败码全表), retryable: 要求布尔(raw.retryable) };
}

/** JobEvaluationView：required/nullable 闭合 + schema 声明的 state↔result/failure 出现耦合。 */
export function 解JobEvaluationView(input: unknown): JobEvaluationView {
  const raw = 要求闭合对象(input, [
    'evaluation_id', 'state', 'source', 'inputs', 'input_warnings', 'result', 'failure',
    'promotion', 'created_at', 'updated_at',
  ], ['terminal_at']);
  const state = 要求枚举(raw.state, 评估状态全表);
  const result = raw.result === null ? null : 解JobEvaluationResult(raw.result);
  const failure = raw.failure === null ? null : 解JobEvaluationFailure(raw.failure);
  // result 只在 completed 出现；failure 只在 failed/expired 出现；pending 双空。
  const 耦合合法 =
    (state === 'completed' && result !== null && failure === null) ||
    ((state === 'failed' || state === 'expired') && result === null && failure !== null) ||
    (state === 'pending' && result === null && failure === null);
  if (!耦合合法) throw 契约错误();
  return {
    evaluation_id: 要求非空字符串(raw.evaluation_id),
    state,
    source: 要求枚举(raw.source, 评估来源全表),
    inputs: 解JobEvaluationInputs(raw.inputs),
    input_warnings: 要求数组(raw.input_warnings).map((值) => 要求枚举(值, 输入警示全表)),
    result,
    failure,
    promotion: raw.promotion === null ? null : 解P5状态视图(raw.promotion),
    created_at: 要求RFC3339(raw.created_at),
    updated_at: 要求RFC3339(raw.updated_at),
    terminal_at: raw.terminal_at === undefined ? null : 要求可空RFC3339(raw.terminal_at),
  };
}

function 解NegotiationConditionConfirmation(input: unknown): NegotiationConditionConfirmation {
  const raw = 要求闭合对象(input, ['case_id', 'stage_status', 'latest_summary', 'summaries']);
  const summaries = 要求数组(raw.summaries).map(解S0小结);
  // MatchCaseScreeningSummary 的 reevaluation round 声明 minimum 1；本域无 Case 预算可比，只收下界。
  for (const 小结 of summaries) {
    if (小结.phase === 'reevaluation' && 小结.round < 1) throw 契约错误();
  }
  return {
    case_id: 要求非空字符串(raw.case_id),
    stage_status: 要求枚举(raw.stage_status, 阶段状态全表),
    latest_summary: raw.latest_summary === null ? null : 解S0小结(raw.latest_summary),
    summaries,
  };
}

function 解NegotiationPublicEvaluation(input: unknown): NegotiationPublicEvaluation {
  const raw = 要求闭合对象(input, [
    'evaluation_id', 'decision', 'summary', 'coverage', 'evidence', 'next_action', 'completed_at',
  ]);
  return {
    evaluation_id: 要求非空字符串(raw.evaluation_id),
    decision: 要求枚举(raw.decision, 评估决定全表),
    summary: 要求字符串(raw.summary),
    coverage: 要求枚举(raw.coverage, ['public_job_and_candidate_data'] as const),
    evidence: 解JobEvaluationEvidence(raw.evidence),
    next_action: 要求枚举(raw.next_action, 评估后续动作全表),
    completed_at: 要求RFC3339(raw.completed_at),
  };
}

function 解NegotiationAgentSummary(input: unknown): NegotiationAgentSummary {
  const raw = 要求闭合对象(input, ['public_evaluation', 'condition_confirmation']);
  return {
    public_evaluation: raw.public_evaluation === null
      ? null
      : 解NegotiationPublicEvaluation(raw.public_evaluation),
    condition_confirmation: raw.condition_confirmation === null
      ? null
      : 解NegotiationConditionConfirmation(raw.condition_confirmation),
  };
}

export function 解NegotiationDetail(input: unknown): NegotiationDetail {
  const raw = 要求闭合对象(input, [...卡片必需键, ...详情附加键]);
  const 卡片 = 解卡片字段(raw);
  const evaluation = raw.evaluation === null ? null : 解JobEvaluationView(raw.evaluation);
  // 聚合嵌套详情按候选角色解码：招聘端 Case 详情（含其专属动作/别名）不能充当候选聚合。
  const case_detail = raw.case_detail === null ? null : 解P5详情(raw.case_detail, 'candidate');
  // release/0.2.5：详情专属冻结岗位展示 —— Case-bound 与 case_detail.job_detail 是同一
  // 冻结区；null 是 legacy Case 的合法快照，绝不补读当前 Job。
  const job_detail = raw.job_detail === null ? null : 解职位资料(raw.job_detail);
  const failure_history = 要求数组(raw.failure_history).map(解NegotiationFailureEvent);
  const agent_summary = 解NegotiationAgentSummary(raw.agent_summary);
  // J-PILOT-01 review-r1（Spec §4/§6「Case mutation 使用真实 case_id，negotiation 读取及恢复
  // 使用真实 record_id」/「阶段与动作来自同一 case_detail」）：聚合是单条记录的单一投影，
  // 外层 case_id 与内层 Case 块（case_state / case_detail / condition_confirmation）必须同属
  // 一个 Case。DTO 三块各自可空，故取严格口径：外层 case_id=null（pre-Case）时三块必须全部
  // 缺席；外层非空时在场各块的 Case 坐标必须与之相等（retention 封闭 = case_id 在场而块缺席，
  // 合法）。混入另一 Case 的块按契约漂移整包拒绝，绝不部分展示/跨记录操作。
  if (卡片.case_id === null) {
    if (卡片.case_state !== null || case_detail !== null ||
      agent_summary.condition_confirmation !== null) {
      throw 契约错误();
    }
  } else {
    if (卡片.case_state !== null && 卡片.case_state.caseId !== 卡片.case_id) throw 契约错误();
    if (case_detail !== null && case_detail.state.caseId !== 卡片.case_id) throw 契约错误();
    if (agent_summary.condition_confirmation !== null &&
      agent_summary.condition_confirmation.case_id !== 卡片.case_id) {
      throw 契约错误();
    }
  }
  return {
    ...卡片,
    evaluation,
    case_detail,
    failure_history,
    agent_summary,
    job_detail,
  };
}

export function 解NegotiationPage(input: unknown): NegotiationPage {
  const raw = 要求闭合对象(input, ['items', 'next_cursor']);
  return {
    items: 要求数组(raw.items).map(解NegotiationCard),
    next_cursor: 解下一游标(raw.next_cursor),
  };
}

export function 解NegotiationRetryReceipt(input: unknown): NegotiationRetryReceipt {
  const raw = 要求闭合对象(input, ['record_id', 'retry_generation']);
  return {
    record_id: 要求非空字符串(raw.record_id),
    retry_generation: 要求范围整数(raw.retry_generation, 0, Infinity),
  };
}

export function 解NegotiationArchiveReceipt(input: unknown): NegotiationArchiveReceipt {
  const raw = 要求闭合对象(input, ['record_id', 'archived_at']);
  return {
    record_id: 要求非空字符串(raw.record_id),
    archived_at: 要求RFC3339(raw.archived_at),
  };
}

// ── 查询构造：shelf 恒在场，键顺序固定（shelf → limit → cursor）──

function 连续路径(suffix: string): `/api/v1/${string}` {
  return `${连续前缀}${suffix}` as `/api/v1/${string}`;
}

export interface 连续代谈数据源 {
  读取候选连续列表(shelf: NegotiationShelf, cursor: string | null): Promise<NegotiationPage>;
  读取候选连续详情(recordId: string): Promise<NegotiationDetail>;
  重试候选连续记录(recordId: string, generation: number, key: string): Promise<NegotiationRetryReceipt>;
  归档候选连续记录(recordId: string): Promise<NegotiationArchiveReceipt>;
}

export function 创建连续代谈数据源(请求: 请求函数): 连续代谈数据源 {
  async function 读取候选连续列表(shelf: NegotiationShelf, cursor: string | null): Promise<NegotiationPage> {
    const 游标 = cursor === null ? null : 校验调用方游标(cursor);
    const { result } = await 请求<unknown>({
      path: 连续路径(`?shelf=${shelf}&limit=${连续页上限}${游标 === null ? '' : `&cursor=${encodeURIComponent(游标)}`}`),
      不缓存: true,
    });
    return 解NegotiationPage(result);
  }

  async function 读取候选连续详情(recordId: string): Promise<NegotiationDetail> {
    const { result } = await 请求<unknown>({
      path: 连续路径(`/${encodeURIComponent(recordId)}`),
      不缓存: true,
    });
    return 解NegotiationDetail(result);
  }

  async function 重试候选连续记录(
    recordId: string,
    generation: number,
    key: string,
  ): Promise<NegotiationRetryReceipt> {
    const { result } = await 请求<unknown>({
      path: 连续路径(`/${encodeURIComponent(recordId)}/retry`),
      method: 'POST',
      body: { expected_retry_generation: generation },
      幂等: true,
      幂等键: key,
    });
    return 解NegotiationRetryReceipt(result);
  }

  async function 归档候选连续记录(recordId: string): Promise<NegotiationArchiveReceipt> {
    // 归档天然幂等：body 严格 {}，不带 Idempotency-Key（与 retry 的恢复代际机制不同）。
    const { result } = await 请求<unknown>({
      path: 连续路径(`/${encodeURIComponent(recordId)}/archive`),
      method: 'POST',
      body: {},
    });
    return 解NegotiationArchiveReceipt(result);
  }

  return {
    读取候选连续列表,
    读取候选连续详情,
    重试候选连续记录,
    归档候选连续记录,
  };
}
