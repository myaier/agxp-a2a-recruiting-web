// 问AI代理 的 Backend 真实聊天接线与 Mock 隔离（求职端助手聊天接入 Task 5）：
//   · Backend 挂 use助手会话（消费 Provider 的 助手会话 seam）：历史加载门、真实发送、
//     2 秒定向轮询、加载更早（cursor + 阅读位置保持）、成功回复用 查询结果展示 渲染卡片、
//     卡片导航（岗位带 candidate-assistant 来源 + 窄内存标记）、解读次级动作发可见模板
//     文本且不吞草稿、failed&&retryable 才有重试、提交待确认入口；三个既有快捷槽动作
//     （去市场 / 看在谈 / 规则库）保持；访问为 null（未登录等）时空底座锁输入零请求；
//   · Mock 原型（今日简报、快捷问句、输入、关键词回复）原样保留，容器不挂助手 hook；
//   · Mock 排队的 550ms 模拟回复定时器在切到 Backend / 卸载时必须取消，不允许泄漏
//     （证据用 clearTimeout spy，不以 DOM 消失替代清理）。
// 宿主：mock 应用状态 / 导航钩子（同 看市场.test.tsx 惯例；导航只换 use导航，来路
// 标记/复位用真实现，助手跳详情的会话证据靠它）；可变模式变量供 rerender 前改写，
// 模拟同页数据源切换（mock 前缀满足 vi.mock 工厂的提升引用规则）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 问AI代理 from './问AI代理';
import 样式 from './问AI代理.module.css';
import { 路径 } from '../路由/路径表';
import { 复位助手来路, 有会话内助手来路 } from '../路由/导航钩子';
import { 快捷问句 } from '../数据/模拟数据';
import { 轻提示 } from '../组件/轻提示';
import { BFF错误 } from '../数据/HTTP客户端';
import type { 助手会话访问 } from '../状态/后端/助手会话访问';
import type { AssistantMessage, AssistantMessagePage } from '../数据/招聘数据源/助手会话';

const mock派发 = vi.fn();
const mock返回 = vi.fn();
const mock跳转 = vi.fn();
const mock替换跳转 = vi.fn();
let mock当前模式: 'mock' | 'backend' = 'backend';
// Backend 分支消费的助手会话 seam 桩；Mock 分支不挂 hook，此值只在 Backend 用例有意义
let mock助手访问: 助手会话访问 | null = null;

vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({
    数据源模式: mock当前模式,
    派发: mock派发,
    状态: {
      基本信息: { 真名: '沈亦舟' },
      引导预填: null,
    },
    助手会话: mock助手访问,
  }),
}));
vi.mock('../路由/导航钩子', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  use导航: () => ({
    返回: mock返回,
    跳转: mock跳转,
    替换跳转: mock替换跳转,
  }),
}));
vi.mock('../组件/轻提示', () => ({ 轻提示: vi.fn() }));

// ── 助手会话生命周期用例的共用底座：延迟 Promise + fake timers 驱动真实节拍 ──

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** 只冲微任务：让已 resolve/reject 的延迟 Promise 的后续链路落地。 */
async function 冲(): Promise<void> {
  await act(async () => {
    await vi.runAllTicks();
  });
}

const 种子ID = (前缀: 'asm_' | 'ast_' | 'dlg_' | 'mc_', 串: string): string =>
  `${前缀}${串.padEnd(32, '0').slice(0, 32)}`;

let 序号 = 0;
/** 测试用消息 DTO：默认成功带纯文本回复；覆盖键按用例改 processing/failed 等。 */
function 消息DTO(覆盖: Partial<AssistantMessage> = {}): AssistantMessage {
  序号 += 1;
  return {
    message_id: 种子ID('asm_', `${序号}`),
    turn_id: 种子ID('ast_', `${序号}`),
    text: `第${序号}条`,
    created_at: '2026-09-16T08:00:00Z',
    status: 'succeeded',
    retryable: false,
    error_code: null,
    reply: { text: '好的', visibility: 'available', cards: [] },
    ...覆盖,
  };
}

