// Task 2：Backend 顶栏胶囊按「唯一业务坐标」工作 ——
// 选中判断只认 当前意向编号（意向名不唯一，同名两条按名字比会一起点亮），
// 胶囊文字按 Spec §4.2 依次用职位 → 城市 → 已有薪资说明 → 同组序号消歧，
// 且用户可见文本里绝不出现 int_ 内部编号。Mock 分支逐字保持名称语义。
// 测试宿主：mock 应用状态 / 导航钩子（同 看市场.test.tsx 惯例）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 顶部意向栏, { 造意向胶囊文字 } from './顶部意向栏';
import { BFF意向样本 } from '../测试/BFF样本';

const mock派发 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', async (importOriginal) => ({
  // 本组件还消费本模块的 取意向名：保留其余真实导出，只替换 use应用状态
  ...(await importOriginal<Record<string, unknown>>()),
  use应用状态: () => mock应用状态,
}));
vi.mock('../路由/导航钩子', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  use导航: () => ({ 返回: vi.fn(), 跳转: vi.fn() }),
}));

/** 两条同名意向：上海 int_sh / 北京 int_bj —— 只有编号能区分 */
const 两条同名 = [
  { 编号: 'int_sh', 标题: '[上海] 产品经理', 说明: '20-35K｜互联网' },
  { 编号: 'int_bj', 标题: '[北京] 产品经理', 说明: '25-40K｜互联网' },
];

const 服务端 = (编号们: string[], 状态: 'active' | 'archived' = 'active') =>
  Object.fromEntries(编号们.map((编号) => [编号, { ...BFF意向样本, intention_id: 编号, status: 状态 }]));

function 置状态(选项: {
  模式?: 'mock' | 'backend';
  求职意向表?: { 编号: string; 标题: string; 说明: string }[];
  当前意向?: string;
  当前意向编号?: string | null;
  后端意向服务端?: Record<string, unknown>;
  子视图?: string;
}) {
  const 表 = 选项.求职意向表 ?? 两条同名;
  mock应用状态 = {
    数据源模式: 选项.模式 ?? 'backend',
    派发: mock派发,
    状态: {
      求职意向表: 表,
      当前意向: 选项.当前意向 ?? '产品经理',
      当前意向编号: 选项.当前意向编号 === undefined ? 'int_bj' : 选项.当前意向编号,
      后端意向服务端: 选项.后端意向服务端 ?? 服务端(表.map((条) => 条.编号)),
      子视图: 选项.子视图 ?? '在谈',
    },
  };
}

/** 当前选中的胶囊文字（选中类名由 CSS module 给，测试只认「有且只有一个选中」） */
function 选中胶囊文字(): string[] {
  return Array.from(document.querySelectorAll('button'))
    .filter((按钮) => (按钮.className.includes('意向选中')))
    .map((按钮) => 按钮.textContent ?? '');
}

beforeEach(() => {
  mock派发.mockClear();
});

