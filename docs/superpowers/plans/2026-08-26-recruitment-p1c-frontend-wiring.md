# Recruitment P1C 前端接线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal：** 把 P1A/P1B 已完成的 Recruitment BFF 浏览器契约接入现有招聘方身份、公司档案、媒体、岗位投影和候选端公共公司页，同时保持 Mock 剧情与现有视觉结构。

**Architecture：** 沿用 P0 的单一 `HTTP招聘数据源` facade、单一应用 Context、`状态/后端` 操作工厂和 `状态/领域/组织岗位.ts` owner。新增一个 Organization 数据源与映射文件，扩展既有 reducer/Provider；页面不直接请求 BFF，不新增状态库、Query 框架、schema generator、通用媒体层或第二个 Context。

**Tech Stack：** React 19、TypeScript、Vite、Vitest、Testing Library、Playwright、原生 `fetch`/`FormData`、CSS Modules。

**Spec：** `docs/superpowers/specs/2026-08-26-recruitment-p1c-frontend-wiring-design.md`

**完成标准：** Task 1–6 均按 TDD 完成并提交，code review 发现已处理，完整前端验证通过，且没有修改或运行后端
仓库。intercepted Backend 测试只证明前端边界，不宣称真实 BFF 联调。

---

## Global Constraints

- 实施前使用 `superpowers:using-git-worktrees` 准备独立的前端 worktree；只在当前前端仓库中创建和提交变更。
- 前端校准基线为 `origin/main@c836f301f07d6e6693e125ea66b8855cd975ec31`。开始前先安装依赖并验证基线：

```bash
git status --short
npm ci
npm test
npm run typecheck
npm run lint
```

- `~/agxp-monorepo` 只作为 P1A/P1B 历史契约的只读参考。本计划不切换它的分支，不创建它的 worktree，不编辑其文件，
  不启动其服务，也不运行后端测试或本地运行栈。
- 前端以已经核验的 P1B runtime shape 为冻结输入：

```text
metadata: Blob(application/json), {"purpose":"organization_logo|office_photo|company_photo"}
media: PNG/JPEG File
recruiter avatar: 单个名为 media 的 PNG/JPEG File
OrganizationProfileReplacement 未设置行业: industry_id: ""
RecruiterProfile 未验证/未上传头像: verified_name/avatar_url 可缺键，decoder 归一为 null
media DELETE: 204 No Content
```

- browser 不能提交 subject、affiliation ref、Organization ID 或 verification status 来获取可信 Job verdict；`JobCreate` 只提交 `publisher_mode + hiring_organization_claim`，服务端唯一推导 refs。
- Backend 已接域失败不回退 Mock/静态公司档案。
- private evidence、raw invitation token、registry key、subject、object key/generation 不进入页面公共状态或浏览器持久化。
- 409 保留页面草稿并重读权威快照；503 outcome unknown 只在重读确认后显示成功。
- Mock 招聘头像继续复用 `src/组件/头像处理.ts` 的 `压成头像`；Backend 分支不得压成 data URL，也不得把该 helper
  重新内联回页面。
- 职位详情、在谈详情、真人会话和企业端岗位详情继续共用 `src/组件/公司区块.tsx`。Backend 必须传显式投影，
  不能触发静态 `取公司档案()`；只有 canonical Organization ref 存在时才给该区块导航能力。
- `src/组件/匹配对齐卡.tsx` 已在当前基线被职位详情、在谈详情和真人会话共用；本 Plan 只改这些页面的公司/发布方
  数据接线，不移动、复制、删除或重写匹配对齐卡。
- 每个 Task 使用 `superpowers:test-driven-development`：先运行新增失败测试，再写最小实现，最后运行定向测试并提交。
- Task 1–6 完成后使用 `superpowers:requesting-code-review`；处理发现并重跑完整前端验证，然后使用
  `superpowers:finishing-a-development-branch` 收口实现分支。

---

## Task 1：冻结 wire DTO、传输原语、Organization 数据源与映射

**文件：**

- 修改：`src/数据/HTTP客户端.ts`
- 修改：`src/数据/HTTP客户端.test.ts`
- 修改：`src/数据/BFF契约.ts`
- 新建：`src/数据/招聘数据源/组织.ts`
- 新建：`src/数据/招聘数据源/组织.test.ts`
- 新建：`src/数据/组织映射.ts`
- 新建：`src/数据/组织映射.test.ts`
- 修改：`src/数据/HTTP招聘数据源.ts`
- 修改：`src/数据/HTTP招聘数据源.test.ts`
- 修改：`src/测试/BFF样本.ts`

**Interfaces:**

- Consumes: `创建BFF客户端(options).请求<T>(request: BFF请求选项): Promise<BFF响应<T>>`，其中
  `BFF响应<T> = { result: T; etag: string | null; requestId: string | null }`；
  既有 `BFFOwnerJob`、`BFF目录引用`、`资料形` 与 `页面岗位快照`；浏览器请求和 decoder 消费 Global Constraints
  中冻结的 runtime shape。
- Produces: Step 3 的全部 Organization DTO/write types；Step 5 的 `组织数据源` 精确方法表；Step 6 的
  `可用企业关系/选择当前企业关系/从BFF企业档案/转BFF企业档案替换/从BFF招聘身份/从BFF公开企业/
  从BFF岗位发布方`；以及包含这些方法的 `HTTP招聘数据源`。Task 2–6 只能消费这些签名，不得重定义 wire shape。

- [ ] **Step 1：先锁定 multipart 与 204 的失败测试**

在 `HTTP客户端.test.ts` 增加三例：

```ts
it('FormData 原样发送且不手写 Content-Type', async () => {
  const fetcher = vi.fn(async () => new Response(
    JSON.stringify({ result: { ok: true }, meta: { request_id: 'r1', api_version: 'v1' } }),
    { status: 201, headers: { 'Content-Type': 'application/json' } },
  ));
  const formData = new FormData();
  formData.append('media', new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' }));
  await 创建BFF客户端({ fetcher, 生成幂等键: () => 'idem-fixed-0001' })
    .请求({ path: '/api/v1/recruiter/avatar', method: 'POST', formData, 幂等: true });
  const init = fetcher.mock.calls[0][1]!;
  expect(init.body).toBe(formData);
  expect(new Headers(init.headers).has('Content-Type')).toBe(false);
});

it('204 成功返回 undefined 而不解析 JSON', async () => {
  const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
  await expect(创建BFF客户端({ fetcher }).请求<void>({
    path: '/api/v1/organizations/org_1/media/media_1', method: 'DELETE',
  })).resolves.toMatchObject({ result: undefined });
});

it('运行时拒绝绕过类型系统同时提供 JSON body 与 FormData', async () => {
  await expect(创建BFF客户端().请求({
    path: '/api/v1/recruiter/avatar', method: 'POST', body: {}, formData: new FormData(),
  } as unknown as BFF请求选项)).rejects.toThrow('body 与 formData 不能同时提供');
});
```

运行并确认至少前两例失败：

```bash
npx vitest run src/数据/HTTP客户端.test.ts
```

预期 RED：FormData 被 JSON 分支处理或错误写入 `Content-Type`，204 尝试解析空 JSON；互斥参数的 runtime
保护尚不存在。失败必须来自这三个行为断言，不得来自 TypeScript/import 错误。

- [ ] **Step 2：最小扩展 HTTP client**

把请求选项扩成互斥 body 形状；保留所有现有 JSON caller：

```ts
interface BFF请求共同选项 {
  path: `/api/v1/${string}`;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  ifMatch?: string;
  幂等?: boolean;
}

export type BFF请求选项 = BFF请求共同选项 & (
  | { body?: unknown; formData?: never }
  | { formData: FormData; body?: never }
);
```

在 `请求()` 入口显式拒绝 `body !== undefined && formData !== undefined`。JSON body 才设置 `Content-Type: application/json` 并 `JSON.stringify`；FormData 原样放入 `init.body`，让浏览器生成 boundary。`单次()` 对 `resp.status === 204` 返回 `{ result: undefined as T }`，request ID 从 header 读取，其他成功响应仍要求 JSON envelope。

重新运行：

```bash
npx vitest run src/数据/HTTP客户端.test.ts
```

预期：全部 PASS，既有幂等重试继续复用同一 key 与同一 FormData 对象。

- [ ] **Step 3：声明闭合 browser DTO**

在 `BFF契约.ts` 增加以下类型，字段名严格对齐 P1B BFF OpenAPI：

```ts
export type BFF验证状态 = 'unverified' | 'verified';

export interface BFF招聘方档案 {
  public_name: string;
  title: string;
  personal_verification_status: BFF验证状态;
  verified_name?: string | null;
  avatar_url?: string | null;
  revision: number;
}

export interface BFF企业关系 {
  affiliation_id: string;
  organization_id: string;
  organization_display_name: string;
  organization_status: 'active' | 'suspended';
  status: 'pending' | 'verified' | 'revoked';
  role: 'member' | 'admin';
  verification_method: 'admin_invitation' | 'corporate_email' | 'manual_admin_review';
  revision: number;
}

export interface BFF企业关系列表 { affiliations: BFF企业关系[] }

export interface BFF企业管理员申请 {
  request_id: string;
  legal_name: string;
  display_name: string;
  domains: string[];
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  revision: number;
}

export interface BFF企业管理员申请列表 { requests: BFF企业管理员申请[] }

export interface BFF企业媒体 {
  media_id: string;
  media_type: 'image/png' | 'image/jpeg';
  size_bytes: number;
  width: number;
  height: number;
  url: string;
}

export interface BFF团队成员 { name: string; title: string; summary: string }

export type BFF企业规模 = '' | 'under_20' | '20_99' | '100_499' | '500_1000' | '1000_9999' | '10000_plus';
export type BFF融资阶段 = '' | 'unfunded' | 'angel' | 'series_a' | 'series_b' | 'series_c' | 'series_d_plus' | 'public' | 'self_funded';
export type BFF作息 = '' | 'two_day_weekend' | 'alternate_saturday' | 'flexible';
export type BFF福利码 =
  | 'social_insurance_housing_fund' | 'supplementary_medical' | 'stock_options' | 'flexible_work'
  | 'annual_physical_exam' | 'regular_physical_exam' | 'paid_annual_leave' | 'meal_allowance'
  | 'transport_allowance' | 'housing_allowance' | 'holiday_benefits' | 'team_building_meals'
  | 'snacks_afternoon_tea' | 'overtime_allowance' | 'year_end_bonus' | 'shuttle_bus' | 'regular_training';

export interface BFF企业档案 {
  brand_name: string;
  industry: BFF目录引用 | null;
  company_size: BFF企业规模;
  funding_stage: BFF融资阶段;
  office_address: string;
  benefit_codes: BFF福利码[];
  work_schedule: BFF作息;
  company_intro: string;
  business_items: string[];
  product_intro: string;
  team_members: BFF团队成员[];
  logo: BFF企业媒体 | null;
  office_media: BFF企业媒体[];
  company_media: BFF企业媒体[];
  revision: number;
  updated_at: string | null;
}

export interface BFF公开企业 {
  organization_id: string;
  legal_name: string;
  display_name: string;
  verified_at: string;
  profile: BFF企业档案;
  active_verified_job_count: number;
}

export interface BFF招聘方档案补丁 {
  public_name?: string;
  title?: string;
}

export interface BFF企业管理员申请元数据 {
  legal_name: string;
  display_name: string;
  registry_key: string;
  explanation: string;
  domains: string[];
}

export type BFF企业媒体用途 = 'organization_logo' | 'office_photo' | 'company_photo';

export interface BFF企业档案替换 {
  brand_name: string;
  industry_id: string;
  company_size: BFF企业规模;
  funding_stage: BFF融资阶段;
  office_address: string;
  benefit_codes: BFF福利码[];
  work_schedule: BFF作息;
  company_intro: string;
  business_items: string[];
  office_media_ids: string[];
  company_media_ids: string[];
  product_intro: string;
  team_members: BFF团队成员[];
  logo_media_id: string;
}
```

同步在 `src/测试/BFF样本.ts` 新增并导出 `BFF招聘方档案样本/BFF企业关系样本/BFF企业管理员申请样本/
BFF企业媒体样本/BFF企业档案样本/BFF公开企业样本`。样本必须满足上述 closed DTO，列表 route fixture 只能包成
`{affiliations:[BFF企业关系样本]}` / `{requests:[BFF企业管理员申请样本]}`，不得在各测试复制漂移对象。

