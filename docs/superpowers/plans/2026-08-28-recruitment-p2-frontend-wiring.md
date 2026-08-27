# Recruitment P2 前端附件简历接线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有 Mock 页面效果的前提下，把候选人最多三份 PDF 附件的上传、替换、删除、下载预览、授权解析和状态刷新完整接到 P2 BFF。

**Architecture:** 新增独立的附件简历 wire/data facade，复用现有 BFF HTTP client、根 `HTTP招聘数据源`、Provider 后端状态和会话代际；所有 mutation 后重读权威列表，不做乐观写。两个现有页面只消费 Provider snapshot 和操作，页面可见期间由单飞 `setTimeout` hook 刷新；Mock 分支保持原 reducer、文案和截图。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、Testing Library、Playwright、CSS Modules；不新增 npm 依赖。

**Spec:** `docs/superpowers/specs/2026-08-28-recruitment-p2-frontend-wiring-design.md`

## Global Constraints

- 开始前必须完整读取仓库根 `AGENTS.md` / `CLAUDE.md`（若存在）及本 Spec；实现不得超出 Spec。
- 前端基线是 `origin/main@57783ac9dc11b0766b06e05442c2bd8e125eb38a`；后端只读契约基线是 `origin/release/0.2.5@83007f1555514c2b427ba337b64118221f4dd4d2`。
- 不新增路由、页面、状态库、依赖、通用上传框架、解析正文类型、自动预填、主简历或重命名能力。
- Mock 模式保留当前 `学生分流` 文件名 reducer、提示、硬编码演示附件和视觉基线；Backend 失败绝不回退 Mock。
- 创建、替换、显式解析只有确认层执行键能传 literal `true`；取消确认产生零 mutation。
- Backend `完善资料` 只 create 或 replace `items[0]`；`我的简历` 才管理完整的 0–3 行。
- replace multipart 只发 `file` 与已确认的 `processing_consent_confirmed=true`，不得发 `display_name`；显示名由槽位保留。
- Provider 只存 JSON snapshot；Blob、object URL、SHA、原文件名不得写日志或浏览器持久化。
- 不做乐观写；mutation 后 GET 列表再 resolve；冲突、404、结果未知遵守 Spec 第 10 节的权威恢复语义。
- 轮询只在目标页面 mounted、document visible、存在 `pending|processing` 时运行；settle 后 3 秒 `setTimeout`，禁止 `setInterval` 和重叠请求。
- 页面样式只能复用现有卡片、附件行、`滑动行`、`确认层`、`轻提示` 原语；不得改变既有 Mock 截图和静止态几何。
- 所有产品改动走 TDD：先看到对应定向测试按预期失败，再写最小实现，再定向通过，再提交。
- 不修改后端仓库。public OpenAPI 的 upload consent 漂移记录在 Spec，由后端在正式联调/发布门前补齐。

## Preconditions, Non-goals, and Completion

**前置条件：** 当前分支已 rebase 到上述 `origin/main`；`npm install` 已完成；基线 `npm test`（66 files / 563 tests）、`npm run lint`、`npm run build` 均通过。执行前重新运行 `git status --short`，必须为空。

**非目标：** 解析正文展示或采用、在线简历写入、招聘方披露、S1 原件递交、重命名、全局通知/轮询、进度百分比、视觉重做以及后端 OpenAPI 修复。

**完成标准：** Tasks 1–7 的提交均存在且各自定向测试通过；异构 code review 的 required/optional findings 已逐项处理；当前 candidate commit 上唯一的 plan-scope gate 与 Terminal Integration Task 全部给出可追溯 PASS，且 UI gate 没有未批准漂移。

**计划本身复杂度：高。** 跨 wire、multipart/CAS/幂等、会话恢复、异步刷新、Blob 生命周期和两个已有页面，且视觉回归是硬门。

**零上下文漂移风险：中。** 公共接口、文案、状态机和恢复分支已冻结；主要现场风险是页面测试 fixture 与后端数据源 E2E fixture 随 main 小幅变化。使用行业 Top 5–10 的中高性价比模型执行；若开始时基线 SHA 或公共接口已漂移，停止并回到规划 session 修订 Plan，不让执行者重新设计。

**Plan 关系：** 本批次只有这一份实现 Plan，无可并行 Plan、无前序实现产物。下游只消费本 Plan 的最终 candidate commit、本文冻结的 `HTTP招聘数据源`/`应用操作` 接口、测试入口和 Terminal Integration Handoff；不得在 Task 级并行写同一 worktree。

## File Structure

### New files

- `src/数据/招聘数据源/附件简历.ts`：六条 P2 route、严格响应解码、multipart/CAS/幂等和 PDF Blob 校验。
- `src/数据/招聘数据源/附件简历.test.ts`：闭合 decoder、wire 字段、header、route 和 Blob 类型测试。
- `src/状态/后端/附件简历操作.ts`：Provider snapshot 提交、锁、会话栅栏、mutation 后权威重读和歧义恢复。
- `src/状态/后端/附件简历操作.test.ts`：操作层成功、冲突/404/结果未知/401/stale response 测试。
- `src/流程/附件简历交互.ts`：纯函数文件预检、状态/错误文案；不 import React。
- `src/流程/附件简历交互.test.ts`：文件预检和闭合文案表测试。
- `src/流程/附件简历刷新.ts`：目标页面生命周期内的 immediate refresh、visibility 与单飞 timer hook。
- `src/流程/附件简历刷新.test.tsx`：fake timers + visibility + unmount + active/terminal 测试。
- `src/流程/附件简历预览.ts`：同步预开窗口、authenticated Blob、anchor fallback 与 URL/timer cleanup hook。
- `src/流程/附件简历预览.test.tsx`：popup/anchor/error/unmount 资源回收测试。
- `src/屏幕/我的简历.test.tsx`：Backend 0–3 行、动作矩阵、确认和 Mock 防漂移组件测试。

### Modified files

- `src/数据/BFF契约.ts`：加入附件库、文件、版本、parse 判别联合、failure code 和 delete receipt wire types。
- `src/数据/招聘数据源类型.ts`：导出 `页面附件简历库` alias；不污染结构化简历。
- `src/数据/HTTP客户端.ts` / `.test.ts`：加入复用同一认证/错误/GET retry 内核的 `请求二进制`。
- `src/数据/HTTP招聘数据源.ts` / `.test.ts`：组合第八个附件 facade，并把 binary seam 注入它。
- `src/数据/接口层.test.ts`：固定默认 client 同时暴露 JSON 与 binary 能力；产品 `接口层.ts` 不需要额外逻辑。
- `src/状态/后端/类型.ts`：加入 `附件简历库` snapshot 与六个页面操作签名。
- `src/状态/后端/会话操作.ts` / `.test.ts`：候选四域并行水合及所有清理路径。
- `src/状态/应用状态.tsx` / `src/状态/应用状态.test.ts`：初始化 snapshot 并组合附件操作。
- `src/屏幕/学生分流.tsx` / `.test.tsx`：Backend create/replace 授权接线；Mock 原行为保留。
- `src/屏幕/学生分流.module.css`：只补确认交互所需的隐藏 input/disabled 规则；不得改已有上传行几何。
- `src/屏幕/我的简历.tsx` / `.module.css`：真实 0–3 行、小型 `＋`、复用滑动操作和确认层；静止态附件行几何不变。
- `e2e/数据源模式.spec.ts`：加入 P2 BFF fixture 和 Backend 浏览器主链路。
- `e2e/视觉回归/场景.ts`：只在既有场景缺少明确定位时补稳定 selector；不得更新参考图。

---

### Task 1: Binary HTTP seam and frozen wire types

**Files:**
- Modify: `src/数据/BFF契约.ts`
- Modify: `src/数据/招聘数据源类型.ts`
- Modify: `src/数据/HTTP客户端.ts`
- Modify: `src/数据/HTTP客户端.test.ts`

**Interfaces:**
- Consumes: 现有 `创建BFF客户端(deps?: BFF客户端依赖): BFF客户端`、`BFF错误`、`BFF请求选项`；现有 JSON `请求` 行为必须保持逐项兼容。
- Produces: `BFF附件解析失败码`、`BFF附件解析状态`、`BFF附件简历版本`、`BFF附件简历`、`BFF附件简历库`、`BFF删除回执`；`BFF二进制响应`；`BFF客户端.请求二进制(path: \`/api/v1/${string}\`): Promise<BFF二进制响应>`；`页面附件简历库 = BFF附件简历库`。

- [ ] **Step 1: Add failing binary-client tests**

在 `src/数据/HTTP客户端.test.ts` 增加以下实际测试。保留本文件现有 fixture/import，若 `响应` helper 名不同，只机械改成文件已有 helper 的名字，不改变断言。

```ts
it('binary GET includes credentials, retries one network failure and exposes fixed headers', async () => {
  const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
  const fetcher = vi.fn()
    .mockRejectedValueOnce(new TypeError('offline'))
    .mockResolvedValueOnce(new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="resume.pdf"',
        'X-Request-Id': 'req_pdf',
      },
    }));
  const client = 创建BFF客户端({ fetcher });

  const result = await client.请求二进制('/api/v1/me/resume-files/rf_1/content');

  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher).toHaveBeenLastCalledWith('/api/v1/me/resume-files/rf_1/content', {
    method: 'GET', headers: expect.any(Headers), credentials: 'include',
  });
  expect(await result.blob.text()).toBe('%PDF-1.7');
  expect(result.contentType).toBe('application/pdf');
  expect(result.contentDisposition).toBe('attachment; filename="resume.pdf"');
  expect(result.requestId).toBe('req_pdf');
});

it('binary GET parses the normal JSON error envelope and does not retry HTTP errors', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    error: { type: 'resume_file_not_found', message: 'missing', fields: [] },
  }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
  const client = 创建BFF客户端({ fetcher });

  await expect(client.请求二进制('/api/v1/me/resume-files/rf_missing/content'))
    .rejects.toMatchObject({ status: 404, code: 'resume_file_not_found', message: 'missing' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the RED test**

Run: `npm test -- src/数据/HTTP客户端.test.ts`

Expected: FAIL because `请求二进制` and `BFF二进制响应` do not exist; existing JSON tests remain green up to compilation of the new tests.

- [ ] **Step 3: Add the closed wire types and binary method**

在 `src/数据/BFF契约.ts` 导出这些精确类型；不要加入 extracted result：

```ts
export type BFF附件解析失败码 =
  | 'document_unreadable'
  | 'document_too_complex'
  | 'parser_invalid_output'
  | 'parser_temporarily_unavailable';

