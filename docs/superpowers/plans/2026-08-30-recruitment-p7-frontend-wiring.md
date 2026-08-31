# Recruitment P7 Frontend Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended in the same session) or `superpowers:executing-plans` (in a fresh session) to implement this plan task-by-task. Use `superpowers:test-driven-development` for every product change and `superpowers:verification-before-completion` before claiming completion. Keep the checkboxes current.

**Goal:** 在 Backend 模式把 P7 双角色真人会话收件箱、详情、历史消息、纯文本发送、read-through 与 WebSocket 失效重拉接入当前前端，并让 P5 仅在权威 `complete + conversation_ref` 后开放聊天入口。

**Architecture:** 保留当前 Mock 页面与无参路由，给同一视觉壳增加 Backend 私有分支。新增独立 P7 strict facade、单一内存 owner、带 subject/role/session/scope fence 的操作层和只做 invalidation 的同源 WebSocket adapter。HTTP 是唯一真相源；事件、发送成功和已读成功都只触发 no-store 权威重读。

**Tech Stack:** React 19、TypeScript 6、React Router 7、Vite 8、Vitest 4、Testing Library、Playwright 1.62、原生 WebSocket。

**Spec:** `docs/superpowers/specs/2026-08-30-recruitment-p7-frontend-wiring-design.md`

## Global Constraints

- 前端起始基线是 `7e75326f9d5924952783082c8372de39cd9b2a86`。开始实施时先 fetch 并审计本 Plan File Map 的漂移，不能在未知漂移上照抄行号。
- 后端合同固定为 `agxp-monorepo origin/release/0.2.5@fa0df4ab7c9cba78d8687d6880560d6a987ec9b2`；`aac1284d5` 是 `conversation_ref` 最终合同收口。只读该 commit 的 `apps/recruitment-bff/openapi/mobile-v1.yaml`，不修改后端仓库。
- Backend 全部 P7 GET 使用 `不缓存: true`，所有失败都不回退 Mock；Mock 模式不得建立 P7 HTTP 或 WebSocket 连接。
- P7 context 不提供真名、电话、微信、联系人或简历正文。Backend 不显示或推断这些值，不消费 Mock 值。
- 候选“看职位”只使用 `context.job_ref` 导航现有 `路径.职位详情(jobRef)`；招聘“看简历”只用 `case_id` 调现有 `操作.读取简历PDF('recruiter', caseId)`，绝不把 `resume_ref` 拼成 URL。
- 发送内容使用 `Array.from(content.trim()).length` 校验 1–2000 Unicode code point；不得用 UTF-16 `string.length` 冒充 code point 数。
- `operation_outcome_unknown` 必须保存原 Idempotency-Key 与不可变正文。无权威成功证据时不得乐观追加、清草稿或换 key。
- 复合意图串 `role + conversationId + trim 后正文` 只作 pending Map key；真正的 Idempotency-Key 一律由 `crypto.randomUUID()` 铸造，满足 16–128 可见 ASCII，并在同一意图的所有重试中复用。
- `conversation_started` 永不计未读、永不作为 read target；decimal message ID 保持 string，不能转 `number` 比大小。
- WebSocket 帧不携带真相，只触发当前 role inbox 与对应可见 conversation 的 HTTP 重拉。
- P5 same-party 已知问题在公开 DTO 上只表现为长期 `completed + handoff_pending`。前端继续可见轮询、保持禁用，不增加超时终态或内部错误文案。
- 每个 Task 顺序执行：先写测试并观察 RED，再做最小实现、跑定向 PASS、提交。不要把多个 Task 压成一个提交。

## Zero-Context Contract

### Wire types

```ts
export type P7角色 = 'candidate' | 'recruiter';

export interface P7会话上下文 {
  primaryLabel: string;
  secondaryLabel: string;
  jobRef: string | null;
  resumeRef: string | null;
}

export interface P7消息预览 {
  messageId: string;
  senderRole: P7角色;
  preview: string;
  createdAt: string;
}

export interface P7会话项 {
  conversationId: string;
  caseId: string;
  kind: 'human_handoff';
  lastMessage: P7消息预览 | null;
  lastActivityAt: string;
  unreadCount: number;
  contextStatus: 'available' | 'unavailable';
  context: P7会话上下文 | null;
}

export type P7消息 =
  | {
      messageId: string;
      kind: 'user_text';
      senderRole: P7角色;
      content: string;
      createdAt: string;
    }
  | {
      messageId: `system:${string}`;
      kind: 'conversation_started';
      senderRole: 'system';
      createdAt: string;
    };

export interface P7会话页 { items: P7会话项[]; nextCursor: string | null }
export interface P7消息页 { messages: P7消息[]; nextCursor: string | null }
```

Wire uses snake_case. `src/数据/招聘数据源/真人会话.ts` is the only mapper to these camelCase domain types. The actual messages page key is `messages`, never `items`.

### State and operations

```ts
export type P7加载阶段 = '未开始' | '进行中' | '成功' | '失败';

export interface P7分页快照<T> {
  阶段: P7加载阶段;
  刷新中: boolean;
  items: T[];
  nextCursor: string | null;
  已加载页数: number;
  error: string | null;
  generation: number;
}

export interface P7详情快照 {
  阶段: P7加载阶段;
  刷新中: boolean;
  detail: P7会话项 | null;
  error: string | null;
  generation: number;
}

export interface P7会话状态 {
  P7收件箱: Record<P7角色, P7分页快照<P7会话项>>;
  P7会话详情: Record<string, P7详情快照>;
  P7消息页: Record<string, P7分页快照<P7消息>>;
}

export type P7发送结果 =
  | { status: 'confirmed' }
  | {
      status: 'unknown';
      reason: 'outcome_unknown' | 'in_progress';
      canAbandon: boolean;
      pendingContent: string;
    };

export interface 真人会话操作 {
  设置P7收件箱范围(role: P7角色, visible: boolean): void;
  设置P7会话范围(role: P7角色, conversationId: string | null): void;
  加载会话列表(role: P7角色, force?: boolean): Promise<void>;
  追加会话列表(role: P7角色): Promise<void>;
  读取真人会话(role: P7角色, conversationId: string, force?: boolean): Promise<void>;
  追加更早消息(role: P7角色, conversationId: string): Promise<void>;
  发送真人消息(role: P7角色, conversationId: string, content: string): Promise<P7发送结果>;
  放弃真人消息意图(role: P7角色, conversationId: string, pendingContent: string): void;
  提交真人已读(role: P7角色, conversationId: string, messageId: string): Promise<void>;
  使真人会话失效(role: P7角色, conversationId?: string): void;
}
```

