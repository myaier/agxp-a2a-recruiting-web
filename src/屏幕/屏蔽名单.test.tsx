// Task 5：屏蔽名单 Backend 写线测试（合同 B 公司选择抽屉 + 页面本地 来源/待选企业）。
// Backend 模式改成「选来源 → 开抽屉搜组织 → 点结果回填 → 屏蔽」：发给服务端的是
// 选中的稳定组织 ID，自由文本本身永远不构成屏蔽；来源与待选企业互相独立，
// 两者都有值才启用「屏蔽」，改来源不清理待选、取消抽屉保留原值。
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

/** Backend 模式的应用状态桩：目录搜索/创建走合同 A（操作.搜索组织 / 操作.创建组织） */
function 后端环境(覆盖: {
  屏蔽名单?: 屏蔽项[];
  搜索组织?: unknown;
  创建组织?: unknown;
  添加组织屏蔽?: unknown;
  解除组织屏蔽?: unknown;
  隐私快照?: unknown;
} = {}) {
  const 搜索组织 = 覆盖.搜索组织 ?? vi.fn().mockResolvedValue(BFF组织搜索页样本);
  const 创建组织 = 覆盖.创建组织 ?? vi.fn();
  const 添加组织屏蔽 = 覆盖.添加组织屏蔽 ?? vi.fn().mockResolvedValue(undefined);
  const 解除组织屏蔽 = 覆盖.解除组织屏蔽 ?? vi.fn().mockResolvedValue(undefined);
  const 派发 = vi.fn();
  mock应用状态 = {
    状态: { 屏蔽名单: 覆盖.屏蔽名单 ?? [] },
    派发,
    操作: { 搜索组织, 创建组织, 添加组织屏蔽, 解除组织屏蔽 },
    数据源模式: 'backend',
    后端状态: { 隐私快照: 覆盖.隐私快照 !== undefined ? 覆盖.隐私快照 : BFF隐私快照样本, 主体: null },
  };
  return { 搜索组织, 创建组织, 添加组织屏蔽, 解除组织屏蔽, 派发 };
}

/** 抽屉内查询域（弹层框架 dialog，标签「选择企业」） */
function 抽屉() {
  return within(screen.getByRole('dialog', { name: '选择企业' }));
}

/** 打开公司选择抽屉并输入搜索词，等过 250ms debounce（城市查询钩子.test.ts 同款真实时钟手法） */
async function 打开抽屉并搜索(用户: ReturnType<typeof userEvent.setup>, 词: string) {
  await 用户.click(screen.getByRole('button', { name: '选择要屏蔽的公司' }));
  fireEvent.change(抽屉().getByPlaceholderText('输入公司名称'), { target: { value: 词 } });
  await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
}

/** 选中唯一命中行：抽屉关闭、待选回填（行按钮 aria-label = 常用名） */
async function 选中命中行() {
  fireEvent.click(抽屉().getByRole('button', { name: '云衢科技' }));
  await act(async () => {});
}

