# Recruitment P5 Frontend Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing candidate and recruiter in-talk/archive pages to the final P5 MatchCase contract, including viewer-specific actions, four-stage detail, S0–S3 mutations, authorized raw PDF access, direct refresh, terminal history, and handoff-pending UI without inventing P5.1 presentation data.

**Architecture:** Add one strict no-store MatchCase facade to the existing `HTTP招聘数据源`, retain P5 wire snapshots in backend-only memory, and expose reads/mutations through a focused P5 operation layer with role/session/scope fences. Backend screens render shared P5 list/detail/history components from a closed state-to-UI mapper; Mock screens keep the current reducer story and send no P5 requests.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Testing Library, Playwright 1.62, existing same-origin BFF HTTP client.

**Spec:** `docs/superpowers/specs/2026-08-29-recruitment-p5-frontend-wiring-design.md`

## Global Constraints

- Frontend product baseline is `origin/main@636fedefb81998436723ad1585ccdf7b439c5c21`; this Spec/Plan branch contains documentation only.
- Audited backend baseline is committed `recruitment/plan-p5@817d87050f8857dbf0c3cab2ef308d7d5f95df02`. The uncommitted backend `apps/recruitment-bff/scripts/local-e2e.sh` change is not contract evidence.
- Task 0 is a hard admission gate. Product code must not change until all four P5 blockers are present in final public OpenAPI, DTOs and contract tests.
- Do not guess the absent wire nesting for detail role context or the absent final `state.step` enum. Copy the exact admitted public schema after Task 0.
- The only P5 backend blockers are viewer-specific open-list `needs_action` with sorting/cursor, closed `state.step` with legal combinations, completed handoff projecting `handoff_pending`, and role-specific minimal detail context.
- `respond_fact` is implemented. Use the current-stage `supplementary_question.ref` as `prompt_id`; do not request or invent an action payload DTO.
- Do not add `next_step`. UI authority is `state.lifecycle/stage/status/step`, `needs_action`, `available_actions`, and typed detail blocks.
- Unknown lifecycle/stage/status/step/action or any illegal combination fails closed with no mutation controls.
- P5 handoff supports only `completed + handoff_pending`. Never generate, cache, infer or route with a conversation ID.
- Do not add `published`; it belongs to P7.
- Full CandidateJob, organization/publisher profile, score/reasons/highlights, compensation relationship, full anonymous online resume, experiences/certificates/portfolio, cross-P4/P5 alias stability, presentation snapshot and structured identity are P5.1 dependencies only.
- Missing P5.1 sections stay absent. Backend mode never imports/falls back to Mock, parses timeline prose, parses PDF, or aggregates P4/Job/Organization/Resume APIs to fill them.
- Treat P5 alias as opaque display text: show it verbatim, never parse/truncate/derive an avatar or another field from it. Use a generic anonymous avatar and use `case_id` for React keys, state keys, requests and caches.
- P5 state is memory-only and no-store. Never add it to `资料持久化`, `localStorage`, `sessionStorage`, Cache API or a service worker.
- All P5 JSON and PDF fetches use `Request.cache = 'no-store'`. Revoke PDF object URLs on close/unmount.
- Mock mode sends zero P5 requests and preserves the current immediate reducer/demo behavior.
- Use TDD for every code task and commit after each independently green slice.

---

## Contract Classification at the Implementation Boundary

### P5 implemented / approved

- Candidate/recruiter open list and ended/completed history routes.
- Four-section detail, checklist, transcript, instruction receipts, coordination, intent confirmations and terminal summary.
- Detail-level viewer-specific `needs_action` and `available_actions`.
- S0 fact response; candidate S0/S1 decision and resume submission; recruiter S1 decision; dual-role S2/S3 decision routes.
- Candidate/recruiter Case-scoped resume PDF content routes.
- Candidate/recruiter Case instruction routes.
- Terminal details with no actions and no-store response headers.

### P5 backend blockers (`necessity: required`)

- Viewer-specific list `needs_action` plus the same value in sort/cursor semantics.
- Closed `state.step` and legal lifecycle/stage/status/step matrix.
- Completed handoff outbox projects `step=handoff_pending`.
- Detail directly carries candidate `intention + frozen WorkspaceJob` or recruiter `frozen WorkspaceJob + Case alias`.

### P5.1 dependency ledger, excluded from implementation

- Rich job/company/publisher presentation.
- Score/reasons/highlights and compensation relationship.
- Full anonymous parsed resume and resume sections.
- Stable P4 alias.
- Structured disclosed candidate identity.
- P7 conversation reference and published handoff.

## File Map

### New files

- `src/数据/招聘数据源/MatchCase.ts` — exact P5 paths, query/body encoding, no-store calls, pagination and strict decoding.
- `src/数据/招聘数据源/MatchCase.test.ts` — exact requests, schema closure, cursor, prompt, role fence and malformed-response tests.
- `src/数据/MatchCase展示映射.ts` — admitted closed-code to page-view mapping; no Mock or cross-domain lookup.
- `src/数据/MatchCase展示映射.test.ts` — exhaustive state/action/context/privacy/handoff mapping tests.
- `src/状态/后端/MatchCase操作.ts` — P5 snapshots, reads, mutations, idempotency, fences and immediate reconciliation.
- `src/状态/后端/MatchCase操作.test.ts` — atomicity, stale response, role difference, mutation replay and cleanup tests.
- `src/状态/后端/useMatchCase轮询.ts` — visible list 5-second and open detail 3-second single-flight polling.
- `src/状态/后端/useMatchCase轮询.test.tsx` — fake-timer visibility/unmount/terminal tests.
- `src/屏幕/P5/MatchCase列表.tsx` — shared candidate/recruiter open-list component.
- `src/屏幕/P5/MatchCase列表.test.tsx` — list role/filter/sort/pagination/Mock isolation tests.
- `src/屏幕/P5/MatchCase详情.tsx` — shared direct-refresh four-stage detail and action cards.
- `src/屏幕/P5/MatchCase详情.test.tsx` — direct refresh, S0–S3, privacy, terminal and handoff tests.
- `src/屏幕/P5/MatchCase历史.tsx` — shared ended/completed shelf component.
- `src/屏幕/P5/MatchCase历史.test.tsx` — two-shelf ordering and read-only detail navigation tests.

