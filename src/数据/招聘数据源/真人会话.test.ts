// 真人会话域数据源测试：冻结 P7 双端每个 browser call 的 method/path/query/body/幂等键
// （GET 全部 不缓存: true，mutation 只带 幂等+幂等键，已读 PUT 不带幂等），并锁定 strict
// decode（exact key set、闭合 enum、坐标十进制模式、RFC3339、安全非负 unread、
// context_status↔context 联合不变式、消息 user_text/conversation_started 两分支、
// 消息页只认 messages 键、同页重复坐标拒绝）。发送正文 trim 后按 Unicode code point
// 计 1–2000，UTF-16 string.length 冒充码点数的实现会被 2000 emoji 用例击穿。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { BFF已读回执, BFF会话项, BFF会话消息 } from '../BFF契约';
import {
  创建真人会话数据源,
  解会话页,
  解会话项,
  解消息页,
  type 真人会话数据源,
} from './真人会话';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

function 响应<T>(result: T): BFF响应<T> {
  return { result, etag: null, requestId: 'fixture-request' };
}

const 契约漂移 = '服务返回了不符合契约的真人会话数据';

const 可用上下文Wire = {
  primary_label: '后端工程师',
  secondary_label: '上海·浦东',
  job_ref: 'job_00112233445566778899aabbccddeeff',
  resume_ref: 'rf_00112233445566778899aabbccddeeff',
};

const 可用会话Wire: BFF会话项 = {
  conversation_id: '3003',
  case_id: 'mc_3003',
  kind: 'human_handoff',
  last_message: {
    message_id: '4004',
    sender_role: 'candidate',
    preview: '你好，想约个时间聊聊',
    created_at: '2026-08-30T01:00:00Z',
  },
  last_activity_at: '2026-08-30T01:00:00Z',
  unread_count: 0,
  context_status: 'available',
  context: 可用上下文Wire,
};

const 文本消息Wire: BFF会话消息 = {
  message_id: '4004',
  kind: 'user_text',
  sender_role: 'candidate',
  content: '你好，想约个时间聊聊',
  created_at: '2026-08-30T01:00:00Z',
};

const 系统行Wire: BFF会话消息 = {
  message_id: 'system:3003',
  kind: 'conversation_started',
  sender_role: 'system',
  created_at: '2026-08-30T00:00:00Z',
};

