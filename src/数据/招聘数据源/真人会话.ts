// 真人会话域数据源：BFF /api/v1 的 P7 双端（候选 me / 招聘 recruiter）conversations ——
// 收件箱分页、会话详情、消息分页、纯文本发送与 forward-only 已读。第十二个域 facade：
// 协议代码（path / method / body / 调用方幂等键 / GET 不缓存）按已准入 P7 冻结契约实现。
// 每个响应先 strict decode（exact key set、闭合 enum、坐标十进制模式、RFC3339、
// unread_count 安全非负整数、context_status↔context 联合不变式、消息 user_text 与
// conversation_started 两分支、消息页只认 messages 键、同页重复坐标拒绝），不 `as` 直转；
// 接口失败绝不回退 Mock。role 只决定闭合的 /me 与 /recruiter 前缀，永不进 body/query。

import { BFF错误 } from '../HTTP客户端';
import type { BFF客户端 } from '../HTTP客户端';
import type { P7角色 } from '../BFF契约';

export type { P7角色 } from '../BFF契约';

const P7前缀 = { candidate: '/api/v1/me', recruiter: '/api/v1/recruiter' } as const;
const 游标模式 = /^[A-Za-z0-9_-]+$/;
/** 发布坐标的闭合模式（与后端 OpenAPI 声明一致）：非零开头的十进制，1–64 位。 */
const 坐标模式 = /^[1-9][0-9]{0,63}$/;
/** 发送正文 trim 后的 Unicode code point 上限；计数必须用 Array.from，不用 UTF-16 length。 */
const 正文码点上限 = 2000;

function 契约错误(message = '服务返回了不符合契约的真人会话数据'): BFF错误 {
  return new BFF错误(200, 'invalid_response', message);
}

// ── 本域小 guard：与 MatchCase.ts / 发现推荐.ts 同一闭合纪律；本域统一 status=200 的 invalid_response ──

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：缺必需键或多出未知键（可选键仅按白名单放行）都按契约漂移 fail closed。 */
function 要求闭合对象(
  input: unknown,
  必需键: readonly string[],
  可选键: readonly string[] = [],
): Record<string, unknown> {
  if (!是记录(input)) throw 契约错误();
  for (const 键 of 必需键) if (!(键 in input)) throw 契约错误();
  const 允许键 = new Set([...必需键, ...可选键]);
  for (const 键 of Object.keys(input)) if (!允许键.has(键)) throw 契约错误();
  return input;
}

function 要求字符串(值: unknown): string {
  if (typeof 值 !== 'string') throw 契约错误();
  return 值;
}

function 要求非空字符串(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (字符串.length === 0) throw 契约错误();
  return 字符串;
}

/** OpenAPI 声明了 pattern 的响应坐标：非空且形状匹配，二者缺一即契约漂移。 */
function 要求模式串(值: unknown, 模式: RegExp): string {
  const 字符串 = 要求非空字符串(值);
  if (!模式.test(字符串)) throw 契约错误();
  return 字符串;
}

function 要求数组(值: unknown): unknown[] {
  if (!Array.isArray(值)) throw 契约错误();
  return 值;
}

function 要求枚举<T extends string>(值: unknown, 取值: readonly T[]): T {
  if (typeof 值 !== 'string') throw 契约错误();
  for (const 候选 of 取值) if (候选 === 值) return 候选;
  throw 契约错误();
}

/** unread_count：OpenAPI integer minimum 0；非安全整数或负数都是契约漂移。 */
function 要求安全非负整数(值: unknown): number {
  if (typeof 值 !== 'number' || !Number.isSafeInteger(值) || 值 < 0) throw 契约错误();
  return 值;
}

const RFC3339模式 = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

/** 时间戳按 OpenAPI 声明为 RFC 3339 UTC；形状或可解析性不对都拒绝。 */
function 要求RFC3339(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (!RFC3339模式.test(字符串) || Number.isNaN(Date.parse(字符串))) throw 契约错误();
  return 字符串;
}

/** 响应 cursor 恰为 string | null：缺键、坏类型、空、超 4096 或坏形状都是契约漂移。 */
function 解下一游标(值: unknown): string | null {
  if (值 === null) return null;
  if (typeof 值 !== 'string' || 值.length === 0 || 值.length > 4096 || !游标模式.test(值)) {
    throw 契约错误();
  }
  return 值;
}

/** 调用方 cursor 在任何 fetch 前校验：非空 base64url 字符串且 ≤4096，非法即抛、零请求。 */
function 校验调用方游标(cursor: string): string {
  if (typeof cursor !== 'string' || cursor.length === 0 || cursor.length > 4096 || !游标模式.test(cursor)) {
    throw new BFF错误(0, 'invalid_request', 'cursor 需为非空 base64url 且不超过 4096 字节');
  }
  return cursor;
}

/** 调用方会话/消息坐标在任何 fetch 前校验：必须匹配发布的十进制模式，非法即抛、零请求。 */
function 校验坐标(值: string, 名: '会话 ID' | '消息 ID'): string {
  if (typeof 值 !== 'string' || !坐标模式.test(值)) {
    throw new BFF错误(0, 'invalid_request', `${名}需为规范十进制坐标`);
  }
  return 值;
}

