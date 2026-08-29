# Recruitment P5 Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the frontend work that is useful before the four P5 backend contract gaps close: an explicit no-store transport seam, exact P4 PDF selection coordinates, and contract-stable P5 prompt/PDF safety helpers, without creating or wiring any provisional MatchCase list/detail DTO.

**Architecture:** Keep this slice below the P5 read-contract boundary. Extend the shared HTTP client only through opt-in no-store options, finish the already-approved P4 delegation body and its explicit attachment selection UI, and add pure helpers whose inputs are the already-approved transcript/PDF facts. P5 workspace, history, detail, state mapping, polling and action rendering remain absent until Plan 2 is recalibrated against the final backend HEAD.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Testing Library, existing same-origin BFF HTTP client and P2 attachment-resume state.

**Spec:** `docs/superpowers/specs/2026-08-29-recruitment-p5-frontend-wiring-design.md`

## Global Constraints

- This plan is executable before the P5 contract-completion backend patch. Its acceptance must not inspect or depend on the proposed new list/detail wire fields.
- Do not create `P5列表页`, `P5详情`, `MatchCaseView`, a step enum, a legal-state matrix, or any workspace/history/detail decoder in this plan.
- Do not add P5 routes to candidate/recruiter screens, polling, local Case snapshots or P5 mutation buttons.
- Do not derive `needs_action` from `state.needs_user`, add `next_step`, parse timeline prose, infer a conversation ID, or add `handoff.published`.
- The P4 candidate delegation body must use the already implemented P5 backend requirement: exact `resume_file_id` and `resume_file_version_id`, chosen by the user from the P2 attachment library.
- Zero attachment files redirects to `路径.我的简历` and sends no delegation. One file still requires an explicit disclosure confirmation. More than one file requires an explicit radio selection before confirmation.
- A selected version is the visible file row's `current_version.version_id`; never choose “latest” outside the user-visible selection and never call a Resume/profile API to construct it.
- The supplementary-question helper owns only the approved S0 rule: when `respond_fact` is available, exactly one current-stage transcript item with `kind=supplementary_question`, the viewer role, a non-empty `ref` and non-empty viewer-safe `text` is accepted. Zero or multiple matches fail closed.
- PDF helpers accept only `application/pdf`, never parse its contents, and revoke each object URL exactly once.
- All changes are Backend-safe and Mock-neutral. Mock mode sends zero new MatchCase requests and preserves its current reducer behavior.
- Use TDD for every code task. Finish each independently green slice with its own commit.

## Completion Boundary

Plan 1 is complete only when all of the following are true:

1. Any caller can opt JSON or binary requests into `Request.cache = 'no-store'` without changing existing callers.
2. Both candidate P4 delegation entry points require and send an explicitly chosen PDF file/version pair.
3. The S0 current-question resolver and PDF object-URL lease are closed, pure and unit-tested.
4. No production file defines a provisional P5 list/detail/state contract or starts a P5 read request.
5. Focused tests, the full Vitest suite, typecheck, lint and build pass.

Completing this plan does **not** mean “P5 frontend complete.” The exact handoff phrase is `P5 frontend foundation complete; contract-gated wiring not started`.

---

### Task 0: Establish the Independent Baseline

**Files:**
- Read: `package.json`
- Read: `src/数据/HTTP客户端.ts`
- Read: `src/数据/招聘数据源/发现推荐.ts`
- Read: `src/状态/后端/发现推荐操作.ts`
- Read: `src/状态/后端/附件简历操作.ts`
- Read: `src/屏幕/看市场.tsx`
- Read: `src/屏幕/职位详情.tsx`
- Read: backend `apps/recruitment-bff/openapi/mobile-v1.yaml`
- Modify: none

**Interfaces:**
- Consumes: the Plan 1 execution worktree created by `superpowers:using-git-worktrees` and the current committed P4/P2 frontend.
- Produces: a clean baseline and an explicit PASS/STOP decision before product edits.

- [ ] **Step 1: Verify the execution worktree and record its exact frontend SHA**

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected: a dedicated implementation branch, one concrete SHA, and no uncommitted files. If the worktree is dirty, STOP and preserve the existing changes rather than editing over them.

- [ ] **Step 2: Pin the already-approved backend seams without admitting the four blockers**

