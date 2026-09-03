# JD PDF Import Frontend Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended in one session) or `superpowers:executing-plans` (fresh execution session) to implement this plan task-by-task. Track every checkbox and do not skip the red test.

**Goal:** Connect the PM-owned new-job JD upload entry to the frozen Backend import contract, then safely auto-fill only fields or coupled groups that the recruiter has not changed since upload.

**Architecture:** Add one strict JD import facade to the existing HTTP data source, expose it through the existing subject/role/session-fenced operation layer, and keep upload, consent, polling, retry, snapshot, and suggestion-merge state local to `发布岗位.tsx`. Reuse existing components in their existing positions; do not create a document-import framework or persist import state.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Vitest 4, Testing Library, Playwright, existing same-origin BFF client.

**Spec:** `docs/superpowers/specs/2026-09-03-jd-pdf-import-frontend-wiring-design.md`

**Backend handoff:** `docs/handoffs/2026-09-03-jd-pdf-import-frontend-wiring.md`

**Frontend baseline:** `86125819`

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

## Global Constraints

- 开始前完整阅读 `AGENTS.md`、`CLAUDE.md`、已批准 Spec 和原始 handoff。实现只能收窄或落实 Spec，不得重新设计。
- 只支持 `Backend + recruiter + 新建岗位`。Mock、候选人角色、未登录和编辑岗位均不得调用 JD 接口；编辑岗位不出现 JD 入口。
- consent 前零 mutation；首次 POST 起飞前捕获表单快照。同一合法文件意图的显式 POST 重试必须复用相同 `File + Idempotency-Key + 快照`。
- 解析期间表单始终可编辑。成功时只写入仍等于上传快照的字段；三个耦合组必须整组比较。Catalog 引用永远高于模型源文本。
- 不把 `File`、建议 DTO、import ID、幂等键、快照或运行态写入应用全局状态、localStorage 或 sessionStorage。
- 不抽取通用轮询器、通用文档导入器、通用严格解码框架或新的状态容器。本轮只有一个页面用例，页面本地函数和领域本地 guard 是满足需求的最小方案。
- **PM 视觉硬冻结：** 不修改或新增任何 `.css`、`.module.css`、全局样式、CSS variable、inline style、animation 或现有 `className`。
- **PM 组件硬冻结：** 不修改 `src/组件/**`，不扩展共享组件 props，不新增 UI 组件文件。
- **PM 布局硬冻结：** 不移动、重排、包裹现有可视节点，不增加常驻节点、状态行、结果卡、提示条或布局容器。只允许在原位置改 `代理横幅` 的既有 props、条件渲染既有 `确认层`、调用 `轻提示`，以及给既有 DOM/控件补行为属性。
- 全远程时保留办公地点输入所在节点与布局，只清空并给现有 `<input>` 加 `disabled`；切回现场/混合不恢复旧地址。
- 每个 Task 红绿 TDD、通过定向测试后独立 commit。不得 stage 用户的无关改动；不得改视觉基线。

## Preflight

- [ ] 验证分支、干净工作树和基线；若实现基线已经漂移，先对照 Spec 校准，不自行扩展范围。

```bash
git status --short
git branch --show-current
git merge-base --is-ancestor 86125819 HEAD
git diff --name-only 86125819...HEAD -- '*.css' '*.module.css' 'src/组件/**'
```

Expected: 工作树干净；当前分支包含 `86125819`；冻结路径 diff 无输出。

- [ ] 建立实现前门禁记录。

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 全部 PASS。若基线失败，记录原始命令和输出并停止，不能把基线故障混进本功能提交。

---

### Task 1: Strict JD Import Contract and HTTP Facade

**Files:**
- Modify: `src/数据/BFF契约.ts`
- Create: `src/数据/招聘数据源/JD导入.ts`
- Create: `src/数据/招聘数据源/JD导入.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`

**Consumes:** existing `BFF客户端['请求']`, `BFF请求选项`, `BFF响应`, `BFF错误`.

**Produces:** closed wire DTOs, `JD导入数据源`, `创建JD导入(file, key)`, `读取JD导入(importId)`.

- [ ] **Step 1: Write the failing contract tests**

In `JD导入.test.ts`, build the frozen full suggestion once:

```ts
const 完整建议 = {
  title: 'Senior Backend Engineer',
  recruitment_type: 'social_full_time',
  workplace_mode: 'hybrid',
  office_location: '上海市浦东新区世纪大道 1568 号',
  description: '负责核心招聘服务。',
  requirements: '五年以上后端经验。',
  education_requirement: 'bachelor',
  experience_requirement: 'five_plus_years',
  category_source_name: '后端开发',
  location_source_name: '上海',
  keywords: ['Go', 'PostgreSQL'],
} as const;

const succeeded = {
  import_id: 'jdi_0123456789abcdef0123456789abcdef',
  status: 'succeeded',
  created_at: '2026-09-03T01:02:03Z',
  updated_at: '2026-09-03T01:02:06Z',
  suggestion: 完整建议,
} as const;

it('POST 恰发送两个 multipart part、稳定幂等键并严格解码', async () => {
  const 请求 = vi.fn().mockResolvedValue({ result: succeeded, etag: null, requestId: 'req-1' });
  const source = 创建JD导入数据源(请求);
  const file = new File(['%PDF-1.7'], 'role.pdf', { type: '' });
  const key = 'jd-import-01234567-89ab-cdef-0123-456789abcdef';

  await expect(source.创建JD导入(file, key)).resolves.toEqual(succeeded);

  const options = 请求.mock.calls[0][0];
  expect(options).toMatchObject({
    path: '/api/v1/recruiter/job-draft-imports',
    method: 'POST',
    幂等: true,
    幂等键: key,
    严格信封: true,
  });
  expect(options.headers).toBeUndefined();
  expect([...options.formData.keys()]).toEqual(['file', 'processing_consent_confirmed']);
  expect(options.formData.get('processing_consent_confirmed')).toBe('true');
  const uploaded = options.formData.get('file');
  expect(uploaded).toBeInstanceOf(File);
  expect((uploaded as File).name).toBe('role.pdf');
  expect((uploaded as File).type).toBe('application/pdf');
});

it('GET 只读同一合法 import ID 且禁用缓存', async () => {
  const 请求 = vi.fn().mockResolvedValue({ result: succeeded, etag: null, requestId: 'req-2' });
  await 创建JD导入数据源(请求).读取JD导入(succeeded.import_id);
  expect(请求).toHaveBeenCalledWith({
    path: `/api/v1/recruiter/job-draft-imports/${succeeded.import_id}`,
    不缓存: true,
    严格信封: true,
  });
});

it('非法 import ID 在 fetch 前失败', async () => {
  const 请求 = vi.fn();
  await expect(创建JD导入数据源(请求).读取JD导入('../jobs'))
    .rejects.toMatchObject({ status: 0, code: 'invalid_request' });
  expect(请求).not.toHaveBeenCalled();
});
```

