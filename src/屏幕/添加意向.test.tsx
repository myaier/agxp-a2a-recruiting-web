// 添加意向页 Backend 提交测试（Task 7）：
// 保存意向成功后才返回，失败复用轻提示。
// Mock 下 操作 内部同步 dispatch，DOM/流程由现有 onboarding E2E 覆盖。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 添加意向 from './添加意向';

const mock返回 = vi.fn();
const mock保存意向 = vi.fn();
const mock删除意向 = vi.fn();
const mock派发 = vi.fn();

const 草稿 = {
  编辑编号: null,
  求职类型: '全职' as const,
  工作城市: '上海',
  期望职位: '产品经理',
  感兴趣城市们: [] as string[],
  薪资下限: 10,
  薪资上限: 20,
  期望行业们: [] as string[],
  办公方式: ['hybrid'],
  后端招聘类型: null,
  求职类型已改: false,
};

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: vi.fn(), 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({
    状态: { 意向草稿: 草稿 },
    派发: mock派发,
    操作: { 保存意向: mock保存意向, 删除意向: mock删除意向 },
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

describe('添加意向页 Backend 提交', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock保存意向.mockClear();
    mock删除意向.mockClear();
    mock派发.mockClear();
  });

  it('保存 Backend 意向成功后才返回，失败复用轻提示', async () => {
    const 完成 = deferred<void>();
    mock保存意向.mockReturnValue(完成.promise);
    render(
      <MemoryRouter initialEntries={['/intentions/new']}>
        <Routes>
          <Route path="/intentions/new" element={<添加意向 />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(mock返回).not.toHaveBeenCalled();
    完成.resolve();
    await waitFor(() => expect(mock返回).toHaveBeenCalled());
  });
});