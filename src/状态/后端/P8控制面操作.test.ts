// P8 Task 3：账号安全运行时状态的行为测试 —— 凭证/会话两块资源的独立结算、
// 单飞与 force 换代接管、旧成功数据不降级、subject/session/范围三代栅栏对迟到成败的
// 整包丢弃、换绑开始/完成与退出其他设备的意图键生命周期（独立键、四位验证码、
// 未知/进行中同键重放、终局冲突清键、换手机号/换 attempt/换码新键、并发点击并入同一
// Promise）、当前会话 401 统一清账号、引用级清理与 UI 可见范围的边界。受控 deferred
// promise 证明「完成换绑成功先强制重读两资源再 resolve」与「不乐观写掩码手机号」；
// 派发 只是 spy，全部断言读 最新状态()。快照/锁/意图只在内存，绝不进持久化。
// P8 Task 5：数据导出与账号注销 —— 恢复句柄先落盘后 POST、响应丢失同键重放、
// null-ID 只重放 POST / 有 ID 只 GET、跨主体键隔离、404/expired 清句柄、显式重新生成
// 铸新键、ready+downloadReady 唯一可下载组合与 facade URL 委托、注销 {} 契约、
// 单飞、未知结果同键 1s/2s 至多两次显式重放、202 统一清 P4–P8 后才 resolve。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF主体 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import {
  创建P8控制面数据源,
  type P8AccountDeletion,
  type P8Credential,
  type P8DataExport,
  type P8ReplacementAttempt,
  type P8ReplacementResult,
  type P8Session,
} from '../../数据/招聘数据源/P8控制面';
import { BFF错误, type BFF请求选项, type BFF响应 } from '../../数据/HTTP客户端';
import { 短信验证码位数 } from '../../数据/验证码规则';
import { BFF主体样本 } from '../../测试/BFF样本';
import { 创建P8导出恢复存储, type P8导出恢复存储 } from '../../数据/P8导出恢复';
import { 账号存储键 } from '../../数据/资料缓存';
import { 初始状态 } from '../初始状态';
import type { 动作 } from '../应用状态';
import { 创建空P4发现状态 } from './发现推荐操作';
import { 创建空P5MatchCase状态 } from './MatchCase操作';
import { 创建空P7会话状态 } from './真人会话操作';
import { 清账号状态 } from './会话操作';
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
  P8账号控制面操作,
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

// ── Task 5 DTO 样本：导出五态 × downloadReady 与注销回执 ──

const 导出ID甲 = `exp_${'0123456789abcdef'.repeat(2)}`;
const 导出ID乙 = `exp_${'fedcba9876543210'.repeat(2)}`;

