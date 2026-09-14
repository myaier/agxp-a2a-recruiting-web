// 行业目录钩子 测试（picker 统一 Task 1）：
// 具体行业目录控制器 —— 注入 查询行业页（Mock 字典 / HTTP DTO 适配）与 目录身份，
// 管理 根页 / 展开缓存 / 分页游标 / 请求去重 / 迟到作废 / 换代失效 / 重试。
// 行为契约（Plan 2026-09-14 Task 1）：
//   · 展开 A→收起→再展开 只发一次请求（缓存保留）；
//   · 加载中收起 A，resolve 后仍关闭（在飞收起可缓存不重开）；
//   · 收起递归清后代可见展开状态但保留缓存；
//   · 请求去重；目录换代：旧缓存/游标/迟到响应整体作废，不跨版本合并；
//   · 根/子首载失败显示错误并可重试；分页失败保留游标可再点；
//   · 目录身份变更作废旧缓存并重取。

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { use行业目录, 创建模拟行业查询, 模拟行业名, 模拟行业键们, 创建目录行业查询 } from './行业目录钩子';
import type { 行业页 } from '../组件/行业分类列表';

/** 构造一页目录返回 */
function 页(项: 行业页['项'], 下一页: string | null, 版本: string): 行业页 {
  return { 项, 下一页, 版本 };
}

const 根项A = { 键: 'A', 名称: '行业A', 可选: false, 有子项: true };
const 根项B = { 键: 'B', 名称: '行业B', 可选: false, 有子项: false };

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('use行业目录 展开与缓存', () => {
  it('挂载拉根页；展开 A→收起→再展开 只发一次子请求（缓存保留）', async () => {
    const 查询 = vi.fn(async (父键: string | null): Promise<行业页> =>
      父键 === null
        ? 页([根项A, 根项B], null, 'v1')
        : 页([{ 键: 'a1', 名称: '子项a1', 可选: true, 有子项: false }], null, 'v1'),
    );
    const { result } = renderHook(() => use行业目录({ 查询, 目录身份: 'backend:sub1' }));
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    expect(result.current.行.map((行) => 行.键)).toEqual(['A', 'B']);

    await act(async () => result.current.切换展开('A'));
    await waitFor(() => expect(查询).toHaveBeenCalledTimes(2));
    expect(result.current.行.find((行) => 行.键 === 'a1')).toBeTruthy();

    // 收起：缓存保留，再展开不发新请求
    await act(async () => result.current.切换展开('A'));
    expect(result.current.行.map((行) => 行.键)).toEqual(['A', 'B']);
    await act(async () => result.current.切换展开('A'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'a1')).toBeTruthy());
    expect(查询).toHaveBeenCalledTimes(2);
  });

  it('请求去重：分页加载中重复点击只发一次', async () => {
    const { promise: 慢, resolve: 慢Resolve } = deferred<行业页>();
    let 分页调用 = 0;
    const 查询 = vi.fn(async (父键: string | null, 游标: string | null): Promise<行业页> => {
      if (父键 === null) return 页([根项A], null, 'v1');
      if (游标 === null) return 页([{ 键: 'a1', 名称: '子项a1', 可选: true, 有子项: false }], '子游标1', 'v1');
      分页调用 += 1;
      return 慢;
    });
    const { result } = renderHook(() => use行业目录({ 查询, 目录身份: 'backend:sub1' }));
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    await act(async () => result.current.切换展开('A'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'a1')).toBeTruthy());
    // 分页在飞时同步双击：只发一次
    await act(async () => {
      result.current.加载更多('A');
      result.current.加载更多('A');
    });
    expect(分页调用).toBe(1);
    act(() => 慢Resolve(页([], null, 'v1')));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'A')!.可加载更多).toBe(false));
    expect(查询).toHaveBeenCalledTimes(3);
  });

  it('加载中收起 A，resolve 后仍关闭；再展开用缓存不重开', async () => {
    const { promise: 慢, resolve: 慢Resolve } = deferred<行业页>();
    const 查询 = vi.fn(async (父键: string | null): Promise<行业页> =>
      父键 === null ? 页([根项A], null, 'v1') : 慢,
    );
    const { result } = renderHook(() => use行业目录({ 查询, 目录身份: 'backend:sub1' }));
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    await act(async () => result.current.切换展开('A'));
    await act(async () => result.current.切换展开('A')); // 在飞时收起
    act(() => 慢Resolve(页([{ 键: 'a1', 名称: '子项a1', 可选: true, 有子项: false }], null, 'v1')));
    await waitFor(() => expect(查询).toHaveBeenCalledTimes(2));
    // 仍关闭
    expect(result.current.行.map((行) => 行.键)).toEqual(['A']);
    // 再展开走缓存，不发新请求
    await act(async () => result.current.切换展开('A'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'a1')).toBeTruthy());
    expect(查询).toHaveBeenCalledTimes(2);
  });

  it('收起递归清掉后代可见展开状态但保留缓存：再展开 A 后再展开 a1 不重发请求', async () => {
    const 查询 = vi.fn(async (父键: string | null): Promise<行业页> => {
      if (父键 === null) return 页([根项A], null, 'v1');
      if (父键 === 'A') return 页([{ 键: 'a1', 名称: '子项a1', 可选: false, 有子项: true }], null, 'v1');
      if (父键 === 'a1') return 页([{ 键: 'g1', 名称: '孙项g1', 可选: true, 有子项: false }], null, 'v1');
      return 页([], null, 'v1');
    });
    const { result } = renderHook(() => use行业目录({ 查询, 目录身份: 'backend:sub1' }));
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    await act(async () => result.current.切换展开('A'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'a1')).toBeTruthy());
    await act(async () => result.current.切换展开('a1'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'g1')).toBeTruthy());
    // 收起 A：a1/g1 的可见展开状态一并清掉
    await act(async () => result.current.切换展开('A'));
    expect(result.current.行.map((行) => 行.键)).toEqual(['A']);
    // 再展开 A：a1 缓存仍在（a1 不重发），g1 缓存仍在
    await act(async () => result.current.切换展开('A'));
    await act(async () => result.current.切换展开('a1'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'g1')).toBeTruthy());
    expect(查询).toHaveBeenCalledTimes(3);
  });
});