function 创建访问桩(范围键 = 'stg|sub_1|candidate|1') {
  const api = {
    读取助手历史: vi.fn<(cursor?: string) => Promise<AssistantMessagePage>>(),
    发送助手消息: vi.fn<(text: string, key: string) => Promise<AssistantMessage>>(),
    读取助手轮次: vi.fn<(turnId: string) => Promise<AssistantMessage>>(),
    重试助手轮次: vi.fn<(turnId: string, key: string) => Promise<AssistantMessage>>(),
  };
  return { 访问: { 范围键, api } as 助手会话访问, api };
}

/** 岗位推荐卡快照（真实字段映射由 查询结果展示 自己的用例负责，这里只验页面接线）。 */
const 岗位卡 = {
  kind: 'job_recommendations' as const,
  queried_at: '2026-09-16T08:00:05Z',
  data: {
    intention_id: 'int_1',
    items: [{
      job_id: 'job_77',
      title: '资深前端工程师',
      organization_name: '云衢科技',
      office_location: '上海',
      salary_lower: 30,
      salary_upper: 50,
      salary_period: 'month' as const,
      annual_salary_months: null,
      safe_reasons: ['薪资带覆盖你的底线'],
    }],
    next_cursor: null,
  },
};

/** 在谈列表卡快照：第 1 项可查看（dlg 记录），第 2 项 availability=unavailable（禁入口）。 */
const 在谈卡 = {
  kind: 'negotiation_list' as const,
  queried_at: '2026-09-16T08:00:06Z',
  data: {
    items: [
      {
        record_id: 种子ID('dlg_', '1'),
        record_kind: 'delegation' as const,
        intention_id: 'int_1',
        job: {
          job_id: 'job_1', title: '后端工程师', location: '上海',
          public_salary_range: '30–50K', availability: 'available' as const,
        },
        case_id: null,
        phase: 'evaluating' as const,
        needs_action: false,
      },
      {
        record_id: 种子ID('mc_', '2'),
        record_kind: 'case' as const,
        intention_id: 'int_1',
        job: {
          job_id: 'job_2', title: null, location: null,
          public_salary_range: null, availability: 'unavailable' as const,
        },
        case_id: null,
        phase: 'refused' as const,
        needs_action: false,
      },
    ],
    next_cursor: null,
  },
};

// jsdom 不实现 scrollTo：Mock 体挂载/对话变化都会把对话流滚到底
if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = () => {};
}

