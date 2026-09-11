// 选工作城市 Backend 接入测试（Task 3 / Task 5）：
// Task 5 起 Backend 与 Mock 共用同一套 Mock JSX（当前定位 / 热门城市 / 行政区分组 /
// 搜索结果 / 已选条），Backend 的默认目录页不发空 q，分组标题只用返回的行政区/国家字段，
// 当前定位显示已批准的「暂未获取定位」缺失态（不假选上海），翻页只走既有滚动容器。

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 选工作城市 from './选工作城市';

const mock返回 = vi.fn();
// vi.mock 工厂在 import 时执行，用可变 holder 让每个用例注入不同的应用状态值
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any = {};

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

/** deferred promise：测试控制慢响应到达的时机 */
function deferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
}

/** 造一条 Location 目录项（字段全部来自后端返回） */
function 城(项: {
  id: string;
  display_name: string;
  admin1_name?: string | null;
  country_name?: string;
}) {
  return {
    id: 项.id,
    display_name: 项.display_name,
    country_code: 'CN',
    country_name: 项.country_name ?? '中国',
    admin1_code: 项.admin1_name === undefined ? '31' : '31',
    admin1_name: 项.admin1_name === undefined ? '上海市' : 项.admin1_name,
    timezone: 'Asia/Shanghai',
    population: 0,
  };
}

/** 在既有滚动容器（.滚动区）上触发一次「已到底」滚动事件——不新增任何节点 */
function 滚到底(容器: Element) {
  Object.defineProperty(容器, 'scrollHeight', { value: 1000, configurable: true });
  Object.defineProperty(容器, 'clientHeight', { value: 400, configurable: true });
  Object.defineProperty(容器, 'scrollTop', { value: 600, configurable: true, writable: true });
  fireEvent.scroll(容器);
}

function 列表容器(): Element {
  const 容器 = document.querySelector('.滚动区');
  if (!容器) throw new Error('找不到既有滚动容器');
  return 容器;
}

/** 空意向草稿（含 Task 3 新增的可选引用字段）*/
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

function render城市页(选项: {
  数据源: 'backend' | 'mock';
  查询Location?: ReturnType<typeof vi.fn>;
}) {
  const 派发 = vi.fn();
  mock应用状态 = {
    数据源模式: 选项.数据源,
    目录查询:
      选项.数据源 === 'backend'
        ? {
            查询Location: 选项.查询Location ?? vi.fn(),
            查询Taxonomy: vi.fn(),
            查询Institution: vi.fn(),
          }
        : null,
    状态: {
      引导预填: { 城市们: [] as string[], 职位: [] as string[] },
      意向草稿: { ...空草稿 },
    },
    派发,
  };
  render(
    <MemoryRouter>
      <选工作城市 />
    </MemoryRouter>,
  );
  return { 派发 };
}

