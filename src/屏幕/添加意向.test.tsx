// 添加意向页 Backend 提交测试（Task 7）：
// 保存意向成功后才返回，失败复用轻提示。
// Mock 下 操作 内部同步 dispatch，DOM/流程由现有 onboarding E2E 覆盖。
//
// 办公方式必填校验（truthfulness Task 1）：保存键不再因缺字段置灰 ——
// 点保存走 校验必填，按 工作城市 → 期望职位 → 办公方式 顺序轻提示，
// 办公方式那组还要 scrollIntoView + 聚焦首个选钮 + aria-invalid/aria-description。
// 新建（/intentions/new）与编辑（/intentions/:id）两条路由都要可达，所以 it.each 双跑。
// 轻提示 是纯 DOM 单例组件，这里 mock 掉既不碰真实组件也能断言文案。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { 意向草稿型 } from '../数据/招聘数据源类型';
import 添加意向 from './添加意向';

const mock返回 = vi.fn();
const mock保存意向 = vi.fn();
const mock删除意向 = vi.fn();
const mock派发 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());

vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => undefined;
}

const 基础草稿: 意向草稿型 = {
  编辑编号: null,
  求职类型: '全职',
  工作城市: '上海',
  期望职位: '产品经理',
  感兴趣城市们: [],
  薪资下限: 10,
  薪资上限: 20,
  期望行业们: [],
  办公方式: ['混合'],
  后端招聘类型: null,
  求职类型已改: false,
};

let 当前草稿: 意向草稿型 = { ...基础草稿, 办公方式: [...基础草稿.办公方式] };

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: vi.fn(), 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({
    状态: { 意向草稿: 当前草稿 },
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

/** 新建 / 编辑两条路由都挂在同一屏组件下，测试里按 path 选入口 */
function 渲染意向(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/intentions/new" element={<添加意向 />} />
        <Route path="/intentions/:id" element={<添加意向 />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('添加意向页 Backend 提交', () => {
  beforeEach(() => {
    当前草稿 = { ...基础草稿, 办公方式: [...基础草稿.办公方式] };
    mock返回.mockClear();
    mock保存意向.mockClear();
    mock删除意向.mockClear();
    mock派发.mockClear();
    mock轻提示.mockClear();
  });

  it('保存 Backend 意向成功后才返回，失败复用轻提示', async () => {
    const 完成 = deferred<void>();
    mock保存意向.mockReturnValue(完成.promise);
    渲染意向('/intentions/new');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(mock返回).not.toHaveBeenCalled();
    完成.resolve();
    await waitFor(() => expect(mock返回).toHaveBeenCalled());
  });
});

describe('添加意向页 办公方式必填校验', () => {
  beforeEach(() => {
    当前草稿 = { ...基础草稿, 办公方式: [...基础草稿.办公方式] };
    mock返回.mockClear();
    mock保存意向.mockClear();
    mock删除意向.mockClear();
    mock派发.mockClear();
    mock轻提示.mockClear();
  });

  it.each([
    ['/intentions/new', null],
    ['/intentions/int_1', 'int_1'],
  ])('办公方式为空时 %s 可点击保存、提示并聚焦，且零 mutation', async (path, 编辑编号) => {
    当前草稿 = { ...基础草稿, 编辑编号, 办公方式: [] };
    const user = userEvent.setup();
    渲染意向(path);

    const 保存 = screen.getByRole('button', { name: '保存' });
    expect((保存 as HTMLButtonElement).disabled).toBe(false);
    await user.click(保存);

    expect(mock轻提示).toHaveBeenCalledWith('请选择办公方式');
    expect(mock保存意向).not.toHaveBeenCalled();
    const 组 = screen.getByRole('group', { name: '办公方式' });
    expect(组.getAttribute('aria-invalid')).toBe('true');
    expect(组.getAttribute('aria-description')).toBe('请选择办公方式');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '现场' }));
  });

  it('选择任一办公方式立即清除 invalid 状态', async () => {
    当前草稿 = { ...基础草稿, 办公方式: [] };
    const user = userEvent.setup();
    渲染意向('/intentions/new');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await user.click(screen.getByRole('button', { name: '远程' }));
    const 组 = screen.getByRole('group', { name: '办公方式' });
    expect(组.getAttribute('aria-invalid')).toBeNull();
    expect(组.getAttribute('aria-description')).toBeNull();
  });
});
