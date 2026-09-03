# Mutual Discovery Frontend Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the frontend to the frozen mutual-discovery Job confirmation, historical match-basis, ranking v2, and recruiter organization-verification contracts without changing Mock behavior or adding a second state architecture.

**Architecture:** Extend the existing `BFF契约 → 招聘数据源 decoder → 映射 → 后端 operation → screen` vertical slice. Job confirmation is an owner/current fact, recommendation confirmation is a separate immutable batch-time fact, and the recruiter-refresh 409 is accepted only through one route-scoped exact error contract before a single authoritative Owner Jobs reread.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Vite, ESLint, existing Chinese-domain data source and operation modules.

**Spec:** `docs/superpowers/specs/2026-09-03-mutual-discovery-frontend-design.md`

## Global Constraints

- Work from frontend baseline `ee64c560` plus the approved spec commit `af9aa71f`; calibrate wire details against backend `release/0.2.5@37661dee9`, especially commits `c1bb26ce9` and `84d10f1e3`.
- Run in small TDD steps. Every behavior change starts with a failing focused test, then the smallest implementation, then the focused test again.
- Do not add a Job truth state machine, a second Job draft model, a schema framework, page-level fetches, runtime/watch work, hosted-agent handling, or Mock-only confirmation fields.
- Never parse `requirements`, descriptions, tags, `match_reasons`, or `highlights` to infer structured facts. Never reinterpret an old card using the embedded Job's current confirmation.
- Preserve existing CAS/`If-Match`, idempotency-key, session-clear, and scope-generation behavior. The organization conflict path performs no second refresh POST.
- Treat unknown success keys/enums and malformed opted-in error envelopes as `BFF错误(..., 'invalid_response', ...)`; screens show Chinese closed-copy or a generic Chinese fallback, never the backend English message.
- After each task, review `git diff`, run the task's focused tests, and make the stated commit. Do not include unrelated user changes.

---

### Task 1: Freeze wire types and strict success decoders

**Files:**

- Modify: `src/数据/BFF契约.ts`
- Modify: `src/测试/BFF样本.ts`
- Modify: `src/数据/招聘数据源/岗位.ts`
- Modify: `src/数据/招聘数据源/岗位.test.ts`
- Modify: `src/数据/招聘数据源/发现推荐.ts`
- Modify: `src/数据/招聘数据源/发现推荐.test.ts`

- [ ] **Step 1: Write failing Owner Job decoder tests**

In `岗位.test.ts`, add table-driven cases around `读取岗位()`. Return `{...BFF岗位样本, structured_requirements_confirmed: confirmed}` for `true` and `false`, then assert `快照.服务端[BFF岗位样本.job_id].structured_requirements_confirmed === confirmed`. Add four invalid response bodies: omit the field by destructuring it out, set it to string `'true'`, set experience to `'two_years'`, and set education to `'college'`. Each must reject with `{ code: 'invalid_response' }`.

Also assert that the existing exact `hard_requirements` checks still run. Do not default a missing confirmation to `false`.

- [ ] **Step 2: Run the Owner Job test and confirm failure**

Run:

```bash
npx vitest run src/数据/招聘数据源/岗位.test.ts
```

Expected: new confirmation/closed-enum cases fail because only `hard_requirements` is currently validated.

- [ ] **Step 3: Close the Job wire types and decoder**

In `BFF契约.ts`, define and reuse:

```ts
export type BFF经验要求 =
  | 'none' | 'one_to_three_years' | 'three_to_five_years'
  | 'five_plus_years' | 'ten_plus_years';
export type BFF学历要求 =
  | 'none' | 'associate' | 'bachelor' | 'master' | 'doctorate';
```

Change `BFFOwnerJob.experience_requirement`/`education_requirement` and `BFF岗位创建.experience_requirement`/`education_requirement` to these same two unions, then add required `structured_requirements_confirmed: boolean` to Owner Job. `BFFCandidateJob` inherits that required field. Add `structured_requirements_confirmed: true` to `BFF岗位创建`; because `BFF岗位补丁` is partial, its field remains optional but can only be literal `true`. This gives both read and write mappings compile-time protection against new or mistyped enum codes.

In `岗位.ts`, extend the existing pre-mapping check with three direct checks: boolean confirmation, membership in the five experience codes, and membership in the five education codes. Keep the check local to Owner Job reads; throw a `BFF错误(200, 'invalid_response', '服务返回了不符合契约的岗位数据')` on drift.