export type BFF附件解析状态 =
  | { status: 'not_started' }
  | { status: 'pending' | 'processing'; updated_at: string }
  | { status: 'succeeded'; parse_id: string; updated_at: string }
  | { status: 'failed'; failure_code: BFF附件解析失败码; updated_at: string };

export interface BFF附件简历版本 {
  version_id: string;
  version: number;
  size_bytes: number;
  media_type: 'application/pdf';
  sha256: string;
  created_at: string;
  parse: BFF附件解析状态;
}

export interface BFF附件简历 {
  file_id: string;
  display_name: string;
  revision: number;
  current_version: BFF附件简历版本;
  created_at: string;
  updated_at: string;
}

export interface BFF附件简历库 {
  items: BFF附件简历[];
  limits: {
    max_files: number;
    max_file_bytes: number;
    accepted_media_types: ['application/pdf'];
  };
}

export interface BFF删除回执 { deleted: true }
```

在 `src/数据/招聘数据源类型.ts` 加 `BFF附件简历库` type import 与 `export type 页面附件简历库 = BFF附件简历库;`。

在 `src/数据/HTTP客户端.ts` 把非 2xx 解析抽成 `解析错误响应(resp)`，让 JSON 与 binary 共用，然后加入：

```ts
export interface BFF二进制响应 {
  blob: Blob;
  contentType: string;
  contentDisposition: string | null;
  requestId: string | null;
}

export interface BFF客户端 {
  请求<T>(options: BFF请求选项): Promise<BFF响应<T>>;
  请求二进制(path: `/api/v1/${string}`): Promise<BFF二进制响应>;
}

async function 请求二进制(path: `/api/v1/${string}`): Promise<BFF二进制响应> {
  const init: RequestInit = { method: 'GET', headers: new Headers(), credentials: 'include' };
  let resp: Response;
  try {
    resp = await fetcher(path, init);
  } catch {
    try {
      resp = await fetcher(path, init);
    } catch {
      throw new BFF错误(0, 'network_error', '网络连接失败，请稍后再试');
    }
  }
  if (!resp.ok) throw await 解析错误响应(resp);
  return {
    blob: await resp.blob(),
    contentType: resp.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() ?? '',
    contentDisposition: resp.headers.get('Content-Disposition'),
    requestId: resp.headers.get('X-Request-Id'),
  };
}

return { 请求, 请求二进制 };
```

`解析错误响应` 必须原样保留当前 `type/message/fields/Retry-After` 语义；不要让 binary path 尝试解析成功 JSON envelope，也不要给 mutation 增加网络重试。

- [ ] **Step 4: Run focused and regression tests**

Run: `npm test -- src/数据/HTTP客户端.test.ts && npm run typecheck`

Expected: PASS；现有 JSON、204、multipart、幂等受控重试断言全部保持通过。

- [ ] **Step 5: Commit Task 1**

```bash
git add src/数据/BFF契约.ts src/数据/招聘数据源类型.ts src/数据/HTTP客户端.ts src/数据/HTTP客户端.test.ts
git commit -m "feat: add resume file binary client contract"
```

### Task 2: Strict attachment data facade

**Files:**
- Create: `src/数据/招聘数据源/附件简历.ts`
- Create: `src/数据/招聘数据源/附件简历.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`
- Modify: `src/数据/接口层.test.ts`

**Interfaces:**
- Consumes: `BFF客户端['请求']`、`BFF客户端['请求二进制']`、Task 1 的全部附件 DTO 与 `BFF错误`。
- Produces: `附件简历数据源`：`读取附件简历库(): Promise<BFF附件简历库>`、`创建附件简历(file: File, consent: true): Promise<BFF附件简历>`、`替换附件简历(fileId: string, revision: number, file: File, consent: true): Promise<BFF附件简历>`、`删除附件简历(fileId: string, revision: number): Promise<BFF删除回执>`、`请求附件解析(fileId: string, versionId: string, consent: true): Promise<BFF附件解析状态>`、`下载附件简历(fileId: string): Promise<Blob>`；根 `HTTP招聘数据源` 与该接口相交。

- [ ] **Step 1: Write route/form/header and decoder failure tests**

创建 `src/数据/招聘数据源/附件简历.test.ts`，用 `vi.fn` client 记录 options。测试数据使用这一份合法最小库：

```ts
const 正常状态 = { status: 'not_started' } as const;
const 正常文件 = {
  file_id: 'rf_1', display_name: 'resume.pdf', revision: 2,
  current_version: {
    version_id: 'rfv_2', version: 2, size_bytes: 8,
    media_type: 'application/pdf' as const, sha256: 'a'.repeat(64),
    created_at: '2026-08-28T00:00:00Z', parse: 正常状态,
  },
  created_at: '2026-08-27T00:00:00Z', updated_at: '2026-08-28T00:00:00Z',
};
const 正常库 = {
  items: [正常文件],
  limits: { max_files: 3, max_file_bytes: 10_485_760, accepted_media_types: ['application/pdf'] as ['application/pdf'] },
};

it('create sends the exact multipart parts and no manual Content-Type', async () => {
  const 请求 = vi.fn().mockResolvedValue({ result: 正常文件, etag: null, requestId: 'req' });
  const source = 创建附件简历数据源({ 请求, 请求二进制: vi.fn() });
  const file = new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' });
  await source.创建附件简历(file, true);
  const options = 请求.mock.calls[0][0];
  expect(options).toMatchObject({ path: '/api/v1/me/resume-files', method: 'POST', 幂等: true });
  expect(Array.from(options.formData.entries())).toEqual([
    ['display_name', 'resume.pdf'], ['file', file], ['processing_consent_confirmed', 'true'],
  ]);
  expect(options.body).toBeUndefined();
});

it('replace preserves slot name by omitting display_name and sends CAS', async () => {
  const 请求 = vi.fn().mockResolvedValue({ result: 正常文件, etag: '"3"', requestId: 'req' });
  const source = 创建附件简历数据源({ 请求, 请求二进制: vi.fn() });
  const file = new File(['%PDF'], 'new-name.pdf', { type: 'application/pdf' });
  await source.替换附件简历('rf_1', 2, file, true);
  const options = 请求.mock.calls[0][0];
  expect(options).toMatchObject({
    path: '/api/v1/me/resume-files/rf_1/content', method: 'PUT', ifMatch: '"2"', 幂等: true,
  });
  expect(Array.from(options.formData.entries())).toEqual([
    ['file', file], ['processing_consent_confirmed', 'true'],
  ]);
});

it('delete and parse use the current CAS/version and parse literal true', async () => {
  const 请求 = vi.fn()
    .mockResolvedValueOnce({ result: { deleted: true }, etag: null, requestId: 'd' })
    .mockResolvedValueOnce({ result: { status: 'pending', updated_at: '2026-08-28T01:00:00Z' }, etag: null, requestId: 'p' });
  const source = 创建附件简历数据源({ 请求, 请求二进制: vi.fn() });
  await source.删除附件简历('rf_1', 2);
  await source.请求附件解析('rf_1', 'rfv_2', true);
  expect(请求.mock.calls[0][0]).toEqual({
    path: '/api/v1/me/resume-files/rf_1', method: 'DELETE', ifMatch: '"2"',
  });
  expect(请求.mock.calls[1][0]).toEqual({
    path: '/api/v1/me/resume-files/rf_1/parse', method: 'POST', 幂等: true,
    body: { version_id: 'rfv_2', processing_consent_confirmed: true },
  });
});

it.each([
  [{ items: [正常文件, 正常文件, 正常文件, 正常文件], limits: 正常库.limits }, 'too many items'],
  [{ items: [{ ...正常文件, extra: true }], limits: 正常库.limits }, 'unknown file key'],
  [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, media_type: 'text/plain' } }], limits: 正常库.limits }, 'wrong media type'],
  [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, parse: { status: 'succeeded', updated_at: 'now' } } }], limits: 正常库.limits }, 'missing parse_id'],
  [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, parse: { status: 'not_started', updated_at: 'now' } } }], limits: 正常库.limits }, 'extra parse key'],
])('list rejects malformed closed response: %s', async (result) => {
  const source = 创建附件简历数据源({
    请求: vi.fn().mockResolvedValue({ result, etag: null, requestId: 'req' }),
    请求二进制: vi.fn(),
  });
  await expect(source.读取附件简历库()).rejects.toMatchObject({ code: 'invalid_response', status: 200 });
});

it('download rejects a successful non-PDF response', async () => {
  const source = 创建附件简历数据源({
    请求: vi.fn(),
    请求二进制: vi.fn().mockResolvedValue({
      blob: new Blob(['html'], { type: 'text/html' }), contentType: 'text/html',
      contentDisposition: null, requestId: 'req',
    }),
  });
  await expect(source.下载附件简历('rf_1')).rejects.toMatchObject({ code: 'invalid_response', status: 200 });
});

it('download trusts the normalized response content type instead of raw Blob parameters', async () => {
  const blob = new Blob(['%PDF'], { type: 'application/pdf;charset=binary' });
  const source = 创建附件简历数据源({
    请求: vi.fn(),
    请求二进制: vi.fn().mockResolvedValue({
      blob, contentType: 'application/pdf', contentDisposition: null, requestId: 'req',
    }),
  });
  await expect(source.下载附件简历('rf_1')).resolves.toBe(blob);
});
```

另加成功 decoder table，逐个覆盖五种 parse 状态和四种 failure code；每个 exact object 都断言 unknown key 被拒。limits 明确覆盖：`max_files=2/items.length=2` 合法、`max_files=2/items.length=3` 拒绝、`max_files=4` 拒绝。不要用快照测试代替字段断言。

- [ ] **Step 2: Run the RED test**

Run: `npm test -- src/数据/招聘数据源/附件简历.test.ts`

Expected: FAIL because the facade module does not exist.

- [ ] **Step 3: Implement the strict facade and root composition**

创建文件并固定接口/route：

```ts
export interface 附件简历数据源 {
  读取附件简历库(): Promise<BFF附件简历库>;
  创建附件简历(file: File, consent: true): Promise<BFF附件简历>;
  替换附件简历(fileId: string, revision: number, file: File, consent: true): Promise<BFF附件简历>;
  删除附件简历(fileId: string, revision: number): Promise<BFF删除回执>;
  请求附件解析(fileId: string, versionId: string, consent: true): Promise<BFF附件解析状态>;
  下载附件简历(fileId: string): Promise<Blob>;
}

type 附件请求 = Pick<BFF客户端, '请求' | '请求二进制'>;

