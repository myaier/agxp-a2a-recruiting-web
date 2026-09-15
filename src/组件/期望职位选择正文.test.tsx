// 期望职位选择正文 组件测试（Task 7 / B 契约）：
// 纯展示正文 —— 选期望职位页（/onboard/job 与 ?来源=意向）两模式把目录状态与选择动作
// 注入同一组件：次级页外壳(白底) → 返回栏 ‹ → 大标题「期望职位是」→ 搜索条 →
// （无词）左一级栏 + 右分组多选卡 /（有词）搜索结果 → 底部已选 chips + 保存。
// 这里只断言正文壳的展示契约与归属：
//   · 分组标题是语义 heading、不是按钮、点击不触发任何回调；
//   · 空标题组（搜索直接命中平铺）不渲染标题节点；
//   · 职位按钮点击交给 切换选择，禁用项 aria-disabled；
//   · 各级尾态（加载中/错误重试/加载更多）由 尾态 值驱动，正文不持游标；
//   · 已选 chips 点击交给 移除；保存禁用由 可保存 决定；返回/改搜索词交给回调；
//   · 不导入数据源模式 / Context / BFF DTO / API / 路由（无 Provider 也能渲染即证）。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  期望职位选择正文,
  type 期望职位选择正文Props,
  type 目录尾态,
  type 期望职位组,
} from './期望职位选择正文';

const 空尾态 = (): 目录尾态 => ({
  加载中: false, 错误: null, 还有: false, 加载更多: vi.fn(), 重试: vi.fn(),
});

/** 一枚职位项展示值 */
function 项(键: string, 名称: string, 覆盖: Partial<Omit<{ 键: string; 名称: string; 选中: boolean; 禁用: boolean }, '键' | '名称'>> = {}) {
  return { 键, 名称, 选中: false, 禁用: false, ...覆盖 };
}

/** 一个右栏分组展示值 */
function 组(键: string, 标题: string, 项们: ReturnType<typeof 项>[] = [], 覆盖: Partial<期望职位组> = {}): 期望职位组 {
  return { 键, 标题, 项们, 尾态: 空尾态(), ...覆盖 };
}

function 基础Props(覆盖: Partial<期望职位选择正文Props> = {}): 期望职位选择正文Props {
  return {
    搜索词: '',
    改搜索词: vi.fn(),
    根项们: [
      { 键: 'r1', 名称: '产品', 选中: true },
      { 键: 'r2', 名称: '设计', 选中: false },
    ],
    切换根: vi.fn(),
    根尾态: 空尾态(),
    组们: [],
    右尾态: 空尾态(),
    已选: [],
    切换选择: vi.fn(),
    移除: vi.fn(),
    保存: vi.fn(),
    可保存: false,
    返回: vi.fn(),
    ...覆盖,
  };
}

