// 候选详情（企业端）的第一个测试文件（P5 Task 5 创建，此前该屏无测试）：
// Backend 分支只渲染共享 P5 详情（屏幕/P5/MatchCase详情，role=recruiter）—— 按 URL
// case_id + 已认证角色强制读详情，不读 企业候选列表、不读匿名简历表、零 Mock 候选渲染；
// Mock 分支保持原行为（Tab/真名/在线简历在场）且零 P5 请求。
// 仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 候选详情 from './候选详情';
import { P5范围键 } from '../状态/后端/MatchCase操作';
import { 在谈候选列表 } from '../数据/企业端模拟数据';

// jsdom 不实现 scrollIntoView，本屏挂载后自动定位会调用它
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock派发 = vi.fn();
const mock设置P5范围 = vi.fn();
const mock读取详情 = vi.fn(async () => undefined);
const mock新增叮嘱 = vi.fn(async () => undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }),
}));

function 渲染候选详情页(编号: string) {
  return render(
    <MemoryRouter initialEntries={[`/hr/candidate/${编号}`]}>
      <Routes>
        <Route path="/hr/candidate/:id" element={<候选详情 />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('候选详情 · Backend 分支渲染共享 P5 详情（recruiter）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock派发.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock新增叮嘱.mockClear();
    mock应用状态 = {
      数据源模式: 'backend',
      派发: mock派发,
      状态: {
        企业候选列表: 在谈候选列表,
        候选决策: {},
        候选决策快照: {},
        决策: {},
        决策快照: {},
        叮嘱表: {},
      },
      后端状态: {
        已登录: true,
        主体: {
          subject_id: 'sub_1',
          roles: [{ role: 'recruiter', status: 'active' }],
          last_used_role: 'recruiter',
        },
        P5详情: {},
      },
      操作: {
        设置P5范围: mock设置P5范围,
        读取详情: mock读取详情,
        新增叮嘱: mock新增叮嘱,
      },
    };
  });

  it('按 URL case_id 强制读 recruiter 详情；Mock 候选（真名/代号/在线简历 Tab）不进视图', () => {
    渲染候选详情页('mc_hr');
    expect(mock设置P5范围).toHaveBeenCalledWith('recruiter', P5范围键.detail('recruiter', 'mc_hr'));
    expect(mock读取详情).toHaveBeenCalledWith('recruiter', 'mc_hr', true);
    // Mock 候选对象一个字段都不渲染（列表记忆零读取）
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(screen.queryByText('陈屿')).toBeNull();
    expect(screen.queryByRole('button', { name: '在线简历' })).toBeNull();
    expect(screen.getByText('正在读入这一单…')).toBeTruthy();
  });
});

describe('候选详情 · Mock 分支原行为且零 P5 请求', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock派发.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock新增叮嘱.mockClear();
    // 数据源模式 缺席 = Mock 分支（包壳屏只在 Backend 分支渲染 P5 详情）
    mock应用状态 = {
      状态: {
        企业候选列表: 在谈候选列表,
        候选决策: {},
        候选决策快照: {},
        决策: {},
        决策快照: {},
        叮嘱表: {},
      },
      派发: mock派发,
    };
  });

  it('A-01 原样渲染（真名/在线简历 Tab 在场），零 P5 请求', async () => {
    渲染候选详情页('A-01');
    // A-01 的 S1 已递交原件：真名非空显示真名（沈亦舟），与 Mock 行为一致
    expect(await screen.findByText('沈亦舟')).toBeTruthy();
    expect(screen.getByRole('button', { name: '在线简历' })).toBeTruthy(); // Mock 的 Tab 仍在
    expect(mock设置P5范围).not.toHaveBeenCalled();
    expect(mock读取详情).not.toHaveBeenCalled();
    expect(mock新增叮嘱).not.toHaveBeenCalled();
  });
});
