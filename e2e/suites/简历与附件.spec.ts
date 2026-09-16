// e2e/suites/简历与附件.spec.ts
// C6：原「P2 附件简历 Backend / 核心编辑 作品集 / 核心编辑 简历行业 / 核心编辑 教育 /
// 核心编辑 附件 / 候选资料编辑边界 / 候选个人优势编辑」等价迁入。

import { expect, test } from '../fixtures/test';
import { 抽屉搜企业并选中, 左滑附件行, 断言附件标题几何未漂移, hash直达 } from '../fixtures/数据源交互';
import { 信封 } from '../fixtures/bff/协议';
import { fixture简历, fixture意向列表 } from '../fixtures/bff/账号与目录';
import { P4深克隆 } from '../fixtures/bff/发现推荐';
import { P3标记, P3隐私fixture, P3默认组织库 } from '../fixtures/bff/隐私与实名';
import { 创建P2附件fixture } from '../fixtures/bff/附件';
import { 创建候选OnboardingFixture } from '../fixtures/bff/候选建档';
import { 安装BFF路由 } from '../fixtures/bff/安装BFF路由';

// ─────────────────────────────────────────────────────────────────────────────
// P2 附件简历 Backend @backend —— candidate 拥有 0–3 份 PDF 附件库的真实浏览器契约。
// fixture（创建P2附件fixture）fail closed：未知 multipart part、缺 consent、错 If-Match、
// 缺幂等键一律 throw，让 E2E 在契约漂移时直接红。预览只断言 authenticated content GET，
// 不依赖 headless PDF viewer 的页面内容；布局门由 断言附件标题几何未漂移 承担。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('P2 附件简历 Backend @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('Backend candidate owns PDF library without changing Mock visuals @backend', async ({ page }) => {
    // 轮询节拍是 3s 一读，多段轮询 + 手势全在一条 journey 里：显式放宽到 120s
    test.setTimeout(120_000);
    const P2 = 创建P2附件fixture();
    await 安装BFF路由(page, {
      记录目录请求: () => {}, 登录尝试id: 'att-p2', 附件fixture: P2,
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await hash直达(page, '/#/student');
    await page.locator('input[type=file]').setInputFiles({
      name: 'candidate.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('candidate.pdf')).toBeVisible();

    await hash直达(page, '/#/resume');
    // 授权层成功轻提示存活约 2s；等它退场，避免「简历已上传，正在识别」与行状态文案
    // 同时命中下面的 alternation（strict mode 会把 toast 记为第二个匹配，属测试噪声）。
    await expect(page.getByText('简历已上传，正在识别')).toBeHidden({ timeout: 5_000 });
    await expect(page.getByText('candidate.pdf')).toBeVisible();
    await expect(page.getByText(/等待识别|正在识别|识别完成/)).toBeVisible();
    await expect.poll(() => P2.列表读取次数, { timeout: 15_000 }).toBeGreaterThan(2);
    await expect(page.getByText('识别完成')).toBeVisible();

    // ── 布局门一：1/3（未满额）＋ 可见 —— 有 ＋ 的标题几何 ──
    await expect(page.getByRole('button', { name: '添加附件简历' })).toBeVisible();
    await 断言附件标题几何未漂移(page);
    // 记录第一行关闭滑动态的高度：replace + 轮询完成后同一行高度差不得 >1px
    const 首行 = page.getByTestId('附件简历行').filter({ hasText: 'candidate.pdf' });
    const 首行闭高 = (await 首行.boundingBox())?.height;
    expect(首行闭高).toBeDefined();

    // ── ＋ 授权取消：零写入零请求（基线采样在触发文件选择之前）──
    const writesBeforeAddCancel = P2.写入次数;
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'cancel-me.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    expect(P2.写入次数).toBe(writesBeforeAddCancel);
    await expect(page.getByText('允许 AI 识别这份简历？')).toHaveCount(0);
    await expect(page.getByTestId('附件简历行')).toHaveCount(1);

    // ── 添加第二份 ──
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'second.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByTestId('附件简历行')).toHaveCount(2);
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'second.pdf' })).toBeVisible();

    // ── 替换 candidate.pdf：display name 由槽位保留，与新挑的文件名无关 ──
    await 左滑附件行(page, 'candidate.pdf');
    await page.getByRole('button', { name: '替换', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'replacement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('replacement.pdf')).toHaveCount(0);
    await expect(首行).toBeVisible();
    // replace 后重新入列 pending → 轮询回 识别完成；同一行高度不漂移
    await expect(首行.getByText('识别完成')).toBeVisible({ timeout: 15_000 });
    const 首行复高 = (await 首行.boundingBox())?.height;
    expect(Math.abs(首行复高! - 首行闭高!)).toBeLessThanOrEqual(1);

    // ── 预览：只断言 authenticated content GET，不依赖 PDF viewer 页面内容 ──
    const 内容请求 = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/api/v1/me/resume-files/rf_1/content',
    );
    await 首行.click();
    await 内容请求;
    expect(P2.下载次数).toBeGreaterThanOrEqual(1);

    // ── 添加到 3/3：＋ 消失；布局门二：满额无 ＋ 的标题几何 ──
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'third.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByTestId('附件简历行')).toHaveCount(3);
    await expect(page.getByRole('button', { name: '添加附件简历' })).toHaveCount(0);
    await 断言附件标题几何未漂移(page);

    // ── 删除：取消零 DELETE，确认恰一次 DELETE ──
    const 删除请求: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE' && new URL(request.url()).pathname.startsWith('/api/v1/me/resume-files')) {
        删除请求.push(request.url());
      }
    });
    const writesBeforeDelete = P2.写入次数;
    await 左滑附件行(page, 'third.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.getByText('删除后无法恢复。')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    expect(P2.写入次数).toBe(writesBeforeDelete);
    expect(删除请求).toEqual([]);
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'third.pdf' })).toBeVisible();

    await 左滑附件行(page, 'third.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.getByText('删除后无法恢复。')).toBeVisible();
    // 弹层遮罩的 aria-label「关闭删除附件简历？」也含这段文字：exact 只认执行键
    await page.getByRole('button', { name: '删除附件简历', exact: true }).click();
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'third.pdf' })).toHaveCount(0, { timeout: 10_000 });
    expect(P2.写入次数).toBe(writesBeforeDelete + 1);
    expect(删除请求.length).toBe(1);
  });

  test('failed resume parse requires fresh consent before retry @backend', async ({ page }) => {
    // 失败态要等两拍 3s 轮询 + 重试后两拍：显式放宽到 120s
    test.setTimeout(120_000);
    const P2 = 创建P2附件fixture('parser_temporarily_unavailable');
    await 安装BFF路由(page, { 记录目录请求: () => {}, 登录尝试id: 'att-p2-failed', 附件fixture: P2 });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await hash直达(page, '/#/student');
    await page.locator('input[type=file]').setInputFiles({
      name: 'failed.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await page.getByRole('button', { name: '同意并继续' }).click();
    await hash直达(page, '/#/resume');
    await expect(page.getByText('服务繁忙 · 稍后重试')).toBeVisible({ timeout: 15_000 });
    P2.下次终态 = 'succeeded';
    const writesBeforeConsent = P2.写入次数;
    await 左滑附件行(page, 'failed.pdf');
    await page.getByRole('button', { name: '重新解析' }).click();
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    expect(P2.写入次数).toBe(writesBeforeConsent);
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('识别完成')).toBeVisible({ timeout: 15_000 });
    expect(P2.写入次数).toBe(writesBeforeConsent + 1);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 作品集 @backend（core editors §6.1 Task 1）：日常编辑（无 onboarding 草稿）
// 的存量候选直接进 /experience 编辑作品集链接 —— URL-only 变化触发带 portfolio_url 的
// profile PATCH（其余八键全量保留、If-Match 为旧 profile revision），保存以最终权威 GET
// 收尾；重新进入页面读权威值不丢；再明确清空（PATCH body portfolio_url null）。
// 网络桩 route fixture 边界验证，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 作品集 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('日常编辑作品集：保存→权威回读→重进不丢→再清空，未走 onboarding @backend', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话：last_used_role 已落 candidate；简历与 active 意向满足
    // 建档完备判据（真实登录落点按「已水合简历 + active 意向」分流），预置权威 URL
    fixture.主体.last_used_role = 'candidate';
    // 存量日常会话按冻结决策返回 candidate 已完成（与 P1/展示字段接线的主页用例同口径）：
    // 登录落点按完成事实进主壳，而不是被未完成分流送回学生分流
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选', portfolio_url: 'https://github.com/existing' },
      summary: '存量个人优势',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    const profile写入: { method: string; path: string; body: unknown; ifMatch: string | null }[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-portfolio',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
      请求拦截: (请求) => {
        if (请求.path === '/api/v1/me/resume/profile' && 请求.method === 'PATCH') {
          profile写入.push({ method: 请求.method, path: 请求.path, body: 请求.body, ifMatch: 请求.headers['if-match'] ?? null });
        }
      },
    });
    const 次数 = (方法: string, 路径: string) =>
      fixture.mutations.filter((条) => 条.method === 方法 && 条.path === 路径).length;

    // 日常入口：登录落主壳后直接进 /experience（不经过学生分流/建档旅程）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, '/#/experience');
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    const 输入 = page.getByLabel('作品集或项目链接');
    await expect(输入).toHaveValue('https://github.com/existing');

    // 日常设置：改 URL（点保存先失焦 → 规范化补 https）→ 保存
    await 输入.fill('github.com/new-works');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/wizard$/, { timeout: 20_000 });
    // URL-only 变化恰发一次 profile PATCH：portfolio_url 在 body、其余键全量保留、
    // If-Match 为旧 profile revision；保存以最终权威 GET 收尾
    expect(次数('PATCH', '/api/v1/me/resume/profile')).toBe(1);
    const 设置写入 = profile写入[0]!;
    expect(设置写入.ifMatch).toBe(`"${fixture简历.profile_revision}"`);
    expect(设置写入.body).toEqual(expect.objectContaining({
      portfolio_url: 'https://github.com/new-works',
      real_name: '存量候选',
      status: 'employed',
    }));
    expect((设置写入.body as Record<string, unknown>).current_education).toBeNull();
    expect(fixture.resume.profile.portfolio_url).toBe('https://github.com/new-works');
    expect(fixture.简历请求.at(-1)).toEqual({ method: 'GET', path: '/api/v1/me/resume' });
    // 未走 onboarding：本会话零建档写入（无经历/教育/证书/意向/角色写入）
    expect(fixture.mutations.filter((条) => 条.path !== '/api/v1/me/resume/profile')).toEqual([]);

    // 权威回读后重新进入：值不丢
    await hash直达(page, '/#/experience');
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('作品集或项目链接')).toHaveValue('https://github.com/new-works');

    // iPhone 13 viewport：横向溢出 ≤2px、保存键不被遮挡、URL 输入可聚焦
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 链接输入 = page.getByLabel('作品集或项目链接');
    await 链接输入.focus();
    await expect(链接输入).toBeFocused();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-作品集.png`, fullPage: true });

    // 再明确清空：PATCH body portfolio_url 为 null，权威回读后重进为空
    await page.getByLabel('作品集或项目链接').fill('');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/wizard$/, { timeout: 20_000 });
    expect(次数('PATCH', '/api/v1/me/resume/profile')).toBe(2);
    const 清空写入 = profile写入[1]!;
    expect((清空写入.body as Record<string, unknown>).portfolio_url).toBeNull();
    expect(fixture.resume.profile.portfolio_url).toBeNull();
    await hash直达(page, '/#/experience');
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('作品集或项目链接')).toHaveValue('');
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 教育 @mock（core editors §5.2 Task 5）：教育编辑页 学校/专业 候选行共用 ——
// Mock 用现有 高校名录/专业名录 演示种子做局部子串搜索/分页（列表尾「加载更多」），
// 选候选只落文本（本地选择控制，不落引用），完成无引用门槛、保存进本地简历。
// 全程零 /api/v1 请求。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 教育 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('学校/专业共用候选：输入→候选→分页→选候选→保存，全程零 API @catalog-fullscreen @mock', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);

    // 日常入口：在线简历 → 添加教育经历（共用候选列表，Mock 演示种子）。
    // editor-catalog-fullscreen Task 2 起：学校/专业是点击行 → 全屏选择外壳子视图（候选在层内）。
    await hash直达(page, '/#/experience');
    await expect(page.getByRole('button', { name: '＋ 添加教育经历' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加教育经历' }).click();
    await expect(page.getByText('学校名称')).toBeVisible({ timeout: 10_000 });

    // 学校行 → 全屏「选择学校」：搜索「大学」名录子串命中，首页 8 条 + 列表尾「加载更多」
    const 学校行 = page.getByRole('button').filter({ hasText: '学校名称' });
    await 学校行.click();
    const 学校层 = page.getByRole('dialog', { name: '选择学校' });
    await expect(学校层).toBeVisible({ timeout: 10_000 });
    await 学校层.getByPlaceholder('搜索学校名称').fill('大学');
    await expect(学校层.getByRole('button', { name: '清华大学', exact: true })).toBeVisible({ timeout: 10_000 });
    expect(await 学校层.getByRole('button', { name: '清华大学', exact: true }).count()).toBe(1);
    await expect(学校层.getByRole('button', { name: '加载更多', exact: true })).toBeVisible();
    await expect(学校层.getByRole('button', { name: '同济大学', exact: true })).toHaveCount(0);

    // 输入及候选截图（与改前拍对照：旧 Mock 教育页无候选）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-教育-输入及候选.png`, fullPage: true });

    // 分页翻出名录第 9–16 位 → 选候选落行文本、子视图收起（同 Backend 点候选行为）
    await 学校层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(学校层.getByRole('button', { name: '同济大学', exact: true })).toBeVisible({ timeout: 10_000 });
    await 学校层.getByRole('button', { name: '清华大学', exact: true }).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('清华大学');

    // 专业走同一共用列表（无副行）：搜索「工程」→ 分页 → 选软件工程
    const 专业行 = page.getByRole('button').filter({ hasText: '专业' }).first();
    await 专业行.click();
    const 专业层 = page.getByRole('dialog', { name: '选择专业' });
    await expect(专业层).toBeVisible({ timeout: 10_000 });
    await 专业层.getByPlaceholder('搜索专业名称').fill('工程');
    await expect(专业层.getByRole('button', { name: '软件工程', exact: true })).toBeVisible({ timeout: 10_000 });
    await 专业层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(专业层.getByRole('button', { name: '土木工程', exact: true })).toBeVisible({ timeout: 10_000 });
    await 专业层.getByRole('button', { name: '软件工程', exact: true }).click();
    await expect(专业层).toHaveCount(0);
    await expect(专业行).toContainText('软件工程');

    // 选中态截图 + iPhone 13 viewport 检查：无横向溢出、关闭后焦点回触发行、完成不被遮挡
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-教育-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    await expect(专业行).toBeFocused();
    await expect(page.getByRole('button', { name: '完成', exact: true })).toBeVisible();

    // 完成（Mock 无引用门槛）→ 教育卡上屏；保存进本地简历，重进回读不丢
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await expect(page.getByText(/清华大学/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/本科 · 软件工程/)).toBeVisible();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/wizard$/, { timeout: 20_000 });
    await hash直达(page, '/#/experience');
    await expect(page.getByText(/清华大学/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/本科 · 软件工程/)).toBeVisible();

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 教育 @backend（core editors §5.2 Task 5）：Backend 分支消费同一共用候选列表 ——
// 学校候选带「城市 · 国家」副行、列表尾「加载更多」翻真实游标页、同名不同 ID 按稳定键
// 准确提交（education POST 的 institution_id 是所点行的 ID）；输入框布局不变。
// 教育目录桩为本用例专用后装 route（先匹配，不改共享 安装BFF路由），符合已审合同网络桩，
// 不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 教育 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('目录候选：输入→副行→分页→选候选→保存，同名不同 ID 按键提交 @catalog-fullscreen @backend', async ({ page }, testInfo) => {
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
      登录尝试id: 'att-core-edit-education',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
    });

    // 教育目录桩（本用例专用精确状态）：同名不同 ID 三校 + 游标分页；专业两页。字段形状
    // 与既有内置 institutions/majors 桩一致（信封闭合解码）。
    const 学校 = (id: string, 城: string) => ({
      id,
      display_name: '清华大学',
      location: {
        id: `loc-${id}`, display_name: 城, country_code: 'CN', country_name: '中国',
        admin1_code: null, admin1_name: null, timezone: 'Asia/Shanghai', population: 0,
      },
      selectable: true,
    });
    const 教育 = (institution_id: string, major_id: string) => ({ institution_id, major_id });
    await page.route('**/api/v1/catalog/education-institutions*', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('cursor') === 'inst-cur-1') {
        await route.fulfill({
          status: 200,
          json: 信封({ items: [学校('inst_same_c', '上海')], next_cursor: null, catalog_version: 'inst-v1' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [学校('inst_same_a', '北京'), 学校('inst_same_b', '新竹')],
          next_cursor: 'inst-cur-1',
          catalog_version: 'inst-v1',
        }),
      });
    });
    await page.route('**/api/v1/catalog/majors*', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('cursor') === 'major-cur-1') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'major_se', display_name: '软件工程', parent_id: null, selectable: true }],
            next_cursor: null,
            catalog_version: 'major-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [{ id: 'major_cs', display_name: '计算机科学与技术', parent_id: null, selectable: true }],
          next_cursor: 'major-cur-1',
          catalog_version: 'major-v1',
        }),
      });
    });

    // 日常入口：登录落主壳后直接进 /experience（不经过建档旅程）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, '/#/experience');
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加教育经历' }).click();
    await expect(page.getByText('学校名称')).toBeVisible({ timeout: 10_000 });

    // 学校行 → 全屏「选择学校」：搜索「清」同名不同 ID 两行以副行（城市 · 国家）区分 + 列表尾「加载更多」
    // （editor-catalog-fullscreen Task 2 起：学校/专业是点击行 → 全屏选择外壳子视图）
    const 学校行 = page.getByRole('button').filter({ hasText: '学校名称' });
    await 学校行.click();
    const 学校层 = page.getByRole('dialog', { name: '选择学校' });
    await expect(学校层).toBeVisible({ timeout: 10_000 });
    await 学校层.getByPlaceholder('搜索学校名称').fill('清');
    await expect(学校层.getByRole('button', { name: '清华大学', exact: true })).toHaveCount(2, { timeout: 10_000 });
    await expect(学校层.getByText('北京 · 中国')).toBeVisible();
    await expect(学校层.getByText('新竹 · 中国')).toBeVisible();
    await expect(学校层.getByRole('button', { name: '加载更多', exact: true })).toBeVisible();

    // 输入及候选截图（与改前拍/冻结源码快照对照：原 Backend 候选行结构）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-教育-输入及候选.png`, fullPage: true });

    // 分页翻出第三行 → 选第二行（inst_same_b，同名不同 ID）
    await 学校层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(学校层.getByText('上海 · 中国')).toBeVisible({ timeout: 10_000 });
    await 学校层.getByRole('button', { name: '清华大学', exact: true }).nth(1).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('清华大学');

    // 专业走同一共用列表（无副行）：搜索 → 分页 → 选叶子
    // （Backend 原外层行为：点候选清空候选数组后游标仍在，列表尾「加载更多」保持原样）
    const 专业行 = page.getByRole('button').filter({ hasText: '专业' }).first();
    await 专业行.click();
    const 专业层 = page.getByRole('dialog', { name: '选择专业' });
    await expect(专业层).toBeVisible({ timeout: 10_000 });
    await 专业层.getByPlaceholder('搜索专业名称').fill('计');
    await expect(专业层.getByRole('button', { name: '计算机科学与技术', exact: true })).toBeVisible({ timeout: 10_000 });
    await 专业层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(专业层.getByRole('button', { name: '软件工程', exact: true })).toBeVisible({ timeout: 10_000 });
    await 专业层.getByRole('button', { name: '软件工程', exact: true }).click();
    await expect(专业层).toHaveCount(0);
    await expect(专业行).toContainText('软件工程');

    // 选中态截图 + iPhone 13 viewport 检查：无横向溢出、关闭后焦点回触发行、完成不被遮挡
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-教育-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    await expect(专业行).toBeFocused();
    await expect(page.getByRole('button', { name: '完成', exact: true })).toBeVisible();

    // 完成 → 教育卡上屏；保存按所点行的稳定 ID 提交（同名不同 ID 不串，
    // institution_id 是所点行的目录 ID，不按显示名反查）
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await expect(page.getByText(/清华大学/).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/wizard$/, { timeout: 20_000 });
    const 教育写入 = fixture.mutations.filter(
      (条) => 条.method === 'POST' && 条.path === '/api/v1/me/resume/educations',
    );
    expect(教育写入.length).toBeGreaterThan(0);
    expect(教育写入[0]!.body).toMatchObject(教育('inst_same_b', 'major_se'));
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 简历行业 @mock（core editors §5.2 Task 6）：经历编辑页 所属行业 底部选择层
// 两模式共用 简历行业选择正文 —— Mock 用 常见行业 本地目录作模拟目录（同一正文），
// 自由文本自填经可选 自填 保留（Backend 不提供）。选常见行业即回填并关闭层，
// 完成后经历卡带行业标签，保存进本地简历、重进回读不丢。全程零 /api/v1 请求。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 简历行业 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('常见行业目录：展开层→选行业→经历保存并回读，自填输入已按 Plan 删除 @mock', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);

    // 日常入口：在线简历 → 添加工作经历 → 公司名称走选择抽屉（Mock 本地目录）→ 所属行业层
    await hash直达(page, '/#/experience');
    await expect(page.getByRole('button', { name: '＋ 添加工作经历' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加工作经历' }).click();
    // 公司名称行改按钮选择后，编辑页唯一 placeholder='必填' 的输入只剩职位名称
    await expect(page.getByPlaceholder('必填')).toHaveCount(1);
    await page.getByRole('button').filter({ hasText: '公司名称' }).click();
    await 抽屉搜企业并选中(page, '云衢', '云衢科技');
    const 公司名称行 = page.getByRole('button').filter({ hasText: '公司名称' });
    await expect(公司名称行).toContainText('云衢科技');
    await page.getByRole('button', { name: '所属行业' }).click();
    // Mock 行业字典当前根集（根仅展开、细分可选；根按钮可访问名带「⌄」展开符）
    await expect(page.getByRole('button', { name: '互联网平台' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '智能硬件 / 制造' })).toBeVisible();
    // picker 统一 Task 1 按 Plan 删除 Mock 自填自由文本输入（两模式无「自填行业」）
    await expect(page.getByPlaceholder('没有合适的？直接输入')).toHaveCount(0);

    // 正常态截图（与改前拍对照：原 Mock 行业层同版式）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-简历行业-正常.png`, fullPage: true });

    // 展开金融科技根 → 选可选细分叶 → 回填所属行业行并关闭层（单选关闭沿原页）
    await page.getByRole('button', { name: '金融科技' }).click();
    await page.getByRole('button', { name: '支付与清结算' }).click();
    await expect(page.getByPlaceholder('没有合适的？直接输入')).toHaveCount(0);

    // 选中回填态截图 + iPhone 13 viewport 检查：无横向溢出、职位输入可聚焦、完成可见
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-简历行业-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    await page.getByPlaceholder('必填').focus();
    await expect(page.getByPlaceholder('必填')).toBeFocused();
    await expect(page.getByRole('button', { name: '完成', exact: true })).toBeVisible();

    // 补齐必填与入职年月 → 完成 → 经历卡带行业标签；保存进本地简历，重进回读不丢
    await page.getByPlaceholder('必填').fill('演示工程师');
    await page.getByRole('button', { name: '入职年月' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await expect(page.getByText(/支付与清结算/).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/wizard$/, { timeout: 20_000 });
    await hash直达(page, '/#/experience');
    await expect(page.getByText(/支付与清结算/).first()).toBeVisible({ timeout: 15_000 });

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 简历行业 @backend（core editors §5.2 Task 6）：Backend 分支消费同一共用正文 ——
// 根/子/孙三层按当前渲染顺序分段展示（层级缩进）、各列表尾「加载更多」、可选叶子单击
// 选定并按稳定 ID 精确提交（experience POST 的 industry_id 是所点行的目录 ID，同名不串）。
// 行业目录桩为本用例专用后装 route（先匹配，不改共享 安装BFF路由），符合已审合同网络桩，
// 不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 简历行业 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('三层目录：展开根→选孙叶子→经历按 ID 保存，分段尾可翻页 @backend', async ({ page }, testInfo) => {
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
    // 合同 C：经历公司走 公司选择抽屉 —— 搜索池给默认组织库，选中按稳定 ID 回填
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-industry',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: 隐私,
    });

    // 行业目录桩（本用例专用精确状态）：根两页（第二页根可选）+ 子两页（第二页叶子）
    // + 孙一层可选叶子。字段形状与既有内置 industries 桩一致（信封闭合解码）。
    await page.route('**/api/v1/catalog/industries*', async (route) => {
      const url = new URL(route.request().url());
      const parentId = url.searchParams.get('parent_id');
      const cursor = url.searchParams.get('cursor');
      if (parentId === 'ind_root') {
        const items = cursor === 'ind-cur-2'
          ? [{ id: 'ind_leaf_direct', display_name: '第三方支付', parent_id: 'ind_root', selectable: true, has_children: false }]
          : [{ id: 'ind_pay_grp', display_name: '支付与清结算', parent_id: 'ind_root', selectable: false, has_children: true }];
        await route.fulfill({
          status: 200,
          json: 信封({ items, next_cursor: cursor === 'ind-cur-2' ? null : 'ind-cur-2', catalog_version: 'ind-v1' }),
        });
        return;
      }
      if (parentId === 'ind_pay_grp') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'ind_leaf_bank', display_name: '银行支付', parent_id: 'ind_pay_grp', selectable: true, has_children: false }],
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      if (cursor === 'ind-cur-1') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'ind_int', display_name: '互联网', parent_id: null, selectable: true, has_children: false }],
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [{ id: 'ind_root', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }],
          next_cursor: 'ind-cur-1',
          catalog_version: 'ind-v1',
        }),
      });
    });

    // 日常入口（简历编辑显式来源）：登录落主壳后从 我的简历 点行进在线简历 ——
    // 编辑入口带 from=resume，保存后只回我的简历；不用裸 /experience 冒充日常入口
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, '/#/resume');
    await expect(page.getByText('我的简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button').filter({ hasText: 'Fixture 大学' }).click();
    await expect(page).toHaveURL(/#\/experience\?from=resume$/, { timeout: 15_000 });
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加工作经历' }).click();
    // 公司名称行改按钮选择后，编辑页唯一 placeholder='必填' 的输入只剩职位名称
    await expect(page.getByPlaceholder('必填')).toHaveCount(1);
    await page.getByRole('button').filter({ hasText: '公司名称' }).click();
    await 抽屉搜企业并选中(page, '磐石', P3标记.手动组织甲);
    await expect(page.getByRole('button').filter({ hasText: '公司名称' })).toContainText(P3标记.手动组织甲);

    // 行业层：根列表 + 列表尾「加载更多」（分段 = 根列表及其分页尾）
    await page.getByRole('button', { name: '所属行业' }).click();
    await expect(page.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '加载更多', exact: true })).toBeVisible();

    // 正常态截图（与改前拍/冻结源码快照对照：原 Backend 三层展开同版式）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-简历行业-正常.png`, fullPage: true });

    // 根分页翻出第二页根（可选根直接选定路径的另一形态），再展开 金融科技 → 子列表
    await page.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(page.getByRole('button', { name: '互联网', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /金融科技/ }).click();
    await expect(page.getByRole('button', { name: /支付与清结算/ })).toBeVisible({ timeout: 10_000 });
    // 子列表尾「加载更多」在场（非 selectable 子项可展开孙层）
    await expect(page.getByRole('button', { name: '加载更多', exact: true })).toBeVisible();

    // 非 selectable 子项 → 孙层 → 可选孙叶子单击选定（层级缩进照原 inline padding）
    await page.getByRole('button', { name: /支付与清结算/ }).click();
    await expect(page.getByRole('button', { name: '银行支付', exact: true })).toBeVisible({ timeout: 10_000 });

    // 三层缩进态截图（根/子/孙分段沿渲染顺序 + 各段分页尾）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-简历行业-三层缩进.png`, fullPage: true });

    await page.getByRole('button', { name: '银行支付', exact: true }).click();
    await expect(page.getByPlaceholder('没有合适的？直接输入')).toHaveCount(0);

    // 选中回填态截图 + iPhone 13 viewport 检查：无横向溢出、职位输入可聚焦、完成可见
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-简历行业-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    await page.getByPlaceholder('必填').focus();
    await expect(page.getByPlaceholder('必填')).toBeFocused();
    await expect(page.getByRole('button', { name: '完成', exact: true })).toBeVisible();

    // 补齐必填与入职年月 → 完成 → 经历卡带行业标签；保存按所点行的稳定 ID 提交
    //（industry_id 是所点孙叶子的目录 ID、organization_id 是抽屉选中的组织 ID，
    // 都不按显示名反查）
    await page.getByPlaceholder('必填').fill('演示工程师');
    await page.getByRole('button', { name: '入职年月' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await expect(page.getByText(/银行支付/).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    // 编辑入口带 from=resume：保存只回我的简历，不进注册流向导
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 20_000 });
    const 经历写入 = fixture.mutations.filter(
      (条) => 条.method === 'POST' && 条.path === '/api/v1/me/resume/experiences',
    );
    expect(经历写入.length).toBeGreaterThan(0);
    expect(经历写入[0]!.body).toMatchObject({
      organization_id: 'org-fixture-p3-manual-a',
      industry_id: 'ind_leaf_bank',
    });

    // ── 保存／重入（review-r1 F2 + 简历编辑显式来源）：company 是服务端按
    //    organization_id 冻结的展示快照 —— 从 我的简历 重进后经历卡与编辑页公司行
    //    都显示所选企业（非空、即该企业 display_name），公司非空过必填门完成可用；
    //    改职位再保存回我的简历，PATCH 仍提交同一 organization_id ──
    await expect(page.getByText(P3标记.手动组织甲).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button').filter({ hasText: P3标记.手动组织甲 }).click();
    await expect(page).toHaveURL(/#\/experience\?from=resume$/, { timeout: 15_000 });
    await page.getByRole('button').filter({ hasText: P3标记.手动组织甲 }).click();
    const 重入公司行 = page.getByRole('button').filter({ hasText: '公司名称' });
    await expect(重入公司行).toContainText(P3标记.手动组织甲);
    await expect(page.getByRole('button', { name: '完成', exact: true })).toBeEnabled();
    // 改职位制造差异：无差异的再保存不发 PATCH（保存简历按分区 diff 决定写入）
    await page.getByPlaceholder('必填').fill('演示工程师·复核');
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 20_000 });
    const 经历更新 = fixture.mutations.filter(
      (条) => 条.method === 'PATCH' && /^\/api\/v1\/me\/resume\/experiences\/[^/]+$/.test(条.path),
    );
    expect(经历更新.length).toBe(1);
    expect(经历更新[0]!.body).toMatchObject({
      organization_id: 'org-fixture-p3-manual-a',
      industry_id: 'ind_leaf_bank',
      title: '演示工程师·复核',
    });
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 候选资料编辑边界 @backend（简历编辑显式来源，Task 1）：已完成候选从 我的简历 真实
// UI 流程进基本信息（入口带 from=resume），URL 刷新保留编辑模式，整页按钮为「保存」，
// 保存成功只回我的简历；简历域 PATCH 照发，但首次意向写入为零 —— 日常编辑绝不触发
// 注册流的建档/意向写入。fixture 全部复用现有 安装BFF路由，不导出新的模拟框架。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('候选资料编辑边界 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('已完成候选经基本信息保存回我的简历：刷新保留编辑模式，首次意向写入零次 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话：last_used_role 已落 candidate，已完成事实决定登录落主壳
    fixture.主体.last_used_role = 'candidate';
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    await 安装BFF路由(page, {
      登录尝试id: 'att-resume-edit-boundary',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
    });

    // 真实 UI 流程：登录落主壳 → 我的简历 → 基本信息行（入口带 from=resume）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, '/#/resume');
    await expect(page.getByText('我的简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button').filter({ hasText: '工作年限' }).click();
    await expect(page).toHaveURL(/#\/basic\?from=resume$/, { timeout: 15_000 });

    // 编辑模式：按钮为「保存」，URL 刷新保留模式（不弹回注册流、不恢复旧出口）
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '下一步', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page).toHaveURL(/#\/basic\?from=resume$/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible({ timeout: 15_000 });

    // 改真名并保存：保存成功只回我的简历，profile PATCH 照发（简历域真实写入）
    await page.getByPlaceholder('身份证上的名字').fill('存量候选·复核');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 20_000 });
    await expect(page.getByText('我的简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    const 资料写入 = fixture.mutations.filter(
      (条) => 条.method === 'PATCH' && 条.path === '/api/v1/me/resume/profile',
    );
    expect(资料写入.length).toBe(1);
    expect(资料写入[0]!.body).toMatchObject({ real_name: '存量候选·复核', status: 'employed' });
    expect(fixture.resume.profile.real_name).toBe('存量候选·复核');

    // 编辑边界：首次意向写入零次（日常编辑不建意向、不走注册流收尾）
    expect(fixture.mutations.filter((条) => 条.method === 'POST' && 条.path === '/api/v1/me/intentions')).toEqual([]);
    // 我的简历回显新名字：保存的权威回读落到了本页
    await expect(page.getByText('存量候选·复核')).toBeVisible({ timeout: 15_000 });
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 个人优势独立编辑 @backend（Task 4）：已完成候选从 我的简历 个人优势卡进
// /wizard?from=resume —— 向导内该参数唯一表示只编辑个人优势（题序单题、按钮「保存」、
// 无“已根据你上传的简历预先提取”与恢复动作），初值是已水合的存量 summary；
// 返回未保存零写入；URL 刷新保持编辑场景；保存成功回我的简历并显示新值（多行换行
// 保留），fixture 记录的真实请求恰一次 summary PATCH 且首次意向 POST 为零。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('候选个人优势编辑 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('我的简历个人优势进编辑保存回读：刷新保持、返回零写、首次意向 POST 为零 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    fixture.主体.last_used_role = 'candidate';
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量优势第一行\n存量优势第二行',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    await 安装BFF路由(page, {
      登录尝试id: 'att-summary-edit-entry',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
    });

    // 真实 UI 流程：登录落主壳 → 我的简历 → 个人优势卡（有值回显多行原文）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, '/#/resume');
    await expect(page.getByText('我的简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button').filter({ hasText: '存量优势第一行' }).click();
    await expect(page).toHaveURL(/#\/wizard\?from=resume$/, { timeout: 15_000 });

    // 编辑场景：初值是存量 summary；无提取说明、无恢复动作、按钮为「保存」
    const 优势框 = page.getByLabel('个人优势');
    await expect(优势框).toHaveValue('存量优势第一行\n存量优势第二行', { timeout: 15_000 });
    await expect(page.getByText('已根据你上传的简历预先提取')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /恢复简历识别建议|重新从简历提取/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();

    // 返回未保存不提交：退回我的简历，零写入
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 15_000 });
    expect(fixture.mutations.filter((条) => 条.path === '/api/v1/me/resume/summary')).toEqual([]);

    // 再次进入并刷新：编辑场景保持（题序单题 + 「保存」按钮）
    await page.getByRole('button').filter({ hasText: '存量优势第一行' }).click();
    await expect(page).toHaveURL(/#\/wizard\?from=resume$/, { timeout: 15_000 });
    await page.reload();
    await expect(page).toHaveURL(/#\/wizard\?from=resume$/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible({ timeout: 15_000 });

    // 改写为多行文本并保存：回我的简历并显示新值（换行保留）
    const 编辑框 = page.getByLabel('个人优势');
    // final review：reload 后先钉住初值再改写 —— 自我介绍 useState 初值依赖「水合完成才
    // 挂路由」的结构前提，此断言让异步水合下的初值丢失在 fill 掩盖前先红。
    await expect(编辑框).toHaveValue('存量优势第一行\n存量优势第二行', { timeout: 15_000 });
    await 编辑框.fill('改后优势第一行\n改后优势第二行');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 20_000 });
    await expect(page.getByText('改后优势第一行')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('改后优势第二行')).toBeVisible({ timeout: 15_000 });

    // fixture 记录的真实请求：summary PATCH 恰一次、value 逐字；首次意向 POST 为零
    const 摘要写入 = fixture.mutations.filter(
      (条) => 条.method === 'PATCH' && 条.path === '/api/v1/me/resume/summary',
    );
    expect(摘要写入.length).toBe(1);
    expect(摘要写入[0]!.body).toEqual({ value: '改后优势第一行\n改后优势第二行' });
    expect(fixture.mutations.filter((条) => 条.method === 'POST' && 条.path === '/api/v1/me/intentions')).toEqual([]);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 附件 @mock（core editors §5.3 Task 8）：我的简历 附件简历卡两模式共用
// 简历附件区 —— Mock 外层局部模拟：原演示行仍为首条（保留原静态说明），获批的 ＋ 入口、
// 左滑 解析/替换/删除、上传/解析授权与删除确认层同一套可见交互。添加/替换/删除/解析
// 全部本地模拟：零 /api/v1 请求、不生成内容/PDF，模拟解析 尚未识别→正在识别→识别完成；
// 替换保留点击目标身份并重置解析状态；上限与既有附件上限一致（3 条）；离页回演示初值。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 附件 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('添加→同意→替换→解析→删除走同一共用附件区，模拟状态可观察且零请求 @mock', async ({ page }, testInfo) => {
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
    await hash直达(page, '/#/resume');
    await expect(page.getByText('沈亦舟_简历_2026.pdf')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('初筛通过后发送 PDF 原件')).toBeVisible();
    await expect(page.getByRole('button', { name: '添加附件简历' })).toBeVisible();

    // 正常态截图（与改前拍对照：演示行原样，新增获批的 ＋ 与左滑动作）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-附件-正常.png`, fullPage: true });

    // 点演示行 → 既有原型预览提示（缺真实 PDF，不伪造预览）
    await page.getByText('沈亦舟_简历_2026.pdf').click();
    await expect(page.getByText('原型演示：真机上在这里打开系统 PDF 预览。')).toBeVisible();

    // ＋ → 授权层取消：零变更零请求
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'cancel.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await expect(page.getByText('cancel.pdf')).toHaveCount(0); // 确认前无变更
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByText('允许 AI 识别这份简历？')).toHaveCount(0);

    // 添加 → 同意 → 行以「尚未识别」入列
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'add.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await page.getByRole('button', { name: '同意并继续' }).click();
    const 加行 = page.getByTestId('附件简历行').filter({ hasText: 'add.pdf' });
    await expect(加行).toBeVisible();
    await expect(加行.getByText('尚未识别')).toBeVisible();

    // 解析 → 同意 → 模拟解析 尚未识别 → 正在识别 → 识别完成
    await 左滑附件行(page, 'add.pdf');
    await page.getByRole('button', { name: '解析', exact: true }).click();
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('正在识别')).toBeVisible();
    await expect(page.getByText('识别完成')).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-附件-解析完成.png`, fullPage: true });

    // 替换 → 同意：行身份保留，显示新文件名且旧名消失，解析状态重置（fix(review-r1) F6）
    await 左滑附件行(page, 'add.pdf');
    await page.getByRole('button', { name: '替换', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'replacement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    const 替换行 = page.getByTestId('附件简历行').filter({ hasText: 'replacement.pdf' });
    await expect(替换行).toBeVisible();
    await expect(替换行.getByText('尚未识别')).toBeVisible();
    await expect(page.getByText('add.pdf')).toHaveCount(0);

    // 加到 3/3（与既有附件上限一致）：＋ 消失；行面键盘可聚焦、无横向溢出
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'second.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'second.pdf' })).toBeVisible();
    await expect(page.getByTestId('附件简历行')).toHaveCount(3);
    await expect(page.getByRole('button', { name: '添加附件简历' })).toHaveCount(0);
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-附件-上限.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 演示行面 = page.getByRole('button', { name: /沈亦舟_简历_2026\.pdf/ });
    await 演示行面.focus();
    await expect(演示行面).toBeFocused();

    // 删除：先取消（行保留），再确认（行消失、＋ 回来）
    await 左滑附件行(page, 'second.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.getByText('删除后无法恢复。')).toBeVisible();
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'second.pdf' })).toBeVisible();
    await 左滑附件行(page, 'second.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await page.getByRole('button', { name: '删除附件简历', exact: true }).click();
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'second.pdf' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '添加附件简历' })).toBeVisible();

    // Mock 模拟全程零 API 请求（真实请求数为 0）
    expect(apiRequests).toEqual([]);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 附件 @backend（core editors §5.3 Task 8）：Backend 分支消费同一共用附件区 ——
// 权威 0–3 行、上传/解析授权前零写入、替换按槽位保留身份、失败终态可重新解析（改桩终态
// 后识别完成）、行点开 authenticated content GET、删除取消零 DELETE 确认恰一次。
// 复用现有 创建P2附件fixture 与文件选择机制；网络桩符合已审合同，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 附件 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('添加→同意→替换→重新解析→删除 走同一共用附件区并保持权威契约 @backend', async ({ page }, testInfo) => {
    // 多段 3s 轮询 + 手势 + 删除确认全在一条 journey：显式放宽到 120s
    test.setTimeout(120_000);
    const P2 = 创建P2附件fixture('parser_temporarily_unavailable');
    await 安装BFF路由(page, {
      记录目录请求: () => {}, 登录尝试id: 'att-core-edit-attachment', 附件fixture: P2,
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await hash直达(page, '/#/resume');
    await expect(page.getByText('还未上传附件简历')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '添加附件简历' })).toBeVisible();

    // 空态截图（共用空态照旧）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-附件-空态.png`, fullPage: true });

    // ＋ → 授权层：同意前零写入（基线采样在触发文件选择之前）
    const writesBeforeAdd = P2.写入次数;
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'candidate.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    expect(P2.写入次数).toBe(writesBeforeAdd);
    await page.getByRole('button', { name: '同意并继续' }).click();
    const 首行 = page.getByTestId('附件简历行').filter({ hasText: 'candidate.pdf' });
    await expect(首行).toBeVisible({ timeout: 15_000 });
    // 上传后解析状态机走完 → 失败终态（可重试口径）
    await expect(page.getByText('服务繁忙 · 稍后重试')).toBeVisible({ timeout: 20_000 });

    // 替换 → 同意：槽位身份保留（display name 不变成 replacement.pdf），重新入列解析
    await 左滑附件行(page, 'candidate.pdf');
    await page.getByRole('button', { name: '替换', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'replacement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('replacement.pdf')).toHaveCount(0);
    await expect(首行).toBeVisible();
    await expect(首行.getByText('服务繁忙 · 稍后重试')).toBeVisible({ timeout: 20_000 });

    // 重新解析：授权前零写入；改桩终态 → 同意 → 识别完成
    const writesBeforeParse = P2.写入次数;
    await 左滑附件行(page, 'candidate.pdf');
    await page.getByRole('button', { name: '重新解析', exact: true }).click();
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    expect(P2.写入次数).toBe(writesBeforeParse);
    P2.下次终态 = 'succeeded';
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('识别完成')).toBeVisible({ timeout: 20_000 });

    // 预览：行点击只断言 authenticated content GET，不依赖 headless PDF viewer 内容
    const 内容请求 = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/api/v1/me/resume-files/rf_1/content',
    );
    await 首行.click();
    await 内容请求;
    expect(P2.下载次数).toBeGreaterThanOrEqual(1);

    // 布局门 + viewport 检查：标题几何未漂移、无横向溢出、行面键盘可聚焦
    await 断言附件标题几何未漂移(page);
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-附件-完成.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 行面 = page.getByRole('button', { name: /candidate\.pdf/ });
    await 行面.focus();
    await expect(行面).toBeFocused();

    // 删除：取消零 DELETE；确认恰一次 DELETE 且行消失
    const 删除请求: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE' && new URL(request.url()).pathname.startsWith('/api/v1/me/resume-files')) {
        删除请求.push(request.url());
      }
    });
    const writesBeforeDelete = P2.写入次数;
    await 左滑附件行(page, 'candidate.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.getByText('删除后无法恢复。')).toBeVisible();
    await page.getByRole('button', { name: '取消', exact: true }).click();
    expect(P2.写入次数).toBe(writesBeforeDelete);
    expect(删除请求).toEqual([]);
    await expect(首行).toBeVisible();
    await 左滑附件行(page, 'candidate.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    // 弹层遮罩的 aria-label「关闭删除附件简历？」也含这段文字：exact 只认执行键
    await page.getByRole('button', { name: '删除附件简历', exact: true }).click();
    await expect(首行).toHaveCount(0, { timeout: 10_000 });
    expect(P2.写入次数).toBe(writesBeforeDelete + 1);
    expect(删除请求.length).toBe(1);
  });
});
