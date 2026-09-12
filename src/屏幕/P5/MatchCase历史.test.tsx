// P5 Task 7（J-PILOT-01 Task 4 修订候选半边）：候选连续历史（单一服务端分页集合）与
// 招聘双终局架子的行为测试。
// 候选半边覆盖：单一连续 history 集合原序渲染原白卡视觉、显示结果/失败原因、
// needs_action=false 仍可点进恢复详情（不据 needs_action 隐藏卡或禁止导航）、
// 加载更多接 追加连续列表、手动刷新 force 首屏、刷新失败旧条目保留、历史零轮询、
// owner 不匹配不显示旧主体行。
// 招聘端保持：completed/ended 两个独立架子（两个 scope 键、先注册后加载、卸载即清）、
// 两架互不合并、点卡按 case_id 开详情、首载/刷新失败重试、契约错误行 fail closed、
// Mock 归档体行为原样且零 P5 请求。
// 测试宿主：mock 应用状态 / 导航钩子（同 MatchCase列表.test.tsx 惯例）；仓库未装
// @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchCase历史 } from './MatchCase历史';
import 归档谈判 from '../归档谈判';
import 企业归档 from '../企业归档';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import type { P5连续列表快照, P5列表快照 } from '../../状态/后端/类型';
import type { P5列表项, P5历史生命周期, P5状态视图 } from '../../数据/招聘数据源/MatchCase';
import type { NegotiationCard, NegotiationShelf } from '../../数据/招聘数据源/连续代谈';
import { P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { P5角色 } from '../../数据/MatchCase展示映射';
import { 路径 } from '../../路由/路径表';
import { 归档列表初始 } from '../../测试/P5Mock边界种子';
import { BFF主体样本 } from '../../测试/BFF样本';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock设置P5范围 = vi.fn();
// 桩签名与 MatchCase操作 的历史面同形（断言要按下标读调用参数）
const mock加载历史 = vi.fn(
  async (_role: P5角色, _lifecycle: P5历史生命周期, _filterRef: string | null, _force?: boolean) => undefined);
const mock追加历史 = vi.fn(
  async (_role: P5角色, _lifecycle: P5历史生命周期, _filterRef: string | null) => undefined);
const mock刷新历史 = vi.fn(
  async (_role: P5角色, _lifecycle: P5历史生命周期, _filterRef: string | null) => undefined);
const mock加载连续列表 = vi.fn(async (_shelf: NegotiationShelf, _force?: boolean) => undefined);
const mock追加连续列表 = vi.fn(async (_shelf: NegotiationShelf) => undefined);
const mock刷新连续列表 = vi.fn(async (_shelf: NegotiationShelf) => undefined);
// 生产 Provider 的 操作 引用稳定（useMemo），桩宿主同样给恒定表
const mock操作 = {
  设置P5范围: mock设置P5范围,
  加载历史: mock加载历史,
  追加历史: mock追加历史,
  刷新历史: mock刷新历史,
  加载连续列表: mock加载连续列表,
  追加连续列表: mock追加连续列表,
  刷新连续列表: mock刷新连续列表,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }) }));

const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 职位ID = 'job_0123456789abcdef0123456789abcdef';
const 别名 = 'candidate-0123456789ab';

// ── 候选连续行样本：已 decode 的 NegotiationCard（decode 归 连续代谈.ts）──

interface 连续行选项 {
  recordId: string;
  phase: NegotiationCard['phase'];
  shelf?: NegotiationShelf;
  caseState?: P5状态视图 | null;
  failure?: NegotiationCard['failure'];
  refusalCode?: NegotiationCard['refusal_code'];
  actions?: Partial<NegotiationCard['actions']>;
  职位名?: string;
}

