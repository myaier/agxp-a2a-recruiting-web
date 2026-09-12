// 选期望行业 Backend 接入测试（Task 4）：
// Backend 按需 查询Taxonomy('industries')，selectable=true 的叶子原子保存 期望行业们+行业引用们；
// Mock 分支保持本地 行业字典 不变。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 选期望行业 from './选期望行业';

const mock返回 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

const 空草稿 = {
  编辑编号: null,
  求职类型: '全职' as const,
  工作城市: '',
  工作城市引用: undefined,
  期望职位: '',
  感兴趣城市们: [] as string[],
  感兴趣城市引用们: [] as string[],
  薪资下限: null,
  薪资上限: null,
  期望行业们: [] as string[],
  后端招聘类型: null,
  求职类型已改: false,
};

function render选期望行业(选项: {
  数据源: 'backend' | 'mock';
  查询Taxonomy?: ReturnType<typeof vi.fn>;
}) {
  // Task 7 起草稿是真实回写的（选择即写意向草稿）：派发把 改意向草稿 补丁落进
  // mock应用状态 并触发重渲染，多选/取消用例才能在真实草稿累积上断言。
  const 控制: { 重渲染?: () => void } = {};
  const 派发 = vi.fn((动作: { 型: string; 补丁?: Record<string, unknown> }) => {
    if (动作.型 === '改意向草稿' && 动作.补丁) {
      mock应用状态.状态.意向草稿 = { ...mock应用状态.状态.意向草稿, ...动作.补丁 };
      控制.重渲染?.();
    }
  });
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
      意向草稿: { ...空草稿 },
    },
    派发,
  };
  const 页面 = render(
    <MemoryRouter>
      <选期望行业 />
    </MemoryRouter>,
  );
  控制.重渲染 = () =>
    页面.rerender(
      <MemoryRouter>
        <选期望行业 />
      </MemoryRouter>,
    );
  return { 派发 };
}

