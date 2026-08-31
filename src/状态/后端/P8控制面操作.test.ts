// P8 Task 3：账号安全运行时状态的行为测试 —— 凭证/会话两块资源的独立结算、
// 单飞与 force 换代接管、旧成功数据不降级、subject/session/范围三代栅栏对迟到成败的
// 整包丢弃、换绑开始/完成与退出其他设备的意图键生命周期（独立键、四位验证码、
// 未知/进行中同键重放、终局冲突清键、换手机号/换 attempt/换码新键、并发点击并入同一
// Promise）、当前会话 401 统一清账号、引用级清理与 UI 可见范围的边界。受控 deferred
// promise 证明「完成换绑成功先强制重读两资源再 resolve」与「不乐观写掩码手机号」；
// 派发 只是 spy，全部断言读 最新状态()。快照/锁/意图只在内存，绝不进持久化。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF主体 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type {
  P8Credential,
  P8ReplacementAttempt,
  P8ReplacementResult,
  P8Session,
} from '../../数据/招聘数据源/P8控制面';
import { BFF错误 } from '../../数据/HTTP客户端';
import { 短信验证码位数 } from '../../数据/验证码规则';
import { BFF主体样本 } from '../../测试/BFF样本';
import { 初始状态 } from '../初始状态';
import type { 动作 } from '../应用状态';
import { 创建空P4发现状态 } from './发现推荐操作';
import { 创建空P5MatchCase状态 } from './MatchCase操作';
import { 创建空P7会话状态 } from './真人会话操作';
import {
  创建P8账号安全操作,
  创建空P8控制面状态,
  取P8错误文案,
  清P8控制面引用,
} from './P8控制面操作';
import type {
  P7待定意图,
  P8待定意图,
  P8运行时引用,
  后端操作依赖,
  后端状态,
  P8账号安全操作,
} from './类型';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** 一个宏任务空转：让命令成功后的强制重读链路先跑起来再断言「尚未 resolve」。 */
const 空转 = () => new Promise<void>((ok) => { setTimeout(ok, 0); });

const 候选主体: BFF主体 = { ...BFF主体样本, last_used_role: 'candidate' };

// ── DTO 样本：在 facade 边界直接给已 decode 的归一化 P8 DTO（decode 归 Task 1）──

const 手机凭证: P8Credential = {
  credentialId: 'cred_0000000000000001',
  provider: 'phone_otp',
  display: '+86 138 **** 0000',
  verifiedAt: '2026-08-20T10:00:00Z',
};

const 新手机凭证: P8Credential = {
  credentialId: 'cred_0000000000000009',
  provider: 'phone_otp',
  display: '+86 139 **** 1111',
  verifiedAt: '2026-08-31T10:00:00Z',
};

const 微信凭证: P8Credential = {
  credentialId: 'cred_0000000000000002',
  provider: 'wechat',
  display: '微信 · 已绑定',
  verifiedAt: '2026-08-21T10:00:00Z',
};

const 当前会话: P8Session = {
  sessionId: 'sess_0000000000000001',
  createdAt: '2026-08-30T00:00:00Z',
  expiresAt: '2026-09-05T00:00:00Z',
  current: true,
};

function 其他会话(sessionId: string): P8Session {
  return { sessionId, createdAt: '2026-08-29T00:00:00Z', expiresAt: '2026-09-01T00:00:00Z', current: false };
}

const 换绑尝试: P8ReplacementAttempt = {
  attemptId: 'att_0123456789abcdef',
  nextAction: { type: 'enter_code', expiresAt: '2026-08-30T01:00:00Z', retryAfterSeconds: 60 },
};

const 换绑回执: P8ReplacementResult = {
  credential: 新手机凭证,
  revokedSessions: 1,
  unchanged: false,
};

/** 本文件内的数据源桩：桩 P8 facade 全部方法 + 清空目录缓存，默认全成功，逐测试覆盖替换。 */
function 创建P8数据源(覆盖: Record<string, unknown> = {}): HTTP招聘数据源 {
  return {
    读取P8凭证: vi.fn(async (): Promise<P8Credential[]> => [手机凭证]),
    读取P8会话: vi.fn(async (): Promise<P8Session[]> => [当前会话]),
    开始P8手机号换绑: vi.fn(async (): Promise<P8ReplacementAttempt> => 换绑尝试),
    完成P8手机号换绑: vi.fn(async (): Promise<P8ReplacementResult> => 换绑回执),
    退出P8其他设备: vi.fn(async (): Promise<number> => 1),
    清空目录缓存: vi.fn(),
    ...覆盖,
  } as unknown as HTTP招聘数据源;
}

interface P8操作测试环境 {
  数据源: HTTP招聘数据源;
  deps: 后端操作依赖 & P8运行时引用;
  派发: ReturnType<typeof vi.fn>;
  操作: P8账号安全操作;
  最新状态(): 后端状态;
}