Add table-driven decoder cases for all four statuses. For every object level assert missing/extra key rejection. Also reject: uppercase or short ID, invalid RFC3339 timestamps, unknown status/failure code/enums, nullable field omission, non-nullable field `null`, `keywords` containing non-string, `suggestion` on pending/processing/failed, `failure_code` on non-failed, and incomplete suggestion. Every response drift must reject with `{status: 200, code: 'invalid_response'}`.

In `HTTP招聘数据源.test.ts`, add `创建JD导入` and `读取JD导入` to the public shape assertion so composition failure cannot hide behind standalone facade tests.

- [ ] **Step 2: Run the red tests**

```bash
npm test -- src/数据/招聘数据源/JD导入.test.ts src/数据/HTTP招聘数据源.test.ts
```

Expected: FAIL because DTOs and facade do not exist.

- [ ] **Step 3: Add the exact wire types**

Append to `BFF契约.ts`:

```ts
export type BFFJD招聘类型 = 'social_full_time' | 'campus' | 'internship' | 'part_time';
export type BFFJD办公方式 = 'onsite' | 'hybrid' | 'remote';
export type BFFJD学历 = 'none' | 'associate' | 'bachelor' | 'master' | 'doctorate';
export type BFFJD经验 =
  | 'none'
  | 'one_to_three_years'
  | 'three_to_five_years'
  | 'five_plus_years'
  | 'ten_plus_years';
export type BFFJD导入失败码 =
  | 'invalid_pdf'
  | 'document_too_complex'
  | 'parser_invalid_output'
  | 'parser_temporarily_unavailable';

export interface BFFJD建议 {
  title: string | null;
  recruitment_type: BFFJD招聘类型 | null;
  workplace_mode: BFFJD办公方式 | null;
  office_location: string | null;
  description: string | null;
  requirements: string | null;
  education_requirement: BFFJD学历 | null;
  experience_requirement: BFFJD经验 | null;
  category_source_name: string | null;
  location_source_name: string | null;
  keywords: string[];
}

interface BFFJD导入基础 {
  import_id: string;
  created_at: string;
  updated_at: string;
}

export type BFFJD导入 =
  | (BFFJD导入基础 & { status: 'pending' | 'processing' })
  | (BFFJD导入基础 & { status: 'succeeded'; suggestion: BFFJD建议 })
  | (BFFJD导入基础 & { status: 'failed'; failure_code: BFFJD导入失败码 });
```

- [ ] **Step 4: Implement the domain-local strict decoder and facade**

Create `JD导入.ts`. Keep all guards local; do not edit `HTTP客户端.ts` or extract shared decoder infrastructure.

```ts
import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type {
  BFFJD导入,
  BFFJD导入失败码,
  BFFJD建议,
} from '../BFF契约';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

const 导入ID = /^jdi_[0-9a-f]{32}$/;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function 契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', 'JD 导入响应不符合契约');
}

function 是记录(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function 要求闭合对象(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!是记录(value)) throw 契约错误();
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw 契约错误();
  }
  return value;
}

function 要求枚举<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value === 'string' && values.includes(value as T)) return value as T;
  throw 契约错误();
}

function 要求可空字符串(value: unknown): string | null {
  if (value === null || typeof value === 'string') return value;
  throw 契约错误();
}

function 要求可空枚举<T extends string>(value: unknown, values: readonly T[]): T | null {
  return value === null ? null : 要求枚举(value, values);
}

function 要求导入ID(value: unknown): string {
  if (typeof value !== 'string' || !导入ID.test(value)) throw 契约错误();
  return value;
}

function 要求时间(value: unknown): string {
  if (typeof value !== 'string' || !RFC3339.test(value) || Number.isNaN(Date.parse(value))) throw 契约错误();
  return value;
}

const 建议键 = [
  'title', 'recruitment_type', 'workplace_mode', 'office_location', 'description',
  'requirements', 'education_requirement', 'experience_requirement',
  'category_source_name', 'location_source_name', 'keywords',
] as const;

function 解码建议(value: unknown): BFFJD建议 {
  const raw = 要求闭合对象(value, 建议键);
  if (!Array.isArray(raw.keywords) || raw.keywords.some((item) => typeof item !== 'string')) {
    throw 契约错误();
  }
  return {
    title: 要求可空字符串(raw.title),
    recruitment_type: 要求可空枚举(raw.recruitment_type, ['social_full_time', 'campus', 'internship', 'part_time']),
    workplace_mode: 要求可空枚举(raw.workplace_mode, ['onsite', 'hybrid', 'remote']),
    office_location: 要求可空字符串(raw.office_location),
    description: 要求可空字符串(raw.description),
    requirements: 要求可空字符串(raw.requirements),
    education_requirement: 要求可空枚举(raw.education_requirement, ['none', 'associate', 'bachelor', 'master', 'doctorate']),
    experience_requirement: 要求可空枚举(raw.experience_requirement, ['none', 'one_to_three_years', 'three_to_five_years', 'five_plus_years', 'ten_plus_years']),
    category_source_name: 要求可空字符串(raw.category_source_name),
    location_source_name: 要求可空字符串(raw.location_source_name),
    keywords: [...raw.keywords] as string[],
  };
}

const 失败码 = [
  'invalid_pdf',
  'document_too_complex',
  'parser_invalid_output',
  'parser_temporarily_unavailable',
] as const satisfies readonly BFFJD导入失败码[];

function 解码JD导入(value: unknown): BFFJD导入 {
  if (!是记录(value)) throw 契约错误();
  const status = 要求枚举(value.status, ['pending', 'processing', 'succeeded', 'failed']);
  const keys = status === 'succeeded'
    ? ['import_id', 'status', 'created_at', 'updated_at', 'suggestion']
    : status === 'failed'
      ? ['import_id', 'status', 'created_at', 'updated_at', 'failure_code']
      : ['import_id', 'status', 'created_at', 'updated_at'];
  const raw = 要求闭合对象(value, keys);
  const base = {
    import_id: 要求导入ID(raw.import_id),
    created_at: 要求时间(raw.created_at),
    updated_at: 要求时间(raw.updated_at),
  };
  if (status === 'succeeded') return { ...base, status, suggestion: 解码建议(raw.suggestion) };
  if (status === 'failed') return { ...base, status, failure_code: 要求枚举(raw.failure_code, 失败码) };
  return { ...base, status };
}

export interface JD导入数据源 {
  创建JD导入(file: File, idempotencyKey: string): Promise<BFFJD导入>;
  读取JD导入(importId: string): Promise<BFFJD导入>;
}

export function 创建JD导入数据源(请求: 请求函数): JD导入数据源 {
  return {
    async 创建JD导入(file, idempotencyKey) {
      const formData = new FormData();
      const upload = file.type === ''
        ? new File([file], file.name, { type: 'application/pdf', lastModified: file.lastModified })
        : file;
      formData.append('file', upload);
      formData.append('processing_consent_confirmed', 'true');
      const response = await 请求<unknown>({
        path: '/api/v1/recruiter/job-draft-imports',
        method: 'POST',
        formData,
        幂等: true,
        幂等键: idempotencyKey,
        严格信封: true,
      });
      return 解码JD导入(response.result);
    },
    async 读取JD导入(importId) {
      if (!导入ID.test(importId)) {
        throw new BFF错误(0, 'invalid_request', 'JD 导入编号不合法');
      }
      const response = await 请求<unknown>({
        path: `/api/v1/recruiter/job-draft-imports/${encodeURIComponent(importId)}` as `/api/v1/${string}`,
        不缓存: true,
        严格信封: true,
      });
      return 解码JD导入(response.result);
    },
  };
}
```

