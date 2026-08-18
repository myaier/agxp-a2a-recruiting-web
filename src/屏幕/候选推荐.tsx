// D11 人才Tab·推荐 + D11·D 搜人才 —— 企业端与求职端同构：本屏镜像求职端「看市场」（A14）。
//
// 与「在谈」共用顶栏（在招岗位左右平铺切换 + 在谈/推荐子视图），两屏切换时顶部不动、
// 只有列表在换 —— 与求职端 A6/A14 的同构硬要求一致；顶栏版式镜像求职端「顶部意向栏」。
//
// 卡片结构（镜像市场卡）：双盲头像 + 代号 + 画像 + 右侧匹配分 → 亮点标签行
//          → 代理评语（小结托盘风格）→ 分隔线 → 底行「让AI代理去聊」荧光绿键。
// 双盲语义：意向确认前只见代号与画像，头像用 头像字 + 灰绿底，绝不出现真名；不谈薪。

import { useMemo, useRef, useState } from 'react';
import 样式 from './候选推荐.module.css';
import { 主页外壳, 公司字标, 小结托盘, 白卡, 滚动区 } from '../组件/通用';
import { 放大镜图标, 盾牌图标, 谈判图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 推荐列表 } from '../数据/企业端模拟数据';
import type { 推荐候选 } from '../数据/类型';

/** 与 企业在谈候选 同款截短：顶栏只取「 · 」前的主名，两屏切换顶栏不跳变 */
function 岗位名截短(名称: string): string {
  return 名称.split(' · ')[0];
}

export default function 候选推荐() {
  const { 状态, 派发 } = use应用状态();
  const [搜索词, 设搜索词] = useState('');
  // 顶栏放大镜把焦点送进搜索条 —— D11·D「搜人才」的入口就是它
  const 搜索框引用 = useRef<HTMLInputElement>(null);

  // 搜索真过滤：按 画像 / 亮点 做包含匹配（同消息列表的搜索实现思路）
  const 过滤后 = useMemo(() => {
    const 关键词 = 搜索词.trim();
    if (!关键词) return 推荐列表;
    return 推荐列表.filter((人) => `${人.画像} ${人.亮点.join(' ')}`.includes(关键词));
  }, [搜索词]);

  return (
    <主页外壳>
      <企业顶栏 聚焦搜索={() => 搜索框引用.current?.focus()} />

      {/* 搜索条（D11·D 搜人才）：占据看市场里代理横幅的位置，固定不随列表滚动 */}
      <div className={样式.搜索条}>
        <放大镜图标 尺寸={15} 色="var(--灰白)" 线宽={2} />
        <input
          ref={搜索框引用}
          className={样式.搜索输入}
          placeholder="搜人才：画像 / 亮点关键词"
          value={搜索词}
          onChange={(事件) => 设搜索词(事件.target.value)}
        />
      </div>

      {/* 搜索条与列表之间的固定留白（镜像看市场横幅下方的占位） */}
      <div style={{ height: 10, flex: 'none' }} />

      <滚动区>
        {过滤后.length === 0 ? (
          <div className={样式.空态}>
            没有匹配的推荐候选。
            <br />
            换个关键词，或清空搜索看全部推荐。
          </div>
        ) : (
          <div className={样式.列表}>
            {过滤后.map((人) => (
              <推荐卡
                key={人.编号}
                人={人}
                已接触={状态.已接触推荐.includes(人.编号)}
                接触={() => 派发({ 型: '接触推荐候选', 编号: 人.编号 })}
                按下={() => 跳转(路径.候选详情(单.编号))}
              />
            ))}
          </div>
        )}
      </滚动区>
    </主页外壳>
  );
}

/** 企业顶栏：在招岗位切换（左右平铺）+ ＋发岗 + 放大镜 → 在谈/推荐子视图。
 *  与「企业在谈候选」同款（版式镜像求职端 顶部意向栏），两屏切换时顶部不动。 */
