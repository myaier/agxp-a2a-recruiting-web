// e2e/suites/求职意向.spec.ts
// C6：原「核心编辑 意向薪资 / 候选私有筛选要求 / 核心编辑 城市 / 核心编辑 期望行业」
//（@mock/@backend 成对）等价迁入。

import { expect, test } from '../fixtures/test';
import { hash直达 } from '../fixtures/数据源交互';
import { 信封 } from '../fixtures/bff/协议';
import { fixture简历, fixture意向列表 } from '../fixtures/bff/账号与目录';
import { P4深克隆 } from '../fixtures/bff/发现推荐';
import { P3隐私fixture } from '../fixtures/bff/隐私与实名';
import { Onboarding标记, 创建候选OnboardingFixture, 断言意向写入 } from '../fixtures/bff/候选建档';
import { 安装BFF路由 } from '../fixtures/bff/安装BFF路由';
import { type BFFOwnerIntention } from '../../src/数据/BFF契约';

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 意向薪资 @backend（core editors §6.2 Task 2）：存量 14 薪社招区间意向
// 切兼职并保存 —— 路由层断言真实序列化的 PATCH body 不携带目标类型禁止的
// annual_salary_months（月薪区间原样保留），权威回执后重入编辑页回读保存值。
// PATCH 由 覆盖 应答（fixture 只建模本用例需要的字段），body 闭合校验复用
// 断言意向写入。网络桩 route fixture 边界验证，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 意向薪资 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('存量14薪社招意向切兼职：序列化 body 不含年薪月数，保存/重入闭环 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话：last_used_role 已落 candidate；简历与 active 意向满足建档完备判据，
    // 预置合同内合法的 14 薪社招月薪区间（年薪月数只对 social_full_time/campus 合法）
    fixture.主体.last_used_role = 'candidate';
    // 存量日常会话按冻结决策返回 candidate 已完成（与 P1/展示字段接线的主页用例同口径）：
    // 登录落点按完成事实进主壳，而不是被未完成分流送回学生分流
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    const 意向编号 = Onboarding标记.意向编号;
    const 意向14薪: BFFOwnerIntention = {
      ...P4深克隆(fixture意向列表.intentions[0]),
      intention_id: 意向编号,
      compensation: { mode: 'range', lower: 20, upper: 30, annual_salary_months: 14 },
    };
    fixture.intentions = [意向14薪];
    const 意向补丁们: { body: unknown; ifMatch: string | null }[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-intent-salary',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
      请求拦截: (请求) => {
        if (请求.path === `/api/v1/me/intentions/${意向编号}` && 请求.method === 'PATCH') {
          断言意向写入(请求.body); // 12 键闭合契约对真实序列化 body 生效
          意向补丁们.push({ body: 请求.body, ifMatch: 请求.headers['if-match'] ?? null });
        }
      },
      覆盖: {
        [`PATCH /api/v1/me/intentions/${意向编号}`]: () => {
          // 服务端语义：PATCH 后同源列表读到已更新快照（目标类型不适用字段清空、
          // 不再携带年薪月数、revision+1）；salary_period 沿用本 stub 的月薪口径
          const 更新后: BFFOwnerIntention = {
            ...P4深克隆(意向14薪),
            recruitment_type: 'part_time',
            graduation_month: null,
            internship_months: null,
            onsite_days_per_week: null,
            compensation: { mode: 'range', lower: 20, upper: 30 },
            revision: 2,
          };
          fixture.intentions = [更新后];
          return { status: 200, 响应: P4深克隆(更新后) };
        },
      },
    });

    // 日常入口：登录落主壳（初始化收口后才出路由），再进意向编辑
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, `/#/intentions/${意向编号}`);
    // 编辑表单按权威 DTO 预填：月薪 20-30K，兼职未选中
    await expect(page.getByText('20-30K')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '兼职' })).toHaveAttribute('aria-pressed', 'false');
    // 切兼职（月→月不清上下限的既有行为）→ 保存
    await page.getByRole('button', { name: '兼职' }).click();
    await expect(page.getByRole('button', { name: '兼职' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    // 保存链路收口（PATCH → 权威列表重读 → 清草稿 → 返回落主壳）完成后才重入，
    // 否则重入时的 开意向草稿 会被仍在收尾的 清意向草稿 覆盖成空表
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });

    // 恰好一次 PATCH：If-Match 用权威 revision；真实序列化 body 目标类型 part_time，
    // compensation 精确为月薪区间、不含禁止的 annual_salary_months
    expect(意向补丁们).toHaveLength(1);
    const 补丁 = 意向补丁们[0]!;
    expect(补丁.ifMatch).toBe(`"${意向14薪.revision}"`);
    const 写 = 补丁.body as { recruitment_type: string; compensation: Record<string, unknown> };
    expect(写.recruitment_type).toBe('part_time');
    expect(写.compensation).toEqual({ mode: 'range', lower: 20, upper: 30 });
    expect(写.compensation).not.toHaveProperty('annual_salary_months');
    // fixture 已按服务端语义推进：权威快照不再携带年薪月数
    expect(fixture.intentions[0]?.recruitment_type).toBe('part_time');
    expect(fixture.intentions[0]?.compensation).not.toHaveProperty('annual_salary_months');

    // 权威回读后重入编辑页：兼职选中、月薪区间不丢、无实习条件区
    await hash直达(page, `/#/intentions/${意向编号}`);
    await expect(page.getByText('20-30K')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '兼职' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('实习可用时间')).toHaveCount(0);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 候选私有筛选要求 @backend（Task 2）：由意向管理打开现有意向，整段编辑／清空
// 「给 AI 代理的筛选要求」文本区 → 保存（PATCH + If-Match revision）→ 刷新回读。
// 断言真实序列化的 PATCH body：private_preferences 逐字透传（前导换行 / 尾空格 /
// 超 200 字不截断）、清空显式落 ''、exclusions 与其他字段保留。被测写入全部经浏览器
// UI 完成，不用 API 直接造数；网络桩 route fixture 边界验证，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('候选私有筛选要求 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('意向管理进入编辑：改写/清空筛选要求保存，PATCH 逐字落盘、revision 推进、其余字段保留 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话（与核心编辑用例同口径）：登录落主壳后由意向管理进入编辑
    fixture.主体.last_used_role = 'candidate';
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    const 意向编号 = Onboarding标记.意向编号;
    // 历史原文：前导换行 + 尾随空格 + 超 200 字；exclusions 非缺省（证明文本编辑不动它）
    const 历史原文 = `\n${'重视成长与团队透明沟通，希望参与有真实用户的产品。'.repeat(9)}  `;
    const 原始排除 = {
      alternate_weekend_work: 'excluded',
      outsourcing_only: 'allowed',
      onsite_only: 'unspecified',
      frequent_travel: 'excluded',
    } as const;
    const 原始意向: BFFOwnerIntention = {
      ...P4深克隆(fixture意向列表.intentions[0]),
      intention_id: 意向编号,
      exclusions: { ...原始排除 },
      private_preferences: 历史原文,
    };
    fixture.intentions = [P4深克隆(原始意向)];
    const 意向补丁们: { body: unknown; ifMatch: string | null }[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-screening-text',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
      请求拦截: (请求) => {
        if (请求.path === `/api/v1/me/intentions/${意向编号}` && 请求.method === 'PATCH') {
          断言意向写入(请求.body); // 12 键闭合契约对真实序列化 body 生效
          意向补丁们.push({ body: 请求.body, ifMatch: 请求.headers['if-match'] ?? null });
        }
      },
      覆盖: {
        [`PATCH /api/v1/me/intentions/${意向编号}`]: (body) => {
          // 服务端语义：PATCH 后同源列表读到已更新文本、revision+1，其余字段原样
          const 写 = body as { private_preferences: string };
          const 当前 = fixture.intentions[0]!;
          const 更新后: BFFOwnerIntention = {
            ...P4深克隆(原始意向),
            private_preferences: 写.private_preferences,
            revision: 当前.revision + 1,
          };
          fixture.intentions = [更新后];
          return { status: 200, 响应: P4深克隆(更新后) };
        },
      },
    });

    // 日常入口：登录落主壳（初始化收口后才出路由），再由意向管理打开现有意向
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, '/#/intentions');
    const 意向行 = page.getByRole('button', { name: /Fixture 工程师/ });
    await expect(意向行).toBeVisible({ timeout: 15_000 });
    await 意向行.click();

    // 编辑表单按权威 DTO 预填：历史私有文本整段回显（前导换行/尾空格/超 200 字不截断）
    const 筛选输入 = page.getByLabel('给 AI 代理的筛选要求');
    await expect(筛选输入).toHaveValue(历史原文, { timeout: 15_000 });

    // 改写整段（粘贴多行长文本）→ 保存
    const 改写文本 = `\n${'更看重团队透明沟通与代码评审文化，拒绝形式化加班。'.repeat(9)}  `;
    await 筛选输入.fill(改写文本);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    // 保存链路收口（PATCH → 权威列表重读 → 清草稿 → 返回）完成后才刷新：
    // 回到意向管理且路由落定，避免与在途的同文档导航/权威重读竞态
    await expect(page).toHaveURL(/#\/intentions$/, { timeout: 20_000 });
    await expect(意向行).toBeVisible({ timeout: 20_000 });

    // 恰好一次 PATCH：If-Match 用权威 revision；真实序列化 body 文本逐字透传且
    // exclusions / 薪资结构 / 目录引用等其他字段原样保留
    expect(意向补丁们).toHaveLength(1);
    const 第一次 = 意向补丁们[0]!;
    expect(第一次.ifMatch).toBe(`"${原始意向.revision}"`);
    const 写1 = 第一次.body as {
      private_preferences: string;
      exclusions: Record<string, string>;
      compensation: Record<string, unknown>;
      job_category_id: string;
      primary_location_id: string;
      workplace_modes: string[];
    };
    expect(写1.private_preferences).toBe(改写文本);
    expect(写1.private_preferences.length).toBeGreaterThan(200);
    expect(写1.exclusions).toEqual(原始排除);
    expect(写1.compensation).toEqual({ mode: 'range', lower: 30, upper: 50, annual_salary_months: 15 });
    expect(写1.job_category_id).toBe('job-fixture-001');
    expect(写1.primary_location_id).toBe('loc-fixture-001');
    expect(写1.workplace_modes).toEqual(['onsite']);

    // 刷新回读：权威列表已推进（revision 2 + 新文本），重开编辑页文本区回显改写后的整段
    await page.reload();
    await expect(意向行).toBeVisible({ timeout: 20_000 });
    await 意向行.click();
    await expect(筛选输入).toHaveValue(改写文本, { timeout: 15_000 });

    // 清空 → 保存：显式落 ''（不回落历史文本），exclusions 与其他字段第二次原样透传
    await 筛选输入.fill('');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/intentions$/, { timeout: 20_000 });
    await expect(意向行).toBeVisible({ timeout: 20_000 });
    expect(意向补丁们).toHaveLength(2);
    const 第二次 = 意向补丁们[1]!;
    expect(第二次.ifMatch).toBe('"2"');
    const 写2 = 第二次.body as { private_preferences: string; exclusions: Record<string, string>; compensation: Record<string, unknown> };
    expect(写2.private_preferences).toBe('');
    expect(写2.exclusions).toEqual(原始排除);
    expect(写2.compensation).toEqual({ mode: 'range', lower: 30, upper: 50, annual_salary_months: 15 });

    // 刷新回读：清空后的编辑页文本区为空串
    await page.reload();
    await expect(意向行).toBeVisible({ timeout: 20_000 });
    await 意向行.click();
    await expect(筛选输入).toHaveValue('', { timeout: 15_000 });
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 城市 @mock（core editors §5.1 Task 3）：其他感兴趣城市两模式共用正文 ——
// Mock 行政分组（城市字典省份组切片 + 列表尾「加载更多」）、拼音子串搜索、9 上限，
// 无 A–Z 字母索引条；取消不写草稿、保存才写回并在行上回显。全程零 /api/v1 请求。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 城市 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('行政分组正文：选择→翻页→搜索→取消→保存回显，全程零 API @catalog-fullscreen @mock', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);

    // 「添加求职期望」→ 其他感兴趣城市行 → 城市子页（共用正文）
    await hash直达(page, '/#/intentions/new');
    await expect(page.getByText('其他感兴趣城市（0/9）')).toBeVisible({ timeout: 15_000 });
    await page.getByText('请选择更多感兴趣城市').click();
    await expect(page.getByRole('heading', { name: '选择城市' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('0/9')).toBeVisible();
    // 行政分组标题上屏；A–Z 字母索引条消失
    await expect(page.getByText('广东')).toBeVisible();
    await expect(page.getByText('浙江')).toBeVisible();
    await expect(page.getByRole('button', { name: /跳到 / })).toHaveCount(0);

    // 正常态截图（与改前拍对照：旧稿 A–Z 分节 + 右侧字母索引条）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-城市-正常.png`, fullPage: true });

    // 选择热门区杭州 → 计数 1/9；翻页把更多省份组切进来
    // （catalog-fullscreen Task 6：精选热门显示名已是目录规范名「杭州市」，旧名只是别名）
    await page.getByRole('button', { name: '杭州市', exact: true }).first().click();
    await expect(page.getByText('1/9')).toBeVisible();
    await page.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(page.getByText('湖北')).toBeVisible({ timeout: 10_000 });

    // 搜索：拼音子串命中，已选不丢（选中城片的可访问名带 CSS ::before 的「✓ 」前缀）
    await page.getByPlaceholder('搜索城市名/拼音').fill('hang');
    await expect(page.getByRole('button', { name: /^✓ ?杭州市$/ }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '移除 杭州市' })).toBeVisible();

    // 取消：✕ 关闭不写草稿，回到行上仍是 0/9
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page).toHaveURL(/#\/intentions\/new$/, { timeout: 10_000 });
    await expect(page.getByText('其他感兴趣城市（0/9）')).toBeVisible({ timeout: 15_000 });

    // 重进选择两城：选中态截图 + iPhone 13 viewport 检查，保存才写回
    await page.getByText('请选择更多感兴趣城市').click();
    await expect(page.getByText('0/9')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '杭州市', exact: true }).first().click();
    await page.getByRole('button', { name: '苏州市', exact: true }).first().click();
    await expect(page.getByText('2/9')).toBeVisible();
    await expect(page.getByRole('button', { name: '移除 杭州市' })).toBeVisible();
    await expect(page.getByRole('button', { name: '移除 苏州市' })).toBeVisible();
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-城市-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 搜索输入 = page.getByPlaceholder('搜索城市名/拼音');
    await 搜索输入.focus();
    await expect(搜索输入).toBeFocused();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();

    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/intentions\/new$/, { timeout: 10_000 });
    await expect(page.getByText('其他感兴趣城市（2/9）')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('杭州市、苏州市')).toBeVisible();

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 城市 @backend（core editors §5.1 Task 3）：Backend 分支迁移到同一共用正文 ——
// 热门区来自不带 q 的默认目录页，分组标题只用返回的 admin1_name，位置区是已批准的
// 「暂未获取定位」缺失态；列表尾「加载更多」翻默认页/搜索页；按 ID 选择、取消不写草稿、
// 保存写 意向草稿.感兴趣城市引用们 且重进回读不丢。Location 目录用本用例专用网络桩
// （后装的 route 先匹配，不改共享 helper）；符合已审合同的网络桩边界验证，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 城市 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('默认页行政分组→翻页→搜索→取消→保存回读，引用按 ID 不丢 @backend', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话：last_used_role 已落 candidate；简历与 active 意向满足建档完备判据
    fixture.主体.last_used_role = 'candidate';
    // 存量日常会话按冻结决策返回 candidate 已完成（与 P1/展示字段接线的主页用例同口径）：
    // 登录落点按完成事实进主壳，而不是被未完成分流送回学生分流
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    // 目录请求记录用页面监听：Location 目录桩是后装 route（先匹配），共享 helper 的
    // 记录钩子在本用例里不会被触发，不能用它计数
    const 目录请求: string[] = [];
    page.on('request', (request) => {
      const 路径 = new URL(request.url()).pathname;
      if (路径.startsWith('/api/v1/catalog/')) 目录请求.push(路径);
    });
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-cities',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
    });

    // Location 目录桩（本用例专用精确状态）：默认页两省两城 + 游标；翻页第三城；搜索按 q。
    // 分组按 admin1_code 聚合（标题取 admin1_name），浙江 33 / 江苏 32 各归其省。
    // 字段形状与既有 /catalog/locations 内置桩一致（信封闭合解码）。
    const 省份城 = (id: string, 名称: string, 省: string, 码: string) => ({
      id,
      display_name: 名称,
      country_code: 'CN',
      country_name: '中国',
      admin1_code: 码,
      admin1_name: 省,
      timezone: 'Asia/Shanghai',
      population: 1000,
    });
    await page.route('**/api/v1/catalog/locations*', async (route) => {
      const url = new URL(route.request().url());
      const q = url.searchParams.get('q') ?? '';
      const cursor = url.searchParams.get('cursor');
      if (q !== '') {
        await route.fulfill({
          status: 200,
          json: 信封({ items: [省份城('loc-shaoxing', '绍兴市', '浙江省', '33')], next_cursor: null, catalog_version: 'loc-v1' }),
        });
        return;
      }
      if (cursor === 'loc-cur-1') {
        await route.fulfill({
          status: 200,
          json: 信封({ items: [省份城('loc-ningbo', '宁波市', '浙江省', '33')], next_cursor: null, catalog_version: 'loc-v1' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [省份城('loc-hangzhou', '杭州市', '浙江省', '33'), 省份城('loc-suzhou', '苏州市', '江苏省', '32')],
          next_cursor: 'loc-cur-1',
          catalog_version: 'loc-v1',
        }),
      });
    });

    // 登录落主壳 → 直接进城市子页（共用正文，Backend 控制）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, '/#/intentions/cities');
    await expect(page.getByRole('heading', { name: '选择城市' })).toBeVisible({ timeout: 15_000 });
    // 热门区来自默认页返回项；分组标题只用 admin1_name；位置区是已批准缺失态；无字母索引
    await expect(page.getByRole('button', { name: '杭州市', exact: true }).first()).toBeVisible();
    await expect(page.getByText('浙江省')).toBeVisible();
    await expect(page.getByText('江苏省')).toBeVisible();
    await expect(page.getByText('暂未获取定位')).toBeVisible();
    await expect(page.getByRole('button', { name: /跳到 / })).toHaveCount(0);
    await expect(page.getByText('0/9')).toBeVisible();

    // 正常态截图
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-城市-正常.png`, fullPage: true });

    // 选择杭州市 → 1/9；列表尾「加载更多」翻出第二页宁波市
    await page.getByRole('button', { name: '杭州市', exact: true }).first().click();
    await expect(page.getByText('1/9')).toBeVisible();
    await page.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(page.getByRole('button', { name: '宁波市', exact: true })).toBeVisible({ timeout: 10_000 });

    // 搜索：绍兴市入搜索列表；已选不丢
    await page.getByPlaceholder('搜索城市名/拼音').fill('绍兴');
    await expect(page.getByRole('button', { name: '绍兴市', exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '移除 杭州市' })).toBeVisible();
    await page.getByRole('button', { name: '绍兴市', exact: true }).click();
    await expect(page.getByText('2/9')).toBeVisible();

    // 选中态截图 + iPhone 13 viewport 检查：无横向溢出、搜索可聚焦、保存不被遮挡
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-城市-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 搜索输入 = page.getByPlaceholder('搜索城市名/拼音');
    await 搜索输入.focus();
    await expect(搜索输入).toBeFocused();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();

    // 取消：✕ 关闭不写草稿；重进为空（0/9 无 chip）
    // C4（review r1）：取消不再用固定 400ms sleep 掩盖时序。核实产品侧：Backend 城市选中
    // 只落本页 React state（无网络草稿写；草稿仅 保存 时同步派发），其收尾的可观察条件
    // 就是同一 state 渲染出的计数 —— 上方「2/9」可见与「保存」可见即选中已收尾的可观察
    // 等待，关闭前无需再等。疑似取消/草稿写竞态仍按 README「已知事项」记录（不改产品）。
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 10_000 });
    await hash直达(page, '/#/intentions/cities');
    await expect(page.getByText('0/9')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '移除 杭州市' })).toHaveCount(0);

    // 选择并保存：草稿引用写入；重进回读不丢
    await expect(page.getByRole('button', { name: '杭州市', exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: '杭州市', exact: true }).first().click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 10_000 });
    await hash直达(page, '/#/intentions/cities');
    await expect(page.getByText('1/9')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '移除 杭州市' })).toBeVisible();

    // 本会话目录请求只打 locations（默认页不带 q，已由钩子单测钉住）
    expect(目录请求.length).toBeGreaterThan(0);
    expect(目录请求.every((p) => p === '/api/v1/catalog/locations')).toBe(true);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 期望行业 @mock（core editors §5.2 Task 7）：选期望行业页两模式共用
// 期望行业选择正文 —— Mock 沿本地 行业字典 作模拟目录（推荐一级片可切换、手风琴组行
// 展开细分片多选、3 项上限后未选片禁用变灰、已选片再点移除）。选择即写意向草稿
//（原业务，保存只负责返回），返回重入计数与勾选保留。全程零 /api/v1 请求。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 期望行业 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('推荐+展开选满3项：返回重入保留、第4项禁用、已选片移除后回显 @mock', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);

    // 「添加求职期望」→ 期望行业行 → 行业子页（共用正文，本地 行业字典 作模拟目录）
    await hash直达(page, '/#/intentions/new');
    await expect(page.getByRole('button', { name: /期望行业/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /期望行业/ }).click();
    await expect(page.getByRole('heading', { name: '已选行业' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('0/3')).toBeVisible();
    // picker 统一 Task 1：推荐区按 Plan 删除，页面只剩手风琴 6 组行
    await expect(page.getByText('推荐')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /智能硬件 \/ 制造/ })).toBeVisible();

    // 正常态截图（与改前拍对照：原 Mock 行业页同版式同控件）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-期望行业-正常.png`, fullPage: true });

    // 展开互联网平台组选两个细分 + 展开云计算组选一级叶子 → 3/3（推荐片已删除；
    // 选中勾由共用 行业分类列表 行内渲染，折叠态由 Task 5 的 @picker 用例专门覆盖）
    await page.getByRole('button', { name: /互联网平台/ }).click();
    await page.getByRole('button', { name: '电商与交易', exact: true }).click();
    await expect(page.getByText('1/3')).toBeVisible();
    await expect(page.getByRole('button', { name: /电商与交易 ✓/ })).toBeVisible();
    await page.getByRole('button', { name: '本地生活', exact: true }).click();
    await expect(page.getByText('2/3')).toBeVisible();
    await page.getByRole('button', { name: /云计算 \/ 基础软件/ }).click();
    await page.getByRole('button', { name: '数据库', exact: true }).click();
    await expect(page.getByText('3/3')).toBeVisible();
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-期望行业-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);

    // 上限态：组行仍可展开，未选细分片禁用（沿原页：上限不锁手风琴展开）
    await page.getByRole('button', { name: /企业服务 \/ SaaS/ }).click();
    await expect(page.getByRole('button', { name: '协同办公', exact: true })).toBeDisabled();
    const 保存键 = page.getByRole('button', { name: '保存', exact: true });
    await 保存键.focus();
    await expect(保存键).toBeFocused();

    // 保存（沿原业务：保存只负责返回）→ 行文本回显三选
    await 保存键.click();
    await expect(page).toHaveURL(/#\/intentions\/new$/, { timeout: 10_000 });
    await expect(page.getByText('电商与交易、本地生活、数据库')).toBeVisible({ timeout: 15_000 });

    // 重入：3/3 与勾选保留（已选不依赖可见项；显式展开含已选的组行看勾）
    await page.getByRole('button', { name: /期望行业/ }).click();
    await expect(page.getByText('3/3')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /互联网平台/ }).click();
    await expect(page.getByRole('button', { name: /电商与交易 ✓/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /本地生活 ✓/ })).toBeVisible();
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-期望行业-重入.png`, fullPage: true });

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 期望行业 @backend（core editors §5.2 Task 7）：Backend 分支消费同一共用正文 ——
// 根/子/孙三层目录、各层「加载更多」、selectable 叶子按稳定 ID 写 期望行业们+行业引用们、
// 非 selectable 子项点击走展开不混成写入、可选根推荐片可直接选定；3 项上限后未选片禁用；
// 保存（返回）后重入草稿不丢，已选不依赖当前可见项（翻页翻走的已选仍在计数里）。
// industries 目录用本用例专用后装 route（先匹配，不改共享 安装BFF路由），符合已审合同
// 网络桩，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 期望行业 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('三层目录：推荐+展开选满3项→保存返回重入保留，翻页不丢已选 @backend', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话：last_used_role 已落 candidate；简历与 active 意向满足建档完备判据
    fixture.主体.last_used_role = 'candidate';
    // 存量日常会话按冻结决策返回 candidate 已完成（与 P1/展示字段接线的主页用例同口径）：
    // 登录落点按完成事实进主壳，而不是被未完成分流送回学生分流
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-industries',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
    });

    const 目录请求: string[] = [];
    page.on('request', (request) => {
      const 路径 = new URL(request.url()).pathname;
      if (路径.startsWith('/api/v1/catalog/')) 目录请求.push(路径);
    });

    // industries 目录桩（本用例专用精确状态）：根两页（第二页根可选）+ 子两页（第二页叶子）
    // + 孙一层可选叶子。字段形状与既有内置 industries 桩一致（信封闭合解码）。
    const 项 = (id: string, 名称: string, parentId: string | null, selectable: boolean, hasChildren: boolean) => ({
      id,
      display_name: 名称,
      parent_id: parentId,
      selectable,
      has_children: hasChildren,
    });
    await page.route('**/api/v1/catalog/industries*', async (route) => {
      const url = new URL(route.request().url());
      const parentId = url.searchParams.get('parent_id');
      const cursor = url.searchParams.get('cursor');
      if (parentId === 'ind_fin') {
        const items = cursor === 'sub-cur'
          ? [项('ind_sec', '证券与交易系统', 'ind_fin', true, false)]
          : [项('ind_pay_grp', '支付与清结算', 'ind_fin', false, true), 项('ind_bank', '银行支付', 'ind_fin', true, false)];
        await route.fulfill({
          status: 200,
          json: 信封({ items, next_cursor: cursor === 'sub-cur' ? null : 'sub-cur', catalog_version: 'ind-v1' }),
        });
        return;
      }
      if (parentId === 'ind_pay_grp') {
        await route.fulfill({
          status: 200,
          json: 信封({ items: [项('ind_anti', '反欺诈引擎', 'ind_pay_grp', true, false)], next_cursor: null, catalog_version: 'ind-v1' }),
        });
        return;
      }
      if (cursor === 'root-cur') {
        await route.fulfill({
          status: 200,
          json: 信封({ items: [项('ind_net', '互联网', null, true, false)], next_cursor: null, catalog_version: 'ind-v1' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({ items: [项('ind_fin', '金融科技', null, false, true)], next_cursor: 'root-cur', catalog_version: 'ind-v1' }),
      });
    });

    // 日常入口：登录落主壳后直接进行业子页（共用正文，Backend 控制）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, '/#/intentions/industries');
    await expect(page.getByRole('heading', { name: '已选行业' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('0/3')).toBeVisible();
    // 根列表 + 根列表尾「加载更多」；推荐区渲染同一批根
    await expect(page.getByRole('button', { name: /金融科技/ }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '加载更多', exact: true })).toBeVisible();

    // 正常态截图（与改前拍/冻结源码快照对照：原 Backend 三层展开同版式）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-期望行业-正常.png`, fullPage: true });

    // 根翻页翻出可选根「互联网」；推荐区同名一级片可选（沿规格：可选根不混成展开）
    await page.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(page.getByRole('button', { name: '互联网', exact: true })).toBeVisible({ timeout: 10_000 });

    // 展开金融科技 → 子列表（非 selectable 子项 + 可选叶子）+ 子尾「加载更多」
    await page.getByRole('button', { name: /金融科技/ }).last().click();
    await expect(page.getByRole('button', { name: /支付与清结算/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '银行支付', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '加载更多', exact: true })).toBeVisible();

    // 可选叶子直接写入草稿（1/3）；非 selectable 子项点击走展开取孙项（不混成写入）
    await page.getByRole('button', { name: '银行支付', exact: true }).click();
    await expect(page.getByText('1/3')).toBeVisible();
    await page.getByRole('button', { name: /支付与清结算/ }).click();
    await expect(page.getByRole('button', { name: '反欺诈引擎', exact: true })).toBeVisible({ timeout: 10_000 });

    // 孙盒紧跟其子片（多级展开沿原实现的位置）：DOM 序 支付与清结算 → 孙盒(反欺诈引擎) → 兄弟子片 银行支付
    //（共用 行业分类列表 的行按钮文本带箭头尾缀，按前缀找行）
    const 孙盒紧跟子片 = await page.evaluate(() => {
      const 按钮 = (名: string) => [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim().startsWith(名));
      const 子片 = 按钮('支付与清结算');
      const 孙盒 = 按钮('反欺诈引擎');
      const 兄弟 = 按钮('银行支付');
      if (!子片 || !孙盒 || !兄弟) return false;
      const 在后 = (前: Element, 后: Element) => (前.compareDocumentPosition(后) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      return 在后(子片, 孙盒) && 在后(孙盒, 兄弟);
    });
    expect(孙盒紧跟子片).toBe(true);

    // 子翻页翻出第 2 页可选叶子（2/3），第 1 页已选片保持选中
    await page.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(page.getByRole('button', { name: '证券与交易系统', exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /银行支付 ✓/ })).toBeVisible();
    await page.getByRole('button', { name: '证券与交易系统', exact: true }).click();
    await expect(page.getByText('2/3')).toBeVisible();

    // 推荐区可选根写入第 3 项 → 3/3；非 selectable 展开项在上限保持可用（fix(review-r1) F2）
    await page.getByRole('button', { name: '互联网', exact: true }).click();
    await expect(page.getByText('3/3')).toBeVisible();
    await expect(page.getByRole('button', { name: /支付与清结算/ })).toBeEnabled();

    // 选中态截图 + iPhone 13 viewport 检查：无横向溢出、保存可见可聚焦
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-期望行业-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 保存键 = page.getByRole('button', { name: '保存', exact: true });
    await 保存键.focus();
    await expect(保存键).toBeFocused();

    // 保存（沿原业务：保存只负责返回）→ 主壳；重入草稿不丢
    await 保存键.click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await hash直达(page, '/#/intentions/industries');
    await expect(page.getByText('3/3')).toBeVisible({ timeout: 15_000 });
    // 重开已选保留：展开金融科技只见第 1 页子项，翻页翻走的 证券与交易系统 不在可见项里
    // 但计数仍 3/3 —— 已选不依赖当前可见项
    await page.getByRole('button', { name: /金融科技/ }).last().click();
    await expect(page.getByRole('button', { name: /银行支付 ✓/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '证券与交易系统', exact: true })).toHaveCount(0);
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-期望行业-重入.png`, fullPage: true });

    // 本会话目录请求只打 industries（目录身份按 ID，不按显示名反查）
    expect(目录请求.length).toBeGreaterThan(0);
    expect(目录请求.every((p) => p === '/api/v1/catalog/industries')).toBe(true);
  });
});
