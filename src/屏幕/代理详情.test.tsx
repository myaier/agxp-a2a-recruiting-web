// Backend MatchCase 精确统计：代理详情「正在代谈」只消费当前 owner 的已载 summary，
// 直达无快照显示 —，owner 不匹配同样 —；Mock 保持 legacy 在谈列表 长度且零
// summary operation 调用（相邻展示页不注册、不请求）。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 代理详情 from './代理详情';
import { BFF主体样本 } from '../测试/BFF样本';
import type { P5摘要快照 } from '../状态/后端/类型';
import { 初始状态 } from '../状态/初始状态';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const 设置P5范围 = vi.fn();
const 加载摘要 = vi.fn(async () => undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }) }));

// ── 当前 candidate owner 的权威 summary fixture（decoder 归一化形状）──
function 成功候选摘要(ownerSubjectId = 'sub_1'): P5摘要快照 {
  return {
    ownerSubjectId, 阶段: '成功', 刷新中: false,
    summary: {
      openTotal: 51,
      openAnonymousScreeningTotal: 17,
      openNeedsActionTotal: 9,
      endedTotal: 4,
      completedTotal: 3,
    },
    error: null,
    generation: 1,
  };
}

function 置应用状态(选项: {
  模式: 'backend' | 'mock';
  主体?: { subject_id: string; last_used_role: string } | null;
  P5摘要?: P5摘要快照;
}) {
  mock应用状态 = {
    状态: { ...初始状态, 全局规则: [], 意向级规则: [] },
    派发: mock派发,
    数据源模式: 选项.模式,
    操作: { 设置P5范围, 加载摘要 },
    后端状态: {
      主体: 选项.主体 === undefined
        ? { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'candidate' }
        : 选项.主体,
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      P5摘要: 选项.P5摘要 === undefined ? {} : { candidate: 选项.P5摘要 },
    },
  };
}

describe('代理详情 · Backend 权威 MatchCase 统计', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    设置P5范围.mockClear();
    加载摘要.mockClear();
  });

  it('已有 summary 时显示精确 open_total，且详情页不注册、不请求', () => {
    置应用状态({ 模式: 'backend', P5摘要: 成功候选摘要() });
    render(<MemoryRouter><代理详情 /></MemoryRouter>);
    expect(screen.getByText('51')).toBeTruthy();
    expect(screen.getByText('正在代谈')).toBeTruthy();
    expect(设置P5范围).not.toHaveBeenCalled();
    expect(加载摘要).not.toHaveBeenCalled();
  });

  it('直达无快照显示 —；owner 不匹配同样 —，legacy 数组绝不冒充', () => {
    置应用状态({ 模式: 'backend' });
    render(<MemoryRouter><代理详情 /></MemoryRouter>);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText(String(初始状态.在谈列表.length))).toBeNull();
  });

  it('Mock 仍显示 legacy 在谈列表长度且不调用 P5 operation', () => {
    置应用状态({ 模式: 'mock', 主体: null });
    render(<MemoryRouter><代理详情 /></MemoryRouter>);
    expect(screen.getByText(String(初始状态.在谈列表.length))).toBeTruthy();
    expect(设置P5范围).not.toHaveBeenCalled();
    expect(加载摘要).not.toHaveBeenCalled();
  });
});
