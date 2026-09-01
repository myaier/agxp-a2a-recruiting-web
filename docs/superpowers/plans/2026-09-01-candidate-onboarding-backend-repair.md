# Candidate Onboarding Backend Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Backend candidate onboarding persist one experience, one skill, one name-only certificate, and one active intention while preserving scoped draft answers, showing authoritative account-phone data, and keeping review tooling away from business controls.

**Architecture:** Keep `/api/v1/me/resume` and `/api/v1/me/intentions` service-authoritative. Validate and materialize the complete resume mutation plan before its first request, use an environment-and-subject-scoped `sessionStorage` allowlist only for unsubmitted onboarding answers, and isolate the annotation tool behind an explicit review-build layout.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Vite 8, Vitest 4, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-01-candidate-onboarding-backend-repair-design.md`

## Global Constraints

- Backend mode is selected with `VITE_DATA_SOURCE=backend`; API failures must never fall back to Mock.
- The BFF certificate read and write DTOs must contain `year: number | null`; a name-only certificate sends `year: null`.
- Non-null certificate years must be integers from `1900` through `2100`; never infer a year or send `0`/`NaN`.
- This product is not launched: implement the nullable contract directly, without migration, dual-read, dual-write, feature-version, or legacy missing-`year` compatibility.
- Resume and active intention are service-authoritative after submission; success is reported only after the authoritative GET hydrates state.
- Catalog writes use the selected `{ id, display_name }`; never infer IDs from text or auto-select the first result.
- Browser drafts are scoped by `backend + environment + subject_id`, use `sessionStorage`, and are cleared on logout, 401, candidate-to-recruiter transfer, and subject change.
- Never persist auth cookies, PDF bytes, parsed PDF text, resume content, unmasked contact data, credential objects, or model output.
- Do not directly create an intention to bypass failed onboarding pages.
- Backend email and WeChat remain visible as read-only `未接入`; do not invent a contact API.
- `VITE_ANNOTATION_ENABLED=true` is the only way to include the annotation UI; the default production build omits it.
- PDF parser invalid-output diagnosis is a separate backend workstream and is not part of this implementation or its completion claim.
- Follow TDD for every task: add the regression, run it and record the expected failure, implement minimally, rerun focused tests, and commit.

---

## File Map

| File | Responsibility in this repair |
| --- | --- |
| `src/数据/BFF契约.ts` | Nullable certificate read/write wire types |
| `src/数据/HTTP客户端.ts` | Typed local-validation error and user-facing projection |
| `src/数据/后端映射.ts` | Bidirectional certificate mapping and field validation |
| `src/数据/招聘数据源/简历.ts` | Complete preflight and ordered mutation execution |
| `src/屏幕/工作经历.tsx` | Name-only certificate action and single-flight save UI |
| `src/状态/领域/候选资料.ts` | Merge/hydration reducer semantics |
| `src/数据/资料缓存.ts` | Strict candidate-draft codec and scoped key helpers |
| `src/状态/资料持久化.ts` | Restore/write barrier and lifecycle cleanup |
| `src/状态/应用状态.tsx` | Candidate-only subject scope passed to persistence |
| `src/屏幕/毕业院校.tsx`, `src/屏幕/选专业.tsx` | Truthful Backend selector states |
| `src/屏幕/个人信息.tsx` | Authoritative account-phone projection and read-only contacts |
| `src/main.tsx`, `src/组件/标注层.tsx`, `src/组件/设备外框.tsx` | Review-build gate and non-overlapping layout |
| `e2e/数据源模式.spec.ts` | Strict mutable fixture, narrow click regression, full closure |

### Task 1: Establish the nullable certificate contract and local-validation semantics

**Files:**
- Modify: `src/数据/BFF契约.ts:96-101,408-411`
- Modify: `src/数据/HTTP客户端.ts:13-34,306-315`
- Modify: `src/数据/后端映射.ts:46-49,107-110,172-178`
- Modify: `src/数据/后端映射.test.ts`
- Modify: `src/数据/HTTP客户端.test.ts`
- Modify: `src/屏幕/工作经历.test.tsx`

**Interfaces:**
- Consumes: page-domain `简历证书 { 编号: string; 名称: string; 年份: string }`.
- Produces: `BFF证书.year: number | null`, `BFF证书写入.year: number | null`, `客户端校验错误(field, message)`, `转证书写入(段): BFF证书写入`, and `转证书(段): 简历证书` for Task 2 and Task 8.

- [ ] **Step 1: Add the failing certificate and error-projection regressions**

Add `转证书写入`, `转证书`, and type `BFF证书` to the imports in `src/数据/后端映射.test.ts`, then add these cases:

```ts
it('证书没有取得年份时显式写 null，不编造年份', () => {
  expect(转证书写入({ 编号: 'local-1', 名称: 'CET-4', 年份: '' }))
    .toEqual({ name: 'CET-4', year: null });
});

it.each(['1899', '2101', '2024.5', '二零二四', 'NaN'])(
  '拒绝非法证书年份 %s',
  (年份) => {
    expect(() => 转证书写入({ 编号: 'local-1', 名称: 'PMP', 年份 }))
      .toThrow('证书年份必须是 1900 到 2100 之间的整数');
  },
);

it('证书有合法年份时写整数', () => {
  expect(转证书写入({ 编号: 'local-1', 名称: 'PMP', 年份: '2024' }))
    .toEqual({ name: 'PMP', year: 2024 });
});

it('权威 null 年份回读为空字符串', () => {
  expect(转证书({ id: 'cert-1', name: 'CET-4', year: null, revision: 1 }))
    .toEqual({ 编号: 'cert-1', 名称: 'CET-4', 年份: '' });
});

