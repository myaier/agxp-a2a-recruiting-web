// 候选人头像（2026-08-19 标注 11:38 重画：上一版几何小人太拙）。
//
// 不用真人照片：双盲下意向确认前不该出现可辨识的真脸。改成「字母纪念章」——
// 化名首字压在同色系渐变圆底上，右下一枚细描边缺口环。信息量与字标一样，
// 但有厚度、有品牌感，不是画得不像的小人。

/** 六套同色系渐变：低饱和、暗到亮，配白字始终有对比 */
const 渐变表 = [
  ['#4a6741', '#7f9e63'],
  ['#3f5668', '#6d8ba3'],
  ['#6b5340', '#a3866a'],
  ['#4d5a4a', '#8b9a83'],
  ['#5b4a63', '#95799f'],
  ['#3f5f5c', '#6f9c95'],
];

/** 把编号打散成稳定正整数：同一个人每次都是同一副头像 */
function 散列(键: string): number {
  let 值 = 0;
  for (let i = 0; i < 键.length; i += 1) 值 = (值 * 31 + 键.charCodeAt(i)) >>> 0;
  return 值;
}

export default function 人像头({
  键,
  首字,
  尺寸 = 34,
}: {
  /** 稳定标识（用候选编号）*/
  键: string;
  /** 化名首字 */
  首字: string;
  尺寸?: number;
}) {
  const 种 = 散列(键);
  const [暗, 亮] = 渐变表[种 % 渐变表.length];
  // 渐变角度也跟着散列变，六套配色 × 四个角度 = 24 种面孔
  const 角 = [135, 45, 90, 160][Math.floor(种 / 7) % 4];
  const 编 = `人像${种 % 1000}`;

  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 40 40"
      fill="none"
      style={{ flex: 'none', display: 'block' }}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={编}
          x1="0"
          y1="0"
          x2={Math.cos((角 * Math.PI) / 180)}
          y2={Math.sin((角 * Math.PI) / 180)}
        >
          <stop offset="0%" stopColor={暗} />
          <stop offset="100%" stopColor={亮} />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#${编})`} />
      {/* 内圈细白环：把字与底分开，做出徽章的厚度 */}
      <circle cx="20" cy="20" r="17.2" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
      <text
        x="20"
        y="20"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}
      >
        {首字}
      </text>
    </svg>
  );
}
