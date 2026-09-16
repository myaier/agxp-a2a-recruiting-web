// e2e/fixtures/离线边界.ts
// C3 离线请求边界：在导航前为浏览器 context 安装「最末级」业务 HTTP/WS 防漏边界。
//
// 业务路径判定（冻结口径）：URL pathname 的前两个非空路径段依次为 api、v1
//（其后为空或继续以斜杠分段），query、下载与事件流一并计入；不限制 hostname ——
// fixture 的 cdn.fixture.example 这类非 /api/v1 路径不受影响，Vite HMR
//（ws://…/ 与 /@vite/*）与静态资源同理放行。
//
// 分层：已有页面级 route / routeWebSocket 先处理（Playwright 中 page 级优先于
// context 级）；本边界挂在 context 级，任何未被页面级 fixture 应答的业务请求
// 都会在这里被中止并记录，Case teardown 由 核对() 抛错定位。边界 handler 绝不
// continue / fetch，不存在经边界转发到真实业务服务的通路。
//
// 边界保证止于测试进程：不修改生产代理目标、不改业务代码。
// 注意：测试程序用 context.request / page.request 直接访问业务接口不经过浏览器
// route，边界看不到 —— 该用法本身被禁止（探活 skip 已删除，以 runner webServer
// 就绪为准），不要在新用例里重新引入。

import type { BrowserContext, Route, WebSocketRoute } from '@playwright/test';

export type 测试模式 = 'mock' | 'fixture' | 'annotation';

/** 业务路径判定：pathname 前两个非空段依次为 api、v1（含 query / 下载 / 事件流）。 */
export function 是业务URL(url: URL): boolean {
  const 段们 = url.pathname.split('/').filter((段) => 段 !== '');
  return 段们[0] === 'api' && 段们[1] === 'v1';
}

/** 事件流坐标（fixture / annotation 模式已声明的唯一可用空闲本地连接）。 */
const 事件流路径 = '/api/v1/events/live';

/**
 * 为 context 安装最末级业务 HTTP/WS 防漏边界。
 *
 * · HTTP：兜底中止（abort）并记录未声明请求（method + path）。
 * · 业务 WS：永不 connectToServer。fixture / annotation 模式下 /api/v1/events/live
 *   保持空闲本地连接（页面侧视为已打开，零真实服务）；其余业务 WS 记录失败。
 *   mock 模式业务 HTTP/WS 均不允许，events/live 同样计入记录。
 *
 * 核对() 在 Case teardown 调用；发现未声明业务请求即抛错，信息仅含 method/path。
 */
export async function 安装离线边界(
  context: BrowserContext,
  模式: 测试模式,
): Promise<{ 核对(): void }> {
  const 未声明: string[] = [];

  await context.routeWebSocket(是业务URL, (webSocket: WebSocketRoute) => {
    const url = new URL(webSocket.url());
    const path = url.pathname + url.search;
    // 已声明事件流（非 mock）：保持空闲本地连接 —— 不 connectToServer，页面侧
    // 套接字照常打开，但背后没有任何真实服务。
    if (模式 !== 'mock' && url.pathname === 事件流路径) return;
    // 其余业务 WS：记录失败并关闭（与 HTTP 兜底中止同语义），同样绝不 connectToServer。
    未声明.push(`WS ${path}`);
    webSocket.close();
  });

  await context.route(是业务URL, async (route: Route) => {
    const 请求 = route.request();
    const url = new URL(请求.url());
    未声明.push(`${请求.method()} ${url.pathname}${url.search}`);
    await route.abort();
  });

  return {
    核对(): void {
      if (未声明.length > 0) {
        throw new Error(
          `离线边界：发现 ${未声明.length} 个未声明业务请求（应为零；缺应答只修测试定义，不改产品）\n${未声明.join('\n')}`,
        );
      }
    },
  };
}