function 连续行(选项: 连续行选项): NegotiationCard {
  const recordKind = 选项.recordId.startsWith('dlg_') ? 'delegation' : 'case';
  return {
    needs_action: false, // history 架子 needs_action 恒 false（decode 钉死）
    record_id: 选项.recordId,
    record_kind: recordKind,
    intention_id: 意向ID,
    job: {
      job_id: 职位ID,
      title: 选项.职位名 ?? '平台工程师',
      location: '上海',
      public_salary_range: '25-40K·16薪',
      availability: 'available',
      organization: null,
      required_skills: null,
      recruitment_type: null,
      workplace_mode: null,
      annual_salary_months: null,
    },
    delegation_id: recordKind === 'delegation' ? 'dlg_rcpt_01' : null,
    evaluation_id: null,
    case_id: 选项.phase === 'case_started' ? 'mc_0123456789abcdef0123456789abcdef' : null,
    shelf: 选项.shelf ?? 'history',
    phase: 选项.phase,
    case_state: 选项.caseState === undefined ? null : 选项.caseState,
    failure: 选项.failure ?? null,
    refusal_code: 选项.refusalCode ?? null,
    actions: { retry: false, archive: false, open_case: false, ...选项.actions },
    retry_generation: 0,
    created_at: '2026-08-20T01:00:00Z', updated_at: '2026-08-29T02:00:00Z', archived_at: '2026-08-29T03:00:00Z',
    match_score: null,
  };
}

/** 已结束 Case 的合法 case_state（ended/complete）；completed 由 shelf 消费者另行构造。 */
function 终局状态(lifecycle: 'ended' | 'completed', caseId: string): P5状态视图 {
  const 是完成 = lifecycle === 'completed';
  return {
    caseId, lifecycle,
    stage: 是完成 ? 'intent_confirmation' : 'anonymous_screening',
    status: 是完成 ? 'passed' : 'ended',
    step: 是完成 ? 'handoff_pending' : 'complete',
    round: 3, roundBudget: 3, needsUser: false,
    outcome: 是完成 ? null : 'user_ended',
    outcomeCode: 是完成 ? null : 'user_ended',
    createdAt: '2026-08-20T01:00:00Z', updatedAt: '2026-08-29T02:00:00Z',
    finalizedAt: '2026-08-29T03:00:00Z',
    agentAttention: null,
  };
}

function 连续快照(选项: {
  阶段?: P5连续列表快照['阶段'];
  items?: NegotiationCard[];
  nextCursor?: string | null;
  error?: string | null;
  刷新中?: boolean;
  ownerSubjectId?: string | null;
} = {}): P5连续列表快照 {
  return {
    ownerSubjectId: 选项.ownerSubjectId ?? 'sub_1',
    阶段: 选项.阶段 ?? '成功',
    刷新中: 选项.刷新中 ?? false,
    items: 选项.items ?? [],
    nextCursor: 选项.nextCursor ?? null,
    已加载页数: 1,
    error: 选项.error ?? null,
    generation: 1,
  };
}

// ── 招聘终局行样本（原 P5 行，招聘双架子继续消费）──

interface 行选项 {
  caseId: string;
  lifecycle: P5历史生命周期;
  职位名?: string;
}

/** 终局行的合法四元组：completed → 意向确认/passed/handoff_pending；ended → S0/ended/complete。 */
function 终局行状态(选项: 行选项): P5列表项['state'] {
  const 是完成 = 选项.lifecycle === 'completed';
  return {
    caseId: 选项.caseId,
    lifecycle: 选项.lifecycle,
    stage: 是完成 ? 'intent_confirmation' : 'anonymous_screening',
    status: 是完成 ? 'passed' : 'ended',
    step: 是完成 ? 'handoff_pending' : 'complete',
    round: 3, roundBudget: 3, needsUser: false,
    outcome: 是完成 ? null : 'user_ended',
    outcomeCode: 是完成 ? null : 'user_ended',
    createdAt: '2026-08-20T01:00:00Z', updatedAt: '2026-08-29T02:00:00Z',
    finalizedAt: '2026-08-29T03:00:00Z',
    agentAttention: null,
  };
}

function 候选终局行(选项: 行选项): P5列表项 {
  return {
    role: 'candidate',
    state: 终局行状态(选项),
    needsAction: false,
    intentionId: 意向ID,
    job: {
      jobId: 职位ID,
      job: {
        title: 选项.职位名 ?? '平台工程师',
        location: '上海',
        publicSalaryRange: '25-40K·16薪',
        requiredSkills: ['Go'],
      },
    },
  };
}

