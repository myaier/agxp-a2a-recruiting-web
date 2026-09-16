// e2e/suites/账号与支持.spec.ts
// C6：原「P8 控制面 fixture / P8 Mock 数据源隔离」等价迁入。

import { expect, test } from '../fixtures/test';
import { P7带消息fixture, hash直达 } from '../fixtures/数据源交互';
import { 信封, type 拦截请求形 } from '../fixtures/bff/协议';
import { P4编号, P4标记, P4发现fixture, type P4发现fixture形 } from '../fixtures/bff/发现推荐';
import { P1C招聘组织Fixture } from '../fixtures/bff/招聘组织';
import { P3隐私fixture } from '../fixtures/bff/隐私与实名';
import { P7会话编号, P7标记, type P7FixtureState } from '../fixtures/bff/真人消息';
import { P8键模式, P8编号, P8标记, 创建P8fixture, type P8FixtureState, type P8变更回执形 } from '../fixtures/bff/账号控制面';
import { 安装BFF路由, type BFF路由选项 } from '../fixtures/bff/安装BFF路由';
import { type Page } from '@playwright/test';

// ── P8 控制面域用例的公共安装/断言 ─────────────────────────────────────────────

/** P8 候选端安装：candidate 会话 + P3 隐私 + P8 控制面 fixture（+ 可选 P7/P4/组织域）。 */
async function 装P8候选(
  page: Page,
  选项: {
    fixture?: P8FixtureState;
    P7fixture?: P7FixtureState;
    发现fixture?: P4发现fixture形;
    招聘组织Fixture?: BFF路由选项['招聘组织Fixture'];
    隐私fixture?: BFF路由选项['隐私fixture'];
    覆盖?: BFF路由选项['覆盖'];
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P8FixtureState> {
  const fixture = 选项.fixture ?? 创建P8fixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-p8-candidate',
    记录目录请求: () => undefined,
    主体初始角色: 'candidate',
    招聘组织Fixture: 选项.招聘组织Fixture,
    隐私fixture: 选项.隐私fixture ?? P3隐私fixture(),
    发现fixture: 选项.发现fixture,
    P7fixture: 选项.P7fixture,
    P8控制面fixture: fixture,
    覆盖: 选项.覆盖,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** P8 变更存证的统一断言：浏览器 Origin 与 fixture server 同源；幂等键 16–128 可见 ASCII。 */
function 断言P8变更边界(条: P8变更回执形, 源: string): void {
  expect(条.origin).toBe(源);
  expect(条.idempotencyKey).toMatch(P8键模式);
}
// ─────────────────────────────────────────────────────────────────────────────
// P8 控制面 Backend 旅程（Task 8）。账号安全（凭证/会话/退出其他设备/换绑）、数据导出
// （恢复/创建/轮询/下载/过期与 404 清理/挡注销）、账号注销 202、产品反馈与上下文举报。
// 每个变更都断言浏览器 Origin = fixture server 源、幂等键 16–128 可见 ASCII；同意图
// 重放断言键与 body 字节一致。四张全屏截图（账号页导出行 / 详情直取举报抽屉 / P7 会话
// ⋯ / 直聊无举报入口）写入 Playwright 测试输出，是已准入 Backend 专属入口差异的手动
// 证据，不入库。fixture 见 创建P8fixture。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('P8 控制面 fixture @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('P8 账号安全首屏：fixture 凭证掩码与真实会话时间上屏，无设备/地点字面量 @backend', async ({ page }, 测试信息) => {
    const fixture = await 装P8候选(page);
    await hash直达(page, '/#/account');
    // 凭证 display 原样上屏（fixture 标记值，Mock 数据里没有）
    await expect(page.getByText(P8标记.手机掩码)).toBeVisible({ timeout: 15_000 });
    // 当前会话只显示创建/失效时间（fixture 值 → 定长展示格式）；其他设备数来自会话快照
    await expect(page.getByText('创建 2026-09-01 08:00 · 失效 2026-09-08 08:00')).toBeVisible();
    await expect(page.getByText(/其他设备 2 台/)).toBeVisible();
    // 无型号/地点/IP/UA 字面量（wire 会话行根本不带这些字段）
    await expect(page.getByText(/iPhone|上海·|上海 ·|\d+\.\d+\.\d+\.\d+/)).toHaveCount(0);
    // Backend 专属「数据」组恰一行导出入口；无句柄零导出请求（被动恢复零请求边界）
    await expect(page.getByRole('button', { name: /导出我的数据/ })).toBeVisible();
    expect(fixture.导出读取).toEqual([]);
    expect(fixture.变更请求.filter((条) => 条.path.startsWith('/api/v1/me/data-exports'))).toEqual([]);
    // 手动证据（a）：凭证/会话/导出行可见的 Backend 账号页
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-account.png'), fullPage: true });
  });

  test('P8 退出其他设备：DELETE 无 body、同源键边界与权威重读归零 @backend', async ({ page }) => {
    const fixture = await 装P8候选(page);
    await hash直达(page, '/#/account');
    await expect(page.getByText(/其他设备 2 台/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /退出其他设备/ }).click();
    // 回执计数原样上屏；成功后操作层权威重读会话
    await expect(page.getByText('已退出 2 台其他设备')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/其他设备 0 台/)).toBeVisible({ timeout: 10_000 });
    // 其他设备归零后动作键禁用（没有可退的设备）
    await expect(page.getByRole('button', { name: /退出其他设备/ })).toBeDisabled();
    const 源 = new URL(page.url()).origin;
    const 变更 = fixture.变更请求.filter((条) => 条.method === 'DELETE' && 条.path === '/api/v1/security/sessions/others');
    expect(变更).toHaveLength(1);
    expect(变更[0]!.原文).toBeNull(); // DELETE 不携带请求体
    断言P8变更边界(变更[0]!, 源);
    // 服务端清洗：fixture 会话只剩 current
    expect(fixture.会话们.filter((条) => !条.current)).toHaveLength(0);
  });

  test('P8 换绑：四位码成功；冲突保留输入；首答未知同键字节一致重放 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await 装P8候选(page);
    await hash直达(page, '/#/account');
    await expect(page.getByText(P8标记.手机掩码)).toBeVisible({ timeout: 15_000 });
    const 源 = new URL(page.url()).origin;

    // ── 成功：11 位裸号 begin → 四位码 complete → 权威重读落地后才关抽屉 ──
    await page.getByRole('button', { name: /手机号/ }).click();
    await page.getByPlaceholder('输入新手机号').fill('13800009001');
    await page.getByRole('button', { name: '获取验证码' }).click();
    // toast 是单一文本节点；抽屉说明的相邻文本节点会拼出同串，必须 exact（下同）
    await expect(page.getByText('验证码已发送', { exact: true })).toBeVisible({ timeout: 10_000 });
    // Backend 不出现 Mock 专属「原型任意验证码」文案
    await expect(page.getByText(/原型/)).toHaveCount(0);
    await page.getByPlaceholder(/位验证码$/).fill('2468');
    await page.getByRole('button', { name: '确认换绑' }).click();
    await expect(page.getByText('手机号已换绑', { exact: true })).toBeVisible({ timeout: 15_000 });
    // 绝不乐观写：新掩码只在权威重读落地后出现，旧掩码消失
    await expect(page.getByText(P8标记.换绑后掩码)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(P8标记.手机掩码)).toHaveCount(0);
    // 换绑完成清洗其他会话但保留 current
    await expect(page.getByText(/其他设备 0 台/)).toBeVisible({ timeout: 10_000 });

    const 开始们 = fixture.变更请求.filter((条) => 条.method === 'POST' && 条.path === '/api/v1/me/credential-replacement-attempts');
    expect(开始们[0]!.body).toEqual({ phone: '+8613800009001' }); // 11 位裸号 → facade 构造 E.164
    断言P8变更边界(开始们[0]!, 源);
    const 完成们 = () => fixture.变更请求.filter((条) => 条.method === 'POST' && 条.path.endsWith('/complete'));
    const 成功完成 = 完成们()[0]!;
    expect(成功完成.body).toEqual({ proof: { code: '2468' } }); // 全局四位规则
    断言P8变更边界(成功完成, 源);

    // ── 冲突：409 credential_replacement_conflict，抽屉与输入保留 ──
    fixture.分支.换绑冲突 = true;
    await page.getByRole('button', { name: /手机号/ }).click();
    await page.getByPlaceholder('输入新手机号').fill('13800009002');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('验证码已发送', { exact: true })).toBeVisible({ timeout: 10_000 });
    const 验证框 = page.getByPlaceholder(/位验证码$/);
    await 验证框.fill('1357');
    await page.getByRole('button', { name: '确认换绑' }).click();
    await expect(page.getByText('验证码不正确或已过期，请重新获取后再试')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '确认换绑' })).toBeVisible(); // 抽屉未关
    await expect(验证框).toHaveValue('1357'); // 输入保留，可同层重试
    await page.keyboard.press('Escape'); // 弹层框架统一 Esc 关层

    // ── 首答未知：503 后 HTTP 客户端同键受控重试 —— 两笔同键、body 字节一致 ──
    fixture.分支.换绑冲突 = false; // 冲突分支是 fixture 级标记，先复位再换分支
    fixture.分支.换绑完成首答未知 = true;
    await page.getByRole('button', { name: /手机号/ }).click();
    await page.getByPlaceholder('输入新手机号').fill('13800009003');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('验证码已发送', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder(/位验证码$/).fill('8642');
    await page.getByRole('button', { name: '确认换绑' }).click();
    await expect(page.getByText('手机号已换绑', { exact: true })).toBeVisible({ timeout: 15_000 });
    const 未知完成们 = 完成们().filter((条) => (条.body as { proof?: { code?: string } }).proof?.code === '8642');
    expect(未知完成们).toHaveLength(2);
    expect(new Set(未知完成们.map((条) => 条.idempotencyKey)).size).toBe(1); // 同键
    expect(未知完成们[0]!.原文).toBe(未知完成们[1]!.原文); // 同意图重放：body 字节一致
    for (const 条 of 未知完成们) 断言P8变更边界(条, 源);
  });

  test('P8 数据导出：创建无 body → 轮询 ready → 关闭重开恢复 → 同源流式下载 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await 装P8候选(page);
    await hash直达(page, '/#/account');
    await expect(page.getByRole('button', { name: /导出我的数据/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    // 打开抽屉即恢复：无句柄零导出请求 → 抽屉给「生成导出文件」
    await expect(page.getByRole('button', { name: '生成导出文件' })).toBeVisible({ timeout: 10_000 });
    expect(fixture.导出读取).toEqual([]);
    await page.getByRole('button', { name: '生成导出文件' }).click();
    // 创建 POST：该路由不携带请求体；回执 queued → 抽屉进入生成中（轮询推进）
    await expect(page.getByText('正在生成导出文件，完成后可以在这里下载。')).toBeVisible({ timeout: 10_000 });
    const 创建们 = () => fixture.变更请求.filter((条) => 条.method === 'POST' && 条.path === '/api/v1/me/data-exports');
    expect(创建们()).toHaveLength(1);
    expect(创建们()[0]!.原文).toBeNull();
    断言P8变更边界(创建们()[0]!, new URL(page.url()).origin);
    // queued→running→ready（2s 退避节拍内）；ready 显示服务端过期时间
    await expect(page.getByRole('button', { name: '下载数据导出' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/2026-09-08 00:00 前可下载/)).toBeVisible();
    expect(fixture.导出.数据?.status).toBe('ready');

    // ── 关闭抽屉再打开：恢复句柄（有 ID 只 GET 绝不 POST）──
    await page.getByRole('button', { name: '先不导出' }).click();
    await expect(page.getByRole('button', { name: '先不导出' })).toHaveCount(0);
    const 读取前 = fixture.导出读取.length;
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    await expect(page.getByRole('button', { name: '下载数据导出' })).toBeVisible({ timeout: 10_000 });
    expect(fixture.导出读取.length).toBeGreaterThan(读取前);
    expect(创建们()).toHaveLength(1); // 重开恢复零创建

    // ── 下载：先权威预检（GET）再同源锚点导航。锚点下载由浏览器下载管理器接管，
    //    page.route / request 事件都看不到 —— download 事件的 URL 是浏览器边界上
    //    可得的证据：同源 /download 端点 + 权威 exportId（不是 blob:/跨源 URL）。
    //    ZIP 字节与固定应答头由 route fixture 与单测覆盖；本环境 stg 不可达，
    //    落盘内容是 Vite 代理的 DNS 错误页，不作为断言对象。──
    const 预检前 = fixture.导出读取.length;
    const 下载承诺 = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: '下载数据导出' }).click();
    const 下载 = await 下载承诺;
    const 源 = new URL(page.url()).origin;
    expect(下载.url()).toBe(`${源}/api/v1/me/data-exports/${fixture.导出.数据!.export_id}/download`);
    expect(下载.url().startsWith('blob:')).toBe(false);
    // 点击后的权威预检 GET 确实发生（下载先确认一次状态）
    expect(fixture.导出读取.length).toBeGreaterThan(预检前);
  });

  test('P8 数据导出过期与 404：句柄清理后重新生成用新键 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建P8fixture();
    // 轮询退避 2s/4s；ready 是停表终态，过期演练直接 running→expired（不经过 ready）
    fixture.导出.状态脚本 = ['queued', 'running', 'expired'];
    await 装P8候选(page, { fixture });
    await hash直达(page, '/#/account');
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    await page.getByRole('button', { name: '生成导出文件' }).click();
    // 轮询至 expired：抽屉给「这份导出已过期」与「重新生成」（只展示服务端 status）；
    // expired 的权威 GET 同时清掉恢复句柄（回到可创建态）
    await expect(page.getByText('这份导出已过期。如仍需要，请重新生成。')).toBeVisible({ timeout: 20_000 });
    // exact：行按钮的无障碍名「导出我的数据 已过期，可重新生成 ›」含同名子串
    await expect(page.getByRole('button', { name: '重新生成', exact: true })).toBeVisible();
    const 创建们 = () => fixture.变更请求.filter((条) => 条.method === 'POST' && 条.path === '/api/v1/me/data-exports');
    const 甲键 = 创建们()[0]!.idempotencyKey;
    // 重新生成 = 先废弃句柄再创建：新键 POST，绝不重放旧键。第二份导出停在 ready
    // （保留句柄），给下一段 404 演练用
    fixture.导出.状态脚本 = ['ready'];
    await page.getByRole('button', { name: '重新生成', exact: true }).click();
    expect(创建们()).toHaveLength(2);
    expect(创建们()[1]!.idempotencyKey).not.toBe(甲键); // 明确重新生成 = 新意图新键
    断言P8变更边界(创建们()[1]!, new URL(page.url()).origin);
    // 服务端状态机重置：第二份导出直接 ready（行说明「已生成，可下载」随之落位）
    await expect.poll(() => fixture.导出.数据?.status ?? null, { timeout: 10_000 }).toBe('ready');
    await expect(page.getByText('已生成，可下载', { exact: true })).toBeVisible({ timeout: 10_000 });

    // ── 404 清理：服务端导出消失（他端清理/回收）。已成功快照的刷新失败按设计
    //    保留旧 data（只落重试错误），所以 404 的收口要在全新页面状态 + 陈旧句柄下
    //    演练：整页刷新 → 被动恢复 GET → 404 → 句柄清理 + 抽屉进入可重试错误态 ──
    fixture.导出.数据 = null;
    await page.getByRole('button', { name: '先不导出' }).click();
    await page.reload();
    await expect(page.getByText('账号与安全', { exact: true })).toBeVisible({ timeout: 15_000 });
    // 被动恢复（挂载即恢复）对陈旧句柄的权威 GET 得 404；打开抽屉看到统一收口文案
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    await expect(page.getByText('导出已失效，请重新生成')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '重试', exact: true })).toBeVisible();
  });

  test('P8 导出进行中挡注销；ready 未下载给警示且仍可继续 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建P8fixture();
    fixture.导出.状态脚本 = ['queued', 'running']; // 恒不 ready
    await 装P8候选(page, { fixture });
    await hash直达(page, '/#/account');
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    await page.getByRole('button', { name: '生成导出文件' }).click();
    await expect(page.getByText('正在生成导出文件，完成后可以在这里下载。')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '先不导出' }).click(); // 关抽屉只停前端节拍，服务端仍进行中

    // 注销两层弹层：说明 → 最终确认 → 409 export_in_progress（无本地登出）
    await page.getByRole('button', { name: '注销账号' }).click();
    await expect(page.getByText('注销账号会发生什么')).toBeVisible();
    await page.getByRole('button', { name: '我已了解，继续注销' }).click();
    // exact：遮罩的 aria-label「关闭确认注销账号」是「确认注销」的子串
    await page.getByRole('button', { name: '确认注销', exact: true }).click();
    await expect(page.getByText('已有导出正在生成或等待下载，请稍后重试')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '确认注销', exact: true })).toBeVisible(); // 确认层保留
    const 注销们 = () => fixture.变更请求.filter((条) => 条.path === '/api/v1/me/account-deletion');
    expect(注销们()).toHaveLength(1);
    expect(注销们()[0]!.原文).toBe('{}'); // EmptyRequest：body 精确 {}
    断言P8变更边界(注销们()[0]!, new URL(page.url()).origin);
    await page.getByRole('button', { name: '取消' }).click();

    // ── ready 未下载：说明层给「注销后将无法下载」警示与先下载入口，仍可继续 ──
    fixture.导出.状态脚本 = ['ready'];
    fixture.导出.数据 = {
      export_id: P8编号.导出甲, status: 'ready',
      created_at: '2026-09-01T08:00:00Z', expires_at: '2026-09-08T00:00:00Z', download_ready: true,
    };
    await page.getByRole('button', { name: /导出我的数据/ }).click(); // 权威重读 → ready 落位
    await expect(page.getByRole('button', { name: '下载数据导出' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '先不导出' }).click();
    await page.getByRole('button', { name: '注销账号' }).click();
    await expect(page.getByText('你有一份已生成的数据导出，注销后将无法下载。建议先下载留存。')).toBeVisible();
    await expect(page.getByRole('button', { name: '先下载数据导出' })).toBeVisible();
    // 仍可继续：警示不拦截
    await page.getByRole('button', { name: '我已了解，继续注销' }).click();
    await expect(page.getByText('确认注销账号？')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
  });

  test('P8 注销 202：清会话跳登录；后续保护读取一律 invalid_session @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await 装P8候选(page);
    await hash直达(page, '/#/account');
    await expect(page.getByText(P8标记.手机掩码)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '注销账号' }).click();
    await page.getByRole('button', { name: '我已了解，继续注销' }).click();
    await page.getByRole('button', { name: '确认注销', exact: true }).click();
    // 202 成功：统一清账号后由本屏跳登录页
    await expect(page).toHaveURL(/#\/$/, { timeout: 15_000 });
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
    const 注销 = fixture.变更请求.find((条) => 条.path === '/api/v1/me/account-deletion')!;
    expect(注销.method).toBe('POST');
    expect(注销.原文).toBe('{}'); // body 精确 {}
    断言P8变更边界(注销, new URL(page.url()).origin);
    expect(fixture.分支.已注销).toBe(true);
    // 注销清了会话：重进账号页被会话 401 拦在登录，旧账号数据一个字不上屏
    //（本航的预期结局就是被重定向回登录页，不能用要求路由落定的 hash直达）
    await page.goto('/#/account');
    await expect(page).toHaveURL(/#\/$/, { timeout: 15_000 });
    await expect(page.getByLabel('手机号')).toBeVisible();
    await expect(page.getByText(P8标记.手机掩码)).toHaveCount(0);
    // P8 保护读取在注销后一律 401 invalid_session —— fixture 级探针（页面上下文 fetch，
    // page.request 不经 page.route，会打到真实代理）：凭证 + 导出读取 + 导出下载
    // 三路全部先于存在性判定按 invalid_session 收口（ID 用合法形状即可，守卫与存在性无关）
    const 保护读取 = await page.evaluate(async (导出编号: string) => {
      const 取 = async (路径: string) => {
        const 响 = await fetch(路径, { credentials: 'include' });
        return { 状态: 响.status, 码: ((await 响.json()) as { error?: { type?: string } }).error?.type ?? null };
      };
      return {
        凭证: await 取('/api/v1/me/credentials'),
        导出: await 取(`/api/v1/me/data-exports/${导出编号}`),
        下载: await 取(`/api/v1/me/data-exports/${导出编号}/download`),
      };
    }, P8编号.导出甲);
    expect(保护读取.凭证).toEqual({ 状态: 401, 码: 'invalid_session' });
    expect(保护读取.导出).toEqual({ 状态: 401, 码: 'invalid_session' });
    expect(保护读取.下载).toEqual({ 状态: 401, 码: 'invalid_session' });
  });

  test('P8 产品反馈真实工单上屏；反馈页无举报入口零 reports 请求 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await 装P8候选(page);
    await hash直达(page, '/#/feedback');
    // 产品三分类走真实提交：服务端 ticket 原样上屏
    await page.getByRole('button', { name: '功能异常', exact: true }).click();
    await page.getByRole('textbox').fill('Fixture 反馈：账号页导出行点击无响应');
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(page.getByText('已收到，谢谢你')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`工单号 ${P8标记.反馈工单}`)).toBeVisible();
    // Backend 致谢文案不含 24 小时承诺（后端不发布时限）
    await expect(page.getByText('我们会尽快核查。每一条反馈都有人读。')).toBeVisible();
    await expect(page.getByText(/24 小时/)).toHaveCount(0);
    const 反馈 = fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/feedback');
    expect(反馈).toHaveLength(1);
    expect(反馈[0]!.body).toEqual({ category: 'bug', details: 'Fixture 反馈：账号页导出行点击无响应' });
    断言P8变更边界(反馈[0]!, new URL(page.url()).origin);

    // 反馈页没有举报入口：举报两类没有可核实对象，只能从具体岗位/谈判/真人会话发起
    //（已在 P8 职位举报 / P7 会话举报用例覆盖真实举报路径，这里只断言本页不代发）。
    // 离开反馈页前先等账号页可见：连发的同文档 hash 跳转会被 React Router 合并，
    // 不等中间屏落定就跳回会保留旧的致谢态组件实例。
    await hash直达(page, '/#/account');
    await expect(page.getByText('账号与安全', { exact: true })).toBeVisible({ timeout: 10_000 });
    await hash直达(page, '/#/feedback');
    await expect(page.getByText('举报要从具体的岗位、谈判或真人会话里发起；这里只收集产品反馈。')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '举报虚假岗位' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '举报骚扰行为' })).toHaveCount(0);
    expect(fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports')).toEqual([]);
    expect(fixture.反馈受理).toBe(1);
  });

  test('P8 职位举报（详情直取）：target=job_id 隐私安全 body @backend', async ({ page }, 测试信息) => {
    const 隐私 = P3隐私fixture();
    // 直取前提 = 无推荐快照（抽屉只给举报、无不感兴趣）：推荐清单显式置空（合法空页）
    const 空推荐fixture = P4发现fixture();
    空推荐fixture.候选推荐 = {};
    const fixture = await 装P8候选(page, {
      发现fixture: 空推荐fixture,
      隐私fixture: 隐私,
      // 岗位详情按 hiring_organization_ref 补读公开企业（org-fixture-p4 只有 P4 侧声明，
      // 无组织域 fixture）：按坐标显式声明空应答 → strict decode 拒绝 → 企业块出错误/占位态
      //（与 账号与支持「P8 举报屏蔽暂不可用」同款修法，只修测试定义，不改产品）。
      覆盖: {
        'GET /api/v1/organizations/org-fixture-p4': () => ({ status: 200, 响应: 信封(null) }),
      },
    });
    fixture.举报屏蔽组织[`job:${P4编号.job}`] = {
      organization_id: P8标记.屏蔽组织编号,
      organization_display_name: P8标记.屏蔽组织名,
    };
    await hash直达(page, `/#/job/${P4编号.job}`);
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    // 详情直取路径：⋯ 在场（权威 CandidateJob 解码成功即有举报入口）
    // 手动证据（b-1）：权威直取详情页，顶栏既有样式 ⋯ 可见
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-job-more-button.png'), fullPage: true });
    await page.getByRole('button', { name: '更多操作' }).click();
    // 抽屉里恰一项非取消动作：举报这个职位（直取无推荐坐标 → 无不感兴趣）
    await expect(page.getByRole('button', { name: '举报这个职位' })).toBeVisible();
    await expect(page.getByRole('button', { name: '不感兴趣，别再推给我' })).toHaveCount(0);
    // 手动证据（b-2）：举报抽屉展开 —— 恰一项新增的既有样式抽屉项「举报这个职位」
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-job-report-drawer.png'), fullPage: true });
    await page.getByRole('button', { name: '举报这个职位' }).click();
    await page.getByRole('button', { name: '骚扰', exact: true }).click();
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('举报已受理，我们会尽快核查')).toBeVisible({ timeout: 10_000 });
    const 举报 = fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports');
    expect(举报).toHaveLength(1);
    // 隐私安全 body：恰 {target:{type,ref},reason,also_block}——无展示名/公司名/用户身份
    expect(举报[0]!.body).toEqual({ target: { type: 'job', ref: P4编号.job }, reason: 'harassment', also_block: false });
    断言P8变更边界(举报[0]!, new URL(page.url()).origin);
    // not_requested：不触发候选隐私重读
    expect(fixture.举报受理).toBe(1);
    expect(隐私.视图.organization_blocks).toHaveLength(0);
  });

  test('P8 举报屏蔽暂不可用：取消勾选=新键纯举报；目标不存在统一关层刷新来源 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P8候选(page, {
      发现fixture: P4发现fixture(),
      // 岗位详情按 hiring_organization_ref 补读公开企业（org-fixture-p4 只有 P4 侧声明，
      // 本用例无组织域 fixture）：按坐标显式声明空应答 → strict decode 拒绝 → 企业块
      // 出错误/占位态，与移除通用兜底前的可观察行为一致（只修测试定义，不改产品）。
      覆盖: {
        'GET /api/v1/organizations/org-fixture-p4': () => ({ status: 200, 响应: 信封(null) }),
      },
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });
    await hash直达(page, `/#/job/${P4编号.job}`);
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('button', { name: '举报这个职位' }).click();

    // ── 勾选同时屏蔽 → 409 block_unavailable：层保持开、选择保留、零写入 ──
    fixture.分支.举报屏蔽不可用 = true;
    await page.getByRole('button', { name: '薪资不实', exact: true }).click();
    await page.getByRole('button', { name: /同时屏蔽/ }).click();
    await expect(page.getByRole('button', { name: /同时屏蔽/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('暂时无法同时屏蔽，可取消勾选后仅提交举报')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '提交举报' })).toBeVisible(); // 层未关
    expect(fixture.举报受理).toBe(0); // block_unavailable：什么都没写

    // ── 取消勾选 → 新意图新键 → 纯举报成功 ──
    await page.getByRole('button', { name: /同时屏蔽/ }).click();
    await expect(page.getByRole('button', { name: /同时屏蔽/ })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('举报已受理，我们会尽快核查')).toBeVisible({ timeout: 10_000 });
    const 举报们 = fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports');
    expect(举报们).toHaveLength(2);
    expect(举报们[0]!.body).toEqual({ target: { type: 'job', ref: P4编号.job }, reason: 'salary_misrepresentation', also_block: true });
    expect(举报们[1]!.body).toEqual({ target: { type: 'job', ref: P4编号.job }, reason: 'salary_misrepresentation', also_block: false });
    expect(举报们[1]!.idempotencyKey).not.toBe(举报们[0]!.idempotencyKey); // 取消勾选=新键
    for (const 条 of 举报们) 断言P8变更边界(条, new URL(page.url()).origin);
    expect(fixture.举报受理).toBe(1);

    // ── 目标不存在：404 统一终局 —— 关层 + 屏层强制重读来源 ──
    fixture.分支.举报目标不存在 = true;
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('button', { name: '举报这个职位' }).click();
    await page.getByRole('button', { name: '其他', exact: true }).click();
    const 岗位读取前 = 请求序.filter((项) => 项 === `GET /api/v1/jobs/${P4编号.job}`).length;
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('举报对象已不存在，请刷新后重试')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '提交举报' })).toHaveCount(0); // 过期层已关
    await expect
      .poll(() => 请求序.filter((项) => 项 === `GET /api/v1/jobs/${P4编号.job}`).length, { timeout: 10_000 })
      .toBeGreaterThan(岗位读取前); // 屏层刷新来源：权威岗位 GET 再次发出
  });

  test('P7 会话举报：target=conversation 路由坐标；同一枚 ⋯ 键盘可达 @backend', async ({ page }, 测试信息) => {
    test.setTimeout(120_000);
    const 隐私 = P3隐私fixture();
    const 请求序: string[] = [];
    const fixture = await 装P8候选(page, {
      P7fixture: P7带消息fixture(P7标记.招聘消息),
      隐私fixture: 隐私,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });
    fixture.举报屏蔽组织[`conversation:${P7会话编号.会话}`] = {
      organization_id: P8标记.屏蔽组织编号,
      organization_display_name: P8标记.屏蔽组织名,
    };
    await hash直达(page, `/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });
    // 手动证据（c）：Backend P7 会话页的同一枚视觉 ⋯（span + 原类，role=button 可达）
    const 拉点 = page.getByRole('button', { name: '举报', exact: true });
    await expect(拉点).toBeVisible();
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-p7-conversation.png'), fullPage: true });
    // 键盘可达：Enter 打开会话举报层
    await 拉点.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: '提交举报' })).toBeVisible();
    // 勾选同时屏蔽 → applied：toast 点名屏蔽对象
    await page.getByRole('button', { name: '虚假信息', exact: true }).click();
    await page.getByRole('button', { name: /同时屏蔽/ }).click();
    const 会话详情前 = 请求序.filter((项) => 项 === `GET /api/v1/me/conversations/${P7会话编号.会话}`).length;
    const 隐私读取前 = 请求序.filter((项) => 项 === 'GET /api/v1/me/privacy').length;
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText(`举报已受理 · 已屏蔽${P7标记.地点}`)).toBeVisible({ timeout: 10_000 });
    const 举报 = fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports');
    expect(举报).toHaveLength(1);
    // target 恒为该会话的权威路由坐标，绝不是展示名
    expect(举报[0]!.body).toEqual({ target: { type: 'conversation', ref: P7会话编号.会话 }, reason: 'false_information', also_block: true });
    断言P8变更边界(举报[0]!, new URL(page.url()).origin);
    // applied + 候选角色：恰一次权威隐私重读（相对计数：进屏水合也读隐私），
    // 且 fixture 隐私权威视图多了该组织（屏蔽只认权威视图）
    await expect
      .poll(() => 请求序.filter((项) => 项 === 'GET /api/v1/me/privacy').length, { timeout: 10_000 })
      .toBe(隐私读取前 + 1);
    expect(隐私.视图.organization_blocks.map((块) => 块.organization_id)).toEqual([P8标记.屏蔽组织编号]);
    // 确认回执后强制重读该会话
    await expect
      .poll(() => 请求序.filter((项) => 项 === `GET /api/v1/me/conversations/${P7会话编号.会话}`).length, { timeout: 10_000 })
      .toBeGreaterThan(会话详情前);
  });

  test('P8 Backend 直聊：不可用说明与查看在谈导航，零直接聊天/举报写入 @backend', async ({ page }, 测试信息) => {
    const fixture = await 装P8候选(page);
    await hash直达(page, '/#/chat/direct/J-01');
    // P4 不发布直聊许可/会话坐标 → Backend 没有权威直聊会话：整页只有不可用说明
    await expect(page.getByText('当前暂不提供直接聊天。请从已建立的 MatchCase 进入真人会话。')).toBeVisible({ timeout: 15_000 });
    // 无权威 target 禁止写入：⋯ 举报入口整体隐藏，操作排与输入条都不渲染，页面没有可写的会话
    await expect(page.getByRole('button', { name: '举报', exact: true })).toHaveCount(0);
    await expect(page.getByText('⋯')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '看职位' })).toHaveCount(0);
    await expect(page.getByPlaceholder('发消息…')).toHaveCount(0);
    // 手动证据（d）：Backend 直聊页不可用态
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-direct-chat.png'), fullPage: true });
    // 「查看在谈」指路在谈列表所在的主壳，不把用户留在死页
    await page.getByRole('button', { name: '查看在谈' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 10_000 });
    // 零举报写入：全程没有发出任何 reports 请求
    expect(fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports')).toEqual([]);
  });

  test('P8 401 清账号回登录，无本地成功 @backend', async ({ page }) => {
    await 装P8候选(page, {
      覆盖: {
        'GET /api/v1/me/credentials': () => ({
          status: 401,
          响应: { error: { type: 'invalid_session', message: '未登录' } },
        }),
      },
    });
    // 首航即被 401 拦回登录页（预期重定向，不用 hash直达）
    await page.goto('/#/account');
    // 当前会话 401：统一清账号（P4–P8 状态与引用）→ 应用级路由回收进登录页
    await expect(page).toHaveURL(/#\/$/, { timeout: 15_000 });
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
    // 旧账号的 fixture 凭证掩码绝不上屏（无本地成功）
    await expect(page.getByText(P8标记.手机掩码)).toHaveCount(0);
  });

  test('P8 切换身份后迟到的账号应答不泄漏；重进账号页按新代际完整水合 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    let 放行!: () => void;
    const 门 = new Promise<void>((ok) => { 放行 = ok; });
    const fixture = 创建P8fixture();
    fixture.分支.挂起凭证读取 = 门;
    const 请求序: string[] = [];
    await 装P8候选(page, {
      fixture,
      招聘组织Fixture: P1C招聘组织Fixture,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });
    // 候选端账号页：第一笔凭证 GET 挂起（应答体在请求抵达时已快照为旧值）
    await hash直达(page, '/#/account');
    await expect
      .poll(() => 请求序.filter((项) => 项 === 'GET /api/v1/me/credentials').length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);
    // 卸载账号页（离开）并切换身份：会话代际递增，旧代的在飞读按栅栏整包作废
    await hash直达(page, '/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    // 权威数据先翻新（若迟到应答真的落位，快照会停在旧值且不再重读）
    fixture.凭证们 = [
      { credential_id: P8编号.手机凭证, provider: 'phone_otp', display: P8标记.换绑后掩码, verified_at: '2026-09-01T00:00:00Z' },
    ];
    放行();
    await page.waitForTimeout(1_500);
    // 两端共用的账号页：按新代际完整读取，展示当前权威值；旧主体的迟到值无泄漏路径
    await hash直达(page, '/#/account');
    await expect(page.getByText(P8标记.换绑后掩码)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P8标记.手机掩码)).toHaveCount(0);
    expect(fixture.凭证读取数).toBeGreaterThanOrEqual(2); // 重进页触发新代际读取
  });

  test('P8 合规 429：固定文案无倒计时，绝不自动重试（手动再提交=新键） @backend', async ({ page }) => {
    const fixture = await 装P8候选(page);
    fixture.分支.反馈限流 = true;
    await hash直达(page, '/#/feedback');
    await page.getByRole('button', { name: '体验建议', exact: true }).click();
    const 正文 = 'Fixture 反馈：希望导出文件能选时间范围';
    await page.getByRole('textbox').fill(正文);
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(page.getByText('操作过于频繁，请稍后再试')).toBeVisible({ timeout: 10_000 });
    // 输入与所选分类原样保留（无本地成功）
    await expect(page.getByRole('textbox')).toHaveValue(正文);
    await expect(page.getByText('已收到，谢谢你')).toHaveCount(0);
    // 不编造倒计时文案
    await expect(page.getByText(/秒后重试|倒计时/)).toHaveCount(0);
    // 合规 429 不带 Retry-After：没有可等的窗口 —— 等待期内零自动重试（恰一笔 POST）
    await page.waitForTimeout(2_500);
    const 反馈们 = () => fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/feedback');
    expect(反馈们()).toHaveLength(1);
    // 手动再提交 = 新意图新键（429 是终局），同一文的 body 字节一致
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(反馈们()).toHaveLength(2);
    expect(反馈们()[1]!.idempotencyKey).not.toBe(反馈们()[0]!.idempotencyKey);
    expect(反馈们()[1]!.原文).toBe(反馈们()[0]!.原文);
  });
});
// ── P8 Mock 隔离：Mock 双端零控制面请求（任务书 isP8 原文） ─────────────────────
test.describe('P8 Mock 数据源隔离 @mock', () => {
  test('P8 Mock 账号安全/反馈/职位举报/直聊举报零控制面请求 @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const isP8 = (path: string) =>
      /\/security\/sessions|\/me\/(credentials|credential-replacement-attempts|data-exports|account-deletion)|\/compliance\/(feedback|reports)/.test(path);
    const P8请求: string[] = [];
    const apiRequests: string[] = [];
    page.on('request', (请求) => {
      const 路径 = new URL(请求.url()).pathname;
      if (路径.startsWith('/api/v1')) {
        apiRequests.push(`${请求.method()} ${路径}`);
        if (isP8(路径)) P8请求.push(`${请求.method()} ${路径}`);
      }
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // ── 账号安全：四位原型换绑 / 本地退出提示 / 本地注销跳登录 照旧 ──
    await hash直达(page, '/#/account');
    await expect(page.getByText('138 **** 6021')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /手机号/ }).click();
    await page.getByPlaceholder('输入新手机号').fill('13900001111');
    await page.getByRole('button', { name: '获取验证码' }).click();
    // Mock 专属原型文案（抽屉说明与 toast 都含「原型」，取 toast 的完整单节点文本）
    await expect(page.getByText('验证码已发送（原型：任意 4 位数字均可通过）')).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder(/位验证码$/).fill('8888'); // 任意四位
    await page.getByRole('button', { name: '确认换绑' }).click();
    await expect(page.getByText('手机号已换绑')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('139 **** 1111')).toBeVisible();
    await page.getByRole('button', { name: /退出其他设备/ }).click();
    await expect(page.getByText('其余设备已全部退出登录')).toBeVisible({ timeout: 10_000 });
    // Mock 不渲染 Backend 专属「数据」组与导出行（现有页面一个像素不多）
    await expect(page.getByRole('button', { name: /导出我的数据/ })).toHaveCount(0);
    // 本地注销两步弹层照旧，成功本地跳登录
    await page.getByRole('button', { name: '注销账号' }).click();
    await page.getByRole('button', { name: '我已了解，继续注销' }).click();
    await page.getByRole('button', { name: '确认注销', exact: true }).click();
    await expect(page).toHaveURL(/#\/$/, { timeout: 10_000 });

    // 重新登录（四格验证码原型路径照旧）后再走反馈与两处举报原型
    await page.getByLabel('手机号').fill('13800000000');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.locator('[class*="验证码格"]')).toHaveCount(4);
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '进入' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // ── 反馈：举报分类本地成功（原型固定工单号 + 24 小时口径照旧） ──
    await hash直达(page, '/#/feedback');
    await page.getByRole('button', { name: '举报虚假岗位' }).click();
    await page.getByRole('textbox').fill('Mock 原型反馈：举报虚假岗位本地成功');
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(page.getByText('已收到，谢谢你')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('工单号 FB-2026-0818-041')).toBeVisible();
    await expect(page.getByText('我们会在 24 小时内核查。核查过程中不会向对方透露是谁提交的。')).toBeVisible();

    // ── 职位举报（原型岗位）：本地派发 + 固定 toast，勾选屏蔽落全局名单 ──
    await hash直达(page, '/#/job/J-01');
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('button', { name: '举报这个职位' }).click();
    await page.getByRole('button', { name: '虚假信息', exact: true }).click();
    await page.getByRole('button', { name: /同时屏蔽/ }).click();
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText(/举报已受理 · 已屏蔽/)).toBeVisible({ timeout: 10_000 });

    // ── 直聊举报（Mock 在场；Backend 该入口整体隐藏） ──
    await hash直达(page, '/#/chat/direct/J-01');
    await page.getByRole('button', { name: '举报', exact: true }).click();
    await page.getByRole('button', { name: '其他', exact: true }).click();
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('举报已受理，我们会尽快核查')).toBeVisible({ timeout: 10_000 });

    // 全程零 P8 请求（任务书 isP8 原文），Mock 恒零 /api/v1
    expect(P8请求).toEqual([]);
    expect(apiRequests).toEqual([]);
  });
});
