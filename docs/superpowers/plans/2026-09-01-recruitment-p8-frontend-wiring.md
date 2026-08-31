# Recruitment P8 Frontend Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended in the same session) or `superpowers:executing-plans` (in a fresh session) to implement this plan task-by-task. Use `superpowers:test-driven-development` for every product change and `superpowers:verification-before-completion` before claiming completion. Keep the checkboxes current.

**Goal:** 在 Backend 模式把 P8 的账号安全、手机号换绑、退出其他设备、数据导出、招聘账号注销、普通反馈与上下文举报接到 `release/0.2.5` 的真实控制面，同时逐字保留 PM 已定稿的前端视觉；唯一批准的新视觉是账号安全页的一行“导出我的数据”。

**Architecture:** 新增第十三个严格招聘数据源 facade、subject-scoped 导出恢复句柄、独立 P8 内存 owner 与带 subject/session/scope fence 的操作层。现有页面仍是视觉壳：Mock 路径原样保留，Backend 路径只替换数据和动作；所有真实写入服务端先行，未知结果复用原 Idempotency-Key，失败绝不回退 Mock。

**Tech Stack:** React 19、TypeScript 6、React Router 7、Vite 8、Vitest 4、Testing Library、Playwright 1.62、浏览器 `localStorage` / Page Visibility API。

**Spec:** `docs/superpowers/specs/2026-08-31-recruitment-p8-frontend-wiring-design.md`

## Global Constraints

- 产品代码冻结基线是 `659de17be7aac4797bd572228179aedfc5768ae3`；其后的 `20e5bd49` 与 `4df9d192` 只应是 P8 设计文档。Task 0 必须审计 File Map 漂移，不能在未知产品改动上照抄本 Plan。
- 后端合同固定为 `agxp-monorepo release/0.2.5@897468e5221f0078533178a28119bb259dbb676e`。如果 `origin/release/0.2.5` 前移，立即 STOP 并重新校准 Spec/Plan；不得静默跟随新 SHA。
- 不修改后端仓库。Task 0 只读取最终 OpenAPI、canonical L3 catalog 和运行证据。
- 不修改现有 CSS。只有在现有 class 无法表达“导出我的数据”行时才允许提出单独的视觉变更请求；未获批准前不得改 `.module.css`。
- 不重排页面、卡片、按钮、弹层、色彩、字号、间距、动效或操作层级。账号安全页只允许在注销按钮前插入一组复用现有 `.卡/.行` 的数据行。
- Mock 模式不得发任何 P8 HTTP 请求、不得读写 P8 导出恢复句柄，现有四位验证码、本地换绑、本地举报和本地注销演示行为保持不变。
- Backend 失败不回退 Mock；不得继续显示固定手机号、`iPhone · 上海`、固定工单号或本地假成功。
- 全产品验证码位数继续使用 `src/数据/验证码规则.ts` 的 `短信验证码位数 === 4`。OpenAPI complete 示例里的六位字符串不是 schema 约束，不得另造 P8 位数常量。
- 浏览器不能手写 `Origin`（受限请求头）；所有 P8 写操作使用同源相对 URL，由浏览器自动发送 Origin。浏览器验收要在真实 Request 上检查 Origin，而不是给 `BFF请求选项` 增加伪字段。
- 所有 P8 JSON GET 使用 `不缓存: true`；所有 P8 JSON 请求使用 opt-in 严格 envelope 校验。download 不经过 JSON 客户端、不缓冲 ZIP、不建 Blob/Object URL。
- Idempotency-Key 只由 `crypto.randomUUID()` 铸造；复合意图字符串只作内存 Map key，绝不能作为网络 header。`operation_outcome_unknown` / `idempotency_in_progress` / mutation 网络未知只允许原 key + 原 body 重试。
- 账号资源按 `subject_id + session generation` 隔离，不按 candidate/recruiter 复制。同主体切角色可以保留已确认快照，但必须使旧在飞结算过时；换主体、logout、401、注销成功清 P8 内存与待定意图。
- 普通 logout/401 保留当前主体 namespaced 的导出恢复句柄；注销 202、export 404/expired 和用户明确废弃失败任务才删除它。新主体不得读取或覆盖旧主体句柄。
- 每个 Task 顺序执行：先写测试并观察 RED，再做最小实现、跑定向 PASS、提交。不要把多个 Task 压成一个提交。

## Zero-Context Contract

### Domain types

```ts
export interface P8Credential {
  credentialId: string;
  provider: 'phone_otp' | 'wechat' | 'email_otp';
  display: string;
  verifiedAt: string;
}

export interface P8Session {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export interface P8ReplacementAttempt {
  attemptId: string;
  nextAction: {
    type: 'enter_code';
    expiresAt: string | null;
    retryAfterSeconds: number | null;
  };
}

export interface P8ReplacementResult {
  credential: P8Credential;
  revokedSessions: number;
  unchanged: boolean;
}

export interface P8DataExport {
  exportId: string;
  status: 'queued' | 'running' | 'ready' | 'failed' | 'expired';
  createdAt: string;
  expiresAt: string | null;
  downloadReady: boolean;
}

export interface P8AccountDeletion {
  deletionId: string;
  status: 'deletion_pending' | 'retention' | 'deleted';
  retentionUntil: string;
}

export type P8FeedbackCategory = 'bug' | 'suggestion' | 'other';
export type P8ReportReason =
  | 'false_information'
  | 'salary_misrepresentation'
  | 'harassment'
  | 'other';
export type P8ReportTarget =
  | { type: 'job'; ref: string }
  | { type: 'match_case'; ref: string }
  | { type: 'conversation'; ref: string };

export interface P8FeedbackReceipt {
  ticketId: string;
  status: 'received' | 'reviewing' | 'resolved' | 'dismissed';
}

export interface P8ReportReceipt extends P8FeedbackReceipt {
  blockStatus: 'applied' | 'not_requested';
}
```

Wire stays snake_case in `src/数据/BFF契约.ts`; only `src/数据/招聘数据源/P8控制面.ts` maps it to these camelCase types. `export_id` must match `^exp_[0-9a-f]{32}$`; `deletion_id` must match `^del_[0-9a-f]{32}$`; session/credential/attempt/target ref use the released `minLength: 1`. `ticket_id` is only `type: string` in the release contract—do not claim a pattern or minLength that OpenAPI does not publish.

### Exact request surface