If the actual `BFF请求选项`/`BFF响应` types are not exported, follow the exact local `请求函数` convention already used by `招聘数据源/简历预填.ts`; do not widen shared HTTP types just for this module.

- [ ] **Step 5: Compose the fifteenth domain**

In `HTTP招聘数据源.ts`, import the type/factory, intersect `JD导入数据源`, and append exactly `...创建JD导入数据源(请求)`. Update the header comment from fourteen to fifteen domains. No other facade changes.

- [ ] **Step 6: Run green tests and commit**

```bash
npm test -- src/数据/招聘数据源/JD导入.test.ts src/数据/HTTP招聘数据源.test.ts
npm run typecheck
git diff --check
git add src/数据/BFF契约.ts src/数据/招聘数据源/JD导入.ts src/数据/招聘数据源/JD导入.test.ts src/数据/HTTP招聘数据源.ts src/数据/HTTP招聘数据源.test.ts
git commit -m "feat: add strict JD import data source"
```

---

### Task 2: Subject/Role/Session-Fenced Operation and Provider Wiring

**Files:**
- Modify: `src/状态/后端/类型.ts`
- Create: `src/状态/后端/JD导入操作.ts`
- Create: `src/状态/后端/JD导入操作.test.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`

**Consumes:** `后端操作依赖`, `清账号状态`, `BFF错误`, Task 1 `JD导入数据源` methods.

**Produces:** two page-facing operations returning `BFFJD导入 | '已换代'` and actual Provider composition.

- [ ] **Step 1: Write failing fence tests**

Create tests using the same dependency builder and deferred-promise style as adjacent `简历预填操作.test.ts`. Cover both methods with this matrix:

```ts
it.each([
  ['无后端', null, 'recruiter'],
  ['角色错误', 数据源, 'candidate'],
] as const)('%s 时零请求并返回已换代', async (_name, 后端, 角色) => {
  const deps = 创建测试依赖({ 后端, 角色 });
  await expect(创建JD导入操作(deps).读取JD导入('jdi_0123456789abcdef0123456789abcdef'))
    .resolves.toBe('已换代');
  expect(后端?.读取JD导入).not.toHaveBeenCalled();
});

it('迟到成功在 subject 或 session generation 已变化时整包丢弃', async () => {
  const deferred = 延迟结果<BFFJD导入>();
  const deps = 创建测试依赖({ 读取JD导入: vi.fn(() => deferred.promise) });
  const pending = 创建JD导入操作(deps).读取JD导入('jdi_0123456789abcdef0123456789abcdef');
  deps.会话代际.current += 1;
  deferred.resolve(成功结果);
  await expect(pending).resolves.toBe('已换代');
});

it('迟到 401 不清理新会话，当前 401 只走统一清理且页面收到已换代', async () => {
  const 清理前 = deps.dispatch.mock.calls.length;
  // first request: advance generation before rejecting -> no new cleanup dispatch
  // second request: keep fence current and reject BFF错误(401, 'unauthorized', '')
  // expect cleanup dispatches to match existing 清账号状态 behavior and result === '已换代'
});
```

Also assert current non-401 errors are rethrown unchanged, request arguments are forwarded exactly, and role changes after takeoff invalidate the result. Do not merely test TypeScript shape.

Add `创建JD导入` and `读取JD导入` to the sorted public-operation shape assertion in `应用状态.test.ts`; render a Backend recruiter Provider and assert both are functions.

- [ ] **Step 2: Run the red tests**

```bash
npm test -- src/状态/后端/JD导入操作.test.ts src/状态/应用状态.test.ts
```

Expected: FAIL because the operation factory and Provider methods do not exist.

- [ ] **Step 3: Add the public operation interface**

In `后端/类型.ts` import `BFFJD导入` and add:

```ts
export interface JD导入操作 {
  创建JD导入(file: File, idempotencyKey: string): Promise<BFFJD导入 | '已换代'>;
  读取JD导入(importId: string): Promise<BFFJD导入 | '已换代'>;
}

export type 应用操作 =
  会话操作 & 候选操作 & 岗位操作 & 组织操作 & 隐私操作 & Agent规则操作 &
  发现推荐操作 & 附件简历操作 & MatchCase操作 & 真人会话操作 &
  P8账号控制面操作 & P8合规操作 & 简历预填操作 & JD导入操作;
```

- [ ] **Step 4: Implement the thin fence**

Create `JD导入操作.ts`, adapting the exact current dependency field names from `岗位操作.ts`/`简历预填操作.ts`:

