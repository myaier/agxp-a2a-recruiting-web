# Form and Job Detail Truthfulness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make intention validation actionable and CandidateJob/job-form copy truthful while preserving the current visual component and CSS system.

**Architecture:** Keep all HTTP and authoritative rereads in the existing operations. Add only page-local validation state and a typed CandidateJob fact projection; feed those facts and copy into existing page slots without creating components or styles.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, Testing Library, Vite.

**Spec:** `docs/superpowers/specs/2026-09-02-frontend-truthfulness-batch-design.md`

**Execution order:** This is Slice 1 of 3. One writer executes this Plan first, then the Discovery/Case Plan, then the Backend Agent isolation Plan in the same worktree. Do not parallelize the three Plans.

## Global Constraints

- Frontend baseline is `origin/main@b2827dae16e89b199b487ab1564246b7b66e34f6`.
- Backend contract baseline is `release/0.2.5@45f7323e34f6f6db11faee658144e28d338b36be`.
- Do not modify runtime files under `src/组件/**`; colocated test files are allowed only for existing cross-page assertions.
- Do not create a component or modify CSS.
- Do not modify `src/数据/BFF契约.ts`.
- Page changes may alter copy, ARIA, state, and existing-slot content only.
- Backend failures must never fall back to Mock data, reducers, localStorage, timers, or inferred facts.
- Follow TDD for every task and commit each independently testable result.

## File Responsibility Map

- `src/屏幕/添加意向.tsx`: local required-field validation, workplace-mode focus, and ARIA state.
- `src/屏幕/添加意向.test.tsx`: create/edit validation and zero-mutation coverage.
- `src/数据/招聘数据源类型.ts`: typed CandidateJob fact projection exposed to the page.
- `src/数据/发现推荐映射.ts`: CandidateJob-only construction of that projection.
- `src/数据/发现推荐映射.test.ts`: allowlist, null, and field-combination coverage.
- `src/屏幕/职位详情.tsx`: insertion of projected facts and truthful copy into existing text/analysis slots.
- `src/屏幕/职位详情.test.tsx`: Backend fact display, Mock isolation, and no-inference coverage.
- `src/屏幕/发布岗位.tsx`: existing-label wording for structured versus supplemental requirements.
- `src/屏幕/发布岗位.test.tsx`: accessible copy and unchanged payload coverage.

---

### Task 1: Make Workplace-Mode Validation Reachable and Accessible

**Files:**
- Modify: `src/屏幕/添加意向.test.tsx:5-71`
- Modify: `src/屏幕/添加意向.tsx:103-133,187-214,254-271`

**Interfaces:**
- Consumes: `意向草稿型`, existing `操作.保存意向(草稿)`, existing `轻提示`, and the existing workplace-mode buttons.
- Produces: no exported API; the existing workplace-mode group exposes `role="group"`, `aria-label="办公方式"`, conditional `aria-invalid`, and conditional `aria-description`.

- [ ] **Step 1: Refactor the test fixture so create and edit drafts can be selected per test**

In `添加意向.test.tsx`, import `意向草稿型`, replace the immutable module fixture with `let 当前草稿: 意向草稿型`, and have the mocked provider return it:

```tsx
import type { 意向草稿型 } from '../数据/招聘数据源类型';

const 基础草稿: 意向草稿型 = {
  编辑编号: null,
  求职类型: '全职',
  工作城市: '上海',
  期望职位: '产品经理',
  感兴趣城市们: [],
  薪资下限: 10,
  薪资上限: 20,
  期望行业们: [],
  办公方式: ['混合'],
  后端招聘类型: null,
  求职类型已改: false,
};

let 当前草稿: 意向草稿型 = { ...基础草稿, 办公方式: [...基础草稿.办公方式] };

vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({
    状态: { 意向草稿: 当前草稿 },
    派发: mock派发,
    操作: { 保存意向: mock保存意向, 删除意向: mock删除意向 },
  }),
}));
```

Reset `当前草稿` in `beforeEach`. Add a hoisted `轻提示` mock and a `scrollIntoView` stub without touching the real component:

```tsx
const mock轻提示 = vi.hoisted(() => vi.fn());
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => undefined;
}
```

- [ ] **Step 2: Write failing create/edit validation tests**

Add a render helper that registers both routes, then cover both modes with the same assertion:

```tsx
function 渲染意向(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/intentions/new" element={<添加意向 />} />
        <Route path="/intentions/:id" element={<添加意向 />} />
      </Routes>
    </MemoryRouter>,
  );
}

it.each([
  ['/intentions/new', null],
  ['/intentions/int_1', 'int_1'],
])('办公方式为空时 %s 可点击保存、提示并聚焦，且零 mutation', async (path, 编辑编号) => {
  当前草稿 = { ...基础草稿, 编辑编号, 办公方式: [] };
  const user = userEvent.setup();
  渲染意向(path);

  const 保存 = screen.getByRole('button', { name: '保存' });
  expect((保存 as HTMLButtonElement).disabled).toBe(false);
  await user.click(保存);

  expect(mock轻提示).toHaveBeenCalledWith('请选择办公方式');
  expect(mock保存意向).not.toHaveBeenCalled();
  const 组 = screen.getByRole('group', { name: '办公方式' });
  expect(组.getAttribute('aria-invalid')).toBe('true');
  expect(组.getAttribute('aria-description')).toBe('请选择办公方式');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '现场' }));
});

it('选择任一办公方式立即清除 invalid 状态', async () => {
  当前草稿 = { ...基础草稿, 办公方式: [] };
  const user = userEvent.setup();
  渲染意向('/intentions/new');
  await user.click(screen.getByRole('button', { name: '保存' }));
  await user.click(screen.getByRole('button', { name: '远程' }));
  const 组 = screen.getByRole('group', { name: '办公方式' });
  expect(组.getAttribute('aria-invalid')).toBeNull();
  expect(组.getAttribute('aria-description')).toBeNull();
});
```

- [ ] **Step 3: Run the tests and verify the intended failures**

Run:

```bash
npm run test -- src/屏幕/添加意向.test.tsx
```

Expected: the save button is disabled, no toast occurs, and the workplace wrapper is not an accessible group.

- [ ] **Step 4: Implement one validator and reuse the existing controls**

In `添加意向.tsx`, add `useRef`/`useState` to the existing React import and create local state:

```tsx
const [办公方式错误, 设办公方式错误] = useState(false);
const 办公方式组引用 = useRef<HTMLDivElement>(null);

useEffect(() => {
  设办公方式错误(false);
}, [路由编号]);

const 校验必填 = (): boolean => {
  if (草稿.工作城市 === '') {
    轻提示('请选择工作城市');
    return false;
  }
  if (草稿.期望职位 === '') {
    轻提示('请选择期望职位');
    return false;
  }
  if (草稿.办公方式.length === 0) {
    设办公方式错误(true);
    轻提示('请选择办公方式');
    const 组 = 办公方式组引用.current;
    组?.scrollIntoView({ block: 'center' });
    组?.querySelector<HTMLButtonElement>('button')?.focus();
    return false;
  }
  return true;
};

const 提交 = async () => {
  if (!校验必填()) return;
  try {
    await 操作.保存意向(草稿);
    派发({ 型: '清意向草稿' });
    返回();
  } catch (error) {
    轻提示(取后端错误文案(error));
  }
};
```

Delete `可保存` and the unreachable workplace branch. Add semantics to the existing `.类型组` element only:

```tsx
<div
  ref={办公方式组引用}
  className={样式.类型组}
  role="group"
  aria-label="办公方式"
  aria-invalid={办公方式错误 || undefined}
  aria-description={办公方式错误 ? '请选择办公方式' : undefined}
>
```

At the start of every workplace button's current `onClick`, call `设办公方式错误(false)` before dispatching the unchanged user selection. Remove `disabled={!可保存}` from the edit save button and pass `禁用={false}` to the existing new-save `主按钮`.

