// 企业往来记录 · Backend 原型面退场（工作包 B，求职端 往来记录 的镜像）。
//
// Backend：:id 是 opaque Case ID —— 无效 ID 与真实 ID 同一个安全不可用状态，
// 不回退首条候选 fixture；唯一动作是导航到招聘 MatchCase 详情，不发叮嘱、
// 不起延迟弹层、不写企业规则。
// Mock：代号/画像标题、叮嘱 + 500ms 弹层、记成规则（派发 + 跳 AI 代理设置）原样。

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业往来记录 from './企业往来记录';
import { 企业往来记录 as 初始记录, 在谈候选列表 } from '../数据/企业端模拟数据';
import { 路径 } from '../路由/路径表';

const mock派发 = vi.fn();
const mock返回 = vi.fn();
const mock跳转 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }) }));

function 渲染(模式: 'mock' | 'backend', 路径值: string) {
  mock应用状态 = { 数据源模式: 模式, 派发: mock派发 };
  return render(
    <MemoryRouter initialEntries={[路径值]}>
      <Routes>
        <Route path="/hr/thread/:id" element={<企业往来记录 />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mock派发.mockClear();
  mock返回.mockClear();
  mock跳转.mockClear();
});

describe('企业往来记录 · Backend 只提供 Case 导航', () => {
  it.each(['mc_real', 'not-found'])(
    'Backend recruiter case %s 不回退 fixture，CTA 只导航同一 Case 详情',
    async (caseId) => {
      const 用户 = userEvent.setup();
      渲染('backend', '/hr/thread/' + caseId);
      expect(screen.getByText('完整 A2A 往来暂未提供查看器')).toBeTruthy();
      expect(screen.queryByText(在谈候选列表[0]!.代号)).toBeNull();
      expect(screen.queryByText(在谈候选列表[0]!.画像)).toBeNull();
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.queryByText(/记成规则/)).toBeNull();
      await 用户.click(screen.getByRole('button', { name: '查看阶段进展' }));
      expect(mock跳转).toHaveBeenCalledWith(路径.候选详情(caseId));
      expect(mock派发).not.toHaveBeenCalled();
    },
  );

  it('Backend 推进 fake timers 不升起拿不准弹层', () => {
    vi.useFakeTimers();
    try {
      渲染('backend', '/hr/thread/mc_real');
      act(() => {
        vi.advanceTimersByTime(500);
        vi.runAllTimers();
      });
      expect(screen.queryByRole('button', { name: '只这一次' })).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(mock派发).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('企业往来记录 · Mock 原型行为保持', () => {
  it('A-01 显示既有剧本，可发送叮嘱并延迟升起拿不准弹层', () => {
    vi.useFakeTimers();
    try {
      // fake timers 下 userEvent 的内部延时会把用例挂死，这里用同步 fireEvent
      //（仓库既有先例），500ms 弹层延时仍由 fake timers 推进验证
      渲染('mock', '/hr/thread/A-01');
      expect(screen.getByText(`${在谈候选列表[0]!.代号} · ${在谈候选列表[0]!.画像}`)).toBeTruthy();
      expect(screen.getByText(初始记录[2]!.内容)).toBeTruthy();
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '远程这事可以松一天' } });
      fireEvent.click(screen.getByRole('button', { name: '发送' }));
      expect(screen.getByText('⚑ 你介入叮嘱：远程这事可以松一天')).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByRole('button', { name: '只这一次' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: '记成规则' }));
      expect(mock派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '企业新增规则' }));
      expect(mock跳转).toHaveBeenCalledWith(路径.企业代理设置);
    } finally {
      vi.useRealTimers();
    }
  });

  it('无效 ID 维持既有首条兜底，不崩溃', () => {
    渲染('mock', '/hr/thread/不存在的编号');
    expect(
      screen.getByText(`${在谈候选列表[0]!.代号} · ${在谈候选列表[0]!.画像}`),
    ).toBeTruthy();
    expect(screen.getByText(初始记录[2]!.内容)).toBeTruthy();
  });
});