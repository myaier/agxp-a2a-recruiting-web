// 问AI代理 的 Backend/Mock 隔离（真话批次交付 G）：
//   · Backend 只渲染代理气泡里的真实导航说明 + 三个既有快捷槽动作（去市场 / 看在谈 /
//     规则库），不挂载 fixture 简报、模拟对话、快捷问句、真输入条，也不排定时回复；
//   · Mock 原型（今日简报、快捷问句、输入、关键词回复）原样保留；
//   · Mock 排队的 550ms 模拟回复定时器在切到 Backend / 卸载时必须取消，不允许泄漏。
// 宿主：mock 应用状态 / 导航钩子（同 看市场.test.tsx 惯例）；可变模式变量供 rerender
// 前改写，模拟同页数据源切换（mock 前缀满足 vi.mock 工厂的提升引用规则）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 问AI代理 from './问AI代理';
import { 路径 } from '../路由/路径表';
import { 快捷问句 } from '../数据/模拟数据';

const mock派发 = vi.fn();
const mock返回 = vi.fn();
const mock跳转 = vi.fn();
const mock替换跳转 = vi.fn();
let mock当前模式: 'mock' | 'backend' = 'backend';

vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({
    数据源模式: mock当前模式,
    派发: mock派发,
    状态: {
      基本信息: { 真名: '沈亦舟' },
      引导预填: null,
    },
  }),
}));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({
    返回: mock返回,
    跳转: mock跳转,
    替换跳转: mock替换跳转,
  }),
}));
vi.mock('../组件/轻提示', () => ({ 轻提示: vi.fn() }));

// jsdom 不实现 scrollTo：Mock 体挂载/对话变化都会把对话流滚到底
if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = () => {};
}

beforeEach(() => {
  mock当前模式 = 'backend';
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('问AI代理 · Backend 只读真实导航', () => {
  it('Backend only renders truthful read-only guidance', () => {
    render(<问AI代理 />);
    expect(screen.getByText(/真实匹配与委托请从「市场」进入/)).toBeTruthy();
    expect(screen.queryByText('今日简报')).toBeNull();
    expect(screen.queryByText(/已接触前 3 家/)).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: '发送' })).toBeNull();
  });

  it.each([
    ['去市场', [{ 型: '切Tab', Tab: '职位' }, { 型: '切子视图', 子视图: '看市场' }], 路径.主壳],
    ['看在谈', [{ 型: '切Tab', Tab: '职位' }, { 型: '切子视图', 子视图: '在谈' }], 路径.主壳],
  ] as const)('%s selects the candidate shell destination', async (name, actions, target) => {
    render(<问AI代理 />);
    await userEvent.click(screen.getByRole('button', { name }));
    expect(mock派发.mock.calls.map(([action]) => action)).toEqual(actions);
    expect(mock替换跳转).toHaveBeenCalledWith(target);
  });

  it('规则库 uses the canonical candidate route', async () => {
    render(<问AI代理 />);
    await userEvent.click(screen.getByRole('button', { name: '规则库' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.规则库);
  });
});

describe('问AI代理 · Mock 原型保持与定时器隔离', () => {
  it('Mock keeps the briefing, quick questions, and send input', () => {
    mock当前模式 = 'mock';
    render(<问AI代理 />);
    expect(screen.getByText('今日简报')).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByRole('button', { name: 快捷问句[0] })).toBeTruthy();
  });

  it('switching Mock to Backend cancels a queued fake reply', async () => {
    // fake timers 下不用 userEvent（指针事件等待会被假时钟卡死，仓库惯例是 fireEvent）
    vi.useFakeTimers();
    mock当前模式 = 'mock';
    const page = render(<问AI代理 />);
    fireEvent.click(screen.getByRole('button', { name: 快捷问句[0] }));
    mock当前模式 = 'backend';
    page.rerender(<问AI代理 />);
    await act(() => vi.advanceTimersByTimeAsync(550));
    expect(screen.queryByText(/搜到 7 个全远程/)).toBeNull();
    expect(screen.queryByText('今日简报')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
