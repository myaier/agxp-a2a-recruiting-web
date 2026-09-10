// 简历选择层 · 无 Provider 展示测试（契约 C 的 简历选择属性）：S1 递交单选的纯展示层。
//   · 文件按控制层给定顺序（= 服务端顺序）渲染，本组件不重排；
//   · 单选不默认授权：初始无选中、确认键不可触发；选择只回传行的 键，绝不以文件名作身份
//    （同名不同键的两行各自可选中）；
//   · 取消键 / Escape / 遮罩都只走 取消 回调，确认零触发；
//   · 每行显示控制层给定的 状态文（解析状态等）与 禁用说明（可见且该行单选钮真实 disabled）；
//   · 确认键遵守 详情按钮 铁律：执行!==null 且 禁用说明===null 才可触发。
// 层不持任何 BFF 文件对象、不读 Context、不 import 控制模块；文案是 S1 递交口径
// （「选择递交简历」/「暂不递交」，不混 Plan 1 的委托话术）。仓库未装 @testing-library/jest-dom，
// 用 .disabled / toBeTruthy / queryBy* 断言。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { 简历选择层 } from './简历选择层';
import type { 简历选择属性 } from './类型';

function 文件行(覆盖: Partial<简历选择属性['文件们'][number]> = {}): 简历选择属性['文件们'][number] {
  return { 键: 'rf_1', 文件名: '简历_v1.pdf', 状态文: '识别完成', 禁用说明: null, ...覆盖 };
}

function 确认键(覆盖: Partial<简历选择属性['确认']> = {}): 简历选择属性['确认'] {
  return { 键: '选定这份', 文案: '选定这份', 外观: '主要', 禁用说明: null, 执行: vi.fn(), ...覆盖 };
}

function 属性(覆盖: Partial<简历选择属性> = {}): 简历选择属性 {
  return {
    职位名: '平台工程师',
    文件们: [
      文件行({ 键: 'rf_1', 文件名: '简历_v1.pdf' }),
      文件行({ 键: 'rf_2', 文件名: '简历_v2.pdf', 状态文: '正在识别' }),
      文件行({ 键: 'rf_3', 文件名: '项目集.pdf', 状态文: '识别失败 · 可重试' }),
    ],
    选中键: null,
    选择: vi.fn(),
    取消: vi.fn(),
    确认: 确认键({ 执行: null }),
    ...覆盖,
  };
}

describe('简历选择层 · 结构与顺序', () => {
  it('文件按给定顺序渲染（服务端顺序），每行显示文件名与状态文', () => {
    render(<简历选择层 {...属性()} />);
    const 单选们 = screen.getAllByRole('radio');
    expect(单选们).toHaveLength(3);
    const 行序 = 单选们.map((钮) => 钮.closest('label')?.textContent ?? '');
    expect(行序).toEqual([
      expect.stringContaining('简历_v1.pdf'),
      expect.stringContaining('简历_v2.pdf'),
      expect.stringContaining('项目集.pdf'),
    ]);
    // 状态文按行原样显示（控制层给什么显示什么，本层不推导解析状态）
    expect(screen.getByText('识别完成')).toBeTruthy();
    expect(screen.getByText('正在识别')).toBeTruthy();
  });

  it('递交口径文案：弹层标签 / 标题 / 职位名说明 / 暂不递交，不出现委托话术', () => {
    render(<简历选择层 {...属性()} />);
    expect(screen.getByRole('dialog', { name: '选择递交简历' })).toBeTruthy();
    expect(screen.getByText('选择这次递交的简历')).toBeTruthy();
    expect(screen.getByText(/本次 Case 是「平台工程师」/)).toBeTruthy();
    expect(screen.getByText(/仅对这一次递交生效，不会记住为默认/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '暂不递交' })).toBeTruthy();
    expect(screen.queryByText(/委托/)).toBeNull();
  });

  it('禁用说明非空：该行单选钮真实 disabled、说明在行内可见', () => {
    render(
      <简历选择层
        {...属性({
          文件们: [文件行({ 禁用说明: '正在识别，暂不能递交' })],
          确认: 确认键(),
        })}
      />,
    );
    const 钮 = screen.getByRole('radio') as HTMLInputElement;
    expect(钮.disabled).toBe(true);
    expect(screen.getByText('正在识别，暂不能递交')).toBeTruthy();
  });
});

