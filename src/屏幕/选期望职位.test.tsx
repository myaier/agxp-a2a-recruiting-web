// 选期望职位 Backend 接入测试（Task 4）：
// Backend 按需 查询Taxonomy('job-categories')：首次读 roots，展开按 parentId，搜索按 q；
// selectable=true 的叶子原子保存 {id,display_name}+字符串。
// Mock 分支保持本地 职业分类树 不变。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 选期望职位 from './选期望职位';

/** deferred promise：测试可控制异步 resolve 的时机（用于模拟慢响应到达） */
function deferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
}

const mock返回 = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

function render选期望职位(选项: {
  数据源: 'backend' | 'mock';
  来源?: '意向' | null;
  查询Taxonomy?: ReturnType<typeof vi.fn>;
  引导预填?: { 城市们: string[]; 职位: string[]; 城市引用们?: unknown[] } | null;
  意向草稿?: { 期望职位: string };
}) {
  const 派发 = vi.fn();
  mock应用状态 = {
    数据源模式: 选项.数据源,
    目录查询:
      选项.数据源 === 'backend'
        ? {
            查询Location: vi.fn(),
            查询Taxonomy: 选项.查询Taxonomy ?? vi.fn(),
            查询Institution: vi.fn(),
          }
        : null,
    状态: {
      引导预填: 选项.引导预填 === undefined ? { 城市们: ['上海'], 职位: [] } : 选项.引导预填,
      意向草稿: 选项.意向草稿 ?? { 期望职位: '' },
    },
    派发,
  };
  const 初始 = 选项.来源 ? [`/onboard/job?来源=${选项.来源}`] : ['/onboard/job'];
  render(
    <MemoryRouter initialEntries={初始}>
      <选期望职位 />
    </MemoryRouter>,
  );
  return { 派发 };
}

