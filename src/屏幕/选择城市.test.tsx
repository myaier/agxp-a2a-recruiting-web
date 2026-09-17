// 选择城市 页面测试（Task 3 / Task 4）：两模式入口都消费同一份 备选城市选择正文。
// 页面外层负责真实目录引用 / ID 映射 / 业务派发，这里验证两模式的映射与业务边界：
// Mock 行政分组（Mock默认城市字典切片）+ 拼音搜索 + 9 上限 + 取消不派发；Backend 四支默认
// 目录、两精选区（无港澳台精选）、三个中文组标题与英文条目、排除主城市、同名不同 ID 独立
// 选中、搜索/翻页已选不丢、保存才提交备选引用。

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 选择城市 from './选择城市';

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
  country_name?: string | null;
}) {
  return {
    id: 项.id,
    display_name: 项.display_name,
    country_code: 项.countryCode ?? 'CN',
    country_name: 项.country_name === undefined ? (项.countryCode ?? '中国') : 项.country_name,
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
function 四国桩(配置: Partial<Record<国家名, 页形>> & { 搜索?: 页形 }) {
  return vi.fn(async (query: { q?: string; countryCode?: string; cursor?: string; limit?: number }) => {
    if (query.q !== undefined) {
      return { ...(配置.搜索 ?? { items: [], nextCursor: null }), catalogVersion: 'v2' };
    }
    const 页 = 配置[(query.countryCode ?? 'CN') as 国家名] ?? { items: [], nextCursor: null };
    return { ...页, catalogVersion: 'v2' };
  });
}

/** 空意向草稿（含可选引用字段）*/
const 空草稿 = {
  编辑编号: null,
  求职类型: '全职' as const,
  工作城市: '',
  工作城市引用: undefined,
  期望职位: '',
  感兴趣城市们: [] as string[],
  感兴趣城市引用们: [] as { id: string; display_name: string }[],
  薪资下限: null,
  薪资上限: null,
  期望行业们: [] as string[],
  后端招聘类型: null,
  求职类型已改: false,
};

function render城市页(选项: {
  数据源: 'backend' | 'mock';
  查询Location?: ReturnType<typeof vi.fn>;
  已选城市们?: string[];
  已选引用们?: { id: string; display_name: string }[];
  工作城市引用?: { id: string; display_name: string };
  /** Mock 主工作城市（草稿里的 工作城市 名） */
  工作城市?: string;
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
      意向草稿: {
        ...空草稿,
        工作城市: 选项.工作城市 ?? '',
        感兴趣城市们: 选项.已选城市们 ?? [],
        感兴趣城市引用们: 选项.已选引用们 ?? [],
        工作城市引用: 选项.工作城市引用,
      },
    },
    派发,
  };
  const render结果 = render(
    <MemoryRouter>
      <选择城市 />
    </MemoryRouter>,
  );
  // 疑点②（baseline-stg-matching Task 2）：真实 取消（返回）会卸载本页，harness 里
  // 返回 是 mock —— 暴露 unmount 让用例补齐这一步，迟到响应可落在已卸载页上。
  return { 派发, 卸载: render结果.unmount };
}

beforeEach(() => {
  mock返回.mockClear();
});

describe('选择城市 Mock（行政分组共用正文）', () => {
  it('行政分组来自 Mock默认城市字典，A–Z 分节与右侧字母索引条消失；杭/hangzhou/hang 都命中杭州', async () => {
    render城市页({ 数据源: 'mock' });
    const 用户 = userEvent.setup();

    // 分组标题用省份（默认字典种子），不再按拼音首字母分节
    expect(screen.getByText('广东')).toBeTruthy();
    expect(screen.getByText('浙江')).toBeTruthy();
    // 右侧索引条整体消失
    expect(screen.queryByRole('button', { name: '跳到 A' })).toBeNull();
    expect(screen.queryByRole('button', { name: '跳到 Z' })).toBeNull();

    // 中文/拼音子串搜索沿用：杭、hangzhou、hang 都出杭州市（Task 6 规范名回显）
    const 输入 = screen.getByPlaceholderText('搜索城市名/拼音');
    for (const 词 of ['杭', 'hangzhou', 'hang']) {
      await 用户.clear(输入);
      await 用户.type(输入, 词);
      expect(await screen.findByText('杭州市')).toBeTruthy();
    }
    await 用户.clear(输入);
  });

  it('两个精选区上屏且无港澳台精选；海外仅精选或搜索，不入分组长列表', async () => {
    render城市页({ 数据源: 'mock' });
    // 两个精选区：12 大陆 + 10 海外（此处抽点断言），无港澳台条目
    expect(screen.getByText('国内热门城市')).toBeTruthy();
    expect(screen.getByText('海外热门城市')).toBeTruthy();
    // 新加坡不在 Mock 默认分组里，按钮唯一来自海外精选区（Task 6 规范英文名）
    expect(screen.getByRole('button', { name: 'Singapore' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Taipei' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hong Kong' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Macau' })).toBeNull();
    // 海外长组不再作为分组渲染（组标题「海外」消失，迪拜不可见）
    expect(screen.queryByText('海外', { selector: 'div' })).toBeNull();
    expect(screen.queryByRole('button', { name: '迪拜' })).toBeNull();
  });

  it('最多 9 个：选满后其余城片禁用；取消（✕）不派发改草稿', async () => {
    const { 派发 } = render城市页({ 数据源: 'mock' });
    const 用户 = userEvent.setup();

    // 国内精选正好 12 枚，取前 9 枚点满
    const 热门枚 = ['北京市', '上海市', '深圳市', '广州市', '杭州市', '成都市', '南京市', '武汉市', '苏州市'];
    for (const 城名 of 热门枚) {
      await 用户.click((await screen.findAllByText(城名))[0]);
    }
    expect(screen.getByText('9/9')).toBeTruthy();
    // 未选中的城片禁用：点第 10 枚（西安市）不越过上限
    await 用户.click((await screen.findAllByText('西安市'))[0]);
    expect(screen.getByText('9/9')).toBeTruthy();
    expect(((screen.getAllByText('西安市')[0] as HTMLButtonElement).disabled)).toBe(true);

    // 取消 = ✕ 关闭：只返回，不派发任何草稿改动
    await 用户.click(screen.getByRole('button', { name: '关闭' }));
    expect(mock返回).toHaveBeenCalledTimes(1);
    expect(派发).not.toHaveBeenCalled();
  });

  it('保存才写回草稿：保存派发感兴趣城市们（归一到规范名），中途取消的会话不派发', async () => {
    const { 派发 } = render城市页({ 数据源: 'mock', 已选城市们: ['杭州'] });
    const 用户 = userEvent.setup();
    // 进页带入既有选择：旧名「杭州」按规范名回显，计数 1/9，chip 可移除
    expect(screen.getByText('1/9')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '移除 杭州市' }));
    expect(screen.getByText('0/9')).toBeTruthy();
    await 用户.click((await screen.findAllByText('苏州市'))[0]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock返回).toHaveBeenCalledTimes(1);
    expect(派发).toHaveBeenCalledTimes(1);
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({ 型: '改意向草稿', 补丁: { 感兴趣城市们: ['苏州市'] } }),
    );
  });

  it('已有中文港澳台历史值不迁移：仍展示、可删，且不影响新分组', async () => {
    const { 派发 } = render城市页({ 数据源: 'mock', 已选城市们: ['香港', '杭州'] });
    const 用户 = userEvent.setup();
    expect(screen.getByText('2/9')).toBeTruthy();
    expect(screen.getByRole('button', { name: '移除 香港' })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '移除 香港' }));
    expect(screen.queryByRole('button', { name: '移除 香港' })).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({ 型: '改意向草稿', 补丁: { 感兴趣城市们: ['杭州市'] } }),
    );
  });

  it('Mock 局部分页：加载更多把更多行政分组切进来，翻完见港澳台三组', async () => {
    render城市页({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 初始只显示一部分省份组
    expect(screen.getByText('广东')).toBeTruthy();
    const 组标题正则 = /^(北京|上海|天津|重庆|广东|浙江|江苏|山东|四川|湖北|湖南|陕西|福建|河南|安徽|河北|辽宁|江西|广西|云南|贵州|山西|黑龙江|吉林|内蒙古|甘肃|新疆|宁夏|青海|西藏|海南|台湾省|香港特别行政区|澳门特别行政区)$/;
    const 初始组数 = screen.getAllByText(组标题正则).length;
    await 用户.click(screen.getByRole('button', { name: '加载更多' }));
    await waitFor(() => {
      expect(screen.getAllByText(组标题正则).length).toBeGreaterThan(初始组数);
    });
    // 翻完还有下一页按钮，直到全部分组上屏
    while (screen.queryByRole('button', { name: '加载更多' })) {
      await 用户.click(screen.getByRole('button', { name: '加载更多' }));
    }
    // 港澳台拆三组：中文标题 + 组内 API 英文条目
    expect(screen.getByText('台湾省')).toBeTruthy();
    expect(screen.getByText('香港特别行政区')).toBeTruthy();
    expect(screen.getByText('澳门特别行政区')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Taipei' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hong Kong' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Macau' })).toBeTruthy();
    // 海外长组移除
    expect(screen.queryByText('海外', { selector: 'div' })).toBeNull();
    expect(screen.queryByText('港澳台')).toBeNull();
    expect(screen.queryByText('直辖市')).toBeNull();
  });
});

describe('选择城市 Backend（引用身份与分页边界）', () => {
  it('四支默认目录按 admin1 分组、两精选区上屏、排除主城市；无行政区城市只进热门且仍可搜索', async () => {
    const 查询Location = 四国桩({
      CN: {
        items: [
          城({ id: 'loc_main', display_name: '上海市' }),
          城({ id: 'loc_gz', display_name: '广州市', admin1_name: '广东省' }),
          城({ id: 'loc_qs', display_name: '泉州', admin1_name: null, country_name: null }),
        ],
        nextCursor: null,
      },
      搜索: {
        items: [城({ id: 'loc_qs', display_name: '泉州', admin1_name: null, country_name: null })],
        nextCursor: null,
      },
    });
    render城市页({
      数据源: 'backend',
      查询Location,
      工作城市引用: { id: 'loc_main', display_name: '上海市' },
    });
    const 用户 = userEvent.setup();

    // 两个精选区上屏（静态配置），无港澳台精选
    expect(screen.getByText('国内热门城市')).toBeTruthy();
    expect(screen.getByText('海外热门城市')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Taipei' })).toBeNull();
    // 分组标题只用返回的 admin1_name；两字段都缺的泉州不编造分组、不落「其他地区」
    await screen.findAllByText('广州市');
    expect(screen.getByText('广东省')).toBeTruthy();
    expect(screen.queryByText('其他地区')).toBeNull();
    expect(screen.queryByText('港澳台')).toBeNull();
    // 主城市不进入备选：可见但禁用（精选区同名「上海市」可选，目录项那枚禁用）
    const 上海市片们 = (await screen.findAllByText('上海市')).filter(
      (节点) => 节点.tagName === 'BUTTON',
    ) as HTMLButtonElement[];
    const 目录主城片 = 上海市片们.find((片) => 片.disabled);
    expect(目录主城片).toBeTruthy();
    expect(目录主城片!.disabled).toBe(true);
    // 无行政区的城市不编造分组、默认列表不可见，但仍可被搜索命中且可点
    expect(screen.queryByText('泉州')).toBeNull();
    await 用户.type(screen.getByPlaceholderText('搜索城市名/拼音'), '泉州');
    const 泉州片 = (await screen.findAllByText('泉州')).find(
      (节点) => 节点.tagName === 'BUTTON',
    ) as HTMLButtonElement;
    expect(泉州片.disabled).toBe(false);
  });

  it('三个中文组标题与英文条目：TW/HK/MO 返回无视细分，组内保留 API 原名', async () => {
    const 查询Location = 四国桩({
      TW: { items: [城({ id: 'loc_tpe', display_name: 'Taipei', countryCode: 'TW', admin1_name: 'Taipei' })], nextCursor: null },
      HK: { items: [城({ id: 'loc_hk', display_name: 'Hong Kong', countryCode: 'HK', admin1_name: 'Hong Kong' })], nextCursor: null },
      MO: { items: [城({ id: 'loc_mo', display_name: 'Macau', countryCode: 'MO', admin1_name: null })], nextCursor: null },
    });
    render城市页({ 数据源: 'backend', 查询Location });
    await screen.findByText('台湾省');
    expect(screen.getByText('香港特别行政区')).toBeTruthy();
    expect(screen.getByText('澳门特别行政区')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Taipei' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hong Kong' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Macau' })).toBeTruthy();
  });

  it('海外精选按 canonical ID 保存（选择列表/精选区同一 ID 共享选中）', async () => {
    const 查询Location = 四国桩({});
    const { 派发 } = render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    await 用户.click(await screen.findByRole('button', { name: 'Singapore' }));
    expect(screen.getByText('1/9')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '改意向草稿',
        补丁: {
          感兴趣城市们: ['Singapore'],
          感兴趣城市引用们: [{ id: 'loc_qdyx7r6fcyjrcokobaxsorhhrm', display_name: 'Singapore' }],
        },
      }),
    );
  });

  it('同名不同 ID 两城独立选中；搜索/翻页已选不丢；重复 ID 不重复计数', async () => {
    const 查询Location = vi.fn(async (query: { q?: string; countryCode?: string; cursor?: string }) => {
      if (query.q !== undefined) {
        return {
          items: [城({ id: 'loc_c2', display_name: '朝阳', admin1_name: '辽宁省' })],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.countryCode === 'CN' && query.cursor === 'cur_1') {
        return {
          items: [城({ id: 'loc_c2', display_name: '朝阳', admin1_name: '辽宁省' })],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.countryCode === 'CN') {
        return {
          items: [城({ id: 'loc_c1', display_name: '朝阳', admin1_name: '北京市' })],
          nextCursor: 'cur_1',
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    const { 派发 } = render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();

    // 第一页选朝阳区（北京市）
    await screen.findAllByText('朝阳');
    await 用户.click((await screen.findAllByRole('button', { name: '朝阳' }))[0]);
    expect(screen.getByText('1/9')).toBeTruthy();
    // 翻页：第二页同名的辽宁省朝阳出现，独立选中（第一枚是已选中的北京市朝阳，不能误点）
    await 用户.click(screen.getByRole('button', { name: '加载更多' }));
    await screen.findByText('辽宁省');
    const 两枚朝阳 = screen.getAllByRole('button', { name: '朝阳' });
    expect(两枚朝阳).toHaveLength(2);
    await 用户.click(两枚朝阳[1]);
    expect(screen.getByText('2/9')).toBeTruthy();
    // 搜索离开默认页再清空：两枚已选不丢
    await 用户.type(screen.getByPlaceholderText('搜索城市名/拼音'), '朝阳');
    await screen.findByText('朝阳');
    await 用户.clear(screen.getByPlaceholderText('搜索城市名/拼音'));
    await waitFor(() => expect(screen.getByText('2/9')).toBeTruthy());
    // 两枚同名 chip 各自独立
    const chips = screen.getAllByRole('button', { name: '移除 朝阳' });
    expect(chips).toHaveLength(2);
    await 用户.click(chips[0]);
    expect(screen.getAllByRole('button', { name: '移除 朝阳' })).toHaveLength(1);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '改意向草稿',
        补丁: {
          感兴趣城市们: ['朝阳'],
          感兴趣城市引用们: [{ id: 'loc_c2', display_name: '朝阳' }],
        },
      }),
    );
  });

  it('旧搜索晚到不覆盖新搜索（页面级代际守卫，翻页在飞行中换词）', async () => {
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
    const 输入 = screen.getByPlaceholderText('搜索城市名/拼音');
    await 用户.type(输入, 'A');
    await screen.findByText('A城');
    // A 的第二页在飞行中时换词到 B
    await 用户.click(screen.getByRole('button', { name: '加载更多' }));
    await waitFor(() =>
      expect(查询Location).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'a_cur_1' })),
    );
    await 用户.clear(输入);
    await 用户.type(输入, 'B');
    await screen.findByText('B城', undefined, { timeout: 3000 });
    A第二页.resolve({ items: [城({ id: 'loc_a2', display_name: 'A城2（过期）' })], nextCursor: null, catalogVersion: 'v2' });
    await waitFor(() => expect(查询Location).toHaveBeenCalled());
    expect(screen.queryByText('A城2（过期）')).toBeNull();
    expect(screen.getByText('B城')).toBeTruthy();
  });

  it('保存才提交备选引用；进页回读草稿引用', async () => {
    const 查询Location = 四国桩({
      CN: { items: [城({ id: 'loc_hz', display_name: '杭州市', admin1_name: '浙江省' })], nextCursor: null },
    });
    const { 派发 } = render城市页({
      数据源: 'backend',
      查询Location,
      已选引用们: [{ id: 'loc_sz', display_name: '苏州市' }],
    });
    const 用户 = userEvent.setup();

    // 进页回读草稿引用：计数 1/9、chip 在
    await screen.findAllByText('杭州市');
    expect(screen.getByText('1/9')).toBeTruthy();
    expect(screen.getByRole('button', { name: '移除 苏州市' })).toBeTruthy();

    // 追加一枚后保存：引用按 ID 提交（含回读那条），名称列表同步
    // 精选区同名「杭州市」在前，目录项在行政区分组（DOM 尾部）—— 取末枚点目录项
    await 用户.click((await screen.findAllByRole('button', { name: '杭州市' })).at(-1)!);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '改意向草稿',
        补丁: {
          感兴趣城市们: ['苏州市', '杭州市'],
          感兴趣城市引用们: [
            { id: 'loc_sz', display_name: '苏州市' },
            { id: 'loc_hz', display_name: '杭州市' },
          ],
        },
      }),
    );
  });

  it('取消（✕）不派发：只返回，草稿保持 untouched', async () => {
    const 查询Location = 四国桩({
      CN: { items: [城({ id: 'loc_hz', display_name: '杭州市', admin1_name: '浙江省' })], nextCursor: null },
    });
    const { 派发 } = render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    await screen.findAllByText('杭州市');
    await 用户.click(screen.getByRole('button', { name: '关闭' }));
    expect(mock返回).toHaveBeenCalledTimes(1);
    expect(派发).not.toHaveBeenCalled();
  });

  // ── 疑点②（baseline-stg-matching Task 2）：取消清理与在途目录读的受控时序 ──
  // README「已知事项」曾记录「取消不写草稿段存在取消清理与在途草稿写的竞态（旧稿即红，
  // 曾在取消前等 400ms 收尾）」。受控事件序：进入选择（草稿带原选中）→ 局部再选城市 →
  // 取消（✕ 关闭 + 卸载）→ 在飞目录页迟到返回 —— 断言全程零草稿写：本页对草稿的唯一
  // 写入口是 保存 的 改意向草稿，局部选择与迟到响应都只落本页局部 state。
  it('局部选城市→取消→迟到目录返回：零草稿写（派发从未发生）', async () => {
    const CN首页 = deferredPromise<{ items: ReturnType<typeof 城>[]; nextCursor: string | null; catalogVersion: string }>();
    const 查询Location = vi.fn(async (query: { q?: string; countryCode?: string; cursor?: string; limit?: number }) => {
      if (query.q !== undefined) return { items: [], nextCursor: null, catalogVersion: 'v2' };
      if ((query.countryCode ?? 'CN') === 'CN') return CN首页.promise;
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    const { 派发, 卸载 } = render城市页({
      数据源: 'backend',
      查询Location,
      已选引用们: [{ id: 'loc_orig', display_name: '原城市' }],
    });
    const 用户 = userEvent.setup();
    // 进入选择：回读草稿原选中 1/9；CN 默认页仍在飞（精选区静态可点，不依赖它）
    expect(screen.getByText('1/9')).toBeTruthy();
    expect(screen.getByRole('button', { name: '移除 原城市' })).toBeTruthy();

    // 局部选城市（精选区）：只落本页局部 state，计数 2/9
    await 用户.click(screen.getByRole('button', { name: 'Singapore' }));
    expect(screen.getByText('2/9')).toBeTruthy();

    // 取消：✕ 关闭（只返回）+ 卸载 —— 此刻 CN 默认页仍在飞
    await 用户.click(screen.getByRole('button', { name: '关闭' }));
    expect(mock返回).toHaveBeenCalledTimes(1);
    卸载();

    // 在飞目录页迟到返回：卸载后代际守卫丢弃（即便落局部 state 也不触草稿），零草稿写
    CN首页.resolve({
      items: [城({ id: 'loc_late', display_name: '迟到市', admin1_name: '浙江省' })],
      nextCursor: null,
      catalogVersion: 'v2',
    });
    await act(async () => {});
    expect(派发).not.toHaveBeenCalled();
  });
});

