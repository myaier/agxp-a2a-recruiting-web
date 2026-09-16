// e2e/fixtures/bff/发现推荐.ts
// P4 发现推荐域 fixture（C2）：wire 形、编号与标记值、双端样本卡与可变 fixture 工厂，
// 从 e2e/数据源模式.spec.ts 原样迁出。可变状态归每次 安装BFF路由 所有。

import { P1C岗位, type P1C岗位形 } from './招聘组织';
import { 信封, type 路由上下文形 } from './协议';
import type { P5MatchCasefixture形 } from './MatchCase';

// ── P4 发现推荐域样本与工厂 ──

// ─────────────────────────────────────────────────────────────────────────────
// P4 发现推荐域 fixture（Task 8）。wire 形与其他 fixture 一样就地声明，不反向依赖 src；
// 编号与标记值（P4编号 / P4标记）只存在于 fixture，Mock 数据里没有 —— 断言页面展示它们
// 即证明渲染来自 HTTP 而非 Mock。可变状态归每次 安装BFF路由 所有：候选 available 数组、
// 招聘 available/rejected 两条腿、收藏、刷新计数、委托单项读取、变更回执存证
// （method/path/body/If-Match/Idempotency-Key 原样入 变更请求）与一个非法翻页分支
// （第二页注入一个未知键 → strict decoder 拒收整轮读取）。只路由 Spec 点名的 P4 路径，
// 无任何 watch 路由；受控重试（503 operation_outcome_unknown）同键回同一张委托回执。
// ─────────────────────────────────────────────────────────────────────────────

export const P4编号 = {
  intention: 'int_00112233445566778899aabbccddeef1',
  job: 'job_00112233445566778899aabbccddeef2',
  candidateRecommendation: 'rec_00112233445566778899aabbccddeef3',
  recruiterJob: 'job_00112233445566778899aabbccddeef4',
  recruiterRecommendation: 'rec_00112233445566778899aabbccddeef5',
  // J-PILOT-01：候选委托 id 同时是协议 B 的 canonical record_id（合同 pattern
  // ^(dlg_|mc_)[0-9a-f]{32}$，record_id = 原候选委托 id）—— 用 dlg_ 形状才能直读 me/negotiations。
  candidateDelegation: 'dlg_00112233445566778899aabbccddeef6',
  recruiterDelegation: 'del_00112233445566778899aabbccddeef7',
  case: 'case_00112233445566778899aabbccddeef8',
} as const;

export const P4标记 = {
  jobTitle: 'P4 Fixture 分布式系统工程师',
  company: 'P4 Fixture 星河科技',
  publisher: 'P4 Fixture 招聘负责人',
  candidateAlias: 'P4候选甲',
  candidateSummary: 'P4 fixture 匿名候选摘要，只来自 HTTP',
  // 去名改版（2026-09-08）：推荐列表卡不再显示别名，列表上按右列适配环可及名定位
  // （甲 match_score 88；乙 见 P4发现fixture 里的 match_score 76）。别名只在详情 / 已筛页仍可见
  candidateRing: '适配 88 分',
  candidateBRing: '适配 76 分',
  // 卡片统一（2026-09-10）：招聘推荐卡卡面的工作行 = candidate_summary 投影的「公司 · 现职」
  summaryWork: 'P4 Fixture 公司 · P4 Fixture 现职',
} as const;

/** 用例自用的补充编号：固定表之外的第二张卡 / 归档岗位 / 未知坐标（同样只存在于 fixture） */
export const P4补充编号 = {
  备选岗位: 'job_00112233445566778899aabbccddeef9',
  备选推荐: 'rec_00112233445566778899aabbccddeeg1',
  招聘候选乙: 'rec_00112233445566778899aabbccddeeg2',
  意向乙: 'int_00112233445566778899aabbccddeeg3',
  归档岗位: 'job_00112233445566778899aabbccddeeg4',
  未知岗位: 'job_00112233445566778899aabbccddeeg5',
  未知推荐: 'rec_00112233445566778899aabbccddeeg6',
} as const;

export type P4委托状态形 = 'accepted' | 'evaluating' | 'case_started' | 'needs_user' | 'refused' | 'failed';
export type P4淘汰原因形 = 'experience_insufficient' | 'direction_mismatch' | 'primary_stack_mismatch' | 'other';

/** P4 wire 委托摘要（与 BFF契约.BFF委托摘要 同构） */
export interface P4委托摘要形 {
  delegation_id: string;
  state: P4委托状态形;
  case_id: string | null;
}

