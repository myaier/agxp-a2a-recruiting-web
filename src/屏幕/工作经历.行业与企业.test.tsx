// 工作经历 · 行业与企业（行业弹层/正文/全屏子视图/失败重试/真实企业 ID）
// 由 src/屏幕/工作经历.test.tsx 按冻结归属拆出：公司 canonical ID→行业与企业；行业弹层 Backend、行业无自由文本（R3-Minor-2）、行业必填引用（R2-I-5）、行业共用正文（Task 6）、行业全屏子视图（Task 3）、行业展开失败可重试（review-r1 F4）、经历真实企业 ID（合同 C）按行业/企业职责就近归入。

import {
  mock跳转,
  mock返回,
  mock轻提示,
  mock更新草稿,
  mock应用状态,
  简历经历初始,
  render工作经历,
  登记工作经历,
} from './工作经历.测试辅助';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import 工作经历 from './工作经历';
import type { 屏蔽项, 简历经历段 } from '../数据/类型';
import { BFF错误 } from '../数据/HTTP客户端';
import { BFF隐私快照样本, BFF隐私组织屏蔽样本 } from '../测试/BFF样本';
import { 从BFF隐私 } from '../数据/隐私映射';

登记工作经历(工作经历);

// jsdom 不实现 scrollIntoView（DF-002 保存拦截自动定位不完整经历时会调用）
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('工作经历 行业弹层 Backend', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('点 selectable 叶子写 行业引用，自由输入清除', async () => {
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
            { id: 'ind_pay', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render工作经历({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    // 进入第一段经历编辑页
    await 用户.click(screen.getByText('字节跳动'));
    // 点开所属行业弹层
    await 用户.click(screen.getByText('所属行业'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // 展开金融科技
    await 用户.click(await screen.findByText('金融科技'));
    await waitFor(() =>
      expect(查询Taxonomy).toHaveBeenCalledWith('industries', expect.objectContaining({ parentId: 'ind_fin' })),
    );
    // 点 selectable 叶子
    await 用户.click(await screen.findByText('支付与清结算'));
    // 完成回写
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 验证存简历派发里经历段带 行业引用
    const 派发 = mock应用状态.派发;
    const 存简历调用 = 派发.mock.calls.find((c: unknown[]) => (c[0] as { 型?: string })?.型 === '存简历')?.[0] as {
      经历: { 行业: string; 行业引用?: unknown }[];
    } | undefined;
    expect(存简历调用).toBeDefined();
    expect(存简历调用!.经历[0].行业).toBe('支付与清结算');
    expect(存简历调用!.经历[0].行业引用).toEqual({ id: 'ind_pay', display_name: '支付与清结算' });
  });

  it('非 selectable 子项点击展开孙项而不提交', async () => {
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
            { id: 'ind_sub', display_name: '证券与基金', parent_id: 'ind_fin', selectable: false, has_children: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'ind_sub') {
        return {
          items: [
            { id: 'ind_leaf', display_name: '公募基金', parent_id: 'ind_sub', selectable: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render工作经历({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // 展开金融科技（非 selectable root）
    await 用户.click(await screen.findByText('金融科技'));
    await waitFor(() =>
      expect(查询Taxonomy).toHaveBeenCalledWith('industries', expect.objectContaining({ parentId: 'ind_fin' })),
    );
    // 证券与基金 是非 selectable 子项 —— 点击应展开孙项，不提交
    await 用户.click(await screen.findByText('证券与基金'));
    await waitFor(() =>
      expect(查询Taxonomy).toHaveBeenCalledWith('industries', expect.objectContaining({ parentId: 'ind_sub' })),
    );
    // 孙项出现，点 selectable 叶子才提交
    await 用户.click(await screen.findByText('公募基金'));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 派发 = mock应用状态.派发;
    const 存简历调用 = 派发.mock.calls.find((c: unknown[]) => (c[0] as { 型?: string })?.型 === '存简历')?.[0] as {
      经历: { 行业: string; 行业引用?: unknown }[];
    } | undefined;
    expect(存简历调用).toBeDefined();
    expect(存简历调用!.经历[0].行业).toBe('公募基金');
    expect(存简历调用!.经历[0].行业引用).toEqual({ id: 'ind_leaf', display_name: '公募基金' });
  });

  // review-r3 R3-I-5：行业弹层 root 分页——roots 返回 nextCursor 时可加载更多，dedup 合并
  it('行业弹层根分页加载更多追加第二页（R3-I-5）', async () => {
    let 根调用 = 0;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        根调用 += 1;
        if (根调用 === 1) {
          return {
            items: [{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }],
            nextCursor: 'ind_cur_1',
            catalogVersion: 'v2',
          };
        }
        return {
          items: [{ id: 'ind_tech', display_name: '互联网', parent_id: null, selectable: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'ind_fin') {
        return {
          items: [{ id: 'ind_pay', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render工作经历({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    await screen.findByText('金融科技');
    // 点「加载更多」→ 追加第二页
    const 加载更多 = await screen.findByRole('button', { name: '加载更多' });
    await 用户.click(加载更多);
    await screen.findByText('互联网');
    expect(screen.getByText('金融科技')).toBeTruthy();
  });

  // review-r2：根栏追加页换版本重开时，旧版本根下的子/孙展开（派生状态）同步失效，
  // 重新展开从新版本取数，不再残留旧版本条目可选可提交
  it('行业弹层根追加页换版本：旧根下的子/孙展开失效，重新展开取新版本', async () => {
    const 页 = (items: unknown[], nextCursor: string | null, 版本: string) => ({
      items,
      nextCursor,
      catalogVersion: 版本,
    });
    let 换代 = false;
    const 查询Taxonomy = vi.fn(async (
      _kind: string,
      query: { parentId?: string; cursor?: string; q?: string },
      选项?: { 强制刷新?: boolean },
    ) => {
      if (query.cursor === 'ind_cur_1') {
        // 追加页来自新快照：触发根列表重开
        return 页([{ id: 'ind_old', display_name: '旧版本追加行业', parent_id: null, selectable: false, has_children: false }], null, 'v2');
      }
      if (!query.parentId && !query.q) {
        return 选项?.强制刷新
          ? 页([{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }], null, 'v2')
          : 页([{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }], 'ind_cur_1', 'v1');
      }
      if (query.parentId === 'ind_fin') {
        return 换代
          ? 页([{ id: 'ind_new', display_name: '新子行业', parent_id: 'ind_fin', selectable: true, has_children: false }], null, 'v2')
          : 页([{ id: 'ind_sub', display_name: '证券与基金', parent_id: 'ind_fin', selectable: false, has_children: true }], null, 'v1');
      }
      if (query.parentId === 'ind_sub') {
        return 页([{ id: 'ind_leaf', display_name: '公募基金', parent_id: 'ind_sub', selectable: true, has_children: false }], null, 'v1');
      }
      return 页([], null, 'v2');
    });
    render工作经历({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    await screen.findByText('金融科技');
    // 展开根 → 子项，再展开子 → 孙叶子
    await 用户.click(screen.getByText('金融科技'));
    await 用户.click(await screen.findByText('证券与基金'));
    await screen.findByText('公募基金');
    // 根栏追加页换版本 → 根列表重开（新版本同名根），旧版本根下的子/孙展开一并失效
    换代 = true;
    await 用户.click(await screen.findByRole('button', { name: '加载更多' }));
    await waitFor(() => expect(screen.queryByText('公募基金')).toBeNull());
    expect(screen.queryByText('证券与基金')).toBeNull();
    // 重新展开同一根：从新版本取数，不再命中旧展开缓存
    await 用户.click(screen.getByText('金融科技'));
    await screen.findByText('新子行业');
    expect(screen.queryByText('证券与基金')).toBeNull();
  });

  // review-r3（Codex r3 F1）：根换代清理作废在飞的旧代展开请求——迟到写回被页内
  // 行业代际作废，不把旧版本条目重新挂回新版本列表；重新展开从新版本取数。
  it('行业弹层子展开在飞时根换代：迟到写回被作废，重新展开取新版本', async () => {
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
      query: { parentId?: string; cursor?: string; q?: string },
      选项?: { 强制刷新?: boolean },
    ) => {
      if (!query.parentId && !query.q && !query.cursor) {
        return 选项?.强制刷新
          ? 页([{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }], null, 'v2')
          : 页([{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }], 'ind_cur_1', 'v1');
      }
      if (query.cursor === 'ind_cur_1') {
        // 追加页来自新快照：触发根列表重开
        return 页([{ id: 'ind_old', display_name: '旧版本追加行业', parent_id: null, selectable: false, has_children: false }], null, 'v2');
      }
      if (query.parentId === 'ind_fin') {
        return 换代
          ? 页([{ id: 'ind_new', display_name: '新子行业', parent_id: 'ind_fin', selectable: true, has_children: false }], null, 'v2')
          : 慢Promise;
      }
      return 页([], null, 'v2');
    });
    render工作经历({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    await screen.findByText('金融科技');
    // 展开根 → 子项请求在飞（慢响应未回）
    await 用户.click(screen.getByText('金融科技'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('industries', expect.objectContaining({ parentId: 'ind_fin' })));
    // 根栏追加页换版本 → 根列表重开，旧版本派生展开状态清空（子展开仍在飞）
    换代 = true;
    await 用户.click(await screen.findByRole('button', { name: '加载更多' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull());
    // 旧代子项迟到写回：被代际作废，不重挂旧版本条目
    慢Resolve(页([{ id: 'ind_old_sub', display_name: '旧子行业', parent_id: 'ind_fin', selectable: true, has_children: false }], null, 'v1'));
    await waitFor(() => expect(screen.queryByText('旧子行业')).toBeNull());
    // 重新展开同一根：从新版本取数（不被旧展开缓存挡住）
    await 用户.click(screen.getByText('金融科技'));
    await screen.findByText('新子行业');
    expect(screen.queryByText('旧子行业')).toBeNull();
  });

  // review-r3（Codex r3 F2）：子列表换代替换时，旧子项名下的孙项状态一并失效——
  // v2 复用同 ID 子项时不再把 v1 孙项重新挂上去（沿 选期望行业 round-2 的摘旧做法）。
  it('行业弹层子列表换代：旧子的孙项状态失效，同 ID 子不再挂旧孙项', async () => {
    const 页 = (items: unknown[], nextCursor: string | null, 版本: string) => ({
      items,
      nextCursor,
      catalogVersion: 版本,
    });
    let 换代 = false;
    const 查询Taxonomy = vi.fn(async (
      _kind: string,
      query: { parentId?: string; cursor?: string; q?: string },
      选项?: { 强制刷新?: boolean },
    ) => {
      if (!query.parentId && !query.q && !query.cursor) {
        return 页([{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }], null, 'v1');
      }
      if (query.cursor === 'sub_cur_v1') {
        // 子项追加页来自新快照：触发子列表整组重开
        return 页([{ id: 'ind_extra', display_name: '旧追加子行业', parent_id: 'ind_fin', selectable: true, has_children: false }], null, 'v2');
      }
      if (query.parentId === 'ind_fin') {
        // 换代前后都复用同一子 ID，差别在名下孙项（v1 公募基金 / v2 新孙叶子）
        const 子 = { id: 'ind_sub', display_name: '证券与基金', parent_id: 'ind_fin', selectable: false, has_children: true };
        return 换代 || 选项?.强制刷新
          ? 页([子], null, 'v2')
          : 页([子], 'sub_cur_v1', 'v1');
      }
      if (query.parentId === 'ind_sub') {
        return 换代
          ? 页([{ id: 'ind_leaf_v2', display_name: '新孙叶子', parent_id: 'ind_sub', selectable: true, has_children: false }], null, 'v2')
          : 页([{ id: 'ind_leaf', display_name: '公募基金', parent_id: 'ind_sub', selectable: true, has_children: false }], null, 'v1');
      }
      return 页([], null, 'v2');
    });
    render工作经历({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    await screen.findByText('金融科技');
    // 展开根 → 子项，再展开子 → 孙叶子（v1）
    await 用户.click(screen.getByText('金融科技'));
    await 用户.click(await screen.findByText('证券与基金'));
    await screen.findByText('公募基金');
    // 子列表追加页换版本 → 整组重开（v2 复用同 ID 子项），旧子名下的孙项状态失效
    换代 = true;
    await 用户.click(await screen.findByRole('button', { name: '加载更多' }));
    await waitFor(() => expect(screen.queryByText('公募基金')).toBeNull());
    expect(screen.queryByText('旧追加子行业')).toBeNull();
    // 重新展开同 ID 子项：从新版本取孙项，不再命中旧孙缓存
    await 用户.click(screen.getByText('证券与基金'));
    await screen.findByText('新孙叶子');
    expect(screen.queryByText('公募基金')).toBeNull();
  });
});

// review-r3 R3-Minor-2：Backend 行业弹层去掉自由文本输入——它看起来可保存但完成守卫要求引用，
// 自由输入会清掉引用导致无法完成。Backend 必须从目录叶子里选。
describe('工作经历 经历编辑页 Backend 行业无自由文本（R3-Minor-2）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('Backend 行业弹层无自由文本输入框（必须选目录叶子）', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'ind_fin') {
        return {
          items: [{ id: 'ind_pay', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render工作经历({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    // Backend 模式不渲染自由文本输入框
    expect(screen.queryByPlaceholderText('没有合适的？直接输入')).toBeNull();
  });

  it('picker 统一 Task 1：Mock 行业弹层同样无自由文本输入框（自填已删除）', async () => {
    render工作经历({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    await screen.findByText('金融科技');
    expect(screen.queryByPlaceholderText('没有合适的？直接输入')).toBeNull();
  });
});

// review-r2 R2-I-5：Backend 经历编辑页 行业为空也能完成 → 保存简历 跳过该行 → 不持久化 →
// 服务端水合后消失。修复后 Backend 要求 行业引用（隐含 行业 非空）才能完成。
describe('工作经历 经历编辑页 Backend 行业必填引用（R2-I-5）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('Backend 行业为空时完成被阻断，不派发存简历', async () => {
    render工作经历({ 数据源: 'backend' });
    const 用户 = userEvent.setup();
    // 进入第一段经历编辑页（初始数据 行业='' 行业引用=undefined）
    await 用户.click(screen.getByText('字节跳动'));
    // 公司/职位/入职时间 都已填（初始数据），必填齐通过；点完成应被 行业引用 缺失阻断
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 派发 = mock应用状态.派发;
    const 存简历调用 = 派发.mock.calls.find((c: unknown[]) => (c[0] as { 型?: string })?.型 === '存简历');
    expect(存简历调用).toBeUndefined();
  });
});

// ── Task 6（core editors §5.2）：经历行业层迁出共用 简历行业选择正文 ──
// 页面把现有根/子/孙三层展开状态按当前渲染顺序映射为分段（既有列表及其分页尾的展示
// 批次，不是新树存储）；组件点击回调按稳定键在本外层解析回目录项（同名不同 ID 不串，
// 不按显示名反查），选中回显按稳定 ID（同名条目不相互覆盖）；非 selectable 且
// has_children=false 的行不展开不提交也不发目录请求。Mock 常见行业作为模拟目录走同一
// 正文，自填输入经可选 自填 提供，Backend 不暴露自由文本；单选关闭/回填时机沿原页。
describe('工作经历 经历编辑页 行业共用正文（Task 6）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('Backend 同名不同 ID：按稳定键提交所点行，重开层勾只落该行（选中按 ID 回显）', async () => {
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
            { id: 'ind_pay_a', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true, has_children: false },
            { id: 'ind_pay_b', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true, has_children: false },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render工作经历({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    // 层先出根列表，点根项才拉子列表（两层同名叶子都在 金融科技 之下）
    await 用户.click(await screen.findByText('金融科技'));
    // 行项在全屏子视图 dialog 内按 button 定位（编辑页 选择条目 的可及名含回显值，须排除）
    const 层内 = within(screen.getByRole('dialog', { name: '所属行业' }));
    const 同名行 = await 层内.findAllByRole('button', { name: /支付与清结算/ });
    expect(同名行).toHaveLength(2);
    await 用户.click(同名行[1]!);
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 提交按所点行的稳定 ID（同名不相互覆盖，不按显示名反查）
    const 派发 = mock应用状态.派发;
    const 存简历调用 = 派发.mock.calls.find((c: unknown[]) => (c[0] as { 型?: string })?.型 === '存简历')?.[0] as {
      经历: { 行业: string; 行业引用?: unknown }[];
    } | undefined;
    expect(存简历调用).toBeDefined();
    expect(存简历调用!.经历[0].行业).toBe('支付与清结算');
    expect(存简历调用!.经历[0].行业引用).toEqual({ id: 'ind_pay_b', display_name: '支付与清结算' });
    // 重开层（重进编辑页是全新层状态，先重新展开根）：勾只落所点行 ——
    // 选中回显按稳定 ID，同名条目不相互覆盖
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    await 用户.click(await screen.findByText('金融科技'));
    const 重开层内 = within(screen.getByRole('dialog', { name: '所属行业' }));
    const 重开行 = await 重开层内.findAllByRole('button', { name: /支付与清结算/ });
    expect(重开行[0]!.textContent).not.toContain('✓');
    expect(重开行[1]!.textContent).toContain('✓');
  });

  it('Backend 非 selectable 且无子项（has_children false）：点击不展开不提交也不发目录请求', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [
            { id: 'ind_dead', display_name: '死端行业', parent_id: null, selectable: false, has_children: false },
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
    render工作经历({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    await screen.findByText('金融科技');
    // 弹层打开即拉根列表：此后点击死端行不得再发任何目录请求（父项不当叶子提交，也不空展开）
    const 打开后调用数 = 查询Taxonomy.mock.calls.length;
    await 用户.click(screen.getByText('死端行业'));
    expect(查询Taxonomy.mock.calls.length).toBe(打开后调用数);
  });

  it('picker 统一 Task 1：Mock 沿共用 行业字典 折叠列表单选选定回填并关闭层；无「自填行业」输入', async () => {
    render工作经历({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    // Mock 目录 = 共用 行业字典 适配（根仅展开、细分可选；与 Backend 同一正文/同一交互）
    await screen.findByText('金融科技');
    // 无「自填行业」自由文本输入（原 Mock 自填按 Plan 删除）
    expect(screen.queryByPlaceholderText('没有合适的？直接输入')).toBeNull();
    // 展开根 → 点细分 → 回填所属行业行并关闭层（单选关闭/回填时机沿原页）
    await 用户.click(screen.getByText('金融科技'));
    await 用户.click(await screen.findByText('支付与清结算'));
    expect(screen.getByText('支付与清结算')).toBeTruthy();
    // 取消（Escape）不落任何选择：层关闭且所属行业行保持已回填值，不保存经历条目
    await 用户.click(screen.getByText('所属行业'));
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '所属行业' })).toBeNull());
    expect(screen.getByText('支付与清结算')).toBeTruthy();
    // 完成回写：Mock 无引用门槛，行业文本落经历段（不落引用）
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 派发 = mock应用状态.派发;
    const 存简历调用 = 派发.mock.calls.find((c: unknown[]) => (c[0] as { 型?: string })?.型 === '存简历')?.[0] as {
      经历: { 行业: string; 行业引用?: unknown }[];
    } | undefined;
    expect(存简历调用).toBeDefined();
    expect(存简历调用!.经历[0].行业).toBe('支付与清结算');
    expect('行业引用' in 存简历调用!.经历[0]).toBe(false);
  });

  // picker 统一 Task 1 回归：单选选定只写当前经历草稿并关闭；关闭未选择时草稿不变
  it('经历单选 a1 后仅回填当前经历草稿并关闭；关闭未选择时草稿不变', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [{ id: 'A', display_name: '行业A', parent_id: null, selectable: false, has_children: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'A') {
        return {
          items: [{ id: 'a1', display_name: '子项一', parent_id: 'A', selectable: true, has_children: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    const 建档 = {
      资料: { 基本信息: { 真名: '沈', 开始工作年: '2017', 身份: '在职' as const } },
    } as never;
    render工作经历({ 数据源: 'backend', 查询Taxonomy, 建档 });
    const 用户 = userEvent.setup();
    const 更新次数 = () => mock更新草稿.mock.calls.length;
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    await 用户.click(await screen.findByText('行业A'));
    // 单选：选定立即写当前经历草稿（行业引用）并关闭，不再有第二条确认路径
    await 用户.click(await screen.findByText('子项一'));
    expect(screen.queryByRole('dialog', { name: '所属行业' })).toBeNull();
    const 落层 = mock更新草稿.mock.calls.map((c: unknown[]) => c[0] as { 编辑中?: { 种类?: string; 字段?: { 行业?: string; 行业引用?: unknown } } })
      .filter((草稿) => 草稿.编辑中?.种类 === 'experience');
    const 最后落层 = 落层.at(-1) as { 编辑中: { 字段: { 行业: string; 行业引用?: unknown } } } | undefined;
    expect(最后落层?.编辑中.字段.行业).toBe('子项一');
    expect(最后落层?.编辑中.字段.行业引用).toEqual({ id: 'a1', display_name: '子项一' });
    // 打开层又直接关闭（未选择）：草稿不变（无新的 编辑中 写入）
    const 选择后 = 更新次数();
    await 用户.click(screen.getByText('所属行业'));
    await screen.findByText('行业A');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '所属行业' })).toBeNull());
    expect(更新次数() - 选择后).toBe(0);
  });
});

// ── editor-catalog-fullscreen Task 3：所属行业 从 72% 底部弹层换成全屏选择外壳（A 契约）──
// 父经历编辑页 hidden 保持挂载、正文在 wrapper 兄弟位置、关闭后按 A 恢复触发行焦点与
// 滚动；行业目录行为（展开/分页/重试/换代/单选回填）不因容器变化失效。
describe('工作经历 经历编辑页 行业全屏子视图（Task 3）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('打开时父经历编辑页 hidden 保持挂载且行业正文在 wrapper 外；关闭恢复触发行焦点与滚动；首次挂载不抢焦点', async () => {
    render工作经历({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 首次挂载不恢复焦点
    expect(document.activeElement).toBe(document.body);
    await 用户.click(screen.getByText('字节跳动'));
    const 行业行 = screen.getByText('所属行业').closest('button') as HTMLElement;
    const 滚动节点 = 行业行.closest('.滚动区') as HTMLElement;
    expect(滚动节点).toBeTruthy();
    滚动节点.scrollTop = 96;
    await 用户.click(行业行);
    const 行业层 = await screen.findByRole('dialog', { name: '所属行业' });
    // 父编辑页 wrapper hidden + 显式 display:none；全屏正文不在 hidden 祖先里
    const 隐藏区 = document.querySelector('div[hidden]') as HTMLElement;
    expect(隐藏区).toBeTruthy();
    expect(隐藏区.style.display).toBe('none');
    expect(隐藏区.contains(行业层)).toBe(false);
    // 父表单没有卸载（失败反例：卸载整个经历表单）——行业行还在 DOM 里，只是退出无障碍树
    expect(隐藏区.contains(行业行)).toBe(true);
    expect(screen.queryByRole('button', { name: /公司名称/ })).toBeNull();
    // Escape 关闭：焦点回触发行、滚动还原，经历表单原样恢复
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '所属行业' })).toBeNull());
    expect(document.activeElement).toBe(行业行);
    expect(滚动节点.scrollTop).toBe(96);
    expect(screen.getByRole('button', { name: '完成' })).toBeTruthy();
  });

  it('行业全屏取消不丢未保存草稿：职位/工作内容/时间跨/公司跨取消保留，行业行保持未选', async () => {
    render工作经历({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    // 未保存改动：职位、工作内容、时间跨（至今 → 手填结束）
    const 职位框 = screen.getByPlaceholderText('必填') as HTMLInputElement;
    await 用户.clear(职位框);
    await 用户.type(职位框, '资深后端');
    await 用户.type(screen.getByPlaceholderText('请详细写职责、规模、结果'), '未保存的描述');
    await 用户.click(screen.getByRole('checkbox', { name: '至今' }));
    expect(screen.getByRole('button', { name: '离职年月' })).toBeTruthy();
    // 打开行业全屏再取消（返回键，不选定任何行业）
    await 用户.click(screen.getByText('所属行业'));
    await screen.findByRole('dialog', { name: '所属行业' });
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '所属行业' })).toBeNull());
    // 草稿原样：文本输入、时间跨、公司回显都还在；行业行仍是占位
    expect((screen.getByPlaceholderText('必填') as HTMLInputElement).value).toBe('资深后端');
    expect((screen.getByPlaceholderText('请详细写职责、规模、结果') as HTMLTextAreaElement).value).toContain('未保存的描述');
    expect(screen.getByRole('button', { name: '离职年月' })).toBeTruthy();
    expect(screen.getByText('公司名称').closest('button')!.textContent).toContain('字节跳动');
    expect(screen.getByText('所属行业').closest('button')!.textContent).toContain('选择行业');
  });
});

// ── review-r1 F4：行业展开失败不缓存空结果（工作经历侧） ────────────────
describe('工作经历 行业展开失败可重试（review-r1 F4）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  it('展开行业根第一次请求失败：轻提示报错、不缓存空子表，再点重新发请求并成功', async () => {
    let 拒绝首次 = true;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (query.parentId === 'ind_fin') {
        if (拒绝首次) {
          拒绝首次 = false;
          throw new Error('network down');
        }
        return {
          items: [{ id: 'ind_pay', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true, has_children: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return {
        items: [{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    });
    render工作经历({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    await 用户.click(await screen.findByText('金融科技'));
    // picker 统一 Task 1：失败经行内错误 + 重试入口说明（不缓存成空子表），不再走 轻提示
    await waitFor(() => expect(mock轻提示).not.toHaveBeenCalled());
    await 用户.click(await screen.findByRole('button', { name: '重试' }));
    await screen.findByText('支付与清结算');
  });

  it('展开行业子（孙项）第一次请求失败：轻提示报错、不缓存空孙表，再点重新发请求并成功', async () => {
    let 拒绝首次 = true;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (query.parentId === 'ind_sub') {
        if (拒绝首次) {
          拒绝首次 = false;
          throw new Error('network down');
        }
        return {
          items: [{ id: 'ind_leaf', display_name: '公募基金', parent_id: 'ind_sub', selectable: true, has_children: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'ind_fin') {
        return {
          items: [{ id: 'ind_sub', display_name: '证券与基金', parent_id: 'ind_fin', selectable: false, has_children: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return {
        items: [{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    });
    render工作经历({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    await 用户.click(await screen.findByText('金融科技'));
    await 用户.click(await screen.findByText('证券与基金'));
    // 失败经行内错误 + 重试入口说明（不缓存成空孙表）
    await 用户.click(await screen.findByRole('button', { name: '重试' }));
    await screen.findByText('公募基金');
  });
});

// ── 合同 C：经历真实企业 ID —— 公司名称走 公司选择抽屉接线，旧公司文本只作搜索词，
//    选中才落真实 organization_id；完成守卫与保存路径都不允许缺 ID 绕过 ──
describe('工作经历 · 经历真实企业 ID（合同 C）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  const 同名目录 = (搜索组织: ReturnType<typeof vi.fn>) => {
    搜索组织.mockImplementation(async () => ({
      items: [
        { organization_id: 'org_old', display_name: '字节跳动', legal_name: '旧主体', verification_status: 'verified' as const },
        { organization_id: 'org_new', display_name: '字节跳动', legal_name: null, verification_status: 'unverified' as const },
      ],
      next_cursor: null,
    }));
  };

  it('公司行打开抽屉并以旧公司文本预填搜索词；同名不同 ID 按键选中并保存真实 ID', async () => {
    const 搜索组织 = vi.fn(async () => ({ items: [], next_cursor: null }));
    同名目录(搜索组织);
    render工作经历({
      数据源: 'backend',
      搜索组织,
      // 行业引用已齐备：本组用例只考核企业 ID 路径
      经历: [{ ...简历经历初始[0], 行业引用: { id: 'tax_i', display_name: '互联网' } }],
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    // 打开抽屉：搜索词预填旧公司文本（不是自动选中首命中）
    await 用户.click(screen.getByText('公司名称'));
    const 抽屉 = await screen.findByRole('dialog', { name: '选择企业' });
    expect((within(抽屉).getByPlaceholderText('输入公司名称') as HTMLInputElement).value).toBe('字节跳动');
    await waitFor(() =>
      expect(搜索组织).toHaveBeenCalledWith(expect.objectContaining({ q: '字节跳动' })),
    );
    // 同名不同 ID：两条都在，勾只落用户点的那一行（按稳定键回显）
    const 行们 = within(抽屉).getAllByText('字节跳动');
    expect(行们).toHaveLength(2);
    await 用户.click(行们[1]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择企业' })).toBeNull());
    // 重开抽屉：选中回显只落在 org_new 那一行
    await 用户.click(screen.getByText('公司名称'));
    const 重开抽屉 = await screen.findByRole('dialog', { name: '选择企业' });
    await waitFor(() => expect(within(重开抽屉).getAllByText('字节跳动')).toHaveLength(2));
    const 重开行们 = within(重开抽屉).getAllByText('字节跳动');
    expect(within(重开行们[0].closest('button')!).queryByText('✓')).toBeNull();
    expect(within(重开行们[1].closest('button')!).getByText('✓')).toBeTruthy();
    await 用户.click(重开行们[1]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择企业' })).toBeNull());
    // 完成提交：显示名与真实 ID 一起落，缺一不可
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 存简历调用 = (mock应用状态.派发.mock.calls as { 型?: string; 经历?: { 公司: string; 组织编号?: string }[] }[][])
      .filter(([动作]) => 动作.型 === '存简历').at(-1);
    expect(存简历调用).toBeDefined();
    expect(存简历调用![0].经历![0]).toMatchObject({ 公司: '字节跳动', 组织编号: 'org_new' });
  });

  it('取消（Escape）不改旧值：公司文本与真实 ID 都保持原样', async () => {
    const 搜索组织 = vi.fn(async () => ({ items: [], next_cursor: null }));
    同名目录(搜索组织);
    render工作经历({
      数据源: 'backend',
      搜索组织,
      经历: [{ ...简历经历初始[0], 行业引用: { id: 'tax_i', display_name: '互联网' } }],
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('公司名称'));
    await screen.findByRole('dialog', { name: '选择企业' });
    await 用户.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择企业' })).toBeNull());
    expect(screen.getByText('公司名称').closest('button')?.textContent).toContain('字节跳动');
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 存简历调用 = (mock应用状态.派发.mock.calls as { 型?: string; 经历?: { 组织编号?: string }[] }[][])
      .filter(([动作]) => 动作.型 === '存简历').at(-1);
    expect(存简历调用![0].经历![0].组织编号).toBe('org_bytedance');
  });

  it('添加新企业走同一回填路径：创建回执的 ID 与名称落草稿', async () => {
    const 搜索组织 = vi.fn(async () => ({ items: [], next_cursor: null }));
    const 创建组织 = vi.fn(async (名称: string) => ({
      organization: {
        organization_id: 'org_fresh', display_name: 名称,
        legal_name: null, verification_status: 'unverified' as const,
      },
      created: true,
    }));
    const 查询Taxonomy = vi.fn(async () => ({
      items: [{ id: 'tax_i', display_name: '互联网', parent_id: null, selectable: true }],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    render工作经历({ 数据源: 'backend', 搜索组织, 创建组织, 查询Taxonomy, 经历: [] });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /添加工作经历/ }));
    await 用户.click(screen.getByText('公司名称'));
    const 抽屉 = await screen.findByRole('dialog', { name: '选择企业' });
    await 用户.click(within(抽屉).getByText('添加新企业'));
    await 用户.type(within(抽屉).getByPlaceholderText('输入公司名称'), '新公司');
    await 用户.click(within(抽屉).getByRole('button', { name: '添加并选择' }));
    await waitFor(() => expect(创建组织).toHaveBeenCalledWith('新公司', expect.any(String)));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择企业' })).toBeNull());
    // 入职时间 / 行业也齐备后再完成（本用例考核的是企业 ID 回填路径）
    await 用户.type(screen.getByPlaceholderText('必填'), '工程师');
    await 用户.click(screen.getByRole('button', { name: '入职年月' }));
    await 用户.click(within(await screen.findByRole('dialog', { name: '选择入职年月' })).getByRole('button', { name: '确定' }));
    await 用户.click(screen.getByText('所属行业'));
    await 用户.click(await screen.findByText('互联网'));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 存简历调用 = (mock应用状态.派发.mock.calls as { 型?: string; 经历?: { 公司: string; 组织编号?: string }[] }[][])
      .filter(([动作]) => 动作.型 === '存简历').at(-1);
    expect(存简历调用![0].经历![0]).toMatchObject({ 公司: '新公司', 组织编号: 'org_fresh' });
  });

  it('缺 ID 的完整条目完成被拦：请选择公司，不派发存简历，文本保留', async () => {
    render工作经历({
      数据源: 'backend',
      经历: [{ 编号: 'e9', 公司: '旧文本公司', 行业: '互联网', 行业引用: { id: 'tax_i', display_name: '互联网' }, 职位: '后端', 开始: '2021-01', 结束: null, 内容: '', 隐藏: true }],
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('旧文本公司'));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    expect(mock轻提示).toHaveBeenCalledWith('请选择公司');
    const 存简历数 = (mock应用状态.派发.mock.calls as { 型?: string }[][])
      .filter(([动作]) => 动作.型 === '存简历').length;
    expect(存简历数).toBe(0);
    // 缺 ID 条目的可见内容不被清掉
    expect(screen.getByText('公司名称').closest('button')?.textContent).toContain('旧文本公司');
  });
});

// ── 契约B（2026-09-17 聊天与推荐展示修复 Task 1）：经历企业屏蔽接线 ──
// 「对这家公司隐藏我的信息」不再写 hidden，改绑有效企业屏蔽（manual 一直有效；
// derived 来源随「对现雇主隐身」生效）+ 页面待提交意图 Map<organization_id, boolean>。
// 折叠卡徽标同源派生；开关「完成」只改草稿，外层「保存」才按序调用现有隐私 API，
// 每项成功后权威回读核对并移除意图 —— 失败保留意图提示未保存，绝不假报成功。
describe('工作经历 · 经历企业屏蔽（契约B）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  /** 手动屏蔽行（manual 一直有效） */
  const 手动行 = (组织编号: string, 名称: string): 屏蔽项 => ({
    编号: 组织编号, 名称, 首字: 名称.charAt(0), 理由: '你手动加入 · 双向不可见', 时间: '2026-09-17',
    组织编号, 来源: '手动添加', 组织状态: '有效',
  });
  /** derived 屏蔽行（当前雇主；只在总开关开时生效） */
  const 衍生行 = (组织编号: string, 名称: string): 屏蔽项 => ({
    ...手动行(组织编号, 名称), 来源: '当前雇主', 理由: '当前雇主 · 建档时自动屏蔽',
  });
  /** Backend 完整经历（行业引用 + 真实企业 ID 齐备，完成守卫可过） */
  const 完整经历 = (组织编号: string, 公司 = '示例公司'): 简历经历段 => ({
    ...简历经历初始[0], 编号: `e_${组织编号}`, 公司, 组织编号,
    行业: '互联网', 行业引用: { id: 'tax_i', display_name: '互联网' },
  });
  const BFF块 = (组织编号: string, 名称: string) => ({
    ...BFF隐私组织屏蔽样本, organization_id: 组织编号, organization_display_name: 名称, source: 'manual' as const,
  });
  const 开关键 = () => screen.getByRole('switch', { name: '对这家公司隐藏我的信息' });

  it('旧 hidden=true 但无有效屏蔽：折叠卡不显示「已对该公司隐身」，编辑页开关为关', async () => {
    // Mock 种子 e1：结束 null + 隐藏 true（旧数据代表）——徽标不再读 hidden
    render工作经历({ 数据源: 'mock' });
    expect(screen.queryByText('已对该公司隐身')).toBeNull();
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    expect(开关键().getAttribute('aria-checked')).toBe('false');
  });

  it('有效 manual 屏蔽：徽标显示、开关为开', async () => {
    const 用户 = userEvent.setup();
    render工作经历({
      数据源: 'mock',
      屏蔽名单: [手动行('mock_org_bytedance', '字节跳动')],
      经历: [{ ...简历经历初始[0], 组织编号: 'mock_org_bytedance' }],
    });
    expect(screen.getByText('已对该公司隐身')).toBeTruthy();
    await 用户.click(screen.getByText('字节跳动'));
    expect(开关键().getAttribute('aria-checked')).toBe('true');
  });

  it('Backend 隐私未读：不能把空快照视为无屏蔽，开关退居「核对中」不可写', async () => {
    const 用户 = userEvent.setup();
    render工作经历({ 数据源: 'backend', 经历: [完整经历('org_a')] });
    await 用户.click(screen.getByText('示例公司'));
    expect(screen.queryByRole('switch', { name: '对这家公司隐藏我的信息' })).toBeNull();
    expect(screen.getByText('屏蔽状态核对中')).toBeTruthy();
  });

  it('derived 随「对现雇主隐身」生效：总开关关时开关不显示生效，开启被引导去隐私页而非改写来源', async () => {
    const 添加组织屏蔽 = vi.fn(async () => {});
    const 用户 = userEvent.setup();
    render工作经历({
      数据源: 'backend',
      隐私快照: BFF隐私快照样本,
      屏蔽名单: [衍生行('org_a', '示例公司')],
      雇主隐身: false,
      添加组织屏蔽,
      经历: [完整经历('org_a')],
    });
    // inactive derived：不算有效屏蔽，徽标不显示、开关为关
    expect(screen.queryByText('已对该公司隐身')).toBeNull();
    await 用户.click(screen.getByText('示例公司'));
    expect(开关键().getAttribute('aria-checked')).toBe('false');
    // 用户拨开：不默默开全局保护、不删旧来源，引导去现有隐私页
    await 用户.click(开关键());
    expect(mock轻提示).toHaveBeenCalledWith('这家公司的自动屏蔽当前未生效，请到「设置」开启对现雇主隐身后回来重试');
    expect(开关键().getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText('企业屏蔽待保存')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('简历已保存'));
    expect(添加组织屏蔽).not.toHaveBeenCalled();
  });

  it('未提交意图只标「待保存」：完成回上层保留意图，卡片不冒充「已对该公司隐身」', async () => {
    const 添加组织屏蔽 = vi.fn(async () => {});
    const 用户 = userEvent.setup();
    render工作经历({
      数据源: 'backend', 隐私快照: BFF隐私快照样本, 添加组织屏蔽, 经历: [完整经历('org_a')],
    });
    await 用户.click(screen.getByText('示例公司'));
    await 用户.click(开关键());
    expect(开关键().getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('待保存')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 回上层：意图保留，但只显示「待保存」，不能用「已」字样冒充服务端生效
    expect(screen.queryByText('已对该公司隐身')).toBeNull();
    expect(screen.getByText('企业屏蔽待保存')).toBeTruthy();
    expect(添加组织屏蔽).not.toHaveBeenCalled();
  });

  it('取消仅丢弃本次编辑的意图：零屏蔽写，之后的保存不带任何屏蔽请求', async () => {
    const 添加组织屏蔽 = vi.fn(async () => {});
    const 保存简历 = vi.fn(async () => {});
    const 用户 = userEvent.setup();
    render工作经历({
      数据源: 'backend', 隐私快照: BFF隐私快照样本, 添加组织屏蔽, 保存简历, 经历: [完整经历('org_a')],
    });
    await 用户.click(screen.getByText('示例公司'));
    await 用户.click(开关键());
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.queryByText('企业屏蔽待保存')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(添加组织屏蔽).not.toHaveBeenCalled();
  });

  it('外层保存先按序调用现有屏蔽 API 再存简历：成功后移除意图并权威回读，徽标随后显示', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 已落库 = new Set<string>();
    const 添加组织屏蔽 = vi.fn(async (组织编号: string) => { 已落库.add(组织编号); });
    let 重渲染: () => void = () => {};
    const 重读隐私 = vi.fn(async () => {
      // 权威回读：按已落库集合返回（挂载时的首读 = 空，写后首读 = 已含该组织），
      // 同时把页面名单镜像换成权威值并重渲染，贴近操作层水合
      const 快照 = 从BFF隐私({
        ...BFF隐私快照样本,
        organization_blocks: [...已落库].map((编号) => BFF块(编号, '示例公司')),
        revision: 5 + 已落库.size,
      });
      mock应用状态.状态.屏蔽名单 = 快照.屏蔽名单;
      重渲染();
      return 快照;
    });
    const 视图 = render工作经历({
      数据源: 'backend', 隐私快照: BFF隐私快照样本, 保存简历, 添加组织屏蔽, 重读隐私,
      经历: [完整经历('org_a')],
    });
    重渲染 = 视图.重渲染;
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('示例公司'));
    await 用户.click(开关键());
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(添加组织屏蔽).toHaveBeenCalledWith('org_a', '手动添加');
    // 屏蔽先于简历保存（契约B顺序）
    expect(添加组织屏蔽.mock.invocationCallOrder[0]).toBeLessThan(保存简历.mock.invocationCallOrder[0]);
    expect(mock轻提示).toHaveBeenCalledWith('简历已保存');
    // 意图已移除 + 权威名单含该组织：徽标显示，待保存标记消失
    await waitFor(() => expect(screen.getByText('已对该公司隐身')).toBeTruthy());
    expect(screen.queryByText('企业屏蔽待保存')).toBeNull();
  });

  it('部分成功后重试只补未达成项：已成功项不再重放，失败保留意图不发存简历', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 已落库 = new Set<string>();
    const 添加组织屏蔽 = vi.fn(async (组织编号: string) => {
      if (组织编号 === 'org_b') throw new BFF错误(409, 'version_conflict', 'conflict');
      已落库.add(组织编号);
    });
    let 重渲染: () => void = () => {};
    const 重读隐私 = vi.fn(async () => {
      const 快照 = 从BFF隐私({
        ...BFF隐私快照样本,
        organization_blocks: [...已落库].map((编号) => BFF块(编号, 编号 === 'org_a' ? '甲公司' : '乙公司')),
        revision: 5 + 已落库.size,
      });
      mock应用状态.状态.屏蔽名单 = 快照.屏蔽名单;
      重渲染();
      return 快照;
    });
    const 视图 = render工作经历({
      数据源: 'backend', 隐私快照: BFF隐私快照样本, 保存简历, 添加组织屏蔽, 重读隐私,
      经历: [完整经历('org_a', '甲公司'), 完整经历('org_b', '乙公司')],
    });
    重渲染 = 视图.重渲染;
    const 用户 = userEvent.setup();
    // 两段经历各开一个屏蔽意图（Map 按组织去重、插入顺序即用户表达顺序）
    await 用户.click(screen.getByText('甲公司'));
    await 用户.click(开关键());
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    await 用户.click(screen.getByText('乙公司'));
    await 用户.click(开关键());
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 首次保存：org_a 成功、org_b 409 —— 提示未保存，不发存简历
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('企业屏蔽未保存：数据已在其他地方更新，请重试'));
    expect(保存简历).not.toHaveBeenCalled();
    expect(添加组织屏蔽).toHaveBeenCalledTimes(2);
    // org_a 已达成（意图移除、徽标显示），org_b 意图保留
    await waitFor(() => expect(screen.getByText('已对该公司隐身')).toBeTruthy());
    expect(screen.getByText('企业屏蔽待保存')).toBeTruthy();
    // 409 不盲重放：同轮只调用过一次 org_b
    expect(添加组织屏蔽.mock.calls.filter(([编号]) => 编号 === 'org_b')).toHaveLength(1);
    // 重试：org_a 意图已移除不再重放，只补 org_b；这次成功 → 存简历发出
    添加组织屏蔽.mockImplementation(async (组织编号: string) => { 已落库.add(组织编号); });
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(添加组织屏蔽.mock.calls.filter(([编号]) => 编号 === 'org_a')).toHaveLength(1);
    expect(添加组织屏蔽.mock.calls.filter(([编号]) => 编号 === 'org_b')).toHaveLength(2);
    expect(mock轻提示).toHaveBeenCalledWith('简历已保存');
    await waitFor(() => expect(screen.queryByText('企业屏蔽待保存')).toBeNull());
  });

  it('写操作让路（void 返回未提交）不得假报成功：权威回读未见达成即提示未保存', async () => {
    const 保存简历 = vi.fn(async () => {});
    // 让路形态：同键在途时操作层静默返回 void —— 这里直接模拟「resolve 但没提交」
    const 添加组织屏蔽 = vi.fn(async () => {});
    const 重读隐私 = vi.fn(async () => 从BFF隐私({ ...BFF隐私快照样本, organization_blocks: [], revision: 2 }));
    const 用户 = userEvent.setup();
    render工作经历({
      数据源: 'backend', 隐私快照: BFF隐私快照样本, 保存简历, 添加组织屏蔽, 重读隐私,
      经历: [完整经历('org_a')],
    });
    await 用户.click(screen.getByText('示例公司'));
    await 用户.click(开关键());
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('企业屏蔽未保存，请重试'));
    expect(保存简历).not.toHaveBeenCalled();
    expect(mock轻提示).not.toHaveBeenCalledWith('简历已保存');
    expect(screen.getByText('企业屏蔽待保存')).toBeTruthy();
  });

  it('重试核对当前权威状态：意图已在权威名单（他端已屏蔽）时跳过该项，零重放', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 添加组织屏蔽 = vi.fn(async () => {});
    const 用户 = userEvent.setup();
    const 视图 = render工作经历({
      数据源: 'backend', 隐私快照: BFF隐私快照样本, 保存简历, 添加组织屏蔽,
      经历: [完整经历('org_a')],
    });
    await 用户.click(screen.getByText('示例公司'));
    await 用户.click(开关键());
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 保存前权威名单已含该组织（如 409 处理里操作层重读提交过）：意图已达成
    mock应用状态.状态.屏蔽名单 = [手动行('org_a', '示例公司')];
    视图.重渲染();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(添加组织屏蔽).not.toHaveBeenCalled();
    expect(mock轻提示).toHaveBeenCalledWith('简历已保存');
    // 意图作为已达成项被移除：待保存标记消失，徽标按权威名单显示
    await waitFor(() => expect(screen.queryByText('企业屏蔽待保存')).toBeNull());
    expect(screen.getByText('已对该公司隐身')).toBeTruthy();
  });

  it('derived 屏蔽的解除保留风险确认：确认后才调用现有解除 API，取消零写', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 解除组织屏蔽 = vi.fn(async () => {});
    let 已解除 = false;
    let 重渲染: () => void = () => {};
    const 重读隐私 = vi.fn(async () => {
      // 挂载首读保持 derived 行在场；解除成功后的回读才是空名单
      const 快照 = 从BFF隐私({
        ...BFF隐私快照样本,
        organization_blocks: 已解除 ? [] : [{
          ...BFF隐私组织屏蔽样本, organization_id: 'org_a',
          organization_display_name: '示例公司', source: 'current_employer' as const,
        }],
        revision: 6,
      });
      mock应用状态.状态.屏蔽名单 = 快照.屏蔽名单;
      重渲染();
      return 快照;
    });
    const 视图 = render工作经历({
      数据源: 'backend', 隐私快照: BFF隐私快照样本, 保存简历, 解除组织屏蔽, 重读隐私,
      屏蔽名单: [衍生行('org_a', '示例公司')], 雇主隐身: true,
      经历: [完整经历('org_a')],
    });
    重渲染 = 视图.重渲染;
    解除组织屏蔽.mockImplementation(async () => { 已解除 = true; });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('示例公司'));
    expect(开关键().getAttribute('aria-checked')).toBe('true');
    await 用户.click(开关键());
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 保存先出风险确认；「不解除」零写、意图保留
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    const 确认层 = await screen.findByRole('dialog', { name: '解除企业屏蔽' });
    expect(within(确认层).getByText(/当前雇主或其关联公司/)).toBeTruthy();
    await 用户.click(within(确认层).getByRole('button', { name: '不解除' }));
    expect(解除组织屏蔽).not.toHaveBeenCalled();
    expect(保存简历).not.toHaveBeenCalled();
    expect(screen.getByText('企业屏蔽待保存')).toBeTruthy();
    // 再保存并确认：走现有 解除组织屏蔽（带完整屏蔽项，操作层自行推导风险确认），随后存简历
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    const 确认层2 = await screen.findByRole('dialog', { name: '解除企业屏蔽' });
    await 用户.click(within(确认层2).getByRole('button', { name: '确认解除' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(解除组织屏蔽).toHaveBeenCalledTimes(1);
    expect(解除组织屏蔽).toHaveBeenCalledWith(expect.objectContaining({ 组织编号: 'org_a', 来源: '当前雇主' }));
    expect(mock轻提示).toHaveBeenCalledWith('简历已保存');
  });

  it('必填不完整先阻止整份保存：有屏蔽意图也零隐私写请求', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 添加组织屏蔽 = vi.fn(async () => {});
    const 用户 = userEvent.setup();
    render工作经历({
      数据源: 'backend', 隐私快照: BFF隐私快照样本, 保存简历, 添加组织屏蔽,
      经历: [
        完整经历('org_a'),
        { 编号: 'prefill:exp:0', 公司: '解析公司', 行业: '', 职位: '工程师', 开始: '', 结束: null, 内容: '', 隐藏: false },
      ],
    });
    await 用户.click(screen.getAllByText('示例公司')[0]);
    await 用户.click(开关键());
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    // 缺项拦截先于一切写：零隐私写、零简历保存
    expect(mock轻提示).toHaveBeenCalledWith('还有 1 处需要选择目录或补充必填项');
    expect(添加组织屏蔽).not.toHaveBeenCalled();
    expect(保存简历).not.toHaveBeenCalled();
  });

  // review fix-1（Important spec#1）：数未完成项 只统计 prefill: 物化条目 —— 缺组织编号
  // 的遗留自建行（无 prefill 前缀）漏到 保存简历 映射层才抛错；此时隐私写已发出，违反
  // 「校验失败零写」。混合场景：A 行完整且带待提交屏蔽意图 + B 行缺组织编号 → 整份保存
  // 先被写前完备性预检拦下，零隐私写、零简历保存、意图保留。
  it('缺组织编号的遗留行先拦整份保存：A 行有待提交屏蔽意图也零隐私写（写前守卫）', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 添加组织屏蔽 = vi.fn(async () => {});
    const 用户 = userEvent.setup();
    render工作经历({
      数据源: 'backend', 隐私快照: BFF隐私快照样本, 保存简历, 添加组织屏蔽,
      经历: [
        完整经历('org_a'),
        {
          编号: 'exp_legacy', 公司: '旧自建公司', 行业: '互联网',
          行业引用: { id: 'tax_i', display_name: '互联网' },
          职位: '工程师', 开始: '2020-01', 结束: '2021-01', 内容: '', 隐藏: true,
        },
      ],
    });
    await 用户.click(screen.getAllByText('示例公司')[0]);
    await 用户.click(开关键());
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock轻提示).toHaveBeenCalledWith('还有 1 段经历需要选择公司或补充必填项');
    expect(添加组织屏蔽).not.toHaveBeenCalled();
    expect(保存简历).not.toHaveBeenCalled();
    expect(mock轻提示).not.toHaveBeenCalledWith('简历已保存');
    // 意图保留（未成功不丢弃）
    expect(screen.getByText('企业屏蔽待保存')).toBeTruthy();
  });

  it('新建经历默认 hidden=false，企业屏蔽开关不再改写该字段', async () => {
    const 搜索组织 = vi.fn(async () => ({
      items: [{ organization_id: 'org_fresh', display_name: '新公司', legal_name: null, verification_status: 'unverified' as const }],
      next_cursor: null,
    }));
    const 查询Taxonomy = vi.fn(async () => ({
      items: [{ id: 'tax_i', display_name: '互联网', parent_id: null, selectable: true }],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    const 用户 = userEvent.setup();
    render工作经历({
      数据源: 'backend', 隐私快照: BFF隐私快照样本, 经历: [], 搜索组织, 查询Taxonomy,
    });
    await 用户.click(screen.getByRole('button', { name: /添加工作经历/ }));
    await 用户.click(screen.getByText('公司名称'));
    const 抽屉 = await screen.findByRole('dialog', { name: '选择企业' });
    // 空词不发搜索：先输入触发搜索，再点候选行回填真实 ID
    await 用户.type(within(抽屉).getByPlaceholderText('输入公司名称'), '新公司');
    await 用户.click(await within(抽屉).findByText('新公司'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择企业' })).toBeNull());
    await 用户.type(screen.getByPlaceholderText('必填'), '工程师');
    await 用户.click(screen.getByRole('button', { name: '入职年月' }));
    await 用户.click(within(await screen.findByRole('dialog', { name: '选择入职年月' })).getByRole('button', { name: '确定' }));
    await 用户.click(screen.getByText('所属行业'));
    await 用户.click(await screen.findByText('互联网'));
    // 打开企业屏蔽开关：只进待提交意图，不写 hidden
    await 用户.click(开关键());
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 存简历调用 = (mock应用状态.派发.mock.calls as { 型?: string; 经历?: { 隐藏?: boolean }[] }[][])
      .filter(([动作]) => 动作.型 === '存简历').at(-1);
    expect(存简历调用![0].经历![0].隐藏).toBe(false);
  });

  it('Mock 同组织同步：保存走既有隐私 reducer（拉黑带组织编号），两段同企业经历徽标同步', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 视图 = render工作经历({
      数据源: 'mock', 保存简历,
      经历: [
        { ...简历经历初始[0], 组织编号: 'mock_org_bytedance' },
        { ...简历经历初始[0], 编号: 'e1b', 职位: '另一岗位', 组织编号: 'mock_org_bytedance' },
      ],
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getAllByText('字节跳动')[0]);
    await 用户.click(开关键());
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 同企业两段经历共用一条意图：两张卡都标「待保存」
    expect(screen.getAllByText('企业屏蔽待保存')).toHaveLength(2);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    // Mock 走已有隐私 reducer：拉黑带组织编号（同组织同步的键）
    const 拉黑调用 = (mock应用状态.派发.mock.calls as { 型?: string; 名称?: string; 组织编号?: string }[][])
      .find(([动作]) => 动作.型 === '拉黑');
    expect(拉黑调用![0]).toMatchObject({ 名称: '字节跳动', 组织编号: 'mock_org_bytedance' });
    // 权威名单（reducer 落地）后两段卡同步显示徽标、待保存标记消失
    mock应用状态.状态.屏蔽名单 = [手动行('mock_org_bytedance', '字节跳动')];
    视图.重渲染();
    await waitFor(() => expect(screen.getAllByText('已对该公司隐身')).toHaveLength(2));
    expect(screen.queryByText('企业屏蔽待保存')).toBeNull();
  });
});
