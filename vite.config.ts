import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { 解析运行配置, 取代理描述, 断言运行场景 } from './src/配置/运行配置.ts';

// GitHub Pages 把仓库挂在子路径下（williamszhu5 → myaier.github.io/<仓库名>/），
// 所以生产构建要带 base 前缀，否则 JS/CSS 全部 404。
// 本地开发不加前缀，dev server 直接跑在根路径上。
const 仓库名 = 'agxp-a2a-recruiting-web';

export default defineConfig(({ command, mode }) => {
  const 环境 = loadEnv(mode, process.cwd(), '');
  const 运行 = 解析运行配置(环境);
  断言运行场景(运行, command);
  const 代理 = 取代理描述(运行);

  console.log(`数据源=${运行.数据源 === 'backend' ? `backend/${运行.后端环境}` : 运行.数据源}`);

  return {
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
      proxy: 代理 ? {
        '/api/v1': {
          target: 代理.target,
          changeOrigin: 代理.改写Origin !== null,
          configure(proxy) {
            if (!代理.改写Origin) return;
            proxy.on('proxyReq', (request) => request.setHeader('Origin', 代理.改写Origin!));
          },
        },
      } : undefined,
    },
  };
});