// 添加头像（注册流最后一屏）的收尾清理接线（Task 7 / 设计 §9）：
// 点「完成注册」先作废候选 onboarding 预填轮（内存建议 + 恢复元数据随 清候选Onboarding预填
// 一起清），再走既有「初始化页 → 主壳」导航 —— 完成注册后旧建议绝不再残留。
// 按钮文案 / 位置 / 样式不动（本文件只钉收尾编排）；Mock 模式零预填操作（预填域 Backend-only）。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 添加头像 from './添加头像';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock进初始化 = vi.fn();
const mock操作 = {
  清候选Onboarding预填: vi.fn(),
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: mock返回, 进初始化: mock进初始化 }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

function render添加头像(数据源: 'backend' | 'mock' = 'backend') {
  const 派发 = vi.fn();
  mock应用状态 = {
    数据源模式: 数据源,
    状态: { 求职头像: null },
    派发,
    后端状态: {},
    操作: mock操作,
  };
  render(
    <MemoryRouter>
      <添加头像 />
    </MemoryRouter>,
  );
  return { 派发 };
}

describe('添加头像：完成注册收尾清理（Task 7）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock进初始化.mockClear();
    mock操作.清候选Onboarding预填.mockClear();
  });

  it('cleanup before “完成注册” navigation：先清候选预填轮再进初始化页', async () => {
    const { 派发 } = render添加头像('backend');
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock操作.清候选Onboarding预填).toHaveBeenCalledTimes(1);
    expect(mock操作.清候选Onboarding预填.mock.invocationCallOrder[0]!)
      .toBeLessThan(mock进初始化.mock.invocationCallOrder[0]!);
    // 既有收尾编排保持：切 Tab / 子视图 的派发与初始化导航都还在
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '切Tab', Tab: '职位' }));
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '切子视图', 子视图: '在谈' }));
    expect(mock进初始化).toHaveBeenCalledTimes(1);
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('no old suggestion after completion：清理恰一次，旧建议与恢复元数据不残留到主壳', async () => {
    render添加头像('backend');
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock操作.清候选Onboarding预填).toHaveBeenCalledTimes(1);
    // 完成注册是唯一的收尾出口：再次点击也不产生第二份清理之外的路径
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock进初始化).toHaveBeenCalledTimes(2);
    expect(mock操作.清候选Onboarding预填).toHaveBeenCalledTimes(2);
  });

  it('按钮文案不变：主按钮仍叫「完成注册」', () => {
    render添加头像('backend');
    expect(screen.getByRole('button', { name: '完成注册' })).toBeTruthy();
  });

  it('Mock 模式零预填操作：完成注册只走既有导航', async () => {
    const { 派发 } = render添加头像('mock');
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock操作.清候选Onboarding预填).not.toHaveBeenCalled();
    expect(派发).toHaveBeenCalledTimes(2);
    expect(mock进初始化).toHaveBeenCalledTimes(1);
  });
});