describe('行业目录钩子 分页与失败重试', () => {
  it('根分页失败：游标保留，可再点重试并追加成功', async () => {
    let 拒首次 = true;
    const 查询 = vi.fn(async (父键: string | null, 游标: string | null): Promise<行业页> => {
      if (父键 === null && 游标 === null) return 页([根项A], '根游标1', 'v1');
      if (父键 === null) {
        if (拒首次) {
          拒首次 = false;
          throw new Error('network down');
        }
        return 页([根项B], null, 'v1');
      }
      return 页([], null, 'v1');
    });
    const { result } = renderHook(() => use行业目录({ 查询, 目录身份: 'backend:sub1' }));
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    expect(result.current.根可加载更多).toBe(true);
    await act(async () => result.current.加载更多(null));
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    // 失败：根页不动、游标仍在，可再点
    expect(result.current.根可加载更多).toBe(true);
    await act(async () => result.current.加载更多(null));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'B')).toBeTruthy());
  });

  it('子首载失败：行错误 + 重试入口，重试重发并成功', async () => {
    let 拒首次 = true;
    const 查询 = vi.fn(async (父键: string | null): Promise<行业页> => {
      if (父键 === null) return 页([根项A], null, 'v1');
      if (拒首次) {
        拒首次 = false;
        throw new Error('network down');
      }
      return 页([{ 键: 'a1', 名称: '子项a1', 可选: true, 有子项: false }], null, 'v1');
    });
    const { result } = renderHook(() => use行业目录({ 查询, 目录身份: 'backend:sub1' }));
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    await act(async () => result.current.切换展开('A'));
    await waitFor(() => {
      const a行 = result.current.行.find((行) => 行.键 === 'A');
      expect(a行?.错误).toBe('请求失败，请稍后再试');
    });
    await act(async () => result.current.重试('A'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'a1')).toBeTruthy());
  });

  it('子分页失败：游标保留可重试；成功空页与失败区分（空=空标志、失败=错误）', async () => {
    let 分页调用 = 0;
    const 查询 = vi.fn(async (父键: string | null, 游标: string | null): Promise<行业页> => {
      if (父键 === null) return 页([根项A], null, 'v1');
      if (父键 === 'A' && 游标 === null) {
        return 页([{ 键: 'a1', 名称: '子项a1', 可选: true, 有子项: false }], '子游标1', 'v1');
      }
      分页调用 += 1;
      if (分页调用 === 1) throw new Error('network down');
      return 页([], null, 'v1');
    });
    const { result } = renderHook(() => use行业目录({ 查询, 目录身份: 'backend:sub1' }));
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    await act(async () => result.current.切换展开('A'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'a1')).toBeTruthy());
    expect(result.current.行.find((行) => 行.键 === 'A')!.可加载更多).toBe(true);
    await act(async () => result.current.加载更多('A'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'A')!.加载中).toBe(false));
    // 失败不动列表，游标仍在，可再点重试
    expect(result.current.行.find((行) => 行.键 === 'A')!.可加载更多).toBe(true);
    expect(result.current.行.find((行) => 行.键 === 'A')!.错误).toBeNull();
    // 重试成功：这次是成功的空追加页（不是失败）——已选项保留、游标收口、错误清空
    await act(async () => result.current.加载更多('A'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'A')!.可加载更多).toBe(false));
    expect(result.current.行.find((行) => 行.键 === 'A')!.错误).toBeNull();
    expect(result.current.行.find((行) => 行.键 === 'a1')).toBeTruthy();
  });
});

