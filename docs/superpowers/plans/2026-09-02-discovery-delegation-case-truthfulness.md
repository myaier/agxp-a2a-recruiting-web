# Discovery, Delegation, and Case Truthfulness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate recruiter discovery on authoritative organization facts, recover candidate deep links within the active intention, and present P4/P5 states and Case navigation without inferred success.

**Architecture:** Add two closed pure selectors to the existing discovery mapping module, then reuse them across current candidate/recruiter pages. Keep all reads, refreshes, writes, single-flight behavior, idempotency, and generation fencing in the existing operations; page changes are limited to request gating, current-scope lookup, safe navigation, existing-slot copy, and button state.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, Testing Library, Vite.

**Spec:** `docs/superpowers/specs/2026-09-02-frontend-truthfulness-batch-design.md`

**Execution order:** This is Slice 2 of 3. Start only after Slice 1 is committed in the same worktree; use named symbols rather than frozen numeric line anchors where Slice 1 moved code. One writer continues with Slice 3 after this Plan. Do not parallelize these Plans.

## Global Constraints

- Frontend baseline is `origin/main@b2827dae16e89b199b487ab1564246b7b66e34f6`.
- Backend contract baseline is `release/0.2.5@45f7323e34f6f6db11faee658144e28d338b36be`.
- Do not modify runtime files under `src/组件/**`; colocated test files are allowed only for existing cross-page assertions.
- Do not create a visual component or modify CSS.
- Do not modify `src/数据/BFF契约.ts` or accept future wire enums/error codes.
- Use only `hiring_organization_verification_status`, `hiring_organization_ref`, the active `intention_id`, recommendation summaries, delegation GET/receipts, and server `case_id`.
- Never inspect another intention to recover recommendation coordinates.
- Never derive organization verification or Case identifiers from names, aliases, claims, labels, or Mock data.
- Backend failure must not activate a Mock reducer, local Case, local success, timer, or storage fallback.
- Follow TDD and commit every independently testable task.

## File Responsibility Map

- `src/数据/发现推荐映射.ts`: organization-prerequisite and delegation-presentation pure selectors.
- `src/数据/发现推荐映射.test.ts`: closed selector tables and no-inference tests.
- `src/状态/后端/发现推荐操作.ts`: retain every authoritative non-null six-state delegation summary while keeping terminal candidate cards non-progressing.
- `src/状态/后端/发现推荐操作.test.ts`: mutation/GET terminal receipt landing and refusal-reason coverage.
- `src/屏幕/候选推荐.tsx`: recruiter organization gate, scoped error classification, and recruiter delegation status/navigation.
- `src/屏幕/候选推荐.test.tsx`: prerequisite, zero-request, error, state, and Case navigation tests.
- `src/屏幕/看市场.tsx`: candidate delegation status/navigation and market origin marker.
- `src/屏幕/看市场.test.tsx`: status recovery, server Case ID, and origin-state tests.
- `src/屏幕/职位详情.tsx`: active-intention recommendation hydration, safe return, read-only fallback, and candidate delegation status/navigation.
- `src/屏幕/职位详情.test.tsx`: deep-link, cross-intention, stale-scope, read-only, and safe-return tests.
- `src/屏幕/匿名在线简历.tsx`: recruiter detail delegation status/navigation.
- `src/屏幕/匿名在线简历.test.tsx`: recruiter state and server Case ID tests.
- `src/数据/MatchCase展示映射.ts`: four exact AI step-copy corrections.
- `src/数据/MatchCase展示映射.test.ts`: 17-row table and action-boundary regression.
- `src/屏幕/P5/MatchCase详情.test.tsx`: parse/screening/manual-decision copy and privacy assertions.
- `src/屏幕/P5/MatchCase列表.test.tsx`: existing server Case ID navigation regression gate.
- `src/屏幕/P5/MatchCase历史.test.tsx`: existing historical server Case ID navigation regression gate.

---

### Task 1: Add Closed Organization and Delegation Presentation Selectors

**Files:**
- Modify: `src/数据/发现推荐映射.test.ts:1-130`
- Modify: `src/数据/发现推荐映射.ts:7-30,130-191`

**Interfaces:**
- Consumes: `BFFOwnerJob`, `BFF委托摘要`, and an optional same-delegation `BFF委托回执`.
- Produces: `判断P4招聘组织前提(job)`, `P4拒绝原因文案(code)`, and `映射P4委托展示(summary, receipt)` for Tasks 2-4.

- [ ] **Step 1: Write failing organization-prerequisite table tests**

Add imports for the two new functions and cover every authoritative combination:

```ts
describe('判断P4招聘组织前提', () => {
  it('missing owner snapshot is unknown, not unverified', () => {
    expect(判断P4招聘组织前提(undefined)).toEqual({ kind: 'unknown' });
  });

  it.each([
    [{ ...BFF岗位样本, hiring_organization_verification_status: 'unverified' }, 'unverified'],
    [{ ...BFF岗位样本, hiring_organization_verification_status: 'verified', hiring_organization_ref: undefined }, 'missing_ref'],
    [{ ...BFF岗位样本, hiring_organization_verification_status: 'verified', hiring_organization_ref: '   ' }, 'missing_ref'],
  ] as const)('blocks only from owner Job evidence', (job, reason) => {
    expect(判断P4招聘组织前提(job)).toEqual({ kind: 'blocked', reason });
  });

  it('requires verified plus a non-blank opaque ref', () => {
    expect(判断P4招聘组织前提({
      ...BFF岗位样本,
      hiring_organization_verification_status: 'verified',
      hiring_organization_ref: 'org_9',
    })).toEqual({ kind: 'ready', organizationRef: 'org_9' });
  });
});
```

