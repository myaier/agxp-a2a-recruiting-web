// 展示资料域 decoder：release/0.2.5 展示字段（JobOrganizationSummary / SafeJobDetail /
// RecruiterCandidateResume 家族与 CaseCandidateIdentity）的具体 schema 严格解码。
// 与 发现推荐.ts / 候选摘要.ts 同一闭合纪律（exact key set、闭集枚举、integer 不收小数、
// 合法 null/[]/0/false 原样保留区分），按仓库 domain-local 惯例内置自己的小 guard。
// 本模块只做解码：共享类型在 BFF契约.ts，摘要七键复用 候选摘要.ts 的闭合解码；
// 外层可空成员由调用方显式分支 —— 四个导出只接非空对象，null/undefined 一律契约漂移。
// 不派生状态、不映射展示文案、不自拼对象存储 URL（logo/avatar 沿 wire 的 BFF 路由）。

import { BFF错误 } from '../HTTP客户端';
import type {
  BFF企业媒体,
  BFF公开发布人档案,
  BFF公司摘要,
  BFF安全职位资料,
  BFF安全简历教育,
  BFF安全简历经历,
  BFF安全简历项目,
  BFF安全期望,
  BFF候选身份,
  BFF候选在线简历,
  BFF目录引用,
  BFF硬性条件,
  BFF硬性要求档,
  BFF验证状态,
  BFFOwnerJob,
} from '../BFF契约';
import { 解招聘候选摘要 } from './候选摘要';

function 契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', '服务返回了不符合契约的展示资料');
}

// ── 本域小 guard ──

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：缺必需键（含显式 undefined 值）或多出未知键都按契约漂移 fail closed。 */
function 要求闭合对象(input: unknown, 必需键: readonly string[]): Record<string, unknown> {
  if (!是记录(input)) throw 契约错误();
  for (const 键 of 必需键) {
    if (!(键 in input) || input[键] === undefined) throw 契约错误();
  }
  for (const 键 of Object.keys(input)) if (!必需键.includes(键)) throw 契约错误();
  return input;
}

function 要求字符串(值: unknown): string {
  if (typeof 值 !== 'string') throw 契约错误();
  return 值;
}

/** 不透明坐标一律非空（与 发现推荐.ts 的 CatalogReference 同口径）。 */
function 要求非空字符串(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (字符串.length === 0) throw 契约错误();
  return 字符串;
}

function 可空字符串(值: unknown): string | null {
  if (值 === null) return null;
  return 要求字符串(值);
}

/** OpenAPI integer：安全整数；小数、数字串、布尔都不接受。 */
function 要求整数(值: unknown): number {
  if (typeof 值 !== 'number' || !Number.isSafeInteger(值)) throw 契约错误();
  return 值;
}

function 可空整数(值: unknown): number | null {
  if (值 === null) return null;
  return 要求整数(值);
}

function 可空布尔(值: unknown): boolean | null {
  if (值 === null) return null;
  if (typeof 值 !== 'boolean') throw 契约错误();
  return 值;
}

function 要求枚举<T extends string>(值: unknown, 全表: readonly T[]): T {
  if (typeof 值 !== 'string' || !(全表 as readonly string[]).includes(值)) throw 契约错误();
  return 值 as T;
}

function 可空枚举<T extends string>(值: unknown, 全表: readonly T[]): T | null {
  if (值 === null) return null;
  return 要求枚举(值, 全表);
}

function 字符串数组(值: unknown): string[] {
  if (!Array.isArray(值)) throw 契约错误();
  return 值.map((条) => {
    if (typeof 条 !== 'string') throw 契约错误();
    return 条;
  });
}

function 可空字符串数组(值: unknown): string[] | null {
  if (值 === null) return null;
  return 字符串数组(值);
}

// ── 闭合 vocabulary（与 mobile-v1 OpenAPI 一一对应）──

const 招聘类型全表 = [
  'social_full_time', 'campus', 'internship', 'part_time',
] as const satisfies readonly BFFOwnerJob['recruitment_type'][];
const 办公方式全表 = ['onsite', 'hybrid', 'remote'] as const satisfies readonly BFFOwnerJob['workplace_mode'][];
const 薪资周期全表 = ['month', 'day', 'hour'] as const satisfies readonly BFFOwnerJob['salary_period'][];
const 硬性要求档全表 = ['required', 'not_required', 'unknown'] as const satisfies readonly BFF硬性要求档[];
const 验证状态全表 = ['unverified', 'verified'] as const satisfies readonly BFF验证状态[];
const 薪资关系全表 = ['overlap', 'near_miss', 'disjoint', 'unknown'] as const satisfies
  readonly BFF候选在线简历['compensation_relationship'][];
const 身份状态全表 = ['anonymous', 'disclosed'] as const satisfies readonly BFF候选身份['state'][];

// ── 嵌套合同解码 ──

function 解目录引用(input: unknown): BFF目录引用 {
  const raw = 要求闭合对象(input, ['id', 'display_name']);
  return { id: 要求非空字符串(raw.id), display_name: 要求字符串(raw.display_name) };
}

