import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // 数据源模式.spec.ts 自带 test.use({ baseURL: 4181/4182 })，只在
  // playwright.数据源模式.config.ts（test:e2e:data-source）下跑——
  // 默认 config 只起 4173，跑它会连不上端口。这里排除，避免 `npm run test:e2e` 报连接拒绝。
  // 视觉回归/ 下有两类文件都不该进默认 e2e：
  //   - 采集.spec.ts 需要专用 webServer（4174/4175）和 UI_CAPTURE_DIR，由
  //     playwright.视觉回归.config.ts 单独驱动；默认 config 跑它会因缺端口/环境变量报错。
  //   - *.test.ts 是 Vitest 单测（@vitest-environment node + 从 'vitest' 导入），
  //     Playwright 收走会因找不到 vitest suite 直接崩。整个目录在这里排除。
  testIgnore: ['**/数据源模式.spec.ts', '**/视觉回归/**'],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'mobile-chromium',
      // channel: 'chrome' = 用本机已装的 Google Chrome，不用 Playwright 自带的那份。
      // 本机没有 chromium_headless_shell，不加这行整套 e2e 会在 launch 就挂
      // （Executable doesn't exist），看着像代码坏了。2026-08-22 之前有三个人
      // 各自写临时配置绕过一次，每次都要重新发现一遍 —— 修在这里，只发现一次。
      // CI 上若装了自带浏览器，删掉 channel 即可回到默认。
      use: { ...devices['iPhone 13'], browserName: 'chromium', channel: 'chrome' },
    },
  ],
});
