// P1C Task 2：同 Provider 账号 A→B 的 subject-change 清理必须覆盖组织权威状态，
// A 的未认证公司声明 / 公开企业缓存 / current 选择不能串进 B。

import { describe, expect, it, vi } from 'vitest';
import type { BFF主体 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { BFF公开企业样本, BFF企业关系样本, BFF主体样本 } from '../../测试/BFF样本';
import { 初始状态 } from '../初始状态';
import { 归约 } from '../应用状态';
import { 创建会话操作 } from './会话操作';

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