function 招聘终局行(选项: 行选项): P5列表项 {
  return {
    role: 'recruiter',
    state: 终局行状态(选项),
    needsAction: false,
    candidateAlias: 别名,
    job: 候选终局行(选项).job,
    matchScore: null,
    candidateIdentity: { state: 'anonymous', name: null, avatar_url: null, disclosed_at: null },
  };
}

/** 矩阵外行（completed 却停在 S0）：decode 挡得住的漂移若仍进快照，展示映射必须 fail closed。 */
function 契约外行(选项: 行选项): P5列表项 {
  const 行 = 候选终局行(选项);
  return { ...行, state: { ...行.state, stage: 'anonymous_screening', status: 'ended', step: 'complete' } };
}

function 快照(选项: {
  阶段?: P5列表快照['阶段'];
  items?: P5列表项[];
  nextCursor?: string | null;
  error?: string | null;
  刷新中?: boolean;
  ownerSubjectId?: string | null;
} = {}): P5列表快照 {
  return {
    ownerSubjectId: 选项.ownerSubjectId ?? 'sub_1',
    阶段: 选项.阶段 ?? '成功',
    刷新中: 选项.刷新中 ?? false,
    items: 选项.items ?? [],
    nextCursor: 选项.nextCursor ?? null,
    已加载页数: 1,
    error: 选项.error ?? null,
    generation: 1,
  };
}

// oxlint 的 jsx-a11y/aria-role 会把 P5 域 prop role= 当 ARIA role 检查（误报）：
// 元素统一在这里造，只需一处关闭。
// eslint-disable-next-line jsx-a11y/aria-role
function 历史元素(role: 'candidate' | 'recruiter') {
  return <MatchCase历史 role={role} />;
}

/** 候选连续历史状态底座：预置连续 history 快照（缺省空窗口读尽）。 */
function 置候选历史状态(选项: {
  连续快照?: P5连续列表快照;
} = {}) {
  mock应用状态 = {
    数据源模式: 'backend',
    派发: mock派发,
    状态: {},
    后端状态: {
      主体: { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'candidate' },
      P5连续列表: {
        [P5范围键.negotiations('history')]: 选项.连续快照 ?? 连续快照(),
      },
    },
    操作: mock操作,
  };
}

/** 招聘双架子状态底座：completed / ended 两架各预置各的快照（缺省空窗口读尽）。 */
function 置历史状态(选项: {
  role: 'candidate' | 'recruiter';
  completed快照?: P5列表快照;
  ended快照?: P5列表快照;
}) {
  mock应用状态 = {
    数据源模式: 'backend',
    派发: mock派发,
    状态: {},
    后端状态: {
      主体: { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 选项.role },
      P5历史: {
        [P5范围键.history(选项.role, 'completed', null)]: 选项.completed快照 ?? 快照(),
        [P5范围键.history(选项.role, 'ended', null)]: 选项.ended快照 ?? 快照(),
      },
    },
    操作: mock操作,
  };
  return 选项;
}

