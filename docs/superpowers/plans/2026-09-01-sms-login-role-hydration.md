# SMS Login Role Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make interactive Backend SMS login hydrate the authoritative role domains before exposing the logged-in shell, preserve predecessor onboarding semantics, and prevent Mock identity leakage.

**Architecture:** Reuse `水合角色数据` as the only role-domain loader, extend its subject/generation fence to every settled result, and commit `{ 主体, 已登录: true }` only after the non-interactive hydration round is current and settled. Keep the predecessor recruiter route/recovery guard as the sole Backend landing owner and keep candidate onboarding draft persistence in its existing Provider effect.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Vite 8, Vitest 4, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-01-sms-login-hydration-salary-listbox-design.md`

## Global Constraints

- Calibrated base (2026-09-01): this branch is rebased onto `origin/main` at `37b0a459e53b48dfb3e204a647c805334d0bff06`; candidate integration anchor `e1493eed1ba97c58379d7503f97ae2ca44d3adea` and recruiter implementation anchor `59cd1ee6dfa3a0ba43ec30b3b1d33cc28e8a23e8` are both ancestors.
- Before product edits, fetch `origin/main`, require a clean worktree, and verify the calibrated base is still current. If `origin/main` moved, rebase and recalibrate this Plan and the Spec before implementation.
- Preserve the candidate-only, subject-scoped onboarding draft effect. Do not add session storage reads or writes to `会话操作.ts`; keep the existing `清后端草稿` transition order.
- Consume the recruiter predecessor interfaces exactly: `招聘方档案水合阶段`, `招聘方组织水合`, `创建空招聘方组织水合状态()`, the four-argument `水合招聘方组织数据(...)`, and `会话操作.重新水合招聘方数据()`.
- Extend the predecessor `src/应用.test.tsx`; do not replace its recruiter missing-profile, recovery-surface, or recovery-path tests.
- Backend failures never fall back to Mock, and role screens must not add mount-time resume/intention/job reads.
- Preserve every BFF route, DTO, active-intention query, revision/ETag, `If-Match`, authoritative reread, and request count.
- Current-session 401 uses `清账号状态`; stale-session success, failure, 401, and error copy are all discarded.
- Non-401 hydration failures use cold-start semantics: successful sibling domains commit, the failed domain is reported once, and SMS completion is not presented as a verification-code failure.
- Follow TDD in every task: add the regression, run and record the expected failure, implement the minimum change, rerun focused tests, and commit.

---

## Predecessor Reconciliation and File Map

Run before Task 1:

```bash
git fetch origin main
git status --short
CANDIDATE_IMPL_COMMIT=e1493eed1ba97c58379d7503f97ae2ca44d3adea
RECRUITER_IMPL_COMMIT=59cd1ee6dfa3a0ba43ec30b3b1d33cc28e8a23e8
CALIBRATED_MAIN=37b0a459e53b48dfb3e204a647c805334d0bff06
git merge-base --is-ancestor "$CANDIDATE_IMPL_COMMIT" HEAD
git merge-base --is-ancestor "$RECRUITER_IMPL_COMMIT" HEAD
git merge-base --is-ancestor "$CALIBRATED_MAIN" HEAD
git merge-base --is-ancestor origin/main HEAD
rg -n "招聘方档案水合阶段|招聘方组织水合|重新水合招聘方数据|水合招聘方组织数据" src/状态 src/应用.tsx src/应用.test.tsx
git diff --check
npm install
```

Expected: `git status --short` is empty; all four `merge-base --is-ancestor` calls exit `0`; the `rg` output finds the predecessor state, four-argument organization hydration, recovery operation, route guard, and tests; `git diff --check` and `npm install` exit `0`. Record the three immutable SHAs in the execution report. If `origin/main` is not an ancestor of `HEAD`, or any listed interface changed semantically, stop and rebase/revise this Plan and the Spec before editing product code.

| File | Responsibility in this Plan |
| --- | --- |
| `src/状态/后端/会话操作.ts` | Full hydration fence, full 401 cleanup dependencies, interactive-login orchestration |
| `src/状态/后端/会话操作.test.ts` | Pure session/fence/current-vs-stale regression matrix |
| `src/状态/后端/组织操作.ts`, tests | Pass all runtime cleanup references through recruiter organization 401 paths |
| `src/状态/应用状态.tsx`, tests | Provider mount call-site dependencies and final generation guard; no draft-storage rewrite |
| `src/屏幕/登录.tsx`, tests | Authentication-only Backend page; Mock navigation unchanged |
| `src/应用.tsx`, `src/应用.test.tsx` | Inspect/extend predecessor landing guard; recruiter recovery semantics remain authoritative |
| `src/屏幕/我的.tsx`, `src/屏幕/我的.test.tsx` | Backend-neutral name/status and Mock-only fixture copy |

### Task 1: Fence every role-hydration result and carry complete cleanup dependencies

**Files:**
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/后端/会话操作.test.ts`
- Modify: `src/状态/后端/组织操作.ts`
- Modify: `src/状态/后端/组织操作.test.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: predecessor `水合招聘方组织数据(deps, subjectId, generation, restoredId)`, `创建空招聘方组织水合状态()`, existing P4/P7/P8 runtime refs, `清账号状态`, and `水合Agent规则角色数据`.
- Produces: `水合角色数据(...) => Promise<boolean>` whose commits, errors, and 401 handling are all fenced by exact subject + generation, and whose current-session cleanup reaches P4/P7/P8 refs.

- [ ] **Step 1: Add candidate stale-result and current-401 regressions**

In `src/状态/后端/会话操作.test.ts`, extend the existing `创建P6数据源桩`, `创建P6会话依赖`, and `deferred` harness:

```ts
it('candidate 简历和意向在 generation 变化后结算时整包丢弃', async () => {
  const 后端 = 创建P6数据源桩();
  const 简历门 = deferred<Awaited<ReturnType<typeof 后端.读取简历>>>();
  const 意向门 = deferred<Awaited<ReturnType<typeof 后端.读取意向>>>();
  vi.mocked(后端.读取简历).mockReturnValue(简历门.promise);
  vi.mocked(后端.读取意向).mockReturnValue(意向门.promise);
  const { deps, 动作流 } = 创建P6会话依赖(后端);
  deps.主体标识引用.current = candidate主体.subject_id;
  deps.会话代际.current = 7;

  const 运行 = 水合角色数据(deps, candidate主体, false, 7);
  deps.会话代际.current = 8;
  简历门.resolve(await 创建P6数据源桩().读取简历());
  意向门.resolve({ 列表: [{ 编号: 'stale', 标题: '旧意向', 说明: '' }], 服务端: {} });
  await expect(运行).resolves.toBe(false);

  expect(动作流).not.toContainEqual(expect.objectContaining({ 型: '水合后端简历' }));
  expect(动作流).not.toContainEqual(expect.objectContaining({ 型: '水合后端意向' }));
});