State detail/message key is `role + encoded conversationId`; the Provider clears the whole P7 domain whenever subject or active role changes. The operation fence still captures `subject_id + active role + session generation + scope generation`; therefore no cross-account state may survive even when two accounts happen to share the same numeric conversation ID.

## File Map

| Responsibility | Files |
|---|---|
| Strict wire facade | `src/数据/BFF契约.ts`, new `src/数据/招聘数据源/真人会话.ts`, `src/数据/HTTP招聘数据源.ts` and tests |
| Runtime owner | new `src/状态/后端/真人会话操作.ts`, `src/状态/后端/类型.ts`, `src/状态/应用状态.tsx`, `src/状态/后端/会话操作.ts` and tests |
| Inbox and badges | new `src/屏幕/P7/Backend会话列表.tsx`, `src/屏幕/消息列表.tsx`, `src/屏幕/企业消息.tsx`, `src/屏幕/主壳.tsx`, `src/组件/玻璃导航栏.tsx`, `src/屏幕/企业主壳.tsx` and tests |
| Routes and chat | new `src/屏幕/P7/Backend真人会话.tsx`, both existing human-chat screens, action bar, route table/app, extracted PDF layer and tests |
| Realtime invalidation | new `src/数据/招聘事件源.ts`, new `src/状态/后端/use真人会话事件.ts`, `vite.config.ts`, new `src/配置/vite代理合同.test.ts` and tests |
| P5 publication | P5 MatchCase decoder/mapper/polling/detail and tests |
| Browser acceptance | `e2e/数据源模式.spec.ts`, `docs/DEV_LOG.md` |

---

### Task 0: Re-admit the Frozen Frontend and Backend Baselines

**Files:**

- Read: `docs/superpowers/specs/2026-08-30-recruitment-p7-frontend-wiring-design.md`
- Read: every existing path in the File Map
- Read in backend repo: `apps/recruitment-bff/openapi/mobile-v1.yaml`
- Read in backend repo: `docs/known-issues/recruitment-p7-same-party-matchcase-handoff-stuck.md`
- Modify: none

**Interfaces:** Produces a PASS/STOP decision and exact observed SHAs; no product artifact.

- [ ] **Step 1: Verify the frontend worktree and base ancestry**

```bash
git branch --show-current
git status --short
git rev-parse HEAD
git merge-base --is-ancestor 7e75326f9d5924952783082c8372de39cd9b2a86 HEAD
git log --oneline --decorate -5
```

Expected: a dedicated implementation branch, clean worktree, and exit 0 from `merge-base`. A moved HEAD is allowed only when changes since this Plan are inspected in Step 3.

- [ ] **Step 2: Verify the remote release commit**

```bash
git -C /Users/visionclaw/agxp-monorepo fetch origin release/0.2.5
git -C /Users/visionclaw/agxp-monorepo rev-parse origin/release/0.2.5
git -C /Users/visionclaw/agxp-monorepo show --no-patch --oneline fa0df4ab7c9cba78d8687d6880560d6a987ec9b2
```

Expected: `origin/release/0.2.5` resolves to `fa0df4ab7c9cba78d8687d6880560d6a987ec9b2`. If the remote moved, stop and ask the planning owner to recalibrate the contract before editing.

- [ ] **Step 3: Audit frontend path drift since the frozen base**

```bash
git diff --name-status 7e75326f9d5924952783082c8372de39cd9b2a86..HEAD -- \
  src/数据 src/状态 src/路由/路径表.ts src/应用.tsx \
  src/屏幕/消息列表.tsx src/屏幕/企业消息.tsx \
  src/屏幕/真人会话.tsx src/屏幕/企业真人会话.tsx src/屏幕/P5 \
  src/组件/玻璃导航栏.tsx vite.config.ts e2e/数据源模式.spec.ts
```

Expected at plan handoff: only the approved document commits differ. If product files changed, inspect them and stop on any contract/file-map conflict; do not silently overwrite newer work.

- [ ] **Step 4: Reconfirm the released contract anchors**

```bash
git -C /Users/visionclaw/agxp-monorepo show \
  fa0df4ab7c9cba78d8687d6880560d6a987ec9b2:apps/recruitment-bff/openapi/mobile-v1.yaml \
  | rg -n "/api/v1/(me|recruiter)/conversations|ConversationMessagesPage|conversation_ref|read_through_message_id|context_status"
git -C /Users/visionclaw/agxp-monorepo show \
  fa0df4ab7c9cba78d8687d6880560d6a987ec9b2:docs/known-issues/recruitment-p7-same-party-matchcase-handoff-stuck.md \
  | rg -n "handoff_pending|conversation_ref|same-party|invalid_actor_identity"
```

Expected: all anchors are present, messages page requires `messages`, P5 detail exposes `conversation_ref`, and the same-party issue is still open. Proceed only after PASS.

### Task 1: Add the Strict P7 Conversation Facade

**Files:**

- Modify: `src/数据/BFF契约.ts`
- Create: `src/数据/招聘数据源/真人会话.ts`
- Create: `src/数据/招聘数据源/真人会话.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`
- Modify if shared fixtures need it: `src/测试/BFF样本.ts`