- [ ] **Step 5: Run the focused tests**

Run:

```bash
npm run test -- src/屏幕/添加意向.test.tsx src/数据/后端映射.test.ts
```

Expected: all tests pass, including the existing successful Backend save test and wire mapping tests.

- [ ] **Step 6: Commit the intention validation**

```bash
git add src/屏幕/添加意向.tsx src/屏幕/添加意向.test.tsx
git commit -m "fix: surface intention workplace validation"
```

---

### Task 2: Add a CandidateJob-Only Fact Projection

**Files:**
- Modify: `src/数据/招聘数据源类型.ts:144-164`
- Modify: `src/数据/发现推荐映射.ts:86-129`
- Modify: `src/数据/发现推荐映射.test.ts:1-130`

**Interfaces:**
- Consumes: the already-decoded `BFFCandidateJob` fields from the frozen Backend contract.
- Produces: `P4岗位事实` and `P4候选岗位页面.岗位事实`, consumed by Task 3.

- [ ] **Step 1: Write failing pure-mapping tests for all fact combinations**

Import both candidate mapping functions and add exact expectations:

```ts
it('CandidateJob allowlist projects city, mode, office, months, experience and education', () => {
  const view = 从P4CandidateJob({
    ...BFFCandidateJob样本,
    location: { ...BFFCandidateJob样本.location, display_name: '上海' },
    workplace_mode: 'hybrid',
    office_location: '浦东新区世纪大道 1 号',
    annual_salary_months: 15,
    experience_requirement: 'three_to_five_years',
    education_requirement: 'bachelor',
  });
  expect(view.岗位事实).toEqual({
    城市: '上海',
    办公方式: '混合',
    办公地点: '浦东新区世纪大道 1 号',
    年薪月数: 15,
    经验要求: '3-5 年',
    学历要求: '本科',
  });
});

it.each([
  ['remote', '', null, null],
  ['remote', '   ', null, null],
  ['onsite', '徐汇区漕河泾', 12, '徐汇区漕河泾'],
  ['hybrid', '静安区南京西路', 14, '静安区南京西路'],
] as const)('mode=%s office/months preserve null boundaries', (mode, office, months, expectedOffice) => {
  const view = 从P4CandidateJob({
    ...BFFCandidateJob样本,
    workplace_mode: mode,
    office_location: office,
    annual_salary_months: months,
  });
  expect(view.岗位事实.办公地点).toBe(expectedOffice);
  expect(view.岗位事实.年薪月数).toBe(months);
});

it('unknown structured requirement codes remain visible instead of becoming undefined', () => {
  const view = 从P4CandidateJob({
    ...BFFCandidateJob样本,
    experience_requirement: 'backend_specific_experience',
    education_requirement: 'backend_specific_education',
  });
  expect(view.岗位事实.经验要求).toBe('backend_specific_experience');
  expect(view.岗位事实.学历要求).toBe('backend_specific_education');
});
```

Extend the existing exact-key allowlist test so `岗位事实` is an expected page key while injected DTO-only keys remain absent.

- [ ] **Step 2: Run the mapper test and verify it fails on the missing projection**

```bash
npm run test -- src/数据/发现推荐映射.test.ts
```

Expected: FAIL because `岗位事实` does not exist.

- [ ] **Step 3: Define and populate the typed projection**

In `招聘数据源类型.ts`, add:

```ts
export interface P4岗位事实 {
  城市: string;
  办公方式: '现场' | '混合' | '全远程';
  办公地点: string | null;
  年薪月数: number | null;
  经验要求: string;
  学历要求: string;
}
```

Add `岗位事实: P4岗位事实` to `P4候选岗位页面`.

In `建候选岗位视图`, populate only CandidateJob values:

```ts
const 办公地点 = job.office_location.trim();
const 经验要求 = 经验要求文案[
  job.experience_requirement as keyof typeof 经验要求文案
] ?? job.experience_requirement;
const 学历要求 = 学历要求文案[
  job.education_requirement as keyof typeof 学历要求文案
] ?? job.education_requirement;

return {
  recommendationId: 建议.recommendationId,
  intentionId: 建议.intentionId,
  jobId: job.job_id,
  卡: 建卡(job, 建议.适配分, 建议.intentionId ?? '', 建议.理由),
  岗位事实: {
    城市: job.location.display_name,
    办公方式: 办公方式文案[job.workplace_mode],
    办公地点: 办公地点 === '' ? null : 办公地点,
    年薪月数: job.annual_salary_months,
    经验要求,
    学历要求,
  },
  职位详情: 拆行(job.description),
  职位要求: 拆行(job.requirements),
  公司: {
    名称: job.hiring_organization_claim.display_name,
    首字: 首字(job.hiring_organization_claim.display_name),
    简介: '',
    organizationId: job.hiring_organization_ref ?? null,
  },
  发布人: job.publisher_profile
    ? {
        姓名: job.publisher_profile.public_name,
        职务: job.publisher_profile.title,
        首字: 首字(job.publisher_profile.public_name),
        验证状态: job.publisher_profile.personal_verification_status,
      }
    : null,
  委托: 建议.委托,
};
```

Keep the existing raw structured-code fallback because these two BFF fields and their decoder are currently typed as validated non-empty strings rather than closed enums. The fallback displays the server value instead of silently producing `undefined`; it must not infer or parse free text.

- [ ] **Step 4: Run the mapper and type tests**

```bash
npm run test -- src/数据/发现推荐映射.test.ts src/数据/招聘数据源/发现推荐.test.ts
npm run typecheck
```

Expected: all tests and typecheck pass.

- [ ] **Step 5: Commit the projection**

```bash
git add src/数据/招聘数据源类型.ts src/数据/发现推荐映射.ts src/数据/发现推荐映射.test.ts
git commit -m "feat: project candidate job facts"
```

---

### Task 3: Render CandidateJob Facts in Existing Detail Slots

**Files:**
- Modify: `src/屏幕/职位详情.test.tsx:250-430`
- Modify: `src/屏幕/职位详情.tsx:512-626`

**Interfaces:**
- Consumes: `P4候选岗位页面.岗位事实` from Task 2.
- Produces: no exported API; Backend `职位正文` feeds fact lines into the existing JD card and truthful basis copy into the existing analysis slot.

- [ ] **Step 1: Write failing Backend display tests**

Use the existing Backend setup and CandidateJob sample:

```tsx
it('Backend detail displays CandidateJob facts in existing text slots', async () => {
  渲染Backend状态({
    候选岗位详情: {
      job_1: {
        ...BFFCandidateJob样本,
        location: { ...BFFCandidateJob样本.location, display_name: '上海' },
        workplace_mode: 'hybrid',
        office_location: '浦东新区世纪大道 1 号',
        annual_salary_months: 15,
        experience_requirement: 'three_to_five_years',
        education_requirement: 'bachelor',
        requirements: '熟悉 TypeScript',
      },
    },
  });
  渲染('job_1');
  expect(await screen.findByText('城市：上海')).toBeTruthy();
  expect(screen.getByText('办公方式：混合')).toBeTruthy();
  expect(screen.getByText('办公地点：浦东新区世纪大道 1 号')).toBeTruthy();
  expect(screen.getByText('年薪月数：15 薪')).toBeTruthy();
  expect(screen.getByText('结构化经验要求：3-5 年')).toBeTruthy();
  expect(screen.getByText('结构化学历要求：本科')).toBeTruthy();
  expect(screen.getByText(/按岗位设置的结构化要求核对/)).toBeTruthy();
  expect(screen.getByText('职位要求（补充说明，不自动解析）')).toBeTruthy();
  expect(screen.getByText('熟悉 TypeScript')).toBeTruthy();
});

it('remote with blank office and null months renders no empty fact labels or default', async () => {
  渲染Backend状态({
    候选岗位详情: {
      job_1: {
        ...BFFCandidateJob样本,
        workplace_mode: 'remote',
        office_location: ' ',
        annual_salary_months: null,
      },
    },
  });
  渲染('job_1');
  await screen.findByText('办公方式：全远程');
  expect(screen.queryByText(/^办公地点：/)).toBeNull();
  expect(screen.queryByText(/^年薪月数：/)).toBeNull();
  expect(screen.queryByText('12 薪')).toBeNull();
});
```

