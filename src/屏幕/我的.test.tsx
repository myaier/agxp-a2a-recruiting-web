// 我的 Tab 身份投影测试：
// Backend 分支绝不泄漏 Mock 原型身份（沈亦舟 / 在职 · 保密求职中）—— 姓名缺省给
// 「未填写姓名」，简历快照缺失给「资料暂不可用」，快照在但 status 为空给
// 「未填写求职状态」（不用表单默认「在职」充数）；头像首字只取权威姓名。
// Mock 分支逐字保留原型文案（防视觉漂移回归）。
//
// Backend MatchCase 真相源修复追加：四个统计数与代理卡的「正在跟进 N 个机会」
// 只读当前 candidate 主体的 unfiltered P5 open 快照（注册 scope + 权威统计），
// owner 不匹配一律 —，绝不回退 legacy 在谈列表 的 fixture 数字；Mock 保留原型统计
// 且零 P5 operation 调用。
//
// 注意：这里 mock 了 ../状态/应用状态（整模块被工厂替换），所以 初始状态 要从
// 它的原始定义处 ../状态/初始状态 引入，不能走 应用状态 的转发导出。

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { BFF简历, BFF主体 } from '../数据/BFF契约';
import { BFF简历样本, BFF主体样本 } from '../测试/BFF样本';
import { 初始状态 } from '../状态/初始状态';
import 我的 from './我的';
import { P5范围键 } from '../状态/后端/MatchCase操作';
import type { P5列表项 } from '../数据/招聘数据源/MatchCase';
import type { P5列表快照 } from '../状态/后端/类型';

// 稳定 operation spy：生产 Provider 的 操作 引用稳定，桩宿主同样给恒定表
const 设置P5范围 = vi.fn();
const 加载工作区 = vi.fn(async () => undefined);

interface 我的测试上下文 {
  状态: typeof 初始状态;
  派发: ReturnType<typeof vi.fn>;
  数据源模式: 'backend' | 'mock';
  操作: { 设置P5范围: typeof 设置P5范围; 加载工作区: typeof 加载工作区 };
  后端状态: {
    Agent规则水合: {
      candidate: { rules: '未开始'; proposals: '未开始' };
      recruiter: { rules: '未开始'; proposals: '未开始' };
    };
    简历快照: BFF简历 | null;
    主体: BFF主体 | null;
    P5工作区: Record<string, P5列表快照>;
  };
}

const mock上下文 = vi.hoisted(() => ({ 当前: null as 我的测试上下文 | null }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock上下文.当前 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: vi.fn() }) }));

// ── 完整 P5列表项 fixture（decoder 输出形状，不删字段）──
function 行(
  caseId: string,
  stage: P5列表项['state']['stage'],
  needsAction: boolean,
  lifecycle: P5列表项['state']['lifecycle'] = 'open',
): P5列表项 {
  return {
    role: 'candidate',
    state: {
      caseId, lifecycle, stage,
      status: lifecycle === 'open' ? 'running' : lifecycle === 'ended' ? 'ended' : 'passed',
      step: lifecycle === 'open' ? 'policy_check' : 'complete',
      round: 0, roundBudget: 3, needsUser: false,
      outcome: null, outcomeCode: null,
      createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T09:00:00Z',
      finalizedAt: lifecycle === 'open' ? null : '2026-09-01T10:00:00Z',
      agentAttention: null,
    },
    needsAction,
    intentionId: 'int_0123456789abcdef0123456789abcdef',
    job: {
      jobId: 'job_0123456789abcdef0123456789abcdef',
      job: { title: '后端工程师', location: '上海', publicSalaryRange: '20-30K', requiredSkills: ['Go'] },
    },
  };
}

function 成功P5快照(items: P5列表项[], nextCursor: string | null): P5列表快照 {
  return {
    ownerSubjectId: 'sub_candidate', 阶段: '成功', 刷新中: false,
    items, nextCursor, 已加载页数: 1, error: null, generation: 1,
  };
}

