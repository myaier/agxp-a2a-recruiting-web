# Recruitment P4 Frontend Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing candidate job-market and recruiter anonymous-candidate pages to the final P4 BFF recommendation, refresh, feedback, and delegation contracts without leaking Mock facts or creating fake MatchCases.

**Architecture:** Add one strict P4 facade to the existing `HTTP招聘数据源`, retain owner-safe wire DTOs in backend-only scope snapshots, and expose reads/mutations through the existing application Context. Candidate and recruiter screens select mapped views from those snapshots; Mock screens keep the current reducer story, while Backend delegation stores and polls only real receipts and real `case_id` references.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Testing Library, Playwright 1.62, existing same-origin BFF HTTP client.

**Spec:** `docs/superpowers/specs/2026-08-28-recruitment-p4-frontend-wiring-design.md`

## Global Constraints

- Product-code baseline is `origin/main@96257a2683dfe775eda61b6076a9aab12ded9c9a`; the Spec/Plan commits are documentation-only changes on top of it.
- Backend truth source is `~/agxp-monorepo` `origin/release/0.2.5@d7353d9162343f95cbf3b70d1e9952c1f17e9ea2`, especially `apps/recruitment-bff/openapi/mobile-v1.yaml` and `apps/recruitment-bff/internal/recruitmentclient/discovery.go`.
- Scope is P4 finite discovery only. Do not add watch UI/routes, P5 Case pages/actions, P7 notifications, batch-selection UI, infinite search, or backend changes.
- Do not add a second Context, state library, generic query cache, HTTP client, dependency, or Mock-to-Backend migration.
- Backend mode never imports or falls back to `模拟数据`, `企业端模拟数据`, Mock IDs, company slugs, candidate identity, candidate salary numbers, or Mock MatchCases for P4 facts.
- Mock mode sends zero P4 recommendation/delegation requests and keeps the current immediate reducer behavior and demonstration MatchCase story.
- Candidate scope is the exact active `intention_id`; recruiter scope is the exact owned active `job_id`. Never infer either from display text or another resource.
- Read every discovery page with `limit=50`, encode each opaque cursor exactly once, reject empty/non-string/repeated/over-4096-byte cursors, and commit only after every page succeeds.
- A reload preserves the last successful snapshot. A partial page, malformed DTO, 503, or network error never clears or partially replaces that snapshot.
- Pull-to-refresh performs GET only. “让AI代理帮我搜” and “让代理再找一批” perform POST refresh and then GET; if the follow-up GET fails, the previous list remains visible.
- A refresh/delegation user intent owns one explicit Idempotency-Key. Controlled HTTP retry and a user retry after outcome uncertainty reuse it; `idempotency_conflict` never switches to a fresh key to force a second mutation.
- Candidate delegation always uses `selection: { items: [job_id] }` and literal `disclosure_acknowledged: true`, supplied only after the visible confirmation layer. Recruiter delegation uses `selection: { items: [recommendation_id] }` and never sends disclosure or candidate coordinates.
- Candidate confirmation copy is exact: `S0 通过后，本 Case 可按固定规则提交默认/已选 PDF，并向该招聘方披露姓名和联系方式。` It appears for every candidate delegation; cancellation sends zero requests and no authorization is remembered.
- `accepted` and `evaluating` may display `AI代理已接手`. Only `case_started` with a non-null `case_id` records a real Case reference. P4 never dispatches `委托入谈` or `接触推荐候选` in Backend mode and never navigates to a Mock in-talk page.
- Recruiter candidate DTOs never contain candidate subject, name, contact, gender, birth data, candidate salary digits, block facts, rules, or file coordinates. Missing fields are displayed as undisclosed/empty, never fabricated from Mock.
- “只看收藏” is local filtering over the completely loaded current available snapshot. “已筛掉” atomically aggregates `state=rejected` pages for all owned active Jobs.
- Preserve ordinary layout and CSS. The only approved visible additions are the candidate delegation confirmation layer and the recruiter filter drawer’s “只看收藏” switch.

## File Map

### New files

- `src/数据/招聘数据源/发现推荐.ts` — P4 paths, queries, explicit idempotency keys, pagination, and strict DTO decoders.
- `src/数据/招聘数据源/发现推荐.test.ts` — exact requests, DTO closure, pagination, cursor safety, and malformed-response tests.
- `src/数据/发现推荐映射.ts` — owner-safe CandidateJob/recruiter-card projections and closed display copy.
- `src/数据/发现推荐映射.test.ts` — candidate/recruiter mapping and privacy-canary tests.
- `src/状态/后端/发现推荐操作.ts` — scope reads, refresh, feedback, delegation, reconciliation, locks, fences, and error copy.
- `src/状态/后端/发现推荐操作.test.ts` — operation lifecycle, stale response, atomicity, idempotency, and cleanup tests.
- `src/状态/后端/use发现推荐委托轮询.ts` — visible-page 2-second single-flight receipt polling.
- `src/状态/后端/use发现推荐委托轮询.test.tsx` — fake-timer polling lifecycle tests.
- `src/组件/下拉刷新.test.tsx` — minimum-duration, pending-Promise, rejection-cleanup, and synchronous-callback tests.
- `src/屏幕/候选推荐.test.tsx` — recruiter Backend/Mock list, refresh, feedback, favorite filtering, and delegation tests.
- `src/屏幕/已筛候选.test.tsx` — cross-job rejected aggregation and undo tests.

### Existing files with focused changes

- `src/数据/BFF契约.ts` — P4 wire DTOs only.
- `src/数据/HTTP客户端.ts` and `.test.ts` — allow a caller-supplied Idempotency-Key while preserving existing generated-key behavior.
- `src/数据/HTTP招聘数据源.ts` and `.test.ts` — compose the P4 facade.
- `src/数据/招聘数据源类型.ts` — P4 page-view types shared by mapper and screens.
- `src/测试/BFF样本.ts` — valid P4 CandidateJob/card/preference/batch/receipt samples.
- `src/状态/后端/类型.ts` — P4 snapshots, runtime refs, and operation signatures.
- `src/状态/后端/会话操作.ts` and `.test.ts` — P4 account/role cleanup.
- `src/状态/初始状态.ts` — no Mock discovery seed in Backend mode.
- `src/状态/应用状态.tsx` and `src/状态/应用状态.test.ts` — initialize P4 backend state/refs and compose operations.
- `src/组件/下拉刷新.tsx` and new `.test.tsx` — await async refresh while keeping the existing minimum animation duration.
- `src/组件/候选筛选抽屉.tsx`, `.module.css`, and `.test.tsx` — approved “只看收藏” control.
- `src/屏幕/看市场.tsx`, `.module.css`, and `.test.tsx` — Backend candidate list/load/search/refresh/delegation boundary.
- `src/屏幕/职位详情.tsx` and `.test.tsx` — CandidateJob detail, feedback, and confirmation without Mock fallback.
- `src/屏幕/候选推荐.tsx` and `.module.css` — Backend recruiter list/refresh/feedback/delegation.
- `src/屏幕/匿名在线简历.tsx` and `.test.tsx` — authoritative detail GET and allowlisted rendering.
- `src/屏幕/已筛候选.tsx` — all-active-job rejected aggregation and undo.
- `e2e/数据源模式.spec.ts` — mutable P4 BFF fixtures and Backend/Mock journeys.

---

### Task 1: Freeze the P4 Wire Contract and Explicit Idempotency Seam

**Files:**
- Modify: `src/数据/BFF契约.ts`
- Modify: `src/数据/HTTP客户端.ts`
- Modify: `src/数据/HTTP客户端.test.ts`
- Create: `src/数据/招聘数据源/发现推荐.ts`
- Create: `src/数据/招聘数据源/发现推荐.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`
- Modify: `src/测试/BFF样本.ts`

**Interfaces:**
- Consumes: `BFF请求选项`, `BFF响应<T>`, `BFFCandidateJob`, and existing same-origin request behavior.
- Produces: `发现推荐数据源` and the exact DTOs used by Tasks 2–8.

