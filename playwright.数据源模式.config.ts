// 数据源模式 E2E 配置：同时启动两个不可复用的 Vite dev server，
// 显式 mock/stg（端口 4181）与 backend/stg（端口 4182），两者端口/baseURL 不同。
//
// Playwright 1.43+ 支持 webServer 数组（1.62 确认支持），直接用两条 webServer 配置，
// 各自 reuseExistingServer: false —— 避免开发者已运行的 dev server 或 .env.local 污染验收。
// 两个 server 端口不同 → 浏览器存储属于不同 origin，不能用它们伪造「同源切换模式」
// 的持久化证明；该边界由 Task 2 的同 origin jsdom/component test 覆盖。
//
// channel: 'chrome' = 用本机已装的 Google Chrome，不依赖 Playwright 自带 chromium
// （本机 ~/Library/Caches/ms-playwright 为空，没有自带浏览器分发包）。
// --strictPort = 端口被占时直接失败，不会静默跳到 4182/4183 让 baseURL 对不上。

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // 视觉回归/ 与默认 config 同口径排除（本配置创建时该目录尚不存在）：
  //   - 采集.spec.ts 需要专用 webServer（4174/4175）和 UI_CAPTURE_DIR，由
  //     playwright.视觉回归.config.ts 单独驱动；
  //   - *.test.ts 是 Vitest 单测，Playwright 收走会因找不到 vitest suite 直接崩，
  //     连带整个 testDir 加载失败（0 tests in 0 files）。
  testIgnore: ['**/视觉回归/**', '**/*.test.ts'],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      name: 'mock-stg',
      command:
        'VITE_DATA_SOURCE=mock VITE_BACKEND_ENV=stg npm run dev -- --host 127.0.0.1 --port 4181 --strictPort',
      url: 'http://127.0.0.1:4181',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      name: 'backend-stg',
      command:
        'VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=stg npm run dev -- --host 127.0.0.1 --port 4182 --strictPort',
      url: 'http://127.0.0.1:4182',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // 标注评审构建：唯一带 VITE_ANNOTATION_ENABLED=true 的 server —— 标注 UI
      // 只在显式开启的构建里存在，缺省构建（4181/4182、生产 Pages）不渲染标注层
      name: 'backend-stg-annotation',
      command:
        'VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=stg VITE_ANNOTATION_ENABLED=true npm run dev -- --host 127.0.0.1 --port 4183 --strictPort',
      url: 'http://127.0.0.1:4183',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'mock-stg',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        channel: 'chrome',
        baseURL: 'http://127.0.0.1:4181',
      },
      // 只跑带 @mock 标签的用例（Mock 回归 @mock，Backend fixture @backend）
      grep: /@mock/,
    },
    {
      name: 'backend-stg',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        channel: 'chrome',
        baseURL: 'http://127.0.0.1:4182',
      },
      grep: /@backend/,
    },
    {
      // 隔离的标注项目：只跑 @annotation 用例，钉到 4183 标注构建
      name: 'backend-stg-annotation',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        channel: 'chrome',
        baseURL: 'http://127.0.0.1:4183',
      },
      grep: /@annotation/,
    },
  ],
});