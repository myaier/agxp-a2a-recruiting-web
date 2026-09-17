// 招聘匹配依据（Task 5 / Spec §5、契约 C）：唯一「匹配度分析」区内的六行只读展示。
// 纯展示：行们 由 数据/招聘匹配依据映射 从 wire 三键算好传入，组件不读应用状态、
// 不请求、不算分、不猜词义。状态只驱动记号：positive 用勾（复用正文一致条的绿勾
// 视觉基因），some_skills/partial/unknown/not_provided 一律无勾 —— 不画缺项不匹配叉，
// 不展示逐项分值/满分。行尾恒附统一说明「当前接口仅提供部分匹配依据」。
// 样式复用 匿名在线简历.module.css 既有类（与 在线简历正文 同一出处，不建第二份样式）。

import 样式 from '../屏幕/匿名在线简历.module.css';
import type { 匹配依据行 } from '../数据/招聘匹配依据映射';

/** 六维展示名（Spec §5 顺序）：方向、技能、经验、地点、办公方式、薪资 */
const 维度文案: Record<匹配依据行['维度'], string> = {
  category: '方向',
  skills: '技能',
  experience: '经验',
  location: '地点',
  workplace_mode: '办公方式',
  compensation: '薪资',
};

export function 招聘匹配依据({ 行们 }: { 行们: readonly 匹配依据行[] }) {
  return (
    <div>
      {行们.map((行) => (
        <div key={行.维度} className={行.状态 === 'positive' ? 样式.一致条 : 样式.期望副行}>
          {行.状态 === 'positive' ? (
            <span className={样式.一致符} aria-hidden>✓</span>
          ) : null}
          <span>{`${维度文案[行.维度]} · ${行.说明}`}</span>
        </div>
      ))}
      {/* 统一说明：缺判定是接口边界，不是候选缺陷 —— 不随行重复，只出一次 */}
      <div className={样式.期望副行}>当前接口仅提供部分匹配依据</div>
    </div>
  );
}