export function 创建附件简历数据源(client: 附件请求): 附件简历数据源 {
  return {
    async 读取附件简历库() {
      const { result } = await client.请求<unknown>({ path: '/api/v1/me/resume-files' });
      return 解码附件简历库(result);
    },
    async 创建附件简历(file, consent) {
      const formData = new FormData();
      formData.append('display_name', file.name);
      formData.append('file', file);
      formData.append('processing_consent_confirmed', String(consent));
      const { result } = await client.请求<unknown>({
        path: '/api/v1/me/resume-files', method: 'POST', formData, 幂等: true,
      });
      return 解码附件简历(result);
    },
    async 替换附件简历(fileId, revision, file, consent) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('processing_consent_confirmed', String(consent));
      const { result } = await client.请求<unknown>({
        path: `/api/v1/me/resume-files/${encodeURIComponent(fileId)}/content`,
        method: 'PUT', formData, ifMatch: `"${revision}"`, 幂等: true,
      });
      return 解码附件简历(result);
    },
    async 删除附件简历(fileId, revision) {
      const { result } = await client.请求<unknown>({
        path: `/api/v1/me/resume-files/${encodeURIComponent(fileId)}`,
        method: 'DELETE', ifMatch: `"${revision}"`,
      });
      return 解码删除回执(result);
    },
    async 请求附件解析(fileId, versionId, consent) {
      const { result } = await client.请求<unknown>({
        path: `/api/v1/me/resume-files/${encodeURIComponent(fileId)}/parse`,
        method: 'POST', 幂等: true,
        body: { version_id: versionId, processing_consent_confirmed: consent },
      });
      return 解码附件解析状态(result);
    },
    async 下载附件简历(fileId) {
      const result = await client.请求二进制(`/api/v1/me/resume-files/${encodeURIComponent(fileId)}/content`);
      if (result.contentType !== 'application/pdf') {
        throw new BFF错误(200, 'invalid_response', '附件响应不是 PDF');
      }
      return result.blob;
    },
  };
}
```

实现 `解码附件简历库/解码附件简历/解码附件解析状态/解码删除回执` 时统一用这些规则：`对象且非数组`、`Object.keys` 与状态所需 key 集合排序后完全相等、字符串非空、revision/version 为 `Number.isInteger && >= 1`、size 为 `Number.isInteger && >= 0`、时间为非空 string、limits `max_files` 为 `1..3` 的整数、`items.length <= limits.max_files`、`max_file_bytes>=1`、accepted types 精确为单元素 `application/pdf`。`max_files>3` 同时违反当前产品上限与 OpenAPI `maxItems:3`，必须 fail closed，而不是静默支持 4–5 行。任一失败都 `throw new BFF错误(200, 'invalid_response', '附件简历响应不符合契约')`。parse exact keys 固定为：`not_started=[status]`、active=`[status,updated_at]`、succeeded=`[parse_id,status,updated_at]`、failed=`[failure_code,status,updated_at]`，failure code 只允许 Spec 四值。

修改 `HTTP招聘数据源.ts`：client 类型改为 `Pick<BFF客户端, '请求' | '请求二进制'>`，根 type 加 `附件简历数据源`，factory return 加 `...创建附件简历数据源(deps.client)`。更新文件头“第八个域”。

- [ ] **Step 4: Add root-factory tests and run GREEN**

在 `HTTP招聘数据源.test.ts` 的 method list 加上述六个精确方法名，并断言其它七域方法仍存在。在 `接口层.test.ts` 现有 backend factory seam 中断言传入 client 同时有 `请求` 与 `请求二进制`。

Run: `npm test -- src/数据/招聘数据源/附件简历.test.ts src/数据/HTTP招聘数据源.test.ts src/数据/接口层.test.ts && npm run typecheck`

Expected: PASS；没有触发真实 fetch。

- [ ] **Step 5: Commit Task 2**

```bash
git add src/数据/招聘数据源/附件简历.ts src/数据/招聘数据源/附件简历.test.ts src/数据/HTTP招聘数据源.ts src/数据/HTTP招聘数据源.test.ts src/数据/接口层.test.ts
git commit -m "feat: add strict resume file data source"
```

### Task 3: Provider snapshot, operations, hydration, and recovery

**Files:**
- Create: `src/状态/后端/附件简历操作.ts`
- Create: `src/状态/后端/附件简历操作.test.ts`
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/后端/会话操作.test.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: Task 2 `附件简历数据源` 六方法；现有 `后端操作依赖` 的 `锁/主体标识引用/会话代际/后端状态引用/设后端状态`；现有 `清账号状态`。
- Produces: `后端状态.附件简历库: BFF附件简历库 | null`；`附件简历操作`：`刷新附件简历(): Promise<void>`、`创建附件简历(file, true): Promise<void>`、`替换附件简历(fileId, file, true): Promise<void>`、`删除附件简历(fileId): Promise<void>`、`请求附件解析(fileId, true): Promise<void>`、`下载附件简历(fileId): Promise<Blob>`；`应用操作` 与该接口相交。
- Internal invariant: `创建附件简历操作` factory 闭包持有一条 `附件读取队列`；候选登录水合继续由会话层 generation fence 独立完成，水合后的显式刷新、poll、安全重读和 mutation 权威 GET 串行入队。先来的 poll settle 后 mutation 权威读才发出，后来的 poll 又排在 mutation 后；后排 poll 的失败不会反向污染已完成的 mutation。队列不是公共 state/dependency，不迫使其它领域 fixture 改 shape。

- [ ] **Step 1: Write failing operation and hydration tests**

在新测试文件用真实 factory + fake deps 覆盖以下具体断言：

```ts
it('create uses a library lock, then commits only the authoritative reread', async () => {
  const created = { ...文件A, file_id: 'rf_created' };
  const authority = { items: [created], limits };
  后端.创建附件简历.mockResolvedValue(created);
  后端.读取附件简历库.mockResolvedValue(authority);
  const promise = 操作.创建附件简历(pdf, true);
  await promise;
  expect(后端.创建附件简历).toHaveBeenCalledWith(pdf, true);
  expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
  expect(设后端状态).toHaveCommitted(expect.objectContaining({ 附件简历库: authority }));
});

it('replace reads current revision from snapshot and never sends the picked filename as a display name', async () => {
  后端状态引用.current.附件简历库 = { items: [文件A], limits };
  后端.替换附件简历.mockResolvedValue(文件A);
  后端.读取附件简历库.mockResolvedValue({ items: [文件B], limits });
  await 操作.替换附件简历('rf_1', pdf, true);
  expect(后端.替换附件简历).toHaveBeenCalledWith('rf_1', 文件A.revision, pdf, true);
});

it.each(['resume_file_version_conflict', 'resume_file_selection_stale', 'resume_file_not_found'])
('conflict %s rereads once, commits authority, does not replay and rethrows', async (code) => {
  后端状态引用.current.附件简历库 = { items: [文件A], limits };
  后端.替换附件简历.mockRejectedValue(new BFF错误(409, code, code));
  后端.读取附件简历库.mockResolvedValue({ items: [文件B], limits });
  await expect(操作.替换附件简历('rf_1', pdf, true)).rejects.toMatchObject({ code });
  expect(后端.替换附件简历).toHaveBeenCalledTimes(1);
  expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
});

it('a stale refresh response after generation changes is silently discarded', async () => {
  const deferred = 可控Promise<BFF附件简历库>();
  后端.读取附件简历库.mockReturnValue(deferred.promise);
  const promise = 操作.刷新附件简历();
  会话代际.current += 1;
  deferred.resolve({ items: [文件B], limits });
  await promise;
  expect(设后端状态).not.toHaveBeenCalled();
});

it('an older polling GET cannot overwrite the authoritative GET after a delete', async () => {
  后端状态引用.current.附件简历库 = { items: [文件A], limits };
  const oldPoll = 可控Promise<BFF附件简历库>();
  后端.读取附件简历库
    .mockReturnValueOnce(oldPoll.promise)
    .mockResolvedValueOnce({ items: [], limits });
  后端.删除附件简历.mockResolvedValue({ deleted: true });
  const polling = 操作.刷新附件简历();
  const deleting = 操作.删除附件简历(文件A.file_id);
  await vi.waitFor(() => expect(后端.删除附件简历).toHaveBeenCalledTimes(1));
  oldPoll.resolve({ items: [文件A], limits });
  await Promise.all([polling, deleting]);
  expect(后端状态引用.current.附件简历库?.items).toEqual([]);
});

it('a poll queued after the mutation authority read cannot make a successful delete reject', async () => {
  后端状态引用.current.附件简历库 = { items: [文件A], limits };
  const authority = 可控Promise<BFF附件简历库>();
  后端.读取附件简历库
    .mockReturnValueOnce(authority.promise)
    .mockRejectedValueOnce(new BFF错误(0, 'network_error', 'offline'));
  后端.删除附件简历.mockResolvedValue({ deleted: true });
  const deleting = 操作.删除附件简历(文件A.file_id);
  await vi.waitFor(() => expect(后端.读取附件简历库).toHaveBeenCalledTimes(1));
  const polling = 操作.刷新附件简历();
  expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
  authority.resolve({ items: [], limits });
  await expect(deleting).resolves.toBeUndefined();
  await expect(polling).rejects.toMatchObject({ code: 'network_error' });
  expect(后端状态引用.current.附件简历库?.items).toEqual([]);
});

it('401 clears every account snapshot including attachments', async () => {
  后端.读取附件简历库.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
  await expect(操作.刷新附件简历()).rejects.toMatchObject({ status: 401 });
  expect(设后端状态).toHaveCommitted(expect.objectContaining({
    已登录: false, 主体: null, 附件简历库: null,
  }));
});

