// P4 Task 7：企业端推荐流接上发现推荐（Backend）。
// 列表只来自当前岗位（job_id 载体）的招聘可用候选快照：先注册后懒加载、离开即清、
// 下拉只 GET 重读、「让代理再找一批」才 POST+GET 且旧卡保留；反馈（收藏/淘汰）
// 服务端先行、失败原地保留；委托无确认层、原地停留、进行中回执交给轮询钩子；
// Backend 绝不派发 接触推荐候选，Mock 分支行为与请求面保持原样。
// 测试宿主：mock 应用状态 / 导航钩子（同 看市场.test.tsx 惯例）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 候选推荐 from './候选推荐';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF招聘候选推荐, BFF委托摘要 } from '../数据/BFF契约';
import { BFF招聘候选推荐样本, BFF岗位样本, 页面岗位样本 } from '../测试/BFF样本';
import { 推荐列表 } from '../数据/企业端模拟数据';

// jsdom 不实现 scrollIntoView / scrollTo：详情页挂载自动定位、会话页滚到底都会调用
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}
if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = () => {};
}

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
const mock设置发现推荐范围 = vi.fn();
const mock加载招聘候选 = vi.fn(async () => undefined);
const mock刷新招聘候选 = vi.fn(async () => undefined);
const mock设置候选收藏 = vi.fn(async () => undefined);
const mock淘汰候选 = vi.fn(async () => undefined);
const mock委托招聘候选 = vi.fn(async () => undefined);
const mock刷新委托 = vi.fn(async () => undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  use应用状态: () => mock应用状态,
}));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }) }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

const 岗位编号 = BFF岗位样本.job_id;

/** 便捷卡：换 ID/别名/收藏/委托的招聘候选卡 */
function 换卡(选项: {
  推荐ID: string; 别名: string; 收藏?: boolean;
  委托?: BFF委托摘要 | null; 原因?: BFF招聘候选推荐['rejection_reason'];
}): BFF招聘候选推荐 {
  return {
    ...BFF招聘候选推荐样本,
    recommendation_id: 选项.推荐ID,
    candidate_alias: 选项.别名,
    favorite: 选项.收藏 ?? false,
    rejection_reason: 选项.原因 ?? null,
    delegation: 选项.委托 ?? null,
  };
}

/** P4 scope 快照构造器（阶段/error/刷新中 按用例给） */
const P4快照 = (选项: {
  阶段: string; items?: BFF招聘候选推荐[]; error?: string | null; 刷新中?: boolean;
}) => ({
  阶段: 选项.阶段,
  刷新中: 选项.刷新中 ?? false,
  items: 选项.items ?? [],
  error: 选项.error ?? null,
  generation: 1,
});

/** P4 招聘状态底座：当前岗位编号/岗位列表[].编号 都是 BFF job_id（生产水合口径） */
function 置P4状态(选项: {
  快照?: ReturnType<typeof P4快照>;
  岗位编号?: string;
  操作?: Record<string, unknown>;
}) {
  const 编号 = 选项.岗位编号 ?? 岗位编号;
  mock应用状态 = {
    数据源模式: 'backend', 派发: mock派发,
    状态: {
      当前岗位编号: 编号,
      岗位列表: [{ ...页面岗位样本, 编号, 状态: '在招' }],
      企业规则: [], 企业子视图: '推荐', 推荐列表: [], 收藏候选: [],
      不合适候选: {}, 已接触推荐: [],
    },
    后端状态: {
      Agent规则水合: { candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '成功', proposals: '成功' } },
      招聘可用候选: { [编号]: 选项.快照 ?? P4快照({ 阶段: '成功', items: [BFF招聘候选推荐样本] }) },
      P4委托回执: {},
    },
    操作: 选项.操作 ?? {},
  };
}