```ts
export type BFF发现方向 = 'candidate_jobs' | 'recruiter_candidates';
export type BFF委托状态 =
  | 'accepted' | 'evaluating' | 'case_started'
  | 'needs_user' | 'refused' | 'failed';
export type BFF淘汰原因 =
  | 'experience_insufficient' | 'direction_mismatch'
  | 'primary_stack_mismatch' | 'other';

export interface BFF委托摘要 {
  delegation_id: string;
  state: BFF委托状态;
  case_id: string | null;
}

export interface BFF候选岗位推荐 {
  recommendation_id: string;
  batch_id: string;
  intention_id: string;
  rank: number;
  match_score: number;
  match_reasons: string[];
  state: 'available' | 'delegating' | 'delegated';
  job: BFFCandidateJob;
  delegation: BFF委托摘要 | null;
}

export interface BFF招聘候选教育 {
  institution: string | null;
  major: string | null;
  degree: string;
  start_month: string;
  end_month: string | null;
}

export interface BFF招聘候选推荐 {
  recommendation_id: string;
  batch_id: string;
  job_id: string;
  rank: number;
  match_score: number;
  highlights: string[];
  compensation_relationship: 'overlap' | 'near_miss' | 'disjoint' | 'unknown';
  candidate_alias: string;
  experience_years: number | null;
  job_status: string;
  summary: string;
  skills: string[];
  educations: BFF招聘候选教育[];
  favorite: boolean;
  rejected: boolean;
  rejection_reason: BFF淘汰原因 | null;
  state: 'available' | 'rejected';
  delegation: BFF委托摘要 | null;
}

export interface BFF发现偏好 {
  favorite: boolean;
  rejected: boolean;
  rejection_reason: 'not_interested' | BFF淘汰原因 | null;
  revision: number;
  updated_at: string;
}

export interface BFF发现批次 {
  batch_id: string;
  direction: BFF发现方向;
  scope_ref: string;
  ranking_version: 'discovery-ranking.v1';
  count: number;
  created_at: string;
}

export interface BFF委托回执 {
  delegation_id: string;
  recommendation_id: string | null;
  state: BFF委托状态 | null;
  evaluation_id: string | null;
  case_id: string | null;
  refusal_code:
    | 'recommendation_not_found' | 'recommendation_unavailable'
    | 'delegation_not_allowed' | 'active_case_quota_reached'
    | 'delegation_cooldown' | null;
}

export interface 发现推荐数据源 {
  读取候选岗位推荐(intentionId: string): Promise<BFF候选岗位推荐[]>;
  读取候选岗位详情(jobId: string): Promise<BFFCandidateJob>;
  刷新候选岗位推荐(intentionId: string, idempotencyKey: string): Promise<BFF发现批次>;
  标记候选岗位不感兴趣(recommendationId: string): Promise<BFF发现偏好>;
  创建候选岗位委托(input: {
    intentionId: string; jobId: string; idempotencyKey: string;
    disclosureAcknowledged: true;
  }): Promise<BFF委托回执[]>;
  读取候选岗位委托(delegationId: string): Promise<BFF委托回执>;
  读取招聘候选(jobId: string, state?: 'rejected'): Promise<BFF招聘候选推荐[]>;
  读取招聘候选详情(jobId: string, recommendationId: string): Promise<BFF招聘候选推荐>;
  刷新招聘候选(jobId: string, idempotencyKey: string): Promise<BFF发现批次>;
  设置招聘候选收藏(jobId: string, recommendationId: string, favorite: boolean): Promise<BFF发现偏好>;
  设置招聘候选淘汰(jobId: string, recommendationId: string, reason: BFF淘汰原因): Promise<BFF发现偏好>;
  撤销招聘候选淘汰(jobId: string, recommendationId: string): Promise<BFF发现偏好>;
  创建招聘候选委托(input: {
    jobId: string; recommendationId: string; idempotencyKey: string;
  }): Promise<BFF委托回执[]>;
  读取招聘候选委托(delegationId: string): Promise<BFF委托回执>;
}
```

- [ ] **Step 1: Add failing HTTP-key and facade request tests**

Add this explicit-key test to `HTTP客户端.test.ts`:

```ts
it('调用方提供的幂等键覆盖生成器并在受控重试中保持不变', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      error: { type: 'idempotency_in_progress', message: 'pending', request_id: 'r1' },
    }), { status: 409, headers: { 'Content-Type': 'application/json' } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      result: { batch_id: 'bat_1' }, meta: { request_id: 'r2', api_version: 'v1' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const 生成幂等键 = vi.fn(() => 'generated-key');
  const client = 创建BFF客户端({ fetcher, 生成幂等键, 等待: async () => {} });

  await client.请求({
    path: '/api/v1/me/job-recommendation-refreshes',
    method: 'POST', body: { intention_id: 'int_1' },
    幂等: true, 幂等键: 'click-key-0000001',
  });

  expect(生成幂等键).not.toHaveBeenCalled();
  expect(fetcher.mock.calls.map(([, init]) =>
    new Headers(init?.headers).get('Idempotency-Key'))).toEqual([
      'click-key-0000001', 'click-key-0000001',
    ]);
});
```

In the same client test file, table-test caller-supplied keys shorter than 16 bytes, longer than 128 bytes, containing a space, or containing non-ASCII; each must reject with `BFF错误.code === 'invalid_request'` before `fetcher` runs. This validation applies to the new caller-supplied seam; preserve the existing generated-key behavior and tests.

Create `发现推荐.test.ts` and freeze representative requests exactly:

```ts
function 响应<T>(result: T): BFF响应<T> {
  return { result, etag: null, requestId: 'fixture-request' };
}

let 请求Mock: ReturnType<typeof vi.fn>;
let source: 发现推荐数据源;

beforeEach(() => {
  请求Mock = vi.fn();
  source = 创建发现推荐数据源(请求Mock as 请求函数);
});

it('双端 refresh 与 delegation 使用精确 body 和调用方幂等键', async () => {
  请求Mock
    .mockResolvedValueOnce(响应(BFF发现批次样本))
    .mockResolvedValueOnce(响应({ receipts: [BFF候选委托回执样本] }))
    .mockResolvedValueOnce(响应(BFF招聘发现批次样本))
    .mockResolvedValueOnce(响应({ receipts: [BFF招聘委托回执样本] }));

  await source.刷新候选岗位推荐(BFF意向样本.intention_id, 'candidate-refresh-key');
  await source.创建候选岗位委托({
    intentionId: BFF意向样本.intention_id,
    jobId: BFFCandidateJob样本.job_id,
    idempotencyKey: 'candidate-delegation-key',
    disclosureAcknowledged: true,
  });
  await source.刷新招聘候选(BFF岗位样本.job_id, 'recruiter-refresh-key');
  await source.创建招聘候选委托({
    jobId: BFF岗位样本.job_id,
    recommendationId: BFF招聘候选推荐样本.recommendation_id,
    idempotencyKey: 'recruiter-delegation-key',
  });

  expect(请求Mock.mock.calls.map(([options]) => options)).toEqual([
    { path: '/api/v1/me/job-recommendation-refreshes', method: 'POST',
      body: { intention_id: BFF意向样本.intention_id }, 幂等: true, 幂等键: 'candidate-refresh-key' },
    { path: '/api/v1/me/job-delegations', method: 'POST',
      body: { intention_id: BFF意向样本.intention_id,
        selection: { items: [BFFCandidateJob样本.job_id] }, disclosure_acknowledged: true },
      幂等: true, 幂等键: 'candidate-delegation-key' },
    { path: '/api/v1/recruiter/candidate-recommendation-refreshes', method: 'POST',
      body: { job_id: BFF岗位样本.job_id }, 幂等: true, 幂等键: 'recruiter-refresh-key' },
    { path: '/api/v1/recruiter/candidate-delegations', method: 'POST',
      body: { job_id: BFF岗位样本.job_id,
        selection: { items: [BFF招聘候选推荐样本.recommendation_id] } },
      幂等: true, 幂等键: 'recruiter-delegation-key' },
  ]);
});

it('招聘淘汰只发送 exact reason body，不发送幂等键或 If-Match', async () => {
  请求Mock.mockResolvedValueOnce(响应(BFF发现偏好样本));
  await source.设置招聘候选淘汰(
    BFF岗位样本.job_id,
    BFF招聘候选推荐样本.recommendation_id,
    'direction_mismatch',
  );
  expect(请求Mock).toHaveBeenCalledWith({
    path: `/api/v1/recruiter/jobs/${BFF岗位样本.job_id}/candidate-recommendations/${BFF招聘候选推荐样本.recommendation_id}/rejection`,
    method: 'PUT',
    body: { reason: 'direction_mismatch' },
  });
});
```

In the same RED step add table tests for candidate/recruiter list paths; `limit=50`; `state=rejected`; canonical CandidateJob GET; detail GET; PUT/DELETE favorite; PUT rejection with each of the four enum words; DELETE rejection; no-body feedback; one GET per delegation; all-page reads; repeated, empty, non-string, non-base64url, and over-4096-byte cursors; missing/extra keys; empty string IDs; invalid rank/score/enum; invalid conditional nulls; a delegation batch containing zero or two receipts; CandidateJob owner-only keys; and recruiter privacy canaries.

In `BFF样本.ts`, make the candidate direct-Job delegation fixture carry `recommendation_id: null`; keep the recruiter fixture's `recommendation_id` equal to its selected `rec_...` coordinate.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run src/数据/HTTP客户端.test.ts src/数据/招聘数据源/发现推荐.test.ts src/数据/HTTP招聘数据源.test.ts
```

Expected: FAIL because `幂等键`, P4 DTOs, `创建发现推荐数据源`, and composed P4 methods do not exist.

- [ ] **Step 3: Implement closed decoding, pagination, and requests**

Change the request common options to:

```ts
interface BFF请求共同选项 {
  path: `/api/v1/${string}`;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  ifMatch?: string;
  幂等?: boolean;
  /** One user intent may retain this key across separate calls after outcome uncertainty. */
  幂等键?: string;
}
```

In `创建BFF客户端.请求`, reject `幂等键` without `幂等`, then use `options.幂等键 ?? 生成幂等键()` once before the first attempt. Preserve every existing generated-key test.

Validate a caller-supplied `幂等键` against `^[!-~]{16,128}$` before building the request; invalid input throws `new BFF错误(0, 'invalid_request', 'Idempotency-Key 需要 16 到 128 个可见 ASCII 字符')` and sends no fetch. Do not retroactively validate the injected/generated key path in this task: the new boundary being opened is the caller-supplied seam, while current generated behavior and existing test injectors remain unchanged.

In `发现推荐.ts`, use these boundaries:

```ts
type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;
const 候选前缀 = '/api/v1/me';
const 招聘前缀 = '/api/v1/recruiter';
const 游标模式 = /^[A-Za-z0-9_-]+$/;