### Existing files with focused changes

- `src/数据/BFF契约.ts` — admitted P5 wire DTOs and closed enums only.
- `src/数据/HTTP客户端.ts` and `.test.ts` — caller-selectable no-store request behavior for JSON/binary GET.
- `src/数据/HTTP招聘数据源.ts` and `.test.ts` — compose the P5 facade.
- `src/数据/招聘数据源/发现推荐.ts` and `.test.ts` — candidate P4 delegation includes the already-approved exact resume file/version coordinates.
- `src/测试/BFF样本.ts` — valid P5 candidate/recruiter list/detail/history/action fixtures with no P5.1 fields.
- `src/状态/后端/类型.ts` — P5 memory snapshots, runtime refs and operation signatures.
- `src/状态/后端/会话操作.ts` and `.test.ts` — clear P5 state/locks/keys on account and role transitions.
- `src/状态/应用状态.tsx` and `.test.ts` — initialize/compose P5 state and operations; no persistence.
- `src/屏幕/在谈首页.tsx` — Backend delegates to candidate P5 list; Mock body remains intact.
- `src/屏幕/企业在谈候选.tsx` — Backend delegates to recruiter P5 list; Mock body remains intact.
- `src/屏幕/在谈详情.tsx` and `.test.tsx` — Backend delegates to candidate P5 detail.
- `src/屏幕/候选详情.tsx` and `.test.tsx` — Backend delegates to recruiter P5 detail.
- `src/屏幕/归档谈判.tsx` — Backend delegates to candidate P5 history.
- `src/屏幕/企业归档.tsx` — Backend delegates to recruiter P5 history.
- `src/屏幕/看市场.tsx`, `src/屏幕/职位详情.tsx` and tests — candidate P4 delegation selects/fixes an authorized PDF and routes only a real Case reference into P5.
- `e2e/数据源模式.spec.ts` — mutable P5 fixtures and dual-role Backend/Mock journeys.

---

### Task 0: Admit the Final P5 Public Contract

**Files:**
- Read: backend `apps/recruitment-bff/openapi/mobile-v1.yaml`
- Read: backend `apps/recruitment-bff/internal/recruitmentclient/matchcase_workspace.go`
- Read: backend `apps/recruitment-bff/internal/recruitmentclient/matchcase_lifecycle.go`
- Read: backend `apps/recruitment-bff/internal/httpapi/openapi_test.go`
- Read: backend `apps/recruitment/internal/matchcase/timeline.go`
- Read: backend `apps/recruitment/internal/store/case_lifecycle_commands.go`
- Modify: none

**Interfaces:**
- Consumes: the final committed P5 backend candidate selected by the backend owner.
- Produces: one exact admitted backend SHA and a PASS/STOP verdict used by every later task.

- [ ] **Step 1: Pin the committed backend candidate and verify no uncommitted contract file is being read**

```bash
git -C /Users/visionclaw/.paseo/worktrees/recruitment-p5-execution rev-parse HEAD
git -C /Users/visionclaw/.paseo/worktrees/recruitment-p5-execution status --short -- \
  apps/recruitment-bff/openapi/mobile-v1.yaml \
  apps/recruitment-bff/internal/recruitmentclient \
  apps/recruitment-bff/internal/httpapi \
  apps/recruitment/internal/matchcase \
  apps/recruitment/internal/store
```

Expected: one concrete SHA and no modified contract/source file. If any listed path is modified, STOP and ask the backend owner for a committed stable candidate.

- [ ] **Step 2: Verify the four blocker groups in public schema and tests**

```bash
cd /Users/visionclaw/.paseo/worktrees/recruitment-p5-execution
rg -n "needs_action|next_cursor|step:|handoff_pending|intention_id|candidate_alias|WorkspaceJob" \
  apps/recruitment-bff/openapi/mobile-v1.yaml \
  apps/recruitment-bff/internal/httpapi/openapi_test.go \
  apps/recruitment-bff/internal/recruitmentclient/matchcase_workspace.go \
  apps/recruitment-bff/internal/recruitmentclient/matchcase_lifecycle.go
```

PASS requires all of these facts, not merely matching words:

1. candidate and recruiter open-list item schemas require viewer-specific `needs_action`;
2. list contract tests prove sorting and opaque cursor are based on that viewer-specific value;
3. `MatchCaseView.step` has a public enum and strict decoder validation; tests cover every admitted legal lifecycle/stage/status/step combination and reject unknown/illegal combinations;
4. completed + handoff outbox tests assert public `step=handoff_pending`;
5. candidate and recruiter detail response schemas require their approved minimal role context and strict clients reject cross-role/missing context.

If any item fails, STOP with `BLOCKED_BY_P5_CONTRACT`; do not edit frontend product code.

- [ ] **Step 3: Verify `respond_fact` remains derivable without a new DTO**

```bash
cd /Users/visionclaw/.paseo/worktrees/recruitment-p5-execution
rg -n "supplementary_question|PromptID|ActionRespondFact|fact-responses" \
  apps/recruitment/internal/matchcase/timeline.go \
  apps/recruitment/internal/store/case_lifecycle_commands_test.go \
  apps/recruitment-bff/openapi/mobile-v1.yaml
```

Expected: current prompt projection has `kind=supplementary_question`, owner role, viewer-safe text and `ref=prompt_id`; fact-response request remains `{prompt_id,response}`. A new action payload schema is an admission failure, not something frontend silently adopts.

- [ ] **Step 4: Run focused backend contract tests**

```bash
cd /Users/visionclaw/.paseo/worktrees/recruitment-p5-execution/apps/recruitment-bff
go test ./internal/recruitmentclient ./internal/httpapi -run 'MatchCase|Workspace|OpenAPI' -count=1
```

Expected: PASS. Record the exact admitted SHA in the implementation handoff. Task 0 intentionally creates no commit.

