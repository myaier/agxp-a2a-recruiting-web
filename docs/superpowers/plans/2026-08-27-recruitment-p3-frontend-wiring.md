# Recruitment P3 Frontend Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing P3 candidate privacy and recruiter job-hard-requirement UI to the frozen Recruitment BFF contracts without changing existing PM copy or adding backend work.

**Architecture:** Extend the existing browser-contract facades and the single `src/状态/后端` lifecycle. Candidate privacy is one server snapshot shared by Settings, Disclosure Preferences, and Blocklist; organization search stays local to a query hook. Job hard requirements remain a separate typed whole object in the existing Job DTO/mapping/form path rather than being collapsed into legacy string conditions.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Testing Library, Playwright, existing hand-written strict BFF decoders and CSS Modules.

**Spec:** `docs/superpowers/specs/2026-08-27-recruitment-p3-frontend-wiring-design.md`

## Global Constraints

- Frontend baseline is `eaa561e6a9d76c874804627b4e9a32c71c03419b`; the approved design commit is `3e90542`.
- Backend is read-only `~/agxp-monorepo` `origin/release/0.2.5@a3d725473`; do not modify, start, or test the backend as part of this plan.
- Do not edit existing user-visible titles, section names, option names, buttons, helper text, navigation, or CSS tokens. Necessary new controls reuse existing PM vocabulary and component/CSS primitives.
- Backend mode must never fall back to Mock privacy, blocklist, organization, or job facts. Mock mode must not make `/api/v1` calls.
- Browser wire fields stay `snake_case`; every new response decoder rejects missing required fields, unknown fields, invalid enums, null arrays, and trailing/invalid envelope shapes already rejected by the shared client.
- Privacy writes use the current privacy revision as quoted `If-Match`; AddBlock additionally uses one Idempotency-Key per user intent and the existing client reuses it for its single controlled retry.
- Never place an Idempotency-Key in a URL, log, UI state, or browser storage. Do not persist Privacy snapshots, organization search results, selected organizations, or cursors to `localStorage`/`sessionStorage`.
- Do not add a state library, React Context, query framework, schema generator, network client, design system, generic search abstraction, or CSS refactor.
- Job `hard_requirements` is a complete four-member object. Backend reads fail closed on missing/invalid members; every current Mock fixture names all four values explicitly.
- If the existing PM vocabulary and component primitives cannot express all three hard-requirement states without changing approved copy or collapsing `unknown` with `not_required`, stop and report the concrete conflict before editing UI.
- Every task follows RED → minimal GREEN → focused verification → commit. Do not combine tasks before their focused tests pass.

---

## File Structure Map

### New files

- `src/数据/招聘数据源/隐私.ts` — four Privacy routes, strict decode, revision headers, receipt decode.
- `src/数据/招聘数据源/隐私.test.ts` — route and closed-contract tests for Privacy.
- `src/数据/隐私映射.ts` — wire-to-page privacy/block/disclosure mapping and reverse display-value mapping.
- `src/数据/隐私映射.test.ts` — fixed S1 rows, configurable D3–D5, source grouping, no-copy-drift tests.
- `src/状态/后端/隐私操作.ts` — privacy snapshot owner, CAS/idempotency/reconciliation, candidate organization search operation.
- `src/状态/后端/隐私操作.test.ts` — state mutation and recovery behavior.
- `src/屏幕/组织查询钩子.ts` — debounced local query generation, pagination, stale-response discard.
- `src/屏幕/组织查询钩子.test.ts` — debounce, reset, page merge, stale response tests.
- `src/屏幕/设置.test.tsx`
- `src/屏幕/披露偏好.test.tsx`
- `src/屏幕/屏蔽名单.test.tsx`
- `src/屏幕/企业披露策略.test.tsx`

### Existing files with focused changes

- `src/数据/BFF契约.ts` — Privacy/Search/HardRequirements wire types and Job fields.
- `src/数据/招聘数据源类型.ts` — page privacy snapshot and organization-search query types.
- `src/数据/招聘数据源/组织.ts` + `.test.ts` — candidate organization search.
- `src/数据/招聘数据源/岗位.ts` + `.test.ts` — validate complete hard requirements on authoritative OwnerJob reads.
- `src/数据/HTTP招聘数据源.ts` + `.test.ts` — compose the seventh Privacy facade.
- `src/数据/后端映射.ts` + `.test.ts` — Job hard-requirement mapping.
- `src/数据/类型.ts` — stable block/source fields and typed job hard facts.
- `src/数据/模拟数据.ts` — reuse the unchanged disclosure template and add explicit Mock block metadata.
- `src/测试/BFF样本.ts` — authoritative Privacy/Search/HardRequirements fixtures.
- `src/状态/领域/隐私设置.ts` — backend hydration/clear actions while retaining Mock reducer actions.
- `src/状态/后端/类型.ts` — privacy server snapshot and operations.
- `src/状态/后端/会话操作.ts` + `.test.ts` — candidate privacy hydration and all-account cleanup.
- `src/状态/初始状态.ts` — remove Mock privacy facts from Backend seed.
- `src/状态/应用状态.tsx` + `src/状态/应用状态.test.ts` — compose privacy operations and initialize snapshot state.
- `src/组件/通用.tsx` — optional semantic disablement for the existing switch, with no visual/copy change.
- `src/屏幕/设置.tsx`, `披露偏好.tsx`, `屏蔽名单.tsx`, `企业披露策略.tsx` — mode-aware wiring without copy edits.
- `src/屏幕/发布岗位.tsx` + `.test.tsx` + `.module.css` — four tri-state hard facts using the existing hard-condition section.
- `e2e/数据源模式.spec.ts` — P3 mutable fixture and Backend/Mock boundary scenarios.

---

### Task 1: Freeze P3 Browser Contracts and Data Facades

**Files:**
- Modify: `src/数据/BFF契约.ts`
- Modify: `src/数据/招聘数据源类型.ts`
- Create: `src/数据/招聘数据源/隐私.ts`
- Create: `src/数据/招聘数据源/隐私.test.ts`
- Create: `src/数据/隐私映射.ts`
- Create: `src/数据/隐私映射.test.ts`
- Modify: `src/数据/招聘数据源/组织.ts`
- Modify: `src/数据/招聘数据源/组织.test.ts`
- Modify: `src/数据/招聘数据源/岗位.ts`
- Modify: `src/数据/招聘数据源/岗位.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`
- Modify: `src/数据/后端映射.ts`
- Modify: `src/数据/后端映射.test.ts`
- Modify: `src/数据/类型.ts`
- Modify: `src/数据/模拟数据.ts`
- Modify: `src/测试/BFF样本.ts`
- Modify: `src/状态/领域/隐私设置.ts` — keep Mock-created blocks compatible with the new required metadata.

**Interfaces:**
- Consumes: `BFF请求选项`, `BFF响应`, `创建BFF客户端()` behavior, existing `组织数据源`, `岗位数据源`, `从BFF岗位()`, `转岗位创建()`, and `转岗位补丁()`.
- Produces:
  - `隐私数据源` with the exact methods below.
  - `组织数据源.搜索组织(query: 组织搜索查询): Promise<BFF组织搜索页>`.
  - `从BFF隐私(dto: BFF隐私快照): 页面隐私快照`, `披露档到BFF(档: 披露档): BFF披露档`, `披露编号到BFF(id): keyof BFF披露偏好`, and `从BFF硬性条件(dto: BFF硬性条件): 岗位硬性事实`.
  - `BFF硬性条件` present in `BFFOwnerJob`, `BFFCandidateJob`, `BFF岗位创建`, and `BFF岗位补丁`.