Update every Owner Job fixture in `BFF样本.ts` explicitly with `structured_requirements_confirmed: true`; individual legacy tests override it to `false`.

- [ ] **Step 4: Write failing discovery decoder tests**

In `发现推荐.test.ts`, add cases proving:

- Candidate Job accepts confirmation `true` and `false`, rejects missing/wrong type, and rejects unknown experience/education enums.
- Candidate and recruiter cards each accept a top-level basis of `true` and `false`, but reject missing/wrong type and extra keys.
- `DiscoveryBatch.ranking_version` accepts both full literals and rejects `v2`, `discovery-ranking.v3`, and arbitrary strings.
- A candidate card with top-level `false` and embedded Job `true` remains a valid, distinguishable DTO.

Run:

```bash
npx vitest run src/数据/招聘数据源/发现推荐.test.ts
```

Expected: new fields are missing from the exact-key sets and v2 is rejected.

- [ ] **Step 5: Implement the discovery wire and decoder changes**

In `BFF契约.ts`:

```ts
export interface BFF候选岗位推荐 {
  structured_requirements_confirmed: boolean;
}

export interface BFF招聘候选推荐 {
  structured_requirements_confirmed: boolean;
}

export interface BFF发现批次 {
  ranking_version: 'discovery-ranking.v1' | 'discovery-ranking.v2';
}
```

The snippets show the changed members; keep every currently declared sibling member unchanged.

In `发现推荐.ts`, add `structured_requirements_confirmed` to both card exact-key lists and decode it with the existing required-boolean helper. Add it to the Candidate Job exact-key list and decode it there too. Replace the open-string requirement decoding with membership checks against the exact unions. Change the ranking decoder to accept only the two full literals. Do not add defaults or `as` casts that bypass runtime checks.

Update discovery fixtures explicitly; do not derive card basis from `job.structured_requirements_confirmed` in fixture builders.

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
npx vitest run src/数据/招聘数据源/岗位.test.ts src/数据/招聘数据源/发现推荐.test.ts
npm run typecheck
git diff --check
```

Expected: all pass.

Commit:

```bash
git add src/数据/BFF契约.ts src/测试/BFF样本.ts src/数据/招聘数据源/岗位.ts src/数据/招聘数据源/岗位.test.ts src/数据/招聘数据源/发现推荐.ts src/数据/招聘数据源/发现推荐.test.ts
git commit -m "feat: decode mutual discovery job truth"
```

---

### Task 2: Carry explicit confirmation and emit a real sparse Job patch

**Files:**

- Modify: `src/数据/类型.ts`
- Modify: `src/数据/后端映射.ts`
- Modify: `src/数据/后端映射.test.ts`
- Modify: `src/数据/招聘数据源/岗位.test.ts`

- [ ] **Step 1: Write mapper tests for confirmation and sparse semantics**

Add a page-level optional field to test fixtures, named `结构化要求已确认?: boolean`. First write failing tests with these assertions:

```ts
expect(() => 转岗位创建({ ...draft, 结构化要求已确认: false }, context))
  .toThrow('请确认经验和学历将作为自动匹配依据');
expect(转岗位创建({ ...draft, 经验要求: '不限', 最低学历: '不限', 结构化要求已确认: true }, context))
  .toMatchObject({
    experience_requirement: 'none',
    education_requirement: 'none',
    structured_requirements_confirmed: true,
  });
