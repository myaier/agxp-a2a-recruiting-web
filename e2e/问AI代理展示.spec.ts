// e2e/问AI代理展示.spec.ts
// 固定 AI 代理入口与受控展示组件 · Task 4：双模式整页浏览器验收。
//
// 在真实组装（主壳 → 消息列表 → 代理页）上证明 Task 1–3 的三块交付：
//   · Backend：全部/通知/仅会话与搜索下的唯一固定入口行（agent-entry:*），点击进
//     /agent、/hr/agent；代理页是 真实说明 + 三个真实导航 + 完整但禁用的 真输入条，
//     按键/点发送零新消息、零规则 mutation，入口键绝不进 P7 会话请求。
//   · Mock：双端列表行与代理初始页保持原 fixture 文案/未读语义；长文本输入无新横向
//     溢出；快捷句立即上屏并等 550ms 真实 DOM 回复；维持/放宽两端各按原行为。
// 截图按 testInfo.outputPath 落盘并 attach，供与 Task 1 前基线
// （ui-regression-output/agent/reference/）做同内容字体/宽度/间距对照。
//
// 边界（与冻结 Plan 对齐）：
//   · Backend 用 e2e/fixtures/P1展示统一.ts 的 安装P1路由 完整场景（含已完成
//     onboarding 应答），不绕过守卫；浏览器只用完整 HTTP 集合，空页/加载/失败
//     组合由 Task 1 组件测试覆盖。fixture 仅一处随上游合同 A 校准：recruiter
//     profile 补必需键 organization_ref（见该文件注释），白名单与场景不变。
//   · Mock 走主壳路径 + 稳定页面 既有种子，不写 Session 存储；请求监听沿用
//     安装诊断 的 /api/v1 范围（不含 HMR），旅程零业务 API 请求。
//   · 不 import 任意 .spec.ts（会注册无关测试）。

import type { Locator } from '@playwright/test';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { 安装诊断, 打开稳定页面 } from './视觉回归/稳定页面';
import { 安装P1路由 } from './fixtures/P1展示统一';
import type { P1角色 } from './fixtures/P1展示统一';

// ── 共用 helper ─────────────────────────────────────────────────────────────────

const 宽度们 = [320, 390];
const 角色们: P1角色[] = ['candidate', 'recruiter'];

/** 底部导航里的消息 Tab（双端主壳同名）。 */
const 消息按钮 = (page: Page): Locator => page.locator('nav').getByRole('button', { name: /消息/ });

/** 固定 AI 入口行：键 agent-entry:*，标题 AI代理动态（Backend 展示层组装，Mock 为 X-01/H-01）。 */
const AI入口行 = (page: Page): Locator => page.getByRole('button', { name: /AI代理动态/ });

/** 会话行列表（class 由 CSS module 哈希，包含匹配；与 P1展示统一 同口径）。 */
const 会话行们 = (page: Page): Locator => page.locator('button[class*="会话行"]');

/** 两帧 rAF + 字体就绪：截图前让布局与渲染落定，不用固定 sleep。 */
async function 等落定(page: Page): Promise<void> {
  await page.evaluate(() => (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready);
  await page.evaluate(
    () =>
      new Promise<number>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(1))),
      ),
  );
}

/** 页面横向溢出像素（超长输入不得产生新溢出）。 */
const 溢出像素 = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** 截图到 testInfo.outputPath 并 attach（同视口证据，供与 Task 1 基线对照）。 */
async function 存截图(testInfo: TestInfo, page: Page, 名称: string): Promise<void> {
  const 文件 = testInfo.outputPath(名称);
  await page.screenshot({ path: 文件 });
  await testInfo.attach(名称, { path: 文件, contentType: 'image/png' });
}

/** 简报头对齐到对话流容器顶再截图（与 Task 1 基线同位）：直接设容器 scrollTop，
 *  并按帧重对齐直到稳定 —— 避开挂载平滑滚动在途的竞态，不用固定 sleep。
 *  底部区 ±24px 的 textarea 测高/字体竞态抖动因而不进简报对照画面。 */
async function 滚到简报头(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const 下一帧 = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
    const 头 = document.querySelector('[class*="简报头"]');
    const 容器 = 头?.closest('.滚动区');
    if (!(头 instanceof HTMLElement) || !(容器 instanceof HTMLElement)) return;
    for (let 轮 = 0; 轮 < 30; 轮 += 1) {
      容器.scrollTop += 头.getBoundingClientRect().top - 容器.getBoundingClientRect().top;
      await 下一帧();
      await 下一帧();
      if (Math.abs(头.getBoundingClientRect().top - 容器.getBoundingClientRect().top) < 0.5) return;
    }
  });
  await 等落定(page);
}

// ── Backend：固定入口 + 禁用外壳（完整 HTTP 场景）──────────────────────────────

