// Task 4：企业设置（招聘端设置）回归测试。
// 招聘端没有手机号行：Backend 模式零 P8 读取（凭证/会话/账号范围登记都不发起）；
// 账号与安全入口与退出登录（含确认弹层、成功后回登录页）保持既有行为。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业设置 from './企业设置';
import { 路径 } from '../路由/路径表';
import type { P8Credential, P8Session } from '../数据/招聘数据源/P8控制面';
import type { P8资源快照 } from '../状态/后端/类型';

const 导航 = vi.hoisted(() => ({ 返回: vi.fn(), 跳转: vi.fn(), 替换跳转: vi.fn() }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => 导航 }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

function 空快照<T>(): P8资源快照<T> {
  return { phase: 'idle', refreshing: false, data: null, error: null, generation: 0 };
}

/** P8 六法 + 退出登录 桩：全表补齐，断言零调用用。 */
function 操作桩() {
  return {
    设置P8账号范围: vi.fn(),
    加载P8凭证: vi.fn(async () => undefined),
    加载P8会话: vi.fn(async () => undefined),
    开始P8手机号换绑: vi.fn(),
    完成P8手机号换绑: vi.fn(),
    退出P8其他设备: vi.fn(),
    退出登录: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  导航.返回.mockClear();
  导航.跳转.mockClear();
  导航.替换跳转.mockClear();
});

describe('企业设置 · P8 回归', () => {
  it('Backend 模式没有手机号行，零 P8 读取', () => {
    const 操作 = 操作桩();
    mock应用状态 = {
      数据源模式: 'backend',
      后端状态: { credentials: 空快照<P8Credential[]>(), sessions: 空快照<P8Session[]>() },
      操作,
    };
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
    mock应用状态 = {
      数据源模式: 'backend',
      后端状态: { credentials: 空快照<P8Credential[]>(), sessions: 空快照<P8Session[]>() },
      操作,
    };
    render(<MemoryRouter><企业设置 /></MemoryRouter>);

    await 用户.click(screen.getByRole('button', { name: /账号与安全/ }));
    expect(导航.跳转).toHaveBeenCalledWith(路径.账号安全);

    await 用户.click(screen.getByRole('button', { name: '退出登录' }));
    expect(screen.getByText('退出当前账号？')).toBeTruthy();
    // 弹层打开后页面上有两个「退出登录」按钮（行 + 确认键），确认键是第二个
    await 用户.click(screen.getAllByRole('button', { name: '退出登录' })[1]);
    await waitFor(() => expect(操作.退出登录).toHaveBeenCalledTimes(1));
    expect(导航.替换跳转).toHaveBeenCalledWith(路径.登录);

    expect(操作.设置P8账号范围).not.toHaveBeenCalled();
    expect(操作.加载P8凭证).not.toHaveBeenCalled();
    expect(操作.加载P8会话).not.toHaveBeenCalled();
  });
});