---

### Task 1: Add the Strict No-Store P5 Wire Facade

**Files:**
- Modify: `src/数据/BFF契约.ts`
- Modify: `src/数据/HTTP客户端.ts`
- Modify: `src/数据/HTTP客户端.test.ts`
- Create: `src/数据/招聘数据源/MatchCase.ts`
- Create: `src/数据/招聘数据源/MatchCase.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`
- Modify: `src/测试/BFF样本.ts`

**Interfaces:**
- Consumes: Task 0 exact public schemas, `BFF请求选项`, `BFF响应`, `BFF二进制响应`.
- Produces: `MatchCase数据源`, strict admitted P5 DTOs, and no-store JSON/PDF requests.

```ts
export type P5角色 = 'candidate' | 'recruiter';
export type P5历史生命周期 = 'ended' | 'completed';

export interface MatchCase数据源 {
  读取P5Open列表(role: P5角色, filterRef: string | null, cursor: string | null): Promise<P5列表页>;
  读取P5历史(role: P5角色, lifecycle: P5历史生命周期, filterRef: string | null, cursor: string | null): Promise<P5列表页>;
  读取P5详情(role: P5角色, caseId: string): Promise<P5详情>;
  回答P5事实(role: P5角色, caseId: string, promptId: string, response: string, key: string): Promise<void>;
  提交P5简历(caseId: string, fileId: string, fileVersionId: string, key: string): Promise<void>;
  决定P5S1(caseId: string, action: 'continue' | 'not_fit', key: string): Promise<void>;
  决定P5S2(role: P5角色, caseId: string, issueId: string, action: 'accept' | 'reject', key: string): Promise<void>;
  决定P5S3(role: P5角色, caseId: string, action: 'confirm' | 'decline', key: string): Promise<void>;
  结束P5S0(caseId: string, key: string): Promise<void>;
  新增P5叮嘱(role: P5角色, caseId: string, text: string, key: string): Promise<void>;
  读取P5简历PDF(role: P5角色, caseId: string): Promise<BFF二进制响应>;
}
```

`P5列表页` and `P5详情` are normalized frontend contract values. Their decoder must copy Task 0's exact wire nesting, required/nullable members and final step enum; this Plan deliberately does not predeclare the four blocker fields' absent pre-admission wire nesting.

- [ ] **Step 1: Write failing HTTP no-store tests**

```ts
it('JSON 与 binary Case GET 都显式 no-store', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      result: { items: [], next_cursor: null }, meta: { request_id: 'p5-list' },
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }))
    .mockResolvedValueOnce(new Response(new Blob(['%PDF'], { type: 'application/pdf' }), {
      status: 200, headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store' },
    }));
  const client = 创建BFF客户端({ fetcher });

  await client.请求({ path: '/api/v1/me/match-cases', 不缓存: true });
  await client.请求二进制('/api/v1/me/match-cases/mc_1/resume-submission/content', { 不缓存: true });

  expect(fetcher.mock.calls.map(([, init]) => init?.cache)).toEqual(['no-store', 'no-store']);
});
```

Also assert a normal non-P5 GET without `不缓存` keeps current behavior, and mutation retries reuse the supplied key.

- [ ] **Step 2: Run the client test and verify RED**

```bash
npx vitest run src/数据/HTTP客户端.test.ts
```

Expected: FAIL because `不缓存` and binary options do not exist.

- [ ] **Step 3: Add the narrow no-store seam**

```ts
interface BFF请求共同选项 {
  path: `/api/v1/${string}`;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  ifMatch?: string;
  幂等?: boolean;
  幂等键?: string;
  不缓存?: true;
}

export interface BFF二进制请求选项 {
  不缓存?: true;
}
```

Set `init.cache = 'no-store'` only when requested. Preserve credentials, JSON/multipart handling, one GET network retry and existing error parsing.

- [ ] **Step 4: Write failing facade contract tests**

Freeze exact Task 0 shapes in fixtures, then assert candidate/recruiter list, both history shelves, detail, fact response, resume submission/content, S1/S2/S3 decisions and Case instruction requests. The representative S0 assertion is:

```ts
it('respond_fact uses the transcript ref as prompt_id and the same key', async () => {
  请求Mock.mockResolvedValueOnce(响应(P5命令状态样本));
  await source.回答P5事实('candidate', 'mc_case', 'prompt_ref', '四天远程', 'p5-fact-key-0001');
  expect(请求Mock).toHaveBeenCalledWith({
    path: '/api/v1/me/match-cases/mc_case/fact-responses',
    method: 'POST', body: { prompt_id: 'prompt_ref', response: '四天远程' },
    幂等: true, 幂等键: 'p5-fact-key-0001',
  });
});
```

For every GET assert `不缓存: true`. For PDF assert the role-specific Case path and `application/pdf`; reject any other content type. Table-test missing/extra keys, unknown enum, illegal state combination, cross-role context, null arrays, repeated/empty/invalid cursor, duplicate Case IDs across pages, terminal actions, and `needs_action !== (available_actions.length > 0)` on open detail.

- [ ] **Step 5: Run facade tests and verify RED**

```bash
npx vitest run src/数据/招聘数据源/MatchCase.test.ts src/数据/HTTP招聘数据源.test.ts
```

Expected: FAIL because the P5 DTOs/facade/composition do not exist.

- [ ] **Step 6: Implement exact decoding and request methods**

Use role-owned prefixes only:

```ts
const P5前缀 = { candidate: '/api/v1/me', recruiter: '/api/v1/recruiter' } as const;
const P5游标 = /^[A-Za-z0-9_-]+$/;

function P5路径(role: P5角色, suffix: string): `/api/v1/${string}` {
  return `${P5前缀[role]}${suffix}` as `/api/v1/${string}`;
}
```

Encode `case_id`, filter refs, issue IDs and cursors once. Require `limit=50`. Keep cursor opaque and reject repeat/empty/non-string/over-4096-byte values. Do not decode alias format beyond the exact final schema and never expose arbitrary URL/body methods.

