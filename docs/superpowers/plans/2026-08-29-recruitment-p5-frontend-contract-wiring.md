# Recruitment P5 Frontend Contract Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** `READY_FOR_EXECUTION`. Recalibrated on 2026-08-29 against clean backend `impl/recruitment-p5-contract-completion@34306f53984ff1624f857d05b9925f36da721b40`; Task 0 is complete and Tasks 1–8 are authorized only while that exact contract evidence remains unchanged.

**Goal:** Wire candidate and recruiter P5 MatchCase workspace/history, four-stage direct-refresh detail, viewer-specific actions, S0–S3 commands, authorized raw PDF, terminal archive and handoff-pending UI against the admitted final backend contract without manufacturing P5.1 data.

**Architecture:** Extend the Plan 1 foundation with one strict role-aware MatchCase facade, memory-only role/scope snapshots and an exhaustive closed-code UI mapper. Backend-mode screens render shared P5 list/detail/history components; Mock mode retains the existing reducer story and sends no P5 request. The facade is the only owner of public wire shapes, and the UI consumes normalized internal views rather than OpenAPI objects.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Testing Library, Playwright 1.62, existing same-origin BFF HTTP client.

**Spec:** `docs/superpowers/specs/2026-08-29-recruitment-p5-frontend-wiring-design.md`

**Required predecessor:** `docs/superpowers/plans/2026-08-29-recruitment-p5-frontend-foundation.md`, completed and integrated with a clean verification handoff.

## Global Constraints

- Task 0 is a hard gate and is completed by the committed recalibration below. If the recorded backend SHA, public schemas, matrix fixture or focused receipts no longer match, restore `BLOCKED_PENDING_FINAL_BACKEND_RECALIBRATION` and STOP before product files.
- Admission uses the one clean exact backend commit pinned in Recalibration Admission. Page mocks, ad-hoc fixtures, Go constants without public schema, proposed Spec examples and TypeScript drafts are not contract evidence.
- The admitted P5 completion patch contains exactly: viewer-specific open-list `needs_action` with matching sort/cursor semantics; a closed `state.step` plus legal state combinations; `completed + handoff_pending`; and role-specific minimal detail context.
- Candidate detail context is exactly `intention_id + MatchCaseWorkspaceJob`; recruiter detail context is exactly `MatchCaseWorkspaceJob + candidate_alias`, using the final public field names and nesting in Recalibration Admission.
- `respond_fact` is already implemented. Resolve the current prompt through the Plan 1 helper from current-stage `supplementary_question.ref`; do not add an action payload DTO.
- Do not add `next_step`. UI authority is `state.lifecycle/stage/status/step`, viewer `needs_action`, `available_actions` and typed detail blocks.
- Unknown lifecycle/stage/status/step/action or any illegal combination fails closed with no mutation controls.
- P5 handoff supports only `completed + handoff_pending`. Never generate, cache, infer or navigate with a conversation identifier. Do not add `published`; it belongs to P7.
- Full CandidateJob, organization/publisher profile, score/reasons/highlights, compensation relationship, parsed online resume, experience/certificate/portfolio sections, stable P4 alias, presentation snapshot and structured identity remain P5.1 dependencies and are absent from production DTOs.
- Missing P5.1 sections are not rendered. Backend mode never imports/falls back to Mock, parses timeline prose, parses PDF bytes, or aggregates P4/Job/Organization/Resume endpoints.
- Treat P5 alias as opaque display text. Show it verbatim; never parse, truncate, derive an avatar, or use it as key/ID/request/cache coordinate. Use `case_id`.
- P5 snapshots, locks and idempotency intents are memory-only. Never add them to `资料持久化`, browser storage, Cache API or a service worker.
- Every P5 JSON/PDF request opts into Plan 1 `不缓存: true`. PDF display uses Plan 1 `创建PDF对象租约` and revokes on close/unmount.
- Every S1 submit/replace intent requires a fresh Case-specific disclosure confirmation and sends the exact selected file/version pair with `disclosure_confirmed: true`. Never default the flag or reuse the P4 delegation confirmation.
- Direct detail refresh uses URL `case_id` plus authenticated role only; it never reads list memory to fill context.
- Mock mode sends zero P5 requests and preserves the current immediate reducer/demo behavior.
- Use TDD for every code task and commit each independently green slice.

## Recalibration Output Required Before Execution

The committed recalibration must record, in this document and `docs/DEV_LOG.md`:

1. exact clean backend SHA and worktree/branch;
2. exact BFF OpenAPI schema names for candidate/recruiter open item, history item, detail and detail envelope;
3. exact required/nullable field sets and final public `MatchCaseStep` enum;
4. the tested legal `lifecycle + stage + status + step` matrix;
5. proof that list `needs_action`, ordering and cursor use the same viewer-specific value;
6. proof that completed/outbox reads and completion event expose `handoff_pending`;
7. proof that both role detail responses include only their approved minimal context;
8. focused backend test commands and passing results.

If any one is unavailable, the recalibration verdict stays blocked and Tasks 1–8 are not authorized.

## Recalibration Admission — 2026-08-29

**Verdict:** `PASS — READY_FOR_EXECUTION`.

### Exact backend candidate

- Worktree: `/Users/visionclaw/.paseo/worktrees/recruitment-p5-contract-completion`
- Branch: `impl/recruitment-p5-contract-completion`
- Admitted SHA: `34306f53984ff1624f857d05b9925f36da721b40`
- Published target observed during calibration: `origin/release/0.2.5` at the same SHA
- Clean check: `git status --short` was empty for the whole backend worktree before and after the focused runs.

Executors must recheck the pinned candidate without fetching or substituting a moving branch:

```bash
test "$(git -C /Users/visionclaw/.paseo/worktrees/recruitment-p5-contract-completion rev-parse HEAD)" = \
  34306f53984ff1624f857d05b9925f36da721b40
test "$(git -C /Users/visionclaw/.paseo/worktrees/recruitment-p5-contract-completion branch --show-current)" = \
  impl/recruitment-p5-contract-completion
test -z "$(git -C /Users/visionclaw/.paseo/worktrees/recruitment-p5-contract-completion status --short)"
```

