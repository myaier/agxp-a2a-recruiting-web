// 虚拟头像 —— 注册收尾页的两枚（标注 2026-08-20 14:01 第三版：
// 简约、有创意、有质感 → 放弃五官卡通，改双色剪影纪念章）。
//
// 设计语言：无五官的头肩剪影 + 对角渐变 + 左上高光弧 + 底部内阴影，
// 一枚墨底荧光绿影（男：利落短发剪影），一枚荧光绿底墨影（女：低发髻剪影）。
// 互为反色配对，贴品牌双色；没有表情所以也天然匿名。

interface 属性 {
  款式: '男' | '女';
  尺寸?: number;
}

export default function 卡通头像({ 款式, 尺寸 = 56 }: 属性) {
  const 男 = 款式 === '男';
  const id = 男 ? '男' : '女';
  return (
    <svg width={尺寸} height={尺寸} viewBox="0 0 96 96" fill="none" aria-hidden>
      <defs>
        <linearGradient id={`${id}底渐变`} x1="10" y1="8" x2="86" y2="90">
          {男 ? (
            <>
              <stop offset="0" stopColor="#31362c" />
              <stop offset="1" stopColor="#171a14" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#d8f16a" />
              <stop offset="1" stopColor="#b7d838" />
            </>
          )}
        </linearGradient>
        <linearGradient id={`${id}影渐变`} x1="30" y1="24" x2="70" y2="96">
          {男 ? (
            <>
              <stop offset="0" stopColor="#d5ee62" />
              <stop offset="1" stopColor="#a9cc2e" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#343931" />
              <stop offset="1" stopColor="#15170f" />
            </>
          )}
        </linearGradient>
        <clipPath id={`${id}圆窗`}>
          <circle cx="48" cy="48" r="48" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id}圆窗)`}>
        <circle cx="48" cy="48" r="48" fill={`url(#${id}底渐变)`} />

        {男 ? (
          /* 男剪影：平顶利落短发 + 直肩 —— 头顶略平、鬓角收直 */
          <g fill={`url(#男影渐变)`}>
            <path d="M34.5 40.5c0-9.5 5.5-15.5 13.5-15.5s13.5 6 13.5 15.5c0 6.5-2.6 11.6-6.6 14.2v6.1c8.9 2 15.7 7.4 18.1 17.2 1 4.2-1.9 8-6 8h-38c-4.1 0-7-3.8-6-8 2.4-9.8 9.2-15.2 18.1-17.2v-6.1c-4-2.6-6.6-7.7-6.6-14.2z" />
          </g>
        ) : (
          /* 女剪影：圆润头型 + 后颈低发髻 + 溜肩 */
          <g fill={`url(#女影渐变)`}>
            <circle cx="63.5" cy="34" r="7.5" />
            <path d="M33.5 42c0-9.5 6-15.5 14.5-15.5S62.5 32.5 62.5 42c0 6.3-2.5 11.3-6.4 13.9v5.4c9.3 1.9 16.3 7.5 18.8 17.7 1 4.2-1.9 8-6 8h-42c-4.1 0-7-3.8-6-8 2.5-10.2 9.5-15.8 18.8-17.7v-5.4c-3.9-2.6-6.2-7.6-6.2-13.9z" />
          </g>
        )}

        {/* 左上高光弧：一道细月牙，玻璃质感 */}
        <path
          d="M18 34C22 21 32 12.5 45 10.5"
          stroke={男 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.55)'}
          strokeWidth="3.6"
          strokeLinecap="round"
          fill="none"
        />
        {/* 底部内阴影：一层压边，让圆章有厚度 */}
        <ellipse cx="48" cy="102" rx="52" ry="18" fill={男 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.09)'} />
      </g>
    </svg>
  );
}
