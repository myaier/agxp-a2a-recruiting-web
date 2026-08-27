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
//
// P6（Task 8）：追加 Agent 规则域可变 fixture —— agent-rules / agent-rule-proposals 双角色。
// 清单一律两页翻页；解读中提案在第二次单项 GET 转 ready；pause/resume 各自推进版本；
// 新规则/替换规则只在 accept 时物化；archive 只认当前版本 If-Match；409/503/响应丢失
// 由专用 fixture ID 选择固定分支。变更回执（body / If-Match / Idempotency-Key）存在
// fixture 的 mutationRequests 里供测试断言；Mock 场景断言 P6 域全程零 /api/v1 请求。

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

  test('Mock 规则页与双端筛选抽屉全程零 API 请求 @mock', async ({ page }) => {
    // P6（Task 8）：双端规则页（/rules、/hr/agent-settings）+ 双端筛选抽屉（看市场 / 候选推荐）
    // 在 Mock 下全部走本地状态；本地新增/开关/编辑各做一次，断言 P6 的 agent-rule 请求恒为零。
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // ── /rules：Mock 种子规则直接上屏（5 条种子里 1 条默认停用 → 生效计数 4）──
    await page.goto('/#/rules');
    await expect(page.getByText('不主动披露并行接触数量')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('双休是底线；隔周六可谈，大小周不谈')).toBeVisible();
    await expect(page.getByText('4 条')).toBeVisible();

    // ── 候选端市场筛选抽屉：本地新增一条规则（失焦即落库，不发请求）──
    await page.goto('/#/app');
    await page.getByRole('button', { name: '市场', exact: true }).click();
    // 筛选键带生效条数（规则 > 0 时是「筛选 · N ▾」）
    await page.getByRole('button', { name: /筛选.*▾/ }).click();
    await expect(page.getByText('告诉AI代理你的硬性要求')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '＋ 添加规则' }).click();
    // 新增行自动聚焦且排在既有行之后；回车即失焦落库，回规则库核对真的进了清单
    const 候选新行 = page.getByRole('dialog').getByRole('textbox').last();
    await 候选新行.fill('只投双休岗位');
    await 候选新行.press('Enter');
    await page.goto('/#/rules');
    await expect(page.getByRole('button', { name: /只投双休岗位/ })).toBeVisible({ timeout: 10_000 });

    // ── 切到招聘端：/hr/agent-settings 的 Mock 开关一次翻转 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    await page.goto('/#/hr/agent-settings');
    const 规则开关 = page.getByRole('switch', { name: '规则：竞对在职候选人不接触、不推进' });
    await expect(规则开关).toBeVisible({ timeout: 10_000 });
    await expect(规则开关).toHaveAttribute('aria-checked', 'true');
    await 规则开关.click();
    await expect(规则开关).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText('2 条生效')).toBeVisible();

    // ── 招聘端候选筛选抽屉（推荐子视图）：本地改一条规则 ──
    await page.goto('/#/hr');
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await page.getByRole('button', { name: /筛选.*▾/ }).click();
    await expect(page.getByText('告诉AI代理你的硬性要求')).toBeVisible({ timeout: 10_000 });
    // 企业规则种子首行是「不透露 HC 剩余数量与紧迫度」，就地改写后回车落库，去 canonical 页核对
    const 招聘规则行 = page.getByRole('dialog').getByRole('textbox').first();
    await expect(招聘规则行).toHaveValue('不透露 HC 剩余数量与紧迫度');
    await 招聘规则行.fill('不透露 HC 剩余数量与紧迫度（改）');
    await 招聘规则行.press('Enter');
    await page.goto('/#/hr/agent-settings');
    await expect(page.getByText('不透露 HC 剩余数量与紧迫度（改）')).toBeVisible({ timeout: 10_000 });

    // P6 域在 Mock 下零请求：agent-rule 一个都没有，整个会话也没有任何 /api/v1
    expect(apiRequests.filter((url) => url.includes('agent-rule'))).toEqual([]);
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

// ─────────────────────────────────────────────────────────────────────────────
// P6 Agent 规则域 fixture（Task 8）。wire 形与其他 fixture 一样就地声明，不反向依赖 src；
// 标记值只存在于 fixture，断言页面展示它们即证明渲染来自 HTTP 而非 Mock。
// 可变状态（规则 / 提案 / 读取计数 / 变更回执）归每次 安装BFF路由 所有，页面写入只影响本测试。
// ─────────────────────────────────────────────────────────────────────────────

/** P6 wire 规则形（与 BFF契约.BFFAgent规则 同构；fixture 不伪造缺失键，解码器按闭合契约拒收） */
interface P6Rule {
  rule_id: string;
  version: number;
  state: 'active' | 'paused' | 'archived';
  scope: { type: 'global' } | { type: 'intention'; intention_id: string };
  clause_kinds: string[];
  display_text: string;
  created_at: string;
  updated_at: string;
}

/** P6 wire 提案形（与 BFF契约.BFFAgent规则提案 同构；interpreting 可带 created_at 但永不带正文） */
interface P6Proposal {
  proposal_id: string;
  state: 'interpreting' | 'ready' | 'accepted' | 'dismissed' | 'failed';
  normalized_text?: string;
  consequence?: 'auto_allow' | 'auto_deny' | 'advisory' | 'mixed';
  created_at?: string;
}

interface P6FixtureState {
  rules: Record<'candidate' | 'recruiter', P6Rule[]>;
  proposals: Record<'candidate' | 'recruiter', P6Proposal[]>;
  proposalReads: Record<string, number>;
  mutationRequests: { method: string; path: string; body: unknown; ifMatch: string | null; idempotencyKey: string | null }[];
}

const P6标记 = {
  意向编号: 'int_00112233445566778899aabbccddeec1',
  候选全局规则: '不投单休大小周的公司（fixture 全局规则）',
  候选意向规则: '只看 Fixture 市的产品岗（fixture 意向规则）',
  招聘全局规则: '到岗超过 60 天的候选先不推进（fixture 规则）',
  冲突规则: '薪资低于 30K 的岗位自动跳过（fixture 冲突规则）',
  就绪提案正文: '命中大小周的岗位自动排除（fixture 就绪提案）',
  解读完成正文: '优先推进薪酬透明的岗位（fixture 解读完成）',
  不可接受提案正文: '只和讲清楚的招聘方谈（fixture 不可执行提案）',
  丢失提案正文: '晚上十点后不聊工作（fixture 响应丢失提案）',
  未知提案正文: '只看给缴社保的岗位（fixture 结果未知提案）',
  全局新建草稿: '不接受外包岗位（fixture 新建规则）',
  意向新建草稿: '只和 Fixture 市的岗位谈（fixture 意向新建）',
  替换草稿: '只投双休岗位（fixture 替换规则）',
  招聘新建草稿: '两周内到岗的候选优先（fixture 招聘新建）',
  失败草稿: '这句语法不通顺代理理解不了（fixture 失败重试）',
  创建失败提示: 'Fixture 创建暂时失败',
} as const;

const P6编号 = {
  候选全局规则: 'rul_00112233445566778899aabbccddeea1',
  候选意向规则: 'rul_00112233445566778899aabbccddeea2',
  招聘全局规则: 'rul_00112233445566778899aabbccddeea3',
  解释中提案: 'arp_00112233445566778899aabbccddeeb1',
  就绪提案: 'arp_00112233445566778899aabbccddeeb2',
} as const;

/** 专用分支 fixture ID：只有测试显式 seed 时才会进入状态并选择固定错误分支 */
const P6分支编号 = {
  冲突规则: 'rul_00112233445566778899aabbccddeea4',
  不可接受提案: 'arp_00112233445566778899aabbccddeeb3',
  丢失提案: 'arp_00112233445566778899aabbccddeeb4',
  未知提案: 'arp_00112233445566778899aabbccddeeb5',
  失败提案: 'arp_00112233445566778899aabbccddeeb6',
} as const;

function P6规则(覆盖: Partial<P6Rule> & Pick<P6Rule, 'rule_id' | 'display_text' | 'scope'>): P6Rule {
  return {
    version: 1,
    state: 'active',
    clause_kinds: ['work_schedule'],
    created_at: '2026-08-26T00:00:00Z',
    updated_at: '2026-08-26T00:00:00Z',
    ...覆盖,
  };
}

const candidateGlobalRule: P6Rule = P6规则({
  rule_id: P6编号.候选全局规则,
  display_text: P6标记.候选全局规则,
  scope: { type: 'global' },
});
const candidateIntentionRule: P6Rule = P6规则({
  rule_id: P6编号.候选意向规则,
  display_text: P6标记.候选意向规则,
  scope: { type: 'intention', intention_id: P6标记.意向编号 },
});
const recruiterGlobalRule: P6Rule = P6规则({
  rule_id: P6编号.招聘全局规则,
  display_text: P6标记.招聘全局规则,
  scope: { type: 'global' },
});
/** 解读中提案（清单视图可带 created_at）：轮询的第二次单项 GET 把它转 ready */
const candidateInterpretingProposal: P6Proposal = {
  proposal_id: P6编号.解释中提案,
  state: 'interpreting',
  created_at: '2026-08-26T00:00:00Z',
};
/** 就绪提案：auto_deny 专用 fixture —— 安全摘要逐字来自 consequence，页面不做任何浏览器侧判定 */
const candidateReadyProposal: P6Proposal = {
  proposal_id: P6编号.就绪提案,
  state: 'ready',
  normalized_text: P6标记.就绪提案正文,
  consequence: 'auto_deny',
  created_at: '2026-08-26T00:00:00Z',
};

/** 专用分支提案的 seed：提案本体 + 它在 fixture 里走哪条固定错误分支（不进 wire 形） */
interface P6追加提案 {
  提案: P6Proposal;
  分支?: 'accept丢失' | 'accept未知' | 'accept不可接受' | '单读失败';
}

interface P6追加规则 {
  规则: P6Rule;
  分支?: '写入冲突';
}

/** fixture 内部提案元数据：草稿正文 / 权威解读 / 范围 / 替换目标 / 固定错误分支（不进 wire 形） */
interface P6提案元数据形 {
  草稿?: string;
  权威正文?: string;
  后果?: P6Proposal['consequence'];
  scope?: P6Rule['scope'];
  替换目标编号?: string;
  分支?: P6追加提案['分支'];
}

