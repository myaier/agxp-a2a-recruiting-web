// e2e/fixtures/展示字段接线.ts
// 展示字段接线（release/0.2.5）Task 7：path+method 白名单 HTTP fixture（仅测试使用）。
//
// 与 e2e/fixtures/P1展示统一.ts 同一白名单纪律（复用其 事件桩 导出）：
//   · 只应答本任务触达的 path+method：双端启动水合 + 四列表 + 独立职位/匿名简历两详情
//     + 两端 Case 资料 Tab + pre-Case 聚合 + 公开企业补读；
//   · 未知 API 一律记录并返回受控 503 错误，绝不放行真实网络；
//   · 标记值（展接FIX / wiring- 前缀）只存在于 fixture，断言页面展示它们即证明渲染来自
//     HTTP 而非 Mock；
//   · fixtures 明确模拟新协议：release/0.2.5 的 required 键（CandidateJob.organization、
//     NegotiationCard/Detail 的 match_score/job_detail、招聘行/详情的
//     match_score/candidate_identity/candidate_resume）全在场，不冒充真实后端验收。
//
// 数据场景（场景名 → 覆盖）：
//   完整     —— 四列表 + 两详情 + 两端 Case + pre-Case；含 真实 0 分、长公司名/长文本、
//               多段教育/项目、真实媒体 URL（logo-ok）与加载失败（logo-broken）、
//               已披露身份带头像 URL（红线：只解码、零头像请求）。
//   刷新为空 —— me/negotiations 无游标读第 1 次有值、第 2 次起合法空页（数据刷新有值→空）。
//
// cdn.fixture.example 的媒体由本 fixture 自答：wiring-avatar-* 一律 404（若被请求即红线
// 违规，测试按请求记录断言零次）；wiring-logo-broken 404 走 UI 加载失败回退；其余回 1px PNG。

import type { Page, Route } from '@playwright/test';
import { 安装P1事件桩 } from './P1展示统一';

export type 展接线角色 = 'candidate' | 'recruiter';
export type 展接线场景名 = '完整' | '刷新为空';

export interface 展接线请求记录 {
  method: string;
  path: string;
  body: unknown;
}

export interface 展接线路由结果 {
  /** 本页全部 /api/v1 请求（含白名单外被拒的）：断言请求边界与未知 API 为零用 */
  请求: 展接线请求记录[];
}

// ── 编号（合同 ID 模式：int_/job_/mc_/dlg_ + 32 hex）──────────────────────────
const 编号 = {
  意向: 'int_00112233445566778899aabbccddee01',
  职位A: 'job_00112233445566778899aabbccddee01',
  职位B: 'job_00112233445566778899aabbccddee02',
  职位C: 'job_00112233445566778899aabbccddee03',
  职位D: 'job_00112233445566778899aabbccddee04',
  组织A: 'org-wire-01',
  组织D: 'org-wire-04',
  连续甲: 'mc_00112233445566778899aabbccddee01',
  连续乙: 'dlg_00112233445566778899aabbccddee02',
  连续丙: 'mc_00112233445566778899aabbccddee03',
  招聘岗位: 'job-fixture-wire-r1',
  招聘推荐: 'rec-fixture-wire-r1',
  招聘Case: 'mc-fixture-wire-s1',
  招聘Case老: 'mc-fixture-wire-legacy',
} as const;

// ── 标记值（只存在于 fixture；页面展示即证明渲染来自 HTTP 拦截边界）──────────────
const 标记 = {
  企业A: '展接FIX 云衢科技',
  企业B: '展接FIX 星河科技',
  企业C: '展'.repeat(48),
  企业D: '展接FIX 局部公司',
  冻结企业: '展接FIX 冻结企业',
  职位A: '展接FIX 交易中台架构师',
  职位B: '展接FIX 缺口补齐工程师',
  职位C: '测'.repeat(80),
  职位D: '展接FIX 局部空岗位',
  薪资A: '60-80K',
  候选别名: 'candidate-001122334455',
  简历优势: '展接FIX 个人优势标记',
} as const;

const 时间戳 = '2026-09-10T09:00:00Z';
const LOGO_OK = 'https://cdn.fixture.example/wiring-logo-ok.png';
const LOGO_BROKEN = 'https://cdn.fixture.example/wiring-logo-broken.png';
const AVATAR_OK = 'https://cdn.fixture.example/wiring-avatar-ok.png';

/** 1px PNG：媒体路由的成功应答体（logo-ok 等真实媒体 URL 的合法图片）。 */
const PNG一像素 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function 信封<T>(result: T): { result: T; meta: { request_id: string; api_version: 'v1' } } {
  return { result, meta: { request_id: 'wiring-fixture-req', api_version: 'v1' } };
}

// ── 启动水合的最小合法载荷（值语义照抄 P1展示统一.ts 已验证 fixture）──────────────

function 主体(role: 展接线角色) {
  return {
    subject_id: 'subj-wiring-fixture-001',
    roles: [{ role, status: 'active' }],
    last_used_role: role,
  };
}