```ts
interface 隐私数据源 {
  读取隐私(): Promise<页面隐私快照>;
  修改隐私(patch: BFF隐私补丁, revision: number): Promise<页面隐私快照>;
  添加组织屏蔽(organizationId: string, source: BFF屏蔽来源, revision: number): Promise<BFF隐私屏蔽回执>;
  解除组织屏蔽(organizationId: string, riskAcknowledged: boolean, revision: number): Promise<页面隐私快照>;
}
```

- [ ] **Step 1: Add failing wire and mapping tests**

Create `src/数据/招聘数据源/隐私.test.ts` with exact request assertions:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import { BFF隐私视图样本, BFF屏蔽回执样本 } from '../../测试/BFF样本';
import { 创建隐私数据源 } from './隐私';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

describe('隐私数据源', () => {
  const 请求Mock = vi.fn();
  const 数据源 = 创建隐私数据源(请求Mock as unknown as 请求函数);
  beforeEach(() => 请求Mock.mockReset());

  it('GET/PATCH 使用完整 Privacy View 和 quoted revision', async () => {
    请求Mock
      .mockResolvedValueOnce({ result: BFF隐私视图样本, etag: '"2"', requestId: 'r1' })
      .mockResolvedValueOnce({ result: { ...BFF隐私视图样本, revision: 3 }, etag: '"3"', requestId: 'r2' });
    await 数据源.读取隐私();
    await 数据源.修改隐私({ employer_privacy_enabled: false }, 2);
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: '/api/v1/me/privacy' },
      { path: '/api/v1/me/privacy', method: 'PATCH', body: { employer_privacy_enabled: false }, ifMatch: '"2"' },
    ]);
  });

  it('AddBlock 使用幂等键并接受 200/201 receipt shape', async () => {
    请求Mock.mockResolvedValue({ result: BFF屏蔽回执样本, etag: '"3"', requestId: 'r3' });
    await expect(数据源.添加组织屏蔽('org_1', 'manual', 2)).resolves.toEqual(BFF屏蔽回执样本);
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/me/privacy/organization-blocks', method: 'POST',
      body: { organization_id: 'org_1', source: 'manual' }, ifMatch: '"2"', 幂等: true,
    });
  });

  it('拒绝 null blocks、未知 source、缺 updated_at 和私有字段', async () => {
    for (const result of [
      { ...BFF隐私视图样本, organization_blocks: null },
      { ...BFF隐私视图样本, updated_at: undefined },
      { ...BFF隐私视图样本, organization_blocks: [{ ...BFF隐私视图样本.organization_blocks[0], source: 'other' }] },
      { ...BFF隐私视图样本, subject_id: 'private' },
    ]) {
      请求Mock.mockResolvedValueOnce({ result, etag: null, requestId: 'bad' });
      await expect(数据源.读取隐私()).rejects.toMatchObject({ code: 'invalid_response' });
    }
  });

  it('拒绝 receipt 私有字段', async () => {
    请求Mock.mockResolvedValueOnce({
      result: { ...BFF屏蔽回执样本, subject_id: 'private' }, etag: null, requestId: 'bad-receipt',
    });
    await expect(数据源.添加组织屏蔽('org_1', 'manual', 2))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });
});
```

Extend `组织.test.ts`, `岗位.test.ts`, `后端映射.test.ts`, and `HTTP招聘数据源.test.ts` with these concrete cases, placing each case beside the facade or mapper it exercises:

```ts
it('candidate organization search encodes q/cursor and strictly decodes the three public fields', async () => {
  请求Mock.mockResolvedValueOnce({
    result: { items: [{ organization_id: 'org_1', display_name: 'Acme', legal_name: 'Acme Ltd' }], next_cursor: null },
    etag: null, requestId: 'r-search',
  });
  await expect(数据源.搜索组织({ q: 'Acme & Co', limit: 20, cursor: 'abc_DEF-12' })).resolves.toMatchObject({
    items: [{ organization_id: 'org_1' }], next_cursor: null,
  });
  expect(请求Mock.mock.calls[0][0]).toEqual({
    path: '/api/v1/organizations?q=Acme%20%26%20Co&limit=20&cursor=abc_DEF-12',
  });
});

it('hard_requirements complete object round-trips through owner mapping and writes', () => {
  const dto = { ...BFF岗位样本, hard_requirements: {
    alternate_weekend_work: 'required', outsourcing_only: 'not_required',
    onsite_only: 'unknown', frequent_travel: 'required',
  } } as const;
  const 页面 = 从BFF岗位(dto, {});
  expect(页面.硬性事实).toEqual({ 大小周: '必须', 纯外包乙方: '不要求', 全现场办公: '未说明', 频繁出差: '必须' });
  expect(转岗位创建(页面, 直接发岗上下文('Acme')).hard_requirements).toEqual(dto.hard_requirements);
  expect(转岗位补丁(页面, dto).hard_requirements).toEqual(dto.hard_requirements);
});

it('candidate DTO reuses the same hard-requirement mapping without adding a network consumer', () => {
  expect(从BFF硬性条件(BFF候选岗位样本.hard_requirements)).toEqual({
    大小周: '必须', 纯外包乙方: '不要求', 全现场办公: '未说明', 频繁出差: '必须',
  });
});
```

In the same RED step, add table cases proving Organization Search rejects an extra item field, `items:null`, missing `next_cursor`, a trimmed-empty/201-code-point `q`, `limit=0/51/non-integer`, and a 4097-byte cursor. Add OwnerJob read cases whose `hard_requirements` is missing each member in turn, has one unknown enum, or has one extra member; all must reject with `invalid_response` before state or mapping sees the DTO. Define `BFF候选岗位样本` with `satisfies BFFCandidateJob` and use it only in the pure shared-mapping test above; do not add a CandidateJob request method before P4 has a consumer.
In `隐私映射.test.ts`, assert all three configurable fields in both directions (`D-03↔current_employer`, `D-04↔education`, `D-05↔portfolio_links`), both derived block sources and manual grouping metadata, and a literal snapshot of all seven existing disclosure names/descriptions/options so moving the template cannot rewrite PM copy.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run src/数据/招聘数据源/隐私.test.ts src/数据/招聘数据源/组织.test.ts src/数据/招聘数据源/岗位.test.ts src/数据/隐私映射.test.ts src/数据/后端映射.test.ts src/数据/HTTP招聘数据源.test.ts
```

Expected: FAIL because `创建隐私数据源`, `搜索组织`, Privacy/CandidateJob DTOs, `硬性事实`, and `hard_requirements` do not exist.

- [ ] **Step 3: Add the exact P3 types**

Add these wire types to `BFF契约.ts`:

```ts
export type BFF披露档 = 'never' | 'resume_submission' | 'anonymous';
export type BFF屏蔽来源 = 'current_employer' | 'related_organization' | 'manual';
export type BFF硬性要求档 = 'required' | 'not_required' | 'unknown';

export interface BFF披露偏好 {
  current_employer: BFF披露档;
  education: BFF披露档;
  portfolio_links: BFF披露档;
}
export interface BFF隐私组织屏蔽 {
  organization_id: string;
  organization_display_name: string;
  organization_status: 'active' | 'suspended';
  source: BFF屏蔽来源;
  created_at: string;
}
export interface BFF隐私视图 {
  employer_privacy_enabled: boolean;
  disclosure_preferences: BFF披露偏好;
  organization_blocks: BFF隐私组织屏蔽[];
  revision: number;
  updated_at: string;
}
export type BFF隐私快照 = Pick<BFF隐私视图,
  'employer_privacy_enabled' | 'disclosure_preferences' | 'organization_blocks' | 'revision'>;
export interface BFF隐私补丁 {
  employer_privacy_enabled?: boolean;
  disclosure_preferences?: Partial<BFF披露偏好>;
}
export interface BFF隐私屏蔽回执 {
  organization_block: BFF隐私组织屏蔽;
  privacy_revision: number;
  created_at: string;
}
export interface BFF组织搜索项 { organization_id: string; display_name: string; legal_name: string }
export interface BFF组织搜索页 { items: BFF组织搜索项[]; next_cursor: string | null }
export interface BFF硬性条件 {
  alternate_weekend_work: BFF硬性要求档;
  outsourcing_only: BFF硬性要求档;
  onsite_only: BFF硬性要求档;
  frequent_travel: BFF硬性要求档;
}

export interface BFFCandidateJob extends Omit<BFFOwnerJob,
  'publisher_mode' | 'publisher_affiliation_ref' | 'private_screening_preferences' | 'status'> {
  publisher_profile?: {
    public_name: string;
    title: string;
    personal_verification_status: 'unverified' | 'verified';
    avatar_url?: string | null;
  };
  status: 'active';
  hard_requirements: BFF硬性条件;
}
```

Add `hard_requirements: BFF硬性条件` to `BFFOwnerJob`; add optional `hard_requirements?: BFF硬性条件` to `BFF岗位创建`, while `BFF岗位补丁 = Partial<BFF岗位创建>` inherits the whole-object patch. Keep CandidateJob owner-private omissions explicit in its `Omit` list; do not weaken it to an index signature.

Add domain types to `数据/类型.ts`:

```ts
export type 屏蔽来源 = '当前雇主' | '关联公司' | '手动添加';
export type 硬性事实档 = '必须' | '不要求' | '未说明';
export interface 岗位硬性事实 {
  大小周: 硬性事实档;
  纯外包乙方: 硬性事实档;
  全现场办公: 硬性事实档;
  频繁出差: 硬性事实档;
}
export const 空岗位硬性事实: 岗位硬性事实 = {
  大小周: '未说明', 纯外包乙方: '未说明', 全现场办公: '未说明', 频繁出差: '未说明',
};
```

Extend `屏蔽项` with `组织编号: string`, `来源: 屏蔽来源`, `组织状态: '有效' | '已停用'`; extend `披露项` with `可修改?: boolean`; extend `在招岗位` with `硬性事实?: 岗位硬性事实`.

- [ ] **Step 4: Implement mapping and strict data sources**

In `隐私映射.ts`, keep the existing seven disclosure rows byte-for-byte, move their common template out of `模拟数据.ts`, re-export that template from `模拟数据.ts` for existing imports, and map only D3–D5 from the server:

```ts
const 披露档映射 = { never: '不披露', resume_submission: '意向确认后', anonymous: '一直允许' } as const;
const 披露档反向 = { 不披露: 'never', 意向确认后: 'resume_submission', 一直允许: 'anonymous' } as const;
const 来源映射 = { current_employer: '当前雇主', related_organization: '关联公司', manual: '手动添加' } as const;
const 披露字段映射 = { 'D-03': 'current_employer', 'D-04': 'education', 'D-05': 'portfolio_links' } as const;

export function 披露档到BFF(档: 披露档): BFF披露档 { return 披露档反向[档]; }
export function 披露编号到BFF(id: keyof typeof 披露字段映射): keyof BFF披露偏好 { return 披露字段映射[id]; }
export function 屏蔽来源到BFF(来源: 屏蔽来源): BFF屏蔽来源 {
  return 来源 === '当前雇主' ? 'current_employer' : 来源 === '关联公司' ? 'related_organization' : 'manual';
}

export function 从BFF隐私(服务端: BFF隐私快照): 页面隐私快照 {
  const 值表 = {
    'D-03': 披露档映射[服务端.disclosure_preferences.current_employer],
    'D-04': 披露档映射[服务端.disclosure_preferences.education],
    'D-05': 披露档映射[服务端.disclosure_preferences.portfolio_links],
  } as const;
  return {
    对现雇主隐身: 服务端.employer_privacy_enabled,
    披露偏好: 隐私披露模板.map((项) => ({
      ...项,
      档: 项.编号 in 值表 ? 值表[项.编号 as keyof typeof 值表] : 项.档,
      可修改: ['D-03', 'D-04', 'D-05'].includes(项.编号),
    })),
    屏蔽名单: 服务端.organization_blocks.map((块) => ({
      编号: 块.organization_id, 组织编号: 块.organization_id,
      名称: 块.organization_display_name, 首字: 块.organization_display_name.charAt(0),
      来源: 来源映射[块.source], 组织状态: 块.organization_status === 'active' ? '有效' : '已停用',
      理由: 块.source === 'manual' ? '你手动加入 · 双向不可见'
        : 块.source === 'current_employer' ? '当前雇主 · 建档时自动屏蔽' : '当前雇主关联公司 · 自动屏蔽',
      时间: 块.created_at.slice(0, 10),
    })),
    服务端,
  };
}
```

`隐私.ts` must define local exact-key guards, strictly require wire `updated_at`, project the four page-owned fields into `BFF隐私快照`, and return `从BFF隐私()`; the page snapshot deliberately drops `updated_at`. AddBlock returns the strict receipt; Unblock returns `页面隐私快照`. `组织.ts` rejects a query when `Array.from(q.trim()).length` is outside 1–200, a non-integer `limit` is outside 1–50, or `new TextEncoder().encode(cursor).byteLength` exceeds 4096; it adds a strict three-field item decoder and builds query parameters in `q`, `limit`, `cursor` order. `岗位.ts` validates `hard_requirements` only on the authoritative OwnerJob pages returned by `读取岗位()`; create/PATCH already discard their response body and immediately call `读取岗位()`, so do not add duplicate hard-requirement validation there. Export `从BFF硬性条件()` from `后端映射.ts`, use it for OwnerJob mapping, and test the same pure helper with a `BFFCandidateJob` fixture so a future P4 consumer does not invent a second enum mapping. Do not add `GET /api/v1/jobs/{id}` or a CandidateJob decoder in P3.

In `后端映射.ts`, add explicit two-way tables:

```ts
const 后端到硬性事实档 = { required: '必须', not_required: '不要求', unknown: '未说明' } as const;
const 硬性事实档到后端 = { 必须: 'required', 不要求: 'not_required', 未说明: 'unknown' } as const;
```

Map all four members in `从BFF岗位`, `转岗位创建`, and `转岗位补丁`; do not use `?? unknown` on Backend DTOs.

- [ ] **Step 5: Compose the facade and update fixtures**

Define in `招聘数据源类型.ts`:

```ts
export interface 页面隐私快照 {
  对现雇主隐身: boolean;
  披露偏好: 披露项[];
  屏蔽名单: 屏蔽项[];
  服务端: BFF隐私快照;
}
export interface 组织搜索查询 { q: string; limit?: number; cursor?: string }
```

Make `HTTP招聘数据源` the intersection of the existing six facades plus `隐私数据源`, and spread `创建隐私数据源(请求)` in `创建HTTP招聘数据源`. Update all BFF OwnerJob fixtures to include complete `hard_requirements`; add a type-checked CandidateJob fixture plus distinct wire `BFF隐私视图样本` (contains `updated_at`) and page `BFF隐私快照样本` (the four-field projection), and add Search fixtures with no real personal data. Set Mock B-01 source to `当前雇主`, B-02 to `关联公司`, B-03 and the `拉黑` reducer-created block to `手动添加`; give each an explicit synthetic `组织编号` and `组织状态='有效'`. Give D1/D2/D6/D7 `可修改=false` and D3–D5 `可修改=true` in the shared disclosure template. Preserve every existing displayed string.

