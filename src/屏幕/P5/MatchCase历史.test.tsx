// P5 Task 7：双端终局历史（MatchCase历史 + 归档谈判/企业归档 的 Backend 分支）的行为测试。
// 覆盖：candidate/recruiter 各自分别请求 completed 与 ended（两个 scope 键、先注册后加载、
// 卸载即清）、两架子快照互不合并（行各归各组、加载更多只透传本架游标、游标绝不串架）、
// 点卡按 case_id 开同一四阶段详情路由（求职→在谈详情 / 招聘→候选详情）、终局卡零待办徽标
// （terminal read-only）、首载失败/刷新失败/契约错误行的重试、空窗口读尽文案、历史零轮询、
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
import type { P5列表快照 } from '../../状态/后端/类型';
import type { P5列表项, P5历史生命周期 } from '../../数据/招聘数据源/MatchCase';
import { P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { P5角色 } from '../../数据/MatchCase展示映射';
import { 路径 } from '../../路由/路径表';
import { 归档列表初始 } from '../../测试/P5Mock边界种子';

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
// 生产 Provider 的 操作 引用稳定（useMemo），桩宿主同样给恒定表
const mock操作 = {
  设置P5范围: mock设置P5范围,
  加载历史: mock加载历史,
  追加历史: mock追加历史,
  刷新历史: mock刷新历史,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }) }));

const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 职位ID = 'job_0123456789abcdef0123456789abcdef';
const 别名 = 'candidate-0123456789ab';

// ── DTO 样本：快照里存的是已 decode 的归一化 P5 DTO（decode 归 Task 1）。终局行只落
//    17 行矩阵的四条 ended 行与唯一一条 completed 行；needsAction 恒 false（终局行带
//    needs_action=true 在 decode 已是契约错误）。──

interface 行选项 {
  caseId: string;
  lifecycle: P5历史生命周期;
  职位名?: string;
}

/** 终局行的合法四元组：completed → 意向确认/passed/handoff_pending；ended → S0/ended/complete。 */
function 终局状态(选项: 行选项): P5列表项['state'] {
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
  };
}

function 候选终局行(选项: 行选项): P5列表项 {
  return {
    role: 'candidate',
    state: 终局状态(选项),
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
    state: 终局状态(选项),
    needsAction: false,
    candidateAlias: 别名,
    job: 候选终局行(选项).job,
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
} = {}): P5列表快照 {
  return {
    阶段: 选项.阶段 ?? '成功',
    刷新中: 选项.刷新中 ?? false,
    items: 选项.items ?? [],
    nextCursor: 选项.nextCursor ?? null,
    已加载页数: 1,
    error: 选项.error ?? null,
    generation: 1,
  };
}

/** 组件级状态底座：completed / ended 两架各预置各的快照（缺省空窗口读尽）。 */
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
      P5历史: {
        [P5范围键.history(选项.role, 'completed', null)]: 选项.completed快照 ?? 快照(),
        [P5范围键.history(选项.role, 'ended', null)]: 选项.ended快照 ?? 快照(),
      },
    },
    操作: mock操作,
  };
  return 选项;
}

// oxlint 的 jsx-a11y/aria-role 会把 P5 域 prop role= 当 ARIA role 检查（误报）：
// 元素统一在这里造，只需一处关闭。
// eslint-disable-next-line jsx-a11y/aria-role
function 历史元素(role: 'candidate' | 'recruiter') {
  return <MatchCase历史 role={role} />;
}