const 简历 = {
  profile: {
    real_name: '展接FIX 候选人',
    work_start_year: 2019,
    status: 'employed',
    current_education: null,
    graduation_year: null,
    gender: null,
    birth_year: null,
    birth_month: null,
  },
  profile_revision: 1,
  summary: 标记.简历优势,
  summary_revision: 1,
  skills: ['Go', '分布式事务'],
  skills_revision: 1,
  experiences: [],
  educations: [
    {
      id: 'edu-fixture-wiring',
      institution: { id: 'inst-fixture-wiring', display_name: '展接FIX 大学' },
      degree: '本科',
      major: { id: 'major-fixture-wiring', display_name: '展接FIX 专业' },
      start_month: '2015-09',
      end_month: '2019-06',
      revision: 1,
    },
  ],
  certificates: [],
  aggregate_revision: 1,
};

const 意向 = {
  intention_id: 编号.意向,
  recruitment_type: 'social_full_time',
  job_category: { id: 'job-fixture-wiring', display_name: '后端工程师' },
  primary_location: { id: 'loc-fixture-wiring', display_name: '展接FIX 市' },
  alternate_locations: [],
  industries: [],
  workplace_modes: ['onsite'],
  compensation: { mode: 'range', lower: 30, upper: 50, annual_salary_months: 15 },
  salary_period: 'month',
  graduation_month: null,
  internship_months: null,
  onsite_days_per_week: null,
  exclusions: {
    alternate_weekend_work: 'unspecified',
    outsourcing_only: 'unspecified',
    onsite_only: 'unspecified',
    frequent_travel: 'unspecified',
  },
  private_preferences: '',
  status: 'active',
  revision: 1,
  created_at: 时间戳,
  updated_at: 时间戳,
};

const 隐私 = {
  employer_privacy_enabled: true,
  disclosure_preferences: {
    current_employer: 'never',
    education: 'resume_submission',
    portfolio_links: 'anonymous',
  },
  organization_blocks: [],
  revision: 1,
  updated_at: 时间戳,
};

const 附件空库 = {
  items: [],
  limits: { max_files: 3, max_file_bytes: 10_485_760, accepted_media_types: ['application/pdf'] },
};

const 账号档案 = { avatar_url: null, revision: 0, updated_at: null };

const MatchCase摘要零 = {
  open_total: 0,
  open_anonymous_screening_total: 0,
  open_needs_action_total: 0,
  ended_total: 0,
  completed_total: 0,
};

// ── 展示资料（release/0.2.5）闭合 wire 构造 ─────────────────────────────────────

/** JobOrganizationSummary：六键全 required；非 null 档给真实 logo 媒体 URL。 */
function 组织摘要(覆盖: Partial<{
  organization_id: string | null;
  display_name: string | null;
  logo: Record<string, unknown> | null;
}> = {}): Record<string, unknown> {
  return {
    organization_id: 编号.组织A,
    display_name: 标记.企业A,
    industry: { id: 'tax_fintech', display_name: '金融科技' },
    company_size: '500_1000',
    funding_stage: 'series_c',
    logo: {
      media_id: 'media-wire-logo-ok',
      media_type: 'image/png',
      size_bytes: 2048,
      width: 240,
      height: 240,
      url: LOGO_OK,
    },
    ...覆盖,
  };
}

/** SafeJobDetail：25 键全 required（该空为 null 的给显式 null）。 */
function 冻结职位资料(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 标记.职位A,
    description: '展接FIX 冻结岗位描述：与创建时的 Case 同一冻结区。',
    requirements: '展接FIX 冻结岗位要求：Go 主栈，分布式事务经验。',
    recruitment_type: 'social_full_time',
    category: { id: 'job-fixture-wiring', display_name: '后端工程师' },
    location: { id: 'loc-fixture-wiring', display_name: '展接FIX 市' },
    office_location: '展接FIX 市 Fixture 路 8 号',
    workplace_mode: 'hybrid',
    salary_lower: 60,
    salary_upper: 80,
    salary_period: 'month',
    annual_salary_months: null,
    campus_cohort: null,
    internship_months: null,
    onsite_days_per_week: null,
    experience_requirement: '5 年以上后端经验',
    education_requirement: '本科及以上',
    hard_requirements: {
      alternate_weekend_work: 'unknown',
      outsourcing_only: 'unknown',
      onsite_only: 'unknown',
      frequent_travel: 'unknown',
    },
    structured_requirements_confirmed: true,
    keywords: ['Go'],
    organization: 组织摘要({ display_name: 标记.冻结企业 }),
    company_intro: '展接FIX 冻结公司简介',
    office_address: '展接FIX 市 Fixture 路 8 号',
    benefit_codes: ['social_insurance_housing_fund', 'stock_options'],
    publisher_profile: {
      public_name: '展接FIX 招聘负责人',
      title: '招聘负责人',
      personal_verification_status: 'verified',
      avatar_url: null,
    },
    ...覆盖,
  };
}

