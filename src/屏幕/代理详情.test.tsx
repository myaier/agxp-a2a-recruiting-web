// Backend MatchCase 真相源修复：代理详情「正在代谈」只读当前 candidate 主体的
// unfiltered P5 open 统计（从「我的」进入时快照已在内存），直达无快照诚实显示 —，
// owner 不匹配同样 —；Mock 保持 legacy 在谈列表 长度且零 P5 operation 调用。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 代理详情 from './代理详情';
import { BFF主体样本 } from '../测试/BFF样本';
import { P5范围键 } from '../状态/后端/MatchCase操作';
import type { P5列表项 } from '../数据/招聘数据源/MatchCase';
import type { P5列表快照 } from '../状态/后端/类型';
import { 初始状态 } from '../状态/初始状态';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const 设置P5范围 = vi.fn();
const 加载工作区 = vi.fn(async () => undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }) }));

const 意向ID = 'int_0123456789abcdef0123456789abcdef';

function 行(caseId: string): P5列表项 {
  return {
    role: 'candidate',
    state: {
      caseId, lifecycle: 'open', stage: 'anonymous_screening', status: 'running',
      step: 'policy_check', round: 0, roundBudget: 3, needsUser: false,
      outcome: null, outcomeCode: null,
      createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T09:00:00Z', finalizedAt: null,
      agentAttention: null,
    },
    needsAction: true,
    intentionId: 意向ID,
    job: {
      jobId: 'job_0123456789abcdef0123456789abcdef',
      job: { title: '后端工程师', location: '上海', publicSalaryRange: '20-30K', requiredSkills: ['Go'] },
    },
  };
}

function 成功P5快照(
  items: P5列表项[], nextCursor: string | null, ownerSubjectId: string | null = 'sub_1',
): P5列表快照 {
  return {
    ownerSubjectId, 阶段: '成功', 刷新中: false,
    items, nextCursor, 已加载页数: 1, error: null, generation: 1,
  };
}

function 置应用状态(选项: {
  模式: 'backend' | 'mock';
  主体?: { subject_id: string; last_used_role: string } | null;
  P5快照?: P5列表快照;
}) {
  mock应用状态 = {
    状态: { ...初始状态, 全局规则: [], 意向级规则: [] },
    派发: mock派发,
    数据源模式: 选项.模式,
    操作: { 设置P5范围, 加载工作区 },
    后端状态: {
      主体: 选项.主体 === undefined
        ? { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'candidate' }
        : 选项.主体,
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      P5工作区: 选项.P5快照 === undefined
        ? {}
        : { [P5范围键.open('candidate', null)]: 选项.P5快照 },
    },
  };
}

describe('代理详情 · Backend 权威 MatchCase 统计', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    设置P5范围.mockClear();
    加载工作区.mockClear();
  });

  it('从「我的」进入时已有 candidate unfiltered 快照：「正在代谈」显示 selector 的 open 值', () => {
    置应用状态({ 模式: 'backend', P5快照: 成功P5快照([行('mc_1'), 行('mc_2')], null) });
    render(<MemoryRouter><代理详情 /></MemoryRouter>);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
    // 相邻展示页只消费内存快照：不注册、不请求
    expect(设置P5范围).not.toHaveBeenCalled();
    expect(加载工作区).not.toHaveBeenCalled();
  });

  it('直达无快照显示 —；owner 不匹配同样 —，legacy 数组绝不冒充', () => {
    置应用状态({ 模式: 'backend' });
    render(<MemoryRouter><代理详情 /></MemoryRouter>);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText(String(初始状态.在谈列表.length))).toBeNull();
  });

  it('Mock 仍显示 legacy 在谈列表长度且不调用 P5 operation', () => {
    置应用状态({ 模式: 'mock', 主体: null });
    render(<MemoryRouter><代理详情 /></MemoryRouter>);
    expect(screen.getByText(String(初始状态.在谈列表.length))).toBeTruthy();
    expect(设置P5范围).not.toHaveBeenCalled();
    expect(加载工作区).not.toHaveBeenCalled();
  });
});