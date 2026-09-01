# Candidate Onboarding Frontend Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make real-backend candidate onboarding persist one experience, one skill, one certificate and one active intention; preserve draft answers across navigation/reload; show authoritative phone data; and keep development tooling from blocking business controls.

**Architecture:** Keep `/me/resume` and `/me/intentions` service-authoritative. Use local state only for unsubmitted edits, with an account/environment-scoped `sessionStorage` draft for reload recovery. Preflight the complete resume payload before starting partitioned mutations, then preserve the existing final authoritative GET and conflict recovery behavior.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Vite 8, Vitest 4, Testing Library, Playwright.

**Spec:** This document is self-contained. Do not require screenshots, a test-machine PDF, browser auth files, or earlier chat history.

## Global Constraints

- Backend mode is selected with `VITE_DATA_SOURCE=backend`; API failures must never fall back to Mock.
- Resume and active intention remain service-authoritative after submission.
- Catalog writes must use the selected `{ id, display_name }`; never infer IDs from labels or auto-select the first result.
- A browser draft must be scoped by `backend + environment + subject_id` and cleared on logout, 401, role transfer away from candidate, and subject change.
- Never persist auth cookies, raw PDF bytes, parsed PDF text, unmasked contact data, or model output.
- Do not invent a certificate year, silently use the current year, or send `0`/`NaN`.
- Do not directly create an intention to bypass failed onboarding pages.
- Follow TDD: add a failing regression, run it, implement minimally, then run focused tests plus `npm run typecheck`, `npm run lint`, and `npm run build`.

---

## Observed facts to encode as regressions

After the failed flow, the service returned one education but zero experiences, skills, certificates and intentions. Browser history contained profile PATCH and education POST only; it contained no experience/skills/certificate/intention mutation. The credential endpoint already returned one authoritative masked `phone_otp` display.

The direct save contradiction currently exists in source:

```ts
// src/屏幕/工作经历.tsx
证书: [...证书列表, { 编号: `c${Date.now()}`, 名称: 名, 年份: '' }]

// src/数据/后端映射.ts
export function 转证书写入(段: 简历证书): BFF证书写入 {
  if (段.年份 === '') throw new Error('证书年份不能为空');
  // ...
}
```

`src/数据/招聘数据源/简历.ts` constructs certificate bodies before the `try` that executes mutation steps. The synchronous error therefore prevents every queued mutation from starting.

## File map

| File | Responsibility in this repair |
| --- | --- |
| `src/屏幕/工作经历.tsx` | Certificate UI, resume save submission state and feedback |
| `src/屏幕/工作经历.test.tsx` | Certificate/save page regressions |
| `src/数据/BFF契约.ts` | Certificate request type shared with the mapper |
| `src/数据/后端映射.ts` | Page model → BFF request validation/mapping |
| `src/数据/后端映射.test.ts` | Certificate mapping contract tests |
| `src/数据/招聘数据源/简历.ts` | Full resume preflight and partitioned mutation execution |
| `src/数据/HTTP招聘数据源.test.ts` | Request sequence, zero-request validation and final GET tests |
| `src/数据/HTTP客户端.ts` | Typed client-validation copy; local validation must not look like a network error |
| `src/状态/领域/候选资料.ts` | Merge semantics for onboarding draft actions |
| `src/数据/资料缓存.ts` | Strict draft decoder/encoder or shared key helpers |
| `src/状态/资料持久化.ts` | Candidate onboarding draft restore/write lifecycle |
| `src/状态/应用状态.test.ts` | Reducer, reload recovery and account isolation tests |
| `src/屏幕/毕业院校.tsx` / `src/屏幕/选专业.tsx` | Truthful selector states |
| `src/屏幕/个人信息.tsx` | Authoritative credential display; no backend fake persistence |
| `src/屏幕/个人信息.test.tsx` | New credential/contact page tests |
| `src/组件/标注层.tsx` | Development overlay placement/gating |
| `e2e/数据源模式.spec.ts` | Complete backend onboarding and narrow-viewport regression |

---

### Task 1: Make certificate semantics explicit

**Files:**
- Modify: `src/屏幕/工作经历.tsx`
- Modify: `src/屏幕/工作经历.test.tsx`
- Modify: `src/数据/BFF契约.ts`
- Modify: `src/数据/后端映射.ts`
- Modify: `src/数据/后端映射.test.ts`

