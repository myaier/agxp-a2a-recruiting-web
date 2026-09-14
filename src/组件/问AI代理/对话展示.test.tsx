// 对话展示 的受控展示契约：换 props 直接换内容（不把初值复制成不可更新的 state），
// 快捷项点击只调用被点那一项的回调。纯内存组件，无需任何 Provider。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { 代理气泡, 我方气泡, 快捷操作行 } from './对话展示';

describe('代理气泡', () => {
  it('两种外观都渲染内容，且收到新 props 直接更新', () => {
    const 页 = render(<代理气泡 外观="求职" 内容="第一条回复" />);
    expect(screen.getByText('第一条回复')).toBeTruthy();
    // 直接换内容换外观：初值没有被复制成 state
    页.rerender(<代理气泡 外观="招聘" 内容="第二条回复" />);
    expect(screen.getByText('第二条回复')).toBeTruthy();
    expect(screen.queryByText('第一条回复')).toBeNull();
  });
});

describe('我方气泡', () => {
  it('有头像URL用图，改传 null 立即回落首字', () => {
    const 页 = render(
      <我方气泡 外观="招聘" 内容="在吗" 头像URL="https://example.com/a.png" 首字="邵" />,
    );
    // 头像图是 alt="" 的装饰图（无 img 角色），用 DOM 查询断言
    expect(页.container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.png');
    expect(screen.queryByText('邵')).toBeNull();
    页.rerender(<我方气泡 外观="招聘" 内容="在吗" 头像URL={null} 首字="邵" />);
    expect(screen.getByText('邵')).toBeTruthy();
    expect(页.container.querySelector('img')).toBeNull();
  });
});

describe('快捷操作行', () => {
  it('点击只调用被点那一项的回调', () => {
    const 去市场 = vi.fn();
    const 看在谈 = vi.fn();
    render(
      <快捷操作行
        外观="求职"
        项们={[
          { 键: '去市场', 文案: '去市场', 按下: 去市场 },
          { 键: '看在谈', 文案: '看在谈', 按下: 看在谈 },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '去市场' }));
    expect(去市场).toHaveBeenCalledTimes(1);
    expect(看在谈).not.toHaveBeenCalled();
  });
});