- [ ] **Step 7: Run focused tests and commit**

```bash
npx vitest run src/数据/HTTP客户端.test.ts src/数据/招聘数据源/MatchCase.test.ts src/数据/HTTP招聘数据源.test.ts
git add src/数据/BFF契约.ts src/数据/HTTP客户端.ts src/数据/HTTP客户端.test.ts \
  src/数据/招聘数据源/MatchCase.ts src/数据/招聘数据源/MatchCase.test.ts \
  src/数据/HTTP招聘数据源.ts src/数据/HTTP招聘数据源.test.ts src/测试/BFF样本.ts
git commit -m "feat: add p5 matchcase data facade"
```

Expected: PASS, then one focused commit.

---

### Task 2: Build the Closed P5 Display Mapper

**Files:**
- Create: `src/数据/MatchCase展示映射.ts`
- Create: `src/数据/MatchCase展示映射.test.ts`

**Interfaces:**
- Consumes: Task 1 normalized `P5列表项`, `P5详情`, final closed step/action enums.
- Produces: `映射P5列表项`, `映射P5详情`, `取P5当前问题`, and UI-safe role context.

```ts
export interface P5问题 {
  promptId: string;
  text: string;
}

export type P5问题结果 =
  | { kind: 'none' }
  | { kind: 'one'; prompt: P5问题 }
  | { kind: 'contract_error' };

export function 取P5当前问题(detail: P5详情, role: P5角色): P5问题结果;
export function 映射P5列表项(item: P5列表项, role: P5角色): P5列表视图;
export function 映射P5详情(detail: P5详情, role: P5角色): P5详情视图;
```

- [ ] **Step 1: Write failing exhaustive mapper tests**

```ts
it('respond_fact accepts exactly one owner question in the current stage', () => {
  const detail = P5候选S0问题详情样本;
  expect(取P5当前问题(detail, 'candidate')).toEqual({
    kind: 'one', prompt: { promptId: 'prompt_ref', text: '请描述你的工作经验。' },
  });
  expect(取P5当前问题({ ...detail, stages: 加第二个当前问题(detail.stages) }, 'candidate'))
    .toEqual({ kind: 'contract_error' });
});

it('completed handoff is preparation-only', () => {
  const view = 映射P5详情(P5CompletedHandoff样本, 'candidate');
  expect(view.handoff).toEqual({ copy: '双方已确认，正在创建会话', canChat: false });
  expect(view.actions).toEqual([]);
});
```

Add tests for every admitted legal state tuple and action word, unknown lifecycle/stage/status/step, illegal tuple, candidate/recruiter minimal context, same Case differing `needs_action`, terminal zero actions, missing P5.1 sections, recruiter alias privacy, pre-disclosure attachment absence, parse pending/failed no PDF, disclosed attachment availability, and poisoned timeline text containing names/phones/scores never influencing header/action/state.

- [ ] **Step 2: Run mapper tests and verify RED**

```bash
npx vitest run src/数据/MatchCase展示映射.test.ts
```

Expected: FAIL because mapper functions do not exist.

- [ ] **Step 3: Implement exhaustive closed tables**

Create final-enum tables copied from Task 0:

```ts
const 阶段文案 = {
  anonymous_screening: '匿名初筛',
  resume_submission: '递交简历',
  needs_coordination: '需要协调',
  intent_confirmation: '意向确认',
} as const satisfies Record<P5Stage, string>;

const action文案 = {
  respond_fact: '回答问题',
  end_screening: '结束初筛',
  accept_resume_invitation: '选择并递交简历',
  decline_resume_invitation: '暂不递交',
  retry_resume_readiness: '重新检查简历',
  replace_resume: '更换简历',
  decide_resume_screening: '确认筛选结果',
  decide_coordination: '处理当前分歧',
  confirm_intent: '确认意向',
  decline_intent: '暂不继续',
} as const satisfies Record<P5Action, string>;
```

Add the admitted final step table and legal tuple table verbatim from Task 0. Use `assertNever` for compile-time exhaustiveness. Runtime invalid data returns `{ kind: 'contract_error' }`; it never chooses a nearest state.

Map only frozen WorkspaceJob fields and role context. Omit unavailable company, publisher, score, compensation, resume sections and identity. Recruiter header always uses `candidate_alias`; `case_id` is the view key.

- [ ] **Step 4: Run mapper tests and commit**

```bash
npx vitest run src/数据/MatchCase展示映射.test.ts
git add src/数据/MatchCase展示映射.ts src/数据/MatchCase展示映射.test.ts
git commit -m "feat: map closed p5 matchcase states"
```

Expected: PASS.

---

### Task 3: Add Memory-Only P5 Operations, Fences and Polling

**Files:**
- Modify: `src/状态/后端/类型.ts`
- Create: `src/状态/后端/MatchCase操作.ts`
- Create: `src/状态/后端/MatchCase操作.test.ts`
- Create: `src/状态/后端/useMatchCase轮询.ts`
- Create: `src/状态/后端/useMatchCase轮询.test.tsx`
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/后端/会话操作.test.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: Task 1 facade and the existing subject/role/session generation pattern.
- Produces: `P5状态`, `MatchCase操作`, `useP5列表轮询`, `useP5详情轮询`.

```ts
export interface P5分页快照 {
  阶段: '未开始' | '进行中' | '成功' | '失败';
  刷新中: boolean;
  items: P5列表项[];
  nextCursor: string | null;
  loadedPages: number;
  error: string | null;
  generation: number;
}

export interface P5详情快照 {
  阶段: '未开始' | '进行中' | '成功' | '失败';
  刷新中: boolean;
  detail: P5详情 | null;
  error: string | null;
  generation: number;
}

export interface P5状态 {
  open: Record<string, P5分页快照>;
  history: Record<string, P5分页快照>;
  details: Record<string, P5详情快照>;
}
```

Scope keys use escaped role/filter/case/lifecycle coordinates; alias is absent from all keys.

- [ ] **Step 1: Write failing operation and cleanup tests**