```

For `转岗位补丁(page, previous)`, cover this matrix:

| Change | Expected patch |
| --- | --- |
| no change | `{}` |
| office location only, previous confirmation false | only `office_location`; no confirmation |
| previous confirmation false, user explicitly checks, no content change | only `structured_requirements_confirmed: true` |
| experience only | changed code plus `structured_requirements_confirmed: true` |
| education only | changed code plus confirmation |
| trimmed `requirements` only | changed text plus confirmation |
| description only | only `description`; no confirmation |
| annual salary months number → null | explicit `annual_salary_months: null` |
| campus cohort number → null | explicit `campus_cohort: null` |
| keywords nonempty → `[]` | explicit `keywords: []` |
| unchanged optional/null values | absent |

Also assert that `publisher_mode`, claim, title, recruitment type, category, location, refs, verification statuses, and revision never appear in the patch. Assert that a related change with confirmation absent/false throws before a request can be made.

- [ ] **Step 2: Run mapper tests and confirm failure**

Run:

```bash
npx vitest run src/数据/后端映射.test.ts
```

Expected: create does not require confirmation and patch currently returns a near-full object.

- [ ] **Step 3: Add the page fact and map Owner Job truth**

In `类型.ts`, add to `在招岗位`:

```ts
/** Backend OwnerJob truth; absent in Mock fixtures and never inferred. */
结构化要求已确认?: boolean;
```

In `从BFF岗位`, copy `dto.structured_requirements_confirmed` verbatim. Do not add the field to Mock fixtures.

At the top of `转岗位创建`, require `页面岗位.结构化要求已确认 === true`; otherwise throw the exact Chinese validation message. Add literal `structured_requirements_confirmed: true` to the body. `none` remains a valid enum and does not bypass the confirmation check.

- [ ] **Step 4: Replace the near-full patch with local sparse comparison**

Compute each editable wire value once, then populate a mutable `BFF岗位补丁` only when it differs from `previous`. Keep this local to `转岗位补丁`; do not add a generic diff utility.

Use these comparison rules:

- primitives: strict equality against the matching Owner Job field;
- salary: include `{ lower, upper }` only if either number differs; salary period remains immutable through this form and is not echoed;
- `annual_salary_months` and `campus_cohort`: include number or explicit `null` when changed, because those two fields alone are tri-state clears;
- `internship_months` and `onsite_days_per_week`: include only non-null changed numbers; their OpenAPI `null` means unchanged, not clear;
- `hard_requirements`: include only when the page owns a block and one of four closed values differs;
- `keywords`: if the page field is present and the arrays differ by length/order/value, include it even when `[]`; if absent, preserve server state;
- `private_screening_preferences`: normalize the page value to `''`, compare, then include only when changed;
- `description` and `requirements`: use the existing nonblank validation/trim result before comparison;
- omit immutable and server-owned properties entirely.

After comparison, related content changes require a current explicit confirmation. Independently, an explicitly checked legacy-false Job must be promotable even with unchanged content:

```ts
const 结构化字段有变化 =
  patch.experience_requirement !== undefined ||
  patch.education_requirement !== undefined ||
  patch.requirements !== undefined;
if (结构化字段有变化) {
  if (页面岗位.结构化要求已确认 !== true) {
    throw new Error('请确认经验和学历将作为自动匹配依据');
  }
}
if (结构化字段有变化 ||
    (页面岗位.结构化要求已确认 === true &&
     previous.structured_requirements_confirmed === false)) {
  patch.structured_requirements_confirmed = true;
}
return patch;
```

Never write `structured_requirements_confirmed: false`. An unchanged legacy-false Job may therefore save an unrelated edit.

- [ ] **Step 5: Prove the HTTP data source sends the sparse body**

In `岗位.test.ts`, add request-level tests for `更新岗位()`:

- related edit produces exactly the changed field plus confirmation and retains the existing `If-Match` header behavior;
- unrelated edit on a legacy-false Owner Job produces only that edit;
- no immutable or organization fields are serialized.

Run:

```bash
npx vitest run src/数据/后端映射.test.ts src/数据/招聘数据源/岗位.test.ts
npm run typecheck
git diff --check
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/数据/类型.ts src/数据/后端映射.ts src/数据/后端映射.test.ts src/数据/招聘数据源/岗位.test.ts
git commit -m "feat: require confirmed sparse job writes"
```

---

### Task 3: Add the Backend-only confirmation control to publish/edit

**Files:**

- Modify: `src/屏幕/发布岗位.tsx`
- Modify: `src/屏幕/发布岗位.module.css`
- Modify: `src/屏幕/发布岗位.test.tsx`

- [ ] **Step 1: Write failing screen tests**

Extend the existing publish-screen harness rather than creating a second harness. Add tests proving:

- Backend create starts unchecked; submit remains on step three, shows `请确认经验和学历将作为自动匹配依据`, and calls neither create nor update.
- Keeping experience and education at `不限`, then checking the box, allows create and passes `结构化要求已确认: true` in the page model.
- Backend edit hydrates checked from a confirmed Owner Job and unchecked from a legacy-false one.
- A legacy-false edit can check and save without altering the three texts; update receives `结构化要求已确认: true`, allowing the sparse mapper to emit a confirmation-only patch.
- After checking, changing experience, education, or the `requirements` textarea independently unchecks it immediately.
- Changing salary, office location, description, screening preferences, or another unrelated control does not uncheck it.
- A legacy-false edit with only an unrelated change can save without checking.
- Mock mode renders no checkbox and retains its current submit behavior.

Query the checkbox by its accessible label text, not a CSS selector.

- [ ] **Step 2: Run the screen test and confirm failure**

Run:

```bash
npx vitest run src/屏幕/发布岗位.test.tsx
```

Expected: checkbox queries fail and submit does not enforce the new confirmation.

- [ ] **Step 3: Implement one local confirmation state**

Initialize in `发布岗位`:

```ts
const [结构化要求已确认, 设结构化要求已确认] = useState(
  是后端 ? 编辑目标?.结构化要求已确认 === true : false,
);
```

Wrap only the three relevant setters so a real value change clears confirmation in Backend mode:

```ts
const 改经验要求 = (next: string) => {
  if (next !== 经验要求 && 是后端) 设结构化要求已确认(false);
  设经验要求(next);
};
```

Apply the same value-change guard to education and `职位要求`. Do not clear on no-op clicks or unrelated edits.

When assembling the `在招岗位`, include `结构化要求已确认` only in Backend mode. Before the Backend mutation path, if create is unconfirmed, or edit changed any of the three structured inputs and is unconfirmed, show the exact validation message, select step three, and return before calling the operation. The mapper remains the lower-level invariant check.

- [ ] **Step 4: Render an accessible native checkbox in step three**

Place it immediately after the `requirements` textarea and only when `是后端`:

```tsx
<label className={样式.结构化确认}>
  <input
    type="checkbox"
    checked={结构化要求已确认}
    onChange={(event) => 设结构化要求已确认(event.currentTarget.checked)}
  />
  <span>我已确认经验和学历设置将作为自动匹配依据；补充要求不会被自动解析。修改上述内容后需要重新确认。</span>
