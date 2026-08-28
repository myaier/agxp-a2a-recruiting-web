// P1C Task 5：Job request/response 边界的行为测试。
// 直接调用 创建岗位操作().发布岗位/更新岗位，检查传给数据源的 岗位创建上下文 与 previous DTO：
// 决定服务端 claim 的路径必须在这里失败，而不是只依赖纯映射或最终 E2E。
// 约束：BFF岗位创建/实际 JSON 不得出现 publisher_affiliation_ref / publisher_organization_ref /
// hiring_organization_ref / verification status —— 服务端唯一推导 refs。

import { describe, expect, it, vi } from 'vitest';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { BFF岗位样本, BFF企业关系样本, 页面岗位样本 } from '../../测试/BFF样本';
import { 初始状态 } from '../初始状态';
import { 归约, type 动作 } from '../应用状态';
import { BFF错误 } from '../../数据/HTTP客户端';
import type { 后端操作依赖 } from './类型';
import { 创建空P4发现状态 } from './发现推荐操作';
import { 创建岗位操作 } from './岗位操作';

/** 本文件内的页面岗位草稿：Backend 发布的最小完整对象（类别/地点引用齐备） */
const 页面岗位草稿 = {
  ...页面岗位样本,
  类别引用: { id: 'tax_product', display_name: '产品经理' },
  地点引用: { id: 'loc_shanghai', display_name: '上海' },
};

const BFFOwnerJob样本 = BFF岗位样本;

/** 本文件内的依赖 helper：按 组织操作.test.ts 的口径组 后端操作依赖，
 *  派发真实过 归约（方法内通过 状态引用 读最新 state）。 */
function 创建岗位测试依赖(input: {
  数据源: HTTP招聘数据源;
  当前企业关系编号?: string | null;
  未认证公司声明?: string;
  企业关系列表?: Array<typeof BFF企业关系样本>;
}) {
  const deps = {
    后端: input.数据源, 派发: vi.fn(), 设后端状态: vi.fn(),
    主体标识引用: { current: 'sub_1' }, 会话代际: { current: 1 },
    读取恢复企业关系编号: vi.fn(() => null),
    状态引用: {
      current: {
        ...初始状态,
        企业关系列表: input.企业关系列表 ?? [],
        当前企业关系编号: input.当前企业关系编号 ?? null,
        未认证公司声明: input.未认证公司声明 ?? '',
      },
    },
    后端状态引用: { current: {
      初始化: '完成' as const, 已登录: true, 主体: null, 简历快照: null, 意向快照: {}, 岗位快照: {},
      隐私快照: null,
      // P6：Task 3 起 后端状态 携带 Agent 规则原始快照与水合阶段（这里的用例不触达它们）
      候选规则快照: {}, 招聘规则快照: {}, 候选规则提案: {}, 招聘规则提案: {},
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      // P4：Task 3 起 后端状态 extends P4发现状态（这里的用例不触达它们）
      ...创建空P4发现状态(),
      // P2：附件库权威快照（只追加，不动 P6 字段）
      附件简历库: null,
    } },
    锁: { current: new Set<string>() }, 尝试引用: { current: null }, 是后端: true,
  } satisfies 后端操作依赖;
  const 派发 = vi.fn((动作: 动作) => {
    deps.状态引用.current = 归约(deps.状态引用.current, 动作);
  });
  deps.派发 = 派发;
  return deps;
}