function 布置(
  模式: 'backend' | 'mock',
  选项: {
    真名?: string;
    身份?: '在校' | '在职' | '离职';
    服务端状态?: BFF简历['profile']['status'];
    主体?: BFF主体;
    P5快照?: P5列表快照;
  } = {},
) {
  mock上下文.当前 = {
    状态: {
      ...初始状态,
      基本信息: {
        ...初始状态.基本信息,
        真名: 选项.真名 ?? '',
        身份: 选项.身份 ?? '在职',
      },
    },
    派发: vi.fn(),
    数据源模式: 模式,
    操作: { 设置P5范围, 加载工作区 },
    后端状态: {
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      简历快照: 选项.服务端状态 === undefined
        ? null
        : {
            ...BFF简历样本,
            profile: { ...BFF简历样本.profile, status: 选项.服务端状态 },
          },
      主体: 模式 === 'backend' ? (选项.主体 ?? BFF主体样本) : null,
      P5工作区: 选项.P5快照 === undefined
        ? {}
        : { [P5范围键.open('candidate', null)]: 选项.P5快照 },
    },
  };
  return render(<我的 />);
}

beforeEach(() => {
  设置P5范围.mockClear();
  加载工作区.mockClear();
});

it('Backend 空简历显示中性占位且不泄漏 Mock 身份', () => {
  布置('backend');
  expect(screen.getByText('未填写姓名')).toBeTruthy();
  expect(screen.getByText('资料暂不可用')).toBeTruthy();
  expect(screen.queryByText('沈亦舟')).toBeNull();
  expect(screen.queryByText('在职 · 保密求职中')).toBeNull();
  const 头像行 = screen.getByRole('button', { name: /未填写姓名/ });
  expect(头像行.textContent?.startsWith('未未填写姓名')).toBe(false);
});

it('Backend 已水合但服务端 status 为空时不采用表单默认在职', () => {
  布置('backend', { 服务端状态: '' });
  expect(screen.getByText('未填写求职状态')).toBeTruthy();
  expect(screen.queryByText('在职')).toBeNull();
});

it('Backend 已水合简历只显示非空权威姓名与身份', () => {
  布置('backend', { 真名: '林澈', 身份: '离职', 服务端状态: 'unemployed' });
  expect(screen.getByText('林澈')).toBeTruthy();
  expect(screen.getByText('离职')).toBeTruthy();
  expect(screen.queryByText(/保密求职中/)).toBeNull();
});

it('Mock 保留原型姓名与状态兜底', () => {
  布置('mock');
  expect(screen.getByText('沈亦舟')).toBeTruthy();
  expect(screen.getByText('在职 · 保密求职中')).toBeTruthy();
});

it('Backend 注册 candidate unfiltered scope 并只显示权威统计', async () => {
  const scope = P5范围键.open('candidate', null);
  const { unmount } = 布置('backend', {
    主体: { ...BFF主体样本, subject_id: 'sub_candidate', last_used_role: 'candidate' },
    P5快照: 成功P5快照([
      行('mc_1', 'anonymous_screening', true),
      行('mc_2', 'needs_coordination', false),
    ], null),
  });
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getAllByText('1')).toHaveLength(2);
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.getByText(/正在跟进 2 个机会/)).toBeTruthy();
  await waitFor(() => expect(设置P5范围).toHaveBeenCalledWith('candidate', scope));
  expect(加载工作区).toHaveBeenCalledWith('candidate', null);
  unmount();
  expect(设置P5范围).toHaveBeenLastCalledWith('candidate', null);
});

it('Backend 旧 owner 显示 —，绝不回退 legacy 数字', () => {
  布置('backend', {
    主体: { ...BFF主体样本, subject_id: 'sub_new', last_used_role: 'candidate' },
    P5快照: { ...成功P5快照([行('mc_1', 'anonymous_screening', true)], null), ownerSubjectId: 'sub_old' },
  });
  expect(screen.queryByText('8')).toBeNull();
  expect(screen.queryByText('5')).toBeNull();
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
});

it('Mock 保留原统计且不调用 P5 operation', () => {
  布置('mock');
  expect(加载工作区).not.toHaveBeenCalled();
  expect(设置P5范围).not.toHaveBeenCalled();
  expect(screen.getByText(String(初始状态.在谈列表.length))).toBeTruthy();
});