// ── review-r1 F7：进页初始选择去重 / 排除主城市 / Mock 上限 9 ────────────
// 草稿里可能带着重复 ID 与主城市（历史脏数据）：初始选择要像 toggle 时一样清洗，
// 否则计数虚高、主城市被自己重复占用一个名额。
describe('选择城市 进页初始选择清洗（review-r1 F7）', () => {
  it('Backend：初始引用按 ID 去重并排除主城市', async () => {
    const 查询Location = 四国桩({
      CN: { items: [城({ id: 'loc_hz', display_name: '杭州市', admin1_name: '浙江省' })], nextCursor: null },
    });
    render城市页({
      数据源: 'backend',
      查询Location,
      已选引用们: [
        { id: 'loc_a', display_name: '杭州市' },
        { id: 'loc_a', display_name: '杭州市' },
        { id: 'loc_main', display_name: '上海市' },
      ],
      工作城市引用: { id: 'loc_main', display_name: '上海市' },
    });
    await screen.findAllByText('杭州市');
    // 重复 ID 只算一次，主城市不占备选名额
    expect(screen.getByText('1/9')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '移除 杭州市' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '移除 上海市' })).toBeNull();
  });

  it('Mock：初始名单排除当前主城市并按 9 上限截断', () => {
    render城市页({
      数据源: 'mock',
      工作城市: '上海',
      已选城市们: ['上海', '杭州', '苏州', '南京', '武汉', '成都', '广州', '深圳', '北京', '西安', '重庆'],
    });
    // 主城市排除 + 9 上限：10 个备选只进 9 个
    expect(screen.getByText('9/9')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /移除 / })).toHaveLength(9);
    expect(screen.queryByRole('button', { name: '移除 上海' })).toBeNull();
  });
});

