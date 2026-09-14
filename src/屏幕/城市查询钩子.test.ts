// 城市查询钩子 测试：
// - use城市搜索：stale response 守卫、换词迟到页、q 无国家限制（保留既有合同）。
// - use城市默认页（Task 4）：固定 CN/TW/HK/MO 四支并发首页 + 各自分页 + 失败/版本/代际语义。
// - 按行政区分组（Task 4）：CN 按 admin1_code 聚合、TW/HK/MO 三个中文固定组。
// - use城市分组：Task 4 不启用、不改合同，既有测试保留（不作为本 Task 测试真相）。
// - merge 调和（2026-09-14）：四支模型之上叠加 picker Task 2 的 错误/重试 兼容层 ——
//   失败支行内错误可见、接手重试时清空、分支重试只补失败支；搜索的 错误/重试 用当前词重发。

import { render } from '@testing-library/react';
import { act } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { use城市搜索, use城市默认页, use城市分组, 按行政区分组, type 查询Location方法 } from './城市查询钩子';
import type { BFFLocationItem } from '../数据/BFF契约';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (原因?: unknown) => void;
  const promise = new Promise<T>((ok, bad) => { resolve = ok; reject = bad; });
  return { promise, resolve, reject };
}

/** 动态取轻提示条数：每次断言都重查单例容器（轻提示是纯 DOM 单例，不走 React）。 */
function 轻提示条数(): number {
  return (Array.from(document.body.children).find(
    (节点) => (节点 as HTMLElement).style?.zIndex === '999',
  ) as HTMLElement | undefined)?.childElementCount ?? 0;
}

function 清空轻提示(): void {
  const 容器 = Array.from(document.body.children).find(
    (节点) => (节点 as HTMLElement).style?.zIndex === '999',
  ) as HTMLElement | undefined;
  if (容器) 容器.innerHTML = '';
}

/** 造一条后端 Location 目录项：字段全部来自返回，不补造页面字段 */
function 条目(项: {
  id: string;
  display_name: string;
  country_code: string;
  admin1_code?: string | null;
  admin1_name?: string | null;
}): BFFLocationItem {
  return {
    id: 项.id,
    display_name: 项.display_name,
    country_code: 项.country_code,
    country_name: 项.country_code,
    admin1_code: 项.admin1_code ?? null,
    admin1_name: 项.admin1_name ?? null,
    timezone: 'UTC',
    population: 0,
  };
}

type 页形 = { items: BFFLocationItem[]; nextCursor: string | null; catalogVersion: string };

describe('use城市搜索 stale-response guard（P2-2）', () => {
  it('两次搜索，第二次先 resolve，第一次后 resolve → 最终是第二次的结果', async () => {
    // 用能控设词的探针：把 设词 暴露到外部 ref
    let 设词外: ((v: string) => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 词, 设词, 结果 } = use城市搜索(查询);
      设词外 = 设词;
      return createElement('output', null, JSON.stringify({ 词, 结果: 结果.map((r) => r.id) }));
    }

    const 第一次 = deferred<页形>();
    const 第二次 = deferred<页形>();
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

  it('搜索不带国家限制：q 直达端点，不加 countryCode（Task 4 全球搜索）', async () => {
    let 设词外: ((v: string) => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 设词 } = use城市搜索(查询);
      设词外 = 设词;
      return createElement('output', null, '');
    }
    const 查询 = vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })) as unknown as 查询Location方法;
    render(createElement(探针, { 查询 }));
    act(() => 设词外!('London'));
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(查询).toHaveBeenCalledWith({ q: 'London' });
    const 调用参数 = (查询 as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(调用参数).not.toHaveProperty('countryCode');
  });
});

// ── Task 4：默认目录页按固定四国分支查询 ──
// 四支（CN/TW/HK/MO）各自持有累计页/游标/版本/首页是否成功/pending；
// 聚合项只来自四支并按 ID 去重；海外精选与搜索没有写入路径。

