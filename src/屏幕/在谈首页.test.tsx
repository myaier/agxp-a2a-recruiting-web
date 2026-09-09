// 在谈首页（求职端职位 Tab 的在谈子视图）的第一个测试文件 —— 第二批（2026-09-09 定稿）删筛选：
// 顶栏「筛选 ▾」与 在谈筛选层（看哪几单 / 当前意向·全部意向）整体删除；状态层 在谈看什么 / 在谈范围
// 字段保留（「我」页「待你拍」仍派发 看全部在谈），但列表固定按「全部」渲染 —— 待拍板的本来就排最前。
// 只测 Mock 分支（Backend 分支的 P5 列表在 P5/MatchCase列表.test.tsx）。
// 测试宿主：mock 应用状态 / 导航钩子（同 看市场.test.tsx 惯例）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 在谈首页 from './在谈首页';
import { 在谈列表 } from '../数据/模拟数据';
import type { 看什么档, 在谈范围档 } from '../状态/应用状态';

// jsdom 不实现 scrollIntoView / scrollTo
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}
if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = () => {};
}

const mock派发 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', async (importOriginal) => ({
  // 顶部意向栏 还消费本模块的 取意向名：保留其余真实导出，只替换 use应用状态
  ...(await importOriginal<Record<string, unknown>>()),
  use应用状态: () => mock应用状态,
}));
vi.mock('../路由/导航钩子', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  use导航: () => ({ 返回: vi.fn(), 跳转: vi.fn() }),
}));

/** Mock 底座：当前意向 后端工程师（J-01～J-05，其中 J-05 需要你=false），档位由用例给 */
function 置Mock状态(选项: { 看什么?: 看什么档; 范围?: 在谈范围档 } = {}) {
  mock应用状态 = {
    数据源模式: 'mock',
    派发: mock派发,
    状态: {
      子视图: '在谈', 当前Tab: '职位',
      在谈看什么: 选项.看什么 ?? '全部',
      在谈范围: 选项.范围 ?? '当前',
      求职意向表: [{ 编号: 'I-1', 标题: '后端工程师', 说明: '' }],
      当前意向: '后端工程师', 当前意向编号: null,
      在谈列表,
      全局规则: [], 意向级规则: [],
    },
    后端状态: {},
    操作: {},
  };
}

/** 当前意向（后端工程师）五单的职位名，按 Mock 数据顺序 —— 需要你 的四单在前、J-05 在后，
 *  与今天「全部」档的渲染顺序一致（排序不变的基准） */
const 后端工程师五单 = 在谈列表.filter((单) => 单.意向 === '后端工程师').map((单) => 单.职位);

/** 屏上出现的当前意向职位名，按 DOM 顺序 */
function 读职位顺序(): string[] {
  return Array.from(document.querySelectorAll('*'))
    .filter((节) => 节.children.length === 0 && 后端工程师五单.includes(节.textContent ?? ''))
    .map((节) => 节.textContent ?? '');
}

describe('在谈首页 · 删筛选（第二批 验收2/4/5）', () => {
  beforeEach(() => {
    mock派发.mockClear();
  });

  it('验收2 · 顶栏无「筛选」文字按钮、无「看哪几单」面板；在谈 / 市场 子视图键仍在', async () => {
    置Mock状态();
    render(<在谈首页 />);
    // Mock 体有模拟加载：以第一张卡出现为渲染完成
    expect(await screen.findByText('资深后端工程师 · 交易网关')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /筛选/ })).toBeNull();
    expect(screen.queryByText('看哪几单')).toBeNull();
    expect(screen.queryByText('全部意向')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: '在谈' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '市场' })).toBeTruthy();
  });

  it.each(['待我拍板', '进行中'] as const)(
    '验收4 · 在谈看什么=%s 时列表仍显示当前意向全部五单（含 J-05 不需要你），排序不变',
    async (档) => {
      置Mock状态({ 看什么: 档 });
      render(<在谈首页 />);
      expect(await screen.findByText('资深后端工程师 · 交易网关')).toBeTruthy();
      expect(后端工程师五单).toHaveLength(5);
      // J-05（递交简历 · 需要你=false）也在，且五单顺序与「全部」档一致
      expect(screen.getByText('存储引擎资深工程师')).toBeTruthy();
      expect(读职位顺序()).toEqual(后端工程师五单);
    },
  );

  it('验收5 · 「我」页「待你拍」落地态（在谈范围=全部 + 待我拍板）照常渲染不报错，当前意向五单都在', async () => {
    置Mock状态({ 看什么: '待我拍板', 范围: '全部' });
    render(<在谈首页 />);
    expect(await screen.findByText('资深后端工程师 · 交易网关')).toBeTruthy();
    for (const 职位 of 后端工程师五单) {
      expect(screen.getByText(职位)).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: /筛选/ })).toBeNull();
  });
});
