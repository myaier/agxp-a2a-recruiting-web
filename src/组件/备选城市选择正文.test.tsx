// 备选城市选择正文 组件测试（Task 3）：
// 纯展示正文 —— 两模式页面把控制映射为同一组 props，正文渲染标题/搜索/位置/热门/
// 行政区分组或搜索列表/底部已选与保存。这里只断言展示契约：
// 无右侧字母索引、行政标题、选中标签/9 项计数、空/加载现有文案、列表尾分页按钮忙时禁用。
// 两模式消费同一正文由 src/屏幕/选择城市.test.tsx 与 e2e 证明。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { 备选城市选择正文, type 城市按钮值, type 备选城市正文Props } from './备选城市选择正文';

/** 一枚城市按钮展示值 */
function 按钮(键: string, 名称: string, 选中 = false, 禁用 = false): 城市按钮值 {
  return { 键, 名称, 选中, 禁用 };
}

/** 基础 props：默认（无搜索词）态 */
function 基础Props(覆盖: Partial<备选城市正文Props> = {}): 备选城市正文Props {
  return {
    搜索词: '',
    改搜索词: vi.fn(),
    位置项们: [按钮('上海', '上海')],
    热门项们: [按钮('热门-北京', '北京'), 按钮('热门-杭州', '杭州')],
    分组们: [{ 键: '浙江', 标题: '浙江', 项们: [按钮('杭州', '杭州')] }],
    搜索项们: [],
    已选项们: [],
    加载中: false,
    还有: false,
    加载更多: vi.fn(),
    切换: vi.fn(),
    取消: vi.fn(),
    保存: vi.fn(),
    ...覆盖,
  };
}