it('a stale generation during error recovery resolves silently without inspecting null', async () => {
  后端状态引用.current.附件简历库 = { items: [文件A], limits };
  const reread = 可控Promise<BFF附件简历库>();
  后端.请求附件解析.mockRejectedValue(new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
  后端.读取附件简历库.mockReturnValue(reread.promise);
  const parsing = 操作.请求附件解析(文件A.file_id, true);
  await vi.waitFor(() => expect(后端.读取附件简历库).toHaveBeenCalledTimes(1));
  会话代际.current += 1;
  reread.resolve({ items: [], limits });
  await expect(parsing).resolves.toBeUndefined();
  expect(设后端状态).not.toHaveBeenCalled();
});

it('parse_not_allowed only closes as success when authority is succeeded', async () => {
  后端状态引用.current.附件简历库 = { items: [文件A], limits };
  后端.请求附件解析.mockRejectedValue(new BFF错误(409, 'parse_not_allowed', 'not allowed'));
  后端.读取附件简历库.mockResolvedValueOnce({ items: [文件处理中], limits });
  await expect(操作.请求附件解析(文件A.file_id, true)).rejects.toMatchObject({ code: 'parse_not_allowed' });
  后端.读取附件简历库.mockResolvedValueOnce({ items: [文件已完成], limits });
  await expect(操作.请求附件解析(文件A.file_id, true)).resolves.toBeUndefined();
});

it('upload_in_progress rereads but preserves its own code', async () => {
  后端状态引用.current.附件简历库 = { items: [], limits };
  后端.创建附件简历.mockRejectedValue(new BFF错误(409, 'upload_in_progress', 'busy'));
  后端.读取附件简历库.mockResolvedValue({ items: [文件A], limits });
  await expect(操作.创建附件简历(pdf, true)).rejects.toMatchObject({ code: 'upload_in_progress' });
});
```

测试 helper `toHaveCommitted` 不存在时，使用当前项目实际的 functional setter 执行方式：对每个 `设后端状态.mock.calls` 的 updater 依次作用到本地 state，再断言最终 state；不要新增自定义 matcher。

在测试文件内实现 `可控Promise<T>()` 为 `{promise,resolve,reject}` 的标准 deferred helper，并定义 `文件处理中`/`文件已完成` 为与 `文件A` 同 version、parse 分别是 processing/succeeded 的完整 DTO。另写：并发同 key 只发一次；missing local file 先安全 GET 再抛 `resume_file_selection_stale`；delete 404 重读后目标不存在收口成功；parse 网络/503/最终 `idempotency_in_progress` 后同 version 变 active/succeeded 或 terminal `updated_at` 改变则收口；create/replace 结果未知重读有变化仍抛 `attachment_state_changed` 让 UI 提示确认；安全重读失败保留原错误；download 401 清账号；候选水合由三路变四路且各域独立提交；recruiter/null/退出/换账号把附件 snapshot 置 null。

- [ ] **Step 2: Run the RED tests**

Run: `npm test -- src/状态/后端/附件简历操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts`

Expected: FAIL because the operation interface/factory and snapshot do not exist, and candidate hydration still calls three domains.

- [ ] **Step 3: Implement the state contract and operation factory**

在 `类型.ts` 加精确接口：

```ts
export interface 附件简历操作 {
  刷新附件简历(): Promise<void>;
  创建附件简历(file: File, consent: true): Promise<void>;
  替换附件简历(fileId: string, file: File, consent: true): Promise<void>;
  删除附件简历(fileId: string): Promise<void>;
  请求附件解析(fileId: string, consent: true): Promise<void>;
  下载附件简历(fileId: string): Promise<Blob>;
}

export type 应用操作 = 会话操作 & 候选操作 & 岗位操作 & 组织操作 & 隐私操作 & 附件简历操作;
```

给 `后端状态` 加 `附件简历库: BFF附件简历库 | null`。创建 `附件简历操作.ts`，所有读写先捕获以下 fence：

```ts
function 捕获栅栏(deps: 后端操作依赖) {
  return { subject: deps.主体标识引用.current, generation: deps.会话代际.current };
}

function 仍有效(deps: 后端操作依赖, fence: ReturnType<typeof 捕获栅栏>): boolean {
  return deps.主体标识引用.current === fence.subject && deps.会话代际.current === fence.generation;
}

function 提交附件库(deps: 后端操作依赖, fence: ReturnType<typeof 捕获栅栏>, value: BFF附件简历库): void {
  if (!仍有效(deps, fence)) return;
  deps.设后端状态((old) => ({ ...old, 附件简历库: value }));
}

// 以下 queue 与 helper 定义在 创建附件简历操作(deps) 闭包内。
let 附件读取队列: Promise<void> = Promise.resolve();
function 读取并提交(fence: ReturnType<typeof 捕获栅栏>): Promise<BFF附件简历库 | null> {
  const run = 附件读取队列.then(async () => {
    if (!仍有效(deps, fence)) return null;
    const value = await deps.后端!.读取附件简历库();
    if (!仍有效(deps, fence)) return null;
    提交附件库(deps, fence, value);
    return value;
  });
  附件读取队列 = run.then(() => undefined, () => undefined);
  return run;
}
```

factory 的显式刷新、安全重读、每个 mutation 后的权威 GET 全部只调用闭包内 `读取并提交`，禁止绕过它直接提交列表。factory 使用库锁 `resume-files:create` 和文件锁 `resume-file:${fileId}`。每个 mutation 从 `后端状态引用.current.附件简历库` 按 id 取最新 revision/version；找不到时只 GET 一次并抛 `new BFF错误(409, 'resume_file_selection_stale', '附件状态已更新，请重新选择')`。mutation 成功后调用同一 fence 下的 `读取并提交`，提交后才 resolve；队列通过 rejected branch 也恢复为 fulfilled void，单次读失败不会毒死后续读取。

错误分派精确为：

```ts
const 权威重读码 = new Set([
  'resume_file_version_conflict', 'resume_file_selection_stale', 'resume_file_not_found', 'resume_file_limit_reached',
]);

// 401: 清账号状态后抛原错误。
// 权威重读码: GET+commit；delete 且目标消失才 return，其余抛原错误。
// status 0、status 503 或 code=idempotency_in_progress:
// GET+commit；按 Spec 10.3 核对 delete/parse 是否已达成。
// code=upload_in_progress: GET+commit 后始终抛原 code，不做集合差异效果判定。
// code=parse_already_in_progress: GET+commit；active/succeeded 时按目标达成，否则抛原错误。
// code=parse_not_allowed: GET+commit；只有 succeeded 按目标达成，否则抛原错误。
// create/replace 若库与动作前 snapshot 的 file/version 集合不同：
// throw new BFF错误(error.status, 'attachment_state_changed', '附件状态已更新，请确认');
// 读取并提交 返回 null（会话换代）：不读 items、不抛错、不提示，静默结束 stale 调用。
// 无法确认或安全 GET 失败：抛原错误。任何分支都不得自动重放 mutation。
```

`刷新附件简历`/`下载附件简历` 也带 fence；迟到成败静默丢弃，当前 fence 的 401 才清账号，其他错误原样抛。Mock 或无 backend 时 mutation/read return，download 抛 `BFF错误(0,'backend_unavailable','附件仅在后端模式可用')`，避免生成假 Blob。

- [ ] **Step 4: Wire hydration and Provider composition**

候选水合改为精确四路顺序：

```ts
const 结果 = await Promise.allSettled([
  后端.读取简历(), 后端.读取意向(), 后端.读取隐私(), 后端.读取附件简历库(),
]);
```

为第四项应用同一个 captured subject/generation fence：fulfilled 时只写 `后端状态.附件简历库`；rejected 401 进入现有统一失效分支；交互水合抛第一错误；mount 水合只提示一次该域错误且其它域保留。`清账号状态`、recruiter 清候选数据、last role null、主体变化清理都写 `附件简历库:null`。

在 `应用状态.tsx` 初值加 `附件简历库:null`，import `创建附件简历操作`，操作组合末尾加 `...创建附件简历操作(deps)`；不新增 reducer action，因为附件 UI 直接读 `后端状态`。

- [ ] **Step 5: Run GREEN and session regression**

Run: `npm test -- src/状态/后端/附件简历操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts && npm run typecheck`

Expected: PASS；候选四域独立、招聘方不读附件、清账号不留附件、stale response 不提交。

- [ ] **Step 6: Commit Task 3**

```bash
git add src/状态/后端/附件简历操作.ts src/状态/后端/附件简历操作.test.ts src/状态/后端/类型.ts src/状态/后端/会话操作.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts
git commit -m "feat: manage authoritative resume file state"
```

### Task 4: Pure interaction helpers, visible polling, and PDF preview

**Files:**
- Create: `src/流程/附件简历交互.ts`
- Create: `src/流程/附件简历交互.test.ts`
- Create: `src/流程/附件简历刷新.ts`
- Create: `src/流程/附件简历刷新.test.tsx`
- Create: `src/流程/附件简历预览.ts`
- Create: `src/流程/附件简历预览.test.tsx`

**Interfaces:**
- Consumes: Task 3 `use应用状态()` 返回的 `数据源模式/后端状态/操作`；`BFF附件简历`/`BFF附件简历库`/`BFF错误`；现有 `取后端错误文案`、`轻提示`。
- Produces: `校验附件PDF(file, limits): string | null`、`附件状态文案(file): string`、`附件错误文案(error, limits): string`、`use附件简历刷新(启用?: boolean): void`、`use附件PDF预览(): { 打开附件PDF(fileId: string): Promise<void> }`。

- [ ] **Step 1: Write failing pure-helper and hook tests**

纯函数测试固定以下 table：

```ts
it.each([
  [new File(['x'], 'resume.txt', { type: 'text/plain' }), '请选择 PDF 文件'],
  [new File(['x'], 'resume.PDF', { type: '' }), null],
  [new File(['xx'], 'resume.pdf', { type: 'application/pdf' }), '文件不能超过 1 B'],
])('validates PDF before consent', (file, expected) => {
  expect(校验附件PDF(file, { max_files: 3, max_file_bytes: 1, accepted_media_types: ['application/pdf'] }))
    .toBe(expected);
});

it.each([
  [{ status: 'not_started' }, '尚未识别'],
  [{ status: 'pending', updated_at: 't' }, '等待识别'],
  [{ status: 'processing', updated_at: 't' }, '正在识别'],
  [{ status: 'succeeded', parse_id: 'p', updated_at: 't' }, '识别完成'],
  [{ status: 'failed', failure_code: 'document_unreadable', updated_at: 't' }, '未能读取 · 可重试'],
  [{ status: 'failed', failure_code: 'document_too_complex', updated_at: 't' }, '内容过多 · 请替换'],
  [{ status: 'failed', failure_code: 'parser_invalid_output', updated_at: 't' }, '识别失败 · 可重试'],
  [{ status: 'failed', failure_code: 'parser_temporarily_unavailable', updated_at: 't' }, '服务繁忙 · 稍后重试'],
])('maps closed parse status %o', (parse, expected) => {
  expect(附件状态文案({ ...文件A, current_version: { ...文件A.current_version, parse } } as BFF附件简历))
    .toBe(expected);
});
```

刷新 hook 用 fake timers + 可写 `document.visibilityState`，断言：mount visible 立即一次；第一次 settle 后且 snapshot active 只在 3000ms 再读（active false→true 本身不立即 GET）；promise 未 settle时推进时间或触发 visibility/effect 重跑都不重叠；terminal/hidden/unmount/Mock/candidate logout 不再读；visible 恢复立即读；特别覆盖“请求在飞期间 hidden→visible”：settle 后必须立刻再读，不等 3000ms，且 active=false 也一样；后台错误不 toast。预览 hook 断言：点击 handler 同步 `window.open('about:blank','_blank')` 并 `opener=null`；成功把 object URL 赋给预开窗口；下载失败关闭窗口并提示；popup null 时创建 `a` 且 `rel='noopener'`；load 后 4,999ms 不 revoke、5,000ms revoke；无 load 时 30 秒兜底；unmount 立即释放；任一路径每个 URL 只 revoke 一次。

- [ ] **Step 2: Run RED**

Run: `npm test -- src/流程/附件简历交互.test.ts src/流程/附件简历刷新.test.tsx src/流程/附件简历预览.test.tsx`

Expected: FAIL because all three modules do not exist.

- [ ] **Step 3: Implement pure validation and copy tables**

```ts
export function 校验附件PDF(file: File, limits: BFF附件简历库['limits'] | null): string | null {
  if (!file.name.toLowerCase().endsWith('.pdf')) return '请选择 PDF 文件';
  if (file.type !== '' && file.type.toLowerCase() !== 'application/pdf') return '请选择 PDF 文件';
  if (limits && file.size > limits.max_file_bytes) return `文件不能超过 ${格式化字节(limits.max_file_bytes)}`;
  return null;
}

export function 附件状态文案(file: BFF附件简历): string {
  const parse = file.current_version.parse;
  if (parse.status === 'not_started') return '尚未识别';
  if (parse.status === 'pending') return '等待识别';
  if (parse.status === 'processing') return '正在识别';
  if (parse.status === 'succeeded') return '识别完成';
  return {
    document_unreadable: '未能读取 · 可重试',
    document_too_complex: '内容过多 · 请替换',
    parser_invalid_output: '识别失败 · 可重试',
    parser_temporarily_unavailable: '服务繁忙 · 稍后重试',
  }[parse.failure_code];
}
```

`格式化字节` 只为 error copy：能整除 MiB 显示 `${n} MB`，否则显示 `${bytes} B`。`附件错误文案` 使用以下闭合分派；不得显示 SHA、request id、provider status、对象坐标或服务端内部 message 中的隐私内容：

```ts
export function 附件错误文案(error: unknown, limits: BFF附件简历库['limits'] | null): string {
  if (!(error instanceof BFF错误)) return 取后端错误文案(error);
  if (error.code === 'invalid_pdf') return '仅支持有效、未加密且不含主动内容的 PDF';
  if (error.code === 'resume_file_too_large') {
    return limits ? `文件不能超过 ${格式化字节(limits.max_file_bytes)}` : (error.message || '文件过大，请选择较小的 PDF');
  }
  if (error.code === 'resume_file_limit_reached') {
    return limits ? `最多可上传 ${limits.max_files} 份附件简历` : '附件简历已达上限';
  }
  if (error.code === 'upload_in_progress') return '附件正在上传，请稍后再试';
  if (error.code === 'idempotency_in_progress') return '操作仍在处理中，请稍后确认附件状态';
  if (error.code === 'resume_file_version_conflict' || error.code === 'resume_file_selection_stale' || error.code === 'resume_file_not_found') {
    return '附件状态已更新，请重新选择操作';
  }
  if (error.code === 'parse_already_in_progress') return '简历正在识别';
  if (error.code === 'parse_not_allowed') return '当前附件状态不可识别';
  if (error.code === 'storage_unavailable') return '附件服务暂时不可用，请稍后重试';
  if (error.code === 'parser_temporarily_unavailable') return '识别服务繁忙，请稍后重试';
  if (error.code === 'processing_consent_required') return '请重新确认后再继续';
  if (error.code === 'attachment_state_changed') return '附件状态已更新，请确认';
  if (error.code === 'invalid_response') return '服务返回异常，请稍后重试';
  return 取后端错误文案(error);
}
```

- [ ] **Step 4: Implement single-flight refresh and preview hooks**

刷新 hook 把 session 生命周期与 active 调度拆开：session effect 只依赖 `可运行/subject` 并负责唯一 immediate GET、visibility 和清理；active effect 只调用 controller 的 `同步active`，绝不直接 GET。`inFlightRef` 位于 effect 外，保证 active 翻转或 session effect 重跑时仍是同一个单飞标志；`轮询待排` 与 `待立即刷新` 是两个独立信号，visibility 的 immediate 意图优先：

```ts
export function use附件简历刷新(启用 = true): void {
  const { 数据源模式, 后端状态, 操作 } = use应用状态();
  const active = 后端状态.附件简历库?.items.some((item) =>
    item.current_version.parse.status === 'pending' || item.current_version.parse.status === 'processing') ?? false;
  const 可运行 = 启用 && 数据源模式 === 'backend' && 后端状态.已登录 &&
    后端状态.主体?.last_used_role === 'candidate';
  const 操作引用 = useRef(操作);
  操作引用.current = 操作;
  const activeRef = useRef(active);
  activeRef.current = active;
  const inFlightRef = useRef<Promise<void> | null>(null);
  const controllerRef = useRef<{ 同步active: (value: boolean) => void } | null>(null);

  useEffect(() => {
    if (!可运行) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let 轮询待排 = false;
    let 待立即刷新 = false;
    let 已监听的在飞请求: Promise<void> | null = null;
    const clear = () => { if (timer !== null) clearTimeout(timer); timer = null; };
    const schedule = () => {
      clear();
      if (stopped || !activeRef.current || document.visibilityState !== 'visible') return;
      if (inFlightRef.current) { 轮询待排 = true; return; }
      timer = setTimeout(() => { void 执行刷新(); }, 3000);
    };
    const 执行刷新 = async () => {
      clear();
      if (stopped || document.visibilityState !== 'visible' || inFlightRef.current) return;
      const request = 操作引用.current.刷新附件简历();
      inFlightRef.current = request;
      try { await request; } catch { /* 页面显式动作负责提示；轮询静默 */ }
      finally {
        if (inFlightRef.current === request) inFlightRef.current = null;
        if (stopped || 待立即刷新) return; // immediate waiter 在同一 promise settle 后接管
        if (轮询待排 || activeRef.current) { 轮询待排 = false; schedule(); }
      }
    };
    const immediate = () => {
      clear();
      if (stopped || document.visibilityState !== 'visible') return;
      const existing = inFlightRef.current;
      if (!existing) { void 执行刷新(); return; }
      待立即刷新 = true;
      if (已监听的在飞请求 === existing) return;
      已监听的在飞请求 = existing;
      void existing.catch(() => undefined).finally(() => {
        if (已监听的在飞请求 === existing) 已监听的在飞请求 = null;
        if (stopped || !待立即刷新 || document.visibilityState !== 'visible') return;
        待立即刷新 = false;
        void 执行刷新();
      });
    };
    const visibility = () => {
      clear();
      if (document.visibilityState === 'visible') immediate();
      else 待立即刷新 = false;
    };
    controllerRef.current = {
      同步active(value) { activeRef.current = value; if (value) schedule(); else { 轮询待排 = false; clear(); } },
    };
    document.addEventListener('visibilitychange', visibility);
    immediate();
    return () => {
      stopped = true; clear(); controllerRef.current = null;
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [可运行, 后端状态.主体?.subject_id]);

  useEffect(() => { controllerRef.current?.同步active(active); }, [active]);
}
```

实现时保留上述双 effect、共享 refs 和两个独立等待信号；测试必须证明 active 从 true 变 false 后不会再排 timer，false→true 只排 3 秒 timer，不产生第二次 immediate GET；visibility immediate waiter 不得被 owner finally 消费。

预览 hook 的公共实现固定 `打开附件PDF(fileId)`；同步执行 `window.open('about:blank','_blank')`，若窗口存在先 `预览.opener=null`，再 await `操作.下载附件简历`。成功 `URL.createObjectURL(blob)`；popup 存在则 `location.replace(url)`，否则创建不可见 anchor（`target='_blank'`, `rel='noopener'`, `href=url`）并 click/remove。每个资源记录 `{url, hardTimer, loadTimer}`：创建时保留 30,000ms hard fallback；popup `load` 只新增 5,000ms 延迟释放，不立即 revoke，也不取消 hard fallback；两者与 unmount 共用幂等 `释放`，释放时清两个 timer。失败关闭预开窗口并 `轻提示(附件错误文案(error, limits))`。不得把 object URL 放进 React state/Provider。

- [ ] **Step 5: Run GREEN and leak regression**

Run: `npm test -- src/流程/附件简历交互.test.ts src/流程/附件简历刷新.test.tsx src/流程/附件简历预览.test.tsx && npm run typecheck`

Expected: PASS；fake timer 结束后 `vi.getTimerCount()` 为 0，object URL 每个恰好 revoke 一次。

- [ ] **Step 6: Commit Task 4**

```bash
git add src/流程/附件简历交互.ts src/流程/附件简历交互.test.ts src/流程/附件简历刷新.ts src/流程/附件简历刷新.test.tsx src/流程/附件简历预览.ts src/流程/附件简历预览.test.tsx
git commit -m "feat: add resume file interaction lifecycle"
```

### Task 5: Wire Backend onboarding without visual drift

**Files:**
- Modify: `src/屏幕/学生分流.tsx`
- Modify: `src/屏幕/学生分流.test.tsx`
- Modify: `src/屏幕/学生分流.module.css`

**Interfaces:**
- Consumes: `use附件简历刷新(true)`；`校验附件PDF`、`附件错误文案`；Task 3 operations；现有 `确认层` exact props `{标题,正文,执行文,执行,取消,取消文?}`。
- Produces: Backend 上传行的空库 create / 非空 replace `items[0]`；Mock 原 `存简历文件名` 行为；固定授权文案和不阻塞 onboarding 的 UI。

- [ ] **Step 1: Extend the component fixture and write failing behavior tests**

把 `render学生分流` 的 mock context 增加 `后端状态` 与 `操作`，但保留现有 5 个 onboarding 测试不改断言：

```ts
const mock操作 = {
  刷新附件简历: vi.fn().mockResolvedValue(undefined),
  创建附件简历: vi.fn().mockResolvedValue(undefined),
  替换附件简历: vi.fn().mockResolvedValue(undefined),
};

it('Backend empty library validates, asks consent, then creates with literal true', async () => {
  render学生分流({ 数据源: 'backend', 附件库: { items: [], limits } });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const pdf = new File(['%PDF'], 'mine.pdf', { type: 'application/pdf' });
  await userEvent.upload(input, pdf);
  expect(screen.getByText('允许 AI 识别这份简历？')).toBeTruthy();
  expect(mock操作.创建附件简历).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: '同意并继续' }));
  expect(mock操作.创建附件简历).toHaveBeenCalledWith(pdf, true);
  expect(mock操作.替换附件简历).not.toHaveBeenCalled();
});