- [ ] **Step 2: Write the six-state delegation presentation table test**

Import `BFF招聘委托回执样本` from `../测试/BFF样本` alongside the existing Job/recommendation samples.

```ts
describe('映射P4委托展示', () => {
  it.each([
    ['accepted', '已提交给 AI，等待处理', true, null],
    ['evaluating', 'AI 正在评估', true, null],
    ['case_started', '已创建真实在谈', false, 'case_server_1'],
    ['needs_user', '需要你处理', false, null],
    ['refused', '本次未能继续', false, null],
    ['failed', '本次处理未完成', false, null],
  ] as const)('%s maps to closed copy and navigation', (state, copy, inProgress, caseId) => {
    expect(映射P4委托展示({
      delegation_id: 'del_1',
      state,
      case_id: state === 'case_started' ? 'case_server_1' : null,
    }, null)).toEqual({ state, copy, reason: null, inProgress, caseId });
  });

  it('case_started with a blank case_id exposes no navigation', () => {
    expect(映射P4委托展示({
      delegation_id: 'del_1', state: 'case_started', case_id: '   ',
    }, null)?.caseId).toBeNull();
  });

  it('null summary stays null', () => {
    expect(映射P4委托展示(null, null)).toBeNull();
  });

  it('uses a refusal reason only from the same authoritative receipt', () => {
    const summary = { delegation_id: 'del_1', state: 'refused' as const, case_id: null };
    const receipt = {
      ...BFF招聘委托回执样本,
      delegation_id: 'del_1', state: 'refused' as const,
      refusal_code: 'active_case_quota_reached' as const, case_id: null,
    };
    expect(映射P4委托展示(summary, receipt)?.reason)
      .toBe('当前在谈已达到上限，请先处理已有在谈');
    expect(映射P4委托展示(summary, { ...receipt, delegation_id: 'del_other' })?.reason)
      .toBeNull();
  });
});
```

- [ ] **Step 3: Run the mapper tests and verify missing exports fail**

```bash
npm run test -- src/数据/发现推荐映射.test.ts
```

Expected: FAIL because the organization selector, delegation selector, and refusal-reason export are absent.

- [ ] **Step 4: Implement the closed selectors without fallbacks**

Extend the type-only imports and add:

```ts
import type {
  BFFCandidateJob,
  BFFOwnerJob,
  BFF候选岗位推荐,
  BFF委托回执,
  BFF委托摘要,
  BFF招聘候选推荐,
  BFF淘汰原因,
} from './BFF契约';

export type P4招聘组织前提 =
  | { kind: 'unknown' }
  | { kind: 'blocked'; reason: 'unverified' | 'missing_ref' }
  | { kind: 'ready'; organizationRef: string };

export function 判断P4招聘组织前提(job: BFFOwnerJob | null | undefined): P4招聘组织前提 {
  if (job == null) return { kind: 'unknown' };
  if (job.hiring_organization_verification_status !== 'verified') {
    return { kind: 'blocked', reason: 'unverified' };
  }
  const organizationRef = job.hiring_organization_ref?.trim() ?? '';
  return organizationRef === ''
    ? { kind: 'blocked', reason: 'missing_ref' }
    : { kind: 'ready', organizationRef };
}

export interface P4委托展示 {
  state: BFF委托摘要['state'];
  copy: string;
  reason: string | null;
  inProgress: boolean;
  caseId: string | null;
}

const P4委托状态文案 = {
  accepted: '已提交给 AI，等待处理',
  evaluating: 'AI 正在评估',
  case_started: '已创建真实在谈',
  needs_user: '需要你处理',
  refused: '本次未能继续',
  failed: '本次处理未完成',
} as const satisfies Record<BFF委托摘要['state'], string>;

const P4拒绝原因文案表 = {
  recommendation_not_found: '这条推荐当前已不可用，请刷新后查看',
  recommendation_unavailable: '这条推荐当前已不可用，请刷新后查看',
  delegation_not_allowed: '当前无法发起委托，请刷新后重试',
  active_case_quota_reached: '当前在谈已达到上限，请先处理已有在谈',
  delegation_cooldown: '近期已联系过对方，暂时不能重复发起',
} as const satisfies Record<NonNullable<BFF委托回执['refusal_code']>, string>;

export function P4拒绝原因文案(
  code: NonNullable<BFF委托回执['refusal_code']>,
): string {
  return P4拒绝原因文案表[code];
}

export function 映射P4委托展示(
  summary: BFF委托摘要 | null,
  receipt: BFF委托回执 | null,
): P4委托展示 | null {
  if (summary === null) return null;
  const caseId = summary.state === 'case_started' && summary.case_id?.trim()
    ? summary.case_id
    : null;
  return {
    state: summary.state,
    copy: P4委托状态文案[summary.state],
    reason: summary.state === 'refused'
      && receipt?.delegation_id === summary.delegation_id
      && receipt.state === 'refused'
      && receipt.refusal_code !== null
      ? P4拒绝原因文案(receipt.refusal_code)
      : null,
    inProgress: summary.state === 'accepted' || summary.state === 'evaluating',
    caseId,
  };
}
```

Do not add a `default` branch, future status, company-name fallback, or derived Case ID.

- [ ] **Step 5: Run mapper and decoder regression tests**

```bash
npm run test -- src/数据/发现推荐映射.test.ts src/数据/招聘数据源/发现推荐.test.ts
npm run typecheck
```

Expected: all pass and the existing strict decoder remains closed.

- [ ] **Step 6: Commit the pure selectors**

```bash
git add src/数据/发现推荐映射.ts src/数据/发现推荐映射.test.ts
git commit -m "feat: add discovery truthfulness selectors"
```