it('权威证书缺失 year 时按响应契约错误拒绝', () => {
  try {
    转证书({ id: 'cert-1', name: 'CET-4', revision: 1 } as BFF证书);
    expect.unreachable('缺失 year 必须失败');
  } catch (错误) {
    expect(错误).toMatchObject({ status: 200, code: 'invalid_response' });
  }
});
```

In `src/数据/HTTP客户端.test.ts`, import the new error class and add:

```ts
it('客户端字段校验显示具体原因而不是网络错误', () => {
  expect(取后端错误文案(new 客户端校验错误('certificate.year', '证书年份超出范围')))
    .toBe('证书年份超出范围');
});
```

In `src/数据/后端映射.test.ts`, also assert both intention-local failures remain field reasons rather than falling through as network errors:

```ts
const 意向草稿 = {
  ...空草稿,
  工作城市: '上海',
  期望职位: '产品经理',
  工作城市引用: ref('loc_shanghai', '上海'),
  职位引用: ref('tax_product', '产品经理'),
  薪资下限: 10,
  薪资上限: 20,
};
const 首次输入 = {
  职位们: ['产品经理'],
  城市们: ['上海'],
  薪资: { 下限: 10, 上限: 20, 单位: '月薪K' as const },
  筛选偏好: {
    求职类型: ['社招全职'] as ['社招全职'],
    办公方式: ['混合'] as ['混合'],
  },
  排除项: [],
  职位引用: ref('tax_product', '产品经理'),
  城市引用们: [],
};

const 捕获 = (调用: () => unknown) => {
  try {
    调用();
    throw new Error('预期调用失败');
  } catch (错误) {
    return 错误;
  }
};
const 办公错误 = 捕获(() => 转意向写入({ ...意向草稿, 办公方式: [] }, { 原始: null }));
const 城市错误 = 捕获(() => 转首次意向写入(首次输入));
expect(办公错误).toMatchObject({ field: 'intention.workplace_modes', message: '请先完善办公方式' });
expect(城市错误).toMatchObject({ field: 'intention.primary_location_id', message: '请从候选城市中选择' });
expect(取后端错误文案(办公错误)).toBe('请先完善办公方式');
expect(取后端错误文案(城市错误)).toBe('请从候选城市中选择');
```

Import `取后端错误文案` in this test file; the four assertions above lock both the stable field names and the visible copy.

In `src/屏幕/工作经历.test.tsx`, type `CET-4` into `证书或语言，如 CPA、雅思 7.0`, click its sibling `添加`, and assert `派发` receives a `存简历` action whose `证书` is `[{ 名称: 'CET-4', 年份: '', 编号: expect.any(String) }]`. This proves every BFF-required user field is represented without adding a year input.

- [ ] **Step 2: Run the focused tests and record the red state**

Run:

```bash
npm test -- src/数据/后端映射.test.ts src/数据/HTTP客户端.test.ts src/屏幕/工作经历.test.tsx
```

Expected: the empty-year write and null-year read tests fail because the existing mapper rejects `''` and stringifies `null`; the error test fails because `客户端校验错误` does not exist. The page action test may already pass and remains as a contract lock.

- [ ] **Step 3: Implement the wire types and dedicated validation error**

Change both certificate DTOs in `src/数据/BFF契约.ts`:

```ts
export interface BFF证书 {
  id: string;
  name: string;
  year: number | null;
  revision: number;
}

export interface BFF证书写入 {
  name: string;
  year: number | null;
}
```

Add this class beside `BFF错误` in `src/数据/HTTP客户端.ts`:

```ts
export class 客户端校验错误 extends Error {
  readonly code = 'client_validation';

  constructor(readonly field: string, message: string) {
    super(message);
    this.name = '客户端校验错误';
  }
}
```

Make `取后端错误文案` check `客户端校验错误` before `BFF错误` and return `错误.message`. Keep `status === 0`/`network_error` copy exclusively for real transport errors.

- [ ] **Step 4: Implement exact bidirectional mapping**

Import `BFF错误` and `客户端校验错误` into `src/数据/后端映射.ts`. Make missing catalog references throw the local error with their existing field reason. Replace certificate mapping with:

```ts
export function 转证书(段: BFF证书): 简历证书 {
  if (!Object.prototype.hasOwnProperty.call(段, 'year')) {
    throw new BFF错误(200, 'invalid_response', '服务返回的证书缺少 year');
  }
  if (段.year !== null && (!Number.isInteger(段.year) || 段.year < 1900 || 段.year > 2100)) {
    throw new BFF错误(200, 'invalid_response', '服务返回的证书 year 不符合契约');
  }
  return {
    编号: 段.id,
    名称: 段.name,
    年份: 段.year === null ? '' : String(段.year),
  };
}

