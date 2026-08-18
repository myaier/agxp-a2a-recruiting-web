// 适配分环形进度（视觉规范 v2，2026-08-18）。
//
// 参考 Jobright 的 match ring 的形，但颜色带语义，不是装饰性的一律绿：
//   ≥90 递简历绿（放心推进）/ 75–89 协调橙（要掂量）/ 更低 灰（弱匹配）。
// 首页在谈卡、看市场卡、企业端候选卡共用这一个组件，分数语义全站一致。

import 样式 from './适配环.module.css';

/** 适配分 → 环形进度的主题色。语义与四阶段色系一致：好=绿、要掂量=橙、弱=灰 */
export function 取环色(分: number): string {
  if (分 >= 90) return 'var(--递简历)';
  if (分 >= 75) return 'var(--协调)';
  return 'var(--次要浅)';
}

export default function 适配环({
  分,
  尺寸 = 40,
  标 = '适配',
}: {
  分: number;
  /** 外径（px）。40 = 列表卡，64 = 详情页大环 */
  尺寸?: number;
  /** 环下的小字标；传 null 隐藏 */
  标?: string | null;
}) {
  // 半径按外径等比：40 外径对应 16.5 半径、3.5 线宽
  const 半径 = (尺寸 / 40) * 16.5;
  const 线宽 = (尺寸 / 40) * 3.5;
  const 中心 = 尺寸 / 2;
  const 周长 = 2 * Math.PI * 半径;
  const 色 = 取环色(分);

  return (
    <span className={样式.环组}>
      <svg
        width={尺寸}
        height={尺寸}
        viewBox={`0 0 ${尺寸} ${尺寸}`}
        aria-label={`${标 ?? '适配'} ${分} 分`}
        role="img"
      >
        {/* 轨道 */}
        <circle cx={中心} cy={中心} r={半径} fill="none" stroke="var(--浅灰底)" strokeWidth={线宽} />
        {/* 进度：从 12 点方向顺时针 */}
        <circle
          cx={中心}
          cy={中心}
          r={半径}
          fill="none"
          stroke={色}
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
          className={样式.环数}
          style={{ fontSize: (尺寸 / 40) * 12.5 }}
          fill="var(--墨)"
        >
          {分}
        </text>
      </svg>
      {标 ? <span className={样式.环标}>{标}</span> : null}
    </span>
  );
}