function 契约错误(message = '服务返回了不符合契约的发现推荐数据'): BFF错误 {
  return new BFF错误(200, 'invalid_response', message);
}

function 校验下一游标(value: unknown, seen: Set<string>): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096 ||
      !游标模式.test(value) || seen.has(value)) throw 契约错误();
  seen.add(value);
  return value;
}

async function 读取全部页<T>(
  pathFor: (cursor: string | null) => `/api/v1/${string}`,
  decode: (input: unknown) => { items: T[]; nextCursor: unknown },
): Promise<T[]> {
  const all: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const { result } = await 请求<unknown>({ path: pathFor(cursor) });
    const page = decode(result);
    all.push(...page.items);
    cursor = 校验下一游标(page.nextCursor, seen);
  } while (cursor !== null);
  return all;
}
```

Keep this helper local to `发现推荐.ts`. Add a comment that P4 pages always require `next_cursor` and use explicit `null` for the terminal page, unlike the existing Agent-rule helper where the key is optional and a present `null` is invalid; do not extract a shared helper with a boolean semantic switch for this single new consumer.

CandidateJob’s required exact keys are:

```ts
const CandidateJob必需键 = [
  'job_id', 'publisher_verification_status',
  'hiring_organization_verification_status', 'hiring_organization_claim',
  'title', 'recruitment_type', 'category', 'location', 'office_location',
  'workplace_mode', 'salary_lower', 'salary_upper', 'salary_period',
  'annual_salary_months', 'campus_cohort', 'internship_months',
  'onsite_days_per_week', 'experience_requirement', 'education_requirement',
  'hard_requirements', 'description', 'requirements', 'keywords', 'status',
  'revision', 'published_at', 'created_at', 'updated_at',
] as const;
const CandidateJob可选键 = [
  'publisher_organization_ref', 'hiring_organization_ref', 'publisher_profile',
] as const;
```

Decode every nested object with exact key sets, including `publisher_profile`, organization claim, catalog references, four-member hard requirements, delegation conditional nulls, recruiter education, and page wrappers. Require non-empty opaque IDs, `rank` 1–3, `match_score` 0–100, batch `count` 0–3, positive preference revision, non-empty discovery timestamps, RFC3339 CandidateJob timestamps, and closed enums. Do not invent prefix/hex validation that the final OpenAPI does not declare, and do not use `as` to bypass a decoder.

Use `limit=50` on the first and subsequent list pages. Query order is stable:

```ts
const candidatePath = (intentionId: string, cursor: string | null) =>
  `/api/v1/me/job-recommendations?intention_id=${encodeURIComponent(intentionId)}&limit=50${
    cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`
  }` as `/api/v1/${string}`;

const recruiterPath = (jobId: string, state: 'available' | 'rejected', cursor: string | null) =>
  `/api/v1/recruiter/jobs/${encodeURIComponent(jobId)}/candidate-recommendations?${
    state === 'rejected' ? 'state=rejected&' : ''
  }limit=50${cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`}` as `/api/v1/${string}`;
```

Do not implement watch methods, candidate undo, delegation-list GET, `top` selection, or server-side favorite filtering.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run src/数据/HTTP客户端.test.ts src/数据/招聘数据源/发现推荐.test.ts src/数据/HTTP招聘数据源.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the wire slice**

```bash
git add src/数据/BFF契约.ts src/数据/HTTP客户端.ts src/数据/HTTP客户端.test.ts src/数据/招聘数据源/发现推荐.ts src/数据/招聘数据源/发现推荐.test.ts src/数据/HTTP招聘数据源.ts src/数据/HTTP招聘数据源.test.ts src/测试/BFF样本.ts
git commit -m "feat: add p4 discovery data facade"
```

---

### Task 2: Add Owner-Safe Candidate and Recruiter Page Projections

**Files:**
- Modify: `src/数据/招聘数据源类型.ts`
- Create: `src/数据/发现推荐映射.ts`
- Create: `src/数据/发现推荐映射.test.ts`

**Interfaces:**
- Consumes: `BFF候选岗位推荐`, `BFFCandidateJob`, `BFF招聘候选推荐`, `市场职位`, and the existing page structure.
- Produces: display-only views that contain no Mock lookup key or forbidden recruiter field.

```ts
export interface P4候选岗位页面 {
  recommendationId: string | null;
  intentionId: string | null;
  jobId: string;
  卡: 市场职位;
  职位详情: string[];
  职位要求: string[];
  公司: {
    名称: string; 首字: string; 简介: string;
    organizationId: string | null;
  };
  发布人: {
    姓名: string; 职务: string; 首字: string;
    验证状态: 'unverified' | 'verified';
  } | null;
  委托: BFF委托摘要 | null;
}

export interface P4招聘候选页面 {
  recommendationId: string;
  jobId: string;
  代号: string;
  头像字: string;
  匹配分: number;
  亮点: string[];
  经验: string;
  求职状态: string;
  摘要: string;
  技能: string[];
  教育: { 学校: string; 专业: string; 学历: string; 起止: string }[];
  薪资关系: '薪资带有交集' | '薪资带接近' | '薪资带无交集' | '薪资带未核对';
  收藏: boolean;
  已淘汰: boolean;
  淘汰原因: BFF淘汰原因 | null;
  委托: BFF委托摘要 | null;
}

export function 从P4候选岗位(card: BFF候选岗位推荐): P4候选岗位页面;
export function 从P4CandidateJob(job: BFFCandidateJob): P4候选岗位页面;
export function 从P4招聘候选(card: BFF招聘候选推荐): P4招聘候选页面;
export function P4淘汰原因文案(reason: BFF淘汰原因): '年限不足' | '方向不符' | '主栈不符' | '其他';
export function P4淘汰原因码(copy: string): BFF淘汰原因;
```

- [ ] **Step 1: Write failing projection and privacy-canary tests**

```ts
it('CandidateJob maps public company and publisher facts without a Mock slug', () => {
  const view = 从P4候选岗位(BFF候选岗位推荐样本);
  expect(view).toMatchObject({
    recommendationId: BFF候选岗位推荐样本.recommendation_id,
    intentionId: BFF候选岗位推荐样本.intention_id,
    jobId: BFFCandidateJob样本.job_id,
    卡: { 编号: BFFCandidateJob样本.job_id, 职位: BFFCandidateJob样本.title,
      公司: BFFCandidateJob样本.hiring_organization_claim.display_name,
      适配分: BFF候选岗位推荐样本.match_score },
    公司: { organizationId: BFFCandidateJob样本.hiring_organization_ref ?? null },
  });
  expect(JSON.stringify(view)).not.toContain('yunqu');
});

it('recruiter projection emits only allowlisted anonymous facts and relationship copy', () => {
  const poisoned = {
    ...BFF招聘候选推荐样本,
    candidate_subject: 'sub_secret', real_name: '真实姓名', phone: '13800000000',
    gender: 'female', birth_year: 1990, salary_lower: 55000,
  } as BFF招聘候选推荐 & Record<string, unknown>;
  const clean = 从P4招聘候选(poisoned);
  const text = JSON.stringify(clean);
  expect(clean.薪资关系).toBe('薪资带有交集');
  for (const forbidden of ['sub_secret', '真实姓名', '13800000000', 'female', '1990', '55000']) {
    expect(text).not.toContain(forbidden);
  }
});
```

Also cover no publisher profile, unverified organization, all salary relationships, null experience, empty education/skills/summary, multiple education rows, empty alias, salary period formatting, workplace/recruitment type labels, hard-requirement projection, and the four rejection copy mappings.

- [ ] **Step 2: Run mapper tests and verify RED**

Run:

```bash
npx vitest run src/数据/发现推荐映射.test.ts
```

Expected: FAIL because the view types and mapping functions do not exist.

- [ ] **Step 3: Implement deterministic mappings**

Use these closed copy tables:

```ts
const 薪资关系文案 = {
  overlap: '薪资带有交集', near_miss: '薪资带接近',
  disjoint: '薪资带无交集', unknown: '薪资带未核对',
} as const;
const 淘汰文案 = {
  experience_insufficient: '年限不足', direction_mismatch: '方向不符',
  primary_stack_mismatch: '主栈不符', other: '其他',
} as const;
const 办公方式文案 = { onsite: '现场', hybrid: '混合', remote: '全远程' } as const;
const 薪资单位 = { month: 'K', day: '元/天', hour: '元/时' } as const;
```

Split `description` and `requirements` on newlines, trim, and remove empty lines. Use the hiring organization claim as the company name. Use only `hiring_organization_ref` as the public-company route ID. When `publisher_profile` is absent, return `发布人: null`; never synthesize a recruiter from the company claim.

For recruiter education, display null institution/major as `未披露`, preserve degree, and derive years only from `start_month`/`end_month`. Do not create age, gender, work-experience rows, current employer, candidate salary, direct-chat permission, or identity fields. An empty alias becomes `匿名候选`; `头像字` is the first Unicode code point of the displayed alias.

- [ ] **Step 4: Run mapper tests and verify GREEN**

Run:

```bash
npx vitest run src/数据/发现推荐映射.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the projection slice**

```bash
git add src/数据/招聘数据源类型.ts src/数据/发现推荐映射.ts src/数据/发现推荐映射.test.ts
git commit -m "feat: map p4 discovery views"
```

---

### Task 3: Add Atomic Scope Snapshots, Read Operations, and Session Cleanup

**Files:**
- Modify: `src/状态/后端/类型.ts`
- Create: `src/状态/后端/发现推荐操作.ts`
- Create: `src/状态/后端/发现推荐操作.test.ts`
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/后端/会话操作.test.ts`
- Modify: `src/状态/初始状态.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: Task 1 facade, existing `主体标识引用`, `会话代际`, `锁`, and Context composition.
- Produces: backend-only raw snapshots and read operations; the Mock discovery reducer remains untouched.

```ts
export type P4加载阶段 = '未开始' | '进行中' | '成功' | '失败';

export interface P4ScopeSnapshot<T> {
  阶段: P4加载阶段;
  刷新中: boolean;
  items: T[];
  error: string | null;
  generation: number;
}

export interface P4发现状态 {
  候选岗位推荐: Record<string, P4ScopeSnapshot<BFF候选岗位推荐>>;
  候选岗位详情: Record<string, BFFCandidateJob>;
  候选岗位不可用: string[];
  招聘可用候选: Record<string, P4ScopeSnapshot<BFF招聘候选推荐>>;
  招聘已筛候选: Record<string, P4ScopeSnapshot<BFF招聘候选推荐>>;
  招聘已筛聚合: { 阶段: P4加载阶段; jobKey: string; error: string | null };
  招聘候选详情: Record<string, BFF招聘候选推荐>;
  招聘候选不可用: string[];
  P4委托回执: Record<string, BFF委托回执>;
  P4真实Case引用: Record<string, string>;
}

export interface 发现推荐操作 {
  设置发现推荐范围(role: BFF角色, scopeKey: string | null): void;
  加载候选岗位(intentionId: string, force?: boolean): Promise<void>;
  读取候选岗位详情(jobId: string, force?: boolean): Promise<void>;
  加载招聘候选(jobId: string, force?: boolean): Promise<void>;
  加载招聘已筛(jobIds: string[], force?: boolean): Promise<void>;
  读取招聘候选详情(jobId: string, recommendationId: string, force?: boolean): Promise<void>;
  刷新候选岗位(intentionId: string): Promise<void>;
  标记岗位不感兴趣(intentionId: string, recommendationId: string): Promise<void>;
  刷新招聘候选(jobId: string): Promise<void>;
  设置候选收藏(jobId: string, recommendationId: string, favorite: boolean): Promise<void>;
  淘汰候选(jobId: string, recommendationId: string, reason: BFF淘汰原因): Promise<void>;
  撤销淘汰候选(jobId: string, recommendationId: string): Promise<void>;
  委托候选岗位(input: {
    intentionId: string; recommendationId: string; jobId: string;
    disclosureAcknowledged: true;
  }): Promise<BFF委托回执>;
  委托招聘候选(jobId: string, recommendationId: string): Promise<BFF委托回执>;
  刷新委托(role: BFF角色, delegationId: string): Promise<void>;
}
```

Add these refs to `后端操作依赖` and initialize them once in the Provider:

```ts
P4范围代际: 可变引用<Map<string, number>>;
P4幂等意图: 可变引用<Map<string, string>>;
P4可见范围: 可变引用<Record<BFF角色, string | null>>;
```

- [ ] **Step 1: Write failing read, atomicity, fence, and cleanup tests**

At the top of `发现推荐操作.test.ts`, create one local `创建P4操作测试环境` by following the existing reducer-backed dependency helper in `组织操作.test.ts`: start from `创建空P4发现状态()`, make `设后端状态` apply each functional update immediately to a mutable `后端状态引用.current`, add `P4范围代际`, `P4幂等意图`, and `P4可见范围` refs, and compose `创建发现推荐操作(deps)`. Freeze the returned fixture shape so every snippet below has the same meaning:

```ts
interface P4操作测试环境 {
  数据源: HTTP招聘数据源;
  deps: 后端操作依赖;
  派发: ReturnType<typeof vi.fn>;
  操作: 发现推荐操作;
  最新状态(): 后端状态;
}

let env: P4操作测试环境;

beforeEach(() => {
  env = 创建P4操作测试环境();
  env.操作.设置发现推荐范围('candidate', P4范围键.候选列表('int_1'));
  env.操作.设置发现推荐范围('recruiter', P4范围键.招聘列表('job_1'));
});
```

The helper's HTTP methods are `vi.fn()` values and its `派发` is a spy only; all P4 state assertions read `env.最新状态()`. Tests for another scope must call `设置发现推荐范围` before starting that request, so a passing test proves the production visible-scope fence instead of bypassing it.

```ts
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

it('candidate load commits only after the full facade read succeeds', async () => {
  const pending = deferred<BFF候选岗位推荐[]>();
  vi.mocked(env.数据源.读取候选岗位推荐).mockReturnValue(pending.promise);
  const call = env.操作.加载候选岗位('int_scope');
  expect(env.最新状态().候选岗位推荐.int_scope).toMatchObject({
    阶段: '进行中', items: [], 刷新中: true,
  });
  pending.resolve([BFF候选岗位推荐样本]);
  await call;
  expect(env.最新状态().候选岗位推荐.int_scope).toMatchObject({
    阶段: '成功', items: [BFF候选岗位推荐样本], 刷新中: false, error: null,
  });
});

it('stale subject/scope response never overwrites the new scope', async () => {
  const old = deferred<BFF候选岗位推荐[]>();
  vi.mocked(env.数据源.读取候选岗位推荐)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce([{ ...BFF候选岗位推荐样本, intention_id: 'int_new' }]);
  const oldCall = env.操作.加载候选岗位('int_old');
  env.deps.主体标识引用.current = 'sub_new';
  env.deps.会话代际.current += 1;
  await env.操作.加载候选岗位('int_new');
  old.resolve([{ ...BFF候选岗位推荐样本, intention_id: 'int_old' }]);
  await oldCall;
  expect(env.最新状态().候选岗位推荐.int_new.items[0].intention_id).toBe('int_new');
  expect(env.最新状态().候选岗位推荐.int_old?.items ?? []).toEqual([]);
});
```

Also cover successful-snapshot reload preservation, first-load failure, reload failure, force/non-force deduplication, candidate direct detail, recruiter detail always forced by screen, all-active-job rejected aggregation committed in one state update, one rejected leg failing with no partial commit, a visible-scope change/unmount discarding the old completion, 401 cleanup, stale 401 not clearing a new session, 404 unavailable markers, logout, login subject change, role switch, and Backend initial discovery arrays being empty while Mock seeds remain unchanged.

- [ ] **Step 2: Run operation/provider tests and verify RED**

Run:

```bash
npx vitest run src/状态/后端/发现推荐操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
```

Expected: FAIL because P4 backend state, refs, read operations, and cleanup do not exist.

- [ ] **Step 3: Implement the P4 state base and fenced reads**

Export one reusable initializer and resetter:

```ts
export function 创建空P4发现状态(): P4发现状态 {
  return {
    候选岗位推荐: {}, 候选岗位详情: {}, 候选岗位不可用: [],
    招聘可用候选: {}, 招聘已筛候选: {},
    招聘已筛聚合: { 阶段: '未开始', jobKey: '', error: null },
    招聘候选详情: {}, 招聘候选不可用: [],
    P4委托回执: {}, P4真实Case引用: {},
  };
}
```

`后端状态` extends `P4发现状态`. Provider initialization spreads `创建空P4发现状态()`. `清账号状态`, login subject replacement, and role switch also spread a fresh P4 state, clear both P4 Maps, reset `P4可见范围.current` to `{ candidate: null, recruiter: null }`, and thereby invalidate all scope generations and pending idempotency intents.

Screens register one exact visible key and clear it in effect cleanup:

```ts
export const P4范围键 = {
  候选列表: (intentionId: string) => `candidate:list:${intentionId}`,
  候选详情: (jobId: string) => `candidate:detail:${jobId}`,
  招聘列表: (jobId: string) => `recruiter:list:${jobId}`,
  招聘详情: (jobId: string, recommendationId: string) =>
    `recruiter:detail:${jobId}:${recommendationId}`,
  招聘已筛: (jobIds: string[]) => `recruiter:rejected:${[...jobIds].sort().join(',')}`,
} as const;
```

`设置发现推荐范围` updates only the named role. Changing or clearing the key increments the old and new keys in `P4范围代际` and removes pending intent keys whose role/scope prefix belongs to the old visible scope.

Capture this fence before every request:

```ts
interface P4Fence {
  subjectId: string | null;
  role: BFF角色 | null;
  sessionGeneration: number;
  scopeKey: string;
  scopeGeneration: number;
  visibleScope: string | null;
}

function fenceStillCurrent(deps: 后端操作依赖, fence: P4Fence): boolean {
  const subject = deps.后端状态引用.current.主体;
  return deps.主体标识引用.current === fence.subjectId &&
    subject?.last_used_role === fence.role &&
    deps.会话代际.current === fence.sessionGeneration &&
    (fence.role === null || deps.P4可见范围.current[fence.role] === fence.visibleScope) &&
    deps.P4范围代际.current.get(fence.scopeKey) === fence.scopeGeneration;
}
```

On a stale completion, release only the matching lock; do not write state, show a toast, or run 401 cleanup. For existing success, set `刷新中: true` without changing `阶段` or `items`. For first load, set `阶段: 进行中`. On failure, keep a successful snapshot successful; otherwise set `阶段: 失败`.

`加载招聘已筛` sorts and de-duplicates active job IDs into `jobKey`, calls every `读取招聘候选(jobId, 'rejected')` concurrently, and performs one `设后端状态` only after all calls succeed.

- [ ] **Step 4: Run operation/provider tests and verify GREEN**

Run:

```bash
npx vitest run src/状态/后端/发现推荐操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the state/read slice**

```bash
git add src/状态/后端/类型.ts src/状态/后端/发现推荐操作.ts src/状态/后端/发现推荐操作.test.ts src/状态/后端/会话操作.ts src/状态/后端/会话操作.test.ts src/状态/初始状态.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts
git commit -m "feat: add p4 discovery scope state"
```

---

### Task 4: Implement Refresh and Feedback Mutations with Stable Intent Keys

**Files:**
- Modify: `src/状态/后端/发现推荐操作.ts`
- Modify: `src/状态/后端/发现推荐操作.test.ts`

**Interfaces:**
- Consumes: Task 3 snapshots/fences and Task 1 explicit-key facade.
- Produces: server-first refresh, candidate preference, recruiter favorite/rejection, and reconciliation.

- [ ] **Step 1: Write failing mutation and idempotency tests**

```ts
it('refresh reuses one key after outcome uncertainty and replaces only after GET succeeds', async () => {
  const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
    .mockReturnValueOnce('refresh-key-0001')
    .mockReturnValue('refresh-key-0002');
  vi.mocked(env.数据源.刷新候选岗位推荐)
    .mockRejectedValueOnce(new BFF错误(0, 'network_error', 'unknown'))
    .mockResolvedValueOnce(BFF发现批次样本);
  vi.mocked(env.数据源.读取候选岗位推荐)
    .mockResolvedValueOnce([BFF候选岗位推荐样本]);

  await expect(env.操作.刷新候选岗位('int_1')).rejects.toMatchObject({ code: 'network_error' });
  await env.操作.刷新候选岗位('int_1');

  expect(vi.mocked(env.数据源.刷新候选岗位推荐).mock.calls).toEqual([
    ['int_1', 'refresh-key-0001'], ['int_1', 'refresh-key-0001'],
  ]);
  expect(randomUUID).toHaveBeenCalledTimes(1);
  expect(env.最新状态().候选岗位推荐.int_1.items).toEqual([BFF候选岗位推荐样本]);
});

it('feedback never moves a recruiter card before server success', async () => {
  vi.mocked(env.数据源.设置招聘候选淘汰)
    .mockRejectedValue(new BFF错误(503, 'source_unavailable', 'down'));
  await expect(env.操作.淘汰候选('job_1', 'rec_1', 'direction_mismatch'))
    .rejects.toMatchObject({ code: 'source_unavailable' });
  expect(env.最新状态().招聘可用候选.job_1.items).toEqual([BFF招聘候选推荐样本]);
  expect(env.最新状态().招聘已筛候选.job_1?.items ?? []).toEqual([]);
});
```

Also cover refresh POST success + GET failure preserving old items; conflict re-read with no new key; candidate not-interested success removal and failure retention; favorite write updating list/detail caches; rejection moving available to rejected only after success; undo removing rejected without re-inserting into the current available batch; per-resource single-flight; different-resource concurrency; 404 safe removal/re-read; 401 cleanup; the exact HTTP error copies; and the separate receipt-refusal copies.

- [ ] **Step 2: Run operation tests and verify RED**

Run:

```bash
npx vitest run src/状态/后端/发现推荐操作.test.ts
```

Expected: FAIL on unimplemented mutations and key retention.

- [ ] **Step 3: Implement server-first mutations and intent-key lifecycle**

Use stable intent coordinates:

```ts
const refreshKey = (visibleScope: string) => `${visibleScope}:refresh`;
const delegationKey = (visibleScope: string, objectId: string) =>
  `${visibleScope}:delegation:${objectId}`;

function idempotencyKeyFor(deps: 后端操作依赖, intent: string): string {
  const existing = deps.P4幂等意图.current.get(intent);
  if (existing) return existing;
  const created = globalThis.crypto.randomUUID();
  deps.P4幂等意图.current.set(intent, created);
  return created;
}
```

Release the key after a known success, a known receipt refusal, or a successful conflict reconciliation. Retain it after `network_error`, `operation_outcome_unknown`, or an interrupted response. Never replace it inside `idempotency_conflict` handling.

Mutation cache updates use pure helpers that update every occurrence of the recommendation in available, rejected, and detail caches. Candidate not-interested removes the recommendation after the preference receipt confirms `rejection_reason: not_interested`. Rejection success removes it from available and inserts the server-updated card into rejected only after an authoritative detail/list re-read; undo removes it from rejected and waits for a future batch before it can appear available again.

Export one closed HTTP error mapping and one receipt-refusal mapping. Fall back to `取后端错误文案` only for HTTP/runtime errors; an unknown refusal is a closed-contract failure, not an English backend message:

```ts
export function P4错误文案(error: unknown): string {
  if (!(error instanceof BFF错误)) return 取后端错误文案(error);
  const copy: Record<string, string> = {
    recommendation_not_found: '这条推荐当前已不可用，请刷新后查看',
    recommendation_unavailable: '这条推荐当前已不可用，请刷新后查看',
    delegation_not_found: '这次委托已不可用，请刷新后查看',
    disclosure_acknowledgement_required: '请先确认简历与联系方式披露说明',
    idempotency_conflict: '这次操作与之前的请求冲突，请刷新后重试',
    source_unavailable: '服务暂时不可用，请稍后再试',
    recruitment_service_unavailable: '服务暂时不可用，请稍后再试',
    operation_outcome_unknown: '操作结果暂未确认，请稍后重试',
  };
  return copy[error.code] ?? 取后端错误文案(error);
}

export function P4拒绝文案(code: NonNullable<BFF委托回执['refusal_code']>): string {
  const copy: Record<NonNullable<BFF委托回执['refusal_code']>, string> = {
    recommendation_not_found: '这条推荐当前已不可用，请刷新后查看',
    recommendation_unavailable: '这条推荐当前已不可用，请刷新后查看',
    delegation_not_allowed: '当前无法发起委托，请刷新后重试',
    active_case_quota_reached: '当前在谈已达到上限，请先处理已有在谈',
    delegation_cooldown: '近期已联系过对方，暂时不能重复发起',
  };
  return copy[code];
}

export function P4委托终态文案(state: 'needs_user' | 'failed'): string {
  return state === 'needs_user'
    ? '这次委托需要你确认后才能继续'
    : '这次委托没有成功，请稍后重试';
}
```

- [ ] **Step 4: Run operation tests and verify GREEN**

Run:

```bash
npx vitest run src/状态/后端/发现推荐操作.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the mutation slice**

```bash
git add src/状态/后端/发现推荐操作.ts src/状态/后端/发现推荐操作.test.ts
git commit -m "feat: persist p4 discovery feedback"
```

---

### Task 5: Implement Real Delegation Receipts and Visible-Page Polling

**Files:**
- Modify: `src/状态/后端/发现推荐操作.ts`
- Modify: `src/状态/后端/发现推荐操作.test.ts`
- Create: `src/状态/后端/use发现推荐委托轮询.ts`
- Create: `src/状态/后端/use发现推荐委托轮询.test.tsx`

**Interfaces:**
- Consumes: Task 4 intent keys and Task 3 P4 receipt/Case snapshots.
- Produces: single-object create, exact receipt state transitions, and a page-owned polling hook.

```ts
export interface 可轮询委托 {
  role: BFF角色;
  delegationId: string;
  state: 'accepted' | 'evaluating';
}

export function use发现推荐委托轮询(input: {
  开启: boolean;
  委托: 可轮询委托[];
  刷新: (role: BFF角色, delegationId: string) => Promise<void>;
  间隔毫秒?: number;
}): void;
```

- [ ] **Step 1: Write failing receipt and polling tests**

```ts
it('candidate delegation sends only after literal confirmation and records no fake Case', async () => {
  vi.mocked(env.数据源.创建候选岗位委托)
    .mockResolvedValue([{
      ...BFF候选委托回执样本,
      recommendation_id: null, state: 'accepted', case_id: null,
    }]);
  const receipt = await env.操作.委托候选岗位({
    intentionId: 'int_1', recommendationId: 'rec_1', jobId: 'job_1',
    disclosureAcknowledged: true,
  });
  expect(receipt.state).toBe('accepted');
  expect(env.最新状态().P4真实Case引用).toEqual({});
  expect(env.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '委托入谈' }));
});

it('polls accepted receipts every two seconds and stops at case_started', async () => {
  vi.useFakeTimers();
  const 刷新委托 = vi.fn().mockResolvedValue(undefined);
  const active = [{ role: 'candidate' as const, delegationId: 'del_1', state: 'accepted' as const }];
  const { rerender } = renderHook(
    ({ 委托 }) => use发现推荐委托轮询({
      开启: true, 委托, 刷新: 刷新委托, 间隔毫秒: 2_000,
    }),
    { initialProps: { 委托: active } },
  );
  await vi.advanceTimersByTimeAsync(2_000);
  expect(刷新委托).toHaveBeenCalledTimes(1);
  rerender({ 委托: [] }); // operation committed case_started; selector no longer returns it
  await vi.advanceTimersByTimeAsync(4_000);
  expect(刷新委托).toHaveBeenCalledTimes(1);
});
```

Follow the existing `useAgent规则提案轮询` dependency-injection shape; do not mock `应用状态` inside the hook test. Also cover exactly one create receipt required; candidate direct-Job receipts with both null and non-null `recommendation_id` reconciling to the operation input's card and never using the receipt field; recruiter receipt recommendation mismatch; all six terminal/active states; refusal codes through `P4拒绝文案`; null-refusal `needs_user`/`failed` through `P4委托终态文案`; `case_started` requiring a non-null `case_id`; non-case state requiring null case; no MatchCase dispatch; same-pair create single-flight; candidate and recruiter body separation; `开启: false` issuing no GET; poll one in-flight GET per delegation; unmount stop; hidden/non-active omission; terminal stop; 401 cleanup; stale poll completion; and 404 delegation removal.

- [ ] **Step 2: Run delegation tests and verify RED**

Run:

```bash
npx vitest run src/状态/后端/发现推荐操作.test.ts src/状态/后端/use发现推荐委托轮询.test.tsx
```

Expected: FAIL because delegation operations and polling hook do not exist.

- [ ] **Step 3: Implement receipt validation and polling**

Both create operations require `receipts.length === 1`. Candidate wire selection names `job_id`; accept the receipt's schema-valid nullable `recommendation_id` but ignore it completely, reconciling the response to the selected local card using the operation input's authoritative `recommendationId`. Recruiter selection names `recommendation_id`, so its non-null receipt coordinate must equal the selected recommendation. Commit the receipt by `delegation_id`, update that exact selected card/detail delegation summary, and show accepted/evaluating as in-progress. For `case_started`, require `case_id !== null` and write only:

```ts
P4真实Case引用: {
  ...旧.P4真实Case引用,
  [receipt.delegation_id]: receipt.case_id,
}
```

Never dispatch `委托入谈`, `接触推荐候选`, or any `MatchCase动作`. `needs_user`, `refused`, and `failed` clear the card’s in-progress summary. Require `refused` and `state === null` receipts to carry a closed non-null `refusal_code` and use `P4拒绝文案`; require `needs_user`/`failed` to carry null refusal and use `P4委托终态文案`; transport/runtime failures use `P4错误文案`.

The page passes `开启: 数据源模式 === 'backend'`, current active receipts, and `操作.刷新委托` into the hook. The hook keeps input arrays/functions in refs like `useAgent规则提案轮询`, starts one interval only while enabled, defaults to 2,000 ms, and uses a local `Set<string>` to prevent overlapping GETs. The operation owns session/scope fences and terminal state commits. Cleanup clears the interval and invalidates the hook generation so late Promise completion cannot schedule more work.

- [ ] **Step 4: Run delegation tests and verify GREEN**

Run:

```bash
npx vitest run src/状态/后端/发现推荐操作.test.ts src/状态/后端/use发现推荐委托轮询.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the delegation slice**

```bash
git add src/状态/后端/发现推荐操作.ts src/状态/后端/发现推荐操作.test.ts src/状态/后端/use发现推荐委托轮询.ts src/状态/后端/use发现推荐委托轮询.test.tsx
git commit -m "feat: track p4 delegation receipts"
```

---

### Task 6: Wire Candidate Job Discovery and Disclosure Confirmation

**Files:**
- Modify: `src/组件/下拉刷新.tsx`
- Create: `src/组件/下拉刷新.test.tsx`
- Modify: `src/屏幕/看市场.tsx`
- Modify: `src/屏幕/看市场.test.tsx`
- Modify: `src/屏幕/职位详情.tsx`
- Modify: `src/屏幕/职位详情.test.tsx`
- Modify: `src/屏幕/职位详情.module.css`

**Interfaces:**
- Consumes: candidate snapshots/mappings/operations and `确认层`.
- Produces: Backend candidate list/detail/refresh/feedback/delegation while preserving Mock behavior.

- [ ] **Step 1: Write failing component tests**

Create `下拉刷新.test.tsx` first. Follow the repository's existing CSS-module test convention and observe the active spinner with `[class*="刷新转"]`; do not add product DOM attributes just for the test. Use fake timers and a `.滚动区` child whose `scrollTop` is zero, then freeze these three cases:

```tsx
function 触发下拉() {
  const root = screen.getByTestId('滚动区').parentElement!;
  fireEvent.pointerDown(root, { clientY: 0 });
  fireEvent.pointerMove(root, { clientY: 120 });
  fireEvent.pointerUp(root, { clientY: 120 });
}

it('同步刷新仍保持至少 900ms 动画', async () => {
  vi.useFakeTimers();
  const 刷新 = vi.fn();
  render(<下拉刷新 刷新={刷新}><div className="滚动区" data-testid="滚动区" /></下拉刷新>);
  触发下拉();
  expect(刷新).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[class*="刷新转"]')).not.toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(899));
  expect(document.querySelector('[class*="刷新转"]')).not.toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(document.querySelector('[class*="刷新转"]')).toBeNull();
});
```

Add a pending-Promise case that advances past 900ms and still finds the active spinner until `deferred.resolve()`, plus a rejected-Promise case that rejects before 900ms and removes the active spinner exactly after the minimum duration. Restore real timers after each test. The immediate callback assertion above also proves existing synchronous Mock callers keep their current timing.

```tsx
// Extend the existing 看市场.test.tsx 置应用状态 helper so each test can provide
// a P4 backend-state patch and operation spies without mounting the real Provider.
const mock委托候选岗位 = vi.fn();

function 置应用状态(选项: {
  模式?: 'mock' | 'backend'; 候选规则阶段?: string;
  状态?: Record<string, unknown>; 后端状态?: Record<string, unknown>;
  操作?: Record<string, unknown>;
}) {
  const { 模式 = 'mock', 候选规则阶段 = '未开始', 状态 = {},
    后端状态 = {}, 操作 = {} } = 选项;
  mock应用状态 = {
    状态, 派发: mock派发, 数据源模式: 模式, 操作,
    后端状态: {
      Agent规则水合: {
        candidate: { rules: 候选规则阶段, proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      ...后端状态,
    },
  };
}

function 置P4候选状态(items: BFF候选岗位推荐[]) {
  置应用状态({
    模式: 'backend', 候选规则阶段: '成功',
    状态: {
      子视图: '看市场', 当前意向: BFF意向样本.intention_id,
      后端意向服务端: { [BFF意向样本.intention_id]: BFF意向样本 },
      求职意向表: [], 在谈列表: [], 屏蔽名单: [], 不感兴趣岗位: [], 已委托: [],
      全局规则: [], 意向级规则: [], 简历经历: [], 简历教育: [], 简历技能: [],
    },
    后端状态: {
      候选岗位推荐: {
        [BFF意向样本.intention_id]: {
          阶段: '成功', 刷新中: false, items, error: null, generation: 1,
        },
      },
    },
    操作: { 委托候选岗位: mock委托候选岗位 },
  });
}

it('Backend delegation requires fresh disclosure confirmation and never dispatches Mock Case actions', async () => {
  const user = userEvent.setup();
  置P4候选状态([BFF候选岗位推荐样本]);
  render(<看市场 />);
  await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
  expect(screen.getByRole('dialog', { name: '确认委托AI代理？' }).textContent).toContain(
    'S0 通过后，本 Case 可按固定规则提交默认/已选 PDF，并向该招聘方披露姓名和联系方式。');
  expect(mock委托候选岗位).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '确认委托' }));
  expect(mock委托候选岗位).toHaveBeenCalledWith({
    intentionId: BFF候选岗位推荐样本.intention_id,
    recommendationId: BFF候选岗位推荐样本.recommendation_id,
    jobId: BFF候选岗位推荐样本.job.job_id,
    disclosureAcknowledged: true,
  });
  expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '委托入谈' }));
});
```

Add candidate list tests for lazy load by current real intention ID, scope switch, old data never showing in the new scope, local search over loaded cards, initial loading/error/empty states, pull-to-refresh GET only, Backend empty-state search button POST+GET, refresh failure preserving cards, candidate not-interested server-first removal, confirmation cancel zero request, failure closing confirmation and requiring a fresh confirmation, accepted/evaluating label, no navigation after delegation, Mock one-click behavior unchanged, and zero Backend reads from `市场列表`.

Add detail tests for cached card, direct URL canonical Job GET, safe unavailable state, no `市场列表[0]` fallback, public organization navigation only when `hiring_organization_ref` exists, no Mock company slug, server-first not-interested, confirmation on every delegation, accepted/evaluating receipt polling while the detail stays visible, terminal polling stop, and no P5 navigation.

- [ ] **Step 2: Run candidate component tests and verify RED**

Run:

```bash
npx vitest run src/组件/下拉刷新.test.tsx src/屏幕/看市场.test.tsx src/屏幕/职位详情.test.tsx
```

Expected: FAIL because the screens still use Mock arrays/reducers and confirmation is absent.

- [ ] **Step 3: Make pull-to-refresh await the real request**

Change its prop to `刷新?: () => void | Promise<void>` and use a minimum-duration Promise:

```ts
const 松手 = async () => {
  if (起点Y.current === null) return;
  起点Y.current = null;
  if (拉距 < 触发距) { 设拉距(0); return; }
  设刷新中(true);
  设拉距(触发距);
  const 结果 = 刷新?.();
  await Promise.allSettled([
    Promise.resolve(结果),
    new Promise<void>((resolve) => window.setTimeout(resolve, 900)),
  ]);
  设刷新中(false);
  设拉距(0);
};
```

Invoke the callback synchronously as shown so the two existing synchronous Mock consumers keep their current timing; await only its returned value. Keep Pointer behavior and visual timing unchanged.

- [ ] **Step 4: Wire `看市场` by data-source mode**

In Backend mode, treat `状态.当前意向` as the opaque ID selected from the already hydrated BFF intention list. Admit it only when `状态.后端意向服务端[状态.当前意向]?.status === 'active'`; otherwise render the no-active-intention state and send no P4 request. Select only `后端状态.候选岗位推荐[状态.当前意向]`. Map through `从P4候选岗位`; do not apply Mock block-company filtering because P4/P3 already gates those rows and no organization-block fact is exposed.

On mount/scope change call `操作.设置发现推荐范围('candidate', P4范围键.候选列表(intentionId))` before `操作.加载候选岗位(intentionId)`; effect cleanup calls `设置发现推荐范围('candidate', null)`. Pull calls `加载候选岗位(intentionId, true)`. Empty-state “让AI代理帮我搜” calls `操作.刷新候选岗位`. Search remains local over current mapped cards.

Store `待确认委托: P4候选岗位页面 | null`. Both card and detail open the same `确认层`:

```tsx
<确认层
  标题="确认委托AI代理？"
  正文="S0 通过后，本 Case 可按固定规则提交默认/已选 PDF，并向该招聘方披露姓名和联系方式。"
  执行文="确认委托"
  取消文="暂不委托"
  取消={() => 设待确认委托(null)}
  执行={() => void 执行候选委托(待确认委托)}
