// 谁接触过我 · Backend 权威快照渲染测试（Backend contact-events Plan Task 4）。
// Backend：只渲染当前 candidate 主体 成功 快照的 items（空页复用既有空态容器），
// 未开始/进行中/失败/owner 不匹配一律零业务行、零 Mock 公司；本次挂载触发一次
// 加载接触记录。Mock：继续渲染 接触记录列表 且零 operation 调用。
// 纯映射（动作语义 / 本地化绝对时间 / 公司首字）由导出的纯函数直接穷举。

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 接触记录, { 接触事件到展示, 格式化接触时间 } from './接触记录';
import { 接触记录列表 } from '../数据/模拟数据';
import { BFF主体样本 } from '../测试/BFF样本';
import type { 接触记录快照 } from '../状态/后端/类型';
import type { 接触事件 } from '../数据/招聘数据源/接触记录';

const mock返回 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回 }) }));

/** 稳定 operation spy：生产 Provider 的 操作 引用稳定，桩宿主同样给恒定表。 */
const 加载接触记录 = vi.fn(async () => undefined);

const 事件A: 接触事件 = {
  eventId: 'cev_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  organization: {
    organizationId: 'org_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    displayName: 'Acme',
  },
  action: 'contact_started',
  occurredAt: '2026-09-01T08:00:00Z',
};

/** 缺省 Backend 快照补全：稀疏测试对象会掩盖真实字段。 */
function 渲染Backend(patch: Partial<接触记录快照> = {}) {
  mock应用状态 = {
    数据源模式: 'backend',
    后端状态: {
      主体: { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'candidate' },
      接触记录: {
        ownerSubjectId: 'sub_1', 阶段: '成功', 刷新中: false,
        items: [], nextCursor: null, 已加载页数: 1,
        error: null, generation: 1,
        ...patch,
      },
    },
    操作: { 加载接触记录 },
  };
  return render(
    <MemoryRouter>
      <接触记录 />
    </MemoryRouter>,
  );
}

function 渲染Mock() {
  mock应用状态 = {
    数据源模式: 'mock',
    后端状态: {
      主体: null,
      接触记录: {
        ownerSubjectId: null, 阶段: '未开始', 刷新中: false,
        items: [], nextCursor: null, 已加载页数: 0,
        error: null, generation: 0,
      },
    },
    操作: { 加载接触记录 },
  };
  return render(
    <MemoryRouter>
      <接触记录 />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  加载接触记录.mockClear();
  mock返回.mockClear();
});

describe('接触记录 · Backend 权威快照', () => {
  it('空成功页显示空态且零 Mock 公司，挂载触发一次加载', async () => {
    渲染Backend({ 阶段: '成功', ownerSubjectId: 'sub_1', items: [], nextCursor: null });
    expect(screen.getByText('最近还没有企业接触过你')).toBeTruthy();
    expect(screen.queryByText(接触记录列表[0].公司)).toBeNull();
    expect(screen.queryByText(接触记录列表[1].公司)).toBeNull();
    await waitFor(() => expect(加载接触记录).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['anonymous_profile_viewed', '匿名画像被查看'],
    ['contact_started', '发起接触'],
    ['submitted_resume_viewed', '递交简历后查看'],
  ] as const)('%s 只映射为既有动作语义', (action, label) => {
    渲染Backend({ items: [{ ...事件A, action }], ownerSubjectId: 'sub_1', 阶段: '成功' });
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText('Acme')).toBeTruthy();
    // 合同外字段（招聘方人名等）没有入口，绝不出现
    expect(screen.queryByText('Alice Recruiter')).toBeNull();
  });

  it.each([
    ['未开始', { 阶段: '未开始' as const }],
    ['进行中', { 阶段: '进行中' as const }],
    ['失败', { 阶段: '失败' as const, error: '后端服务暂时不可用，请稍后重试' }],
    ['owner 不匹配', { ownerSubjectId: 'sub_2', 阶段: '成功' as const, items: [事件A] }],
  ])('%s 时渲染零业务行，不显示 Mock 公司，不冒充权威空结果', (_名, patch) => {
    渲染Backend(patch);
    expect(screen.queryByText(接触记录列表[0].公司)).toBeNull();
    expect(screen.queryByText('Acme')).toBeNull();
    // 中性状态：未知不是零 —— 空态文案只在当前 owner 的成功空快照下出现
    expect(screen.queryByText('最近还没有企业接触过你')).toBeNull();
  });

  it('仍有 nextCursor 时只显示已载窗口，不出现「加载更多」或全量承诺', () => {
    渲染Backend({ items: [事件A], nextCursor: 'cursor_2', 阶段: '成功', ownerSubjectId: 'sub_1' });
    expect(screen.getByText('Acme')).toBeTruthy();
    expect(screen.queryByText('加载更多')).toBeNull();
    expect(screen.queryByText('全部')).toBeNull();
  });
});

describe('接触记录 · Mock 分支', () => {
  it('Mock 继续渲染演示记录且 加载接触记录 零调用', () => {
    渲染Mock();
    expect(screen.getByText(接触记录列表[0].公司)).toBeTruthy();
    expect(screen.getByText(接触记录列表[4].公司)).toBeTruthy();
    expect(加载接触记录).not.toHaveBeenCalled();
  });
});

describe('接触记录 · 纯展示映射', () => {
  it('接触事件到展示 保留 wire 字段语义且公司首字取首个 Unicode 字符', () => {
    const 条 = 接触事件到展示(事件A);
    expect(条).toMatchObject({
      编号: 'cev_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      公司: 'Acme',
      公司首字: 'A',
      动作: '发起接触',
    });
    expect(条.时间).toContain('2026');
  });

  it.each([
    ['anonymous_profile_viewed', '匿名画像被查看'],
    ['contact_started', '发起接触'],
    ['submitted_resume_viewed', '递交简历后查看'],
  ] as const)('wire action %s 映射为既有页面动作 %s', (action, 动作) => {
    expect(接触事件到展示({ ...事件A, action }).动作).toBe(动作);
  });

  it('格式化接触时间 输出本地化绝对日期时间（含年份，非相对时间）', () => {
    const 文本 = 格式化接触时间('2026-09-01T08:00:00Z');
    expect(文本).toContain('2026');
    expect(文本).not.toContain('今天');
    expect(文本).not.toContain('昨天');
  });
});