Retain the existing assertions that Backend does not call `取市场岗位详情` and standalone CandidateJob hides the match ring.

- [ ] **Step 2: Run the detail test and verify the missing copy/facts fail**

```bash
npm run test -- src/屏幕/职位详情.test.tsx
```

Expected: the new fact lines and truthful section title are absent.

- [ ] **Step 3: Feed the projection into the existing content arrays**

Inside the Backend `内容` branch, build existing-slot lines:

```tsx
const 事实行 = 视图 === null ? [] : [
  `城市：${视图.岗位事实.城市}`,
  `办公方式：${视图.岗位事实.办公方式}`,
  ...(视图.岗位事实.办公地点 === null ? [] : [`办公地点：${视图.岗位事实.办公地点}`]),
  ...(视图.岗位事实.年薪月数 === null ? [] : [`年薪月数：${视图.岗位事实.年薪月数} 薪`]),
  `结构化经验要求：${视图.岗位事实.经验要求}`,
  `结构化学历要求：${视图.岗位事实.学历要求}`,
];

const 内容 = 视图 !== null
  ? {
      标签: 视图.卡.学历要求 ? [视图.卡.学历要求] : [],
      职位详情: [...事实行, ...视图.职位详情],
      职位要求: 视图.职位要求,
      公司: {
        名称: 视图.公司.名称,
        首字: 视图.公司.首字,
        简介: 视图.公司.简介,
        organizationId: 视图.公司.organizationId,
      },
      发布人: 视图.发布人
        ? {
            首字: 视图.发布人.首字,
            姓名: 视图.发布人.姓名,
            公司: 视图.公司.名称,
            职务: 视图.发布人.职务,
            备注: '',
          }
        : null,
    }
  : (() => {
      const 详 = 取市场岗位详情(岗);
      return {
        标签: 详.标签,
        职位详情: 详.职位详情,
        职位要求: 详.职位要求,
        公司: {
          名称: 详.公司.名称,
          首字: 详.公司.首字,
          简介: 详.公司.简介,
          organizationId: null,
        },
        发布人: {
          首字: 详.发布人.首字,
          姓名: 详.发布人.姓名,
          公司: 详.发布人.公司,
          职务: 详.发布人.职务,
          备注: 详.发布人.备注,
        },
      };
    })();
```

Use the existing analysis prop and title slot; do not add elements:

```tsx
分析={视图 !== null
  ? `按岗位设置的结构化要求核对。${求职匹配分析(对齐行们, 岗.编号)}`
  : 求职匹配分析(对齐行们, 岗.编号)}
```

```tsx
<div className={样式.卡标题}>
  {视图 !== null ? '岗位信息与职位详情' : '职位详情'}
</div>
{内容.职位详情.map((行, index) => (
  <div key={`${index}:${行}`} className={样式.卡正文}>{行}</div>
))}

<div className={样式.卡小标题}>
  {视图 !== null ? '职位要求（补充说明，不自动解析）' : '职位要求'}
</div>
```

The Backend title change makes the mixed fact/JD slot truthful, and the indexed key prevents a CandidateJob description line identical to a fact line from colliding. Do not add a DOM block or touch `匹配分析块`, `公司区块`, or any CSS.

- [ ] **Step 4: Run detail and mapping regression tests**

```bash
npm run test -- src/屏幕/职位详情.test.tsx src/数据/发现推荐映射.test.ts src/组件/公司区块.test.tsx
```

Expected: all pass; Mock company/detail behavior remains unchanged.

- [ ] **Step 5: Commit the existing-slot rendering**

```bash
git add src/屏幕/职位详情.tsx src/屏幕/职位详情.test.tsx
git commit -m "fix: show authoritative candidate job facts"
```