```bash
git -C /Users/visionclaw/.paseo/worktrees/recruitment-p5-execution rev-parse HEAD
git -C /Users/visionclaw/.paseo/worktrees/recruitment-p5-execution status --short -- \
  apps/recruitment-bff/openapi/mobile-v1.yaml
rg -n "required: \[intention_id, selection, disclosure_acknowledged, resume_file_id, resume_file_version_id\]|supplementary_question|resume-submission/content" \
  /Users/visionclaw/.paseo/worktrees/recruitment-p5-execution/apps/recruitment-bff/openapi/mobile-v1.yaml \
  /Users/visionclaw/.paseo/worktrees/recruitment-p5-execution/apps/recruitment/internal/matchcase/timeline.go
```

Expected: backend SHA `55968690f11386b2575a7768ef6fb483d66c068f`, no OpenAPI modification, exact P4 resume coordinates, current supplementary transcript evidence and Case-scoped PDF routes. Do not inspect candidate backend-completion Spec fields or use this step to admit list/detail/step contracts.

- [ ] **Step 3: Confirm the P2/P4 frontend seams this plan consumes**

```bash
rg -n "附件简历库|刷新附件简历|创建候选岗位委托|委托候选岗位|disclosure_acknowledged" \
  src/数据/BFF契约.ts \
  src/数据/招聘数据源/发现推荐.ts \
  src/状态/后端/类型.ts \
  src/状态/后端/发现推荐操作.ts \
  src/状态/后端/附件简历操作.ts \
  src/屏幕/看市场.tsx \
  src/屏幕/职位详情.tsx
```

Expected: the attachment library exposes each file's `file_id` and `current_version.version_id`; both screens already call the same P4 candidate-delegation operation. If either coordinate is absent from the committed P2 state, STOP because the plan's only selection source is missing.

- [ ] **Step 4: Run the untouched focused baseline**

```bash
npx vitest run \
  src/数据/HTTP客户端.test.ts \
  src/数据/招聘数据源/发现推荐.test.ts \
  src/状态/后端/发现推荐操作.test.ts \
  src/数据/招聘数据源/附件简历.test.ts \
  src/状态/后端/附件简历操作.test.ts \
  src/屏幕/看市场.test.tsx \
  src/屏幕/职位详情.test.tsx
```

Expected: PASS. A pre-existing failure blocks implementation and must be reported separately.

---

### Task 1: Add an Opt-In No-Store Transport Seam

**Files:**
- Modify: `src/数据/HTTP客户端.ts`
- Modify: `src/数据/HTTP客户端.test.ts`

**Interfaces:**
- Consumes: existing `BFF请求选项`, `BFF客户端.请求` and `BFF客户端.请求二进制`.
- Produces: optional `不缓存: true` for JSON and binary requests; existing callers and retries retain their current behavior.

```ts
export interface BFF二进制请求选项 {
  不缓存?: true;
}

export interface BFF客户端 {
  请求<T>(options: BFF请求选项): Promise<BFF响应<T>>;
  请求二进制(
    path: `/api/v1/${string}`,
    options?: BFF二进制请求选项,
  ): Promise<BFF二进制响应>;
}
```

- [ ] **Step 1: Write the failing JSON/binary no-store tests**

Add these cases to `src/数据/HTTP客户端.test.ts`:

```ts
it('only explicitly no-store JSON and binary requests set Request.cache', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      result: { ok: true }, meta: { request_id: 'json', api_version: 'v1' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    .mockResolvedValueOnce(new Response('%PDF-1.7', {
      status: 200, headers: { 'Content-Type': 'application/pdf' },
    }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      result: { ok: true }, meta: { request_id: 'normal', api_version: 'v1' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

  const client = 创建BFF客户端({ fetcher });
  await client.请求({ path: '/api/v1/me/match-cases', 不缓存: true });
  await client.请求二进制(
    '/api/v1/me/match-cases/mc_1/resume-submission/content',
    { 不缓存: true },
  );
  await client.请求({ path: '/api/v1/session' });

  expect(fetcher.mock.calls.map(([, init]) => init?.cache)).toEqual([
    'no-store', 'no-store', undefined,
  ]);
});
```

Also extend the existing one-network-failure GET tests to assert every retry preserves `cache: 'no-store'`.

- [ ] **Step 2: Run the test and verify RED**

```bash
npx vitest run src/数据/HTTP客户端.test.ts
```