const Backend文案: Record<P1角色, { 主壳正则: RegExp; 代理路径: RegExp; 搜索框: string; 真实说明: string; 导航: string[] }> = {
  candidate: {
    主壳正则: /#\/app$/,
    代理路径: /#\/agent$/,
    搜索框: '搜索会话 / 公司 / 职位',
    真实说明: '真实匹配与委托请从「市场」进入，真实阶段请到「在谈」查看，长期规则请到「规则库」设置。当前 Backend 模式暂不提供自由对话、日报和漏斗。',
    导航: ['去市场', '看在谈', '规则库'],
  },
  recruiter: {
    主壳正则: /#\/hr$/,
    代理路径: /#\/hr\/agent$/,
    搜索框: '搜索会话 / 候选 / 岗位',
    真实说明: '真实匹配与委托请从「推荐」进入，真实阶段请到「在谈」查看，长期规则请到「AI 代理设置」提交。当前 Backend 模式暂不提供自由对话、日报和漏斗。',
    导航: ['看推荐', '看在谈', 'AI代理设置'],
  },
};

for (const 宽度 of 宽度们) {
  test.describe(`问AI代理 Backend ${宽度}`, () => {
    test.use({
      viewport: { width: 宽度, height: 844 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      reducedMotion: 'reduce',
    });

    for (const 角色 of 角色们) {
      test(`固定入口与禁用外壳 ${角色} @agent @backend`, async ({ page }, testInfo) => {
        test.setTimeout(120_000);
        const 文案 = Backend文案[角色];
        const { 请求 } = await 安装P1路由(page, { role: 角色, 场景: '完整' });
        const 诊断 = 安装诊断(page);

        // 主壳 → 消息：入口走应用自己的落点（goto('/') 后由会话角色落对应主壳，与
        // P1展示统一 的 打开后端主壳 同一机制；直接冷启动 /#/hr 不落主壳），零守卫绕过
        await 打开稳定页面(page, '/', '未登录');
        await expect(page).toHaveURL(文案.主壳正则, { timeout: 20_000 });
        await expect(消息按钮(page)).toBeVisible({ timeout: 20_000 });
        await 消息按钮(page).click();
        await expect(会话行们(page).nth(1)).toBeVisible({ timeout: 15_000 });

        // 全部：入口行唯一且是第一条会话行；内容是固定三件套，无模拟摘要/时间/未读
        const 行 = AI入口行(page);
        await expect(行).toHaveCount(1);
        await expect(会话行们(page).first()).toContainText('AI代理动态');
        await expect(行).toContainText('聊天暂未开放，可查看代理功能');
        await expect(行).toContainText(角色 === 'candidate' ? '你的求职AI代理' : '你的招聘AI代理');
        await expect(行).not.toContainText('刚刚');
        await expect(行).not.toContainText('替你初筛');
        await expect(行).not.toContainText('替你拒绝');
        await expect(行.locator('span[class*="会话时间"]')).toHaveText('');
        await expect(行.locator('span[class*="未读徽标"], span[class*="红点"], [data-testid^="unread-"]')).toHaveCount(0);
        // 合法收件箱 GET 已发生（不禁止）；入口键绝不进 P7 请求；无规则 mutation
        expect(请求.some((条) => 条.method === 'GET' && 条.path.endsWith('/conversations'))).toBe(true);
        expect(请求.filter((条) => 条.path.includes('agent-entry'))).toEqual([]);
        expect(请求.filter((条) => 条.path.includes('agent-rule') && 条.method !== 'GET')).toEqual([]);
        await 等落定(page);
        await 存截图(testInfo, page, `agent-backend-${角色}-${宽度}-list.png`);

        // 通知有 / 仅会话无
        await page.getByRole('button', { name: '通知', exact: true }).click();
        await expect(行).toHaveCount(1);
        await expect(会话行们(page)).toHaveCount(1);
        await page.getByRole('button', { name: '仅会话', exact: true }).click();
        await expect(行).toHaveCount(0);
        await expect(会话行们(page).first()).toBeVisible();
        await page.getByRole('button', { name: '全部', exact: true }).click();
        await expect(行).toHaveCount(1);

        // 搜索“AI代理”命中入口行；无关词不命中并给既有无匹配提示；清空恢复
        const 搜索框 = page.getByPlaceholder(文案.搜索框);
        await 搜索框.fill('AI代理');
        await expect(行).toHaveCount(1);
        await 搜索框.fill('零匹配占位词xyz');
        await expect(行).toHaveCount(0);
        await expect(会话行们(page)).toHaveCount(0);
        await expect(page.getByText('没有匹配的会话。')).toBeVisible();
        await 搜索框.fill('');
        await expect(行).toHaveCount(1);

        // 点击进正确代理 URL
        await 行.click();
        await expect(page).toHaveURL(文案.代理路径, { timeout: 10_000 });

        // 真实说明 + 三个真实导航 + 禁用输入可见；零 Mock 会话/简报/快捷句/模拟摘要
        await expect(page.getByText(文案.真实说明)).toBeVisible();
        for (const 名称 of 文案.导航) {
          await expect(page.getByRole('button', { name: 名称, exact: true })).toBeVisible();
        }
        const 输入框 = page.getByPlaceholder('AI代理聊天暂未开放');
        await expect(输入框).toBeVisible();
        await expect(输入框).toBeDisabled();
        await expect(page.getByRole('button', { name: '发送' })).toBeDisabled();
        await expect(page.getByText('今日简报')).toHaveCount(0);
        await expect(page.getByText('替你初筛')).toHaveCount(0);
        await expect(page.getByText(角色 === 'candidate' ? '帮我搜远程岗' : '这周漏斗怎么样？')).toHaveCount(0);
        const 气泡们 = page.locator('[class*="气泡文字"]');
        await expect(气泡们).toHaveCount(1);

        // 导航/输入不得遮挡：三颗导航键底沿都在输入条顶沿之上（新增输入的垂直空间变化是预期）
        const 输入框框 = await 输入框.boundingBox();
        expect(输入框框, '禁用输入条框').not.toBeNull();
        for (const 名称 of 文案.导航) {
          const 框 = await page.getByRole('button', { name: 名称, exact: true }).boundingBox();
          expect(框, `导航 ${名称} 框`).not.toBeNull();
          expect(框!.y + 框!.height).toBeLessThanOrEqual(输入框框!.y);
        }

        // disabled 的真实行为：点击不得聚焦（disabled 控件不吃点击；默认 actionability
        // 的 enabled 检查对禁用元素永不满足，真实鼠标点击须 force），键盘输入与 Enter
        // 都不生效，点发送（DOM 事件）也无消息
        const 变异前 = 请求.filter((条) => 条.method !== 'GET').length;
        await 输入框.click({ force: true });
        expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('TEXTAREA');
        await page.keyboard.type('测');
        await page.keyboard.press('Enter');
        await expect(输入框).toHaveValue('');
        await page.getByRole('button', { name: '发送' }).dispatchEvent('click');
        await expect(气泡们).toHaveCount(1);
        await expect(page.getByText(文案.真实说明)).toBeVisible();

        // 按键/点发送前后零新增 POST/PUT/DELETE；入口键与规则 mutation 仍为零
        expect(请求.filter((条) => 条.method !== 'GET').length).toBe(变异前);
        expect(请求.filter((条) => 条.path.includes('agent-entry'))).toEqual([]);
        expect(请求.filter((条) => 条.path.includes('agent-rule') && 条.method !== 'GET')).toEqual([]);
        await 等落定(page);
        await 存截图(testInfo, page, `agent-backend-${角色}-${宽度}-agent.png`);
        诊断.detach();
      });
    }
  });
}

// ── Mock：两端列表入口 + 对话行为 + 建议操作（零业务 API 请求）─────────────────

const Mock文案: Record<P1角色, {
  主壳: string; 种子: '求职端已注册' | '招聘端已注册'; 代理路径: RegExp;
  输入占位: string; 快捷句: string; 代理回复: RegExp;
  摘要片段: string; 未读: string; 维持确认: string; 放宽键: string;
}> = {
  candidate: {
    主壳: '/#/app',
    种子: '求职端已注册',
    代理路径: /#\/agent$/,
    输入占位: '让AI代理搜岗、去谈，或问进展…',
    快捷句: '帮我搜远程岗',
    代理回复: /搜到 7 个全远程、薪资带覆盖你底线的。要我直接去谈前 3 个吗？/,
    摘要片段: '替你拒绝了薪资带无交集',
    未读: '4',
    维持确认: '已维持红线 · 规则不变，我会继续替你挡掉这类岗位。',
    放宽键: '改成可谈',
  },
  recruiter: {
    主壳: '/#/hr',
    种子: '招聘端已注册',
    代理路径: /#\/hr\/agent$/,
    输入占位: '让AI代理找人、触达，或问漏斗…',
    快捷句: '这周漏斗怎么样？',
    代理回复: /本周漏斗：触达 23 → 硬性匹配 12 → 在谈 5 → 深谈 2 → 意向达成 1。/,
    摘要片段: '本周替你初筛 23 人',
    未读: '2',
    维持确认: '已维持红线 · 规则不变，我会继续替你挡掉这类候选。',
    放宽键: '放宽薪资带',
  },
};

for (const 宽度 of 宽度们) {
  test.describe(`问AI代理 Mock ${宽度}`, () => {
    test.use({
      viewport: { width: 宽度, height: 844 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      reducedMotion: 'reduce',
    });

    for (const 角色 of 角色们) {
      test(`列表入口、对话与建议 ${角色} @agent @mock`, async ({ page }, testInfo) => {
        test.setTimeout(120_000);
        const 文案 = Mock文案[角色];
        const 诊断 = 安装诊断(page);

        // 主壳 → 消息：Mock 列表保持原 fixture 行（含 AI 行的模拟摘要与未读语义）
        await 打开稳定页面(page, 文案.主壳, 文案.种子);
        await expect(消息按钮(page)).toBeVisible({ timeout: 20_000 });
        await 消息按钮(page).click();
        const 行 = AI入口行(page);
        await expect(行).toHaveCount(1);
        await expect(行).toContainText(文案.摘要片段);
        await expect(行.locator('span[class*="未读徽标"]')).toHaveText(文案.未读);
        await 等落定(page);
        await 存截图(testInfo, page, `agent-mock-${角色}-${宽度}-list.png`);

        // 点 AI 行进代理初始页：简报 + 初始对话 + 快捷行 + 可用输入
        await 行.click();
        await expect(page).toHaveURL(文案.代理路径);
        await expect(page.getByText('今日简报')).toBeVisible();
        await expect(page.getByText('09:00 更新')).toBeVisible();
        const 输入框 = page.getByPlaceholder(文案.输入占位);
        await expect(输入框).toBeVisible();
        await expect(输入框).toBeEnabled();
        await expect(page.getByRole('button', { name: 文案.快捷句 })).toBeVisible();
        if (角色 === 'candidate') {
          // 求职端无漏斗；招聘端五档漏斗只有「硬性匹配」可点（button），其余四档是 div
          await expect(page.locator('[class*="漏斗行"]')).toHaveCount(0);
        } else {
          await expect(page.locator('[class*="漏斗行"]')).toHaveCount(5);
          await expect(page.getByRole('button', { name: '硬性匹配 12，打开本周初筛记录' })).toHaveCount(1);
          await expect(page.locator('[class*="漏斗行可点"]')).toHaveCount(1);
          await expect(page.locator('div[class*="漏斗行"]')).toHaveCount(4);
        }

        // 初始截图：简报头滚进视口（对照 Task 1 基线的同内容区域）
        await 滚到简报头(page);
        await 存截图(testInfo, page, `agent-mock-${角色}-${宽度}-initial.png`);

        // 长文本输入：值如实上屏，不产生新横向溢出
        const 长文本 = '这是一条用于验收的超长输入，验证输入框增长与页面布局不破。'.repeat(10);
        await 输入框.fill(长文本);
        await expect(输入框).toHaveValue(长文本);
        expect(await 溢出像素(page)).toBe(0);
        await 等落定(page);
        await 存截图(testInfo, page, `agent-mock-${角色}-${宽度}-longtext.png`);

        // 快捷句立即上屏（草稿被清掉），550ms 后等真实 DOM 回复
        await page.getByRole('button', { name: 文案.快捷句 }).click();
        const 我方气泡们 = page.locator('[class*="我行"]');
        await expect(我方气泡们.last()).toContainText(文案.快捷句);
        await expect(输入框).toHaveValue('');
        await expect(page.getByText(文案.代理回复)).toBeVisible({ timeout: 5_000 });

        // 建议操作（顺序随两端行为）：先放宽 —— 求职留本页/轻提示、招聘跳设置再返回，
        // 两端按钮都不因放宽退场；再维持 —— 不导航、双按钮换成对应端的确认文案
        if (角色 === 'candidate') {
          await page.getByRole('button', { name: 文案.放宽键 }).click();
          await expect(page.getByText('已记成规则')).toBeVisible();
          await expect(page).toHaveURL(文案.代理路径);
        } else {
          await page.getByRole('button', { name: 文案.放宽键 }).click();
          await expect(page).toHaveURL(/#\/hr\/agent-settings$/, { timeout: 10_000 });
          await expect(page.getByText('薪资带上限可放宽 5K，其余硬性项不变')).toBeVisible();
          await page.getByRole('button', { name: '返回' }).click();
          await expect(page).toHaveURL(文案.代理路径, { timeout: 10_000 });
        }
        await page.getByRole('button', { name: '维持红线' }).click();
        await expect(page.getByText(文案.维持确认)).toBeVisible();
        await expect(page).toHaveURL(文案.代理路径);
        await expect(page.getByRole('button', { name: '维持红线' })).toHaveCount(0);
        await 滚到简报头(page);
        await 存截图(testInfo, page, `agent-mock-${角色}-${宽度}-suggestion.png`);

        // Mock 旅程零业务 API 请求（沿用 安装诊断 的 /api/v1 监听范围，不含 HMR）
        expect(诊断.apiRequests, 'Mock 旅程业务 API 请求').toEqual([]);
        诊断.detach();
      });
    }
  });
}