describe('创建岗位操作 · Job claim 边界', () => {
  it('无 current relation 时只把未认证声明作为 direct claim', async () => {
    const 创建岗位 = vi.fn(async () => ({ 列表: [页面岗位草稿], 服务端: { job_1: BFFOwnerJob样本 } }));
    const 数据源 = { 创建岗位 } as unknown as HTTP招聘数据源;
    const 操作 = 创建岗位操作(创建岗位测试依赖({
      数据源, 当前企业关系编号: null, 未认证公司声明: '示例客户公司',
    }));
    await 操作.发布岗位(页面岗位草稿);
    expect(创建岗位).toHaveBeenCalledWith(页面岗位草稿, {
      publisherMode: 'direct',
      hiringOrganizationClaim: { display_name: '示例客户公司', legal_name: null },
    });
    expect(JSON.stringify(创建岗位.mock.calls[0])).not.toMatch(/organization_ref|verification_status/);
  });

  it('current active verified relation 只把批准 organization_display_name 作为 direct claim 默认值', async () => {
    const 数据源 = { 创建岗位: vi.fn(async () => ({ 列表: [页面岗位草稿], 服务端: { job_1: BFFOwnerJob样本 } })) } as unknown as HTTP招聘数据源;
    const 操作 = 创建岗位操作(创建岗位测试依赖({
      数据源,
      企业关系列表: [{ ...BFF企业关系样本, organization_display_name: '批准的云衢科技' }],
      当前企业关系编号: 'aff_1',
      未认证公司声明: '旧声明公司',
    }));
    await 操作.发布岗位(页面岗位草稿);
    expect(数据源.创建岗位).toHaveBeenCalledWith(页面岗位草稿, {
      publisherMode: 'direct',
      hiringOrganizationClaim: { display_name: '批准的云衢科技', legal_name: null },
    });
  });

  it('current relation 不是 active verified（pending）时不当作 claim，回落未认证声明，仍允许发岗', async () => {
    const 数据源 = { 创建岗位: vi.fn(async () => ({ 列表: [页面岗位草稿], 服务端: { job_1: BFFOwnerJob样本 } })) } as unknown as HTTP招聘数据源;
    const 操作 = 创建岗位操作(创建岗位测试依赖({
      数据源,
      企业关系列表: [{ ...BFF企业关系样本, status: 'pending' }],
      当前企业关系编号: 'aff_1',
      未认证公司声明: '声明中的公司',
    }));
    await 操作.发布岗位(页面岗位草稿);
    expect(数据源.创建岗位).toHaveBeenCalledWith(页面岗位草稿, {
      publisherMode: 'direct',
      hiringOrganizationClaim: { display_name: '声明中的公司', legal_name: null },
    });
  });

  it('发布岗位后 owner 响应连 publisher/hiring refs/status 存进 后端状态.岗位快照', async () => {
    const dto = {
      ...BFFOwnerJob样本,
      publisher_verification_status: 'verified' as const,
      publisher_organization_ref: 'org_9',
      hiring_organization_verification_status: 'verified' as const,
      hiring_organization_ref: 'org_9',
    };
    const 设后端状态 = vi.fn();
    const deps = 创建岗位测试依赖({
      数据源: { 创建岗位: vi.fn(async () => ({ 列表: [页面岗位草稿], 服务端: { job_1: dto } })) } as unknown as HTTP招聘数据源,
    });
    deps.设后端状态 = 设后端状态;
    await 创建岗位操作(deps).发布岗位(页面岗位草稿);
    expect(设后端状态).toHaveBeenCalled();
    const 更新函数 = 设后端状态.mock.calls[0][0] as (旧: { 岗位快照: Record<string, unknown> }) => { 岗位快照: Record<string, unknown> };
    expect(更新函数({ 岗位快照: {} })).toMatchObject({ 岗位快照: { job_1: dto } });
  });
});

describe('创建岗位操作 · 更新沿用 previous', () => {
  it('更新岗位沿用 previous claim，不读取当前自由文本', async () => {
    const 数据源 = {
      更新岗位: vi.fn(async () => ({ 列表: [页面岗位草稿], 服务端: { job_1: BFFOwnerJob样本 } })),
    } as unknown as HTTP招聘数据源;
    const deps = 创建岗位测试依赖({ 数据源 });
    deps.状态引用.current = {
      ...deps.状态引用.current,
      // 旧路径从 企业认证.公司 取值：这里放一个「篡改值」，previous claim 才是唯一可信来源
      企业认证: { 姓名: '林澈', 公司: '篡改值' },
    };
    deps.后端状态引用.current = {
      ...deps.后端状态引用.current,
      岗位快照: { job_1: BFFOwnerJob样本 },
    };
    const 操作 = 创建岗位操作(deps);
    await 操作.更新岗位({ ...页面岗位草稿, 编号: 'job_1', 公司: '篡改值' } as typeof 页面岗位草稿);
    expect(数据源.更新岗位).toHaveBeenCalledWith(
      expect.objectContaining({ 编号: 'job_1' }), BFFOwnerJob样本,
    );
  });
});