### Exact public schema names and nesting

The BFF public document is the admitted `apps/recruitment-bff/openapi/mobile-v1.yaml` at the pinned SHA.

| Surface | Candidate schema chain | Recruiter schema chain |
|---|---|---|
| Open list | `CandidateWorkspacePageEnvelope.result` → `CandidateMatchCaseWorkspacePage.items[]` → `CandidateMatchCaseWorkspaceItem` | `RecruiterWorkspacePageEnvelope.result` → `RecruiterMatchCaseWorkspacePage.items[]` → `RecruiterMatchCaseWorkspaceItem` |
| `ended` / `completed` history | Deliberately reuses the candidate open-list schema chain; there is no separate history-item schema | Deliberately reuses the recruiter open-list schema chain; there is no separate history-item schema |
| Detail | `CandidateMatchCaseDetailEnvelope.result` → `CandidateMatchCaseDetail` | `RecruiterMatchCaseDetailEnvelope.result` → `RecruiterMatchCaseDetail` |

Open and history pages require non-null `items` plus present `next_cursor`; `next_cursor` is exactly `string | null`. List/history rows must omit `resume_submission` even though the shared item component retains that optional property for the existing workspace-detail projection; the route descriptions and BFF strict decoders reject it on a page row.

Exact top-level required and absence/null rules:

| Schema | Required properties | Nullable / optional properties |
|---|---|---|
| `CandidateMatchCaseWorkspaceItem` | `state`, `needs_action`, `intention_id`, `job` | `resume_submission` is optional but forbidden on list/history rows; no required property is nullable |
| `RecruiterMatchCaseWorkspaceItem` | `state`, `needs_action`, `job`, `candidate_alias` | `resume_submission` is optional but forbidden on list/history rows; no required property is nullable |
| `CandidateMatchCaseDetail` | `state`, `needs_action`, `available_actions`, `stages`, `intent_confirmations`, `intention_id`, `job` | `current_coordination` and `terminal_summary` are optional/absent, not `null`; opposite-role `candidate_alias` is forbidden |
| `RecruiterMatchCaseDetail` | `state`, `needs_action`, `available_actions`, `stages`, `intent_confirmations`, `job`, `candidate_alias` | `current_coordination` and `terminal_summary` are optional/absent, not `null`; opposite-role `intention_id` is forbidden |
| Both detail envelopes | `result`, `meta` | neither property is nullable; `additionalProperties: false` |
| `MatchCaseView` | `case_id`, `lifecycle`, `stage`, `status`, `step`, `round`, `round_budget`, `needs_user`, `outcome`, `outcome_code`, `created_at`, `updated_at` | required `outcome` and `outcome_code` are `string | null`; optional `finalized_at` is `string | null` |
| `MatchCaseWorkspaceJob` | `job_id`, `job` | none |
| `WorkspacePublicJob` | `title`, `location`, `public_salary_range`, `required_skills` | none |

Both detail DTOs also require non-null arrays for `available_actions` and `stages`; `intent_confirmations` is always present. Terminal detail returns empty actions, not an absent or nullable action list.

### Closed step vocabulary and legal matrix

The final public `MatchCaseStep` enum contains exactly these 17 words:

```text
policy_check
candidate_evaluation
candidate_question
recruiter_answer
candidate_reevaluation
human_decision
complete
awaiting_candidate_resume_invitation
awaiting_resume_parse
screening_resume
awaiting_recruiter_decision
coordinating
awaiting_candidate_decision
awaiting_confirmations
awaiting_candidate_confirmation
awaiting_recruiter_confirmation
handoff_pending
```

The single fixture `apps/recruitment/testdata/matchcase-state-matrix.json` pins the exact 17 legal `lifecycle + stage + status → steps` rows used by the Recruitment validator, Recruitment OpenAPI tests, BFF validator and BFF OpenAPI tests:

| lifecycle | stage | status | legal steps |
|---|---|---|---|
| `open` | `anonymous_screening` | `running` | `policy_check`, `candidate_evaluation`, `candidate_question`, `recruiter_answer`, `candidate_reevaluation` |
| `open` | `anonymous_screening` | `waiting` | `candidate_reevaluation` |
| `open` | `anonymous_screening` | `needs_user` | `human_decision` |
| `open` | `anonymous_screening` | `passed` | `complete`, `awaiting_candidate_resume_invitation`, `awaiting_resume_parse` |
| `open` | `anonymous_screening` | `attention_required` | `candidate_evaluation`, `candidate_question`, `recruiter_answer`, `candidate_reevaluation` |
| `open` | `resume_submission` | `waiting` | `awaiting_resume_parse`, `screening_resume` |
| `open` | `resume_submission` | `needs_user` | `awaiting_resume_parse`, `awaiting_recruiter_decision` |
| `open` | `resume_submission` | `attention_required` | `screening_resume` |
| `open` | `needs_coordination` | `waiting` | `coordinating`, `awaiting_candidate_decision`, `awaiting_recruiter_decision` |
| `open` | `needs_coordination` | `needs_user` | `coordinating` |
| `open` | `needs_coordination` | `attention_required` | `coordinating` |
| `open` | `intent_confirmation` | `needs_user` | `awaiting_confirmations`, `awaiting_candidate_confirmation`, `awaiting_recruiter_confirmation` |
| `ended` | `anonymous_screening` | `ended` | `complete` |
| `ended` | `resume_submission` | `ended` | `complete` |
| `ended` | `needs_coordination` | `ended` | `complete` |
| `ended` | `intent_confirmation` | `ended` | `complete` |
| `completed` | `intent_confirmation` | `passed` | `handoff_pending` |

Unknown enum words, known steps in the wrong tuple, terminal `needs_action=true`, `completed + complete` and `open + handoff_pending` all fail closed in the strict BFF client.

### Semantic proof for the four former blockers