function 可空目录引用(值: unknown): BFF目录引用 | null {
  if (值 === null) return null;
  return 解目录引用(值);
}

function 可空目录引用数组(值: unknown): BFF目录引用[] | null {
  if (值 === null) return null;
  if (!Array.isArray(值)) throw 契约错误();
  return 值.map((条) => {
    if (条 === null) throw 契约错误(); // 数组条目本身不可为 null
    return 解目录引用(条);
  });
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

function 可空硬性条件(值: unknown): BFF硬性条件 | null {
  if (值 === null) return null;
  return 解硬性条件(值);
}

function 解企业媒体(input: unknown): BFF企业媒体 {
  const raw = 要求闭合对象(input, ['media_id', 'media_type', 'size_bytes', 'width', 'height', 'url']);
  const media_id = 要求非空字符串(raw.media_id);
  const url = 要求非空字符串(raw.url);
  const size_bytes = 要求整数(raw.size_bytes);
  const width = 要求整数(raw.width);
  const height = 要求整数(raw.height);
  if (size_bytes < 1 || width < 1 || height < 1) throw 契约错误();
  return {
    media_id,
    media_type: 要求枚举(raw.media_type, ['image/png', 'image/jpeg']),
    size_bytes,
    width,
    height,
    url,
  };
}

function 可空企业媒体(值: unknown): BFF企业媒体 | null {
  if (值 === null) return null;
  return 解企业媒体(值);
}

function 解发布人档案(input: unknown): BFF公开发布人档案 {
  const raw = 要求闭合对象(input, ['public_name', 'title', 'personal_verification_status', 'avatar_url']);
  return {
    public_name: 要求字符串(raw.public_name),
    title: 要求字符串(raw.title),
    personal_verification_status: 要求枚举(raw.personal_verification_status, 验证状态全表),
    avatar_url: 可空字符串(raw.avatar_url),
  };
}

function 可空发布人档案(值: unknown): BFF公开发布人档案 | null {
  if (值 === null) return null;
  return 解发布人档案(值);
}

function 解安全简历项目(input: unknown): BFF安全简历项目 {
  const raw = 要求闭合对象(input, ['name', 'role', 'result']);
  return {
    name: 可空字符串(raw.name),
    role: 可空字符串(raw.role),
    result: 可空字符串(raw.result),
  };
}

function 安全简历项目数组(值: unknown): BFF安全简历项目[] {
  if (!Array.isArray(值)) throw 契约错误();
  return 值.map(解安全简历项目);
}

function 解安全简历经历(input: unknown): BFF安全简历经历 {
  const raw = 要求闭合对象(input, [
    'company', 'industry', 'title', 'start_month', 'end_month',
    'description', 'internship', 'projects',
  ]);
  return {
    company: 可空字符串(raw.company),
    industry: 可空字符串(raw.industry),
    title: 可空字符串(raw.title),
    start_month: 可空字符串(raw.start_month),
    end_month: 可空字符串(raw.end_month),
    description: 可空字符串(raw.description),
    internship: 可空布尔(raw.internship),
    projects: 安全简历项目数组(raw.projects),
  };
}

function 可空安全简历经历数组(值: unknown): BFF安全简历经历[] | null {
  if (值 === null) return null;
  if (!Array.isArray(值)) throw 契约错误();
  return 值.map(解安全简历经历);
}

function 解安全简历教育(input: unknown): BFF安全简历教育 {
  const raw = 要求闭合对象(input, ['institution', 'major', 'degree', 'start_month', 'end_month']);
  return {
    institution: 可空字符串(raw.institution),
    major: 可空字符串(raw.major),
    degree: 可空字符串(raw.degree),
    start_month: 可空字符串(raw.start_month),
    end_month: 可空字符串(raw.end_month),
  };
}

function 可空安全简历教育数组(值: unknown): BFF安全简历教育[] | null {
  if (值 === null) return null;
  if (!Array.isArray(值)) throw 契约错误();
  return 值.map(解安全简历教育);
}

function 可空办公方式数组(值: unknown): BFFOwnerJob['workplace_mode'][] | null {
  if (值 === null) return null;
  if (!Array.isArray(值)) throw 契约错误();
  return 值.map((条) => 要求枚举(条, 办公方式全表));
}

function 解安全期望(input: unknown): BFF安全期望 {
  const raw = 要求闭合对象(input, ['recruitment_type', 'job_category', 'locations', 'workplace_modes']);
  return {
    recruitment_type: 可空枚举(raw.recruitment_type, 招聘类型全表),
    job_category: 可空目录引用(raw.job_category),
    locations: 可空目录引用数组(raw.locations),
    workplace_modes: 可空办公方式数组(raw.workplace_modes),
  };
}

// ── 四个导出（外层可空成员由调用方显式分支）──

/**
 * JobOrganizationSummary：六键全 required 且可空。company_size / funding_stage 是开放
 * string 或 null（冻结 YAML 不声明枚举），不套企业档案闭集 decoder，表外码原样保留。
 */
export function 解公司摘要(input: unknown): BFF公司摘要 {
  const raw = 要求闭合对象(input, [
    'organization_id', 'display_name', 'industry', 'company_size', 'funding_stage', 'logo',
  ]);
  return {
    organization_id: 可空字符串(raw.organization_id),
    display_name: 可空字符串(raw.display_name),
    industry: 可空目录引用(raw.industry),
    company_size: 可空字符串(raw.company_size),
    funding_stage: 可空字符串(raw.funding_stage),
    logo: 可空企业媒体(raw.logo),
  };
}

/**
 * SafeJobDetail：25 键全 required 且可空。recruitment_type / workplace_mode / salary_period
 * 枚举沿 CandidateJob（null 合法）；experience_requirement / education_requirement 在本合同
 * 是开放 string 或 null。
 */
export function 解职位资料(input: unknown): BFF安全职位资料 {
  const raw = 要求闭合对象(input, [
    'title', 'description', 'requirements', 'recruitment_type', 'category', 'location',
    'office_location', 'workplace_mode', 'salary_lower', 'salary_upper', 'salary_period',
    'annual_salary_months', 'campus_cohort', 'internship_months', 'onsite_days_per_week',
    'experience_requirement', 'education_requirement', 'hard_requirements',
    'structured_requirements_confirmed', 'keywords', 'organization', 'company_intro',
    'office_address', 'benefit_codes', 'publisher_profile',
  ]);
  return {
    title: 可空字符串(raw.title),
    description: 可空字符串(raw.description),
    requirements: 可空字符串(raw.requirements),
    recruitment_type: 可空枚举(raw.recruitment_type, 招聘类型全表),
    category: 可空目录引用(raw.category),
    location: 可空目录引用(raw.location),
    office_location: 可空字符串(raw.office_location),
    workplace_mode: 可空枚举(raw.workplace_mode, 办公方式全表),
    salary_lower: 可空整数(raw.salary_lower),
    salary_upper: 可空整数(raw.salary_upper),
    salary_period: 可空枚举(raw.salary_period, 薪资周期全表),
    annual_salary_months: 可空整数(raw.annual_salary_months),
    campus_cohort: 可空整数(raw.campus_cohort),
    internship_months: 可空整数(raw.internship_months),
    onsite_days_per_week: 可空整数(raw.onsite_days_per_week),
    experience_requirement: 可空字符串(raw.experience_requirement),
    education_requirement: 可空字符串(raw.education_requirement),
    hard_requirements: 可空硬性条件(raw.hard_requirements),
    structured_requirements_confirmed: 可空布尔(raw.structured_requirements_confirmed),
    keywords: 可空字符串数组(raw.keywords),
    organization: raw.organization === null ? null : 解公司摘要(raw.organization),
    company_intro: 可空字符串(raw.company_intro),
    office_address: 可空字符串(raw.office_address),
    benefit_codes: 可空字符串数组(raw.benefit_codes),
    publisher_profile: 可空发布人档案(raw.publisher_profile),
  };
}

/** RecruiterCandidateResume：七键全 required；summary 复用候选摘要的闭合七键解码。 */
export function 解候选在线简历(input: unknown): BFF候选在线简历 {
  const raw = 要求闭合对象(input, [
    'summary', 'self_description', 'skills', 'experiences', 'educations',
    'expectation', 'compensation_relationship',
  ]);
  const 期望 = raw.expectation;
  return {
    summary: 解招聘候选摘要(raw.summary, 契约错误),
    self_description: 可空字符串(raw.self_description),
    skills: 可空字符串数组(raw.skills),
    experiences: 可空安全简历经历数组(raw.experiences),
    educations: 可空安全简历教育数组(raw.educations),
    expectation: 期望 === null ? null : 解安全期望(期望),
    compensation_relationship: 要求枚举(raw.compensation_relationship, 薪资关系全表),
  };
}

const RFC3339模式 = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

function 可空时间(值: unknown): string | null {
  if (值 === null) return null;
  const 字符串 = 要求字符串(值);
  if (!RFC3339模式.test(字符串) || Number.isNaN(Date.parse(字符串))) throw 契约错误();
  return 字符串;
}

/**
 * CaseCandidateIdentity：anonymous 恒三 null（夹带姓名/头像/时间即漂移）；
 * disclosed 缺值不降级状态。
 */
export function 解候选身份(input: unknown): BFF候选身份 {
  const raw = 要求闭合对象(input, ['state', 'name', 'avatar_url', 'disclosed_at']);
  const state = 要求枚举(raw.state, 身份状态全表);
  const name = 可空字符串(raw.name);
  const avatar_url = 可空字符串(raw.avatar_url);
  const disclosed_at = 可空时间(raw.disclosed_at);
  if (state === 'anonymous' && (name !== null || avatar_url !== null || disclosed_at !== null)) {
    throw 契约错误();
  }
  return { state, name, avatar_url, disclosed_at };
}