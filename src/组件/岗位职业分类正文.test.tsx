// 岗位职业分类正文 组件测试（Task 4）：
// 纯展示正文 —— Mock（本地职业分类表）与 Backend（catalog job-categories）两模式页面
// 把控制映射为同一组 props，正文渲染原弹层标题、两栏、选中勾与列表尾「加载更多」。
// 这里只断言展示契约与点击归属：
//   · 左栏沿现有行为恒为导航 —— 点击交给 展开，不因可选直选；
//   · 右栏可选单击选定（可选+有子项同真也是单击选定，不设第二点击区）；
//   · 右栏不可选仅在有子项时展开下钻；无子项的不可选项不提交也不展开；
//   · 同名条目按稳定键区分；两栏各自的列表尾分页按钮忙时禁用。
// 两模式消费同一正文由 src/屏幕/发布岗位.test.tsx 与 e2e 证明。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { 岗位职业分类正文, type 职业栏, type 职业栏项, type 岗位职业分类正文Props } from './岗位职业分类正文';

/** 一枚栏项展示值 */
function 项(键: string, 名称: string, 覆盖: Partial<Omit<职业栏项, '键' | '名称'>> = {}): 职业栏项 {
  return { 键, 名称, 选中: false, 可选: false, 有子项: true, ...覆盖 };
}

/** 空栏：无分页 */
function 栏(项们: 职业栏项[], 覆盖: Partial<Omit<职业栏, '项们'>> = {}): 职业栏 {
  return { 项们, 加载中: false, 还有: false, 加载更多: vi.fn(), ...覆盖 };
}

function 基础Props(覆盖: Partial<岗位职业分类正文Props> = {}): 岗位职业分类正文Props {
  return {
    根栏: 栏([项('cat_a', '大类A'), 项('cat_b', '大类B', { 选中: true })]),
    子栏: 栏([项('leaf_1', '岗位1', { 可选: true }), 项('leaf_2', '岗位2', { 可选: true, 选中: true })]),
    展开: vi.fn(),
    选定: vi.fn(),
    关闭: vi.fn(),
    ...覆盖,
  };
}