describe('备选城市选择正文 展示契约', () => {
  it('无搜索词：位置/热门/行政分组上屏，右侧字母索引条不再渲染', async () => {
    render(<备选城市选择正文 {...基础Props()} />);

    // 位置区（沿用原标签）与热门区照旧
    expect(screen.getByText('当前/历史访问城市')).toBeTruthy();
    expect(screen.getByText('热门城市')).toBeTruthy();
    // 行政分组标题上屏
    expect(screen.getByText('浙江')).toBeTruthy();
    expect(screen.getByText('北京')).toBeTruthy();
    // 原右侧 A–Z 索引条整体消失：不存在「跳到 X」按钮，也无字母分节标题
    expect(screen.queryByRole('button', { name: '跳到 A' })).toBeNull();
    expect(screen.queryByRole('button', { name: '跳到 Z' })).toBeNull();
  });

  it('城市片点击把稳定键交给 切换（同名两枚不同键各自独立）', async () => {
    const 切换 = vi.fn();
    render(
      <备选城市选择正文
        {...基础Props({
          切换,
          热门项们: [按钮('热门-杭州', '杭州')],
          分组们: [{ 键: '浙江', 标题: '浙江', 项们: [按钮('浙江-杭州', '杭州')] }],
        })}
      />,
    );
    const 用户 = userEvent.setup();
    await 用户.click(screen.getAllByText('杭州')[0]);
    expect(切换).toHaveBeenCalledWith('热门-杭州');
    await 用户.click(screen.getAllByText('杭州')[1]);
    expect(切换).toHaveBeenCalledWith('浙江-杭州');
  });

  it('已选标签与 N/9 计数；点标签 ✕ 用同一稳定键移除', async () => {
    const 切换 = vi.fn();
    render(
      <备选城市选择正文
        {...基础Props({
          切换,
          已选项们: [按钮('热门-杭州', '杭州'), 按钮('loc-b', '苏州')],
        })}
      />,
    );
    expect(screen.getByText('2/9')).toBeTruthy();
    const chips = screen.getAllByRole('button', { name: '移除 杭州' });
    expect(chips).toHaveLength(1);
    await userEvent.setup().click(chips[0]!);
    expect(切换).toHaveBeenCalledWith('热门-杭州');
    expect(screen.getByRole('button', { name: '移除 苏州' })).toBeTruthy();
  });

  it('禁用片渲染 disabled；选满 9 个时计数 9/9', () => {
    render(
      <备选城市选择正文
        {...基础Props({
          热门项们: [按钮('热门-北京', '北京', false, true)],
          已选项们: ['一', '二', '三', '四', '五', '六', '七', '八', '九'].map((名称, i) =>
            按钮(`k${i}`, 名称, true),
          ),
        })}
      />,
    );
    expect(((screen.getByText('北京') as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByText('9/9')).toBeTruthy();
  });

  it('搜索态：只出搜索列表，位置/热门/分组收起；输入把词交给 改搜索词', async () => {
    const 改搜索词 = vi.fn();
    render(
      <备选城市选择正文
        {...基础Props({
          改搜索词,
          搜索词: '杭',
          搜索项们: [按钮('loc-hz', '杭州')],
        })}
      />,
    );
    expect(screen.getByText('杭州')).toBeTruthy();
    expect(screen.queryByText('当前/历史访问城市')).toBeNull();
    expect(screen.queryByText('热门城市')).toBeNull();
    expect(screen.queryByText('浙江')).toBeNull();

    const 输入 = screen.getByPlaceholderText('搜索城市名/拼音');
    await userEvent.setup().type(输入, '州');
    expect(改搜索词).toHaveBeenLastCalledWith('杭州');
  });

  it('空/加载显示现有文案：搜索空 → 没有匹配的城市；搜索加载与默认页首载 → 加载中…', () => {
    const { rerender } = render(
      <备选城市选择正文 {...基础Props({ 搜索词: '杭', 搜索项们: [], 加载中: false })} />,
    );
    expect(screen.getByText('没有匹配的城市，换个词试试。')).toBeTruthy();
    rerender(<备选城市选择正文 {...基础Props({ 搜索词: '杭', 搜索项们: [], 加载中: true })} />);
    expect(screen.getByText('加载中…')).toBeTruthy();
    // 默认页首载（热门/分组都还没到）也用同一现有文案
    rerender(
      <备选城市选择正文
        {...基础Props({ 热门项们: [], 分组们: [], 位置项们: [], 加载中: true })}
      />,
    );
    expect(screen.getByText('加载中…')).toBeTruthy();
  });

  it('列表尾「加载更多」：还有才渲染，点击交给 加载更多，忙时禁用', async () => {
    const 加载更多 = vi.fn();
    const { rerender } = render(
      <备选城市选择正文 {...基础Props({ 还有: true, 加载更多 })} />,
    );
    const 用户 = userEvent.setup();
    const 键 = screen.getByRole('button', { name: '加载更多' });
    await 用户.click(键);
    expect(加载更多).toHaveBeenCalledTimes(1);
    // 忙时禁用：还能看见（文案换成本有的「加载中…」），但点不动
    rerender(<备选城市选择正文 {...基础Props({ 还有: true, 加载中: true, 加载更多 })} />);
    const 忙键 = screen.getByRole('button', { name: '加载中…' }) as HTMLButtonElement;
    expect(忙键.disabled).toBe(true);
    // 没有下一页时不渲染
    rerender(<备选城市选择正文 {...基础Props({ 还有: false, 加载更多 })} />);
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
    // 搜索态同样把分页按钮挂在搜索列表尾
    rerender(
      <备选城市选择正文
        {...基础Props({ 搜索词: '杭', 搜索项们: [按钮('loc-hz', '杭州')], 还有: true, 加载更多 })}
      />,
    );
    expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy();
  });

  it('取消与保存只回调不派发：✕ 关闭键交给 取消，底部主按钮交给 保存', async () => {
    const 取消 = vi.fn();
    const 保存 = vi.fn();
    render(<备选城市选择正文 {...基础Props({ 取消, 保存 })} />);
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '关闭' }));
    expect(取消).toHaveBeenCalledTimes(1);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(保存).toHaveBeenCalledTimes(1);
  });
});