**Interfaces:** Produces the Wire types above and:

```ts
export interface 真人会话数据源 {
  读取会话列表(role: P7角色, cursor?: string): Promise<P7会话页>;
  读取会话(role: P7角色, conversationId: string): Promise<P7会话项>;
  读取消息(role: P7角色, conversationId: string, cursor?: string): Promise<P7消息页>;
  发送消息(role: P7角色, conversationId: string, content: string, key: string): Promise<P7消息>;
  标为已读(role: P7角色, conversationId: string, messageId: string): Promise<string>;
}
```

- [ ] **Step 1: Write exact decoder tests**

Test valid available/unavailable context, empty sparse pages, and both message branches. Reject missing/extra keys, invalid RFC3339, unsafe or negative unread, non-canonical IDs, duplicated IDs, preview with system role, available without context, unavailable with non-null context, `user_text` without content, and system rows whose ID does not equal `system:<current conversationId>`.

```ts
expect(解会话页({ items: [可用会话Wire], next_cursor: null }).items[0]).toMatchObject({
  conversationId: '3003', unreadCount: 0,
  context: { jobRef: 'job_00112233445566778899aabbccddeeff' },
});
expect(() => 解消息页('3003', { items: [], next_cursor: null })).toThrow();
expect(解消息页('3003', { messages: [], next_cursor: null })).toEqual({
  messages: [], nextCursor: null,
});
```

- [ ] **Step 2: Write request-shape tests**

```ts
await source.读取消息('candidate', '3003', 'older_1');
expect(请求).toHaveBeenCalledWith({
  path: '/api/v1/me/conversations/3003/messages?cursor=older_1',
  不缓存: true,
});

await source.发送消息('recruiter', '3003', '你好', 'p7-send-key-0001');
expect(请求).toHaveBeenCalledWith({
  path: '/api/v1/recruiter/conversations/3003/messages',
  method: 'POST', body: { content: '你好' }, 幂等: true, 幂等键: 'p7-send-key-0001',
});

await source.标为已读('candidate', '3003', '4004');
expect(请求).toHaveBeenCalledWith({
  path: '/api/v1/me/conversations/3003/read',
  method: 'PUT', body: { read_through_message_id: '4004' },
});
```

Also assert every list/detail/messages GET uses `不缓存: true`, path segments are `encodeURIComponent` encoded, and role never appears in body/query.

- [ ] **Step 3: Run RED**

```bash
npx vitest run src/数据/招聘数据源/真人会话.test.ts src/数据/HTTP招聘数据源.test.ts
```

Expected: FAIL because the facade and root composition do not exist.

- [ ] **Step 4: Implement the closed decoder and facade**

Use exact-key guards local to the P7 module, the released coordinate pattern `/^[1-9][0-9]{0,63}$/` for conversation/message IDs, existing RFC3339 discipline, safe non-negative integer unread, and opaque non-empty cursor. Include a 65-digit rejection test. Normalize absent optional `job_ref`/`resume_ref` to `null`. Validate trimmed content locally with `Array.from(trimmed).length` before POST.

```ts
const P7前缀 = { candidate: '/api/v1/me', recruiter: '/api/v1/recruiter' } as const;

export function 创建真人会话数据源(
  请求: BFF客户端['请求'],
): 真人会话数据源 {
  return {
    async 读取消息(role, conversationId, cursor) {
      const query = cursor === undefined ? '' : `?cursor=${encodeURIComponent(cursor)}`;
      const response = await 请求<unknown>({
        path: `${P7前缀[role]}/conversations/${encodeURIComponent(conversationId)}/messages${query}`,
        不缓存: true,
      });
      return 解消息页(conversationId, response.result);
    },
    // list/detail/send/read follow the same closed role/path table
  };
}
```

- [ ] **Step 5: Run PASS and commit**

```bash
npx vitest run src/数据/招聘数据源/真人会话.test.ts src/数据/HTTP招聘数据源.test.ts
git add src/数据/BFF契约.ts src/数据/招聘数据源/真人会话.ts src/数据/招聘数据源/真人会话.test.ts src/数据/HTTP招聘数据源.ts src/数据/HTTP招聘数据源.test.ts src/测试/BFF样本.ts
git commit -m "feat: add strict P7 conversation data source"
```

Expected: PASS. If `src/测试/BFF样本.ts` was unchanged, omit it from `git add`.

### Task 2: Add Memory-Only State, Operations, and Fences

**Files:**

- Create: `src/状态/后端/真人会话操作.ts`
- Create: `src/状态/后端/真人会话操作.test.ts`
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/后端/会话操作.test.ts`

**Interfaces:** Produces the State and operations contract above plus runtime refs:

```ts
export interface P7待定意图 {
  key: string;
  content: string;
  watermark: string | null;
}

