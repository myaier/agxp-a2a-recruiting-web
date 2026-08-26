import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import 账号安全 from './账号安全';
import { 短信验证码位数 } from '../数据/验证码规则';

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: vi.fn(), 替换跳转: vi.fn() }),
}));

describe('账号安全', () => {
  it('换绑手机号与登录页统一使用四位验证码', async () => {
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );

    await 用户.click(screen.getByRole('button', { name: /手机号/ }));
    await 用户.type(screen.getByPlaceholderText('输入新手机号'), '13900000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));

    const 输入 = screen.getByPlaceholderText(`${短信验证码位数} 位验证码`);
    const 确认 = screen.getByRole('button', { name: '确认换绑' });
    expect(输入.getAttribute('maxlength')).toBe(String(短信验证码位数));
    expect((确认 as HTMLButtonElement).disabled).toBe(true);

    await 用户.type(输入, '1234');
    expect((确认 as HTMLButtonElement).disabled).toBe(false);
  });
});