</label>
```

Add only the minimal spacing/alignment styles required by the existing form. Do not introduce a new shared component.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npx vitest run src/屏幕/发布岗位.test.tsx src/数据/后端映射.test.ts
npm run typecheck
git diff --check
```

Expected: all pass.

Commit:

```bash
git add src/屏幕/发布岗位.tsx src/屏幕/发布岗位.module.css src/屏幕/发布岗位.test.tsx
git commit -m "feat: confirm structured job requirements"
```

---

### Task 4: Keep current Job truth separate from historical recommendation basis

**Files:**

- Modify: `src/数据/招聘数据源类型.ts`
- Modify: `src/数据/发现推荐映射.ts`
- Modify: `src/数据/发现推荐映射.test.ts`
- Modify: `src/屏幕/职位详情.tsx`
- Modify: `src/屏幕/职位详情.test.tsx`
- Modify: `src/屏幕/候选推荐.tsx`
- Modify: `src/屏幕/候选推荐.test.tsx`
- Modify: `src/屏幕/匿名在线简历.tsx`
- Modify: `src/屏幕/匿名在线简历.test.tsx`

- [ ] **Step 1: Write failing projection tests**

Add these explicit fields:

```ts
export interface P4岗位事实 {
  结构化要求已确认: boolean;
}

export interface P4候选岗位页面 {
  匹配依据已确认: boolean | null;
}

export interface P4招聘候选页面 {
  匹配依据已确认: boolean;
}
```

These are additions to the named interfaces; retain their current sibling members. `null` means a direct Candidate Job detail with no recommendation batch, while booleans always come from a card.

Before implementing, test that:

- `从P4候选岗位` uses the card's top-level basis even when the embedded Job has the opposite current value;
- `从P4CandidateJob` exposes current Job confirmation under `岗位事实` but sets `匹配依据已确认: null`;
- `从P4招聘候选` copies the recruiter card's top-level basis;
- score is unchanged in both confirmed and unconfirmed cases.

- [ ] **Step 2: Run mapping tests and confirm failure**

```bash
npx vitest run src/数据/发现推荐映射.test.ts
```

- [ ] **Step 3: Implement the projection without inference**

Change `建候选岗位视图` to accept `匹配依据已确认: boolean | null`, copy current Job confirmation into `岗位事实`, and set:

- recommendation-card call: `card.structured_requirements_confirmed`;
- direct Candidate Job call: `null`;
- recruiter-card call: `card.structured_requirements_confirmed`.

Do not derive any of these from a score, reason text, highlight text, Job revision, or `ranking_version`.

- [ ] **Step 4: Write failing rendering tests for the three affected surfaces**

Use a confirmed control and an unconfirmed case on each surface:

- `职位详情.test.tsx`: historical `false` with embedded current Job `true` keeps the backend score but does not render deterministic experience/education rows or generated analysis; it renders `经验与学历尚未核对`. Historical `true` keeps the current analysis. Direct Candidate Job detail (`null` basis) shows current Job fact but no recommendation conclusion/score; run this assertion once with current Job confirmation `true` and once with `false`, and in both cases assert the experience/education alignment rows are absent.
- `候选推荐.test.tsx`: recruiter card `false` keeps its score but renders no highlight strings and instead renders `经验与学历尚未核对`; `true` renders highlights.
- `匿名在线简历.test.tsx`: the same recruiter-detail behavior applies; no hidden highlight remains in the document text for `false`.

Also retain an assertion that a card's open `match_reasons`/`highlights` are never selectively filtered: the whole group is shown for `true` and the whole group is hidden for `false`.

- [ ] **Step 5: Implement neutral rendering**

In Backend branches only:

- `职位详情.tsx`: when `视图.匹配依据已确认 !== true` (both historical `false` and direct-detail `null`), skip `求职侧对齐行`, `求职匹配分析`, and all deterministic row rendering, and pass no alignment rows to `匹配分析块`. Historical `false` keeps the backend match score ring and shows `经验与学历尚未核对`. `null` keeps the existing direct-detail no-score behavior and shows only the current Job status as `结构化设置：已确认/尚未确认`, never a recommendation conclusion.
- `候选推荐.tsx`: keep `视图.匹配分`; render either the complete `视图.亮点` group or the neutral sentence.
- `匿名在线简历.tsx`: apply the same complete-group rule to `视图.亮点`.