/** P6 专用分支 fixture：按需叠加在基础状态上，用专用 fixture ID 选择固定 409/503/响应丢失应答 */
interface P6分支配置 {
  /** 追加进 recruiter 初始规则清单的专用规则（如 PATCH 一律 409 的冲突规则） */
  追加规则们?: P6追加规则[];
  /** 追加进 candidate 初始提案清单的专用提案（分支提案以现成形态入场） */
  追加提案们?: P6追加提案[];
  /** 规则清单翻页游标成环 → 前端按契约漂移整域失败（服务异常重试 UI，绝不回退 Mock） */
  游标成环?: boolean;
  /** candidate 规则清单第一次请求返回 503（先失败出重试键，重试请求再由 挂起候选规则 接管） */
  规则清单首次失败?: boolean;
  /** 挂起 candidate 规则清单第一页应答，直到测试放行（首屏 pending / 迟到响应隔离） */
  挂起候选规则?: Promise<void>;
  /** candidate 创建提案的前 N 次 POST 返回 500（失败保留草稿，再次提交是新意图、新 key） */
  创建前几次失败?: number;
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
      // Task 8：用 P6 契约形的真实 intention_id（int_ + 32 hex），意向级规则 scope 与
      // 意向级创建 body 引用的都是这一个权威 ID
      intention_id: P6标记.意向编号,
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
  // P3：四员硬性条件是 Owner Job 的必备成员 —— 前端按 exact key set + 闭合档位 fail-closed 校验，
  // 所有 Owner Job fixture（GET 列表 / POST / PATCH 应答）都必须带完整四员，缺员即水合拒绝。
  hard_requirements: P3硬性条件形;
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

// ─────────────────────────────────────────────────────────────────────────────
// P3 隐私域 fixture（Task 6）：/api/v1/me/privacy 整读与稀疏补丁、组织屏蔽与解除、
// 可屏蔽组织搜索。所有标记值只存在于 fixture（明显的合成编号），断言页面展示它们
// 即证明渲染来自 HTTP 而非 Mock。每个请求的 path/method/body/If-Match/Idempotency-Key
// 都经 请求拦截 记录，密钥只在测试进程内比对，不进日志。
// ─────────────────────────────────────────────────────────────────────────────

const P3标记 = {
  /** 组织搜索命中（自动来源屏蔽用）——同一族三个，第一页两枚便于验证游标 */
  可屏蔽组织甲: 'Fixture 云衢关联甲',
  可屏蔽组织甲法定: '上海 Fixture 云衢关联甲有限公司',
  可屏蔽组织乙: 'Fixture 云衢关联乙',
  可屏蔽组织乙法定: '上海 Fixture 云衢关联乙有限公司',
  可屏蔽组织丙: 'Fixture 云衢关联丙',
  可屏蔽组织丙法定: '上海 Fixture 云衢关联丙有限公司',
  /** 手动添加搜索族 */
  手动组织甲: 'Fixture 磐石信息',
  手动组织甲法定: '上海 Fixture 磐石信息有限公司',
  /** 停用组织：strict 口径绝不进搜索结果，但允许出现在既有屏蔽里 */
  停用组织: 'Fixture 停用旧东家',
  停用组织法定: '上海 Fixture 停用旧东家有限公司',
  冲突披露值显示: '一直允许',
} as const;

/** BFF硬性条件的 fixture 形（四员闭合，缺一即服务端契约漂移） */
type P3硬性档 = 'required' | 'not_required' | 'unknown';

interface P3硬性条件形 {
  alternate_weekend_work: P3硬性档;
  outsourcing_only: P3硬性档;
  onsite_only: P3硬性档;
  frequent_travel: P3硬性档;
}

/** 服务端存储口径的四员兜底：全部 未说明（unknown），只许 fixture 合成，客户端解码不做兜底 */
const P3全未知硬性条件 = (): P3硬性条件形 => ({
  alternate_weekend_work: 'unknown',
  outsourcing_only: 'unknown',
  onsite_only: 'unknown',
  frequent_travel: 'unknown',
});

interface P3屏蔽形 {
  organization_id: string;
  organization_display_name: string;
  organization_status: 'active' | 'suspended';
  source: 'current_employer' | 'related_organization' | 'manual';
  created_at: string;
}

interface P3隐私形 {
  employer_privacy_enabled: boolean;
  disclosure_preferences: {
    current_employer: 'never' | 'resume_submission' | 'anonymous';
    education: 'never' | 'resume_submission' | 'anonymous';
    portfolio_links: 'never' | 'resume_submission' | 'anonymous';
  };
  organization_blocks: P3屏蔽形[];
  revision: number;
  updated_at: string;
}

/** 组织库里的一项：搜索池与屏蔽元数据共用（搜索只回 active） */
interface P3组织库项形 {
  display_name: string;
  legal_name: string;
  status: 'active' | 'suspended';
}

/**
 * GET /me/privacy 的脚本队列项：
 *  - 无项 → 按当前权威视图即刻应答；
 *  - { 保持 } → 本次请求挂起，测试调 兑现() 放行后再按当时视图应答（口径对齐安全重读语义）；
 *  - { 响应 } → 强制以这份（可能过时的）快照应答，制造跨会话陈旧响应。
 */
interface P3隐私读取脚本形 {
  /** 本次请求先挂起，直到这个 promise 兑现后再按当时视图应答 */
  保持?: Promise<void>;
  响应?: P3隐私形;
}

/** 单个搜索词的行为脚本（竞态用例）：延迟应答 + 固定项目/游标；未命中脚本的词走组织池 */
interface P3搜索脚本形 {
  词: string;
  延迟毫秒?: number;
  items: { organization_id: string; display_name: string; legal_name: string }[];
  next_cursor: string | null;
}

/** P3 隐私域可变 fixture：测试自持一份，安装路由后 handler 与测试共享同一对象 */
interface P3隐私fixture形 {
  /** 权威视图（live）：handler 直读直写；测试也可在两步之间直接改它模拟他端变更 */
  视图: P3隐私形;
  /** 组织搜索池（key = organization_id）；strict active 搜索只回 active 项 */
  组织库: Record<string, P3组织库项形>;
  /** GET privacy 脚本队列（FIFO，逐次消费） */
  get脚本: P3隐私读取脚本形[];
  /** 搜索行为脚本（按词匹配一次性消费） */
  搜索脚本: P3搜索脚本形[];
  /** 已受理的组织搜索（请求到达即记；竞态用例轮询「已发出」） */
  搜索完成: { q: string; cursor: string | null }[];
  /** 已应答的组织搜索（应答回写后记；竞态用例轮询「旧响应已终结」） */
  搜索已答: { q: string; cursor: string | null }[];
  /** 写入计数（不含 hydration 读），零基线由各用例自行快照增量 */
  统计: { 补丁: number; 屏蔽写入: number; 解除写入: number };
  /** 幂等键 → 回执 登记表：同键重放回原 receipt（200） */
  幂等登记: Map<string, { receipt: unknown; 块: P3屏蔽形 }>;
}

function P3隐私fixture(覆盖: Partial<P3隐私形> = {}): P3隐私fixture形 {
  const 初始视图: P3隐私形 = {
    employer_privacy_enabled: true,
    disclosure_preferences: {
      current_employer: 'never',
      education: 'resume_submission',
      portfolio_links: 'anonymous',
    },
    organization_blocks: [],
    revision: 1,
    updated_at: '2026-08-26T00:00:00Z',
    ...覆盖,
  };
  return {
    视图: 初始视图,
    组织库: {},
    get脚本: [],
    搜索脚本: [],
    搜索完成: [],
    搜索已答: [],
    统计: { 补丁: 0, 屏蔽写入: 0, 解除写入: 0 },
    幂等登记: new Map(),
  };
}

/** 可屏蔽组织的默认搜索池：同族三枚 active（首页两枚留游标）+ 一枚手动族 + 一枚停用 */
function P3默认组织库(): Record<string, P3组织库项形> {
  return {
    'org-fixture-p3-block-a': { display_name: P3标记.可屏蔽组织甲, legal_name: P3标记.可屏蔽组织甲法定, status: 'active' },
    'org-fixture-p3-block-b': { display_name: P3标记.可屏蔽组织乙, legal_name: P3标记.可屏蔽组织乙法定, status: 'active' },
    'org-fixture-p3-block-c': { display_name: P3标记.可屏蔽组织丙, legal_name: P3标记.可屏蔽组织丙法定, status: 'active' },
    'org-fixture-p3-manual-a': { display_name: P3标记.手动组织甲, legal_name: P3标记.手动组织甲法定, status: 'active' },
    'org-fixture-p3-suspended': { display_name: P3标记.停用组织, legal_name: P3标记.停用组织法定, status: 'suspended' },
  };
}

/** 发送前克隆视图：测试随后改权威对象不应影响已在途响应体 */
function P3克隆视图(视图: P3隐私形): P3隐私形 {
  return {
    ...视图,
    disclosure_preferences: { ...视图.disclosure_preferences },
    organization_blocks: 视图.organization_blocks.map((块) => ({ ...块 })),
  };
}

interface BFF路由选项 {
  记录目录请求: (path: string) => void;
  登录尝试id: string;
  /** 请求拦截：每次 /api/v1 请求触发（headers 可用于断言 If-Match / Idempotency-Key 等头） */
  请求拦截?: (请求: 拦截请求形) => void;
  /** 自定义响应覆盖：key = `METHOD path`；返回 undefined 表示放行给内置 fixture 应答 */
  覆盖?: Record<string, (body: unknown) => { status: number; 响应: unknown; 头?: Record<string, string> } | undefined>;
  /** GET /api/v1/session 返回 200（已登录）还是 401（未登录）。缺省 200（自动登录）*/
  会话已登录?: boolean;
  /** P1C：组织域 fixture（profile / affiliations / 公开企业 / 档案与媒体 / 管理员申请 / owner Jobs） */
  招聘组织Fixture?: P1C招聘组织Fixture形;
  /** P3：隐私域可变 fixture（me/privacy 整读补丁 / 组织搜索 / 屏蔽与解除）。缺席时这些路由走兜底空信封 */
  隐私fixture?: P3隐私fixture形;
  /** 主体初始 last_used_role：null（缺省）→ 落身份选择页；'candidate' → 直接水合进求职主壳；'recruiter' → 企业主壳 */
  主体初始角色?: 'candidate' | 'recruiter' | null;
  /** P6：Agent 规则域可变 fixture 的专用分支（追加规则/提案、游标成环、应答挂起） */
  P6分支?: P6分支配置;
}

/** 请求拦截收到的请求投影；multipart 的 metadata 只在测试进程内比对 */
interface 拦截请求形 {
  path: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
  /** URL query 原文（含 ?；组织搜索断言 q/limit/cursor 用） */
  query?: string;
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

/** 安装 /api/v1 route fixture：按 path + method 匹配，返回 fixture 信封；P6 可变状态经返回值暴露给测试断言。 */
async function 安装BFF路由(page: Page, 选项: BFF路由选项): Promise<{ p6: P6FixtureState }> {
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
        last_used_role: (选项.主体初始角色 ?? null) as 'candidate' | 'recruiter' | null,
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
  // ── P6 Agent 规则域：可变 fixture 状态每次安装独立一份，页面写入只影响本测试 ──
  const p6: P6FixtureState = {
    rules: {
      candidate: [candidateGlobalRule, candidateIntentionRule].map((规) => ({ ...规, scope: { ...规.scope } })),
      recruiter: [recruiterGlobalRule].map((规) => ({ ...规, scope: { ...规.scope } })),
    },
    proposals: {
      candidate: [candidateInterpretingProposal, candidateReadyProposal].map((提) => ({ ...提 })),
      recruiter: [],
    },
    proposalReads: {},
    mutationRequests: [],
  };
  // 专用分支 seed 追加进基础状态；分支标记走 fixture 内部元数据，不进 wire 形
  const 提案元数据 = new Map<string, P6提案元数据形>();
  const 提案终态 = new Map<string, P6Proposal>();
  const 冲突规则编号们 = new Set<string>();
  for (const 追加 of 选项.P6分支?.追加规则们 ?? []) {
    p6.rules.recruiter.push({ ...追加.规则, scope: { ...追加.规则.scope } });
    if (追加.分支 === '写入冲突') 冲突规则编号们.add(追加.规则.rule_id);
  }
  for (const 追加 of 选项.P6分支?.追加提案们 ?? []) {
    p6.proposals.candidate.push({ ...追加.提案 });
    提案元数据.set(追加.提案.proposal_id, {
      权威正文: 追加.提案.normalized_text,
      后果: 追加.提案.consequence,
      分支: 追加.分支,
    });
  }
  // 基础解读中提案的权威解读结果：第二次单项 GET 转 ready 时带上这段正文
  提案元数据.set(candidateInterpretingProposal.proposal_id, {
    权威正文: P6标记.解读完成正文,
    后果: 'auto_allow',
  });
  let 创建提案序 = 0;
  let 物化规则序 = 0;
  let 创建失败余数 = 选项.P6分支?.创建前几次失败 ?? 0;
  let 规则清单请求数 = 0;

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
      query: url.search,
      multipart: 部件们
        ? { parts: 部件们.map((件) => 件.name), metadata: 元数据部件 ? 解metadata部件(元数据部件.bytes) : undefined }
        : undefined,
    });

    if (path.startsWith('/api/v1/catalog/')) 选项.记录目录请求(path);