| Method/path | Exact body | Success | Closed non-generic branches |
|---|---|---|---|
| `GET /api/v1/security/sessions` | none | 200 | 401; 503 identity unavailable |
| `DELETE /api/v1/security/sessions/others` | none + key | 200 | 409 idempotency conflict/in-progress; 503 identity unavailable/outcome unknown |
| `GET /api/v1/me/credentials` | none | 200 | 401; 503 identity unavailable |
| `POST /api/v1/me/credential-replacement-attempts` | `{phone}` + key | 200 | 409 idempotency conflict/in-progress; 429; 503 identity unavailable/outcome unknown |
| `POST /api/v1/me/credential-replacement-attempts/{attempt_id}/complete` | `{proof:{code}}` + key | 200 | 409 replacement/idempotency conflict/in-progress; 503 identity unavailable/outcome unknown |
| `POST /api/v1/me/data-exports` | **no body** + key | 202 | 409 export in progress/idempotency conflict; 503 identity/recruitment unavailable/outcome unknown |
| `GET /api/v1/me/data-exports/{export_id}` | none | 200 | 404 data export not found; 503 identity/recruitment unavailable |
| `GET /api/v1/me/data-exports/{export_id}/download` | browser navigation | ZIP 200 | 404; 409 export in progress; 503 read unavailable |
| `POST /api/v1/me/account-deletion` | exact `{}` + key | 202 | 409 export in progress; 503 recruitment unavailable/outcome unknown |
| `POST /api/v1/compliance/feedback` | `{category,details}` + key | 202 | 409 idempotency conflict; 429 without Retry-After; 503 mutation unavailable/outcome unknown |
| `POST /api/v1/compliance/reports` | `{target,reason,also_block}` + key; omit `details` in P8 UI | 202 | 404 target not found; 409 block unavailable/idempotency conflict; 429 without Retry-After; 503 mutation unavailable/outcome unknown |

Generic 400/401/403 remain endpoint-specific as published. The facade catches `BFF错误` and validates `status + code` against a per-method allowlist; an unlisted combination becomes `invalid_response`. UI never displays raw English backend messages.

### State, recovery and operation surface

```ts
export interface P8资源快照<T> {
  phase: 'idle' | 'loading' | 'success' | 'error';
  refreshing: boolean;
  data: T | null;
  error: string | null;
  generation: number;
}

export interface P8控制面状态 {
  credentials: P8资源快照<P8Credential[]>;
  sessions: P8资源快照<P8Session[]>;
  dataExport: P8资源快照<P8DataExport>;
}

export interface P8导出恢复句柄 {
  subjectId: string;
  createKey: string;
  exportId: string | null;
  storedAt: string;
}

export interface P8账号控制面操作 {
  设置P8账号范围(visible: boolean): void;
  加载P8凭证(force?: boolean): Promise<void>;
  加载P8会话(force?: boolean): Promise<void>;
  开始P8手机号换绑(phone: string): Promise<P8ReplacementAttempt>;
  完成P8手机号换绑(attemptId: string, code: string): Promise<P8ReplacementResult>;
  退出P8其他设备(): Promise<number>;
  恢复P8数据导出(): Promise<void>;
  创建P8数据导出(): Promise<void>;
  刷新P8数据导出(): Promise<void>;
  废弃P8数据导出(): void;
  取P8数据导出下载地址(): `/api/v1/me/data-exports/${string}/download` | null;
  请求P8账号注销(): Promise<P8AccountDeletion>;
}

export interface P8合规操作 {
  提交P8反馈(category: P8FeedbackCategory, details: string): Promise<P8FeedbackReceipt>;
  提交P8举报(target: P8ReportTarget, reason: P8ReportReason, alsoBlock: boolean): Promise<P8ReportReceipt>;
}

export type P8控制面操作 = P8账号控制面操作 & P8合规操作;
```

`设置P8账号范围` controls only UI visibility and late-toast suppression. Shared account snapshots may still commit after unmount only when subject/session fences remain valid. Task 3 first composes `P8账号控制面操作`; Tasks 6–7 add the two `P8合规操作` methods test-first, after which `应用操作` carries the final intersection. Report source refresh is a screen callback after a confirmed receipt; the report operation never guesses whether the target came from P4, P5 or P7.

## File Map

| Responsibility | Files |
|---|---|
| Strict transport/facade | `src/数据/HTTP客户端.ts`, `src/数据/BFF契约.ts`, new `src/数据/招聘数据源/P8控制面.ts`, `src/数据/HTTP招聘数据源.ts`, `src/测试/BFF样本.ts` and tests |
| Export recovery | new `src/数据/P8导出恢复.ts` and test |
| Runtime owner | new `src/状态/后端/P8控制面操作.ts`, new `src/状态/后端/useP8导出轮询.ts`, `src/状态/后端/类型.ts`, `src/状态/应用状态.tsx`, `src/状态/后端/会话操作.ts` and tests |
| Account UI | `src/屏幕/账号安全.tsx`, `src/屏幕/账号安全.test.tsx`, `src/屏幕/设置.tsx`, `src/屏幕/设置.test.tsx`; regression coverage for `src/屏幕/企业设置.tsx` |
| Feedback | `src/屏幕/反馈.tsx`, new `src/屏幕/反馈.test.tsx` |
| Context reports | `src/组件/举报层.tsx`, new `src/组件/举报层.test.tsx`, `src/屏幕/职位详情.tsx`, `src/屏幕/职位详情.test.tsx`, `src/屏幕/P7/Backend真人会话.tsx`, its test, `src/屏幕/直聊会话.tsx` and test |
| Acceptance/visual | `e2e/数据源模式.spec.ts`, `e2e/视觉回归/场景.ts`, `docs/DEV_LOG.md` |

---

### Task 0: Re-admit the Frozen Frontend and Backend Baselines

**Files:**

- Read: this Plan and the Spec
- Read: every existing path in the File Map
- Read in `/Users/visionclaw/agxp-monorepo`: final OpenAPI, L3 catalog and runner
- Modify: none

**Interfaces:** Produces a written PASS/STOP verdict, exact SHAs and a backend L3 receipt; no product artifact.

- [ ] **Step 1: Verify the frontend branch and ancestry**

```bash
git branch --show-current
git status --short
git rev-parse HEAD
git merge-base --is-ancestor 659de17be7aac4797bd572228179aedfc5768ae3 HEAD
git log --oneline --decorate -6
```

Expected: dedicated implementation branch, clean worktree, ancestry exit 0.

- [ ] **Step 2: Audit File Map drift since the product baseline**

```bash
git diff --name-status 659de17be7aac4797bd572228179aedfc5768ae3..HEAD -- \
  src/数据 src/状态 src/屏幕/账号安全.tsx src/屏幕/设置.tsx \
  src/屏幕/企业设置.tsx src/屏幕/反馈.tsx src/组件/举报层.tsx \
  src/屏幕/职位详情.tsx src/屏幕/P7/Backend真人会话.tsx \
  src/屏幕/直聊会话.tsx e2e/数据源模式.spec.ts e2e/视觉回归/场景.ts
```

