// 消息列表展示（P1 Task 4）—— Mock 双端与 Backend P7 收件箱共用的唯一列表 JSX。
//
// 结构原样搬自 消息列表.tsx：大标题「消息」+ 右侧放大镜（点击把焦点送进搜索框，
// ref 与聚焦留在展示）→ 三个筛选页签（全部 / 仅会话 / 通知，选中态字重 700 + 墨色）
// → 搜索条（真输入框，输入即时过滤）→ 状态提示区 + 会话行列表 → 按能力显示加载更多。
//
// 页签/搜索 useState、过滤顺序、S3 门控、数据域、未读快照与导航回调全部留在连接层；
// 本组件只按受控属性渲染。两条产品口径（设计稿）：
//   · 「通知」= AI代理动态，「仅会话」= 真人 / 直聊，两者互补不重叠
//   · 会话行不放任何操作按钮，点整行进对应会话页
// 提示数组允许错误与缓存行共存；空态文案逐字沿用原实现。

import { Fragment, useRef } from 'react';
import type { ReactElement } from 'react';
import 样式 from '../消息列表.module.css';
import { 主页外壳, 滚动区 } from '../../组件/通用';
import { 放大镜图标 } from '../../组件/图标';
import 代理标 from '../../组件/代理标';
import type { 列表提示, 会话行数据, 消息列表展示属性, 消息页签 } from './类型';

/** 三个筛选页签。顺序即设计稿顺序，别改 */
const 页签列表 = ['全部', '仅会话', '通知'] as const satisfies readonly 消息页签[];

export function 消息列表展示({
  页签,
  改页签,
  搜索词,
  改搜索词,
  搜索提示,
  前置提示,
  行们,
  后置提示,
  加载更多,
}: 消息列表展示属性): ReactElement {
  // 点右上角放大镜时把焦点送进搜索框（设计稿里放大镜就是搜索入口）
  const 搜索框引用 = useRef<HTMLInputElement>(null);
  return (
    <主页外壳>
      {/* 标题行：大标题 + 右侧放大镜 */}
      <div className={样式.标题行}>
        <div className={样式.大标题}>消息</div>
        <button
          className={`${样式.放大镜键} 可点`}
          onClick={() => 搜索框引用.current?.focus()}
          aria-label="搜索"
        >
          <放大镜图标 />
        </button>
      </div>

      {/* 筛选页签行：选中态字重 700 + 墨色，未选 600 + 次级标题色 */}
      <div className={样式.页签行}>
        {页签列表.map((签) => (
          <button
            key={签}
            className={`${签 === 页签 ? 样式.页签选中 : 样式.页签未选} 可点`}
            onClick={() => 改页签(签)}
          >
            {签}
          </button>
        ))}
      </div>

      <滚动区 样式覆盖={{ paddingTop: 2, paddingBottom: 130 }}>
        {/* 搜索条：设计稿是假条，这里做成真输入框，输入即时过滤列表 */}
        <div className={样式.搜索条}>
          <放大镜图标 尺寸={15} 色="var(--灰白)" 线宽={2} />
          <input
            ref={搜索框引用}
            className={样式.搜索输入}
            placeholder={搜索提示}
            value={搜索词}
            onChange={(事件) => 改搜索词(事件.target.value)}
          />
        </div>

        {前置提示.map((提示) => (
          <列表提示行 key={提示.键} 提示={提示} />
        ))}
        {行们.map((数据) => (
          <会话行 key={数据.键} 数据={数据} />
        ))}
        {后置提示.map((提示) => (
          <列表提示行 key={提示.键} 提示={提示} />
        ))}
        {加载更多 ? (
          <button className="可点" onClick={加载更多}>加载更多</button>
        ) : null}
      </滚动区>
    </主页外壳>
  );
}

/** 状态提示（错误/加载/空态/搜索无命中）：行数不定，行与行、行与操作之间用分隔线（原错误块
 *  `{错误文案}<br/><button>重试</button>` 的按钮独占一行结构保留） */
function 列表提示行({ 提示 }: { 提示: 列表提示 }): ReactElement {
  return (
    <div className={样式.空态}>
      {提示.行们.map((行, 序号) => (
        // 同一段提示文案不会跨 key 重复；带上序号防御重复行
        <Fragment key={`${序号}:${行}`}>
          {序号 > 0 ? <br /> : null}
          {行}
        </Fragment>
      ))}
      {提示.操作 ? (
        <>
          <br />
          <button className="可点" onClick={提示.操作.按下}>{提示.操作.文案}</button>
        </>
      ) : null}
    </div>
  );
}

/**
 * 单条会话行：左头像 + 中间两行文字 + 右侧未读数红胶囊 / 红点。
 * 头像只有两种形态：代理标（AI代理动态）与字标（真人/直聊首字、Backend 中性「会」），
 * 都落在原 46px 容器上；行上不放任何业务按钮，整行按下由数据带回调负责导航。
 */
export function 会话行({ 数据 }: { 数据: 会话行数据 }): ReactElement {
  return (
    <button className={`${样式.会话行} 可点`} onClick={数据.按下}>
      {数据.头像.种类 === '代理' ? (
        // AI代理动态：绿圆底 + 描边代理标（标注 10:18：和真人头像一样有外圈，外圈填绿）
        <span className={样式.代理头像}>
          <代理标 尺寸={27} 脸色="#ffffff" 眼色="var(--墨)" 描边色="var(--墨)" 描边宽={2.6} />
        </span>
      ) : (
        // 真人 / 直聊 / Backend 中性占位：底色圆头像 + 首字
        <span className={样式.头像} style={{ background: 数据.头像.底色 }}>
          {数据.头像.字}
        </span>
      )}

      <span className={样式.正文区}>
        <span className={样式.会话头行}>
          <span className={样式.会话标题}>{数据.标题}</span>
          <span className={`${样式.会话副标题} 单行`}>{数据.副标题}</span>
          <span className={`${样式.会话时间} 等宽数字`}>{数据.时间}</span>
        </span>

        <span className={样式.会话摘要行}>
          <span className={`${样式.会话摘要} 单行`}>{数据.摘要}</span>
          {数据.未读.种类 === '数字' ? (
            <span className={`${样式.未读徽标} 等宽数字`} data-testid={数据.未读测试标识}>
              {数据.未读.数量}
            </span>
          ) : 数据.未读.种类 === '红点' ? (
            <span className={样式.红点} />
          ) : null}
        </span>
      </span>
    </button>
  );
}