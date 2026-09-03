# Backend 候选接触记录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Backend 模式的“谁接触过我”只显示当前候选主体从 `GET /api/v1/me/contact-events` 读取的权威记录，空页、错误和会话切换时绝不混入 Mock 公司。

**Architecture:** 新增一个只负责 contact-events 的 strict facade；在 Backend 状态中增加单一候选分页快照，并用现有 subject/role/session fence 加一个域内读代际和单飞锁。页面只消费当前 owner 的成功快照；Mock 分支继续读取现有 `接触记录列表`。

**Tech Stack:** React 19、TypeScript 6、Vitest、Testing Library、现有 BFF HTTP 客户端与 Backend operation/provider。

**Spec:** `docs/superpowers/specs/2026-09-03-backend-data-truth-source-design.md`

## Global Constraints

- 实施前在干净隔离 worktree 中完整阅读 `CLAUDE.md`、`AGENTS.md`、Spec 和前序 MatchCase Plan；使用 `superpowers:using-git-worktrees`。
- 前序依赖：先集成 `2026-09-03-backend-matchcase-my-stats.md`，并保留其 `P5列表快照.ownerSubjectId`、legacy Case 清理 action 与 Provider 清理接线。
- Backend 页面不得 import Mock 接触记录；页面不得直接 `fetch`；失败不得回退旧成功 owner、Mock 或 localStorage。
- wire 合同固定为 BFF `origin/release/0.2.5@2be8c27489e9eef8fec20b83eb5fd443faf9dfbf` 的 OpenAPI：`limit` 1–50，cursor 非空 base64url 且最多 512 字节；本前端首屏显式请求 `limit=50`。
- 不新增加载更多视觉组件；状态和 operation 保留 `nextCursor` 与追加能力，但本屏只触发首屏读取。
- 不显示 recruiter 身份、职务、头像、source、浏览时长、详情 ID 或访问次数。
- 不修改 CSS、空态设计文案、90 天说明、隐私屏蔽逻辑或后端合同；每个代码 Task 严格 RED → GREEN 后提交。

## Prerequisites and completion

- 依赖 MatchCase Plan 是因为二者共同修改 `后端/类型.ts`、`应用状态.tsx` 和 `会话操作.ts`；若前序 commit 漂移，先按其 Handoff 校准，不能覆盖已合入的 P5 字段/清理。
- 完成标准：strict decoder、单飞/分页/fence/401、空页、三 action 映射、Backend/Mock 分支均有自动化证据；完整 package test 通过；工作树干净。
- 计划本身复杂度：中。原因：新域很小，但必须完整接入会话清理和迟到响应隔离。
- 零上下文漂移风险：中。原因：共享 Provider/状态文件可能被前序 Plan 修改；wire 合同已冻结。
- 执行模型档位：行业 Top 5–10 中高性价比模型。

---

### Task 1: 新增 strict contact-events data source 并组合进 HTTP 根数据源

**Files:**
- Create: `src/数据/招聘数据源/接触记录.ts`
- Create: `src/数据/招聘数据源/接触记录.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`

**Interfaces:**
- Consumes: `BFF客户端['请求']`；GET `/api/v1/me/contact-events?limit=50[&cursor=...]`。
- Produces: `接触事件动作`、`接触事件`、`接触事件页`、`接触记录数据源.读取接触事件(cursor?)`。
- Exact normalized DTO:

```ts
export type 接触事件动作 =
  | 'anonymous_profile_viewed'
  | 'contact_started'
  | 'submitted_resume_viewed';

export interface 接触事件 {
  eventId: string;
  organization: { organizationId: string; displayName: string };
  action: 接触事件动作;
  occurredAt: string;
}

export interface 接触事件页 {
  items: 接触事件[];
  nextCursor: string | null;
}

export interface 接触记录数据源 {
  读取接触事件(cursor?: string): Promise<接触事件页>;
}
```

- Invariants: response 对象 exact-key；`event_id` 匹配 `^cev_[0-9a-f]{32}$`；`organization_id` 匹配 `^org_[0-9a-f]{32}$`；`display_name` 长度 1–200；时间满足 RFC3339 正则且 `Date.parse` 有效；同页 event ID 不重复；响应/调用方 cursor 均为非空 base64url 且不超过 512 字节。

- [ ] **Step 1: 写 decoder 与 facade 失败测试**

