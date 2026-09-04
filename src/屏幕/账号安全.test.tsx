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
// 页面生产调用不传 timeZone：固定测试环境时区（早于一切 import 生效），断言才有确定输出
// tsconfig 只挂 vite/client 类型，process 经 globalThis 缺省形状访问
vi.hoisted(() => {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
  if (env) env.TZ = 'Asia/Shanghai';
});
import 账号安全, { 格式化账户时间 } from './账号安全';
// 走仓库既有的 ?raw 源码合同模式（应用 tsconfig 只挂 vite/client 类型，不用 node:fs）
import 账号安全源码 from './账号安全.tsx?raw';
import { 短信验证码位数 } from '../数据/验证码规则';
import { 路径 } from '../路由/路径表';
import { BFF错误 } from '../数据/HTTP客户端';
import type {
  P8AccountDeletion,
  P8Credential,
  P8DataExport,
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

// ── Task 5：导出/注销 DTO 样本 ──

const 导出ID = `exp_${'0123456789abcdef'.repeat(2)}`;

function 导出DTO(覆盖: Partial<P8DataExport> = {}): P8DataExport {
  return {
    exportId: 导出ID,
    status: 'queued',
    createdAt: '2026-08-30T00:00:00Z',
    expiresAt: null,
    downloadReady: false,
    ...覆盖,
  };
}

const 注销回执: P8AccountDeletion = {
  deletionId: `del_${'0123456789abcdef'.repeat(2)}`,
  status: 'deletion_pending',
  retentionUntil: '2026-09-29T00:00:00Z',
};

function 空快照<T>(): P8资源快照<T> {
  return { phase: 'idle', refreshing: false, data: null, error: null, generation: 0 };
}

function 成功快照<T>(data: T): P8资源快照<T> {
  return { phase: 'success', refreshing: false, data, error: null, generation: 1 };
}

/** P8 十二法操作桩：全表补齐（缺方法应立即 TypeError，绝不静默 no-op），逐测试覆盖替换。 */
function P8操作桩(覆盖: Record<string, unknown> = {}) {
  return {
    设置P8账号范围: vi.fn(),
    加载P8凭证: vi.fn(async () => undefined),
    加载P8会话: vi.fn(async () => undefined),
    开始P8手机号换绑: vi.fn(async (): Promise<P8ReplacementAttempt> => 换绑尝试),
    完成P8手机号换绑: vi.fn(async (): Promise<P8ReplacementResult> => 换绑回执),
    退出P8其他设备: vi.fn(async (): Promise<number> => 1),
    恢复P8数据导出: vi.fn(async () => undefined),
    创建P8数据导出: vi.fn(async () => undefined),
    刷新P8数据导出: vi.fn(async () => undefined),
    废弃P8数据导出: vi.fn(),
    取P8数据导出下载地址: vi.fn((): string | null => null),
    请求P8账号注销: vi.fn(async (): Promise<P8AccountDeletion> => 注销回执),
    ...覆盖,
  };
}

/** 组装 mock应用状态 并返回操作桩（断言用）。 */
function 环境(input: {
  模式?: 'mock' | 'backend';
  凭证?: P8资源快照<P8Credential[]>;
  会话?: P8资源快照<P8Session[]>;
  导出?: P8资源快照<P8DataExport>;
  操作覆盖?: Record<string, unknown>;
} = {}) {
  const 操作 = P8操作桩(input.操作覆盖);
  mock应用状态 = {
    数据源模式: input.模式 ?? 'mock',
    后端状态: {
      credentials: input.凭证 ?? 空快照<P8Credential[]>(),
      sessions: input.会话 ?? 空快照<P8Session[]>(),
      dataExport: input.导出 ?? 空快照<P8DataExport>(),
    },
    操作,
  };
  return 操作;
}

/** 断言全部 P8 控制面操作在 Mock 下零调用。 */
function 断言零P8调用(操作: ReturnType<typeof P8操作桩>) {
  expect(操作.设置P8账号范围).not.toHaveBeenCalled();
  expect(操作.加载P8凭证).not.toHaveBeenCalled();
  expect(操作.加载P8会话).not.toHaveBeenCalled();
  expect(操作.开始P8手机号换绑).not.toHaveBeenCalled();
  expect(操作.完成P8手机号换绑).not.toHaveBeenCalled();
  expect(操作.退出P8其他设备).not.toHaveBeenCalled();
  expect(操作.恢复P8数据导出).not.toHaveBeenCalled();
  expect(操作.创建P8数据导出).not.toHaveBeenCalled();
  expect(操作.刷新P8数据导出).not.toHaveBeenCalled();
  expect(操作.废弃P8数据导出).not.toHaveBeenCalled();
  expect(操作.取P8数据导出下载地址).not.toHaveBeenCalled();
  expect(操作.请求P8账号注销).not.toHaveBeenCalled();
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

  it('Mock 不渲染 Backend 专属的「数据」组与导出行（现有页面一个像素不多）', () => {
    环境({ 模式: 'mock' });
    render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    expect(screen.queryByText('数据')).toBeNull();
    expect(screen.queryByText('导出我的数据')).toBeNull();
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
    expect(screen.getByText('创建 2026-08-30 08:00 · 失效 2026-09-05 08:00')).toBeTruthy();
    // 账户时间按本地时区格式化：不再出现 UTC 定长截取文本
    expect(screen.queryByText('创建 2026-08-30 00:00 · 失效 2026-09-05 00:00')).toBeNull();
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

// ── Task 5：数据导出行 + 抽屉 + 注销接线 ──────────────────────────
// 新 DOM 恰为一组现有样式的 组标/卡/行，紧跟在既有注销按钮之前；下载走同源锚点
// （先权威预检），绝不 请求二进制/blob()/createObjectURL；Mock 零渲染零调用。

describe('账号安全 · Backend 数据导出与注销', () => {
  function 渲染() {
    return render(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
  }

  it('「数据」组恰为一组：组标 + 一张卡 + 导出行，DOM 序在注销按钮之前', () => {
    环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
    });
    渲染();
    const 组标 = screen.getByText('数据');
    const 行 = screen.getByRole('button', { name: /^导出我的数据/ });
    const 注销 = screen.getByRole('button', { name: '注销账号' });
    expect(组标.compareDocumentPosition(行) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(行.compareDocumentPosition(注销) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(行.className).toContain('可点');
    expect(screen.getAllByText('数据')).toHaveLength(1); // 恰一组，不重复
  });

  it('进屏被动恢复零弹层；打开抽屉即恢复 + 立即刷新，queued/running 显示生成中', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
      导出: 成功快照(导出DTO({ status: 'running', exportId: 导出ID })),
    });
    渲染();
    expect(操作.恢复P8数据导出).toHaveBeenCalledTimes(1); // 进屏被动恢复
    expect(操作.刷新P8数据导出).not.toHaveBeenCalled(); // 弹层未开：轮询零请求
    await 用户.click(screen.getByRole('button', { name: /^导出我的数据/ }));
    expect(操作.恢复P8数据导出).toHaveBeenCalledTimes(2); // 打开即恢复
    expect(操作.刷新P8数据导出).toHaveBeenCalledTimes(1); // 打开立即一拍
    expect(screen.getByText(/正在生成导出文件/)).toBeTruthy();
    expect(screen.getByText('正在生成，回到本页可继续查看')).toBeTruthy(); // 行提示同步
  });

  it('无句柄起步：抽屉给「生成导出文件」，点击走真实创建', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
    });
    渲染();
    await 用户.click(screen.getByRole('button', { name: /^导出我的数据/ }));
    await 用户.click(screen.getByRole('button', { name: '生成导出文件' }));
    expect(操作.创建P8数据导出).toHaveBeenCalledTimes(1);
  });

  it('ready+downloadReady：显示过期时间，下载先权威预检再同源锚点；无 Blob/对象 URL', async () => {
    const 用户 = userEvent.setup();
    const 下载地址 = `/api/v1/me/data-exports/${导出ID}/download`;
    const 操作 = 环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
      导出: 成功快照(导出DTO({
        status: 'ready', downloadReady: true, expiresAt: '2026-09-05T12:30:00Z',
      })),
      操作覆盖: { 取P8数据导出下载地址: vi.fn((): string | null => 下载地址) },
    });
    const 点击桩 = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    渲染();
    await 用户.click(screen.getByRole('button', { name: /^导出我的数据/ }));
    expect(screen.getByText(/2026-09-05 20:30 前可下载/)).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '下载数据导出' }));
    expect(操作.刷新P8数据导出).toHaveBeenCalled(); // 预检在前
    expect(操作.取P8数据导出下载地址).toHaveBeenCalled();
    expect(操作.刷新P8数据导出.mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(操作.取P8数据导出下载地址).mock.invocationCallOrder[0]);
    expect(点击桩).toHaveBeenCalledTimes(1);
    const 锚 = 点击桩.mock.instances[0] as HTMLAnchorElement;
    expect(锚.href).toContain(下载地址);
    expect(锚.download).toBe('');
    点击桩.mockRestore();
    // 生产源码绝不出现二进制/对象 URL 路径
    expect(账号安全源码).not.toMatch(/请求二进制|\.blob\(|createObjectURL/);
  });

  it('下载预检后不可下载（未就绪/已过期）：不点锚点，固定提示', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
      导出: 成功快照(导出DTO({ status: 'ready', downloadReady: true })),
      操作覆盖: { 取P8数据导出下载地址: vi.fn((): string | null => null) },
    });
    const 点击桩 = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    渲染();
    await 用户.click(screen.getByRole('button', { name: /^导出我的数据/ }));
    await 用户.click(screen.getByRole('button', { name: '下载数据导出' }));
    expect(操作.刷新P8数据导出).toHaveBeenCalledTimes(1); // 预检照常发出
    expect(点击桩).not.toHaveBeenCalled();
    expect(await screen.findByText('导出尚未就绪或已过期，请稍后重试')).toBeTruthy();
    点击桩.mockRestore();
  });

  it('failed / expired：显示对应终态，「重新生成」= 先废弃再创建（废弃先于创建）', async () => {
    const 用户 = userEvent.setup();
    for (const 终态 of ['failed', 'expired'] as const) {
      const 操作 = 环境({
        模式: 'backend',
        凭证: 成功快照([旧手机凭证]),
        会话: 成功快照([本机会话]),
        导出: 成功快照(导出DTO({ status: 终态 })),
      });
      const 视图 = 渲染();
      await 用户.click(screen.getByRole('button', { name: /^导出我的数据/ }));
      expect(screen.getByText(终态 === 'failed' ? /上次导出没有生成成功/ : /这份导出已过期/)).toBeTruthy();
      await 用户.click(screen.getByRole('button', { name: '重新生成' }));
      expect(操作.废弃P8数据导出).toHaveBeenCalledTimes(1);
      expect(操作.创建P8数据导出).toHaveBeenCalledTimes(1);
      expect(操作.废弃P8数据导出.mock.invocationCallOrder[0])
        .toBeLessThan(操作.创建P8数据导出.mock.invocationCallOrder[0]);
      视图.unmount(); // 逐终态独立挂载，避免两块屏同屏互撞
    }
  });

  it('创建冲突（跨设备 409）：固定跨设备文案上屏，抽屉与重试入口保留', async () => {
    const 用户 = userEvent.setup();
    环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
      操作覆盖: {
        创建P8数据导出: vi.fn(async () => {
          throw new BFF错误(409, 'export_in_progress', 'another device holds an active export');
        }),
      },
    });
    渲染();
    await 用户.click(screen.getByRole('button', { name: /^导出我的数据/ }));
    await 用户.click(screen.getByRole('button', { name: '生成导出文件' }));
    expect(await screen.findByText('已有导出正在生成或等待下载，请稍后重试')).toBeTruthy();
    expect(screen.getByRole('button', { name: '生成导出文件' })).toBeTruthy(); // 可重试
  });

  it('关闭抽屉再打开：恢复与立即刷新重新起拍（服务端任务继续）', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
      导出: 成功快照(导出DTO({ status: 'queued', exportId: 导出ID })),
    });
    渲染();
    await 用户.click(screen.getByRole('button', { name: /^导出我的数据/ }));
    await 用户.click(screen.getByRole('button', { name: '关闭导出我的数据' }));
    expect(screen.queryByText(/正在生成导出文件/)).toBeNull();
    await 用户.click(screen.getByRole('button', { name: /^导出我的数据/ }));
    expect(操作.恢复P8数据导出).toHaveBeenCalledTimes(3);
    expect(操作.刷新P8数据导出).toHaveBeenCalledTimes(2);
  });

  it('注销说明层：有 ready 未下载导出时给「注销后将无法下载」警示与先下载入口，仍可继续', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
      导出: 成功快照(导出DTO({ status: 'ready', downloadReady: true })),
      操作覆盖: { 取P8数据导出下载地址: vi.fn((): string | null => `/api/v1/me/data-exports/${导出ID}/download`) },
    });
    const 点击桩 = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    渲染();
    await 用户.click(screen.getByRole('button', { name: '注销账号' }));
    expect(screen.getByText(/注销后将无法下载/)).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '先下载数据导出' }));
    expect(点击桩).toHaveBeenCalledTimes(1); // 同款先下载入口
    点击桩.mockRestore();
    // 警示不拦截：继续进入最终确认
    await 用户.click(screen.getByRole('button', { name: '我已了解，继续注销' }));
    expect(screen.getByRole('button', { name: '确认注销' })).toBeTruthy();
    expect(操作.请求P8账号注销).not.toHaveBeenCalled();
  });

  it('Backend 注销：最终确认单发真实注销，成功后跳登录页；失败保留确认层与提示', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
    });
    const { rerender } = 渲染();
    await 用户.click(screen.getByRole('button', { name: '注销账号' }));
    await 用户.click(screen.getByRole('button', { name: '我已了解，继续注销' }));
    await 用户.click(screen.getByRole('button', { name: '确认注销' }));
    expect(操作.请求P8账号注销).toHaveBeenCalledTimes(1);
    expect(导航.替换跳转).toHaveBeenCalledWith(路径.登录); // 导航归屏幕
    // 失败路径：保留确认层，无本地成功
    导航.替换跳转.mockClear();
    环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
      操作覆盖: {
        请求P8账号注销: vi.fn(async () => {
          throw new BFF错误(503, 'operation_outcome_unknown', 'unknown');
        }),
      },
    });
    rerender(
      <MemoryRouter>
        <账号安全 />
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: '注销账号' }));
    await 用户.click(screen.getByRole('button', { name: '我已了解，继续注销' }));
    await 用户.click(screen.getByRole('button', { name: '确认注销' }));
    expect(await screen.findByText('暂时无法确认操作是否成功，请稍后重试')).toBeTruthy();
    expect(screen.getByRole('button', { name: '确认注销' })).toBeTruthy(); // 确认层保留可重试
    expect(导航.替换跳转).not.toHaveBeenCalled();
  });

  // P0 修复 Task 6：导出/注销文案必须角色中性 —— 中性名词短语上屏，且整份源码
  // （含未展开的注销说明抽屉）不出现「你的简历」。环境() 没有角色开关：屏内断言
  // 只证明这段文案与角色无关，源码级 ?raw 断言才是覆盖全屏的那一条。
  it('导出与注销文案角色中性：中性名词上屏，源码内不出现你的简历', () => {
    环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
    });
    渲染();
    // jest-dom 未安装：用等价或更强的原生断言（存在 + 已挂载 + 文本内容）
    const 中性文案 = screen.getByText(/账号资料与业务记录/);
    expect(中性文案.isConnected).toBe(true);
    expect(中性文案.textContent).toContain('账号资料与业务记录');
    expect(screen.queryByText(/你的简历/)).toBeNull();
    expect(账号安全源码).not.toMatch(/你的简历/);
  });

  // review 复检：中性化不得吞掉注销披露 —— 「立即删除」时点、代谈终止、以及
  // 对方只收到「对方已退出」这三条事实必须仍在同一段里说清楚（三条本来就与角色无关）。
  it('注销说明抽屉在中性化后仍完整披露：立即删除 / 代谈终止 / 对方所见', async () => {
    const 用户 = userEvent.setup();
    环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
    });
    渲染();
    await 用户.click(screen.getByRole('button', { name: '注销账号' }));
    const 说明 = await screen.findByText(/正在进行的代谈会全部终止/);
    expect(说明.textContent).toContain('账号资料与业务记录'); // 中性名词短语保住
    expect(说明.textContent).toContain('立即删除'); // (a) 删除时点
    expect(说明.textContent).toContain('且无法恢复');
    expect(说明.textContent).toContain('正在进行的代谈会全部终止'); // (b) 代谈终止
    expect(说明.textContent).toContain('对方只会收到「对方已退出」，不会知道原因'); // (c) 对方所见
    expect(screen.queryByText(/你的简历/)).toBeNull();
    expect(账号安全源码).not.toMatch(/你的简历/);
  });

  it('注销遇 export_in_progress：保留确认层、不本地登出，提示等待导出', async () => {
    const 用户 = userEvent.setup();
    环境({
      模式: 'backend',
      凭证: 成功快照([旧手机凭证]),
      会话: 成功快照([本机会话]),
      操作覆盖: {
        请求P8账号注销: vi.fn(async () => {
          throw new BFF错误(409, 'export_in_progress', 'export running');
        }),
      },
    });
    渲染();
    await 用户.click(screen.getByRole('button', { name: '注销账号' }));
    await 用户.click(screen.getByRole('button', { name: '我已了解，继续注销' }));
    await 用户.click(screen.getByRole('button', { name: '确认注销' }));
    expect(await screen.findByText('已有导出正在生成或等待下载，请稍后重试')).toBeTruthy();
    expect(screen.getByRole('button', { name: '确认注销' })).toBeTruthy(); // 两层流程不收口
    expect(导航.替换跳转).not.toHaveBeenCalled(); // 不本地登出、不伪装成功
  });
});

describe('账号安全 · 格式化账户时间', () => {
  it('按指定时区输出 YYYY-MM-DD HH:mm：UTC+8 跨日与美东夏令时', () => {
    expect(格式化账户时间('2026-09-03T16:30:00Z', 'Asia/Shanghai'))
      .toBe('2026-09-04 00:30');
    expect(格式化账户时间('2026-03-08T07:30:00Z', 'America/New_York'))
      .toBe('2026-03-08 03:30');
  });

  it('非法时间返回中性占位 —', () => {
    expect(格式化账户时间('not-a-time', 'Asia/Shanghai')).toBe('—');
  });
});