it('candidate 迟到 401 不清更新会话也不提示', async () => {
  const 后端 = 创建P6数据源桩();
  const 简历门 = deferred<never>();
  vi.mocked(后端.读取简历).mockReturnValue(简历门.promise);
  const { deps } = 创建P6会话依赖(后端);
  deps.主体标识引用.current = candidate主体.subject_id;
  deps.会话代际.current = 7;

  const 运行 = 水合角色数据(deps, candidate主体, false, 7);
  deps.主体标识引用.current = 'sub_new';
  deps.会话代际.current = 8;
  简历门.reject(new BFF错误(401, 'invalid_session', '旧会话过期'));
  await expect(运行).resolves.toBe(false);

  expect(deps.主体标识引用.current).toBe('sub_new');
  expect(deps.会话代际.current).toBe(8);
  expect(deps.后端状态引用.current.已登录).toBe(true);
});

it('candidate 当前轮水合 401 清 P7 与 P8 运行时引用', async () => {
  const 后端 = 创建P6数据源桩();
  vi.mocked(后端.读取简历).mockRejectedValue(
    new BFF错误(401, 'invalid_session', 'expired'),
  );
  const { deps } = 创建P6会话依赖(后端);
  deps.主体标识引用.current = candidate主体.subject_id;
  deps.会话代际.current = 7;
  deps.P7范围代际.current.set('candidate:inbox', 3);
  deps.P7可见收件箱.current.candidate = true;
  deps.P8读取锁.current.set('sessions', Promise.resolve());
  deps.P8账号可见.current = true;

  await expect(水合角色数据(deps, candidate主体, false, 7)).resolves.toBe(true);
  expect(deps.P7范围代际.current.size).toBe(0);
  expect(deps.P7可见收件箱.current.candidate).toBe(false);
  expect(deps.P8读取锁.current.size).toBe(0);
  expect(deps.P8账号可见.current).toBe(false);
});
```

Import `页面简历快照` and `页面意向快照` from `../../数据/招聘数据源类型` and use those exact types for the two deferred promises; do not use `any`.

In the predecessor `src/状态/后端/组织操作.test.ts`, extend `创建组织测试依赖` with the complete runtime refs used by `创建P6会话依赖`:

```ts
P4范围代际: { current: new Map<string, number>() },
P4幂等意图: { current: new Map<string, string>() },
P4可见范围: { current: { candidate: null, recruiter: null } },
P7范围代际: { current: new Map<string, number>() },
P7待定意图: { current: new Map<string, never>() },
P7可见收件箱: { current: { candidate: false, recruiter: false } },
P7可见会话: { current: { candidate: null, recruiter: null } },
P7已读位置: { current: new Map<string, never>() },
P8范围代际: { current: 0 },
P8账号可见: { current: false },
P8读取锁: { current: new Map<'credentials' | 'sessions' | 'export', Promise<void>>() },
P8待定意图: { current: new Map<string, { key: string; request: unknown }>() },
```

Then add a recruiter-specific cleanup regression:

```ts
it('组织水合当前轮 401 清 P7 与 P8 运行时引用', async () => {
  const 后端 = 创建完整测试数据源({
    读取招聘方档案: async () => {
      throw new BFF错误(401, 'invalid_session', 'expired');
    },
  });
  const deps = 创建组织测试依赖({
    后端,
    派发: vi.fn(),
    subject: 'sub_1',
    generation: 7,
  });
  deps.P7范围代际.current.set('recruiter:inbox', 3);
  deps.P7可见收件箱.current.recruiter = true;
  deps.P8读取锁.current.set('sessions', Promise.resolve());
  deps.P8账号可见.current = true;

  await expect(水合招聘方组织数据(deps, 'sub_1', 7, null))
    .resolves.toEqual({ sessionExpired: true });
  expect(deps.P7范围代际.current.size).toBe(0);
  expect(deps.P7可见收件箱.current.recruiter).toBe(false);
  expect(deps.P8读取锁.current.size).toBe(0);
  expect(deps.P8账号可见.current).toBe(false);
});
```

Do not create a second cleanup helper in the test.

- [ ] **Step 2: Add recruiter jobs and Provider-final-commit fence regressions**

Add to `src/状态/后端/会话操作.test.ts`:

```ts
it('recruiter owner jobs 在 generation 变化后结算时不提交', async () => {
  const 后端 = 创建P6数据源桩();
  const 岗位门 = deferred<页面岗位快照>();
  vi.mocked(后端.读取岗位).mockReturnValue(岗位门.promise);
  const { deps, 动作流 } = 创建P6会话依赖(后端);
  deps.主体标识引用.current = recruiter主体.subject_id;
  deps.会话代际.current = 11;

  const 运行 = 水合角色数据(deps, recruiter主体, false, 11);
  await vi.waitFor(() => expect(后端.读取岗位).toHaveBeenCalledTimes(1));
  deps.会话代际.current = 12;
  岗位门.resolve({ 列表: [{ 编号: 'stale-job' }], 服务端: {} } as 页面岗位快照);
  await expect(运行).resolves.toBe(false);
  expect(动作流).not.toContainEqual(expect.objectContaining({ 型: '水合后端岗位' }));
});
```

Add a Provider test to `src/状态/应用状态.test.ts` using its existing context probe and deferred Backend stub:

```ts
it('迟到的 mount 水合不覆盖期间建立的新短信会话', async () => {
  let 当前!: ReturnType<typeof use应用状态>;
  function 上下文探针() { 当前 = use应用状态(); return null; }
  const 后端 = 创建后端桩('candidate');
  const 旧简历门 = deferred<页面简历快照>();
  vi.mocked(后端.读取主体)
    .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'stale-subject' })
    .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'fresh-subject' });
  vi.mocked(后端.读取简历)
    .mockReturnValueOnce(旧简历门.promise)
    .mockResolvedValue(从BFF简历(BFF简历样本));
  render(createElement(
    应用状态提供者,
    { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端 } },
    createElement(上下文探针),
  ));
  await waitFor(() => expect(后端.读取简历).toHaveBeenCalledTimes(1));

  await 当前.操作.完成手机登录('1234');
  expect(当前.后端状态.主体?.subject_id).toBe('fresh-subject');

  旧简历门.resolve(从BFF简历(BFF简历样本));
  await act(async () => { await 旧简历门.promise; });
  await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('fresh-subject'));
  expect(当前.后端状态.已登录).toBe(true);
  expect(当前.后端状态.初始化).toBe('完成');
});
```

This test is written before Task 2, so the current interactive operation advances the generation without starting its own hydration. After Task 2 it remains valid; the second `读取简历` mock serves the fresh login hydration. Do not expose a production setter for the ref.

- [ ] **Step 3: Run focused tests and record the RED**

```bash
npm test -- src/状态/后端/会话操作.test.ts src/状态/后端/组织操作.test.ts src/状态/应用状态.test.ts
```

Expected: at least the candidate stale resume/intention test, recruiter stale jobs test, current-401 P7/P8 test, and Provider final-commit test fail against the post-predecessor implementation.

- [ ] **Step 4: Extend the dependency shapes and implement one outer fence**

In `src/状态/后端/会话操作.ts`, make the `水合角色数据` dependency Pick include the complete optional cleanup refs already present on `后端操作依赖`:

```ts
type 角色水合依赖 = Pick<后端操作依赖,
  '后端' | '派发' | '设后端状态' | '主体标识引用' | '会话代际' |
  '读取恢复企业关系编号' |
  'P4范围代际' | 'P4幂等意图' | 'P4可见范围' |
  'P7范围代际' | 'P7待定意图' | 'P7可见收件箱' | 'P7可见会话' | 'P7已读位置' |
  'P8范围代际' | 'P8账号可见' | 'P8读取锁' | 'P8待定意图'
