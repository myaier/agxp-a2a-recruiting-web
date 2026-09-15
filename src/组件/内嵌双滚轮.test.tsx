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

// ── Task 4：允许空值分支（判别联合 允许空值:true）──
// 未选择就是「请选择」空档：null 选中时所有数字档都未选中，选择空档即清空，
// setter 收到的是 null 本身，不用数字哨兵污染保存值。
describe('内嵌双滚轮 允许空值', () => {
  function 空值宿主({ 左初值 = null, 右初值 = 2025 }: { 左初值?: number | null; 右初值?: number | null }) {
    const [左, 设左] = useState<number | null>(左初值);
    const [右, 设右] = useState<number | null>(右初值);
    return (
      <>
        <output aria-label="左值">{左 === null ? '未选择' : 左}</output>
        <output aria-label="右值">{右 === null ? '未选择' : 右}</output>
        <内嵌双滚轮
          允许空值
          左档={[2020, 2021, 2022]}
          右档={[2024, 2025, 2026]}
          左值={左}
          右值={右}
          设左值={设左}
          设右值={设右}
          左名="入学年"
          右名="毕业年"
          左单位="年"
          右单位="年"
        />
      </>
    );
  }

  it('null 时只有「请选择」空档选中，所有数字档 aria-selected=false', () => {
    render(<空值宿主 />);
    const 左列 = screen.getByRole('listbox', { name: '入学年' });
    const 空档 = within(左列).getByRole('option', { name: '请选择' });
    expect(空档.getAttribute('aria-selected')).toBe('true');
    expect(左列.getAttribute('aria-activedescendant')).toBe(空档.id);
    for (const 档 of within(左列).getAllByRole('option')) {
      if (档 === 空档) continue;
      expect(档.getAttribute('aria-selected')).toBe('false');
    }
    // 另一侧有数字值：2025 照常选中，空档不选中
    const 右列 = screen.getByRole('listbox', { name: '毕业年' });
    expect(within(右列).getByRole('option', { name: '2025' }).getAttribute('aria-selected')).toBe('true');
    expect(within(右列).getByRole('option', { name: '请选择' }).getAttribute('aria-selected')).toBe('false');
  });

  it('点空档即清空：设值收到 null，点数字档再选回数字', async () => {
    const 用户 = userEvent.setup();
    render(<空值宿主 左初值={2021} />);
    const 左列 = screen.getByRole('listbox', { name: '入学年' });
    await 用户.click(within(左列).getByRole('option', { name: '请选择' }));
    expect(screen.getByLabelText('左值').textContent).toBe('未选择');
    await 用户.click(within(左列).getByRole('option', { name: '2022' }));
    expect(screen.getByLabelText('左值').textContent).toBe('2022');
    await 用户.click(within(左列).getByRole('option', { name: '请选择' }));
    expect(screen.getByLabelText('左值').textContent).toBe('未选择');
  });

  it('空档上键盘 ArrowDown 落到首个数字档，ArrowUp 夹回空档', async () => {
    const 用户 = userEvent.setup();
    render(<空值宿主 />);
    const 左列 = screen.getByRole('listbox', { name: '入学年' });
    左列.focus();
    await 用户.keyboard('{ArrowDown}');
    expect(within(左列).getByRole('option', { name: '2020' }).getAttribute('aria-selected')).toBe('true');
    await 用户.keyboard('{ArrowUp}{ArrowUp}');
    expect(within(左列).getByRole('option', { name: '请选择' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('左值').textContent).toBe('未选择');
  });
});

// ── Task 5：可选展示属性 零值文案 / 隐藏右列 ──
// 只改显示：0 档可以念成「面议」（引导），但数值与 aria-selected 的选中键不变；
// 隐藏右列保留列占位、去掉右 listbox 与其固定单位，左轮键盘照常。
describe('内嵌双滚轮 零值文案与隐藏右列', () => {
  function 面议宿主({ 右列隐藏 = false }: { 右列隐藏?: boolean }) {
    const [左, 设左] = useState(0);
    const [右, 设右] = useState(30);
    return (
      <>
        <output aria-label="左值">{左}</output>
        <output aria-label="右值">{右}</output>
        <内嵌双滚轮
          左档={[0, 10, 20]}
          右档={[30, 40]}
          左值={左}
          右值={右}
          设左值={设左}
          设右值={设右}
          左名="薪资下限"
          右名="薪资上限"
          左单位="K"
          右单位="K"
          零值文案="面议"
          隐藏右列={右列隐藏}
        />
      </>
    );
  }

  it('0 档显示「面议」，aria-selected 仍按数值 0 生效，固定单位隐藏不撤节点', () => {
    render(<面议宿主 />);
    const 左列 = screen.getByRole('listbox', { name: '薪资下限' });
    const 面议档 = within(左列).getByRole('option', { name: '面议' });
    expect(面议档.getAttribute('aria-selected')).toBe('true');
    // 数值选中键不变：同列里没有显示成数字 0 的档
    expect(within(左列).queryByRole('option', { name: '0' })).toBeNull();
    // 单位隐藏（visibility）而非撤节点：整组位置不因面议/数字切换而跳
    const 单位 = [...(左列.parentElement as HTMLElement).querySelectorAll('span')]
      .find((节) => 节.textContent === 'K');
    expect(单位).toBeTruthy();
    expect((单位 as HTMLElement).style.visibility).toBe('hidden');
  });

  it('右列数字档照常显示且带单位：零值文案只作用于 0 档', () => {
    render(<面议宿主 />);
    const 右列 = screen.getByRole('listbox', { name: '薪资上限' });
    expect(within(右列).getByRole('option', { name: '30' }).getAttribute('aria-selected')).toBe('true');
    const 单位 = [...(右列.parentElement as HTMLElement).querySelectorAll('span')]
      .find((节) => 节.textContent === 'K');
    expect((单位 as HTMLElement).style.visibility).toBe('');
  });

  it('隐藏右列：右 listbox 不渲染，左轮键盘照常（nullable 合同不受影响）', async () => {
    const 用户 = userEvent.setup();
    render(<面议宿主 右列隐藏 />);
    expect(screen.queryByRole('listbox', { name: '薪资上限' })).toBeNull();
    const 左列 = screen.getByRole('listbox', { name: '薪资下限' });
    左列.focus();
    await 用户.keyboard('{ArrowDown}');
    expect(within(左列).getByRole('option', { name: '10' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('左值').textContent).toBe('10');
  });
});
