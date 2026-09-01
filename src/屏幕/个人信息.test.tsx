// Task 6：个人信息屏账号手机号与披露联系方式的双模式行为测试。
//
// 账号手机号只来自 P8 唯一 phone_otp 凭证的服务端 display（登录凭证，不是披露联系方式）：
// Backend 挂载按需读取凭证一次（设置页同款投影，零会话请求、零账号范围登记），
// 读取中/失败/多行 phone_otp 一律中性占位（绝不挑第一条、绝不客户端重掩码）、
// 无 phone_otp 落「未绑定」；行只读，点击去账号与安全页，掩码绝不进可编辑组件状态。
// Backend 披露联系方式（简历披露手机号/邮箱/微信号）三行独立只读、固定「未接入」，
// 不读 Mock 联系方式切片、零「存联系方式」派发、零虚构 API；账号手机号绝不回填这三行。
// Mock 模式逐字节保留既有可编辑手机/邮箱/微信行为与本地派发，零 P8 读取。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 个人信息 from './个人信息';
import { 初始状态 } from '../状态/初始状态';
import { 路径 } from '../路由/路径表';
import type { P8Credential } from '../数据/招聘数据源/P8控制面';
import type { P8资源快照 } from '../状态/后端/类型';

const 导航 = vi.hoisted(() => ({ 返回: vi.fn(), 跳转: vi.fn(), 替换跳转: vi.fn() }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => 导航 }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

// ── P8 凭证 DTO 样本（已 decode 的归一化形状）──

function 手机凭证(display: string): P8Credential {
  return {
    credentialId: `cred_${display}`,
    provider: 'phone_otp',
    display,
    verifiedAt: '2026-08-20T10:00:00Z',
  };
}

const 微信凭证: P8Credential = {
  credentialId: 'cred_0000000000000002',
  provider: 'wechat',
  display: '微信 · 已绑定',
  verifiedAt: '2026-08-21T10:00:00Z',
};

function 空快照<T>(): P8资源快照<T> {
  return { phase: 'idle', refreshing: false, data: null, error: null, generation: 0 };
}

function 成功快照<T>(data: T): P8资源快照<T> {
  return { phase: 'success', refreshing: false, data, error: null, generation: 1 };
}

/** 组装 mock应用状态、渲染屏幕并返回操作/派发桩（断言用）。 */
function 环境(input: { 模式?: 'mock' | 'backend'; 凭证?: P8资源快照<P8Credential[]> } = {}) {
  const 操作 = {
    加载P8凭证: vi.fn(async () => undefined),
    保存简历: vi.fn(async () => undefined),
  };
  const 派发 = vi.fn();
  mock应用状态 = {
    状态: 初始状态,
    派发,
    操作,
    数据源模式: input.模式 ?? 'backend',
    后端状态: { credentials: input.凭证 ?? 空快照<P8Credential[]>() },
  };
  render(
    <MemoryRouter>
      <个人信息 />
    </MemoryRouter>,
  );
  return { 操作, 派发 };
}

beforeEach(() => {
  导航.返回.mockClear();
  导航.跳转.mockClear();
  导航.替换跳转.mockClear();
});

describe('个人信息 · Backend 账号手机号投影', () => {
  it('挂载读凭证一次，唯一 phone_otp 的服务端 display 原样上屏，行只读且点击跳账号与安全', async () => {
    const 用户 = userEvent.setup();
    const { 操作 } = 环境({ 凭证: 成功快照([手机凭证('138****5678'), 微信凭证]) });
    expect(操作.加载P8凭证).toHaveBeenCalledTimes(1);
    expect(screen.getByText('138****5678')).toBeTruthy();
    // 掩码只出现在账号手机号行：不进任何可编辑输入，也不重复上屏
    expect(screen.getAllByText('138****5678')).toHaveLength(1);
    expect(screen.queryByRole('textbox', { name: '账号手机号' })).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '账号手机号' }));
    expect(导航.跳转).toHaveBeenCalledWith(路径.账号安全);
  });

  it('凭证读取中落中性占位（不回退本地联系方式）', () => {
    环境({ 凭证: { ...空快照<P8Credential[]>(), phase: 'loading', refreshing: true } });
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('138******21')).toBeNull();
  });

  it('凭证读取失败同样落中性占位', () => {
    环境({
      凭证: {
        ...空快照<P8Credential[]>(),
        phase: 'error',
        error: '无法连接后端服务，请检查网络或稍后重试',
      },
    });
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('138******21')).toBeNull();
  });

  it('凭证成功但无 phone_otp 行时显示「未绑定」', () => {
    环境({ 凭证: 成功快照([微信凭证]) });
    expect(screen.getByText('未绑定')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('两条 phone_otp 视为异常：失败关闭为中性占位，绝不挑第一条', () => {
    环境({ 凭证: 成功快照([手机凭证('138****5678'), 手机凭证('139****9999')]) });
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('138****5678')).toBeNull();
    expect(screen.queryByText('139****9999')).toBeNull();
  });
});

