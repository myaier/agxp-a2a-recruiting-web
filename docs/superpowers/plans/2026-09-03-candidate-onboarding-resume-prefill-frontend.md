# Candidate Onboarding Resume Prefill Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the frozen `resume-prefill.v1` backend suggestion into the existing candidate onboarding forms without changing any styles or PM-owned design components.

**Architecture:** Add one strict Backend-only read facade, keep the suggestion in an isolated subject/session-fenced state machine, and expose pure page-initializer functions that only fill eligible blank controls. The upload page decides between waiting and explicit manual entry; existing Resume mutations remain the only persistence path, while a non-visual route boundary restores exact-tuple suggestions after refresh.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Vitest 4, Testing Library, existing same-origin BFF client.

**Spec:** `docs/superpowers/specs/2026-09-03-candidate-onboarding-resume-prefill-frontend-design.md`

## Global Constraints

- Implement against frontend baseline `25c4f041bccde33c7b21c2cb96f9f9fbadb0140c` and backend contract commit `f2d7af5652c48ed65c96d3db679618c597d1c9fd`.
- Before Task 1, fetch `origin` and calibrate the actual implementation base of `origin/fe-backend-mock-fixes`; if it now contains session/hydration code, reuse its subject/session fence and cleanup owner rather than creating a competing owner.
- Backend-only: Mock mode and daily `我的简历` upload/replace/reparse issue zero prefill requests and create no prefill recovery metadata.
- Only an explicit upload or replacement completed from `学生分流` activates onboarding prefill; merely entering the page or seeing an existing attachment does not.
- Existing server values and current page values win over suggestions. Suggestions never write `/me/resume` before the user uses the existing page confirmation action.
- Do not infer values, invent Catalog IDs, merge list suggestions by index, or persist the suggestion payload in browser storage.
- Do not modify or create `.css`, `.module.css`, global style, CSS variable, inline style, or animation code.
- Do not modify `src/组件/**`, move/reorder existing visible components, or change existing DOM layout.
- Feedback may only reuse the frozen APIs of `代理横幅`, `确认层`, `轻提示`, `主按钮`, and `路由加载中` in their existing positions.
- If an existing PM-owned component cannot express a state, record a PM dependency and stop that UI subpart; do not create a replacement component or style.
- Every task uses red-green TDD and ends with a focused commit. Do not stage unrelated working-tree changes.

## Preflight

- [ ] Read the approved Spec and repository instructions, then verify the worktree and baselines.

```bash
git status --short
git fetch origin
git rev-parse origin/main
git log -1 --oneline origin/fe-backend-mock-fixes
```

Expected: the approved Spec is present; unrelated user changes remain untouched. If `origin/main` or the adjacent implementation has advanced, document the calibrated commits at the top of the implementation PR before continuing.

- [ ] Record the zero-style baseline for later comparison.

```bash
git diff --name-only 25c4f041bccde33c7b21c2cb96f9f9fbadb0140c...HEAD -- '*.css' '*.module.css' 'src/组件/**'
```

Expected: no output attributable to this feature branch.

---

### Task 1: Strict `resume-prefill.v1` Contract and Read Facade

**Files:**
- Modify: `src/数据/BFF契约.ts`
- Create: `src/数据/招聘数据源/简历预填.ts`
- Create: `src/数据/招聘数据源/简历预填.test.ts`
- Create: `src/数据/招聘数据源/简历预填.fixture.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`

**Interfaces:**
- Consumes: the established module-local `请求函数` shape and existing `{不缓存, 严格信封}` options.
- Produces: `BFF简历预填建议`, `BFF简历预填来源`, `简历预填数据源`, and `读取简历预填(source)`.

- [ ] **Step 1: Add failing contract tests using the backend public fixture**

Copy the exact synthetic payload from backend commit `f2d7af565` into a TypeScript fixture export so tests do not depend on another checkout at runtime:

```ts
export const 简历预填成功信封 = {
  result: {
    schema_version: 'resume-prefill.v1',
    source: {
      file_id: 'rf_0123456789abcdef0123456789abcdef',
      version_id: 'rfv_0123456789abcdef0123456789abcdef',
      parse_id: 'rp_0123456789abcdef0123456789abcdef',
    },
    draft: {
      profile: {
        real_name: { value: 'Synthetic Candidate', confidence: 'high' },
        work_start_year: { value: 2021, confidence: 'medium' },
        status: { value: 'employed', confidence: 'high' },
        current_education: { value: 'Bachelor', confidence: 'medium' },
        graduation_year: { value: 2021, confidence: 'high' },
        gender: { value: null, confidence: null },
        birth_year: { value: null, confidence: null },
        birth_month: { value: null, confidence: null },
      },
      summary: { value: 'Builds reliable synthetic systems.', confidence: 'medium' },
      skills: [{ value: 'Go', confidence: 'high' }],
      experiences: [{
        company: { value: 'Example Systems', confidence: 'high' },
        industry: {
          source_name: { value: 'Software', confidence: 'medium' },
          resolution: 'exact',
          match: { id: 'tax_aaaaaaaaaaaaaaaaaaaaaaaaaa', display_name: 'Software' },
        },
        title: { value: 'Backend Engineer', confidence: 'high' },
        start_month: { value: '2021-07', confidence: 'high' },
        end_month: { value: null, confidence: null },
        description: { value: 'Implemented deterministic services.', confidence: 'medium' },
        internship: { value: false, confidence: 'high' },
        projects: [{
          name: { value: 'Synthetic Gateway', confidence: 'high' },
          role: { value: 'Maintainer', confidence: 'medium' },
          result: { value: 'Reduced contract drift.', confidence: 'medium' },
        }],
      }],
      educations: [{
        institution: {
          source_name: { value: 'Example University', confidence: 'medium' },
          resolution: 'unresolved',
          match: null,
        },
        degree: { value: 'Bachelor', confidence: 'high' },
        major: {
          source_name: { value: 'Computer Science', confidence: 'high' },
          resolution: 'unresolved',
          match: null,
        },
        start_month: { value: '2017-09', confidence: 'high' },
        end_month: { value: '2021-06', confidence: 'high' },
      }],
      certificates: [{
        name: { value: 'Synthetic Cloud Certificate', confidence: 'medium' },
        year: { value: null, confidence: null },
      }],
    },
    warnings: [
      { field_path: 'draft.educations[0].institution', reason: 'catalog_unresolved' },
      { field_path: 'draft.educations[0].major', reason: 'catalog_unresolved' },
    ],
  },
  meta: {
    request_id: '5f0c3a9b8d2e4f60a1b2c3d4e5f6a7b8',
    api_version: 'v1',
  },
} as const;
```