`BFF企业档案替换.logo_media_id` 用空字符串表示无 LOGO：这是 P1B runtime 的完整 replacement 约定，
`ValidateOrganizationProfileReplacement` 只在非空时校验 media ID，不能改成未经 schema 支持的 `null`。
`industry_id` 的唯一写入规则是：`行业引用` 存在时发送其 ID；显示名与引用都空时发送空字符串（未设置）；显示名
非空但引用缺失时拒绝保存。不能从行业显示名反查。

扩展 owner 岗位 DTO；P1C 不增加 candidate Job 读取，真实发现入口留给已批准的 P4：

```ts
// BFFOwnerJob 新增
publisher_organization_ref?: string;
hiring_organization_verification_status: BFF验证状态;
hiring_organization_ref?: string;

```

不要给 `BFF岗位创建` 增加 ref/status 字段。

- [ ] **Step 4：先写 Organization route 与 strict decode 测试**

先按下表冻结每个 browser call；完整 replacement 的语义由 body 决定，冻结 method 是 BFF 实际的 `PATCH`，不是
`PUT`：

| 数据源方法 | Method + path | If-Match | Idempotency-Key | Body/result |
|---|---|---:|---:|---|
| 读取招聘方档案 | `GET /api/v1/recruiter/profile` | 否 | 否 | profile |
| 保存招聘方档案 | `PATCH /api/v1/recruiter/profile` | 是 | 否 | sparse JSON patch |
| 读取我的企业关系 | `GET /api/v1/recruiter/affiliations` | 否 | 否 | `{affiliations:[...]}`，数据源解包后返回数组 |
| 读取企业管理员申请 | `GET /api/v1/recruiter/organization-admin-requests` | 否 | 否 | `{requests:[...]}`，数据源解包后返回数组 |
| 创建企业管理员申请 | `POST /api/v1/recruiter/organization-admin-requests` | 否 | 是 | `metadata + evidence[]` multipart |
| 取消企业管理员申请 | `POST /api/v1/recruiter/organization-admin-requests/{request_id}/cancel` | 是 | 否 | 空 body，申请结果 |
| 接受企业邀请 | `POST /api/v1/recruiter/organization-invitations/accept` | 否 | 否 | `{token}` |
| 替换招聘方头像 | `POST /api/v1/recruiter/avatar` | 是 | 是 | 单个 `media` multipart |
| 读取企业档案 | `GET /api/v1/organizations/{organization_id}/profile` | 否 | 否 | profile |
| 替换企业档案 | `PATCH /api/v1/organizations/{organization_id}/profile` | 是 | 否 | full JSON replacement |
| 上传企业媒体 | `POST /api/v1/organizations/{organization_id}/media` | 否 | 是 | `metadata + media` multipart |
| 删除企业媒体 | `DELETE /api/v1/organizations/{organization_id}/media/{media_id}` | 否 | 否 | `204` |
| 读取公开企业 | `GET /api/v1/organizations/{organization_id}` | 否 | 否 | public organization |

在 `招聘数据源/组织.test.ts` 用一个记录 `BFF请求选项` 的 mock 覆盖：

- `GET /api/v1/recruiter/profile`；
- `PATCH /api/v1/recruiter/profile` 带 `If-Match: "revision"`；
- `GET /api/v1/recruiter/affiliations`；
- admin request list/create/cancel；创建 FormData 恰好一个 `metadata` Blob 和 1–5 个重复 `evidence`；
- `POST /api/v1/recruiter/organization-invitations/accept` body 只有 `{token}`；
- avatar FormData 只有 `media`，同时带 If-Match 与幂等；
- Organization profile get/replace；
- media FormData 恰好 `metadata + media`，metadata Blob type 为 `application/json`；
- media DELETE 接受 `void` 结果；
- public Organization read；
- DTO 多一个 `subject_id`、`registry_key`、`object_key` 或未知字段时抛 `BFF错误(code='invalid_response')`。

list fixture 必须使用真实 wrapper，并锁定招聘档案缺键归一：

```ts
请求Mock.mockResolvedValueOnce({ result: { affiliations: [企业关系样本] } });
await expect(数据源.读取我的企业关系()).resolves.toEqual([企业关系样本]);
请求Mock.mockResolvedValueOnce({ result: { requests: [申请样本] } });
await expect(数据源.读取企业管理员申请()).resolves.toEqual([申请样本]);
请求Mock.mockResolvedValueOnce({ result: {
  public_name: '林澈', title: '', personal_verification_status: 'unverified', revision: 1,
} });
await expect(数据源.读取招聘方档案()).resolves.toMatchObject({
  verified_name: null, avatar_url: null,
});
```

关键 multipart 断言：

```ts
const options = 请求Mock.mock.calls.at(-1)![0] as BFF请求选项;
expect([...options.formData!.keys()]).toEqual(['metadata', 'media']);
const metadata = options.formData!.get('metadata') as Blob;
expect(metadata.type).toBe('application/json');
await expect(metadata.text()).resolves.toBe('{"purpose":"office_photo"}');
expect(options.formData!.get('media')).toBe(file);
```

运行并确认失败：

```bash
npx vitest run src/数据/招聘数据源/组织.test.ts
```

预期 RED：`组织.ts`/decoder 尚不存在，或新增方法尚未生成正确 path、wrapper 解包与 multipart；不得通过放宽
unknown response 或改 fixture 绕过。

- [ ] **Step 5：实现 Organization 数据源，不抽通用 schema 框架**

`组织.ts` 导出：

```ts
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
```

每个 route 以 `请求<unknown>()` 读取，再由本文件内的具体 decoder 校验 exact key set、闭合 enum、数组元素和标量类型。decoder 发现缺字段、多字段或错误 enum 时统一抛：

```ts
throw new BFF错误(200, 'invalid_response', '服务返回了不符合契约的组织数据');
```

`读取我的企业关系()` 先 strict decode `BFF企业关系列表` 再返回 `.affiliations`；`读取企业管理员申请()` 同理返回
`.requests`。招聘方 profile decoder 只对 `verified_name/avatar_url` 允许缺键或 null，并把缺键归一为 null；其它字段
仍按 exact key set fail closed。

实际 decoder 不可 `as BFF招聘方档案` 直转；按下面的 closed-key 形状实现并让每个字段通过同文件小 guard：

```ts
const 招聘方档案必需键 = [
  'public_name', 'title', 'personal_verification_status', 'revision',
] as const;
const 招聘方档案可选键 = ['verified_name', 'avatar_url'] as const;

function 解招聘方档案(input: unknown): BFF招聘方档案 {
  const raw = 要求闭合对象(input, 招聘方档案必需键, 招聘方档案可选键);
  return {
    public_name: 要求字符串(raw.public_name),
    title: 要求字符串(raw.title),
    personal_verification_status: 要求枚举(raw.personal_verification_status, ['unverified', 'verified']),
    verified_name: 要求可空可缺字符串(raw.verified_name),
    avatar_url: 要求可空可缺字符串(raw.avatar_url),
    revision: 要求整数(raw.revision),
  };
}
```

只写本域需要的几个小断言函数（object/exact keys/string/number/array），不要引入第三方 validator 或跨项目生成器。

完成本 Step 后重跑 `npx vitest run src/数据/招聘数据源/组织.test.ts`。预期 GREEN：route、wrapper、缺键归一、
exact-key 拒绝和 multipart 断言全部 PASS。

- [ ] **Step 6：实现 wire-to-page 映射**

`组织映射.ts` 提供纯函数：

```ts
export function 可用企业关系(affiliation: BFF企业关系): boolean;
export function 选择当前企业关系(
  affiliations: BFF企业关系[], restoredId: string | null,
): string | null;
export function 从BFF企业档案(profile: BFF企业档案): 资料形;
export function 转BFF企业档案替换(draft: 资料形, server: BFF企业档案): BFF企业档案替换;
export function 从BFF招聘身份(
  profile: BFF招聘方档案 | null,
  affiliations: BFF企业关系[],
  currentAffiliationId: string | null,
  requests: BFF企业管理员申请[],
): 招聘身份视图;
export function 从BFF公开企业(dto: BFF公开企业): 公开企业视图;
export function 从BFF岗位发布方(dto: BFFOwnerJob): 岗位发布方视图;
```

同文件冻结三个页面 view；React 只能消费这些字段，不得另起别名解释 DTO：

```ts
export interface 招聘企业关系视图 {
  id: string; organizationId: string; organizationName: string;
  status: BFF企业关系['status']; statusLabel: string;
  role: BFF企业关系['role']; roleLabel: '成员' | '管理员'; selectable: boolean;
}

export interface 招聘身份视图 {
  publicName: string;
  title: string;
  personalVerification: { code: BFF验证状态; label: '未认证' | '已认证' };
  verifiedName: string | null; // DTO 缺键与 null 均归一到 null
  avatarUrl: string | null;
  affiliations: readonly 招聘企业关系视图[];
  currentAffiliation: 招聘企业关系视图 | null;
  latestAdminRequest: {
    id: string; status: BFF企业管理员申请['status']; statusLabel: string; revision: number;
  } | null;
}

export interface 公开企业视图 {
  organizationId: string; legalName: string; displayName: string; verifiedAt: string;
  brandName: string; industryName: string | null; companySizeLabel: string; fundingStageLabel: string;
  officeAddress: string; benefitLabels: readonly string[]; workScheduleLabel: string;
  companyIntro: string; businessItems: readonly string[]; productIntro: string;
  teamMembers: readonly BFF团队成员[]; logoUrl: string | null;
  officeMediaUrls: readonly string[]; companyMediaUrls: readonly string[];
  activeVerifiedJobCount: number; revision: number;
}

export interface 岗位发布方视图 {
  发布方模式: BFFOwnerJob['publisher_mode'];
  发布方验证: BFF验证状态; 发布方企业编号: string | null;
  用人企业验证: BFF验证状态; 用人企业编号: string | null;
  用人企业声明: BFFOwnerJob['hiring_organization_claim'];
}
```

`选择当前企业关系` 的固定规则：恢复值有效则保留；无恢复值且恰好一个 active+verified 则选择；0 或多个返回
null。`转BFF企业档案替换` 按上文三分支写 `industry_id`：引用 ID / 两空发空字符串 / 只有显示名则抛
“请从候选行业中选择”。媒体 ID 从最新 server snapshot 及显式上传结果取，不从 URL 解析。

`公开企业视图` 是 P1C 独立小类型，只含上述线上字段；不要复用要求企业文化、发展历程、在职感受、代理风格和
代理核对的 Mock `公司档案` 大类型。权威 DTO 可以保存在 server snapshot，但 JSX 只消费上述三个映射后的 view
model，不能直接解释 wire enum/optional field。

在本文件内定义并双向测试完整 closed code↔中文表：

```ts
export const 公司规模文案 = {
  '': '', under_20: '20 人以下', '20_99': '20-99 人', '100_499': '100-499 人',
  '500_1000': '500-1000 人', '1000_9999': '1000-9999 人', '10000_plus': '10000 人以上',
} as const;
export const 融资阶段文案 = {
  '': '', unfunded: '未融资', angel: '天使轮', series_a: 'A 轮', series_b: 'B 轮',
  series_c: 'C 轮', series_d_plus: 'D 轮及以上', public: '已上市', self_funded: '不需要融资',
} as const;
export const 作息文案 = {
  '': '', two_day_weekend: '双休', alternate_saturday: '大小周', flexible: '弹性',
} as const;
```

`benefit_codes` 逐项覆盖现有 `福利标签池` 的 17 个 code：
`social_insurance_housing_fund/supplementary_medical/stock_options/flexible_work/annual_physical_exam/regular_physical_exam/paid_annual_leave/meal_allowance/transport_allowance/housing_allowance/holiday_benefits/team_building_meals/snacks_afternoon_tea/overtime_allowance/year_end_bonus/shuttle_bus/regular_training`。
中文按 `福利标签池` 同序一一映射。未知 closed code 作为契约漂移抛 `invalid_response`，不显示为空、不把中文原样回写。

在 `组织映射.test.ts` 覆盖单个自动选、多个不猜、revoked/suspended 清空、四组 closed vocabulary 双向
round trip、industry 两空发送空字符串、只有显示名时拒绝、公开视图只含线上字段、Job publisher/hiring 视图不折叠。

- [ ] **Step 7：组合第六个 facade 并回归**

在 `HTTP招聘数据源.ts`：

```ts
export type HTTP招聘数据源 = 会话数据源 & 目录数据源 & 简历数据源 &
  意向数据源 & 岗位数据源 & 组织数据源;
```

