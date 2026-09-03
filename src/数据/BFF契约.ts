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
  year: number | null;
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
  year: number | null;
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
// ── 候选人附件简历域 DTO（P2：resume-files 与解析状态）──
// 字段名逐项复制自 recruitment-bff OpenAPI；解析失败码与 media type 闭合，
// 不增加协议中不存在的字段，不加入 extracted result。

export type BFF附件解析失败码 =
  | 'document_unreadable'
  | 'document_too_complex'
  | 'parser_invalid_output'
  | 'parser_temporarily_unavailable';

export type BFF附件解析状态 =
  | { status: 'not_started' }
  | { status: 'pending' | 'processing'; updated_at: string }
  | { status: 'succeeded'; parse_id: string; updated_at: string }
  | { status: 'failed'; failure_code: BFF附件解析失败码; updated_at: string };

export interface BFF附件简历版本 {
  version_id: string;
  version: number;
  size_bytes: number;
  media_type: 'application/pdf';
  sha256: string;
  created_at: string;
  parse: BFF附件解析状态;
}

export interface BFF附件简历 {
  file_id: string;
  display_name: string;
  revision: number;
  current_version: BFF附件简历版本;
  created_at: string;
  updated_at: string;
}

export interface BFF附件简历库 {
  items: BFF附件简历[];
  limits: {
    max_files: number;
    max_file_bytes: number;
    accepted_media_types: ['application/pdf'];
  };
}

export interface BFF删除回执 { deleted: true }

// ── P5 MatchCase 域 wire DTO（双端 match-cases 工作区/历史/详情/命令与 Case 叮嘱）──
// 字段名与闭合 enum 逐项复制自已准入 recruitment-bff mobile-v1 OpenAPI 的
// MatchCaseView / Candidate(Recruiter)MatchCaseWorkspaceItem(Page) /
// Candidate(Recruiter)MatchCaseDetail / MatchCaseStageSection 家族；
// exact key set、17 行状态矩阵与声明 pattern 由 招聘数据源/MatchCase.ts 的 decoder 校验。

export type P5角色 = 'candidate' | 'recruiter';
export type P5历史生命周期 = 'ended' | 'completed';
export type P5生命周期 = 'open' | 'ended' | 'completed';
export type P5阶段 =
  | 'anonymous_screening' | 'resume_submission' | 'needs_coordination' | 'intent_confirmation';
export type P5状态 =
  | 'running' | 'needs_user' | 'passed' | 'attention_required' | 'ended' | 'waiting';
export type P5步骤 =
  | 'policy_check'
  | 'candidate_evaluation'
  | 'candidate_question'
  | 'recruiter_answer'
  | 'candidate_reevaluation'
  | 'human_decision'
  | 'complete'
  | 'awaiting_candidate_resume_invitation'
  | 'awaiting_resume_parse'
  | 'screening_resume'
  | 'awaiting_recruiter_decision'
  | 'coordinating'
  | 'awaiting_candidate_decision'
  | 'awaiting_confirmations'
  | 'awaiting_candidate_confirmation'
  | 'awaiting_recruiter_confirmation'
  | 'handoff_pending';
export type P5动作 =
  | 'respond_fact'
  | 'end_screening'
  | 'accept_resume_invitation'
  | 'decline_resume_invitation'
  | 'retry_resume_readiness'
  | 'replace_resume'
  | 'decide_resume_screening'
  | 'decide_coordination'
  | 'confirm_intent'
  | 'decline_intent';

/** MatchCaseView：四端共用的裸状态。ended 携三列终局字段，completed 只留 finalized_at。 */
export interface BFFMatchCase视图 {
  case_id: string;
  lifecycle: P5生命周期;
  stage: P5阶段;
  status: P5状态;
  step: P5步骤;
  round: number;
  round_budget: number;
  needs_user: boolean;
  outcome: string | null;
  outcome_code: string | null;
  created_at: string;
  updated_at: string;
  finalized_at?: string | null;
}

/** WorkspacePublicJob + MatchCaseWorkspaceJob：Case 创建时冻结的公开职位四事实快照。 */
export interface BFF公开职位快照 {
  title: string;
  location: string;
  public_salary_range: string;
  required_skills: string[];
}
export interface BFFMatchCase工作区职位 {
  job_id: string;
  job: BFF公开职位快照;
}

