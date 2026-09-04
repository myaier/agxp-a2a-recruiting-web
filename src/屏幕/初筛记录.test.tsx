// 初筛记录（本周初筛列表）· Backend 退场（工作包 B）。
//
// Backend：该原型日志没有权威数据源 —— 整屏只剩中性说明，不渲染任何 fixture
// 代号/画像/硬性计数，也不提供行级导航。
// Mock：按岗位分组的既有列表原样，行点击仍导航到单条初筛对话。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 初筛记录 from './初筛记录';
import { 在招岗位列表, 本周初筛记录 } from '../数据/企业端模拟数据';
import { 路径 } from '../路由/路径表';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }) }));

function 渲染列表(模式: 'mock' | 'backend', 路径值: string) {
  mock应用状态 = { 数据源模式: 模式 };
  return render(
    <MemoryRouter initialEntries={[路径值]}>
      <Routes>
        <Route path="/hr/screening-log" element={<初筛记录 />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mock跳转.mockClear();
  mock返回.mockClear();
});

describe('初筛记录 · Backend 退场', () => {
  it('Backend 初筛列表不显示 fixture', () => {
    渲染列表('backend', '/hr/screening-log');
    expect(screen.getByText('该原型日志没有权威数据源')).toBeTruthy();
    expect(screen.queryByText(本周初筛记录[0]!.代号)).toBeNull();
    expect(screen.queryByText(本周初筛记录[0]!.画像)).toBeNull();
    expect(screen.queryByText(在招岗位列表[0]!.名称)).toBeNull();
    expect(screen.queryByText(/硬性 [0-9]/)).toBeNull();
  });
});

describe('初筛记录 · Mock 原型行为保持', () => {
  it('按岗位分组渲染 fixture，行点击导航到单条初筛对话', async () => {
    const 用户 = userEvent.setup();
    渲染列表('mock', '/hr/screening-log');
    expect(screen.getByText(在招岗位列表[0]!.名称)).toBeTruthy();
    expect(screen.getByText(本周初筛记录[0]!.代号)).toBeTruthy();
    expect(screen.getByText(本周初筛记录[1]!.代号)).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: /苏含章/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.初筛对话('A-07'));
  });
});