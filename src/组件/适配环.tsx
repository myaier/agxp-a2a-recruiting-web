// 适配分环形进度（视觉规范 v2，2026-08-18；配色 2026-08-23 改版）。
//
// 参考 Jobright 的 match ring 的形，但颜色带语义，不是装饰性的一律绿：
//   ≥80 翠绿（放心推进）/ 65–79 协调橙（要掂量）/ 更低 灰（弱匹配）。
// 首页在谈卡、看市场卡、企业端候选卡共用这一个组件，分数语义全站一致。
//
// 阈值 2026-08-23 从 ≥90 降到 ≥80（产品负责人定）。已知连带影响：全仓 38 个
// 适配分全部落在 76–94，按新阈值 33/38（86%）是绿的，灰色低段一次都不会出现。
// 也就是环在现有种子数据上几乎不再区分好坏 —— 这是明知的取舍，不是疏漏。

import { useId } from 'react';
import 样式 from './适配环.module.css';

/** 适配分 → 环形进度的渐变两端。语义与四阶段色系一致：好=绿、要掂量=橙、弱=灰。
 *  返回的两端都是不透明实色 —— 旧实现是「满色 → 同色 55% 透明」，
 *  淡出到半透明在白卡上合成后彩度骤降，看起来像没画完（产品负责人说的「发虚」）。 */
export function 取环渐变(分: number): [起: string, 止: string] {
  if (分 >= 80) return ['var(--适配高分起)', 'var(--适配高分止)'];
  if (分 >= 65) return ['var(--适配中段起)', 'var(--适配中段止)'];
  return ['var(--适配低段起)', 'var(--适配低段止)'];
}

export default function 适配环({
  分,
  尺寸 = 40,
  标 = '适配',
}: {
  分: number;
  /** 外径（px）。40 = 列表卡，44 = 详情页 */
  尺寸?: number;
  /** 环下的小字标；传 null 隐藏 */
  标?: string | null;
}) {
  // 半径按外径等比：40 外径对应 16.5 半径、3.5 线宽
  const 半径 = (尺寸 / 40) * 16.5;
  const 线宽 = (尺寸 / 40) * 3.5;
  const 中心 = 尺寸 / 2;
  const 周长 = 2 * Math.PI * 半径;
  const [渐变起, 渐变止] = 取环渐变(分);
  // 渐变 id 必须每实例唯一：一屏多个环共用一个 id 会互相串色
  const 渐变编号 = useId();

  return (
    <span className={样式.环组}>
      <svg
        width={尺寸}
        height={尺寸}
        viewBox={`0 0 ${尺寸} ${尺寸}`}
        aria-label={`${标 ?? '适配'} ${分} 分`}
        role="img"
      >
        {/* 渐变轴 2026-08-23 定为 100%,25% → 0%,75%：横向为主、略下倾。
            注意进度圆带 rotate(-90)，而 objectBoundingBox 渐变跟着元素一起转，
            所以这组值在屏幕上的实际方向已经算进了那次旋转 —— 改这四个数之前
            先在浏览器里看，别按纸面几何推。 */}
        <defs>
          <linearGradient id={渐变编号} x1="100%" y1="25%" x2="0%" y2="75%">
            <stop offset="0%" stopColor={渐变起} />
            <stop offset="100%" stopColor={渐变止} />
          </linearGradient>
        </defs>
        {/* 轨道：比进度细一档，退到背景里 */}
        <circle
          cx={中心}
          cy={中心}
          r={半径}
          fill="none"
          stroke="var(--未完成轨)"
          strokeWidth={线宽 * 0.72}
        />
        {/* 进度：从 12 点方向顺时针，圆头 + 渐变 */}
        <circle
          cx={中心}
          cy={中心}
          r={半径}
          fill="none"
          stroke={`url(#${渐变编号})`}
          strokeWidth={线宽}
          strokeLinecap="round"
          strokeDasharray={`${(周长 * 分) / 100} ${周长}`}
          transform={`rotate(-90 ${中心} ${中心})`}
        />
        <text
          x={中心}
          y={中心}
          textAnchor="middle"
          dominantBaseline="central"
          className={`${样式.环数} 等宽数字`}
          style={{ fontSize: (尺寸 / 40) * 12, fontWeight: 800, letterSpacing: '-0.03em' }}
          fill="var(--墨)"
        >
          {分}
        </text>
      </svg>
      {标 ? <span className={样式.环标}>{标}</span> : null}
    </span>
  );
}