function 创建P8操作测试环境(是后端 = true, 源 = 创建P8数据源()): P8操作测试环境 {
  const 状态引用 = { current: 初始状态 };
  const 派发 = vi.fn<(动作: 动作) => void>();
  let 后端值: 后端状态 = {
    初始化: '完成',
    已登录: true,
    主体: 候选主体,
    简历快照: null,
    意向快照: {},
    岗位快照: {},
    隐私快照: null,
    附件简历库: null,
    候选规则快照: {},
    招聘规则快照: {},
    候选规则提案: {},
    招聘规则提案: {},
    Agent规则水合: {
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    },
    ...创建空P4发现状态(),
    ...创建空P5MatchCase状态(),
    ...创建空P7会话状态(),
    ...创建空P8控制面状态(),
  };
  const deps: 后端操作依赖 & P8运行时引用 = {
    是后端,
    后端: 是后端 ? 源 : null,
    派发,
    设后端状态: vi.fn((更新: (旧: 后端状态) => 后端状态): 后端状态 => {
      后端值 = 更新(后端值);
      return 后端值;
    }),
    后端状态引用: {
      get current() {
        return 后端值;
      },
      set current(值: 后端状态) {
        后端值 = 值;
      },
    },
    状态引用,
    锁: { current: new Set<string>() },
    尝试引用: { current: null },
    主体标识引用: { current: 'sub_1' },
    会话代际: { current: 1 },
    读取恢复企业关系编号: vi.fn(() => null),
    P4范围代际: { current: new Map<string, number>() },
    P4幂等意图: { current: new Map<string, string>() },
    P4可见范围: { current: { candidate: null, recruiter: null } },
    P5范围代际: { current: new Map<string, number>() },
    P5幂等意图: { current: new Map<string, string>() },
    P5可见范围: { current: { candidate: null, recruiter: null } },
    P5对象租约: { current: new Set() },
    P7范围代际: { current: new Map<string, number>() },
    P7待定意图: { current: new Map<string, P7待定意图>() },
    P7可见收件箱: { current: { candidate: false, recruiter: false } },
    P7可见会话: { current: { candidate: null, recruiter: null } },
    P7已读位置: { current: new Map() },
    P8范围代际: { current: 0 },
    P8账号可见: { current: false },
    P8读取锁: { current: new Map<'credentials' | 'sessions' | 'export', Promise<void>>() },
    P8待定意图: { current: new Map<string, P8待定意图<unknown>>() },
    P8导出恢复: { current: null },
  };
  return {
    数据源: 源,
    deps,
    派发,
    操作: 创建P8账号安全操作(deps),
    最新状态: () => 后端值,
  };
}

let env: P8操作测试环境;

beforeEach(() => {
  env = 创建P8操作测试环境();
});

// ── Step 1：读取 owner ─────────────────────────────────────────────

