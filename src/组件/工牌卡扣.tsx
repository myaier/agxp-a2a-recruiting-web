// 登录页工牌的挂绳卡扣：哑光阳极氧化铝小五金（2026-09-03 用户定稿「做成哑光阳极铝」）。
//
// 一整块深灰近墨的扣板，顶面一道插槽缝让带尾进入，右侧露 2px 厚度，正面 ⌀5 冲孔，
// 底部 12px 扣舌插进证卡顶部的槽孔。光源固定左上：渐变、亮边 / 暗边、接触阴影、
// 孔内阴影全部按它推；阳极氧化的微纹理用 feTurbulence 叠 overlay。
//
// 坐标即 390 宽屏上的 px，与 登录.module.css 里挂绳容器（高 250，两条带在 y=166 汇合）
// 和证卡位置（顶 208，槽孔 y=220–228）一一对应，改任何一处都要一起动。
// SVG 是静态常量，走 dangerouslySetInnerHTML 只是为了保留原样的 SVG 属性写法。

const 卡扣SVG = `<svg width="390" height="250" viewBox="0 0 390 250" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="铝面" gradientUnits="userSpaceOnUse" x1="184" y1="164" x2="208" y2="226">
      <stop offset="0" stop-color="#4a504c"/>
      <stop offset=".5" stop-color="#2e3230"/>
      <stop offset="1" stop-color="#222523"/>
    </linearGradient>
    <linearGradient id="铝顶" gradientUnits="userSpaceOnUse" x1="184" y1="0" x2="206" y2="0">
      <stop offset="0" stop-color="#5a605c"/>
      <stop offset="1" stop-color="#3d423f"/>
    </linearGradient>
    <radialGradient id="铝光" gradientUnits="userSpaceOnUse" cx="188" cy="170" r="30">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".12"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="铝环境" gradientUnits="userSpaceOnUse" x1="0" y1="168" x2="0" y2="192">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset=".5" stop-color="#ffffff" stop-opacity=".08"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="铝棱" gradientUnits="userSpaceOnUse" x1="184" y1="164" x2="206" y2="228">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".14"/>
      <stop offset=".42" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset=".58" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity=".35"/>
    </linearGradient>
    <linearGradient id="孔棱" gradientUnits="userSpaceOnUse" x1="191.5" y1="182.5" x2="196.5" y2="187.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset=".55" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity=".26"/>
    </linearGradient>
    <linearGradient id="带入影" gradientUnits="userSpaceOnUse" x1="0" y1="150" x2="0" y2="164">
      <stop offset="0" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity=".3"/>
    </linearGradient>
    <linearGradient id="褶影" gradientUnits="userSpaceOnUse" x1="0" y1="136" x2="0" y2="166">
      <stop offset="0" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity=".2"/>
    </linearGradient>
    <linearGradient id="褶光" gradientUnits="userSpaceOnUse" x1="0" y1="136" x2="0" y2="166">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity=".1"/>
    </linearGradient>
    <linearGradient id="槽唇影" gradientUnits="userSpaceOnUse" x1="0" y1="220" x2="0" y2="225">
      <stop offset="0" stop-color="#000000" stop-opacity=".42"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <filter id="铝纹" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 .22"/>
    </filter>
    <filter id="接触影" filterUnits="userSpaceOnUse" x="160" y="140" width="80" height="110" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="1.1"/>
      <feOffset dx="1.2" dy="1.6"/>
    </filter>
    <filter id="柔影" filterUnits="userSpaceOnUse" x="150" y="130" width="100" height="130" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="3"/>
      <feOffset dx="1" dy="3"/>
    </filter>
    <filter id="柔06" filterUnits="userSpaceOnUse" x="170" y="160" width="50" height="80" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation=".55"/>
    </filter>
    <path id="面路径" d="M185 165.5H203A1 1 0 0 1 204 166.5L203 205.5A3.5 3.5 0 0 1 199.5 209H188.5A3.5 3.5 0 0 1 185 205.5L184 166.5A1 1 0 0 1 185 165.5Z"/>
    <clipPath id="面全">
      <use href="#面路径"/>
      <rect x="189" y="209" width="10" height="19"/>
    </clipPath>
    <clipPath id="孔"><circle cx="194" cy="185" r="2.5"/></clipPath>
    <clipPath id="槽"><rect x="175" y="220" width="40" height="8" rx="4"/></clipPath>
    <clipPath id="带尾">
      <polygon transform="rotate(-22 195 166)" points="182,-94 208,-94 208,134 200,166 190,166 182,134"/>
      <polygon transform="rotate(22 195 166)"  points="182,-94 208,-94 208,134 200,166 190,166 182,134"/>
    </clipPath>
    <g id="影源">
      <path fill="#000" fill-rule="evenodd" d="M185.5 164H204.5A1.5 1.5 0 0 1 206 165.5L205 205.5A3.5 3.5 0 0 1 201.5 209H188.5A3.5 3.5 0 0 1 185 205.5L184 165.5A1.5 1.5 0 0 1 185.5 164Z M194 182.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5Z"/>
      <rect x="189" y="209" width="12" height="11" fill="#000"/>
    </g>
  </defs>

  <!-- 带尾被压进扣里的褶皱与扣沿接触阴影 -->
  <g clip-path="url(#带尾)">
    <g transform="rotate(-22 195 166)" stroke-width=".8">
      <path d="M187.6 136V166M201.6 136V166" stroke="url(#褶光)"/>
      <path d="M188.4 136V166M202.4 136V166" stroke="url(#褶影)"/>
    </g>
    <g transform="rotate(22 195 166)" stroke-width=".8">
      <path d="M187.6 136V166M201.6 136V166" stroke="url(#褶光)"/>
      <path d="M188.4 136V166M202.4 136V166" stroke="url(#褶影)"/>
    </g>
    <rect x="168" y="150" width="54" height="14" fill="url(#带入影)"/>
  </g>

  <!-- 扣对卡 / 对底色的投影：柔的环境影 + 紧的接触影 -->
  <use href="#影源" filter="url(#柔影)" opacity=".16"/>
  <use href="#影源" filter="url(#接触影)" opacity=".34"/>

  <!-- 厚度：最暗的侧面色，右侧露 2px -->
  <path fill="#121413" fill-rule="evenodd" d="M185.5 164H204.5A1.5 1.5 0 0 1 206 165.5L205 205.5A3.5 3.5 0 0 1 201.5 209H188.5A3.5 3.5 0 0 1 185 205.5L184 165.5A1.5 1.5 0 0 1 185.5 164Z M194 182.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5Z"/>
  <rect x="189" y="209" width="12" height="19" fill="#121413"/>
  <path d="M204.6 167L203.7 205" stroke="#ffffff" stroke-opacity=".06" stroke-width=".5"/>

  <!-- 顶面：受光窄面 + 插槽缝，缝里露一线绿带 -->
  <path d="M185.2 164H204.8A1.3 1.3 0 0 1 206 165.3V165.6H184V165.3A1.3 1.3 0 0 1 185.2 164Z" fill="url(#铝顶)"/>
  <rect x="187.5" y="164.25" width="15" height="1.1" rx=".5" fill="#0a0b0a"/>
  <rect x="188.2" y="164.45" width="13.6" height=".5" fill="#3fd34e" fill-opacity=".55"/>

  <!-- 正面：阳极氧化铝，孔挖空 -->
  <path fill="url(#铝面)" fill-rule="evenodd" d="M185 165.5H203A1 1 0 0 1 204 166.5L203 205.5A3.5 3.5 0 0 1 199.5 209H188.5A3.5 3.5 0 0 1 185 205.5L184 166.5A1 1 0 0 1 185 165.5Z M194 182.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5Z"/>
  <rect x="189" y="209" width="10" height="19" fill="url(#铝面)"/>

  <!-- 哑光面的柔光、环境反射、微纹理 -->
  <g clip-path="url(#面全)">
    <rect x="184" y="164" width="20" height="46" fill="url(#铝光)"/>
    <rect x="184" y="168" width="20" height="24" fill="url(#铝环境)"/>
    <rect x="184" y="164" width="20" height="64" filter="url(#铝纹)" style="mix-blend-mode:overlay" opacity=".5"/>
  </g>

  <!-- 棱线：左上亮边 → 右下暗边 -->
  <path d="M185.2 166H202.8A.6 .6 0 0 1 203.4 166.6L202.5 205.5A3 3 0 0 1 199.5 208.5H188.5A3 3 0 0 1 185.5 205.5L184.6 166.6A.6 .6 0 0 1 185.2 166Z" stroke="url(#铝棱)" stroke-width="1"/>
  <path d="M184 165.6H204" stroke="#000000" stroke-opacity=".3" stroke-width=".5"/>
  <path d="M189.5 209.5V228" stroke="#ffffff" stroke-opacity=".09" stroke-width="1"/>
  <path d="M198.5 209.5V228" stroke="#000000" stroke-opacity=".35" stroke-width="1"/>

  <!-- ⌀5 冲孔：孔壁内阴影 + 右下孔沿受光 -->
  <g clip-path="url(#孔)">
    <path fill="#000000" fill-opacity=".5" fill-rule="evenodd" filter="url(#柔06)" d="M188 179h12v12h-12z M194.9 183.4a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z"/>
  </g>
  <circle cx="194" cy="185" r="2.75" stroke="url(#孔棱)" stroke-width=".6"/>

  <!-- 卡槽：槽上唇的影子落在舌上，舌身向右投接触影 -->
  <g clip-path="url(#槽)">
    <rect x="175" y="220" width="40" height="5" fill="url(#槽唇影)"/>
    <rect x="200.5" y="220" width="2.2" height="8" fill="#000000" fill-opacity=".22" filter="url(#柔06)"/>
  </g>
</svg>`;

/** 挂绳卡扣：一块 390×250 的透明画布，扣在 x≈195、y 164–228 的位置 */
export default function 工牌卡扣({ className }: { className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: 卡扣SVG }} />;
}
