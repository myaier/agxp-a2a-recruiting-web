// P7 Task 3：Backend 企业主壳的首屏收件箱水合与角标 —— 镜像求职端主壳：
// 招聘端 P7 收件箱在消息 Tab 打开前已水合并显示已加载未读角标；Mock 零 P7 调用。

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import 企业主壳 from './企业主壳';
import type { P7会话项 } from '../数据/招聘数据源/真人会话';
import type { P7分页快照 } from '../状态/后端/类型';

vi.mock('./企业在谈候选', () => ({ default: () => <div /> }));
vi.mock('./候选推荐', () => ({ default: () => <div /> }));
vi.mock('./企业消息', () => ({ default: () => <div /> }));
vi.mock('./企业我的', () => ({ default: () => <div /> }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({
  use应用状态: () => mock应用状态,
  // 数未读 与真实实现同款（企业主壳 Mock 分支读它算角标）
  数未读: (表: Record<string, number>) =>
    Object.values(表).reduce((和, 数) => 和 + (数 > 0 ? 数 : 1), 0),
}));

function 会话项(覆盖: Partial<P7会话项> = {}): P7会话项 {
  return {
    conversationId: '3003', caseId: 'mc_3003', kind: 'human_handoff',
    lastMessage: null, lastActivityAt: '2026-08-30T01:00:00Z', unreadCount: 0,
    contextStatus: 'available',
    context: { primaryLabel: '后端工程师', secondaryLabel: 'candidate-0123', jobRef: null, resumeRef: null },
    ...覆盖,
  };
}

function 收件箱快照(覆盖: Partial<P7分页快照<P7会话项>> = {}): P7分页快照<P7会话项> {
  return {
    阶段: '成功', 刷新中: false, items: [], nextCursor: null, 已加载页数: 0, error: null, generation: 1,
    ...覆盖,
  };
}

describe('企业主壳 · Backend 收件箱水合与角标', () => {
  it('非消息 Tab 挂载即水合招聘端收件箱一次，角标在打开消息 Tab 前可见', async () => {
    mock应用状态 = {
      状态: { 企业Tab: '人才', 企业子视图: '在谈', 企业消息未读: {} },
      派发: vi.fn(),
      数据源模式: 'backend',
      后端状态: {
        P7收件箱: {
          candidate: 收件箱快照(),
          recruiter: 收件箱快照({ items: [会话项({ unreadCount: 5 })] }),
        },
      },
      操作: { 加载会话列表: vi.fn().mockResolvedValue(undefined) },
    };
    render(<企业主壳 />);
    await waitFor(() => expect(mock应用状态.操作.加载会话列表).toHaveBeenCalledTimes(1));
    expect(mock应用状态.操作.加载会话列表).toHaveBeenCalledWith('recruiter');
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('Mock 企业主壳零 P7 调用，角标沿用 reducer 未读表', () => {
    mock应用状态 = {
      状态: { 企业Tab: '人才', 企业子视图: '在谈', 企业消息未读: { 'H-01': 2 } },
      派发: vi.fn(),
      数据源模式: 'mock',
      操作: { 加载会话列表: vi.fn() },
    };
    render(<企业主壳 />);
    expect(mock应用状态.操作.加载会话列表).not.toHaveBeenCalled();
    expect(screen.getByText('2')).toBeTruthy();
  });
});