describe('P8 账号安全读取 owner', () => {
  it('凭证与会话独立结算：一块失败不牵连另一块，错误只落该资源', async () => {
    vi.mocked(env.数据源.读取P8凭证).mockRejectedValueOnce(
      new BFF错误(503, 'identity_service_unavailable', 'identity down'));
    await Promise.all([env.操作.加载P8凭证(), env.操作.加载P8会话()]);
    expect(env.最新状态().credentials).toEqual({
      phase: 'error', refreshing: false, data: null,
      error: '账号服务暂时不可用，请稍后重试', generation: expect.any(Number),
    });
    expect(env.最新状态().sessions).toMatchObject({ phase: 'success', data: [当前会话], error: null });
  });

  it('设置页按需只读凭证：零会话请求', async () => {
    await env.操作.加载P8凭证();
    expect(env.数据源.读取P8凭证).toHaveBeenCalledTimes(1);
    expect(env.数据源.读取P8会话).not.toHaveBeenCalled();
  });

  it('已成功的资源非 force 重复加载零请求；另一资源不受影响照常首发', async () => {
    await env.操作.加载P8凭证();
    await env.操作.加载P8凭证();
    expect(env.数据源.读取P8凭证).toHaveBeenCalledTimes(1);
    await env.操作.加载P8会话();
    expect(env.数据源.读取P8会话).toHaveBeenCalledTimes(1);
  });

  it('force 刷新保留旧成功数据：途中不降级为空，新数据原子替换', async () => {
    await env.操作.加载P8凭证();
    const 门 = deferred<P8Credential[]>();
    vi.mocked(env.数据源.读取P8凭证).mockReturnValueOnce(门.promise);
    const run = env.操作.加载P8凭证(true);
    // 途中：仍是成功快照 + 轻量刷新态，旧 data 不降级
    expect(env.最新状态().credentials).toMatchObject({
      phase: 'success', refreshing: true, data: [手机凭证], error: null,
    });
    门.resolve([新手机凭证]);
    await run;
    expect(env.最新状态().credentials).toMatchObject({
      phase: 'success', refreshing: false, data: [新手机凭证], error: null,
    });
  });

  it('force 刷新失败保留旧成功数据，只落重试错误', async () => {
    await env.操作.加载P8凭证();
    vi.mocked(env.数据源.读取P8凭证).mockRejectedValueOnce(
      new BFF错误(503, 'identity_service_unavailable', 'down'));
    await env.操作.加载P8凭证(true);
    expect(env.最新状态().credentials).toMatchObject({
      phase: 'success', refreshing: false, data: [手机凭证], error: '账号服务暂时不可用，请稍后重试',
    });
  });

  it('同资源并发读单飞：重复调用并入同一 Promise 只发一次请求', async () => {
    const 门 = deferred<P8Session[]>();
    vi.mocked(env.数据源.读取P8会话).mockReturnValueOnce(门.promise);
    const a = env.操作.加载P8会话();
    const b = env.操作.加载P8会话();
    expect(env.数据源.读取P8会话).toHaveBeenCalledTimes(1);
    门.resolve([当前会话]);
    await Promise.all([a, b]);
    expect(env.最新状态().sessions.data).toEqual([当前会话]);
  });

  it('force 在飞读上换代接管：旧读迟到整包丢弃，只落新读数据', async () => {
    const 旧门 = deferred<P8Session[]>();
    vi.mocked(env.数据源.读取P8会话).mockReturnValueOnce(旧门.promise);
    const 旧读 = env.操作.加载P8会话();
    const 新门 = deferred<P8Session[]>();
    vi.mocked(env.数据源.读取P8会话).mockReturnValueOnce(新门.promise);
    const 新读 = env.操作.加载P8会话(true);
    expect(env.数据源.读取P8会话).toHaveBeenCalledTimes(2);
    旧门.resolve([其他会话('sess_old')]); // 旧读在换代后迟到：整包丢弃
    await 旧读;
    expect(env.最新状态().sessions.data).toBeNull();
    新门.resolve([当前会话, 其他会话('sess_new')]);
    await 新读;
    expect(env.最新状态().sessions.data).toEqual([当前会话, 其他会话('sess_new')]);
  });

  it('姊妹资源 force 换代不把首读滞留在 loading：被作废的结算回滚到起飞前状态', async () => {
    const 凭证门 = deferred<P8Credential[]>();
    const 会话门 = deferred<P8Session[]>();
    vi.mocked(env.数据源.读取P8凭证).mockReturnValueOnce(凭证门.promise);
    vi.mocked(env.数据源.读取P8会话).mockReturnValueOnce(会话门.promise);
    const 会话读 = env.操作.加载P8会话(); // 姊妹在飞：快照 loading
    expect(env.最新状态().sessions).toMatchObject({ phase: 'loading', refreshing: true });
    const 凭证读 = env.操作.加载P8凭证(true); // force 换代：会话读的结算将被整包作废
    会话门.resolve([当前会话]); // 迟到结算：数据作废，但快照绝不滞留在 loading/refreshing
    await 会话读;
    expect(env.最新状态().sessions).toEqual({
      phase: 'idle', refreshing: false, data: null, error: null, generation: 0,
    });
    凭证门.resolve([手机凭证]);
    await 凭证读;
    expect(env.最新状态().credentials.data).toEqual([手机凭证]);
  });

  it('姊妹资源 force 换代不把再刷新滞留在 refreshing：回滚保留旧成功数据', async () => {
    await env.操作.加载P8会话(); // 旧成功数据先在场
    const 凭证门 = deferred<P8Credential[]>();
    const 会话门 = deferred<P8Session[]>();
    vi.mocked(env.数据源.读取P8凭证).mockReturnValueOnce(凭证门.promise);
    vi.mocked(env.数据源.读取P8会话).mockReturnValueOnce(会话门.promise);
    const 会话读 = env.操作.加载P8会话(true); // 再刷新：success + refreshing:true
    const 凭证读 = env.操作.加载P8凭证(true); // 姊妹 force 换代
    expect(env.最新状态().sessions).toMatchObject({
      phase: 'success', refreshing: true, data: [当前会话],
    });
    会话门.resolve([当前会话, 其他会话('sess_2')]); // 迟到：新数据整包作废，状态不滞留
    await 会话读;
    expect(env.最新状态().sessions).toEqual({
      phase: 'success', refreshing: false, data: [当前会话], error: null,
      generation: expect.any(Number),
    });
    凭证门.resolve([新手机凭证]);
    await 凭证读;
  });

  it('被作废的旧读回滚绝不覆盖接管新读的结果', async () => {
    await env.操作.加载P8凭证(); // 旧成功（[手机凭证]）
    const 旧门 = deferred<P8Credential[]>();
    vi.mocked(env.数据源.读取P8凭证).mockReturnValueOnce(旧门.promise);
    const 旧读 = env.操作.加载P8凭证(true); // 再刷新在飞
    const 新门 = deferred<P8Credential[]>();
    vi.mocked(env.数据源.读取P8凭证).mockReturnValueOnce(新门.promise);
    const 新读 = env.操作.加载P8凭证(true); // force 接管：旧读将被作废
    新门.resolve([新手机凭证]); // 新读先结算成功
    await 新读;
    旧门.resolve([手机凭证]); // 旧读迟到：回滚不得把快照打回旧数据
    await 旧读;
    expect(env.最新状态().credentials).toMatchObject({
      phase: 'success', refreshing: false, data: [新手机凭证],
    });
  });

  it('会话代际变化后迟到的成功整包丢弃', async () => {
    const 会话请求 = deferred<P8Session[]>();
    vi.mocked(env.数据源.读取P8会话).mockReturnValueOnce(会话请求.promise);
    const run = env.操作.加载P8会话(true);
    env.deps.会话代际.current += 1;
    会话请求.resolve([当前会话]);
    await run;
    expect(env.最新状态().sessions.data).toBeNull();
    expect(env.最新状态().sessions.phase).not.toBe('success');
  });

  it('换主体后迟到的成败都不写快照', async () => {
    const 成功门 = deferred<P8Credential[]>();
    vi.mocked(env.数据源.读取P8凭证).mockReturnValueOnce(成功门.promise);
    const run = env.操作.加载P8凭证(true);
    env.deps.主体标识引用.current = 'sub_2';
    成功门.resolve([手机凭证]);
    await run;
    expect(env.最新状态().credentials.data).toBeNull();

    const 失败门 = deferred<P8Credential[]>();
    vi.mocked(env.数据源.读取P8凭证).mockReset().mockReturnValueOnce(失败门.promise);
    const run2 = env.操作.加载P8凭证(true);
    env.deps.主体标识引用.current = 'sub_3';
    失败门.reject(new BFF错误(503, 'identity_service_unavailable', 'down'));
    await run2;
    expect(env.最新状态().credentials.phase).not.toBe('error');
    expect(env.最新状态().credentials.error).toBeNull();
  });

  it('迟到的 401 只丢弃，绝不登出新会话', async () => {
    const 门 = deferred<P8Credential[]>();
    vi.mocked(env.数据源.读取P8凭证).mockReturnValueOnce(门.promise);
    const run = env.操作.加载P8凭证(true);
    env.deps.主体标识引用.current = 'sub_2';
    env.deps.会话代际.current += 1;
    门.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await run;
    expect(env.最新状态().已登录).toBe(true);
    expect(env.最新状态().credentials.phase).not.toBe('error');
  });

  it('当前会话 401 统一清账号并摊平 P8 域（三块快照 + 锁 + 意图 + 可见）', async () => {
    await env.操作.加载P8凭证();
    env.deps.P8待定意图.current.set('p8:退出其他设备', { key: 'k', request: {} });
    env.deps.P8读取锁.current.set('sessions', Promise.resolve());
    env.deps.P8账号可见.current = true;
    vi.mocked(env.数据源.读取P8凭证).mockRejectedValueOnce(
      new BFF错误(401, 'invalid_session', 'expired'));
    await env.操作.加载P8凭证(true);
    expect(env.最新状态().已登录).toBe(false);
    expect(env.最新状态().主体).toBeNull();
    expect(env.最新状态().credentials).toEqual(创建空P8控制面状态().credentials);
    expect(env.最新状态().sessions).toEqual(创建空P8控制面状态().sessions);
    expect(env.最新状态().dataExport).toEqual(创建空P8控制面状态().dataExport);
    expect(env.deps.主体标识引用.current).toBeNull();
    expect(env.deps.P8读取锁.current.size).toBe(0);
    expect(env.deps.P8待定意图.current.size).toBe(0);
    expect(env.deps.P8账号可见.current).toBe(false);
    expect(env.deps.P8范围代际.current).toBeGreaterThan(0);
    expect(env.数据源.清空目录缓存).toHaveBeenCalled();
  });

  it('派生不变量：掩码手机号、当前会话与其他设备计数只来自解码快照，无设备/地点兜底', async () => {
    const 会话们 = [当前会话, 其他会话('sess_0000000000000002'), 其他会话('sess_0000000000000003')];
    vi.mocked(env.数据源.读取P8会话).mockResolvedValueOnce(会话们);
    vi.mocked(env.数据源.读取P8凭证).mockResolvedValueOnce([手机凭证, 微信凭证]);
    await Promise.all([env.操作.加载P8会话(), env.操作.加载P8凭证()]);
    // 快照原样保存解码 DTO：不补设备/地点/IP 字段，不删服务端字段
    expect(env.最新状态().sessions.data).toEqual(会话们);
    expect(env.最新状态().credentials.data).toEqual([手机凭证, 微信凭证]);
    // 其他设备计数 = 非当前会话行数，只从解码快照过滤
    expect(env.最新状态().sessions.data?.filter((行) => !行.current)).toHaveLength(2);
    expect(env.最新状态().sessions.data?.filter((行) => 行.current)).toHaveLength(1);
    // 唯一掩码手机号行来自服务端 display，本层不构造掩码
    const 手机行 = env.最新状态().credentials.data?.filter((行) => 行.provider === 'phone_otp');
    expect(手机行).toHaveLength(1);
    expect(手机行?.[0].display).toBe('+86 138 **** 0000');
  });
});

