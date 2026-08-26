import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/视觉回归',
  testMatch: '采集.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 45_000,
  use: {
    ...devices['iPhone 13'],
    baseURL: process.env.UI_BASE_URL ?? 'http://127.0.0.1:4174',
    browserName: 'chromium',
    channel: process.env.CI ? undefined : 'chrome',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `VITE_DATA_SOURCE=mock VITE_BACKEND_ENV=stg npm run dev -- --host 127.0.0.1 --port ${process.env.UI_PORT ?? '4174'} --strictPort`,
    url: process.env.UI_BASE_URL ?? 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});