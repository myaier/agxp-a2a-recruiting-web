// 内嵌双滚轮的可访问合同（Task 1）。
// 之前这一列只有 onScroll + aria-selected：键盘进不来、点档位选不中、
// 读屏拿不到当前行。这里冻结六件事：两列可 Tab 且按键只动当前列；
// Home/End 到边界、箭头在边界夹紧；点 option 直接选中且焦点留在本列；
// aria-activedescendant 指向选中档；滚动停下 90ms 才写 state；
// 外部改值定位滚轮后，那次程序 scroll 不回写 state。
//
// 仓库未装 @testing-library/jest-dom，断言一律用原生 textContent / getAttribute / activeElement。

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import 内嵌双滚轮 from './内嵌双滚轮';

/** 受控宿主：值落 React state，两列各一个 output 回显，方便断言有没有串列 */
function 宿主({ 左初值 = 4, 右初值 = 12 }: { 左初值?: number; 右初值?: number }) {
  const [左, 设左] = useState(左初值);
  const [右, 设右] = useState(右初值);
  return (
    <>
      <output aria-label="左值">{左}</output>
      <output aria-label="右值">{右}</output>
      <内嵌双滚轮
        左档={[3, 4, 5, 6]}
        右档={[10, 11, 12, 13]}
        左值={左}
        右值={右}
        设左值={设左}
        设右值={设右}
        左名="薪资下限"
        右名="薪资上限"
        左单位="K"
        右单位="K"
      />
    </>
  );
}

describe('内嵌双滚轮 可访问合同', () => {
  it('两列可 Tab 聚焦且 ArrowUp/ArrowDown 只改变当前列', async () => {
    const 用户 = userEvent.setup();
    render(<宿主 />);
    const 左列 = screen.getByRole('listbox', { name: '薪资下限' });
    const 右列 = screen.getByRole('listbox', { name: '薪资上限' });

    await 用户.tab();
    expect(document.activeElement).toBe(左列);
    await 用户.keyboard('{ArrowDown}');
    expect(within(左列).getByRole('option', { name: '5' }).getAttribute('aria-selected')).toBe('true');
    expect(within(右列).getByRole('option', { name: '12' }).getAttribute('aria-selected')).toBe('true');

    await 用户.tab();
    expect(document.activeElement).toBe(右列);
    await 用户.keyboard('{ArrowUp}');
    expect(within(右列).getByRole('option', { name: '11' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('左值').textContent).toBe('5');
    expect(screen.getByLabelText('右值').textContent).toBe('11');
  });

  it('Home/End 到达边界，Arrow 键在边界夹紧', async () => {
    const 用户 = userEvent.setup();
    render(<宿主 />);
    const 左列 = screen.getByRole('listbox', { name: '薪资下限' });
    左列.focus();
    await 用户.keyboard('{Home}{ArrowUp}');
    expect(within(左列).getByRole('option', { name: '3' }).getAttribute('aria-selected')).toBe('true');
    await 用户.keyboard('{End}{ArrowDown}');
    expect(within(左列).getByRole('option', { name: '6' }).getAttribute('aria-selected')).toBe('true');
  });

  it('点击非当前 option 直接选择并把焦点留在所属 listbox', async () => {
    const 用户 = userEvent.setup();
    render(<宿主 />);
    const 右列 = screen.getByRole('listbox', { name: '薪资上限' });
    await 用户.click(within(右列).getByRole('option', { name: '10' }));
    expect(document.activeElement).toBe(右列);
    expect(within(右列).getByRole('option', { name: '10' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('左值').textContent).toBe('4');
    expect(screen.getByLabelText('右值').textContent).toBe('10');
  });

  it('aria-activedescendant points at the selected option id', () => {
    render(<宿主 />);
    const 左列 = screen.getByRole('listbox', { name: '薪资下限' });
    const 选中 = within(左列).getByRole('option', { name: '4' });
    expect(选中.id).not.toBe('');
    expect(左列.getAttribute('aria-activedescendant')).toBe(选中.id);
  });

  it('scroll 停止 90ms 后选择最近档', () => {
    vi.useFakeTimers();
    try {
      render(<宿主 />);
      const 左列 = screen.getByRole('listbox', { name: '薪资下限' });
      Object.defineProperty(左列, 'scrollTop', { configurable: true, writable: true, value: 92 });
      fireEvent.scroll(左列);
      act(() => vi.advanceTimersByTime(89));
      expect(screen.getByLabelText('左值').textContent).toBe('4');
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByLabelText('左值').textContent).toBe('5');
    } finally {
      vi.useRealTimers();
    }
  });

  it('外部改值定位滚轮且对应程序 scroll 不重复写 state', () => {
    vi.useFakeTimers();
    try {
      const 设左值 = vi.fn();
      const { rerender } = render(
        <内嵌双滚轮
          左档={[3, 4, 5, 6]}
          右档={[10, 11, 12, 13]}
          左值={4}
          右值={12}
          设左值={设左值}
          设右值={vi.fn()}
          左名="薪资下限"
          右名="薪资上限"
        />,
      );
      const 左列 = screen.getByRole('listbox', { name: '薪资下限' });
      rerender(
        <内嵌双滚轮
          左档={[3, 4, 5, 6]}
          右档={[10, 11, 12, 13]}
          左值={6}
          右值={12}
          设左值={设左值}
          设右值={vi.fn()}
          左名="薪资下限"
          右名="薪资上限"
        />,
      );
      expect(左列.scrollTop).toBe(138);
      fireEvent.scroll(左列);
      act(() => vi.advanceTimersByTime(90));
      expect(设左值).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('值不在档表内时 ArrowUp/ArrowDown 首按都落在第一档', async () => {
    const 用户 = userEvent.setup();
    // 左值 99 不在 [3,4,5,6] 里：轮子未定位，两个方向的第一按都应该夹到首档 3，
    // 而不是 ArrowDown 跳到第二档（review-r1：越档值的首按一致性）
    render(<宿主 左初值={99} />);
    const 左列 = screen.getByRole('listbox', { name: '薪资下限' });
    左列.focus();
    await 用户.keyboard('{ArrowDown}');
    expect(within(左列).getByRole('option', { name: '3' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('左值').textContent).toBe('3');
    await 用户.keyboard('{ArrowUp}');
    expect(within(左列).getByRole('option', { name: '3' }).getAttribute('aria-selected')).toBe('true');
  });
});
