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

  it('精确输入只在月薪显示：日薪弹层没有「输入金额」入口', () => {
    render(<薪资区间层 用途="岗位" 周期="day" 下限={null} 上限={null} 确认={vi.fn()} 取消={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '输入金额' })).toBeNull();
  });
});

// ── 岗位日薪/时薪（Task 5）：同一双轮层接走原两个 数字滚轮层 入口 ──
// 冻结策略：日薪 50–800 / 时薪 20–200 步长 10；每侧缺值临时 200/40；初值沿旧
// 数字滚轮「先夹范围再就近吸附」；确定同步两字段，不在抽屉内新增倒置拦截；
// 取消原字段值不受吸附影响（回填与否由页面负责，这里只锁弹层合同）。
describe('薪资区间层 岗位日薪/时薪', () => {
  it('空弹层两侧临时落 200；档 50–800 步 10 共 76 档，无精确输入入口', () => {
    render(<薪资区间层 用途="岗位" 周期="day" 下限={null} 上限={null} 确认={vi.fn()} 取消={vi.fn()} />);
    const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
    expect(within(下限列).getByRole('option', { name: '200' }).getAttribute('aria-selected')).toBe('true');
    expect(within(screen.getByRole('listbox', { name: '薪资上限' }))
      .getByRole('option', { name: '200' }).getAttribute('aria-selected')).toBe('true');
    expect(within(下限列).getAllByRole('option').length).toBe(76);
    expect(within(下限列).getByRole('option', { name: '50' })).toBeTruthy();
    expect(within(下限列).getByRole('option', { name: '800' })).toBeTruthy();
    expect(within(下限列).queryByRole('option', { name: '795' })).toBeNull();
  });

  it('空弹层时薪两侧临时落 40；档 20–200 步 10 共 19 档', async () => {
    const 确认 = vi.fn();
    render(<薪资区间层 用途="岗位" 周期="hour" 下限={null} 上限={null} 确认={确认} 取消={vi.fn()} />);
    const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
    expect(within(下限列).getAllByRole('option').length).toBe(19);
    expect(within(下限列).getByRole('option', { name: '40' }).getAttribute('aria-selected')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(40, 40);
  });

  it('倒置 300/200 确定仍回填：倒置拦截归表单提交校验，不新增到日/时薪抽屉', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<薪资区间层 用途="岗位" 周期="day" 下限={null} 上限={null} 确认={确认} 取消={vi.fn()} />);
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: '300' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资上限' })).getByRole('option', { name: '200' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(300, 200);
    expect(screen.queryByText('薪资下限不能高于上限')).toBeNull();
  });

  it('已有 55 吸附到 60、900 夹到 800：初值沿旧数字轮先夹范围再就近吸附', () => {
    const { unmount } = render(
      <薪资区间层 用途="岗位" 周期="day" 下限={55} 上限={null} 确认={vi.fn()} 取消={vi.fn()} />,
    );
    expect(within(screen.getByRole('listbox', { name: '薪资下限' }))
      .getByRole('option', { name: '60' }).getAttribute('aria-selected')).toBe('true');
    unmount();
    render(<薪资区间层 用途="岗位" 周期="day" 下限={900} 上限={200} 确认={vi.fn()} 取消={vi.fn()} />);
    expect(within(screen.getByRole('listbox', { name: '薪资下限' }))
      .getByRole('option', { name: '800' }).getAttribute('aria-selected')).toBe('true');
  });

  it('取消零回填：确认不调用，原值不受吸附影响', async () => {
    const 确认 = vi.fn();
    const 取消 = vi.fn();
    render(<薪资区间层 用途="岗位" 周期="day" 下限={55} 上限={900} 确认={确认} 取消={取消} />);
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(取消).toHaveBeenCalledTimes(1);
    expect(确认).not.toHaveBeenCalled();
  });
});

// ── 求职引导用途（Task 5）：引导薪资接同一双轮层 ──
// 冻结策略：初值沿页面已填/面议（0）；改下限为 0 设上限 0 并隐藏右轮；从面议恢复
// 或上限小于下限时按 min(下限+10 或 100, 260 或 2200) 联动；不额外夹上限到动态帽；
// 确定原样回填两侧（无 max 规则、无倒置拦截）。
describe('薪资区间层 求职引导用途', () => {
  it('面议 0/0：左轮停在面议档（零值文案），右轮整列隐藏，确定回填 0/0', async () => {
    const 确认 = vi.fn();
    render(<薪资区间层 用途="求职引导" 下限={0} 上限={0} 确认={确认} 取消={vi.fn()} />);
    const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
    expect(within(下限列).getByRole('option', { name: '面议' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('listbox', { name: '薪资上限' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(0, 0);
  });

  it('从面议点 20：右轮出现并联动 30（min(20+10,260)），确定回填 20/30', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<薪资区间层 用途="求职引导" 下限={0} 上限={0} 确认={确认} 取消={vi.fn()} />);
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: '20' }));
    const 上限列 = screen.getByRole('listbox', { name: '薪资上限' });
    expect(within(上限列).getByRole('option', { name: '30' }).getAttribute('aria-selected')).toBe('true');
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(20, 30);
  });

  it('下限 40 联动 50：不额外夹上限到动态帽', async () => {
    const 用户 = userEvent.setup();
    render(<薪资区间层 用途="求职引导" 下限={0} 上限={0} 确认={vi.fn()} 取消={vi.fn()} />);
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: '40' }));
    expect(within(screen.getByRole('listbox', { name: '薪资上限' }))
      .getByRole('option', { name: '50' }).getAttribute('aria-selected')).toBe('true');
  });

  it('点回面议：右轮消失、上限临时值归 0，确定回填 0/0', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<薪资区间层 用途="求职引导" 下限={0} 上限={0} 确认={确认} 取消={vi.fn()} />);
    const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
    await 用户.click(within(下限列).getByRole('option', { name: '20' }));
    expect(screen.getByRole('listbox', { name: '薪资上限' })).toBeTruthy();
    await 用户.click(within(下限列).getByRole('option', { name: '面议' }));
    expect(screen.queryByRole('listbox', { name: '薪资上限' })).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(0, 0);
  });

  it('已答 300/500 日薪打开原样定位；键盘改下限确定后回填同一值', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<薪资区间层 用途="求职引导" 周期="day" 下限={300} 上限={500} 确认={确认} 取消={vi.fn()} />);
    const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
    expect(within(下限列).getByRole('option', { name: '300' }).getAttribute('aria-selected')).toBe('true');
    下限列.focus();
    await 用户.keyboard('{ArrowDown}');
    // 键盘按档序移动：300 的下一档是 320（220–500 段步长 20）
    expect(within(下限列).getByRole('option', { name: '320' }).getAttribute('aria-selected')).toBe('true');
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(320, 500);
  });

  it('取消零回填：确认不调用', async () => {
    const 确认 = vi.fn();
    const 取消 = vi.fn();
    render(<薪资区间层 用途="求职引导" 下限={0} 上限={0} 确认={确认} 取消={取消} />);
    await userEvent.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: '20' }));
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(取消).toHaveBeenCalledTimes(1);
    expect(确认).not.toHaveBeenCalled();
  });
});
