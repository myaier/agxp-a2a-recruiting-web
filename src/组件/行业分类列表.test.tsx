// 行业分类列表 组件测试（picker 统一 Task 1）：
// 纯展示列表 —— 选期望行业（全页多选）与 工作经历行业弹层（单选）两业务注入同一组件，
// 组件只收 行 目录行、根态与回调，不读数据源模式/Context/DTO。这里断言展示契约与点击归属：
//   · 行点击归属：可选=选择区；可选且有子项=名称点击选择、独立展开钮展开（分开选择区/展开钮）；
//     不可选且有子项=整行展开；不可选且无子项=死端不可点；
//   · 层级 2 且有子项显示「暂不支持继续展开」，不伪装可选；
//   · 行尾状态：首载「加载中…」、失败+重试、成功空页「暂无内容」、有下一页「加载更多」；
//   · 已选回显按稳定键：同名行各自独立；上限态只限多选。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { 行业分类列表, type 行业分类列表Props, type 行业行 } from './行业分类列表';

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

function 基础Props(覆盖: Partial<行业分类列表Props> = {}): 行业分类列表Props {
  return {
    行: [],
    根加载中: false,
    根错误: null,
    根空: false,
    根可加载更多: false,
    切换展开: vi.fn(),
    加载更多: vi.fn(),
    重试: vi.fn(),
    已选键: [],
    上限: 3,
    选择: vi.fn(),
    ...覆盖,
  };
}