export interface P7运行时引用 {
  P7范围代际: 可变引用<Map<string, number>>;
  P7待定意图: 可变引用<Map<string, P7待定意图>>;
  P7可见收件箱: 可变引用<Record<P7角色, boolean>>;
  P7可见会话: 可变引用<Record<P7角色, string | null>>;
  P7已读位置: 可变引用<Map<string, {
    lastSuccessful: string | null;
    inFlight: string | null;
    terminalRejected: string | null;
  }>>;
}
```

- [ ] **Step 1: Write state/read/pagination RED tests**

Cover first load, refresh preserving successful content, inbox append, older-message prepend, sparse page with a next cursor, direct detail without inbox, single-flight, and stale success/failure after scope unmount, role switch, subject switch or session generation change.

```ts
const pending = deferred<P7会话页>();
数据源.读取会话列表.mockReturnValueOnce(pending.promise);
const run = 操作.加载会话列表('candidate', true);
会话代际.current += 1;
pending.resolve({ items: [会话项], nextCursor: null });
await run;
expect(状态().P7收件箱.candidate.items).toEqual([]);
```

- [ ] **Step 2: Write send reconciliation RED tests**

The test matrix must prove:

1. no optimistic append;
2. same `role+conversation+trimmed content` keeps one key across retry;
3. after unknown, authoritative reread observes a newer own exact-content message after the watermark and returns `confirmed`;
4. successful reread without evidence returns `unknown/reason=outcome_unknown/canAbandon=true`;
5. failed reread returns `unknown/reason=outcome_unknown/canAbandon=false`;
6. explicit abandon clears only the immutable pending content key; a live edited draft is unrelated;
7. a final `idempotency_in_progress` after the HTTP client's controlled retry retains the same key and returns `unknown/reason=in_progress/canAbandon=false`;
8. `idempotency_conflict` is terminal and does not reuse the key for changed content;
9. the generated network key matches `/^[!-~]{16,128}$/`, while the possibly Chinese composite intent string never leaves the Map.

```ts
const first = await 操作.发送真人消息('candidate', '3003', '  你好  ');
expect(first).toEqual({
  status: 'unknown', reason: 'outcome_unknown', canAbandon: true, pendingContent: '你好',
});
await 操作.发送真人消息('candidate', '3003', '你好');
expect(数据源.发送消息.mock.calls[0][3]).toBe(数据源.发送消息.mock.calls[1][3]);
```

- [ ] **Step 3: Write read and cleanup RED tests**

Assert only decimal `user_text` IDs are accepted, same rendered target is single-flight/deduplicated, success refreshes detail+inbox, and logout/401/subject/role transition clears P7 state, ranges, pending intents, read positions and active socket scope without persisting any P7 value. Add the terminal-permission matrix: after `role_required` or `role_suspended`, rerendering the same target makes zero further read calls; a different target may make one call; subject/role/session cleanup clears the refusal and permits the target in the new scope.

- [ ] **Step 4: Run RED**

```bash
npx vitest run src/状态/后端/真人会话操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
```

Expected: FAIL because P7 owner/operations/refs are absent.

- [ ] **Step 5: Implement snapshots, operations and Provider wiring**

Follow `MatchCase操作.ts` patterns for encoded scope keys, generation fences, successful-snapshot preservation and stale-result discard. Add `创建空P7会话状态()` and `清P7会话引用()`. Extend `后端状态`, `后端操作依赖`, `应用操作`, Provider refs, initial state, subject-role cleanup effect, and `创建真人会话操作(deps)` composition.

For unknown reconciliation, inspect the chronological current message snapshot without numeric conversion:

```ts
function 是水位后同文消息(messages: P7消息[], intent: P7待定意图, role: P7角色): boolean {
  const start = intent.watermark === null
    ? 0
    : Math.max(0, messages.findIndex((m) => m.messageId === intent.watermark) + 1);
  return messages.slice(start).some((m) =>
    m.kind === 'user_text' && m.senderRole === role && m.content === intent.content,
  );
}
```

If a non-null watermark is absent from the reread window, do not claim success; return unknown and retain the key. All successful send/read paths re-read authoritative messages/detail/inbox before resolving.

Freeze the two-layer key helper instead of deriving a header from content:

```ts
function pendingIntentFor(
  refs: P7运行时引用,
  intentCoordinate: string,
  content: string,
  watermark: string | null,
): P7待定意图 {
  const existing = refs.P7待定意图.current.get(intentCoordinate);
  if (existing) return existing;
  const created = { key: globalThis.crypto.randomUUID(), content, watermark };
  refs.P7待定意图.current.set(intentCoordinate, created);
  return created;
}
```

Add a P7-specific public error mapper in this module. Check the Spec §12 P7 table first. For unmapped failures, reuse only `取后端错误文案`'s closed safe branches: non-`BFF错误` transport, status 0 / `network_error`, status 502/503/504, `invalid_response`, and `invalid_session`; an otherwise unknown `BFF错误` must use `请求失败，请稍后重试` instead of the helper's final `error.message` fallback. `role_required` / `role_suspended` do not clear a valid session, do not auto-retry sends, and set `terminalRejected` for the same automatic read target until a different target or subject/role/session cleanup. Test both role codes, status 0 preserving the existing useful network copy, and one unknown English backend message being replaced.

- [ ] **Step 6: Run PASS and commit**

```bash
npx vitest run src/状态/后端/真人会话操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
git add src/状态/后端/真人会话操作.ts src/状态/后端/真人会话操作.test.ts src/状态/后端/类型.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts src/状态/后端/会话操作.ts src/状态/后端/会话操作.test.ts
git commit -m "feat: add fenced P7 conversation runtime"
```

### Task 3: Wire Role Inboxes and Loaded-Window Badges

**Files:**

- Modify: `src/路由/路径表.ts`
- Create: `src/屏幕/P7/Backend会话列表.tsx`
- Create: `src/屏幕/P7/Backend会话列表.test.tsx`
- Modify: `src/屏幕/消息列表.tsx`
- Create: `src/屏幕/消息列表.test.tsx`
- Modify: `src/屏幕/企业消息.tsx`
- Modify: `src/屏幕/企业消息.test.tsx`
- Modify: `src/屏幕/主壳.tsx`
- Create: `src/屏幕/主壳.test.tsx`
- Modify: `src/组件/玻璃导航栏.tsx`
- Create: `src/组件/玻璃导航栏.test.tsx`
- Modify: `src/屏幕/企业主壳.tsx`
- Create: `src/屏幕/企业主壳.test.tsx`

**Interfaces:** `Backend会话列表` receives only `{ role: P7角色 }`; it reads `后端状态/操作`, maps viewer-safe context, and navigates with the P7 route builders added here. The existing Mock string constants keep their current names and meaning. Parameter `<Route>` registrations arrive in Task 4.

- [ ] **Step 1: Add route-builder compile seam**

Modify `src/路由/路径表.ts` now:

```ts
真人会话: '/chat/human',
真人会话路径: (id: string) => `/chat/human/${encodeURIComponent(id)}`,
真人会话模板: '/chat/human/:conversationId',
企业真人会话: '/hr/chat',
企业真人会话路径: (id: string) => `/hr/chat/${encodeURIComponent(id)}`,
企业真人会话模板: '/hr/chat/:conversationId',
```

Do not change any existing Mock caller: `消息列表.tsx`, `企业消息.tsx`, `在谈详情.tsx`, `候选详情.tsx` and current static `<Route>` entries continue using `路径.真人会话` / `路径.企业真人会话`. Backend P7 callers use only the new `*路径(id)` builders. Do not register parameter routes yet.

- [ ] **Step 2: Write Backend inbox RED tests**

Cover role-specific labels, unavailable context fallback, `last_message=null`, server order, local search, empty/loading/failure/retry/load-more, `unreadCount=0` with no dot, stable route navigation, and “通知” explicit empty state. Ensure Backend never dispatches `读消息/企业读消息` on row click.

```tsx
render(<Backend会话列表 role="candidate" />);
expect(screen.getByText('后端工程师')).toBeTruthy();
expect(screen.queryByTestId('unread-3003')).toBeNull();
await user.click(screen.getByRole('button', { name: /后端工程师/ }));
expect(mock跳转).toHaveBeenCalledWith('/chat/human/3003');
expect(mock派发).not.toHaveBeenCalled();
```

- [ ] **Step 3: Write branch and badge RED tests**

Assert `消息列表` and `企业消息` return Backend list only when `数据源模式==='backend'`, while Mock retains current AI/direct/human rows and reducer semantics. For Backend badge use only the currently loaded inbox items:

```ts
export function 数P7已加载未读(items: P7会话项[]): number {
  return items.reduce((sum, item) => sum + item.unreadCount, 0);
}
```

Candidate `玻璃导航栏` reads candidate inbox; recruiter `企业主壳` reads recruiter inbox. A zero sum renders no badge; no copy may call it an account total. Add shell tests that mount Backend `主壳` / `企业主壳` on a non-message Tab, assert `加载会话列表(role)` runs once, resolve unread data, and assert the badge appears before the user ever opens the message Tab. Mock shells make zero P7 calls.

- [ ] **Step 4: Run RED**

```bash
npx vitest run src/屏幕/P7/Backend会话列表.test.tsx src/屏幕/消息列表.test.tsx src/屏幕/企业消息.test.tsx src/屏幕/主壳.test.tsx src/组件/玻璃导航栏.test.tsx src/屏幕/企业主壳.test.tsx
```

Expected: FAIL on missing Backend component and route/badge branches.

- [ ] **Step 5: Implement minimal Backend branches**

The two main shells perform the initial non-force inbox hydration in Backend mode so badges work before the message Tab is opened. `Backend会话列表` registers/unregisters inbox visibility and requests a force refresh on entry; operation-layer single-flight prevents duplicate requests. It keeps successful content while refreshing and never imports Mock data. Candidate title/subtitle are `primaryLabel/secondaryLabel`; recruiter uses `secondaryLabel/primaryLabel`. Use a neutral avatar glyph, not a Mock name initial.

```tsx
export default function 消息列表() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend'
    ? <Backend会话列表 role="candidate" />
    : <Mock消息列表 />;
}
```

- [ ] **Step 6: Run PASS and commit**

```bash
npx vitest run src/屏幕/P7/Backend会话列表.test.tsx src/屏幕/消息列表.test.tsx src/屏幕/企业消息.test.tsx src/屏幕/主壳.test.tsx src/组件/玻璃导航栏.test.tsx src/屏幕/企业主壳.test.tsx
npm run typecheck
git add src/路由/路径表.ts src/屏幕/P7/Backend会话列表.tsx src/屏幕/P7/Backend会话列表.test.tsx src/屏幕/消息列表.tsx src/屏幕/消息列表.test.tsx src/屏幕/企业消息.tsx src/屏幕/企业消息.test.tsx src/屏幕/主壳.tsx src/屏幕/主壳.test.tsx src/组件/玻璃导航栏.tsx src/组件/玻璃导航栏.test.tsx src/屏幕/企业主壳.tsx src/屏幕/企业主壳.test.tsx
git commit -m "feat: wire P7 role inboxes"
```

### Task 4: Wire Parameterized Chat Pages and Safe Context Actions

**Files:**

- Create: `src/屏幕/P7/Backend真人会话.tsx`
- Create: `src/屏幕/P7/Backend真人会话.test.tsx`
- Modify: `src/屏幕/真人会话.tsx`
- Modify: `src/屏幕/真人会话.test.tsx`
- Modify: `src/屏幕/企业真人会话.tsx`
- Modify: `src/屏幕/企业真人会话.test.tsx`
- Modify: `src/屏幕/真人会话操作栏.tsx`
- Modify: `src/屏幕/真人会话操作栏.test.tsx`
- Create: `src/组件/原始PDF层.tsx`
- Create: `src/组件/原始PDF层.test.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.test.tsx`
- Modify: `src/应用.tsx`

**Interfaces:** `Backend真人会话` receives `{ role, conversationId }`; existing screens become thin mode/param switches. Extract the private P5 `原始PDF层` without changing its DOM contract, then reuse it for recruiter P7.

- [ ] **Step 1: Write route and direct-load RED tests**

Assert both parameter templates are registered alongside the unchanged static string routes, encoded IDs reach the screen, direct refresh invokes detail+latest messages, Backend visits to the static routes fail closed with “会话不可用”, and Mock static routes retain existing `J-01/A-01` behavior.

```tsx
<MemoryRouter initialEntries={['/chat/human/3003']}>
  <Routes><Route path="/chat/human/:conversationId" element={<真人会话 />} /></Routes>
