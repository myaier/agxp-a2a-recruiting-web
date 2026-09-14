// Onboarding 域数据源测试：冻结 stg 契约对齐 2026-09-14 Spec §4 的两个 browser call
// （GET me/onboarding 带 no-store、POST me/onboarding/{role}/complete 严格 {} 且无
// If-Match/幂等键），并锁定 strict decode：exact key set、闭合 role/status 枚举、
// completed_at 必在且为 null 或合法 RFC3339、GET 列表只列实际角色（candidate→recruiter、
// 最多两项、无重复）、null 仅查询允许、POST 额外保证 status=active/completed_at 非空/
// role 与请求一致；非法运行时 role 在发送前按客户端错误拒绝；401/403/404/422/503 等
// 错误原样传递，不转空 roles。用受控请求桩记录参数，不连接后端。

import { describe, expect, it, vi } from 'vitest';
import { BFF错误 } from '../HTTP客户端';
import type { BFF响应 } from '../HTTP客户端';
import type { BFF角色 } from '../BFF契约';
import {
  BFFOnboarding完成角色状态样本,
  BFFOnboarding角色状态样本,
  BFFOnboarding状态样本,
} from '../../测试/BFF样本';
import { 创建Onboarding数据源 } from './Onboarding';

function 响应<T>(result: T): BFF响应<T> {
  return { result, etag: null, requestId: 'req-onboarding' };
}

const 合法时间 = '2026-08-24T00:00:00Z';

/** 漂移反例的局部 wire 字面量：只用于契约漂移用例，不进共享样本。 */
function 角色状态Wire(role: string, completedAt: string | null, status = 'active') {
  return { role, status, completed_at: completedAt };
}

