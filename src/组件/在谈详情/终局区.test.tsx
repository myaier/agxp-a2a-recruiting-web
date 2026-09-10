// 终局区 · 无 Provider 展示测试（契约 A）：终局摘要卡 + completed 移交行。
//   · 摘要三字段（结束语/原因/定格于）原样在场，值由控制层投影（本地时间归 mapper）；
//     摘要 null 不渲染终局卡；
//   · 移交行的「开始私聊」遵循契约 A 按钮铁律：执行!==null 且 禁用说明===null 才可触发，
//     否则真实 disabled 且禁用说明可见可访问 —— pending 只读零导航（spec §5），
//     ready 点击恰回调一次（导航坐标只来自控制层给定的执行回调）；
//   · 移交 null：整块缺席（非 completed 详情不挂未来按钮）。
// 仓库未装 @testing-library/jest-dom，用 toBeTruthy / disabled 属性断言。

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { 终局区 } from './终局区';
import type { 终局区信息 } from './类型';

const 摘要: 终局区信息['摘要'] = {
  结束语: 'user_ended',
  原因: 'user_ended',
  定格于: '2026-08-29 11:00',
};

describe('终局区 · 终局摘要', () => {
  it('结束语/原因/定格于 原样在场，标题「终局」', () => {
    render(<终局区 信息={{ 摘要, 移交: null }} />);
    expect(screen.getByText('终局')).toBeTruthy();
    expect(screen.getAllByText('user_ended').length).toBe(2); // 结束语 + 原因码（wire 原词）
    expect(screen.getByText('2026-08-29 11:00')).toBeTruthy(); // 定格于（已本地化，非 RFC3339）
  });

  it('摘要 null：终局卡不渲染（进行中详情不挂终局块）', () => {
    render(<终局区 信息={{ 摘要: null, 移交: null }} />);
    expect(screen.queryByText('终局')).toBeNull();
  });

  it('摘要与移交同在：两块都渲染（completed 终局的形态）', () => {
    render(
      <终局区
        信息={{
          摘要,
          移交: {
            说明: '真人会话已建立',
            开始私聊: { 键: '开始私聊', 文案: '开始私聊', 外观: '主要', 禁用说明: null, 执行: vi.fn() },
          },
        }}
      />,
    );
    expect(screen.getByText('终局')).toBeTruthy();
    expect(screen.getByText('真人会话已建立')).toBeTruthy();
    expect(screen.getByRole('button', { name: '开始私聊' })).toBeTruthy();
  });
});

describe('终局区 · 移交', () => {
  it('pending（执行 null）：开始私聊真实 disabled、说明可见，点击零回调', () => {
    const 执行 = vi.fn();
    render(
      <终局区
        信息={{
          摘要: null,
          移交: {
            说明: '双方已确认，正在创建会话',
            开始私聊: { 键: '开始私聊', 文案: '开始私聊', 外观: '主要', 禁用说明: '准备中', 执行: null },
          },
        }}
      />,
    );
    expect(screen.getByText('双方已确认，正在创建会话')).toBeTruthy();
    const 键 = screen.getByRole('button', { name: '开始私聊' }) as HTMLButtonElement;
    expect(键.disabled).toBe(true);
    expect(键.hasAttribute('disabled')).toBe(true);
    fireEvent.click(键);
    expect(执行).not.toHaveBeenCalled();
    expect(screen.getByText('准备中')).toBeTruthy(); // 禁用说明可见
    expect(键.getAttribute('aria-describedby')).toBeTruthy(); // 且可访问（关联到按钮）
  });

  it('ready（执行非空、无禁用说明）：可点击，恰回调一次', () => {
    const 执行 = vi.fn();
    render(
      <终局区
        信息={{
          摘要: null,
          移交: {
            说明: '真人会话已建立',
            开始私聊: { 键: '开始私聊', 文案: '开始私聊', 外观: '主要', 禁用说明: null, 执行 },
          },
        }}
      />,
    );
    const 键 = screen.getByRole('button', { name: '开始私聊' }) as HTMLButtonElement;
    expect(键.disabled).toBe(false);
    fireEvent.click(键);
    fireEvent.click(键);
    expect(执行).toHaveBeenCalledTimes(2); // 本组件不吞重复点击（锁归控制层语义之外）
  });

  it('移交 null：移交行与开始私聊一概缺席', () => {
    render(<终局区 信息={{ 摘要, 移交: null }} />);
    expect(screen.queryByRole('button', { name: '开始私聊' })).toBeNull();
    expect(screen.queryByText('双方已确认，正在创建会话')).toBeNull();
  });
});