- [ ] **Step 6: Run Task 1 tests and commit**

Run:

```bash
npx vitest run src/数据/招聘数据源/隐私.test.ts src/数据/招聘数据源/组织.test.ts src/数据/招聘数据源/岗位.test.ts src/数据/隐私映射.test.ts src/数据/后端映射.test.ts src/数据/HTTP招聘数据源.test.ts
npm run typecheck
```

Expected: PASS; TypeScript proves every OwnerJob fixture now names all four hard requirements.

Commit:

```bash
git add src/数据 src/测试/BFF样本.ts src/状态/领域/隐私设置.ts
git commit -m "feat: add p3 browser contracts"
```

---

### Task 2: Own Privacy Snapshot, Hydration, CAS, and Reconciliation

**Files:**
- Create: `src/状态/后端/隐私操作.ts`
- Create: `src/状态/后端/隐私操作.test.ts`
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/后端/会话操作.test.ts`
- Modify: `src/状态/领域/隐私设置.ts`
- Modify: `src/状态/初始状态.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: Task 1 `页面隐私快照`, `BFF隐私快照`, `BFF隐私补丁`, `BFF组织搜索页`, `屏蔽来源`, and facade methods.
- Produces `隐私操作`:

```ts
interface 隐私操作 {
  设置雇主隐私(enabled: boolean): Promise<void>;
  设置披露偏好(id: 'D-03' | 'D-04' | 'D-05', 档: 披露档): Promise<void>;
  搜索可屏蔽组织(query: 组织搜索查询): Promise<BFF组织搜索页>;
  添加组织屏蔽(organizationId: string, source: 屏蔽来源): Promise<void>;
  解除组织屏蔽(item: 屏蔽项): Promise<void>;
}
```

- [ ] **Step 1: Write failing operation and hydration tests**

Create tests that drive the factory directly with refs, matching existing `岗位操作.test.ts` style. Import `后端状态` from the colocated Backend state types for the functional-updater assertion, then put this complete helper at the top of `隐私操作.test.ts`:

```ts
function 创建隐私测试依赖(后端: HTTP招聘数据源, 服务端: BFF隐私快照) {
  const 页面 = 从BFF隐私(服务端);
  const 状态引用 = { current: 归约(初始状态, { 型: '水合后端隐私', 快照: 页面 }) };
  const deps = {
    是后端: true, 后端, 派发: vi.fn(), 设后端状态: vi.fn(), 状态引用,
    后端状态引用: { current: {
      初始化: '完成' as const, 已登录: true, 主体: null, 简历快照: null,
      意向快照: {}, 岗位快照: {}, 隐私快照: 服务端,
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

it('receipt upserts block and advances revision without a second mutation', async () => {
  const 添加组织屏蔽 = vi.fn(async () => BFF屏蔽回执样本);
  const 数据源 = { 添加组织屏蔽 } as unknown as HTTP招聘数据源;
  const deps = 创建隐私测试依赖(数据源, BFF隐私快照样本);
  await 创建隐私操作(deps).添加组织屏蔽('org_2', '手动添加');
  expect(添加组织屏蔽).toHaveBeenCalledTimes(1);
  expect(deps.派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '水合后端隐私' }));
  const 更新 = deps.设后端状态.mock.calls.at(-1)![0] as (旧: 后端状态) => 后端状态;
  expect(更新(deps.后端状态引用.current).隐私快照?.revision).toBe(BFF屏蔽回执样本.privacy_revision);
});

it('409 rereads authoritative privacy but does not replay the patch', async () => {
  const 修改 = vi.fn().mockRejectedValue(new BFF错误(409, 'version_conflict', 'conflict'));
  const 读取 = vi.fn().mockResolvedValue(从BFF隐私({ ...BFF隐私快照样本, revision: 9 }));
  const 数据源 = { 修改隐私: 修改, 读取隐私: 读取 } as unknown as HTTP招聘数据源;
  const deps = 创建隐私测试依赖(数据源, BFF隐私快照样本);
  await expect(创建隐私操作(deps).设置雇主隐私(false)).rejects.toMatchObject({ code: 'version_conflict' });
  expect(修改).toHaveBeenCalledTimes(1);
  expect(读取).toHaveBeenCalledTimes(1);
});
```

In the existing `会话操作.test.ts`, reuse its file-local `创建会话测试依赖()` and add:

```ts
it('candidate hydration settles Resume, Intention, and Privacy independently', async () => {
  const 隐私页面样本 = 从BFF隐私(BFF隐私快照样本);
  const 后端 = {
    读取简历: vi.fn().mockRejectedValue(new Error('resume unavailable')),
    读取意向: vi.fn().mockRejectedValue(new Error('intention unavailable')),
    读取隐私: vi.fn().mockResolvedValue(隐私页面样本),
  } as unknown as HTTP招聘数据源;
  const { deps } = 创建会话测试依赖(后端);
  const candidate主体 = { ...BFF主体样本, last_used_role: 'candidate' as const };
  await expect(水合角色数据(deps, candidate主体, false, 1)).resolves.toBe(false);
  expect(deps.派发).toHaveBeenCalledWith({ 型: '水合后端隐私', 快照: 隐私页面样本 });
  expect(deps.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '水合后端简历' }));
});
```

Add assertions that `清账号状态`, cross-subject login, logout, 401, and role switch dispatch `清后端隐私` and set `后端状态.隐私快照` to `null`. Add an initial-state test proving Backend has `屏蔽名单=[]`, `披露偏好=[]`, while Mock retains its three seeded blocks and seven rows.

Add these operation cases in the same file:

- a PATCH/AddBlock/Unblock 503 after the fixture has applied the effect resolves only after one GET confirms the exact target; a GET that does not confirm it rethrows the original error;
- a 503 path never calls the mutation method twice;
- Unblock 404 resolves after one GET only when that view no longer contains the organization, and otherwise rethrows;
- Unblock `risk_acknowledgement_required` arriving as HTTP 422 rereads and commits the authoritative source, then rethrows without replaying;
- AddBlock receipt upsert replaces an existing same-ID row rather than appending a duplicate and does not synthesize `updated_at`;
- `搜索可屏蔽组织` 401 invokes `清账号状态` and rejects;
- a Privacy read resolving after `会话代际` or `主体标识引用` changes is discarded and cannot dispatch `水合后端隐私`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run src/状态/后端/隐私操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
```

Expected: FAIL because privacy actions, snapshot state, hydration, and cleanup do not exist.

- [ ] **Step 3: Add state and reducer contracts**

Extend `后端状态` with `隐私快照: BFF隐私快照 | null`; initialize it to `null` in the Provider and every test dependency. Extend `应用操作 = ... & 隐私操作`.

Add reducer actions:

```ts
export type 隐私设置动作 =
  | { 型: '水合后端隐私'; 快照: 页面隐私快照 }
  | { 型: '清后端隐私' }
  | { 型: '拉黑'; 名称: string }
  | { 型: '解除屏蔽'; 编号: string }
  | { 型: '设披露档'; 编号: string; 档: 披露档 }
  | { 型: '设企业披露档'; 编号: string; 档: 披露档 }
  | { 型: '切设置开关'; 键: string }
  | { 型: '企业切设置开关'; 键: string }
  | { 型: '设飞书接入'; 接入: boolean }
  | { 型: '设企业飞书接入'; 接入: boolean };
```

Implement:

```ts
case '水合后端隐私':
  return {
    ...旧,
    屏蔽名单: 动作.快照.屏蔽名单,
    披露偏好: 动作.快照.披露偏好,
    设置开关: { ...旧.设置开关, 对现雇主隐身: 动作.快照.对现雇主隐身 },
  };
