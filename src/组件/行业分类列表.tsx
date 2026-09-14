// 行业分类列表（picker 统一 Task 1）：选期望行业（全页多选）与 工作经历经历编辑页
// 所属行业（底部弹层单选）共用的折叠目录列表。纯展示：只收 行 目录行、根态与回调，
// 不读数据源模式、Context、BFF DTO 或路由；展开/缓存/分页/重试/换代机制由
// 屏幕/行业目录钩子 提供，页面注入查询适配并把已选/上限/选择归属留在业务侧。
//
// 行为契约（Plan 2026-09-14 Task 1）：
//   · 行点击归属：可选=选择（含取消已选）；可选且有子项=名称点击选择、独立展开钮展开
//     （分开选择区/展开按钮）；不可选且有子项=整行展开；不可选且无子项=死端不可点；
//   · 三级（层级 2）且有子项显示「暂不支持继续展开」，不伪装可选；
//   · 行尾状态（排在该行整块后代之后）：首载「加载中…」、失败=错误 + 重试、
//     成功空页=「暂无内容」、有下一页=「加载更多」（忙时禁用）；根态同口径；
//   · 上限：多选（上限>1）满额禁用未选可选行、已选行仍可点取消、展开行不受限；
//     单选（上限=1）不禁用，选定由页面语义（替换/关闭）决定；
//   · 容器 flex:1 / min-height:0 / overflow-y:auto：底部弹层里由 caller 限高的面板
//     （选择层 72%）内部滚动；全页滚动区里容器自然增高、由外层滚动区滚动。

import { Fragment, type CSSProperties } from 'react';
import 样式 from './行业分类列表.module.css';

/** 一枚行业目录项：键是稳定键（HTTP = 目录 ID，Mock = 局部模拟键），与名称分离 */
export type 行业项 = { 键: string; 名称: string; 可选: boolean; 有子项: boolean };

/** 一页目录查询返回：项 + 下一页游标 + 目录版本 */
export type 行业页 = { 项: 行业项[]; 下一页: string | null; 版本: string };

/** 目录页查询操作：父键 null = 根页；游标 null = 首页 */
export type 查询行业页 = (父键: string | null, 游标: string | null) => Promise<行业页>;

/** 一行目录行的展示值：行业项 + 该行名下子列表的可见状态（展开/加载中/错误/空/分页/深度上限） */
export type 行业行 = 行业项 & {
  层级: 0 | 1 | 2; 展开: boolean; 加载中: boolean;
  错误: string | null; 空: boolean; 可加载更多: boolean; 达深度上限: boolean;
};

/** 展示控制状态（= use行业目录 的返回字段），与业务选择输入一起组成组件 props */
export type 行业目录状态 = {
  行: 行业行[];
  根加载中: boolean;
  根错误: string | null;
  根空: boolean;
  根可加载更多: boolean;
  切换展开: (键: string) => void;
  加载更多: (父键: string | null) => void;
  重试: (父键: string | null) => void;
};

export type 行业分类列表Props = 行业目录状态 & {
  已选键: readonly string[];
  上限: number;
  选择: (项: 行业项) => void;
};

/** 层级缩进照原稿（根 0 / 子 28 / 孙 52），不新增图标/面包屑 */
const 层级缩进: Record<行业行['层级'], number | undefined> = { 0: undefined, 1: 28, 2: 52 };