// Task 5：四问硬性事实的 Job 边界。
// 本桩注入的数据源拿到的是页面对象（页面对象 → wire body 的映射在 HTTP 数据源层，
// 由 后端映射.test.ts 的 round-trip 专测覆盖）——所以这里钉死的是：
// operation 必须把完整四员 硬性事实 对象原样交给数据源，不许剥字段、不许缺员；
// 服务端 OwnerJob 缺员时数据源 fail closed，operation 绝不做部分水合；
// 409 时 reread 权威 OwnerJob 恰一次并原样抛错 —— 不重放 PATCH。
describe('创建岗位操作 · 四问硬性事实边界', () => {
  const 完整硬性事实 = {
    大小周: '必须', 纯外包乙方: '不要求', 全现场办公: '未说明', 频繁出差: '必须',
  } as const;
  const 带硬性事实草稿 = { ...页面岗位草稿, 硬性事实: { ...完整硬性事实 } };

  it('create forwards the complete 硬性事实 object to the data source', async () => {
    const 创建岗位 = vi.fn(async () => ({ 列表: [带硬性事实草稿], 服务端: { job_1: BFFOwnerJob样本 } }));
    const 数据源 = { 创建岗位 } as unknown as HTTP招聘数据源;
    const 操作 = 创建岗位操作(创建岗位测试依赖({ 数据源 }));
    await 操作.发布岗位(带硬性事实草稿);
    const 提交岗 = (创建岗位.mock.calls[0] as unknown[])[0] as { 硬性事实?: unknown };
    expect(提交岗.硬性事实).toEqual(完整硬性事实);
  });

  it('update forwards the complete 硬性事实 object to the data source', async () => {
    const 更新岗位 = vi.fn(async () => ({ 列表: [带硬性事实草稿], 服务端: { job_1: BFFOwnerJob样本 } }));
    const 数据源 = { 更新岗位 } as unknown as HTTP招聘数据源;
    const deps = 创建岗位测试依赖({ 数据源 });
    deps.后端状态引用.current = {
      ...deps.后端状态引用.current,
      岗位快照: { job_1: BFFOwnerJob样本 },
    };
    await 创建岗位操作(deps).更新岗位({ ...带硬性事实草稿, 编号: 'job_1' });
    const 补丁岗 = (更新岗位.mock.calls[0] as unknown[])[0] as { 硬性事实?: unknown };
    expect(补丁岗.硬性事实).toEqual(完整硬性事实);
  });

  it('owner DTO missing one hard fact rejects before state hydration', async () => {
    // 模拟数据源层 fail closed（缺员校验本身在 招聘数据源/岗位.test.ts 有专测）：
    // 这里证明 operation 在数据源抛错后不派发水合、不动 后端状态 —— 不留半份本地岗位。
    const 设后端状态 = vi.fn();
    const deps = 创建岗位测试依赖({
      数据源: {
        创建岗位: vi.fn(async () => { throw new Error('invalid_response'); }),
      } as unknown as HTTP招聘数据源,
    });
    deps.设后端状态 = 设后端状态;
    const 派发Spy = vi.fn((动作: 动作) => {
      deps.状态引用.current = 归约(deps.状态引用.current, 动作);
    });
    deps.派发 = 派发Spy;
    await expect(创建岗位操作(deps).发布岗位(带硬性事实草稿)).rejects.toThrow('invalid_response');
    expect(派发Spy).not.toHaveBeenCalled();
    expect(设后端状态).not.toHaveBeenCalled();
  });

  it('409 update rereads authoritative OwnerJob once and never replays PATCH', async () => {
    const 服务端权威 = { ...BFFOwnerJob样本, title: '服务端权威标题', revision: 7 };
    const 重读快照 = { 列表: [带硬性事实草稿], 服务端: { job_1: 服务端权威 } };
    const 设后端状态 = vi.fn();
    let 补丁调用数 = 0;
    const 数据源 = {
      更新岗位: vi.fn(async () => { 补丁调用数 += 1; throw new BFF错误(409, 'version_conflict', '版本冲突'); }),
      读取岗位: vi.fn(async () => 重读快照),
    } as unknown as HTTP招聘数据源;
    const deps = 创建岗位测试依赖({ 数据源 });
    deps.设后端状态 = 设后端状态;
    deps.后端状态引用.current = {
      ...deps.后端状态引用.current,
      岗位快照: { job_1: BFFOwnerJob样本 },
    };
    const 操作 = 创建岗位操作(deps);
    await expect(操作.更新岗位({ ...带硬性事实草稿, 编号: 'job_1' })).rejects.toThrow('版本冲突');
    // PATCH 只发过一次：冲突后重读权威值，绝不自动重放编辑请求
    expect(数据源.更新岗位).toHaveBeenCalledTimes(1);
    expect(补丁调用数).toBe(1);
    expect(数据源.读取岗位).toHaveBeenCalledTimes(1);
    // 本地列表被权威服务端快照覆盖（含服务端的最新标题/revision），而不是保留本地乐观编辑
    expect(deps.派发).toHaveBeenCalledWith({ 型: '水合后端岗位', 快照: 重读快照 });
    expect(deps.派发.mock.calls.some((call) =>
      (call[0] as { 型: string }).型 === '更新岗位',
    )).toBe(false);
    expect(设后端状态).toHaveBeenCalled();
  });
});
