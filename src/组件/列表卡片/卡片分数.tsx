// 卡片分数：列表卡右列的 40px 分数位（Spec §4.3）。
// 已知分复用 适配环 的原 40px 展示（颜色语义全站一致）；未知分走中性占位 ——
// 相同 40×40 容器、容器内给「—」与短文案「分数未知」、可访问名「匹配分未知」，
// 不画进度弧、不传 0/NaN、不用表示低分或成功的颜色。真实 0 分仍是 0 分。
import 适配环 from '../适配环';
import 样式 from './卡片分数.module.css';

export default function 卡片分数({ 分 }: { 分: number | null }) {
  if (分 === null) {
    return (
      <span className={样式.未知} role="img" aria-label="匹配分未知">
        <span className={样式.未知杠} aria-hidden>—</span>
        <span className={样式.未知文} aria-hidden>分数未知</span>
      </span>
    );
  }
  return <适配环 分={分} 标={null} />;
}
