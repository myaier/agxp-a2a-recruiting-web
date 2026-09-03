// Backend contact-events 域操作的行为测试 —— 候选主体 + 会话代际 + 域读代际栅栏、
// 同 owner 单飞（过期属主接管）、首载/force 刷新原子替换、分页原子追加与 cursor
// 消费纪律（重复消费 / 不前进 cursor / 与已载窗口重叠整页丢弃）、当前轮 401 统一
// 清账号、换主体/角色/会话后的迟到 response 与迟到 401 整包丢弃。受控 deferred
// promise 证明原子提交与迟到丢弃；派发 只是 spy，全部断言读 当前()。
// 快照只进内存（后端状态），绝不进 资料持久化 / 浏览器存储。

import { describe, expect, it, vi } from 'vitest';
import type { BFF主体 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type { 接触事件, 接触事件页 } from '../../数据/招聘数据源/接触记录';
import { BFF错误 } from '../../数据/HTTP客户端';
import { BFF主体样本 } from '../../测试/BFF样本';
import { 初始状态 } from '../初始状态';
import type { 动作 } from '../应用状态';
import { 创建空P5MatchCase状态 } from './MatchCase操作';
import { 创建空P7会话状态 } from './真人会话操作';
import { 创建空P8控制面状态 } from './P8控制面操作';
import { 创建接触记录操作, 创建空接触记录状态, 清接触记录引用 } from './接触记录操作';
import type { 后端操作依赖, 后端状态, 接触记录操作 } from './类型';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const 候选主体: BFF主体 = { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'candidate' };
const 招聘主体: BFF主体 = { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'recruiter' };

const 事件A: 接触事件 = {
  eventId: 'cev_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  organization: {
    organizationId: 'org_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    displayName: 'Acme',
  },
  action: 'contact_started',
  occurredAt: '2026-09-01T08:00:00Z',
};

const 事件B: 接触事件 = {
  eventId: 'cev_cccccccccccccccccccccccccccccccc',
  organization: {
    organizationId: 'org_dddddddddddddddddddddddddddddddd',
    displayName: 'Beta',
  },
  action: 'anonymous_profile_viewed',
  occurredAt: '2026-08-30T10:00:00Z',
};

const 空页: 接触事件页 = { items: [], nextCursor: null };