</MemoryRouter>
expect(mock操作.读取真人会话).toHaveBeenCalledWith('candidate', '3003');
```

- [ ] **Step 2: Write rendering/send/read RED tests**

Cover sender alignment for both roles, neutral `conversation_started` system row, chronological pages and “加载更早”, 404 clearing stale content, 503 preserving prior success, Enter send/Shift+Enter newline, code-point limit, no optimistic bubble, unknown retry/abandon behavior, and one read-through per actually rendered latest `user_text` ID. Assert `reason=outcome_unknown` renders “暂时无法确认是否发送成功”，while `reason=in_progress` renders “消息仍在处理中，请稍后重试”.

```tsx
await user.type(screen.getByRole('textbox', { name: '输入消息' }), '  你好  ');
await user.click(screen.getByRole('button', { name: '发送' }));
expect(mock操作.发送真人消息).toHaveBeenCalledWith('candidate', '3003', '你好');
expect(mock操作.提交真人已读).toHaveBeenCalledWith('candidate', '3003', '4004');
```

When an unknown result returns `pendingContent='你好'`, editing the live draft then clicking abandon must call `放弃真人消息意图(role,id,'你好')` and preserve the edited draft.

- [ ] **Step 3: Write safe-context-action RED tests**

Change `真人会话操作栏` props to a discriminated main action and optional contacts:

```ts
type 主项属性 =
  | { 主项内容: ReactNode; 主项按下?: never }
  | { 主项内容?: never; 主项按下: () => void };