`创建HTTP招聘数据源()` 展开 `创建组织数据源(请求)`。更新 root facade shape 测试，断言旧方法全部保留且新方法存在。

运行：

```bash
npx vitest run src/数据/HTTP客户端.test.ts src/数据/招聘数据源/组织.test.ts src/数据/组织映射.test.ts src/数据/HTTP招聘数据源.test.ts
npm run typecheck
```

预期 GREEN：四个测试文件与 typecheck 全部退出码 0；若映射表缺 code、facade 少旧方法或 DTO 与页面类型不闭合，
应在本 Task 修复后再提交。

提交：

```bash
git add src/数据 src/测试/BFF样本.ts
git commit -m "feat(recruitment): add organization BFF data source"
```

---

## Task 2：Organization 状态、固定水合、current Affiliation 与账号清理

**文件：**

- 修改：`src/状态/领域/组织岗位.ts`
- 修改：`src/状态/初始状态.ts`
- 修改：`src/状态/后端/类型.ts`
- 新建：`src/状态/后端/组织操作.ts`
- 新建：`src/状态/后端/组织操作.test.ts`
- 修改：`src/状态/后端/会话操作.ts`
- 新建：`src/状态/后端/会话操作.test.ts`
- 修改：`src/状态/应用状态.tsx`
- 修改：`src/状态/应用状态.test.ts`
- 修改：`src/状态/资料持久化.ts`
- 修改：`src/数据/资料缓存.ts`
- 修改：`src/数据/资料缓存.test.ts`

**Interfaces:**

- Consumes: Task 1 的 `HTTP招聘数据源`、`BFF招聘方档案`、`BFF企业关系`、`BFF企业管理员申请`、
  `BFF公开企业`、`BFF企业档案`、四个 write types，以及
  `选择当前企业关系(affiliations: BFF企业关系[], restoredId: string|null): string|null`。
- Produces: Step 1 的八个 `组织岗位状态` 字段；Step 2 的八个 reducer action；
  `水合招聘方组织数据(deps, subjectId, generation, interactive): Promise<{sessionExpired:boolean}>`、
  `创建组织操作(deps: 后端操作依赖): 组织操作` 和 Step 4 的 `组织操作` 方法表；Backend sessionStorage 只持久化
  `当前企业关系编号/未认证公司声明`。Task 3–5 读取该状态并调用该操作，页面不得直接调用数据源。

- [ ] **Step 1：先写 reducer 与选择规则测试**

把 Organization 权威状态加入 `组织岗位状态`：

```ts
招聘方档案: BFF招聘方档案 | null;
企业关系列表: BFF企业关系[];
当前企业关系编号: string | null;
企业管理员申请列表: BFF企业管理员申请[];
当前企业身份: Omit<BFF公开企业, 'profile'> | null;
企业档案快照: BFF企业档案 | null;
公开企业表: Record<string, BFF公开企业>;
未认证公司声明: string;
```

先在 `应用状态.test.ts` 增加失败测试：

- Backend 初始值全部为空，不播种云衢；Mock 仍保留现有 fixture；
- 水合 profile/affiliations/current organization；admin request 列表只测试显式按需 action，不进入登录链；
- revoked/suspended 后 reducer 清 current selection 与 current organization；
- 清账号动作清 profile、affiliation、requests、公开企业缓存、未认证 claim；
- current selection 不进入 localStorage，raw invitation token 从不进入任何 reducer action。

实际 RED 用例写在现有 `describe('应用状态 reducer')` 内：

```ts
it('清后端组织状态只清 Backend 权威事实', () => {
  const 水合后 = 归约(归约(初始状态, {
    型: '水合企业关系', 关系: [BFF企业关系样本], 当前编号: BFF企业关系样本.affiliation_id,
  }), { 型: '水合招聘方档案', 档案: BFF招聘方档案样本 });
  const 清后 = 归约(水合后, { 型: '清后端组织状态' });
  expect(清后.招聘方档案).toBeNull();
  expect(清后.企业关系列表).toEqual([]);
  expect(清后.当前企业关系编号).toBeNull();
  expect(清后.公开企业表).toEqual({});
  expect(清后.企业认证).toEqual(初始状态.企业认证);
});

it('revoke 当前关系时清选择而不猜另一个关系', () => {
  const 水合后 = 归约(初始状态, {
    型: '水合企业关系',
    关系: [BFF企业关系样本, { ...BFF企业关系样本, affiliation_id: 'aff_2' }],
    当前编号: BFF企业关系样本.affiliation_id,
  });
  const revoke后 = 归约(水合后, {
    型: '水合企业关系',
    关系: [{ ...BFF企业关系样本, status: 'revoked' }, { ...BFF企业关系样本, affiliation_id: 'aff_2' }],
    当前编号: null,
  });
  expect(revoke后.当前企业关系编号).toBeNull();
  expect(revoke后.当前企业身份).toBeNull();
});

it('选择不同关系时立即清掉旧企业身份与完整档案', () => {
  const A = { ...初始状态, 当前企业关系编号: 'aff_a', 当前企业身份: 企业A身份, 企业档案快照: 企业A档案 };
  const 切B = 归约(A, { 型: '选择当前企业关系', 编号: 'aff_b' });
  expect(切B.当前企业关系编号).toBe('aff_b');
  expect(切B.当前企业身份).toBeNull();
  expect(切B.企业档案快照).toBeNull();
});
```

运行：

```bash
npx vitest run src/状态/应用状态.test.ts
```

预期 RED：新字段/action 尚不存在，或 revoke 后仍保留/猜测 current；失败必须落在新增 reducer 断言。

- [ ] **Step 2：实现最小 state/actions**

在 `组织岗位动作` 增加显式 action，不建字符串 registry：

```ts
| { 型: '水合招聘方档案'; 档案: BFF招聘方档案 | null }
| { 型: '水合企业关系'; 关系: BFF企业关系[]; 当前编号: string | null }
| { 型: '选择当前企业关系'; 编号: string | null }
| { 型: '水合企业管理员申请'; 申请: BFF企业管理员申请[] }
| { 型: '水合当前企业'; 身份: Omit<BFF公开企业, 'profile'> | null; 档案: BFF企业档案 | null }
| { 型: '缓存公开企业'; 企业: BFF公开企业 }
| { 型: '存未认证公司声明'; 公司: string }
| { 型: '清后端组织状态' };
```

把这些 case 显式列入根 reducer。Backend seed 不保留 `企业认证/招聘头像/公司LOGO/公司自述` 作为权威事实；这些旧字段仅维持 Mock consumer，Backend 页面读取新字段。

最小 reducer 实现固定为不可变替换：

```ts
case '水合招聘方档案':
  return { ...旧, 招聘方档案: 动作.档案 };
case '水合企业关系': {
  const currentChanged = 动作.当前编号 !== 旧.当前企业关系编号;
  return {
    ...旧, 企业关系列表: 动作.关系, 当前企业关系编号: 动作.当前编号,
    当前企业身份: 动作.当前编号 && !currentChanged ? 旧.当前企业身份 : null,
    企业档案快照: 动作.当前编号 && !currentChanged ? 旧.企业档案快照 : null,
  };
}
case '选择当前企业关系':
  return 动作.编号 === 旧.当前企业关系编号
    ? 旧
    : { ...旧, 当前企业关系编号: 动作.编号, 当前企业身份: null, 企业档案快照: null };
case '水合当前企业':
  return { ...旧, 当前企业身份: 动作.身份, 企业档案快照: 动作.档案 };
case '缓存公开企业':
  return { ...旧, 公开企业表: { ...旧.公开企业表, [动作.企业.organization_id]: 动作.企业 } };
case '清后端组织状态':
  return {
    ...旧, 招聘方档案: null, 企业关系列表: [], 当前企业关系编号: null,
    企业管理员申请列表: [], 当前企业身份: null, 企业档案快照: null,
    公开企业表: {}, 未认证公司声明: '',
  };
```

完成本 Step 后重跑 `npx vitest run src/状态/应用状态.test.ts`。预期 GREEN：新增 reducer 用例与既有 Mock
reducer 用例同时 PASS。

- [ ] **Step 3：先写固定水合与 stale-response 测试**

在 `组织操作.test.ts`/`应用状态.test.ts` 构造受控 promise，证明：

```text
读取招聘方档案
→ 读取我的企业关系
→ 校验/选择 current relation
→ 有 current 时读取一次公开企业（其 `profile` 同时成为当前企业档案快照）
→ 读取 owner Jobs
```

覆盖：

- 恢复 ID 必须仍 active+verified；
- 恰好一个有效关系自动选；多个不按响应顺序猜；
- current 被 revoke/suspend 时清空且不自动切到另一个；
- old subject/old role/old generation 的迟到响应不派发；
- 任一 401 走统一 `清账号状态`；
- profile/affiliation 请求失败不继续拿旧 Organization 发岗；
- mount 初始化非 401 错误轻提示但最终初始化完成；交互切角色错误抛回 UI。

在 `组织操作.test.ts` 写出受控顺序和 stale RED：

```ts
it('按 profile → affiliations → public organization 水合并守住旧代际', async () => {
  const 顺序: string[] = [];
  const 档案门 = deferred<BFF招聘方档案>();
  const 后端 = {
    读取招聘方档案: vi.fn(() => { 顺序.push('profile'); return 档案门.promise; }),
    读取我的企业关系: vi.fn(async () => { 顺序.push('affiliations'); return [BFF企业关系样本]; }),
    读取公开企业: vi.fn(async () => { 顺序.push('organization'); return BFF公开企业样本; }),
  } as unknown as HTTP招聘数据源;
  const 派发 = vi.fn();
  const deps = 创建组织测试依赖({ 后端, 派发, subject: 'sub_1', generation: 7 });
  const 运行 = 水合招聘方组织数据(deps, 'sub_1', 7, false);
  档案门.resolve(BFF招聘方档案样本);
  await expect(运行).resolves.toEqual({ sessionExpired: false });
  expect(顺序).toEqual(['profile', 'affiliations', 'organization']);
  expect(派发.mock.calls.map(([动作]) => 动作.型)).toEqual([
    '水合招聘方档案', '水合企业关系', '水合当前企业',
  ]);
});

it('recruiter 角色只在组织水合之后读取 owner Jobs', async () => {
  const 顺序: string[] = [];
  const 后端 = 创建完整测试数据源({
    读取招聘方档案: async () => { 顺序.push('profile'); return BFF招聘方档案样本; },
    读取我的企业关系: async () => { 顺序.push('affiliations'); return [BFF企业关系样本]; },
    读取公开企业: async () => { 顺序.push('organization'); return BFF公开企业样本; },
    读取岗位: async () => { 顺序.push('jobs'); return 页面岗位快照样本; },
  });
  const deps = 创建组织测试依赖({ 后端, 派发: vi.fn(), subject: 'sub_1', generation: 7 });
  await expect(水合角色数据(deps, recruiter主体样本, false)).resolves.toBe(false);
  expect(顺序).toEqual(['profile', 'affiliations', 'organization', 'jobs']);
});
```

`创建组织测试依赖` 是本测试文件内的实际 helper，返回完整可变引用，不进入产品代码：

```ts
function 创建组织测试依赖(input: {
  后端: HTTP招聘数据源; 派发: ReturnType<typeof vi.fn>; subject: string; generation: number;
}) {
  return {
    后端: input.后端, 派发: input.派发, 设后端状态: vi.fn(),
    主体标识引用: { current: input.subject }, 会话代际: { current: input.generation },
    状态引用: { current: 初始状态 },
    后端状态引用: { current: {
      初始化: '完成', 已登录: true, 主体: null, 简历快照: null, 意向快照: {}, 岗位快照: {},
    } },
    锁: { current: new Set<string>() }, 尝试引用: { current: null }, 是后端: true,
  } satisfies 后端操作依赖;
}
```

预期 RED：水合函数尚不存在，或调用顺序、代际守卫、401 清理中的至少一项与断言不符；不能用同步 mock 掩盖
stale-response。

- [ ] **Step 4：实现组织操作与 recruiter hydration**

`后端/组织操作.ts` 导出：

```ts
export async function 水合招聘方组织数据(
  deps: Pick<后端操作依赖,
    '后端' | '派发' | '设后端状态' | '主体标识引用' | '会话代际' | '状态引用'> &
    { 后端: HTTP招聘数据源 },
  subjectId: string,
  generation: number,
  interactive: boolean,
): Promise<{ sessionExpired: boolean }>;

export function 创建组织操作(deps: 后端操作依赖): 组织操作;
```

