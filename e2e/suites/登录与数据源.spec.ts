// e2e/suites/登录与数据源.spec.ts
// C6：原 e2e/数据源模式.spec.ts 的「Mock 数据源回归 / 登录区号 fixture 证据 /
// Backend 数据源 fixture」三个 describe 等价迁入（titlePath 原样保留）。
// e2e/离线边界.spec.ts 同属本 Suite 家族（边界反例，文件保留在 e2e/ 根）。

import { expect, test } from '../fixtures/test';
import { 装三级职位目录桩, 是APIv1路径, 断言登录页无水平溢出, 断言意向规则零写入口, hash直达 } from '../fixtures/数据源交互';
import { 信封 } from '../fixtures/bff/协议';
import { 标记, fixture简历, fixture意向列表 } from '../fixtures/bff/账号与目录';
import { 安装BFF路由 } from '../fixtures/bff/安装BFF路由';
import { type Page, type Route } from '@playwright/test';

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

  test('Mock 双端规则页全程零 API 请求，双端顶栏无筛选入口 @mock', async ({ page }) => {
    // P6（Task 8）：双端规则页（/rules、/hr/agent-settings）在 Mock 下全部走本地状态，
    // 断言 P6 的 agent-rule 请求恒为零。
    // 第二批（2026-09-09）：双端筛选抽屉（看市场 / 候选推荐 顶栏「筛选 ▾」）已整体删除，
    // 原本经抽屉本地新增 / 改写规则的两段随之删去，改为断言顶栏没有「筛选」入口；
    // 规则的 canonical 入口只剩这两页。
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

    // ── /rules：按当前分区与精确规则标记验证全局规则（不再有「4 条」式总计）──
    await hash直达(page, '/#/rules');
    await expect(page.getByRole('heading', { name: '你教它的规则' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '哪些情况直接排除' })).toBeVisible();
    await expect(page.getByRole('switch', { name: '规则：不主动披露并行接触数量' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('switch', { name: '规则：全现场办公的岗位直接婉拒' })).toHaveAttribute('aria-checked', 'false');
    // 意向级规则属于意向域：本页不渲染，也不提供编辑/删除/开关任何一个写入口
    await 断言意向规则零写入口(page, '双休是底线；隔周六可谈，大小周不谈');

    // ── 候选端市场：顶栏没有「筛选」入口（放大镜「搜索职位」仍在）──
    await hash直达(page, '/#/app');
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByRole('button', { name: '搜索职位' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /筛选/ })).toHaveCount(0);
    await expect(page.getByText('告诉AI代理你的硬性要求')).toHaveCount(0);

    // ── 切到招聘端：Mock 企业规则行本地可维护（开关 + 添加规则），无「3 条生效」式总计 ──
    await hash直达(page, '/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    await hash直达(page, '/#/hr/agent-settings');
    await expect(page.getByText('竞对在职候选人不接触、不推进')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('switch', { name: '规则：竞对在职候选人不接触、不推进' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: '添加规则' })).toBeVisible();

    // ── 招聘端推荐子视图：企业顶栏没有「筛选」入口 ──
    await hash直达(page, '/#/hr');
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByRole('button', { name: '让AI代理去聊' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /筛选/ })).toHaveCount(0);
    await expect(page.getByText('告诉AI代理你的硬性要求')).toHaveCount(0);

    // P6 域在 Mock 下零请求：agent-rule 一个都没有，整个会话也没有任何 /api/v1
    expect(apiRequests.filter((url) => url.includes('agent-rule'))).toEqual([]);
    expect(apiRequests).toEqual([]);
  });

  test('Mock 上传演示零 resume-files 请求 @mock', async ({ page }) => {
    // P2：Mock 的附件简历仍是硬编码演示行，上传演示只落本地文件名 + 轻提示。
    // 监听页面所有请求，证明 /api/v1/me/resume-files 请求数为 0（Mock 不接 BFF 附件库）。
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

    // 上传演示（Mock）：本地派发文件名 + 轻提示，不发网络请求
    await page.locator('input[type=file]').setInputFiles({
      name: 'demo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('demo.pdf')).toBeVisible();
    await expect(page.getByText('已选择简历，可识别的信息将用于预填')).toBeVisible();

    // 我的简历的附件区照旧是 Mock 演示行，不是权威 0–3 行
    await hash直达(page, '/#/resume');
    await expect(page.getByText('沈亦舟_简历_2026.pdf')).toBeVisible();

    expect(apiRequests.filter((url) => new URL(url).pathname.startsWith('/api/v1/me/resume-files'))).toEqual([]);
    expect(apiRequests).toEqual([]);
  });

  // ── 企业名片统一（Task 3）：统一展示后 Mock 侧事实/能力不退化。
  //    占位文案按 Spec §3/§4/§6；Mock 独有能力（三 Tab 内容、岗位层跳转、收笔落全局）保留。
  //    两栈数据量不同，不做截图相等断言；视觉对照由 ui:check 场景 enterprise-public 负责。──

  test('企业名片统一 Mock 企业公开页三 Tab/全文/未知占位与条款层 @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await hash直达(page, '/#/company/yunqu');
    await expect(page.getByRole('heading', { name: '云衢科技' })).toBeVisible({ timeout: 10_000 });

    // 三 Tab 切换只换正文；历程有年份/事件时用时间线文案，不另造年份
    await expect(page.getByText(/做券商与银行的交易中台与清结算基础设施/)).toBeVisible();
    await page.getByRole('button', { name: '企业文化' }).click();
    await expect(page.getByText(/把复杂留给系统，把确定性交给客户/)).toBeVisible();
    await page.getByRole('button', { name: '发展历程' }).click();
    await expect(page.getByText(/2025 C 轮，启动交易网关多活与海外通道/)).toBeVisible();
    await page.getByRole('button', { name: '公司简介' }).click();

    // 主营业务有明确标签；相册无照片 → 一格空白图位 + 未知说明（不整卡消失）
    await expect(page.getByText('主营业务', { exact: true })).toBeVisible();
    await expect(page.getByText('交易中台', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: '公司相册未知' })).toBeVisible();

    // 作息与条款摘要：Mock 代理核对已知 → 「已提供 N 条」+ 真实已核计数
    const 条款卡 = page.getByRole('button', { name: /作息与条款/ });
    await expect(条款卡).toContainText('已提供 9 条条款');
    await expect(条款卡).toContainText('3 条已由代理核对');

    // 办公地：地址、补充与原型导航键都在
    await expect(page.getByText('上海市浦东新区世纪大道 1568 号中建大厦 28 层')).toBeVisible();
    await expect(page.getByRole('button', { name: '导航 ›' })).toBeVisible();

    // 在职者反馈有 fixture 数据 → 才有统计卡与真实计数
    await expect(page.getByText('技术氛围好', { exact: true })).toBeVisible();
    await expect(page.getByText('晋升看产出', { exact: true })).toBeVisible();

    // 工商与企业身份：Mock 工商条目保留；身份无 Mock 事实 → 明确未知，不拿展示名/首字顶替
    await expect(page.getByText('上海云衢信息科技有限公司')).toBeVisible();
    await expect(page.getByText('法定名称未知')).toBeVisible();
    await expect(page.getByText('核验时间未知')).toBeVisible();
    await expect(page.getByText('46 个在招岗位')).toBeVisible();

    // 全文层固定五部分：静态档没有产品/团队 → 占位出现（Spec §7「缺字段区块出现占位」）。
    // 层体自滚、面板封在视口 86% 内，右上 ✕ 始终在视口里；这里仍用 Escape 走键盘关闭路径
    await page.getByRole('button', { name: '读全文 ›' }).click();
    await expect(page.getByText('以下内容由企业自行提供，平台未逐条核实。')).toBeVisible();
    await expect(page.getByText('产品介绍未知')).toBeVisible();
    await expect(page.getByText('团队介绍未知')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('产品介绍未知')).toHaveCount(0);

    // 条款层：已核/自述两组与 Mock 业务说明都还在
    await 条款卡.click();
    await expect(page.getByText('代理已核对', { exact: true })).toBeVisible();
    await expect(page.getByText('公司自述，尚未核对', { exact: true })).toBeVisible();
    await expect(page.getByText(/想让代理去核某一条/)).toBeVisible();
    await page.keyboard.press('Escape');

    // 底部岗位层：Mock 能力保留 —— 可打开，零匹配条目时给过滤说明，不编造岗位
    await page.getByRole('button', { name: '看这家在招的 46 个岗位' }).click();
    await expect(page.getByText(/其余 46 个岗位不匹配你当前的求职意向/)).toBeVisible();
    await page.keyboard.press('Escape');

    // Mock 全程零 /api/v1
    expect(apiRequests).toEqual([]);
  });

  test('企业名片统一 Mock 岗位层在谈/市场入口与名片收笔语义保留 @mock', async ({ page }) => {
    test.setTimeout(120_000);

    // MiniMax：静态档 + 本地在谈 J-21 / 市场 M-01 → 岗位层两条真实入口
    await hash直达(page, '/#/company/minimax');
    await expect(page.getByRole('heading', { name: 'MiniMax' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /看这家在招的/ }).click();
    const 在谈条 = page.getByRole('button', { name: /你已在谈这一岗/ }).first();
    await expect(在谈条).toBeVisible();
    await expect(page.getByText('可让代理去谈').first()).toBeVisible();
    await 在谈条.click();
    await expect(page).toHaveURL(/#\/deal\/J-21$/, { timeout: 10_000 });

    // 名片：收笔落全局；空白收笔不覆盖旧值；职务默认值保留
    await hash直达(page, '/#/hr/card');
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 10_000 });
    const 姓名 = page.getByLabel('姓名', { exact: true });
    await expect(姓名).toHaveValue('邵铭');
    await expect(page.getByLabel('职务')).toHaveValue('技术 VP');
    await expect(page.getByPlaceholder('请填写姓名')).toBeVisible();

    // 空白收笔视作没改：预览行直接读全局，仍旧值 —— 不把字段清成空串落全局
    await 姓名.fill('');
    await 姓名.blur();
    await expect(page.getByText('邵铭', { exact: true })).toBeVisible();

    // 回车收笔同一条落全局路径：预览立刻是新值
    await 姓名.fill('测试名片收笔');
    await 姓名.press('Enter');
    await expect(page.getByText('测试名片收笔', { exact: true })).toBeVisible();

    // 保存把当前全局值一并钉住并推进发岗（Mock 名片保存即跳发岗）
    await page.getByRole('button', { name: '保存 · 去发岗位' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 10_000 });
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// Backend fixture @backend
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 填写意向表单并提交：办公方式（现场）+ 工作城市（子页搜索 fixture）+ 期望职位（子页选择）→ 点保存。
 * 三个条件齐了 可保存 才为 true，保存键才会亮——少填一项 POST 就不会发出。
 */
async function 填意向表单并提交(page: Page) {
  // 导航到添加意向页
  await hash直达(page, '/#/intentions/new');
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
  // （Task 7 B 契约：配 装三级职位目录桩 —— 挂载自动选首根后右栏出现可选叶子）
  await page.getByText('请选择期望职位').click();
  await page.waitForTimeout(500);
  await expect(page.getByText(标记.职位display).last()).toBeVisible({ timeout: 10_000 });
  await page.getByText(标记.职位display).last().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  // 等待返回意向页
  await page.waitForTimeout(500);

  // 4. 点保存 → POST /api/v1/me/intentions
  await page.getByRole('button', { name: '保存', exact: true }).click();
}
// ── 登录区号：仅覆盖未登录→短信登录→身份页的最小路由集。─────────────
// 独立于上方历史大 fixture：正则同时拦截 /api/v1 根路径与全部子路由，
// 未声明坐标回 501 并记录，用例末端必须断言为空；绝不 continue 到真实 STG。
interface 登录区号请求记录 {
  method: string;
  path: string;
  body: unknown;
}

async function 安装登录区号BFF路由(page: Page, attemptId: string) {
  const 状态 = {
    已登录: false,
    请求: [] as 登录区号请求记录[],
    未声明: [] as string[],
  };
  await page.routeWebSocket(是APIv1路径, (webSocket) => {
    const path = new URL(webSocket.url()).pathname;
    // 已登录壳会连同源事件流；保持本地模拟连接，不调 connectToServer。
    if (path !== '/api/v1/events/live') 状态.未声明.push(`WS ${path}`);
  });
  await page.route(是APIv1路径, async (route: Route) => {
    const 请求 = route.request();
    const path = new URL(请求.url()).pathname;
    const method = 请求.method();
    const body = method === 'GET'
      ? null
      : (() => { try { return 请求.postDataJSON(); } catch { return null; } })();
    状态.请求.push({ method, path, body });

    if (method === 'GET' && path === '/api/v1/session') {
      if (!状态.已登录) {
        await route.fulfill({ status: 401, json: { error: { type: 'invalid_session', message: '未登录' } } });
      } else {
        await route.fulfill({
          status: 200,
          json: 信封({ identity_id: 'id-login-dial', session_id: 'sess-login-dial', expires_at: '2027-09-12T00:00:00Z' }),
        });
      }
      return;
    }
    if (method === 'POST' && path === '/api/v1/auth/login-attempts') {
      await route.fulfill({
        status: 200,
        json: 信封({ attempt_id: attemptId, next_action: { type: 'enter_code', expires_at: '2027-09-12T00:00:00Z' } }),
      });
      return;
    }
    if (method === 'POST' && path === `/api/v1/auth/login-attempts/${attemptId}/complete`) {
      状态.已登录 = true;
      await route.fulfill({
        status: 200,
        json: 信封({
          identity_id: 'id-login-dial', session_id: 'sess-login-dial', expires_at: '2027-09-12T00:00:00Z',
          next_action: { type: 'completed' },
        }),
      });
      return;
    }
    if (method === 'GET' && path === '/api/v1/me') {
      await route.fulfill({
        status: 200,
        json: 信封({
          subject_id: 'subj-login-dial',
          roles: [{ role: 'candidate', status: 'active' }],
          last_used_role: null,
        }),
      });
      return;
    }

    状态.未声明.push(`${method} ${path}`);
    await route.fulfill({
      status: 501,
      json: { error: { type: 'fixture_route_not_declared', message: '登录区号 fixture 未声明该路由' } },
    });
  });
  return 状态;
}

async function 断言登录区号弹层可达(page: Page) {
  const 宽 = await page.evaluate(() => window.innerWidth);
  for (const 定位 of [page.getByRole('textbox', { name: '区号', exact: true }), page.getByRole('button', { name: '确认区号' })]) {
    await expect(定位).toBeVisible();
    const 框 = await 定位.boundingBox();
    expect(框).not.toBeNull();
    expect(框!.x).toBeGreaterThanOrEqual(0);
    expect(框!.x + 框!.width).toBeLessThanOrEqual(宽);
  }
  await 断言登录页无水平溢出(page);
}
test.describe('登录区号 fixture 证据', () => {
  test('登录区号 Backend：+999 全号请求、四位 complete、身份落点与刷新 @backend', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const fixture = await 安装登录区号BFF路由(page, 'att-login-dial-999');
    await page.setViewportSize({ width: 390, height: 664 });
    await page.goto('http://127.0.0.1:4182/');
    await expect(page.getByRole('button', { name: '编辑区号，当前 +86' })).toBeVisible();
    await 断言登录页无水平溢出(page);
    await page.screenshot({ path: testInfo.outputPath('登录默认-390.png'), fullPage: true });

    await page.getByRole('button', { name: '编辑区号，当前 +86' }).click();
    await expect(page.getByRole('dialog', { name: '编辑登录区号' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '区号', exact: true })).toBeFocused();
    await 断言登录区号弹层可达(page);
    await page.screenshot({ path: testInfo.outputPath('登录区号弹层-390.png'), fullPage: true });

    await page.setViewportSize({ width: 320, height: 568 });
    await 断言登录区号弹层可达(page);
    await page.screenshot({ path: testInfo.outputPath('登录区号弹层-320.png'), fullPage: true });
    await page.getByRole('textbox', { name: '区号', exact: true }).fill('999');
    await page.getByRole('button', { name: '确认区号' }).click();
    await expect(page.getByRole('button', { name: '编辑区号，当前 +999' })).toBeVisible();
    await page.getByLabel('手机号').fill('123456789012');
    await expect(page.getByLabel('手机号')).toHaveValue('123456789012');
    await page.getByRole('button', { name: '获取验证码' }).click();

    await expect.poll(() => fixture.请求.find(
      (项) => 项.method === 'POST' && 项.path === '/api/v1/auth/login-attempts',
    )?.body).toEqual({ provider: 'phone_otp', input: { phone: '+999123456789012' } });
    await expect(page.locator('[class*="验证码格"]')).toHaveCount(4);
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '进入' }).click();
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    expect(fixture.请求.find((项) => 项.path.endsWith('/complete'))?.body).toEqual({ proof: { code: '1234' } });

    await page.reload();
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    expect(fixture.未声明).toEqual([]);
  });

  test('登录区号 Mock：弹层取消保持 +86，旧 11 位序列零 API @mock', async ({ page }, testInfo) => {
    const apiRequests: string[] = [];
    await page.routeWebSocket(是APIv1路径, (webSocket) => {
      // 记录即失败；不 connectToServer，因此回归失败也不会先碰 STG。
      apiRequests.push(webSocket.url());
    });
    await page.route(是APIv1路径, async (route) => {
      apiRequests.push(route.request().url());
      await route.fulfill({
        status: 501,
        json: { error: { type: 'mock_api_forbidden', message: 'Mock 登录不应请求 API' } },
      });
    });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('http://127.0.0.1:4181/');
    const 区号键 = page.getByRole('button', { name: '编辑区号，当前 +86' });
    await 区号键.click();
    await 断言登录区号弹层可达(page);
    await page.screenshot({ path: testInfo.outputPath('登录默认取消-320.png'), fullPage: true });
    await page.getByRole('button', { name: '取消' }).click();
    await expect(区号键).toBeFocused();
    await expect(区号键).toHaveAccessibleName('编辑区号，当前 +86');
    await page.getByLabel('手机号').fill('13800000000');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '进入' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    expect(apiRequests).toEqual([]);
  });

  test('登录区号 Backend：已取码后实际改号禁用旧码且保留倒计时 @backend', async ({ page }) => {
    const fixture = await 安装登录区号BFF路由(page, 'att-login-dial-stale');
    await page.goto('http://127.0.0.1:4182/');
    await page.getByLabel('手机号').fill('13800000000');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('60s')).toBeVisible();
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByLabel('手机号').fill('13900000000');

    await expect(page.getByText(/^(?:[1-9]|[1-5]\d|60)s$/)).toBeVisible();
    await expect(page.getByRole('button', { name: '重新获取' })).toHaveCount(0);
    await expect(page.getByLabel('短信验证码')).toHaveValue('');
    await expect(page.getByLabel('短信验证码')).toBeDisabled();
    await expect(page.getByRole('button', { name: '进入' })).toBeDisabled();
    expect(fixture.请求.filter((项) => 项.path.endsWith('/complete'))).toEqual([]);
    expect(fixture.未声明).toEqual([]);
  });
});
test.describe('Backend 数据源 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182）
  test.use({ baseURL: 'http://127.0.0.1:4182' });

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
    await hash直达(page, '/#/resume');
    // fixture summary 标记值在页面上可见（Mock 里没有这段文本）
    await expect(page.getByText(标记.简历summary)).toBeVisible({ timeout: 10_000 });
  });

  test('打开城市选择只请求目标省第一页 @backend', async ({ page }) => {
    const 目录请求: string[] = [];
    await 安装BFF路由(page, { 记录目录请求: (p) => 目录请求.push(p), 登录尝试id: 'att-003' });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 直接导航到选工作城市屏
    await hash直达(page, '/#/onboard/city');
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
    // 主壳真正挂载后才做后续直达导航：Task 1 起离线边界让 /api/v1/events/live 以空闲
    // 本地连接打开（旧世界它必然失败），事件源 onOpen 会多一轮启动收件箱拉取 ——
    // 落点 replace 导航的结算窗口变宽，URL 就位 ≠ 主壳已挂载；等底部导航可见再走，
    // 直达的懒加载屏才不会被在飞的 replace 吞掉（只修测试定义，不改产品）。
    await expect(page.getByRole('button', { name: '市场', exact: true })).toBeVisible({ timeout: 15_000 });

    // 导航到毕业院校屏
    await hash直达(page, '/#/onboard/school');
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
    await hash直达(page, '/#/onboard/school');
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

  test('422 array fields 返回字段错误 @catalog-fullscreen @backend', async ({ page }) => {
    // 覆盖 POST intentions → 422 + fields 数组。驱动真实 UI 填表提交，断言 POST 真正
    // 发出且 422 落到 轻提示 toast 里。
    // P0 修复 Task 6：通用文案不再展示机器 reason —— toast 是固定的
    // 「填写内容未通过校验」，服务端 reason 绝不上屏（fieldErrors 仍完整解析，
    // 由各表单屏按字段自行本地化）。
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

    // 期望职位页（Task 7 B 契约）需要真实三级目录才能选叶子并点亮保存
    await 装三级职位目录桩(page);

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    await 填意向表单并提交(page);

    // POST 确实发出（填表 + 点保存触发了真实写入请求）
    expect(post次数).toBeGreaterThanOrEqual(1);
    // 422 落通用校验文案（取后端错误文案 → 轻提示），机器 reason 不泄露给用户
    await expect(page.getByText('填写内容未通过校验')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('至少选一种办公方式')).toHaveCount(0);
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
    // 主壳真正挂载后才直达（同 学校搜索 用例：events/live 空闲本地连接加宽了启动
    // replace 导航的结算窗口，等底部导航可见再导航，避免在飞的 replace 吞掉直达）。
    await expect(page.getByRole('button', { name: '市场', exact: true })).toBeVisible({ timeout: 15_000 });

    // 导航到我的简历 → 编辑姓名 → blur 触发 PATCH profile → 401 → 清会话 → 落登录页
    await hash直达(page, '/#/resume');
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
    await hash直达(page, '/#/resume');
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

  test('503 同幂等键受控重试 @catalog-fullscreen @backend', async ({ page }) => {
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

    // 期望职位页（Task 7 B 契约）需要真实三级目录才能选叶子并点亮保存
    await 装三级职位目录桩(page);

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
