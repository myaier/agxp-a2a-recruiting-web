// 登录页 Backend 接入测试（Task 6）：
// 守住四格验证码不被改成六格，并确保进入按钮等待 Backend 登录成功后才导航。
// Mock 分支的即时行为由现有 onboarding E2E 覆盖，此处只测 Backend 分支。

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import 登录 from './登录';
import { 路径 } from '../路由/路径表';

const mock跳转 = vi.fn();
const mock操作 = {
  开始手机登录: vi.fn(),
  完成手机登录: vi.fn(),
  微信登录: vi.fn(),
};
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转 }) }));
vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({ 操作: mock操作, 数据源模式: 'backend' }),
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('登录页 Backend', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock操作.开始手机登录.mockClear();
    mock操作.完成手机登录.mockClear();
    mock操作.微信登录.mockClear();
  });

  it('保持四格验证码，并等待 Backend 登录成功才导航', async () => {
    const 完成 = deferred<void>();
    mock操作.开始手机登录.mockResolvedValue(undefined);
    mock操作.完成手机登录.mockReturnValue(完成.promise);
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter>
        <登录 />
      </MemoryRouter>,
    );
    await 用户.type(screen.getByLabelText('手机号'), '13800000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    await waitFor(() => expect(screen.getByText('验证码已发送')).toBeDefined());
    expect(screen.queryByText(/原型不校验/)).toBeNull();
    expect(document.querySelectorAll('[class*="验证码格"]')).toHaveLength(4);
    await 用户.type(screen.getByLabelText('短信验证码'), '1234');
    await 用户.click(screen.getByText(/已阅读并同意/));
    await 用户.click(screen.getByRole('button', { name: '进入' }));
    expect(mock跳转).not.toHaveBeenCalled();
    完成.resolve();
    await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.选身份));
  });

  it('微信登录必须先勾选协议', async () => {
    mock操作.微信登录.mockResolvedValue(null);
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter>
        <登录 />
      </MemoryRouter>,
    );

    await 用户.click(screen.getByRole('button', { name: '微信登录' }));
    expect(mock操作.微信登录).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();

    await 用户.click(screen.getByText(/已阅读并同意/));
    await 用户.click(screen.getByRole('button', { name: '微信登录' }));
    await waitFor(() => expect(mock操作.微信登录).toHaveBeenCalledTimes(1));
    expect(mock跳转).toHaveBeenCalledWith(路径.选身份);
  });

  // F11：开始手机登录失败时倒计时不启动，用户可重试（按钮不被倒计时锁住）
  it('开始手机登录失败时不进入倒计时，按钮仍是「获取验证码」可重试', async () => {
    mock操作.开始手机登录.mockRejectedValue(new Error('短信通道异常'));
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter>
        <登录 />
      </MemoryRouter>,
    );
    await 用户.type(screen.getByLabelText('手机号'), '13800000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    // 失败后：倒计时文案（Ns）不应出现，按钮仍是「获取验证码」（不是「重新获取」也不是倒计时）
    await waitFor(() => expect(screen.getByRole('button', { name: '获取验证码' })).toBeDefined());
    // 四格验证码区不应出现（剩余秒仍是 null，剩余秒 !== null 才渲染四格）
    expect(document.querySelectorAll('[class*="验证码格"]')).toHaveLength(0);
  });

  // #6：倒计时归零后重发失败，剩余秒归 null（不留在 0），按钮回到「获取验证码」可干净重试。
  it('倒计时归零后重发失败，剩余秒归 null 不留在 0（#6）', async () => {
    vi.useFakeTimers();
    try {
      mock操作.开始手机登录
        .mockResolvedValueOnce(undefined)   // 第一次成功
        .mockRejectedValueOnce(new Error('down')); // 第二次失败
      render(
        <MemoryRouter>
          <登录 />
        </MemoryRouter>,
      );
      // 输入手机号（fireEvent 避免 userEvent 逐字输入与 fake timer 冲突）
      await act(async () => {
        fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800000000' } });
      });
      // 点击获取验证码 → 第一次成功
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
      });
      // 倒计时启动 → 60s
      expect(screen.getByText(/60s/)).toBeDefined();
      // 逐秒快进到倒计时归零（每秒 effect 重新注册定时器，需逐秒推进让 re-render 发生）
      for (let i = 0; i < 60; i++) {
        await act(async () => { vi.advanceTimersByTime(1000); });
      }
      expect(screen.getByRole('button', { name: '重新获取' })).toBeDefined();
      // 重发失败 → 剩余秒归 null → 按钮回到「获取验证码」
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '重新获取' }));
      });
      expect(screen.getByRole('button', { name: '获取验证码' })).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