```ts
import { BFF错误 } from '../../数据/HTTP客户端';
import type { BFFJD导入 } from '../../数据/BFF契约';
import { 清账号状态 } from './会话操作';
import type { 后端操作依赖, JD导入操作 } from './类型';

export function 创建JD导入操作(deps: 后端操作依赖): JD导入操作 {
  const {
    是后端,
    后端,
    后端状态引用,
    主体标识引用,
    会话代际,
  } = deps;

  function 可调用(): boolean {
    return 是后端 && 后端 !== null && 主体标识引用.current !== null &&
      后端状态引用.current.主体?.last_used_role === 'recruiter';
  }

  async function 执行(
    request: () => Promise<BFFJD导入>,
  ): Promise<BFFJD导入 | '已换代'> {
    if (!可调用()) return '已换代';

    const subject = 主体标识引用.current;
    const generation = 会话代际.current;
    const fenceCurrent = () =>
      主体标识引用.current === subject &&
      会话代际.current === generation &&
      后端状态引用.current.主体?.last_used_role === 'recruiter';

    try {
      const result = await request();
      return fenceCurrent() ? result : '已换代';
    } catch (error) {
      if (!fenceCurrent()) return '已换代';
      if (error instanceof BFF错误 && error.status === 401) {
        清账号状态(deps);
        return '已换代';
      }
      throw error;
    }
  }

  return {
    创建JD导入(file, idempotencyKey) {
      if (!可调用()) return Promise.resolve('已换代');
      return 执行(() => 后端!.创建JD导入(file, idempotencyKey));
    },
    读取JD导入(importId) {
      if (!可调用()) return Promise.resolve('已换代');
      return 执行(() => 后端!.读取JD导入(importId));
    },
  };
}
```

The pre-call guard is intentionally duplicated in the two public methods so the non-null assertion cannot race with a no-backend dependency. Keep the factory thin; page-generation fences belong to Task 3.

- [ ] **Step 5: Wire the Provider for real**

In `应用状态.tsx`, import `创建JD导入操作` and add `...创建JD导入操作(deps)` next to the other operation factories in the existing `useMemo` result. Do not add refs, reducer state, persistence, or effects.

- [ ] **Step 6: Run green tests and commit**

```bash
npm test -- src/状态/后端/JD导入操作.test.ts src/状态/应用状态.test.ts
npm run typecheck
git diff --check
git add src/状态/后端/类型.ts src/状态/后端/JD导入操作.ts src/状态/后端/JD导入操作.test.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts
git commit -m "feat: expose fenced JD import operations"
```

---

### Task 3: Page-Local Consent, Polling, Status, and Retry State Machine

**Files:**
- Modify: `src/屏幕/发布岗位.tsx`
- Modify: `src/屏幕/发布岗位.test.tsx`

**Consumes:** Task 2 operations, existing `校验附件PDF`, `确认层`, `代理横幅`, `轻提示`.

**Produces:** new-job-only import state machine. This task stops at receiving a succeeded result; Task 4 adds suggestion application without changing this lifecycle.

- [ ] **Step 1: Write failing interaction tests**

Extend the existing render helper; inject mocked `创建JD导入`/`读取JD导入`, use `vi.useFakeTimers()`, and restore real timers after every test. Add exact cases:

```ts
it('合法 PDF 先确认，consent 前零 POST，取消仍零 POST', async () => {
  render发布岗位({ 是后端: true, 角色: 'recruiter' });
  const input = screen.getByLabelText('上传 JD 文件');
  await user.upload(input, new File(['%PDF-1.7'], 'role.pdf', { type: 'application/pdf' }));
  expect(创建JD导入).not.toHaveBeenCalled();
  expect(screen.getByText('允许 AI 识别这份职位描述？')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '取消' }));
  expect(创建JD导入).not.toHaveBeenCalled();
});

it('确认后 POST；pending 串行轮询，hidden 暂停，visible 立即恢复', async () => {
  创建JD导入.mockResolvedValue(pending结果);
  读取JD导入.mockResolvedValueOnce(processing结果).mockResolvedValueOnce(succeeded结果);
  // upload + consent, assert one POST and aria-busy while POST is in flight
  // advance 2999ms => zero GET; advance 1ms => exactly one GET
  // while the first GET promise is unresolved advance 9s => still exactly one GET
  // set document.hidden=true and dispatch visibilitychange => no timer GET
  // set visible and dispatch visibilitychange => immediate second GET
});
```

The comments above describe executable assertions that must be written out using the test file's existing `Object.defineProperty(document, 'hidden', ...)` pattern; do not leave comments as the final test body.

Add these complete behavioral cases:

1. input `accept` equals `.pdf,application/pdf`; value is cleared immediately so the same file can be selected again.
2. invalid extension/MIME calls `轻提示('请选择 PDF 文件')`, does not increment the active round, open consent, or disturb an existing valid import.
3. Mock legal PDF only toasts `已选择，可继续手动填写`, with zero consent and zero operations.
4. duplicate consent click while POST unresolved causes exactly one POST.
5. POST directly returning succeeded or failed schedules zero GET.
6. pending/processing maintains at most one GET; unmount clears the timer.
7. selecting a new valid PDF invalidates old POST success, old POST error, old GET success, and old GET error.
8. a stale result with an old import ID but same mounted page cannot change the new round.
9. POST retry reuses object-identical `File` and equal idempotency key; GET retry calls only `读取JD导入` with the same import ID.
10. Every returned terminal `failure_code` shows its exact `JD失败码文案`, offers re-upload/manual only, and never retries POST/GET.
11. uploading action is a no-op; pending/processing permits choosing a new file.
12. edit mode contains no import banner behavior and no JD calls.
13. POST `network_error` changes phase to failed, removes `aria-busy`, shows `JD 服务暂时不可用，请稍后重试或手动填写`, and clicking `重试 ›` issues exactly one second POST with the same File/key.

- [ ] **Step 2: Run the red page tests**

```bash
npm test -- src/屏幕/发布岗位.test.tsx
```

Expected: FAIL on consent, operation calls, status copy, retry, and polling behavior.

- [ ] **Step 3: Add the page-local state and closed error mapping**

At module scope in `发布岗位.tsx` add only local types/constants/functions:

