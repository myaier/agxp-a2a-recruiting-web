// 教育目录候选列表（Task 5，core editors §5.2）：教育编辑页 学校/专业 候选行的两模式共用列表。
//
// 原稿（review-r1 P1-3 / review-r2 R2-M-1）在教育编辑页里有两份几乎相同的候选 JSX：
// 学校行 = 名称 + 「城市 · 国家」副行（inline 字体/颜色），专业行 = 仅名称，列表尾
// 「加载更多」（忙时「加载中…」并 disabled）。本组件把这份 JSX 提取为一个具体组件，
// 学校与专业在 Mock/Backend 两模式都调用；选中行沿用 入职引导.module.css 既有
// 候选行选中/候选勾 样式（✓ 是真实元素，与 毕业院校 同构），不新增 CSS。
//
// 纯展示组件：只收展示值、稳定键、状态与回调，不依赖数据源模式、BFF DTO、Context、
// API、路由或存储。真实目录引用、ID 解析、分页游标、250ms 防抖与目录版本/迟到响应
// 守卫都留在页面外层（src/屏幕/工作经历.tsx 的 教育编辑页）；组件按 键 回报点击，
// 不按名称反查真实 ID —— 同名不同 ID 由键区分。

import 引导样式 from '../屏幕/入职引导.module.css';

/** 一枚候选展示值：键是稳定键（Backend = 目录 ID，Mock = 局部模拟键），副文只有学校有 */
export type 教育候选 = { 键: string; 名称: string; 副文?: string; 选中: boolean };

/** 正文 props（页面局部契约，不是公共领域模型） */
export type 教育目录候选列表Props = {
  项们: 教育候选[];
  加载中: boolean;
  还有: boolean;
  选定: (键: string) => void;
  加载更多: () => void;
};

export function 教育目录候选列表({
  项们,
  加载中,
  还有,
  选定,
  加载更多,
}: 教育目录候选列表Props): React.JSX.Element {
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