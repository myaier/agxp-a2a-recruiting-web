// 选身份页普通模式卡片接入测试（F2）：
// 普通身份卡也要调 操作.切身份 落角色，成功才跳转，失败复用 轻提示。
// 切换模式（switch=1）已有自己的守卫逻辑，此处只测普通模式（新登录用户选身份）。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 选身份 from './选身份';

const mock跳转 = vi.fn();
const mock替换跳转 = vi.fn();
const mock返回 = vi.fn();
const mock切身份 = vi.fn();

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 替换跳转: mock替换跳转, 返回: mock返回 }),
}));
vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({ 操作: { 切身份: mock切身份 } }),
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

describe('选身份页普通模式 F2', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock替换跳转.mockClear();
    mock返回.mockClear();
    mock切身份.mockClear();
  });

  it('普通模式卡片点「我要招人」调 切身份(招聘方)，成功才跳转', async () => {
    const 完成 = deferred<void>();
    mock切身份.mockReturnValue(完成.promise);
    const 用户 = userEvent.setup();
    // 不带 switch=1 → 普通模式，渲染两张普通身份卡
    render(
      <MemoryRouter initialEntries={['/identity']}>
        <选身份 />
      </MemoryRouter>,
    );
    await 用户.click(screen.getByText('我要招人'));
    expect(mock切身份).toHaveBeenCalledWith('招聘方');
    // 进行中：还没跳转
    expect(mock跳转).not.toHaveBeenCalled();
    完成.resolve();
    await waitFor(() => expect(mock跳转).toHaveBeenCalledTimes(1));
  });

  it('普通模式卡片点「我要找工作」调 切身份(求职者)，成功才跳转', async () => {
    mock切身份.mockResolvedValue(undefined);
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/identity']}>
        <选身份 />
      </MemoryRouter>,
    );
    await 用户.click(screen.getByText('我要找工作'));
    expect(mock切身份).toHaveBeenCalledWith('求职者');
    await waitFor(() => expect(mock跳转).toHaveBeenCalledTimes(1));
  });

  it('切身份失败时复用 轻提示 且不跳转', async () => {
    mock切身份.mockRejectedValue(new Error('角色写入失败'));
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/identity']}>
        <选身份 />
      </MemoryRouter>,
    );
    await 用户.click(screen.getByText('我要招人'));
    await waitFor(() => expect(mock跳转).not.toHaveBeenCalled());
  });
});