In `简历预填.test.ts`, assert the exact request and decoded result:

```ts
const 请求 = vi.fn().mockResolvedValue({
  result: 简历预填成功信封.result,
  etag: null,
  requestId: 简历预填成功信封.meta.request_id,
});
const source = 创建简历预填数据源(请求);
await expect(source.读取简历预填(简历预填成功信封.result.source))
  .resolves.toEqual(简历预填成功信封.result);
expect(请求).toHaveBeenCalledWith({
  path: '/api/v1/me/resume-files/rf_0123456789abcdef0123456789abcdef/parse-result?version_id=rfv_0123456789abcdef0123456789abcdef&parse_id=rp_0123456789abcdef0123456789abcdef',
  不缓存: true,
  严格信封: true,
});
```

Treat this copied object as the immutable **wire-decode fixture only**. Do not mutate it to manufacture positive page-mapping cases. Add clearly named local fixture builders/variants for valid gender, valid birth values, supported degree vocabulary, exact institution/major Catalog matches, and at least two education entries; those variants test frontend mapping and must not be described as backend public fixtures.

Add table cases that reject: extra/missing keys at every object level, `null` arrays, invalid echoed source ID grammar, unknown enum/warning reason, non-integer years, invalid `YYYY-MM`, mismatched scalar null/confidence pairs, `exact + null match`, `unresolved + non-null match`, and forbidden `contact/evidence/provider` keys. Each response rejection must match `{status: 200, code: 'invalid_response'}`. A caller-supplied source with invalid ID grammar must issue zero HTTP calls and follow the existing preflight-error convention: `{status: 0, code: 'invalid_request'}`.

- [ ] **Step 2: Run the new tests and verify the red state**

```bash
npm test -- src/数据/招聘数据源/简历预填.test.ts
```

Expected: FAIL because `创建简历预填数据源` and DTO exports do not exist.

- [ ] **Step 3: Add the wire DTOs and strict decoder**

Add these public shapes to `BFF契约.ts`:

```ts
export type BFF简历预填置信度 = 'high' | 'medium' | 'low';
export interface BFF简历预填标量<T> {
  value: T | null;
  confidence: BFF简历预填置信度 | null;
}
export interface BFF简历预填来源 {
  file_id: string;
  version_id: string;
  parse_id: string;
}
export type BFF简历预填目录建议 =
  | {
      source_name: BFF简历预填标量<string>;
      resolution: 'exact';
      match: { id: string; display_name: string };
    }
  | {
      source_name: BFF简历预填标量<string>;
      resolution: 'unresolved';
      match: null;
    };
export type BFF简历预填Warning原因 =
  | 'missing_required' | 'unsafe_month' | 'catalog_unresolved'
  | 'target_limit_exceeded' | 'enum_undetermined' | 'conflicting_sources';

export interface BFF简历预填项目 {
  name: BFF简历预填标量<string>;
  role: BFF简历预填标量<string>;
  result: BFF简历预填标量<string>;
}
export interface BFF简历预填经历 {
  company: BFF简历预填标量<string>;
  industry: BFF简历预填目录建议;
  title: BFF简历预填标量<string>;
  start_month: BFF简历预填标量<string>;
  end_month: BFF简历预填标量<string>;
  description: BFF简历预填标量<string>;
  internship: BFF简历预填标量<boolean>;
  projects: BFF简历预填项目[];
}
export interface BFF简历预填教育 {
  institution: BFF简历预填目录建议;
  degree: BFF简历预填标量<string>;
  major: BFF简历预填目录建议;
  start_month: BFF简历预填标量<string>;
  end_month: BFF简历预填标量<string>;
}
export interface BFF简历预填证书 {
  name: BFF简历预填标量<string>;
  year: BFF简历预填标量<number>;
}
export interface BFF简历预填建议 {
  schema_version: 'resume-prefill.v1';
  source: BFF简历预填来源;
  draft: {
    profile: {
      real_name: BFF简历预填标量<string>;
      work_start_year: BFF简历预填标量<number>;
      status: BFF简历预填标量<'student' | 'employed' | 'unemployed'>;
      current_education: BFF简历预填标量<string>;
      graduation_year: BFF简历预填标量<number>;
      gender: BFF简历预填标量<'male' | 'female'>;
      birth_year: BFF简历预填标量<number>;
      birth_month: BFF简历预填标量<number>;
    };
    summary: BFF简历预填标量<string>;
    skills: BFF简历预填标量<string>[];
    experiences: BFF简历预填经历[];
    educations: BFF简历预填教育[];
    certificates: BFF简历预填证书[];
  };
  warnings: Array<{ field_path: string; reason: BFF简历预填Warning原因 }>;
}
```

Implement `创建简历预填数据源` with closed-object guards matching `附件简历.ts`; do not extract a generic decoder abstraction.

The read method validates source IDs before the request, encodes each path/query coordinate once, passes `不缓存: true` and `严格信封: true`, decodes the complete result, and verifies the echoed source equals the request source.

Expose only this facade surface:

```ts
type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

export interface 简历预填数据源 {
  读取简历预填(source: BFF简历预填来源): Promise<BFF简历预填建议>;
}

export function 创建简历预填数据源(
  请求: 请求函数,
): 简历预填数据源;
```

Keep `请求函数` module-local, matching the existing `会话.ts`/`简历.ts` facade pattern; do not add a shared client-type abstraction solely for this reader.

- [ ] **Step 4: Compose the facade into `HTTP招聘数据源`**

