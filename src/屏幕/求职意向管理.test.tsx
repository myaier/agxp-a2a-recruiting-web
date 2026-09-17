// 求职意向管理 · 求职状态行（Spec §6：状态唯一归属候选 profile）。
//
// Backend：读已水合权威简历快照的 profile.status；Mock：读同一份页面 profile 身份
// （删除原来的本地三档轮转假状态）。两模式行都显示真实三态（在校/在职/离职，空值
// 未填写），点行进同一份状态编辑 —— 带 from=intentions 与来路证明，保存后回本页。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 创建候选编辑来路 } from '../流程/候选日常编辑';
import { 路径 } from '../路由/路径表';
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

function 渲染Mock(身份 = '在职') {
  mock应用状态 = {
    数据源模式: 'mock',
    状态: { 求职意向表: 意向表, 基本信息: { 身份 } },
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
  window.history.replaceState(null, '');
});

describe('求职意向管理 · 状态行读权威 profile', () => {
  it.each([
    ['student', '在校'],
    ['employed', '在职'],
    ['unemployed', '离职'],
  ] as const)('Backend wire status %s 显示 %s', (status, 文案) => {
    渲染Backend({ status });
    expect(screen.getByText(文案)).toBeTruthy();
  });

  it.each([null, ''] as const)('Backend 快照/status 为 %j 时显示未填写', (status) => {
    渲染Backend({ status, 页面身份: '在职' });
    const 行 = screen.getByText('求职状态').closest('button');
    expect(行?.textContent).toContain('未填写');
  });

  it('Mock 读同一份页面 profile 身份：不再本地轮转', async () => {
    渲染Mock('在职');
    const 用户 = userEvent.setup();
    expect(screen.getByText('在职')).toBeTruthy();
    const 行 = screen.getByText('求职状态').closest('button')!;
    await 用户.click(行);
    // 点击即进状态编辑，不再原地把文案轮转成下一档
    expect(mock跳转).toHaveBeenCalledTimes(1);
    expect(screen.getByText('在职')).toBeTruthy();
  });

  it('Backend 保留页面既有骨架', () => {
    渲染Backend({ status: 'employed' });
    expect(screen.getByText('想找什么工作？')).toBeTruthy();
    expect(screen.getByText('求职意向')).toBeTruthy();
  });
});

describe('求职意向管理 · 状态行进同一份状态编辑（from=intentions）', () => {
  it.each(['backend', 'mock'] as const)('%s：点行进带 intentions 来源与来路证明的状态页', async (模式) => {
    if (模式 === 'backend') 渲染Backend({ status: 'employed' });
    else 渲染Mock('离职');
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('求职状态').closest('button')!);
    expect(mock跳转).toHaveBeenCalledWith(
      `${路径.求职状态}?from=intentions`,
      创建候选编辑来路('intentions'),
    );
  });

  it('Backend 快照缺失（状态未知）仍可进入编辑，不写本地假状态', async () => {
    渲染Backend({ status: null });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('求职状态').closest('button')!);
    expect(mock跳转).toHaveBeenCalledWith(
      `${路径.求职状态}?from=intentions`,
      创建候选编辑来路('intentions'),
    );
    expect(screen.getByText('未填写')).toBeTruthy();
  });
});