it('Backend nonempty library replaces items[0], keeps display name, and does not block Next', async () => {
  render学生分流({ 数据源: 'backend', 附件库: { items: [文件A, 文件B], limits }, 引导预填: 完整预填 });
  expect(screen.getByText(文件A.display_name)).toBeTruthy();
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const pdf = new File(['%PDF'], 'different.pdf', { type: 'application/pdf' });
  await userEvent.upload(input, pdf);
  await userEvent.click(screen.getByRole('button', { name: '同意并继续' }));
  expect(mock操作.替换附件简历).toHaveBeenCalledWith(文件A.file_id, pdf, true);
  expect(screen.getByRole('button', { name: '下一步' })).not.toHaveProperty('disabled', true);
});

it('cancel consent performs no mutation and clears the input for choosing the same file again', async () => {
  render学生分流({ 数据源: 'backend', 附件库: { items: [], limits } });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const pdf = new File(['%PDF'], 'mine.pdf', { type: 'application/pdf' });
  await userEvent.upload(input, pdf);
  await userEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(mock操作.创建附件简历).not.toHaveBeenCalled();
  expect(input.value).toBe('');
});

it('Mock preserves legacy copy, reducer action, and has no consent dialog', async () => {
  const { 派发 } = render学生分流({ 数据源: 'mock' });
  expect(screen.getByText('上传简历，AI识别后自动填充')).toBeTruthy();
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, new File(['%PDF'], 'demo.pdf', { type: 'application/pdf' }));
  expect(派发).toHaveBeenCalledWith({ 型: '存简历文件名', 文件名: 'demo.pdf' });
  expect(screen.queryByText('允许 AI 识别这份简历？')).toBeNull();
});
```

另测：非法 extension/type/超 limit 在确认前提示且零 mutation；mutation rejection 保留原文件名并使用 `附件错误文案`；重复点击执行键只发一次且 `aria-busy=true`；Backend snapshot null 显示空库文案但服务端裁决大小。

- [ ] **Step 2: Run RED**

Run: `npm test -- src/屏幕/学生分流.test.tsx`

Expected: 新 Backend 测试 FAIL；原有 5 个测试 PASS。

- [ ] **Step 3: Implement the narrow Backend branch**

组件顶层增加：

```ts
const { 状态: 全局, 派发, 数据源模式, 后端状态, 操作 } = use应用状态();
const 附件库 = 是后端 ? 后端状态.附件简历库 : null;
const 最近附件 = 附件库?.items[0] ?? null;
const [待确认文件, 设待确认文件] = useState<File | null>(null);
const [附件提交中, 设附件提交中] = useState(false);
use附件简历刷新(是后端);
```

`选中简历文件` 保留 Mock 分支逐字行为；Backend 先清 input，调用 `校验附件PDF(file, 附件库?.limits ?? null)`，有错只提示，无错 `设待确认文件(file)`。执行确认：

```ts
async function 同意处理附件() {
  if (!待确认文件 || 附件提交中) return;
  const file = 待确认文件;
  const target = 最近附件;
  设附件提交中(true);
  try {
    if (target) await 操作.替换附件简历(target.file_id, file, true);
    else await 操作.创建附件简历(file, true);
    设待确认文件(null);
    轻提示('简历已上传，正在识别');
  } catch (error) {
    轻提示(附件错误文案(error, 附件库?.limits ?? null));
  } finally {
    设附件提交中(false);
  }
}
```

上传行 DOM/class 保持现有结构；只将 Backend 空态文案改为 `上传 PDF 简历，确认后开始识别`，Backend 非空显示 `最近附件.display_name`，Mock 使用原 `已选简历名` 与原文案。input `accept=".pdf,application/pdf"`。页面尾部条件渲染原 `确认层`：标题 `允许 AI 识别这份简历？`、正文 `这份 PDF 将发送给受控模型服务进行简历识别，可能包含个人信息。确认后才会上传并开始处理。`、执行文 `同意并继续`；取消清 `待确认文件`。执行键期间通过外层 `aria-busy` 和 handler guard 防重复，不新增 spinner。

CSS 只允许增加 `.附件忙碌 { pointer-events: none; }` 或 screen-reader-only rule；不得修改 `.上传行/.上传图标/.选择占位/.选择值` 的已有尺寸、padding、border、font、gap。

- [ ] **Step 4: Run GREEN and Mock anti-drift component gate**

Run: `npm test -- src/屏幕/学生分流.test.tsx && npm run typecheck`

Expected: PASS；原 Mock copy/reducer 测试与所有 onboarding navigation 测试仍通过。

- [ ] **Step 5: Commit Task 5**

```bash
git add src/屏幕/学生分流.tsx src/屏幕/学生分流.test.tsx src/屏幕/学生分流.module.css
git commit -m "feat: wire onboarding resume file upload"
```

### Task 6: Wire the full library into My Resume with existing visuals

**Files:**
- Modify: `src/屏幕/我的简历.tsx`
- Modify: `src/屏幕/我的简历.module.css`
- Create: `src/屏幕/我的简历.test.tsx`

**Interfaces:**
- Consumes: Task 3 operations/snapshot；Task 4 validation/status/error/refresh/preview；现有 `滑动行` props `{操作: 滑动操作[],打开:boolean,请求打开(开),按下?,children}`；现有 `确认层` props；现有附件 CSS primitives。
- Produces: Backend 0–3 权威附件行、标题小 `＋`、状态动作矩阵、create/replace/delete/parse 授权与 PDF preview；Mock 硬编码 `沈亦舟_简历_2026.pdf` 和原说明切换不变。

- [ ] **Step 1: Write a fresh screen test with exact Mock and Backend contracts**

新测试 mock `use应用状态` 和 `use导航`，给结构化简历最小合法 fixture。加入：

```ts
it('Mock keeps the original one-row demo and explanation interaction', async () => {
  render我的简历({ mode: 'mock' });
  expect(screen.getByText('沈亦舟_简历_2026.pdf')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '添加附件简历' })).toBeNull();
  await userEvent.click(screen.getByText('沈亦舟_简历_2026.pdf'));
  expect(screen.getByText('原型演示：真机上在这里打开系统 PDF 预览。')).toBeTruthy();
});