```ts
import type { 简历预填数据源 } from './招聘数据源/简历预填';
import { 创建简历预填数据源 } from './招聘数据源/简历预填';

export type HTTP招聘数据源 = 会话数据源 & 目录数据源 & 简历数据源 &
  意向数据源 & 岗位数据源 & 组织数据源 & 隐私数据源 & Agent规则数据源 &
  发现推荐数据源 & 附件简历数据源 & MatchCase数据源 & 真人会话数据源 &
  P8控制面数据源 & 简历预填数据源;

return {
  // existing facades
  ...创建简历预填数据源(请求),
};
```

In `HTTP招聘数据源.test.ts`, assert the root source exposes `读取简历预填` and forwards the exact request without changing another domain.

- [ ] **Step 5: Run focused tests and commit**

```bash
npm test -- src/数据/招聘数据源/简历预填.test.ts src/数据/HTTP招聘数据源.test.ts
git add src/数据/BFF契约.ts src/数据/招聘数据源/简历预填.ts src/数据/招聘数据源/简历预填.test.ts src/数据/招聘数据源/简历预填.fixture.ts src/数据/HTTP招聘数据源.ts src/数据/HTTP招聘数据源.test.ts
git commit -m "feat(resume): add strict onboarding prefill reader"
```

Expected: both test files PASS; the commit contains no style or component files.

---

### Task 2: Pure Prefill State, Recovery Metadata, and Page Mappers

**Files:**
- Create: `src/流程/候选Onboarding简历预填.ts`
- Create: `src/流程/候选Onboarding简历预填.test.ts`
- Create: `src/数据/候选Onboarding预填恢复.ts`
- Create: `src/数据/候选Onboarding预填恢复.test.ts`
- Modify: `src/状态/后端/类型.ts`

**Interfaces:**
- Consumes: `BFF简历预填建议`, `BFF简历`, page resume types, and `目录选择值`.
- Produces: `候选预填状态`, `候选预填Eligibility`, `候选预填分区`, recovery storage, and pure page initializer functions.

- [ ] **Step 1: Write failing tests for state seeds, storage scope, and page mappings**

Freeze these types in tests:

```ts
export type 候选预填阶段 =
  | 'inactive' | 'arming' | 'waiting_parse' | 'loading' | 'ready' | 'failed' | 'manual';
export type 候选预填分区 =
  | 'basic' | 'degree' | 'institution' | 'major' | 'education_period' | 'work' | 'summary';
export interface 候选预填Eligibility {
  profile: {
    real_name: boolean;
    work_start_year: boolean;
    gender: boolean;
    birth_year: boolean;
    birth_month: boolean;
  };
  summary: boolean;
  skills: boolean;
  experiences: boolean;
  educations: boolean;
  certificates: boolean;
}
```

The initial state is `inactive`, has no source/suggestion/error, all confirmed flags are false, and generation is `0`. Recovery metadata contains only mode, `{file_id, version_id, parse_id|null}`, eligibility, confirmed flags, and generation; prove serialized JSON does not contain `draft`, `summary`, candidate text, or the full suggestion.

Add mapping tests for all Spec §8 cases: page/server values win; status is never mapped; unsupported degrees are not translated; exact Catalog values carry refs while unresolved values do not; birth year/month are limited to `1970..2010` / `1..12`; education years are limited to `2000..2030`; certificate null year stays empty; non-empty server list partitions are not merged; additional educations may materialize only when the current list has a primary entry but no entries beyond index 0; temporary keys start with `prefill:` and cannot match server ID grammar; order is preserved; parsed experiences retain the existing UI privacy default `隐藏:true`; summary only applies to the preference-stage personal-advantage question. Use the immutable backend fixture for decode coverage and the clearly labelled local variants from Task 1 for positive gender/birth/degree/exact-Catalog assertions.

Use explicit assertions such as:

```ts
const 现有经历fixture: 简历经历段 = {
  编号: 'exp_server_1',
  公司: '现有公司',
  行业: '软件',
  职位: '工程师',
  开始: '2024-01',
  结束: null,
  内容: '',
  隐藏: true,
};

const 全可预填: 候选预填Eligibility = {
  profile: { real_name: true, work_start_year: true, gender: true, birth_year: true, birth_month: true },
  summary: true,
  skills: true,
  experiences: true,
  educations: true,
  certificates: true,
};

function readyState(
  suggestion: BFF简历预填建议,
  patch: Partial<Omit<候选预填Eligibility, 'profile'>> = {},
): 候选预填状态 {
  return {
    ...创建空候选预填状态(),
    phase: 'ready',
    source: suggestion.source,
    eligibility: { ...全可预填, ...patch },
    suggestion,
  };
}

it('does not merge suggestions into a non-empty server experience partition', () => {
  const state = readyState(简历预填成功信封.result, { experiences: false });
  const current = { experiences: [现有经历fixture], educations: [], skills: [], certificates: [] };
  expect(取工作页预填(state, current).experiences).toEqual([现有经历fixture]);
});

it('keeps unresolved institution text without inventing a ref', () => {
  const state = readyState(简历预填成功信封.result, { educations: true });
  expect(取学校预填(state, '', undefined)).toEqual({ text: 'Example University' });
});
```

- [ ] **Step 2: Run the pure tests and verify the red state**

```bash
npm test -- src/流程/候选Onboarding简历预填.test.ts src/数据/候选Onboarding预填恢复.test.ts
```

Expected: FAIL because the state/mapping/storage modules are missing.

- [ ] **Step 3: Implement the pure state and recovery storage**

Add this state to `后端状态`, not the root Resume reducer:

```ts
export interface 候选预填绑定来源 {
  file_id: string;
  version_id: string;
  parse_id: string | null;
}
export interface 候选预填状态 {
  phase: 候选预填阶段;
  source: 候选预填绑定来源 | null;
  eligibility: 候选预填Eligibility | null;
  suggestion: BFF简历预填建议 | null;
  confirmed: Record<候选预填分区, boolean>;
  error: string | null;
  generation: number;
}
export interface 候选预填恢复元数据 {
  mode: 'auto' | 'manual';
  source: 候选预填绑定来源;
  eligibility: 候选预填Eligibility;
  confirmed: Record<候选预填分区, boolean>;
  generation: number;
}
export interface 候选预填恢复存储 {
  读取(): 候选预填恢复元数据 | null;
  写入(metadata: 候选预填恢复元数据): boolean;
  删除(): void;
}
```

