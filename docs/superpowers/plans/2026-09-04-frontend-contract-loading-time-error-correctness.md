# 前端合同、加载、时间与错误正确性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 接受合法 Agent 设置初始快照，明确接触记录加载/失败/空数据，按本地时区显示账户时间，并阻止原始后端错误泄漏。

**Architecture:** 只修改现有 DTO/decoder、页面纯 formatter、页面状态 gate 和全局错误文案函数。所有读取、重试、single-flight、owner/session fence 与 P8 operation 保持原样；不抽通用日期或诊断基础设施。

**Tech Stack:** TypeScript、React 18、Intl.DateTimeFormat、Vitest、Testing Library。

**Spec:** `docs/superpowers/specs/2026-09-04-frontend-truthfulness-route-state-repair-design.md`

## Global Constraints

- 开始前完整阅读 `CLAUDE.md`、`AGENTS.md` 和 Spec。
- 不放宽 strict decoder：`null` 只对两个 Agent 设置 `updated_at` 合法；非 null 仍需逐分量合法 RFC3339，extra key 仍拒绝。
- 接触记录只改页面渲染；不得修改 data source、operation、分页、single-flight 或 owner/session/role fence。
- 日期生产环境默认浏览器本地时区，测试才传固定 `timeZone`；不引入日期库或跨页面工具模块。
- 原始 BFF message 不得进入全局 UI fallback；本地已审核校验文案继续可见。
- 不接入后端未合入的 MatchCase summary、candidate verification 或 Hosted Agent 合同。
- PM 视觉冻结：不改 CSS、className、内联布局、DOM 布局骨架或区块顺序，不新增 React 组件/组件文件；loading/error 只占用页面已有内容容器与动作槽位。
- 每个 Task 严格执行 red → green → commit。

---

### Task 1: Agent 设置接受 `revision=0, updated_at=null`

**Files:**
- Modify: `src/数据/BFF契约.ts`
- Modify: `src/数据/招聘数据源/Agent设置.ts`
- Modify: `src/数据/招聘数据源/Agent设置.test.ts`
- Modify: `src/屏幕/规则库.test.tsx`
- Modify: `src/屏幕/企业代理设置.test.tsx`

**Interfaces:**
- Consumes: 后端公开 Candidate/Recruiter AgentSettings。
- Produces: `BFF候选Agent设置.updated_at: string | null`、`BFF招聘Agent设置.updated_at: string | null`；`要求可空时间(value): string | null`。

- [ ] **Step 1: 写 decoder 失败测试**

在 `Agent设置.test.ts` 增加双端表测：

```ts
it.each(['candidate', 'recruiter'] as const)('%s 接受初始 nullable 时间', async (role) => {
  const result = role === 'candidate'
    ? { material_submission: 'ask_first', out_of_authority_concession: 'reject', revision: 0, updated_at: null }
    : { out_of_authority_concession: 'ask_first', revision: 0, updated_at: null };
  请求.mockResolvedValue({ result });
  await expect(创建Agent设置数据源(请求 as 请求函数).读取Agent设置(role))
    .resolves.toEqual(result);
});

it.each([
  42,
  '',
  '2026-02-30T00:00:00Z',
  '2026-09-03 19:00:00',
  '2026-09-03T24:00:00Z',
])('拒绝非法 updated_at %j', async (updated_at) => {
  请求.mockResolvedValue({ result: { ...候选设置, updated_at } });
  await expect(创建Agent设置数据源(请求 as 请求函数).读取Agent设置('candidate'))
    .rejects.toMatchObject({ code: 'invalid_response' });
});
```

继续覆盖合法带偏移时间和 extra key 拒绝。把候选/招聘页面状态桩的设置快照改为 `revision: 0, updated_at: null`，断言控件可用、保存调用带 revision 0，DOM 无“设置加载失败”。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/数据/招聘数据源/Agent设置.test.ts src/屏幕/规则库.test.tsx src/屏幕/企业代理设置.test.tsx
```

Expected: nullable 用例因当前 `要求时间` 拒绝而 FAIL。

- [ ] **Step 3: 修改 DTO 和严格可空 decoder**

```ts
export interface BFF候选Agent设置 {
  material_submission: BFF材料发送偏好;
  out_of_authority_concession: BFF超授权让步偏好;
  revision: number;
  updated_at: string | null;
}

const RFC3339模式 = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

function 要求时间(value: unknown): string {
  if (typeof value !== 'string') throw 契约错误();
  const 组 = RFC3339模式.exec(value);
  if (组 === null || Number.isNaN(Date.parse(value))) throw 契约错误();
  const [, 年文, 月文, 日文, 时文, 分文, 秒文] = 组;
  const 年 = Number(年文), 月 = Number(月文), 日 = Number(日文);
  const 时 = Number(时文), 分 = Number(分文), 秒 = Number(秒文);
  const 月末 = new Date(Date.UTC(年, 月, 0)).getUTCDate();
  if (月 < 1 || 月 > 12 || 日 < 1 || 日 > 月末 || 时 > 23 || 分 > 59 || 秒 > 59) {
    throw 契约错误();
  }
  return value;
}

