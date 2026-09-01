// 数字滚轮层的可访问合同（Task 3）：单列数字滚轮接 use可访问滚轮 后，
// 键盘 / 点档直选 / 提交值 三者必须落在同一个数上。
// 仓库未装 @testing-library/jest-dom，断言一律用原生 getAttribute。

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 数字滚轮层 from './数字滚轮层';

describe('数字滚轮层 可访问合同', () => {
  it('数字滚轮支持键盘和直接点选并提交同一值', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(
      <数字滚轮层 标题="年薪月数" 初值={12} 最小={12} 最大={16} 单位="薪"
        确认={确认} 取消={vi.fn()} />,
    );
    const 列 = screen.getByRole('listbox', { name: '年薪月数' });
    列.focus();
    await 用户.keyboard('{ArrowDown}');
    expect(within(列).getByRole('option', { name: '13' }).getAttribute('aria-selected')).toBe('true');
    await 用户.click(within(列).getByRole('option', { name: '16' }));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    expect(确认).toHaveBeenCalledWith(16);
  });
});