Export `创建空候选预填状态(generation = 0)` and `创建候选预填恢复存储({storage, 范围}: {storage: Storage | null; 范围: 资料缓存范围})`. Follow the existing `P8导出恢复`/`资料缓存范围` pattern: the bound key includes backend mode, environment, candidate category, and account; candidate role is enforced before the Provider creates the bound adapter. Validate parsed metadata with exact keys and fail closed by deleting malformed entries. Never serialize `suggestion`.

- [ ] **Step 4: Implement focused pure page initializers**

```ts
export interface 候选工作页当前值 {
  experiences: 简历经历段[];
  educations: 简历教育段[];
  skills: string[];
  certificates: 简历证书[];
}

export interface 候选基本信息预填 {
  真名?: string;
  开始工作年?: string;
  性别?: 基本信息['性别'];
  出生年?: number;
  出生月?: number;
}

取基本信息预填(state: 候选预填状态, current: 基本信息): 候选基本信息预填
取最高学历预填(state: 候选预填状态, isStudent: boolean, current: string): string | null
取学校预填(state: 候选预填状态, currentText: string, currentRef?: 目录选择值): { text: string; ref?: 目录选择值 }
取专业预填(state: 候选预填状态, currentText: string, currentRef?: 目录选择值): { text: string; ref?: 目录选择值 }
取就读年份预填(state: 候选预填状态, currentStart: number, currentEnd: number, isStudent: boolean): { start: number; end: number }
取工作页预填(state: 候选预填状态, current: 候选工作页当前值): {
  experiences: 简历经历段[];
  educations: 简历教育段[];
  skills: string[];
  certificates: 简历证书[];
  unresolvedCount: number;
}
取个人优势预填(state: 候选预填状态, stage: 向导段, current: string): string
```

Each function returns existing page-domain values only. It does not mutate state, mark a section confirmed, write storage, or create server IDs.

- [ ] **Step 5: Run focused tests and commit**

```bash
npm test -- src/流程/候选Onboarding简历预填.test.ts src/数据/候选Onboarding预填恢复.test.ts
git add src/流程/候选Onboarding简历预填.ts src/流程/候选Onboarding简历预填.test.ts src/数据/候选Onboarding预填恢复.ts src/数据/候选Onboarding预填恢复.test.ts src/状态/后端/类型.ts
git commit -m "feat(resume): define onboarding prefill state and mappings"
```

Expected: focused tests PASS and no React/UI file has changed.

---

### Task 3: Fenced Prefill Operations and Cleanup

**Files:**
- Create: `src/状态/后端/简历预填操作.ts`
- Create: `src/状态/后端/简历预填操作.test.ts`
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/后端/会话操作.test.ts`
- Modify: `src/状态/应用状态.tsx`

**Interfaces:**
- Consumes: Task 1 `读取简历预填`, Task 2 state/storage, existing `后端状态引用`, `主体标识引用`, and `会话代际`.
- Produces: `简历预填操作` methods exposed through `应用操作`.

- [ ] **Step 1: Write failing operation tests**

Define the page-facing API:

```ts
export interface 简历预填操作 {
  恢复候选Onboarding预填(options: { 允许等待解析: boolean }): Promise<void>;
  激活候选Onboarding预填(): void;
  同步候选Onboarding解析(): Promise<void>;
  重试候选Onboarding预填(): Promise<void>;
  继续手填候选Onboarding(): void;
  确认候选Onboarding预填分区(section: 候选预填分区): void;
  清候选Onboarding预填(): void;
}
```

Use a real factory with fake refs, following `附件简历操作.test.ts`. Cover Mock/no backend/no candidate zero calls; explicit activation from the authoritative attachment and Resume eligibility snapshot; recovery no-op for every already-present in-memory round (especially `ready`, `loading`, and `waiting_parse`); metadata recovery only when the in-memory state is pristine `inactive` and the bound subject/current file/version match; pending zero reads; route-aware pending recovery (`允许等待解析:true` restores `waiting_parse`, `false` enters/persists `manual`); authoritative succeeded parse upgrades state and recovery metadata to the real `parse_id` before a deferred read settles; null stored `parse_id` with an authoritative succeeded parse still recovers loading/read; succeeded exact-tuple single flight; replacement invalidation; subject/role/session/prefill/tuple late-response fences; current versus stale 401; terminal 400/403/`invalid_response`; one-shot 404/409 refresh; retryable 503/network failure; manual opt-out; post-save section confirmation; and full memory/lock/storage cleanup. Terminal contract/role failures enter `failed`, keep online Resume data intact, and never apply partial decoded data.

Define `创建预填场景()` to return `{后端, 操作, 后端状态引用, 会话代际, 候选预填代际, 恢复存储}` and use controlled promises for fence tests:

```ts
it('drops a success that settles after replacement activation', async () => {
  const 场景 = 创建预填场景({ parse: 'succeeded' });
  const 门 = 可控Promise<BFF简历预填建议>();
  场景.后端.读取简历预填.mockReturnValue(门.promise);
  const oldRead = 场景.操作.同步候选Onboarding解析();
  场景.操作.激活候选Onboarding预填();
  门.resolve(简历预填成功信封.result);
  await oldRead;
  expect(场景.后端状态引用.current.候选预填状态.suggestion).toBeNull();
});