> & { 后端: HTTP招聘数据源 };

const 是当前水合 = (
  deps: Pick<后端操作依赖, '主体标识引用' | '会话代际'>,
  subjectId: string,
  generation: number,
) => deps.主体标识引用.current === subjectId && deps.会话代际.current === generation;
```

Use `角色水合依赖` in the function signature. In the candidate branch, await the four support-domain results and the P6 results as today, then return before processing any result when the outer fence is stale:

```ts
const 结果 = await Promise.allSettled([
  后端.读取简历(),
  后端.读取意向(),
  后端.读取隐私(),
  后端.读取附件简历库(),
]);
const p6结果 = await p6Promise;
if (!是当前水合(deps, 主体.subject_id, generation)) return false;
```

After that guard, process all four support results and P6 rejections with the existing independent-commit/error policy. Remove the separate privacy/attachment captured-fence functions because the one outer fence now governs the same settled batch. For a rejected result, mark 401 as session-expired but do not call `轻提示` for that individual domain; continue to present each non-401 failure as today. This prevents duplicate 401 toasts when multiple settled domains fail together. Pass `deps` directly to `清账号状态(deps)` so P4/P7/P8 refs travel with the current 401. Task 2 makes both interactive owners (`完成手机登录` and `切身份`) convert the terminal boolean to one standard `invalid_session` rejection; their existing page catches present one message and block navigation. Cold start intentionally becomes silent and lands on the login page.

In the recruiter branch, preserve the predecessor organization-before-jobs semantics. Honor a fulfilled `{ sessionExpired: true }` before the stale early return; otherwise require the outer fence before scanning P6 errors, presenting errors, or committing jobs:

```ts
if (
  组织岗位落点.status === 'fulfilled' &&
  组织岗位落点.value.sessionExpired
) return true;
if (!是当前水合(deps, 主体.subject_id, generation)) return false;
```

Replace any jobs commit check that only compares `主体标识引用` with `是当前水合(...)`.

In `src/状态/后端/组织操作.ts`, extend `组织水合依赖` with the same P4/P7/P8 cleanup-ref keys. Do not change the predecessor four-argument signature, missing-profile semantics, aggregate phases, or retry behavior; this edit only lets its current-session 401 call the complete `清账号状态` shape.

- [ ] **Step 5: Pass complete refs from every caller and guard cold-start final commit**

In `src/状态/应用状态.tsx`, add P7/P8 refs to the existing mount call:

```ts
const 会话失效 = await 水合角色数据({
  后端, 派发, 设后端状态, 主体标识引用, 会话代际, 读取恢复企业关系编号,
  P4范围代际, P4幂等意图, P4可见范围,
  P7范围代际, P7待定意图, P7可见收件箱, P7可见会话, P7已读位置,
  P8范围代际, P8账号可见, P8读取锁, P8待定意图,
}, 主体, false, 本次代际);
```

Before the cold-start final state update, distinguish cleanup, supersession, and successful commit. `清账号状态` already closes initialization for current-session 401; a superseded mount must close only `初始化` and must not write its stale subject/login state:

```ts
if (会话失效) return;
if (
  主体标识引用.current !== 主体.subject_id ||
  会话代际.current !== 本次代际
) {
  设后端状态((旧) => 旧.初始化 === '进行中'
    ? { ...旧, 初始化: '完成' }
    : 旧);
  return;
}
设后端状态((旧) => ({ ...旧, 初始化: '完成', 已登录: true, 主体 }));
```

Do not change `use资料持久化`, `当前候选主体标识`, or any candidate-draft effect. Add P7/P8 refs to the `水合角色数据` call in `切身份` as well.

- [ ] **Step 6: Run focused tests and commit**

```bash
npm test -- src/状态/后端/会话操作.test.ts src/状态/后端/组织操作.test.ts src/状态/应用状态.test.ts
npm run typecheck
git diff --check
git add src/状态/后端/会话操作.ts src/状态/后端/会话操作.test.ts src/状态/后端/组织操作.ts src/状态/后端/组织操作.test.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts
git commit -m "fix: fence role hydration across sessions"
```

Expected: all focused tests pass; typecheck and diff check exit `0`.

### Task 2: Make interactive SMS login hydrate before committing the session

**Files:**
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/后端/会话操作.test.ts`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: Task 1's fully fenced `水合角色数据`, predecessor recruiter empty-state factory and phase semantics, existing cross-subject cleanup, and candidate draft lifecycle signals.
- Produces: `完成手机登录(code): Promise<void>` that resolves only after current role hydration settles, rejects once with standard `invalid_session` after a current 401 cleanup, and commits `已登录=true` only for the current round; `切身份` uses the same terminal rejection so its page owner cannot navigate after expiry.