在 `后端/类型.ts` 增加页面会调用的方法：

```ts
export interface 组织操作 {
  选择企业关系(id: string | null): Promise<void>;
  保存未认证公司声明(company: string): void;
  保存招聘方档案(patch: BFF招聘方档案补丁): Promise<void>;
  读取企业管理员申请(): Promise<void>;
  创建企业管理员申请(metadata: BFF企业管理员申请元数据, evidence: File[]): Promise<void>;
  取消企业管理员申请(id: string): Promise<void>;
  接受企业邀请(token: string): Promise<void>;
  替换招聘方头像(file: File): Promise<void>;
  保存企业档案(draft: 资料形): Promise<void>;
  上传并发布企业媒体(purpose: BFF企业媒体用途, file: File): Promise<void>;
  移除企业媒体(purpose: BFF企业媒体用途, mediaId: string): Promise<void>;
  读取公开企业(id: string): Promise<void>;
}
```

`应用操作 = 会话操作 & 候选操作 & 岗位操作 & 组织操作`。在 Provider 的 useMemo 中组合 `创建组织操作`。

`选择企业关系` 必须先清旧 snapshot，再按所选关系的 canonical ID 重读；快速二次选择时用当前 state ref 丢弃先前
响应。`保存企业档案` 同时核验关系 ID、当前企业身份 ID 与 snapshot，不能只拿一个裸 revision：

```ts
async function 选择企业关系(id: string | null): Promise<void> {
  deps.派发({ 型: '选择当前企业关系', 编号: id });
  if (id === null) return;
  const relation = deps.状态引用.current.企业关系列表.find((item) => item.affiliation_id === id);
  if (!relation || !可用企业关系(relation)) throw new Error('企业关系已不可用');
  const organization = await deps.后端.读取公开企业(relation.organization_id);
  if (deps.状态引用.current.当前企业关系编号 !== id) return;
  const { profile, ...identity } = organization;
  deps.派发({ 型: '水合当前企业', 身份: identity, 档案: profile });
}

async function 保存企业档案(draft: 资料形): Promise<void> {
  const state = deps.状态引用.current;
  const relation = state.企业关系列表.find((item) => item.affiliation_id === state.当前企业关系编号);
  if (!relation || state.当前企业身份?.organization_id !== relation.organization_id || !state.企业档案快照) {
    throw new Error('当前企业档案尚未水合');
  }
  const body = 转BFF企业档案替换(draft, state.企业档案快照);
  try {
    const next = await deps.后端.替换企业档案(
      relation.organization_id, body, state.企业档案快照.revision,
    );
    deps.派发({ 型: '水合当前企业', 身份: state.当前企业身份, 档案: next });
    deps.派发({ 型: '缓存公开企业', 企业: { ...state.当前企业身份, profile: next } });
  } catch (error) {
    if (error instanceof BFF错误 && error.status === 401) {
      清账号状态(deps);
    } else if (是并发或不确定写入(error)) {
      await 重读企业档案(deps, relation.organization_id);
    }
    throw error;
  }
}

async function 重读企业档案(deps: 后端操作依赖, organizationId: string): Promise<void> {
  const profile = await deps.后端!.读取企业档案(organizationId);
  const state = deps.状态引用.current;
  const relation = state.企业关系列表.find((item) => item.affiliation_id === state.当前企业关系编号);
  if (relation?.organization_id !== organizationId || state.当前企业身份?.organization_id !== organizationId) return;
  deps.派发({ 型: '水合当前企业', 身份: state.当前企业身份, 档案: profile });
  deps.派发({ 型: '缓存公开企业', 企业: { ...state.当前企业身份, profile } });
}
```

在 `组织操作.test.ts` 增加 RED：从 A 切到 B 后、B 的 public Organization 未返回前调用 `保存企业档案` 必须拒绝且
`替换企业档案` 未调用；B 返回后保存必须使用 `org_b + B.revision + B 的完整媒体 ID`。预期 GREEN：任何时刻都不能
把 A snapshot 发往 B。

`会话操作.ts` 的 recruiter 分支调用新的固定水合函数；owner Jobs 必须在 current relation 校验和一次
PublicOrganization 读取之后。operation 收到 PublicOrganization 后拆成不含 profile 的 `当前企业身份` 与唯一
`企业档案快照`，不在 state 保存第二份 current Profile。Profile/media 写成功替换 `企业档案快照` 并覆盖同 ID
的旧 public cache：复用现有 `缓存公开企业` action，以 `{...当前企业身份, profile: next}` 覆盖同 ID 项，不增加失效
action；避免公共页首帧显示旧 profile。登录水合不再额外 GET profile，只有 Profile 409/503 恢复
时才调用 `读取企业档案()`。admin request 不阻塞全局水合，`企业实名认证` 进入时显式调用
`读取企业管理员申请()`。`清账号状态` 同时派发 `清后端组织状态`，清 current relation/session claim/公开缓存，
但不清 Mock fixture；object URL 由创建它的页面 effect 自己 revoke。

在 `水合角色数据` 的 recruiter 分支实际替换旧的“直接读岗位”代码；依赖类型补入 `状态引用/后端状态引用`，使
两个水合函数共享同一 subject/generation fence：

```ts
} else if (角色 === 'recruiter') {
  const organizationResult = await 水合招聘方组织数据(
    deps, 主体.subject_id, 会话代际.current, 交互,
  );
  if (organizationResult.sessionExpired) return true;
  try {
    const 岗位快照 = await 后端.读取岗位();
    if (主体标识引用.current !== 主体.subject_id) return false;
    派发({ 型: '水合后端岗位', 快照: 岗位快照 });
    设后端状态((旧) => ({ ...旧, 岗位快照: 岗位快照.服务端 }));
  } catch (错误) {
    if (是会话失效错误(错误)) { 清账号状态(deps); return true; }
    if (交互) throw 错误;
    轻提示(取后端错误文案(错误));
  }
}
```

核心实现不得把 stale 检查留给调用方：

```ts
export async function 水合招聘方组织数据(deps: 组织水合依赖, subjectId: string, generation: number, interactive: boolean) {
  const 仍有效 = () => deps.主体标识引用.current === subjectId && deps.会话代际.current === generation;
  try {
    const profile = await deps.后端.读取招聘方档案();
    if (!仍有效()) return { sessionExpired: false };
    deps.派发({ 型: '水合招聘方档案', 档案: profile });
    const affiliations = await deps.后端.读取我的企业关系();
    if (!仍有效()) return { sessionExpired: false };
    const currentId = 选择当前企业关系(affiliations, deps.状态引用.current.当前企业关系编号);
    deps.派发({ 型: '水合企业关系', 关系: affiliations, 当前编号: currentId });
    if (currentId) {
      const relation = affiliations.find((item) => item.affiliation_id === currentId)!;
      const organization = await deps.后端.读取公开企业(relation.organization_id);
      if (!仍有效()) return { sessionExpired: false };
      const { profile: organizationProfile, ...identity } = organization;
      deps.派发({ 型: '水合当前企业', 身份: identity, 档案: organizationProfile });
    }
    return { sessionExpired: false };
  } catch (error) {
    if (error instanceof BFF错误 && error.status === 401) {
      清账号状态(deps);
      return { sessionExpired: true };
    }
    if (interactive) throw error;
    轻提示(取后端错误文案(error));
    return { sessionExpired: false };
  }
}
```

其中产品文件就地声明：

```ts
type 组织水合依赖 = Pick<后端操作依赖,
  '后端' | '派发' | '设后端状态' | '主体标识引用' | '会话代际' | '状态引用'> &
  { 后端: HTTP招聘数据源 };
```

完成本 Step 后重跑 `npx vitest run src/状态/后端/组织操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts`。预期 GREEN：固定
顺序、过时代际无派发、401 统一清理、交互/初始化错误分流均 PASS。

- [ ] **Step 5：只持久化可恢复选择与 unverified claim**

扩展 `资料缓存快照` 两个可选字段：

```ts
当前企业关系编号?: string | null;
未认证公司声明?: string;
```

Backend 使用现有按 `{模式:'backend', 环境, 账号:subject}` 隔离的 sessionStorage；Mock 继续原 localStorage 路径。
恢复后必须经过最新 affiliations 校验。`资料持久化.ts` 在 Backend 分支的写入白名单只有
`当前企业关系编号/未认证公司声明`；旧 `企业认证/招聘头像/公司LOGO/公司自述` 只允许 Mock 路径读写。
不要持久化 profile、affiliation 列表、Organization/Profile DTO、申请材料、public cache 或 token。

先在 `资料缓存.test.ts` 写失败测试，覆盖两个新字段的合法值 round trip、损坏类型被丢弃，以及 Backend
持久化快照不包含旧 `企业认证/招聘头像/公司LOGO/公司自述`。再补 `读资料缓存` 的逐键类型守卫。

```ts
it('Backend 快照只保留可恢复选择和 unverified claim', () => {
  const setItem = vi.fn();
  const 存储 = { getItem: vi.fn(() => null), setItem, removeItem: vi.fn() };
  const 范围 = { 模式: 'backend', 环境: 'local', 账号: 'sub_1' } as const;
  写资料缓存(存储, 范围, { 当前企业关系编号: null, 未认证公司声明: '' });
  expect(JSON.parse(setItem.mock.calls[0][1])).toEqual({
    当前企业关系编号: null, 未认证公司声明: '',
  });
});

it('损坏的 Backend 选择字段被逐键丢弃', () => {
  const 存储 = {
    getItem: vi.fn(() => JSON.stringify({ 当前企业关系编号: 3, 未认证公司声明: [] })),
    setItem: vi.fn(), removeItem: vi.fn(),
  };
  expect(读资料缓存(存储, { 模式: 'backend', 环境: 'local', 账号: 'sub_1' })).toEqual({});
});
```

实现只做逐键守卫：

```ts
if (raw.当前企业关系编号 === null || typeof raw.当前企业关系编号 === 'string') {
  out.当前企业关系编号 = raw.当前企业关系编号;
}
if (typeof raw.未认证公司声明 === 'string') out.未认证公司声明 = raw.未认证公司声明;
```

把旧字段改为可选以允许 Backend 白名单快照；Mock migration 仍显式补齐旧字段。`写资料缓存` 接收
`Partial<资料缓存快照>`，Provider 的写入 effect 明确分支：

```ts
const 快照: Partial<资料缓存快照> = 是后端
  ? { 当前企业关系编号: 状态.当前企业关系编号, 未认证公司声明: 状态.未认证公司声明 }
  : {
      公司自述: 状态.公司自述, 企业认证: 状态.企业认证, 招聘头像: 状态.招聘头像,
      公司LOGO: 状态.公司LOGO, 求职头像: 状态.求职头像,
      飞书已接入: 状态.飞书已接入, 企业飞书已接入: 状态.企业飞书已接入,
    };
写资料缓存(是后端 ? 会话存储 : 本地存储, 范围, 快照);
```

预期 RED（写测试后、实现守卫前）：Backend 快照仍带 Mock 字段，或损坏的新字段原样恢复。实现后预期 GREEN：
`资料缓存.test.ts` 全部 PASS，且既有 Mock migration 用例不变。

- [ ] **Step 6：验证并提交**

```bash
npx vitest run src/状态/后端/组织操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts src/数据/资料缓存.test.ts
npm run typecheck
npm run lint
git add src/状态 src/数据/资料缓存.ts src/数据/资料缓存.test.ts
git commit -m "feat(recruitment): hydrate organization identity state"
```

---

## Task 3：诚实的招聘身份、RecruiterProfile、admin request 与 invitation acceptance

**文件：**

- 修改：`src/屏幕/企业实名认证.tsx`
- 新建：`src/屏幕/企业实名认证.test.tsx`
- 修改：`src/屏幕/招聘名片.tsx`
- 新建：`src/屏幕/招聘名片.test.tsx`
- 修改：`src/屏幕/企业我的.tsx`
- 新建：`src/屏幕/企业我的.test.tsx`
- 新建：`src/屏幕/企业组织申请.tsx`
- 新建：`src/屏幕/企业组织申请.module.css`
- 新建：`src/屏幕/企业组织申请.test.tsx`
- 新建：`src/屏幕/企业邀请加入.tsx`
- 新建：`src/屏幕/企业邀请加入.module.css`
- 新建：`src/屏幕/企业邀请加入.test.tsx`
- 修改：`src/路由/路径表.ts`
- 修改：`src/应用.tsx`
- 修改：`src/流程/onboarding配置.test.ts`

