// 年份区间层的确认合同（bottom-drawer 统一 Task 4）。
// 弹层只承载两列可空年份滚轮（2000–2030 + 「请选择」空档），落数规则冻结在四件事上：
// 初始化空档停在「请选择」；取消零确认；确定一次输出完整二元组（允许单侧空、
// 两侧空与倒置）—— 完整性与起止合法性校验留在父页下一步，抽屉不提前替代。
// 仓库未装 @testing-library/jest-dom，断言一律用原生 getAttribute。

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 年份区间层 from './年份区间层';

describe('年份区间层 确认合同', () => {
  it('初始化空档：两列都停在「请选择」空档', () => {
    render(<年份区间层 入学年={null} 毕业年={null} 确认={vi.fn()} 取消={vi.fn()} />);
    for (const 列名 of ['入学年', '毕业年']) {
      const 列 = screen.getByRole('listbox', { name: 列名 });
      expect(within(列).getByRole('option', { name: '请选择' }).getAttribute('aria-selected')).toBe('true');
    }
  });

  it('只改入学年后取消：零确认', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<年份区间层 入学年={2017} 毕业年={2021} 确认={确认} 取消={vi.fn()} />);
    await 用户.click(within(screen.getByRole('listbox', { name: '入学年' })).getByRole('option', { name: '2018' }));
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    expect(确认).not.toHaveBeenCalled();
  });

  it('改两列后一次确认返回 2017/2021', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<年份区间层 入学年={null} 毕业年={null} 确认={确认} 取消={vi.fn()} />);
    await 用户.click(within(screen.getByRole('listbox', { name: '入学年' })).getByRole('option', { name: '2017' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '毕业年' })).getByRole('option', { name: '2021' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledTimes(1);
    expect(确认).toHaveBeenCalledWith(2017, 2021);
  });

  it('可确认清空：两侧都选「请选择」确定返回 null/null', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<年份区间层 入学年={2017} 毕业年={2021} 确认={确认} 取消={vi.fn()} />);
    await 用户.click(within(screen.getByRole('listbox', { name: '入学年' })).getByRole('option', { name: '请选择' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '毕业年' })).getByRole('option', { name: '请选择' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(null, null);
  });

  it('倒置（毕业年早于入学年）也可确认，抽屉内不拦截', async () => {
    const 确认 = vi.fn();
    const 用户 = userEvent.setup();
    render(<年份区间层 入学年={2021} 毕业年={2017} 确认={确认} 取消={vi.fn()} />);
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(确认).toHaveBeenCalledWith(2021, 2017);
  });
});