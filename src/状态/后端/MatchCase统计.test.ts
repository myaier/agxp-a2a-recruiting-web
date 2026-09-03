// Backend MatchCase 真相源修复：共享纯 selector 的行为测试 —— open 统计
//（open / anonymous_screening / needs_action 计数 + N+ 下界标记）与候选 P5 横幅四态投影。
// fixture 是完整 P5列表项（decoder 输出形状），不删字段、不用 as 绕开领域类型。

import { describe, expect, it } from 'vitest';
import type { P5列表项 } from '../../数据/招聘数据源/MatchCase';
import type { P5列表快照 } from './类型';
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

describe('取P5Open统计', () => {
  it('完整成功窗口按 lifecycle/stage/needsAction 计数', () => {
    expect(取P5Open统计(成功([
      行('mc_1', 'anonymous_screening', true),
      行('mc_2', 'needs_coordination', false),
      行('mc_3', 'intent_confirmation', true),
      行('mc_4', 'intent_confirmation', true, 'completed'),
    ], null), 'sub_1')).toEqual({ open: '3', anonymousScreening: '1', needsAction: '2' });
  });

  it('未尽分页给每个派生计数加 +，完整空页为 0', () => {
    expect(取P5Open统计(成功([], 'cursor_1'), 'sub_1'))
      .toEqual({ open: '0+', anonymousScreening: '0+', needsAction: '0+' });
    expect(取P5Open统计(成功([], null), 'sub_1'))
      .toEqual({ open: '0', anonymousScreening: '0', needsAction: '0' });
  });

  it.each([undefined, { ...成功([], null), 阶段: '失败' as const }])('非成功快照为中性值', (snapshot) => {
    expect(取P5Open统计(snapshot, 'sub_1'))
      .toEqual({ open: '—', anonymousScreening: '—', needsAction: '—' });
  });

  it('owner 不匹配时不泄漏旧主体统计', () => {
    expect(取P5Open统计(成功([行('mc_1', 'anonymous_screening', true)], null), 'sub_2'))
      .toEqual({ open: '—', anonymousScreening: '—', needsAction: '—' });
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