describe('选期望行业 Backend', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('点 selectable 叶子原子保存 行业引用们', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [
            { id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'ind_fin') {
        return {
          items: [
            { id: 'ind_pay', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true, has_children: false },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    const { 派发 } = render选期望行业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    // 「金融科技」同时出现在推荐区和手风琴表头，推荐 chip 也会触发 展开根
    const 金融科技们 = await screen.findAllByText('金融科技');
    await 用户.click(金融科技们[0]);
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('industries', expect.objectContaining({ parentId: 'ind_fin' })));
    await 用户.click(await screen.findByText('支付与清结算'));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '改意向草稿',
        补丁: expect.objectContaining({
          期望行业们: ['支付与清结算'],
          行业引用们: [{ id: 'ind_pay', display_name: '支付与清结算' }],
        }),
      }),
    );
  });

  // review-r2 R2-M-1：根行业返回 nextCursor 时可加载更多
  it('根行业返回 nextCursor 时可加载更多（R2-M-1）', async () => {
    let 调用次数 = 0;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string }) => {
      if (!query.parentId) {
        调用次数 += 1;
        if (调用次数 === 1) {
          return {
            items: [{ id: 'ind_a', display_name: '行业A', parent_id: null, selectable: false, has_children: true }],
            nextCursor: 'root_cur_1',
            catalogVersion: 'v2',
          };
        }
        return {
          items: [{ id: 'ind_b', display_name: '行业B', parent_id: null, selectable: false, has_children: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render选期望行业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    await screen.findAllByText('行业A');
    // 第一页有 nextCursor → 显示「加载更多」
    const 加载更多 = await screen.findByRole('button', { name: '加载更多' });
    await 用户.click(加载更多);
    await screen.findAllByText('行业B');
    expect(screen.getAllByText('行业A').length).toBeGreaterThan(0);
    expect(查询Taxonomy).toHaveBeenLastCalledWith('industries', expect.objectContaining({ cursor: 'root_cur_1' }));
  });
});

describe('选期望行业 Mock', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('本地行业字典展开细选，保存不带引用', async () => {
    const { 派发 } = render选期望行业({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 展开金融科技（推荐区也有同名 chip，取手风琴表头：aria-expanded=false）
    await 用户.click(screen.getAllByText('金融科技')[1]);
    await 用户.click(await screen.findByText('支付与清结算'));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '改意向草稿',
        补丁: expect.objectContaining({ 期望行业们: ['支付与清结算'] }),
      }),
    );
    const 调用 = 派发.mock.calls.find((c) => c[0]?.型 === '改意向草稿')?.[0] as { 补丁: { 行业引用们?: unknown } };
    expect(调用.补丁.行业引用们).toBeUndefined();
  });
});
// Task 7 共用正文接线：两模式把控制映射为 期望行业选择正文 的同一组 props。
// 这里覆盖 brief 点名场景：多选与第 4 项上限、已选移除、同名不同 ID 按 ID 判定身份、
// 非 selectable 父项不可写、目录失败不回退 Mock、翻页不丢已选。
describe('选期望行业 共用正文（Task 7）', () => {
  const 写调用 = (派发: ReturnType<typeof vi.fn>) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    派发.mock.calls.map((c: any[]) => c[0]).filter((a) => a.型 === '改意向草稿');

  it('Mock：推荐一级片与细分片同正文多选，第 4 项禁用，已选片再点移除', async () => {
    const { 派发 } = render选期望行业({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 推荐区一级片可切换（沿原 Mock：一级行业名本身写入草稿）
    await 用户.click(screen.getAllByText('金融科技')[0]);
    expect(写调用(派发)).toHaveLength(1);
    expect(写调用(派发)[0].补丁).toEqual({ 期望行业们: ['金融科技'] });
    // 展开手风琴组，细分片累计到第 3 项
    await 用户.click(screen.getAllByText('互联网平台')[1]);
    await 用户.click(await screen.findByText('电商与交易'));
    await 用户.click(await screen.findByText('本地生活'));
    expect(screen.getByText('3/3')).toBeTruthy();
    // 第 4 项禁用：组行仍可展开，未选细分片点不动（上限态沿用原页）
    await 用户.click(screen.getAllByText('企业服务 / SaaS')[1]);
    const 第4项 = (await screen.findByText('协同办公')) as HTMLButtonElement;
    expect(第4项.disabled).toBe(true);
    await 用户.click(第4项);
    expect(写调用(派发)).toHaveLength(3);
    // 已选片再点移除（选择即写草稿的原业务语义）
    await 用户.click(screen.getByText('电商与交易'));
    const 最后 = 写调用(派发).at(-1);
    expect(最后.补丁.期望行业们).toEqual(['金融科技', '本地生活']);
  });

  it('Backend：同名不同 ID 按 ID 判定身份，互不串、按所点键提交与取消', async () => {
    const 目录页 = (items: unknown[], nextCursor: string | null = null) => ({
      items,
      nextCursor,
      catalogVersion: 'v2',
    });
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string }) => {
      if (query.parentId === 'r1') {
        return 目录页([{ id: 'pay_a', display_name: '支付与清结算', parent_id: 'r1', selectable: true, has_children: false }]);
      }
      if (query.parentId === 'r2') {
        return 目录页([{ id: 'pay_b', display_name: '支付与清结算', parent_id: 'r2', selectable: true, has_children: false }]);
      }
      return 目录页([
        { id: 'r1', display_name: '消费生活', parent_id: null, selectable: false, has_children: true },
        { id: 'r2', display_name: '金融科技', parent_id: null, selectable: false, has_children: true },
      ]);
    });
    const { 派发 } = render选期望行业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // 展开两个根（同名叶子分属两根）
    await 用户.click(screen.getAllByText('消费生活')[1]);
    await 用户.click((await screen.findAllByText('支付与清结算'))[0]);
    expect(写调用(派发)[0].补丁).toEqual({
      期望行业们: ['支付与清结算'],
      行业引用们: [{ id: 'pay_a', display_name: '支付与清结算' }],
    });
    await 用户.click(screen.getAllByText('金融科技')[1]);
    const 同名们 = await screen.findAllByText('支付与清结算');
    expect(同名们).toHaveLength(2);
    // 同名叶子不因名称命中而误显选中：勾只落在已选 ID 上
    expect(同名们[0].getAttribute('aria-pressed')).toBe('true');
    expect(同名们[1].getAttribute('aria-pressed')).toBe('false');
    await 用户.click(同名们[1]);
    expect(写调用(派发)[1].补丁).toEqual({
      期望行业们: ['支付与清结算', '支付与清结算'],
      行业引用们: [
        { id: 'pay_a', display_name: '支付与清结算' },
        { id: 'pay_b', display_name: '支付与清结算' },
      ],
    });
    // 取消按 ID：只摘除所点条目，同名另一条保留
    await 用户.click(同名们[0]);
    expect(写调用(派发)[2].补丁).toEqual({
      期望行业们: ['支付与清结算'],
      行业引用们: [{ id: 'pay_b', display_name: '支付与清结算' }],
    });
  });

  it('Backend：非 selectable 子项点击只展开取孙项，不写草稿', async () => {
    const 目录页 = (items: unknown[], nextCursor: string | null = null) => ({
      items,
      nextCursor,
      catalogVersion: 'v2',
    });
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string }) => {
      if (query.parentId === 'r1') {
        return 目录页([{ id: 'c1', display_name: '风控与反欺诈', parent_id: 'r1', selectable: false, has_children: true }]);
      }
      if (query.parentId === 'c1') {
        return 目录页([{ id: 'g1', display_name: '反欺诈引擎', parent_id: 'c1', selectable: true, has_children: false }]);
      }
      return 目录页([{ id: 'r1', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }]);
    });
    const { 派发 } = render选期望行业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    await 用户.click(screen.getAllByText('金融科技')[1]);
    // 非 selectable 父项不可写：点击走展开（发 parentId 请求），不改草稿
    await 用户.click(await screen.findByText('风控与反欺诈'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('industries', expect.objectContaining({ parentId: 'c1' })));
    expect(写调用(派发)).toHaveLength(0);
    // 孙层叶子可选可写
    await 用户.click(await screen.findByText('反欺诈引擎'));
    expect(写调用(派发)[0].补丁).toEqual({
      期望行业们: ['反欺诈引擎'],
      行业引用们: [{ id: 'g1', display_name: '反欺诈引擎' }],
    });
  });

  it('Backend：目录查询失败不回退 Mock 行业字典，也不显示成功占位', async () => {
    const 查询Taxonomy = vi.fn(async () => {
      throw new Error('network down');
    });
    render选期望行业({ 数据源: 'backend', 查询Taxonomy });
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // Mock 字典手风琴不出现（金融科技 只存在于 Mock 目录）
    expect(screen.queryByText('金融科技')).toBeNull();
    expect(screen.getByText('0/3')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
  });

  it('Backend：子项翻页不丢已选，第 1 页已选片保持选中', async () => {
    const 目录页 = (items: unknown[], nextCursor: string | null = null) => ({
      items,
      nextCursor,
      catalogVersion: 'v2',
    });
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string }) => {
      if (query.parentId === 'r1') {
        if (query.cursor === 'sub-cur') {
          return 目录页([{ id: 'pay_b', display_name: '证券与交易系统', parent_id: 'r1', selectable: true, has_children: false }]);
        }
        return 目录页(
          [{ id: 'pay_a', display_name: '支付与清结算', parent_id: 'r1', selectable: true, has_children: false }],
          'sub-cur',
        );
      }
      return 目录页([{ id: 'r1', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }]);
    });
    const { 派发 } = render选期望行业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    await 用户.click(screen.getAllByText('金融科技')[1]);
    await 用户.click(await screen.findByText('支付与清结算'));
    expect(写调用(派发)).toHaveLength(1);
    // 子项分页：翻出第 2 页，第 1 页已选片仍在且保持选中
    await 用户.click(await screen.findByRole('button', { name: '加载更多' }));
    await screen.findByText('证券与交易系统');
    const 已选片 = screen.getByText('支付与清结算');
    expect(已选片.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('1/3')).toBeTruthy();
  });
});
// ── review-r1 F3/F4/F5 ──────────────────────────────────────────
// F3：适配层 可展开 按契约 has_children 原样读取，不再用 !selectable 推导 ——
// 非 selectable 且 has_children=false 的子项点击不发目录请求（死端不空展开）；
// has_children=true 的子项照常展开。
describe('选期望行业 可展开按 has_children（review-r1 F3）', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  it('非 selectable 且 has_children=false 的子项点击不发目录请求；has_children=true 照常展开', async () => {
    const 目录页 = (items: unknown[], nextCursor: string | null = null) => ({
      items,
      nextCursor,
      catalogVersion: 'v2',
    });
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string }) => {
      if (query.parentId === 'r1') {
        return 目录页([
          { id: 'c_dead', display_name: '死端子项', parent_id: 'r1', selectable: false, has_children: false },
          { id: 'c_live', display_name: '风控与反欺诈', parent_id: 'r1', selectable: false, has_children: true },
        ]);
      }
      if (query.parentId === 'c_live') {
        return 目录页([{ id: 'g1', display_name: '反欺诈引擎', parent_id: 'c_live', selectable: true, has_children: false }]);
      }
      return 目录页([{ id: 'r1', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }]);
    });
    render选期望行业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    await 用户.click(screen.getAllByText('金融科技')[1]);
    // 死端子项：点击不发任何目录请求
    await 用户.click(await screen.findByText('死端子项'));
    expect(查询Taxonomy).not.toHaveBeenCalledWith('industries', expect.objectContaining({ parentId: 'c_dead' }));
    // has_children=true 的子项点击展开孙项
    await 用户.click(screen.getByText('风控与反欺诈'));
    await waitFor(() =>
      expect(查询Taxonomy).toHaveBeenCalledWith('industries', expect.objectContaining({ parentId: 'c_live' })),
    );
    await screen.findByText('反欺诈引擎');
  });
});