/** P4 wire CandidateJob（与 BFF契约.BFFCandidateJob 同构：owner-private 列缺席即漂移） */
export interface P4CandidateJob形 {
  job_id: string;
  publisher_verification_status: 'unverified' | 'verified';
  hiring_organization_verification_status: 'unverified' | 'verified';
  hiring_organization_claim: { display_name: string; legal_name?: string | null };
  publisher_organization_ref?: string;
  hiring_organization_ref?: string;
  publisher_profile?: {
    public_name: string;
    title: string;
    personal_verification_status: 'unverified' | 'verified';
    avatar_url?: string | null;
  };
  title: string;
  // release/0.2.5：用人企业摘要 required；claim-only 岗位合法档是显式 null 的六键
  organization: {
    organization_id: string | null;
    display_name: string | null;
    industry: { id: string; display_name: string } | null;
    company_size: string | null;
    funding_stage: string | null;
    logo: {
      media_id: string; media_type: 'image/png' | 'image/jpeg'; size_bytes: number;
      width: number; height: number; url: string;
    } | null;
  };
  recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time';
  category: { id: string; display_name: string };
  location: { id: string; display_name: string };
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
  structured_requirements_confirmed: boolean;
  hard_requirements: {
    alternate_weekend_work: 'required' | 'not_required' | 'unknown';
    outsourcing_only: 'required' | 'not_required' | 'unknown';
    onsite_only: 'required' | 'not_required' | 'unknown';
    frequent_travel: 'required' | 'not_required' | 'unknown';
  };
  description: string;
  requirements: string;
  keywords: string[];
  status: 'active';
  revision: number;
  published_at: string;
  created_at: string;
  updated_at: string;
}

/** P4 wire 候选岗位推荐（与 BFF契约.BFF候选岗位推荐 同构） */
export interface P4候选推荐形 {
  recommendation_id: string;
  batch_id: string;
  intention_id: string;
  rank: number;
  match_score: number;
  match_reasons: string[];
  state: 'available' | 'delegating' | 'delegated';
  /** P4 互认：生成批次时冻结的 Job basis（非岗位当前 revision 值），必返 boolean */
  structured_requirements_confirmed: boolean;
  job: P4CandidateJob形;
  delegation: P4委托摘要形 | null;
}

/** P4 wire 招聘候选教育段（与 BFF契约.BFF招聘候选教育 同构） */
export interface P4招聘教育形 {
  institution: string | null;
  major: string | null;
  degree: string;
  start_month: string;
  end_month: string | null;
}

/** P4 wire 招聘候选摘要（与 BFF契约.BFF招聘候选摘要 同构）：include=candidate_summary
 *  展开行的七键闭合对象（或显式 null）。2026-09-09 摘要接线后招聘端两份展开列表
 *  （P4 推荐腿 / P5 open 工作区）都必须带这个键，decode 才收。 */
export interface P4摘要形 {
  gender: 'male' | 'female' | null;
  experience_years: number | null;
  job_status: 'student' | 'employed' | 'unemployed' | null;
  degree: string | null;
  latest_experience: { company: string | null; title: string | null } | null;
  latest_education: { institution: string | null; major: string | null } | null;
  personal_highlights: string[];
}

/** 摘要样本：fixture 专属标记值（Mock 数据里没有），卡上出现即证明渲染来自 HTTP */
export function P4摘要(覆盖: Partial<P4摘要形> = {}): P4摘要形 {
  return {
    gender: 'female',
    experience_years: 5,
    job_status: 'employed',
    degree: 'P4 本科',
    latest_experience: { company: 'P4 Fixture 公司', title: 'P4 Fixture 现职' },
    latest_education: { institution: 'P4 Fixture 大学', major: 'P4 Fixture 专业' },
    personal_highlights: ['P4 Fixture 摘要亮点'],
    ...覆盖,
  };
}

/** P4 wire 招聘候选推荐（与 BFF契约.BFF招聘候选推荐 同构：匿名 allowlist，无真名无薪资数字） */
export interface P4招聘推荐形 {
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
  educations: P4招聘教育形[];
  favorite: boolean;
  rejected: boolean;
  rejection_reason: P4淘汰原因形 | null;
  state: 'available' | 'rejected';
  /** P4 互认：生成批次时冻结的 Job basis（非岗位当前 revision 值），必返 boolean */
  structured_requirements_confirmed: boolean;
  delegation: P4委托摘要形 | null;
  /** include=candidate_summary 展开页才有；单项详情/历史响应绝不携带（闭合白名单） */
  candidate_summary?: P4摘要形 | null;
}

/** release/0.2.5：招聘单项详情恒在场的 candidate_resume（RecruiterCandidateResume 七键闭合）。
 *  摘要复用 P4摘要；两条教育/两段经历给「多段 + 合法空」样本，供匿名简历页展示接线证据。 */
export function P4在线简历(): Record<string, unknown> {
  return {
    summary: P4摘要(),
    self_description: 'P4 fixture 自我描述',
    skills: ['Go', '分布式事务'],
    experiences: [
      {
        company: 'P4 Fixture 公司', industry: '互联网', title: 'P4 Fixture 现职',
        start_month: '2021-01', end_month: null,
        description: 'P4 fixture 经历描述', internship: false,
        projects: [{ name: 'P4 Fixture 项目', role: '负责人', result: '转化提升 12%' }],
      },
      {
        company: null, industry: null, title: null,
        start_month: '2020-01', end_month: '2020-12',
        description: null, internship: true, projects: [],
      },
    ],
    educations: [
      { institution: 'P4 Fixture 大学', major: 'P4 Fixture 专业', degree: 'P4 本科', start_month: '2017-09', end_month: '2021-06' },
      { institution: null, major: null, degree: 'P4 硕士', start_month: '2021-09', end_month: null },
    ],
    expectation: {
      recruitment_type: 'social_full_time',
      job_category: { id: 'job-fixture-p4-cat', display_name: '后端工程师' },
      locations: [{ id: 'loc-fixture-p4', display_name: 'P4 Fixture 市' }],
      workplace_modes: ['hybrid'],
    },
    compensation_relationship: 'overlap',
  };
}