---

### Task 2: Gate Recruiter Recommendations with the Current Owner Job

**Files:**
- Modify: `src/屏幕/候选推荐.test.tsx:65-250,450-475`
- Modify: `src/屏幕/候选推荐.tsx:181-251,304-400`

**Interfaces:**
- Consumes: `判断P4招聘组织前提` from Task 1, `后端状态.岗位快照[jobId]`, existing P4 operations, and existing certification/join routes.
- Produces: no exported API; the recruiter recommendation screen issues list/refresh requests only for a `ready` job.

- [ ] **Step 1: Extend the Backend test state with authoritative owner Jobs**

Make `置P4状态` accept an optional owner Job and default it to a verified job with a ref:

```tsx
function 置P4状态(选项: {
  快照?: ReturnType<typeof P4快照>;
  岗位编号?: string;
  岗位列表?: Record<string, unknown>[];
  ownerJob?: BFFOwnerJob | null;
  操作?: Record<string, unknown>;
}) {
  const 编号 = 选项.岗位编号 ?? 岗位编号;
  const ownerJob = 选项.ownerJob === undefined
    ? {
        ...BFF岗位样本,
        job_id: 编号,
        hiring_organization_verification_status: 'verified' as const,
        hiring_organization_ref: 'org_1',
      }
    : 选项.ownerJob;
  mock应用状态 = {
    数据源模式: 'backend', 派发: mock派发,
    状态: {
      当前岗位编号: 编号,
      岗位列表: 选项.岗位列表 ?? [{ ...页面岗位样本, 编号, 状态: '在招' }],
      企业规则: [], 企业子视图: '推荐', 推荐列表: [], 收藏候选: [],
      不合适候选: {}, 已接触推荐: [],
    },
    后端状态: {
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '成功', proposals: '成功' },
      },
      岗位快照: ownerJob === null ? {} : { [编号]: ownerJob },
      招聘可用候选: {
        [编号]: 选项.快照 ?? P4快照({ 阶段: '成功', items: [BFF招聘候选推荐样本] }),
      },
      P4委托回执: {},
    },
    操作: 发现推荐操作桩(选项.操作),
  };
}
```

- [ ] **Step 2: Write failing prerequisite and zero-request tests**

```tsx
it.each([
  ['unverified', { ...BFF岗位样本, hiring_organization_verification_status: 'unverified' as const }],
  ['missing ref', { ...BFF岗位样本, hiring_organization_verification_status: 'verified' as const, hiring_organization_ref: undefined }],
] as const)('%s job shows organization guidance and sends no discovery request', async (_name, ownerJob) => {
  置P4状态({
    ownerJob,
    操作: { 加载招聘候选: mock加载招聘候选, 刷新招聘候选: mock刷新招聘候选 },
  });
  render(<候选推荐 />);
  expect(screen.getByText(/匿名候选推荐需要已验证的用人组织/)).toBeTruthy();
  expect(mock加载招聘候选).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /加入企业/ }));
  expect(mock刷新招聘候选).not.toHaveBeenCalled();
  expect(mock跳转).toHaveBeenCalledWith(路径.企业邀请加入);
});

it('missing owner snapshot stays neutral and sends no request', () => {
  置P4状态({ ownerJob: null, 操作: { 加载招聘候选: mock加载招聘候选 } });
  render(<候选推荐 />);
  expect(screen.getByText(/正在加载岗位信息/)).toBeTruthy();
  expect(screen.queryByText(/需要已验证的用人组织/)).toBeNull();
  expect(mock加载招聘候选).not.toHaveBeenCalled();
});

it('verified job with ref keeps the exact existing load and refresh requests', async () => {
  置P4状态({ 操作: { 加载招聘候选: mock加载招聘候选, 刷新招聘候选: mock刷新招聘候选 } });
  render(<候选推荐 />);
  expect(mock加载招聘候选).toHaveBeenCalledWith(岗位编号);
  await userEvent.click(screen.getByRole('button', { name: '让代理再找一批' }));
  expect(mock刷新招聘候选).toHaveBeenCalledWith(岗位编号);
});
```

- [ ] **Step 3: Write the legacy generic-error evidence test**

Start a refresh while the same job is ready, rerender the current owner snapshot as blocked, then reject the original promise:

```tsx
it('maps legacy recommendation_unavailable to organization guidance only with same-job evidence', async () => {
  const refresh = deferred<void>();
  置P4状态({ 操作: { 刷新招聘候选: vi.fn(() => refresh.promise) } });
  const page = render(<候选推荐 />);
  await userEvent.click(screen.getByRole('button', { name: '让代理再找一批' }));

  置P4状态({
    ownerJob: { ...BFF岗位样本, job_id: 岗位编号, hiring_organization_verification_status: 'unverified' },
  });
  page.rerender(<候选推荐 />);
  refresh.reject(new BFF错误(409, 'recommendation_unavailable', 'legacy'));
  await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith(
    '匿名候选推荐需要已验证的用人组织',
  ));
});

it.each([
  new BFF错误(503, 'source_unavailable', 'down'),
  new BFF错误(401, 'unauthorized', 'expired'),
  new BFF错误(409, 'unknown_code', 'unknown'),
])('does not misclassify %s as organization verification', async (error) => {
  mock刷新招聘候选.mockRejectedValueOnce(error);
  置P4状态({ 操作: { 刷新招聘候选: mock刷新招聘候选 } });
  render(<候选推荐 />);
  await userEvent.click(screen.getByRole('button', { name: '让代理再找一批' }));
  await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
  expect(mock轻提示).not.toHaveBeenCalledWith('匿名候选推荐需要已验证的用人组织');
});
```