it('manual opt-out blocks a late suggestion', async () => {
  const 场景 = 创建预填场景({ parse: 'succeeded' });
  const 门 = 可控Promise<BFF简历预填建议>();
  场景.后端.读取简历预填.mockReturnValue(门.promise);
  const read = 场景.操作.同步候选Onboarding解析();
  场景.操作.继续手填候选Onboarding();
  门.resolve(简历预填成功信封.result);
  await read;
  expect(场景.后端状态引用.current.候选预填状态.phase).toBe('manual');
  expect(场景.后端状态引用.current.候选预填状态.suggestion).toBeNull();
});
```

- [ ] **Step 2: Run the operation tests and verify the red state**

```bash
npm test -- src/状态/后端/简历预填操作.test.ts
```

Expected: FAIL because the operation factory and state dependencies are absent.

- [ ] **Step 3: Add runtime refs and the operation factory**

Extend the broad `后端操作依赖` and Provider with narrowly owned refs, following the existing P4–P8 compatibility pattern:

```ts
候选预填代际?: 可变引用<number>;
候选预填读取锁?: 可变引用<Map<string, Promise<void>>>;
候选预填恢复?: 可变引用<候选预填恢复存储 | null>;

export interface 候选预填运行时引用 {
  候选预填代际: 可变引用<number>;
  候选预填读取锁: 可变引用<Map<string, Promise<void>>>;
  候选预填恢复: 可变引用<候选预填恢复存储 | null>;
}
```

The Provider always initializes and passes them. Keep them optional only on the cross-domain `后端操作依赖` so unrelated operation fixtures do not all acquire prefill-only setup. At the first line of `创建简历预填操作`, call a `取候选预填引用` assertion equivalent to the existing `取P7引用`/`取P8引用`; it must throw on any missing ref and return `后端操作依赖 & 候选预填运行时引用`. All prefill helpers and tests use that required intersection after entry, so omission can never degrade into a no-op. Capture `{subjectId, role:'candidate', sessionGeneration, prefillGeneration, fileId, versionId, parseId}` before each read and commit only if every coordinate still matches the refs and current attachment. The single-flight key is exact `fileId|versionId|parseId` and is released in `finally`.

- [ ] **Step 4: Wire unified account cleanup**

Seed `候选预填状态` in `应用状态提供者` and compose `创建简历预填操作(deps)` into `应用操作`. `恢复候选Onboarding预填({允许等待解析})` must first inspect the in-memory round and no-op unless it is the pristine missing state (`phase:'inactive'`, `source:null`, `suggestion:null`); live `arming`/`waiting_parse`/`loading`/`ready`/`failed`/`manual` rounds are never replaced or redundantly read by recovery. Only then read the current subject-bound metadata, wait for candidate/attachment hydration, and validate current file/version and parse state. Restore explicit `manual` metadata as `manual`. If the authoritative current attachment says parse `succeeded`, take its current non-null `parse_id`, update the in-memory source and re-persist the metadata source with that exact ID, enter `loading`, then single-flight read; a null stored `parse_id` alone never forces manual. If the authoritative parse is pending/processing: `允许等待解析:true` restores `waiting_parse` with zero prefill reads, while `false` immediately persists/enters `manual`. A missing or mismatched record is deleted and leaves state inactive. Add operation tests for the no-op guard, both pending branches, null-stored-ID/succeeded recovery, and metadata upgrade before a controlled read settles. Extend `清账号状态` plus login/switch-role reset paths to remove outgoing-subject metadata, increment prefill generation, clear read locks, and reset state. Reuse any calibrated shared cleanup registry from the adjacent branch; do not create a second session owner.

`同步候选Onboarding解析()` follows the same authoritative rule during the live flow: as soon as the current attachment reaches `succeeded`, copy its `parse_id` into `候选预填状态.source` and recovery metadata **before** starting/awaiting `读取简历预填`. This closes the refresh-during-read window and keeps the persisted tuple re-derivable without storing suggestion data.

- [ ] **Step 5: Run operation and session tests, then commit**

```bash
npm test -- src/状态/后端/简历预填操作.test.ts src/状态/后端/会话操作.test.ts src/状态/后端/附件简历操作.test.ts
git add src/状态/后端/简历预填操作.ts src/状态/后端/简历预填操作.test.ts src/状态/后端/类型.ts src/状态/后端/会话操作.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.tsx
git commit -m "feat(resume): manage fenced onboarding prefill state"
```

Expected: all three test files PASS; existing attachment behavior is unchanged.

---

### Task 4: Upload-Page Activation and Manual-Entry Gate

**Files:**
- Modify: `src/屏幕/学生分流.tsx`
- Modify: `src/屏幕/学生分流.test.tsx`

**Interfaces:**
- Consumes: Task 3 operations and `后端状态.候选预填状态`.
- Produces: explicit activation after authoritative upload/replace and the existing-component wait/manual interaction.

- [ ] **Step 1: Write failing screen tests**

Extend the existing `render学生分流` fixture with prefill state and operation spies. Prove:

- entering with an old succeeded attachment and no recovery metadata never activates or reads prefill;
- mounting calls `恢复候选Onboarding预填({允许等待解析:true})`; only previously persisted matching metadata may resume a flow, and matching pending/processing metadata restores `waiting_parse` so this page's existing poller can advance it;
- after create/replace resolves `'已提交'`, activation is called exactly once;
- `'已换代'` does not activate or show success feedback;
- authoritative parse-coordinate changes call `同步候选Onboarding解析`, while the page owns no direct BFF request;
- ready/manual continues through the existing route;
- pending/processing/loading plus the existing next button renders the existing `确认层` with “再等等 / 继续手填”;
- “再等等” closes the layer and stays; “继续手填” calls the manual operation then navigates;
- parse/read failures reuse `轻提示` and the existing upload action;
- banner feedback only changes existing `代理横幅` props and component order is unchanged;
- Mock behavior and upload-consent copy remain unchanged.

The core activation test should be explicit:

```ts
async function 选择并同意PDF(name: string): Promise<void> {
  const 用户 = userEvent.setup();
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await 用户.upload(input, new File(['%PDF'], name, { type: 'application/pdf' }));
  await 用户.click(screen.getByRole('button', { name: '同意并继续' }));
}