/** 列表行（工作区与历史刻意共用同一 role item 形状）；公开路径禁止 resume_submission。 */
export interface BFF候选工作区项 {
  state: BFFMatchCase视图;
  needs_action: boolean;
  intention_id: string;
  job: BFFMatchCase工作区职位;
}
export interface BFF招聘工作区项 {
  state: BFFMatchCase视图;
  needs_action: boolean;
  job: BFFMatchCase工作区职位;
  candidate_alias: string;
}
export interface BFF候选工作区页 { items: BFF候选工作区项[]; next_cursor: string | null }
export interface BFF招聘工作区页 { items: BFF招聘工作区项[]; next_cursor: string | null }

/** 四阶段详情的 typed 块（checklist / transcript / instruction receipts / attachment）。 */
export interface BFFMatchCase清单项 { label: string; done: boolean }
export interface BFFMatchCase时间线项 {
  event_id: string;
  stage: P5阶段;
  kind: string;
  role: '' | P5角色;
  reason_code?: string;
  ref?: string;
  text?: string;
  occurred_at: string;
}
export interface BFFMatchCase叮嘱回执 {
  instruction_id: string;
  owner: P5角色;
  stage: P5阶段;
  expression?: string;
  occurred_at: string;
}
export interface BFFMatchCase简历附件 {
  file_id: string;
  file_version_id: string;
  display_name: string;
}
export interface BFFMatchCase阶段区 {
  stage: P5阶段;
  state: 'pending' | 'active' | 'passed' | 'ended';
  occurred_at?: string | null;
  summary: string;
  checklist: BFFMatchCase清单项[];
  transcript: BFFMatchCase时间线项[];
  instruction_receipts: BFFMatchCase叮嘱回执[];
  attachment?: BFFMatchCase简历附件;
}

export interface BFFMatchCase协同 {
  issue_id: string;
  kind: 'work_mode' | 'work_schedule' | 'travel' | 'team_and_reporting' | 'technical_direction';
  required_roles: P5角色[];
  candidate_decided: boolean;
  recruiter_decided: boolean;
}
export interface BFFMatchCase意向确认 {
  candidate: '' | 'confirm' | 'decline';
  recruiter: '' | 'confirm' | 'decline';
}
export interface BFFMatchCase终局摘要 {
  stage: P5阶段;
  outcome: string;
  reason_summary: string;
  finalized_at: string;
}

/** 双端 role detail：current_coordination / terminal_summary 缺席而非 null；对端上下文键即漂移。 */
export interface BFF候选MatchCase详情 {
  state: BFFMatchCase视图;
  needs_action: boolean;
  available_actions: P5动作[];
  stages: BFFMatchCase阶段区[];
  current_coordination?: BFFMatchCase协同;
  intent_confirmations: BFFMatchCase意向确认;
  terminal_summary?: BFFMatchCase终局摘要;
  intention_id: string;
  job: BFFMatchCase工作区职位;
  /**
   * P7 Task 6：completed + complete 时必在的已发布会话坐标（^[1-9][0-9]{0,63}$）；
   * handoff_pending / open / ended 详情必缺席 —— 与 state.step 的联合不变式由
   * 招聘数据源/MatchCase.ts 的 decoder 校验。
   */
  conversation_ref?: string;
}
export interface BFF招聘MatchCase详情 {
  state: BFFMatchCase视图;
  needs_action: boolean;
  available_actions: P5动作[];
  stages: BFFMatchCase阶段区[];
  current_coordination?: BFFMatchCase协同;
  intent_confirmations: BFFMatchCase意向确认;
  terminal_summary?: BFFMatchCase终局摘要;
  job: BFFMatchCase工作区职位;
  candidate_alias: string;
  /** P7 Task 6：同 BFF候选MatchCase详情.conversation_ref。 */
  conversation_ref?: string;
}

// ── P7 真人会话域 wire DTO（双端 /api/v1/{me|recruiter}/conversations 家族）──
// 字段名逐项复制自 recruitment-bff mobile-v1 OpenAPI 的 ConversationItem / ConversationPage /
// ConversationContext / MessagePreview / ConversationMessage / ConversationMessagesPage /
// ReadThroughResult；exact key set、坐标十进制模式、RFC3339、unread_count 安全非负整数、
// context_status↔context 联合不变式与 user_text/conversation_started 两分支由
// 招聘数据源/真人会话.ts 的 decoder 校验。context 不含真名、电话、微信或简历正文。

