// 目录候选列表（Task 2）：教育组件已有候选行 JSX 的共用提取。
// 行 = 名称 + 可选副文（学校沿原「城市 · 国家」inline 字体/颜色），列表尾
// 「加载更多」（忙时「加载中…」并 disabled）；选中行沿用 入职引导.module.css 既有
// 候选行选中/候选勾 样式（✓ 是真实元素，与 毕业院校 同构）。
//
// 纯展示组件：只收展示值、稳定键、状态与回调，不依赖数据源模式、BFF DTO、Context、
// API、路由或存储。调用方（教育编辑页 / 公司选择层）把各自的展示值映射成这里的行，
// 组件按 键 回报点击，不按名称反查真实 ID —— 同名不同 ID 由键区分。

import 引导样式 from '../屏幕/入职引导.module.css';

/** 一枚候选展示值：键是稳定键（真实目录 ID / 组织 ID，Mock = 局部模拟键），副文可选 */
export type 目录候选 = { 键: string; 名称: string; 副文?: string; 选中: boolean };

/** 正文 props（页面局部契约，不是公共领域模型） */
export type 目录候选列表属性 = {
  项们: 目录候选[];
  加载中: boolean;
  还有: boolean;
  选定: (键: string) => void;
  加载更多: () => void;
};

export function 目录候选列表({
  项们,
  加载中,
  还有,
  选定,
  加载更多,
}: 目录候选列表属性): React.JSX.Element {
  return (
    <div className={引导样式.候选列表}>
      {项们.map((项) => (
        <button
          key={项.键}
          className={`${引导样式.候选行} ${项.选中 ? 引导样式.候选行选中 : ''} 可点`}
          aria-label={项.名称}
          onClick={() => 选定(项.键)}
        >
          {项.副文 !== undefined ? (
            <span>
              <span>{项.名称}</span>
              {/* 学校副行沿原「城市 · 国家」表示：inline 字体/颜色原样保留，不加新 CSS 类 */}
              <span style={{ display: 'block', fontSize: 12, color: 'var(--最弱)', fontWeight: 400 }}>
                {项.副文}
              </span>
            </span>
          ) : (
            项.名称
          )}
          {/* 选中勾沿用原 候选勾 结构（真实元素，2026-08-24 C1 定稿，不加 ::before 防双勾） */}
          {项.选中 ? <span className={引导样式.候选勾}>✓</span> : null}
        </button>
      ))}
      {/* review-r2 R2-M-1：搜索返回下一页时列表尾显示「加载更多」，沿用原控件忙态 */}
      {还有 ? (
        <button
          className={`${引导样式.候选行} 可点`}
          onClick={加载更多}
          disabled={加载中}
          aria-label="加载更多"
        >
          {加载中 ? '加载中…' : '加载更多'}
        </button>
      ) : null}
    </div>
  );
}