it('activates only after the authoritative upload flow resolves', async () => {
  mock操作.创建附件简历.mockResolvedValue('已提交');
  render学生分流({ 数据源: 'backend', 附件库: { items: [], limits } });
  await 选择并同意PDF('resume.pdf');
  await waitFor(() => expect(mock操作.激活候选Onboarding预填).toHaveBeenCalledTimes(1));
  expect(mock操作.创建附件简历.mock.invocationCallOrder[0]!)
    .toBeLessThan(mock操作.激活候选Onboarding预填.mock.invocationCallOrder[0]!);
});
```

- [ ] **Step 2: Run the screen test and verify the red state**

```bash
npm test -- src/屏幕/学生分流.test.tsx
```

Expected: FAIL on missing activation/gate behavior.

- [ ] **Step 3: Wire the existing controls**

On mount after candidate/attachment hydration, call `操作.恢复候选Onboarding预填({允许等待解析:true})` once. After create/replace returns `'已提交'`, call `操作.激活候选Onboarding预填()`. Watch only the authoritative current attachment parse coordinates and call `同步候选Onboarding解析()` from an effect; operation-layer single flight owns duplication.

Keep the existing `代理横幅` node in the same JSX position and vary only its existing props. Reuse the already imported `确认层` for the leave-page decision. Add no wrapper DOM, status row, class name, or inline style.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- src/屏幕/学生分流.test.tsx src/流程/附件简历刷新.test.tsx
git diff --name-only -- '*.css' '*.module.css' 'src/组件/**'
git add src/屏幕/学生分流.tsx src/屏幕/学生分流.test.tsx
git commit -m "feat(onboarding): gate resume prefill at upload entry"
```

Expected: tests PASS and the style/component diff command prints nothing.

---

### Task 5: Basic and Education Page Initializers

**Files:**
- Modify: `src/屏幕/基本信息.tsx`
- Create: `src/屏幕/基本信息.test.tsx`
- Modify: `src/屏幕/最高学历.tsx`
- Create: `src/屏幕/最高学历.test.tsx`
- Modify: `src/屏幕/毕业院校.tsx`
- Modify: `src/屏幕/毕业院校.test.tsx`
- Modify: `src/屏幕/选专业.tsx`
- Modify: `src/屏幕/选专业.test.tsx`
- Modify: `src/屏幕/就读时间段.tsx`
- Create: `src/屏幕/就读时间段.test.tsx`

**Interfaces:**
- Consumes: Task 2 pure page initializers and Task 3 section confirmation.
- Produces: existing controls initialized from eligible ready suggestions and confirmed only after existing saves succeed.

- [ ] **Step 1: Write failing page tests**

For each page fixture, add a ready prefill state and enforce this priority:

```text
current page/server value > eligible suggestion > existing UI default
```

Verify Basic maps name, non-student work-start year, gender, and valid numeric birth year/month (`1970..2010` / `1..12`) but not status; out-of-range birth values retain the existing defaults; degree only accepts Spec §8.2 vocabulary; exact school/major initializes text and canonical ref; unresolved initializes text without ref and remains blocked by the existing selector guard; education years only accept `2000..2030`; and section confirmation happens after `保存简历` resolves, never before or after rejection. Use local positive variants rather than changing the immutable backend wire fixture. Manual/inactive/non-eligible/already-confirmed states must retain old initialization. For `基本信息`, also navigate back and re-enter after editing name/gender/work-start year and prove those edits remain in the root client draft.

Use per-page assertions against existing controls and saves:

```ts
it('shows unresolved school text but keeps the existing canonical guard closed', async () => {
  const 保存简历 = vi.fn();
  render毕业院校({ 数据源: 'backend', 预填: readyUnresolvedSchool(), 保存简历 });
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Example University');
  await userEvent.click(screen.getByRole('button', { name: '下一步' }));
  expect(mock轻提示).toHaveBeenCalledWith('请从候选学校中选择');
  expect(保存简历).not.toHaveBeenCalled();
});

it('confirms basic only after the existing save resolves', async () => {
  const 门 = 可控Promise<void>();
  mock操作.保存简历.mockReturnValue(门.promise);
  render基本信息({ 预填: readyBasic() });
  await userEvent.click(screen.getByRole('button', { name: '下一步' }));
  expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
  门.resolve();
  await waitFor(() => expect(mock操作.确认候选Onboarding预填分区).toHaveBeenCalledWith('basic'));
});
```

- [ ] **Step 2: Run page tests and verify the red state**

```bash
npm test -- src/屏幕/基本信息.test.tsx src/屏幕/最高学历.test.tsx src/屏幕/毕业院校.test.tsx src/屏幕/选专业.test.tsx src/屏幕/就读时间段.test.tsx
```

Expected: FAIL on the new prefill/confirmation assertions.

- [ ] **Step 3: Use pure initializers in existing `useState` initializers**

Compute values synchronously during first mount. Do not add asynchronous effects that can overwrite mounted input. Preserve each JSX branch and change only value/event wiring. `基本信息` must preserve its existing per-keystroke root dispatch: the root Resume object is the page's client draft, and replacing it with page-local state would lose edits on back/re-entry. Capture the eligible suggestion once at mount, synchronously seed only the blank root fields `真名`/`性别`/`开始工作年` through the existing `存简历` dispatch in a one-shot `useLayoutEffect`, and keep rendering/editing those controls from `基本`. This is client-draft initialization only; it must not call `/me/resume` or seed education/experience/skills/certificates. Keep birth wheels page-local with numeric mapper output:

```ts
const [基本预填] = useState(() => 取基本信息预填(后端状态.候选预填状态, 基本));
const [出生年, 设出生年] = useState<number>(() => 基本预填.出生年 ?? (Number(基本.出生年) || 1998));
const [出生月, 设出生月] = useState<number>(() => 基本预填.出生月 ?? (Number(基本.出生月) || 6));
const 已种基本预填 = useRef(false);

useLayoutEffect(() => {
  if (已种基本预填.current) return;
  已种基本预填.current = true;
  const 根字段 = 仅取根基本字段(基本预填); // excludes 出生年/出生月
  if (Object.keys(根字段).length > 0) 存基本信息(根字段);
}, [基本预填, 存基本信息]);
```

`仅取根基本字段` may be an inline pure helper, but must return only non-empty mapper keys among `真名`/`性别`/`开始工作年`; do not write status or birth-wheel values during mount. Keep `存基本信息` behavior and controls bound to `基本`, and pass `基本` plus the local birth values to the existing `保存简历` call. Call the matching confirmation operation only after the existing save promise resolves and before navigation. A failed save leaves the section unconfirmed.

