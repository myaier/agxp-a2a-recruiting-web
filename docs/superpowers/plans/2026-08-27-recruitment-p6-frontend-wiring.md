# Recruitment P6 Frontend Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire candidate and recruiter P6-A standing Agent rules to the final BFF Rule/Proposal lifecycle without leaking Mock rules or pretending Case instructions are authoritative.

**Architecture:** Add one strict P6 facade to the existing `HTTP招聘数据源`, keep raw Rule/Proposal snapshots in the existing backend state, and expose lifecycle operations through the existing application Context. Canonical candidate/recruiter pages own proposal confirmation; filter drawers become read-only in Backend mode, while Mock mode retains the current synchronous reducer story.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Testing Library, Playwright 1.62, existing same-origin BFF HTTP client.

**Spec:** `docs/superpowers/specs/2026-08-27-recruitment-p6-frontend-wiring-design.md`

## Global Constraints

- Frontend implementation base is `origin/main@eaa561e6a9d76c874804627b4e9a32c71c03419b`; preserve unrelated user changes.
- Backend truth source is `~/agxp-monorepo` `origin/release/0.2.5@a3d725473f50709e1d92d8bb84afabb9f22961aa`, especially `apps/recruitment-bff/openapi/mobile-v1.yaml`.
- Scope is P6-A Rule/Proposal only. Do not add Case instruction DTOs, routes, polling, or fixture-only MatchCase IDs.
- Do not add a second Context, state library, query cache, HTTP client, rules DSL, or dependency.
- Backend mode never imports or falls back to Mock Rule facts. Mock mode sends zero `agent-rule` requests and keeps current immediate reducer behavior.
- A Proposal is never inserted into a Rule array. Only an accepted and subsequently authoritative Rule response/list may change Backend Rule rows or active counts.
- Candidate create always sends an explicit `global` or `intention` scope. Recruiter create never sends a scope.
- Rule mutations use the current raw snapshot version as exact quoted `If-Match`; create/accept/dismiss/replacement use the existing `幂等: true` client behavior.
- Do not automatically replay a failed Rule mutation. Re-read authoritative state after 404, 409, 503, network failure, or outcome uncertainty.
- Read all opaque-cursor pages and reject a repeated cursor. Hydration reads `interpreting` and `ready` Proposal lists separately and merges by `proposal_id`.
- Poll visible `interpreting` Proposals every 2,000 ms only while a canonical Rule page is mounted; one GET per Proposal may be in flight.
- Keep these consequence summaries exact:
  - `auto_allow`: `符合条件时，AI代理可以自动推进`
  - `auto_deny`: `命中条件时，AI代理会自动拦下`
  - `advisory`: `这是一条参考偏好，不会单独触发自动决定`
  - `mixed`: `这条规则同时包含推进、拦截或参考条件`
- `ready` alone does not prove acceptability because the public DTO hides executable/advisory classification. `consequence` is display-only: the backend accepts executable `auto_deny` and can reject top-level advisory with the same public lifecycle. Show explicit accept and dismiss; recover `agent_rule_proposal_not_actionable` by re-reading the Proposal and telling the user to dismiss or rephrase. Do not encode the stale OpenAPI prose “only auto_allow or mixed” as a browser gate.
- Rule and Proposal hydration are independently visible through `未开始|进行中|成功|失败`. A successful Rule read shows authoritative rows/counts immediately; create/edit/accept/dismiss controls require both actionable Proposal lists. Only an explicit failed domain shows the retry action; pending hydration shows a loading shell and never a silent permanent shell.
- P3 and P6 share composition files. Implement P6 on its isolated branch; after P3 lands on `origin/main`, rebase and mechanically combine both domains rather than introducing registries.

## File Map

### New files

- `src/数据/招聘数据源/Agent规则.ts` — P6 role prefixes, paths, pagination, strict DTO decoding, ETag/version fences, and mutations.
- `src/数据/招聘数据源/Agent规则.test.ts` — exact requests, closed DTOs, pagination, cursor safety, ETag, and malformed-response tests.
- `src/数据/Agent规则映射.ts` — owner-safe BFF Rule to page Rule projection and intention grouping.
- `src/数据/Agent规则映射.test.ts` — global/intention/recruiter/orphan mapping tests.
- `src/状态/领域/Agent规则.test.ts` — Mock CRUD preservation plus Backend hydration/clear reducer tests.
- `src/状态/后端/Agent规则操作.ts` — staged hydration, proposal lifecycle, locks, CAS/error reconciliation, session fences, and closed P6 user-facing error copy.
- `src/状态/后端/Agent规则操作.test.ts` — operation-level lifecycle and stale-response tests.
- `src/状态/后端/useAgent规则提案轮询.ts` — canonical-page-only 2-second single-flight polling hook.
- `src/状态/后端/useAgent规则提案轮询.test.tsx` — fake-timer polling lifecycle tests.
- `src/组件/Agent规则提案卡.tsx` — interpreting/ready/failed confirmation UI shared by both roles.
- `src/组件/Agent规则提案卡.module.css` — styles using existing design tokens.
- `src/组件/Agent规则提案卡.test.tsx` — state/copy/action tests.
- `src/屏幕/规则库.test.tsx` — candidate Backend/Mock behavior.
- `src/屏幕/企业代理设置.test.tsx` — recruiter Backend/Mock behavior.
- `src/组件/候选筛选抽屉.test.tsx` — recruiter drawer mode boundary.
- `src/屏幕/看市场.test.tsx` — candidate filter-layer mode boundary.

### Existing files with focused changes

- `src/数据/BFF契约.ts` — closed Rule/Scope/Proposal/Page/create/mutation wire types only.
- `src/数据/HTTP招聘数据源.ts` and `.test.ts` — compose the P6 facade.
- `src/数据/类型.ts` — optional Backend Rule metadata.
- `src/测试/BFF样本.ts` — valid Rule/Proposal fixtures.
- `src/状态/领域/Agent规则.ts` — Backend hydration/clear actions while retaining Mock actions.
- `src/状态/后端/类型.ts` — raw snapshots, hydration markers, and `Agent规则操作` in root operations.
- `src/状态/后端/会话操作.ts` and `.test.ts` — P6 role hydration and account cleanup.
- `src/状态/初始状态.ts` — Backend seed has empty Rule arrays.
- `src/状态/应用状态.tsx` and `src/状态/应用状态.test.ts` — compose P6 operations and initialize P6 backend state.
- `src/屏幕/规则库.tsx` and `.module.css` — candidate scopes, proposals, replacement, and archive.
- `src/屏幕/企业代理设置.tsx` and `.module.css` — recruiter proposals and pause/resume.
- `src/屏幕/看市场.tsx` — Backend filter layer is read-only and navigates to `/rules`.
- `src/组件/候选筛选抽屉.tsx` and `.module.css` — Backend recruiter drawer is read-only and navigates to `/hr/agent-settings`.
- `src/屏幕/问AI代理.tsx`, `企业问AI代理.tsx`, `往来记录.tsx`, `企业往来记录.tsx`, `在谈详情.tsx`, `候选详情.tsx` — dispatch Rule mutations only in Mock mode.
- `src/屏幕/代理详情.tsx`, `企业代理详情.tsx`, `我的.tsx`, `企业我的.tsx`, `企业在谈候选.tsx`, `候选推荐.tsx` — hide Backend counts until the matching Rule snapshot is hydrated.
- `e2e/数据源模式.spec.ts` — P6 mutable fixtures and Backend/Mock lifecycle assertions.

---

### Task 1: Freeze the P6 Wire Contract and Data Facade

**Files:**
- Modify: `src/数据/BFF契约.ts`
- Create: `src/数据/招聘数据源/Agent规则.ts`
- Create: `src/数据/招聘数据源/Agent规则.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`
- Modify: `src/测试/BFF样本.ts`

**Interfaces:**
- Consumes: `BFF请求选项`, `BFF响应<T>`, and `HTTP客户端` support for `ifMatch` and `幂等`.
- Produces: `Agent规则数据源` and the exact wire types below for Tasks 2–8.