export function 转证书写入(段: 简历证书): BFF证书写入 {
  const 文本 = 段.年份.trim();
  if (文本 === '') return { name: 段.名称, year: null };
  if (!/^\d+$/.test(文本)) {
    throw new 客户端校验错误('certificate.year', '证书年份必须是 1900 到 2100 之间的整数');
  }
  const year = Number(文本);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new 客户端校验错误('certificate.year', '证书年份必须是 1900 到 2100 之间的整数');
  }
  return { name: 段.名称, year };
}
```

Replace the remaining intention-path naked throws too:

```ts
if (页值们.length === 0) {
  throw new 客户端校验错误('intention.workplace_modes', '请先完善办公方式');
}
// in 转首次意向写入
if (!primary) {
  throw new 客户端校验错误('intention.primary_location_id', '请从候选城市中选择');
}
```

Do not add a missing-`year` compatibility branch: TypeScript and Task 8's strict fixture require the property to exist.

- [ ] **Step 5: Run green tests, typecheck, and commit**

Run:

```bash
npm test -- src/数据/后端映射.test.ts src/数据/HTTP客户端.test.ts src/屏幕/工作经历.test.tsx
npm run typecheck
```

Expected: both commands exit 0.

```bash
git add src/数据/BFF契约.ts src/数据/HTTP客户端.ts src/数据/HTTP客户端.test.ts src/数据/后端映射.ts src/数据/后端映射.test.ts src/屏幕/工作经历.test.tsx
git commit -m "fix: align candidate certificate year contract"
```

### Task 2: Preflight the complete resume and make save single-flight

**Files:**
- Modify: `src/数据/招聘数据源/简历.ts:67-198`
- Modify: `src/数据/HTTP招聘数据源.test.ts:50-275`
- Modify: `src/屏幕/工作经历.tsx:252-280`
- Modify: `src/屏幕/工作经历.test.tsx`

**Interfaces:**
- Consumes: `客户端校验错误`, `转证书写入`, and nullable `BFF证书写入` from Task 1.
- Produces: `保存简历(next: 页面简历写入, previous: BFF简历)` that either rejects before every mutation or executes an already-materialized ordered plan and finishes with authoritative `GET /api/v1/me/resume`.

- [ ] **Step 1: Add the zero-request and complete-request regressions**

In `src/数据/HTTP招聘数据源.test.ts`, add a test that starts from the existing resume snapshot, changes profile data, appends `{ 编号: 'local-cert', 名称: 'PMP', 年份: '1899' }`, calls `保存简历`, expects `客户端校验错误`, and asserts the request mock has zero calls. The changed profile is essential: it proves preflight prevents mutations that appeared earlier in execution order.

Add a second test whose previous BFF resume has the same profile and summary as `next` but empty skills, experiences, educations, and certificates. Give `next` exactly one new skill, experience, education, and `{ 名称: 'CET-4', 年份: '' }`. Route the mocked responses to return generated IDs and end with an authoritative resume containing all four entries. Assert:

```ts
expect(请求Mock.mock.calls.map(([选项]) => `${选项.method} ${选项.path}`)).toEqual([
  'PATCH /api/v1/me/resume/skills',
  'POST /api/v1/me/resume/experiences',
  'POST /api/v1/me/resume/educations',
  'POST /api/v1/me/resume/certificates',
  'GET /api/v1/me/resume',
]);
expect(请求Mock.mock.calls[3]?.[0].body).toEqual({ name: 'CET-4', year: null });
```

Add a third regression: hydrate `year: null`, save that unchanged name-only certificate again after another field changes, and assert any certificate write still contains `year: null`, never `'null'`.

- [ ] **Step 2: Add page single-flight tests**

In `src/屏幕/工作经历.test.tsx`, make `操作.保存简历` return a deferred promise. Click `保存`, assert the button is disabled and reads `保存中…`, click again, and assert `保存简历` was called once. Resolve the deferred authoritative save, then assert `轻提示('简历已保存')` and navigation to the next onboarding route occur afterward. Add a rejection case that asserts navigation does not happen and the button returns to `保存`.

- [ ] **Step 3: Run the tests and confirm the new assertions fail**

```bash
npm test -- src/数据/HTTP招聘数据源.test.ts src/屏幕/工作经历.test.tsx
```

Expected: the full-preflight test observes an early mutation or delayed project-body validation, and the page accepts repeated save clicks.

- [ ] **Step 4: Materialize every request body before execution**

In `src/数据/招聘数据源/简历.ts`, keep the existing `写入步骤 = () => Promise<unknown>` execution type, but construct every body before pushing a step. For new experience projects, replace body construction inside the async closure with an already-validated array:

```ts
const 项目请求体们 = (段.项目 ?? []).map((项目) => ({
  name: 项目.名称,
  role: 项目.角色,
  result: 项目.结果,
}));
写入步骤们.push(async () => {
  const { result } = await 请求<BFF简历条目变更>({
    path: '/api/v1/me/resume/experiences',
    method: 'POST',
    body: 经历请求体,
    幂等: true,
  });
  const 新经历Id = result.entry.experience?.id;
  if (!新经历Id) return;
  段.编号 = 新经历Id;
  for (const 项目请求体 of 项目请求体们) {
    await 请求<BFF简历条目变更>({
      path: `/api/v1/me/resume/experiences/${新经历Id}/projects`,
      method: 'POST',
      body: 项目请求体,
      幂等: true,
    });
  }
});
```

Apply the same rule to profile, summary, skills, existing/new experiences, projects, education, and certificates: all synchronous mapping completes before the first `for (const 步骤 of 写入步骤们) await 步骤()`.

Retain current behavior for structurally incomplete draft experience/education entries, current mutation order, failure recovery GET, conflict snapshot attachment, final successful authoritative GET, and `段.编号 = 新经历Id` after an experience POST so a project failure retry cannot duplicate the parent experience.

- [ ] **Step 5: Implement single-flight page state and truthful feedback**

In `src/屏幕/工作经历.tsx`, add:

```ts
const [保存中, 设保存中] = useState(false);

