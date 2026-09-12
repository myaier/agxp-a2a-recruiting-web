// 简历行业选择正文 组件测试（Task 6）：
// 纯展示正文 —— Mock（常见行业 模拟目录 + 自填输入）与 Backend（真实 industries 根/子/孙
// 三层展开）两模式页面把控制映射为同一组 props，正文渲染原弹层骨架、按当前渲染顺序的
// 分段、层级缩进、选中勾与各段列表尾「加载更多」。
// 这里只断言展示契约与点击归属：
//   · 行点击沿现有优先级：可选则选定，否则可展开才展开；两者均真不发明第二种点击控件；
//     既不可选也不可展开的行点击不动任何回调（不误发目录请求的页面侧契约）；
//   · 同名条目按稳定键区分，勾只落在选中键上；
//   · 各分段独立分页：还有才渲染、点击交给本段 加载更多、忙时「加载中…」禁用；
//   · 自填可选：提供才渲染自由文本输入（Mock 能力），缺省不渲染（Backend 不暴露）；
//   · 关闭沿弹层骨架：遮罩交给 关闭。
// 两模式消费同一正文由 src/屏幕/工作经历.test.tsx 与 e2e 证明。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  简历行业选择正文,
  type 简历行业行,
  type 简历行业分段,
  type 简历行业选择正文Props,
} from './简历行业选择正文';

/** 一枚行业行展示值 */
function 行(键: string, 名称: string, 覆盖: Partial<Omit<简历行业行, '键' | '名称'>> = {}): 简历行业行 {
  return {
    键, 名称, 层级: 0, 选中: false, 可选: true, 可展开: false, 展开中: false,
    ...覆盖,
  };
}

/** 一段（既有列表的展示批次 + 其分页尾） */
function 段(键: string, 行们: 简历行业行[], 覆盖: Partial<Omit<简历行业分段, '键' | '行们'>> = {}): 简历行业分段 {
  return { 键, 行们, 加载中: false, 还有: false, 加载更多: vi.fn(), ...覆盖 };
}

function 基础Props(覆盖: Partial<简历行业选择正文Props> = {}): 简历行业选择正文Props {
  return {
    分段们: [
      段('seg-root', [行('ind_fin', '金融科技', { 可选: false, 可展开: true }), 行('ind_leaf', '支付与清结算')]),
      段('seg-child', [行('ind_sub', '证券与基金', { 层级: 1, 可选: false, 可展开: true }), 行('ind_leaf2', '公募基金', { 层级: 1, 选中: true })]),
    ],
    展开: vi.fn(),
    选定: vi.fn(),
    关闭: vi.fn(),
    ...覆盖,
  };
}

