// 展示资料域测试样本：release/0.2.5 展示字段（JobOrganizationSummary / SafeJobDetail /
// RecruiterCandidateResume 家族与 CaseCandidateIdentity）的闭合 DTO 样本。
// 新合同正常样本补显式 null（不把缺键默认化）；故意缺键的负例由各测试文件自己展开改造。
// 时间统一 2026-08-24T00:00:00Z；均为合成数据，无真实个人信息。

import type {
  BFF候选身份,
  BFF公司摘要,
  BFF安全职位资料,
  BFF安全简历经历,
  BFF招聘推荐详情,
  BFF候选在线简历,
} from '../数据/BFF契约';
import { BFF招聘候选推荐样本 } from './BFF样本';

/** 完整公司摘要：公开坐标 + 行业引用 + 开放 string 短码 + BFF 媒体路由。 */
export const BFF公司摘要样本: BFF公司摘要 = {
  organization_id: 'org_1',
  display_name: '云衢科技',
  industry: { id: 'tax_fintech', display_name: '金融科技' },
  company_size: '500_1000',
  funding_stage: 'series_c',
  logo: {
    media_id: 'media_1',
    media_type: 'image/png',
    size_bytes: 2048,
    width: 240,
    height: 240,
    url: 'https://cdn.example.com/org_1/media_1.png',
  },
};

/** claim-only 岗位的合法摘要：只答声明显示名，其余成员显式 null。 */
export const BFF公司摘要声明样本: BFF公司摘要 = {
  organization_id: null,
  display_name: '云衢科技',
  industry: null,
  company_size: null,
  funding_stage: null,
  logo: null,
};

/** SafeJobDetail 完整样本：25 键全部在场（该空为 null 的给显式 null）。 */
export const BFF安全职位资料样本: BFF安全职位资料 = {
  title: 'AI 产品实习生',
  description: '参与产品工作',
  requirements: '在校生',
  recruitment_type: 'internship',
  category: { id: 'tax_product', display_name: '产品经理' },
  location: { id: 'loc_shanghai', display_name: '上海' },
  office_location: '张江路 1 号',
  workplace_mode: 'hybrid',
  salary_lower: 300,
  salary_upper: 500,
  salary_period: 'day',
  annual_salary_months: null,
  campus_cohort: null,
  internship_months: 3,
  onsite_days_per_week: 4,
  experience_requirement: null,
  education_requirement: '本科',
  hard_requirements: {
    alternate_weekend_work: 'unknown',
    outsourcing_only: 'not_required',
    onsite_only: 'unknown',
    frequent_travel: 'unknown',
  },
  structured_requirements_confirmed: false,
  keywords: [],
  organization: BFF公司摘要样本,
  company_intro: '做可靠的技术产品',
  office_address: '上海市张江路 1 号',
  benefit_codes: ['social_insurance_housing_fund', 'stock_options'],
  publisher_profile: {
    public_name: '林澈',
    title: '招聘负责人',
    personal_verification_status: 'verified',
    avatar_url: null,
  },
};

/** SafeResumeExperience 完整样本：ongoing 经历 + 一个项目，false 实习原样保留。 */
export const BFF安全简历经历样本: BFF安全简历经历 = {
  company: '云衢',
  industry: '互联网',
  title: '工程师',
  start_month: '2021-01',
  end_month: null,
  description: '平台研发',
  internship: false,
  projects: [{ name: '推荐引擎', role: '负责人', result: '转化提升 12%' }],
};

/** RecruiterCandidateResume 完整样本：七键全在场，缺源区域显式 null、读了但空是 []。 */
export const BFF候选在线简历样本: BFF候选在线简历 = {
  summary: {
    gender: 'female',
    experience_years: 5,
    job_status: 'employed',
    degree: '本科',
    latest_experience: { company: '示例公司', title: '软件工程师' },
    latest_education: { institution: '示例大学', major: '计算机科学' },
    personal_highlights: ['带领5人团队交付'],
  },
  self_description: '四年全栈经验',
  skills: ['TypeScript', 'React'],
  experiences: [BFF安全简历经历样本],
  educations: [
    { institution: '复旦大学', major: '计算机科学', degree: '本科', start_month: '2017-09', end_month: '2021-06' },
  ],
  expectation: {
    recruitment_type: 'social_full_time',
    job_category: { id: 'tax_product', display_name: '产品经理' },
    locations: [{ id: 'loc_shanghai', display_name: '上海' }],
    workplace_modes: ['hybrid', 'remote'],
  },
  compensation_relationship: 'overlap',
};

/** CaseCandidateIdentity：disclosed 完整档与 anonymous 恒三 null 档。 */
export const BFF候选身份披露样本: BFF候选身份 = {
  state: 'disclosed',
  name: '沈亦舟',
  avatar_url: 'https://cdn.example.com/case/avatar_1.png',
  disclosed_at: '2026-08-24T00:00:00Z',
};

export const BFF候选身份匿名样本: BFF候选身份 = {
  state: 'anonymous',
  name: null,
  avatar_url: null,
  disclosed_at: null,
};

/** DiscoveryRecruiterDetail 样本：列表卡坐标 + 恒在场的 candidate_resume 正文。 */
export const BFF招聘推荐详情样本: BFF招聘推荐详情 = {
  ...BFF招聘候选推荐样本,
  candidate_resume: BFF候选在线简历样本,
};

/** 详情的合法缺源档：卡片正常可读但无可用简历，显式 null 不是降级卡。 */
export const BFF招聘推荐详情无简历样本: BFF招聘推荐详情 = {
  ...BFF招聘候选推荐样本,
  candidate_resume: null,
};