type 联系属性 =
  | {
      联系方式: { 电话: string; 微信: string };
      交换?: { 已换: 次项名[]; 换: (名: 次项名) => void };
    }
  | { 联系方式?: never; 交换?: never };
type 属性 = 主项属性 & 联系属性 & {
  主项名: string;
  主项图标: ReactNode;
};
```

Tests must prove existing Mock three-action behavior is unchanged; Backend candidate shows the action only when context is available and `jobRef` is non-null, then navigates to `/job/<encoded ref>` without guessing; Backend recruiter shows the action only when context is available and `resumeRef` is non-null, fetches the exact Case PDF only on click and revokes on close/unmount. Context unavailable or the corresponding ref absent hides that action. Backend renders no phone/WeChat buttons.

- [ ] **Step 4: Run RED**

```bash
npx vitest run src/屏幕/P7/Backend真人会话.test.tsx src/屏幕/真人会话.test.tsx src/屏幕/企业真人会话.test.tsx src/屏幕/真人会话操作栏.test.tsx src/组件/原始PDF层.test.tsx src/屏幕/P5/MatchCase详情.test.tsx
```

Expected: FAIL on missing Backend screen, parameter routes and reusable PDF layer.

- [ ] **Step 5: Extract PDF layer without behavior drift**

Move `原始PDF层` JSX from `P5/MatchCase详情.tsx` to `src/组件/原始PDF层.tsx`, preserving `role=dialog`, filename, `<iframe title="简历 PDF">`, close behavior and CSS classes. P5 imports it; all existing P5 PDF tests must remain green before adding P7 usage.

- [ ] **Step 6: Implement Backend screen and thin mode switches**

```tsx
export default function 真人会话() {
  const { 数据源模式 } = use应用状态();
  const { conversationId } = useParams();
  if (数据源模式 !== 'backend') return <Mock真人会话 />;
  if (!conversationId) return <会话不可用 />;
  return <Backend真人会话 role="candidate" conversationId={conversationId} />;
}
```

Keep the current `<Route path={路径.真人会话}>` / enterprise static entries and add their parameter templates immediately after them in `应用.tsx`. The shared Backend screen owns visible-scope registration, first read, scroll preservation on prepend, local draft and unknown-result UI. It renders only P7 data. Candidate context action calls `跳转(路径.职位详情(context.jobRef))`; recruiter calls `读取简历PDF('recruiter', detail.caseId)` and owns the returned lease until close/unmount.

- [ ] **Step 7: Run PASS and commit**

```bash
npx vitest run src/屏幕/P7/Backend真人会话.test.tsx src/屏幕/真人会话.test.tsx src/屏幕/企业真人会话.test.tsx src/屏幕/真人会话操作栏.test.tsx src/组件/原始PDF层.test.tsx src/屏幕/P5/MatchCase详情.test.tsx
git add src/屏幕/P7/Backend真人会话.tsx src/屏幕/P7/Backend真人会话.test.tsx src/屏幕/真人会话.tsx src/屏幕/真人会话.test.tsx src/屏幕/企业真人会话.tsx src/屏幕/企业真人会话.test.tsx src/屏幕/真人会话操作栏.tsx src/屏幕/真人会话操作栏.test.tsx src/组件/原始PDF层.tsx src/组件/原始PDF层.test.tsx src/屏幕/P5/MatchCase详情.tsx src/屏幕/P5/MatchCase详情.test.tsx src/应用.tsx
git commit -m "feat: wire P7 human conversation pages"
```

### Task 5: Add Same-Origin WebSocket Invalidation

**Files:**

- Create: `src/数据/招聘事件源.ts`
- Create: `src/数据/招聘事件源.test.ts`
- Create: `src/状态/后端/use真人会话事件.ts`
- Create: `src/状态/后端/use真人会话事件.test.tsx`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `vite.config.ts`
- Create: `src/配置/vite代理合同.test.ts`
- Run unchanged regression: `src/配置/运行配置.test.ts`

**Interfaces:**

```ts
export interface P7变更事件 {
  type: 'recruitment.conversation_changed';
  conversationId: string;
  reason: 'message_created';
}