/** RecruiterCandidateResume：七键全 required；两条经历（各带项目）+ 两条教育 = 多段样本。 */
function 在线简历(): Record<string, unknown> {
  return {
    summary: {
      gender: 'male',
      experience_years: 9,
      job_status: 'employed',
      degree: '硕士',
      latest_experience: { company: '展接FIX 现任公司', title: '交易中台研发专家' },
      latest_education: { institution: '展接FIX 大学', major: '计算机科学' },
      personal_highlights: ['展接FIX 带过 8 人小组'],
    },
    self_description: '展接FIX 自我描述：主导交易网关重建与峰值稳定性治理。',
    skills: ['Go', '分布式事务', '高并发架构'],
    experiences: [
      {
        company: '展接FIX 现任公司', industry: '互联网', title: '交易中台研发专家',
        start_month: '2021-02', end_month: null,
        description: '展接FIX 经历描述：主导网关多活改造。', internship: false,
        projects: [
          { name: '展接FIX 多活改造', role: '模块负责人', result: '切换秒级完成' },
          { name: '展接FIX 压测平台', role: '负责人', result: '支撑三次大促' },
        ],
      },
      {
        company: null, industry: null, title: null,
        start_month: '2019-06', end_month: '2021-01',
        description: null, internship: false, projects: [],
      },
    ],
    educations: [
      { institution: '展接FIX 大学', major: '计算机科学', degree: '硕士', start_month: '2014-09', end_month: '2017-06' },
      { institution: null, major: null, degree: '本科', start_month: '2010-09', end_month: '2014-06' },
    ],
    expectation: {
      recruitment_type: 'social_full_time',
      job_category: { id: 'job-fixture-wiring', display_name: '后端工程师' },
      locations: [{ id: 'loc-fixture-wiring', display_name: '展接FIX 市' }],
      workplace_modes: ['hybrid'],
    },
    compensation_relationship: 'overlap',
  };
}

/** CaseCandidateIdentity：anonymous 恒三 null；disclosed 给真名 + 头像 URL（红线：UI 零请求）。 */
function 候选身份(disclosed: boolean): Record<string, unknown> {
  return disclosed
    ? { state: 'disclosed', name: '展接FIX 候选真名', avatar_url: AVATAR_OK, disclosed_at: 时间戳 }
    : { state: 'anonymous', name: null, avatar_url: null, disclosed_at: null };
}

// ── CandidateJob（19+1 键：release/0.2.5 增 organization）────────────────────────

interface 岗位覆盖形 {
  job_id?: string;
  title?: string;
  organization?: Record<string, unknown>;
  hiring_organization_ref?: string | undefined;
  publisher_profile?: Record<string, unknown> | undefined;
  description?: string;
  requirements?: string;
}

function 候选岗位(覆盖: 岗位覆盖形 = {}): Record<string, unknown> {
  return {
    job_id: 覆盖.job_id ?? 编号.职位A,
    publisher_verification_status: 'verified',
    hiring_organization_verification_status: 'verified',
    hiring_organization_claim: { display_name: 标记.企业A, legal_name: null },
    organization: 覆盖.organization ?? 组织摘要(),
    title: 覆盖.title ?? 标记.职位A,
    recruitment_type: 'social_full_time',
    category: { id: 'job-fixture-wiring', display_name: '后端工程师' },
    location: { id: 'loc-fixture-wiring', display_name: '展接FIX 市' },
    office_location: '展接FIX 市 Fixture 路 8 号',
    workplace_mode: 'hybrid',
    salary_lower: 60,
    salary_upper: 80,
    salary_period: 'month',
    annual_salary_months: null,
    campus_cohort: null,
    internship_months: null,
    onsite_days_per_week: null,
    experience_requirement: 'three_to_five_years',
    education_requirement: 'bachelor',
    structured_requirements_confirmed: true,
    hard_requirements: {
      alternate_weekend_work: 'unknown',
      outsourcing_only: 'unknown',
      onsite_only: 'unknown',
      frequent_travel: 'unknown',
    },
    description: 覆盖.description ?? '展接FIX 岗位描述：负责跨端展示统一回归。\n参与高可用架构设计。',
    requirements: 覆盖.requirements ?? '展接FIX 岗位要求：熟悉分布式一致性。\n有大规模系统经验。',
    keywords: ['展接FIX'],
    status: 'active',
    revision: 1,
    published_at: 时间戳,
    created_at: 时间戳,
    updated_at: 时间戳,
    // 组织路由坐标默认给 A 档的 ref（公开企业补读依赖它）；claim-only 用例显式传 undefined 去掉
    ...('hiring_organization_ref' in 覆盖
      ? 覆盖.hiring_organization_ref === undefined
        ? {}
        : { publisher_organization_ref: 覆盖.hiring_organization_ref, hiring_organization_ref: 覆盖.hiring_organization_ref }
      : { publisher_organization_ref: 编号.组织A, hiring_organization_ref: 编号.组织A }),
    publisher_profile: 覆盖.publisher_profile ?? {
      public_name: '展接FIX 招聘负责人',
      title: '招聘负责人',
      personal_verification_status: 'verified',
    },
  };
}

function 推荐卡(job: Record<string, unknown>, match_score: number): Record<string, unknown> {
  return {
    recommendation_id: `rec_${String(match_score).padStart(2, '0')}`,
    batch_id: 'bat_wiring_fixture_c1',
    intention_id: 编号.意向,
    rank: 1,
    match_score,
    match_reasons: ['direction_match', 'compensation_overlap'],
    state: 'available',
    structured_requirements_confirmed: true,
    job,
    delegation: null,
  };
}

