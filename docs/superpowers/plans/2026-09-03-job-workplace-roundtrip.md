# 岗位办公方式 Backend Round-trip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让岗位的 `onsite | hybrid | remote` 与页面 `现场 | 混合 | 全远程` 双向闭合，确保 remote 岗位进入编辑态选中“全远程”且无修改保存仍 PATCH `remote`。

**Architecture:** 在现有 `后端映射.ts` 中只保留一组 canonical 页面办公方式与 wire 办公方式的闭合映射函数，意向水合、岗位读取、创建和补丁都经过它；添加意向屏仍产生的旧“远程”只在意向写入边界兼容为 `remote`。岗位非法页值立即抛错，不再静默回退 `onsite`。发布岗位组件不改变结构，只通过已有岗位对象预填和提交链自然完成 round-trip。

**Tech Stack:** TypeScript 6、React 19、Vitest、Testing Library、现有岗位 data source/operation。

**Spec:** `docs/superpowers/specs/2026-09-03-backend-data-truth-source-design.md`

## Global Constraints

- 实施前在干净隔离 worktree 中完整阅读 `CLAUDE.md`、`AGENTS.md` 与 Spec；使用 `superpowers:using-git-worktrees`。
- 这是独立 Plan，可与 MatchCase/设置 Plan 并行，但与任何 JD 上传分支串行合并并复核冲突。
- 禁止改动 `src/屏幕/发布岗位.tsx` 的 JD 上传入口、CSS、布局、控件选项和文案。
- 不改变 BFF schema、岗位 CRUD operation、字段集合、`If-Match`、幂等键或错误词。
- 只解决三个 mode 的读写闭环；不顺手修改 remote 空办公地址历史任务。
- 每个代码 Task 严格 RED → GREEN，完成后提交。

## Prerequisites and completion

- 无代码前序依赖；若并行 JD 分支已触达 `发布岗位.tsx`，先普通 merge 后只解决本 Plan 的窄冲突。
- 完成标准：三种 mode 的映射穷举、remote 编辑选中、无修改保存 payload、onsite/hybrid 回归均通过；完整 package test 通过；工作树干净。
- 计划本身复杂度：低。原因：根因是一个词汇不一致和两个静默 fallback，不需要新状态或基础设施。
- 零上下文漂移风险：低至中。原因：`发布岗位.tsx` 可能被 JD 上传分支并行修改，但本 Plan 的数据路径稳定。
- 执行模型档位：行业 Top 20 高性价比模型。

---

### Task 1: 建立唯一闭合映射并穷举岗位读写

**Files:**
- Modify: `src/数据/后端映射.ts`
- Modify: `src/数据/后端映射.test.ts`

**Interfaces:**
- Consumes/produces: `BFFOwnerJob['workplace_mode']` 与 `NonNullable<在招岗位['办公方式']>`。
- Produces exported pure functions `页面办公方式到Wire`、`Wire到页面办公方式`，供映射测试直接穷举。
- Invariant: `onsite↔现场`、`hybrid↔混合`、`remote↔全远程`；任何非法页面值抛 `Error('未映射的岗位办公方式：…')`，不得默认 onsite。

- [ ] **Step 1: 写失败的三态穷举与非法值测试**

在 `后端映射.test.ts` 的岗位映射 describe 中加入：

```ts
import {
  从BFF岗位,
  页面办公方式到Wire,
  Wire到页面办公方式,
  转岗位创建,
  转岗位补丁,
} from './后端映射';

it.each([
  ['onsite', '现场'],
  ['hybrid', '混合'],
  ['remote', '全远程'],
] as const)('%s 与 %s 双向闭合', (wire, page) => {
  expect(Wire到页面办公方式(wire)).toBe(page);
  expect(页面办公方式到Wire(page)).toBe(wire);
  expect(页面办公方式到Wire(Wire到页面办公方式(wire))).toBe(wire);
});

it('非法岗位办公方式 fail closed，不回退 onsite', () => {
  expect(() => 页面办公方式到Wire('远程' as never))
    .toThrowError('未映射的岗位办公方式：远程');
});
```