1. **Viewer-specific list action and cursor:** `apps/recruitment/internal/store/case_workspace_store.go` uses one `needs_action(viewer)` SQL expression in SELECT, keyset predicate and `ORDER BY needs_action DESC, updated_at DESC, case_id DESC`. `TestWorkspaceOpenKeysetOrdersViewerActionNotGlobalStatus`, `TestWorkspaceNeedsActionFollowsTheViewerTruthTable` and `TestWorkspaceOpenKeysetBreaksUpdatedAtTiesOnCaseID` cover disagreement and stable pagination. History uses only `updated_at + case_id`; `TestWorkspaceHistoryCursorCarriesOnlyUpdateAndCase` pins that exclusion.
2. **Closed state:** the shared fixture above is exercised by `TestValidateCaseViewFailsClosed`, `TestMatchCaseStateMatrixIsExactlyTheFixture`, `TestMatchCaseStepEnumIsTheClosedFixtureVocabulary`, `TestWorkspaceListRejectsIllegalStepStates` and `TestMatchCaseDetailRejectsIllegalStepStates`.
3. **Truthful completion:** `TestCompletionProjectsHandoffPendingInEveryRead` proves command/read/timeline parity, `TestCompletionRollsBackWithoutItsHandoff` proves the completed row cannot escape without the durable outbox, and `TestCaseCompletedDetailIsHandoffPendingWithoutAction` proves terminal detail. The stored `case_completed` event metadata and every completed projection use `handoff_pending`; `ended` remains `complete`.
4. **Minimal role context:** direct reads return candidate `intention_id + job` or recruiter `job + candidate_alias` from the same party-fenced repeatable-read snapshot. `TestCaseDetailCarriesRoleContextWithoutAListRead`, `TestLoadCaseDetailFailsClosedOnMissingFrozenContext`, `TestMatchCaseDetailRejectsCrossRoleFields`, Recruitment `TestMatchCaseRoleDetailSchemasArePublishedAndWired` and BFF `TestMatchCaseRoleDetailSchemasArePublished` cover direct refresh, missing context, cross-role fields and `additionalProperties: false`.

All six public list/history/detail routes retain `Cache-Control: no-store` on documented success/error responses. This is pinned by the OpenAPI response headers plus `TestNoStoreOnMatchCaseLifecycleResponses`, the BFF route policy and BFF handler/OpenAPI tests. The existing PDF route remains `private, no-store`.

### Focused verification at the admitted SHA

These commands were rerun from the clean admitted worktree during this frontend recalibration:

```bash
tools/test service recruitment-bff \
  --suite recruitment-bff-unit \
  --suite recruitment-bff-build \
  --suite recruitment-bff-source \
  --keep-going

tools/test service recruitment \
  --suite recruitment-unit \
  --suite recruitment-build \
  --keep-going

GOWORK=off go test ./internal/store \
  -run '^(TestWorkspaceOpenKeysetOrdersViewerActionNotGlobalStatus|TestWorkspaceNeedsActionFollowsTheViewerTruthTable|TestWorkspaceOpenKeysetBreaksUpdatedAtTiesOnCaseID|TestLifecycleWorkspaceDetailNeedsActionDiffersPerViewer|TestLoadCaseDetailParityAndFences|TestLoadCaseDetailFailsClosedOnMissingFrozenContext|TestCompletionProjectsHandoffPendingInEveryRead|TestCompletionRollsBackWithoutItsHandoff)$' \
  -count=1 -v
```

The focused store command ran inside the same throwaway `postgres:16-alpine` setup and `RECRUITMENT_TEST_PG_DSN` contract used by `apps/recruitment/scripts/test-postgres.sh`.

Results at `34306f53984ff1624f857d05b9925f36da721b40`:

- BFF build/source/unit: PASS, receipt `.test-results/run-20260829T092114-7b7afff2/summary.json`.
- Recruitment build/unit: PASS, receipt `.test-results/run-20260829T092126-283ff96b/summary.json`.
- P5-focused PostgreSQL store tests: 8 top-level tests and all subtests PASS, package result `ok recruitment.agxp.ai/internal/store 14.164s`.

The broad `tools/test service recruitment --suite recruitment-postgres --keep-going` was also attempted at the exact SHA and reached the suite's fixed 600-second timeout (`FAIL reason=timeout`, 610.4s; receipt `.test-results/run-20260829T092213-3deee8ab/summary.json`) without an assertion failure. This is recorded, not relabeled as PASS. It does not block this contract-focused frontend admission because: the exact P5 PostgreSQL tests above passed against a fresh database; the backend owner's authoritative affected run had the same production/store code PASS in 396.3s (`run-20260829T083945-22fa739e`); and the only later commit leading to the admitted SHA changes `apps/recruitment-bff/scripts/local-e2e.sh`, not production, store or PostgreSQL tests. Treat the broad-suite timeout as a non-contract performance flake; it must not be cited as a full-suite PASS.

Stable P5 behavior was not redesigned: `supplementary_question.ref` remains the `prompt_id` coordinate; the public routes still use `fact-responses`, Case-scoped `resume-submission/content` and `agent-instructions`; there is no action payload DTO, `next_step`, P7 publication state or `conversation_ref`.

---

### Task 0: Recalibrate and Admit the Final P5 Contract

**Files:**
- Read: final backend `apps/recruitment-bff/openapi/mobile-v1.yaml`
- Read: final backend `apps/recruitment-bff/internal/recruitmentclient/matchcase_workspace.go`
- Read: final backend `apps/recruitment-bff/internal/recruitmentclient/matchcase_lifecycle.go`
- Read: final backend `apps/recruitment-bff/internal/httpapi/openapi_test.go`
- Read: final backend `apps/recruitment/internal/matchcase`
- Read: final backend `apps/recruitment/internal/store`
- Modify during the dedicated recalibration session: this plan, `docs/superpowers/plans/2026-08-29-recruitment-p5-frontend-wiring.md`, `docs/superpowers/specs/2026-08-29-recruitment-p5-frontend-wiring-design.md` and `docs/DEV_LOG.md`
- Modify during implementation execution: none

**Interfaces:**
- Consumes: backend owner's declared final clean P5 contract-completion candidate.
- Produces: one committed `READY_FOR_EXECUTION` plan with exact contract evidence, or a STOP verdict.