// F4：展开/子展开失败不得缓存成空结果 —— 入口守卫允许重试，失败经既有 轻提示 说明，
// 首次成功的空页仍照旧缓存。
describe('选期望行业 展开失败不缓存空结果（review-r1 F4）', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  it('展开根第一次请求失败：轻提示报错、不缓存空子表，再点重新发请求并成功', async () => {
    const 目录页 = (items: unknown[], nextCursor: string | null = null) => ({
      items,
      nextCursor,
      catalogVersion: 'v2',
    });
    let 拒绝首次 = true;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string }) => {
      if (query.parentId === 'r1') {
        if (拒绝首次) {
          拒绝首次 = false;
          throw new Error('network down');
        }
        return 目录页([{ id: 'c1', display_name: '支付与清结算', parent_id: 'r1', selectable: true, has_children: false }]);
      }
      return 目录页([{ id: 'r1', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }]);
    });
    render选期望行业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    await 用户.click(screen.getAllByText('金融科技')[1]);
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    // 失败没有写「已展开」记录：再点同一行重新发请求（不是命中缓存里的空子表）
    await 用户.click(screen.getAllByText('金融科技')[1]);
    await screen.findByText('支付与清结算');
  });

  it('展开子（孙项）第一次请求失败：轻提示报错、不缓存空孙表，再点重新发请求并成功', async () => {
    const 目录页 = (items: unknown[], nextCursor: string | null = null) => ({
      items,
      nextCursor,
      catalogVersion: 'v2',
    });
    let 拒绝首次 = true;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string }) => {
      if (query.parentId === 'c1') {
        if (拒绝首次) {
          拒绝首次 = false;
          throw new Error('network down');
        }
        return 目录页([{ id: 'g1', display_name: '反欺诈引擎', parent_id: 'c1', selectable: true, has_children: false }]);
      }
      if (query.parentId === 'r1') {
        return 目录页([{ id: 'c1', display_name: '风控与反欺诈', parent_id: 'r1', selectable: false, has_children: true }]);
      }
      return 目录页([{ id: 'r1', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }]);
    });
    render选期望行业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    await 用户.click(screen.getAllByText('金融科技')[1]);
    await 用户.click(await screen.findByText('风控与反欺诈'));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    await 用户.click(screen.getByText('风控与反欺诈'));
    await screen.findByText('反欺诈引擎');
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