Expected at handoff: no product-file diff. If product files changed, inspect each and STOP on a contract or visual conflict; never overwrite newer work.

- [ ] **Step 3: Fetch and freeze the release SHA**

```bash
git -C /Users/visionclaw/agxp-monorepo fetch origin release/0.2.5
git -C /Users/visionclaw/agxp-monorepo rev-parse origin/release/0.2.5
git -C /Users/visionclaw/agxp-monorepo show --no-patch --oneline \
  897468e5221f0078533178a28119bb259dbb676e
```

Expected: `origin/release/0.2.5` equals the exact 40-character SHA. Any other value is STOP/recalibrate.

- [ ] **Step 4: Reconfirm all public contract anchors from that SHA**

```bash
git -C /Users/visionclaw/agxp-monorepo show \
  897468e5221f0078533178a28119bb259dbb676e:apps/recruitment-bff/openapi/mobile-v1.yaml \
  | rg -n "/api/v1/security/sessions|/api/v1/me/credentials|credential-replacement-attempts|/api/v1/me/data-exports|/api/v1/me/account-deletion|/api/v1/compliance/(feedback|reports)|\\^exp_|\\^del_|ComplianceRateLimited"

git -C /Users/visionclaw/agxp-monorepo show \
  897468e5221f0078533178a28119bb259dbb676e:tests/l3/recruitment-mobile-local-cases.json \
  | rg -n "account-security|compliance-intake|typed-report|report-evidence|data-export|object-lifecycle|portable-copy|account-deletion|account-retention|product-re-registration"
```

Expected: every anchor appears in the single release commit. Manually re-read request bodies, required/optional fields, response codes and `Retry-After` headers against the table above.

- [ ] **Step 5: Run the canonical backend release anchor and record evidence**

```bash
cd /Users/visionclaw/agxp-monorepo
tools/test global recruitment-mobile-local
```

Expected: PASS with receipt. A Docker/toolchain precondition may produce BLOCKED/exit 75; record it honestly and STOP implementation until a valid PASS receipt exists. Do not substitute `--case` or frontend route fixtures for the full release anchor.

### Task 1: Add the Strict P8 Control-Plane Facade

**Files:**

- Modify: `src/数据/HTTP客户端.ts`
- Modify: `src/数据/HTTP客户端.test.ts`
- Modify: `src/数据/BFF契约.ts`
- Create: `src/数据/招聘数据源/P8控制面.ts`
- Create: `src/数据/招聘数据源/P8控制面.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`
- Modify if fixtures are shared: `src/测试/BFF样本.ts`

**Interfaces:** Produces the Domain types and this facade:

```ts
export interface P8控制面数据源 {
  读取P8凭证(): Promise<P8Credential[]>;
  读取P8会话(): Promise<P8Session[]>;
  开始P8手机号换绑(phone: string, key: string): Promise<P8ReplacementAttempt>;
  完成P8手机号换绑(attemptId: string, code: string, key: string): Promise<P8ReplacementResult>;
  退出P8其他设备(key: string): Promise<number>;
  创建P8数据导出(key: string): Promise<P8DataExport>;
  读取P8数据导出(exportId: string): Promise<P8DataExport>;
  取P8数据导出下载地址(exportId: string): `/api/v1/me/data-exports/${string}/download`;
  请求P8账号注销(key: string): Promise<P8AccountDeletion>;
  提交P8反馈(category: P8FeedbackCategory, details: string, key: string): Promise<P8FeedbackReceipt>;
  提交P8举报(target: P8ReportTarget, reason: P8ReportReason, alsoBlock: boolean, key: string): Promise<P8ReportReceipt>;
}
```

- [ ] **Step 1: Write opt-in strict-envelope RED tests**

Add `严格信封?: true` to `BFF请求共同选项`, but first test the behavior. It must accept exactly `{result,meta:{request_id,api_version:'v1'}}` and reject missing/extra root keys, missing/extra meta keys, empty request ID, wrong API version and trailing/non-JSON content. Existing callers without the option keep current behavior.

```ts
await expect(client.请求({ path: '/api/v1/me/credentials', 严格信封: true }))
  .rejects.toMatchObject({ code: 'invalid_response' });
```

- [ ] **Step 2: Write decoder RED tests**

Cover one valid fixture for every response. Reject missing/extra keys, unknown enums, invalid RFC3339, unsafe/negative counts, duplicate session/credential IDs, zero/multiple `current=true`, multiple `phone_otp`, bad export/deletion patterns and unknown report target branches; zero `phone_otp` is valid and renders “未绑定”. Exercise every export status/downloadReady combination without rejecting it solely for the combination; only the derived UI rule `ready && downloadReady` enables download. `LinkNextAction` accepts only `enter_code`; absent `expires_at`/`retry_after_seconds` maps to null, present values must be valid.

```ts
expect(解P8会话({ sessions: [当前会话, 其他会话] })).toHaveLength(2);
expect(() => 解P8会话({ sessions: [{ ...当前会话, current: false }] })).toThrow();
expect(解P8换绑尝试({ attempt_id: 'att_1', next_action: { type: 'enter_code' } }))
  .toMatchObject({ nextAction: { expiresAt: null, retryAfterSeconds: null } });
expect(() => 解P8导出({ ...导出Wire, export_id: 'exp_bad' })).toThrow();
```

Do not add a ticket ID pattern/minLength test; only assert it is a string and exact-key decoding holds.

- [ ] **Step 3: Write exact request-shape and error-union RED tests**

```ts
await source.创建P8数据导出('p8-export-key-0001');
expect(请求).toHaveBeenCalledWith({
  path: '/api/v1/me/data-exports', method: 'POST',
  幂等: true, 幂等键: 'p8-export-key-0001', 严格信封: true,
}); // no body property

await source.请求P8账号注销('p8-delete-key-0001');
expect(请求).toHaveBeenCalledWith({
  path: '/api/v1/me/account-deletion', method: 'POST', body: {},
  幂等: true, 幂等键: 'p8-delete-key-0001', 严格信封: true,
});

await source.提交P8举报({ type: 'conversation', ref: '3003' }, 'harassment', true, 'p8-report-key-0001');
expect(请求).toHaveBeenCalledWith({
  path: '/api/v1/compliance/reports', method: 'POST',
  body: { target: { type: 'conversation', ref: '3003' }, reason: 'harassment', also_block: true },
  幂等: true, 幂等键: 'p8-report-key-0001', 严格信封: true,
});
```