```ts
type JD导入阶段 = 'idle' | 'uploading' | 'pending' | 'processing' | 'succeeded' | 'failed';
type JD重试动作 = 'create' | 'read' | 'none';

interface JD导入页面状态 {
  generation: number;
  phase: JD导入阶段;
  file: File | null;
  idempotencyKey: string | null;
  importId: string | null;
  retry: JD重试动作;
  error: string | null;
}

const 初始JD导入状态: JD导入页面状态 = {
  generation: 0,
  phase: 'idle',
  file: null,
  idempotencyKey: null,
  importId: null,
  retry: 'none',
  error: null,
};

const JD失败码文案: Record<BFFJD导入失败码, string> = {
  invalid_pdf: '仅支持有效、未加密且不含主动内容的 PDF',
  document_too_complex: '内容过多或过于复杂，请换一份 PDF',
  parser_invalid_output: '未能识别这份 JD，可重新上传或手动填写',
  parser_temporarily_unavailable: '识别服务繁忙，请稍后重试或手动填写',
};

function 取JD错误文案(error: unknown): string {
  const unavailable = 'JD 服务暂时不可用，请稍后重试或手动填写';
  if (!(error instanceof BFF错误)) return unavailable;
  const known: Record<string, string> = {
    invalid_pdf: JD失败码文案.invalid_pdf,
    job_draft_import_too_large: '文件过大，请选择较小的 PDF',
    document_too_complex: JD失败码文案.document_too_complex,
    processing_consent_required: '请重新确认后再继续',
    upload_in_progress: 'JD 正在上传，请稍后重试',
    idempotency_in_progress: 'JD 正在上传，请稍后重试',
    idempotency_conflict: '上传意图已变化，请重新选择文件',
    parser_invalid_output: JD失败码文案.parser_invalid_output,
    parser_temporarily_unavailable: JD失败码文案.parser_temporarily_unavailable,
    job_draft_import_not_found: '这次识别已失效，请重新上传',
    storage_unavailable: unavailable,
    invalid_response: '服务返回异常，请稍后重试',
  };
  if (known[error.code]) return known[error.code];
  return unavailable;
}
```

Never surface `error.message`. HTTP 503 and `network_error` differ from unknown errors only in the retry predicates below; their displayed fallback is intentionally identical.

In Step 1, add a table-driven test containing every row of Spec §9.2 plus a non-`BFF错误` and an unknown backend code. Assert the exact text above and assert raw `message`, request ID, provider, and model output never appear.

- [ ] **Step 4: Implement one serialized page lifecycle**

Inside `发布岗位`, obtain both operations from the existing app-state hook and add:

```ts
const [JD状态, 设JD状态] = useState(初始JD导入状态);
const [待确认JD, 设待确认JD] = useState<{ generation: number; file: File; key: string } | null>(null);
const JD状态引用 = useRef(JD状态);
const JD已挂载 = useRef(false);
const JD定时器 = useRef<ReturnType<typeof setTimeout> | null>(null);
const JD读取中 = useRef(false);

const 更新JD状态 = (next: JD导入页面状态) => {
  JD状态引用.current = next;
  设JD状态(next);
};

const 清JD定时器 = useCallback(() => {
  if (JD定时器.current !== null) clearTimeout(JD定时器.current);
  JD定时器.current = null;
}, []);

useEffect(() => {
  JD已挂载.current = true;
  return () => {
    JD已挂载.current = false;
    清JD定时器();
  };
}, [清JD定时器]);
```

Every transition must go through `更新JD状态` (or a functional variant that synchronously updates both the ref and React state). This prevents a fast POST/GET completion from observing a one-render-old generation. Do not call `设JD状态` directly elsewhere.

Implement these page-local callbacks with explicit `generation` and `importId` arguments:

```ts
const 本轮仍有效 = (generation: number, importId?: string) => {
  const current = JD状态引用.current;
  return JD已挂载.current && current.generation === generation &&
    (importId === undefined || current.importId === importId);
};

const 安排JD读取 = (generation: number, importId: string) => {
  清JD定时器();
  if (document.hidden || !本轮仍有效(generation, importId)) return;
  JD定时器.current = setTimeout(() => void 读取本轮JD(generation, importId), 3000);
};
```

`读取本轮JD` must set `JD读取中.current=true`, await exactly one GET, then reset it in `finally`. It handles `'已换代'` silently; pending/processing updates phase and schedules only after the current GET completes; succeeded clears timers and enters succeeded. A returned `status:'failed'` clears timers, sets `phase:'failed'`, `retry:'none'`, and `error:JD失败码文案[result.failure_code]`. Every current GET exception clears the timer, sets `phase:'failed'`, preserves `importId`, and stores `取JD错误文案(error)`; it never calls POST, and sets `retry:'read'` only for `network_error`, HTTP 503, or `storage_unavailable`. `job_draft_import_not_found`, `invalid_response`, and every other deterministic error set `retry:'none'` while retaining their mapped safe text. The `finally` reset of `JD读取中` must run for success, failure, and stale results.

`提交待确认JD` must begin with `if (JD状态引用.current.phase === 'uploading') return;`, then save the selected `{file,key}`, set uploading, and call POST. Every current POST exception clears the timer, sets `phase:'failed'` (therefore `aria-busy:false`), preserves `file + key`, has `importId:null`, and stores `取JD错误文案(error)`, but sets `retry:'create'` only for `network_error`, HTTP 503, `operation_outcome_unknown`, `storage_unavailable`, `upload_in_progress`, or `idempotency_in_progress`. `invalid_pdf`, `document_too_complex`, `processing_consent_required`, `idempotency_conflict`, and every other deterministic error set `retry:'none'` while retaining their mapped safe text. A successful pending/processing result stores the returned import ID before scheduling. A direct `status:'failed'` stores `JD失败码文案[result.failure_code]`, uses `retry:'none'`, and schedules no timer; a direct succeeded result is likewise terminal without a timer.

Implement those allowlists as two small page-local predicates (`JD创建错误可重试` and `JD读取错误可重试`) and add Step 1 table cases proving each allowed code offers `重试 ›` while `invalid_pdf`, `idempotency_conflict`, `job_draft_import_not_found`, and `invalid_response` offer only re-upload/manual action.

`重试JD` dispatches by state only:

```ts
if (current.retry === 'create' && current.file && current.idempotencyKey) {
  await 创建本轮JD(current.generation, current.file, current.idempotencyKey);
} else if (current.retry === 'read' && current.importId) {
  await 读取本轮JD(current.generation, current.importId);
}
```

Own `visibilitychange` in a dedicated effect: call `document.addEventListener` once for that effect and return cleanup that calls the matching `removeEventListener`. The handler first checks `JD已挂载.current`; when hidden it clears the timer. When visible and the current phase is pending/processing and no GET is in flight, it calls `读取本轮JD` immediately. If a GET remains in flight, its completion owns scheduling the next timer. Step 1 must unmount, dispatch `visibilitychange`, and assert zero additional GET so a leaked listener cannot pass.

- [ ] **Step 5: Reuse the frozen UI in place**

