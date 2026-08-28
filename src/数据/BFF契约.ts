// BFF 数据契约：后端 /api/v1 返回与接收的闭合 DTO 子集。
// 字段名逐项复制自 OpenAPI；不增加协议中不存在的页面字段；不使用 any。
// 后续 Task 3 的映射层与 Task 4 的数据源会 import 这里的类型。

export type BFF角色 = 'candidate' | 'recruiter';

export interface BFF目录引用 {
  id: string;
  display_name: string;
}

// ── 分页目录查询 DTO（Task 1：闭合 catalog 端点返回项）──
// taxonomy 项带 parent_id / selectable；locations 带行政区划；institutions 嵌套 location。

export interface BFFTaxonomyItem extends BFF目录引用 {
  parent_id: string | null;
  selectable: boolean;
}
export interface BFFLocationItem extends BFF目录引用 {
  country_code: string;
  country_name: string;
  admin1_code: string | null;
  admin1_name: string | null;
  timezone: string;
  population: number;
}
export interface BFFInstitutionItem extends BFF目录引用 {
  location: BFFLocationItem;
}

export interface BFF主体 {
  subject_id: string;
  roles: { role: BFF角色; status: 'active' | 'suspended' }[];
  last_used_role: BFF角色 | null;
}

export interface BFF当前会话 {
  identity_id: string;
  session_id: string;
  expires_at: string;
}

export interface BFF登录尝试 {
  attempt_id: string;
  next_action: {
    type: 'enter_code' | 'redirect' | 'completed';
    expires_at?: string;
    retry_after_seconds?: number;
    redirect_url?: string;
  };
}

export interface BFF简历资料 {
  real_name: string;
  work_start_year: number | null;
  status: 'student' | 'employed' | 'unemployed' | '';
  current_education: string | null;
  graduation_year: number | null;
  gender: 'male' | 'female' | null;
  birth_year: number | null;
  birth_month: number | null;
}

export interface BFF项目 {
  id: string;
  name: string;
  role: string;
  result: string;
  revision: number;
}

export interface BFF经历 {
  id: string;
  company: string;
  industry: BFF目录引用;
  title: string;
  start_month: string;
  end_month: string | null;
  description: string;
  hidden: boolean;
  internship: boolean;
  revision: number;
  projects: BFF项目[] | null;
}

export interface BFF教育 {
  id: string;
  institution: BFF目录引用;
  degree: string;
  major: BFF目录引用;
  start_month: string;
  end_month: string | null;
  revision: number;
}

export interface BFF证书 {
  id: string;
  name: string;
  year: number;
  revision: number;
}

export interface BFF简历 {
  profile: BFF简历资料;
  profile_revision: number;
  summary: string;
  summary_revision: number;
  skills: string[];
  skills_revision: number;
  experiences: BFF经历[];
  educations: BFF教育[];
  certificates: BFF证书[];
  aggregate_revision: number;
}

export interface BFF意向补偿 {
  mode: 'range' | 'negotiable';
  lower?: number | null;
  upper?: number | null;
  annual_salary_months?: number | null;
}

export interface BFF意向排除 {
  alternate_weekend_work: 'allowed' | 'excluded' | 'unspecified';
  outsourcing_only: 'allowed' | 'excluded' | 'unspecified';
  onsite_only: 'allowed' | 'excluded' | 'unspecified';
  frequent_travel: 'allowed' | 'excluded' | 'unspecified';
}