- [x] **Step 1: Enforce the document status gate**

```bash
rg -n '^\*\*Status:\*\* `READY_FOR_EXECUTION`' \
  docs/superpowers/plans/2026-08-29-recruitment-p5-frontend-contract-wiring.md
```

Expected during execution: exactly one match. The dedicated recalibration session established that match; an implementation session must not self-approve a different SHA.

- [x] **Step 2: Verify the recorded backend candidate is exact and clean**

Run the exact worktree and SHA commands in the admission section. PASS requires that the recorded `git rev-parse HEAD` equals the admitted SHA and that `git status --short` is empty for the entire backend worktree.

- [x] **Step 3: Verify the four blocker groups semantically**

The recalibration evidence must demonstrate all of these, not only matching words:

1. candidate and recruiter open items require viewer-specific `needs_action`;
2. open ordering is `needs_action DESC, updated_at DESC, case_id DESC` for that viewer and cursor carries the same key;
3. history remains terminal/read-only and does not use `needs_action` as a cursor key;
4. public `step` is closed and strict clients reject every unknown or illegal state tuple;
5. `completed + intent_confirmation + passed` produces `handoff_pending`, with durable outbox/event parity;
6. candidate detail requires only intention plus frozen workspace job; recruiter detail requires only frozen workspace job plus Case alias;
7. cross-role context, missing context and extra fields fail closed;
8. all list/history/detail success and error responses retain `Cache-Control: no-store`.

- [x] **Step 4: Verify stable P5 behavior was not redesigned**

```bash
rg -n "supplementary_question|fact-responses|prompt_id|respond_fact|resume-submission/content|agent-instructions" \
  apps/recruitment-bff/openapi/mobile-v1.yaml \
  apps/recruitment-bff/internal/recruitmentclient \
  apps/recruitment/internal/matchcase
```

Expected: transcript `ref` remains the prompt coordinate; no action payload DTO, `next_step`, P7 publication state or conversation reference has appeared.

- [x] **Step 5: Run the exact focused backend tests recorded by recalibration**

Expected: the focused commands in Recalibration Admission pass at the exact admitted SHA. Any broader diagnostic run is reported with its actual verdict; Task 0 creates no frontend implementation commit.

---

### Task 1: Add the Strict P5 Wire Facade

**Files:**
- Modify: `src/数据/BFF契约.ts`
- Create: `src/数据/招聘数据源/MatchCase.ts`
- Create: `src/数据/招聘数据源/MatchCase.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`
- Modify: `src/测试/BFF样本.ts`

**Interfaces:**
- Consumes: Task 0 exact public schemas, Plan 1 no-store HTTP options, `BFF请求选项`, `BFF响应`, `BFF二进制响应`.
- Produces: strict role-specific P5 DTOs and `MatchCase数据源`.

```ts
export type P5角色 = 'candidate' | 'recruiter';
export type P5历史生命周期 = 'ended' | 'completed';
export type P5步骤 =
  | 'policy_check'
  | 'candidate_evaluation'
  | 'candidate_question'
  | 'recruiter_answer'
  | 'candidate_reevaluation'
  | 'human_decision'
  | 'complete'
  | 'awaiting_candidate_resume_invitation'
  | 'awaiting_resume_parse'
  | 'screening_resume'
  | 'awaiting_recruiter_decision'
  | 'coordinating'
  | 'awaiting_candidate_decision'
  | 'awaiting_confirmations'
  | 'awaiting_candidate_confirmation'
  | 'awaiting_recruiter_confirmation'
  | 'handoff_pending';
export type P5动作 =
  | 'respond_fact'
  | 'end_screening'
  | 'accept_resume_invitation'
  | 'decline_resume_invitation'
  | 'retry_resume_readiness'
  | 'replace_resume'
  | 'decide_resume_screening'
  | 'decide_coordination'
  | 'confirm_intent'
  | 'decline_intent';

export interface MatchCase数据源 {
  读取P5Open列表(role: P5角色, filterRef: string | null, cursor: string | null): Promise<P5列表页>;
  读取P5历史(role: P5角色, lifecycle: P5历史生命周期, filterRef: string | null, cursor: string | null): Promise<P5列表页>;
  读取P5详情(role: P5角色, caseId: string): Promise<P5详情>;
  回答P5事实(role: P5角色, caseId: string, promptId: string, response: string, key: string): Promise<void>;
  提交P5简历(caseId: string, fileId: string, fileVersionId: string, disclosureConfirmed: true, key: string): Promise<void>;
  决定P5S0(caseId: string, action: 'continue' | 'end', key: string): Promise<void>;
  决定P5S1(caseId: string, action: 'continue' | 'not_fit', key: string): Promise<void>;
  决定P5S2(role: P5角色, caseId: string, issueId: string, action: 'accept' | 'reject', key: string): Promise<void>;
  决定P5S3(role: P5角色, caseId: string, action: 'confirm' | 'decline', key: string): Promise<void>;
  新增P5叮嘱(role: P5角色, caseId: string, text: string, key: string): Promise<void>;
  读取P5简历PDF(role: P5角色, caseId: string): Promise<BFF二进制响应>;
}
```

`P5列表页` is a role-discriminated normalized page over `CandidateMatchCaseWorkspacePage | RecruiterMatchCaseWorkspacePage`; open and history deliberately share those page/item shapes. `P5详情` is a role-discriminated normalized detail over `CandidateMatchCaseDetail | RecruiterMatchCaseDetail`. Both preserve the admitted wire values but expose candidate/recruiter context through distinct branches, so cross-role optional fields cannot enter UI code. Decode absent `current_coordination` / `terminal_summary` as internal `null` only after exact-key wire validation; the public wire does not accept explicit `null` for those optional members.

- [ ] **Step 1: Write failing role-specific list/detail decoder tests**

Build wire fixtures directly from the admitted schema table and 17-row matrix above. Cover:

- candidate/recruiter open pages, viewer-specific `needs_action`, server order and opaque cursor;
- separate ended/completed history pages;
- candidate detail required intention/job and recruiter detail required job/alias;
- direct terminal detail and empty action arrays;
- missing/extra/cross-role keys, null required arrays, unknown enums and illegal state tuples;
- invalid/empty/oversized cursor inputs and invalid response cursor types.

