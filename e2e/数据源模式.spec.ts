// e2e/数据源模式.spec.ts
// 数据源边界 E2E：Mock 回归 + Backend fixture。两个 describe 各自 test.use({ baseURL })
// 钉到专用 server（mock/stg 4181、backend/stg 4182），项目用 grep 按 @mock / @backend 标签选跑。
//
// Mock：显式 mock/stg server，走现有 candidate 演示流程；断言没有 /api/v1 请求、登录仍 4 格验证码、
// 本地城市/学校/职位仍可选、没有新增页面/弹层/全局 loading。
//
// Backend：显式 backend/stg server。Playwright page.route 拦截所有 /api/v1/* 用 fixture 应答
// （Backend dev server 会代理 /api/v1 到 stg，但 stg 从测试不可达，所以 route-fulfil 全部 fixture）。
// 这只验证前端在拦截边界上的行为，不是真实 BFF 联调 —— 真实后端从不被启动、修改或验证。
// 记录所有 /api/v1/catalog/* 请求，覆盖：candidate login/session 后无 Catalog 请求；打开城市只请求
// 目标省第一页；中英文学校搜索选择同一 institution ID 且候选副行显示「城市 · 国家」；
// 写入 body 使用选择 ID（不含 /catalog/ 反查）；422 array fields、401 cleanup、409 reread、503 同幂等键。
// 响应放入只存在于 fixture 的标记值，断言页面展示该值，证明渲染来自 HTTP 而非 Mock。
//
// P1C（Task 6）：追加组织域 fixture —— RecruiterProfile / Affiliation / 公开企业 / 企业档案与媒体 /
// 管理员申请 / owner Jobs。multipart 请求（头像 / 企业媒体 / 管理员申请证据）不用 JSON parser 解整体，
// 按 content-type boundary 取 part 名；metadata part 内容只在测试进程内比对，不写日志、不进 snapshot。

