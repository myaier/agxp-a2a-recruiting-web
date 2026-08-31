// Task 6：反馈屏双模式行为线测试。
//
// Backend：产品三分类（功能异常 / 体验建议 / 其他）按 UI→线协议精确映射走
// 操作.提交P8反馈（调用方不带幂等键，键归操作层）；提交期间锁分类片、正文与提交键；
// 失败 / 结果未知保留输入与所选分类并给既有错误文案映射的固定中文，绝不进致谢态；
// 成功沿用既有致谢壳，工单号来自回执 ticketId，文案是「我们会尽快核查」——
// 原型时代的「24 小时」承诺在后端模式绝不再出现（后端不发布这个时限）。
// 「举报虚假岗位 / 举报骚扰行为」保留既有分类片 / 输入区 / 提交键视觉，但提交只给
// 「从具体岗位、谈判或真人会话发起」的入口指引，既不调反馈也无可调的举报操作。
// Mock：字节级行为不变 —— 本地成功、固定原型工单号、既有分类文案，零 P8 操作。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 反馈 from './反馈';
// 走仓库既有的 ?raw 源码合同模式（应用 tsconfig 只挂 vite/client 类型，不用 node:fs）
import 反馈源码 from './反馈.tsx?raw';
import 样式 from './我的功能页.module.css';
import { BFF错误 } from '../数据/HTTP客户端';
import type { P8FeedbackCategory, P8FeedbackReceipt } from '../数据/招聘数据源/P8控制面';