it('Backend renders server order and exact parse copy, with add only below limit', () => {
  render我的简历({ mode: 'backend', library: { items: [文件A, 文件B], limits } });
  const rows = screen.getAllByTestId('附件简历行');
  expect(rows[0].textContent).toContain(文件A.display_name);
  expect(rows[1].textContent).toContain(文件B.display_name);
  expect(screen.getByText('尚未识别')).toBeTruthy();
  expect(screen.getByText('服务繁忙 · 稍后重试')).toBeTruthy();
  expect(screen.getByRole('button', { name: '添加附件简历' })).toBeTruthy();
});

it.each([
  ['not_started', ['解析', '替换', '删除']],
  ['failed', ['重新解析', '替换', '删除']],
  ['pending', ['替换', '删除']],
  ['processing', ['替换', '删除']],
  ['succeeded', ['替换', '删除']],
])('offers the closed swipe action matrix for %s', async (status, labels) => {
  render我的简历({ mode: 'backend', library: 库含状态(status) });
  fireEvent.pointerDown(screen.getByTestId('附件简历行'), { clientX: 180, clientY: 20 });
  fireEvent.pointerMove(screen.getByTestId('附件简历行'), { clientX: 20, clientY: 22 });
  fireEvent.pointerUp(screen.getByTestId('附件简历行'), { clientX: 20, clientY: 22 });
  for (const label of labels) expect(screen.getByRole('button', { name: label })).toBeTruthy();
  for (const absent of ['解析', '重新解析', '替换', '删除'].filter((label) => !labels.includes(label))) {
    expect(screen.queryByRole('button', { name: absent })).toBeNull();
  }
});

it('delete waits for confirmation and parse waits for processing consent', async () => {
  render我的简历({ mode: 'backend', library: { items: [文件A], limits } });
  await revealActions();
  await userEvent.click(screen.getByRole('button', { name: '删除' }));
  expect(操作.删除附件简历).not.toHaveBeenCalled();
  expect(screen.getByText('删除后无法恢复。')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: '删除附件简历' }));
  expect(操作.删除附件简历).toHaveBeenCalledWith(文件A.file_id);
});

it('clicking a Backend row opens the authenticated PDF helper', async () => {
  render我的简历({ mode: 'backend', library: { items: [文件A], limits } });
  await userEvent.click(screen.getByTestId('附件简历行'));
  expect(打开附件PDF).toHaveBeenCalledWith(文件A.file_id);
  expect(screen.queryByText(/原型演示/)).toBeNull();
});
```

另测：0 项空态；3/3 隐藏 `＋`；add/replace 非 PDF 与超限在 consent 前拒绝；add/replace/parse 取消零 mutation；parse 确认传 literal true；replace 锁定触发动作的 file id；成功/错误 toast；只有一行可展开；mutation busy 防双击；Backend 不渲染 legacy filename。

- [ ] **Step 2: Run RED**

Run: `npm test -- src/屏幕/我的简历.test.tsx`

Expected: FAIL because the screen still renders a hard-coded row for every mode and has no attachment operations.

- [ ] **Step 3: Implement Backend rendering and actions as a local screen component**

顶层保留 Mock JSX 原样，Backend 分支使用以下 state：

```ts
const [打开附件编号, 设打开附件编号] = useState<string | null>(null);
const [待上传, 设待上传] = useState<{ kind: 'create' } | { kind: 'replace'; fileId: string } | null>(null);
const [待确认文件, 设待确认文件] = useState<File | null>(null);
const [待解析编号, 设待解析编号] = useState<string | null>(null);
const [待删除编号, 设待删除编号] = useState<string | null>(null);
const [附件提交中, 设附件提交中] = useState(false);
const 附件选择框 = useRef<HTMLInputElement>(null);
const 附件库 = 数据源模式 === 'backend' ? 后端状态.附件简历库 : null;
const 可添加 = 附件库 !== null && 附件库.items.length < 附件库.limits.max_files;
use附件简历刷新(数据源模式 === 'backend');
const { 打开附件PDF } = use附件PDF预览();
```

标题 DOM 外壳不增高：把 `附件简历` 与只在 `items.length < limits.max_files` 时出现的 `button aria-label="添加附件简历"` 放在同一个节点：

```tsx
<div className={`${样式.卡标题} ${样式.附件标题行}`} data-testid="附件简历标题">
  <span>附件简历</span>
  {可添加 ? <button type="button" className={样式.附件添加键} aria-label="添加附件简历">＋</button> : null}
