// P5 Task 4：双端 open 工作区列表（MatchCase列表 + 在谈首页/企业在谈候选 的 Backend
// 分支）的行为测试。覆盖：viewer 专属 needs_action 文案（绝不读 state.needs_user）、
// candidate/recruiter 当前/全部 scope 的过滤坐标、服务端顺序保留（不客户端重排）、
// 状态档只滤已载条目且读尽前不声称全量、首载失败/重试、刷新失败旧条目保留 + 重试、
// 不透明游标加载更多与读尽即藏、case_id 导航与 React 键、别名原样 + 与别名无关的
// 通用头像、未知契约行 fail closed、可见 5 秒轮询接线、Mock 分支零 P5 请求。
// 测试宿主：mock 应用状态 / 导航钩子（同 候选推荐.test.tsx 惯例）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null
// （brief 片段里的 toBeInTheDocument 按仓库惯例换成 toBeTruthy）。

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchCase列表 } from './MatchCase列表';
import 在谈首页 from '../在谈首页';
import 企业在谈候选 from '../企业在谈候选';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import type { P5列表快照 } from '../../状态/后端/类型';
import type { P5列表项 } from '../../数据/招聘数据源/MatchCase';
import { P5契约错误提示 } from '../../数据/MatchCase展示映射';
import { 路径 } from '../../路由/路径表';
import { 在谈列表, 在招岗位列表, 在谈候选列表 } from '../../测试/P5Mock边界种子';