/>
```

Close the layer before awaiting the operation so any failure requires opening a fresh confirmation. Catch with `轻提示(P4错误文案(error))`. In Backend mode do not modify `本次已委托`, `状态.已委托`, or route to `在谈详情`.

Both `看市场` and `职位详情` pass their visible candidate `accepted/evaluating` summaries to `use发现推荐委托轮询({ 开启: 数据源模式 === 'backend', 委托, 刷新: 操作.刷新委托 })`; a direct detail without recommendation context passes an empty array. Mock mode therefore owns no P4 interval.

- [ ] **Step 5: Wire `职位详情` to cached/direct authoritative data**

For Backend routes, register `P4范围键.候选详情(jobId)`, find the Job across P4 candidate snapshots by `job.job_id`, and if absent call `操作.读取候选岗位详情(jobId)`; clear the visible range on unmount. Render a loading/error/unavailable page until the real DTO exists. A direct Job without recommendation context can render authoritative details, but disables both recommendation-specific “不感兴趣” and delegation because it lacks the current card’s `recommendation_id`; it must never guess a recommendation coordinate.

Change `职位正文` to accept an optional `P4候选岗位页面`. Mock continues to call `取市场岗位详情`; Backend uses mapped description/requirements/company/publisher. Hide direct-chat in Backend because P4 does not establish a direct-chat permission or conversation coordinate.

- [ ] **Step 6: Run candidate tests and verify GREEN**

Run:

```bash
npx vitest run src/组件/下拉刷新.test.tsx src/屏幕/看市场.test.tsx src/屏幕/职位详情.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the candidate UI slice**