- [ ] **Step 4: Run the screen tests and verify the current unconditional request fails**

```bash
npm run test -- src/屏幕/候选推荐.test.tsx
```

Expected: blocked and unknown owner Jobs still call `加载招聘候选`, and the page lacks organization guidance.

- [ ] **Step 5: Implement the tri-state gate with live request evidence**

Derive the current owner job and selector result:

```tsx
const ownerJob = 活跃岗位 === null ? null : 后端状态.岗位快照[活跃岗位];
const 组织前提 = 活跃岗位 === null
  ? ({ kind: 'unknown' } as const)
  : 判断P4招聘组织前提(ownerJob);
const 当前岗位引用 = useRef(活跃岗位);
const 组织前提引用 = useRef(组织前提);
当前岗位引用.current = 活跃岗位;
组织前提引用.current = 组织前提;
```

Register/load only when `组织前提.kind === 'ready'`. The effect cleanup still clears the recruiter visible scope. Gate reread and refresh the same way.

For refresh error copy, capture the request job and consult the live refs:

```tsx
const 请代理再找一批 = () => {
  if (活跃岗位 === null || 组织前提.kind !== 'ready') return;
  const 发起岗位 = 活跃岗位;
  void 操作.刷新招聘候选(发起岗位).catch((错误: unknown) => {
    const 同岗受阻 = 当前岗位引用.current === 发起岗位
      && 组织前提引用.current.kind === 'blocked';
    if (错误 instanceof BFF错误
      && 错误.code === 'recommendation_unavailable'
      && 同岗受阻) {
      轻提示('匿名候选推荐需要已验证的用人组织');
      return;
    }
    轻提示(P4错误文案(错误));
  });
};
```

Reuse the existing visible slots:

- `unknown`: existing empty-state slot says `正在加载岗位信息…`.
- `blocked`: existing banner says the verified-organization prerequisite and navigates to `路径.企业实名认证`; existing empty-state repeats the reason; existing supply button text becomes `加入企业` and navigates to `路径.企业邀请加入`.
- `ready`: current copy and handlers remain.

The blocked/unknown supply control must have an accessible name that includes the reason and must not retain the refresh handler.

- [ ] **Step 6: Run focused tests**

```bash
npm run test -- src/屏幕/候选推荐.test.tsx src/数据/发现推荐映射.test.ts
```

Expected: all pass, including existing feedback and polling tests.

- [ ] **Step 7: Commit the organization gate**

```bash
git add src/屏幕/候选推荐.tsx src/屏幕/候选推荐.test.tsx
git commit -m "fix: gate recruiter discovery on verified organization"
```

---

### Task 3: Recover Active-Intention Coordinates and Add Safe Return

**Files:**
- Modify: `src/屏幕/职位详情.test.tsx:220-520`
- Modify: `src/屏幕/看市场.test.tsx:455-830`
- Modify: `src/屏幕/职位详情.tsx:170-370`
- Modify: `src/屏幕/看市场.tsx:360-405`

**Interfaces:**
- Consumes: existing `操作.加载候选岗位(intentionId)`, `P4范围键.候选详情(jobId)`, `状态.当前意向编号`, `后端状态.初始化`, existing navigation methods, and existing reducer actions.
- Produces: location state `{ 来源: 'candidate-market' }` and page-local `安全返回()`; no exported route or cache API.

- [ ] **Step 1: Add operation/navigation spies to the detail test harness**

Ensure the mocked navigation hook exposes `返回`, `跳转`, and `替换跳转`, and the operation stub exposes `加载候选岗位`. Add `后端状态.初始化: '完成'` to the default Backend state so existing tests represent post-hydration rendering.

```tsx
const mock返回 = vi.fn();
const mock替换跳转 = vi.fn();
const mock加载候选岗位 = vi.fn(async () => undefined);

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 跳转: mock跳转, 替换跳转: mock替换跳转 }),
}));
```

- [ ] **Step 2: Write failing deep-link recovery tests**

```tsx
it('reuses the active intention snapshot without an extra list request', () => {
  渲染Backend状态({
    当前意向编号: 'int_current',
    候选岗位推荐: {
      int_current: { 阶段: '成功', 刷新中: false, items: [
        { ...推荐卡样本, intention_id: 'int_current' },
      ], error: null, generation: 1 },
    },
  });
  渲染('job_1');
  expect(mock加载候选岗位).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '让AI代理去谈' })).toBeTruthy();
});

it('missing snapshot loads only the current intention and restores its coordinates', async () => {
  渲染Backend状态({
    当前意向编号: 'int_current',
    候选岗位推荐: {},
    候选岗位详情: { job_1: BFFCandidateJob样本 },
  });
  const page = 渲染('job_1');
  expect(mock加载候选岗位).toHaveBeenCalledWith('int_current');
  expect(screen.getByRole('button', { name: /正在恢复推荐信息/ })).toBeTruthy();

  渲染Backend状态({
    当前意向编号: 'int_current',
    候选岗位推荐: {
      int_current: { 阶段: '成功', 刷新中: false, items: [
        { ...推荐卡样本, intention_id: 'int_current' },
      ], error: null, generation: 1 },
    },
    候选岗位详情: { job_1: BFFCandidateJob样本 },
  });
  page.rerender(路由元素('job_1'));
  expect(screen.getByRole('button', { name: '让AI代理去谈' })).toBeTruthy();
});

it('never borrows the same job from another intention', () => {
  渲染Backend状态({
    当前意向编号: 'int_current',
    候选岗位推荐: {
      int_current: { 阶段: '成功', 刷新中: false, items: [], error: null, generation: 1 },
      int_other: { 阶段: '成功', 刷新中: false, items: [
        { ...推荐卡样本, intention_id: 'int_other', recommendation_id: 'rec_other' },
      ], error: null, generation: 1 },
    },
    候选岗位详情: { job_1: BFFCandidateJob样本 },
  });
  渲染('job_1');
  const action = screen.getByRole('button', { name: /当前求职意向暂无这条推荐/ });
  expect((action as HTMLButtonElement).disabled).toBe(true);
  expect(mock委托候选岗位).not.toHaveBeenCalled();
});
```

