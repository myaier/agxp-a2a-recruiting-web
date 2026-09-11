// 消息列表展示契约（P1 Task 4）：Mock 双端与角色化 Backend P7 收件箱共用的
// 列表外壳 / 会话行 / 行映射数据类型。展示无 Context、无运行模式、无路由、
// 无请求、无业务派发 —— 页签/搜索状态、过滤、未读快照与回调全部由连接层给。

export type 消息页签 = '全部' | '仅会话' | '通知';

/** 未读标记三态：由连接侧映射（Mock undefined=已读 / 0=红点 / 正数=数字；Backend 0=无标记 / 正数=数字） */
export type 未读展示 = { 种类: '无' } | { 种类: '红点' } | { 种类: '数字'; 数量: number };

export interface 会话行数据 {
  键: string;
  标题: string;
  副标题: string;
  时间: string;
  摘要: string;
  /** Mock AI代理 → 代理标；真人/直聊与 Backend 中性「会」→ 字标（底色随数据） */
  头像: { 种类: '代理' } | { 种类: '字标'; 字: string; 底色: string };
  未读: 未读展示;
  /** 回归定位标识（Backend 保留 unread-${conversationId}；Mock 无此标识） */
  未读测试标识?: string;
  按下: () => void;
}

/** 状态区提示（错误/加载/空态/搜索无命中）：错误与缓存行可共存，操作回调在连接层 */
export interface 列表提示 {
  键: string;
  行们: string[];
  操作?: { 文案: string; 按下: () => void };
}

export interface 消息列表展示属性 {
  页签: 消息页签;
  改页签: (页签: 消息页签) => void;
  搜索词: string;
  改搜索词: (值: string) => void;
  搜索提示: string;
  前置提示: 列表提示[];
  行们: 会话行数据[];
  后置提示: 列表提示[];
  加载更多?: () => void;
}