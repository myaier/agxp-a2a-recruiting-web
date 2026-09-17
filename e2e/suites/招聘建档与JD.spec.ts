// e2e/suites/招聘建档与JD.spec.ts
// C6：原「招聘方 onboarding Backend fixture / JD 建议稿导入 Backend fixture」迁入；
// JD 大链路按 C4 拆为「授权/提交/轮询/建议合并」与「使用导入建议经真实目录与确认后发布」
// 两个独立 Case（后者以合法已完成导入 fixture 起步）。
// 本 Suite 家族另含 e2e/onboarding.spec.ts 的招聘侧叶子（文件级并集，见该文件头）。

import { expect, test } from '../fixtures/test';
import { 抽屉搜企业并选中, 走完后端发岗向导, 装三级职位目录桩 } from '../fixtures/数据源交互';
import { 标记 } from '../fixtures/bff/账号与目录';
import { P1C标记, 创建招聘方OnboardingFixture, P1C组织甲 } from '../fixtures/bff/招聘组织';
import { P3隐私fixture, P1C搜索池 } from '../fixtures/bff/隐私与实名';
import { 安装BFF路由 } from '../fixtures/bff/安装BFF路由';
import { type 拦截请求形 } from '../fixtures/bff/协议';

// ─────────────────────────────────────────────────────────────────────────────
// 招聘方 onboarding Backend fixture @backend（P0 修复 Task 7）：全新招聘方从身份选择页
// 起步 —— profile 首读 404 not_found（合法的「缺失」而非故障），名片首写走
// PATCH + If-Match: "0"（fixture 按自己的当前 revision 做 CAS），发岗写出三段独立
// 非空文本，刷新后从权威 HTTP 事实（profile revision 1 + owner Jobs）重新水合。
// 这条 fixture 是独立对象：不与候选 onboarding fixture 共享或复位任何状态。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('招聘方 onboarding Backend fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('新招聘方 onboarding：404 首写、完整发岗与刷新恢复 @backend', async ({ page }) => {
    const fixture = 创建招聘方OnboardingFixture();
    // 合同 C：名片公司自报经 公司选择抽屉 选中组织甲 —— 搜索池供搜索，
    // organizations 供发岗向导按档案 ref 读回公开企业（默认选中行）
    fixture.organizations[P1C标记.组织甲编号] = P1C组织甲();
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    const requests: 拦截请求形[] = [];
    const jobCreateStatuses: number[] = [];
    const profileReadStatuses: number[] = [];
    page.on('response', (response) => {
      if (response.request().method() === 'POST' && response.url().endsWith('/api/v1/recruiter/jobs')) {
        jobCreateStatuses.push(response.status());
      }
      if (response.request().method() === 'GET' && response.url().endsWith('/api/v1/recruiter/profile')) {
        profileReadStatuses.push(response.status());
      }
    });
    await 安装BFF路由(page, {
      登录尝试id: 'att-new-recruiter-onboarding',
      记录目录请求: () => undefined,
      主体初始角色: null,
      招聘方OnboardingFixture: fixture,
      隐私fixture: 隐私,
      请求拦截: (request) => requests.push(request),
    });
    // 发布岗位的职位类别走真三级目录（一级自动展开 → 二级标题 + 三级叶子）
    await 装三级职位目录桩(page);

    await page.goto('/');
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '我要招人' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
    expect(profileReadStatuses[0]).toBe(404);

    await page.getByLabel('姓名').fill('林澈');
    await page.getByLabel('职务').fill('招聘负责人');
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 20_000 });

    const profileWrite = fixture.mutations.find((item) => item.path === '/api/v1/recruiter/profile');
    expect(profileWrite).toEqual(expect.objectContaining({
      method: 'PATCH',
      ifMatch: '"0"',
      body: { public_name: '林澈', title: '招聘负责人', organization_ref: P1C标记.组织甲编号 },
    }));
    expect(fixture.profile).toEqual(expect.objectContaining({ revision: 1 }));

    await 走完后端发岗向导(page);
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

    const jobWrite = fixture.mutations.find((item) => item.path === '/api/v1/recruiter/jobs');
    expect(jobWrite).toBeDefined();
    expect(jobWrite!.body).toMatchObject({
      publisher_organization_ref: 'org-fixture-p3-manual-a',
      hiring_organization_ref: 'org-fixture-p3-manual-a',
      description: '用户研究、产品验证、产品策略、实验、数据分析、需求执行、GTM、发布与增长',
      requirements: '应届或毕业年级；有产品、技术、增长、分析或创业经历；关注 AI、SaaS、工作流、开发工具与 Agent',
    });
    expect(jobCreateStatuses).toEqual([201]);
    expect(fixture.ownerJobs).toHaveLength(1);

    await page.reload();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await expect(page.getByText('Fixture 实习岗位')).toBeVisible();
    expect(requests.filter((item) => item.path === '/api/v1/recruiter/profile' && item.method === 'GET').length)
      .toBeGreaterThanOrEqual(2);
    expect(profileReadStatuses).toContain(200);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// JD PDF 建议稿导入 fixture @backend（2026-09-03）。
