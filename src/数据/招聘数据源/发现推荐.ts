// 发现推荐域数据源：BFF /api/v1 的 P4 discovery 双端（候选岗位推荐 + 招聘匿名候选）。
// 第九个域 facade：协议代码（path / method / body / 调用方幂等键 / 无 body 反馈 / 分页循环）
// 按 P4 冻结契约实现。每个响应先 strict decode（exact key set、闭合 enum、rank/score 边界、
// 条件可空、RFC3339），不 `as` 直转；接口失败绝不回退 Mock。本模块不 import React 或 Mock。
// 边界外的方法（watch、候选不感兴趣撤销、委托列表 GET、top 选择、服务端收藏过滤）不存在。

import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type {
  BFFCandidateJob,
  BFF目录引用,
  BFF硬性条件,
  BFF硬性要求档,
  BFF验证状态,
  BFFOwnerJob,
  BFF学历要求,
  BFF经验要求,
  BFF委托状态,
  BFF委托摘要,
  BFF淘汰原因,
  BFF委托回执,
  BFF发现批次,
  BFF发现偏好,
  BFF候选岗位推荐,
  BFF招聘候选推荐,
  BFF招聘候选教育,
} from '../BFF契约';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

const 候选前缀 = '/api/v1/me';
const 招聘前缀 = '/api/v1/recruiter';
const 游标模式 = /^[A-Za-z0-9_-]+$/;

function 契约错误(message = '服务返回了不符合契约的发现推荐数据'): BFF错误 {
  return new BFF错误(200, 'invalid_response', message);
}

// ── 本域小 guard：与 Agent规则.ts / 隐私.ts 同一闭合纪律；本域统一 status=200 的 invalid_response ──

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