/** P4 wire 发现批次（与 BFF契约.BFF发现批次 同构） */
export interface P4发现批次形 {
  batch_id: string;
  direction: 'candidate_jobs' | 'recruiter_candidates';
  scope_ref: string;
  ranking_version: 'discovery-ranking.v1';
  count: number;
  created_at: string;
}

/** P4 wire 发现偏好回执（与 BFF契约.BFF发现偏好 同构） */
export interface P4偏好形 {
  favorite: boolean;
  rejected: boolean;
  rejection_reason: 'not_interested' | P4淘汰原因形 | null;
  revision: number;
  updated_at: string;
}

/** P4 wire 委托回执（与 BFF契约.BFF委托回执 同构） */
export interface P4委托回执形 {
  delegation_id: string;
  recommendation_id: string | null;
  state: P4委托状态形 | null;
  evaluation_id: string | null;
  case_id: string | null;
  refusal_code:
    | 'recommendation_not_found' | 'recommendation_unavailable'
    | 'delegation_not_allowed' | 'active_case_quota_reached'
    | 'delegation_cooldown' | null;
}

/** P4 wire 意向（与 fixture意向列表 条目同构；候选端 scope 坐标与顶栏胶囊的来源） */
export interface P4意向形 {
  intention_id: string;
  recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time';
  job_category: { id: string; display_name: string };
  primary_location: { id: string; display_name: string };
  alternate_locations: { id: string; display_name: string }[];
  industries: { id: string; display_name: string }[];
  workplace_modes: ('onsite' | 'hybrid' | 'remote')[];
  compensation: { mode: 'range' | 'negotiable'; lower?: number | null; upper?: number | null; annual_salary_months?: number | null };
  salary_period: 'month' | 'day' | 'hour';
  graduation_month: string | null;
  internship_months: number | null;
  onsite_days_per_week: number | null;
  exclusions: {
    alternate_weekend_work: 'allowed' | 'excluded' | 'unspecified';
    outsourcing_only: 'allowed' | 'excluded' | 'unspecified';
    onsite_only: 'allowed' | 'excluded' | 'unspecified';
    frequent_travel: 'allowed' | 'excluded' | 'unspecified';
  };
  private_preferences: string;
  status: 'active' | 'archived';
  revision: number;
  created_at: string;
  updated_at: string;
}

/** P4 专用分支：只有用例显式 seed 时才选择固定故障 / 挂起 / 注毒应答 */
export interface P4发现分支形 {
  /** 候选刷新 POST 每把新键先 503 operation_outcome_unknown（同键受控重试一次后成功） */
  候选刷新首次503?: boolean;
  /** 候选委托 POST 每把新键先 503，重试回同一张回执（同键同回执存证） */
  候选委托先503?: boolean;
  /** 候选委托 POST 恒 503 结果未知（写响应丢失场景；受理已落登记，清分支后同键重放成功） */
  候选委托未知?: boolean;
  /** 候选列表翻页的第二页注入一个未知键 → strict decoder 拒收整轮读取 */
  候选非法第二页?: boolean;
  /** 候选端不感兴趣 PUT 首次 500（存证后失败；重试成功） */
  候选不感兴趣先失败?: boolean;
  /** 指定意向的列表首页 GET 挂起，直到门兑现（迟到 scope 应答用） */
  挂起候选读取?: { 意向: string; 门: Promise<void> };
}

/** P4 发现域可变 fixture：测试自持一份，安装路由后 handler 与测试共享同一对象 */
export interface P4发现fixture形 {
  /** 在场时 GET /api/v1/me/intentions 改答这份列表（候选端双意向 / 迟到应答用例用） */
  意向们?: P4意向形[];
  /** 候选端：intention_id → available 推荐卡（反馈 / 刷新 / 委托直接改写） */
  候选推荐: Record<string, P4候选推荐形[]>;
  /** canonical job GET /api/v1/jobs/{id} 的权威 Job；缺席编号按 404 job_not_found 收口 */
  候选岗位: Record<string, P4CandidateJob形>;
  /** 招聘端：job_id → available / rejected 两条腿（收藏 / 淘汰 / 撤销 / 委托直接改写） */
  招聘可用: Record<string, P4招聘推荐形[]>;
  招聘已筛: Record<string, P4招聘推荐形[]>;
  /** 刷新计数：POST 建批次一次 +1 */
  刷新次数: { candidate: number; recruiter: number };
  /** 委托单项 GET 读取记录（逐次追加） */
  委托读取: { delegationId: string; state: P4委托状态形 | null }[];
  /** 变更回执存证：method/path/body + If-Match / Idempotency-Key 原样 */
  变更请求: { method: string; path: string; body: unknown; ifMatch: string | null; idempotencyKey: string | null }[];
  分支?: P4发现分支形;
}

