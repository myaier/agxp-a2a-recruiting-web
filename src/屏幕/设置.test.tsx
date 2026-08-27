// Task 3：设置屏 Backend 隐私写线测试。
// 「对现雇主隐身」在 Backend 模式必须走 操作.设置雇主隐私（服务端成功先于任何本地提交），
// 绝不派发本地 切设置开关 假成功；服务端隐私未水合（隐私快照 null）时开关禁用，
// 点击不产生任何写入、也不弹出关闭确认。关闭确认弹层的文案保持字节级不变。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import 设置 from './设置';
import { 初始状态 } from '../状态/初始状态';
import { BFF隐私快照样本 } from '../测试/BFF样本';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: vi.fn(), 跳转: vi.fn(), 替换跳转: vi.fn() }),
}));

describe('设置 · Backend 隐私写线', () => {
  it('Backend 对现雇主隐身使用 Privacy operation，成功前不派发本地 toggle', async () => {
    const 用户 = userEvent.setup();
    const 设置雇主隐私 = vi.fn().mockResolvedValue(undefined);
    const 派发 = vi.fn();
    mock应用状态 = {
      状态: { 设置开关: { ...初始状态.设置开关, 对现雇主隐身: true } },
      派发, 操作: { 设置雇主隐私, 退出登录: vi.fn() },
      数据源模式: 'backend', 后端状态: { 隐私快照: BFF隐私快照样本 },
    };
    render(<MemoryRouter><设置 /></MemoryRouter>);
    await 用户.click(screen.getByRole('switch', { name: '对现雇主隐身' }));
    expect(screen.getByText('关闭「对现雇主隐身」？')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '仍要关闭' }));
    expect(设置雇主隐私).toHaveBeenCalledWith(false);
    expect(派发).not.toHaveBeenCalledWith({ 型: '切设置开关', 键: '对现雇主隐身' });
  });

  it('Backend Privacy 未水合时隐身开关禁用且点击不触发任何写入', async () => {
    const 用户 = userEvent.setup();
    const 设置雇主隐私 = vi.fn().mockResolvedValue(undefined);
    const 派发 = vi.fn();
    mock应用状态 = {
      状态: { 设置开关: { ...初始状态.设置开关, 对现雇主隐身: false } },
      派发, 操作: { 设置雇主隐私, 退出登录: vi.fn() },
      数据源模式: 'backend', 后端状态: { 隐私快照: null },
    };
    render(<MemoryRouter><设置 /></MemoryRouter>);
    // 仓库未装 @testing-library/jest-dom：disabled 用原生属性断言
    const 开关钮 = screen.getByRole('switch', { name: '对现雇主隐身' }) as HTMLButtonElement;
    expect(开关钮.disabled).toBe(true);
    await 用户.click(开关钮);
    expect(设置雇主隐私).not.toHaveBeenCalled();
    expect(派发).not.toHaveBeenCalled();
    expect(screen.queryByText('关闭「对现雇主隐身」？')).toBeNull();
  });
});
