// P7 Task 4：原始 PDF 层（从 P5/MatchCase详情 抽出）的 DOM 契约 ——
// role=dialog、PDF 徽标 + 文件名 + 关闭、<iframe title="简历 PDF"> 以租约地址
// 呈现真实字节；关闭回调生效。P5 与 P7 招聘端共用同一层，DOM 一致两处像素一致。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 原始PDF层 from './原始PDF层';

describe('原始PDF层', () => {
  it('渲染 dialog、文件名与 PDF iframe，关闭回调生效', async () => {
    const 用户 = userEvent.setup();
    const 关闭 = vi.fn();
    render(<原始PDF层 文件名="沈亦舟_简历_2026.pdf" 地址="blob:lease-1" 关闭={关闭} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('沈亦舟_简历_2026.pdf')).toBeTruthy();
    expect(screen.getByText('PDF')).toBeTruthy();
    const 框 = screen.getByTitle('简历 PDF') as HTMLIFrameElement;
    expect(框.getAttribute('src')).toBe('blob:lease-1');
    await 用户.click(screen.getByRole('button', { name: '关闭' }));
    expect(关闭).toHaveBeenCalledTimes(1);
  });
});