describe('行业目录钩子 目录换代', () => {
  it('子分页换版：不跨版本合并，该父项整组重开、同 ID 子的旧孙缓存作废', async () => {
    const 查询 = vi.fn(async (父键: string | null, 游标: string | null): Promise<行业页> => {
      if (父键 === null) return 页([根项A], null, 'v1');
      if (父键 === 'A') {
        if (游标 === '子游标v1') {
          // 追加页来自新快照：触发该父项整组重开（v2 复用同 ID 子项 a1）
          return 页([{ 键: 'a1', 名称: '子项a1', 可选: false, 有子项: true }], null, 'v2');
        }
        return 页([{ 键: 'a1', 名称: '子项a1', 可选: false, 有子项: true }], '子游标v1', 'v1');
      }
      if (父键 === 'a1') {
        return 页([{ 键: 'g2', 名称: '新孙项', 可选: true, 有子项: false }], null, 'v2');
      }
      return 页([], null, 'v1');
    });
    const { result } = renderHook(() => use行业目录({ 查询, 目录身份: 'backend:sub1' }));
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    await act(async () => result.current.切换展开('A'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'a1')).toBeTruthy());
    await act(async () => result.current.切换展开('a1'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'g2')).toBeTruthy());
    // 子分页换版 → 该父项整组重开、同 ID 子名下的旧孙缓存与展开状态作废
    await act(async () => result.current.加载更多('A'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'g2')).toBeUndefined());
    // 重新展开同 ID 子项：从新版本取孙项（旧孙缓存已作废，重新发请求）
    await act(async () => result.current.切换展开('a1'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'g2')).toBeTruthy());
    expect(查询).toHaveBeenLastCalledWith('a1', null);
  });

  it('根分页换版：根列表整组重开，旧根下的子缓存与展开状态全部作废', async () => {
    const 查询 = vi.fn(async (父键: string | null, 游标: string | null): Promise<行业页> => {
      if (父键 === null && 游标 === null) return 页([根项A], '根游标v1', 'v1');
      if (父键 === null) return 页([{ 键: '旧根', 名称: '旧版本根', 可选: false, 有子项: false }], null, 'v2');
      if (父键 === 'A') return 页([{ 键: 'a1', 名称: '子项a1', 可选: true, 有子项: false }], null, 'v1');
      return 页([], null, 'v1');
    });
    const { result } = renderHook(() => use行业目录({ 查询, 目录身份: 'backend:sub1' }));
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    await act(async () => result.current.切换展开('A'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'a1')).toBeTruthy());
    await act(async () => result.current.加载更多(null));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === '旧根')).toBeTruthy());
    // 旧根 A 名下的展开与子缓存一并作废
    expect(result.current.行.find((行) => 行.键 === 'a1')).toBeUndefined();
    expect(result.current.行.find((行) => 行.键 === 'A')).toBeUndefined();
  });

  it('根分页换版作废在飞子请求：在飞标记随清理释放，窗口内重新展开同键发新请求且数据到达', async () => {
    // 时序（review Important finding）：展开 A 的子请求 deferred 在飞 → 根分页换版把 A
    // 的缓存/展开状态作废（旧子请求未 settle）→ 窗口内重新展开同键 A 不得被旧请求的
    // 在飞标记挡死（否则行展开后既无加载中也无错误/重试，数据永远不来）
    const { promise: 慢, resolve: 慢Resolve } = deferred<行业页>();
    let 子调用 = 0;
    const 查询 = vi.fn(async (父键: string | null, 游标: string | null): Promise<行业页> => {
      if (父键 === null && 游标 === null) return 页([根项A], '根游标1', 'v1');
      if (父键 === null) {
        // 追加页来自新快照：v2 复用同 ID 根 A → 触发根换代、A 的派生状态作废
        return 页([根项A, 根项B], null, 'v2');
      }
      if (父键 === 'A' && 游标 === null) {
        子调用 += 1;
        if (子调用 === 1) return 慢; // 旧代请求在飞（永不主动 settle）
        return 页([{ 键: 'a1', 名称: '子项一', 可选: true, 有子项: false }], null, 'v2');
      }
      return 页([], null, 'v2');
    });
    const { result } = renderHook(() => use行业目录({ 查询, 目录身份: 'backend:sub1' }));
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    // 展开 A：子请求在飞（慢响应未回）
    await act(async () => result.current.切换展开('A'));
    await waitFor(() => expect(查询).toHaveBeenCalledWith('A', null));
    // 根分页换版：根列表重开（v2 复用 A、追加 B），A 的缓存与展开状态作废，旧子请求仍未 settle
    await act(async () => result.current.加载更多(null));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'B')).toBeTruthy());
    expect(result.current.行.find((行) => 行.键 === 'a1')).toBeUndefined();
    // 窗口内重新展开同键 A：不被旧请求的在飞标记挡死（新请求发出）
    await act(async () => result.current.切换展开('A'));
    await waitFor(() => expect(子调用).toBe(2));
    // 新一代数据到达
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'a1')).toBeTruthy());
    // 旧代响应迟到写回：被代际作废，不重挂旧版本条目（a1 仍是新版本行）
    慢Resolve(页([{ 键: 'a1', 名称: '旧子项', 可选: true, 有子项: false }], null, 'v1'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'a1')!.名称).toBe('子项一'));
  });

  it('子分页换版只作废被摘子树：兄弟根 B 的在飞响应正常落缓存，被摘键上新请求不被旧代迟到响应覆盖', async () => {
    // 时序（review Important finding）：同时展开 A/B，B 首页请求 deferred 在飞；
    // A 分页换版（v1→v2）只作废 A 被摘子树（缓存摘除 + 在飞标记释放），不得用全局
    // 代际把兄弟根 B 的在飞响应静默作废 —— 否则 finally 把 B 收尾成「成功空页」，
    // 收起再展开命中空缓存不再发请求，B 永远「暂无内容」（违反 Spec §5.2）。
    const { promise: B慢, resolve: B解决 } = deferred<行业页>();
    const { promise: A分页慢, resolve: A分页解决 } = deferred<行业页>();
    const { promise: a1慢, resolve: a1解决 } = deferred<行业页>();
    let a1调用 = 0;
    const 根B = { 键: 'B', 名称: '行业B', 可选: false, 有子项: true };
    const 查询 = vi.fn(async (父键: string | null, 游标: string | null): Promise<行业页> => {
      if (父键 === null) return 页([根项A, 根B], null, 'v1');
      if (父键 === 'A' && 游标 === null) {
        return 页([{ 键: 'a1', 名称: '子项a1', 可选: false, 有子项: true }], 'a游标', 'v1');
      }
      if (父键 === 'A') return A分页慢; // 分页换版触发点
      if (父键 === 'B') return B慢;
      if (父键 === 'a1') {
        a1调用 += 1;
        return a1调用 === 1 ? a1慢 : 页([{ 键: 'g2', 名称: '新孙项', 可选: true, 有子项: false }], null, 'v2');
      }
      return 页([], null, 'v1');
    });
    const { result } = renderHook(() => use行业目录({ 查询, 目录身份: 'backend:sub1' }));
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    // 同时展开 A 与 B：B 首页请求 deferred 在飞
    await act(async () => {
      result.current.切换展开('B');
      result.current.切换展开('A');
    });
    await waitFor(() => expect(查询).toHaveBeenCalledWith('B', null));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'a1')).toBeTruthy());
    // 展开 a1：旧代孙请求 deferred 在飞
    await act(async () => result.current.切换展开('a1'));
    await waitFor(() => expect(a1调用).toBe(1));
    // A 分页请求在飞 → resolve 出 v2 追加页：触发换版（a1 缓存/展开作废、在飞标记释放）
    await act(async () => result.current.加载更多('A'));
    await act(async () => A分页解决(页([{ 键: 'a1', 名称: '子项a1', 可选: false, 有子项: true }], null, 'v2')));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'a1')!.展开).toBe(false));
    // 被摘键 a1：用户窗口内重新展开 → 新请求发新版本孙项
    await act(async () => result.current.切换展开('a1'));
    await waitFor(() => expect(a1调用).toBe(2));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'g2')).toBeTruthy());
    // A 旧代孙请求迟到：凭逐请求序号作废，不覆盖新请求的缓存
    await act(async () => a1解决(页([{ 键: 'g1', 名称: '旧孙项', 可选: true, 有子项: false }], null, 'v1')));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'g2')).toBeTruthy());
    expect(result.current.行.find((行) => 行.键 === 'g1')).toBeUndefined();
    // B 的迟到响应正常落缓存（不被 A 子树换版误伤）
    await act(async () => B解决(页([{ 键: 'b1', 名称: '子项b1', 可选: true, 有子项: false }], null, 'v1')));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'b1')).toBeTruthy());
    // 收起 B 再展开：缓存保留，不重发请求（修复前命中「成功空页」永远暂无内容）
    await act(async () => result.current.切换展开('B'));
    expect(result.current.行.find((行) => 行.键 === 'b1')).toBeUndefined();
    await act(async () => result.current.切换展开('B'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'b1')).toBeTruthy());
    // 根 + A首页 + a1旧 + A分页 + a1新 + B首页，B 不重发
    expect(查询).toHaveBeenCalledTimes(6);
  });

  it('迟到响应在目录身份变更后不回写：旧主体响应作废，新主体重新拉根页', async () => {
    const { promise: 慢, resolve: 慢Resolve } = deferred<行业页>();
    const 查询 = vi.fn(async (父键: string | null): Promise<行业页> =>
      父键 === null ? 页([根项A], null, 'v1') : 慢,
    );
    const { result, rerender } = renderHook(
      ({ 目录身份 }: { 目录身份: string }) => use行业目录({ 查询, 目录身份 }),
      { initialProps: { 目录身份: 'backend:sub1' } },
    );
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    await act(async () => result.current.切换展开('A'));
    rerender({ 目录身份: 'backend:sub2' });
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    // 旧主体的子项迟到写回：不回写新主体目录
    act(() => 慢Resolve(页([{ 键: 'a1', 名称: '子项a1', 可选: true, 有子项: false }], null, 'v1')));
    expect(result.current.行.find((行) => 行.键 === 'a1')).toBeUndefined();
  });
});

