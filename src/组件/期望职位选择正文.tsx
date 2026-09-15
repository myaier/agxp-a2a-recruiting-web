// 期望职位选择正文（Task 7 / B 契约）：选期望职位页（/onboard/job 与 ?来源=意向）
// 两模式共用的纯展示正文。版式照原 Mock 页自上而下：
//   次级页外壳(白底) → 返回栏 ‹ → 大标题「期望职位是」→ 搜索条 →
//   （无词）左一级栏 + 右分组多选卡 /（有词）搜索结果区 → 底部已选 chips + 保存键。
// 直接复用 ../屏幕/选期望职位.module.css 原类，不改 CSS。
//
// 本组件只收展示值、稳定键、尾态与回调（B 契约冻结的 props），不读数据源模式、
// Context、BFF DTO、API 或路由；不持目录请求、游标、已选业务引用和全局草稿 ——
// 真实引用、上限（onboarding 10 / 意向 1）与保存跳转都在页面外层。
// 同一展示输入渲染同一结构（两模式同 DOM）；异步尾态回调由页面局部钩子提供。
//
// 渲染细则：
//   · 分组标题用语义 heading（不渲染 button、不可点击）；空标题组（仅搜索直接命中
//     的叶子平铺）不渲染标题节点；h3 的默认外距按原 .分组标 div 视觉内联归零；
//   · 搜索态整块替换双栏（沿用原页行为）：空标题组的项平铺在搜索结果区，
//     有标题的命中组沿用「分组标 + 双列网格」；
//   · 禁用项保留展示并标 aria-disabled，点击不触发 切换选择（父节点不伪装成职位按钮）。

import { Fragment } from 'react';
import 样式 from '../屏幕/选期望职位.module.css';
import { 次级页外壳, 返回栏, 主按钮 } from './通用';
import { 放大镜图标 } from './图标';

/** 一栏（根/二级组）的异步尾态：加载中 / 错误重试 / 还有下一页 */
export type 目录尾态 = { 加载中: boolean; 错误: string | null; 还有: boolean; 加载更多: () => void; 重试: () => void };

/** 一枚职位项的展示值：键 = Backend 目录 ID（Mock = 本地名称），名称为展示文案 */
export type 期望职位项 = { 键: string; 名称: string; 选中: boolean; 禁用: boolean };

/** 右栏一个分组：标题（二级节点名；空串 = 搜索直接命中平铺组）+ 组内职位 + 该组自己的尾态 */
export type 期望职位组 = { 键: string; 标题: string; 项们: 期望职位项[]; 尾态: 目录尾态 };

/** 正文 props（页面局部契约，不是公共领域模型） */
export type 期望职位选择正文Props = {
  搜索词: string;
  改搜索词: (词: string) => void;
  根项们: { 键: string; 名称: string; 选中: boolean }[];
  切换根: (键: string) => void;
  根尾态: 目录尾态;
  组们: 期望职位组[];
  右尾态: 目录尾态;
  已选: { 键: string; 名称: string }[];
  切换选择: (键: string) => void;
  移除: (键: string) => void;
  保存: () => void;
  可保存: boolean;
  返回: () => void;
};

/** 尾态反馈块：错误 → 文案 + 重试；无项且加载中 → 加载中；还有 → 加载更多（忙时禁用）。
 *  浏览/搜索各栏与各组共用同一形态，正文不持游标。 */