```bash
git add src/组件/下拉刷新.tsx src/组件/下拉刷新.test.tsx src/屏幕/看市场.tsx src/屏幕/看市场.test.tsx src/屏幕/职位详情.tsx src/屏幕/职位详情.test.tsx src/屏幕/职位详情.module.css
git commit -m "feat: wire candidate p4 discovery"
```

---

### Task 7: Wire Recruiter Recommendations, Favorites, Rejections, and Detail

**Files:**
- Modify: `src/组件/候选筛选抽屉.tsx`
- Modify: `src/组件/候选筛选抽屉.module.css`
- Modify: `src/组件/候选筛选抽屉.test.tsx`
- Modify: `src/屏幕/候选推荐.tsx`
- Modify: `src/屏幕/候选推荐.module.css`
- Create: `src/屏幕/候选推荐.test.tsx`
- Modify: `src/屏幕/匿名在线简历.tsx`
- Modify: `src/屏幕/匿名在线简历.test.tsx`
- Modify: `src/屏幕/已筛候选.tsx`
- Create: `src/屏幕/已筛候选.test.tsx`

**Interfaces:**
- Consumes: recruiter snapshots/mappings/operations and polling from Tasks 2–5.
- Produces: owner-safe recruiter list/detail and cross-job rejected history.