export function P4深克隆<T>(值: T): T {
  return JSON.parse(JSON.stringify(值)) as T;
}

/** P4 招聘腿展开页：行带 candidate_summary（include=candidate_summary 的展开契约）。
 *  卡对象上缺省摘要时按「显式 null」下发 —— decode 两种都收，卡面据此出未知占位。 */
export function P4招聘分页(
  items: P4招聘推荐形[],
  游标: string | null,
): { recommendations: unknown[]; next_cursor: string | null } {
  return P4分页(
    items.map((卡) => ({ ...卡, candidate_summary: 卡.candidate_summary ?? null })),
    false,
    游标,
  );
}

/** P4 单项详情是非展开响应：candidate_summary 键一出现就是契约漂移，route 侧剥掉 */
export function P4非展开卡(卡: P4招聘推荐形): P4招聘推荐形 {
  const 克隆 = P4深克隆(卡);
  delete 克隆.candidate_summary;
  return 克隆;
}

/** P4 页 wrapper：两页翻页（首页 1 条 + cursor / 余下收尾显式 null）；注毒分支在第二页对象上多塞一个键 */
export function P4分页(
  items: unknown[],
  注毒: boolean,
  游标: string | null,
): { recommendations: unknown[]; next_cursor: string | null } {
  if (items.length === 0) return { recommendations: [], next_cursor: null };
  if (游标 === null) return { recommendations: [P4深克隆(items[0])], next_cursor: 'p4page2' };
  const 余下 = items.slice(1).map((条) => P4深克隆(条)) as Record<string, unknown>[];
  if (注毒 && 余下.length > 0) 余下[0]!.fixture_extra_key = 'invalid-page';
  return { recommendations: 余下, next_cursor: null };
}

let P4批次序 = 0;
export function P4发现批次(direction: 'candidate_jobs' | 'recruiter_candidates', scopeRef: string): P4发现批次形 {
  P4批次序 += 1;
  return {
    batch_id: `bat_p4fixture${P4批次序}`,
    direction,
    scope_ref: scopeRef,
    ranking_version: 'discovery-ranking.v1',
    count: 1,
    created_at: '2026-08-27T09:00:00Z',
  };
}

let P4偏好序 = 0;
export function P4发现偏好(覆盖: Partial<P4偏好形> = {}): P4偏好形 {
  P4偏好序 += 1;
  return {
    favorite: false,
    rejected: false,
    rejection_reason: null,
    revision: 1 + P4偏好序,
    updated_at: '2026-08-27T09:30:00Z',
    ...覆盖,
  };
}

export function P4CandidateJob(覆盖: Partial<P4CandidateJob形> = {}): P4CandidateJob形 {
  return {
    job_id: P4编号.job,
    publisher_verification_status: 'verified',
    hiring_organization_verification_status: 'verified',
    hiring_organization_claim: { display_name: P4标记.company, legal_name: 'P4 Fixture 星河科技有限公司' },
    // claim-only 合法档：只答声明显示名，其余成员显式 null（公司路由坐标仍走 hiring_organization_ref）
    organization: {
      organization_id: null,
      display_name: P4标记.company,
      industry: null,
      company_size: null,
      funding_stage: null,
      logo: null,
    },
    title: P4标记.jobTitle,
    recruitment_type: 'social_full_time',
    category: { id: 'job-fixture-p4-cat', display_name: '后端工程师' },
    location: { id: 'loc-fixture-p4', display_name: 'P4 Fixture 市' },
    office_location: 'P4 Fixture 市 Fixture 路 8 号',
    workplace_mode: 'hybrid',
    salary_lower: 30,
    salary_upper: 50,
    salary_period: 'month',
    annual_salary_months: 15,
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
    description: 'P4 fixture 岗位描述：负责分布式系统研发。\n参与高可用架构设计。',
    requirements: 'P4 fixture 岗位要求：熟悉分布式一致性。\n有大规模系统经验。',
    keywords: ['P4Fixture'],
    status: 'active',
    revision: 1,
    published_at: '2026-08-27T00:00:00Z',
    created_at: '2026-08-27T00:00:00Z',
    updated_at: '2026-08-27T00:00:00Z',
    publisher_organization_ref: 'org-fixture-p4',
    hiring_organization_ref: 'org-fixture-p4',
    publisher_profile: {
      public_name: P4标记.publisher,
      title: '招聘负责人',
      personal_verification_status: 'verified',
    },
    ...覆盖,
  };
}

export function P4候选卡(覆盖: Partial<P4候选推荐形> = {}): P4候选推荐形 {
  return {
    recommendation_id: P4编号.candidateRecommendation,
    batch_id: 'bat_p4fixture_c1',
    intention_id: P4编号.intention,
    rank: 1,
    match_score: 92,
    match_reasons: ['direction_match', 'compensation_overlap'],
    state: 'available',
    structured_requirements_confirmed: true,
    job: P4CandidateJob(),
    delegation: null,
    ...覆盖,
  };
}

