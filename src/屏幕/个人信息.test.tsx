import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import 个人信息 from './个人信息';
import 我的 from './我的';
import { 路径 } from '../路由/路径表';

const { 应用状态, 跳转 } = vi.hoisted(() => ({
  应用状态: {
    基本信息: { 真名: '章明' },
    求职头像: null as string | null,
    在谈列表: [] as { 阶段: string; 需要你?: boolean }[],
    归档列表: [] as unknown[],
    全局规则: [] as { 生效: boolean }[],
    意向级规则: [] as { 生效: boolean }[],
  },
  跳转: vi.fn(),
}));

vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({ 状态: 应用状态, 派发: vi.fn() }),
}));

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: vi.fn(), 跳转 }),
}));

describe('个人信息与「我」页头像行', () => {
  beforeEach(() => {
    应用状态.基本信息.真名 = '章明';
    应用状态.求职头像 = null;
  });

  it.each([null, '章:1'])('个人信息对空头像和非 dataURL 头像使用真名首字兜底：%s', (头像) => {
    应用状态.求职头像 = 头像;
    const { container } = render(<MemoryRouter><个人信息 /></MemoryRouter>);
    expect(screen.getByText('章')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('个人信息展示 dataURL 头像，姓名不误入注册基本信息页', () => {
    应用状态.求职头像 = 'data:image/png;base64,头像';
    const { container } = render(<MemoryRouter><个人信息 /></MemoryRouter>);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,头像');
    expect(screen.getByText('姓名').closest('button')).toBeNull();
  });

  it('「我」页读全局真名与头像，并跳到个人信息', () => {
    应用状态.求职头像 = 'data:image/png;base64,状态头像';
    const { container } = render(<MemoryRouter><我的 /></MemoryRouter>);

    expect(screen.getByText('章明')).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,状态头像');
    fireEvent.click(screen.getByRole('button', { name: /章明/ }));
    expect(跳转).toHaveBeenCalledWith(路径.个人信息);
  });

  it('「我」页在真名为空时回退到演示身份与首字', () => {
    应用状态.基本信息.真名 = '';
    const { container } = render(<MemoryRouter><我的 /></MemoryRouter>);

    const 头像行 = screen.getByRole('button', { name: /沈亦舟/ });
    expect(头像行.textContent).toContain('沈');
    expect(container.querySelector('img')).toBeNull();
  });
});