- [ ] **Step 1: Write failing recruiter component tests**

```tsx
const mock加载招聘候选 = vi.fn(async () => undefined);
const mock设置候选收藏 = vi.fn(async () => undefined);
let mock应用状态: unknown;
vi.mock('../状态/应用状态', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  use应用状态: () => mock应用状态,
}));

function 置P4招聘状态(items: BFF招聘候选推荐[]) {
  mock应用状态 = {
    数据源模式: 'backend', 派发: vi.fn(),
    状态: {
      当前岗位编号: BFF岗位样本.job_id,
      岗位列表: [{ ...页面岗位样本, 编号: BFF岗位样本.job_id, 状态: '在招' }],
      企业规则: [], 推荐列表: [], 收藏候选: [], 不合适候选: {}, 已接触推荐: [],
    },
    后端状态: {
      Agent规则水合: { candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '成功', proposals: '成功' } },
      招聘可用候选: { [BFF岗位样本.job_id]: {
        阶段: '成功', 刷新中: false, items, error: null, generation: 1,
      } },
      P4委托回执: {},
    },
    操作: { 加载招聘候选: mock加载招聘候选, 设置候选收藏: mock设置候选收藏 },
  };
}

it('Backend favorite filter is local and feedback is server-first', async () => {
  const user = userEvent.setup();
  置P4招聘状态([BFF招聘候选推荐样本, { ...BFF招聘候选推荐样本,
    recommendation_id: 'rec_other', candidate_alias: '匿名乙', favorite: false }]);
  render(<候选推荐 />);
  await user.click(screen.getByRole('button', { name: /筛选.*▾/ }));
  await user.click(screen.getByRole('switch', { name: '只看收藏' }));
  expect(screen.getByText(BFF招聘候选推荐样本.candidate_alias)).toBeTruthy();
  expect(screen.queryByText('匿名乙')).toBeNull();
  expect(mock加载招聘候选).toHaveBeenCalledTimes(1);
  expect(mock设置候选收藏).not.toHaveBeenCalled();
});
```