/** 本文件内的数据源桩：只桩 contact-events facade + 清空目录缓存，逐测试覆盖替换。 */
function 创建数据源(覆盖: Record<string, unknown> = {}): HTTP招聘数据源 {
  return {
    读取接触事件: vi.fn(async (): Promise<接触事件页> => 空页),
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

interface 接触记录操作测试环境 {
  数据源: HTTP招聘数据源;
  deps: 后端操作依赖;
  派发: ReturnType<typeof vi.fn>;
  操作: 接触记录操作;
  当前(): 后端状态;
}

function 创建环境(
  是后端 = true,
  源 = 创建数据源(),
  主体: BFF主体 | null = 候选主体,
): 接触记录操作测试环境 {
  const 状态引用 = { current: 初始状态 };
  const 派发 = vi.fn<(动作: 动作) => void>();
  let 后端值: 后端状态 = {
    初始化: '完成',
    已登录: true,
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
    接触记录代际: { current: 0 },
    接触记录读取锁: { current: null },
    接触记录已消费游标: { current: new Set<string>() },
  };
  return {
    数据源: 源,
    deps,
    派发,
    操作: 创建接触记录操作(deps),
    当前: () => 后端值,
  };
}

describe('接触记录操作', () => {
  it('首载成功写 owner、items、cursor 与页数；重复调用单飞', async () => {
    const env = 创建环境();
    const gate = deferred<接触事件页>();
    vi.mocked(env.数据源.读取接触事件).mockReturnValue(gate.promise);
    const first = env.操作.加载接触记录();
    const second = env.操作.加载接触记录();
    expect(env.数据源.读取接触事件).toHaveBeenCalledTimes(1);
    gate.resolve({ items: [事件A], nextCursor: 'cursor_2' });
    await Promise.all([first, second]);
    expect(env.当前().接触记录).toMatchObject({
      ownerSubjectId: 'sub_1', 阶段: '成功', items: [事件A],
      nextCursor: 'cursor_2', 已加载页数: 1, error: null,
    });
  });

  it('非 force 首载在当前 owner 已成功时零请求；owner 不同不得复用', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取接触事件)
      .mockResolvedValueOnce({ items: [事件A], nextCursor: null });
    await env.操作.加载接触记录();
    await env.操作.加载接触记录();
    expect(env.数据源.读取接触事件).toHaveBeenCalledTimes(1);
    // 同角色换主体：旧快照不得当缓存，必须重读
    env.deps.主体标识引用.current = 'sub_2';
    env.deps.后端状态引用.current = {
      ...env.deps.后端状态引用.current,
      主体: { ...BFF主体样本, subject_id: 'sub_2', last_used_role: 'candidate' },
      接触记录: { ...env.deps.后端状态引用.current.接触记录, ownerSubjectId: 'sub_1' },
    };
    await env.操作.加载接触记录();
    expect(env.数据源.读取接触事件).toHaveBeenCalledTimes(2);
  });

  it('追加原子提交：成功后 items 追加、页数 +1', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取接触事件)
      .mockResolvedValueOnce({ items: [事件A], nextCursor: 'cursor_2' })
      .mockResolvedValueOnce({ items: [事件B], nextCursor: null });
    await env.操作.加载接触记录();
    await env.操作.追加接触记录();
    expect(env.当前().接触记录).toMatchObject({
      阶段: '成功', items: [事件A, 事件B], nextCursor: null, 已加载页数: 2, error: null,
    });
  });

  it('追加拒绝重复事件和不前进游标：整页不提交，旧成功窗口保留', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取接触事件)
      .mockResolvedValueOnce({ items: [事件A], nextCursor: 'cursor_2' })
      .mockResolvedValueOnce({ items: [事件A], nextCursor: 'cursor_2' });
    await env.操作.加载接触记录();
    await env.操作.追加接触记录();
    expect(env.当前().接触记录.items).toEqual([事件A]);
    expect(env.当前().接触记录.已加载页数).toBe(1);
    expect(env.当前().接触记录.error).not.toBeNull();
  });

  it('追加页返回与请求相同的 cursor（无重叠）同样整页拒绝', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取接触事件)
      .mockResolvedValueOnce({ items: [事件A], nextCursor: 'cursor_2' })
      .mockResolvedValueOnce({ items: [事件B], nextCursor: 'cursor_2' });
    await env.操作.加载接触记录();
    await env.操作.追加接触记录();
    expect(env.当前().接触记录.items).toEqual([事件A]);
    expect(env.当前().接触记录.error).not.toBeNull();
  });

  it('追加页返回更早已消费过的 cursor 也整页拒绝，不混入该页', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取接触事件)
      .mockResolvedValueOnce({ items: [事件A], nextCursor: 'cursor_2' })
      .mockResolvedValueOnce({ items: [事件B], nextCursor: 'cursor_3' })
      .mockResolvedValueOnce({ items: [事件B], nextCursor: 'cursor_2' });
    await env.操作.加载接触记录();
    await env.操作.追加接触记录();
    expect(env.当前().接触记录.items).toEqual([事件A, 事件B]);
    expect(env.当前().接触记录.nextCursor).toBe('cursor_3');
    await env.操作.追加接触记录();
    // 第三页返回已消费过的 cursor_2：cursor 一次性合同被破坏，整页拒绝
    expect(env.当前().接触记录.items).toEqual([事件A, 事件B]);
    expect(env.当前().接触记录.nextCursor).toBe('cursor_3');
    expect(env.当前().接触记录.error).not.toBeNull();
  });

  it('cursor 已尽时追加零请求', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取接触事件)
      .mockResolvedValueOnce({ items: [事件A], nextCursor: null });
    await env.操作.加载接触记录();
    await env.操作.追加接触记录();
    expect(env.数据源.读取接触事件).toHaveBeenCalledTimes(1);
  });

  it('重复消费已失败过的 cursor 进入分页错误且不发请求', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取接触事件)
      .mockResolvedValueOnce({ items: [事件A], nextCursor: 'cursor_2' })
      .mockRejectedValueOnce(new BFF错误(503, 'unavailable', 'x'));
    await env.操作.加载接触记录();
    await env.操作.追加接触记录();
    expect(env.当前().接触记录.items).toEqual([事件A]);
    expect(env.当前().接触记录.error).not.toBeNull();
    await env.操作.追加接触记录();
    expect(env.数据源.读取接触事件).toHaveBeenCalledTimes(2);
    expect(env.当前().接触记录.items).toEqual([事件A]);
    expect(env.当前().接触记录.error).not.toBeNull();
  });

  it('首载失败为 error 空记录', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取接触事件)
      .mockRejectedValueOnce(new BFF错误(503, 'unavailable', 'x'));
    await env.操作.加载接触记录();
    expect(env.当前().接触记录).toMatchObject({
      ownerSubjectId: 'sub_1', 阶段: '失败', items: [], nextCursor: null,
      已加载页数: 0, error: '后端服务暂时不可用，请稍后重试',
    });
  });

  it('force 刷新失败保留同 owner 旧成功；force 先清空已消费 cursor 集', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取接触事件)
      .mockResolvedValueOnce({ items: [事件A], nextCursor: 'cursor_2' })
      .mockRejectedValueOnce(new BFF错误(503, 'unavailable', 'x'));
    await env.操作.加载接触记录();
    await env.操作.加载接触记录(true);
    expect(env.当前().接触记录).toMatchObject({
      阶段: '成功', items: [事件A], nextCursor: 'cursor_2',
      刷新中: false, error: '后端服务暂时不可用，请稍后重试',
    });
    expect((env.deps.接触记录已消费游标 as { current: Set<string> }).current.size).toBe(0);
  });

  it('换主体/会话后的迟到 response 整包丢弃', async () => {
    const env = 创建环境();
    const gate = deferred<接触事件页>();
    vi.mocked(env.数据源.读取接触事件).mockReturnValue(gate.promise);
    const run = env.操作.加载接触记录();
    env.deps.主体标识引用.current = 'sub_2';
    env.deps.会话代际.current = 2;
    env.deps.后端状态引用.current = {
      ...env.deps.后端状态引用.current,
      主体: { ...BFF主体样本, subject_id: 'sub_2', last_used_role: 'candidate' },
    };
    gate.resolve({ items: [事件A], nextCursor: null });
    await run;
    expect(env.当前().接触记录.items).toEqual([]);
    expect(env.派发).not.toHaveBeenCalled();
  });

  it('换主体/会话后的迟到 401 无副作用：不清新会话', async () => {
    const env = 创建环境();
    const gate = deferred<接触事件页>();
    vi.mocked(env.数据源.读取接触事件).mockReturnValue(gate.promise);
    const run = env.操作.加载接触记录();
    env.deps.主体标识引用.current = 'sub_2';
    env.deps.会话代际.current = 2;
    env.deps.后端状态引用.current = {
      ...env.deps.后端状态引用.current,
      主体: { ...BFF主体样本, subject_id: 'sub_2', last_used_role: 'candidate' },
    };
    gate.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await run;
    expect(env.当前().主体?.subject_id).toBe('sub_2');
    expect(env.当前().已登录).toBe(true);
    expect(env.deps.会话代际.current).toBe(2);
  });

  it('换角色到 recruiter 后的迟到 response 整包丢弃', async () => {
    const env = 创建环境();
    const gate = deferred<接触事件页>();
    vi.mocked(env.数据源.读取接触事件).mockReturnValue(gate.promise);
    const run = env.操作.加载接触记录();
    env.deps.后端状态引用.current = {
      ...env.deps.后端状态引用.current,
      主体: 招聘主体,
    };
    gate.resolve({ items: [事件A], nextCursor: null });
    await run;
    expect(env.当前().接触记录.items).toEqual([]);
  });

  it('当前 fence 的 401 走统一清账号状态并摊平本域', async () => {
    const env = 创建环境();
    vi.mocked(env.数据源.读取接触事件)
      .mockRejectedValueOnce(new BFF错误(401, 'invalid_session', 'expired'));
    await env.操作.加载接触记录();
    expect(env.当前().主体).toBeNull();
    expect(env.当前().已登录).toBe(false);
    expect(env.当前().接触记录).toEqual(创建空接触记录状态().接触记录);
    expect(env.deps.主体标识引用.current).toBeNull();
    expect(env.deps.会话代际.current).toBe(2);
  });

  it('Mock / 无后端 / 非 candidate 主体零请求', async () => {
    const 模拟源 = 创建数据源();
    const mock环境 = 创建环境(false, 模拟源);
    await mock环境.操作.加载接触记录();
    await mock环境.操作.追加接触记录();
    expect(模拟源.读取接触事件).not.toHaveBeenCalled();

    const 招聘环境 = 创建环境(true, 创建数据源(), 招聘主体);
    await 招聘环境.操作.加载接触记录();
    await 招聘环境.操作.追加接触记录();
    expect(招聘环境.数据源.读取接触事件).not.toHaveBeenCalled();

    const 无主体环境 = 创建环境(true, 创建数据源(), null);
    await 无主体环境.操作.加载接触记录();
    expect(无主体环境.数据源.读取接触事件).not.toHaveBeenCalled();
  });

  it('清引用后旧锁不阻挡新读', async () => {
    const env = 创建环境();
    const gate = deferred<接触事件页>();
    vi.mocked(env.数据源.读取接触事件).mockReturnValueOnce(gate.promise);
    const 旧读 = env.操作.加载接触记录();
    expect(env.数据源.读取接触事件).toHaveBeenCalledTimes(1);
    清接触记录引用(env.deps);
    vi.mocked(env.数据源.读取接触事件).mockResolvedValueOnce({ items: [事件B], nextCursor: null });
    const 新读 = env.操作.加载接触记录();
    expect(env.数据源.读取接触事件).toHaveBeenCalledTimes(2);
    gate.resolve({ items: [事件A], nextCursor: null });
    await Promise.all([旧读, 新读]);
    // 旧读已被 清引用 递增的代际栅栏作废，只有新读的 items 落位
    expect(env.当前().接触记录.items).toEqual([事件B]);
  });
});