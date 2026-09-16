// e2e/离线边界.spec.ts
// C3 离线边界的本地浏览器反例（Task 1）。
//
// 这是「唯一无自动检查的明确例外」：本文件从原生 Playwright 导入 test/expect，
// 不走 e2e/fixtures/test.ts 的自动安装/核对 —— 它要手动调用 安装离线边界 并以
// 本地 context 的 核对() 异常作为可断言结果，证明预期违例确实会被抓住。
//
// 反例只用本地受控目标：所有业务请求都发往本机 dev server（4181）的 /api/v1
// 坐标，由边界在浏览器网络层中止，绝不调用真实远端验证。覆盖：
//   1. 未声明 HTTP、带 query 与下载请求被中止并记录；
//   2. 已声明页面级 route 优先应答，边界零记录；
//   3. 业务 WebSocket：未知记录失败，events/live 空闲本地连接（fixture 模式）；
//   4. Mock 模式业务 HTTP/WS 均不允许（events/live 同样计入）；
//   5. 自建 context 显式安装/核对/关闭，默认 page 的保护不覆盖第二 context；
//   6. 静态资源与 Vite HMR 不受边界影响。

import { expect, test, type Browser } from '@playwright/test';
import { 安装离线边界, type 测试模式 } from './fixtures/离线边界';

const 本地根 = 'http://127.0.0.1:4181/';

/** 手动装边界的受控 context：模式与核对结果都由用例自持。 */
async function 装边界context(browser: Browser, 模式: 测试模式) {
  const context = await browser.newContext();
  const 边界 = await 安装离线边界(context, 模式);
  const page = await context.newPage();
  return { context, 边界, page };
}