const 保存 = async () => {
  if (保存中) return;
  // Keep the existing experience and portfolio guards here.
  设保存中(true);
  try {
    await 操作.保存简历({
      基本信息: 全局.基本信息,
      个人优势: 全局.个人优势,
      技能: 技能列表,
      经历: 经历列表,
      教育: 教育列表,
      证书: 证书列表,
    });
    轻提示('简历已保存');
    跳转(在校中 ? 路径.求职状态 : 路径.引导问答);
  } catch (错误) {
    轻提示(取后端错误文案(错误));
  } finally {
    设保存中(false);
  }
};
```

Wire the existing header button to `保存`, set `disabled={保存中}`, `aria-busy={保存中 || undefined}`, and render `保存中…` while pending. Keep the existing portfolio-link validation immediately before entering the `try`; that link is already stored separately and is not part of `页面简历写入`.

- [ ] **Step 6: Run green tests and commit**

```bash
npm test -- src/数据/HTTP招聘数据源.test.ts src/屏幕/工作经历.test.tsx src/数据/HTTP客户端.test.ts
npm run typecheck
```

```bash
git add src/数据/招聘数据源/简历.ts src/数据/HTTP招聘数据源.test.ts src/屏幕/工作经历.tsx src/屏幕/工作经历.test.tsx
git commit -m "fix: preflight candidate resume saves"
```

### Task 3: Preserve salary and arrival status when onboarding restarts

**Files:**
- Modify: `src/状态/领域/候选资料.ts:218-228`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: current `候选资料状态['引导预填']` and `启程引导` action.
- Produces: reducer merge semantics that update city/job/filter/reference fields while retaining `薪资` and `到岗`.

- [ ] **Step 1: Extend the reducer regression**

Seed:

```ts
引导预填: {
  城市们: ['上海'],
  职位: ['旧职位'],
  城市引用们: [{ id: 'loc_old', display_name: '上海' }],
  职位引用们: [{ id: 'job_old', display_name: '旧职位' }],
  薪资: { 下限: 30, 上限: 40, 单位: '月薪K' },
  到岗: '在职 · 考虑机会',
}
```

Dispatch `启程引导` with new city/job/filter/refs. Assert the new values replace owned fields and the exact salary and arrival values survive. Keep the existing regression that omitted refs become `[]`.

- [ ] **Step 2: Run red, implement the merge, and rerun green**

```bash
npm test -- src/状态/应用状态.test.ts
```

Replace the reducer case with:

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

Run the same test command again; expect exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/状态/领域/候选资料.ts src/状态/应用状态.test.ts
git commit -m "fix: preserve candidate onboarding answers"
```

### Task 4: Recover a strict subject-scoped Backend onboarding draft

**Files:**
- Modify: `src/数据/资料缓存.ts`
- Modify: `src/数据/资料缓存.test.ts`
- Modify: `src/状态/领域/候选资料.ts`
- Modify: `src/状态/资料持久化.ts`
- Modify: `src/状态/应用状态.tsx:536-548`
- Modify: `src/状态/应用状态.test.ts`
- Inspect: `src/状态/后端/会话操作.ts` (the current lifecycle actions should remain the signal; do not add a second storage implementation)

**Interfaces:**
- Consumes: `资料缓存范围`, `账号存储键`, current Backend environment, `/me.subject_id`, candidate role, `状态.引导预填`, and existing logout/401/role-transfer state transitions.
- Produces: `候选引导草稿键`, `读候选引导草稿`, `写候选引导草稿`, `删候选引导草稿`, and a persistence write barrier keyed by the exact candidate scope.

- [ ] **Step 1: Add strict codec regressions**

In `src/数据/资料缓存.test.ts`, add an in-memory `sessionStorage` test that round-trips exactly:

```ts
const 草稿 = {
  城市们: ['上海'],
  职位: ['后端工程师'],
  城市引用们: [{ id: 'loc_sh', display_name: '上海' }],
  职位引用们: [{ id: 'job_be', display_name: '后端工程师' }],
  筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['混合'] },
  薪资: { 下限: 30, 上限: 40, 单位: '月薪K' },
  到岗: '在职 · 考虑机会',
};
```

Assert the stored JSON has no extra property when the input object is augmented with `简历`, `credentials`, or `parsed_pdf_text`. Add table cases that write raw JSON with malformed arrays, empty ref IDs, nonnumeric salary, unknown salary unit, unknown root field, invalid recruitment/workplace enum, or wrong optional-field type; each must return `null` and remove the corrupted key.

Add a key isolation assertion:

```ts
expect(候选引导草稿键({ 数据源: 'backend', 环境: 'stg', subject_id: 'sub_A' }))
  .not.toBe(候选引导草稿键({ 数据源: 'backend', 环境: 'stg', subject_id: 'sub_B' }));
```

- [ ] **Step 2: Add mount and lifecycle regressions**

In `src/状态/应用状态.test.ts`, use the existing provider/remount helpers and real `window.sessionStorage` to cover these exact cases:

0. A brand-new candidate subject with empty storage fills 30–40K, unmounts, and remounts with that salary restored.
1. A pre-seeded `sub_A` candidate remount restores 30–40K and arrival status.
2. First-render empty state does not overwrite `sub_A`'s stored draft before hydration.
3. Switching to `sub_B` neither restores nor rewrites `sub_A` data.
4. Logout removes the active candidate draft and clears in-memory `引导预填`.
5. A mocked 401 path removes the active candidate draft and clears in-memory `引导预填`.
6. candidate-to-recruiter role transfer removes the previous candidate key.
7. Mock mode leaves a seeded `localStorage` string byte-for-byte unchanged and creates no candidate session key.

- [ ] **Step 3: Run and record the red state**

```bash
npm test -- src/数据/资料缓存.test.ts src/状态/应用状态.test.ts
```

Expected: helpers are missing, reload does not restore, and lifecycle events leave a scoped session key behind.

- [ ] **Step 4: Implement the strict allowlist codec**

In `src/数据/资料缓存.ts`, export:

```ts
export interface 候选引导草稿快照 {
  城市们: string[];
  职位: string[];
  城市引用们?: { id: string; display_name: string }[];
  职位引用们?: { id: string; display_name: string }[];
  筛选偏好?: 求职初筛偏好;
  薪资?: { 下限: number; 上限: number; 单位?: '月薪K' | '元/天' };
  到岗?: string;
}

export const 候选引导草稿分类 = '候选引导草稿v1';
export const 候选引导草稿键 = (范围: 资料缓存范围) => 账号存储键(候选引导草稿分类, 范围);
```