describe('行业目录钩子 三级深度与模拟查询', () => {
  it('三级孙行的 有子项 标记为 达深度上限；根行可达', async () => {
    const 查询 = vi.fn(async (父键: string | null): Promise<行业页> => {
      if (父键 === null) return 页([根项A], null, 'v1');
      if (父键 === 'A') return 页([{ 键: 'a1', 名称: '子项a1', 可选: false, 有子项: true }], null, 'v1');
      if (父键 === 'a1') return 页([{ 键: 'g1', 名称: '孙项g1', 可选: true, 有子项: true }], null, 'v1');
      return 页([], null, 'v1');
    });
    const { result } = renderHook(() => use行业目录({ 查询, 目录身份: 'backend:sub1' }));
    await waitFor(() => expect(result.current.根加载中).toBe(false));
    await act(async () => result.current.切换展开('A'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'a1')).toBeTruthy());
    await act(async () => result.current.切换展开('a1'));
    await waitFor(() => expect(result.current.行.find((行) => 行.键 === 'g1')!.达深度上限).toBe(true));
  });

  it('模拟查询：行业字典根仅展开、细分可选；名称/键互查不按名称作 ID', async () => {
    const 查询 = 创建模拟行业查询();
    const 根页 = await 查询(null, null);
    expect(根页.版本).toBe('mock');
    expect(根页.下一页).toBeNull();
    expect(根页.项[0]).toEqual({ 键: 'mock:industry:0', 名称: '金融科技', 可选: false, 有子项: true });
    const 子页 = await 查询('mock:industry:0', null);
    expect(子页.项[0]).toEqual({ 键: 'mock:industry:0:0', 名称: '支付与清结算', 可选: true, 有子项: false });
    expect(模拟行业名('mock:industry:0:0')).toBe('支付与清结算');
    expect(模拟行业名('mock:industry:1')).toBe('互联网平台');
    expect(模拟行业键们('支付与清结算')).toEqual(['mock:industry:0:0']);
  });
});

