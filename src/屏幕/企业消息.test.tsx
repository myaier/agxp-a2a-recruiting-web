// 企业消息 · 真人会话行 S3 门控契约（review-r1）：候选人真名在 S1 原件递交后即写入初始 Mock，
// 但真人会话行只应在双方意向确认（S3）后才出现。用 真名 !== null 当 S3 信号会让 S1/S2 候选
// 顶着一个真名行提前进入 /hr/chat。这里断言门控落在 S3 完成事实上。

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import 企业消息 from './企业消息';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: vi.fn() }) }));

function 候选(覆盖: Partial<{ 真名: string | null; 阶段: string; 辅助文案: string | null }>) {
  return {
    编号: 'A-01', 岗位编号: 'P-01', 代号: '陈屿', 真名: '沈亦舟', 头像字: '陈',
    阶段: '需要协调', 轮次: '第 2 轮', 下一步: '', 辅助文案: null, 需要你: true,
    分歧: null, 匹配分: 94, 画像: '9 年 · Go / 高并发交易 · 字节跳动',
    ...覆盖,
  };
}

describe('企业消息 · 真人会话行门控', () => {
  it('S2 候选（真名已披露但未确认意向）不出现真人会话行', () => {
    mock应用状态 = { 状态: { 企业候选列表: [候选({ 真名: '沈亦舟', 阶段: '需要协调', 辅助文案: null })], 企业消息未读: {} }, 派发: vi.fn() };
    render(<企业消息 />);
    // H-02 真人行的标题是「沈亦舟」，S2 不应出现
    expect(screen.queryByText('沈亦舟')).toBeNull();
  });

  it('S3 完成后才出现真人会话行', () => {
    mock应用状态 = {
      状态: { 企业候选列表: [候选({ 真名: '沈亦舟', 阶段: '意向确认', 辅助文案: '去消息页私聊' })], 企业消息未读: {} },
      派发: vi.fn(),
    };
    render(<企业消息 />);
    expect(screen.getByText('沈亦舟')).toBeTruthy();
  });
});