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
  工作城市引用: undefined as { id: string; display_name: string } | undefined,
  期望职位: '',
  感兴趣城市们: [] as string[],
  感兴趣城市引用们: [] as string[],
  薪资下限: null,
  薪资上限: null,
  期望行业们: [] as string[],
  后端招聘类型: null,
  求职类型已改: false,
};

/** 轻提示 是挂在 document.body 上的纯 DOM 单例，RTL cleanup 不清它 */
function 轻提示文案们(): string[] {
  for (const 节点 of Array.from(document.body.children)) {
    const 元素 = 节点 as HTMLElement;
    if (元素.style.position === 'fixed' && 元素.style.zIndex === '999') {
      return Array.from(元素.children).map((条) => 条.textContent ?? '');
    }
  }
  return [];
}

function render城市页(选项: {
  数据源: 'backend' | 'mock';
  查询Location?: ReturnType<typeof vi.fn>;
  来源意向?: boolean;
  引导城市们?: string[];
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
      引导预填: { 城市们: 选项.引导城市们 ?? [], 职位: [] as string[] },
      意向草稿: { ...空草稿 },
    },
    派发,
  };
  render(
    <MemoryRouter initialEntries={选项.来源意向 ? ['/onboard/city?来源=意向'] : undefined}>
      <选工作城市 />
    </MemoryRouter>,
  );
  return { 派发 };
}

describe('选工作城市 Backend', () => {
  beforeEach(() => {
    mock返回.mockClear();
    for (const 节点 of Array.from(document.body.children)) {
      const 元素 = 节点 as HTMLElement;
      if (元素.style.position === 'fixed' && 元素.style.zIndex === '999') 元素.innerHTML = '';
    }
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
    for (const 节点 of Array.from(document.body.children)) {
      const 元素 = 节点 as HTMLElement;
      if (元素.style.position === 'fixed' && 元素.style.zIndex === '999') 元素.innerHTML = '';
    }
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

  // Task 2：候选引导的多选上限保持 —— 第 11 枚被拒并提示，可取消已选后再补
  it('多选上限 10：第 11 枚被拒并提示，取消一枚后可再选', async () => {
    render城市页({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    const 热门 = ['北京', '上海', '深圳', '广州', '杭州', '成都', '南京', '武汉', '苏州', '西安'];
    for (const 城 of 热门) {
      await 用户.click(screen.getAllByRole('button', { name: 城 })[0]);
    }
    expect(screen.getByText('10/10')).toBeTruthy();
    await 用户.click(screen.getAllByRole('button', { name: '长沙' })[0]);
    expect(screen.getByText('10/10')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '长沙 ✕' })).toBeNull();
    expect(轻提示文案们()).toContain('最多选 10 个');
    await 用户.click(screen.getByRole('button', { name: '西安 ✕' }));
    await 用户.click(screen.getAllByRole('button', { name: '长沙' })[0]);
    expect(screen.getByRole('button', { name: '长沙 ✕' })).toBeTruthy();
  });
});

// ── Task 2：意向单选与失败/无结果分界（共用正文后的页面回归）──

describe('选工作城市 意向单选与错误态（Task 2）', () => {
  beforeEach(() => {
    mock返回.mockClear();
    for (const 节点 of Array.from(document.body.children)) {
      const 元素 = 节点 as HTMLElement;
      if (元素.style.position === 'fixed' && 元素.style.zIndex === '999') 元素.innerHTML = '';
    }
  });

  it('意向来源：单选替换、无 N/10 计数、保存带 id+name 引用', async () => {
    const 查询Location = vi.fn(async () => ({
      items: [
        城({ id: 'loc_bj', display_name: '北京市', admin1_name: '北京市' }),
        城({ id: 'loc_sh', display_name: '上海市', admin1_name: '上海市' }),
      ],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    const { 派发 } = render城市页({ 数据源: 'backend', 查询Location, 来源意向: true });
    const 用户 = userEvent.setup();
    // 单选：不渲染 N/10 计数
    expect(screen.queryByText('0/10')).toBeNull();
    await screen.findAllByText('北京市');
    await 用户.click(screen.getAllByRole('button', { name: '北京市' })[0]);
    await 用户.click(screen.getAllByRole('button', { name: '上海市' })[0]);
    // 点新的取代旧的：只剩一枚已选
    expect(screen.getByRole('button', { name: '上海市 ✕' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '北京市 ✕' })).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '改意向草稿',
        补丁: expect.objectContaining({
          工作城市: '上海市',
          工作城市引用: { id: 'loc_sh', display_name: '上海市' },
        }),
      }),
    );
  });

  /** 行内错误行（正文列表区）：错误文案同时会出现在全局轻提示里，用行内容器定位 */
  const 错误行 = () => document.querySelector('[class*="错误行"]');

  it('默认页失败显示错误与重试，重试成功后渲染目录（失败不装成成功空页）', async () => {
    let 调用 = 0;
    const 查询Location = vi.fn(async () => {
      调用 += 1;
      if (调用 === 1) throw new Error('boom');
      return {
        items: [城({ id: 'loc_sh', display_name: '上海市' })],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    });
    render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    await waitFor(() => expect(错误行()).toBeTruthy());
    // 失败 ≠ 无结果
    expect(screen.queryByText('没有匹配的城市，换个词试试。')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findAllByRole('button', { name: '上海市' })).toBeTruthy();
    await waitFor(() => expect(错误行()).toBeNull());
    expect(查询Location).toHaveBeenCalledTimes(2);
  });

  it('搜索失败显示错误与重试且用当前词重发；成功 0 条显示无结果', async () => {
    let 调用 = 0;
    const 查询Location = vi.fn(async (query: { q?: string }) => {
      if (query.q === undefined) {
        return { items: [], nextCursor: null, catalogVersion: 'v2' };
      }
      调用 += 1;
      if (调用 === 1) throw new Error('boom');
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByPlaceholderText('搜索城市 / 省份'), '不存在的城');
    await waitFor(() => expect(错误行()).toBeTruthy());
    expect(screen.queryByText('没有匹配的城市，换个词试试。')).toBeNull();
    // 重试使用当前词重发
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(查询Location).toHaveBeenCalledTimes(2));
    // 重试成功但 0 条：显示无结果，行内错误撤掉
    expect(await screen.findByText('没有匹配的城市，换个词试试。')).toBeTruthy();
    await waitFor(() => expect(错误行()).toBeNull());
  });
});