describe('行业分类列表 展示契约', () => {
  it('行按给定顺序与层级缩进上屏：层级 1 缩进 28、层级 2 缩进 52', () => {
    render(
      <行业分类列表
        {...基础Props({
          行: [
            行('r1', '金融科技', { 有子项: true, 展开: true }),
            行('c1', '支付与清结算', { 层级: 1, 可选: true }),
            行('g1', '反欺诈引擎', { 层级: 2, 可选: true }),
          ],
        })}
      />,
    );
    expect(screen.getByText('金融科技')).toBeTruthy();
    expect(screen.getByText('支付与清结算')).toBeTruthy();
    expect(screen.getByText('反欺诈引擎')).toBeTruthy();
    // 缩进落在行容器（可选行=按钮本身；展开钮行的行块）上
    expect((screen.getByText('支付与清结算')!.closest('button') as HTMLElement).style.paddingLeft).toBe('28px');
    expect((screen.getByText('反欺诈引擎')!.closest('button') as HTMLElement).style.paddingLeft).toBe('52px');
  });

  it('可选叶子点击交给 选择；不可选且有子项整行展开；死端行不触发任何回调', async () => {
    const 选择 = vi.fn();
    const 切换展开 = vi.fn();
    render(
      <行业分类列表
        {...基础Props({
          行: [
            行('leaf', '可选叶子', { 可选: true }),
            行('branch', '下钻父项', { 有子项: true }),
            行('dead', '死端行'),
          ],
          选择,
          切换展开,
        })}
      />,
    );
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('可选叶子'));
    expect(选择).toHaveBeenCalledWith({ 键: 'leaf', 名称: '可选叶子', 可选: true, 有子项: false });
    expect(切换展开).not.toHaveBeenCalled();
    await 用户.click(screen.getByText('下钻父项'));
    expect(切换展开).toHaveBeenCalledWith('branch');
    expect(选择).toHaveBeenCalledTimes(1);
    await 用户.click(screen.getByText('死端行'));
    expect(选择).toHaveBeenCalledTimes(1);
    expect(切换展开).toHaveBeenCalledTimes(1);
  });

  it('可选且有子项：名称点击=选择、独立展开钮点击=展开，两个控件分开', async () => {
    const 选择 = vi.fn();
    const 切换展开 = vi.fn();
    render(
      <行业分类列表
        {...基础Props({
          行: [行('both', '可选父项', { 可选: true, 有子项: true })],
          选择,
          切换展开,
        })}
      />,
    );
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('可选父项'));
    expect(选择).toHaveBeenCalledTimes(1);
    expect(切换展开).not.toHaveBeenCalled();
    await 用户.click(screen.getByRole('button', { name: '展开可选父项' }));
    expect(切换展开).toHaveBeenCalledWith('both');
    expect(选择).toHaveBeenCalledTimes(1);
  });

  it('三级且有子项显示「暂不支持继续展开」，不可点、不伪装可选', async () => {
    const 选择 = vi.fn();
    const 切换展开 = vi.fn();
    render(
      <行业分类列表
        {...基础Props({
          行: [行('g1', '三级父项', { 层级: 2, 有子项: true, 达深度上限: true })],
          选择,
          切换展开,
        })}
      />,
    );
    expect(screen.getByText('暂不支持继续展开')).toBeTruthy();
    await userEvent.setup().click(screen.getByText('三级父项'));
    expect(选择).not.toHaveBeenCalled();
    expect(切换展开).not.toHaveBeenCalled();
  });

  it('已选回显按稳定键：同名行各自独立，勾只落已选键上', () => {
    render(
      <行业分类列表
        {...基础Props({
          行: [
            行('a1', '同名项', { 可选: true }),
            行('b1', '同名项', { 可选: true }),
          ],
          已选键: ['a1'],
        })}
      />,
    );
    const 同名们 = screen.getAllByText('同名项');
    expect(同名们).toHaveLength(2);
    expect(同名们[0]!.closest('button')!.textContent).toContain('✓');
    expect(同名们[1]!.closest('button')!.textContent).not.toContain('✓');
    expect((同名们[0]!.closest('button') as HTMLElement).getAttribute('aria-pressed')).toBe('true');
    expect((同名们[1]!.closest('button') as HTMLElement).getAttribute('aria-pressed')).toBe('false');
  });

  it('多选上限态：未选可选行禁用、已选行仍可点取消、展开行不受限；单选（上限1）不禁用', async () => {
    const 选择 = vi.fn();
    const 切换展开 = vi.fn();
    const 视图 = render(
      <行业分类列表
        {...基础Props({
          行: [
            行('已选', '已选项', { 可选: true }),
            行('未选', '未选项', { 可选: true }),
            行('父项', '导航父项', { 有子项: true }),
          ],
          已选键: ['s1', 's2', '已选'],
          上限: 3,
          选择,
          切换展开,
        })}
      />,
    );
    const 用户 = userEvent.setup();
    expect(((screen.getByText('未选项') as HTMLElement).closest('button') as HTMLButtonElement).disabled).toBe(true);
    // 已选行仍可点取消
    await 用户.click(screen.getByText('已选项'));
    expect(选择).toHaveBeenCalledWith({ 键: '已选', 名称: '已选项', 可选: true, 有子项: false });
    // 导航父项展开不受上限影响
    await 用户.click(screen.getByText('导航父项'));
    expect(切换展开).toHaveBeenCalledWith('父项');

    视图.rerender(
      <行业分类列表
        {...基础Props({
          行: [行('已选', '已选项', { 可选: true }), 行('未选', '未选项', { 可选: true })],
          已选键: ['已选'],
          上限: 1,
          选择,
        })}
      />,
    );
    expect(((screen.getByText('未选项') as HTMLElement).closest('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('行尾分页：还有才渲染、点击交给本行 加载更多、忙时「加载中…」禁用', async () => {
    const 加载更多 = vi.fn();
    const 视图 = render(
      <行业分类列表
        {...基础Props({
          行: [行('r1', '金融科技', { 有子项: true, 展开: true, 可加载更多: true })],
          加载更多,
        })}
      />,
    );
    const 用户 = userEvent.setup();
    const 尾 = screen.getByRole('button', { name: '加载更多' });
    await 用户.click(尾);
    expect(加载更多).toHaveBeenCalledWith('r1');

    视图.rerender(
      <行业分类列表
        {...基础Props({
          行: [行('r1', '金融科技', { 有子项: true, 展开: true, 可加载更多: true, 加载中: true })],
          加载更多,
        })}
      />,
    );
    const 忙尾 = screen.getByRole('button', { name: '加载中…' }) as HTMLButtonElement;
    expect(忙尾.disabled).toBe(true);
  });

  it('展开加载中（尚无子行）显示「加载中…」文本；成功空页显示「暂无内容」', () => {
    render(
      <行业分类列表
        {...基础Props({
          行: [行('r1', '加载父项', { 有子项: true, 展开: true, 加载中: true })],
        })}
      />,
    );
    expect(screen.getByText('加载中…')).toBeTruthy();
  });

  it('行失败显示错误 + 重试钮并交给 重试(该行键)；收起（展开=false）不显示', async () => {
    const 重试 = vi.fn();
    const 视图 = render(
      <行业分类列表
        {...基础Props({
          行: [行('r1', '金融科技', { 有子项: true, 展开: true, 错误: '请求失败，请稍后再试' })],
          重试,
        })}
      />,
    );
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(重试).toHaveBeenCalledWith('r1');

    视图.rerender(
      <行业分类列表
        {...基础Props({
          行: [行('r1', '金融科技', { 有子项: true, 展开: false, 错误: '请求失败，请稍后再试' })],
          重试,
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull();
  });

  it('根态：根加载中/根错误+重试(null)/根空/根尾加载更多(null)', async () => {
    const 重试 = vi.fn();
    const 加载更多 = vi.fn();
    const 用户 = userEvent.setup();
    const 视图 = render(<行业分类列表 {...基础Props({ 根加载中: true, 重试, 加载更多 })} />);
    expect(screen.getByText('加载中…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();

    视图.rerender(<行业分类列表 {...基础Props({ 根错误: '无法连接后端服务，请检查网络或稍后再试', 重试, 加载更多 })} />);
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(重试).toHaveBeenCalledWith(null);

    视图.rerender(<行业分类列表 {...基础Props({ 根空: true, 重试, 加载更多 })} />);
    expect(screen.getByText('暂无内容')).toBeTruthy();

    视图.rerender(<行业分类列表 {...基础Props({ 根可加载更多: true, 重试, 加载更多 })} />);
    await 用户.click(screen.getByRole('button', { name: '加载更多' }));
    expect(加载更多).toHaveBeenCalledWith(null);
  });
});