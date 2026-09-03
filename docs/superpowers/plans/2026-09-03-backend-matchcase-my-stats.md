# Backend MatchCase “我的”统计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让候选端和招聘端“我的”页只显示当前 Backend 主体的权威 open MatchCase 统计，同时清除所有 legacy Mock Case 状态。

**Architecture:** 保留现有 P5 data source、scope、operation、单飞与 fence。P5 列表快照增加最小 `ownerSubjectId` 内存标记，共享纯 selector 将当前 owner 的成功窗口映射为 `N/N+/0/—`；两个页面只负责注册各自的 unfiltered scope 和消费 selector。

**Tech Stack:** React 19、TypeScript 6、Vitest、Testing Library、现有 P5 MatchCase operation。

**Spec:** `docs/superpowers/specs/2026-09-03-backend-data-truth-source-design.md`

## Global Constraints

- 实施前在干净隔离 worktree 中完整阅读 `CLAUDE.md`、`AGENTS.md` 和 Spec；使用 `superpowers:using-git-worktrees` 建立隔离执行环境。
- 第一个实现 Plan 开始前执行 `git fetch origin`，把最新 `origin/main` 普通 merge 到实现分支；不得 rebase 已批准的文档提交。若冲突需要新的产品判断，停止并回报。
- Backend 不得读取 `在谈列表`、`企业候选列表`、`归档列表` 或 `企业归档列表` 作为统计事实；Mock 行为保持原样。
- 页面不得直接 `fetch`，不得复制 P5 请求、decoder、单飞或重试逻辑。
- 不请求 history；候选“已归档”和招聘“意向达成”在 Backend 显示 `—`。
- 不修改 CSS、布局、JD 上传入口、后端合同、错误码、幂等键、`If-Match` 或持久化规则。
- 每个代码 Task 严格 RED → GREEN，完成后提交；不要顺手重构。

## Prerequisites and completion

- 无前序 Plan；它产出的 P5 owner 字段、Backend legacy 清理 action 和 Provider 接线是 `2026-09-03-contact-events-frontend.md` 修改共享状态文件时必须保留的前序契约。
- 完成标准：两个角色的空/混合/分页/失败/换主体统计通过；Mock 回归通过；现有 P5 列表/操作测试不回归；工作树干净。
- 计划本身复杂度：中。原因：改动已验证的 P5 快照和会话边界，但不改变 wire 合同或命令路径。
- 零上下文漂移风险：中。原因：实施前需合并最新主干，P5 类型与 Provider 可能有现场漂移；接口已在本 Plan 冻结。
- 执行模型档位：行业 Top 5–10 中高性价比模型。

---

### Task 1: 给 P5 列表快照加主体归属并清空 Backend legacy Case 状态

**Files:**
- Modify: `src/状态/后端/类型.ts`，`P5列表快照`
- Modify: `src/状态/后端/MatchCase操作.ts`，列表快照构造器、加载短路与追加预检
- Modify: `src/状态/初始状态.ts`，`后端种子状态`
- Modify: `src/状态/应用状态.tsx`，根 `动作`/`归约` 与 P5 主体基串清理 effect
- Modify: `src/状态/后端/会话操作.ts`，`清账号状态`
- Modify: `src/屏幕/P5/MatchCase列表.tsx`，当前 owner 门控与 effect 依赖
- Test: `src/状态/后端/MatchCase操作.test.ts`
- Test: `src/状态/应用状态.test.ts`
- Test: `src/屏幕/P5/MatchCase列表.test.tsx`

**Interfaces:**
- Consumes: `主体标识引用.current`、`后端状态.主体?.subject_id`、现有 `P5范围键` 与 session/scope fence。
- Produces: `P5列表快照.ownerSubjectId: string | null`；根 action `{ 型: '清后端MatchCase演示状态' }`；相同 owner 才可复用成功快照。
- Invariant: owner 标记只用于已落位快照可见性与缓存短路，不替代 session/scope fence，不进入任何存储。

