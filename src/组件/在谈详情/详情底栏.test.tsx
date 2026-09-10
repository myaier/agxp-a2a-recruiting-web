// 详情底栏 · 无 Provider 展示测试（契约 A）：底部 Case 叮嘱的输入/只读两态。
//   · 输入可用（发送!==null 且 禁用说明===null）直接复用全站 真输入条（现有 props，
//     不为本页改它的默认行为）：占位/值/改变/发送原样接线；
//   · 输入不可用（发送 null 或 禁用说明非空）与 只读 态：输入控件一概不渲染 —— 终局
//     「保留底部区域且无可执行发送」（spec §5），说明可见；
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

  it('发送 null：无可执行发送 —— 无输入框、无发送键，禁用说明可见', () => {
    render(
      <详情底栏
        信息={{ kind: '输入', 占位, 值: '草稿', 改变: vi.fn(), 发送: null, 禁用说明: '本轮已提交，等服务器回话' }}
      />,
    );
    expect(screen.queryByPlaceholderText(占位)).toBeNull();
    expect(screen.queryByRole('button', { name: '发送' })).toBeNull();
    expect(screen.getByText('本轮已提交，等服务器回话')).toBeTruthy();
  });

  it('禁用说明非空（发送仍在）：同样不渲染输入控件，说明可见', () => {
    render(
      <详情底栏
        信息={{ kind: '输入', 占位, 值: '', 改变: vi.fn(), 发送: vi.fn(), 禁用说明: '本轮已提交，等服务器回话' }}
      />,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: '发送' })).toBeNull();
    expect(screen.getByText('本轮已提交，等服务器回话')).toBeTruthy();
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
