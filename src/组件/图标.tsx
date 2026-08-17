// 全部图标为内联 SVG 线性图标（stroke 1.8-1.9，圆角端点），与设计稿一比一。
// 无外部图片资源 —— 这也是整个应用零图片依赖、打包后只有一个 JS 的原因。

interface 图标属性 {
  尺寸?: number;
  色?: string;
  线宽?: number;
}

/** AI 代理盾牌：品牌符号，出现在横幅 / 头像 / 气泡 */
export function 盾牌图标({ 尺寸 = 15, 色 = '#1a1a1a' }: 图标属性) {
  return (
    <svg width={尺寸} height={尺寸} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.2 20 7.4v5.2c0 4.6-3.2 7.4-8 8.2-4.8-.8-8-3.6-8-8.2V7.4Z"
        stroke={色}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m8.6 12.2 2.4 2.4 4.4-4.6"
        stroke={色}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 底部导航「职位」——公文包 */
export function 公文包图标({ 尺寸 = 21, 色 = '#c3c6bd', 线宽 = 1.9 }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={线宽}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.6" y="7.2" width="18.8" height="13" rx="3" />
      <path d="M8.6 7.2V5.4a2 2 0 0 1 2-2h2.8a2 2 0 0 1 2 2v1.8" />
      <path d="M2.6 12.4h18.8" />
      <path d="M10.6 12.4h2.8" />
    </svg>
  );
}

/** 底部导航「消息」——双气泡 */
export function 气泡图标({ 尺寸 = 21, 色 = '#c3c6bd', 线宽 = 1.9 }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={线宽}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6.6a2.6 2.6 0 0 1 2.6-2.6h9.2A2.6 2.6 0 0 1 17.4 6.6v4.6a2.6 2.6 0 0 1-2.6 2.6H9l-4 3.1v-3.1H5.6A2.6 2.6 0 0 1 3 11.2Z" />
      <path d="M17.4 8.2h1a2.6 2.6 0 0 1 2.6 2.6v4.6a2.6 2.6 0 0 1-2.6 2.6H18v2.6l-3.4-2.6" />
    </svg>
  );
}

/** 底部导航「我的」——人像 */
export function 人像图标({ 尺寸 = 21, 色 = '#c3c6bd', 线宽 = 1.9 }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={线宽}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8.2" r="3.9" />
      <path d="M4.4 20.4a7.6 7.6 0 0 1 15.2 0" />
    </svg>
  );
}

export function 放大镜图标({ 尺寸 = 23, 色 = '#3f4536', 线宽 = 1.9 }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={线宽}
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.6" y1="15.6" x2="20.5" y2="20.5" />
    </svg>
  );
}

/** 「让AI代理去谈」按钮里的对话勾选 */
export function 谈判图标({ 尺寸 = 13, 色 = '#1a1a1a' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 11.2a7.6 7.6 0 0 1-8.4 7.6 8.6 8.6 0 0 1-3.4-.7L3.5 19.4l1.4-4.2a7.2 7.2 0 0 1-1.4-4A7.6 7.6 0 0 1 12 3.6a7.6 7.6 0 0 1 9 7.6Z" />
      <path d="m8.8 11.4 2.1 2.1 4-4.2" />
    </svg>
  );
}

/** 阶段节点里的白色对勾（已通过） */
export function 对勾图标({ 尺寸 = 10, 色 = '#fff', 线宽 = 3.4 }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={线宽}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function 齿轮图标({ 尺寸 = 23, 色 = '#3f4536' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 14.6a1.8 1.8 0 0 0 .36 1.98 2.2 2.2 0 1 1-3.1 3.1 1.8 1.8 0 0 0-3.06 1.28 2.2 2.2 0 1 1-4.4 0 1.8 1.8 0 0 0-3.06-1.28 2.2 2.2 0 1 1-3.1-3.1A1.8 1.8 0 0 0 3.7 13.5a2.2 2.2 0 1 1 0-4.4 1.8 1.8 0 0 0 1.28-3.06 2.2 2.2 0 1 1 3.1-3.1A1.8 1.8 0 0 0 11.14 3.7a2.2 2.2 0 1 1 4.4 0 1.8 1.8 0 0 0 3.06 1.28 2.2 2.2 0 1 1 3.1 3.1 1.8 1.8 0 0 0 1.28 3.06 2.2 2.2 0 1 1 0 4.4 1.8 1.8 0 0 0-1.58 1.06z" />
    </svg>
  );
}

export function 铃铛图标({ 尺寸 = 23, 色 = '#3f4536' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8.4a6 6 0 1 0-12 0c0 7-2.5 8.6-2.5 8.6h17S18 15.4 18 8.4" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function 双箭头图标({ 尺寸 = 23, 色 = '#3f4536' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 7.2h13.2l-3-3" />
      <path d="M20 16.8H6.8l3 3" />
    </svg>
  );
}

export function 简历图标({ 尺寸 = 21, 色 = '#3f7a1f' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" />
    </svg>
  );
}

export function 靶心图标({ 尺寸 = 21, 色 = '#3f7a1f' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  );
}

export function 旗帜图标({ 尺寸 = 21, 色 = '#3f7a1f' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 21V4" />
      <path d="M6 4.8c4.4-2.4 7.6 2 12 0v8.2c-4.4 2.4-7.6-2-12 0" />
    </svg>
  );
}

export function 禁止图标({ 尺寸 = 21, 色 = '#3f7a1f' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.2" />
      <line x1="6.4" y1="6.4" x2="17.6" y2="17.6" />
    </svg>
  );
}

export function 层级图标({ 尺寸 = 21, 色 = '#6f7268' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 3.6 8.4 4.8L12 13.2 3.6 8.4Z" />
      <path d="m4.6 12.8 7.4 4.2 7.4-4.2" />
      <path d="m4.6 16.6 7.4 4.2 7.4-4.2" />
    </svg>
  );
}

export function 归档图标({ 尺寸 = 21, 色 = '#6f7268' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="4" width="17" height="5" rx="1.6" />
      <path d="M5.5 9v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9" />
      <path d="M10 13.5h4" />
    </svg>
  );
}

export function 问号图标({ 尺寸 = 21, 色 = '#6f7268' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.4" />
      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2-2.4 3.4" />
      <path d="M12 17.2h.01" />
    </svg>
  );
}

/** A18「直接聊」按钮里的人像 */
export function 小人像图标({ 尺寸 = 15, 色 = '#3f4536' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function GitHub图标({ 尺寸 = 17, 色 = '#fff' }: 图标属性) {
  return (
    <svg width={尺寸} height={尺寸} viewBox="0 0 24 24" fill={色} aria-hidden>
      <path d="M12 2C6.5 2 2 6.6 2 12.3c0 4.6 2.9 8.4 6.8 9.8.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 2.9.9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5.1 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 4-2.4 4.8-4.6 5.1.4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5 4-1.4 6.8-5.2 6.8-9.8C22 6.6 17.5 2 12 2Z" />
    </svg>
  );
}

/** 小尺寸对勾（已换电话 / 已发简历） */
export function 细对勾图标({ 尺寸 = 12, 色 = '#7fa317' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 12.5 5 5L19.5 8" />
    </svg>
  );
}