Add a hydration test with `后端状态.初始化: '进行中'` and no current intention; assert `加载候选岗位` is not called until rerender supplies the completed hydration and active ID.

- [ ] **Step 3: Write failing safe-return and origin-marker tests**

In `职位详情.test.tsx`:

```tsx
it('direct deep link replaces to the candidate market shell', async () => {
  window.history.replaceState({ idx: 0 }, '');
  渲染Backend状态({ 候选岗位详情: { job_1: BFFCandidateJob样本 } });
  渲染('job_1');
  await userEvent.click(screen.getByRole('button', { name: '返回' }));
  expect(mock派发).toHaveBeenCalledWith({ 型: '切Tab', Tab: '职位' });
  expect(mock派发).toHaveBeenCalledWith({ 型: '切子视图', 子视图: '看市场' });
  expect(mock替换跳转).toHaveBeenCalledWith(路径.主壳);
  expect(mock返回).not.toHaveBeenCalled();
});

it('recognized market source with history uses normal back', async () => {
  window.history.replaceState({ idx: 2 }, '');
  渲染Backend状态({ 候选岗位详情: { job_1: BFFCandidateJob样本 } });
  render(
    <MemoryRouter initialEntries={[{ pathname: '/job/job_1', state: { 来源: 'candidate-market' } }]}>
      <Routes>
        <Route path="/job/:id" element={<职位详情 />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(screen.getByRole('button', { name: '返回' }));
  expect(mock返回).toHaveBeenCalled();
  expect(mock替换跳转).not.toHaveBeenCalled();
});
```

In `看市场.test.tsx`, click a Backend recommendation card and assert:

```tsx
expect(mock跳转).toHaveBeenCalledWith(
  路径.职位详情(BFFCandidateJob样本.job_id),
  { 来源: 'candidate-market' },
);
```

- [ ] **Step 4: Run both page suites and verify failures**

```bash
npm run test -- src/屏幕/职位详情.test.tsx src/屏幕/看市场.test.tsx
```

Expected: no active-intention list load occurs, direct return calls raw back, and market navigation omits location state.

- [ ] **Step 5: Implement current-scope hydration and read-only states**

In Backend detail, keep the current exact-scope lookup and add:

```tsx
const 当前意向快照 = 当前意向编号 === null
  ? undefined
  : 后端状态.候选岗位推荐?.[当前意向编号];

useEffect(() => {
  if (!编号 || 后端状态.初始化 !== '完成' || 当前意向编号 === null) return;
  if (当前意向快照 !== undefined && 当前意向快照.阶段 !== '未开始') return;
  void 操作.加载候选岗位(当前意向编号).catch(() => undefined);
}, [编号, 后端状态.初始化, 当前意向编号, 当前意向快照, 操作]);
```

Do not automatically loop on a failed snapshot. While the current scope is absent/loading, reuse the existing primary action with `正在恢复推荐信息…`. After a successful empty/nonmatching snapshot, use `当前求职意向暂无这条推荐`; keep feedback and delegation disabled. A failed list snapshot uses the existing generic unavailable copy and does not search another scope.

- [ ] **Step 6: Implement the finite source marker and safe return**

Read `useLocation` in the Backend detail and define:

```tsx
type 候选职位来源状态 = { 来源?: 'candidate-market' };

const 位置 = useLocation();
const 来源 = (位置.state as 候选职位来源状态 | null)?.来源;

const 安全返回 = () => {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  if (来源 === 'candidate-market' && typeof idx === 'number' && idx > 0) {
    返回();
    return;
  }
  派发({ 型: '切Tab', Tab: '职位' });
  派发({ 型: '切子视图', 子视图: '看市场' });
  替换跳转(路径.主壳);
};
```

Use `安全返回` in normal, loading, error, and 404 Backend return bars. Change only the Backend market-card navigation to:

```tsx
跳转(路径.职位详情(视图.jobId), { 来源: 'candidate-market' });
```

Leave Mock navigation and return behavior unchanged.

- [ ] **Step 7: Run page, operation-fence, and routing tests**

```bash
npm run test -- \
  src/屏幕/职位详情.test.tsx \
  src/屏幕/看市场.test.tsx \
  src/状态/后端/发现推荐操作.test.ts
```

Expected: all pass; operation tests continue to reject stale subject/role/scope responses.

- [ ] **Step 8: Commit deep-link recovery and safe return**

```bash
git add src/屏幕/职位详情.tsx src/屏幕/职位详情.test.tsx src/屏幕/看市场.tsx src/屏幕/看市场.test.tsx
git commit -m "fix: recover candidate job recommendation scope"
```

---

### Task 4: Preserve Terminal Receipts and Apply the Closed Delegation State Table to All P4 Surfaces