Implement `读候选引导草稿(storage, 范围)`, `写候选引导草稿(storage, 范围, 草稿)`, and `删候选引导草稿(storage, 范围)`. Decoder rules are closed:

- root keys must be a subset of the interface keys;
- city/job arrays contain only strings;
- refs contain exactly non-empty string `id` and `display_name`;
- salary bounds are finite numbers and the optional unit is `月薪K` or `元/天`;
- filter enums are only `社招全职|校园招聘|实习生|兼职` and `现场|混合|全远程`;
- `毕业时间` is `YYYY-MM`; optional internship counts are finite integers;
- any invalid present field rejects and removes the entire stored record;
- writer constructs a fresh allowlisted object and never spreads the caller object.

- [ ] **Step 5: Add an explicit draft hydration action**

In `src/状态/领域/候选资料.ts`, add:

```ts
| { 型: '水合候选引导草稿'; 草稿: NonNullable<候选资料状态['引导预填']> }
```

and reducer behavior:

```ts
case '水合候选引导草稿':
  return { ...旧, 引导预填: 动作.草稿 };
```

Use the existing `清后端草稿` action to clear in-memory draft on logout/401/role/subject transitions; do not add storage calls to unrelated reducers.

- [ ] **Step 6: Implement candidate scope, restore barrier, writes, and cleanup**

In `src/状态/应用状态.tsx`, derive the candidate-only subject:

```ts
const 当前候选主体标识 =
  后端状态.主体?.last_used_role === 'candidate'
    ? 后端状态.主体.subject_id
    : null;
```

Pass it to `use资料持久化`. In `src/状态/资料持久化.ts`, keep Mock localStorage effects untouched and add refs/state with these semantics:

```ts
const 已恢复候选键 = useRef<string | null>(null);
const 上一候选范围 = useRef<资料缓存范围 | null>(null);
const [候选恢复代际, 设候选恢复代际] = useState(0);
```

On scope change, remove `上一候选范围` before replacing it when the new key differs, dispatch the existing in-memory clear action, then restore only if Backend + candidate + subject are all present. Dispatch `水合候选引导草稿` when a valid snapshot exists. After the read attempt finishes, execute this unconditionally—even when storage was empty:

```ts
已恢复候选键.current = 当前键;
设候选恢复代际((值) => 值 + 1);
```

Include `候选恢复代际` in the write effect dependencies. This makes a brand-new subject writable while retaining the first-render overwrite barrier.

The write effect must recompute the current key and return unless it equals `已恢复候选键.current`; then write the allowlist or delete the key when `引导预填 === null`. This equality check is required on every write and prevents a stale effect from crossing subjects.

Inspect `src/状态/后端/会话操作.ts`: if its existing logout, 401, and role-switch paths already dispatch `清后端草稿` while the persistence hook observes the old scope, do not change it. If any path drops the old subject before emitting a state transition visible to the hook, move the existing `清后端草稿` dispatch before that subject reset; do not introduce a second draft-storage implementation there.

- [ ] **Step 7: Run green tests, typecheck, and commit**

```bash
npm test -- src/数据/资料缓存.test.ts src/状态/应用状态.test.ts
npm run typecheck
```

```bash
git add src/数据/资料缓存.ts src/数据/资料缓存.test.ts src/状态/领域/候选资料.ts src/状态/资料持久化.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts
git commit -m "fix: recover scoped candidate onboarding drafts"
```

The expected implementation does not edit `src/状态/后端/会话操作.ts`: its existing logout, 401, and role-switch actions feed the persistence hook's cleanup. If the red lifecycle test proves one path clears the subject without the existing `清后端草稿` transition, first add that exact failing action-order assertion, move the existing dispatch before the subject reset, and include that file in this commit.

### Task 5: Make school and major buttons reflect reference validity

**Files:**
- Modify: `src/屏幕/毕业院校.tsx`
- Modify: `src/屏幕/选专业.tsx`
- Modify: `src/屏幕/毕业院校.test.tsx`
- Modify: `src/屏幕/选专业.test.tsx`

**Interfaces:**
- Consumes: Backend taxonomy/location query results and selected `BFF目录引用`.
- Produces: disabled/submit predicates tied to reference validity plus visible loading, empty, and error states.

- [ ] **Step 1: Add failing interaction and search-state tests to both pages**

For each page in Backend mode:

```ts
await 用户.type(screen.getByPlaceholderText('学校名称'), '复旦');
expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();
await 用户.click(await screen.findByRole('button', { name: /复旦大学/ }));
expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();
await 用户.type(screen.getByPlaceholderText('学校名称'), '新');
expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();
```

Use `专业名称` and a major result for the second page. Add one query-deferred test asserting `加载中…`, one empty response test asserting `没有匹配结果，试试缩短关键词`, and one rejection test asserting `加载失败，请重试`. Resolve an older request after a newer request and assert the older result is not rendered.

- [ ] **Step 2: Run and record the red state**

```bash
npm test -- src/屏幕/毕业院校.test.tsx src/屏幕/选专业.test.tsx
```

Expected: typed unselected text leaves `下一步` enabled, and explicit search states are absent.

- [ ] **Step 3: Implement exact predicates and request sequencing**

In both pages add:

```ts
type 搜索阶段 = 'idle' | 'loading' | 'success' | 'error';
const [搜索阶段, 设搜索阶段] = useState<搜索阶段>('idle');
const 请求序 = useRef(0);
const 不可继续 = 词 === '' || (是后端 && 目录引用 === undefined);
```