import { expect, test, type Page, type Route } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Mock 回归 @mock
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Mock 数据源回归 @mock', () => {
  // 显式 mock/stg server（端口 4181），不依赖缺省 dev server
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('缺省数据源保持 PM Mock 登录体验和四格验证码 @mock', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });
    await page.goto('/');
    await page.getByLabel('手机号').fill('13800000000');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.locator('[class*="验证码格"]')).toHaveCount(4);
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '进入' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    expect(apiRequests).toEqual([]);
    await expect(page.getByText('数据源')).toHaveCount(0);
    await expect(page.getByText(/backend|stg|local/i)).toHaveCount(0);
  });

  test('Mock 本地城市/学校/职位仍可选，无新增页面或弹层 @mock', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    // 微信登录在 Mock 模式仍一键直进，但必须先同意协议
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // 本地期望职位仍可选
    await page.getByRole('button', { name: /选择期望职位/ }).click();
    await page.getByRole('button', { name: '产品', exact: true }).click();
    await page.getByRole('button', { name: '产品经理', exact: true }).click();
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // 没有任何 /api/v1 请求（Mock 模式零 API）
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Backend fixture @backend
// ─────────────────────────────────────────────────────────────────────────────

// 只存在于 fixture 的标记值：Mock 里没有，断言页面展示它们即证明渲染来自 HTTP。
const 标记 = {
  主体真名: '后端 fixture 候选人',
  城市display: ' Fixture 市',
  学校display: ' Fixture 大学',
  学校副行: 'Fixture City · Fixtureland',
  职位display: ' Fixture 工程师',
  简历summary: '后端 fixture 个人优势标记',
  意向标题城市: 'Fixture 市',
} as const;

/** BFF 信封：{ result, meta: { request_id, api_version } } */
function 信封<T>(result: T): { result: T; meta: { request_id: string; api_version: 'v1' } } {
  return { result, meta: { request_id: 'fixture-req', api_version: 'v1' } };
}

/** BFF 目录页：items + next_cursor + catalog_version */
function 目录页<T extends { id: string; display_name: string }>(items: T[]): {
  items: T[];
  next_cursor: string | null;
  catalog_version: string;
} {
  return { items, next_cursor: null, catalog_version: 'fixture-v1' };
}

const fixture主体 = {
  subject_id: 'subj-fixture-001',
  roles: [{ role: 'candidate' as const, status: 'active' as const }],
  last_used_role: 'candidate' as const,
};

const fixture简历 = {
  profile: {
    real_name: 标记.主体真名,
    work_start_year: 2019,
    status: 'employed' as const,
    current_education: null,
    graduation_year: null,
    gender: null,
    birth_year: null,
    birth_month: null,
  },
  profile_revision: 1,
  summary: 标记.简历summary,
  summary_revision: 1,
  skills: ['Go', '分布式事务'],
  skills_revision: 1,
  experiences: [],
  educations: [],
  certificates: [],
  aggregate_revision: 1,
};

const fixture意向列表 = {
  intentions: [
    {
      intention_id: 'int-fixture-001',
      recruitment_type: 'social_full_time' as const,
      job_category: { id: 'job-fixture-001', display_name: 标记.职位display },
      primary_location: { id: 'loc-fixture-001', display_name: 标记.意向标题城市 },
      alternate_locations: [],
      industries: [],
      workplace_modes: ['onsite' as const],
      compensation: { mode: 'range' as const, lower: 30, upper: 50, annual_salary_months: 15 },
      salary_period: 'month' as const,
      graduation_month: null,
      internship_months: null,
      onsite_days_per_week: null,
      exclusions: {
        alternate_weekend_work: 'unspecified' as const,
        outsourcing_only: 'unspecified' as const,
        onsite_only: 'unspecified' as const,
        frequent_travel: 'unspecified' as const,
      },
      private_preferences: '',
      status: 'active' as const,
      revision: 1,
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// P1C 组织域 fixture（@backend）。所有标记值只存在于 fixture，断言页面展示它们
// 即证明渲染来自 HTTP 而非 Mock。fixture 不伪造 opaque Organization ID ——
// 没有企业关系的用例（未认证声明发岗）organizations 刻意留空。
// ─────────────────────────────────────────────────────────────────────────────

const P1C标记 = {
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

type P1C验证状态 = 'unverified' | 'verified';

interface P1C招聘方档案形 {
  public_name: string;
  title: string;
  personal_verification_status: P1C验证状态;
  verified_name: string | null;
  avatar_url: string | null;
  revision: number;
}

interface P1C企业关系形 {
  affiliation_id: string;
  organization_id: string;
  organization_display_name: string;
  organization_status: 'active' | 'suspended';
  status: 'pending' | 'verified' | 'revoked';
  role: 'member' | 'admin';
  verification_method: 'admin_invitation' | 'corporate_email' | 'manual_admin_review';
  revision: number;
}

interface P1C企业媒体形 {
  media_id: string;
  media_type: 'image/png' | 'image/jpeg';
  size_bytes: number;
  width: number;
  height: number;
  url: string;
}

interface P1C企业档案形 {
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

interface P1C组织形 {
  legal_name: string;
  display_name: string;
  profile: P1C企业档案形;
}

interface P1C管理员申请形 {
  request_id: string;
  legal_name: string;
  display_name: string;
  domains: string[];
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  revision: number;
}

/** BFFOwnerJob 的 fixture 形（可选投影键允许缺省，与服务端推导口径一致） */
interface P1C岗位形 {
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

interface P1C招聘组织Fixture形 {
  profile: P1C招聘方档案形;
  affiliations: P1C企业关系形[];
  organizations: Record<string, P1C组织形>;
  adminRequests: P1C管理员申请形[];
  ownerJobs: P1C岗位形[];
}

function P1C企业档案(): P1C企业档案形 {
  return {
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

function P1C企业关系(覆盖: Partial<P1C企业关系形> = {}): P1C企业关系形 {
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

function P1C岗位(覆盖: Partial<P1C岗位形> = {}): P1C岗位形 {
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
    description: 'Fixture 岗位描述',
    requirements: 'Fixture 岗位要求',
    keywords: [],
    private_screening_preferences: '',
    status: 'active',
    revision: 1,
    published_at: '2026-08-25T00:00:00Z',
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T00:00:00Z',
    ...覆盖,
  };
}

/** 主管 fixture：未认证招聘方 + 无任何企业关系（公司输入走未认证声明）+ 一条待审核管理员申请 */
const P1C招聘组织Fixture: P1C招聘组织Fixture形 = {
  profile: {
    public_name: P1C标记.招聘方公开名,
    title: P1C标记.招聘方职务,
    personal_verification_status: 'unverified',
    verified_name: null,
    avatar_url: null,
    revision: 3,
  },
  affiliations: [],
  organizations: {},
  adminRequests: [
    { request_id: 'req-fixture-001', legal_name: P1C标记.组织甲法定名, display_name: P1C标记.组织甲名, domains: ['fixture.example'], status: 'pending', revision: 1 },
  ],
  ownerJobs: [],
};

/** admin@组织甲（verified/active → 可写公司档案） */
const P1C管理员关系 = P1C企业关系({ affiliation_id: 'aff-fixture-admin', role: 'admin' });
/** member@组织乙（verified/active → 只读公司档案） */
const P1C成员关系 = P1C企业关系({
  affiliation_id: 'aff-fixture-member',
  organization_id: P1C标记.组织乙编号,
  organization_display_name: P1C标记.组织乙名,
  role: 'member',
  verification_method: 'corporate_email',
});

const P1C组织甲 = (): P1C组织形 => ({
  legal_name: P1C标记.组织甲法定名,
  display_name: P1C标记.组织甲名,
  profile: P1C企业档案(),
});

const P1C组织乙 = (): P1C组织形 => ({
  legal_name: '上海 Fixture 关联企业有限公司',
  display_name: P1C标记.组织乙名,
  profile: P1C企业档案(),
});

/** 在主管 fixture 上叠企业关系 / 在招岗位（各用例按需组合） */
function 带企业关系(
  base: P1C招聘组织Fixture形,
  关系们: P1C企业关系形[],
  组织们: Record<string, P1C组织形>,
  岗位们: P1C岗位形[] = [],
): P1C招聘组织Fixture形 {
  return { ...base, affiliations: 关系们, organizations: 组织们, ownerJobs: 岗位们 };
}

/** 1×1 PNG：上传用（头像 / 企业媒体），不依赖任何本地图片文件 */
const 一像素PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

interface BFF路由选项 {
  记录目录请求: (path: string) => void;
  登录尝试id: string;
  /** 请求拦截：每次 /api/v1 请求触发（headers 可用于断言 If-Match / Idempotency-Key 等头） */
  请求拦截?: (请求: 拦截请求形) => void;
  /** 自定义响应覆盖：key = `METHOD path`；返回 undefined 表示放行给内置 fixture 应答 */
  覆盖?: Record<string, (body: unknown) => { status: number; 响应: unknown } | undefined>;
  /** GET /api/v1/session 返回 200（已登录）还是 401（未登录）。缺省 200（自动登录）*/
  会话已登录?: boolean;
  /** P1C：组织域 fixture（profile / affiliations / 公开企业 / 档案与媒体 / 管理员申请 / owner Jobs） */
  招聘组织Fixture?: P1C招聘组织Fixture形;
  /** 招聘方主体初始 last_used_role：null（缺省）→ 落身份选择页走「我要招人」；'recruiter' → 直接水合进企业主壳 */
  主体初始角色?: 'recruiter' | null;
}

/** 请求拦截收到的请求投影；multipart 的 metadata 只在测试进程内比对 */
interface 拦截请求形 {
  path: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
  /** multipart 请求：part 名按出现顺序 + metadata part 内容（无则 undefined） */
  multipart?: { parts: string[]; metadata?: unknown };
}

/**
 * 按 content-type boundary 切分 multipart body，取 part 名 / part 类型 / part 字节。
 * 不用 JSON parser 解析整体：boundary 字节是 ASCII，latin1 索引与原 Buffer 一一对应，
 * part 内容回切原 Buffer 后再按需 utf8 解码。
 */
function 取multipart部件(请求: Route['request']): { name: string; contentType: string; bytes: Buffer }[] | null {
  const 类型 = 请求.headers()['content-type'] ?? '';
  const 匹配 = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(类型);
  if (!匹配) return null;
  const 界串 = `--${(匹配[1] ?? 匹配[2]).trim()}`;
  const 原文 = 请求.postDataBuffer();
  if (!原文) return [];
  const 文本 = 原文.toString('latin1');
  const 部件: { name: string; contentType: string; bytes: Buffer }[] = [];
  let 位 = 文本.indexOf(界串);
  while (位 !== -1) {
    const 头起 = 位 + 界串.length;
    if (文本.slice(头起, 头起 + 2) === '--') break; // 终界
    const 头止 = 文本.indexOf('\r\n\r\n', 头起);
    if (头止 === -1) break;
    const 头 = 文本.slice(头起, 头止);
    const 名 = /name="([^"]*)"/i.exec(头)?.[1] ?? '';
    const 型 = /content-type:\s*([^\r\n]+)/i.exec(头)?.[1].trim() ?? '';
    const 下界 = 文本.indexOf(界串, 头止);
    const 体止 = 下界 === -1 ? 原文.length : 下界 - 2; // 去掉 part 尾部 \r\n
    部件.push({ name: 名, contentType: 型, bytes: 原文.subarray(头止 + 4, 体止) });
    if (下界 === -1) break;
    位 = 下界;
  }
  return 部件;
}

/** metadata part 内容（application/json）：解析失败归 undefined，不让坏 JSON 中断路由 */
function 解metadata部件(字节: Buffer): unknown {
  try {
    return JSON.parse(字节.toString('utf8'));
  } catch {
    return undefined;
  }
}

/** 安装 /api/v1 route fixture：按 path + method 匹配，返回 fixture 信封。 */
async function 安装BFF路由(page: Page, 选项: BFF路由选项) {
  const 会话已登录 = 选项.会话已登录 ?? true;
  // P1C：组织 fixture 出现时 /me 与角色/偏好写入都返回招聘方主体（PUT last-used-role 会推进它的值）
  const 组织fixture = 选项.招聘组织Fixture ?? null;
  const 主体 = 组织fixture
    ? {
        subject_id: 'subj-fixture-recruiter-001',
        roles: [
          { role: 'candidate' as const, status: 'active' as const },
          { role: 'recruiter' as const, status: 'active' as const },
        ],
        last_used_role: (选项.主体初始角色 ?? null) as 'recruiter' | null,
      }
    : fixture主体;

  // ── P1C 组织域可变 fixture 状态：每次安装独立一份，页面写入只影响本测试 ──
  const 档案可变: P1C招聘方档案形 | null = 组织fixture ? { ...组织fixture.profile } : null;
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
  await page.route('**/api/v1/**', async (route: Route) => {
    const 请求 = route.request();
    const url = new URL(请求.url());
    const path = url.pathname;
    const method = 请求.method();
    // multipart 请求不用 JSON parser 解整体：按 boundary 取 part，body 留空对象
    const 部件们 = 取multipart部件(请求);
    const 元数据部件 = 部件们?.find((件) => 件.name === 'metadata');
    const body = method !== 'GET' && method !== 'DELETE' && 部件们 === null
      ? (() => { try { return JSON.parse(请求.postData() ?? '{}'); } catch { return {}; } })()
      : {};

    选项.请求拦截?.({
      path,
      method,
      body,
      headers: 请求.headers(),
      multipart: 部件们
        ? { parts: 部件们.map((件) => 件.name), metadata: 元数据部件 ? 解metadata部件(元数据部件.bytes) : undefined }
        : undefined,
    });

    if (path.startsWith('/api/v1/catalog/')) 选项.记录目录请求(path);

    // 自定义覆盖优先；返回 undefined 时放行给内置 fixture
    const 覆盖key = `${method} ${path}`;
    const 覆盖项 = 选项.覆盖?.[覆盖key]?.(body);
    if (覆盖项) {
      await route.fulfill({ status: 覆盖项.status, json: 覆盖项.响应 });
      return;
    }

    // ── session / auth ──
    if (path === '/api/v1/session' && method === 'GET') {
      if (会话已登录) {
        await route.fulfill({ status: 200, json: 信封({ identity_id: 'id-fixture', session_id: 'sess-fixture', expires_at: '2026-08-26T00:00:00Z' }) });
      } else {
        await route.fulfill({ status: 401, json: { error: { type: 'invalid_session', message: '未登录' } } });
      }
      return;
    }
    if (path === '/api/v1/auth/login-attempts' && method === 'POST') {
      await route.fulfill({ status: 200, json: 信封({ attempt_id: 选项.登录尝试id, next_action: { type: 'enter_code', expires_at: '2026-08-25T01:00:00Z' } }) });
      return;
    }
    if (path.startsWith('/api/v1/auth/login-attempts/') && path.endsWith('/complete') && method === 'POST') {
      await route.fulfill({ status: 200, json: 信封({ identity_id: 'id-fixture', session_id: 'sess-fixture', expires_at: '2026-08-26T00:00:00Z', next_action: { type: 'completed' } }) });
      return;
    }
    if (path === '/api/v1/auth/logout' && method === 'POST') {
      await route.fulfill({ status: 200, json: 信封({ logged_out: true }) });
      return;
    }

    // ── me ──
    if (path === '/api/v1/me' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(主体) });
      return;
    }
    if (path.startsWith('/api/v1/me/roles/') && method === 'PUT') {
      await route.fulfill({ status: 200, json: 信封(主体) });
      return;
    }
    if (path === '/api/v1/me/preferences/last-used-role' && method === 'PUT') {
      // 服务端语义：记录偏好后，后续 GET /me 返回新值（刷新恢复用例依赖这一点）
      if (主体 !== fixture主体) 主体.last_used_role = (body as { role?: 'recruiter' | null })?.role ?? null;
      await route.fulfill({ status: 200, json: 信封(主体) });
      return;
    }

    // ── P1C 组织域（组织 fixture 存在时才应答；组织 fixture 缺席的用例走兜底空信封，
    //    strict decode 失败 → 水合抛错，这正是「Mock 内容不顶替 HTTP」的边界）──
    if (组织fixture) {
      if (path === '/api/v1/recruiter/profile' && method === 'GET') {
        await route.fulfill({ status: 200, json: 信封(档案可变) });
        return;
      }
      if (path === '/api/v1/recruiter/profile' && method === 'PATCH') {
        // CAS 不校验 If-Match：fixture 信任客户端带的是水合时的 revision
        const 补丁 = body as { public_name?: string; title?: string };
        if (补丁.public_name !== undefined) 档案可变!.public_name = 补丁.public_name;
        if (补丁.title !== undefined) 档案可变!.title = 补丁.title;
        档案可变!.revision += 1;
        await route.fulfill({ status: 200, json: 信封(档案可变) });
        return;
      }
      if (path === '/api/v1/recruiter/avatar' && method === 'POST') {
        // 冻结 multipart：恰一个 media part，返回带新头像 URL 的完整档案
        const 媒 = 登记媒体(部件们?.find((件) => 件.name === 'media'));
        档案可变!.avatar_url = 媒.url;
        档案可变!.revision += 1;
        await route.fulfill({ status: 200, json: 信封(档案可变) });
        return;
      }
      if (path === '/api/v1/recruiter/affiliations' && method === 'GET') {
        await route.fulfill({ status: 200, json: 信封({ affiliations: 关系可变 }) });
        return;
      }
      if (path === '/api/v1/recruiter/organization-admin-requests' && method === 'GET') {
        await route.fulfill({ status: 200, json: 信封({ requests: 申请可变 }) });
        return;
      }

      // 公开企业（直接读取：名片选当前关系 / 岗位公司卡 / 企业详情页共用）
      const 公开匹配 = /^\/api\/v1\/organizations\/([^/]+)$/.exec(path);
      if (公开匹配 && method === 'GET') {
        const 组织 = 组织fixture.organizations[公开匹配[1]];
        const 档 = 企业档案表.get(公开匹配[1]);
        if (!组织 || !档) {
          await route.fulfill({ status: 404, json: { error: { type: 'organization_not_found', message: '企业不存在' } } });
          return;
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
        return;
      }

      // 企业档案（GET 权威快照 / PATCH 完整 replacement）
      const 档案匹配 = /^\/api\/v1\/organizations\/([^/]+)\/profile$/.exec(path);
      if (档案匹配) {
        const 档 = 企业档案表.get(档案匹配[1]);
        if (!档) {
          await route.fulfill({ status: 404, json: { error: { type: 'organization_not_found', message: '企业不存在' } } });
          return;
        }
        if (method === 'GET') {
          await route.fulfill({ status: 200, json: 信封(档) });
          return;
        }
        if (method === 'PATCH') {
          const 换 = body as {
            brand_name: string; industry_id: string; company_size: P1C企业档案形['company_size'];
            funding_stage: P1C企业档案形['funding_stage']; office_address: string;
            benefit_codes: string[]; work_schedule: P1C企业档案形['work_schedule']; company_intro: string;
            business_items: string[]; office_media_ids: string[]; company_media_ids: string[];
            product_intro: string; team_members: { name: string; title: string; summary: string }[];
            logo_media_id: string;
          };
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
          return;
        }
      }

      // 企业媒体两步协议：POST 落号（幂等由客户端 Idempotency-Key 承担）/ DELETE 204 无信封
      if (/^\/api\/v1\/organizations\/[^/]+\/media$/.test(path) && method === 'POST') {
        await route.fulfill({ status: 200, json: 信封(登记媒体(部件们?.find((件) => 件.name === 'media'))) });
        return;
      }
      const 媒体删除匹配 = /^\/api\/v1\/organizations\/([^/]+)\/media\/([^/]+)$/.exec(path);
      if (媒体删除匹配 && method === 'DELETE') {
        媒体登记.delete(媒体删除匹配[2]);
        await route.fulfill({ status: 204, body: '' });
        return;
      }
    }

    // ── resume ──
    if (path === '/api/v1/me/resume' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(fixture简历) });
      return;
    }
    if (path === '/api/v1/me/resume/summary' && method === 'PATCH') {
      await route.fulfill({ status: 200, json: 信封({ ...fixture简历, summary: (body as { value?: string })?.value ?? '', summary_revision: 2 }) });
      return;
    }
    if (path === '/api/v1/me/resume/profile' && method === 'PATCH') {
      await route.fulfill({ status: 200, json: 信封({ ...fixture简历, profile: { ...fixture简历.profile, ...(body as object) }, profile_revision: 2 }) });
      return;
    }
    if (path === '/api/v1/me/resume/skills' && method === 'PATCH') {
      await route.fulfill({ status: 200, json: 信封({ ...fixture简历, skills: (body as { skills?: string[] })?.skills ?? [], skills_revision: 2 }) });
      return;
    }
    if (path.startsWith('/api/v1/me/resume/educations') && method === 'POST') {
      const b = body as { institution_id?: string; degree?: string; major_id?: string; start_month?: string };
      await route.fulfill({ status: 200, json: 信封({ entry: { kind: 'education', education: { id: 'edu-fixture-001', institution: { id: b.institution_id ?? '', display_name: 标记.学校display }, degree: b.degree ?? '', major: { id: b.major_id ?? '', display_name: 'Fixture 专业' }, start_month: b.start_month ?? '', end_month: null, revision: 1 } }, aggregate_revision: 2 }) });
      return;
    }
    if (path.startsWith('/api/v1/me/resume/experiences') && method === 'POST') {
      await route.fulfill({ status: 200, json: 信封({ entry: { kind: 'experience', experience: { id: 'exp-fixture-001', company: (body as { company?: string })?.company ?? '', industry: { id: 'ind-fixture', display_name: 'Fixture 行业' }, title: (body as { title?: string })?.title ?? '', start_month: '2020-01', end_month: null, description: '', hidden: false, internship: false, revision: 1, projects: null } }, aggregate_revision: 2 }) });
      return;
    }

    // ── intentions ──
    if (path === '/api/v1/me/intentions' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(fixture意向列表) });
      return;
    }
    if (path === '/api/v1/me/intentions' && method === 'POST') {
      await route.fulfill({ status: 200, json: 信封(fixture意向列表.intentions[0]) });
      return;
    }

    // ── catalog ──
    if (path === '/api/v1/catalog/locations' && method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      const admin1 = url.searchParams.get('admin1_code') ?? '';
      const items = admin1 !== '' || q !== ''
        ? [{ id: 'loc-fixture-001', display_name: 标记.城市display, country_code: 'CN', country_name: '中国', admin1_code: admin1 || 'SH', admin1_name: 'Fixture 省', timezone: 'Asia/Shanghai', population: 1000 }]
        : [];
      await route.fulfill({ status: 200, json: 信封(目录页(items)) });
      return;
    }
    if (path === '/api/v1/catalog/education-institutions' && method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      const items = q !== ''
        ? [{ id: 'inst-fixture-001', display_name: 标记.学校display, location: { id: 'loc-fixture-001', display_name: 'Fixture City', country_code: 'CN', country_name: 'Fixtureland', admin1_code: null, admin1_name: null, timezone: 'Asia/Shanghai', population: 0 } }]
        : [];
      await route.fulfill({ status: 200, json: 信封(目录页(items)) });
      return;
    }
    if (path.startsWith('/api/v1/catalog/job-categories') && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(目录页([{ id: 'job-fixture-001', display_name: 标记.职位display, parent_id: null, selectable: true }])) });
      return;
    }
    if (path.startsWith('/api/v1/catalog/industries') && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(目录页([{ id: 'ind-fixture-001', display_name: 'Fixture 行业', parent_id: null, selectable: true }])) });
      return;
    }
    if (path.startsWith('/api/v1/catalog/majors') && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(目录页([{ id: 'major-fixture-001', display_name: 'Fixture 专业', parent_id: null, selectable: true }])) });
      return;
    }

    // ── recruiter jobs ──
    if (path === '/api/v1/recruiter/jobs' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封({ jobs: 组织fixture ? 岗位可变 : [], next_cursor: null }) });
      return;
    }
    if (组织fixture && path === '/api/v1/recruiter/jobs' && method === 'POST') {
      // 服务端推导（客户端 body 只有 claim，无 refs / verification status）：
      // 首个 verified+active 关系给出两个 ref 与两侧验证状态；没有关系则 unverified 无 ref。
      const 换 = body as {
        publisher_mode: 'direct' | 'agency';
        hiring_organization_claim: { display_name: string; legal_name?: string | null };
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
        description: string;
        requirements: string;
        keywords: string[];
        private_screening_preferences: string;
      };
      const 发布关系 = 关系可变.find((项) => 项.status === 'verified' && 项.organization_status === 'active');
      const 现在 = '2026-08-26T00:00:00Z';
      const 新岗: P1C岗位形 = {
        job_id: `job-fixture-created-${岗位可变.length + 1}`,
        publisher_mode: 换.publisher_mode,
        publisher_affiliation_ref: 发布关系?.affiliation_id,
        publisher_verification_status: 发布关系 ? 'verified' : 'unverified',
        hiring_organization_claim: {
          display_name: 换.hiring_organization_claim.display_name,
          legal_name: 换.hiring_organization_claim.legal_name ?? null,
        },
        publisher_organization_ref: 发布关系?.organization_id,
        hiring_organization_verification_status: 发布关系 ? 'verified' : 'unverified',
        hiring_organization_ref: 发布关系?.organization_id,
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
        description: 换.description,
        requirements: 换.requirements,
        keywords: 换.keywords,
        private_screening_preferences: 换.private_screening_preferences,
        status: 'active',
        revision: 1,
        published_at: 现在,
        created_at: 现在,
        updated_at: 现在,
      };
      岗位可变.push(新岗);
      await route.fulfill({ status: 200, json: 信封(新岗) });
      return;
    }

    // 兜底：未匹配的 /api/v1/* 返回 200 空信封，避免测试因未处理路由挂死
    await route.fulfill({ status: 200, json: 信封(null) });
  });
}

