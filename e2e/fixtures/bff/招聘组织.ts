// e2e/fixtures/bff/招聘组织.ts
// P1C 招聘组织域 fixture（C2）：招聘方档案/企业关系/企业档案与媒体/管理员申请/
// owner 岗位（含岗位硬性条件四员）的 wire 形与样本，从 e2e/数据源模式.spec.ts
// 原样迁出。可变路由 handler 见同文件的 处理招聘组织域（阶段二迁入）。

import { 标记 } from './账号与目录';

// ── P1C 招聘组织域样本与工厂 ──

// ─────────────────────────────────────────────────────────────────────────────
// P1C 组织域 fixture（@backend）。所有标记值只存在于 fixture，断言页面展示它们
// 即证明渲染来自 HTTP 而非 Mock。fixture 不伪造 opaque Organization ID ——
// 没有企业关系的用例（未认证声明发岗）organizations 刻意留空。
// ─────────────────────────────────────────────────────────────────────────────

export const P1C标记 = {
  招聘方公开名: '后端 fixture 招聘方',
  招聘方职务: 'Fixture 招聘负责人',
  组织甲编号: 'org-fixture-001',
  组织甲名: 'Fixture 云衢科技',
  组织甲法定名: '上海 Fixture 云衢信息科技有限公司',
  组织乙编号: 'org-fixture-002',
  组织乙名: 'Fixture 关联企业',
  品牌名: 'Fixture 云衢',
  公司介绍: '这是 fixture 的公司介绍原文。',
} as const;

export type P1C验证状态 = 'unverified' | 'verified';

export interface P1C招聘方档案形 {
  public_name: string;
  title: string;
  personal_verification_status: P1C验证状态;
  // 合同 A：必需键（可空不可缺）——null = 未选择目录组织；选了组织给 fixture 组织 ID
  organization_ref: string | null;
  verified_name: string | null;
  avatar_url: string | null;
  revision: number;
}

export interface P1C企业关系形 {
  affiliation_id: string;
  organization_id: string;
  organization_display_name: string;
  organization_status: 'active' | 'suspended';
  status: 'pending' | 'verified' | 'revoked';
  role: 'member' | 'admin';
  verification_method: 'admin_invitation' | 'corporate_email' | 'manual_admin_review';
  revision: number;
}

export interface P1C企业媒体形 {
  media_id: string;
  media_type: 'image/png' | 'image/jpeg';
  size_bytes: number;
  width: number;
  height: number;
  url: string;
}

export interface P1C企业档案形 {
  // Spec §2（2026-09-14）：企业常用名，与目录/公开企业 display_name 同源
  display_name: string;
  brand_name: string;
  industry: { id: string; display_name: string } | null;
  company_size: string;
  funding_stage: string;
  office_address: string;
  benefit_codes: string[];
  work_schedule: string;
  company_intro: string;
  business_items: string[];
  product_intro: string;
  team_members: { name: string; title: string; summary: string }[];
  logo: P1C企业媒体形 | null;
  office_media: P1C企业媒体形[];
  company_media: P1C企业媒体形[];
  revision: number;
  updated_at: string | null;
}

export interface P1C组织形 {
  legal_name: string;
  display_name: string;
  profile: P1C企业档案形;
}

export interface P1C管理员申请形 {
  request_id: string;
  // 解企业管理员申请 的必需键：申请目标目录组织 ID（缺键整份列表按契约漂移拒绝）
  organization_id: string;
  legal_name: string;
  display_name: string;
  domains: string[];
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  revision: number;
}

