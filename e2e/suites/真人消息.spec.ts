// e2e/suites/真人消息.spec.ts
// C6：原「P7 真人会话 fixture / P7 Mock 数据源隔离」等价迁入。

import { expect, test } from '../fixtures/test';
import { 安装P7事件桩, P7带消息fixture, hash直达 } from '../fixtures/数据源交互';
import { P4招聘岗位 } from '../fixtures/bff/发现推荐';
import { P1C标记, P1C招聘组织Fixture, P1C管理员关系, P1C组织甲, 带企业关系 } from '../fixtures/bff/招聘组织';
import { P3隐私fixture } from '../fixtures/bff/隐私与实名';
import { P5编号, P5标记, 创建P5MatchCasefixture, type P5MatchCasefixture形 } from '../fixtures/bff/MatchCase';
import { P7会话编号, P7标记, P7资料标记, 创建P7fixture, type P7FixtureState } from '../fixtures/bff/真人消息';
import { 安装BFF路由, type BFF路由选项 } from '../fixtures/bff/安装BFF路由';
import { type Page } from '@playwright/test';
import { type 拦截请求形 } from '../fixtures/bff/协议';

// ─────────────────────────────────────────────────────────────────────────────
// P7 真人会话 fixture（Task 7）—— 双端 conversations 的浏览器验收旅程。
// 原生 WebSocket 在 app 加载前 stub（__emitP7/__P7断开 只存在于测试 init script，
// 产品 bundle 不含该 seam）；帧不携带真相：内容一律经 no-store HTTP 重拉上屏。
// ─────────────────────────────────────────────────────────────────────────────

