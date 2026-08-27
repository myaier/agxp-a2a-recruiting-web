// 集中测试样本：后续测试只通过对象展开修改单一字段，避免每个测试复制一套漂移样本。
// 时间统一使用 2026-08-24T00:00:00Z。

import type {
  BFF主体,
  BFF企业媒体,
  BFF企业档案,
  BFF企业关系,
  BFF企业管理员申请,
  BFF公开企业,
  BFF招聘方档案,
  BFF简历,
  BFFOwnerJob,
  BFFOwnerIntention,
  BFF隐私组织屏蔽,
  BFF隐私视图,
  BFF隐私快照,
  BFF隐私屏蔽回执,
  BFF组织搜索项,
  BFF组织搜索页,
} from '../数据/BFF契约';
import type { 在招岗位 } from '../数据/类型';

export const BFF主体样本: BFF主体 = {
  subject_id: 'sub_1',
  roles: [{ role: 'candidate', status: 'active' }],
  last_used_role: 'candidate',
};

export const BFF简历样本: BFF简历 = {
  profile: {
    real_name: '沈亦舟',
    work_start_year: 2021,
    status: 'employed',
    current_education: null,
    graduation_year: null,
    gender: 'male',
    birth_year: 1998,
    birth_month: 6,
  },
  profile_revision: 2,
  summary: '优势',
  summary_revision: 1,
  skills: ['TypeScript'],
  skills_revision: 3,
  experiences: [
    {
      id: 'exp_1',
      company: '云衢',
      industry: { id: 'tax_i', display_name: '互联网' },
      title: '工程师',
      start_month: '2021-01',
      end_month: null,
      description: '平台',
      hidden: true,
      internship: false,
      revision: 4,
      projects: [],
    },
  ],
  educations: [
    {
      id: 'edu_1',
      institution: { id: 'ins_1', display_name: '复旦大学' },
      degree: '本科',
      major: { id: 'tax_m', display_name: '计算机科学' },
      start_month: '2017-09',
      end_month: '2021-06',
      revision: 2,
    },
  ],
  certificates: [{ id: 'cert_1', name: 'PMP', year: 2024, revision: 1 }],
  aggregate_revision: 9,
};

export const BFF岗位样本: BFFOwnerJob = {
  job_id: 'job_1',
  publisher_mode: 'direct',
  publisher_verification_status: 'unverified',
  hiring_organization_claim: { display_name: '云衢科技', legal_name: null },
  hiring_organization_verification_status: 'unverified',
  title: 'AI 产品实习生',
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
  experience_requirement: 'none',
  education_requirement: 'bachelor',
  description: '参与产品工作',
  requirements: '在校生',
  keywords: ['Python'],
  private_screening_preferences: '',
  hard_requirements: {
    alternate_weekend_work: 'unknown',
    outsourcing_only: 'not_required',
    onsite_only: 'unknown',
    frequent_travel: 'unknown',
  },
  status: 'active',
  revision: 1,
  published_at: '2026-08-24T00:00:00Z',
  created_at: '2026-08-24T00:00:00Z',
  updated_at: '2026-08-24T00:00:00Z',
};

export const 页面岗位样本: 在招岗位 = {
  编号: 'job_1',
  名称: 'AI 产品实习生',
  薪资带: '300-500 元/天',
  状态: '在招',
  在谈数: 0,
  城市: '上海',
  办公地: '张江路 1 号',
  办公方式: '混合',
  招聘类型: '实习生',
  职位类别: '产品经理',
  筛选要求: '',
  经验要求: '不限',
  最低学历: '本科',
  职位描述: '参与产品工作',
  职位要求: '在校生',
  硬性条件: ['本科及以上'],
  职位关键词: ['Python'],
  加分关键词: ['课程项目'],
  实习月数: 3,
  每周天数: 4,
  实习转正: true,
  发布于: '2026-08-24',
};

export const BFF意向样本: BFFOwnerIntention = {
  intention_id: 'int_1',
  recruitment_type: 'internship',
  job_category: { id: 'tax_product', display_name: '产品经理' },
  primary_location: { id: 'loc_shanghai', display_name: '上海' },
  alternate_locations: [],
  industries: [],
  workplace_modes: ['hybrid'],
  compensation: { mode: 'range', lower: 300, upper: 500, annual_salary_months: null },
  salary_period: 'day',
  graduation_month: null,
  internship_months: 3,
  onsite_days_per_week: 4,
  exclusions: {
    alternate_weekend_work: 'unspecified',
    outsourcing_only: 'unspecified',
    onsite_only: 'unspecified',
    frequent_travel: 'unspecified',
  },
  private_preferences: '',
  status: 'active',
  revision: 1,
  created_at: '2026-08-24T00:00:00Z',
  updated_at: '2026-08-24T00:00:00Z',
};