export function 行业分类列表({
  行,
  根加载中,
  根错误,
  根空,
  根可加载更多,
  切换展开,
  加载更多,
  重试,
  已选键,
  上限,
  选择,
}: 行业分类列表Props): React.JSX.Element {
  const 已选集 = new Set(已选键);
  // 上限态只作用于多选（上限>1）：满额禁用未选可选行；已选行仍可点取消。
  // 单选（上限=1）选定即由页面语义处置（替换/关闭），不禁用其余行。
  const 多选已满 = 上限 > 1 && 已选键.length >= 上限;

  const 缩进样式 = (行级: 行业行): CSSProperties | undefined => {
    const 值 = 层级缩进[行级.层级];
    return 值 !== undefined ? { paddingLeft: 值 } : undefined;
  };

  /** 该行之后连续的更深层行数 = 它整块可见后代行数（行们按「父行后紧跟其可见后代」给出） */
  const 后代块长 = (下标: number): number => {
    const 层 = 行[下标]!.层级;
    let 长 = 0;
    while (下标 + 1 + 长 < 行.length && 行[下标 + 1 + 长]!.层级 > 层) 长 += 1;
    return 长;
  };

  /** 展开父行的尾部状态块：失败+重试 / 首载中 / 成功空页 / 分页尾 */
  const 行尾 = (行级: 行业行, 有可见后代: boolean): React.JSX.Element | null => {
    if (!行级.展开) return null;
    const 缩进 = 缩进样式(行级);
    const 尾: React.JSX.Element[] = [];
    if (行级.错误 !== null) {
      尾.push(
        <div key={`err-${行级.键}`} className={样式.尾区} style={缩进}>
          <span className={样式.错误文}>{行级.错误}</span>
          <button className={`${样式.重试键} 可点`} onClick={() => 重试(行级.键)}>
            重试
          </button>
        </div>,
      );
    } else if (行级.加载中 && !有可见后代 && !行级.可加载更多) {
      尾.push(<div key={`busy-${行级.键}`} className={样式.尾注} style={缩进}>加载中…</div>);
    } else if (行级.空) {
      尾.push(<div key={`empty-${行级.键}`} className={样式.尾注} style={缩进}>暂无内容</div>);
    }
    if (行级.可加载更多) {
      尾.push(
        <button
          key={`more-${行级.键}`}
          className={`${样式.加载更多键} 可点`}
          style={缩进}
          onClick={() => 加载更多(行级.键)}
          disabled={行级.加载中}
        >
          {行级.加载中 ? '加载中…' : '加载更多'}
        </button>,
      );
    }
    return 尾.length > 0 ? <Fragment key={`tail-${行级.键}`}>{尾}</Fragment> : null;
  };

  return (
    <div className={样式.列表}>
      {根加载中 ? <div className={样式.尾注}>加载中…</div> : null}
      {根错误 !== null ? (
        <div className={样式.尾区}>
          <span className={样式.错误文}>{根错误}</span>
          <button className={`${样式.重试键} 可点`} onClick={() => 重试(null)}>
            重试
          </button>
        </div>
      ) : null}
      {根空 && !根加载中 && 根错误 === null ? <div className={样式.尾注}>暂无内容</div> : null}
      {行.map((行级, 下标) => {
        const 选中 = 已选集.has(行级.键);
        const 缩进 = 缩进样式(行级);
        const 是末行 = 下标 === 行.length - 1;
        const 下层 = 是末行 ? -1 : 行[下标 + 1]!.层级;
        // 本行的行尾排在其整块后代之后；同一位置可能有多个祖先块一起收尾
        //（父块与祖先块都延伸到本行）：从深到浅逐一收集，按本行→更浅祖先的顺序渲染
        const 收尾们: { 行级: 行业行; 下标: number }[] = [];
        if (下层 <= 行级.层级) 收尾们.push({ 行级, 下标 });
        {
          let 指针 = 下标;
          for (let 层 = 行级.层级 - 1; 层 >= 0; 层 -= 1) {
            while (指针 >= 0 && 行[指针]!.层级 > 层) 指针 -= 1;
            if (指针 < 0 || 行[指针]!.层级 !== 层) break;
            if (下层 <= 层) 收尾们.push({ 行级: 行[指针]!, 下标: 指针 });
          }
        }
        // 可选且有子项：分开选择区（名称点击=选择）与独立展开钮
        const 可选且有子项 = 行级.可选 && 行级.有子项 && !行级.达深度上限;
        return (
          <Fragment key={行级.键}>
            {可选且有子项 ? (
              <div className={样式.行} style={缩进}>
                <button
                  className={`${样式.行键} ${选中 ? 样式.行选中 : ''} ${多选已满 && !选中 ? 样式.行禁用 : '可点'}`}
                  disabled={多选已满 && !选中}
                  aria-pressed={选中}
                  onClick={() => 选择({ 键: 行级.键, 名称: 行级.名称, 可选: 行级.可选, 有子项: 行级.有子项 })}
                >
                  <span className={样式.行名}>{行级.名称}</span>
                  {选中 ? <span className={样式.勾}>✓</span> : null}
                </button>
                <button
                  className={`${样式.展开键} 可点`}
                  aria-expanded={行级.展开}
                  aria-label={`展开${行级.名称}`}
                  onClick={() => 切换展开(行级.键)}
                >
                  {行级.展开 ? '⌃' : '⌄'}
                </button>
              </div>
            ) : 行级.可选 ? (
              <button
                className={`${样式.行键} ${选中 ? 样式.行选中 : ''} ${多选已满 && !选中 ? 样式.行禁用 : '可点'}`}
                style={缩进}
                disabled={多选已满 && !选中}
                aria-pressed={选中}
                onClick={() => 选择({ 键: 行级.键, 名称: 行级.名称, 可选: 行级.可选, 有子项: 行级.有子项 })}
              >
                <span className={样式.行名}>{行级.名称}</span>
                {选中 ? <span className={样式.勾}>✓</span> : null}
              </button>
            ) : 行级.有子项 && !行级.达深度上限 ? (
              <button
                className={`${样式.行键} 可点`}
                style={缩进}
                aria-expanded={行级.展开}
                onClick={() => 切换展开(行级.键)}
              >
                <span className={样式.行名}>{行级.名称}</span>
                <span className={样式.箭头}>{行级.展开 ? '⌃' : '⌄'}</span>
              </button>
            ) : (
              // 不可选且无子项：死端行不可点（页面侧契约：不发目录请求、不提交）
              <div className={`${样式.行键} ${行级.达深度上限 ? 样式.行禁用 : ''}`} style={缩进}>
                <span className={样式.行名}>{行级.名称}</span>
                {行级.达深度上限 ? <span className={样式.尾注}>暂不支持继续展开</span> : null}
              </div>
            )}
            {收尾们.map(({ 行级: 尾行, 下标: 尾下标 }) => (
              <Fragment key={`尾-${尾行.键}`}>
                {行尾(尾行, 后代块长(尾下标) > 0)}
              </Fragment>
            ))}
          </Fragment>
        );
      })}
      {根可加载更多 ? (
        <button className={`${样式.加载更多键} 可点`} onClick={() => 加载更多(null)} disabled={根加载中}>
          {根加载中 ? '加载中…' : '加载更多'}
        </button>
      ) : null}
    </div>
  );
}