test.describe('离线边界反例（本地受控目标）', () => {
  test('未声明业务 HTTP、带 query 与下载请求被中止并记录', async ({ browser }) => {
    const { context, 边界, page } = await 装边界context(browser, 'fixture');
    try {
      await page.goto(本地根);
      const 结果 = await page.evaluate(async () => {
        const 试 = async (坐标: string) => {
          try {
            const 响应 = await fetch(坐标);
            return `状态 ${响应.status}`;
          } catch (原因) {
            return `拒绝 ${String(原因)}`;
          }
        };
        return {
          普通: await 试('/api/v1/undeclared-endpoint'),
          带query: await 试('/api/v1/me/data-exports/h/download?token=abc'),
        };
      });
      // 兜底中止：fetch 直接拒绝，而不是把请求放去真实业务服务
      expect(结果.普通).toMatch(/^拒绝/);
      expect(结果.带query).toMatch(/^拒绝/);

      // 下载坐标（导航型）：同样被边界中止，页面拿到的是导航失败不是文件
      const 下载导航 = await page
        .goto(`${本地根}api/v1/me/data-exports/h/download`)
        .then(() => '导航成功', (原因: unknown) => `导航拒绝 ${String(原因)}`);
      expect(下载导航).toMatch(/^导航拒绝/);

      // 核对() 异常即断言结果：method/path 精确可定位
      expect(() => 边界.核对()).toThrow(/GET \/api\/v1\/undeclared-endpoint/);
      expect(() => 边界.核对()).toThrow(/GET \/api\/v1\/me\/data-exports\/h\/download\?token=abc/);
      expect(() => 边界.核对()).toThrow(/GET \/api\/v1\/me\/data-exports\/h\/download$/);
    } finally {
      await context.close();
    }
  });

  test('已声明页面级 route 优先应答，边界零记录', async ({ browser }) => {
    const { context, 边界, page } = await 装边界context(browser, 'fixture');
    try {
      // 页面级精确 route 先于 context 级边界：声明过的坐标照常应答
      await page.route('**/api/v1/declared-only', async (route) => {
        await route.fulfill({ status: 200, json: { ok: true } });
      });
      await page.goto(本地根);
      const 应答 = await page.evaluate(async () => {
        const 响应 = await fetch('/api/v1/declared-only');
        return { 状态: 响应.status, 正文: await 响应.json() };
      });
      expect(应答.状态).toBe(200);
      expect(应答.正文).toEqual({ ok: true });
      // 已应答的请求不进未声明记录
      expect(() => 边界.核对()).not.toThrow();
    } finally {
      await context.close();
    }
  });

  test('业务 WebSocket：未知记录失败，events/live 空闲本地连接（fixture 模式）', async ({ browser }) => {
    const { context, 边界, page } = await 装边界context(browser, 'fixture');
    try {
      await page.goto(本地根);
      const 套接字 = await page.evaluate(async () => {
        const 等开 = (坐标: string) => new Promise<string>((resolve) => {
          const 套 = new WebSocket(坐标);
          const 计时 = setTimeout(() => resolve('超时未开'), 3_000);
          套.onopen = () => { clearTimeout(计时); resolve(`已开 ${套.readyState}`); };
          套.onclose = () => { clearTimeout(计时); resolve('已关'); };
          套.onerror = () => { clearTimeout(计时); resolve('出错'); };
        });
        return {
          事件流: await 等开('/api/v1/events/live'),
          未知: await 等开('/api/v1/ws-undeclared'),
        };
      });
      // 已声明事件流：空闲本地连接 —— 页面侧照常打开，背后零真实服务
      expect(套接字.事件流).toBe('已开 1');
      // 未知业务 WS：记录失败并关闭，绝不 connectToServer
      expect(['已开 1', '已关', '出错']).toContain(套接字.未知);
      expect(() => 边界.核对()).toThrow(/WS \/api\/v1\/ws-undeclared/);
      expect(() => 边界.核对()).not.toThrow(/events\/live/);
    } finally {
      await context.close();
    }
  });

  test('Mock 模式业务 HTTP/WS 均不允许：记录非空即失败', async ({ browser }) => {
    const { context, 边界, page } = await 装边界context(browser, 'mock');
    try {
      await page.goto(本地根);
      const fetch结果 = await page.evaluate(async () => {
        try { await fetch('/api/v1/probe'); return '状态 200'; } catch { return '拒绝'; }
      });
      expect(fetch结果).toBe('拒绝');
      await page.evaluate(() => {
        const 套 = new WebSocket('/api/v1/events/live');
        void 套; // mock 模式下 events/live 同样计入，不需要等它
      });
      await page.waitForTimeout(200);
      const 信息 = (() => { try { 边界.核对(); return '核对通过'; } catch (原因) { return String(原因); } })();
      expect(信息).toContain('GET /api/v1/probe');
      expect(信息).toContain('WS /api/v1/events/live');
    } finally {
      await context.close();
    }
  });

  test('自建 context 显式安装边界：第二 context 违例由自己的核对定位', async ({ browser }) => {
    const 第一 = await 装边界context(browser, 'fixture');
    const 第二 = await 装边界context(browser, 'fixture');
    try {
      await 第一.page.goto(本地根);
      await 第二.page.goto(本地根);
      // 第二 context 的违例（默认 page 的保护不覆盖它，必须显式安装边界）
      await 第二.page.evaluate(async () => {
        try { await fetch('/api/v1/second-context-probe'); } catch { /* 中止即预期 */ }
      });
      // 第一 context 零记录、第二 context 由自己的核对定位
      expect(() => 第一.边界.核对()).not.toThrow();
      expect(() => 第二.边界.核对()).toThrow(/GET \/api\/v1\/second-context-probe/);
    } finally {
      await 第二.context.close();
      await 第一.context.close();
    }
  });

  test('静态资源与 Vite HMR 不受边界影响', async ({ browser }) => {
    const { context, 边界, page } = await 装边界context(browser, 'fixture');
    try {
      // 纯静态 + HMR 加载完整登录页（无任何业务请求），边界零记录
      await page.goto(本地根);
      await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
      expect(() => 边界.核对()).not.toThrow();
    } finally {
      await context.close();
    }
  });
});