// P5 Task 4（J-PILOT-01 Task 4 修订候选半边）：候选连续在谈（MatchCase列表 candidate 分支 +
// 在谈首页 Backend 分支）与招聘 Case open 工作区列表的行为测试。
// 候选半边覆盖：五阶段 fixture（accepted/evaluating/evaluation_failed/refused/case_started）
// 按服务端输入原序渲染、较早待办在最新运行卡前、case_state=null 不隐藏卡、主列表未选意向
// 也读全意向（恒省略 intention_id）、网络失败不是空列表（失败态 + 重试 + 旧条目保留）、
// owner 不匹配不显示旧主体卡、record_id 键与导航、可见 5 秒轮询接 刷新连续列表、
// 加载更多接 追加连续列表、手动刷新 force 首屏、求职在谈卡占位、横幅「需要你处理」、
// Mock 分支零 P5 请求。
// 招聘半边保持：viewer 专属 needs_action 文案、scope 注册、服务端顺序、刷新失败保留、
// 加载更多、契约错误行 fail closed、招聘卡摘要卡面。
// 测试宿主：mock 应用状态 / 导航钩子（同 候选推荐.test.tsx 惯例）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchCase列表 } from './MatchCase列表';
import 在谈首页 from '../在谈首页';
import 企业在谈候选 from '../企业在谈候选';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import type { P5连续列表快照, P5列表快照 } from '../../状态/后端/类型';
import type { P5列表项 } from '../../数据/招聘数据源/MatchCase';
import type { P5状态视图 } from '../../数据/招聘数据源/MatchCase';
import type { NegotiationCard, NegotiationShelf } from '../../数据/招聘数据源/连续代谈';
import type { BFF招聘候选摘要 } from '../../数据/BFF契约';
import { P5契约错误提示 } from '../../数据/MatchCase展示映射';
import { 路径 } from '../../路由/路径表';
import { 在谈列表, 在招岗位列表, 在谈候选列表 } from '../../测试/P5Mock边界种子';
import { BFF主体样本, 招聘候选摘要样本 } from '../../测试/BFF样本';
import { BFF公司摘要样本 } from '../../测试/展示资料样本';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock设置P5范围 = vi.fn();
const mock加载工作区 = vi.fn(async () => undefined);
const mock追加工作区 = vi.fn(async () => undefined);
const mock刷新工作区 = vi.fn(async () => undefined);
const mock加载连续列表 = vi.fn(async (_shelf: NegotiationShelf, _force?: boolean) => undefined);
const mock追加连续列表 = vi.fn(async (_shelf: NegotiationShelf) => undefined);
const mock刷新连续列表 = vi.fn(async (_shelf: NegotiationShelf) => undefined);
// 生产 Provider 的 操作 引用稳定（useMemo），桩宿主同样给恒定表 —— 避免每次置状态都
// 让组件 effect 因依赖换引用而重跑
const mock操作 = {
  设置P5范围: mock设置P5范围,
  加载工作区: mock加载工作区,
  追加工作区: mock追加工作区,
  刷新工作区: mock刷新工作区,
  加载连续列表: mock加载连续列表,
  追加连续列表: mock追加连续列表,
  刷新连续列表: mock刷新连续列表,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../../状态/应用状态', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  use应用状态: () => mock应用状态,
}));
vi.mock('../../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }) }));

// 记录并透传：Backend 候选在谈卡绝不触发 use适配分 的 Mock 演示简历计算路径（Task 3）
const { mock适配分 } = vi.hoisted(() => ({ mock适配分: vi.fn() }));
vi.mock('../../状态/use适配分', async (importOriginal) => {
  const 真模块 = await importOriginal<typeof import('../../状态/use适配分')>();
  return {
    use适配分: (源: Parameters<typeof 真模块.use适配分>[0]) => {
      mock适配分(源);
      return 真模块.use适配分(源);
    },
  };
});

const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 职位ID = 'job_0123456789abcdef0123456789abcdef';
const 别名 = 'candidate-0123456789ab';

// ── 连续卡样本：快照里存的是已 decode 的 NegotiationCard（decode 归 连续代谈.ts）──

function 连续卡(选项: {
  recordId: string;
  phase: NegotiationCard['phase'];
  needsAction?: boolean;
  shelf?: NegotiationShelf;
  caseState?: P5状态视图 | null;
  failure?: NegotiationCard['failure'];
  refusalCode?: NegotiationCard['refusal_code'];
  职位名?: string | null;
  城市?: string | null;
  组织?: NegotiationCard['job']['organization'];
  技能?: string[] | null;
  办公方式?: NegotiationCard['job']['workplace_mode'];
  薪资月数?: number | null;
  匹配分?: number | null;
}): NegotiationCard {
  const recordKind = 选项.recordId.startsWith('dlg_') ? 'delegation' : 'case';
  return {
    needs_action: 选项.needsAction ?? false,
    record_id: 选项.recordId,
    record_kind: recordKind,
    intention_id: 意向ID,
    job: {
      job_id: 职位ID,
      title: 选项.职位名 === undefined ? 'AI 产品实习生' : 选项.职位名,
      location: 选项.城市 === undefined ? '上海' : 选项.城市,
      public_salary_range: '300-500 元/天',
      availability: 'available',
      organization: 选项.组织 ?? null,
      required_skills: 选项.技能 ?? null,
      recruitment_type: null,
      workplace_mode: 选项.办公方式 ?? null,
      annual_salary_months: 选项.薪资月数 ?? null,
    },
    delegation_id: recordKind === 'delegation' ? 'dlg_rcpt_01' : null,
    evaluation_id: null,
    case_id: 选项.phase === 'case_started' ? 'mc_0123456789abcdef0123456789abcdef' : null,
    shelf: 选项.shelf ?? 'active',
    phase: 选项.phase,
    case_state: 选项.caseState === undefined ? null : 选项.caseState,
    failure: 选项.failure ?? null,
    refusal_code: 选项.refusalCode ?? null,
    actions: { retry: false, archive: false, open_case: false },
    retry_generation: 0,
    match_score: 选项.匹配分 ?? null,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T09:00:00Z',
    archived_at: null,
  };
}

function 开案状态(覆盖: Partial<P5状态视图> = {}): P5状态视图 {
  return {
    caseId: 'mc_0123456789abcdef0123456789abcdef', lifecycle: 'open',
    stage: 'anonymous_screening', status: 'running', step: 'policy_check',
    round: 0, roundBudget: 3, needsUser: false,
    outcome: null, outcomeCode: null,
    createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T09:00:00Z',
    finalizedAt: null, agentAttention: null,
    ...覆盖,
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

// ── 招聘 Case 行样本（原 P5 行，招聘分支继续消费）──

function 候选行(选项: { caseId: string; 待办?: boolean; 更新于?: string }): P5列表项 {
  return {
    role: 'candidate',
    state: {
      caseId: 选项.caseId, lifecycle: 'open', stage: 'anonymous_screening', status: 'running',
      step: 'policy_check', round: 0, roundBudget: 3, needsUser: false,
      outcome: null, outcomeCode: null,
      createdAt: '2026-08-29T01:00:00Z',
      updatedAt: 选项.更新于 ?? '2026-08-29T02:00:00Z', finalizedAt: null,
      agentAttention: null,
    },
    needsAction: 选项.待办 ?? true,
    intentionId: 意向ID,
    job: {
      jobId: 职位ID,
      job: { title: 'AI 产品实习生', location: '上海', publicSalaryRange: '300-500 元/天', requiredSkills: ['Python'] },
    },
  };
}

function 招聘行(选项: { caseId: string; 待办?: boolean; 更新于?: string; 别名?: string; 摘要?: BFF招聘候选摘要 | null; 匹配分?: number | null }): Extract<P5列表项, { role: 'recruiter' }> {
  return {
    role: 'recruiter',
    state: {
      ...候选行({ caseId: 选项.caseId, 更新于: 选项.更新于 }).state,
    },
    needsAction: 选项.待办 ?? false,
    candidateAlias: 选项.别名 ?? 别名,
    job: 候选行({ caseId: 选项.caseId }).job,
    matchScore: 选项.匹配分 ?? null,
    candidateIdentity: { state: 'anonymous', name: null, avatar_url: null, disclosed_at: null },
    ...(选项.摘要 === undefined ? {} : { candidateSummary: 选项.摘要 }),
  };
}

/** 矩阵外行（open+running 却给 handoff_pending）：decode 挡得住的漂移若仍进快照，
 *  展示映射必须 fail closed —— 用于未知契约用例，不需要任何 as。 */
function 契约外行(caseId: string): P5列表项 {
  const 行 = 候选行({ caseId });
  return { ...行, state: { ...行.state, step: 'handoff_pending' } };
}

/** S1 attention 合法行 + owner-safe agent_attention：列表只给安全说明与徽标，零 retry。 */
function 注意行(行: P5列表项): P5列表项 {
  return {
    ...行,
    state: {
      ...行.state,
      stage: 'resume_submission', status: 'attention_required', step: 'screening_resume',
      agentAttention: { code: 'agent_unavailable', retryable: false },
    },
  };
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

function P5操作表(): Record<string, unknown> {
  return mock操作;
}

// oxlint 的 jsx-a11y/aria-role 会把 P5 域 prop role= 当 ARIA role 检查（误报）：
// 元素统一在这里造，只需一处关闭。
// eslint-disable-next-line jsx-a11y/aria-role
function 列表元素(role: 'candidate' | 'recruiter', filterRef: string | null) {
  return <MatchCase列表 role={role} filterRef={filterRef} />;
}

/** 组件级状态底座（J-PILOT-01 Task 4）：candidate 喂 P5连续列表 active 快照，
 *  recruiter 喂 P5工作区快照；主体按 role 播种。 */
function 置P5状态(选项: {
  role: 'candidate' | 'recruiter';
  filterRef: string | null;
  快照?: P5列表快照;
  连续快照?: P5连续列表快照;
}) {
  mock应用状态 = {
    数据源模式: 'backend',
    派发: mock派发,
    状态: 选项.role === 'candidate'
      ? { 在谈看什么: '全部', 在谈范围: '当前', 求职意向表: [], 当前意向: '', 子视图: '在谈' }
      : { 企业在谈看什么: '全部', 企业在谈范围: '当前', 企业子视图: '在谈' },
    后端状态: {
      主体: {
        ...BFF主体样本,
        subject_id: 'sub_1',
        last_used_role: 选项.role,
      },
      ...(选项.role === 'candidate'
        ? {
          P5连续列表: {
            [P5范围键.negotiations('active')]: 选项.连续快照 ?? 连续快照(),
          },
        }
        : {
          P5工作区: { [P5范围键.open(选项.role, 选项.filterRef)]: 选项.快照 ?? 快照() },
        }),
    },
    操作: P5操作表(),
  };
  return 选项;
}

describe('MatchCase列表 · 候选连续在谈（J-PILOT-01 Task 4）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock设置P5范围.mockClear();
    mock加载工作区.mockClear();
    mock追加工作区.mockClear();
    mock刷新工作区.mockClear();
    mock加载连续列表.mockClear();
    mock追加连续列表.mockClear();
    mock刷新连续列表.mockClear();
    mock适配分.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('无需 Case 即出卡：五阶段 fixture 按服务端输入原序渲染，不按 phase/needs_action 重排', () => {
    // 服务端序 = needs_action DESC, created_at DESC, record_id DESC。fixture 刻意把
    // 较早的待办（初评失败，可重试）放在最新运行卡前 —— 组件原样保留，不客户端重排。
    置P5状态({
      role: 'candidate', filterRef: null,
      连续快照: 连续快照({
        items: [
          连续卡({ recordId: 'dlg_a', phase: 'evaluating', needsAction: false }),
          连续卡({
            recordId: 'dlg_b', phase: 'evaluation_failed', needsAction: true,
            failure: { code: 'delegation_agent_unavailable', retryable: true },
          }),
          连续卡({ recordId: 'dlg_c', phase: 'refused', refusalCode: 'recommendation_stale' }),
          连续卡({ recordId: 'mc_d', phase: 'case_started', caseState: 开案状态() }),
          连续卡({ recordId: 'dlg_e', phase: 'accepted' }),
        ],
      }),
    });
    // eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role
    const 宿主 = render(<MatchCase列表 role="candidate" filterRef={null} />);
    const 卡片们 = Array.from(宿主.container.querySelectorAll('[data-testid="求职在谈卡"]'));
    expect(卡片们).toHaveLength(5);
    expect(卡片们.map((卡) => 卡.querySelector('[data-card-region="title"]')?.textContent)).toEqual([
      'AI 产品实习生', 'AI 产品实习生', 'AI 产品实习生', 'AI 产品实习生', 'AI 产品实习生',
    ]);
    // 阶段区文案按 phase 投影：较早待办（第 2 张）带「需要你」，其余按各自语义
    const 阶段文本们 = 卡片们.map((卡) => 卡.querySelector('[data-card-region="stage"]')?.textContent);
    expect(阶段文本们[0]).toContain('AI 正在评估');
    expect(阶段文本们[1]).toContain('初评失败');
    expect(阶段文本们[1]).toContain('需要你');
    expect(阶段文本们[2]).toContain('已拒绝');
    expect(阶段文本们[2]).toContain('这条推荐已过期，请刷新后查看');
    expect(阶段文本们[3]).toContain('匿名初筛');
    expect(阶段文本们[3]).toContain('进行中');
    expect(阶段文本们[4]).toContain('已受理');
    // 无任何客户端置顶/重排痕迹：第一张（非待办）仍是服务端输入的第一张
    expect(阶段文本们[0]).not.toContain('需要你');
  });

  it('case_started 且 case_state=null 照常出卡（已开案 + 安全进度文案），不隐藏卡', () => {
    置P5状态({
      role: 'candidate', filterRef: null,
      连续快照: 连续快照({ items: [连续卡({ recordId: 'mc_1', phase: 'case_started', caseState: null })] }),
    });
    render(列表元素('candidate', null));
    expect(screen.getByText('已开案')).toBeTruthy();
    expect(screen.getByText('暂时无法确认进度，请稍后刷新')).toBeTruthy();
  });

  it('进屏注册连续 scope 并懒加载首屏（先注册后加载，离开即清）；filterRef 不参与过滤', () => {
    置P5状态({ role: 'candidate', filterRef: null, 连续快照: 连续快照({ items: [连续卡({ recordId: 'dlg_1', phase: 'accepted' })] }) });
    const 页 = render(列表元素('candidate', null));
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', P5范围键.negotiations('active'));
    expect(mock加载连续列表).toHaveBeenCalledWith('active');
    expect(mock加载工作区).not.toHaveBeenCalled();
    expect(mock设置P5范围.mock.invocationCallOrder[0]).toBeLessThan(
      mock加载连续列表.mock.invocationCallOrder[0]);
    页.unmount();
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', null);
  });

  it('主列表未选意向也读全意向：filterRef 只透传不参与 scope（加载更多/刷新同理）', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'candidate', filterRef: 意向ID,
      连续快照: 连续快照({ items: [连续卡({ recordId: 'dlg_1', phase: 'accepted' })], nextCursor: 'b2x' }),
    });
    render(列表元素('candidate', 意向ID));
    // 意向 ID 只进不出的 prop：读取仍走全意向连续 scope（键无意向段）
    expect(mock加载连续列表).toHaveBeenCalledWith('active');
    await user.click(screen.getByRole('button', { name: '加载更多' }));
    expect(mock追加连续列表).toHaveBeenCalledWith('active');
  });

  it('快照 owner 与当前主体不同时不显示旧卡，仍加载当前 scope', () => {
    置P5状态({
      role: 'candidate', filterRef: null,
      连续快照: 连续快照({
        ownerSubjectId: 'sub_old',
        items: [连续卡({ recordId: 'dlg_old', phase: 'accepted' })],
      }),
    });
    mock应用状态.后端状态.主体 = {
      ...BFF主体样本,
      subject_id: 'sub_new',
      last_used_role: 'candidate',
    };
    render(列表元素('candidate', null));
    expect(screen.queryByText('AI 产品实习生')).toBeNull();
    expect(mock加载连续列表).toHaveBeenCalledWith('active');
  });

  it('可见 5 秒节拍调 刷新连续列表(active)；隐藏标签页当拍跳过', async () => {
    vi.useFakeTimers();
    置P5状态({
      role: 'candidate', filterRef: null,
      连续快照: 连续快照({ items: [连续卡({ recordId: 'dlg_1', phase: 'accepted' })] }),
    });
    render(列表元素('candidate', null));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(mock刷新连续列表).toHaveBeenCalledWith('active');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    mock刷新连续列表.mockClear();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(mock刷新连续列表).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('网络失败不是空列表：首载失败给失败态与重试（重试 force 首屏）', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'candidate', filterRef: null,
      连续快照: 连续快照({ 阶段: '失败', items: [], error: '服务暂时不可用，请稍后再试' }),
    });
    render(列表元素('candidate', null));
    expect(screen.getByText('在谈暂时加载不了')).toBeTruthy();
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock加载连续列表).toHaveBeenCalledWith('active', true);
  });

  it('刷新失败保留旧条目只读 + 单独错误行交代 + 重试走刷新', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'candidate', filterRef: null,
      连续快照: 连续快照({
        items: [连续卡({ recordId: 'dlg_1', phase: 'accepted' })],
        error: '服务暂时不可用，请稍后再试',
      }),
    });
    render(列表元素('candidate', null));
    expect(screen.getByText('已受理')).toBeTruthy(); // 旧卡原样保留，不降级成空白
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock刷新连续列表).toHaveBeenCalledWith('active');
    expect(mock加载连续列表).toHaveBeenCalledTimes(1); // 只有进屏懒加载那一次，重试不再叠一层
  });

  it('空窗口读尽给通用空态；游标读尽后加载更多消失', async () => {
    置P5状态({
      role: 'candidate', filterRef: null,
      连续快照: 连续快照({ items: [], nextCursor: null }),
    });
    render(列表元素('candidate', null));
    expect(screen.getByText('暂时没有在谈职位。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
  });

  it('点卡按 canonical record_id 导航到在谈详情（dlg_/mc_ 都走同一路由）', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'candidate', filterRef: null,
      连续快照: 连续快照({
        items: [
          连续卡({ recordId: 'dlg_9', phase: 'accepted' }),
          连续卡({ recordId: 'mc_8', phase: 'case_started', caseState: 开案状态() }),
        ],
      }),
    });
    render(列表元素('candidate', null));
    await user.click(screen.getAllByText('AI 产品实习生')[0]!);
    expect(mock跳转).toHaveBeenCalledWith(路径.在谈详情('dlg_9'));
  });

  // 卡片统一：候选连续行也走共享 求职在谈卡 —— 公司三件套与匹配分 negotiation 不提供，
  // 全部未知占位；冻结的职位/薪资/城市保留（NegotiationJob 无技能段）。
  it('候选连续卡：公司三件套与匹配分全占位，职位/薪资/城市不丢，待办徽标进阶段区', () => {
    置P5状态({
      role: 'candidate', filterRef: null,
      连续快照: 连续快照({
        items: [连续卡({ recordId: 'dlg_c', phase: 'evaluating', needsAction: true })],
      }),
    });
    const 宿主 = render(列表元素('candidate', null));
    const 卡 = screen.getByTestId('求职在谈卡');
    expect(screen.getByText('公司信息未知')).toBeTruthy();
    expect(screen.getByText('公司简介未知')).toBeTruthy();
    expect(screen.getByLabelText('公司图片未知')).toBeTruthy();
    expect(宿主.container.querySelector('[class*="公司字标"]')).toBeNull();
    expect(卡.querySelectorAll('img')).toHaveLength(0);
    expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
    expect(宿主.container.querySelector('[class*="适配环"]')).toBeNull();
    expect(screen.getByText('AI 产品实习生')).toBeTruthy();
    expect(screen.getByText('300–500 元/天')).toBeTruthy();
    // 标签区只有城市（NegotiationJob 无技能段）
    const 标签顺序 = Array.from(卡.querySelector('[data-card-region="tags"]')?.children ?? [])
      .map((元) => 元.textContent);
    expect(标签顺序).toEqual(['上海']);
    const 阶段区 = 卡.querySelector('[data-card-region="stage"]');
    expect(阶段区?.textContent).toContain('初评中');
    expect(阶段区?.textContent).toContain('AI 正在评估');
    expect(阶段区?.textContent).toContain('需要你');
    // 缺公司不引发额外读取：只有进屏那一次连续读，零业务派发、零 Mock 计算分
    expect(mock加载连续列表).toHaveBeenCalledTimes(1);
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock适配分).not.toHaveBeenCalled();
  });

  it('候选连续卡接组织摘要与匹配分：公司三件套 + Logo 图位 + 真实分；标签沿岗位属性顺序接技能', () => {
    置P5状态({
      role: 'candidate', filterRef: null,
      连续快照: 连续快照({
        items: [连续卡({
          recordId: 'dlg_org', phase: 'evaluating',
          组织: BFF公司摘要样本, 匹配分: 0,
          办公方式: 'hybrid', 薪资月数: 15, 技能: ['Go', '高并发'],
        })],
      }),
    });
    const 宿主 = render(列表元素('candidate', null));
    const 卡 = screen.getByTestId('求职在谈卡');
    expect(screen.getByText('云衢科技')).toBeTruthy();
    expect(screen.getByText('C 轮 · 500-1000 人 · 金融科技')).toBeTruthy();
    expect(宿主.container.querySelector('img[src="https://cdn.example.com/org_1/media_1.png"]'))
      .toBeTruthy();
    // 真实 0 分照常画 0 分环（不折算未知）
    expect(screen.getByRole('img', { name: '适配 0 分' })).toBeTruthy();
    const 标签顺序 = Array.from(卡.querySelector('[data-card-region="tags"]')?.children ?? [])
      .map((元) => 元.textContent);
    expect(标签顺序).toEqual(['上海', '15 薪', '混合', 'Go', '高并发']);
    // 组织摘要只来自快照内已 decode 的字段：零逐卡补读
    expect(mock加载连续列表).toHaveBeenCalledTimes(1);
  });

  it('招聘 Case open 行的匹配分上卡：真实 0 照常画环，identity 即使 disclosed 也不出姓名头像', () => {
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({
        items: [{
          ...招聘行({ caseId: 'mc_9' }),
          matchScore: 0,
          candidateIdentity: {
            state: 'disclosed', name: '内部姓名不上卡',
            avatar_url: 'https://cdn.example.com/av.png', disclosed_at: '2026-09-01T00:00:00Z',
          },
        }],
      }),
    });
    render(列表元素('recruiter', 职位ID));
    expect(screen.getByRole('img', { name: '适配 0 分' })).toBeTruthy();
    expect(screen.queryByText('内部姓名不上卡')).toBeNull();
    expect(document.querySelector('img[src="https://cdn.example.com/av.png"]')).toBeNull();
  });

  it('evaluation_failed 卡给失败原因注意说明：待办优先「需要你」，非待办「需注意」，零列表级重试键', () => {
    置P5状态({
      role: 'candidate', filterRef: null,
      连续快照: 连续快照({
        items: [连续卡({
          recordId: 'dlg_f', phase: 'evaluation_failed', needsAction: false,
          failure: { code: 'delegation_agent_unavailable', retryable: true },
        })],
      }),
    });
    render(列表元素('candidate', null));
    const 卡 = screen.getByTestId('求职在谈卡');
    const 阶段区 = 卡.querySelector('[data-card-region="stage"]');
    expect(阶段区?.textContent).toContain('初评失败');
    expect(阶段区?.textContent).toContain('需注意');
    expect(阶段区?.textContent).toContain('AI 服务暂时不可用，本次没有创建 Case');
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull();
  });
});