// jsdom 不实现 scrollIntoView / scrollTo
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}
if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = () => {};
}

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock设置P5范围 = vi.fn();
const mock加载工作区 = vi.fn(async () => undefined);
const mock追加工作区 = vi.fn(async () => undefined);
const mock刷新工作区 = vi.fn(async () => undefined);
// 生产 Provider 的 操作 引用稳定（useMemo），桩宿主同样给恒定表 —— 避免每次置状态都
// 让组件 effect 因依赖换引用而重跑
const mock操作 = {
  设置P5范围: mock设置P5范围,
  加载工作区: mock加载工作区,
  追加工作区: mock追加工作区,
  刷新工作区: mock刷新工作区,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../../状态/应用状态', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  use应用状态: () => mock应用状态,
}));
vi.mock('../../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }) }));

const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 职位ID = 'job_0123456789abcdef0123456789abcdef';
const 别名 = 'candidate-0123456789ab';

// ── DTO 样本：快照里存的是已 decode 的归一化 P5 DTO（decode 归 Task 1，同
//    MatchCase操作.test.ts 惯例）；state.needsUser 刻意恒 false —— 待办文案只能来自
//    列表行的 viewer 专属 needs_action。──

function 候选行(选项: { caseId: string; 待办?: boolean; 更新于?: string }): P5列表项 {
  return {
    role: 'candidate',
    state: {
      caseId: 选项.caseId, lifecycle: 'open', stage: 'anonymous_screening', status: 'running',
      step: 'policy_check', round: 0, roundBudget: 3, needsUser: false,
      outcome: null, outcomeCode: null,
      createdAt: '2026-08-29T01:00:00Z',
      updatedAt: 选项.更新于 ?? '2026-08-29T02:00:00Z', finalizedAt: null,
    },
    needsAction: 选项.待办 ?? true,
    intentionId: 意向ID,
    job: {
      jobId: 职位ID,
      job: { title: 'AI 产品实习生', location: '上海', publicSalaryRange: '300-500 元/天', requiredSkills: ['Python'] },
    },
  };
}

function 招聘行(选项: { caseId: string; 待办?: boolean; 别名?: string }): P5列表项 {
  return {
    role: 'recruiter',
    state: {
      ...候选行({ caseId: 选项.caseId }).state,
    },
    needsAction: 选项.待办 ?? false,
    candidateAlias: 选项.别名 ?? 别名,
    job: 候选行({ caseId: 选项.caseId }).job,
  };
}

/** 矩阵外行（open+running 却给 handoff_pending）：decode 挡得住的漂移若仍进快照，
 *  展示映射必须 fail closed —— 用于未知契约用例，不需要任何 as。 */
function 契约外行(caseId: string): P5列表项 {
  const 行 = 候选行({ caseId });
  return { ...行, state: { ...行.state, step: 'handoff_pending' } };
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

function P5操作表(): Record<string, unknown> {
  return mock操作;
}

// oxlint 的 jsx-a11y/aria-role 会把 P5 域 prop role= 当 ARIA role 检查（误报）：
// 元素统一在这里造，只需一处关闭。
// eslint-disable-next-line jsx-a11y/aria-role
function 列表元素(role: 'candidate' | 'recruiter', filterRef: string | null) {
  return <MatchCase列表 role={role} filterRef={filterRef} />;
}

/** 组件级状态底座：只喂 MatchCase列表 会读的字段（角色分档读 在谈看什么/企业在谈看什么）。 */
function 置P5状态(选项: {
  role: 'candidate' | 'recruiter';
  filterRef: string | null;
  快照?: P5列表快照;
  看什么?: '全部' | '待我拍板' | '进行中';
}) {
  mock应用状态 = {
    数据源模式: 'backend',
    派发: mock派发,
    状态: 选项.role === 'candidate'
      ? { 在谈看什么: 选项.看什么 ?? '全部', 在谈范围: '当前', 求职意向表: [], 当前意向: '', 子视图: '在谈' }
      : { 企业在谈看什么: 选项.看什么 ?? '全部', 企业在谈范围: '当前', 企业子视图: '在谈' },
    后端状态: {
      P5工作区: { [P5范围键.open(选项.role, 选项.filterRef)]: 选项.快照 ?? 快照() },
    },
    操作: P5操作表(),
  };
  return 选项;
}

describe('MatchCase列表 · P5 open 工作区（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock设置P5范围.mockClear();
    mock加载工作区.mockClear();
    mock追加工作区.mockClear();
    mock刷新工作区.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // brief 片段：同一 viewer 专属 needs_action（行里 state.needs_user 恒 false），
  // 候选端渲染「需要你」、招聘端渲染「代理处理中」。
  it('renders viewer-specific action responsibility without state.needs_user', async () => {
    置P5状态({
      role: 'candidate', filterRef: 意向ID,
      快照: 快照({ items: [候选行({ caseId: 'mc_1', 待办: true })] }),
    });
    render(列表元素('candidate', 意向ID));
    expect(await screen.findByText('需要你')).toBeTruthy();
    expect(screen.queryByText('待处理')).toBeNull(); // 不渲染 state.needs_user 侧的胶囊
    cleanup();
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1', 待办: false })] }),
    });
    render(列表元素('recruiter', 职位ID));
    expect(await screen.findByText('代理处理中')).toBeTruthy();
  });

  it('进屏按 scope 注册可见范围并懒加载（先注册后加载，离开即清）；全部档 filterRef=null', () => {
    置P5状态({ role: 'candidate', filterRef: 意向ID, 快照: 快照({ items: [候选行({ caseId: 'mc_1' })] }) });
    const 页 = render(列表元素('candidate', 意向ID));
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', P5范围键.open('candidate', 意向ID));
    expect(mock加载工作区).toHaveBeenCalledWith('candidate', 意向ID);
    expect(mock设置P5范围.mock.invocationCallOrder[0]).toBeLessThan(
      mock加载工作区.mock.invocationCallOrder[0]);
    页.unmount();
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', null);

    // 全部意向档：不带任何意向过滤（scope 键的过滤段是 '*'）
    置P5状态({ role: 'candidate', filterRef: null, 快照: 快照({ items: [候选行({ caseId: 'mc_1' })] }) });
    render(列表元素('candidate', null));
    expect(mock设置P5范围).toHaveBeenLastCalledWith('candidate', P5范围键.open('candidate', null));
    expect(mock加载工作区).toHaveBeenLastCalledWith('candidate', null);
    cleanup();

    // 招聘端当前岗位档：owned job_id 当过滤坐标
    mock设置P5范围.mockClear();
    mock加载工作区.mockClear();
    置P5状态({ role: 'recruiter', filterRef: 职位ID, 快照: 快照({ items: [招聘行({ caseId: 'mc_1' })] }) });
    render(列表元素('recruiter', 职位ID));
    expect(mock设置P5范围).toHaveBeenCalledWith('recruiter', P5范围键.open('recruiter', 职位ID));
    expect(mock加载工作区).toHaveBeenCalledWith('recruiter', 职位ID);
  });

  it('切 scope 先清旧可见范围再注册新键，旧 scope 数据不进新列表', () => {
    置P5状态({ role: 'candidate', filterRef: 意向ID, 快照: 快照({ items: [候选行({ caseId: 'mc_a' })] }) });
    const { rerender } = render(列表元素('candidate', 意向ID));
    expect(screen.getByText('需要你')).toBeTruthy();
    置P5状态({ role: 'candidate', filterRef: null, 快照: 快照({ items: [] }) });
    rerender(列表元素('candidate', null));
    expect(screen.queryByText('需要你')).toBeNull(); // mc_a 属于旧 scope 键，绝不串台
    expect(mock设置P5范围.mock.calls).toEqual([
      ['candidate', P5范围键.open('candidate', 意向ID)],
      ['candidate', null],
      ['candidate', P5范围键.open('candidate', null)],
    ]);
    expect(mock加载工作区).toHaveBeenLastCalledWith('candidate', null);
  });

  it('保留服务端顺序：不按 needs_action 在客户端重排', () => {
    // 服务端序 = needs_action DESC, updated_at DESC, case_id DESC；这里刻意给一个
    // 「非待办在前、待办在后」的页，若客户端重排（Mock 屏的置顶逻辑）顺序会反过来。
    置P5状态({
      role: 'candidate', filterRef: 意向ID,
      快照: 快照({
        items: [
          候选行({ caseId: 'mc_a', 待办: false, 更新于: '2026-08-29T05:00:00Z' }),
          候选行({ caseId: 'mc_b', 待办: true, 更新于: '2026-08-29T04:00:00Z' }),
        ],
      }),
    });
    render(列表元素('candidate', 意向ID));
    expect(screen.getAllByText(/^(需要你|代理处理中)$/).map((元) => 元.textContent))
      .toEqual(['代理处理中', '需要你']);
  });

  it('状态档只过滤已载条目：待我拍板=needs_action、进行中=!needs_action（双端各认各的档）', () => {
    const items = [候选行({ caseId: 'mc_a', 待办: true }), 候选行({ caseId: 'mc_b', 待办: false })];
    置P5状态({ role: 'candidate', filterRef: 意向ID, 快照: 快照({ items }), 看什么: '待我拍板' });
    const { rerender } = render(列表元素('candidate', 意向ID));
    expect(screen.getByText('需要你')).toBeTruthy();
    expect(screen.queryByText('代理处理中')).toBeNull();
    置P5状态({ role: 'candidate', filterRef: 意向ID, 快照: 快照({ items }), 看什么: '进行中' });
    rerender(列表元素('candidate', 意向ID));
    expect(screen.queryByText('需要你')).toBeNull();
    expect(screen.getByText('代理处理中')).toBeTruthy();
    cleanup();

    // 招聘端读 企业在谈看什么（不是 在谈看什么）
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_a', 待办: false }), 招聘行({ caseId: 'mc_b', 待办: true })] }),
      看什么: '待我拍板',
    });
    render(列表元素('recruiter', 职位ID));
    expect(screen.getByText('需要你')).toBeTruthy();
    expect(screen.queryByText('代理处理中')).toBeNull();
  });

  it('可见 5 秒节拍刷新已载窗口；隐藏标签页当拍跳过', async () => {
    vi.useFakeTimers();
    置P5状态({
      role: 'candidate', filterRef: 意向ID,
      快照: 快照({ items: [候选行({ caseId: 'mc_1' })] }),
    });
    render(列表元素('candidate', 意向ID));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(mock刷新工作区).toHaveBeenCalledWith('candidate', 意向ID);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    mock刷新工作区.mockClear();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(mock刷新工作区).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('首载失败给失败态与重试（重试 force 重读）', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'candidate', filterRef: 意向ID,
      快照: 快照({ 阶段: '失败', items: [], error: '服务暂时不可用，请稍后再试' }),
    });
    render(列表元素('candidate', 意向ID));
    expect(screen.getByText('在谈暂时加载不了')).toBeTruthy();
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock加载工作区).toHaveBeenCalledWith('candidate', 意向ID, true);
  });

  it('刷新失败保留旧条目只读 + 单独错误行交代 + 重试走刷新', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'candidate', filterRef: 意向ID,
      快照: 快照({ items: [候选行({ caseId: 'mc_1' })], error: '服务暂时不可用，请稍后再试' }),
    });
    render(列表元素('candidate', 意向ID));
    expect(screen.getByText('需要你')).toBeTruthy(); // 旧卡原样保留，不降级成空白
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock刷新工作区).toHaveBeenCalledWith('candidate', 意向ID);
    expect(mock加载工作区).toHaveBeenCalledTimes(1); // 只有进屏懒加载那一次，重试不再叠一层
  });

  it('加载更多透传快照游标所属 scope（追加一页）；游标读尽即藏', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1' })], nextCursor: 'b2xfcgfz9Q' }),
    });
    const { rerender } = render(列表元素('recruiter', 职位ID));
    await user.click(screen.getByRole('button', { name: '加载更多' }));
    expect(mock追加工作区).toHaveBeenCalledWith('recruiter', 职位ID);
    // 游标为 null（读尽）：加载更多整个消失
    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_1' })], nextCursor: null }),
    });
    rerender(列表元素('recruiter', 职位ID));
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
  });

  it('空窗口读尽给空态；状态档滤空在读尽前不声称「没有」', () => {
    置P5状态({ role: 'candidate', filterRef: 意向ID, 快照: 快照({ items: [], nextCursor: null }) });
    const { rerender } = render(列表元素('candidate', 意向ID));
    expect(screen.getByText('暂时没有在谈职位。')).toBeTruthy();
    // 游标未尽：已载 1 条非待办 + 待我拍板档 —— 不能说「没有待我拍板的职位」
    置P5状态({
      role: 'candidate', filterRef: 意向ID,
      快照: 快照({ items: [候选行({ caseId: 'mc_1', 待办: false })], nextCursor: 'b2x' }),
      看什么: '待我拍板',
    });
    rerender(列表元素('candidate', 意向ID));
    expect(screen.queryByText('没有待我拍板的职位')).toBeNull();
    expect(screen.getByText('已读入的里没有待我拍板的职位，加载更多后再看。')).toBeTruthy();
    // 游标读尽后才是可以下的结论
    置P5状态({
      role: 'candidate', filterRef: 意向ID,
      快照: 快照({ items: [候选行({ caseId: 'mc_1', 待办: false })], nextCursor: null }),
      看什么: '待我拍板',
    });
    rerender(列表元素('candidate', 意向ID));
    expect(screen.getByText('没有待我拍板的职位')).toBeTruthy();
  });

  it('点卡按 case_id 导航：求职端→在谈详情、招聘端→候选详情（别名/意向不做坐标）', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'candidate', filterRef: 意向ID,
      快照: 快照({ items: [候选行({ caseId: 'mc_9' })] }),
    });
    const 页 = render(列表元素('candidate', 意向ID));
    await user.click(screen.getByText('AI 产品实习生'));
    expect(mock跳转).toHaveBeenCalledWith(路径.在谈详情('mc_9'));
    页.unmount();

    置P5状态({
      role: 'recruiter', filterRef: 职位ID,
      快照: 快照({ items: [招聘行({ caseId: 'mc_9' })] }),
    });
    render(列表元素('recruiter', 职位ID));
    await user.click(screen.getByText(别名));
    expect(mock跳转).toHaveBeenCalledWith(路径.候选详情('mc_9'));
  });

  it('招聘端别名原样展示，头像是与别名无关的通用匿名头像；同别名两行靠 case_id 区分', () => {
    const 键警告 = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      置P5状态({
        role: 'recruiter', filterRef: 职位ID,
        快照: 快照({ items: [招聘行({ caseId: 'mc_1', 别名 }), 招聘行({ caseId: 'mc_2', 别名 })] }),
      });
      const 宿主 = render(列表元素('recruiter', 职位ID));
      // 别名逐字原样（不截断、不派生）
      expect(screen.getAllByText(别名).length).toBe(2);
      // 通用头像：svg 与别名零关联（无派生首字/散列），两行同一副
      const 头像们 = 宿主.container.querySelectorAll('svg[aria-hidden="true"]');
      expect(头像们.length).toBe(2);
      头像们.forEach((头像) => expect(头像.textContent).toBe(''));
      expect(头像们[0]!.outerHTML).toBe(头像们[1]!.outerHTML);
      // React 键不是别名：同别名两行并存且无重复键告警
      expect(键警告.mock.calls.some((参) => String(参[0]).includes('key'))).toBe(false);
    } finally {
      键警告.mockRestore();
    }
  });

  it('未知契约行 fail closed：契约错误卡 + 重试，不渲染该行的部分数据', async () => {
    const user = userEvent.setup();
    置P5状态({
      role: 'candidate', filterRef: 意向ID,
      快照: 快照({ items: [契约外行('mc_bad')] }),
    });
    render(列表元素('candidate', 意向ID));
    expect(screen.getByText(P5契约错误提示)).toBeTruthy();
    expect(screen.queryByText('AI 产品实习生')).toBeNull(); // 不渲染冻结职位等部分数据
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock刷新工作区).toHaveBeenCalledWith('candidate', 意向ID);
  });
});