```ts
export type BFFAgent规则作用域 =
  | { type: 'global' }
  | { type: 'intention'; intention_id: string };

export type BFFAgent规则状态 = 'active' | 'paused' | 'archived';
export type BFFAgent规则提案状态 = 'interpreting' | 'ready' | 'accepted' | 'dismissed' | 'failed';
export type BFFAgent规则后果 = 'auto_allow' | 'auto_deny' | 'advisory' | 'mixed';

export interface BFFAgent规则 {
  rule_id: string;
  version: number;
  state: BFFAgent规则状态;
  scope: BFFAgent规则作用域;
  clause_kinds: ('information_disclosure' | 'workplace_mode' | 'work_schedule' |
    'compensation_band' | 'role_domain' | 'candidate_affiliation' |
    'qualification' | 'contact_cadence')[];
  display_text: string;
  created_at: string;
  updated_at: string;
}

export interface BFFAgent规则提案 {
  proposal_id: string;
  state: BFFAgent规则提案状态;
  normalized_text?: string;
  consequence?: BFFAgent规则后果;
  created_at?: string;
}

export interface Agent规则数据源 {
  读取Agent规则(role: BFF角色, filter?: BFFAgent规则作用域): Promise<BFFAgent规则[]>;
  读取单条Agent规则(role: BFF角色, ruleId: string): Promise<BFFAgent规则>;
  修改Agent规则(role: BFF角色, ruleId: string, version: number, operation: 'pause' | 'resume'): Promise<BFFAgent规则>;
  删除Agent规则(role: BFF角色, ruleId: string, version: number): Promise<void>;
  创建Agent规则提案(role: BFF角色, text: string, scope?: BFFAgent规则作用域): Promise<BFFAgent规则提案>;
  读取Agent规则提案(role: BFF角色, proposalId: string): Promise<BFFAgent规则提案>;
  读取Agent规则提案列表(role: BFF角色, state: 'interpreting' | 'ready'): Promise<BFFAgent规则提案[]>;
  接受Agent规则提案(role: BFF角色, proposalId: string): Promise<BFFAgent规则>;
  放弃Agent规则提案(role: BFF角色, proposalId: string): Promise<BFFAgent规则提案>;
  创建Agent规则替换提案(role: BFF角色, rule: BFFAgent规则, text: string): Promise<BFFAgent规则提案>;
}
```

- [ ] **Step 1: Add valid BFF samples and failing exact-request tests**

Add `BFFAgent规则样本`, `BFF意向Agent规则样本`, `BFFAgent规则解释中提案样本`, and `BFFAgent规则就绪提案样本` to `BFF样本.ts`. Use IDs matching the OpenAPI patterns and fixed UTC timestamps:

```ts
export const BFFAgent规则样本: BFFAgent规则 = {
  rule_id: 'rul_0123456789abcdef0123456789abcdef',
  version: 3,
  state: 'active',
  scope: { type: 'global' },
  clause_kinds: ['work_schedule'],
  display_text: '大小周不谈',
  created_at: '2026-08-27T01:00:00Z',
  updated_at: '2026-08-27T02:00:00Z',
};

export const BFFAgent规则解释中提案样本: BFFAgent规则提案 = {
  proposal_id: 'arp_0123456789abcdef0123456789abcdef',
  state: 'interpreting',
  created_at: '2026-08-27T02:03:00Z',
};

export const BFFAgent规则就绪提案样本: BFFAgent规则提案 = {
  proposal_id: 'arp_fedcba9876543210fedcba9876543210',
  state: 'ready',
  normalized_text: '双休岗位可推进，大小周岗位拦下',
  consequence: 'mixed',
  created_at: '2026-08-27T02:05:00Z',
};
```

The canonical happy-path fixture uses `mixed` so it agrees with both the current implementation and the published accept prose. Keep separate display/recovery cases for `auto_deny` and `advisory`; never assert that either public consequence alone proves actionability.

Create `Agent规则.test.ts` and assert representative candidate and recruiter requests exactly:

```ts
it('candidate create and recruiter create use different closed bodies', async () => {
  请求Mock
    .mockResolvedValueOnce({ result: BFFAgent规则解释中提案样本, etag: null, requestId: 'p1' })
    .mockResolvedValueOnce({ result: BFFAgent规则解释中提案样本, etag: null, requestId: 'p2' });

  await 数据源.创建Agent规则提案('candidate', '大小周不谈', {
    type: 'intention', intention_id: 'int_0123456789abcdef0123456789abcdef',
  });
  await 数据源.创建Agent规则提案('recruiter', '竞对在职候选人不接触');

  expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
    {
      path: '/api/v1/me/agent-rule-proposals', method: 'POST', 幂等: true,
      body: { text: '大小周不谈', scope: { type: 'intention', intention_id: 'int_0123456789abcdef0123456789abcdef' } },
    },
    {
      path: '/api/v1/recruiter/agent-rule-proposals', method: 'POST', 幂等: true,
      body: { text: '竞对在职候选人不接触' },
    },
  ]);
});

it('replacement, pause, accept, dismiss and archive freeze headers and bodies', async () => {
  请求Mock
    .mockResolvedValueOnce({ result: BFFAgent规则解释中提案样本, etag: null, requestId: 'p3' })
    .mockResolvedValueOnce({ result: { ...BFFAgent规则样本, version: 4, state: 'paused' }, etag: '"4"', requestId: 'r4' })
    .mockResolvedValueOnce({ result: BFFAgent规则样本, etag: '"3"', requestId: 'r5' })
    .mockResolvedValueOnce({ result: { ...BFFAgent规则就绪提案样本, state: 'dismissed' }, etag: null, requestId: 'p4' })
    .mockResolvedValueOnce({ result: undefined, etag: null, requestId: 'r6' });

  await 数据源.创建Agent规则替换提案('candidate', BFFAgent规则样本, '只接受双休');
  await 数据源.修改Agent规则('recruiter', BFFAgent规则样本.rule_id, 3, 'pause');
  await 数据源.接受Agent规则提案('candidate', BFFAgent规则就绪提案样本.proposal_id);
  await 数据源.放弃Agent规则提案('candidate', BFFAgent规则就绪提案样本.proposal_id);
  await 数据源.删除Agent规则('candidate', BFFAgent规则样本.rule_id, 3);

  expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
    {
      path: `/api/v1/me/agent-rules/${BFFAgent规则样本.rule_id}/replacement-proposals`,
      method: 'POST', body: { text: '只接受双休', scope: { type: 'global' } }, ifMatch: '"3"', 幂等: true,
    },
    {
      path: `/api/v1/recruiter/agent-rules/${BFFAgent规则样本.rule_id}`,
      method: 'PATCH', body: { operation: 'pause' }, ifMatch: '"3"',
    },
    {
      path: `/api/v1/me/agent-rule-proposals/${BFFAgent规则就绪提案样本.proposal_id}/accept`,
      method: 'POST', body: {}, 幂等: true,
    },
    {
      path: `/api/v1/me/agent-rule-proposals/${BFFAgent规则就绪提案样本.proposal_id}/dismiss`,
      method: 'POST', body: {}, 幂等: true,
    },
    {
      path: `/api/v1/me/agent-rules/${BFFAgent规则样本.rule_id}`,
      method: 'DELETE', ifMatch: '"3"',
    },
  ]);
});
```

In the same RED step, add table tests for both role prefixes; global/intention query encoding; all-page Rule and Proposal reads; duplicate cursor rejection; ETag mismatch; missing/extra keys; invalid ID, version, date, enum, and clause kind; `interpreting` with forbidden `normalized_text`/`consequence`; `interpreting` with valid, invalid, and absent `created_at`; `ready` missing any settled field; malformed terminal optional fields; and recruiter calls that try to send a scope.

Add a recruiter replacement request test that freezes the role-aware body:

```ts
it('recruiter replacement omits candidate scope', async () => {
  请求Mock.mockResolvedValueOnce({ result: BFFAgent规则解释中提案样本, etag: null, requestId: 'rp1' });
  await 数据源.创建Agent规则替换提案('recruiter', BFFAgent规则样本, '竞对候选人先人工确认');
  expect(请求Mock.mock.calls[0][0]).toEqual({
    path: `/api/v1/recruiter/agent-rules/${BFFAgent规则样本.rule_id}/replacement-proposals`,
    method: 'POST',
    body: { text: '竞对候选人先人工确认' },
    ifMatch: '"3"',
    幂等: true,
  });
});
```

- [ ] **Step 2: Run the facade tests and verify RED**

Run:

```bash
npx vitest run src/数据/招聘数据源/Agent规则.test.ts src/数据/HTTP招聘数据源.test.ts
```

Expected: FAIL because the P6 DTOs, `创建Agent规则数据源`, and composed methods do not exist.

- [ ] **Step 3: Implement strict decoding, pagination, and request construction**

Use these exact internal boundaries in `Agent规则.ts`:

```ts
type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

const 角色前缀: Record<BFF角色, '/api/v1/me' | '/api/v1/recruiter'> = {
  candidate: '/api/v1/me',
  recruiter: '/api/v1/recruiter',
};

function 版本ETag(version: number): string {
  return `"${version}"`;
}

function 确认版本ETag(rule: BFFAgent规则, etag: string | null): BFFAgent规则 {
  if (etag !== 版本ETag(rule.version)) {
    throw new BFF错误(0, 'invalid_response', '规则版本与 ETag 不一致');
  }
  return rule;
}
```

