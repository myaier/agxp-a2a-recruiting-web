// P7 Task 5：招聘事件源 adapter 的行为测试 —— 同源 /api/v1/events/live（不带
// token/query/自定义 header）、严格帧解码（exact keys + 闭合枚举 + canonical 坐标；
// 畸形 JSON / 多键 / 未知事件 / 非法坐标一律忽略且不关闭健康连接）、断开指数退避
// 1s→2s→…→30s 封顶、重连成功后退避归一、disposer 关闭 socket 并取消定时。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { 创建招聘事件源, 解帧, type 招聘事件源 } from './招聘事件源';

/** 受控假 WebSocket：记录构造 URL，帧/开/断都由测试主动触发。 */
class 假WebSocket {
  static 构造记录: string[] = [];
  static 实例表: 假WebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((事件: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  已关 = false;
  已通知关 = false;
  url: string;
  constructor(url: string) {
    this.url = url;
    假WebSocket.构造记录.push(url);
    假WebSocket.实例表.push(this);
  }
  close() {
    this.已关 = true;
    if (!this.已通知关) {
      this.已通知关 = true;
      this.onclose?.();
    }
  }
  模拟开() { this.onopen?.(); }
  模拟帧(数据: string) { this.onmessage?.({ data: 数据 }); }
  模拟断() { if (!this.已通知关) { this.已通知关 = true; this.onclose?.(); } }
  get 仍活() { return !this.已关; }
}

function 新事件源(): 招聘事件源 {
  return 创建招聘事件源({ WebSocket构造器: 假WebSocket as unknown as typeof WebSocket });
}

const 合法帧 = JSON.stringify({
  type: 'recruitment.conversation_changed', conversation_id: '3003', reason: 'message_created',
});

describe('招聘事件源', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    假WebSocket.构造记录 = [];
    假WebSocket.实例表 = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('连接同源 /api/v1/events/live，不带 token、query 或自定义身份 header', () => {
    const 事件: 招聘事件源[] = [];
    const 源 = 新事件源();
    事件.push(源);
    const 关闭 = 源.连接({ onEvent: vi.fn(), onOpen: vi.fn() });
    expect(假WebSocket.构造记录).toEqual([
      `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/v1/events/live`,
    ]);
    expect(假WebSocket.构造记录[0]).not.toContain('?');
    关闭();
  });

  it('严格帧解码：只接受 exact keys + 闭合枚举 + canonical 坐标', () => {
    const 帧 = (值: unknown) => 解帧(JSON.stringify(值));
    expect(帧({ type: 'recruitment.conversation_changed', conversation_id: '3003', reason: 'message_created' }))
      .toEqual({ type: 'recruitment.conversation_changed', conversationId: '3003', reason: 'message_created' });
    // 多键 / 缺键 / 未知事件词 / 未知 reason / 非法坐标 / 非 JSON → 一律 null
    expect(帧({ type: 'recruitment.conversation_changed', conversation_id: '3003', reason: 'message_created', extra: 1 })).toBeNull();
    expect(帧({ type: 'recruitment.conversation_changed', conversation_id: '3003' })).toBeNull();
    expect(帧({ type: 'other.event', conversation_id: '3003', reason: 'message_created' })).toBeNull();
    expect(帧({ type: 'recruitment.conversation_changed', conversation_id: '3003', reason: 'other_reason' })).toBeNull();
    expect(帧({ type: 'recruitment.conversation_changed', conversation_id: '03003', reason: 'message_created' })).toBeNull();
    expect(帧({ type: 'recruitment.conversation_changed', conversation_id: 3003, reason: 'message_created' })).toBeNull();
    expect(解帧('not-json')).toBeNull();
    expect(解帧('[1,2]')).toBeNull();
  });

  it('合法帧回调事件；畸形帧忽略且不关闭健康连接', () => {
    const 源 = 新事件源();
    const onEvent = vi.fn();
    源.连接({ onEvent, onOpen: vi.fn() });
    const 套接字 = 假WebSocket.实例表[0];
    套接字.模拟帧(合法帧);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'recruitment.conversation_changed', conversationId: '3003', reason: 'message_created',
    });
    套接字.模拟帧('not-json');
    套接字.模拟帧(JSON.stringify({ type: 'other.event', conversation_id: '3003', reason: 'x' }));
    套接字.模拟帧(JSON.stringify({ type: 'recruitment.conversation_changed', conversation_id: '3003', reason: 'message_created', extra: 1 }));
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(套接字.仍活).toBe(true);
  });

  it('断开按指数退避重连 1s→2s→4s，封顶 30s；重连成功后退避归一', () => {
    const 源 = 新事件源();
    const 关闭 = 源.连接({ onEvent: vi.fn(), onOpen: vi.fn() });
    假WebSocket.实例表[0].模拟断();
    expect(假WebSocket.构造记录).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(假WebSocket.构造记录).toHaveLength(2);
    假WebSocket.实例表[1].模拟断();
    vi.advanceTimersByTime(1000);
    expect(假WebSocket.构造记录).toHaveLength(2);
    vi.advanceTimersByTime(1000);
    expect(假WebSocket.构造记录).toHaveLength(3);
    // 第三次连接成功（onopen）后退避归一：下次断开只等 1s
    假WebSocket.实例表[2].模拟开();
    假WebSocket.实例表[2].模拟断();
    vi.advanceTimersByTime(1000);
    expect(假WebSocket.构造记录).toHaveLength(4);
    // 封顶 30s：反复断开足够多次后单步等待不超过 30s
    let 断数 = 0;
    while (断数 < 40) {
      const 当前 = 假WebSocket.实例表.at(-1);
      当前?.模拟断();
      断数 += 1;
      vi.advanceTimersByTime(30000);
    }
    expect(假WebSocket.构造记录.length).toBeGreaterThan(4);
    关闭();
  });

  it('disposer 关闭 socket 并取消重连定时', () => {
    const 源 = 新事件源();
    const 关闭 = 源.连接({ onEvent: vi.fn(), onOpen: vi.fn() });
    const 套接字 = 假WebSocket.实例表[0];
    关闭();
    expect(套接字.已关).toBe(true);
    套接字.模拟断();
    vi.advanceTimersByTime(60000);
    expect(假WebSocket.构造记录).toHaveLength(1); // 取消定时后零重连
  });
});