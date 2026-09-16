// use助手会话 的生命周期测试（Task 4 / 合同 C + Spec §3）：延迟 Promise + fake timers
// 驱动真实节拍 —— 首读→发送→2 秒轮询→成功停止；卸载停止；scope 变化（含同账号重登
// 换代际）丢弃旧范围结果；首读失败输入锁；分页以 message_id 合并且旧页不覆盖 retry 更新；
// 写锁单飞（快速双击一个 POST）；提交不明保存原 key/text 或 turnId 同键重放；409
// in-progress 重读跟踪活动轮次；uncertain 无重试、failed 不可重试、retry_not_allowed 重读、
// unavailable 保留草稿、401 不当业务失败、轮询读失败暂停后重读恢复、两个响应乱序丢弃。

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { use助手会话 } from './use助手会话';
import type { 助手会话访问 } from './助手会话访问';
import { BFF错误 } from '../../数据/HTTP客户端';
import type { AssistantMessage, AssistantMessagePage } from '../../数据/招聘数据源/助手会话';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
});

/** 推进假时钟（触发内部状态更新的用例必须裹 act，避免 React 19 的更新告警）。 */
async function 走(毫秒: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(毫秒);
  });
}

/** 只冲微任务（不发请求）：让已 resolve/reject 的延迟 Promise 的后续链路落地。 */
async function 冲(): Promise<void> {
  await act(async () => {
    await vi.runAllTicks();
  });
}

/** resolve 一个延迟 Promise 并冲完后续链路。 */
async function 完成<T>(延迟: { resolve: (值: T) => void }, 值: T): Promise<void> {
  await act(async () => {
    延迟.resolve(值);
    await vi.runAllTicks();
  });
}

const 种子ID = (前缀: 'asm_' | 'ast_', 串: string): string =>
  `${前缀}${串.padEnd(32, '0').slice(0, 32)}`;

let 序号 = 0;
/** 测试用消息 DTO：默认成功带纯文本回复；覆盖键按用例改 processing/failed 等。 */
function 消息DTO(覆盖: Partial<AssistantMessage> = {}): AssistantMessage {
  序号 += 1;
  return {
    message_id: 种子ID('asm_', `m${序号}`),
    turn_id: 种子ID('ast_', `t${序号}`),
    text: `第${序号}条`,
    created_at: '2026-09-16T08:00:00Z',
    status: 'succeeded',
    retryable: false,
    error_code: null,
    reply: { text: '好的', visibility: 'available', cards: [] },
    ...覆盖,
  };
}

const 处理中 = (覆盖: Partial<AssistantMessage> = {}): AssistantMessage => 消息DTO({
  status: 'processing', retryable: false, error_code: null, reply: null, ...覆盖,
});

const 失败可重试 = (覆盖: Partial<AssistantMessage> = {}): AssistantMessage => 消息DTO({
  status: 'failed', retryable: true, error_code: 'assistant_downstream_error', reply: null, ...覆盖,
});

function 创建访问桩(范围键 = 'stg|sub_1|candidate|3') {
  const api = {
    读取助手历史: vi.fn<(cursor?: string) => Promise<AssistantMessagePage>>(),
    发送助手消息: vi.fn<(text: string, key: string) => Promise<AssistantMessage>>(),
    读取助手轮次: vi.fn<(turnId: string) => Promise<AssistantMessage>>(),
    重试助手轮次: vi.fn<(turnId: string, key: string) => Promise<AssistantMessage>>(),
  };
  const 访问 = { 范围键, api } as 助手会话访问;
  return { 访问, api };
}

