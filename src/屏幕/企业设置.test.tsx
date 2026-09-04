// Task 4：企业设置（招聘端设置）回归测试。
// 招聘端没有手机号行：Backend 模式零 P8 读取（凭证/会话/账号范围登记都不发起）；
// 账号与安全入口与退出登录（含确认弹层、成功后回登录页）保持既有行为。
// P0 Task 5 起「企业实名认证」行双分支：Backend 走 取企业认证状态文案（affiliation/申请
// 事实，自填的 未认证公司声明 永不构成认证），Mock 仍是自家人脸原型认证流的下游表达。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业设置 from './企业设置';
import { 路径 } from '../路由/路径表';
import type { P8Credential, P8Session } from '../数据/招聘数据源/P8控制面';
import type { P8资源快照 } from '../状态/后端/类型';
import { BFF企业关系样本, BFF企业管理员申请样本 } from '../测试/BFF样本';

const 导航 = vi.hoisted(() => ({ 返回: vi.fn(), 跳转: vi.fn(), 替换跳转: vi.fn() }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => 导航 }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

function 空快照<T>(): P8资源快照<T> {
  return { phase: 'idle', refreshing: false, data: null, error: null, generation: 0 };
}

/** P8 六法 + 退出登录 + 管理员申请读取 桩：全表补齐，断言零调用用。 */
function 操作桩() {
  return {
    设置P8账号范围: vi.fn(),
    加载P8凭证: vi.fn(async () => undefined),
    加载P8会话: vi.fn(async () => undefined),
    开始P8手机号换绑: vi.fn(),
    完成P8手机号换绑: vi.fn(),
    退出P8其他设备: vi.fn(),
    退出登录: vi.fn(async () => undefined),
    读取企业管理员申请: vi.fn().mockResolvedValue(undefined),
  };
}

/** 组织事实默认空：认证文案只由 affiliation/申请 决定 */
function 组织状态桩(覆盖: Record<string, unknown> = {}) {
  return {
    企业关系列表: [],
    当前企业关系编号: null,
    企业管理员申请列表: [],
    未认证公司声明: '',
    ...覆盖,
  };
}

/** Mock 模式的状态：只带 企业认证 fixture（Mock 有自己的认证流程，见 企业实名认证 的人脸原型） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function 置Mock(操作: any, 企业认证 = { 姓名: '邵铭', 公司: '云衢科技', 职务: '技术 VP' }) {
  mock应用状态 = {
    数据源模式: 'mock',
    状态: { ...组织状态桩(), 企业认证 },
    后端状态: { credentials: 空快照<P8Credential[]>(), sessions: 空快照<P8Session[]>() },
    操作,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function 置Backend(操作: any, 状态覆盖: Record<string, unknown> = {}) {
  mock应用状态 = {
    数据源模式: 'backend',
    状态: 组织状态桩(状态覆盖),
    后端状态: { credentials: 空快照<P8Credential[]>(), sessions: 空快照<P8Session[]>() },
    操作,
  };
}

function 认证行文案() {
  const 行 = screen.getByText('企业实名认证').closest('div');
  return 行?.textContent?.replace('企业实名认证', '') ?? '';
}

beforeEach(() => {
  导航.返回.mockClear();
  导航.跳转.mockClear();
  导航.替换跳转.mockClear();
});

describe('企业设置 · P8 回归', () => {
  it('Backend 模式没有手机号行，零 P8 读取', () => {
    const 操作 = 操作桩();
    置Backend(操作);
    render(<MemoryRouter><企业设置 /></MemoryRouter>);
    expect(screen.getByText('企业实名认证')).toBeTruthy();
    expect(screen.queryByText('手机号')).toBeNull();
    expect(screen.queryByText('138 **** 6021')).toBeNull();
    expect(操作.设置P8账号范围).not.toHaveBeenCalled();
    expect(操作.加载P8凭证).not.toHaveBeenCalled();
    expect(操作.加载P8会话).not.toHaveBeenCalled();
  });

  it('账号与安全入口与退出登录保持原样（成功后回登录页，全程零 P8 读取）', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 操作桩();
    置Backend(操作);
    render(<MemoryRouter><企业设置 /></MemoryRouter>);

    await 用户.click(screen.getByRole('button', { name: /账号与安全/ }));
    expect(导航.跳转).toHaveBeenCalledWith(路径.账号安全);

    await 用户.click(screen.getByRole('button', { name: '退出登录' }));
    expect(screen.getByText('退出当前账号？')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '退出登录' })).toHaveLength(1);
    const 确认键 = screen.getByRole('button', { name: '确认退出企业账号' });
    expect(确认键.textContent).toBe('退出登录');
    const 名字们 = screen.getAllByRole('button').map(
      (键) => 键.getAttribute('aria-label') ?? 键.textContent ?? '',
    );
    expect(名字们.filter((名) => 名.includes('确认退出企业账号'))).toHaveLength(1);
    await 用户.click(确认键);
    await waitFor(() => expect(操作.退出登录).toHaveBeenCalledTimes(1));
    expect(导航.替换跳转).toHaveBeenCalledWith(路径.登录);

    expect(操作.设置P8账号范围).not.toHaveBeenCalled();
    expect(操作.加载P8凭证).not.toHaveBeenCalled();
    expect(操作.加载P8会话).not.toHaveBeenCalled();
  });
});

describe('企业设置 · 企业实名认证状态只反映组织事实', () => {
  const verified关系 = BFF企业关系样本;

  it('读取未落定时显示 正在读取，不预判 已认证', () => {
    const 操作 = 操作桩();
    let 放行!: () => void;
    操作.读取企业管理员申请.mockReturnValue(new Promise<void>((ok) => { 放行 = () => ok(); }));
    置Backend(操作, { 企业关系列表: [verified关系], 当前企业关系编号: verified关系.affiliation_id });
    render(<MemoryRouter><企业设置 /></MemoryRouter>);
    expect(screen.getByText('正在读取')).toBeTruthy();
    expect(screen.queryByText('已认证')).toBeNull();
    放行();
  });

  it.each([
    [
      '已认证',
      { 企业关系列表: [verified关系], 当前企业关系编号: verified关系.affiliation_id },
    ],
    [
      '审核中',
      { 企业管理员申请列表: [{ ...BFF企业管理员申请样本, status: 'pending' }] },
    ],
    [
      '已拒绝',
      { 企业管理员申请列表: [{ ...BFF企业管理员申请样本, status: 'rejected' }] },
    ],
    [
      '已撤销',
      { 企业管理员申请列表: [{ ...BFF企业管理员申请样本, status: 'cancelled' }] },
    ],
    [
      '已解除',
      { 企业关系列表: [{ ...verified关系, status: 'revoked' }] },
    ],
    ['未认证', {}],
  ])('读取成功后显示 %s', async (期望, 状态覆盖) => {
    const 操作 = 操作桩();
    置Backend(操作, 状态覆盖);
    render(<MemoryRouter><企业设置 /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(期望)).toBeTruthy());
    expect(操作.读取企业管理员申请).toHaveBeenCalledTimes(1);
  });

  it('读取失败显示 读取失败，不退回硬编码 已认证', async () => {
    const 操作 = 操作桩();
    操作.读取企业管理员申请.mockRejectedValue(new Error('网络断开'));
    置Backend(操作, {});
    render(<MemoryRouter><企业设置 /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('读取失败')).toBeTruthy());
    expect(screen.queryByText('已认证')).toBeNull();
  });

  it('只改 未认证公司声明 绝不产生 已认证', async () => {
    const 操作 = 操作桩();
    置Backend(操作, { 未认证公司声明: '上海云衢科技有限公司' });
    render(<MemoryRouter><企业设置 /></MemoryRouter>);
    await waitFor(() => expect(认证行文案()).toBe('未认证'));
    expect(screen.queryByText('已认证')).toBeNull();
    expect(screen.queryByText('上海云衢科技有限公司')).toBeNull();
  });
});

describe('企业设置 · Mock 认证流程的下游表达不被 Backend 投影顶掉', () => {
  it('Mock 走完人脸原型（企业认证 已落库）后仍显示 已认证，且不读管理员申请', async () => {
    const 操作 = 操作桩();
    置Mock(操作);
    render(<MemoryRouter><企业设置 /></MemoryRouter>);
    expect(认证行文案()).toBe('已认证');
    expect(操作.读取企业管理员申请).not.toHaveBeenCalled();
    // 不是异步态：Mock 分支从不进入 正在读取/读取失败
    expect(screen.queryByText('正在读取')).toBeNull();
    await waitFor(() => expect(认证行文案()).toBe('已认证'));
  });

  it('Mock 空账号（企业认证.公司 为空）如实显示 未认证', () => {
    const 操作 = 操作桩();
    置Mock(操作, { 姓名: '', 公司: '', 职务: '' });
    render(<MemoryRouter><企业设置 /></MemoryRouter>);
    expect(认证行文案()).toBe('未认证');
  });

  it('Mock 不读 affiliation/申请 事实：组织态为空也不影响 已认证', () => {
    const 操作 = 操作桩();
    置Mock(操作);
    render(<MemoryRouter><企业设置 /></MemoryRouter>);
    expect(screen.queryByText('未认证')).toBeNull();
  });
});

describe('企业设置 · 申请读取失败不掩盖本地权威的 已认证', () => {
  it('current 是 verified+active 时，读取失败仍显示 已认证', async () => {
    const 操作 = 操作桩();
    操作.读取企业管理员申请.mockRejectedValue(new Error('网络断开'));
    置Backend(操作, {
      企业关系列表: [BFF企业关系样本],
      当前企业关系编号: BFF企业关系样本.affiliation_id,
    });
    render(<MemoryRouter><企业设置 /></MemoryRouter>);
    await waitFor(() => expect(认证行文案()).toBe('已认证'));
    expect(screen.queryByText('读取失败')).toBeNull();
  });

  it('没有 current 可用关系时，读取失败仍如实显示 读取失败', async () => {
    const 操作 = 操作桩();
    操作.读取企业管理员申请.mockRejectedValue(new Error('网络断开'));
    置Backend(操作, { 企业关系列表: [{ ...BFF企业关系样本, status: 'revoked' }] });
    render(<MemoryRouter><企业设置 /></MemoryRouter>);
    await waitFor(() => expect(认证行文案()).toBe('读取失败'));
    expect(screen.queryByText('已解除')).toBeNull();
  });
});

// Backend 只收三项闭合产品反馈，入口名如实叫「产品反馈」；Mock 保留「反馈与举报」。
// 跳转目标都是现有 /feedback 屏。
describe('企业设置 · 反馈入口按模式命名', () => {
  it('Backend 关于组入口叫 产品反馈，不出现 反馈与举报', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 操作桩();
    置Backend(操作);
    render(<MemoryRouter><企业设置 /></MemoryRouter>);
    expect(screen.queryByText('反馈与举报')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: /产品反馈/ }));
    expect(导航.跳转).toHaveBeenCalledWith(路径.反馈);
  });

  it('Mock 关于组入口仍叫 反馈与举报', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 操作桩();
    置Mock(操作);
    render(<MemoryRouter><企业设置 /></MemoryRouter>);
    await 用户.click(screen.getByRole('button', { name: /反馈与举报/ }));
    expect(导航.跳转).toHaveBeenCalledWith(路径.反馈);
  });
});