// ── Task 6：热门城市规范显示名与有限别名兼容 ──────────────────────
describe('选择城市 规范名与有限别名（Task 6）', () => {
  it('Mock 旧草稿「北京」与热门「北京市」视为同项：回显规范名、点热门即取消、取消关闭不派发', async () => {
    const { 派发 } = render城市页({ 数据源: 'mock', 已选城市们: ['北京'] });
    const 用户 = userEvent.setup();
    expect(screen.getByText('1/9')).toBeTruthy();
    expect(screen.getByRole('button', { name: '移除 北京市' })).toBeTruthy();
    // 精选区「北京市」与旧草稿是同一项：点它 = 取消
    await 用户.click(screen.getAllByRole('button', { name: '北京市' })[0]);
    expect(screen.getByText('0/9')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '移除 北京市' })).toBeNull();
    // ✕ 关闭：只返回，不派发任何草稿改动（归一化不悄悄落盘）
    await 用户.click(screen.getByRole('button', { name: '关闭' }));
    expect(mock返回).toHaveBeenCalledTimes(1);
    expect(派发).not.toHaveBeenCalled();
  });

  it('Mock 热门与省内同项只选一次、回显同名：点精选杭州市后省内片同选且计数 1', async () => {
    render城市页({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    await 用户.click((await screen.findAllByText('杭州市'))[0]);
    expect(screen.getByText('1/9')).toBeTruthy();
    expect(screen.getByRole('button', { name: '移除 杭州市' })).toBeTruthy();
    // 点省内浙江组里的「杭州市」（同名同键）= 取消同一项，不产生第二条
    const 省内片 = (await screen.findAllByText('杭州市')).at(-1)!;
    await 用户.click(省内片);
    expect(screen.getByText('0/9')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '移除 杭州市' })).toBeNull();
  });

  it('Mock 未知名字保持、海外映射不加后缀：历史「迪拜」原样，精选区无「Singapore市」', async () => {
    render城市页({ 数据源: 'mock', 已选城市们: ['迪拜'] });
    expect(screen.getByRole('button', { name: '移除 迪拜' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Singapore' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Singapore市' })).toBeNull();
  });

  it('Backend 旧 ref「新加坡」回显规范名「Singapore」且与精选区同 ID 共享选中，保存仍原 ID', async () => {
    const 查询Location = 四国桩({});
    const { 派发 } = render城市页({
      数据源: 'backend',
      查询Location,
      已选引用们: [{ id: 'loc_qdyx7r6fcyjrcokobaxsorhhrm', display_name: '新加坡' }],
    });
    const 用户 = userEvent.setup();
    // 静态旧 ref 显示按 ID 规范化
    expect(await screen.findByRole('button', { name: '移除 Singapore' })).toBeTruthy();
    expect(screen.getByText('1/9')).toBeTruthy();
    // 与精选区同一 ID：再点精选区那枚 = 取消
    await 用户.click(screen.getByRole('button', { name: 'Singapore' }));
    expect(screen.getByText('0/9')).toBeTruthy();
    // 重新选中后保存：ID 不变，显示名为规范名
    await 用户.click(screen.getByRole('button', { name: 'Singapore' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '改意向草稿',
        补丁: {
          感兴趣城市们: ['Singapore'],
          感兴趣城市引用们: [{ id: 'loc_qdyx7r6fcyjrcokobaxsorhhrm', display_name: 'Singapore' }],
        },
      }),
    );
  });
});