Add tests for real current Job scope, scope switch, lazy load, pull GET only, “再找一批” POST+GET, previous-list preservation, exact four rejection codes, failure retention, favorite list/detail synchronization, accepted/evaluating label, recruiter delegation without confirmation, list and detail receipt polling while visible, terminal polling stop, no Mock `接触推荐候选`, no navigation into Mock in-talk, detail GET on every entry, 404 unavailable, no identity/age/gender/salary canaries, and Mock behavior/zero P4 requests.

For `已筛候选`, test all active Jobs are requested, archived Jobs are excluded, one leg failure commits none, reason copy is closed, undo waits for server success, and undo does not immediately insert the card into the available current batch.

- [ ] **Step 2: Run recruiter component tests and verify RED**

Run:

```bash
npx vitest run src/组件/候选筛选抽屉.test.tsx src/屏幕/候选推荐.test.tsx src/屏幕/匿名在线简历.test.tsx src/屏幕/已筛候选.test.tsx
```

Expected: FAIL because recruiter screens still read Mock fixtures and the favorite switch does not exist.

- [ ] **Step 3: Add the approved local favorite switch**

Change the drawer props to:

```ts
interface 候选筛选抽屉属性 {
  关闭: () => void;
  只看收藏?: boolean;
  切只看收藏?: (value: boolean) => void;
}
```