describe('造意向胶囊文字 · Spec §4.2 逐级消歧', () => {
  it('职位名不重复时只用职位名，不加任何后缀', () => {
    expect(造意向胶囊文字([
      { 编号: 'a', 标题: '[上海] 产品经理', 说明: '20-35K' },
      { 编号: 'b', 标题: '[上海] 数据分析', 说明: '20-35K' },
    ])).toEqual(['产品经理', '数据分析']);
  });

  it('职位名重复时加标题里已有的城市，只给碰撞组加长', () => {
    expect(造意向胶囊文字([
      { 编号: 'a', 标题: '[上海] 产品经理', 说明: '' },
      { 编号: 'b', 标题: '[北京] 产品经理', 说明: '' },
      { 编号: 'c', 标题: '[上海] 数据分析', 说明: '' },
    ])).toEqual(['产品经理 · 上海', '产品经理 · 北京', '数据分析']);
  });

  it('城市也相同时再加已有的薪资说明（只取说明的薪资段）', () => {
    expect(造意向胶囊文字([
      { 编号: 'a', 标题: '[上海] 产品经理', 说明: '20-35K｜互联网' },
      { 编号: 'b', 标题: '[上海] 产品经理', 说明: '35-50K｜金融' },
    ])).toEqual(['产品经理 · 上海 · 20-35K', '产品经理 · 上海 · 35-50K']);
  });

  it('城市缺失就跳过那一节，不猜城市也不留空后缀', () => {
    expect(造意向胶囊文字([
      { 编号: 'a', 标题: '[上海] 产品经理', 说明: '' },
      { 编号: 'b', 标题: '产品经理', 说明: '' },
    ])).toEqual(['产品经理 · 上海', '产品经理']);
  });

  it('城市与薪资都相同：最终仍重名的加同组 1-based 序号', () => {
    expect(造意向胶囊文字([
      { 编号: 'a', 标题: '[上海] 产品经理', 说明: '20-35K' },
      { 编号: 'b', 标题: '[上海] 产品经理', 说明: '20-35K' },
      { 编号: 'c', 标题: '[北京] 产品经理', 说明: '20-35K' },
    ])).toEqual([
      '产品经理 · 上海 · 20-35K（1）',
      '产品经理 · 上海 · 20-35K（2）',
      '产品经理 · 北京',
    ]);
  });

  it('薪资说明缺失时序号直接落在城市档上（Spec §4.2 的示例形状）', () => {
    expect(造意向胶囊文字([
      { 编号: 'a', 标题: '[上海] 产品经理', 说明: '' },
      { 编号: 'b', 标题: '[上海] 产品经理', 说明: '' },
    ])).toEqual(['产品经理 · 上海（1）', '产品经理 · 上海（2）']);
  });

  it('任何一档都不产生 int_ 内部编号', () => {
    for (const 文字 of 造意向胶囊文字(两条同名)) {
      expect(文字).not.toContain('int_');
    }
  });
});

describe('顶部意向栏 · Backend 按 ID 选中', () => {
  it('两条同名意向：只有 ID 命中的那条选中', () => {
    置状态({ 当前意向编号: 'int_bj' });
    render(<顶部意向栏 />);
    expect(选中胶囊文字()).toEqual(['产品经理 · 北京']);

    置状态({ 当前意向编号: 'int_sh' });
    render(<顶部意向栏 />);
    // 第二次 render 追加了一份 DOM：新那份的选中项是上海
    expect(选中胶囊文字().at(-1)).toBe('产品经理 · 上海');
  });

  it('跨意向（全部意向档）：一个胶囊都不高亮', () => {
    置状态({ 当前意向编号: 'int_bj' });
    render(<顶部意向栏 跨意向 />);
    expect(选中胶囊文字()).toEqual([]);
  });

  it('当前编号无效（不在表内）：一个胶囊都不高亮，不退化成第一条', () => {
    置状态({ 当前意向编号: 'int_已删' });
    render(<顶部意向栏 />);
    expect(选中胶囊文字()).toEqual([]);
  });

  it('点第二条同名胶囊派发的是第二条的 ID 和名称', async () => {
    const user = userEvent.setup();
    置状态({ 当前意向编号: 'int_sh' });
    render(<顶部意向栏 />);
    await user.click(screen.getByRole('button', { name: '产品经理 · 北京' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '切意向', 意向: '产品经理', 编号: 'int_bj' });
  });

  it('胶囊容器的可见文本不含任何 int_ 内部编号（同城同薪的序号档同样成立）', () => {
    const 同城同薪 = [
      { 编号: 'int_sh', 标题: '[上海] 产品经理', 说明: '' },
      { 编号: 'int_sh2', 标题: '[上海] 产品经理', 说明: '' },
    ];
    置状态({ 求职意向表: 同城同薪, 当前意向编号: 'int_sh2' });
    const { container } = render(<顶部意向栏 />);
    expect(container.textContent).not.toContain('int_');
    expect(选中胶囊文字()).toEqual(['产品经理 · 上海（2）']);
  });
});

describe('顶部意向栏 · Mock 分支逐字保持名称语义', () => {
  it('Mock 只显示意向名、按名称选中、派发不带编号', async () => {
    const user = userEvent.setup();
    置状态({
      模式: 'mock',
      求职意向表: [
        { 编号: 'I-01', 标题: '[上海] AI 产品经理', 说明: '' },
        { 编号: 'I-02', 标题: '[北京] 数据分析', 说明: '' },
      ],
      当前意向: 'AI 产品经理',
      当前意向编号: null,
    });
    render(<顶部意向栏 />);
    expect(选中胶囊文字()).toEqual(['AI 产品经理']);
    await user.click(screen.getByRole('button', { name: '数据分析' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '切意向', 意向: '数据分析' });
  });
});