Assert GETs use `不缓存:true`; replacement complete uses the imported four-digit rule in its caller but the facade only requires non-empty proof; path IDs are validated then `encodeURIComponent` encoded once; the download URL is same-origin. For each endpoint inject every allowed error and one impossible `status+code`, expecting the latter to become `invalid_response`.

- [ ] **Step 4: Run RED**

```bash
npx vitest run src/数据/HTTP客户端.test.ts src/数据/招聘数据源/P8控制面.test.ts src/数据/HTTP招聘数据源.test.ts
```

Expected: FAIL because strict envelope and P8 facade do not exist.

- [ ] **Step 5: Implement the minimum closed decoder/facade**

Keep guards local to `P8控制面.ts`; do not introduce a validator library. Extend `创建HTTP招聘数据源` with `...创建P8控制面数据源(请求)`. Strict envelope is opt-in and must not change existing request snapshots.

```ts
function P8契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', '服务返回了不符合契约的账号控制面数据');
}

function 校验P8错误(endpoint: P8端点, error: unknown): never {
  if (!(error instanceof BFF错误)) throw error;
  if (error.status === 0 || error.code === 'invalid_response') throw error;
  if (!P8错误表[endpoint].some(([status, code]) => status === error.status && code === error.code)) {
    throw P8契约错误();
  }
  throw error;
}
```

- [ ] **Step 6: Run PASS and commit**

```bash
npx vitest run src/数据/HTTP客户端.test.ts src/数据/招聘数据源/P8控制面.test.ts src/数据/HTTP招聘数据源.test.ts
npm run typecheck
git add src/数据/HTTP客户端.ts src/数据/HTTP客户端.test.ts src/数据/BFF契约.ts \
  src/数据/招聘数据源/P8控制面.ts src/数据/招聘数据源/P8控制面.test.ts \
  src/数据/HTTP招聘数据源.ts src/数据/HTTP招聘数据源.test.ts src/测试/BFF样本.ts
git commit -m "feat: add strict P8 control-plane data source"
```

If `src/测试/BFF样本.ts` is unchanged, omit it from `git add`.

### Task 2: Add the Subject-Scoped Export Recovery Store

**Files:**

- Create: `src/数据/P8导出恢复.ts`
- Create: `src/数据/P8导出恢复.test.ts`

**Interfaces:**

```ts
export interface P8导出恢复存储 {
  读取(subjectId: string): P8导出恢复句柄 | null;
  写入(handle: P8导出恢复句柄): void;
  删除(subjectId: string): void;
}

export function 创建P8导出恢复存储(input: {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  environment: 'local' | 'stg';
  now?: () => string;
}): P8导出恢复存储;
```

- [ ] **Step 1: Write strict-storage RED tests**

Prove one physical key per environment+subject, A/B isolation, exact-key JSON, valid UUID-like visible ASCII create key, export ID null-or-pattern, RFC3339 `storedAt`, corrupt/extra/mismatched-subject values discarded and removed, and both unavailable storage (`storage: null`) and storage exceptions fail closed without crashing the page. With unavailable storage, reads return `null` and writes/deletes are no-ops.

```ts
存储.写入({ subjectId: 'sub_A', createKey: 'p8-export-key-0001', exportId: null, storedAt: 时间 });
expect(存储.读取('sub_A')?.createKey).toBe('p8-export-key-0001');
expect(存储.读取('sub_B')).toBeNull();
```

Assert the serialized value never contains phone, credential, session, ticket, report details, ZIP bytes, object key or download URL fields.

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/数据/P8导出恢复.test.ts
```

- [ ] **Step 3: Implement a minimal namespaced adapter**

Use a key such as `agxp:recruitment:${environment}:p8:data-export:${encodeURIComponent(subjectId)}`. JSON parse is strict; a bad entry is deleted. Do not enumerate storage or keep a cross-subject index.

- [ ] **Step 4: Run PASS and commit**

```bash
npx vitest run src/数据/P8导出恢复.test.ts
git add src/数据/P8导出恢复.ts src/数据/P8导出恢复.test.ts
git commit -m "feat: add P8 export recovery store"
```

### Task 3: Add the Fenced P8 Runtime Owner and Account Operations

**Files:**

- Create: `src/状态/后端/P8控制面操作.ts`
- Create: `src/状态/后端/P8控制面操作.test.ts`
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/后端/会话操作.test.ts`

**Interfaces:** Adds `P8控制面状态` and the `P8账号控制面操作` subset from the Zero-Context Contract plus runtime refs. Feedback/report are deliberately absent until their RED tests in Tasks 6–7.

```ts
export interface P8待定意图<T> {
  key: string;
  request: T;
}

export interface P8运行时引用 {
  P8范围代际: 可变引用<number>;
  P8账号可见: 可变引用<boolean>;
  P8读取锁: 可变引用<Map<'credentials' | 'sessions' | 'export', Promise<void>>>;
  P8待定意图: 可变引用<Map<string, P8待定意图<unknown>>>;
}
```

- [ ] **Step 1: Write read-owner RED tests**

Cover credentials/sessions parallel first load, independent settlement, force refresh preserving old successful data, single-flight, duplicate caller joining one Promise, and stale success/failure after unmount, subject change or session generation change. A settings-only credential read must make zero session calls.

```ts
const run = 操作.加载P8会话(true);
会话代际.current += 1;
会话请求.resolve([当前会话]);
await run;
expect(状态().sessions.data).toBeNull();
```

Test the derived invariants: unique masked phone, current session and other-session count come only from decoded snapshots; there is no device/location fallback.

- [ ] **Step 2: Write immutable-intent RED tests**

Cover begin/complete independent keys, 4-digit proof, revoke-others same-key replay, network/unknown/in-progress retaining the exact key+request, success/terminal conflict clearing the intent, changed phone/new attempt creating a new key, and duplicate clicks joining a single in-flight Promise.

```ts
await expect(操作.退出P8其他设备()).rejects.toMatchObject({ code: 'operation_outcome_unknown' });
await 操作.退出P8其他设备();
expect(后端.退出P8其他设备.mock.calls[0][0])
  .toBe(后端.退出P8其他设备.mock.calls[1][0]);
expect(后端.退出P8其他设备.mock.calls[0][0]).toMatch(/^[!-~]{16,128}$/);
```

Assert Chinese intent coordinates never reach the data source key argument. Complete success must force-refresh both credentials and sessions before resolving; no optimistic masked phone is written.

- [ ] **Step 3: Write cleanup and cross-role RED tests**

Logout, 401, provider unmount and subject A→B must clear all three P8 snapshots, locks and pending intents and invalidate late settlements. Same-subject candidate↔recruiter role switch preserves confirmed account snapshots but increments the P8 fence and clears pending mutation intents. Ordinary logout must not delete the export recovery handle.

