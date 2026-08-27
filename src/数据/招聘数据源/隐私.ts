// 隐私域数据源：BFF /api/v1/me/privacy 的整读、稀疏补丁、组织屏蔽与解除。
// P3 第七个域 facade：协议形状按 recruitment-bff OpenAPI 冻结 ——
// GET/PATCH 整视图（ETag=aggregate revision，写回 quoted If-Match）、
// AddBlock POST 带幂等键回 receipt（200 重放 / 201 新建同一形状）、
// Unblock POST {organization_id}/unblock 带 risk_acknowledged 回整视图。
// 每个响应先按闭合 DTO strict decode（exact key set + 闭合 enum + 必需 updated_at），
// 再投影成页面快照；接口失败绝不回退 Mock。本模块不 import React 或模拟数据。

import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type {
  BFF隐私补丁,
  BFF隐私屏蔽回执,
  BFF隐私组织屏蔽,
  BFF隐私视图,
  BFF屏蔽来源,
  BFF披露档,
  BFF披露偏好,
} from '../BFF契约';
import type { 页面隐私快照 } from '../招聘数据源类型';
import { 从BFF隐私 } from '../隐私映射';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

export interface 隐私数据源 {
  读取隐私(): Promise<页面隐私快照>;
  修改隐私(patch: BFF隐私补丁, revision: number): Promise<页面隐私快照>;
  添加组织屏蔽(organizationId: string, source: BFF屏蔽来源, revision: number): Promise<BFF隐私屏蔽回执>;
  解除组织屏蔽(organizationId: string, riskAcknowledged: boolean, revision: number): Promise<页面隐私快照>;
}

// ── 本域小 guard：只写隐私域需要的几个断言，不引入第三方 validator ──

function 契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', '服务返回了不符合契约的隐私数据');
}

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：缺必需键或多出未知键都按契约漂移 fail closed。 */
function 要求闭合对象(input: unknown, 必需键: readonly string[]): Record<string, unknown> {
  if (!是记录(input)) throw 契约错误();
  for (const 键 of 必需键) if (!(键 in input)) throw 契约错误();
  for (const 键 of Object.keys(input)) if (!必需键.includes(键)) throw 契约错误();
  return input;
}

function 要求字符串(值: unknown): string {
  if (typeof 值 !== 'string') throw 契约错误();
  return 值;
}

function 要求整数(值: unknown): number {
  if (typeof 值 !== 'number' || !Number.isInteger(值)) throw 契约错误();
  return 值;
}

function 要求布尔(值: unknown): boolean {
  if (typeof 值 !== 'boolean') throw 契约错误();
  return 值;
}

function 要求数组(值: unknown): unknown[] {
  if (!Array.isArray(值)) throw 契约错误();
  return 值;
}

function 要求枚举<T extends string>(值: unknown, 取值: readonly T[]): T {
  if (typeof 值 !== 'string') throw 契约错误();
  for (const 候选 of 取值) if (候选 === 值) return 候选;
  throw 契约错误();
}

// ── 闭合 vocabulary ──

const 披露档全表 = ['never', 'resume_submission', 'anonymous'] as const satisfies readonly BFF披露档[];
const 屏蔽来源全表: readonly BFF屏蔽来源[] = ['current_employer', 'related_organization', 'manual'];
const 组织状态全表: readonly ('active' | 'suspended')[] = ['active', 'suspended'];

// ── 具体 decoder：逐字段过 guard，不做 `as` 直转 ──

const 视图必需键 = [
  'employer_privacy_enabled', 'disclosure_preferences', 'organization_blocks', 'revision', 'updated_at',
] as const;

function 解披露偏好(input: unknown): BFF披露偏好 {
  const raw = 要求闭合对象(input, ['current_employer', 'education', 'portfolio_links'] as const);
  return {
    current_employer: 要求枚举<BFF披露档>(raw.current_employer, 披露档全表),
    education: 要求枚举<BFF披露档>(raw.education, 披露档全表),
    portfolio_links: 要求枚举<BFF披露档>(raw.portfolio_links, 披露档全表),
  };
}

function 解组织屏蔽(input: unknown): BFF隐私组织屏蔽 {
  const raw = 要求闭合对象(input, [
    'organization_id', 'organization_display_name', 'organization_status', 'source', 'created_at',
  ] as const);
  return {
    organization_id: 要求字符串(raw.organization_id),
    organization_display_name: 要求字符串(raw.organization_display_name),
    organization_status: 要求枚举<'active' | 'suspended'>(raw.organization_status, 组织状态全表),
    source: 要求枚举<BFF屏蔽来源>(raw.source, 屏蔽来源全表),
    created_at: 要求字符串(raw.created_at),
  };
}

function 解隐私视图(input: unknown): BFF隐私视图 {
  const raw = 要求闭合对象(input, 视图必需键);
  return {
    employer_privacy_enabled: 要求布尔(raw.employer_privacy_enabled),
    disclosure_preferences: 解披露偏好(raw.disclosure_preferences),
    organization_blocks: 要求数组(raw.organization_blocks).map(解组织屏蔽),
    revision: 要求整数(raw.revision),
    updated_at: 要求字符串(raw.updated_at),
  };
}

const 回执必需键 = ['organization_block', 'privacy_revision', 'created_at'] as const;

function 解屏蔽回执(input: unknown): BFF隐私屏蔽回执 {
  const raw = 要求闭合对象(input, 回执必需键);
  return {
    organization_block: 解组织屏蔽(raw.organization_block),
    privacy_revision: 要求整数(raw.privacy_revision),
    created_at: 要求字符串(raw.created_at),
  };
}

function 修订etag(revision: number): string {
  return `"${revision}"`;
}

/** wire 全视图 → 页面快照：只投影四个页面自有字段，刻意丢弃 updated_at。 */
function 快照化(视图: BFF隐私视图): 页面隐私快照 {
  return 从BFF隐私({
    employer_privacy_enabled: 视图.employer_privacy_enabled,
    disclosure_preferences: 视图.disclosure_preferences,
    organization_blocks: 视图.organization_blocks,
    revision: 视图.revision,
  });
}

export function 创建隐私数据源(请求: 请求函数): 隐私数据源 {
  return {
    async 读取隐私() {
      const { result } = await 请求<unknown>({ path: '/api/v1/me/privacy' });
      return 快照化(解隐私视图(result));
    },
    async 修改隐私(patch, revision) {
      const { result } = await 请求<unknown>({
        path: '/api/v1/me/privacy',
        method: 'PATCH',
        body: patch,
        ifMatch: 修订etag(revision),
      });
      return 快照化(解隐私视图(result));
    },
    async 添加组织屏蔽(organizationId, source, revision) {
      // 幂等：同 key 重放或同 source 重复都以 200 回原 receipt，与 201 同形。
      const { result } = await 请求<unknown>({
        path: '/api/v1/me/privacy/organization-blocks',
        method: 'POST',
        body: { organization_id: organizationId, source },
        ifMatch: 修订etag(revision),
        幂等: true,
      });
      return 解屏蔽回执(result);
    },
    async 解除组织屏蔽(organizationId, riskAcknowledged, revision) {
      const { result } = await 请求<unknown>({
        path: `/api/v1/me/privacy/organization-blocks/${organizationId}/unblock`,
        method: 'POST',
        body: { risk_acknowledged: riskAcknowledged },
        ifMatch: 修订etag(revision),
      });
      return 快照化(解隐私视图(result));
    },
  };
}