describe('MatchCase列表 · 招聘 Case open 工作区（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock设置P5范围.mockClear();
    mock加载工作区.mockClear();
    mock追加工作区.mockClear();
    mock刷新工作区.mockClear();
    mock加载连续列表.mockClear();
    mock追加连续列表.mockClear();
    mock刷新连续列表.mockClear();
    mock适配分.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders viewer-specific action responsibility without state.needs_user（招聘端）', async () => {
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1', 待办: false })] }),
    });
    render(列表元素('recruiter', 职位ID));
    expect(await screen.findByText('代理处理中')).toBeTruthy();
    expect(screen.queryByText('待处理')).toBeNull(); // 不渲染 state.needs_user 侧的胶囊
  });

  it('招聘端进屏按 scope 注册可见范围并懒加载（先注册后加载，离开即清）', () => {
    置P5状态({ role: 'recruiter', filterRef: 职位ID, 快照: 快照({ items: [招聘行({ caseId: 'mc_1' })] }) });
    render(列表元素('recruiter', 职位ID));
    expect(mock设置P5范围).toHaveBeenCalledWith('recruiter', P5范围键.open('recruiter', 职位ID));
    expect(mock加载工作区).toHaveBeenCalledWith('recruiter', 职位ID);
    expect(mock设置P5范围.mock.invocationCallOrder[0]).toBeLessThan(
      mock加载工作区.mock.invocationCallOrder[0]);
    // 招聘分支零连续读取（negotiation 是候选专属资源）
    expect(mock加载连续列表).not.toHaveBeenCalled();
  });

  it('快照 owner 与当前主体不同时不显示旧 case，仍加载当前 scope（招聘端）', () => {
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ ownerSubjectId: 'sub_old', items: [招聘行({ caseId: 'mc_old' })] }),
    });
    mock应用状态.后端状态.主体 = {
      ...BFF主体样本,
      subject_id: 'sub_new',
      last_used_role: 'recruiter',
    };
    render(列表元素('recruiter', 职位ID));
    expect(mock加载工作区).toHaveBeenCalledWith('recruiter', 职位ID);
  });

  it('招聘端保留服务端顺序：不按 needs_action 在客户端重排', () => {
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({
        items: [
          招聘行({ caseId: 'mc_a', 待办: false, 更新于: '2026-08-29T05:00:00Z' }),
          招聘行({ caseId: 'mc_b', 待办: true, 更新于: '2026-08-29T04:00:00Z' }),
        ],
      }),
    });
    render(列表元素('recruiter', 职位ID));
    expect(screen.getAllByText(/^(需要你|代理处理中)$/).map((元) => 元.textContent))
      .toEqual(['代理处理中', '需要你']);
  });

  it('「待你拍」派发后（看什么=待我拍板）招聘端列表仍显示全部、需要你的在前', () => {
    const items = [招聘行({ caseId: 'mc_a', 待办: true }), 招聘行({ caseId: 'mc_b', 待办: false })];
    mock应用状态 = {
      数据源模式: 'backend',
      派发: mock派发,
      状态: { 企业在谈看什么: '待我拍板', 企业在谈范围: '当前', 企业子视图: '在谈' },
      后端状态: {
        主体: { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'recruiter' },
        P5工作区: { [P5范围键.open('recruiter', 职位ID)]: 快照({ items }) },
      },
      操作: P5操作表(),
    };
    render(列表元素('recruiter', 职位ID));
    expect(screen.getAllByText(/^(需要你|代理处理中)$/).map((元) => 元.textContent))
      .toEqual(['需要你', '代理处理中']);
    expect(screen.queryByRole('button', { name: /筛选/ })).toBeNull();
  });

  it('招聘端可见 5 秒节拍刷新已载窗口；隐藏标签页当拍跳过', async () => {
    vi.useFakeTimers();
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1' })] }),
    });
    render(列表元素('recruiter', 职位ID));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(mock刷新工作区).toHaveBeenCalledWith('recruiter', 职位ID);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    mock刷新工作区.mockClear();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(mock刷新工作区).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('招聘端首载失败给失败态与重试（重试 force 重读）', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ 阶段: '失败', items: [], error: '服务暂时不可用，请稍后再试' }),
    });
    render(列表元素('recruiter', 职位ID));
    expect(screen.getByText('在谈暂时加载不了')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock加载工作区).toHaveBeenCalledWith('recruiter', 职位ID, true);
  });

  it('招聘端刷新失败保留旧条目只读 + 单独错误行交代 + 重试走刷新', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1' })], error: '服务暂时不可用，请稍后再试' }),
    });
    render(列表元素('recruiter', 职位ID));
    expect(screen.getByText('代理处理中')).toBeTruthy();
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock刷新工作区).toHaveBeenCalledWith('recruiter', 职位ID);
    expect(mock加载工作区).toHaveBeenCalledTimes(1);
  });

  it('招聘端加载更多透传快照游标所属 scope（追加一页）；游标读尽即藏', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1' })], nextCursor: 'b2xfcgfz9Q' }),
    });
    const { rerender } = render(列表元素('recruiter', 职位ID));
    await user.click(screen.getByRole('button', { name: '加载更多' }));
    expect(mock追加工作区).toHaveBeenCalledWith('recruiter', 职位ID);
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1' })], nextCursor: null }),
    });
    rerender(列表元素('recruiter', 职位ID));
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
  });

  it('招聘端空窗口读尽给通用空态；档位不再产生「没有待我拍板的」空文案', () => {
    mock应用状态 = {
      数据源模式: 'backend',
      派发: mock派发,
      状态: { 企业在谈看什么: '待我拍板', 企业在谈范围: '当前', 企业子视图: '在谈' },
      后端状态: {
        主体: { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'recruiter' },
        P5工作区: { [P5范围键.open('recruiter', 职位ID)]: 快照({ items: [], nextCursor: null }) },
      },
      操作: P5操作表(),
    };
    render(列表元素('recruiter', 职位ID));
    expect(screen.getByText('暂无在谈候选，去推荐里让AI代理接触几个')).toBeTruthy();
    expect(screen.queryByText(/没有待我拍板的/)).toBeNull();
  });

  it('招聘端点卡按 case_id 导航：候选详情（别名/意向不做坐标）', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_9' })] }),
    });
    render(列表元素('recruiter', 职位ID));
    const 卡键 = screen.getByTestId('招聘在谈卡').querySelector('button') as HTMLButtonElement;
    await user.click(卡键);
    expect(mock跳转).toHaveBeenCalledWith(路径.候选详情('mc_9'));
  });

  it('招聘卡无候选代号/通用匿名头像/招聘职位与城市薪资/岗位技能；摘要缺失给全未知占位；同别名两行靠 case_id 区分', () => {
    const 键警告 = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      置P5状态({
        role: 'recruiter', filterRef: 职位ID,
        快照: 快照({ items: [招聘行({ caseId: 'mc_1', 别名 }), 招聘行({ caseId: 'mc_2', 别名 })] }),
      });
      const 宿主 = render(列表元素('recruiter', 职位ID));
      expect(screen.queryByText(别名)).toBeNull();
      expect(宿主.container.querySelector('[class*="匿名头像"]')).toBeNull();
      for (const 文案 of ['AI 产品实习生', '上海 · 300-500 元/天', 'Python']) {
        expect(screen.queryByText(文案)).toBeNull();
      }
      expect(screen.getAllByLabelText('性别未知')).toHaveLength(2);
      const 头区们 = Array.from(宿主.container.querySelectorAll('[data-card-region="head"]'));
      expect(头区们).toHaveLength(2);
      for (const 头区 of 头区们) {
        expect(头区.textContent).toContain('经验未知');
        expect(头区.textContent).toContain('学历未知');
        expect(头区.textContent).toContain('求职状态未知');
      }
      expect(screen.getAllByText('工作经历未知')).toHaveLength(2);
      expect(screen.getAllByText('教育经历未知')).toHaveLength(2);
      expect(screen.getAllByText('亮点信息未知')).toHaveLength(2);
      expect(键警告.mock.calls.some((参) => String(参[0]).includes('key'))).toBe(false);
    } finally {
      键警告.mockRestore();
    }
  });

  it('招聘卡摘要按 Spec §4 落位：女图标 + 5 年｜本科｜在职看机会；工作/教育/亮点行；缺分给未知占位；0 年如实显示', () => {
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1', 摘要: 招聘候选摘要样本 })] }),
    });
    const 宿主 = render(列表元素('recruiter', 职位ID));
    const 女图标 = screen.getAllByRole('img', { name: '女' });
    expect(女图标).toHaveLength(1);
    const 头区 = 女图标[0]!.closest('[data-card-region="head"]') as HTMLElement;
    for (const 段 of ['5 年', '本科', '在职看机会']) expect(头区.textContent).toContain(段);
    expect(screen.getByText('示例公司 · 软件工程师')).toBeTruthy();
    expect(screen.getByText('示例大学 · 计算机科学')).toBeTruthy();
    expect(screen.getByText('带领5人团队交付')).toBeTruthy();
    expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
    expect(宿主.container.querySelector('[class*="适配环"]')).toBeNull();
    expect(screen.getByText('匿名初筛')).toBeTruthy();
    cleanup();

    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({
        caseId: 'mc_2',
        摘要: { ...招聘候选摘要样本, gender: null, experience_years: 0, job_status: null },
      })] }),
    });
    const 二页 = render(列表元素('recruiter', 职位ID));
    expect(screen.queryByRole('img', { name: '女' })).toBeNull();
    expect(screen.getByLabelText('性别未知')).toBeTruthy();
    const 头区们 = 二页.container.querySelectorAll('[data-card-region="head"]');
    expect(头区们[0]?.textContent).toContain('不满 1 年');
    expect(头区们[0]?.textContent).toContain('求职状态未知');
    expect(screen.getByText('示例公司 · 软件工程师')).toBeTruthy();
  });

  it('招聘卡阶段区：P5 阶段标题原文 + 既有状态文案、待办徽标从头行搬入阶段区、Backend 无呼吸点、未知分占位在右列', () => {
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_stage', 待办: true, 摘要: 招聘候选摘要样本 })] }),
    });
    const 宿主 = render(列表元素('recruiter', 职位ID));
    const 卡 = screen.getByTestId('招聘在谈卡');
    const 阶段区 = 卡.querySelector('[data-card-region="stage"]');
    expect(阶段区?.textContent).toContain('匿名初筛');
    expect(阶段区?.textContent).toContain('进行中');
    expect(阶段区?.textContent).not.toContain('下一步未知');
    expect(阶段区?.textContent).toContain('需要你');
    expect(卡.querySelector('[data-card-region="head"]')?.textContent).not.toContain('需要你');
    expect(宿主.container.querySelector('[class*="阶段点呼吸"]')).toBeNull();
    expect(卡.querySelector('[data-card-region="score"]')?.textContent).toContain('分数未知');
    cleanup();

    // 失败反例：needs_action=false 且 attention 非空 → 「需注意」在阶段区 + 注意说明，绝不说「代理处理中」
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [注意行(招聘行({ caseId: 'mc_att', 待办: false }))] }),
    });
    render(列表元素('recruiter', 职位ID));
    const 注意阶段区 = screen.getByTestId('招聘在谈卡').querySelector('[data-card-region="stage"]');
    expect(注意阶段区?.textContent).toContain('需注意');
    expect(注意阶段区?.textContent).toContain('AI 服务暂时不可用，本 Case 尚未继续');
    expect(screen.queryByText('代理处理中')).toBeNull();
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull();
  });

  it('未知契约行 fail closed：契约错误卡 + 重试，不渲染该行的部分数据（招聘端）', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [契约外行('mc_bad')] }),
    });
    render(列表元素('recruiter', 职位ID));
    expect(screen.getByText(P5契约错误提示)).toBeTruthy();
    expect(screen.queryByText('AI 产品实习生')).toBeNull();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock刷新工作区).toHaveBeenCalledWith('recruiter', 职位ID);
  });

  it('合法重复亮点按响应顺序逐条渲染，无重复 key 告警（契约不要求元素唯一）', () => {
    const 键警告 = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      置P5状态({
        role: 'recruiter', filterRef: 职位ID,
        快照: 快照({ items: [招聘行({
          caseId: 'mc_1',
          摘要: { ...招聘候选摘要样本, personal_highlights: ['稳定性', '稳定性'] },
        })] }),
      });
      render(列表元素('recruiter', 职位ID));
      expect(screen.getAllByText('稳定性')).toHaveLength(2);
      expect(键警告.mock.calls.some((参) => String(参[0]).includes('key'))).toBe(false);
    } finally {
      键警告.mockRestore();
    }
  });

  it('招聘卡摘要变 null/空亮点：旧信息消失、空位给占位，Case 阶段与可打开保留', () => {
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1', 摘要: 招聘候选摘要样本 })] }),
    });
    const 页 = render(列表元素('recruiter', 职位ID));
    expect(screen.getByText('示例公司 · 软件工程师')).toBeTruthy();
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1', 摘要: { ...招聘候选摘要样本, personal_highlights: [] } })] }),
    });
    页.rerender(列表元素('recruiter', 职位ID));
    expect(screen.queryByText('带领5人团队交付')).toBeNull();
    expect(screen.getByText('亮点信息未知')).toBeTruthy();
    expect(screen.getByText('示例公司 · 软件工程师')).toBeTruthy();
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1', 摘要: null })] }),
    });
    页.rerender(列表元素('recruiter', 职位ID));
    expect(screen.queryByText('示例公司 · 软件工程师')).toBeNull();
    expect(screen.queryByText('带领5人团队交付')).toBeNull();
    expect(screen.getByText('工作经历未知')).toBeTruthy();
    expect(screen.getByText('匿名初筛')).toBeTruthy();
  });
});

