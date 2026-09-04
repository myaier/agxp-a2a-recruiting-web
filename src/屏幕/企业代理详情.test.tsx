// Backend MatchCase 精确统计：企业代理详情「正在代谈」只消费当前 owner 的已载
// summary，直达无快照显示 —，owner 不匹配同样 —；企业候选列表（legacy fixture）
// 不再进入 Backend 展示；Mock 保持 legacy 长度且零 summary operation 调用。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业代理详情 from './企业代理详情';
import { BFF主体样本 } from '../测试/BFF样本';
import type { P5摘要快照 } from '../状态/后端/类型';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const 设置P5范围 = vi.fn();
const 加载摘要 = vi.fn(async () => undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }) }));

// ── 当前 recruiter owner 的权威 summary fixture（decoder 归一化形状）──
function 成功招聘摘要(ownerSubjectId = 'sub_r'): P5摘要快照 {
  return {
    ownerSubjectId, 阶段: '成功', 刷新中: false,
    summary: {
      openTotal: 52,
      openAnonymousScreeningTotal: 18,
      openNeedsActionTotal: 8,
      endedTotal: 6,
      completedTotal: 5,
    },
    error: null,
    generation: 1,
  };
}

function 置应用状态(选项: {
  模式: 'backend' | 'mock';
  主体?: { subject_id: string; last_used_role: string } | null;
  P5摘要?: P5摘要快照;
  企业候选列表?: unknown[];
}) {
  mock应用状态 = {
    状态: {
      企业规则: [],
      企业候选列表: 选项.企业候选列表 ?? [],
    },
    派发: mock派发,
    数据源模式: 选项.模式,
    操作: { 设置P5范围, 加载摘要 },
    后端状态: {
      主体: 选项.主体 === undefined
        ? { ...BFF主体样本, subject_id: 'sub_r', last_used_role: 'recruiter' }
        : 选项.主体,
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      P5摘要: 选项.P5摘要 === undefined ? {} : { recruiter: 选项.P5摘要 },
    },
  };
}

describe('企业代理详情 · Backend 权威 MatchCase 统计', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    设置P5范围.mockClear();
    加载摘要.mockClear();
  });

  it('已有 summary 时显示精确 open_total，且详情页不注册、不请求', () => {
    置应用状态({ 模式: 'backend', P5摘要: 成功招聘摘要() });
    render(<MemoryRouter><企业代理详情 /></MemoryRouter>);
    expect(screen.getByText('52')).toBeTruthy();
    expect(screen.getByText('正在代谈')).toBeTruthy();
    expect(设置P5范围).not.toHaveBeenCalled();
    expect(加载摘要).not.toHaveBeenCalled();
  });

  it('企业候选列表不进入 Backend 展示：无快照或 owner 不匹配显示 —', () => {
    置应用状态({
      模式: 'backend',
      企业候选列表: [{ 编号: 'A-01' }, { 编号: 'A-02' }, { 编号: 'A-03' }],
      P5摘要: 成功招聘摘要('sub_old'),
      主体: { ...BFF主体样本, subject_id: 'sub_new', last_used_role: 'recruiter' },
    });
    render(<MemoryRouter><企业代理详情 /></MemoryRouter>);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('3')).toBeNull();
    expect(screen.queryByText('52')).toBeNull();
  });

  it('Mock 仍显示 legacy 企业候选列表长度且不调用 P5 operation', () => {
    置应用状态({ 模式: 'mock', 主体: null, 企业候选列表: [{ 编号: 'A-01' }, { 编号: 'A-02' }] });
    render(<MemoryRouter><企业代理详情 /></MemoryRouter>);
    expect(screen.getByText('2')).toBeTruthy();
    expect(设置P5范围).not.toHaveBeenCalled();
    expect(加载摘要).not.toHaveBeenCalled();
  });
});