```ts
it('mutation succeeds only after authoritative detail reread', async () => {
  数据源.回答P5事实 = vi.fn(async () => undefined);
  数据源.读取P5详情 = vi.fn(async () => P5候选S0回答后样本);
  const env = 创建P5操作测试环境(数据源);

  await env.操作.回答事实('candidate', 'mc_case', 'prompt_ref', '四天远程');

  expect(数据源.回答P5事实).toHaveBeenCalledTimes(1);
  expect(数据源.读取P5详情).toHaveBeenCalledWith('candidate', 'mc_case');
  expect(env.最新状态().details['candidate:mc_case'].detail).toEqual(P5候选S0回答后样本);
});
```

Also test first-load failure, refresh failure retaining prior success, page append atomicity, refresh rebuilding the loaded window from cursor zero, duplicate cursor rejection, same Case dual-role isolation, stale subject/role/session/scope response dropping, same-action single flight, cross-Case parallelism, same-key outcome-unknown replay, 401 cleanup, logout/role-switch cleanup, and no P5 member in persisted state.

- [ ] **Step 2: Run operation tests and verify RED**

```bash
npx vitest run src/状态/后端/MatchCase操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
```

Expected: FAIL because P5 state/operations are absent.

- [ ] **Step 3: Implement atomic reads, stable mutation keys and cleanup**

```ts
export interface MatchCase操作 {
  加载Open(role: P5角色, filterRef: string | null, force?: boolean): Promise<void>;
  加载更多Open(role: P5角色, filterRef: string | null): Promise<void>;
  加载历史(role: P5角色, lifecycle: P5历史生命周期, filterRef: string | null, force?: boolean): Promise<void>;
  加载更多历史(role: P5角色, lifecycle: P5历史生命周期, filterRef: string | null): Promise<void>;
  读取详情(role: P5角色, caseId: string, force?: boolean): Promise<void>;
  回答事实(role: P5角色, caseId: string, promptId: string, response: string): Promise<void>;
  提交或重试简历(caseId: string, fileId: string, fileVersionId: string): Promise<void>;
  决定S1(caseId: string, action: 'continue' | 'not_fit'): Promise<void>;
  决定S2(role: P5角色, caseId: string, issueId: string, action: 'accept' | 'reject'): Promise<void>;
  决定S3(role: P5角色, caseId: string, action: 'confirm' | 'decline'): Promise<void>;
  结束S0(caseId: string): Promise<void>;
  新增叮嘱(role: P5角色, caseId: string, text: string): Promise<void>;
  读取简历PDF(role: P5角色, caseId: string): Promise<BFF二进制响应>;
}
```

Mutation keys are stored by escaped `role:case_id:action:target`. Release only after a definitive success/refusal. After success, immediately reread detail and force-refresh the currently visible open/history scopes; never project the mutation's bare state into detail.

Add `创建空P5状态()` to Provider initialization and `清P5运行时()` to logout, 401, subject and role switches. Do not touch `状态/领域/MatchCase.ts` or `资料持久化.ts`.

- [ ] **Step 4: Write failing polling tests**

```ts
it('detail polls every 3s only while visible and open', async () => {
  vi.useFakeTimers();
  const 读取详情 = vi.fn(async () => undefined);
  const { rerender, unmount } = renderHook(
    ({ terminal }) => useP5详情轮询({ enabled: true, terminal, 读取详情 }),
    { initialProps: { terminal: false } },
  );
  await vi.advanceTimersByTimeAsync(6000);
  expect(读取详情).toHaveBeenCalledTimes(2);
  rerender({ terminal: true });
  await vi.advanceTimersByTimeAsync(3000);
  expect(读取详情).toHaveBeenCalledTimes(2);
  unmount();
});
```

Add 5-second list tests, Page Visibility pause/resume, single-flight slow request, unmount cleanup and role/scope change reset.

- [ ] **Step 5: Implement polling hooks and run all focused tests**

```bash
npx vitest run src/状态/后端/MatchCase操作.test.ts src/状态/后端/useMatchCase轮询.test.tsx \
  src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the operation slice**

```bash
git add src/状态/后端/类型.ts src/状态/后端/MatchCase操作.ts \
  src/状态/后端/MatchCase操作.test.ts src/状态/后端/useMatchCase轮询.ts \
  src/状态/后端/useMatchCase轮询.test.tsx src/状态/后端/会话操作.ts \
  src/状态/后端/会话操作.test.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts
git commit -m "feat: add p5 matchcase state operations"
```

---

### Task 4: Wire Candidate and Recruiter Open Lists

**Files:**
- Create: `src/屏幕/P5/MatchCase列表.tsx`
- Create: `src/屏幕/P5/MatchCase列表.test.tsx`
- Modify: `src/屏幕/在谈首页.tsx`
- Modify: `src/屏幕/企业在谈候选.tsx`

**Interfaces:**
- Consumes: Tasks 2–3 list views/snapshots/operations and existing scope selectors.
- Produces: Backend candidate/recruiter P5 open pages; Mock branches unchanged.

- [ ] **Step 1: Write failing dual-role list tests**

```tsx
it('same Case renders viewer-specific needs_action without reading state.needs_user', async () => {
  render(<MatchCase列表 role="candidate" filterRef="int_case" />);
  expect(await screen.findByText('需要你')).toBeInTheDocument();
  cleanup();
  render(<MatchCase列表 role="recruiter" filterRef="job_case" />);
  expect(await screen.findByText('代理处理中')).toBeInTheDocument();
});
```

Add tests for candidate current/all filter, recruiter current/all filter, server order preservation, loaded-item filters, unknown contract failure, first load/retry/refresh, load-more cursor, no false total before cursor exhaustion, `case_id` React keys, alias display only, navigation by `case_id`, and Mock zero P5 calls.

- [ ] **Step 2: Run list tests and verify RED**

```bash
npx vitest run src/屏幕/P5/MatchCase列表.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the shared list and thin screen branches**

```tsx
export function MatchCase列表({ role, filterRef }: { role: P5角色; filterRef: string | null }) {
  // Select the exact role/filter snapshot, start visible 5s polling,
  // preserve backend order, and navigate with item.state.case_id.
}
```