Expected: TypeScript/test failure because `不缓存` and binary options do not exist.

- [ ] **Step 3: Implement the narrow option**

Add `不缓存?: true` to `BFF请求共同选项`, add `BFF二进制请求选项`, and set the fetch init only when the caller opts in:

```ts
const init: RequestInit = {
  method,
  headers,
  credentials: 'include',
  ...(options.不缓存 ? { cache: 'no-store' as const } : {}),
};
```

Use the same conditional in `请求二进制`. Do not change error parsing, credential handling, body serialization, retry count or idempotency behavior.

- [ ] **Step 4: Run focused and regression tests**

```bash
npx vitest run src/数据/HTTP客户端.test.ts src/数据/招聘数据源/附件简历.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the transport seam**

```bash
git add src/数据/HTTP客户端.ts src/数据/HTTP客户端.test.ts
git commit -m "feat: add opt-in no-store requests"
```

---

### Task 2: Freeze Exact P4 Resume Coordinates Through the Data and Operation Layers

**Files:**
- Modify: `src/数据/招聘数据源/发现推荐.ts`
- Modify: `src/数据/招聘数据源/发现推荐.test.ts`
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/状态/后端/发现推荐操作.ts`
- Modify: `src/状态/后端/发现推荐操作.test.ts`

**Interfaces:**
- Consumes: P2 `BFF附件简历.file_id/current_version.version_id` and the existing P4 candidate-delegation operation.
- Produces: one exact candidate-delegation input from screen to BFF; recruiter delegation is unchanged.

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

- [ ] **Step 1: Write the failing facade body test**

In `发现推荐.test.ts`, update the candidate delegation call and assert the exact body:

```ts
await source.创建候选岗位委托({
  intentionId: 'int_1',
  jobId: 'job_1',
  resumeFileId: 'rf_1',
  resumeFileVersionId: 'rfv_7',
  disclosureAcknowledged: true,
  idempotencyKey: 'delegation-key-0001',
});

expect(请求).toHaveBeenCalledWith(expect.objectContaining({
  path: '/api/v1/me/job-delegations',
  method: 'POST',
  body: {
    intention_id: 'int_1',
    selection: { items: ['job_1'] },
    disclosure_acknowledged: true,
    resume_file_id: 'rf_1',
    resume_file_version_id: 'rfv_7',
  },
}));
```

Add a compile-time `@ts-expect-error` case showing that omitting either resume coordinate is rejected.

- [ ] **Step 2: Write the failing operation passthrough and lock-coordinate tests**

In `发现推荐操作.test.ts`, assert that `委托候选岗位` forwards both coordinates unchanged and that its single-flight/idempotency coordinate remains the recommendation/job intent, not the file ID:

```ts
await 操作.委托候选岗位({
  intentionId: 'int_1', recommendationId: 'rec_1', jobId: 'job_1',
  resumeFileId: 'rf_1', resumeFileVersionId: 'rfv_7',
  disclosureAcknowledged: true,
});

expect(后端.创建候选岗位委托).toHaveBeenCalledWith(expect.objectContaining({
  resumeFileId: 'rf_1',
  resumeFileVersionId: 'rfv_7',
}));
```

Also assert an outcome-uncertain replay retains the same idempotency key and the same file/version pair.

- [ ] **Step 3: Run the focused tests and verify RED**

```bash
npx vitest run \
  src/数据/招聘数据源/发现推荐.test.ts \
  src/状态/后端/发现推荐操作.test.ts
```

Expected: compile/test failures because the current input and body omit the two coordinates.

- [ ] **Step 4: Implement the exact passthrough**

Extend only the candidate input in the facade, state operation interface and operation implementation. The BFF body must contain the exact five required properties shown in Step 1. Do not select a file inside either layer and do not alter recruiter delegation.

- [ ] **Step 5: Run focused tests and commit**

```bash
npx vitest run \
  src/数据/招聘数据源/发现推荐.test.ts \
  src/状态/后端/发现推荐操作.test.ts
git add src/数据/招聘数据源/发现推荐.ts \
  src/数据/招聘数据源/发现推荐.test.ts \
  src/状态/后端/类型.ts \
  src/状态/后端/发现推荐操作.ts \
  src/状态/后端/发现推荐操作.test.ts
git commit -m "fix: bind p4 delegation to an exact resume version"
```

