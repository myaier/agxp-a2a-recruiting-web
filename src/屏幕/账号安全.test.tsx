// Task 4：账号安全屏双模式行为测试。
//
// Mock 模式（Step 1 先行冻结）：固定手机号 138 **** 6021、iPhone · 上海 设备行、
// 四位验证码抽屉（位数只来自 短信验证码位数）、任意四位本地换绑成功、本地退出提示、
// 本地注销跳登录页 —— 并且零 P8 操作调用（Mock 绝不触达账号控制面）。
// Backend 模式（Step 2）：挂载登记账号范围 + 凭证/会话并行读取、快照驱动的掩码/时间/
// 计数展示、未成功快照的中性占位与动作禁用、换绑两步走真实操作（11 位裸号进操作层、
// 成功后权威刷新落地才关抽屉、绝不乐观写手机号）、冲突/未知保留抽屉与输入、
// 401 无本地成功、退出其他设备只显示真实回执计数。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 账号安全 from './账号安全';
// 走仓库既有的 ?raw 源码合同模式（应用 tsconfig 只挂 vite/client 类型，不用 node:fs）
import 账号安全源码 from './账号安全.tsx?raw';
import { 短信验证码位数 } from '../数据/验证码规则';
import { 路径 } from '../路由/路径表';
import { BFF错误 } from '../数据/HTTP客户端';
import type {
  P8Credential,
  P8ReplacementAttempt,
  P8ReplacementResult,
  P8Session,
} from '../数据/招聘数据源/P8控制面';
import type { P8资源快照 } from '../状态/后端/类型';

