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
import type { 后端操作依赖 } from './类型';
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