// review-r3（Codex r3 F1）：根换代清理作废在飞的旧代展开请求——迟到写回被页内
// 目录代际作废，不把旧版本条目重新挂回新版本列表；重新展开从新版本取数。
describe('选期望行业 根换代作废在飞请求（review-r3）', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  it('子展开在飞时根换代：迟到写回被作废，重新展开取新版本子项', async () => {
    const 页 = (items: unknown[], nextCursor: string | null, 版本: string) => ({
      items,
      nextCursor,
      catalogVersion: 版本,
    });
    let 换代 = false;
    const { promise: 慢Promise, resolve: 慢Resolve } = deferred<{
      items: unknown[];
      nextCursor: string | null;
      catalogVersion: string;
    }>();
    const 查询Taxonomy = vi.fn(async (
      _kind: string,
      query: { parentId?: string; cursor?: string },
      选项?: { 强制刷新?: boolean },
    ) => {
      if (!query.parentId && !query.cursor) {
        return 选项?.强制刷新
          ? 页([{ id: 'r1', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }], null, 'v2')
          : 页([{ id: 'r1', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }], 'root_cur_v1', 'v1');
      }
      if (query.cursor === 'root_cur_v1') {
        // 追加页来自新快照：触发根列表重开
        return 页([{ id: 'r_old', display_name: '旧版本追加行业', parent_id: null, selectable: false, has_children: false }], null, 'v2');
      }
      if (query.parentId === 'r1') {
        return 换代
          ? 页([{ id: 'c2', display_name: '新子项', parent_id: 'r1', selectable: true, has_children: false }], null, 'v2')
          : 慢Promise;
      }
      return 页([], null, 'v2');
    });
    render选期望行业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // 展开根 → 子项请求在飞（慢响应未回）
    await 用户.click(screen.getAllByText('金融科技')[1]);
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('industries', expect.objectContaining({ parentId: 'r1' })));
    // 根栏追加页换版本 → 根列表重开，旧版本派生展开状态清空（子展开仍在飞）
    换代 = true;
    await 用户.click(await screen.findByRole('button', { name: '加载更多' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull());
    // 旧代子项迟到写回：被代际作废，不重挂旧版本条目
    慢Resolve(页([{ id: 'c1', display_name: '旧子项', parent_id: 'r1', selectable: true, has_children: false }], null, 'v1'));
    await waitFor(() => expect(screen.queryByText('旧子项')).toBeNull());
    // 重新展开同一根：从新版本取数（不被旧展开缓存挡住）
    await 用户.click(screen.getAllByText('金融科技')[1]);
    await screen.findByText('新子项');
    expect(screen.queryByText('旧子项')).toBeNull();
  });
});