Do not change Mock rendering. Use existing typography/card styles where possible; add no cross-screen component for one sentence.

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
npx vitest run src/数据/发现推荐映射.test.ts src/屏幕/职位详情.test.tsx src/屏幕/候选推荐.test.tsx src/屏幕/匿名在线简历.test.tsx
npm run typecheck
git diff --check
```

Expected: all pass, including the contradictory historical/current fixture.

Commit:

```bash
git add src/数据/招聘数据源类型.ts src/数据/发现推荐映射.ts src/数据/发现推荐映射.test.ts src/屏幕/职位详情.tsx src/屏幕/职位详情.test.tsx src/屏幕/候选推荐.tsx src/屏幕/候选推荐.test.tsx src/屏幕/匿名在线简历.tsx src/屏幕/匿名在线简历.test.tsx
git commit -m "feat: honor historical match confirmation basis"
```

---

### Task 5: Add a route-opt-in exact error contract for recruiter refresh

**Files:**

- Modify: `src/数据/HTTP客户端.ts`
- Modify: `src/数据/HTTP客户端.test.ts`
- Modify: `src/数据/招聘数据源/发现推荐.ts`
- Modify: `src/数据/招聘数据源/发现推荐.test.ts`

- [ ] **Step 1: Write failing HTTP client contract tests**

Add a request option separate from the existing success `严格信封`:

```ts
export interface BFF严格错误项 {
  status: number;
  type: string;
  message: string;
}
// in BFF请求共同选项
严格错误合同?: readonly BFF严格错误项[];
```

Test one accepted envelope and every drift dimension:

```ts
const 合同 = [{
  status: 409,
  type: 'organization_verification_required',
  message: 'A verified organization is required to discover candidates.',
}] as const;
```

- exact `{error:{type,message,request_id:'req_1'}}` becomes the original `BFF错误(409, code, message)`;
- wrong status, unknown type, wrong fixed message, empty request ID, missing key, root extra key, error extra key, non-object, and invalid JSON all become `code: 'invalid_response'`;
- a request without `严格错误合同` retains the existing permissive parser;
- Retry-After parsing and existing controlled retry tests remain unchanged.

- [ ] **Step 2: Run the HTTP client test and confirm failure**

```bash
npx vitest run src/数据/HTTP客户端.test.ts
```

- [ ] **Step 3: Implement exact validation in the existing parser path**

Pass the optional contract from `请求()` through every `单次()` call, including controlled retries. For non-2xx responses with a contract:

1. Parse JSON once.
2. Require root exact keys `['error']`.
3. Require error exact keys `['type', 'message', 'request_id']`.
4. Require nonempty string `request_id`.
5. Find exactly one contract row matching response status and error type.
6. Require exact fixed message equality.

If any check fails, return:

```ts
new BFF错误(resp.status, 'invalid_response', '错误响应不符合路由契约', [], retryAfter)
```

If it passes, build the normal `BFF错误`. Keep the permissive `fields` logic only for callers without this option. Do not change binary requests.

- [ ] **Step 4: Freeze the recruiter-refresh whitelist in its data source**

Next to `刷新招聘候选` in `发现推荐.ts`, define the exact OpenAPI rows:

| Status | Type | Fixed message |
| --- | --- | --- |
| 400 | `invalid_request_body` | `The request body is not valid for this route.` |
| 401 | `invalid_session` | `The session is missing or no longer valid.` |
| 403 | `invalid_origin` | `Mutating requests must originate from the application origin.` |
| 403 | `role_required` | `This action requires an active recruitment role.` |
| 403 | `role_suspended` | `The role is suspended and cannot be restored here.` |
| 404 | `recommendation_not_found` | `The recommendation does not exist.` |
| 404 | `recommendation_unavailable` | `The recommendation is not available right now.` |
| 409 | `idempotency_conflict` | `This idempotency key was used with a different request.` |
| 409 | `organization_verification_required` | `A verified organization is required to discover candidates.` |
| 503 | `source_unavailable` | `The recruitment service is unavailable; retry shortly.` |
| 503 | `recruitment_service_unavailable` | `The recruitment service is unavailable; retry shortly.` |
| 503 | `operation_outcome_unknown` | `The operation outcome is unknown; retry with the same idempotency key.` |

Pass this array only on `POST /api/v1/recruiter/candidate-recommendation-refreshes`. Do not enable it on candidate refresh or other discovery routes.

- [ ] **Step 5: Add route-level tests and commit**

In `发现推荐.test.ts`, assert the request option is present only on recruiter refresh. Feed exact organization 409 and expect its code; feed each malformed variant and expect `invalid_response`; feed `recommendation_unavailable` and prove it remains that code rather than organization verification.

Run:

```bash
npx vitest run src/数据/HTTP客户端.test.ts src/数据/招聘数据源/发现推荐.test.ts
npm run typecheck
git diff --check
```

Expected: all pass.

Commit:

```bash
git add src/数据/HTTP客户端.ts src/数据/HTTP客户端.test.ts src/数据/招聘数据源/发现推荐.ts src/数据/招聘数据源/发现推荐.test.ts
git commit -m "feat: validate recruiter refresh error contract"
```

---

### Task 6: Reconcile organization-verification races with one Owner Jobs read

**Files:**

- Modify: `src/状态/后端/发现推荐操作.ts`
- Modify: `src/状态/后端/发现推荐操作.test.ts`
- Modify: `src/屏幕/候选推荐.tsx`
- Modify: `src/屏幕/候选推荐.test.tsx`

- [ ] **Step 1: Write failing operation tests for the exact race**

Build on the existing operation harness. For one `刷新招聘候选(jobId)` call, cover:

1. Exact organization 409, then Owner Jobs reread returns that same Job unverified or missing `hiring_organization_ref`: exactly one refresh POST, exactly one `读取岗位()`, `水合后端岗位` dispatched once, backend `岗位快照` replaced, and the original organization error reaches the caller.
2. Exact organization 409, reread returns the same Job still verified with a ref: one POST, one GET, no second POST, and caller receives `invalid_response` with Chinese `数据状态异常` copy.
3. Reread returns no requested Job: treat as `invalid_response`, not as an organization CTA.
4. Reread 401 while the original fence is current: run the existing unified account clear.
5. Reread 503: no job hydration and a generic recoverable error reaches the caller.
6. Change subject, role, session generation, visible scope, or scope generation while reread is in flight: late success and late 401 are discarded; no new-session clear, no hydration, no CTA signal.
7. Direct refresh failures `recommendation_unavailable`, malformed contract (`invalid_response`), 401, and 503 perform zero Owner Jobs rereads; the only path allowed to perform the read is the exact organization 409 from cases 1–6.
8. Existing synthetic `BFF错误` values with `status === 200` still expose their already-closed Chinese delegation/refusal copy through `P4错误文案`; only unknown real HTTP errors fall back to the generic sentence.

Every case asserts POST count; this is the regression guard against accidental retry with a new idempotency key.

- [ ] **Step 2: Run operation tests and confirm failure**

```bash
npx vitest run src/状态/后端/发现推荐操作.test.ts
```

- [ ] **Step 3: Implement the one-read reconciliation in the existing operation**

Keep `运行范围刷新` unchanged and business-code agnostic. Its existing POST-error path may first settle the job snapshot through `提交失败`; the recruiter-only catch below performs the authoritative reread and settles the same snapshot again with the final outcome. Do not teach the shared candidate/recruiter refresh kernel about `organization_verification_required`.

In `刷新招聘候选(jobId)`, name the existing `开始`/`成功`/`失败` state writers as local closures so both `运行范围刷新` and the organization reconciliation can settle the same job-scoped snapshot. Then wrap the existing call:

```ts
const scopeKey = P4范围键.招聘列表(jobId);
const 对账Fence = 捕获栅栏(引用, scopeKey);
try {
  await 运行范围刷新({
    scopeKey,
    发起: (源, 幂等键) => 源.刷新招聘候选(jobId, 幂等键),
    重读: (源) => 源.读取招聘候选(jobId),
    开始: 提交开始,
    成功: 提交成功,
    失败: 提交失败,
  });
} catch (错误) {
  if (!(错误 instanceof BFF错误) ||
      错误.status !== 409 ||
      错误.code !== 'organization_verification_required') throw 错误;
  if (!fenceStillCurrent(引用, 对账Fence)) return;
  // exactly one 后端.读取岗位(); never call 刷新招聘候选 again
}
```

For that one reread:

- on current-fence 401, call the existing `清账号状态` and return;
- on stale success/error, return without mutation or rethrow;
- on another current-fence reread error, call `提交失败(P4错误文案(对账错误), 对账Fence)` before throwing it, so the list cannot remain stuck in `刷新中`;
- on success/current fence, locate `快照.服务端[jobId]`; missing is contract drift;
- dispatch `{ 型: '水合后端岗位', 快照 }` and update `后端状态.岗位快照` only after the fence check;
- if `判断P4招聘组织前提(ownerJob).kind === 'blocked'`, call `提交失败` to clear `刷新中`, then throw the original exact organization error so the screen can suppress toast and let the newly hydrated precondition render the existing CTAs;
- if it is still `ready`, call `提交失败('数据状态异常，请稍后再试', 对账Fence)`, then throw `new BFF错误(409, 'invalid_response', '数据状态异常，请稍后再试')`;
- `unknown` after an authoritative complete Owner Jobs page follows the same invalid-response settlement.

Add `organization_verification_required: '匿名候选推荐需要已验证的用人组织'` to the closed P4 error table. For codes outside the table, preserve `取后端错误文案(error)` only when `error.status === 200`, because the operation deliberately encodes already-closed delegation/refusal UI copy in synthetic status-200 `BFF错误` values. Unknown real HTTP errors use `请求失败，请稍后再试` and never expose backend English. Update the existing `P4错误文案` test that currently expects an unknown status-500 message, and retain/add the status-200 delegation-copy regression.

- [ ] **Step 4: Write failing screen-state tests**

In `候选推荐.test.tsx`, assert:

- after the operation hydrates a blocked Owner Job, the inline state persists, the refresh action is disabled, `去认证` routes to `/hr/verify`, and `加入企业` routes to `/hr/organization-invitation`;
- when the operation returns `invalid_response` while the authoritative Job is still ready, the current job gets a local persistent `数据状态异常` block and refresh is disabled;
- this local contract block resets when changing job or remounting the screen and never blocks another job;
- 401/503/unknown/malformed errors show no organization CTA;
- the old `recommendation_unavailable` special translation is gone.

- [ ] **Step 5: Implement the minimal local persistent block**

In `候选推荐.tsx`, remove the old `recommendation_unavailable` plus “same job now blocked” translation. Add one local job ID state for the still-ready contract failure, for example:

```ts
const [数据异常岗位, 设数据异常岗位] = useState<string | null>(null);
const 当前数据异常 = 数据异常岗位 === 活跃岗位;
```

Clear it when `活跃岗位` changes and naturally on unmount. On exact organization error, do not toast; the authoritative hydration drives the existing blocked state. On `invalid_response` returned by the reconciliation while the same job is still active, set the local job ID and show persistent `数据状态异常，请稍后再试`. Disable refresh for that job. Other errors use `P4错误文案` and do not create organization UI.

Reuse the existing blocked rendering and existing routes (`路径.企业实名认证`, `路径.企业邀请加入`). Do not add global state or persist this flag outside the screen.

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
npx vitest run src/状态/后端/发现推荐操作.test.ts src/屏幕/候选推荐.test.tsx
npm run typecheck
git diff --check
```

