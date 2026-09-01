# Employer Onboarding P0 Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a brand-new recruiter complete the service-backed profile and first-job onboarding flow, then recover the authoritative recruiter state after refresh without false loading, false verification, machine error copy, or disabled zoom.

**Architecture:** Keep recruiter profile, affiliations, organization, and jobs service-authoritative. Model the recruiter profile resource and the complete organization hydration chain with separate closed runtime phases, reuse the existing profile PATCH CAS with revision `0`, and validate all user-correctable JobCreate text before the request. This Plan consumes the candidate-onboarding branch's shared validation and persistence interfaces; it does not reimplement or weaken them.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Vite 8, Vitest 4, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-01-employer-onboarding-repair-design.md`

## Global Constraints

- Execute only after the implementation of `fix/candidate-onboarding-backend-persist` has been merged into this worktree; record its final implementation commit before changing product code.
- Before Task 1, compare the merged versions of `src/数据/HTTP客户端.ts`, `src/数据/后端映射.ts`, `src/状态/应用状态.tsx`, and `e2e/数据源模式.spec.ts` with the predecessor handoff. Stop for plan recalibration if `客户端校验错误(field, message)`, `必需引用(value, label, field)`, candidate-only scoped draft persistence, `VITE_ANNOTATION_ENABLED`, or the candidate mutable fixture contract changed semantically.
- `VITE_DATA_SOURCE=backend` failures must never fall back to Mock.
- Only `BFF错误` with `status === 404 && code === 'not_found'` means a missing recruiter profile; every other profile failure remains a failure.
- Recruiter onboarding completion is profile existence, never job count.
- The first profile write is `PATCH /api/v1/recruiter/profile` with `If-Match: "0"`; do not add a profile POST.
- An unverified company claim remains account-scoped local state and follows all existing logout, 401, role-transfer, and subject-transfer clearing boundaries.
- `hiring_organization_claim.display_name`, `description`, and `requirements` must be independently non-blank after trimming before JobCreate is sent.
- The company-claim preflight is Backend-only; Mock continues to use `企业认证.公司` and its existing publish flow.
- Catalog writes preserve the predecessor's selected `{ id, display_name }` contract; never infer or invent a Catalog ID.
- Keep the current deployed office-address contract in this Plan: remote, onsite, and hybrid all require a non-blank address. Remote empty-address behavior and JD PDF import belong to the gated follow-up Plan.
- Preserve `VITE_ANNOTATION_ENABLED` behavior. The viewport change only restores zoom and must not re-enable annotation UI by default.
- Follow TDD in every task: add the regression, run and record the expected failure, implement the minimum change, rerun focused tests, and commit.

---

## Baseline and File Map

Run these read-only checks before Task 1:

```bash
git status --short
git log -1 --format='%H %s'
git log --oneline --all --grep='candidate onboarding' -10
git diff --check
npm ci
```

Expected: a clean worktree, the predecessor implementation commit is reachable from `HEAD`, `git diff --check` exits `0`, and `npm ci` exits `0`. The earlier planning baseline had no installed `vitest`; do not accept exit `127` as a product RED.

| File | Responsibility in this repair |
| --- | --- |
| `src/状态/后端/类型.ts` | Closed recruiter profile and organization hydration states; organization retry operation |
| `src/状态/应用状态.tsx`, `src/状态/应用状态.test.ts` | Runtime seeds and reset behavior without disturbing candidate persistence |
| `src/状态/后端/组织操作.ts`, tests | Missing-profile hydration, full-chain phase/error, retry, revision-zero first write |
| `src/状态/后端/会话操作.ts`, tests | Recruiter organization-before-jobs orchestration and error propagation |
| `src/数据/招聘数据源/组织.ts`, tests | PATCH CAS request, including explicit revision zero |
| `src/应用.tsx`, `src/应用.test.tsx` | Deterministic recruiter onboarding route guard |
| `src/屏幕/选身份.tsx`, tests | Explicit recruiter registration-flow navigation state |
| `src/屏幕/招聘名片.tsx`, tests | Controlled company claim and atomic profile/company save |
| `src/状态/后端/岗位操作.ts`, tests | Final non-blank hiring-organization claim protection |
| `src/数据/后端映射.ts`, tests | Independent trimmed description/requirements/claim contract |
| `src/屏幕/发布岗位.tsx`, tests | Requirements input, preflight, field-error localization |
| `src/屏幕/公司档案编辑.tsx`, tests | Organization list loading/error/empty/select/profile states |
| `src/屏幕/公司档案分区编辑.tsx`, tests | The same guard for deep-linked section editing |
| `src/数据/组织映射.ts`, tests | Truthful organization verification display projection |
| `src/屏幕/企业设置.tsx`, tests | Render the authoritative verification projection |
| `src/数据/HTTP客户端.ts`, tests | Preserve field errors and distinguish network/local/server validation errors |
| `src/屏幕/账号安全.tsx`, tests | Role-neutral export copy |
| `index.html`, `README.md`, `src/配置/viewport合同.test.ts` | Zoom contract and documentation |
| `e2e/onboarding.spec.ts`, `e2e/数据源模式.spec.ts` | Full real-data-source-shaped recruiter onboarding regression |

### Task 1: Model missing recruiter profiles and the complete organization hydration lifecycle

**Files:**
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `src/状态/后端/组织操作.ts`
- Modify: `src/状态/后端/组织操作.test.ts`
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/后端/会话操作.test.ts`

**Interfaces:**
- Consumes: existing `BFF错误`, `水合招聘方组织数据(...)`, subject/generation fences, `清账号状态(deps)`, and the predecessor's candidate-only persistence/reset behavior.
- Produces: `招聘方档案水合阶段`, `招聘方组织水合状态`, `创建空招聘方组织水合状态()`, and `组织操作.重新水合招聘方组织(): Promise<void>` for Tasks 2, 5, and 7.

- [ ] **Step 1: Write failing organization-operation regressions**

In `src/状态/后端/组织操作.test.ts`, reuse the file's dependency factory and add cases equivalent to the following. Keep the existing subject/generation stale tests and add phase assertions to them.

```ts
it('profile 404/not_found 是缺失态，仍读取 affiliations，无 current 时不读公开企业', async () => {
  const deps = 建依赖();
  deps.后端.读取招聘方档案 = vi.fn().mockRejectedValue(
    new BFF错误(404, 'not_found', 'Recruiter profile not found'),
  );
  deps.后端.读取我的企业关系 = vi.fn().mockResolvedValue([]);
  deps.后端.读取公开企业 = vi.fn();

  await expect(水合招聘方组织数据(deps, 'subject-1', 7, null))
    .resolves.toEqual({ sessionExpired: false });

  expect(deps.后端.读取我的企业关系).toHaveBeenCalledTimes(1);
  expect(deps.后端.读取公开企业).not.toHaveBeenCalled();
  expect(deps.派发).toHaveBeenCalledWith({ 型: '水合招聘方档案', 档案: null });
  expect(deps.设后端状态).toHaveProducedState(expect.objectContaining({
    招聘方档案水合阶段: '缺失',
    招聘方组织水合: { 阶段: '成功', 错误: null },
  }));
});

it.each([
  new BFF错误(500, 'internal_error', '读取失败'),
  new BFF错误(503, 'service_unavailable', '暂不可用'),
])('profile 非 404 错误保留失败态并 reject', async (错误) => {
  const deps = 建依赖();
  deps.后端.读取招聘方档案 = vi.fn().mockRejectedValue(错误);
  await expect(水合招聘方组织数据(deps, 'subject-1', 7, null)).rejects.toBe(错误);
  expect(deps.后端.读取我的企业关系).not.toHaveBeenCalled();
  expect(deps.设后端状态).toHaveProducedState(expect.objectContaining({
    招聘方档案水合阶段: '失败',
    招聘方组织水合: expect.objectContaining({ 阶段: '失败' }),
  }));
});

it('profile 401 统一清账号且不继续 affiliations', async () => {
  const deps = 建依赖();
  deps.后端.读取招聘方档案 = vi.fn().mockRejectedValue(
    new BFF错误(401, 'invalid_session', 'expired'),
  );
  await expect(水合招聘方组织数据(deps, 'subject-1', 7, null))
    .resolves.toEqual({ sessionExpired: true });
  expect(deps.后端.读取我的企业关系).not.toHaveBeenCalled();
  expect(deps.派发).toHaveBeenCalledWith({ 型: '清后端组织状态' });
  expect(deps.设后端状态).toHaveProducedState(expect.objectContaining({
    招聘方档案水合阶段: '未开始',
    招聘方组织水合: { 阶段: '未开始', 错误: null },
  }));
});

it('profile 缺失后 affiliations 失败只让聚合链失败，不改写为缺失成功', async () => {
  const deps = 建依赖();
  deps.后端.读取招聘方档案 = vi.fn().mockRejectedValue(
    new BFF错误(404, 'not_found', 'missing'),
  );
  deps.后端.读取我的企业关系 = vi.fn().mockRejectedValue(
    new BFF错误(503, 'service_unavailable', 'affiliations down'),
  );
  await expect(水合招聘方组织数据(deps, 'subject-1', 7, null))
    .rejects.toMatchObject({ status: 503 });
  expect(deps.设后端状态).toHaveProducedState(expect.objectContaining({
    招聘方档案水合阶段: '缺失',
    招聘方组织水合: expect.objectContaining({ 阶段: '失败' }),
  }));
});

it('有 current 时公开企业读取失败进入聚合失败', async () => {
  const deps = 建依赖();
  deps.后端.读取招聘方档案 = vi.fn().mockResolvedValue(已有档案);
  deps.后端.读取我的企业关系 = vi.fn().mockResolvedValue([verified关系]);
  deps.后端.读取公开企业 = vi.fn().mockRejectedValue(
    new BFF错误(500, 'internal_error', 'organization down'),
  );
  await expect(水合招聘方组织数据(deps, 'subject-1', 7, null))
    .rejects.toMatchObject({ status: 500 });
  expect(deps.设后端状态).toHaveProducedState(expect.objectContaining({
    招聘方档案水合阶段: '成功',
    招聘方组织水合: expect.objectContaining({ 阶段: '失败' }),
  }));
});
```

If the test harness lacks `toHaveProducedState`, use the existing captured updater pattern:

```ts
const 当前 = 建后端状态();
for (const [更新] of vi.mocked(deps.设后端状态).mock.calls) Object.assign(当前, 更新(当前));
expect(当前.招聘方档案水合阶段).toBe('缺失');
```

- [ ] **Step 2: Write failing session-orchestration and reset regressions**

Add these cases to `src/状态/后端/会话操作.test.ts` and `src/状态/应用状态.test.ts` using their existing provider/dependency helpers:

```ts
it('招聘方 profile 缺失时 jobs 在完整组织链成功后读取，交互切身份 resolve', async () => {
  const deps = 建会话依赖({
    读取招聘方档案: vi.fn().mockRejectedValue(new BFF错误(404, 'not_found', 'missing')),
    读取我的企业关系: vi.fn().mockResolvedValue([]),
    读取岗位: vi.fn().mockResolvedValue(空岗位快照),
  });
  await expect(水合角色数据(deps, 招聘主体, true, 4)).resolves.toBe(false);
  expect(deps.后端.读取岗位).toHaveBeenCalledTimes(1);
});

