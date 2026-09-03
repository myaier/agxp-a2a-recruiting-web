// Backend MatchCase 真相源修复：企业代理详情「正在代谈」只读当前 recruiter 主体的
// unfiltered P5 open 统计；企业候选列表（legacy fixture）不再进入 Backend 展示；
// 直达无快照/owner 不匹配诚实显示 —；Mock 保持 legacy 长度且零 P5 operation 调用。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业代理详情 from './企业代理详情';
import { BFF主体样本 } from '../测试/BFF样本';
import { P5范围键 } from '../状态/后端/MatchCase操作';
import type { P5列表项 } from '../数据/招聘数据源/MatchCase';
import type { P5列表快照 } from '../状态/后端/类型';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const 设置P5范围 = vi.fn();
const 加载工作区 = vi.fn(async () => undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }) }));

function 招聘行(caseId: string): P5列表项 {
  return {
    role: 'recruiter',
    state: {
      caseId, lifecycle: 'open', stage: 'anonymous_screening', status: 'running',
      step: 'policy_check', round: 0, roundBudget: 3, needsUser: false,
      outcome: null, outcomeCode: null,
      createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T09:00:00Z', finalizedAt: null,
      agentAttention: null,
    },
    needsAction: false,
    candidateAlias: 'candidate-0123456789ab',
    job: {
      jobId: 'job_0123456789abcdef0123456789abcdef',
      job: { title: '后端工程师', location: '上海', publicSalaryRange: '20-30K', requiredSkills: ['Go'] },
    },
  };
}

function 成功P5快照(
  items: P5列表项[], nextCursor: string | null, ownerSubjectId: string | null = 'sub_r',
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
  企业候选列表?: unknown[];
}) {
  mock应用状态 = {
    状态: {
      企业规则: [],
      企业候选列表: 选项.企业候选列表 ?? [],
    },
    派发: mock派发,
    数据源模式: 选项.模式,
    操作: { 设置P5范围, 加载工作区 },
    后端状态: {
      主体: 选项.主体 === undefined
        ? { ...BFF主体样本, subject_id: 'sub_r', last_used_role: 'recruiter' }
        : 选项.主体,
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      P5工作区: 选项.P5快照 === undefined
        ? {}
        : { [P5范围键.open('recruiter', null)]: 选项.P5快照 },
    },
  };
}

describe('企业代理详情 · Backend 权威 MatchCase 统计', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    设置P5范围.mockClear();
    加载工作区.mockClear();
  });

  it('已有 recruiter unfiltered 快照：「正在代谈」显示 selector 的 open 值', () => {
    置应用状态({ 模式: 'backend', P5快照: 成功P5快照([招聘行('mc_1'), 招聘行('mc_2')], null) });
    render(<MemoryRouter><企业代理详情 /></MemoryRouter>);
    expect(screen.getByText('2')).toBeTruthy();
    expect(设置P5范围).not.toHaveBeenCalled();
    expect(加载工作区).not.toHaveBeenCalled();
  });

  it('企业候选列表不再进入 Backend 展示：无快照/owner 不匹配显示 —', () => {
    // legacy fixture 故意带 3 行 —— Backend 分支绝不数它们
    置应用状态({
      模式: 'backend',
      企业候选列表: [{ 编号: 'A-01' }, { 编号: 'A-02' }, { 编号: 'A-03' }],
      P5快照: 成功P5快照([招聘行('mc_1')], null, 'sub_old'),
      主体: { ...BFF主体样本, subject_id: 'sub_new', last_used_role: 'recruiter' },
    });
    render(<MemoryRouter><企业代理详情 /></MemoryRouter>);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('3')).toBeNull();
    expect(screen.queryByText('1')).toBeNull();
  });

  it('Mock 仍显示 legacy 企业候选列表长度且不调用 P5 operation', () => {
    置应用状态({ 模式: 'mock', 主体: null, 企业候选列表: [{ 编号: 'A-01' }, { 编号: 'A-02' }] });
    render(<MemoryRouter><企业代理详情 /></MemoryRouter>);
    expect(screen.getByText('2')).toBeTruthy();
    expect(设置P5范围).not.toHaveBeenCalled();
    expect(加载工作区).not.toHaveBeenCalled();
  });
});