// ── P5 Case 域 wire（候选聚合 case_detail / 招聘详情共用）────────────────────────

function Case状态(caseId: string, stage: string, step: string, status = 'running'): Record<string, unknown> {
  return {
    case_id: caseId,
    lifecycle: 'open',
    stage,
    status,
    step,
    round: 0,
    round_budget: 3,
    needs_user: false,
    outcome: null,
    outcome_code: null,
    created_at: 时间戳,
    updated_at: 时间戳,
  };
}

function 阶段区组(当前阶段: string): Record<string, unknown>[] {
  return ['anonymous_screening', 'resume_submission', 'needs_coordination', 'intent_confirmation'].map(
    (stage) => ({
      stage,
      state: stage === 当前阶段 ? 'active' : 'pending',
      occurred_at: stage === 当前阶段 ? 时间戳 : null,
      summary: `展接FIX ${stage} 段摘要`,
      checklist: [],
      transcript: [],
      instruction_receipts: [],
      ...(stage === 'anonymous_screening' ? { screening_records: { messages: [], summaries: [] } } : {}),
    }),
  );
}

function 工作区职位(title: string): Record<string, unknown> {
  return {
    job_id: 编号.职位A,
    job: {
      title,
      location: '展接FIX 市',
      public_salary_range: 标记.薪资A,
      required_skills: ['Go'],
    },
  };
}

/** 候选 P5 详情 wire（解P5详情 role=candidate 的闭合键集）。 */
function 候选Case详情(caseId: string, 覆盖: { matchScore: number | null; jobDetail: Record<string, unknown> | null }): Record<string, unknown> {
  return {
    state: Case状态(caseId, 'anonymous_screening', 'policy_check'),
    needs_action: false,
    available_actions: [],
    stages: 阶段区组('anonymous_screening'),
    intent_confirmations: { candidate: '', recruiter: '' },
    job: 工作区职位(标记.职位A),
    intention_id: 编号.意向,
    match_score: 覆盖.matchScore,
    job_detail: 覆盖.jobDetail,
  };
}

/** 招聘 P5 详情 wire（解P5详情 role=recruiter 的闭合键集）。 */
function 招聘Case详情(caseId: string, 覆盖: {
  matchScore: number | null;
  jobDetail: Record<string, unknown> | null;
  resume: Record<string, unknown> | null;
  disclosed: boolean;
}): Record<string, unknown> {
  return {
    state: Case状态(caseId, 'resume_submission', 'screening_resume', 'waiting'),
    needs_action: false,
    available_actions: [],
    stages: 阶段区组('resume_submission'),
    intent_confirmations: { candidate: '', recruiter: '' },
    job: 工作区职位(标记.职位A),
    candidate_alias: 标记.候选别名,
    match_score: 覆盖.matchScore,
    job_detail: 覆盖.jobDetail,
    candidate_resume: 覆盖.resume,
    candidate_identity: 候选身份(覆盖.disclosed),
  };
}

// ── 候选连续代谈（me/negotiations）wire ─────────────────────────────────────────

function 连续职位(r: 连续记录形): Record<string, unknown> {
  return {
    job_id: 编号.职位A,
    title: r.title,
    location: '展接FIX 市',
    public_salary_range: 标记.薪资A,
    availability: 'available',
    // review-r1：缺省给已知组织/技能（乙 pre-Case 演示 job_detail=null 时的同响应回退）；
    // 丙 legacy 显式双 null —— 老记录外层成员也未知，不冒充已知。
    organization: 组织摘要({ display_name: r.组织显示名 === undefined ? '展接FIX 企业' : r.组织显示名, logo: null }),
    required_skills: r.技能 === undefined ? ['Go'] : r.技能,
    recruitment_type: 'social_full_time',
    workplace_mode: 'hybrid',
    annual_salary_months: 15,
  };
}

interface 连续记录形 {
  recordId: string;
  recordKind: 'delegation' | 'case';
  caseId: string | null;
  phase: 'accepted' | 'case_started';
  matchScore: number | null;
  /** 卡面标题（case_started 用 Case 职位名） */
  title: string;
  /** review-r1：外层 NegotiationJob 的组织显示名与技能；缺省 = 常规已知值（乙 演示顶栏/摘要回退） */
  组织显示名?: string | null;
  技能?: string[] | null;
}

function 连续卡(r: 连续记录形): Record<string, unknown> {
  const 是Case = r.caseId !== null;
  return {
    needs_action: false,
    record_id: r.recordId,
    record_kind: r.recordKind,
    intention_id: 编号.意向,
    job: 连续职位(r),
    delegation_id: 是Case ? null : r.recordId,
    evaluation_id: null,
    case_id: r.caseId,
    shelf: 'active',
    phase: r.phase,
    case_state: 是Case ? Case状态(r.caseId!, 'anonymous_screening', 'policy_check') : null,
    failure: null,
    refusal_code: null,
    actions: { retry: false, archive: true, open_case: false },
    retry_generation: 0,
    created_at: 时间戳,
    updated_at: 时间戳,
    archived_at: null,
    match_score: r.matchScore,
  };
}

