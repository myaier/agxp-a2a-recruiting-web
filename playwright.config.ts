import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
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
