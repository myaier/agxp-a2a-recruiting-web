// Task 4：屏蔽名单 Backend 写线测试。
// Backend 模式改成「选来源 → 搜组织 → 点结果 → 屏蔽」：发给服务端的是搜索命中的稳定组织 ID，
// 自由文本本身永远不构成屏蔽；来源分组与解除风险警示改按 屏蔽项.来源 推导（不再解析 理由 文案）。
// 未水合（隐私快照 null）只留外壳与说明，不出现数字计数 / 空态断言 / Mock 行，控件全部禁用。
// Mock 模式保持原本地 free-text 路径且不发起任何搜索。所有既有文案字节不变。

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import 屏蔽名单 from './屏蔽名单';
import { BFF错误 } from '../数据/HTTP客户端';
import { 从BFF隐私 } from '../数据/隐私映射';
import { BFF隐私快照样本, BFF组织搜索页样本 } from '../测试/BFF样本';
import { 屏蔽名单初始 } from '../数据/模拟数据';
import type { 屏蔽项 } from '../数据/类型';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: vi.fn(), 跳转: vi.fn(), 替换跳转: vi.fn() }),
}));

function 渲染屏蔽名单() {
  return render(<MemoryRouter><屏蔽名单 /></MemoryRouter>);
}

/** 输入后等过 250ms debounce（城市查询钩子.test.ts 同款真实时钟手法） */
async function 输入并等搜索(词: string) {
  fireEvent.change(screen.getByPlaceholderText('输入公司全称，如「某某科技」'), {
    target: { value: 词 },
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
}

describe('屏蔽名单 · Backend 组织搜索写线', () => {
  it('Backend 只打字永不产生屏蔽，出结果后不点「屏蔽」就没有任何写入', async () => {
    const 用户 = userEvent.setup();
    const 添加组织屏蔽 = vi.fn().mockResolvedValue(undefined);
    const 搜索可屏蔽组织 = vi.fn().mockResolvedValue(BFF组织搜索页样本);
    mock应用状态 = {
      状态: { 屏蔽名单: 从BFF隐私(BFF隐私快照样本).屏蔽名单 },
      派发: vi.fn(),
      操作: { 搜索可屏蔽组织, 添加组织屏蔽 },
      数据源模式: 'backend',
      后端状态: { 隐私快照: BFF隐私快照样本 },
    };
    渲染屏蔽名单();
    // 水合样本名单非空：既有分组结构原样（样本块来源为手动 → 只出现手动组标）
    expect(screen.getAllByText('你手动添加').length).toBe(1);

    await 用户.click(screen.getByRole('button', { name: '手动添加' }));
    await 输入并等搜索('云衢');
    // 命中行出现（以法定全称定位结果行，避免与既有名单里的同名展示行混淆）
    expect(screen.getByText('上海云衢科技有限公司')).toBeTruthy();
    expect(搜索可屏蔽组织).toHaveBeenCalledWith({ q: '云衢', limit: 20 });
    expect(添加组织屏蔽).not.toHaveBeenCalled();
    expect(mock应用状态.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));
  });

  it('点选命中项再按「屏蔽」发送稳定组织 ID 与所选来源；成功后清词保留来源', async () => {
    const 用户 = userEvent.setup();
    const 添加组织屏蔽 = vi.fn().mockResolvedValue(undefined);
    const 搜索可屏蔽组织 = vi.fn().mockResolvedValue(BFF组织搜索页样本);
    mock应用状态 = {
      状态: { 屏蔽名单: [] },
      派发: vi.fn(),
      操作: { 搜索可屏蔽组织, 添加组织屏蔽 },
      数据源模式: 'backend',
      后端状态: { 隐私快照: BFF隐私快照样本 },
    };
    渲染屏蔽名单();

    // 未选来源时输入框与「屏蔽」都禁用
    const 输入框 = screen.getByPlaceholderText('输入公司全称，如「某某科技」') as HTMLInputElement;
    expect(输入框.disabled).toBe(true);
    expect((screen.getByRole('button', { name: '屏蔽' }) as HTMLButtonElement).disabled).toBe(true);

    const 手动钮 = screen.getByRole('button', { name: '手动添加' });
    await 用户.click(手动钮);
    expect(输入框.disabled).toBe(false);

    await 输入并等搜索('云衢');
    fireEvent.click(screen.getByText('上海云衢科技有限公司').closest('button')!);
    expect(输入框.value).toBe('云衢科技');

    const 屏蔽钮 = screen.getByRole('button', { name: '屏蔽' }) as HTMLButtonElement;
    expect(屏蔽钮.disabled).toBe(false);
    await 用户.click(屏蔽钮);
    await act(async () => {}); // 成功续体在事件循环微任务里落地后再断言
    expect(添加组织屏蔽).toHaveBeenCalledTimes(1);
    expect(添加组织屏蔽).toHaveBeenCalledWith('org_1', '手动添加');
    expect(mock应用状态.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));

    // 成功后清词、来源仍在（输入框保持可用，供下一次屏蔽）
    expect(输入框.value).toBe('');
    expect(输入框.disabled).toBe(false);
  });

  it('来源分组：当前雇主/关联公司在「建档时自动屏蔽」，手动在「你手动添加」', () => {
    mock应用状态 = {
      状态: { 屏蔽名单: 屏蔽名单初始 },
      派发: vi.fn(),
      操作: { 解除组织屏蔽: vi.fn().mockResolvedValue(undefined) },
      数据源模式: 'backend',
      后端状态: { 隐私快照: BFF隐私快照样本 },
    };
    渲染屏蔽名单();
    const 自动卡 = screen.getByText('建档时自动屏蔽').nextElementSibling as HTMLElement;
    expect(within(自动卡).getByText('锐思数据')).toBeTruthy();
    expect(within(自动卡).getByText('锐思数据（杭州）')).toBeTruthy();
    expect(within(自动卡).queryByText('恒达外包')).toBeNull();

    const 手动卡 = screen.getByText('你手动添加').nextElementSibling as HTMLElement;
    expect(within(手动卡).getByText('恒达外包')).toBeTruthy();
    expect(within(手动卡).queryByText('锐思数据')).toBeNull();
    expect(screen.queryByText('名单是空的')).toBeNull();
  });

  it('解除走操作层并传完整条目：风险警示只对当前雇主/关联公司出现，本地归约不被派发', async () => {
    const 用户 = userEvent.setup();
    const 解除组织屏蔽 = vi.fn().mockResolvedValue(undefined);
    const 风险行 = 屏蔽名单初始[0]; // 来源 当前雇主
    const 手动行 = 屏蔽名单初始[2]; // 来源 手动添加
    mock应用状态 = {
      状态: { 屏蔽名单: 屏蔽名单初始 },
      派发: vi.fn(),
      操作: { 解除组织屏蔽 },
      数据源模式: 'backend',
      后端状态: { 隐私快照: BFF隐私快照样本 },
    };
    渲染屏蔽名单();

    await 用户.click(within(
      screen.getByText('锐思数据').parentElement!.parentElement!,
    ).getByRole('button', { name: '解除' }));
    const 风险正文 = screen.getByText(/解除后这家公司可以看到你的匿名画像/);
    expect(风险正文.textContent).toContain('这是你的当前雇主或其关联公司，解除意味着放弃这层保密。');
    await 用户.click(screen.getByRole('button', { name: '确认解除' }));
    await act(async () => {});
    expect(解除组织屏蔽).toHaveBeenCalledWith(风险行);
    expect(mock应用状态.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '解除屏蔽' }));

    await 用户.click(within(
      screen.getByText('恒达外包').parentElement!.parentElement!,
    ).getByRole('button', { name: '解除' }));
    const 手动正文 = screen.getByText(/解除后这家公司可以看到你的匿名画像/);
    expect(手动正文.textContent).not.toContain('放弃这层保密');
    await 用户.click(screen.getByRole('button', { name: '确认解除' }));
    expect(解除组织屏蔽).toHaveBeenLastCalledWith(手动行);
    expect(await screen.findByText('已解除对 恒达外包 的屏蔽')).toBeTruthy();
  });

  it('organization_unavailable：弃选中重查，可见输入文本不动，绝不落本地假成功', async () => {
    const 用户 = userEvent.setup();
    const 搜索可屏蔽组织 = vi.fn().mockResolvedValue(BFF组织搜索页样本);
    const 添加组织屏蔽 = vi.fn().mockRejectedValue(
      new BFF错误(409, 'organization_unavailable', 'organization gone'),
    );
    mock应用状态 = {
      状态: { 屏蔽名单: [] },
      派发: vi.fn(),
      操作: { 搜索可屏蔽组织, 添加组织屏蔽 },
      数据源模式: 'backend',
      后端状态: { 隐私快照: BFF隐私快照样本 },
    };
    渲染屏蔽名单();
    await 用户.click(screen.getByRole('button', { name: '手动添加' }));
    await 输入并等搜索('云衢');
    fireEvent.click(screen.getByText('上海云衢科技有限公司').closest('button')!);

    await 用户.click(screen.getByRole('button', { name: '屏蔽' }));
    await act(async () => {}); // 拒绝续体（弃选中 + 重查）落地后再断言
    expect(mock应用状态.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));
    // 选中已弃：按钮回到禁用；可见查询文本原样保留
    expect((screen.getByRole('button', { name: '屏蔽' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByPlaceholderText('输入公司全称，如「某某科技」') as HTMLInputElement).value)
      .toBe('云衢科技');
  });

  it('Mock 模式保持本地 free-text 屏蔽路径且不做任何搜索', async () => {
    const 用户 = userEvent.setup();
    const 派发 = vi.fn();
    const 搜索可屏蔽组织 = vi.fn();
    const 添加组织屏蔽 = vi.fn();
    mock应用状态 = {
      状态: { 屏蔽名单: 屏蔽名单初始 },
      派发,
      操作: { 搜索可屏蔽组织, 添加组织屏蔽 },
      数据源模式: 'mock',
      后端状态: { 隐私快照: null },
    };
    渲染屏蔽名单();
    // Mock 不渲染来源分段
    expect(screen.queryByRole('button', { name: '手动添加' })).toBeNull();

    const 输入框 = screen.getByPlaceholderText('输入公司全称，如「某某科技」') as HTMLInputElement;
    await 用户.type(输入框, '新视界传媒');
    await 用户.click(screen.getByRole('button', { name: '屏蔽' }));
    expect(派发).toHaveBeenCalledWith({ 型: '拉黑', 名称: '新视界传媒' });
    expect(输入框.value).toBe('');
    expect(screen.getByText('已屏蔽 新视界传媒，双向不可见')).toBeTruthy();
    expect(搜索可屏蔽组织).not.toHaveBeenCalled();
    expect(添加组织屏蔽).not.toHaveBeenCalled();
  });

  it('Mock 名单为空时空态原文保留', () => {
    mock应用状态 = {
      状态: { 屏蔽名单: [] },
      派发: vi.fn(),
      操作: {},
      数据源模式: 'mock',
      后端状态: { 隐私快照: null },
    };
    渲染屏蔽名单();
    expect(screen.getByText('名单是空的')).toBeTruthy();
    expect(screen.getByText('没有屏蔽任何公司时，你的匿名画像对全部在招企业可见。')).toBeTruthy();
  });
});