// ── 两屏 Backend 分支：候选全意向横幅 + 招聘横幅不声称全量 + Mock 零 P5 ──────────

/** 求职端 Backend 屏状态：意向表里的 编号 就是 intention_id（水合映射落的）。
 *  J-PILOT-01 Task 4：主列表/横幅都读 P5连续列表 active 快照（全意向）。 */
function 置求职屏状态(选项: {
  范围?: '当前' | '全部';
  filterRef?: string | null;
  连续快照?: P5连续列表快照;
  /** 首帧用：不预置任何连续快照（快照 undefined = 还没读回来） */
  不预置快照?: boolean;
  意向表编号?: string[];
  当前意向?: string;
  /** 当前档的业务坐标；缺省取意向表第一条。给表外编号即模拟「当前意向已被删」。 */
  当前意向编号?: string | null;
}) {
  const 意向表 = (选项.意向表编号 ?? [意向ID]).map((编号, 序) => ({
    编号, 标题: `意向${序}`, 说明: '',
  }));
  // 有效当前 ID 要求服务端字典里同一条是 active（生产口径），测试逐条播种
  const 后端意向服务端 = Object.fromEntries(
    意向表.map((条) => [条.编号, { intention_id: 条.编号, status: 'active' }]),
  );
  mock应用状态 = {
    数据源模式: 'backend',
    派发: mock派发,
    状态: {
      在谈看什么: '全部',
      在谈范围: 选项.范围 ?? '当前',
      求职意向表: 意向表,
      当前意向: 选项.当前意向 ?? '意向0',
      当前意向编号: 选项.当前意向编号 === undefined ? (意向表[0]?.编号 ?? null) : 选项.当前意向编号,
      后端意向服务端,
      子视图: '在谈',
      在谈列表: [],
    },
    后端状态: {
      主体: { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'candidate' },
      P5连续列表: 选项.不预置快照 === true ? {} : {
        [P5范围键.negotiations('active')]:
          选项.连续快照 ?? 连续快照({ items: [连续卡({ recordId: 'dlg_1', phase: 'accepted' })] }),
      },
    },
    操作: P5操作表(),
  };
}

