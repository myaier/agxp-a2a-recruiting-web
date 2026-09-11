// 城市查询钩子 测试（review-r1 P2-2）：stale search response 不覆盖 newer results。
// 两次搜索，第二次先 resolve、第一次后 resolve → 最终结果应是第二次的（不被第一次覆盖）。

import { render } from '@testing-library/react';
import { act } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { use城市搜索, use城市默认页, type 查询Location方法 } from './城市查询钩子';
import type { BFFLocationItem } from '../数据/BFF契约';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
}

describe('use城市搜索 stale-response guard（P2-2）', () => {
  it('两次搜索，第二次先 resolve，第一次后 resolve → 最终是第二次的结果', async () => {
    // 用能控设词的探针：把 设词 暴露到外部 ref
    let 设词外: ((v: string) => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 词, 设词, 结果 } = use城市搜索(查询);
      设词外 = 设词;
      return createElement('output', null, JSON.stringify({ 词, 结果: 结果.map((r) => r.id) }));
    }

    const 第一次 = deferred<{ items: BFFLocationItem[]; nextCursor: null; catalogVersion: string }>();
    const 第二次 = deferred<{ items: BFFLocationItem[]; nextCursor: null; catalogVersion: string }>();
    let 调用序 = 0;
    const 查询 = vi.fn(async () => {
      调用序 += 1;
      return 调用序 === 1 ? 第一次.promise : 第二次.promise;
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));

    // 第一次搜索：输入「北京」（慢响应）
    act(() => 设词外!('北京'));
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(查询).toHaveBeenCalledTimes(1);

    // 第二次搜索：输入「上海」（快响应）
    act(() => 设词外!('上海'));
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(查询).toHaveBeenCalledTimes(2);

    // 第二次先 resolve（上海结果）
    await act(async () => {
      第二次.resolve({ items: [{ id: 'loc_sh', display_name: '上海' } as BFFLocationItem], nextCursor: null, catalogVersion: 'v2' });
    });
    let 输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.结果).toEqual(['loc_sh']);

    // 第一次后 resolve（北京结果）—— 不应覆盖上海结果
    await act(async () => {
      第一次.resolve({ items: [{ id: 'loc_bj', display_name: '北京' } as BFFLocationItem], nextCursor: null, catalogVersion: 'v2' });
    });
    输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.结果).toEqual(['loc_sh']);
  });
});
// ── Task 5：默认目录页（不发空 q）+ 换词后旧页迟到 ──

describe('use城市默认页（Task 5）', () => {
  it('默认查询不带 q，滚到底用上一页游标追加，加载中锁住重入', async () => {
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 热门项们, 项们, 加载更多, 加载中 } = use城市默认页(查询);
      加载更多外 = () => void 加载更多();
      return createElement(
        'output',
        null,
        JSON.stringify({
          热门: 热门项们.map((项) => 项.id),
          全部: 项们.map((项) => 项.id),
          加载中,
        }),
      );
    }

    const 第二页 = deferred<{ items: BFFLocationItem[]; nextCursor: null; catalogVersion: string }>();
    const 查询 = vi.fn(async (q: { cursor?: string }) => {
      if (q.cursor === 'cur_1') return 第二页.promise;
      return {
        items: [{ id: 'loc_sh', display_name: '上海市' } as BFFLocationItem],
        nextCursor: 'cur_1' as string | null,
        catalogVersion: 'v2',
      };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });

    // 默认查询不发 q（空串也不发）
    const 首次参数 = (查询 as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(Object.keys(首次参数)).not.toContain('q');
    let 输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.热门).toEqual(['loc_sh']);

    // 滚到底触发两次：加载中锁住第二次重入
    await act(async () => { 加载更多外!(); });
    await act(async () => { 加载更多外!(); });
    expect((查询 as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((调用) => 调用[0].cursor === 'cur_1')).toHaveLength(1);

    await act(async () => {
      第二页.resolve({
        items: [{ id: 'loc_hz', display_name: '杭州市' } as BFFLocationItem],
        nextCursor: null,
        catalogVersion: 'v2',
      });
    });
    输出 = JSON.parse(container.querySelector('output')!.textContent!);
    // 第二页追加进全量，但热门区仍是默认推荐首页
    expect(输出.全部).toEqual(['loc_sh', 'loc_hz']);
    expect(输出.热门).toEqual(['loc_sh']);
  });
});

describe('use城市搜索 换词后旧页迟到（Task 5）', () => {
  it('A 的下一页在换词到 B 后到达，不追加进 B 的结果', async () => {
    let 设词外: ((v: string) => void) | null = null;
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 设词, 结果, 加载更多 } = use城市搜索(查询);
      设词外 = 设词;
      加载更多外 = () => void 加载更多();
      return createElement('output', null, JSON.stringify({ 结果: 结果.map((r) => r.id) }));
    }

    const A第二页 = deferred<{ items: BFFLocationItem[]; nextCursor: null; catalogVersion: string }>();
    const 查询 = vi.fn(async (q: { q?: string; cursor?: string }) => {
      if (q.cursor === 'a_cur_1') return A第二页.promise;
      if (q.q === 'A') {
        return {
          items: [{ id: 'loc_a1', display_name: 'A城' } as BFFLocationItem],
          nextCursor: 'a_cur_1' as string | null,
          catalogVersion: 'v2',
        };
      }
      return {
        items: [{ id: 'loc_b1', display_name: 'B城' } as BFFLocationItem],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    act(() => 设词外!('A'));
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(JSON.parse(container.querySelector('output')!.textContent!).结果).toEqual(['loc_a1']);

    // A 的下一页在飞行中
    await act(async () => { 加载更多外!(); });
    // 换词到 B，B 结果先到
    act(() => 设词外!('B'));
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(JSON.parse(container.querySelector('output')!.textContent!).结果).toEqual(['loc_b1']);

    // A 的旧页迟到：不能追加进 B 的结果
    await act(async () => {
      A第二页.resolve({
        items: [{ id: 'loc_a2', display_name: 'A城2（过期）' } as BFFLocationItem],
        nextCursor: null,
        catalogVersion: 'v2',
      });
    });
    expect(JSON.parse(container.querySelector('output')!.textContent!).结果).toEqual(['loc_b1']);
  });
});
