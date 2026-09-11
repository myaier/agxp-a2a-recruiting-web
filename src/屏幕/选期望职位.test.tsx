// 选期望职位 Backend 接入测试（Task 4 / Task 5）：
// Task 5 起 Backend 与 Mock 共用同一套 Mock JSX（左大类栏 + 右分组卡 + 搜索结果区 + 已选条）。
// 导航依合同的 has_children（可下钻）与 selectable（可写引用）各自独立判断，不写死层数；
// 同名不同 ID 各自独立；翻页只走既有滚动容器，没有「加载更多」节点。

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

/** 在既有滚动容器上触发一次「已到底」滚动事件——不新增任何节点 */
function 滚到底(容器: Element) {
  Object.defineProperty(容器, 'scrollHeight', { value: 1000, configurable: true });
  Object.defineProperty(容器, 'clientHeight', { value: 400, configurable: true });
  Object.defineProperty(容器, 'scrollTop', { value: 600, configurable: true, writable: true });
  fireEvent.scroll(容器);
}

/** 第 n 个既有滚动容器（0=左大类栏，1=右分组栏；搜索态只有一个） */
function 滚动容器(序: number): Element {
  const 全部 = document.querySelectorAll('.滚动区');
  const 容器 = 全部[序];
  if (!容器) throw new Error(`找不到第 ${序} 个既有滚动容器`);
  return 容器;
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
            { id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false, has_children: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_tech') {
        return {
          items: [
            { id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true, has_children: false },
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
            { id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false, has_children: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_tech') {
        return {
          items: [
            { id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true, has_children: false },
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

  // Task 5：真实根 → 中间层 → 可选节点，层数由 has_children 决定，不写死两层
  it('真实根→中间→可选节点逐层下钻后才写引用（Task 5）', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [{ id: 'cat_root', display_name: '技术', parent_id: null, selectable: false, has_children: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_root') {
        return {
          items: [{ id: 'cat_mid', display_name: '后端方向', parent_id: 'cat_root', selectable: false, has_children: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_mid') {
        return {
          items: [{ id: 'job_leaf', display_name: 'Java 工程师', parent_id: 'cat_mid', selectable: true, has_children: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    const { 派发 } = render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    // 中间层出现后点它：只下钻，不能写成引用（保存仍禁用）
    await 用户.click(await screen.findByText('后端方向'));
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
    // 第三层才是可选节点
    await 用户.click(await screen.findByText('Java 工程师'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        职位: ['Java 工程师'],
        职位引用们: [{ id: 'job_leaf', display_name: 'Java 工程师' }],
      }),
    );
  });

  // Task 5：selectable 与 has_children 相互独立——两者都为真时保留导航，不猜选择
  it('selectable 且 has_children 的节点只下钻不写引用（Task 5）', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [{ id: 'cat_root', display_name: '技术', parent_id: null, selectable: false, has_children: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_root') {
        return {
          // 既可选又有下级：现有控件无法同时表达「选此节点 / 继续下钻」→ 保留导航
          items: [{ id: 'cat_both', display_name: '数据', parent_id: 'cat_root', selectable: true, has_children: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_both') {
        return {
          items: [{ id: 'job_de', display_name: '数据工程师', parent_id: 'cat_both', selectable: true, has_children: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(await screen.findByText('数据'));
    // 下钻发生
    await screen.findByText('数据工程师');
    // 没有被当成选择：没有已选条，保存禁用
    expect(screen.queryByText('已选')).toBeNull();
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
  });

  // Task 5：同名不同 ID 独立存在、独立移除
  it('同名不同 ID 的已选条各自独立移除（Task 5）', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [{ id: 'cat_root', display_name: '技术', parent_id: null, selectable: false, has_children: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_root') {
        return {
          items: [
            { id: 'job_a', display_name: '产品经理', parent_id: 'cat_root', selectable: true, has_children: false },
            { id: 'job_b', display_name: '产品经理', parent_id: 'cat_root', selectable: true, has_children: false },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    const { 派发 } = render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    const 两枚 = await waitFor(() => {
      const 全部 = screen.getAllByRole('button', { name: '产品经理' });
      expect(全部).toHaveLength(2);
      return 全部;
    });
    await 用户.click(两枚[0]);
    await 用户.click(两枚[1]);
    const chips = screen.getAllByRole('button', { name: '产品经理 ✕' });
    expect(chips).toHaveLength(2);
    await 用户.click(chips[0]);
    expect(screen.getAllByRole('button', { name: '产品经理 ✕' })).toHaveLength(1);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        职位引用们: [{ id: 'job_b', display_name: '产品经理' }],
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
            { id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false, has_children: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.q && query.q.includes('互联') && !query.parentId) {
        return {
          items: [
            { id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false, has_children: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_tech') {
        return {
          items: [
            { id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true, has_children: false },
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
            { id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false, has_children: true },
            { id: 'cat_b', display_name: '大类B', parent_id: null, selectable: false, has_children: true },
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
          items: [{ id: 'job_b1', display_name: 'B岗位1', parent_id: 'cat_b', selectable: true, has_children: false }],
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
      items: [{ id: 'job_a1', display_name: 'A岗位1（过期）', parent_id: 'cat_a', selectable: true, has_children: false }],
      nextCursor: null,
      catalogVersion: 'v2',
    });
    // 等一下让可能的 state 更新发生
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // B 的子项仍在；A 的过期结果不出现
    expect(screen.getByText('B岗位1')).toBeTruthy();
    expect(screen.queryByText('A岗位1（过期）')).toBeNull();
  });

  // Task 5：根分页只走既有左栏滚动容器，没有「加载更多」节点
  it('左栏滚到底追加下一页根（Task 5 取代加载更多按钮）', async () => {
    let 根调用 = 0;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string }) => {
      if (!query.parentId) {
        根调用 += 1;
        if (根调用 === 1) {
          return {
            items: [{ id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false, has_children: true }],
            nextCursor: 'root_cur_1',
            catalogVersion: 'v2',
          };
        }
        return {
          items: [{ id: 'cat_b', display_name: '大类B', parent_id: null, selectable: false, has_children: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    await screen.findByText('大类A');
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
    滚到底(滚动容器(0));
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
          items: [{ id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false, has_children: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_tech') {
        return {
          items: [{ id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true, has_children: false }],
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

  // review-r3 R3-I-8：子项下一页在飞行中切大类 → 旧大类的第二页不覆盖新大类的子项
  it('子项下一页在飞行中切大类时旧页不覆盖新子项（R3-I-8）', async () => {
    const { promise: 慢Promise, resolve: 慢Resolve } = deferredPromise<{ items: unknown[]; nextCursor: string | null; catalogVersion: string }>();
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string }) => {
      if (!query.parentId && !query.cursor) {
        return {
          items: [
            { id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false, has_children: true },
            { id: 'cat_b', display_name: '大类B', parent_id: null, selectable: false, has_children: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_a' && !query.cursor) {
        return {
          items: [{ id: 'job_a1', display_name: 'A岗位1', parent_id: 'cat_a', selectable: true, has_children: false }],
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
          items: [{ id: 'job_b1', display_name: 'B岗位1', parent_id: 'cat_b', selectable: true, has_children: false }],
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
    // 右栏滚到底——A 的第二页在飞行中
    滚到底(滚动容器(1));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ cursor: 'cat_a_cur_1' })));
    // 快速切到大类B
    await 用户.click(screen.getByText('大类B'));
    // B 的子项立刻出现
    await screen.findByText('B岗位1');
    // A 的慢响应到达——不应追加到 B 的子项
    慢Resolve({
      items: [{ id: 'job_a2', display_name: 'A岗位2（过期）', parent_id: 'cat_a', selectable: true, has_children: false }],
      nextCursor: null,
      catalogVersion: 'v2',
    });
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // B 的子项仍在；A 的过期结果不出现
    expect(screen.getByText('B岗位1')).toBeTruthy();
    expect(screen.queryByText('A岗位2（过期）')).toBeNull();
  });
});

// ── review-cx F5：目录分页按 catalogVersion 静默重同步（冻结合同 2）──
// 同一查询的第一页记录 catalogVersion；追加页返回不同版本时不跨版本合并 ——
// 丢弃该查询累计的旧页与游标，从本查询第一页重开（既有请求路径，静默无提示），
// 恢复到单一版本且继续可翻页的状态。root / child / search 版本各自归各自的查询。
describe('选期望职位 catalogVersion 重同步（review-cx F5）', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('根追加页换版本：不合并旧根，从根查询第一页重开', async () => {
    let 根首页调用 = 0;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string }) => {
      if (query.parentId) return { items: [], nextCursor: null, catalogVersion: 'v2' };
      if (query.cursor === 'root_cur_1') {
        // 带旧版本游标的追加页：目录已换代（v3）
        return {
          items: [{ id: 'cat_old', display_name: '大类旧页', parent_id: null, selectable: false, has_children: true }],
          nextCursor: 'dead' as string | null,
          catalogVersion: 'v3',
        };
      }
      根首页调用 += 1;
      if (根首页调用 === 1) {
        return {
          items: [{ id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false, has_children: true }],
          nextCursor: 'root_cur_1' as string | null,
          catalogVersion: 'v2',
        };
      }
      // 重开的根第一页：v3
      return {
        items: [{ id: 'cat_c', display_name: '大类C新版', parent_id: null, selectable: false, has_children: true }],
        nextCursor: null,
        catalogVersion: 'v3',
      };
    });
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    await screen.findByText('大类A');
    // 左栏滚到底：追加页 v3 → 根列表整组替换为新版本第一页（大类A/大类旧页都不在）
    滚到底(滚动容器(0));
    await screen.findByText('大类C新版');
    expect(screen.queryByText('大类A')).toBeNull();
    expect(screen.queryByText('大类旧页')).toBeNull();
  });

  it('子项追加页换版本：右栏整组替换为新版本第一页，不带死游标重试', async () => {
    let 子首页调用 = 0;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string }) => {
      if (!query.parentId && !query.cursor) {
        return {
          items: [{ id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false, has_children: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_a' && query.cursor === 'a_cur_1') {
        return {
          items: [{ id: 'job_old', display_name: '岗位旧页', parent_id: 'cat_a', selectable: true, has_children: false }],
          nextCursor: 'dead' as string | null,
          catalogVersion: 'v3',
        };
      }
      if (query.parentId === 'cat_a') {
        子首页调用 += 1;
        if (子首页调用 === 1) {
          return {
            items: [{ id: 'job_a1', display_name: '岗位旧一', parent_id: 'cat_a', selectable: true, has_children: false }],
            nextCursor: 'a_cur_1' as string | null,
            catalogVersion: 'v2',
          };
        }
        return {
          items: [{ id: 'job_a1_v3', display_name: '岗位新一', parent_id: 'cat_a', selectable: true, has_children: false }],
          nextCursor: null,
          catalogVersion: 'v3',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    await screen.findByText('岗位旧一');
    // 右栏滚到底：追加页 v3 → 子项整组替换为新版本第一页
    滚到底(滚动容器(1));
    await screen.findByText('岗位新一');
    expect(screen.queryByText('岗位旧一')).toBeNull();
    expect(screen.queryByText('岗位旧页')).toBeNull();
    // 重开后不再带死游标发请求
    滚到底(滚动容器(1));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    expect(查询Taxonomy.mock.calls.some((调用) => (调用[1] as { cursor?: string }).cursor === 'dead')).toBe(false);
  });

  it('搜索追加页换版本：搜索结果整组替换为新版本第一页', async () => {
    let 搜索首页调用 = 0;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string; cursor?: string }) => {
      if (query.q === 'A' && query.cursor === 's_cur_1') {
        return {
          items: [{ id: 'job_s_old', display_name: 'A旧页', parent_id: null, selectable: true, has_children: false }],
          nextCursor: 'dead' as string | null,
          catalogVersion: 'v3',
        };
      }
      if (query.q === 'A') {
        搜索首页调用 += 1;
        if (搜索首页调用 === 1) {
          return {
            items: [{ id: 'job_s1', display_name: 'A结果旧', parent_id: null, selectable: true, has_children: false }],
            nextCursor: 's_cur_1' as string | null,
            catalogVersion: 'v2',
          };
        }
        return {
          items: [{ id: 'job_s1_v3', display_name: 'A结果新', parent_id: null, selectable: true, has_children: false }],
          nextCursor: null,
          catalogVersion: 'v3',
        };
      }
      if (!query.parentId && !query.q && !query.cursor) {
        return {
          items: [{ id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false, has_children: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await screen.findByText('大类A');
    await 用户.type(screen.getByPlaceholderText('搜索职位'), 'A');
    await screen.findByText('A结果旧');
    // 搜索态唯一的滚动容器滚到底：追加页 v3 → 结果整组替换为新版本第一页
    滚到底(滚动容器(0));
    await screen.findByText('A结果新');
    expect(screen.queryByText('A结果旧')).toBeNull();
    expect(screen.queryByText('A旧页')).toBeNull();
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