describe('屏蔽名单 · Backend Privacy 未水合', () => {
  it('外壳与说明保留；无计数副标题、无空态断言、Mock 行不外露、控件全禁用', async () => {
    const 用户 = userEvent.setup();
    const 搜索可屏蔽组织 = vi.fn();
    const 添加组织屏蔽 = vi.fn();
    mock应用状态 = {
      状态: { 屏蔽名单: 屏蔽名单初始 },
      派发: vi.fn(),
      操作: { 搜索可屏蔽组织, 添加组织屏蔽 },
      数据源模式: 'backend',
      后端状态: { 隐私快照: null },
    };
    渲染屏蔽名单();

    expect(screen.getByText('双向不可见')).toBeTruthy();
    expect(screen.queryByText(/家 · 双向不可见/)).toBeNull(); // 绝不出现「0 家」式计数
    expect(screen.getByText(/搜不到、匹配不到你的任何画像/)).toBeTruthy(); // 说明条仍在
    expect(screen.getByPlaceholderText('输入公司全称，如「某某科技」')).toBeTruthy();
    // Mock 行不得冒充服务端视图；空态断言也不得替服务端发言
    for (const 条 of 屏蔽名单初始 as 屏蔽项[]) {
      expect(screen.queryByText(条.名称)).toBeNull();
    }
    expect(screen.queryByText('名单是空的')).toBeNull();
    expect(screen.queryByText(/没有屏蔽任何公司时/)).toBeNull();

    for (const 名称 of ['当前雇主', '关联公司', '手动添加']) {
      expect((screen.getByRole('button', { name: 名称 }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((screen.getByPlaceholderText('输入公司全称，如「某某科技」') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '屏蔽' }) as HTMLButtonElement).disabled).toBe(true);

    // 禁用控件点击不产生任何写入或请求
    await 用户.click(screen.getByRole('button', { name: '手动添加' }));
    expect(搜索可屏蔽组织).not.toHaveBeenCalled();
    expect(添加组织屏蔽).not.toHaveBeenCalled();
    expect(mock应用状态.派发).not.toHaveBeenCalled();
  });
});