export interface BFFOwnerIntention {
  intention_id: string;
  recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time';
  job_category: BFF目录引用;
  primary_location: BFF目录引用;
  alternate_locations: BFF目录引用[];
  industries: BFF目录引用[];
  workplace_modes: ('onsite' | 'hybrid' | 'remote')[];
  compensation: BFF意向补偿;
  salary_period: 'month' | 'day' | 'hour';
  graduation_month: string | null;
  internship_months: number | null;
  onsite_days_per_week: number | null;
  exclusions: BFF意向排除;
  private_preferences: string;
  status: 'active' | 'archived';
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface BFFOwnerJob {
  job_id: string;
  publisher_mode: 'direct' | 'agency';
  publisher_affiliation_ref?: string;
  publisher_verification_status: 'unverified' | 'verified';
  hiring_organization_claim: { display_name: string; legal_name?: string | null };
  // P1C：服务端推导的发布方/用人企业投影（只读）；创建岗位不提交这些字段。
  publisher_organization_ref?: string;
  hiring_organization_verification_status: BFF验证状态;
  hiring_organization_ref?: string;
  title: string;
  recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time';
  category: BFF目录引用;
  location: BFF目录引用;
  office_location: string;
  workplace_mode: 'onsite' | 'hybrid' | 'remote';
  salary_lower: number;
  salary_upper: number;
  salary_period: 'month' | 'day' | 'hour';
  annual_salary_months: number | null;
  campus_cohort: number | null;
  internship_months: number | null;
  onsite_days_per_week: number | null;
  experience_requirement: string;
  education_requirement: string;
  // P3：四问硬性事实块 —— 服务端 Owner Job / Candidate Job 均必返完整四员（OpenAPI HardRequirements），
  // 读到不完整对象按契约漂移 fail closed，绝不缺省成 unknown。
  hard_requirements: BFF硬性条件;
  description: string;
  requirements: string;
  keywords: string[];
  private_screening_preferences: string;
  status: 'active' | 'archived';
  revision: number;
  published_at: string;
  created_at: string;
  updated_at: string;
}

// ── P3：隐私域 / 候选人组织搜索 / 硬性条件 DTO ──
// 字段名与闭合 enum 逐项复制自 recruitment-bff OpenAPI 的
// PrivacyView / PrivacyPatch / PrivacyBlockReceipt / OrganizationSearchPage / HardRequirements。

export type BFF披露档 = 'never' | 'resume_submission' | 'anonymous';
export type BFF屏蔽来源 = 'current_employer' | 'related_organization' | 'manual';
export type BFF硬性要求档 = 'required' | 'not_required' | 'unknown';

export interface BFF披露偏好 {
  current_employer: BFF披露档;
  education: BFF披露档;
  portfolio_links: BFF披露档;
}
export interface BFF隐私组织屏蔽 {
  organization_id: string;
  organization_display_name: string;
  organization_status: 'active' | 'suspended';
  source: BFF屏蔽来源;
  created_at: string;
}
export interface BFF隐私视图 {
  employer_privacy_enabled: boolean;
  disclosure_preferences: BFF披露偏好;
  organization_blocks: BFF隐私组织屏蔽[];
  revision: number;
  updated_at: string;
}
export type BFF隐私快照 = Pick<BFF隐私视图,
  'employer_privacy_enabled' | 'disclosure_preferences' | 'organization_blocks' | 'revision'>;
export interface BFF隐私补丁 {
  employer_privacy_enabled?: boolean;
  disclosure_preferences?: Partial<BFF披露偏好>;
}
export interface BFF隐私屏蔽回执 {
  organization_block: BFF隐私组织屏蔽;
  privacy_revision: number;
  created_at: string;
}
export interface BFF组织搜索项 { organization_id: string; display_name: string; legal_name: string }
export interface BFF组织搜索页 { items: BFF组织搜索项[]; next_cursor: string | null }
export interface BFF硬性条件 {
  alternate_weekend_work: BFF硬性要求档;
  outsourcing_only: BFF硬性要求档;
  onsite_only: BFF硬性要求档;
  frequent_travel: BFF硬性要求档;
}

/**
 * Candidate Job 的编译期闭类型：owner-private 列（publisher_mode / affiliation ref /
 * private_screening_preferences）显式 Omit，status 收敛为 active，四员硬性条件必在。
 * P3 只保留类型边界 —— 无 fixture、无请求方法、无运行时 decoder；P4 有消费方再放开。
 */
export interface BFFCandidateJob extends Omit<BFFOwnerJob,
  'publisher_mode' | 'publisher_affiliation_ref' | 'private_screening_preferences' | 'status'> {
  publisher_profile?: {
    public_name: string;
    title: string;
    personal_verification_status: 'unverified' | 'verified';
    avatar_url?: string | null;
  };
  status: 'active';
  hard_requirements: BFF硬性条件;
}

// ── 组织域 DTO（P1C：RecruiterProfile / Affiliation / 企业管理员申请 / 企业档案与媒体）──
// 字段名严格对齐 P1B BFF OpenAPI；闭合 enum 与 exact key set 由 组织.ts 的 decoder 校验。

export type BFF验证状态 = 'unverified' | 'verified';

export interface BFF招聘方档案 {
  public_name: string;
  title: string;
  personal_verification_status: BFF验证状态;
  verified_name?: string | null;
  avatar_url?: string | null;
  revision: number;
}

export interface BFF企业关系 {
  affiliation_id: string;
  organization_id: string;
  organization_display_name: string;
  organization_status: 'active' | 'suspended';
  status: 'pending' | 'verified' | 'revoked';
  role: 'member' | 'admin';
  verification_method: 'admin_invitation' | 'corporate_email' | 'manual_admin_review';
  revision: number;
}

export interface BFF企业关系列表 { affiliations: BFF企业关系[] }

export interface BFF企业管理员申请 {
  request_id: string;
  legal_name: string;
  display_name: string;
  domains: string[];
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  revision: number;
}

export interface BFF企业管理员申请列表 { requests: BFF企业管理员申请[] }

export interface BFF企业媒体 {
  media_id: string;
  media_type: 'image/png' | 'image/jpeg';
  size_bytes: number;
  width: number;
  height: number;
  url: string;
}

export interface BFF团队成员 { name: string; title: string; summary: string }

export type BFF企业规模 = '' | 'under_20' | '20_99' | '100_499' | '500_1000' | '1000_9999' | '10000_plus';
export type BFF融资阶段 = '' | 'unfunded' | 'angel' | 'series_a' | 'series_b' | 'series_c' | 'series_d_plus' | 'public' | 'self_funded';
export type BFF作息 = '' | 'two_day_weekend' | 'alternate_saturday' | 'flexible';
export type BFF福利码 =
  | 'social_insurance_housing_fund' | 'supplementary_medical' | 'stock_options' | 'flexible_work'
  | 'annual_physical_exam' | 'regular_physical_exam' | 'paid_annual_leave' | 'meal_allowance'
  | 'transport_allowance' | 'housing_allowance' | 'holiday_benefits' | 'team_building_meals'
  | 'snacks_afternoon_tea' | 'overtime_allowance' | 'year_end_bonus' | 'shuttle_bus' | 'regular_training';

export interface BFF企业档案 {
  brand_name: string;
  industry: BFF目录引用 | null;
  company_size: BFF企业规模;
  funding_stage: BFF融资阶段;
  office_address: string;
  benefit_codes: BFF福利码[];
  work_schedule: BFF作息;
  company_intro: string;
  business_items: string[];
  product_intro: string;
  team_members: BFF团队成员[];
  logo: BFF企业媒体 | null;
  office_media: BFF企业媒体[];
  company_media: BFF企业媒体[];
  revision: number;
  updated_at: string | null;
}

export interface BFF公开企业 {
  organization_id: string;
  legal_name: string;
  display_name: string;
  verified_at: string;
  profile: BFF企业档案;
  active_verified_job_count: number;
}

export interface BFF招聘方档案补丁 {
  public_name?: string;
  title?: string;
}

export interface BFF企业管理员申请元数据 {
  legal_name: string;
  display_name: string;
  registry_key: string;
  explanation: string;
  domains: string[];
}

export type BFF企业媒体用途 = 'organization_logo' | 'office_photo' | 'company_photo';

export interface BFF企业档案替换 {
  brand_name: string;
  industry_id: string;
  company_size: BFF企业规模;
  funding_stage: BFF融资阶段;
  office_address: string;
  benefit_codes: BFF福利码[];
  work_schedule: BFF作息;
  company_intro: string;
  business_items: string[];
  office_media_ids: string[];
  company_media_ids: string[];
  product_intro: string;
  team_members: BFF团队成员[];
  logo_media_id: string;
}

export interface BFF信封<T> {
  result: T;
  meta: { request_id: string; api_version: 'v1' };
}

// ── 写入类型（属性与 OpenAPI 一一对应）──

export interface BFF资料写入 extends Omit<BFF简历资料, 'status'> {
  status: 'student' | 'employed' | 'unemployed';
}

export interface BFF经历写入 {
  company: string;
  industry_id: string;
  title: string;
  start_month: string;
  end_month?: string | null;
  description?: string;
  hidden?: boolean;
  internship?: boolean;
}

export interface BFF项目写入 {
  name: string;
  role?: string;
  result?: string;
}

export interface BFF教育写入 {
  institution_id: string;
  degree: string;
  major_id: string;
  start_month: string;
  end_month?: string | null;
}

export interface BFF证书写入 {
  name: string;
  year: number;
}

export interface BFF意向写入 {
  recruitment_type: BFFOwnerIntention['recruitment_type'];
  job_category_id: string;
  primary_location_id: string;
  alternate_location_ids: string[];
  industry_ids: string[];
  workplace_modes: BFFOwnerIntention['workplace_modes'];
  compensation: BFF意向补偿;
  graduation_month: string | null;
  internship_months: number | null;
  onsite_days_per_week: number | null;
  exclusions: BFF意向排除;
  private_preferences: string;
}

export interface BFF岗位创建 {
  publisher_mode: 'direct' | 'agency';
  // P1C Task 5：创建/补丁 body 只声明 claim；publisher_affiliation_ref /
  // publisher_organization_ref / hiring_organization_ref 与 verification status
  // 是服务端推导的只读投影（见 BFFOwnerJob），客户端不得提交。
  hiring_organization_claim: { display_name: string; legal_name: string | null };
  title: string;
  recruitment_type: BFFOwnerJob['recruitment_type'];
  category_id: string;
  location_id: string;
  office_location: string;
  workplace_mode: BFFOwnerJob['workplace_mode'];
  salary?: { lower: number; upper: number };
  annual_salary_months?: number | null;
  campus_cohort?: number | null;
  internship_months?: number | null;
  onsite_days_per_week?: number | null;
  experience_requirement: string;
  education_requirement: string;
  // P3：创建 body 里四员块整体可选（OpenAPI JobCreate 不在 required），
  // 缺省 = 服务端按全 unknown 处理；BFF岗位补丁 经 Partial 继承整个对象的补丁形态。
  hard_requirements?: BFF硬性条件;
  description: string;
  requirements: string;
  keywords?: string[];
  private_screening_preferences?: string;
}

export type BFF岗位补丁 = Partial<BFF岗位创建>;

// ── Agent 规则域 DTO（P6：agent-rules / agent-rule-proposals 的 owner 投影）──
// 字段名逐项复制自 mobile-v1 OpenAPI；闭合 enum、ID 正则与 interpreting/ready/terminal
// 的 exact key set 由 招聘数据源/Agent规则.ts 的 decoder 校验。

export type BFFAgent规则作用域 =
  | { type: 'global' }
  | { type: 'intention'; intention_id: string };

export type BFFAgent规则状态 = 'active' | 'paused' | 'archived';
export type BFFAgent规则提案状态 = 'interpreting' | 'ready' | 'accepted' | 'dismissed' | 'failed';
export type BFFAgent规则后果 = 'auto_allow' | 'auto_deny' | 'advisory' | 'mixed';

export interface BFFAgent规则 {
  rule_id: string;
  version: number;
  state: BFFAgent规则状态;
  scope: BFFAgent规则作用域;
  clause_kinds: ('information_disclosure' | 'workplace_mode' | 'work_schedule' |
    'compensation_band' | 'role_domain' | 'candidate_affiliation' |
    'qualification' | 'contact_cadence')[];
  display_text: string;
  created_at: string;
  updated_at: string;
}

export interface BFFAgent规则提案 {
  proposal_id: string;
  state: BFFAgent规则提案状态;
  normalized_text?: string;
  consequence?: BFFAgent规则后果;
  created_at?: string;
}

// ── 发现推荐域 DTO（P4：job-recommendations / candidate-recommendations / 双端委托）──
// 字段名与闭合 enum 逐项复制自 mobile-v1 OpenAPI 的 Discovery* 家族；
// exact key set、rank/score 边界与条件可空由 招聘数据源/发现推荐.ts 的 decoder 校验。

export type BFF发现方向 = 'candidate_jobs' | 'recruiter_candidates';
export type BFF委托状态 =
  | 'accepted' | 'evaluating' | 'case_started'
  | 'needs_user' | 'refused' | 'failed';
export type BFF淘汰原因 =
  | 'experience_insufficient' | 'direction_mismatch'
  | 'primary_stack_mismatch' | 'other';

export interface BFF委托摘要 {
  delegation_id: string;
  state: BFF委托状态;
  case_id: string | null;
}

export interface BFF候选岗位推荐 {
  recommendation_id: string;
  batch_id: string;
  intention_id: string;
  rank: number;
  match_score: number;
  match_reasons: string[];
  state: 'available' | 'delegating' | 'delegated';
  job: BFFCandidateJob;
  delegation: BFF委托摘要 | null;
}

export interface BFF招聘候选教育 {
  institution: string | null;
  major: string | null;
  degree: string;
  start_month: string;
  end_month: string | null;
}

export interface BFF招聘候选推荐 {
  recommendation_id: string;
  batch_id: string;
  job_id: string;
  rank: number;
  match_score: number;
  highlights: string[];
  compensation_relationship: 'overlap' | 'near_miss' | 'disjoint' | 'unknown';
  candidate_alias: string;
  experience_years: number | null;
  job_status: string;
  summary: string;
  skills: string[];
  educations: BFF招聘候选教育[];
  favorite: boolean;
  rejected: boolean;
  rejection_reason: BFF淘汰原因 | null;
  state: 'available' | 'rejected';
  delegation: BFF委托摘要 | null;
}

export interface BFF发现偏好 {
  favorite: boolean;
  rejected: boolean;
  rejection_reason: 'not_interested' | BFF淘汰原因 | null;
  revision: number;
  updated_at: string;
}

export interface BFF发现批次 {
  batch_id: string;
  direction: BFF发现方向;
  scope_ref: string;
  ranking_version: 'discovery-ranking.v1';
  count: number;
  created_at: string;
}

export interface BFF委托回执 {
  delegation_id: string;
  recommendation_id: string | null;
  state: BFF委托状态 | null;
  evaluation_id: string | null;
  case_id: string | null;
  refusal_code:
    | 'recommendation_not_found' | 'recommendation_unavailable'
    | 'delegation_not_allowed' | 'active_case_quota_reached'
    | 'delegation_cooldown' | null;
}