describe('岗位职业分类正文 展示契约', () => {
  it('原弹层标题与两栏上屏：左栏选中高亮、右栏选中带勾', () => {
    render(<岗位职业分类正文 {...基础Props()} />);

    expect(screen.getByText('职位类别')).toBeTruthy();
    expect(screen.getByText('大类A')).toBeTruthy();
    expect(screen.getByText('大类B')).toBeTruthy();
    expect(screen.getByText('岗位1')).toBeTruthy();
    // 勾沿用原 小类勾 结构：选中项按钮内含 ✓ 文本，未选项没有
    expect(screen.getByText('岗位2').textContent).toContain('✓');
    expect(screen.getByText('岗位1').textContent).not.toContain('✓');
  });

  it('左栏点击恒交给 展开（现有导航行为），可选根也不直选', async () => {
    const 展开 = vi.fn();
    const 选定 = vi.fn();
    render(
      <岗位职业分类正文
        {...基础Props({
          展开,
          选定,
          根栏: 栏([项('cat_root', '可选招聘大类', { 可选: true })]),
        })}
      />,
    );
    await userEvent.setup().click(screen.getByText('可选招聘大类'));
    expect(展开).toHaveBeenCalledWith('cat_root');
    expect(选定).not.toHaveBeenCalled();
  });

  it('右栏可选单击选定；可选且有子项仍是单击选定，不发明第二点击区', async () => {
    const 展开 = vi.fn();
    const 选定 = vi.fn();
    render(
      <岗位职业分类正文
        {...基础Props({
          展开,
          选定,
          子栏: 栏([
            项('leaf_a', '可选叶子', { 可选: true }),
            项('leaf_b', '可选但带子项', { 可选: true, 有子项: true }),
          ]),
        })}
      />,
    );
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('可选叶子'));
    expect(选定).toHaveBeenCalledWith('leaf_a');
    expect(展开).not.toHaveBeenCalled();
    await 用户.click(screen.getByText('可选但带子项'));
    expect(选定).toHaveBeenCalledWith('leaf_b');
    expect(展开).not.toHaveBeenCalled();
  });

  it('右栏不可选且有子项交给 展开 下钻，不提交', async () => {
    const 展开 = vi.fn();
    const 选定 = vi.fn();
    render(
      <岗位职业分类正文
        {...基础Props({ 展开, 选定, 子栏: 栏([项('branch', '下钻父项')]) })}
      />,
    );
    await userEvent.setup().click(screen.getByText('下钻父项'));
    expect(展开).toHaveBeenCalledWith('branch');
    expect(选定).not.toHaveBeenCalled();
  });

  it('右栏无子项的不可选项不提交也不展开（不误发目录请求的页面侧契约）', async () => {
    const 展开 = vi.fn();
    const 选定 = vi.fn();
    render(
      <岗位职业分类正文
        {...基础Props({ 展开, 选定, 子栏: 栏([项('dead', '死端父项', { 有子项: false })]) })}
      />,
    );
    await userEvent.setup().click(screen.getByText('死端父项'));
    expect(展开).not.toHaveBeenCalled();
    expect(选定).not.toHaveBeenCalled();
  });

  it('同名条目按稳定键区分，勾只落在选中键上', async () => {
    const 选定 = vi.fn();
    render(
      <岗位职业分类正文
        {...基础Props({
          选定,
          子栏: 栏([
            项('左-后端', '后端开发', { 可选: true }),
            项('右-后端', '后端开发', { 可选: true, 选中: true }),
          ]),
        })}
      />,
    );
    const 同名们 = screen.getAllByText('后端开发');
    expect(同名们).toHaveLength(2);
    expect(同名们[0]!.textContent).not.toContain('✓');
    expect(同名们[1]!.textContent).toContain('✓');
    await userEvent.setup().click(同名们[0]!);
    expect(选定).toHaveBeenCalledWith('左-后端');
  });

  it('两栏各自的列表尾「加载更多」：还有才渲染、点击交给本栏 加载更多、忙时禁用', async () => {
    const 根加载更多 = vi.fn();
    const 子栏加载更多 = vi.fn();
    const 用户 = userEvent.setup();
    const 视图 = render(
      <岗位职业分类正文
        {...基础Props({
          根栏: 栏([项('cat_a', '大类A')], { 还有: true, 加载更多: 根加载更多 }),
          子栏: 栏([项('leaf_1', '岗位1', { 可选: true })], { 还有: true, 加载更多: 子栏加载更多 }),
        })}
      />,
    );
    const 分页键们 = screen.getAllByRole('button', { name: '加载更多' });
    expect(分页键们).toHaveLength(2);
    await 用户.click(分页键们[0]!);
    expect(根加载更多).toHaveBeenCalledTimes(1);
    expect(子栏加载更多).not.toHaveBeenCalled();

    视图.rerender(
      <岗位职业分类正文
        {...基础Props({
          根栏: 栏([项('cat_a', '大类A')], { 还有: true, 加载中: true, 加载更多: 根加载更多 }),
          子栏: 栏([项('leaf_1', '岗位1', { 可选: true })]),
        })}
      />,
    );
    const 忙键 = screen.getByRole('button', { name: '加载中…' }) as HTMLButtonElement;
    expect(忙键.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();

    视图.rerender(
      <岗位职业分类正文
        {...基础Props({
          根栏: 栏([项('cat_a', '大类A')]),
          子栏: 栏([项('leaf_1', '岗位1', { 可选: true })]),
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
  });

  it('关闭沿弹层骨架：遮罩交给 关闭', async () => {
    const 关闭 = vi.fn();
    render(<岗位职业分类正文 {...基础Props({ 关闭 })} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '关闭选择职位类别' }));
    expect(关闭).toHaveBeenCalledTimes(1);
  });
});