describe('use城市默认页 四支默认目录（Task 4）', () => {
  it('首次挂载并发请求 CN/TW/HK/MO 四支首页（{countryCode, limit:20}，无 q）', async () => {
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 项们, 加载中, 还有 } = use城市默认页(查询);
      return createElement('output', null, JSON.stringify({
        项们: 项们.map((项) => 项.id),
        加载中,
        还有,
      }));
    }

    // 四支全用未决 promise：断言四请求在不等任何响应的情况下就全部发出（可并发）
    const 挂起 = new Map<string, ReturnType<typeof deferred<页形>>>();
    const 查询 = vi.fn(async (q: { countryCode?: string }) => {
      const 支 = deferred<页形>();
      挂起.set(q.countryCode!, 支);
      return 支.promise;
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });

    const 调用 = (查询 as unknown as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
    expect(调用).toHaveLength(4);
    expect(调用.map((调用) => (调用[0] as { countryCode?: string }).countryCode)).toEqual(['CN', 'TW', 'HK', 'MO']);
    for (const 单调用 of 调用) {
      expect(单调用[0]).toEqual({ countryCode: (单调用[0] as { countryCode: string }).countryCode, limit: 20 });
    }
    // 初始：加载中、还有（尚未成功的首页也是 true）、无项
    let 输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出).toEqual({ 项们: [], 加载中: true, 还有: true });

    // 依次落四支：聚合按固定国家顺序
    await act(async () => {
      挂起.get('CN')!.resolve({ items: [条目({ id: 'loc_cn1', display_name: '广州市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: null, catalogVersion: 'v2' });
    });
    await act(async () => {
      挂起.get('TW')!.resolve({ items: [条目({ id: 'loc_tw1', display_name: 'Taipei', country_code: 'TW' })], nextCursor: null, catalogVersion: 'v2' });
    });
    await act(async () => {
      挂起.get('HK')!.resolve({ items: [条目({ id: 'loc_hk1', display_name: 'Hong Kong', country_code: 'HK' })], nextCursor: null, catalogVersion: 'v2' });
    });
    await act(async () => {
      挂起.get('MO')!.resolve({ items: [条目({ id: 'loc_mo1', display_name: 'Macau', country_code: 'MO' })], nextCursor: null, catalogVersion: 'v2' });
    });
    输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.项们).toEqual(['loc_cn1', 'loc_tw1', 'loc_hk1', 'loc_mo1']);
    expect(输出.加载中).toBe(false);
    expect(输出.还有).toBe(false);
  });

  it('各自分页：加载更多按各支游标各取一页，已完成支不再请求；按 ID 去重', async () => {
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 项们, 还有, 加载更多 } = use城市默认页(查询);
      加载更多外 = () => void 加载更多();
      return createElement('output', null, JSON.stringify({
        项们: 项们.map((项) => 项.id),
        还有,
      }));
    }

    const 查询 = vi.fn(async (q: { countryCode?: string; cursor?: string }) => {
      if (q.cursor === 'cn_1') {
        return { items: [条目({ id: 'loc_cn1', display_name: '广州市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: null, catalogVersion: 'v2' };
      }
      if (q.cursor === 'tw_1') {
        return { items: [条目({ id: 'loc_tw1', display_name: 'Taipei', country_code: 'TW' })], nextCursor: null, catalogVersion: 'v2' };
      }
      if (q.countryCode === 'CN') return { items: [条目({ id: 'loc_cn1', display_name: '广州市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: 'cn_1', catalogVersion: 'v2' };
      if (q.countryCode === 'TW') return { items: [条目({ id: 'loc_tw1', display_name: 'Taipei', country_code: 'TW' })], nextCursor: 'tw_1', catalogVersion: 'v2' };
      if (q.countryCode === 'HK') return { items: [条目({ id: 'loc_hk1', display_name: 'Hong Kong', country_code: 'HK' })], nextCursor: null, catalogVersion: 'v2' };
      return { items: [条目({ id: 'loc_mo1', display_name: 'Macau', country_code: 'MO' })], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    // 追加页回显已见过的 ID（CN/TW 第二页特意复用首页 ID）时按 ID 去重
    await act(async () => { 加载更多外!(); });
    expect(JSON.parse(container.querySelector('output')!.textContent!).项们).toEqual([
      'loc_cn1', 'loc_tw1', 'loc_hk1', 'loc_mo1',
    ]);
    // 各支带各自游标与国家码请求下一页
    const 调用 = (查询 as unknown as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
    expect(调用.filter((单调用) => (单调用[0] as { cursor?: string }).cursor === 'cn_1')).toHaveLength(1);
    expect(调用.filter((单调用) => (单调用[0] as { cursor?: string }).cursor === 'tw_1')).toHaveLength(1);
    expect(调用.find((单调用) => (单调用[0] as { cursor?: string }).cursor === 'cn_1')![0]).toEqual({ countryCode: 'CN', cursor: 'cn_1', limit: 20 });
    // 全部完成后还有=false，再触发不发生任何请求
    expect(JSON.parse(container.querySelector('output')!.textContent!).还有).toBe(false);
    const 调用数 = 调用.length;
    await act(async () => { 加载更多外!(); });
    expect((查询 as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(调用数);
  });

  it('同一事件循环重复触发加载更多只飞一轮（ref 同步 pending）', async () => {
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 项们, 加载中, 加载更多 } = use城市默认页(查询);
      加载更多外 = () => void 加载更多();
      return createElement('output', null, JSON.stringify({ 项们: 项们.map((项) => 项.id), 加载中 }));
    }

    const CN第二页 = deferred<页形>();
    const 查询 = vi.fn(async (q: { countryCode?: string; cursor?: string }) => {
      if (q.cursor === 'cn_1') return CN第二页.promise;
      if (q.countryCode === 'CN') return { items: [条目({ id: 'loc_cn1', display_name: '广州市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: 'cn_1', catalogVersion: 'v2' };
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    // 同一 tick 连点两次：pending ref 让第二次空计划
    await act(async () => { 加载更多外!(); 加载更多外!(); });
    expect((查询 as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      (单调用) => (单调用[0] as { cursor?: string }).cursor === 'cn_1',
    )).toHaveLength(1);
    expect(JSON.parse(container.querySelector('output')!.textContent!).加载中).toBe(true);
    await act(async () => {
      CN第二页.resolve({ items: [条目({ id: 'loc_cn2', display_name: '深圳市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: null, catalogVersion: 'v2' });
    });
    const 输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.项们).toEqual(['loc_cn1', 'loc_cn2']);
    expect(输出.加载中).toBe(false);
  });

  it('一国首页失败：其他支照常上屏，重试只补失败支', async () => {
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 项们, 加载中, 还有, 加载更多 } = use城市默认页(查询);
      加载更多外 = () => void 加载更多();
      return createElement('output', null, JSON.stringify({
        项们: 项们.map((项) => 项.id), 加载中, 还有,
      }));
    }

    const CN首页 = deferred<页形>();
    let CN首页已失败 = false;
    const 查询 = vi.fn(async (q: { countryCode?: string }) => {
      if (q.countryCode === 'CN') {
        if (!CN首页已失败) {
          CN首页已失败 = true;
          return CN首页.promise;
        }
        return { items: [条目({ id: 'loc_cn1', display_name: '广州市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: null, catalogVersion: 'v2' };
      }
      return { items: [条目({ id: `loc_${q.countryCode}`, display_name: q.countryCode!, country_code: q.countryCode! })], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    // CN 失败：不丢其他支结果，失败支保留可重试（还有=true）
    await act(async () => { CN首页.reject(new Error('网络错误')); });
    let 输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.项们).toEqual(['loc_TW', 'loc_HK', 'loc_MO']);
    expect(输出.加载中).toBe(false);
    expect(输出.还有).toBe(true);

    // 重试只补 CN 的首页（无游标），成功后聚合按国家顺序补上
    await act(async () => { 加载更多外!(); });
    const 调用 = (查询 as unknown as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
    expect(调用).toHaveLength(5);
    expect(调用[4]![0]).toEqual({ countryCode: 'CN', limit: 20 });
    输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.项们).toEqual(['loc_cn1', 'loc_TW', 'loc_HK', 'loc_MO']);
    expect(输出.还有).toBe(false);
  });

  // spec §6.1：沿用旧默认目录「失败给轻提示」的交互 —— 首页与加载更多失败同路提示
  // （旧实现两条路径都提示）；代际守卫让卸载/禁用后的迟到失败不再提示。
  it('一支首页失败：轻提示失败文案，其他支结果与可重试状态不变', async () => {
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 项们, 还有 } = use城市默认页(查询);
      return createElement('output', null, JSON.stringify({ 项们: 项们.map((项) => 项.id), 还有 }));
    }

    const CN首页 = deferred<页形>();
    const 查询 = vi.fn(async (q: { countryCode?: string }) => {
      if (q.countryCode === 'CN') return CN首页.promise;
      return { items: [条目({ id: `loc_${q.countryCode}`, display_name: q.countryCode!, country_code: q.countryCode! })], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    清空轻提示();
    const { container } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { CN首页.reject(new Error('网络错误')); });
    // 失败反馈与交互都沿用旧实现：提示文案落轻提示，分支保留可重试（还有=true）
    expect(轻提示条数()).toBe(1);
    expect(document.body.textContent).toContain('请求失败，请稍后再试');
    expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual({
      项们: ['loc_TW', 'loc_HK', 'loc_MO'],
      还有: true,
    });
  });

  it('加载更多失败：同样轻提示失败文案', async () => {
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 项们, 还有, 加载更多 } = use城市默认页(查询);
      加载更多外 = () => void 加载更多();
      return createElement('output', null, JSON.stringify({ 项们: 项们.map((项) => 项.id), 还有 }));
    }

    const CN追加 = deferred<页形>();
    const 查询 = vi.fn(async (q: { countryCode?: string; cursor?: string }) => {
      if (q.cursor === 'cn_1') return CN追加.promise;
      if (q.countryCode === 'CN') return { items: [条目({ id: 'loc_cn1', display_name: '广州市', country_code: 'CN' })], nextCursor: 'cn_1', catalogVersion: 'v2' };
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    清空轻提示();
    const { container } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    expect(轻提示条数()).toBe(0);
    await act(async () => { 加载更多外!(); });
    await act(async () => { CN追加.reject(new Error('网络错误')); });
    expect(轻提示条数()).toBe(1);
    expect(document.body.textContent).toContain('请求失败，请稍后再试');
    // 失败不伪造完成：还有仍 true，可重试
    expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual({ 项们: ['loc_cn1'], 还有: true });
  });

  it('禁用查询后代际作废：迟到的失败不提示', async () => {
    function 探针({ 查询 }: { 查询: 查询Location方法 | undefined }) {
      const { 项们 } = use城市默认页(查询);
      return createElement('output', null, JSON.stringify({ 项们: 项们.map((项) => 项.id) }));
    }

    const CN首页 = deferred<页形>();
    const 查询 = vi.fn(async (q: { countryCode?: string }) => {
      if (q.countryCode === 'CN') return CN首页.promise;
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    清空轻提示();
    const { rerender } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    rerender(createElement(探针, { 查询: undefined }));
    await act(async () => { CN首页.reject(new Error('网络错误')); });
    expect(轻提示条数()).toBe(0);
  });

  it('卸载后迟到的失败不提示也不报错', async () => {
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 项们 } = use城市默认页(查询);
      return createElement('output', null, JSON.stringify({ 项们: 项们.map((项) => 项.id) }));
    }

    const CN首页 = deferred<页形>();
    const 查询 = vi.fn(async (q: { countryCode?: string }) => {
      if (q.countryCode === 'CN') return CN首页.promise;
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    清空轻提示();
    const { unmount } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    unmount();
    await act(async () => { CN首页.reject(new Error('网络错误')); });
    expect(轻提示条数()).toBe(0);
  });

  it('追加页失败保留原游标，重试同一游标成功', async () => {
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 项们, 还有, 加载更多 } = use城市默认页(查询);
      加载更多外 = () => void 加载更多();
      return createElement('output', null, JSON.stringify({ 项们: 项们.map((项) => 项.id), 还有 }));
    }

    let CN追加次数 = 0;
    const 查询 = vi.fn(async (q: { countryCode?: string; cursor?: string }) => {
      if (q.cursor === 'cn_1') {
        CN追加次数 += 1;
        if (CN追加次数 === 1) throw new Error('网络错误');
        return { items: [条目({ id: 'loc_cn2', display_name: '深圳市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: null, catalogVersion: 'v2' };
      }
      if (q.countryCode === 'CN') return { items: [条目({ id: 'loc_cn1', display_name: '广州市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: 'cn_1', catalogVersion: 'v2' };
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { 加载更多外!(); });
    // 失败：不写 null 游标伪造完成，还有仍 true
    expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual({ 项们: ['loc_cn1'], 还有: true });
    // 重试：同一游标再来
    await act(async () => { 加载更多外!(); });
    const 输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.项们).toEqual(['loc_cn1', 'loc_cn2']);
    expect(输出.还有).toBe(false);
  });

  it('追加页换版本：只重开该支首页（强制刷新）；重开失败保留「需从首页重开」，下次从首页再试', async () => {
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 项们, 还有, 加载更多 } = use城市默认页(查询);
      加载更多外 = () => void 加载更多();
      return createElement('output', null, JSON.stringify({ 项们: 项们.map((项) => 项.id), 还有 }));
    }

    let CN首页次数 = 0;
    const 查询 = vi.fn(async (q: { countryCode?: string; cursor?: string }) => {
      if (q.cursor === 'cn_1') {
        // 带旧版本游标的追加页：目录已换代
        return { items: [条目({ id: 'loc_cn_old', display_name: '旧页', country_code: 'CN' })], nextCursor: 'dead_cur', catalogVersion: 'v3' };
      }
      if (q.countryCode === 'CN') {
        CN首页次数 += 1;
        if (CN首页次数 === 1) return { items: [条目({ id: 'loc_cn1', display_name: '广州市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: 'cn_1', catalogVersion: 'v2' };
        if (CN首页次数 === 2) throw new Error('重开失败');
        return { items: [条目({ id: 'loc_cn1_v3', display_name: '广州市新版', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: null, catalogVersion: 'v3' };
      }
      return { items: [条目({ id: `loc_${q.countryCode}`, display_name: q.countryCode!, country_code: q.countryCode! })], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { 加载更多外!(); });
    // 版本换代：该支旧累计页/旧游标丢弃；重读失败 → 保留「需从首页重开」，其他支不重开
    expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual({
      项们: ['loc_TW', 'loc_HK', 'loc_MO'],
      还有: true,
    });
    const 调用 = (查询 as unknown as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
    const CN强制刷新调用 = 调用.find(
      (单调用) => (单调用[0] as { countryCode?: string }).countryCode === 'CN'
        && (单调用[1] as { 强制刷新?: boolean } | undefined)?.强制刷新 === true,
    );
    expect(CN强制刷新调用).toBeTruthy();
    expect(CN强制刷新调用![0]).toEqual({ countryCode: 'CN', limit: 20 });

    // 下次加载更多：从该支首页再试（不拿旧游标，不带强制刷新）
    await act(async () => { 加载更多外!(); });
    const 最后调用 = 调用.at(-1)!;
    expect(最后调用[0]).toEqual({ countryCode: 'CN', limit: 20 });
    await act(async () => { await Promise.resolve(); });
    expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual({
      项们: ['loc_cn1_v3', 'loc_TW', 'loc_HK', 'loc_MO'],
      还有: false,
    });
  });

  it('跨国家响应整页拒收：提示且不提交，分支保留可重试状态', async () => {
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 项们, 还有, 加载更多 } = use城市默认页(查询);
      加载更多外 = () => void 加载更多();
      return createElement('output', null, JSON.stringify({ 项们: 项们.map((项) => 项.id), 还有 }));
    }

    let CN首页次数 = 0;
    const 查询 = vi.fn(async (q: { countryCode?: string }) => {
      if (q.countryCode === 'CN') {
        CN首页次数 += 1;
        if (CN首页次数 === 1) {
          // 异常响应：请求 CN 却混入他国项 —— 整页不提交
          return { items: [条目({ id: 'loc_us', display_name: 'New York City', country_code: 'US' })], nextCursor: 'cn_1', catalogVersion: 'v2' };
        }
        return { items: [条目({ id: 'loc_cn1', display_name: '广州市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: null, catalogVersion: 'v2' };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual({ 项们: [], 还有: true });
    expect(document.body.textContent).toContain('城市目录数据异常，请重试');

    // 该支游标不被信任：重试仍从首页开始
    await act(async () => { 加载更多外!(); });
    const 最后调用 = ((查询 as unknown as ReturnType<typeof vi.fn>).mock.calls as unknown[][]).at(-1)!;
    expect(最后调用[0]).toEqual({ countryCode: 'CN', limit: 20 });
    await act(async () => { await Promise.resolve(); });
    expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual({ 项们: ['loc_cn1'], 还有: false });
  });

  it('禁用查询后代际作废：迟到结果与 finally 不提交、不覆盖新状态', async () => {
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 | undefined }) {
      const { 项们, 加载中, 还有, 加载更多 } = use城市默认页(查询);
      加载更多外 = () => void 加载更多();
      return createElement('output', null, JSON.stringify({ 项们: 项们.map((项) => 项.id), 加载中, 还有 }));
    }

    const CN首页 = deferred<页形>();
    const 查询 = vi.fn(async (q: { countryCode?: string }) => {
      if (q.countryCode === 'CN') return CN首页.promise;
      return { items: [条目({ id: `loc_${q.countryCode}`, display_name: q.countryCode!, country_code: q.countryCode! })], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    const { container, rerender } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    // 查询被禁用（Backend → Mock 切换）：代际递增
    rerender(createElement(探针, { 查询: undefined }));
    await act(async () => {
      CN首页.resolve({ items: [条目({ id: 'loc_cn1', display_name: '广州市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: null, catalogVersion: 'v2' });
    });
    // 迟到的完成不提交；迟到的 finally 不再改加载态
    // 查询禁用后没有可取的默认页：还有 随之归 false（不再驱动死按钮）
    expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual({ 项们: [], 加载中: false, 还有: false });
    // 禁用后加载更多是空操作
    await act(async () => { 加载更多外!(); });
    expect(((查询 as unknown as ReturnType<typeof vi.fn>).mock.calls as unknown[][])).toHaveLength(4);
  });

  it('卸载后迟到结果不提交也不报错', async () => {
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 项们 } = use城市默认页(查询);
      return createElement('output', null, JSON.stringify({ 项们: 项们.map((项) => 项.id) }));
    }

    const CN首页 = deferred<页形>();
    const 查询 = vi.fn(async (q: { countryCode?: string }) => {
      if (q.countryCode === 'CN') return CN首页.promise;
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    const { unmount } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    unmount();
    await act(async () => {
      CN首页.resolve({ items: [条目({ id: 'loc_cn1', display_name: '广州市', country_code: 'CN' })], nextCursor: null, catalogVersion: 'v2' });
    });
  });
});

// ── Task 4：按行政区分组 ──

describe('按行政区分组（Task 4 四国默认目录）', () => {
  const 广州 = 条目({ id: 'loc_gz', display_name: '广州市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' });
  const 深圳 = 条目({ id: 'loc_sz', display_name: '深圳市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' });
  const 杭州 = 条目({ id: 'loc_hz', display_name: '杭州市', country_code: 'CN', admin1_code: '33', admin1_name: '浙江省' });
  const 台北 = 条目({ id: 'loc_tpe', display_name: 'Taipei', country_code: 'TW', admin1_code: 'TPE', admin1_name: 'Taipei' });
  const 香港 = 条目({ id: 'loc_hk', display_name: 'Hong Kong', country_code: 'HK', admin1_code: 'HK1', admin1_name: 'Hong Kong' });
  const 澳门 = 条目({ id: 'loc_mo', display_name: 'Macau', country_code: 'MO' });

  it('CN 按 admin1_code 聚合，标题取非空 admin1_name，组顺序按 code 稳定', () => {
    const 组们 = 按行政区分组([广州, 杭州, 深圳]);
    expect(组们.map((组) => 组.键)).toEqual(['浙江省', '广东省']);
    expect(组们[1]!.城市们.map((项) => 项.display_name)).toEqual(['广州市', '深圳市']);
  });

  it('TW/HK/MO 无视 admin1 细分，键固定三个中文标题，组内保留 display_name', () => {
    const 组们 = 按行政区分组([台北, 香港, 澳门, 广州]);
    expect(组们.map((组) => 组.键)).toEqual(['广东省', '台湾省', '香港特别行政区', '澳门特别行政区']);
    expect(组们[0]!.城市们.map((项) => 项.display_name)).toEqual(['广州市']);
    expect(组们[1]!.城市们.map((项) => 项.id)).toEqual(['loc_tpe']);
  });

  it('缺行政区信息的项不编造分组', () => {
    const 泉州 = 条目({ id: 'loc_qs', display_name: 'Quanzhou', country_code: 'CN' });
    expect(按行政区分组([泉州])).toEqual([]);
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

    const A第二页 = deferred<页形>();
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

describe('use城市搜索 catalogVersion 重同步（review-cx F5）', () => {
  it('搜索追加页换版本：结果整组替换为新版本第一页', async () => {
    let 设词外: ((v: string) => void) | null = null;
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 设词, 结果, 加载更多 } = use城市搜索(查询);
      设词外 = 设词;
      加载更多外 = () => void 加载更多();
      return createElement('output', null, JSON.stringify({ 结果: 结果.map((r) => r.id) }));
    }

    let 首页调用 = 0;
    const 查询 = vi.fn(async (q: { q?: string; cursor?: string }) => {
      if (q.cursor === 'a_cur_1') {
        return {
          items: [{ id: 'loc_a_old', display_name: 'A旧页' } as BFFLocationItem],
          nextCursor: 'dead' as string | null,
          catalogVersion: 'v3',
        };
      }
      首页调用 += 1;
      if (首页调用 === 1) {
        return {
          items: [{ id: 'loc_a1', display_name: 'A城' } as BFFLocationItem],
          nextCursor: 'a_cur_1' as string | null,
          catalogVersion: 'v2',
        };
      }
      return {
        items: [{ id: 'loc_a1_v3', display_name: 'A城新版' } as BFFLocationItem],
        nextCursor: null,
        catalogVersion: 'v3',
      };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    act(() => 设词外!('A'));
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(JSON.parse(container.querySelector('output')!.textContent!).结果).toEqual(['loc_a1']);

    // 加载更多：追加页 v3 → 结果整组替换为新版本第一页，不跨版本拼接
    await act(async () => { 加载更多外!(); });
    expect(JSON.parse(container.querySelector('output')!.textContent!).结果).toEqual(['loc_a1_v3']);
  });
});

// ── review-cx F5：分组按 catalogVersion 静默重同步（既有合同，Task 4 不启用不改动）──
describe('use城市分组 catalogVersion 重同步（review-cx F5）', () => {
  it('分组追加页换版本：整组丢弃旧页与游标，从该组第一页重开', async () => {
    let 切换外: (() => void) | null = null;
    let 加载更多外: (() => void) | null = null;
    let 读取状态: (() => { items: string[]; 还有: boolean }) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 状态表, 切换展开, 加载更多 } = use城市分组(查询);
      const 组 = { 省: '广东', filters: [{ countryCode: 'CN', admin1Code: '44' }] };
      切换外 = () => 切换展开(组);
      加载更多外 = () => void 加载更多(组);
      读取状态 = () => {
        const 状态 = 状态表['广东'];
        return { items: (状态?.items ?? []).map((项) => 项.id), 还有: 状态?.还有 ?? false };
      };
      return createElement('output', null, '');
    }

    let 首页调用 = 0;
    const 查询 = vi.fn(async (q: { admin1Code?: string; cursor?: string }) => {
      if (q.cursor === 'gd_cur_1') {
        return {
          items: [{ id: 'loc_old', display_name: '旧页' } as BFFLocationItem],
          nextCursor: 'dead' as string | null,
          catalogVersion: 'v3',
        };
      }
      首页调用 += 1;
      if (首页调用 === 1) {
        return {
          items: [{ id: 'loc_gz', display_name: '广州' } as BFFLocationItem],
          nextCursor: 'gd_cur_1' as string | null,
          catalogVersion: 'v2',
        };
      }
      return {
        items: [{ id: 'loc_gz_v3', display_name: '广州新版' } as BFFLocationItem],
        nextCursor: null,
        catalogVersion: 'v3',
      };
    }) as unknown as 查询Location方法;

    render(createElement(探针, { 查询 }));
    await act(async () => { 切换外!(); });
    expect(读取状态!()).toEqual({ items: ['loc_gz'], 还有: true });

    // 展开加载更多：追加页 v3 → 整组重开为新版本第一页（旧页与死游标一并丢弃）
    await act(async () => { 加载更多外!(); });
    expect(读取状态!()).toEqual({ items: ['loc_gz_v3'], 还有: false });
  });
});

// ── review-cx-r2 F5-R2：多 filter 分组的版本按 filter 记（版本们 与 游标们 对齐）──
describe('use城市分组 多 filter 版本们（review-cx-r2）', () => {
  it('双 filter 各自版本稳定：追加按各自首页版本比对，正常合并不误判重启', async () => {
    let 切换外: (() => void) | null = null;
    let 加载更多外: (() => void) | null = null;
    let 读取状态: (() => { items: string[]; 还有: boolean }) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 状态表, 切换展开, 加载更多 } = use城市分组(查询);
      const 组 = { 省: '双省', filters: [{ countryCode: 'CN', admin1Code: '44' }, { countryCode: 'CN', admin1Code: '33' }] };
      切换外 = () => 切换展开(组);
      加载更多外 = () => void 加载更多(组);
      读取状态 = () => {
        const 状态 = 状态表['双省'];
        return { items: (状态?.items ?? []).map((项) => 项.id), 还有: 状态?.还有 ?? false };
      };
      return createElement('output', null, '');
    }

    // 44（粤）恒 v2，33（浙）恒 v3：各 filter 版本跨页稳定但互不相同
    const 查询 = vi.fn(async (q: { admin1Code?: string; cursor?: string }) => {
      const 是粤 = q.admin1Code === '44';
      if (q.cursor) {
        return {
          items: [{ id: 是粤 ? 'gz2' : 'hz2', display_name: '追加' } as BFFLocationItem],
          nextCursor: null,
          catalogVersion: 是粤 ? 'v2' : 'v3',
        };
      }
      return {
        items: [{ id: 是粤 ? 'gz' : 'hz', display_name: '首页' } as BFFLocationItem],
        nextCursor: (是粤 ? 'gd_cur' : 'zj_cur') as string | null,
        catalogVersion: 是粤 ? 'v2' : 'v3',
      };
    }) as unknown as 查询Location方法;

    const { 查询: 查询记录 } = { 查询 } as never as { 查询: ReturnType<typeof vi.fn> };
    render(createElement(探针, { 查询 }));
    await act(async () => { 切换外!(); });
    const 首页调用数 = () => 查询记录.mock.calls.filter(([q]) => !(q as { cursor?: string }).cursor).length;
    // 展开后提交了各 filter 的首页（并发版本不一致的病态服务端按上限重取后仍不一致，
    // 按每 filter 各自版本提交）
    const 展开后首页调用 = 首页调用数();
    expect(展开后首页调用).toBeGreaterThanOrEqual(2);
    expect(读取状态!().items).toEqual(['gz', 'hz']);

    // 追加：44 的追加页 v2 对 44 首页 v2、33 的追加页 v3 对 33 首页 v3 —— 不误判换代
    await act(async () => { 加载更多外!(); });
    expect(读取状态!()).toEqual({ items: ['gz', 'hz', 'gz2', 'hz2'], 还有: false });
    // 没有触发整组重开（第一页请求数不再增长）
    expect(首页调用数()).toBe(展开后首页调用);
  });

  it('整个目录真换代：双 filter 追加页集体换版本，仍整组重开为新版本首页', async () => {
    let 切换外: (() => void) | null = null;
    let 加载更多外: (() => void) | null = null;
    let 读取状态: (() => { items: string[]; 还有: boolean }) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 状态表, 切换展开, 加载更多 } = use城市分组(查询);
      const 组 = { 省: '双省', filters: [{ countryCode: 'CN', admin1Code: '44' }, { countryCode: 'CN', admin1Code: '33' }] };
      切换外 = () => 切换展开(组);
      加载更多外 = () => void 加载更多(组);
      读取状态 = () => {
        const 状态 = 状态表['双省'];
        return { items: (状态?.items ?? []).map((项) => 项.id), 还有: 状态?.还有 ?? false };
      };
      return createElement('output', null, '');
    }

    let 换代 = false;
    const 查询 = vi.fn(async (q: { admin1Code?: string; cursor?: string }) => {
      const 是粤 = q.admin1Code === '44';
      if (q.cursor) {
        换代 = true;
        return {
          items: [{ id: '旧快照追加页', display_name: '旧' } as BFFLocationItem],
          nextCursor: null,
          catalogVersion: 'v3',
        };
      }
      if (!换代) {
        return {
          items: [{ id: 是粤 ? 'gz_v2' : 'hz_v2', display_name: '首页' } as BFFLocationItem],
          nextCursor: (是粤 ? 'gd_cur' : 'zj_cur') as string | null,
          catalogVersion: 'v2',
        };
      }
      return {
        items: [{ id: 是粤 ? 'gz_v3' : 'hz_v3', display_name: '首页新' } as BFFLocationItem],
        nextCursor: null,
        catalogVersion: 'v3',
      };
    }) as unknown as 查询Location方法;

    render(createElement(探针, { 查询 }));
    await act(async () => { 切换外!(); });
    expect(读取状态!()).toEqual({ items: ['gz_v2', 'hz_v2'], 还有: true });

    // 追加页集体 v3：对两个 filter 的首页版本都不一致 → 整组重开为新版本首页
    await act(async () => { 加载更多外!(); });
    expect(读取状态!()).toEqual({ items: ['gz_v3', 'hz_v3'], 还有: false });
  });
});

// ── merge 调和：picker Task 2 的 错误/重试 兼容层（四支模型之上）──
// 失败与成功空页分开：任一支失败时聚合列表可继续显示其他成功支 + 行内错误可见 +
// 重试入口；重试 = 分支重试语义（对未完成/失败支各取一页原页，成功且游标尽的支不动）。

describe('use城市默认页 错误与重试（Task 2 兼容层）', () => {
  it('首页失败 → 行内错误可见；重试按分支语义只补失败支首页并清错误', async () => {
    let 重试外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 项们, 错误, 重试 } = use城市默认页(查询);
      重试外 = 重试;
      return createElement('output', null, JSON.stringify({ 项们: 项们.map((项) => 项.id), 错误 }));
    }

    let CN首页次数 = 0;
    const 查询 = vi.fn(async (q: { countryCode?: string }) => {
      if (q.countryCode === 'CN') {
        CN首页次数 += 1;
        if (CN首页次数 === 1) throw new Error('boom');
        return { items: [条目({ id: 'loc_cn1', display_name: '广州市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: null, catalogVersion: 'v2' };
      }
      return { items: [条目({ id: `loc_${q.countryCode}`, display_name: q.countryCode!, country_code: q.countryCode! })], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    let 输出 = JSON.parse(container.querySelector('output')!.textContent!);
    // CN 失败：错误可见（不装成成功空页），其他成功支照常在聚合里
    expect(输出.错误).toBe('请求失败，请稍后再试');
    expect(输出.项们).toEqual(['loc_TW', 'loc_HK', 'loc_MO']);

    // 重试 = 分支重试语义：只补 CN 的首页（成功且游标尽的其他支不再请求）
    await act(async () => { 重试外!(); await Promise.resolve(); });
    const 调用 = (查询 as unknown as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
    expect(调用).toHaveLength(5);
    expect(调用[4]![0]).toEqual({ countryCode: 'CN', limit: 20 });
    输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.错误).toBeNull();
    expect(输出.项们).toEqual(['loc_cn1', 'loc_TW', 'loc_HK', 'loc_MO']);
  });

  it('追加失败保留已有项与原游标、行内错误可见；继续加载更多仍用原游标', async () => {
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 项们, 错误, 加载更多 } = use城市默认页(查询);
      加载更多外 = () => void 加载更多();
      return createElement('output', null, JSON.stringify({ 项们: 项们.map((项) => 项.id), 错误 }));
    }

    let CN追加次数 = 0;
    const 查询 = vi.fn(async (q: { countryCode?: string; cursor?: string }) => {
      if (q.cursor === 'cn_1') {
        CN追加次数 += 1;
        if (CN追加次数 === 1) throw new Error('boom');
        return { items: [条目({ id: 'loc_cn2', display_name: '深圳市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: null, catalogVersion: 'v2' };
      }
      if (q.countryCode === 'CN') return { items: [条目({ id: 'loc_cn1', display_name: '广州市', country_code: 'CN', admin1_code: '44', admin1_name: '广东省' })], nextCursor: 'cn_1', catalogVersion: 'v2' };
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { 加载更多外!(); });
    // 追加失败：行内错误可见，已有项与游标都保留（不装成成功空页、不丢页）
    let 输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.错误).toBe('请求失败，请稍后再试');
    expect(输出.项们).toEqual(['loc_cn1']);
    // 再次加载更多：仍用原游标，成功后错误清空
    await act(async () => { 加载更多外!(); });
    expect((查询 as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      (单调用) => (单调用[0] as { cursor?: string }).cursor === 'cn_1',
    )).toHaveLength(2);
    输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.错误).toBeNull();
    expect(输出.项们).toEqual(['loc_cn1', 'loc_cn2']);
  });
});

describe('use城市搜索 错误与重试（Task 2 兼容层）', () => {
  it('首页失败 → 错误文案可见；重试用当前词重发并清错误', async () => {
    let 设词外: ((v: string) => void) | null = null;
    let 重试外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 设词, 结果, 错误, 重试 } = use城市搜索(查询);
      设词外 = 设词;
      重试外 = 重试;
      return createElement('output', null, JSON.stringify({ 结果: 结果.map((r) => r.id), 错误 }));
    }

    let 调用 = 0;
    const 查询 = vi.fn(async (_query: { q?: string }) => {
      调用 += 1;
      if (调用 === 1) throw new Error('boom');
      return {
        items: [{ id: 'loc_hz', display_name: '杭州市' } as BFFLocationItem],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    act(() => 设词外!('杭州市'));
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    let 输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.错误).toBe('请求失败，请稍后再试');
    expect(输出.结果).toEqual([]);

    // 重试：同一当前词重发（第二次调用成功）。点击与等待分两个 act：
    // 合并在一个 async act 里 effect 要等 act 收尾才重跑，debounce 会落在等待窗口之外
    await act(async () => { 重试外!(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect((查询 as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((调用) => 调用[0].q === '杭州市')).toHaveLength(2);
    输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.错误).toBeNull();
    expect(输出.结果).toEqual(['loc_hz']);
  });

  it('分页失败保留已有结果与当前游标，错误可见；再次加载更多仍用原游标', async () => {
    let 设词外: ((v: string) => void) | null = null;
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 设词, 结果, 错误, 加载更多 } = use城市搜索(查询);
      设词外 = 设词;
      加载更多外 = () => void 加载更多();
      return createElement('output', null, JSON.stringify({ 结果: 结果.map((r) => r.id), 错误 }));
    }

    let 追加调用 = 0;
    const 查询 = vi.fn(async (q: { q?: string; cursor?: string }) => {
      if (q.cursor) {
        追加调用 += 1;
        if (追加调用 === 1) throw new Error('boom');
        return {
          items: [{ id: 'loc_a2', display_name: 'A城2' } as BFFLocationItem],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return {
        items: [{ id: 'loc_a1', display_name: 'A城' } as BFFLocationItem],
        nextCursor: 'a_cur_1' as string | null,
        catalogVersion: 'v2',
      };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    act(() => 设词外!('A'));
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(JSON.parse(container.querySelector('output')!.textContent!).结果).toEqual(['loc_a1']);

    // 追加页失败：错误可见，结果与游标都保留
    await act(async () => { 加载更多外!(); });
    let 输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.错误).toBe('请求失败，请稍后再试');
    expect(输出.结果).toEqual(['loc_a1']);
    // 再次加载更多：仍用原游标（不装成成功空页、不丢页）
    await act(async () => { 加载更多外!(); });
    expect((查询 as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((调用) => 调用[0].cursor === 'a_cur_1')).toHaveLength(2);
    输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.错误).toBeNull();
    expect(输出.结果).toEqual(['loc_a1', 'loc_a2']);
  });
});