describe('选期望职位 Backend', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('意向来源点 selectable 叶子保存 职位引用', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [
            { id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_tech') {
        return {
          items: [
            { id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    const { 派发 } = render选期望职位({ 数据源: 'backend', 来源: '意向', 查询Taxonomy });
    const 用户 = userEvent.setup();
    // 展开大类
    await 用户.click(await screen.findByText('互联网/AI'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ parentId: 'cat_tech' })));
    // 点 selectable 叶子
    await 用户.click(await screen.findByText('后端开发'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '改意向草稿',
        补丁: expect.objectContaining({
          期望职位: '后端开发',
          职位引用: { id: 'job_be', display_name: '后端开发' },
        }),
      }),
    );
  });

  it('多选来源保存 职位引用们', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [
            { id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_tech') {
        return {
          items: [
            { id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    const { 派发 } = render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(await screen.findByText('互联网/AI'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ parentId: 'cat_tech' })));
    await 用户.click(await screen.findByText('后端开发'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        职位: ['后端开发'],
        职位引用们: [{ id: 'job_be', display_name: '后端开发' }],
      }),
    );
  });

  // review-r1 P2-3：搜索模式下点非 selectable 命中 → 清空搜索词退出搜索模式 →
  // 双栏视图显示其子项，子项可选。
  it('搜索点非 selectable 命中后退出搜索模式显示子项（P2-3）', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [
            { id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.q && query.q.includes('互联') && !query.parentId) {
        return {
          items: [
            { id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_tech') {
        return {
          items: [
            { id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    const { 派发 } = render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    // 等待 roots 加载
    await screen.findByText('互联网/AI');
    // 搜索「互联」→ 搜索结果里出现「互联网/AI」（非 selectable）
    await 用户.type(screen.getByPlaceholderText('搜索职位'), '互联');
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ q: '互联' })));
    await screen.findByText('互联网/AI');
    // 点非 selectable 命中 → 退出搜索模式 → 子项「后端开发」出现且可选
    await 用户.click(screen.getByText('互联网/AI'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ parentId: 'cat_tech' })));
    await screen.findByText('后端开发');
    // 点 selectable 子项 → 保存
    await 用户.click(screen.getByText('后端开发'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        职位: ['后端开发'],
        职位引用们: [{ id: 'job_be', display_name: '后端开发' }],
      }),
    );
  });
  // review-r2 R2-M-3：快速切大类时慢的旧子项不覆盖新的（导航代际守 stale）
  it('快速切大类时旧响应不覆盖新子项（R2-M-3）', async () => {
    const { promise: 慢Promise, resolve: 慢Resolve } = deferredPromise<{ items: unknown[]; nextCursor: null; catalogVersion: string }>();
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string }) => {
      if (!query.parentId && !query.cursor) {
        return {
          items: [
            { id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false },
            { id: 'cat_b', display_name: '大类B', parent_id: null, selectable: false },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_a') {
        // 慢响应——测试控制 resolve 时机
        return 慢Promise;
      }
      if (query.parentId === 'cat_b') {
        return {
          items: [{ id: 'job_b1', display_name: 'B岗位1', parent_id: 'cat_b', selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    // 等 roots 加载（mount 会预选大类A并触发其子项请求，但 A 的响应是慢的）
    await screen.findByText('大类A');
    // 快速切到大类B
    await 用户.click(screen.getByText('大类B'));
    // B 的子项立刻出现
    await screen.findByText('B岗位1');
    // 现在 A 的慢响应到达——不应覆盖 B 的子项
    慢Resolve({
      items: [{ id: 'job_a1', display_name: 'A岗位1（过期）', parent_id: 'cat_a', selectable: true }],
      nextCursor: null,
      catalogVersion: 'v2',
    });
    // 等一下让可能的 state 更新发生
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // B 的子项仍在；A 的过期结果不出现
    expect(screen.getByText('B岗位1')).toBeTruthy();
    expect(screen.queryByText('A岗位1（过期）')).toBeNull();
  });

  // review-r2 R2-M-1：根分页——roots 返回 nextCursor 时可加载更多
  it('根分页返回 nextCursor 时可加载更多（R2-M-1）', async () => {
    let 根调用 = 0;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string }) => {
      if (!query.parentId) {
        根调用 += 1;
        if (根调用 === 1) {
          return {
            items: [{ id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false }],
            nextCursor: 'root_cur_1',
            catalogVersion: 'v2',
          };
        }
        return {
          items: [{ id: 'cat_b', display_name: '大类B', parent_id: null, selectable: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await screen.findByText('大类A');
    // 左栏底部有「加载更多」
    const 加载更多 = await screen.findByRole('button', { name: '加载更多' });
    await 用户.click(加载更多);
    await screen.findByText('大类B');
    expect(screen.getByText('大类A')).toBeTruthy();
    expect(查询Taxonomy).toHaveBeenLastCalledWith('job-categories', expect.objectContaining({ cursor: 'root_cur_1' }));
  });

  // review-r3 R3-Minor-1：Backend 无引导预填时城市回落为空（不写 ['上海']），
  // 否则会落一个无引用的「上海」字符串，看起来像选中但下一步按钮因缺 refs 仍禁用。
  it('无引导预填时保存城市回落为空不是上海（R3-Minor-1）', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [{ id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_tech') {
        return {
          items: [{ id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    const { 派发 } = render选期望职位({ 数据源: 'backend', 查询Taxonomy, 引导预填: null });
    const 用户 = userEvent.setup();
    await 用户.click(await screen.findByText('互联网/AI'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ parentId: 'cat_tech' })));
    await 用户.click(await screen.findByText('后端开发'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        城市们: [],
        城市引用们: [],
      }),
    );
  });

  // review-r3 R3-I-8：子项加载更多在飞行中切大类 → 旧大类的第二页不覆盖新大类的子项
  it('子项加载更多在飞行中切大类时旧页不覆盖新子项（R3-I-8）', async () => {
    const { promise: 慢Promise, resolve: 慢Resolve } = deferredPromise<{ items: unknown[]; nextCursor: string | null; catalogVersion: string }>();
    let 子项调用 = 0;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string }) => {
      if (!query.parentId && !query.cursor) {
        return {
          items: [
            { id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false },
            { id: 'cat_b', display_name: '大类B', parent_id: null, selectable: false },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_a' && !query.cursor) {
        子项调用 += 1;
        return {
          items: [{ id: 'job_a1', display_name: 'A岗位1', parent_id: 'cat_a', selectable: true }],
          nextCursor: 'cat_a_cur_1',
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_a' && query.cursor === 'cat_a_cur_1') {
        // 慢响应——测试控制 resolve 时机
        return 慢Promise;
      }
      if (query.parentId === 'cat_b') {
        return {
          items: [{ id: 'job_b1', display_name: 'B岗位1', parent_id: 'cat_b', selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    // 等 roots 加载（mount 预选大类A并预载 A岗位1）
    await screen.findByText('A岗位1');
    // 点 A 的「加载更多」——慢响应在飞行中
    const 加载更多按钮 = screen.getAllByRole('button', { name: '加载更多' }).find((b) => b.closest(`.${(b.closest('div')?.className) ?? ''}`) !== null) ?? screen.getAllByRole('button', { name: '加载更多' })[0];
    await 用户.click(加载更多按钮);
    // 快速切到大类B
    await 用户.click(screen.getByText('大类B'));
    // B 的子项立刻出现
    await screen.findByText('B岗位1');
    // A 的慢响应到达——不应追加到 B 的子项
    慢Resolve({
      items: [{ id: 'job_a2', display_name: 'A岗位2（过期）', parent_id: 'cat_a', selectable: true }],
      nextCursor: null,
      catalogVersion: 'v2',
    });
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // B 的子项仍在；A 的过期结果不出现
    expect(screen.getByText('B岗位1')).toBeTruthy();
    expect(screen.queryByText('A岗位2（过期）')).toBeNull();
  });
});

describe('选期望职位 Mock', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('本地职业分类树渲染，保存带空引用数组', async () => {
    const { 派发 } = render选期望职位({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 左栏第一枚大类按钮
    await 用户.click(screen.getByText('互联网/AI'));
    // 右栏点一个岗位
    await 用户.click(await screen.findByText('Java'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        职位: ['Java'],
        职位引用们: [],
      }),
    );
  });
});