</div>
```

两个 class 必须挂同一节点，确保复用 `.卡标题` 的 `margin-bottom: 4px`，不能把带 margin 的 `.卡标题` span 再包进 flex。snapshot null 与权威空库都显示同一卡内 `还未上传附件简历`，但 null 不硬编码 max/size。

每个 Backend item 包进 `滑动行`，`操作` 精确按状态矩阵构造；静止 children 沿用现有 `.附件行/.PDF块/.PDF字/.附件主体/.附件名/.附件说明/.尖括号`。children 根用 `data-testid="附件简历行"`；`按下={() => void 打开附件PDF(file.file_id)}`。parse `not_started` 文本 `解析`，failed 文本 `重新解析`，两者都只打开统一 consent；replace 打开 hidden input 并记住 file id；delete 打开统一删除确认。

文件选择 change 立即清 input value，再预检，再保存 `待确认文件`；执行时 capture `待上传`，create/replace 操作成功后关闭；失败保留权威行，仅 toast。显式 parse 执行 `操作.请求附件解析(fileId, true)`。删除确认标题 `删除附件简历？`、正文 `删除后无法恢复。`、执行文 `删除附件简历`。consent 的标题/正文/执行文与 Task 5 逐字相同。

CSS 只能新增：

```css
.附件标题行 { display: flex; align-items: center; justify-content: space-between; }
.附件添加键 { border: 0; background: transparent; color: var(--深绿); font-size: var(--字号-区块标题); line-height: 1; padding: 0 2px; }
.附件空态 { padding: 12px 0; color: var(--最弱); font-size: 12.5px; }
```

不得引入新 token 或绿色 literal。不得改 `.卡/.卡标题/.附件行/.PDF块/.附件主体` 现有几何规则；`.附件标题行` 只补 flex，不声明 margin/padding/font。

- [ ] **Step 4: Run GREEN and geometry checks**

Run: `npm test -- src/屏幕/我的简历.test.tsx src/组件/弹层框架.test.tsx && npm run typecheck`

Expected: PASS；Mock 原演示行仍存在；Backend 行在关闭滑动态 `transform: translateX(0px)`；Vitest 只断言 `screen.getByTestId('附件简历标题').className` 同时包含导入的 `样式.卡标题` 与 `样式.附件标题行`，不在 jsdom 断言 computed style 或几何；确认层键盘/遮罩行为没有回归。

- [ ] **Step 5: Commit Task 6**

```bash
git add src/屏幕/我的简历.tsx src/屏幕/我的简历.module.css src/屏幕/我的简历.test.tsx
git commit -m "feat: manage resume files from my resume"
```

### Task 7: Backend-mode browser contract and plan-scope gate

**Files:**
- Modify: `e2e/数据源模式.spec.ts`
- Modify only if stable locator is absent: `e2e/视觉回归/场景.ts`

**Interfaces:**
- Consumes: Tasks 1–6 public UI and wire routes; existing `playwright.数据源模式.config.ts` backend fixture; existing Mock-only `playwright.视觉回归.config.ts` and `UI_VISUAL_GATE` script.
- Produces: one deterministic P2 browser fixture proving multipart/header/body/refresh/download behavior; plan-scope evidence on current commit. No product API or CSS changes.

- [ ] **Step 1: Add one failing Backend owner journey to the existing fixture**

在现有 BFF route switch 中加入本 Task Step 3 冻结的可变 P2 fixture；PDF bytes 统一用 `Buffer.from('%PDF-1.7\nfixture\n')`，不要把二进制字面量写进 spec 文件。Step 3 给出完整 fixture 与 route 实现。

Playwright journey 使用 exact visible assertions：

```ts
test('Backend candidate owns PDF library without changing Mock visuals @backend', async ({ page }) => {
  const P2 = 创建P2附件fixture();
  await 安装BFF路由(page, {
    记录目录请求: () => {}, 登录尝试id: 'att-p2', 附件fixture: P2,
  });
  await page.goto('/');
  await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
  await page.goto('/#/student');
  await page.locator('input[type=file]').setInputFiles({
    name: 'candidate.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
  });
  await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
  await page.getByRole('button', { name: '同意并继续' }).click();
  await expect(page.getByText('candidate.pdf')).toBeVisible();

  await page.goto('/#/resume');
  await expect(page.getByText('candidate.pdf')).toBeVisible();
  await expect(page.getByText(/等待识别|正在识别|识别完成/)).toBeVisible();
  await expect.poll(() => P2.列表读取次数, { timeout: 15_000 }).toBeGreaterThan(2);
  await expect(page.getByText('识别完成')).toBeVisible();
});
```

在同一 test 或独立 test 完成：add/replace 的 consent 取消都必须在触发文件选择/替换动作前采样 `const writesBefore = P2.写入次数`，取消后断言仍等于该基线；添加第二份；替换第一份后 display name 不变；预览触发 authenticated content GET；删除取消零 DELETE、确认一次 DELETE；failed 行的 `重新解析` 经 consent 后进入 active；三份时无 `添加附件简历`。再给 Mock describe 加一个上传演示断言，监听页面所有请求并证明 `/api/v1/me/resume-files` 请求数为 0。route handler 对任何未知 multipart part、缺 consent、错误 If-Match、缺幂等键直接 `throw new Error`，使 E2E fail closed。

failed retry 使用这一段真实测试，不靠直接调用 operation：

```ts
async function 左滑附件行(page: Page, name: string): Promise<void> {
  const row = page.getByTestId('附件简历行').filter({ hasText: name });
  const box = await row.boundingBox();
  if (!box) throw new Error(`resume row is not visible: ${name}`);
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
}

test('failed resume parse requires fresh consent before retry @backend', async ({ page }) => {
  const P2 = 创建P2附件fixture('parser_temporarily_unavailable');
  await 安装BFF路由(page, { 记录目录请求: () => {}, 登录尝试id: 'att-p2-failed', 附件fixture: P2 });
  await page.goto('/');
  await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
  await page.goto('/#/student');
  await page.locator('input[type=file]').setInputFiles({
    name: 'failed.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
  });
  await page.getByRole('button', { name: '同意并继续' }).click();
  await page.goto('/#/resume');
  await expect(page.getByText('服务繁忙 · 稍后重试')).toBeVisible({ timeout: 15_000 });
  P2.下次终态 = 'succeeded';
  const writesBeforeConsent = P2.写入次数;
  await 左滑附件行(page, 'failed.pdf');
  await page.getByRole('button', { name: '重新解析' }).click();
  await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
  expect(P2.写入次数).toBe(writesBeforeConsent);
  await page.getByRole('button', { name: '同意并继续' }).click();
  await expect(page.getByText('识别完成')).toBeVisible({ timeout: 15_000 });
  expect(P2.写入次数).toBe(writesBeforeConsent + 1);
});
```

- [ ] **Step 2: Run the E2E RED test**

Run: `npm run test:e2e:data-source -- --grep "Backend candidate owns PDF library|failed resume parse"`

Expected: FAIL before fixture/product selectors are complete；失败点必须是新增 P2 journey，不得是浏览器安装或既有登录 fixture。

- [ ] **Step 3: Finish only the deterministic fixture/locator changes**

给现有 `BFF路由选项` 增加 `附件fixture?: P2附件fixture形`，用现有 `取multipart部件`（已经返回 part name/type/bytes）实现上一步 route switch。fixture 的可变接口冻结为：

```ts
interface P2附件fixture形 {
  items: P2附件形[];
  列表读取次数: number;
  写入次数: number;
  下载次数: number;
  下一个编号: number;
  下次终态: 'succeeded' | P2失败码;
}

function 创建P2附件fixture(下次终态: 'succeeded' | P2失败码 = 'succeeded'): P2附件fixture形 {
  return { items: [], 列表读取次数: 0, 写入次数: 0, 下载次数: 0, 下一个编号: 1, 下次终态 };
}
```

在 E2E 文件本地定义完整类型和 helper：

```ts
type P2失败码 = 'document_unreadable' | 'document_too_complex' | 'parser_invalid_output' | 'parser_temporarily_unavailable';
type P2解析形 =
  | { status: 'not_started' }
  | { status: 'pending' | 'processing'; updated_at: string }
  | { status: 'succeeded'; parse_id: string; updated_at: string }
  | { status: 'failed'; failure_code: P2失败码; updated_at: string };

interface P2附件形 {
  file_id: string;
  display_name: string;
  revision: number;
  current_version: {
    version_id: string; version: number; size_bytes: number; media_type: 'application/pdf';
    sha256: string; created_at: string; parse: P2解析形;
  };
  created_at: string;
  updated_at: string;
}

const P2限制 = { max_files: 3, max_file_bytes: 10_485_760, accepted_media_types: ['application/pdf'] } as const;
const P2时间 = '2026-08-28T00:00:00Z';

function P2要求(condition: unknown): asserts condition {
  if (!condition) throw new Error('P2 fixture received an invalid wire request');
}

