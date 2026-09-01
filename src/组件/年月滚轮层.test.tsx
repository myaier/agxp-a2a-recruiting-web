// 年月滚轮层的可访问合同（Task 3）：年 / 月两列各自接 use可访问滚轮。
// 第二条用例专门盯「月份列表随年份收缩」：夹紧是父组件的 effect 在做，
// Hook 只响应夹紧后的受控值 —— active descendant 必须跟着落到夹紧后的那一档。
// 仓库未装 @testing-library/jest-dom，断言一律用原生 getAttribute。

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 年月滚轮层 from './年月滚轮层';

describe('年月滚轮层 可访问合同', () => {
  it('年月两列分别可键盘选择并提交', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(
      <年月滚轮层 标题="入职时间" 初值="2025-06" 最小="2024-01" 最大="2026-12"
        确认={确认} 取消={vi.fn()} />,
    );
    const 年列 = screen.getByRole('listbox', { name: '年份' });
    const 月列 = screen.getByRole('listbox', { name: '月份' });
    年列.focus();
    await 用户.keyboard('{ArrowDown}');
    月列.focus();
    await 用户.keyboard('{Home}');
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    expect(确认).toHaveBeenCalledWith('2026-01');
  });

  it('年份改变导致月份范围收缩时 active descendant 跟随夹紧值', async () => {
    const 用户 = userEvent.setup();
    render(
      <年月滚轮层 标题="离职时间" 初值="2025-12" 最小="2025-01" 最大="2026-08"
        确认={vi.fn()} 取消={vi.fn()} />,
    );
    const 年列 = screen.getByRole('listbox', { name: '年份' });
    await 用户.click(within(年列).getByRole('option', { name: '2026' }));
    const 月列 = screen.getByRole('listbox', { name: '月份' });
    await waitFor(() => expect(
      within(月列).getByRole('option', { name: '8' }).getAttribute('aria-selected'),
    ).toBe('true'));
    expect(月列.getAttribute('aria-activedescendant'))
      .toBe(within(月列).getByRole('option', { name: '8' }).id);
  });
});