case '清后端隐私':
  return {
    ...旧,
    屏蔽名单: [],
    披露偏好: [],
    设置开关: { ...旧.设置开关, 对现雇主隐身: false },
  };
```

Route both cases through `归约隐私设置` in the root reducer. In `后端种子状态`, explicitly set `屏蔽名单: []`, `披露偏好: []`, and `设置开关.对现雇主隐身=false`; do not alter the Mock seed.

- [ ] **Step 4: Implement privacy operations with authoritative reconciliation**

Use one helper to update React state and the page reducer. Keep `后端状态引用.current` as the Provider's single render-time mirror; do not create a second manual writer:

```ts
function 提交隐私快照(deps: 后端操作依赖, 快照: 页面隐私快照): void {
  deps.设后端状态((旧) => ({ ...旧, 隐私快照: 快照.服务端 }));
  deps.派发({ 型: '水合后端隐私', 快照 });
}
```

Use `锁` keys `privacy:patch`, `privacy:block:${organizationId}`, and `privacy:unblock:${organizationId}`. All five operations, including organization search, call `清账号状态` on 401. Dispatch recovery by BFF error code, not status alone: `version_conflict`, `organization_already_blocked`, and `risk_acknowledgement_required` each call `后端.读取隐私()`, commit it, and always rethrow; never replay the mutation. The first two are normally 409 and risk acknowledgement is 422. On Unblock 404, reread and commit: resolve only when the authoritative view confirms the target is absent, otherwise rethrow. Only mutation status 0/503 uses the ambiguous-outcome success check below:

```ts
const 已达成 =
  effect.kind === 'employer' ? latest.服务端.employer_privacy_enabled === effect.enabled :
  effect.kind === 'disclosure' ? latest.服务端.disclosure_preferences[effect.field] === effect.value :
  effect.kind === 'block' ? latest.服务端.organization_blocks.some((b) => b.organization_id === effect.id && b.source === effect.source) :
  !latest.服务端.organization_blocks.some((b) => b.organization_id === effect.id);
if (!已达成) throw 原错误;
```

AddBlock receipt merge must upsert by `organization_id` and set `revision=privacy_revision`, without inventing aggregate `updated_at`; then map and commit the resulting page snapshot. `解除组织屏蔽(item)` sends `risk_acknowledged: item.来源 !== '手动添加'`.
`设置披露偏好(id, 档)` builds exactly `{ disclosure_preferences: { [披露编号到BFF(id)]: 披露档到BFF(档) } }`; it must not send the other two disclosure members or any display string.

- [ ] **Step 5: Add candidate hydration and complete cleanup**

Change candidate `Promise.allSettled` to include `后端.读取隐私()` as the third item; handle its success/failure exactly like Resume and Intention. Any of the three returning 401 invokes `清账号状态` once. Add `清后端隐私` and `隐私快照:null` to:

- `清账号状态`;
- cross-subject cleanup in `完成手机登录`;
- the recruiter branch of `水合角色数据` before recruiter-owned hydration begins;
- all `后端状态` initial/test fixtures.

Compose `创建隐私操作(deps)` in `应用状态.tsx`.

- [ ] **Step 6: Run Task 2 tests and commit**

Run:

```bash
npx vitest run src/状态/后端/隐私操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
npm run typecheck
```

Expected: PASS; candidate partial hydration and all cleanup paths include Privacy.

Commit:

```bash
git add src/状态
git commit -m "feat: own candidate privacy state"
```

---

### Task 3: Wire Settings, Disclosure Preferences, and Fixed Enterprise Policy

**Files:**
- Modify: `src/屏幕/设置.tsx`
- Create: `src/屏幕/设置.test.tsx`
- Modify: `src/组件/通用.tsx`
- Modify: `src/屏幕/披露偏好.tsx`
- Create: `src/屏幕/披露偏好.test.tsx`
- Modify: `src/屏幕/企业披露策略.tsx`
- Create: `src/屏幕/企业披露策略.test.tsx`

**Interfaces:**
- Consumes: `数据源模式`, `后端状态.隐私快照`, `操作.设置雇主隐私`, `操作.设置披露偏好`, existing Mock actions, `企业披露策略初始`, and PM display models.
- Produces: the same routes/DOM copy with Backend writes and an enterprise policy projected from a fixed constant rather than mutable root state.

- [ ] **Step 1: Write failing component tests with copy fences**

In `设置.test.tsx` and `披露偏好.test.tsx`, mock `use应用状态` and `use导航` with the same file-local pattern already used by `发布岗位.test.tsx`:

```tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: vi.fn(), 跳转: vi.fn(), 替换跳转: vi.fn() }),
}));
```

In `设置.test.tsx`, render the component directly and prove the screen calls the Backend operation rather than a local reducer action:

```tsx
it('Backend 对现雇主隐身使用 Privacy operation，成功前不派发本地 toggle', async () => {
  const 用户 = userEvent.setup();
  const 设置雇主隐私 = vi.fn().mockResolvedValue(undefined);
  const 派发 = vi.fn();
  mock应用状态 = {
    状态: { 设置开关: { ...初始状态.设置开关, 对现雇主隐身: true } },
    派发, 操作: { 设置雇主隐私, 退出登录: vi.fn() },
    数据源模式: 'backend', 后端状态: { 隐私快照: BFF隐私快照样本 },
  };
  render(<MemoryRouter><设置 /></MemoryRouter>);
  await 用户.click(screen.getByRole('switch', { name: '对现雇主隐身' }));
  expect(screen.getByText('关闭「对现雇主隐身」？')).toBeInTheDocument();
  await 用户.click(screen.getByRole('button', { name: '仍要关闭' }));
  expect(设置雇主隐私).toHaveBeenCalledWith(false);
  expect(派发).not.toHaveBeenCalledWith({ 型: '切设置开关', 键: '对现雇主隐身' });
});
```

In `披露偏好.test.tsx`, seed the mapped Privacy view and scope button queries to their existing row DOM:

```tsx
it('D1/D2 fixed, D3-D5 patch one server field, and all existing copy remains', async () => {
  const 设置披露偏好 = vi.fn().mockResolvedValue(undefined);
  const 快照 = 从BFF隐私(BFF隐私快照样本);
  mock应用状态 = {
    状态: { 披露偏好: 快照.披露偏好 }, 派发: vi.fn(),
    操作: { 设置披露偏好 }, 数据源模式: 'backend',
    后端状态: { 隐私快照: 快照.服务端 },
  };
  render(<MemoryRouter><披露偏好 /></MemoryRouter>);
  expect(screen.getByText('具体薪资数字')).toBeInTheDocument();
  expect(screen.getByText('并行接触数量')).toBeInTheDocument();
  const D1卡 = screen.getByText('真实姓名').parentElement!.parentElement!;
  const D2卡 = screen.getByText('联系方式').parentElement!.parentElement!;
  const D4卡 = screen.getByText('毕业院校与学历').parentElement!.parentElement!;
  const D6卡 = screen.getByText('具体薪资数字').parentElement!.parentElement!;
  const D7卡 = screen.getByText('并行接触数量').parentElement!.parentElement!;
  for (const 卡 of [D1卡, D2卡, D6卡, D7卡]) {
    for (const button of within(卡).getAllByRole('button')) expect(button).toBeDisabled();
  }
  await userEvent.click(within(D4卡).getByRole('button', { name: '不披露' }));
  expect(设置披露偏好).toHaveBeenCalledWith('D-04', '不披露');
});