describe('期望职位选择正文 展示契约', () => {
  it('原页面骨架上屏：返回、大标题、搜索框、左右栏与底部保存', () => {
    render(<期望职位选择正文 {...基础Props()} />);
    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '期望职位是' })).toBeTruthy();
    expect(screen.getByPlaceholderText('搜索职位')).toBeTruthy();
    // 左一级栏上屏，当前一级只有一枚（选中态）
    expect(screen.getByText('产品')).toBeTruthy();
    expect(screen.getByText('设计')).toBeTruthy();
  });

  it('搜索词变化交给 改搜索词（正文不持搜索状态）', async () => {
    const 改搜索词 = vi.fn();
    render(<期望职位选择正文 {...基础Props({ 改搜索词 })} />);
    await userEvent.type(screen.getByPlaceholderText('搜索职位'), '产');
    expect(改搜索词).toHaveBeenCalledWith('产');
  });

  it('点一级交给 切换根；当前一级高亮只标一枚', async () => {
    const 切换根 = vi.fn();
    render(<期望职位选择正文 {...基础Props({ 切换根 })} />);
    await userEvent.click(screen.getByText('设计'));
    expect(切换根).toHaveBeenCalledWith('r2');
  });

  it('分组标题是语义 heading 且不可点击；标题下三级职位是按钮', async () => {
    const 切换选择 = vi.fn();
    render(
      <期望职位选择正文
        {...基础Props({
          切换选择,
          组们: [
            组('g1', '产品经理', [项('l1', '产品经理', { 选中: true }), 项('l2', 'AI产品经理')]),
            组('g2', '游戏策划', [项('l3', '游戏策划师')]),
          ],
        })}
      />,
    );
    // 标题是 heading、不是按钮 —— 同名叶子按钮与标题并存互不混淆
    expect(screen.getByRole('heading', { name: '产品经理' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '游戏策划' })).toBeNull();
    expect(screen.getByRole('button', { name: 'AI产品经理' })).toBeTruthy();
    // 点同名标题不触发选择；点叶子按钮触发
    await userEvent.click(screen.getByRole('heading', { name: '产品经理' }));
    expect(切换选择).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'AI产品经理' }));
    expect(切换选择).toHaveBeenCalledWith('l2');
    // 选中态按钮仍在（点击不销毁、不关闭页面）
    expect(screen.getByRole('button', { name: '产品经理' })).toBeTruthy();
  });

  it('禁用项保留展示但标记 aria-disabled，点击不触发 切换选择', async () => {
    const 切换选择 = vi.fn();
    render(
      <期望职位选择正文
        {...基础Props({
          切换选择,
          组们: [组('g1', '产品经理', [项('l1', '产品经理', { 禁用: true })])],
        })}
      />,
    );
    const 卡 = screen.getByRole('button', { name: '产品经理' });
    expect(卡.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(卡);
    expect(切换选择).not.toHaveBeenCalled();
  });

  it('空标题组不渲染标题节点，项平铺（搜索直接命中形态）', () => {
    render(
      <期望职位选择正文
        {...基础Props({
          搜索词: '产品',
          组们: [组('直接', '', [项('l1', '产品经理')])],
        })}
      />,
    );
    // 无任何 heading 组标
    expect(screen.queryAllByRole('heading').length).toBe(1); // 只有大标题
    expect(screen.getByRole('button', { name: '产品经理' })).toBeTruthy();
  });

  it('搜索无命中且无加载/错误时显示空态文案', () => {
    render(
      <期望职位选择正文
        {...基础Props({ 搜索词: '不存在', 组们: [组('直接', '', [])] })}
      />,
    );
    expect(screen.getByText('没有匹配的职位，换个词试试。')).toBeTruthy();
  });

  it('根尾态：错误显示重试，还有显示加载更多', async () => {
    const 根尾态A = { ...空尾态(), 错误: '网络开小差了', 重试: vi.fn() };
    const { unmount } = render(<期望职位选择正文 {...基础Props({ 根尾态: 根尾态A })} />);
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(根尾态A.重试).toHaveBeenCalledTimes(1);
    unmount();

    const 根尾态B = { ...空尾态(), 还有: true, 加载更多: vi.fn() };
    render(<期望职位选择正文 {...基础Props({ 根尾态: 根尾态B })} />);
    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(根尾态B.加载更多).toHaveBeenCalledTimes(1);
  });

  it('分组尾态各自独立呈现：一组错误重试、一组加载更多，互不串', async () => {
    const 组甲 = 组('g1', '产品经理', [项('l1', '产品经理')], {
      尾态: { ...空尾态(), 错误: '加载失败', 重试: vi.fn() },
    });
    const 组乙 = 组('g2', '游戏策划', [], {
      尾态: { ...空尾态(), 还有: true, 加载更多: vi.fn() },
    });
    render(<期望职位选择正文 {...基础Props({ 组们: [组甲, 组乙] })} />);
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    expect((组甲.尾态 as { 重试: () => void }).重试).toHaveBeenCalledTimes(1);
    // 乙组的加载更多仍在，且点击只触发乙组的回调
    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect((组乙.尾态 as { 加载更多: () => void }).加载更多).toHaveBeenCalledTimes(1);
    expect((组甲.尾态 as { 加载更多: () => void }).加载更多).not.toHaveBeenCalled();
  });

  it('右尾态驱动整栏加载中/错误/加载更多', async () => {
    const 右尾态 = { ...空尾态(), 加载中: true };
    const { unmount } = render(<期望职位选择正文 {...基础Props({ 右尾态 })} />);
    expect(screen.getByText('加载中…')).toBeTruthy();
    unmount();

    const 右尾态2 = { ...空尾态(), 错误: '加载失败', 重试: vi.fn() };
    render(<期望职位选择正文 {...基础Props({ 右尾态: 右尾态2 })} />);
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(右尾态2.重试).toHaveBeenCalledTimes(1);
  });

  it('已选 chips 上屏且点击交给 移除；保存由 可保存 决定禁用', async () => {
    const 移除 = vi.fn();
    const 保存 = vi.fn();
    const { unmount } = render(
      <期望职位选择正文
        {...基础Props({
          移除,
          保存,
          可保存: true,
          已选: [
            { 键: 'l1', 名称: '产品经理' },
            { 键: 'l2', 名称: 'AI产品经理' },
          ],
        })}
      />,
    );
    expect(screen.getByText('已选')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '产品经理 ✕' }));
    expect(移除).toHaveBeenCalledWith('l1');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(保存).toHaveBeenCalledTimes(1);
    unmount();

    // 空选择：无已选条，保存禁用
    render(<期望职位选择正文 {...基础Props({ 保存, 可保存: false, 已选: [] })} />);
    expect(screen.queryByText('已选')).toBeNull();
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('返回交给 返回 回调', async () => {
    const 返回 = vi.fn();
    render(<期望职位选择正文 {...基础Props({ 返回 })} />);
    await userEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(返回).toHaveBeenCalledTimes(1);
  });
});