Move each current screen body into a private `Mock在谈首页` / `Mock企业在谈候选` function without behavioral edits. The exported wrapper reads `数据源模式` and returns the P5 component only in Backend mode. Do not map P5 items into `状态.在谈列表` or `状态.企业候选列表`.

If a P5.1 field is absent, omit its old visual section. Candidate cards may show only frozen Job title/location/public salary/skills; recruiter cards may show only Case alias plus frozen Job context and closed state copy.

- [ ] **Step 4: Run list and existing screen tests**

```bash
npx vitest run src/屏幕/P5/MatchCase列表.test.tsx src/屏幕/在谈详情.test.tsx \
  src/组件/候选筛选抽屉.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the list slice**

```bash
git add src/屏幕/P5/MatchCase列表.tsx src/屏幕/P5/MatchCase列表.test.tsx \
  src/屏幕/在谈首页.tsx src/屏幕/企业在谈候选.tsx
git commit -m "feat: wire p5 matchcase workspaces"
```

---

### Task 5: Wire Direct-Refresh Detail, Timeline and Case Instructions

**Files:**
- Create: `src/屏幕/P5/MatchCase详情.tsx`
- Create: `src/屏幕/P5/MatchCase详情.test.tsx`
- Modify: `src/屏幕/在谈详情.tsx`
- Modify: `src/屏幕/在谈详情.test.tsx`
- Modify: `src/屏幕/候选详情.tsx`
- Modify: `src/屏幕/候选详情.test.tsx`

**Interfaces:**
- Consumes: admitted minimal detail context, Tasks 2–3 detail view/snapshot/operations, existing `阶段对话流` and `真输入条`.
- Produces: one dual-role four-stage detail that is complete from URL + role only.

- [ ] **Step 1: Write failing direct-refresh and privacy tests**

```tsx
it('direct URL refresh renders context without list memory', async () => {
  render(
    <MemoryRouter initialEntries={['/deal/mc_direct']}>
      <Routes><Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} /></Routes>
    </MemoryRouter>,
  );
  expect(操作.读取详情).toHaveBeenCalledWith('candidate', 'mc_direct', true);
  expect(await screen.findByText(P5候选详情样本.context.job.job.title)).toBeInTheDocument();
});
```

Add tests for recruiter direct refresh showing alias but no name/contact, fixed four-section order, checklist/transcript/instruction receipts, timeline text display-only, unknown/illegal state disabling controls, terminal stopping polling, no P5.1 section, and `case_id` as the sole detail coordinate.

- [ ] **Step 2: Write failing Case-instruction tests**

```tsx
it('case instruction sends server text then rereads; no optimistic bubble', async () => {
  const pending = deferred<void>();
  操作.新增叮嘱.mockReturnValueOnce(pending.promise);
  render(<MatchCase详情 role="candidate" />);
  await user.type(screen.getByPlaceholderText('有想法就告诉你的AI代理'), '只在工作日联系');
  await user.click(screen.getByRole('button', { name: '发送' }));
  expect(screen.queryByText('只在工作日联系')).not.toBeInTheDocument();
  pending.resolve();
  await waitFor(() => expect(操作.新增叮嘱).toHaveBeenCalledWith('candidate', 'mc_case', '只在工作日联系'));
});
```

Also assert terminal/contract-error details hide the input, and no rule reducer action fires.

- [ ] **Step 3: Run detail tests and verify RED**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx src/屏幕/在谈详情.test.tsx src/屏幕/候选详情.test.tsx
```

Expected: FAIL because the shared P5 detail is absent.

- [ ] **Step 4: Implement the read-only shell and Backend wrappers**

```tsx
export function MatchCase详情({ role }: { role: P5角色 }) {
  const { id: caseId = '' } = useParams<{ id: string }>();
  // Force GET on mount, select role+case snapshot, poll open detail every 3s,
  // map four sections, and render only admitted context/actions.
}
```

Use `阶段对话流` only as a renderer. Its data comes from typed stage sections; never call `各单阶段对话`, `候选阶段小结`, `取在谈岗位详情`, `求职侧对齐行`, `公司档案` or Mock fallback in Backend mode.

The bottom input calls `新增叮嘱`; clear the draft only after success, then rely on authoritative reread/receipts. It does not add local bubbles and does not create Agent rules.

Move current detail bodies into private Mock components and add thin exported Backend/Mock wrappers without changing Mock behavior.

- [ ] **Step 5: Run focused tests and commit**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx src/屏幕/在谈详情.test.tsx \
  src/屏幕/候选详情.test.tsx src/组件/候选筛选抽屉.test.tsx
git add src/屏幕/P5/MatchCase详情.tsx src/屏幕/P5/MatchCase详情.test.tsx \
  src/屏幕/在谈详情.tsx src/屏幕/在谈详情.test.tsx \
  src/屏幕/候选详情.tsx src/屏幕/候选详情.test.tsx