/** 不透明 ID 一律要求非空；OpenAPI 未声明前缀/十六进制形状，不做发明校验。 */
function 要求非空字符串(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (字符串.length === 0) throw 契约错误();
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

const RFC3339模式 = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

/** CandidateJob 时间戳按 OpenAPI 声明为 RFC 3339 UTC；形状或可解析性不对都拒绝。 */
function 要求RFC3339(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (!RFC3339模式.test(字符串) || Number.isNaN(Date.parse(字符串))) throw 契约错误();
  return 字符串;
}

// ── 闭合 vocabulary（与 mobile-v1 OpenAPI 一一对应）──

const 验证状态全表 = ['unverified', 'verified'] as const satisfies readonly BFF验证状态[];
const 招聘类型全表 = [
  'social_full_time', 'campus', 'internship', 'part_time',
] as const satisfies readonly BFFOwnerJob['recruitment_type'][];
const 办公方式全表 = ['onsite', 'hybrid', 'remote'] as const satisfies readonly BFFOwnerJob['workplace_mode'][];
const 薪资周期全表 = ['month', 'day', 'hour'] as const satisfies readonly BFFOwnerJob['salary_period'][];
const 硬性要求档全表 = ['required', 'not_required', 'unknown'] as const satisfies readonly BFF硬性要求档[];
const 委托状态全表 = [
  'accepted', 'evaluating', 'case_started', 'needs_user', 'refused', 'failed',
] as const satisfies readonly BFF委托状态[];
const 淘汰原因全表 = [
  'experience_insufficient', 'direction_mismatch', 'primary_stack_mismatch', 'other',
] as const satisfies readonly BFF淘汰原因[];
const 委托拒绝码全表 = [
  'recommendation_not_found', 'recommendation_unavailable', 'delegation_not_allowed',
  'active_case_quota_reached', 'delegation_cooldown',
] as const satisfies readonly Exclude<BFF委托回执['refusal_code'], null>[];
const 发现偏好原因全表 = [
  'not_interested', ...淘汰原因全表,
] as const satisfies readonly NonNullable<BFF发现偏好['rejection_reason']>[];
const 经验要求全表 = [
  'none', 'one_to_three_years', 'three_to_five_years', 'five_plus_years', 'ten_plus_years',
] as const satisfies readonly BFF经验要求[];
const 学历要求全表 = [
  'none', 'associate', 'bachelor', 'master', 'doctorate',
] as const satisfies readonly BFF学历要求[];
const 排名版本全表 = [
  'discovery-ranking.v1', 'discovery-ranking.v2',
] as const satisfies readonly BFF发现批次['ranking_version'][];

// ── CandidateJob：required/optional 精确键清单（owner-only 列缺席即漂移）──

const CandidateJob必需键 = [
  'job_id', 'publisher_verification_status',
  'hiring_organization_verification_status', 'hiring_organization_claim',
  'title', 'recruitment_type', 'category', 'location', 'office_location',
  'workplace_mode', 'salary_lower', 'salary_upper', 'salary_period',
  'annual_salary_months', 'campus_cohort', 'internship_months',
  'onsite_days_per_week', 'experience_requirement', 'education_requirement',
  'structured_requirements_confirmed',
  'hard_requirements', 'description', 'requirements', 'keywords', 'status',
  'revision', 'published_at', 'created_at', 'updated_at',
] as const;
const CandidateJob可选键 = [
  'publisher_organization_ref', 'hiring_organization_ref', 'publisher_profile',
] as const;

// ── 具体 decoder：逐字段过 guard，不做 `as` 直转 ──

function 解目录引用(input: unknown): BFF目录引用 {
  const raw = 要求闭合对象(input, ['id', 'display_name']);
  return { id: 要求非空字符串(raw.id), display_name: 要求字符串(raw.display_name) };
}

function 解组织声明(input: unknown): BFFCandidateJob['hiring_organization_claim'] {
  const raw = 要求闭合对象(input, ['display_name'], ['legal_name']);
  const claim: BFFCandidateJob['hiring_organization_claim'] = { display_name: 要求字符串(raw.display_name) };
  if (raw.legal_name !== undefined) claim.legal_name = 要求可空字符串(raw.legal_name);
  return claim;
}

function 解硬性条件(input: unknown): BFF硬性条件 {
  const raw = 要求闭合对象(input, ['alternate_weekend_work', 'outsourcing_only', 'onsite_only', 'frequent_travel']);
  return {
    alternate_weekend_work: 要求枚举(raw.alternate_weekend_work, 硬性要求档全表),
    outsourcing_only: 要求枚举(raw.outsourcing_only, 硬性要求档全表),
    onsite_only: 要求枚举(raw.onsite_only, 硬性要求档全表),
    frequent_travel: 要求枚举(raw.frequent_travel, 硬性要求档全表),
  };
}

function 解发布方档案(input: unknown): NonNullable<BFFCandidateJob['publisher_profile']> {
  const raw = 要求闭合对象(input, ['public_name', 'title', 'personal_verification_status'], ['avatar_url']);
  const profile: NonNullable<BFFCandidateJob['publisher_profile']> = {
    public_name: 要求字符串(raw.public_name),
    title: 要求字符串(raw.title),
    personal_verification_status: 要求枚举(raw.personal_verification_status, 验证状态全表),
  };
  if (raw.avatar_url !== undefined) profile.avatar_url = 要求可空字符串(raw.avatar_url);
  return profile;
}

function 解CandidateJob(input: unknown): BFFCandidateJob {
  const raw = 要求闭合对象(input, CandidateJob必需键, CandidateJob可选键);
  const job: BFFCandidateJob = {
    job_id: 要求非空字符串(raw.job_id),
    publisher_verification_status: 要求枚举(raw.publisher_verification_status, 验证状态全表),
    hiring_organization_verification_status: 要求枚举(raw.hiring_organization_verification_status, 验证状态全表),
    hiring_organization_claim: 解组织声明(raw.hiring_organization_claim),
    title: 要求字符串(raw.title),
    recruitment_type: 要求枚举(raw.recruitment_type, 招聘类型全表),
    category: 解目录引用(raw.category),
    location: 解目录引用(raw.location),
    office_location: 要求字符串(raw.office_location),
    workplace_mode: 要求枚举(raw.workplace_mode, 办公方式全表),
    salary_lower: 要求整数(raw.salary_lower),
    salary_upper: 要求整数(raw.salary_upper),
    salary_period: 要求枚举(raw.salary_period, 薪资周期全表),
    annual_salary_months: 要求可空整数(raw.annual_salary_months),
    campus_cohort: 要求可空整数(raw.campus_cohort),
    internship_months: 要求可空整数(raw.internship_months),
    onsite_days_per_week: 要求可空整数(raw.onsite_days_per_week),
    experience_requirement: 要求枚举(raw.experience_requirement, 经验要求全表),
    education_requirement: 要求枚举(raw.education_requirement, 学历要求全表),
    structured_requirements_confirmed: 要求布尔(raw.structured_requirements_confirmed),
    hard_requirements: 解硬性条件(raw.hard_requirements),
    description: 要求字符串(raw.description),
    requirements: 要求字符串(raw.requirements),
    keywords: 要求数组(raw.keywords).map(要求字符串),
    status: 要求枚举(raw.status, ['active']),
    revision: 要求范围整数(raw.revision, 0, Infinity),
    published_at: 要求RFC3339(raw.published_at),
    created_at: 要求RFC3339(raw.created_at),
    updated_at: 要求RFC3339(raw.updated_at),
  };
  if (raw.publisher_organization_ref !== undefined) {
    job.publisher_organization_ref = 要求非空字符串(raw.publisher_organization_ref);
  }
  if (raw.hiring_organization_ref !== undefined) {
    job.hiring_organization_ref = 要求非空字符串(raw.hiring_organization_ref);
  }
  if (raw.publisher_profile !== undefined) job.publisher_profile = 解发布方档案(raw.publisher_profile);
  return job;
}

function 解委托摘要(input: unknown): BFF委托摘要 {
  const raw = 要求闭合对象(input, ['delegation_id', 'state', 'case_id']);
  return {
    delegation_id: 要求非空字符串(raw.delegation_id),
    state: 要求枚举(raw.state, 委托状态全表),
    case_id: 要求可空非空字符串(raw.case_id),
  };
}

function 解委托回执(input: unknown): BFF委托回执 {
  const raw = 要求闭合对象(input, [
    'delegation_id', 'recommendation_id', 'state', 'evaluation_id', 'case_id', 'refusal_code',
  ]);
  return {
    delegation_id: 要求非空字符串(raw.delegation_id),
    recommendation_id: 要求可空非空字符串(raw.recommendation_id),
    state: raw.state === null ? null : 要求枚举(raw.state, 委托状态全表),
    evaluation_id: 要求可空非空字符串(raw.evaluation_id),
    case_id: 要求可空非空字符串(raw.case_id),
    refusal_code: raw.refusal_code === null ? null : 要求枚举(raw.refusal_code, 委托拒绝码全表),
  };
}

/** 创建应答按请求顺序逐对象回执；本 facade 只发单对象选择，恰好一条，零条或两条都是漂移。 */
function 解委托批次(input: unknown): BFF委托回执[] {
  const raw = 要求闭合对象(input, ['receipts']);
  const receipts = 要求数组(raw.receipts).map(解委托回执);
  if (receipts.length !== 1) throw 契约错误('委托批次应恰好返回一条回执');
  return receipts;
}

function 解招聘候选教育(input: unknown): BFF招聘候选教育 {
  const raw = 要求闭合对象(input, ['institution', 'major', 'degree', 'start_month', 'end_month']);
  return {
    institution: 要求可空字符串(raw.institution),
    major: 要求可空字符串(raw.major),
    degree: 要求字符串(raw.degree),
    start_month: 要求字符串(raw.start_month),
    end_month: 要求可空字符串(raw.end_month),
  };
}

function 解候选岗位推荐(input: unknown): BFF候选岗位推荐 {
  const raw = 要求闭合对象(input, [
    'recommendation_id', 'batch_id', 'intention_id', 'rank', 'match_score',
    'match_reasons', 'state', 'structured_requirements_confirmed', 'job', 'delegation',
  ]);
  return {
    recommendation_id: 要求非空字符串(raw.recommendation_id),
    batch_id: 要求非空字符串(raw.batch_id),
    intention_id: 要求非空字符串(raw.intention_id),
    rank: 要求范围整数(raw.rank, 1, 3),
    match_score: 要求范围整数(raw.match_score, 0, 100),
    match_reasons: 要求数组(raw.match_reasons).map(要求字符串),
    state: 要求枚举(raw.state, ['available', 'delegating', 'delegated']),
    structured_requirements_confirmed: 要求布尔(raw.structured_requirements_confirmed),
    job: 解CandidateJob(raw.job),
    delegation: raw.delegation === null ? null : 解委托摘要(raw.delegation),
  };
}

function 解招聘候选推荐(input: unknown): BFF招聘候选推荐 {
  const raw = 要求闭合对象(input, [
    'recommendation_id', 'batch_id', 'job_id', 'rank', 'match_score', 'highlights',
    'compensation_relationship', 'candidate_alias', 'experience_years', 'job_status',
    'summary', 'skills', 'educations', 'favorite', 'rejected', 'rejection_reason',
    'state', 'structured_requirements_confirmed', 'delegation',
  ]);
  return {
    recommendation_id: 要求非空字符串(raw.recommendation_id),
    batch_id: 要求非空字符串(raw.batch_id),
    job_id: 要求非空字符串(raw.job_id),
    rank: 要求范围整数(raw.rank, 1, 3),
    match_score: 要求范围整数(raw.match_score, 0, 100),
    highlights: 要求数组(raw.highlights).map(要求字符串),
    compensation_relationship: 要求枚举(raw.compensation_relationship, ['overlap', 'near_miss', 'disjoint', 'unknown']),
    candidate_alias: 要求非空字符串(raw.candidate_alias),
    experience_years: 要求可空整数(raw.experience_years),
    job_status: 要求字符串(raw.job_status),
    summary: 要求字符串(raw.summary),
    skills: 要求数组(raw.skills).map(要求字符串),
    educations: 要求数组(raw.educations).map(解招聘候选教育),
    favorite: 要求布尔(raw.favorite),
    rejected: 要求布尔(raw.rejected),
    rejection_reason: raw.rejection_reason === null ? null : 要求枚举(raw.rejection_reason, 淘汰原因全表),
    state: 要求枚举(raw.state, ['available', 'rejected']),
    structured_requirements_confirmed: 要求布尔(raw.structured_requirements_confirmed),
    delegation: raw.delegation === null ? null : 解委托摘要(raw.delegation),
  };
}

/** 发现域时间戳只按「非空字符串」校验（OpenAPI 未声明更细粒度格式）。 */
function 解发现批次(input: unknown): BFF发现批次 {
  const raw = 要求闭合对象(input, ['batch_id', 'direction', 'scope_ref', 'ranking_version', 'count', 'created_at']);
  return {
    batch_id: 要求非空字符串(raw.batch_id),
    direction: 要求枚举(raw.direction, ['candidate_jobs', 'recruiter_candidates']),
    scope_ref: 要求非空字符串(raw.scope_ref),
    ranking_version: 要求枚举(raw.ranking_version, 排名版本全表),
    count: 要求范围整数(raw.count, 0, 3),
    created_at: 要求非空字符串(raw.created_at),
  };
}

function 解发现偏好(input: unknown): BFF发现偏好 {
  const raw = 要求闭合对象(input, ['favorite', 'rejected', 'rejection_reason', 'revision', 'updated_at']);
  return {
    favorite: 要求布尔(raw.favorite),
    rejected: 要求布尔(raw.rejected),
    rejection_reason: raw.rejection_reason === null
      ? null
      : 要求枚举(raw.rejection_reason, 发现偏好原因全表),
    revision: 要求范围整数(raw.revision, 1, Infinity),
    updated_at: 要求非空字符串(raw.updated_at),
  };
}

// ── 分页：P4 页 wrapper 的 exact keys（recommendations + next_cursor），全部页读取 ──

function 解候选页(input: unknown): { items: BFF候选岗位推荐[]; nextCursor: unknown } {
  const raw = 要求闭合对象(input, ['recommendations', 'next_cursor']);
  return { items: 要求数组(raw.recommendations).map(解候选岗位推荐), nextCursor: raw.next_cursor };
}

function 解招聘页(input: unknown): { items: BFF招聘候选推荐[]; nextCursor: unknown } {
  const raw = 要求闭合对象(input, ['recommendations', 'next_cursor']);
  return { items: 要求数组(raw.recommendations).map(解招聘候选推荐), nextCursor: raw.next_cursor };
}

/** cursor 是服务端的不透明 unpadded base64url 串（≤4096 字节）；客户端只编码不解读。 */
function 校验下一游标(value: unknown, seen: Set<string>): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096 ||
      !游标模式.test(value) || seen.has(value)) throw 契约错误();
  seen.add(value);
  return value;
}

