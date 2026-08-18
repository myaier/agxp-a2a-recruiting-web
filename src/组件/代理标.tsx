// AI 代理的形象标（2026-08-18 用户指定：借鉴参考图 —— 圆角菱形「脸」+
// 两条竖圆角「眼睛」+ 右下小方点，要简单；配色换成我们的绿）。
//
// 全站凡表示「AI 代理」身份的位置都用它（代理横幅、问AI代理头像、我的-代理卡、
// 消息列表的代理会话头像等）；「盾牌」保留给安全/防护语义（披露说明等）。
//
// 脸色/眼色开放成参数：荧光绿圆底上用 白脸 + 橄榄眼（对应参考图紫底白脸紫眼），
// 白底上直接 橄榄脸 + 白眼。

interface 属性 {
  尺寸?: number;
  /** 菱形脸的填充色 */
  脸色?: string;
  /** 眼睛与右下点的颜色 */
  眼色?: string;
  /** 小尺寸（≤14）时右下点太碎，可关 */
  带点?: boolean;
  /** 描边色。没有圆底衬着时（如代理横幅）用它把轮廓勾出来 */
  描边色?: string;
  /** 描边宽（viewBox 48 坐标系下的值）*/
  描边宽?: number;
}

export default function 代理标({
  尺寸 = 18,
  脸色 = 'var(--橄榄)',
  眼色 = '#ffffff',
  带点 = true,
  描边色,
  描边宽 = 3,
}: 属性) {
  return (
    <svg width={尺寸} height={尺寸} viewBox="0 0 48 48" fill="none" aria-hidden>
      {/* 圆角菱形脸：圆角方形转 45°。有描边色时勾一圈轮廓（去掉圆底后的立面感） */}
      <rect
        x="8.5"
        y="8.5"
        width="31"
        height="31"
        rx="10"
        fill={脸色}
        stroke={描边色}
        strokeWidth={描边色 ? 描边宽 : undefined}
        transform="rotate(45 24 24)"
      />
      {/* 两条竖圆角眼睛 */}
      <rect x="18.4" y="18.5" width="3.6" height="10.5" rx="1.8" fill={眼色} />
      <rect x="26" y="18.5" width="3.6" height="10.5" rx="1.8" fill={眼色} />
      {/* 右下小方点（参考图的记忆点） */}
      {带点 ? (
        <rect
          x="36.5"
          y="36.5"
          width="7"
          height="7"
          rx="2.4"
          fill={脸色}
          stroke={描边色}
          strokeWidth={描边色 ? 描边宽 * 0.7 : undefined}
        />
      ) : null}
    </svg>
  );
}