/** P7 候选端安装：candidate 会话 + P7 fixture + 事件桩（app 加载前）。 */
async function 装P7候选(
  page: Page,
  选项: {
    fixture?: P7FixtureState;
    覆盖?: BFF路由选项['覆盖'];
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P7FixtureState> {
  const fixture = 选项.fixture ?? 创建P7fixture();
  await 安装P7事件桩(page);
  await 安装BFF路由(page, {
    登录尝试id: 'att-p7-candidate',
    记录目录请求: () => undefined,
    主体初始角色: 'candidate',
    隐私fixture: P3隐私fixture(),
    P7fixture: fixture,
    覆盖: 选项.覆盖,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}
/** P7 招聘端安装：recruiter 会话（组织 fixture）+ P7 fixture + 事件桩。 */
async function 装P7招聘(
  page: Page,
  选项: {
    fixture?: P7FixtureState;
    P5MatchCasefixture?: P5MatchCasefixture形;
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P7FixtureState> {
  const fixture = 选项.fixture ?? 创建P7fixture();
  await 安装P7事件桩(page);
  await 安装BFF路由(page, {
    登录尝试id: 'att-p7-recruiter',
    记录目录请求: () => undefined,
    招聘组织Fixture: 带企业关系(
      P1C招聘组织Fixture,
      [P1C管理员关系],
      { [P1C标记.组织甲编号]: P1C组织甲() },
      [P4招聘岗位({ job_id: P5编号.job, title: P5标记.招聘岗标题 })],
    ),
    主体初始角色: 'recruiter',
    P5MatchCasefixture: 选项.P5MatchCasefixture,
    P7fixture: fixture,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}
test.describe('P7 真人会话 fixture @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('候选端收件箱未读 → 进会话 read-through → 权威收件箱归零 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    fixture.unread.candidate = 1;
    const 请求序: string[] = [];
    await 装P7候选(page, {
      fixture,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    // 主壳首屏水合收件箱：未打开消息 Tab 之前，底部角标已是已加载未读（=1）
    await expect(page.locator('nav').getByText('1', { exact: true })).toBeVisible({ timeout: 15_000 });

    // 消息 Tab：行未读胶囊 + 点击只导航（绝不本地清零）。角标并入按钮无障碍名，用子串匹配。
    await page.locator('nav').getByRole('button').filter({ hasText: '消息' }).click();
    await expect(page.getByText(P7标记.职位名)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`unread-${P7会话编号.会话}`)).toHaveText('1');
    await page.getByText(P7标记.职位名).click();
    await expect(page).toHaveURL(new RegExp(`#/chat/human/${P7会话编号.会话}$`), { timeout: 10_000 });
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 10_000 });

    // read-through：渲染到的最新 user_text 恰好提交一次，PUT 后权威未读归零
    await expect.poll(
      () => fixture.reads.filter((条) => 条.role === 'candidate' && 条.through === '4004').length,
      { timeout: 15_000 },
    ).toBe(1);
    expect(fixture.unread.candidate).toBe(0);
    // 同一 target 重渲染零重复提交
    await page.waitForTimeout(1_000);
    expect(fixture.reads.filter((条) => 条.role === 'candidate').length).toBe(1);
  });

  test('候选端发送：首答结果未知经同键重放收敛，消息只落一条 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    fixture.首答未知 = true; // 消息已落库，但首答 503 operation_outcome_unknown
    await 装P7候选(page, { fixture });

    await hash直达(page, `/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });
    const 输入框 = page.getByRole('textbox', { name: '输入消息' });
    await 输入框.fill(P7标记.候选消息);
    await 输入框.press('Enter');

    // 权威重拉见到同文消息：确认成功、无未知提示、恰一个气泡
    await expect(page.getByText(P7标记.候选消息)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('暂时无法确认是否发送成功')).toHaveCount(0);
    // 幂等服务端：首答 503 后受控重试同键重放 —— 两笔同键 POST、只落一条消息
    const 候选发送 = fixture.sends.filter((条) => 条.content === P7标记.候选消息);
    expect(候选发送.length).toBeGreaterThanOrEqual(2);
    expect(new Set(候选发送.map((条) => 条.key)).size).toBe(1);
    expect(fixture.messages[P7会话编号.会话]!.filter((条) => 条.content === P7标记.候选消息)).toHaveLength(1);
    // 草稿已清空
    await expect(输入框).toHaveValue('');
  });

  test('招聘端经内容无关失效事件 HTTP 重拉看到候选新消息并回复 @backend', async ({ page }) => {
    const fixture = 创建P7fixture();
    fixture.messages[P7会话编号.会话] = [{
      message_id: '4004', kind: 'user_text', sender_role: 'candidate', content: P7标记.候选消息, created_at: '2026-08-30T01:00:00Z',
    }];
    const 请求序: string[] = [];
    await 装P7招聘(page, {
      fixture,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await hash直达(page, `/#/hr/chat/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.候选消息)).toBeVisible({ timeout: 15_000 });

    // 服务端事实先变（候选新消息落库），页面上还看不到
    fixture.messages[P7会话编号.会话]!.push({
      message_id: '5006', kind: 'user_text', sender_role: 'candidate', content: P7标记.招聘回复, created_at: '2026-08-30T01:30:00Z',
    });
    await expect(page.getByText(P7标记.招聘回复)).toHaveCount(0);

    // 内容无关帧：只触发 no-store HTTP 重拉
    const 消息GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/recruiter/conversations/${P7会话编号.会话}/messages`).length;
    const 帧前 = 消息GET数();
    await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__emitP7({ type: 'recruitment.conversation_changed', conversation_id: '3003', reason: 'message_created' }));
    await expect(page.getByText(P7标记.招聘回复)).toBeVisible({ timeout: 10_000 });
    expect(消息GET数()).toBeGreaterThan(帧前); // 上屏来自 HTTP，不是帧

    // 招聘回复走同一发送链
    const 输入框 = page.getByRole('textbox', { name: '输入消息' });
    await 输入框.fill(P7标记.招聘消息);
    await 输入框.press('Enter');
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 10_000 });
    expect(fixture.sends.some((条) => 条.role === 'recruiter' && 条.content === P7标记.招聘消息)).toBe(true);
  });

  test('断线重连无条件重拉当前角色收件箱与当前会话 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    const 请求序: string[] = [];
    await 装P7候选(page, {
      fixture,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await hash直达(page, `/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });

    const 收件箱GET数 = () => 请求序.filter((项) => 项 === 'GET /api/v1/me/conversations').length;
    const 消息GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/me/conversations/${P7会话编号.会话}/messages`).length;
    const 断前 = [收件箱GET数(), 消息GET数()];
    // 主动断开（socket 关闭）→ 1s 退避重连 → onOpen 无条件重拉可见范围
    await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__P7断开());
    await expect.poll(() => 收件箱GET数(), { timeout: 10_000 }).toBeGreaterThan(断前[0]);
    await expect.poll(() => 消息GET数(), { timeout: 5_000 }).toBeGreaterThan(断前[1]);
  });

  test('context 不可用保留消息、主项占位禁用，提供重新加载会话信息 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    fixture.contexts[P7会话编号.会话] = 'unavailable';
    await 装P7候选(page, { fixture });

    await hash直达(page, `/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });
    // Spec §11.3：操作栏三项在场但主项占位禁用（不伪装可用）；电话/微信是缺失占位
    await expect(page.getByRole('button', { name: '看职位' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '电话' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: '微信' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: '重新加载会话信息' })).toBeVisible();
  });

  // ── Spec §11.2/§11.3：双端页头身份、发布方公司、操作栏占位与全屏资料/PDF 层 ──
  test('候选端页头身份与全屏职位层：发布方公司不冒充用人企业，电话微信诚实缺失 @backend', async ({ page }, testInfo) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    await 装P7候选(page, { fixture });

    await hash直达(page, `/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });
    // 页头 = Case 冻结发布人档案 + 发布方公司（猎头）· 职务；用人企业不得顶替
    await expect(page.getByText(P7资料标记.发布人姓名)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`${P7资料标记.发布方名称} · ${P7资料标记.发布人职务}`)).toBeVisible();
    expect(await page.getByText(P7资料标记.用人企业名).count()).toBe(0);
    // 电话/微信缺失占位：无号码、不可复制（展开区是纯说明行）
    await page.getByRole('button', { name: '电话' }).click();
    await expect(page.getByText('电话暂未提供')).toBeVisible();
    await expect(page.getByText(/1[0-9 ]{6,}/)).toHaveCount(0);
    // 看职位盖全屏层（路由不动）：冻结职位资料正文 + 继续沟通回聊天
    await page.getByRole('button', { name: '看职位' }).click();
    await expect(page.getByRole('dialog', { name: '看职位' })).toBeVisible();
    await expect(page.getByText(P7资料标记.冻结职位说明)).toBeVisible({ timeout: 10_000 });
    // 层内同样不得拿用人企业/当前岗位替代发布方或冻结资料：冻结 organization 缺席 →
    // 公司名缺失占位、无可信组织坐标的公司入口禁用并解释
    await expect(page.getByRole('dialog').getByText(P7资料标记.用人企业名)).toHaveCount(0);
    await expect(page.getByText('公司详情暂不可用')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('p7-job-layer-390.png') });
    await page.getByRole('button', { name: '继续沟通' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`#/chat/human/${P7会话编号.会话}$`));
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible();
  });

  test('招聘端页头候选真名与全屏 PDF 层：授权原件正文、关闭回聊天 @backend', async ({ page }, testInfo) => {
    const fixture = 创建P7fixture();
    fixture.messages[P7会话编号.会话] = [{
      message_id: '4004', kind: 'user_text', sender_role: 'recruiter', content: P7标记.招聘消息, created_at: '2026-09-16T01:09:00Z',
    }];
    await 装P7招聘(page, { fixture });

    await hash直达(page, `/#/hr/chat/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });
    // 页头 = Case candidateIdentity（disclosed 真名）+ Case 职位名
    await expect(page.getByText('P5 Fixture 候选真名')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P7标记.职位名).first()).toBeVisible();
    // 看简历开层才取件：PDF iframe 以对象租约地址呈现真实字节
    await page.getByRole('button', { name: '看简历' }).click();
    await expect(page.getByRole('dialog', { name: '看简历' })).toBeVisible();
    const 框 = page.getByTitle('简历 PDF');
    await expect(框).toBeVisible({ timeout: 10_000 });
    expect((await 框.getAttribute('src')) ?? '').toMatch(/^blob:/);
    await page.screenshot({ path: testInfo.outputPath('p7-pdf-layer-390.png') });
    await page.getByRole('button', { name: '继续沟通' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`#/hr/chat/${P7会话编号.会话}$`));
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible();
  });

  test('foreign/wrong-role 404 不保留上一会话残留 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    fixture.不存在 = ['9900'];
    await 装P7候选(page, { fixture });

    await hash直达(page, `/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });

    // 深链不存在的会话：404 fail closed，上一会话内容不泄漏
    await hash直达(page, '/#/chat/human/9900');
    await expect(page.getByText('这段会话不存在或已不可访问').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P7标记.招聘消息)).toHaveCount(0);
    await expect(page.getByText(P7标记.职位名)).toHaveCount(0); // 详情 context 残留也不泄漏
  });

  test('P5 发布后招聘端「开始私聊」进入企业参数路由 @backend @s0-s3-display', async ({ page }) => {
    const P5fixture = 创建P5MatchCasefixture();
    const 己 = P5fixture.cases[P5编号.己]!;
    己.step = 'complete';
    己.conversationRef = P7会话编号.会话;
    await 装P7招聘(page, {
      fixture: 创建P7fixture(),
      P5MatchCasefixture: P5fixture,
    });

    await hash直达(page, `/#/hr/candidate/${P5编号.己}`);
    // S0–S3 展示统一 Task 4：移交行装在意向确认段尾（completed 全段已过折叠，点开可达）
    await page.getByRole('button', { name: /意向确认/ }).click();
    await expect(page.getByText('真人会话已建立').first()).toBeVisible({ timeout: 15_000 });
    const 私聊键 = page.getByRole('button', { name: '开始私聊' });
    await expect(私聊键).toBeEnabled();
    await 私聊键.click();
    await expect(page).toHaveURL(new RegExp(`#/hr/chat/${P7会话编号.会话}$`), { timeout: 10_000 });
  });
});

// ── Spec §11.5/§11.6：消息时间源与短气泡几何 —— 两个显式 timezoneId describe 各一条
//    聚焦用例（clock 冻结当前年 2026），对方/我方各给不同 createdAt（09:07Z/09:09Z），
//    不复制整个旅程；Shanghai 组顺带 390 几何与截图、UTC 组用 320 视口对照。 ──
for (const 时区 of ['Asia/Shanghai', 'UTC'] as const) {
  test.describe(`P7 消息时间与短气泡几何 ${时区} @backend`, () => {
    test.use({
      baseURL: 'http://127.0.0.1:4182',
      viewport: { width: 时区 === 'Asia/Shanghai' ? 390 : 320, height: 844 },
      locale: 'zh-CN',
      timezoneId: 时区,
      reducedMotion: 'reduce',
    });

    test(`每条消息各用 createdAt 本地时间；短气泡贴合内容、长文不溢出 @backend`, async ({ page }, testInfo) => {
      const 长文 = `${'这是一条足够长的消息，验证长气泡达到上限后换行、不把页面撑宽。'.repeat(6)}以及没有空格的超长英文串${'x'.repeat(140)}`;
      const fixture = 创建P7fixture();
      fixture.messages[P7会话编号.会话] = [
        { message_id: '4001', kind: 'user_text', sender_role: 'recruiter', content: 'HiHi', created_at: '2026-09-16T09:07:00Z' },
        { message_id: '4002', kind: 'user_text', sender_role: 'candidate', content: 'HHHH', created_at: '2026-09-16T09:09:00Z' },
        { message_id: '4003', kind: 'user_text', sender_role: 'recruiter', content: `**加粗**的${长文}`, created_at: '2026-09-16T09:11:00Z' },
      ];
      await 装P7候选(page, { fixture });
      // 冻结「当前年」为 2026：跨年显示口径不依赖运行机器的真实日期
      await page.clock.install({ time: new Date('2026-09-16T12:00:00Z') });

      await hash直达(page, `/#/chat/human/${P7会话编号.会话}`);
      await expect(page.getByText('HHHH')).toBeVisible({ timeout: 15_000 });

      // 每条各用各的 createdAt（本地时区 MM-DD HH:mm；不取 AI 整轮时间、不 UTC 截取）
      const 对方文 = 时区 === 'Asia/Shanghai' ? '09-16 17:07' : '09-16 09:07';
      const 我方文 = 时区 === 'Asia/Shanghai' ? '09-16 17:09' : '09-16 09:09';
      await expect(page.locator('[data-侧="左"] time').first()).toHaveText(对方文);
      await expect(page.locator('[data-侧="右"] time').first()).toHaveText(我方文);

      // 几何：短气泡贴合内容（远窄于长气泡）、长文不横向溢出
      const 尺寸 = await page.evaluate(() => {
        const 行们 = Array.from(document.querySelectorAll('[data-侧]'));
        const 找 = (文: string) => 行们.find((行) => 行.textContent?.includes(文));
        const 气泡宽 = (行: Element | undefined) => {
          const 时间 = 行?.querySelector('time');
          return 时间?.previousElementSibling?.getBoundingClientRect().width ?? Number.NaN;
        };
        return {
          短宽: 气泡宽(找('HiHi')),
          我短宽: 气泡宽(找('HHHH')),
          长宽: 气泡宽(找('加粗')),
          溢出: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(尺寸.溢出, '页面横向溢出').toBe(0);
      expect(尺寸.短宽, '短气泡贴合内容').toBeLessThan(120);
      expect(尺寸.我短宽, '我方短气泡贴合内容').toBeLessThan(120);
      expect(尺寸.长宽, '长气泡显著宽于短气泡').toBeGreaterThan(尺寸.短宽 + 120);
      // markdown 正文：**加粗** 解析为 strong
      await expect(page.locator('strong').filter({ hasText: '加粗' })).toHaveCount(1);

      await page.screenshot({ path: testInfo.outputPath(`p7-bubbles-${时区 === 'Asia/Shanghai' ? 390 : 320}.png`) });
    });
  });
}
// ── P7 Mock 隔离：Mock 双端零 P7 请求与零事件连接 ──────────────────────────────
test.describe('P7 Mock 数据源隔离 @mock', () => {
  test('Mock 双端消息旅程零 /conversations 请求与零 WebSocket @mock', async ({ page }) => {
    await 安装P7事件桩(page);
    const 会话请求: string[] = [];
    page.on('request', (请求) => {
      if (/\/api\/v1\/(me|recruiter)\/conversations/.test(请求.url())) {
        会话请求.push(请求.url());
      }
    });

    // Mock 无路由守卫：直接进两端主壳（零登录旅程，聚焦 P7 隔离断言）
    await hash直达(page, '/#/app');
    await page.locator('nav').getByRole('button').filter({ hasText: '消息' }).click();
    await expect(page.getByText('AI代理动态')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('林筱')).toBeVisible();
    // 企业端镜像
    await hash直达(page, '/#/hr');
    await page.locator('nav').getByRole('button').filter({ hasText: '消息' }).click();
    await expect(page.getByText('AI代理动态')).toBeVisible({ timeout: 10_000 });

    // 全程零 P7 HTTP 与零事件连接
    expect(会话请求).toEqual([]);
    // 零事件连接：Vite dev 的 HMR 也走 WebSocket（非事件端点），只统计 /api/v1/events/live
    const 事件套接字数 = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).__P7套接字们 as Array<{ url: string }>)
        .filter((套) => 套.url.includes('/api/v1/events/live')).length);
    expect(事件套接字数).toBe(0);
  });
});
