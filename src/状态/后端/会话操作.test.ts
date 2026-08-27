// P1C Task 2：同 Provider 账号 A→B 的 subject-change 清理必须覆盖组织权威状态，
// A 的未认证公司声明 / 公开企业缓存 / current 选择不能串进 B。
// P3 Task 2：候选隐私成为第三个并行水合域 —— 水合 / 清理 / 过时响应丢弃的用例也在本文件。

import { describe, expect, it, vi } from 'vitest';
import type { BFF主体 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { BFF错误 } from '../../数据/HTTP客户端';
import {
  BFF公开企业样本,
  BFF企业关系样本,
  BFF主体样本,
  BFF简历样本,
  BFF隐私快照样本,
  BFF招聘方档案样本,
} from '../../测试/BFF样本';
import { 从BFF简历 } from '../../数据/后端映射';
import { 从BFF隐私 } from '../../数据/隐私映射';
import type { 页面隐私快照 } from '../../数据/招聘数据源类型';
import { 初始状态 } from '../初始状态';
import { 归约 } from '../应用状态';
import type { 后端状态 } from './类型';
import { 创建会话操作, 清账号状态, 水合角色数据 } from './会话操作';

/** 依赖 helper：派发重放 归约 到可变 状态引用，断言可以读最终 state。 */
function 创建会话测试依赖(后端: HTTP招聘数据源) {
  const 状态引用 = { current: 初始状态 };
  const 动作流: unknown[] = [];
  const 派发 = vi.fn((动作: Parameters<typeof 归约>[1]) => {
    动作流.push(动作);
    状态引用.current = 归约(状态引用.current, 动作);
  });
  const deps = {
    是后端: true,
    后端,
    派发,
    设后端状态: vi.fn(),
    后端状态引用: { current: {
      初始化: '完成' as const, 已登录: true, 主体: null, 简历快照: null, 意向快照: {}, 岗位快照: {},
      隐私快照: null,
    } },
    状态引用,
    锁: { current: new Set<string>() },
    尝试引用: { current: null as string | null },
    主体标识引用: { current: null as string | null },
    会话代际: { current: 0 },
    读取恢复企业关系编号: vi.fn(() => null),
  };
  return { deps, 动作流 };
}

/** 断言用：把 设后端状态 收到的功能式更新依序折叠到 ref 上，取最终 后端状态。 */
function 最终后端状态(deps: ReturnType<typeof 创建会话测试依赖>['deps']): 后端状态 {
  let 最新: 后端状态 = deps.后端状态引用.current;
  for (const 调用 of deps.设后端状态.mock.calls) {
    最新 = (调用[0] as (旧: 后端状态) => 后端状态)(最新);
  }
  return 最新;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function 主体(subject_id: string): BFF主体 {
  return { ...BFF主体样本, subject_id };
}

describe('完成手机登录 subject-change 组织清理', () => {
  it('A→B 登录派发 清后端组织状态，A 的 claim/公开缓存/current 不进 B', async () => {
    const 后端 = {
      完成手机登录: vi.fn(async () => undefined),
      读取主体: vi.fn()
        .mockResolvedValueOnce(主体('sub_a'))
        .mockResolvedValueOnce(主体('sub_b')),
      清空目录缓存: vi.fn(),
    } as unknown as HTTP招聘数据源;
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    // A 已在 state 里留下组织痕迹：current 选择 + 公开缓存 + 未认证公司声明
    deps.状态引用.current = 归约(归约(归约(初始状态, {
      型: '水合企业关系', 关系: [BFF企业关系样本], 当前编号: BFF企业关系样本.affiliation_id,
    }), { 型: '缓存公开企业', 企业: BFF公开企业样本 }), { 型: '存未认证公司声明', 公司: 'A 的声明' });

    const 操作 = 创建会话操作(deps);
    // A 登录：主体标识引用 从 null → sub_a，不触发清理
    await 操作.完成手机登录('1111');
    expect(动作流).not.toContainEqual({ 型: '清后端组织状态' });
    expect(deps.主体标识引用.current).toBe('sub_a');
    expect(deps.状态引用.current.未认证公司声明).toBe('A 的声明');

    // B 在同一 Provider 登录（读取主体 返回 sub_b）→ subject-change 清理
    await 操作.完成手机登录('2222');
    expect(deps.主体标识引用.current).toBe('sub_b');
    expect(动作流).toContainEqual({ 型: '清后端组织状态' });
    // B 水合前 state 中已无 A 的组织痕迹
    expect(deps.状态引用.current.未认证公司声明).toBe('');
    expect(deps.状态引用.current.公开企业表).toEqual({});
    expect(deps.状态引用.current.当前企业关系编号).toBeNull();
    expect(deps.状态引用.current.企业关系列表).toEqual([]);
  });

  it('同 subject_id 再次登录不触发组织清理', async () => {
    const 后端 = {
      完成手机登录: vi.fn(async () => undefined),
      读取主体: vi.fn().mockResolvedValue(主体('sub_a')),
      清空目录缓存: vi.fn(),
    } as unknown as HTTP招聘数据源;
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    const 操作 = 创建会话操作(deps);
    await 操作.完成手机登录('1111');
    await 操作.完成手机登录('2222');
    expect(动作流).not.toContainEqual({ 型: '清后端组织状态' });
    expect(deps.主体标识引用.current).toBe('sub_a');
  });
});

// ── P3 Task 2：候选隐私水合与全路径清理 ─────────────────────────────

describe('P3 候选隐私水合与清理', () => {
  const 隐私页面样本 = 从BFF隐私(BFF隐私快照样本);

  function 简历意向隐私数据源(覆盖: Record<string, unknown>): HTTP招聘数据源 {
    return {
      读取简历: vi.fn().mockResolvedValue(从BFF简历(BFF简历样本)),
      读取意向: vi.fn(async () => ({ 列表: [], 服务端: {} })),
      读取隐私: vi.fn().mockResolvedValue(从BFF隐私(BFF隐私快照样本)),
      ...覆盖,
    } as unknown as HTTP招聘数据源;
  }

  it('candidate hydration settles Resume, Intention, and Privacy independently', async () => {
    const 隐私页面样本2 = 从BFF隐私(BFF隐私快照样本);
    const 后端 = {
      读取简历: vi.fn().mockRejectedValue(new Error('resume unavailable')),
      读取意向: vi.fn().mockRejectedValue(new Error('intention unavailable')),
      读取隐私: vi.fn().mockResolvedValue(隐私页面样本2),
    } as unknown as HTTP招聘数据源;
    const { deps } = 创建会话测试依赖(后端);
    const candidate主体 = { ...BFF主体样本, last_used_role: 'candidate' as const };
    await expect(水合角色数据(deps, candidate主体, false, 1)).resolves.toBe(false);
    expect(deps.派发).toHaveBeenCalledWith({ 型: '水合后端隐私', 快照: 隐私页面样本2 });
    expect(deps.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '水合后端简历' }));
  });

  it('候选任一读取 401 走统一清理时也派发 清后端隐私', async () => {
    const 后端 = 简历意向隐私数据源({
      读取简历: vi.fn().mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired')),
      清空目录缓存: vi.fn(),
    });
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    const 会话失效 = await 水合角色数据(deps, 主体('sub_1'), false, 0);
    expect(会话失效).toBe(true);
    expect(动作流).toContainEqual({ 型: '清后端隐私' });
    expect(最终后端状态(deps).隐私快照).toBeNull();
  });

  it('隐私读取在会话代际变化后到达时被丢弃，不派发 水合后端隐私', async () => {
    const 隐私门 = deferred<页面隐私快照>();
    const 后端 = 简历意向隐私数据源({ 读取隐私: vi.fn(() => 隐私门.promise) });
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    const 水合 = 水合角色数据(deps, 主体('sub_1'), false, 0);
    deps.会话代际.current += 1; // 读在飞期间换了会话
    隐私门.resolve(隐私页面样本);
    await expect(水合).resolves.toBe(false);
    expect(动作流).not.toContainEqual(expect.objectContaining({ 型: '水合后端隐私' }));
  });

  it('隐私读取在主体标识变化后到达时被丢弃，不派发 水合后端隐私', async () => {
    const 隐私门 = deferred<页面隐私快照>();
    const 后端 = 简历意向隐私数据源({ 读取隐私: vi.fn(() => 隐私门.promise) });
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    const 水合 = 水合角色数据(deps, 主体('sub_1'), false, 0);
    deps.主体标识引用.current = 'sub_other'; // 读在飞期间换了账号
    隐私门.resolve(隐私页面样本);
    await expect(水合).resolves.toBe(false);
    expect(动作流).not.toContainEqual(expect.objectContaining({ 型: '水合后端隐私' }));
  });

  it('清账号状态 派发 清后端隐私 并把 后端状态.隐私快照 清成 null', () => {
    const { deps, 动作流 } = 创建会话测试依赖(
      { 清空目录缓存: vi.fn() } as unknown as HTTP招聘数据源,
    );
    清账号状态(deps);
    expect(动作流).toContainEqual({ 型: '清后端隐私' });
    expect(最终后端状态(deps).隐私快照).toBeNull();
  });

  it('跨主体登录 A→B 时清上个账号的隐私快照', async () => {
    const 后端 = {
      完成手机登录: vi.fn(async () => undefined),
      读取主体: vi.fn()
        .mockResolvedValueOnce(主体('sub_a'))
        .mockResolvedValueOnce(主体('sub_b')),
      清空目录缓存: vi.fn(),
    } as unknown as HTTP招聘数据源;
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    const 操作 = 创建会话操作(deps);
    await 操作.完成手机登录('1111');
    expect(动作流).not.toContainEqual({ 型: '清后端隐私' }); // 首次登录不触发
    await 操作.完成手机登录('2222');
    expect(动作流).toContainEqual({ 型: '清后端隐私' });
    expect(最终后端状态(deps).隐私快照).toBeNull();
  });

  it('退出登录 清空隐私快照', async () => {
    const 后端 = {
      退出登录: vi.fn(async () => undefined),
      清空目录缓存: vi.fn(),
    } as unknown as HTTP招聘数据源;
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    await 创建会话操作(deps).退出登录();
    expect(动作流).toContainEqual({ 型: '清后端隐私' });
    expect(最终后端状态(deps).隐私快照).toBeNull();
  });

  it('切身份到招聘方先清隐私再水合招聘方域', async () => {
    const 后端 = {
      确保角色: vi.fn(async (role: string) => ({ ...BFF主体样本, last_used_role: role })),
      记录当前角色: vi.fn(async (role: string) => ({ ...BFF主体样本, last_used_role: role })),
      读取招聘方档案: vi.fn(async () => BFF招聘方档案样本),
      读取我的企业关系: vi.fn(async () => []),
      读取企业管理员申请: vi.fn(async () => []),
      读取岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
      清空目录缓存: vi.fn(),
    } as unknown as HTTP招聘数据源;
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    await 创建会话操作(deps).切身份('招聘方');
    expect(动作流).toContainEqual({ 型: '清后端隐私' });
    // 清后端隐私 必须先于招聘方组织水合的第一个请求
    const 清序号 = 动作流.findIndex((条) => (条 as { 型: string }).型 === '清后端隐私');
    const 档案序号 = (后端.读取招聘方档案 as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const 派发序号 = deps.派发.mock.invocationCallOrder[清序号];
    expect(派发序号).toBeLessThan(档案序号);
    expect(最终后端状态(deps).隐私快照).toBeNull();
    // 招聘方自有水合照常进行
    expect(后端.读取岗位).toHaveBeenCalled();
  });
});