- [ ] **Step 1: Add the candidate atomic-visibility regression**

In `src/状态/后端/会话操作.test.ts`, add a new describe using `创建P6数据源桩` and `创建P6会话依赖`:

```ts
it('已有 candidate 短信登录在五类支持域结算后才提交登录态', async () => {
  const 后端 = 创建P6数据源桩();
  const 附件门 = deferred<BFF附件简历库>();
  vi.mocked(后端.读取主体).mockResolvedValue(candidate主体);
  vi.mocked(后端.读取意向).mockResolvedValue({
    列表: [{ 编号: 'int_1', 标题: 'AI 产品经理', 说明: '20–30K' }],
    服务端: { int_1: BFF意向样本 },
  });
  vi.mocked(后端.读取附件简历库).mockReturnValue(附件门.promise);
  const { deps, 状态引用, 最新后端状态 } = 创建P6会话依赖(后端);
  deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));

  const 登录 = 创建会话操作(deps).完成手机登录('1234');
  await vi.waitFor(() => expect(后端.读取附件简历库).toHaveBeenCalledTimes(1));
  expect(最新后端状态().已登录).toBe(false);
  expect(后端.读取简历).toHaveBeenCalledTimes(1);
  expect(后端.读取意向).toHaveBeenCalledTimes(1);
  expect(后端.读取隐私).toHaveBeenCalledTimes(1);
  expect(后端.读取Agent规则).toHaveBeenCalledWith('candidate');
  expect(后端.读取Agent规则提案列表).toHaveBeenCalledTimes(2);

  附件门.resolve(空附件库样本);
  await 登录;
  expect(最新后端状态().已登录).toBe(true);
  expect(最新后端状态().主体).toEqual(candidate主体);
  expect(状态引用.current.求职意向表).toHaveLength(1);
  expect(状态引用.current.基本信息).toEqual(expect.objectContaining({
    真名: BFF简历样本.profile.real_name,
  }));
});
```

- [ ] **Step 2: Add recruiter, null-role, 401, partial-failure, and supersession regressions**

Add these cases in the same describe:

```ts
it('已有 recruiter 短信登录执行组织、岗位和规则链', async () => {
  const 后端 = 创建P6数据源桩();
  vi.mocked(后端.读取主体).mockResolvedValue(recruiter主体);
  const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
  deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));

  await 创建会话操作(deps).完成手机登录('1234');

  expect(后端.读取招聘方档案).toHaveBeenCalledTimes(1);
  expect(后端.读取我的企业关系).toHaveBeenCalledTimes(1);
  expect(后端.读取岗位).toHaveBeenCalledTimes(1);
  expect(后端.读取Agent规则).toHaveBeenCalledWith('recruiter');
  expect(最新后端状态()).toMatchObject({
    已登录: true,
    主体: recruiter主体,
    招聘方组织水合: { 阶段: '成功', 错误: null },
  });
});

it('last_used_role null 登录不读取角色域', async () => {
  const 后端 = 创建P6数据源桩();
  vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, last_used_role: null });
  const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
  deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));
  await 创建会话操作(deps).完成手机登录('1234');
  expect(后端.读取简历).not.toHaveBeenCalled();
  expect(后端.读取岗位).not.toHaveBeenCalled();
  expect(后端.读取Agent规则).not.toHaveBeenCalled();
  expect(最新后端状态().已登录).toBe(true);
});

it('交互登录水合 401 不落登录态并统一清理', async () => {
  const 后端 = 创建P6数据源桩();
  vi.mocked(后端.读取主体).mockResolvedValue(candidate主体);
  vi.mocked(后端.读取意向).mockRejectedValue(
    new BFF错误(401, 'invalid_session', 'expired'),
  );
  const { deps, 最新后端状态, 状态引用 } = 创建P6会话依赖(后端);
  deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));
  await expect(创建会话操作(deps).完成手机登录('1234')).rejects.toMatchObject({
    status: 401,
    code: 'invalid_session',
  });
  expect(最新后端状态()).toMatchObject({ 已登录: false, 主体: null });
  expect(状态引用.current.求职意向表).toEqual([]);
  expect(最新后端状态().附件简历库).toBeNull();
});

it('recruiter 组织水合 401 同样拒绝并保持未登录', async () => {
  const 后端 = 创建P6数据源桩();
  vi.mocked(后端.读取主体).mockResolvedValue(recruiter主体);
  vi.mocked(后端.读取招聘方档案).mockRejectedValue(
    new BFF错误(401, 'invalid_session', 'expired'),
  );
  const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
  deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));

  await expect(创建会话操作(deps).完成手机登录('1234')).rejects.toMatchObject({
    status: 401,
    code: 'invalid_session',
  });

  expect(最新后端状态()).toMatchObject({ 已登录: false, 主体: null });
});

it('切身份水合 401 拒绝，让身份页阻止成功导航', async () => {
  const 后端 = 创建P6数据源桩();
  vi.mocked(后端.读取简历).mockRejectedValue(
    new BFF错误(401, 'invalid_session', 'expired'),
  );
  const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
  deps.主体标识引用.current = candidate主体.subject_id;

  await expect(创建会话操作(deps).切身份('求职者')).rejects.toMatchObject({
    status: 401,
    code: 'invalid_session',
  });
  expect(最新后端状态()).toMatchObject({ 已登录: false, 主体: null });
});

it('单域非 401 失败保留兄弟域并完成登录', async () => {
  const 后端 = 创建P6数据源桩();
  vi.mocked(后端.读取主体).mockResolvedValue(candidate主体);
  vi.mocked(后端.读取附件简历库).mockRejectedValue(
    new BFF错误(503, 'storage_unavailable', 'down'),
  );
  const { deps, 最新后端状态, 状态引用 } = 创建P6会话依赖(后端);
  deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));
  await expect(创建会话操作(deps).完成手机登录('1234')).resolves.toBeUndefined();
  expect(最新后端状态().已登录).toBe(true);
  expect(最新后端状态().附件简历库).toBeNull();
  expect(状态引用.current.基本信息.真名).toBe(BFF简历样本.profile.real_name);
});
```