describe('简历选择层 · 单选不默认授权', () => {
  it('初始无选中：无 radio 处于 checked；控制层未给执行（未授权）时确认键不可触发', async () => {
    const 用户 = userEvent.setup();
    const 确认执行 = vi.fn();
    render(<简历选择层 {...属性({ 确认: 确认键({ 执行: null }) })} />);
    expect(screen.getAllByRole('radio').every((钮) => (钮 as HTMLInputElement).checked === false)).toBe(true);
    const 确认 = screen.getByRole('button', { name: '选定这份' }) as HTMLButtonElement;
    expect(确认.disabled).toBe(true); // 执行为 null（未选中）→ 契约 A 铁律
    await 用户.click(确认);
    expect(确认执行).not.toHaveBeenCalled();
  });

  it('选择只回传行的键，不以文件名作身份；同名不同键的两行各自可选中', async () => {
    const 用户 = userEvent.setup();
    const 选择 = vi.fn();
    render(
      <简历选择层
        {...属性({
          文件们: [
            文件行({ 键: 'rf_a', 文件名: '简历.pdf', 状态文: '识别完成' }),
            文件行({ 键: 'rf_b', 文件名: '简历.pdf', 状态文: '正在识别' }),
          ],
          选择,
        })}
      />,
    );
    const 单选们 = screen.getAllByRole('radio');
    await 用户.click(单选们[1]!); // 第二行：同名不同键
    expect(选择).toHaveBeenCalledTimes(1);
    expect(选择).toHaveBeenCalledWith('rf_b'); // 键，不是「简历.pdf」
  });

  it('选中键只点亮对应键的行（controlled 单选）', () => {
    render(<简历选择层 {...属性({ 选中键: 'rf_2' })} />);
    const 状态 = screen.getAllByRole('radio').map((钮) => (钮 as HTMLInputElement).checked);
    expect(状态).toEqual([false, true, false]);
  });
});

describe('简历选择层 · 取消零提交', () => {
  it('取消键 / Escape / 遮罩都只走 取消，确认执行零触发', async () => {
    const 用户 = userEvent.setup();
    const 取消 = vi.fn();
    const 确认执行 = vi.fn();
    const 首次 = render(
      <简历选择层 {...属性({ 取消, 确认: 确认键({ 执行: 确认执行 }) })} />,
    );
    await 用户.click(screen.getByRole('button', { name: '暂不递交' }));
    expect(取消).toHaveBeenCalledTimes(1);
    expect(确认执行).not.toHaveBeenCalled();
    首次.unmount();

    const 第二 = render(
      <简历选择层 {...属性({ 取消, 确认: 确认键({ 执行: 确认执行 }) })} />,
    );
    await 用户.keyboard('{Escape}');
    expect(取消).toHaveBeenCalledTimes(2);
    expect(确认执行).not.toHaveBeenCalled();
    第二.unmount();

    const 第三 = render(
      <简历选择层 {...属性({ 取消, 确认: 确认键({ 执行: 确认执行 }) })} />,
    );
    await 用户.click(screen.getByRole('button', { name: '关闭选择递交简历' })); // 遮罩
    expect(取消).toHaveBeenCalledTimes(3);
    expect(确认执行).not.toHaveBeenCalled();
    第三.unmount();
  });
});

describe('简历选择层 · 确认键铁律（详情按钮）', () => {
  it('执行非空且禁用说明为 null：可触发，点击只调一次', async () => {
    const 用户 = userEvent.setup();
    const 执行 = vi.fn();
    render(<简历选择层 {...属性({ 确认: 确认键({ 执行 }) })} />);
    const 确认 = screen.getByRole('button', { name: '选定这份' }) as HTMLButtonElement;
    expect(确认.disabled).toBe(false);
    await 用户.click(确认);
    expect(执行).toHaveBeenCalledTimes(1);
  });

  it('禁用说明非空：真实 disabled，说明可见且经 aria-describedby 关联', () => {
    const 执行 = vi.fn();
    render(<简历选择层 {...属性({ 确认: 确认键({ 禁用说明: '正在递交，请稍候', 执行 }) })} />);
    const 确认 = screen.getByRole('button', { name: '选定这份' }) as HTMLButtonElement;
    expect(确认.disabled).toBe(true);
    const 说明id = 确认.getAttribute('aria-describedby');
    expect(说明id).not.toBeNull();
    expect(说明id === null ? null : document.getElementById(说明id)?.textContent).toBe('正在递交，请稍候');
  });
});
