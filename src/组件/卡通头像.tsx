// 卡通头像 —— 注册收尾页的两枚虚拟头像（标注 2026-08-20 13:20 重画：
// 要精致高级、一眼分男女）。自绘扁平 SVG：
//   男 = 三七分短发 + 白领墨色衬衫 + 平眉；女 = 中分长发垂肩 + 深绿圆领衫 + 睫毛 + 腮红 + 耳饰。
// 配色贴设计令牌系（墨 / 深绿 / 淡绿底），底色两款区分。

interface 属性 {
  款式: '男' | '女';
  尺寸?: number;
}

export default function 卡通头像({ 款式, 尺寸 = 56 }: 属性) {
  if (款式 === '男') {
    return (
      <svg width={尺寸} height={尺寸} viewBox="0 0 96 96" fill="none" aria-hidden>
        <defs>
          <clipPath id="男圆">
            <circle cx="48" cy="48" r="48" />
          </clipPath>
        </defs>
        <g clipPath="url(#男圆)">
          <circle cx="48" cy="48" r="48" fill="#eef2df" />
          {/* 脖颈与肩：白色内领衬出层次 */}
          <rect x="42" y="58" width="12" height="12" rx="5" fill="#e9bd93" />
          <path d="M14 96c3-17 16-24 34-24s31 7 34 24z" fill="#20241d" />
          <path d="M40 74c2 4 5 6 8 6s6-2 8-6l-4-3h-8z" fill="#ffffff" />
          {/* 头 */}
          <ellipse cx="48" cy="43" rx="16.5" ry="17.5" fill="#f3cfa6" />
          {/* 耳朵 */}
          <circle cx="31.5" cy="45" r="3" fill="#f3cfa6" />
          <circle cx="64.5" cy="45" r="3" fill="#f3cfa6" />
          {/* 三七分短发：发际线清晰，右侧掀起一点弧度 */}
          <path
            d="M31.5 46c-1-15 7-22 16.5-22 10 0 17.5 7 16.5 22l-2.5 0c0-8-3-12-6-13.5-1.5 2.5-7 3.5-12 3.5-4 0-7.5 1.5-9 10z"
            fill="#26221f"
          />
          {/* 平眉 + 眼睛 + 鼻 + 浅笑 */}
          <rect x="37.5" y="41" width="7" height="2" rx="1" fill="#3a332e" />
          <rect x="51.5" y="41" width="7" height="2" rx="1" fill="#3a332e" />
          <circle cx="41" cy="47" r="2" fill="#2b2b2b" />
          <circle cx="55" cy="47" r="2" fill="#2b2b2b" />
          <path d="M48 49v4" stroke="#e0aa7e" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M43.5 56c1.4 1.5 7.6 1.5 9 0" stroke="#b06a4a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </g>
      </svg>
    );
  }
  return (
    <svg width={尺寸} height={尺寸} viewBox="0 0 96 96" fill="none" aria-hidden>
      <defs>
        <clipPath id="女圆">
          <circle cx="48" cy="48" r="48" />
        </clipPath>
      </defs>
      <g clipPath="url(#女圆)">
        <circle cx="48" cy="48" r="48" fill="#f6f9e6" />
        {/* 后层长发：垂到画面底部 */}
        <path d="M26 42c0-16 9-24 22-24s22 8 22 24v54H26z" fill="#4a3226" />
        {/* 脖颈与肩：深绿圆领衫 */}
        <rect x="42.5" y="58" width="11" height="11" rx="5" fill="#e9bd93" />
        <path d="M16 96c3-16 15-23 32-23s29 7 32 23z" fill="#3f7a1f" />
        <path d="M42 73c1.8 2.6 4 4 6 4s4.2-1.4 6-4" stroke="#2f5c17" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* 头 */}
        <ellipse cx="48" cy="44" rx="15.5" ry="16.5" fill="#f6d4ab" />
        {/* 耳饰：小金点 */}
        <circle cx="33" cy="50" r="1.6" fill="#e2b45c" />
        <circle cx="63" cy="50" r="1.6" fill="#e2b45c" />
        {/* 前层中分刘海：两片弧线框脸 */}
        <path d="M48 26c-10 0-16.5 7-16 20l3.5-1c-.5-8 2-13 6.5-15 1.5 3 4 4 6 4z" fill="#54392b" />
        <path d="M48 26c10 0 16.5 7 16 20l-3.5-1c.5-8-2-13-6.5-15-1.5 3-4 4-6 4z" fill="#54392b" />
        {/* 细眉 + 带睫毛的眼睛 + 鼻 + 笑 + 腮红 */}
        <path d="M37.5 41.5c2-1.4 5-1.4 7-.4" stroke="#4a3a30" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M58.5 41.5c-2-1.4-5-1.4-7-.4" stroke="#4a3a30" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <circle cx="41" cy="47.5" r="2" fill="#2b2b2b" />
        <circle cx="55" cy="47.5" r="2" fill="#2b2b2b" />
        <path d="M38.6 45.6l1.8-1M57.4 45.6l-1.8-1" stroke="#2b2b2b" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M48 49.5v3.5" stroke="#e0aa7e" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M44 56.5c1.3 1.4 6.7 1.4 8 0" stroke="#b0584a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <circle cx="37" cy="53" r="2.6" fill="#f2a68b" opacity="0.5" />
        <circle cx="59" cy="53" r="2.6" fill="#f2a68b" opacity="0.5" />
      </g>
    </svg>
  );
}