Add P5/P7 regression assertions: extending `清账号状态` with P8 must still clear P7 refs, P5 leases via the existing subject effect, privacy, rules, discovery and attachments exactly once.

- [ ] **Step 4: Run RED**

```bash
npx vitest run src/状态/后端/P8控制面操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
```

- [ ] **Step 5: Implement state factories, fences and operation composition**

```ts
export function 创建空P8控制面状态(): P8控制面状态 {
  const 空 = <T>(): P8资源快照<T> => ({
    phase: 'idle', refreshing: false, data: null, error: null, generation: 0,
  });
  return { credentials: 空<P8Credential[]>(), sessions: 空<P8Session[]>(), dataExport: 空<P8DataExport>() };
}

function 捕获Fence(deps: 后端操作依赖) {
  return {
    subject: deps.主体标识引用.current,
    session: deps.会话代际.current,
    scope: deps.P8范围代际!.current,
  };
}
```

Add refs once in `应用状态提供者`, inject them through `后端操作依赖`, spread `创建P8控制面操作(deps)` into `应用操作`, seed `创建空P8控制面状态()`, and extend the existing account cleanup path. P8's Provider cleanup key is subject-only, not `subject+role`; role switching uses an explicit fence bump so confirmed shared data is retained.

Use a closed P8 error mapper in this module. Map each known code to fixed Chinese copy; unknown `BFF错误.message` is never shown. A current-session 401 calls `清账号状态` and rethrows for the screen to navigate through the existing login recovery path.

- [ ] **Step 6: Run PASS and commit**

```bash
npx vitest run src/状态/后端/P8控制面操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
npm run typecheck
git add src/状态/后端/P8控制面操作.ts src/状态/后端/P8控制面操作.test.ts \
  src/状态/后端/类型.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts \
  src/状态/后端/会话操作.ts src/状态/后端/会话操作.test.ts
git commit -m "feat: add fenced P8 account runtime"
```

### Task 4: Wire Credentials, Sessions, Replacement and Revoke into the Existing Account UI

**Files:**

- Modify: `src/屏幕/账号安全.tsx`
- Modify: `src/屏幕/账号安全.test.tsx`
- Modify: `src/屏幕/设置.tsx`
- Modify: `src/屏幕/设置.test.tsx`
- Test only unless a regression requires it: `src/屏幕/企业设置.tsx`
- Create if absent: `src/屏幕/企业设置.test.tsx`

**Interfaces:** No new route or CSS. Existing account/security JSX remains the visual shell; Backend reads `后端状态.credentials/sessions` and invokes Task 3 operations.

- [ ] **Step 1: Write Mock-preservation RED tests before moving code**

Freeze the current DOM/classes and behaviors: fixed Mock phone, device line, four-digit drawer, arbitrary four-digit local success, local revoke prompt and local navigation on deletion. Assert zero P8 operation calls in Mock.

```tsx
expect(screen.getByText('138 **** 6021')).toBeTruthy();
expect(screen.getByText('iPhone · 上海 · 今天 09:12')).toBeTruthy();
expect(mock操作.加载P8凭证).not.toHaveBeenCalled();
```

- [ ] **Step 2: Write Backend account RED tests**

Cover mount registering scope and parallel reads; masked display with no client remasking; neutral loading/error placeholders; current session creation/expiry time and other count; no `iPhone/上海/IP/UA`; disabled actions without authoritative snapshots; revoke real count then forced session refresh; begin E.164 phone; four-digit complete; no optimistic phone; conflict/unknown retaining drawer/input; 401 no local success.

```tsx
await user.click(screen.getByRole('button', { name: '确认换绑' }));
expect(mock操作.完成P8手机号换绑).toHaveBeenCalledWith('att_1', '1234');
expect(screen.queryByText('+86 139 **** 0001')).toBeNull(); // until refreshed snapshot arrives
```

Assert the input `maxLength`, placeholder and enablement still use `短信验证码位数`, with no six-digit literal anywhere in production.

- [ ] **Step 3: Write settings RED tests**

Candidate Backend settings calls only `加载P8凭证`, shows the server mask or neutral placeholder, and never shows the hard-coded phone. Mock settings remains unchanged. Recruiter settings has no phone row and makes zero P8 reads; account-security navigation remains.

- [ ] **Step 4: Run RED**

```bash
npx vitest run src/屏幕/账号安全.test.tsx src/屏幕/设置.test.tsx src/屏幕/企业设置.test.tsx
```

- [ ] **Step 5: Implement data/action branches without changing the visual tree**

Do not split into two separately maintained copies of the page. Keep the existing JSX/class order and branch only values, disabled flags and handlers. The only Task 4 text changes are authoritative time/count/placeholders and removal of Mock-only “原型任意验证码” wording in Backend mode.

```ts
const 是后端 = 数据源模式 === 'backend';
const 手机凭证 = 后端状态.credentials.data?.find((item) => item.provider === 'phone_otp') ?? null;
const 当前会话 = 后端状态.sessions.data?.find((item) => item.current) ?? null;
const 其他会话数 = 后端状态.sessions.data?.filter((item) => !item.current).length ?? null;
```

On complete success, close the existing drawer only after the operation's authoritative refresh resolves. Do not add spinners, cards, device lists or new CSS.

- [ ] **Step 6: Run PASS, static visual guard and commit**

```bash
npx vitest run src/屏幕/账号安全.test.tsx src/屏幕/设置.test.tsx src/屏幕/企业设置.test.tsx
npm run typecheck
git diff --name-only -- '*.css' '*.module.css'
```

Expected CSS diff: empty.

```bash
git add src/屏幕/账号安全.tsx src/屏幕/账号安全.test.tsx \
  src/屏幕/设置.tsx src/屏幕/设置.test.tsx src/屏幕/企业设置.test.tsx
git commit -m "feat: wire P8 account security UI"
```

### Task 5: Add Export Recovery, Polling, Download and Account Deletion

**Files:**

- Modify: `src/状态/后端/P8控制面操作.ts`
- Modify: `src/状态/后端/P8控制面操作.test.ts`
- Create: `src/状态/后端/useP8导出轮询.ts`
- Create: `src/状态/后端/useP8导出轮询.test.tsx`
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `src/状态/后端/会话操作.test.ts`
- Modify: `src/屏幕/账号安全.tsx`
- Modify: `src/屏幕/账号安全.test.tsx`

**Interfaces:** Completes the export/deletion methods already declared in `P8控制面操作`. `useP8导出轮询` receives explicit dependencies and never reads Context internally:

```ts
export function useP8导出轮询(input: {
  enabled: boolean;
  exportId: string | null;
  status: P8DataExport['status'] | null;
  refresh: () => Promise<void>;
  visibility?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
}): void;
```