// ── 组织域样本（P1C Task 1）──
// 满足 BFF契约 的 closed DTO；列表 route fixture 只能包成
// {affiliations:[BFF企业关系样本]} / {requests:[BFF企业管理员申请样本]}。

export const BFF招聘方档案样本: BFF招聘方档案 = {
  public_name: '林澈',
  title: '招聘负责人',
  personal_verification_status: 'unverified',
  verified_name: null,
  avatar_url: null,
  revision: 1,
};

export const BFF企业关系样本: BFF企业关系 = {
  affiliation_id: 'aff_1',
  organization_id: 'org_1',
  organization_display_name: '云衢科技',
  organization_status: 'active',
  status: 'verified',
  role: 'admin',
  verification_method: 'manual_admin_review',
  revision: 1,
};

export const BFF企业管理员申请样本: BFF企业管理员申请 = {
  request_id: 'req_1',
  legal_name: '上海云衢科技有限公司',
  display_name: '云衢科技',
  domains: ['yunqu.example'],
  status: 'pending',
  revision: 1,
};

export const BFF企业媒体样本: BFF企业媒体 = {
  media_id: 'media_1',
  media_type: 'image/png',
  size_bytes: 2048,
  width: 240,
  height: 240,
  url: 'https://cdn.example.com/org_1/media_1.png',
};

export const BFF企业档案样本: BFF企业档案 = {
  brand_name: '云衢科技',
  industry: { id: 'tax_fintech', display_name: '金融科技' },
  company_size: '500_1000',
  funding_stage: 'series_c',
  office_address: '上海市张江路 1 号',
  benefit_codes: ['social_insurance_housing_fund', 'stock_options'],
  work_schedule: 'two_day_weekend',
  company_intro: '做可靠的技术产品',
  business_items: ['智能招聘平台'],
  product_intro: 'AI 简历助手',
  team_members: [{ name: '林澈', title: '招聘负责人', summary: '负责招聘' }],
  logo: BFF企业媒体样本,
  office_media: [BFF企业媒体样本],
  company_media: [],
  revision: 3,
  updated_at: '2026-08-24T00:00:00Z',
};

export const BFF公开企业样本: BFF公开企业 = {
  organization_id: 'org_1',
  legal_name: '上海云衢科技有限公司',
  display_name: '云衢科技',
  verified_at: '2026-08-24T00:00:00Z',
  profile: BFF企业档案样本,
  active_verified_job_count: 2,
};

// ── 隐私域与组织搜索样本（P3 Task 1）──
// 满足 BFF契约 的 closed DTO：PrivacyView 带 updated_at（wire 全视图），
// PrivacySnapshot 只投影页面拥有的四字段；均为合成数据，无真实个人信息。

export const BFF隐私组织屏蔽样本: BFF隐私组织屏蔽 = {
  organization_id: 'org_block_1',
  organization_display_name: '云衢科技',
  organization_status: 'active',
  source: 'manual',
  created_at: '2026-08-24T00:00:00Z',
};

export const BFF隐私视图样本: BFF隐私视图 = {
  employer_privacy_enabled: true,
  disclosure_preferences: {
    current_employer: 'never',
    education: 'anonymous',
    portfolio_links: 'anonymous',
  },
  organization_blocks: [BFF隐私组织屏蔽样本],
  revision: 2,
  updated_at: '2026-08-24T00:00:00Z',
};

export const BFF隐私快照样本: BFF隐私快照 = {
  employer_privacy_enabled: true,
  disclosure_preferences: BFF隐私视图样本.disclosure_preferences,
  organization_blocks: BFF隐私视图样本.organization_blocks,
  revision: 2,
};

export const BFF屏蔽回执样本: BFF隐私屏蔽回执 = {
  organization_block: BFF隐私组织屏蔽样本,
  privacy_revision: 3,
  created_at: '2026-08-24T00:00:00Z',
};

export const BFF组织搜索项样本: BFF组织搜索项 = {
  organization_id: 'org_1',
  display_name: '云衢科技',
  legal_name: '上海云衢科技有限公司',
};

export const BFF组织搜索页样本: BFF组织搜索页 = {
  items: [BFF组织搜索项样本],
  next_cursor: null,
};