**Interfaces:**
- Consumes: `简历证书 { 编号, 名称, 年份 }` and backend `BFF证书写入`.
- Produces: one unambiguous certificate contract used by Task 2.

The UI comment says the year field was intentionally removed, while the BFF mapping requires it. This is a cross-stack contract mismatch. The recommended product-consistent resolution is `year: number | null` end to end, because the visible product intentionally accepts name-only certificates. If the deployed BFF still requires an integer, stop before implementation and obtain the contract change; do not restore a year field or fabricate a value without product approval.

- [ ] **Step 1: Write the failing mapping tests**

For the recommended nullable-year contract:

```ts
it('证书没有取得年份时显式写 null，不编造年份', () => {
  expect(转证书写入({ 编号: 'local-1', 名称: 'CET-4', 年份: '' }))
    .toEqual({ name: 'CET-4', year: null });
});

it('证书有年份时写整数', () => {
  expect(转证书写入({ 编号: 'local-1', 名称: 'PMP', 年份: '2024' }))
    .toEqual({ name: 'PMP', year: 2024 });
});
```

- [ ] **Step 2: Run and confirm the current empty-year case fails**

```bash
npm test -- src/数据/后端映射.test.ts
```

- [ ] **Step 3: Implement only the approved contract**

Update `BFF证书写入` and `转证书写入` consistently. Keep nonnumeric nonempty strings invalid. If product chooses required year instead, change both the test and UI to require an explicit user selection; do not mix contracts.

- [ ] **Step 4: Add the page regression**

In `工作经历.test.tsx`, enter `CET-4`, click `添加`, and assert the dispatched certificate contains the approved empty-year representation. Also assert the UI exposes every field required by the BFF contract.

- [ ] **Step 5: Run and commit**

```bash
npm test -- src/屏幕/工作经历.test.tsx src/数据/后端映射.test.ts
git add src/屏幕/工作经历.tsx src/屏幕/工作经历.test.tsx src/数据/BFF契约.ts src/数据/后端映射.ts src/数据/后端映射.test.ts
git commit -m "fix: align candidate certificate year contract"
```

---

### Task 2: Preflight the whole resume and report local validation honestly

**Files:**
- Modify: `src/数据/招聘数据源/简历.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`
- Modify: `src/数据/HTTP客户端.ts`
- Modify: `src/屏幕/工作经历.tsx`

**Interfaces:**
- Consumes: approved certificate mapping from Task 1.
- Produces: `保存简历` that either rejects before all mutations with a field-level validation error or executes the complete mutation plan and performs a final authoritative GET.

- [ ] **Step 1: Add a zero-request preflight regression**

Construct a `next` resume with one invalid complete entry. Assert `保存简历` rejects with a recognizable client-validation code/message and the request mock has zero mutation calls.

- [ ] **Step 2: Add a complete-save request regression**

Use one new skill, experience, education and certificate. Assert the expected mutation paths are present and the last request is `GET /api/v1/me/resume`.

- [ ] **Step 3: Run tests and verify a new assertion fails before implementation**

```bash
npm test -- src/数据/HTTP招聘数据源.test.ts
```

- [ ] **Step 4: Implement explicit preflight**

All synchronous request-body construction must finish before the first mutation. Represent local validation distinctly from `BFF错误(status=0, code=network_error)`. `取后端错误文案` must show the field reason and reserve network copy for transport failures.

- [ ] **Step 5: Add save state and truthful feedback**

Disable repeat clicks while saving. Show success only after the operation resolves and authoritative data is hydrated. Keep navigation after success only.

- [ ] **Step 6: Run and commit**

```bash
npm test -- src/数据/HTTP招聘数据源.test.ts src/屏幕/工作经历.test.tsx src/数据/HTTP客户端.test.ts
git add src/数据/招聘数据源/简历.ts src/数据/HTTP招聘数据源.test.ts src/数据/HTTP客户端.ts src/屏幕/工作经历.tsx src/屏幕/工作经历.test.tsx
git commit -m "fix: preflight candidate resume saves"
```

---

### Task 3: Preserve salary and arrival status when restarting the wizard