This intentionally has mount-scoped rather than persisted touched state: before `basic` is confirmed, if the user clears a suggested root field, leaves the page, and re-enters while auto prefill remains active, that blank field may be suggested again. A non-empty user edit still wins, and the explicit manual path disables all re-seeding. Pin this accepted behavior in the page test; do not add a general or persisted touched-field framework for this edge case.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- src/屏幕/基本信息.test.tsx src/屏幕/最高学历.test.tsx src/屏幕/毕业院校.test.tsx src/屏幕/选专业.test.tsx src/屏幕/就读时间段.test.tsx
git diff --name-only -- '*.css' '*.module.css' 'src/组件/**'
git add src/屏幕/基本信息.tsx src/屏幕/基本信息.test.tsx src/屏幕/最高学历.tsx src/屏幕/最高学历.test.tsx src/屏幕/毕业院校.tsx src/屏幕/毕业院校.test.tsx src/屏幕/选专业.tsx src/屏幕/选专业.test.tsx src/屏幕/就读时间段.tsx src/屏幕/就读时间段.test.tsx
git commit -m "feat(onboarding): prefill basic and education forms"
```

Expected: all page tests PASS and zero style/component files changed.

---

### Task 6: Work Sections and Personal-Advantage Initializers

**Files:**
- Modify: `src/屏幕/工作经历.tsx`
- Modify: `src/屏幕/工作经历.test.tsx`
- Modify: `src/屏幕/引导问答.tsx`
- Modify: `src/屏幕/引导问答.test.tsx`

**Interfaces:**
- Consumes: Task 2 work/summary mappers and Task 3 section confirmation.
- Produces: existing work cards/skills/certificates and personal-advantage field initialized from ready suggestions.

- [ ] **Step 1: Write failing work and summary tests**

Cover empty-server-and-page-only list materialization; no index merge into an existing server partition; exact versus unresolved refs; deterministic non-server `prefill:` keys; existing privacy default `隐藏=true`; unset internship; empty certificate year; parser order; save-success-only confirmation; preference-stage-only summary; and summary confirmation immediately after `保存个人优势` succeeds even if the later first-intention save fails. For additional education specifically, preserve the primary entry built by the four education pages and append `suggestion.educations.slice(1)` only when source-time `educations` eligibility is true, `current.educations[0]` exists, `current.educations.slice(1)` is empty, and `work` is unconfirmed. Assert it materializes once in the normal flow and does not append when any current additional entry exists. Manual/inactive/already-confirmed flows retain current behavior.

```ts
it('does not append parsed experiences to an existing server list', () => {
  const existing: 简历经历段 = {
    编号: 'exp_server_1', 公司: '现有公司', 行业: '软件', 职位: '工程师',
    开始: '2024-01', 结束: null, 内容: '', 隐藏: true,
  };
  render工作经历({ 预填: readyWork({ experiencesEligible: false }), 经历: [existing] });
  expect(screen.getByText(existing.公司)).toBeTruthy();
  expect(screen.queryByText('Example Systems')).toBeNull();
});

it('confirms summary after summary save even when first intention fails', async () => {
  mock操作.保存个人优势.mockResolvedValue(undefined);
  mock操作.保存首次意向.mockRejectedValue(new Error('offline'));
  render引导问答({ 段: '偏好段', 预填: readySummary() });
  await 提交到个人优势题();
  expect(mock操作.确认候选Onboarding预填分区).toHaveBeenCalledWith('summary');
});
```

- [ ] **Step 2: Run tests and verify the red state**

```bash
npm test -- src/屏幕/工作经历.test.tsx src/屏幕/引导问答.test.tsx
```

Expected: FAIL on new mapper and confirmation behavior.

- [ ] **Step 3: Wire initial values and existing feedback**

Use `取工作页预填` once when the work page mounts. Preserve current card/edit JSX and directory selectors. On an existing finish/save click, use `unresolvedCount` only as input to `轻提示`; render no banner, row, badge, or class.

Initialize `自我介绍` with `取个人优势预填(state, 段, 全局.个人优势)`. Confirm summary immediately after `保存个人优势` succeeds; do not tie confirmation to the subsequent intention request.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- src/屏幕/工作经历.test.tsx src/屏幕/引导问答.test.tsx
git diff --name-only -- '*.css' '*.module.css' 'src/组件/**'
git add src/屏幕/工作经历.tsx src/屏幕/工作经历.test.tsx src/屏幕/引导问答.tsx src/屏幕/引导问答.test.tsx
git commit -m "feat(onboarding): prefill resume sections and summary"
```

Expected: tests PASS; existing component order and styling files remain untouched.

---

### Task 7: Refresh Recovery Boundary and Onboarding Exit Cleanup

**Files:**
- Create: `src/流程/候选Onboarding预填边界.tsx`
- Create: `src/流程/候选Onboarding预填边界.test.tsx`
- Modify: `src/应用.tsx`
- Modify: `src/应用.test.tsx`
- Modify: `src/屏幕/添加头像.tsx`
- Create: `src/屏幕/添加头像.test.tsx`

**Interfaces:**
- Consumes: recovery metadata, authoritative attachment state, Task 3 retry/manual/clear operations, existing `路由加载中` and `确认层`.
- Produces: exact-tuple refresh recovery and deterministic cleanup at onboarding completion/exit.

- [ ] **Step 1: Write failing boundary and route tests**

Use this consumer set:

```ts
const 消费预填路径 = new Set([
  路径.基本信息,
  路径.最高学历,
  路径.毕业院校,
  路径.选专业,
  路径.就读时间段,
  路径.工作经历,
]);

function 是预填消费位置(pathname: string, search: string): boolean {
  if (消费预填路径.has(pathname)) return true;
  return pathname === 路径.引导问答 && 读向导段(new URLSearchParams(search).get(向导段参数名)) === '偏好段';
}
```