Replace the hidden input behavior without changing its position, inline style, or surrounding nodes:

```tsx
<input
  ref={JD文件框}
  aria-label="上传 JD 文件"
  type="file"
  accept=".pdf,application/pdf"
  style={{ display: 'none' }}
  onChange={选择JD文件}
/>
```

`选择JD文件` clears `event.currentTarget.value` before branching, uses `校验附件PDF(file, null)`, and in Backend recruiter mode creates key `jd-import-${crypto.randomUUID()}`. A new **valid** file increments generation, clears the old timer/import/error, and explicitly resets phase to idle before opening consent; this makes a new selection recover even from a prior uploading/failed round. An invalid file does none of those.

Keep the existing `基础信息步` function and existing upload wrapper. Replace its single callback prop with a local plain-data prop—not a new component:

```ts
interface JD横幅属性 {
  前文: string;
  强调: string;
  动作文: string;
  按下: () => void;
}
```

Pass those four values to the existing `代理横幅` in its current node. Use the Spec table for exact status text. Every failed state must project `JD状态.error` into the existing banner text: retriable failures use action `重试JD`; non-retriable exceptions and returned backend `status:'failed'` use action “重新上传” and open the existing file input. Task 3 tests must assert both exact text and action for at least `job_draft_import_too_large`, `idempotency_conflict`, `job_draft_import_not_found`, `invalid_response`, and every returned parser `failure_code`. Uploading action is a no-op. Do not add DOM nodes.

On the already-existing `.发布壳` node add only:

```tsx
aria-busy={JD状态.phase === 'uploading'}
```

Render existing `确认层` conditionally in the page's existing overlay section with exact title/body/action copy from the Spec. Do not edit `src/组件/确认层.tsx`.

- [ ] **Step 6: Run green lifecycle tests and commit**

```bash
npm test -- src/屏幕/发布岗位.test.tsx
npm run typecheck
git diff --check
git diff --name-only 86125819...HEAD -- '*.css' '*.module.css' 'src/组件/**'
git add src/屏幕/发布岗位.tsx src/屏幕/发布岗位.test.tsx
git commit -m "feat: wire JD import consent and polling"
```

Expected: tests PASS and the frozen-path diff emits no output.

---

### Task 4: Snapshot-Safe Auto-Fill, Catalog Rules, and Remote Address Contract

**Files:**
- Modify: `src/屏幕/发布岗位.tsx`
- Modify: `src/屏幕/发布岗位.test.tsx`

**Consumes:** Task 3 lifecycle and succeeded `BFFJD建议`.

**Produces:** compare-and-fill behavior, three atomic coupled groups, category/location safe handling, remote validation/payload behavior.

- [ ] **Step 1: Add failing merge and validation tests**

Use a POST deferred promise so every test can edit controls after consent but before resolving succeeded. Add all cases below:

1. Every non-null independent suggestion replaces both blank and non-empty pre-upload values when the current field still equals the takeoff snapshot.
2. Editing an independent field while parsing protects it while its current value differs; changing it back to the snapshot value makes it eligible, because the approved rule is value comparison rather than dirty-history tracking. Spec §8.1 explicitly uses this value-only rule.
3. Every `null` suggestion preserves the current value.
4. All valid education and experience wire enums map to the exact UI labels; unknown enums already fail in Task 1 and therefore apply nothing.
5. Recruitment type changes only when all eight group values equal the snapshot; it clears salary bounds/annual months, and switching to internship resets conversion. Any one changed group member protects the whole group.
6. When suggested type is campus/internship, hidden experience is not overwritten. For social/part-time, experience joins the same atomic group when type also changes.
7. Workplace mode and office address apply atomically. Remote clears address and disables the existing input; changing either member while parsing protects both.
8. Manually selecting remote uses the same transition, clears address, skips address validation, and serializes `办公地: ''`; switching back enables but does not restore it and requires it again.
9. Existing canonical `类别引用` is never changed. Non-empty category source only calls `轻提示('AI 识别的职位类别是「后端开发」，请手动选择')` and adds no permanent node.
10. Backend first-step validation rejects category display text without `类别引用`; Mock keeps its current free-text behavior.
11. Existing canonical `地点引用` wins. Without one, unchanged city/ref group accepts non-empty source text through the existing `改工作城市`, keeps ref empty, and triggers normal search. User editing either member protects both.
12. Final Backend submit still rejects an unselected location source string.
13. `keywords` never changes the DOM or job payload.
14. POST create retry uses the original snapshot: edits made after the failed first POST remain protected when a replay succeeds.
15. Stale generation succeeded result applies zero suggestions and emits no category toast.

Representative executable case:

```ts
it('只自动填入上传后仍等于快照的字段', async () => {
  const deferred = 延迟结果<BFFJD导入>();
  创建JD导入.mockReturnValue(deferred.promise);
  render发布岗位({ 是后端: true, 角色: 'recruiter' });

  await user.type(screen.getByLabelText('岗位名称'), '上传前标题');
  await 选择并确认JD(user, new File(['%PDF-1.7'], 'role.pdf', { type: 'application/pdf' }));
  await user.clear(screen.getByLabelText('职位描述'));
  await user.type(screen.getByLabelText('职位描述'), '用户等待时写的描述');

  deferred.resolve({ ...succeeded结果, suggestion: { ...完整建议, title: 'AI 标题', description: 'AI 描述' } });
  await waitFor(() => expect(screen.getByLabelText('岗位名称')).toHaveValue('AI 标题'));
  expect(screen.getByLabelText('职位描述')).toHaveValue('用户等待时写的描述');
});
```

- [ ] **Step 2: Run the red tests**

```bash
npm test -- src/屏幕/发布岗位.test.tsx
```

Expected: FAIL because succeeded does not yet apply suggestions and remote/catalog validation is unchanged.

- [ ] **Step 3: Centralize only the two existing form transitions**

Inside `发布岗位`, replace the current inline recruitment type setter with:

```ts
const 切换招聘类型 = (value: 招聘类型) => {
  设招聘类型(value);
  设薪资下限('');
  设薪资上限('');
  设年薪月数(null);
  if (value === '实习生') 设实习转正(null);
};
```

Replace manual and suggestion workplace changes with:

```ts
const 切换办公方式 = (value: string) => {
  设办公方式(value);
  if (value === '全远程') 设办公地('');
};
```

These are page-local functions for two already duplicated transitions, not new architecture.

- [ ] **Step 4: Capture the exact takeoff snapshot once**

Define the full snapshot shape at module scope:

```ts
interface JD表单快照 {
  岗位名称: string;
  招聘类型: 招聘类型;
  办公方式: string;
  办公地: string;
  职位描述: string;
  职位要求: string;
  最低学历: string;
  经验要求: string;
  薪资下限: string;
  薪资上限: string;
  年薪月数: number | null;
  届别: string;
  实习月数: number;
  每周天数: number;
  实习转正: boolean | null;
  工作城市: string;
  类别引用?: 目录选择值;
  地点引用?: 目录选择值;
}
```

Maintain `JD表单引用.current` from current render values in an effect, and `JD上传快照.current` as `{generation, value}`. Clone catalog refs by value. In Task 3's **initial** confirmed POST path, assign the snapshot immediately before calling the operation. In `retry:'create'`, do not assign it again.

Use this value comparator:

```ts
const 引用相等 = (left?: 目录选择值, right?: 目录选择值) =>
  left?.id === right?.id && left?.display_name === right?.display_name;
```

- [ ] **Step 5: Apply a succeeded suggestion behind all fences**

Add closed maps:

```ts
const JD招聘类型映射: Record<BFFJD招聘类型, 招聘类型> = {
  social_full_time: '社招全职', campus: '校园招聘', internship: '实习生', part_time: '兼职',
};
const JD办公方式映射: Record<BFFJD办公方式, string> = {
  onsite: '现场', hybrid: '混合', remote: '全远程',
};
const JD学历映射: Record<BFFJD学历, string> = {
  none: '不限', associate: '大专', bachelor: '本科', master: '硕士', doctorate: '博士',
};
const JD经验映射: Record<BFFJD经验, string> = {
  none: '不限', one_to_three_years: '1-3 年', three_to_five_years: '3-5 年',
  five_plus_years: '5 年以上', ten_plus_years: '10 年以上',
};
```

`应用JD建议(generation, suggestion)` first requires current generation and an equal-generation snapshot. Read the current form from `JD表单引用.current`, not a stale callback closure.

For independent fields, apply only `suggestion !== null && current === snapshot`.

Recruitment group equality must include exactly: type, salary lower, salary upper, annual months, cohort, internship months, days/week, conversion, and experience. (The approved Spec describes eight coupled concepts; salary bounds are two controls.) If a non-null type is suggested and the entire group is equal, call `切换招聘类型`. Apply experience in this same decision when the resulting type is social/part-time. If type is null or unchanged, experience may be independently applied only when the current type is social/part-time and current experience equals snapshot.

Workplace group requires both mode and address equal. If eligible, apply suggested mode first through `切换办公方式`; apply non-null address only when the resulting mode is not remote. If mode is null, a non-null address can apply only while the unchanged current mode is not remote.

Location group requires both text equality and `引用相等`, plus **no snapshot canonical ref and no current canonical ref**. Then a non-null `location_source_name` calls the existing `改工作城市(sourceName)` so search behavior stays authoritative and ref remains empty.

Category source never writes form state. After all guarded state calls, show exactly one existing toast when non-null. Ignore `keywords` explicitly.

Call `应用JD建议` before setting phase succeeded in both direct POST success and GET success. Never apply on failed, invalid response, or `'已换代'`.

- [ ] **Step 6: Close category and remote submit rules without layout changes**

In first-step Backend validation require both `职位类别.trim()` and `类别引用`. Keep Mock free text.

Pass `办公方式` as a plain prop to the already-existing `职位要求步`. On its existing office `<input>` add only:

```tsx
disabled={办公方式 === '全远程'}
```

Change final validation to require address only when `办公方式 !== '全远程'`. In `组装岗位`, serialize:

```ts
办公地: 办公方式 === '全远程' ? '' : 办公地.trim(),
```

Do not hide or move the office row; do not add explanatory text.

- [ ] **Step 7: Run green merge tests and commit**

```bash
npm test -- src/屏幕/发布岗位.test.tsx
npm run typecheck
npm run lint
git diff --check
git diff --name-only 86125819...HEAD -- '*.css' '*.module.css' 'src/组件/**'
git add src/屏幕/发布岗位.tsx src/屏幕/发布岗位.test.tsx
git commit -m "feat: safely apply JD import suggestions"
```

Expected: all focused tests PASS and frozen-path diff has no output.

---

### Task 5: Data-Source E2E and Authoritative Plan-Scope Gate

**Files:**
- Modify: `e2e/数据源模式.spec.ts`
- Modify only if the existing fixture router requires it: its colocated route fixture file
- Modify tests only if a real uncovered edge remains: files from Tasks 1–4

**Consumes:** complete Tasks 1–4.

**Produces:** browser-level request/flow evidence and one authoritative local gate. No real-backend deployment claim.

- [ ] **Step 1: Add a failing browser data-source scenario**

In the established Backend data-source test harness, add a test whose title contains exactly `JD 建议稿导入` and intercept exact routes. The POST fixture must return HTTP `202`; the first GET returns processing and the next returns succeeded.

```ts
await page.route('**/api/v1/recruiter/job-draft-imports', async (route) => {
  expect(route.request().method()).toBe('POST');
  const headers = route.request().headers();
  expect(headers['idempotency-key']).toMatch(/^jd-import-.{36}$/);
  const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
  expect(body).toContain('name="file"; filename="synthetic-jd.pdf"');
  expect(body).toContain('Content-Type: application/pdf');
  expect(body).toContain('name="processing_consent_confirmed"');
  expect(body).toContain('true');
  expect(body).not.toContain('display_name');
  await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ result: pending结果, meta: 元数据 }) });
});
```

Use `page.setInputFiles` on the existing hidden input, accept the existing consent layer, edit one suggestible text field before success, then assert:

- POST issued only after consent and exactly once;
- polling GET uses the returned ID and does not overlap;
- untouched title is filled, edited description is preserved;
- category source appears only through the existing toast and no category reference becomes selected;
- location source populates search text but final submit remains blocked until a fixture-backed real candidate is clicked;
- no Job create POST happens as a side effect of parsing;
- selecting remote leaves the existing office input present, disabled, and empty.

Add one separate cancellation assertion proving consent cancel issues zero POST. Reuse existing auth/profile/catalog route fixtures; do not add a new E2E framework.

- [ ] **Step 2: Run the red E2E**

```bash
npm run test:e2e:data-source -- --grep "JD 建议稿导入"
```

Expected: FAIL until the fixture and scenario are complete.

- [ ] **Step 3: Complete only fixture gaps, then run the focused vertical slice**