// F5：子项追加页返回不同 catalogVersion 时，不跨版本合并 —— 丢弃该父项累计的旧页
// 与游标，从该父项第一页静默重开（沿 城市查询钩子 的版本引用做法，留在本页局部）。
describe('选期望行业 子项分页忽略 catalogVersion（review-r1 F5）', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  it('子项追加页换版本：列表重置为新版本第一页（不并 v1∪v2），后续游标是新版本的', async () => {
    const 页 = (items: unknown[], nextCursor: string | null, 版本: string) => ({
      items,
      nextCursor,
      catalogVersion: 版本,
    });
    const 查询Taxonomy = vi.fn(async (
      _kind: string,
      query: { parentId?: string; cursor?: string },
      选项?: { 强制刷新?: boolean },
    ) => {
      if (query.parentId === 'r1' && query.cursor === 'sub_cur_v1') {
        // 追加页来自新快照：不与 v1 首页合并，触发重开
        return 页([{ id: 'pay_b', display_name: '旧版本追加片', parent_id: 'r1', selectable: true, has_children: false }], null, 'v2');
      }
      if (query.parentId === 'r1') {
        // 首页：普通路径回 v1，强制刷新（重开）回 v2
        return 选项?.强制刷新
          ? 页([{ id: 'pay_c', display_name: '新版本首页片', parent_id: 'r1', selectable: true, has_children: false }], 'sub_cur_v2', 'v2')
          : 页([{ id: 'pay_a', display_name: '旧版本首页片', parent_id: 'r1', selectable: true, has_children: false }], 'sub_cur_v1', 'v1');
      }
      return 页([{ id: 'r1', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }], null, 'v2');
    });
    render选期望行业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    await 用户.click(screen.getAllByText('金融科技')[1]);
    await screen.findByText('旧版本首页片');
    await 用户.click(await screen.findByRole('button', { name: '加载更多' }));
    // v1 首页片保留、追加页被丢弃，重开出 v2 第一页（不含追加页那条）
    await screen.findByText('新版本首页片');
    expect(screen.queryByText('旧版本追加片')).toBeNull();
    expect(screen.queryByText('旧版本首页片')).toBeNull();
    // 后续翻页用 v2 的游标（重开请求本身不带游标，再点一次「加载更多」才用新游标）
    const 重开调用数 = 查询Taxonomy.mock.calls.length;
    await waitFor(() => expect((screen.getByRole('button', { name: '加载更多' }) as HTMLButtonElement).disabled).toBe(false));
    await 用户.click(screen.getByRole('button', { name: '加载更多' }));
    await waitFor(() => expect(查询Taxonomy.mock.calls.length).toBeGreaterThan(重开调用数));
    expect(查询Taxonomy).toHaveBeenNthCalledWith(
      重开调用数 + 1,
      'industries',
      expect.objectContaining({ parentId: 'r1', cursor: 'sub_cur_v2' }),
    );
  });

  // review-r2：根栏追加页换版本重开时，旧版本根下的子/孙展开（派生状态）同步失效，
  // 重新展开从新版本取数，不再残留旧版本条目可选可提交
  it('根栏追加页换版本：旧根下的子/孙展开失效，重新展开取新版本', async () => {
    const 页 = (items: unknown[], nextCursor: string | null, 版本: string) => ({
      items,
      nextCursor,
      catalogVersion: 版本,
    });
    let 换代 = false;
    const 查询Taxonomy = vi.fn(async (
      _kind: string,
      query: { parentId?: string; cursor?: string },
      选项?: { 强制刷新?: boolean },
    ) => {
      if (!query.parentId && !query.cursor) {
        return 选项?.强制刷新
          ? 页([{ id: 'r1', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }], null, 'v2')
          : 页([{ id: 'r1', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }], 'root_cur_v1', 'v1');
      }
      if (query.cursor === 'root_cur_v1') {
        // 追加页来自新快照：触发根列表重开
        return 页([{ id: 'r_old', display_name: '旧版本追加行业', parent_id: null, selectable: false, has_children: false }], null, 'v2');
      }
      if (query.parentId === 'r1') {
        return 换代
          ? 页([{ id: 'c2', display_name: '新子项', parent_id: 'r1', selectable: false, has_children: false }], null, 'v2')
          : 页([{ id: 'c1', display_name: '旧子项', parent_id: 'r1', selectable: false, has_children: true }], null, 'v1');
      }
      if (query.parentId === 'c1') {
        return 页([{ id: 'g1', display_name: '旧孙叶子', parent_id: 'c1', selectable: true, has_children: false }], null, 'v1');
      }
      return 页([], null, 'v2');
    });
    render选期望行业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // 展开根 → 子项，再展开子 → 孙叶子
    await 用户.click(screen.getAllByText('金融科技')[1]);
    await 用户.click(await screen.findByText('旧子项'));
    await screen.findByText('旧孙叶子');
    // 根栏追加页换版本 → 根列表重开（新版本同名根），旧版本根下的子/孙展开一并失效
    换代 = true;
    await 用户.click(await screen.findByRole('button', { name: '加载更多' }));
    await waitFor(() => expect(screen.queryByText('旧孙叶子')).toBeNull());
    expect(screen.queryByText('旧子项')).toBeNull();
    // 重新展开同一根：从新版本取数，不再命中旧展开缓存
    await 用户.click(screen.getAllByText('金融科技')[1]);
    await screen.findByText('新子项');
    expect(screen.queryByText('旧子项')).toBeNull();
  });
});