function 导出DTO(覆盖: Partial<P8DataExport> = {}): P8DataExport {
  return {
    exportId: 导出ID甲,
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

/**
 * Task 5：受控恢复存储 —— 包住真实 创建P8导出恢复存储（键位 / 校验 / 序列化语义保真），
 * 以 vi.fn 追踪写入与删除（invocationCallOrder 断言用）；多个账号可共享同一底层 Map，
 * 用于断言跨主体键隔离。
 */
function 创建恢复存储桩(账号: string, 底层?: Map<string, string>) {
  const 仓 = 底层 ?? new Map<string, string>();
  const 范围 = { 模式: 'backend' as const, 环境: 'stg' as const, 账号 };
  const 原生 = 创建P8导出恢复存储({
    storage: {
      getItem: (键: string) => 仓.get(键) ?? null,
      setItem: (键: string, 值: string) => { 仓.set(键, 值); },
      removeItem: (键: string) => { 仓.delete(键); },
    },
    范围,
  });
  return {
    仓,
    键: 账号存储键('P8数据导出v1', 范围),
    读取: vi.fn(原生.读取),
    写入: vi.fn(原生.写入),
    删除: vi.fn(原生.删除),
  };
}

/** 本文件内的数据源桩：桩 P8 facade 全部方法 + 清空目录缓存，默认全成功，逐测试覆盖替换。 */
function 创建P8数据源(覆盖: Record<string, unknown> = {}): HTTP招聘数据源 {
  return {
    读取P8凭证: vi.fn(async (): Promise<P8Credential[]> => [手机凭证]),
    读取P8会话: vi.fn(async (): Promise<P8Session[]> => [当前会话]),
    开始P8手机号换绑: vi.fn(async (): Promise<P8ReplacementAttempt> => 换绑尝试),
    完成P8手机号换绑: vi.fn(async (): Promise<P8ReplacementResult> => 换绑回执),
    退出P8其他设备: vi.fn(async (): Promise<number> => 1),
    创建P8数据导出: vi.fn(async (): Promise<P8DataExport> => 导出DTO()),
    读取P8数据导出: vi.fn(async (id: string): Promise<P8DataExport> => 导出DTO({ exportId: id, status: 'running' })),
    取P8数据导出下载地址: vi.fn((id: string): string => `/api/v1/me/data-exports/${id}/download`),
    请求P8账号注销: vi.fn(async (): Promise<P8AccountDeletion> => 注销回执),
    清空目录缓存: vi.fn(),
    ...覆盖,
  } as unknown as HTTP招聘数据源;
}

interface P8操作测试环境 {
  数据源: HTTP招聘数据源;
  deps: 后端操作依赖 & P8运行时引用;
  派发: ReturnType<typeof vi.fn>;
  恢复存储: ReturnType<typeof 创建恢复存储桩>;
  操作: P8账号控制面操作;
  最新状态(): 后端状态;
}

function 创建P8操作测试环境(
  是后端 = true,
  源 = 创建P8数据源(),
  恢复存储: ReturnType<typeof 创建恢复存储桩> = 创建恢复存储桩('sub_1'),
): P8操作测试环境 {
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
    P8导出恢复: { current: 恢复存储 as P8导出恢复存储 },
  };
  return {
    数据源: 源,
    deps,
    派发,
    恢复存储,
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

// ── Task 5：数据导出 —— 恢复句柄与创建纪律 ────────────────────────

describe('P8 数据导出：恢复句柄与创建纪律', () => {
  it('创建先落盘 {exportId:null} 再 POST：写入严格先于请求，回执 exportId 事后补写', async () => {
    await env.操作.创建P8数据导出();
    const 后端 = vi.mocked(env.数据源.创建P8数据导出);
    const 写入 = env.恢复存储.写入;
    expect(写入.mock.calls[0][0]).toMatchObject({ subjectId: 'sub_1', exportId: null });
    expect(写入.mock.invocationCallOrder[0]).toBeLessThan(后端.mock.invocationCallOrder[0]);
    const 键 = 后端.mock.calls[0][0];
    expect(键).toMatch(/^[!-~]{16,128}$/);
    expect(写入.mock.calls.at(-1)?.[0]).toEqual({ subjectId: 'sub_1', createKey: 键, exportId: 导出ID甲 });
    expect(env.最新状态().dataExport).toMatchObject({ phase: 'success', data: 导出DTO(), error: null });
    expect(env.deps.P8待定意图.current.size).toBe(0);
  });

  it('POST 响应丢失（网络异常）：exportId:null 句柄保留，重试同键重放后补写 ID', async () => {
    vi.mocked(env.数据源.创建P8数据导出).mockRejectedValueOnce(new Error('网络断了'));
    await expect(env.操作.创建P8数据导出()).rejects.toBeInstanceOf(Error);
    expect(JSON.parse(env.恢复存储.仓.get(env.恢复存储.键) ?? '')).toEqual({
      subjectId: 'sub_1',
      createKey: expect.stringMatching(/^[!-~]{8,128}$/),
      exportId: null,
    });
    await env.操作.创建P8数据导出();
    const 调用 = vi.mocked(env.数据源.创建P8数据导出).mock.calls;
    expect(调用[0][0]).toBe(调用[1][0]); // 同键重放
    expect(env.恢复存储.读取()?.exportId).toBe(导出ID甲);
    expect(env.最新状态().dataExport).toMatchObject({ phase: 'success' });
  });

  it('恢复遇到 exportId:null 句柄：用落盘 createKey 重放 POST，不铸第二把键', async () => {
    env.恢复存储.写入({ subjectId: 'sub_1', createKey: 'p8-export-key-0001', exportId: null });
    await env.操作.恢复P8数据导出();
    expect(env.数据源.创建P8数据导出).toHaveBeenCalledTimes(1);
    expect(env.数据源.创建P8数据导出).toHaveBeenCalledWith('p8-export-key-0001');
    expect(env.数据源.读取P8数据导出).not.toHaveBeenCalled();
    expect(env.恢复存储.读取()?.exportId).toBe(导出ID甲);
  });

  it('恢复遇到有 ID 句柄：只权威 GET，零 POST；创建同样只 GET，绝不向已有导出再 POST', async () => {
    env.恢复存储.写入({ subjectId: 'sub_1', createKey: 'p8-export-key-0001', exportId: 导出ID甲 });
    await env.操作.恢复P8数据导出();
    expect(env.数据源.读取P8数据导出).toHaveBeenCalledWith(导出ID甲);
    expect(env.数据源.创建P8数据导出).not.toHaveBeenCalled();
    expect(env.最新状态().dataExport).toMatchObject({ phase: 'success', data: { exportId: 导出ID甲 } });
    await env.操作.创建P8数据导出(); // 有 ID 时创建退化为权威 GET
    expect(env.数据源.创建P8数据导出).not.toHaveBeenCalled();
    expect(vi.mocked(env.数据源.读取P8数据导出).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('适配器缺席：创建拒绝固定「数据导出暂不可用」且零 POST；恢复/刷新零请求；废弃 no-throw', async () => {
    env.deps.P8导出恢复.current = null;
    let 文案 = '';
    try {
      await env.操作.创建P8数据导出();
    } catch (错误) {
      文案 = 取P8错误文案(错误);
    }
    expect(文案).toBe('数据导出暂不可用，请稍后重试');
    expect(env.数据源.创建P8数据导出).not.toHaveBeenCalled();
    await expect(env.操作.恢复P8数据导出()).resolves.toBeUndefined();
    await expect(env.操作.刷新P8数据导出()).resolves.toBeUndefined();
    expect(env.数据源.读取P8数据导出).not.toHaveBeenCalled();
    expect(env.数据源.创建P8数据导出).not.toHaveBeenCalled();
    expect(() => env.操作.废弃P8数据导出()).not.toThrow();
    expect(env.操作.取P8数据导出下载地址()).toBeNull();
  });

  it('落盘失败（写入返回 false）：固定暂不可用文案且零 POST 调用', async () => {
    env.恢复存储.写入.mockReturnValueOnce(false);
    let 文案 = '';
    try {
      await env.操作.创建P8数据导出();
    } catch (错误) {
      文案 = 取P8错误文案(错误);
    }
    expect(文案).toBe('数据导出暂不可用，请稍后重试');
    expect(env.数据源.创建P8数据导出).not.toHaveBeenCalled();
    expect(env.deps.P8待定意图.current.size).toBe(0);
  });

  it('普通登出保留句柄：同主体重登后恢复只 GET，不再 POST（spec §5.3）', async () => {
    await env.操作.创建P8数据导出();
    const POST数 = vi.mocked(env.数据源.创建P8数据导出).mock.calls.length;
    // 登出 = 统一 清账号状态：P8 快照/引用整域摊平，但导出句柄是按 subject 隔离的恢复坐标
    清账号状态(env.deps);
    expect(env.最新状态().已登录).toBe(false);
    expect(env.恢复存储.读取()?.exportId).toBe(导出ID甲); // 句柄仍在
    // 同主体重新登录：会话代际前进、主体标识复位
    env.deps.主体标识引用.current = 'sub_1';
    env.deps.会话代际.current += 1;
    await env.操作.恢复P8数据导出();
    expect(env.数据源.创建P8数据导出).toHaveBeenCalledTimes(POST数); // 零新 POST
    expect(env.数据源.读取P8数据导出).toHaveBeenCalledWith(导出ID甲);
    expect(env.最新状态().dataExport).toMatchObject({ phase: 'success' });
  });

  it('换主体只写新主体的键：A 的句柄逐字节不变，跨账号互不可见互不覆盖', async () => {
    const 共享仓 = new Map<string, string>();
    const A存储 = 创建恢复存储桩('sub_1', 共享仓);
    const B存储 = 创建恢复存储桩('sub_B', 共享仓);
    env.deps.P8导出恢复.current = A存储 as P8导出恢复存储;
    await env.操作.创建P8数据导出();
    const A原文 = 共享仓.get(A存储.键);
    expect(A原文).toContain('"exportId"');
    // 同一 Provider 实例切换主体：适配器换绑到 B（Provider 在主体变化时重指 ref）
    env.deps.P8导出恢复.current = B存储 as P8导出恢复存储;
    env.deps.主体标识引用.current = 'sub_B';
    await env.操作.创建P8数据导出();
    expect([...共享仓.keys()].sort()).toEqual([A存储.键, B存储.键].sort());
    expect(共享仓.get(A存储.键)).toBe(A原文); // A 逐字节不变
    expect(JSON.parse(共享仓.get(B存储.键) ?? '')).toMatchObject({ subjectId: 'sub_B' });
  });

  it('跨设备冲突：无本地句柄时 create 只得 409 export_in_progress，固定文案且不残留死键', async () => {
    vi.mocked(env.数据源.创建P8数据导出).mockRejectedValueOnce(
      new BFF错误(409, 'export_in_progress', 'another export active'));
    let 文案 = '';
    try {
      await env.操作.创建P8数据导出();
    } catch (错误) {
      文案 = 取P8错误文案(错误);
    }
    expect(文案).toBe('已有导出正在生成或等待下载，请稍后重试');
    // 终局拒绝：预写的 {exportId:null} 句柄是死键，回滚删除，下一次创建铸新键
    expect(env.恢复存储.读取()).toBeNull();
    expect(env.deps.P8待定意图.current.size).toBe(0);
  });

  it('failed 明确重新生成：废弃清旧句柄后创建铸新键（旧键不再重放）', async () => {
    await env.操作.创建P8数据导出();
    vi.mocked(env.数据源.读取P8数据导出).mockResolvedValueOnce(导出DTO({ status: 'failed' }));
    await env.操作.刷新P8数据导出();
    expect(env.最新状态().dataExport.data?.status).toBe('failed');
    expect(env.恢复存储.读取()?.exportId).toBe(导出ID甲); // failed 不自动清（404/expired 才清）
    // 页面「重新生成」= 废弃（清句柄 + 摊平快照）+ 创建（新键）
    env.操作.废弃P8数据导出();
    expect(env.恢复存储.读取()).toBeNull();
    expect(env.最新状态().dataExport).toEqual({
      phase: 'idle', refreshing: false, data: null, error: null, generation: expect.any(Number),
    });
    vi.mocked(env.数据源.创建P8数据导出).mockResolvedValueOnce(导出DTO({ exportId: 导出ID乙 }));
    await env.操作.创建P8数据导出();
    const 键们 = vi.mocked(env.数据源.创建P8数据导出).mock.calls.map((调用) => 调用[0]);
    expect(键们[1]).not.toBe(键们[0]); // 新键
    expect(env.恢复存储.读取()).toMatchObject({ createKey: 键们[1], exportId: 导出ID乙 });
  });
});

// ── Task 5：数据导出 —— 读取、下载地址与失效清理 ────────────────────

describe('P8 数据导出：读取、下载地址与失效清理', () => {
  it('ready+downloadReady 是唯一可下载组合：其余一律 null；URL 委托 facade', async () => {
    const 组合: Array<[P8DataExport['status'], boolean]> = [
      ['queued', false], ['running', false], ['ready', false], ['failed', false],
      ['expired', false], ['expired', true], ['failed', true], ['running', true], ['queued', true],
    ];
    for (const [status, downloadReady] of 组合) {
      // 每轮重新播句柄（expired 轮会清掉它）
      env.恢复存储.写入({ subjectId: 'sub_1', createKey: 'p8-export-key-0001', exportId: 导出ID甲 });
      vi.mocked(env.数据源.读取P8数据导出).mockReset()
        .mockResolvedValueOnce(导出DTO({ status, downloadReady }));
      await env.操作.刷新P8数据导出();
      expect(env.最新状态().dataExport.data).toMatchObject({ status, downloadReady });
      expect(env.操作.取P8数据导出下载地址()).toBeNull();
    }
    // 唯一组合：URL 严格来自 facade（同源相对地址由 facade 校验构造）
    env.恢复存储.写入({ subjectId: 'sub_1', createKey: 'p8-export-key-0001', exportId: 导出ID甲 });
    vi.mocked(env.数据源.读取P8数据导出).mockReset().mockResolvedValueOnce(
      导出DTO({ status: 'ready', downloadReady: true, expiresAt: '2026-09-05T00:00:00Z' }));
    await env.操作.刷新P8数据导出();
    expect(env.操作.取P8数据导出下载地址()).toBe(`/api/v1/me/data-exports/${导出ID甲}/download`);
    expect(env.数据源.取P8数据导出下载地址).toHaveBeenCalledWith(导出ID甲);
  });

  it('GET 404 data_export_not_found：清句柄、快照落「已失效」文案（回到可创建态）', async () => {
    env.恢复存储.写入({ subjectId: 'sub_1', createKey: 'p8-export-key-0001', exportId: 导出ID甲 });
    vi.mocked(env.数据源.读取P8数据导出).mockRejectedValueOnce(
      new BFF错误(404, 'data_export_not_found', 'gone'));
    await env.操作.恢复P8数据导出();
    expect(env.恢复存储.读取()).toBeNull();
    expect(env.最新状态().dataExport).toMatchObject({ phase: 'error', error: '导出已失效，请重新生成' });
  });

  it('GET 返回 expired：清句柄；快照保留 expired 终态供页面给「重新生成」', async () => {
    env.恢复存储.写入({ subjectId: 'sub_1', createKey: 'p8-export-key-0001', exportId: 导出ID甲 });
    vi.mocked(env.数据源.读取P8数据导出).mockResolvedValueOnce(导出DTO({ status: 'expired' }));
    await env.操作.恢复P8数据导出();
    expect(env.恢复存储.读取()).toBeNull();
    expect(env.最新状态().dataExport).toMatchObject({ phase: 'success', data: { status: 'expired' } });
  });

  it('导出 GET 单飞：并发刷新并入同一 Promise 只发一次请求', async () => {
    env.恢复存储.写入({ subjectId: 'sub_1', createKey: 'p8-export-key-0001', exportId: 导出ID甲 });
    const 门 = deferred<P8DataExport>();
    vi.mocked(env.数据源.读取P8数据导出).mockReset().mockReturnValueOnce(门.promise);
    const a = env.操作.刷新P8数据导出();
    const b = env.操作.刷新P8数据导出();
    expect(env.数据源.读取P8数据导出).toHaveBeenCalledTimes(1);
    门.resolve(导出DTO({ status: 'running', exportId: 导出ID甲 }));
    await Promise.all([a, b]);
    expect(env.最新状态().dataExport.data).toMatchObject({ status: 'running' });
  });

  it('无任何已知 exportId（快照与句柄皆空）时刷新零请求', async () => {
    await expect(env.操作.刷新P8数据导出()).resolves.toBeUndefined();
    expect(env.数据源.读取P8数据导出).not.toHaveBeenCalled();
  });
});

// ── Task 5：账号注销 ───────────────────────────────────────────────

describe('P8 账号注销', () => {
  it('注销走 Task 1 冻结契约：body 精确 {}、操作层铸可见 ASCII 幂等键', async () => {
    const 请求桩 = vi.fn(async (_选项: BFF请求选项): Promise<BFF响应<unknown>> => ({
      result: {
        deletion_id: `del_${'0123456789abcdef'.repeat(2)}`,
        status: 'deletion_pending',
        retention_until: '2026-09-29T00:00:00Z',
      },
      etag: null,
      requestId: 'fixture',
    }));
    const 真面源 = 创建P8控制面数据源(请求桩 as unknown as <T>(options: BFF请求选项) => Promise<BFF响应<T>>);
    const 本环境 = 创建P8操作测试环境(true, 创建P8数据源({ 请求P8账号注销: 真面源.请求P8账号注销 }));
    await 本环境.操作.请求P8账号注销();
    const 选项 = 请求桩.mock.calls[0][0] as BFF请求选项;
    expect(选项.method).toBe('POST');
    expect(选项.path).toBe('/api/v1/me/account-deletion');
    expect(选项.body).toEqual({}); // 精确 {}：一个多余键都不许有
    expect(选项.幂等键).toMatch(/^[!-~]{16,128}$/);
  });

  it('最终确认单飞：并发两次只发一次 POST，两个调用并入同一结果', async () => {
    const 门 = deferred<P8AccountDeletion>();
    vi.mocked(env.数据源.请求P8账号注销).mockReturnValueOnce(门.promise);
    const a = env.操作.请求P8账号注销();
    const b = env.操作.请求P8账号注销();
    expect(env.数据源.请求P8账号注销).toHaveBeenCalledTimes(1);
    门.resolve(注销回执);
    await expect(Promise.all([a, b])).resolves.toBeDefined();
  });

  it('export_in_progress：原样抛出、不本地登出、清意图（两层弹层留给屏幕处理）', async () => {
    await env.操作.加载P8凭证(); // 账号状态在场
    vi.mocked(env.数据源.请求P8账号注销).mockRejectedValueOnce(
      new BFF错误(409, 'export_in_progress', 'export running'));
    let 文案 = '';
    try {
      await env.操作.请求P8账号注销();
    } catch (错误) {
      文案 = 取P8错误文案(错误);
    }
    expect(文案).toBe('已有导出正在生成或等待下载，请稍后重试');
    expect(env.最新状态().已登录).toBe(true); // 不登出
    expect(env.deps.P8待定意图.current.size).toBe(0);
  });

  it('结果未知：同键 1s/2s 显式重放至多两次；持续不确定原样抛出且保留意图供手动重试', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(env.数据源.请求P8账号注销)
        .mockRejectedValueOnce(new BFF错误(503, 'operation_outcome_unknown', 'unknown'))
        .mockRejectedValueOnce(new BFF错误(503, 'operation_outcome_unknown', 'unknown'))
        .mockRejectedValueOnce(new BFF错误(0, 'network_error', '断网'));
      const run = env.操作.请求P8账号注销();
      // 断言先行挂上：run 的拒绝发生在推进假时钟期间，迟挂会变成未处理 rejection
      const 收口断言 = expect(run).rejects.toMatchObject({ code: 'network_error' });
      await vi.advanceTimersByTimeAsync(0);
      expect(env.数据源.请求P8账号注销).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(env.数据源.请求P8账号注销).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(2_000);
      expect(env.数据源.请求P8账号注销).toHaveBeenCalledTimes(3); // 初发 + 至多两次重放
      await 收口断言; // 固定 P8 未知文案（闭合表）
      const 键们 = () => vi.mocked(env.数据源.请求P8账号注销).mock.calls.map((调用) => 调用[0]);
      expect(new Set(键们()).size).toBe(1); // 三次同一把键，绝不铸第二把
      expect(env.deps.P8待定意图.current.size).toBe(1); // 意图保留
      // 手动重试：同键 → 成功收口并清意图
      vi.mocked(env.数据源.请求P8账号注销).mockResolvedValueOnce(注销回执);
      await env.操作.请求P8账号注销();
      expect(new Set(键们()).size).toBe(1);
      expect(env.deps.P8待定意图.current.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('202：先统一清 P4–P8（登出态 + 目录缓存 + 代际）再 resolve；当前主体导出句柄一并删除', async () => {
    await env.操作.创建P8数据导出(); // 句柄在场
    await env.操作.加载P8凭证();
    const P4范围 = env.deps.P4范围代际;
    const P7意图 = env.deps.P7待定意图;
    if (P4范围 === undefined || P7意图 === undefined) throw new Error('P4/P7 引用未初始化');
    P4范围.current.set('candidate:list:int_1', 3);
    P7意图.current.set('p7:残', { key: 'k', content: 'x' } as never);
    const 代际前 = env.deps.会话代际.current;
    await env.操作.请求P8账号注销();
    const 最新 = env.最新状态();
    expect(最新.已登录).toBe(false);
    expect(最新.主体).toBeNull();
    expect(最新.credentials).toEqual(创建空P8控制面状态().credentials);
    expect(最新.dataExport).toEqual(创建空P8控制面状态().dataExport);
    expect(env.deps.主体标识引用.current).toBeNull();
    expect(P4范围.current.size).toBe(0);
    expect(P7意图.current.size).toBe(0);
    expect(env.deps.P8待定意图.current.size).toBe(0);
    expect(env.deps.会话代际.current).toBeGreaterThan(代际前);
    expect(env.数据源.清空目录缓存).toHaveBeenCalled();
    expect(env.恢复存储.删除).toHaveBeenCalled();
    expect(env.恢复存储.读取()).toBeNull();
  });

  it('重放窗内换会话/换主体：迟到的 202 不摊平新会话、不删新主体句柄，固定文案抛出', async () => {
    vi.useFakeTimers();
    try {
      // 主体 A（sub_1）持有导出句柄；主体 B 的适配器与句柄在场（Provider 主体变化时换绑 ref）
      env.恢复存储.写入({ subjectId: 'sub_1', createKey: 'p8-export-key-0001', exportId: 导出ID甲 });
      const B存储 = 创建恢复存储桩('sub_B');
      B存储.写入({ subjectId: 'sub_B', createKey: 'p8-export-key-0002', exportId: 导出ID乙 });
      // 第一发结果未知（进入 1s 重放窗），第二发挂起 —— 202 在会话换 代后才落定
      const 门 = deferred<P8AccountDeletion>();
      vi.mocked(env.数据源.请求P8账号注销)
        .mockRejectedValueOnce(new BFF错误(503, 'operation_outcome_unknown', 'unknown'))
        .mockReturnValueOnce(门.promise);
      const run = env.操作.请求P8账号注销();
      let 收口错误: unknown = null;
      run.catch((错误) => { 收口错误 = 错误; }); // 只观察；拒绝由下方断言收口
      const 断言 = expect(run).rejects.toMatchObject({ code: 'invalid_request' });
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1_000); // 第二发在飞
      // 重放窗内：A 登出、B 登录 —— 会话代际前进、主体标识换人、ref 换绑到 B 的适配器
      env.deps.主体标识引用.current = 'sub_B';
      env.deps.会话代际.current += 1;
      env.deps.P8导出恢复.current = B存储 as P8导出恢复存储;
      env.deps.设后端状态((旧) => ({
        ...旧,
        已登录: true,
        主体: { ...候选主体, subject_id: 'sub_B' },
        credentials: { phase: 'success', refreshing: false, data: [手机凭证], error: null, generation: 9 },
      }));
      门.resolve(注销回执); // 迟到的 202
      await 断言;
      expect(取P8错误文案(收口错误)).toBe('注销已受理，但会话已切换，请在重新登录后确认');
      // 新会话的登录态与已确认快照原样存活
      const 最新 = env.最新状态();
      expect(最新.已登录).toBe(true);
      expect(最新.主体).toMatchObject({ subject_id: 'sub_B' });
      expect(最新.credentials).toMatchObject({ phase: 'success', data: [手机凭证] });
      // 新主体的导出句柄未被删除（ref 已换绑 —— 收口绝不能顺着 ref 清掉 B 的句柄）
      expect(B存储.删除).not.toHaveBeenCalled();
      expect(B存储.读取()).toMatchObject({ subjectId: 'sub_B', exportId: 导出ID乙 });
      // 统一清理未被触发：目录缓存不动、会话代际不再前进
      expect(env.数据源.清空目录缓存).not.toHaveBeenCalled();
      expect(env.deps.会话代际.current).toBe(2);
      // 旧主体（A）的句柄也未被顺手动过：留给重新登录后的 404 兜底
      expect(env.恢复存储.删除).not.toHaveBeenCalled();
      expect(env.恢复存储.读取()?.exportId).toBe(导出ID甲);
    } finally {
      vi.useRealTimers();
    }
  });

  it('注销不依赖恢复适配器：null 适配器照常收口；句柄清理是尽力而为，删除抛错不冒充注销失败', async () => {
    env.deps.P8导出恢复.current = null;
    await expect(env.操作.请求P8账号注销()).resolves.toBeUndefined();
    expect(env.最新状态().已登录).toBe(false);
    // 适配器在场但 删除 抛异常：202 仍成功收口
    env.deps.主体标识引用.current = 'sub_1';
    env.deps.P8导出恢复.current = {
      ...(env.恢复存储 as unknown as P8导出恢复存储),
      删除: vi.fn(() => { throw new Error('存储被拒'); }),
    };
    vi.mocked(env.数据源.请求P8账号注销).mockResolvedValueOnce(注销回执);
    await expect(env.操作.请求P8账号注销()).resolves.toBeUndefined();
    expect(env.最新状态().已登录).toBe(false);
  });

  it('当前会话 401：统一清账号后原样抛出（写路径 rethrow，屏幕走登录恢复）', async () => {
    await env.操作.加载P8凭证();
    vi.mocked(env.数据源.请求P8账号注销).mockRejectedValueOnce(
      new BFF错误(401, 'invalid_session', 'expired'));
    await expect(env.操作.请求P8账号注销()).rejects.toMatchObject({ code: 'invalid_session' });
    expect(env.最新状态().已登录).toBe(false);
    expect(env.deps.P8待定意图.current.size).toBe(0);
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
    // Task 5：导出/注销两码（创建/注销冲突与导出已失效）
    expect(取P8错误文案(new BFF错误(409, 'export_in_progress', 'x')))
      .toBe('已有导出正在生成或等待下载，请稍后重试');
    expect(取P8错误文案(new BFF错误(404, 'data_export_not_found', 'x')))
      .toBe('导出已失效，请重新生成');
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

  it('Mock 模式零 P8 请求：读静默、写拒绝 backend_unavailable、导出恢复零触碰', async () => {
    const mock环境 = 创建P8操作测试环境(false);
    await expect(mock环境.操作.加载P8凭证()).resolves.toBeUndefined();
    await expect(mock环境.操作.加载P8会话()).resolves.toBeUndefined();
    await expect(mock环境.操作.开始P8手机号换绑('13812345678'))
      .rejects.toMatchObject({ code: 'backend_unavailable' });
    await expect(mock环境.操作.完成P8手机号换绑('att_1', '0517'))
      .rejects.toMatchObject({ code: 'backend_unavailable' });
    await expect(mock环境.操作.退出P8其他设备())
      .rejects.toMatchObject({ code: 'backend_unavailable' });
    // Task 5：导出/注销六法 —— Mock 拒绝或静默，绝不触达恢复存储
    await expect(mock环境.操作.恢复P8数据导出()).resolves.toBeUndefined();
    await expect(mock环境.操作.刷新P8数据导出()).resolves.toBeUndefined();
    await expect(mock环境.操作.创建P8数据导出())
      .rejects.toMatchObject({ code: 'backend_unavailable' });
    await expect(mock环境.操作.请求P8账号注销())
      .rejects.toMatchObject({ code: 'backend_unavailable' });
    expect(mock环境.操作.取P8数据导出下载地址()).toBeNull();
    mock环境.操作.废弃P8数据导出();
    mock环境.操作.设置P8账号范围(true);
    expect(mock环境.deps.P8账号可见.current).toBe(true);
    expect(mock环境.数据源.读取P8凭证).not.toHaveBeenCalled();
    expect(mock环境.数据源.读取P8会话).not.toHaveBeenCalled();
    expect(mock环境.数据源.开始P8手机号换绑).not.toHaveBeenCalled();
    expect(mock环境.数据源.完成P8手机号换绑).not.toHaveBeenCalled();
    expect(mock环境.数据源.退出P8其他设备).not.toHaveBeenCalled();
    expect(mock环境.数据源.创建P8数据导出).not.toHaveBeenCalled();
    expect(mock环境.数据源.读取P8数据导出).not.toHaveBeenCalled();
    expect(mock环境.数据源.取P8数据导出下载地址).not.toHaveBeenCalled();
    expect(mock环境.数据源.请求P8账号注销).not.toHaveBeenCalled();
    expect(mock环境.恢复存储.写入).not.toHaveBeenCalled();
    expect(mock环境.恢复存储.删除).not.toHaveBeenCalled();
  });
});