- [ ] **Step 1: 写失败测试，钉住 owner、Backend seed 和统一清理**

在 `MatchCase操作.test.ts` 的“工作区列表读取” describe 中加入同角色换主体用例；直接使用文件已有的 `env`、`候选主体`、`候选页`、`候选行`：

```ts
it('同角色换主体不复用旧成功快照，旧响应不能覆盖新主体', async () => {
  vi.mocked(env.数据源.读取P5Open列表)
    .mockResolvedValueOnce(候选页([候选行('mc_old')], null))
    .mockResolvedValueOnce(候选页([候选行('mc_new')], null));
  await env.操作.加载工作区('candidate', null);
  expect(env.最新状态().P5工作区['p5:open:candidate:*'])
    .toMatchObject({ ownerSubjectId: 'sub_1', items: [候选行('mc_old')] });

  env.deps.主体标识引用.current = 'sub_2';
  env.deps.会话代际.current += 1;
  env.deps.后端状态引用.current = {
    ...env.deps.后端状态引用.current,
    主体: { ...候选主体, subject_id: 'sub_2' },
  };
  await env.操作.加载工作区('candidate', null);

  expect(env.数据源.读取P5Open列表).toHaveBeenCalledTimes(2);
  expect(env.最新状态().P5工作区['p5:open:candidate:*'])
    .toMatchObject({ 阶段: '成功', ownerSubjectId: 'sub_2', items: [候选行('mc_new')] });
});
```

文件已有“scope 变化”“登出/换会话代际”“角色切换”三条 deferred 测试继续证明旧 response 不能覆盖新主体，不另造测试 helper。

在 `应用状态.test.ts` 现有 Backend seed/P5 describe 中加入：

```ts
it('Backend 种子不携带 legacy MatchCase 演示数组', () => {
  const 种子 = 创建初始状态({ 模式: 'backend', 后端环境: 'stg', 后端: {} as HTTP招聘数据源 });
  expect(种子.在谈列表).toEqual([]);
  expect(种子.企业候选列表).toEqual([]);
  expect(种子.归档列表).toEqual([]);
  expect(种子.企业归档列表).toEqual([]);
});
```

并扩展现有“退出登录清空 P5 快照与引用”Provider 测试，在 `await 当前.操作.退出登录()` 后对 `当前.状态` 的四个 legacy 数组逐一断言为空；这条测试使用现有完整 Provider 宿主，不创建伪 `当前`。

在 `MatchCase列表.test.tsx` 让现有 `快照` helper 接受 `ownerSubjectId`（默认 `sub_1`），让 `置P5状态` 的 `后端状态` 同时带当前 candidate/recruiter 主体；既有用例无需逐个改 fixture。再加入：

```ts
it('快照 owner 与当前主体不同时不显示旧 case，仍加载当前 scope', () => {
  置P5状态({
    role: 'candidate',
    filterRef: null,
    快照: 快照({
      ownerSubjectId: 'sub_old',
      items: [候选行({ caseId: 'mc_old' })],
    }),
  });
  mock应用状态.后端状态.主体 = {
    ...BFF主体样本,
    subject_id: 'sub_new',
    last_used_role: 'candidate',
  };
  render(列表元素('candidate', null));
  expect(screen.queryByText('AI 产品实习生')).toBeNull();
  expect(mock加载工作区).toHaveBeenCalledWith('candidate', null);
});
```

为此测试从 `../../测试/BFF样本` import `BFF主体样本`；`快照` helper 的返回对象总是写入 `ownerSubjectId: 选项.ownerSubjectId ?? 'sub_1'`。

- [ ] **Step 2: 运行 RED**

Run:

```bash
npx vitest run src/状态/后端/MatchCase操作.test.ts src/状态/应用状态.test.ts src/屏幕/P5/MatchCase列表.test.tsx
```