再基于现有 `BFF岗位样本`、`页面岗位样本` 与岗位创建/补丁上下文，针对三态分别断言：`从BFF岗位({...workplace_mode:wire}).办公方式===page`，且返回对象进入 `转岗位创建`/`转岗位补丁` 后 `workplace_mode===wire`。另断言 `从BFF意向草稿({...BFF意向样本,workplace_modes:['remote']}).办公方式` 为 `['全远程']`，以及旧添加意向草稿 `['远程']` 写回仍为 `['remote']`。不要用稀疏对象或 `as unknown as` 绕过完整 DTO。

- [ ] **Step 2: 运行 RED**

Run: `npx vitest run src/数据/后端映射.test.ts`

Expected: FAIL，remote 当前回显“远程”，新纯函数尚未导出。

- [ ] **Step 3: 实现唯一闭合映射并删除岗位 fallback**

在岗位映射区定义：

```ts
type 页面办公方式 = NonNullable<在招岗位['办公方式']>;
type Wire办公方式 = BFFOwnerJob['workplace_mode'];

const Wire办公方式表 = {
  onsite: '现场',
  hybrid: '混合',
  remote: '全远程',
} as const satisfies Record<Wire办公方式, 页面办公方式>;

const 页面办公方式表 = {
  现场: 'onsite',
  混合: 'hybrid',
  全远程: 'remote',
} as const satisfies Record<页面办公方式, Wire办公方式>;

export function Wire到页面办公方式(value: Wire办公方式): 页面办公方式 {
  return Wire办公方式表[value];
}

export function 页面办公方式到Wire(value: 页面办公方式): Wire办公方式 {
  const mapped = 页面办公方式表[value];
  if (mapped === undefined) throw new Error(`未映射的岗位办公方式：${String(value)}`);
  return mapped;
}
```

`从BFF意向草稿` 与 `从BFF岗位` 改用 `Wire到页面办公方式(...)`；`转岗位创建` 和 `转岗位补丁` 都改用 `页面办公方式到Wire(页面岗位.办公方式)`。删除旧 `后端到办公方式`、`办公方式到岗位后端` 及两处 `?? 'onsite'`。

候选意向写入的兼容逻辑仍接受 wire code 和旧添加意向屏的“远程”，但 canonical 中文值先走 `页面办公方式到Wire`；非法值继续由意向的 `客户端校验错误` fail closed。不修改添加意向页面本身。

- [ ] **Step 4: 运行 GREEN 与提交**

Run: `npx vitest run src/数据/后端映射.test.ts`

Expected: PASS。

```bash
git add src/数据/后端映射.ts src/数据/后端映射.test.ts
git commit -m "fix: close job workplace mode mapping"
```

---

### Task 2: 钉住 remote 编辑表单选中和无修改保存

**Files:**
- Modify only if required by failing test: `src/屏幕/发布岗位.tsx`
- Modify: `src/屏幕/发布岗位.test.tsx`

**Interfaces:**
- Consumes: Backend `状态.岗位列表` 中经 `从BFF岗位` 产生的 `{ 办公方式:'全远程' }`。
- Produces: 编辑表单“全远程”按钮 selected 状态；`操作.更新岗位` 输入保持 `{ 办公方式:'全远程' }`。
- The operation/mapping layer then proves PATCH `workplace_mode:'remote'` via Task 1 tests。

- [ ] **Step 1: 写失败的页面 round-trip 测试**

在现有 `发布岗位.test.tsx` 的 Backend 提交 describe 使用已有 `置Backend应用状态` 和完整 `页面岗位样本`：

