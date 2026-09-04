// 初筛对话（单条初筛回看）· Backend 退场（工作包 B）。
//
// Backend：真实 ID 与无效 ID 都只显示同一个安全不可用状态，不读取初筛 fixture、
// 不渲染结论卡与核对清单。
// Mock：合法 ID 显示既有结论与对话；无效 ID 维持既有「没有这条初筛记录」空态。

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 初筛对话 from './初筛对话';
import { 本周初筛记录 } from '../数据/企业端模拟数据';

const mock返回 = vi.fn();
const mock跳转 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }) }));

function 渲染对话(模式: 'mock' | 'backend', 路径值: string) {
  mock应用状态 = { 数据源模式: 模式 };
  return render(
    <MemoryRouter initialEntries={[路径值]}>
      <Routes>
        <Route path="/hr/screening-log/:id" element={<初筛对话 />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mock返回.mockClear();
  mock跳转.mockClear();
});

describe('初筛对话 · Backend 退场', () => {
  it.each(['S-01', 'not-found'])('Backend 初筛对话 %s 不读取 fixture', (id) => {
    渲染对话('backend', '/hr/screening-log/' + id);
    expect(screen.getByText('该原型日志没有权威数据源')).toBeTruthy();
    expect(screen.queryByText(本周初筛记录[0]!.代号)).toBeNull();
    expect(screen.queryByText(本周初筛记录[0]!.画像)).toBeNull();
    expect(screen.queryByText(/硬性 [0-9]/)).toBeNull();
    expect(screen.queryByText(本周初筛记录[0]!.结论)).toBeNull();
  });
});

describe('初筛对话 · Mock 原型行为保持', () => {
  it('合法 ID 显示既有代号、结论与对话', () => {
    渲染对话('mock', '/hr/screening-log/A-07');
    expect(screen.getByText(本周初筛记录[0]!.代号)).toBeTruthy();
    expect(screen.getByText(本周初筛记录[0]!.画像)).toBeTruthy();
    expect(screen.getByText(本周初筛记录[0]!.结论)).toBeTruthy();
    expect(screen.getAllByText(/硬性/).length).toBeGreaterThan(0);
  });

  it('无效 ID 维持既有空态，不崩溃', () => {
    渲染对话('mock', '/hr/screening-log/not-found');
    expect(screen.getByText('没有这条初筛记录')).toBeTruthy();
  });
});