Representative assertion:

```ts
expect(解P5详情(P5候选详情Wire, 'candidate')).toMatchObject({
  role: 'candidate',
  context: { intentionId: 'int_0123456789abcdef0123456789abcdef' },
  state: { caseId: 'mc_1' },
});
expect(() => 解P5详情({ ...P5候选详情Wire, candidate_alias: 'candidate-x' }, 'candidate'))
  .toThrow('服务返回了不符合契约的 MatchCase 数据');
```

- [ ] **Step 2: Write failing request-path/body tests**

Assert exact method/path/query/body for both lists, both history shelves, detail, fact response, resume submission/content, S0/S1/S2/S3 decisions and Case instruction. Every GET uses `不缓存: true`; PDF uses the role-scoped Case path and rejects non-PDF content.

The S1 resume assertion must require a literal `true` confirmation and preserve it in the strict body:

```ts
await source.提交P5简历(
  'mc_1',
  'rf_0123456789abcdef0123456789abcdef',
  'rfv_0123456789abcdef0123456789abcdef',
  true,
  'p5-resume-key-0001',
);
expect(请求).toHaveBeenCalledWith({
  path: '/api/v1/me/match-cases/mc_1/resume-submission',
  method: 'POST',
  body: {
    file_id: 'rf_0123456789abcdef0123456789abcdef',
    file_version_id: 'rfv_0123456789abcdef0123456789abcdef',
    disclosure_confirmed: true,
  },
  幂等: true,
  幂等键: 'p5-resume-key-0001',
});
```

```ts
await source.回答P5事实('candidate', 'mc_1', 'prompt_1', '四天远程', 'p5-fact-key-0001');
expect(请求).toHaveBeenCalledWith({
  path: '/api/v1/me/match-cases/mc_1/fact-responses',
  method: 'POST',
  body: { prompt_id: 'prompt_1', response: '四天远程' },
  幂等: true,
  幂等键: 'p5-fact-key-0001',
});
```

- [ ] **Step 3: Run facade/composition tests and verify RED**

```bash
npx vitest run src/数据/招聘数据源/MatchCase.test.ts src/数据/HTTP招聘数据源.test.ts
```

Expected: FAIL because the P5 domain is absent.

- [ ] **Step 4: Implement strict decoding and requests**

Follow the existing `招聘数据源/发现推荐.ts` exact-key/closed-enum decoder pattern. Use role-owned prefixes only:

```ts
const P5前缀 = { candidate: '/api/v1/me', recruiter: '/api/v1/recruiter' } as const;
function P5路径(role: P5角色, suffix: string): `/api/v1/${string}` {
  return `${P5前缀[role]}${suffix}` as `/api/v1/${string}`;
}
```

Encode opaque path/query values once. Never decode cursors or alias formats. Decode final `state.step` and legal tuple matrix exactly as admitted in Task 0; unknown or contradictory values throw `BFF错误(200, 'invalid_response', ...)` before UI consumption.

- [ ] **Step 5: Compose and commit the facade**

```bash
npx vitest run src/数据/招聘数据源/MatchCase.test.ts src/数据/HTTP招聘数据源.test.ts
git add src/数据/BFF契约.ts src/数据/招聘数据源/MatchCase.ts \
  src/数据/招聘数据源/MatchCase.test.ts src/数据/HTTP招聘数据源.ts \
  src/数据/HTTP招聘数据源.test.ts src/测试/BFF样本.ts
git commit -m "feat: add strict p5 matchcase facade"
```

Expected: PASS.

---

### Task 2: Build the Exhaustive P5 Display Mapper

**Files:**
- Create: `src/数据/MatchCase展示映射.ts`
- Create: `src/数据/MatchCase展示映射.test.ts`

**Interfaces:**
- Consumes: Task 1 normalized P5 DTOs and Plan 1 `取当前补充问题`.
- Produces: `映射P5列表项`, `映射P5详情`, closed UI copy/actions and role-safe context.

```ts
export function 映射P5列表项(item: P5列表项): P5列表视图;
export function 映射P5详情(detail: P5详情): P5详情视图;
```

- [ ] **Step 1: Write failing exhaustive state/action tests**

Table-test every admitted legal state tuple and final step word. Each row asserts stage title, status copy, whether it is terminal and which server-offered action cards may render. Add runtime fixtures for unknown lifecycle/stage/status/step/action and illegal combinations; all return a contract-error view with an empty action list.

```ts
it('completed handoff is preparation-only', () => {
  const view = 映射P5详情(P5CompletedHandoff样本);
  expect(view.handoff).toEqual({
    copy: '双方已确认，正在创建会话',
    canChat: false,
  });
  expect(view.actions).toEqual([]);
});
```

Also assert alias is returned verbatim, `case_id` owns keys/navigation, and absent P5.1 sections do not create placeholders.

- [ ] **Step 2: Write failing prompt integration tests**

When `respond_fact` is present, adapt only the admitted current-stage transcript fields into Plan 1 `取当前补充问题`. One match enables the prompt view; zero/multiple/invalid matches produce contract error and no submit control.

- [ ] **Step 3: Run mapper tests and verify RED**

```bash
npx vitest run src/数据/MatchCase展示映射.test.ts src/数据/MatchCase基础.test.ts
```

Expected: FAIL because the mapper is absent.

- [ ] **Step 4: Implement the exhaustive mapper**

