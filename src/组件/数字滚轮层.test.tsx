// 数字滚轮层的可访问合同（Task 3）：单列数字滚轮接 use可访问滚轮 后，
// 键盘 / 点档直选 / 提交值 三者必须落在同一个数上。
// 仓库未装 @testing-library/jest-dom，断言一律用原生 getAttribute。
//
// 离散档（picker 统一 Task 2）：求职侧实习月数 / 每周到岗天数只开放产品定的档，
// 由调用方静态给 档位 数组；连续范围调用方的旧合同原样保留。顶栏确认键统一「确定」。

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
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(16);
  });
});

describe('数字滚轮层 离散档（picker 统一 Task 2）', () => {
  it('初值 3：ArrowDown 落到 6，档表外的 4 不存在', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(
      <数字滚轮层 标题="实习时长" 初值={3} 档位={[1, 3, 6]} 单位="个月"
        确认={确认} 取消={vi.fn()} />,
    );
    const 列 = screen.getByRole('listbox', { name: '实习时长' });
    expect(within(列).getByRole('option', { name: '3' }).getAttribute('aria-selected')).toBe('true');
    expect(within(列).queryByRole('option', { name: '4' })).toBeNull();
    列.focus();
    await 用户.keyboard('{ArrowDown}');
    expect(within(列).getByRole('option', { name: '6' }).getAttribute('aria-selected')).toBe('true');
    expect(within(列).queryByRole('option', { name: '5' })).toBeNull();
  });

  it('初值不在表中取最近档，距离相同取较小档', () => {
    const 首渲染 = render(
      <数字滚轮层 标题="实习时长" 初值={5} 档位={[1, 3, 6]} 单位="个月"
        确认={vi.fn()} 取消={vi.fn()} />,
    );
    const 首列 = screen.getByRole('listbox', { name: '实习时长' });
    // 5 离 6 更近
    expect(within(首列).getByRole('option', { name: '6' }).getAttribute('aria-selected')).toBe('true');
    首渲染.unmount();

    render(
      <数字滚轮层 标题="实习时长" 初值={2} 档位={[1, 3, 6]} 单位="个月"
        确认={vi.fn()} 取消={vi.fn()} />,
    );
    const 列 = screen.getByRole('listbox', { name: '实习时长' });
    // 2 与 1、3 等距：取较小档 1
    expect(within(列).getByRole('option', { name: '1' }).getAttribute('aria-selected')).toBe('true');
  });

  it('取消不回填', async () => {
    const 确认 = vi.fn();
    const 取消 = vi.fn();
    const 用户 = userEvent.setup();
    render(
      <数字滚轮层 标题="每周到岗" 初值={2} 档位={[2, 3, 4, 5]} 单位="天"
        确认={确认} 取消={取消} />,
    );
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    expect(取消).toHaveBeenCalledTimes(1);
    expect(确认).not.toHaveBeenCalled();
  });

  it('确定回填当前档', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(
      <数字滚轮层 标题="实习时长" 初值={3} 档位={[1, 3, 6]} 单位="个月"
        确认={确认} 取消={vi.fn()} />,
    );
    const 列 = screen.getByRole('listbox', { name: '实习时长' });
    列.focus();
    await 用户.keyboard('{ArrowDown}');
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(6);
  });
});
