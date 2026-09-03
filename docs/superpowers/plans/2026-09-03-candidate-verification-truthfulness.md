# 候选设置实名状态 Truthfulness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend 候选设置页在没有实名合同的情况下不再声称“已认证”，也不再通过点击制造假成功反馈，同时保持真实 credentials 读取与 Mock 原型行为不变。

**Architecture:** 不新增状态、合同、operation 或配置。设置页只在 Backend 分支把实名行渲染为稳定的非交互中性行和值 `—`；Mock 分支保留原按钮、`已认证` 和演示提示。

**Tech Stack:** React 19、TypeScript 6、Vitest、Testing Library、现有 P8 credentials 接线。

**Spec:** `docs/superpowers/specs/2026-09-03-backend-data-truth-source-design.md`

## Global Constraints

- 实施前在干净隔离 worktree 中完整阅读 `CLAUDE.md`、`AGENTS.md` 与 Spec；使用 `superpowers:using-git-worktrees`。
- `phone_otp` 只证明登录凭据已验证；简历姓名也不是实名认证。不得从 credentials 或简历推导实名状态。
- 不新增实名 API、路由、mutation、toast、localStorage、feature flag 或通用 identity 状态。
- Backend 固定显示中性 `—`，整行非 button、无尖括号、无点击反馈；Mock 保留现有演示按钮。
- 不修改账号与安全页面、credentials operation、CSS、布局、组顺序或普通文案设计。
- 每个代码 Task 严格 RED → GREEN，完成后提交。

## Prerequisites and completion

- 无代码前序依赖，可与 MatchCase/岗位 Plan 并行；若 contact-events Plan 同时修改设置页入口附近，只保留双方各自窄改动。
- 完成标准：phone OTP Backend 不出现“已认证/已通过”，实名不是按钮且不产生提示；P8 credential 读取与账号安全入口回归；Mock 演示不变；完整 package test 通过。
- 计划本身复杂度：低。原因：产品真相是“未知”，最小解是收回错误承诺，不需要建新能力。
- 零上下文漂移风险：低。原因：只修改一个既有条件分支及同文件测试。
- 执行模型档位：行业 Top 20 高性价比模型。

---

### Task 1: Backend 实名行改为非交互中性状态

**Files:**
- Modify: `src/屏幕/设置.tsx`
- Modify: `src/屏幕/设置.test.tsx`

**Interfaces:**
- Consumes: existing `数据源模式` only。
- Produces: Backend DOM `div.行` with title `实名认证` and value `—`；Mock DOM remains clickable button with value `已认证` and existing transient receipt。
- Invariant: P8 `加载P8凭证()` effect、手机号显示和“账号与安全”按钮完全不变。

- [ ] **Step 1: 写失败测试，钉住 Backend/Mock 分支和 P8 不回归**

在 `设置.test.tsx` 新增 describe，复用文件已有 `P8操作桩`、`后端底座` 与 mock state：

```ts
describe('设置 · 实名状态真相源', () => {
  it('仅有 phone_otp 的 Backend 候选不声称已实名且整行不可点击', async () => {
    const 用户 = userEvent.setup();
    const 操作 = P8操作桩();
    mock应用状态 = {
      状态: { 设置开关: { ...初始状态.设置开关 } },
      派发: vi.fn(),
      操作: { 设置雇主隐私: vi.fn(), ...操作 },
      数据源模式: 'backend',
      后端状态: 后端底座({ 凭证: 成功快照([手机凭证]) }),
    };

    render(<MemoryRouter><设置 /></MemoryRouter>);
    expect(screen.getByText('实名认证').closest('button')).toBeNull();
    expect(screen.queryByText('已认证')).toBeNull();
    expect(screen.queryByText(/已通过/)).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);

    await 用户.click(screen.getByText('实名认证'));
    expect(screen.queryByText(/实名认证 · 已通过/)).toBeNull();
    await waitFor(() => expect(操作.加载P8凭证).toHaveBeenCalledTimes(1));
    expect(screen.getByText(手机凭证.display)).toBeTruthy();
  });

  it('Mock 保留演示已认证与原点击提示，且不读 credentials', async () => {
    const 用户 = userEvent.setup();
    const 操作 = P8操作桩();
    mock应用状态 = {
      状态: { 设置开关: { ...初始状态.设置开关 } },
      派发: vi.fn(),
      操作: { 设置雇主隐私: vi.fn(), ...操作 },
      数据源模式: 'mock',
      后端状态: 后端底座(),
    };

    render(<MemoryRouter><设置 /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /实名认证.*已认证/ })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: /实名认证.*已认证/ }));
    expect(screen.getByText('实名认证 · 已通过，无需重复认证')).toBeTruthy();
    expect(操作.加载P8凭证).not.toHaveBeenCalled();
  });
});
```

