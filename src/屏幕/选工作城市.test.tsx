// 选工作城市 测试（Task 3 / Task 4 + picker Task 2 merge 调和）：
// Backend：默认目录按 CN/TW/HK/MO 四支查询，聚合项按行政区分组（CN 用 admin1、
// TW/HK/MO 三个中文组标题）；热门区是 12+10 精选（无港澳台精选），与返回项无关；
// 全球搜索发 q 不带国家限制；保存提交目录选择值（HTTP 层只发 ID）；翻页只走既有滚动容器。
// 注册多选上限 10；?来源=意向 单选写 意向草稿.工作城市。
// Mock：默认分组用 Mock默认城市字典（四直辖市分别列出、港澳台拆三组中文标题/英文条目、
// 无海外长组），搜索读 Mock城市搜索字典（海外仍可搜），已有中文历史值不迁移仍可删。
// picker Task 2（共用正文）：意向单选（目录项路径）、正文错误行/分支重试、多选上限。

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
  countryCode?: string;
  admin1_name?: string | null;
  country_name?: string;
}) {
  return {
    id: 项.id,
    display_name: 项.display_name,
    country_code: 项.countryCode ?? 'CN',
    country_name: 项.country_name ?? 项.countryCode ?? '中国',
    // admin1_code 缺省时跟省名走：不同省不同码（聚合按 code，码相同会被并进一组）
    admin1_code: 项.admin1_name === undefined ? '31' : 项.admin1_name,
    admin1_name: 项.admin1_name === undefined ? '上海市' : 项.admin1_name,
    timezone: 'Asia/Shanghai',
    population: 0,
  };
}

type 页形 = { items: ReturnType<typeof 城>[]; nextCursor: string | null };
type 国家名 = 'CN' | 'TW' | 'HK' | 'MO';

/** 四支分发桩：按 countryCode 返回各自页；搜索词命中时返回搜索结果 */
function 四国桩(配置: Partial<Record<国家名, 页形>> & { 搜索?: 页形; 首页版本?: string }) {
  return vi.fn(async (query: { q?: string; countryCode?: string; cursor?: string; limit?: number }) => {
    if (query.q !== undefined) {
      return { ...(配置.搜索 ?? { items: [], nextCursor: null }), catalogVersion: 'v2' };
    }
    const 页 = 配置[(query.countryCode ?? 'CN') as 国家名] ?? { items: [], nextCursor: null };
    return { ...页, catalogVersion: 配置.首页版本 ?? 'v2' };
  });
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
  来源意向?: boolean;
  Mock城市们?: string[];
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
      引导预填: { 城市们: 选项.Mock城市们 ?? ([] as string[]), 职位: [] as string[] },
      意向草稿: { ...空草稿 },
    },
    派发,
  };
  render(
    <MemoryRouter initialEntries={[选项.来源意向 ? '/onboard/city?来源=意向' : '/onboard/city']}>
      <选工作城市 />
    </MemoryRouter>,
  );
  return { 派发 };
}