**Interfaces:**

- Consumes: Task 2 的组织状态/action/`组织操作`；Task 1 的 `从BFF招聘身份()`；现有
  `use应用状态(): {状态,后端状态,派发,操作}`、`次级页外壳/返回栏/页面大标题/滚动区/主按钮` 与
  `压成头像(file): Promise<string>`。
- Produces: Backend/Mock 双分支的 `企业实名认证/招聘名片/企业我的`；路由
  `企业组织申请='/hr/organization-application'`、`企业邀请加入='/hr/organization-invitation'`；两个页面分别只把
  `BFF企业管理员申请元数据+File[]` 和 raw invitation token 传给 operation。Task 4 延续同一招聘名片组件接头像写入。

- [ ] **Step 1：先写身份诚实性组件测试**

使用已有应用状态测试 helper 渲染 Backend/Mock 两种模式，覆盖：

- Backend `企业实名认证` 不调用 `setTimeout`，不显示“人脸识别将核对”或“认证通过”；
- personal status 与 Organization/Affiliation status 分开显示；未 verified 不出现认证 badge；
- `verified_name` 存在时只读，`public_name/title` 可编辑；
- 有多个 active verified affiliations 时显示明确选择，不自动选择第一项；
- 无 current affiliation 时公司输入保存为 unverified claim，不创建 Organization；
- admin request 状态为 pending/approved/rejected/cancelled 时按服务端事实展示；
- `企业我的` Backend 分支只显示映射后的 profile/Affiliation/Organization 状态，Mock 仍显示原 fixture；
- Mock 原注册流仍直接进入招聘名片，原布局/剧情测试不变。

按现有 `vi.mock('../状态/应用状态')` seam 写实际 RED；不要 mock 映射函数：

```tsx
it('Backend 未 verified 不用计时器伪造认证通过', () => {
  const 定时 = vi.spyOn(window, 'setTimeout');
  置Backend应用状态({ 招聘方档案: BFF招聘方档案样本, 企业关系列表: [] });
  render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
  expect(screen.getByText('个人身份：未认证')).toBeTruthy();
  expect(screen.queryByText(/人脸识别将核对|认证通过/)).toBeNull();
  expect(定时).not.toHaveBeenCalled();
});

it('多个有效关系要求显式选择，不把第一项当 current', () => {
  置Backend应用状态({
    企业关系列表: [BFF企业关系样本, { ...BFF企业关系样本, affiliation_id: 'aff_2' }],
    当前企业关系编号: null,
  });
  render(<MemoryRouter><招聘名片 /></MemoryRouter>);
  expect(screen.getByText('请选择当前任职企业')).toBeTruthy();
  expect(mock选择企业关系).not.toHaveBeenCalled();
});
```

运行并确认失败：

```bash
npx vitest run src/屏幕/企业实名认证.test.tsx src/屏幕/招聘名片.test.tsx src/屏幕/企业我的.test.tsx src/流程/onboarding配置.test.ts
```

预期 RED：Backend 分支仍进入现有计时器/Mock fixture，或页面尚未消费独立 profile/affiliation/current 状态；
失败不得来自测试桩缺必填 context。

- [ ] **Step 2：改造身份入口与招聘名片**

Backend `企业实名认证` 复用现有外壳/CSS 槽位，改成只读状态摘要和两个入口：

```text
个人：公开名 / verified_name（若有）/ unverified|verified
任职：当前 Affiliation 的 organization_display_name、role、status
申请：最新 admin request status
动作：申请企业管理员、输入邀请 token 加入
```

Mock 分支保留当前 1.2 秒原型，不让 Backend 条件进入计时器代码。

`招聘名片` Backend 分支：

- 姓名槽显示 `verified_name ?? public_name`；只有 `verified_name === null` 时 public name 可编辑；
- 职务映射 `title`；保存一次调用 `保存招聘方档案({public_name,title})`；
- 公司槽从 current affiliation 或 `未认证公司声明` 读取；多个关系用现有行样式选择；
- 成功响应后才提示保存成功；失败保留输入；
- 本 Task 暂不改头像上传，Task 4 接入真实 multipart。

当前基线已经把 Mock 图片压缩提取到 `src/组件/头像处理.ts`。改造 `招聘名片` 时保留现有 import 和 Mock
`压成头像(file) → 存招聘头像` 路径，不复制或重写压缩逻辑；Backend 条件只包围真实上传所需的读取与保存路径。

`企业我的` Backend 分支只读 `从BFF招聘身份()` 的 view model；不得直接解释 DTO，也不得通过公司名非空推导
verified。`企业实名认证` 进入时调用 `操作.读取企业管理员申请()`，失败只影响该屏申请状态，不阻断 recruiter
登录和 owner Jobs 水合。

Backend 分支的最小决策代码固定为显式判定，不从公司名推断：

```tsx
const 是后端 = 数据源模式 === 'backend';
const 身份 = 从BFF招聘身份(
  状态.招聘方档案, 状态.企业关系列表, 状态.当前企业关系编号, 状态.企业管理员申请列表,
);
const 显示姓名 = 身份.verifiedName ?? 身份.publicName;
const 可编辑公开名 = 身份.verifiedName === null;
const 保存 = () => 是后端
  ? 操作.保存招聘方档案({ public_name: 公开名, title: 职务 })
  : Promise.resolve(派发({ 型: '存招聘名片', 姓名: 公开名, 职务 }));
```

完成后重跑 Step 1 命令。预期 GREEN：Backend 诚实性、多个关系不猜、只读 verified name 与旧 Mock onboarding
用例同时 PASS。

- [ ] **Step 3：先写 admin request multipart/恢复测试**

`企业组织申请.test.tsx` 覆盖：

- legal/display/registry/explanation/domains 必填；
- evidence 1–5 个、单个选择保留 File，不转 data URL；
- submit 调 `创建企业管理员申请(metadata, files)`；
- success 清 File 引用并显示服务端 pending；
- `verification_request_conflict` 重读/显示既有申请，不重复提交；
- pending cancel 用 snapshot revision，409 保留现有状态并重读。

冻结 P1B 当前申请边界并在表单测试覆盖：`legal_name <= 200`、`display_name <= 80`、`registry_key <= 200`、
`explanation <= 4000`、`domains <= 20` 且每项 `<= 253`；evidence 为 1–5 个 PNG/JPEG/PDF，每个最多 `10 MiB`。
超限时不得调用 operation，并把 BFF `{path,reason}` 映射回相同表单槽，不自造另一套限制。

`企业邀请加入.test.tsx` 覆盖：

- token 不出现在 URL/history state/reducer action；
- body 操作只接收 token；
- success 后清 input、重读 affiliation 并应用 current selection 规则；
- 失败、离页、subject change 都清 token；
- not_found 使用统一文案，`invitation_used` 单独提示但不回显 token。

实际 RED 至少包含 raw token 不进路由/状态和 conflict 恢复：

```tsx
it('邀请 token 只进入接受操作，成功后立即清空', async () => {
  mock接受企业邀请.mockResolvedValue(undefined);
  render(<MemoryRouter initialEntries={['/hr/organization-invitation']}><企业邀请加入 /></MemoryRouter>);
  await userEvent.type(screen.getByLabelText('邀请口令'), 'secret-token');
  await userEvent.click(screen.getByRole('button', { name: '加入企业' }));
  expect(mock接受企业邀请).toHaveBeenCalledWith('secret-token');
  expect(screen.getByLabelText('邀请口令')).toHaveValue('');
  expect(JSON.stringify(mock派发.mock.calls)).not.toContain('secret-token');
  expect(window.location.href).not.toContain('secret-token');
  expect(window.history.state == null ? '' : JSON.stringify(window.history.state)).not.toContain('secret-token');
});

it('申请冲突时重读既有申请而不重复 POST', async () => {
  mock创建申请.mockRejectedValue(new BFF错误(409, 'verification_request_conflict', 'conflict'));
  render(<MemoryRouter><企业组织申请 /></MemoryRouter>);
  await 填写并提交合法申请();
  expect(mock读取申请).toHaveBeenCalledTimes(1);
  expect(mock创建申请).toHaveBeenCalledTimes(1);
});
```

预期 RED：两个页面/operation 调用尚不存在，或 token/冲突仍由通用状态/重复提交处理。

- [ ] **Step 4：实现两个最小次级页与路由**

路径固定为：

```ts
企业组织申请: '/hr/organization-application',
企业邀请加入: '/hr/organization-invitation',
```

在 `应用.tsx` lazy import 并登记。页面只复用现有 `次级页外壳/返回栏/页面大标题/滚动区/主按钮` 与 CSS Modules，不新建设计系统，不增加邀请创建、分享、roster 或成员管理。

提交边界只把 File/raw token 留在组件局部变量：

```tsx
const 提交申请 = async () => {
  try {
    await 操作.创建企业管理员申请({ legal_name, display_name, registry_key, explanation, domains }, evidence);
    设Evidence([]);
  } catch (error) {
    if (error instanceof BFF错误 && error.code === 'verification_request_conflict') {
      await 操作.读取企业管理员申请();
      return;
    }
    throw error;
  }
};
const 接受 = async () => {
  const once = token;
  try { await 操作.接受企业邀请(once); } finally { 设Token(''); }
};
```

完成后运行 Step 5 的目标测试。预期 GREEN：两张次级页的校验、恢复、token 清理以及全部既有 Mock 流程 PASS。

- [ ] **Step 5：验证并提交**

```bash
npx vitest run src/屏幕/企业实名认证.test.tsx src/屏幕/招聘名片.test.tsx src/屏幕/企业我的.test.tsx src/屏幕/企业组织申请.test.tsx src/屏幕/企业邀请加入.test.tsx src/流程/onboarding配置.test.ts
npm run typecheck
npm run lint
git add src/屏幕 src/路由/路径表.ts src/应用.tsx src/流程/onboarding配置.test.ts
git commit -m "feat(recruitment): wire recruiter organization identity screens"
```

---

## Task 4：Recruiter avatar、OrganizationProfile 与 Organization media CAS

**文件：**

- 修改：`src/屏幕/招聘名片.tsx`
- 修改：`src/屏幕/招聘名片.test.tsx`
- 修改：`src/屏幕/公司档案编辑.tsx`
- 新建：`src/屏幕/公司档案编辑.test.tsx`
- 修改：`src/屏幕/公司档案分区编辑.tsx`
- 新建：`src/屏幕/公司档案分区编辑.test.tsx`
- 修改：`src/数据/公司主页资料.ts`
- 新建：`src/数据/公司主页资料.test.ts`
- 修改：`src/状态/后端/组织操作.ts`
- 修改：`src/状态/后端/组织操作.test.ts`

**Interfaces:**

- Consumes: Task 3 的 `招聘名片`、Task 2 的 `组织操作/企业档案快照/当前企业身份`、Task 1 的
  `BFF企业档案替换/BFF企业媒体用途` 与 `转BFF企业档案替换(draft, server)`；Mock 继续消费
  `压成头像(file)`、`取公司主页资料()` 和旧 reducer action。
- Produces: Backend avatar 原子保存；admin-only 完整 OrganizationProfile replacement；
  `上传并发布企业媒体(purpose,file)` 与 `移除企业媒体(purpose,mediaId)` 两步 CAS；`资料形` 新增
  `行业引用/LOGO媒体/实景媒体/公司媒体` 四个可选元数据字段。Task 5 只读取成功后的权威 snapshot。

- [ ] **Step 1：先写 avatar 原子保存测试**

覆盖：

- Backend 选择 PNG/JPEG 后只生成 `URL.createObjectURL` 内存预览；不压成 data URL、不派发 `存招聘头像`；
- 调 `替换招聘方头像(file)` 时使用当前 profile revision；
- 服务端成功后用返回的 `avatar_url/revision` 替换权威 profile，再 revoke preview URL；
- 409 重读 profile、保留 file/preview 并提示检查后再按现有按钮重试；
- failure 不显示“头像已更新”；unmount 与账号变化 revoke object URL；
- Mock 仍调用 `src/组件/头像处理.ts` 的 `压成头像` 并走现有压缩 data URL 路径；现有
  `src/组件/头像处理.test.ts` 必须继续通过。

实际 RED 锁住分支与 object URL 生命周期：

