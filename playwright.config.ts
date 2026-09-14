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
  // e2e/ 下其余 *.test.ts 同理是 Vitest 单测，由 '**/*.test.ts' 统一排除。
  // J-PILOT-02接线.spec.ts 全部用例 @backend 且钉 4182（本 config 只起 4173），
  // 由 playwright.数据源模式.config.ts 的 backend-stg 项目单独驱动，默认入口排除。
  testIgnore: ['**/数据源模式.spec.ts', '**/视觉回归/**', '**/*.test.ts', '**/J-PILOT-02接线.spec.ts'],
  // Backend fixture / 标注用例只在数据源入口的对应项目跑；默认入口按标签再挡一层，
  // 防止将来新增 spec 忘写 testIgnore 时 Backend 用例误连 4173 Mock 冒充结果。
  grepInvert: /@backend|@annotation/,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // 功能项目固定 UTC；采集 suite（P1展示统一/展示字段接线/问AI代理 Mock 等）
    // 自带 test.use timezoneId 的以 suite 为准（Asia/Shanghai），这里只是缺省兜底。
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  webServer: {
    // 显式 mock/stg + 关标注：不依赖 shell 环境或 .env.local，Backend/标注构建
    // 各归各的入口。--strictPort = 端口被占即失败，不会静默漂移端口导致 baseURL 对不上。
    command:
      'VITE_DATA_SOURCE=mock VITE_BACKEND_ENV=stg VITE_ANNOTATION_ENABLED=false npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
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
