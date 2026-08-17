// 原生能力桥 —— 方案第 3 节「明确技术边界」的落地。
//
// 三条约束，写在这里是为了后面没人能绕过去：
//   1. **白名单**：Web 层只能调用下面 原生能力 接口里列出的方法。
//      不允许 Web 任意调原生代码，也不允许把业务逻辑复制到两端。
//   2. **明确的数据结构**：每个能力的入参和返回值都有类型，不用 any、不传裸对象。
//   3. **版本号协商**：Web 层带 桥版本 请求，原生壳比对自己支持的区间，
//      不匹配时走降级而不是崩溃。
//
// 当前没有装 Capacitor，所以这里只有 Web 兜底实现。接壳时新增一个
// Capacitor 实现并在 取原生能力() 里按运行环境选择，屏幕代码零改动。

/** Bridge 协议版本。原生壳升级能力时递增，Web 与原生各自声明支持区间。 */
export const 桥版本 = 1;

export interface 安全存储项 {
  键: string;
  值: string;
}

/** 白名单：Web 层能用的原生能力，仅此这些 */
export interface 原生能力 {
  /** 运行环境。Web 层用它决定要不要显示「请在 App 内打开」之类的提示 */
  取运行环境(): '浏览器' | 'iOS' | 'Android';

  /** 桥握手：返回原生壳支持的版本区间，不兼容时 Web 层降级 */
  握手(): Promise<{ 原生支持最低版本: number; 原生支持最高版本: number; 兼容: boolean }>;

  /** 安全存储（Keychain / Keystore）。登录态、令牌只能放这里，不许进 localStorage */
  安全存储读(键: string): Promise<string | null>;
  安全存储写(项: 安全存储项): Promise<void>;
  安全存储删(键: string): Promise<void>;

  /** 系统分享 */
  系统分享(内容: { 标题: string; 文本: string; 链接?: string }): Promise<void>;

  /** 选取简历附件（相册 / 文件）。返回文件名与 base64，上传仍由 Web 层做 */
  选取附件(): Promise<{ 文件名: string; 类型: string; base64: string } | null>;

  /** 推送授权状态（不在这里做业务判断，只回报状态） */
  取推送授权(): Promise<'已授权' | '已拒绝' | '未询问'>;
}

/** 浏览器兜底实现：能做的用 Web API，做不到的显式拒绝，绝不假装成功 */
const 浏览器能力: 原生能力 = {
  取运行环境: () => '浏览器',

  async 握手() {
    // 纯浏览器环境没有原生壳，报不兼容，让 Web 层走降级分支
    return { 原生支持最低版本: 0, 原生支持最高版本: 0, 兼容: false };
  },

  // 浏览器里没有 Keychain。用 sessionStorage 只为原型能跑通登录态，
  // 且刻意不用 localStorage —— 避免让人误以为这是可以上生产的安全存储。
  async 安全存储读(键) {
    return sessionStorage.getItem(`桥:${键}`);
  },
  async 安全存储写({ 键, 值 }) {
    sessionStorage.setItem(`桥:${键}`, 值);
  },
  async 安全存储删(键) {
    sessionStorage.removeItem(`桥:${键}`);
  },

  async 系统分享(内容) {
    if (navigator.share) {
      await navigator.share({ title: 内容.标题, text: 内容.文本, url: 内容.链接 });
      return;
    }
    throw new Error('当前浏览器不支持系统分享');
  },

  async 选取附件() {
    // 浏览器里用 <input type=file>，由调用方自己渲染更合适；
    // 这里直接返回 null 表示「此环境不提供原生选取」，让 UI 走 Web 上传分支。
    return null;
  },

  async 取推送授权() {
    if (!('Notification' in window)) return '已拒绝';
    const 权限 = Notification.permission;
    return 权限 === 'granted' ? '已授权' : 权限 === 'denied' ? '已拒绝' : '未询问';
  },
};

/** 取当前环境的能力实现。接 Capacitor 后在这里加分支。 */
export function 取原生能力(): 原生能力 {
  return 浏览器能力;
}