在新测试文件中定义闭合 wire fixture，并逐项覆盖合法页、三个 action、未知键、坏 enum、坏时间、坏 ID、空/过长 display name、重复 event ID、坏/过长/重复 `next_cursor`。核心 fixture 与断言：

```ts
const wire页 = {
  items: [{
    event_id: 'cev_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    organization: {
      organization_id: 'org_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      display_name: 'Acme',
    },
    action: 'contact_started',
    occurred_at: '2026-09-01T08:00:00Z',
  }],
  next_cursor: null,
};

it.each([
  'anonymous_profile_viewed',
  'contact_started',
  'submitted_resume_viewed',
] as const)('接受闭合 action %s', (action) => {
  expect(解接触事件页({ ...wire页, items: [{ ...wire页.items[0], action }] }).items[0].action)
    .toBe(action);
});

it.each([
  { ...wire页, extra: true },
  { ...wire页, items: [{ ...wire页.items[0], recruiter_name: 'Alice' }] },
  { ...wire页, items: [{ ...wire页.items[0], action: 'profile_downloaded' }] },
  { ...wire页, items: [{ ...wire页.items[0], occurred_at: 'yesterday' }] },
  { ...wire页, next_cursor: 'bad cursor' },
])('契约漂移 fail closed', (input) => {
  expect(() => 解接触事件页(input)).toThrowError(
    expect.objectContaining({ status: 200, code: 'invalid_response' }),
  );
});
```

facade 用 mock `请求` 证明：无 cursor 请求 `{ path:'/api/v1/me/contact-events?limit=50', 不缓存:true }`；有 cursor 时 URL encode；非法调用方 cursor 在请求前抛 `BFF错误(0, 'invalid_request', ...)` 且请求为零。

`HTTP招聘数据源.test.ts` 加根组合 smoke test，断言创建后的对象具有 `读取接触事件`，并由共用 mock client 捕获正确路径。

- [ ] **Step 2: 运行 RED**

```bash
npx vitest run src/数据/招聘数据源/接触记录.test.ts src/数据/HTTP招聘数据源.test.ts
```

Expected: FAIL，新模块和根方法尚不存在。

- [ ] **Step 3: 实现最小 strict facade**

`接触记录.ts` 复用相邻 facade 的本地 guard 纪律，不导出通用 decoder 框架。关键实现必须等价于：

```ts
const 游标模式 = /^[A-Za-z0-9_-]+$/;
const RFC3339模式 = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;
const 事件ID模式 = /^cev_[0-9a-f]{32}$/;
const 组织ID模式 = /^org_[0-9a-f]{32}$/;
const 动作全表 = [
  'anonymous_profile_viewed', 'contact_started', 'submitted_resume_viewed',
] as const;

export function 解接触事件页(input: unknown): 接触事件页 {
  const raw = 要求闭合对象(input, ['items', 'next_cursor']);
  const ids = new Set<string>();
  const items = 要求数组(raw.items).map((item) => {
    const row = 要求闭合对象(item, ['event_id', 'organization', 'action', 'occurred_at']);
    const organization = 要求闭合对象(row.organization, ['organization_id', 'display_name']);
    const eventId = 要求模式串(row.event_id, 事件ID模式);
    if (ids.has(eventId)) throw 契约错误();
    ids.add(eventId);
    return {
      eventId,
      organization: {
        organizationId: 要求模式串(organization.organization_id, 组织ID模式),
        displayName: 要求限长非空字符串(organization.display_name, 200),
      },
      action: 要求枚举(row.action, 动作全表),
      occurredAt: 要求RFC3339(row.occurred_at),
    };
  });
  return { items, nextCursor: 解下一游标(raw.next_cursor) };
}

export function 创建接触记录数据源(请求: BFF客户端['请求']): 接触记录数据源 {
  return {
    async 读取接触事件(cursor?: string): Promise<接触事件页> {
      const query = cursor === undefined
        ? '?limit=50'
        : `?limit=50&cursor=${encodeURIComponent(校验调用方游标(cursor))}`;
      const { result } = await 请求<unknown>({
        path: `/api/v1/me/contact-events${query}`,
        不缓存: true,
      });
      return 解接触事件页(result);
    },
  };
}
```

在 `HTTP招聘数据源.ts` import `接触记录数据源`/`创建接触记录数据源`，把前者加入交集类型、后者 spread 到根 factory。不要向其它 facade 塞 contact 方法。

- [ ] **Step 4: 运行 GREEN 与提交**

