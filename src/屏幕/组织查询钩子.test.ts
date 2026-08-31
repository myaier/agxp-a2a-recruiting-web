// 组织查询钩子 测试（Task 4）：屏蔽名单 Backend 分支的可屏蔽组织搜索。
// 覆盖 250ms debounce、输入变化即作废（清结果/游标/选中）、stale 响应丢弃、
// 首页失败保页面、翻页双击只取一次游标；与 城市查询钩子.test.ts 同一套手法。

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { use组织查询 } from './组织查询钩子';
import type { BFF组织搜索页 } from '../数据/BFF契约';
import type { 组织搜索查询 } from '../数据/招聘数据源类型';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

const Acme组织 = { organization_id: 'org_acme', display_name: 'Acme', legal_name: 'Acme Ltd' };
const Beta组织 = { organization_id: 'org_beta', display_name: 'Beta', legal_name: 'Beta Ltd' };

describe('use组织查询', () => {
  it('debounce：250ms 内不发请求，选源前也不发', async () => {
    const 搜索 = vi.fn(async (): Promise<BFF组织搜索页> => ({ items: [], next_cursor: null }));
    const { result } = renderHook(() => use组织查询(搜索));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(400));
    // 未选来源：绝不发请求
    expect(搜索).not.toHaveBeenCalled();
    act(() => result.current.设来源('手动添加'));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(搜索).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(搜索).toHaveBeenCalledTimes(1);
    expect(搜索).toHaveBeenCalledWith({ q: 'Acme', limit: 20 });
  });

  it('new query discards old response and resets cursor', async () => {
    const acme = deferred<BFF组织搜索页>();
    const beta = deferred<BFF组织搜索页>();
    const 搜索 = vi.fn((查询: 组织搜索查询): Promise<BFF组织搜索页> =>
      查询.q === 'Acme' ? acme.promise : beta.promise,
    );
    const { result } = renderHook(() => use组织查询(搜索));
    act(() => result.current.设来源('手动添加'));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    act(() => result.current.设词('Beta'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => { beta.resolve({ items: [Beta组织], next_cursor: null }); });
    await act(async () => { acme.resolve({ items: [Acme组织], next_cursor: 'old' }); });
    expect(result.current.结果).toEqual([Beta组织]);
    expect(result.current.下一页游标).toBeNull();
  });

  it('设词 清空立即生效：结果与游标复位，不再为空词发请求', async () => {
    const 页 = deferred<BFF组织搜索页>();
    const 搜索 = vi.fn(async (): Promise<BFF组织搜索页> => 页.promise);
    const { result } = renderHook(() => use组织查询(搜索));
    act(() => result.current.设来源('手动添加'));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => { 页.resolve({ items: [Acme组织], next_cursor: null }); });
    expect(result.current.结果).toEqual([Acme组织]);

    const 已调用数 = 搜索.mock.calls.length;
    act(() => result.current.设词(''));
    expect(result.current.结果).toEqual([]);
    expect(result.current.下一页游标).toBeNull();
    expect(result.current.选择).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(搜索.mock.calls.length).toBe(已调用数);
  });

  it('selecting a result keeps alternatives visible and does not re-query', async () => {
    const 页 = deferred<BFF组织搜索页>();
    let 调用数 = 0;
    const 搜索 = vi.fn(async (): Promise<BFF组织搜索页> => {
      调用数 += 1;
      return 页.promise;
    });
    const { result } = renderHook(() => use组织查询(搜索));
    act(() => result.current.设来源('手动添加'));
    act(() => result.current.设词('Ac'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => { 页.resolve({ items: [Acme组织, Beta组织], next_cursor: null }); });
    expect(result.current.结果).toEqual([Acme组织, Beta组织]);

    act(() => result.current.选中(Beta组织));
    expect(result.current.选择).toEqual(Beta组织);
    expect(result.current.词).toBe('Beta');
    // 点选后备选列表保持可见，且不触发第二次搜索
    expect(result.current.结果).toEqual([Acme组织, Beta组织]);
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(调用数).toBe(1);
  });

  it('重新查询 keeps the word, clears selection/results/cursor, and refetches', async () => {
    const 第一次 = deferred<BFF组织搜索页>();
    const 第二次 = deferred<BFF组织搜索页>();
    const 页们 = [第一次.promise, 第二次.promise];
    const 搜索 = vi.fn(async (): Promise<BFF组织搜索页> => 页们.shift()!);
    const { result } = renderHook(() => use组织查询(搜索));
    act(() => result.current.设来源('当前雇主'));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => { 第一次.resolve({ items: [Acme组织], next_cursor: null }); });
    act(() => result.current.选中(Acme组织));

    act(() => result.current.重新查询());
    expect(result.current.选择).toBeNull();
    expect(result.current.结果).toEqual([]);
    expect(result.current.下一页游标).toBeNull();
    expect(result.current.词).toBe('Acme'); // 可见输入文本保持不动

    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => { 第二次.resolve({ items: [Beta组织], next_cursor: null }); });
    expect(result.current.结果).toEqual([Beta组织]);
  });

  it('首页失败保留输入与已展示的页面', async () => {
    const 成功页 = deferred<BFF组织搜索页>();
    const 失败页 = deferred<BFF组织搜索页>();
    let 序 = 0;
    const 搜索 = vi.fn(async (): Promise<BFF组织搜索页> => {
      序 += 1;
      return 序 === 1 ? 成功页.promise : 失败页.promise;
    });
    const { result } = renderHook(() => use组织查询(搜索));
    act(() => result.current.设来源('手动添加'));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => { 成功页.resolve({ items: [Acme组织], next_cursor: null }); });
    expect(result.current.结果).toEqual([Acme组织]);

    act(() => result.current.设词('Beta'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => { 失败页.reject(new Error('网络断开')); });
    // 首页失败：输入保留，失败响应不提交任何结果或游标（上一页的清空来自用户输入，不是失败处理器）
    expect(result.current.词).toBe('Beta');
    expect(result.current.搜索中).toBe(false);
    expect(result.current.下一页游标).toBeNull();
    expect(result.current.结果).toEqual([]);
  });

  it('加载更多 双击只携带一次该游标；翻页失败保留页面与游标', async () => {
    const 第二页 = deferred<BFF组织搜索页>();
    const 调用参数s: 组织搜索查询[] = [];
    const 搜索 = vi.fn(async (查询: 组织搜索查询): Promise<BFF组织搜索页> => {
      调用参数s.push(查询);
      if (查询.cursor === undefined) return { items: [Acme组织], next_cursor: 'cursor_2' };
      return 第二页.promise;
    });
    const { result } = renderHook(() => use组织查询(搜索));
    act(() => result.current.设来源('手动添加'));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(result.current.结果).toEqual([Acme组织]);
    expect(result.current.下一页游标).toBe('cursor_2');

    // 两个独立 act()：第一次调用的 加载中 提交后，第二次调用才发起并被 guard 拦下
    await act(async () => { void result.current.加载更多(); });
    expect(result.current.加载中).toBe(true);
    await act(async () => { void result.current.加载更多(); });

    expect(调用参数s.filter((c) => c.cursor === 'cursor_2').length).toBe(1);

    await act(async () => { 第二页.resolve({ items: [Beta组织], next_cursor: 'cursor_3' }); });
    expect(result.current.加载中).toBe(false);
    expect(result.current.结果).toEqual([Acme组织, Beta组织]);
    expect(result.current.下一页游标).toBe('cursor_3');

    // 翻页失败：已展示页面与游标原样保留，仅退出加载态
    const 失败前调用数 = 搜索.mock.calls.length;
    搜索.mockImplementationOnce(async () => { throw new Error('翻页失败'); });
    await act(async () => { void result.current.加载更多(); });
    expect(搜索.mock.calls.length).toBe(失败前调用数 + 1);
    expect(result.current.加载中).toBe(false);
    expect(result.current.结果).toEqual([Acme组织, Beta组织]);
    expect(result.current.下一页游标).toBe('cursor_3');
  });
});
