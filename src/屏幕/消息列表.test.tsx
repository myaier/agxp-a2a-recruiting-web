// P7 Task 3：消息列表的模式分支测试 —— Backend 只渲染候选端 P7 收件箱（Mock 消息
// fixture 不进 Backend 分支）；Mock 保留 AI/直聊/真人三行与 reducer 语义
// （点击行派发 读消息 并导航既有无参路由）。Mock 模式零 P7 请求由操作层早退保证。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 消息列表 from './消息列表';

const 导航 = vi.hoisted(() => ({ 跳转: vi.fn() }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: 导航.跳转 }) }));
vi.mock('./P7/Backend会话列表', () => ({
  default: ({ 角色 }: { 角色: string }) => <div data-testid="backend-inbox" data-role={角色} />,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

beforeEach(() => {
  导航.跳转.mockClear();
});

describe('消息列表 · 模式分支', () => {
  it('Backend 模式只渲染候选端 P7 收件箱', () => {
    mock应用状态 = { 数据源模式: 'backend', 状态: { 消息未读: {} }, 派发: vi.fn() };
    render(<消息列表 />);
    expect(screen.getByTestId('backend-inbox').getAttribute('data-role')).toBe('candidate');
    // Mock 消息 fixture 不进 Backend 分支
    expect(screen.queryByText('林筱')).toBeNull();
  });

  it('Mock 模式保留 AI/直聊/真人三行与 reducer 语义', async () => {
    mock应用状态 = { 数据源模式: 'mock', 状态: { 消息未读: { 'X-03': 2 } }, 派发: vi.fn() };
    render(<消息列表 />);
    expect(screen.getByText('AI代理动态')).toBeTruthy();
    expect(screen.getByText('陆知遥')).toBeTruthy();
    expect(screen.getByText('林筱')).toBeTruthy();
    expect(screen.queryByTestId('backend-inbox')).toBeNull();
    // 点行 = 读掉再进会话（reducer 语义），真人行走既有无参路由
    await userEvent.click(screen.getByRole('button', { name: /林筱/ }));
    expect(mock应用状态.派发).toHaveBeenCalledWith({ 型: '读消息', 编号: 'X-03' });
    expect(导航.跳转).toHaveBeenCalledWith('/chat/human');
  });
});