**Files:**
- Modify: `src/状态/领域/候选资料.ts`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: existing `状态['引导预填']`.
- Produces: `启程引导` that updates city/job/filter/ref fields without deleting salary or arrival fields.

The minimal reducer shape is:

```ts
case '启程引导':
  return {
    ...旧,
    引导预填: {
      ...(旧.引导预填 ?? {}),
      城市们: 动作.城市们,
      职位: 动作.职位,
      筛选偏好: 动作.筛选偏好,
      城市引用们: 动作.城市引用们 ?? [],
      职位引用们: 动作.职位引用们 ?? [],
    },
  };
```

- [ ] **Step 1: Extend the existing reducer test**

Seed `薪资: { 下限: 30, 上限: 40, 单位: '月薪K' }` and `到岗: '在职 · 考虑机会'`; dispatch `启程引导`; assert both survive while city/job/refs update.

- [ ] **Step 2: Run, implement and rerun**

```bash
npm test -- src/状态/应用状态.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/状态/领域/候选资料.ts src/状态/应用状态.test.ts
git commit -m "fix: preserve candidate onboarding answers"
```

---

### Task 4: Recover backend onboarding draft after reload without leakage

**Files:**
- Modify: `src/数据/资料缓存.ts`
- Modify: `src/数据/资料缓存.test.ts`
- Modify: `src/状态/资料持久化.ts`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `src/状态/后端/会话操作.ts`

**Interfaces:**
- Consumes: environment, current `subject_id`, `状态.引导预填`, session lifecycle actions.
- Produces: strict session-only persistence scoped to the current backend candidate.

- [ ] **Step 1: Define and test the allowlist**

Persist only:

```ts
{
  城市们: string[];
  职位: string[];
  城市引用们?: { id: string; display_name: string }[];
  职位引用们?: { id: string; display_name: string }[];
  筛选偏好?: 求职初筛偏好;
  薪资?: { 下限: number; 上限: number; 单位?: '月薪K' | '元/天' };
  到岗?: string;
}
```

Reject malformed arrays, missing IDs, nonnumeric salary and unknown salary units. Do not store resume content or credentials.

- [ ] **Step 2: Add lifecycle tests**

Cover: same subject restores after remount; `sub_A` never appears for `sub_B`; Mock localStorage stays byte-for-byte unchanged; logout/401 delete the active draft; candidate→recruiter clears candidate draft.

- [ ] **Step 3: Run and confirm failures**

```bash
npm test -- src/数据/资料缓存.test.ts src/状态/应用状态.test.ts
```

- [ ] **Step 4: Implement sessionStorage persistence**

Use a dedicated `账号存储键('候选引导草稿v1', 范围)` because logout must delete it explicitly while other UI preferences may remain. Write only after the current cache-scope key matches; restore only after `/me` supplies `subject_id`; delete on the lifecycle events above.

- [ ] **Step 5: Run and commit**

```bash
npm test -- src/数据/资料缓存.test.ts src/状态/应用状态.test.ts
git add src/数据/资料缓存.ts src/数据/资料缓存.test.ts src/状态/资料持久化.ts src/状态/应用状态.test.ts src/状态/后端/会话操作.ts
git commit -m "fix: recover scoped candidate onboarding drafts"
```

---

### Task 5: Make school and major buttons reflect reference validity

**Files:**
- Modify: `src/屏幕/毕业院校.tsx`
- Modify: `src/屏幕/选专业.tsx`
- Modify: `src/屏幕/毕业院校.test.tsx`
- Modify: `src/屏幕/选专业.test.tsx`

- [ ] **Step 1: Add failing button-state tests**

In backend mode: type nonempty text without selecting a result and assert disabled; select a result and assert enabled; edit again and assert disabled.

- [ ] **Step 2: Run tests**

```bash
npm test -- src/屏幕/毕业院校.test.tsx src/屏幕/选专业.test.tsx
```

- [ ] **Step 3: Implement exact predicates and empty state**

```ts
const 不可继续 = 词 === '' || (是后端 && 目录引用 === undefined);
```

Keep submit guards. Add visible loading and `没有匹配结果，试试缩短关键词`. Never create a free-text backend record.

- [ ] **Step 4: Rerun and commit**