Build the active onboarding set from the union of candidate flows before `路径.主壳`, plus city/job subpages. Route identity must include `location.search` so `/wizard?stage=salary` stays active but never consumes the summary suggestion. At a consumer location, the boundary calls `恢复候选Onboarding预填({允许等待解析:false})` only when the in-memory state is pristine `inactive`/missing; the operation repeats this guard defensively. Assert an in-memory `ready` round mounts directly with zero recovery reads and zero state changes; exact authoritative-succeeded refresh loading/recovery, including null stored `parse_id`; authoritative pending/processing recovery on a consumer route immediately becomes manual and mounts the form without a poll/read; safe mismatch failure; manual/inactive-without-metadata bypass; no reads on salary/status/disclosure/city/job/avatar; cleanup on main/other product routes; cleanup before “完成注册” navigation; no old suggestion after completion; and no visible wrapper DOM or route-order change.

```tsx
it('restores an exact tuple before mounting the consumer form', async () => {
  const 门 = 可控Promise<void>();
  mock操作.恢复候选Onboarding预填.mockReturnValue(门.promise);
  renderBoundary(路径.基本信息, activeRecoveryMetadata());
  expect(screen.getByText('正在加载…')).toBeTruthy();
  expect(screen.queryByTestId('consumer-form')).toBeNull();
  门.resolve();
  await waitFor(() => expect(screen.getByTestId('consumer-form')).toBeTruthy());
});

it('keeps salary wizard active without reading the summary suggestion', () => {
  renderBoundary(路径.引导问答薪资段, activeRecoveryMetadata());
  expect(mock操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
  expect(mock操作.清候选Onboarding预填).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run boundary tests and verify the red state**

```bash
npm test -- src/流程/候选Onboarding预填边界.test.tsx src/应用.test.tsx src/屏幕/添加头像.test.tsx
```

Expected: FAIL because the boundary and cleanup hooks are absent.

- [ ] **Step 3: Implement the non-visual boundary**

The boundary may return a Fragment around children but adds no layout DOM. During recovery, return existing `路由加载中`. On recoverable failure, reuse `确认层`; if its frozen API cannot express the behavior, record a PM dependency and preserve safe manual entry instead of editing the component.

In `应用.tsx`, apply the boundary only to consumer route elements. Observe location changes for cleanup, using `Onboarding流程` as source of truth instead of duplicating a partial active path list.

- [ ] **Step 4: Wire explicit completion cleanup**

In `添加头像.tsx`, call `清候选Onboarding预填()` immediately before the existing “完成注册” navigation. Do not change button copy, position, or styles.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- src/流程/候选Onboarding预填边界.test.tsx src/应用.test.tsx src/屏幕/添加头像.test.tsx src/流程/onboarding配置.test.ts
git diff --name-only -- '*.css' '*.module.css' 'src/组件/**'
git add src/流程/候选Onboarding预填边界.tsx src/流程/候选Onboarding预填边界.test.tsx src/应用.tsx src/应用.test.tsx src/屏幕/添加头像.tsx src/屏幕/添加头像.test.tsx
git commit -m "feat(onboarding): recover and clear resume prefill"
```

Expected: route/recovery tests PASS and no style or PM-owned component changes exist.

---

### Task 8: Cross-Domain Regression and Release Gate

**Files:**
- Modify: `src/屏幕/我的简历.test.tsx`
- Modify: `src/流程/附件简历刷新.test.tsx`
- Modify: `src/屏幕/学生分流.test.tsx`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: evidence that the approved Spec is satisfied without visual ownership drift.

- [ ] **Step 1: Add explicit daily-resume and Mock zero-call regressions**

In `我的简历.test.tsx`, provide a prefill operation spy and assert upload, replace, and explicit reparse never call it or create onboarding recovery metadata. In Student/page tests, assert Mock mode never calls a prefill operation.

```ts
it('daily resume reparse never activates onboarding prefill', async () => {
  render我的简历({ mode: 'backend', library: { items: [文件B], limits } });
  await revealActions();
  await userEvent.click(screen.getByRole('button', { name: '重新解析' }));
  await userEvent.click(screen.getByRole('button', { name: '同意并继续' }));
  expect(mock操作.请求附件解析).toHaveBeenCalledTimes(1);
  expect(mock操作.激活候选Onboarding预填).not.toHaveBeenCalled();
  expect(mock操作.同步候选Onboarding解析).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the complete focused suite**

```bash
npm test -- src/数据/招聘数据源/简历预填.test.ts src/数据/HTTP招聘数据源.test.ts src/数据/候选Onboarding预填恢复.test.ts src/流程/候选Onboarding简历预填.test.ts src/状态/后端/简历预填操作.test.ts src/状态/后端/会话操作.test.ts src/状态/后端/附件简历操作.test.ts src/流程/附件简历刷新.test.tsx src/屏幕/学生分流.test.tsx src/屏幕/基本信息.test.tsx src/屏幕/最高学历.test.tsx src/屏幕/毕业院校.test.tsx src/屏幕/选专业.test.tsx src/屏幕/就读时间段.test.tsx src/屏幕/工作经历.test.tsx src/屏幕/引导问答.test.tsx src/流程/候选Onboarding预填边界.test.tsx src/屏幕/添加头像.test.tsx src/屏幕/我的简历.test.tsx src/应用.test.tsx
```

Expected: all listed tests PASS with zero unhandled rejection or timer leak.

- [ ] **Step 3: Run repository verification**

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit `0`.

- [ ] **Step 4: Prove the UI ownership boundary**

```bash
git diff origin/main...HEAD --name-only -- '*.css' '*.module.css' 'src/组件/**'
git diff origin/main...HEAD -- '*.tsx' | rg '^\+.*style=|^\+.*style\s*\{'
```

Expected: both commands produce no output. Inspect page diffs and confirm existing visible component order is unchanged.

- [ ] **Step 5: Verify scope and commit the boundary regressions**

```bash
git status --short
git diff --check
git diff origin/main...HEAD --stat
```

Expected: only approved data/state/flow/page/test/docs files are present; no unrelated change or whitespace error.

```bash
git add src/屏幕/我的简历.test.tsx src/流程/附件简历刷新.test.tsx src/屏幕/学生分流.test.tsx
git commit -m "test(resume): lock onboarding prefill boundaries"
```