export interface 招聘事件源 {
  连接(handlers: {
    onEvent(event: P7变更事件): void;
    onOpen(): void;
  }): () => void;
}
```

- [ ] **Step 1: Write strict-frame RED tests**

Accept only exact keys `{type,conversation_id,reason}`, exact enum values and canonical conversation IDs. Malformed JSON, extra keys and unknown events are ignored without closing a healthy socket and without touching state.

- [ ] **Step 2: Write lifecycle/invalidation RED tests**

Use a fake WebSocket and fake timers. Prove same-origin `ws:`/`wss:` URL, no token/query/header, event causes inbox HTTP refresh and only refreshes detail/messages when the same conversation is visible, open/reopen always re-reads visible scopes, exponential backoff 1s→2s→…→30s, StrictMode keeps one live connection, and hidden/unmount/logout/401/role/subject change closes socket and timers. Mock opens zero sockets.

```ts
socket.emit({
  type: 'recruitment.conversation_changed', conversation_id: '3003', reason: 'message_created',
});
expect(mock操作.使真人会话失效).toHaveBeenCalledWith('candidate', '3003');
expect(mock操作.加载会话列表).toHaveBeenCalledWith('candidate', true);
expect(mock操作.读取真人会话).toHaveBeenCalledWith('candidate', '3003', true);
```

- [ ] **Step 3: Run RED**

```bash
npx vitest run src/数据/招聘事件源.test.ts src/状态/后端/use真人会话事件.test.tsx src/状态/应用状态.test.ts src/配置/vite代理合同.test.ts src/配置/运行配置.test.ts
```

- [ ] **Step 4: Implement adapter and one Provider hook**

```ts
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const url = `${protocol}//${location.host}/api/v1/events/live`;
```

The adapter decodes frames and owns reconnect timing only. `use真人会话事件` reads current authenticated role and P7 visibility refs, calls operation invalidation/read methods, and never appends a payload. Mount the hook once inside `应用状态提供者`, enabled only for a logged-in Backend subject with active candidate/recruiter role and `document.visibilityState==='visible'`.

Make Vite proxy the same-origin WebSocket path as well as HTTP. `src/配置/vite代理合同.test.ts` may follow the repository's existing `?raw` source-contract pattern: it must fail until `vite.config.ts` contains `ws: true` and a `proxyReqWs` Origin handler, while `运行配置.test.ts` continues proving local has no rewrite and stg names `https://recruitment-stg.agxp.ai`.

```ts
'/api/v1': {
  target: 代理.target,
  changeOrigin: 代理.改写Origin !== null,
  ws: true,
  configure(proxy) {
    if (!代理.改写Origin) return;
    proxy.on('proxyReq', (request) =>
      request.setHeader('Origin', 代理.改写Origin!));
    proxy.on('proxyReqWs', (request) =>
      request.setHeader('Origin', 代理.改写Origin!));
  },
},
```

- [ ] **Step 5: Run PASS and commit**

```bash
npx vitest run src/数据/招聘事件源.test.ts src/状态/后端/use真人会话事件.test.tsx src/状态/应用状态.test.ts src/配置/vite代理合同.test.ts src/配置/运行配置.test.ts
git add src/数据/招聘事件源.ts src/数据/招聘事件源.test.ts src/状态/后端/use真人会话事件.ts src/状态/后端/use真人会话事件.test.tsx src/状态/应用状态.tsx src/状态/应用状态.test.ts vite.config.ts src/配置/vite代理合同.test.ts
git commit -m "feat: refresh P7 conversations from live events"
```

### Task 6: Extend P5 Publication to `complete + conversation_ref`

**Files:**

- Modify: `src/数据/招聘数据源/MatchCase.ts`
- Modify: `src/数据/招聘数据源/MatchCase.test.ts`
- Modify: `src/数据/MatchCase展示映射.ts`
- Modify: `src/数据/MatchCase展示映射.test.ts`
- Read: `src/状态/后端/useMatchCase轮询.ts`
- Run unchanged regression: `src/状态/后端/useMatchCase轮询.test.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.test.tsx`

**Interfaces:** Keep the existing 17 lifecycle/stage/status rows. Only the completed row accepts two legal steps:

```ts
type P5移交视图 =
  | { state: 'pending'; copy: '双方已确认，正在创建会话' }
  | { state: 'ready'; copy: '真人会话已建立'; conversationId: string };
```

- [ ] **Step 1: Write strict decoder RED tests**

Accept `completed/intent_confirmation/passed/handoff_pending` only without `conversation_ref`; accept `completed/intent_confirmation/passed/complete` only with a ref matching the released P5 pattern `^[1-9][0-9]{0,63}$`. Reject ref on open/ended/pending, complete without ref, empty/non-canonical ref, and any synthetic `published` field.

```ts
expect(解详情(completeWire({ conversation_ref: '3003' }), 'candidate')).toMatchObject({
  state: { step: 'complete' }, conversationRef: '3003',
});
expect(() => 解详情(pendingWire({ conversation_ref: '3003' }), 'candidate')).toThrow();
```

- [ ] **Step 2: Write mapper/polling/navigation RED tests**

Assert pending maps to a disabled button and `详情终局=false`; ready maps to enabled and `详情终局=true`; ended remains terminal. Candidate/recruiter ready buttons navigate through `路径.真人会话路径(conversationId)` / `路径.企业真人会话路径(conversationId)`. Add a long-pending/same-party fixture and advance multiple 3-second ticks: it stays pending, keeps reading, never navigates and never shows internal error/timeout.

- [ ] **Step 3: Run RED**

```bash
npx vitest run src/数据/招聘数据源/MatchCase.test.ts src/数据/MatchCase展示映射.test.ts src/状态/后端/useMatchCase轮询.test.tsx src/屏幕/P5/MatchCase详情.test.tsx
```

- [ ] **Step 4: Implement the two-step completed branch**

Add `'complete'` only to the existing completed matrix row. Decode optional `conversation_ref` at detail root with the step/ref joint invariant. Change the screen's polling stop scalar from `生命周期终局` to `ended || ready`. Keep all inputs/mutations disabled for both completed branches; only the ready chat button navigates.