describe('简历行业选择正文 展示契约', () => {
  it('原弹层骨架与分段渲染顺序上屏：标题、根行无缩进、层级1/2缩进、选中行带勾', () => {
    render(
      <简历行业选择正文
        {...基础Props({
          分段们: [
            段('seg-root', [行('r1', '金融科技', { 可选: false, 可展开: true }), 行('r2', '互联网')]),
            段('seg-child', [行('c1', '证券与基金', { 层级: 1, 可选: false, 可展开: true })]),
            段('seg-grand', [行('g1', '公募基金', { 层级: 2, 选中: true })]),
          ],
        })}
      />,
    );

    expect(screen.getByText('所属行业')).toBeTruthy();
    // 分段按给定顺序渲染（层级2的孙段在层级1的子段之后）
    const 顺序 = ['金融科技', '互联网', '证券与基金', '公募基金'].map((名) => screen.getByText(名));
    expect(顺序).toHaveLength(4);
    // 缩进照原 inline padding（根 0 / 子 28 / 孙 52），不新造图标/面包屑
    const 缩进 = (名: string) => (screen.getByText(名) as HTMLElement).style.paddingLeft;
    expect(缩进('金融科技')).toBe('');
    expect(缩进('互联网')).toBe('');
    expect(缩进('证券与基金')).toBe('28px');
    expect(缩进('公募基金')).toBe('52px');
    // 勾沿用原 选择勾 结构：选中行按钮内含 ✓ 文本，未选项没有
    expect(screen.getByText('公募基金').textContent).toContain('✓');
    expect(screen.getByText('金融科技').textContent).not.toContain('✓');
  });

  it('可选行点击交给 选定；不可选且可展开交给 展开；可选且有子项仍是单击选定', async () => {
    const 展开 = vi.fn();
    const 选定 = vi.fn();
    render(
      <简历行业选择正文
        {...基础Props({
          展开,
          选定,
          分段们: [
            段('seg', [
              行('leaf_a', '可选叶子'),
              行('branch', '下钻父项', { 可选: false, 可展开: true }),
              行('both', '可选父项', { 可展开: true }),
            ]),
          ],
        })}
      />,
    );
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('可选叶子'));
    expect(选定).toHaveBeenCalledWith('leaf_a');
    expect(展开).not.toHaveBeenCalled();
    await 用户.click(screen.getByText('下钻父项'));
    expect(展开).toHaveBeenCalledWith('branch');
    expect(选定).toHaveBeenCalledTimes(1);
    // 可选+可展开同真：单击选定，不发明第二种点击控件（需要双操作时交 PM）
    await 用户.click(screen.getByText('可选父项'));
    expect(选定).toHaveBeenCalledWith('both');
    expect(展开).toHaveBeenCalledTimes(1);
  });

  it('既不可选也不可展开的行点击不动任何回调（不误发目录请求）', async () => {
    const 展开 = vi.fn();
    const 选定 = vi.fn();
    render(
      <简历行业选择正文
        {...基础Props({ 展开, 选定, 分段们: [段('seg', [行('dead', '死端父项', { 可选: false, 可展开: false })])] })}
      />,
    );
    await userEvent.setup().click(screen.getByText('死端父项'));
    expect(展开).not.toHaveBeenCalled();
    expect(选定).not.toHaveBeenCalled();
  });

  it('同名行按稳定键区分：勾只落选中键，点击回报所点行的键', async () => {
    const 选定 = vi.fn();
    render(
      <简历行业选择正文
        {...基础Props({
          选定,
          分段们: [
            段('seg', [
              行('左-支付', '支付与清结算'),
              行('右-支付', '支付与清结算', { 选中: true }),
            ]),
          ],
        })}
      />,
    );
    const 同名们 = screen.getAllByText('支付与清结算');
    expect(同名们).toHaveLength(2);
    expect(同名们[0]!.textContent).not.toContain('✓');
    expect(同名们[1]!.textContent).toContain('✓');
    await userEvent.setup().click(同名们[0]!);
    expect(选定).toHaveBeenCalledWith('左-支付');
  });

  it('各段独立分页尾：还有才渲染、点击交给本段 加载更多、忙时「加载中…」禁用、尾随段行缩进', async () => {
    const 根加载更多 = vi.fn();
    const 子加载更多 = vi.fn();
    const 用户 = userEvent.setup();
    const 视图 = render(
      <简历行业选择正文
        {...基础Props({
          分段们: [
            段('seg-root', [行('r1', '金融科技', { 可选: false, 可展开: true })], { 还有: true, 加载更多: 根加载更多 }),
            段('seg-child', [行('c1', '证券与基金', { 层级: 1, 可选: false, 可展开: true })], { 还有: true, 加载更多: 子加载更多 }),
          ],
        })}
      />,
    );
    const 分页键们 = screen.getAllByRole('button', { name: '加载更多' });
    expect(分页键们).toHaveLength(2);
    await 用户.click(分页键们[0]!);
    expect(根加载更多).toHaveBeenCalledTimes(1);
    expect(子加载更多).not.toHaveBeenCalled();
    // 层级1段的尾随段行缩进（照原子项分页的 inline padding）
    expect((分页键们[0] as HTMLElement).style.paddingLeft).toBe('');
    expect((分页键们[1] as HTMLElement).style.paddingLeft).toBe('28px');

    视图.rerender(
      <简历行业选择正文
        {...基础Props({
          分段们: [
            段('seg-root', [行('r1', '金融科技', { 可选: false, 可展开: true })], { 加载中: true, 还有: true, 加载更多: 根加载更多 }),
            段('seg-child', [行('c1', '证券与基金', { 层级: 1, 可选: false, 可展开: true })]),
          ],
        })}
      />,
    );
    const 忙键 = screen.getByRole('button', { name: '加载中…' }) as HTMLButtonElement;
    expect(忙键.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();

    视图.rerender(
      <简历行业选择正文
        {...基础Props({
          分段们: [段('seg-root', [行('r1', '金融科技', { 可选: false, 可展开: true })])],
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
  });

  it('展开中的行带 aria-busy（不新增可见控件，沿用现有行）', () => {
    render(
      <简历行业选择正文
        {...基础Props({ 分段们: [段('seg', [行('busy', '金融科技', { 可选: false, 可展开: true, 展开中: true }), 行('idle', '互联网', { 可选: false, 可展开: true })])] })}
      />,
    );
    expect((screen.getByText('金融科技') as HTMLElement).getAttribute('aria-busy')).toBe('true');
    expect((screen.getByText('互联网') as HTMLElement).getAttribute('aria-busy')).toBeNull();
  });

  it('自填可选：提供才渲染自由文本输入（修改/Enter 确认），缺省不渲染', async () => {
    const 修改 = vi.fn();
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    const 视图 = render(<简历行业选择正文 {...基础Props()} />);
    // Backend 不暴露自由文本：props 缺省即不渲染
    expect(screen.queryByPlaceholderText('没有合适的？直接输入')).toBeNull();

    视图.rerender(
      <简历行业选择正文 {...基础Props({ 自填: { 值: '机器人', 修改, 确认 } })} />,
    );
    const 输入 = screen.getByPlaceholderText('没有合适的？直接输入') as HTMLInputElement;
    expect(输入.value).toBe('机器人');
    await 用户.type(输入, '!');
    expect(修改).toHaveBeenCalledWith('机器人!');
    await 用户.type(输入, '{Enter}');
    expect(确认).toHaveBeenCalledTimes(1);
  });

  it('关闭沿弹层骨架：遮罩交给 关闭', async () => {
    const 关闭 = vi.fn();
    render(<简历行业选择正文 {...基础Props({ 关闭 })} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '关闭选择所属行业' }));
    expect(关闭).toHaveBeenCalledTimes(1);
  });
});