// 拦截式验证浏览器到 HTTP 的形状：consent 前零 POST；POST 202 恰两个 multipart part
// （file: application/pdf + processing_consent_confirmed:"true"）与 jd-import- 幂等键；
// GET 按返回的 jdi_* 串行轮询（processing → succeeded）；快照合并只填未改字段；
// 类别只走轻提示、城市只进搜索框，Catalog 引用仍由用户真实选择；解析本身不产生
// Job POST。这条 E2E 只证明前端接线，不证明目标后端已部署 handoff 提交。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('JD 建议稿导入 Backend fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  // C4 拆分：授权/提交/串行轮询/建议合并由第一条实际覆盖；第二条以「合法已完成导入」
  // 的 fixture 快照起步（GET 首拍即 succeeded），只重走合并入口与发布链——发布仍须经
  // 真实 Catalog 城市选择与确认门，不只填最终结果。
  test('JD 导入授权与轮询：consent 前零 POST，202 + 串行轮询后快照合并（未改字段才被替换） @backend', async ({ page }) => {
    const fixture = 创建招聘方OnboardingFixture();
    // 合同 C：名片公司自报经 公司选择抽屉 选中组织甲；organizations 供发岗向导按 ref 读回默认行
    fixture.organizations[P1C标记.组织甲编号] = P1C组织甲();
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-jd-import',
      记录目录请求: () => undefined,
      主体初始角色: null,
      招聘方OnboardingFixture: fixture,
      隐私fixture: 隐私,
    });
    // 发布岗位的职位类别走真三级目录（一级自动展开 → 二级标题 + 三级叶子）
    await 装三级职位目录桩(page);

    // 登录进发岗页（新招聘方 onboarding 同链：名片首写 → 保存并继续）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '我要招人' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
    await page.getByLabel('姓名').fill('林澈');
    await page.getByLabel('职务').fill('招聘负责人');
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 20_000 });

    // ── JD 导入路由（注册晚于 安装BFF路由 的通配路由，优先生效）──
    const 导入ID = 'jdi_0123456789abcdef0123456789abcdef';
    const 元数据 = { request_id: 'fixture-req', api_version: 'v1' as const };
    const 建议稿 = {
      title: 'Fixture JD 资深后端工程师',
      recruitment_type: null,
      workplace_mode: 'remote',
      office_location: null,
      description: 'Fixture JD 描述（用户改过就不该出现）',
      requirements: 'Fixture JD 要求（五年以上后端）',
      education_requirement: 'bachelor',
      experience_requirement: 'five_plus_years',
      category_source_name: '后端开发',
      location_source_name: 'fixture',
      keywords: ['Fixture 关键词'],
    };
    const 基础 = {
      import_id: 导入ID,
      created_at: '2026-09-03T01:02:03Z',
    };
    let POST数 = 0;
    const POST状态: number[] = [];
    page.on('response', (响应) => {
      if (响应.url().endsWith('/api/v1/recruiter/job-draft-imports') && 响应.request().method() === 'POST') {
        POST状态.push(响应.status());
      }
    });
    await page.route('**/api/v1/recruiter/job-draft-imports', async (route) => {
      expect(route.request().method()).toBe('POST');
      POST数 += 1;
      const headers = route.request().headers();
      expect(headers['idempotency-key']).toMatch(/^jd-import-.{36}$/);
      const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
      expect(body).toContain('name="file"; filename="synthetic-jd.pdf"');
      expect(body).toContain('Content-Type: application/pdf');
      expect(body).toContain('name="processing_consent_confirmed"');
      expect(body).toContain('true');
      expect(body).not.toContain('display_name');
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ result: { ...基础, status: 'pending', updated_at: '2026-09-03T01:02:03Z' }, meta: 元数据 }),
      });
    });
    let GET数 = 0;
    await page.route(`**/api/v1/recruiter/job-draft-imports/${导入ID}`, async (route) => {
      expect(route.request().method()).toBe('GET');
      GET数 += 1;
      const 结果 = GET数 === 1
        ? { ...基础, status: 'processing', updated_at: '2026-09-03T01:02:05Z' }
        : { ...基础, status: 'succeeded', updated_at: '2026-09-03T01:02:07Z', suggestion: 建议稿 };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: 结果, meta: 元数据 }),
      });
    });

    // ── 第一步先就绪（标题/办公方式/类别），快照里这些是用户已知值 ──
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await page.getByPlaceholder(/资深后端工程师/).fill('上传前标题');
    await page.getByRole('button', { name: '混合', exact: true }).click();
    await 职位类别行.click();
    // 一级自动展开：整层只有一枚三级叶子按钮，直接点它即回填并关闭
    const 类键 = page.getByRole('button', { name: 标记.职位display, exact: true });
    await expect(类键).toHaveCount(1, { timeout: 10_000 });
    await 类键.click();
    await expect(page.getByRole('dialog', { name: '职位类别' })).toHaveCount(0, { timeout: 10_000 });

    // ── 取消一轮：consent 取消零 POST ──
    await page.getByRole('button', { name: /把 JD 给我/ }).click();
    const JD文件 = page.getByLabel('上传 JD 文件');
    await JD文件.setInputFiles({
      name: 'synthetic-jd.pdf', mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nfixture jd\n'),
    });
    await expect(page.getByText('允许 AI 识别这份职位描述？')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    expect(POST数).toBe(0);

    // ── 真正导入：consent 后恰一次 POST 202 ──
    await page.getByRole('button', { name: /把 JD 给我/ }).click();
    await JD文件.setInputFiles({
      name: 'synthetic-jd.pdf', mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nfixture jd\n'),
    });
    await expect(page.getByText('允许 AI 识别这份职位描述？')).toBeVisible();
    expect(POST数).toBe(0); // consent 前零 mutation
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect.poll(() => POST数).toBe(1);

    // ── 解析期间表单可编辑：进第二步改描述（保护用例）──
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('职位描述').fill('用户等待时写的描述');

    // ── 轮询到 succeeded（pending → processing → succeeded 两拍，约 6 秒）──
    await expect.poll(() => GET数, { timeout: 20_000 }).toBe(2);
    expect(POST状态).toEqual([202]);
    // 类别建议只走现有轻提示（无常驻节点）
    await expect(page.getByText('AI 识别的职位类别是「后端开发」，请手动选择')).toBeVisible();
    // 解析本身不产生 Job POST
    expect(fixture.mutations.find((项) => 项.path === '/api/v1/recruiter/jobs')).toBeUndefined();
    // 等待期间改过的描述保留（建议合并不得覆盖用户已改字段）
    await expect(page.getByLabel('职位描述')).toHaveValue('用户等待时写的描述');

    // ── 未改的标题被建议替换；横幅进入终局；全远程清空并禁用办公地点（原位不隐藏）──
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page.getByText('已识别，请检查建议')).toBeVisible();
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue(建议稿.title);
    // 选中快捷片的 accessible name 带 ✓ 前缀，用包含匹配
    await expect(page.getByRole('button', { name: /全远程/ })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    const 办公地框 = page.getByPlaceholder(/浦东新区世纪大道/);
    // 全远程建议把方式切到「全远程」并清空地址；当前合同下地址输入仍可用、变选填
    await expect(办公地框).toBeEnabled();
    await expect(办公地框).toHaveValue('');
  });

  test('JD 导入建议发布：已完成导入快照起步，城市走真实 Catalog、确认门后才发布 @backend', async ({ page }) => {
    const fixture = 创建招聘方OnboardingFixture();
    // 合同 C：名片公司自报经 公司选择抽屉 选中组织甲；organizations 供发岗向导按 ref 读回默认行
    fixture.organizations[P1C标记.组织甲编号] = P1C组织甲();
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-jd-publish',
      记录目录请求: () => undefined,
      主体初始角色: null,
      招聘方OnboardingFixture: fixture,
      隐私fixture: 隐私,
    });
    // 发布岗位的职位类别走真三级目录（一级自动展开 → 二级标题 + 三级叶子）
    await 装三级职位目录桩(page);

    // 登录进发岗页（新招聘方 onboarding 同链：名片首写 → 保存并继续）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '我要招人' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
    await page.getByLabel('姓名').fill('林澈');
    await page.getByLabel('职务').fill('招聘负责人');
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 20_000 });

    // ── JD 导入路由（注册晚于 安装BFF路由 的通配路由，优先生效）──
    const 导入ID = 'jdi_0123456789abcdef0123456789abcdef';
    const 元数据 = { request_id: 'fixture-req', api_version: 'v1' as const };
    const 建议稿 = {
      title: 'Fixture JD 资深后端工程师',
      recruitment_type: null,
      workplace_mode: 'remote',
      office_location: null,
      description: 'Fixture JD 描述（用户改过就不该出现）',
      requirements: 'Fixture JD 要求（五年以上后端）',
      education_requirement: 'bachelor',
      experience_requirement: 'five_plus_years',
      category_source_name: '后端开发',
      location_source_name: 'fixture',
      keywords: ['Fixture 关键词'],
    };
    const 基础 = {
      import_id: 导入ID,
      created_at: '2026-09-03T01:02:03Z',
    };
    let POST数 = 0;
    const POST状态: number[] = [];
    page.on('response', (响应) => {
      if (响应.url().endsWith('/api/v1/recruiter/job-draft-imports') && 响应.request().method() === 'POST') {
        POST状态.push(响应.status());
      }
    });
    await page.route('**/api/v1/recruiter/job-draft-imports', async (route) => {
      expect(route.request().method()).toBe('POST');
      POST数 += 1;
      const headers = route.request().headers();
      expect(headers['idempotency-key']).toMatch(/^jd-import-.{36}$/);
      const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
      expect(body).toContain('name="file"; filename="synthetic-jd.pdf"');
      expect(body).toContain('Content-Type: application/pdf');
      expect(body).toContain('name="processing_consent_confirmed"');
      expect(body).toContain('true');
      expect(body).not.toContain('display_name');
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ result: { ...基础, status: 'pending', updated_at: '2026-09-03T01:02:03Z' }, meta: 元数据 }),
      });
    });
    let GET数 = 0;
    await page.route(`**/api/v1/recruiter/job-draft-imports/${导入ID}`, async (route) => {
      expect(route.request().method()).toBe('GET');
      GET数 += 1;
      // 合法已完成导入快照：首拍即 succeeded（授权与轮逯节奏由上一条 Case 覆盖）
      const 结果 = { ...基础, status: 'succeeded', updated_at: '2026-09-03T01:02:07Z', suggestion: 建议稿 };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: 结果, meta: 元数据 }),
      });
    });

    // ── 第一步先就绪（标题预置，验证建议替换的是未改字段）──
    // ── 第一步先就绪（标题/办公方式/类别），快照里这些是用户已知值 ──
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await page.getByPlaceholder(/资深后端工程师/).fill('上传前标题');
    await page.getByRole('button', { name: '混合', exact: true }).click();
    await 职位类别行.click();
    // 一级自动展开：整层只有一枚三级叶子按钮，直接点它即回填并关闭
    const 类键 = page.getByRole('button', { name: 标记.职位display, exact: true });
    await expect(类键).toHaveCount(1, { timeout: 10_000 });
    await 类键.click();
    await expect(page.getByRole('dialog', { name: '职位类别' })).toHaveCount(0, { timeout: 10_000 });

    // ── 走正常 consent 入口拿到导入状态（不手填结果；解析节奏由上一条 Case 覆盖）──
    await page.getByRole('button', { name: /把 JD 给我/ }).click();
    const JD文件 = page.getByLabel('上传 JD 文件');
    await JD文件.setInputFiles({
      name: 'synthetic-jd.pdf', mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nfixture jd\n'),
    });
    await expect(page.getByText('允许 AI 识别这份职位描述？')).toBeVisible();
    expect(POST数).toBe(0); // consent 前零 mutation
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect.poll(() => POST数).toBe(1);
    // 已完成导入：首拍 GET 即带建议稿的 succeeded
    await expect.poll(() => GET数, { timeout: 20_000 }).toBe(1);
    expect(POST状态).toEqual([202]);
    // 解析本身不产生 Job POST
    expect(fixture.mutations.find((项) => 项.path === '/api/v1/recruiter/jobs')).toBeUndefined();


    // ── 合并入口照常走：本 Case 一直停在第一步，succeeded 后横幅与建议替换原地生效 ──
    await expect(page.getByText('已识别，请检查建议')).toBeVisible();
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue(建议稿.title);
    await expect(page.getByRole('button', { name: /全远程/ })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
    // 第二步：合并已把未改的描述填成建议稿原文（未改→建议填充方向）；用户此时改写，
    // 发布 body 的「用户改过字段存活」与 canary（建议稿描述）缺席由最后一段断言承载
    await expect(page.getByLabel('职位描述')).toHaveValue(建议稿.description);
    await page.getByLabel('职位描述').fill('用户改写的发布描述');
    await page.getByRole('button', { name: '下一步' }).click();
    const 办公地框 = page.getByPlaceholder(/浦东新区世纪大道/);
    await expect(办公地框).toBeEnabled();
    await expect(办公地框).toHaveValue('');


    // ── 城市源文本只进子视图搜索框（打开时作初词）：先补齐薪资/年薪月数，再验证发布被城市门禁拦下 ──
    await page.getByRole('button', { name: '薪资下限' }).click();
    const 月薪层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await 月薪层.getByRole('button', { name: '输入金额' }).click();
    await 月薪层.getByLabel('薪资下限').fill('50');
    await 月薪层.getByLabel('薪资上限').fill('65');
    await 月薪层.getByRole('button', { name: '确定' }).click();
    await expect(月薪层).toHaveCount(0);
    await page.getByRole('button', { name: /年薪月数/ }).click();
    await page.getByRole('button', { name: '确定' }).click();
    await page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ }).check();
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page.getByText('请从候选城市中选择')).toBeVisible();
    expect(fixture.mutations.find((项) => 项.path === '/api/v1/recruiter/jobs')).toBeUndefined();
    // 打开全页城市子视图：JD 源文本 'fixture' 作为本次搜索初词；点真实候选取得
    // 地点引用 并保存回填，此时才具备 Job POST 的城市坐标
    await page.getByRole('button').filter({ hasText: '工作城市' }).click();
    const 城市搜索框 = page.getByPlaceholder('搜索城市 / 省份');
    await expect(城市搜索框).toHaveValue('fixture');
    await page.getByRole('button', { name: 标记.城市display, exact: true }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(城市搜索框).toHaveCount(0);
    // 职位要求由建议填入（未改字段）；描述是用户在第二步改写的原文
    await expect(page.getByLabel('岗位要求')).toHaveValue(建议稿.requirements);
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

    const 岗位写入 = fixture.mutations.find((项) => 项.path === '/api/v1/recruiter/jobs');
    expect(岗位写入).toBeDefined();
    expect(岗位写入!.body).toMatchObject({
      title: 建议稿.title,
      // 用户改写的描述存活到发布；canary（建议稿.description = 'Fixture JD 描述（用户改过
      // 就不该出现）'）按精确匹配被证缺席
      description: '用户改写的发布描述',
      requirements: 建议稿.requirements,
      workplace_mode: 'remote',
      office_location: '',
      category_id: 'job-fixture-001',
      location_id: 'loc-fixture-001',
      // direct 双 ref 来自名片保存的 organization_ref 按 ID 读回的默认行
      publisher_organization_ref: P1C标记.组织甲编号,
      hiring_organization_ref: P1C标记.组织甲编号,
    });
    // 轮询收口：succeeded 终局后不再读
    expect(GET数).toBe(1);
    expect(POST数).toBe(1);
  });
});
