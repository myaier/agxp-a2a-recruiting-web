// 备选城市选择正文（Task 3）：其他感兴趣城市多选（0/9）的两模式共用正文。
//
// 版式照原 选择城市 页（规格截图 3）自上而下：
//   ✕ 关闭 → 大标题「选择城市」+ 右上 N/9 → 副标题 → 搜索框 →
//   当前/历史访问城市 → 热门城市 → 行政区分组（或搜索结果）→ 底部已选 chips + 保存。
// 样式直接沿用原页面 CSS（选择城市.module.css），不重排其他区域。
// 已批准的视觉差异只有一处：A–Z 分节与右侧字母索引条整体移除，分组标题改由页面
// 用目录 admin1_name→country_name 提供，本组件只负责渲染。
//
// 本组件是纯展示正文：只收展示值、稳定键、状态与回调，不依赖数据源模式、BFF DTO、
// Context、API、路由或存储。真实目录引用、ID 映射、分页游标与保存归属都在页面外层
// （src/屏幕/选择城市.tsx）；「加载中 / 还有 / 加载更多」指当前可见列表（默认页或搜索）。

import 样式 from '../屏幕/选择城市.module.css';
import { 主按钮 } from './通用';
import { 放大镜图标 } from './图标';

/** 城市多选上限（规格：其他感兴趣城市（N/9）） */
const 城市上限 = 9;

/** 一枚城市按钮的展示值：页面把两模式的城市项映射成这个形状 */
export type 城市按钮值 = { 键: string; 名称: string; 选中: boolean; 禁用: boolean };

/** 正文 props（页面局部契约，不是公共领域模型） */
export type 备选城市正文Props = {
  搜索词: string;
  改搜索词: (词: string) => void;
  位置项们: 城市按钮值[];
  热门项们: 城市按钮值[];
  分组们: { 键: string; 标题: string; 项们: 城市按钮值[] }[];
  搜索项们: 城市按钮值[];
  已选项们: 城市按钮值[];
  加载中: boolean;
  还有: boolean;
  加载更多: () => void;
  切换: (键: string) => void;
  取消: () => void;
  保存: () => void;
};

export function 备选城市选择正文({
  搜索词,
  改搜索词,
  位置项们,
  热门项们,
  分组们,
  搜索项们,
  已选项们,
  加载中,
  还有,
  加载更多,
  切换,
  取消,
  保存,
}: 备选城市正文Props): React.JSX.Element {
  const 在搜索 = 搜索词.trim() !== '';

  /** 一枚城市片。三态：未选 / 选中（1.5px 亮绿描边 + 前置 ✓）/ 禁用（变灰不可点）*/
  const 城市键 = (片: 城市按钮值) => (
    <button
      key={片.键}
      className={[样式.城片, 片.选中 ? 样式.城片选中 : '', 片.禁用 ? 样式.城片变灰 : '可点'].join(' ')}
      onClick={() => 切换(片.键)}
      disabled={片.禁用}
    >
      {/* 2026-08-24 全站选择风格统一（C1 定稿）：✓ 改由 CSS ::before 前置渲染，去掉文字尾缀避免双勾 */}
      {片.名称}
    </button>
  );

  /** 列表尾分页按钮（沿用原搜索分支的现有控件），挂在当前可见列表尾部 */
  const 分页键 = 还有 ? (
    <button
      className="可点"
      onClick={加载更多}
      disabled={加载中}
      style={{ width: '100%', padding: '10px', color: 'var(--最弱)' }}
    >
      {加载中 ? '加载中…' : '加载更多'}
    </button>
  ) : null;

  return (
    <>
      {/* 顶栏：规格要求左侧是 ✕（关闭）而不是 ‹（返回）。
          通用的 返回栏 把 ‹ 写死了，所以这里按它同一套内边距单独渲染一枚 ✕。 */}
      <div className={样式.顶栏}>
        <button className={`${样式.关闭键} 可点`} onClick={取消} aria-label="关闭">
          ✕
        </button>
      </div>

      {/* 大标题 + 右上 N/9（版式同 选工作城市 的标题行）*/}
      <div className={样式.标题行}>
        <h1 className={样式.大标题}>选择城市</h1>
        <span className={`${样式.计数} 等宽数字`}>
          {已选项们.length}/{城市上限}
        </span>
      </div>
      <p className={样式.副标题}>添加多个城市，可以获得更多工作机会</p>

      <div className={样式.搜索条}>
        <放大镜图标 尺寸={15} 色="var(--最弱)" 线宽={2.2} />
        <input
          className={样式.搜索输入}
          placeholder="搜索城市名/拼音"
          value={搜索词}
          onChange={(事件) => 改搜索词(事件.target.value)}
        />
      </div>

      <div className={样式.列表包裹}>
        <div className={`${样式.列表区} 滚动区`}>
          {在搜索 ? (
            /* 搜索态：只出命中结果，分区收起，免得两套列表打架 */
            <>
              <div className={样式.城网}>{搜索项们.map(城市键)}</div>
              {分页键}
              {搜索项们.length === 0 ? (
                <div className={样式.无结果}>
                  {加载中 ? '加载中…' : '没有匹配的城市，换个词试试。'}
                </div>
              ) : null}
            </>
          ) : (
            /* 默认态：位置 → 热门 → 行政区分组，分组标题（省/国家）由页面给 */
            <>
              <div className={样式.组标}>当前/历史访问城市</div>
              <div className={样式.城行}>{位置项们.map(城市键)}</div>

              <div className={`${样式.组标} ${样式.组标间距}`}>热门城市</div>
              <div className={样式.城网}>{热门项们.map(城市键)}</div>

              {分组们.map((组) => (
                <div key={组.键}>
                  <div className={`${样式.组标} ${样式.组标间距}`}>{组.标题}</div>
                  <div className={样式.城网}>{组.项们.map(城市键)}</div>
                </div>
              ))}

              {/* 首页还没到（热门/分组都空）时沿用现有加载文案 */}
              {加载中 && 热门项们.length === 0 && 分组们.length === 0 ? (
                <div className={样式.无结果}>加载中…</div>
              ) : null}
              {分页键}
            </>
          )}
        </div>
      </div>

      {/* 底部已选 chips：点标签上的 ✕ 移除 */}
      {已选项们.length > 0 ? (
        <div className={样式.已选条}>
          <span className={样式.已选标}>已选</span>
          <div className={样式.已选标签组}>
            {已选项们.map((条) => (
              <button
                key={条.键}
                className={`${样式.已选标签} 可点`}
                onClick={() => 切换(条.键)}
                aria-label={`移除 ${条.名称}`}
              >
                {条.名称} ✕
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <主按钮 文字="保存" 按下={保存} />
    </>
  );
}
