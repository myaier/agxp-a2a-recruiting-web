// Task 3：披露偏好屏 Backend 写线测试。
// Backend 下服务端可写的三行（D-03/D-04/D-05）点档走 操作.设置披露偏好 单字段 patch，
// 绝不派发本地 设披露档 假成功；D1/D2（可修改=false）与 D6/D7（机制锁定）按钮一律不可点。
// 所有既有文案字节不变；className 仍按 可选 计算（不给固定行新增视觉禁用样式，
// 该视觉边界由既有 UI 回归门冻结）。隐私未水合时只渲染页面外壳，不注入 Mock 模板档位。

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import 披露偏好 from './披露偏好';
import { 从BFF隐私 } from '../数据/隐私映射';
import { BFF隐私快照样本 } from '../测试/BFF样本';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: vi.fn(), 跳转: vi.fn(), 替换跳转: vi.fn() }),
}));

describe('披露偏好 · Backend 写线', () => {
  it('D1/D2 fixed, D3-D5 patch one server field, and all existing copy remains', async () => {
    const 设置披露偏好 = vi.fn().mockResolvedValue(undefined);
    const 快照 = 从BFF隐私(BFF隐私快照样本);
    mock应用状态 = {
      状态: { 披露偏好: 快照.披露偏好 }, 派发: vi.fn(),
      操作: { 设置披露偏好 }, 数据源模式: 'backend',
      后端状态: { 隐私快照: 快照.服务端 },
    };
    render(<MemoryRouter><披露偏好 /></MemoryRouter>);
    expect(screen.getByText('具体薪资数字')).toBeTruthy();
    expect(screen.getByText('并行接触数量')).toBeTruthy();
    const D1卡 = screen.getByText('真实姓名').parentElement!.parentElement!;
    const D2卡 = screen.getByText('联系方式').parentElement!.parentElement!;
    const D4卡 = screen.getByText('毕业院校与学历').parentElement!.parentElement!;
    const D6卡 = screen.getByText('具体薪资数字').parentElement!.parentElement!;
    const D7卡 = screen.getByText('并行接触数量').parentElement!.parentElement!;
    // 仓库未装 @testing-library/jest-dom：disabled 用原生属性断言
    for (const 卡 of [D1卡, D2卡, D6卡, D7卡]) {
      for (const button of within(卡).getAllByRole('button')) {
        expect((button as HTMLButtonElement).disabled).toBe(true);
      }
    }
    await userEvent.click(within(D4卡).getByRole('button', { name: '不披露' }));
    expect(设置披露偏好).toHaveBeenCalledWith('D-04', '不披露');
  });

  it('Backend Privacy 未水合时保留页面外壳且不注入 Mock 档位', () => {
    const 设置披露偏好 = vi.fn();
    mock应用状态 = {
      状态: { 披露偏好: [] }, 派发: vi.fn(), 操作: { 设置披露偏好 },
      数据源模式: 'backend', 后端状态: { 隐私快照: null },
    };
    render(<MemoryRouter><披露偏好 /></MemoryRouter>);
    expect(screen.getByText('代理按这里的设定决定何时交出信息')).toBeTruthy();
    expect(screen.getByText(/AI 不会自动披露你的薪资数字/)).toBeTruthy();
    expect(screen.queryByText('真实姓名')).toBeNull();
    expect(设置披露偏好).not.toHaveBeenCalled();
  });
});