Expected: PASS.

---

### Task 3: Add the Explicit Resume Selection UI to Both P4 Entry Points

**Files:**
- Create: `src/组件/附件简历选择层.tsx`
- Create: `src/组件/附件简历选择层.module.css`
- Create: `src/组件/附件简历选择层.test.tsx`
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/状态/后端/附件简历操作.ts`
- Modify: `src/状态/后端/附件简历操作.test.ts`
- Modify: `src/屏幕/看市场.tsx`
- Modify: `src/屏幕/看市场.test.tsx`
- Modify: `src/屏幕/职位详情.tsx`
- Modify: `src/屏幕/职位详情.test.tsx`

**Interfaces:**
- Consumes: `状态.附件简历库`, the P2 attachment read coordinator, `路径.我的简历`, Task 2 `候选P4委托输入`, existing `弹层框架`/`确认层`.
- Produces: one explicit `{ fileId, fileVersionId, displayName }` selection per delegation click; no selection survives cancel, completion, unmount or scope change.

```ts
export interface 附件简历选择值 {
  fileId: string;
  fileVersionId: string;
  displayName: string;
}

export function 附件简历选择层(props: {
  文件们: readonly BFF附件简历[];
  取消: () => void;
  确认: (value: 附件简历选择值) => void;
}): React.ReactNode;

export interface 附件简历操作 {
  // Existing methods remain unchanged.
  准备候选委托简历(): Promise<BFF附件简历库 | null>;
}
```

- [ ] **Step 1: Write failing component tests**

Cover the multi-file contract:

```tsx
it('requires one radio selection and returns the visible current version', async () => {
  const 确认 = vi.fn();
  render(<附件简历选择层 文件们={[文件A, 文件B]} 取消={vi.fn()} 确认={确认} />);
  expect(screen.getByRole('button', { name: '确认并委托' })).toBeDisabled();
  await user.click(screen.getByRole('radio', { name: /产品简历/ }));
  await user.click(screen.getByRole('button', { name: '确认并委托' }));
  expect(确认).toHaveBeenCalledWith({
    fileId: 文件B.file_id,
    fileVersionId: 文件B.current_version.version_id,
    displayName: 文件B.display_name,
  });
});
```

Also assert cancel/Escape/overlay sends no confirmation, aliases/file names are displayed as text only, and no parse/profile content is rendered.

- [ ] **Step 2: Write failing screen-flow tests for zero, one and many files**

Add the same table-driven behavior to both screen test files:

```ts
it.each(['看市场', '职位详情'])('%s requires an explicit resume coordinate', async () => {
  // 0 files: authoritative preparation returns an empty library, then navigate to 路径.我的简历; zero delegation calls.
  // 1 file: show disclosure confirmation naming that file; confirm sends its current file/version IDs.
  // 2 files: show radio layer; confirm sends only the selected row's current file/version IDs.
});
```

Assert cancel clears the captured recommendation and selection, a second click rereads current state rather than reusing an old grant, and Mock mode keeps the existing Mock delegation behavior without reading the attachment library.

- [ ] **Step 3: Write the failing authoritative-library return tests**

In `附件简历操作.test.ts`, assert `准备候选委托简历()` returns the exact committed library from the existing read coordinator, rather than requiring a React closure to observe a state update:

```ts
await expect(操作.准备候选委托简历()).resolves.toEqual(权威附件库);
expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
```

Also assert a stale session/role completion returns `null`, current-session 401 follows existing account cleanup, and Mock/no-backend returns `null` without a request.

- [ ] **Step 4: Run component/screen/operation tests and verify RED**

```bash
npx vitest run \
  src/组件/附件简历选择层.test.tsx \
  src/状态/后端/附件简历操作.test.ts \
  src/屏幕/看市场.test.tsx \
  src/屏幕/职位详情.test.tsx
