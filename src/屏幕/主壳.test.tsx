// P7 Task 3：Backend 主壳的首屏收件箱水合与角标 —— 用户还没打开消息 Tab，
// 候选端 P7 收件箱已水合、角标已显示（双端主壳在消息 Tab 之前就能看到已加载未读）；
// Mock 主壳零 P7 调用。子屏全部 mock，玻璃导航栏用真实实现读角标。

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import 主壳 from './主壳';
import type { P7会话项 } from '../数据/招聘数据源/真人会话';
import type { P7分页快照 } from '../状态/后端/类型';

vi.mock('./在谈首页', () => ({ default: () => <div data-testid="在谈首页" /> }));
vi.mock('./看市场', () => ({ default: () => <div /> }));
vi.mock('./我的', () => ({ default: () => <div /> }));
vi.mock('./消息列表', () => ({ default: () => <div /> }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({
  use应用状态: () => mock应用状态,
  // 数未读 与真实实现同款（玻璃导航栏 Mock 分支读它算角标）
  数未读: (表: Record<string, number>) =>
    Object.values(表).reduce((和, 数) => 和 + (数 > 0 ? 数 : 1), 0),
}));

function 会话项(覆盖: Partial<P7会话项> = {}): P7会话项 {
  return {
    conversationId: '3003', caseId: 'mc_3003', kind: 'human_handoff',
    lastMessage: null, lastActivityAt: '2026-08-30T01:00:00Z', unreadCount: 0,
    contextStatus: 'available',
    context: { primaryLabel: '后端工程师', secondaryLabel: '上海', jobRef: null, resumeRef: null },
    ...覆盖,
  };
}

function 收件箱快照(覆盖: Partial<P7分页快照<P7会话项>> = {}): P7分页快照<P7会话项> {
  return {
    阶段: '成功', 刷新中: false, items: [], nextCursor: null, 已加载页数: 0, error: null, generation: 1,
    ...覆盖,
  };
}

describe('主壳 · Backend 收件箱水合与角标', () => {
  it('非消息 Tab 挂载即水合候选收件箱一次，角标在打开消息 Tab 前可见', async () => {
    mock应用状态 = {
      状态: { 当前Tab: '职位', 子视图: '在谈', 消息未读: {} },
      派发: vi.fn(),
      数据源模式: 'backend',
      后端状态: {
        P7收件箱: {
          candidate: 收件箱快照({
            items: [会话项({ unreadCount: 2 }), 会话项({ conversationId: '3001', unreadCount: 1 })],
          }),
          recruiter: 收件箱快照(),
        },
      },
      操作: { 加载会话列表: vi.fn().mockResolvedValue(undefined) },
    };
    render(<主壳 />);
    await waitFor(() => expect(mock应用状态.操作.加载会话列表).toHaveBeenCalledTimes(1));
    expect(mock应用状态.操作.加载会话列表).toHaveBeenCalledWith('candidate');
    // 角标 = 已加载会话未读和（不是账号全量）：消息 Tab 从未打开就可见
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('Mock 主壳零 P7 调用，角标沿用 reducer 未读表', () => {
    mock应用状态 = {
      状态: { 当前Tab: '职位', 子视图: '在谈', 消息未读: { 'X-01': 4 } },
      派发: vi.fn(),
      数据源模式: 'mock',
      操作: { 加载会话列表: vi.fn() },
    };
    render(<主壳 />);
    expect(mock应用状态.操作.加载会话列表).not.toHaveBeenCalled();
    // 数未读 的 reducer 语义：>0 计条数
    expect(screen.getByText('4')).toBeTruthy();
  });
});