// 岗位职业分类正文 组件测试（Task 4）：
// 纯展示正文 —— 发布岗位 职位类别 全屏子视图的两模式（Mock 本地职业分类树 / Backend
// catalog job-categories）把目录状态映射为同一组 props，正文渲染全屏外壳、
// 左一级栏、右「二级标题 + 三级可选职位」三层结构与各级尾态。
// 这里只断言展示契约与点击归属：
//   · 左栏一级是导航按钮 —— 点击交给 切换根，不直接提交；
//   · 二级分组是语义 heading，不是按钮、点击不触发任何回调；
//   · 三级职位是按钮：单击交给 选定（招聘侧单选），禁用项 aria-disabled 不提交；
//   · 空组显示「该分组暂无职位」，与「失败 + 重试」可区分；
//   · 根/右栏/各分组尾态各自独立呈现，正文不持游标、不发请求；
//   · 全屏外壳：Escape 与返回键都交给 关闭。
// 两模式消费同一正文、一级自动展开三级由 src/屏幕/发布岗位.目录.test.tsx 证明。

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  岗位职业分类正文,
  type 岗位职业分类正文Props,
} from './岗位职业分类正文';
import type { 目录尾态, 期望职位项, 期望职位组 } from './期望职位选择正文';

const 空尾态 = (覆盖: Partial<目录尾态> = {}): 目录尾态 => ({
  加载中: false, 错误: null, 还有: false, 加载更多: vi.fn(), 重试: vi.fn(), ...覆盖,
});

/** 一枚三级职位展示值：键 = 目录 ID（Mock = 本地名称） */
function 叶(键: string, 名称: string, 覆盖: Partial<Omit<期望职位项, '键' | '名称'>> = {}): 期望职位项 {
  return { 键, 名称, 选中: false, 禁用: false, ...覆盖 };
}

/** 一个二级分组展示值：标题 + 本组三级职位 + 本组自己的尾态 */
function 组(键: string, 标题: string, 项们: 期望职位项[] = [], 尾态: Partial<目录尾态> = {}): 期望职位组 {
  return { 键, 标题, 项们, 尾态: 空尾态(尾态) };
}

function 基础Props(覆盖: Partial<岗位职业分类正文Props> = {}): 岗位职业分类正文Props {
  return {
    根项们: [
      { 键: 'cat_a', 名称: '大类A', 选中: false },
      { 键: 'cat_b', 名称: '大类B', 选中: true },
    ],
    切换根: vi.fn(),
    根尾态: 空尾态(),
    组们: [组('grp_1', '分组一', [叶('leaf_1', '岗位1'), 叶('leaf_2', '岗位2', { 选中: true })])],
    右尾态: 空尾态(),
    选定: vi.fn(),
    关闭: vi.fn(),
    ...覆盖,
  };
}

