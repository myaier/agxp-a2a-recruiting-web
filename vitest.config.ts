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
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', '.claude/**'],
  },
});