describe('use助手会话', () => {
  it('首次加载→发送→2 秒轮询→成功停止；确认受理才清草稿', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    const 旧消息 = 消息DTO();
    const 首页 = deferred<AssistantMessagePage>();
    api.读取助手历史.mockReturnValue(首页.promise);
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    expect(result.current.首读中).toBe(true);
    expect(result.current.输入禁用).toBe(true);
    await 完成(首页, { items: [旧消息], next_cursor: null });
    expect(result.current.消息.map((条) => 条.message_id)).toEqual([旧消息.message_id]); // 旧到新
    expect(result.current.首读中).toBe(false);
    expect(result.current.输入禁用).toBe(false);
    expect(result.current.有更早).toBe(false);

    // 发送：202 受理（processing）才清草稿并开始定向轮询
    const 发出 = 处理中({ text: '帮我看看岗位' });
    const 受理 = deferred<AssistantMessage>();
    api.发送助手消息.mockReturnValue(受理.promise);
    act(() => { result.current.设草稿('帮我看看岗位'); });
    let 发送承诺!: Promise<void>;
    await act(async () => { 发送承诺 = result.current.发送(); });
    expect(api.发送助手消息).toHaveBeenCalledTimes(1);
    await act(async () => { 受理.resolve(发出); await 发送承诺; });
    expect(result.current.草稿).toBe('');
    expect(result.current.消息.at(-1)!.message_id).toBe(发出.message_id);
    expect(result.current.输入禁用).toBe(true);

    // 每 2 秒一发；processing 期间持续
    const 轮1 = deferred<AssistantMessage>();
    api.读取助手轮次.mockReturnValueOnce(轮1.promise);
    await 走(2_000);
    expect(api.读取助手轮次).toHaveBeenCalledWith(发出.turn_id);
    await 完成(轮1, { ...发出 }); // 仍 processing
    expect(result.current.输入禁用).toBe(true);
    const 轮2 = deferred<AssistantMessage>();
    api.读取助手轮次.mockReturnValueOnce(轮2.promise);
    await 走(2_000);
    expect(api.读取助手轮次).toHaveBeenCalledTimes(2);
    await 完成(轮2, {
      ...发出,
      status: 'succeeded',
      reply: { text: '这是答复', visibility: 'available', cards: [] },
    });
    expect(result.current.输入禁用).toBe(false);
    expect(result.current.消息.at(-1)!.reply!.text).toBe('这是答复');
    // 终态停止轮询
    await 走(6_000);
    expect(api.读取助手轮次).toHaveBeenCalledTimes(2);
  });

  it('卸载停止：不再发出任何轮询', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    const 发出 = 处理中({ text: '在谈什么' });
    api.读取助手历史.mockResolvedValueOnce({ items: [], next_cursor: null });
    api.发送助手消息.mockResolvedValueOnce(发出);
    const { result, unmount } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    await act(async () => { await result.current.发送('在谈什么'); });
    unmount();
    await 走(10_000);
    expect(api.读取助手轮次).not.toHaveBeenCalled();
  });

  it('scope 变化（同 subject 重登换代际）后旧范围的首读成功丢弃，新范围重新读', async () => {
    vi.useFakeTimers();
    const { 访问: 旧访问, api: 旧api } = 创建访问桩('stg|sub_1|candidate|3');
    const { 访问: 新访问, api: 新api } = 创建访问桩('stg|sub_1|candidate|4'); // 同主体，代际变化
    const 旧页 = deferred<AssistantMessagePage>();
    旧api.读取助手历史.mockReturnValue(旧页.promise);
    const 新页 = deferred<AssistantMessagePage>();
    新api.读取助手历史.mockReturnValue(新页.promise);
    const { result, rerender } = renderHook(
      (访问参数: 助手会话访问 | null) => use助手会话(访问参数),
      { initialProps: 旧访问 },
    );
    await 冲();
    expect(旧api.读取助手历史).toHaveBeenCalledTimes(1);
    rerender(新访问);
    // 旧范围的成功结果迟到：整包丢弃，不落消息
    await 完成(旧页, { items: [消息DTO()], next_cursor: null });
    expect(result.current.消息).toEqual([]);
    // 新范围独立首读
    await 完成(新页, { items: [消息DTO()], next_cursor: null });
    expect(result.current.消息.length).toBe(1);
    expect(新api.读取助手历史).toHaveBeenCalledTimes(1);
  });

  it('scope 变化后旧范围的 401 不展示为业务失败', async () => {
    vi.useFakeTimers();
    const { 访问: 旧访问, api: 旧api } = 创建访问桩('stg|sub_1|candidate|3');
    const { 访问: 新访问, api: 新api } = 创建访问桩('stg|sub_1|candidate|4');
    const 旧页 = deferred<AssistantMessagePage>();
    旧api.读取助手历史.mockReturnValue(旧页.promise);
    新api.读取助手历史.mockResolvedValue({ items: [], next_cursor: null });
    const { result, rerender } = renderHook(
      (访问参数: 助手会话访问 | null) => use助手会话(访问参数),
      { initialProps: 旧访问 },
    );
    await 冲();
    rerender(新访问);
    await act(async () => {
      旧页.reject(new BFF错误(401, 'invalid_session', 'expired'));
      await vi.runAllTicks();
    });
    expect(result.current.错误).toBe(null);
    await 冲(); // 新范围首读完成
    expect(result.current.输入禁用).toBe(false);
  });

  it('旧范围挂起的写落定不清新代际的写锁：输入不提前解禁、新代仍单飞（fix：finally 复位加代际守卫）', async () => {
    vi.useFakeTimers();
    const { 访问: 旧访问, api: 旧api } = 创建访问桩('stg|sub_1|candidate|3');
    const { 访问: 新访问, api: 新api } = 创建访问桩('stg|sub_1|candidate|4');
    旧api.读取助手历史.mockResolvedValueOnce({ items: [], next_cursor: null });
    新api.读取助手历史.mockResolvedValueOnce({ items: [], next_cursor: null });
    const { result, rerender } = renderHook(
      (访问参数: 助手会话访问 | null) => use助手会话(访问参数),
      { initialProps: 旧访问 },
    );
    await 冲();
    // 旧范围发起写操作且受理迟迟不回（挂起跨换代）
    const 旧受理 = deferred<AssistantMessage>();
    旧api.发送助手消息.mockReturnValueOnce(旧受理.promise);
    let 旧发送承诺!: Promise<void>;
    await act(async () => { 旧发送承诺 = result.current.发送('旧范围消息'); });
    expect(旧api.发送助手消息).toHaveBeenCalledTimes(1);
    // 换范围：复位局部 清锁换代；随后新代完成首读并发起自己的写操作（也在飞挂起）
    rerender(新访问);
    await 冲();
    const 新受理 = deferred<AssistantMessage>();
    新api.发送助手消息.mockReturnValueOnce(新受理.promise);
    let 新发送承诺!: Promise<void>;
    await act(async () => { 新发送承诺 = result.current.发送('新范围消息'); });
    expect(新api.发送助手消息).toHaveBeenCalledTimes(1);
    expect(result.current.输入禁用).toBe(true);
    // 旧请求此刻才落定：其 finally 不得清新代在飞写锁
    await act(async () => {
      旧受理.resolve(处理中({ text: '旧范围消息' }));
      await 旧发送承诺;
    });
    expect(result.current.消息).toEqual([]); // 旧结果整包丢弃
    expect(result.current.输入禁用).toBe(true); // 无守卫时此处被旧 finally 解禁
    // 新代写锁仍在：同刻的第二次发送仍被单飞拦截
    await act(async () => { await result.current.发送('再发一条'); });
    expect(新api.发送助手消息).toHaveBeenCalledTimes(1);
    // 新代写操作落定：锁正常释放，processing 进入轮询（输入仍锁）
    await act(async () => {
      新受理.resolve(处理中({ text: '新范围消息' }));
      await 新发送承诺;
    });
    expect(result.current.消息.at(-1)!.text).toBe('新范围消息');
    expect(result.current.输入禁用).toBe(true);
  });

  it('首读失败锁输入并显示错误；重读成功空页后允许发送', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    api.读取助手历史.mockRejectedValueOnce(new BFF错误(0, 'network_error', '网络连接失败'));
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    expect(result.current.首读中).toBe(false);
    expect(result.current.输入禁用).toBe(true); // 首读失败输入锁
    expect(result.current.错误).toBe('消息读取失败，请重试');
    api.读取助手历史.mockResolvedValueOnce({ items: [], next_cursor: null });
    await act(async () => { await result.current.重读(); });
    expect(result.current.消息).toEqual([]);
    expect(result.current.错误).toBe(null);
    expect(result.current.输入禁用).toBe(false); // 成功空页允许发送
    api.发送助手消息.mockResolvedValueOnce(消息DTO({ text: '你好' }));
    await act(async () => { await result.current.发送('你好'); });
    expect(api.发送助手消息).toHaveBeenCalledTimes(1);
  });

  it('首读发现最新消息 processing 即恢复轮询', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    const 在处理 = 处理中();
    api.读取助手历史.mockResolvedValueOnce({ items: [在处理], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    expect(result.current.输入禁用).toBe(true);
    api.读取助手轮次.mockResolvedValueOnce({ ...在处理, status: 'succeeded', reply: { text: '好了', visibility: 'available', cards: [] } });
    await 走(2_000);
    expect(api.读取助手轮次).toHaveBeenCalledWith(在处理.turn_id);
    await 冲();
    expect(result.current.输入禁用).toBe(false);
  });

  it('历史分页按 message_id 合并：旧页不能覆盖已由 retry 更新的 turn_id，且不重复用户气泡', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    const 失败消息 = 失败可重试();
    const 甲 = 消息DTO();
    const 乙 = 消息DTO();
    api.读取助手历史.mockResolvedValueOnce({ items: [失败消息, 甲, 乙], next_cursor: '100' }); // 新到旧
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    expect(result.current.消息.map((条) => 条.message_id))
      .toEqual([乙, 甲, 失败消息].map((条) => 条.message_id)); // 展示倒序为旧到新
    expect(result.current.有更早).toBe(true);

    // 加载更早在飞（响应延迟：旧页快照里还是 retry 之前的 turn）
    const 旧页 = deferred<AssistantMessagePage>();
    api.读取助手历史.mockReturnValueOnce(旧页.promise);
    let 加载承诺!: Promise<void>;
    act(() => { 加载承诺 = result.current.加载更早(); });
    expect(result.current.加载更早中).toBe(true);

    // 与此同时业务重试成功：同 message_id 原位换新 turn，processing
    const 新轮 = 种子ID('ast_', 'r9');
    api.重试助手轮次.mockResolvedValueOnce({
      ...失败消息, turn_id: 新轮, status: 'processing', retryable: false, error_code: null, reply: null,
    });
    await act(async () => { await result.current.重试轮次(失败消息.message_id); });
    const 重试后 = result.current.消息.find((条) => 条.message_id === 失败消息.message_id)!;
    expect(重试后.turn_id).toBe(新轮);
    expect(result.current.消息.length).toBe(3); // 失败轮次原 message_id 更新，不重复用户气泡

    // 旧页现在才回来：带旧 turn 的同 message_id 不能覆盖已更新的 turn_id
    await act(async () => {
      旧页.resolve({ items: [{ ...失败消息 }], next_cursor: null });
      await vi.runAllTicks();
      await 加载承诺;
    });
    const 合并后 = result.current.消息.find((条) => 条.message_id === 失败消息.message_id)!;
    expect(合并后.turn_id).toBe(新轮);
    expect(result.current.有更早).toBe(false);
  });

  it('快速双击只有一个 POST（写入 ref 同步锁）', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    api.读取助手历史.mockResolvedValueOnce({ items: [], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    const 受理 = deferred<AssistantMessage>();
    api.发送助手消息.mockReturnValue(受理.promise);
    let 第一次!: Promise<void>;
    let 第二次!: Promise<void>;
    act(() => {
      第一次 = result.current.发送('连点');
      第二次 = result.current.发送('连点');
    });
    expect(api.发送助手消息).toHaveBeenCalledTimes(1);
    await act(async () => {
      受理.resolve(处理中({ text: '连点' }));
      await 第一次;
      await 第二次;
    });
  });

  it('uncertain 无重试入口；failed 且不可重试同样不触发重试', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    const 不确定 = 消息DTO({ status: 'uncertain', retryable: false, error_code: null, reply: null });
    const 不可重试 = 消息DTO({ status: 'failed', retryable: false, error_code: 'assistant_downstream_error', reply: null });
    api.读取助手历史.mockResolvedValueOnce({ items: [不确定, 不可重试], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    await act(async () => { await result.current.重试轮次(不确定.message_id); });
    await act(async () => { await result.current.重试轮次(不可重试.message_id); });
    expect(api.重试助手轮次).not.toHaveBeenCalled();
    expect(result.current.输入禁用).toBe(false);
  });

  it('retry_not_allowed：重读该轮以服务端权威状态原位更新，不进待确认', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    const 失败消息 = 失败可重试();
    api.读取助手历史.mockResolvedValueOnce({ items: [失败消息], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    api.重试助手轮次.mockRejectedValueOnce(new BFF错误(409, 'assistant_retry_not_allowed', 'no'));
    api.读取助手轮次.mockResolvedValueOnce({ ...失败消息, retryable: false });
    await act(async () => { await result.current.重试轮次(失败消息.message_id); });
    expect(api.重试助手轮次).toHaveBeenCalledTimes(1); // 只有一次业务重试（新 key）
    expect(api.读取助手轮次).toHaveBeenCalledWith(失败消息.turn_id);
    expect(result.current.消息.find((条) => 条.message_id === 失败消息.message_id)!.retryable)
      .toBe(false);
    expect(result.current.提交待确认).toBe(false);
  });

  it('assistant_unavailable：说明不可用、保留草稿、不进待确认、可再发送', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    api.读取助手历史.mockResolvedValueOnce({ items: [], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    act(() => { result.current.设草稿('帮我推荐岗位'); });
    api.发送助手消息.mockRejectedValueOnce(new BFF错误(409, 'assistant_unavailable', 'no agent'));
    await act(async () => { await result.current.发送(); });
    expect(result.current.错误).toBe('AI 代理当前不可用，请稍后再试');
    expect(result.current.草稿).toBe('帮我推荐岗位');
    expect(result.current.提交待确认).toBe(false);
    expect(result.current.输入禁用).toBe(false);
    expect(api.发送助手消息).toHaveBeenCalledTimes(1);
  });

  it('当前 401 不展示为聊天业务失败（清账号状态归 seam/Provider 统一处理）', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    api.读取助手历史.mockResolvedValueOnce({ items: [], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    api.发送助手消息.mockRejectedValueOnce(new BFF错误(401, 'invalid_session', 'expired'));
    await act(async () => { await result.current.发送('你好'); });
    expect(result.current.错误).toBe(null);
    expect(result.current.提交待确认).toBe(false);
    expect(result.current.草稿).toBe('');
  });

  it('503 结果不明进待确认；重读只读历史；重试提交原样重放同一 key 与 text', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    api.读取助手历史.mockResolvedValueOnce({ items: [], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    act(() => { result.current.设草稿('同样的问题'); });
    api.发送助手消息.mockRejectedValueOnce(new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    await act(async () => { await result.current.发送(); });
    expect(result.current.提交待确认).toBe(true);
    expect(result.current.输入禁用).toBe(true);
    expect(result.current.草稿).toBe('同样的问题'); // 未确认受理：不清草稿
    // 待确认期间重读只读历史，不生成新 key
    api.读取助手历史.mockResolvedValueOnce({ items: [], next_cursor: null });
    await act(async () => { await result.current.重读(); });
    expect(api.发送助手消息).toHaveBeenCalledTimes(1);
    expect(result.current.提交待确认).toBe(true); // 历史无该操作：仍待确认
    // 重试提交：同一 key、同一 text 重放，受理后解除并清草稿
    const 受理 = 处理中({ text: '同样的问题' });
    api.发送助手消息.mockResolvedValueOnce(受理);
    await act(async () => { await result.current.重试提交(); });
    expect(api.发送助手消息).toHaveBeenCalledTimes(2);
    expect(api.发送助手消息.mock.calls[1][0]).toBe('同样的问题');
    expect(api.发送助手消息.mock.calls[1][1]).toBe(api.发送助手消息.mock.calls[0][1]);
    expect(result.current.提交待确认).toBe(false);
    expect(result.current.草稿).toBe('');
    expect(result.current.消息.at(-1)!.message_id).toBe(受理.message_id);
  });

  it('成功坏体（200 invalid_response）同样保存原 key：重试提交同键重放', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    api.读取助手历史.mockResolvedValueOnce({ items: [], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    api.发送助手消息.mockRejectedValueOnce(new BFF错误(200, 'invalid_response', '坏体'));
    await act(async () => { await result.current.发送('坏体请求'); });
    expect(result.current.提交待确认).toBe(true);
    api.发送助手消息.mockResolvedValueOnce(消息DTO({ text: '坏体请求' }));
    await act(async () => { await result.current.重试提交(); });
    expect(api.发送助手消息).toHaveBeenCalledTimes(2);
    expect(api.发送助手消息.mock.calls[1][1]).toBe(api.发送助手消息.mock.calls[0][1]);
    expect(result.current.提交待确认).toBe(false);
  });

  it('重试 POST 结果不明保存原 turnId/key；重试提交同键重放同一轮次', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    const 失败消息 = 失败可重试();
    api.读取助手历史.mockResolvedValueOnce({ items: [失败消息], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    api.重试助手轮次.mockRejectedValueOnce(new BFF错误(0, 'network_error', '超时'));
    await act(async () => { await result.current.重试轮次(失败消息.message_id); });
    expect(result.current.提交待确认).toBe(true);
    expect(result.current.输入禁用).toBe(true);
    const 新轮 = 种子ID('ast_', 'rr');
    api.重试助手轮次.mockResolvedValueOnce({
      ...失败消息, turn_id: 新轮, status: 'processing', retryable: false, error_code: null, reply: null,
    });
    await act(async () => { await result.current.重试提交(); });
    expect(api.重试助手轮次).toHaveBeenCalledTimes(2);
    expect(api.重试助手轮次.mock.calls[1]).toEqual(api.重试助手轮次.mock.calls[0]); // 同 turnId 同 key
    expect(result.current.提交待确认).toBe(false);
    expect(result.current.消息.find((条) => 条.message_id === 失败消息.message_id)!.turn_id)
      .toBe(新轮);
  });

  it('重试提交 retry_not_allowed 后权威读取失败：解除待确认并显示确认失败文案，不吞二错', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    const 失败消息 = 失败可重试();
    api.读取助手历史.mockResolvedValueOnce({ items: [失败消息], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    // 重试结果不明 → 进待确认（同 key 保存）
    api.重试助手轮次.mockRejectedValueOnce(new BFF错误(0, 'network_error', '超时'));
    await act(async () => { await result.current.重试轮次(失败消息.message_id); });
    expect(result.current.提交待确认).toBe(true);
    // 同键重放返回 retry_not_allowed，随后的权威读取轮次 GET 也失败
    api.重试助手轮次.mockRejectedValueOnce(new BFF错误(409, 'assistant_retry_not_allowed', 'no'));
    api.读取助手轮次.mockRejectedValueOnce(new BFF错误(0, 'network_error', '掉线'));
    await act(async () => { await result.current.重试提交(); });
    expect(api.重试助手轮次).toHaveBeenCalledTimes(2); // 同键重放确实发生
    expect(result.current.提交待确认).toBe(false); // 操作确定未受理：解除待确认
    expect(result.current.错误).toBe('重试状态确认失败，请重读消息'); // 二错不被吞
    // 权威读取失败：旧 failed&&retryable 状态保持原样，不被伪装成已确认
    expect(result.current.消息.find((条) => 条.message_id === 失败消息.message_id)!.status)
      .toBe('failed');
    expect(result.current.消息.find((条) => 条.message_id === 失败消息.message_id)!.retryable)
      .toBe(true);
  });

  it('409 assistant_turn_in_progress：重读历史跟踪活动轮次，未受理草稿不显示为已发送', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    api.读取助手历史.mockResolvedValueOnce({ items: [], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    act(() => { result.current.设草稿('我的问题'); });
    const 活动轮次 = 处理中({ text: '别处发起的问题' });
    api.发送助手消息.mockRejectedValueOnce(new BFF错误(409, 'assistant_turn_in_progress', 'busy'));
    api.读取助手历史.mockResolvedValueOnce({ items: [活动轮次], next_cursor: null });
    await act(async () => { await result.current.发送(); });
    expect(result.current.草稿).toBe('我的问题'); // 未受理：草稿保留
    expect(result.current.消息.map((条) => 条.text)).toEqual(['别处发起的问题']); // 不加用户气泡
    expect(result.current.输入禁用).toBe(true);
    await 走(2_000);
    expect(api.读取助手轮次).toHaveBeenCalledWith(活动轮次.turn_id);
  });

  it('重试轮次遇 409 in_progress：重读历史恢复活动轮次，不落通用冲突错误', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    const 失败消息 = 失败可重试();
    api.读取助手历史.mockResolvedValueOnce({ items: [失败消息], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    // 另一处已抢先重试同一轮（新轮 processing）：本端 retry 被拒为 409 in_progress
    const 新轮 = 种子ID('ast_', 'other');
    api.重试助手轮次.mockRejectedValueOnce(new BFF错误(409, 'assistant_turn_in_progress', 'busy'));
    api.读取助手历史.mockResolvedValueOnce({
      items: [{ ...失败消息, turn_id: 新轮, status: 'processing', retryable: false, error_code: null, reply: null }],
      next_cursor: null,
    });
    await act(async () => { await result.current.重试轮次(失败消息.message_id); });
    // 自动重读历史；不显示通用冲突错误；不新增用户气泡（同 message_id 原位换新 turn）
    expect(api.读取助手历史).toHaveBeenCalledTimes(2);
    expect(result.current.错误).toBe(null);
    expect(result.current.消息.length).toBe(1);
    expect(result.current.消息[0].turn_id).toBe(新轮);
    // 重读发现 processing 轮次：恢复轮询、输入保持禁用
    expect(result.current.输入禁用).toBe(true);
    await 走(2_000);
    expect(api.读取助手轮次).toHaveBeenCalledWith(新轮);
  });

  it('提交待确认时重读发现该操作的权威轮次即解除并恢复轮询', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    api.读取助手历史.mockResolvedValueOnce({ items: [], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    act(() => { result.current.设草稿('历史里的问题'); });
    api.发送助手消息.mockRejectedValueOnce(new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    await act(async () => { await result.current.发送(); });
    expect(result.current.提交待确认).toBe(true);
    const 权威 = 处理中({ text: '历史里的问题' });
    api.读取助手历史.mockResolvedValueOnce({ items: [权威], next_cursor: null });
    await act(async () => { await result.current.重读(); });
    expect(result.current.提交待确认).toBe(false);
    expect(result.current.草稿).toBe('');
    expect(result.current.消息.map((条) => 条.message_id)).toEqual([权威.message_id]);
    expect(result.current.输入禁用).toBe(true); // processing：恢复轮询并锁输入
    await 走(2_000);
    expect(api.读取助手轮次).toHaveBeenCalledWith(权威.turn_id);
  });

  it('同文旧消息不解除待确认：重读后最新一条仍是基线内旧消息时不误清草稿（fix 1）', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    // 历史最新一条就是同文旧消息 —— 用户反复问「下一批」是 Spec §4 鼓励的交互
    const 旧同文 = 消息DTO({ text: '下一批' });
    api.读取助手历史.mockResolvedValueOnce({ items: [旧同文], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    act(() => { result.current.设草稿('下一批'); });
    // 新 POST 结果不明进待确认（原 POST 实际未落地）
    api.发送助手消息.mockRejectedValueOnce(new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    await act(async () => { await result.current.发送(); });
    expect(result.current.提交待确认).toBe(true);
    // 重读：首页最新一条仍是那条同文旧消息（message_id 在基线内）—— 不得误判为权威轮次
    api.读取助手历史.mockResolvedValueOnce({ items: [{ ...旧同文 }], next_cursor: null });
    await act(async () => { await result.current.重读(); });
    expect(result.current.提交待确认).toBe(true); // 不误解除
    expect(result.current.草稿).toBe('下一批'); // 草稿保留，消息不被无声丢弃
    // 真正落地后（同文但新 message_id）才解除并清草稿
    const 权威 = 处理中({ text: '下一批' });
    api.读取助手历史.mockResolvedValueOnce({ items: [权威, 旧同文], next_cursor: null });
    await act(async () => { await result.current.重读(); });
    expect(result.current.提交待确认).toBe(false);
    expect(result.current.草稿).toBe('');
    expect(result.current.消息.at(-1)!.message_id).toBe(权威.message_id);
  });

  it('轮询读取失败暂停并显示错误、不释放输入锁；重读恢复后终态解锁', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    const 在处理 = 处理中({ text: '慢回复' });
    api.读取助手历史.mockResolvedValueOnce({ items: [在处理], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    api.读取助手轮次.mockRejectedValueOnce(new BFF错误(0, 'network_error', '掉线'));
    await 走(2_000);
    await 冲();
    expect(result.current.错误).toBe('助手回复状态读取失败，请重读恢复');
    expect(result.current.输入禁用).toBe(true); // 不擅自释放 processing 输入锁
    await 走(6_000);
    expect(api.读取助手轮次).toHaveBeenCalledTimes(1); // 暂停：不再排拍
    api.读取助手历史.mockResolvedValueOnce({
      items: [{ ...在处理, status: 'succeeded', reply: { text: '迟到的答复', visibility: 'available', cards: [] } }],
      next_cursor: null,
    });
    await act(async () => { await result.current.重读(); });
    expect(result.current.错误).toBe(null);
    expect(result.current.输入禁用).toBe(false);
    await 走(4_000);
    expect(api.读取助手轮次).toHaveBeenCalledTimes(1); // 已终态：不恢复轮询
  });

  it('两个响应乱序：被重读取代的旧轮响应整包丢弃，不回滚终态', async () => {
    vi.useFakeTimers();
    const { 访问, api } = 创建访问桩();
    const 在处理 = 处理中({ text: '乱序' });
    api.读取助手历史.mockResolvedValueOnce({ items: [在处理], next_cursor: null });
    const { result } = renderHook((访问参数: 助手会话访问 | null) => use助手会话(访问参数), {
      initialProps: 访问,
    });
    await 冲();
    const 旧轮响应 = deferred<AssistantMessage>();
    api.读取助手轮次.mockReturnValueOnce(旧轮响应.promise);
    await 走(2_000); // 旧轮轮询已发出，响应挂起
    // 用户重读：历史显示该消息已在别处成功
    api.读取助手历史.mockResolvedValueOnce({
      items: [{ ...在处理, status: 'succeeded', reply: { text: '权威答复', visibility: 'available', cards: [] } }],
      next_cursor: null,
    });
    await act(async () => { await result.current.重读(); });
    expect(result.current.输入禁用).toBe(false);
    // 旧轮响应现在才回来，仍说 processing：不许回滚状态、不许重开轮询
    await 完成(旧轮响应, { ...在处理 });
    expect(result.current.消息.at(-1)!.status).toBe('succeeded');
    expect(result.current.输入禁用).toBe(false);
    await 走(6_000);
    expect(api.读取助手轮次).toHaveBeenCalledTimes(1);
  });
});