const 导航 = vi.hoisted(() => ({ 返回: vi.fn() }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => 导航 }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const 反馈回执: P8FeedbackReceipt = { ticketId: 'TICKET-P8-001', status: 'received' };

/** 反馈屏的操作桩：Task 7 起公开操作面已含 提交P8举报（举报从具体对象入口发起，
 *  本屏绝不调它）—— 桩给全表面，缺方法立即 TypeError，绝不静默 no-op。 */
function 操作桩(覆盖: Record<string, unknown> = {}) {
  return {
    提交P8反馈: vi.fn(async (_分类: P8FeedbackCategory, _正文: string): Promise<P8FeedbackReceipt> => 反馈回执),
    提交P8举报: vi.fn(),
    ...覆盖,
  };
}

/** 组装 mock应用状态、挂载本屏并返回操作桩（断言用）。 */
function 挂载(模式: 'mock' | 'backend', 覆盖: Record<string, unknown> = {}) {
  const 操作 = 操作桩(覆盖);
  mock应用状态 = { 状态: {}, 派发: vi.fn(), 操作, 数据源模式: 模式, 后端状态: {} };
  return { 视图: render(<MemoryRouter><反馈 /></MemoryRouter>), 操作 };
}

/** 选中分类、输入正文并点提交（走真实 user 事件链）。 */
async function 填写并提交(用户: ReturnType<typeof userEvent.setup>, 分类: string, 正文: string) {
  await 用户.click(screen.getByRole('button', { name: 分类 }));
  await 用户.type(screen.getByRole('textbox'), 正文);
  await 用户.click(screen.getByRole('button', { name: '提交' }));
}

beforeEach(() => {
  导航.返回.mockClear();
});

describe('反馈 · Backend 产品反馈', () => {
  it('三分类按 UI→线协议精确映射：功能异常→bug、体验建议→suggestion、其他→other', async () => {
    const 用户 = userEvent.setup();
    const 映射: Array<[string, P8FeedbackCategory]> = [
      ['功能异常', 'bug'], ['体验建议', 'suggestion'], ['其他', 'other'],
    ];
    for (const [屏分类, 线分类] of 映射) {
      const { 视图, 操作 } = 挂载('backend');
      await 填写并提交(用户, 屏分类, '希望增加状态说明');
      expect(操作.提交P8反馈).toHaveBeenCalledTimes(1);
      expect(操作.提交P8反馈).toHaveBeenCalledWith(线分类, '希望增加状态说明');
      // 致谢壳里的工单号来自服务端回执；「24 小时」承诺绝不出现
      expect(await screen.findByText(/TICKET-P8-001/)).toBeTruthy();
      expect(screen.queryByText(/24 小时/)).toBeNull();
      expect(screen.getByText('我们会尽快核查。每一条反馈都有人读。')).toBeTruthy();
      视图.unmount();
    }
  });

  it('提交期间锁住分类片、正文与提交键，成功回执到达才进致谢态', async () => {
    const 用户 = userEvent.setup();
    let 放行!: (回执: P8FeedbackReceipt) => void;
    const { 视图, 操作 } = 挂载('backend', {
      提交P8反馈: vi.fn((): Promise<P8FeedbackReceipt> => new Promise((完成) => { 放行 = 完成; })),
    });
    await 填写并提交(用户, '体验建议', '希望增加状态说明');
    expect(操作.提交P8反馈).toHaveBeenCalledWith('suggestion', '希望增加状态说明');
    expect((screen.getByRole('button', { name: '提交' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
    for (const 分类 of ['举报虚假岗位', '举报骚扰行为', '功能异常', '体验建议', '其他']) {
      expect((screen.getByRole('button', { name: 分类 }) as HTMLButtonElement).disabled).toBe(true);
    }
    放行(反馈回执);
    expect(await screen.findByText(/TICKET-P8-001/)).toBeTruthy();
    视图.unmount();
  });

  it('失败与结果未知保留输入与所选分类，给既有文案映射的固定中文，不进致谢态', async () => {
    const 用户 = userEvent.setup();
    for (const 错误 of [
      new BFF错误(0, 'network_error', '网络连接失败，请稍后再试'),
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'),
    ]) {
      const { 视图, 操作 } = 挂载('backend', {
        提交P8反馈: vi.fn(async () => { throw 错误; }),
      });
      await 填写并提交(用户, '功能异常', '导出按钮没有响应');
      expect(操作.提交P8反馈).toHaveBeenCalledTimes(1);
      expect(await screen.findByText(
        错误.status === 0 ? '无法连接后端服务，请检查网络或稍后重试' : '暂时无法确认操作是否成功，请稍后重试',
      )).toBeTruthy();
      const 正文 = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(正文.value).toBe('导出按钮没有响应'); // 输入原样保留，可同文重试
      expect(正文.placeholder).toBe('在哪一屏、做了什么、期望看到什么？'); // 分类原样保留
      expect((screen.getByRole('button', { name: '功能异常' })).className).toContain(样式.分类片选中);
      expect(screen.queryByText(/已收到，谢谢你/)).toBeNull();
      expect(screen.queryByText(/TICKET-P8-001/)).toBeNull();
      视图.unmount();
    }
  });

  it('429 限流给固定文案：无倒计时、无本地成功，输入保留可手动重试', async () => {
    const 用户 = userEvent.setup();
    const { 视图, 操作 } = 挂载('backend', {
      提交P8反馈: vi.fn(async () => { throw new BFF错误(429, 'rate_limited', 'slow down'); }),
    });
    await 填写并提交(用户, '其他', '想说的都可以写在这里');
    expect(await screen.findByText('操作过于频繁，请稍后再试')).toBeTruthy();
    expect(操作.提交P8反馈).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('想说的都可以写在这里');
    expect(screen.queryByText(/已收到，谢谢你/)).toBeNull();
    视图.unmount();
  });

  it('举报类分类提交只给入口指引：举报操作在场也不调（举报只从具体对象入口发起）', async () => {
    const 用户 = userEvent.setup();
    for (const 分类 of ['举报虚假岗位', '举报骚扰行为']) {
      const { 视图, 操作 } = 挂载('backend');
      expect('提交P8举报' in 操作).toBe(true); // Task 7 起公开操作面已含举报
      await 填写并提交(用户, 分类, 'JD 与代理转述不一致');
      // 轻提示是纯 DOM toast（1.8s 后才移除）：上一轮分类的指引还在 body 里，用复数查询
      expect((await screen.findAllByText(/岗位、谈判或真人会话/)).length).toBeGreaterThan(0);
      expect(操作.提交P8反馈).not.toHaveBeenCalled();
      expect(操作.提交P8举报).not.toHaveBeenCalled();
      expect(screen.queryByText(/已收到，谢谢你/)).toBeNull();
      expect(screen.queryByText(/TICKET-P8-001/)).toBeNull();
      视图.unmount();
    }
  });

  it('源码合同：分类表原序保留、既有两份 CSS 不变', () => {
    expect(反馈源码).toContain(
      "const 分类表 = ['举报虚假岗位', '举报骚扰行为', '功能异常', '体验建议', '其他'];",
    );
    expect(反馈源码.match(/\.module\.css';/g)).toHaveLength(2);
  });
});

describe('反馈 · Mock 字节级不变', () => {
  it('产品分类本地成功：固定原型工单号与既有文案，零 P8 操作', async () => {
    const 用户 = userEvent.setup();
    const { 视图, 操作 } = 挂载('mock');
    await 填写并提交(用户, '体验建议', '希望增加状态说明');
    expect(操作.提交P8反馈).not.toHaveBeenCalled();
    expect(await screen.findByText('工单号 FB-2026-0818-041')).toBeTruthy();
    expect(screen.getByText('每一条都有人读。被采纳的建议会在版本更新说明里出现。')).toBeTruthy();
    视图.unmount();
  });

  it('举报类分类保持既有本地成功与 24 小时文案（原型行为原样）', async () => {
    const 用户 = userEvent.setup();
    const { 视图, 操作 } = 挂载('mock');
    await 填写并提交(用户, '举报虚假岗位', 'JD 与代理转述不一致');
    expect(操作.提交P8反馈).not.toHaveBeenCalled();
    expect(await screen.findByText('我们会在 24 小时内核查。核查过程中不会向对方透露是谁提交的。'))
      .toBeTruthy();
    expect(screen.getByText('工单号 FB-2026-0818-041')).toBeTruthy();
    视图.unmount();
  });
});
