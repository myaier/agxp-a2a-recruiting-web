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

it.each([['day', 300, 500], ['month', 250.5, 300], ['hour', 120, 180]] as const)('历史%s薪资打开直接确认无截断', async (周期, 下限, 上限) => {
  const 确认 = vi.fn();
  render(<薪资区间层 周期={周期} 下限={下限} 上限={上限} 确认={确认} 取消={vi.fn()} />);
  expect(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: String(下限) }).getAttribute('aria-selected')).toBe('true');
  await userEvent.click(screen.getByRole('button', { name: '确定' }));
  expect(确认).toHaveBeenCalledWith(下限, 上限);
});

it('求职 12.5/123.5 打开直接确定不取整', async () => {
  const 确认 = vi.fn();
  render(<薪资区间层 周期="month" 下限={12.5} 上限={123.5} 确认={确认} 取消={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '确定' }));
  expect(确认).toHaveBeenCalledWith(12.5, 123.5);
});

// ── 岗位用途（Task 3）：月薪双滚轮共用本层，落数规则与求职端分策略 ──
describe('薪资区间层 岗位用途', () => {
  it('常用档 0..100 步 1：空弹层默认 10/11 可见，0 和 100 都可选', () => {
    render(<薪资区间层 用途="岗位" 下限={null} 上限={null} 确认={vi.fn()} 取消={vi.fn()} />);
    const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
    expect(within(下限列).getByRole('option', { name: '10' }).getAttribute('aria-selected')).toBe('true');
    expect(within(screen.getByRole('listbox', { name: '薪资上限' }))
      .getByRole('option', { name: '11' }).getAttribute('aria-selected')).toBe('true');
    expect(within(下限列).getByRole('option', { name: '0' })).toBeTruthy();
    expect(within(下限列).getByRole('option', { name: '100' })).toBeTruthy();
  });

  it('空弹层可见默认 10/11，只有确定才回传', async () => {
    const 确认 = vi.fn();
    render(<薪资区间层 用途="岗位" 下限={null} 上限={null} 确认={确认} 取消={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(10, 11);
  });

  it('传入 123/234 原样加入档位并往返，档位为常用档加两个当前值', async () => {
    const 确认 = vi.fn();
    render(<薪资区间层 用途="岗位" 下限={123} 上限={234} 确认={确认} 取消={vi.fn()} />);
    const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
    expect(within(下限列).getByRole('option', { name: '123' }).getAttribute('aria-selected')).toBe('true');
    expect(within(screen.getByRole('listbox', { name: '薪资上限' }))
      .getByRole('option', { name: '234' }).getAttribute('aria-selected')).toBe('true');
    // 0..100 共 101 档 + 123/234 两个当前值，不为宽范围生成上万 DOM
    expect(within(下限列).getAllByRole('option').length).toBe(103);
    await userEvent.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(123, 234);
  });

  it('服务端 9000/10000 原样确定，不因 UI 限制被截断', async () => {
    const 确认 = vi.fn();
    render(<薪资区间层 用途="岗位" 下限={9000} 上限={10000} 确认={确认} 取消={vi.fn()} />);
    expect(within(screen.getByRole('listbox', { name: '薪资下限' }))
      .getByRole('option', { name: '9000' }).getAttribute('aria-selected')).toBe('true');
    expect(within(screen.getByRole('listbox', { name: '薪资上限' }))
      .getByRole('option', { name: '10000' }).getAttribute('aria-selected')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(9000, 10000);
  });

  it('输入金额：0 与 9999 经精确输入确定', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<薪资区间层 用途="岗位" 下限={null} 上限={null} 确认={确认} 取消={vi.fn()} />);
    await 用户.click(screen.getByRole('button', { name: '输入金额' }));
    // 次级入口带着当前临时值打开（同原数字框），改数先清空
    await 用户.clear(screen.getByLabelText('薪资下限'));
    await 用户.clear(screen.getByLabelText('薪资上限'));
    await 用户.type(screen.getByLabelText('薪资下限'), '0');
    await 用户.type(screen.getByLabelText('薪资上限'), '9999');
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(0, 9999);
  });

  it('输入金额沿用原数字框规则：digits-only 且至多 4 位（12345 落 1234）', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<薪资区间层 用途="岗位" 下限={null} 上限={null} 确认={确认} 取消={vi.fn()} />);
    await 用户.click(screen.getByRole('button', { name: '输入金额' }));
    await 用户.clear(screen.getByLabelText('薪资下限'));
    const 下限框 = screen.getByLabelText('薪资下限') as HTMLInputElement;
    await 用户.type(下限框, '12345');
    expect(下限框.value).toBe('1234');
    await 用户.clear(screen.getByLabelText('薪资上限'));
    await 用户.type(screen.getByLabelText('薪资上限'), '9999');
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(1234, 9999);
  });

  it('未编辑的已有超范围值在精确输入里原样保留，不因打开即截断', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<薪资区间层 用途="岗位" 下限={10000} 上限={10000} 确认={确认} 取消={vi.fn()} />);
    await 用户.click(screen.getByRole('button', { name: '输入金额' }));
    expect((screen.getByLabelText('薪资下限') as HTMLInputElement).value).toBe('10000');
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(10000, 10000);
  });

  it('精确输入清空后空值不能确认', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<薪资区间层 用途="岗位" 下限={20} 上限={30} 确认={确认} 取消={vi.fn()} />);
    await 用户.click(screen.getByRole('button', { name: '输入金额' }));
    await 用户.clear(screen.getByLabelText('薪资下限'));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '确定' })).toBeTruthy();
  });

  it('倒置 30/20 确定停留报错不关闭；修正 20/30 才回填', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<薪资区间层 用途="岗位" 下限={null} 上限={null} 确认={确认} 取消={vi.fn()} />);
    const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
    await 用户.click(within(下限列).getByRole('option', { name: '30' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资上限' })).getByRole('option', { name: '20' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).not.toHaveBeenCalled();
    expect(screen.getByText('薪资下限不能高于上限')).toBeTruthy();
    // 修正后才回填
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: '20' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资上限' })).getByRole('option', { name: '30' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(20, 30);
  });
});