export type P7角色 = 'candidate' | 'recruiter';

export interface BFF会话上下文 {
  primary_label: string;
  secondary_label: string;
  job_ref?: string;
  resume_ref?: string;
}

export interface BFF消息预览 {
  message_id: string;
  sender_role: P7角色;
  preview: string;
  created_at: string;
}

export interface BFF会话项 {
  conversation_id: string;
  case_id: string;
  kind: 'human_handoff';
  last_message: BFF消息预览 | null;
  last_activity_at: string;
  unread_count: number;
  context_status: 'available' | 'unavailable';
  context?: BFF会话上下文 | null;
}

export interface BFF会话消息 {
  message_id: string;
  kind: 'user_text' | 'conversation_started';
  sender_role: P7角色 | 'system';
  content?: string | null;
  created_at: string;
}

export interface BFF会话页 { items: BFF会话项[]; next_cursor: string | null }
export interface BFF消息页 { messages: BFF会话消息[]; next_cursor: string | null }
export interface BFF已读回执 { read_through_message_id: string }

// ── P8 控制面域 wire DTO（账号安全 / 换绑 / 数据导出 / 注销 / 合规反馈与举报）──
// 字段名与闭合 enum 逐项复制自 recruitment-bff mobile-v1 OpenAPI 的
// SecurityCredential(List) / SessionSummary(List) / SecurityRevokedSessions /
// LinkAttempt + LinkNextAction / SecurityReplacementResult / DataExport /
// AccountDeletion / ComplianceFeedback(Report)Receipt 家族；exact key set、
// exp_/del_ pattern、RFC3339、安全非负计数、会话恰好一个 current、凭证至多一个
// phone_otp 与逐端点闭合错误联合由 招聘数据源/P8控制面.ts 的 decoder 校验。

export type BFF凭证提供者 = 'phone_otp' | 'wechat' | 'email_otp';

export interface BFF安全凭证 {
  credential_id: string;
  provider: BFF凭证提供者;
  display: string;
  verified_at: string;
}
export interface BFF安全凭证列表 { credentials: BFF安全凭证[] }

export interface BFF会话摘要 {
  session_id: string;
  expires_at: string;
  created_at: string;
  current: boolean;
}
export interface BFF会话摘要列表 { sessions: BFF会话摘要[] }

export interface BFF撤销会话数 { revoked_sessions: number }

export interface BFF换绑下一步 {
  type: 'enter_code' | 'redirect' | 'completed';
  expires_at?: string;
  retry_after_seconds?: number;
}
export interface BFF换绑尝试 {
  attempt_id: string;
  next_action: BFF换绑下一步;
}
export interface BFF换绑结果 {
  credential: BFF安全凭证;
  revoked_sessions: number;
  unchanged: boolean;
}

export type BFF导出状态 = 'queued' | 'running' | 'ready' | 'failed' | 'expired';
export interface BFF数据导出 {
  export_id: string;
  status: BFF导出状态;
  created_at: string;
  expires_at: string | null;
  download_ready: boolean;
}

export type BFF注销状态 = 'deletion_pending' | 'retention' | 'deleted';
export interface BFF账号注销 {
  deletion_id: string;
  status: BFF注销状态;
  retention_until: string;
}

export type BFF工单状态 = 'received' | 'reviewing' | 'resolved' | 'dismissed';
export interface BFF反馈回执 {
  ticket_id: string;
  status: BFF工单状态;
}
export interface BFF举报回执 extends BFF反馈回执 {
  block_status: 'applied' | 'not_requested';
}

// ── 候选人简历预填域 wire DTO（onboarding resume-prefill.v1 只读建议）──
// 字段名与闭合 enum 逐项复制自已冻结的 recruitment-bff mobile-v1 OpenAPI
// （agxp-monorepo@f2d7af565 的 ResumePrefill 家族）；exact key set、三个 ID grammar
// （rf_/rfv_/rp_ + 32 位小写十六进制）、scalar value/confidence 同空或同在、非空月份
// 必为真实日历月 YYYY-MM、exact 必有 match 而 unresolved 必 match:null、列表拒 null
// 与回显 source 相等由 招聘数据源/简历预填.ts 的 decoder 校验。响应不含联系方式、
// PDF 原文、证据或 provider/model：任何多余键都按契约漂移 fail closed。

