// 应用路由守卫测试（P0 修复 Task 2）：Backend 招聘方的落点只由两个水合阶段决定 ——
// 组织链聚合阶段报 成功 之后才解释 profile 阶段，缺失 → 注册流名片，成功 → 企业主壳；
// 组织链失败在受保护路径上换成恢复面（真实错误 + 重试 + 切换身份），绝不显示假空列表。
//
// 屏幕一律换成轻量桩：本文件只钉 应用.tsx 自己的守卫与导航决策，不把各屏的数据依赖
// 拖进路由用例（各屏行为由各自的测试覆盖）。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BFF主体样本 } from './测试/BFF样本';
import { 初始状态 } from './状态/初始状态';
import { 路径 } from './路由/路径表';
import type { 后端状态 } from './状态/后端/类型';
import { 创建空P4发现状态 } from './状态/后端/发现推荐操作';
import { 创建空P5MatchCase状态 } from './状态/后端/MatchCase操作';
import { 创建空P7会话状态 } from './状态/后端/真人会话操作';
import { 创建空P8控制面状态 } from './状态/后端/P8控制面操作';
import 应用 from './应用';

const mock应用状态 = vi.hoisted(() => vi.fn());
vi.mock('./状态/应用状态', () => ({ use应用状态: mock应用状态 }));

/** 路由落点桩：只证明「路由到了这一屏」，不带屏自身的数据依赖。 */
function 屏幕桩(名: string) {
  return { default: () => <div data-testid={`屏幕:${名}`}>{名}</div> };
}
vi.mock('./屏幕/登录', () => 屏幕桩('登录'));
vi.mock('./屏幕/选身份', () => 屏幕桩('选身份'));
vi.mock('./屏幕/主壳', () => 屏幕桩('主壳'));
vi.mock('./屏幕/企业主壳', () => 屏幕桩('企业主壳'));
vi.mock('./屏幕/招聘名片', () => 屏幕桩('招聘名片'));
vi.mock('./屏幕/企业实名认证', () => 屏幕桩('企业实名认证'));
vi.mock('./屏幕/企业组织申请', () => 屏幕桩('企业组织申请'));
vi.mock('./屏幕/企业邀请加入', () => 屏幕桩('企业邀请加入'));
vi.mock('./屏幕/账号安全', () => 屏幕桩('账号安全'));
// 岗位管理桩保留它的「发布新岗位」入口：恢复面接管时这个按钮必须整个不存在
vi.mock('./屏幕/岗位管理', () => ({
  default: () => (
    <div data-testid="屏幕:岗位管理">
      <button type="button">发布新岗位</button>
    </div>
  ),
}));

const 招聘主体 = { ...BFF主体样本, last_used_role: 'recruiter' as const };

function 建后端状态(覆盖: Partial<后端状态> = {}): 后端状态 {
  return {
    初始化: '进行中', 已登录: false, 主体: null, 简历快照: null, 意向快照: {}, 岗位快照: {},
    隐私快照: null,
    候选规则快照: {}, 招聘规则快照: {}, 候选规则提案: {}, 招聘规则提案: {},
    Agent规则水合: {
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    },
    ...创建空P4发现状态(),
    ...创建空P5MatchCase状态(),
    ...创建空P7会话状态(),
    ...创建空P8控制面状态(),
    附件简历库: null,
    招聘方档案水合阶段: '未开始',
    招聘方组织水合: { 阶段: '未开始', 错误: null },
    ...覆盖,
  };
}

/**
 * Backend 模式的上下文值。屏幕已全部换成桩，应用 自身只消费
 * 操作.重新水合招聘方数据；两个招聘方恢复方法都显式给出，用例可整体替换 操作。
 */
function 后端应用值(后端覆盖: Partial<后端状态> = {}) {
  return {
    状态: 初始状态,
    派发: vi.fn(),
    数据源模式: 'backend' as const,
    后端状态: 建后端状态(后端覆盖),
    操作: {
      重新水合招聘方组织: vi.fn(async () => undefined),
      重新水合招聘方数据: vi.fn(async () => undefined),
    },
    目录查询: null,
  };
}

function 位置探针() {
  const 位置 = useLocation();
  return <span data-testid="pathname">{位置.pathname}</span>;
}