```tsx
it('Backend 保存成功前只使用 object URL 预览', async () => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:avatar-preview');
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  mock替换头像.mockResolvedValue(undefined);
  render(<MemoryRouter><招聘名片 /></MemoryRouter>);
  await userEvent.upload(screen.getByLabelText('更换头像'), pngFile);
  expect(screen.getByRole('img', { name: '头像预览' })).toHaveAttribute('src', 'blob:avatar-preview');
  expect(mock压成头像).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(mock替换头像).toHaveBeenCalledWith(pngFile));
  expect(revoke).toHaveBeenCalledWith('blob:avatar-preview');
});
```

本 Task 代码块里的 `pngFile`、DTO 样本、`置Backend应用状态`、`企业档案替换键` 与受控 mock 都是各目标测试文件内
紧邻用例声明的实际 helper/fixture；实现者必须一并写出，不得留下未定义占位符。

预期 RED：Backend 仍派发 data URL/旧头像 action，或成功后没有以响应 snapshot 收口预览。

- [ ] **Step 2：实现 avatar Backend 分支**

`组织操作.替换招聘方头像` 只接受当前 `招聘方档案` snapshot 存在时执行；用 `revision` 生成 If-Match。401 统一清账号；409 重读 profile 但不丢组件 file；503 重读 profile，只有 `avatar_url/revision` 已变化才视作 confirmed success。

最小 operation 形状：

```ts
const 替换招聘方头像 = async (file: File) => {
  const before = deps.状态引用.current.招聘方档案;
  if (!before) throw new Error('招聘方档案尚未水合');
  try {
    const after = await deps.后端.替换招聘方头像(file, before.revision);
    deps.派发({ 型: '水合招聘方档案', 档案: after });
  } catch (error) {
    if (error instanceof BFF错误 && error.status === 401) {
      清账号状态(deps);
    } else if (是并发或不确定写入(error)) {
      const current = await 重读招聘方档案(deps);
      if (error.status === 503 &&
          current.revision !== before.revision && current.avatar_url !== before.avatar_url) return;
    }
    throw error;
  }
};

function 是并发或不确定写入(error: unknown): error is BFF错误 {
  return error instanceof BFF错误 &&
    ((error.status === 409 && error.code === 'version_conflict') ||
     (error.status === 503 && error.code === 'operation_outcome_unknown'));
}

async function 重读招聘方档案(deps: 后端操作依赖): Promise<BFF招聘方档案> {
  const profile = await deps.后端!.读取招聘方档案();
  deps.派发({ 型: '水合招聘方档案', 档案: profile });
  return profile;
}
```

完成后重跑头像用例。预期 GREEN：Backend 原子保存/409/503/object URL 与 Mock 压缩路径全部 PASS。

- [ ] **Step 3：先写 Profile 映射、权限与 conflict 测试**

覆盖：

- admin+active+verified 可编辑；member/pending/revoked/suspended 全部只读；
- legal name、verified_at、active verified job count 不出现在可编辑 input；
- Backend 基本信息分区把现有“公司全称”输入标签改为“品牌名称”，写 `brand_name`；在同区现有信息行样式中
  增加只读“工商全称（已核验）”，值取 `当前企业身份.legal_name`，不允许草稿覆盖；
- 页面从最新 `BFF企业档案` 构造完整 `资料形`；
- 保存 body 含所有 replacement 字段和当前 revision，不做 sparse patch；
- 409 重读 server snapshot，但组件草稿保持；用户必须再次点击原保存按钮；
- 行业显示名非空但缺目录引用时拒绝保存；两者都空时按 runtime 契约发送空字符串，不按显示名查询；
- Backend 基本信息分区打开行业选择时先调用 `目录查询.查询Taxonomy('industries', { limit: 50 })` 读取根项，
  展开项调用 `目录查询.查询Taxonomy('industries', { parentId, limit: 50 })`，搜索调用
  `目录查询.查询Taxonomy('industries', { q, limit: 50 })`；只有
  `selectable=true` 的叶子能原子写入显示名+`行业引用`；只有显示名、没有引用时保存按钮禁用；
- Backend 不 import/调用 `取公司档案(本公司键)`；Mock 原逻辑不变。

409 recovery 的实际 RED 放在 `组织操作.test.ts`，页面草稿断言放在 `公司档案编辑.test.tsx`：

```ts
it('企业档案 409 重读新 revision、覆盖 public cache 并把错误抛回页面', async () => {
  后端.替换企业档案.mockRejectedValue(new BFF错误(409, 'version_conflict', 'conflict'));
  后端.读取企业档案.mockResolvedValue({ ...BFF企业档案样本, revision: 9 });
  await expect(操作.保存企业档案(页面资料)).rejects.toMatchObject({ code: 'version_conflict' });
  expect(后端.读取企业档案).toHaveBeenCalledWith(BFF公开企业样本.organization_id);
  expect(派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '水合当前企业', 档案: expect.objectContaining({ revision: 9 }) }));
  expect(派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '缓存公开企业' }));
  expect(页面草稿引用.current).toEqual(页面资料);
});
```

同组补 401 统一清账号与 503 重读后仍不显示成功；重读失败保留原 error/草稿并由页面提示，不能自动重试完整写入。

把 P1B runtime 限制冻结进页面/映射测试，避免“前端可提交、后端稳定拒绝”：`brand_name <= 40`、
`office_address <= 80`、`company_intro <= 500`、`business_items <= 20` 且每项 `<= 200`、
`product_intro <= 300`、`team_members <= 20`，成员 `name/title/summary` 分别 `<= 16/20/60`、每类 gallery
最多 3 张、PNG/JPEG 单文件最多 `10 MiB`。这些是 P1B 当前约束，不抽成远端配置。

实际 RED 至少证明完整 replacement、admin 权限与行业引用：

```ts
it('完整 replacement 保留未编辑字段并只信 taxonomy id', () => {
  const body = 转BFF企业档案替换({ ...页面资料, 行业: '人工智能', 行业引用: { id: 'ind_ai', display_name: '人工智能' } }, BFF企业档案样本);
  expect(Object.keys(body).sort()).toEqual(企业档案替换键.sort());
  expect(body.industry_id).toBe('ind_ai');
  expect(body.office_media_ids).toEqual(BFF企业档案样本.office_media.map((item) => item.media_id));
});

it('member 即使打开编辑 URL 也不出现保存按钮', () => {
  置Backend应用状态({
    企业关系列表: [{ ...BFF企业关系样本, role: 'member' }],
    当前企业关系编号: BFF企业关系样本.affiliation_id,
  });
  render(<MemoryRouter><公司档案编辑 /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
});
```

预期 RED：页面仍从静态 `本公司键` 取资料、稀疏保存或仅按显示名选行业。

- [ ] **Step 4：改造公司档案页面**

给 `资料形` 增加 Backend 所需的非展示元数据，但不改变现有中文表单槽位：

```ts
行业引用?: BFF目录引用;
LOGO媒体?: BFF企业媒体 | null;
实景媒体?: BFF企业媒体[];
公司媒体?: BFF企业媒体[];
```

Backend `公司档案编辑/分区编辑` 读取 `企业档案快照`；Mock 继续读取静态档+`公司自述`。保存只调用 `保存企业档案(draft)`，不派发 `存公司自述/存公司LOGO`。

基本信息分区保持现有“行业”表单槽位，但 Backend 分支按 `工作经历.tsx` 已验证的 industries taxonomy
roots→parentId 展开→selectable leaf 模式和现有 `目录查询` seam，替换静态 `行业池` 片组选值；不新增路由或通用
目录组件。这里刻意接受一份仅限公司基本信息的局部状态实现，不抽取/改动已稳定的 `工作经历`：P1C 只有这一个
新增 consumer，跨屏抽取会扩大回归面；出现第三个单选行业 consumer 或两处真实漂移缺陷后再重评。选择叶子同时
写 `行业` 与 `行业引用`；两者都空时允许保存并发送 `industry_id: ''`，只有显示名没有引用时禁用保存。Mock 继续
使用原 `行业池`。

实现时把可编辑判断写成一个局部布尔表达式，不引入权限框架：

```ts
const 可编辑 = 当前关系?.status === 'verified' &&
  当前关系.role === 'admin' && 当前关系.organization_status === 'active';
const 保存 = () => 可编辑
  ? 操作.保存企业档案(草稿)
  : Promise.reject(new Error('organization_admin_required'));
```

完成后重跑 Profile 页面/映射测试。预期 GREEN：权限、14 字段 replacement、限制、409 草稿保留、taxonomy leaf
和既有 Mock 页面均 PASS。

- [ ] **Step 5：先写两步媒体协议测试**

在 operation 与页面测试覆盖三个 closed purpose：

```text
organization_logo
office_photo
company_photo
```

成功顺序必须是：

```text
POST media(metadata+media, idempotency key)
→ 收到 media_id/url
→ PATCH full profile(If-Match current revision，加入 media_id)
→ 用响应替换 snapshot
```

并覆盖：

- upload 失败不 PATCH、不把 preview 当服务端成功；
- PATCH 失败保留 detached receipt，用户放弃时 best-effort DELETE；
- 明确移除时先 PATCH 去引用，再 DELETE 已 detached media；
- `media_in_use` 重读 profile，不伪造删除；
- delete 204 正常完成；
- `organization_admin_required` 重读 affiliations 并切只读；
- `organization_suspended` 清 current selection/组织写入口；
- 页面卸载只 revoke object URL，不把卸载当服务器删除。

实际 RED 用受控 mock 固定两步顺序：

```ts
it('先上传 receipt，再以最新 revision 发布引用', async () => {
  const calls: string[] = [];
  后端.上传企业媒体.mockImplementation(async () => { calls.push('upload'); return BFF企业媒体样本; });
  后端.替换企业档案.mockImplementation(async (_id, body, revision) => {
    calls.push(`patch:${revision}`);
    expect(body.office_media_ids).toContain(BFF企业媒体样本.media_id);
    return { ...BFF企业档案样本, office_media: [BFF企业媒体样本], revision: revision + 1 };
  });
  await 操作.上传并发布企业媒体('office_photo', pngFile);
  expect(calls).toEqual(['upload', `patch:${BFF企业档案样本.revision}`]);
});
```

预期 RED：operation 尚未编排 upload→PATCH，或页面直接把 preview/URL 写进旧状态。

- [ ] **Step 6：实现最小 media orchestration**

编排留在 `后端/组织操作.ts`，页面只传 purpose/file 或 purpose/mediaId。不要创建通用 upload manager、队列、裁剪器、缩略图或 GC。服务端 URL 直接使用 DTO 的 `url`，禁止由 media ID 拼对象路径。

实现后重跑 Step 7 目标测试。预期 GREEN：三种 purpose、detached receipt cleanup、先去引用再 DELETE、204、
admin/suspended 恢复全部 PASS。

- [ ] **Step 7：验证并提交**

```bash
npx vitest run src/屏幕/招聘名片.test.tsx src/屏幕/公司档案编辑.test.tsx src/屏幕/公司档案分区编辑.test.tsx src/数据/公司主页资料.test.ts src/状态/后端/组织操作.test.ts
npm run typecheck
npm run lint
git add src/屏幕/招聘名片.tsx src/屏幕/招聘名片.test.tsx src/屏幕/公司档案编辑.tsx src/屏幕/公司档案编辑.test.tsx src/屏幕/公司档案分区编辑.tsx src/屏幕/公司档案分区编辑.test.tsx src/数据/公司主页资料.ts src/数据/公司主页资料.test.ts src/状态/后端/组织操作.ts src/状态/后端/组织操作.test.ts
git commit -m "feat(recruitment): wire organization profile media"
```

---

## Task 5：Job publisher/hiring projections 与 canonical public company page

**文件：**

- 修改：`src/数据/BFF契约.ts`
- 修改：`src/数据/招聘数据源/岗位.ts`
- 修改：`src/数据/HTTP招聘数据源.test.ts`
- 修改：`src/数据/后端映射.ts`
- 修改：`src/数据/后端映射.test.ts`
- 修改：`src/数据/招聘数据源类型.ts`
- 修改：`src/状态/领域/组织岗位.ts`
- 修改：`src/状态/后端/岗位操作.ts`
- 新建：`src/状态/后端/岗位操作.test.ts`
- 修改：`src/状态/后端/类型.ts`
- 修改：`src/屏幕/发布岗位.tsx`
- 修改：`src/屏幕/发布岗位.test.tsx`
- 修改：`src/屏幕/岗位详情.tsx`
- 新建：`src/屏幕/岗位详情.test.tsx`
- 修改：`src/屏幕/职位详情.tsx`
- 修改：`src/屏幕/职位详情.test.tsx`
- 修改：`src/屏幕/企业详情.tsx`
- 新建：`src/屏幕/企业详情.test.tsx`
- 修改：`src/屏幕/在谈详情.tsx`
- 新建：`src/屏幕/在谈详情.test.tsx`
- 修改：`src/屏幕/真人会话.tsx`
- 新建：`src/屏幕/真人会话.test.tsx`
- 修改：`src/组件/公司区块.tsx`
- 新建：`src/组件/公司区块.test.tsx`