describe('个人信息 · Backend 披露联系方式只读', () => {
  it('披露手机/邮箱/微信各一行独立「未接入」，无编辑入口，掩码绝不落在披露手机行', () => {
    环境({ 凭证: 成功快照([手机凭证('138****5678')]) });
    expect(screen.getAllByText('未接入')).toHaveLength(3);
    for (const 标签 of ['简历披露手机号', '微信号', '邮箱']) {
      const 行 = screen.getByText(标签).closest('div');
      expect(行?.textContent).toContain('未接入');
    }
    // 三行都不是可点按钮、没有对应输入
    expect(screen.queryByRole('button', { name: /简历披露手机号|微信号|邮箱/ })).toBeNull();
    expect(screen.queryByRole('textbox', { name: '简历披露手机号' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: '手机号' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: '微信号' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: '邮箱' })).toBeNull();
    // 服务端掩码只在账号手机号行，披露手机行不沾
    const 披露行 = screen.getByText('简历披露手机号').closest('div');
    expect(披露行?.textContent).not.toContain('138****5678');
  });

  it('Backend 全屏零「存联系方式」派发（本地联系方式切片不被写入）', async () => {
    const 用户 = userEvent.setup();
    const { 派发 } = 环境({ 凭证: 成功快照([手机凭证('138****5678')]) });
    // 唯一可点行是账号手机号（去账号安全），点它也不产生联系方式写入
    await 用户.click(screen.getByRole('button', { name: '账号手机号' }));
    expect(派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '存联系方式' }));
    expect(派发).not.toHaveBeenCalledWith({ 型: '存求职头像', 图: expect.anything() });
  });
});

describe('个人信息 · Mock 行为冻结', () => {
  it('手机/微信打码、邮箱常驻输入照旧，收笔派发存联系方式；零 P8 读取、零账号手机号行', async () => {
    const 用户 = userEvent.setup();
    const { 操作, 派发 } = 环境({ 模式: 'mock' });
    expect(screen.getByText('138******21')).toBeTruthy();
    expect(screen.getByText('she***88')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: '邮箱' })).toBeTruthy();
    // Mock 不出现 Backend 专属行与文案
    expect(screen.queryByText('账号手机号')).toBeNull();
    expect(screen.queryByText('未接入')).toBeNull();
    expect(操作.加载P8凭证).not.toHaveBeenCalled();

    // 打码手机两态编辑照旧：点开变明文输入，收笔派发本地 存联系方式
    await 用户.click(screen.getByRole('button', { name: '编辑手机号' }));
    const 手机输入 = screen.getByRole('textbox', { name: '手机号' });
    await 用户.clear(手机输入);
    await 用户.type(手机输入, '13900000001');
    await 用户.click(screen.getByRole('textbox', { name: '邮箱' })); // 收笔（blur）
    expect(派发).toHaveBeenCalledWith({ 型: '存联系方式', 补丁: { 手机: '13900000001' } });

    // 微信号打码行照旧
    expect(screen.getByRole('button', { name: '编辑微信号' })).toBeTruthy();
  });
});