- [ ] **Step 1: Write export recovery/operation RED tests**

Cover save-key-before-POST, lost create response replay, null-ID handle replaying POST, non-null ID doing GET only, same-subject logout/relogin recovery, other-subject isolation, create 409 without local handle showing cross-device limitation, 404/expired clearing, failed explicit regeneration using a new key, and deletion clearing the handle.

```ts
await 操作.创建P8数据导出();
expect(恢复存储.写入.mock.invocationCallOrder[0])
  .toBeLessThan(后端.创建P8数据导出.mock.invocationCallOrder[0]);
```

Ready+downloadReady is the only downloadable combination. `取P8数据导出下载地址()` must return null for every other state and must delegate to the strictly validated facade URL.

- [ ] **Step 2: Write polling RED tests with fake timers**

Assert immediate GET on open/revisible; delays 2s, 4s, 8s then capped 10s; status change resets backoff; no overlapping requests; close/unmount/hidden stops timers but not the server job; ready/failed/expired/404 stops; stale settlement after subject/session change is discarded.

```ts
vi.advanceTimersByTime(2_000);
expect(refresh).toHaveBeenCalledTimes(1);
vi.advanceTimersByTime(4_000);
expect(refresh).toHaveBeenCalledTimes(2);
```

- [ ] **Step 3: Write deletion RED tests**

Prove exact `{}` body is already frozen in Task 1; final confirmation is single-flight; export_in_progress keeps both layers open and does not logout; ready-undownloaded warns but allows confirmation; outcome unknown/network unknown keeps the same key and dialog; 202 deletes the current subject handle and invokes unified P4–P8 cleanup before resolving. A subsequent navigation is owned by the screen, not the data source.

The operation may make at most two explicit network-unknown replays at 1s/2s with the same key/body. The HTTP client's own declared `Retry-After` controlled retry remains inside one call; do not mint a second key. Persistent uncertainty throws a fixed P8 unknown error and leaves the intent for manual retry.

- [ ] **Step 4: Write account-page visual/behavior RED tests**

The new DOM is exactly one existing-style group/card/row immediately before the existing delete button:

```tsx
<div className={`${样式.组标} ${样式.组标间距}`}>数据</div>
<div className={样式.卡}>
  <button className={`${样式.行} 可点`}>…导出我的数据…</button>
</div>
```

Cover queued/running/ready/failed/expired states, close/reopen recovery, ready download preflight, no Blob/Object URL, failed regenerate, cross-device 409 copy, deletion warning and success navigation. Mock must not render the new Backend-only row and retains existing local deletion demo.

- [ ] **Step 5: Run RED**

```bash
npx vitest run src/状态/后端/P8控制面操作.test.ts \
  src/状态/后端/useP8导出轮询.test.tsx src/状态/后端/会话操作.test.ts \
  src/状态/应用状态.test.ts src/屏幕/账号安全.test.tsx
```

- [ ] **Step 6: Implement recovery, hook and existing-style UI**

Construct the recovery adapter in Provider from `安全取存储('local')` and the current backend environment; inject it into P8 deps. Never put the handle into React reducer state. Download uses a normal same-origin anchor/navigation after a successful status preflight:

```ts
const href = 操作.取P8数据导出下载地址();
if (href !== null) {
  const link = document.createElement('a');
  link.href = href;
  link.download = '';
  link.click();
}
```

Do not call `请求二进制`, `resp.blob()`, `URL.createObjectURL` or store archive bytes. Reuse existing drawer/confirm classes; no CSS edits.

- [ ] **Step 7: Run PASS and commit**

```bash
npx vitest run src/状态/后端/P8控制面操作.test.ts \
  src/状态/后端/useP8导出轮询.test.tsx src/状态/后端/会话操作.test.ts \
  src/状态/应用状态.test.ts src/屏幕/账号安全.test.tsx
npm run typecheck
git diff --name-only -- '*.css' '*.module.css'
git add src/状态/后端/P8控制面操作.ts src/状态/后端/P8控制面操作.test.ts \
  src/状态/后端/useP8导出轮询.ts src/状态/后端/useP8导出轮询.test.tsx \
  src/状态/后端/类型.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts \
  src/状态/后端/会话操作.ts src/状态/后端/会话操作.test.ts \
  src/屏幕/账号安全.tsx src/屏幕/账号安全.test.tsx
git commit -m "feat: wire P8 export and account deletion"
```

### Task 6: Wire Real Product Feedback without Turning Targetless Text into Reports

**Files:**

- Modify: `src/状态/后端/P8控制面操作.ts`
- Modify: `src/状态/后端/P8控制面操作.test.ts`
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/屏幕/反馈.tsx`
- Create: `src/屏幕/反馈.test.tsx`

**Interfaces:** Adds `P8反馈操作 = Pick<P8合规操作, '提交P8反馈'>` to `应用操作` and implements it with immutable pending intent and the existing page success shell. `提交P8举报` is still absent until Task 7.

- [ ] **Step 1: Write feedback-operation RED tests**

Test the UI→wire table exactly: 功能异常→bug, 体验建议→suggestion, 其他→other. Validate trim then 5–500 Unicode code points with `Array.from`, not UTF-16 length. Success clears the intent; network/operation unknown retains same key+body; 409 idempotency conflict and 429 are terminal and do not auto-retry. Compliance 429 has no `Retry-After`, so no timer is scheduled.

```ts
await 操作.提交P8反馈('bug', '  导出按钮没有响应  ');
expect(后端.提交P8反馈).toHaveBeenCalledWith('bug', '导出按钮没有响应', expect.any(String));
```

- [ ] **Step 2: Write page RED tests for both modes**

Backend product categories submit real feedback, lock category+trimmed body while pending, preserve input on failure/unknown, and show the real `ticketId` on the existing success page. Replace the unsupported 24-hour promise with “我们会尽快核查”. “举报虚假岗位/举报骚扰行为” keep their existing chips/textarea/submit button visual but submit only shows a contextual-entry guide and calls neither feedback nor report.

Mock remains byte-for-byte behaviorally compatible: local success, fixed prototype ticket and current category flow, zero P8 operations.

```tsx
await user.click(screen.getByRole('button', { name: '提交' }));
expect(mock操作.提交P8反馈).toHaveBeenCalledWith('suggestion', '希望增加状态说明');
expect(await screen.findByText(/TICKET-P8-001/)).toBeTruthy();
expect(screen.queryByText(/24 小时/)).toBeNull();
```

- [ ] **Step 3: Run RED**

```bash
npx vitest run src/状态/后端/P8控制面操作.test.ts src/屏幕/反馈.test.tsx
```

- [ ] **Step 4: Implement operation and page branches without markup/CSS redesign**

Keep `分类表`, chip classes, textarea, counter, submit button and success layout. Only branch submit behavior, success copy and ticket value by `数据源模式`. The Backend guide must not invent a new route; it tells the user to report from a concrete job, negotiation or human conversation.

- [ ] **Step 5: Run PASS and commit**

```bash
npx vitest run src/状态/后端/P8控制面操作.test.ts src/屏幕/反馈.test.tsx
npm run typecheck
git diff --name-only -- '*.css' '*.module.css'
git add src/状态/后端/P8控制面操作.ts src/状态/后端/P8控制面操作.test.ts \
  src/状态/后端/类型.ts src/屏幕/反馈.tsx src/屏幕/反馈.test.tsx