export function P4招聘卡(覆盖: Partial<P4招聘推荐形> = {}): P4招聘推荐形 {
  return {
    recommendation_id: P4编号.recruiterRecommendation,
    batch_id: 'bat_p4fixture_r1',
    job_id: P4编号.recruiterJob,
    rank: 1,
    match_score: 88,
    highlights: ['distributed_systems'],
    compensation_relationship: 'overlap',
    candidate_alias: P4标记.candidateAlias,
    experience_years: 5,
    job_status: 'employed',
    summary: P4标记.candidateSummary,
    skills: ['Go', 'Kubernetes'],
    educations: [
      { institution: 'P4 Fixture 大学', major: '计算机科学', degree: '本科', start_month: '2017-09', end_month: '2021-06' },
    ],
    favorite: false,
    rejected: false,
    rejection_reason: null,
    state: 'available',
    structured_requirements_confirmed: true,
    delegation: null,
    candidate_summary: P4摘要(),
    ...覆盖,
  };
}

export function P4意向(覆盖: Partial<P4意向形> & Pick<P4意向形, 'intention_id' | 'job_category'>): P4意向形 {
  return {
    recruitment_type: 'social_full_time',
    primary_location: { id: 'loc-fixture-p4', display_name: 'P4 Fixture 市' },
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
    created_at: '2026-08-27T00:00:00Z',
    updated_at: '2026-08-27T00:00:00Z',
    ...覆盖,
  };
}

/** 招聘端 owner 岗位（P1C 岗位形）：title 与候选端 CandidateJob 同一标记，编号是 owner job 坐标 */
export function P4招聘岗位(覆盖: Partial<P1C岗位形> = {}): P1C岗位形 {
  return P1C岗位({
    job_id: P4编号.recruiterJob,
    title: P4标记.jobTitle,
    recruitment_type: 'social_full_time',
    category: { id: 'job-fixture-p4-cat', display_name: '后端工程师' },
    location: { id: 'loc-fixture-p4', display_name: 'P4 Fixture 市' },
    salary_lower: 30,
    salary_upper: 50,
    salary_period: 'month',
    annual_salary_months: 15,
    campus_cohort: null,
    internship_months: null,
    onsite_days_per_week: null,
    ...覆盖,
  });
}

export function P4发现fixture(分支: P4发现分支形 = {}): P4发现fixture形 {
  return {
    // 缺省意向列表 = 单条 active 的 P4 意向：水合后 当前意向编号 载体即指向
    // 候选推荐数据的 scope 键（需要双意向的用例自行覆盖 意向们）
    意向们: [P4意向({ intention_id: P4编号.intention, job_category: { id: 'job-fixture-p4-cat', display_name: '后端工程师' } })],
    候选推荐: { [P4编号.intention]: [P4候选卡()] },
    候选岗位: { [P4编号.job]: P4CandidateJob() },
    招聘可用: {
      [P4编号.recruiterJob]: [
        P4招聘卡(),
        P4招聘卡({ recommendation_id: P4补充编号.招聘候选乙, candidate_alias: 'P4候选乙', rank: 2, match_score: 76 }),
      ],
    },
    招聘已筛: {},
    刷新次数: { candidate: 0, recruiter: 0 },
    委托读取: [],
    变更请求: [],
    分支,
  };
}


// ── 安装态与路由 handler（C2 阶段二迁入）──

/** P4 域的每次安装独立状态：委托登记表与受控重试/失败键（跨请求存活，不跨安装共享）。 */
export interface P4安装状态形 {
  p4委托表: Map<string, { 回执: P4委托回执形; role: 'candidate' | 'recruiter'; 读数: number }>;
  p4刷新503键: Set<string>;
  p4委托503键: Set<string>;
  p4不感兴趣失败键: Set<string>;
}

export function 创建P4安装状态(): P4安装状态形 {
  return {
    p4委托表: new Map(),
    p4刷新503键: new Set(),
    p4委托503键: new Set(),
    p4不感兴趣失败键: new Set(),
  };
}