// ── 归一化 DTO：camelCase 领域类型；wire 的 snake_case 只在本模块出现一次 ──

export interface P7会话上下文 {
  primaryLabel: string;
  secondaryLabel: string;
  jobRef: string | null;
  resumeRef: string | null;
}

export interface P7消息预览 {
  messageId: string;
  senderRole: P7角色;
  preview: string;
  createdAt: string;
}

export interface P7会话项 {
  conversationId: string;
  caseId: string;
  kind: 'human_handoff';
  lastMessage: P7消息预览 | null;
  lastActivityAt: string;
  unreadCount: number;
  contextStatus: 'available' | 'unavailable';
  context: P7会话上下文 | null;
}

export type P7消息 =
  | {
      messageId: string;
      kind: 'user_text';
      senderRole: P7角色;
      content: string;
      createdAt: string;
    }
  | {
      messageId: `system:${string}`;
      kind: 'conversation_started';
      senderRole: 'system';
      createdAt: string;
    };

export interface P7会话页 { items: P7会话项[]; nextCursor: string | null }
export interface P7消息页 { messages: P7消息[]; nextCursor: string | null }

// ── 具体 decoder：逐字段过 guard，不做 `as` 直转 ──

const 角色全表 = ['candidate', 'recruiter'] as const satisfies readonly P7角色[];

/** viewer-safe 上下文投影：缺席的可选 ref 归一为 null；标签是后端给的展示值。 */
function 解会话上下文(input: unknown): P7会话上下文 {
  const raw = 要求闭合对象(input, ['primary_label', 'secondary_label'], ['job_ref', 'resume_ref']);
  return {
    primaryLabel: 要求字符串(raw.primary_label),
    secondaryLabel: 要求字符串(raw.secondary_label),
    jobRef: raw.job_ref === undefined ? null : 要求非空字符串(raw.job_ref),
    resumeRef: raw.resume_ref === undefined ? null : 要求非空字符串(raw.resume_ref),
  };
}

/** last_message 预览：作者只能是 candidate/recruiter，system 不进收件箱摘要。 */
function 解消息预览(input: unknown): P7消息预览 {
  const raw = 要求闭合对象(input, ['message_id', 'sender_role', 'preview', 'created_at']);
  return {
    messageId: 要求模式串(raw.message_id, 坐标模式),
    senderRole: 要求枚举(raw.sender_role, 角色全表),
    preview: 要求字符串(raw.preview),
    createdAt: 要求RFC3339(raw.created_at),
  };
}

/**
 * 解会话项：available 必须携带非空 context，unavailable 必须缺席或 null；
 * unread_count 是安全非负整数（0 就是已读）；kind 只有 human_handoff。
 */
export function 解会话项(input: unknown): P7会话项 {
  const raw = 要求闭合对象(
    input,
    ['conversation_id', 'case_id', 'kind', 'last_message', 'last_activity_at', 'unread_count', 'context_status'],
    ['context'],
  );
  const contextStatus = 要求枚举(raw.context_status, ['available', 'unavailable'] as const);
  // 联合不变式：available 必须携带非空 context；unavailable 只接受缺席或 null（OpenAPI oneOf）。
  const context = raw.context === undefined || raw.context === null ? null : 解会话上下文(raw.context);
  if (contextStatus === 'available' && context === null) throw 契约错误();
  if (contextStatus === 'unavailable' && context !== null) throw 契约错误();
  return {
    conversationId: 要求模式串(raw.conversation_id, 坐标模式),
    caseId: 要求非空字符串(raw.case_id),
    kind: 要求枚举(raw.kind, ['human_handoff'] as const),
    lastMessage: raw.last_message === null ? null : 解消息预览(raw.last_message),
    lastActivityAt: 要求RFC3339(raw.last_activity_at),
    unreadCount: 要求安全非负整数(raw.unread_count),
    contextStatus,
    context,
  };
}

export function 解会话页(input: unknown): P7会话页 {
  const raw = 要求闭合对象(input, ['items', 'next_cursor']);
  const items = 要求数组(raw.items).map(解会话项);
  const 已见 = new Set<string>();
  for (const 项 of items) {
    if (已见.has(项.conversationId)) throw 契约错误();
    已见.add(项.conversationId);
  }
  return { items, nextCursor: 解下一游标(raw.next_cursor) };
}

/**
 * 解消息：user_text 必须有 content、decimal 坐标与 candidate/recruiter 作者；
 * conversation_started 固定 system:<当前会话坐标>、sender=system 且无 content（跨分支字段即漂移）。
 */