git commit -m "feat: wire P8 product feedback"
```

### Task 7: Wire Typed Reports into Existing Job and P7 Conversation Entries

**Files:**

- Modify: `src/状态/后端/P8控制面操作.ts`
- Modify: `src/状态/后端/P8控制面操作.test.ts`
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/组件/举报层.tsx`
- Create: `src/组件/举报层.test.tsx`
- Modify: `src/屏幕/职位详情.tsx`
- Modify: `src/屏幕/职位详情.test.tsx`
- Modify: `src/屏幕/P7/Backend真人会话.tsx`
- Modify: `src/屏幕/P7/Backend真人会话.test.tsx`
- Modify: `src/屏幕/直聊会话.tsx`
- Create if absent: `src/屏幕/直聊会话.test.tsx`

**Interfaces:** Adds `提交P8举报` so `应用操作` now carries the final `P8控制面操作` intersection, and extends the existing report layer props without adding style props:

```ts
interface 属性 {
  对象名: string;
  屏蔽名称: string;
  关闭: () => void;
  target?: P8ReportTarget; // required by Backend callers, absent in Mock
  已确认?: (receipt: P8ReportReceipt) => void | Promise<void>;
  目标失效?: () => void | Promise<void>;
}
```

- [ ] **Step 1: Write report-operation RED tests**

Freeze reason mapping and exact request privacy: only `target`, `reason`, `also_block`; no identity, role, organization, display name, evidence, details or block target. Unknown retains same key and request. `block_unavailable` is terminal, keeps no half-success and lets toggling off create a new key. `report_target_not_found` is a uniform terminal error. 429 preserves UI but schedules no Retry-After countdown.

When a confirmed receipt has `blockStatus='applied'` and current role is candidate, operation performs an authoritative privacy read and commits it through the existing P3 state path. Recruiter mode must not call candidate privacy. Neither mode dispatches `{型:'拉黑'}`.

- [ ] **Step 2: Write shared-layer RED tests**

Mock without target must preserve existing local dispatch/toast/close. Backend with target submits the immutable target, disables reasons/block/submit while pending, closes only on confirmed receipt, never local-dispatches block, keeps open for block_unavailable, and retries with a new key after user unchecks. Target-not-found closes and calls `目标失效`; unknown stays open with original selections.

```tsx
expect(mock操作.提交P8举报).toHaveBeenCalledWith(
  { type: 'job', ref: 'job_001' }, 'false_information', true,
);
expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));
```

Do not add a details textarea: the existing report layer has no approved one.

- [ ] **Step 3: Write source-entry RED tests**

1. Backend job detail uses its authoritative `jobId` as `{type:'job',ref}`. The existing “⋯” and drawer styling stay; add “举报这个职位” alongside the current action. On target-not-found force-refresh the source and close stale layer.
2. Backend P7 page keeps the visual `⋯` span and same class but makes it a keyboard-accessible control (`role="button"`, `tabIndex=0`, Enter/Space handler), opens the same report layer, and passes `{type:'conversation',ref:conversationId}`. Confirmed report force-refreshes that conversation. Do not swap in an unreset native button that changes font/border/background geometry.
3. Backend direct-chat route hides the report button/layer because it has no authoritative P8 target. Mock direct chat remains unchanged.
4. No MatchCase button is added in P8.

Assert object/display/block names never appear in the operation request. Also assert the job's direct-detail path may report with its authoritative job ID even when no recommendation coordinate exists; no P4 recommendation ID is used as the target.

- [ ] **Step 4: Run RED**

```bash
npx vitest run src/状态/后端/P8控制面操作.test.ts src/组件/举报层.test.tsx \
  src/屏幕/职位详情.test.tsx src/屏幕/P7/Backend真人会话.test.tsx \
  src/屏幕/直聊会话.test.tsx
```

- [ ] **Step 5: Implement typed report wiring with the existing DOM/classes**

The component checks `数据源模式`: Mock executes its current local path; Backend requires `target` and calls `操作.提交P8举报`. Do not branch on object names or derive refs from display text.

```tsx
<举报层
  对象名={标题}
  屏蔽名称={副标题}
  target={{ type: 'conversation', ref: conversationId }}
  已确认={() => 操作.读取真人会话(role, conversationId, true)}
  目标失效={() => 操作.读取真人会话(role, conversationId, true)}
  关闭={() => 设举报层开(false)}
/>
```

Fixed user copies belong in `P8控制面操作.ts` or the report component's closed mapping, never raw `error.message`.

- [ ] **Step 6: Run PASS and commit**

```bash
npx vitest run src/状态/后端/P8控制面操作.test.ts src/组件/举报层.test.tsx \
  src/屏幕/职位详情.test.tsx src/屏幕/P7/Backend真人会话.test.tsx \
  src/屏幕/直聊会话.test.tsx
npm run typecheck
git diff --name-only -- '*.css' '*.module.css'
git add src/状态/后端/P8控制面操作.ts src/状态/后端/P8控制面操作.test.ts \
  src/状态/后端/类型.ts \
  src/组件/举报层.tsx src/组件/举报层.test.tsx \
  src/屏幕/职位详情.tsx src/屏幕/职位详情.test.tsx \
  src/屏幕/P7/Backend真人会话.tsx src/屏幕/P7/Backend真人会话.test.tsx \
  src/屏幕/直聊会话.tsx src/屏幕/直聊会话.test.tsx
git commit -m "feat: wire P8 contextual reports"
```

### Task 8: Browser Journeys, Visual Gate and Final Verification

**Files:**

- Modify: `e2e/数据源模式.spec.ts`
- Modify: `e2e/视觉回归/场景.ts`
- Modify: `docs/DEV_LOG.md`
- Product files: only if a failing test proves a defect; fix with RED/PASS and amend the owning task commit rather than hiding it here

**Interfaces:** Adds P8 route fixtures and two visual scenes; no production API.

