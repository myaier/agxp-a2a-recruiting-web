// 入口：全局状态 → 设备外框（桌面画机身 / 真机全屏）→ 哈希路由。
// 用 HashRouter 而不是 BrowserRouter：GitHub Pages 子路径和 Capacitor 的
// WKWebView 都不需要服务端 rewrite 配合，刷新任意一屏都不会 404。
//
// 标注工具按构建门控（Task 7）：只有 VITE_ANNOTATION_ENABLED=true 的构建
// （标注评审专用 dev server，见 playwright.数据源模式.config.ts 端口 4183）才
// 渲染标注层；缺省构建（Mock / Backend E2E、生产 Pages）连标注层带工具车道
// 一起整个缺席，业务布局一像素不动。

import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import './样式/全局.css';
import 应用 from './应用';
import 设备外框 from './组件/设备外框';
import 标注层 from './组件/标注层';
import 标注样式 from './组件/标注层.module.css';
import { 换壳遮罩看守 } from './路由/换壳遮罩';
import { 应用状态提供者 } from './状态/应用状态';

/** 标注工具的构建开关：环境变量是字符串，只认字面 'true' */
const 启用标注 = import.meta.env.VITE_ANNOTATION_ENABLED === 'true';

/**
 * 入口内容：标注开启时外面多一层「评审布局」—— 设备内容占主槽，标注启动器
 * portal 到设备外的预留工具车道（宽屏右侧 64px 列 / 窄屏底部 80px 行，见
 * 标注层.module.css）。工具不再悬在设备里挡业务键；标注层其余部分（输入条、
 * 导出面板、遮罩）仍是设备内的设备尺寸覆盖件。
 * 要用组件而不是顶层表达式：车道 DOM 节点要经 ref 传给设备内的标注层做 portal。
 */
function 入口内容() {
  const [标注工具容器, 设标注工具容器] = useState<HTMLDivElement | null>(null);

  return 启用标注 ? (
    <div className={标注样式.评审布局}>
      <div className={标注样式.应用槽}>
        <设备外框 填满父级>
          <HashRouter>
            <应用 />
            {/* 换壳遮罩看守：放在 Routes 外面，换屏时不跟着卸载，
                地址真正提交到目标屏时负责把遮罩撤掉（见 路由/换壳遮罩.ts） */}
            <换壳遮罩看守 />
            {/* 标注模式：点元素提修改意见，导出贴给 Claude（见 docs/前端修改指南.md）；
                启动器 portal 到下面的工具车道，不挡设备内业务键 */}
            <标注层 启动器容器={标注工具容器} />
          </HashRouter>
        </设备外框>
      </div>
      {/* 设备外的保留工具车道：启动器（铅笔 + 计数角标）的 portal 挂载点 */}
      <div ref={设标注工具容器} className={标注样式.工具占位} data-标注工具位 />
    </div>
  ) : (
    <设备外框>
      <HashRouter>
        <应用 />
        {/* 换壳遮罩看守：放在 Routes 外面，换屏时不跟着卸载，
            地址真正提交到目标屏时负责把遮罩撤掉（见 路由/换壳遮罩.ts） */}
        <换壳遮罩看守 />
      </HashRouter>
    </设备外框>
  );
}

createRoot(document.getElementById('根节点')!).render(
  <StrictMode>
    <应用状态提供者>
      <入口内容 />
    </应用状态提供者>
  </StrictMode>
);
