// 在谈阶段区：两类在谈卡共用的卡底阶段区（Spec §5.4）。
// 一行 = 阶段标签 → 可选归属徽标 → 下一步/状态文本 → 详情箭头；注意说明单独在这一行下方。
// 标题/色系/待办/徽标/文本/注意说明 全是显式展示参数（Plan 公共展示契约）：组件不判断
// mock/backend，也不根据文本猜状态 —— 标题原样带出（Backend 保留 P5 阶段标题原文），
// 色系只查 阶段配色 的四语义闭表；通用 阶段标签 的默认实现不动（它的文字就是枚举值，
// 带不了 P5 原文，所以这里自己渲染同一形制的胶囊）。
// 不 import Context/fixture/HTTP/路由/持久化，不派发、不请求。
import { 阶段配色 } from '../通用';
import 样式 from './在谈阶段区.module.css';
import type { 在谈阶段信息 } from './类型';

/** 归属徽标两档底色（原 P5 徽标的 tone，随文案走闭表，不做文案推断之外的判断） */
const 徽标档: Record<NonNullable<在谈阶段信息['徽标']>, string> = {
  需要你: 样式.徽标待办,
  需注意: 样式.徽标待办,
  代理处理中: 样式.徽标代理,
};

export default function 在谈阶段区({ 信息 }: { 信息: 在谈阶段信息 }) {
  const 配 = 阶段配色[信息.色系];
  return (
    <div className={样式.阶段区} data-card-region="stage">
      <div className={样式.阶段头}>
        {/* 阶段标签：形制与 通用.module.css 的 .阶段标签 同源（composes），描边/文字色按
            色系内联；呼吸点只在 待办（Mock 需要你）时出现，Backend 恒 false（只有徽标） */}
        <span
          className={样式.阶段标}
          style={{
            color: 配.文字,
            borderColor: `color-mix(in srgb, ${配.文字} 40%, #fff)`,
          }}
        >
          <span
            className={`${样式.阶段点} ${信息.待办 ? 样式.阶段点呼吸 : ''}`}
            style={{ background: 配.文字 }}
          />
          {信息.标题}
        </span>

        {信息.徽标 !== null ? <span className={`${样式.徽标} ${徽标档[信息.徽标]}`}>{信息.徽标}</span> : null}

        <div className={`${样式.文本} 单行`}>{信息.文本}</div>
        <span className={样式.尖括号} aria-hidden="true">›</span>
      </div>

      {/* attention 的 owner-safe 安全说明：纯文本，零操作，单独放在阶段行下方 */}
      {信息.注意说明 !== null ? <div className={样式.注意说明}>{信息.注意说明}</div> : null}
    </div>
  );
}
