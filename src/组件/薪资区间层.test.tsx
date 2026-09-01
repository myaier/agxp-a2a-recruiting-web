// 薪资区间层的确认合同（Task 2）。
// 弹层只管滚轮手感，落数规则冻结在这四件事上：直接点选两列后「确定」回传当前值；
// 「确定」这一刻才把低于下限的上限抬到下限（中途允许上限 < 下限的中间态）；
// 重新挂载从已保存值定位（不落回默认 10/11）；键盘移动高亮后「确定」回传的就是
// 那个高亮值 —— 即确认消费的 state 与 ARIA aria-selected 是同一份。
//
// 仓库未装 @testing-library/jest-dom，断言一律用原生 getAttribute。

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 薪资区间层 from './薪资区间层';

describe('薪资区间层 确认合同', () => {
  it('直接点选两列后确定回传当前值', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<薪资区间层 下限={20} 上限={30} 确认={确认} 取消={vi.fn()} />);
    const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
    const 上限列 = screen.getByRole('listbox', { name: '薪资上限' });
    await 用户.click(within(下限列).getByRole('option', { name: '21' }));
    await 用户.click(within(上限列).getByRole('option', { name: '31' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(21, 31);
  });

  it('确定时把低于下限的上限抬到下限', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<薪资区间层 下限={20} 上限={30} 确认={确认} 取消={vi.fn()} />);
    const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
    const 上限列 = screen.getByRole('listbox', { name: '薪资上限' });
    await 用户.click(within(下限列).getByRole('option', { name: '40' }));
    await 用户.click(within(上限列).getByRole('option', { name: '25' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(40, 40);
  });

  it('重新挂载从已保存值定位', () => {
    const { unmount } = render(
      <薪资区间层 下限={20} 上限={30} 确认={vi.fn()} 取消={vi.fn()} />,
    );
    unmount();
    render(<薪资区间层 下限={21} 上限={31} 确认={vi.fn()} 取消={vi.fn()} />);
    expect(within(screen.getByRole('listbox', { name: '薪资下限' }))
      .getByRole('option', { name: '21' }).getAttribute('aria-selected')).toBe('true');
    expect(within(screen.getByRole('listbox', { name: '薪资上限' }))
      .getByRole('option', { name: '31' }).getAttribute('aria-selected')).toBe('true');
  });

  it('键盘选择后的高亮值就是确定回传值', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<薪资区间层 下限={20} 上限={30} 确认={确认} 取消={vi.fn()} />);
    const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
    下限列.focus();
    await 用户.keyboard('{ArrowDown}');
    expect(within(下限列).getByRole('option', { name: '21' })
      .getAttribute('aria-selected')).toBe('true');
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(21, 30);
  });
});