// ── 两屏 Backend 分支：scope 坐标选择 + 横幅不声称全量 + Mock 零 P5 ──────────────

/** 求职端 Backend 屏状态：意向表里的 编号 就是 intention_id（水合映射落的）。 */
function 置求职屏状态(选项: {
  范围?: '当前' | '全部';
  看什么?: '全部' | '待我拍板' | '进行中';
  filterRef?: string | null;
  快照?: P5列表快照;
  /** 首帧用：不预置任何 P5 工作区快照（快照 undefined = 还没读回来） */
  不预置快照?: boolean;
  意向表编号?: string[];
  当前意向?: string;
}) {
  const 意向表 = (选项.意向表编号 ?? [意向ID]).map((编号, 序) => ({
    编号, 标题: `意向${序}`, 说明: '',
  }));
  mock应用状态 = {
    数据源模式: 'backend',
    派发: mock派发,
    状态: {
      在谈看什么: 选项.看什么 ?? '全部',
      在谈范围: 选项.范围 ?? '当前',
      求职意向表: 意向表,
      当前意向: 选项.当前意向 ?? '意向0',
      子视图: '在谈',
      在谈列表: [],
    },
    后端状态: {
      P5工作区: 选项.不预置快照 === true ? {} : {
        [P5范围键.open('candidate', 选项.filterRef === undefined ? 意向ID : 选项.filterRef)]:
          选项.快照 ?? 快照({ items: [候选行({ caseId: 'mc_1' })] }),
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
  });

  it('求职端：当前档按意向表内的 intention_id 过滤，全部档不带过滤', () => {
    置求职屏状态({ filterRef: 意向ID });
    const { rerender } = render(<在谈首页 />);
    expect(mock加载工作区).toHaveBeenCalledWith('candidate', 意向ID);
    expect(screen.getByText('需要你')).toBeTruthy(); // P5 卡在 Backend 分支渲染
    置求职屏状态({ 范围: '全部', filterRef: null });
    rerender(<在谈首页 />);
    expect(mock加载工作区).toHaveBeenLastCalledWith('candidate', null);
  });

  it('求职端：当前意向不在意向表内（镜像 Mock 护栏）→ 空态且零 P5 请求', () => {
    置求职屏状态({
      filterRef: 意向ID, // 表里有意向、但 当前意向 已不在表内
      当前意向: '已被删掉的意向',
    });
    render(<在谈首页 />);
    expect(screen.getByText('这个意向下暂时没有在谈职位。')).toBeTruthy();
    // 护栏空态刻意零请求、没有未读数据 —— 横幅定论与 Mock 同口径
    expect(screen.getByText('暂时没有需要你介入的')).toBeTruthy();
    expect(mock设置P5范围).not.toHaveBeenCalled();
    expect(mock加载工作区).not.toHaveBeenCalled();
  });

  it('求职端：状态档经全局状态传进 P5 列表（待我拍板只留 needs_action）', () => {
    置求职屏状态({
      filterRef: 意向ID, 看什么: '待我拍板',
      快照: 快照({ items: [候选行({ caseId: 'mc_a', 待办: true }), 候选行({ caseId: 'mc_b', 待办: false })] }),
    });
    render(<在谈首页 />);
    expect(screen.getByText('需要你')).toBeTruthy();
    expect(screen.queryByText('代理处理中')).toBeNull();
  });

  it('求职端：游标未尽时横幅不声称全量总数，读尽后才给数字', () => {
    置求职屏状态({
      filterRef: 意向ID,
      快照: 快照({ items: [候选行({ caseId: 'mc_1', 待办: true })], nextCursor: 'b2x' }),
    });
    const { rerender } = render(<在谈首页 />);
    expect(screen.getByText('有职位需要你协调')).toBeTruthy();
    expect(screen.queryByText('1 个职位需要你协调')).toBeNull();
    置求职屏状态({
      filterRef: 意向ID,
      快照: 快照({ items: [候选行({ caseId: 'mc_1', 待办: true })], nextCursor: null }),
    });
    rerender(<在谈首页 />);
    expect(screen.getByText('1 个职位需要你协调')).toBeTruthy();
  });

  it('求职端横幅零待办分支：首帧/在飞/失败/游标未尽都不下「暂时没有」的定论，成功读尽后才定论', () => {
    // (a) 首帧（scope 已注册、快照还没读回来）：只说正在读入，绝不出现定论文案
    置求职屏状态({ filterRef: 意向ID, 不预置快照: true });
    const { rerender } = render(<在谈首页 />);
    expect(mock加载工作区).toHaveBeenCalledWith('candidate', 意向ID);
    expect(screen.getByText('正在读入在谈职位…')).toBeTruthy();
    expect(screen.queryByText('暂时没有需要你介入的')).toBeNull();
    // (a2) 首次读取在飞：起步构造把 nextCursor 兜底成 null —— 只看游标会误读成读尽
    置求职屏状态({
      filterRef: 意向ID,
      快照: 快照({ 阶段: '进行中', items: [], nextCursor: null, 刷新中: true }),
    });
    rerender(<在谈首页 />);
    expect(screen.getByText('正在读入在谈职位…')).toBeTruthy();
    expect(screen.queryByText('暂时没有需要你介入的')).toBeNull();
    expect(screen.queryByText(/^[\d]+ 个职位需要你协调$/)).toBeNull();
    // (b2) 首载失败：nextCursor 同样是 null —— 错误卡在场，横幅只给非定论兜底、不给计数
    置求职屏状态({
      filterRef: 意向ID,
      快照: 快照({ 阶段: '失败', items: [], nextCursor: null, error: '服务暂时不可用，请稍后再试' }),
    });
    rerender(<在谈首页 />);
    expect(screen.getByText('已读入的里暂时没有需要你介入的')).toBeTruthy();
    expect(screen.queryByText('暂时没有需要你介入的')).toBeNull();
    expect(screen.getByText('在谈暂时加载不了')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
    // (b) 成功但游标未尽 + 已载零待办：只给非定论兜底
    置求职屏状态({
      filterRef: 意向ID,
      快照: 快照({ items: [候选行({ caseId: 'mc_1', 待办: false })], nextCursor: 'b2x' }),
    });
    rerender(<在谈首页 />);
    expect(screen.getByText('已读入的里暂时没有需要你介入的')).toBeTruthy();
    expect(screen.queryByText('暂时没有需要你介入的')).toBeNull();
    // (c) 成功读尽 + 零待办：才下「暂时没有」的定论
    置求职屏状态({
      filterRef: 意向ID,
      快照: 快照({ items: [候选行({ caseId: 'mc_1', 待办: false })], nextCursor: null }),
    });
    rerender(<在谈首页 />);
    expect(screen.getByText('暂时没有需要你介入的')).toBeTruthy();
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

  it('求职端筛选层待办数只在成功读尽后给数', async () => {
    const user = userEvent.setup();
    置求职屏状态({
      filterRef: 意向ID,
      快照: 快照({ items: [候选行({ caseId: 'mc_1', 待办: true })], nextCursor: null }),
    });
    render(<在谈首页 />);
    await user.click(screen.getByRole('button', { name: '筛选 ▾' }));
    // 待我拍板 档右侧的数字：成功 + 读尽（1 条待办）才出现
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('招聘端：当前档按在招 job_id 过滤，全部档不带过滤；归档岗绝不拿来当 scope', () => {
    置招聘屏状态({ filterRef: 职位ID });
    const { rerender } = render(<企业在谈候选 />);
    expect(mock加载工作区).toHaveBeenCalledWith('recruiter', 职位ID);
    expect(screen.getByText(别名)).toBeTruthy();
    置招聘屏状态({ 范围: '全部', filterRef: null });
    rerender(<企业在谈候选 />);
    expect(mock加载工作区).toHaveBeenLastCalledWith('recruiter', null);
    cleanup();

    // 当前岗位已归档：同 候选推荐 的 P4 口径 —— 空态 + 零 P5 请求
    mock加载工作区.mockClear();
    mock设置P5范围.mockClear();
    置招聘屏状态({ filterRef: 职位ID, 岗位状态: '已归档' });
    render(<企业在谈候选 />);
    expect(screen.getByText('还没有在招的岗位')).toBeTruthy();
    // 护栏空态刻意零请求、没有未读数据 —— 横幅定论与 Mock 同口径
    expect(screen.getByText('暂时没有需要你拍板的')).toBeTruthy();
    expect(mock设置P5范围).not.toHaveBeenCalled();
    expect(mock加载工作区).not.toHaveBeenCalled();
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
    // Mock 体原样渲染（等 450ms 模拟加载过去）
    expect(await screen.findByText('资深后端工程师 · 交易网关')).toBeTruthy();
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
    // A-01 的 S1 已递交原件：真名非空显示真名（沈亦舟），与 Mock 行为一致
    expect(await screen.findByText('沈亦舟')).toBeTruthy();

    expect(mock设置P5范围).not.toHaveBeenCalled();
    expect(mock加载工作区).not.toHaveBeenCalled();
    expect(mock追加工作区).not.toHaveBeenCalled();
    expect(mock刷新工作区).not.toHaveBeenCalled();
  });
});