```

Expected: failures because the layer and exact-coordinate flows do not exist.

- [ ] **Step 5: Add the narrow authoritative-library operation**

Expose `准备候选委托简历()` from `创建附件简历操作`. It captures the existing session fence, calls the existing `读取并提交(fence)` coordinator immediately, returns the committed library when the fence remains valid, returns `null` after a generation change, and applies the same current-session 401 cleanup as `刷新附件简历`. Do not add another request queue or read implementation.

- [ ] **Step 6: Implement the selection layer**

Use the existing modal shell and native radio inputs. The action copy must state that the selected PDF and disclosure authorization apply to this delegation only. Build the returned value only from the selected `BFF附件简历` row.

- [ ] **Step 7: Implement the two Backend screen flows**

For each screen:

1. on each delegation click, await `操作.准备候选委托简历()` and use its returned library; do not read a pre-await React closure;
2. zero rows: show `请先上传一份 PDF 简历` and navigate to `路径.我的简历`;
3. one row: open the existing confirmation layer with the visible file name;
4. multiple rows: open `附件简历选择层`;
5. confirmation calls `操作.委托候选岗位` with the exact captured file/version pair and `disclosureAcknowledged: true`;
6. close the layer and clear the captured values before awaiting the mutation, so failures require a fresh explicit confirmation.

Do not write the choice to application persistence, do not remember a default, and do not inspect parse output.

- [ ] **Step 8: Run focused tests and commit**

```bash
npx vitest run \
  src/组件/附件简历选择层.test.tsx \
  src/屏幕/看市场.test.tsx \
  src/屏幕/职位详情.test.tsx \
  src/状态/后端/发现推荐操作.test.ts
git add src/组件/附件简历选择层.tsx \
  src/组件/附件简历选择层.module.css \
  src/组件/附件简历选择层.test.tsx \
  src/状态/后端/类型.ts src/状态/后端/附件简历操作.ts \
  src/状态/后端/附件简历操作.test.ts \
  src/屏幕/看市场.tsx src/屏幕/看市场.test.tsx \
  src/屏幕/职位详情.tsx src/屏幕/职位详情.test.tsx
git commit -m "feat: require explicit resume selection for delegation"
```

Expected: PASS.

---

### Task 4: Add Contract-Stable S0 Prompt and PDF Lease Helpers

**Files:**
- Create: `src/数据/MatchCase基础.ts`
- Create: `src/数据/MatchCase基础.test.ts`
- Create: `src/数据/PDF对象租约.ts`
- Create: `src/数据/PDF对象租约.test.ts`

**Interfaces:**
- Consumes: only the approved transcript item fields and `BFF二进制响应`; no full MatchCase wire type.
- Produces: `取当前补充问题` and `创建PDF对象租约`, consumed by recalibrated Plan 2.

```ts
export type P5基础角色 = 'candidate' | 'recruiter';

export interface P5问题阶段输入 {
  currentStage: string;
  availableActions: readonly string[];
  stages: readonly {
    stage: string;
    transcript: readonly {
      kind: string;
      role: string;
      ref?: string;
      text?: string;
    }[];
  }[];
}

export type P5当前问题结果 =
  | { kind: 'none' }
  | { kind: 'one'; promptId: string; text: string }
  | { kind: 'contract_error' };

export function 取当前补充问题(
  input: P5问题阶段输入,
  role: P5基础角色,
): P5当前问题结果;

export interface PDF对象租约 {
  url: string;
  revoke(): void;
}

export function 创建PDF对象租约(
  response: Pick<BFF二进制响应, 'blob' | 'contentType'>,
  urls?: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>,
): PDF对象租约;
```

- [ ] **Step 1: Write failing current-prompt tests**

Cover all closed outcomes:

```ts
expect(取当前补充问题(候选单问题, 'candidate')).toEqual({
  kind: 'one', promptId: 'prompt_1', text: '请补充工作安排。',
});
expect(取当前补充问题(无RespondFact动作, 'candidate')).toEqual({ kind: 'none' });
expect(取当前补充问题(零个匹配问题, 'candidate')).toEqual({ kind: 'contract_error' });
expect(取当前补充问题(两个匹配问题, 'candidate')).toEqual({ kind: 'contract_error' });
```

Also reject a question from a non-current stage, wrong owner, blank `ref` or blank `text`. Never select the first match and never use `event_id`.

- [ ] **Step 2: Write failing PDF lease tests**

```ts
it('accepts PDF and revokes one generated URL exactly once', () => {
  const urls = { createObjectURL: vi.fn(() => 'blob:p5'), revokeObjectURL: vi.fn() };
  const lease = 创建PDF对象租约({
    blob: new Blob(['%PDF'], { type: 'application/pdf' }),
    contentType: 'application/pdf',
  }, urls);
  expect(lease.url).toBe('blob:p5');
  lease.revoke();
  lease.revoke();
  expect(urls.revokeObjectURL).toHaveBeenCalledTimes(1);
});
```

Reject empty/mismatched/non-PDF content types before `createObjectURL`; the helper exposes no byte/text parser.

- [ ] **Step 3: Run helper tests and verify RED**

```bash
npx vitest run src/数据/MatchCase基础.test.ts src/数据/PDF对象租约.test.ts
```

Expected: FAIL because both modules are absent.

- [ ] **Step 4: Implement the minimal pure helpers**

`取当前补充问题` first checks `availableActions.includes('respond_fact')`. When absent it returns `none`; when present it searches only the section whose `stage === currentStage` and returns `one` only for exactly one fully valid candidate. All other present-action shapes return `contract_error`.

`创建PDF对象租约` requires both response `contentType` and `blob.type` to equal `application/pdf`, creates one URL, and closes over a boolean so repeated cleanup is harmless.

- [ ] **Step 5: Run focused tests and commit**

```bash
npx vitest run src/数据/MatchCase基础.test.ts src/数据/PDF对象租约.test.ts
git add src/数据/MatchCase基础.ts src/数据/MatchCase基础.test.ts \
  src/数据/PDF对象租约.ts src/数据/PDF对象租约.test.ts
