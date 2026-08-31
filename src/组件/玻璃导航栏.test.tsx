// P7 Task 3：玻璃导航栏角标的模式分支 —— Backend 角标只汇总当前已加载的候选端
// P7 收件箱 items 的 unreadCount（不宣称账号全量总数）；零和不渲染任何角标；
// Mock 沿用既有 数未读 reducer 语义。

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import 玻璃导航栏 from './玻璃导航栏';
import type { P7会话项 } from '../数据/招聘数据源/真人会话';
import type { P7分页快照 } from '../状态/后端/类型';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({
  use应用状态: () => mock应用状态,
  // 数未读 与真实实现同款：>0 计条数，0/缺失计 1
  数未读: (表: Record<string, number>) =>
    Object.values(表).reduce((和, 数) => 和 + (数 > 0 ? 数 : 1), 0),
}));

function 会话项(unreadCount: number): P7会话项 {
  return {
    conversationId: '3003', caseId: 'mc_3003', kind: 'human_handoff',
    lastMessage: null, lastActivityAt: '2026-08-30T01:00:00Z', unreadCount,
    contextStatus: 'available', context: null,
  };
}

function 收件箱快照(items: P7会话项[]): P7分页快照<P7会话项> {
  return { 阶段: '成功', 刷新中: false, items, nextCursor: null, 已加载页数: 1, error: null, generation: 1 };
}

/** 角标是唯一的纯数字文本节点（Tab 名都不是纯数字）。 */
function 角标文本(容器: HTMLElement): string | null {
  const 命中 = Array.from(容器.querySelectorAll('span'))
    .filter((节点) => /^\d+$/.test(节点.textContent ?? ''));
  return 命中.length === 0 ? null : 命中[0].textContent ?? null;
}

describe('玻璃导航栏 · 角标模式分支', () => {
  it('Backend 角标只汇总已加载收件箱的 unreadCount', () => {
    mock应用状态 = {
      状态: { 当前Tab: '职位', 消息未读: {} },
      派发: vi.fn(),
      数据源模式: 'backend',
      后端状态: {
        P7收件箱: {
          candidate: 收件箱快照([会话项(2), 会话项(1)]),
          recruiter: 收件箱快照([]),
        },
      },
    };
    const { container } = render(<玻璃导航栏 />);
    expect(角标文本(container)).toBe('3');
  });

  it('已加载未读为零和时不渲染角标，也不显示「0」', () => {
    mock应用状态 = {
      状态: { 当前Tab: '职位', 消息未读: {} },
      派发: vi.fn(),
      数据源模式: 'backend',
      后端状态: {
        P7收件箱: { candidate: 收件箱快照([会话项(0)]), recruiter: 收件箱快照([]) },
      },
    };
    const { container } = render(<玻璃导航栏 />);
    expect(角标文本(container)).toBeNull();
  });

  it('Mock 模式沿用既有 reducer 未读表', () => {
    mock应用状态 = {
      状态: { 当前Tab: '职位', 消息未读: { 'X-01': 4 } },
      派发: vi.fn(),
      数据源模式: 'mock',
    };
    const { container } = render(<玻璃导航栏 />);
    expect(角标文本(container)).toBe('4');
    expect(screen.queryByText('职位')).toBeTruthy();
  });
});