function 连续详情(r: 连续记录形, jobDetail: Record<string, unknown> | null): Record<string, unknown> {
  return {
    ...连续卡(r),
    evaluation: null,
    case_detail: r.caseId === null
      ? null
      : 候选Case详情(r.caseId, { matchScore: r.matchScore, jobDetail }),
    failure_history: [],
    agent_summary: { public_evaluation: null, condition_confirmation: null },
    job_detail: jobDetail,
  };
}

// ── 招聘端 wire（owner 岗位 / 推荐列表与详情 / Case 列表与详情）──────────────────

function Owner岗位(): Record<string, unknown> {
  return {
    job_id: 编号.招聘岗位,
    publisher_mode: 'direct',
    publisher_verification_status: 'verified',
    hiring_organization_claim: { display_name: 标记.企业A, legal_name: null },
    publisher_organization_ref: 编号.组织A,
    hiring_organization_verification_status: 'verified',
    hiring_organization_ref: 编号.组织A,
    title: 标记.职位A,
    recruitment_type: 'social_full_time',
    category: { id: 'job-fixture-wiring', display_name: '后端工程师' },
    location: { id: 'loc-fixture-wiring', display_name: '展接FIX 市' },
    office_location: '展接FIX 市 Fixture 路 8 号',
    workplace_mode: 'hybrid',
    salary_lower: 60,
    salary_upper: 80,
    salary_period: 'month',
    annual_salary_months: null,
    campus_cohort: null,
    internship_months: null,
    onsite_days_per_week: null,
    experience_requirement: 'none',
    education_requirement: 'none',
    structured_requirements_confirmed: true,
    description: '展接FIX owner 岗位描述',
    requirements: '展接FIX owner 岗位要求',
    keywords: [],
    private_screening_preferences: '',
    hard_requirements: {
      alternate_weekend_work: 'unknown',
      outsourcing_only: 'unknown',
      onsite_only: 'unknown',
      frequent_travel: 'unknown',
    },
    status: 'active',
    revision: 1,
    published_at: 时间戳,
    created_at: 时间戳,
    updated_at: 时间戳,
  };
}

/** include=candidate_summary 展开行的七键闭合摘要（P4推荐腿 / P5工作区共用）。 */
function 招聘摘要(): Record<string, unknown> {
  return {
    gender: 'male',
    experience_years: 9,
    job_status: 'employed',
    degree: '硕士',
    latest_experience: { company: '展接FIX 现任公司', title: '交易中台研发专家' },
    latest_education: { institution: '展接FIX 大学', major: '计算机科学' },
    personal_highlights: ['展接FIX 带过 8 人小组'],
  };
}

function 招聘推荐行(): Record<string, unknown> {
  return {
    recommendation_id: 编号.招聘推荐,
    batch_id: 'bat_wiring_fixture_r1',
    job_id: 编号.招聘岗位,
    rank: 1,
    match_score: 91,
    highlights: ['distributed_systems'],
    compensation_relationship: 'overlap',
    candidate_alias: 标记.候选别名,
    experience_years: 9,
    job_status: 'employed',
    summary: 标记.简历优势,
    skills: ['Go', '分布式事务'],
    educations: [
      { institution: '展接FIX 大学', major: '计算机科学', degree: '硕士', start_month: '2014-09', end_month: '2017-06' },
    ],
    favorite: false,
    rejected: false,
    rejection_reason: null,
    state: 'available',
    structured_requirements_confirmed: true,
    delegation: null,
    candidate_summary: 招聘摘要(),
  };
}

function 招聘Case行(caseId: string, 覆盖: { matchScore: number | null; disclosed: boolean }): Record<string, unknown> {
  return {
    state: Case状态(caseId, 'resume_submission', 'screening_resume', 'waiting'),
    needs_action: false,
    job: 工作区职位(标记.职位A),
    candidate_alias: 标记.候选别名,
    match_score: 覆盖.matchScore,
    candidate_identity: 候选身份(覆盖.disclosed),
    candidate_summary: 招聘摘要(),
  };
}

// ── 场景数据组装 ────────────────────────────────────────────────────────────────

interface 展接线场景数据 {
  岗位: Record<string, Record<string, unknown>>;
  推荐卡: Record<string, unknown>[];
  连续记录: 连续记录形[];
  连续详情表: Record<string, Record<string, unknown>>;
  /** 无游标 me/negotiations 第 N 次读取（1 起）的条目；null = 合法空页 */
  连续页: (读数: number) => 连续记录形[];
  Owner岗位们: Record<string, unknown>[];
  招聘推荐行们: Record<string, unknown>[];
  招聘Case行们: Record<string, unknown>[];
  招聘详情表: Record<string, Record<string, unknown>>;
}