// ── 查询构造：查询键顺序固定（scope → state → limit → cursor），limit 首页与后续页都是 50 ──

const candidatePath = (intentionId: string, cursor: string | null) =>
  `/api/v1/me/job-recommendations?intention_id=${encodeURIComponent(intentionId)}&limit=50${
    cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`
  }` as `/api/v1/${string}`;

const recruiterPath = (jobId: string, state: 'available' | 'rejected', cursor: string | null) =>
  `/api/v1/recruiter/jobs/${encodeURIComponent(jobId)}/candidate-recommendations?${
    state === 'rejected' ? 'state=rejected&' : ''
  }limit=50${cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`}` as `/api/v1/${string}`;

export interface 发现推荐数据源 {
  读取候选岗位推荐(intentionId: string): Promise<BFF候选岗位推荐[]>;
  读取候选岗位详情(jobId: string): Promise<BFFCandidateJob>;
  刷新候选岗位推荐(intentionId: string, idempotencyKey: string): Promise<BFF发现批次>;
  标记候选岗位不感兴趣(recommendationId: string): Promise<BFF发现偏好>;
  创建候选岗位委托(input: {
    intentionId: string; jobId: string;
    /** 用户在屏层选中的附件简历精确坐标：本 facade 只透传，绝不代选文件。 */
    resumeFileId: string; resumeFileVersionId: string;
    idempotencyKey: string;
    disclosureAcknowledged: true;
  }): Promise<BFF委托回执[]>;
  读取候选岗位委托(delegationId: string): Promise<BFF委托回执>;
  读取招聘候选(jobId: string, state?: 'rejected'): Promise<BFF招聘候选推荐[]>;
  读取招聘候选详情(jobId: string, recommendationId: string): Promise<BFF招聘候选推荐>;
  刷新招聘候选(jobId: string, idempotencyKey: string): Promise<BFF发现批次>;
  设置招聘候选收藏(jobId: string, recommendationId: string, favorite: boolean): Promise<BFF发现偏好>;
  设置招聘候选淘汰(jobId: string, recommendationId: string, reason: BFF淘汰原因): Promise<BFF发现偏好>;
  撤销招聘候选淘汰(jobId: string, recommendationId: string): Promise<BFF发现偏好>;
  创建招聘候选委托(input: {
    jobId: string; recommendationId: string; idempotencyKey: string;
  }): Promise<BFF委托回执[]>;
  读取招聘候选委托(delegationId: string): Promise<BFF委托回执>;
}

export function 创建发现推荐数据源(请求: 请求函数): 发现推荐数据源 {
  /**
   * 读取一个 scope 的全部 opaque cursor 页。注意 P4 页 wrapper 永远要求 next_cursor
   * 且末页用显式 null 收尾 —— 与 Agent 规则域的 helper（next_cursor 键可选、present null
   * 非法）语义不同；本域只有这一个新消费者，不抽取带布尔语义开关的共享 helper。
   */
  async function 读取全部页<T>(
    pathFor: (cursor: string | null) => `/api/v1/${string}`,
    decode: (input: unknown) => { items: T[]; nextCursor: unknown },
  ): Promise<T[]> {
    const all: T[] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    do {
      const { result } = await 请求<unknown>({ path: pathFor(cursor) });
      const page = decode(result);
      all.push(...page.items);
      cursor = 校验下一游标(page.nextCursor, seen);
    } while (cursor !== null);
    return all;
  }

  async function 读取候选岗位推荐(intentionId: string): Promise<BFF候选岗位推荐[]> {
    return 读取全部页((cursor) => candidatePath(intentionId, cursor), 解候选页);
  }

  async function 读取候选岗位详情(jobId: string): Promise<BFFCandidateJob> {
    const { result } = await 请求<unknown>({ path: `/api/v1/jobs/${encodeURIComponent(jobId)}` });
    return 解CandidateJob(result);
  }

  async function 刷新候选岗位推荐(intentionId: string, idempotencyKey: string): Promise<BFF发现批次> {
    const { result } = await 请求<unknown>({
      path: '/api/v1/me/job-recommendation-refreshes',
      method: 'POST',
      body: { intention_id: intentionId },
      幂等: true,
      幂等键: idempotencyKey,
    });
    return 解发现批次(result);
  }

  async function 标记候选岗位不感兴趣(recommendationId: string): Promise<BFF发现偏好> {
    const { result } = await 请求<unknown>({
      path: `${候选前缀}/job-recommendations/${encodeURIComponent(recommendationId)}/not-interested`,
      method: 'PUT',
    });
    return 解发现偏好(result);
  }

  async function 创建候选岗位委托(input: {
    intentionId: string; jobId: string;
    /** 用户在屏层选中的附件简历精确坐标：本 facade 只透传，绝不代选文件。 */
    resumeFileId: string; resumeFileVersionId: string;
    idempotencyKey: string;
    disclosureAcknowledged: true;
  }): Promise<BFF委托回执[]> {
    const { result } = await 请求<unknown>({
      path: '/api/v1/me/job-delegations',
      method: 'POST',
      body: {
        intention_id: input.intentionId,
        selection: { items: [input.jobId] },
        disclosure_acknowledged: input.disclosureAcknowledged,
        resume_file_id: input.resumeFileId,
        resume_file_version_id: input.resumeFileVersionId,
      },
      幂等: true,
      幂等键: input.idempotencyKey,
    });
    return 解委托批次(result);
  }

  async function 读取候选岗位委托(delegationId: string): Promise<BFF委托回执> {
    const { result } = await 请求<unknown>({
      path: `${候选前缀}/job-delegations/${encodeURIComponent(delegationId)}`,
    });
    return 解委托回执(result);
  }

  async function 读取招聘候选(jobId: string, state?: 'rejected'): Promise<BFF招聘候选推荐[]> {
    return 读取全部页(
      (cursor) => recruiterPath(jobId, state === 'rejected' ? 'rejected' : 'available', cursor),
      解招聘页,
    );
  }

  async function 读取招聘候选详情(jobId: string, recommendationId: string): Promise<BFF招聘候选推荐> {
    const { result } = await 请求<unknown>({
      path: `${招聘前缀}/jobs/${encodeURIComponent(jobId)}/candidate-recommendations/${encodeURIComponent(recommendationId)}`,
    });
    return 解招聘候选推荐(result);
  }

  async function 刷新招聘候选(jobId: string, idempotencyKey: string): Promise<BFF发现批次> {
    const { result } = await 请求<unknown>({
      path: '/api/v1/recruiter/candidate-recommendation-refreshes',
      method: 'POST',
      body: { job_id: jobId },
      幂等: true,
      幂等键: idempotencyKey,
    });
    return 解发现批次(result);
  }

  async function 设置招聘候选收藏(jobId: string, recommendationId: string, favorite: boolean): Promise<BFF发现偏好> {
    const { result } = await 请求<unknown>({
      path: `${招聘前缀}/jobs/${encodeURIComponent(jobId)}/candidate-recommendations/${encodeURIComponent(recommendationId)}/favorite`,
      method: favorite ? 'PUT' : 'DELETE',
    });
    return 解发现偏好(result);
  }

  async function 设置招聘候选淘汰(
    jobId: string, recommendationId: string, reason: BFF淘汰原因,
  ): Promise<BFF发现偏好> {
    const { result } = await 请求<unknown>({
      path: `${招聘前缀}/jobs/${encodeURIComponent(jobId)}/candidate-recommendations/${encodeURIComponent(recommendationId)}/rejection`,
      method: 'PUT',
      body: { reason },
    });
    return 解发现偏好(result);
  }

  async function 撤销招聘候选淘汰(jobId: string, recommendationId: string): Promise<BFF发现偏好> {
    const { result } = await 请求<unknown>({
      path: `${招聘前缀}/jobs/${encodeURIComponent(jobId)}/candidate-recommendations/${encodeURIComponent(recommendationId)}/rejection`,
      method: 'DELETE',
    });
    return 解发现偏好(result);
  }

  async function 创建招聘候选委托(input: {
    jobId: string; recommendationId: string; idempotencyKey: string;
  }): Promise<BFF委托回执[]> {
    const { result } = await 请求<unknown>({
      path: '/api/v1/recruiter/candidate-delegations',
      method: 'POST',
      body: {
        job_id: input.jobId,
        selection: { items: [input.recommendationId] },
      },
      幂等: true,
      幂等键: input.idempotencyKey,
    });
    return 解委托批次(result);
  }

  async function 读取招聘候选委托(delegationId: string): Promise<BFF委托回执> {
    const { result } = await 请求<unknown>({
      path: `${招聘前缀}/candidate-delegations/${encodeURIComponent(delegationId)}`,
    });
    return 解委托回执(result);
  }

  return {
    读取候选岗位推荐,
    读取候选岗位详情,
    刷新候选岗位推荐,
    标记候选岗位不感兴趣,
    创建候选岗位委托,
    读取候选岗位委托,
    读取招聘候选,
    读取招聘候选详情,
    刷新招聘候选,
    设置招聘候选收藏,
    设置招聘候选淘汰,
    撤销招聘候选淘汰,
    创建招聘候选委托,
    读取招聘候选委托,
  };
}