const 导航 = vi.hoisted(() => ({ 返回: vi.fn(), 替换跳转: vi.fn() }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => 导航 }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

// ── P8 DTO 样本（已 decode 的归一化形状；wire decode 归 Task 1 测试）──

const 旧手机凭证: P8Credential = {
  credentialId: 'cred_0000000000000001',
  provider: 'phone_otp',
  display: '+86 138 **** 0000',
  verifiedAt: '2026-08-20T10:00:00Z',
};

const 微信凭证: P8Credential = {
  credentialId: 'cred_0000000000000002',
  provider: 'wechat',
  display: '微信 · 已绑定',
  verifiedAt: '2026-08-21T10:00:00Z',
};

const 本机会话: P8Session = {
  sessionId: 'sess_0000000000000001',
  createdAt: '2026-08-30T00:00:00Z',
  expiresAt: '2026-09-05T00:00:00Z',
  current: true,
};

function 其他会话(sessionId: string): P8Session {
  return { sessionId, createdAt: '2026-08-29T00:00:00Z', expiresAt: '2026-09-01T00:00:00Z', current: false };
}

const 换绑尝试: P8ReplacementAttempt = {
  attemptId: 'att_1',
  nextAction: { type: 'enter_code', expiresAt: '2026-08-30T01:00:00Z', retryAfterSeconds: 60 },
};

/** 回执里的新掩码只属于服务端；屏幕绝不直接渲染它（无乐观手机号的靶子）。 */
const 换绑回执: P8ReplacementResult = {
  credential: {
    credentialId: 'cred_0000000000000009',
    provider: 'phone_otp',
    display: '+86 139 **** 0001',
    verifiedAt: '2026-08-31T10:00:00Z',
  },
  revokedSessions: 1,
  unchanged: false,
};

function 空快照<T>(): P8资源快照<T> {
  return { phase: 'idle', refreshing: false, data: null, error: null, generation: 0 };
}

function 成功快照<T>(data: T): P8资源快照<T> {
  return { phase: 'success', refreshing: false, data, error: null, generation: 1 };
}

/** P8 六法操作桩：全表补齐（缺方法应立即 TypeError，绝不静默 no-op），逐测试覆盖替换。 */
function P8操作桩(覆盖: Record<string, unknown> = {}) {
  return {
    设置P8账号范围: vi.fn(),
    加载P8凭证: vi.fn(async () => undefined),
    加载P8会话: vi.fn(async () => undefined),
    开始P8手机号换绑: vi.fn(async (): Promise<P8ReplacementAttempt> => 换绑尝试),
    完成P8手机号换绑: vi.fn(async (): Promise<P8ReplacementResult> => 换绑回执),
    退出P8其他设备: vi.fn(async (): Promise<number> => 1),
    ...覆盖,
  };
}

/** 组装 mock应用状态 并返回操作桩（断言用）。 */
function 环境(input: {
  模式?: 'mock' | 'backend';
  凭证?: P8资源快照<P8Credential[]>;
  会话?: P8资源快照<P8Session[]>;
  操作覆盖?: Record<string, unknown>;
} = {}) {
  const 操作 = P8操作桩(input.操作覆盖);
  mock应用状态 = {
    数据源模式: input.模式 ?? 'mock',
    后端状态: {
      credentials: input.凭证 ?? 空快照<P8Credential[]>(),
      sessions: input.会话 ?? 空快照<P8Session[]>(),
    },
    操作,
  };
  return 操作;
}

/** 断言六个账号安全操作在 Mock 下零调用。 */
function 断言零P8调用(操作: ReturnType<typeof P8操作桩>) {
  expect(操作.设置P8账号范围).not.toHaveBeenCalled();
  expect(操作.加载P8凭证).not.toHaveBeenCalled();
  expect(操作.加载P8会话).not.toHaveBeenCalled();
  expect(操作.开始P8手机号换绑).not.toHaveBeenCalled();
  expect(操作.完成P8手机号换绑).not.toHaveBeenCalled();
  expect(操作.退出P8其他设备).not.toHaveBeenCalled();
}

beforeEach(() => {
  导航.返回.mockClear();
  导航.替换跳转.mockClear();
});

describe('账号安全 · Mock 冻结', () => {
  it('固定手机号与设备行照旧，任意四位本地换绑成功且零 P8 调用', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 环境({ 模式: 'mock' });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );

    expect(screen.getByText('138 **** 6021')).toBeTruthy();
    expect(screen.getByText('iPhone · 上海 · 今天 09:12')).toBeTruthy();

    await 用户.click(screen.getByRole('button', { name: /手机号/ }));
    await 用户.type(screen.getByPlaceholderText('输入新手机号'), '13900000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    // Mock 专属「原型任意验证码」文案在 Mock 模式原样保留
    expect(screen.getByText(`验证码已发送（原型：任意 ${短信验证码位数} 位数字均可通过）`)).toBeTruthy();
    expect(screen.getByText(/原型环境不真发短信/)).toBeTruthy();

    // 本地成功：行值立刻换成输入号的本地掩码
    await 用户.type(screen.getByPlaceholderText(`${短信验证码位数} 位验证码`), '1234');
    await 用户.click(screen.getByRole('button', { name: '确认换绑' }));
    expect(screen.getByText('139 **** 0000')).toBeTruthy();
    expect(screen.getByText('手机号已换绑')).toBeTruthy();

    断言零P8调用(操作);
  });

  it('验证码抽屉的 maxLength / 占位 / 启用继续由 短信验证码位数 派生（无六位字面量）', async () => {
    const 用户 = userEvent.setup();
    环境({ 模式: 'mock' });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );

    await 用户.click(screen.getByRole('button', { name: /手机号/ }));
    await 用户.type(screen.getByPlaceholderText('输入新手机号'), '13900000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));

    const 输入 = screen.getByPlaceholderText(`${短信验证码位数} 位验证码`);
    const 确认 = screen.getByRole('button', { name: '确认换绑' }) as HTMLButtonElement;
    expect(输入.getAttribute('maxlength')).toBe(String(短信验证码位数));
    expect(确认.disabled).toBe(true);

    await 用户.type(输入, '1'.repeat(短信验证码位数 - 1));
    expect(确认.disabled).toBe(true);
    await 用户.type(输入, '1');
    expect(确认.disabled).toBe(false);
  });

  it('退出其他设备弹本地提示；注销仍是本地跳登录页（零 P8 调用）', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 环境({ 模式: 'mock' });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );

    await 用户.click(screen.getByRole('button', { name: /退出其他设备/ }));
    expect(screen.getByText('其余设备已全部退出登录')).toBeTruthy();

    await 用户.click(screen.getByRole('button', { name: '注销账号' }));
    await 用户.click(screen.getByRole('button', { name: '我已了解，继续注销' }));
    await 用户.click(screen.getByRole('button', { name: '确认注销' }));
    expect(导航.替换跳转).toHaveBeenCalledWith(路径.登录);

    断言零P8调用(操作);
  });
});