Represent the admitted tuple table as data and use `satisfies`/`never` to force compile-time coverage of every closed enum. Button visibility is the intersection of a legal state tuple and the exact `available_actions`; never infer an action from summary, transcript text, the other party's decision or `state.needs_user`.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run src/数据/MatchCase展示映射.test.ts src/数据/MatchCase基础.test.ts
git add src/数据/MatchCase展示映射.ts src/数据/MatchCase展示映射.test.ts
git commit -m "feat: map closed p5 states to ui"
```

Expected: PASS.

---

### Task 3: Add Memory-Only P5 Operations and Polling

**Files:**
- Modify: `src/状态/后端/类型.ts`
- Create: `src/状态/后端/MatchCase操作.ts`
- Create: `src/状态/后端/MatchCase操作.test.ts`
- Create: `src/状态/后端/useMatchCase轮询.ts`
- Create: `src/状态/后端/useMatchCase轮询.test.tsx`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2 facade/views and existing session/role generation fences.
- Produces: role/scope snapshots, authoritative reads, single-flight mutations, invalidation and visible polling.

```ts
export const P5范围键 = {
  open: (role: P5角色, filterRef: string | null) => string,
  history: (role: P5角色, lifecycle: P5历史生命周期, filterRef: string | null) => string,
  detail: (role: P5角色, caseId: string) => string,
} as const;
```

- [ ] **Step 1: Write failing read/snapshot tests**

Cover first load, refresh preserving prior success, load-more cursor append, refresh-from-first-page of the loaded window, duplicate protection, two independent history shelves, direct detail without list memory, role/filter scope isolation and stale completion after logout/role/scope change.

- [ ] **Step 2: Write failing mutation tests**

Cover one stable idempotency key per `role + case_id + action + target/ref`, same-intent replay after uncertainty, single-flight for one target, parallel mutations for different Cases, and mandatory detail/list/history reread after success or confirmed replay. A mutation response never replaces detail.

- [ ] **Step 3: Write failing polling tests**

Assert open lists poll every 5 seconds and open detail every 3 seconds only while visible; hidden tab, unmount, role/session/scope change and terminal detail stop timers. Poll failures retain the last successful read-only snapshot and expose a retry error.

- [ ] **Step 4: Run operation tests and verify RED**

```bash
npx vitest run \
  src/状态/后端/MatchCase操作.test.ts \
  src/状态/后端/useMatchCase轮询.test.tsx \
  src/状态/应用状态.test.ts
```

Expected: FAIL because the P5 state domain is absent.

- [ ] **Step 5: Implement the memory-only domain**

Reuse the current P4 subject/role/session/scope generation pattern without reusing P4 data. Add reset hooks to logout, 401, subject switch and role switch. Do not add P5 fields to `资料持久化`; snapshots and object leases stay in provider/runtime memory.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run \
  src/状态/后端/MatchCase操作.test.ts \
  src/状态/后端/useMatchCase轮询.test.tsx \
  src/状态/应用状态.test.ts
git add src/状态/后端/类型.ts src/状态/后端/MatchCase操作.ts \
  src/状态/后端/MatchCase操作.test.ts src/状态/后端/useMatchCase轮询.ts \
  src/状态/后端/useMatchCase轮询.test.tsx src/状态/应用状态.tsx \
  src/状态/应用状态.test.ts
git commit -m "feat: add p5 matchcase runtime state"
```

Expected: PASS.

---

### Task 4: Wire Candidate and Recruiter Open Lists

**Files:**
- Create: `src/屏幕/P5/MatchCase列表.tsx`
- Create: `src/屏幕/P5/MatchCase列表.test.tsx`
- Modify: `src/屏幕/在谈首页.tsx`
- Modify: `src/屏幕/企业在谈候选.tsx`

**Interfaces:**
- Consumes: Tasks 2–3 list views/snapshots/operations and existing current/all scope selectors.
- Produces: Backend candidate/recruiter P5 open pages; Mock branches remain unchanged.

- [ ] **Step 1: Write failing dual-role list tests**

```tsx
it('renders viewer-specific action responsibility without state.needs_user', async () => {
  render(<MatchCase列表 role="candidate" filterRef="int_case" />);
  expect(await screen.findByText('需要你')).toBeInTheDocument();
  cleanup();
  render(<MatchCase列表 role="recruiter" filterRef="job_case" />);
  expect(await screen.findByText('代理处理中')).toBeInTheDocument();
});
```

Also test candidate/recruiter current/all filters, server order preservation, loaded-item filters, first load/retry/refresh, opaque load-more cursor, no false total before cursor exhaustion, navigation by `case_id`, alias verbatim with generic avatar, unknown-contract failure and Mock zero P5 calls.

- [ ] **Step 2: Run list tests and verify RED**

```bash
npx vitest run src/屏幕/P5/MatchCase列表.test.tsx
```

Expected: FAIL because the P5 list component is absent.

- [ ] **Step 3: Implement the shared list and thin screen branches**

```tsx
export function MatchCase列表(props: { role: P5角色; filterRef: string | null }) {
  // Select the exact role/filter snapshot, start visible 5s polling,
  // preserve backend order, and navigate with item.state.caseId.
}
```

Move each current screen body into a private Mock component without behavioral edits. The exported wrapper selects P5 only in Backend mode. Candidate cards render only frozen workspace job context; recruiter cards render only Case alias plus frozen job context. Do not hydrate existing Mock `在谈单`/`候选` objects.

- [ ] **Step 4: Run focused tests and commit**

```bash
npx vitest run src/屏幕/P5/MatchCase列表.test.tsx src/组件/候选筛选抽屉.test.tsx
git add src/屏幕/P5/MatchCase列表.tsx src/屏幕/P5/MatchCase列表.test.tsx \
  src/屏幕/在谈首页.tsx src/屏幕/企业在谈候选.tsx
git commit -m "feat: wire p5 matchcase workspaces"
```

Expected: PASS.

---

### Task 5: Wire Direct-Refresh Detail, Timeline and Case Instructions

**Files:**
- Create: `src/屏幕/P5/MatchCase详情.tsx`
- Create: `src/屏幕/P5/MatchCase详情.test.tsx`
- Modify: `src/屏幕/在谈详情.tsx`
- Modify: `src/屏幕/在谈详情.test.tsx`
- Modify: `src/屏幕/候选详情.tsx`
- Create: `src/屏幕/候选详情.test.tsx`

**Interfaces:**
- Consumes: role-specific detail context, Tasks 2–3 views/operations, existing `阶段对话流` and `真输入条`.
- Produces: one dual-role detail complete from URL `case_id` and authenticated role alone.