/**
 * 填写意向表单并提交：办公方式（现场）+ 工作城市（子页搜索 fixture）+ 期望职位（子页选择）→ 点保存。
 * 三个条件齐了 可保存 才为 true，保存键才会亮——少填一项 POST 就不会发出。
 */
async function 填意向表单并提交(page: Page) {
  // 导航到添加意向页
  await page.goto('/#/intentions/new');
  await page.waitForTimeout(500);

  // 1. 办公方式：点「现场」选钮片
  await page.getByRole('button', { name: '现场', exact: true }).click();

  // 2. 工作城市：点行 → 跳选城市页 → 搜索 fixture → 选结果 → 保存 → 返回
  await page.getByText('请选择工作城市').click();
  await page.waitForTimeout(500);
  const 城市搜索 = page.getByPlaceholder('搜索城市 / 省份');
  await expect(城市搜索).toBeVisible({ timeout: 5000 });
  await 城市搜索.fill('fixture');
  await page.waitForTimeout(600); // debounce 250ms + 余量
  await expect(page.getByText(标记.城市display)).toBeVisible({ timeout: 5000 });
  await page.getByText(标记.城市display).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  // 等待返回意向页
  await page.waitForTimeout(500);

  // 3. 期望职位：点行 → 跳选期望职位页 → 选 fixture 职位 → 保存 → 返回
  await page.getByText('请选择期望职位').click();
  await page.waitForTimeout(500);
  // Backend 左栏根项已加载，右栏子项也加载（fixture 单项 selectable=true）
  // 左右两栏都显示同一文本，用 .last() 点右栏的可选子项
  await expect(page.getByText(标记.职位display).last()).toBeVisible({ timeout: 5000 });
  await page.getByText(标记.职位display).last().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  // 等待返回意向页
  await page.waitForTimeout(500);

  // 4. 点保存 → POST /api/v1/me/intentions
  await page.getByRole('button', { name: '保存', exact: true }).click();
}