export type BFF简历预填置信度 = 'high' | 'medium' | 'low';
export interface BFF简历预填标量<T> {
  value: T | null;
  confidence: BFF简历预填置信度 | null;
}
export interface BFF简历预填来源 {
  file_id: string;
  version_id: string;
  parse_id: string;
}
export type BFF简历预填目录建议 =
  | {
      source_name: BFF简历预填标量<string>;
      resolution: 'exact';
      match: { id: string; display_name: string };
    }
  | {
      source_name: BFF简历预填标量<string>;
      resolution: 'unresolved';
      match: null;
    };
export type BFF简历预填Warning原因 =
  | 'missing_required' | 'unsafe_month' | 'catalog_unresolved'
  | 'target_limit_exceeded' | 'enum_undetermined' | 'conflicting_sources';

export interface BFF简历预填项目 {
  name: BFF简历预填标量<string>;
  role: BFF简历预填标量<string>;
  result: BFF简历预填标量<string>;
}
export interface BFF简历预填经历 {
  company: BFF简历预填标量<string>;
  industry: BFF简历预填目录建议;
  title: BFF简历预填标量<string>;
  start_month: BFF简历预填标量<string>;
  end_month: BFF简历预填标量<string>;
  description: BFF简历预填标量<string>;
  internship: BFF简历预填标量<boolean>;
  projects: BFF简历预填项目[];
}
export interface BFF简历预填教育 {
  institution: BFF简历预填目录建议;
  degree: BFF简历预填标量<string>;
  major: BFF简历预填目录建议;
  start_month: BFF简历预填标量<string>;
  end_month: BFF简历预填标量<string>;
}
export interface BFF简历预填证书 {
  name: BFF简历预填标量<string>;
  year: BFF简历预填标量<number>;
}
export interface BFF简历预填建议 {
  schema_version: 'resume-prefill.v1';
  source: BFF简历预填来源;
  draft: {
    profile: {
      real_name: BFF简历预填标量<string>;
      work_start_year: BFF简历预填标量<number>;
      status: BFF简历预填标量<'student' | 'employed' | 'unemployed'>;
      current_education: BFF简历预填标量<string>;
      graduation_year: BFF简历预填标量<number>;
      gender: BFF简历预填标量<'male' | 'female'>;
      birth_year: BFF简历预填标量<number>;
      birth_month: BFF简历预填标量<number>;
    };
    summary: BFF简历预填标量<string>;
    skills: BFF简历预填标量<string>[];
    experiences: BFF简历预填经历[];
    educations: BFF简历预填教育[];
    certificates: BFF简历预填证书[];
  };
  warnings: Array<{ field_path: string; reason: BFF简历预填Warning原因 }>;
}

// ── JD PDF 建议稿导入（job-draft-imports，handoff 2026-09-03 冻结合同）──

export type BFFJD招聘类型 = 'social_full_time' | 'campus' | 'internship' | 'part_time';
export type BFFJD办公方式 = 'onsite' | 'hybrid' | 'remote';
export type BFFJD学历 = 'none' | 'associate' | 'bachelor' | 'master' | 'doctorate';
export type BFFJD经验 =
  | 'none'
  | 'one_to_three_years'
  | 'three_to_five_years'
  | 'five_plus_years'
  | 'ten_plus_years';
export type BFFJD导入失败码 =
  | 'invalid_pdf'
  | 'document_too_complex'
  | 'parser_invalid_output'
  | 'parser_temporarily_unavailable';

export interface BFFJD建议 {
  title: string | null;
  recruitment_type: BFFJD招聘类型 | null;
  workplace_mode: BFFJD办公方式 | null;
  office_location: string | null;
  description: string | null;
  requirements: string | null;
  education_requirement: BFFJD学历 | null;
  experience_requirement: BFFJD经验 | null;
  category_source_name: string | null;
  location_source_name: string | null;
  keywords: string[];
}

interface BFFJD导入基础 {
  import_id: string;
  created_at: string;
  updated_at: string;
}

export type BFFJD导入 =
  | (BFFJD导入基础 & { status: 'pending' | 'processing' })
  | (BFFJD导入基础 & { status: 'succeeded'; suggestion: BFFJD建议 })
  | (BFFJD导入基础 & { status: 'failed'; failure_code: BFFJD导入失败码 });
