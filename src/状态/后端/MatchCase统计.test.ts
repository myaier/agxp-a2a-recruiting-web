// Backend MatchCase 精确统计：共享纯 selector 的行为测试 —— summary 精确统计投影
//（open / anonymous_screening / needs_action / 两个终局投影）与候选 P5 横幅四态投影
//（横幅仍由 open 列表快照驱动）。fixture 是完整领域形状，不删字段、不用 as 绕开类型。

import { describe, expect, it } from 'vitest';
import type { P5列表项 } from '../../数据/招聘数据源/MatchCase';
import type { P5列表快照, P5摘要快照 } from './类型';
import { 取P5Open统计, 取P5候选横幅状态 } from './MatchCase统计';

function 行(
  caseId: string,
  stage: P5列表项['state']['stage'],
  needsAction: boolean,
  lifecycle: P5列表项['state']['lifecycle'] = 'open',
): P5列表项 {
  return {
    role: 'candidate',
    state: {
      caseId, lifecycle, stage,
      status: lifecycle === 'open' ? 'running' : lifecycle === 'ended' ? 'ended' : 'passed',
      step: lifecycle === 'open' ? 'policy_check' : 'complete',
      round: 0, roundBudget: 3, needsUser: false,
      outcome: null, outcomeCode: null,
      createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T09:00:00Z',
      finalizedAt: lifecycle === 'open' ? null : '2026-09-01T10:00:00Z',
      agentAttention: null,
    },
    needsAction,
    intentionId: 'int_0123456789abcdef0123456789abcdef',
    job: {
      jobId: 'job_0123456789abcdef0123456789abcdef',
      job: { title: '后端工程师', location: '上海', publicSalaryRange: '20-30K', requiredSkills: ['Go'] },
    },
  };
}

function 成功(items: P5列表项[], nextCursor: string | null): P5列表快照 {
  return {
    ownerSubjectId: 'sub_1', 阶段: '成功', 刷新中: false,
    items, nextCursor, 已加载页数: 1, error: null, generation: 1,
  };
}

const 权威摘要 = {
  openTotal: 51,
  openAnonymousScreeningTotal: 17,
  openNeedsActionTotal: 9,
  endedTotal: 4,
  completedTotal: 3,
};

function 成功摘要(覆盖: Partial<P5摘要快照> = {}): P5摘要快照 {
  return {
    ownerSubjectId: 'sub_1', 阶段: '成功', 刷新中: false,
    summary: 权威摘要, error: null, generation: 1,
    ...覆盖,
  };
}

describe('MatchCase 统计 selector', () => {
  it('成功 summary 返回跨页精确数字和两个终局投影', () => {
    expect(取P5Open统计(成功摘要(), 'sub_1')).toEqual({
      open: '51', anonymousScreening: '17', needsAction: '9', archived: '7', completed: '3',
    });
  });

  it('权威零与未加载的中性值可区分', () => {
    expect(取P5Open统计(成功摘要({
      summary: {
        openTotal: 0,
        openAnonymousScreeningTotal: 0,
        openNeedsActionTotal: 0,
        endedTotal: 0,
        completedTotal: 0,
      },
    }), 'sub_1')).toEqual({
      open: '0', anonymousScreening: '0', needsAction: '0', archived: '0', completed: '0',
    });
    expect(取P5Open统计(undefined, 'sub_1')).toEqual({
      open: '—', anonymousScreening: '—', needsAction: '—', archived: '—', completed: '—',
    });
  });

  it.each([
    成功摘要({ 阶段: '进行中', 刷新中: true, summary: null }),
    成功摘要({ 阶段: '失败', summary: null, error: '失败' }),
    成功摘要({ 刷新中: true, summary: null }),
    成功摘要({ ownerSubjectId: 'sub_old' }),
  ])('加载、刷新、失败或 owner 不匹配都显示中性值', (snapshot) => {
    expect(取P5Open统计(snapshot, 'sub_1')).toEqual({
      open: '—', anonymousScreening: '—', needsAction: '—', archived: '—', completed: '—',
    });
  });

  it('候选横幅保持既有四态且 owner 不匹配视为未载入', () => {
    expect(取P5候选横幅状态(undefined, 'sub_1', true).强调).toBe('正在读入在谈职位…');
    expect(取P5候选横幅状态(成功([], null), 'sub_1', true))
      .toEqual({ 强调: '暂时没有需要你介入的', 已载待办数: 0, 读尽: true });
    expect(取P5候选横幅状态(成功([], 'cursor_1'), 'sub_1', true).强调)
      .toBe('已读入的里暂时没有需要你介入的');
    expect(取P5候选横幅状态(成功([行('mc_1', 'anonymous_screening', true)], 'cursor_1'), 'sub_1', true).强调)
      .toBe('有职位需要你协调');
    expect(取P5候选横幅状态(成功([行('mc_1', 'anonymous_screening', true)], null), 'sub_1', true).强调)
      .toBe('1 个职位需要你协调');
    expect(取P5候选横幅状态(成功([], null), 'sub_2', true).强调).toBe('正在读入在谈职位…');
    expect(取P5候选横幅状态(成功([], null), null, true).强调).toBe('正在读入在谈职位…');
    expect(取P5候选横幅状态(undefined, 'sub_1', false).强调).toBe('暂时没有需要你介入的');
  });
});