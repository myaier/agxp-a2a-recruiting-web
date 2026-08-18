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
  // 齿廓由 8 颗齿按 45° 等分算出来（外径 10 / 内径 7.3 / 齿顶半角 9°），
  // 所以左右上下必然对称 —— 原来那条是手写贝塞尔，齿距不匀，看着是歪的（标注 21:58）。
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.44 2.12 L13.56 2.12 L14.01 4.98 L15.54 5.62 L17.88 3.91 L20.09 6.12 L18.38 8.46 L19.02 9.99 L21.88 10.44 L21.88 13.56 L19.02 14.01 L18.38 15.54 L20.09 17.88 L17.88 20.09 L15.54 18.38 L14.01 19.02 L13.56 21.88 L10.44 21.88 L9.99 19.02 L8.46 18.38 L6.12 20.09 L3.91 17.88 L5.62 15.54 L4.98 14.01 L2.12 13.56 L2.12 10.44 L4.98 9.99 L5.62 8.46 L3.91 6.12 L6.12 3.91 L8.46 5.62 L9.99 4.98 Z" />
      <circle cx="12" cy="12" r="3.1" />
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

/** 身份切换：左边一个小人、右边一对反向箭头。
 *  原来只有两条箭头，看不出「换的是身份」（标注 21:58）—— 小人一放上去语义就落地了。 */
export function 身份切换图标({ 尺寸 = 23, 色 = '#3f4536' }: 图标属性) {
  return (
    <svg
      width={尺寸}
      height={尺寸}
      viewBox="0 0 24 24"
      fill="none"
      stroke={色}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* 小人：头 + 肩 */}
      <circle cx="7.2" cy="7" r="3" />
      <path d="M2.4 18.6c0-3 2.1-4.9 4.8-4.9s4.8 1.9 4.8 4.9" />
      {/* 一对反向箭头：上行向右、下行向左 */}
      <path d="M14.8 9.4h6.8" />
      <path d="M19.5 7.3 21.6 9.4 19.5 11.5" />
      <path d="M21.6 15.2h-6.8" />
      <path d="M16.9 13.1 14.8 15.2 16.9 17.3" />
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
