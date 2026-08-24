// 发布岗位页 Backend 提交测试（Task 8）：
// 编辑保存成功前不导航；await 操作.更新岗位 落定后才返回。
// Mock 下 操作 内部同步 dispatch，DOM/流程由现有 onboarding E2E 覆盖。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 发布岗位 from './发布岗位';
import { 页面岗位样本 } from '../测试/BFF样本';

const mock返回 = vi.fn();
const mock更新岗位 = vi.fn();
const mock发布岗位 = vi.fn();
const mock删除岗位 = vi.fn();

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 进企业主壳: vi.fn(), 替换跳转: vi.fn(), 跳转: vi.fn() }),
}));
vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({
    状态: { 岗位列表: [页面岗位样本], 企业候选列表: [] },
    派发: vi.fn(),
    操作: { 更新岗位: mock更新岗位, 发布岗位: mock发布岗位, 删除岗位: mock删除岗位 },
  }),
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

describe('发布岗位页 Backend 提交', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
  });

  it('Backend 编辑保存成功前不导航', async () => {
    const 完成 = deferred<void>();
    mock更新岗位.mockReturnValue(完成.promise);
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes>
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(mock返回).not.toHaveBeenCalled();
    完成.resolve();
    await waitFor(() => expect(mock返回).toHaveBeenCalled());
  });
});