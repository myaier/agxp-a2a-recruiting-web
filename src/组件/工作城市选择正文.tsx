// 工作城市选择正文 —— 选工作城市（候选引导 / 意向）与 岗位编辑表单 共用的全页选择正文。
// 纯展示：不读数据源模式 / Context / router / raw DTO；查询与业务派发由调用方适配。
// 组件内部拥有本次临时选择：挂载时从 初始已选 复制一次，之后不随父层 rerender / JD 重置。
//
// picker 统一 Task 2（契约见 plan Task 2「生产契约」）：
//   标题 + （上限>1 时的）N/上限 计数 → 搜索条 → 列表（调用方给的组）→ 底部已选 chips → 保存键。
// 失败显示 错误行 + 重试；搜索态成功 0 条显示 无结果；满上限只禁新增、可取消已选。
// Escape 走 返回（关闭/返回语义归调用方：岗位子视图关闭并恢复城市行焦点，全页则导航返回）。

import { useEffect, useRef, useState, type UIEvent } from 'react';
import 样式 from '../屏幕/选工作城市.module.css';
import { 返回栏, 主按钮 } from './通用';
import { 放大镜图标 } from './图标';
import { 轻提示 } from './轻提示';

/** 城市片的展示输入：键 = 目录稳定 ID（Mock 为本地城名），两业务给同样的键就有同样的选择行为。
 *  禁用 标记「点不出的缺失态」占位（如 Backend「暂未获取定位」），展示层只按它禁用 */
export type 城市项 = { 键: string; 名称: string; 副行?: string; 禁用?: boolean };

/** 一个分组标题 + 其下的城市网格（「当前定位 / 热门城市 / 行政区分组 / 搜索结果」都是组） */
export type 城市组 = { 键: string; 名称: string; 城市: 城市项[] };

/** 列表区状态：组 + 加载中/错误 + 翻页与重试入口（成功空页与失败由调用方分开表达） */
export type 城市列表状态 = {
  组: 城市组[];
  加载中: boolean;
  错误: string | null;
  可加载更多: boolean;
  加载更多: () => void;
  重试: () => void;
};

export type 工作城市选择属性 = {
  标题: string;
  /** 1 = 单选（不显示 N/上限 计数）；10 = 候选引导多选 */
  上限: 1 | 10;
  初始已选: 城市项[];
  搜索词: string;
  改搜索词: (词: string) => void;
  列表: 城市列表状态;
  返回: () => void;
  保存: (已选: 城市项[]) => void;
};

/** 距底多少像素算「滚到底」——沿用原 选工作城市 页的判定值 */
const 到底余量 = 64;

export default function 工作城市选择正文({ 标题, 上限, 初始已选, 搜索词, 改搜索词, 列表, 返回, 保存 }: 工作城市选择属性) {
  // 本次临时选择归组件内部：只在挂载时从 初始已选 复制，之后父层 rerender 不重置
  const [已选, 设已选] = useState<城市项[]>(() => 初始已选.map((条) => ({ ...条 })));

  // 最新返回回调经 ref 提供给 Escape（同 弹层框架 的做法，监听只挂一次）
  const 返回引用 = useRef(返回);
  返回引用.current = 返回;
  useEffect(() => {
    const 处理按键 = (事件: KeyboardEvent) => {
      if (事件.key === 'Escape') 返回引用.current();
    };
    window.addEventListener('keydown', 处理按键);
    return () => window.removeEventListener('keydown', 处理按键);
  }, []);

  const 切换 = (项: 城市项) => {
    if (项.禁用) return;
    设已选((旧) => {
      if (旧.some((条) => 条.键 === 项.键)) return 旧.filter((条) => 条.键 !== 项.键);
      if (上限 === 1) return [{ ...项 }];
      if (旧.length >= 上限) {
        轻提示(`最多选 ${上限} 个`);
        return 旧;
      }
      return [...旧, { ...项 }];
    });
  };

  const 搜索态 = 搜索词.trim() !== '';
  const 列表项数 = 列表.组.reduce((数, 组) => 数 + 组.城市.length, 0);

  // 继续加载只挂在既有滚动容器上 —— 翻页入口与加载中由调用方按各自查询给出
  const 滚动加载 = (事件: UIEvent<HTMLDivElement>) => {
    if (!列表.可加载更多 || 列表.加载中) return;
    const 元素 = 事件.currentTarget;
    if (元素.scrollTop + 元素.clientHeight < 元素.scrollHeight - 到底余量) return;
    列表.加载更多();
  };

  const 城市键 = (片: 城市项) => (
    <button
      key={片.键}
      className={`${样式.城片} ${已选.some((条) => 条.键 === 片.键) ? 样式.城片选中 : ''} 可点`}
      onClick={() => 切换(片)}
      disabled={片.禁用}
    >
      {/* 2026-08-24 全站选择风格统一（C1 定稿）：✓ 改由 CSS ::before 前置渲染，去掉文字尾缀避免双勾 */}
      {片.名称}
    </button>
  );

  return (
    <div className={样式.选择正文}>
      <返回栏 返回={返回} />

      {/* 大标题 + 右上 N/上限 计数。单选没有 N/上限 这回事，计数整枚不渲染 ——
          留着会把一个单选说成还能再选 */}
      <div className={样式.标题行}>
        <h1 className={样式.大标题}>{标题}</h1>
        {上限 > 1 ? (
          <span className={`${样式.计数} 等宽数字`}>
            {已选.length}/{上限}
          </span>
        ) : null}
      </div>

      <div className={样式.搜索条}>
        <放大镜图标 尺寸={15} 色="var(--最弱)" 线宽={2.2} />
        <input
          className={样式.搜索输入}
          placeholder="搜索城市 / 省份"
          value={搜索词}
          onChange={(事件) => 改搜索词(事件.target.value)}
        />
      </div>

      <div className={`${样式.列表区} 滚动区`} onScroll={滚动加载}>
        {列表.组.map((组, 序) => (
          <div key={组.键}>
            <div className={`${样式.组标} ${序 > 0 ? 样式.组标间距 : ''}`}>{组.名称}</div>
            <div className={样式.城网}>{组.城市.map((片) => 城市键(片))}</div>
          </div>
        ))}

        {/* 失败显示错误与重试；搜索态成功 0 条才显示无结果 —— 两者不互装 */}
        {列表.错误 !== null ? (
          <div className={样式.错误行}>
            {列表.错误}
            <button className={`${样式.重试键} 可点`} onClick={列表.重试}>
              重试
            </button>
          </div>
        ) : 搜索态 && 列表项数 === 0 && !列表.加载中 ? (
          <div className={样式.无结果}>没有匹配的城市，换个词试试。</div>
        ) : null}
      </div>

      {/* 底部已选 chips：点标签 ✕ 取消（按 键 取消，同名不同键互不误删）*/}
      {已选.length > 0 ? (
        <div className={样式.已选条}>
          <span className={样式.已选标}>已选</span>
          <div className={样式.已选标签组}>
            {已选.map((条) => (
              <button key={条.键} className={`${样式.已选标签} 可点`} onClick={() => 切换(条)}>
                {条.名称} ✕
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <主按钮 文字="保存" 按下={() => 保存(已选)} 禁用={已选.length === 0} />
    </div>
  );
}