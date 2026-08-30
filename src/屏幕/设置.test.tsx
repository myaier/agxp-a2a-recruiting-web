// Task 3：设置屏 Backend 隐私写线测试。
// 「对现雇主隐身」在 Backend 模式必须走 操作.设置雇主隐私（服务端成功先于任何本地提交），
// 绝不派发本地 切设置开关 假成功；服务端隐私未水合（隐私快照 null）时开关禁用，
// 点击不产生任何写入、也不弹出关闭确认。关闭确认弹层的文案保持字节级不变。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import 设置 from './设置';
import { 初始状态 } from '../状态/初始状态';
import { BFF隐私快照样本 } from '../测试/BFF样本';
import { BFF错误 } from '../数据/HTTP客户端';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: vi.fn(), 跳转: vi.fn(), 替换跳转: vi.fn() }),
}));

describe('设置 · Backend 隐私写线', () => {
  it('Backend 对现雇主隐身使用 Privacy operation，成功前不派发本地 toggle', async () => {
    const 用户 = userEvent.setup();
    const 设置雇主隐私 = vi.fn().mockResolvedValue(undefined);
    const 派发 = vi.fn();
    mock应用状态 = {
      状态: { 设置开关: { ...初始状态.设置开关, 对现雇主隐身: true } },
      派发, 操作: { 设置雇主隐私, 退出登录: vi.fn() },
      数据源模式: 'backend', 后端状态: { 隐私快照: BFF隐私快照样本 },
    };
    render(<MemoryRouter><设置 /></MemoryRouter>);
    await 用户.click(screen.getByRole('switch', { name: '对现雇主隐身' }));
    expect(screen.getByText('关闭「对现雇主隐身」？')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '仍要关闭' }));
    expect(设置雇主隐私).toHaveBeenCalledWith(false);
    expect(派发).not.toHaveBeenCalledWith({ 型: '切设置开关', 键: '对现雇主隐身' });
  });

  it('Backend Privacy 未水合时隐身开关禁用且点击不触发任何写入', async () => {
    const 用户 = userEvent.setup();
    const 设置雇主隐私 = vi.fn().mockResolvedValue(undefined);
    const 派发 = vi.fn();
    mock应用状态 = {
      状态: { 设置开关: { ...初始状态.设置开关, 对现雇主隐身: false } },
      派发, 操作: { 设置雇主隐私, 退出登录: vi.fn() },
      数据源模式: 'backend', 后端状态: { 隐私快照: null },
    };
    render(<MemoryRouter><设置 /></MemoryRouter>);
    // 仓库未装 @testing-library/jest-dom：disabled 用原生属性断言
    const 开关钮 = screen.getByRole('switch', { name: '对现雇主隐身' }) as HTMLButtonElement;
    expect(开关钮.disabled).toBe(true);
    await 用户.click(开关钮);
    expect(设置雇主隐私).not.toHaveBeenCalled();
    expect(派发).not.toHaveBeenCalled();
    expect(screen.queryByText('关闭「对现雇主隐身」？')).toBeNull();
  });

  it('Backend 开启隐身写入失败：弹现有轻提示错误文案，不派发本地假成功', async () => {
    const 用户 = userEvent.setup();
    const 设置雇主隐私 = vi.fn().mockRejectedValue(new BFF错误(409, 'version_conflict', '版本冲突'));
    const 派发 = vi.fn();
    mock应用状态 = {
      状态: { 设置开关: { ...初始状态.设置开关, 对现雇主隐身: false } },
      派发, 操作: { 设置雇主隐私, 退出登录: vi.fn() },
      数据源模式: 'backend', 后端状态: { 隐私快照: BFF隐私快照样本 },
    };
    render(<MemoryRouter><设置 /></MemoryRouter>);
    await 用户.click(screen.getByRole('switch', { name: '对现雇主隐身' }));
    // 409 version_conflict → 现有错误文案映射（同 发布岗位 failed-save 断言）
    expect(await screen.findByText('数据已在其他地方更新，请重试')).toBeTruthy();
    expect(派发).not.toHaveBeenCalled();
  });
});

describe('设置 · 退出确认键的可访问名称', () => {
  // 弹层框架用的是 <dialog open>（组件/弹层框架.tsx:62-64），那是**非模态**的：
  // 层开着的时候页面其余部分既不 inert 也不从可访问树里剪枝，所以触发键与确认键
  // 如果同名，读屏用户按钮浏览会连着读到两枚一模一样的「退出登录」，分不出哪个是确认。
  // 这两条把「两枚键的可访问名称必须不同」钉死；可见文案两处都仍是「退出登录」。
  function 渲染设置() {
    mock应用状态 = {
      状态: { 设置开关: { ...初始状态.设置开关 } },
      派发: vi.fn(),
      操作: { 设置雇主隐私: vi.fn(), 退出登录: vi.fn().mockResolvedValue(undefined) },
      数据源模式: 'backend',
      后端状态: { 隐私快照: BFF隐私快照样本 },
    };
    render(<MemoryRouter><设置 /></MemoryRouter>);
  }

  it('确认层打开后，触发键与确认键的可访问名称互不相同', async () => {
    const 用户 = userEvent.setup();
    渲染设置();
    await 用户.click(screen.getByRole('button', { name: '退出登录' }));
    expect(screen.getByText('退出当前账号？')).toBeTruthy();
    // 层开着时「退出登录」这个名字必须仍然只指向那一枚触发键（不再有第二枚同名键）
    expect(screen.getAllByRole('button', { name: '退出登录' })).toHaveLength(1);
    // 确认键有自己的名字
    expect(screen.getByRole('button', { name: '确认退出当前账号' })).toBeTruthy();
  });

  it('确认键的名字不是任何其它按钮名字的子串（子串匹配的定位器不能有歧义）', async () => {
    const 用户 = userEvent.setup();
    渲染设置();
    await 用户.click(screen.getByRole('button', { name: '退出登录' }));
    // 弹层框架会给遮罩生成 `关闭${标签}`（组件/弹层框架.tsx:61）。确认键若叫「退出当前账号」，
    // 就成了遮罩名「关闭退出当前账号」的子串 —— Playwright 的 getByRole({name}) 与
    // agent-browser 不带 --exact 的 --name 都是子串匹配，会同时命中两枚并报 strict violation。
    const 名字们 = screen.getAllByRole('button').map(
      (键) => 键.getAttribute('aria-label') ?? 键.textContent ?? '',
    );
    expect(名字们.filter((名) => 名.includes('确认退出当前账号'))).toHaveLength(1);
  });

  it('确认键仍然可见文案不变，且点它才真的退出', async () => {
    const 用户 = userEvent.setup();
    渲染设置();
    await 用户.click(screen.getByRole('button', { name: '退出登录' }));
    const 确认键 = screen.getByRole('button', { name: '确认退出当前账号' });
    expect(确认键.textContent).toBe('退出登录');
    await 用户.click(确认键);
    expect(mock应用状态.操作.退出登录).toHaveBeenCalledTimes(1);
  });
});
