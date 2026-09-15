// 简历行业选择正文 组件测试（picker 统一 Task 1）：
// 纯展示正文 —— 经历编辑页两模式把 行业目录钩子 的目录状态与选择注入同一组件：
// 底部弹层骨架（弹层框架 + 工作经历.module.css 选择层）+ 共用 行业分类列表。
// 这里只断言正文壳的展示契约与归属：
//   · 壳：抓手 + 标题「所属行业」+ 目录行上屏；关闭沿弹层骨架（遮罩/Escape 交给 关闭）；
//   · 无「自填行业」自由文本输入（两模式一致，原 Mock 自填按 Plan 删除）；
//   · 单选（上限=1）语义透传：选择/切换展开/加载更多/重试 交给注入回调；
//   · 已选回显按稳定键；两模式消费同一正文由 src/屏幕/工作经历.test.tsx 与 e2e 证明。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  简历行业选择正文,
  type 简历行业选择正文Props,
} from './简历行业选择正文';
import type { 行业行, 行业目录状态 } from './行业分类列表';

/** 一行目录行的展示值（层级 0 根 / 1 子 / 2 孙） */
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

function 基础Props(覆盖: Partial<简历行业选择正文Props> = {}): 简历行业选择正文Props {
  return {
    目录: 目录态({
      行: [
        行('ind_fin', '金融科技', { 有子项: true }),
      ],
    }),
    已选键: [],
    选择: vi.fn(),
    关闭: vi.fn(),
    ...覆盖,
  };
}

describe('简历行业选择正文 展示契约', () => {
  it('原弹层骨架上屏：抓手、标题、共用目录行（根可展开、子行缩进、选中行带勾）', () => {
    render(
      <简历行业选择正文
        {...基础Props({
          目录: 目录态({
            行: [
              行('r1', '金融科技', { 有子项: true, 展开: true }),
              行('c1', '支付与清结算', { 层级: 1, 可选: true }),
              行('g1', '公募基金', { 层级: 2, 可选: true }),
            ],
          }),
          已选键: ['g1'],
        })}
      />,
    );
    expect(screen.getByText('所属行业')).toBeTruthy();
    // 共用 行业分类列表 上屏：根行可展开、子/孙缩进、已选带勾
    expect((screen.getByText('支付与清结算')!.closest('button') as HTMLElement).style.paddingLeft).toBe('28px');
    expect((screen.getByText('公募基金')!.closest('button') as HTMLElement).style.paddingLeft).toBe('52px');
    expect(screen.getByText('公募基金')!.closest('button')!.textContent).toContain('✓');
  });

  it('行点击与展开归属透传给注入回调：可选行=选择、导航行=切换展开', async () => {
    const 选择 = vi.fn();
    const 切换展开 = vi.fn();
    render(
      <简历行业选择正文
        {...基础Props({
          目录: 目录态({
            行: [
              行('leaf', '可选叶子', { 可选: true }),
              行('branch', '下钻父项', { 有子项: true }),
            ],
            切换展开,
          }),
          选择,
        })}
      />,
    );
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('可选叶子'));
    expect(选择).toHaveBeenCalledWith({ 键: 'leaf', 名称: '可选叶子', 可选: true, 有子项: false });
    await 用户.click(screen.getByText('下钻父项'));
    expect(切换展开).toHaveBeenCalledWith('branch');
  });

  it('分页与重试透传：行尾加载更多、根尾加载更多、错误重试', async () => {
    const 加载更多 = vi.fn();
    const 重试 = vi.fn();
    render(
      <简历行业选择正文
        {...基础Props({
          目录: 目录态({
            行: [行('r1', '金融科技', { 有子项: true, 展开: true, 可加载更多: true })],
            根可加载更多: true,
            加载更多,
            重试,
          }),
        })}
      />,
    );
    const 用户 = userEvent.setup();
    const 尾们 = screen.getAllByRole('button', { name: '加载更多' });
    expect(尾们).toHaveLength(2);
    // 行尾（第 0 枚）归该行键；根尾（最后一枚）= null
    await 用户.click(尾们[0]!);
    expect(加载更多).toHaveBeenCalledWith('r1');
    await 用户.click(尾们[尾们.length - 1]!);
    expect(加载更多).toHaveBeenLastCalledWith(null);
  });

  it('单选无自由文本输入（两模式一致）：不渲染自填输入框', () => {
    render(<简历行业选择正文 {...基础Props()} />);
    expect(screen.queryByPlaceholderText('没有合适的？直接输入')).toBeNull();
  });

  it('关闭沿弹层骨架：遮罩交给 关闭', async () => {
    const 关闭 = vi.fn();
    render(<简历行业选择正文 {...基础Props({ 关闭 })} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '关闭选择所属行业' }));
    expect(关闭).toHaveBeenCalledTimes(1);
  });
});