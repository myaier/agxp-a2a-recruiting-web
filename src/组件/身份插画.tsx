// 选身份分屏（方案 C，2026-08-24）的两幅场景插画。
// 参考 BOSS 直聘选身份页的「插画讲故事」结构，但不用人物 —— 用本产品
// 彩绘图标的几何语言拼场景：求职 = 手提箱 + 悬浮 offer 卡 + 放大镜；
// 招人 = 楼宇 + 悬浮简历卡。色相各归各半屏（绿 / 天蓝）。

export function 求职插画({ 边长 = 190 }: { 边长?: number }) {
  return (
    <svg width={边长} height={边长} viewBox="0 0 160 160" role="img" aria-label="找工作">
      <defs>
        <radialGradient id="身份绿晕" cx="50%" cy="38%" r="65%">
          <stop stopColor="#e9f6bb" />
          <stop offset="1" stopColor="#f7fae9" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="82" r="64" fill="url(#身份绿晕)" />
      {/* 悬浮 offer 卡：白卡 + 荧光绿条目 */}
      <rect x="34" y="30" width="44" height="34" rx="8" fill="#fff" stroke="#eeefe9" />
      <rect x="42" y="40" width="28" height="4" rx="2" fill="#ccf24f" />
      <rect x="42" y="48" width="20" height="4" rx="2" fill="#e6e7df" />
      {/* 手提箱 */}
      <g transform="translate(44,58)">
        <rect x="24" y="0" width="24" height="12" rx="5" fill="#3f7a1f" />
        <rect x="0" y="8" width="72" height="52" rx="12" fill="#7fa317" />
        <rect x="0" y="8" width="72" height="24" rx="12" fill="#8fb51c" />
        <rect x="30" y="26" width="12" height="10" rx="3" fill="#ccf24f" />
      </g>
      {/* 放大镜 */}
      <g transform="translate(104,44)">
        <circle cx="14" cy="14" r="13" fill="#fff" stroke="#3fd34e" strokeWidth="3" />
        <line x1="24" y1="24" x2="33" y2="33" stroke="#3fd34e" strokeWidth="4" strokeLinecap="round" />
        <circle cx="14" cy="14" r="6" fill="#eef6d6" />
      </g>
    </svg>
  );
}

export function 招人插画({ 边长 = 190 }: { 边长?: number }) {
  return (
    <svg width={边长} height={边长} viewBox="0 0 160 160" role="img" aria-label="招人">
      <defs>
        <radialGradient id="身份蓝晕" cx="50%" cy="38%" r="65%">
          <stop stopColor="#dcebfa" />
          <stop offset="1" stopColor="#f2f8fe" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="82" r="64" fill="url(#身份蓝晕)" />
      {/* 主副楼：深绿主楼 + 亮绿裙楼 */}
      <g transform="translate(52,42)">
        <rect x="0" y="0" width="40" height="76" rx="9" fill="#3f7a1f" />
        <g fill="#ccf24f">
          <rect x="8" y="10" width="9" height="9" rx="2.5" />
          <rect x="23" y="10" width="9" height="9" rx="2.5" />
          <rect x="8" y="26" width="9" height="9" rx="2.5" />
          <rect x="23" y="26" width="9" height="9" rx="2.5" />
          <rect x="8" y="42" width="9" height="9" rx="2.5" />
        </g>
        <rect x="30" y="46" width="28" height="30" rx="7" fill="#9fd41f" />
        <g fill="#3f7a1f">
          <rect x="37" y="54" width="6" height="6" rx="2" />
          <rect x="47" y="54" width="6" height="6" rx="2" />
        </g>
      </g>
      {/* 悬浮简历卡 */}
      <g transform="translate(96,30)">
        <rect width="40" height="50" rx="8" fill="#fff" stroke="#eeefe9" />
        <rect x="7" y="8" width="12" height="12" rx="6" fill="#dbeafd" />
        <rect x="7" y="26" width="26" height="4" rx="2" fill="#e6e7df" />
        <rect x="7" y="34" width="18" height="4" rx="2" fill="#e6e7df" />
      </g>
      {/* 亮绿勾按标注 2026-08-24 删除（「把这个招聘图标里的对号删掉」）*/}
    </svg>
  );
}
