// 城市查询钩子 测试（review-r1 P2-2）：stale search response 不覆盖 newer results。
// 两次搜索，第二次先 resolve、第一次后 resolve → 最终结果应是第二次的（不被第一次覆盖）。

import { render } from '@testing-library/react';
import { act } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { use城市搜索, type 查询Location方法 } from './城市查询钩子';
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