Increment `请求序.current` for each search, capture it locally, and only apply success/error if it still equals the current sequence. Empty text resets to `idle`. Nonempty Backend text enters `loading`; fulfilled data enters `success`; rejection enters `error`. Keep the separate load-more pending state.

Render exact copy:

```tsx
{搜索阶段 === 'loading' ? <div role="status">加载中…</div> : null}
{搜索阶段 === 'success' && 候选.length === 0 ? (
  <div role="status">没有匹配结果，试试缩短关键词</div>
) : null}
{搜索阶段 === 'error' ? <div role="alert">加载失败，请重试</div> : null}
```

Use `<主按钮 ... 禁用={不可继续} />`, retain the submit guard, clear the selected ref on any text edit, and preserve selected `{ id, display_name }` exactly.

- [ ] **Step 4: Run green tests and commit**

```bash
npm test -- src/屏幕/毕业院校.test.tsx src/屏幕/选专业.test.tsx
npm run typecheck
```

```bash
git add src/屏幕/毕业院校.tsx src/屏幕/选专业.tsx src/屏幕/毕业院校.test.tsx src/屏幕/选专业.test.tsx
git commit -m "fix: reflect catalog selection validity"
```

### Task 6: Show authoritative account phone and remove Backend fake contact saves

**Files:**
- Modify: `src/屏幕/个人信息.tsx`
- Create: `src/屏幕/个人信息.test.tsx`

**Interfaces:**
- Consumes: `操作.加载P8凭证()`, `后端状态.credentials`, and the projection already used by `设置.tsx` and `账号安全.tsx`.
- Produces: read-only Backend `账号手机号`, navigation to `路径.账号安全`, and separate Backend disclosure-phone/email/WeChat rows fixed to `未接入`.

- [ ] **Step 1: Write the page tests**

Create a render helper around `应用状态上下文`. Add tests that assert:

```ts
expect(加载P8凭证).toHaveBeenCalledTimes(1);
expect(screen.getByText('138****5678')).toBeTruthy();
expect(screen.queryByRole('textbox', { name: '账号手机号' })).toBeNull();
```

Cover credential phase `loading` and `error` as `—`; `success` with no `phone_otp` as `未绑定`; `success` with one `phone_otp` as its exact server `display`; and `success` with two `phone_otp` entries as `—`. Click the account-phone row and assert navigation to `路径.账号安全`.

In Backend mode, assert `简历披露手机号`, email, and WeChat each show `未接入`, expose no edit input, and never dispatch `存联系方式`. Assert the server credential mask appears only on `账号手机号`, not on the disclosure-phone row. Add a Mock-mode regression proving existing editable phone/email/WeChat behavior and dispatch remain unchanged.

- [ ] **Step 2: Run and record the red state**

```bash
npm test -- src/屏幕/个人信息.test.tsx
```

Expected: the new file fails because the page does not load/project credentials and Backend contacts still use local editable state.

- [ ] **Step 3: Reuse the P8 credential projection**

Import `useEffect`, `路径`, and required navigation/state hooks. On Backend mount:

```ts
useEffect(() => {
  if (!是后端) return;
  void 操作.加载P8凭证().catch(() => undefined);
}, [是后端, 操作]);

const 手机凭证们 = 后端状态.credentials.data?.filter((行) => 行.provider === 'phone_otp') ?? [];
const 账号手机号 = 后端状态.credentials.phase !== 'success'
  ? '—'
  : 手机凭证们.length === 0
    ? '未绑定'
    : 手机凭证们.length === 1
      ? 手机凭证们[0].display
      : '—';
```

Render it under the exact label `账号手机号` in a read-only row/button that navigates to `路径.账号安全`. Do not copy the mask into component input state. In Backend mode also render `简历披露手机号`, `邮箱`, and `微信号` as three separate read-only `未接入` rows; none reads `状态.联系方式`. Conditionally retain the existing editable `手机号`/`邮箱`/`微信号` components only for Mock.

- [ ] **Step 4: Run green tests and commit**

```bash
npm test -- src/屏幕/个人信息.test.tsx src/屏幕/账号安全.test.tsx src/屏幕/设置.test.tsx
npm run typecheck
```

```bash
git add src/屏幕/个人信息.tsx src/屏幕/个人信息.test.tsx
git commit -m "fix: show authoritative candidate credentials"
```

### Task 7: Gate annotation tooling and keep it outside device content

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/组件/标注层.tsx`
- Create: `src/组件/标注层.module.css`
- Modify: `src/组件/设备外框.tsx`
- Modify: `src/组件/设备外框.module.css`
- Modify: `playwright.数据源模式.config.ts`
- Modify: `e2e/数据源模式.spec.ts`

**Interfaces:**
- Consumes: `import.meta.env.VITE_ANNOTATION_ENABLED`, existing device-frame breakpoints, and existing annotation controls.
- Produces: no annotation component in default builds, a reserved external launcher lane when explicitly enabled, and annotation panels still anchored to device content.

- [ ] **Step 1: Add the narrow pointer-click regression**

In `e2e/数据源模式.spec.ts`, add a top-level `标注评审构建 @annotation` describe and a test named `标注模式不遮挡技能添加 @annotation`. Set that describe's base URL to `http://127.0.0.1:4183`. After the normal authenticated fixture is installed, open the online-resume route, fill `如：Go、分布式事务` with `Rust`, compute the center of that input's sibling `添加` button, and use `page.mouse.click(x, y)`. Assert a visible `Rust` skill chip appears. Do not nest this test under an `@backend` describe and do not call `locator.click({ force: true })`, because the dedicated project and physical hit test are both part of the regression.

- [ ] **Step 2: Enable annotation only for the dedicated Playwright servers and reproduce**

Add a third server to `playwright.数据源模式.config.ts` without changing the existing 4181/4182 command prefixes:

```ts
{
  name: 'backend-stg-annotation',
  command:
    'VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=stg VITE_ANNOTATION_ENABLED=true npm run dev -- --host 127.0.0.1 --port 4183 --strictPort',
  url: 'http://127.0.0.1:4183',
  reuseExistingServer: false,
  timeout: 120_000,
},
```

Add its isolated project:

```ts
{
  name: 'backend-stg-annotation',
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:4183',
  },
  grep: /@annotation/,
},
```

The existing Mock and Backend projects keep their default commands with no annotation variable, so the production-shaped layout retains E2E coverage. Then run:

```bash
npm run test:e2e:data-source -- --grep "标注模式不遮挡技能添加"
```

Expected before layout implementation: the mouse click hits the annotation launcher/overlay or the skill does not appear.

- [ ] **Step 3: Implement build gating and explicit height ownership**

Create `src/组件/标注层.module.css` with a narrow two-row review layout, a wide two-column layout, and only the launcher positioned into the reserved lane:

```css
.评审布局 {
  height: 100dvh;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 58px;
  overflow: hidden;
}
.应用槽 { min-width: 0; min-height: 0; }
.工具占位 { min-width: 0; min-height: 0; }
.启动器 { position: fixed; right: 14px; bottom: 12px; pointer-events: auto; }

@media (min-width: 700px) and (min-height: 640px) and (pointer: fine),
       (min-width: 1024px) and (min-height: 600px) {
  .评审布局 {
    grid-template-columns: minmax(0, 1fr) 64px;
    grid-template-rows: minmax(0, 1fr);
  }
  .启动器 { right: 14px; bottom: auto; top: 50%; transform: translateY(-50%); }
}
```

Keep the annotation root's existing `position: absolute; inset: 0` inside `设备外框`, so its drawing overlay, input bar, export panel, and mask remain device-sized. Move only the launcher coordinates from inline styles to `.启动器`. The launcher escapes into the reserved row/column with `position: fixed`; the root and every other annotation child retain their current geometry and pointer behavior.

Add optional `填满父级?: boolean` to `设备外框`, applying `.填满父级` to both frame variants. In its CSS add `height: 100%` for that class after the existing `100dvh` declarations.

In `src/main.tsx`, keep `HashRouter`, `<应用 />`, `<换壳遮罩看守 />`, and `<标注层 />` inside the device frame:

```tsx
const 启用标注 = import.meta.env.VITE_ANNOTATION_ENABLED === 'true';

{启用标注 ? (
  <div className={标注样式.评审布局}>
    <div className={标注样式.应用槽}>
      <设备外框 填满父级>
        <HashRouter>
          <应用 />
          <换壳遮罩看守 />
          <标注层 />
        </HashRouter>
      </设备外框>
    </div>
    <div className={标注样式.工具占位} aria-hidden />
  </div>
) : (
  <设备外框>
    <HashRouter>
      <应用 />
      <换壳遮罩看守 />
    </HashRouter>
  </设备外框>
)}
```

Retain the existing `<换壳遮罩看守 />` sibling immediately after `<应用 />` in both branches. When disabled, do not render `<标注层>` at all.

- [ ] **Step 4: Remove E2E collision workarounds and run green**

If an existing annotation-specific mouse-coordinate clamp avoids the launcher, replace it with the target's actual center now that layout owns a separate lane. Run:

```bash
npm run test:e2e:data-source -- --grep "标注模式不遮挡技能添加"
npm run build
```

Expected: physical click succeeds with annotation enabled; the default build exits 0 with the annotation gate off.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/组件/标注层.tsx src/组件/标注层.module.css src/组件/设备外框.tsx src/组件/设备外框.module.css playwright.数据源模式.config.ts e2e/数据源模式.spec.ts
git commit -m "fix: keep annotation tools outside app controls"
```

### Task 8: Prove the complete Backend onboarding closure with a strict mutable fixture

**Files:**
- Modify: `e2e/数据源模式.spec.ts`

**Interfaces:**
- Consumes: all Tasks 1–7, existing BFF route installer, `Onboarding流程`, and the deployed nullable-year wire contract.
- Produces: an opt-in isolated fixture that records exact mutations, returns authoritative snapshots, rejects unknown request bodies, and one visible-UI closure test.

- [ ] **Step 1: Add a fresh mutable fixture and strict body validators**

Add an opt-in field to `BFF路由选项` rather than changing shared static fixtures:

```ts
import type { BFF简历, BFFOwnerIntention } from '../src/数据/BFF契约';
```

```ts
type 记录的Mutation = { method: string; path: string; body: unknown };

interface 候选OnboardingFixture {
  resume: BFF简历;
  intentions: BFFOwnerIntention[];
  mutations: 记录的Mutation[];
}

