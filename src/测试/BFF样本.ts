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
  BFFAgent规则,
  BFFAgent规则提案,
  BFFCandidateJob,
  BFF委托回执,
  BFF发现批次,
  BFF发现偏好,
  BFF候选岗位推荐,
  BFF招聘候选推荐,
  BFFMatchCase视图,
  BFFMatchCase工作区职位,
  BFFMatchCase阶段区,
  BFFMatchCase终局摘要,
  BFF候选MatchCase详情,
  BFF招聘MatchCase详情,
  BFF候选工作区项,
  BFF招聘工作区项,
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
  structured_requirements_confirmed: true,
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
  // 与 BFF岗位样本.hard_requirements（unknown/not_required/unknown/unknown）逐档对应
  硬性事实: { 大小周: '未说明', 纯外包乙方: '不要求', 全现场办公: '未说明', 频繁出差: '未说明' },
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

// ── Agent 规则域样本（P6 Task 1）──
// ID 满足 mobile-v1 OpenAPI 的 ^rul_|arp|int_[0-9a-f]{32}$，时间用固定 UTC。
// 正向 fixture 用 mixed 后果，使其同时满足实现与 accept 文案；auto_deny 与 advisory
// 的就绪回执用例放在 Agent规则.test.ts 的『auto_deny 与 advisory 的就绪回执…』一条里，
// 单一后果字段只作展示事实，不作为可操作性断言。

export const BFFAgent规则样本: BFFAgent规则 = {
  rule_id: 'rul_0123456789abcdef0123456789abcdef',
  version: 3,
  state: 'active',
  scope: { type: 'global' },
  clause_kinds: ['work_schedule'],
  display_text: '大小周不谈',
  created_at: '2026-08-27T01:00:00Z',
  updated_at: '2026-08-27T02:00:00Z',
};

export const BFF意向Agent规则样本: BFFAgent规则 = {
  rule_id: 'rul_fedcba9876543210fedcba9876543210',
  version: 1,
  state: 'active',
  scope: { type: 'intention', intention_id: 'int_0123456789abcdef0123456789abcdef' },
  clause_kinds: ['work_schedule'],
  display_text: '大小周不谈',
  created_at: '2026-08-27T01:00:00Z',
  updated_at: '2026-08-27T01:30:00Z',
};

export const BFFAgent规则解释中提案样本: BFFAgent规则提案 = {
  proposal_id: 'arp_0123456789abcdef0123456789abcdef',
  state: 'interpreting',
  created_at: '2026-08-27T02:03:00Z',
};

export const BFFAgent规则就绪提案样本: BFFAgent规则提案 = {
  proposal_id: 'arp_fedcba9876543210fedcba9876543210',
  state: 'ready',
  normalized_text: '双休岗位可推进，大小周岗位拦下',
  consequence: 'mixed',
  created_at: '2026-08-27T02:05:00Z',
};

export const BFFAgent规则失败提案样本: BFFAgent规则提案 = {
  proposal_id: 'arp_ffffffffffffffffffffffffffffffff',
  state: 'failed',
  failure_code: 'agent_unavailable',
};

// ── 发现推荐域样本（P4 Task 1）──
// 满足 BFF契约 的 closed P4 DTO：CandidateJob 是 BFF岗位样本去掉 owner-only 列的公开投影；
// 候选直投 Job 的回执 recommendation_id 为 null（选择坐标是 job），招聘回执的
// recommendation_id 与所选卡的 rec_ 坐标一致；均为合成数据，无真实个人信息。

