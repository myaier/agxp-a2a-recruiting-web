// 详情底栏 · 无 Provider 展示测试（契约 A）：底部 Case 叮嘱的输入/只读/禁用三态。
//   · 输入可用（发送!==null 且 禁用说明===null）直接复用全站 真输入条（现有 props，
//     不为本页改它的默认行为）：占位/值/改变/发送原样接线；
//   · 输入不可用（发送 null 或 禁用说明非空，J-PILOT-01 双端 S0）：原 真输入条 控件
//     保留在 DOM（textarea + 发送键）但真实禁用 —— 不换成只读 div、不靠灰化，键盘/
//     点击都触发不了发送回调；说明/占位文案在 placeholder 原样可见；
//   · 只读 态（终局非 S0）：维持既有只读条 —— 终局「保留底部区域且无可执行发送」；
//   · 已发送的在飞锁归控制层：本组件只透传 发送 回调，不自带禁用 DOM 状态机。
// 仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { 详情底栏 } from './详情底栏';
import type { 详情底栏信息 } from './类型';

const 占位 = '有想法就告诉你的AI代理';

describe('详情底栏 · 输入态', () => {
  it('复用 真输入条：textarea + 占位原样，输入回调 改变，发送键只回调 发送', async () => {
    const user = userEvent.setup();
    const 改变 = vi.fn();
    const 发送 = vi.fn();
    render(
      <详情底栏
        信息={{ kind: '输入', 占位, 值: '', 改变, 发送, 禁用说明: null }}
      />,
    );
    const 框 = screen.getByPlaceholderText(占位);
    expect(框.tagName).toBe('TEXTAREA'); // 多行输入（真输入条 原件，不是第二套）
    fireEvent.change(框, { target: { value: '周五也可以到岗' } });
    expect(改变).toHaveBeenCalledWith('周五也可以到岗'); // 接线：只透传给 改变
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(发送).toHaveBeenCalledTimes(1);
  });

  it('值受控回显控制层草稿（失败保留草稿由控制层保证，本组件不造本地副本）', () => {
    render(
      <详情底栏
        信息={{ kind: '输入', 占位, 值: '周五也可以到岗', 改变: vi.fn(), 发送: vi.fn(), 禁用说明: null }}
      />,
    );
    expect((screen.getByPlaceholderText(占位) as HTMLTextAreaElement).value).toBe('周五也可以到岗');
  });

  it('发送 null + 禁用说明（双端 S0）：原 textarea 与发送键保留在 DOM 且真实禁用，Enter/点击零回调', async () => {
    const user = userEvent.setup();
    const 改变 = vi.fn();
    render(
      <详情底栏
        信息={{ kind: '输入', 占位, 值: '', 改变, 发送: null, 禁用说明: '信息不足，未能确认条件' }}
      />,
    );
    const 框 = screen.getByPlaceholderText(占位) as HTMLTextAreaElement;
    expect(框.tagName).toBe('TEXTAREA'); // 原控件不是替代只读条
    expect(框.disabled).toBe(true);
    const 键 = screen.getByRole('button', { name: '发送' }) as HTMLButtonElement;
    expect(键.disabled).toBe(true);
    fireEvent.keyDown(框, { key: 'Enter' });
    await user.click(键);
    fireEvent.click(键); // 绕过 pointer-events 的粗粒度断言：仍零回调
    fireEvent.change(框, { target: { value: '不该写进去' } });
    expect(改变).not.toHaveBeenCalled(); // 禁用分支不接 改变（值恒清空，不只 CSS 隐藏）
  });

  it('禁用说明非空（发送在场）：同样保留真实禁用控件，不换只读条', () => {
    render(
      <详情底栏
        信息={{ kind: '输入', 占位, 值: '', 改变: vi.fn(), 发送: vi.fn(), 禁用说明: '条件确认遇到问题，待排查' }}
      />,
    );
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('详情底栏 · 只读态（终局）', () => {
  it('说明原样在场：无输入框、无发送键（保留底部区域，输入禁用且无发送回调）', () => {
    const 信息: 详情底栏信息 = { kind: '只读', 说明: '当前在谈已结束，仅可查看' };
    const { rerender } = render(<详情底栏 信息={信息} />);
    expect(screen.getByText('当前在谈已结束，仅可查看')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: '发送' })).toBeNull();
    // 稳定性：同一说明重渲染不丢（终局轮询停了，但快照刷新仍可能触发重渲染）
    rerender(<详情底栏 信息={信息} />);
    expect(screen.getByText('当前在谈已结束，仅可查看')).toBeTruthy();
  });
});