```ts
const 会话已发布 = detail.state.lifecycle === 'completed'
  && detail.state.step === 'complete'
  && detail.conversationRef !== null;
const 详情终局 = detail.state.lifecycle === 'ended' || 会话已发布;
```

- [ ] **Step 5: Run PASS and commit**

```bash
npx vitest run src/数据/招聘数据源/MatchCase.test.ts src/数据/MatchCase展示映射.test.ts src/状态/后端/useMatchCase轮询.test.tsx src/屏幕/P5/MatchCase详情.test.tsx
git add src/数据/招聘数据源/MatchCase.ts src/数据/招聘数据源/MatchCase.test.ts src/数据/MatchCase展示映射.ts src/数据/MatchCase展示映射.test.ts src/屏幕/P5/MatchCase详情.tsx src/屏幕/P5/MatchCase详情.test.tsx
git commit -m "feat: connect P5 publication to P7 chat"
```

### Task 7: Add Browser Acceptance and Run the Full Gate

**Files:**

- Modify: `e2e/数据源模式.spec.ts`
- Modify: `docs/DEV_LOG.md`

**Interfaces:** Extends the existing data-source-mode route fixture with role-specific mutable P7 state. The fixture's messages response must be `{ messages, next_cursor }`; read response must be `{ read_through_message_id }`.

- [ ] **Step 1: Add mutable P7 HTTP and WebSocket fixtures**

```ts
interface P7FixtureState {
  messages: Record<string, Array<{
    message_id: string;
    kind: 'user_text';
    sender_role: 'candidate' | 'recruiter';
    content: string;
    created_at: string;
  }>>;
  unread: Record<P7角色, number>;
  sends: Array<{ role: P7角色; key: string; content: string }>;
  reads: Array<{ role: P7角色; through: string }>;
}
```

Stub native WebSocket before app load and expose a test-only `window.__emitP7(frame)` in the fixture. The product bundle must not contain that seam.

- [ ] **Step 2: Add Backend journeys**

Cover:

1. candidate inbox unread 1 → open → read-through → authoritative inbox 0;
2. candidate send and same-key replay show one message;
3. recruiter receives a content-free invalidation, then sees candidate text only after HTTP reread and replies;
4. reconnect triggers inbox/current-conversation reread;
5. context unavailable preserves messages and hides job/resume/contact actions;
6. foreign/wrong-role 404 does not retain prior conversation;
7. P5 pending remains disabled across polls, then complete ref opens exact candidate/recruiter route;
8. same-party/long pending never invents ref or timeout;
9. Mock candidate/recruiter journeys make zero `/conversations` HTTP calls and zero sockets.

- [ ] **Step 3: Run focused unit and browser verification**

```bash
npx vitest run \
  src/数据/招聘数据源/真人会话.test.ts \
  src/数据/招聘事件源.test.ts \
  src/状态/后端/真人会话操作.test.ts \
  src/状态/后端/use真人会话事件.test.tsx \
  src/屏幕/P7/Backend会话列表.test.tsx \
  src/屏幕/P7/Backend真人会话.test.tsx \
  src/屏幕/P5/MatchCase详情.test.tsx
npm run test:e2e:data-source -- --grep "P7|真人会话|handoff"
```

Expected: PASS.

- [ ] **Step 4: Verify one real un-stubbed WebSocket upgrade through Vite**

Start the stg Backend dev server in a managed terminal/session:

```bash
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=stg npm run dev -- --host 127.0.0.1 --port 4182
```

From a second terminal, send a real unauthenticated browser-shaped upgrade through Vite:

```bash
curl --http1.1 -i -N --max-time 10 \
  -H 'Connection: Upgrade' \
  -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  -H 'Origin: http://127.0.0.1:4182' \
  http://127.0.0.1:4182/api/v1/events/live
```

Expected: the request reaches stg and fails on the intentionally absent session (401 `invalid_session`), not 403 `invalid_origin`, Vite HTML, or connection refusal. This proves both upgrade proxying and `proxyReqWs` Origin rewrite without needing a real user cookie. Stop the managed dev server and record the status/body receipt in `docs/DEV_LOG.md`.

- [ ] **Step 5: Run static/build gates**

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: all exit 0.

- [ ] **Step 6: Run the authoritative broad test gate**

```bash
npm test
```

Expected: the full Vitest suite passes. This is required even if focused tests passed.

- [ ] **Step 7: Record evidence and commit**

Append to `docs/DEV_LOG.md`: frontend base, backend release SHA, focused test receipts, data-source Playwright receipt, un-stubbed Vite WebSocket upgrade receipt, typecheck/lint/build/full-test receipts, and any deliberately accepted known issue. Do not claim same-party fixed.

```bash
git add e2e/数据源模式.spec.ts docs/DEV_LOG.md
git commit -m "test: cover P7 conversation journeys"
git status --short
```

Expected: clean worktree.

## Final Completion Checklist

- [ ] `git log --oneline` shows one focused commit per Task.
- [ ] Backend mode imports no Mock message/contact fixtures in P7 branches.
- [ ] No P7 state or message content is written to localStorage/sessionStorage/Cache API.
- [ ] Search confirms no old Backend navigation uses the static Mock routes.
- [ ] Search confirms messages decoder and E2E use `messages`, not `items`.
- [ ] Candidate context action uses `job_ref`; recruiter PDF uses `case_id` and revokes its lease.
- [ ] `handoff_pending` continues polling; only `complete + conversation_ref` stops and navigates.
- [ ] WebSocket payload never enters message/unread/context state.
- [ ] 双端主壳在用户尚未打开消息 Tab 时，已能由首屏 P7 收件箱水合显示已加载未读角标。
- [ ] Task 7 的不 stub Vite WebSocket upgrade 得到 401 `invalid_session` 而非 403 `invalid_origin`，回执已记入 `docs/DEV_LOG.md`。
- [ ] Focused tests, data-source Playwright, typecheck, lint, build and full `npm test` all pass on the final commit.
