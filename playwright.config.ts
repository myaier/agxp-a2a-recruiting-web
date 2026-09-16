// 唯一功能配置（C1）：三个项目共用一套 webServer（同一 invocation 内共享启动，
// 不为按 project 少起服务设计动态管理器）。
//   · mock → 4181（VITE_DATA_SOURCE=mock，其余功能 Case：@mock 与原无标签
//     onboarding/抽屉/换壳 等；grepInvert 挡掉 @backend/@annotation）
//   · fixture → 4182（VITE_DATA_SOURCE=backend；只选 @backend）
//   · annotation → 4183（backend 构建 + VITE_ANNOTATION_ENABLED=true；只选 @annotation）
// 构建环境不代表使用真实后端：fixture/annotation 的 /api/v1 全部由测试的
// 页面级 route fixture 应答，context 级离线边界（e2e/fixtures/离线边界.ts）
// 兜底中止任何漏网业务请求。
//
// 端口全部 --strictPort 且 reuseExistingServer: false —— 端口被占即失败，
// 不会静默漂移端口或复用不明服务。服务起不来由 runner 直接报基础设施失败，
// 用例内不再做可达性探测 skip。
//
// 视觉回归/（e2e/视觉回归/）由 playwright.视觉回归.config.ts 单独驱动
//（需要 UI_CAPTURE_DIR 与专用 webServer），本配置 testIgnore 整目录；
// *.test.ts 是 Vitest 单测，Playwright 收走会因找不到 vitest suite 崩，统一排除。

import { defineConfig, devices } from '@playwright/test';

const 起服务 = (端口: number, 环境: Record<string, string>) => ({
  command:
    `${Object.entries(环境).map(([键, 值]) => `${键}=${值}`).join(' ')} ` +
    `npm run dev -- --host 127.0.0.1 --port ${端口} --strictPort`,
  url: `http://127.0.0.1:${端口}`,
  reuseExistingServer: false,
  timeout: 120_000,
});

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/视觉回归/**', '**/*.test.ts'],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    // 功能项目固定 UTC；采集 suite（P1展示统一/展示字段接线/问AI代理 等）自带
    // test.use timezoneId 的以 suite 为准（Asia/Shanghai），这里只是缺省兜底。
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  webServer: [
    起服务(4181, { VITE_DATA_SOURCE: 'mock', VITE_BACKEND_ENV: 'stg', VITE_ANNOTATION_ENABLED: 'false' }),
    起服务(4182, { VITE_DATA_SOURCE: 'backend', VITE_BACKEND_ENV: 'stg', VITE_ANNOTATION_ENABLED: 'false' }),
    起服务(4183, { VITE_DATA_SOURCE: 'backend', VITE_BACKEND_ENV: 'stg', VITE_ANNOTATION_ENABLED: 'true' }),
  ],
  projects: [
    {
      name: 'mock',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        // channel: 'chrome' = 用本机已装的 Google Chrome，不用 Playwright 自带的那份。
        // 本机没有 chromium 分发包，不加这行整套 e2e 会在 launch 就挂；CI 上若装了
        // 自带浏览器则不强制本机 Chrome，按环境区分，只发现一次。
        ...(process.env.CI ? {} : { channel: 'chrome' }),
        baseURL: 'http://127.0.0.1:4181',
      },
      // Mock 选剩余功能 Case：原无标签 onboarding/抽屉/换壳 + @mock 标签用例；
      // backend/annotation 标签用例绝不混进 Mock 冒充结果。
      grepInvert: /@backend|@annotation/,
    },
    {
      name: 'fixture',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        ...(process.env.CI ? {} : { channel: 'chrome' }),
        baseURL: 'http://127.0.0.1:4182',
      },
      // 只选 @backend；一个叶子禁止同时携带 backend 与 annotation。
      grep: /@backend/,
    },
    {
      name: 'annotation',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        ...(process.env.CI ? {} : { channel: 'chrome' }),
        baseURL: 'http://127.0.0.1:4183',
      },
      // 只选 @annotation（标注构建 4183 独有构建）。
      grep: /@annotation/,
    },
  ],
});
