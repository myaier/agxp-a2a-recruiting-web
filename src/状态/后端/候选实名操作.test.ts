// Backend 候选实名域操作的行为测试 —— 候选主体 + 会话代际栅栏、GET 单飞（finally 只
// 释放自己的锁）、create/cancel 各自 mutation 锁、稳定幂等键（失败重试复用 / 重置后
// 新铸）、mutation 响应直接提交、create 409 与 cancel 404/409/503 的权威重读对账
// （对账撞上在飞 GET 时等它结算但不采用结果、rejection 吞掉后再发新 GET）、
// 无 pending 零请求取消、当前轮 401 统一清账号、换代后迟到成败/401 整包丢弃，
// 以及 清候选实名引用 的三引用复位。受控 deferred promise 证明原子提交与迟到丢弃；
// 设后端状态 同步更新 后端状态引用.current，模拟真实 Provider。快照只进内存。

import { describe, expect, it, vi } from 'vitest';
import type { BFF主体 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type { 创建候选实名输入, 候选实名摘要 } from '../../数据/招聘数据源/候选实名';
import { BFF错误 } from '../../数据/HTTP客户端';
import { BFF主体样本 } from '../../测试/BFF样本';
import { 初始状态 } from '../初始状态';
import type { 动作 } from '../应用状态';
import { 创建空P5MatchCase状态 } from './MatchCase操作';
import { 创建空P7会话状态 } from './真人会话操作';
import { 创建空P8控制面状态 } from './P8控制面操作';
import { 创建空接触记录状态 } from './接触记录操作';
import {
  创建候选实名操作,
  创建空候选实名快照,
  取候选实名快照,
  清候选实名引用,
} from './候选实名操作';
import type { 后端操作依赖, 后端状态, 候选实名操作 } from './类型';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const 候选主体: BFF主体 = { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'candidate' };
const 招聘主体: BFF主体 = { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'recruiter' };

const 待审摘要: 候选实名摘要 = {
  status: 'pending',
  verifiedName: null,
  currentRequest: { requestId: 'ivq_1', status: 'pending', revision: 3, submittedAt: '2026-09-04T08:00:00Z', rejectionReason: null },
  revision: 7,
  updatedAt: '2026-09-04T08:00:01Z',
};

const 已换待审摘要: 候选实名摘要 = {
  status: 'pending',
  verifiedName: null,
  currentRequest: { requestId: 'ivq_2', status: 'pending', revision: 4, submittedAt: '2026-09-04T09:00:00Z', rejectionReason: null },
  revision: 9,
  updatedAt: '2026-09-04T09:00:01Z',
};

const 未认证摘要: 候选实名摘要 = {
  status: 'unverified',
  verifiedName: null,
  currentRequest: null,
  revision: 1,
  updatedAt: '2026-09-01T00:00:00Z',
};

const 取消后摘要: 候选实名摘要 = {
  status: 'unverified',
  verifiedName: null,
  currentRequest: { requestId: 'ivq_1', status: 'cancelled', revision: 5, submittedAt: '2026-09-04T08:00:00Z', rejectionReason: null },
  revision: 8,
  updatedAt: '2026-09-04T09:30:00Z',
};

const 已认证摘要: 候选实名摘要 = {
  status: 'verified',
  verifiedName: '张三',
  currentRequest: { requestId: 'ivq_1', status: 'verified', revision: 6, submittedAt: '2026-09-04T08:00:00Z', rejectionReason: null },
  revision: 10,
  updatedAt: '2026-09-04T10:00:00Z',
};

const 输入: 创建候选实名输入 = {
  legalName: 'Fixture Candidate',
  documentType: 'passport',
  evidence: [new File([new Uint8Array([1])], 'front.png', { type: 'image/png' })],
};

/** 本文件内的数据源桩：只桩候选实名 facade 三方法 + 清空目录缓存，逐测试覆盖替换。 */
function 创建数据源(覆盖: Record<string, unknown> = {}): HTTP招聘数据源 {
  return {
    读取候选实名: vi.fn(async (): Promise<候选实名摘要> => 待审摘要),
    创建候选实名申请: vi.fn(async (): Promise<候选实名摘要> => 待审摘要),
    取消候选实名申请: vi.fn(async (): Promise<候选实名摘要> => 取消后摘要),
    清空目录缓存: vi.fn(),
    ...覆盖,
  } as unknown as HTTP招聘数据源;
}

function 创建空P4发现状态() {
  // 仅为种子状态形状；类型来自既有 P4 底座（避免本文件 import 域实现）
  return {
    候选岗位推荐: {}, 候选岗位详情: {}, 候选岗位不可用: [],
    招聘可用候选: {}, 招聘已筛候选: {},
    招聘已筛聚合: { 阶段: '未开始' as const, jobKey: '', error: null },
    招聘候选详情: {}, 招聘候选不可用: [],
    P4委托回执: {}, P4真实Case引用: {},
  };
}

interface 候选实名测试环境 {
  数据源: HTTP招聘数据源;
  deps: 后端操作依赖;
  派发: ReturnType<typeof vi.fn>;
  操作: 候选实名操作;
  当前(): 后端状态;
  快照(): ReturnType<typeof 取候选实名快照>;
}

function 创建环境(
  是后端 = true,
  源 = 创建数据源(),
  主体: BFF主体 | null = 候选主体,
): 候选实名测试环境 {
  const 状态引用 = { current: 初始状态 };
  const 派发 = vi.fn<(动作: 动作) => void>();
  // 种子刻意不带 候选实名 字段：模拟聚焦其它域的既有测试桩，读取一律走
  // 取候选实名快照() 的统一回退（Provider 生产路径则恒播种）。
  let 后端值: 后端状态 = {
    初始化: '完成',
    已登录: 主体 !== null,
    主体,
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
    招聘方档案水合阶段: '未开始' as const,
    招聘方组织水合: { 阶段: '未开始' as const, 错误: null },
    ...创建空P4发现状态(),
    ...创建空P5MatchCase状态(),
    ...创建空P7会话状态(),
    ...创建空P8控制面状态(),
    ...创建空接触记录状态(),
  };
  const deps: 后端操作依赖 = {
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
    主体标识引用: { current: 主体 === null ? null : 主体.subject_id },
    会话代际: { current: 1 },
    读取恢复企业关系编号: vi.fn(() => null),
    候选实名读取锁: { current: null },
    候选实名变更锁: { current: new Set<'create' | 'cancel'>() },
    候选实名提交意图: { current: null },
  };
  return {
    数据源: 源,
    deps,
    派发,
    操作: 创建候选实名操作(deps),
    当前: () => 后端值,
    快照: () => 取候选实名快照(后端值),
  };
}

/** 模拟换代：换主体（subject 变 / 角色变）或递增会话代际。 */
function 换主体(env: 候选实名测试环境, 主体: BFF主体): void {
  env.deps.主体标识引用.current = 主体.subject_id;
  env.deps.后端状态引用.current = { ...env.deps.后端状态引用.current, 主体 };
}

describe('候选实名操作', () => {
  describe('守卫：非 Backend / 无后端 / 非 candidate 一律零请求', () => {
    it.each([
      ['Mock 模式', () => 创建环境(false)],
      ['未登录主体 null', () => 创建环境(true, 创建数据源(), null)],
      ['recruiter 主体', () => 创建环境(true, 创建数据源(), 招聘主体)],
    ])('%s：四方法零 HTTP，mutation 返回 已换代', async (_名, 建环境) => {
      const env = 建环境();
      await env.操作.加载候选实名();
      await expect(env.操作.提交候选实名(输入)).resolves.toBe('已换代');
      await expect(env.操作.取消候选实名()).resolves.toBe('已换代');
      env.操作.重置候选实名提交意图();
      expect(vi.mocked(env.数据源.读取候选实名)).not.toHaveBeenCalled();
      expect(vi.mocked(env.数据源.创建候选实名申请)).not.toHaveBeenCalled();
      expect(vi.mocked(env.数据源.取消候选实名申请)).not.toHaveBeenCalled();
    });
  });

  it('初次 GET 阶段 未开始→进行中→成功；并发两次单飞；非 force 成功缓存零请求', async () => {
    const env = 创建环境();
    const gate = deferred<候选实名摘要>();
    vi.mocked(env.数据源.读取候选实名).mockReturnValue(gate.promise);
    const a = env.操作.加载候选实名();
    const b = env.操作.加载候选实名();
    expect(vi.mocked(env.数据源.读取候选实名)).toHaveBeenCalledTimes(1);
    expect(env.快照()).toMatchObject({ 阶段: '进行中', 摘要: null, 刷新中: true, 错误: null });
    gate.resolve(待审摘要);
    await Promise.all([a, b]);
    expect(env.快照()).toEqual({ 阶段: '成功', 摘要: 待审摘要, 刷新中: false, 错误: null });
    await env.操作.加载候选实名();
    expect(vi.mocked(env.数据源.读取候选实名)).toHaveBeenCalledTimes(1);
  });

  it('已有成功摘要 force 刷新在飞保留旧摘要；失败保留旧摘要并写安全错误', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取候选实名).mockResolvedValueOnce(待审摘要);
    await env.操作.加载候选实名();
    const gate = deferred<候选实名摘要>();
    vi.mocked(env.数据源.读取候选实名).mockReturnValueOnce(gate.promise);
    const p = env.操作.加载候选实名(true);
    expect(env.快照()).toEqual({ 阶段: '成功', 摘要: 待审摘要, 刷新中: true, 错误: null });
    gate.reject(new BFF错误(0, 'network_error', '网络连接失败'));
    await p;
    expect(env.快照()).toEqual({ 阶段: '成功', 摘要: 待审摘要, 刷新中: false, 错误: '请求失败，请稍后再试' });
  });

  it('从未成功过的读取失败进入 失败 且摘要为空', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取候选实名).mockRejectedValueOnce(new BFF错误(0, 'network_error', '网络连接失败'));
    await env.操作.加载候选实名();
    expect(env.快照()).toEqual({ 阶段: '失败', 摘要: null, 刷新中: false, 错误: '请求失败，请稍后再试' });
  });

  it('create/cancel 重复点击只发一笔', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取候选实名).mockResolvedValueOnce(待审摘要);
    await env.操作.加载候选实名();
    const gate = deferred<候选实名摘要>();
    vi.mocked(env.数据源.创建候选实名申请).mockReturnValue(gate.promise);
    const 取消gate = deferred<候选实名摘要>();
    vi.mocked(env.数据源.取消候选实名申请).mockReturnValue(取消gate.promise);
    const a = env.操作.提交候选实名(输入);
    const b = env.操作.提交候选实名(输入);
    const c = env.操作.取消候选实名();
    const d = env.操作.取消候选实名();
    expect(vi.mocked(env.数据源.创建候选实名申请)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.取消候选实名申请)).toHaveBeenCalledTimes(1);
    gate.resolve(待审摘要);
    取消gate.resolve(取消后摘要);
    await expect(Promise.all([a, b, c, d])).resolves.toEqual(['已提交', '已换代', '已取消', '已换代']);
  });

  it('create 铸稳定 key：失败后未编辑重试复用同 key；重置意图后新 key', async () => {
    const env = 创建环境();
    const 创建 = vi.mocked(env.数据源.创建候选实名申请);
    创建.mockRejectedValueOnce(new BFF错误(503, 'operation_outcome_unknown', ''));
    await expect(env.操作.提交候选实名(输入)).rejects.toMatchObject({ code: 'operation_outcome_unknown' });
    const key1 = 创建.mock.calls[0]?.[1];
    expect(key1).toMatch(/^[!-~]{16,128}$/);
    // 未编辑表单的失败重试复用同一把 key
    创建.mockResolvedValueOnce(待审摘要);
    await expect(env.操作.提交候选实名(输入)).resolves.toBe('已提交');
    expect(创建.mock.calls[1]?.[1]).toBe(key1);
    // 成功后 key 已清空，下一次创建重铸；显式重置后同样重铸
    env.操作.重置候选实名提交意图();
    创建.mockRejectedValueOnce(new BFF错误(503, 'operation_outcome_unknown', ''));
    await expect(env.操作.提交候选实名(输入)).rejects.toMatchObject({ code: 'operation_outcome_unknown' });
    const key3 = 创建.mock.calls[2]?.[1];
    expect(key3).toMatch(/^[!-~]{16,128}$/);
    expect(key3).not.toBe(key1);
  });

  it('create 202 直接提交 response summary 并清 key；cancel 200 直接提交且用顶层 revision', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取候选实名).mockResolvedValueOnce(待审摘要);
    await env.操作.加载候选实名();
    vi.mocked(env.数据源.创建候选实名申请).mockResolvedValueOnce(待审摘要);
    await expect(env.操作.提交候选实名(输入)).resolves.toBe('已提交');
    expect(env.快照()).toEqual({ 阶段: '成功', 摘要: 待审摘要, 刷新中: false, 错误: null });
    expect(env.deps.候选实名提交意图?.current).toBeNull();
    vi.mocked(env.数据源.取消候选实名申请).mockResolvedValueOnce(取消后摘要);
    await expect(env.操作.取消候选实名()).resolves.toBe('已取消');
    expect(vi.mocked(env.数据源.取消候选实名申请)).toHaveBeenCalledWith('ivq_1', 7);
    expect(env.快照()).toEqual({ 阶段: '成功', 摘要: 取消后摘要, 刷新中: false, 错误: null });
  });

  describe('create 409 version_conflict 的权威重读对账', () => {
    it('权威状态已是 pending：提交新摘要并返回 状态已更新', async () => {
      const env = 创建环境();
      vi.mocked(env.数据源.创建候选实名申请).mockRejectedValueOnce(new BFF错误(409, 'version_conflict', ''));
      vi.mocked(env.数据源.读取候选实名).mockResolvedValueOnce(待审摘要);
      await expect(env.操作.提交候选实名(输入)).resolves.toBe('状态已更新');
      expect(env.快照()).toEqual({ 阶段: '成功', 摘要: 待审摘要, 刷新中: false, 错误: null });
    });

    it('权威状态仍是 unverified：原样抛原冲突', async () => {
      const env = 创建环境();
      vi.mocked(env.数据源.创建候选实名申请).mockRejectedValueOnce(new BFF错误(409, 'version_conflict', ''));
      vi.mocked(env.数据源.读取候选实名).mockResolvedValueOnce(未认证摘要);
      await expect(env.操作.提交候选实名(输入)).rejects.toMatchObject({ status: 409, code: 'version_conflict' });
    });

    it('权威重读失败：不宣称成功，原样抛原冲突', async () => {
      const env = 创建环境();
      vi.mocked(env.数据源.创建候选实名申请).mockRejectedValueOnce(new BFF错误(409, 'version_conflict', ''));
      vi.mocked(env.数据源.读取候选实名).mockRejectedValueOnce(new BFF错误(0, 'network_error', '网络连接失败'));
      await expect(env.操作.提交候选实名(输入)).rejects.toMatchObject({ status: 409, code: 'version_conflict' });
    });
  });

  describe('cancel 404/409/503 的权威重读对账', () => {
    it.each([
      [404, 'not_found'],
      [409, 'version_conflict'],
      [503, 'operation_outcome_unknown'],
    ] as const)('cancel %s %s 后原 pending 已改变：返回 状态已更新', async (status, code) => {
      const env = 创建环境();
      vi.mocked(env.数据源.读取候选实名).mockResolvedValueOnce(待审摘要);
      await env.操作.加载候选实名();
      vi.mocked(env.数据源.取消候选实名申请).mockRejectedValueOnce(new BFF错误(status, code, ''));
      vi.mocked(env.数据源.读取候选实名).mockResolvedValueOnce(已换待审摘要);
      await expect(env.操作.取消候选实名()).resolves.toBe('状态已更新');
      expect(env.快照()).toEqual({ 阶段: '成功', 摘要: 已换待审摘要, 刷新中: false, 错误: null });
    });

    it.each([
      [404, 'not_found'],
      [409, 'version_conflict'],
      [503, 'operation_outcome_unknown'],
    ] as const)('cancel %s %s 后仍是原 pending：原样抛原错误且绝不重放', async (status, code) => {
      const env = 创建环境();
      vi.mocked(env.数据源.读取候选实名).mockResolvedValueOnce(待审摘要);
      await env.操作.加载候选实名();
      vi.mocked(env.数据源.取消候选实名申请).mockRejectedValueOnce(new BFF错误(status, code, ''));
      vi.mocked(env.数据源.读取候选实名).mockResolvedValueOnce(待审摘要);
      await expect(env.操作.取消候选实名()).rejects.toMatchObject({ status, code });
      expect(vi.mocked(env.数据源.取消候选实名申请)).toHaveBeenCalledTimes(1);
    });

    it('cancel 冲突后的权威重读失败：原样抛原错误', async () => {
      const env = 创建环境();
      vi.mocked(env.数据源.读取候选实名).mockResolvedValueOnce(待审摘要);
      await env.操作.加载候选实名();
      vi.mocked(env.数据源.取消候选实名申请).mockRejectedValueOnce(new BFF错误(503, 'operation_outcome_unknown', ''));
      vi.mocked(env.数据源.读取候选实名).mockRejectedValueOnce(new BFF错误(0, 'network_error', '网络连接失败'));
      await expect(env.操作.取消候选实名()).rejects.toMatchObject({ status: 503, code: 'operation_outcome_unknown' });
    });
  });

  it('create 的 operation_outcome_unknown / network_error 保留 key 并原样抛，不做额外 create', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.创建候选实名申请).mockRejectedValueOnce(new BFF错误(503, 'operation_outcome_unknown', ''));
    await expect(env.操作.提交候选实名(输入)).rejects.toMatchObject({ code: 'operation_outcome_unknown' });
    expect(env.deps.候选实名提交意图?.current).not.toBeNull();
    expect(vi.mocked(env.数据源.创建候选实名申请)).toHaveBeenCalledTimes(1);
    vi.mocked(env.数据源.创建候选实名申请).mockRejectedValueOnce(new BFF错误(0, 'network_error', '网络连接失败'));
    await expect(env.操作.提交候选实名(输入)).rejects.toMatchObject({ code: 'network_error' });
    expect(env.deps.候选实名提交意图?.current).not.toBeNull();
    expect(vi.mocked(env.数据源.创建候选实名申请)).toHaveBeenCalledTimes(2);
  });

  describe('会话栅栏：换代后的迟到成败整包丢弃', () => {
    it('create 在飞时换 subject：迟到成功返回 已换代 且不写状态', async () => {
      const env = 创建环境();
      const gate = deferred<候选实名摘要>();
      vi.mocked(env.数据源.创建候选实名申请).mockReturnValue(gate.promise);
      const p = env.操作.提交候选实名(输入);
      换主体(env, { ...BFF主体样本, subject_id: 'sub_2', last_used_role: 'candidate' });
      gate.resolve(待审摘要);
      await expect(p).resolves.toBe('已换代');
      expect(env.快照()).toEqual(创建空候选实名快照());
    });

    it('create 在飞时换 role：迟到失败返回 已换代 且不写状态', async () => {
      const env = 创建环境();
      const gate = deferred<候选实名摘要>();
      vi.mocked(env.数据源.创建候选实名申请).mockReturnValue(gate.promise);
      const p = env.操作.提交候选实名(输入);
      换主体(env, 招聘主体);
      gate.reject(new BFF错误(500, 'internal_error', ''));
      await expect(p).resolves.toBe('已换代');
      expect(env.快照()).toEqual(创建空候选实名快照());
    });

    it('create 在飞时递增会话代际：迟到失败返回 已换代', async () => {
      const env = 创建环境();
      const gate = deferred<候选实名摘要>();
      vi.mocked(env.数据源.创建候选实名申请).mockReturnValue(gate.promise);
      const p = env.操作.提交候选实名(输入);
      env.deps.会话代际.current += 1;
      gate.reject(new BFF错误(0, 'network_error', '网络连接失败'));
      await expect(p).resolves.toBe('已换代');
    });

    it('GET 在飞时换代：迟到成功不写快照', async () => {
      const env = 创建环境();
      const gate = deferred<候选实名摘要>();
      vi.mocked(env.数据源.读取候选实名).mockReturnValue(gate.promise);
      const p = env.操作.加载候选实名();
      env.deps.会话代际.current += 1;
      gate.resolve(待审摘要);
      await p;
      // 不写快照 = 停在起步的进行中态，迟到成功绝不覆盖（会话转移的摊平归 会话操作 清理口）
      expect(env.快照()).toEqual({ 阶段: '进行中', 摘要: null, 刷新中: true, 错误: null });
    });

    it('当前 401 统一清账号并原样抛；快照回干净底座', async () => {
      const env = 创建环境();
      const gate = deferred<候选实名摘要>();
      vi.mocked(env.数据源.创建候选实名申请).mockReturnValue(gate.promise);
      const p = env.操作.提交候选实名(输入);
      gate.reject(new BFF错误(401, 'invalid_session', 'expired'));
      await expect(p).rejects.toMatchObject({ status: 401 });
      expect(env.deps.主体标识引用.current).toBeNull();
      expect(env.deps.会话代际.current).toBe(2);
      expect(env.快照()).toEqual(创建空候选实名快照());
      expect(env.deps.候选实名提交意图?.current).toBeNull();
    });

    it('GET 当前 401 统一清账号', async () => {
      const env = 创建环境();
      vi.mocked(env.数据源.读取候选实名).mockRejectedValueOnce(new BFF错误(401, 'invalid_session', 'expired'));
      await env.操作.加载候选实名();
      expect(env.deps.主体标识引用.current).toBeNull();
      expect(env.快照()).toEqual(创建空候选实名快照());
    });

    it('迟到 401 不清新会话', async () => {
      const env = 创建环境();
      const gate = deferred<候选实名摘要>();
      vi.mocked(env.数据源.创建候选实名申请).mockReturnValue(gate.promise);
      const p = env.操作.提交候选实名(输入);
      换主体(env, { ...BFF主体样本, subject_id: 'sub_2', last_used_role: 'candidate' });
      env.deps.会话代际.current += 1;
      gate.reject(new BFF错误(401, 'invalid_session', 'expired'));
      await expect(p).resolves.toBe('已换代');
      expect(env.deps.主体标识引用.current).toBe('sub_2');
      expect(env.deps.会话代际.current).toBe(2);
    });
  });

  it('清候选实名引用 清 GET 锁、两把 mutation 锁和 key；状态 helper 回干净底座', () => {
    const env = 创建环境();
    env.deps.候选实名读取锁!.current = Promise.resolve();
    env.deps.候选实名变更锁!.current.add('create');
    env.deps.候选实名变更锁!.current.add('cancel');
    env.deps.候选实名提交意图!.current = 'iv-create-0123456789abcdef';
    清候选实名引用(env.deps);
    expect(env.deps.候选实名读取锁?.current).toBeNull();
    expect(env.deps.候选实名变更锁?.current.size).toBe(0);
    expect(env.deps.候选实名提交意图?.current).toBeNull();
    expect(取候选实名快照({} as 后端状态)).toEqual(创建空候选实名快照());
  });

  describe('mutation 对账撞上更早起飞的 GET', () => {
    /** 两笔读取各挂一个受控 gate：第一笔是更早起飞的旧读，第二笔是对账新 GET。 */
    function 挂双读gate(env: 候选实名测试环境) {
      const gate1 = deferred<候选实名摘要>();
      const gate2 = deferred<候选实名摘要>();
      const 读取 = vi.mocked(env.数据源.读取候选实名);
      let 调用数 = 0;
      读取.mockImplementation(async () => {
        调用数 += 1;
        return 调用数 === 1 ? gate1.promise : gate2.promise;
      });
      return { gate1, gate2 };
    }

    it('旧读 resolve：等它结算但不采用结果，再发新 GET 作对账证据', async () => {
      const env = 创建环境();
      const 读取 = vi.mocked(env.数据源.读取候选实名);
      const { gate1, gate2 } = 挂双读gate(env);
      const 加载p = env.操作.加载候选实名();
      vi.mocked(env.数据源.创建候选实名申请).mockRejectedValueOnce(new BFF错误(409, 'version_conflict', ''));
      const 提交p = env.操作.提交候选实名(输入);
      // 旧读结果是 unverified：若对账误采用旧读，会把它当「仍可创建」抛原冲突
      gate1.resolve(未认证摘要);
      await 加载p;
      await vi.waitFor(() => expect(读取).toHaveBeenCalledTimes(2));
      gate2.resolve(待审摘要);
      await expect(提交p).resolves.toBe('状态已更新');
      // 最终状态是新 GET 的权威摘要，旧读不反向覆盖
      expect(env.快照()).toEqual({ 阶段: '成功', 摘要: 待审摘要, 刷新中: false, 错误: null });
    });

    it('旧读 reject：rejection 被吞掉，对账仍另发新 GET', async () => {
      const env = 创建环境();
      const 读取 = vi.mocked(env.数据源.读取候选实名);
      const { gate1, gate2 } = 挂双读gate(env);
      const 加载p = env.操作.加载候选实名().catch(() => undefined);
      vi.mocked(env.数据源.创建候选实名申请).mockRejectedValueOnce(new BFF错误(409, 'version_conflict', ''));
      const 提交p = env.操作.提交候选实名(输入);
      gate1.reject(new BFF错误(0, 'network_error', '网络连接失败'));
      await 加载p;
      await vi.waitFor(() => expect(读取).toHaveBeenCalledTimes(2));
      gate2.resolve(待审摘要);
      await expect(提交p).resolves.toBe('状态已更新');
      expect(env.快照()).toEqual({ 阶段: '成功', 摘要: 待审摘要, 刷新中: false, 错误: null });
    });
  });

  it('无成功摘要或当前申请不是 pending：取消零 mutation 请求并返回 状态已更新', async () => {
    const env = 创建环境();
    await expect(env.操作.取消候选实名()).resolves.toBe('状态已更新');
    expect(vi.mocked(env.数据源.取消候选实名申请)).not.toHaveBeenCalled();
    vi.mocked(env.数据源.读取候选实名).mockResolvedValueOnce(取消后摘要);
    await env.操作.加载候选实名();
    await expect(env.操作.取消候选实名()).resolves.toBe('状态已更新');
    expect(vi.mocked(env.数据源.取消候选实名申请)).not.toHaveBeenCalled();
    vi.mocked(env.数据源.读取候选实名).mockResolvedValueOnce(已认证摘要);
    await env.操作.加载候选实名(true);
    await expect(env.操作.取消候选实名()).resolves.toBe('状态已更新');
    expect(vi.mocked(env.数据源.取消候选实名申请)).not.toHaveBeenCalled();
  });
});