运行 Step 2 同一命令，Expected: PASS。

```bash
git add src/数据/招聘数据源/接触记录.ts src/数据/招聘数据源/接触记录.test.ts src/数据/HTTP招聘数据源.ts src/数据/HTTP招聘数据源.test.ts
git commit -m "feat: add strict contact events data source"
```

---

### Task 2: 接入 candidate/session-fenced 接触记录状态与 operation

**Files:**
- Modify: `src/状态/后端/类型.ts`
- Create: `src/状态/后端/接触记录操作.ts`
- Create: `src/状态/后端/接触记录操作.test.ts`

**Interfaces:**
- Produces state `接触记录: 接触记录快照`，operation `加载接触记录(force?)`、`追加接触记录()`，runtime refs `接触记录代际`、`接触记录读取锁` 与 `接触记录已消费游标`。
- Snapshot:

```ts
export interface 接触记录快照 {
  ownerSubjectId: string | null;
  阶段: '未开始' | '进行中' | '成功' | '失败';
  刷新中: boolean;
  items: 接触事件[];
  nextCursor: string | null;
  已加载页数: number;
  error: string | null;
  generation: number;
}
```

- Fence tuple: `subject_id + active role(candidate) + session generation + 接触记录代际`；迟到成功/失败/401 只释放自己的锁，不写状态、不清新会话。
- Pagination: first/force 从 cursor absent 重建一页；append 只用快照 `nextCursor`，成功原子追加；next cursor 等于请求 cursor、页内 ID 重复或与已载窗口重叠时按 `invalid_response` 整次失败，旧成功窗口保留、不混半页。

- [ ] **Step 1: 写 operation 失败测试**

测试文件自建完整 `后端操作依赖` fixture，直接沿用 `MatchCase操作.test.ts` 的 `deferred` 和状态构造风格；`env` 必须暴露 `数据源`、`操作`、`deps`、`派发` 和 `当前()`。事件 fixture 明确定义为：

```ts
const 事件A: 接触事件 = {
  eventId: 'cev_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  organization: {
    organizationId: 'org_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    displayName: 'Acme',
  },
  action: 'contact_started',
  occurredAt: '2026-09-01T08:00:00Z',
};

it('首载成功写 owner、items、cursor 与页数；重复调用单飞', async () => {
  const gate = deferred<接触事件页>();
  vi.mocked(env.数据源.读取接触事件).mockReturnValue(gate.promise);
  const first = env.操作.加载接触记录();
  const second = env.操作.加载接触记录();
  expect(env.数据源.读取接触事件).toHaveBeenCalledTimes(1);
  gate.resolve({ items: [事件A], nextCursor: 'cursor_2' });
  await Promise.all([first, second]);
  expect(env.当前().接触记录).toMatchObject({
    ownerSubjectId: 'sub_1', 阶段: '成功', items: [事件A],
    nextCursor: 'cursor_2', 已加载页数: 1,
  });
});

it('追加原子提交且拒绝重复事件和不前进游标', async () => {
  vi.mocked(env.数据源.读取接触事件)
    .mockResolvedValueOnce({ items: [事件A], nextCursor: 'cursor_2' })
    .mockResolvedValueOnce({ items: [事件A], nextCursor: 'cursor_2' });
  await env.操作.加载接触记录();
  await env.操作.追加接触记录();
  expect(env.当前().接触记录.items).toEqual([事件A]);
  expect(env.当前().接触记录.error).not.toBeNull();
});

it('换主体/角色/会话后的迟到 response 与迟到 401 整包丢弃', async () => {
  const gate = deferred<接触事件页>();
  vi.mocked(env.数据源.读取接触事件).mockReturnValue(gate.promise);
  const run = env.操作.加载接触记录();
  env.deps.主体标识引用.current = 'sub_2';
  env.deps.会话代际.current = 2;
  env.deps.后端状态引用.current = {
    ...env.deps.后端状态引用.current,
    主体: { ...BFF主体样本, subject_id: 'sub_2', last_used_role: 'candidate' },
  };
  gate.resolve({ items: [事件A], nextCursor: null });
  await run;
  expect(env.当前().接触记录.items).toEqual([]);
  expect(env.派发).not.toHaveBeenCalled();
});
```

另测：Mock/无后端/非 candidate 零请求；当前 fence 的 401 走统一 `清账号状态`；首载失败为 error 空记录；刷新失败保留同 owner 旧成功；cursor 已尽追加零请求；清引用后旧锁不阻挡新读。