beforeEach(() => {
  mock当前模式 = 'backend';
  mock助手访问 = null; // 用例间不渗漏：默认无 seam，聊天接线用例自建访问桩
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('问AI代理 · Backend 真实导航保持', () => {
  it('访问为 null（未登录 / 非 candidate）：空底座、输入禁用，能力说明不声称自由筛选/规则修改', () => {
    mock助手访问 = null;
    render(<问AI代理 />);
    // 仍然零 Mock 内容：无 fixture 简报 / 快捷问句 / 模拟回复
    expect(screen.queryByText('今日简报')).toBeNull();
    expect(screen.queryByText(快捷问句[0])).toBeNull();
    // 真输入条在场但不可发送（无 seam 时 use助手会话 输出空底座）
    const 输入 = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(输入.disabled).toBe(true);
    // 能力说明只承诺可查的，不声称自由筛选 / 规则修改
    const 说明 = screen.getByText(/岗位推荐和在谈进展/);
    expect(说明.textContent).toContain('暂不支持');
    expect(说明.textContent).not.toContain('帮你筛选');
  });

  it.each([
    ['去市场', [{ 型: '切Tab', Tab: '职位' }, { 型: '切子视图', 子视图: '看市场' }], 路径.主壳],
    ['看在谈', [{ 型: '切Tab', Tab: '职位' }, { 型: '切子视图', 子视图: '在谈' }], 路径.主壳],
  ] as const)('%s selects the candidate shell destination', async (name, actions, target) => {
    render(<问AI代理 />);
    await userEvent.click(screen.getByRole('button', { name }));
    expect(mock派发.mock.calls.map(([action]) => action)).toEqual(actions);
    expect(mock替换跳转).toHaveBeenCalledWith(target);
  });

  it('规则库 uses the canonical candidate route', async () => {
    render(<问AI代理 />);
    await userEvent.click(screen.getByRole('button', { name: '规则库' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.规则库);
  });
});

describe('问AI代理 · Backend 真实聊天接线（use助手会话）', () => {
  let 桩: ReturnType<typeof 创建访问桩>;

  beforeEach(() => {
    vi.useFakeTimers();
    桩 = 创建访问桩();
    mock助手访问 = 桩.访问;
    复位助手来路();
  });

  it('历史加载门：首读完成前输入禁用，完成（含空历史）后才可发送', async () => {
    const 首页 = deferred<AssistantMessagePage>();
    桩.api.读取助手历史.mockReturnValue(首页.promise);
    render(<问AI代理 />);
    const 输入 = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(输入.disabled).toBe(true);
    expect(screen.getByText('正在读取历史消息…')).toBeTruthy();
    await act(async () => {
      首页.resolve({ items: [], next_cursor: null });
      await vi.runAllTicks();
    });
    expect(screen.queryByText('正在读取历史消息…')).toBeNull();
    expect(输入.disabled).toBe(false);
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('首读失败不当作空历史：错误行 + 重试（重读）恢复', async () => {
    桩.api.读取助手历史.mockRejectedValueOnce(new BFF错误(503, 'service_unavailable', 'x'));
    桩.api.读取助手历史.mockResolvedValueOnce({ items: [], next_cursor: null });
    render(<问AI代理 />);
    await 冲();
    expect(screen.getByText('消息读取失败，请重试')).toBeTruthy();
    const 输入 = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(输入.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await 冲();
    expect(桩.api.读取助手历史).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('消息读取失败，请重试')).toBeNull();
    expect(输入.disabled).toBe(false);
  });

  it('真实发送：新幂等键受理上屏、2 秒定向轮询、成功回复用查询结果展示渲染、终态停表', async () => {
    桩.api.读取助手历史.mockResolvedValue({ items: [], next_cursor: null });
    render(<问AI代理 />);
    await 冲();
    const 输入 = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(输入, { target: { value: '在谈进展如何' } });
    const 发出 = 消息DTO({ text: '在谈进展如何', status: 'processing', retryable: false, error_code: null, reply: null });
    const 受理 = deferred<AssistantMessage>();
    桩.api.发送助手消息.mockReturnValue(受理.promise);
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    expect(桩.api.发送助手消息).toHaveBeenCalledTimes(1);
    const [发送文本, 发送键] = 桩.api.发送助手消息.mock.calls[0];
    expect(发送文本).toBe('在谈进展如何');
    expect(发送键).toMatch(/^[0-9a-f-]{36}$/);
    await act(async () => {
      受理.resolve(发出);
      await vi.runAllTicks();
    });
    // 我方气泡上屏、处理中标记、发送期间输入锁定
    expect(screen.getByText('在谈进展如何')).toBeTruthy();
    expect(screen.getByText('正在处理…')).toBeTruthy();
    expect(输入.disabled).toBe(true);
    // 202 后每 2 秒定向轮询同一 turn
    const 轮1 = deferred<AssistantMessage>();
    桩.api.读取助手轮次.mockReturnValueOnce(轮1.promise);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(桩.api.读取助手轮次).toHaveBeenCalledTimes(1);
    expect(桩.api.读取助手轮次).toHaveBeenCalledWith(发出.turn_id);
    // 终态：回复交 查询结果展示（无 cards 的纯文本走普通气泡），输入解锁
    await act(async () => {
      轮1.resolve({ ...发出, status: 'succeeded', reply: { text: '有 5 个在谈', visibility: 'available', cards: [在谈卡] } });
      await vi.runAllTicks();
    });
    expect(screen.getByText('有 5 个在谈')).toBeTruthy();
    expect(screen.getByText('后端工程师')).toBeTruthy();
    expect(screen.queryByText('正在处理…')).toBeNull();
    expect(输入.disabled).toBe(false);
    // 终态后不再排拍
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(桩.api.读取助手轮次).toHaveBeenCalledTimes(1);
  });

  it('卡片导航：在谈项用 record_id 跳在谈详情（不要求 case_id），岗位项带助手来源跳职位详情并留会话证据', async () => {
    桩.api.读取助手历史.mockResolvedValue({
      items: [消息DTO({ status: 'succeeded', reply: { text: '查到了', visibility: 'available', cards: [岗位卡, 在谈卡] } })],
      next_cursor: null,
    });
    render(<问AI代理 />);
    await 冲();
    // 在谈项（可查看）→ 现有在谈详情路由，坐标是 record_id
    fireEvent.click(screen.getByRole('button', { name: /后端工程师/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.在谈详情(种子ID('dlg_', '1')));
    // 不可查看项目：卡面退化为不可点容器，不出项目入口
    expect(screen.getByText('岗位信息不可查看')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /职位信息未知/ })).toBeNull();
    // 岗位项 → 职位详情带 candidate-assistant 来源 + 窄内存会话证据
    fireEvent.click(screen.getByRole('button', { name: /资深前端工程师/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.职位详情('job_77'), { 来源: 'candidate-assistant' });
    expect(有会话内助手来路()).toBe(true);
  });

  it('解读次级动作：发送 Spec §5 可见模板文本（精确 record_id），不导航；写操作在飞期间服从输入禁用', async () => {
    桩.api.读取助手历史.mockResolvedValue({
      items: [消息DTO({ status: 'succeeded', reply: { text: '查到了', visibility: 'available', cards: [在谈卡] } })],
      next_cursor: null,
    });
    render(<问AI代理 />);
    await 冲();
    const 解读键们 = screen.getAllByRole('button', { name: '让 AI 解读' }) as HTMLButtonElement[];
    // 可查看项可解读，不可查看项禁解读
    expect(解读键们[0].disabled).toBe(false);
    expect(解读键们[1].disabled).toBe(true);
    const 受理 = deferred<AssistantMessage>();
    桩.api.发送助手消息.mockReturnValueOnce(受理.promise);
    fireEvent.click(解读键们[0]);
    expect(mock跳转).not.toHaveBeenCalled();
    expect(桩.api.发送助手消息).toHaveBeenCalledTimes(1);
    const [解读文本] = 桩.api.发送助手消息.mock.calls[0];
    expect(解读文本).toBe(`请查看在谈记录 ${种子ID('dlg_', '1')}（后端工程师）的详细进展。`);
    // 受理在飞 = 输入禁用：可查看项的解读键一并禁用，落地后恢复
    await 冲();
    expect((screen.getAllByRole('button', { name: '让 AI 解读' })[0] as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      受理.resolve(消息DTO({ status: 'succeeded' }));
      await vi.runAllTicks();
    });
    expect((screen.getAllByRole('button', { name: '让 AI 解读' })[0] as HTMLButtonElement).disabled).toBe(false);
  });

  it('解读不吞草稿：受理清掉显式文本草稿后原样恢复用户的输入', async () => {
    桩.api.读取助手历史.mockResolvedValue({
      items: [消息DTO({ status: 'succeeded', reply: { text: '查到了', visibility: 'available', cards: [在谈卡] } })],
      next_cursor: null,
    });
    render(<问AI代理 />);
    await 冲();
    const 输入 = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(输入, { target: { value: '我自己想问的话' } });
    桩.api.发送助手消息.mockResolvedValueOnce(消息DTO({ status: 'succeeded' }));
    fireEvent.click(screen.getAllByRole('button', { name: '让 AI 解读' })[0]);
    await 冲();
    expect(桩.api.发送助手消息).toHaveBeenCalledTimes(1);
    expect(输入.value).toBe('我自己想问的话');
  });

  it('解读落入待确认：重试提交成功解除后草稿仍恢复，不随 hook 清稿丢失（fix 反例）', async () => {
    桩.api.读取助手历史.mockResolvedValue({
      items: [消息DTO({ status: 'succeeded', reply: { text: '查到了', visibility: 'available', cards: [在谈卡] } })],
      next_cursor: null,
    });
    render(<问AI代理 />);
    await 冲();
    const 输入 = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(输入, { target: { value: '待确认期间的草稿' } });
    // 解读发送 503 进待确认：promise 正常 resolve、草稿仍可见 —— 原实现在此之后的
    // 解除路径会无条件清稿且无恢复
    桩.api.发送助手消息.mockRejectedValueOnce(new BFF错误(503, 'service_unavailable', 'x'));
    fireEvent.click(screen.getAllByRole('button', { name: '让 AI 解读' })[0]);
    await 冲();
    expect(screen.getByText('上一条消息的提交结果待确认')).toBeTruthy();
    expect(输入.value).toBe('待确认期间的草稿');
    // 重试提交成功（同 key 重放取得权威轮次）→ hook 无条件清稿 → 页面恢复暂存
    桩.api.发送助手消息.mockResolvedValueOnce(消息DTO({ status: 'succeeded' }));
    fireEvent.click(screen.getByRole('button', { name: '重试提交' }));
    await 冲();
    expect(screen.queryByText('上一条消息的提交结果待确认')).toBeNull();
    expect(输入.value).toBe('待确认期间的草稿');
  });

  it('普通发送的待确认解除不复活解读暂存：发出去的是草稿本身，清稿是正常契约', async () => {
    桩.api.读取助手历史.mockResolvedValue({
      items: [消息DTO({ status: 'succeeded', reply: { text: '查到了', visibility: 'available', cards: [在谈卡] } })],
      next_cursor: null,
    });
    render(<问AI代理 />);
    await 冲();
    const 输入 = screen.getByRole('textbox') as HTMLTextAreaElement;
    // 一次直接受理的解读：草稿恢复后暂存 ref 残留
    fireEvent.change(输入, { target: { value: '旧草稿' } });
    桩.api.发送助手消息.mockResolvedValueOnce(消息DTO({ status: 'succeeded' }));
    fireEvent.click(screen.getAllByRole('button', { name: '让 AI 解读' })[0]);
    await 冲();
    expect(输入.value).toBe('旧草稿');
    // 用户改写草稿并从输入框发送 → 503 待确认 → 重试提交成功 → 只应保持清稿
    fireEvent.change(输入, { target: { value: '用户自己的消息' } });
    桩.api.发送助手消息.mockRejectedValueOnce(new BFF错误(503, 'service_unavailable', 'x'));
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await 冲();
    桩.api.发送助手消息.mockResolvedValueOnce(消息DTO({ text: '用户自己的消息', status: 'succeeded' }));
    fireEvent.click(screen.getByRole('button', { name: '重试提交' }));
    await 冲();
    expect(screen.queryByText('上一条消息的提交结果待确认')).toBeNull();
    expect(输入.value).toBe('');
  });

  it('无关重试的待确认解除不复活旧解读暂存：直接受理残留 + 用户改稿后不被旧暂存覆盖（fix 2 反例）', async () => {
    const 可重试 = 消息DTO({ status: 'failed', retryable: true, error_code: 'assistant_downstream_error', reply: null });
    桩.api.读取助手历史.mockResolvedValue({
      items: [
        可重试,
        消息DTO({ status: 'succeeded', reply: { text: '查到了', visibility: 'available', cards: [在谈卡] } }),
      ],
      next_cursor: null,
    });
    render(<问AI代理 />);
    await 冲();
    const 输入 = screen.getByRole('textbox') as HTMLTextAreaElement;
    // 一次直接受理的解读：草稿已恢复，暂存 ref 残留
    fireEvent.change(输入, { target: { value: '旧暂存草稿' } });
    桩.api.发送助手消息.mockResolvedValueOnce(消息DTO({ status: 'succeeded' }));
    fireEvent.click(screen.getAllByRole('button', { name: '让 AI 解读' })[0]);
    await 冲();
    expect(输入.value).toBe('旧暂存草稿');
    // 用户改稿；随后一条无关的重试轮次落入待确认再解除（重试解除不清草稿）
    fireEvent.change(输入, { target: { value: '用户最新草稿' } });
    桩.api.重试助手轮次.mockRejectedValueOnce(new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await 冲();
    expect(screen.getByText('上一条消息的提交结果待确认')).toBeTruthy();
    expect(输入.value).toBe('用户最新草稿');
    桩.api.重试助手轮次.mockResolvedValueOnce({
      ...可重试,
      turn_id: 种子ID('ast_', 'rr'),
      status: 'succeeded',
      retryable: false,
      error_code: null,
      reply: { text: '重试成功', visibility: 'available', cards: [] },
    });
    fireEvent.click(screen.getByRole('button', { name: '重试提交' }));
    await 冲();
    expect(screen.queryByText('上一条消息的提交结果待确认')).toBeNull();
    // 解除后输入框是用户自己的最新稿，不是被旧暂存覆盖回去的「旧暂存草稿」
    expect(输入.value).toBe('用户最新草稿');
  });

  it('失败/重试条件：只有 failed && retryable 出重试；uncertain 不自动重跑；重试原位替换', async () => {
    const 可重试 = 消息DTO({ status: 'failed', retryable: true, error_code: 'assistant_downstream_error', reply: null });
    桩.api.读取助手历史.mockResolvedValue({
      items: [
        可重试,
        消息DTO({ status: 'failed', retryable: false, error_code: 'assistant_policy', reply: null }),
        消息DTO({ status: 'uncertain', retryable: false, error_code: null, reply: null }),
      ],
      next_cursor: null,
    });
    render(<问AI代理 />);
    await 冲();
    expect(screen.getAllByText('这条消息处理失败').length).toBe(2);
    expect(screen.getByText('结果暂无法确认')).toBeTruthy();
    const 重试键们 = screen.getAllByRole('button', { name: '重试' });
    expect(重试键们).toHaveLength(1);
    // 重试同一消息的轮次：原位替换，不多出一条用户消息
    桩.api.重试助手轮次.mockResolvedValueOnce({
      ...可重试,
      turn_id: 种子ID('ast_', 'new'),
      status: 'succeeded',
      retryable: false,
      error_code: null,
      reply: { text: '重试成功', visibility: 'available', cards: [] },
    });
    fireEvent.click(重试键们[0]);
    await 冲();
    expect(桩.api.重试助手轮次).toHaveBeenCalledTimes(1);
    expect(桩.api.重试助手轮次.mock.calls[0][0]).toBe(可重试.turn_id);
    expect(screen.getAllByText(可重试.text)).toHaveLength(1); // 没有重复用户气泡
    expect(screen.getByText('重试成功')).toBeTruthy();
  });

  it('提交结果不明：给重试确认入口，同 key 同 text 重放', async () => {
    桩.api.读取助手历史.mockResolvedValue({ items: [], next_cursor: null });
    render(<问AI代理 />);
    await 冲();
    const 输入 = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(输入, { target: { value: '会丢吗' } });
    桩.api.发送助手消息.mockRejectedValueOnce(new BFF错误(503, 'service_unavailable', 'x'));
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await 冲();
    expect(screen.getByText('上一条消息的提交结果待确认')).toBeTruthy();
    // 重试确认 = 同 key 同 text 原样重放，权威轮次回来解除待确认
    桩.api.发送助手消息.mockResolvedValueOnce(消息DTO({ text: '会丢吗', status: 'succeeded' }));
    fireEvent.click(screen.getByRole('button', { name: '重试提交' }));
    await 冲();
    expect(桩.api.发送助手消息).toHaveBeenCalledTimes(2);
    expect(桩.api.发送助手消息.mock.calls[1]).toEqual(桩.api.发送助手消息.mock.calls[0]);
    expect(screen.queryByText('上一条消息的提交结果待确认')).toBeNull();
  });

  it('加载更早：按钮在滚动内容顶部（不遮底部输入）、点按带 cursor 取旧页、按 scrollHeight 差值保住阅读位置', async () => {
    桩.api.读取助手历史.mockResolvedValue({ items: [消息DTO()], next_cursor: '5' });
    const 页 = render(<问AI代理 />);
    await 冲();
    const 按钮 = screen.getByRole('button', { name: '查看更早消息' });
    // 按钮在滚动容器内部（随内容滚动），不是盖住输入条的浮层
    expect(按钮.closest(`.${样式.对话流}`)).toBeTruthy();
    const 容器 = 页.container.querySelector(`.${样式.对话流}`) as HTMLElement;
    let 高度 = 1000;
    let 滚动位置 = 200;
    Object.defineProperty(容器, 'scrollHeight', { configurable: true, get: () => 高度 });
    Object.defineProperty(容器, 'clientHeight', { configurable: true, value: 600 });
    Object.defineProperty(容器, 'scrollTop', {
      configurable: true,
      get: () => 滚动位置,
      set: (值: number) => { 滚动位置 = 值; },
    });
    桩.api.读取助手历史.mockResolvedValueOnce({ items: [消息DTO(), 消息DTO()], next_cursor: null });
    fireEvent.click(按钮); // 点击瞬间按当前 scrollHeight(1000) 记下加载前高度
    高度 = 1600; // 旧页插入后内容变高
    expect(桩.api.读取助手历史).toHaveBeenCalledWith('5');
    await 冲();
    // 阅读位置保持：scrollTop 回补了加载前后的高度差
    expect(滚动位置).toBe(200 + 600);
    expect(screen.queryByRole('button', { name: '查看更早消息' })).toBeNull();
  });

  it('新回复接近底部（80px 阈值）才跟随；阅读旧消息时不抢滚动', async () => {
    桩.api.读取助手历史.mockResolvedValue({ items: [消息DTO()], next_cursor: null });
    const 页 = render(<问AI代理 />);
    await 冲();
    const 容器 = 页.container.querySelector(`.${样式.对话流}`) as HTMLElement;
    let 滚动位置 = 0;
    Object.defineProperty(容器, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(容器, 'clientHeight', { configurable: true, value: 600 });
    Object.defineProperty(容器, 'scrollTop', {
      configurable: true,
      get: () => 滚动位置,
      set: (值: number) => { 滚动位置 = 值; },
    });
    const 滚动Spy = vi.spyOn(容器, 'scrollTo');
    滚动Spy.mockClear();
    桩.api.发送助手消息.mockResolvedValueOnce(消息DTO({ text: '远处的新回复', status: 'succeeded' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '远处的新回复' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await 冲();
    // 用户在读旧消息（距底 400px > 80px）：新回复不抢滚动
    expect(screen.getByText('远处的新回复')).toBeTruthy();
    expect(滚动Spy).not.toHaveBeenCalled();
    // 用户在底部（距底 40px ≤ 80px）：跟随
    滚动位置 = 360;
    桩.api.发送助手消息.mockResolvedValueOnce(消息DTO({ text: '底部的新回复', status: 'succeeded' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '底部的新回复' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await 冲();
    expect(滚动Spy).toHaveBeenCalled();
  });
});

describe('问AI代理 · Mock 原型保持与定时器隔离', () => {
  // 550ms 生成的回复与初始 fixture 那条前缀相同，但少一句「我按方向对口度排了序」；
  // 用整句精确匹配，才不会把 fixture 气泡误认成泄漏的模拟回复
  const 远程回复 = '搜到 7 个全远程、薪资带覆盖你底线的。要我直接去谈前 3 个吗？';
  it('Mock keeps the briefing, quick questions, and send input', () => {
    mock当前模式 = 'mock';
    render(<问AI代理 />);
    expect(screen.getByText('今日简报')).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByRole('button', { name: 快捷问句[0] })).toBeTruthy();
  });

  it('Mock replies within 550ms on the happy path', async () => {
    // fake timers 下不用 userEvent（指针事件等待会被假时钟卡死，仓库惯例是 fireEvent）
    vi.useFakeTimers();
    mock当前模式 = 'mock';
    render(<问AI代理 />);
    fireEvent.click(screen.getByRole('button', { name: 快捷问句[0] }));
    // 发出后先只有 fixture 旧句（整句不同），回复要等 550ms
    expect(screen.queryByText(远程回复)).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(550));
    expect(screen.getByText(远程回复)).toBeTruthy();
  });

  it('switching Mock to Backend clears every queued fake reply timer', async () => {
    // fake timers 下不用 userEvent（指针事件等待会被假时钟卡死，仓库惯例是 fireEvent）
    vi.useFakeTimers();
    const 定时Spy = vi.spyOn(window, 'setTimeout');
    const 清除Spy = vi.spyOn(window, 'clearTimeout');
    mock当前模式 = 'mock';
    const page = render(<问AI代理 />);
    // 点快捷问句：我方消息上屏（按钮 + 气泡两处同文），550ms 回复还在排队
    fireEvent.click(screen.getByRole('button', { name: 快捷问句[0] }));
    expect(screen.getAllByText(快捷问句[0]).length).toBe(2);
    expect(screen.queryByText(远程回复)).toBeNull();

    mock当前模式 = 'backend';
    page.rerender(<问AI代理 />);
    // 清理证据必须是显式 clearTimeout 且覆盖每一个排上的句柄，不是 DOM 消失
    const 排上的 = 定时Spy.mock.results.map((结果) => 结果.value);
    const 已清的 = 清除Spy.mock.calls.map(([句柄]) => 句柄);
    expect(排上的.length).toBeGreaterThan(0);
    for (const 句柄 of 排上的) expect(已清的).toContain(句柄);

    await act(() => vi.advanceTimersByTimeAsync(550));
    expect(screen.queryByText(远程回复)).toBeNull();
    expect(screen.queryByText('今日简报')).toBeNull();
    // 切到 Backend 后落在禁用输入外壳上
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('unmount also clears the queued fake reply timer', async () => {
    vi.useFakeTimers();
    const 定时Spy = vi.spyOn(window, 'setTimeout');
    const 清除Spy = vi.spyOn(window, 'clearTimeout');
    mock当前模式 = 'mock';
    const page = render(<问AI代理 />);
    fireEvent.click(screen.getByRole('button', { name: 快捷问句[0] }));
    page.unmount();
    const 排上的 = 定时Spy.mock.results.map((结果) => 结果.value);
    const 已清的 = 清除Spy.mock.calls.map(([句柄]) => 句柄);
    expect(排上的.length).toBeGreaterThan(0);
    for (const 句柄 of 排上的) expect(已清的).toContain(句柄);
    // 卸载后假时钟走完也不再有宿主可渲染；证据就是上面的逐句柄 clearTimeout 调用
    await act(() => vi.advanceTimersByTimeAsync(550));
    expect(screen.queryByText(/搜到 7 个全远程/)).toBeNull();
  });

  it('Mock 维持红线是零规则 mutation：不派发、不跳转、不轻提示，容器送文案后才换确认行', () => {
    mock当前模式 = 'mock';
    render(<问AI代理 />);
    fireEvent.click(screen.getByRole('button', { name: '维持红线' }));
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(vi.mocked(轻提示)).not.toHaveBeenCalled();
    // 容器把 处理文案 送进卡片 → 双按钮换成对应的「已维持红线…」确认行
    expect(screen.getByText('已维持红线 · 规则不变，我会继续替你挡掉这类岗位。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '维持红线' })).toBeNull();
    expect(screen.queryByRole('button', { name: '改成可谈' })).toBeNull();
  });

  it('Mock 退出重入后简报建议回到初始双按钮（处理状态随容器重挂初始化）', () => {
    mock当前模式 = 'mock';
    const 页 = render(<问AI代理 />);
    fireEvent.click(screen.getByRole('button', { name: '维持红线' }));
    expect(screen.queryByRole('button', { name: '维持红线' })).toBeNull();
    页.unmount();
    render(<问AI代理 />);
    expect(screen.getByRole('button', { name: '维持红线' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '改成可谈' })).toBeTruthy();
    expect(screen.queryByText(/已维持红线 ·/)).toBeNull();
  });

  it('Mock 改成可谈派发规则但不把建议标成已维持（放宽 ≠ 已处理）', () => {
    mock当前模式 = 'mock';
    render(<问AI代理 />);
    fireEvent.click(screen.getByRole('button', { name: '改成可谈' }));
    // 规则载荷与轻提示的逐字断言在 看市场.test.tsx 的跨页用例（原文件继续沿用）
    expect(mock派发).toHaveBeenCalledTimes(1);
    // 放宽不替换按钮：容器没把 改成可谈 当作「已维持红线」处理
    expect(screen.getByRole('button', { name: '维持红线' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '改成可谈' })).toBeTruthy();
    expect(screen.queryByText(/已维持红线 ·/)).toBeNull();
  });
});