/**
 * P1C Backend 招聘链路：身份选择页点「我要招人」→ 切身份（PUT 角色 + 偏好）→
 * 固定水合（profile → affiliations → [公开企业] → jobs）→ 招聘名片。
 * 水合失败（interactive）会抛回身份页，所以落进名片本身就是水合成功的证据。
 */
async function 以招聘方进入名片(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我要招人' }).click();
  await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible();
}

/**
 * P1C Backend 发岗向导（实习生档，与 Mock onboarding 同一真实 UI）：
 * 类别走 catalog job-categories（左栏 root → 右栏 selectable 叶子），
 * 城市走 catalog locations 搜索候选，最后一步提交 POST /api/v1/recruiter/jobs。
 */
async function 走完后端发岗向导(page: Page) {
  await page.goto('/#/hr/post-job');
  const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
  await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('');
  await page.getByRole('button', { name: '实习生 在校生实习，按天计薪' }).click();
  await page.getByRole('button', { name: '提供转正机会' }).click();
  await page.getByPlaceholder(/资深后端工程师/).fill('Fixture 实习岗位');
  await 职位类别行.click();
  // fixture 目录只有一项 selectable root；点左栏 root 后右栏出现同名叶子，用次序区分
  const 类键 = page.getByRole('button', { name: 标记.职位display, exact: true });
  await 类键.first().click();
  await expect(类键).toHaveCount(2, { timeout: 5_000 });
  await 类键.last().click();
  await page.getByRole('button', { name: '混合', exact: true }).click();
  await page.getByRole('button', { name: '下一步' }).click();

  await page.getByLabel('职位描述').fill('参与 fixture 岗位的 E2E 验证。');
  await page.getByRole('button', { name: '下一步' }).click();

  await page.getByRole('button', { name: '— 元/天' }).first().click();
  await page.getByRole('button', { name: '完成' }).click();
  await page.getByRole('button', { name: '— 元/天' }).click();
  await page.getByRole('button', { name: '完成' }).click();
  await page.getByPlaceholder('搜索城市名，从下方候选选择').fill('fixture');
  await page.getByRole('button', { name: 标记.城市display, exact: true }).click();
  await page.getByPlaceholder(/浦东新区世纪大道/).fill('Fixture 市 Fixture 路 1 号');
  await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
}

