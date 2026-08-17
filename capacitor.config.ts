// Capacitor 配置。当前仓库先做 Web 层，iOS 壳按方案第 4 节第 2 步（关键链路 POC）再接。
// 接壳时执行：npm i @capacitor/core @capacitor/cli && npx cap add ios && npx cap sync
//
// 注意 webDir 指向 dist：Capacitor 打包的是 vite build 的产物，
// 也就是说「网页上能跑的那一版」和「装到 iPhone 上的那一版」是同一份构建产物。

import type { CapacitorConfig } from '@capacitor/cli';

const 配置: CapacitorConfig = {
  appId: 'com.myaier.agxp.recruiting',
  appName: '对席',
  webDir: 'dist',

  ios: {
    // 内容不允许缩放，保持 App 手感
    scrollEnabled: true,
    contentInset: 'never',
  },

  server: {
    // 真机联调时改成 Mac 的局域网地址，热更新直连 vite dev server；
    // 打包发版时必须注释掉，否则会变成「远程 H5 绕过审核」——方案里明确禁止。
    // url: 'http://192.168.1.10:5173',
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
};

export default 配置;