function 场景数据(场景: 展接线场景名, role: 展接线角色): 展接线场景数据 {
  // 候选四张卡：A 有组织 ref + 真实 logo（92 分）、B claim-only + 真实 0 分、
  // C 长公司名/长文本、D 局部空 + logo 加载失败
  const 岗位A = 候选岗位();
  const 岗位B = 候选岗位({
    job_id: 编号.职位B,
    title: 标记.职位B,
    organization: { organization_id: null, display_name: 标记.企业B, industry: null, company_size: null, funding_stage: null, logo: null },
    hiring_organization_ref: undefined,
    publisher_profile: undefined,
  });
  const 岗位C = 候选岗位({
    job_id: 编号.职位C,
    title: 标记.职位C,
    organization: 组织摘要({ display_name: 标记.企业C }),
    description: '展接FIX 长文段落。'.repeat(30),
    requirements: '展接FIX 长要求段落。'.repeat(30),
  });
  const 岗位D = 候选岗位({
    job_id: 编号.职位D,
    title: 标记.职位D,
    hiring_organization_ref: 编号.组织D,
    organization: 组织摘要({ organization_id: 编号.组织D, display_name: 标记.企业D, logo: {
      media_id: 'media-wire-logo-broken',
      media_type: 'image/png',
      size_bytes: 2048,
      width: 240,
      height: 240,
      url: LOGO_BROKEN,
    } }),
    publisher_profile: undefined,
    description: '展接FIX 局部空岗位：JD 描述这节有值，职位要求这节合法空。',
    requirements: '',
  });

  if (role === 'candidate') {
    if (场景 === '刷新为空') {
      // 无游标连续列表第 1 次读取有值、第 2 次起合法空页（数据刷新有值→空）
      const 甲: 连续记录形 = {
        recordId: 编号.连续甲, recordKind: 'case', caseId: 编号.连续甲,
        phase: 'case_started', matchScore: 88, title: 标记.职位A,
      };
      return {
        岗位: { [编号.职位A]: 岗位A },
        推荐卡: [],
        连续记录: [甲],
        连续详情表: { [编号.连续甲]: 连续详情(甲, null) },
        连续页: (读数) => (读数 <= 2 ? [甲] : []),
        Owner岗位们: [],
        招聘推荐行们: [],
        招聘Case行们: [],
        招聘详情表: {},
      };
    }
    const 甲: 连续记录形 = {
      recordId: 编号.连续甲, recordKind: 'case', caseId: 编号.连续甲,
      phase: 'case_started', matchScore: 88, title: 标记.职位A,
    };
    const 乙: 连续记录形 = {
      recordId: 编号.连续乙, recordKind: 'delegation', caseId: null,
      phase: 'accepted', matchScore: null, title: 标记.职位B,
    };
    const 丙: 连续记录形 = {
      recordId: 编号.连续丙, recordKind: 'case', caseId: 编号.连续丙,
      phase: 'case_started', matchScore: null, title: 标记.职位A,
      // legacy 全空：外层组织名/技能同为 null（未知），不冒充已知
      组织显示名: null, 技能: null,
    };
    return {
      岗位: { [编号.职位A]: 岗位A, [编号.职位B]: 岗位B, [编号.职位C]: 岗位C, [编号.职位D]: 岗位D },
      推荐卡: [推荐卡(岗位A, 92), 推荐卡(岗位B, 0), 推荐卡(岗位C, 76), 推荐卡(岗位D, 64)],
      连续记录: [甲, 乙, 丙],
      连续详情表: {
        // 甲：case_started + 冻结岗位展示（公司导航/正文来自 job_detail，不补读当前 Job）
        [编号.连续甲]: 连续详情(甲, 冻结职位资料()),
        // 乙：pre-Case（聚合外层 case_id=null，Case 块全缺席）+ job_detail null
        [编号.连续乙]: 连续详情(乙, null),
        // 丙：legacy Case 全空（match_score / job_detail 双 null）
        [编号.连续丙]: 连续详情(丙, null),
      },
      连续页: () => [甲, 乙, 丙],
      Owner岗位们: [],
      招聘推荐行们: [],
      招聘Case行们: [],
      招聘详情表: {},
    };
  }

  // 招聘端：一个 owner 岗位 + 推荐行 + 两张 Case 行（S1 已披露 / legacy 全空）
  const S1详情 = 招聘Case详情(编号.招聘Case, {
    matchScore: 91,
    jobDetail: 冻结职位资料(),
    resume: 在线简历(),
    disclosed: true,
  });
  const 老Case详情 = 招聘Case详情(编号.招聘Case老, {
    matchScore: null,
    jobDetail: null,
    resume: null,
    disclosed: false,
  });
  return {
    岗位: {},
    推荐卡: [],
    连续记录: [],
    连续详情表: {},
    连续页: () => [],
    Owner岗位们: [Owner岗位()],
    招聘推荐行们: [招聘推荐行()],
    招聘Case行们: [
      招聘Case行(编号.招聘Case, { matchScore: 91, disclosed: true }),
      招聘Case行(编号.招聘Case老, { matchScore: null, disclosed: false }),
    ],
    招聘详情表: { [编号.招聘Case]: S1详情, [编号.招聘Case老]: 老Case详情 },
  };
}

// ── 路由安装 ────────────────────────────────────────────────────────────────────

