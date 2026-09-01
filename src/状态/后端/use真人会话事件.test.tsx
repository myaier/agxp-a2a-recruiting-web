// P7 Task 5：use真人会话事件 钩子的行为测试 —— 事件只触发失效与 no-store 重拉
// （可见会话才重拉详情+消息）、open/重连无条件重拉可见范围、Mock/未登录/无角色
// 零连接、主体/角色变化重连、卸载断开、页面隐藏断开、StrictMode 下同一有效
// scope 只保留一条活连接（用真 adapter + 受控假 WebSocket 证明）。

import { render } from '@testing-library/react';
import { act, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { 创建招聘事件源, type 招聘事件源 } from '../../数据/招聘事件源';
import type { P7变更事件 } from '../../数据/招聘事件源';
import { use真人会话事件 } from './use真人会话事件';
import type { 可变引用 } from './类型';

/** 事件源桩：捕获 handlers，测试主动触发 onEvent/onOpen。 */
function 创建事件源桩() {
  const 处理器: { onEvent?: (事件: P7变更事件) => void; onOpen?: () => void } = {};
  const 断开 = vi.fn();
  const 连接 = vi.fn(({ onEvent, onOpen }: { onEvent: (事件: P7变更事件) => void; onOpen: () => void }) => {
    处理器.onEvent = onEvent;
    处理器.onOpen = onOpen;
    return 断开;
  });
  return { 事件源: { 连接 } as unknown as 招聘事件源, 处理器, 断开, 连接 };
}

function 环境(input: {
  数据源模式?: 'mock' | 'backend';
  已登录?: boolean;
  角色?: 'candidate' | 'recruiter' | null;
  可见会话?: string | null;
}) {
  // 注意 null 是显式输入（无角色不连接），不能被 ?? 吞成默认值
  const 角色 = input.角色 === undefined ? 'candidate' : input.角色;
  return {
    数据源模式: input.数据源模式 ?? 'backend',
    已登录: input.已登录 ?? true,
    角色,
    可见会话引用: {
      current: {
        candidate: 角色 === 'candidate' ? input.可见会话 ?? null : null,
        recruiter: 角色 === 'recruiter' ? input.可见会话 ?? null : null,
      },
    } as 可变引用<Record<'candidate' | 'recruiter', string | null>>,
    操作: {
      使真人会话失效: vi.fn(),
      加载会话列表: vi.fn().mockResolvedValue(undefined),
      读取真人会话: vi.fn().mockResolvedValue(undefined),
    },
  };
}

type 环境值 = ReturnType<typeof 环境>;

function 探针({ 事件源, 环境: 输入 }: { 事件源: 招聘事件源; 环境: 环境值 }) {
  use真人会话事件({
    事件源,
    可见会话引用: 输入.可见会话引用,
    数据源模式: 输入.数据源模式,
    已登录: 输入.已登录,
    角色: 输入.角色,
    操作: 输入.操作,
  });
  return null;
}

const 帧3003: P7变更事件 = {
  type: 'recruitment.conversation_changed', conversationId: '3003', reason: 'message_created',
};

describe('use真人会话事件', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('事件触发失效 + 收件箱 no-store 重拉；可见会话才重拉详情+消息', () => {
    const 桩 = 创建事件源桩();
    const 场 = 环境({ 角色: 'candidate', 可见会话: '3003' });
    render(<探针 事件源={桩.事件源} 环境={场} />);
    const { 处理器 } = 桩;
    const 操作 = 场.操作;
    act(() => 处理器.onEvent!(帧3003));
    expect(操作.使真人会话失效).toHaveBeenCalledWith('candidate', '3003');
    expect(操作.加载会话列表).toHaveBeenCalledWith('candidate', true);
    expect(操作.读取真人会话).toHaveBeenCalledWith('candidate', '3003', true);
  });

  it('不可见会话只重拉收件箱，不重拉会话', () => {
    const 桩 = 创建事件源桩();
    const 场 = 环境({ 角色: 'candidate', 可见会话: '3001' });
    render(<探针 事件源={桩.事件源} 环境={场} />);
    const { 处理器 } = 桩;
    const 操作 = 场.操作;
    act(() => 处理器.onEvent!(帧3003));
    expect(操作.使真人会话失效).toHaveBeenCalledWith('candidate', '3003');
    expect(操作.加载会话列表).toHaveBeenCalledWith('candidate', true);
    expect(操作.读取真人会话).not.toHaveBeenCalled();
  });

  it('open / 每次重连无条件重拉当前角色收件箱与当前可见会话', () => {
    const 桩 = 创建事件源桩();
    const 场 = 环境({ 角色: 'recruiter', 可见会话: '3005' });
    render(<探针 事件源={桩.事件源} 环境={场} />);
    const { 处理器 } = 桩;
    const 操作 = 场.操作;
    act(() => 处理器.onOpen!());
    expect(操作.加载会话列表).toHaveBeenCalledWith('recruiter', true);
    expect(操作.读取真人会话).toHaveBeenCalledWith('recruiter', '3005', true);
  });

  it('Mock 模式 / 未登录 / 无角色：零连接', () => {
    const 桩1 = 创建事件源桩();
    const 场1 = 环境({ 数据源模式: 'mock', 角色: 'candidate' });
    render(<探针 事件源={桩1.事件源} 环境={场1} />);
    expect(桩1.连接).not.toHaveBeenCalled();

    const 桩2 = 创建事件源桩();
    const 场2 = 环境({ 已登录: false, 角色: 'candidate' });
    render(<探针 事件源={桩2.事件源} 环境={场2} />);
    expect(桩2.连接).not.toHaveBeenCalled();

    const 桩3 = 创建事件源桩();
    const 场3 = 环境({ 角色: null });
    render(<探针 事件源={桩3.事件源} 环境={场3} />);
    expect(桩3.连接).not.toHaveBeenCalled();
  });

  it('主体/角色变化：旧连接断开后按新角色重连', () => {
    const 桩 = 创建事件源桩();
    const 场 = 环境({ 角色: 'candidate', 可见会话: '3003' });
    const { rerender } = render(<探针 事件源={桩.事件源} 环境={场} />);
    expect(桩.连接).toHaveBeenCalledTimes(1);
    // 引用变化（可见范围换代）：断开后按同一角色重连
    const 新引用: 可变引用<Record<'candidate' | 'recruiter', string | null>> = {
      current: { candidate: null, recruiter: '3009' },
    };
    rerender(<探针 事件源={桩.事件源} 环境={{ ...场, 可见会话引用: 新引用 }} />);
    expect(桩.断开).toHaveBeenCalledTimes(1);
    expect(桩.连接).toHaveBeenCalledTimes(2);
    // 角色换成招聘方后再重连，事件走新角色
    const 换角色场 = 环境({ 角色: 'recruiter', 可见会话: '3009' });
    rerender(<探针 事件源={桩.事件源} 环境={换角色场} />);
    expect(桩.断开).toHaveBeenCalledTimes(2);
    expect(桩.连接).toHaveBeenCalledTimes(3);
    act(() => 桩.处理器.onEvent!(帧3003));
    expect(换角色场.操作.使真人会话失效).toHaveBeenCalledWith('recruiter', '3003');
  });

  it('卸载断开连接', () => {
    const 桩 = 创建事件源桩();
    const 场 = 环境({ 角色: 'candidate' });
    const { unmount } = render(<探针 事件源={桩.事件源} 环境={场} />);
    unmount();
    expect(桩.断开).toHaveBeenCalled();
  });
});

// ── 真实 adapter + StrictMode：同一有效 scope 只保留一条活连接 ──────────────────

class 假WebSocket {
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
    假WebSocket.实例表.push(this);
  }
  close() {
    this.已关 = true;
    if (!this.已通知关) { this.已通知关 = true; this.onclose?.(); }
  }
}

describe('use真人会话事件 · 真实 adapter 生命周期', () => {
  beforeEach(() => {
    假WebSocket.实例表 = [];
  });

  it('StrictMode 双挂载只保留一条活连接；页面隐藏断开、恢复可见重连', () => {
    const 事件源 = 创建招聘事件源({ WebSocket构造器: 假WebSocket as unknown as typeof WebSocket });
    const 场 = 环境({ 角色: 'candidate', 可见会话: '3003' });
    render(
      <StrictMode>
        <探针 事件源={事件源} 环境={场} />
      </StrictMode>,
    );
    const 活连接 = () => 假WebSocket.实例表.filter((套) => !套.已关);
    expect(活连接().length).toBe(1);

    // 页面隐藏 → 断开（socket 与重连定时一并关闭）
    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(活连接().length).toBe(0);

    // 恢复可见 → 重连，仍只有一条
    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(活连接().length).toBe(1);
  });
});