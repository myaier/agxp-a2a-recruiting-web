// 详情动作卡 · 无 Provider 展示测试（契约 A）：阶段动作区的纯展示卡只吃 详情动作卡信息，
// 标题/说明/正文/按钮全部由控制层给定，本组件不做任何业务推导（不读 Context/fixture、
// 不判断权限、不发请求）。按钮铁律：执行!==null 且 禁用说明===null 才可触发；否则真实
// disabled，禁用说明可见并经 aria-describedby 关联到按钮 —— 不靠文案变灰冒充禁用，
// 也不把禁用说明塞进按钮名（无障碍名保持控制层给定文案）。
// 仓库未装 @testing-library/jest-dom，用 toBeTruthy / .disabled 属性断言。

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { 详情动作卡 } from './详情动作卡';
import 样式 from './详情动作卡.module.css';
import type { 详情按钮, 详情动作卡信息 } from './类型';

function 键(覆盖: Partial<详情按钮> = {}): 详情按钮 {
  return { 键: '结束初筛', 文案: '确认结束', 外观: '次要', 禁用说明: null, 执行: vi.fn(), ...覆盖 };
}

function 卡信息(覆盖: Partial<详情动作卡信息> = {}): 详情动作卡信息 {
  return { 键: 'end_screening', 标题: '结束初筛', 说明: '结束本次匿名初筛', 按钮们: [键()], ...覆盖 };
}

describe('详情动作卡 · 结构', () => {
  it('标题/说明/正文原样渲染：内容全由信息给定，无第二来源', () => {
    render(<详情动作卡 信息={卡信息({ 正文: <div>正文槽位</div> })} />);
    expect(screen.getByText('结束初筛')).toBeTruthy();
    expect(screen.getByText('结束本次匿名初筛')).toBeTruthy();
    expect(screen.getByText('正文槽位')).toBeTruthy();
  });

  it('说明 null：说明行退场，卡本体仍在（不编造说明）', () => {
    render(<详情动作卡 信息={卡信息({ 说明: null })} />);
    expect(screen.queryByText('结束本次匿名初筛')).toBeNull();
    expect(screen.getByText('结束初筛')).toBeTruthy();
  });

  it('按钮们为空：零按钮（fail closed 的零控件卡），标题说明仍在', () => {
    render(<详情动作卡 信息={卡信息({ 按钮们: [] })} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('结束初筛')).toBeTruthy();
  });

  it('多按钮按给定顺序渲染，各自独立禁用', () => {
    render(
      <详情动作卡
        信息={卡信息({
          按钮们: [键({ 键: 'a', 文案: '通过初筛' }), 键({ 键: 'b', 文案: '不合适', 执行: null })],
        })}
      />,
    );
    const 按钮们 = screen.getAllByRole('button');
    expect(按钮们.map((按钮) => 按钮.textContent)).toEqual(['通过初筛', '不合适']);
    expect((按钮们[0] as HTMLButtonElement).disabled).toBe(false);
    expect((按钮们[1] as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('详情动作卡 · 按钮铁律（契约 A）', () => {
  it('执行非空且禁用说明为 null：可触发，点击只调一次回调', () => {
    const 执行 = vi.fn();
    render(<详情动作卡 信息={卡信息({ 按钮们: [键({ 执行 })] })} />);
    fireEvent.click(screen.getByRole('button', { name: '确认结束' }));
    expect(执行).toHaveBeenCalledTimes(1);
  });

  it('禁用说明非空：真实 disabled，点击零回调，说明可见且经 aria-describedby 关联', () => {
    const 执行 = vi.fn();
    render(
      <详情动作卡 信息={卡信息({ 按钮们: [键({ 禁用说明: '正在提交，请稍候', 执行 })] })} />,
    );
    const 按钮 = screen.getByRole('button', { name: '确认结束' }) as HTMLButtonElement;
    expect(按钮.disabled).toBe(true);
    fireEvent.click(按钮);
    expect(执行).not.toHaveBeenCalled();
    const 说明id = 按钮.getAttribute('aria-describedby');
    expect(说明id).not.toBeNull();
    expect(说明id === null ? null : document.getElementById(说明id)?.textContent).toBe(
      '正在提交，请稍候',
    );
  });

  it('执行为 null 且无禁用说明：仍真实 disabled，但不出说明文本', () => {
    render(<详情动作卡 信息={卡信息({ 按钮们: [键({ 执行: null })] })} />);
    const 按钮 = screen.getByRole('button', { name: '确认结束' }) as HTMLButtonElement;
    expect(按钮.disabled).toBe(true);
    expect(按钮.getAttribute('aria-describedby')).toBeNull();
  });

  it('三种外观各有样式位（主要/次要/危险），不出现无样式裸键', () => {
    render(
      <详情动作卡
        信息={{
          键: '多键',
          标题: '多键卡',
          说明: null,
          按钮们: [
            键({ 键: '主', 文案: '主键', 外观: '主要' }),
            键({ 键: '次', 文案: '次键', 外观: '次要' }),
            键({ 键: '险', 文案: '险键', 外观: '危险' }),
          ],
        }}
      />,
    );
    expect(screen.getByRole('button', { name: '主键' }).className).toContain(样式.主要);
    expect(screen.getByRole('button', { name: '次键' }).className).toContain(样式.次要);
    expect(screen.getByRole('button', { name: '险键' }).className).toContain(样式.危险);
  });
});
