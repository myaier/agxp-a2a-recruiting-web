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
  description: string;
  requirements: string;
  keywords?: string[];
  private_screening_preferences?: string;
}

export type BFF岗位补丁 = Partial<BFF岗位创建>;