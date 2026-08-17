// 入口：全局状态 → 设备外框（桌面画机身 / 真机全屏）→ 哈希路由。
// 用 HashRouter 而不是 BrowserRouter：GitHub Pages 子路径和 Capacitor 的
// WKWebView 都不需要服务端 rewrite 配合，刷新任意一屏都不会 404。

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import './样式/全局.css';
import 应用 from './应用';
import 设备外框 from './组件/设备外框';
import { 应用状态提供者 } from './状态/应用状态';

createRoot(document.getElementById('根节点')!).render(
  <StrictMode>
    <应用状态提供者>
      <设备外框>
        <HashRouter>
          <应用 />
        </HashRouter>
      </设备外框>
    </应用状态提供者>
  </StrictMode>
);