Expected: FAIL，原因包含 `ownerSubjectId` 缺失、Backend seed 仍含演示数组或旧 owner 行仍可见；不得因测试桩缺必需字段而提前 TypeError。

- [ ] **Step 3: 实现最小 owner 与清理契约**

在 `类型.ts` 修改快照：

```ts
export interface P5列表快照 {
  ownerSubjectId: string | null;
  阶段: P5加载阶段;
  刷新中: boolean;
  items: P5列表项[];
  nextCursor: string | null;
  已加载页数: number;
  error: string | null;
  generation: number;
}
```

在 `MatchCase操作.ts` 让三个列表构造器接收 owner；旧成功快照只有 owner 相同时才能在刷新中保留：

```ts
function 起步列表(
  旧: P5列表快照 | undefined,
  generation: number,
  ownerSubjectId: string | null,
): P5列表快照 {
  if (旧?.阶段 === '成功' && 旧.ownerSubjectId === ownerSubjectId) {
    return { ...旧, 刷新中: true, error: null, generation };
  }
  return {
    ownerSubjectId,
    阶段: '进行中',
    刷新中: true,
    items: [],
    nextCursor: null,
    已加载页数: 0,
    error: null,
    generation,
  };
}

function 成功列表(
  items: P5列表项[], nextCursor: string | null, 已加载页数: number,
  generation: number, ownerSubjectId: string | null,
): P5列表快照 {
  return {
    ownerSubjectId, 阶段: '成功', 刷新中: false,
    items, nextCursor, 已加载页数, error: null, generation,
  };
}

function 失败列表(
  旧: P5列表快照 | undefined, 错误: unknown,
  generation: number, ownerSubjectId: string | null,
): P5列表快照 {
  const error = 取后端错误文案(错误);
  if (旧?.阶段 === '成功' && 旧.ownerSubjectId === ownerSubjectId) {
    return { ...旧, 刷新中: false, error, generation };
  }
  return {
    ownerSubjectId, 阶段: '失败', 刷新中: false,
    items: [], nextCursor: null, 已加载页数: 0, error, generation,
  };
}
```

调用构造器时一律传 `fence.subjectId`。非 force 缓存短路与追加预检必须同时核对当前主体：

```ts
const 当前SubjectId = 主体标识引用.current;
const 旧快照 = 后端状态引用.current.P5工作区[scopeKey];
if (force !== true && 旧快照?.阶段 === '成功' && 旧快照.ownerSubjectId === 当前SubjectId) return;
```

追加模式若 `旧.ownerSubjectId !== fence.subjectId`，直接返回且不请求、不拼接。详情快照不增加 owner；本任务只消费列表。

在根 action union/归约器加入闭合 action：

```ts
| { 型: '清后端MatchCase演示状态' }

case '清后端MatchCase演示状态':
  return {
    ...旧,
    在谈列表: [],
    企业候选列表: [],
    归档列表: [],
    企业归档列表: [],
  };
```

`后端种子状态` 显式写入同样四个空数组；`清账号状态` 与 `应用状态.tsx` 的 P5 主体基串变化 effect 各派发一次该 action。不得在 Mock 初始化或普通 Mock reducer action 中调用。

在 `MatchCase列表.tsx` 以当前主体门控快照，并把主体加入注册 effect 依赖：

```ts
const 当前SubjectId = 后端状态.主体?.subject_id ?? null;
const 原快照 = 后端状态.P5工作区?.[scope键];
const 快照 = 原快照?.ownerSubjectId === 当前SubjectId ? 原快照 : undefined;

useEffect(() => {
  if (!是后端 || 当前SubjectId === null) return;
  操作.设置P5范围(role, scope键);
  void 操作.加载工作区(role, filterRef).catch(() => undefined);
  return () => 操作.设置P5范围(role, null);
}, [是后端, 当前SubjectId, role, filterRef, scope键, 操作]);
```

- [ ] **Step 4: 运行 GREEN 与提交**

Run the same Vitest command. Expected: PASS。

