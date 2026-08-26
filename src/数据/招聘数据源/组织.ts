// 组织域数据源：BFF /api/v1 的 RecruiterProfile / Affiliation / 企业管理员申请 / 企业档案与媒体。
// 第六个域 facade：协议代码（path / method / body / If-Match / 幂等 / multipart）按 P1B 冻结契约实现。
// 每个响应先按闭合 DTO strict decode（exact key set + 闭合 enum），不 `as` 直转；接口失败绝不回退 Mock。
// 本模块不 import React、Mock 或静态公司档案。

import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type {
  BFF企业媒体,
  BFF企业媒体用途,
  BFF企业档案,
  BFF企业档案替换,
  BFF企业关系,
  BFF企业关系列表,
  BFF企业规模,
  BFF企业管理员申请,
  BFF企业管理员申请列表,
  BFF企业管理员申请元数据,
  BFF作息,
  BFF福利码,
  BFF融资阶段,
  BFF公开企业,
  BFF团队成员,
  BFF目录引用,
  BFF招聘方档案,
  BFF招聘方档案补丁,
} from '../BFF契约';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

export interface 组织数据源 {
  读取招聘方档案(): Promise<BFF招聘方档案>;
  保存招聘方档案(patch: BFF招聘方档案补丁, revision: number): Promise<BFF招聘方档案>;
  读取我的企业关系(): Promise<BFF企业关系[]>;
  读取企业管理员申请(): Promise<BFF企业管理员申请[]>;
  创建企业管理员申请(metadata: BFF企业管理员申请元数据, evidence: File[]): Promise<BFF企业管理员申请>;
  取消企业管理员申请(requestId: string, revision: number): Promise<BFF企业管理员申请>;
  接受企业邀请(token: string): Promise<BFF企业关系>;
  替换招聘方头像(file: File, revision: number): Promise<BFF招聘方档案>;
  读取企业档案(organizationId: string): Promise<BFF企业档案>;
  替换企业档案(organizationId: string, body: BFF企业档案替换, revision: number): Promise<BFF企业档案>;
  上传企业媒体(organizationId: string, purpose: BFF企业媒体用途, file: File): Promise<BFF企业媒体>;
  删除企业媒体(organizationId: string, mediaId: string): Promise<void>;
  读取公开企业(organizationId: string): Promise<BFF公开企业>;
}

// ── 本域小 guard：只写组织域需要的几个断言，不引入第三方 validator ──

function 契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', '服务返回了不符合契约的组织数据');
}

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：缺必需键或多出未知键都按契约漂移 fail closed。 */
function 要求闭合对象(
  input: unknown,
  必需键: readonly string[],
  可选键: readonly string[] = [],
): Record<string, unknown> {
  if (!是记录(input)) throw 契约错误();
  for (const 键 of 必需键) if (!(键 in input)) throw 契约错误();
  const 允许键 = new Set([...必需键, ...可选键]);
  for (const 键 of Object.keys(input)) if (!允许键.has(键)) throw 契约错误();
  return input;
}

function 要求字符串(值: unknown): string {
  if (typeof 值 !== 'string') throw 契约错误();
  return 值;
}

/** 缺键与 null 都归一为 null（RecruiterProfile 的 verified_name/avatar_url）。 */
function 要求可空可缺字符串(值: unknown): string | null {
  return 值 === undefined || 值 === null ? null : 要求字符串(值);
}

/** 键必须存在（由 要求闭合对象 保证），值可为 null。 */
function 要求可空字符串(值: unknown): string | null {
  return 值 === null ? null : 要求字符串(值);
}

