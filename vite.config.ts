import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 把仓库挂在子路径下（williamszhu5 → myaier.github.io/<仓库名>/），
// 所以生产构建要带 base 前缀，否则 JS/CSS 全部 404。
// 本地开发不加前缀，dev server 直接跑在根路径上。
const 仓库名 = 'agxp-a2a-recruiting-web';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${仓库名}/` : '/',
  plugins: [react()],
  css: {
    modules: {
      // 类名带上源文件名：标注模式点到任何元素，都能从 class 直接反查
      // 「哪个屏幕文件的哪个类」，这是「点一下代替描述位置」的基础
      generateScopedName: '[name]__[local]__[hash:base64:4]',
    },
  },
  build: {
    outDir: 'dist',
    // 原型阶段留 sourcemap，真机上出问题好定位
    sourcemap: true,
  },
  server: {
    // Capacitor 真机联调时要用局域网地址访问 dev server
    host: true,
  },
}));