function P2新附件(id: number, displayName: string, bytes: Buffer): P2附件形 {
  return {
    file_id: `rf_${id}`, display_name: displayName, revision: 1,
    current_version: {
      version_id: `rfv_${id}_1`, version: 1, size_bytes: bytes.length,
      media_type: 'application/pdf', sha256: 'a'.repeat(64), created_at: P2时间,
      parse: { status: 'pending', updated_at: P2时间 },
    },
    created_at: P2时间, updated_at: P2时间,
  };
}
```

在 `安装BFF路由` 内、`await page.route` 之前声明 `const P2域 = 选项.附件fixture ?? 创建P2附件fixture();`，保证所有既有 Backend tests 默认收到合法权威空库，且每次安装各自隔离；不要在 route callback 内重复创建。然后在 session/me 分支之后、其它领域分支之前加入以下完整分派：

```ts
if (P2域 && path === '/api/v1/me/resume-files' && method === 'GET') {
  P2域.列表读取次数 += 1;
  for (const item of P2域.items) {
    if (P2域.列表读取次数 === 2 && item.current_version.parse.status === 'pending') {
      item.current_version.parse = { status: 'processing', updated_at: P2时间 };
    } else if (P2域.列表读取次数 >= 3) {
      if (item.current_version.parse.status === 'pending' || item.current_version.parse.status === 'processing') {
        item.current_version.parse = P2域.下次终态 === 'succeeded'
          ? { status: 'succeeded', parse_id: `parse_${item.file_id}`, updated_at: P2时间 }
          : { status: 'failed', failure_code: P2域.下次终态, updated_at: P2时间 };
      }
    }
  }
  await route.fulfill({ status: 200, json: 信封({ items: P2域.items, limits: P2限制 }) });
  return;
}
if (P2域 && path === '/api/v1/me/resume-files' && method === 'POST') {
  P2要求((请求.headers()['idempotency-key'] ?? '') !== '');
  P2要求(部件们?.map((part) => part.name).join(',') === 'display_name,file,processing_consent_confirmed');
  const display = 部件们[0].bytes.toString('utf8');
  const filePart = 部件们[1];
  P2要求(filePart.contentType === 'application/pdf');
  P2要求(部件们[2].bytes.toString('utf8') === 'true');
  P2要求(P2域.items.length < P2限制.max_files);
  const item = P2新附件(P2域.下一个编号++, display, filePart.bytes);
  P2域.items.unshift(item);
  P2域.列表读取次数 = 0;
  P2域.写入次数 += 1;
  await route.fulfill({ status: 201, json: 信封(item) });
  return;
}
const P2content = /^\/api\/v1\/me\/resume-files\/([^/]+)\/content$/.exec(path);
if (P2域 && P2content && method === 'PUT') {
  const item = P2域.items.find((candidate) => candidate.file_id === P2content[1]);
  P2要求(item);
  P2要求(请求.headers()['if-match'] === `"${item.revision}"`);
  P2要求((请求.headers()['idempotency-key'] ?? '') !== '');
  P2要求(部件们?.map((part) => part.name).join(',') === 'file,processing_consent_confirmed');
  P2要求(部件们[0].contentType === 'application/pdf');
  P2要求(部件们[1].bytes.toString('utf8') === 'true');
  item.revision += 1;
  item.current_version = {
    version_id: `rfv_${item.file_id}_${item.revision}`, version: item.current_version.version + 1,
    size_bytes: 部件们[0].bytes.length, media_type: 'application/pdf', sha256: 'b'.repeat(64),
    created_at: P2时间, parse: { status: 'pending', updated_at: P2时间 },
  };
  item.updated_at = P2时间;
  P2域.items.splice(P2域.items.indexOf(item), 1);
  P2域.items.unshift(item);
  P2域.列表读取次数 = 0;
  P2域.写入次数 += 1;
  await route.fulfill({ status: 200, json: 信封(item), headers: { ETag: `"${item.revision}"` } });
  return;
}
if (P2域 && P2content && method === 'GET') {
  P2要求(P2域.items.some((item) => item.file_id === P2content[1]));
  P2域.下载次数 += 1;
  await route.fulfill({
    status: 200, body: Buffer.from('%PDF-1.7\nfixture\n'),
    contentType: 'application/pdf',
    headers: { 'Content-Disposition': 'attachment; filename="resume.pdf"', 'X-Request-Id': 'fixture-pdf' },
  });
  return;
}
const P2parse = /^\/api\/v1\/me\/resume-files\/([^/]+)\/parse$/.exec(path);
if (P2域 && P2parse && method === 'POST') {
  const item = P2域.items.find((candidate) => candidate.file_id === P2parse[1]);
  P2要求(item);
  P2要求((请求.headers()['idempotency-key'] ?? '') !== '');
  P2要求(JSON.stringify(body) === JSON.stringify({
    version_id: item.current_version.version_id, processing_consent_confirmed: true,
  }));
  item.current_version.parse = { status: 'pending', updated_at: P2时间 };
  P2域.列表读取次数 = 0;
  P2域.写入次数 += 1;
  await route.fulfill({ status: 202, json: 信封(item.current_version.parse) });
  return;
}
const P2file = /^\/api\/v1\/me\/resume-files\/([^/]+)$/.exec(path);
if (P2域 && P2file && method === 'DELETE') {
  const index = P2域.items.findIndex((candidate) => candidate.file_id === P2file[1]);
  P2要求(index >= 0);
  P2要求(请求.headers()['if-match'] === `"${P2域.items[index].revision}"`);
  P2域.items.splice(index, 1);
  P2域.写入次数 += 1;
  await route.fulfill({ status: 200, json: 信封({ deleted: true }) });
  return;
}
```

预览测试用 `page.waitForRequest((request) => new URL(request.url()).pathname === '/api/v1/me/resume-files/rf_1/content')`，不依赖 headless PDF viewer 页面内容。

只有 Playwright 负责真实布局门。Backend journey 到 `/#/resume` 后，在弹层尚未打开时加入：

```ts
const 附件标题 = page.getByTestId('附件简历标题');
const 基本标题 = page.getByText('基本信息', { exact: true });
const 附件后继 = 附件标题.locator('xpath=following-sibling::*[1]');
const 基本后继 = 基本标题.locator('xpath=following-sibling::*[1]');
const [附件框, 基本框, 附件后继框, 基本后继框] = await Promise.all([
  附件标题.boundingBox(), 基本标题.boundingBox(), 附件后继.boundingBox(), 基本后继.boundingBox(),
]);
if (!附件框 || !基本框 || !附件后继框 || !基本后继框) throw new Error('resume title geometry is unavailable');
expect(Math.abs(附件框.height - 基本框.height)).toBeLessThanOrEqual(1);
const 附件下间距 = 附件后继框.y - (附件框.y + 附件框.height);
const 基本下间距 = 基本后继框.y - (基本框.y + 基本框.height);
expect(Math.abs(附件下间距 - 基本下间距)).toBeLessThanOrEqual(1);
await expect(page.getByRole('progressbar')).toHaveCount(0);
await expect(page.locator('[class*="骨架"], [class*="badge"]')).toHaveCount(0);
```

另记录第一行在关闭滑动态的 `boundingBox().height`；完成 replace/轮询后再次断言同一行高度差不超过 1px。视觉场景若已有 `/student` 与 `/resume` 稳定定位则不改 `场景.ts`；只有定位缺失才加 `data-testid` locator，不更新截图、不改阈值、不设置 `UI_CHANGE_APPROVED=true`。

- [ ] **Step 4: Run focused E2E GREEN**

Run: `npm run test:e2e:data-source -- --grep "Backend candidate owns PDF library|failed resume parse"`

Expected: PASS，fixture 明确观察到 consent/CAS/idempotency/download/polling；无真实后端和共享环境写入。

- [ ] **Step 5: Run the authoritative plan-scope gate**

本仓库没有 `affected --keep-going` 或 service-level owner runner；唯一覆盖本前端 package 的正式本地入口是 package scripts。因此本 Plan 的 authoritative plan-scope gate 只运行一次以下组合，不能再加一份重复的“完整 service”假门：

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm run test:e2e:data-source
UI_VISUAL_GATE=required UI_CHANGE_APPROVED=false npm run ui:check -- --base origin/main
```

Expected: Vitest 全绿；typecheck/lint/build exit 0；data-source Playwright 全绿；UI gate 为 PASS 且无未批准差异。若 Chrome/Playwright 基础设施缺失，记录 BLOCKED 和原始错误，不能称 PASS；若 UI gate 报 diff，恢复几何或 Mock 分支，不更新基线、不放宽阈值。

- [ ] **Step 6: Record evidence and commit Task 7**

把实际命令、candidate SHA、suite counts、duration、UI verdict 写进 commit message body 或执行 Handoff 草稿；不要把临时日志/截图失败产物 commit。若任一测试 invocation 总时长 ≥600 秒、任一 suite ≥300 秒、或 selection 报 unknown/global-review warning，按 workflow 的 `performance_observations` schema 记录为 `non_blocking:true`。

```bash
git add e2e/数据源模式.spec.ts e2e/视觉回归/场景.ts
git commit -m "test: cover resume file backend journey"
git status --short
```

Expected: commit 成功；`git status --short` 为空。若 `场景.ts` 没有变化，不得为了匹配命令制造空改动。

## Terminal Integration Task: Review, final candidate verification, and handoff

**Entry gate:** Tasks 1–7 均完成；树干净；Task 7 的 authoritative plan-scope evidence 与当前 candidate SHA 完全匹配；已调用异构 Claude code review（FEATURE_BRANCH_REVIEW，最多三轮），每条 finding 经过 `superpowers:receiving-code-review` 核验，代码修复遵守 TDD，并已提交。若 review 修复让 Task 7 evidence 失效，先精确重跑受影响测试；无法证明六维 fingerprint 一致时，重新运行唯一 plan-scope gate。

**Integration scope:** 单 Plan，因此本 Task 是唯一 rolling integration owner。它不新增产品代码，不修改发布配置；只同步最新目标、形成最终组合 candidate、运行最终集成验证、归档证据，并在人工 final gate 后按用户授权 push/merge。

- [ ] **Step 1: Freeze candidate and produce structured handoff draft**

```bash
git status --short
git rev-parse HEAD
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Stop conditions: tree 非空、存在范围外文件、任何 Task commit 缺失、review 仍有 required finding、或 authoritative evidence 不属于当前 HEAD。Handoff 草稿必须列出：`candidate_commit`、`base_commit`、Spec/Plan 路径、commits、tests_run（command/verdict/duration/receipt）、visual verdict、known backend public OpenAPI drift、performance observations、remaining optional findings（应为空或有明确拒绝理由）。

- [ ] **Step 2: Synchronize target without rewriting published work**

```bash
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
```

若第二条 exit 0，继续。若 exit 1，先在当前 feature worktree 执行 `git rebase origin/main`，解决冲突后把新 HEAD 视为全新 candidate；所有 mutation/E2E/UI evidence 失效，必须重跑 Step 3 全套。禁止 `git reset --hard`、强推或丢弃用户改动。

- [ ] **Step 3: Run final integration verification on the exact candidate**

这是 target 同步后的最终组合验证，不消费同步前的 PASS：

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm run test:e2e:data-source
UI_VISUAL_GATE=required UI_CHANGE_APPROVED=false npm run ui:check -- --base origin/main
git status --short
git rev-parse HEAD
```

Expected: 所有命令 exit 0；普通与 data-source Playwright 全绿；UI gate 无未批准漂移；树为空；末尾 SHA 与 Handoff `candidate_commit` 相同。共享正式后端不是 P2 前端实现验收的前置条件；正式联调属于 release handoff，需后端先补 public OpenAPI consent schema/description 并提供可用 stg candidate account。

- [ ] **Step 4: Human final gate and delivery**

向用户提交完整 Handoff，不自行扩展权限。必须明确：本地隔离证据、是否有基础设施 BLOCKED、Mock 视觉 verdict、后端 OpenAPI 漂移仍待补、未执行解析正文/自动预填。只有用户明确授权后才 push、开 PR 或 merge；执行授权动作后报告远端 branch/PR/merge commit。若用户未授权，停在干净本地 feature branch，并给新的执行/集成 session 可直接复制的 prompt：读取 Spec、Plan、Handoff，从 Terminal Integration Task 的人工 gate 继续。
