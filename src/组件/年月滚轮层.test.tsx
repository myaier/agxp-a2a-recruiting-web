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
    await 用户.click(screen.getByRole('button', { name: '确定' }));
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

// 年份档与文案（picker 统一 Task 3）：出生年月 / 预计毕业时间 复用本组件时
// 传入离散年表（调用方去重升序），连续范围调用方（简历起止）合同不变；
// 顶栏确认键统一「确定」（与 数字滚轮层 同文案）。
describe('年月滚轮层 年份档（picker 统一 Task 3）', () => {
  /** 既有历史年 + 未来 8 年：添加意向毕业抽屉的真实年表形状 */
  const 历史年加未来8年 = [2019, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

  it('非连续年表原样呈现并原样确认，中间年不出档', async () => {
    const 用户 = userEvent.setup();
    const 确认 = vi.fn();
    render(
      <年月滚轮层 标题="预计毕业时间" 初值="2019-06" 年份选项={历史年加未来8年}
        最小="2019-01" 最大="2033-12" 确认={确认} 取消={vi.fn()} />,
    );
    const 年列 = screen.getByRole('listbox', { name: '年份' });
    expect(within(年列).getByRole('option', { name: '2019' })).toBeTruthy();
    expect(within(年列).getByRole('option', { name: '2033' })).toBeTruthy();
    // 表里的空洞（2020-2025）不许被连续范围补出来
    for (const 中间年 of ['2020', '2022', '2025']) {
      expect(within(年列).queryByRole('option', { name: 中间年 })).toBeNull();
    }
    expect(within(年列).getByRole('option', { name: '2019' }).getAttribute('aria-selected')).toBe('true');
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith('2019-06');
  });

  it('初值年不在年表时落最近允许年，同距取小年，不产生无选中项', async () => {
    const 用户 = userEvent.setup();
    const 确认 = vi.fn();
    render(
      <年月滚轮层 标题="预计毕业时间" 初值="2027-03" 年份选项={[2026, 2028]}
        确认={确认} 取消={vi.fn()} />,
    );
    const 年列 = screen.getByRole('listbox', { name: '年份' });
    expect(within(年列).getByRole('option', { name: '2026' }).getAttribute('aria-selected')).toBe('true');
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith('2026-03');
  });

  it('提供年份档时最小/最大仍界定月份边界：年份切换后月表收缩并夹回', async () => {
    const 用户 = userEvent.setup();
    render(
      <年月滚轮层 标题="预计毕业时间" 初值="2027-03" 年份选项={[2026, 2027, 2028]}
        最小="2026-05" 最大="2028-09" 确认={vi.fn()} 取消={vi.fn()} />,
    );
    const 年列 = screen.getByRole('listbox', { name: '年份' });
    await 用户.click(within(年列).getByRole('option', { name: '2026' }));
    const 月列 = screen.getByRole('listbox', { name: '月份' });
    // 下界年 2026 从 5 月起：3 月出档，选中值被夹回 5
    expect(within(月列).queryByRole('option', { name: '1' })).toBeNull();
    await waitFor(() => expect(
      within(月列).getByRole('option', { name: '5' }).getAttribute('aria-selected'),
    ).toBe('true'));
    await 用户.click(within(年列).getByRole('option', { name: '2028' }));
    // 上界年 2028 到 9 月止
    expect(within(月列).queryByRole('option', { name: '10' })).toBeNull();
    expect(within(月列).getByRole('option', { name: '9' })).toBeTruthy();
  });

  it('年/月列可访问名可由调用方覆盖（出生年/出生月）', () => {
    render(
      <年月滚轮层 标题="出生年月" 初值="1998-06" 年名称="出生年" 月名称="出生月"
        确认={vi.fn()} 取消={vi.fn()} />,
    );
    expect(screen.getByRole('listbox', { name: '出生年' })).toBeTruthy();
    expect(screen.getByRole('listbox', { name: '出生月' })).toBeTruthy();
    expect(screen.queryByRole('listbox', { name: '年份' })).toBeNull();
  });
});
