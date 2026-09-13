// 组织查询钩子 测试（Task 2 合同 B）：实例内 公司 搜索/创建 控制。
// 覆盖 250ms 防抖、空输入不请求、词变化作废在飞（A 词迟到不覆盖 B）、跨页同 ID 去重、
// 首页失败置 搜索错误（与零结果分开）、翻页失败保留页面、在飞双击只创建一次、
// 同名失败重试同键／改名新键、作用域切换清理与旧创建返回 null、作废() 同步收口。

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { use组织查询 } from './组织查询钩子';
import type { BFF组织创建结果, BFF组织搜索项, BFF组织搜索页 } from '../数据/BFF契约';
import type { 组织搜索查询 } from '../数据/招聘数据源类型';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

const Acme组织 = { organization_id: 'org_acme', display_name: 'Acme', legal_name: 'Acme Ltd', verification_status: 'unverified' as const };
const Beta组织 = { organization_id: 'org_beta', display_name: 'Beta', legal_name: null, verification_status: 'verified' as const };
const 新组织 = { organization_id: 'org_new', display_name: '新大陆科技', legal_name: null, verification_status: 'unverified' as const };

describe('use组织查询', () => {
  it('250ms 防抖：输入非空后才发起首页搜索', async () => {
    const 搜索 = vi.fn(async (): Promise<BFF组织搜索页> => ({ items: [], next_cursor: null }));
    const { result } = renderHook(() => use组织查询({ 作用域键: 'mock', 搜索 }));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(搜索).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(搜索).toHaveBeenCalledTimes(1);
    expect(搜索).toHaveBeenCalledWith({ q: 'Acme', limit: 20 });
  });

  it('空输入不请求：结果保持空、搜索错误为空（零输入提示由展示层给）', async () => {
    const 搜索 = vi.fn(async (): Promise<BFF组织搜索页> => ({ items: [Acme组织], next_cursor: null }));
    const { result } = renderHook(() => use组织查询({ 作用域键: 'mock', 搜索 }));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(result.current.结果).toEqual([Acme组织]);

    act(() => result.current.设词('   '));
    const 已调用数 = 搜索.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(搜索.mock.calls.length).toBe(已调用数);
    expect(result.current.结果).toEqual([]);
    expect(result.current.搜索错误).toBeNull();
  });

  it('A 词迟到不覆盖 B：换词作废在飞请求，旧响应丢弃', async () => {
    const acme = deferred<BFF组织搜索页>();
    const beta = deferred<BFF组织搜索页>();
    const 搜索 = vi.fn((查询: 组织搜索查询): Promise<BFF组织搜索页> =>
      查询.q === 'Acme' ? acme.promise : beta.promise,
    );
    const { result } = renderHook(() => use组织查询({ 作用域键: 'mock', 搜索 }));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    act(() => result.current.设词('Beta'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => { beta.resolve({ items: [Beta组织], next_cursor: null }); });
    await act(async () => { acme.resolve({ items: [Acme组织], next_cursor: 'old' }); });
    expect(result.current.结果).toEqual([Beta组织]);
    expect(result.current.下一页游标).toBeNull();
  });

  it('相同 organization_id 跨页去重：加载更多合并时同 ID 只保留一次', async () => {
    const 第二页 = deferred<BFF组织搜索页>();
    const 搜索 = vi.fn(async (查询: 组织搜索查询): Promise<BFF组织搜索页> => {
      if (查询.cursor === undefined) return { items: [Acme组织, Beta组织], next_cursor: 'cursor_2' };
      return 第二页.promise;
    });
    const { result } = renderHook(() => use组织查询({ 作用域键: 'mock', 搜索 }));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => {
      第二页.resolve({ items: [Acme组织, 新组织], next_cursor: null });
      void result.current.加载更多();
    });
    expect(result.current.结果).toEqual([Acme组织, Beta组织, 新组织]);
  });

  it('首页失败置 搜索错误（与零结果分开）；空结果则无错误', async () => {
    const 失败页 = deferred<BFF组织搜索页>();
    let 序 = 0;
    const 搜索 = vi.fn(async (): Promise<BFF组织搜索页> => {
      序 += 1;
      return 序 === 1 ? 失败页.promise : { items: [], next_cursor: null };
    });
    const { result } = renderHook(() => use组织查询({ 作用域键: 'mock', 搜索 }));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => { 失败页.reject(new Error('网络断开')); });
    // 失败：错误文案出现，且不能假称「没有企业」（搜索错误 与 零结果 分开）
    expect(result.current.搜索错误).not.toBeNull();
    expect(result.current.搜索中).toBe(false);
    expect(result.current.结果).toEqual([]);

    // 用户换个词得到真正的零结果：错误消失、结果为空、无错误
    act(() => result.current.设词('不存在'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(result.current.搜索错误).toBeNull();
    expect(result.current.结果).toEqual([]);
  });

  it('翻页失败置 加载错误：已加载页面与游标保留，可再次重试', async () => {
    const 第二页 = deferred<BFF组织搜索页>();
    const 第三页 = deferred<BFF组织搜索页>();
    let 序 = 0;
    const 搜索 = vi.fn(async (查询: 组织搜索查询): Promise<BFF组织搜索页> => {
      if (查询.cursor === undefined) return { items: [Acme组织], next_cursor: 'cursor_2' };
      序 += 1;
      return 序 === 1 ? 第二页.promise : 第三页.promise;
    });
    const { result } = renderHook(() => use组织查询({ 作用域键: 'mock', 搜索 }));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => { void result.current.加载更多(); });
    await act(async () => { 第二页.reject(new Error('翻页失败')); });
    expect(result.current.加载错误).not.toBeNull();
    expect(result.current.结果).toEqual([Acme组织]);
    expect(result.current.下一页游标).toBe('cursor_2');
    expect(result.current.加载中).toBe(false);

    // 保留游标可重试
    await act(async () => { void result.current.加载更多(); });
    await act(async () => { 第三页.resolve({ items: [Beta组织], next_cursor: null }); });
    expect(result.current.结果).toEqual([Acme组织, Beta组织]);
    expect(result.current.加载错误).toBeNull();
  });

  it('创建在飞双击只创建一次；完成后可再次创建', async () => {
    const 回执 = deferred<BFF组织创建结果>();
    const 创建 = vi.fn(async (): Promise<BFF组织创建结果> => 回执.promise);
    const { result } = renderHook(() => use组织查询({ 作用域键: 'mock', 创建 }));
    let 第一次: BFF组织搜索项 | null | undefined;
    let 第二次: BFF组织搜索项 | null | undefined;
    await act(async () => { void result.current.添加('新大陆科技').then((值) => { 第一次 = 值; }); });
    expect(result.current.创建中).toBe(true);
    await act(async () => { void result.current.添加('新大陆科技').then((值) => { 第二次 = 值; }); });
    expect(创建).toHaveBeenCalledTimes(1);
    expect(result.current.创建中).toBe(true);
    await act(async () => { 回执.resolve({ organization: 新组织, created: true }); });
    expect(result.current.创建中).toBe(false);
    expect(第一次).toEqual(新组织);
    expect(第二次).toBeNull();

    // 在飞结束：可再次创建
    await act(async () => { await result.current.添加('新大陆科技'); });
    expect(创建).toHaveBeenCalledTimes(2);
  });

  it('同名失败重试用同一幂等键，改名换新键；失败保留 创建错误', async () => {
    const 键们: string[] = [];
    const 创建 = vi.fn(async (_名称: string, 键: string): Promise<BFF组织创建结果> => {
      键们.push(键);
      throw new Error('后端拒绝');
    });
    const { result } = renderHook(() => use组织查询({ 作用域键: 'mock', 创建 }));
    await act(async () => { await result.current.添加('星桥传媒'); });
    await act(async () => { await result.current.添加('  星桥传媒 '); });
    expect(创建).toHaveBeenCalledTimes(2);
    expect(键们[0]).toBe(键们[1]);
    await act(async () => { await result.current.添加('澜舟数据'); });
    expect(键们[2]).not.toBe(键们[0]);
    expect(result.current.创建错误).not.toBeNull();
    expect(result.current.创建中).toBe(false);
  });

  it('作用域切换：清理本实例状态、作废在飞；旧搜索响应被丢弃、旧创建返回 null', async () => {
    const 搜索页 = deferred<BFF组织搜索页>();
    const 创建回执 = deferred<BFF组织创建结果>();
    const 参数 = {
      作用域键: 'mock',
      搜索: vi.fn(async (): Promise<BFF组织搜索页> => 搜索页.promise),
      创建: vi.fn(async (): Promise<BFF组织创建结果> => 创建回执.promise),
    };
    const { result, rerender } = renderHook(() => use组织查询(参数));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    let 旧创建回执: BFF组织搜索项 | null | undefined;
    await act(async () => { void result.current.添加('旧公司').then((值) => { 旧创建回执 = 值; }); });
    expect(result.current.创建中).toBe(true);

    // 切作用域：词/结果/游标/创建态全部清理，在飞请求全部作废
    参数.作用域键 = '主体B';
    rerender();
    expect(result.current.词).toBe('');
    expect(result.current.结果).toEqual([]);
    expect(result.current.下一页游标).toBeNull();
    expect(result.current.创建中).toBe(false);

    await act(async () => { 搜索页.resolve({ items: [Acme组织], next_cursor: 'stale' }); });
    expect(result.current.结果).toEqual([]); // 迟到响应不覆盖新作用域
    await act(async () => { 创建回执.resolve({ organization: 新组织, created: true }); });
    expect(旧创建回执).toBeNull(); // 页面关闭/作用域变更后旧创建返回 null，不回填
  });

  it('作废()：同步增加代际并清理定时器与本实例状态；旧搜索/旧创建不再提交', async () => {
    const 搜索页 = deferred<BFF组织搜索页>();
    const 创建回执 = deferred<BFF组织创建结果>();
    const { result } = renderHook(() => use组织查询({
      作用域键: 'mock',
      搜索: vi.fn(async (): Promise<BFF组织搜索页> => 搜索页.promise),
      创建: vi.fn(async (): Promise<BFF组织创建结果> => 创建回执.promise),
    }));
    act(() => result.current.设词('Acme'));
    let 旧创建回执: BFF组织搜索项 | null | undefined;
    await act(async () => { void result.current.添加('旧公司').then((值) => { 旧创建回执 = 值; }); });
    expect(result.current.创建中).toBe(true);

    // 定时器被清：250ms 内作废后放行时钟也不再发搜索
    act(() => result.current.作废());
    expect(result.current.词).toBe('');
    expect(result.current.搜索中).toBe(false);
    expect(result.current.创建中).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(400));
    await act(async () => { 搜索页.resolve({ items: [Acme组织], next_cursor: null }); });
    await act(async () => { 创建回执.resolve({ organization: 新组织, created: true }); });
    expect(result.current.搜索中).toBe(false);
    expect(result.current.结果).toEqual([]);
    expect(旧创建回执).toBeNull();
  });

  it('重新查询 keeps the word, clears results/cursor/errors, and refetches', async () => {
    const 第一次 = deferred<BFF组织搜索页>();
    const 第二次 = deferred<BFF组织搜索页>();
    const 页们 = [第一次.promise, 第二次.promise];
    const 搜索 = vi.fn(async (): Promise<BFF组织搜索页> => 页们.shift()!);
    const { result } = renderHook(() => use组织查询({ 作用域键: 'mock', 搜索 }));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => { 第一次.reject(new Error('网络断开')); });
    expect(result.current.搜索错误).not.toBeNull();

    act(() => result.current.重新查询());
    expect(result.current.词).toBe('Acme'); // 可见输入文本保持不动
    expect(result.current.结果).toEqual([]);
    expect(result.current.下一页游标).toBeNull();
    expect(result.current.搜索错误).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => { 第二次.resolve({ items: [Beta组织], next_cursor: null }); });
    expect(result.current.结果).toEqual([Beta组织]);
  });

  it('无 搜索/创建 方法时一切退化为空操作（Mock 页面未接 callbacks）', async () => {
    const { result } = renderHook(() => use组织查询({ 作用域键: 'mock' }));
    act(() => result.current.设词('Acme'));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(result.current.搜索中).toBe(false);
    expect(result.current.结果).toEqual([]);
    await act(async () => { await result.current.添加('新大陆科技'); });
    expect(result.current.创建中).toBe(false);
    await act(async () => { void result.current.加载更多(); });
    expect(result.current.加载中).toBe(false);
  });
});