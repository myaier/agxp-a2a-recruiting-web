// 去名改版（定稿 2026-09-08）：在谈卡全匿名 —— 卡面无真名、无代号、无「薪资带有交集」；
// 原 基本行 升为头行：性别图标（role=img，name 男/女）+ 年限｜学历｜在找「·」后半段。
// 信息行 ×2 / 阶段区 / 右列适配环 一个像素不动；S1 披露规则、候选详情页、简历原件弹层不在本文件范围。
// 只测 Mock 分支卡面（Backend 分支的 P5 列表在 P5/MatchCase列表.test.tsx）。
// 测试宿主：mock 应用状态 / 导航钩子（同 候选推荐.test.tsx 惯例）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

// 第二批验收要读源文件 / 查文件是否存在：tsconfig.app 没挂 node 类型，这里按文件引用（@types/node 已装）
/// <reference types="node" />
import { existsSync } from 'node:fs';
import path from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业在谈候选 from './企业在谈候选';
import type { 候选 } from '../数据/类型';
import { 在招岗位列表, 在谈候选列表 } from '../数据/企业端模拟数据';

// jsdom 不实现 scrollIntoView / scrollTo
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}
if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = () => {};
}

const mock派发 = vi.fn();
const mock跳转 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  use应用状态: () => mock应用状态,
}));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }) }));

/** P-01 岗位下的 Mock 在谈候选：A-01 陈屿/沈亦舟（男）、A-02 顾晚舟/林若衡（女）、
 *  A-03 宋之远/周承宇（男）、A-07 苏含章（女，匿名初筛，真名 null） */
const P01候选: 候选[] = 在谈候选列表.filter((候) => 候.岗位编号 === 'P-01');

/** Mock 模式底座：在谈子视图、当前岗位 P-01，候选表按用例给 */
function 置Mock状态(候选表: 候选[] = P01候选) {
  mock应用状态 = {
    数据源模式: 'mock',
    派发: mock派发,
    状态: {
      企业子视图: '在谈', 企业Tab: '人才',
      企业在谈看什么: '全部', 企业在谈范围: '当前',
      当前岗位编号: 'P-01',
      岗位列表: 在招岗位列表,
      企业候选列表: 候选表,
      企业规则: [],
    },
    后端状态: {},
    操作: {},
  };
}

/** 头行 = 性别图标所在的那一行（定稿：图标跟在头行最前，行类名沿用 .基本行） */
function 取头行(图标: Element): HTMLElement {
  const 行 = 图标.closest('[class*="基本行"]');
  if (!(行 instanceof HTMLElement)) throw new Error('性别图标不在头行（.基本行）内');
  return 行;
}

/** 在某性别的全部头行里找同时含所有片段的那一张卡；返回头行与它的图标 */
function 找头行(性别: '男' | '女', 片段: string[]): { 头行: HTMLElement; 图标: Element } {
  for (const 图标 of screen.getAllByRole('img', { name: 性别 })) {
    const 头行 = 取头行(图标);
    if (片段.every((段) => (头行.textContent ?? '').includes(段))) return { 头行, 图标 };
  }
  throw new Error(`没有「${性别}」头行同时含 ${片段.join(' / ')}`);
}

describe('企业在谈候选 · 去名改版卡面（定稿 2026-09-08）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
  });

  it('验收1 · 卡面不含任何代号 / 真名，不含「薪资带」', async () => {
    置Mock状态();
    render(<企业在谈候选 />);
    // Mock 体有模拟加载：以头行性别图标出现为渲染完成
    await screen.findAllByRole('img', { name: '男' });
    for (const 候 of P01候选) {
      expect(screen.queryByText(候.代号)).toBeNull();
      // S1 已披露的真名（沈亦舟 / 林若衡 / 周承宇）同样不上卡 —— 卡面全匿名，披露只在详情页
      if (候.真名) expect(screen.queryByText(候.真名)).toBeNull();
    }
    expect(document.body.textContent).not.toMatch(/薪资带/);
  });

  it('验收1 · 头行 = 性别图标 + 年限｜学历｜在找后半段；图标 role=img 且 name 为 男/女', async () => {
    置Mock状态();
    render(<企业在谈候选 />);
    await screen.findAllByRole('img', { name: '男' });
    expect(screen.getAllByRole('img', { name: '男' })).toHaveLength(2); // A-01、A-03
    expect(screen.getAllByRole('img', { name: '女' })).toHaveLength(2); // A-02、A-07

    // 年限取自 画像 首段，学历取 候选.学历，求职状态取 在找「·」后半段（数据已是文案，不再映射）
    const 期望: [性别: '男' | '女', 片段: string[]][] = [
      ['男', ['9 年', '硕士', '在职看机会']],  // A-01：画像「9 年 · …」/ 硕士 / 后端工程师 · 在职看机会
      ['男', ['8 年', '硕士', '离职可到岗']],  // A-03：… / 后端工程师 · 离职可到岗
      ['女', ['11 年', '本科', '在职看机会']], // A-02
      ['女', ['10 年', '本科', '在职看机会']], // A-07：匿名初筛、真名 null，头行与其他卡同构
    ];
    for (const [性别, 片段] of 期望) {
      const { 头行, 图标 } = 找头行(性别, 片段);
      expect(头行.textContent).not.toMatch(/薪资/);
      expect(头行.textContent).not.toContain('后端工程师'); // 在找 只取「·」后半段，方向不进头行
      expect(头行.firstElementChild?.contains(图标)).toBe(true); // 图标跟在头行最前
    }

    // 右列适配环 / 阶段区 不动
    expect(screen.getByRole('img', { name: '适配 94 分' })).toBeTruthy();
    expect(screen.getAllByText('需要协调').length).toBeGreaterThan(0);
    expect(screen.getByText('对方要每周 2 天远程，AI代理建议给 1 天')).toBeTruthy();
  });

  it('验收1 · 在找 缺省不渲染求职状态词；性别 缺省不渲染图标；其余头行不变', async () => {
    const A01 = P01候选.find((候) => 候.编号 === 'A-01');
    if (!A01) throw new Error('Mock 数据里没有 A-01');
    置Mock状态([{ ...A01, 在找: undefined, 性别: undefined }]);
    render(<企业在谈候选 />);
    await waitFor(() => expect(document.querySelector('[class*="基本行"]')).not.toBeNull());

    expect(screen.queryByRole('img', { name: '男' })).toBeNull();
    expect(screen.queryByRole('img', { name: '女' })).toBeNull();
    const 头行 = document.querySelector('[class*="基本行"]')?.textContent ?? '';
    expect(头行).toContain('9 年');
    expect(头行).toContain('硕士');
    expect(头行).not.toMatch(/在职看机会|离职可到岗|薪资/);
    expect(头行).not.toMatch(/｜\s*$/); // 缺省词不留悬空竖分
    expect(screen.queryByText('陈屿')).toBeNull();
    expect(screen.queryByText('沈亦舟')).toBeNull();
  });
});