describe('MatchCase历史 · 候选连续历史（J-PILOT-01 Task 4）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock设置P5范围.mockClear();
    mock加载历史.mockClear();
    mock追加历史.mockClear();
    mock刷新历史.mockClear();
    mock加载连续列表.mockClear();
    mock追加连续列表.mockClear();
    mock刷新连续列表.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('进屏注册连续 history scope 并懒加载首屏（先注册后加载，离开即清）', () => {
    置候选历史状态({
      连续快照: 连续快照({
        items: [
          连续行({
            recordId: 'mc_c1', phase: 'case_started',
            caseState: 终局状态('completed', 'mc_c1'),
          }),
        ],
      }),
    });
    const 页 = render(历史元素('candidate'));
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', P5范围键.negotiations('history'));
    expect(mock加载连续列表).toHaveBeenCalledWith('history');
    expect(mock加载历史).not.toHaveBeenCalled(); // 候选不再拼两个 Case 分页
    expect(mock设置P5范围.mock.invocationCallOrder[0]).toBeLessThan(
      mock加载连续列表.mock.invocationCallOrder[0]);
    页.unmount();
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', null);
  });

  it('单一集合承接已结束 Case 与已归档初评失败：原序渲染、显示结果/失败原因', () => {
    置候选历史状态({
      连续快照: 连续快照({
        items: [
          连续行({
            recordId: 'mc_e1', phase: 'case_started',
            caseState: 终局状态('ended', 'mc_e1'),
            职位名: '数据分析师',
          }),
          连续行({
            recordId: 'dlg_f1', phase: 'evaluation_failed',
            failure: { code: 'delegation_agent_unavailable', retryable: true },
            actions: { retry: true, archive: true },
            职位名: '前端工程师',
          }),
        ],
      }),
    });
    const 宿主 = render(历史元素('candidate'));
    // 单一服务端顺序原样保留（无客户端重排、无架子题、不拼两个 Case 分页）
    expect(宿主.container.textContent).toContain('已结束');
    expect(宿主.container.textContent).toContain('初评失败');
    expect(宿主.container.textContent).toContain('AI 服务暂时不可用，本次没有创建 Case');
    expect(screen.getByText('数据分析师')).toBeTruthy();
    expect(screen.getByText('前端工程师')).toBeTruthy();
    // 终局行零归属徽标（读-only：不是「需要你」也不是「代理处理中」）
    expect(screen.queryByText('需要你')).toBeNull();
    expect(screen.queryByText('代理处理中')).toBeNull();
    expect(mock加载历史).not.toHaveBeenCalled();
  });

  it('history needs_action=false 仍可进恢复详情：点卡按 record_id 导航，不按待办字段否决', async () => {
    const user = userEvent.setup();
    置候选历史状态({
      连续快照: 连续快照({
        items: [
          // 归档初评失败：needs_action=false 但权威 actions.retry=true —— 卡照常渲染且可进详情
          连续行({
            recordId: 'dlg_f1', phase: 'evaluation_failed',
            failure: { code: 'delegation_failed', retryable: true },
            actions: { retry: true, archive: true },
          }),
          连续行({
            recordId: 'mc_e1', phase: 'case_started',
            caseState: 终局状态('ended', 'mc_e1'),
            职位名: '数据分析师',
          }),
        ],
      }),
    });
    render(历史元素('candidate'));
    await user.click(screen.getByText('平台工程师'));
    expect(mock跳转).toHaveBeenCalledWith(路径.在谈详情('dlg_f1'));
    await user.click(screen.getByText('数据分析师'));
    expect(mock跳转).toHaveBeenLastCalledWith(路径.在谈详情('mc_e1'));
  });

  it('快照 owner 与当前主体不同时不显示旧行，仍加载当前 scope', () => {
    置候选历史状态({
      连续快照: 连续快照({
        ownerSubjectId: 'sub_old',
        items: [连续行({ recordId: 'mc_old', phase: 'case_started', caseState: 终局状态('ended', 'mc_old'), 职位名: '旧结束行' })],
      }),
    });
    mock应用状态.后端状态.主体 = {
      ...BFF主体样本,
      subject_id: 'sub_new',
      last_used_role: 'candidate',
    };
    render(历史元素('candidate'));
    expect(screen.queryByText('旧结束行')).toBeNull();
    expect(mock加载连续列表).toHaveBeenCalledWith('history');
  });

  it('首载失败给失败态与重试（重试 force 首屏）', async () => {
    const user = userEvent.setup();
    置候选历史状态({
      连续快照: 连续快照({ 阶段: '失败', items: [], error: '服务暂时不可用，请稍后再试' }),
    });
    render(历史元素('candidate'));
    expect(screen.getByText('历史暂时加载不了')).toBeTruthy();
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock加载连续列表).toHaveBeenCalledWith('history', true);
  });

  it('刷新失败保留旧条目只读 + 单独错误行交代 + 重试走刷新；加载更多接追加', async () => {
    const user = userEvent.setup();
    置候选历史状态({
      连续快照: 连续快照({
        items: [连续行({
          recordId: 'mc_c1', phase: 'case_started',
          caseState: 终局状态('completed', 'mc_c1'),
        })],
        nextCursor: 'b2xc',
        error: '服务暂时不可用，请稍后再试',
      }),
    });
    const { rerender } = render(历史元素('candidate'));
    expect(screen.getByText('平台工程师')).toBeTruthy(); // 旧卡原样保留，不降级成空白
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock刷新连续列表).toHaveBeenCalledWith('history');
    expect(mock加载连续列表).toHaveBeenCalledTimes(1); // 只有进屏懒加载那一次

    // 加载更多透传本架快照游标（追加一页）；读尽即藏
    await user.click(screen.getByRole('button', { name: '加载更多' }));
    expect(mock追加连续列表).toHaveBeenCalledWith('history');
    置候选历史状态({
      连续快照: 连续快照({
        items: [连续行({
          recordId: 'mc_c1', phase: 'case_started',
          caseState: 终局状态('completed', 'mc_c1'),
        })],
      }),
    });
    rerender(历史元素('candidate'));
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
  });

  it('历史零轮询：可见 11 秒后无任何刷新调用（终局架子不进 5s/3s 节拍）', async () => {
    vi.useFakeTimers();
    置候选历史状态({
      连续快照: 连续快照({
        items: [连续行({
          recordId: 'mc_c1', phase: 'case_started',
          caseState: 终局状态('completed', 'mc_c1'),
        })],
      }),
    });
    render(历史元素('candidate'));
    await act(() => vi.advanceTimersByTimeAsync(11_000));
    expect(mock刷新连续列表).not.toHaveBeenCalled();
    expect(mock刷新历史).not.toHaveBeenCalled();
    expect(mock加载连续列表).toHaveBeenCalledTimes(1); // 仍只有进屏那一发
  });

  it('空窗口读尽给通用空态', () => {
    置候选历史状态();
    render(历史元素('candidate'));
    expect(screen.getByText('还没有历史代谈。')).toBeTruthy();
  });
});