    // 自定义覆盖优先；返回 undefined 时放行给内置 fixture
    const 覆盖key = `${method} ${path}`;
    const 覆盖项 = 选项.覆盖?.[覆盖key]?.(body);
    if (覆盖项) {
      await route.fulfill({ status: 覆盖项.status, json: 覆盖项.响应, headers: 覆盖项.头 });
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

    // ── P3 隐私域（隐私 fixture 存在时才应答；缺席走兜底空信封 → strict decode 拒绝，
    //    正是「Mock 内容不顶替 HTTP」的既有边界）──
    const P3域 = 选项.隐私fixture ?? null;
    if (P3域) {
      // GET 权威整读：脚本队列 FIFO 消费 —— 无项即刻回当前视图；
      // { 保持 } 先挂起（安全重读在飞的窗口），放行后再按当时视图应答；{ 响应 } 强制回陈旧快照。
      if (path === '/api/v1/me/privacy' && method === 'GET') {
        const 脚本项 = P3域.get脚本.shift();
        if (脚本项?.保持) await 脚本项.保持;
        await route.fulfill({ status: 200, json: 信封(脚本项?.响应 ? P3克隆视图(脚本项.响应) : P3克隆视图(P3域.视图)) });
        return;
      }

      // PATCH 稀疏补丁：quoted If-Match 必须等于当前 revision 的 etag，不符 409 version_conflict；
      // 成功按成员合并、revision+1，回完整视图。body 只允许服务端拥有的两个成员。
      if (path === '/api/v1/me/privacy' && method === 'PATCH') {
        P3域.统计.补丁 += 1;
        const etag = 请求.headers()['if-match'] ?? '';
        if (etag !== `"${P3域.视图.revision}"`) {
          await route.fulfill({ status: 409, json: { error: { type: 'version_conflict', message: '版本冲突' } } });
          return;
        }
        const 补丁 = body as { employer_privacy_enabled?: boolean; disclosure_preferences?: Partial<P3隐私形['disclosure_preferences']> };
        if (补丁.employer_privacy_enabled !== undefined) {
          P3域.视图.employer_privacy_enabled = 补丁.employer_privacy_enabled;
        }
        if (补丁.disclosure_preferences !== undefined) {
          P3域.视图.disclosure_preferences = { ...P3域.视图.disclosure_preferences, ...补丁.disclosure_preferences };
        }
        P3域.视图.revision += 1;
        P3域.视图.updated_at = '2026-08-27T00:00:00Z';
        await route.fulfill({ status: 200, json: 信封(P3克隆视图(P3域.视图)) });
        return;
      }

      // GET 可屏蔽组织搜索：strict active（停用组织永不出现）；游标与 query 绑定
      // （格式 `${q}|${页码}`，跨词/未知游标一律空页）。固定每页 2 条制造翻页游标。
      if (path === '/api/v1/organizations' && method === 'GET') {
        const q = (url.searchParams.get('q') ?? '').trim();
        const 脚本 = P3域.搜索脚本.find((项) => 项.词 === q);
        if (脚本) {
          P3域.搜索脚本 = P3域.搜索脚本.filter((项) => 项 !== 脚本);
          P3域.搜索完成.push({ q, cursor: 脚本.next_cursor });
          if (脚本.延迟毫秒) await new Promise((resolve) => setTimeout(resolve, 脚本.延迟毫秒));
          P3域.搜索已答.push({ q, cursor: 脚本.next_cursor });
          await route.fulfill({ status: 200, json: 信封({ items: 脚本.items.map((项) => ({ ...项 })), next_cursor: 脚本.next_cursor }) });
          return;
        }
        const 游标原文 = url.searchParams.get('cursor') ?? '';
        let 页码 = 1;
        let 归属词 = q;
        if (游标原文 !== '') {
          const 解码 = Buffer.from(游标原文, 'base64url').toString('utf8');
          const 分隔 = 解码.lastIndexOf('|');
          归属词 = 分隔 >= 0 ? 解码.slice(0, 分隔) : ' 不匹配';
          页码 = Number(分隔 >= 0 ? 解码.slice(分隔 + 1) : NaN);
        }
        const 池 = Object.entries(P3域.组织库)
          .filter(([, 项]) => 项.status === 'active')
          .filter(([, 项]) => 项.display_name.includes(q))
          .map(([编号, 项]) => ({ organization_id: 编号, display_name: 项.display_name, legal_name: 项.legal_name }));
        const 每页 = 2;
        const 起点 = Number.isInteger(页码) && 页码 > 0 && 归属词 === q ? (页码 - 1) * 每页 : -1;
        const items = 起点 < 0 ? [] : 池.slice(起点, 起点 + 每页);
        const next_cursor = 起点 < 0 || 起点 + 每页 >= 池.length ? null : Buffer.from(`${q}|${页码 + 1}`).toString('base64url');
        P3域.搜索完成.push({ q, cursor: next_cursor });
        P3域.搜索已答.push({ q, cursor: next_cursor });
        await route.fulfill({ status: 200, json: 信封({ items, next_cursor }) });
        return;
      }

      // POST 屏蔽：If-Match + 非空 Idempotency-Key 必带；组织必须是搜索池里的稳定 ID。
      // 同键重放或同组织重复都以 200 回原 receipt；新建 201 receipt。
      if (path === '/api/v1/me/privacy/organization-blocks' && method === 'POST') {
        P3域.统计.屏蔽写入 += 1;
        const etag = 请求.headers()['if-match'] ?? '';
        const 幂等键 = 请求.headers()['idempotency-key'] ?? '';
        const 重放 = 幂等键 !== '' && P3域.幂等登记.get(幂等键);
        const 新块 = body as { organization_id?: string; source?: P3屏蔽形['source'] };
        const 库项 = 新块.organization_id !== undefined ? P3域.组织库[新块.organization_id] : undefined;
        if (
          etag !== `"${P3域.视图.revision}"` ||
          幂等键 === '' ||
          !库项 ||
          (新块.source !== 'current_employer' && 新块.source !== 'related_organization' && 新块.source !== 'manual')
        ) {
          await route.fulfill({
            status: 库项 === undefined && 新块.organization_id !== undefined ? 409 : 422,
            json: {
              error: {
                type: 库项 === undefined && 新块.organization_id !== undefined ? 'organization_unavailable' : 'validation_failed',
                message: '屏蔽请求未通过校验',
              },
            },
          });
          return;
        }
        if (重放) {
          await route.fulfill({ status: 200, json: 信封(JSON.parse(JSON.stringify(重放.receipt)) as unknown) });
          return;
        }
        const 重复 = P3域.视图.organization_blocks.find((块) => 块.organization_id === 新块.organization_id);
        if (重复) {
          const 回执 = {
            organization_block: { ...重复 },
            privacy_revision: P3域.视图.revision,
            created_at: 重复.created_at,
          };
          P3域.幂等登记.set(幂等键, { receipt: 回执, 块: { ...重复 } });
          await route.fulfill({ status: 200, json: 信封(回执) });
          return;
        }
        const 块: P3屏蔽形 = {
          organization_id: 新块.organization_id!,
          organization_display_name: 库项.display_name,
          organization_status: 库项.status,
          source: 新块.source!,
          created_at: '2026-08-27T01:00:00Z',
        };
        P3域.视图.organization_blocks = [...P3域.视图.organization_blocks.map((项) => ({ ...项 })), { ...块 }];
        P3域.视图.revision += 1;
        const 回执 = { organization_block: { ...块 }, privacy_revision: P3域.视图.revision, created_at: 块.created_at };
        P3域.幂等登记.set(幂等键, { receipt: 回执, 块 });
        await route.fulfill({ status: 201, json: 信封(回执) });
        return;
      }

      // POST 解除：目标必须仍在名单里（404）；建档来源的解除必须显式风险确认（422）；
      // 成功移除并 revision+1，回完整视图。
      const 解除匹配 = /^\/api\/v1\/me\/privacy\/organization-blocks\/([^/]+)\/unblock$/.exec(path);
      if (解除匹配 && method === 'POST') {
        P3域.统计.解除写入 += 1;
        const etag = 请求.headers()['if-match'] ?? '';
        const 目标 = P3域.视图.organization_blocks.find((块) => 块.organization_id === 解除匹配[1]);
        if (etag !== `"${P3域.视图.revision}"` || !目标) {
          await route.fulfill({ status: 目标 ? 409 : 404, json: { error: { type: 目标 ? 'version_conflict' : 'organization_block_not_found', message: '解除失败' } } });
          return;
        }
        const 要求确认 = (body as { risk_acknowledged?: boolean }).risk_acknowledged !== true;
        if ((目标.source === 'current_employer' || 目标.source === 'related_organization') && 要求确认) {
          await route.fulfill({ status: 422, json: { error: { type: 'risk_acknowledgement_required', message: '需要风险确认' } } });
          return;
        }
        P3域.视图.organization_blocks = P3域.视图.organization_blocks.filter((块) => 块.organization_id !== 解除匹配[1]).map((块) => ({ ...块 }));
        P3域.视图.revision += 1;
        await route.fulfill({ status: 200, json: 信封(P3克隆视图(P3域.视图)) });
        return;
      }
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

    // ── P6 Agent 规则域 handlers：状态声明在 route 外（跨请求存活），闭包只读请求上下文 ──
    // 变更回执：method/path/body + If-Match / Idempotency-Key 原样存证，测试断言全靠它
    const 记录P6变更 = (变更路径: string) => {
      p6.mutationRequests.push({
        method,
        path: 变更路径,
        body,
        ifMatch: 请求.headers()['if-match'] ?? null,
        idempotencyKey: 请求.headers()['idempotency-key'] ?? null,
      });
    };
    // accept 的统一落地：只有 accept 会物化 Rule；替换提案同时把目标旧规则归档出局
    const 物化并终态 = (角色: 'candidate' | 'recruiter', 提案编号: string, 元: P6提案元数据形 | undefined): P6Rule | null => {
      const 提案 = p6.proposals[角色].find((提) => 提.proposal_id === 提案编号);
      if (!提案 || 提案.state !== 'ready') return null;
      物化规则序 += 1;
      if (元?.替换目标编号) {
        const 目标 = p6.rules[角色].find((规) => 规.rule_id === 元.替换目标编号);
        if (目标) 目标.state = 'archived';
      }
      const 新规则: P6Rule = {
        rule_id: `rul_00112233445566778899aabbccddee${(0xd0 + 物化规则序 - 1).toString(16)}`,
        version: 1,
        state: 'active',
        scope: 元?.scope ?? { type: 'global' },
        clause_kinds: ['work_schedule'],
        display_text: 元?.权威正文 ?? `已理解：${元?.草稿 ?? ''}`,
        created_at: '2026-08-26T00:00:06Z',
        updated_at: '2026-08-26T00:00:06Z',
      };
      p6.rules[角色].push(新规则);
      提案终态.set(提案编号, { ...提案, state: 'accepted' });
      p6.proposals[角色] = p6.proposals[角色].filter((提) => 提.proposal_id !== 提案编号);
      return 新规则;
    };

    // 规则清单：一律两页翻页（首条 + cursor / 余下）；candidate 专用 503-首次与挂起分支
    const 规则清单匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rules$/.exec(path);
    if (规则清单匹配 && method === 'GET') {
      const 角色 = 规则清单匹配[1] === 'me' ? 'candidate' : 'recruiter';
      规则清单请求数 += 1;
      if (角色 === 'candidate' && 选项.P6分支?.规则清单首次失败 && 规则清单请求数 === 1) {
        await route.fulfill({ status: 503, json: { error: { type: 'service_unavailable', message: 'fixture 首次规则清单失败' } } });
        return;
      }
      if (角色 === 'candidate') await 选项.P6分支?.挂起候选规则;
      const 全部 = p6.rules[角色];
      const 游标 = url.searchParams.get('cursor');
      const 成环 = 角色 === 'candidate' && Boolean(选项.P6分支?.游标成环);
      const 页: { rules: P6Rule[]; next_cursor?: string } = 游标 === null
        ? (全部.length > 0 ? { rules: [全部[0]], next_cursor: 'fixture-p6-page-2' } : { rules: [] })
        : (成环 && 全部.length > 1
          ? { rules: 全部.slice(1), next_cursor: 'fixture-p6-page-2' }
          : { rules: 全部.slice(1) });
      await route.fulfill({ status: 200, json: 信封(页) });
      return;
    }

    // 规则单项：GET 带强 ETag；PATCH pause/resume 校验 If-Match 并推进版本；DELETE 只认当前版本
    const 规则单项匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rules\/([^/]+)$/.exec(path);
    if (规则单项匹配 && method === 'GET') {
      const 规则 = p6.rules[规则单项匹配[1] === 'me' ? 'candidate' : 'recruiter'].find((规) => 规.rule_id === 规则单项匹配[2]);
      if (!规则) {
        await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_not_found', message: '规则不存在' } } });
        return;
      }
      await route.fulfill({ status: 200, headers: { etag: `"${规则.version}"` }, json: 信封(规则) });
      return;
    }
    if (规则单项匹配 && method === 'PATCH') {
      记录P6变更(path);
      const 角色 = 规则单项匹配[1] === 'me' ? 'candidate' : 'recruiter';
      const 目标编号 = 规则单项匹配[2];
      const 规则 = p6.rules[角色].find((规) => 规.rule_id === 目标编号);
      if (冲突规则编号们.has(目标编号) || !规则 || 请求.headers()['if-match'] !== `"${规则.version}"`) {
        await route.fulfill({ status: 409, json: { error: { type: 'version_conflict', message: '版本冲突' } } });
        return;
      }
      const 换 = body as { operation?: 'pause' | 'resume' };
      if (换.operation === 'pause') 规则.state = 'paused';
      if (换.operation === 'resume') 规则.state = 'active';
      规则.version += 1;
      规则.updated_at = '2026-08-26T00:00:07Z';
      await route.fulfill({ status: 200, headers: { etag: `"${规则.version}"` }, json: 信封(规则) });
      return;
    }
    if (规则单项匹配 && method === 'DELETE') {
      记录P6变更(path);
      const 角色 = 规则单项匹配[1] === 'me' ? 'candidate' : 'recruiter';
      const 规则 = p6.rules[角色].find((规) => 规.rule_id === 规则单项匹配[2]);
      if (!规则) {
        await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_not_found', message: '规则不存在' } } });
        return;
      }
      // archive 只在 If-Match 等于当前版本时生效，否则 409（客户端必须重读权威版本）
      if (请求.headers()['if-match'] !== `"${规则.version}"`) {
        await route.fulfill({ status: 409, json: { error: { type: 'version_conflict', message: '版本冲突' } } });
        return;
      }
      规则.state = 'archived';
      await route.fulfill({ status: 204 });
      return;
    }

    // 替换提案：If-Match 必须点名创建时的当前版本；提案先以 interpreting 回执入场
    const 替换匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rules\/([^/]+)\/replacement-proposals$/.exec(path);
    if (替换匹配 && method === 'POST') {
      记录P6变更(path);
      const 角色 = 替换匹配[1] === 'me' ? 'candidate' : 'recruiter';
      const 目标规则 = p6.rules[角色].find((规) => 规.rule_id === 替换匹配[2]);
      if (!目标规则) {
        await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_not_found', message: '规则不存在' } } });
        return;
      }
      if (请求.headers()['if-match'] !== `"${目标规则.version}"`) {
        await route.fulfill({ status: 409, json: { error: { type: 'version_conflict', message: '版本冲突' } } });
        return;
      }
      const 换 = body as { text?: string; scope?: P6Rule['scope'] };
      创建提案序 += 1;
      const 编号 = `arp_00112233445566778899aabbccddee${(0xc0 + 创建提案序 - 1).toString(16)}`;
      const 提案: P6Proposal = { proposal_id: 编号, state: 'interpreting' };
      提案元数据.set(编号, {
        草稿: 换.text ?? '',
        scope: 角色 === 'candidate' ? 换.scope : undefined,
        后果: 'mixed',
        替换目标编号: 替换匹配[2],
      });
      p6.proposals[角色].push(提案);
      await route.fulfill({ status: 200, json: 信封(提案) });
      return;
    }

    // 提案清单：按 state 过滤后同样两页翻页
    const 提案清单匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rule-proposals$/.exec(path);
    if (提案清单匹配 && method === 'GET') {
      const 角色 = 提案清单匹配[1] === 'me' ? 'candidate' : 'recruiter';
      const 想要状态 = url.searchParams.get('state') === 'interpreting' ? 'interpreting' as const : 'ready' as const;
      const 全部 = p6.proposals[角色].filter((提) => 提.state === 想要状态);
      const 游标 = url.searchParams.get('cursor');
      const 页: { proposals: P6Proposal[]; next_cursor?: string } = 游标 === null
        ? (全部.length > 0 ? { proposals: [全部[0]], next_cursor: 'fixture-p6-page-2' } : { proposals: [] })
        : { proposals: 全部.slice(1) };
      await route.fulfill({ status: 200, json: 信封(页) });
      return;
    }
    if (提案清单匹配 && method === 'POST') {
      记录P6变更(path);
      if (创建失败余数 > 0) {
        创建失败余数 -= 1;
        await route.fulfill({ status: 500, json: { error: { type: 'internal_error', message: P6标记.创建失败提示 } } });
        return;
      }
      const 角色 = 提案清单匹配[1] === 'me' ? 'candidate' : 'recruiter';
      const 换 = body as { text?: string; scope?: P6Rule['scope'] };
      创建提案序 += 1;
      const 编号 = `arp_00112233445566778899aabbccddee${(0xc0 + 创建提案序 - 1).toString(16)}`;
      // fresh create 回执只有 proposal_id + state（连 created_at 都不给，解码器允许）
      const 提案: P6Proposal = { proposal_id: 编号, state: 'interpreting' };
      提案元数据.set(编号, {
        草稿: 换.text ?? '',
        scope: 角色 === 'candidate' ? 换.scope : undefined,
        后果: 'mixed',
      });
      p6.proposals[角色].push(提案);
      await route.fulfill({ status: 200, json: 信封(提案) });
      return;
    }

    // 提案单项 GET：第二次读取把 interpreting 转 ready（权威解读完成）；专用 ID 第一次读即 failed
    const 单提案匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rule-proposals\/([^/]+)$/.exec(path);
    if (单提案匹配 && method === 'GET') {
      const 角色 = 单提案匹配[1] === 'me' ? 'candidate' : 'recruiter';
      const 提案编号 = 单提案匹配[2];
      // 读取计数对终态回执同样生效（accept 恢复路径的 GET 也要留下存证）
      p6.proposalReads[提案编号] = (p6.proposalReads[提案编号] ?? 0) + 1;
      const 终态 = 提案终态.get(提案编号);
      if (终态) {
        await route.fulfill({ status: 200, json: 信封(终态) });
        return;
      }
      const 提案 = p6.proposals[角色].find((提) => 提.proposal_id === 提案编号);
      if (!提案) {
        await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_proposal_not_found', message: '提案不存在' } } });
        return;
      }
      if (提案.state === 'interpreting') {
        const 元 = 提案元数据.get(提案编号);
        if (元?.分支 === '单读失败') {
          提案.state = 'failed';
        } else if ((p6.proposalReads[提案编号] ?? 0) >= 2) {
          提案.state = 'ready';
          提案.normalized_text = 元?.权威正文 ?? `已理解：${元?.草稿 ?? ''}`;
          提案.consequence = 元?.后果 ?? 'mixed';
          提案.created_at = 提案.created_at ?? '2026-08-26T00:00:05Z';
        }
      }
      await route.fulfill({ status: 200, json: 信封(提案) });
      return;
    }

    // accept：专用分支（不可执行 409 / 结果未知 503 / 响应丢失中断）都先按服务端语义落终态再丢应答
    const 接受匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rule-proposals\/([^/]+)\/accept$/.exec(path);
    if (接受匹配 && method === 'POST') {
      记录P6变更(path);
      const 角色 = 接受匹配[1] === 'me' ? 'candidate' : 'recruiter';
      const 提案编号 = 接受匹配[2];
      const 元 = 提案元数据.get(提案编号);
      if (元?.分支 === 'accept不可接受') {
        // 公开 consequence 从不决定可执行性：这张卡看起来完全可接受，服务端仍裁决 not_actionable
        await route.fulfill({ status: 409, json: { error: { type: 'agent_rule_proposal_not_actionable', message: 'proposal not actionable' } } });
        return;
      }
      if (元?.分支 === 'accept丢失' || 元?.分支 === 'accept未知') {
        if (!提案终态.has(提案编号)) 物化并终态(角色, 提案编号, 元);
        if (元.分支 === 'accept丢失') {
          await route.abort('connectionreset');
          return;
        }
        await route.fulfill({ status: 503, json: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } });
        return;
      }
      const 新规则 = 物化并终态(角色, 提案编号, 元);
      if (!新规则) {
        await route.fulfill({ status: 409, json: { error: { type: 'agent_rule_proposal_not_ready', message: '提案还未就绪' } } });
        return;
      }
      await route.fulfill({ status: 200, headers: { etag: `"${新规则.version}"` }, json: 信封(新规则) });
      return;
    }

    // dismiss：提案出局并给 dismissed 回执（恢复路径靠单项 GET 也能读到同一终态）
    const 放弃匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rule-proposals\/([^/]+)\/dismiss$/.exec(path);
    if (放弃匹配 && method === 'POST') {
      记录P6变更(path);
      const 角色 = 放弃匹配[1] === 'me' ? 'candidate' : 'recruiter';
      const 提案 = p6.proposals[角色].find((提) => 提.proposal_id === 放弃匹配[2]);
      if (!提案) {
        await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_proposal_not_found', message: '提案不存在' } } });
        return;
      }
      提案终态.set(提案.proposal_id, { proposal_id: 提案.proposal_id, state: 'dismissed' });
      p6.proposals[角色] = p6.proposals[角色].filter((提) => 提.proposal_id !== 提案.proposal_id);
      await route.fulfill({ status: 200, json: 信封({ proposal_id: 提案.proposal_id, state: 'dismissed' }) });
      return;
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
      // P3：hard_requirements 四员块必收完整（客户端永远带整块），fixture 原样落库回读。
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
        hard_requirements?: P3硬性条件形;
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
        hard_requirements: { ...P3全未知硬性条件(), ...换.hard_requirements },
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

    // P3：编辑岗位 —— PATCH 回完整 owner DTO（immutable title/type/category/location 带
    // 服务端原值），hard_requirements 整块替换，revision+1。客户端 PATCH 前必带 quoted If-Match。
    const 编辑匹配 = 组织fixture ? /^\/api\/v1\/recruiter\/jobs\/([^/]+)$/.exec(path) : null;
    if (编辑匹配 && method === 'PATCH') {
      const 存量 = 岗位可变.find((项) => 项.job_id === 编辑匹配[1]);
      if (!存量) {
        await route.fulfill({ status: 404, json: { error: { type: 'job_not_found', message: '岗位不存在' } } });
        return;
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
        hard_requirements?: P3硬性条件形;
        description: string;
        requirements: string;
        keywords: string[];
        private_screening_preferences: string;
      };
      存量.office_location = 补丁.office_location;
      存量.workplace_mode = 补丁.workplace_mode;
      存量.salary_lower = 补丁.salary.lower;
      存量.salary_upper = 补丁.salary.upper;
      存量.salary_period = 存量.recruitment_type === 'internship' || 存量.recruitment_type === 'part_time' ? 'day' : 'month';
      存量.annual_salary_months = 补丁.annual_salary_months;
      存量.campus_cohort = 补丁.campus_cohort;
      存量.internship_months = 补丁.internship_months;
      存量.onsite_days_per_week = 补丁.onsite_days_per_week;
      存量.experience_requirement = 补丁.experience_requirement;
      存量.education_requirement = 补丁.education_requirement;
      存量.hard_requirements = { ...P3全未知硬性条件(), ...补丁.hard_requirements };
      存量.description = 补丁.description;
      存量.requirements = 补丁.requirements;
      存量.keywords = Array.isArray(补丁.keywords) ? [...补丁.keywords] : [];
      存量.private_screening_preferences = 补丁.private_screening_preferences;
      存量.revision += 1;
      存量.updated_at = '2026-08-27T02:00:00Z';
      await route.fulfill({ status: 200, json: 信封({ ...存量 }) });
      return;
    }

    // 兜底：未匹配的 /api/v1/* 返回 200 空信封，避免测试因未处理路由挂死
    await route.fulfill({ status: 200, json: 信封(null) });
  });
  return { p6 };
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
    // P6（Task 8）起规则三路读取与组织水合并行起跑，所以这里只在组织域请求内部看相对顺序。
    const 链 = 请求们.map((项) => `${项.method} ${项.path}`);
    const 组织链 = 链.filter((项) => 项.startsWith('GET /api/v1/recruiter/profile') ||
      项.startsWith('GET /api/v1/recruiter/affiliations') || 项.startsWith('GET /api/v1/recruiter/jobs'));
    expect(组织链.slice(0, 3)).toEqual([
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

// ─────────────────────────────────────────────────────────────────────────────
// P3 隐私域主链路 @backend（Task 6）：candidate 会话恢复水合隐私 → 设置关隐身 PATCH If-Match
// → 披露偏好稀疏补丁 → 屏蔽名单搜索/屏蔽（稳定组织 ID + 幂等键）→ 建档来源解除风险确认
// → 手动来源加入与解除 → 切招聘方 → 发布并编辑岗位（hard_requirements 四员完整收发）。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P3 Backend 隐私主链路 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 150_000 });

  test('P3 隐私读写、组织屏蔽与岗位硬性条件走 HTTP fixture 主链路 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    const 请求们: 拦截请求形[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-main',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      招聘组织Fixture: 带企业关系(
        P1C招聘组织Fixture,
        [P1C管理员关系],
        { [P1C标记.组织甲编号]: P1C组织甲() },
      ),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
    });

    // ── candidate 会话恢复：隐私是第三条并行水合域 ──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const 链 = 请求们.map((项) => `${项.method} ${项.path}`);
    const 会话位 = 链.indexOf('GET /api/v1/session');
    expect(会话位).toBeGreaterThanOrEqual(0);
    expect(链.slice(会话位, 会话位 + 12)).toEqual(expect.arrayContaining([
      'GET /api/v1/me/resume',
      'GET /api/v1/me/intentions',
      'GET /api/v1/me/privacy',
    ]));

    // ── 设置：关闭「对现雇主隐身」→ 确认弹层 → PATCH quoted If-Match ──
    await page.goto('/#/settings');
    const 隐身开关 = page.getByRole('switch', { name: '对现雇主隐身' });
    await expect(隐身开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    await 隐身开关.click();
    await page.getByRole('button', { name: '仍要关闭' }).click();
    await expect(page.getByText('隐身已关闭')).toBeVisible({ timeout: 10_000 });
    await expect(隐身开关).toHaveAttribute('aria-checked', 'false');
    let 补丁们 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'PATCH');
    expect(补丁们.length).toBe(1);
    expect(补丁们[0].body).toEqual({ employer_privacy_enabled: false });
    expect(补丁们[0].headers['if-match']).toBe('"1"');
    expect(补丁们[0].headers['idempotency-key']).toBeUndefined();

    // ── 披露偏好：D4 只发 education 单成员的稀疏补丁，If-Match 用服务端新 revision ──
    await page.goto('/#/disclosure-prefs');
    const 学历卡 = page.locator('[class*="披露卡"]').filter({ hasText: '毕业院校与学历' });
    await expect(学历卡.getByRole('button', { name: '意向确认后' })).toBeVisible({ timeout: 10_000 });
    await 学历卡.getByRole('button', { name: '不披露' }).click();
    await expect
      .poll(() => 请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'PATCH').length, { timeout: 10_000 })
      .toBe(2);
    补丁们 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'PATCH');
    expect(补丁们[1].body).toEqual({ disclosure_preferences: { education: 'never' } });
    expect(补丁们[1].headers['if-match']).toBe('"2"');
    await expect(学历卡.getByRole('button', { name: '不披露' })).toHaveClass(/分段项选中/, { timeout: 10_000 });

    // ── 屏蔽名单：选来源 → 搜组织（strict active 分页 + query 绑定游标）→ 点命中 → 屏蔽 ──
    await page.goto('/#/blocklist');
    await page.getByRole('button', { name: '关联公司' }).click();
    const 组织框 = page.getByPlaceholder('输入公司全称，如「某某科技」');
    await 组织框.fill('云衢');
    await expect(page.getByText(P3标记.可屏蔽组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(P3标记.可屏蔽组织乙, { exact: true })).toBeVisible();
    // 停用组织永不进结果（strict active），第一页两枚后跟翻页键
    await expect(page.getByText(P3标记.停用组织)).toHaveCount(0);
    const 搜索请求 = 请求们.filter((项) => 项.path === '/api/v1/organizations').at(-1);
    expect(decodeURIComponent(搜索请求?.query ?? '')).toContain('q=云衢');
    expect(decodeURIComponent(搜索请求?.query ?? '')).toContain('limit=20');

    await page.getByRole('button', { name: '加载更多' }).click();
    await expect(page.getByText(P3标记.可屏蔽组织丙, { exact: true })).toBeVisible({ timeout: 10_000 });
    const 翻页请求 = 请求们.filter((项) => 项.path === '/api/v1/organizations').at(-1)!;
    expect(翻页请求.query).toContain('cursor=');

    await page.getByRole('button', { name: P3标记.可屏蔽组织甲 }).click();
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    await expect(page.getByText(`已屏蔽 ${P3标记.可屏蔽组织甲}，双向不可见`)).toBeVisible({ timeout: 10_000 });

    const 屏蔽写们 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks' && 项.method === 'POST');
    expect(屏蔽写们.length).toBe(1);
    expect(屏蔽写们[0].body).toEqual({ organization_id: 'org-fixture-p3-block-a', source: 'related_organization' });
    expect(屏蔽写们[0].headers['if-match']).toBe('"3"');
    const 首把幂等键 = 屏蔽写们[0].headers['idempotency-key'];
    expect(首把幂等键).toBeTruthy();
    // 关联公司归入「建档时自动屏蔽」组（分组按 来源，不按理由文案）
    await expect(page.getByText('建档时自动屏蔽')).toBeVisible();
    await expect(page.getByText('你手动添加')).toHaveCount(0);

    // ── 解除建档来源：必须带 risk_acknowledged=true ──
    await page.getByRole('button', { name: '解除' }).click();
    await expect(page.getByText(`解除对「${P3标记.可屏蔽组织甲}」的屏蔽？`)).toBeVisible();
    await expect(page.getByText('这是你的当前雇主或其关联公司，解除意味着放弃这层保密。')).toBeVisible();
    await page.getByRole('button', { name: '确认解除' }).click();
    await expect(page.getByText(`已解除对 ${P3标记.可屏蔽组织甲} 的屏蔽`)).toBeVisible({ timeout: 10_000 });
    const 解除们 = 请求们.filter((项) => 项.path.startsWith('/api/v1/me/privacy/organization-blocks/') && 项.path.endsWith('/unblock'));
    expect(解除们.length).toBe(1);
    expect(解除们[0].path).toContain('/org-fixture-p3-block-a/');
    expect(解除们[0].body).toEqual({ risk_acknowledged: true });
    expect(解除们[0].headers['if-match']).toBe('"4"');
    await expect(page.getByRole('button', { name: '解除' })).toHaveCount(0, { timeout: 10_000 });

    // ── 手动来源：加入与解除都不需要风险确认（risk_acknowledged=false）──
    await page.getByRole('button', { name: '手动添加' }).click();
    await 组织框.fill('磐石');
    await expect(page.getByText(P3标记.手动组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: P3标记.手动组织甲 }).click();
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    await expect(page.getByText(`已屏蔽 ${P3标记.手动组织甲}，双向不可见`)).toBeVisible({ timeout: 10_000 });
    expect(请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks' && 项.method === 'POST').length).toBe(2);
    const 手动写 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks' && 项.method === 'POST')[1];
    expect((手动写.body as { source?: string }).source).toBe('manual');
    expect(手动写.headers['idempotency-key']).toBeTruthy();
    expect(手动写.headers['idempotency-key']).not.toBe(首把幂等键);
    await expect(page.getByText('你手动添加')).toBeVisible();

    await page.getByRole('button', { name: '解除' }).click();
    await page.getByRole('button', { name: '确认解除' }).click();
    await expect(page.getByText(`已解除对 ${P3标记.手动组织甲} 的屏蔽`)).toBeVisible({ timeout: 10_000 });
    const 手动解除 = 请求们.filter((项) => 项.path.startsWith('/api/v1/me/privacy/organization-blocks/') && 项.path.endsWith('/unblock'))[1];
    expect((手动解除.body as { risk_acknowledged?: boolean }).risk_acknowledged).toBe(false);
    expect(手动解除.headers['if-match']).toBe('"6"');

    // ── 切招聘方：固定组织水合链，候选侧隐私先行清空 ──
    await page.goto('/#/identity?switch=1&from=app');
    await expect(page.getByRole('button', { name: '翻到「招聘方」那一面' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    const 切换后链 = 请求们.map((项) => `${项.method} ${项.path}`);
    // P6 并行水合的 recruiter 规则/提案读与组织链并发起跑；先滤掉再断言固定组织链
    const 组织链 = 切换后链.filter((项) => !项.startsWith('GET /api/v1/recruiter/agent-rule'));
    const 偏好位 = 组织链.indexOf('PUT /api/v1/me/preferences/last-used-role');
    expect(偏好位).toBeGreaterThanOrEqual(0);
    // 唯一 verified 关系自动选中 ⇒ 固定链含一次公开企业直读；owner Jobs 收尾
    expect(组织链.slice(偏好位 + 1, 偏好位 + 5)).toEqual([
      'GET /api/v1/recruiter/profile',
      'GET /api/v1/recruiter/affiliations',
      `GET /api/v1/organizations/${P1C标记.组织甲编号}`,
      'GET /api/v1/recruiter/jobs',
    ]);

    // ── 发布岗位：POST body 带完整四员 hard_requirements；claim 由已验证关系推导 ──
    await 走完后端发岗向导(page);
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    const 创建 = 请求们.find((项) => 项.path === '/api/v1/recruiter/jobs' && 项.method === 'POST');
    expect(创建).toBeDefined();
    expect(创建!.headers['idempotency-key']).toBeTruthy();
    expect(创建!.body).toMatchObject({
      publisher_mode: 'direct',
      hiring_organization_claim: { display_name: P1C标记.组织甲名, legal_name: null },
    });
    const 发布硬性 = (创建!.body as { hard_requirements?: Record<string, string> }).hard_requirements ?? {};
    expect(Object.keys(发布硬性).sort()).toEqual(['alternate_weekend_work', 'frequent_travel', 'onsite_only', 'outsourcing_only']);
    for (const 档 of Object.values(发布硬性)) {
      expect(['required', 'not_required', 'unknown']).toContain(档);
    }

    // ── 编辑岗位：三态钮 未说明→必须→不要求；PATCH 回传完整四员块 + immutable 字段原值 ──
    await page.goto('/#/hr/post-job/job-fixture-created-1');
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('Fixture 实习岗位', { timeout: 10_000 });
    await page.getByRole('button', { name: '职位要求' }).click();
    const 大小周片 = page.getByRole('button', { name: '大小周 未说明' });
    await expect(大小周片).toBeVisible({ timeout: 10_000 });
    await 大小周片.click();
    await expect(page.getByRole('button', { name: '大小周 必须' })).toBeVisible();
    await page.getByRole('button', { name: '大小周 必须' }).click();
    await expect(page.getByRole('button', { name: '大小周 不要求' })).toBeVisible();

    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('岗位已保存')).toBeVisible({ timeout: 15_000 });
    const 岗位补丁 = 请求们.find(
      (项) => /^\/api\/v1\/recruiter\/jobs\/job-fixture-created-1$/.test(项.path) && 项.method === 'PATCH',
    );
    expect(岗位补丁).toBeDefined();
    expect(岗位补丁!.headers['if-match']).toBe('"1"');
    const 补丁体 = 岗位补丁!.body as {
      title: string;
      recruitment_type: string;
      category_id: string;
      location_id: string;
      hard_requirements: Record<string, string>;
    };
    // immutable 契约字段沿用 previous owner DTO 原值
    expect(补丁体.title).toBe('Fixture 实习岗位');
    expect(补丁体.recruitment_type).toBe('internship');
    expect(补丁体.category_id).toBe('job-fixture-001');
    expect(补丁体.location_id).toBe('loc-fixture-001');
    expect(补丁体.hard_requirements).toEqual({
      alternate_weekend_work: 'not_required',
      outsourcing_only: 'unknown',
      onsite_only: 'unknown',
      frequent_travel: 'unknown',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3 Backend 恢复分派 @backend：错误码驱动的重读不重放。
// 用例内通过 覆盖 seam 注入单次故障（沿用既有 att-* 计数器惯例）；需要「先见效再失败」的
// 场景直接改共享的 隐私.视图（handler 与测试同一进程同份状态）。所有等待用 expect.poll，
// 不用超过 UI debounce 的长 sleep。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P3 Backend 恢复分派 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 90_000 });

  /** 隐私 GET 总数（hydration 之后作增量基线用） */
  function 统计get(请求们: { path: string; method: string }[]): number {
    return 请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'GET').length;
  }

  test('PATCH 409 后只一次 PATCH、一次权威重读并刷新视图，绝不自动重放 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    const 请求们: 拦截请求形[] = [];
    let 冲突次数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-r409',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'PATCH /api/v1/me/privacy': () => {
          if (冲突次数 > 0) return undefined;
          冲突次数 += 1;
          // 他端并发推进了版本，还把「当前公司」改成一直允许 —— 权威视图将随重读刷新进来
          隐私.视图.revision += 1;
          隐私.视图.disclosure_preferences.current_employer = 'anonymous';
          return { status: 409, 响应: { error: { type: 'version_conflict', message: '版本冲突' } } };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const get基线 = 统计get(请求们);

    // 用户想关隐身 → PATCH 409 → 弹层保留可取消；权威快照经一次重读落进页面
    await page.goto('/#/settings');
    const 隐身开关 = page.getByRole('switch', { name: '对现雇主隐身' });
    await expect(隐身开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    await 隐身开关.click();
    await page.getByRole('button', { name: '仍要关闭' }).click();
    await expect
      .poll(() => 统计get(请求们), { timeout: 10_000 })
      .toBe(get基线 + 1); // 安全重读权威恰好一次

    // 不自动重放：此时仍然只有那一次 PATCH
    expect(统计get(请求们)).toBe(get基线 + 1);
    expect(请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'PATCH').length).toBe(1);

    await page.getByRole('button', { name: '保持开启' }).click();
    await expect(page.getByRole('button', { name: '仍要关闭' })).toHaveCount(0);
    // 刷新后的权威视图：employer_privacy_enabled 保持 true（页面仍开）
    await expect(隐身开关).toHaveAttribute('aria-checked', 'true');
    // 且他端写入的 D3=一直允许 已经在页面上（来自重读，不是本地假成功）
    await page.goto('/#/disclosure-prefs');
    const 当前公司卡 = page.locator('[class*="披露卡"]').filter({ hasText: '当前公司' });
    await expect(当前公司卡.getByRole('button', { name: '一直允许' })).toHaveClass(/分段项选中/, { timeout: 10_000 });
  });

  test('AddBlock 遇 idempotency_in_progress 同键受控重试，后续新意图换新键 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    const 幂等键们: string[] = [];
    let 故障次数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-rInProgress',
      记录目录请求: () => undefined,
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      请求拦截: ({ path, method, headers }) => {
        if (path === '/api/v1/me/privacy/organization-blocks' && method === 'POST') {
          幂等键们.push(headers['idempotency-key'] ?? '');
        }
      },
      覆盖: {
        'POST /api/v1/me/privacy/organization-blocks': () => {
          if (故障次数 > 0) return undefined; // 重试放行给内置 fixture 应答
          故障次数 += 1;
          return {
            status: 409,
            头: { 'Retry-After': '0' },
            响应: { error: { type: 'idempotency_in_progress', message: '前次相同请求仍在处理' } },
          };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    await page.goto('/#/blocklist');
    await page.getByRole('button', { name: '手动添加' }).click();
    const 组织框 = page.getByPlaceholder('输入公司全称，如「某某科技」');
    await 组织框.fill('云衢');
    await expect(page.getByText(P3标记.可屏蔽组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: P3标记.可屏蔽组织甲 }).click();
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    // 首个意图：in-progress 后同键受控重试成功；备选列表保持可见供换选
    await expect(page.getByText(`已屏蔽 ${P3标记.可屏蔽组织甲}，双向不可见`)).toBeVisible({ timeout: 10_000 });
    expect(幂等键们.length).toBe(2);
    expect(幂等键们[0]).toBe(幂等键们[1]);
    expect(幂等键们[0]).not.toBe('');

    // 新意图：成功路径清了搜索词，重新搜索后再选另一枚命中 → 新请求必须换一把 Idempotency-Key
    await 组织框.fill('云衢');
    await expect(page.getByText(P3标记.可屏蔽组织乙, { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: P3标记.可屏蔽组织乙 }).click();
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    await expect(page.getByText(`已屏蔽 ${P3标记.可屏蔽组织乙}，双向不可见`)).toBeVisible({ timeout: 10_000 });
    expect(幂等键们.length).toBe(3);
    expect(幂等键们[2]).not.toBe('');
    expect(幂等键们[2]).not.toBe(幂等键们[0]);
  });

  test('AddBlock 503 先生效后失败：权威重读确认效果，UI 不再发起第二次屏蔽 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    const 请求们: 拦截请求形[] = [];
    let 已见效 = false;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-r503block',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'POST /api/v1/me/privacy/organization-blocks': () => {
          if (!已见效) {
            已见效 = true;
            // 服务端已落库但响应丢失（operation_outcome_unknown）：先见效，之后每次都以 503 应答，
            // 让受控重试同样撞上结果未知 ⇒ 客户端只能走「重读权威核对效果」的歧义恢复路径。
            const 占位 = { organization_id: 'org-fixture-p3-manual-a' };
            隐私.视图.organization_blocks = [
              ...隐私.视图.organization_blocks,
              {
                organization_id: 占位.organization_id,
                organization_display_name: 隐私.组织库[占位.organization_id].display_name,
                organization_status: 隐私.组织库[占位.organization_id].status,
                source: 'manual',
                created_at: '2026-08-27T03:00:00Z',
              },
            ];
            隐私.视图.revision += 1;
          }
          return { status: 503, 响应: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const get基线 = 统计get(请求们);

    await page.goto('/#/blocklist');
    await page.getByRole('button', { name: '手动添加' }).click();
    const 组织框 = page.getByPlaceholder('输入公司全称，如「某某科技」');
    await 组织框.fill('磐石');
    await expect(page.getByText(P3标记.手动组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: P3标记.手动组织甲 }).click();
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();

    // 效果达成路径：按 GET 核实后按成功兑现（清词 + 成功提示）
    await expect(page.getByText(`已屏蔽 ${P3标记.手动组织甲}，双向不可见`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('你手动添加')).toBeVisible();
    await expect(page.getByText(P3标记.手动组织甲, { exact: true })).toBeVisible();
    // 歧义后的核实：恰好一次 GET 权威；同一次意图的两笔传输共用同一把幂等键（受控重试），
    // 绝无第二个新意图发出 —— 内置 handler 从未参与：唯一副作用就是覆盖里的那次手动落库
    await expect.poll(() => 统计get(请求们), { timeout: 10_000 }).toBe(get基线 + 1);
    const 覆盖期写们 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks' && 项.method === 'POST');
    await expect.poll(() => 覆盖期写们.length, { timeout: 10_000 }).toBe(2);
    expect(覆盖期写们[0].headers['idempotency-key']).toBe(覆盖期写们[1].headers['idempotency-key']);
    expect(隐私.统计.屏蔽写入).toBe(0);
  });

  test('Unblock 404 目标他端已解除：以权威视图为准视为成功，不重放解除 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture({
      organization_blocks: [
        {
          organization_id: 'org-fixture-p3-gone',
          organization_display_name: 'Fixture 他端先解企业',
          organization_status: 'active',
          source: 'manual',
          created_at: '2026-08-20T00:00:00Z',
        },
      ],
      revision: 5,
    });
    const 请求们: 拦截请求形[] = [];
    let 已报失 = false;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-r404unblock',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'POST /api/v1/me/privacy/organization-blocks/org-fixture-p3-gone/unblock': () => {
          if (已报失) return undefined;
          已报失 = true;
          // 服务端该行已被他端移除（同样推进版本），本次解除以 404 作答
          隐私.视图.organization_blocks = [];
          隐私.视图.revision += 1;
          return { status: 404, 响应: { error: { type: 'organization_block_not_found', message: '目标不存在' } } };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const get基线 = 统计get(请求们);
    await page.goto('/#/blocklist');
    await expect(page.getByText('Fixture 他端先解企业')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: '解除' }).click();
    await page.getByRole('button', { name: '确认解除' }).click();
    // 404 + 权威视图已无该组织 ⇒ 兑现为成功（提示照常出现），且恰好一次核对 GET、零重放
    await expect(page.getByText('已解除对 Fixture 他端先解企业 的屏蔽')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Fixture 他端先解企业')).toHaveCount(0, { timeout: 10_000 });
    await expect.poll(() => 统计get(请求们), { timeout: 10_000 }).toBe(get基线 + 1);
    await expect
      .poll(() => 请求们.filter((项) => 项.path.endsWith('/unblock')).length, { timeout: 10_000 })
      .toBe(1);
  });

  test('Unblock 422 风险确认：一次重读更新来源分组后原样抛出，绝不自动重放 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture({
      organization_blocks: [
        {
          organization_id: 'org-fixture-p3-flip',
          organization_display_name: P3标记.可屏蔽组织甲,
          organization_status: 'active',
          source: 'current_employer',
          created_at: '2026-08-20T00:00:00Z',
        },
      ],
      revision: 4,
    });
    const 请求们: 拦截请求形[] = [];
    let 已纠正 = false;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-r422unblock',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'POST /api/v1/me/privacy/organization-blocks/org-fixture-p3-flip/unblock': () => {
          if (已纠正) return undefined;
          已纠正 = true;
          // 存储里这条其实已经被改判为手动来源：422 要求重新确认 —— 与此同时把它落库改掉
          const 行 = 隐私.视图.organization_blocks.find((块) => 块.organization_id === 'org-fixture-p3-flip');
          if (行) 行.source = 'manual';
          隐私.视图.revision += 1;
          return { status: 422, 响应: { error: { type: 'risk_acknowledgement_required', message: '需要风险确认' } } };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const get基线 = 统计get(请求们);
    await page.goto('/#/blocklist');
    await expect(page.getByText(P3标记.可屏蔽组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: '解除' }).click();
    await page.getByRole('button', { name: '确认解除' }).click();
    // 重读把真实来源（manual）带回：行挪去「你手动添加」组、副行理由随之更新；
    // 操作本身抛回 UI ⇒ 弹层静默关闭，绝不二次 POST
    await expect(page.getByText(P3标记.可屏蔽组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('你手动加入 · 双向不可见 · 2026-08-20')).toBeVisible();
    await expect(page.getByRole('button', { name: '确认解除' })).toHaveCount(0);
    await expect.poll(() => 统计get(请求们), { timeout: 10_000 }).toBe(get基线 + 1);
    await expect
      .poll(() => 请求们.filter((项) => 项.path.endsWith('/unblock')).length, { timeout: 10_000 })
      .toBe(1);
  });

  test('组织搜索竞态：旧词晚到被代际守卫丢弃，只有新词渲染；无结果回既有空态 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture(); // 屏蔽名单为空：便于断言既有空态
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-race',
      记录目录请求: () => undefined,
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
    });
    // 搜索脚本：A 词延迟 1500ms 单枚命中并带专用游标；B 词即时命中无游标
    隐私.搜索脚本.push(
      {
        词: '云端矩阵',
        延迟毫秒: 1500,
        items: [{ organization_id: 'org-fixture-race-a', display_name: '竞速先发公司A序列', legal_name: '上海竞速先发A有限公司' }],
        next_cursor: 'cur-stale-a',
      },
      {
        词: '后发制胜',
        items: [{ organization_id: 'org-fixture-race-b', display_name: '竞速后发公司B序列', legal_name: '上海竞速后发B有限公司' }],
        next_cursor: null,
      },
    );

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await page.goto('/#/blocklist');
    await expect(page.getByText('名单是空的')).toBeVisible({ timeout: 10_000 }); // 空态基线

    await page.getByRole('button', { name: '当前雇主' }).click();
    const 组织框 = page.getByPlaceholder('输入公司全称，如「某某科技」');
    await 组织框.fill('云端矩阵');
    await expect.poll(() => 隐私.搜索完成.some((项) => 项.q === '云端矩阵'), { timeout: 10_000 }).toBe(true); // 已受理（响应仍被脚本压住 1500ms）

    // 换词即作废在飞代际：B 即刻命中渲染
    await 组织框.fill('后发制胜');
    await expect(page.getByText('竞速后发公司B序列')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('竞速先发公司A序列')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '加载更多' })).toHaveCount(0); // B 无游标

    // A 此刻才应答完成 —— 也必须被代际守卫丢弃
    await expect.poll(() => 隐私.搜索已答.some((项) => 项.q === '云端矩阵'), { timeout: 10_000 }).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 120));
    await expect(page.getByText('竞速先发公司A序列')).toHaveCount(0);
    await expect(page.getByText('竞速后发公司B序列')).toBeVisible();
    await expect(page.getByRole('button', { name: '加载更多' })).toHaveCount(0);

    // 无结果页：不改变列表、空态保持既有文案
    await 组织框.fill('旧东家'); // 命中的是停用组织：strict active 口径不下发
    await expect(page.getByText('竞速后发公司B序列')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText('名单是空的')).toBeVisible();
    await expect(page.getByText(P3标记.停用组织)).toHaveCount(0);
    // 三次搜索全部终结（A/B/停用词查询都没有挂在途）
    await expect.poll(() => 隐私.搜索已答.length, { timeout: 10_000 }).toBe(3);
  });

  test('登出时挂起的隐私 GET 过期不作数：新主体只见自己的快照 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture({
      disclosure_preferences: { current_employer: 'anonymous', education: 'never', portfolio_links: 'never' },
      revision: 7,
    });
    隐私.组织库['org-fixture-p3-old'] = { display_name: 'Fixture 旧世界公司', legal_name: '上海旧世界有限公司', status: 'active' };
    隐私.视图.organization_blocks = [
      {
        organization_id: 'org-fixture-p3-old',
        organization_display_name: 'Fixture 旧世界公司',
        organization_status: 'active',
        source: 'manual',
        created_at: '2026-08-19T00:00:00Z',
      },
    ];
    const 请求们: 拦截请求形[] = [];
    let 挂起兑现: (() => void) | null = null;

    // 冲突注入放在 弹层确认后第一次 PATCH：借它的安全重读制造「挂起中的旧会话 GET」
    let 冲突次数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-stale',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'PATCH /api/v1/me/privacy': () => {
          if (冲突次数 > 0) return undefined;
          冲突次数 += 1;
          隐私.视图.revision += 1;
          return { status: 409, 响应: { error: { type: 'version_conflict', message: '版本冲突' } } };
        },
      },
    });

    // A 主体会话：旧世界公司可见
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await page.goto('/#/blocklist');
    await expect(page.getByText('Fixture 旧世界公司')).toBeVisible({ timeout: 10_000 });

    // 触发一次带挂起重读的冲突（重读将在旧会话登出后才被放行）
    await page.goto('/#/disclosure-prefs');
    const 作品卡 = page.locator('[class*="披露卡"]').filter({ hasText: '作品与代码仓库' });
    const get挂起前 = 统计get(请求们);
    隐私.get脚本.push({
      保持: new Promise<void>((resolve) => {
        挂起兑现 = resolve;
      }),
    });
    await 作品卡.getByRole('button', { name: '意向确认后' }).click();
    await expect.poll(() => 统计get(请求们), { timeout: 10_000 }).toBe(get挂起前 + 1); // 重读已发出并被挂起

    // 旧会话登出（清理同步派发），然后才放行那个迟到的旧 GET。
    // hash 直跳设置根 —— 不能整页 reload，那会让新挂载抢走队列里的挂起项
    await page.evaluate(() => {
      window.location.hash = '#/settings';
    });
    await expect(page.getByText('隐私与可见性')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '退出登录' }).first().click();
    await page.getByRole('button', { name: '退出登录' }).last().click();
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
    挂起兑现?.();

    // 服务端换成 B 主体的权威事实后再登录
    隐私.视图 = {
      employer_privacy_enabled: false,
      disclosure_preferences: { current_employer: 'resume_submission', education: 'resume_submission', portfolio_links: 'resume_submission' },
      organization_blocks: [
        {
          organization_id: 'org-fixture-p3-new',
          organization_display_name: 'Fixture 新世界公司',
          organization_status: 'active',
          source: 'current_employer',
          created_at: '2026-08-27T04:00:00Z',
        },
      ],
      revision: 42,
      updated_at: '2026-08-27T04:00:00Z',
    };
    await page.getByLabel('手机号').fill('13900000002');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '进入' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 登录建立会话后整页恢复一次：mount 会话恢复链才会按 last_used_role 水合三域（含隐私）
    await page.reload();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // B 主体自己的水合读取了自己的快照；旧世界的任何痕迹都不再出现
    const 完成位 = 请求们.findIndex((项) => 项.method === 'POST' && 项.path.endsWith('/complete') && 项.path.includes('/login-attempts/'));
    expect(完成位).toBeGreaterThanOrEqual(0);
    const 登录后隐私位 = 请求们.findIndex((项, 序) => 序 > 完成位 && 项.path === '/api/v1/me/privacy' && 项.method === 'GET');
    expect(登录后隐私位).toBeGreaterThanOrEqual(0); // 新会话水合再次带上隐私 GET
    await page.goto('/#/blocklist');
    await expect(page.getByText('Fixture 新世界公司')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Fixture 旧世界公司')).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3 Mock 数据源隔离 @mock：隐私相关四屏访问且本地流照常工作，同时
// 全程 /api/v1 请求列表保持为空 —— Mock 模式对 P3 域零网络调用。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P3 Mock 数据源隔离 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('Mock 四屏本地流程零 API 请求 @mock', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    // 登录（Mock 一键直进）
    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // 设置：本地开关切换立即生效，无网络
    await page.goto('/#/settings');
    await expect(page.getByText('隐私与可见性')).toBeVisible({ timeout: 10_000 });
    const 别的开关 = page.getByRole('switch', { name: '求职状态' }).first();
    if (await 别的开关.isVisible().catch(() => false)) {
      const 开前 = await 别的开关.getAttribute('aria-checked');
      await 别的开关.click();
      await expect(别的开关).toHaveAttribute('aria-checked', 开前 === 'true' ? 'false' : 'true');
    }
    // 对现雇主隐身在 Mock 同样可切（本地归约）：初始为开时需过确认弹层
    const 隐身开关 = page.getByRole('switch', { name: '对现雇主隐身' });
    if ((await 隐身开关.getAttribute('aria-checked')) === 'true') {
      await 隐身开关.click();
      await page.getByRole('button', { name: '仍要关闭' }).click();
      await expect(隐身开关).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 });
    } else {
      await 隐身开关.click();
      await expect(隐身开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
      await 隐身开关.click(); // 再关回去同样要确认弹层
      await page.getByRole('button', { name: '仍要关闭' }).click();
      await expect(隐身开关).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 });
    }
    expect(apiRequests).toEqual([]);

    // 披露偏好：D4 本地切档（Mock 七行模板照旧展示并可点）
    await page.goto('/#/disclosure-prefs');
    const 学历卡 = page.locator('[class*="披露卡"]').filter({ hasText: '毕业院校与学历' });
    await expect(学历卡.getByRole('button', { name: '一直允许' })).toBeVisible({ timeout: 10_000 });
    await 学历卡.getByRole('button', { name: '不披露' }).click();
    await expect(学历卡.getByRole('button', { name: '不披露' })).toHaveClass(/分段项选中/, { timeout: 10_000 });
    expect(apiRequests).toEqual([]);

    // 屏蔽名单：自由文本本地加入（Mock 无组织搜索段）
    await page.goto('/#/blocklist');
    const 添加框 = page.getByPlaceholder('输入公司全称，如「某某科技」');
    await expect(添加框).toBeVisible({ timeout: 10_000 });
    await 添加框.fill('本地测试屏蔽公司');
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    await expect(page.getByText('已屏蔽 本地测试屏蔽公司，双向不可见')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('本地测试屏蔽公司').first()).toBeVisible();
    expect(apiRequests).toEqual([]);

    // 发岗屏（Mock 本地向导）：到达 + 第一步本地校验照常运转
    await page.goto('/#/hr/post-job');
    const 岗位名框 = page.getByPlaceholder(/资深后端工程师/);
    await expect(岗位名框).toBeVisible({ timeout: 10_000 });
    await 岗位名框.fill('本地草稿岗位');
    await expect(岗位名框).toHaveValue('本地草稿岗位');
    // Mock 目录选择的类别（非硬性条件区也保持本地可选）
    await page.getByRole('button', { name: '实习生 在校生实习，按天计薪' }).click();

    // 全程累计：Mock 模式下没有任何 /api/v1 请求 —— P3 域也是纯本地
    expect(apiRequests).toEqual([]);
  });
});

