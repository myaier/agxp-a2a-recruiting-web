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

  // picker 统一 Task 1：effect 只在首开/卸载负责焦点，父层每次重渲染的新 关闭
  // 不得把焦点重新抓回首控件（此前用户刚展开的行/正在输入的框会被打断）。
  it('父层重渲染更换关闭回调后，焦点保持在用户刚操作的控件上', async () => {
    const 关闭一 = vi.fn();
    const 关闭二 = vi.fn();
    const 用户 = userEvent.setup();
    const 视图 = render(
      <弹层框架 标签="焦点弹层" 遮罩类名="overlay" 面板类名="panel" 关闭={关闭一}>
        <button type="button">第一项</button>
        <button type="button">刚展开项</button>
      </弹层框架>,
    );
    await 用户.click(screen.getByRole('button', { name: '刚展开项' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '刚展开项' }));

    视图.rerender(
      <弹层框架 标签="焦点弹层" 遮罩类名="overlay" 面板类名="panel" 关闭={关闭二}>
        <button type="button">第一项</button>
        <button type="button">刚展开项</button>
      </弹层框架>,
    );
    // 不重跑首开聚焦：焦点仍留在刚展开的按钮上
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '刚展开项' }));

    // Escape 走最新的关闭回调
    await 用户.keyboard('{Escape}');
    expect(关闭二).toHaveBeenCalledOnce();
    expect(关闭一).not.toHaveBeenCalled();
  });

  it('底部面板不再内联限高（caller 的 max-height 生效），居中面板保持不被限高', () => {
    const 视图 = render(
      <弹层框架 标签="底部弹层" 遮罩类名="overlay" 面板类名="panel" 关闭={() => undefined}>
        <button type="button">好</button>
      </弹层框架>,
    );
    const 底部面板 = screen.getByRole('dialog', { name: '底部弹层' }) as HTMLElement;
    // 移除内联 maxHeight:'none'：caller CSS 的限高（如 72%）不再被压过
    expect(底部面板.style.maxHeight).toBe('');
    expect(底部面板.style.position).toBe('absolute');

    视图.unmount();
    render(
      <弹层框架 标签="居中弹层" 遮罩类名="overlay" 面板类名="panel" 位置="居中" 关闭={() => undefined}>
        <button type="button">好</button>
      </弹层框架>,
    );
    const 居中面板 = screen.getByRole('dialog', { name: '居中弹层' }) as HTMLElement;
    expect(居中面板.style.position).toBe('static');
    expect(居中面板.style.maxHeight).toBe('none');
  });
});