describe('MatchCase历史 · 招聘双架子（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock设置P5范围.mockClear();
    mock加载历史.mockClear();
    mock追加历史.mockClear();
    mock刷新历史.mockClear();
    mock加载连续列表.mockClear();
    mock追加连续列表.mockClear();
    mock刷新连续列表.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('招聘端分别请求 completed 与 ended：两个 scope 键、先注册后加载、卸载即清', () => {
    置历史状态({
      role: 'recruiter',
      completed快照: 快照({ items: [招聘终局行({ caseId: 'mc_c1', lifecycle: 'completed' })] }),
      ended快照: 快照({ items: [招聘终局行({ caseId: 'mc_e1', lifecycle: 'ended' })] }),
    });
    const 完成键 = P5范围键.history('recruiter', 'completed', null);
    const 结束键 = P5范围键.history('recruiter', 'ended', null);
    expect(完成键).not.toBe(结束键); // 两个架子永不共用一个 scope 键
    const 页 = render(历史元素('recruiter'));
    expect(mock设置P5范围).toHaveBeenCalledWith('recruiter', 完成键);
    expect(mock设置P5范围).toHaveBeenCalledWith('recruiter', 结束键);
    expect(mock加载历史).toHaveBeenCalledWith('recruiter', 'completed', null);
    expect(mock加载历史).toHaveBeenCalledWith('recruiter', 'ended', null);
    expect(mock设置P5范围.mock.invocationCallOrder[1]).toBeLessThan(
      mock加载历史.mock.invocationCallOrder[0]);
    expect(mock加载连续列表).not.toHaveBeenCalled(); // 招聘分支零连续读取
    页.unmount();
    expect(mock设置P5范围).toHaveBeenCalledWith('recruiter', null);
  });

  it('招聘端快照 owner 与当前主体不同时不显示旧历史行，仍分别加载两个架子', () => {
    置历史状态({
      role: 'recruiter',
      completed快照: 快照({
        ownerSubjectId: 'sub_old',
        items: [招聘终局行({ caseId: 'mc_old_c', lifecycle: 'completed', 职位名: '旧谈成行' })],
      }),
      ended快照: 快照({
        ownerSubjectId: 'sub_old',
        items: [招聘终局行({ caseId: 'mc_old_e', lifecycle: 'ended', 职位名: '旧结束行' })],
      }),
    });
    mock应用状态.后端状态.主体 = {
      ...BFF主体样本,
      subject_id: 'sub_new',
      last_used_role: 'recruiter',
    };
    render(历史元素('recruiter'));
    expect(screen.queryByText('旧谈成行')).toBeNull();
    expect(screen.queryByText('旧结束行')).toBeNull();
    expect(mock加载历史).toHaveBeenCalledWith('recruiter', 'completed', null);
    expect(mock加载历史).toHaveBeenCalledWith('recruiter', 'ended', null);
  });

  it('招聘端两架子互不合并：行各归各组，加载更多只透传本架游标（游标绝不串架）', async () => {
    const user = userEvent.setup();
    置历史状态({
      role: 'recruiter',
      completed快照: 快照({
        items: [招聘终局行({ caseId: 'mc_c1', lifecycle: 'completed', 职位名: '平台工程师' })],
        nextCursor: 'b2xc', // completed 架游标未尽
      }),
      ended快照: 快照({
        items: [招聘终局行({ caseId: 'mc_e1', lifecycle: 'ended', 职位名: '数据分析师' })],
        // ended 架读尽：无加载更多
      }),
    });
    render(历史元素('recruiter'));
    expect(screen.getByText('平台工程师')).toBeTruthy(); // completed 行只在 completed 架
    expect(screen.getByText('数据分析师')).toBeTruthy(); // ended 行只在 ended 架
    expect(screen.getAllByRole('button', { name: '加载更多' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '加载更多' }));
    expect(mock追加历史).toHaveBeenCalledTimes(1);
    expect(mock追加历史).toHaveBeenCalledWith('recruiter', 'completed', null);
    expect(mock追加历史.mock.calls.some((调) => 调[1] === 'ended')).toBe(false);
    expect(mock追加连续列表).not.toHaveBeenCalled();
  });

  it('招聘端点卡按 case_id 开详情路由：候选详情；终局卡零待办徽标', async () => {
    const user = userEvent.setup();
    置历史状态({
      role: 'recruiter',
      completed快照: 快照({ items: [招聘终局行({ caseId: 'mc_c1', lifecycle: 'completed' })] }),
      ended快照: 快照({ items: [招聘终局行({ caseId: 'mc_e1', lifecycle: 'ended' })] }),
    });
    render(历史元素('recruiter'));
    await user.click(screen.getAllByText(别名)[0]!);
    expect(mock跳转).toHaveBeenCalledWith(路径.候选详情('mc_c1'));
    // 终局行零动作归属徽标（读-only）
    expect(screen.queryByText('需要你')).toBeNull();
    expect(screen.queryByText('代理处理中')).toBeNull();
    expect(screen.getAllByText('已谈成').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已结束').length).toBeGreaterThan(1);
  });

  it('招聘端首载失败给失败态与重试（force 重读本架），另一架不受波及', async () => {
    const user = userEvent.setup();
    置历史状态({
      role: 'recruiter',
      completed快照: 快照({ 阶段: '失败', items: [], error: '服务暂时不可用，请稍后再试' }),
      ended快照: 快照({ items: [招聘终局行({ caseId: 'mc_e1', lifecycle: 'ended', 职位名: '数据分析师' })] }),
    });
    render(历史元素('recruiter'));
    expect(screen.getByText('历史暂时加载不了')).toBeTruthy();
    expect(screen.getByText('数据分析师')).toBeTruthy(); // ended 架照常渲染
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock加载历史).toHaveBeenCalledWith('recruiter', 'completed', null, true);
  });

  it('招聘端刷新失败保留旧条目只读 + 单独错误行交代 + 重试走刷新历史', async () => {
    const user = userEvent.setup();
    置历史状态({
      role: 'recruiter',
      completed快照: 快照({
        items: [招聘终局行({ caseId: 'mc_c1', lifecycle: 'completed', 职位名: '平台工程师' })],
        error: '服务暂时不可用，请稍后再试',
      }),
    });
    render(历史元素('recruiter'));
    expect(screen.getByText('平台工程师')).toBeTruthy();
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock刷新历史).toHaveBeenCalledWith('recruiter', 'completed', null);
    expect(mock加载历史).toHaveBeenCalledTimes(2); // 只有进屏懒加载两架，重试不再叠一层
  });

  it('招聘端未知契约行 fail closed：契约错误提示 + 重试，不渲染该行的部分数据', async () => {
    const user = userEvent.setup();
    置历史状态({
      role: 'recruiter',
      completed快照: 快照({ items: [契约外行({ caseId: 'mc_bad', lifecycle: 'completed' })] }),
    });
    render(历史元素('recruiter'));
    expect(screen.getByText(P5契约错误提示)).toBeTruthy();
    expect(screen.queryByText('平台工程师')).toBeNull();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock刷新历史).toHaveBeenCalledWith('recruiter', 'completed', null);
  });

  it('招聘端空窗口读尽给各架空态文案', () => {
    置历史状态({ role: 'recruiter' });
    render(历史元素('recruiter'));
    expect(screen.getByText('还没有谈成的候选。')).toBeTruthy();
    expect(screen.getByText('没有已结束的候选。')).toBeTruthy();
  });
});