describe('岗位职业分类正文 展示契约', () => {
  it('全屏外壳里三层结构上屏：左一级、右二级 heading 与三级叶子（选中带勾）', () => {
    render(<岗位职业分类正文 {...基础Props()} />);

    expect(screen.getByRole('dialog', { name: '职位类别' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '大类A' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '大类B' })).toBeTruthy();
    // 二级分组是语义 heading（h3），不是按钮
    const 分组标 = screen.getByRole('heading', { level: 3, name: '分组一' });
    expect(分组标.tagName).toBe('H3');
    expect(screen.queryByRole('button', { name: '分组一' })).toBeNull();
    // 勾沿用原 小类勾 结构：选中项按钮内含 ✓ 文本，未选项没有
    expect(screen.getByText('岗位2').textContent).toContain('✓');
    expect(screen.getByText('岗位1').textContent).not.toContain('✓');
  });

  it('左栏一级是导航按钮：点击交给 切换根，不触发 选定', async () => {
    const 切换根 = vi.fn();
    const 选定 = vi.fn();
    render(<岗位职业分类正文 {...基础Props({ 切换根, 选定 })} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '大类A' }));
    expect(切换根).toHaveBeenCalledWith('cat_a');
    expect(选定).not.toHaveBeenCalled();
  });

  it('三级叶子单击交给 选定一次；点二级标题不触发任何回调', async () => {
    const 选定 = vi.fn();
    const 切换根 = vi.fn();
    const 用户 = userEvent.setup();
    render(<岗位职业分类正文 {...基础Props({ 选定, 切换根 })} />);
    await 用户.click(screen.getByRole('heading', { level: 3, name: '分组一' }));
    expect(选定).not.toHaveBeenCalled();
    expect(切换根).not.toHaveBeenCalled();

    await 用户.click(screen.getByRole('button', { name: '岗位1' }));
    expect(选定).toHaveBeenCalledTimes(1);
    expect(选定).toHaveBeenCalledWith('leaf_1');
  });

  it('禁用叶子保留展示但标 aria-disabled，点击不提交', async () => {
    const 选定 = vi.fn();
    render(
      <岗位职业分类正文
        {...基础Props({ 选定, 组们: [组('grp_1', '分组一', [叶('leaf_1', '父节点岗位', { 禁用: true })])] })}
      />,
    );
    const 键 = screen.getByRole('button', { name: '父节点岗位' });
    expect(键.getAttribute('aria-disabled')).toBe('true');
    await userEvent.setup().click(键);
    expect(选定).not.toHaveBeenCalled();
  });

  it('空组显示「该分组暂无职位」，失败组显示错误与重试 —— 空与失败可区分', async () => {
    const 重试 = vi.fn();
    render(
      <岗位职业分类正文
        {...基础Props({
          组们: [组('grp_1', '空分组'), 组('grp_2', '失败分组', [], { 错误: '加载失败', 重试 })],
        })}
      />,
    );
    // 只有空组显示空态文案，失败组显示错误而不是伪装成空
    expect(screen.getAllByText('该分组暂无职位')).toHaveLength(1);
    expect(screen.getByText('加载失败')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: '重试' }));
    expect(重试).toHaveBeenCalledTimes(1);
  });

  it('同名分组标题与同名叶子并存互不混淆，勾只落在选中键上', async () => {
    const 选定 = vi.fn();
    render(
      <岗位职业分类正文
        {...基础Props({
          选定,
          组们: [
            组('grp_1', '后端开发', [
              叶('leaf_1', '后端开发'),
              叶('leaf_2', '后端开发', { 选中: true }),
            ]),
          ],
        })}
      />,
    );
    // 标题是 heading（不在按钮里），同名叶子仍是两枚可点按钮 —— 标题与叶子互不混淆
    const 标题 = screen.getByRole('heading', { level: 3, name: '后端开发' });
    expect(标题.closest('button')).toBeNull();
    const 同名叶们 = screen.getAllByText('后端开发').filter((节点) => 节点.tagName === 'BUTTON');
    expect(同名叶们).toHaveLength(2);
    expect(同名叶们[0]!.textContent).not.toContain('✓');
    expect(同名叶们[1]!.textContent).toContain('✓');
    await userEvent.setup().click(同名叶们[0]!);
    expect(选定).toHaveBeenCalledWith('leaf_1');
  });

  it('根尾态与右尾态各自驱动本栏：错误重试、加载中、加载更多忙时禁用', async () => {
    const 根尾态 = 空尾态({ 错误: '大类加载失败', 重试: vi.fn() });
    const 右尾态 = 空尾态({ 还有: true, 加载更多: vi.fn() });
    const 用户 = userEvent.setup();
    const 视图 = render(
      <岗位职业分类正文 {...基础Props({ 根尾态, 右尾态, 组们: [] })} />,
    );
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(根尾态.重试).toHaveBeenCalledTimes(1);
    await 用户.click(screen.getByRole('button', { name: '加载更多' }));
    expect(右尾态.加载更多).toHaveBeenCalledTimes(1);

    视图.rerender(
      <岗位职业分类正文
        {...基础Props({ 根尾态: 空尾态(), 右尾态: 空尾态({ 还有: true, 加载中: true }) })}
      />,
    );
    const 忙键 = screen.getByRole('button', { name: '加载中…' }) as HTMLButtonElement;
    expect(忙键.disabled).toBe(true);
  });

  it('各分组尾态各自独立：一组错误重试、一组加载更多，互不串', async () => {
    const 组甲重试 = vi.fn();
    const 组乙加载更多 = vi.fn();
    const 组甲加载更多 = vi.fn();
    render(
      <岗位职业分类正文
        {...基础Props({
          组们: [
            组('grp_1', '组甲', [叶('leaf_1', '岗位1')], { 错误: '组甲失败', 重试: 组甲重试, 加载更多: 组甲加载更多 }),
            组('grp_2', '组乙', [], { 还有: true, 加载更多: 组乙加载更多 }),
          ],
        })}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: '重试' }));
    expect(组甲重试).toHaveBeenCalledTimes(1);
    await userEvent.setup().click(screen.getByRole('button', { name: '加载更多' }));
    expect(组乙加载更多).toHaveBeenCalledTimes(1);
    expect(组甲加载更多).not.toHaveBeenCalled();
    // 失败组不清成功组的叶子
    expect(screen.getByText('岗位1')).toBeTruthy();
  });

  it('正文在全屏外壳里上屏：Escape 与返回键都交给 关闭', async () => {
    const 关闭 = vi.fn();
    const 用户 = userEvent.setup();
    const 视图 = render(<岗位职业分类正文 {...基础Props({ 关闭 })} />);
    const 对话框 = screen.getByRole('dialog', { name: '职位类别' });
    expect(对话框.getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(关闭).toHaveBeenCalledTimes(1);
    视图.unmount();
    render(<岗位职业分类正文 {...基础Props({ 关闭 })} />);
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(关闭).toHaveBeenCalledTimes(2);
  });
});
