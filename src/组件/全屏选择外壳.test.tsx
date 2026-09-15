// 全屏选择外壳 测试（Task 1 / Plan 冻结的 A 契约）：
// 只断言壳自身的边界行为 —— 对话框语义与可访问名称、首次焦点在返回按钮、
// Tab/Shift+Tab 限于子视图、Escape 调用 关闭、卸载不抢先把焦点还给打开前的父元素
// （父页隐藏自己的 wrapper 及关闭后的焦点/滚动恢复都由父页负责，壳不代劳）。
// 满高/溢出/底部安全区由 CSS 承担，jsdom 不证布局，这里不逐条镜像断言 CSS。

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { 全屏选择外壳 } from './全屏选择外壳';

function 壳(关闭 = vi.fn()) {
  return (
    <全屏选择外壳 标题="职位类别" 关闭={关闭}>
      <button>正文甲</button>
      <button>正文乙</button>
    </全屏选择外壳>
  );
}

describe('全屏选择外壳 A 契约', () => {
  it('对话框语义上屏：role=dialog + aria-modal + 可访问名称，标题与正文可见', () => {
    render(壳());
    const 对话框 = screen.getByRole('dialog', { name: '职位类别' });
    expect(对话框.getAttribute('aria-modal')).toBe('true');
    expect(对话框.textContent).toContain('职位类别');
    expect(screen.getByRole('button', { name: '正文甲' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '正文乙' })).toBeTruthy();
  });

  it('首次焦点在返回按钮；Escape 与返回键都调用 关闭', async () => {
    const 关闭 = vi.fn();
    render(壳(关闭));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '返回' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(关闭).toHaveBeenCalledTimes(1);
    await userEvent.setup().click(screen.getByRole('button', { name: '返回' }));
    expect(关闭).toHaveBeenCalledTimes(2);
  });

  it('Tab/Shift+Tab 限于子视图：末尾 Tab 绕回返回键，首个 Shift+Tab 绕回末尾', () => {
    render(壳());
    const 返回键 = screen.getByRole('button', { name: '返回' });
    const 末项 = screen.getByRole('button', { name: '正文乙' });
    末项.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(返回键);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(末项);
  });

  it('壳卸载不抢先把焦点还给打开前的父元素（恢复由父页按 A 负责）', async () => {
    const 关闭 = vi.fn();
    function 页面({ 开 }: { 开: boolean }) {
      return (
        <>
          <button>触发字段</button>
          {开 ? 壳(关闭) : null}
        </>
      );
    }
    const 视图 = render(<页面 开={false} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '触发字段' }));
    视图.rerender(<页面 开={true} />);
    // 壳挂载：首次焦点进返回键
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '返回' }));
    视图.rerender(<页面 开={false} />);
    // 卸载时壳不动焦点（触发字段仍在文档里，若壳抢着恢复会指向它）
    expect(screen.getByRole('button', { name: '触发字段' })).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
  });
});