function 要求可空时间(value: unknown): string | null {
  return value === null ? null : 要求时间(value);
}
```

招聘 DTO 同样改为 `string | null`；`解设置` 调 `要求可空时间(raw.updated_at)`。不要把 null 替换成当前时间，也不要抽取全仓时间 decoder。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/数据/招聘数据源/Agent设置.test.ts src/屏幕/规则库.test.tsx src/屏幕/企业代理设置.test.tsx
git add src/数据/BFF契约.ts src/数据/招聘数据源/Agent设置.ts src/数据/招聘数据源/Agent设置.test.ts src/屏幕/规则库.test.tsx src/屏幕/企业代理设置.test.tsx
git commit -m "fix: accept initial agent settings snapshot"
```

Expected: PASS。

### Task 2: 接触记录区分 loading、failure、empty 与 refresh error

**Files:**
- Modify: `src/屏幕/接触记录.tsx`
- Modify: `src/屏幕/接触记录.test.tsx`

**Interfaces:**
- Consumes: `接触记录快照` 的 `ownerSubjectId`、`阶段`、`刷新中`、`items`、`error`；`操作.加载接触记录(force?: boolean)`。
- Produces: 页面状态 gate 和 retry；不产生新 state。

- [ ] **Step 1: 写状态矩阵失败测试**

```tsx
it('当前 owner 进行中显示中性加载态', () => {
  渲染Backend({ 阶段: '进行中', ownerSubjectId: 'sub_1' });
  expect(screen.getByRole('status').textContent).toContain('正在读取接触记录');
});

it('首载失败显示安全错误和 force retry', async () => {
  const user = userEvent.setup();
  渲染Backend({
    阶段: '失败',
    ownerSubjectId: 'sub_1',
    error: '后端服务暂时不可用，请稍后重试',
  });
  expect(screen.getByRole('alert').textContent).toContain('后端服务暂时不可用');
  await user.click(screen.getByRole('button', { name: '重试' }));
  expect(加载接触记录).toHaveBeenLastCalledWith(true);
});

it('成功旧窗口刷新失败时保留列表并提供重试', () => {
  渲染Backend({
    阶段: '成功',
    ownerSubjectId: 'sub_1',
    items: [事件A],
    error: '服务返回异常，请稍后重试',
  });
  expect(screen.getByText('Acme')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('服务返回异常');
});
```

保留成功空/非空、Mock 和 owner mismatch 测试；owner mismatch 必须无旧列表和权威空态。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/屏幕/接触记录.test.tsx
```

Expected: loading/failure 当前没有可见状态，retry 不存在。

- [ ] **Step 3: 实现纯渲染 gate**

```tsx
const 当前Owner = subjectId !== null &&
  后端状态.接触记录.ownerSubjectId === subjectId;
const 权威成功 = 是后端 && 当前Owner && 后端状态.接触记录.阶段 === '成功';
const 首载中 = 是后端 && subjectId !== null &&
  (!当前Owner || 后端状态.接触记录.阶段 === '未开始' ||
   后端状态.接触记录.阶段 === '进行中');
const 首载失败 = 是后端 && 当前Owner && 后端状态.接触记录.阶段 === '失败';
const 错误 = 当前Owner ? 后端状态.接触记录.error : null;
```

在说明条之后按顺序渲染 loading `role="status"`、failure `role="alert"` + 重试、成功列表/空态。`权威成功 && error !== null` 时列表仍在并额外显示可重试错误。重试精确调用：

```tsx
<button type="button" onClick={() => { void 操作.加载接触记录(true).catch(() => undefined); }}>
  重试
</button>
```

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/屏幕/接触记录.test.tsx src/状态/后端/接触记录操作.test.ts
git add src/屏幕/接触记录.tsx src/屏幕/接触记录.test.tsx
git commit -m "fix: expose contact event loading failures"
```

Expected: PASS；operation/fence 测试不变。

### Task 3: 账户时间按指定本地时区格式化

**Files:**
- Modify: `src/屏幕/账号安全.tsx`
- Modify: `src/屏幕/账号安全.test.tsx`

**Interfaces:**
- Consumes: RFC3339 string。
- Produces: `格式化账户时间(iso: string, timeZone?: string): string`。

- [ ] **Step 1: 写 formatter 与两处调用失败测试**

```tsx
expect(格式化账户时间('2026-09-03T16:30:00Z', 'Asia/Shanghai'))
  .toBe('2026-09-04 00:30');
expect(格式化账户时间('2026-03-08T07:30:00Z', 'America/New_York'))
  .toBe('2026-03-08 03:30');
expect(格式化账户时间('not-a-time', 'Asia/Shanghai')).toBe('—');
```