git commit -m "feat: add p5 prompt and pdf safety helpers"
```

Expected: PASS.

---

### Task 5: Gate and Hand Off the Foundation Slice

**Files:**
- Modify: `docs/DEV_LOG.md`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: independent acceptance evidence and the exact Plan 1 handoff phrase.

- [ ] **Step 1: Run the scope-forbidden scan**

```bash
if rg -n "next_step|handoff.*published|conversation[_-]?(id|ref)|candidate_identity" \
  src/数据/MatchCase基础.ts src/数据/PDF对象租约.ts \
  src/组件/附件简历选择层.tsx; then exit 1; fi
if rg -n "读取P5(Open|历史|详情)|P5列表页|P5详情|MatchCaseStep|needs_action" \
  src/数据/MatchCase基础.ts src/数据/PDF对象租约.ts \
  src/组件/附件简历选择层.tsx \
  src/屏幕/看市场.tsx src/屏幕/职位详情.tsx; then exit 1; fi
```

Expected: exit 0 with no production matches. Test names may state a forbidden behavior only inside test files, which are not part of this scan.

- [ ] **Step 2: Run focused and full verification**

```bash
npm test -- --run \
  src/数据/HTTP客户端.test.ts \
  src/数据/招聘数据源/发现推荐.test.ts \
  src/状态/后端/发现推荐操作.test.ts \
  src/组件/附件简历选择层.test.tsx \
  src/屏幕/看市场.test.tsx \
  src/屏幕/职位详情.test.tsx \
  src/数据/MatchCase基础.test.ts \
  src/数据/PDF对象租约.test.ts
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: every command passes. Do not proceed on a partial pass.

- [ ] **Step 3: Record the independent acceptance evidence**

Append to `docs/DEV_LOG.md`:

```text
P5 frontend foundation complete; contract-gated wiring not started.
Delivered: opt-in no-store transport, exact P4 resume file/version selection,
closed supplementary-prompt resolver, and one-shot PDF object URL lease.
Excluded: P5 list/history/detail DTOs, state enum/matrix, polling, page routes and actions.
```

Record the exact frontend SHA before execution and every command/result from Step 2.

- [ ] **Step 4: Commit the gate evidence and verify cleanliness**

```bash
git add docs/DEV_LOG.md
git commit -m "docs: record p5 frontend foundation gate"
git status --short
```

Expected: clean worktree.

---

## Plan 1 Self-Review

- [ ] The implementation never reads or freezes the four unfinished backend contract fields.
- [ ] Candidate P4 delegation sends an explicit user-selected file/version pair from the P2 library.
- [ ] Zero/one/many attachment behavior is explicit and tested in both entry screens.
- [ ] `respond_fact` resolution accepts exactly one current-stage owned prompt and never invents an action payload.
- [ ] PDF bytes are never parsed and object URLs are revoked once.
- [ ] No P5 list/detail decoder, state mapper, page route, polling or snapshot exists.
- [ ] Mock behavior is unchanged and no new MatchCase request is made from a screen.
- [ ] Full verification passes and the handoff does not claim P5 completion.
