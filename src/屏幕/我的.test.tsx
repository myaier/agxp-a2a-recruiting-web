// 我的 Tab 身份投影测试：
// Backend 分支绝不泄漏 Mock 原型身份（沈亦舟 / 在职 · 保密求职中）—— 姓名缺省给
// 「未填写姓名」，简历快照缺失给「资料暂不可用」，快照在但 status 为空给
// 「未填写求职状态」（不用表单默认「在职」充数）；头像首字只取权威姓名。
// Mock 分支逐字保留原型文案（防视觉漂移回归）。
//
// Backend MatchCase 精确统计追加：四个统计数与代理卡的 MatchCase 计数只读当前
// candidate owner 的 summary 精确统计（注册 summary scope + 挂载刷新），owner 不
// 匹配一律 —，绝不回退 legacy 在谈列表 的 fixture 数字；Mock 保留原型统计且零
// summary operation 调用。
//
// 真实性修复追加：Backend 代理卡没有 runtime presence/status 合同 —— 在线绿点与
// 「在线 · 正在跟进」断言删除，只说「当前 MatchCase：N」；占位运营页脚（热线/许可
// 证/资质证照）只在 Mock 渲染。规则数继续服从既有水合 gate。
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
import type { P5摘要快照 } from '../状态/后端/类型';

// 稳定 operation spy：生产 Provider 的 操作 引用稳定，桩宿主同样给恒定表
const 设置P5范围 = vi.fn();
const 加载摘要 = vi.fn(async () => undefined);

interface 我的测试上下文 {
  状态: typeof 初始状态;
  派发: ReturnType<typeof vi.fn>;
  数据源模式: 'backend' | 'mock';
  操作: { 设置P5范围: typeof 设置P5范围; 加载摘要: typeof 加载摘要 };
  后端状态: {
    Agent规则水合: {
      candidate: { rules: '未开始' | '成功'; proposals: '未开始' };
      recruiter: { rules: '未开始'; proposals: '未开始' };
    };
    简历快照: BFF简历 | null;
    主体: BFF主体 | null;
    P5摘要: { candidate?: P5摘要快照 };
  };
}

const mock上下文 = vi.hoisted(() => ({ 当前: null as 我的测试上下文 | null }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock上下文.当前 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: vi.fn() }) }));

// ── 当前 candidate owner 的权威 summary fixture（decoder 归一化形状）──
function 成功摘要(ownerSubjectId = 'sub_candidate'): P5摘要快照 {
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

function 布置(
  模式: 'backend' | 'mock',
  选项: {
    真名?: string;
    身份?: '在校' | '在职' | '离职';
    服务端状态?: BFF简历['profile']['status'];
    主体?: BFF主体;
    P5摘要?: P5摘要快照;
    规则水合?: '未开始' | '成功';
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
    操作: { 设置P5范围, 加载摘要 },
    后端状态: {
      Agent规则水合: {
        candidate: { rules: 选项.规则水合 ?? '未开始', proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      简历快照: 选项.服务端状态 === undefined
        ? null
        : {
            ...BFF简历样本,
            profile: { ...BFF简历样本.profile, status: 选项.服务端状态 },
          },
      主体: 模式 === 'backend' ? (选项.主体 ?? BFF主体样本) : null,
      P5摘要: 选项.P5摘要 === undefined ? {} : { candidate: 选项.P5摘要 },
    },
  };
  return render(<我的 />);
}

beforeEach(() => {
  设置P5范围.mockClear();
  加载摘要.mockClear();
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

it('Backend 注册 candidate summary scope，并保留原标题文案显示精确跨页统计', async () => {
  const scope = P5范围键.summary('candidate');
  const { unmount } = 布置('backend', {
    主体: { ...BFF主体样本, subject_id: 'sub_candidate', last_used_role: 'candidate' },
    P5摘要: 成功摘要(),
  });
  for (const text of ['51', '17', '9', '7', '在谈', '初筛中', '待你拍', '已归档']) {
    expect(screen.getByText(text)).toBeTruthy();
  }
  expect(screen.getByText(/当前 MatchCase：51/)).toBeTruthy();
  await waitFor(() => expect(设置P5范围).toHaveBeenCalledWith('candidate', scope));
  expect(加载摘要).toHaveBeenCalledWith('candidate');
  unmount();
  expect(设置P5范围).toHaveBeenLastCalledWith('candidate', null);
});

it('刷新中或旧 owner 显示 —；Mock 保留原数字且零 summary operation', () => {
  布置('backend', {
    主体: { ...BFF主体样本, subject_id: 'sub_new', last_used_role: 'candidate' },
    P5摘要: { ...成功摘要('sub_old'), 阶段: '进行中', 刷新中: true, summary: null },
  });
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);

  设置P5范围.mockClear();
  加载摘要.mockClear();
  布置('mock');
  expect(screen.getByText(String(初始状态.在谈列表.length))).toBeTruthy();
  expect(设置P5范围).not.toHaveBeenCalled();
  expect(加载摘要).not.toHaveBeenCalled();
});

// Backend 没有 runtime presence/status 合同：代理卡不说「在线」，只说 MatchCase 事实；
// 占位运营页脚（热线/许可证/资质证照）只在 Mock 渲染。规则数服从既有水合 gate。
it('Backend 代理卡只说 MatchCase 事实，无在线断言与占位运营页脚', () => {
  const { unmount } = 布置('backend', {
    主体: { ...BFF主体样本, subject_id: 'sub_candidate', last_used_role: 'candidate' },
    P5摘要: 成功摘要(),
  });
  expect(screen.getByText(/当前 MatchCase：51/)).toBeTruthy();
  for (const text of ['在线', '并行寻访', '400-000-0000', '人力资源服务许可证', '资质证照']) {
    expect(screen.queryByText(new RegExp(text))).toBeNull();
  }
  // 规则未水合：不出规则计数
  expect(screen.queryByText(/规则 \d+ 条生效/)).toBeNull();
  unmount();
});

it('Backend 规则水合成功后显示当前 MatchCase 与已水合规则数', () => {
  布置('backend', {
    规则水合: '成功',
    主体: { ...BFF主体样本, subject_id: 'sub_candidate', last_used_role: 'candidate' },
    P5摘要: 成功摘要(),
  });
  expect(screen.getByText(/当前 MatchCase：51/)).toBeTruthy();
  expect(screen.getByText(/规则 \d+ 条生效/)).toBeTruthy();
});

it('Mock 保留原型在线文案与页脚', () => {
  布置('mock');
  expect(screen.getByText(/在线 · 正在跟进 \d+ 个机会/)).toBeTruthy();
  expect(screen.getByText(/服务热线 400-000-0000/)).toBeTruthy();
  expect(screen.getByText(/人力资源服务许可证/)).toBeTruthy();
});