页面测试固定测试环境时区或 mock 导出的 formatter，断言当前会话的 created/expires 与 data export expires 都使用同一输出，不再出现 UTC slice 文本。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/屏幕/账号安全.test.tsx
```

Expected: UTC+8 跨日和 DST 用例 FAIL。

- [ ] **Step 3: 实现 page-local formatter 并替换三处调用**

```ts
export function 格式化账户时间(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return value('year') && value('month') && value('day') && value('hour') && value('minute')
    ? value('year') + '-' + value('month') + '-' + value('day') + ' ' + value('hour') + ':' + value('minute')
    : '—';
}
```

删除 `取展示时间`；当前会话创建/失效和导出到期均调用新函数。生产调用不传 `timeZone`。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/屏幕/账号安全.test.tsx
git add src/屏幕/账号安全.tsx src/屏幕/账号安全.test.tsx
git commit -m "fix: format account timestamps locally"
```

Expected: PASS。

### Task 4: 全局错误文案封闭 5xx、internal_error 和未知 4xx

**Files:**
- Modify: `src/数据/HTTP客户端.ts`
- Modify: `src/数据/HTTP客户端.test.ts`

**Interfaces:**
- Consumes: `BFF错误.status`、`code`、`message`；`客户端校验错误`。
- Produces: `取后端错误文案(error): string` 的安全闭合 fallback。

- [ ] **Step 1: 写错误矩阵失败测试**

```ts
it.each([
  [500, 'internal_error'],
  [502, 'downstream_unavailable'],
  [503, 'downstream_unavailable'],
  [504, 'gateway_timeout'],
  [400, 'internal_error'],
])('%i/%s 不泄漏原始 message', (status, code) => {
  const text = 取后端错误文案(new BFF错误(status, code, 'database password leaked'));
  expect(text).toBe('后端服务暂时不可用，请稍后重试');
  expect(text).not.toContain('database');
});

it('未知 BFF 4xx 不泄漏未审核 message', () => {
  expect(取后端错误文案(new BFF错误(418, 'unknown_business_code', 'raw english')))
    .toBe('请求失败，请稍后再试');
});
```

保留 network、invalid_response、invalid_session、invalid_origin、version_conflict、validation_failed、普通 Error 和 status 0 `invalid_request` 的现有断言。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/数据/HTTP客户端.test.ts
```

Expected: 500、internal_error 和未知 4xx 泄漏 message。

- [ ] **Step 3: 收紧映射顺序**

```ts
if (error.code === 'network_error') return '无法连接后端服务，请检查网络或稍后重试';
if (error.status >= 500 || error.code === 'internal_error') {
  return '后端服务暂时不可用，请稍后重试';
}
if (error.code === 'invalid_response') return '服务返回异常，请稍后重试';
// 保留 invalid_session / invalid_origin / version_conflict / validation_failed。
if (error.status === 0 && error.code === 'invalid_request' && error.message) {
  return error.message;
}
return '请求失败，请稍后再试';
```

只有 status 0 的客户端自铸 `invalid_request` 可以沿用其本地可行动 message；未知远端 4xx 不得透传。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/数据/HTTP客户端.test.ts
git add src/数据/HTTP客户端.ts src/数据/HTTP客户端.test.ts
git commit -m "fix: hide unreviewed backend error messages"
```

Expected: PASS。

### Task 5: 运行本 Plan 联合验证

**Files:**
- Test: all files changed by this Plan

**Interfaces:**
- Consumes: Tasks 1–4。
- Produces: decoder、页面状态、时间和错误映射的联合回归证据。

- [ ] **Step 1: 运行定向测试与静态检查**

```bash
npx vitest run   src/数据/招聘数据源/Agent设置.test.ts   src/屏幕/规则库.test.tsx   src/屏幕/企业代理设置.test.tsx   src/屏幕/接触记录.test.tsx   src/状态/后端/接触记录操作.test.ts   src/屏幕/账号安全.test.tsx   src/数据/HTTP客户端.test.ts
npm run typecheck
npm run lint
```

Expected: 全部 PASS / exit 0。

- [ ] **Step 2: 检查变更边界**

```bash
git diff --check
git status --short
```

Expected: 无未提交变更；未修改接触记录 operation/data source 和 P8 operation。

## Plan Completion Check

- [ ] 两端 `revision=0, updated_at=null` 可读取、渲染并用 revision 0 保存。
- [ ] 非 null Agent 时间逐分量校验，extra key 与非法时间继续 fail closed。
- [ ] 接触记录 loading、首载失败、成功空、成功非空和 refresh error 可区分。
- [ ] 账户会话与导出时间使用同一本地 formatter。
- [ ] 5xx、`internal_error` 和未知 BFF 4xx 不含原始 message。
- [ ] 实现范围的 `git diff --name-only` 不含 CSS/产品组件新文件；非测试产品代码的 diff 不含 className、内联布局或页面骨架改动，也没有新增 React 组件声明。