**Files:**
- Modify: `src/状态/后端/发现推荐操作.test.ts:960-1210,1380-1430`
- Modify: `src/状态/后端/发现推荐操作.ts:340-450`
- Modify: `src/屏幕/看市场.test.tsx:600-830`
- Modify: `src/屏幕/候选推荐.test.tsx:350-450`
- Modify: `src/屏幕/职位详情.test.tsx:400-830`
- Modify: `src/屏幕/匿名在线简历.test.tsx:230-310`
- Modify: `src/屏幕/看市场.tsx:180-430,600-690`
- Modify: `src/屏幕/候选推荐.tsx:222-239,423-545`
- Modify: `src/屏幕/职位详情.tsx:240-430`
- Modify: `src/屏幕/匿名在线简历.tsx:370-480`

**Interfaces:**
- Consumes: `映射P4委托展示(summary, receipt)` from Task 1 and role-specific route builders.
- Produces: identical six-state Backend copy and server-Case navigation across candidate/recruiter list/detail surfaces.

- [ ] **Step 1: Write failing operation tests that retain authoritative terminal summaries**

Update the existing `needs_user/failed` and `refused` tests in `发现推荐操作.test.ts`. After each authoritative receipt lands, assert both the receipt table and the matching card summary retain the server state:

```ts
expect(env.最新状态().P4委托回执.del_nu?.state).toBe('needs_user');
expect(env.最新状态().候选岗位推荐.int_1.items[0].delegation).toEqual({
  delegation_id: 'del_nu', state: 'needs_user', case_id: null,
});
expect(env.最新状态().候选岗位推荐.int_1.items[0].state).toBe('available');

expect(env.最新状态().P4委托回执.del_fa?.state).toBe('failed');
expect(env.最新状态().候选岗位推荐.int_1.items[0].delegation).toEqual({
  delegation_id: 'del_fa', state: 'failed', case_id: null,
});
expect(env.最新状态().候选岗位推荐.int_1.items[0].state).toBe('available');
```

Add symmetric recruiter-card assertions and a polling-GET transition from `evaluating` to each terminal state. A `state: null` refusal remains receipt-only and clears the summary because it is not one of the six closed delegation states.

- [ ] **Step 2: Make receipt landing preserve all six non-null states**

In `发现推荐操作.ts`, import `P4拒绝原因文案` and have the existing `P4拒绝文案` delegate to it. Change `回执摘要` to return a summary for every non-null decoded state:

First align the generic terminal toast table with the shared Backend state table and update its existing literal tests:

```ts
export function P4委托终态文案(state: 'needs_user' | 'refused' | 'failed'): string {
  const copy = {
    needs_user: '需要你处理',
    refused: '本次未能继续',
    failed: '本次处理未完成',
  } as const;
  return copy[state];
}
```

`refused` with a non-null closed `refusal_code` continues to use the more specific `P4拒绝原因文案`; only its generic fallback changes.

```ts
function 回执摘要(回执: BFF委托回执): BFF委托摘要 | null {
  return 回执.state === null
    ? null
    : {
        delegation_id: 回执.delegation_id,
        state: 回执.state,
        case_id: 回执.case_id,
      };
}
```

Keep terminal candidate cards available while retaining the summary:

```ts
function 修补候选卡(卡: BFF候选岗位推荐, 摘要: BFF委托摘要 | null): BFF候选岗位推荐 {
  const state = 摘要 === null
    ? 'available'
    : 摘要.state === 'case_started'
      ? 'delegated'
      : 摘要.state === 'accepted' || 摘要.state === 'evaluating'
        ? 'delegating'
        : 'available';
  return { ...卡, state, delegation: 摘要 };
}
```

Do not change receipt validation, exception behavior, idempotency, fencing, or `P4真实Case引用`. No terminal state may create a Case.

Update the module header and the `回执摘要`/candidate-card docblocks to state the new behavior: all six non-null states retain an authoritative summary; only `accepted/evaluating` are progressing; terminal states restore the candidate card business state to `available`; `case_started` alone records a Case reference. Do not leave comments claiming `needs_user/refused/failed` clear the summary.

- [ ] **Step 3: Run operation tests**

```bash
npm run test -- src/状态/后端/发现推荐操作.test.ts
```

Expected: all create/GET states retain their authoritative result, only `accepted/evaluating` remain progressing, and existing single-flight/fence tests pass.

- [ ] **Step 4: Add shared state assertions to all four page suites**

For each Backend surface, supply recommendation summaries for all six states and assert the exact mapped copy. The minimum table used by every suite is:

```tsx
const 状态文案 = [
  ['accepted', '已提交给 AI，等待处理'],
  ['evaluating', 'AI 正在评估'],
  ['case_started', '已创建真实在谈'],
  ['needs_user', '需要你处理'],
  ['refused', '本次未能继续'],
  ['failed', '本次处理未完成'],
] as const;
```

In candidate suites, explicitly assert the removed copy is absent:

```tsx
expect(screen.queryByText('AI代理已接手')).toBeNull();
expect(screen.queryByText('已开始沟通')).toBeNull();
```

Repeat the absence assertions in recruiter suites. Do not share a test helper across production modules; local test helpers are sufficient.

- [ ] **Step 5: Add server Case navigation tests**

Candidate list/detail:

```tsx
it('candidate case_started navigates only by server case_id', async () => {
  置P4候选状态([{
    ...BFF候选岗位推荐样本,
    delegation: { delegation_id: 'del_c1', state: 'case_started', case_id: 'case_server_c1' },
  }]);
  render(<看市场 />);
  await userEvent.click(screen.getByRole('button', { name: '查看进展' }));
  expect(mock跳转).toHaveBeenCalledWith(路径.在谈详情('case_server_c1'));
});
```

Recruiter list/detail:

```tsx
it('recruiter case_started navigates only by server case_id', async () => {
  置P4状态({
    快照: P4快照({ 阶段: '成功', items: [{
      ...BFF招聘候选推荐样本,
      delegation: { delegation_id: 'del_r1', state: 'case_started', case_id: 'case_server_r1' },
    }] }),
  });
  render(<候选推荐 />);
  await userEvent.click(screen.getByRole('button', { name: '查看进展' }));
  expect(mock跳转).toHaveBeenCalledWith(路径.候选详情('case_server_r1'));
});
```

For both roles, add a `case_started` summary with `case_id: null` and assert there is no `查看进展` button. Assert job ID, recommendation ID, delegation ID, and alias never appear in a navigation call.

- [ ] **Step 6: Add polling and terminal-state tests**

In `看市场.test.tsx`, extend `置P4候选状态` with a second optional `操作补丁` argument and spread it after the default delegate spy inside `发现推荐操作桩`. Then use the real two-second poll cadence:

```tsx
it.each(['accepted', 'evaluating'] as const)('%s remains the only polling state', async (state) => {
  vi.useFakeTimers();
  置P4候选状态([{
    ...BFF候选岗位推荐样本,
    state: 'delegating',
    delegation: { delegation_id: `del_${state}`, state, case_id: null },
  }], { 刷新委托: mock刷新委托 });
  render(<看市场 />);
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(mock刷新委托).toHaveBeenCalledWith('candidate', `del_${state}`);
});

it.each(['case_started', 'needs_user', 'refused', 'failed'] as const)(
  '%s does not poll or render an in-progress label',
  async (state) => {
    vi.useFakeTimers();
    置P4候选状态([{
      ...BFF候选岗位推荐样本,
      delegation: { delegation_id: `del_${state}`, state, case_id: null },
    }], { 刷新委托: mock刷新委托 });
    render(<看市场 />);
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(mock刷新委托).not.toHaveBeenCalled();
    expect(screen.queryByText('AI 正在评估')).toBeNull();
  },
);
```

Keep the existing poller failure-bound test and its `暂时无法确认进度，请稍后刷新` copy. Add a reload-style test that initializes the recommendation card with a latest delegation summary and empty receipt map; assert the status still appears without local reducer history.

- [ ] **Step 7: Run the four page suites and verify inconsistent copy/navigation fails**

```bash
npm run test -- \
  src/屏幕/看市场.test.tsx \
  src/屏幕/候选推荐.test.tsx \
  src/屏幕/职位详情.test.tsx \
  src/屏幕/匿名在线简历.test.tsx
```

Expected: existing `AI代理已接手` assertions fail and no `case_started` primary CTA exists.

- [ ] **Step 8: Replace page-local boolean wording with the pure view**

At each surface derive:

```tsx
const 委托回执 = 推荐卡.delegation === null
  ? null
  : 后端状态.P4委托回执[推荐卡.delegation.delegation_id] ?? null;
const 委托展示 = 映射P4委托展示(推荐卡.delegation, 委托回执);
const 委托进度未知 = 委托展示?.inProgress === true
  && 进度未知.has(推荐卡.delegation!.delegation_id);
const 委托文字 = 委托进度未知
  ? P4委托进度未知文案
  : 委托展示 === null
    ? '让AI代理去谈'
    : `${委托展示.copy}${委托展示.reason === null ? '' : `：${委托展示.reason}`}`;
```

Build poller inputs only from `委托展示?.inProgress === true`. Reuse each surface's existing primary action/status slot:

- no summary: retain the current delegate action and eligibility;
- `accepted/evaluating`: disabled status with mapped copy;
- `case_started` plus non-null `caseId`: enabled `查看进展` using the role-specific builder;
- `case_started` without `caseId`: disabled `已创建真实在谈` status;
- `needs_user/refused/failed`: disabled mapped status unless that page already has a Backend-authorized action for the same state; do not invent one.

Adjust props of existing page-local card helpers as needed, but do not modify shared components or styles. Do not use `后端状态.P4真实Case引用` as a fallback when the visible summary lacks a Case ID.

- [ ] **Step 9: Run P4 and P5 Case-navigation regression tests**

```bash
npm run test -- \
  src/数据/发现推荐映射.test.ts \
  src/屏幕/看市场.test.tsx \
  src/屏幕/候选推荐.test.tsx \
  src/屏幕/职位详情.test.tsx \
  src/屏幕/匿名在线简历.test.tsx \
  src/屏幕/P5/MatchCase列表.test.tsx \
  src/屏幕/P5/MatchCase历史.test.tsx \
  src/屏幕/P5/MatchCase详情.test.tsx
```

Expected: every navigation uses a server `case_id`; existing P5 list/history/detail 404 and role routing remain green.

- [ ] **Step 10: Commit the P4 state integration**

```bash
git add \
  src/状态/后端/发现推荐操作.ts src/状态/后端/发现推荐操作.test.ts \
  src/屏幕/看市场.tsx src/屏幕/看市场.test.tsx \
  src/屏幕/候选推荐.tsx src/屏幕/候选推荐.test.tsx \
  src/屏幕/职位详情.tsx src/屏幕/职位详情.test.tsx \
  src/屏幕/匿名在线简历.tsx src/屏幕/匿名在线简历.test.tsx
git commit -m "fix: render authoritative delegation states"
```

---

### Task 5: Correct P5 AI Step Copy Without Changing the Matrix or Actions

**Files:**
- Modify: `src/数据/MatchCase展示映射.test.ts:28-55,260-320`
- Modify: `src/屏幕/P5/MatchCase详情.test.tsx:630-720`
- Modify: `src/数据/MatchCase展示映射.ts:48-67`

**Interfaces:**
- Consumes: the existing closed `P5步骤` union and 17-row matrix.
- Produces: four exact step descriptions; no state, action, attachment, or viewer change.

