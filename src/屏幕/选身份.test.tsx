// 选身份页普通模式卡片接入测试（F2）：
// 普通身份卡也要调 操作.切身份 落角色，成功才跳转，失败复用 轻提示。
// 切换模式（switch=1）已有自己的守卫逻辑，此处补两条水合 401 的页面责任回归：
// 提示一次、绝不执行成功导航（P0 修复 Task 3）。

import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 选身份 from './选身份';
import { 路径 } from '../路由/路径表';
import { BFF错误 } from '../数据/HTTP客户端';

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
    // 轻提示 是纯 DOM 单例，容器跨用例存活：清掉上一例的残条，
    // 免得 getByText 在普通模式与翻面模式两例 401 里各匹配到两条（组件测试自己的清理，不给 轻提示 加测试专用重置口）
    const 提示容器 = Array.from(document.body.children).find(
      (节点) => (节点 as HTMLElement).style?.zIndex === '999',
    ) as HTMLElement | undefined;
    if (提示容器) 提示容器.innerHTML = '';
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
    // P0 修复 Task 2：招聘方注册流落点显式带「从注册流」，与路由守卫的缺失档案落点同形
    expect(mock跳转).toHaveBeenCalledWith(路径.招聘名片, { 从注册流: true });
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

  // P0 修复 Task 3：水合 401 属于页面责任 —— 提示一次会话失效，成功导航绝不执行。
  // 清理与拒绝形状由会话操作测试负责，这里只钉「不导航」。
  it('切身份水合 401 显示会话失效且不执行成功导航', async () => {
    mock切身份.mockRejectedValueOnce(
      new BFF错误(401, 'invalid_session', 'expired'),
    );
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/identity']}>
        <选身份 />
      </MemoryRouter>,
    );
    await 用户.click(screen.getByText('我要找工作'));
    await waitFor(() => expect(screen.getByText('登录已失效，请重新登录')).toBeTruthy());
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
  });

  it('翻面切换水合 401 也不执行替换导航', async () => {
    vi.useFakeTimers();
    try {
      mock切身份.mockRejectedValueOnce(
        new BFF错误(401, 'invalid_session', 'expired'),
      );
      // 假计时器下 userEvent.click 自身的等待计时器永不触发（会卡死整个用例），
      // 与 登录.test.tsx 的 #6 用例同一口径：假计时器一律 fireEvent
      render(
        <MemoryRouter initialEntries={['/identity?switch=1&from=hr']}>
          <选身份 />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: '翻到「求职者」那一面' }));
      await act(async () => { vi.advanceTimersByTime(950); });
      expect(screen.getByText('登录已失效，请重新登录')).toBeTruthy();
      expect(mock替换跳转).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});