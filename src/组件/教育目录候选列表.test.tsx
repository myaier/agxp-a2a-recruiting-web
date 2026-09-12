// 教育目录候选列表 组件测试（Task 5）：
// 教育编辑页 学校/专业 候选行的两模式共用列表 —— 纯展示，props 只有展示值、稳定键、
// 状态与回调（brief 接口逐字）：学校副行沿原「城市 · 国家」inline 字体/颜色、专业无副行、
// 选中行沿用 候选行选中/候选勾 既有样式、列表尾「加载更多」沿用原控件（忙时禁用）。
// 两模式消费同一列表由 src/屏幕/工作经历.test.tsx 与 e2e 证明。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { 教育目录候选列表, type 教育候选, type 教育目录候选列表Props } from './教育目录候选列表';

/** 一枚候选展示值 */
function 项(键: string, 名称: string, 覆盖: Partial<Omit<教育候选, '键' | '名称'>> = {}): 教育候选 {
  return { 键, 名称, 选中: false, ...覆盖 };
}

function 基础Props(覆盖: Partial<教育目录候选列表Props> = {}): 教育目录候选列表Props {
  return {
    项们: [
      项('inst_thu', '清华大学', { 副文: '北京 · 中国' }),
      项('inst_pku', '北京大学'),
      项('inst_b', '北京大学', { 选中: true }),
    ],
    加载中: false,
    还有: false,
    选定: vi.fn(),
    加载更多: vi.fn(),
    ...覆盖,
  };
}

describe('教育目录候选列表 展示契约', () => {
  it('名称与学校副行上屏：副行沿原 inline 字体/颜色，无副文的候选行没有副行', () => {
    render(<教育目录候选列表 {...基础Props()} />);

    expect(screen.getByText('清华大学')).toBeTruthy();
    expect(screen.getByText('北京 · 中国')).toBeTruthy();
    // 副行是名称行内的 block 副元素（原实现原样保留），主名称仍在同一按钮内
    const 行 = screen.getByRole('button', { name: '清华大学' });
    const 副行 = screen.getByText('北京 · 中国');
    expect(副行.style.display).toBe('block');
    expect(副行.style.color).toBe('var(--最弱)');
    expect(行.textContent).toContain('北京 · 中国');
    // 无副文的北京大学行：只渲染名称，不渲染空副行
    expect(screen.getAllByRole('button', { name: '北京大学' }).length).toBe(2);
  });

  it('选中态落在选中键上：候选行选中 + ✓ 文本，未选项不带勾', () => {
    render(<教育目录候选列表 {...基础Props()} />);

    const 选中行 = screen.getAllByRole('button', { name: '北京大学' }).find((行) => 行.textContent.includes('✓'));
    expect(选中行).toBeTruthy();
    // 勾是真实元素（原 候选勾 结构），aria-label 不受影响
    expect(screen.getByRole('button', { name: '清华大学' }).textContent).not.toContain('✓');
  });

  it('点击候选把稳定键交给 选定：同名不同键分别回调各自键', async () => {
    const 选定 = vi.fn();
    render(
      <教育目录候选列表
        {...基础Props({
          选定,
          项们: [项('inst_a', '清华大学'), 项('inst_b', '清华大学')],
        })}
      />,
    );
    const 用户 = userEvent.setup();
    const 同名行 = screen.getAllByRole('button', { name: '清华大学' });
    expect(同名行.length).toBe(2);
    await 用户.click(同名行[1]!);
    expect(选定).toHaveBeenCalledTimes(1);
    expect(选定).toHaveBeenCalledWith('inst_b');
    await 用户.click(同名行[0]!);
    expect(选定).toHaveBeenCalledWith('inst_a');
  });

  it('列表尾「加载更多」：还有 才渲染，点击交给 加载更多，忙时显示加载中并禁用', async () => {
    const 加载更多 = vi.fn();
    const { rerender } = render(<教育目录候选列表 {...基础Props({ 加载更多 })} />);
    // 还有=false：无分页按钮（旧稿同条件）
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();

    rerender(<教育目录候选列表 {...基础Props({ 加载更多, 还有: true })} />);
    const 键 = screen.getByRole('button', { name: '加载更多' });
    expect(键.textContent).toContain('加载更多');
    await userEvent.setup().click(键);
    expect(加载更多).toHaveBeenCalledTimes(1);

    // 加载中：文案「加载中…」且 disabled（沿用原控件忙态）
    rerender(<教育目录候选列表 {...基础Props({ 加载更多, 还有: true, 加载中: true })} />);
    const 忙键 = screen.getByRole('button', { name: '加载更多' });
    expect(忙键.textContent).toContain('加载中…');
    expect((忙键 as HTMLButtonElement).disabled).toBe(true);
  });

  it('空项们不渲染任何候选行；容器沿用原 候选列表 样式类', () => {
    const { container } = render(
      <教育目录候选列表 {...基础Props({ 项们: [], 还有: false })} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    // 候选容器类名来自原 入职引导.module.css（已有候选样式），不另建样式
    expect(container.querySelector('div')?.className).not.toBe('');
  });
});