- [ ] **Step 2: 运行 RED**

Run: `npx vitest run src/状态/后端/接触记录操作.test.ts`

Expected: FAIL，新状态与 operation 不存在。

- [ ] **Step 3: 实现最小状态、引用与 operation**

在 `类型.ts` 让 `后端状态 extends 接触记录状态`，给 `后端操作依赖` 增加可选 runtime refs，并让页面操作接口并入 `应用操作`：

```ts
export interface 接触记录状态 { 接触记录: 接触记录快照 }
export interface 接触记录运行时引用 {
  接触记录代际: 可变引用<number>;
  接触记录读取锁: 可变引用<Promise<void> | null>;
  接触记录已消费游标: 可变引用<Set<string>>;
}
export interface 接触记录操作 {
  加载接触记录(force?: boolean): Promise<void>;
  追加接触记录(): Promise<void>;
}
```

新 operation 导出 `创建空接触记录状态`、`清接触记录引用`、`创建接触记录操作`。工厂入口检查 refs 已注入；捕获 fence 后检查当前主体仍为同一 candidate。当前 401 调 `清账号状态` 并再次把本域摊平；非 401 只写闭合中文错误态。

读锁必须持有本次 Promise 身份，防旧请求 finally 删除新请求锁：

```ts
const 本次 = 运行读取(模式);
const 收口 = 本次.finally(() => {
  if (接触记录读取锁.current === 收口) 接触记录读取锁.current = null;
});
接触记录读取锁.current = 收口;
return 收口;
```

非 force 首载若当前 owner 成功则零请求；owner 不同不得复用。force 先递增 `接触记录代际`，允许接管过期锁，并在第一页重建前清空已消费 cursor 集。append 在请求前验证 cursor 尚未消费并立即登记；重复消费不发请求。decoder 虽已拒绝坏 cursor，operation 仍须拒绝 `page.nextCursor === requestCursor` 以及与现有 item ID 重叠，整页不提交。

- [ ] **Step 4: 运行 GREEN 与提交**

Run: `npx vitest run src/状态/后端/接触记录操作.test.ts`

Expected: PASS。

```bash
git add src/状态/后端/类型.ts src/状态/后端/接触记录操作.ts src/状态/后端/接触记录操作.test.ts
git commit -m "feat: add fenced contact events operation"
```

---

### Task 3: 把接触记录域注入 Provider 与所有会话清理入口

**Files:**
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/应用状态.test.ts`
- Modify: 受 `后端状态` 完整对象类型影响的既有测试 fixture（只补 `...创建空接触记录状态()`）

**Interfaces:**
- Provider seed: `...创建空接触记录状态()`。
- Provider refs: `useRef(0)`、`useRef<Promise<void> | null>(null)` 与 `useRef(new Set<string>())`，一次性注入 operation deps。
- Session boundary: subject 或 active role 变化时清状态与引用；`清账号状态` 同样清理；换角色到 recruiter 后不会保留 candidate 记录。

- [ ] **Step 1: 写 Provider/session 失败测试**

在 `应用状态.test.ts` 复用现有 Provider 后端测试宿主，新增：candidate 加载成功后登出、切 recruiter、换 candidate subject 三条断言，均要求 `接触记录` 回 pristine；再用 deferred 证明旧 candidate response 不会落到新主体。

```ts
expect(当前.后端状态.接触记录).toEqual({
  ownerSubjectId: null,
  阶段: '未开始', 刷新中: false, items: [], nextCursor: null,
  已加载页数: 0, error: null, generation: 0,
});
```

同时在现有 Backend 初始化 smoke test 断言 `操作.加载接触记录` 与 `操作.追加接触记录` 存在；Mock Provider 创建不会发 contact 请求。

- [ ] **Step 2: 运行 RED**

Run: `npx vitest run src/状态/应用状态.test.ts`

Expected: FAIL，Provider 尚未种下/注入/清理本域。

- [ ] **Step 3: 接入 Provider 和统一清理**

在 `应用状态.tsx`：

```ts
const 接触记录代际 = useRef(0);
const 接触记录读取锁 = useRef<Promise<void> | null>(null);
const 接触记录已消费游标 = useRef(new Set<string>());
const 接触记录会话基 = useRef('');