describe('选工作城市 Backend', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('默认目录并发四支查询（无 q / 无 admin1Code），点目录项保存 Location ID', async () => {
    const 查询Location = 四国桩({
      CN: { items: [城({ id: 'loc_sh', display_name: '上海市' })], nextCursor: null },
    });
    const { 派发 } = render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    await waitFor(() => expect(查询Location).toHaveBeenCalledTimes(4));
    // 四支各自 {countryCode, limit}，不带 q，也不把省标题当 payload
    const 调用 = 查询Location.mock.calls as unknown[][];
    expect(调用.map((单调用) => (单调用[0] as { countryCode?: string }).countryCode)).toEqual(['CN', 'TW', 'HK', 'MO']);
    for (const 单调用 of 调用) {
      expect(Object.keys(单调用[0] as Record<string, unknown>)).not.toContain('q');
      expect(Object.keys(单调用[0] as Record<string, unknown>)).not.toContain('admin1Code');
    }

    // 精选区也有规范名「上海市」，目录项在行政区分组里（DOM 尾部）—— 取末枚点目录项
    await 用户.click((await screen.findAllByRole('button', { name: '上海市' })).at(-1)!);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        城市引用们: [{ id: 'loc_sh', display_name: '上海市' }],
      }),
    );
  });

  it('两个精选区渲染 12+10 精选、无港澳台精选，海外精选按 canonical ID 保存', async () => {
    const 查询Location = 四国桩({});
    const { 派发 } = render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    // 两个精选区标题与精选条目（静态配置，不等目录返回；Task 6 起为目录规范名）
    expect(screen.getByText('国内热门城市')).toBeTruthy();
    expect(screen.getByText('海外热门城市')).toBeTruthy();
    expect(screen.getByRole('button', { name: '北京市' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Singapore' })).toBeTruthy();
    // 海外映射不错误加后缀：只有权威英文名，不出现「Singapore市」
    expect(screen.queryByRole('button', { name: 'Singapore市' })).toBeNull();
    // 港澳台不进精选：精选配置之外不出现这些名字的精选条目
    expect(screen.queryByRole('button', { name: 'Taipei' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hong Kong' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Macau' })).toBeNull();

    // 注册多选：国内 + 海外精选各选一枚，计数与提交都按 ID
    await 用户.click(screen.getByRole('button', { name: '北京市' }));
    await 用户.click(screen.getByRole('button', { name: 'Singapore' }));
    expect(screen.getByText('2/10')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        城市引用们: [
          { id: 'loc_7gn74qrcymqcwwuqwotm47dbba', display_name: '北京市' },
          { id: 'loc_qdyx7r6fcyjrcokobaxsorhhrm', display_name: 'Singapore' },
        ],
      }),
    );
  });

  it('搜索发送 q 而不扫描本地城市字典', async () => {
    const 查询Location = 四国桩({});
    render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByPlaceholderText('搜索城市 / 省份'), '杭州市');
    await waitFor(() =>
      expect(查询Location).toHaveBeenCalledWith(
        expect.objectContaining({ q: '杭州市' }),
      ),
    );
    const 搜索调用 = (查询Location.mock.calls as unknown[][]).find(
      (单调用) => (单调用[0] as { q?: string }).q === '杭州市',
    );
    expect((搜索调用![0] as Record<string, unknown>)).not.toHaveProperty('countryCode');
  });

  // Task 5：当前定位是已批准的缺失态，不能假选上海
  it('当前定位显示「暂未获取定位」且点不出上海（Task 5）', async () => {
    const 查询Location = 四国桩({
      CN: { items: [城({ id: 'loc_sh', display_name: '上海' })], nextCursor: null },
    });
    render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    const 定位 = await screen.findByText('暂未获取定位');
    await 用户.click(定位);
    // 没有已选条、保存仍禁用：缺失态点不出任何城市
    expect(screen.queryByText('已选')).toBeNull();
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
  });

  // Task 4：热门区来自精选配置，行政区分组来自返回字段（CN 用 admin1，港澳台用中文固定标题）
  it('分组标题：CN 用返回 admin1_name，港澳台用三个中文标题且条目为 API 原名', async () => {
    const 查询Location = 四国桩({
      CN: { items: [城({ id: 'loc_gz', display_name: '广州市', admin1_name: '广东省' })], nextCursor: null },
      TW: { items: [城({ id: 'loc_tpe', display_name: 'Taipei', countryCode: 'TW', admin1_name: 'Taipei' })], nextCursor: null },
      HK: { items: [城({ id: 'loc_hk', display_name: 'Hong Kong', countryCode: 'HK', admin1_name: 'Hong Kong' })], nextCursor: null },
      MO: { items: [城({ id: 'loc_mo', display_name: 'Macau', countryCode: 'MO', admin1_name: null })], nextCursor: null },
    });
    render城市页({ 数据源: 'backend', 查询Location });
    await screen.findAllByText('广州市');
    // 行政区分组标题用返回的 admin1_name；港澳台无视细分用中文标题
    expect(screen.getByText('广东省')).toBeTruthy();
    expect(screen.getByText('台湾省')).toBeTruthy();
    expect(screen.getByText('香港特别行政区')).toBeTruthy();
    expect(screen.getByText('澳门特别行政区')).toBeTruthy();
    expect(screen.getByText('Taipei')).toBeTruthy();
    // 不造「其他地区」，Mock 的硬编码省墙标题不出现在 Backend
    expect(screen.queryByText('其他地区')).toBeNull();
    expect(screen.queryByText('直辖市')).toBeNull();
    expect(screen.queryByText('港澳台')).toBeNull();
    expect(screen.queryByText('海外')).toBeNull();
  });

  // Task 5：翻页只走既有滚动容器，不新增「加载更多」节点；Task 4：按各支游标续页
  it('滚到底按国家分支追加下一页且没有「加载更多」按钮（Task 4）', async () => {
    const 查询Location = vi.fn(async (query: { countryCode?: string; cursor?: string }) => {
      if (query.countryCode === 'CN' && query.cursor === 'cur_1') {
        return { items: [城({ id: 'loc_hz', display_name: '杭州市', admin1_name: '浙江省' })], nextCursor: null, catalogVersion: 'v2' };
      }
      if (query.countryCode === 'CN') {
        return { items: [城({ id: 'loc_sh', display_name: '上海市' })], nextCursor: 'cur_1', catalogVersion: 'v2' };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render城市页({ 数据源: 'backend', 查询Location });
    await screen.findAllByText('上海市');
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
    滚到底(列表容器());
    await screen.findAllByText('杭州市');
    expect(查询Location).toHaveBeenLastCalledWith(expect.objectContaining({ countryCode: 'CN', cursor: 'cur_1' }));
  });

  it('?来源=意向 单选：后点取代先点，保存写 意向草稿.工作城市', async () => {
    const 查询Location = 四国桩({});
    const { 派发 } = render城市页({ 数据源: 'backend', 查询Location, 来源意向: true });
    const 用户 = userEvent.setup();
    await 用户.click(await screen.findByRole('button', { name: '北京市' }));
    await 用户.click(screen.getByRole('button', { name: 'Singapore' }));
    // 单选：后点取代先点
    expect(screen.getAllByRole('button', { name: /Singapore ✕|移除/ })).toHaveLength(1);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '改意向草稿',
        补丁: {
          工作城市: 'Singapore',
          工作城市引用: { id: 'loc_qdyx7r6fcyjrcokobaxsorhhrm', display_name: 'Singapore' },
        },
      }),
    );
  });

  // Task 5：同名不同 ID 的两条，各自独立移除，不互相误删
  it('同名不同 ID 的已选条各自独立移除（Task 5）', async () => {
    const 查询Location = vi.fn(async (query: { countryCode?: string; cursor?: string }) => {
      if (query.countryCode === 'CN' && query.cursor === 'cur_1') {
        return { items: [城({ id: 'loc_b', display_name: '朝阳', admin1_name: '辽宁省' })], nextCursor: null, catalogVersion: 'v2' };
      }
      if (query.countryCode === 'CN') {
        return { items: [城({ id: 'loc_a', display_name: '朝阳', admin1_name: '北京市' })], nextCursor: 'cur_1', catalogVersion: 'v2' };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    const { 派发 } = render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    // 第一页：北京市朝阳一枚（热门区来自精选配置，与返回项无关）
    await 用户.click((await screen.findByRole('button', { name: '朝阳' })));
    // 翻页后点第二枚（不同 ID 的同名城市）
    滚到底(列表容器());
    // eslint-disable-next-line no-console
    await screen.findByText('辽宁省');
    await 用户.click(screen.getAllByRole('button', { name: '朝阳' }).at(-1)!);
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
    const 查询Location = vi.fn(async (query: { q?: string; countryCode?: string; cursor?: string }) => {
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

  it('搜索清空恢复默认目录：已选与精选区保持（Task 4）', async () => {
    const 查询Location = 四国桩({
      CN: { items: [城({ id: 'loc_sh', display_name: '上海市' })], nextCursor: null },
      搜索: { items: [城({ id: 'loc_a1', display_name: 'A城' })], nextCursor: null },
    });
    render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    await 用户.click(await screen.findByRole('button', { name: '北京市' }));
    await 用户.type(screen.getByPlaceholderText('搜索城市 / 省份'), 'A');
    await screen.findByText('A城');
    await 用户.clear(screen.getByPlaceholderText('搜索城市 / 省份'));
    // 清空恢复：精选区与默认分组回来，已选计数不丢
    expect(await screen.findByText('国内热门城市')).toBeTruthy();
    expect(screen.getByText('1/10')).toBeTruthy();
    expect(screen.getByRole('button', { name: '北京市 ✕' })).toBeTruthy();
  });
});

describe('选工作城市 Mock', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('本地城市字典与 DOM 不变，保存带空引用数组（Mock 城名按规范名归一）', async () => {
    const { 派发 } = render城市页({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 「上海市」在当前定位 / 精选区 / 上海组 三处都出现，取第一枚点选
    await 用户.click(screen.getAllByText('上海市')[0]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        城市们: ['上海市'],
        城市引用们: [],
      }),
    );
  });

  it('默认分组：四直辖市分别列出、港澳台拆三组中文标题配英文条目、精选区同名展示', () => {
    render城市页({ 数据源: 'mock' });
    // 四直辖市分别列出（组标题是 div，与精选区按钮/组内城片区分开）
    expect(screen.getByText('北京', { selector: 'div' })).toBeTruthy();
    expect(screen.getByText('上海', { selector: 'div' })).toBeTruthy();
    expect(screen.getByText('天津', { selector: 'div' })).toBeTruthy();
    expect(screen.getByText('重庆', { selector: 'div' })).toBeTruthy();
    // 港澳台拆三组：中文组标题 + API 英文条目
    expect(screen.getByText('台湾省')).toBeTruthy();
    expect(screen.getByText('香港特别行政区')).toBeTruthy();
    expect(screen.getByText('澳门特别行政区')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Taipei' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hong Kong' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Macau' })).toBeTruthy();
    // 两个精选区
    expect(screen.getByText('国内热门城市')).toBeTruthy();
    expect(screen.getByText('海外热门城市')).toBeTruthy();
    // 海外长组不再渲染：海外仅经精选或搜索可达
    expect(screen.queryByText('海外', { selector: 'div' })).toBeNull();
    expect(screen.queryByRole('button', { name: '迪拜' })).toBeNull();
    expect(screen.queryByText('港澳台')).toBeNull();
    expect(screen.queryByText('直辖市')).toBeNull();
  });

  it('搜索范围未缩窄：旧中文海外名与规范英文名都能搜到（Task 6）', async () => {
    render城市页({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 旧中文别名「新加坡」仍能找到规范项
    await 用户.type(screen.getByPlaceholderText('搜索城市 / 省份'), '新加坡');
    expect(await screen.findByRole('button', { name: 'Singapore' })).toBeTruthy();
    // 规范名本身也能搜到，且不与别名重复成两条
    await 用户.clear(screen.getByPlaceholderText('搜索城市 / 省份'));
    await 用户.type(screen.getByPlaceholderText('搜索城市 / 省份'), 'Singapore');
    expect(await screen.findByRole('button', { name: 'Singapore' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Singapore' })).toHaveLength(1);
  });

  it('已有中文港澳台历史值不迁移：仍正常展示并可删除', async () => {
    render城市页({ 数据源: 'mock', Mock城市们: ['香港'] });
    const 用户 = userEvent.setup();
    // 历史值不因默认字典改英文名而丢失
    expect(await screen.findByRole('button', { name: '香港 ✕' })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '香港 ✕' }));
    expect(screen.queryByRole('button', { name: '香港 ✕' })).toBeNull();
    expect(screen.getByText('0/10')).toBeTruthy();
  });
});

// ── merge 调和：picker Task 2 的共用正文错误/重试、意向单选（目录项路径）与多选上限 ──
// 断言语义不变，测试构造按「对方数据形态为底」适配：默认页失败指四支中的失败支，
// 重试走分支重试语义（只补失败支首页，成功且游标尽的其他支不再请求）。

describe('选工作城市 意向单选与错误态（picker Task 2）', () => {
  beforeEach(() => {
    mock返回.mockClear();
    for (const 节点 of Array.from(document.body.children)) {
      const 元素 = 节点 as HTMLElement;
      if (元素.style.position === 'fixed' && 元素.style.zIndex === '999') 元素.innerHTML = '';
    }
  });

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

  it('意向来源：目录项单选替换、无 N/10 计数、保存带 id+name 引用', async () => {
    const 查询Location = 四国桩({
      CN: {
        items: [
          城({ id: 'loc_bj', display_name: '北京市', admin1_name: '北京市' }),
          城({ id: 'loc_sh', display_name: '上海市', admin1_name: '上海市' }),
        ],
        nextCursor: null,
      },
    });
    const { 派发 } = render城市页({ 数据源: 'backend', 查询Location, 来源意向: true });
    const 用户 = userEvent.setup();
    // 单选：不渲染 N/10 计数
    expect(screen.queryByText('0/10')).toBeNull();
    await screen.findAllByText('北京市');
    // 精选区同名规范名在前，目录项在行政区分组（DOM 尾部）—— 取末枚点目录项
    await 用户.click(screen.getAllByRole('button', { name: '北京市' }).at(-1)!);
    await 用户.click(screen.getAllByRole('button', { name: '上海市' }).at(-1)!);
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

  it('默认页失败显示错误与重试，重试只补失败支并渲染目录（失败不装成成功空页）', async () => {
    let CN调用 = 0;
    const 查询Location = vi.fn(async (query: { countryCode?: string }) => {
      if (query.countryCode !== 'CN') {
        return { items: [], nextCursor: null, catalogVersion: 'v2' };
      }
      CN调用 += 1;
      if (CN调用 === 1) throw new Error('boom');
      return { items: [城({ id: 'loc_sh', display_name: '上海市' })], nextCursor: null, catalogVersion: 'v2' };
    });
    render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    await waitFor(() => expect(错误行()).toBeTruthy());
    // 失败 ≠ 无结果
    expect(screen.queryByText('没有匹配的城市，换个词试试。')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findAllByRole('button', { name: '上海市' })).toBeTruthy();
    await waitFor(() => expect(错误行()).toBeNull());
    // 重试 = 分支重试语义：四支首页 + 只补 CN 一枚（成功且游标尽的其他支不再请求）
    const 调用 = 查询Location.mock.calls as unknown[][];
    expect(调用).toHaveLength(5);
    expect(调用.at(-1)![0]).toEqual({ countryCode: 'CN', limit: 20 });
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
    await waitFor(() => expect(查询Location.mock.calls.filter(
      (单调用) => (单调用[0] as { q?: string }).q === '不存在的城',
    )).toHaveLength(2));
    // 重试成功但 0 条：显示无结果，行内错误撤掉
    expect(await screen.findByText('没有匹配的城市，换个词试试。')).toBeTruthy();
    await waitFor(() => expect(错误行()).toBeNull());
  });

  // Task 2：候选引导的多选上限保持 —— 第 11 枚被拒并提示，可取消已选后再补
  it('多选上限 10：第 11 枚被拒并提示，取消一枚后可再选', async () => {
    render城市页({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    const 热门 = ['北京市', '上海市', '深圳市', '广州市', '杭州市', '成都市', '南京市', '武汉市', '苏州市', '西安市'];
    for (const 城 of 热门) {
      await 用户.click(screen.getAllByRole('button', { name: 城 })[0]);
    }
    expect(screen.getByText('10/10')).toBeTruthy();
    await 用户.click(screen.getAllByRole('button', { name: '长沙市' })[0]);
    expect(screen.getByText('10/10')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '长沙市 ✕' })).toBeNull();
    expect(轻提示文案们()).toContain('最多选 10 个');
    await 用户.click(screen.getByRole('button', { name: '西安市 ✕' }));
    await 用户.click(screen.getAllByRole('button', { name: '长沙市' })[0]);
    expect(screen.getByRole('button', { name: '长沙市 ✕' })).toBeTruthy();
  });
});

// ── Task 6：热门城市规范显示名与有限别名兼容 ──────────────────────
// 旧 Mock 草稿「北京」与热门「北京市」是同一项（比较归一到规范名）；
// 取消不派发，归一化结果绝不悄悄落盘；未知名字保持；提交仍按原 ID。
describe('选工作城市 规范名与有限别名（Task 6）', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('Mock 旧草稿「北京」与热门「北京市」视为同项：回显同名、再点热门即取消', async () => {
    render城市页({ 数据源: 'mock', Mock城市们: ['北京'] });
    const 用户 = userEvent.setup();
    // 旧名回显为规范名，热门区同一项直接是选中态（计数 1，不重复占名额）
    expect(await screen.findByRole('button', { name: '北京市 ✕' })).toBeTruthy();
    expect(screen.getByText('1/10')).toBeTruthy();
    // 点热门区的「北京市」= 取消同一项
    await 用户.click(screen.getAllByRole('button', { name: '北京市' })[0]);
    expect(screen.getByText('0/10')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '北京市 ✕' })).toBeNull();
  });

  it('Mock 取消不悄悄持久化归一化结果：返回不派发，草稿仍留旧名', async () => {
    const { 派发 } = render城市页({ 数据源: 'mock', Mock城市们: ['北京'] });
    const 用户 = userEvent.setup();
    await screen.findByRole('button', { name: '北京市 ✕' });
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(mock返回).toHaveBeenCalledTimes(1);
    expect(派发).not.toHaveBeenCalled();
  });

  it('Mock 热门与省内同项只选一次：点精选上海市，直辖市组同片选中且计数 1', async () => {
    render城市页({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 精选区的「上海市」与分省组的「上海市」是同一项：点第一枚
    await 用户.click(screen.getAllByRole('button', { name: '上海市' })[0]);
    expect(screen.getByText('1/10')).toBeTruthy();
    // 分省组里同名同键的城片也是选中态（同类名按钮只多枚，但已选 chip 只有一枚）
    expect(screen.getByRole('button', { name: '上海市 ✕' })).toBeTruthy();
    // 点分省组里的同一项 = 取消，不产生第二条
    await 用户.click(screen.getAllByRole('button', { name: '上海市' }).at(-1)!);
    expect(screen.getByText('0/10')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '上海市 ✕' })).toBeNull();
  });

  it('Mock 未知名字保持：历史值「迪拜」不映射不丢失', async () => {
    render城市页({ 数据源: 'mock', Mock城市们: ['迪拜'] });
    expect(await screen.findByRole('button', { name: '迪拜 ✕' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '迪拜市 ✕' })).toBeNull();
  });

  it('Backend 旧 ref「北京」回显规范名「北京市」且保存仍用原 ID', async () => {
    const 查询Location = 四国桩({});
    const 派发 = vi.fn();
    mock应用状态 = {
      数据源模式: 'backend',
      目录查询: {
        查询Location: 查询Location,
        查询Taxonomy: vi.fn(),
        查询Institution: vi.fn(),
      },
      状态: {
        引导预填: { 城市们: [], 职位: [], 城市引用们: [{ id: 'loc_7gn74qrcymqcwwuqwotm47dbba', display_name: '北京' }] },
        意向草稿: { ...空草稿 },
      },
      派发,
    };
    render(
      <MemoryRouter initialEntries={['/onboard/city']}>
        <选工作城市 />
      </MemoryRouter>,
    );
    const 用户 = userEvent.setup();
    // 静态旧 ref 显示按 ID 规范化，与热门区同一项
    expect(await screen.findByRole('button', { name: '北京市 ✕' })).toBeTruthy();
    expect(screen.getByText('1/10')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        城市引用们: [{ id: 'loc_7gn74qrcymqcwwuqwotm47dbba', display_name: '北京市' }],
      }),
    );
  });
});