it.each([500, 503])('招聘方组织链 %i 失败时不读取 jobs 且交互调用 reject', async (status) => {
  const deps = 建会话依赖({
    读取招聘方档案: vi.fn().mockRejectedValue(new BFF错误(status, 'service_error', '失败')),
    读取岗位: vi.fn(),
  });
  await expect(水合角色数据(deps, 招聘主体, true, 4)).rejects.toBeInstanceOf(BFF错误);
  expect(deps.后端.读取岗位).not.toHaveBeenCalled();
});

it('登出、401 与主体切换把招聘方两个阶段恢复到未开始', async () => {
  const { result, rerender } = 渲染BackendProvider();
  act(() => result.current.设招聘方阶段用于测试({
    招聘方档案水合阶段: '成功',
    招聘方组织水合: { 阶段: '失败', 错误: '上个账号错误' },
  }));
  await act(() => result.current.操作.退出登录());
  expect(result.current.后端状态).toMatchObject({
    招聘方档案水合阶段: '未开始',
    招聘方组织水合: { 阶段: '未开始', 错误: null },
  });
  expect(result.current.状态.未认证公司声明).toBe('');
  rerender(<应用状态提供者 数据源={另一个主体数据源} />);
  expect(result.current.后端状态.招聘方档案水合阶段).toBe('未开始');
});
```

Adapt only helper names to the current test harness. Do not add a production-only testing setter; drive provider resets through the existing actions or export the pure empty-state factory.

- [ ] **Step 3: Run focused tests and record the RED**

```bash
npm test -- src/状态/后端/组织操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
```

Expected: FAIL because the two recruiter hydration fields and 404 branch do not exist, and current mount organization errors may be swallowed before the jobs decision.

- [ ] **Step 4: Add the closed types, seed, and reset values**

Add to `src/状态/后端/类型.ts`:

```ts
export type 招聘方档案水合阶段 = '未开始' | '进行中' | '缺失' | '成功' | '失败';

export interface 招聘方组织水合状态 {
  阶段: '未开始' | '进行中' | '成功' | '失败';
  错误: string | null;
}

export function 创建空招聘方组织水合状态(): Pick<
  后端状态,
  '招聘方档案水合阶段' | '招聘方组织水合'
> {
  return {
    招聘方档案水合阶段: '未开始',
    招聘方组织水合: { 阶段: '未开始', 错误: null },
  };
}
```

Add the fields to `后端状态` and the retry method to `组织操作`:

```ts
招聘方档案水合阶段: 招聘方档案水合阶段;
招聘方组织水合: 招聘方组织水合状态;

重新水合招聘方组织(): Promise<void>;
```

Spread `...创建空招聘方组织水合状态()` into the Backend state initializer in `src/状态/应用状态.tsx` and every Backend reset object in `src/状态/后端/会话操作.ts`. Keep every candidate-draft cleanup call and its existing ordering intact.

- [ ] **Step 5: Implement the missing-profile branch and aggregate result**

Replace the top-level organization hydration body in `src/状态/后端/组织操作.ts` with this shape, retaining the existing subject/generation fence:

```ts
export async function 水合招聘方组织数据(
  deps: 组织水合依赖,
  subjectId: string,
  generation: number,
  restoredAffiliationId: string | null,
): Promise<{ sessionExpired: boolean }> {
  const 仍有效 = () => deps.主体标识引用.current === subjectId && deps.会话代际.current === generation;
  deps.设后端状态((旧) => ({
    ...旧,
    招聘方档案水合阶段: '进行中',
    招聘方组织水合: { 阶段: '进行中', 错误: null },
  }));
  try {
    try {
      const profile = await deps.后端.读取招聘方档案();
      if (!仍有效()) return { sessionExpired: false };
      deps.派发({ 型: '水合招聘方档案', 档案: profile });
      deps.设后端状态((旧) => ({ ...旧, 招聘方档案水合阶段: '成功' }));
    } catch (error) {
      if (!仍有效()) return { sessionExpired: false };
      if (error instanceof BFF错误 && error.status === 404 && error.code === 'not_found') {
        deps.派发({ 型: '水合招聘方档案', 档案: null });
        deps.设后端状态((旧) => ({ ...旧, 招聘方档案水合阶段: '缺失' }));
      } else {
        throw error;
      }
    }

    const affiliations = await deps.后端.读取我的企业关系();
    if (!仍有效()) return { sessionExpired: false };
    const currentId = 选择当前企业关系(affiliations, restoredAffiliationId);
    deps.派发({ 型: '水合企业关系', 关系: affiliations, 当前编号: currentId });
    if (currentId) {
      const relation = affiliations.find((item) => item.affiliation_id === currentId)!;
      const organization = await deps.后端.读取公开企业(relation.organization_id);
      if (!仍有效()) return { sessionExpired: false };
      const { profile, ...identity } = organization;
      deps.派发({ 型: '水合当前企业', 身份: identity, 档案: profile });
    }
    if (仍有效()) deps.设后端状态((旧) => ({
      ...旧,
      招聘方组织水合: { 阶段: '成功', 错误: null },
    }));
    return { sessionExpired: false };
  } catch (error) {
    if (!仍有效()) return { sessionExpired: false };
    if (error instanceof BFF错误 && error.status === 401) {
      清账号状态(deps);
      return { sessionExpired: true };
    }
    const 错误 = 取后端错误文案(error);
    deps.设后端状态((旧) => ({
      ...旧,
      招聘方档案水合阶段:
        旧.招聘方档案水合阶段 === '进行中' ? '失败' : 旧.招聘方档案水合阶段,
      招聘方组织水合: { 阶段: '失败', 错误 },
    }));
    throw error;
  }
}
```

Do not swallow or toast non-401 errors in this helper. Remove its old `interactive` parameter and update the `水合角色数据` call site to pass four arguments. In `水合角色数据`, keep the outer `Promise.allSettled`, do not call `读取岗位()` after a rejected organization result, show one mount error there, and continue to throw the first error only in interactive mode.
Remove the now-unused `轻提示` import from `组织操作.ts` and update its header comment so mount/interactive presentation is owned by `水合角色数据`.

```ts
const organizationResult = await 水合招聘方组织数据(
  deps,
  主体.subject_id,
  generation,
  restoredId,
);
if (organizationResult.sessionExpired) return organizationResult;
return { sessionExpired: false, 岗位快照: await 后端.读取岗位() };
```

- [ ] **Step 6: Add the retry operation**

Inside `创建组织操作`, add:

```ts
async 重新水合招聘方组织() {
  if (!是后端 || !后端) return;
  const subjectId = deps.主体标识引用.current;
  if (!subjectId) throw new 客户端校验错误('recruiter.organization', '登录状态已失效，请重新登录');
  const generation = deps.会话代际.current;
  const restoredId = deps.读取恢复企业关系编号(subjectId);
  const result = await 水合招聘方组织数据(deps, subjectId, generation, restoredId);
  if (result.sessionExpired) throw new 客户端校验错误('session', '登录状态已失效，请重新登录');
},
```

Import the predecessor-provided `客户端校验错误` from `../../数据/HTTP客户端`.

- [ ] **Step 7: Run focused tests and commit**

```bash
npm test -- src/状态/后端/组织操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
git diff --check
git add src/状态/后端/类型.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts src/状态/后端/组织操作.ts src/状态/后端/组织操作.test.ts src/状态/后端/会话操作.ts src/状态/后端/会话操作.test.ts
git commit -m "fix: model missing recruiter profiles"
```

Expected: all focused tests PASS and both checks exit `0`.

### Task 2: Support revision-zero profile creation and deterministic recruiter routing

**Files:**
- Modify: `src/数据/招聘数据源/组织.ts`
- Modify: `src/数据/招聘数据源/组织.test.ts`
- Modify: `src/状态/后端/组织操作.ts`
- Modify: `src/状态/后端/组织操作.test.ts`
- Modify: `src/应用.tsx`
- Create: `src/应用.test.tsx`
- Modify: `src/屏幕/选身份.tsx`
- Modify: `src/屏幕/选身份.test.tsx`

**Interfaces:**
- Consumes: Task 1's two recruiter hydration fields and the predecessor's `客户端校验错误`.
- Produces: revision-zero profile creation and a single recruiter route guard consumed by the card flow and E2E.

- [ ] **Step 1: Add failing data-source and operation regressions**

In `src/数据/招聘数据源/组织.test.ts`, add:

```ts
it('显式 revision 0 仍使用 PATCH 和 If-Match 0', async () => {
  fetchMock.mockResolvedValueOnce(成功信封({
    public_name: '林澈', title: '招聘负责人', personal_verification_status: 'unverified', revision: 1,
  }));
  await 创建组织数据源(客户端).保存招聘方档案(
    { public_name: '林澈', title: '招聘负责人' },
    0,
  );
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/v1\/recruiter\/profile$/),
    expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ 'If-Match': '"0"' }) }),
  );
});
```

In `src/状态/后端/组织操作.test.ts`, add:

```ts
it('缺失 profile 首写使用 revision 0，并进入成功态', async () => {
  const deps = 建依赖({
    招聘方档案: null,
    招聘方档案水合阶段: '缺失',
  });
  deps.后端.保存招聘方档案 = vi.fn().mockResolvedValue({
    public_name: '林澈', title: '招聘负责人', personal_verification_status: 'unverified', revision: 1,
  });
  const result = await 创建组织操作(deps).保存招聘方档案({ public_name: '林澈', title: '招聘负责人' });
  expect(deps.后端.保存招聘方档案).toHaveBeenCalledWith(
    { public_name: '林澈', title: '招聘负责人' }, 0,
  );
  expect(result.revision).toBe(1);
  expect(deps.设后端状态).toHaveProducedState(expect.objectContaining({ 招聘方档案水合阶段: '成功' }));
});