describe('选工作城市 Backend', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('默认目录页点上海市保存 Location ID，查询不带 q 也不带省标题', async () => {
    const 查询Location = vi.fn(async (_query: { q?: string; cursor?: string; admin1Code?: string }) => ({
      items: [城({ id: 'loc_sh', display_name: '上海市' })],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    const { 派发 } = render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    // 默认查询：不发 q，也不把省标题当 payload
    await waitFor(() => expect(查询Location).toHaveBeenCalled());
    const 首次参数 = 查询Location.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(首次参数)).not.toContain('q');
    expect(Object.keys(首次参数)).not.toContain('admin1Code');

    await 用户.click((await screen.findAllByText('上海市'))[0]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        城市引用们: [{ id: 'loc_sh', display_name: '上海市' }],
      }),
    );
  });

  it('搜索发送 q 而不扫描本地城市字典', async () => {
    const 查询Location = vi.fn(async () => ({
      items: [],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByPlaceholderText('搜索城市 / 省份'), '杭州市');
    await waitFor(() =>
      expect(查询Location).toHaveBeenCalledWith(
        expect.objectContaining({ q: '杭州市' }),
      ),
    );
  });

  // Task 5：当前定位是已批准的缺失态，不能假选上海
  it('当前定位显示「暂未获取定位」且点不出上海（Task 5）', async () => {
    const 查询Location = vi.fn(async () => ({
      items: [城({ id: 'loc_sh', display_name: '上海' })],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    const 定位 = await screen.findByText('暂未获取定位');
    await 用户.click(定位);
    // 没有已选条、保存仍禁用：缺失态点不出任何城市
    expect(screen.queryByText('已选')).toBeNull();
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
  });

  // Task 5：热门区与行政区分组都来自返回字段，不编造省份、不造「其他地区」
  it('默认热门与行政区分组均来自返回字段（Task 5）', async () => {
    const 查询Location = vi.fn(async () => ({
      items: [
        城({ id: 'loc_gz', display_name: '广州市', admin1_name: '广东省' }),
        城({ id: 'loc_sg', display_name: '新加坡', admin1_name: null, country_name: '新加坡' }),
      ],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    render城市页({ 数据源: 'backend', 查询Location });
    // 热门区：默认推荐顺序的返回项
    await screen.findAllByText('广州市');
    // 行政区分组标题用返回的 admin1_name
    expect(screen.getByText('广东省')).toBeTruthy();
    // 未知行政区用返回的国家名，不编造省份、不造「其他地区」
    expect(screen.getByText('新加坡', { selector: 'div' })).toBeTruthy();
    expect(screen.queryByText('其他地区')).toBeNull();
    // Mock 的硬编码省墙标题不出现在 Backend
    expect(screen.queryByText('直辖市')).toBeNull();
    expect(screen.queryByText('港澳台')).toBeNull();
  });

  // Task 5：翻页只走既有滚动容器，不新增「加载更多」节点
  it('滚到底追加下一页且没有「加载更多」按钮（Task 5）', async () => {
    const 查询Location = vi.fn(async (query: { cursor?: string }) => {
      if (query.cursor === 'cur_1') {
        return {
          items: [城({ id: 'loc_hz', display_name: '杭州市', admin1_name: '浙江省' })],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return {
        items: [城({ id: 'loc_sh', display_name: '上海市' })],
        nextCursor: 'cur_1',
        catalogVersion: 'v2',
      };
    });
    render城市页({ 数据源: 'backend', 查询Location });
    await screen.findAllByText('上海市');
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
    滚到底(列表容器());
    await screen.findAllByText('杭州市');
    expect(查询Location).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'cur_1' }));
  });

  // Task 5：同名不同 ID 的两条，各自独立移除，不互相误删
  it('同名不同 ID 的已选条各自独立移除（Task 5）', async () => {
    const 查询Location = vi.fn(async () => ({
      items: [
        城({ id: 'loc_a', display_name: '朝阳', admin1_name: '北京市' }),
        城({ id: 'loc_b', display_name: '朝阳', admin1_name: '辽宁省' }),
      ],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    const { 派发 } = render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    const 两枚 = await waitFor(() => {
      const 全部 = screen.getAllByRole('button', { name: '朝阳' });
      expect(全部.length).toBeGreaterThanOrEqual(4); // 热门区 2 枚 + 两个行政区分组各 1 枚
      return 全部;
    });
    await 用户.click(两枚[0]);
    await 用户.click(两枚[1]);
    // 已选条里两枚同名 chip：点掉第一枚，另一枚必须还在
    const chips = screen.getAllByRole('button', { name: '朝阳 ✕' });
    expect(chips).toHaveLength(2);
    await 用户.click(chips[0]);
    expect(screen.getAllByRole('button', { name: '朝阳 ✕' })).toHaveLength(1);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        城市引用们: [{ id: 'loc_b', display_name: '朝阳' }],
      }),
    );
  });

  // Task 5：换词后旧查询的下一页迟到，不得落进新查询的结果
  it('换词后旧搜索页迟到不污染新结果（Task 5）', async () => {
    const A第二页 = deferredPromise<{ items: unknown[]; nextCursor: string | null; catalogVersion: string }>();
    const 查询Location = vi.fn(async (query: { q?: string; cursor?: string }) => {
      if (query.cursor === 'a_cur_1') return A第二页.promise;
      if (query.q === 'A') {
        return { items: [城({ id: 'loc_a1', display_name: 'A城' })], nextCursor: 'a_cur_1', catalogVersion: 'v2' };
      }
      if (query.q === 'B') {
        return { items: [城({ id: 'loc_b1', display_name: 'B城' })], nextCursor: null, catalogVersion: 'v2' };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    const 输入 = screen.getByPlaceholderText('搜索城市 / 省份');
    await 用户.type(输入, 'A');
    await screen.findByText('A城');
    // 滚到底：A 的第二页在飞行中
    滚到底(列表容器());
    await waitFor(() => expect(查询Location).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'a_cur_1' })));
    // 换词到 B
    await 用户.clear(输入);
    await 用户.type(输入, 'B');
    await screen.findByText('B城', undefined, { timeout: 3000 });
    A第二页.resolve({ items: [城({ id: 'loc_a2', display_name: 'A城2（过期）' })], nextCursor: null, catalogVersion: 'v2' });
    await waitFor(() => expect(查询Location).toHaveBeenCalled());
    expect(screen.queryByText('A城2（过期）')).toBeNull();
    expect(screen.getByText('B城')).toBeTruthy();
  });
});

describe('选工作城市 Mock', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('本地城市字典与 DOM 不变，保存带空引用数组', async () => {
    const { 派发 } = render城市页({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 「上海」在当前定位 / 热门城市 / 直辖市 三处都出现，取第一枚点选
    await 用户.click(screen.getAllByText('上海')[0]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        城市们: ['上海'],
        城市引用们: [],
      }),
    );
  });
});