- [ ] **Step 1: Write failing direct-refresh/privacy tests**

```tsx
it('direct URL refresh renders context without list memory', async () => {
  render(
    <MemoryRouter initialEntries={['/deal/mc_direct']}>
      <Routes><Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} /></Routes>
    </MemoryRouter>,
  );
  expect(操作.读取详情).toHaveBeenCalledWith('candidate', 'mc_direct', true);
  expect(await screen.findByText('平台工程师')).toBeInTheDocument();
});
```

Cover recruiter refresh showing alias but no name/contact, fixed S0→S3 order, checklist/transcript/instruction receipts, timeline display-only, unknown state hiding controls, terminal stopping polling, missing P5.1 sections absent and `case_id` as the sole coordinate. `候选详情.test.tsx` has no predecessor on the admitted frontend baseline; create it as the recruiter wrapper's first test file rather than assuming an existing suite.

- [ ] **Step 2: Write failing Case-instruction tests**

Assert instruction POST waits for the server, creates no optimistic bubble/rule, clears input only on success and rereads detail. Terminal/contract-error details hide the input.

- [ ] **Step 3: Run detail tests and verify RED**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx \
  src/屏幕/在谈详情.test.tsx src/屏幕/候选详情.test.tsx
```

Expected: FAIL because the shared P5 detail is absent.

- [ ] **Step 4: Implement the detail and Backend wrappers**

On mount, force a role-scoped detail GET and use no list snapshot. Use `阶段对话流` only as a renderer of typed sections. Never call Mock/P4 company/job/resume lookup helpers in Backend mode. The instruction input calls Task 3, then relies on the authoritative detail reread.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx \
  src/屏幕/在谈详情.test.tsx src/屏幕/候选详情.test.tsx
git add src/屏幕/P5/MatchCase详情.tsx src/屏幕/P5/MatchCase详情.test.tsx \
  src/屏幕/在谈详情.tsx src/屏幕/在谈详情.test.tsx \
  src/屏幕/候选详情.tsx src/屏幕/候选详情.test.tsx
git commit -m "feat: wire p5 direct-refresh detail"
```

Expected: PASS.

---

### Task 6: Wire S0–S3 Actions and Authorized Raw PDF

**Files:**
- Modify: `src/屏幕/P5/MatchCase详情.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.test.tsx`

**Interfaces:**
- Consumes: exact `available_actions`, typed prompt/issue/intent facts, Plan 1 resume selection and PDF lease, Task 3 mutation operations.
- Produces: viewer-authorized action cards and disclosure-fenced PDF preview.

- [ ] **Step 1: Write failing S0/S1 tests**

```tsx
it('submits supplementary_question.ref and rereads authority', async () => {
  render(<MatchCase详情 role="candidate" />);
  await user.type(screen.getByRole('textbox', { name: '回答问题' }), '负责交易网关');
  await user.click(screen.getByRole('button', { name: '提交回答' }));
  expect(操作.回答事实).toHaveBeenCalledWith(
    'candidate', 'mc_case', 'prompt_ref', '负责交易网关',
  );
});
```

Cover same-key replay, zero/multiple prompt fail closed, exact candidate S0 decisions, S1 invitation/readiness/replace using an explicit Plan 1 file/version pair, recruiter `continue|not_fit`, and action absence sending zero requests. Every S1 submit/replace opens a fresh disclosure confirmation naming the selected PDF; cancel sends zero requests, confirm passes the literal `true`, and a second attempt cannot reuse the prior confirmation.

- [ ] **Step 2: Write failing S2/S3 tests**

Cover exact `issue_id`, accept/reject only for required undecided viewer, missing issue fail closed, independent confirm/decline, already-decided viewer waiting, second confirmation terminal reread and all terminal mutation controls absent.

- [ ] **Step 3: Write failing PDF privacy tests**

Assert disclosure-before and parse pending/failed show no name/contact/PDF; recruiter sees a PDF button only when the typed S1 attachment is present; clicking calls only the Case-scoped role path, creates one Plan 1 lease, and close/unmount revokes it. No code reads blob text/arrayBuffer for identity.

- [ ] **Step 4: Run tests and verify RED**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx \
  src/数据/MatchCase基础.test.ts src/数据/PDF对象租约.test.ts
```

Expected: failures at absent action/PDF UI.

- [ ] **Step 5: Implement server-offered actions only**

Render each action card only when both the closed mapper and exact `available_actions` admit it. Use typed prompt/issue/file coordinates; never parse timeline text or infer from the other party. After every mutation, Task 3 rereads detail and relevant list/history scopes.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx \
  src/数据/MatchCase基础.test.ts src/数据/PDF对象租约.test.ts
git add src/屏幕/P5/MatchCase详情.tsx src/屏幕/P5/MatchCase详情.test.tsx
git commit -m "feat: wire p5 lifecycle actions and resume disclosure"
```

Expected: PASS.

---

### Task 7: Wire Terminal History and Handoff Pending

**Files:**
- Create: `src/屏幕/P5/MatchCase历史.tsx`
- Create: `src/屏幕/P5/MatchCase历史.test.tsx`
- Modify: `src/屏幕/归档谈判.tsx`
- Modify: `src/屏幕/企业归档.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.test.tsx`

**Interfaces:**
- Consumes: terminal views and Tasks 2–3 history operations.
- Produces: two independent terminal shelves and preparation-only handoff UI.

- [ ] **Step 1: Write failing two-shelf history tests**

Assert candidate/recruiter each request `completed` and `ended` separately, never merge cursors, open the same detail route by `case_id`, and preserve terminal read-only behavior.

- [ ] **Step 2: Write failing handoff tests**

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

Assert no conversation identifier exists in view state, navigation arguments, storage or request mocks.

- [ ] **Step 3: Run tests and verify RED**

```bash
npx vitest run src/屏幕/P5/MatchCase历史.test.tsx src/屏幕/P5/MatchCase详情.test.tsx
```

Expected: FAIL because history/handoff UI is absent.

- [ ] **Step 4: Implement terminal shelves and handoff copy**

