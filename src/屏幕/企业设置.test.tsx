// 企业设置 · 退出确认键的可访问名称。
//
// 与求职端 设置.test.tsx 同一处缺陷的镜像：弹层框架用的是 <dialog open>
// （组件/弹层框架.tsx:62-64），那是**非模态**的 —— 层开着时页面其余部分既不 inert
// 也不从可访问树里剪枝，触发键与确认键同名会让读屏用户分不出哪个是确认。
// 两枚键的可见文案都仍是「退出登录」，区分只做在可访问名称上。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import 企业设置 from './企业设置';

const 退出登录 = vi.fn().mockResolvedValue(undefined);

vi.mock('../状态/应用状态', () => ({ use应用状态: () => ({ 操作: { 退出登录 } }) }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: vi.fn(), 跳转: vi.fn(), 替换跳转: vi.fn() }),
}));

describe('企业设置 · 退出确认键的可访问名称', () => {
  it('确认层打开后，触发键与确认键的可访问名称互不相同', async () => {
    const 用户 = userEvent.setup();
    render(<MemoryRouter><企业设置 /></MemoryRouter>);
    await 用户.click(screen.getByRole('button', { name: '退出登录' }));
    expect(screen.getByText('退出当前账号？')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '退出登录' })).toHaveLength(1);
    const 确认键 = screen.getByRole('button', { name: '退出企业账号' });
    expect(确认键.textContent).toBe('退出登录');
    await 用户.click(确认键);
    expect(退出登录).toHaveBeenCalledTimes(1);
  });
});