describe('真人会话数据源', () => {
  let 请求Mock: ReturnType<typeof vi.fn>;
  let source: 真人会话数据源;

  beforeEach(() => {
    请求Mock = vi.fn();
    source = 创建真人会话数据源(请求Mock as unknown as 请求函数);
  });

  // ── 请求形状：role 只决定闭合前缀，永不进 body/query ──

  it('列表/详情/消息 GET 全部 no-store，双端前缀闭合，cursor 只编码一次', async () => {
    请求Mock
      .mockResolvedValueOnce(响应({ items: [可用会话Wire], next_cursor: 'Pg2_1' }))
      .mockResolvedValueOnce(响应({ items: [], next_cursor: null }))
      .mockResolvedValueOnce(响应(可用会话Wire))
      .mockResolvedValueOnce(响应(可用会话Wire))
      .mockResolvedValueOnce(响应({ messages: [], next_cursor: null }))
      .mockResolvedValueOnce(响应({ messages: [系统行Wire, 文本消息Wire], next_cursor: null }));
    const 首页 = await source.读取会话列表('candidate');
    const 次页 = await source.读取会话列表('candidate', 'Pg2_1');
    const 详情 = await source.读取会话('recruiter', '3003');
    await source.读取会话('candidate', '3003');
    await source.读取消息('candidate', '3003');
    const 消息页 = await source.读取消息('candidate', '3003', 'older_1');
    expect(首页).toMatchObject({ items: [{ conversationId: '3003' }], nextCursor: 'Pg2_1' });
    expect(次页).toEqual({ items: [], nextCursor: null });
    expect(详情).toMatchObject({ conversationId: '3003', contextStatus: 'available' });
    expect(消息页.messages).toHaveLength(2);
    // 每个 GET 选项恰为 { path, 不缓存 }：role 不进 query，路径片段编码一次。
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: '/api/v1/me/conversations', 不缓存: true },
      { path: '/api/v1/me/conversations?cursor=Pg2_1', 不缓存: true },
      { path: '/api/v1/recruiter/conversations/3003', 不缓存: true },
      { path: '/api/v1/me/conversations/3003', 不缓存: true },
      { path: '/api/v1/me/conversations/3003/messages', 不缓存: true },
      { path: '/api/v1/me/conversations/3003/messages?cursor=older_1', 不缓存: true },
    ]);
  });

  it('发送 POST 只带 trim 后正文与调用方幂等键，回包按消息分支解码', async () => {
    请求Mock.mockResolvedValueOnce(响应(文本消息Wire));
    const 发出 = await source.发送消息('recruiter', '3003', '  你好  ', 'p7-send-key-0001');
    expect(发出).toEqual({
      messageId: '4004',
      kind: 'user_text',
      senderRole: 'candidate',
      content: '你好，想约个时间聊聊',
      createdAt: '2026-08-30T01:00:00Z',
    });
    expect(请求Mock).toHaveBeenCalledTimes(1);
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/recruiter/conversations/3003/messages',
      method: 'POST',
      body: { content: '你好' },
      幂等: true,
      幂等键: 'p7-send-key-0001',
    });
  });

  it('已读 PUT 只带 read_through_message_id，回执坐标原样透传', async () => {
    请求Mock.mockResolvedValueOnce(响应({ read_through_message_id: '4004' } satisfies BFF已读回执));
    await expect(source.标为已读('candidate', '3003', '4004')).resolves.toBe('4004');
    expect(请求Mock).toHaveBeenCalledTimes(1);
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/me/conversations/3003/read',
      method: 'PUT',
      body: { read_through_message_id: '4004' },
    });
  });

  it('发送正文按 Unicode code point 计 1–2000：2000 emoji 合法，空白与超长拒绝且零请求', async () => {
    请求Mock.mockResolvedValue(响应(文本消息Wire));
    // 2000 个 emoji 是 2000 个 code point、4000 个 UTF-16 单位：string.length 实现会误拒。
    await expect(source.发送消息('candidate', '3003', '😀'.repeat(2000), 'p7-send-key-0002'))
      .resolves.toBeDefined();
    for (const 正文 of ['', '   ', '你'.repeat(2001), '😀'.repeat(2001)]) {
      请求Mock.mockClear();
      await expect(source.发送消息('candidate', '3003', 正文, 'p7-send-key-0003'))
        .rejects.toMatchObject({ code: 'invalid_request' });
      expect(请求Mock).not.toHaveBeenCalled();
    }
  });

  it('非规范会话/消息坐标与空 cursor 在任何 fetch 前拒绝', async () => {
    for (const 坏ID of ['', '03003', '3003x', '3'.repeat(65), 7 as unknown as string]) {
      请求Mock.mockClear();
      await expect(source.读取会话('candidate', 坏ID)).rejects.toMatchObject({ code: 'invalid_request' });
      await expect(source.读取消息('candidate', 坏ID)).rejects.toMatchObject({ code: 'invalid_request' });
      await expect(source.发送消息('candidate', 坏ID, '你好', 'p7-send-key-0004'))
        .rejects.toMatchObject({ code: 'invalid_request' });
      await expect(source.标为已读('candidate', 坏ID, '4004'))
        .rejects.toMatchObject({ code: 'invalid_request' });
      expect(请求Mock).not.toHaveBeenCalled();
    }
    请求Mock.mockClear();
    await expect(source.读取消息('candidate', '3003', '')).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(source.读取会话列表('candidate', '')).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(source.标为已读('candidate', '3003', '04004'))
      .rejects.toMatchObject({ code: 'invalid_request' });
    expect(请求Mock).not.toHaveBeenCalled();
  });

  it('已读回执缺键/多键/非规范坐标都按契约漂移拒绝', async () => {
    请求Mock
      .mockResolvedValueOnce(响应({ read_through_message_id: '04004' }))
      .mockResolvedValueOnce(响应({ read_through_message_id: '4004', extra: 1 }))
      .mockResolvedValueOnce(响应(null))
      .mockResolvedValueOnce(响应({}));
    for (let 第次 = 0; 第次 < 4; 第次 += 1) {
      await expect(source.标为已读('candidate', '3003', '4004'))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
  });

  it('发送回包 kind 与 sender 组合漂移按 invalid_response 拒绝', async () => {
    请求Mock.mockResolvedValueOnce(响应({ ...文本消息Wire, sender_role: 'system' }));
    await expect(source.发送消息('candidate', '3003', '你好', 'p7-send-key-0005'))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  // ── strict decode ──

  it('解会话页 接受 available 上下文，缺席 job_ref/resume_ref 归一为 null', () => {
    const 页 = 解会话页({ items: [可用会话Wire], next_cursor: null });
    expect(页.items[0]).toMatchObject({
      conversationId: '3003',
      caseId: 'mc_3003',
      kind: 'human_handoff',
      unreadCount: 0,
      contextStatus: 'available',
      context: {
        primaryLabel: '后端工程师',
        secondaryLabel: '上海·浦东',
        jobRef: 'job_00112233445566778899aabbccddeeff',
        resumeRef: 'rf_00112233445566778899aabbccddeeff',
      },
    });
    const 无ref = 解会话项({
      ...可用会话Wire,
      context: { primary_label: '后端工程师', secondary_label: '上海·浦东' },
    });
    expect(无ref.context).toMatchObject({ jobRef: null, resumeRef: null });
  });

  it('解会话页 接受 unavailable（context 缺席或 null）、last_message=null 与稀疏页', () => {
    const 无context: BFF会话项 = { ...可用会话Wire, context_status: 'unavailable' };
    delete 无context.context;
    expect(解会话项(无context)).toMatchObject({ contextStatus: 'unavailable', context: null });
    expect(解会话项({ ...可用会话Wire, context_status: 'unavailable', context: null }))
      .toMatchObject({ context: null });
    expect(解会话项({ ...可用会话Wire, last_message: null }).lastMessage).toBeNull();
    expect(解会话页({ items: [], next_cursor: 'Pg2_1' })).toEqual({ items: [], nextCursor: 'Pg2_1' });
  });

  it('会话 decode 拒绝缺键/多键/坏时间/不安全或负 unread/非规范坐标/预览 system 角色', () => {
    const 破 = (变异: Record<string, unknown>) => ({ ...可用会话Wire, ...变异 });
    expect(() => 解会话项({ ...可用会话Wire, 未知键: 1 })).toThrow(契约漂移);
    const { last_activity_at: _缺, ...缺时间 } = 可用会话Wire;
    expect(() => 解会话项(缺时间)).toThrow(契约漂移);
    expect(() => 解会话项(破({ last_activity_at: '2026-08-30' }))).toThrow(契约漂移);
    expect(() => 解会话项(破({ unread_count: -1 }))).toThrow(契约漂移);
    expect(() => 解会话项(破({ unread_count: Number.MAX_SAFE_INTEGER + 1 }))).toThrow(契约漂移);
    expect(() => 解会话项(破({ unread_count: 1.5 }))).toThrow(契约漂移);
    expect(() => 解会话项(破({ conversation_id: '03003' }))).toThrow(契约漂移);
    expect(() => 解会话项(破({ conversation_id: '3'.repeat(65) }))).toThrow(契约漂移);
    expect(() => 解会话项(破({ case_id: '' }))).toThrow(契约漂移);
    expect(() => 解会话项(破({ kind: 'direct_chat' }))).toThrow(契约漂移);
    expect(() => 解会话项(破({ last_message: { ...可用会话Wire.last_message, sender_role: 'system' } })))
      .toThrow(契约漂移);
    expect(() => 解会话项(破({ context_status: 'available', context: null }))).toThrow(契约漂移);
    expect(() => 解会话项({ ...可用会话Wire, context_status: 'unavailable', context: 可用上下文Wire }))
      .toThrow(契约漂移);
    expect(() => 解会话页({ items: [可用会话Wire], next_cursor: '' })).toThrow(契约漂移);
    // 64 位坐标仍合法：模式上界是 64 位，65 位才是漂移。
    expect(解会话项(破({ conversation_id: '3'.repeat(64) })).conversationId).toBe('3'.repeat(64));
  });

  it('同一页重复会话坐标按契约漂移拒绝，不静默去重', () => {
    expect(() => 解会话页({ items: [可用会话Wire, 可用会话Wire], next_cursor: null }))
      .toThrow(契约漂移);
  });

  it('解消息页 只认 messages 键，items 是漂移；接受两分支并保留服务端顺序', () => {
    expect(() => 解消息页('3003', { items: [], next_cursor: null })).toThrow(契约漂移);
    expect(解消息页('3003', { messages: [], next_cursor: null })).toEqual({
      messages: [],
      nextCursor: null,
    });
    const 招聘侧消息 = { ...文本消息Wire, message_id: '4005', sender_role: 'recruiter', content: '好的' };
    const 页 = 解消息页('3003', {
      messages: [系统行Wire, 文本消息Wire, 招聘侧消息],
      next_cursor: 'older_1',
    });
    expect(页).toEqual({
      messages: [
        { messageId: 'system:3003', kind: 'conversation_started', senderRole: 'system', createdAt: '2026-08-30T00:00:00Z' },
        { messageId: '4004', kind: 'user_text', senderRole: 'candidate', content: '你好，想约个时间聊聊', createdAt: '2026-08-30T01:00:00Z' },
        { messageId: '4005', kind: 'user_text', senderRole: 'recruiter', content: '好的', createdAt: '2026-08-30T01:00:00Z' },
      ],
      nextCursor: 'older_1',
    });
  });

  it('消息 decode 拒绝跨分支字段、user_text 缺 content、system 行坐标漂移、重复 ID', () => {
    expect(() => 解消息页('3003', { messages: [{ ...系统行Wire, content: '你好' }], next_cursor: null }))
      .toThrow(契约漂移);
    const { content: _无内容, ...缺content } = 文本消息Wire;
    expect(() => 解消息页('3003', { messages: [缺content], next_cursor: null })).toThrow(契约漂移);
    expect(() => 解消息页('3003', { messages: [{ ...文本消息Wire, content: null }], next_cursor: null }))
      .toThrow(契约漂移);
    expect(() => 解消息页('3003', { messages: [{ ...文本消息Wire, sender_role: 'system' }], next_cursor: null }))
      .toThrow(契约漂移);
    expect(() => 解消息页('3003', { messages: [{ ...系统行Wire, message_id: 'system:3004' }], next_cursor: null }))
      .toThrow(契约漂移);
    expect(() => 解消息页('3003', { messages: [文本消息Wire, 文本消息Wire], next_cursor: null }))
      .toThrow(契约漂移);
    expect(() => 解消息页('3003', { messages: [{ ...文本消息Wire, message_id: '04004' }], next_cursor: null }))
      .toThrow(契约漂移);
    expect(() => 解消息页('3003', { messages: [{ ...文本消息Wire, message_id: '4'.repeat(65) }], next_cursor: null }))
      .toThrow(契约漂移);
    expect(() => 解消息页('3003', { messages: [{ ...文本消息Wire, created_at: '昨天' }], next_cursor: null }))
      .toThrow(契约漂移);
    expect(() => 解消息页('3003', { messages: [文本消息Wire], next_cursor: 'bad/cursor+eq=' }))
      .toThrow(契约漂移);
  });
});