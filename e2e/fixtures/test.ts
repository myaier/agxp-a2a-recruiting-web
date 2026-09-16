// e2e/fixtures/test.ts
// 统一功能 test 入口：在导航前为每个测试的 browser context 安装 C3 离线边界，
// Case teardown 调用 核对() —— 未声明业务请求（HTTP 兜底中止 / 业务 WS 失败）即失败。
//
// 用法：功能 spec 一律 `import { expect, test } from './fixtures/test'`；
// 类型（Page / Route / Locator / BrowserContext 等）仍从 '@playwright/test' 导入。
// 视觉采集 spec（e2e/视觉回归/采集.spec.ts）因视觉配置是空项目名，在该文件内
// 以同一个 离线边界 helper 做 file 级 extend 固定 mock 模式（C3：仅该文件取 mock）。
//
// 模式由项目名映射（playwright.config.ts 三项目）：
//   mock → 'mock'（业务 HTTP/WS 均不允许）
//   fixture → 'fixture'（页面级 fixture route 先应答，events/live 空闲本地连接）
//   annotation → 'annotation'
// 自行 browser.newContext 的用例不享受默认 context 的保护：须显式 安装离线边界、
// finally 核对并关闭（见 J-PILOT-02 共用布局用例）；边界自身反例 spec 是唯一
// 允许从原生 Playwright 导入并手动调用 helper 的明确例外（e2e/离线边界.spec.ts）。

import { test as base, expect } from '@playwright/test';
import { 安装离线边界, type 测试模式 } from './离线边界';

const 项目模式表: Record<string, 测试模式> = {
  mock: 'mock',
  fixture: 'fixture',
  annotation: 'annotation',
};

export const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    const 模式 = 项目模式表[testInfo.project.name];
    if (模式 === undefined) {
      throw new Error(
        `离线边界不认识项目「${testInfo.project.name}」：功能 spec 必须跑在 playwright.config.ts 的 mock / fixture / annotation 三项目下`,
      );
    }
    const 边界 = await 安装离线边界(context, 模式);
    await use(context);
    边界.核对();
  },
});

export { expect };