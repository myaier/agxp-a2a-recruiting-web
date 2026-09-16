// e2e/fixtures/bff/招聘组织.ts
// P1C 招聘组织域 fixture（C2）：招聘方档案/企业关系/企业档案与媒体/管理员申请/
// owner 岗位（含岗位硬性条件四员）的 wire 形与样本，从 e2e/数据源模式.spec.ts
// 原样迁出。可变路由 handler 见同文件的 处理招聘组织域（阶段二迁入）。

import { 标记 } from './账号与目录';
import { 信封, type 路由上下文形 } from './协议';
import type { P3隐私fixture形 } from './隐私与实名';

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


// ── 安装态与路由 handler（C2 阶段二迁入）──

/** P1C 组织域的每次安装独立状态：档案/关系/申请/岗位与媒体登记。 */
export interface 组织安装状态形 {
  档案可变: P1C招聘方档案形 | null;
  关系可变: P1C企业关系形[];
  申请可变: P1C管理员申请形[];
  岗位可变: P1C岗位形[];
  企业档案表: Map<string, P1C企业档案形>;
  媒体登记: Map<string, P1C企业媒体形>;
  登记媒体: (件: { contentType: string; bytes: Buffer } | undefined) => P1C企业媒体形;
}

export function 创建组织安装状态(组织fixture: P1C招聘组织Fixture形 | 招聘方OnboardingFixture形 | null): 组织安装状态形 {
  // ── P1C 组织域可变 fixture 状态：每次安装独立一份，页面写入只影响本测试 ──
  let 档案可变: P1C招聘方档案形 | null = 组织fixture?.profile ? { ...组织fixture.profile } : null;
  const 关系可变: P1C企业关系形[] = 组织fixture ? 组织fixture.affiliations.map((项) => ({ ...项 })) : [];
  const 申请可变: P1C管理员申请形[] = 组织fixture ? 组织fixture.adminRequests.map((项) => ({ ...项 })) : [];
  const 岗位可变: P1C岗位形[] = 组织fixture ? 组织fixture.ownerJobs.map((项) => ({ ...项 })) : [];
  // 企业档案表：独立深拷贝（媒体/成员数组要独立），replacement 后 revision+1
  const 企业档案表 = new Map<string, P1C企业档案形>();
  if (组织fixture) {
    for (const [编号, 组织] of Object.entries(组织fixture.organizations)) {
      企业档案表.set(编号, {
        ...组织.profile,
        benefit_codes: [...组织.profile.benefit_codes],
        business_items: [...组织.profile.business_items],
        team_members: 组织.profile.team_members.map((员) => ({ ...员 })),
        office_media: [...组织.profile.office_media],
        company_media: [...组织.profile.company_media],
      });
    }
  }
  // 媒体登记：POST media 落号，PATCH replacement 按 id 引用回读（服务端语义）
  const 媒体登记 = new Map<string, P1C企业媒体形>();
  let 媒体序 = 0;
  const 登记媒体 = (件: { contentType: string; bytes: Buffer } | undefined): P1C企业媒体形 => {
    媒体序 += 1;
    const 型 = 件?.contentType.includes('jpeg') ? 'image/jpeg' : 'image/png';
    const 媒: P1C企业媒体形 = {
      media_id: `media-fixture-${媒体序}`,
      media_type: 型,
      size_bytes: 件?.bytes.length ?? 0,
      width: 1,
      height: 1,
      url: `data:${型};base64,${(件?.bytes ?? Buffer.alloc(0)).toString('base64')}`,
    };
    媒体登记.set(媒.media_id, 媒);
    return 媒;
  };
  return { 档案可变, 关系可变, 申请可变, 岗位可变, 企业档案表, 媒体登记, 登记媒体 };
}