git commit -m "feat: wire p5 matchcase detail"
```

Expected: PASS.

---

### Task 6: Wire S0/S1 Actions and Authorized Raw PDF

**Files:**
- Modify: `src/屏幕/P5/MatchCase详情.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.test.tsx`
- Modify: `src/数据/招聘数据源/发现推荐.ts`
- Modify: `src/数据/招聘数据源/发现推荐.test.ts`
- Modify: `src/屏幕/看市场.tsx`
- Modify: `src/屏幕/看市场.test.tsx`
- Modify: `src/屏幕/职位详情.tsx`
- Modify: `src/屏幕/职位详情.test.tsx`

**Interfaces:**
- Consumes: `available_actions`, `取P5当前问题`, P2 `附件简历库`, Task 3 mutation/PDF operations.
- Produces: S0 fact/exit and S1 invitation/readiness/reselection/screening actions with disclosure fencing.

- [ ] **Step 1: Write failing S0 action tests**

```tsx
it('S0 answer submits the supplementary question ref and replays the same intent', async () => {
  render(<MatchCase详情 role="candidate" />);
  expect(screen.getByText('请描述你的工作经验。')).toBeInTheDocument();
  await user.type(screen.getByRole('textbox', { name: '回答问题' }), '负责交易网关');
  await user.click(screen.getByRole('button', { name: '提交回答' }));
  expect(操作.回答事实).toHaveBeenCalledWith('candidate', 'mc_case', 'prompt_ref', '负责交易网关');
});
```

Add zero/multiple question contract-error tests; `end_screening` only invokes an exact admitted role/action route; unknown role/action pair fails closed and sends no request.

- [ ] **Step 2: Write failing resume selection/disclosure tests**

Cover these exact cases:

1. zero attachment files redirects candidate to `路径.我的简历` and sends no mutation;
2. one file is shown in the existing confirmation layer and selected explicitly;
3. multiple files require one radio selection;
4. candidate P4 delegation sends exact `resume_file_id` and `resume_file_version_id` plus acknowledged disclosure;
5. invitation accept/retry/replace uses the selected exact pair and `disclosure_confirmed: true` through Task 1 facade;
6. pre-disclosure and parse pending/failed show no PDF control;
7. recruiter only sees PDF when detail carries the authorized attachment;
8. PDF request is Case-scoped, creates one object URL, and revokes it on close/unmount;
9. PDF content is never parsed for identity.

- [ ] **Step 3: Run S0/S1 tests and verify RED**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx src/数据/招聘数据源/发现推荐.test.ts \
  src/屏幕/看市场.test.tsx src/屏幕/职位详情.test.tsx
```

Expected: FAIL at the new action/selection assertions.

- [ ] **Step 4: Implement S0/S1 action cards and P4 exact resume coordinates**

```ts
export interface 候选P4委托输入 {
  intentionId: string;
  recommendationId: string;
  jobId: string;
  resumeFileId: string;
  resumeFileVersionId: string;
  disclosureAcknowledged: true;
}
```

Update the P4 body exactly as the admitted backend schema requires. Selection UI reads the already-wired P2 attachment library; it never asks a Resume API for parsed profile content and never picks “latest” without the visible user choice.

Render S0/S1 controls only when their exact action word is present. `respond_fact` uses `取P5当前问题`; S1 recruiter decisions use only `continue|not_fit`. After every mutation, Task 3 performs authoritative reread.

For PDF, call `读取简历PDF(role, caseId)`, verify `application/pdf`, create an object URL for the existing preview layer, and revoke it in cleanup. Do not provide a download link before authorization.

- [ ] **Step 5: Run focused tests and commit**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx src/数据/招聘数据源/发现推荐.test.ts \
  src/屏幕/看市场.test.tsx src/屏幕/职位详情.test.tsx src/数据/招聘数据源/附件简历.test.ts
git add src/屏幕/P5/MatchCase详情.tsx src/屏幕/P5/MatchCase详情.test.tsx \
  src/数据/招聘数据源/发现推荐.ts src/数据/招聘数据源/发现推荐.test.ts \
  src/屏幕/看市场.tsx src/屏幕/看市场.test.tsx \
  src/屏幕/职位详情.tsx src/屏幕/职位详情.test.tsx
git commit -m "feat: wire p5 screening and resume disclosure"
```

Expected: PASS.

---

### Task 7: Wire S2/S3, Terminal History and Handoff Pending

**Files:**
- Modify: `src/屏幕/P5/MatchCase详情.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.test.tsx`
- Create: `src/屏幕/P5/MatchCase历史.tsx`
- Create: `src/屏幕/P5/MatchCase历史.test.tsx`
- Modify: `src/屏幕/归档谈判.tsx`
- Modify: `src/屏幕/企业归档.tsx`

**Interfaces:**
- Consumes: typed current coordination, intent confirmations, terminal summary, Task 3 S2/S3/history operations.
- Produces: dual-role S2/S3 decision cards, read-only ended/completed shelves and disabled handoff UI.

- [ ] **Step 1: Write failing S2/S3 tests**

```tsx
it('completed handoff never navigates to chat', async () => {
  置P5详情(P5CompletedHandoff样本);
  render(<MatchCase详情 role="recruiter" />);
  expect(await screen.findByText('双方已确认，正在创建会话')).toBeInTheDocument();
  const button = screen.getByRole('button', { name: '开始私聊' });
  expect(button).toBeDisabled();
  await user.click(button);
  expect(mock跳转).not.toHaveBeenCalled();
});
```

Add S2 tests for exact `issue_id`, accept/reject, required undecided role only and missing issue fail closed. Add S3 independent confirm/decline tests, already-confirmed viewer waiting state, second confirmation completed handoff, no conversation ref/copy, terminal zero actions and no mutation input.

- [ ] **Step 2: Write failing two-shelf history tests**

```tsx
it('history reads completed and ended separately and opens the same detail by case_id', async () => {
  render(<MatchCase历史 role="candidate" filterRef={null} />);
  expect(操作.加载历史).toHaveBeenCalledWith('candidate', 'completed', null, true);
  expect(操作.加载历史).toHaveBeenCalledWith('candidate', 'ended', null, true);
  await user.click(await screen.findByRole('button', { name: /已完成/ }));
  expect(mock跳转).toHaveBeenCalledWith('/deal/mc_completed');
});
```

Assert history never merges shelf cursors, never creates Mock archive rows, and terminal detail remains directly readable.

- [ ] **Step 3: Run tests and verify RED**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx src/屏幕/P5/MatchCase历史.test.tsx
```

Expected: FAIL at S2/S3/history/handoff behavior.

- [ ] **Step 4: Implement S2/S3 and history**

S2 action cards take only typed `currentCoordination.issueId` and closed `accept|reject`. S3 cards take only `confirm|decline`. Never infer availability from timeline, section state or the other role's decision; `available_actions` is authoritative.

For `completed + handoff_pending`, render exact copy `双方已确认，正在创建会话`, keep the chat button disabled, and omit all mutation inputs. Do not add any P7 field or route.