/** 招聘端 Backend 屏状态：当前岗位编号/岗位列表[].编号 都是 BFF job_id。 */
function 置招聘屏状态(选项: {
  范围?: '当前' | '全部';
  看什么?: '全部' | '待我拍板' | '进行中';
  filterRef?: string | null;
  快照?: P5列表快照;
  /** 首帧用：不预置任何 P5 工作区快照（快照 undefined = 还没读回来） */
  不预置快照?: boolean;
  岗位状态?: string;
  岗位编号?: string;
}) {
  const 编号 = 选项.岗位编号 ?? 职位ID;
  mock应用状态 = {
    数据源模式: 'backend',
    派发: mock派发,
    状态: {
      企业在谈看什么: 选项.看什么 ?? '全部',
      企业在谈范围: 选项.范围 ?? '当前',
      企业子视图: '在谈',
      企业Tab: '人才',
      当前岗位编号: 编号,
      岗位列表: [{ 编号, 名称: 'AI 产品实习生', 状态: 选项.岗位状态 ?? '在招', 薪资带: '300-500 元/天' }],
      企业规则: [],
      企业候选列表: [],
    },
    后端状态: {
      主体: { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'recruiter' },
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '成功', proposals: '成功' },
      },
      P5工作区: 选项.不预置快照 === true ? {} : {
        [P5范围键.open('recruiter', 选项.filterRef === undefined ? 编号 : 选项.filterRef)]:
          选项.快照 ?? 快照({ items: [招聘行({ caseId: 'mc_1' })] }),
      },
    },
    操作: P5操作表(),
  };
}