useEffect(() => {
  const 主体 = 后端状态.主体;
  const 基 = 主体 === null ? '' : `${主体.subject_id}|${主体.last_used_role}`;
  if (接触记录会话基.current === 基) return;
  接触记录会话基.current = 基;
  清接触记录引用({ 接触记录代际, 接触记录读取锁, 接触记录已消费游标 });
  设后端状态((旧) => ({ ...旧, ...创建空接触记录状态() }));
}, [后端状态.主体]);
```

把 refs 放入 `后端操作依赖`，把 `创建接触记录操作(deps)` spread 进 `应用操作`。在首帧后端状态和 `清账号状态` 的 state update 中各 spread `创建空接触记录状态()`；在 `清账号状态` 结尾调用 `清接触记录引用(deps)`。所有构造完整 `后端状态` 的测试 fixture 只补新底座，不改其行为。

- [ ] **Step 4: 运行 GREEN 与共享状态回归后提交**

```bash
npx vitest run src/状态/应用状态.test.ts src/状态/后端/接触记录操作.test.ts src/状态/后端/MatchCase操作.test.ts
```

Expected: PASS。

```bash
git add src/状态/应用状态.tsx src/状态/后端/会话操作.ts src/状态/应用状态.test.ts src/状态/后端/类型.ts src/状态/后端/接触记录操作.ts src/状态/后端/接触记录操作.test.ts
git add -u
git commit -m "feat: wire contact events into backend sessions"
```

---

### Task 4: 页面按数据源模式渲染权威快照与纯展示映射

**Files:**
- Create: `src/屏幕/接触记录.test.tsx`
- Modify: `src/屏幕/接触记录.tsx`

**Interfaces:**
- Consumes: `数据源模式`、`后端状态.主体`、`后端状态.接触记录`、`操作.加载接触记录`、Mock `接触记录列表`。
- Pure mapping: `anonymous_profile_viewed → 匿名画像被查看`，`contact_started → 发起接触`，`submitted_resume_viewed → 递交简历后查看`；时间用本地化绝对日期时间，不改变 wire snapshot。
- Backend rendering gate: 仅 `阶段 === '成功' && ownerSubjectId === current candidate subject` 时渲染 items；未开始/进行中/失败/owner mismatch 均渲染零业务行，保留现有空容器；首载错误可通过重新进入页面或现有返回路径后再进入重试，且本次挂载调用 `加载接触记录()`。

- [ ] **Step 1: 写页面失败测试**

测试 mock `use应用状态` 与导航；复用 Task 2 的完整 `事件A`，并定义稳定 `加载接触记录` spy。`渲染Backend` 必须把缺省快照补全，避免稀疏测试对象掩盖真实字段：

```ts
const 加载接触记录 = vi.fn(async () => undefined);

function 渲染Backend(patch: Partial<接触记录快照>) {
  mock应用状态 = {
    数据源模式: 'backend',
    后端状态: {
      主体: { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'candidate' },
      接触记录: {
        ownerSubjectId: 'sub_1', 阶段: '成功', 刷新中: false,
        items: [], nextCursor: null, 已加载页数: 1,
        error: null, generation: 1,
        ...patch,
      },
    },
    操作: { 加载接触记录 },
  };
  return render(<接触记录 />);
}

it('Backend 空成功页显示空态且零 Mock 公司', async () => {
  渲染Backend({ 阶段: '成功', ownerSubjectId: 'sub_1', items: [], nextCursor: null });
  expect(screen.getByText('最近还没有企业接触过你')).toBeTruthy();
  expect(screen.queryByText(接触记录列表[0].公司)).toBeNull();
  await waitFor(() => expect(加载接触记录).toHaveBeenCalledTimes(1));
});

it.each([
  ['anonymous_profile_viewed', '匿名画像被查看'],
  ['contact_started', '发起接触'],
  ['submitted_resume_viewed', '递交简历后查看'],
] as const)('%s 只映射为既有动作语义', (action, label) => {
  渲染Backend({ items: [{ ...事件A, action }], ownerSubjectId: 'sub_1', 阶段: '成功' });
  expect(screen.getByText(label)).toBeTruthy();
  expect(screen.queryByText('Alice Recruiter')).toBeNull();
});
```

另测：loading/error/owner mismatch 不显示 Mock；存在 `nextCursor` 时只显示当前 50 条且不出现“全部”承诺；Mock 显示原记录且 `加载接触记录` 零调用。

- [ ] **Step 2: 运行 RED**

Run: `npx vitest run src/屏幕/接触记录.test.tsx`

Expected: FAIL，页面仍直接渲染 Mock 常量且未调用 operation。

- [ ] **Step 3: 实现纯映射和模式分支**

页面保留 Mock import 但只在 Mock 分支消费。导出纯函数供测试直接穷举：

```ts
export function 格式化接触时间(occurredAt: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(occurredAt));
}