Render the switch after the rules list and before the completion button only when both optional props are present:

```tsx
<label className={样式.收藏筛选行}>
  <span>只看收藏</span>
  <button
    role="switch"
    aria-label="只看收藏"
    aria-checked={只看收藏}
    className={`${样式.收藏筛选开关} ${只看收藏 ? 样式.收藏筛选已开 : ''} 可点`}
    onClick={() => 切只看收藏(!只看收藏)}
  />
</label>
```

The screen owns `useState(false)`; toggling performs no HTTP request and filters only the fully loaded current available snapshot.

- [ ] **Step 4: Wire recruiter list, detail, and rejected history**

Backend `候选推荐` registers `P4范围键.招聘列表(当前岗位编号)`, loads/selects `后端状态.招聘可用候选[当前岗位编号]`, and clears the visible range on unmount/scope change. It maps each row with `从P4招聘候选` and does not read `状态.推荐列表`, `收藏候选`, `不合适候选`, `已接触推荐`, `匿名简历表`, or `薪资初筛`. Mutations call P4 operations and catch `P4错误文案`.

Recruiter delegation has no confirmation. It stays on the same page and renders receipt state. Both `候选推荐` and `匿名在线简历` pass only their visible accepted/evaluating summaries to `use发现推荐委托轮询({ 开启: 数据源模式 === 'backend', 委托, 刷新: 操作.刷新委托 })`.

Backend `匿名在线简历` registers `P4范围键.招聘详情(当前岗位编号, recommendationId)`, always calls `读取招聘候选详情(当前岗位编号, recommendationId, true)` on mount, and clears the visible range on unmount. Render only mapped alias, score, experience, job status, summary, skills, education, and salary-relationship copy. Omit age, gender, work-experience rows, candidate salary, direct-chat permission, and Mock resume fallback. Favorite and delegation use the same P4 operations and do not navigate after success.

Backend `已筛候选` computes active Job IDs from `状态.岗位列表.filter(job => job.状态 === '在招')`, registers `P4范围键.招聘已筛(jobIds)`, calls `加载招聘已筛`, and clears the visible range on unmount. It flattens only the atomically committed snapshots, maps reason codes with `P4淘汰原因文案`, and calls `撤销淘汰候选`. Mock continues to use `状态.不合适候选` and its current reducer.

- [ ] **Step 5: Run recruiter tests and verify GREEN**

Run:

```bash
npx vitest run src/组件/候选筛选抽屉.test.tsx src/屏幕/候选推荐.test.tsx src/屏幕/匿名在线简历.test.tsx src/屏幕/已筛候选.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the recruiter UI slice**

```bash
git add src/组件/候选筛选抽屉.tsx src/组件/候选筛选抽屉.module.css src/组件/候选筛选抽屉.test.tsx src/屏幕/候选推荐.tsx src/屏幕/候选推荐.module.css src/屏幕/候选推荐.test.tsx src/屏幕/匿名在线简历.tsx src/屏幕/匿名在线简历.test.tsx src/屏幕/已筛候选.tsx src/屏幕/已筛候选.test.tsx
git commit -m "feat: wire recruiter p4 recommendations"
```

---

### Task 8: Prove Backend/Mock Isolation and Run Delivery Gates

**Files:**
- Modify: `e2e/数据源模式.spec.ts`

**Interfaces:**
- Consumes: all P4 slices.
- Produces: browser evidence that Backend renders HTTP markers and Mock sends zero P4 requests.

- [ ] **Step 1: Add mutable P4 fixture routes and failing journeys**

Add fixture IDs and marker values that do not exist in Mock:

```ts
const P4编号 = {
  intention: 'int_00112233445566778899aabbccddeef1',
  job: 'job_00112233445566778899aabbccddeef2',
  candidateRecommendation: 'rec_00112233445566778899aabbccddeef3',
  recruiterJob: 'job_00112233445566778899aabbccddeef4',
  recruiterRecommendation: 'rec_00112233445566778899aabbccddeef5',
  candidateDelegation: 'del_00112233445566778899aabbccddeef6',
  recruiterDelegation: 'del_00112233445566778899aabbccddeef7',
  case: 'case_00112233445566778899aabbccddeef8',
} as const;

const P4标记 = {
  jobTitle: 'P4 Fixture 分布式系统工程师',
  company: 'P4 Fixture 星河科技',
  publisher: 'P4 Fixture 招聘负责人',
  candidateAlias: 'P4候选甲',
  candidateSummary: 'P4 fixture 匿名候选摘要，只来自 HTTP',
} as const;
```

The fixture owns available/rejected arrays, favorites, refresh counts, delegation reads, mutation request records, and one invalid-page branch. Route only the P4 paths named in the Spec; do not add watch routes.

Add Backend journeys that prove:

1. Candidate list/detail render `jobTitle/company/publisher` from HTTP.
2. Pull-to-refresh sends GET and no refresh POST.
3. Empty-state/manual refresh sends one POST with a stable Idempotency-Key, then GET.
4. Candidate delegation sends zero requests before confirmation, then sends literal disclosure true, shows accepted/evaluating, polls to `case_started`, and never opens a Mock deal.
5. Candidate not-interested disappears only after 200.
6. Recruiter list/detail render alias/summary from HTTP and do not render injected identity/salary canaries.
7. Favorite filtering is local; rejection/undo persist; screened-out aggregates active Jobs.
8. Recruiter delegation has no confirmation and never creates a Mock candidate Case.
9. 401 cleans P4 UI, 404 shows unavailable, 503/invalid page preserves the old successful snapshot, and a stale scope response is ignored.

Add one Mock journey that visits candidate list/detail and recruiter list/detail, favorites, rejection, and both delegation buttons; collect requests and assert:

```ts
const isP4 = (url: string) => /\/(job-recommendation|candidate-recommendation|job-delegation|candidate-delegation)/.test(url);
expect(apiRequests.filter(isP4)).toEqual([]);
```

- [ ] **Step 2: Run data-source E2E and verify RED**

Run:

```bash
npm run test:e2e:data-source
```

Expected: FAIL until fixture routes and P4 page behavior are complete.

- [ ] **Step 3: Finish fixtures and make data-source E2E GREEN**

Keep fixture response DTOs exact and page cursors opaque. Record every mutation’s method, path, body, `If-Match`, and `Idempotency-Key`. For the controlled retry branch return the same receipt for the same key. For invalid pages inject one extra key and assert the strict decoder rejects it without clearing the prior list.

Run:

```bash
npm run test:e2e:data-source
```

Expected: PASS.

- [ ] **Step 4: Run focused and full delivery gates**

Run in this order:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e:data-source
npm run ui:check -- --base 96257a2683dfe775eda61b6076a9aab12ded9c9a
```

Expected: every command exits 0. If a changed shared component affects ordinary browser journeys, also run:

```bash
npm run test:e2e
```

Expected: exit 0.

- [ ] **Step 5: Inspect final boundaries**

Run:

```bash
rg -n "市场列表|推荐列表|匿名简历表|委托入谈|接触推荐候选" src/屏幕/看市场.tsx src/屏幕/职位详情.tsx src/屏幕/候选推荐.tsx src/屏幕/匿名在线简历.tsx src/屏幕/已筛候选.tsx
rg -n "job-watches|candidate-watches|MatchCase|case_started" src/数据/招聘数据源/发现推荐.ts src/状态/后端/发现推荐操作.ts
git diff --check
git status --short
```

Expected: legacy imports/actions appear only inside explicit `数据源模式 === 'mock'` branches; no watch implementation exists; `case_started` only records a real Case reference; `git diff --check` is clean; status contains only intended P4 files.

- [ ] **Step 6: Commit the E2E and gate slice**

```bash
git add e2e/数据源模式.spec.ts
git commit -m "test: prove p4 discovery data-source isolation"
```

---

## Execution Notes

- Read the Spec before Task 1 and re-read its error/concurrency sections before Tasks 3–5.
- Run each RED command before implementation; a test that passes before the behavior exists is not proving the intended boundary.
- Keep every task commit independently reviewable. Do not combine P4 implementation with formatting, dependency upgrades, route redesign, or Mock cleanup.
- When a Backend field is absent, render the existing empty/undisclosed state. Do not “improve” the page by sourcing a visually convenient Mock field.
- The final branch must retain the calibrated Spec and this Plan so a fresh executor has both the product boundary and the task-level interfaces.