Add an invocation-specific deferred regression for same-subject supersession:

```ts
it('同 subject 后一轮登录完成后前一轮迟到水合不能再次提交登录态', async () => {
  const 后端 = 创建P6数据源桩();
  const 第一简历门 = deferred<页面简历快照>();
  vi.mocked(后端.读取主体)
    .mockResolvedValueOnce(candidate主体)
    .mockResolvedValueOnce(candidate主体);
  vi.mocked(后端.读取简历)
    .mockReturnValueOnce(第一简历门.promise)
    .mockResolvedValue(从BFF简历(BFF简历样本));
  const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
  const 原设后端状态 = deps.设后端状态;
  const 登录提交 = vi.fn();
  deps.设后端状态 = (更新) => {
    const 之前 = 最新后端状态();
    原设后端状态(更新);
    const 之后 = 最新后端状态();
    if (!之前.已登录 && 之后.已登录) 登录提交(之后.主体?.subject_id);
  };
  deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));
  const 操作 = 创建会话操作(deps);

  const 第一轮 = 操作.完成手机登录('1111');
  await vi.waitFor(() => expect(后端.读取简历).toHaveBeenCalledTimes(1));
  const 第二轮 = 操作.完成手机登录('2222');
  await 第二轮;
  expect(登录提交).toHaveBeenCalledTimes(1);
  expect(最新后端状态()).toMatchObject({ 已登录: true, 主体: candidate主体 });

  第一简历门.resolve(从BFF简历(BFF简历样本));
  await 第一轮;
  expect(登录提交).toHaveBeenCalledTimes(1);
  expect(deps.会话代际.current).toBe(2);
});
```

Import `页面简历快照` from `../../数据/招聘数据源类型` for this test. The final transition spy deliberately counts only `false -> true`; intermediate hydration-state updates must not be mistaken for a session commit.

- [ ] **Step 3: Add the Provider no-recovery-session integration regression**

In `src/状态/应用状态.test.ts`, use `创建后端桩('candidate')` and the existing context probe:

```ts
it('无恢复会话后短信登录已有 candidate 会在导航可见前水合权威资料', async () => {
  let 当前!: ReturnType<typeof use应用状态>;
  function 探针() { 当前 = use应用状态(); return null; }
  const 后端 = 创建后端桩('candidate');
  vi.mocked(后端.恢复会话).mockRejectedValueOnce(
    new BFF错误(401, 'invalid_session', 'no session'),
  );
  vi.mocked(后端.读取主体).mockResolvedValueOnce({
    ...BFF主体样本,
    subject_id: 'sub-interactive',
    last_used_role: 'candidate',
  });
  render(createElement(
    应用状态提供者,
    { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端 } },
    createElement(探针),
  ));
  await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
  expect(当前.后端状态.已登录).toBe(false);

  await 当前.操作.完成手机登录('1234');

  expect(当前.后端状态.已登录).toBe(true);
  expect(当前.状态.基本信息.真名).toBe(BFF简历样本.profile.real_name);
  expect(当前.状态.求职意向表).not.toEqual([]);
  expect(后端.读取简历).toHaveBeenCalledTimes(1);
  expect(后端.读取意向).toHaveBeenCalledTimes(1);
});
```

Seed one active intention in this test's Backend stub; do not accept the default empty intention fixture.

- [ ] **Step 4: Run focused tests and record the RED**

```bash
npm test -- src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
```

Expected: the candidate/recruiter read assertions fail and the deferred test observes `已登录=true` before hydration because current `完成手机登录` never calls `水合角色数据`.

- [ ] **Step 5: Implement the atomic login orchestration**

In `创建会话操作`, define one complete hydration dependency object beside `账号清理依赖`:

```ts
const 角色水合依赖 = {
  后端: 后端!, 派发, 设后端状态, 主体标识引用, 会话代际, 读取恢复企业关系编号,
  P4范围代际, P4幂等意图, P4可见范围,
  P7范围代际, P7待定意图, P7可见收件箱, P7可见会话, P7已读位置,
  P8范围代际, P8账号可见, P8读取锁, P8待定意图,
};
```