```bash
git add src/状态/后端/类型.ts src/状态/后端/MatchCase操作.ts src/状态/初始状态.ts src/状态/应用状态.tsx src/状态/后端/会话操作.ts src/屏幕/P5/MatchCase列表.tsx src/状态/后端/MatchCase操作.test.ts src/状态/应用状态.test.ts src/屏幕/P5/MatchCase列表.test.tsx
git commit -m "fix: isolate backend matchcase snapshots by subject"
```

---

### Task 2: 新增共享 P5 open 统计 selector

**Files:**
- Create: `src/状态/后端/MatchCase统计.ts`
- Create: `src/状态/后端/MatchCase统计.test.ts`

**Interfaces:**
- Consumes: `P5列表快照 | undefined`、当前 `subjectId: string | null`。
- Produces: `取P5Open统计(snapshot, subjectId): P5Open统计`。
- Exact output:

```ts
export interface P5Open统计 {
  open: string;
  anonymousScreening: string;
  needsAction: string;
}
```

- [ ] **Step 1: 写 selector 失败测试**

```ts
import { describe, expect, it } from 'vitest';
import type { P5列表项 } from '../../数据/招聘数据源/MatchCase';
import type { P5列表快照 } from './类型';
import { 取P5Open统计 } from './MatchCase统计';

function 行(
  caseId: string,
  stage: P5列表项['state']['stage'],
  needsAction: boolean,
  lifecycle: P5列表项['state']['lifecycle'] = 'open',
): P5列表项 {
  return {
    role: 'candidate',
    state: {
      caseId, lifecycle, stage,
      status: lifecycle === 'open' ? 'running' : lifecycle === 'ended' ? 'ended' : 'passed',
      step: lifecycle === 'open' ? 'policy_check' : 'complete',
      round: 0, roundBudget: 3, needsUser: false,
      outcome: null, outcomeCode: null,
      createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T09:00:00Z',
      finalizedAt: lifecycle === 'open' ? null : '2026-09-01T10:00:00Z',
    },
    needsAction,
    intentionId: 'int_0123456789abcdef0123456789abcdef',
    job: {
      jobId: 'job_0123456789abcdef0123456789abcdef',
      job: { title: '后端工程师', location: '上海', publicSalaryRange: '20-30K', requiredSkills: ['Go'] },
    },
  };
}

function 成功(items: P5列表项[], nextCursor: string | null): P5列表快照 {
  return {
    ownerSubjectId: 'sub_1', 阶段: '成功', 刷新中: false,
    items, nextCursor, 已加载页数: 1, error: null, generation: 1,
  };
}

describe('取P5Open统计', () => {
  it('完整成功窗口按 lifecycle/stage/needsAction 计数', () => {
    expect(取P5Open统计(成功([
      行('mc_1', 'anonymous_screening', true),
      行('mc_2', 'needs_coordination', false),
      行('mc_3', 'intent_confirmation', true),
      行('mc_4', 'intent_confirmation', true, 'completed'),
    ], null), 'sub_1')).toEqual({ open: '3', anonymousScreening: '1', needsAction: '2' });
  });

  it('未尽分页给每个派生计数加 +，完整空页为 0', () => {
    expect(取P5Open统计(成功([], 'cursor_1'), 'sub_1'))
      .toEqual({ open: '0+', anonymousScreening: '0+', needsAction: '0+' });
    expect(取P5Open统计(成功([], null), 'sub_1'))
      .toEqual({ open: '0', anonymousScreening: '0', needsAction: '0' });
  });

  it.each([undefined, { ...成功([], null), 阶段: '失败' as const }])('非成功快照为中性值', (snapshot) => {
    expect(取P5Open统计(snapshot, 'sub_1'))
      .toEqual({ open: '—', anonymousScreening: '—', needsAction: '—' });
  });

  it('owner 不匹配时不泄漏旧主体统计', () => {
    expect(取P5Open统计(成功([行('mc_1', 'anonymous_screening', true)], null), 'sub_2'))
      .toEqual({ open: '—', anonymousScreening: '—', needsAction: '—' });
  });
});
```

