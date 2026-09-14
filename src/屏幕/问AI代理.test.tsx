// 问AI代理 的 Backend/Mock 隔离（真话批次交付 G）：
//   · Backend 渲染代理气泡里的真实导航说明 + 三个既有快捷槽动作（去市场 / 看在谈 /
//     规则库），底部再挂一条禁用输入外壳（占位=「AI代理聊天暂未开放」，textarea 与
//     发送键真 disabled）；不挂载 fixture 简报、模拟对话、快捷问句，也不排定时回复；
//   · Mock 原型（今日简报、快捷问句、输入、关键词回复）原样保留；
//   · Mock 排队的 550ms 模拟回复定时器在切到 Backend / 卸载时必须取消，不允许泄漏
//     （证据用 clearTimeout spy，不以 DOM 消失替代清理）。
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
  vi.restoreAllMocks();
});

describe('问AI代理 · Backend 只读真实导航', () => {
  it('Backend keeps the truthful guidance in a complete but muted shell', () => {
    render(<问AI代理 />);
    expect(screen.getByText(/真实匹配与委托请从「市场」进入/)).toBeTruthy();
    // 仍然零 Mock 内容：无 fixture 简报 / 快捷问句 / 模拟回复
    expect(screen.queryByText('今日简报')).toBeNull();
    expect(screen.queryByText(快捷问句[0])).toBeNull();
    expect(screen.queryByText(/已接触前 3 家/)).toBeNull();
    // 外壳完整但不可发送：真输入条在场，值恒为空、占位=暂未开放，textarea 与发送键真 disabled
    const 输入 = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(输入.disabled).toBe(true);
    expect(输入.value).toBe('');
    expect(输入.getAttribute('placeholder')).toBe('AI代理聊天暂未开放');
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Backend input cannot send: click, Enter, and typing leave no message or rule side effect', () => {
    render(<问AI代理 />);
    // 点发送 / 按 Enter / 试图输入，三条路径都不产生消息，也不派发任何规则 mutation
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    const 输入 = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.keyDown(输入, { key: 'Enter' });
    fireEvent.change(输入, { target: { value: 快捷问句[0] } });
    expect(输入.value).toBe('');
    expect(screen.queryByText(快捷问句[0])).toBeNull();
    expect(screen.queryByText(/搜到 7 个全远程/)).toBeNull();
    expect(mock派发).not.toHaveBeenCalled();
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

  it('switching Mock to Backend clears every queued fake reply timer', async () => {
    // fake timers 下不用 userEvent（指针事件等待会被假时钟卡死，仓库惯例是 fireEvent）
    vi.useFakeTimers();
    const 定时Spy = vi.spyOn(window, 'setTimeout');
    const 清除Spy = vi.spyOn(window, 'clearTimeout');
    // 550ms 生成的回复与初始 fixture 那条前缀相同，但少一句「我按方向对口度排了序」；
    // 用整句精确匹配，才不会把 fixture 气泡误认成泄漏的模拟回复
    const 远程回复 = '搜到 7 个全远程、薪资带覆盖你底线的。要我直接去谈前 3 个吗？';
    mock当前模式 = 'mock';
    const page = render(<问AI代理 />);
    // 点快捷问句：我方消息上屏（按钮 + 气泡两处同文），550ms 回复还在排队
    fireEvent.click(screen.getByRole('button', { name: 快捷问句[0] }));
    expect(screen.getAllByText(快捷问句[0]).length).toBe(2);
    expect(screen.queryByText(远程回复)).toBeNull();

    mock当前模式 = 'backend';
    page.rerender(<问AI代理 />);
    // 清理证据必须是显式 clearTimeout 且覆盖每一个排上的句柄，不是 DOM 消失
    const 排上的 = 定时Spy.mock.results.map((结果) => 结果.value);
    const 已清的 = 清除Spy.mock.calls.map(([句柄]) => 句柄);
    expect(排上的.length).toBeGreaterThan(0);
    for (const 句柄 of 排上的) expect(已清的).toContain(句柄);

    await act(() => vi.advanceTimersByTimeAsync(550));
    expect(screen.queryByText(远程回复)).toBeNull();
    expect(screen.queryByText('今日简报')).toBeNull();
    // 切到 Backend 后落在禁用输入外壳上
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('unmount also clears the queued fake reply timer', async () => {
    vi.useFakeTimers();
    const 定时Spy = vi.spyOn(window, 'setTimeout');
    const 清除Spy = vi.spyOn(window, 'clearTimeout');
    mock当前模式 = 'mock';
    const page = render(<问AI代理 />);
    fireEvent.click(screen.getByRole('button', { name: 快捷问句[0] }));
    page.unmount();
    const 排上的 = 定时Spy.mock.results.map((结果) => 结果.value);
    const 已清的 = 清除Spy.mock.calls.map(([句柄]) => 句柄);
    expect(排上的.length).toBeGreaterThan(0);
    for (const 句柄 of 排上的) expect(已清的).toContain(句柄);
    // 卸载后假时钟走完也不再有宿主可渲染；证据就是上面的逐句柄 clearTimeout 调用
    await act(() => vi.advanceTimersByTimeAsync(550));
    expect(screen.queryByText(/搜到 7 个全远程/)).toBeNull();
  });
});