Keep the existing cross-subject cleanup block before the new fence. After that block, replace the immediate login-state update with:

```ts
主体标识引用.current = 主体.subject_id;
会话代际.current += 1;
const 本次代际 = 会话代际.current;

派发({ 型: '清后端Agent规则' });
设后端状态((旧) => ({
  ...重置Agent规则后端状态(旧),
  ...创建空招聘方组织水合状态(),
  附件简历库: null,
}));

const 会话失效 = await 水合角色数据(角色水合依赖, 主体, false, 本次代际);
if (会话失效) {
  throw new BFF错误(401, 'invalid_session', 'expired');
}
if (
  主体标识引用.current !== 主体.subject_id ||
  会话代际.current !== 本次代际
) return;

设后端状态((旧) => ({ ...旧, 已登录: true, 主体 }));
```

In the existing `切身份` operation, replace its `if (会话失效) return` with the identical standard rejection:

```ts
if (会话失效) {
  throw new BFF错误(401, 'invalid_session', 'expired');
}
```

Import `创建空招聘方组织水合状态` from its post-predecessor module. Do not set `主体` during hydration. Do not call candidate draft storage directly. Keep `读取主体` failure behavior, cross-subject cleanup, generation increment, directory cleanup, P7/P8 semantics, and attempt handling unchanged. Candidate per-domain 401 messages were suppressed in Task 1, recruiter organization 401 is already returned without a toast, and stale 401 returns `false`. Therefore only a current terminal 401 throws: `登录.tsx` and `选身份.tsx` already catch it, map `invalid_session` to “登录已失效，请重新登录”, and skip their success navigation. Cold-start sees the boolean directly and remains silent.

- [ ] **Step 6: Run focused tests and commit**

```bash
npm test -- src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
npm run typecheck
git diff --check
git add src/状态/后端/会话操作.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
git commit -m "fix: hydrate roles before SMS login commit"
```

### Task 3: Leave Backend landing ownership in the predecessor root guard

**Files:**
- Modify: `src/屏幕/登录.tsx`
- Modify: `src/屏幕/登录.test.tsx`
- Modify: `src/屏幕/选身份.test.tsx`
- Inspect: `src/应用.tsx`
- Modify: `src/应用.test.tsx`

**Interfaces:**
- Consumes: Task 2's delayed login commit and predecessor recruiter phase-aware route guard.
- Produces: a Backend login page with zero post-success navigation and an explicit disabled “正在进入…” pending state, while Mock retains immediate identity navigation.

- [ ] **Step 1: Rewrite the login-page regression around single ownership**

In `src/屏幕/登录.test.tsx`, replace the hard-coded Backend mode mock with a hoisted mutable mode:

```ts
const mock环境 = vi.hoisted(() => ({ 数据源模式: 'backend' as 'backend' | 'mock' }));

vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({ 操作: mock操作, 数据源模式: mock环境.数据源模式 }),
}));
```

Reset it to `backend` in `beforeEach`. Change the current success test's final assertion:

```ts
const 等待按钮 = screen.getByRole('button', { name: '正在进入…' });
expect((等待按钮 as HTMLButtonElement).disabled).toBe(true);
expect(mock操作.完成手机登录).toHaveBeenCalledWith('1234');
expect(mock跳转).not.toHaveBeenCalled();

完成.resolve();
await act(async () => { await 完成.promise; });
expect(mock跳转).not.toHaveBeenCalled();
const 恢复按钮 = screen.getByRole('button', { name: '进入' });
expect((恢复按钮 as HTMLButtonElement).disabled).toBe(false);
```

Add a Mock regression:

```ts
it('Mock 短信登录仍由登录页进入身份选择', async () => {
  mock环境.数据源模式 = 'mock';
  const 用户 = userEvent.setup();
  render(<MemoryRouter><登录 /></MemoryRouter>);
  await 用户.type(screen.getByLabelText('手机号'), '13800000000');
  await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
  await 用户.type(screen.getByLabelText('短信验证码'), '1234');
  await 用户.click(screen.getByText(/已阅读并同意/));
  await 用户.click(screen.getByRole('button', { name: '进入' }));
  expect(mock跳转).toHaveBeenCalledWith(路径.选身份);
  expect(mock操作.完成手机登录).not.toHaveBeenCalled();
});
```

Add a Backend session-expiry case in `登录.test.tsx` using `BFF错误` from `../数据/HTTP客户端`:

```tsx
it('Backend 水合 401 显示一次会话失效且不导航', async () => {
  mock操作.开始手机登录.mockResolvedValue(undefined);
  mock操作.完成手机登录.mockRejectedValueOnce(
    new BFF错误(401, 'invalid_session', 'expired'),
  );
  const 用户 = userEvent.setup();
  render(<MemoryRouter><登录 /></MemoryRouter>);
  await 用户.type(screen.getByLabelText('手机号'), '13800000000');
  await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
  await 用户.type(screen.getByLabelText('短信验证码'), '1234');
  await 用户.click(screen.getByText(/已阅读并同意/));
  await 用户.click(screen.getByRole('button', { name: '进入' }));

  await waitFor(() => expect(screen.getByText('登录已失效，请重新登录')).toBeTruthy());
  expect(mock跳转).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: '进入' }) as HTMLButtonElement).disabled).toBe(false);
});
```

Extend `src/屏幕/选身份.test.tsx` with the corresponding page-owner assertion; reuse its existing mocks and ordinary-mode harness:

First extend the file's existing `beforeEach` so the module-level DOM toast container cannot leak a same-copy entry between the ordinary and flip-mode cases:

```ts
beforeEach(() => {
  mock跳转.mockClear();
  mock替换跳转.mockClear();
  mock返回.mockClear();
  mock切身份.mockClear();
  const 提示容器 = Array.from(document.body.children).find(
    (节点) => (节点 as HTMLElement).style?.zIndex === '999',
  ) as HTMLElement | undefined;
  if (提示容器) 提示容器.innerHTML = '';
});
```

