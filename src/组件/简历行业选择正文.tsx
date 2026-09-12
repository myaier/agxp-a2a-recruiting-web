// 简历行业选择正文（Task 6，core editors §5.2）：经历编辑页 所属行业 底部选择层的两模式
// 共用正文。版式照原页行业层 JSX 自上而下：抓手 → 标题「所属行业」→ 按当前渲染顺序的
// 分段列表 → 可选的自填输入。样式直接沿用原页面 CSS（工作经历.module.css 的
// 选择层/选择项/选择勾/选择层输入），不另建样式，不为层级新造图标/面包屑/弹层。
//
// 分段是展示批次不是新树存储：页面把现有根/子/孙三层展开状态按当前渲染顺序切片映射
// （每段 = 既有列表的展示批次 + 其分页尾），各列表独立的 busy/还有/加载更多 原样进入
// 所属分段。本组件是纯展示正文：只收展示值、稳定键、状态与回调，不依赖数据源模式、
// BFF DTO、Context、API、路由或存储，也不读目录；真实目录引用、分页游标、迟到响应与
// 目录版本守卫都留在页面外层，组件按 键 回报点击，不按显示名反查真实 ID。
//
// 行点击沿现有优先级：可选则选定，否则可展开才展开；两者均真不发明第二种点击控件
//（需要同时可达两种操作时交 PM）。`可选` 源自 selectable、`可展开` 源自 has_children，
// 由页面原样映射，本组件不推导。自填是可选能力：Mock 提供自由文本（沿用原 Mock 兜底），
// Backend 不提供（当前真实引用不可自由文本提交），组件不读 mode。
//
// 已知既有 quirk（照原样保留，未在本组件修复）：弹层框架在父层每次重渲染时会把焦点
// 收回首个控件，自填多字符输入会被打断、随后 Enter 落到首个行项 —— 与原页一致，待 PM
// 裁定是否另行修复（弹层框架为共用基础组件，不在本任务文件清单内）。

import { Fragment } from 'react';
import 样式 from '../屏幕/工作经历.module.css';
import 弹层框架 from './弹层框架';

/** 一枚行业行的展示值：键是稳定键（Backend = 目录 ID，Mock = 局部模拟键），层级 0 根 / 1 子 / 2 孙 */
export type 简历行业行 = {
  键: string; 名称: string; 层级: 0 | 1 | 2;
  选中: boolean; 可选: boolean; 可展开: boolean; 展开中: boolean;
};

/** 一段（既有列表及其分页尾的展示批次）的展示输入；「加载中 / 还有 / 加载更多」指本段当前可见列表 */
export type 简历行业分段 = {
  键: string; 行们: 简历行业行[];
  加载中: boolean; 还有: boolean; 加载更多: () => void;
};

/** 正文 props（页面局部契约，不是公共领域模型） */
export type 简历行业选择正文Props = {
  分段们: 简历行业分段[]; 展开: (键: string) => void;
  选定: (键: string) => void; 关闭: () => void;
  自填?: { 值: string; 修改: (值: string) => void; 确认: () => void };
};

/** 层级缩进照原 inline padding（根 0 / 子 28 / 孙 52），无新增 CSS */
const 层级缩进: Record<简历行业行['层级'], number | undefined> = { 0: undefined, 1: 28, 2: 52 };

export function 简历行业选择正文({ 分段们, 展开, 选定, 关闭, 自填 }: 简历行业选择正文Props): React.JSX.Element {
  const 缩进值 = (层级: 简历行业行['层级']) => 层级缩进[层级];
  /** 行项：选中态照旧高亮（选择项选中 → 深绿 + ✓），点按按现有优先级归属 */
  const 行键 = (行: 简历行业行) => (
    <button
      key={行.键}
      className={`${样式.选择项} ${行.选中 ? 样式.选择项选中 : ''} 可点`}
      style={缩进值(行.层级) !== undefined ? { paddingLeft: 缩进值(行.层级) } : undefined}
      aria-busy={行.展开中 || undefined}
      onClick={() => {
        if (行.可选) {
          选定(行.键);
          return;
        }
        if (行.可展开) 展开(行.键);
      }}
    >
      {行.名称}
      {行.选中 ? <span className={样式.选择勾}>✓</span> : null}
    </button>
  );

  /** 段尾分页沿用原页控件：还有才渲染，忙时文案换「加载中…」并禁用；缩进随该段行层级 */
  const 尾键 = (段: 简历行业分段) =>
    段.还有 ? (
      <button
        className="可点"
        onClick={段.加载更多}
        disabled={段.加载中}
        style={{
          ...(缩进值(段.行们[0]?.层级 ?? 0) !== undefined ? { paddingLeft: 缩进值(段.行们[0]?.层级 ?? 0) } : {}),
          color: 'var(--最弱)',
        }}
      >
        {段.加载中 ? '加载中…' : '加载更多'}
      </button>
    ) : null;

  return (
    <弹层框架 标签="选择所属行业" 遮罩类名={样式.遮罩} 面板类名={样式.选择层} 关闭={关闭}>
      <div className={样式.选择层抓手} />
      <div className={样式.选择层标题}>所属行业</div>
      <div className={`${样式.选择层列表} 滚动区`}>
        {分段们.map((段) => (
          <Fragment key={段.键}>
            {段.行们.map(行键)}
            {尾键(段)}
          </Fragment>
        ))}
      </div>
      {自填 ? (
        <input
          className={样式.选择层输入}
          value={自填.值}
          placeholder="没有合适的？直接输入"
          onChange={(事件) => 自填.修改(事件.target.value)}
          onKeyDown={(事件) => {
            if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 自填.确认();
          }}
        />
      ) : null}
    </弹层框架>
  );
}