function 企业顶栏({ 聚焦搜索 }: { 聚焦搜索: () => void }) {
  const { 状态, 派发 } = use应用状态();
  const { 跳转 } = use导航();

  // 顶栏只平铺在招中的岗位；已归档的收在 D17 岗位管理里
  const 在招们 = 状态.岗位列表.filter((岗) => 岗.状态 === '在招');

  return (
    <div className={样式.顶栏}>
      <div className={样式.岗位行}>
        {在招们.map((岗) => {
          const 选中 = 岗.编号 === 状态.当前岗位编号;
          return (
            <button
              key={岗.编号}
              className={`${选中 ? 样式.岗位选中 : 样式.岗位未选} 单行 可点`}
              onClick={() => 派发({ 型: '切当前岗位', 编号: 岗.编号 })}
            >
              {岗位名截短(岗.名称)}
            </button>
          );
        })}
        <span className={样式.岗位行右}>
          <button
            className={`${样式.加号} 可点`}
            onClick={() => 跳转(路径.发布岗位)}
            aria-label="发布新岗位"
          >
            ＋
          </button>
          <button
            className="可点"
            onClick={聚焦搜索}
            aria-label="搜人才"
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <放大镜图标 />
          </button>
        </span>
      </div>

      <div className={样式.子视图行}>
        {(['在谈', '推荐'] as const).map((视图) => (
          <button
            key={视图}
            className={`${状态.企业子视图 === 视图 ? 样式.子视图选中 : 样式.子视图未选} 可点`}
            onClick={() => 派发({ 型: '企业切子视图', 子视图: 视图 })}
          >
            {视图}
          </button>
        ))}
        <button className={`${样式.筛选} 可点`} onClick={() => 轻提示('筛选功能待接后端条件项')}>
          筛选 ▾
        </button>
      </div>
    </div>
  );
}

/** 单张推荐候选卡。
 *  同市场卡：卡内还有自己的按钮（› 和 去聊键），HTML 里 button 不能嵌套 button，
 *  所以外层用不可点的白卡，卡主体单独做一个按钮。 */
function 推荐卡({
  人,
  已接触,
  接触,
  按下,
}: {
  人: 推荐候选;
  已接触: boolean;
  接触: () => void;
  按下: () => void;
}) {
  return (
    <白卡 类名={样式.卡}>
      {/* 卡主体整块可点 → 推荐候选详情（D11·A 在线简历批注版的推荐形态）*/}
      <button className={`${样式.卡主体} 可点`} onClick={按下}>
        <div className={样式.头行}>
          {/* 双盲：头像只用 头像字 + 灰绿底（初筛灰绿），不用真人姓氏 */}
          <公司字标
            首字={人.头像字}
            底色="var(--初筛底)"
            字色="var(--初筛)"
            描边={false}
            字号={13}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={`${样式.代号} 单行`}>{人.代号}</div>
            <div className={`${样式.画像} 单行`}>{人.画像}</div>
          </div>
          <div className={样式.右侧列}>
            <div className={`${样式.匹配分} 等宽数字`}>{人.匹配分}</div>
            <div className={样式.匹配标}>匹配分</div>
          </div>
        </div>

        <div className={样式.标签行}>
          {人.亮点.map((亮点) => (
            <span key={亮点} className={样式.标签}>
              {亮点}
            </span>
          ))}
        </div>

        {/* 代理评语：小结托盘风格，同详情页的代理小结 */}
        <小结托盘 标签="代 理 评 语">
          <div className={样式.评语}>{人.评语}</div>
        </小结托盘>
      </button>

      {/* 底行：AI代理来源标 + 「让AI代理去聊」（镜像市场卡的发布人行 + 去谈键） */}
      <div className={样式.底行}>
        <span className={样式.代理小圆}>
          <盾牌图标 尺寸={11} />
        </span>
        <span className={`${样式.来源} 单行`}>你的AI代理从人才库筛出</span>

        <button className={`${样式.尖括号} 可点`} onClick={按下} aria-label="查看候选画像">
          ›
        </button>

        {已接触 ? (
          // 已接触态：换成不可点的状态标（代理已接手，不需要再点第二次）
          <span className={样式.已接触}>
            <span className={样式.已接触文字}>AI代理已接触</span>
          </span>
        ) : (
          <button className={`${样式.去聊键} 可点`} onClick={接触}>
            <谈判图标 />
            <span className={样式.去聊文字}>让AI代理去聊</span>
          </button>
        )}
      </div>
    </白卡>
  );
}