- [ ] **Step 1: Add P8 route fixtures with request evidence**

Extend the existing per-test BFF fixture with credentials, sessions, replacement attempts, exports, deletion, feedback and reports. Store every mutation's method/path/body/Idempotency-Key/Origin and export status-read counts. Serve fixed marker values not present in Mock.

Fixture invariants:

- create export rejects any body;
- deletion requires exact `{}`;
- same key+same body replays the same receipt; changed body conflicts;
- replacement completion sweeps other sessions but preserves current;
- export transitions queued→running→ready and download serves `application/zip` with fixed headers;
- report block unavailable writes nothing; target not found is uniform; applied block updates the privacy fixture;
- deletion clears session and all later protected reads return invalid_session.

- [ ] **Step 2: Add Mock isolation journeys**

Run existing Mock account security, feedback, job report and direct-chat report interactions. Record every pathname matching:

```ts
const isP8 = (path: string) =>
  /\/security\/sessions|\/me\/(credentials|credential-replacement-attempts|data-exports|account-deletion)|\/compliance\/(feedback|reports)/.test(path);
```

Expected P8 request list: `[]`; the four-digit prototype and existing visuals/actions still work.

- [ ] **Step 3: Add Backend journeys**

At minimum cover:

1. masked credential + real session time/count, with no device/location literal;
2. revoke others and authoritative count refresh;
3. four-digit replacement success, replacement conflict and outcome-unknown same-key replay;
4. export create, close/reopen recovery, ready same-origin streamed download, expired/404 cleanup;
5. queued/running export blocking deletion and ready-undownloaded warning;
6. deletion 202 clearing UI/session and navigating to login;
7. product feedback showing real ticket and targetless report chips making zero report calls;
8. job and P7 conversation report targets with privacy-safe bodies;
9. block_unavailable then unchecked new-key submit; target-not-found refresh;
10. Backend direct chat with no report request/entry;
11. 401, account switch, unmount and late responses not leaking old-subject P8 state;
12. compliance 429 with no fabricated countdown/automatic retry.

For every mutation assert browser `Origin` equals the fixture server origin and keys are 16–128 visible ASCII. For same intent replay, assert byte-identical key/body.

In the Backend account journey, write a full-page screenshot to Playwright's test output after credentials/sessions/export row are visible. This is the manual evidence for the approved Backend-only export row; it is not checked into the repository.

- [ ] **Step 4: Add visual scenes using the current harness**

Add a Mock `candidate-account-security` scene at `/#/account` and `candidate-feedback` at `/#/feedback`. Key geometry on account must include title, phone row, current-device row and the existing delete button; because the new export row is Backend-only, the Mock page must remain pixel/geometry compatible with the base. Feedback keys include title, first category chip, textarea and submit button.

The UI regression runner copies the current harness into the detached base worktree, so these new scenes compare `659de17...` product code against the implementation with identical capture definitions.

- [ ] **Step 5: Run focused unit and browser tests**

```bash
npx vitest run \
  src/数据/HTTP客户端.test.ts src/数据/P8导出恢复.test.ts \
  src/数据/招聘数据源/P8控制面.test.ts src/数据/HTTP招聘数据源.test.ts \
  src/状态/后端/P8控制面操作.test.ts src/状态/后端/useP8导出轮询.test.tsx \
  src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts \
  src/屏幕/账号安全.test.tsx src/屏幕/设置.test.tsx src/屏幕/企业设置.test.tsx \
  src/屏幕/反馈.test.tsx src/组件/举报层.test.tsx \
  src/屏幕/职位详情.test.tsx src/屏幕/P7/Backend真人会话.test.tsx \
  src/屏幕/直聊会话.test.tsx

npm run test:e2e:data-source -- --grep "P8|账号安全|数据导出|账号注销|反馈|举报"
```

Expected: all pass. Do not filter command output through `grep`; preserve the real process exit code.

- [ ] **Step 6: Run the approved visual comparison**

```bash
UI_VISUAL_GATE=enforce UI_CHANGE_APPROVED=false npm run ui:check -- \
  --base 659de17be7aac4797bd572228179aedfc5768ae3 \
  --output /tmp/agxp-p8-ui-regression
```

Expected:

- `candidate-account-security` and `candidate-feedback` pass in Mock mode;
- all pre-existing scenes have no unexplained structural or visual diff;
- the Backend Playwright screenshot from Step 3 shows exactly one additional existing-style export row and otherwise preserves the account-page visual shell;
- no CSS file changed.

Open `/tmp/agxp-p8-ui-regression/report.md`, both Mock account screenshots and the Backend screenshot, manually list every diff, and fix any extra visual change before continuing. Do not turn on the approval bypass to hide a Mock regression.

- [ ] **Step 7: Run full verification**

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
git diff 659de17be7aac4797bd572228179aedfc5768ae3..HEAD --name-only -- '*.css' '*.module.css'
git status --short
```

Expected: every command exits 0, CSS diff is empty, and worktree is clean except the Task 8 files before commit.

- [ ] **Step 8: Record evidence and commit**

Append to `docs/DEV_LOG.md`:

- frontend start/end SHAs and all task commits;
- backend frozen SHA and Task 0 L3 receipt;
- focused/full unit counts, Playwright count, typecheck/lint/build exits;
- visual report path and exact allowed diff statement;
- explicit “Mock P8 requests = 0”, “CSS changes = 0”, and any honest blocked external condition.

```bash
git add e2e/数据源模式.spec.ts e2e/视觉回归/场景.ts docs/DEV_LOG.md
git commit -m "test: cover P8 frontend control-plane journeys"
git status --short
```

Expected: final worktree clean.

## Final Completion Checklist

- [ ] Backend SHA is still exactly `897468e5221f0078533178a28119bb259dbb676e`; canonical L3 has a recorded PASS.
- [ ] Every P8 endpoint uses the exact method/body/no-body/key contract and closed error union.
- [ ] Strict decoders reject drift; optional next-action window fields map to null; no invented ticket ID constraint.
- [ ] Credentials/sessions/export never cross subject/session fences; logout/401/deletion cleanup is complete.
- [ ] Export recovery is subject+environment scoped; ZIP is never buffered or persisted.
- [ ] Replacement uses the global four-digit rule and current PM drawer visuals.
- [ ] Feedback, targetless guidance and typed report are semantically separate.
- [ ] Job and P7 reports use only authoritative refs; Backend direct chat has no invented report target.
- [ ] Mock makes zero P8 requests and retains existing prototype behavior.
- [ ] CSS diff is empty; the only approved new visual is the export row.
- [ ] Focused tests, full tests, typecheck, lint, build, Playwright and visual report all have recorded evidence.
