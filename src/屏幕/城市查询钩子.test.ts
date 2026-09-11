// 城市查询钩子 测试（review-r1 P2-2）：stale search response 不覆盖 newer results。
// 两次搜索，第二次先 resolve、第一次后 resolve → 最终结果应是第二次的（不被第一次覆盖）。

import { render } from '@testing-library/react';
import { act } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { use城市搜索, use城市默认页, use城市分组, type 查询Location方法 } from './城市查询钩子';
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

// ── review-cx F5：目录分页按 catalogVersion 静默重同步（冻结合同 2）──
// 同一查询的第一页记录 catalogVersion；追加页返回不同版本时不跨版本合并 ——
// 丢弃该查询累计的旧页与游标，从本查询第一页重开（既有请求路径/加载态，静默无
// 提示），恢复到单一版本且继续可翻页的状态。版本归各自的查询，不跨查询共享。
describe('use城市默认页 catalogVersion 重同步（review-cx F5）', () => {
  it('追加页换版本：不合并旧页，从第一页静默重开并可继续翻页', async () => {
    let 加载更多外: (() => void) | null = null;
    function 探针({ 查询 }: { 查询: 查询Location方法 }) {
      const { 热门项们, 项们, 加载更多 } = use城市默认页(查询);
      加载更多外 = () => void 加载更多();
      return createElement('output', null, JSON.stringify({
        热门: 热门项们.map((项) => 项.id),
        全部: 项们.map((项) => 项.id),
      }));
    }

    let 首页调用 = 0;
    const 查询 = vi.fn(async (q: { cursor?: string }) => {
      if (q.cursor === 'cur_1') {
        // 带旧版本游标的追加页：目录已换代（v3），内容是旧快照的下一页
        return {
          items: [{ id: 'loc_old', display_name: '旧页' } as BFFLocationItem],
          nextCursor: 'dead_cur' as string | null,
          catalogVersion: 'v3',
        };
      }
      if (q.cursor === 'v3_cur_1') {
        return {
          items: [{ id: 'loc_hz_v3', display_name: '杭州市' } as BFFLocationItem],
          nextCursor: null,
          catalogVersion: 'v3',
        };
      }
      首页调用 += 1;
      if (首页调用 === 1) {
        return {
          items: [{ id: 'loc_sh', display_name: '上海市' } as BFFLocationItem],
          nextCursor: 'cur_1' as string | null,
          catalogVersion: 'v2',
        };
      }
      // 重开的第一页：已是 v3
      return {
        items: [{ id: 'loc_sh_v3', display_name: '上海新版' } as BFFLocationItem],
        nextCursor: 'v3_cur_1' as string | null,
        catalogVersion: 'v3',
      };
    }) as unknown as 查询Location方法;

    const { container } = render(createElement(探针, { 查询 }));
    await act(async () => { await Promise.resolve(); });
    let 输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.全部).toEqual(['loc_sh']);

    // 滚到底：追加页返回 v3 → 不跨版本合并（loc_sh / loc_old 都不在），从第一页重开
    await act(async () => { 加载更多外!(); });
    输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.全部).toEqual(['loc_sh_v3']);
    expect(输出.热门).toEqual(['loc_sh_v3']);
    // review-cx-r2：重开请求带 强制刷新（真数据源上会定向失效旧快照缓存，不吃 v2 首页）
    const 原始调用 = (查询 as unknown as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
    expect(原始调用.some((调用) => (调用[1] as { 强制刷新?: boolean } | undefined)?.强制刷新 === true)).toBe(true);

    // 重开后仍是单一版本且继续可翻：新游标 v3_cur_1 的追加页正常合并
    await act(async () => { 加载更多外!(); });
    输出 = JSON.parse(container.querySelector('output')!.textContent!);
    expect(输出.全部).toEqual(['loc_sh_v3', 'loc_hz_v3']);
  });
});

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

// ── review-cx-r2 F5-R2：多 filter 分组的版本按 filter 记（版本们 与 游标们 对齐）──
// 追加页只与同 filter 的第一页版本比对：各 filter 版本各自稳定（哪怕互相不同）时
// 正常合并不误判重启；整个目录真换代（追加页集体换版本）仍整组重开。并发第一页
// 自身版本不一致时不提交混合结果 —— 带缓存失效重取一组一致首页（有上限）。
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