Implement `读取全部页(pathForCursor, key, decodeItem)` with a `Set<string>` of seen cursors. The first request has no cursor; subsequent requests append exactly one `cursor=${encodeURIComponent(cursor)}`. Reject empty, repeated, non-string, or extra page keys with `BFF错误(0, 'invalid_response', ...)`.

Decoder rules are exact:

- Rule keys are exactly `rule_id,version,state,scope,clause_kinds,display_text,created_at,updated_at`.
- IDs match `^rul_[0-9a-f]{32}$`, `^arp_[0-9a-f]{32}$`, and intention IDs match `^int_[0-9a-f]{32}$`.
- Version is a safe positive integer; dates parse and preserve the original string; `display_text` is a non-empty string.
- `interpreting` has no `normalized_text` or `consequence`; it accepts either `proposal_id,state` (fresh create allowed by OpenAPI) or those keys plus a valid `created_at` (the current BFF Go view used by list/get).
- `ready` has exactly `proposal_id,state,normalized_text,consequence,created_at`.
- Terminal states allow only those five public keys; any optional key present must pass the same type/enum/date validation.
- Create text is trimmed, 1–2,000 Unicode code points as measured by `Array.from(text).length`. Candidate requires a scope; recruiter rejects a provided scope.

Request builders produce only these list forms before adding an opaque cursor:

```text
candidate all rules:       /api/v1/me/agent-rules
candidate global rules:    /api/v1/me/agent-rules?scope=global
candidate intention rules: /api/v1/me/agent-rules?scope=intention&intention_id=int_<32 lowercase hex>
recruiter all rules:       /api/v1/recruiter/agent-rules
candidate proposals:       /api/v1/me/agent-rule-proposals?state=interpreting|ready
recruiter proposals:       /api/v1/recruiter/agent-rule-proposals?state=interpreting|ready
```

Append `&cursor=` when a query already exists and `?cursor=` otherwise. The recruiter Rule list rejects any filter argument.

Replacement request bodies are role-aware and reuse the base Rule's scope only for candidate:

```ts
const body = role === 'candidate'
  ? { text, scope: rule.scope }
  : { text };
```

Compose the facade in `HTTP招聘数据源.ts`:

```ts
export type HTTP招聘数据源 = 会话数据源 & 目录数据源 & 简历数据源 &
  意向数据源 & 岗位数据源 & 组织数据源 & Agent规则数据源;

return {
  ...创建会话数据源(请求),
  ...创建目录数据源(请求),
  ...创建简历数据源(请求),
  ...创建意向数据源(请求),
  ...创建岗位数据源(请求, deps.后端环境, deps.附属存储),
  ...创建组织数据源(请求),
  ...创建Agent规则数据源(请求),
};
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run src/数据/招聘数据源/Agent规则.test.ts src/数据/HTTP招聘数据源.test.ts src/数据/HTTP客户端.test.ts
```

Expected: PASS, including duplicate-cursor and ETag mismatch cases.

- [ ] **Step 5: Commit the wire boundary**

```bash
git add src/数据/BFF契约.ts src/数据/招聘数据源/Agent规则.ts src/数据/招聘数据源/Agent规则.test.ts src/数据/HTTP招聘数据源.ts src/数据/HTTP招聘数据源.test.ts src/测试/BFF样本.ts
git commit -m "feat: add P6 agent rule data facade"
```

---

### Task 2: Add Owner-Safe Mapping and Backend Hydration Actions

**Files:**
- Modify: `src/数据/类型.ts`
- Create: `src/数据/Agent规则映射.ts`
- Create: `src/数据/Agent规则映射.test.ts`
- Modify: `src/状态/领域/Agent规则.ts`
- Create: `src/状态/领域/Agent规则.test.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: Task 1 `BFFAgent规则` and current Mock Rule reducers.
- Produces: enriched `规则`, `映射Agent规则快照`, and Backend hydration/clear actions.

```ts
export interface 规则映射结果 {
  全局: 规则[];
  意向级: 规则[];
}

export function 映射候选Agent规则(
  rules: BFFAgent规则[],
  intentions: Record<string, BFFOwnerIntention>,
): 规则映射结果;

