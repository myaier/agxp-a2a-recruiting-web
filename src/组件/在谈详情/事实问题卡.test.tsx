// 事实问题卡 · 无 Provider 展示测试（契约 A）：S0 补充事实的纯展示卡。问题/草稿/改草稿/
// 提交全部由控制层（use后端详情动作 的 事实问题 返回）给定；提交按钮遵守 详情按钮 铁律
//（执行!==null 且 禁用说明===null 才可触发）。提交不可触发（在飞续锁等控制态）时回答框
// 同步锁定 —— 不出现「还能输入、已不能提交」的半开态；当前问题原样展示，不改写不推断。
// 仓库未装 @testing-library/jest-dom，用 toBeTruthy / .disabled 属性断言。

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { 事实问题卡 } from './事实问题卡';
import type { 事实问题属性 } from './类型';

function 属性(覆盖: Partial<事实问题属性> = {}): 事实问题属性 {
  return {
    问题: '每周可以到岗几天？',
    草稿: '',
    改草稿: vi.fn(),
    提交: { 键: '提交回答', 文案: '提交回答', 外观: '主要', 禁用说明: null, 执行: vi.fn() },
    ...覆盖,
  };
}

describe('事实问题卡 · 纯展示输入', () => {
  it('问题、回答框、提交键全在场：文案原样，控制层不改写不推断', () => {
    render(<事实问题卡 {...属性({ 草稿: '每周 3 天' })} />);
    expect(screen.getByText('问：每周可以到岗几天？')).toBeTruthy();
    const 框 = screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement;
    expect(框.value).toBe('每周 3 天');
    expect(screen.getByRole('button', { name: '提交回答' })).toBeTruthy();
  });

  it('改草稿只透传输入值；提交回调点击只发一次', () => {
    const 改草稿 = vi.fn();
    const 执行 = vi.fn();
    render(<事实问题卡 {...属性({ 改草稿, 提交: { ...属性().提交, 执行 } })} />);
    fireEvent.change(screen.getByRole('textbox', { name: '回答问题' }), { target: { value: '新草稿' } });
    expect(改草稿).toHaveBeenCalledWith('新草稿');
    fireEvent.click(screen.getByRole('button', { name: '提交回答' }));
    expect(执行).toHaveBeenCalledTimes(1);
  });
});

describe('事实问题卡 · 在飞锁定', () => {
  it('提交在飞（执行 null、无禁用说明）：按钮按给定文案（提交中…）真实 disabled，回答框同步锁定', () => {
    render(
      <事实问题卡
        {...属性({
          提交: { 键: '提交回答', 文案: '提交中…', 外观: '主要', 禁用说明: null, 执行: null },
        })}
      />,
    );
    const 键 = screen.getByRole('button', { name: '提交中…' }) as HTMLButtonElement;
    expect(键.disabled).toBe(true);
    expect((screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement).disabled).toBe(
      true,
    );
  });

  it('提交带禁用说明：说明可见并关联到按钮，回答区整体不可输入', () => {
    render(
      <事实问题卡
        {...属性({
          提交: {
            键: '提交回答',
            文案: '提交回答',
            外观: '主要',
            禁用说明: '上一条回答还在提交中',
            执行: null,
          },
        })}
      />,
    );
    const 按钮 = screen.getByRole('button', { name: '提交回答' }) as HTMLButtonElement;
    const 说明id = 按钮.getAttribute('aria-describedby');
    expect(说明id === null ? null : document.getElementById(说明id)?.textContent).toBe(
      '上一条回答还在提交中',
    );
    expect((screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement).disabled).toBe(
      true,
    );
  });
});