上面的 fixture 是完整 `P5列表项`；不得删字段或用 `as unknown as` 绕开领域类型。

- [ ] **Step 2: 运行 RED**

Run: `npx vitest run src/状态/后端/MatchCase统计.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现纯 selector**

```ts
import type { P5列表快照 } from './类型';

export interface P5Open统计 {
  open: string;
  anonymousScreening: string;
  needsAction: string;
}

const 中性统计: P5Open统计 = {
  open: '—', anonymousScreening: '—', needsAction: '—',
};

export function 取P5Open统计(
  snapshot: P5列表快照 | undefined,
  subjectId: string | null,
): P5Open统计 {
  if (subjectId === null || snapshot?.阶段 !== '成功' || snapshot.ownerSubjectId !== subjectId) {
    return 中性统计;
  }
  const openItems = snapshot.items.filter((item) => item.state.lifecycle === 'open');
  const suffix = snapshot.nextCursor === null ? '' : '+';
  return {
    open: `${openItems.length}${suffix}`,
    anonymousScreening: `${openItems.filter((item) => item.state.stage === 'anonymous_screening').length}${suffix}`,
    needsAction: `${openItems.filter((item) => item.needsAction === true).length}${suffix}`,
  };
}
```

- [ ] **Step 4: 运行 GREEN 与提交**

Run: `npx vitest run src/状态/后端/MatchCase统计.test.ts`

Expected: PASS。

```bash
git add src/状态/后端/MatchCase统计.ts src/状态/后端/MatchCase统计.test.ts
git commit -m "feat: add authoritative matchcase stats selector"
```

---

### Task 3: 两端“我的”页注册 unfiltered P5 scope 并消费 selector

**Files:**
- Modify: `src/屏幕/我的.tsx`
- Modify: `src/屏幕/企业我的.tsx`
- Modify: `src/屏幕/我的.test.tsx`
- Modify: `src/屏幕/企业我的.test.tsx`

**Interfaces:**
- Consumes: `P5范围键.open(role, null)`、`操作.设置P5范围`、`操作.加载工作区`、`取P5Open统计`、`后端状态.主体.subject_id`。
- Produces: candidate Backend stats `[open, anonymousScreening, needsAction, '—']`；recruiter Backend stats `[在招岗位真实数, open, needsAction, '—']`。
- Navigation: 保留 `{ 型: '看全部在谈', 档: '待我拍板' }` 与招聘镜像 action；不新增路由。

- [ ] **Step 1: 扩展页面测试宿主并写失败行为测试**

候选测试先 import `waitFor`、`BFF主体样本`、`P5范围键`、`P5列表项` 和 `P5列表快照`，把现有 `我的测试上下文` 补上 `操作`、`主体`、`P5工作区`。在文件顶层增加稳定 operation spy，并把 Task 2 的完整 `行(...)` fixture 复制进本测试文件（保持所有 P5 字段完整）。再增加：

```ts
const 设置P5范围 = vi.fn();
const 加载工作区 = vi.fn(async () => undefined);

function 成功P5快照(items: P5列表项[], nextCursor: string | null): P5列表快照 {
  return {
    ownerSubjectId: 'sub_candidate', 阶段: '成功', 刷新中: false,
    items, nextCursor, 已加载页数: 1, error: null, generation: 1,
  };
}

it('Backend 注册 candidate unfiltered scope 并只显示权威统计', async () => {
  const scope = P5范围键.open('candidate', null);
  const { unmount } = 布置('backend', {
    主体: { ...BFF主体样本, subject_id: 'sub_candidate', last_used_role: 'candidate' },
    P5快照: 成功P5快照([
      行('mc_1', 'anonymous_screening', true),
      行('mc_2', 'needs_coordination', false),
    ], null),
  });
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getAllByText('1')).toHaveLength(2);
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.getByText(/正在跟进 2 个机会/)).toBeTruthy();
  await waitFor(() => expect(设置P5范围).toHaveBeenCalledWith('candidate', scope));
  expect(加载工作区).toHaveBeenCalledWith('candidate', null);
  unmount();
  expect(设置P5范围).toHaveBeenLastCalledWith('candidate', null);
});