// ── Step 2：不可变写意图 ───────────────────────────────────────────

describe('P8 换绑与退出其他设备意图', () => {
  it('换绑开始只收 11 位中国大陆手机号：非法输入零请求零意图', async () => {
    for (const 非法 of ['1380000000', '138000000001', '23800000000', '1380000000a', '+8613800000000', '', '   ', '一二三四五六七八九十一']) {
      await expect(env.操作.开始P8手机号换绑(非法)).rejects.toMatchObject({ code: 'invalid_request' });
    }
    expect(env.数据源.开始P8手机号换绑).not.toHaveBeenCalled();
    expect(env.deps.P8待定意图.current.size).toBe(0);
  });

  it('换绑开始成功：键是纯可见 ASCII、11 位裸号进 facade（+86 由 facade 构造）、意图清空', async () => {
    const 尝试 = await env.操作.开始P8手机号换绑(' 13812345678 ');
    expect(尝试).toEqual(换绑尝试);
    expect(vi.mocked(env.数据源.开始P8手机号换绑).mock.calls[0]).toEqual(
      ['13812345678', expect.stringMatching(/^[!-~]{16,128}$/)]);
    expect(vi.mocked(env.数据源.开始P8手机号换绑).mock.calls[0][1]).toHaveLength(36);
    expect(env.deps.P8待定意图.current.size).toBe(0);
  });

  it('换绑开始结果未知/进行中/限流/下游不可用：保留原键与原请求，同键重试', async () => {
    for (const 错误 of [
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'),
      new BFF错误(409, 'idempotency_in_progress', 'in progress'),
      new BFF错误(429, 'rate_limited', 'slow down'),
      new BFF错误(503, 'identity_service_unavailable', 'down'),
    ]) {
      vi.mocked(env.数据源.开始P8手机号换绑).mockReset()
        .mockRejectedValueOnce(错误)
        .mockResolvedValueOnce(换绑尝试);
      await expect(env.操作.开始P8手机号换绑('13812345678')).rejects.toMatchObject({ code: 错误.code });
      // 意图仍在 Map：键 + 不可变请求原样保留
      const 保留 = [...env.deps.P8待定意图.current.values()];
      expect(保留).toHaveLength(1);
      expect(保留[0].request).toEqual({ phone: '13812345678' });
      await env.操作.开始P8手机号换绑('13812345678');
      const 调用 = vi.mocked(env.数据源.开始P8手机号换绑).mock.calls;
      expect(调用[0][1]).toBe(调用[1][1]); // 同键重试
      expect(env.deps.P8待定意图.current.size).toBe(0); // 成功后清意图
    }
  });

  it('换绑开始网络异常保留原键；换手机号 = 新键', async () => {
    vi.mocked(env.数据源.开始P8手机号换绑).mockRejectedValueOnce(new Error('网络断了'));
    await expect(env.操作.开始P8手机号换绑('13812345678')).rejects.toBeInstanceOf(Error);
    expect(env.deps.P8待定意图.current.size).toBe(1);
    await env.操作.开始P8手机号换绑('13812345678'); // 同键重试成功
    const 旧键 = vi.mocked(env.数据源.开始P8手机号换绑).mock.calls[1][1];
    await env.操作.开始P8手机号换绑('13987654321');
    const 调用 = vi.mocked(env.数据源.开始P8手机号换绑).mock.calls;
    expect(调用[2][0]).toBe('13987654321');
    expect(调用[2][1]).not.toBe(旧键); // 换手机号 = 新意图新键
    expect(调用[2][1]).toMatch(/^[!-~]{16,128}$/);
  });

  it('换绑开始 idempotency_conflict 终局：意图清空，下次尝试新键', async () => {
    vi.mocked(env.数据源.开始P8手机号换绑).mockRejectedValueOnce(
      new BFF错误(409, 'idempotency_conflict', 'conflict'));
    await expect(env.操作.开始P8手机号换绑('13812345678'))
      .rejects.toMatchObject({ code: 'idempotency_conflict' });
    expect(env.deps.P8待定意图.current.size).toBe(0);
    await env.操作.开始P8手机号换绑('13812345678');
    const 调用 = vi.mocked(env.数据源.开始P8手机号换绑).mock.calls;
    expect(调用[0][1]).not.toBe(调用[1][1]);
  });

  it('完成换绑执行产品全局 4 位验证码规则：位数不符零请求零意图', async () => {
    const 合法 = '0'.repeat(短信验证码位数);
    for (const 非法 of ['0'.repeat(短信验证码位数 - 1), '0'.repeat(短信验证码位数 + 1), '051a', '', '一二三四']) {
      await expect(env.操作.完成P8手机号换绑('att_1', 非法)).rejects.toMatchObject({ code: 'invalid_request' });
    }
    await expect(env.操作.完成P8手机号换绑('', 合法)).rejects.toMatchObject({ code: 'invalid_request' });
    expect(env.数据源.完成P8手机号换绑).not.toHaveBeenCalled();
    expect(env.deps.P8待定意图.current.size).toBe(0);
    // 合法 4 位照常发出（首尾空白先 trim）
    await env.操作.完成P8手机号换绑('att_1', ` ${合法} `);
    expect(vi.mocked(env.数据源.完成P8手机号换绑).mock.calls[0]).toEqual(
      ['att_1', 合法, expect.stringMatching(/^[!-~]{16,128}$/)]);
  });

  it('完成换绑与开始换绑各自独立键；成功先强制重读凭证+会话再 resolve，不乐观写掩码手机号', async () => {
    await env.操作.开始P8手机号换绑('13812345678');
    const 开始键 = vi.mocked(env.数据源.开始P8手机号换绑).mock.calls[0][1];
    const 凭证门 = deferred<P8Credential[]>();
    const 会话门 = deferred<P8Session[]>();
    vi.mocked(env.数据源.完成P8手机号换绑).mockResolvedValueOnce(换绑回执);
    vi.mocked(env.数据源.读取P8凭证).mockReturnValueOnce(凭证门.promise);
    vi.mocked(env.数据源.读取P8会话).mockReturnValueOnce(会话门.promise);
    let 已收口 = false;
    const run = env.操作.完成P8手机号换绑('att_1', '0517').then((值) => { 已收口 = true; return 值; });
    await 空转();
    // 两路强制重读都已发出，回执尚未 resolve（此前本用例未读过凭证/会话）
    expect(env.数据源.读取P8凭证).toHaveBeenCalledTimes(1);
    expect(env.数据源.读取P8会话).toHaveBeenCalledTimes(1);
    expect(已收口).toBe(false);
    const 完成键 = vi.mocked(env.数据源.完成P8手机号换绑).mock.calls[0][2];
    expect(完成键).not.toBe(开始键); // begin/complete 独立键
    expect(完成键).toMatch(/^[!-~]{16,128}$/);
    凭证门.resolve([新手机凭证]);
    await 空转();
    expect(已收口).toBe(false); // 会话重读未落定：仍不 resolve
    会话门.resolve([当前会话]);
    await expect(run).resolves.toEqual(换绑回执);
    expect(已收口).toBe(true);
    // 凭证快照来自权威重读，不是回执乐观写（回执与重读数据一致只是巧合断言字段不同：display 来自重读）
    expect(env.最新状态().credentials.data).toEqual([新手机凭证]);
    expect(env.最新状态().sessions.data).toEqual([当前会话]);
    expect(env.deps.P8待定意图.current.size).toBe(0);
  });

  it('完成换绑不乐观写：回执掩码手机号绝不先于权威重读落快照', async () => {
    await env.操作.加载P8凭证(); // 先有一份旧成功数据（+86 138 **** 0000）
    const 凭证门 = deferred<P8Credential[]>();
    const 会话门 = deferred<P8Session[]>();
    vi.mocked(env.数据源.完成P8手机号换绑).mockResolvedValueOnce({
      ...换绑回执, credential: { ...新手机凭证, display: '+86 999 **** 9999' },
    });
    vi.mocked(env.数据源.读取P8凭证).mockReturnValueOnce(凭证门.promise);
    vi.mocked(env.数据源.读取P8会话).mockReturnValueOnce(会话门.promise);
    const run = env.操作.完成P8手机号换绑('att_1', '0517');
    await 空转();
    // 重读未落定：快照仍是旧成功数据（刷新中），绝不出现回执里的掩码手机号
    expect(env.最新状态().credentials).toMatchObject({
      phase: 'success', refreshing: true, data: [手机凭证],
    });
    expect(JSON.stringify(env.最新状态())).not.toContain('999 **** 9999');
    凭证门.resolve([新手机凭证]);
    会话门.resolve([当前会话]);
    await run;
    expect(env.最新状态().credentials.data).toEqual([新手机凭证]); // 只来自权威重读
    expect(JSON.stringify(env.最新状态())).not.toContain('999 **** 9999');
  });

  it('完成换绑结果未知保留原键与原请求；同 attempt 同码同键，换码/换 attempt 新键', async () => {
    vi.mocked(env.数据源.完成P8手机号换绑).mockRejectedValueOnce(
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    vi.mocked(env.数据源.读取P8凭证).mockResolvedValue([新手机凭证]);
    vi.mocked(env.数据源.读取P8会话).mockResolvedValue([当前会话]);
    await expect(env.操作.完成P8手机号换绑('att_1', '0517'))
      .rejects.toMatchObject({ code: 'operation_outcome_unknown' });
    const 保留 = [...env.deps.P8待定意图.current.values()];
    expect(保留).toHaveLength(1);
    expect(保留[0].request).toEqual({ attemptId: 'att_1', code: '0517' });
    // 同 attempt 同码：同键重试成功
    await env.操作.完成P8手机号换绑('att_1', '0517');
    const 调用 = vi.mocked(env.数据源.完成P8手机号换绑).mock.calls;
    expect(调用[0][2]).toBe(调用[1][2]);
    // 换码 = 新键
    await env.操作.完成P8手机号换绑('att_1', '0518');
    expect(调用[2][2]).not.toBe(调用[1][2]);
    // 换 attempt = 新键
    await env.操作.完成P8手机号换绑('att_2', '0518');
    expect(调用[3][2]).not.toBe(调用[2][2]);
    expect(env.deps.P8待定意图.current.size).toBe(0);
  });

  it('完成换绑 credential_replacement_conflict / idempotency_conflict 终局：清意图、原样抛出', async () => {
    for (const code of ['credential_replacement_conflict', 'idempotency_conflict'] as const) {
      vi.mocked(env.数据源.完成P8手机号换绑).mockRejectedValueOnce(new BFF错误(409, code, 'x'));
      await expect(env.操作.完成P8手机号换绑('att_1', '0517')).rejects.toMatchObject({ code });
      expect(env.deps.P8待定意图.current.size).toBe(0);
    }
  });

  it('退出其他设备：未知结果 reject 保留原键，同键重试成功后权威重读会话并返回回执计数', async () => {
    vi.mocked(env.数据源.退出P8其他设备).mockRejectedValueOnce(
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    await expect(env.操作.退出P8其他设备()).rejects.toMatchObject({ code: 'operation_outcome_unknown' });
    expect(env.deps.P8待定意图.current.size).toBe(1);
    vi.mocked(env.数据源.退出P8其他设备).mockResolvedValueOnce(2);
    vi.mocked(env.数据源.读取P8会话).mockResolvedValueOnce([当前会话, 其他会话('sess_2')]);
    const 读调用前 = vi.mocked(env.数据源.读取P8会话).mock.calls.length;
    const 计数 = await env.操作.退出P8其他设备();
    expect(计数).toBe(2);
    expect(vi.mocked(env.数据源.退出P8其他设备).mock.calls[0][0])
      .toBe(vi.mocked(env.数据源.退出P8其他设备).mock.calls[1][0]);
    expect(vi.mocked(env.数据源.退出P8其他设备).mock.calls[0][0]).toMatch(/^[!-~]{16,128}$/);
    // 成功后权威重读会话（不读凭证）
    expect(vi.mocked(env.数据源.读取P8会话).mock.calls.length).toBeGreaterThan(读调用前);
    expect(env.最新状态().sessions.data).toEqual([当前会话, 其他会话('sess_2')]);
    expect(env.deps.P8待定意图.current.size).toBe(0);
  });

  it('退出其他设备进行中/网络异常保留原键', async () => {
    vi.mocked(env.数据源.退出P8其他设备).mockRejectedValueOnce(
      new BFF错误(409, 'idempotency_in_progress', 'in progress'));
    await expect(env.操作.退出P8其他设备()).rejects.toMatchObject({ code: 'idempotency_in_progress' });
    vi.mocked(env.数据源.退出P8其他设备).mockRejectedValueOnce(new Error('网络断了'));
    await expect(env.操作.退出P8其他设备()).rejects.toBeInstanceOf(Error);
    expect(env.deps.P8待定意图.current.size).toBe(1);
    vi.mocked(env.数据源.退出P8其他设备).mockResolvedValueOnce(0);
    vi.mocked(env.数据源.读取P8会话).mockResolvedValue([当前会话]);
    await env.操作.退出P8其他设备();
    const 调用 = vi.mocked(env.数据源.退出P8其他设备).mock.calls;
    expect(调用[0][0]).toBe(调用[2][0]); // 三次都是同一把键
    expect(env.deps.P8待定意图.current.size).toBe(0);
  });

  it('退出其他设备 idempotency_conflict 终局：清意图、下次新键', async () => {
    vi.mocked(env.数据源.退出P8其他设备).mockRejectedValueOnce(
      new BFF错误(409, 'idempotency_conflict', 'conflict'));
    await expect(env.操作.退出P8其他设备()).rejects.toMatchObject({ code: 'idempotency_conflict' });
    expect(env.deps.P8待定意图.current.size).toBe(0);
    vi.mocked(env.数据源.退出P8其他设备).mockResolvedValueOnce(0);
    vi.mocked(env.数据源.读取P8会话).mockResolvedValue([当前会话]);
    await env.操作.退出P8其他设备();
    const 调用 = vi.mocked(env.数据源.退出P8其他设备).mock.calls;
    expect(调用[0][0]).not.toBe(调用[1][0]);
  });

  it('退出其他设备在飞单飞：重复点击并入同一 Promise 只发一次请求', async () => {
    const 门 = deferred<number>();
    vi.mocked(env.数据源.退出P8其他设备).mockReturnValueOnce(门.promise);
    const a = env.操作.退出P8其他设备();
    const b = env.操作.退出P8其他设备();
    expect(env.数据源.退出P8其他设备).toHaveBeenCalledTimes(1);
    门.resolve(3);
    expect(await Promise.all([a, b])).toEqual([3, 3]);
    expect(env.deps.P8待定意图.current.size).toBe(0);
  });

  it('换绑开始/完成在飞单飞：重复点击并入同一 Promise，不铸第二把键', async () => {
    const 开始门 = deferred<P8ReplacementAttempt>();
    vi.mocked(env.数据源.开始P8手机号换绑).mockReturnValueOnce(开始门.promise);
    const a = env.操作.开始P8手机号换绑('13812345678');
    const b = env.操作.开始P8手机号换绑('13812345678');
    expect(env.数据源.开始P8手机号换绑).toHaveBeenCalledTimes(1);
    开始门.resolve(换绑尝试);
    await Promise.all([a, b]);

    const 完成门 = deferred<P8ReplacementResult>();
    vi.mocked(env.数据源.完成P8手机号换绑).mockReturnValueOnce(完成门.promise);
    vi.mocked(env.数据源.读取P8凭证).mockResolvedValue([新手机凭证]);
    vi.mocked(env.数据源.读取P8会话).mockResolvedValue([当前会话]);
    const c = env.操作.完成P8手机号换绑('att_1', '0517');
    const d = env.操作.完成P8手机号换绑('att_1', '0517');
    expect(env.数据源.完成P8手机号换绑).toHaveBeenCalledTimes(1);
    完成门.resolve(换绑回执);
    await Promise.all([c, d]);
  });

  it('中文意图坐标绝不进数据源键参数：全部键参数都是纯可见 ASCII', async () => {
    vi.mocked(env.数据源.开始P8手机号换绑).mockRejectedValueOnce(
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    vi.mocked(env.数据源.完成P8手机号换绑).mockRejectedValueOnce(
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    vi.mocked(env.数据源.退出P8其他设备).mockRejectedValueOnce(
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    await expect(env.操作.开始P8手机号换绑('13812345678')).rejects.toMatchObject({ code: 'operation_outcome_unknown' });
    await expect(env.操作.完成P8手机号换绑('att_一', '0517')).rejects.toMatchObject({ code: 'operation_outcome_unknown' });
    await expect(env.操作.退出P8其他设备()).rejects.toMatchObject({ code: 'operation_outcome_unknown' });
    expect([...env.deps.P8待定意图.current.keys()].join('\n')).toMatch(/[一-鿿]/); // 坐标含中文
    const 全部键 = [
      ...vi.mocked(env.数据源.开始P8手机号换绑).mock.calls.map((调用) => 调用[1]),
      ...vi.mocked(env.数据源.完成P8手机号换绑).mock.calls.map((调用) => 调用[2]),
      ...vi.mocked(env.数据源.退出P8其他设备).mock.calls.map((调用) => 调用[0]),
    ];
    expect(全部键).toHaveLength(3);
    for (const 键 of 全部键) expect(键).toMatch(/^[!-~]{16,128}$/);
  });

  it('当前会话 401：清账号状态后原样抛出（写路径 rethrow，屏幕走登录恢复）', async () => {
    await env.操作.加载P8凭证();
    vi.mocked(env.数据源.退出P8其他设备).mockRejectedValueOnce(
      new BFF错误(401, 'invalid_session', 'expired'));
    await expect(env.操作.退出P8其他设备()).rejects.toMatchObject({ code: 'invalid_session' });
    expect(env.最新状态().已登录).toBe(false);
    expect(env.最新状态().credentials.phase).toBe('idle');
    expect(env.deps.P8待定意图.current.size).toBe(0);
  });

  it('栅栏已换代的迟到写 401 只丢弃：不清新会话、不误删新意图', async () => {
    const 门 = deferred<number>();
    vi.mocked(env.数据源.退出P8其他设备).mockReturnValueOnce(门.promise);
    const run = env.操作.退出P8其他设备();
    env.deps.主体标识引用.current = 'sub_2';
    env.deps.会话代际.current += 1;
    门.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(run).rejects.toMatchObject({ code: 'invalid_session' });
    expect(env.最新状态().已登录).toBe(true); // 新会话未被登出
  });
});

// ── 错误文案 ───────────────────────────────────────────────────────

describe('P8 错误文案', () => {
  it('取P8错误文案 冻结闭合表：未知码不透传英文 message', () => {
    expect(取P8错误文案(new BFF错误(401, 'invalid_session', 'expired'))).toBe('登录已失效，请重新登录');
    expect(取P8错误文案(new BFF错误(503, 'identity_service_unavailable', 'down')))
      .toBe('账号服务暂时不可用，请稍后重试');
    expect(取P8错误文案(new BFF错误(503, 'operation_outcome_unknown', 'unknown')))
      .toBe('暂时无法确认操作是否成功，请稍后重试');
    expect(取P8错误文案(new BFF错误(409, 'idempotency_in_progress', 'x')))
      .toBe('操作仍在处理中，请稍后重试');
    expect(取P8错误文案(new BFF错误(409, 'idempotency_conflict', 'x')))
      .toBe('操作状态发生冲突，请刷新后确认');
    expect(取P8错误文案(new BFF错误(409, 'credential_replacement_conflict', 'x')))
      .toBe('验证码不正确或已过期，请重新获取后再试');
    expect(取P8错误文案(new BFF错误(429, 'rate_limited', 'x'))).toBe('操作过于频繁，请稍后再试');
    expect(取P8错误文案(new BFF错误(400, 'invalid_request_body', 'bad')))
      .toBe('请求内容无法处理，请检查输入后重试');
    expect(取P8错误文案(new BFF错误(403, 'invalid_origin', 'x'))).toBe('当前后端环境配置不正确');
    expect(取P8错误文案(new BFF错误(200, 'invalid_response', 'drift'))).toBe('服务返回异常，请稍后重试');
    // 本模块请求前自铸的 invalid_request 带固定中文文案
    expect(取P8错误文案(new BFF错误(0, 'invalid_request', '请输入 11 位中国大陆手机号')))
      .toBe('请输入 11 位中国大陆手机号');
    expect(取P8错误文案(new BFF错误(0, 'network_error', '网络连接失败，请稍后再试')))
      .toBe('无法连接后端服务，请检查网络或稍后重试');
    expect(取P8错误文案(new BFF错误(503, 'downstream_unavailable', 'x')))
      .toBe('后端服务暂时不可用，请稍后重试');
    // 未知错误码：固定兜底文案，绝不透传英文 message
    expect(取P8错误文案(new BFF错误(400, 'some_unknown_code', 'English backend message')))
      .toBe('请求失败，请稍后重试');
    expect(取P8错误文案(new Error('plain network error'))).toBe('网络连接失败，请稍后再试');
  });
});

// ── Step 3：清理与可见范围 ─────────────────────────────────────────

describe('P8 清理与可见范围', () => {
  it('清P8控制面引用 清空锁与意图、复位可见并递增范围代际；在飞读迟到整包丢弃', async () => {
    const 门 = deferred<P8Session[]>();
    vi.mocked(env.数据源.读取P8会话).mockReturnValueOnce(门.promise);
    const run = env.操作.加载P8会话();
    const 代际前 = env.deps.P8范围代际.current;
    env.deps.P8待定意图.current.set('p8:退出其他设备', { key: 'k', request: {} });
    env.deps.P8账号可见.current = true;
    清P8控制面引用(env.deps);
    expect(env.deps.P8读取锁.current.size).toBe(0);
    expect(env.deps.P8待定意图.current.size).toBe(0);
    expect(env.deps.P8账号可见.current).toBe(false);
    expect(env.deps.P8范围代际.current).toBe(代际前 + 1);
    门.resolve([当前会话]); // 换代后迟到：整包丢弃
    await run;
    expect(env.最新状态().sessions.data).toBeNull();
  });

  it('设置P8账号范围 只写可见引用：不递增范围代际，在飞读照常提交共享快照', async () => {
    const 门 = deferred<P8Session[]>();
    vi.mocked(env.数据源.读取P8会话).mockReturnValueOnce(门.promise);
    const run = env.操作.加载P8会话();
    const 代际前 = env.deps.P8范围代际.current;
    env.操作.设置P8账号范围(false); // UI 卸载 ≠ 会话边界
    expect(env.deps.P8账号可见.current).toBe(false);
    expect(env.deps.P8范围代际.current).toBe(代际前);
    expect(env.deps.P8读取锁.current.size).toBe(1); // 锁不被清
    门.resolve([当前会话]);
    await run;
    expect(env.最新状态().sessions.data).toEqual([当前会话]); // subject/会话栅栏仍立：照常提交
    env.操作.设置P8账号范围(true);
    expect(env.deps.P8账号可见.current).toBe(true);
    expect(env.数据源.读取P8会话).toHaveBeenCalledTimes(1); // 范围登记零请求
  });

  it('Mock 模式零 P8 请求：读静默、写拒绝 backend_unavailable', async () => {
    const mock环境 = 创建P8操作测试环境(false);
    await expect(mock环境.操作.加载P8凭证()).resolves.toBeUndefined();
    await expect(mock环境.操作.加载P8会话()).resolves.toBeUndefined();
    await expect(mock环境.操作.开始P8手机号换绑('13812345678'))
      .rejects.toMatchObject({ code: 'backend_unavailable' });
    await expect(mock环境.操作.完成P8手机号换绑('att_1', '0517'))
      .rejects.toMatchObject({ code: 'backend_unavailable' });
    await expect(mock环境.操作.退出P8其他设备())
      .rejects.toMatchObject({ code: 'backend_unavailable' });
    mock环境.操作.设置P8账号范围(true);
    expect(mock环境.deps.P8账号可见.current).toBe(true);
    expect(mock环境.数据源.读取P8凭证).not.toHaveBeenCalled();
    expect(mock环境.数据源.读取P8会话).not.toHaveBeenCalled();
    expect(mock环境.数据源.开始P8手机号换绑).not.toHaveBeenCalled();
    expect(mock环境.数据源.完成P8手机号换绑).not.toHaveBeenCalled();
    expect(mock环境.数据源.退出P8其他设备).not.toHaveBeenCalled();
  });
});
