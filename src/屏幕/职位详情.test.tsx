// 职位详情 · 委托入谈一次点击契约（P0）：「让AI代理去谈」保持一次点击直接派发并跳转，
// 不增加确认层。校准 S1/S3 语义后这一交互流程不变。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 职位详情 from './职位详情';

const mock派发 = vi.fn();
const mock替换跳转 = vi.fn();
const mock返回 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 替换跳转: mock替换跳转, 跳转: vi.fn() }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

function 渲染(编号 = 'M-12') {
  return render(
    <MemoryRouter initialEntries={[`/job/${编号}`]}>
      <Routes>
        <Route path="/job/:id" element={<职位详情 />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('职位详情 · 让 AI 代理去谈', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock替换跳转.mockClear();
    mock返回.mockClear();
    mock应用状态 = { 状态: { 已委托: [], 简历技能: [] }, 派发: mock派发 };
  });

  it('让 AI 代理去谈保持一次点击，不增加确认层', async () => {
    const 用户 = userEvent.setup();
    渲染('M-12');
    await 用户.click(screen.getByRole('button', { name: /让AI代理去谈/ }));
    expect(mock派发).toHaveBeenCalledWith({
      型: '委托入谈',
      岗: expect.objectContaining({ 编号: 'M-12' }),
    });
    expect(mock替换跳转).toHaveBeenCalledTimes(1);
    // 没有新增的二次确认入口
    expect(screen.queryByText('同意并去谈')).toBeNull();
  });
});