export function 解消息(conversationId: string, input: unknown): P7消息 {
  const raw = 要求闭合对象(input, ['message_id', 'kind', 'sender_role', 'created_at'], ['content']);
  const kind = 要求枚举(raw.kind, ['user_text', 'conversation_started'] as const);
  const createdAt = 要求RFC3339(raw.created_at);
  if (kind === 'conversation_started') {
    if (raw.content !== undefined) throw 契约错误();
    要求枚举(raw.sender_role, ['system'] as const);
    const messageId = 要求非空字符串(raw.message_id);
    if (messageId !== `system:${conversationId}`) throw 契约错误();
    return {
      messageId: messageId as `system:${string}`,
      kind,
      senderRole: 'system',
      createdAt,
    };
  }
  if (raw.content === undefined || raw.content === null) throw 契约错误();
  return {
    messageId: 要求模式串(raw.message_id, 坐标模式),
    kind,
    senderRole: 要求枚举(raw.sender_role, 角色全表),
    content: 要求字符串(raw.content),
    createdAt,
  };
}

/** 消息分页读实际实现的 { messages, next_cursor }：items 键即漂移；同页重复坐标拒绝。 */
export function 解消息页(conversationId: string, input: unknown): P7消息页 {
  const raw = 要求闭合对象(input, ['messages', 'next_cursor']);
  const messages = 要求数组(raw.messages).map((行) => 解消息(conversationId, 行));
  const 已见 = new Set<string>();
  for (const 行 of messages) {
    if (已见.has(行.messageId)) throw 契约错误();
    已见.add(行.messageId);
  }
  return { messages, nextCursor: 解下一游标(raw.next_cursor) };
}

/** 已读回执：echo 的 read_through_message_id 必须仍是规范十进制坐标。 */
function 解已读回执(input: unknown): string {
  const raw = 要求闭合对象(input, ['read_through_message_id']);
  return 要求模式串(raw.read_through_message_id, 坐标模式);
}

// ── 数据源：role 只进闭合前缀表；所有 GET 不缓存；发送带调用方幂等键 ──

export interface 真人会话数据源 {
  读取会话列表(role: P7角色, cursor?: string): Promise<P7会话页>;
  读取会话(role: P7角色, conversationId: string): Promise<P7会话项>;
  读取消息(role: P7角色, conversationId: string, cursor?: string): Promise<P7消息页>;
  发送消息(role: P7角色, conversationId: string, content: string, key: string): Promise<P7消息>;
  标为已读(role: P7角色, conversationId: string, messageId: string): Promise<string>;
}

function P7路径(role: P7角色, suffix: string): `/api/v1/${string}` {
  return `${P7前缀[role]}${suffix}` as `/api/v1/${string}`;
}

/** trim 后 1–2000 Unicode code point；用 Array.from 计数，不用 UTF-16 string.length。 */
function 校验正文(content: string): string {
  const 正文 = typeof content === 'string' ? content.trim() : '';
  const 码点 = Array.from(正文).length;
  if (码点 < 1 || 码点 > 正文码点上限) {
    throw new BFF错误(0, 'invalid_request', `消息需要 1 到 ${正文码点上限} 个字符`);
  }
  return 正文;
}

export function 创建真人会话数据源(请求: BFF客户端['请求']): 真人会话数据源 {
  async function 读取会话列表(role: P7角色, cursor?: string): Promise<P7会话页> {
    const query = cursor === undefined ? '' : `?cursor=${encodeURIComponent(校验调用方游标(cursor))}`;
    const { result } = await 请求<unknown>({
      path: P7路径(role, `/conversations${query}`),
      不缓存: true,
    });
    return 解会话页(result);
  }

  async function 读取会话(role: P7角色, conversationId: string): Promise<P7会话项> {
    const id = 校验坐标(conversationId, '会话 ID');
    const { result } = await 请求<unknown>({
      path: P7路径(role, `/conversations/${encodeURIComponent(id)}`),
      不缓存: true,
    });
    return 解会话项(result);
  }

  async function 读取消息(role: P7角色, conversationId: string, cursor?: string): Promise<P7消息页> {
    const id = 校验坐标(conversationId, '会话 ID');
    const query = cursor === undefined ? '' : `?cursor=${encodeURIComponent(校验调用方游标(cursor))}`;
    const { result } = await 请求<unknown>({
      path: P7路径(role, `/conversations/${encodeURIComponent(id)}/messages${query}`),
      不缓存: true,
    });
    return 解消息页(id, result);
  }

  async function 发送消息(role: P7角色, conversationId: string, content: string, key: string): Promise<P7消息> {
    const id = 校验坐标(conversationId, '会话 ID');
    const 正文 = 校验正文(content);
    const { result } = await 请求<unknown>({
      path: P7路径(role, `/conversations/${encodeURIComponent(id)}/messages`),
      method: 'POST',
      body: { content: 正文 },
      幂等: true,
      幂等键: key,
    });
    return 解消息(id, result);
  }

  async function 标为已读(role: P7角色, conversationId: string, messageId: string): Promise<string> {
    const id = 校验坐标(conversationId, '会话 ID');
    const target = 校验坐标(messageId, '消息 ID');
    const { result } = await 请求<unknown>({
      path: P7路径(role, `/conversations/${encodeURIComponent(id)}/read`),
      method: 'PUT',
      body: { read_through_message_id: target },
    });
    return 解已读回执(result);
  }

  return { 读取会话列表, 读取会话, 读取消息, 发送消息, 标为已读 };
}