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
    // 居中定位靠 flex 包裹层（e2e-2026-08-31 定稿方案）：确认框定位合同不随焦点修复漂移
    const 包裹层 = 居中面板.parentElement as HTMLElement;
    expect(包裹层.style.display).toBe('flex');
    expect(包裹层.style.alignItems).toBe('center');
    expect(包裹层.style.justifyContent).toBe('center');
    expect(包裹层.style.position).toBe('absolute');
  });

  // Task 1（背景跳动修复）：恢复焦点只给「仍连接且可聚焦」的原触发元素，
  // 且 preventScroll —— 取消时页面可能已滚到别处，裸 focus 会把背景再拽一次。
  it('卸载后把焦点恢复给原触发元素', () => {
    const 触发 = document.createElement('button');
    触发.textContent = '打开抽屉';
    document.body.appendChild(触发);
    触发.focus();
    const 视图 = render(
      <弹层框架 标签="恢复弹层" 遮罩类名="overlay" 面板类名="panel" 关闭={() => undefined}>
        <button type="button">第一项</button>
      </弹层框架>,
    );

    视图.unmount();
    expect(document.activeElement).toBe(触发);
    触发.remove();
  });

  it('触发元素已被移除时卸载不抛错，焦点安静回落', () => {
    const 触发 = document.createElement('button');
    触发.textContent = '打开抽屉';
    document.body.appendChild(触发);
    触发.focus();
    const 视图 = render(
      <弹层框架 标签="移除弹层" 遮罩类名="overlay" 面板类名="panel" 关闭={() => undefined}>
        <button type="button">第一项</button>
      </弹层框架>,
    );
    // 开着弹层期间触发元素被条件渲染撤走
    触发.remove();

    expect(() => 视图.unmount()).not.toThrow();
    expect(document.activeElement).not.toBe(触发);
  });

  it('重复打开/取消：每次挂载焦点都落首控件，卸载都还给触发元素', () => {
    const 触发 = document.createElement('button');
    触发.textContent = '打开抽屉';
    document.body.appendChild(触发);
    触发.focus();
    const 首选项 = (第一次: boolean) => (
      <弹层框架 标签="重复弹层" 遮罩类名="overlay" 面板类名="panel" 关闭={() => undefined}>
        <button type="button">{第一次 ? '第一项甲' : '第一项乙'}</button>
      </弹层框架>
    );

    const 首开 = render(首选项(true));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '第一项甲' }));
    首开.unmount();
    expect(document.activeElement).toBe(触发);

    const 重开 = render(首选项(false));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '第一项乙' }));
    重开.unmount();
    expect(document.activeElement).toBe(触发);
    触发.remove();
  });
});