/** Mock 模式底座：与接线前一致的原型字段 */
function 置Mock状态() {
  mock应用状态 = {
    数据源模式: 'mock', 派发: mock派发,
    状态: {
      当前岗位编号: 'P-01',
      岗位列表: [{ 编号: 'P-01', 名称: 'AI 产品实习生 · 上海', 状态: '在招', 薪资带: '20-35K' }],
      企业规则: [], 企业子视图: '推荐',
      推荐列表: 推荐列表.filter((人) => 人.岗位编号 === 'P-01'),
      收藏候选: [], 不合适候选: {}, 已接触推荐: [],
    },
    后端状态: {
      Agent规则水合: { candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' } },
    },
  };
}

/** 左滑第一张候选卡露出「不合适」 */
async function 左滑露不合适() {
  const 行面 = document.querySelector('[role="button"][aria-expanded="false"]')!;
  fireEvent.pointerDown(行面, { clientX: 300, clientY: 10 });
  fireEvent.pointerMove(行面, { clientX: 200, clientY: 10 });
  fireEvent.pointerUp(行面, { clientX: 200, clientY: 10 });
  await waitFor(() => expect(screen.getByRole('button', { name: '不合适' })).toBeTruthy());
}

describe('候选推荐 · P4 招聘发现（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock轻提示.mockClear();
    mock设置发现推荐范围.mockClear();
    mock加载招聘候选.mockClear();
    mock刷新招聘候选.mockClear();
    mock设置候选收藏.mockClear();
    mock淘汰候选.mockClear();
    mock委托招聘候选.mockClear();
    mock刷新委托.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('进屏按当前岗位注册可见范围并懒加载（先注册后加载，离开即清）', () => {
    置P4状态({
      快照: P4快照({ 阶段: '未开始' }),
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 加载招聘候选: mock加载招聘候选 },
    });
    const 页 = render(<候选推荐 />);
    expect(mock设置发现推荐范围).toHaveBeenCalledWith('recruiter', `recruiter:list:${岗位编号}`);
    expect(mock加载招聘候选).toHaveBeenCalledWith(岗位编号);
    expect(mock设置发现推荐范围.mock.invocationCallOrder[0]).toBeLessThan(
      mock加载招聘候选.mock.invocationCallOrder[0]);
    页.unmount();
    expect(mock设置发现推荐范围).toHaveBeenCalledWith('recruiter', null);
  });

  it('切岗位即换 scope：旧范围先清、新范围后注册，旧数据不闪进新列表', () => {
    置P4状态({
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 加载招聘候选: mock加载招聘候选 },
    });
    const { rerender } = render(<候选推荐 />);
    expect(screen.getByText('候选人甲')).toBeTruthy();
    置P4状态({
      岗位编号: 'job_2',
      快照: P4快照({ 阶段: '成功', items: [换卡({ 推荐ID: 'rec_r2', 别名: '候选人乙' })] }),
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 加载招聘候选: mock加载招聘候选 },
    });
    rerender(<候选推荐 />);
    expect(screen.queryByText('候选人甲')).toBeNull();
    expect(screen.getByText('候选人乙')).toBeTruthy();
    expect(mock设置发现推荐范围.mock.calls).toEqual([
      ['recruiter', `recruiter:list:${岗位编号}`],
      ['recruiter', null],
      ['recruiter', 'recruiter:list:job_2'],
    ]);
    expect(mock加载招聘候选).toHaveBeenLastCalledWith('job_2');
  });

  it('下拉刷新只重读当前 scope（GET），不建新批次', () => {
    置P4状态({
      操作: { 加载招聘候选: mock加载招聘候选, 刷新招聘候选: mock刷新招聘候选 },
    });
    render(<候选推荐 />);
    const root = document.querySelector('.滚动区')!.parentElement!;
    fireEvent.pointerDown(root, { clientY: 0 });
    fireEvent.pointerMove(root, { clientY: 120 });
    fireEvent.pointerUp(root, { clientY: 120 });
    expect(mock加载招聘候选).toHaveBeenCalledWith(岗位编号, true);
    expect(mock刷新招聘候选).not.toHaveBeenCalled();
  });

  it('「让代理再找一批」建新批次（POST+GET），失败按 P4 文案提示', async () => {
    const user = userEvent.setup();
    置P4状态({
      操作: { 加载招聘候选: mock加载招聘候选, 刷新招聘候选: mock刷新招聘候选 },
    });
    render(<候选推荐 />);
    await user.click(screen.getByRole('button', { name: '让代理再找一批' }));
    expect(mock刷新招聘候选).toHaveBeenCalledWith(岗位编号);
    expect(mock加载招聘候选).toHaveBeenCalledTimes(1); // 进屏懒加载那一次，之后不再 GET

    mock刷新招聘候选.mockRejectedValueOnce(
      new BFF错误(503, 'source_unavailable', '服务暂时不可用'));
    await user.click(screen.getByRole('button', { name: '让代理再找一批' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('服务暂时不可用，请稍后再试'));
  });

  it('刷新未决保留旧卡并单独交代错误', () => {
    置P4状态({
      快照: P4快照({
        阶段: '成功', items: [BFF招聘候选推荐样本], error: '已发起新一轮，结果暂未刷新',
      }),
    });
    render(<候选推荐 />);
    expect(screen.getByText('候选人甲')).toBeTruthy();
    expect(screen.getByText('已发起新一轮，结果暂未刷新')).toBeTruthy();
  });

  it('首载失败给错误与重试（重试走 force GET）', async () => {
    const user = userEvent.setup();
    置P4状态({
      快照: P4快照({ 阶段: '失败', error: '服务暂时不可用，请稍后再试' }),
      操作: { 加载招聘候选: mock加载招聘候选 },
    });
    render(<候选推荐 />);
    expect(screen.getByText('推荐暂时加载不了')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock加载招聘候选).toHaveBeenCalledWith(岗位编号, true);
  });

  it('淘汰四原因可回看可撤销；年限不足映射 experience_insufficient', async () => {
    const user = userEvent.setup();
    置P4状态({
      操作: { 淘汰候选: mock淘汰候选, 设置候选收藏: mock设置候选收藏 },
    });
    render(<候选推荐 />);
    await 左滑露不合适();
    await user.click(screen.getByRole('button', { name: '不合适' }));
    expect(screen.getByText('年限不足')).toBeTruthy();
    expect(screen.getByText('方向不符')).toBeTruthy();
    expect(screen.getByText('主栈不符')).toBeTruthy();
    expect(screen.getByText('其他')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /年限不足/ }));
    await waitFor(() =>
      expect(mock淘汰候选).toHaveBeenCalledWith(岗位编号, 'rec_r1', 'experience_insufficient'));
  });

  it('方向不符/主栈不符/其他 逐一映射 BFF 码', async () => {
    const user = userEvent.setup();
    置P4状态({
      操作: { 淘汰候选: mock淘汰候选 },
    });
    const 页 = render(<候选推荐 />);
    const 对照: [string, string][] = [
      ['方向不符', 'direction_mismatch'],
      ['主栈不符', 'primary_stack_mismatch'],
      ['其他', 'other'],
    ];
    for (const [原因, 码] of 对照) {
      await 左滑露不合适();
      await user.click(screen.getByRole('button', { name: '不合适' }));
      await user.click(screen.getByRole('button', { name: new RegExp(原因) }));
      await waitFor(() => expect(mock淘汰候选).toHaveBeenLastCalledWith(岗位编号, 'rec_r1', 码));
    }
    页.unmount();
  });

  it('淘汰失败卡片原地保留并提示 P4 文案', async () => {
    const user = userEvent.setup();
    mock淘汰候选.mockRejectedValueOnce(new BFF错误(404, 'recommendation_not_found', 'x'));
    置P4状态({
      操作: { 淘汰候选: mock淘汰候选 },
    });
    render(<候选推荐 />);
    await 左滑露不合适();
    await user.click(screen.getByRole('button', { name: '不合适' }));
    await user.click(screen.getByRole('button', { name: /年限不足/ }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('这条推荐当前已不可用，请刷新后查看'));
    expect(screen.getByText('候选人甲')).toBeTruthy();
  });

  it('收藏服务端先行：列表点击即写服务端，权威快照回改后两处一致', async () => {
    const user = userEvent.setup();
    置P4状态({
      操作: { 设置候选收藏: mock设置候选收藏 },
    });
    const { rerender } = render(<候选推荐 />);
    await user.click(screen.getByRole('button', { name: '收藏' }));
    expect(mock设置候选收藏).toHaveBeenCalledWith(岗位编号, 'rec_r1', true);
    // 操作层 PUT 成功回改快照（favorite: true）后的权威重渲染：卡片出现实心 ★
    置P4状态({
      快照: P4快照({ 阶段: '成功', items: [换卡({ 推荐ID: 'rec_r1', 别名: '候选人甲', 收藏: true })] }),
      操作: { 设置候选收藏: mock设置候选收藏 },
    });
    rerender(<候选推荐 />);
    expect(screen.getByRole('button', { name: '取消收藏' })).toBeTruthy();
  });

  it('委托无确认层：点击立即调用，留在本页且不派发 Mock 接触', async () => {
    const user = userEvent.setup();
    置P4状态({
      操作: { 委托招聘候选: mock委托招聘候选 },
    });
    render(<候选推荐 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去聊' }));
    await waitFor(() => expect(mock委托招聘候选).toHaveBeenCalledWith(岗位编号, 'rec_r1'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '接触推荐候选' }));
  });

  it('终态/拒绝回执给闭合文案，卡片不伪造在谈', async () => {
    const user = userEvent.setup();
    mock委托招聘候选.mockRejectedValueOnce(
      new BFF错误(200, 'refused', '这次委托未被接受，请稍后重试'));
    置P4状态({
      操作: { 委托招聘候选: mock委托招聘候选 },
    });
    render(<候选推荐 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去聊' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('这次委托未被接受，请稍后重试'));
    expect(screen.getByRole('button', { name: '让AI代理去聊' })).toBeTruthy();
  });

  it('accepted/evaluating 显示「AI代理已接触」，去聊键不在', () => {
    置P4状态({
      快照: P4快照({
        阶段: '成功',
        items: [换卡({
          推荐ID: 'rec_r1', 别名: '候选人甲',
          委托: { delegation_id: 'del_r1', state: 'evaluating', case_id: null },
        })],
      }),
    });
    render(<候选推荐 />);
    expect(screen.getByText('AI代理已接触')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '让AI代理去聊' })).toBeNull();
  });

  it('case_started 已开案不再轮询，只显示状态标', async () => {
    vi.useFakeTimers();
    置P4状态({
      快照: P4快照({
        阶段: '成功',
        items: [换卡({
          推荐ID: 'rec_r1', 别名: '候选人甲',
          委托: { delegation_id: 'del_9', state: 'case_started', case_id: 'case_1' },
        })],
      }),
      操作: { 刷新委托: mock刷新委托 },
    });
    render(<候选推荐 />);
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(mock刷新委托).not.toHaveBeenCalled();
  });

  it('页面挂载时对进行中委托按节拍刷新回执', async () => {
    vi.useFakeTimers();
    置P4状态({
      快照: P4快照({
        阶段: '成功',
        items: [换卡({
          推荐ID: 'rec_r1', 别名: '候选人甲',
          委托: { delegation_id: 'del_r1', state: 'accepted', case_id: null },
        })],
      }),
      操作: { 刷新委托: mock刷新委托 },
    });
    render(<候选推荐 />);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(mock刷新委托).toHaveBeenCalledWith('recruiter', 'del_r1');
  });

  it('轮询五连败后进行中标被中性文案覆盖', async () => {
    vi.useFakeTimers();
    mock刷新委托.mockRejectedValue(new BFF错误(503, 'source_unavailable', 'x'));
    置P4状态({
      快照: P4快照({
        阶段: '成功',
        items: [换卡({
          推荐ID: 'rec_r1', 别名: '候选人甲',
          委托: { delegation_id: 'del_r1', state: 'accepted', case_id: null },
        })],
      }),
      操作: { 刷新委托: mock刷新委托 },
    });
    render(<候选推荐 />);
    expect(screen.getByText('AI代理已接触')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(screen.getByText('暂时无法确认进度，请稍后刷新')).toBeTruthy();
    expect(screen.queryByText('AI代理已接触')).toBeNull();
  });

  it('Mock 分支行为原样且零 P4 请求', async () => {
    const user = userEvent.setup();
    置Mock状态();
    render(<候选推荐 />);
    expect(screen.getByText('江叙白')).toBeTruthy();
    expect(mock设置发现推荐范围).not.toHaveBeenCalled();
    expect(mock加载招聘候选).not.toHaveBeenCalled();
    const 去聊键 = screen.getAllByRole('button', { name: '让AI代理去聊' });
    await user.click(去聊键[0]!);
    expect(mock派发).toHaveBeenCalledWith({ 型: '接触推荐候选', 编号: 'R-11' });
    expect(mock委托招聘候选).not.toHaveBeenCalled();
    // Mock 抽屉没有「只看收藏」开关
    await user.click(screen.getByRole('button', { name: /筛选.*▾/ }));
    expect(screen.queryByRole('switch', { name: '只看收藏' })).toBeNull();
  });
});