```bash
npm test -- src/屏幕/毕业院校.test.tsx src/屏幕/选专业.test.tsx
git add src/屏幕/毕业院校.tsx src/屏幕/选专业.tsx src/屏幕/毕业院校.test.tsx src/屏幕/选专业.test.tsx
git commit -m "fix: reflect catalog selection validity"
```

---

### Task 6: Use authoritative phone data and remove backend fake contact saves

**Files:**
- Modify: `src/屏幕/个人信息.tsx`
- Create: `src/屏幕/个人信息.test.tsx`

**Interfaces:**
- Consumes: `操作.加载P8凭证()` and `后端状态.credentials`, already used by `设置.tsx` and `账号安全.tsx`.
- Produces: service-authored masked phone display and no local-only backend contact save.

- [ ] **Step 1: Write page tests**

Assert backend mount loads credentials; success renders the unique `phone_otp.display` verbatim; loading/error renders `—`; no phone credential renders `未绑定`; the mask is not an editable plaintext value; email/WeChat do not dispatch a fake backend save.

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- src/屏幕/个人信息.test.tsx
```

- [ ] **Step 3: Reuse the existing P8 projection**

Follow `设置.tsx`: load credentials on backend mount and render server `display`. Route phone changes to account security. Until a separate disclosure-contact API is approved, make email/WeChat read-only or hide them in backend mode; do not guess an endpoint.

- [ ] **Step 4: Rerun and commit**

```bash
npm test -- src/屏幕/个人信息.test.tsx src/屏幕/账号安全.test.tsx src/屏幕/设置.test.tsx
git add src/屏幕/个人信息.tsx src/屏幕/个人信息.test.tsx
git commit -m "fix: show authoritative candidate credentials"
```

---

### Task 7: Prevent annotation tooling from covering business controls

**Files:**
- Modify: `src/组件/标注层.tsx`
- Modify: `src/main.tsx`
- Modify: `e2e/数据源模式.spec.ts`

- [ ] **Step 1: Add a narrow-viewport regression**

Navigate to online resume, type a skill and click visible `添加` with the mouse. Assert the skill appears and the target is not covered.

- [ ] **Step 2: Run and reproduce**

```bash
npm run test:e2e:data-source -- --grep "标注模式不遮挡技能添加"
```

- [ ] **Step 3: Gate and reposition**

Do not render the tool in production. In development, put its launcher outside device content when a device frame exists; otherwise reserve layout space instead of relying on z-index.

- [ ] **Step 4: Rerun and commit**

```bash
npm run test:e2e:data-source -- --grep "标注模式不遮挡技能添加"
git add src/组件/标注层.tsx e2e/数据源模式.spec.ts
git commit -m "fix: keep annotation tools outside app controls"
```

Add the entry-point file to the commit only if it changed.

---

### Task 8: Prove the complete backend onboarding closure

**Files:**
- Modify: `e2e/数据源模式.spec.ts`

- [ ] **Step 1: Extend the mutable BFF fixture**

Support nullable certificate year only if Task 1 approved it. Record mutations, return authoritative GET snapshots, and reject unknown request shapes.

- [ ] **Step 2: Add the full flow**

Start empty; fill city/job/30–40K/profile/education; add one experience, skill and certificate; save through visible UI without URL jumps; finish preferences; assert exactly one intention POST; reload; assert all resume sections and one active intention return; exercise back/forward and verify salary remains 30–40K.

- [ ] **Step 3: Run focused and full verification**

```bash
npm run test:e2e:data-source -- --grep "候选 onboarding 完整保存并创建首次意向"
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e:data-source
```

All commands must exit 0. The E2E must record one experience POST, one skills PATCH, one certificate POST under the approved contract, one intention POST, and successful authoritative reloads.

- [ ] **Step 4: Commit**

```bash
git add e2e/数据源模式.spec.ts
git commit -m "test: cover candidate onboarding persistence"
```

## Explicit non-goals

- Do not implement PDF-to-online-resume auto-fill; the current attachment contract exposes parse lifecycle only.
- Do not create frontend major-name aliases; catalog IDs and synonyms belong to backend data ownership.
- Do not invent email/WeChat persistence without an approved endpoint and disclosure policy.
- Do not weaken service-authoritative hydration to keep stale local data visible.

## Completion report required

Return the approved certificate-year contract, files and commits by task, focused red/green evidence, full verification results, final E2E mutation counts and authoritative reload state, and any still-blocked contract item.
