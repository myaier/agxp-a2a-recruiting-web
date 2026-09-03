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
import type { BFFOwnerJob, BFF招聘候选推荐, BFF委托摘要, BFF委托回执 } from '../数据/BFF契约';
import { BFF招聘候选推荐样本, BFF岗位样本, 页面岗位样本 } from '../测试/BFF样本';
import { 发现推荐操作桩 } from '../测试/操作桩';
import { 路径 } from '../路由/路径表';
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

/** deferred promise：测试可控制异步 resolve/reject 的时机（模拟未决的刷新请求） */
function deferred<T>() {
  let resolve!: (值: T) => void;
  let reject!: (错误: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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
  /** 岗位列表：默认「当前岗位在招」；零在招 / 归档当前岗的用例自己给 */
  岗位列表?: Record<string, unknown>[];
  /** 权威 owner Job（后端状态.岗位快照）：默认已验证 + 带 ref；null = 快照还没水合 */
  ownerJob?: BFFOwnerJob | null;
  /** P4 委托回执表（terminal 补读用例给）；缺省空表 = 回执缺位 */
  委托回执?: Record<string, BFF委托回执>;
  操作?: Record<string, unknown>;
}) {
  const 编号 = 选项.岗位编号 ?? 岗位编号;
  const ownerJob = 选项.ownerJob === undefined
    ? {
        ...BFF岗位样本,
        job_id: 编号,
        hiring_organization_verification_status: 'verified' as const,
        hiring_organization_ref: 'org_1',
      }
    : 选项.ownerJob;
  mock应用状态 = {
    数据源模式: 'backend', 派发: mock派发,
    状态: {
      当前岗位编号: 编号,
      岗位列表: 选项.岗位列表 ?? [{ ...页面岗位样本, 编号, 状态: '在招' }],
      企业规则: [], 企业子视图: '推荐', 推荐列表: [], 收藏候选: [],
      不合适候选: {}, 已接触推荐: [],
    },
    后端状态: {
      Agent规则水合: { candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '成功', proposals: '成功' } },
      // 与生产同口径：岗位的 owner 投影按 job_id 存；水合未完成时键缺席
      岗位快照: ownerJob === null ? {} : { [编号]: ownerJob },
      招聘可用候选: { [编号]: 选项.快照 ?? P4快照({ 阶段: '成功', items: [BFF招聘候选推荐样本] }) },
      P4委托回执: 选项.委托回执 ?? {},
    },
    // 生产 Provider 恒注入全表：桩宿主同样给全表，用例只覆盖自己要断言的 spy
    操作: 发现推荐操作桩(选项.操作),
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
  const 行面 = document.querySelector('[aria-expanded="false"]')!;
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

  // Task 6 的异步接缝必须真的接上：下拉把 GET 的 Promise 交回 下拉刷新，
  // 转圈等真实 settle，而不是恒定 900ms 就收
  it('下拉转圈等真实 GET settle：过了最短动画仍在转，GET 回来才收', async () => {
    vi.useFakeTimers();
    置P4状态({ 操作: { 加载招聘候选: mock加载招聘候选 } });
    render(<候选推荐 />);
    // 进屏懒加载那一发先走完，下拉这一发才是被卡住的那个 GET
    let 放行!: () => void;
    mock加载招聘候选.mockImplementationOnce(
      () => new Promise<undefined>((resolve) => {
        放行 = () => resolve(undefined);
      }),
    );
    const root = document.querySelector('.滚动区')!.parentElement!;
    fireEvent.pointerDown(root, { clientY: 0 });
    fireEvent.pointerMove(root, { clientY: 120 });
    fireEvent.pointerUp(root, { clientY: 120 });
    expect(mock加载招聘候选).toHaveBeenLastCalledWith(岗位编号, true);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(document.querySelector('[class*="刷新转"]')).not.toBeNull();
    await act(async () => {
      放行();
    });
    expect(document.querySelector('[class*="刷新转"]')).toBeNull();
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

  it('basis 已确认（控制组）：匹配分与亮点整组照常渲染', () => {
    置P4状态({ 快照: P4快照({ 阶段: '成功', items: [BFF招聘候选推荐样本] }) });
    render(<候选推荐 />);
    expect(screen.getByText('候选人甲')).toBeTruthy();
    expect(screen.getByRole('img', { name: '适配 87 分' })).toBeTruthy();
    expect(screen.getByText('full_stack')).toBeTruthy();
    expect(screen.queryByText('经验与学历尚未核对')).toBeNull();
  });

  it('basis 未确认的招聘卡：匹配分保留，亮点整组收起，改显中性句', () => {
    置P4状态({
      快照: P4快照({
        阶段: '成功',
        items: [{
          ...BFF招聘候选推荐样本,
          structured_requirements_confirmed: false,
          highlights: ['full_stack', 'react_depth'],
        }],
      }),
    });
    render(<候选推荐 />);
    // 后端历史分保留，不因 basis 未确认而隐藏或改写
    expect(screen.getByRole('img', { name: '适配 87 分' })).toBeTruthy();
    expect(screen.getByText('经验与学历尚未核对')).toBeTruthy();
    // 整组收起：亮点一条不留，不做选择性过滤
    expect(screen.queryByText('full_stack')).toBeNull();
    expect(screen.queryByText('react_depth')).toBeNull();
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

  it('收藏写在飞时淘汰按钮禁用：不发请求，也绝不弹撤销成功提示', async () => {
    const user = userEvent.setup();
    // 操作层的按资源单飞会把并发的第二次写直接丢弃并 resolve —— 屏必须先自己挡住，
    // 否则会给一次根本没发生的淘汰弹「已标记…可撤销」
    mock设置候选收藏.mockReturnValueOnce(new Promise<undefined>(() => {}));
    置P4状态({
      操作: { 设置候选收藏: mock设置候选收藏, 淘汰候选: mock淘汰候选 },
    });
    render(<候选推荐 />);
    await user.click(screen.getByRole('button', { name: '收藏' }));
    expect(mock设置候选收藏).toHaveBeenCalledTimes(1);

    await 左滑露不合适();
    const 不合适键 = screen.getByRole('button', { name: '不合适' }) as HTMLButtonElement;
    expect(不合适键.disabled).toBe(true);
    await user.click(不合适键);

    expect(screen.queryByText('年限不足')).toBeNull();
    expect(mock淘汰候选).not.toHaveBeenCalled();
    expect(mock轻提示).not.toHaveBeenCalled();
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
      new BFF错误(200, 'refused', '本次未能继续，请查看页面状态'));
    置P4状态({
      操作: { 委托招聘候选: mock委托招聘候选 },
    });
    render(<候选推荐 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去聊' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('本次未能继续，请查看页面状态'));
    expect(screen.getByRole('button', { name: '让AI代理去聊' })).toBeTruthy();
  });

  // 六个闭合委托状态的权威文案（与 发现推荐映射 的 P4委托状态文案表 逐字一致）
  const 状态文案 = [
    ['accepted', '已提交给 AI，等待处理'],
    ['evaluating', 'AI 正在评估'],
    ['case_started', '已创建真实在谈'],
    ['needs_user', '需要你处理'],
    ['refused', '本次未能继续'],
    ['failed', '本次处理未完成'],
  ] as const;

  it.each(状态文案)('%s 委托按闭合表显示「%s」，去聊键不在', (state, 文案) => {
    置P4状态({
      快照: P4快照({
        阶段: '成功',
        items: [换卡({
          推荐ID: 'rec_r1', 别名: '候选人甲',
          委托: { delegation_id: `del_${state}`, state, case_id: null },
        })],
      }),
    });
    render(<候选推荐 />);
    expect(screen.getByText(文案)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '让AI代理去聊' })).toBeNull();
    // 已退役的自创文案绝不在 Backend 卡上复活
    expect(screen.queryByText('AI代理已接手')).toBeNull();
    expect(screen.queryByText('已开始沟通')).toBeNull();
  });

  it('recruiter case_started navigates only by server case_id', async () => {
    置P4状态({
      快照: P4快照({
        阶段: '成功',
        items: [{
          ...BFF招聘候选推荐样本,
          delegation: { delegation_id: 'del_r1', state: 'case_started', case_id: 'case_server_r1' },
        }],
      }),
    });
    render(<候选推荐 />);
    await userEvent.click(screen.getByRole('button', { name: '查看进展' }));
    expect(mock跳转).toHaveBeenCalledTimes(1);
    expect(mock跳转).toHaveBeenCalledWith(路径.候选详情('case_server_r1'));
  });

  it('case_started 无服务端 case_id 时只给禁用状态标，绝不拿 job/recommendation/delegation ID 或别名充当 Case', () => {
    置P4状态({
      快照: P4快照({
        阶段: '成功',
        items: [换卡({
          推荐ID: 'rec_r1', 别名: '候选人甲',
          委托: { delegation_id: 'del_r2', state: 'case_started', case_id: null },
        })],
      }),
    });
    render(<候选推荐 />);
    expect(screen.getByText('已创建真实在谈')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '查看进展' })).toBeNull();
    expect(mock跳转).not.toHaveBeenCalled();
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
    expect(screen.getByText('已提交给 AI，等待处理')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(screen.getByText('暂时无法确认进度，请稍后刷新')).toBeTruthy();
    expect(screen.queryByText('已提交给 AI，等待处理')).toBeNull();
    expect(screen.queryByText('AI代理已接手')).toBeNull();
  });

  // ── Hosted Agent 失败合同 Task 3：terminal summary 单次权威补读 ──
  //   重载/跨端恢复时列表摘要可能已 refused/failed 而权威回执表缺这条 delegation ID：
  //   拒绝/失败码只活在 GET 回执里 —— 进屏立即补读一次（无 interval、无 retry），
  //   rerender 不重发；回执表已有同 ID receipt（七键齐全）就一个都不发。
  const failedReceipt: BFF委托回执 = {
    delegation_id: 'del_terminal', recommendation_id: 'rec_1', state: 'failed',
    evaluation_id: null, case_id: null, refusal_code: null,
    failure_code: 'delegation_agent_unavailable',
  };
  const refusedReceipt: BFF委托回执 = {
    delegation_id: 'del_terminal', recommendation_id: 'rec_1', state: 'refused',
    evaluation_id: null, case_id: null, refusal_code: 'delegation_cooldown',
    failure_code: null,
  };

  it('terminal summary 缺 receipt：进屏立即补读一次，rerender 不重发', async () => {
    置P4状态({
      快照: P4快照({
        阶段: '成功',
        items: [换卡({
          推荐ID: 'rec_r1', 别名: '候选人甲',
          委托: { delegation_id: 'del_terminal', state: 'failed', case_id: null },
        })],
      }),
      操作: { 刷新委托: mock刷新委托 },
    });
    const 页 = render(<候选推荐 />);
    await waitFor(() => expect(mock刷新委托).toHaveBeenCalledTimes(1));
    expect(mock刷新委托).toHaveBeenCalledWith('recruiter', 'del_terminal');
    页.rerender(<候选推荐 />);
    await act(async () => {});
    expect(mock刷新委托).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['refused', refusedReceipt],
    ['failed', failedReceipt],
  ] as const)('%s 摘要已有同 ID receipt：零补读', async (state, receipt) => {
    置P4状态({
      快照: P4快照({
        阶段: '成功',
        items: [换卡({
          推荐ID: 'rec_r1', 别名: '候选人甲',
          委托: { delegation_id: 'del_terminal', state, case_id: null },
        })],
      }),
      委托回执: { del_terminal: receipt },
      操作: { 刷新委托: mock刷新委托 },
    });
    render(<候选推荐 />);
    await act(async () => {});
    expect(mock刷新委托).not.toHaveBeenCalled();
  });

  // 招聘 scope 必须是自己名下的在招 job_id：一个在招岗都没有、或当前岗已归档时，
  // 既不该永远转圈，也不该拿归档 job_id 去发 P4 请求
  it('零在招岗位：给空态、不转圈、零 P4 请求', () => {
    置P4状态({
      岗位编号: '',
      岗位列表: [],
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 加载招聘候选: mock加载招聘候选 },
    });
    render(<候选推荐 />);
    expect(screen.getByText('还没有在招的岗位')).toBeTruthy();
    expect(screen.queryByText('正在加载这个岗位的推荐候选…')).toBeNull();
    expect(mock设置发现推荐范围).not.toHaveBeenCalled();
    expect(mock加载招聘候选).not.toHaveBeenCalled();
  });

  it('当前岗位已归档：同样给空态，绝不拿归档 job_id 当 scope', () => {
    置P4状态({
      岗位列表: [{ ...页面岗位样本, 编号: 岗位编号, 状态: '已归档' }],
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 加载招聘候选: mock加载招聘候选 },
    });
    render(<候选推荐 />);
    expect(screen.getByText('还没有在招的岗位')).toBeTruthy();
    // 归档岗的快照哪怕还在后端状态里，也不许渲染出来
    expect(screen.queryByText('候选人甲')).toBeNull();
    expect(mock设置发现推荐范围).not.toHaveBeenCalled();
    expect(mock加载招聘候选).not.toHaveBeenCalled();
  });

  // ── 组织前提三态：P4 发现请求只对「已验证用人组织 + 有 ref」的在招岗位发 ──
  it.each([
    ['unverified', { ...BFF岗位样本, hiring_organization_verification_status: 'unverified' as const }],
    ['missing ref', {
      ...BFF岗位样本,
      hiring_organization_verification_status: 'verified' as const,
      hiring_organization_ref: undefined,
    }],
  ] as const)('%s job shows organization guidance and sends no discovery request', async (
    _name, ownerJob,
  ) => {
    const user = userEvent.setup();
    置P4状态({
      ownerJob,
      操作: {
        设置发现推荐范围: mock设置发现推荐范围,
        加载招聘候选: mock加载招聘候选,
        刷新招聘候选: mock刷新招聘候选,
      },
    });
    render(<候选推荐 />);
    expect(screen.getByText(/匿名候选推荐需要已验证的用人组织/)).toBeTruthy();
    // 零发现请求：注册、加载、刷新一发都不许发
    expect(mock设置发现推荐范围).not.toHaveBeenCalled();
    expect(mock加载招聘候选).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /加入企业/ }));
    expect(mock刷新招聘候选).not.toHaveBeenCalled();
    expect(mock跳转).toHaveBeenCalledWith(路径.企业邀请加入);
  });

  it('missing owner snapshot stays neutral and sends no request', () => {
    置P4状态({
      ownerJob: null,
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 加载招聘候选: mock加载招聘候选 },
    });
    render(<候选推荐 />);
    expect(screen.getByText(/正在加载岗位信息/)).toBeTruthy();
    expect(screen.queryByText(/需要已验证的用人组织/)).toBeNull();
    expect(mock设置发现推荐范围).not.toHaveBeenCalled();
    expect(mock加载招聘候选).not.toHaveBeenCalled();
  });

  it('verified job with ref keeps the exact existing load and refresh requests', async () => {
    const user = userEvent.setup();
    置P4状态({ 操作: { 加载招聘候选: mock加载招聘候选, 刷新招聘候选: mock刷新招聘候选 } });
    render(<候选推荐 />);
    expect(mock加载招聘候选).toHaveBeenCalledWith(岗位编号);
    await user.click(screen.getByRole('button', { name: '让代理再找一批' }));
    expect(mock刷新招聘候选).toHaveBeenCalledWith(岗位编号);
  });

  it('Backend 代理横幅动作只说查看代理功能，Mock 保持 问AI代理 ›', () => {
    // 交付 G：Backend 的入口文案不得承诺自由对话；Mock 原型文案原样保留
    置P4状态({});
    const page = render(<候选推荐 />);
    expect(screen.getByRole('button', { name: /查看代理功能/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /问AI代理/ })).toBeNull();

    置Mock状态();
    page.rerender(<候选推荐 />);
    expect(screen.getByRole('button', { name: /问AI代理/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /查看代理功能/ })).toBeNull();
  });

  // ── Task 6：组织认证竞态对账在屏上的三面 ──
  // 1. 精确组织 409：操作层做一次 Owner Jobs 权威重读并水合受阻事实，屏只认权威水合，
  //    不再用 toast 冒充组织指引；受阻态是既有 inline 持久渲染（去认证 / 加入企业）。
  it('精确组织 409 由权威水合驱动受阻态：不 toast，去认证/加入企业走既有路由', async () => {
    const refresh = deferred<void>();
    置P4状态({ 操作: { 刷新招聘候选: vi.fn(() => refresh.promise) } });
    const page = render(<候选推荐 />);
    await userEvent.click(screen.getByRole('button', { name: '让代理再找一批' }));

    // 操作层的一次权威重读已水合受阻 owner job：后端状态回写后的权威重渲染
    置P4状态({
      ownerJob: { ...BFF岗位样本, job_id: 岗位编号, hiring_organization_verification_status: 'unverified' },
      操作: { 刷新招聘候选: vi.fn(() => refresh.promise) },
    });
    page.rerender(<候选推荐 />);
    refresh.reject(new BFF错误(409, 'organization_verification_required',
      'A verified organization is required to discover candidates.'));
    await act(async () => { await refresh.promise.catch(() => undefined); });

    // 精确组织错误不 toast；受阻 inline 态持续在场
    expect(mock轻提示).not.toHaveBeenCalled();
    expect(screen.getByText(/匿名候选推荐需要已验证的用人组织/)).toBeTruthy();
    expect(screen.getByText('这个岗位还没挂到已验证的用人组织')).toBeTruthy();
    // 刷新动作不再可点：键位换成「加入企业」，让代理再找一批不复存在
    expect(screen.queryByRole('button', { name: '让代理再找一批' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /去认证/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.企业实名认证);
    await userEvent.click(screen.getByRole('button', { name: /加入企业/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.企业邀请加入);
  });

  // 2. 对账后权威岗位仍 ready = 合同漂移：当前岗位落屏幕局部的持久「数据状态异常」块，
  //    禁用本岗刷新；不是组织受阻，绝不出现组织 CTA。
  it('对账后权威岗位仍 ready：当前岗位落本地持久「数据状态异常」块并禁用刷新', async () => {
    const user = userEvent.setup();
    mock刷新招聘候选.mockRejectedValueOnce(
      new BFF错误(409, 'invalid_response', '数据状态异常，请稍后再试'));
    置P4状态({ 操作: { 刷新招聘候选: mock刷新招聘候选 } });
    render(<候选推荐 />);
    await user.click(screen.getByRole('button', { name: '让代理再找一批' }));

    await waitFor(() => expect(screen.getByText('数据状态异常，请稍后再试')).toBeTruthy());
    const 再找键 = screen.getByRole('button', { name: '让代理再找一批' }) as HTMLButtonElement;
    expect(再找键.disabled).toBe(true);
    expect(mock轻提示).not.toHaveBeenCalled(); // 持久 inline 块，不弹一次性 toast
    expect(screen.queryByText(/先完成企业实名认证/)).toBeNull(); // 绝不冒充组织受阻
  });

  // 3. 合同块按 job 隔离、屏幕局部：切岗或重挂即清，绝不阻断另一个岗位
  it('本地合同块按岗位隔离：切岗或重挂即清，绝不阻断另一个岗位', async () => {
    const user = userEvent.setup();
    mock刷新招聘候选.mockRejectedValueOnce(
      new BFF错误(409, 'invalid_response', '数据状态异常，请稍后再试'));
    置P4状态({ 操作: { 刷新招聘候选: mock刷新招聘候选 } });
    const { rerender, unmount } = render(<候选推荐 />);
    await user.click(screen.getByRole('button', { name: '让代理再找一批' }));
    await waitFor(() => expect(screen.getByText('数据状态异常，请稍后再试')).toBeTruthy());

    // 切到另一个岗位：合同块不跟过去，新岗位刷新照常可用
    置P4状态({ 岗位编号: 'job_2', 操作: { 刷新招聘候选: mock刷新招聘候选 } });
    rerender(<候选推荐 />);
    expect(screen.queryByText('数据状态异常，请稍后再试')).toBeNull();
    const 新键 = screen.getByRole('button', { name: '让代理再找一批' }) as HTMLButtonElement;
    expect(新键.disabled).toBe(false);

    // 重挂本屏：块也不复活（屏幕局部状态，绝不外存）
    unmount();
    置P4状态({ 操作: { 刷新招聘候选: mock刷新招聘候选 } });
    render(<候选推荐 />);
    expect(screen.queryByText('数据状态异常，请稍后再试')).toBeNull();
  });

  // 4. 401/503/未知码：一律 P4 通用文案，绝不显示组织 CTA
  it.each([
    new BFF错误(503, 'source_unavailable', 'down'),
    new BFF错误(401, 'unauthorized', 'expired'),
    new BFF错误(409, 'unknown_code', 'unknown'),
  ])('does not misclassify %s as organization verification', async (error) => {
    mock刷新招聘候选.mockRejectedValueOnce(error);
    置P4状态({ 操作: { 刷新招聘候选: mock刷新招聘候选 } });
    render(<候选推荐 />);
    await userEvent.click(screen.getByRole('button', { name: '让代理再找一批' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    expect(mock轻提示).not.toHaveBeenCalledWith('匿名候选推荐需要已验证的用人组织');
    expect(screen.queryByText(/先完成企业实名认证/)).toBeNull();
  });

  // 5. malformed（invalid_response）也不冒充组织受阻：无组织 CTA，只落合同块
  it('malformed 合同漂移不显示组织 CTA', async () => {
    const user = userEvent.setup();
    mock刷新招聘候选.mockRejectedValueOnce(
      new BFF错误(409, 'invalid_response', '服务返回了不符合契约的发现推荐数据'));
    置P4状态({ 操作: { 刷新招聘候选: mock刷新招聘候选 } });
    render(<候选推荐 />);
    await user.click(screen.getByRole('button', { name: '让代理再找一批' }));
    await waitFor(() => expect(screen.getByText('数据状态异常，请稍后再试')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /去认证/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '加入企业' })).toBeNull();
  });

  // 6. 旧 recommendation_unavailable 特判已删除：按 P4 闭合文案提示，
  //    即使同一岗位此刻确实受阻，也绝不把这条错译成组织指引
  it('旧 recommendation_unavailable 特判已删：按 P4 闭合文案提示，绝不译成组织指引', async () => {
    const refresh = deferred<void>();
    置P4状态({ 操作: { 刷新招聘候选: vi.fn(() => refresh.promise) } });
    const page = render(<候选推荐 />);
    await userEvent.click(screen.getByRole('button', { name: '让代理再找一批' }));

    置P4状态({
      ownerJob: { ...BFF岗位样本, job_id: 岗位编号, hiring_organization_verification_status: 'unverified' },
      操作: { 刷新招聘候选: vi.fn(() => refresh.promise) },
    });
    page.rerender(<候选推荐 />);
    refresh.reject(new BFF错误(409, 'recommendation_unavailable', 'legacy'));
    await act(async () => { await refresh.promise.catch(() => undefined); });

    expect(mock轻提示).toHaveBeenCalledWith('这条推荐当前已不可用，请刷新后查看');
    expect(mock轻提示).not.toHaveBeenCalledWith('匿名候选推荐需要已验证的用人组织');
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