- [ ] **Step 1: Update the expected closed copy table in the mapper test**

Replace only these values in `期望步骤说明`:

```ts
candidate_evaluation: '候选方 AI 正在评估岗位',
recruiter_answer: '等待招聘方 AI 回答补充问题',
screening_resume: '招聘方 AI 正在初筛已提交简历',
coordinating: '双方 AI 正在核对剩余差异',
```

Do not change the expected key count of 17, matrix rows, or expected action map.

- [ ] **Step 2: Add exact parse/screening/manual-decision assertions to the detail test**

Add exact mapper assertions using the existing `造详情`, `造行状态`, and `断言正常` helpers in `MatchCase展示映射.test.ts`:

```tsx
const 解析中 = 断言正常(映射P5详情(造详情({
  state: 造行状态('open', 'resume_submission', 'waiting', 'awaiting_resume_parse'),
  availableActions: [],
})));
const AI初筛中 = 断言正常(映射P5详情(造详情({
  state: 造行状态('open', 'resume_submission', 'waiting', 'screening_resume'),
  availableActions: ['decide_resume_screening'],
})));
const 等人工决定 = 断言正常(映射P5详情(造详情({
  state: 造行状态(
    'open', 'resume_submission', 'needs_user', 'awaiting_recruiter_decision',
  ),
  availableActions: ['decide_resume_screening'],
})));

expect(解析中.步骤说明).toBe('正在解析简历');
expect(AI初筛中.步骤说明).toBe('招聘方 AI 正在初筛已提交简历');
expect(AI初筛中.actions).toEqual([]);
expect(等人工决定.步骤说明).toBe('等待招聘方决定');
expect(等人工决定.actions.map((action) => action.action))
  .toEqual(['decide_resume_screening']);
```

In `MatchCase详情.test.tsx`, render `S1解析中详情()` and `S1初筛详情(true)` through its existing harness. Pin `正在解析简历` for the former and `等待招聘方决定` plus the existing recruiter-only decision action for the latter. Add a recruiter DTO cloned from `S1初筛详情(true)` with `step: 'screening_resume'`, `status: 'waiting'`, `needsUser: false`, `needsAction: false`, and empty `availableActions`; assert the new AI-screening copy appears with no decision button. Retain candidate-viewer assertions that recruiter-only attachments and actions are absent.

- [ ] **Step 3: Run mapper/detail tests and verify the four copy assertions fail**

```bash
npm run test -- src/数据/MatchCase展示映射.test.ts src/屏幕/P5/MatchCase详情.test.tsx
```

Expected: FAIL only on the four old step descriptions.

- [ ] **Step 4: Replace the four strings in the closed table**

In `MatchCase展示映射.ts`, make these exact substitutions:

```ts
candidate_evaluation: '候选方 AI 正在评估岗位',
recruiter_answer: '等待招聘方 AI 回答补充问题',
screening_resume: '招聘方 AI 正在初筛已提交简历',
coordinating: '双方 AI 正在核对剩余差异',
```

Do not change `状态文案表`, `矩阵元组表`, `渲染动作卡`, stage attachment mapping, or any component.

- [ ] **Step 5: Run all P5 truth-boundary tests**

```bash
npm run test -- \
  src/数据/MatchCase展示映射.test.ts \
  src/数据/招聘数据源/MatchCase.test.ts \
  src/屏幕/P5/MatchCase详情.test.tsx \
  src/屏幕/P5/MatchCase列表.test.tsx \
  src/屏幕/P5/MatchCase历史.test.tsx
```

Expected: all pass; the matrix count remains 17, invalid combinations fail closed, `attention_required` remains neutral, and no new action appears.

- [ ] **Step 6: Commit the P5 copy correction**

```bash
git add src/数据/MatchCase展示映射.ts src/数据/MatchCase展示映射.test.ts src/屏幕/P5/MatchCase详情.test.tsx
git commit -m "fix: clarify match case AI stages"
```

---

### Task 6: Verify Slice 2 and Its Scope Boundaries

**Files:**
- Verify only; no planned source edits.

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: a green Discovery/Case slice with no visual-system or contract expansion.

- [ ] **Step 1: Run the complete targeted suite**

```bash
npm run test -- \
  src/数据/发现推荐映射.test.ts \
  src/状态/后端/发现推荐操作.test.ts \
  src/屏幕/看市场.test.tsx \
  src/屏幕/候选推荐.test.tsx \
  src/屏幕/职位详情.test.tsx \
  src/屏幕/匿名在线简历.test.tsx \
  src/数据/招聘数据源/MatchCase.test.ts \
  src/数据/MatchCase展示映射.test.ts \
  src/屏幕/P5/MatchCase列表.test.tsx \
  src/屏幕/P5/MatchCase历史.test.tsx \
  src/屏幕/P5/MatchCase详情.test.tsx
```

Expected: all pass.

- [ ] **Step 2: Run static gates**

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all exit 0.

- [ ] **Step 3: Assert forbidden files and future contracts are absent**

```bash
git diff --name-only b2827dae16e89b199b487ab1564246b7b66e34f6...HEAD \
  | rg '(^src/组件/.*\.(tsx|ts)$|\.css$)' \
  | rg -v '^src/组件/.*\.test\.(tsx|ts)$'
git diff b2827dae16e89b199b487ab1564246b7b66e34f6...HEAD -- src \
  | rg 'organization_verification_required|delegation_agent_unavailable|delegation_evaluation_failed|agent_attention|expired'
```

Expected: both commands produce no output. If either prints a match, remove the prohibited change or future contract before proceeding.

- [ ] **Step 4: Confirm the tree is clean**

```bash
git status --short
```

Expected: no output.
