// P3 Task 2：自身隐私快照的读写 / 组织屏蔽与解除 / 可屏蔽组织搜索的行为边界。
// 直接驱动 创建隐私操作(deps)，对账 数据源 方法调用、派发的 action 与功能式 设后端状态：
// 无乐观写 —— 服务端成功先于任何本地提交；恢复路径按 BFF code 分派
// （version_conflict / organization_already_blocked / risk_acknowledgement_required 各自
// 重读权威视图并原样抛出，绝不重放变更）；只有变更 status 0/503 允许一次 GET 校验结果。

import { describe, expect, it, vi, type Mock } from 'vitest';
import { BFF错误 } from '../../数据/HTTP客户端';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type { BFF隐私快照 } from '../../数据/BFF契约';
import {
  BFF隐私快照样本,
  BFF隐私组织屏蔽样本,
  BFF屏蔽回执样本,
  BFF组织搜索页样本,
} from '../../测试/BFF样本';
import { 从BFF隐私, 披露编号到BFF, 披露档到BFF, 屏蔽来源到BFF } from '../../数据/隐私映射';
import type { 屏蔽项 } from '../../数据/类型';
import type { 组织搜索查询 } from '../../数据/招聘数据源类型';
import { 初始状态 } from '../初始状态';
import { 归约, type 动作 } from '../应用状态';
import type { 后端操作依赖, 后端状态 } from './类型';
import { 创建隐私操作 } from './隐私操作';

function 创建隐私测试依赖(后端: HTTP招聘数据源, 服务端: BFF隐私快照) {
  const 页面 = 从BFF隐私(服务端);
  const 状态引用 = { current: 归约(初始状态, { 型: '水合后端隐私', 快照: 页面 }) };
  const deps = {
    是后端: true, 后端, 派发: vi.fn(), 设后端状态: vi.fn(), 状态引用,
    后端状态引用: { current: {
      初始化: '完成' as const, 已登录: true, 主体: null, 简历快照: null,
      意向快照: {}, 岗位快照: {}, 隐私快照: 服务端,
      // P6：Task 3 起 后端状态 携带 Agent 规则原始快照与水合阶段（这里的用例不触达它们）
      候选规则快照: {}, 招聘规则快照: {}, 候选规则提案: {}, 招聘规则提案: {},
      Agent规则水合: {
        candidate: { rules: '未开始' as const, proposals: '未开始' as const },
        recruiter: { rules: '未开始' as const, proposals: '未开始' as const },
      },
    } },
    锁: { current: new Set<string>() }, 尝试引用: { current: null as string | null },
    主体标识引用: { current: 'sub_1' as string | null }, 会话代际: { current: 1 },
    读取恢复企业关系编号: vi.fn(() => null),
  } satisfies 后端操作依赖;
  deps.派发 = vi.fn((动作: 动作) => {
    deps.状态引用.current = 归约(deps.状态引用.current, 动作);
  });
  return deps;
}

/** 断言用：把 设后端状态 收到的功能式更新依序折叠到 ref 上，取最终 后端状态.隐私快照。 */
function 更新后的隐私快照(
  deps: 后端操作依赖 & { 设后端状态: Mock },
): BFF隐私快照 | null {
  let 最新 = deps.后端状态引用.current;
  for (const 调用 of deps.设后端状态.mock.calls as unknown as Array<[(旧: 后端状态) => 后端状态]>) {
    最新 = 调用[0](最新);
  }
  return 最新.隐私快照;
}

/** 本文件内的解除行：组织编号 org_block_1 与 BFF隐私快照样本 的屏蔽行一致。 */
const 解除屏蔽行样本: 屏蔽项 = {
  编号: 'org_block_1', 名称: '云衢科技', 首字: '云', 理由: '你手动加入 · 双向不可见',
  时间: '2026-08-24', 组织编号: 'org_block_1', 来源: '手动添加', 组织状态: '有效',
};

const 结果未知503 = () => new BFF错误(503, 'operation_outcome_unknown', 'down');

