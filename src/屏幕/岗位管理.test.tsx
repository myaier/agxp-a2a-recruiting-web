// 岗位管理 · 岗位行可访问名称测试。
//
// 滑动行 的 名称 会**替换**（不是补充）由行内容拼出来的那个名字（组件/滑动行.tsx:40 的注释），
// 所以这一屏传进去的必须是这一行完整的业务名：岗位名 → 当前徽 → 薪资/在谈 → 状态徽，
// 顺序与视觉顺序一致，读屏用户拿到的信息与没有 aria-label 时一个字不少。
// 这份测试把四种组合的名称逐字钉住 —— 少一段就是读屏用户丢一段。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import 岗位管理 from './岗位管理';
import { 页面岗位样本 } from '../测试/BFF样本';
import type { 在招岗位 } from '../数据/类型';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

function 岗位(补丁: Partial<在招岗位>): 在招岗位 {
  return { ...页面岗位样本, ...补丁 };
}

function render岗位管理(选项: {
  岗位列表: 在招岗位[];
  企业候选列表?: { 岗位编号: string; 需要你: boolean }[];
  当前岗位编号?: string | null;
}) {
  mock应用状态 = {
    状态: {
      岗位列表: 选项.岗位列表,
      企业候选列表: 选项.企业候选列表 ?? [],
      当前岗位编号: 选项.当前岗位编号 ?? null,
    },
    操作: {
      归档岗位: vi.fn().mockResolvedValue(undefined),
      重开岗位: vi.fn().mockResolvedValue(undefined),
      删除岗位: vi.fn().mockResolvedValue(undefined),
    },
  };
  render(
    <MemoryRouter>
      <岗位管理 />
    </MemoryRouter>,
  );
}

describe('岗位管理 · 岗位行的可访问名称', () => {
  it('在招行带上岗位名、薪资带、在谈人数和状态徽', () => {
    render岗位管理({
      岗位列表: [岗位({ 编号: 'j1', 名称: '浏览器验收岗位 · 在招基线', 薪资带: '30-45K', 状态: '在招' })],
    });
    expect(
      screen.getByRole('button', { name: '浏览器验收岗位 · 在招基线 30-45K · 在谈 0 人 在招' }),
    ).toBeTruthy();
  });

  it('在谈人数取实时算出来的那个数，与停止招聘确认框同一个来源', () => {
    render岗位管理({
      岗位列表: [岗位({ 编号: 'j1', 名称: '交易网关', 薪资带: '50-65K', 状态: '在招', 在谈数: 9 })],
      企业候选列表: [
        { 岗位编号: 'j1', 需要你: false },
        { 岗位编号: 'j1', 需要你: true },
        { 岗位编号: 'j2', 需要你: false },
      ],
    });
    expect(screen.getByRole('button', { name: '交易网关 50-65K · 在谈 2 人 在招' })).toBeTruthy();
  });

  it('当前岗位把「当前」徽也读出来', () => {
    render岗位管理({
      岗位列表: [岗位({ 编号: 'j1', 名称: '交易网关', 薪资带: '50-65K', 状态: '在招' })],
      当前岗位编号: 'j1',
    });
    expect(screen.getByRole('button', { name: '交易网关 当前 50-65K · 在谈 0 人 在招' })).toBeTruthy();
  });

  it('已归档行不报在谈人数，状态徽读「已归档」', () => {
    render岗位管理({
      岗位列表: [岗位({ 编号: 'j2', 名称: '浏览器验收岗位 · 归档基线', 薪资带: '30-45K', 状态: '已归档' })],
    });
    expect(
      screen.getByRole('button', { name: '浏览器验收岗位 · 归档基线 30-45K 已归档' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /在谈/ })).toBeNull();
  });

  it('两组同时在屏时，靠名称结尾的状态徽就能把行分到各自的组', () => {
    render岗位管理({
      岗位列表: [
        岗位({ 编号: 'j1', 名称: '浏览器验收岗位 · 在招基线', 薪资带: '30-45K', 状态: '在招' }),
        岗位({ 编号: 'j2', 名称: '浏览器验收岗位 · 归档基线', 薪资带: '30-45K', 状态: '已归档' }),
      ],
    });
    const 行名们 = screen
      .getAllByRole('button')
      .map((节点) => 节点.getAttribute('aria-label'))
      .filter((名): 名 is string => 名 !== null);
    expect(行名们).toContain('浏览器验收岗位 · 在招基线 30-45K · 在谈 0 人 在招');
    expect(行名们).toContain('浏览器验收岗位 · 归档基线 30-45K 已归档');
  });
});
