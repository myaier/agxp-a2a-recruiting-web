// 虚拟头像 —— 注册收尾页的两枚（标注 2026-08-20 14:21 第四版：
// 要有表情的笑脸 + 男女一眼可分）。
// 性别信号拉满：女 = 双侧长发垂肩 + 帘式刘海 + 睫毛 + 腮红 + 荧光绿发卡；
//              男 = 黑色利落短发 + 粗眉 + 白领墨色衫。两枚都是弯眼笑脸。

interface 属性 {
  款式: '男' | '女';
  尺寸?: number;
}

export default function 卡通头像({ 款式, 尺寸 = 56 }: 属性) {
  const 男 = 款式 === '男';
  const id = 男 ? 'a' : 'b';
  return (
    <svg width={尺寸} height={尺寸} viewBox="0 0 96 96" fill="none" aria-hidden>
      <defs>
        <clipPath id={`av${id}`}>
          <circle cx="48" cy="48" r="48" />
        </clipPath>
      </defs>
      <g clipPath={`url(#av${id})`}>
        {/* 底色：男浅绿、女暖米绿 */}
        <circle cx="48" cy="48" r="48" fill={男 ? '#e7f0cf' : '#f6f4e0'} />

        {男 ? (
          <>
            {/* 肩与白领衬衫 */}
            <rect x="42" y="60" width="12" height="10" rx="5" fill="#e9bd93" />
            <path d="M15 96c2.5-16.5 15-24 33-24s30.5 7.5 33 24z" fill="#23271f" />
            <path d="M41 73l7 7 7-7-3.4-2.6h-7.2z" fill="#ffffff" />
            {/* 脸与耳 */}
            <circle cx="31.5" cy="45" r="3.2" fill="#f5cfa8" />
            <circle cx="64.5" cy="45" r="3.2" fill="#f5cfa8" />
            <circle cx="48" cy="44" r="16.5" fill="#f5cfa8" />
            {/* 黑色利落短发：圆顶 + 平齐发际线 */}
            <path
              d="M31.5 45c-.8-14 6.5-21.5 16.5-21.5S65.3 31 64.5 45l-2.2 0c.2-6.5-1.6-10.4-4.3-12.3-2.3 1.7-6 2.5-10 2.5s-7.7-.8-10-2.5c-2.7 1.9-4.5 5.8-4.3 12.3z"
              fill="#221f1c"
            />
            {/* 粗眉 + 弯眼笑 */}
            <rect x="37" y="41.5" width="8" height="2.6" rx="1.3" fill="#2c2824" />
            <rect x="51" y="41.5" width="8" height="2.6" rx="1.3" fill="#2c2824" />
            <path d="M38.6 48.6c1.2-1.8 3.6-1.8 4.8 0" stroke="#23201c" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M52.6 48.6c1.2-1.8 3.6-1.8 4.8 0" stroke="#23201c" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            {/* 笑：开口弧 + 腮红 */}
            <path d="M42.5 54.5c1.6 2.6 9.4 2.6 11 0" stroke="#a85f43" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            <circle cx="36" cy="52.5" r="2.6" fill="#f0a98c" opacity="0.4" />
            <circle cx="60" cy="52.5" r="2.6" fill="#f0a98c" opacity="0.4" />
          </>
        ) : (
          <>
            {/* 后层长发：宽出脸颊、垂到肩下，两侧都看得见 */}
            <path
              d="M25 46c0-16.5 9.5-26 23-26s23 9.5 23 26c0 13-1 24-3 30h-8l-1.5-14h-21L36 76h-8c-2-6-3-17-3-30z"
              fill="#54371f"
            />
            {/* 肩与深绿圆领衫 */}
            <rect x="42.5" y="59" width="11" height="10" rx="5" fill="#eec39a" />
            <path d="M17 96c2.5-15.5 14.5-22.5 31-22.5s28.5 7 31 22.5z" fill="#3f7a1f" />
            {/* 脸与耳环 */}
            <circle cx="48" cy="45" r="15.5" fill="#f7d6ae" />
            <circle cx="32.8" cy="49" r="1.7" fill="#e2b45c" />
            <circle cx="63.2" cy="49" r="1.7" fill="#e2b45c" />
            {/* 帘式刘海（中分）+ 前侧发绺 */}
            <path d="M48 28.5c-9.5 0-15.5 6.8-15.3 18l4-1.2c-.6-7.4 2.2-12 7-13.8 1.3 2.6 2.8 3.4 4.3 3.4z" fill="#5f3e24" />
            <path d="M48 28.5c9.5 0 15.5 6.8 15.3 18l-4-1.2c.6-7.4-2.2-12-7-13.8-1.3 2.6-2.8 3.4-4.3 3.4z" fill="#5f3e24" />
            {/* 荧光绿发卡 */}
            <rect x="56.5" y="32.5" width="7" height="3" rx="1.5" transform="rotate(24 60 34)" fill="#cdea4e" />
            {/* 细眉 + 弯眼笑 + 睫毛 */}
            <path d="M38 42.2c1.8-1.3 4.4-1.3 6-.4" stroke="#4a382a" strokeWidth="1.7" strokeLinecap="round" fill="none" />
            <path d="M58 42.2c-1.8-1.3-4.4-1.3-6-.4" stroke="#4a382a" strokeWidth="1.7" strokeLinecap="round" fill="none" />
            <path d="M39.4 48.8c1.1-1.7 3.3-1.7 4.4 0" stroke="#23201c" strokeWidth="2.1" strokeLinecap="round" fill="none" />
            <path d="M52.2 48.8c1.1-1.7 3.3-1.7 4.4 0" stroke="#23201c" strokeWidth="2.1" strokeLinecap="round" fill="none" />
            <path d="M38.6 46.8l-1.8-1M57.4 46.8l1.8-1" stroke="#23201c" strokeWidth="1.2" strokeLinecap="round" />
            {/* 笑 + 明显腮红 */}
            <path d="M43.5 55c1.4 2.3 7.6 2.3 9 0" stroke="#b0584a" strokeWidth="2.3" strokeLinecap="round" fill="none" />
            <circle cx="37" cy="53" r="2.9" fill="#f2a0a0" opacity="0.55" />
            <circle cx="59" cy="53" r="2.9" fill="#f2a0a0" opacity="0.55" />
          </>
        )}
      </g>
    </svg>
  );
}