describe('屏蔽名单 · Backend 公司选择抽屉写线', () => {
  it('抽屉搜索命中但不点「屏蔽」就没有任何写入，也不派发本地拉黑', async () => {
    const 用户 = userEvent.setup();
    const { 搜索组织, 添加组织屏蔽, 派发 } = 后端环境({
      屏蔽名单: 从BFF隐私(BFF隐私快照样本).屏蔽名单,
    });
    渲染屏蔽名单();
    // 水合样本名单非空：既有分组结构原样（样本块来源为手动 → 只出现手动组标）
    expect(screen.getAllByText('你手动添加').length).toBe(1);

    await 打开抽屉并搜索(用户, '云衢');
    // 命中行出现（抽屉内以 aria-label=常用名 定位，避免与既有名单里的同名展示行混淆）
    expect(抽屉().getByRole('button', { name: '云衢科技' })).toBeTruthy();
    expect(搜索组织).toHaveBeenCalledWith({ q: '云衢', limit: 20 });
    expect(添加组织屏蔽).not.toHaveBeenCalled();
    expect(派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));
  });

  it('未选来源/未选企业时「屏蔽」禁用；两者都有值才启用', async () => {
    const 用户 = userEvent.setup();
    后端环境();
    渲染屏蔽名单();
    const 屏蔽钮 = () => screen.getByRole('button', { name: '屏蔽' }) as HTMLButtonElement;
    expect(屏蔽钮().disabled).toBe(true);

    // 只有待选（未选来源）：仍禁用
    await 打开抽屉并搜索(用户, '云衢');
    await 选中命中行();
    expect(屏蔽钮().disabled).toBe(true);
    // 两者都有：启用
    await 用户.click(screen.getByRole('button', { name: '手动添加' }));
    expect(屏蔽钮().disabled).toBe(false);
  });

  it('点选命中项再按「屏蔽」发送稳定组织 ID 与所选来源；成功后清待选保留来源', async () => {
    const 用户 = userEvent.setup();
    const { 添加组织屏蔽, 派发 } = 后端环境();
    渲染屏蔽名单();

    await 用户.click(screen.getByRole('button', { name: '手动添加' }));
    await 打开抽屉并搜索(用户, '云衢');
    await 选中命中行();
    // 抽屉关闭、待选回填：入口按钮回显命中名，「屏蔽」启用
    expect(screen.getByRole('button', { name: '云衢科技' })).toBeTruthy();

    const 屏蔽钮 = screen.getByRole('button', { name: '屏蔽' }) as HTMLButtonElement;
    expect(屏蔽钮.disabled).toBe(false);
    await 用户.click(屏蔽钮);
    await act(async () => {}); // 成功续体在事件循环微任务里落地后再断言
    expect(添加组织屏蔽).toHaveBeenCalledTimes(1);
    expect(添加组织屏蔽).toHaveBeenCalledWith('org_1', '手动添加');
    expect(派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));

    // 成功后清待选（按钮回到占位、「屏蔽」随待选清空而禁用）；来源仍在：
    // 不重选来源、直接再选一家，仍以同一来源屏蔽
    expect(screen.getByRole('button', { name: '选择要屏蔽的公司' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '屏蔽' }) as HTMLButtonElement).disabled).toBe(true);
    await 打开抽屉并搜索(用户, '云衢');
    await 选中命中行();
    await 用户.click(screen.getByRole('button', { name: '屏蔽' }));
    await act(async () => {});
    expect(添加组织屏蔽).toHaveBeenLastCalledWith('org_1', '手动添加');
  });

  it('改来源不清理待选企业；取消抽屉保留原值', async () => {
    const 用户 = userEvent.setup();
    后端环境();
    渲染屏蔽名单();
    await 用户.click(screen.getByRole('button', { name: '手动添加' }));
    await 打开抽屉并搜索(用户, '云衢');
    await 选中命中行();

    // 改来源：待选企业保留，「屏蔽」保持可用
    await 用户.click(screen.getByRole('button', { name: '关联公司' }));
    expect(screen.getByRole('button', { name: '云衢科技' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '屏蔽' }) as HTMLButtonElement).disabled).toBe(false);

    // 取消抽屉（遮罩）：草稿不变，原待选与来源都保留
    await 用户.click(screen.getByRole('button', { name: '云衢科技' }));
    await 用户.click(screen.getByRole('button', { name: '关闭选择企业' }));
    expect(screen.getByRole('button', { name: '云衢科技' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '屏蔽' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('来源分组：当前雇主/关联公司在「建档时自动屏蔽」，手动在「你手动添加」', () => {
    后端环境({ 屏蔽名单: 屏蔽名单初始 });
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
    后端环境({ 屏蔽名单: 屏蔽名单初始, 解除组织屏蔽 });
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

  it('organization_unavailable：弃掉本次待选，「屏蔽」回到禁用，绝不落本地假成功', async () => {
    const 用户 = userEvent.setup();
    const { 派发 } = 后端环境({
      添加组织屏蔽: vi.fn().mockRejectedValue(
        new BFF错误(409, 'organization_unavailable', 'organization gone'),
      ),
    });
    渲染屏蔽名单();
    await 用户.click(screen.getByRole('button', { name: '手动添加' }));
    await 打开抽屉并搜索(用户, '云衢');
    await 选中命中行();

    await 用户.click(screen.getByRole('button', { name: '屏蔽' }));
    await act(async () => {}); // 拒绝续体（弃选中）落地后再断言
    expect(派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));
    // 待选已弃：入口按钮回占位，「屏蔽」回到禁用；来源仍在
    expect(screen.getByRole('button', { name: '选择要屏蔽的公司' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '屏蔽' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('添加组织屏蔽失败（非 organization_unavailable）：弹现有轻提示错误文案并保留待选可重试，绝不落本地假成功', async () => {
    const 用户 = userEvent.setup();
    const { 添加组织屏蔽, 派发 } = 后端环境({
      添加组织屏蔽: vi.fn().mockRejectedValue(new BFF错误(503, 'backend_unavailable', '后端不可用')),
    });
    渲染屏蔽名单();
    await 用户.click(screen.getByRole('button', { name: '手动添加' }));
    await 打开抽屉并搜索(用户, '云衢');
    await 选中命中行();
    await 用户.click(screen.getByRole('button', { name: '屏蔽' }));
    // 503 → 现有错误文案映射；organization_unavailable 之外的失败不再静默
    expect(await screen.findByText('后端服务暂时不可用，请稍后重试')).toBeTruthy();
    expect(添加组织屏蔽).toHaveBeenCalledTimes(1);
    expect(派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));
    // 待选保留：用户可直接再点「屏蔽」重试
    expect(screen.getByRole('button', { name: '云衢科技' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '屏蔽' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('解除组织屏蔽失败：弹现有轻提示错误文案且弹层按既有口径关闭，不派发本地假成功', async () => {
    const 用户 = userEvent.setup();
    const 解除组织屏蔽 = vi.fn().mockRejectedValue(new BFF错误(409, 'version_conflict', '版本冲突'));
    后端环境({ 屏蔽名单: 屏蔽名单初始, 解除组织屏蔽 });
    渲染屏蔽名单();
    await 用户.click(within(
      screen.getByText('恒达外包').parentElement!.parentElement!,
    ).getByRole('button', { name: '解除' }));
    await 用户.click(screen.getByRole('button', { name: '确认解除' }));
    // 409 version_conflict → 现有错误文案映射；弹层仍按既有行为关闭
    expect(await screen.findByText('数据已在其他地方更新，请重试')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '确认解除' })).toBeNull();
    expect(mock应用状态.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '解除屏蔽' }));
  });

  it('Mock 模式保持本地 free-text 屏蔽路径且不做任何搜索', async () => {
    const 用户 = userEvent.setup();
    const 派发 = vi.fn();
    const 搜索组织 = vi.fn();
    const 添加组织屏蔽 = vi.fn();
    mock应用状态 = {
      状态: { 屏蔽名单: 屏蔽名单初始 },
      派发,
      操作: { 搜索组织, 添加组织屏蔽 },
      数据源模式: 'mock',
      后端状态: { 隐私快照: null },
    };
    渲染屏蔽名单();
    // Mock 不渲染来源分段与抽屉入口
    expect(screen.queryByRole('button', { name: '手动添加' })).toBeNull();
    expect(screen.queryByRole('button', { name: '选择要屏蔽的公司' })).toBeNull();

    const 输入框 = screen.getByPlaceholderText('输入公司全称，如「某某科技」') as HTMLInputElement;
    await 用户.type(输入框, '新视界传媒');
    await 用户.click(screen.getByRole('button', { name: '屏蔽' }));
    expect(派发).toHaveBeenCalledWith({ 型: '拉黑', 名称: '新视界传媒' });
    expect(输入框.value).toBe('');
    expect(screen.getByText('已屏蔽 新视界传媒，双向不可见')).toBeTruthy();
    expect(搜索组织).not.toHaveBeenCalled();
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
    const { 搜索组织, 添加组织屏蔽 } = 后端环境({
      屏蔽名单: 屏蔽名单初始,
      隐私快照: null,
      搜索组织: vi.fn(),
      添加组织屏蔽: vi.fn(),
    });
    渲染屏蔽名单();

    expect(screen.getByText('双向不可见')).toBeTruthy();
    expect(screen.queryByText(/家 · 双向不可见/)).toBeNull(); // 绝不出现「0 家」式计数
    expect(screen.getByText(/搜不到、匹配不到你的任何画像/)).toBeTruthy(); // 说明条仍在
    expect(screen.getByRole('button', { name: '选择要屏蔽的公司' })).toBeTruthy();
    // Mock 行不得冒充服务端视图；空态断言也不得替服务端发言
    for (const 条 of 屏蔽名单初始 as 屏蔽项[]) {
      expect(screen.queryByText(条.名称)).toBeNull();
    }
    expect(screen.queryByText('名单是空的')).toBeNull();
    expect(screen.queryByText(/没有屏蔽任何公司时/)).toBeNull();

    for (const 名称 of ['当前雇主', '关联公司', '手动添加']) {
      expect((screen.getByRole('button', { name: 名称 }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((screen.getByRole('button', { name: '选择要屏蔽的公司' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '屏蔽' }) as HTMLButtonElement).disabled).toBe(true);

    // 禁用控件点击不产生任何写入或请求
    await 用户.click(screen.getByRole('button', { name: '手动添加' }));
    expect(搜索组织).not.toHaveBeenCalled();
    expect(添加组织屏蔽).not.toHaveBeenCalled();
    expect(mock应用状态.派发).not.toHaveBeenCalled();
  });
});