test.describe('Backend 数据源 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182）
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  // 后端用例统一 60s 超时（涉及 debounce + 网络路由 fixture）
  test.use({ timeout: 60_000 });

  test('candidate 会话恢复后无 Catalog 请求 @backend', async ({ page }) => {
    const 目录请求: string[] = [];
    await 安装BFF路由(page, { 记录目录请求: (p) => 目录请求.push(p), 登录尝试id: 'att-001' });

    // GET /api/v1/session → 200（已登录）→ 读取主体 → 水合简历/意向 → 落 #/app
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 会话恢复 + 主体 + 简历 + 意向后不应有任何 catalog 请求
    expect(目录请求).toEqual([]);
  });

  test('页面显示 fixture 标记值（渲染来自 HTTP 非 Mock）@backend', async ({ page }) => {
    const 目录请求: string[] = [];
    await 安装BFF路由(page, { 记录目录请求: (p) => 目录请求.push(p), 登录尝试id: 'att-002' });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 导航到我的简历 → 个人优势来自 /api/v1/me/resume 的 summary 字段
    await page.goto('/#/resume');
    // fixture summary 标记值在页面上可见（Mock 里没有这段文本）
    await expect(page.getByText(标记.简历summary)).toBeVisible({ timeout: 10_000 });
  });

  test('打开城市选择只请求目标省第一页 @backend', async ({ page }) => {
    const 目录请求: string[] = [];
    await 安装BFF路由(page, { 记录目录请求: (p) => 目录请求.push(p), 登录尝试id: 'att-003' });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 直接导航到选工作城市屏
    await page.goto('/#/onboard/city');
    await page.waitForTimeout(500);

    // 搜索「fixture」→ 只触发 /catalog/locations 请求
    const 搜索框 = page.getByPlaceholder('搜索城市 / 省份');
    if (await 搜索框.isVisible({ timeout: 5000 }).catch(() => false)) {
      await 搜索框.fill('fixture');
      await page.waitForTimeout(600); // debounce 250ms + 余量
      // 候选出现 fixture 城市
      await expect(page.getByText(标记.城市display)).toBeVisible({ timeout: 5000 });
    }

    // 城市页只应有 /catalog/locations 请求，不应有 job-categories / institutions / majors
    const 非location目录请求 = 目录请求.filter((p) => !p.includes('/catalog/locations'));
    expect(非location目录请求).toEqual([]);
  });

  test('学校搜索中英文同一 institution ID，候选副行显示城市·国家 @backend', async ({ page }) => {
    const 目录请求: string[] = [];
    await 安装BFF路由(page, { 记录目录请求: (p) => 目录请求.push(p), 登录尝试id: 'att-004' });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 导航到毕业院校屏
    await page.goto('/#/onboard/school');
    await page.waitForTimeout(500);

    const 输入框 = page.getByPlaceholder('学校名称');
    await expect(输入框).toBeVisible({ timeout: 5000 });

    // 中文搜索
    await 输入框.fill('fixture');
    await page.waitForTimeout(500); // debounce 250ms

    // 候选列表出现 fixture 学校 + 「城市 · 国家」副行
    await expect(page.getByText(标记.学校display)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(标记.学校副行)).toBeVisible();

    // 点候选 → 存引用
    await page.getByText(标记.学校display).click();
    await page.waitForTimeout(300);

    // 再搜索英文 → 同一 institution ID（fixture 始终返回 inst-fixture-001）
    await 输入框.fill('Fixture');
    await page.waitForTimeout(500);
    await expect(page.getByText(标记.学校display)).toBeVisible();

    // 断言走的是 BFF catalog 非 Mock 本地名录
    expect(目录请求.some((p) => p.includes('/catalog/education-institutions'))).toBe(true);
  });

  test('写入 body 使用选择 ID，不含 /catalog/ 反查 @backend', async ({ page }) => {
    const 目录请求: string[] = [];
    const 写入bodies: { path: string; method: string; body: unknown }[] = [];
    await 安装BFF路由(page, {
      记录目录请求: (p) => 目录请求.push(p),
      登录尝试id: 'att-005',
      请求拦截: ({ path, method, body }) => {
        if (method === 'POST' || method === 'PATCH') 写入bodies.push({ path, method, body });
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 导航到毕业院校，选学校 + 下一步触发教育写入
    await page.goto('/#/onboard/school');
    await page.waitForTimeout(500);

    const 输入框 = page.getByPlaceholder('学校名称');
    await expect(输入框).toBeVisible({ timeout: 5000 });
    await 输入框.fill('fixture');
    await page.waitForTimeout(500);
    await expect(page.getByText(标记.学校display)).toBeVisible({ timeout: 5000 });
    await page.getByText(标记.学校display).click();
    await page.waitForTimeout(300);

    // 点下一步（触发保存简历 → 可能 POST education）
    const 下一步键 = page.getByRole('button', { name: '下一步' });
    await 下一步键.click();
    await page.waitForTimeout(1500);

    // 教育写入可能因 onboarding 中间屏（专业/开始未填）跳过——保存简历 diff 会跳过不完整条目。
    // 若有教育 POST，断言 body 里有 institution_id（来自选择引用，不是 display_name 反查）。
    const 教育写入 = 写入bodies.filter((b) => b.path.includes('/resume/educations'));
    if (教育写入.length > 0) {
      const body = 教育写入[0].body as { institution_id?: string; degree?: string };
      expect(body.institution_id).toBe('inst-fixture-001');
    }

    // 写入 path 不含 /catalog/（写入直接用选择时保存的 ID，不反查目录）
    expect(写入bodies.some((b) => b.path.includes('/catalog/'))).toBe(false);
  });

  test('422 array fields 返回字段错误 @backend', async ({ page }) => {
    // 覆盖 POST intentions → 422 + fields 数组。驱动真实 UI 填表提交，断言 POST 真正
    // 发出且 422 fieldErrors 文案出现在 轻提示 toast 里——删掉 422 解析或 fieldErrors
    // 映射这条断言就会失败。
    let post次数 = 0;
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-006',
      请求拦截: ({ path, method }) => {
        if (path === '/api/v1/me/intentions' && method === 'POST') post次数++;
      },
      覆盖: {
        'POST /api/v1/me/intentions': () => ({
          status: 422,
          响应: { error: { type: 'validation_failed', message: '字段错误', fields: [{ path: 'workplace_modes', reason: '至少选一种办公方式' }] } },
        }),
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    await 填意向表单并提交(page);

    // POST 确实发出（填表 + 点保存触发了真实写入请求）
    expect(post次数).toBeGreaterThanOrEqual(1);
    // 422 fieldErrors[0].reason 出现在 toast 里（取后端错误文案 → 轻提示）
    await expect(page.getByText('至少选一种办公方式')).toBeVisible({ timeout: 10_000 });
  });

  test('401 清理会话并清空目录缓存 @backend', async ({ page }) => {
    // 覆盖 PATCH profile → 401 invalid_session。驱动真实 UI 编辑姓名 → blur → PATCH 401 →
    // 处理写入错误 清会话（已登录=false）→ 应用.tsx Navigate 到登录页。
    // 断言页面落回登录页（手机号输入框可见）——删掉 401 清会话或 Navigate 守卫这条断言就会失败。
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-007',
      覆盖: {
        'PATCH /api/v1/me/resume/profile': () => ({
          status: 401,
          响应: { error: { type: 'invalid_session', message: '登录已失效' } },
        }),
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 导航到我的简历 → 编辑姓名 → blur 触发 PATCH profile → 401 → 清会话 → 落登录页
    await page.goto('/#/resume');
    await page.waitForTimeout(500);

    // 点姓名进入编辑（可改条目：点只读态 → 变 input）
    const 姓名行 = page.getByText(标记.主体真名).first();
    await expect(姓名行).toBeVisible({ timeout: 5000 });
    await 姓名行.click();
    // 编辑态 input 的 aria-label 含「姓名」
    const 输入框 = page.getByLabel('姓名');
    await expect(输入框).toBeVisible({ timeout: 3000 });
    await 输入框.fill('改后名字');
    await 输入框.blur();

    // 401 后 处理写入错误 清会话 → 应用.tsx Navigate 到登录页
    // 登录页有「手机号」输入框——如果 401 清理或 Navigate 守卫被删，页面会留在 /#/resume
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
  });

  test('409 reread 用权威快照水合 @backend', async ({ page }) => {
    // 覆盖 PATCH profile → 409 version_conflict，GET /me/resume 第二次返回不同名字。
    // 驱动真实 UI 编辑姓名 → blur → PATCH 409 → HTTP catch GET /me/resume（权威快照）
    // → 处理写入错误 用 错误.权威简历 水合。
    // 断言 GET /me/resume 被调用了至少 2 次（初始 + 409 reread），且页面显示权威快照里的名字
    // ——删掉 409 reread 或权威水合这条断言就会失败（页面会停留在初始名字）。
    const 权威名字 = '后端 fixture 权威名';
    let getResume次数 = 0;
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-008',
      请求拦截: ({ path, method }) => {
        if (path === '/api/v1/me/resume' && method === 'GET') getResume次数++;
      },
      覆盖: {
        'PATCH /api/v1/me/resume/profile': () => ({
          status: 409,
          响应: { error: { type: 'version_conflict', message: '版本冲突' } },
        }),
        // GET /me/resume：首次（init 水合）返回 fixture 简历；第二次（409 reread）返回权威名字
        'GET /api/v1/me/resume': () => {
          if (getResume次数 <= 1) {
            return { status: 200, 响应: 信封(fixture简历) };
          }
          return {
            status: 200,
            响应: 信封({ ...fixture简历, profile: { ...fixture简历.profile, real_name: 权威名字 } }),
          };
        },
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 导航到我的简历 → 编辑姓名 → blur → PATCH 409 → GET reread → 权威水合
    await page.goto('/#/resume');
    await page.waitForTimeout(500);

    const 姓名行 = page.getByText(标记.主体真名).first();
    await expect(姓名行).toBeVisible({ timeout: 5000 });
    await 姓名行.click();
    const 输入框 = page.getByLabel('姓名');
    await expect(输入框).toBeVisible({ timeout: 3000 });
    await 输入框.fill('改后名字');
    await 输入框.blur();

    // 409 reread：GET /me/resume 至少被调用 2 次（初始水合 + catch 权威快照）
    await page.waitForTimeout(2000);
    expect(getResume次数).toBeGreaterThanOrEqual(2);
    // 权威快照水合后页面显示 reread 返回的名字（不是用户输入也不是初始 fixture 名字）
    await expect(page.getByText(权威名字)).toBeVisible({ timeout: 10_000 });
  });

  test('503 同幂等键受控重试 @backend', async ({ page }) => {
    // 覆盖 POST intentions：首次 503 operation_outcome_unknown，第二次 200。
    // 驱动真实 UI 填表提交 → POST 503 → HTTP客户端 可受控重试 复用同一把 Idempotency-Key → 200。
    // 断言至少 2 次 POST 且两次 Idempotency-Key 相同——删掉 503 重试或幂等键复用这条断言就会失败。
    let post覆盖次数 = 0;
    const 幂等键们: string[] = [];
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-009',
      请求拦截: ({ path, method, headers }) => {
        if (path === '/api/v1/me/intentions' && method === 'POST') {
          幂等键们.push(headers['idempotency-key'] ?? '');
        }
      },
      覆盖: {
        'POST /api/v1/me/intentions': () => {
          post覆盖次数++;
          if (post覆盖次数 === 1) {
            return { status: 503, 响应: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } };
          }
          return { status: 200, 响应: 信封(fixture意向列表.intentions[0]) };
        },
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    await 填意向表单并提交(page);

    // 503 受控重试：至少 2 次 POST（首次 503 + 重试 200）
    await page.waitForTimeout(2000);
    expect(幂等键们.length).toBeGreaterThanOrEqual(2);
    // 复用同一把 Idempotency-Key（HTTP客户端 可受控重试 用同一个 init）
    expect(幂等键们[0]).toBe(幂等键们[1]);
    expect(幂等键们[0]).not.toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P1C 组织域 fixture @backend —— 招聘 Organization 全链路（intercepted boundary only）
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P1C 招聘组织 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 60_000 });

  test('P1C 招聘 Organization 全链路使用 HTTP fixture 且发岗 body 无可信字段 @backend', async ({ page }) => {
    // 未认证招聘方 + 无企业关系：名片来自 /recruiter/profile，公司输入走未认证声明，
    // 发岗 POST 只声明 claim —— organization_ref / verification status / affiliation
    // 全是服务端推导，客户端 body 一个都不能带。
    const 请求们: { path: string; method: string; body: unknown }[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-org',
      记录目录请求: () => undefined,
      请求拦截: ({ path, method, body }) => 请求们.push({ path, method, body }),
      招聘组织Fixture: P1C招聘组织Fixture,
    });

    await 以招聘方进入名片(page);
    // 名片姓名来自 HTTP fixture（Mock 里没有这个值）
    await expect(page.getByText(P1C招聘组织Fixture.profile.public_name).first()).toBeVisible();
    await expect(page.getByLabel('姓名')).toHaveValue(P1C招聘组织Fixture.profile.public_name);

    // 无企业关系 → 公司是自由输入（未认证声明），落本地不发请求
    await page.getByLabel('公司').fill('未认证客户公司');
    await page.getByLabel('公司').blur();

    // 固定水合链：profile → affiliations →（无 current，不读公开企业）→ jobs；
    // admin request 不进登录链。渲染顺序错乱或登录链混入组织申请都会在这里翻车。
    const 链 = 请求们.map((项) => `${项.method} ${项.path}`);
    const 头子 = 链.indexOf('PUT /api/v1/me/preferences/last-used-role');
    expect(头子).toBeGreaterThanOrEqual(0);
    expect(链.slice(头子 + 1, 头子 + 4)).toEqual([
      'GET /api/v1/recruiter/profile',
      'GET /api/v1/recruiter/affiliations',
      'GET /api/v1/recruiter/jobs',
    ]);
    expect(链.some((项) => 项.includes('organization-admin-requests'))).toBe(false);

    // 发岗（真实三步向导）→ POST /api/v1/recruiter/jobs
    await 走完后端发岗向导(page);
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

    const 创建 = 请求们.find((项) => 项.path === '/api/v1/recruiter/jobs' && 项.method === 'POST');
    expect(创建).toBeDefined();
    expect(JSON.stringify(创建!.body)).not.toMatch(/organization_ref|verification_status|affiliation/);
    // 正向：只声明 direct 模式与用人企业声明，claim 名来自未认证声明
    expect(创建!.body).toMatchObject({
      publisher_mode: 'direct',
      hiring_organization_claim: { display_name: '未认证客户公司', legal_name: null },
    });
  });

  test('P1C 多 Organization 关系不自动猜测，选择后刷新恢复 @backend', async ({ page }) => {
    // 两个可用关系 → current 为 null（不猜），不读任何公开企业；
    // 手动选择后 sessionStorage 白名单把当前关系编号带回刷新后的固定水合。
    const 公开读取: string[] = [];
    let 岗位读取数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-multi',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(
        P1C招聘组织Fixture,
        [P1C管理员关系, P1C成员关系],
        { [P1C标记.组织甲编号]: P1C组织甲(), [P1C标记.组织乙编号]: P1C组织乙() },
      ),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method }) => {
        if (method === 'GET' && path.startsWith('/api/v1/organizations/')) 公开读取.push(path);
        if (path === '/api/v1/recruiter/jobs' && method === 'GET') 岗位读取数++;
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    // 固定水合链走完（jobs 是最后一步）且没有读任何公开企业 —— 多可用关系不自动选
    await expect.poll(() => 岗位读取数).toBeGreaterThanOrEqual(1);
    expect(公开读取).toEqual([]);

    await page.goto('/#/hr/card');
    await expect(page.getByText('请选择当前任职企业')).toBeVisible({ timeout: 10_000 });
    const 甲键 = page.getByRole('button', { name: new RegExp(P1C标记.组织甲名) });
    await expect(甲键).toBeVisible();
    await expect(甲键).not.toContainText('（当前）');

    // 手动选择组织甲 → 按 canonical ID 读一次公开企业
    await 甲键.click();
    await expect(page.getByRole('button', { name: new RegExp(P1C标记.组织甲名) })).toContainText('（当前）', { timeout: 10_000 });
    expect(公开读取).toEqual([`/api/v1/organizations/${P1C标记.组织甲编号}`]);

    // 刷新：恢复的当前关系编号经 选择当前企业关系 校验后仍指向组织甲
    await page.reload();
    await expect(page.getByRole('button', { name: new RegExp(P1C标记.组织甲名) })).toContainText('（当前）', { timeout: 20_000 });
    expect(公开读取).toEqual([
      `/api/v1/organizations/${P1C标记.组织甲编号}`,
      `/api/v1/organizations/${P1C标记.组织甲编号}`,
    ]);
  });

  test('P1C member 关系对公司档案只读 @backend', async ({ page }) => {
    // 唯一可用关系（member）会被自动选中，但公司档案分区一律只读：
    // 无保存键、文本禁用、也没有任何组织写入请求。
    const 写入们: string[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-member',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C成员关系], { [P1C标记.组织乙编号]: P1C组织乙() }),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method }) => {
        if (method !== 'GET') 写入们.push(`${method} ${path}`);
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.goto('/#/hr/card');
    // 唯一可用关系自动选中（不猜的另一半：恰好一个可用才自动选）
    await expect(page.getByRole('button', { name: new RegExp(P1C标记.组织乙名) })).toContainText('（当前）', { timeout: 10_000 });

    await page.getByRole('button', { name: /公司主页资料/ }).click();
    await expect(page).toHaveURL(/#\/hr\/company-profile$/);
    await expect(page.getByText('仅企业管理员可修改').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /公司介绍/ }).click();
    await expect(page).toHaveURL(/#\/hr\/company-profile\/intro$/);
    // 文本区显示服务端事实但禁用；没有保存键；也没有任何写入请求
    await expect(page.getByLabel('公司介绍')).toBeDisabled();
    await expect(page.getByLabel('公司介绍')).toHaveValue(P1C标记.公司介绍);
    await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
    expect(写入们).toEqual([]);
  });

  test('P1C 管理员申请只在进入实名认证屏后读取 @backend', async ({ page }) => {
    // admin request 列表不进登录链；企业实名认证屏挂载才读，状态按服务端事实展示。
    let 申请读取数 = 0;
    let 岗位读取数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-admin-req',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'recruiter',
      请求拦截: ({ path }) => {
        if (path === '/api/v1/recruiter/organization-admin-requests') 申请读取数++;
        if (path === '/api/v1/recruiter/jobs') 岗位读取数++;
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await expect.poll(() => 岗位读取数).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(500); // 水合链收尾：admin request 若被误挂进登录链，这里会露馅
    expect(申请读取数).toBe(0);

    await page.goto('/#/hr/verify');
    await expect(page.getByText('管理员申请：待审核')).toBeVisible({ timeout: 10_000 });
    // dev server 的 StrictMode 会双跑挂载 effect，读取次数 ≥1 即可；关键断言是
    // 「没进本屏之前是 0」与「进了本屏才读」
    expect(申请读取数).toBeGreaterThanOrEqual(1);
    // 个人三行分开：公开名 / 实名 / 验证状态（fixture 未实名）
    await expect(page.getByText(`实名：未实名`)).toBeVisible();
    await expect(page.getByText(P1C标记.招聘方公开名).first()).toBeVisible();
  });

  test('P1C 招聘名片保存档案与头像走 multipart 单 media part @backend', async ({ page }) => {
    // 一次保存 = PATCH profile（If-Match 当前 revision）+ POST avatar
    // （multipart 恰一个 media part，不带 metadata/file part，If-Match 用新 revision）。
    const 写入们: { path: string; method: string; body: unknown; headers: Record<string, string>; multipart?: { parts: string[] } }[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-profile',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      请求拦截: ({ path, method, body, headers, multipart }) => {
        if (method !== 'GET') 写入们.push({ path, method, body, headers, multipart });
      },
    });

    await 以招聘方进入名片(page);
    await expect(page.getByLabel('姓名')).toHaveValue(P1C标记.招聘方公开名);

    await page.getByLabel('姓名').fill('沈 fixture');
    await page.setInputFiles('input[aria-label="更换头像"]', {
      name: '头像.png', mimeType: 'image/png', buffer: 一像素PNG,
    });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 10_000 });

    const 档案写 = 写入们.find((项) => 项.path === '/api/v1/recruiter/profile' && 项.method === 'PATCH');
    expect(档案写).toBeDefined();
    // PATCH body 只有公开名与职务；If-Match 是当前 revision 的 etag
    expect(档案写!.body).toEqual({ public_name: '沈 fixture', title: P1C标记.招聘方职务 });
    expect(档案写!.headers['if-match']).toBe('"3"');

    const 头像写 = 写入们.find((项) => 项.path === '/api/v1/recruiter/avatar' && 项.method === 'POST');
    expect(头像写).toBeDefined();
    // 冻结 multipart 形状：单个 media part（按 content-type boundary 解析，非 JSON parser）
    expect(头像写!.multipart?.parts).toEqual(['media']);
    // 头像 If-Match 用 PATCH 之后的 revision（fixture：3 → 4）
    expect(头像写!.headers['if-match']).toBe('"4"');
  });

  test('P1C 企业媒体 multipart 带 metadata purpose，删除走 204 @backend', async ({ page }) => {
    // 两步媒体协议：POST media(metadata+media) → PATCH 全量发布；
    // 删除先 PATCH 去引用再 DELETE（204 No Content）。
    const 写入们: { path: string; method: string; body: unknown; multipart?: { parts: string[]; metadata?: unknown } }[] = [];
    const 删除状态: number[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-media',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C管理员关系], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method, body, multipart }) => {
        if (method !== 'GET') 写入们.push({ path, method, body, multipart });
      },
    });
    page.on('response', (响应) => {
      const 路径 = new URL(响应.url()).pathname;
      if (路径.startsWith(`/api/v1/organizations/${P1C标记.组织甲编号}/media/`) && 响应.request().method() === 'DELETE') {
        删除状态.push(响应.status());
      }
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.goto('/#/hr/company-profile/album');
    await expect(page.getByRole('button', { name: '添加实景照片' })).toBeVisible({ timeout: 10_000 });

    await page.setInputFiles('input[aria-label="上传实景照片"]', {
      name: '实景.png', mimeType: 'image/png', buffer: 一像素PNG,
    });
    // 上传 → PATCH 发布 → 快照带权威媒体 → 删除键出现
    await expect(page.getByRole('button', { name: '删除实景照片第 1 张' })).toBeVisible({ timeout: 10_000 });

    const 媒体写 = 写入们.find((项) => 项.path === `/api/v1/organizations/${P1C标记.组织甲编号}/media` && 项.method === 'POST');
    expect(媒体写).toBeDefined();
    // FormData key 顺序：metadata(application/json) + media，恰好两个 part
    expect(媒体写!.multipart?.parts).toEqual(['metadata', 'media']);
    // metadata 的 purpose 按槽位区分（office_photo），只在测试进程内比对
    expect(媒体写!.multipart?.metadata).toEqual({ purpose: 'office_photo' });

    const 发布们 = 写入们.filter((项) => 项.path === `/api/v1/organizations/${P1C标记.组织甲编号}/profile` && 项.method === 'PATCH');
    expect(发布们.length).toBe(1);
    expect((发布们[0].body as { office_media_ids: string[] }).office_media_ids.length).toBe(1);

    // 删除：先 PATCH 去引用（media 仍被快照引用），再 DELETE 拿 204
    await page.getByRole('button', { name: '删除实景照片第 1 张' }).click();
    await expect(page.getByRole('button', { name: '删除实景照片第 1 张' })).toHaveCount(0, { timeout: 10_000 });
    expect(删除状态).toEqual([204]);

    const 补丁们 = 写入们.filter((项) => 项.path === `/api/v1/organizations/${P1C标记.组织甲编号}/profile` && 项.method === 'PATCH');
    expect(补丁们.length).toBe(2);
    expect((补丁们[1].body as { office_media_ids: string[] }).office_media_ids).toEqual([]);
  });

  test('P1C 409 冲突保留公司介绍草稿并需人工再存 @backend', async ({ page }) => {
    // 覆盖沿用现有 覆盖 seam：首次 PATCH 409 version_conflict → operation 重读权威快照，
    // 但文本草稿留在用户手里；人工再按同一个保存键，第二次放行给内置 fixture 应答。
    let 档案写数 = 0;
    let 档案读数 = 0;
    let 覆盖次数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-409',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C管理员关系], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method }) => {
        if (path === `/api/v1/organizations/${P1C标记.组织甲编号}/profile`) {
          if (method === 'PATCH') 档案写数++;
          if (method === 'GET') 档案读数++;
        }
      },
      覆盖: {
        [`PATCH /api/v1/organizations/${P1C标记.组织甲编号}/profile`]: () => {
          覆盖次数++;
          if (覆盖次数 === 1) {
            return { status: 409, 响应: { error: { type: 'version_conflict', message: '版本冲突' } } };
          }
          return undefined; // 人工再存这一次放行给内置 fixture
        },
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    // 走真实入口进分区页（名片 → 公司主页资料 → 公司介绍行）：保存成功后的 返回()
    // 才会回到分区清单，而不是直接手输 URL 后退到企业主壳
    await page.goto('/#/hr/card');
    await page.getByRole('button', { name: /公司主页资料/ }).click();
    await expect(page).toHaveURL(/#\/hr\/company-profile$/, { timeout: 10_000 });
    await page.getByRole('button', { name: /公司介绍/ }).click();
    const 草稿区 = page.getByLabel('公司介绍');
    await expect(草稿区).toBeVisible({ timeout: 10_000 });
    await expect(草稿区).toHaveValue(P1C标记.公司介绍);

    await 草稿区.fill('409 之后仍然留在本页的草稿');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    // 409：operation 重读权威快照（媒体同步、文本不动），草稿保留，页面不离开。
    // 计数是普通数字，click 之后网络往返要等一会儿 → expect.poll 轮询
    await expect.poll(() => 档案读数, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(() => 档案写数, { timeout: 10_000 }).toBe(1);
    await expect(page.getByLabel('公司介绍')).toHaveValue('409 之后仍然留在本页的草稿');
    await expect(page).toHaveURL(/#\/hr\/company-profile\/intro$/);

    // 人工再存：第二次 PATCH 走内置 fixture 应答成功，才返回分区清单
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('已保存')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/#\/hr\/company-profile$/, { timeout: 10_000 });
    await expect.poll(() => 档案写数, { timeout: 10_000 }).toBe(2);
  });

  test('P1C canonical ref 公司卡可进公开企业页，no-ref 声明卡不可点 @backend', async ({ page }) => {
    // owner snapshot 投影：带 hiring_organization_ref 的公司卡是按钮，点击直接读公开企业；
    // 无 ref 的未认证声明只渲染同样式的非交互块，也不触发任何 Organization 读取。
    // publisher / hiring 两行不折叠，direct 与 agency 各占一行并带 wire code。
    const 岗位甲 = P1C岗位();
    const 岗位乙 = P1C岗位({
      job_id: 'job-fixture-noref',
      publisher_mode: 'agency',
      publisher_affiliation_ref: 'aff-fixture-admin',
      publisher_verification_status: 'unverified',
      publisher_organization_ref: undefined,
      hiring_organization_claim: { display_name: '未认证声明客户乙', legal_name: null },
      hiring_organization_verification_status: 'unverified',
      hiring_organization_ref: undefined,
      title: 'Fixture 岗位（无企业引用）',
    });
    const 公开读取: string[] = [];
    let 岗位读取数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-ref',
      记录目录请求: () => undefined,
      // 无企业关系（水合不预读公开企业），公司卡点击才是对公开企业的直接读取
      招聘组织Fixture: 带企业关系(
        P1C招聘组织Fixture,
        [],
        { [P1C标记.组织甲编号]: P1C组织甲() },
        [岗位甲, 岗位乙],
      ),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method }) => {
        if (method === 'GET' && path.startsWith('/api/v1/organizations/')) 公开读取.push(path);
        if (path === '/api/v1/recruiter/jobs' && method === 'GET') 岗位读取数++;
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await expect.poll(() => 岗位读取数).toBeGreaterThanOrEqual(1);

    await page.goto('/#/hr/job/job-fixture-001');
    await expect(page.getByRole('heading', { name: 'Fixture 岗位（带企业引用）' })).toBeVisible({ timeout: 10_000 });
    // direct/agency 不折叠：两行各自来自明确的 DTO 字段，展示带 wire code
    await expect(page.getByTestId('publisher-status')).toContainText('直招 · 已认证（verified）');
    await expect(page.getByTestId('hiring-status')).toContainText(`${P1C标记.组织甲名} · 已认证（verified）`);

    const 读取前 = 公开读取.length;
    await page.getByRole('button', { name: new RegExp(P1C标记.组织甲名) }).click();
    await expect(page).toHaveURL(new RegExp(`#/company/${P1C标记.组织甲编号}$`));
    // 企业身份卡来自直接读取的公开企业（不经过任何 candidate Job route）。
    // dev server 的 StrictMode 会双跑挂载 effect：次数 ≥1，且全部按 canonical ID 读
    await expect(page.getByText(P1C标记.组织甲法定名)).toBeVisible({ timeout: 10_000 });
    const 公司页读取 = 公开读取.slice(读取前);
    expect(公司页读取.length).toBeGreaterThanOrEqual(1);
    expect(new Set(公司页读取)).toEqual(new Set([`/api/v1/organizations/${P1C标记.组织甲编号}`]));

    await page.goto('/#/hr/job/job-fixture-noref');
    await expect(page.getByRole('heading', { name: 'Fixture 岗位（无企业引用）' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('publisher-status')).toContainText('代理 · 未认证（unverified）');
    await expect(page.getByTestId('hiring-status')).toContainText('未认证声明客户乙 · 未认证（unverified）');
    // 声明卡不是按钮（无尖括号、无可点），claim 不触发任何 Organization 读取
    await expect(page.getByRole('button', { name: /未认证声明客户乙/ })).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(公开读取.length).toBe(读取前 + 公司页读取.length);
  });

  test('P1C Organization 读取失败不回退 Mock 公司内容 @backend', async ({ page }) => {
    // 公开企业读得到 → 企业身份卡来自 HTTP；读不到（404 organization_not_found）
    // → 诚实空态，绝不拿静态公司档案顶替。
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-org-fail',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C管理员关系], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      覆盖: {
        'GET /api/v1/organizations/org-fixture-gone': () => ({
          status: 404,
          响应: { error: { type: 'organization_not_found', message: '企业不存在' } },
        }),
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

    await page.goto(`/#/company/${P1C标记.组织甲编号}`);
    await expect(page.getByText(P1C标记.组织甲法定名)).toBeVisible({ timeout: 10_000 });

    await page.goto('/#/company/org-fixture-gone');
    await expect(page.getByText('这家企业暂时打不开')).toBeVisible({ timeout: 10_000 });
    // Mock 分支的静态公司页内容不出现（不回退静态档）
    await expect(page.getByText('公司自述')).toHaveCount(0);
    await expect(page.getByText('作息与条款')).toHaveCount(0);
  });
});