function 要求整数(值: unknown): number {
  if (typeof 值 !== 'number' || !Number.isInteger(值)) throw 契约错误();
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

// ── 闭合 vocabulary（与 BFF契约 的 union 一一对应）──

const 福利码全表 = [
  'social_insurance_housing_fund', 'supplementary_medical', 'stock_options', 'flexible_work',
  'annual_physical_exam', 'regular_physical_exam', 'paid_annual_leave', 'meal_allowance',
  'transport_allowance', 'housing_allowance', 'holiday_benefits', 'team_building_meals',
  'snacks_afternoon_tea', 'overtime_allowance', 'year_end_bonus', 'shuttle_bus', 'regular_training',
] as const satisfies readonly BFF福利码[];
const 企业规模全表 = ['', 'under_20', '20_99', '100_499', '500_1000', '1000_9999', '10000_plus'] as const satisfies readonly BFF企业规模[];
const 融资阶段全表 = ['', 'unfunded', 'angel', 'series_a', 'series_b', 'series_c', 'series_d_plus', 'public', 'self_funded'] as const satisfies readonly BFF融资阶段[];
const 作息全表 = ['', 'two_day_weekend', 'alternate_saturday', 'flexible'] as const satisfies readonly BFF作息[];

// ── 具体 decoder：逐字段过 guard，不做 `as` 直转 ──

const 招聘方档案必需键 = [
  'public_name', 'title', 'personal_verification_status', 'revision',
] as const;
const 招聘方档案可选键 = ['verified_name', 'avatar_url'] as const;

function 解招聘方档案(input: unknown): BFF招聘方档案 {
  const raw = 要求闭合对象(input, 招聘方档案必需键, 招聘方档案可选键);
  return {
    public_name: 要求字符串(raw.public_name),
    title: 要求字符串(raw.title),
    personal_verification_status: 要求枚举(raw.personal_verification_status, ['unverified', 'verified'] as const),
    verified_name: 要求可空可缺字符串(raw.verified_name),
    avatar_url: 要求可空可缺字符串(raw.avatar_url),
    revision: 要求整数(raw.revision),
  };
}

const 企业关系必需键 = [
  'affiliation_id', 'organization_id', 'organization_display_name', 'organization_status',
  'status', 'role', 'verification_method', 'revision',
] as const;

function 解企业关系(input: unknown): BFF企业关系 {
  const raw = 要求闭合对象(input, 企业关系必需键);
  return {
    affiliation_id: 要求字符串(raw.affiliation_id),
    organization_id: 要求字符串(raw.organization_id),
    organization_display_name: 要求字符串(raw.organization_display_name),
    organization_status: 要求枚举(raw.organization_status, ['active', 'suspended'] as const),
    status: 要求枚举(raw.status, ['pending', 'verified', 'revoked'] as const),
    role: 要求枚举(raw.role, ['member', 'admin'] as const),
    verification_method: 要求枚举(raw.verification_method, ['admin_invitation', 'corporate_email', 'manual_admin_review'] as const),
    revision: 要求整数(raw.revision),
  };
}

function 解企业关系列表(input: unknown): BFF企业关系列表 {
  const raw = 要求闭合对象(input, ['affiliations'] as const);
  return { affiliations: 要求数组(raw.affiliations).map(解企业关系) };
}

const 管理员申请必需键 = ['request_id', 'legal_name', 'display_name', 'domains', 'status', 'revision'] as const;

function 解企业管理员申请(input: unknown): BFF企业管理员申请 {
  const raw = 要求闭合对象(input, 管理员申请必需键);
  return {
    request_id: 要求字符串(raw.request_id),
    legal_name: 要求字符串(raw.legal_name),
    display_name: 要求字符串(raw.display_name),
    domains: 要求数组(raw.domains).map(要求字符串),
    status: 要求枚举(raw.status, ['pending', 'approved', 'rejected', 'cancelled'] as const),
    revision: 要求整数(raw.revision),
  };
}

function 解企业管理员申请列表(input: unknown): BFF企业管理员申请列表 {
  const raw = 要求闭合对象(input, ['requests'] as const);
  return { requests: 要求数组(raw.requests).map(解企业管理员申请) };
}

const 企业媒体必需键 = ['media_id', 'media_type', 'size_bytes', 'width', 'height', 'url'] as const;

function 解企业媒体(input: unknown): BFF企业媒体 {
  const raw = 要求闭合对象(input, 企业媒体必需键);
  return {
    media_id: 要求字符串(raw.media_id),
    media_type: 要求枚举(raw.media_type, ['image/png', 'image/jpeg'] as const),
    size_bytes: 要求整数(raw.size_bytes),
    width: 要求整数(raw.width),
    height: 要求整数(raw.height),
    url: 要求字符串(raw.url),
  };
}

function 解目录引用(input: unknown): BFF目录引用 {
  const raw = 要求闭合对象(input, ['id', 'display_name'] as const);
  return { id: 要求字符串(raw.id), display_name: 要求字符串(raw.display_name) };
}

function 解团队成员(input: unknown): BFF团队成员 {
  const raw = 要求闭合对象(input, ['name', 'title', 'summary'] as const);
  return {
    name: 要求字符串(raw.name),
    title: 要求字符串(raw.title),
    summary: 要求字符串(raw.summary),
  };
}

const 企业档案必需键 = [
  'brand_name', 'industry', 'company_size', 'funding_stage', 'office_address', 'benefit_codes',
  'work_schedule', 'company_intro', 'business_items', 'product_intro', 'team_members',
  'logo', 'office_media', 'company_media', 'revision', 'updated_at',
] as const;

function 解企业档案(input: unknown): BFF企业档案 {
  const raw = 要求闭合对象(input, 企业档案必需键);
  return {
    brand_name: 要求字符串(raw.brand_name),
    industry: raw.industry === null ? null : 解目录引用(raw.industry),
    company_size: 要求枚举(raw.company_size, 企业规模全表),
    funding_stage: 要求枚举(raw.funding_stage, 融资阶段全表),
    office_address: 要求字符串(raw.office_address),
    // 未知 closed code 是契约漂移：抛 invalid_response，不显示为空。
    benefit_codes: 要求数组(raw.benefit_codes).map((码) => 要求枚举(码, 福利码全表)),
    work_schedule: 要求枚举(raw.work_schedule, 作息全表),
    company_intro: 要求字符串(raw.company_intro),
    business_items: 要求数组(raw.business_items).map(要求字符串),
    product_intro: 要求字符串(raw.product_intro),
    team_members: 要求数组(raw.team_members).map(解团队成员),
    logo: raw.logo === null ? null : 解企业媒体(raw.logo),
    office_media: 要求数组(raw.office_media).map(解企业媒体),
    company_media: 要求数组(raw.company_media).map(解企业媒体),
    revision: 要求整数(raw.revision),
    updated_at: 要求可空字符串(raw.updated_at),
  };
}

function 解公开企业(input: unknown): BFF公开企业 {
  const raw = 要求闭合对象(input, [
    'organization_id', 'legal_name', 'display_name', 'verified_at', 'profile', 'active_verified_job_count',
  ] as const);
  return {
    organization_id: 要求字符串(raw.organization_id),
    legal_name: 要求字符串(raw.legal_name),
    display_name: 要求字符串(raw.display_name),
    verified_at: 要求字符串(raw.verified_at),
    profile: 解企业档案(raw.profile),
    active_verified_job_count: 要求整数(raw.active_verified_job_count),
  };
}

function 修订etag(revision: number): string {
  return `"${revision}"`;
}

export function 创建组织数据源(请求: 请求函数): 组织数据源 {
  return {
    async 读取招聘方档案() {
      const { result } = await 请求<unknown>({ path: '/api/v1/recruiter/profile' });
      return 解招聘方档案(result);
    },
    async 保存招聘方档案(patch, revision) {
      const { result } = await 请求<unknown>({
        path: '/api/v1/recruiter/profile',
        method: 'PATCH',
        body: patch,
        ifMatch: 修订etag(revision),
      });
      return 解招聘方档案(result);
    },
    async 读取我的企业关系() {
      const { result } = await 请求<unknown>({ path: '/api/v1/recruiter/affiliations' });
      return 解企业关系列表(result).affiliations;
    },
    async 读取企业管理员申请() {
      const { result } = await 请求<unknown>({ path: '/api/v1/recruiter/organization-admin-requests' });
      return 解企业管理员申请列表(result).requests;
    },
    async 创建企业管理员申请(metadata, evidence) {
      // 冻结 multipart 形状：一个 application/json 的 metadata Blob + 1–5 个重复 evidence part。
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      for (const 材料 of evidence) formData.append('evidence', 材料);
      const { result } = await 请求<unknown>({
        path: '/api/v1/recruiter/organization-admin-requests',
        method: 'POST',
        formData,
        幂等: true,
      });
      return 解企业管理员申请(result);
    },
    async 取消企业管理员申请(requestId, revision) {
      const { result } = await 请求<unknown>({
        path: `/api/v1/recruiter/organization-admin-requests/${requestId}/cancel`,
        method: 'POST',
        ifMatch: 修订etag(revision),
      });
      return 解企业管理员申请(result);
    },
    async 接受企业邀请(token) {
      const { result } = await 请求<unknown>({
        path: '/api/v1/recruiter/organization-invitations/accept',
        method: 'POST',
        body: { token },
      });
      return 解企业关系(result);
    },
    async 替换招聘方头像(file, revision) {
      // 冻结 multipart 形状：单个 media part；不发送 file part、不手写 Content-Type。
      const formData = new FormData();
      formData.append('media', file);
      const { result } = await 请求<unknown>({
        path: '/api/v1/recruiter/avatar',
        method: 'POST',
        formData,
        ifMatch: 修订etag(revision),
        幂等: true,
      });
      return 解招聘方档案(result);
    },
    async 读取企业档案(organizationId) {
      const { result } = await 请求<unknown>({ path: `/api/v1/organizations/${organizationId}/profile` });
      return 解企业档案(result);
    },
    async 替换企业档案(organizationId, body, revision) {
      // 完整 replacement 的语义由 body 决定；BFF 实际 method 是 PATCH，不是 PUT。
      const { result } = await 请求<unknown>({
        path: `/api/v1/organizations/${organizationId}/profile`,
        method: 'PATCH',
        body,
        ifMatch: 修订etag(revision),
      });
      return 解企业档案(result);
    },
    async 上传企业媒体(organizationId, purpose, file) {
      // 冻结 multipart 形状：metadata(application/json) + media，恰好两个 part。
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify({ purpose })], { type: 'application/json' }));
      formData.append('media', file);
      const { result } = await 请求<unknown>({
        path: `/api/v1/organizations/${organizationId}/media`,
        method: 'POST',
        formData,
        幂等: true,
      });
      return 解企业媒体(result);
    },
    async 删除企业媒体(organizationId, mediaId) {
      await 请求<void>({
        path: `/api/v1/organizations/${organizationId}/media/${mediaId}`,
        method: 'DELETE',
      });
    },
    async 读取公开企业(organizationId) {
      const { result } = await 请求<unknown>({ path: `/api/v1/organizations/${organizationId}` });
      return 解公开企业(result);
    },
  };
}
