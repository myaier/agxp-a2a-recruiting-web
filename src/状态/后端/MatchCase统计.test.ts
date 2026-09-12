// Backend MatchCase 精确统计：共享纯 selector 的行为测试 —— summary 精确统计投影
//（open / anonymous_screening / needs_action / 两个终局投影）与候选待办横幅四态投影
//（J-PILOT-01 Task 4：横幅改读同一全意向连续 active 快照，文案「需要你处理」）。
// fixture 是完整领域形状，不删字段、不用 as 绕开类型。

import { describe, expect, it } from 'vitest';
import type { NegotiationCard } from '../../数据/招聘数据源/连续代谈';
import type { P5连续列表快照, P5摘要快照 } from './类型';
import { 取P5Open统计, 取P5候选横幅状态 } from './MatchCase统计';

const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 职位ID = 'job_0123456789abcdef0123456789abcdef';

/** 连续卡样本：needs_action 是横幅待办数的唯一权威（不读 phase / 嵌套 case_state）。 */
function 连续卡(选项: { recordId: string; phase: NegotiationCard['phase']; needsAction?: boolean }): NegotiationCard {
  return {
    needs_action: 选项.needsAction ?? false,
    record_id: 选项.recordId,
    record_kind: 选项.recordId.startsWith('dlg_') ? 'delegation' : 'case',
    intention_id: 意向ID,
    job: {
      job_id: 职位ID, title: 'AI 产品实习生', location: '上海',
      public_salary_range: '300-500 元/天', availability: 'available',
      organization: null, required_skills: null, recruitment_type: null,
      workplace_mode: null, annual_salary_months: null,
    },
    delegation_id: null, evaluation_id: null, case_id: null,
    shelf: 'active',
    phase: 选项.phase,
    case_state: null,
    failure: null, refusal_code: null,
    actions: { retry: false, archive: false, open_case: false },
    retry_generation: 0,
    match_score: null,
    created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T09:00:00Z', archived_at: null,
  };
}

function 连续快照(选项: {
  阶段?: P5连续列表快照['阶段'];
  items?: NegotiationCard[];
  nextCursor?: string | null;
  error?: string | null;
  ownerSubjectId?: string | null;
} = {}): P5连续列表快照 {
  return {
    ownerSubjectId: 选项.ownerSubjectId ?? 'sub_1',
    阶段: 选项.阶段 ?? '成功',
    刷新中: 选项.阶段 === '进行中',
    items: 选项.items ?? [],
    nextCursor: 选项.nextCursor ?? null,
    已加载页数: 1,
    error: 选项.error ?? null,
    generation: 1,
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

  it('权威零明确给 0，与未加载的中性值区分', () => {
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

  // J-PILOT-01 Task 4：横幅改读同一全意向连续 active 快照（candidate 首页与看市场共用），
  // 文案「需要你处理」；首载/失败/未读尽不伪精确计数。
  describe('候选待办横幅 · 全意向连续 active 快照', () => {
    it('未载入（缺快照 / 首载在飞 / owner 不匹配）只说正在读入，不给定论', () => {
      expect(取P5候选横幅状态(undefined, 'sub_1').强调).toBe('正在读入在谈职位…');
      expect(取P5候选横幅状态(连续快照({ 阶段: '进行中' }), 'sub_1').强调)
        .toBe('正在读入在谈职位…');
      expect(取P5候选横幅状态(连续快照({ ownerSubjectId: 'sub_2' }), 'sub_1').强调)
        .toBe('正在读入在谈职位…');
      expect(取P5候选横幅状态(连续快照(), null).强调).toBe('正在读入在谈职位…');
    });

    it('读尽才给精确「需要你处理」计数；未读尽只给非计数文案', () => {
      const 待办卡 = 连续卡({ recordId: 'dlg_1', phase: 'evaluating', needsAction: true });
      expect(取P5候选横幅状态(连续快照({ items: [待办卡] }), 'sub_1').强调)
        .toBe('1 个职位需要你处理');
      expect(取P5候选横幅状态(连续快照({ items: [待办卡], nextCursor: 'b2x' }), 'sub_1').强调)
        .toBe('有职位需要你处理');
      expect(取P5候选横幅状态(连续快照({
        items: [
          连续卡({ recordId: 'dlg_a', phase: 'evaluating', needsAction: true }),
          连续卡({ recordId: 'dlg_b', phase: 'accepted', needsAction: true }),
        ],
      }), 'sub_1').强调).toBe('2 个职位需要你处理');
    });

    it('零待办分支：失败/未读尽不下「暂时没有」的定论，读尽才定论', () => {
      expect(取P5候选横幅状态(连续快照(), 'sub_1').强调).toBe('暂时没有需要你处理的');
      expect(取P5候选横幅状态(连续快照({ nextCursor: 'b2x' }), 'sub_1').强调)
        .toBe('已读入的里暂时没有需要你处理的');
      expect(取P5候选横幅状态(连续快照({
        items: [连续卡({ recordId: 'dlg_1', phase: 'accepted' })],
        nextCursor: 'b2x',
      }), 'sub_1').强调).toBe('已读入的里暂时没有需要你处理的');
      // 首载失败（空 items + error）：横幅同样不给定论
      expect(取P5候选横幅状态(连续快照({
        阶段: '失败', error: '服务暂时不可用，请稍后再试',
      }), 'sub_1').强调).toBe('已读入的里暂时没有需要你处理的');
    });

    it('待办数只读 needs_action，不读 phase / 嵌套 case_state', () => {
      const 状态 = 取P5候选横幅状态(连续快照({
        items: [
          连续卡({ recordId: 'mc_1', phase: 'case_started' }),
          连续卡({ recordId: 'dlg_2', phase: 'evaluating', needsAction: true }),
        ],
      }), 'sub_1');
      expect(状态.已载待办数).toBe(1);
      expect(状态.读尽).toBe(true);
    });
  });
});

// （旧 Case 列表快照的行样本 helper 随横幅改读连续快照一并退役；招聘端 summary 统计仍由
//   取P5Open统计 承接，fixture 只剩 P5摘要快照 的权威摘要形状。）