export function 接触事件到展示(event: 接触事件): 接触记录条 {
  const 动作文案: Record<接触事件动作, 接触记录条['动作']> = {
    anonymous_profile_viewed: '匿名画像被查看',
    contact_started: '发起接触',
    submitted_resume_viewed: '递交简历后查看',
  };
  return {
    编号: event.eventId,
    公司: event.organization.displayName,
    公司首字: Array.from(event.organization.displayName)[0] ?? '',
    动作: 动作文案[event.action],
    时间: 格式化接触时间(event.occurredAt),
  };
}
```

保持 `接触记录条['动作']` 现有三个字面值，不修改 `数据/类型.ts`。组件中：

```ts
const 是后端 = 数据源模式 === 'backend';
const subjectId = 后端状态.主体?.last_used_role === 'candidate'
  ? 后端状态.主体.subject_id
  : null;
const 可见Backend事件 = 后端状态.接触记录.阶段 === '成功' &&
  后端状态.接触记录.ownerSubjectId === subjectId
  ? 后端状态.接触记录.items
  : [];
const 页面记录 = 是后端 ? 可见Backend事件.map(接触事件到展示) : 接触记录列表;

useEffect(() => {
  if (!是后端 || subjectId === null) return;
  void 操作.加载接触记录().catch(() => undefined);
}, [是后端, subjectId, 操作]);
```

随后只把原 JSX 的 `接触记录列表` 数据变量替换成 `页面记录`；不改结构、className、说明条、空态或页脚。

- [ ] **Step 4: 运行 GREEN、相关回归并提交**

```bash
npx vitest run src/屏幕/接触记录.test.tsx src/状态/后端/接触记录操作.test.ts src/数据/招聘数据源/接触记录.test.ts
```

Expected: PASS。

```bash
git add src/屏幕/接触记录.tsx src/屏幕/接触记录.test.tsx
git commit -m "fix: render authoritative candidate contact events"
```

---

### Task 5: Plan 范围验证、异构 review 与 Handoff

**Files:**
- No product changes expected; only reviewer-required fixes inside this Plan scope.

- [ ] **Step 1: 静态验证**

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: 全部 exit 0。

- [ ] **Step 2: 异构 code review**

当前宿主若是 Codex，调用 Claude 多轮 code review；当前宿主若是 Claude Code，调用 Codex 多轮 code review。只审本 Plan diff，逐条核实，再以 RED→GREEN 修 required/值得修的 minor finding；每轮修复提交。

- [ ] **Step 3: 唯一 authoritative plan-scope gate**

```bash
npm test
```

Expected: exit 0。本仓库没有正式 affected runner，完整 package Vitest 是唯一 broad gate。

- [ ] **Step 4: Handoff 与 clean tree**

按批次 manifest 固定路径写 `handoff_version: 5` Handoff，记录 READY/NOT_READY、唯一 verdict、commits、review rounds、测试 evidence、`dependency_drift`。然后：

```bash
git status --short
git log -1 --oneline
```

Expected: status 无输出；commit 可解析。

## Plan-scope testing boundary

- Task/inner-loop：各 Task 定向 Vitest，以及 `typecheck`、`lint`、`build`。
- Authoritative plan-scope gate：唯一 `npm test`。
- L3/shared environment：`integration_requirement: none`；`selection_ssot: none`；`selection_gap: none`；`l3_selection: []`。BFF 合同已由后端 OpenAPI/BFF 测试冻结，本 Plan 不要求共享后端才能判定前端实现。
- 可选 L2：rolling integration owner 可在组合 commit 上运行 fixture Backend E2E；它不得冒充真实 BFF L3。
- Release handoff：`required: false`、`owner: none`、`required_mode: none`、`nightly_only_mode: none`、`status: none`。

## Non-goals

- 不新增加载更多按钮、无限滚动、自动拉全量、后台轮询或 `total`。
- 不改变屏蔽组织合同、90 天留存、空态视觉或说明文案。
- 不建立 recruiter 身份、事件详情页、localStorage cache 或通用分页框架。