it.each(['未开始', '进行中', '失败'] as const)('%s 阶段不盲写 revision 0', async (阶段) => {
  const deps = 建依赖({ 招聘方档案: null, 招聘方档案水合阶段: 阶段 });
  await expect(创建组织操作(deps).保存招聘方档案({ public_name: '林澈', title: '' }))
    .rejects.toMatchObject({ code: 'client_validation', field: 'recruiter.profile' });
  expect(deps.后端.保存招聘方档案).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Add failing route and identity regressions**

Create `src/应用.test.tsx` with a hoisted `use应用状态` mock, `MemoryRouter`, and these table cases:

```tsx
it.each([
  ['缺失', 路径.招聘名片],
  ['成功', 路径.企业主壳],
] as const)('恢复 recruiter 且 profile %s 时进入 %s', async (阶段, expected) => {
  mock应用状态.mockReturnValue(后端应用值({
    初始化: '完成',
    已登录: true,
    主体: { ...招聘主体, last_used_role: 'recruiter' },
    招聘方档案水合阶段: 阶段,
    招聘方组织水合: { 阶段: '成功', 错误: null },
  }));
  render(<MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent(expected));
});

it('组织水合失败在登录路径显示真实错误和重试入口', async () => {
  const retry = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  const value = 后端应用值({
    初始化: '完成', 已登录: true,
    主体: { ...招聘主体, last_used_role: 'recruiter' },
    招聘方档案水合阶段: '失败',
    招聘方组织水合: { 阶段: '失败', 错误: '企业资料读取失败' },
  });
  mock应用状态.mockReturnValue({
    ...value,
    操作: { ...value.操作, 重新水合招聘方组织: retry },
  });
  render(<MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>);
  expect(screen.getByTestId('pathname')).toHaveTextContent(路径.登录);
  expect(screen.getByRole('alert')).toHaveTextContent('企业资料读取失败');
  await user.click(screen.getByRole('button', { name: '重试' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('直接打开招聘端且 profile 缺失时 replace 到注册流名片', async () => {
  mock应用状态.mockReturnValue(后端应用值({
    初始化: '完成', 已登录: true,
    主体: { ...招聘主体, last_used_role: 'recruiter' },
    招聘方档案水合阶段: '缺失',
    招聘方组织水合: { 阶段: '成功', 错误: null },
  }));
  render(<MemoryRouter initialEntries={[路径.岗位管理]}><应用 /><位置与状态探针 /></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent(路径.招聘名片));
  expect(screen.getByTestId('location-state')).toHaveTextContent('从注册流');
});

it('已有 profile 直接编辑招聘名片时不被改送企业主壳', async () => {
  mock应用状态.mockReturnValue(后端应用值({
    初始化: '完成', 已登录: true,
    主体: { ...招聘主体, last_used_role: 'recruiter' },
    招聘方档案水合阶段: '成功',
    招聘方组织水合: { 阶段: '成功', 错误: null },
  }));
  render(<MemoryRouter initialEntries={[路径.招聘名片]}><应用 /><位置探针 /></MemoryRouter>);
  expect(screen.getByTestId('pathname')).toHaveTextContent(路径.招聘名片);
});

it.each([
  路径.账号安全,
  路径.选身份,
  路径.招聘名片,
  路径.企业组织申请,
  路径.企业邀请加入,
])('缺失 profile 时放行恢复与退出路径 %s', (pathname) => {
  mock应用状态.mockReturnValue(后端应用值({
    初始化: '完成', 已登录: true,
    主体: { ...招聘主体, last_used_role: 'recruiter' },
    招聘方档案水合阶段: '缺失',
    招聘方组织水合: { 阶段: '成功', 错误: null },
  }));
  render(<MemoryRouter initialEntries={[pathname]}><应用 /><位置探针 /></MemoryRouter>);
  expect(screen.getByTestId('pathname')).toHaveTextContent(pathname);
});

it('未知或缺失 last_used_role 保持现有身份选择兜底', async () => {
  mock应用状态.mockReturnValue(后端应用值({
    初始化: '完成', 已登录: true,
    主体: { ...招聘主体, last_used_role: undefined },
  }));
  render(<MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent(路径.选身份));
});
```

In `src/屏幕/选身份.test.tsx`, assert:

```tsx
await user.click(screen.getByRole('button', { name: '我要招人' }));
await waitFor(() => expect(mock切身份).toHaveBeenCalledWith('招聘方'));
expect(mock跳转).toHaveBeenCalledWith(路径.招聘名片, { 从注册流: true });
```

- [ ] **Step 3: Run focused tests and record the RED**

```bash
npm test -- src/数据/招聘数据源/组织.test.ts src/状态/后端/组织操作.test.ts src/屏幕/选身份.test.tsx src/应用.test.tsx
```

Expected: the source test may already prove PATCH but the operation and route tests FAIL because missing profiles cannot be written and recruiter navigation ignores hydration phases.

- [ ] **Step 4: Implement revision selection and authoritative phase update**

Keep `src/数据/招聘数据源/组织.ts` on its existing code path:

```ts
async 保存招聘方档案(patch, revision) {
  return 请求JSON('/api/v1/recruiter/profile', {
    method: 'PATCH',
    headers: { 'If-Match': 修订etag(revision) },
    body: JSON.stringify(patch),
  }, 解招聘方档案);
}
```

Do not add a truthiness check around `revision`; `0` is valid. Replace the revision selection in `保存招聘方档案` with:

```ts
const { 招聘方档案: before } = 状态引用.current;
const 阶段 = deps.后端状态引用.current.招聘方档案水合阶段;
const revision = 阶段 === '缺失' && before === null
  ? 0
  : 阶段 === '成功' && before !== null
    ? before.revision
    : null;
if (revision === null) {
  throw new 客户端校验错误('recruiter.profile', '招聘方档案状态尚未就绪，请刷新后重试');
}
const next = await 后端.保存招聘方档案(patch, revision);
deps.派发({ 型: '水合招聘方档案', 档案: next });
deps.设后端状态((旧) => ({ ...旧, 招聘方档案水合阶段: '成功' }));
return next;
```

If `后端操作依赖` does not yet expose `后端状态引用`, add it as `MutableRefObject<后端状态>` and pass the existing provider ref; do not mirror runtime phases into root `状态`.

- [ ] **Step 5: Implement the single route guard and explicit identity navigation**

Replace the recruiter branch of the effect in `src/应用.tsx`. Protect recruiter business routes, but explicitly allow account/identity and recruiter recovery routes:

```tsx
useEffect(() => {
  if (数据源模式 !== 'backend' || 后端状态.初始化 !== '完成' || !后端状态.已登录) return;
  const role = 后端状态.主体?.last_used_role;
  if (role === 'candidate' && 位置.pathname === 路径.登录) {
    前往(路径.主壳, { replace: true });
    return;
  }
  if (role !== 'candidate' && role !== 'recruiter' && 位置.pathname === 路径.登录) {
    前往(路径.选身份, { replace: true });
    return;
  }
  if (role !== 'recruiter' || 后端状态.招聘方组织水合.阶段 !== '成功') return;
  if (后端状态.招聘方档案水合阶段 === '缺失') {
    const allowed = new Set([
      路径.招聘名片,
      路径.企业组织申请,
      路径.企业邀请加入,
    ]);
    const recruiterBusinessRoute = 位置.pathname === 路径.企业主壳 ||
      位置.pathname.startsWith(`${路径.企业主壳}/`);
    if (位置.pathname === 路径.登录 || (recruiterBusinessRoute && !allowed.has(位置.pathname))) {
      前往(路径.招聘名片, { replace: true, state: { 从注册流: true } });
    }
    return;
  }
  if (后端状态.招聘方档案水合阶段 === '成功' && 位置.pathname === 路径.登录) {
    前往(路径.企业主壳, { replace: true });
  }
}, [数据源模式, 后端状态, 位置.pathname, 前往]);
```

Destructure `操作` from `use应用状态()` and add the failure recovery surface before the loading/auth guards:

```tsx
function 招聘方恢复失败({ error, retry }: { error: string | null; retry: () => Promise<void> }) {
  const [重试中, 设重试中] = useState(false);
  return (
    <div role="alert">
      <p>{error ?? '企业资料读取失败'}</p>
      <button
        type="button"
        disabled={重试中}
        onClick={() => {
          if (重试中) return;
          设重试中(true);
          void retry().finally(() => 设重试中(false));
        }}
      >
        {重试中 ? '重试中…' : '重试'}
      </button>
    </div>
  );
}

if (
  数据源模式 === 'backend' &&
  后端状态.初始化 === '完成' &&
  后端状态.已登录 &&
  后端状态.主体?.last_used_role === 'recruiter' &&
  后端状态.招聘方组织水合.阶段 === '失败' &&
  位置.pathname === 路径.登录
) {
  return (
    <招聘方恢复失败
      error={后端状态.招聘方组织水合.错误}
      retry={操作.重新水合招聘方组织}
    />
  );
}
```

Import `useState` alongside `useEffect`. The retry operation owns its error-state update; this component only owns button single-flight state.

In `src/屏幕/选身份.tsx`, replace only the recruiter success navigation:

```ts
await 操作.切身份('招聘方');
跳转(路径.招聘名片, { 从注册流: true });
```

- [ ] **Step 6: Run focused tests and commit**

```bash
npm test -- src/数据/招聘数据源/组织.test.ts src/状态/后端/组织操作.test.ts src/屏幕/选身份.test.tsx src/应用.test.tsx
git diff --check
git add src/数据/招聘数据源/组织.ts src/数据/招聘数据源/组织.test.ts src/状态/后端/类型.ts src/状态/后端/组织操作.ts src/状态/后端/组织操作.test.ts src/应用.tsx src/应用.test.tsx src/屏幕/选身份.tsx src/屏幕/选身份.test.tsx
git commit -m "fix: create and resume recruiter profiles"
```

Expected: all focused tests PASS; existing-profile card edits stay on the card because only the login path is redirected to `/hr`.

### Task 3: Save the recruiter card and company claim atomically

**Files:**
- Modify: `src/屏幕/招聘名片.tsx`
- Modify: `src/屏幕/招聘名片.test.tsx`

**Interfaces:**
- Consumes: Task 2's revision-aware `保存招聘方档案`, `location.state.从注册流`, existing avatar CAS method, and root-state `未认证公司声明`.
- Produces: a controlled company field and single-flight card save that the first-job flow and Task 7 E2E consume.

- [ ] **Step 1: Add failing card-save regressions**

Extend the Backend fixture factory in `src/屏幕/招聘名片.test.tsx` so it can set `招聘方档案: null`, `招聘方档案水合阶段: '缺失'`, no affiliations, and operation mocks. Add:

```tsx
it('缺失 profile 不触发 blur 也会同步公司声明、保存 profile 并进入发岗', async () => {
  mock保存招聘方档案.mockResolvedValue({
    public_name: '林澈', title: '招聘负责人', personal_verification_status: 'unverified', revision: 1,
  });
  后端状态值 = 建后端状态({ 招聘方档案水合阶段: '缺失' });
  根状态值 = 建根状态({ 招聘方档案: null, 企业关系列表: [], 未认证公司声明: '' });
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[{ pathname: 路径.招聘名片, state: { 从注册流: true } }]}>
      <招聘名片 />
    </MemoryRouter>,
  );
  await user.clear(screen.getByLabelText('姓名'));
  await user.type(screen.getByLabelText('姓名'), '  林澈  ');
  await user.type(screen.getByLabelText('职务'), '  招聘负责人  ');
  await user.type(screen.getByLabelText('公司'), '  星河科技  ');
  await user.click(screen.getByRole('button', { name: '保存并继续' }));
  expect(mock保存未认证公司声明).toHaveBeenCalledWith('星河科技');
  expect(mock保存招聘方档案).toHaveBeenCalledWith({ public_name: '林澈', title: '招聘负责人' });
  await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.发布岗位, { 从注册流: true }));
});

it.each([
  { 姓名: '   ', 公司: '星河科技', 文案: '请填写姓名' },
  { 姓名: '林澈', 公司: '   ', 文案: '请填写公司名称' },
])('本地校验失败：$文案，零 mutation', async ({ 姓名, 公司, 文案 }) => {
  const user = userEvent.setup();
  render缺失Profile名片();
  await user.clear(screen.getByLabelText('姓名'));
  await user.type(screen.getByLabelText('姓名'), 姓名);
  await user.type(screen.getByLabelText('公司'), 公司);
  await user.click(screen.getByRole('button', { name: '保存并继续' }));
  expect(mock轻提示).toHaveBeenCalledWith(文案);
  expect(mock保存未认证公司声明).not.toHaveBeenCalled();
  expect(mock保存招聘方档案).not.toHaveBeenCalled();
});

it('保存中禁用按钮且第二次点击不重复提交', async () => {
  const pending = Promise.withResolvers<BFF招聘方档案>();
  mock保存招聘方档案.mockReturnValue(pending.promise);
  const user = userEvent.setup();
  render填写完成的缺失Profile名片();
  const button = screen.getByRole('button', { name: '保存并继续' });
  await user.click(button);
  expect(button).toBeDisabled();
  await user.click(button);
  expect(mock保存招聘方档案).toHaveBeenCalledTimes(1);
  pending.resolve(新档案);
});

it('已有 profile 的普通编辑保存后停留并提示成功', async () => {
  mock保存招聘方档案.mockResolvedValue({ ...已有档案, revision: 3 });
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={[路径.招聘名片]}><招聘名片 /></MemoryRouter>);
  await user.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('保存成功'));
  expect(mock跳转).not.toHaveBeenCalledWith(路径.发布岗位, expect.anything());
});
```

Use `let resolve!: (value: BFF招聘方档案) => void; const pending = new Promise<BFF招聘方档案>(r => { resolve = r; });` if the repository's runtime target does not include `Promise.withResolvers`.

- [ ] **Step 2: Run the focused test and record the RED**

```bash
npm test -- src/屏幕/招聘名片.test.tsx
```

Expected: FAIL because the company field still commits on blur, the save has no validation/busy state, and registration-flow success does not navigate.

- [ ] **Step 3: Implement controlled state, validation, and ordered save**

Import `useLocation` and read the registration marker:

```ts
import { useLocation } from 'react-router-dom';

const location = useLocation();
const 从注册流 = Boolean((location.state as { 从注册流?: boolean } | null)?.从注册流);
```

Replace the blur-only company handling with state synchronized to the current authoritative source:

```ts
const 权威公司 = 身份.currentAffiliation?.organizationName ?? 状态.未认证公司声明;
const [公司, 设公司] = useState(权威公司);
useEffect(() => 设公司(权威公司), [主体标识, 权威公司]);
const 需要公司声明 = 身份.currentAffiliation === null;
const [保存中, 设保存中] = useState(false);
const 保存锁 = useRef(false);
```

Use this save handler, preserving the existing avatar validation and preview cleanup code:

```ts
async function 按下保存() {
  if (保存锁.current) return;
  const publicName = 公开名.trim();
  const title = 职务.trim();
  const company = 公司.trim();
  if (!publicName) {
    轻提示('请填写姓名');
    return;
  }
  if (需要公司声明 && !company) {
    轻提示('请填写公司名称');
    return;
  }
  保存锁.current = true;
  设保存中(true);
  try {
    if (需要公司声明) 操作.保存未认证公司声明(company);
    const 档案 = await 操作.保存招聘方档案({ public_name: publicName, title });
    if (头像文件) {
      await 操作.替换招聘方头像(头像文件, 档案.revision);
      收口预览();
    }
    if (从注册流) 跳转(路径.发布岗位, { 从注册流: true });
    else 轻提示('保存成功');
  } catch (错误) {
    轻提示(取后端错误文案(错误));
  } finally {
    保存锁.current = false;
    设保存中(false);
  }
}
```

Render the unverified company control as a controlled input and keep verified-affiliation selection unchanged:

```tsx
<input
  className={样式.就地输入}
  aria-label="公司"
  value={公司}
  onChange={(事件) => 设公司(事件.target.value)}
  enterKeyHint="done"
/>
```

Set the primary button from the actual flow state:

```tsx
<主按钮
  文字={保存中 ? '保存中…' : 从注册流 ? '保存并继续' : '保存'}
  禁用={保存中}
  按下={按下保存}
/>
```

- [ ] **Step 4: Run the card regressions and commit**

```bash
npm test -- src/屏幕/招聘名片.test.tsx
git diff --check
git add src/屏幕/招聘名片.tsx src/屏幕/招聘名片.test.tsx
git commit -m "fix: persist recruiter card before job creation"
```

Expected: all Backend and frozen Mock card tests PASS; the company save does not depend on blur.

### Task 4: Restore independent requirements and reject incomplete JobCreate bodies

**Files:**
- Modify: `src/状态/后端/岗位操作.ts`
- Modify: `src/状态/后端/岗位操作.test.ts`
- Modify: `src/数据/后端映射.ts`
- Modify: `src/数据/后端映射.test.ts`
- Modify: `src/数据/招聘数据源/岗位.test.ts`
- Modify: `src/屏幕/发布岗位.tsx`
- Modify: `src/屏幕/发布岗位.test.tsx`
- Modify: `e2e/onboarding.spec.ts`

**Interfaces:**
- Consumes: the predecessor's `客户端校验错误` and three-argument `必需引用(value, label, field)`; existing `页面岗位草稿`, `转岗位创建`, and `转岗位补丁`.
- Produces: `取发岗声明(state): 岗位创建上下文`, independent non-blank job text mapping, and a visible `职位要求` textarea.

- [ ] **Step 1: Add failing operation and mapping regressions**

In `src/状态/后端/岗位操作.test.ts`, add:

```ts
it('未认证公司声明为空时在 operation 层拒绝，零发布请求', async () => {
  const deps = 建依赖({ 企业关系列表: [], 当前企业关系编号: null, 未认证公司声明: '   ' });
  await expect(创建岗位操作(deps).发布岗位(页面岗位草稿))
    .rejects.toMatchObject({ code: 'client_validation', field: 'hiring_organization_claim.display_name' });
  expect(deps.后端.创建岗位).not.toHaveBeenCalled();
});

it('verified affiliation 的企业名会 trim 后成为声明', async () => {
  const deps = 建依赖({
    企业关系列表: [{ ...verified关系, organization_display_name: '  星河科技  ' }],
    当前企业关系编号: verified关系.affiliation_id,
  });
  await 创建岗位操作(deps).发布岗位(完整页面岗位草稿);
  expect(deps.后端.创建岗位).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      publisherMode: 'direct',
      hiringOrganizationClaim: { display_name: '星河科技', legal_name: null },
    }),
  );
});
```

In `src/数据/后端映射.test.ts`, add explicit create and patch cases:

```ts
it('JobCreate 独立 trim 公司名、描述和要求，不互相复制', () => {
  const body = 转岗位创建(完整岗位草稿, {
    publisherMode: 'direct',
    hiringOrganizationClaim: { display_name: '  星河科技  ', legal_name: null },
  });
  expect(body).toMatchObject({
    hiring_organization_claim: { display_name: '星河科技', legal_name: null },
    description: '职位描述正文',
    requirements: '职位要求正文',
  });
});

it.each([
  ['职位描述', { 职位描述: '   ', 职位要求: '要求' }, 'description'],
  ['职位要求', { 职位描述: '描述', 职位要求: '   ' }, 'requirements'],
])('%s 为空时不生成 JobCreate', (_label, patch, field) => {
  try {
    转岗位创建({ ...完整岗位草稿, ...patch }, 完整创建上下文);
    expect.unreachable('空白文本必须拒绝');
  } catch (error) {
    expect(error).toMatchObject({ code: 'client_validation', field });
  }
});

it('公司声明为空时 mapper 不生成 JobCreate', () => {
  try {
    转岗位创建(完整岗位草稿, {
      publisherMode: 'direct',
      hiringOrganizationClaim: { display_name: '   ', legal_name: null },
    });
    expect.unreachable('空白公司声明必须拒绝');
  } catch (error) {
    expect(error).toMatchObject({
      code: 'client_validation', field: 'hiring_organization_claim.display_name',
    });
  }
});

it('JobPatch 保持两参 seam，只 trim 用户可编辑的描述和要求', () => {
  const body = 转岗位补丁(
    { ...完整岗位草稿, 职位描述: '  描述  ', 职位要求: '  要求  ' },
    服务端岗位,
  );
  expect(body).toMatchObject({
    hiring_organization_claim: 服务端岗位.hiring_organization_claim,
    description: '描述',
    requirements: '要求',
  });
});
```

Update the existing source-level/data-source test to assert the POST body retains three separate strings and does not set `requirements` from `description`.

- [ ] **Step 2: Add failing page regressions**

In `src/屏幕/发布岗位.test.tsx`, extend the existing Backend happy-path helper to fill both textareas, then add:

```tsx
it('第三步显示独立的职位要求 textarea', async () => {
  const user = userEvent.setup();
  renderBackend发布页();
  await 走到第三步(user, { 职位描述: '描述正文' });
  expect(screen.getByRole('textbox', { name: '职位要求' })).toBeVisible();
});

it('职位要求为空时回到第三步、显示可行动文案且零 mutation', async () => {
  const user = userEvent.setup();
  renderBackend发布页();
  await 走到第三步(user, { 职位描述: '描述正文' });
  await 填完第三步但不填要求(user);
  await user.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
  expect(mock轻提示).toHaveBeenCalledWith('请填写职位要求');
  expect(mock发布岗位).not.toHaveBeenCalled();
});

it('无 verified affiliation 且公司声明为空时零 mutation', async () => {
  根状态值 = 建根状态({ 企业关系列表: [], 当前企业关系编号: null, 未认证公司声明: '   ' });
  const user = userEvent.setup();
  renderBackend发布页();
  await 走完新建岗位(user, { 职位描述: '描述正文', 职位要求: '要求正文' });
  expect(mock轻提示).toHaveBeenCalledWith('请填写公司名称');
  expect(mock发布岗位).not.toHaveBeenCalled();
});

it('Mock 发岗不读取 Backend 专属未认证公司声明', async () => {
  const user = userEvent.setup();
  renderMock发布页({ 未认证公司声明: '', 企业认证: { 姓名: '林澈', 公司: 'Mock 公司' } });
  await 走完新建岗位(user, { 职位描述: '描述正文', 职位要求: '要求正文' });
  await waitFor(() => expect(mock派发).toHaveBeenCalledWith(
    expect.objectContaining({ 型: '发布岗位' }),
  ));
  expect(mock轻提示).not.toHaveBeenCalledWith('请填写公司名称');
});

it('完整表单把独立 description 和 requirements 交给 operation', async () => {
  const user = userEvent.setup();
  renderBackend发布页({ 未认证公司声明: '星河科技' });
  await 走完新建岗位(user, {
    职位描述: '  用户研究、产品验证、产品策略、实验、数据分析、需求执行、GTM、发布与增长  ',
    职位要求: '  应届或毕业年级；有产品、技术、增长或分析经历；关注 AI 与开发工具  ',
  });
  await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
  expect(mock发布岗位.mock.calls[0][0]).toMatchObject({
    职位描述: '用户研究、产品验证、产品策略、实验、数据分析、需求执行、GTM、发布与增长',
    职位要求: '应届或毕业年级；有产品、技术、增长或分析经历；关注 AI 与开发工具',
  });
});
```

- [ ] **Step 3: Run focused tests and record the RED**

```bash
npm test -- src/状态/后端/岗位操作.test.ts src/数据/后端映射.test.ts src/数据/招聘数据源/岗位.test.ts src/屏幕/发布岗位.test.tsx
```

Expected: FAIL because `requirements` has no input, the mapper copies description, and an empty claim can reach the data source.

- [ ] **Step 4: Implement the final claim and mapping guards**

Export and use this helper in `src/状态/后端/岗位操作.ts`:

```ts
export function 取发岗声明(state: 状态): 岗位创建上下文 {
  const relation = state.企业关系列表.find(
    (item) => item.affiliation_id === state.当前企业关系编号 && 可用企业关系(item),
  );
  const displayName = (relation?.organization_display_name ?? state.未认证公司声明).trim();
  if (!displayName) {
    throw new 客户端校验错误(
      'hiring_organization_claim.display_name',
      '请填写公司名称',
    );
  }
  return {
    publisherMode: 'direct',
    hiringOrganizationClaim: { display_name: displayName, legal_name: null },
  };
}
```

Import `岗位创建上下文` from `../../数据/招聘数据源类型`; do not change the `后端.创建岗位(job, context)` seam.

In `src/数据/后端映射.ts`, preserve all predecessor Catalog validation and add:

```ts
function 必需岗位文本(value: string, field: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new 客户端校验错误(field, message);
  return trimmed;
}

function 合法用人企业声明(
  claim: 岗位创建上下文['hiringOrganizationClaim'],
): 岗位创建上下文['hiringOrganizationClaim'] {
  return {
    display_name: 必需岗位文本(
      claim.display_name,
      'hiring_organization_claim.display_name',
      '请填写公司名称',
    ),
    legal_name: claim.legal_name?.trim() || null,
  };
}
```

Set the create fields directly inside `转岗位创建(页面岗位, 上下文)`:

```ts
hiring_organization_claim: 合法用人企业声明(上下文.hiringOrganizationClaim),
description: 必需岗位文本(页面岗位.职位描述, 'description', '请填写职位描述'),
requirements: 必需岗位文本(页面岗位.职位要求, 'requirements', '请填写职位要求'),
```

Delete any `requirements: 页面岗位.职位要求.trim() || 页面岗位.职位描述.trim()` fallback.
Keep `转岗位补丁(页面岗位, previous)` as a two-argument function. Its claim remains the service-owned previous value:

```ts
hiring_organization_claim: {
  display_name: previous.hiring_organization_claim.display_name,
  legal_name: previous.hiring_organization_claim.legal_name ?? null,
},
description: 必需岗位文本(页面岗位.职位描述, 'description', '请填写职位描述'),
requirements: 必需岗位文本(页面岗位.职位要求, 'requirements', '请填写职位要求'),
```

- [ ] **Step 5: Restore the page field and preflight**

Change the requirements state in `src/屏幕/发布岗位.tsx` to:

```ts
const [职位要求, 设职位要求] = useState(编辑目标?.职位要求 ?? '');
```

Add to the third-step component props and render:

```tsx
<label className={样式.多行字段}>
  <span className={样式.字段标签}>职位要求</span>
  <textarea
    aria-label="职位要求"
    value={职位要求}
    onChange={(事件) => 设职位要求(事件.target.value)}
    placeholder="请填写候选人需要具备的经验、能力与条件"
  />
</label>
```

Pass the two props from the page:

```tsx
职位要求={职位要求}
设职位要求={设职位要求}
```

Replace `岗位信息缺失()` with this complete ordered body, retaining both current city guards and limiting the company claim check to Backend mode:

```ts
if (!职位描述.trim()) return { 步骤: 1, 文案: '请填写职位描述' };
if (!职位要求.trim()) return { 步骤: 2, 文案: '请填写职位要求' };
if (!工作城市.trim()) return { 步骤: 2, 文案: '请填写工作城市' };
if (是后端 && !地点引用) return { 步骤: 2, 文案: '请从候选城市中选择' };
const verified = 状态.企业关系列表.some(
  (item) => item.affiliation_id === 状态.当前企业关系编号 && 可用企业关系(item),
);
if (是后端 && !verified && !状态.未认证公司声明.trim()) {
  return { 步骤: 2, 文案: '请填写公司名称' };
}
if (!办公地.trim()) return { 步骤: 2, 文案: '请填写办公地点' };
return null;
```

In `组装岗位`, keep the two independent trimmed assignments exactly:

```ts
职位描述: 职位描述.trim(),
职位要求: 职位要求.trim(),
```

Update `e2e/onboarding.spec.ts` helpers by filling the accessible `职位要求` field with a separate sentence; delete comments asserting the field was removed.

- [ ] **Step 6: Run focused tests and commit**

```bash
npm test -- src/状态/后端/岗位操作.test.ts src/数据/后端映射.test.ts src/数据/招聘数据源/岗位.test.ts src/屏幕/发布岗位.test.tsx
git diff --check
git add src/状态/后端/岗位操作.ts src/状态/后端/岗位操作.test.ts src/数据/后端映射.ts src/数据/后端映射.test.ts src/数据/招聘数据源/岗位.test.ts src/屏幕/发布岗位.tsx src/屏幕/发布岗位.test.tsx e2e/onboarding.spec.ts
git commit -m "fix: submit complete recruiter job contract"
```

Expected: all focused tests PASS and both create and edit preserve separate requirements.

### Task 5: Render truthful organization availability and verification states

**Files:**
- Create: `src/屏幕/招聘方组织门.tsx`
- Modify: `src/屏幕/公司档案编辑.tsx`
- Modify: `src/屏幕/公司档案编辑.test.tsx`
- Modify: `src/屏幕/公司档案分区编辑.tsx`
- Modify: `src/屏幕/公司档案分区编辑.test.tsx`
- Modify: `src/数据/组织映射.ts`
- Modify: `src/数据/组织映射.test.ts`
- Modify: `src/屏幕/企业设置.tsx`
- Modify: `src/屏幕/企业设置.test.tsx`

**Interfaces:**
- Consumes: Task 1's aggregate hydration state and retry operation, existing `可用企业关系`, and existing organization/admin-request DTOs.
- Produces: shared `招聘方组织门` for both organization routes and `取企业认证状态文案(...)` for settings.

- [ ] **Step 1: Add failing page-state and verification regressions**

In both company-page test files, add equivalent Backend cases. The list-page cases are:

```tsx
it('只有真实组织水合在飞时显示加载', () => {
  置Backend应用状态({
    后端状态: { 招聘方组织水合: { 阶段: '进行中', 错误: null } },
    企业档案快照: null,
  });
  render(<MemoryRouter><公司档案编辑 /></MemoryRouter>);
  expect(screen.getByText('正在加载企业资料')).toBeVisible();
});

it('无可用 affiliation 显示两个现有动作，不显示 loading', async () => {
  置Backend应用状态({
    后端状态: { 招聘方组织水合: { 阶段: '成功', 错误: null } },
    企业关系列表: [], 当前企业关系编号: null, 企业档案快照: null,
  });
  const user = userEvent.setup();
  render(<MemoryRouter><公司档案编辑 /></MemoryRouter>);
  expect(screen.queryByText('正在加载企业资料')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '申请成为企业管理员' }));
  expect(mock跳转).toHaveBeenCalledWith(路径.企业组织申请);
  await user.click(screen.getByRole('button', { name: '使用邀请加入企业' }));
  expect(mock跳转).toHaveBeenCalledWith(路径.企业邀请加入);
});

it('组织水合失败显示真实错误并从整条链重试', async () => {
  mock重新水合招聘方组织.mockResolvedValue(undefined);
  置Backend应用状态({
    后端状态: { 招聘方组织水合: { 阶段: '失败', 错误: '企业资料读取失败' } },
    企业档案快照: null,
  });
  const user = userEvent.setup();
  render(<MemoryRouter><公司档案编辑 /></MemoryRouter>);
  expect(screen.getByText('企业资料读取失败')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '重试' }));
  expect(mock重新水合招聘方组织).toHaveBeenCalledTimes(1);
});

it('多个可用关系但 current 为空时引导选择，不显示申请空态', () => {
  置Backend应用状态({
    后端状态: { 招聘方组织水合: { 阶段: '成功', 错误: null } },
    企业关系列表: [verified关系A, verified关系B],
    当前企业关系编号: null, 企业档案快照: null,
  });
  render(<MemoryRouter><公司档案编辑 /></MemoryRouter>);
  expect(screen.getByText('请先选择当前任职企业')).toBeVisible();
  expect(screen.queryByRole('button', { name: '申请成为企业管理员' })).not.toBeInTheDocument();
});
```

Add the same assertions through `渲染分区('basic')` in `公司档案分区编辑.test.tsx`, proving a direct deep link never mounts an empty editable form.

In `src/数据/组织映射.test.ts`, add:

```ts
it.each([
  ['verified current', [verified关系], verified关系.affiliation_id, [], '已认证'],
  ['pending request', [], null, [{ ...申请, status: 'pending' }], '审核中'],
  ['rejected request', [], null, [{ ...申请, status: 'rejected' }], '已拒绝'],
  ['cancelled request', [], null, [{ ...申请, status: 'cancelled' }], '已撤销'],
  ['revoked affiliation', [{ ...verified关系, status: 'revoked' }], null, [], '已解除'],
  ['no organization fact', [], null, [], '未认证'],
] as const)('%s 映射为 %s', (_name, affiliations, currentId, requests, expected) => {
  expect(取企业认证状态文案(affiliations, currentId, requests)).toBe(expected);
});
```

In `src/屏幕/企业设置.test.tsx`, provide `状态` to the existing mock and add `读取企业管理员申请: vi.fn().mockResolvedValue(undefined)` to `操作桩()`. Assert `正在读取` before that promise settles, then assert at least `审核中`, `已认证`, `已拒绝`, `已撤销`, `已解除`, and `未认证` from the corresponding DTO fixtures. Reject the read once and assert `读取失败`; changing only `未认证公司声明` must never produce `已认证`.

- [ ] **Step 2: Run focused tests and record the RED**

```bash
npm test -- src/屏幕/公司档案编辑.test.tsx src/屏幕/公司档案分区编辑.test.tsx src/数据/组织映射.test.ts src/屏幕/企业设置.test.tsx
```

Expected: FAIL because `null` snapshots are always loading, deep links mount empty drafts, and settings hard-code `已认证`.

- [ ] **Step 3: Create the shared organization gate**

Create `src/屏幕/招聘方组织门.tsx`:

```tsx
import type { ReactNode } from 'react';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 可用企业关系 } from '../数据/组织映射';

export default function 招聘方组织门({ children }: { children: ReactNode }) {
  const { 状态, 后端状态, 操作 } = use应用状态();
  const { 跳转 } = use导航();
  const hydration = 后端状态.招聘方组织水合;
  const available = 状态.企业关系列表.filter(可用企业关系);

  if (hydration.阶段 === '未开始' || hydration.阶段 === '进行中') {
    return <div role="status">正在加载企业资料</div>;
  }
  if (hydration.阶段 === '失败') {
    return (
      <div role="alert">
        <p>{hydration.错误 ?? '企业资料读取失败'}</p>
        <button
          type="button"
          onClick={() => void 操作.重新水合招聘方组织().catch(() => undefined)}
        >重试</button>
      </div>
    );
  }
  if (available.length === 0) {
    return (
      <div>
        <p>你还没有可用的已认证企业关系。</p>
        <button type="button" onClick={() => 跳转(路径.企业组织申请)}>申请成为企业管理员</button>
        <button type="button" onClick={() => 跳转(路径.企业邀请加入)}>使用邀请加入企业</button>
      </div>
    );
  }
  if (状态.当前企业关系编号 === null) {
    return (
      <div>
        <p>请先选择当前任职企业</p>
        <button type="button" onClick={() => 跳转(路径.招聘名片)}>前往招聘名片选择</button>
      </div>
    );
  }
  if (状态.企业档案快照 === null || 状态.当前企业身份 === null) {
    return (
      <div role="alert">
        <p>企业资料状态不完整，请重新加载</p>
        <button
          type="button"
          onClick={() => void 操作.重新水合招聘方组织().catch(() => undefined)}
        >重试</button>
      </div>
    );
  }
  return <>{children}</>;
}
```

This component does not synthesize an organization. If retry rejects, Task 1 has already written the aggregate error state; do not add Mock fallback or clear the current profile.

- [ ] **Step 4: Gate both organization screens before consuming a snapshot**

In `公司档案编辑.tsx`, import the gate and wrap the existing authoritative list:

```tsx
<滚动区 样式覆盖={{ padding: '16px 18px calc(24px + var(--安全区下))' }}>
  <招聘方组织门>
    <权威企业分区清单 />
  </招聘方组织门>
</滚动区>
```

Extract the old non-null list body into a local component that asserts the post-gate invariant:

```tsx
function 权威企业分区清单() {
  const { 状态 } = use应用状态();
  const { 跳转 } = use导航();
  const 快照 = 状态.企业档案快照;
  if (!快照) return null;
  const 当前关系 = 状态.企业关系列表.find((条) => 条.affiliation_id === 状态.当前企业关系编号);
  const 可编辑 = 当前关系?.status === 'verified' &&
    当前关系.role === 'admin' && 当前关系.organization_status === 'active';
  return (
    <>
      {!可编辑 ? <div className={样式.分区摘要}>仅企业管理员可修改</div> : null}
      <div className={样式.清单}>
        {分区表.map((分区, 序) => {
          const 状 = 算分区状态(从BFF企业档案(快照), 快照.logo?.url ?? null)[分区.键];
          const 用计数 = 分区.总数 > 1;
          return (
            <button
              key={分区.键}
              className={`${样式.分区行} ${序 === 分区表.length - 1 ? 样式.末条 : ''} 可点`}
              onClick={() => 跳转(路径.公司档案分区(分区.段))}
            >
              <span className={样式.分区名}>{分区.键}</span>
              <span className={样式.分区右}>
                {用计数 ? (
                  <span className={`${样式.分区计数} 等宽数字`}>{状.已填}/{状.总数}</span>
                ) : 状.已填 > 0 ? (
                  <span className={`${样式.分区摘要} 单行`}>{状.摘要}</span>
                ) : (
                  <span className={样式.去添加}>去添加</span>
                )}
                <span className={样式.尖括号}>›</span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
```

Delete the old duplicate `快照 ? ... : 正在加载` branch after introducing this component; the gate now owns non-ready states.

In `公司档案分区编辑.tsx`, split the Backend route before the draft-owning component mounts:

```tsx
function 后端分区入口({ 分区, 返回 }: { 分区: 分区定义; 返回: () => void }) {
  return (
    <招聘方组织门>
      <后端分区编辑 分区={分区} 返回={返回} />
    </招聘方组织门>
  );
}
```

Render `<后端分区入口 ... />` from the mode branch. Remove `空资料()` and initialize the inner editor from the post-gate snapshot:

```ts
const 快照 = 状态.企业档案快照!;
const [资料, 设资料] = useState<资料形>(() => 从BFF企业档案(快照));
const 已初始化 = useRef(true);
```

Retain the existing effect that synchronizes later authoritative media revisions.

- [ ] **Step 5: Add and consume the verification projection**

Add to `src/数据/组织映射.ts`:

```ts
export type 企业认证状态文案 = '未认证' | '审核中' | '已认证' | '已拒绝' | '已撤销' | '已解除';

export function 取企业认证状态文案(
  affiliations: BFF企业关系[],
  currentAffiliationId: string | null,
  requests: BFF企业管理员申请[],
): 企业认证状态文案 {
  const current = affiliations.find((item) => item.affiliation_id === currentAffiliationId);
  if (current && 可用企业关系(current)) return '已认证';
  const latest = requests[0];
  if (latest?.status === 'pending') return '审核中';
  if (latest?.status === 'rejected') return '已拒绝';
  if (latest?.status === 'cancelled') return '已撤销';
  if (affiliations.some((item) => item.status === 'revoked')) return '已解除';
  return '未认证';
}
```

In `src/屏幕/企业设置.tsx`, read root state, hydrate the admin-request resource on entry, and replace the hard-coded value:

```ts
const { 数据源模式, 状态, 操作 } = use应用状态();
const [申请读取状态, 设申请读取状态] = useState<'读取中' | '成功' | '失败'>(
  数据源模式 === 'backend' ? '读取中' : '成功',
);
useEffect(() => {
  if (数据源模式 !== 'backend') return;
  let active = true;
  void 操作.读取企业管理员申请().then(
    () => { if (active) 设申请读取状态('成功'); },
    () => { if (active) 设申请读取状态('失败'); },
  );
  return () => { active = false; };
}, [数据源模式, 操作]);

const 企业认证文案 = 申请读取状态 === '读取中'
  ? '正在读取'
  : 申请读取状态 === '失败'
    ? '读取失败'
    : 取企业认证状态文案(
        状态.企业关系列表,
        状态.当前企业关系编号,
        状态.企业管理员申请列表,
      );
```

```tsx
<span className={样式.行值}>{企业认证文案}</span>
```

- [ ] **Step 6: Run focused tests and commit**

```bash
npm test -- src/屏幕/公司档案编辑.test.tsx src/屏幕/公司档案分区编辑.test.tsx src/数据/组织映射.test.ts src/屏幕/企业设置.test.tsx
git diff --check
git add src/屏幕/招聘方组织门.tsx src/屏幕/公司档案编辑.tsx src/屏幕/公司档案编辑.test.tsx src/屏幕/公司档案分区编辑.tsx src/屏幕/公司档案分区编辑.test.tsx src/数据/组织映射.ts src/数据/组织映射.test.ts src/屏幕/企业设置.tsx src/屏幕/企业设置.test.tsx
git commit -m "fix: show truthful recruiter organization state"
```

Expected: all focused tests PASS, the two routes share the same guard, and free-text company state never implies verification.

### Task 6: Localize errors, neutralize export copy, and restore browser zoom

**Files:**
- Modify: `src/数据/HTTP客户端.ts`
- Modify: `src/数据/HTTP客户端.test.ts`
- Modify: `src/屏幕/发布岗位.tsx`
- Modify: `src/屏幕/发布岗位.test.tsx`
- Modify: `src/屏幕/账号安全.tsx`
- Modify: `src/屏幕/账号安全.test.tsx`
- Modify: `index.html`
- Modify: `README.md`
- Create: `src/配置/viewport合同.test.ts`

**Interfaces:**
- Consumes: the predecessor's `客户端校验错误(field, message)` and `BFF错误.fieldErrors` array.
- Produces: `取岗位提交错误文案(error): string`, generic server-validation projection, neutral account export text, and a static zoom contract.

- [ ] **Step 1: Add failing HTTP and job-error regressions**

Add to `src/数据/HTTP客户端.test.ts` without deleting the existing field-error parsing test:

```ts
it('client validation 显示可行动文案，未知本地 Error 不冒充网络也不泄露内部文本', () => {
  expect(取后端错误文案(new 客户端校验错误('requirements', '请填写职位要求')))
    .toBe('请填写职位要求');
  expect(取后端错误文案(new Error('招聘方档案状态尚未就绪，请刷新后重试')))
    .toBe('请求失败，请稍后再试');
});

it('422 保留 fieldErrors，但通用文案不展示机器 reason', () => {
  const error = new BFF错误(422, 'validation_failed', 'bad', [
    { path: 'requirements', reason: 'must_not_be_blank' },
  ]);
  expect(error.fieldErrors).toEqual([{ path: 'requirements', reason: 'must_not_be_blank' }]);
  expect(取后端错误文案(error)).toBe('填写内容未通过校验');
});
```

Import the existing `客户端校验错误` in that test. Add to `src/屏幕/发布岗位.test.tsx`:

```ts
it.each([
  ['hiring_organization_claim.display_name', 'must_not_be_blank', '请填写公司名称'],
  ['/office_location', 'required', '请填写办公地点'],
  ['description', 'blank', '请填写职位描述'],
  ['/requirements', 'must_not_be_blank', '请填写职位要求'],
] as const)('把字段错误 %s 本地化', (path, reason, expected) => {
  expect(取岗位提交错误文案(
    new BFF错误(422, 'validation_failed', 'bad', [{ path, reason }]),
  )).toBe(expected);
});

it.each([
  [new BFF错误(422, 'validation_failed', 'bad', [{ path: 'unknown', reason: 'required' }])],
  [new BFF错误(422, 'validation_failed', 'bad', [{ path: 'requirements', reason: 'unsupported_code' }])],
])('未知字段或 reason 使用通用岗位文案', (error) => {
  expect(取岗位提交错误文案(error)).toBe('请检查岗位信息');
});
```

- [ ] **Step 2: Add failing copy and viewport regressions**

In `src/屏幕/账号安全.test.tsx`, add a Backend recruiter render assertion:

```tsx
it('招聘方导出与注销文案不出现你的简历', () => {
  renderBackend账号安全();
  expect(screen.getByText(/账号资料与业务记录/)).toBeVisible();
  expect(screen.queryByText(/你的简历/)).not.toBeInTheDocument();
  expect(账号安全源码).not.toMatch(/你的简历/);
});
```

Keep the file's existing `import 账号安全源码 from './账号安全.tsx?raw';`; the static assertion deliberately reuses that repository-standard Vite raw import.

Create `src/配置/viewport合同.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('viewport 可访问性合同', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

  it('保留 safe area 并允许用户缩放', () => {
    expect(html).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
    );
    expect(html).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(html).not.toMatch(/maximum-scale\s*=\s*1/i);
    expect(html).not.toMatch(/minimum-scale\s*=\s*1/i);
  });
});
```

- [ ] **Step 3: Run focused tests and record the RED**

```bash
npm test -- src/数据/HTTP客户端.test.ts src/屏幕/发布岗位.test.tsx src/屏幕/账号安全.test.tsx src/配置/viewport合同.test.ts
```

Expected: FAIL because ordinary errors are labeled network failures, 422 exposes `reason`, export copy mentions resumes, and viewport disables zoom.

- [ ] **Step 4: Implement truthful generic and form-specific error projection**

Preserve the predecessor's class and make `取后端错误文案` use this ordering in `src/数据/HTTP客户端.ts`:

```ts
export function 取后端错误文案(error: unknown): string {
  if (error instanceof 客户端校验错误) return error.message;
  if (!(error instanceof BFF错误)) {
    return '请求失败，请稍后再试';
  }
  if (error.status === 0 || error.code === 'network_error') return '无法连接后端服务，请检查网络或稍后重试';
  if (error.status === 502 || error.status === 503 || error.status === 504) return '后端服务暂时不可用，请稍后重试';
  if (error.code === 'invalid_response') return '服务返回异常，请稍后重试';
  if (error.code === 'invalid_session') return '登录已失效，请重新登录';
  if (error.code === 'invalid_origin') return '当前后端环境配置不正确';
  if (error.code === 'version_conflict') return '数据已在其他地方更新，请重试';
  if (error.code === 'validation_failed') return '填写内容未通过校验';
  return error.message || '请求失败，请稍后再试';
}
```

In `src/屏幕/发布岗位.tsx`, export this pure form projection next to the other helpers:

```ts
const 可本地化空值原因 = new Set(['required', 'blank', 'must_not_be_blank']);
const 岗位字段文案: Record<string, string> = {
  'hiring_organization_claim.display_name': '请填写公司名称',
  office_location: '请填写办公地点',
  description: '请填写职位描述',
  requirements: '请填写职位要求',
};

function 归一字段路径(path: string): string {
  return path.startsWith('/') ? path.slice(1).replaceAll('/', '.') : path;
}

export function 取岗位提交错误文案(error: unknown): string {
  if (!(error instanceof BFF错误) || error.code !== 'validation_failed') {
    return 取后端错误文案(error);
  }
  for (const field of error.fieldErrors) {
    const message = 岗位字段文案[归一字段路径(field.path)];
    if (message && 可本地化空值原因.has(field.reason)) return message;
  }
  return '请检查岗位信息';
}
```

Use it in create/update catch blocks and preserve diagnostics only in development:

```ts
} catch (错误) {
  if (import.meta.env.DEV) console.error('岗位提交失败', 错误);
  轻提示(取岗位提交错误文案(错误));
} finally {
```

- [ ] **Step 5: Replace account copy and viewport contract**

In `src/屏幕/账号安全.tsx`, use the same neutral noun phrase in the initial row, drawer, and deletion warning:

```ts
const 账号业务记录文案 = '账号资料与业务记录';

if (导出快照 === null) return `打包下载${账号业务记录文案}`;
if (导出状态 === null) {
  return 导出快照.phase === 'error'
    ? '导出状态获取失败，可重试'
    : `打包下载${账号业务记录文案}`;
}
导出抽屉说明 = `把${账号业务记录文案}打包成 ZIP 文件。生成需要一点时间，关闭本页不会中断，回到这里可以继续查看。`;
```

Replace the deletion paragraph containing `你的简历、意向、规则与收藏` with:

```tsx
你的账号资料与业务记录会按注销规则处理，且无法恢复。
```

Replace the viewport comment and tag in `index.html`:

```html
<!-- viewport-fit=cover keeps safe-area insets; browser zoom remains available for accessibility. -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

In `README.md`, replace `viewport-fit=cover / 禁缩放 / 主屏全屏` with `viewport-fit=cover / 允许浏览器缩放 / 主屏全屏`.

- [ ] **Step 6: Run focused and static tests, then commit**

```bash
npm test -- src/数据/HTTP客户端.test.ts src/屏幕/发布岗位.test.tsx src/屏幕/账号安全.test.tsx src/配置/viewport合同.test.ts
git diff --check
git add src/数据/HTTP客户端.ts src/数据/HTTP客户端.test.ts src/屏幕/发布岗位.tsx src/屏幕/发布岗位.test.tsx src/屏幕/账号安全.tsx src/屏幕/账号安全.test.tsx index.html README.md src/配置/viewport合同.test.ts
git commit -m "fix: present truthful recruiter errors and account copy"
```

Expected: all focused tests PASS, structured field errors remain intact, and no recruiter-facing account copy contains `你的简历`.

### Task 7: Prove the complete recruiter onboarding flow through the HTTP-shaped fixture

**Files:**
- Modify: `e2e/数据源模式.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–6, the existing `安装BFF路由`, P1C DTO shapes, Catalog fixtures, request interceptor, and the predecessor's candidate fixture option.
- Produces: an independent mutable `招聘方OnboardingFixture`, strict profile CAS and JobCreate fixture behavior, and the plan-scope E2E scenario `新招聘方 onboarding`.

- [ ] **Step 1: Write the failing full-flow E2E before adding its fixture support**

Add inside a Backend-tagged describe block. It deliberately references `创建招聘方OnboardingFixture` and the new route option before either exists, which is the first RED:

```ts
test('新招聘方 onboarding：404 首写、完整发岗与刷新恢复 @backend', async ({ page }) => {
  const fixture = 创建招聘方OnboardingFixture();
  const requests: 拦截请求形[] = [];
  const jobCreateStatuses: number[] = [];
  const profileReadStatuses: number[] = [];
  page.on('response', (response) => {
    if (response.request().method() === 'POST' && response.url().endsWith('/api/v1/recruiter/jobs')) {
      jobCreateStatuses.push(response.status());
    }
    if (response.request().method() === 'GET' && response.url().endsWith('/api/v1/recruiter/profile')) {
      profileReadStatuses.push(response.status());
    }
  });
  await 安装BFF路由(page, {
    登录尝试id: 'att-new-recruiter-onboarding',
    记录目录请求: () => undefined,
    主体初始角色: null,
    招聘方OnboardingFixture: fixture,
    请求拦截: (request) => requests.push(request),
  });

  await page.goto('/');
  await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
  await page.getByRole('button', { name: '我要招人' }).click();
  await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
  expect(profileReadStatuses[0]).toBe(404);
  await page.getByLabel('姓名').fill('林澈');
  await page.getByLabel('职务').fill('招聘负责人');
  await page.getByLabel('公司').fill('星河科技');
  await page.getByRole('button', { name: '保存并继续' }).click();
  await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 20_000 });

  const profileWrite = fixture.mutations.find((item) => item.path === '/api/v1/recruiter/profile');
  expect(profileWrite).toEqual(expect.objectContaining({
    method: 'PATCH', ifMatch: '"0"', body: { public_name: '林澈', title: '招聘负责人' },
  }));
  expect(fixture.profile).toEqual(expect.objectContaining({ revision: 1 }));

  await 走完后端发岗向导(page);
  await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
  const jobWrite = fixture.mutations.find((item) => item.path === '/api/v1/recruiter/jobs');
  expect(jobWrite!.body).toMatchObject({
    hiring_organization_claim: { display_name: '星河科技', legal_name: null },
    description: '用户研究、产品验证、产品策略、实验、数据分析、需求执行、GTM、发布与增长',
    requirements: '应届或毕业年级；有产品、技术、增长、分析或创业经历；关注 AI、SaaS、工作流、开发工具与 Agent',
  });
  expect(jobCreateStatuses).toEqual([201]);
  expect(fixture.ownerJobs).toHaveLength(1);

  await page.reload();
  await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
  await expect(page.getByText('Fixture 实习岗位')).toBeVisible();
  expect(requests.filter((item) => item.path === '/api/v1/recruiter/profile' && item.method === 'GET').length)
    .toBeGreaterThanOrEqual(2);
  expect(profileReadStatuses).toContain(200);
});
```

- [ ] **Step 2: Run the E2E and record the RED**

```bash
npm run test:e2e:data-source -- --grep "新招聘方 onboarding"
```

Expected: TypeScript/Playwright compilation FAIL because the independent fixture factory and route option are not defined.

- [ ] **Step 3: Add an independent nullable-profile fixture type and factory**

Do not change or reset the predecessor's candidate fixture. Add next to the P1C organization fixture types:

```ts
interface 招聘方Onboarding变更 {
  method: string;
  path: string;
  body: unknown;
  ifMatch: string | null;
}

interface 招聘方OnboardingFixture形 {
  profile: P1C招聘方档案形 | null;
  affiliations: P1C企业关系形[];
  organizations: Record<string, P1C组织形>;
  adminRequests: P1C管理员申请形[];
  ownerJobs: P1C岗位形[];
  mutations: 招聘方Onboarding变更[];
}

function 创建招聘方OnboardingFixture(): 招聘方OnboardingFixture形 {
  return {
    profile: null,
    affiliations: [],
    organizations: {},
    adminRequests: [],
    ownerJobs: [],
    mutations: [],
  };
}
```

Add this optional field to `BFF路由选项` without changing `招聘组织Fixture`:

```ts
/** 新招聘方专用：profile 从 null 经 revision-zero PATCH 变为权威 DTO。 */
招聘方OnboardingFixture?: 招聘方OnboardingFixture形;
```

- [ ] **Step 4: Make the route fixture honor missing-profile and CAS semantics**

At the start of `安装BFF路由`, use a union only for organization route setup:

```ts
const onboardingFixture = 选项.招聘方OnboardingFixture ?? null;
const 组织fixture = onboardingFixture ?? 选项.招聘组织Fixture ?? null;
let 档案可变: P1C招聘方档案形 | null = 组织fixture?.profile
  ? { ...组织fixture.profile }
  : null;
const 关系可变 = 组织fixture ? 组织fixture.affiliations.map((项) => ({ ...项 })) : [];
const 申请可变 = 组织fixture ? 组织fixture.adminRequests.map((项) => ({ ...项 })) : [];
const 岗位可变 = 组织fixture ? 组织fixture.ownerJobs.map((项) => ({ ...项 })) : [];
```

Replace the profile handlers with exact missing/create/update behavior:

```ts
if (path === '/api/v1/recruiter/profile' && method === 'GET') {
  if (档案可变 === null) {
    await route.fulfill({
      status: 404,
      json: { error: { type: 'not_found', message: 'Recruiter profile not found' } },
    });
    return;
  }
  await route.fulfill({ status: 200, json: 信封(档案可变) });
  return;
}
if (path === '/api/v1/recruiter/profile' && method === 'PATCH') {
  const ifMatch = 请求.headers()['if-match'] ?? null;
  const expected = `"${档案可变?.revision ?? 0}"`;
  if (ifMatch !== expected) {
    await route.fulfill({
      status: 409,
      json: { error: { type: 'version_conflict', message: 'profile revision mismatch' } },
    });
    return;
  }
  const patch = body as { public_name?: string; title?: string };
  档案可变 = {
    public_name: patch.public_name ?? 档案可变?.public_name ?? '',
    title: patch.title ?? 档案可变?.title ?? '',
    personal_verification_status: 档案可变?.personal_verification_status ?? 'unverified',
    verified_name: 档案可变?.verified_name ?? null,
    avatar_url: 档案可变?.avatar_url ?? null,
    revision: (档案可变?.revision ?? 0) + 1,
  };
  if (onboardingFixture) {
    onboardingFixture.profile = { ...档案可变 };
    onboardingFixture.mutations.push({ method, path, body, ifMatch });
  }
  await route.fulfill({ status: 200, json: 信封(档案可变) });
  return;
}
```

Keep the existing profile PATCH behavior for the legacy P1C fixture through the same code; it now also validates its actual revision.

After constructing a new job, record the mutation and return `201`:

```ts
岗位可变.push(新岗);
if (onboardingFixture) {
  onboardingFixture.ownerJobs.push({ ...新岗 });
  onboardingFixture.mutations.push({
    method,
    path,
    body,
    ifMatch: 请求.headers()['if-match'] ?? null,
  });
}
await route.fulfill({ status: 201, json: 信封(新岗) });
return;
```

- [ ] **Step 5: Update the visible recruiter wizard helper**

In `走完后端发岗向导`, fill the restored field after the description and before publishing:

```ts
await page.getByLabel('职位描述').fill(
  '用户研究、产品验证、产品策略、实验、数据分析、需求执行、GTM、发布与增长',
);
await page.getByRole('button', { name: '下一步' }).click();
await page.getByLabel('职位要求').fill(
  '应届或毕业年级；有产品、技术、增长、分析或创业经历；关注 AI、SaaS、工作流、开发工具与 Agent',
);
```

Keep the existing Catalog selection, compensation, city selection, and non-empty office address steps unchanged.

- [ ] **Step 6: Keep the final E2E assertions closed over the authoritative fixture**

After the fixture implementation compiles, keep the Step 1 scenario in this final exact form; it must not be weakened to page-only assertions:

```ts
test('新招聘方 onboarding：404 首写、完整发岗与刷新恢复 @backend', async ({ page }) => {
  const fixture = 创建招聘方OnboardingFixture();
  const requests: 拦截请求形[] = [];
  const jobCreateStatuses: number[] = [];
  const profileReadStatuses: number[] = [];
  page.on('response', (response) => {
    if (response.request().method() === 'POST' && response.url().endsWith('/api/v1/recruiter/jobs')) {
      jobCreateStatuses.push(response.status());
    }
    if (response.request().method() === 'GET' && response.url().endsWith('/api/v1/recruiter/profile')) {
      profileReadStatuses.push(response.status());
    }
  });
  await 安装BFF路由(page, {
    登录尝试id: 'att-new-recruiter-onboarding',
    记录目录请求: () => undefined,
    主体初始角色: null,
    招聘方OnboardingFixture: fixture,
    请求拦截: (request) => requests.push(request),
  });

  await page.goto('/');
  await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
  await page.getByRole('button', { name: '我要招人' }).click();
  await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
  expect(profileReadStatuses[0]).toBe(404);

  await page.getByLabel('姓名').fill('林澈');
  await page.getByLabel('职务').fill('招聘负责人');
  await page.getByLabel('公司').fill('星河科技');
  await page.getByRole('button', { name: '保存并继续' }).click();
  await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 20_000 });

  const profileWrite = fixture.mutations.find((item) => item.path === '/api/v1/recruiter/profile');
  expect(profileWrite).toEqual(expect.objectContaining({
    method: 'PATCH',
    ifMatch: '"0"',
    body: { public_name: '林澈', title: '招聘负责人' },
  }));
  expect(fixture.profile).toEqual(expect.objectContaining({ revision: 1 }));

  await 走完后端发岗向导(page);
  await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

  const jobWrite = fixture.mutations.find((item) => item.path === '/api/v1/recruiter/jobs');
  expect(jobWrite).toBeDefined();
  expect(jobWrite!.body).toMatchObject({
    hiring_organization_claim: { display_name: '星河科技', legal_name: null },
    description: '用户研究、产品验证、产品策略、实验、数据分析、需求执行、GTM、发布与增长',
    requirements: '应届或毕业年级；有产品、技术、增长、分析或创业经历；关注 AI、SaaS、工作流、开发工具与 Agent',
  });
  expect(jobCreateStatuses).toEqual([201]);
  expect(fixture.ownerJobs).toHaveLength(1);

  await page.reload();
  await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
  await expect(page.getByText('Fixture 实习岗位')).toBeVisible();
  expect(requests.filter((item) => item.path === '/api/v1/recruiter/profile' && item.method === 'GET').length)
    .toBeGreaterThanOrEqual(2);
  expect(profileReadStatuses).toContain(200);
});
```

This test must use the actual profile and job data-source calls. Do not mock `操作.保存招聘方档案` or `操作.发布岗位`.

- [ ] **Step 7: Run the focused E2E GREEN and repair only exact defects**

```bash
npm run test:e2e:data-source -- --grep "新招聘方 onboarding"
```

Expected: exit `0`. If the failure reveals a product defect, return to its owning task, add a focused Vitest regression, make the minimum fix, and commit that fix separately before resuming this task.

- [ ] **Step 8: Run the full plan-scope verification matrix**

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e:data-source -- --grep "新招聘方 onboarding"
```

Every command must exit `0`. `npm test` is the single authoritative plan-scope test gate; the later commands are orthogonal type, lint, build, and intercepted-integration evidence.

- [ ] **Step 9: Commit the integration fixture and scenario**

```bash
git diff --check
git add e2e/数据源模式.spec.ts
git commit -m "test: cover recruiter onboarding persistence"
```

Expected: `git diff --check` exits `0` and the commit records only the independent recruiter fixture/scenario plus the requirements helper update.

## Terminal Integration Task: Candidate-baseline audit, real-BFF condition, and final handoff

**Files:**
- Inspect: predecessor implementation handoff and shared-file diff
- Inspect: `docs/superpowers/specs/2026-09-01-employer-onboarding-repair-design.md`
- Inspect: `docs/superpowers/plans/2026-09-01-employer-onboarding-p0-repair.md`
- Create during execution: `docs/superpowers/handoffs/2026-09-01-employer-onboarding-p0-repair.md`

**Interfaces:**
- Consumes: all Task 1–7 commits, their focused RED/GREEN evidence, and the predecessor implementation commit.
- Produces: a clean candidate commit, an auditable verification report, and a human merge/push gate. It does not authorize push, PR creation, or merge.

```yaml
integration_requirement: conditional
l3_selection:
  selector_kind: none
  selected_suite: null
  reason: "This frontend repository has no formal real-BFF fixture account or suite selector; Playwright data-source mode is intercepted integration only."
selection_gap:
  owner: "Recruitment frontend/backend integration owner"
  condition: "A locally reachable BFF, a disposable brand-new recruiter account, and an OTP/login fixture are supplied."
  required_journey: "choose recruiter -> GET profile 404 -> PATCH If-Match 0 -> POST complete job -> refresh -> authoritative profile/jobs"
```

- [ ] **Step 1: Audit the predecessor boundary before final verification**

```bash
git log --oneline --decorate -20
: "${CANDIDATE_IMPL_COMMIT:?export the exact predecessor implementation commit recorded at baseline}"
git cat-file -e "${CANDIDATE_IMPL_COMMIT}^{commit}"
git show --stat --oneline "${CANDIDATE_IMPL_COMMIT}"
git diff "${CANDIDATE_IMPL_COMMIT}"..HEAD -- src/数据/HTTP客户端.ts src/数据/后端映射.ts src/状态/应用状态.tsx e2e/数据源模式.spec.ts
rg -n "class 客户端校验错误|function 必需引用|VITE_ANNOTATION_ENABLED|sessionStorage" src
```

Export `CANDIDATE_IMPL_COMMIT` as the exact commit recorded at baseline; the required-variable check prevents a guessed or empty comparison. Confirm the recruiter changes extend rather than remove the five predecessor contracts listed in Global Constraints. If any contract was semantically replaced, mark the task `BLOCKED` and return to the planning owner.

- [ ] **Step 2: Re-run final local evidence on the exact candidate commit**

```bash
: "${CANDIDATE_IMPL_COMMIT:?export the exact predecessor implementation commit recorded at baseline}"
git status --short
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e:data-source -- --grep "新招聘方 onboarding"
CI=true UI_VISUAL_GATE=report UI_CHANGE_APPROVED=false \
  npm run ui:check -- --base "${CANDIDATE_IMPL_COMMIT}" --output ui-regression-output/employer-onboarding-p0
git diff --check
```

All commands must exit `0`, and `git status --short` must be empty before integration handoff. The UI command dynamically captures the predecessor commit as reference; do not commit a synthetic static baseline. Inspect `ui-regression-output/employer-onboarding-p0/report.md` plus the `reference`, `candidate`, and `diff` evidence for `recruiter-post-job-3`, then record the human visual verdict. A structure/API/infrastructure failure is not an approvable expected diff and must be fixed. Record every command, start/end time, exit code, and concise output summary.

- [ ] **Step 3: Run or classify the real-BFF journey**

If the condition in `selection_gap.condition` is satisfied, run the repository's real-backend server plus the visible recruiter journey with the supplied disposable fixture. Capture HTTP evidence for profile `404`, profile PATCH `If-Match: "0"` and `revision: 1`, JobCreate `201`, the three non-blank text fields, and successful refresh hydration. Do not record OTPs, cookies, or raw credentials.

If any prerequisite is absent, write exactly one of these classifications in the handoff:

```text
ENV_BLOCKED — real BFF and/or disposable recruiter/OTP fixture unavailable; intercepted Playwright PASS is not real-service PASS.
NOT RUN — integration owner did not authorize or schedule the real-service journey; intercepted Playwright PASS is not real-service PASS.
```

- [ ] **Step 4: Write the completion handoff**

Create `docs/superpowers/handoffs/2026-09-01-employer-onboarding-p0-repair.md` with:

```markdown
# Employer Onboarding P0 Repair Handoff

## Baselines
- Candidate onboarding implementation commit: write the 40-character hash validated by `git cat-file`.
- Employer Spec commit: write the 40-character hash containing the approved Spec.
- Employer Plan commit: write the 40-character hash containing this Plan.
- Final candidate commit: write the 40-character hash from `git rev-parse HEAD`.

## Task Commits and Files
| Task | Commit | Files |
| --- | --- | --- |
| 1 | write the Task 1 commit hash | list every Task 1 path from `git show --name-only` |

## TDD Evidence
| Task | RED command/result | GREEN command/result |
| --- | --- | --- |
| 1 | write the exact command, nonzero exit, and observed failure | write the exact command and exit `0` |

## Final Verification
| Command | Exit | Result |
| --- | ---: | --- |
| `npm test` | `0` | PASS |
| `npm run typecheck` | `0` | PASS |
| `npm run lint` | `0` | PASS |
| `npm run build` | `0` | PASS |
| `npm run test:e2e:data-source -- --grep "新招聘方 onboarding"` | `0` | PASS |
| `UI_VISUAL_GATE=report npm run ui:check -- --base candidate-implementation-commit` | `0` | record recruiter-post-job-3 visual verdict |

## Contract Proof
- First profile GET: `404 not_found`
- First profile mutation: `PATCH`, `If-Match: "0"`, response revision `1`
- JobCreate response: `201`
- Non-blank claim/description/requirements: write the three values captured by the fixture assertion.
- Refresh route and authoritative state: write `/hr`, the captured profile revision, and captured job count.
- Candidate predecessor contracts preserved: cite the shared-file diff and final verification evidence.
- `recruiter-post-job-3` visual evidence: record report status, reviewed diff artifact, and human verdict.

## Real-BFF Integration
- Verdict: `PASS | ENV_BLOCKED | NOT RUN`
- Reason/evidence: record the environment result without OTPs, cookies, or credentials.

## Explicitly Deferred
- Remote empty office address: gated on backend implementation/OpenAPI/test handoff.
- JD PDF suggestion import: gated on backend implementation/OpenAPI/test handoff.
```

Expand the Task table to Tasks 1–7 and replace every instructional value with recorded evidence before committing. The template is a required schema; the completed handoff must contain only observed values.

- [ ] **Step 5: Commit the handoff and stop at the human gate**

```bash
git add docs/superpowers/handoffs/2026-09-01-employer-onboarding-p0-repair.md
git commit -m "docs: hand off employer onboarding repair"
git status --short
```

Expected: the handoff commit succeeds and the final status is clean. Report the exact final commit and all verification results. Do not push, open a PR, merge, or start the remote-address/JD Plan until the user explicitly authorizes that next action and the backend gate is satisfied.

## Completion Report

The implementing agent must return:

- the predecessor candidate implementation commit and evidence that its five shared contracts remain intact;
- the changed files and commit SHA for every Task 1–7 plus the Terminal Integration Task;
- every focused RED and GREEN command with exit code;
- exit codes for `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and the focused data-source E2E;
- captured proof of profile `404`, PATCH `If-Match: "0"`, revision `1`, JobCreate `201`, non-blank company/description/requirements, and refresh recovery to `/hr`;
- real-BFF result as `PASS`, `ENV_BLOCKED`, or `NOT RUN`, with reason and no secrets;
- explicit confirmation that remote empty-address behavior and JD PDF import were not implemented in this Plan.
