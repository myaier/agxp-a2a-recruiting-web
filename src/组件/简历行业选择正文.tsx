// 简历行业选择正文（editor-catalog-fullscreen Task 3）：经历编辑页 所属行业 全屏选择
// 子视图的两模式共用正文。原为 弹层框架 底部抽屉（工作经历.module.css 选择层 72% 限高，
// 抓手 + 层内标题「所属行业」），本 Task 只换外壳：标题进 全屏选择外壳 的 返回栏（A 契约），
// 旧抓手/遮罩/层内标题随之删除，不做行业搜索、不改行业数据源。
//
// 行业折叠目录列表原样保留（共用 行业分类列表）：容器 .列表 flex:1 / min-height:0 /
// overflow-y:auto 在外壳正文（纵向 flex、overflow hidden）里自滚，仍是唯一滚动区；
// 横向留白由内衬 wrapper 的 inline padding 提供（沿 页内 inline 版式 的既有做法，
// 不另建弹层样式、不为层级新造图标/面包屑）。
//
// 目录展开/缓存/分页/重试/换代机制由 屏幕/行业目录钩子 提供，页面注入查询适配。本组件是
// 纯展示正文：只收目录状态、稳定键、已选与回调，不依赖数据源模式、BFF DTO、Context、API、
// 路由或存储；选定归属（单选写当前经历草稿并关闭）在页面外层。

import { 全屏选择外壳 } from './全屏选择外壳';
import { 行业分类列表, type 行业项, type 行业目录状态 } from './行业分类列表';

/** 正文 props（页面局部契约，不是公共领域模型）；单选（上限=1） */
export type 简历行业选择正文Props = {
  目录: 行业目录状态;
  已选键: readonly string[];
  选择: (项: 行业项) => void;
  关闭: () => void;
};

export function 简历行业选择正文({ 目录, 已选键, 选择, 关闭 }: 简历行业选择正文Props): React.JSX.Element {
  return (
    <全屏选择外壳 标题="所属行业" 关闭={关闭}>
      {/* 内衬只补横向留白：纵向 flex 链保持，滚动仍只发生在 行业分类列表 自身 */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 18px' }}>
        <行业分类列表 {...目录} 已选键={已选键} 上限={1} 选择={选择} />
      </div>
    </全屏选择外壳>
  );
}