it('Backend 旧 owner 显示 —，绝不回退 legacy 数字', () => {
  布置('backend', {
    主体: { ...BFF主体样本, subject_id: 'sub_new', last_used_role: 'candidate' },
    P5快照: { ...成功P5快照([行('mc_1', 'anonymous_screening', true)], null), ownerSubjectId: 'sub_old' },
  });
  expect(screen.queryByText('8')).toBeNull();
  expect(screen.queryByText('5')).toBeNull();
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
});

it('Mock 保留原统计且不调用 P5 operation', () => {
  布置('mock');
  expect(加载工作区).not.toHaveBeenCalled();
  expect(screen.getByText(String(初始状态.在谈列表.length))).toBeTruthy();
});
```

扩展现有 `布置` 的 options 类型以接收 `主体?: BFF主体` 和 `P5快照?: P5列表快照`，并始终写入稳定 `{ 设置P5范围, 加载工作区 }`；Backend 默认主体为 candidate，Mock 默认 `主体:null/P5工作区:{}`。每个测试 `beforeEach` 清两个 spy。

招聘测试沿用现有 `置Backend应用状态`：给其 `后端状态` 增加完整 recruiter 主体、`P5工作区` 和相同稳定 operation spy，再写镜像断言：在招岗位仍从 `岗位列表` 数，open/needsAction 来自 recruiter scope，意向达成为 `—`，点击“待拍板”仍派发 `{ 型:'企业看全部在谈', 档:'待我拍板' }`。recruiter 行 fixture 使用 `candidateAlias` 而非 `intentionId`，其余 state/job 字段与上面的完整 fixture 一致。

- [ ] **Step 2: 运行 RED**

Run:

```bash
npx vitest run src/屏幕/我的.test.tsx src/屏幕/企业我的.test.tsx
```

Expected: FAIL，页面仍读 legacy 数组且没有 P5 scope 注册。

- [ ] **Step 3: 实现候选与招聘镜像接线**

两个页面都加入 `useEffect`、`P5范围键` 和 selector import。候选核心代码：

```ts
const 是后端 = 数据源模式 === 'backend';
const 当前SubjectId = 后端状态.主体?.last_used_role === 'candidate'
  ? 后端状态.主体.subject_id
  : null;
const P5Scope = P5范围键.open('candidate', null);
const Backend统计 = 取P5Open统计(后端状态.P5工作区[P5Scope], 当前SubjectId);

useEffect(() => {
  if (!是后端 || 当前SubjectId === null) return;
  操作.设置P5范围('candidate', P5Scope);
  void 操作.加载工作区('candidate', null).catch(() => undefined);
  return () => 操作.设置P5范围('candidate', null);
}, [是后端, 当前SubjectId, P5Scope, 操作]);

const 统计: 统计格[] = 是后端 ? [
  { 数值: Backend统计.open, 名称: '在谈', 色: '墨' },
  { 数值: Backend统计.anonymousScreening, 名称: '初筛中', 色: '深绿' },
  {
    数值: Backend统计.needsAction, 名称: '待你拍', 色: '深绿',
    按下: () => 派发({ 型: '看全部在谈', 档: '待我拍板' }),
  },
  { 数值: '—', 名称: '已归档', 色: '次要' },
] : 原Mock统计;
```

把原四项数组移入 `原Mock统计`，保持字面行为。候选代理卡只替换数量表达式：

```tsx
在线 · 正在跟进 {是后端 ? Backend统计.open : 状态.在谈列表.length} 个机会
```

招聘页使用 recruiter scope：

```ts
const 当前SubjectId = 后端状态.主体?.last_used_role === 'recruiter'
  ? 后端状态.主体.subject_id
  : null;
