// 登录页 Backend 接入测试（Task 6）：
// 守住四格验证码不被改成六格，并确保进入按钮等待 Backend 登录成功后才导航。
// Mock 分支的即时行为由现有 onboarding E2E 覆盖，此处只测 Backend 分支。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(document.querySelectorAll('[class*="验证码格"]')).toHaveLength(4);
    await 用户.type(screen.getByLabelText('短信验证码'), '1234');
    await 用户.click(screen.getByText(/已阅读并同意/));
    await 用户.click(screen.getByRole('button', { name: '进入' }));
    expect(mock跳转).not.toHaveBeenCalled();
    完成.resolve();
    await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.选身份));
  });
});