export function 映射招聘Agent规则(rules: BFFAgent规则[]): 规则[];
```

- [ ] **Step 1: Write failing mapping and reducer tests**

Add exact mapping expectations:

```ts
it('maps candidate global/intention rules and fails closed on orphan scope', () => {
  const intentions = {
    int_0123456789abcdef0123456789abcdef: {
      ...BFF意向样本,
      intention_id: 'int_0123456789abcdef0123456789abcdef',
      job_category: { id: 'tax_product', display_name: 'AI 产品经理' },
    },
  };
  const mapped = 映射候选Agent规则([
    BFFAgent规则样本,
    BFF意向Agent规则样本,
    { ...BFF意向Agent规则样本, rule_id: 'rul_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', scope: {
      type: 'intention', intention_id: 'int_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    } },
  ], intentions);

  expect(mapped.全局).toHaveLength(1);
  expect(mapped.意向级).toEqual([expect.objectContaining({
    编号: BFF意向Agent规则样本.rule_id,
    内容: BFF意向Agent规则样本.display_text,
    生效: true,
    作用域: { 类型: '意向', 意向编号: 'int_0123456789abcdef0123456789abcdef' },
    服务端版本: BFF意向Agent规则样本.version,
    服务端状态: BFF意向Agent规则样本.state,
  })]);
});

it('backend hydration replaces Mock arrays and clear empties only P6 rows', () => {
  const candidate = 归约Agent规则(初始状态, {
    型: '水合后端候选规则', 全局: [后端全局规则], 意向级: [后端意向规则],
  });
  expect(candidate.全局规则).toEqual([后端全局规则]);
  expect(candidate.意向级规则).toEqual([后端意向规则]);

  const recruiter = 归约Agent规则(candidate, {
    型: '水合后端招聘规则', 规则: [后端招聘规则],
  });
  expect(recruiter.企业规则).toEqual([后端招聘规则]);

  expect(归约Agent规则(recruiter, { 型: '清后端Agent规则' })).toMatchObject({
    全局规则: [], 意向级规则: [], 企业规则: [],
  });
});
```

Retain tests proving every current Mock action (`新增规则`, `改规则`, `删规则`, both toggle actions, and four enterprise actions) still has the same result and Rule numbering.

- [ ] **Step 2: Run mapping/reducer tests and verify RED**

Run:

```bash
npx vitest run src/数据/Agent规则映射.test.ts src/状态/领域/Agent规则.test.ts src/状态/应用状态.test.ts
```

Expected: FAIL because server metadata, mappers, and hydration actions do not exist.

- [ ] **Step 3: Implement the enriched Rule and closed hydration actions**

Extend `规则` without making Mock fixtures verbose:

```ts
export interface 规则 {
  编号: string;
  内容: string;
  来源: string;
  生效: boolean;
  作用域?: { 类型: '全局' } | { 类型: '意向'; 意向编号: string };
  服务端版本?: number;
  服务端状态?: 'active' | 'paused' | 'archived';
}
```

Map `active` to `生效:true`, `paused` to `false`, and omit `archived`. Candidate intention rules whose intention is absent or archived are omitted rather than reassigned to global. Use deterministic owner-safe source lines:

```ts
const 来源 = dto.scope.type === 'global'
  ? `全局 · 更新于 ${dto.updated_at.slice(0, 10)}`
  : `意向「${intentions[dto.scope.intention_id].job_category.display_name}」 · 更新于 ${dto.updated_at.slice(0, 10)}`;
```

Add the actions exactly:

```ts
| { 型: '水合后端候选规则'; 全局: 规则[]; 意向级: 规则[] }
| { 型: '水合后端招聘规则'; 规则: 规则[] }
| { 型: '清后端Agent规则' }
```

Route these three cases through `归约Agent规则` in the root reducer. Do not mode-check inside the reducer; operation/session layers own the mode boundary.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run src/数据/Agent规则映射.test.ts src/状态/领域/Agent规则.test.ts src/状态/应用状态.test.ts
```

Expected: PASS with Mock behavior unchanged and orphan intention rules absent.

- [ ] **Step 5: Commit the projection boundary**

```bash
git add src/数据/类型.ts src/数据/Agent规则映射.ts src/数据/Agent规则映射.test.ts src/状态/领域/Agent规则.ts src/状态/领域/Agent规则.test.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts
git commit -m "feat: map authoritative agent rules"
```

---

### Task 3: Implement Backend Rule and Proposal Operations

**Files:**
- Modify: `src/状态/后端/类型.ts`
- Create: `src/状态/后端/Agent规则操作.ts`
- Create: `src/状态/后端/Agent规则操作.test.ts`
- Modify: `src/状态/应用状态.tsx`

**Interfaces:**
- Consumes: Tasks 1–2 facade and mapping functions, plus existing shared lock/session cleanup.
- Produces: raw snapshots, hydration markers, `Agent规则操作`, and `水合Agent规则角色数据` for Task 4.

```ts
export type Agent规则水合阶段 = '未开始' | '进行中' | '成功' | '失败';

export interface Agent规则角色水合状态 {
  rules: Agent规则水合阶段;
  proposals: Agent规则水合阶段;
}

export interface Agent规则操作 {
  刷新Agent规则(): Promise<void>;
  创建Agent规则提案(input: { 文本: string; 作用域?: BFFAgent规则作用域 }): Promise<string>;
  创建Agent规则替换提案(ruleId: string, text: string): Promise<string>;
  刷新Agent规则提案(proposalId: string): Promise<void>;
  接受Agent规则提案(proposalId: string): Promise<void>;
  放弃Agent规则提案(proposalId: string): Promise<void>;
  切换Agent规则(ruleId: string, operation: 'pause' | 'resume'): Promise<void>;
  删除Agent规则(ruleId: string): Promise<void>;
}

export async function 水合Agent规则角色数据(
  deps: Pick<后端操作依赖, '后端' | '派发' | '设后端状态' | '主体标识引用' | '会话代际'> &
    { 后端: HTTP招聘数据源 },
  role: BFF角色,
  subjectId: string,
  generation: number,
): Promise<PromiseSettledResult<unknown>[]>;

export function 取Agent规则错误文案(error: unknown): string;
```

Extend `后端状态` with:

```ts
候选规则快照: Record<string, BFFAgent规则>;
招聘规则快照: Record<string, BFFAgent规则>;
候选规则提案: Record<string, BFFAgent规则提案>;
招聘规则提案: Record<string, BFFAgent规则提案>;
Agent规则水合: Record<BFF角色, Agent规则角色水合状态>;
```

- [ ] **Step 1: Write failing operation lifecycle tests**

Build test deps with a mutable `后端状态引用`, `状态引用`, `会话代际`, `主体标识引用`, dispatch recorder, and facade mocks. Define this helper in the test file so stale-response cases are self-contained:

```ts
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
```

Cover these exact assertions:

```ts
it('create stores a Proposal and does not append a Rule', async () => {
  数据源.创建Agent规则提案.mockResolvedValue(BFFAgent规则解释中提案样本);
  const before = 页面状态.全局规则;
  const id = await 操作.创建Agent规则提案({ 文本: '大小周不谈', 作用域: { type: 'global' } });
  expect(id).toBe(BFFAgent规则解释中提案样本.proposal_id);
  expect(派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '新增规则' }));
  expect(页面状态.全局规则).toBe(before);
  expect(最新后端状态().候选规则提案[id]).toEqual(BFFAgent规则解释中提案样本);
});

it('accept refreshes authoritative Rules and removes terminal Proposal', async () => {
  数据源.接受Agent规则提案.mockResolvedValue(BFFAgent规则样本);
  数据源.读取Agent规则.mockResolvedValue([BFFAgent规则样本]);
  数据源.读取Agent规则提案列表
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  await 操作.接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
  expect(数据源.接受Agent规则提案).toHaveBeenCalledWith('candidate', BFFAgent规则就绪提案样本.proposal_id);
  expect(派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '水合后端候选规则' }));
  expect(最新后端状态().候选规则提案).toEqual({});
});

it('version conflict re-reads but never replays the mutation', async () => {
  数据源.修改Agent规则.mockRejectedValue(new BFF错误(409, 'version_conflict', 'conflict'));
  数据源.读取Agent规则.mockResolvedValue([{ ...BFFAgent规则样本, version: 4, state: 'paused' }]);
  await expect(操作.切换Agent规则(BFFAgent规则样本.rule_id, 'pause')).rejects.toMatchObject({ code: 'version_conflict' });
  expect(数据源.修改Agent规则).toHaveBeenCalledTimes(1);
  expect(数据源.读取Agent规则).toHaveBeenCalledTimes(1);
});
```

Also cover candidate scope required; `agent_rule_scope_denied` preserves text and refreshes authoritative intentions, while an intention response arriving after a subject/generation change commits nothing; recruiter scope rejected before the facade; replacement uses raw current Rule and preserves the edit text outside state; dismiss removes only a terminal Proposal; accept/dismiss `agent_rule_proposal_not_ready|not_actionable|terminal|idempotency_conflict` recovery via GET Proposal; a known proposal ID on `idempotency_conflict` updates the addressed raw Proposal snapshot through `刷新Agent规则提案` before the error is rethrown; create/replacement `idempotency_conflict` reloads actionable lists without replay; 404/503/network reconciliation; 401 calls `清账号状态`; locks suppress duplicate same-key mutations; different Rule/Proposal keys run independently; role/subject/generation changes discard late results. Pin the five P6 error codes to the exact Chinese copy below and prove an unrelated error falls back to `取后端错误文案`.

- [ ] **Step 2: Run operation tests and verify RED**

Run:

```bash
npx vitest run src/状态/后端/Agent规则操作.test.ts
```

Expected: FAIL because the raw P6 state and operation factory do not exist.

- [ ] **Step 3: Implement authoritative snapshot commits and recovery**

Use these internal helpers and keys:

```ts
const 空水合状态: Agent规则角色水合状态 = { rules: '未开始', proposals: '未开始' };

function 当前角色(state: 后端状态): BFF角色 | null {
  return state.主体?.last_used_role ?? null;
}

function 仍是当前会话(deps: 会话Fence依赖, subjectId: string, generation: number): boolean {
  return deps.主体标识引用.current === subjectId && deps.会话代际.current === generation;
}

function 转表<T extends { rule_id: string }>(items: T[]): Record<string, T>;
function 转提案表(items: BFFAgent规则提案[]): Record<string, BFFAgent规则提案>;
```

Inside `创建Agent规则操作`, keep a per-Proposal generation map in addition to the session fence. A poll/read captures the current number; accept/dismiss increments it before sending, so a late GET cannot overwrite a terminal result with an older `interpreting` receipt:

```ts
const 提案代际 = new Map<string, number>();

function 当前提案代际(id: string): number {
  return 提案代际.get(id) ?? 0;
}

function 推进提案代际(id: string): number {
  const next = 当前提案代际(id) + 1;
  提案代际.set(id, next);
  return next;
}

function 提案响应仍新鲜(id: string, captured: number): boolean {
  return 当前提案代际(id) === captured;
}
```

Hydration uses `Promise.allSettled` for Rules, interpreting Proposals, and ready Proposals. Before starting the three reads it marks both domains `进行中`. It commits Rules and marks `rules:'成功'` when the Rule read is fulfilled; it commits the merged Proposal table and marks `proposals:'成功'` only when both Proposal reads are fulfilled. Each rejected domain is marked `失败` independently. It returns all three settled results so the session layer can detect any 401. A call to `刷新Agent规则()` captures the current role/subject/generation and reruns this complete `水合Agent规则角色数据` path—one Rule list plus both `interpreting` and `ready` Proposal lists—rather than refreshing only Rules.

Failed hydration never loads Mock rows. Do not map candidate intention Rules inside the async operation: Rule and Intention requests finish independently, so mapping there can race an older intention snapshot. Add an operation test which starts from a failed Proposal stage, calls `刷新Agent规则()`, asserts exactly one Rule read plus `interpreting` and `ready` reads, and observes both stages become `成功`.

Use lock keys exactly:

```text
Agent规则:new:candidate
Agent规则:new:recruiter
Agent规则:<rule_id>
Agent提案:<proposal_id>
```

Mutation recovery matrix:

| Operation | After uncertain/404/409/503/network result |
|---|---|
| create/replacement | reload both actionable Proposal lists; without a known receipt keep input in component and throw |
| accept/dismiss | GET Proposal, then reload Rules/actionable lists according to terminal state |
| pause/resume/archive | reload all Rules once; never send the mutation again |

Handle named conflicts before the generic status fallback:

```ts
async function 处理提案冲突(
  错误: BFF错误,
  role: BFF角色,
  subjectId: string,
  generation: number,
  proposalId?: string,
): Promise<never> {
  if (错误.code === 'agent_rule_scope_denied' && role === 'candidate') {
    const intentions = await 后端.读取意向();
    if (!仍是当前会话(deps, subjectId, generation)) throw 错误;
    派发({ 型: '水合后端意向', 快照: intentions });
    设后端状态((旧) => ({ ...旧, 意向快照: intentions.服务端 }));
  }
  if (错误.code === 'idempotency_conflict') {
    if (proposalId !== undefined) await 刷新Agent规则提案(proposalId);
    await 刷新Agent规则();
  }
  throw 错误;
}
```

An idempotency conflict is never retried and never converted to success merely because the re-read Proposal remains `ready`.

All mutation call sites pass the subject ID and session generation captured before sending the request. The P6 copy mapper is closed over the named service errors and falls back for everything else:

```ts
export function 取Agent规则错误文案(error: unknown): string {
  if (error instanceof BFF错误) {
    switch (error.code) {
      case 'agent_rule_proposal_not_ready':
        return 'AI代理还在理解这条规则，请稍后再试';
      case 'agent_rule_proposal_not_actionable':
        return '这条内容暂时不能成为长期规则，请放弃或换一种说法';
      case 'agent_rule_proposal_terminal':
        return '这条规则提案已经处理，请查看最新状态';
      case 'idempotency_conflict':
        return '这次操作与之前的请求冲突，请检查最新状态后重试';
      case 'agent_rule_scope_denied':
        return '这个意向已不可用，请重新选择规则范围';
    }
  }
  return 取后端错误文案(error);
}
```

`刷新Agent规则提案` replaces/removes only the addressed Proposal if the response is authoritative; it does not alter Rule arrays. `accepted` triggers a Rule refresh; `dismissed` removes the card; `failed` remains available to the page for the failure message until the page acknowledges it locally.

Mock branches dispatch only the existing synchronous actions:

```ts
创建Agent规则提案({ 文本 })              -> 新增规则 / 企业新增规则
创建Agent规则替换提案(ruleId, text)      -> 改规则 / 企业改规则
切换Agent规则(ruleId)                    -> 切规则开关 / 企业切规则开关
删除Agent规则(ruleId)                    -> 删规则 / 企业删规则
```

Return a synthetic empty string from Mock create/replacement because Mock pages close immediately and never poll or render a Proposal card. `接受Agent规则提案` and `放弃Agent规则提案` are no-ops in Mock because no Mock Proposal exists.

- [ ] **Step 4: Run operation tests and verify GREEN**

Run:

```bash
npx vitest run src/状态/后端/Agent规则操作.test.ts src/状态/领域/Agent规则.test.ts
```

Expected: PASS with no automatic mutation replay.

- [ ] **Step 5: Compose the operation factory and derive page projections from raw state**

Import `创建Agent规则操作` in `应用状态.tsx`, extend `应用操作` with `Agent规则操作`, initialize all five P6 state members, and spread the factory beside existing domains:

```ts
return {
  ...创建会话操作(deps),
  ...创建候选操作(deps),
  ...创建岗位操作(deps),
  ...创建组织操作(deps),
  ...创建Agent规则操作(deps),
};
```

In the same Provider, derive page arrays whenever either authoritative input changes. This keeps candidate intention grouping correct regardless of whether the Rule or Intention request finishes first:

```ts
useEffect(() => {
  if (!是后端 || 后端状态.Agent规则水合.candidate.rules !== '成功') return;
  const mapped = 映射候选Agent规则(
    Object.values(后端状态.候选规则快照),
    后端状态.意向快照,
  );
  派发({ 型: '水合后端候选规则', 全局: mapped.全局, 意向级: mapped.意向级 });
}, [是后端, 后端状态.Agent规则水合.candidate.rules, 后端状态.候选规则快照, 后端状态.意向快照]);

useEffect(() => {
  if (!是后端 || 后端状态.Agent规则水合.recruiter.rules !== '成功') return;
  派发({
    型: '水合后端招聘规则',
    规则: 映射招聘Agent规则(Object.values(后端状态.招聘规则快照)),
  });
}, [是后端, 后端状态.Agent规则水合.recruiter.rules, 后端状态.招聘规则快照]);
```

The effects consume only raw BFF snapshots and never Mock arrays. `清账号状态` still dispatches `清后端Agent规则` synchronously before the next subject/role is rendered.

- [ ] **Step 6: Run Context tests and commit**

Add a Context regression case where candidate Rules arrive first and Intentions arrive on a later render. Assert the global Rule appears immediately, the intention Rule is initially omitted, and the same raw intention Rule appears under the authoritative intention name after `意向快照` updates:

```tsx
expect(readState().全局规则.map((rule) => rule.编号)).toEqual([BFFAgent规则样本.rule_id]);
expect(readState().意向级规则).toEqual([]);
act(() => resolveIntentions({
  int_0123456789abcdef0123456789abcdef: BFF意向样本,
}));
await waitFor(() => {
  expect(readState().意向级规则.map((rule) => rule.编号)).toEqual([BFF意向Agent规则样本.rule_id]);
});
```

This proves request completion order cannot permanently hide or mis-group a Rule.

Run:

```bash
npx vitest run src/状态/后端/Agent规则操作.test.ts src/状态/应用状态.test.ts
```

Expected: PASS and `use应用状态().操作` exposes all eight P6 methods.

```bash
git add src/状态/后端/类型.ts src/状态/后端/Agent规则操作.ts src/状态/后端/Agent规则操作.test.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts
git commit -m "feat: add P6 agent rule operations"
```

---

### Task 4: Integrate Session Hydration, Cleanup, and Backend Seeds

**Files:**
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/后端/会话操作.test.ts`
- Modify: `src/状态/初始状态.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: Task 3 `水合Agent规则角色数据`, raw snapshots, and hydration markers.
- Produces: login/restore/role-switch P6 hydration with full cleanup and Backend first-frame isolation.

- [ ] **Step 1: Add failing Backend seed and session tests**

Define the same local `deferred<T>()` helper shown in Task 3 at the top of `会话操作.test.ts`; each test file remains self-contained. Pin the Backend seed and role lifecycle:

```ts
it('backend seed contains no Mock Rule rows', () => {
  const state = 创建初始状态(backend数据源);
  expect(state.全局规则).toEqual([]);
  expect(state.意向级规则).toEqual([]);
  expect(state.企业规则).toEqual([]);
});

it('candidate hydration commits Rules and both actionable Proposal states', async () => {
  await 水合角色数据(deps, candidate主体, true, 7);
  expect(后端.读取Agent规则).toHaveBeenCalledWith('candidate');
  expect(后端.读取Agent规则提案列表.mock.calls).toEqual([
    ['candidate', 'interpreting'],
    ['candidate', 'ready'],
  ]);
  expect(最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
});

it('role switch clears old P6 state before target hydration and discards late responses', async () => {
  const lateCandidate = deferred<BFFAgent规则[]>();
  后端.读取Agent规则.mockReturnValueOnce(lateCandidate.promise);
  const candidateRun = 水合角色数据(deps, candidate主体, true, 10);
  deps.主体标识引用.current = recruiter主体.subject_id;
  deps.会话代际.current = 11;
  await 水合角色数据(deps, recruiter主体, true, 11);
  lateCandidate.resolve([BFFAgent规则样本]);
  await candidateRun;
  expect(最新后端状态().候选规则快照).toEqual({});
});
```

Also assert each P6 domain is `进行中` while its reads are outstanding, a rejected Rule or Proposal domain becomes `失败`, and the successful sibling remains `成功`. Assert logout, 401, new subject, and `last_used_role:null` clear raw dictionaries, reset both roles to `未开始`, and clear all three page Rule arrays. P6 failure must not roll back successful Resume/Intentions/Privacy/Jobs/Organization hydration.

- [ ] **Step 2: Run session tests and verify RED**

Run:

```bash
npx vitest run src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
```

Expected: FAIL because session hydration and cleanup do not include P6.

- [ ] **Step 3: Implement P6 session composition**

In `清账号状态`, dispatch `清后端Agent规则` and reset:

```ts
候选规则快照: {},
招聘规则快照: {},
候选规则提案: {},
招聘规则提案: {},
Agent规则水合: {
  candidate: { rules: '未开始', proposals: '未开始' },
  recruiter: { rules: '未开始', proposals: '未开始' },
},
```

Before any subject or role transition, perform the same reset and advance the existing `会话代际`. In `水合角色数据`, add P6 to the role branch without coupling it to other domain success. Keep the existing Resume/Intentions/Organization/Jobs commit code in place; collect its settled results into `角色域结果`, then combine only for the shared 401 scan:

```ts
const p6Promise = 水合Agent规则角色数据(
  { 后端, 派发, 设后端状态, 主体标识引用, 会话代际 },
  role,
  主体.subject_id,
  本次代际,
);
const 角色域结果: PromiseSettledResult<unknown>[] = role === 'candidate'
  ? await Promise.allSettled([
      后端.读取简历(),
      后端.读取意向(),
    ])
  : await Promise.allSettled([
      水合招聘方组织数据(deps, 主体.subject_id, 本次代际),
      后端.读取岗位(),
    ]);
const p6Results = await p6Promise;
const allResults = [...角色域结果, ...p6Results];
```

Evaluate 401 across `allResults`; non-401 P6 failures remain isolated and are surfaced with the existing error strategy. Do not seed Rule rows from `初始状态` after any failure.

In `创建初始状态`, explicitly override only the three Rule arrays for Backend mode:

```ts
全局规则: [],
意向级规则: [],
企业规则: [],
```

- [ ] **Step 4: Run hydration and stale-response tests**

Run:

```bash
npx vitest run src/状态/后端/会话操作.test.ts src/状态/后端/Agent规则操作.test.ts src/状态/应用状态.test.ts
```

Expected: PASS; no test observes a candidate Rule after switching to recruiter or a prior subject.

- [ ] **Step 5: Commit session integration**

```bash
git add src/状态/后端/会话操作.ts src/状态/后端/会话操作.test.ts src/状态/初始状态.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts
git commit -m "feat: hydrate P6 rules with sessions"
```

---

### Task 5: Build the Proposal Card and Page-Scoped Polling

**Files:**
- Create: `src/组件/Agent规则提案卡.tsx`
- Create: `src/组件/Agent规则提案卡.module.css`
- Create: `src/组件/Agent规则提案卡.test.tsx`
- Create: `src/状态/后端/useAgent规则提案轮询.ts`
- Create: `src/状态/后端/useAgent规则提案轮询.test.tsx`

**Interfaces:**
- Consumes: Task 1 `BFFAgent规则提案` and Task 3 `刷新Agent规则提案`.
- Produces: reusable card and polling hook for both canonical pages.

```ts
export interface Agent规则提案卡属性 {
  提案: BFFAgent规则提案;
  忙: boolean;
  接受: () => void;
  放弃: () => void;
  关闭失败: () => void;
}

export function useAgent规则提案轮询(input: {
  开启: boolean;
  提案: BFFAgent规则提案[];
  刷新: (proposalId: string) => Promise<void>;
  间隔毫秒?: number;
}): void;
```

- [ ] **Step 1: Write failing card and fake-timer tests**

Define this helper in `useAgent规则提案轮询.test.tsx`:

```ts
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
```

```tsx
it('renders the four frozen consequence summaries and explicit actions', async () => {
  const user = userEvent.setup();
  const 接受 = vi.fn();
  const 放弃 = vi.fn();
  render(<Agent规则提案卡 提案={{
    ...BFFAgent规则就绪提案样本,
    normalized_text: '不考虑大小周岗位',
    consequence: 'auto_deny',
  }} 忙={false} 接受={接受} 放弃={放弃} 关闭失败={vi.fn()} />);
  expect(screen.getByText('不考虑大小周岗位')).toBeInTheDocument();
  expect(screen.getByText('命中条件时，AI代理会自动拦下')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '确认规则' }));
  await user.click(screen.getByRole('button', { name: '放弃' }));
  expect(接受).toHaveBeenCalledTimes(1);
  expect(放弃).toHaveBeenCalledTimes(1);
});

it('polls interpreting Proposals single-flight and stops at terminal state', async () => {
  vi.useFakeTimers();
  const pending = deferred<void>();
  const 刷新 = vi.fn(() => pending.promise);
  const { rerender, unmount } = renderHook(
    ({ 提案 }) => useAgent规则提案轮询({ 开启: true, 提案, 刷新, 间隔毫秒: 2000 }),
    { initialProps: { 提案: [BFFAgent规则解释中提案样本] } },
  );
  await vi.advanceTimersByTimeAsync(4000);
  expect(刷新).toHaveBeenCalledTimes(1);
  pending.resolve();
  await vi.runAllTicks();
  rerender({ 提案: [BFFAgent规则就绪提案样本] });
  await vi.advanceTimersByTimeAsync(4000);
  expect(刷新).toHaveBeenCalledTimes(1);
  unmount();
  vi.useRealTimers();
});
```

Add card cases for interpreting (no actions), failed (exact failure copy plus close), accepted/dismissed (renders nothing), all four consequence values, and busy disabling. Add polling cases for disabled Backend hydration, multiple Proposal IDs, unmount cleanup, changing role input, and late promise completion after unmount.

- [ ] **Step 2: Run component/hook tests and verify RED**

Run:

```bash
npx vitest run src/组件/Agent规则提案卡.test.tsx src/状态/后端/useAgent规则提案轮询.test.tsx
```

Expected: FAIL because neither component nor hook exists.

- [ ] **Step 3: Implement the closed card and single-flight hook**

Use the exact consequence map:

```ts
export const Agent规则后果文案: Record<BFFAgent规则后果, string> = {
  auto_allow: '符合条件时，AI代理可以自动推进',
  auto_deny: '命中条件时，AI代理会自动拦下',
  advisory: '这是一条参考偏好，不会单独触发自动决定',
  mixed: '这条规则同时包含推进、拦截或参考条件',
};
```

The hook holds an in-flight `Set<string>` in a ref, schedules one 2-second interval, filters only `state === 'interpreting'`, and deletes each ID from the set in `finally`. Cleanup clears the interval and flips a mounted/epoch ref so an old page cannot schedule follow-up work. The operation layer still owns session/proposal-generation state fences.

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npx vitest run src/组件/Agent规则提案卡.test.tsx src/状态/后端/useAgent规则提案轮询.test.tsx
```

Expected: PASS with fake timers restored after each test.

```bash
git add src/组件/Agent规则提案卡.tsx src/组件/Agent规则提案卡.module.css src/组件/Agent规则提案卡.test.tsx src/状态/后端/useAgent规则提案轮询.ts src/状态/后端/useAgent规则提案轮询.test.tsx
git commit -m "feat: add agent rule proposal confirmation"
```

---

### Task 6: Wire the Candidate and Recruiter Canonical Rule Pages

**Files:**
- Modify: `src/屏幕/规则库.tsx`
- Modify: `src/屏幕/规则库.module.css`
- Create: `src/屏幕/规则库.test.tsx`
- Modify: `src/屏幕/企业代理设置.tsx`
- Modify: `src/屏幕/企业代理设置.module.css`
- Create: `src/屏幕/企业代理设置.test.tsx`

**Interfaces:**
- Consumes: Tasks 3–5 state, operations, Proposal card, and polling hook.
- Produces: complete candidate/recruiter P6-A user journeys.

- [ ] **Step 1: Write failing candidate page tests**

Render under the real application Context test harness and cover:

```tsx
it('Backend candidate groups by authoritative intention and creates an intention-scoped Proposal', async () => {
  const user = userEvent.setup();
  renderCandidateRules({ mode: 'backend', rulesStage: '成功', proposalsStage: '成功', initialized: true });
  expect(screen.getByText('意向规则 · AI 产品经理')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
  await user.selectOptions(screen.getByLabelText('规则范围'), 'int_0123456789abcdef0123456789abcdef');
  await user.type(screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤'), '只接受双休');
  await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
  expect(操作.创建Agent规则提案).toHaveBeenCalledWith({
    文本: '只接受双休',
    作用域: { type: 'intention', intention_id: 'int_0123456789abcdef0123456789abcdef' },
  });
  expect(screen.queryByText('只接受双休')).not.toBeInTheDocument();
});
```

Add tests for global default, replacement preserving old Rule until accept, archive by current ID, `interpreting/ready/failed` cards, active count, no Mock rows/count before Rule hydration, orphan rules absent, operation error preserving draft, `agent_rule_proposal_not_actionable` rephrase copy, `agent_rule_scope_denied` preserving text and showing `这个意向已不可用，请重新选择规则范围`, `idempotency_conflict` preserving the card/draft without success copy, and composing Enter not submitting. Extend the Context harness to return `setHydration(next: Agent规则角色水合状态)` so retry completion can be observed without replacing the real Provider. Add these partial/in-flight hydration cases:

```tsx
it('shows loaded Rules and a retry affordance when Proposal hydration failed', async () => {
  const user = userEvent.setup();
  const { setHydration } = renderCandidateRules({
    mode: 'backend', rulesStage: '成功', proposalsStage: '失败', initialized: true,
  });
  操作.刷新Agent规则.mockImplementation(async () => {
    setHydration({ rules: '成功', proposals: '成功' });
  });
  expect(screen.getByText(BFFAgent规则样本.display_text)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /手动添加规则/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '规则加载失败，重试' }));
  expect(操作.刷新Agent规则).toHaveBeenCalledTimes(1);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /手动添加规则/ })).toBeInTheDocument();
  });
  expect(screen.queryByRole('button', { name: '规则加载失败，重试' })).not.toBeInTheDocument();
});