function 创建候选OnboardingFixture(): 候选OnboardingFixture {
  return {
    resume: {
      ...(structuredClone(fixture简历) as BFF简历),
      profile: {
        real_name: '',
        work_start_year: null,
        status: '',
        current_education: null,
        graduation_year: null,
        gender: null,
        birth_year: null,
        birth_month: null,
      },
      summary: '',
      skills: [],
      experiences: [],
      educations: [],
      certificates: [],
    },
    intentions: [],
    mutations: [],
  };
}
```

If Playwright's TypeScript target lacks `structuredClone`, use the file's existing deep-clone helper; do not share state with `fixture简历`.

Add closed validators that compare `Object.keys(body).sort()` against each endpoint's allowed keys. Certificate validation must include:

```ts
function 断言证书写入(body: unknown): asserts body is { name: string; year: number | null } {
  expect(body).toBeTruthy();
  expect(Object.keys(body as object).sort()).toEqual(['name', 'year']);
  const value = body as { name: unknown; year: unknown };
  expect(typeof value.name).toBe('string');
  expect(Object.prototype.hasOwnProperty.call(value, 'year')).toBe(true);
  expect(value.year === null || (
    Number.isInteger(value.year) && Number(value.year) >= 1900 && Number(value.year) <= 2100
  )).toBe(true);
}
```

Do the same for skills, experience, education, profile/summary when mutated, and intention. Reject unknown keys. Each accepted mutation appends `{ method, path, body }`, updates only this fixture, increments relevant revisions, and makes later GETs return the updated state. Credentials return a unique masked `phone_otp.display` for the personal-page projection.

- [ ] **Step 2: Add the failing full-flow E2E**

Create a Backend-tagged test named `候选 onboarding 完整保存并创建首次意向`. Install the mutable fixture with an authenticated subject whose `last_used_role` is `null`, then use visible navigation only:

1. Start at `/`, wait for redirect to identity, click `我要找工作`.
2. On `完善资料`, choose `已毕业`, retain `社招全职`, choose at least one office mode, open `选择工作城市`, search/select the fixture location, return through that page's visible save/back action, then open `选择期望职位`, search/select the fixture job category, and return visibly.
3. Click `下一步`, set the salary wheels to 30 and 40 using their `最低月薪`/`最高月薪` accessible names, and click `下一步`.
4. Fill `身份证上的名字`; proceed through `现在是什么状态？`, choose `在职 · 考虑机会`; choose the fixture degree; type/select the fixture school and major; complete the date wheels through their visible `完成`/`下一步` actions.
5. On `在线简历`, click `添加工作经历`, fill company/title/start date, select the fixture industry, and finish the editor. Type `Go` in `如：Go、分布式事务` and click its sibling `添加`. Type `CET-4` in `证书或语言，如 CPA、雅思 7.0` and click its sibling `添加`. Click `保存` and wait for the next screen.
6. Complete `哪些情况直接排除？` with its visible `下一步`, fill `个人优势`, and click `保存并继续`. Continue via `完成设置，开始匹配` and `完成注册`; do not call `page.goto` between onboarding pages.
7. Assert one intention POST was recorded. Reload through `page.reload()`, open `我的简历` via visible UI, and assert the fixture-backed resume shows the experience, skill, education, and certificate. The certificate fixture retains `year: null`; the UI must not contain text `'null'`.
8. Use `page.goBack()` and `page.goForward()` around an onboarding-history point retained before completion, then assert the salary projection/controls still represent 30–40K. If completion deliberately replaces history, make this assertion immediately before the final disclosure/avatar steps, where both entries still exist; do not synthesize URLs.

Use the exact visible labels listed in steps 1–6 (`我要找工作`, `已毕业`, `保存`, `下一步`, `身份证上的名字`, `在职 · 考虑机会`, `添加工作经历`, both input placeholders, `保存并继续`, `完成设置，开始匹配`, and `完成注册`). Locate result cards by the fixture `display_name`. Do not introduce test IDs merely to bypass the UI.

- [ ] **Step 3: Assert exact mutation counts and authoritative state**

At the end of the test, derive counts from `fixture.mutations` and assert:

```ts
expect(次数('POST', '/api/v1/me/resume/experiences')).toBe(1);
expect(次数('PATCH', '/api/v1/me/resume/skills')).toBe(1);
expect(次数('POST', '/api/v1/me/resume/certificates')).toBe(1);
expect(次数('POST', '/api/v1/me/resume/educations')).toBe(1);
expect(次数('POST', '/api/v1/me/intentions')).toBe(1);
expect(证书Mutation.body).toEqual({ name: 'CET-4', year: null });
expect(fixture.resume.experiences).toHaveLength(1);
expect(fixture.resume.skills).toEqual(['Go']);
expect(fixture.resume.educations).toHaveLength(1);
expect(fixture.resume.certificates).toEqual([
  expect.objectContaining({ name: 'CET-4', year: null }),
]);
expect(fixture.intentions).toHaveLength(1);
expect(fixture.intentions[0]?.status).toBe('active');
```

Also record request order and assert the last `/api/v1/me/resume` request is `GET`. Make the fixture's GET counter prove reload requested both authoritative resume and intentions rather than reusing local state.

- [ ] **Step 4: Run focused red/green and repair only product-code defects revealed by the flow**

First run before completing fixture mutations:

```bash
npm run test:e2e:data-source -- --grep "候选 onboarding 完整保存并创建首次意向"
```

Expected red: an unsupported mutation, missing strict body field, or lost navigation state identifies the exact remaining seam. Complete the fixture and rerun the same command. If it reveals a product defect in Tasks 1–7, return to that task, add the exact focused regression, make the minimal fix, run that task's focused command, and create a separate fix commit before resuming Task 8.

- [ ] **Step 5: Run the full verification matrix**

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e:data-source
```

Every command must exit 0. Capture the focused red reason, focused green result, full command exit status, exact five mutation counts, final authoritative resume section counts, one active intention, and certificate `year: null` in the completion report. State explicitly that real-service integration remains conditional on the joint Recruitment/BFF nullable baseline and that the parser invalid-output issue was not changed.

- [ ] **Step 6: Commit**

```bash
git add e2e/数据源模式.spec.ts
git commit -m "test: cover candidate onboarding persistence"
```

## Completion Report

The implementing agent must return:

- the approved certificate contract: required `year`, value `number | null`, name-only writes `null`;
- files and commit hash for each task;
- focused red and green evidence for every task;
- exit status for `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e:data-source`;
- exact final mutation counts for experience, skills, certificate, education, and intention;
- authoritative reload state, including certificate `year: null` and exactly one active intention;
- whether real Recruitment/BFF nullable-contract integration was actually available and tested;
- the explicit statement that PDF parser invalid-output handling remains an independent backend item.