Do not export a test-only reset API from `轻提示`; the DOM cleanup belongs to this component-test harness.

```tsx
it('切身份水合 401 显示会话失效且不执行成功导航', async () => {
  mock切身份.mockRejectedValueOnce(
    new BFF错误(401, 'invalid_session', 'expired'),
  );
  const 用户 = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/identity']}>
      <选身份 />
    </MemoryRouter>,
  );
  await 用户.click(screen.getByText('我要找工作'));
  await waitFor(() => expect(screen.getByText('登录已失效，请重新登录')).toBeTruthy());
  expect(mock跳转).not.toHaveBeenCalled();
  expect(mock替换跳转).not.toHaveBeenCalled();
});

it('翻面切换水合 401 也不执行替换导航', async () => {
  vi.useFakeTimers();
  try {
    mock切身份.mockRejectedValueOnce(
      new BFF错误(401, 'invalid_session', 'expired'),
    );
    const 用户 = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <MemoryRouter initialEntries={['/identity?switch=1&from=hr']}>
        <选身份 />
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: '翻到「求职者」那一面' }));
    await act(async () => { vi.advanceTimersByTime(950); });
    expect(screen.getByText('登录已失效，请重新登录')).toBeTruthy();
    expect(mock替换跳转).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
```

Import `act` and `BFF错误` in that test as well. These component tests own toast/navigation behavior; session-operation tests own cleanup and rejection shape.

- [ ] **Step 2: Extend, do not replace, the integrated root-route tests**

In `src/应用.test.tsx`, keep all recruiter missing/success/failure/recovery-path cases and the existing basic candidate/null-role landing cases. Reuse its existing `mock应用状态`, `后端应用值`, `位置探针`, and `MemoryRouter` harness; add only the missing delayed-commit/single-navigation regression:

```tsx
it('candidate 只在水合后登录态提交时 replace 一次', async () => {
  const 路径记录 = vi.fn();
  function 路径记录探针() {
    const 位置 = useLocation();
    useEffect(() => { 路径记录(位置.pathname); }, [位置.pathname]);
    return <span data-testid="pathname">{位置.pathname}</span>;
  }
  mock应用状态.mockReturnValue(后端应用值({
    初始化: '完成', 已登录: false, 主体: null,
  }));
  const 树 = () => (
    <MemoryRouter initialEntries={[路径.登录]}>
      <应用 />
      <路径记录探针 />
    </MemoryRouter>
  );
  const { rerender } = render(树());
  expect(screen.getByTestId('pathname').textContent).toBe(路径.登录);

  mock应用状态.mockReturnValue(后端应用值({
    初始化: '完成', 已登录: true,
    主体: { ...BFF主体样本, last_used_role: 'candidate' },
  }));
  rerender(树());
  await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe(路径.主壳));
  expect(路径记录.mock.calls.filter(([值]) => 值 === 路径.主壳)).toHaveLength(1);
});

```

Import `useEffect` for the path-recording probe; `useLocation` is already imported by the integrated test file. Do not create a second full-app state mock, duplicate the existing null-role/basic-candidate cases, or replace the recruiter cases.

- [ ] **Step 3: Run the tests and confirm the Backend assertion fails**

```bash
npm test -- src/屏幕/登录.test.tsx src/屏幕/选身份.test.tsx src/应用.test.tsx
```

Expected: Backend login test fails because `登录.tsx` still calls `跳转(路径.选身份)` after the operation resolves and exposes no pending label/disabled state. Predecessor recruiter guard tests remain green.

- [ ] **Step 4: Remove only the Backend SMS navigation**

In `src/屏幕/登录.tsx`, keep the existing `进入中` ref as the synchronous duplicate-click guard and add `const [正在进入, 设正在进入] = useState(false)`. Set both guards before the await, and change the Backend `try` body to:

```ts
try {
  await 操作.完成手机登录(验证码);
} catch (错误) {
  轻提示(取后端错误文案(错误));
} finally {
  进入中.current = false;
  设正在进入(false);
}
```

Immediately after `进入中.current = true`, call `设正在进入(true)`. Render the existing shared button as:

```tsx
<主按钮
  文字={正在进入 ? '正在进入…' : '进入'}
  按下={进入下一步}
  禁用={!可进入 || 正在进入}
/>
```

Keep the Mock branch's `跳转(路径.选身份)` unchanged; Mock never sets the pending state. Do not simplify or replace the predecessor recruiter effect in `src/应用.tsx`; only make a product edit there if the new tests expose a duplicate-navigation defect, and in that case add the exact failing assertion before changing the effect.

- [ ] **Step 5: Run focused tests and commit**

```bash
npm test -- src/屏幕/登录.test.tsx src/屏幕/选身份.test.tsx src/应用.test.tsx
git diff --check
git add src/屏幕/登录.tsx src/屏幕/登录.test.tsx src/屏幕/选身份.test.tsx src/应用.test.tsx
git commit -m "fix: centralize Backend login landing"
```

### Task 4: Remove Mock identity copy from the Backend candidate profile

**Files:**
- Modify: `src/屏幕/我的.tsx`
- Create: `src/屏幕/我的.test.tsx`

**Interfaces:**
- Consumes: `数据源模式`, authoritative `状态.基本信息`, and raw `后端状态.简历快照.profile.status`.
- Produces: Backend copy `未填写姓名` / `资料暂不可用` / `未填写求职状态` / authoritative identity and an authority-only avatar initial, with existing Mock copy unchanged.

- [ ] **Step 1: Add Backend and Mock component regressions**

Create `src/屏幕/我的.test.tsx`. Mock `use导航` and `use应用状态`; base the root page state on `初始状态` so all unrelated lists exist:

```tsx
interface 我的测试上下文 {
  状态: typeof 初始状态;
  派发: ReturnType<typeof vi.fn>;
  数据源模式: 'backend' | 'mock';
  后端状态: {
    Agent规则水合: {
      candidate: { rules: '未开始'; proposals: '未开始' };
      recruiter: { rules: '未开始'; proposals: '未开始' };
    };
    简历快照: BFF简历 | null;
  };
}

const mock上下文 = vi.hoisted(() => ({ 当前: null as 我的测试上下文 | null }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock上下文.当前 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: vi.fn() }) }));

function 布置(
  模式: 'backend' | 'mock',
  选项: {
    真名?: string;
    身份?: '在校' | '在职' | '离职';
    服务端状态?: BFF简历['profile']['status'];
  } = {},
) {
  mock上下文.当前 = {
    状态: {
      ...初始状态,
      基本信息: {
        ...初始状态.基本信息,
        真名: 选项.真名 ?? '',
        身份: 选项.身份 ?? '在职',
      },
    },
    派发: vi.fn(),
    数据源模式: 模式,
    后端状态: {
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      简历快照: 选项.服务端状态 === undefined
        ? null
        : {
            ...BFF简历样本,
            profile: { ...BFF简历样本.profile, status: 选项.服务端状态 },
          },
    },
  };
  return render(<我的 />);
}

it('Backend 空简历显示中性占位且不泄漏 Mock 身份', () => {
  布置('backend');
  expect(screen.getByText('未填写姓名')).toBeTruthy();
  expect(screen.getByText('资料暂不可用')).toBeTruthy();
  expect(screen.queryByText('沈亦舟')).toBeNull();
  expect(screen.queryByText('在职 · 保密求职中')).toBeNull();
  const 头像行 = screen.getByRole('button', { name: /未填写姓名/ });
  expect(头像行.textContent?.startsWith('未未填写姓名')).toBe(false);
});

it('Backend 已水合但服务端 status 为空时不采用表单默认在职', () => {
  布置('backend', { 服务端状态: '' });
  expect(screen.getByText('未填写求职状态')).toBeTruthy();
  expect(screen.queryByText('在职')).toBeNull();
});

it('Backend 已水合简历只显示非空权威姓名与身份', () => {
  布置('backend', { 真名: '林澈', 身份: '离职', 服务端状态: 'unemployed' });
  expect(screen.getByText('林澈')).toBeTruthy();
  expect(screen.getByText('离职')).toBeTruthy();
  expect(screen.queryByText(/保密求职中/)).toBeNull();
});

it('Mock 保留原型姓名与状态兜底', () => {
  布置('mock');
  expect(screen.getByText('沈亦舟')).toBeTruthy();
  expect(screen.getByText('在职 · 保密求职中')).toBeTruthy();
});
```

Import `type BFF简历` from `../数据/BFF契约` and `BFF简历样本` from `../测试/BFF样本`. Use the typed local test-context interface above; the production assertions and copy must remain exact.

- [ ] **Step 2: Run the new test and record the RED**

```bash
npm test -- src/屏幕/我的.test.tsx
```

Expected: Backend cases fail because both name and status still read `我的信息`.

- [ ] **Step 3: Split Backend and Mock projections in the component**

In `src/屏幕/我的.tsx`, replace the current name projection and add one status projection:

```ts
const 是后端 = 数据源模式 === 'backend';
const 权威姓名 = 状态.基本信息.真名.trim();
const 姓名 = 是后端
  ? 权威姓名 || '未填写姓名'
  : 权威姓名 || 我的信息.姓名;
const 头像首字 = 是后端 ? 权威姓名.charAt(0) : 姓名.charAt(0);
const 状态文案 = 是后端
  ? 后端状态.简历快照 === null
    ? '资料暂不可用'
    : 后端状态.简历快照.profile.status === ''
      ? '未填写求职状态'
      : 状态.基本信息.身份
  : 我的信息.状态;
```

Render `{头像首字}` instead of `姓名.charAt(0)` in the no-image avatar and `{状态文案}` in the status pill. Do not add a page effect or data-source call, and do not change the form mapper's existing registration-flow default.

- [ ] **Step 4: Run focused tests and commit**

```bash
npm test -- src/屏幕/我的.test.tsx src/屏幕/我的简历.test.tsx
npm run typecheck
git diff --check
git add src/屏幕/我的.tsx src/屏幕/我的.test.tsx
git commit -m "fix: isolate Backend candidate identity copy"
```

### Task 5: Run the session/navigation regression matrix

**Files:**
- No product files; this is a verification gate before the independent wheel Plan.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: a clean, test-verified login-hydration branch state ready for the accessibility Plan.

- [ ] **Step 1: Run the complete focused matrix from the handoff plus predecessor seams**

```bash
npm test -- src/状态/后端/会话操作.test.ts src/状态/后端/组织操作.test.ts src/状态/应用状态.test.ts src/屏幕/登录.test.tsx src/屏幕/选身份.test.tsx src/应用.test.tsx src/屏幕/我的.test.tsx src/屏幕/添加意向.test.tsx src/屏幕/我的简历.test.tsx src/数据/HTTP招聘数据源.test.ts
```

Expected: all listed files pass. Specifically record candidate, recruiter missing-profile/success/failure, null role, current 401, stale 401, same-subject, cross-subject, StrictMode, and Mock isolation cases.

- [ ] **Step 2: Run static checks**

```bash
npm run typecheck
npm run lint
git diff --check
git status --short
```

Expected: every command exits `0` and `git status --short` is empty. Do not create a verification-only commit.

## Login Plan Completion Report

Return:

- the two predecessor implementation commit SHAs used as the base;
- per-task commit SHAs;
- the focused RED reason and GREEN result for each task;
- candidate/recruiter/null request counts after interactive SMS login;
- current-401 and stale-401 final state evidence;
- confirmation that predecessor recruiter recovery tests and candidate draft persistence tests remained green;
- exit status for the complete focused matrix, typecheck, lint, and diff check.