describe('在谈首页 / 企业在谈候选 · P5 Backend 分支', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock设置P5范围.mockClear();
    mock加载工作区.mockClear();
    mock追加工作区.mockClear();
    mock刷新工作区.mockClear();
    mock加载连续列表.mockClear();
    mock追加连续列表.mockClear();
    mock刷新连续列表.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('求职端：主列表未选意向也读全意向（恒省略 intention_id，无护栏空态）', () => {
    // 范围档=当前、当前意向编号已失效（不在表内）：列表仍加载全意向连续快照
    置求职屏状态({ filterRef: 意向ID, 当前意向编号: 'int_已被删掉的意向' });
    const { rerender } = render(<在谈首页 />);
    expect(mock加载连续列表).toHaveBeenCalledWith('active');
    expect(mock加载工作区).not.toHaveBeenCalled();
    expect(screen.queryByText('这个意向下暂时没有在谈职位。')).toBeNull();
    // 顶栏照常渲染（选择器只服务市场）；已选值不被改写
    expect(mock派发).not.toHaveBeenCalled();

    // 全部档同样读同一个全意向连续快照
    置求职屏状态({ 范围: '全部', filterRef: null });
    rerender(<在谈首页 />);
    expect(mock加载连续列表).toHaveBeenLastCalledWith('active');
  });

  it('求职端：下拉刷新用 force 首屏（丢旧游标）', () => {
    置求职屏状态({ filterRef: 意向ID });
    render(<在谈首页 />);
    const root = document.querySelector('.滚动区')!.parentElement!;
    fireEvent.pointerDown(root, { clientY: 0 });
    fireEvent.pointerMove(root, { clientY: 120 });
    fireEvent.pointerUp(root, { clientY: 120 });
    // 手动刷新走 force 首屏（Spec §5 清游标重读首屏），绝不用轮询的窗口重建
    expect(mock加载连续列表).toHaveBeenCalledWith('active', true);
    expect(mock刷新连续列表).not.toHaveBeenCalled();
  });

  it('求职端横幅：待办数读全意向连续快照，读尽才给精确「需要你处理」计数', () => {
    置求职屏状态({
      filterRef: 意向ID,
      连续快照: 连续快照({
        items: [连续卡({ recordId: 'dlg_1', phase: 'evaluating', needsAction: true })],
        nextCursor: 'b2x',
      }),
    });
    const { rerender } = render(<在谈首页 />);
    expect(screen.getByText('有职位需要你处理')).toBeTruthy();
    expect(screen.queryByText('1 个职位需要你处理')).toBeNull();
    置求职屏状态({
      filterRef: 意向ID,
      连续快照: 连续快照({
        items: [连续卡({ recordId: 'dlg_1', phase: 'evaluating', needsAction: true })],
      }),
    });
    rerender(<在谈首页 />);
    expect(screen.getByText('1 个职位需要你处理')).toBeTruthy();
    // 前文替换：移除无条件「已谈完」断言
    expect(screen.getByText('代谈进度持续更新，')).toBeTruthy();
    expect(screen.queryByText('初筛与前几轮我已谈完，')).toBeNull();
  });

  it('求职端横幅零待办分支：首帧/在飞/失败/游标未尽都不下「暂时没有」的定论，成功读尽后才定论', () => {
    // (a) 首帧（快照还没读回来）：只说正在读入，绝不出现定论文案
    置求职屏状态({ filterRef: 意向ID, 不预置快照: true });
    const { rerender } = render(<在谈首页 />);
    expect(mock加载连续列表).toHaveBeenCalledWith('active');
    expect(screen.getByText('正在读入在谈职位…')).toBeTruthy();
    expect(screen.queryByText('暂时没有需要你处理的')).toBeNull();
    // (a2) 首次读取在飞：起步构造把 nextCursor 兜底成 null —— 只看游标会误读成读尽
    置求职屏状态({
      filterRef: 意向ID,
      连续快照: 连续快照({ 阶段: '进行中', items: [] }),
    });
    rerender(<在谈首页 />);
    expect(screen.getByText('正在读入在谈职位…')).toBeTruthy();
    expect(screen.queryByText('暂时没有需要你处理的')).toBeNull();
    expect(screen.queryByText(/^[\d]+ 个职位需要你处理$/)).toBeNull();
    // (b2) 首载失败：错误卡在场，横幅只给非定论兜底、不给计数
    置求职屏状态({
      filterRef: 意向ID,
      连续快照: 连续快照({ 阶段: '失败', items: [], error: '服务暂时不可用，请稍后再试' }),
    });
    rerender(<在谈首页 />);
    expect(screen.getByText('已读入的里暂时没有需要你处理的')).toBeTruthy();
    expect(screen.queryByText('暂时没有需要你处理的')).toBeNull();
    expect(screen.getByText('在谈暂时加载不了')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
    // (b) 成功但游标未尽 + 已载零待办：只给非定论兜底
    置求职屏状态({
      filterRef: 意向ID,
      连续快照: 连续快照({
        items: [连续卡({ recordId: 'dlg_1', phase: 'accepted' })],
        nextCursor: 'b2x',
      }),
    });
    rerender(<在谈首页 />);
    expect(screen.getByText('已读入的里暂时没有需要你处理的')).toBeTruthy();
    expect(screen.queryByText('暂时没有需要你处理的')).toBeNull();
    // (c) 成功读尽 + 零待办：才下「暂时没有」的定论
    置求职屏状态({
      filterRef: 意向ID,
      连续快照: 连续快照({
        items: [连续卡({ recordId: 'dlg_1', phase: 'accepted' })],
      }),
    });
    rerender(<在谈首页 />);
    expect(screen.getByText('暂时没有需要你处理的')).toBeTruthy();
  });

  it('招聘端横幅零待办分支：首帧/在飞/失败/游标未尽都不下「暂时没有」的定论，成功读尽后才定论', () => {
    // (a) 首帧：只说正在读入
    置招聘屏状态({ filterRef: 职位ID, 不预置快照: true });
    const { rerender } = render(<企业在谈候选 />);
    expect(mock加载工作区).toHaveBeenCalledWith('recruiter', 职位ID);
    expect(screen.getByText('正在读入在谈候选…')).toBeTruthy();
    expect(screen.queryByText('暂时没有需要你拍板的')).toBeNull();
    // (a2) 首次读取在飞（阶段 进行中，nextCursor 兜底 null）：仍只说正在读入
    置招聘屏状态({
      filterRef: 职位ID,
      快照: 快照({ 阶段: '进行中', items: [], nextCursor: null, 刷新中: true }),
    });
    rerender(<企业在谈候选 />);
    expect(screen.getByText('正在读入在谈候选…')).toBeTruthy();
    expect(screen.queryByText('暂时没有需要你拍板的')).toBeNull();
    // (b2) 首载失败（阶段 失败，nextCursor 也是 null）：错误卡在场，横幅只给非定论兜底
    置招聘屏状态({
      filterRef: 职位ID,
      快照: 快照({ 阶段: '失败', items: [], nextCursor: null, error: '服务暂时不可用，请稍后再试' }),
    });
    rerender(<企业在谈候选 />);
    expect(screen.getByText('已读入的里暂时没有需要你拍板的')).toBeTruthy();
    expect(screen.queryByText('暂时没有需要你拍板的')).toBeNull();
    expect(screen.getByText('在谈暂时加载不了')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
    // (b) 成功但游标未尽 + 已载零待办：只给非定论兜底
    置招聘屏状态({
      filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1', 待办: false })], nextCursor: 'b2x' }),
    });
    rerender(<企业在谈候选 />);
    expect(screen.getByText('已读入的里暂时没有需要你拍板的')).toBeTruthy();
    expect(screen.queryByText('暂时没有需要你拍板的')).toBeNull();
    // (c) 成功读尽 + 零待办：才下「暂时没有」的定论
    置招聘屏状态({
      filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1', 待办: false })], nextCursor: null }),
    });
    rerender(<企业在谈候选 />);
    expect(screen.getByText('暂时没有需要你拍板的')).toBeTruthy();
  });

  it('招聘端：当前档按在招 job_id 过滤，全部档不带过滤；归档岗绝不拿来当 scope', () => {
    置招聘屏状态({ filterRef: 职位ID });
    const { rerender } = render(<企业在谈候选 />);
    expect(mock加载工作区).toHaveBeenCalledWith('recruiter', 职位ID);
    expect(screen.getByTestId('招聘在谈卡')).toBeTruthy();
    置招聘屏状态({ 范围: '全部', filterRef: null });
    rerender(<企业在谈候选 />);
    expect(mock加载工作区).toHaveBeenLastCalledWith('recruiter', null);
    cleanup();

    mock加载工作区.mockClear();
    mock设置P5范围.mockClear();
    置招聘屏状态({ filterRef: 职位ID, 岗位状态: '已归档' });
    render(<企业在谈候选 />);
    expect(screen.getByText('还没有在招的岗位')).toBeTruthy();
    expect(screen.getByText('暂时没有需要你拍板的')).toBeTruthy();
    expect(mock设置P5范围).not.toHaveBeenCalled();
    expect(mock加载工作区).not.toHaveBeenCalled();
    expect(mock加载连续列表).not.toHaveBeenCalled();
  });

  it('Mock 分支行为原样且零 P5 请求（两端）', async () => {
    mock应用状态 = {
      数据源模式: 'mock',
      派发: mock派发,
      状态: {
        子视图: '在谈', 当前Tab: '职位',
        在谈看什么: '全部', 在谈范围: '当前',
        求职意向表: [{ 编号: 'I-1', 标题: '后端工程师', 说明: '' }],
        当前意向: '后端工程师',
        在谈列表,
      },
      后端状态: {},
      操作: P5操作表(),
    };
    const 页 = render(<在谈首页 />);
    expect(await screen.findByText('资深后端工程师 · 交易网关')).toBeTruthy();
    // Mock 横幅原文保持（不含新前文）
    expect(screen.getByText('初筛与前几轮我已谈完，')).toBeTruthy();
    页.unmount();

    mock应用状态 = {
      数据源模式: 'mock',
      派发: mock派发,
      状态: {
        企业子视图: '在谈', 企业Tab: '人才',
        企业在谈看什么: '全部', 企业在谈范围: '当前',
        当前岗位编号: 'P-01',
        岗位列表: 在招岗位列表,
        企业候选列表: 在谈候选列表,
        企业规则: [],
      },
      后端状态: {},
      操作: P5操作表(),
    };
    render(<企业在谈候选 />);
    expect((await screen.findAllByRole('img', { name: '男' })).length).toBeGreaterThan(0);
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(screen.queryByText('陈屿')).toBeNull();

    expect(mock设置P5范围).not.toHaveBeenCalled();
    expect(mock加载工作区).not.toHaveBeenCalled();
    expect(mock追加工作区).not.toHaveBeenCalled();
    expect(mock刷新工作区).not.toHaveBeenCalled();
    expect(mock加载连续列表).not.toHaveBeenCalled();
    expect(mock追加连续列表).not.toHaveBeenCalled();
    expect(mock刷新连续列表).not.toHaveBeenCalled();
  });
});

// ── 刷新失败（候选连续半边）：已有成功空缓存后刷新失败，也必须给错误与重试 ──────
describe('候选连续在谈 · 刷新失败的错误与重试', () => {
  beforeEach(() => {
    mock加载连续列表.mockClear();
    mock刷新连续列表.mockClear();
  });

  it('成功空缓存 + 刷新失败：出错误行与重试，不下「没有在谈」的定论', async () => {
    const user = userEvent.setup();
    置求职屏状态({
      连续快照: { ...连续快照({ items: [] }), error: '在谈暂时加载不了', 刷新中: false },
    });
    render(<在谈首页 />);
    expect(screen.getByText('在谈暂时加载不了')).toBeTruthy();
    expect(screen.queryByText('暂时没有在谈职位。')).toBeNull();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock刷新连续列表).toHaveBeenCalledWith('active');
  });

  it('有旧条目 + 刷新失败：旧卡保留只读，错误行照常在', () => {
    置求职屏状态({
      连续快照: {
        ...连续快照({ items: [连续卡({ recordId: 'dlg_1', phase: 'accepted' })] }),
        error: '在谈暂时加载不了', 刷新中: false,
      },
    });
    render(<在谈首页 />);
    expect(screen.getByText('在谈暂时加载不了')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
    expect(screen.getByText('已受理')).toBeTruthy();
  });

  it('刷新中不出错误行：正在重试时不摆一个已经过期的错误', () => {
    置求职屏状态({
      连续快照: { ...连续快照({ items: [] }), error: '在谈暂时加载不了', 刷新中: true },
    });
    render(<在谈首页 />);
    expect(screen.queryByText('在谈暂时加载不了')).toBeNull();
  });
});