const P5Scope = P5范围键.open('recruiter', null);
const Backend统计 = 取P5Open统计(后端状态.P5工作区[P5Scope], 当前SubjectId);
```

Backend 的“在谈”用 `Backend统计.open`，“待拍板”用 `Backend统计.needsAction`，“意向达成”为 `—`；“在招岗位”和代理卡的岗位数保持当前实现。Mock 仍用 `企业候选列表`。

- [ ] **Step 4: 运行 GREEN、页面相关回归并提交**

Run:

```bash
npx vitest run src/屏幕/我的.test.tsx src/屏幕/企业我的.test.tsx src/屏幕/P5/MatchCase列表.test.tsx src/状态/后端/MatchCase统计.test.ts
```

Expected: PASS。

```bash
git add src/屏幕/我的.tsx src/屏幕/企业我的.tsx src/屏幕/我的.test.tsx src/屏幕/企业我的.test.tsx
git commit -m "fix: hydrate my-page stats from matchcases"
```

---

### Task 4: Plan 范围验证、异构 review 与 Handoff

**Files:**
- No product changes expected; only reviewer-required fixes inside this Plan scope.

**Interfaces:**
- Consumes: Tasks 1–3 的干净 commits。
- Produces: 可解析的最终 Plan commit、测试 evidence 和批次 Plan Handoff；下游 contact Plan 必须保留 `P5列表快照.ownerSubjectId`、`清后端MatchCase演示状态` 及共享 Provider 清理。

- [ ] **Step 1: 基本静态验证**

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: 全部 exit 0。

- [ ] **Step 2: 在 authoritative gate 前运行异构 code review**

当前宿主若是 Codex，调用 Claude 多轮 code review；当前宿主若是 Claude Code，调用 Codex 多轮 code review。只审本 Plan diff，逐条核实并按 TDD 修复 required/值得修的 minor finding，每轮修复都提交，直至 clean 或达到 review skill 上限。

- [ ] **Step 3: 运行唯一 authoritative plan-scope gate**

仓库没有正式 affected runner；本仓库就是单一前端 package，因此唯一 broad gate 选择完整 package test：

```bash
npm test
```

Expected: exit 0。不要再把另一条完整 broad test 当作同级必跑 gate；Task 定向测试是 inner-loop evidence。

- [ ] **Step 4: 写 Plan Handoff 并确认 clean**

按批次 manifest 分配的固定路径写 `handoff_version: 5` Handoff，记录：实现 READY/NOT_READY、唯一 plan-scope verdict、实际 commit、review rounds、inner-loop 与 authoritative evidence、`dependency_drift` 及下游 `contact-events` 是否需要校准。然后运行：

```bash
git status --short
git log -1 --oneline
```

Expected: status 无输出；commit 可解析。

## Plan-scope testing boundary

- Task/inner-loop：各 Task 列出的 Vitest 文件、`typecheck`、`lint`、`build`。
- Authoritative plan-scope gate：唯一 `npm test`。
- L3/shared environment：`integration_requirement: none`；`selection_ssot: none`；`selection_gap: none`；`l3_selection: []`。本 Plan 不需要真实共享后端或发布环境才能判定实现正确。
- 可选本地 fixture：rolling integration owner 可在最终组合 commit 上运行 `npm run test:e2e:data-source -- --grep '@backend'` 作为 L2 补充证据；它不是实际 BFF 联调，也不得冒充 L3。
- Release handoff：`required: false`、`owner: none`、`required_mode: none`、`nightly_only_mode: none`、`status: none`。

## Non-goals

- 不自动拉完全部 P5 分页，不新增后端 `total` 或聚合字段；精确统计留在 Spec TODO。
- 不改变 P5 mutation、详情、历史、轮询节拍或现有在谈卡展示。
- 不新增“我的”页视觉组件或 history 请求。