describe('Onboarding数据源', () => {
  // ── GET 读取：冻结路径 + no-store + 严格解码 ──

  it('GET 空 roles 走冻结路径并带 no-store 原样解码', async () => {
    const 请求 = vi.fn().mockResolvedValue(响应({ roles: [] }));
    const source = 创建Onboarding数据源(请求);
    await expect(source.读取Onboarding()).resolves.toEqual({ roles: [] });
    expect(请求).toHaveBeenCalledTimes(1);
    expect(请求.mock.calls[0][0]).toEqual({ path: '/api/v1/me/onboarding', 不缓存: true });
  });

  it('GET 两角色按 candidate→recruiter 解码且各自时间保留', async () => {
    const 请求 = vi.fn().mockResolvedValue(响应(BFFOnboarding状态样本));
    const source = 创建Onboarding数据源(请求);
    await expect(source.读取Onboarding()).resolves.toEqual(BFFOnboarding状态样本);
  });

  it('GET 单角色 null completed_at 是合法未完成（null 仅查询允许）', async () => {
    const 请求 = vi.fn().mockResolvedValue(响应({ roles: [BFFOnboarding角色状态样本] }));
    const source = 创建Onboarding数据源(请求);
    await expect(source.读取Onboarding()).resolves.toEqual({ roles: [BFFOnboarding角色状态样本] });
  });

  it.each([
    ['result 缺 roles 键', {}],
    ['result 多 last_used_role 键', { roles: [], last_used_role: null }],
    ['roles 不是数组', { roles: 'candidate' }],
    ['roles 条目不是对象', { roles: ['candidate'] }],
    ['条目缺 role', { roles: [{ status: 'active', completed_at: null }] }],
    ['条目缺 status', { roles: [{ role: 'candidate', completed_at: null }] }],
    ['条目缺 completed_at', { roles: [{ role: 'candidate', status: 'active' }] }],
    ['条目多 avatar 键', { roles: [{ role: 'candidate', status: 'active', completed_at: null, avatar: 'a' }] }],
    ['未知 role', { roles: [角色状态Wire('admin', null)] }],
    ['未知 status', { roles: [角色状态Wire('candidate', null, 'pending')] }],
    ['completed_at 非法日历时间', { roles: [角色状态Wire('candidate', '2026-13-45T99:99:99Z')] }],
    ['completed_at 缺 RFC3339 形状', { roles: [角色状态Wire('candidate', '2026-08-24 00:00:00Z')] }],
    ['completed_at 是数字', { roles: [{ role: 'candidate', status: 'active', completed_at: 1758624000000 }] }],
    ['角色重复（两个 candidate）', { roles: [角色状态Wire('candidate', null), 角色状态Wire('candidate', 合法时间)] }],
    ['角色逆序（recruiter 在前）', { roles: [角色状态Wire('recruiter', 合法时间), 角色状态Wire('candidate', null)] }],
    ['超过两项', {
      roles: [角色状态Wire('candidate', null), 角色状态Wire('recruiter', 合法时间), 角色状态Wire('candidate', null)],
    }],
  ])('GET 契约漂移 fail closed：%s', async (_场景, result) => {
    const 请求 = vi.fn().mockResolvedValue(响应(result));
    const source = 创建Onboarding数据源(请求);
    // 漂移按 invalid_response 整包拒绝，绝不落成空 roles
    await expect(source.读取Onboarding()).rejects.toMatchObject({ status: 200, code: 'invalid_response' });
  });

  // ── POST 完成：两角色路径 + 严格 {} + 额外闭合保证 ──

  it('POST recruiter 路径发严格 {} 且不带 If-Match/幂等键，回传同角色完成状态', async () => {
    const 请求 = vi.fn().mockResolvedValue(响应(BFFOnboarding完成角色状态样本));
    const source = 创建Onboarding数据源(请求);
    await expect(source.完成Onboarding('recruiter')).resolves.toEqual(BFFOnboarding完成角色状态样本);
    // 全量断言请求选项：多出 ifMatch/幂等/幂等键/不缓存 任一都会失败
    expect(请求.mock.calls[0][0]).toEqual({
      path: '/api/v1/me/onboarding/recruiter/complete',
      method: 'POST',
      body: {},
    });
  });

  it('POST candidate 路径同样发严格 {} 并回传同角色完成状态', async () => {
    const 完成Wire = 角色状态Wire('candidate', 合法时间);
    const 请求 = vi.fn().mockResolvedValue(响应(完成Wire));
    const source = 创建Onboarding数据源(请求);
    await expect(source.完成Onboarding('candidate')).resolves.toEqual(完成Wire);
    expect(请求.mock.calls[0][0]).toEqual({
      path: '/api/v1/me/onboarding/candidate/complete',
      method: 'POST',
      body: {},
    });
  });

  it.each([
    ['completed_at 为 null（null 仅查询允许）', 角色状态Wire('candidate', null)],
    ['status 为 suspended', 角色状态Wire('candidate', 合法时间, 'suspended')],
    ['role 与请求不一致', 角色状态Wire('recruiter', 合法时间)],
    ['result 缺 completed_at 键', { role: 'candidate', status: 'active' }],
    ['result 多 entitlements 键', { role: 'candidate', status: 'active', completed_at: 合法时间, entitlements: [] }],
  ])('POST 契约漂移或额外保证不符 fail closed：%s', async (_场景, result) => {
    const 请求 = vi.fn().mockResolvedValue(响应(result));
    const source = 创建Onboarding数据源(请求);
    await expect(source.完成Onboarding('candidate'))
      .rejects.toMatchObject({ status: 200, code: 'invalid_response' });
  });

  // ── 错误语义：原样传递，不转空 roles 或完成状态 ──

  it.each([
    [503, 'operation_outcome_unknown'],
    [503, 'recruitment_service_unavailable'],
    [401, 'invalid_session'],
    [403, 'role_required'],
    [403, 'role_suspended'],
    [422, 'validation_failed'],
    [404, 'not_found'],
  ])('%s %s 原样传递，不转空 roles 或完成状态', async (status, code) => {
    const 请求 = vi.fn().mockRejectedValue(new BFF错误(status, code, 'fixed'));
    const source = 创建Onboarding数据源(请求);
    await expect(source.读取Onboarding()).rejects.toMatchObject({ status, code });
    await expect(source.完成Onboarding('candidate')).rejects.toMatchObject({ status, code });
  });

  // ── 调用方入参：非法运行时 role 在任何请求前拒绝（客户端错误语义）──

  it.each([
    ['未知角色 admin', 'admin'],
    ['null', null],
    ['undefined', undefined],
  ])('非法运行时 role（%s）在发送前按客户端错误拒绝，零 HTTP', async (_场景, role) => {
    const 请求 = vi.fn();
    const source = 创建Onboarding数据源(请求);
    await expect(source.完成Onboarding(role as unknown as BFF角色))
      .rejects.toMatchObject({ status: 0, code: 'invalid_request' });
    expect(请求).not.toHaveBeenCalled();
  });
});