/**
 * 安装展示字段接线的白名单 HTTP fixture。仅测试使用；每个测试自装自清理
 * （Playwright 每测试独立 page，route 随 page 生命周期销毁）。
 * 另自答 cdn.fixture.example 媒体：wiring-avatar-* / wiring-logo-broken 404，其余 1px PNG。
 */
export async function 安装展接线路由(
  page: Page,
  options: { role: 展接线角色; 场景: 展接线场景名 },
): Promise<展接线路由结果> {
  const { role, 场景 } = options;
  const fixture = 场景数据(场景, role);
  const 前缀 = role === 'candidate' ? '/api/v1/me' : '/api/v1/recruiter';
  const 记录们: 展接线请求记录[] = [];
  let 连续读数 = 0;

  await 安装P1事件桩(page);

  await page.route('**/cdn.fixture.example/**', async (route: Route) => {
    const url = route.request().url();
    // 红线探针：候选身份头像 URL（wire 在场）绝不允许触发网络；真被请求也只给 404。
    if (url.includes('wiring-avatar-') || url.includes('wiring-logo-broken')) {
      await route.fulfill({ status: 404, body: 'not-found' });
      return;
    }
    await route.fulfill({ status: 200, body: PNG一像素, headers: { 'Content-Type': 'image/png' } });
  });

  await page.route('**/api/v1/**', async (route: Route) => {
    const 请求 = route.request();
    const url = new URL(请求.url());
    const path = url.pathname;
    const method = 请求.method();
    const body = method === 'GET' || method === 'DELETE'
      ? null
      : (() => { try { return JSON.parse(请求.postData() ?? '{}'); } catch { return {}; } })();
    记录们.push({ method, path, body });

    const 答 = async (状态: number, json: unknown) => {
      await route.fulfill({ status: 状态, json, headers: { 'Cache-Control': 'no-store' } });
    };

    // ── 会话 / 主体（双端同路）──
    if (path === '/api/v1/session' && method === 'GET') {
      await 答(200, 信封({ identity_id: 'id-wiring-fixture', session_id: 'sess-wiring-fixture', expires_at: '2026-09-30T00:00:00Z' }));
      return;
    }
    if (path === '/api/v1/me' && method === 'GET') {
      await 答(200, 信封(主体(role)));
      return;
    }

    // ── Agent 规则域空水合（双端）──
    if ((path === `${前缀}/agent-rules` || path === `${前缀}/agent-rule-proposals`) && method === 'GET') {
      await 答(200, 信封(path.endsWith('agent-rules') ? { rules: [] } : { proposals: [] }));
      return;
    }

    // ── 候选端启动水合 ──
    if (role === 'candidate') {
      if (path === '/api/v1/me/resume' && method === 'GET') { await 答(200, 信封(简历)); return; }
      if (path === '/api/v1/me/intentions' && method === 'GET') { await 答(200, 信封({ intentions: [意向] })); return; }
      if (path === '/api/v1/me/privacy' && method === 'GET') { await 答(200, 信封(隐私)); return; }
      if (path === '/api/v1/me/resume-files' && method === 'GET') { await 答(200, 信封(附件空库)); return; }
      if (path === '/api/v1/me/account-profile' && method === 'GET') { await 答(200, 信封(账号档案)); return; }
      if (path === '/api/v1/me/match-cases/summary' && method === 'GET') { await 答(200, 信封(MatchCase摘要零)); return; }
      if (path === '/api/v1/me/match-cases' && method === 'GET') { await 答(200, 信封({ items: [], next_cursor: null })); return; }
      // 消息 Tab 的收件箱水合（合法空页入白名单，避免落白名单外 503 的 console 资源错误）
      if (path === '/api/v1/me/conversations' && method === 'GET') { await 答(200, 信封({ items: [], next_cursor: null })); return; }

      // 候选连续代谈列表 / 聚合详情（求职在谈列表 + 在谈详情 + pre-Case）
      if (path === '/api/v1/me/negotiations' && method === 'GET') {
        if (url.searchParams.get('cursor') === null) 连续读数 += 1;
        const 页 = fixture.连续页(连续读数);
        await 答(200, 信封({ items: 页.map((r) => 连续卡(r)), next_cursor: null }));
        return;
      }
      const 连续详情匹配 = /^\/api\/v1\/me\/negotiations\/([^/]+)$/.exec(path);
      if (连续详情匹配 && method === 'GET') {
        const 详情 = fixture.连续详情表[decodeURIComponent(连续详情匹配[1]!)];
        if (!详情) {
          await 答(404, { error: { type: 'negotiation_not_found', message: '展接线 fixture 无此记录' } });
          return;
        }
        await 答(200, 信封(详情));
        return;
      }

      // 市场列表（按意向 scope 一页）+ canonical job GET + 公开企业补读
      if (path === '/api/v1/me/job-recommendations' && method === 'GET') {
        await 答(200, 信封({ recommendations: fixture.推荐卡, next_cursor: null }));
        return;
      }
      const 岗位匹配 = /^\/api\/v1\/jobs\/([^/]+)$/.exec(path);
      if (岗位匹配 && method === 'GET') {
        const 岗 = fixture.岗位[decodeURIComponent(岗位匹配[1]!)];
        if (!岗) {
          await 答(404, { error: { type: 'job_not_found', message: '展接线 fixture 无此岗位' } });
          return;
        }
        await 答(200, 信封(岗));
        return;
      }
      const 公开企业匹配 = /^\/api\/v1\/organizations\/([^/]+)$/.exec(path);
      if (公开企业匹配 && method === 'GET') {
        await 答(200, 信封({
          organization_id: decodeURIComponent(公开企业匹配[1]!),
          legal_name: '展接FIX 云衢科技有限公司',
          display_name: 标记.企业A,
          verified_at: 时间戳,
          profile: {
            brand_name: 标记.企业A,
            industry: { id: 'tax_fintech', display_name: '金融科技' },
            company_size: '500_1000',
            funding_stage: 'series_c',
            office_address: '展接FIX 市 Fixture 路 8 号',
            benefit_codes: ['social_insurance_housing_fund'],
            work_schedule: 'two_day_weekend',
            company_intro: '展接FIX 公司简介',
            business_items: ['展接FIX 主营业务'],
            product_intro: '展接FIX 产品介绍',
            team_members: [],
            logo: null,
            office_media: [],
            company_media: [],
            revision: 1,
            updated_at: 时间戳,
          },
          active_verified_job_count: 1,
        }));
        return;
      }
    }

    // ── 招聘端启动水合 + 四列表两详情 ──
    if (role === 'recruiter') {
      if (path === '/api/v1/recruiter/profile' && method === 'GET') {
        await 答(200, 信封({ public_name: '展接FIX 招聘方', title: '招聘负责人', personal_verification_status: 'verified', verified_name: null, avatar_url: null, revision: 1 }));
        return;
      }
      if (path === '/api/v1/recruiter/affiliations' && method === 'GET') { await 答(200, 信封({ affiliations: [] })); return; }
      if (path === '/api/v1/recruiter/organization-admin-requests' && method === 'GET') { await 答(200, 信封({ requests: [] })); return; }
      if (path === '/api/v1/recruiter/jobs' && method === 'GET') { await 答(200, 信封({ jobs: fixture.Owner岗位们, next_cursor: null })); return; }
      if (path === '/api/v1/recruiter/match-cases/summary' && method === 'GET') { await 答(200, 信封(MatchCase摘要零)); return; }
      if (path === '/api/v1/recruiter/conversations' && method === 'GET') { await 答(200, 信封({ items: [], next_cursor: null })); return; }

      // 招聘在谈（P5 open 工作区，include=candidate_summary 展开）
      if (path === '/api/v1/recruiter/match-cases' && method === 'GET') {
        await 答(200, 信封({ items: fixture.招聘Case行们, next_cursor: null }));
        return;
      }
      const Case详情匹配 = /^\/api\/v1\/recruiter\/match-cases\/([^/]+)$/.exec(path);
      if (Case详情匹配 && method === 'GET') {
        const 详情 = fixture.招聘详情表[decodeURIComponent(Case详情匹配[1]!)];
        if (!详情) {
          await 答(404, { error: { type: 'match_case_not_found', message: '展接线 fixture 无此 Case' } });
          return;
        }
        await 答(200, 信封(详情));
        return;
      }

      // 招聘推荐（owner 岗位 scope 的展开列表 + 匿名简历单项详情）
      const 推荐列表匹配 = /^\/api\/v1\/recruiter\/jobs\/([^/]+)\/candidate-recommendations$/.exec(path);
      if (推荐列表匹配 && method === 'GET') {
        await 答(200, 信封({
          recommendations: fixture.招聘推荐行们.map((行) => ({ ...行, candidate_summary: (行 as { candidate_summary: unknown }).candidate_summary })),
          next_cursor: null,
        }));
        return;
      }
      const 推荐详情匹配 = /^\/api\/v1\/recruiter\/jobs\/([^/]+)\/candidate-recommendations\/([^/]+)$/.exec(path);
      if (推荐详情匹配 && method === 'GET') {
        const 行 = fixture.招聘推荐行们.find((项) => (项 as { recommendation_id: string }).recommendation_id === decodeURIComponent(推荐详情匹配[2]!));
        if (!行) {
          await 答(404, { error: { type: 'recommendation_not_found', message: '展接线 fixture 无此推荐' } });
          return;
        }
        // 详情键集不含 candidate_summary（include 语法只属于列表）；恒在场的是 candidate_resume
        const { candidate_summary: _列表摘要, ...卡体 } = 行 as Record<string, unknown>;
        void _列表摘要;
        await 答(200, 信封({ ...卡体, candidate_resume: 在线简历() }));
        return;
      }
      if (/^\/api\/v1\/recruiter\/jobs\/[^/]+\/candidate-recommendations\/[^/]+\/(favorite|rejection)$/.test(path)) {
        await 答(200, 信封({ favorite: false, rejected: false, rejection_reason: null, revision: 2, updated_at: 时间戳 }));
        return;
      }
    }

    // ── 白名单外：记录 + 受控错误，绝不放行真实网络 ──
    await 答(503, { error: { type: 'wiring_fixture_unknown_api', message: `展接线 fixture 白名单外请求：${method} ${path}` } });
  });

  return { 请求: 记录们 };
}