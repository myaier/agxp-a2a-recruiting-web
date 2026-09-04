// 求职意向管理 · Backend 权威身份（工作包 C）。
//
// Backend：求职状态行只读取已水合权威简历快照的 profile.status；快照缺失或
// status 为空串时显示中性值「—」，行不可点击、点击不产生本地轮转，也不读取
// 为注册流准备的页面态默认「在职」。
// Mock：保留现有三档本地循环原型。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 求职意向管理 from './求职意向管理';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }) }));

const 意向表 = [{ 编号: 'I-1', 标题: '后端工程师', 说明: '杭州 · 25-40K' }];

function 渲染Backend({
  status,
  页面身份,
}: {
  status: 'student' | 'employed' | 'unemployed' | '' | null;
  页面身份?: string;
}) {
  mock应用状态 = {
    数据源模式: 'backend',
    状态: { 求职意向表: 意向表, 基本信息: { 身份: 页面身份 ?? '在校' } },
    后端状态: { 简历快照: status === null ? null : { profile: { status } } },
  };
  return render(
    <MemoryRouter initialEntries={['/intent']}>
      <Routes>
        <Route path="/intent" element={<求职意向管理 />} />
      </Routes>
    </MemoryRouter>,
  );
}

function 渲染Mock() {
  mock应用状态 = {
    数据源模式: 'mock',
    状态: { 求职意向表: 意向表, 基本信息: { 身份: '在职' } },
    后端状态: { 简历快照: null },
  };
  return render(
    <MemoryRouter initialEntries={['/intent']}>
      <Routes>
        <Route path="/intent" element={<求职意向管理 />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mock跳转.mockClear();
  mock返回.mockClear();
});

describe('求职意向管理 · Backend 权威身份', () => {
  it.each([
    ['student', '在校 · 看机会'],
    ['employed', '在职 · 保密求职中'],
    ['unemployed', '离职 · 随时到岗'],
  ] as const)('Backend wire status %s 显示 %s', (status, 文案) => {
    渲染Backend({ status });
    expect(screen.getByText(文案)).toBeTruthy();
  });

  it.each([null, ''] as const)('Backend 快照/status 为 %j 时显示中性值且点击不轮转', async (status) => {
    const 用户 = userEvent.setup();
    渲染Backend({ status, 页面身份: '在职' });
    const 行 = screen.getByText('求职状态').closest('button');
    expect(screen.getByText('—')).toBeTruthy();
    if (行) await 用户.click(行);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('Backend 保留页面既有骨架', () => {
    渲染Backend({ status: 'employed' });
    expect(screen.getByText('想找什么工作？')).toBeTruthy();
    expect(screen.getByText('求职意向')).toBeTruthy();
  });
});

describe('求职意向管理 · Mock 原型行为保持', () => {
  it('连续点击仍按当前三档循环', async () => {
    const 用户 = userEvent.setup();
    渲染Mock();
    expect(screen.getByText('在职 · 看好机会')).toBeTruthy();
    await 用户.click(screen.getByText('求职状态').closest('button')!);
    expect(screen.getByText('在职 · 随便看看')).toBeTruthy();
    await 用户.click(screen.getByText('求职状态').closest('button')!);
    expect(screen.getByText('离职 · 尽快到岗')).toBeTruthy();
    await 用户.click(screen.getByText('求职状态').closest('button')!);
    expect(screen.getByText('在职 · 看好机会')).toBeTruthy();
  });
});