```bash
npm run test:e2e:data-source -- --grep "JD 建议稿导入"
npm test -- src/数据/招聘数据源/JD导入.test.ts src/数据/HTTP招聘数据源.test.ts src/状态/后端/JD导入操作.test.ts src/状态/应用状态.test.ts src/屏幕/发布岗位.test.tsx
npm run typecheck
```

Expected: all PASS. The E2E is hermetic route interception and proves frontend wiring only; record that it does **not** prove the backend commit, migration, storage, model configuration, or worker is deployed.

- [ ] **Step 4: Commit the E2E and any test-only completion**

```bash
git add e2e/数据源模式.spec.ts
git commit -m "test: cover JD import frontend flow"
git status --short
```

If Step 1 actually changes a colocated fixture or a Task 1–4 test, add each inspected file by its explicit repository path in the same `git add` command before committing. Do not create a second E2E harness and do not use `git add -A`.

- [ ] **Step 5: Run the authoritative plan-scope gate once on the clean candidate commit**

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e:data-source
git diff --check
git diff --name-only 86125819...HEAD -- '*.css' '*.module.css' 'src/组件/**'
git diff --name-status 86125819...HEAD
git status --short
```

Expected:

- all package gates and data-source E2E PASS;
- frozen-path query has no output;
- name-status shows no new UI component and only the approved data/operation/page/test/docs scope;
- status is clean.

Manually inspect the `发布岗位.tsx` diff and record PASS for all four items: no changed existing `className`, no moved/reordered/wrapped visible nodes, no new permanent visible node, no office-row hiding. Automated tests cannot prove source-level layout immutability.

## Verification and Handoff Metadata

This repository has no task-specific affected-test selector SSOT beyond its package scripts. The authoritative plan-scope gate is the exact Task 5 command sequence; do not invent another selection layer.

```yaml
integration_requirement: none
selection_ssot: none
selection_gap: none
l3_selection: []
release_handoff:
  required: true
  owner: release-workflow
  required_mode: suite
  nightly_eligible: false
  status: deferred
  reason: >-
    Hermetic frontend tests cannot prove that the target backend environment contains
    agxp-server scope/jd-pdf-upload-feature-parity@2be8c2748, its migrations, object storage,
    model configuration, and worker. Release owner must run one consented real-PDF smoke test.
```

Deferred real-environment smoke test:

1. Confirm the target environment deploys the handoff backend commit and dependencies.
2. Recruiter creates a new job, selects a synthetic/non-sensitive PDF, observes consent before any POST, and confirms.
3. Verify Network shows POST `202`, then serial GETs to the same `jdi_*` ID.
4. Edit one field while processing and verify it survives; verify an untouched field fills.
5. Verify category/location still require actual Catalog choices and parsing does not create a job.
6. Verify remote publishes with empty office address only after the user explicitly submits.

---

## Terminal Integration Task: Review, Target-Branch Synchronization, Final Gate, and User Handoff

This task is executed by the integration owner in the same worktree after Tasks 1–5. It is not part of the implementation-task count.

- [ ] Confirm the feature branch is clean and every Task commit exists.

```bash
git status --short
git log --oneline --decorate -12
```

- [ ] Run `superpowers:requesting-code-review` against the approved Spec, this Plan, `AGENTS.md`, and `CLAUDE.md`. Every finding must include `必要性` and `复杂度影响`. Verify each finding with `superpowers:receiving-code-review`; fix useful required findings, reject optional/speculative complexity with a written reason, rerun affected tests, and commit review fixes separately.

- [ ] Present the review verdict and local verification evidence to the user. This is the final human gate before any fetch/rebase/merge/push that changes integration state. Do not infer permission to push, open a PR, or merge.

- [ ] After explicit user authorization, fetch the actual target branch and inspect drift before integration.

```bash
git fetch origin
git status --short
git log --oneline --left-right --cherry-pick HEAD...origin/main
```

If target drift overlaps Task files or changes the approved contract/UI, stop and return to the planning session. Otherwise integrate using the repository's approved non-destructive method; never use `git reset --hard` or discard user changes.

- [ ] On the final integrated candidate, rerun the complete authoritative gate:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e:data-source
git diff --check
git diff --name-only 86125819...HEAD -- '*.css' '*.module.css' 'src/组件/**'
git status --short
```

- [ ] Hand off:

- exact commit SHAs for Tasks 1–5 and review fixes;
- full gate PASS/FAIL output and manual layout-freeze verdict;
- review findings fixed/rejected with reasons;
- explicit statement that mocked/data-source E2E does not prove real backend deployment;
- deferred `release_handoff` owner and real-environment smoke result if available;
- the final remote branch/PR/merge SHA only if the user authorized and the action was actually performed.

## Why This Is the Minimum Sufficient Plan

- One narrow facade is required because multipart, idempotency, strict union decoding, and no-store GET are wire concerns; changing the shared HTTP client is not required.
- One thin operation factory is required because account/session fencing and current-401 cleanup are existing application boundaries; adding import state there is not required.
- Page-local state is required because compare-and-fill depends on the live form and a single mount. Global persistence would create stale-draft and privacy risk without a current recovery requirement.
- The existing `useP8导出轮询` is not reused because it is typed to P8 export states, immediately GETs on enable, and owns a frozen 2/4/8/10-second backoff. JD begins only after POST and requires fixed ~3-second scheduling plus page-generation/import-ID/snapshot handling; parameterizing the P8 hook would expand a stable shared API for this one new caller.
- Two page-local transition helpers prevent existing type/remote cleanup from diverging between manual and suggested changes. No broader form abstraction is introduced.
- A single intercepted E2E plus focused unit/component coverage proves the vertical slice without claiming target-environment deployment.

## Non-Goals and Reconsideration Evidence

- No edit-job import, server cancellation, import history, refresh recovery, cross-tab ownership, progress percentage, OCR preview, suggestion-review UI, auto-save, auto-publish, keyword editor, or Catalog auto-selection.
- No generic document import framework, polling hook, retry service, strict-decoder library, or new global store.
- Reconsider persistence/cancellation only after a measured need to resume long imports across navigation and a backend cancellation/recovery contract exists.
- Reconsider a shared import framework only after a second production document-import flow demonstrates the same lifecycle and merge semantics.
- Reconsider permanent category suggestion UI or layout changes only with PM-owned design and explicit unfreezing of CSS/components/layout.
- Reconsider client-level success-status exposure only if more than one caller must enforce transport status independently of a strictly decoded result.