export async function 处理招聘组织域(
  状态: 组织安装状态形,
  组织fixture: P1C招聘组织Fixture形 | 招聘方OnboardingFixture形 | null,
  onboardingFixture: 招聘方OnboardingFixture形 | null,
  P3域: P3隐私fixture形 | null,
  上下文: 路由上下文形,
): Promise<boolean> {
  const { route, 请求, url, path, method, body, 部件们 } = 上下文;
  // 原 jobs 块在组织 fixture 缺席时仍应答空岗位清单（recruiter 主壳首屏权威空态），
  // 其余组织路由按原 if (组织fixture) 包络缺席即不应答 —— 这里保持同一语义
  if (组织fixture === null) {
    if (path === '/api/v1/recruiter/jobs' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封({ jobs: [], next_cursor: null }) });
      return true;
    }
    return false;
  }
  const { 关系可变, 申请可变, 岗位可变, 企业档案表, 媒体登记, 登记媒体 } = 状态;

  // ── P1C 组织域（组织 fixture 存在时才应答；组织 fixture 缺席的用例走兜底空信封，
  //    strict decode 失败 → 水合抛错，这正是「Mock 内容不顶替 HTTP」的边界）──
  if (path === '/api/v1/recruiter/profile' && method === 'GET') {
    // 档案缺失是合法的「还没有」：404 not_found，不是故障（P0 修复 Task 1/7）
    if (状态.档案可变 === null) {
      await route.fulfill({
        status: 404,
        json: { error: { type: 'not_found', message: 'Recruiter profile not found' } },
      });
      return true;
    }
    await route.fulfill({ status: 200, json: 信封(状态.档案可变) });
    return true;
  }
  if (path === '/api/v1/recruiter/profile' && method === 'PATCH') {
    // CAS 按 fixture 的**实际**当前 revision 校验：缺失档案的首写必须带 If-Match: "0"
    const ifMatch = 请求.headers()['if-match'] ?? null;
    const expected = `"${状态.档案可变?.revision ?? 0}"`;
    if (ifMatch !== expected) {
      await route.fulfill({
        status: 409,
        json: { error: { type: 'version_conflict', message: 'profile revision mismatch' } },
      });
      return true;
    }
    const patch = body as { public_name?: string; title?: string; organization_ref?: string | null };
    // 合同 A/C：organization_ref 是档案必需键（可空不可缺）—— 名片自报公司选择
    // 走 公司选择抽屉 的稳定 ID，缺它 解招聘方档案 会按契约漂移拒绝整份档案
    状态.档案可变 = {
      public_name: patch.public_name ?? 状态.档案可变?.public_name ?? '',
      title: patch.title ?? 状态.档案可变?.title ?? '',
      personal_verification_status: 状态.档案可变?.personal_verification_status ?? 'unverified',
      organization_ref: patch.organization_ref !== undefined
        ? patch.organization_ref
        : (状态.档案可变?.organization_ref ?? null),
      verified_name: 状态.档案可变?.verified_name ?? null,
      avatar_url: 状态.档案可变?.avatar_url ?? null,
      revision: (状态.档案可变?.revision ?? 0) + 1,
    };
    if (onboardingFixture) {
      onboardingFixture.profile = { ...状态.档案可变 };
      onboardingFixture.mutations.push({ method, path, body, ifMatch });
    }
    await route.fulfill({ status: 200, json: 信封(状态.档案可变) });
    return true;
  }
  if (path === '/api/v1/recruiter/avatar' && method === 'POST') {
    // 招聘方 onboarding fixture 下 状态.档案可变 合法地为 null（首次 PATCH 之前还没有
    // 档案）。此时头像 POST 与 profile GET 同一个事实：404 not_found —— 不解引用
    // null，否则路由永不 fulfill，将来的用例会以 120s 超时死掉而不是给出可读失败。
    if (状态.档案可变 === null) {
      await route.fulfill({
        status: 404,
        json: { error: { type: 'not_found', message: 'Recruiter profile not found' } },
      });
      return true;
    }
    // 冻结 multipart：恰一个 media part，返回带新头像 URL 的完整档案
    const 媒 = 登记媒体(部件们?.find((件) => 件.name === 'media'));
    状态.档案可变.avatar_url = 媒.url;
    状态.档案可变.revision += 1;
    await route.fulfill({ status: 200, json: 信封(状态.档案可变) });
    return true;
  }
  if (path === '/api/v1/recruiter/affiliations' && method === 'GET') {
    await route.fulfill({ status: 200, json: 信封({ affiliations: 关系可变 }) });
    return true;
  }
  if (path === '/api/v1/recruiter/organization-admin-requests' && method === 'GET') {
    await route.fulfill({ status: 200, json: 信封({ requests: 申请可变 }) });
    return true;
  }

  // 公开企业（直接读取：名片选当前关系 / 岗位公司卡 / 企业详情页共用）
  const 公开匹配 = /^\/api\/v1\/organizations\/([^/]+)$/.exec(path);
  if (公开匹配 && method === 'GET') {
    const 组织 = 组织fixture.organizations[公开匹配[1]];
    const 档 = 企业档案表.get(公开匹配[1]);
    if (!组织 || !档) {
      await route.fulfill({ status: 404, json: { error: { type: 'organization_not_found', message: '企业不存在' } } });
      return true;
    }
    await route.fulfill({
      status: 200,
      json: 信封({
        organization_id: 公开匹配[1],
        legal_name: 组织.legal_name,
        display_name: 组织.display_name,
        verified_at: '2026-08-25T00:00:00Z',
        profile: 档,
        active_verified_job_count: 1,
      }),
    });
    return true;
  }

  // 企业档案（GET 权威快照 / PATCH 完整 replacement）
  const 档案匹配 = /^\/api\/v1\/organizations\/([^/]+)\/profile$/.exec(path);
  if (档案匹配) {
    const 档 = 企业档案表.get(档案匹配[1]);
    if (!档) {
      await route.fulfill({ status: 404, json: { error: { type: 'organization_not_found', message: '企业不存在' } } });
      return true;
    }
    if (method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(档) });
      return true;
    }
    if (method === 'PATCH') {
      const 换 = body as {
        display_name: string; brand_name: string; industry_id: string;
        company_size: P1C企业档案形['company_size'];
        funding_stage: P1C企业档案形['funding_stage']; office_address: string;
        benefit_codes: string[]; work_schedule: P1C企业档案形['work_schedule']; company_intro: string;
        business_items: string[]; office_media_ids: string[]; company_media_ids: string[];
        product_intro: string; team_members: { name: string; title: string; summary: string }[];
        logo_media_id: string;
      };
      // Spec §2：常用名与目录 display_name 同源 —— 改名同步公开企业应答与同企业关系的显示名
      档.display_name = 换.display_name;
      const 组织 = 组织fixture.organizations[档案匹配[1]];
      if (组织) 组织.display_name = 换.display_name;
      for (const 关 of 关系可变) {
        if (关.organization_id === 档案匹配[1]) 关.organization_display_name = 换.display_name;
      }
      档.brand_name = 换.brand_name;
      档.industry = 换.industry_id ? { id: 换.industry_id, display_name: 'Fixture 行业' } : null;
      档.company_size = 换.company_size;
      档.funding_stage = 换.funding_stage;
      档.office_address = 换.office_address;
      档.benefit_codes = [...换.benefit_codes];
      档.work_schedule = 换.work_schedule;
      档.company_intro = 换.company_intro;
      档.business_items = [...换.business_items];
      档.product_intro = 换.product_intro;
      档.team_members = 换.team_members.map((员) => ({ ...员 }));
      档.logo = 换.logo_media_id ? 媒体登记.get(换.logo_media_id) ?? null : null;
      档.office_media = 换.office_media_ids
        .map((号) => 媒体登记.get(号))
        .filter((媒): 媒 is P1C企业媒体形 => Boolean(媒));
      档.company_media = 换.company_media_ids
        .map((号) => 媒体登记.get(号))
        .filter((媒): 媒 is P1C企业媒体形 => Boolean(媒));
      档.revision += 1;
      档.updated_at = '2026-08-26T00:00:00Z';
      await route.fulfill({ status: 200, json: 信封(档) });
      return true;
    }
  }

  // 企业媒体两步协议：POST 落号（幂等由客户端 Idempotency-Key 承担）/ DELETE 204 无信封
  if (/^\/api\/v1\/organizations\/[^/]+\/media$/.test(path) && method === 'POST') {
    await route.fulfill({ status: 200, json: 信封(登记媒体(部件们?.find((件) => 件.name === 'media'))) });
    return true;
  }
  const 媒体删除匹配 = /^\/api\/v1\/organizations\/([^/]+)\/media\/([^/]+)$/.exec(path);
  if (媒体删除匹配 && method === 'DELETE') {
    媒体登记.delete(媒体删除匹配[2]);
    await route.fulfill({ status: 204, body: '' });
    return true;
  }

  // ── recruiter jobs ──
  if (path === '/api/v1/recruiter/jobs' && method === 'GET') {
    await route.fulfill({ status: 200, json: 信封({ jobs: 组织fixture ? 岗位可变 : [], next_cursor: null }) });
    return true;
  }
  if (组织fixture && path === '/api/v1/recruiter/jobs' && method === 'POST') {
    // 服务端推导（客户端 body 只有 claim，无 refs / verification status）：
    // 首个 verified+active 关系给出两个 ref 与两侧验证状态；没有关系则 unverified 无 ref。
    // P3：hard_requirements 四员块必收完整（客户端永远带整块），fixture 原样落库回读。
    const 换 = body as {
      publisher_mode: 'direct' | 'agency';
      // 合同 C（2026-09-13）：claim 键退役 —— body 只带 publisher/hiring 两个 ref，
      // claim 由服务端从 ref 快照生成；fixture 从组织池反查显示名
      publisher_organization_ref?: string;
      hiring_organization_ref?: string;
      title: string;
      recruitment_type: P1C岗位形['recruitment_type'];
      category_id: string;
      location_id: string;
      office_location: string;
      workplace_mode: P1C岗位形['workplace_mode'];
      salary: { lower: number; upper: number };
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
      hard_requirements?: P3硬性条件形;
    };
    const 发布关系 = 关系可变.find((项) => 项.status === 'verified' && 项.organization_status === 'active');
    const 组织显示名 = (编号: string | null | undefined): string | null => {
      if (!编号) return null;
      return 组织fixture.organizations[编号]?.display_name
        ?? P3域?.组织库[编号]?.display_name
        ?? null;
    };
    const 发布方编号 = 换.publisher_organization_ref ?? 发布关系?.organization_id ?? null;
    const 用人编号 = 换.hiring_organization_ref ?? 发布关系?.organization_id ?? null;
    const 现在 = '2026-08-26T00:00:00Z';
    const 新岗: P1C岗位形 = {
      job_id: `job-fixture-created-${岗位可变.length + 1}`,
      publisher_mode: 换.publisher_mode,
      publisher_affiliation_ref: 发布关系?.affiliation_id,
      publisher_verification_status: 发布关系 ? 'verified' : 'unverified',
      hiring_organization_claim: {
        display_name: 组织显示名(用人编号) ?? '',
        legal_name: null,
      },
      publisher_organization_ref: 发布方编号,
      hiring_organization_verification_status: 发布关系 ? 'verified' : 'unverified',
      hiring_organization_ref: 用人编号,
      title: 换.title,
      recruitment_type: 换.recruitment_type,
      category: { id: 换.category_id, display_name: 标记.职位display },
      location: { id: 换.location_id, display_name: 标记.城市display },
      office_location: 换.office_location,
      workplace_mode: 换.workplace_mode,
      salary_lower: 换.salary.lower,
      salary_upper: 换.salary.upper,
      salary_period: 换.recruitment_type === 'internship' || 换.recruitment_type === 'part_time' ? 'day' : 'month',
      annual_salary_months: 换.annual_salary_months,
      campus_cohort: 换.campus_cohort,
      internship_months: 换.internship_months,
      onsite_days_per_week: 换.onsite_days_per_week,
      experience_requirement: 换.experience_requirement,
      education_requirement: 换.education_requirement,
      structured_requirements_confirmed: 换.structured_requirements_confirmed,
      description: 换.description,
      requirements: 换.requirements,
      keywords: 换.keywords,
      private_screening_preferences: 换.private_screening_preferences,
      hard_requirements: { ...P3全未知硬性条件(), ...换.hard_requirements },
      status: 'active',
      revision: 1,
      published_at: 现在,
      created_at: 现在,
      updated_at: 现在,
    };
    岗位可变.push(新岗);
    if (onboardingFixture) {
      onboardingFixture.ownerJobs.push({ ...新岗 });
      onboardingFixture.mutations.push({
        method,
        path,
        body,
        ifMatch: 请求.headers()['if-match'] ?? null,
      });
    }
    await route.fulfill({ status: 201, json: 信封(新岗) });
    return true;
  }

  // P3：编辑岗位 —— PATCH 回完整 owner DTO（immutable title/type/category/location 带
  // 服务端原值），hard_requirements 整块替换，revision+1。客户端 PATCH 前必带 quoted If-Match。
  const 编辑匹配 = 组织fixture ? /^\/api\/v1\/recruiter\/jobs\/([^/]+)$/.exec(path) : null;
  if (编辑匹配 && method === 'PATCH') {
    const 存量 = 岗位可变.find((项) => 项.job_id === 编辑匹配[1]);
    if (!存量) {
      await route.fulfill({ status: 404, json: { error: { type: 'job_not_found', message: '岗位不存在' } } });
      return true;
    }
    const 补丁 = body as {
      publisher_mode: 'direct' | 'agency';
      hiring_organization_claim: { display_name: string; legal_name?: string | null };
      office_location: string;
      workplace_mode: P1C岗位形['workplace_mode'];
      salary: { lower: number; upper: number };
      annual_salary_months: number | null;
      campus_cohort: number | null;
      internship_months: number | null;
      onsite_days_per_week: number | null;
      experience_requirement: string;
      education_requirement: string;
      structured_requirements_confirmed: boolean;
      hard_requirements?: P3硬性条件形;
      description: string;
      requirements: string;
      keywords: string[];
      private_screening_preferences: string;
    };
    // P4 互认 Task 2 的真实契约是 sparse patch：只叠加 body 里出现的可编辑字段，
    // 未携带（未变化）的字段沿存量原值 —— 否则无关编辑保存会在 fixture 里假崩溃。
    存量.office_location = 补丁.office_location ?? 存量.office_location;
    存量.workplace_mode = 补丁.workplace_mode ?? 存量.workplace_mode;
    存量.salary_lower = 补丁.salary?.lower ?? 存量.salary_lower;
    存量.salary_upper = 补丁.salary?.upper ?? 存量.salary_upper;
    存量.salary_period = 存量.recruitment_type === 'internship' || 存量.recruitment_type === 'part_time' ? 'day' : 'month';
    存量.annual_salary_months = 补丁.annual_salary_months ?? 存量.annual_salary_months;
    存量.campus_cohort = 补丁.campus_cohort ?? 存量.campus_cohort;
    存量.internship_months = 补丁.internship_months ?? 存量.internship_months;
    存量.onsite_days_per_week = 补丁.onsite_days_per_week ?? 存量.onsite_days_per_week;
    存量.experience_requirement = 补丁.experience_requirement ?? 存量.experience_requirement;
    存量.education_requirement = 补丁.education_requirement ?? 存量.education_requirement;
    存量.structured_requirements_confirmed = 补丁.structured_requirements_confirmed ?? 存量.structured_requirements_confirmed;
    存量.hard_requirements = { ...P3全未知硬性条件(), ...补丁.hard_requirements };
    存量.description = 补丁.description ?? 存量.description;
    存量.requirements = 补丁.requirements ?? 存量.requirements;
    存量.keywords = Array.isArray(补丁.keywords) ? [...补丁.keywords] : 存量.keywords;
    存量.private_screening_preferences = 补丁.private_screening_preferences ?? 存量.private_screening_preferences;
    存量.revision += 1;
    存量.updated_at = '2026-08-27T02:00:00Z';
    await route.fulfill({ status: 200, json: 信封({ ...存量 }) });
    return true;
  }
  return false;
}