function 尾态反馈(尾态: 目录尾态, 有项: boolean): React.JSX.Element | null {
  if (尾态.错误 !== null) {
    return (
      <div className={样式.无结果}>
        {尾态.错误}
        <button className="可点" style={{ marginLeft: 8, color: 'var(--次要)', textDecoration: 'underline' }} onClick={尾态.重试}>
          重试
        </button>
      </div>
    );
  }
  if (!有项 && 尾态.加载中) return <div className={样式.无结果}>加载中…</div>;
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

export function 期望职位选择正文({
  搜索词,
  改搜索词,
  根项们,
  切换根,
  根尾态,
  组们,
  右尾态,
  已选,
  切换选择,
  移除,
  保存,
  可保存,
  返回,
}: 期望职位选择正文Props): React.JSX.Element {
  const 词 = 搜索词.trim();

  /** 一枚职位多选卡（两模式同一形态；点击只切换本页临时选择，不保存不关闭） */
  const 职位卡 = (项: 期望职位项) => (
    <button
      key={项.键}
      className={`${样式.职小类} ${项.选中 ? 样式.职小类选中 : ''} 可点`}
      onClick={项.禁用 ? undefined : () => 切换选择(项.键)}
      aria-disabled={项.禁用 ? true : undefined}
    >
      {/* 2026-08-24 全站选择风格统一（C1 定稿）：✓ 改由 CSS ::before 前置渲染，去掉文字尾缀避免双勾 */}
      {项.名称}
    </button>
  );

  /** 一个分组的标题：语义 heading；空标题组（搜索直接命中平铺）不渲染标题节点。
   *  h3 的浏览器默认外距按原 div 视觉归零（.分组标 只定义 margin-bottom，原 CSS 不改）。 */
  const 组标题 = (组: 期望职位组) =>
    组.标题 === '' ? null : (
      <h3 className={样式.分组标} style={{ margin: '0 0 10px' }}>
        {组.标题}
      </h3>
    );

  /** 一个完整分组块（标题 + 职位双列网格 + 该组自己的尾态） */
  const 分组块 = (组: 期望职位组) => (
    <div key={组.键} className={样式.分组块}>
      {组标题(组)}
      <div className={样式.岗位网}>{组.项们.map(职位卡)}</div>
      {组.项们.length === 0 && !组.尾态.加载中 && 组.尾态.错误 === null && !组.尾态.还有 ? (
        <div className={样式.无结果}>该分组暂无职位</div>
      ) : null}
      {尾态反馈(组.尾态, 组.项们.length > 0)}
    </div>
  );

  // 搜索态的整区空/忙判定（决定「没有匹配的职位」文案，加载中与失败不显示）
  const 搜索总项数 = 组们.reduce((数, 组) => 数 + 组.项们.length, 0);
  const 搜索在加载 = 组们.some((组) => 组.尾态.加载中);
  const 搜索有错误 = 组们.some((组) => 组.尾态.错误 !== null);
  const 搜索还有 = 组们.some((组) => 组.尾态.还有);

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底改白底
    <次级页外壳 白底>
      <返回栏 返回={返回} />

      {/* 大标题。N/10 计数与选择上限（onboarding 10 / 意向 1）都归页面把守，
          B 契约的展示输入里没有计数槽，正文不渲染计数 */}
      <div className={样式.标题行}>
        <h1 className={样式.大标题}>期望职位是</h1>
      </div>

      <div className={样式.搜索条}>
        <放大镜图标 尺寸={15} 色="var(--最弱)" 线宽={2.2} />
        <input
          className={样式.搜索输入}
          placeholder="搜索职位"
          value={搜索词}
          onChange={(事件) => 改搜索词(事件.target.value)}
        />
      </div>

      {词 === '' ? (
        /* 左一级栏 + 右分组多选卡（沿用 发布岗位 / 旧职位弹层的双栏形态）*/
        <div className={样式.职双栏}>
          <div className={`${样式.职左栏} 滚动区`}>
            {根项们.map((项) => (
              <button
                key={项.键}
                className={`${样式.职大类} ${项.选中 ? 样式.职大类当前 : ''} 可点`}
                onClick={() => 切换根(项.键)}
              >
                {项.名称}
              </button>
            ))}
            {尾态反馈(根尾态, 根项们.length > 0)}
          </div>
          <div className={`${样式.职右栏} 滚动区`}>
            {组们.map(分组块)}
            {尾态反馈(右尾态, 组们.length > 0)}
          </div>
        </div>
      ) : (
        /* 搜索结果区：空标题组（直接命中）平铺，命中父节点组沿用分组块 */
        <div className={`${样式.搜索结果区} 滚动区`}>
          {组们.map((组) =>
            组.标题 === '' ? (
              <Fragment key={组.键}>
                {组.项们.map(职位卡)}
                {尾态反馈(组.尾态, 组.项们.length > 0)}
              </Fragment>
            ) : (
              <div key={组.键} className={样式.分组块}>
                {组标题(组)}
                <div className={样式.岗位网}>{组.项们.map(职位卡)}</div>
                {尾态反馈(组.尾态, 组.项们.length > 0)}
              </div>
            ),
          )}
          {搜索总项数 === 0 && !搜索在加载 && !搜索有错误 && !搜索还有 ? (
            <div className={样式.无结果}>没有匹配的职位，换个词试试。</div>
          ) : null}
        </div>
      )}

      {/* 底部已选 chips：点标签 ✕ 删除（Backend 按 ID，同名两条互不误删）*/}
      {已选.length > 0 ? (
        <div className={样式.已选条}>
          <span className={样式.已选标}>已选</span>
          <div className={样式.已选标签组}>
            {已选.map((条) => (
              <button key={条.键} className={`${样式.已选标签} 可点`} onClick={() => 移除(条.键)}>
                {条.名称} ✕
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <主按钮 文字="保存" 按下={保存} 禁用={!可保存} />
    </次级页外壳>
  );
}
