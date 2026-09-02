// 企业问AI代理 的 Backend/Mock 隔离（真话批次交付 G，镜像求职端 问AI代理.test.tsx）：
//   · Backend 只渲染代理气泡里的真实导航说明 + 三个既有快捷槽动作（看推荐 / 看在谈 /
//     AI代理设置），不挂载 fixture 简报/漏斗/对话/快捷问句/真输入条，也不排定时回复；
//   · Mock 原型（今日简报、人才漏斗、快捷问句、输入、关键词回复）原样保留；
//   · Mock 排队的 550ms 模拟回复定时器在切到 Backend / 卸载时必须取消，不允许泄漏。
// 宿主：mock 应用状态 / 导航钩子（同 候选筛选抽屉.test.tsx 惯例）；可变模式变量供
// rerender 前改写，模拟同页数据源切换。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 企业问AI代理 from './企业问AI代理';
import { 路径 } from '../路由/路径表';
import { 企业快捷问句 } from '../数据/企业端模拟数据';

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
      企业认证: { 姓名: '邵铭', 公司: '云衢科技', 职务: '技术 VP' },
      招聘头像: null,
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

// jsdom 不实现 scrollTo：Mock 体对话变化会把对话流滚到底
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

describe('企业问AI代理 · Backend 只读真实导航', () => {
  it('Backend only renders truthful recruiter guidance', () => {
    render(<企业问AI代理 />);
    expect(screen.getByText(/真实匹配与委托请从「推荐」进入/)).toBeTruthy();
    expect(screen.queryByText('今日简报')).toBeNull();
    expect(screen.queryByText('在谈 5')).toBeNull();
    expect(screen.queryByText(/已接触前 3 家/)).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: '发送' })).toBeNull();
  });

  it.each([
    ['看推荐', [{ 型: '企业切Tab', Tab: '人才' }, { 型: '企业切子视图', 子视图: '推荐' }]],
    ['看在谈', [{ 型: '企业切Tab', Tab: '人才' }, { 型: '企业切子视图', 子视图: '在谈' }]],
  ] as const)('%s selects the recruiter shell destination', async (name, actions) => {
    render(<企业问AI代理 />);
    await userEvent.click(screen.getByRole('button', { name }));
    expect(mock派发.mock.calls.map(([action]) => action)).toEqual(actions);
    expect(mock替换跳转).toHaveBeenCalledWith(路径.企业主壳);
  });

  it('AI代理设置 uses the canonical recruiter route', async () => {
    render(<企业问AI代理 />);
    await userEvent.click(screen.getByRole('button', { name: 'AI代理设置' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.企业代理设置);
  });
});

describe('企业问AI代理 · Mock 原型保持与定时器隔离', () => {
  it('Mock keeps the briefing, funnel, quick questions, and send input', () => {
    mock当前模式 = 'mock';
    render(<企业问AI代理 />);
    expect(screen.getByText('今日简报')).toBeTruthy();
    // 「硬性匹配」在统计条与漏斗行各出现一次（同一份 fixture 的两个字段），用 All 取
    expect(screen.getAllByText('硬性匹配').length).toBeGreaterThan(0);
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByRole('button', { name: 企业快捷问句[0] })).toBeTruthy();
  });

  it('switching Mock to Backend cancels a queued funnel reply', async () => {
    // fake timers 下不用 userEvent（指针事件等待会被假时钟卡死，仓库惯例是 fireEvent）
    vi.useFakeTimers();
    mock当前模式 = 'mock';
    const page = render(<企业问AI代理 />);
    fireEvent.click(screen.getByRole('button', { name: 企业快捷问句[0] }));
    mock当前模式 = 'backend';
    page.rerender(<企业问AI代理 />);
    await act(() => vi.advanceTimersByTimeAsync(550));
    expect(screen.queryByText(/本周漏斗：触达 23/)).toBeNull();
    expect(screen.queryByText('今日简报')).toBeNull();
    expect(screen.queryByText('硬性匹配')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
