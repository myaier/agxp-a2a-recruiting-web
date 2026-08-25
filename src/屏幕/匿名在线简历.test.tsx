// 匿名在线简历 · 身份显示规则契约（spec §3.2 / review-r3）：
// 招聘方视图只消费真名事实——真名非空即显示真名、还原公司实名，不等到 S3；
// 已确认（S3）只承担意向确认文案，不兼任披露权限。

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { 简历正文 } from './匿名在线简历';
import { 匿名简历表 } from '../数据/企业端模拟数据';

describe('简历正文 · 身份显示规则（spec §3.2）', () => {
  it('真名非空（S1）即显示真名与「已披露身份」，不等到 S3', () => {
    const 档 = 匿名简历表['A-01'];
    render(<简历正文 档={档} 真名="沈亦舟" 已确认={false} />);
    expect(screen.getByText('沈亦舟')).toBeTruthy();
    // 代号不应再作为大代号出现
    expect(screen.queryByText(档.代号)).toBeNull();
    expect(screen.getByText('已披露身份')).toBeTruthy();
  });

  it('真名为空（S0）仍显示代号与「匿名」', () => {
    const 档 = 匿名简历表['A-07'];
    render(<简历正文 档={档} />);
    expect(screen.getByText(档.代号)).toBeTruthy();
    expect(screen.getByText('匿名')).toBeTruthy();
  });

  it('S3 完成时页尾注说双方已确认意向，S1 已披露但未到 S3 时提示意向确认后进入真人沟通', () => {
    const 档 = 匿名简历表['A-01'];
    const { rerender } = render(<简历正文 档={档} 真名="沈亦舟" 已确认={false} />);
    expect(screen.getByText(/候选人身份已随 S1 原件披露/)).toBeTruthy();
    rerender(<简历正文 档={档} 真名="沈亦舟" 已确认={true} />);
    expect(screen.getByText('双方已确认意向，可进入真人沟通 · 内容不可转发')).toBeTruthy();
  });
});