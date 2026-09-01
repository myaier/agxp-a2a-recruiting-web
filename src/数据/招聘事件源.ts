// P7 Task 5：同源事件源 adapter —— 连接 ws(s)://<当前 host>/api/v1/events/live，
// 不传 token、role、subject、conversation query 或任何自定义身份 header
// （会话由 HttpOnly cookie 携带）。帧不携带真相：这里只做严格解码与连接生命周期
// （指数退避 1s→2s→…→30s 封顶，重连成功归一），绝不把帧内容写进消息/未读/上下文
// 状态 —— 真相一律由调用方（use真人会话事件）以 no-store HTTP 重拉恢复。
// 畸形帧（非 JSON / 多键 / 未知事件词 / 非法坐标）静默忽略，不关闭健康连接。

/** 帧解出的内容无关事件（camelCase 领域类型；wire 的 snake_case 只在本模块出现）。 */
export interface P7变更事件 {
  type: 'recruitment.conversation_changed';
  conversationId: string;
  reason: 'message_created';
}

export interface 招聘事件源 {
  /** 挂上事件回调并开始连接；返回 disposer —— 关闭 socket 并取消重连定时。 */
  连接(handlers: {
    onEvent(event: P7变更事件): void;
    onOpen(): void;
  }): () => void;
}

/** 发布坐标的十进制闭合模式（与 真人会话.ts 同款，1–64 位）。 */
const 坐标模式 = /^[1-9][0-9]{0,63}$/;

/**
 * 严格帧解码：只接受 exact keys {type, conversation_id, reason} + 闭合枚举 +
 * canonical 十进制坐标；其余（含非字符串 data）一律 null（静默忽略）。
 */
export function 解帧(data: unknown): P7变更事件 | null {
  if (typeof data !== 'string') return null;
  let 解析: unknown;
  try {
    解析 = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof 解析 !== 'object' || 解析 === null || Array.isArray(解析)) return null;
  const 帧 = 解析 as Record<string, unknown>;
  if (Object.keys(帧).length !== 3) return null;
  if (帧.type !== 'recruitment.conversation_changed') return null;
  if (帧.reason !== 'message_created') return null;
  if (typeof 帧.conversation_id !== 'string' || !坐标模式.test(帧.conversation_id)) return null;
  return {
    type: 'recruitment.conversation_changed',
    conversationId: 帧.conversation_id,
    reason: 'message_created',
  };
}

/** 事件 URL：同源（协议随页面），路径固定，无 query。 */
function 事件URL(): string {
  const 协议 = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${协议}//${location.host}/api/v1/events/live`;
}

const 退避起步毫秒 = 1000;
const 退避封顶毫秒 = 30000;

/**
 * 创建事件源。WebSocket 构造器可注入（测试用受控假实现）；缺省用全局 WebSocket。
 * 断开即按指数退避重连；onOpen 在每次成功建立（含重连）时各回调一次。
 */
export function 创建招聘事件源(依赖: { WebSocket构造器?: typeof WebSocket } = {}): 招聘事件源 {
  const 构造器 = 依赖.WebSocket构造器 ?? globalThis.WebSocket;
  return {
    连接({ onEvent, onOpen }) {
      let 已关闭 = false;
      let 套接字: WebSocket | null = null;
      let 重连定时: ReturnType<typeof setTimeout> | null = null;
      let 退避毫秒 = 退避起步毫秒;

      const 打开 = () => {
        if (已关闭) return;
        const 活套接字 = new 构造器(事件URL()) as WebSocket;
        套接字 = 活套接字;
        活套接字.onopen = () => {
          退避毫秒 = 退避起步毫秒; // 成功（重）连后从头退避
          onOpen();
        };
        活套接字.onmessage = (事件: MessageEvent) => {
          const 帧 = 解帧((事件 as MessageEvent<unknown>).data);
          if (帧 !== null) onEvent(帧); // 畸形帧静默忽略，不关闭健康连接
        };
        活套接字.onclose = () => {
          if (已关闭) return;
          重连定时 = setTimeout(打开, 退避毫秒);
          退避毫秒 = Math.min(退避毫秒 * 2, 退避封顶毫秒);
        };
        // onerror 不单独处理：浏览器总是随后触发 close，重连归 close 统一管。
        活套接字.onerror = null;
      };

      打开();
      return () => {
        已关闭 = true;
        if (重连定时 !== null) clearTimeout(重连定时);
        重连定时 = null;
        套接字?.close();
        套接字 = null;
      };
    },
  };
}