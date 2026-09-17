import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/测试/设置.ts',
    clearMocks: true,
    // .claude/** 是 agent 工作区（里面是整个仓库的 git worktree 副本）：不排掉的话
    // vitest 会把副本里的 e2e/*.spec.ts 当单测收走，撞上 Playwright 的 test.describe 报错
    // ui-regression-output/** 是 git 忽略的截图捕获产物目录，同样可能放着 Playwright capture spec
    // （如 company-profile-education-ui/capture.spec.ts），vitest 收走会以同样方式崩掉收集
    // 只排除 Playwright spec（*.spec.ts），让 e2e/视觉回归/*.test.ts 跑在 Vitest 下
    exclude: ['e2e/**/*.spec.ts', 'node_modules/**', 'dist/**', '.claude/**', 'ui-regression-output/**'],
  },
});