it('Backend Privacy 未水合时保留页面外壳且不注入 Mock 档位', () => {
  const 设置披露偏好 = vi.fn();
  mock应用状态 = {
    状态: { 披露偏好: [] }, 派发: vi.fn(), 操作: { 设置披露偏好 },
    数据源模式: 'backend', 后端状态: { 隐私快照: null },
  };
  render(<MemoryRouter><披露偏好 /></MemoryRouter>);
  expect(screen.getByText('代理按这里的设定决定何时交出信息')).toBeInTheDocument();
  expect(screen.getByText(/AI 不会自动披露你的薪资数字/)).toBeInTheDocument();
  expect(screen.queryByText('真实姓名')).not.toBeInTheDocument();
  expect(设置披露偏好).not.toHaveBeenCalled();
});
```

In `企业披露策略.test.tsx`, render the component without application state and assert its exact existing rows remain disabled:

```tsx
it('企业披露策略所有分段不再写本地假状态且字样不变', () => {
  render(<MemoryRouter><企业披露策略 /></MemoryRouter>);
  expect(screen.getByText('完整 JD 与职级')).toBeInTheDocument();
  expect(screen.getByText('团队规模与汇报线')).toBeInTheDocument();
  for (const 档 of ['不披露', '意向确认后', '一直允许']) {
    for (const button of screen.getAllByRole('button', { name: 档 })) expect(button).toBeDisabled();
  }
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run src/屏幕/设置.test.tsx src/屏幕/披露偏好.test.tsx src/屏幕/企业披露策略.test.tsx
```

Expected: FAIL because the screens still dispatch local privacy actions in Backend mode and enterprise policy remains mutable.

- [ ] **Step 3: Wire Settings without changing its strings**

Extend the existing shared switch with one optional non-visual prop and keep every current caller source-compatible:

```tsx
export function 开关({ 开, 切换, 标签 = '切换此设置', 禁用 = false }: {
  开: boolean; 切换: () => void; 标签?: string; 禁用?: boolean;
}) {
  return (
    <button type="button" className={`${样式.开关} ${开 ? 样式.开 : ''}`}
      onClick={切换} role="switch" aria-checked={开} aria-label={标签} disabled={禁用}>
      <span className={样式.开关点} />
    </button>
  );
}
```

Do not add a disabled CSS class or alter the switch's strings/tokens. In `设置.test.tsx`, add a null-snapshot case asserting the privacy switch is disabled and no operation/local action fires. Then destructure `数据源模式`, `后端状态`, and `操作`. For the existing `对现雇主隐身` switch:

```tsx
const 隐私已水合 = 数据源模式 === 'mock' || 后端状态.隐私快照 !== null;
const 切雇主隐私 = async (enabled: boolean) => {
  if (数据源模式 === 'mock') {
    派发({ 型: '切设置开关', 键: '对现雇主隐身' });
    return;
  }
  await 操作.设置雇主隐私(enabled);
};
```

Keep the current close-confirm modal text byte-for-byte. Await `切雇主隐私(false)` before closing it. Disable only this switch while no Backend Privacy snapshot exists; other local settings remain unchanged.

- [ ] **Step 4: Wire Disclosure and freeze Enterprise Policy**

For each disclosure button:

```tsx
const 可改 = 项.可修改 === true && 项.锁定 === null && 项.可选档.includes(档);
className={`${样式.分段项} ${选中 ? 样式.分段项选中 : ''} ${
  可选 ? '可点' : 样式.分段项禁用
}`}
onClick={async () => {
  if (!可改) return;
  if (数据源模式 === 'backend') await 操作.设置披露偏好(项.编号 as 'D-03' | 'D-04' | 'D-05', 档);
  else 派发({ 型: '设披露档', 编号: 项.编号, 档 });
}}
disabled={!可改}
```

D1/D2 retain the current row texts and selected `意向确认后` display but have `可修改=false`; D6/D7 retain current mechanism locks. Keep the existing class calculation based on `可选` exactly as shown, while only behavior uses `可改`, so fixed rows do not acquire an unapproved disabled visual style. The existing UI regression gate, rather than a brittle CSS-module class-name unit assertion, freezes that visual boundary. When Backend `隐私快照` is null, `披露偏好=[]` renders only the existing title/subtitle/说明/footer and no setting rows; do not inject the shared Mock defaults as apparent server values. In `企业披露策略.tsx`, remove `use应用状态`, iterate the existing exported `企业披露策略初始` constant directly, set every segmented button `disabled`, and retain the complete existing JSX text and layout. Do not add or mutate an enterprise disclosure value in root state.

- [ ] **Step 5: Run Task 3 tests and commit**

Run:

```bash
npx vitest run src/屏幕/设置.test.tsx src/屏幕/披露偏好.test.tsx src/屏幕/企业披露策略.test.tsx src/数据/披露契约.test.ts
npm run typecheck
```

Expected: PASS; P3 mutations are real only in Backend mode and no approved string changes.

Commit:

```bash
git add src/组件/通用.tsx src/屏幕/设置.tsx src/屏幕/设置.test.tsx src/屏幕/披露偏好.tsx src/屏幕/披露偏好.test.tsx src/屏幕/企业披露策略.tsx src/屏幕/企业披露策略.test.tsx
git commit -m "feat: wire p3 disclosure settings"
```

---

### Task 4: Replace Free-Text Blocking with Organization Search

**Files:**
- Create: `src/屏幕/组织查询钩子.ts`
- Create: `src/屏幕/组织查询钩子.test.ts`
- Modify: `src/屏幕/屏蔽名单.tsx`
- Create: `src/屏幕/屏蔽名单.test.tsx`

**Interfaces:**
- Consumes: `数据源模式`, `后端状态.隐私快照`, `操作.搜索可屏蔽组织`, `操作.添加组织屏蔽`, `操作.解除组织屏蔽`, `BFF组织搜索项`, `屏蔽项.来源`, existing `卡/行/分段/添加行` CSS classes.
- Produces:

```ts
function use组织查询(search?: (query: 组织搜索查询) => Promise<BFF组织搜索页>): {
  来源: 屏蔽来源 | null; 设来源(value: 屏蔽来源): void;
  词: string; 设词(value: string): void; 选择: BFF组织搜索项 | null;
  选中(item: BFF组织搜索项): void; 结果: BFF组织搜索项[]; 搜索中: boolean;
  下一页游标: string | null; 加载中: boolean; 加载更多(): Promise<void>;
  重新查询(): void; 清空(): void;
}
```

- [ ] **Step 1: Write failing hook and screen tests**

Create fake-timer hook tests for 250ms debounce, query reset, stale response discard, and pagination:

```ts
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
}

const Acme组织 = { organization_id: 'org_acme', display_name: 'Acme', legal_name: 'Acme Ltd' };
const Beta组织 = { organization_id: 'org_beta', display_name: 'Beta', legal_name: 'Beta Ltd' };

it('new query discards old response and resets cursor', async () => {
  const acme = deferred<BFF组织搜索页>();
  const beta = deferred<BFF组织搜索页>();
  const 搜索 = vi.fn(({ q }) => q === 'Acme' ? acme.promise : beta.promise);
  const { result } = renderHook(() => use组织查询(搜索));
  act(() => result.current.设来源('手动添加'));
  act(() => result.current.设词('Acme'));
  await act(() => vi.advanceTimersByTimeAsync(250));
  act(() => result.current.设词('Beta'));
  await act(() => vi.advanceTimersByTimeAsync(250));
  await act(async () => { beta.resolve({ items: [Beta组织], next_cursor: null }); });
  await act(async () => { acme.resolve({ items: [Acme组织], next_cursor: 'old' }); });
  expect(result.current.结果).toEqual([Beta组织]);
  expect(result.current.下一页游标).toBeNull();
});
```

Create screen tests proving:

- Backend typing alone never creates a block;
- selecting a result and pressing the existing `屏蔽` button sends its stable ID and selected source;
- current/related rows render under existing `建档时自动屏蔽`, manual under existing `你手动添加`;
- current/related unblock invokes risk acknowledgement through the operation, manual does not;
- Mock mode keeps the current local free-text behavior and makes no search call;
- all current titles, placeholder, group labels, buttons, empty state, and confirmation copy remain.

Add one hook pagination test that calls `加载更多()` twice before the first call resolves and asserts the search method receives that cursor only once.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run src/屏幕/组织查询钩子.test.ts src/屏幕/屏蔽名单.test.tsx
```

Expected: FAIL because the hook and Backend organization picker do not exist.

- [ ] **Step 3: Implement the local query hook**

Use the same monotonic generation ref plus `加载中` boolean guard already proven by `城市查询钩子`; do not add a second cursor-tracking Set or write search results into global state:

```ts
const 代际 = useRef(0);

const 设词 = (value: string) => {
  代际.current += 1;
  set词(value);
  set选择(null);
  set结果([]);
  set下一页游标(null);
  set加载中(false);
};
```

Initialize `来源=null` and `选择=null`. `选中(item)` increments the generation, stores the complete item, and sets `词=item.display_name`; ordinary `设词()` always clears selection. The effect trims `词`, returns without requesting when no source is selected, when the query is empty, or when `选择?.display_name === 词`; otherwise it waits 250ms, captures the generation, calls `search({q, limit:20})`, and commits only if the generation still matches. A failed first-page search preserves the input and any already displayed page. `加载更多()` returns when `下一页游标 === null || 加载中`, otherwise calls the current query/cursor, de-duplicates by `organization_id`, and commits only to the matching generation. `重新查询()` increments the generation and a separate refresh counter without changing `词`, clears the selection/page/cursor, and triggers the same debounced first-page effect. Component unmount discards the generation and clears query/source/selection/cursor with the hook instance.

- [ ] **Step 4: Wire Backend picker while preserving Mock behavior**

In Backend mode:

- while `后端状态.隐私快照 === null`, render the existing shell/list labels but disable source, search, block, and unblock controls; never expose Mock rows or a local-success path;
- render the hook's source choices `当前雇主`, `关联公司`, `手动添加` using the existing segmented control class;
- keep the existing input placeholder exactly `输入公司全称，如「某某科技」`;
- disable the search input until a source has been explicitly selected; use it only as search text;
- disable `屏蔽` until both a source and a SearchItem are selected;
- render search results using existing card/row styles; selecting a row calls `选中(item)`;
- call `操作.添加组织屏蔽(选择.organization_id, 来源)` and clear query only after success;
- on `organization_unavailable`, clear selection and call `重新查询()` so the visible query text is preserved;
- group by `条.来源 === '手动添加'` rather than parsing `理由`;
- pass the complete `屏蔽项` to `操作.解除组织屏蔽`.

In Mock mode retain the current `拉黑/解除屏蔽` reducer path and do not mount the query hook with a search function.

- [ ] **Step 5: Run Task 4 tests and commit**

Run:

```bash
npx vitest run src/屏幕/组织查询钩子.test.ts src/屏幕/屏蔽名单.test.tsx src/状态/后端/隐私操作.test.ts
npm run typecheck
```

Expected: PASS; no free-text Backend block can be submitted.

Commit:

```bash
git add src/屏幕/组织查询钩子.ts src/屏幕/组织查询钩子.test.ts src/屏幕/屏蔽名单.tsx src/屏幕/屏蔽名单.test.tsx
git commit -m "feat: search organizations for privacy blocks"
```

---

### Task 5: Add Four Tri-State Job Hard Facts

**Files:**
- Modify: `src/屏幕/发布岗位.tsx`
- Modify: `src/屏幕/发布岗位.test.tsx`
- Modify: `src/屏幕/发布岗位.module.css`
- Modify: `src/数据/企业端模拟数据.ts`
- Modify: `src/数据/类型.ts`
- Modify: `src/状态/后端/岗位操作.test.ts`

**Interfaces:**
- Consumes: Task 1 `岗位硬性事实`, `空岗位硬性事实`, Job mapping, and the existing `在招岗位.硬性条件` legacy contract.
- Produces: publish/edit form state that always carries an independent complete `硬性事实` object.

- [ ] **Step 1: Write failing create/edit and copy-fence tests**

Extend `发布岗位.test.tsx`:

```tsx
it('new job starts with four unknown facts and submits the complete object', async () => {
  const { 用户 } = await 填到发布前(true);
  expect(screen.getByRole('button', { name: /大小周.*未说明/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /纯外包 \/ 乙方.*未说明/ })).toBeInTheDocument();
  await 用户.click(screen.getByRole('button', { name: /大小周.*未说明/ }));
  await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
  await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
  expect(mock发布岗位).toHaveBeenCalledWith(expect.objectContaining({
    硬性事实: { 大小周: '必须', 纯外包乙方: '未说明', 全现场办公: '未说明', 频繁出差: '未说明' },
  }));
});

it('editing round-trips required/not-required/unknown without touching legacy strings', async () => {
  mock应用状态.状态.岗位列表 = [{ ...页面岗位样本,
    硬性条件: ['本科及以上'],
    硬性事实: { 大小周: '必须', 纯外包乙方: '不要求', 全现场办公: '未说明', 频繁出差: '必须' },
  }];
  render(
    <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
      <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
    </MemoryRouter>,
  );
  await userEvent.click(screen.getByRole('button', { name: '职位要求' }));
  expect(screen.getByText('硬性条件')).toBeInTheDocument();
  expect(screen.getByText('本科及以上')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /纯外包 \/ 乙方.*不要求/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
  expect(mock更新岗位.mock.calls[0][0].硬性事实).toEqual({
    大小周: '必须', 纯外包乙方: '不要求', 全现场办公: '未说明', 频繁出差: '必须',
  });
});
```

Extend `岗位操作.test.ts` to assert create and update bodies contain the complete object and that a Backend OwnerJob missing one member rejects before state hydration.
Also add a 409 edit case: the operation rereads the authoritative OwnerJob once and rejects without replaying PATCH, while `发布岗位.test.tsx` proves the component's four local selections remain unchanged for the user's next explicit save.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run src/屏幕/发布岗位.test.tsx src/数据/后端映射.test.ts src/状态/后端/岗位操作.test.ts
```

Expected: FAIL because the form does not hold or render `硬性事实`.

- [ ] **Step 3: Add typed form state and preserve it in `组装岗位`**

Initialize with a fresh copy to avoid shared mutation:

```ts
const [硬性事实, 设硬性事实] = useState<岗位硬性事实>(
  () => 编辑目标?.硬性事实 ? { ...编辑目标.硬性事实 } : { ...空岗位硬性事实 },
);
```

Add `硬性事实: { ...硬性事实 }` to the object returned by `组装岗位`. Do not modify the existing legacy `硬性条件` construction or any experience/education/cohort logic.

- [ ] **Step 4: Render a no-copy-rewrite tri-state control**

Use the existing PM condition words and symbolic states; do not add an explanatory paragraph or rename the section:

```ts
const 硬性事实选项 = [
  ['大小周', '大小周'],
  ['纯外包乙方', '纯外包 / 乙方'],
  ['全现场办公', '全现场办公'],
  ['频繁出差', '频繁出差'],
] as const;
const 下一档 = { 未说明: '必须', 必须: '不要求', 不要求: '未说明' } as const;
const 档符号 = { 未说明: '—', 必须: '✓', 不要求: '×' } as const;
```

Inside the existing hard-condition area, render one button per fact. Visible button text is only the existing condition word plus `—/✓/×`; the accessible name is `${标签} ${档}`. Apply local CSS classes for neutral/selected/excluded states using existing colors and radii. Do not edit existing text nodes.

- [ ] **Step 5: Complete Mock fixtures and verify both modes**

After `组装岗位` always emits the object, make `在招岗位.硬性事实` required (remove the temporary `?` introduced in Task 1) and add explicit `硬性事实` to every current `在招岗位列表` fixture. Mock does not persist or hydrate `岗位列表`, so do not invent a historical normalization boundary or an unused fallback. Do not add any fallback to `从BFF岗位`.

Run:

```bash
npx vitest run src/屏幕/发布岗位.test.tsx src/数据/后端映射.test.ts src/状态/后端/岗位操作.test.ts
npm run typecheck
```

Expected: PASS; create/edit always preserve four values and legacy hard-condition strings are unchanged.

- [ ] **Step 6: Commit Task 5**

```bash
git add src/屏幕/发布岗位.tsx src/屏幕/发布岗位.test.tsx src/屏幕/发布岗位.module.css src/数据/类型.ts src/数据/企业端模拟数据.ts src/状态/后端/岗位操作.test.ts
git commit -m "feat: wire job hard requirements"
```

---

### Task 6: Prove Mock/Backend Isolation and Run Delivery Gates

**Files:**
- Modify: `e2e/数据源模式.spec.ts`

**Interfaces:**
- Consumes: completed P3 UI, existing `安装后端夹具`, session/role fixtures, Playwright dual-server config, and UI regression command.
- Produces: intercepted Backend P3 proof, Mock zero-network proof, and final command evidence.

- [ ] **Step 1: Extend the mutable Backend fixture with Privacy and organization search**

Add fixture state:

```ts
interface P3屏蔽形 {
  organization_id: string;
  organization_display_name: string;
  organization_status: 'active' | 'suspended';
  source: 'current_employer' | 'related_organization' | 'manual';
  created_at: string;
}

interface P3隐私形 {
  employer_privacy_enabled: boolean;
  disclosure_preferences: { current_employer: 'never' | 'resume_submission' | 'anonymous'; education: 'never' | 'resume_submission' | 'anonymous'; portfolio_links: 'never' | 'resume_submission' | 'anonymous' };
  organization_blocks: P3屏蔽形[];
  revision: number;
  updated_at: string;
}
```

Handle exact routes in `安装后端夹具`:

- `GET/PATCH /api/v1/me/privacy`, validating quoted `If-Match` and incrementing revision;
- `GET /api/v1/organizations`, returning strict active search pages and query-bound cursors;
- `POST /api/v1/me/privacy/organization-blocks`, validating stable ID/source/headers and returning 201 receipt;
- `POST /api/v1/me/privacy/organization-blocks/:id/unblock`, requiring `risk_acknowledged=true` for current/related and returning a full view;
- owner Job GET/POST/PATCH fixtures always include complete `hard_requirements`.

Record every request path, method, body, If-Match, and Idempotency-Key for assertions. Keep fixture IDs obviously synthetic.

- [ ] **Step 2: Add failing P3 Backend and Mock Playwright scenarios**

Add one Backend scenario that performs:

```text
candidate session restore
→ assert GET Privacy participates in hydration
→ /settings close employer privacy and assert PATCH If-Match
→ /disclosure-prefs change D4 and assert sparse disclosure patch
→ /blocklist search, select stable org, AddBlock, verify source group
→ unblock derived source and assert risk_acknowledged=true
→ add/unblock a manual source and assert risk_acknowledged=false
→ switch recruiter role
→ publish/edit a job and assert full hard_requirements bodies
```

Add one `@mock` scenario that visits `/settings`, `/disclosure-prefs`, `/blocklist`, and `/hr/post-job`, exercises the existing local flows, and asserts the recorded `/api/v1` request list remains empty.

Add focused Backend recovery scenarios using fixture switches, without sleeps longer than the 250ms UI debounce:

- PATCH first returns 409 after advancing fixture revision: assert one PATCH only, one reconciliation GET, refreshed UI state, and no automatic replay;
- AddBlock first returns the existing client's retryable `idempotency_in_progress`, then succeeds: assert both attempts carry the same Idempotency-Key; a later explicit AddBlock intent carries a different key;
- AddBlock returns 503 after applying the effect: assert reconciliation GET confirms the block and the UI does not issue a second mutation;
- Unblock returns 404 with the target already absent: assert reconciliation view removes it without a replay;
- Unblock returns 422 `risk_acknowledgement_required` after the fixture changes the stored source: assert one reconciliation GET updates the source/group and the operation rethrows without replay;
- issue search A, then search B, resolve B before A, and assert only B items/cursor render; also assert an empty page renders the existing empty state;
- keep a Privacy GET pending, switch to a different synthetic subject or recruiter role, resolve the old GET, and assert the old snapshot/search selection never appears.

Run:

```bash
npm run test:e2e:data-source -- --grep 'P3'
```

Expected before fixture/UI completion: FAIL on missing P3 routes or assertions. After finishing Step 1 and the preceding Tasks: PASS.

- [ ] **Step 3: Run focused and full automated checks**

Run in this exact order, stopping at the first failure and fixing only the responsible task:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:e2e:data-source
```

Expected: every command exits 0. Do not pipe Playwright output through `grep`; preserve its exit code.

- [ ] **Step 4: Run the UI regression gate**

Run:

```bash
UI_VISUAL_GATE=enforce npm run ui:check -- --base eaa561e6a9d76c874804627b4e9a32c71c03419b
```

Expected: exit 0. Review `ui-regression-output/latest/report.md`; do not commit screenshots, videos, or generated reports. P3-required changes may be visually different only on their approved screens; all existing text, navigation, unaffected scenes, and CSS tokens must remain stable.

- [ ] **Step 5: Commit integration coverage**

```bash
git add e2e/数据源模式.spec.ts
git commit -m "test: prove p3 frontend integration"
```

---

## Final Review Checklist

- [ ] Diff contains no backend repository changes.
- [ ] Existing PM string literals in the four privacy screens and job section are unchanged.
- [ ] Backend initial state contains no Mock privacy rows or blocks.
- [ ] D1/D2 and D6/D7 cannot produce Privacy PATCH fields.
- [ ] D3–D5 map exactly to `current_employer`, `education`, and `portfolio_links`.
- [ ] Privacy decoders require wire `updated_at`, while page state and AddBlock receipt merging do not invent or persist an aggregate timestamp.
- [ ] Block creation always uses a SearchItem `organization_id`, current revision, source, and an Idempotency-Key.
- [ ] Block grouping and unblock risk derive from `source`, never `理由` text.
- [ ] Privacy 409 does not auto-replay; ambiguous outcomes reconcile by GET.
- [ ] Every Backend OwnerJob contains valid complete hard requirements; no Backend `unknown` fallback hides drift.
- [ ] `BFFCandidateJob` and the shared hard-requirement mapper retain all four values, while P3 adds no unused CandidateJob request/decoder or P4 page.
- [ ] Legacy `硬性条件: string[]` is unchanged and independent of `硬性事实`.
- [ ] Enterprise disclosure renders from the fixed existing projection and no longer dispatches a mutable policy action.
- [ ] Mock makes zero P3 HTTP calls; Backend never reads Mock facts.
- [ ] The implementation handoff reports the observed result of every focused and global command in Task 6.
- [ ] Working tree is clean and contains no generated visual artifacts.