**Interfaces:**

- Consumes: Task 1 的 owner `BFFOwnerJob` 扩展字段与 `从BFF岗位发布方(dto: BFFOwnerJob)`；Task 2 的
  `岗位快照/当前企业身份/公开企业表` 与 `组织操作.读取公开企业(id)`；Task 4 的最新企业档案 snapshot；现有
  `公司区块`、`企业详情` route 和静态 Mock `公司档案`。
- Produces: owner Job 创建/更新的可信 claim 输入与 publisher/hiring 投影视图；支持显式 `公司区块资料` 和可选
  `按下` 的单一公司卡；Backend `/company/{opaque-id}` 公共页。P4 之前不产生 candidate Job consumer/cache。

- [ ] **Step 1：先锁定 Job request/response 边界**

新增测试证明：

- `BFF岗位创建`/实际 JSON 没有 `publisher_affiliation_ref`、`publisher_organization_ref`、`hiring_organization_ref` 或 verification status；
- current active verified relation 只把批准的 `organization_display_name` 作为 direct claim 默认值；
- 无 current relation 使用 `未认证公司声明`，仍允许发岗；
- 更新既有 Job 沿用 `previous.publisher_mode` 与 `previous.hiring_organization_claim`，普通 JD 编辑不拿当前自由文本改 claim；
- owner response 保存 publisher/hiring refs/status；
- P1C 不为尚不可达的 candidate Job route 增加浏览器 consumer；P4 才接 `publisher_profile`。

前两条 claim 来源断言放在 `状态/后端/岗位操作.test.ts`：直接调用 `创建岗位操作().发布岗位()`，检查传给数据源的
`岗位创建上下文`，而不是只测纯映射。`发布岗位.test.tsx` 再证明 Backend 页面保存会走这条 operation；这样实际
决定服务端 claim 的路径有失败测试，而不只依赖最终 E2E。

把映射上下文改为明确输入：

```ts
export interface 岗位创建上下文 {
  publisherMode: 'direct';
  hiringOrganizationClaim: { display_name: string; legal_name: string | null };
}
```

删除旧 `岗位映射上下文 { 公司: string }`。`创建岗位` 改收 `岗位创建上下文`；`更新岗位` 不再接公司 context，
`转岗位补丁(页面岗位, previous)` 直接沿用 `previous.publisher_mode` 与 `previous.hiring_organization_claim`。
同步删除 `岗位操作.ts` 更新路径中 `状态引用.current.企业认证.公司` 入参。不增加 agency 创建控件；只正确
读取/展示服务端已有 agency Job。

实际 RED 直接锁 operation 传给数据源的 claim，而不是只锁 UI：

```ts
it('无 current relation 时只把未认证声明作为 direct claim', async () => {
  const 数据源 = { 创建岗位: vi.fn(async () => BFFOwnerJob样本) } as unknown as HTTP招聘数据源;
  const 操作 = 创建岗位操作(创建岗位测试依赖({
    数据源, 当前企业关系编号: null, 未认证公司声明: '示例客户公司',
  }));
  await 操作.发布岗位(页面岗位草稿);
  expect(数据源.创建岗位).toHaveBeenCalledWith(页面岗位草稿, {
    publisherMode: 'direct',
    hiringOrganizationClaim: { display_name: '示例客户公司', legal_name: null },
  });
  expect(JSON.stringify(数据源.创建岗位.mock.calls[0])).not.toMatch(/organization_ref|verification_status/);
});

it('更新岗位沿用 previous claim，不读取当前自由文本', async () => {
  await 操作.更新岗位('job_1', { ...页面岗位草稿, 公司: '篡改值' });
  expect(数据源.更新岗位).toHaveBeenCalledWith(
    'job_1', expect.anything(), BFFOwnerJob样本.revision, BFFOwnerJob样本,
  );
});
```

本 Task 的 `创建岗位测试依赖/页面岗位草稿/directVerifiedJob/directUnverifiedJob/agencyVerifiedPublisherJob` 都在对应
测试文件内以最小完整对象定义；复用 `src/测试/BFF样本.ts` 的基础样本，不能把名字当伪代码留在计划之外。

预期 RED：旧 `岗位映射上下文 {公司}` 仍在，或 request 能表达服务端专有 ref/status。

- [ ] **Step 2：实现 Job DTO 与纯映射**

`从BFF岗位` 保持现有页面岗位字段；publisher/hiring 投影留在同 ID server snapshot，并通过
`从BFF岗位发布方()` 产生页面展示模型：

```ts
发布方验证: dto.publisher_verification_status
发布方企业编号: dto.publisher_organization_ref ?? null
用人企业验证: dto.hiring_organization_verification_status
用人企业编号: dto.hiring_organization_ref ?? null
用人企业声明: dto.hiring_organization_claim
```

保持 owner server DTO 在 `后端状态.岗位快照`，避免把 refs 丢进旧静态字段后再猜。`转岗位创建` 只吃显式 claim；`转岗位补丁` 沿用 `previous` claim/mode。

映射实现保持为纯字段投影：

```ts
export function 从BFF岗位发布方(dto: BFFOwnerJob): 岗位发布方视图 {
  return {
    发布方模式: dto.publisher_mode,
    发布方验证: dto.publisher_verification_status,
    发布方企业编号: dto.publisher_organization_ref ?? null,
    用人企业验证: dto.hiring_organization_verification_status,
    用人企业编号: dto.hiring_organization_ref ?? null,
    用人企业声明: dto.hiring_organization_claim,
  };
}
```

owner Job runtime 不含 `publisher_profile`；Backend owner 页面中的发布人姓名/职务/头像必须另读当前
`从BFF招聘身份()` view，不能往 `BFFOwnerJob` 补不存在的字段。完成后重跑 Job 数据源/映射/operation 目标测试。
预期 GREEN：创建 claim、更新沿用 previous、owner Organization projection 全部 PASS，且没有 candidate Job consumer。

- [ ] **Step 3：保持 P4 candidate Job 边界**

本 Task 不增加 `GET /api/v1/jobs/{job_id}` consumer、`读取公开岗位()` 或 `公开岗位表`。当前候选入口仍来自静态
`市场列表`，已批准 Spec 把真实发现 API 放在 P4；P1C 内没有可提供真实 opaque Job ID 的入口。保留冻结后端 route
与 owner/candidate projection 知识在 Spec，待 P4 建立可达发现入口后再新增数据源与缓存。本 Task 的页面改造只消费
现有 owner snapshot，或在未接线演示域中显式不给 canonical ref。

- [ ] **Step 4：先写页面投影与导航测试**

覆盖 direct verified、direct unverified、agency verified publisher 三组：

- owner Backend 页面把当前 `从BFF招聘身份()` 的 public name/title/avatar/personal verification 与
  `从BFF岗位发布方()` 的 Organization projection 并列显示；不访问只属于 CandidateJob 的 `publisher_profile`；
- publisher Organization 与 hiring Organization 两行/两个状态不折叠；
- direct verified 两个 ref 可相同但仍来自两个明确字段；
- agency publisher verified 不把客户 hiring claim 标 verified；
- 有 `hiring_organization_ref` 时公司卡可点并导航 `/company/{opaque-id}`；
- 无 ref 时仍显示 claim+unverified，但元素不是 button/link，不创建 slug；
- owner `岗位详情` 使用 owner snapshot refs；Backend 不读取 `本公司键='yunqu'`；
- Mock `职位详情/岗位详情` 保持现有公司卡与静态路由；Backend owner `岗位详情` 才消费 owner snapshot refs。
- `职位详情/在谈详情/真人会话` 的公司名都来自未接线演示域，Backend 下没有 CandidateJob/canonical ref，因此
  公司槽只读不可点、不传 `按下`；Mock 仍按原 slug 导航。三屏分别用组件测试断言 Backend 不调用
  `路径.企业详情`，尤其不能把 `yunqu` 当 opaque Organization ID 请求。
- 上述三屏当前都渲染共享 `匹配对齐卡`。测试必须在接线前后断言该卡仍存在且仍位于现有职位条件段与公司区块之前；
  不允许恢复旧的页面内联“匹配度分析”表，也不允许借公司投影改动调整其 props、文案或样式。

扩展现有 `公司区块`，不另建第二个公司卡组件。新增并导出最小显式投影：

```ts
export interface 公司区块资料 {
  介绍段: string | null;
  元行组: readonly { 标签: string; 值: string }[];
}
```

在同文件导入 `公司档案` 类型，并把当前静态元行计算冻结为：

```ts
import { 公司路由键, 取公司档案, type 公司档案 } from '../数据/公司档案';

function 从静态档案构造元行组(
  档案: 公司档案,
  一行简介: string,
): readonly [string, string][] {
  const 档案未补全 = 档案.规模行 === '规模与融资信息待补充';
  const 简介段们 = (档案未补全 ? 一行简介 : 档案.规模行).split(' · ');
  const 认段 = (段: string) =>
    /轮|上市/.test(段) ? '融资阶段' : /人/.test(段) ? '规模' : '行业';
  const 成立年 = 档案.工商信息.find((条) => 条.项 === '成立日期')?.值.slice(0, 4);
  return 简介段们.length >= 2
    ? ([
        ...简介段们.map((段) => [认段(段), 段] as [string, string]),
        成立年 && !档案未补全 ? ['成立', `${成立年} 年`] : null,
        档案未补全 ? null : ['地址', 档案.地址],
      ].filter(Boolean) as [string, string][])
    : [];
}
```

`公司区块` 新增可选 `资料?: 公司区块资料` 和可选 `按下?: () => void`：

- `资料` 存在时只渲染调用方传入的介绍/元行，不调用 `公司路由键()` 或 `取公司档案()`；Backend 一律走此路径；
- `资料` 缺省时保持当前按名称读取静态档案的 Mock 行为和视觉；
- `按下` 存在时根元素保持 button；缺省时用同样 class 的非交互 div，不渲染尖括号、不带 `可点`，不得伪造链接；
- canonical ref 只决定 `按下` 是否存在，不根据公司名或 verification 文案猜 ref。

最小实现把共享内容只构造一次，同时把静态 lookup 与显式 Backend 投影分开：

```tsx
const 静态档案 = 资料 ? null : 取公司档案(公司路由键(名称));
const 档案未补全 = 静态档案?.规模行 === '规模与融资信息待补充';
const 介绍段 = 资料?.介绍段 ?? (档案未补全 ? null : 静态档案?.简介[0] ?? null);
const 元行组: readonly [string, string][] = 资料
  ? 资料.元行组.map(({ 标签, 值 }) => [标签, 值] as const)
  : 从静态档案构造元行组(静态档案!, 一行简介);

const 内容 = (
  <>
    <span className={样式.头行}>
      {标志 ?? (
        <公司字标 首字={首字} 尺寸={40} 圆角={14} 底色="var(--墨)"
          字色="var(--橄榄)" 描边={false} 字号={17} />
      )}
      <span className={`${样式.名称} 单行`}>{名称}</span>
      {按下 ? <span className={样式.尖括号}>›</span> : null}
    </span>
    {介绍段 ? <span className={样式.介绍段}>{介绍段}</span> : null}
    {元行组.length > 0 ? (
      <span className={样式.元表}>
        {元行组.map(([标, 值]) => (
          <span key={标} className={样式.元行}>
            <span className={样式.元标}>{标}</span>
            <span className={`${样式.元值} 单行`}>{值}</span>
          </span>
        ))}
      </span>
    ) : <span className={样式.兜底简介}>{一行简介}</span>}
    {children}
  </>
);
return 按下
  ? <button className={`${样式.区块} 可点`} onClick={按下}>{内容}</button>
  : <div className={样式.区块}>{内容}</div>;
```

该私有函数只在 `资料` 缺省的 Mock 分支调用。同步把 props 中 `按下` 改为可选，并增加
`资料?: 公司区块资料`。