`MatchCase历史` renders separate completed/ended groups and uses the role's minimal context. Candidate cards navigate to `路径.在谈详情(caseId)`; recruiter cards navigate to `路径.候选详情(caseId)`. Exported archive screens choose P5 only in Backend mode and retain current Mock implementations intact.

- [ ] **Step 5: Run focused tests and commit**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx src/屏幕/P5/MatchCase历史.test.tsx \
  src/屏幕/在谈详情.test.tsx src/屏幕/候选详情.test.tsx
git add src/屏幕/P5/MatchCase详情.tsx src/屏幕/P5/MatchCase详情.test.tsx \
  src/屏幕/P5/MatchCase历史.tsx src/屏幕/P5/MatchCase历史.test.tsx \
  src/屏幕/归档谈判.tsx src/屏幕/企业归档.tsx
git commit -m "feat: complete p5 matchcase lifecycle ui"
```

Expected: PASS.

---

### Task 8: Add Backend/Mock E2E Gates and Final Verification

**Files:**
- Modify: `e2e/数据源模式.spec.ts`
- Modify: `docs/DEV_LOG.md`

**Interfaces:**
- Consumes: Tasks 1–7 complete implementation and stable mutable BFF fixtures.
- Produces: browser-level P5 acceptance evidence and a clean implementation handoff.

- [ ] **Step 1: Add mutable P5 BFF fixture routes**

The fixture must serve both roles for one shared `case_id`, with different list/detail `needs_action`, four legal stage transitions, current supplementary prompt, authorized/unauthorized PDF responses, two history shelves and completed handoff pending. Every Case response includes no-store headers.

```ts
const P5Headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

await page.route('**/api/v1/**/match-cases**', async (route) => {
  // Match exact method/path/query and answer from the mutable per-test P5 state.
});
```

Use explicit path matching so `/history`, detail, decisions, instructions and PDF content cannot accidentally share one broad answer.

- [ ] **Step 2: Add the required Backend journeys**

Create separate Playwright tests for:

1. same Case is “需要你” for candidate and “代理处理中” for recruiter;
2. direct candidate and recruiter detail refresh with empty list memory;
3. S0 prompt submit, same-key replay and prompt removal after reread;
4. pre-disclosure and parse pending/failed show no name/contact/PDF;
5. disclosed recruiter opens only the Case-scoped raw PDF;
6. S2/S3 decisions reread authority and terminal actions disappear;
7. completed + handoff pending shows preparation copy and never requests a chat route;
8. ended/completed history shelves open read-only four-stage detail;
9. every captured Case request has `cache: no-store` at unit level and every fixture response has the required no-store header;
10. logout/role switch clears visible P5 state.

- [ ] **Step 3: Add the Mock isolation journey**

```ts
test('Mock in-talk and archive keep the demo flow and send zero P5 requests', async ({ page }) => {
  const p5Requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/match-cases')) p5Requests.push(request.url());
  });
  await page.goto('/#/app');
  await page.getByText('在谈').click();
  await page.getByText('历史代谈').first().click();
  expect(p5Requests).toEqual([]);
});
```

- [ ] **Step 4: Run focused and full verification**

```bash
npm test -- --run \
  src/数据/HTTP客户端.test.ts \
  src/数据/招聘数据源/MatchCase.test.ts \
  src/数据/MatchCase展示映射.test.ts \
  src/状态/后端/MatchCase操作.test.ts \
  src/状态/后端/useMatchCase轮询.test.tsx \
  src/屏幕/P5/MatchCase列表.test.tsx \
  src/屏幕/P5/MatchCase详情.test.tsx \
  src/屏幕/P5/MatchCase历史.test.tsx
npm run typecheck
npm run lint
npm run build
npm run test:e2e:data-source -- --grep 'P5|MatchCase|Mock in-talk'
```

Expected: all commands PASS. Do not mark P5.1 fields or P7 handoff as tested.

- [ ] **Step 5: Run the P5.1 absence/privacy scan**

```bash
rg -n "next_step|handoff.*published|conversation[_-]?id|candidate_identity|match_score|match_reasons|highlights|compensation_relationship" \
  src/数据/招聘数据源/MatchCase.ts src/数据/MatchCase展示映射.ts \
  src/状态/后端/MatchCase操作.ts src/屏幕/P5
rg -n "模拟数据|企业端模拟数据|取在谈岗位详情|公司档案|求职侧对齐行" \
  src/数据/招聘数据源/MatchCase.ts src/数据/MatchCase展示映射.ts \
  src/状态/后端/MatchCase操作.ts src/屏幕/P5
```

Expected: both commands return no matches, except test names explicitly asserting forbidden fields are absent. Inspect any match before proceeding; do not suppress it mechanically.

- [ ] **Step 6: Record evidence and commit**

Append to `docs/DEV_LOG.md`: admitted backend SHA, Task 0 PASS evidence, focused/full command results, Backend/Mock E2E results, and this exact dependency line:

```text
P5.1 deferred: rich job/company/publisher, score/reasons/highlights, compensation relationship,
anonymous parsed resume, stable P4 alias, structured identity, and P7 conversation contract are not P5 gates.
```

Then commit:

```bash
git add e2e/数据源模式.spec.ts docs/DEV_LOG.md
git commit -m "test: gate p5 frontend wiring"
git status --short
```

Expected: clean worktree after the commit.

---

## Plan Self-Review

- [ ] Task 0 blocks all coding until the four explicitly approved backend gaps are closed in the public contract.
- [ ] No task treats `respond_fact` as missing or asks for an action payload DTO.
- [ ] No type, mapper, test or copy introduces `next_step`.
- [ ] Handoff UI is only `completed + handoff_pending`; no published/P7 requirement exists.
- [ ] P5.1 fields appear only in exclusion/dependency checks, not production DTOs or completion gates.
- [ ] Identity and raw PDF are separate; frontend never parses PDF.
- [ ] Alias is display-only and `case_id` owns every identity/key boundary.
- [ ] Direct refresh consumes detail context and never list memory.
- [ ] All required acceptance cases have unit/component/E2E ownership.
- [ ] Mock isolation and no-store behavior are both explicitly gated.