/** BFFOwnerJob 的 fixture 形（可选投影键允许缺省，与服务端推导口径一致） */
export interface P1C岗位形 {
  job_id: string;
  publisher_mode: 'direct' | 'agency';
  publisher_affiliation_ref?: string;
  publisher_verification_status: P1C验证状态;
  hiring_organization_claim: { display_name: string; legal_name: string | null };
  publisher_organization_ref?: string;
  hiring_organization_verification_status: P1C验证状态;
  hiring_organization_ref?: string;
  title: string;
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
  description: string;
  requirements: string;
  keywords: string[];
  private_screening_preferences: string;
  // P3：四员硬性条件是 Owner Job 的必备成员 —— 前端按 exact key set + 闭合档位 fail-closed 校验，
  // 所有 Owner Job fixture（GET 列表 / POST / PATCH 应答）都必须带完整四员，缺员即水合拒绝。
  hard_requirements: P3硬性条件形;
  status: 'active' | 'archived';
  revision: number;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface P1C招聘组织Fixture形 {
  profile: P1C招聘方档案形;
  affiliations: P1C企业关系形[];
  organizations: Record<string, P1C组织形>;
  adminRequests: P1C管理员申请形[];
  ownerJobs: P1C岗位形[];
}

/** 招聘方 onboarding 变更回执：写入方法 / 路径 / body 与该次写入实际带的 If-Match */
export interface 招聘方Onboarding变更 {
  method: string;
  path: string;
  body: unknown;
  ifMatch: string | null;
}

/**
 * 全新招聘方 onboarding 的可变 fixture：与 P1C招聘组织Fixture形 同域但**独立**
 * —— profile 真正可空（首读 404 not_found），首写经 revision-zero 的 CAS 变成权威 DTO。
 * 与候选 onboarding fixture 无任何共享或复位关系：各测试自持一份。
 */
export interface 招聘方OnboardingFixture形 {
  profile: P1C招聘方档案形 | null;
  affiliations: P1C企业关系形[];
  organizations: Record<string, P1C组织形>;
  adminRequests: P1C管理员申请形[];
  ownerJobs: P1C岗位形[];
  mutations: 招聘方Onboarding变更[];
}

export function 创建招聘方OnboardingFixture(): 招聘方OnboardingFixture形 {
  return {
    profile: null,
    affiliations: [],
    organizations: {},
    adminRequests: [],
    ownerJobs: [],
    mutations: [],
  };
}

export function P1C企业档案(): P1C企业档案形 {
  return {
    // 默认即组织甲的常用名（组织乙在 P1C组织乙 覆盖为自己的名字）：目录与 profile 同源
    display_name: P1C标记.组织甲名,
    brand_name: P1C标记.品牌名,
    industry: { id: 'ind-fixture-001', display_name: 'Fixture 行业' },
    company_size: '20_99',
    funding_stage: 'angel',
    office_address: 'Fixture 市 Fixture 路 1 号',
    benefit_codes: ['social_insurance_housing_fund'],
    work_schedule: 'two_day_weekend',
    company_intro: P1C标记.公司介绍,
    business_items: ['Fixture 主营业务一'],
    product_intro: 'Fixture 产品介绍',
    team_members: [{ name: 'Fixture 成员', title: '工程师', summary: 'Fixture 成员简介' }],
    logo: null,
    office_media: [],
    company_media: [],
    revision: 2,
    updated_at: '2026-08-25T00:00:00Z',
  };
}

export function P1C企业关系(覆盖: Partial<P1C企业关系形> = {}): P1C企业关系形 {
  return {
    affiliation_id: 'aff-fixture-001',
    organization_id: P1C标记.组织甲编号,
    organization_display_name: P1C标记.组织甲名,
    organization_status: 'active',
    status: 'verified',
    role: 'member',
    verification_method: 'admin_invitation',
    revision: 1,
    ...覆盖,
  };
}

export function P1C岗位(覆盖: Partial<P1C岗位形> = {}): P1C岗位形 {
  return {
    job_id: 'job-fixture-001',
    publisher_mode: 'direct',
    publisher_verification_status: 'verified',
    hiring_organization_claim: { display_name: P1C标记.组织甲名, legal_name: null },
    publisher_organization_ref: P1C标记.组织甲编号,
    hiring_organization_verification_status: 'verified',
    hiring_organization_ref: P1C标记.组织甲编号,
    title: 'Fixture 岗位（带企业引用）',
    recruitment_type: 'internship',
    category: { id: 'job-fixture-001', display_name: 标记.职位display },
    location: { id: 'loc-fixture-001', display_name: 标记.城市display },
    office_location: 'Fixture 市 Fixture 路 1 号',
    workplace_mode: 'hybrid',
    salary_lower: 200,
    salary_upper: 400,
    salary_period: 'day',
    annual_salary_months: null,
    campus_cohort: null,
    internship_months: 3,
    onsite_days_per_week: 4,
    experience_requirement: 'none',
    education_requirement: 'none',
    structured_requirements_confirmed: true,
    description: 'Fixture 岗位描述',
    requirements: 'Fixture 岗位要求',
    keywords: [],
    private_screening_preferences: '',
    hard_requirements: P3全未知硬性条件(),
    status: 'active',
    revision: 1,
    published_at: '2026-08-25T00:00:00Z',
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T00:00:00Z',
    ...覆盖,
  };
}

/** 主管 fixture：未认证招聘方 + 无任何企业关系（公司输入走未认证声明）+ 一条待审核管理员申请 */
export const P1C招聘组织Fixture: P1C招聘组织Fixture形 = {
  profile: {
    public_name: P1C标记.招聘方公开名,
    title: P1C标记.招聘方职务,
    personal_verification_status: 'unverified',
    organization_ref: null, // 未选择目录组织（无任职关系、未自报）；404 首写路径不经此档案
    verified_name: null,
    avatar_url: null,
    revision: 3,
  },
  affiliations: [],
  organizations: {},
  adminRequests: [
    { request_id: 'req-fixture-001', organization_id: P1C标记.组织甲编号, legal_name: P1C标记.组织甲法定名, display_name: P1C标记.组织甲名, domains: ['fixture.example'], status: 'pending', revision: 1 },
  ],
  ownerJobs: [],
};

/** admin@组织甲（verified/active → 可写公司档案） */
export const P1C管理员关系 = P1C企业关系({ affiliation_id: 'aff-fixture-admin', role: 'admin' });
/** member@组织乙（verified/active → 只读公司档案） */
export const P1C成员关系 = P1C企业关系({
  affiliation_id: 'aff-fixture-member',
  organization_id: P1C标记.组织乙编号,
  organization_display_name: P1C标记.组织乙名,
  role: 'member',
  verification_method: 'corporate_email',
});

export const P1C组织甲 = (): P1C组织形 => ({
  legal_name: P1C标记.组织甲法定名,
  display_name: P1C标记.组织甲名,
  profile: P1C企业档案(),
});

export const P1C组织乙 = (): P1C组织形 => ({
  legal_name: '上海 Fixture 关联企业有限公司',
  display_name: P1C标记.组织乙名,
  profile: { ...P1C企业档案(), display_name: P1C标记.组织乙名 },
});

/** 在主管 fixture 上叠企业关系 / 在招岗位（各用例按需组合） */
export function 带企业关系(
  base: P1C招聘组织Fixture形,
  关系们: P1C企业关系形[],
  组织们: Record<string, P1C组织形>,
  岗位们: P1C岗位形[] = [],
): P1C招聘组织Fixture形 {
  return { ...base, affiliations: 关系们, organizations: 组织们, ownerJobs: 岗位们 };
}

/** 1×1 PNG：上传用（头像 / 企业媒体），不依赖任何本地图片文件 */
export const 一像素PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// ── 岗位硬性条件 fixture 形（Owner Job 必备四员） ──

/** BFF硬性条件的 fixture 形（四员闭合，缺一即服务端契约漂移） */
export type P3硬性档 = 'required' | 'not_required' | 'unknown';

export interface P3硬性条件形 {
  alternate_weekend_work: P3硬性档;
  outsourcing_only: P3硬性档;
  onsite_only: P3硬性档;
  frequent_travel: P3硬性档;
}

/** 服务端存储口径的四员兜底：全部 未说明（unknown），只许 fixture 合成，客户端解码不做兜底 */
export const P3全未知硬性条件 = (): P3硬性条件形 => ({
  alternate_weekend_work: 'unknown',
  outsourcing_only: 'unknown',
  onsite_only: 'unknown',
  frequent_travel: 'unknown',
});