Expected: all pass; POST-count assertions remain one.

Commit:

```bash
git add src/状态/后端/发现推荐操作.ts src/状态/后端/发现推荐操作.test.ts src/屏幕/候选推荐.tsx src/屏幕/候选推荐.test.tsx
git commit -m "feat: reconcile recruiter organization conflicts"
```

---

### Task 7: Run the complete contract and regression verification

**Files:**

- Verify only; modify a file only through a new failing regression test and its smallest fix.

- [ ] **Step 1: Run all directly affected tests together**

```bash
npx vitest run \
  src/数据/HTTP客户端.test.ts \
  src/数据/后端映射.test.ts \
  src/数据/招聘数据源/岗位.test.ts \
  src/数据/招聘数据源/发现推荐.test.ts \
  src/数据/发现推荐映射.test.ts \
  src/状态/后端/发现推荐操作.test.ts \
  src/屏幕/发布岗位.test.tsx \
  src/屏幕/职位详情.test.tsx \
  src/屏幕/候选推荐.test.tsx \
  src/屏幕/匿名在线简历.test.tsx
```

Expected: all pass.

- [ ] **Step 2: Run repository-wide gates**

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
git status --short
```

Expected: tests/typecheck/lint/build pass, diff check is empty, and worktree status contains only intentional committed work (normally empty).

- [ ] **Step 3: Verify the two constructible live Backend quadrants**

With `VITE_DATA_SOURCE=backend` and backend `release/0.2.5@37661dee9`, create confirmed Jobs through the supported API and exercise:

```text
verified organization + confirmed basis
unverified organization + confirmed Job
```

Verify that the verified Job can refresh and show a confirmed batch, while the known-unverified Job is blocked before refresh. The timing-sensitive 409 race is not forced by mutating backend state during manual acceptance; its exact one-POST/one-GET and stale-fence behavior is deterministically covered by Task 5 data-source tests and Task 6 operation/screen tests. Switching jobs must not carry cards or the local block across scope.

- [ ] **Step 4: Verify the two legacy-only quadrants with frontend fixtures**

The public Job API cannot create or patch `structured_requirements_confirmed: false`; only migration `000029` produces that legacy state. Do not mutate migration data and do not invent a seed endpoint. Use the focused tests from Tasks 1, 2, 3, 4, and 6 to verify:

```text
verified organization + unconfirmed legacy Job/card basis
unverified organization + unconfirmed legacy Job/card basis
```

Across those deterministic fixtures, assert:

- confirmed historical cards show the entire reason/highlight group;
- unconfirmed historical cards retain scores but show only `经验与学历尚未核对`;
- unverified organization blocks before refresh when already known;
- legacy false can save an unrelated edit without confirmation and can also send a confirmation-only patch when the user explicitly checks;
- historical card `false` remains authoritative even when the embedded current Job is `true`.

- [ ] **Step 5: Verify create/edit interaction and Mock isolation**

In Backend mode, verify create defaults unchecked, `不限` still requires a click, each of the three relevant edits clears the checkbox, and an unrelated legacy edit stays saveable. Inspect the network body for literal `true`, sparse changed fields, and no `false`/immutable/organization echo.

In Mock mode, verify the checkbox is absent and publish/edit/recommendation presentation is unchanged.

- [ ] **Step 6: Inspect final history**

```bash
git log --oneline --decorate -8
git status --short
```

Expected: the six implementation commits are present in task order and the worktree is clean. If a verification step exposed a defect, first add a focused failing regression test, apply the smallest fix, rerun the relevant focused and full gates, and commit that concrete fix separately.
