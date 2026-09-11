// 通用 · 真输入条 禁用行为（J-PILOT-01 Task 6，Spec §7）：双端 S0 保留原 textarea 与
// 发送键的 DOM/尺寸/位置，禁用输入与发送 —— 禁用是真实 disabled 属性 + 键盘回调先挡，
// 不靠颜色灰化；Enter、按钮、程序回调都触发不了发送。
// 默认行为不回归：未传 禁用（默认 false）时中文 IME / Shift+Enter / Enter / 发送键
// 语义与既有完全一致。仓库未装 @testing-library/jest-dom，用属性断言。

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { 真输入条 } from './通用';

const 占位 = '双方 AI 代理正在确认条件';

function 挂输入条(选项: { 禁用?: boolean; 发送?: () => void; 改变?: (文本: string) => void } = {}) {
  const 发送 = 选项.发送 ?? vi.fn();
  const 改变 = 选项.改变 ?? vi.fn();
  render(
    <真输入条 占位={占位} 值="" 改变={改变} 发送={发送} {...(选项.禁用 === undefined ? {} : { 禁用: 选项.禁用 })} />,
  );
  return {
    框: screen.getByPlaceholderText(占位) as HTMLTextAreaElement,
    键: screen.getByRole('button', { name: '发送' }) as HTMLButtonElement,
    发送: 发送 as ReturnType<typeof vi.fn>,
    改变: 改变 as ReturnType<typeof vi.fn>,
  };
}

describe('真输入条 · 默认（不传 禁用）语义保持', () => {
  it('textarea 与发送键可用：输入回调 改变，发送键只回调 发送', async () => {
    const user = userEvent.setup();
    const 改变 = vi.fn();
    const 发送 = vi.fn();
    render(<真输入条 占位={占位} 值="" 改变={改变} 发送={发送} />);
    const 框 = screen.getByPlaceholderText(占位);
    expect(框.tagName).toBe('TEXTAREA');
    expect((框 as HTMLTextAreaElement).disabled).toBe(false);
    fireEvent.change(框, { target: { value: '周五也可以到岗' } });
    expect(改变).toHaveBeenCalledWith('周五也可以到岗');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(发送).toHaveBeenCalledTimes(1);
  });

  it('中文输入法回车上屏（isComposing）不当发送；Shift+Enter 留换行；Enter 发送', () => {
    const 发送 = vi.fn();
    挂输入条({ 发送 });
    const 框 = screen.getByPlaceholderText(占位);
    fireEvent.keyDown(框, { key: 'Enter', isComposing: true });
    expect(发送).not.toHaveBeenCalled();
    fireEvent.keyDown(框, { key: 'Enter', shiftKey: true });
    expect(发送).not.toHaveBeenCalled();
    fireEvent.keyDown(框, { key: 'Enter' });
    expect(发送).toHaveBeenCalledTimes(1);
  });
});

describe('真输入条 · 禁用（Spec §7 双端 S0）', () => {
  it('textarea 与发送键都带真实 disabled 属性（不是只靠灰化/隐藏）', () => {
    const { 框, 键 } = 挂输入条({ 禁用: true });
    expect(框.disabled).toBe(true);
    expect(键.disabled).toBe(true);
    expect(框.tagName).toBe('TEXTAREA'); // 原控件仍在，不是替代只读条
  });

  it('Enter、点击都触发不了发送回调：键回调先挡禁用，点击路径不接 发送', async () => {
    const user = userEvent.setup();
    const 发送 = vi.fn();
    const { 框, 键 } = 挂输入条({ 禁用: true, 发送 });
    fireEvent.keyDown(框, { key: 'Enter' });
    await user.click(键); // 真实 disabled：userEvent 点不动
    fireEvent.click(键); // 绕过 pointer-events 的粗粒度断言：仍零回调
    expect(发送).not.toHaveBeenCalled();
  });

  it('禁用不改变占位与值受控（S0 文案在 placeholder 原样可见）', () => {
    const { 框 } = 挂输入条({ 禁用: true });
    expect((框 as HTMLTextAreaElement).placeholder).toBe(占位);
    expect((框 as HTMLTextAreaElement).value).toBe('');
  });
});
