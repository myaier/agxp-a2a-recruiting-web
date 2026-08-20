// 卡通头像 —— 注册收尾页的两枚虚拟头像（标注 2026-08-20 13:07：
// 删掉纪念章风格，换成男女两个扁平动画头像）。
// 自绘 SVG：圆底 + 发型 + 脸 + 领口，配色取设计令牌系（荧光绿 / 墨 / 淡绿）。

interface 属性 {
  款式: '男' | '女';
  尺寸?: number;
}

export default function 卡通头像({ 款式, 尺寸 = 56 }: 属性) {
  const 男 = 款式 === '男';
  return (
    <svg width={尺寸} height={尺寸} viewBox="0 0 96 96" fill="none" aria-hidden>
      {/* 圆底：男 = 淡绿底，女 = 荧光绿底，一眼可分 */}
      <circle cx="48" cy="48" r="48" fill={男 ? '#e6f3c0' : '#cdea4e'} />

      {/* 肩与领口 */}
      <path
        d="M20 96c2-18 13-26 28-26s26 8 28 26z"
        fill={男 ? 'var(--墨, #1a1a1a)' : '#3f7a1f'}
      />

      {/* 脸 */}
      <circle cx="48" cy="44" r="20" fill="#f6d7b8" />

      {男 ? (
        /* 男款：短刘海 */
        <path
          d="M28 42c0-13 9-21 20-21s20 8 20 21c-3-7-8-9-12-9h-16c-4 0-9 2-12 9z"
          fill="#1a1a1a"
        />
      ) : (
        /* 女款：中分长发，两侧垂到肩 */
        <>
          <path
            d="M26 46c-1-16 10-25 22-25s23 9 22 25l-3 14c-1-12-3-18-5-21-3 5-9 7-14 7s-11-2-14-7c-2 3-4 9-5 21z"
            fill="#3c2a1e"
          />
          <path d="M24 60c0-6 1-11 2-14l4 14z" fill="#3c2a1e" />
          <path d="M72 60c0-6-1-11-2-14l-4 14z" fill="#3c2a1e" />
        </>
      )}

      {/* 眼睛与微笑 */}
      <circle cx="41" cy="46" r="2.4" fill="#1a1a1a" />
      <circle cx="55" cy="46" r="2.4" fill="#1a1a1a" />
      <path
        d="M43 54c1.6 1.8 8.4 1.8 10 0"
        stroke="#1a1a1a"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
