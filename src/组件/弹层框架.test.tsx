import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 弹层框架 from './弹层框架';

describe('弹层框架', () => {
  it('提供可识别的对话框，并在点击遮罩时关闭', async () => {
    const 关闭 = vi.fn();
    const 用户 = userEvent.setup();
    render(
      <弹层框架 标签="测试弹层" 遮罩类名="overlay" 面板类名="panel" 关闭={关闭}>
        <button type="button">确认</button>
      </弹层框架>
    );

    expect(screen.getByRole('dialog', { name: '测试弹层' })).not.toBeNull();
    await 用户.click(screen.getByRole('button', { name: '关闭测试弹层' }));
    expect(关闭).toHaveBeenCalledOnce();
  });

  it('支持 Escape 关闭，并把焦点移入弹层', async () => {
    const 关闭 = vi.fn();
    const 用户 = userEvent.setup();
    render(
      <弹层框架 标签="键盘弹层" 遮罩类名="overlay" 面板类名="panel" 关闭={关闭}>
        <button type="button">第一项</button>
      </弹层框架>
    );

    expect(document.activeElement).toBe(screen.getByRole('button', { name: '第一项' }));
    await 用户.keyboard('{Escape}');
    expect(关闭).toHaveBeenCalledOnce();
  });

  it('把键盘焦点限制在弹层控件内', async () => {
    const 用户 = userEvent.setup();
    render(
      <弹层框架 标签="焦点弹层" 遮罩类名="overlay" 面板类名="panel" 关闭={() => undefined}>
        <button type="button">第一项</button>
        <button type="button">最后项</button>
      </弹层框架>
    );

    await 用户.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '最后项' }));
    await 用户.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '第一项' }));
  });
});