it('shows a loading shell without a retry affordance while P6 hydration is in flight', () => {
  renderCandidateRules({
    mode: 'backend', rulesStage: '进行中', proposalsStage: '进行中', initialized: true,
  });
  expect(screen.getByRole('status', { name: '规则加载中' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '规则加载失败，重试' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Write failing recruiter page tests**

```tsx
it('Backend recruiter toggles active Rule through pause and never sends a scope', async () => {
  const user = userEvent.setup();
  renderRecruiterRules({ mode: 'backend', rulesStage: '成功', proposalsStage: '成功', initialized: true });
  await user.click(screen.getByRole('switch', { name: `规则：${BFFAgent规则样本.display_text}` }));
  expect(操作.切换Agent规则).toHaveBeenCalledWith(BFFAgent规则样本.rule_id, 'pause');
  await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
  await user.type(screen.getByPlaceholderText(/到岗超过/), '竞对在职候选人不接触');
  await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
  expect(操作.创建Agent规则提案).toHaveBeenCalledWith({ 文本: '竞对在职候选人不接触' });
});
```

Add recruiter tests for paused→resume, count only active, no edit/delete UI, Proposal accept/dismiss, hydration shell, and the new explicit-confirmation copy replacing “任何叮嘱都会沉淀”.

- [ ] **Step 3: Run both page suites and verify RED**

Run:

```bash
npx vitest run src/屏幕/规则库.test.tsx src/屏幕/企业代理设置.test.tsx
```

Expected: FAIL because pages still dispatch synchronous Rule actions and hard-code the candidate intention group.

- [ ] **Step 4: Implement mode-aware canonical pages**

Read these Context fields once per page:

```ts
const { 状态, 派发, 数据源模式, 后端状态, 操作 } = use应用状态();
// 规则库.tsx uses 'candidate'; 企业代理设置.tsx uses 'recruiter'.
const expectedRole: BFF角色 = 'candidate';
const activeRole = 数据源模式 === 'backend' ? (后端状态.主体?.last_used_role ?? null) : null;
const role = activeRole === expectedRole ? expectedRole : null;
const roleHydration = role === null
  ? { rules: '未开始', proposals: '未开始' }
  : 后端状态.Agent规则水合[role];
const rulesReady = roleHydration.rules === '成功';
const proposalsReady = roleHydration.proposals === '成功';
const showRetry = role !== null &&
  (roleHydration.rules === '失败' || roleHydration.proposals === '失败');
```

Repeat the block in `企业代理设置.tsx` with `expectedRole: BFF角色 = 'recruiter'`. A direct visit to the wrong-role or unauthenticated route renders a safe shell: it neither indexes hydration with `undefined` nor exposes mutation controls for the active role under the other role's page.

Backend renders authoritative rows/counts whenever `rulesReady` is true. It renders create/edit/accept/dismiss controls and Proposal cards only when `rulesReady && proposalsReady`; `showRetry` renders a button named exactly `规则加载失败，重试` that awaits the complete `操作.刷新Agent规则()` hydration. A `未开始` or `进行中` domain renders a `role="status"` loading shell with accessible name `规则加载中`, and never the retry button or a second automatic hydration. Backend handlers await `操作`, catch with `轻提示(取Agent规则错误文案(error))`, and preserve local text/scope on failure. Both page suites assert the exact five P6 messages frozen in Task 3; the not-actionable, scope-denied, and idempotency cases additionally preserve their card/draft and show no success copy. Mock handlers keep current dispatches and close immediately. Candidate scope options come from active `状态.求职意向表` entries whose IDs exist in `后端状态.意向快照`; do not render a free-text ID option.

Get Proposal lists from the role-specific raw dictionary, sorted by `created_at` when present and then `proposal_id`. Call `useAgent规则提案轮询` only when Backend mode, the matching role is active, `proposalsReady` is true, and the page is mounted.

Exact UI actions:

```text
new candidate/recruiter: 提交给AI代理理解
ready proposal primary: 确认规则
ready proposal secondary: 放弃
candidate edit: 提交修改
candidate archive: 删除
recruiter active switch: pause
recruiter paused switch: resume
```

Keep the old Rule visible during replacement. The Proposal card is additional UI; no temporary Rule row or count increment appears.

- [ ] **Step 5: Run focused page and lifecycle tests**

Run:

```bash
npx vitest run src/屏幕/规则库.test.tsx src/屏幕/企业代理设置.test.tsx src/组件/Agent规则提案卡.test.tsx src/状态/后端/useAgent规则提案轮询.test.tsx src/状态/后端/Agent规则操作.test.ts
```

Expected: PASS for both Backend and Mock branches.

- [ ] **Step 6: Commit canonical pages**

```bash
git add src/屏幕/规则库.tsx src/屏幕/规则库.module.css src/屏幕/规则库.test.tsx src/屏幕/企业代理设置.tsx src/屏幕/企业代理设置.module.css src/屏幕/企业代理设置.test.tsx
git commit -m "feat: wire P6 canonical rule pages"
```

---

### Task 7: Isolate Non-Canonical Rule Entrypoints and Counts

**Files:**
- Modify: `src/屏幕/看市场.tsx`
- Create: `src/屏幕/看市场.test.tsx`
- Modify: `src/组件/候选筛选抽屉.tsx`
- Modify: `src/组件/候选筛选抽屉.module.css`
- Create: `src/组件/候选筛选抽屉.test.tsx`
- Modify: `src/屏幕/问AI代理.tsx`
- Modify: `src/屏幕/企业问AI代理.tsx`
- Modify: `src/屏幕/往来记录.tsx`
- Modify: `src/屏幕/企业往来记录.tsx`
- Modify: `src/屏幕/在谈详情.tsx`
- Modify: `src/屏幕/候选详情.tsx`
- Modify: `src/屏幕/代理详情.tsx`
- Modify: `src/屏幕/企业代理详情.tsx`
- Modify: `src/屏幕/我的.tsx`
- Modify: `src/屏幕/企业我的.tsx`
- Modify: `src/屏幕/企业在谈候选.tsx`
- Modify: `src/屏幕/候选推荐.tsx`

**Interfaces:**
- Consumes: Task 4 hydration markers and authoritative Rule arrays.
- Produces: one canonical write surface per role, no Backend Rule pollution, correct hydrated counts.

- [ ] **Step 1: Add failing filter drawer and pollution tests**

```tsx
it('Backend candidate filter layer is read-only and navigates to canonical rules', async () => {
  const user = userEvent.setup();
  renderMarketFilter({ mode: 'backend', hydrated: true });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /删除规则/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '管理规则 ›' }));
  expect(mockNavigate).toHaveBeenCalledWith(路径.规则库);
});

it('Backend recruiter drawer is read-only while Mock stays editable', async () => {
  const { rerender } = renderRecruiterDrawer({ mode: 'backend' });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  rerender(mockRecruiterDrawer());
  expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
});
```

Add focused tests proving each Ask-AI/Case page does not dispatch `新增规则`/`企业新增规则` in Backend mode and still does in Mock mode. Add count tests: Backend unhydrated renders no Mock number; hydrated counts only `生效:true`; Mock counts remain unchanged.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run src/屏幕/看市场.test.tsx src/组件/候选筛选抽屉.test.tsx src/屏幕/企业我的.test.tsx src/状态/应用状态.test.ts
```

Expected: FAIL because drawers still mutate Rules and Backend counts are not hydration-aware.

- [ ] **Step 3: Implement one shared mode boundary pattern**

At each non-canonical mutation site, use the existing Context mode rather than duplicating P6 operations:

```ts
const { 数据源模式, 派发 } = use应用状态();

if (数据源模式 === 'mock') {
  派发({ 型: '新增规则', 内容, 来源 });
}
```

For Backend mode, retain the surrounding demo action if it belongs to that page, but do not append Rule text or claim it became a standing Rule. Use a neutral toast such as `请到规则库确认并添加长期规则` or `请到AI代理设置确认并添加长期规则`, with canonical navigation only where the existing UI already has a management affordance.

Candidate/recruiter drawers render the same authoritative rows as plain text. They contain no inputs, delete buttons, blur-save behavior, or Proposal UI in Backend mode. Their “管理规则 ›” buttons navigate to `路径.规则库` and `路径.企业代理设置` respectively.

Count visibility is exact:

```ts
const 可显示候选规则数 = 数据源模式 === 'mock' || 后端状态.Agent规则水合.candidate.rules === '成功';
const 可显示招聘规则数 = 数据源模式 === 'mock' || 后端状态.Agent规则水合.recruiter.rules === '成功';
```

When false, omit the count node rather than rendering `0` or a Mock value.

- [ ] **Step 4: Run all affected focused tests**

Run:

```bash
npx vitest run src/屏幕/看市场.test.tsx src/组件/候选筛选抽屉.test.tsx src/屏幕/企业我的.test.tsx src/状态/应用状态.test.ts
```

Expected: PASS; then run the full Vitest suite to catch the many rule-count consumers:

```bash
npm test
```

Expected: PASS with zero failed test files.

- [ ] **Step 5: Commit the mode boundary**

```bash
git add src/屏幕/看市场.tsx src/屏幕/看市场.test.tsx src/组件/候选筛选抽屉.tsx src/组件/候选筛选抽屉.module.css src/组件/候选筛选抽屉.test.tsx src/屏幕/问AI代理.tsx src/屏幕/企业问AI代理.tsx src/屏幕/往来记录.tsx src/屏幕/企业往来记录.tsx src/屏幕/在谈详情.tsx src/屏幕/候选详情.tsx src/屏幕/代理详情.tsx src/屏幕/企业代理详情.tsx src/屏幕/我的.tsx src/屏幕/企业我的.tsx src/屏幕/企业在谈候选.tsx src/屏幕/候选推荐.tsx
git commit -m "feat: isolate backend agent rule entrypoints"
```

---

### Task 8: Add Mutable P6 Data-Source E2E Coverage

**Files:**
- Modify: `e2e/数据源模式.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–7 complete browser behavior.
- Produces: intercepted Backend proof for the entire P6-A lifecycle and zero-API Mock proof.

- [ ] **Step 1: Add mutable P6 fixture state and request receipts**

Inside the existing Backend fixture router, add typed in-memory state owned by each role:

```ts
interface P6FixtureState {
  rules: Record<'candidate' | 'recruiter', P6Rule[]>;
  proposals: Record<'candidate' | 'recruiter', P6Proposal[]>;
  proposalReads: Record<string, number>;
  mutationRequests: { method: string; path: string; body: unknown; ifMatch: string | null; idempotencyKey: string | null }[];
}

const p6: P6FixtureState = {
  rules: { candidate: [candidateGlobalRule, candidateIntentionRule], recruiter: [recruiterGlobalRule] },
  proposals: { candidate: [candidateInterpretingProposal, candidateReadyProposal], recruiter: [] },
  proposalReads: {},
  mutationRequests: [],
};
```

Route list pagination with two pages, transition an `interpreting` Proposal to `ready` on the second single GET, advance Rule versions on pause/resume, materialize new/replacement Rules only on accept, archive only when `If-Match` equals current version, and return fixed 409/503/response-loss branches selected by dedicated fixture IDs. Every successful JSON response must use the existing `信封()` helper; Rule responses include strong ETag.

Use `consequence:'mixed'` for the accept-success fixture, a separate `auto_deny` ready fixture to prove its safe-summary copy without browser-side gating, and a dedicated accept response returning `409 agent_rule_proposal_not_actionable` to prove authoritative recovery. The public consequence never selects the fixture's hidden actionability.

- [ ] **Step 2: Write the Backend happy-path browser test**

Cover this exact sequence:

```text
candidate restore
candidate Rule/Proposal hydration from fixture markers
global create -> interpreting -> ready -> accept -> active Rule
intention create sends the real fixture intention_id
replacement sends current If-Match and old Rule stays visible until accept
archive sends current If-Match
switch to recruiter
recruiter create sends no scope -> accept
pause -> resume with versions advancing on each response
```

Assert captured request bodies, `If-Match`, and non-empty `Idempotency-Key` values rather than relying only on visible copy.

- [ ] **Step 3: Write Backend recovery and isolation browser tests**

Add independent tests for:

- version conflict causes one authoritative GET and zero mutation replay;
- accept response loss converges via GET Proposal plus Rule list;
- old candidate response arriving after recruiter switch never appears;
- failed Proposal shows exact failure copy and preserves the original draft for re-entry;
- duplicate cursor produces the service-anomaly UI without Mock fallback;
- first hydration pending shows no Mock rows/count/write controls.

- [ ] **Step 4: Extend the Mock zero-request test**

Visit `/rules`, `/hr/agent-settings`, the candidate market filter, and recruiter candidate filter. Perform one Mock add/edit/toggle action and assert:

```ts
expect(apiRequests.filter((url) => url.includes('agent-rule'))).toEqual([]);
```

- [ ] **Step 5: Run P6 data-source E2E and verify GREEN**

Run:

```bash
npm run test:e2e:data-source -- --grep "P6|Mock.*规则"
```

Expected: PASS for Backend lifecycle/recovery and Mock zero-request cases.

- [ ] **Step 6: Commit E2E coverage**

```bash
git add e2e/数据源模式.spec.ts
git commit -m "test: cover P6 frontend lifecycle"
```

---

### Task 9: Verify P6 Standalone and Integrate the P3 Composition Root

**Files:**
- Review: all P6 files from Tasks 1–8
- Reconcile after P3 lands: `src/数据/BFF契约.ts`
- Reconcile after P3 lands: `src/数据/HTTP招聘数据源.ts`
- Reconcile after P3 lands: `src/数据/HTTP招聘数据源.test.ts`
- Reconcile after P3 lands: `src/测试/BFF样本.ts`
- Reconcile after P3 lands: `src/状态/后端/类型.ts`
- Reconcile after P3 lands: `src/状态/后端/会话操作.ts`
- Reconcile after P3 lands: `src/状态/后端/会话操作.test.ts`
- Reconcile after P3 lands: `src/状态/初始状态.ts`
- Reconcile after P3 lands: `src/状态/应用状态.tsx`
- Reconcile after P3 lands: `src/状态/应用状态.test.ts`
- Reconcile after P3 lands: `e2e/数据源模式.spec.ts`

**Interfaces:**
- Consumes: complete P6 branch and P3 implementation already merged to `origin/main`.
- Produces: one combined Context/data source/session hydration with both P3 and P6 gates green.

- [ ] **Step 1: Run standalone static and unit gates**

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: every command exits 0; Vitest reports zero failed files and Vite emits a production build.

- [ ] **Step 2: Run standalone browser gates**

```bash
npm run test:e2e
npm run test:e2e:data-source
```

Expected: both Playwright suites exit 0, including full P6 lifecycle and Mock zero-request coverage.

- [ ] **Step 3: Run the visual gate against the implementation base**

```bash
UI_VISUAL_GATE=enforce npm run ui:check -- --base eaa561e6a9d76c874804627b4e9a32c71c03419b
```

Expected: exit 0. If the harness creates screenshots or reports, verify `git status --short` and leave generated artifacts untracked/uncommitted according to the existing harness rules.

- [ ] **Step 4: Rebase only after P3 is present on origin/main**

First prove P3 landed:

```bash
git fetch origin
git log origin/main --oneline -- docs/superpowers/specs/2026-08-27-recruitment-p3-frontend-wiring-design.md
git grep -n "创建隐私数据源" origin/main -- src/数据/HTTP招聘数据源.ts
```

Expected: the log contains the approved P3 design history and `创建隐私数据源` is present in `origin/main`. If the grep is empty, stop this integration step and keep the verified P6 branch ready; do not invent P3 code.

When present:

```bash
git rebase origin/main
```

Resolve shared files by union, not by taking one side wholesale:

- `BFF契约.ts`: keep both Privacy/Search/HardRequirements DTOs and P6 Rule/Proposal DTOs.
- `HTTP招聘数据源.ts`: root type and factory contain both `隐私数据源` and `Agent规则数据源`.
- `后端/类型.ts`: keep Privacy snapshots/operations and all P6 raw snapshots/hydration markers/operations.
- `会话操作.ts`: candidate hydration includes Resume, Intentions, Privacy, Rules, interpreting Proposals, and ready Proposals; recruiter includes Jobs, Organization, Rules, and both Proposal states.
- `初始状态.ts`: Backend seed empties both Privacy fixture facts and all three Rule arrays; Mock seed remains unchanged.
- `应用状态.tsx`: spread both operation factories into the same `操作` object and initialize both domains in one backend state object.
- fixtures/tests/E2E: retain every P3 and P6 route and assertion.

- [ ] **Step 5: Run the combined P3/P6 gates**

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:e2e:data-source
UI_VISUAL_GATE=enforce npm run ui:check -- --base origin/main
```

Expected: all commands exit 0. Specifically, P3 Privacy/Search tests and all P6 Rule/Proposal tests both remain present and pass; the combined branch also passes the visual gate against the P3-containing integration base.

- [ ] **Step 6: Inspect scope and commit only an actual integration resolution**

```bash
git status --short
git diff --check
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
```

Expected: no backend-repository files, no generated UI artifacts, and no P6-B Case instruction files. If the rebase produced an explicit conflict-resolution diff after continuing, commit it with:

```bash
git add src/数据/BFF契约.ts src/数据/HTTP招聘数据源.ts src/数据/HTTP招聘数据源.test.ts src/测试/BFF样本.ts src/状态/后端/类型.ts src/状态/后端/会话操作.ts src/状态/后端/会话操作.test.ts src/状态/初始状态.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts e2e/数据源模式.spec.ts
git commit -m "chore: integrate P3 and P6 frontend wiring"
```

If Git reports there is nothing to commit, do not create an empty commit; the successful rebase and combined gates are the integration evidence.
