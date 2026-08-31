import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 滑动行 from './滑动行';

describe('滑动行 · 键盘语义', () => {
  it('没有整行动作时不伪装成按钮，也不拦截子按钮的键盘激活', async () => {
    const 用户 = userEvent.setup();
    const 子动作 = vi.fn();

    render(
      <滑动行 操作={[]} 打开={false} 请求打开={vi.fn()}>
        <button onClick={子动作}>收藏</button>
      </滑动行>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('group').getAttribute('tabindex')).toBeNull();
    await 用户.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '收藏' }));
    await 用户.keyboard('{Enter}');
    expect(子动作).toHaveBeenCalledTimes(1);
  });

  it('提供整行动作时保留按钮语义与 Enter 激活', async () => {
    const 用户 = userEvent.setup();
    const 行动作 = vi.fn();

    render(
      <滑动行 操作={[]} 打开={false} 请求打开={vi.fn()} 按下={行动作}>
        <span>岗位详情</span>
      </滑动行>,
    );

    const 行 = screen.getByRole('button', { name: '岗位详情' });
    行.focus();
    await 用户.keyboard('{Enter}');
    expect(行动作).toHaveBeenCalledTimes(1);
  });
});