describe('创建隐私操作 · 成功路径（服务端成功先于本地提交）', () => {
  it('设置雇主隐私 只发送布尔开关字段，成功后才提交权威快照', async () => {
    const 修改隐私 = vi.fn().mockResolvedValue(从BFF隐私({ ...BFF隐私快照样本, employer_privacy_enabled: false }));
    const deps = 创建隐私测试依赖({ 修改隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本);
    await 创建隐私操作(deps).设置雇主隐私(false);
    expect(修改隐私).toHaveBeenCalledWith({ employer_privacy_enabled: false }, BFF隐私快照样本.revision);
    expect(更新后的隐私快照(deps)?.employer_privacy_enabled).toBe(false);
    expect(修改隐私).toHaveBeenCalledTimes(1);
  });

  it('设置披露偏好 补丁只含单个披露字段，不带其他成员或展示文案', async () => {
    const 修改隐私 = vi.fn().mockResolvedValue(从BFF隐私(BFF隐私快照样本));
    const deps = 创建隐私测试依赖({ 修改隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本);
    await 创建隐私操作(deps).设置披露偏好('D-04', '不披露');
    expect(修改隐私.mock.calls[0][0]).toEqual({
      disclosure_preferences: { [披露编号到BFF('D-04')]: 披露档到BFF('不披露') },
    });
    expect(JSON.stringify(修改隐私.mock.calls[0][0])).not.toContain('不披露');
    expect(修改隐私).toHaveBeenCalledTimes(1);
  });

  it('搜索可屏蔽组织 透传查询并返回服务端分页', async () => {
    const 搜索组织 = vi.fn().mockResolvedValue(BFF组织搜索页样本);
    const deps = 创建隐私测试依赖({ 搜索组织 } as unknown as HTTP招聘数据源, BFF隐私快照样本);
    const 查询: 组织搜索查询 = { q: '云衢', limit: 20 };
    await expect(创建隐私操作(deps).搜索可屏蔽组织(查询)).resolves.toBe(BFF组织搜索页样本);
    expect(搜索组织).toHaveBeenCalledWith(查询);
  });

  it('非 BFF 错误原样抛出且不触发重读', async () => {
    const 修改隐私 = vi.fn().mockRejectedValue(new Error('网络断了'));
    const deps = 创建隐私测试依赖({ 修改隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本);
    await expect(创建隐私操作(deps).设置雇主隐私(true)).rejects.toThrow('网络断了');
    expect(deps.设后端状态).not.toHaveBeenCalled();
  });
});

describe('创建隐私操作 · 添加组织屏蔽回执合并', () => {
  it('receipt upserts block and advances revision without a second mutation', async () => {
    const 添加组织屏蔽 = vi.fn(async () => BFF屏蔽回执样本);
    const 数据源 = { 添加组织屏蔽 } as unknown as HTTP招聘数据源;
    const deps = 创建隐私测试依赖(数据源, BFF隐私快照样本);
    await 创建隐私操作(deps).添加组织屏蔽('org_2', '手动添加');
    expect(添加组织屏蔽).toHaveBeenCalledTimes(1);
    expect(添加组织屏蔽).toHaveBeenCalledWith('org_2', 屏蔽来源到BFF('手动添加'), BFF隐私快照样本.revision);
    expect(deps.派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '水合后端隐私' }));
    const 更新 = deps.设后端状态.mock.calls.at(-1)![0] as (旧: 后端状态) => 后端状态;
    expect(更新(deps.后端状态引用.current).隐私快照?.revision).toBe(BFF屏蔽回执样本.privacy_revision);
  });

  it('同组织重复添加时回执 upsert 替换原行而不追加重复，也不合成 updated_at', async () => {
    // 回执的 organization_block 是 org_block_1 —— 基线里已有同 ID 行
    const 添加组织屏蔽 = vi.fn(async () => BFF屏蔽回执样本);
    const deps = 创建隐私测试依赖(
      { 添加组织屏蔽 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await 创建隐私操作(deps).添加组织屏蔽('org_block_1', '手动添加');
    expect(添加组织屏蔽).toHaveBeenCalledTimes(1);
    const 最新 = 更新后的隐私快照(deps)!;
    expect(最新.organization_blocks).toHaveLength(1);
    expect(最新.organization_blocks[0].organization_id).toBe('org_block_1');
    expect(最新.revision).toBe(BFF屏蔽回执样本.privacy_revision);
    expect(JSON.stringify(最新)).not.toContain('updated_at');
  });

  it('添加组织屏蔽 organization_already_blocked（409）重读权威视图并原样抛出，不重放变更', async () => {
    const 添加组织屏蔽 = vi.fn().mockRejectedValue(new BFF错误(409, 'organization_already_blocked', 'dup'));
    const 读取隐私 = vi.fn().mockResolvedValue(从BFF隐私({ ...BFF隐私快照样本, revision: 9 }));
    const deps = 创建隐私测试依赖(
      { 添加组织屏蔽, 读取隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await expect(
      创建隐私操作(deps).添加组织屏蔽('org_block_1', '手动添加'),
    ).rejects.toMatchObject({ code: 'organization_already_blocked' });
    expect(添加组织屏蔽).toHaveBeenCalledTimes(1);
    expect(读取隐私).toHaveBeenCalledTimes(1);
    expect(更新后的隐私快照(deps)?.revision).toBe(9);
  });
});

describe('创建隐私操作 · 冲突按 code 分派：重读权威 + 原样抛出', () => {
  it('409 rereads authoritative privacy but does not replay the patch', async () => {
    const 修改 = vi.fn().mockRejectedValue(new BFF错误(409, 'version_conflict', 'conflict'));
    const 读取 = vi.fn().mockResolvedValue(从BFF隐私({ ...BFF隐私快照样本, revision: 9 }));
    const 数据源 = { 修改隐私: 修改, 读取隐私: 读取 } as unknown as HTTP招聘数据源;
    const deps = 创建隐私测试依赖(数据源, BFF隐私快照样本);
    await expect(创建隐私操作(deps).设置雇主隐私(false)).rejects.toMatchObject({ code: 'version_conflict' });
    expect(修改).toHaveBeenCalledTimes(1);
    expect(读取).toHaveBeenCalledTimes(1);
    expect(更新后的隐私快照(deps)?.revision).toBe(9);
  });

  it('重读权威遇 401 也走统一清账号，原始冲突错误仍原样抛出', async () => {
    const 修改 = vi.fn().mockRejectedValue(new BFF错误(409, 'version_conflict', 'conflict'));
    const 读取 = vi.fn().mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const deps = 创建隐私测试依赖(
      { 修改隐私: 修改, 读取隐私: 读取, 清空目录缓存: vi.fn() } as unknown as HTTP招聘数据源,
      BFF隐私快照样本,
    );
    await expect(创建隐私操作(deps).设置雇主隐私(false)).rejects.toMatchObject({ code: 'version_conflict' });
    expect(修改).toHaveBeenCalledTimes(1);
    expect(读取).toHaveBeenCalledTimes(1);
    // 会话在重读途中过期：清理必须落地（隐私清空 + 主体/代际复位），不能顶着失效会话
    expect(deps.派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '清后端隐私' }));
    expect(deps.主体标识引用.current).toBeNull();
    expect(deps.会话代际.current).toBe(2);
  });

  it('解除组织屏蔽 risk_acknowledgement_required 以 HTTP 422 到达时重读并提交权威来源再抛出', async () => {
    const 解除组织屏蔽 = vi.fn().mockRejectedValue(new BFF错误(422, 'risk_acknowledgement_required', 'risk'));
    const 读取隐私 = vi.fn().mockResolvedValue(从BFF隐私({ ...BFF隐私快照样本, organization_blocks: [], revision: 7 }));
    const deps = 创建隐私测试依赖(
      { 解除组织屏蔽, 读取隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await expect(
      创建隐私操作(deps).解除组织屏蔽(解除屏蔽行样本),
    ).rejects.toMatchObject({ code: 'risk_acknowledgement_required' });
    expect(解除组织屏蔽).toHaveBeenCalledTimes(1);
    expect(读取隐私).toHaveBeenCalledTimes(1);
    const 最新 = 更新后的隐私快照(deps)!;
    expect(最新.organization_blocks).toEqual([]);
    expect(最新.revision).toBe(7);
  });

  it('自动建档来源（当前雇主）的解除携带 risk_acknowledged=true', async () => {
    const 解除组织屏蔽 = vi.fn().mockResolvedValue(从BFF隐私({ ...BFF隐私快照样本, organization_blocks: [] }));
    const deps = 创建隐私测试依赖(
      { 解除组织屏蔽 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await 创建隐私操作(deps).解除组织屏蔽({ ...解除屏蔽行样本, 来源: '当前雇主' });
    expect(解除组织屏蔽).toHaveBeenCalledWith('org_block_1', true, BFF隐私快照样本.revision);
  });
});

describe('创建隐私操作 · 解除组织屏蔽 404 以权威视图为准', () => {
  it('权威视图已不含该组织时视为成功且只读一次', async () => {
    const 解除组织屏蔽 = vi.fn().mockRejectedValue(new BFF错误(404, 'organization_not_found', 'gone'));
    const 读取隐私 = vi.fn().mockResolvedValue(从BFF隐私({ ...BFF隐私快照样本, organization_blocks: [] }));
    const deps = 创建隐私测试依赖(
      { 解除组织屏蔽, 读取隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await 创建隐私操作(deps).解除组织屏蔽(解除屏蔽行样本);
    expect(解除组织屏蔽).toHaveBeenCalledTimes(1);
    expect(解除组织屏蔽).toHaveBeenCalledWith('org_block_1', false, BFF隐私快照样本.revision);
    expect(读取隐私).toHaveBeenCalledTimes(1);
    expect(更新后的隐私快照(deps)?.organization_blocks).toEqual([]);
  });

  it('权威视图仍含该组织时原样抛出 404', async () => {
    const 解除组织屏蔽 = vi.fn().mockRejectedValue(new BFF错误(404, 'organization_not_found', 'still there'));
    const 读取隐私 = vi.fn().mockResolvedValue(从BFF隐私(BFF隐私快照样本));
    const deps = 创建隐私测试依赖(
      { 解除组织屏蔽, 读取隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await expect(
      创建隐私操作(deps).解除组织屏蔽(解除屏蔽行样本),
    ).rejects.toMatchObject({ status: 404 });
    expect(解除组织屏蔽).toHaveBeenCalledTimes(1);
    expect(读取隐私).toHaveBeenCalledTimes(1);
  });
});

describe('创建隐私操作 · 变更 status 0/503 只允许一次 GET 校验真实效果', () => {
  it('PATCH 503 后一次 GET 确认开关已达成才兑现', async () => {
    const 修改隐私 = vi.fn().mockRejectedValue(结果未知503());
    const 读取隐私 = vi.fn()
      .mockResolvedValue(从BFF隐私({ ...BFF隐私快照样本, employer_privacy_enabled: false }));
    const deps = 创建隐私测试依赖(
      { 修改隐私, 读取隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await 创建隐私操作(deps).设置雇主隐私(false);
    expect(修改隐私).toHaveBeenCalledTimes(1);
    expect(读取隐私).toHaveBeenCalledTimes(1);
    expect(更新后的隐私快照(deps)?.employer_privacy_enabled).toBe(false);
  });

  it('PATCH 503 但 GET 未确认目标时原样抛出', async () => {
    const 修改隐私 = vi.fn().mockRejectedValue(结果未知503());
    const 读取隐私 = vi.fn().mockResolvedValue(从BFF隐私(BFF隐私快照样本));
    const deps = 创建隐私测试依赖(
      { 修改隐私, 读取隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await expect(创建隐私操作(deps).设置雇主隐私(false)).rejects.toMatchObject({ status: 503 });
    expect(修改隐私).toHaveBeenCalledTimes(1);
    expect(读取隐私).toHaveBeenCalledTimes(1);
  });

  it('披露 PATCH 503 后一次 GET 确认单字段值才兑现', async () => {
    const 修改隐私 = vi.fn().mockRejectedValue(结果未知503());
    const 读取隐私 = vi.fn().mockResolvedValue(从BFF隐私({
      ...BFF隐私快照样本,
      disclosure_preferences: { ...BFF隐私快照样本.disclosure_preferences, education: 'never' },
    }));
    const deps = 创建隐私测试依赖(
      { 修改隐私, 读取隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await 创建隐私操作(deps).设置披露偏好('D-04', '不披露');
    expect(修改隐私).toHaveBeenCalledTimes(1);
    expect(读取隐私).toHaveBeenCalledTimes(1);
    // 页面侧（reducer）的 D-04 档已换成服务端权威值
    expect(deps.状态引用.current.披露偏好.find((条) => 条.编号 === 'D-04')?.档).toBe('不披露');
  });

  it('披露 PATCH 503 但 GET 未确认时原样抛出', async () => {
    const 修改隐私 = vi.fn().mockRejectedValue(结果未知503());
    const 读取隐私 = vi.fn().mockResolvedValue(从BFF隐私(BFF隐私快照样本));
    const deps = 创建隐私测试依赖(
      { 修改隐私, 读取隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await expect(创建隐私操作(deps).设置披露偏好('D-04', '不披露')).rejects.toMatchObject({ status: 503 });
    expect(修改隐私).toHaveBeenCalledTimes(1);
    expect(读取隐私).toHaveBeenCalledTimes(1);
  });

  it('AddBlock 503 后一次 GET 确认同 ID 同来源才兑现', async () => {
    const 添加组织屏蔽 = vi.fn().mockRejectedValue(结果未知503());
    const 读取隐私 = vi.fn().mockResolvedValue(从BFF隐私({
      ...BFF隐私快照样本,
      organization_blocks: [
        ...BFF隐私快照样本.organization_blocks,
        { ...BFF隐私组织屏蔽样本, organization_id: 'org_2', organization_display_name: '示例二号公司' },
      ],
    }));
    const deps = 创建隐私测试依赖(
      { 添加组织屏蔽, 读取隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await 创建隐私操作(deps).添加组织屏蔽('org_2', '手动添加');
    expect(添加组织屏蔽).toHaveBeenCalledTimes(1);
    expect(读取隐私).toHaveBeenCalledTimes(1);
    expect(
      更新后的隐私快照(deps)!.organization_blocks.some((块) => 块.organization_id === 'org_2'),
    ).toBe(true);
  });

  it('AddBlock 503 但 GET 只见同 ID 不同来源时不算达成，原样抛出', async () => {
    const 添加组织屏蔽 = vi.fn().mockRejectedValue(结果未知503());
    const 读取隐私 = vi.fn().mockResolvedValue(从BFF隐私(BFF隐私快照样本));
    const deps = 创建隐私测试依赖(
      { 添加组织屏蔽, 读取隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await expect(
      创建隐私操作(deps).添加组织屏蔽('org_block_1', '当前雇主'),
    ).rejects.toMatchObject({ status: 503 });
    expect(添加组织屏蔽).toHaveBeenCalledTimes(1);
    expect(读取隐私).toHaveBeenCalledTimes(1);
  });

  it('Unblock 503 后一次 GET 确认组织已不在名单里才兑现', async () => {
    const 解除组织屏蔽 = vi.fn().mockRejectedValue(结果未知503());
    const 读取隐私 = vi.fn().mockResolvedValue(从BFF隐私({ ...BFF隐私快照样本, organization_blocks: [] }));
    const deps = 创建隐私测试依赖(
      { 解除组织屏蔽, 读取隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await 创建隐私操作(deps).解除组织屏蔽(解除屏蔽行样本);
    expect(解除组织屏蔽).toHaveBeenCalledTimes(1);
    expect(读取隐私).toHaveBeenCalledTimes(1);
    expect(更新后的隐私快照(deps)?.organization_blocks).toEqual([]);
  });

  it('Unblock 503 但 GET 显示组织仍在名单里时原样抛出', async () => {
    const 解除组织屏蔽 = vi.fn().mockRejectedValue(结果未知503());
    const 读取隐私 = vi.fn().mockResolvedValue(从BFF隐私(BFF隐私快照样本));
    const deps = 创建隐私测试依赖(
      { 解除组织屏蔽, 读取隐私 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await expect(
      创建隐私操作(deps).解除组织屏蔽(解除屏蔽行样本),
    ).rejects.toMatchObject({ status: 503 });
    expect(解除组织屏蔽).toHaveBeenCalledTimes(1);
    expect(读取隐私).toHaveBeenCalledTimes(1);
  });
});

describe('创建隐私操作 · 401 统一清理', () => {
  it('搜索可屏蔽组织 401 触发 清账号状态 并拒绝', async () => {
    const 搜索组织 = vi.fn().mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 清空目录缓存 = vi.fn();
    const deps = 创建隐私测试依赖(
      { 搜索组织, 清空目录缓存 } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await expect(创建隐私操作(deps).搜索可屏蔽组织({ q: '云衢' })).rejects.toMatchObject({ status: 401 });
    expect(清空目录缓存).toHaveBeenCalled();
    expect(deps.派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '清后端隐私' }));
    expect(deps.主体标识引用.current).toBeNull();
    expect(deps.会话代际.current).toBe(2);
  });

  it('修改隐私 401 触发 清账号状态 且不重读隐私', async () => {
    const 修改隐私 = vi.fn().mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 读取隐私 = vi.fn();
    const deps = 创建隐私测试依赖(
      { 修改隐私, 读取隐私, 清空目录缓存: vi.fn() } as unknown as HTTP招聘数据源, BFF隐私快照样本,
    );
    await expect(创建隐私操作(deps).设置雇主隐私(false)).rejects.toMatchObject({ status: 401 });
    expect(读取隐私).not.toHaveBeenCalled();
    expect(deps.派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '清后端隐私' }));
  });
});