describe('账号安全 · Backend 接线', () => {
  it('挂载登记账号可见范围并并行读取凭证+会话，卸载注销可见范围', () => {
    const 操作 = 环境({ 模式: 'backend' });
    const { unmount } = render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    expect(操作.设置P8账号范围).toHaveBeenCalledWith(true);
    expect(操作.加载P8凭证).toHaveBeenCalledTimes(1);
    expect(操作.加载P8会话).toHaveBeenCalledTimes(1);
    unmount();
    expect(操作.设置P8账号范围).toHaveBeenCalledWith(false);
  });

  it('凭证快照驱动掩码：服务端 display 原样上屏，绝不出现硬编码手机号', () => {
    环境({ 模式: 'backend', 凭证: 成功快照([旧手机凭证, 微信凭证]) });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    expect(screen.getByText('+86 138 **** 0000')).toBeTruthy();
    expect(screen.queryByText('138 **** 6021')).toBeNull();
  });

  it('凭证成功但无 phone_otp 行时显示「未绑定」（不做客户端掩码）', () => {
    环境({ 模式: 'backend', 凭证: 成功快照([微信凭证]) });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    expect(screen.getByText('未绑定')).toBeTruthy();
  });

  it('读取中/失败显示中性占位且动作禁用，页面不出现型号/地点字面量', () => {
    环境({
      模式: 'backend',
      凭证: { ...空快照<P8Credential[]>(), phase: 'loading', refreshing: true },
      会话: { ...空快照<P8Session[]>(), phase: 'loading', refreshing: true },
    });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('iPhone · 上海 · 今天 09:12')).toBeNull();
    expect(screen.queryByText(/iPhone|上海/)).toBeNull();
    expect((screen.getByRole('button', { name: /手机号/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /退出其他设备/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('凭证读取失败同样落中性占位（不回退硬编码手机号）', () => {
    环境({
      模式: 'backend',
      凭证: { ...空快照<P8Credential[]>(), phase: 'error', error: '无法连接后端服务，请检查网络或稍后重试' },
    });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    // 凭证失败落中性占位（会话快照 idle 的「当前设备」同样占位，两处都在）
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('138 **** 6021')).toBeNull();
    expect((screen.getByRole('button', { name: /手机号/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('当前会话只显示创建/失效时间，其他设备数来自会话快照（无型号/地点/IP/UA）', () => {
    环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话, 其他会话('sess_0000000000000002'), 其他会话('sess_0000000000000003')]),
    });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    expect(screen.getByText('创建 2026-08-30 00:00 · 失效 2026-09-05 00:00')).toBeTruthy();
    expect(screen.getByText('其他设备 2 台 · 不影响本机，也不影响代理在后台继续谈')).toBeTruthy();
    expect(screen.queryByText(/iPhone|上海|IP|UA/)).toBeNull();
    expect((screen.getByRole('button', { name: /退出其他设备/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('退出其他设备走真实操作并显示回执计数，不弹本地假成功', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话, 其他会话('sess_0000000000000002')]),
      操作覆盖: { 退出P8其他设备: vi.fn(async (): Promise<number> => 2) },
    });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: /退出其他设备/ }));
    expect(操作.退出P8其他设备).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('已退出 2 台其他设备')).toBeTruthy();
    expect(screen.queryByText('其余设备已全部退出登录')).toBeNull();
  });

  it('无其他会话时退出其他设备禁用', () => {
    环境({ 模式: 'backend', 凭证: 成功快照([旧手机凭证]), 会话: 成功快照([本机会话]) });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    expect((screen.getByRole('button', { name: /退出其他设备/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('换绑两步：11 位裸号进 begin、四位码进 complete；刷新落地后才关抽屉且绝不乐观写手机号', async () => {
    const 用户 = userEvent.setup();
    let 兑现完成!: (值: P8ReplacementResult) => void;
    const 完成 = new Promise<P8ReplacementResult>((resolve) => { 兑现完成 = resolve; });
    const 操作 = 环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
      操作覆盖: { 完成P8手机号换绑: vi.fn(() => 完成) },
    });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );

    await 用户.click(screen.getByRole('button', { name: /手机号/ }));
    await 用户.type(screen.getByPlaceholderText('输入新手机号'), '13900000001');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    // begin 吃 11 位中国大陆裸号（+86 E.164 由操作层构造）
    expect(操作.开始P8手机号换绑).toHaveBeenCalledWith('13900000001');
    expect(await screen.findByText('输入验证码')).toBeTruthy();
    expect(screen.getByText('验证码已发送')).toBeTruthy();
    // Backend 模式不出现 Mock 专属「原型任意验证码」文案
    expect(screen.queryByText(/原型/)).toBeNull();

    const 输入 = screen.getByPlaceholderText(`${短信验证码位数} 位验证码`);
    expect(输入.getAttribute('maxlength')).toBe(String(短信验证码位数));
    await 用户.type(输入, '1234');
    await 用户.click(screen.getByRole('button', { name: '确认换绑' }));
    expect(操作.完成P8手机号换绑).toHaveBeenCalledWith('att_1', '1234');
    // 操作承诺（强制重读凭证+会话）未落地前抽屉不关
    expect(screen.getByRole('button', { name: '确认换绑' })).toBeTruthy();

    兑现完成(换绑回执);
    expect(await screen.findByText('手机号已换绑')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '确认换绑' })).toBeNull();
    // 无乐观手机号：回执掩码与输入号掩码都不上屏，行值仍是刷新前快照里的旧掩码
    expect(screen.queryByText('+86 139 **** 0001')).toBeNull();
    expect(screen.queryByText('139 **** 0001')).toBeNull();
    expect(screen.getByText('+86 138 **** 0000')).toBeTruthy();
  });

  it('complete 冲突：抽屉与验证码输入保留，提示固定文案', async () => {
    const 用户 = userEvent.setup();
    环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
      操作覆盖: {
        完成P8手机号换绑: vi.fn(async () => {
          throw new BFF错误(409, 'credential_replacement_conflict', 'conflict');
        }),
      },
    });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: /手机号/ }));
    await 用户.type(screen.getByPlaceholderText('输入新手机号'), '13900000001');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    await 用户.type(screen.getByPlaceholderText(`${短信验证码位数} 位验证码`), '1234');
    await 用户.click(screen.getByRole('button', { name: '确认换绑' }));
    expect(await screen.findByText('验证码不正确或已过期，请重新获取后再试')).toBeTruthy();
    expect(screen.getByRole('button', { name: '确认换绑' })).toBeTruthy();
    expect(screen.getByDisplayValue('1234')).toBeTruthy();
    expect(screen.queryByText('手机号已换绑')).toBeNull();
  });

  it('begin 失败：留在填手机号步骤且输入保留，不进入验证码步', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
      操作覆盖: {
        开始P8手机号换绑: vi.fn(async () => {
          throw new BFF错误(429, 'rate_limited', 'rate limited');
        }),
      },
    });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: /手机号/ }));
    await 用户.type(screen.getByPlaceholderText('输入新手机号'), '13900000001');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    expect(await screen.findByText('操作过于频繁，请稍后再试')).toBeTruthy();
    expect(screen.getByPlaceholderText('输入新手机号')).toBeTruthy();
    expect(screen.getByDisplayValue('13900000001')).toBeTruthy();
    expect(screen.queryByText('输入验证码')).toBeNull();
    expect(操作.完成P8手机号换绑).not.toHaveBeenCalled();
  });

  it('complete 401：无任何本地成功（不提示换绑成功、不关抽屉）', async () => {
    const 用户 = userEvent.setup();
    环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
      操作覆盖: {
        完成P8手机号换绑: vi.fn(async () => {
          throw new BFF错误(401, 'invalid_session', 'invalid session');
        }),
      },
    });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: /手机号/ }));
    await 用户.type(screen.getByPlaceholderText('输入新手机号'), '13900000001');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    await 用户.type(screen.getByPlaceholderText(`${短信验证码位数} 位验证码`), '1234');
    await 用户.click(screen.getByRole('button', { name: '确认换绑' }));
    expect(await screen.findByText('登录已失效，请重新登录')).toBeTruthy();
    expect(screen.queryByText('手机号已换绑')).toBeNull();
    expect(screen.getByRole('button', { name: '确认换绑' })).toBeTruthy();
  });

  it('重新发送走同一手机号的 begin 重发（新尝试），停留验证码步', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
    });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: /手机号/ }));
    await 用户.type(screen.getByPlaceholderText('输入新手机号'), '13900000001');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    await 用户.click(screen.getByRole('button', { name: '没收到？重新发送' }));
    expect(操作.开始P8手机号换绑).toHaveBeenCalledTimes(2);
    expect(操作.开始P8手机号换绑).toHaveBeenLastCalledWith('13900000001');
    expect(await screen.findByText('验证码已重新发送')).toBeTruthy();
    expect(screen.getByText('输入验证码')).toBeTruthy();
  });

  it('验证码位数继续全量派生自 短信验证码位数：生产源码不出现六位字面量', () => {
    expect(账号安全源码).toMatch(/短信验证码位数/);
    expect(账号安全源码).not.toMatch(/6\s*位(验证码|数字)/);
  });
});
