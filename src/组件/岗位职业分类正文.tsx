// 岗位职业分类正文（Task 4）：发布岗位 职位类别 全屏选择子视图的两模式共用正文。
//
// 版式与 期望职位选择正文 同形（同一套三层目录能力，两个真实消费者共用）：
//   全屏外壳（标题「职位类别」+ 返回）→ 左栏一级 → 右栏「二级分组标题（h3）
//   + 该组三级可选职位」。二级是标题不是按钮：打开一级即自动出现该一级的分组与职位，
//   用户不需要再点二级（加载顺序、分页、换版、重试与迟到守卫都在页面局部的目录钩子里，
//   正文不持游标、不发请求）。
//
// 本组件是纯展示正文：只收展示值、稳定键、各级尾态与回调，不依赖数据源模式、BFF DTO、
// Context、API、路由或存储。招聘侧保持单选：点合法（可选）叶子即 选定(键) 一次，
// 页面据此回填并关闭；不引入求职端的多选数量、选择确认步骤或搜索入口。
//
// 两模式映射都由页面提供：Mock 用本地 职业分类树 的真实分组，Backend 用
// 期望职位目录钩子的输出（组员 = 三级 selectable 叶子，键 = 目录 ID）。

import 样式 from '../屏幕/发布岗位.module.css';
import { 全屏选择外壳 } from './全屏选择外壳';
import type { 目录尾态, 期望职位组, 期望职位项 } from './期望职位选择正文';

/** 正文 props（页面局部契约，不是公共领域模型）：类型复用期望职位正文已导出类型 */
export type 岗位职业分类正文Props = {
  根项们: { 键: string; 名称: string; 选中: boolean }[];
  切换根: (键: string) => void;
  根尾态: 目录尾态;
  组们: 期望职位组[];
  右尾态: 目录尾态;
  选定: (键: string) => void;
  关闭: () => void;
};

/** 尾态反馈块：与 期望职位选择正文 同一形态（错误 → 文案 + 重试；无项加载中；还有 → 加载更多） */
function 尾态反馈(尾态: 目录尾态, 有项: boolean): React.JSX.Element | null {
  if (尾态.错误 !== null) {
    return (
      <div className={样式.尾态行}>
        {尾态.错误}
        <button className="可点" style={{ marginLeft: 8, textDecoration: 'underline' }} onClick={尾态.重试}>
          重试
        </button>
      </div>
    );
  }
  if (!有项 && 尾态.加载中) return <div className={样式.尾态行}>加载中…</div>;
  if (尾态.还有) {
    return (
      <button
        className="可点"
        style={{ width: '100%', padding: '10px', color: 'var(--最弱)' }}
        disabled={尾态.加载中}
        onClick={尾态.加载更多}
      >
        {尾态.加载中 ? '加载中…' : '加载更多'}
      </button>
    );
  }
  return null;
}

export function 岗位职业分类正文({
  根项们,
  切换根,
  根尾态,
  组们,
  右尾态,
  选定,
  关闭,
}: 岗位职业分类正文Props): React.JSX.Element {
  /** 左栏一级：选中态照旧高亮（浅灰底 → 白底 + 荧光绿左条由 CSS 呈现）；点击只换根 */
  const 根项键 = (项: { 键: string; 名称: string; 选中: boolean }) => (
    <button
      key={项.键}
      className={`${样式.大类项} ${项.选中 ? 样式.大类项选中 : ''} 可点`}
      onClick={() => 切换根(项.键)}
    >
      {项.名称}
    </button>
  );

  /** 右栏三级职位：可选单击 选定；禁用项保留展示但不提交（父节点不伪装成职位） */
  const 叶项键 = (项: 期望职位项) => (
    <button
      key={项.键}
      className={`${样式.小类项} ${项.选中 ? 样式.小类项选中 : ''} 可点`}
      onClick={项.禁用 ? undefined : () => 选定(项.键)}
      aria-disabled={项.禁用 ? true : undefined}
    >
      {项.名称}
      {项.选中 ? <span className={样式.小类勾}>✓</span> : null}
    </button>
  );

  /** 一个二级分组：标题（语义 heading，不渲染 button）+ 本组三级职位 + 本组自己的尾态。
   *  空组显示「该分组暂无职位」—— 与「失败（错误 + 重试）」可区分。 */
  const 分组块 = (组: 期望职位组) => (
    <div key={组.键} className={样式.分组块}>
      {组.标题 === '' ? null : <h3 className={样式.分组标}>{组.标题}</h3>}
      {组.项们.map(叶项键)}
      {组.项们.length === 0 && !组.尾态.加载中 && 组.尾态.错误 === null && !组.尾态.还有 ? (
        <div className={样式.尾态行}>该分组暂无职位</div>
      ) : null}
      {尾态反馈(组.尾态, 组.项们.length > 0)}
    </div>
  );

  return (
    <全屏选择外壳 标题="职位类别" 关闭={关闭}>
      <div className={样式.分类体}>
        {/* 左栏：一级根项 + 根尾态（分页/错误重试在页面侧） */}
        <div className={`${样式.大类栏} 滚动区`}>
          {根项们.map(根项键)}
          {尾态反馈(根尾态, 根项们.length > 0)}
        </div>
        {/* 右栏：当前一级的二级分组（标题）与各组三级职位 + 整栏尾态 */}
        <div className={`${样式.小类栏} 滚动区`}>
          {组们.map(分组块)}
          {尾态反馈(右尾态, 组们.length > 0)}
        </div>
      </div>
    </全屏选择外壳>
  );
}