Backend archive wrappers render separate completed/ended groups and navigate by `case_id`; Mock archive implementations remain private and unchanged. `completed + handoff_pending` shows the exact preparation copy, disabled chat button and zero mutation inputs.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run src/屏幕/P5/MatchCase历史.test.tsx src/屏幕/P5/MatchCase详情.test.tsx \
  src/屏幕/在谈详情.test.tsx src/屏幕/候选详情.test.tsx
git add src/屏幕/P5/MatchCase历史.tsx src/屏幕/P5/MatchCase历史.test.tsx \
  src/屏幕/归档谈判.tsx src/屏幕/企业归档.tsx \
  src/屏幕/P5/MatchCase详情.tsx src/屏幕/P5/MatchCase详情.test.tsx
git commit -m "feat: complete p5 terminal workspace ui"
```

Expected: PASS.

---

### Task 8: Add Browser Acceptance and Final Gates

**Files:**
- Modify: `e2e/数据源模式.spec.ts`
- Modify: `docs/DEV_LOG.md`

**Interfaces:**
- Consumes: Tasks 1–7 and the admitted final backend fixtures.
- Produces: browser-level P5 evidence and a clean implementation handoff.

- [ ] **Step 1: Add exact mutable BFF fixtures**

Serve both roles for one shared `case_id`, with different viewer action responsibility, exact admitted state tuples, current supplementary prompt, disclosure-fenced PDF, two history shelves and completed handoff pending. Match exact method/path/query; every Case response includes its admitted no-store header.

- [ ] **Step 2: Add the required Backend journeys**

Create separate Playwright tests for:

1. same Case has different candidate/recruiter `needs_action` and each list preserves server order/cursor;
2. unknown lifecycle/stage/status/step and illegal tuple fail closed;
3. candidate and recruiter detail direct refresh with empty list memory;
4. S0 prompt submits `ref`, same-key replay succeeds and reread removes the action;
5. disclosure-before and parse pending/failed expose no name/contact/PDF;
6. disclosed recruiter opens only the Case-scoped raw PDF;
7. S2/S3 reread authority and terminal actions disappear;
8. completed handoff shows preparation copy and never requests a chat route;
9. ended/completed shelves open read-only detail;
10. logout/role switch clears visible P5 state.

- [ ] **Step 3: Add Mock isolation and no-store assertions**

Record every browser request containing `/match-cases`; Mock journeys must produce an empty list. Unit fetch spies must assert every P5 JSON/PDF GET carries `cache: 'no-store'`, while fixtures assert response no-store headers.

- [ ] **Step 4: Run focused and full verification**

```bash
npm test -- --run \
  src/数据/HTTP客户端.test.ts \
  src/数据/招聘数据源/MatchCase.test.ts \
  src/数据/MatchCase基础.test.ts \
  src/数据/MatchCase展示映射.test.ts \
  src/数据/PDF对象租约.test.ts \
  src/状态/后端/MatchCase操作.test.ts \
  src/状态/后端/useMatchCase轮询.test.tsx \
  src/屏幕/P5/MatchCase列表.test.tsx \
  src/屏幕/P5/MatchCase详情.test.tsx \
  src/屏幕/P5/MatchCase历史.test.tsx
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e:data-source -- --grep 'P5|MatchCase|Mock in-talk'
```

Expected: every command passes.

- [ ] **Step 5: Run the P5.1/P7 absence scan**

```bash
scan_forbidden() {
  pattern=$1
  shift
  rg -n "$pattern" "$@"
  code=$?
  case "$code" in
    0) return 1 ;;
    1) return 0 ;;
    *) return "$code" ;;
  esac
}
scan_forbidden "next_step|handoff.*published|conversation[_-]?(id|ref)|candidate_identity|match_score|match_reasons|highlights|compensation_relationship" \
  src/数据/招聘数据源/MatchCase.ts src/数据/MatchCase展示映射.ts \
  src/状态/后端/MatchCase操作.ts src/屏幕/P5 || exit 1
scan_forbidden "模拟数据|企业端模拟数据|取在谈岗位详情|公司档案|求职侧对齐行" \
  src/数据/招聘数据源/MatchCase.ts src/数据/MatchCase展示映射.ts \
  src/状态/后端/MatchCase操作.ts src/屏幕/P5 || exit 1
```

Expected: exit 0 with no production matches. A match or any `rg` scan error, including a missing path, exits non-zero. Inspect any match; do not suppress it mechanically.

- [ ] **Step 6: Record evidence and commit**

Append every frontend implementation command result to the existing Task 0 admission entry in `docs/DEV_LOG.md`; retain the admitted backend SHA and receipts unchanged, then add:

```text
P5.1 deferred: rich job/company/publisher, score/reasons/highlights, compensation relationship,
anonymous parsed resume, stable P4 alias, structured identity, and P7 conversation contract are not P5 gates.
```

Then:

```bash
git add e2e/数据源模式.spec.ts docs/DEV_LOG.md
git commit -m "test: gate p5 frontend contract wiring"
git status --short
```

Expected: clean worktree.

---

## Plan 2 Self-Review

- [x] The recalibration commit changes status to `READY_FOR_EXECUTION` and pins one clean exact backend SHA.
- [x] Task 0 proves all four backend gaps through public schemas and focused tests before product code changes, while recording the broad-suite timeout with its actual verdict.
- [x] No task treats `respond_fact` as missing or requests an action payload DTO.
- [x] No production type, mapper, copy or test introduces `next_step`.
- [x] Handoff UI is only `completed + handoff_pending`; no P7 publication/conversation requirement exists.
- [x] P5.1 fields appear only in exclusion checks, never production DTOs or completion gates.
- [x] Identity and raw PDF remain separate; PDF bytes are never parsed.
- [x] Alias is display-only and `case_id` owns every identity/key boundary.
- [x] Direct refresh consumes detail role context and never list memory.
- [x] Same-Case dual-viewer action responsibility, unknown-code fail-closed, prompt replay, privacy, terminal actions and no-store behavior all have unit/component/E2E ownership.
- [x] Task 8 owns Mock isolation, full frontend verification, P5.1/P7 absence scans and the clean implementation handoff.