// ── 两屏 Backend 分支：接线 + Mock 归档体零 P5 ────────────────────────────────

describe('归档谈判 / 企业归档 · P5 Backend 分支', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock设置P5范围.mockClear();
    mock加载历史.mockClear();
    mock追加历史.mockClear();
    mock刷新历史.mockClear();
    mock加载连续列表.mockClear();
    mock追加连续列表.mockClear();
    mock刷新连续列表.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('候选历史代谈 = 单一连续集合；招聘端渲染双架子；Mock 归档卡一概不渲染', () => {
    置候选历史状态({
      连续快照: 连续快照({
        items: [
          连续行({
            recordId: 'dlg_f1', phase: 'evaluation_failed',
            failure: { code: 'delegation_failed', retryable: true },
            actions: { retry: true, archive: true },
          }),
        ],
      }),
    });
    const 页 = render(<归档谈判 />);
    expect(页.container.textContent).toContain('初评失败');
    expect(mock加载连续列表).toHaveBeenCalledWith('history');
    expect(mock加载历史).not.toHaveBeenCalled();
    expect(screen.queryByText('回看往来 ›')).toBeNull(); // Mock 归档卡的文案一概不渲染

    页.unmount();
    cleanup();
    置历史状态({
      role: 'recruiter',
      completed快照: 快照({ items: [招聘终局行({ caseId: 'mc_c1', lifecycle: 'completed' })] }),
      ended快照: 快照({ items: [招聘终局行({ caseId: 'mc_e1', lifecycle: 'ended' })] }),
    });
    render(<企业归档 />);
    expect(screen.getAllByText(别名).length).toBe(2); // 两架各一张（同别名，键各归 case_id）
    expect(mock加载历史).toHaveBeenCalledWith('recruiter', 'completed', null);
    expect(mock加载历史).toHaveBeenCalledWith('recruiter', 'ended', null);
  });

  it('Mock 分支行为原样且零 P5 请求（两端）', () => {
    mock应用状态 = {
      数据源模式: 'mock',
      派发: mock派发,
      状态: { 归档列表: 归档列表初始, 企业归档列表: [] },
      后端状态: {},
      操作: mock操作,
    };
    const 页 = render(<归档谈判 />);
    expect(screen.getByText('历史代谈')).toBeTruthy();
    expect(screen.getByText('SHEIN')).toBeTruthy(); // Mock 卡原样（归档列表初始第一条）
    页.unmount();

    render(<企业归档 />);
    expect(screen.getByText('还没有历史代谈')).toBeTruthy(); // Mock 空态原样
    expect(mock设置P5范围).not.toHaveBeenCalled();
    expect(mock加载历史).not.toHaveBeenCalled();
    expect(mock追加历史).not.toHaveBeenCalled();
    expect(mock刷新历史).not.toHaveBeenCalled();
    expect(mock加载连续列表).not.toHaveBeenCalled();
    expect(mock追加连续列表).not.toHaveBeenCalled();
    expect(mock刷新连续列表).not.toHaveBeenCalled();
  });
});