export async function 处理发现推荐域(
  P4域: P4发现fixture形 | null,
  P5连续域: P5MatchCasefixture形 | null,
  状态: P4安装状态形,
  上下文: 路由上下文形,
): Promise<boolean> {
  if (P4域 === null) return false;
  const { p4委托表, p4刷新503键, p4委托503键, p4不感兴趣失败键 } = 状态;
  const { route, 请求, url, path, method, body } = 上下文;

  // ── P4 发现推荐域（发现 fixture 存在时才应答；缺席走兜底空信封 → strict decode 拒绝，
  //    正是「Mock 内容不顶替 HTTP」的既有边界）。变更回执（method/path/body + If-Match /
  //    Idempotency-Key）原样存进 fixture 的 变更请求；委托登记表按 Idempotency-Key 记录，
  //    同键重放 / 受控重试都回同一张回执。──
  const 记录P4变更 = (变更路径: string) => {
    P4域.变更请求.push({
      method,
      path: 变更路径,
      body,
      ifMatch: 请求.headers()['if-match'] ?? null,
      idempotencyKey: 请求.headers()['idempotency-key'] ?? null,
    });
  };
  const 游标 = url.searchParams.get('cursor');

  // 候选端列表：按 intention scope 两页翻页；迟到应答分支挂起首页；非法分支注毒第二页
  if (path === '/api/v1/me/job-recommendations' && method === 'GET') {
    const 意向 = url.searchParams.get('intention_id') ?? '';
    const 挂起 = P4域.分支?.挂起候选读取;
    if (挂起?.意向 === 意向 && 游标 === null) await 挂起.门;
    const 注毒 = Boolean(P4域.分支?.候选非法第二页) && 游标 !== null;
    await route.fulfill({ status: 200, json: 信封(P4分页(P4域.候选推荐[意向] ?? [], 注毒, 游标)) });
    return true;
  }

  // canonical job GET（详情直取）：fixture 没有的编号按 404 job_not_found 收口
  const P4岗位匹配 = /^\/api\/v1\/jobs\/([^/]+)$/.exec(path);
  if (P4岗位匹配 && method === 'GET') {
    const 岗 = P4域.候选岗位[decodeURIComponent(P4岗位匹配[1])];
    if (!岗) {
      await route.fulfill({ status: 404, json: { error: { type: 'job_not_found', message: '岗位不存在' } } });
      return true;
    }
    await route.fulfill({ status: 200, json: 信封(P4深克隆(岗)) });
    return true;
  }

  // 候选端刷新：POST 建新批次；受控重试分支首把键 503，同键重试成功
  if (path === '/api/v1/me/job-recommendation-refreshes' && method === 'POST') {
    记录P4变更(path);
    const 键 = 请求.headers()['idempotency-key'] ?? '';
    if (P4域.分支?.候选刷新首次503 && 键 !== '' && !p4刷新503键.has(键)) {
      p4刷新503键.add(键);
      await route.fulfill({ status: 503, headers: { 'Retry-After': '0' }, json: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } });
      return true;
    }
    P4域.刷新次数.candidate += 1;
    const 意向 = (body as { intention_id?: string }).intention_id ?? '';
    // 服务端建新批次：空 scope 首刷给权威卡（旧卡保留语义由客户端快照负责）
    if ((P4域.候选推荐[意向] ?? []).length === 0) {
      P4域.候选推荐[意向] = [P4候选卡({ batch_id: `bat_p4fixture_c${P4域.刷新次数.candidate + 1}` })];
    }
    await route.fulfill({ status: 200, json: 信封(P4发现批次('candidate_jobs', 意向)) });
    return true;
  }

  // 候选端不感兴趣：PUT 200 才从 available 数组移除（无 If-Match / 无 Idempotency-Key）
  const P4不感兴趣匹配 = /^\/api\/v1\/me\/job-recommendations\/([^/]+)\/not-interested$/.exec(path);
  if (P4不感兴趣匹配 && method === 'PUT') {
    记录P4变更(path);
    const 推荐编号 = decodeURIComponent(P4不感兴趣匹配[1]);
    // 失败分支也在存证之后：两次传输都留变更回执，只有应答不同
    if (P4域.分支?.候选不感兴趣先失败 && !p4不感兴趣失败键.has(推荐编号)) {
      p4不感兴趣失败键.add(推荐编号);
      await route.fulfill({ status: 500, json: { error: { type: 'internal_error', message: 'fixture 首次不感兴趣失败' } } });
      return true;
    }
    for (const 意向 of Object.keys(P4域.候选推荐)) {
      P4域.候选推荐[意向] = P4域.候选推荐[意向]!.filter((卡) => 卡.recommendation_id !== 推荐编号);
    }
    await route.fulfill({ status: 200, json: 信封(P4发现偏好({ rejected: true, rejection_reason: 'not_interested' })) });
    return true;
  }

  // 候选端委托：一次意图一把键；同键重放 / 受控重试回同一张回执；选择坐标是 job_id
  if (path === '/api/v1/me/job-delegations' && method === 'POST') {
    记录P4变更(path);
    const 键 = 请求.headers()['idempotency-key'] ?? '';
    let 表项 = p4委托表.get(键);
    if (!表项) {
      const 换 = body as { intention_id?: string; selection?: { items?: string[] } };
      const 岗位编号 = 换.selection?.items?.[0] ?? '';
      // 服务端语义：无论响应是否送达，委托都已受理 —— 503 分支也先落登记再丢应答
      表项 = {
        role: 'candidate',
        读数: 0,
        回执: { delegation_id: P4编号.candidateDelegation, recommendation_id: null, state: 'accepted', evaluation_id: null, case_id: null, refusal_code: null, failure_code: null },
      };
      p4委托表.set(键, 表项);
      // J-PILOT-01（Task 7）：受理即登记 dlg 连续记录 —— 与回执登记同笔（响应未送达
      // 也已受理，503 分支同样落登记）；相位由场景测试按最小转换显式推进。
      if (P5连续域) {
        const 岗位名 = P4域.候选岗位[岗位编号]?.title ?? P4标记.jobTitle;
        P5连续域.连续记录[表项.回执.delegation_id] = {
          recordId: 表项.回执.delegation_id,
          recordKind: 'delegation',
          caseId: null,
          delegationId: 表项.回执.delegation_id,
          evaluationId: null,
          phase: 'accepted',
          needsAction: false,
          actions: { retry: false, archive: false, open_case: false },
          failure: null,
          refusalCode: null,
          retryGeneration: 0,
          职位名: 岗位名,
          createdAt: '2026-08-29T04:00:00Z',
          updatedAt: '2026-08-29T04:00:00Z',
          archivedAt: null,
          公开评: null,
        };
      }
    }
    if (P4域.分支?.候选委托先503 && 键 !== '' && !p4委托503键.has(键)) {
      p4委托503键.add(键);
      await route.fulfill({ status: 503, headers: { 'Retry-After': '0' }, json: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } });
      return true;
    }
    if (P4域.分支?.候选委托未知) {
      // 恒 503：受理已落登记（服务端先行），客户端只见结果未知 → 未决命令保留；
      // 推荐卡面也不动（客户端对委托不知情，reload 后仍走原命令核对，不提前见到回执）
      await route.fulfill({ status: 503, headers: { 'Retry-After': '0' }, json: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } });
      return true;
    }
    // 卡面摘要只在客户端实际收到回执的 200 路径推进（写响应丢失时客户端保持不知情）
    const 换 = body as { intention_id?: string; selection?: { items?: string[] } };
    const 岗位编号 = 换.selection?.items?.[0] ?? '';
    for (const 卡 of P4域.候选推荐[换.intention_id ?? ''] ?? []) {
      if (卡.job.job_id === 岗位编号) {
        卡.state = 'delegating';
        卡.delegation = { delegation_id: P4编号.candidateDelegation, state: 'accepted', case_id: null };
      }
    }
    await route.fulfill({ status: 200, json: 信封({ receipts: [P4深克隆(表项.回执)] }) });
    return true;
  }

  // 候选端委托单项 GET：第一次读 evaluating，之后推进 case_started（真实 Case 引用只在这里出现）
  const P4候选委托读匹配 = /^\/api\/v1\/me\/job-delegations\/([^/]+)$/.exec(path);
  if (P4候选委托读匹配 && method === 'GET') {
    const 编号 = decodeURIComponent(P4候选委托读匹配[1]);
    const 表项 = [...p4委托表.values()].find((项) => 项.回执.delegation_id === 编号);
    if (!表项) {
      await route.fulfill({ status: 404, json: { error: { type: 'delegation_not_found', message: '委托不存在' } } });
      return true;
    }
    表项.读数 += 1;
    表项.回执 = 表项.读数 >= 2
      ? { ...表项.回执, state: 'case_started', case_id: P4编号.case }
      : { ...表项.回执, state: 'evaluating' };
    P4域.委托读取.push({ delegationId: 编号, state: 表项.回执.state });
    await route.fulfill({ status: 200, json: 信封(P4深克隆(表项.回执)) });
    return true;
  }

  // 招聘端列表：available / rejected 两条腿都按当前岗位 scope 两页翻页
  const P4招聘列表匹配 = /^\/api\/v1\/recruiter\/jobs\/([^/]+)\/candidate-recommendations$/.exec(path);
  if (P4招聘列表匹配 && method === 'GET') {
    const 岗位编号 = decodeURIComponent(P4招聘列表匹配[1]);
    const items = (url.searchParams.get('state') === 'rejected'
      ? P4域.招聘已筛[岗位编号]
      : P4域.招聘可用[岗位编号]) ?? [];
    await route.fulfill({ status: 200, json: 信封(P4招聘分页(items, 游标)) });
    return true;
  }

  // 招聘端单项详情 / 收藏 / 淘汰（fixture 拥有两条腿，PUT/DELETE 直接改写并在两腿间搬运）
  const P4收藏匹配 = /^\/api\/v1\/recruiter\/jobs\/([^/]+)\/candidate-recommendations\/([^/]+)\/favorite$/.exec(path);
  const P4淘汰匹配 = /^\/api\/v1\/recruiter\/jobs\/([^/]+)\/candidate-recommendations\/([^/]+)\/rejection$/.exec(path);
  const P4招聘详情匹配 = /^\/api\/v1\/recruiter\/jobs\/([^/]+)\/candidate-recommendations\/([^/]+)$/.exec(path);
  const P4找招聘卡 = (岗位编号: string, 推荐编号: string): P4招聘推荐形 | undefined =>
    (P4域.招聘可用[岗位编号] ?? []).find((卡) => 卡.recommendation_id === 推荐编号) ??
    (P4域.招聘已筛[岗位编号] ?? []).find((卡) => 卡.recommendation_id === 推荐编号);

  if (P4收藏匹配 && (method === 'PUT' || method === 'DELETE')) {
    记录P4变更(path);
    const 卡 = P4找招聘卡(decodeURIComponent(P4收藏匹配[1]), decodeURIComponent(P4收藏匹配[2]));
    if (!卡) {
      await route.fulfill({ status: 404, json: { error: { type: 'recommendation_not_found', message: '推荐不存在' } } });
      return true;
    }
    卡.favorite = method === 'PUT';
    await route.fulfill({ status: 200, json: 信封(P4发现偏好({ favorite: 卡.favorite, rejected: 卡.rejected, rejection_reason: 卡.rejection_reason })) });
    return true;
  }
  if (P4淘汰匹配 && (method === 'PUT' || method === 'DELETE')) {
    记录P4变更(path);
    const 岗位编号 = decodeURIComponent(P4淘汰匹配[1]);
    const 卡 = P4找招聘卡(岗位编号, decodeURIComponent(P4淘汰匹配[2]));
    if (!卡) {
      await route.fulfill({ status: 404, json: { error: { type: 'recommendation_not_found', message: '推荐不存在' } } });
      return true;
    }
    if (method === 'PUT') {
      卡.rejected = true;
      卡.rejection_reason = (body as { reason?: P4淘汰原因形 }).reason ?? 'other';
      卡.state = 'rejected';
      P4域.招聘可用[岗位编号] = (P4域.招聘可用[岗位编号] ?? []).filter((条) => 条.recommendation_id !== 卡.recommendation_id);
      P4域.招聘已筛[岗位编号] = [...(P4域.招聘已筛[岗位编号] ?? []).filter((条) => 条.recommendation_id !== 卡.recommendation_id), 卡];
    } else {
      卡.rejected = false;
      卡.rejection_reason = null;
      卡.state = 'available';
      P4域.招聘已筛[岗位编号] = (P4域.招聘已筛[岗位编号] ?? []).filter((条) => 条.recommendation_id !== 卡.recommendation_id);
      P4域.招聘可用[岗位编号] = [...(P4域.招聘可用[岗位编号] ?? []).filter((条) => 条.recommendation_id !== 卡.recommendation_id), 卡];
    }
    await route.fulfill({ status: 200, json: 信封(P4发现偏好({ favorite: 卡.favorite, rejected: 卡.rejected, rejection_reason: 卡.rejection_reason })) });
    return true;
  }
  if (P4招聘详情匹配 && method === 'GET') {
    const 卡 = P4找招聘卡(decodeURIComponent(P4招聘详情匹配[1]), decodeURIComponent(P4招聘详情匹配[2]));
    if (!卡) {
      await route.fulfill({ status: 404, json: { error: { type: 'recommendation_not_found', message: '推荐不存在' } } });
      return true;
    }
    // release/0.2.5：DiscoveryRecruiterDetail 恒带 candidate_resume（键集闭合，缺键即漂移）
    await route.fulfill({ status: 200, json: 信封({ ...P4非展开卡(卡), candidate_resume: P4在线简历() }) });
    return true;
  }

  // 招聘端刷新：POST 建新批次（body 带 job_id，幂等键必带）
  if (path === '/api/v1/recruiter/candidate-recommendation-refreshes' && method === 'POST') {
    记录P4变更(path);
    P4域.刷新次数.recruiter += 1;
    const 岗位编号 = (body as { job_id?: string }).job_id ?? '';
    await route.fulfill({ status: 200, json: 信封(P4发现批次('recruiter_candidates', 岗位编号)) });
    return true;
  }

  // 招聘端委托：无披露字段，选择坐标是 recommendation_id；同键回同一张回执
  if (path === '/api/v1/recruiter/candidate-delegations' && method === 'POST') {
    记录P4变更(path);
    const 键 = 请求.headers()['idempotency-key'] ?? '';
    let 表项 = p4委托表.get(键);
    if (!表项) {
      const 换 = body as { job_id?: string; selection?: { items?: string[] } };
      const 推荐编号 = 换.selection?.items?.[0] ?? '';
      表项 = {
        role: 'recruiter',
        读数: 0,
        回执: { delegation_id: P4编号.recruiterDelegation, recommendation_id: 推荐编号, state: 'accepted', evaluation_id: null, case_id: null, refusal_code: null, failure_code: null },
      };
      p4委托表.set(键, 表项);
      for (const 卡 of P4域.招聘可用[换.job_id ?? ''] ?? []) {
        if (卡.recommendation_id === 推荐编号) {
          卡.delegation = { delegation_id: P4编号.recruiterDelegation, state: 'accepted', case_id: null };
        }
      }
    }
    await route.fulfill({ status: 200, json: 信封({ receipts: [P4深克隆(表项.回执)] }) });
    return true;
  }

  // 招聘端委托单项 GET：accepted 保持（P4 不制造 Case，case_id 恒空）
  const P4招聘委托读匹配 = /^\/api\/v1\/recruiter\/candidate-delegations\/([^/]+)$/.exec(path);
  if (P4招聘委托读匹配 && method === 'GET') {
    const 编号 = decodeURIComponent(P4招聘委托读匹配[1]);
    const 表项 = [...p4委托表.values()].find((项) => 项.回执.delegation_id === 编号);
    if (!表项) {
      await route.fulfill({ status: 404, json: { error: { type: 'delegation_not_found', message: '委托不存在' } } });
      return true;
    }
    表项.读数 += 1;
    P4域.委托读取.push({ delegationId: 编号, state: 表项.回执.state });
    await route.fulfill({ status: 200, json: 信封(P4深克隆(表项.回执)) });
    return true;
  }
  return false;
}