describe('创建目录行业查询（HTTP DTO 适配）', () => {
  const 目录页 = (items: unknown[], nextCursor: string | null, catalogVersion: string) => ({
    items,
    nextCursor,
    catalogVersion,
  });

  it('转换 id/display_name/selectable/has_children 与分页游标、版本', async () => {
    const 查询Taxonomy = vi.fn(async () =>
      目录页([{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }], 'cur1', 'v2'),
    );
    const 查询 = 创建目录行业查询(() => 查询Taxonomy as never);
    const 页 = await 查询(null, null);
    expect(页).toEqual({
      项: [{ 键: 'ind_fin', 名称: '金融科技', 可选: false, 有子项: true }],
      下一页: 'cur1',
      版本: 'v2',
    });
  });

  it('追加页换版时用强制刷新重开该父项第一页（不跨版本合并）', async () => {
    const 查询Taxonomy = vi.fn(async (
      _kind: string,
      query: { parentId?: string; cursor?: string },
      选项?: { 强制刷新?: boolean },
    ) => {
      if (query.cursor) {
        // 追加页来自新快照 → 触发重开
        return 目录页([], null, 'v2');
      }
      return 选项?.强制刷新
        ? 目录页([{ id: 'c_new', display_name: '新版本首页项', parent_id: null, selectable: true, has_children: false }], 'cur_v2', 'v2')
        : 目录页([{ id: 'c_old', display_name: '旧版本首页项', parent_id: null, selectable: true, has_children: false }], 'cur_v1', 'v1');
    });
    const 查询 = 创建目录行业查询(() => 查询Taxonomy as never);
    const 首页 = await 查询('r1', null);
    expect(首页.版本).toBe('v1');
    const 追加 = await 查询('r1', 'cur_v1');
    // 换版重开：返回的是该父项新版本第一页
    expect(追加.版本).toBe('v2');
    expect(追加.项[0]!.键).toBe('c_new');
    expect(查询Taxonomy).toHaveBeenCalledWith(
      'industries',
      expect.objectContaining({ parentId: 'r1' }),
      expect.objectContaining({ 强制刷新: true }),
    );
  });
});