---

### Task 4: Clarify Structured Versus Supplemental Job Requirements

**Files:**
- Modify: `src/屏幕/发布岗位.test.tsx:420-495`
- Modify: `src/屏幕/发布岗位.tsx:1272-1309,1411-1425`

**Interfaces:**
- Consumes: existing structured selection state and the existing `职位要求` textarea.
- Produces: no data/API changes; only exact visible/accessible wording in existing labels.

- [ ] **Step 1: Write a failing copy-and-payload test**

Use the existing `填到发布前(true)` helper so the test reaches step three through normal controls:

```tsx
it('结构化经验学历与补充文字使用精确说明且不改 payload', async () => {
  const { 用户 } = await 填到发布前(true);
  expect(screen.getByText('经验要求（自动匹配读取）')).toBeTruthy();
  expect(screen.getByText('最低学历（自动匹配读取）')).toBeTruthy();
  const 要求框 = screen.getByRole('textbox', {
    name: '给候选人看的职位要求（补充文字，不自动解析为硬门槛）',
  });
  await 用户.clear(要求框);
  await 用户.type(要求框, '至少 3 年经验，本科优先');
  await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
  await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
  expect(mock发布岗位.mock.calls[0][0]).toMatchObject({
    职位要求: '至少 3 年经验，本科优先',
    经验要求: '不限',
    最低学历: '不限',
  });
});
```

Also retain the existing Backend and Mock payload tests; they prove the copy change does not rewrite the selection or wire input.

- [ ] **Step 2: Run the test and verify only the new labels fail**

```bash
npm run test -- src/屏幕/发布岗位.test.tsx
```

Expected: FAIL on the three new labels; no data-layer behavior should need to change.

- [ ] **Step 3: Replace text in existing label slots only**

Apply these exact replacements in `职位要求步`:

```tsx
<div className={样式.条目标签}>经验要求（自动匹配读取）</div>
<div className={样式.条目标签}>最低学历（自动匹配读取）</div>
<div className={样式.要求文标}>
  给候选人看的职位要求（补充文字，不自动解析为硬门槛）
</div>
```

Set the textarea's existing accessible label to the same exact sentence:

```tsx
aria-label="给候选人看的职位要求（补充文字，不自动解析为硬门槛）"
```

Do not add an effect, parser, handler, field, component, or style.

- [ ] **Step 4: Run page and wire regression tests**

```bash
npm run test -- src/屏幕/发布岗位.test.tsx src/数据/后端映射.test.ts src/状态/后端/岗位操作.test.ts
```

Expected: all pass and payload snapshots retain user-selected structured values.

- [ ] **Step 5: Commit the copy boundary**

```bash
git add src/屏幕/发布岗位.tsx src/屏幕/发布岗位.test.tsx
git commit -m "fix: clarify structured job requirements"
```

---

### Task 5: Verify Slice 1 and Its Visual Freeze

**Files:**
- Verify only; no planned source edits.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: a green Slice 1 gate and evidence that prohibited visual files were untouched.

- [ ] **Step 1: Run all targeted Slice 1 tests**

```bash
npm run test -- \
  src/屏幕/添加意向.test.tsx \
  src/数据/发现推荐映射.test.ts \
  src/屏幕/职位详情.test.tsx \
  src/屏幕/发布岗位.test.tsx \
  src/数据/后端映射.test.ts \
  src/状态/后端/岗位操作.test.ts
```

Expected: all pass.

- [ ] **Step 2: Run static gates**

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Assert the visual freeze**

```bash
git diff --name-only b2827dae16e89b199b487ab1564246b7b66e34f6...HEAD \
  | rg '(^src/组件/.*\.(tsx|ts)$|\.css$)' \
  | rg -v '^src/组件/.*\.test\.(tsx|ts)$'
```

Expected: no output. If output exists, stop and remove the runtime component/CSS change rather than approving it.

- [ ] **Step 4: Confirm the tree is clean**

```bash
git status --short
```

Expected: no output.
