// codex review-r1 P2：候选操作（保存简历 / 保存个人优势 / 意向写）的 401 统一清理必须随行
// 候选预填引用。子集缺引用时内存轮虽被摊平，但预填代际 / 单飞读锁 / outgoing subject 的
// 恢复元数据不会清 —— 登出渲染把恢复适配器解绑成 null 后，旧 session key 再无人删除，
// 同账号重登会复活上一轮预填（设计 §6.4：401 全部清内存和 session key）。

import { describe, expect, it, vi } from 'vitest';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { BFF错误 } from '../../数据/HTTP客户端';
import { 初始状态 } from '../初始状态';
import type { 后端操作依赖, 后端状态, 候选操作, 候选预填恢复存储 } from './类型';
import { 创建候选操作 } from './候选操作';

function 创建场景() {
  const 后端 = {
    读取简历: vi.fn(),
    保存简历: vi.fn(),
    清空目录缓存: vi.fn(),
  };
  const 后端状态引用 = { current: {
    初始化: '完成' as const,
    已登录: true,
    主体: { subject_id: 'sub_1', roles: [], last_used_role: 'candidate' },
    简历快照: null,
    意向快照: {},
    岗位快照: {},
    隐私快照: null,
    附件简历库: null,
  } as unknown as 后端状态 };
  const 设后端状态 = vi.fn((更新: (旧: 后端状态) => 后端状态) => {
    后端状态引用.current = 更新(后端状态引用.current);
  });
  const 候选预填代际 = { current: 5 };
  const 候选预填读取锁 = { current: new Map<string, Promise<void>>() };
  const 候选预填恢复存储: 候选预填恢复存储 = { 读取: vi.fn(() => null), 写入: vi.fn(), 删除: vi.fn() };
  const 候选预填恢复 = { current: 候选预填恢复存储 };
  const deps = {
    是后端: true,
    后端: 后端 as unknown as HTTP招聘数据源,
    派发: vi.fn(),
    设后端状态,
    后端状态引用,
    状态引用: { current: 初始状态 },
    锁: { current: new Set<string>() },
    尝试引用: { current: null as string | null },
    主体标识引用: { current: 'sub_1' as string | null },
    会话代际: { current: 1 },
    读取恢复企业关系编号: vi.fn(() => null),
    候选预填代际,
    候选预填读取锁,
    候选预填恢复,
  };
  const 操作: 候选操作 = 创建候选操作(deps as unknown as 后端操作依赖);
  return { 后端, 操作, 后端状态引用, 候选预填代际, 候选预填读取锁, 候选预填恢复存储 };
}

describe('创建候选操作 · 401 统一清理随行候选预填引用', () => {
  it('保存简历 401：代际递增、读锁清空、恢复元数据删除', async () => {
    const 场景 = 创建场景();
    场景.候选预填读取锁.current.set('rf_1|rfv_1|rp_1', Promise.resolve());
    场景.后端.读取简历.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 空模型 = {} as Parameters<候选操作['保存简历']>[0];
    await expect(场景.操作.保存简历(空模型)).rejects.toBeInstanceOf(BFF错误);
    expect(场景.后端状态引用.current.已登录).toBe(false);
    expect(场景.候选预填代际.current).toBe(6);
    expect(场景.候选预填读取锁.current.size).toBe(0);
    expect(场景.候选预填恢复存储.删除).toHaveBeenCalledTimes(1);
  });

  it('保存个人优势 401：同口径清候选预填引用', async () => {
    const 场景 = 创建场景();
    场景.后端.读取简历.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(场景.操作.保存个人优势('x')).rejects.toBeInstanceOf(BFF错误);
    expect(场景.候选预填代际.current).toBe(6);
    expect(场景.候选预填恢复存储.删除).toHaveBeenCalledTimes(1);
  });
});
