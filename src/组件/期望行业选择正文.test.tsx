// 期望行业选择正文 组件测试（picker 统一 Task 1）：
// 纯展示正文 —— 选期望行业页两模式把 行业目录钩子 的目录状态与选择注入同一组件：
// 次级页外壳 → 返回栏 ‹ + 右上「保存」→「已选行业」+ N/3 计数 → 副标题 →
// 共用 行业分类列表（折叠目录行）。这里只断言正文壳的展示契约与归属：
//   · 计数来自 已选键（不扫当前可见行）——已选不依赖当前可见项；
//   · 无「推荐」区（原伪推荐按 Plan 删除）；
//   · 保存与返回交给回调；目录行的点击/分页/重试契约由 行业分类列表.test.tsx 证明；
//   · 两模式消费同一正文由 src/屏幕/选期望行业.test.tsx 与 e2e 证明。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  期望行业选择正文,
  type 期望行业选择正文Props,
} from './期望行业选择正文';
import type { 行业行, 行业目录状态 } from './行业分类列表';

/** 一行目录行的展示值 */
function 行(键: string, 名称: string, 覆盖: Partial<Omit<行业行, '键' | '名称'>> = {}): 行业行 {
  return {
    键,
    名称,
    层级: 0, 可选: false, 有子项: false, 展开: false, 加载中: false,
    错误: null, 空: false, 可加载更多: false, 达深度上限: false,
    ...覆盖,
  };
}

function 目录态(覆盖: Partial<行业目录状态> = {}): 行业目录状态 {
  return {
    行: [],
    根加载中: false,
    根错误: null,
    根空: false,
    根可加载更多: false,
    切换展开: vi.fn(),
    加载更多: vi.fn(),
    重试: vi.fn(),
    ...覆盖,
  };
}

function 基础Props(覆盖: Partial<期望行业选择正文Props> = {}): 期望行业选择正文Props {
  return {
    已选键: [],
    上限: 3,
    目录: 目录态({
      行: [行('r1', '金融科技', { 有子项: true })],
    }),
    选择: vi.fn(),
    返回: vi.fn(),
    保存: vi.fn(),
    ...覆盖,
  };
}

describe('期望行业选择正文 展示契约', () => {
  it('原页面骨架上屏：返回栏保存、已选行业 0/3 计数、副标题、无推荐区', () => {
    render(<期望行业选择正文 {...基础Props()} />);

    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '已选行业' })).toBeTruthy();
    expect(screen.getByText('0/3')).toBeTruthy();
    expect(screen.getByText('请选择行业，最多3个')).toBeTruthy();
    // 伪推荐按 Plan 删除：不再有「推荐」组标
    expect(screen.queryByText('推荐')).toBeNull();
    // 共用目录行上屏
    expect(screen.getByText('金融科技')).toBeTruthy();
  });

  it('计数来自 已选键（不扫可见行）：可见行全收起时计数仍如实', () => {
    render(
      <期望行业选择正文
        {...基础Props({
          已选键: ['a1', 'a2'],
        })}
      />,
    );
    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('目录状态与选择透传：可选行=选择、导航行=切换展开、展开行/根尾分页与重试', async () => {
    const 选择 = vi.fn();
    const 切换展开 = vi.fn();
    const 加载更多 = vi.fn();
    const 重试 = vi.fn();
    render(
      <期望行业选择正文
        {...基础Props({
          目录: 目录态({
            行: [
              行('leaf', '可选叶子', { 可选: true }),
              行('r1', '金融科技', { 有子项: true, 展开: true, 可加载更多: true }),
            ],
            根可加载更多: true,
            切换展开,
            加载更多,
            重试,
          }),
          选择,
        })}
      />,
    );
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('可选叶子'));
    expect(选择).toHaveBeenCalledWith({ 键: 'leaf', 名称: '可选叶子', 可选: true, 有子项: false });
    await 用户.click(screen.getByText('金融科技'));
    expect(切换展开).toHaveBeenCalledWith('r1');
    const 尾们 = screen.getAllByRole('button', { name: '加载更多' });
    await 用户.click(尾们[尾们.length - 1]!);
    expect(加载更多).toHaveBeenLastCalledWith(null);
  });

  it('保存与返回交给回调', async () => {
    const 返回 = vi.fn();
    const 保存 = vi.fn();
    render(<期望行业选择正文 {...基础Props({ 返回, 保存 })} />);
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(保存).toHaveBeenCalledTimes(1);
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(返回).toHaveBeenCalledTimes(1);
  });
});