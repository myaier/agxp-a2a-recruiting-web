// 滑动行的手势合同。
//
// 这一屏的核心 bug（2026-08-30 真实后端验收发现）：组件头注释写着「桌面鼠标拖拽与手机
// 触摸同一套代码」，但两者并不同 —— 触摸移动过后浏览器会抑制兼容 click，鼠标不会。
// 于是鼠标左滑时 松手 先 请求打开(true) 打开行，紧跟着浏览器合成的 click 落在行面上，
// onClick 看到 打开=true 又 请求打开(false)，行开了立刻关，桌面用户根本滑不开。
//
// 这里冻结四件事：横向手势后的那一次 click 被吞掉；普通点按（关/开两态）原样工作；
// 纵向拖拽不产生横向效果；抑制标记不会泄漏到后续无关的点击。

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 滑动行 from './滑动行';

/** 一行两个操作 → 操作区宽 152px，过半即 76px 才吸附到「全开」 */
function 渲染(选项: { 打开?: boolean } = {}) {
  const 请求打开 = vi.fn();
  const 按下 = vi.fn();
  render(
    <滑动行
      操作={[
        { 文字: '替换', 按下: vi.fn() },
        { 文字: '删除', 危险: true, 按下: vi.fn() },
      ]}
      打开={选项.打开 ?? false}
      请求打开={请求打开}
      按下={按下}
    >
      <div data-testid="行内容">一行内容</div>
    </滑动行>
  );
  // 行面是唯一带 aria-expanded 的 button；操作键在 打开 态下也会进可及树，不能用裸 getByRole
  return { 请求打开, 按下, 行面: screen.getByRole('button', { expanded: 选项.打开 ?? false }) };
}

/** 桌面鼠标左滑：pointerdown → 若干 pointermove → pointerup，随后浏览器合成一次 click */
function 鼠标左滑(行面: HTMLElement, 位移: number) {
  const 起x = 300;
  const y = 40;
  fireEvent.pointerDown(行面, { clientX: 起x, clientY: y });
  for (let 走 = 20; 走 <= Math.abs(位移); 走 += 20) {
    fireEvent.pointerMove(行面, { clientX: 起x - 走, clientY: y });
  }
  fireEvent.pointerUp(行面, { clientX: 起x + 位移, clientY: y });
  // 关键：mousedown 与 mouseup 落在同一棵子树，浏览器一定会再补一个 click
  fireEvent.click(行面, { clientX: 起x + 位移, clientY: y });
}

describe('滑动行 · 手势合同', () => {
  it('鼠标左滑越过半个操作区：请求打开，且随后合成的 click 不会把它关回去', () => {
    const { 请求打开, 按下, 行面 } = 渲染();
    鼠标左滑(行面, -220);
    expect(请求打开.mock.calls).toEqual([[true]]);
    expect(按下).not.toHaveBeenCalled();
  });

  it('已打开的行再左滑一次，也不会被尾随 click 关掉', () => {
    const { 请求打开, 按下, 行面 } = 渲染({ 打开: true });
    鼠标左滑(行面, -220);
    expect(请求打开.mock.calls).toEqual([[true]]);
    expect(按下).not.toHaveBeenCalled();
  });

  it('普通点按（行关着）仍然触发 按下', async () => {
    const 用户 = userEvent.setup();
    const { 请求打开, 按下, 行面 } = 渲染();
    await 用户.click(行面);
    expect(按下).toHaveBeenCalledOnce();
    expect(请求打开).not.toHaveBeenCalled();
  });

  it('普通点按（行开着）仍然只收起，不进详情', async () => {
    const 用户 = userEvent.setup();
    const { 请求打开, 按下, 行面 } = 渲染({ 打开: true });
    await 用户.click(行面);
    expect(请求打开.mock.calls).toEqual([[false]]);
    expect(按下).not.toHaveBeenCalled();
  });

  it('纵向拖拽不产生横向效果，也不吞掉后面的点击', async () => {
    const 用户 = userEvent.setup();
    const { 请求打开, 按下, 行面 } = 渲染();
    fireEvent.pointerDown(行面, { clientX: 100, clientY: 10 });
    fireEvent.pointerMove(行面, { clientX: 102, clientY: 90 });
    fireEvent.pointerUp(行面, { clientX: 102, clientY: 200 });
    expect(请求打开).not.toHaveBeenCalled();

    // 纵向手势没有武装抑制，后面这一次真点击必须照常生效
    await 用户.click(行面);
    expect(按下).toHaveBeenCalledOnce();
  });

  it('横向手势的抑制只吞一次，不泄漏到下一次点击', async () => {
    const 用户 = userEvent.setup();
    const { 按下, 行面 } = 渲染();
    鼠标左滑(行面, -220);
    expect(按下).not.toHaveBeenCalled();
    await 用户.click(行面);
    expect(按下).toHaveBeenCalledOnce();
  });

  it('右滑越过半个操作区：请求收起，同样不被尾随 click 反转', () => {
    const { 请求打开, 按下, 行面 } = 渲染({ 打开: true });
    const 起x = 60;
    const y = 40;
    fireEvent.pointerDown(行面, { clientX: 起x, clientY: y });
    fireEvent.pointerMove(行面, { clientX: 起x + 40, clientY: y });
    fireEvent.pointerUp(行面, { clientX: 起x + 220, clientY: y });
    fireEvent.click(行面, { clientX: 起x + 220, clientY: y });
    expect(请求打开.mock.calls).toEqual([[false]]);
    expect(按下).not.toHaveBeenCalled();
  });

  it('传入 名称 时行面暴露该可访问名称（真实后端验收按名称定位这一行）', () => {
    render(
      <滑动行 操作={[{ 文字: '删除', 按下: vi.fn() }]} 打开={false} 请求打开={vi.fn()} 名称="浏览器验收临时简历.pdf">
        <div>一行内容</div>
      </滑动行>
    );
    expect(screen.getByRole('button', { name: '浏览器验收临时简历.pdf' })).toBeTruthy();
  });
});