// ── 第二批（2026-09-09 定稿）：删筛选 —— 企业顶栏「筛选 ▾」、候选筛选抽屉（规则清单）、在谈筛选层
//    （看哪几单）整体删除；状态层 企业在谈看什么 / 企业在谈范围 字段与 reducer 保留，但列表固定按
//    「全部」渲染（待拍板的本来就排最前，产品负责人 8/25 认可该排序）。
describe('企业在谈候选 · 删筛选（第二批 验收2/3/4/5）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
  });

  /** 四张 P-01 卡的头行文本，按今天「全部」档的 DOM 顺序：需要你 的 A-01 / A-03 在前，A-02 / A-07 在后 */
  const P01头行顺序 = [
    '9 年｜硕士｜在职看机会',  // A-01 需要你
    '8 年｜硕士｜离职可到岗',  // A-03 需要你
    '11 年｜本科｜在职看机会', // A-02
    '10 年｜本科｜在职看机会', // A-07
  ];
  const 读头行 = () =>
    Array.from(document.querySelectorAll('[class*="基本行"]')).map((行) => 行.textContent ?? '');

  it('验收2 · 顶栏无「筛选」文字按钮，也无「看哪几单」面板；在谈 / 推荐 子视图键仍在', async () => {
    置Mock状态();
    render(<企业在谈候选 />);
    await screen.findAllByRole('img', { name: '男' });
    expect(screen.queryByRole('button', { name: /筛选/ })).toBeNull();
    expect(screen.queryByText('看哪几单')).toBeNull();
    expect(screen.queryByText('告诉AI代理你的硬性要求')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: '在谈' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '推荐' })).toBeTruthy();
  });

  it('验收3 · 候选筛选抽屉 / 在谈筛选层 模块已不存在（import 即报错），三件套文件一并删除', async () => {
    for (const 名 of ['候选筛选抽屉', '在谈筛选层']) {
      // 非字面量路径 + @vite-ignore：让解析发生在运行时，模块删掉后 import 才会拒绝
      await expect(import(/* @vite-ignore */ `../组件/${名}`)).rejects.toThrow();
    }
    for (const 文件 of [
      '候选筛选抽屉.tsx', '候选筛选抽屉.module.css', '候选筛选抽屉.test.tsx',
      '在谈筛选层.tsx', '在谈筛选层.module.css',
    ]) {
      expect(existsSync(path.resolve(process.cwd(), 'src/组件', 文件))).toBe(false);
    }
  });

  it.each(['待我拍板', '进行中'] as const)(
    '验收4 · 企业在谈看什么=%s 时列表仍显示全部单（含需要你 / 不需要你），排序不变',
    async (档) => {
      置Mock状态();
      mock应用状态.状态.企业在谈看什么 = 档;
      render(<企业在谈候选 />);
      await screen.findAllByRole('img', { name: '男' });
      expect(screen.getAllByRole('img', { name: '男' })).toHaveLength(2); // A-01、A-03
      expect(screen.getAllByRole('img', { name: '女' })).toHaveLength(2); // A-02、A-07（都不需要你）
      expect(读头行()).toEqual(P01头行顺序);
    },
  );

  it('验收5 · 「待拍板」落地态（企业在谈范围=全部 + 待我拍板）照常渲染不报错，P-01 四张卡按原序在场', async () => {
    置Mock状态();
    mock应用状态.状态.企业在谈看什么 = '待我拍板';
    mock应用状态.状态.企业在谈范围 = '全部';
    render(<企业在谈候选 />);
    await screen.findAllByRole('img', { name: '男' });
    const 头行 = 读头行();
    const 位置 = P01头行顺序.map((文) => 头行.indexOf(文));
    expect(位置.every((序) => 序 >= 0)).toBe(true);
    expect([...位置].sort((甲, 乙) => 甲 - 乙)).toEqual(位置);
    expect(screen.queryByRole('button', { name: /筛选/ })).toBeNull();
  });
});