补一条“账号与安全”按钮点击仍 `跳转(路径.账号安全)` 的 Backend 断言；该测试与现有 credentials 测试一起证明真接线未受影响。

- [ ] **Step 2: 运行 RED**

Run: `npx vitest run src/屏幕/设置.test.tsx`

Expected: FAIL，Backend 当前仍渲染“已认证”按钮并产生“已通过”提示。

- [ ] **Step 3: 实现最小条件渲染**

只替换当前实名按钮这一段：

```tsx
{是后端 ? (
  <div className={样式.行}>
    <span className={样式.行文字组}>
      <span className={样式.行标题}>实名认证</span>
    </span>
    <span className={样式.行值}>—</span>
  </div>
) : (
  <button
    className={`${样式.行} 可点`}
    onClick={() => 设提示('实名认证 · 已通过，无需重复认证')}
  >
    <span className={样式.行文字组}>
      <span className={样式.行标题}>实名认证</span>
    </span>
    <span className={样式.行值}>已认证</span>
    <span className={样式.尖括号}>›</span>
  </button>
)}
```

不要删除 `提示` state/timer：Mock 的演示回执仍使用它。不要读取 `phone_otp.verifiedAt` 或简历字段来替代 `是后端` 分支。

- [ ] **Step 4: 运行 GREEN、相关回归并提交**

```bash
npx vitest run src/屏幕/设置.test.tsx src/屏幕/账号安全.test.tsx
```

Expected: PASS；若账号安全测试文件实际名称不同，用 `rg --files src/屏幕 | rg '账号.*test'` 解析唯一现有文件后执行，不能跳过该回归。

```bash
git add src/屏幕/设置.tsx src/屏幕/设置.test.tsx
git commit -m "fix: stop claiming backend identity verification"
```

---

### Task 2: Plan 范围验证、异构 review 与 Handoff

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

按 manifest 固定路径写 `handoff_version: 5` Handoff，记录 READY/NOT_READY、verdict、commits、review rounds、测试 evidence、`dependency_drift`。然后：

```bash
git status --short
git log -1 --oneline
```

Expected: status 无输出；commit 可解析。

## Plan-scope testing boundary

- Task/inner-loop：`设置.test.tsx`、账号安全页面测试、`typecheck`、`lint`、`build`。
- Authoritative plan-scope gate：唯一 `npm test`。
- L3/shared environment：`integration_requirement: none`；`selection_ssot: none`；`selection_gap: none`；`l3_selection: []`。本 Plan 的目标是删除无合同断言，不需要共享环境。
- Release handoff：`required: false`、`owner: none`、`required_mode: none`、`nightly_only_mode: none`、`status: none`。

## Non-goals

- 不实现候选实名、读取实名状态、发起认证或设计认证流程。
- 不改变 phone OTP、账号安全、隐私写入、退出登录或 Mock 演示。
- 不修改 CSS、图标、布局、信息层级或 PM 后续确定的最终文案。