function 位置与状态探针() {
  const 位置 = useLocation();
  return (
    <>
      <span data-testid="pathname">{位置.pathname}</span>
      <span data-testid="location-state">{JSON.stringify(位置.state ?? null)}</span>
    </>
  );
}

/** 仓库未装 @testing-library/jest-dom：断言直接读 textContent / disabled。 */
function 当前路径(): string {
  return screen.getByTestId('pathname').textContent ?? '';
}

describe('应用路由：招聘方水合阶段决定落点', () => {
  beforeEach(() => {
    mock应用状态.mockReset();
  });

  it.each([
    ['缺失', 路径.招聘名片],
    ['成功', 路径.企业主壳],
  ] as const)('恢复 recruiter 且 profile %s 时进入 %s', async (阶段, 期望) => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成',
      已登录: true,
      主体: 招聘主体,
      招聘方档案水合阶段: 阶段,
      招聘方组织水合: { 阶段: '成功', 错误: null },
    }));
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(期望));
  });

  it('组织水合失败在登录路径显示真实错误和重试入口', async () => {
    const 重试 = vi.fn(async () => undefined);
    const 用户 = userEvent.setup();
    const 值 = 后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      招聘方档案水合阶段: '失败',
      招聘方组织水合: { 阶段: '失败', 错误: '企业资料读取失败' },
    });
    mock应用状态.mockReturnValue({
      ...值,
      操作: { ...值.操作, 重新水合招聘方数据: 重试 },
    });
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    expect(当前路径()).toBe(路径.登录);
    expect(screen.getByRole('alert').textContent).toContain('企业资料读取失败');

    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(重试).toHaveBeenCalledTimes(1);
    const 切换按钮 = screen.getByRole('button', { name: '切换身份' }) as HTMLButtonElement;
    await waitFor(() => expect(切换按钮.disabled).toBe(false));
    await 用户.click(切换按钮);
    expect(当前路径()).toBe(路径.选身份);
  });

  it('组织水合失败时直接岗位路径显示恢复面而不是假空列表', () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      招聘方组织水合: { 阶段: '失败', 错误: '企业资料读取失败' },
    }));
    render(
      <MemoryRouter initialEntries={[路径.岗位管理]}><应用 /><位置探针 /></MemoryRouter>,
    );
    expect(screen.getByRole('alert').textContent).toContain('企业资料读取失败');
    expect(screen.queryByRole('button', { name: '发布新岗位' })).toBeNull();
  });

  it('直接打开招聘端且 profile 缺失时 replace 到注册流名片', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      招聘方档案水合阶段: '缺失',
      招聘方组织水合: { 阶段: '成功', 错误: null },
    }));
    render(
      <MemoryRouter initialEntries={[路径.岗位管理]}><应用 /><位置与状态探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.招聘名片));
    expect(screen.getByTestId('location-state').textContent).toContain('从注册流');
  });

  it('已有 profile 直接编辑招聘名片时不被改送企业主壳', () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      招聘方档案水合阶段: '成功',
      招聘方组织水合: { 阶段: '成功', 错误: null },
    }));
    render(
      <MemoryRouter initialEntries={[路径.招聘名片]}><应用 /><位置探针 /></MemoryRouter>,
    );
    expect(当前路径()).toBe(路径.招聘名片);
  });

  it.each([
    路径.账号安全,
    路径.选身份,
    路径.招聘名片,
    路径.企业实名认证,
    路径.企业组织申请,
    路径.企业邀请加入,
  ])('缺失 profile 时放行恢复与退出路径 %s', (路径值) => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      招聘方档案水合阶段: '缺失',
      招聘方组织水合: { 阶段: '成功', 错误: null },
    }));
    render(
      <MemoryRouter initialEntries={[路径值]}><应用 /><位置探针 /></MemoryRouter>,
    );
    expect(当前路径()).toBe(路径值);
  });

  it('未知或缺失 last_used_role 保持现有身份选择兜底', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true,
      主体: { ...招聘主体, last_used_role: null },
    }));
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.选身份));
  });

  it('candidate 仍从登录路径落到求职主壳', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true,
      主体: { ...BFF主体样本, last_used_role: 'candidate' as const },
    }));
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.主壳));
  });
});