export const BFFCandidateJob样本: BFFCandidateJob = {
  job_id: 'job_1',
  publisher_verification_status: 'unverified',
  hiring_organization_verification_status: 'unverified',
  hiring_organization_claim: { display_name: '云衢科技', legal_name: null },
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
  structured_requirements_confirmed: true,
  description: '参与产品工作',
  requirements: '在校生',
  keywords: ['Python'],
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

export const BFF发现批次样本: BFF发现批次 = {
  batch_id: 'bat_c1',
  direction: 'candidate_jobs',
  scope_ref: 'int_1',
  ranking_version: 'discovery-ranking.v1',
  count: 1,
  created_at: '2026-08-24T00:00:00Z',
};

export const BFF招聘发现批次样本: BFF发现批次 = {
  batch_id: 'bat_r1',
  direction: 'recruiter_candidates',
  scope_ref: 'job_1',
  ranking_version: 'discovery-ranking.v1',
  count: 1,
  created_at: '2026-08-24T00:00:00Z',
};

export const BFF候选岗位推荐样本: BFF候选岗位推荐 = {
  recommendation_id: 'rec_c1',
  batch_id: 'bat_c1',
  intention_id: 'int_1',
  rank: 1,
  match_score: 92,
  match_reasons: ['direction_match'],
  state: 'available',
  structured_requirements_confirmed: true,
  job: BFFCandidateJob样本,
  delegation: null,
};

export const BFF招聘候选推荐样本: BFF招聘候选推荐 = {
  recommendation_id: 'rec_r1',
  batch_id: 'bat_r1',
  job_id: 'job_1',
  rank: 2,
  match_score: 87,
  highlights: ['full_stack'],
  compensation_relationship: 'overlap',
  candidate_alias: '候选人甲',
  experience_years: 4,
  job_status: 'employed',
  summary: '四年全栈经验',
  skills: ['TypeScript', 'React'],
  educations: [
    { institution: '复旦大学', major: '计算机科学', degree: '本科', start_month: '2017-09', end_month: '2021-06' },
  ],
  favorite: false,
  rejected: false,
  rejection_reason: null,
  state: 'available',
  structured_requirements_confirmed: true,
  delegation: null,
};

export const BFF候选委托回执样本: BFF委托回执 = {
  delegation_id: 'del_c1',
  recommendation_id: null,
  state: 'accepted',
  evaluation_id: null,
  case_id: null,
  refusal_code: null,
  failure_code: null,
};

export const BFF招聘委托回执样本: BFF委托回执 = {
  delegation_id: 'del_r1',
  recommendation_id: 'rec_r1',
  state: 'accepted',
  evaluation_id: null,
  case_id: null,
  refusal_code: null,
  failure_code: null,
};

export const BFF委托失败回执样本: BFF委托回执 = {
  delegation_id: 'del_failure_1',
  recommendation_id: BFF候选岗位推荐样本.recommendation_id,
  state: 'failed',
  evaluation_id: null,
  case_id: null,
  refusal_code: null,
  failure_code: 'delegation_agent_unavailable',
};

export const BFF发现偏好样本: BFF发现偏好 = {
  favorite: false,
  rejected: true,
  rejection_reason: 'direction_mismatch',
  revision: 2,
  updated_at: '2026-08-24T00:00:00Z',
};

// ── P5 MatchCase 域样本（P5 Task 1）──
// wire 形状逐项来自已准入 mobile-v1 OpenAPI 的 MatchCase 家族与 17 行状态矩阵；
// ID 满足声明的 ^int_|job_|cdi_|candidate- 等模式，时间统一 2026-08-29T…Z；
// 列表行刻意不带 resume_submission（公开列表/历史路径禁止）。均为合成数据。

export const P5状态视图Wire: BFFMatchCase视图 = {
  case_id: 'mc_1',
  lifecycle: 'open',
  stage: 'anonymous_screening',
  status: 'running',
  step: 'policy_check',
  round: 0,
  round_budget: 3,
  needs_user: false,
  outcome: null,
  outcome_code: null,
  created_at: '2026-08-29T01:00:00Z',
  updated_at: '2026-08-29T02:00:00Z',
};

export const P5已终止状态Wire: BFFMatchCase视图 = {
  ...P5状态视图Wire,
  lifecycle: 'ended',
  status: 'ended',
  step: 'complete',
  outcome: 'user_ended',
  outcome_code: 'user_ended',
  finalized_at: '2026-08-29T03:00:00Z',
};

export const P5已完成状态Wire: BFFMatchCase视图 = {
  ...P5状态视图Wire,
  lifecycle: 'completed',
  stage: 'intent_confirmation',
  status: 'passed',
  step: 'handoff_pending',
  finalized_at: '2026-08-29T03:00:00Z',
};

export const P5工作区职位Wire: BFFMatchCase工作区职位 = {
  job_id: 'job_0123456789abcdef0123456789abcdef',
  job: {
    title: 'AI 产品实习生',
    location: '上海',
    public_salary_range: '300-500 元/天',
    required_skills: ['Python'],
  },
};

export const P5阶段区组Wire: BFFMatchCase阶段区[] = [
  {
    stage: 'anonymous_screening',
    state: 'active',
    occurred_at: '2026-08-29T01:10:00Z',
    summary: '匿名初筛进行中',
    checklist: [{ label: '基础事实已答', done: true }],
    transcript: [
      {
        event_id: 'evt_1',
        stage: 'anonymous_screening',
        kind: 'supplementary_question',
        role: 'candidate',
        ref: 'prompt_1',
        text: '每周可以到岗几天？',
        occurred_at: '2026-08-29T01:10:00Z',
      },
    ],
    instruction_receipts: [
      {
        instruction_id: 'aci_0123456789abcdef0123456789abcdef',
        owner: 'candidate',
        stage: 'anonymous_screening',
        expression: '工作日 10:00-19:00 联系',
        occurred_at: '2026-08-29T01:05:00Z',
      },
    ],
  },
  { stage: 'resume_submission', state: 'pending', summary: '简历提交未开始', checklist: [], transcript: [], instruction_receipts: [] },
  { stage: 'needs_coordination', state: 'pending', summary: '差异协同未开始', checklist: [], transcript: [], instruction_receipts: [] },
  { stage: 'intent_confirmation', state: 'pending', summary: '意向确认未开始', checklist: [], transcript: [], instruction_receipts: [] },
];

export const P5终局摘要Wire: BFFMatchCase终局摘要 = {
  stage: 'anonymous_screening',
  outcome: 'user_ended',
  reason_summary: 'user_ended',
  finalized_at: '2026-08-29T03:00:00Z',
};

export const P5候选详情Wire: BFF候选MatchCase详情 = {
  state: P5状态视图Wire,
  needs_action: true,
  available_actions: ['respond_fact', 'end_screening'],
  stages: P5阶段区组Wire,
  intent_confirmations: { candidate: '', recruiter: '' },
  intention_id: 'int_0123456789abcdef0123456789abcdef',
  job: P5工作区职位Wire,
};

export const P5招聘详情Wire: BFF招聘MatchCase详情 = {
  state: P5状态视图Wire,
  needs_action: false,
  available_actions: [],
  stages: P5阶段区组Wire,
  intent_confirmations: { candidate: '', recruiter: '' },
  job: P5工作区职位Wire,
  candidate_alias: 'candidate-0123456789ab',
};

export const P5候选工作区项Wire: BFF候选工作区项 = {
  state: P5状态视图Wire,
  needs_action: true,
  intention_id: 'int_0123456789abcdef0123456789abcdef',
  job: P5工作区职位Wire,
};

export const P5招聘工作区项Wire: BFF招聘工作区项 = {
  state: P5状态视图Wire,
  needs_action: false,
  job: P5工作区职位Wire,
  candidate_alias: 'candidate-0123456789ab',
};