describe('MatchCase历史 · 双架子（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock设置P5范围.mockClear();
    mock加载历史.mockClear();
    mock追加历史.mockClear();
    mock刷新历史.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('双端各自分别请求 completed 与 ended：两个 scope 键、先注册后加载、卸载即清', () => {
    置历史状态({
      role: 'candidate',
      completed快照: 快照({ items: [候选终局行({ caseId: 'mc_c1', lifecycle: 'completed' })] }),
      ended快照: 快照({ items: [候选终局行({ caseId: 'mc_e1', lifecycle: 'ended', 职位名: '数据分析师' })] }),
    });
    const 完成键 = P5范围键.history('candidate', 'completed', null);
    const 结束键 = P5范围键.history('candidate', 'ended', null);
    expect(完成键).not.toBe(结束键); // 两个架子永不共用一个 scope 键
    const 页 = render(历史元素('candidate'));
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', 完成键);
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', 结束键);
    expect(mock加载历史).toHaveBeenCalledWith('candidate', 'completed', null);
    expect(mock加载历史).toHaveBeenCalledWith('candidate', 'ended', null);
    // 先注册可见范围再懒加载（操作层栅栏靠注册的可见范围对上）
    expect(mock设置P5范围.mock.invocationCallOrder[1]).toBeLessThan(
      mock加载历史.mock.invocationCallOrder[0]);
    页.unmount();
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', null);

    // 招聘端同构：同一次进屏分别请求两架（键按 role 隔离）
    cleanup();
    mock设置P5范围.mockClear();
    mock加载历史.mockClear();
    置历史状态({
      role: 'recruiter',
      completed快照: 快照({ items: [招聘终局行({ caseId: 'mc_c1', lifecycle: 'completed' })] }),
      ended快照: 快照({ items: [招聘终局行({ caseId: 'mc_e1', lifecycle: 'ended' })] }),
    });
    render(历史元素('recruiter'));
    expect(mock设置P5范围).toHaveBeenCalledWith('recruiter', P5范围键.history('recruiter', 'completed', null));
    expect(mock设置P5范围).toHaveBeenCalledWith('recruiter', P5范围键.history('recruiter', 'ended', null));
    expect(mock加载历史).toHaveBeenCalledWith('recruiter', 'completed', null);
    expect(mock加载历史).toHaveBeenCalledWith('recruiter', 'ended', null);
  });

  it('两架子互不合并：行各归各组，加载更多只透传本架游标（游标绝不串架）', async () => {
    const user = userEvent.setup();
    置历史状态({
      role: 'candidate',
      completed快照: 快照({
        items: [候选终局行({ caseId: 'mc_c1', lifecycle: 'completed', 职位名: '平台工程师' })],
        nextCursor: 'b2xc', // completed 架游标未尽
      }),
      ended快照: 快照({
        items: [候选终局行({ caseId: 'mc_e1', lifecycle: 'ended', 职位名: '数据分析师' })],
        // ended 架读尽：无加载更多
      }),
    });
    render(历史元素('candidate'));
    expect(screen.getByText('平台工程师')).toBeTruthy(); // completed 行只在 completed 架
    expect(screen.getByText('数据分析师')).toBeTruthy(); // ended 行只在 ended 架
    // 只有 completed 架游标未尽：加载更多恰一枚
    expect(screen.getAllByRole('button', { name: '加载更多' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '加载更多' }));
    expect(mock追加历史).toHaveBeenCalledTimes(1);
    expect(mock追加历史).toHaveBeenCalledWith('candidate', 'completed', null);
    // 绝不把 completed 的游标透传给 ended（或反之）
    expect(mock追加历史.mock.calls.some((调) => 调[1] === 'ended')).toBe(false);
  });

  it('点卡按 case_id 开同一四阶段详情路由：求职→在谈详情 / 招聘→候选详情；终局卡零待办徽标', async () => {
    const user = userEvent.setup();
    置历史状态({
      role: 'candidate',
      completed快照: 快照({ items: [候选终局行({ caseId: 'mc_c1', lifecycle: 'completed', 职位名: '平台工程师' })] }),
      ended快照: 快照({ items: [候选终局行({ caseId: 'mc_e1', lifecycle: 'ended', 职位名: '数据分析师' })] }),
    });
    const 页 = render(历史元素('candidate'));
    await user.click(screen.getByText('平台工程师'));
    expect(mock跳转).toHaveBeenCalledWith(路径.在谈详情('mc_c1'));
    await user.click(screen.getByText('数据分析师'));
    expect(mock跳转).toHaveBeenLastCalledWith(路径.在谈详情('mc_e1'));
    // 终局行零动作归属徽标（读-only：不是「需要你」也不是「代理处理中」）
    expect(screen.queryByText('需要你')).toBeNull();
    expect(screen.queryByText('代理处理中')).toBeNull();
    // 架子标题在场（「已结束」另作 ended 卡的闭词状态文案出现，属正常）
    expect(screen.getAllByText('已谈成').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已结束').length).toBeGreaterThan(1);
    页.unmount();

    // 招聘端镜像：候选详情路由，导航坐标是 case_id（别名不做坐标）
    cleanup();
    mock跳转.mockClear();
    置历史状态({
      role: 'recruiter',
      completed快照: 快照({ items: [招聘终局行({ caseId: 'mc_c1', lifecycle: 'completed' })] }),
      ended快照: 快照({ items: [招聘终局行({ caseId: 'mc_e1', lifecycle: 'ended' })] }),
    });
    render(历史元素('recruiter'));
    await user.click(screen.getAllByText(别名)[0]!);
    expect(mock跳转).toHaveBeenCalledWith(路径.候选详情('mc_c1'));
  });

  it('首载失败给失败态与重试（force 重读本架），另一架不受波及', async () => {
    const user = userEvent.setup();
    置历史状态({
      role: 'candidate',
      completed快照: 快照({ 阶段: '失败', items: [], error: '服务暂时不可用，请稍后再试' }),
      ended快照: 快照({ items: [候选终局行({ caseId: 'mc_e1', lifecycle: 'ended', 职位名: '数据分析师' })] }),
    });
    render(历史元素('candidate'));
    expect(screen.getByText('历史暂时加载不了')).toBeTruthy();
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    expect(screen.getByText('数据分析师')).toBeTruthy(); // ended 架照常渲染
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock加载历史).toHaveBeenCalledWith('candidate', 'completed', null, true);
  });

  it('刷新失败保留旧条目只读 + 单独错误行交代 + 重试走刷新历史', async () => {
    const user = userEvent.setup();
    置历史状态({
      role: 'candidate',
      completed快照: 快照({
        items: [候选终局行({ caseId: 'mc_c1', lifecycle: 'completed', 职位名: '平台工程师' })],
        error: '服务暂时不可用，请稍后再试',
      }),
    });
    render(历史元素('candidate'));
    expect(screen.getByText('平台工程师')).toBeTruthy(); // 旧卡原样保留，不降级成空白
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock刷新历史).toHaveBeenCalledWith('candidate', 'completed', null);
    expect(mock加载历史).toHaveBeenCalledTimes(2); // 只有进屏懒加载两架，重试不再叠一层
  });

  it('未知契约行 fail closed：契约错误提示 + 重试，不渲染该行的部分数据', async () => {
    const user = userEvent.setup();
    置历史状态({
      role: 'candidate',
      completed快照: 快照({ items: [契约外行({ caseId: 'mc_bad', lifecycle: 'completed' })] }),
    });
    render(历史元素('candidate'));
    expect(screen.getByText(P5契约错误提示)).toBeTruthy();
    expect(screen.queryByText('平台工程师')).toBeNull(); // 不渲染冻结职位等部分数据
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock刷新历史).toHaveBeenCalledWith('candidate', 'completed', null);
  });

  it('历史零轮询：可见 11 秒后无任何刷新调用（终局架子不进 5s/3s 节拍）', async () => {
    vi.useFakeTimers();
    置历史状态({
      role: 'candidate',
      completed快照: 快照({ items: [候选终局行({ caseId: 'mc_c1', lifecycle: 'completed' })] }),
      ended快照: 快照({ items: [候选终局行({ caseId: 'mc_e1', lifecycle: 'ended' })] }),
    });
    render(历史元素('candidate'));
    await act(() => vi.advanceTimersByTimeAsync(11_000));
    expect(mock刷新历史).not.toHaveBeenCalled();
    expect(mock加载历史).toHaveBeenCalledTimes(2); // 仍只有进屏那两发
  });

  it('空窗口读尽给各架空态文案（双端）', () => {
    置历史状态({ role: 'candidate' });
    render(历史元素('candidate'));
    expect(screen.getByText('还没有谈成的职位。')).toBeTruthy();
    expect(screen.getByText('没有已结束的职位。')).toBeTruthy();
    cleanup();
    置历史状态({ role: 'recruiter' });
    render(历史元素('recruiter'));
    expect(screen.getByText('还没有谈成的候选。')).toBeTruthy();
    expect(screen.getByText('没有已结束的候选。')).toBeTruthy();
  });
});

// ── 两屏 Backend 分支：双架子接线 + Mock 归档体零 P5 ────────────────────────────

describe('归档谈判 / 企业归档 · P5 Backend 分支', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock设置P5范围.mockClear();
    mock加载历史.mockClear();
    mock追加历史.mockClear();
    mock刷新历史.mockClear();
  });

  it('Backend 双端渲染双架子历史；Mock 归档卡一概不渲染', () => {
    置历史状态({
      role: 'candidate',
      completed快照: 快照({ items: [候选终局行({ caseId: 'mc_c1', lifecycle: 'completed', 职位名: '平台工程师' })] }),
      ended快照: 快照({ items: [候选终局行({ caseId: 'mc_e1', lifecycle: 'ended', 职位名: '数据分析师' })] }),
    });
    const 页 = render(<归档谈判 />);
    expect(screen.getAllByText('已谈成').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已结束').length).toBeGreaterThan(0);
    expect(screen.getByText('平台工程师')).toBeTruthy();
    expect(mock加载历史).toHaveBeenCalledWith('candidate', 'completed', null);
    expect(mock加载历史).toHaveBeenCalledWith('candidate', 'ended', null);
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
  });
});