`公司区块.test.tsx` 先覆盖注入资料不读取静态档、无 `按下` 时没有 button/link、以及旧 Mock props 仍可点击并
显示静态档案。各页面测试再证明传入的资料/ref 来自映射后的 owner/candidate view，而不是 JSX 直接解释 DTO；
职位详情、在谈详情和真人会话的测试同时保留现有 `匹配对齐卡` 断言。

实际 RED 固定组件的交互语义：

```tsx
it('显式资料且无 canonical ref 时不读取静态档也不伪造按钮', () => {
  render(<公司区块 名称="声明公司" 首字="声" 一行简介="" 资料={{
    介绍段: null, 元行组: [{ 标签: '核验', 值: '未认证声明' }],
  }} />);
  expect(mock取公司档案).not.toHaveBeenCalled();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
});

it.each([
  ['direct verified', directVerifiedJob],
  ['direct unverified', directUnverifiedJob],
  ['agency verified publisher', agencyVerifiedPublisherJob],
])('%s 分开显示 publisher 与 hiring', (_name, dto) => {
  const view = 从BFF岗位发布方(dto);
  render(<岗位发布方区 view={view} />);
  expect(screen.getByTestId('publisher-status')).toHaveTextContent(view.发布方验证);
  expect(screen.getByTestId('hiring-status')).toHaveTextContent(view.用人企业验证);
});
```

预期 RED：共享卡强制 button/静态 lookup，或页面把 publisher/hiring 合成一行。完成后重跑 Step 4 组件/页面测试；
预期 GREEN：三组矩阵、canonical ref 导航、no-ref 非交互、owner/Mock 来源隔离全部 PASS。

`岗位发布方区` 不新建文件：在 `src/屏幕/岗位详情.tsx` 内声明并导出
`function 岗位发布方区({view, 身份}: {view: 岗位发布方视图; 身份: 招聘身份视图}): JSX.Element`，沿用该页
现有 class；测试从该文件导入。它只渲染两个 view，不读 DTO/Context，也不抽成通用组件。

- [ ] **Step 5：实现 public Organization 页面**

Backend `企业详情` 把 route param 仅当 opaque ID，进入时调用 `操作.读取公开企业(id)`；把
`公开企业表[id]` 先交给 `从BFF公开企业()`，JSX 只显示独立 `公开企业视图` 的 legal/display identity、
`verified_at`、Profile 七个已批准分区、public media、active verified job count。不得调用 `公司路由键()`、
`取公司档案()` 或补静态字段；Backend 不渲染线上无来源的企业文化、发展历程、在职感受、代理风格、代理核对，
也不得显示 registry key、domains、affiliations、evidence 或 object coordinate。

404 显示真实不存在/不可用空态；suspended Organization 不从静态表回退。Mock 分支继续按原 slug 渲染。

Backend effect 只以 opaque route param 读 operation，并以缓存 DTO 的映射结果渲染：

```tsx
useEffect(() => {
  if (数据源模式 === 'backend' && 键) void 操作.读取公开企业(键);
}, [数据源模式, 键, 操作]);
const 公开企业 = 状态.公开企业表[键];
const view = 公开企业 ? 从BFF公开企业(公开企业) : null;
if (数据源模式 === 'backend') return view
  ? <Backend企业公开页 view={view} />
  : <企业公开页空态 />;
```

`Backend企业公开页` 与 `企业公开页空态` 都是 `src/屏幕/企业详情.tsx` 内的局部函数，不增加文件：前者签名为
`function Backend企业公开页({view}: {view: 公开企业视图}): JSX.Element`，后者为
`function 企业公开页空态(): JSX.Element`；两者复用 `企业详情.module.css`，测试通过默认页面入口覆盖。

预期 GREEN：Backend public page 测试证明 route param 原样请求、线上七分区渲染、404/suspended 无 Mock 回退。

- [ ] **Step 6：验证并提交**

```bash
npx vitest run src/数据/HTTP招聘数据源.test.ts src/数据/后端映射.test.ts src/状态/后端/岗位操作.test.ts src/组件/公司区块.test.tsx src/屏幕/发布岗位.test.tsx src/屏幕/岗位详情.test.tsx src/屏幕/职位详情.test.tsx src/屏幕/企业详情.test.tsx src/屏幕/在谈详情.test.tsx src/屏幕/真人会话.test.tsx
npm run typecheck
npm run lint
git add src/数据 src/状态 src/组件/公司区块.tsx src/组件/公司区块.test.tsx src/屏幕/发布岗位.tsx src/屏幕/发布岗位.test.tsx src/屏幕/岗位详情.tsx src/屏幕/岗位详情.test.tsx src/屏幕/职位详情.tsx src/屏幕/职位详情.test.tsx src/屏幕/企业详情.tsx src/屏幕/企业详情.test.tsx src/屏幕/在谈详情.tsx src/屏幕/在谈详情.test.tsx src/屏幕/真人会话.tsx src/屏幕/真人会话.test.tsx
git commit -m "feat(recruitment): project verified job organizations"
```

---

## Task 6：Mock/Intercepted Backend E2E 与前端验证收口

**文件：**

- 修改：`e2e/数据源模式.spec.ts`
- 修改：`e2e/onboarding.spec.ts`
- 修改：`README.md`

**Interfaces:**

- Consumes: Task 1–5 已提交的页面、operation 和 fixture；现有 `安装BFF路由(page, handlers)`、
  `playwright.config.ts`、`playwright.数据源模式.config.ts` 与固定 16 个视觉 scene ID。
- Produces: Mock 与 intercepted Backend 两套可重复 Playwright evidence、更新后的 README，以及完成 code review 和
  分支收口所需的干净前端提交。intercepted E2E 只证明前端边界，不得记为真实 Backend 联调。

- [ ] **Step 1：先加 `@mock` 与 `@backend` RED**

扩展普通/数据源模式 Playwright：

- Mock 招聘方仍从身份选择进入招聘名片，不强插 Backend identity flow；
- 发岗、公司档案分区、候选端静态公司页视觉/导航保持；
- Mock 图片继续使用本地预览；
- 不要求 Mock fixture 拥有 opaque Organization ID。

基线视觉回归已有固定 `recruiter-card` 和发岗场景。保持 `e2e/视觉回归/场景.ts` 的 16 个 scene ID 与现有
Mock selector，不为 P1C 增加 Backend 视觉场景，也不通过修改 ready/selector 掩盖产品漂移；Backend 行为仍由本
Task 的数据源模式 Playwright 验证。

复用 `安装BFF路由` helper，按请求顺序安装：

1. session/principal/recruiter profile；
2. affiliations → current public Organization（响应已含 profile）；
3. owner Jobs；
4. 进入身份屏后再安装/断言 admin requests；
5. profile patch/avatar；
6. company profile/media/204 delete；
7. 直接读取 public Organization；不安装尚无可达入口的 candidate Job route。

覆盖：

- 多关系不猜、选择后刷新恢复；
- member 只读、admin 可写；
- unverified claim 可发岗且 request 无 ref/status；
- direct/agency publisher/hiring 状态不折叠；
- media FormData key/metadata purpose；
- 409 草稿保留并需要人工再次保存；
- no-ref claim 公司卡不可点；
- Backend route 失败时没有 Mock 公司内容。

实际测试必须先失败，并保留现有标签/端口配置：

```ts
test('招聘 Organization 全链路使用 HTTP fixture 且不泄漏可信字段 @backend', async ({ page }) => {
  const 请求们: { path: string; method: string; body: unknown }[] = [];
  await 安装BFF路由(page, {
    登录尝试id: 'att-p1c-org', 记录目录请求: () => undefined,
    请求拦截: (request) => 请求们.push(request),
    招聘组织Fixture: P1C招聘组织Fixture,
  });
  await page.goto('/');
  await page.getByRole('button', { name: '我要招人' }).click();
  await expect(page.getByText(P1C招聘组织Fixture.profile.public_name)).toBeVisible();
  await page.getByLabel('公司').fill('未认证客户公司');
  await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
  const create = 请求们.find((item) => item.path === '/api/v1/recruiter/jobs' && item.method === 'POST')!;
  expect(JSON.stringify(create.body)).not.toMatch(/organization_ref|verification_status|affiliation/);
});

test('Mock 招聘剧情不请求 BFF @mock', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
  });
  await page.goto('/');
  await 进入Mock招聘名片(page);
  await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible();
  expect(apiRequests).toEqual([]);
});
```

运行新增标题：

```bash
npm run test:e2e:data-source -- --grep 'P1C|Organization|招聘剧情'
```

预期 RED：Organization fixture/route、页面控件或无 ref 行为尚未接入；不得通过删除断言、伪造 Mock opaque ID 或把
`page.route` 称为真实后端来转绿。

- [ ] **Step 2：实现最小 E2E fixture 与恢复矩阵**

只扩展现有 `BFF路由选项/安装BFF路由`，不新建第二套 route harness。multipart 的请求拦截不能用 JSON parser：
按 `request.postDataBuffer()` 与 `content-type` boundary 检查 `metadata/media/evidence` part 名，敏感正文只在测试进程内
比较，不写日志或 snapshot。409 覆盖沿用现有 `覆盖` seam；响应仍经过标准 BFF 信封。

fixture 测试标题继续带 `@backend`，README 明确它只验证前端边界，不宣称真实 BFF 联调。

运行：

```bash
npm run test:e2e
npm run test:e2e:data-source
```

预期 GREEN：普通 Playwright 与 data-source Playwright 全部退出码 0；`@backend` 证据只标 intercepted boundary，
`@mock` 保持零 API。

- [ ] **Step 3：更新 README 并提交前端测试**

README 记录 Backend/Mock 运行方式和 `@backend` 的 intercepted 性质，明确 data-source Playwright 不启动、不修改也不
验证真实后端服务。

```bash
git add e2e README.md
git commit -m "test(recruitment): verify P1C frontend candidate"
```

- [ ] **Step 4：运行完整前端验证并完成 review**

运行完整前端验证：

```bash
npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e && npm run test:e2e:data-source && UI_VISUAL_GATE=enforce npm run ui:check -- --base c836f301f07d6e6693e125ea66b8855cd975ec31
```

预期 GREEN：复合命令退出码 0，随后 `git status --short` 为空。失败则使用
`superpowers:systematic-debugging` 找根因，新增修复提交并从头重跑整条复合命令。

验证通过后使用 `superpowers:requesting-code-review`。修复所有有效发现，运行受影响的定向测试，并再次运行上述完整
前端验证。最后使用 `superpowers:finishing-a-development-branch` 选择合并、PR、保留或丢弃实现分支。本计划到前端
实现分支验证与收口为止。

---

## Spec 覆盖矩阵

| Spec 成功标准 | 实现任务 | 核验证据 |
|---|---:|---|
| 固定 recruiter hydration | 2 | operation/provider 顺序与 stale-response tests |
| personal / affiliation / organization 分离 | 2–3 | reducer + identity screen tests |
| unverified claim 仍可发岗 | 2、5 | request body test + Backend E2E |
| direct/agency publisher 与 hiring 分离 | 5 | mapping/component matrix |
| admin 写、member 读 | 4 | permission component + BFF refusal recovery |
| canonical ref 才可进公司页 | 5 | no-ref navigation tests |
| 401/409/503/revoked/suspended/media 诚实恢复 | 2、4、5 | operation tests + Backend E2E |
| Mock 视觉/路径保持 | 3–6 | Mock Vitest/Playwright + enforce UI regression |
| private evidence/token/subject/object key 不泄漏 | 1、3、4 | strict decoder + storage/action tests |
| deterministic frontend verification | 6 | unit/component + Playwright + data-source + UI regression |

## 刻意不做

- 企业邮箱 challenge、可信个人 KYC、人脸 SDK；
- 邀请创建/分享、roster、成员管理、部门/席位/RBAC；
- agency 创建 UI 或客户代理授权；
- Organization 拥有/共享 Job、候选人或 MatchCase；
- 图片 crop/resize/thumbnail/WebP/CDN、通用 DAM、后台 GC；
- P2–P8 领域、市场/推荐/消息真实 API；
- 新状态库、Query 框架、schema generator、第二个 Context、设计系统/CSS 重构；
- 为没有 canonical ref 的 claim 创建静态 Organization 页面；
- 修改、启动、部署或测试 `~/agxp-monorepo` 的后端代码和本地运行栈；
- 真实跨仓库联调、后端 fixture 或后端 contract 修复；这些由独立集成工作承担。

这些能力只有出现冻结后端 route、明确产品需求或可测量故障后才重新规划。