// P6 规则域 fixture @backend —— Agent 规则/提案全生命周期（intercepted boundary only）。
// 断言以 fixture 存证的变更回执（body / If-Match / Idempotency-Key）为主，
// 可见文案只做收口佐证；标记值只存在于 fixture，上屏即证明渲染来自 HTTP。
// ─────────────────────────────────────────────────────────────────────────────

/** 就绪提案卡的正文 div 与动作键同属一张卡：正文唯一文本的父节点即卡，卡内恰一组动作键。 */
function 就绪卡动作键(page: Page, 正文: string, 名称: string) {
  return page.getByText(正文).locator('..').getByRole('button', { name: 名称 });
}

test.describe('P6 规则域 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 60_000 });

  test('P6 全链路：双端规则生命周期与请求契约 @backend', async ({ page }) => {
    // 冻结序列：candidate restore → 双端水合 → global create→accept → 意向 create →
    // 替换(If-Match) → 归档(If-Match) → 切招聘端 → 招聘 create(no scope)→accept → pause/resume 版本推进
    test.setTimeout(150_000);
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-life',
      记录目录请求: () => undefined,
      // 招聘端水合需要组织域 fixture；主体同时具备双角色，切身份走真实 PUT 角色链
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'candidate',
    });

    // ── candidate restore：session 200 + last_used_role=candidate → 直接落求职主壳 ──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });

    // ── candidate Rule/Proposal 水合：标记值只存在于 fixture ──
    await page.goto('/#/rules');
    await expect(page.getByText(P6标记.候选全局规则)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P6标记.候选意向规则)).toBeVisible();
    await expect(page.getByText('2 条')).toBeVisible();
    await expect(page.getByText('AI代理正在理解这条规则…')).toBeVisible();
    await expect(page.getByText(P6标记.就绪提案正文)).toBeVisible();
    // auto_deny 的安全摘要逐字来自 fixture 的 consequence，页面不做任何浏览器侧可接受性判定
    await expect(page.getByText('命中条件时，AI代理会自动拦下')).toBeVisible();
    // 解读中提案在第二次单项 GET 转 ready（轮询 2s 一拍 → 两次读 ≈ 4s）
    await expect(page.getByText(P6标记.解读完成正文)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('符合条件时，AI代理可以自动推进')).toBeVisible();
    expect(p6.proposalReads[P6编号.解释中提案]).toBeGreaterThanOrEqual(2);

    // ── global create → interpreting → ready → accept → active Rule ──
    await page.getByRole('button', { name: '手动添加规则' }).click();
    const 候选输入 = page.getByPlaceholder('例：不接受大小周的岗位直接过滤');
    await 候选输入.fill(P6标记.全局新建草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    // 创建回执是 interpreting：卡片先出「解读中」，成功才收起输入行
    await expect(候选输入).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText(`已理解：${P6标记.全局新建草稿}`)).toBeVisible({ timeout: 20_000 });
    // accept-success fixture 的公开 consequence 是 mixed
    await expect(page.getByText('这条规则同时包含推进、拦截或参考条件')).toBeVisible();
    await 就绪卡动作键(page, `已理解：${P6标记.全局新建草稿}`, '确认规则').click();
    // 确认后权威 Rule 才物化：正文从卡片变成规则行（按钮）
    await expect(page.getByRole('button', { name: new RegExp(`已理解：${P6标记.全局新建草稿}`) })).toBeVisible({ timeout: 15_000 });
    const 创建全局 = p6.mutationRequests.find((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals');
    expect(创建全局).toBeDefined();
    expect(创建全局!.body).toEqual({ text: P6标记.全局新建草稿, scope: { type: 'global' } });
    expect(创建全局!.ifMatch).toBeNull();
    expect(创建全局!.idempotencyKey).toMatch(/\S/);

    // ── intention create：范围选择发的是 fixture 的真实 intention_id ──
    await page.getByRole('button', { name: '手动添加规则' }).click();
    await page.getByLabel('规则范围').selectOption(P6标记.意向编号);
    await page.getByPlaceholder('例：不接受大小周的岗位直接过滤').fill(P6标记.意向新建草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    await expect(page.getByText(`已理解：${P6标记.意向新建草稿}`)).toBeVisible({ timeout: 20_000 });
    const 创建意向 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals')[1];
    expect(创建意向).toBeDefined();
    expect(创建意向!.body).toEqual({
      text: P6标记.意向新建草稿,
      scope: { type: 'intention', intention_id: P6标记.意向编号 },
    });
    expect(创建意向!.idempotencyKey).toMatch(/\S/);

    // ── replacement：发当前 If-Match；确认前旧 Rule 一直可见、新正文不是规则行 ──
    await page.getByRole('button', { name: new RegExp(P6标记.候选全局规则) }).click();
    // 编辑态下规则库只有这一只输入框（composer 已收起），草稿预填原文
    const 编辑框 = page.getByRole('textbox');
    await expect(编辑框).toHaveCount(1, { timeout: 10_000 });
    await expect(编辑框).toHaveValue(P6标记.候选全局规则);
    await 编辑框.fill(P6标记.替换草稿);
    await page.getByRole('button', { name: '提交修改' }).click();
    await expect(page.getByText(`已理解：${P6标记.替换草稿}`)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(P6标记.候选全局规则)).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(`已理解：${P6标记.替换草稿}`) })).toHaveCount(0);
    const 替换回执 = p6.mutationRequests.find((项) => 项.path === `/api/v1/me/agent-rules/${P6编号.候选全局规则}/replacement-proposals`);
    expect(替换回执).toBeDefined();
    expect(替换回执!.ifMatch).toBe('"1"');
    expect(替换回执!.body).toEqual({ text: P6标记.替换草稿, scope: { type: 'global' } });
    expect(替换回执!.idempotencyKey).toMatch(/\S/);
    await 就绪卡动作键(page, `已理解：${P6标记.替换草稿}`, '确认规则').click();
    await expect(page.getByRole('button', { name: new RegExp(`已理解：${P6标记.替换草稿}`) })).toBeVisible({ timeout: 15_000 });
    // 旧规则归档出局：原文整行（含卡片）消失
    await expect(page.getByText(P6标记.候选全局规则)).toHaveCount(0);

    // ── archive：DELETE 带当前 If-Match ──
    await page.getByRole('button', { name: new RegExp(`已理解：${P6标记.替换草稿}`) }).click();
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.getByRole('button', { name: new RegExp(`已理解：${P6标记.替换草稿}`) })).toHaveCount(0, { timeout: 10_000 });
    const 删除们 = p6.mutationRequests.filter((项) => 项.method === 'DELETE');
    expect(删除们.length).toBe(1);
    expect(删除们[0]!.ifMatch).toBe('"1"');
    expect(删除们[0]!.path).toMatch(/^\/api\/v1\/me\/agent-rules\/rul_[0-9a-f]{32}$/);
    await expect(page.getByText('2 条')).toBeVisible();

    // ── 切到招聘端：真实 PUT 角色 + 偏好链，切完直接进企业主壳 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });

    // ── recruiter：规则水合 + create（body 永不携带 scope）→ accept ──
    await page.goto('/#/hr/agent-settings');
    await expect(page.getByText(P6标记.招聘全局规则)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('1 条生效')).toBeVisible();
    const 总开关 = page.getByRole('switch', { name: `规则：${P6标记.招聘全局规则}` });
    await expect(总开关).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: '手动添加规则' }).click();
    await page.getByPlaceholder('例：到岗超过 60 天的候选先不推进').fill(P6标记.招聘新建草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    await expect(page.getByText(`已理解：${P6标记.招聘新建草稿}`)).toBeVisible({ timeout: 20_000 });
    const 招聘创建 = p6.mutationRequests.find((项) => 项.method === 'POST' && 项.path === '/api/v1/recruiter/agent-rule-proposals');
    expect(招聘创建).toBeDefined();
    expect(招聘创建!.body).toEqual({ text: P6标记.招聘新建草稿 });
    expect(招聘创建!.idempotencyKey).toMatch(/\S/);
    await 就绪卡动作键(page, `已理解：${P6标记.招聘新建草稿}`, '确认规则').click();
    // 招聘端规则行没有编辑按钮：权威落地以行内容 + 开关为准
    await expect(page.getByRole('switch', { name: `规则：已理解：${P6标记.招聘新建草稿}` })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('2 条生效')).toBeVisible();
    const 招聘接受 = p6.mutationRequests.find((项) => 项.path.startsWith('/api/v1/recruiter/agent-rule-proposals/') && 项.path.endsWith('/accept'));
    expect(招聘接受).toBeDefined();
    expect(招聘接受!.body).toEqual({});
    expect(招聘接受!.idempotencyKey).toMatch(/\S/);

    // ── pause → resume：每个应答的版本都在前进（resume 的 If-Match 就是 pause 应答的新版本）──
    await 总开关.click();
    await expect(总开关).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 });
    await expect(page.getByText('1 条生效')).toBeVisible();
    await 总开关.click();
    await expect(总开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    await expect(page.getByText('2 条生效')).toBeVisible();
    const 开关写 = p6.mutationRequests.filter((项) => 项.method === 'PATCH' && 项.path === `/api/v1/recruiter/agent-rules/${P6编号.招聘全局规则}`);
    expect(开关写.length).toBe(2);
    expect(开关写[0]!.body).toEqual({ operation: 'pause' });
    expect(开关写[0]!.ifMatch).toBe('"1"');
    expect(开关写[1]!.body).toEqual({ operation: 'resume' });
    expect(开关写[1]!.ifMatch).toBe('"2"');
    // 权威版本链落到 fixture：pause 1→2、resume 2→3
    expect(p6.rules.recruiter.find((规) => 规.rule_id === P6编号.招聘全局规则)?.version).toBe(3);

    // 幂等纪律：两次 candidate 创建是两个意图 → 两把不同的 key；accept 一律空对象 body + 非 key
    const 候选创建们 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals');
    expect(候选创建们.length).toBe(2);
    expect(候选创建们[0]!.idempotencyKey).not.toBe(候选创建们[1]!.idempotencyKey);
    const 候选接受们 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path.includes('/me/') && 项.path.endsWith('/accept'));
    expect(候选接受们.length).toBe(2);
    for (const 项 of 候选接受们) {
      expect(项.body).toEqual({});
      expect(项.idempotencyKey).toMatch(/\S/);
    }
  });

  test('P6 版本冲突只做一次权威重读且零重放 @backend', async ({ page }) => {
    // PATCH 专用冲突规则 409 version_conflict：effect 没有 receipt，恢复只做一轮权威 Rule 重读
    // （两页翻页 = 不带 cursor 的首页 GET 恰好一次），绝不再发 mutation；开关原样保留。
    const 请求序: string[] = [];
    const 清单读取: { url: string; ms: number }[] = [];
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-conflict',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'recruiter',
      P6分支: {
        追加规则们: [{
          规则: P6规则({
            rule_id: P6分支编号.冲突规则,
            display_text: P6标记.冲突规则,
            scope: { type: 'global' },
          }),
          分支: '写入冲突',
        }],
      },
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });
    // 清单读取带完整 URL（cursor 参数区分翻页），补丁时间戳用来只数 PATCH 之后的读取
    page.on('request', (请求) => {
      const 地址 = new URL(请求.url());
      if (地址.pathname === '/api/v1/recruiter/agent-rules' && 请求.method() === 'GET') {
        清单读取.push({ url: 地址.pathname + 地址.search, ms: Date.now() });
      }
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.goto('/#/hr/agent-settings');
    const 冲突开关 = page.getByRole('switch', { name: `规则：${P6标记.冲突规则}` });
    await expect(冲突开关).toBeVisible({ timeout: 15_000 });
    await expect(冲突开关).toHaveAttribute('aria-checked', 'true');

    const 点击时刻 = Date.now();
    await 冲突开关.click();
    await expect(page.getByText('数据已在其他地方更新，请重试')).toBeVisible({ timeout: 10_000 });
    await expect(冲突开关).toHaveAttribute('aria-checked', 'true');
    const 补丁键 = `PATCH /api/v1/recruiter/agent-rules/${P6分支编号.冲突规则}`;
    const 补丁位 = 请求序.lastIndexOf(补丁键);
    expect(补丁位).toBeGreaterThanOrEqual(0);
    // 零重放：PATCH 只发出过一次
    expect(请求序.filter((项) => 项 === 补丁键).length).toBe(1);
    // 一次权威重读：PATCH 之后带 cursor 的翻页请求恰一轮（首页 GET 恰好一次）
    await expect.poll(() => 清单读取.filter((项) => 项.ms >= 点击时刻 && !项.url.includes('cursor=')).length, { timeout: 5_000 }).toBe(1);
    // 回执存证：If-Match 是水合时的当前版本
    const 冲突写 = p6.mutationRequests.find((项) => 项.path === `/api/v1/recruiter/agent-rules/${P6分支编号.冲突规则}`);
    expect(冲突写).toBeDefined();
    expect(冲突写!.ifMatch).toBe('"1"');
    expect(冲突写!.body).toEqual({ operation: 'pause' });
  });

  test('P6 accept 响应丢失与结果未知经权威 GET 收敛 @backend', async ({ page }) => {
    // 真·响应丢失（连接中断）：accept 已被服务端处理，客户端不重发 mutation，
    // 恢复走 GET 提案（accepted 回执）→ 完整重读 Rules；503 outcome_unknown 额外证明
    // 受控重试复用同一把 Idempotency-Key。
    test.setTimeout(120_000);
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-loss',
      记录目录请求: () => undefined,
      P6分支: {
        追加提案们: [
          {
            提案: {
              proposal_id: P6分支编号.丢失提案,
              state: 'ready',
              normalized_text: P6标记.丢失提案正文,
              consequence: 'auto_allow',
              created_at: '2026-08-26T00:00:00Z',
            },
            分支: 'accept丢失',
          },
          {
            提案: {
              proposal_id: P6分支编号.未知提案,
              state: 'ready',
              normalized_text: P6标记.未知提案正文,
              consequence: 'advisory',
              created_at: '2026-08-26T00:00:00Z',
            },
            分支: 'accept未知',
          },
        ],
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByText(P6标记.丢失提案正文)).toBeVisible({ timeout: 15_000 });

    // 响应丢失：POST 恰一次（mutation 不自动重试），权威收敛后规则行出现、卡片消失
    await 就绪卡动作键(page, P6标记.丢失提案正文, '确认规则').click();
    await expect(page.getByRole('button', { name: new RegExp(P6标记.丢失提案正文) })).toBeVisible({ timeout: 20_000 });
    await expect(就绪卡动作键(page, P6标记.丢失提案正文, '确认规则')).toHaveCount(0);
    const 丢失接受们 = p6.mutationRequests.filter((项) => 项.path === `/api/v1/me/agent-rule-proposals/${P6分支编号.丢失提案}/accept`);
    expect(丢失接受们.length).toBe(1);
    expect(p6.proposalReads[P6分支编号.丢失提案]).toBeGreaterThanOrEqual(1);

    // 结果未知：受控重试一次、两把 key 是同一把，仍 503 后同样经 GET 提案 + Rule 清单收敛
    await 就绪卡动作键(page, P6标记.未知提案正文, '确认规则').click();
    await expect(page.getByRole('button', { name: new RegExp(P6标记.未知提案正文) })).toBeVisible({ timeout: 20_000 });
    await expect(就绪卡动作键(page, P6标记.未知提案正文, '确认规则')).toHaveCount(0);
    const 未知接受们 = p6.mutationRequests.filter((项) => 项.path === `/api/v1/me/agent-rule-proposals/${P6分支编号.未知提案}/accept`);
    expect(未知接受们.length).toBe(2);
    expect(未知接受们[0]!.idempotencyKey).not.toBe('');
    expect(未知接受们[0]!.idempotencyKey).toBe(未知接受们[1]!.idempotencyKey);
    expect(p6.proposalReads[P6分支编号.未知提案]).toBeGreaterThanOrEqual(1);
  });

  test('P6 切换招聘端后迟到的候选端应答不再上屏 @backend', async ({ page }) => {
    // 首次规则清单 503 → 重试键；重试的规则清单第一页被挂起到切身份之后才应答：
    // 旧会话代际的迟到响应整包丢弃，候选端标记绝不上招聘端页面；切回候选端后完整水合照常。
    test.setTimeout(120_000);
    let 放行!: () => void;
    const 门 = new Promise<void>((ok) => { 放行 = ok; });
    const 请求序: string[] = [];
    // 切回候选端是交互式水合：隐私域缺席会按「Mock 不顶替 HTTP」边界拒绝并中断切换，故提供 fixture
    const 隐私 = P3隐私fixture();
    await 安装BFF路由(page, {
      登录尝试id: 'att-p6-stale',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      P6分支: { 规则清单首次失败: true, 挂起候选规则: 门 },
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByRole('button', { name: '规则加载失败，重试' })).toBeVisible({ timeout: 15_000 });

    // 重试：这一轮规则清单第一页被 fixture 挂起，请求横跨切身份全程
    await page.getByRole('button', { name: '规则加载失败，重试' }).click();
    await expect.poll(() => 请求序.filter((项) => 项 === 'GET /api/v1/me/agent-rules').length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

    // 切到招聘端（会话代际递增），招聘端事实先水合完成
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    await page.goto('/#/hr/agent-settings');
    await expect(page.getByText(P6标记.招聘全局规则)).toBeVisible({ timeout: 15_000 });

    // 放行迟到应答：候选端规则/提案标记一个都不出现
    放行();
    await page.waitForTimeout(1500);
    await expect(page.getByText(P6标记.招聘全局规则)).toBeVisible();
    await expect(page.getByText(P6标记.候选全局规则)).toHaveCount(0);
    await expect(page.getByText(P6标记.候选意向规则)).toHaveCount(0);
    await expect(page.getByText(P6标记.就绪提案正文)).toHaveCount(0);

    // 切回候选端：新代际的完整水合不受迟到应答影响
    await page.goto('/#/identity?switch=1&from=hr');
    await page.getByRole('button', { name: '翻到「求职者」那一面' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/rules');
    await expect(page.getByText(P6标记.候选全局规则)).toBeVisible({ timeout: 15_000 });
  });

  test('P6 失败提案卡显示固定文案，失败保留草稿可再提交 @backend', async ({ page }) => {
    // 专用提案单项 GET 即 failed：固定失败文案 + 关闭；创建失败（500）时草稿与范围原样保留，
    // 再次提交是新意图、新 key。
    test.setTimeout(120_000);
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-failed',
      记录目录请求: () => undefined,
      P6分支: {
        追加提案们: [{
          提案: { proposal_id: P6分支编号.失败提案, state: 'interpreting', created_at: '2026-08-26T00:00:00Z' },
          分支: '单读失败',
        }],
        创建前几次失败: 1,
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByText('AI代理正在理解这条规则…').first()).toBeVisible({ timeout: 15_000 });

    // 轮询读到权威 failed → 固定失败文案；关闭只收起这一张卡
    await expect(page.getByText('这条规则暂时无法理解，请换一种说法')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page.getByText('这条规则暂时无法理解，请换一种说法')).toHaveCount(0);

    // 创建失败：composer 不收起，草稿/范围原样保留（绝不伪造成功）
    await page.getByRole('button', { name: '手动添加规则' }).click();
    const 候选输入 = page.getByPlaceholder('例：不接受大小周的岗位直接过滤');
    await 候选输入.fill(P6标记.失败草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    await expect(page.getByText(P6标记.创建失败提示)).toBeVisible({ timeout: 10_000 });
    await expect(候选输入).toHaveValue(P6标记.失败草稿);
    await expect(page.getByLabel('规则范围')).toHaveValue('');

    // 再次提交：新意图、新 key，创建成功才收起输入行
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    await expect(候选输入).toHaveCount(0, { timeout: 10_000 });
    const 创建们 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals');
    expect(创建们.length).toBe(2);
    expect(创建们[0]!.body).toEqual({ text: P6标记.失败草稿, scope: { type: 'global' } });
    expect(创建们[1]!.body).toEqual({ text: P6标记.失败草稿, scope: { type: 'global' } });
    expect(创建们[0]!.idempotencyKey).not.toBe('');
    expect(创建们[0]!.idempotencyKey).not.toBe(创建们[1]!.idempotencyKey);
  });

  test('P6 重复 cursor 按契约漂移失败出服务异常重试，不回退 Mock @backend', async ({ page }) => {
    // 清单游标成环 → 解码器按翻页死循环拒绝，rules 域整体失败：
    // 重试键上屏、无清单/无计数/无写控件，Mock 种子绝不顶替 HTTP。
    await 安装BFF路由(page, {
      登录尝试id: 'att-p6-cursor',
      记录目录请求: () => undefined,
      P6分支: { 游标成环: true },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByRole('button', { name: '规则加载失败，重试' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('规则加载中')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '手动添加规则' })).toHaveCount(0);
    await expect(page.getByText('2 条')).toHaveCount(0);
    await expect(page.getByText(P6标记.候选全局规则)).toHaveCount(0);
    await expect(page.getByText(P6标记.候选意向规则)).toHaveCount(0);
    await expect(page.getByText('不主动披露并行接触数量')).toHaveCount(0);
    await expect(page.getByText('双休是底线；隔周六可谈，大小周不谈')).toHaveCount(0);
  });

  test('P6 首次水合挂起期间无任何规则内容与写入口 @backend', async ({ page }) => {
    // 规则清单第一页被挂起：初始化完成前整壳只有路由加载中 ——
    // Mock 种子行 / 计数 / 写控件 / 重试键都不上屏；放行后权威行与计数一并落地。
    test.setTimeout(120_000);
    let 放行!: () => void;
    const 门 = new Promise<void>((ok) => { 放行 = ok; });
    await 安装BFF路由(page, {
      登录尝试id: 'att-p6-pending',
      记录目录请求: () => undefined,
      P6分支: { 挂起候选规则: 门 },
    });

    await page.goto('/#/rules');
    await expect(page.getByText('正在加载…')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('不主动披露并行接触数量')).toHaveCount(0);
    await expect(page.getByText('双休是底线；隔周六可谈，大小周不谈')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '手动添加规则' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '规则加载失败，重试' })).toHaveCount(0);

    放行();
    await expect(page.getByText(P6标记.候选全局规则)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P6标记.候选意向规则)).toBeVisible();
    await expect(page.getByText('2 条')).toBeVisible();
  });

  test('P6 accept 409 not_actionable 权威恢复保留卡片 @backend', async ({ page }) => {
    // 专用提案公开 consequence 是 auto_allow（看起来完全可执行），服务端仍裁决 not_actionable：
    // 公开后果从不决定可执行性 —— 恢复路径读权威回执，卡片保留、绝不本地物化规则、零重放。
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-not-actionable',
      记录目录请求: () => undefined,
      P6分支: {
        追加提案们: [{
          提案: {
            proposal_id: P6分支编号.不可接受提案,
            state: 'ready',
            normalized_text: P6标记.不可接受提案正文,
            consequence: 'auto_allow',
            created_at: '2026-08-26T00:00:00Z',
          },
          分支: 'accept不可接受',
        }],
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByText(P6标记.不可接受提案正文)).toBeVisible({ timeout: 15_000 });

    await 就绪卡动作键(page, P6标记.不可接受提案正文, '确认规则').click();
    await expect(page.getByText('这条内容暂时不能成为长期规则，请放弃或换一种说法')).toBeVisible({ timeout: 10_000 });
    // 权威恢复：GET 回执仍是 ready → 卡片原样保留，规则计数不变、没有规则行被物化
    await expect(page.getByText(P6标记.不可接受提案正文)).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(P6标记.不可接受提案正文) })).toHaveCount(0);
    await expect(page.getByText('2 条')).toBeVisible();
    const 接受们 = p6.mutationRequests.filter((项) => 项.path === `/api/v1/me/agent-rule-proposals/${P6分支编号.不可接受提案}/accept`);
    expect(接受们.length).toBe(1);
    expect(p6.proposalReads[P6分支编号.不可接受提案]).toBeGreaterThanOrEqual(1);
  });
});
