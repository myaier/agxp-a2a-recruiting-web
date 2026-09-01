// 我的 Tab 身份投影测试：
// Backend 分支绝不泄漏 Mock 原型身份（沈亦舟 / 在职 · 保密求职中）—— 姓名缺省给
// 「未填写姓名」，简历快照缺失给「资料暂不可用」，快照在但 status 为空给
// 「未填写求职状态」（不用表单默认「在职」充数）；头像首字只取权威姓名。
// Mock 分支逐字保留原型文案（防视觉漂移回归）。
//
// 注意：这里 mock 了 ../状态/应用状态（整模块被工厂替换），所以 初始状态 要从
// 它的原始定义处 ../状态/初始状态 引入，不能走 应用状态 的转发导出。

import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { BFF简历 } from '../数据/BFF契约';
import { BFF简历样本 } from '../测试/BFF样本';
import { 初始状态 } from '../状态/初始状态';
import 我的 from './我的';

interface 我的测试上下文 {
  状态: typeof 初始状态;
  派发: ReturnType<typeof vi.fn>;
  数据源模式: 'backend' | 'mock';
  后端状态: {
    Agent规则水合: {
      candidate: { rules: '未开始'; proposals: '未开始' };
      recruiter: { rules: '未开始'; proposals: '未开始' };
    };
    简历快照: BFF简历 | null;
  };
}

const mock上下文 = vi.hoisted(() => ({ 当前: null as 我的测试上下文 | null }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock上下文.当前 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: vi.fn() }) }));

function 布置(
  模式: 'backend' | 'mock',
  选项: {
    真名?: string;
    身份?: '在校' | '在职' | '离职';
    服务端状态?: BFF简历['profile']['status'];
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
    },
  };
  return render(<我的 />);
}

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