```ts
it('remote owner job 编辑时选中全远程，无修改保存仍提交全远程', async () => {
  const 用户 = userEvent.setup();
  mock更新岗位.mockResolvedValue(undefined);
  置Backend应用状态(查询Taxonomy, 查询Location);
  mock应用状态.状态.岗位列表 = [{
    ...页面岗位样本,
    办公方式: '全远程',
    地点引用: { id: 'loc_shanghai', display_name: '上海' },
  }];

  render(
    <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
      <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
    </MemoryRouter>,
  );

  const remote = screen.getByRole('button', { name: '全远程' });
  expect(remote.getAttribute('aria-pressed')).toBe('true');
  await 用户.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
  expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
    编号: 'job_1',
    办公方式: '全远程',
  });
});
```

若快捷片不是 `aria-pressed`，先断言实际已有 selected 可访问状态；只在当前组件确实缺少任何可访问选中语义时，为三个既有按钮统一补 `aria-pressed={办公方式 === 项}`，不改 className 或 DOM 层级。

另加 `it.each(['现场','混合'] as const)` 镜像用例，确保选择与保存不回归。

- [ ] **Step 2: 运行 RED**

```bash
npx vitest run src/屏幕/发布岗位.test.tsx src/数据/后端映射.test.ts
```

Expected: 在 Task 1 实现前 remote 回显或映射用例 FAIL；若 Task 1 已让页面测试直接通过，保留测试作为回归，不为制造代码改动而修改组件。

- [ ] **Step 3: 仅在测试证明必要时修改组件**

预期产品实现无需改 `发布岗位.tsx`：它已用 `编辑目标.办公方式` 初始化 state，并从固定 `['现场','混合','全远程']` 渲染选择。如果测试揭示初始化或选中判断另有分支，只把它收敛到该 state，不接触 JD 上传入口、布局或文案。

允许的唯一无视觉辅助改动是给既有办公方式按钮补：

```tsx
aria-pressed={办公方式 === 项}
```

不得新增控件、改变 className、把 `remote` wire code直接塞进 React state，或在组件里复制 wire 映射。

- [ ] **Step 4: 运行 GREEN 与提交**

运行 Step 2 同一命令，Expected: PASS。

```bash
git add src/屏幕/发布岗位.test.tsx
git add -u src/屏幕/发布岗位.tsx
git commit -m "test: cover remote job edit round trip"
```

若组件无需修改，提交只包含测试；若 Task 1 新测试已完整覆盖且本 Task 无新 diff，不创建空 commit，在 Handoff 记录 no-op。

---

### Task 3: Plan 范围验证、异构 review 与 Handoff

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

当前宿主若是 Codex，调用 Claude 多轮 code review；当前宿主若是 Claude Code，调用 Codex 多轮 code review。只审本 Plan diff，逐条核实；required/值得修的 minor finding 按 RED→GREEN 修复并提交。

- [ ] **Step 3: 唯一 authoritative plan-scope gate**

```bash
npm test
```

Expected: exit 0。本仓库没有正式 affected runner，完整 package Vitest 是唯一 broad gate。

- [ ] **Step 4: Handoff 与 clean tree**

按 manifest 固定路径写 `handoff_version: 5` Handoff，记录 READY/NOT_READY、verdict、commits、review rounds、测试 evidence、`dependency_drift`，尤其写明是否与 JD 分支发生冲突。然后：

```bash
git status --short
git log -1 --oneline
```

Expected: status 无输出；commit 可解析。

## Plan-scope testing boundary

- Task/inner-loop：`后端映射.test.ts`、`发布岗位.test.tsx`、`typecheck`、`lint`、`build`。
- Authoritative plan-scope gate：唯一 `npm test`。
- L3/shared environment：`integration_requirement: none`；`selection_ssot: none`；`selection_gap: none`；`l3_selection: []`。三态映射与页面/operation round-trip 可由 deterministic tests 判定。
- Release handoff：`required: false`、`owner: none`、`required_mode: none`、`nightly_only_mode: none`、`status: none`。

## Non-goals

- 不修改 JD 上传、remote 空办公地址条件、候选岗位详情投影或求职意向 UI。
- 不给 wire enum 新增值，不增加 fallback、配置项或通用词汇转换框架。
- 不修改任何 CSS、布局、控件视觉或展示文案。
