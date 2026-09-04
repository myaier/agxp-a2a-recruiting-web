# 前端角色路由边界 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Backend 初始化完成后，以当前 active role 和 `last_used_role` 同步阻止错误角色业务屏挂载，同时保留共享页、身份选择和招聘组织恢复路径。

**Architecture:** 在 `src/应用.tsx` 内增加集中式路由模式表和纯判定函数；所有 hooks 仍无条件调用，最终 `<Routes>` 挂载前按 Backend 会话快照同步返回 `<Navigate replace>`。守卫只读主体，不调用切身份 operation，也不修改 data source、session fence 或组织水合逻辑。

**Tech Stack:** React 18、React Router 6、TypeScript、Vitest、Testing Library。

**Spec:** `docs/superpowers/specs/2026-09-04-frontend-truthfulness-route-state-repair-design.md`

## Global Constraints

- 开始前完整阅读 `CLAUDE.md`、`AGENTS.md` 和 Spec。
- 实际实现以届时最新 `origin/main` 为准；先 `git fetch origin`，不得覆盖较新的 session/subject/role fence、strict decoder、single-flight 或 Mock/Backend 分支。
- Backend 初始化完成前沿用现有加载屏；Mock 完全跳过角色守卫。
- 只读 `BFF主体.roles` 与 `last_used_role`；访问 URL 绝不调用 `操作.切身份` 或静默写角色。
- 不新增 Context、路由 registry 文件、数据源、API、CSS 或通用基础设施。
- 本 Plan 先于 `2026-09-04-backend-prototype-surface-isolation.md` 执行；两者都会修改 `src/应用.test.tsx`。
- 每个 Task 严格执行 red → green → commit；不得捎入其它 Plan。

---

### Task 1: 用表驱动测试冻结角色、路由与重定向矩阵

**Files:**
- Modify: `src/应用.test.tsx`

**Interfaces:**
- Consumes: `BFF主体 = { subject_id, roles: { role, status }[], last_used_role }`；现有 `后端应用值()`、`MemoryRouter` 和屏幕桩。
- Produces: candidate-only、recruiter-only、shared 路由矩阵，以及被拒屏幕 mount 次数为零的证据。

- [ ] **Step 1: 扩充可观测屏幕桩和主体工厂**

在现有 mock 区加入 `/resume`、`/hr/jobs`、`/company/:id`、`/help`、`/feedback`、`/terms` 的桩，并记录 mount：

```tsx
const 屏幕挂载次数 = new Map<string, number>();

function 可计数屏幕桩(名: string) {
  return {
    default: () => {
      屏幕挂载次数.set(名, (屏幕挂载次数.get(名) ?? 0) + 1);
      return <div data-testid={'屏幕:' + 名}>{名}</div>;
    },
  };
}

function 主体(
  lastUsedRole: 'candidate' | 'recruiter' | null,
  candidate: 'active' | 'suspended' | null,
  recruiter: 'active' | 'suspended' | null,
) {
  return {
    ...BFF主体样本,
    last_used_role: lastUsedRole,
    roles: [
      ...(candidate === null ? [] : [{ role: 'candidate' as const, status: candidate }]),
      ...(recruiter === null ? [] : [{ role: 'recruiter' as const, status: recruiter }]),
    ],
  };
}
```

在 `beforeEach` 清空 mount map。让位置探针同时输出 `pathname` 和 `search`。给 operation 桩加入 `切身份: vi.fn()`，仅用于证明守卫未调用它。

- [ ] **Step 2: 写拒绝与共享路由的失败测试**

```tsx
it.each([
  ['candidate 单角色进招聘页', 主体('candidate', 'active', null), '/hr/jobs', '/identity', ''],
  ['recruiter 单角色进候选页', 主体('recruiter', null, 'active'), '/resume', '/identity', ''],
  ['双 active candidate 进招聘页', 主体('candidate', 'active', 'active'), '/hr/jobs', '/identity', '?switch=1&from=app'],
  ['双 active recruiter 进候选页', 主体('recruiter', 'active', 'active'), '/resume', '/identity', '?switch=1&from=hr'],
  ['目标 candidate suspended', 主体('recruiter', 'suspended', 'active'), '/resume', '/identity', ''],
  ['目标 recruiter suspended', 主体('candidate', 'active', 'suspended'), '/hr/jobs', '/identity', ''],
  ['last_used_role 缺失', 主体(null, 'active', 'active'), '/resume', '/identity', ''],
] as const)('%s', async (_名, 当前主体, 初始路径, 期望路径, 期望搜索) => {
  const 当前值 = 后端应用值({
    初始化: '完成',
    已登录: true,
    主体: 当前主体,
    招聘方组织水合: { 阶段: '成功', 错误: null },
    招聘方档案水合阶段: '成功',
  });
  mock应用状态.mockReturnValue(当前值);
  render(<MemoryRouter initialEntries={[初始路径]}><应用 /><位置探针 /></MemoryRouter>);
  await waitFor(() => expect(当前路径()).toBe(期望路径));
  expect(screen.getByTestId('search').textContent).toBe(期望搜索);
  expect(当前值.操作.切身份).not.toHaveBeenCalled();
});
```

另写 shared 表测：candidate、recruiter、双 active 和 suspended/unknown 主体访问 `/account`、`/feedback`、`/terms`、`/help`、`/company/org_1` 时不被角色守卫改写；`/identity` 始终可达。

- [ ] **Step 3: 写防闪挂、刷新与后退失败测试**

用初始深链直接 render 模拟刷新，断言：

```tsx
expect(屏幕挂载次数.get('岗位管理') ?? 0).toBe(0);
expect(屏幕挂载次数.get('我的简历') ?? 0).toBe(0);
```

再用测试内导航按钮从允许页进入错误角色 URL；等待 replace 到 `/identity` 后调用 `navigate(-1)`，只能回到允许页，错误屏 mount 仍为 0。

- [ ] **Step 4: 运行测试，确认失败**

```bash
npx vitest run src/应用.test.tsx
```

Expected: 新增用例 FAIL；当前 candidate 可挂载 `/hr/jobs`，recruiter 可挂载 `/resume`。

- [ ] **Step 5: 提交测试检查点**

```bash
git add src/应用.test.tsx
git commit -m "test: define role route access matrix"
```

### Task 2: 实现集中式路由分类与同步角色守卫

**Files:**
- Modify: `src/应用.tsx`
- Test: `src/应用.test.tsx`

**Interfaces:**
- Consumes: `路径`、React Router `matchPath`、`BFF主体`。
- Produces: `角色路由重定向(pathname, subject): string | null`；只在应用内部使用。

- [ ] **Step 1: 增加精确路由模式表**

导入 `matchPath`、`BFF角色` 和 `BFF主体`。候选表逐项覆盖当前注册候选路由；招聘表逐项覆盖 `/hr-init` 与所有已注册 `/hr/...` 路由。不要把 shared 路由放入角色表，也不要用 `startsWith('/hr')` 吞掉未知路径。

```tsx
const 候选路由模式 = [
  路径.学生分流, 路径.基本信息, 路径.工作经历, 路径.引导问答,
  路径.披露说明, 路径.选工作城市, 路径.选期望职位, 路径.求职状态,
  路径.最高学历, 路径.毕业院校, 路径.选专业, 路径.就读时间段,
  路径.添加头像, 路径.初始化, 路径.主壳, 路径.在谈详情模板,
  路径.往来记录模板, 路径.问AI代理, 路径.代理详情, 路径.职位详情模板,
  路径.直聊会话, 路径.直聊会话岗位模板, 路径.真人会话, 路径.真人会话模板,
  路径.求职意向管理, 路径.添加意向, 路径.选择城市, 路径.选期望行业,
  路径.编辑意向模板, 路径.规则库, 路径.我的简历, 路径.个人信息,
  路径.设置, 路径.屏蔽名单, 路径.披露偏好, 路径.归档谈判, 路径.接触记录,
] as const;

const 招聘路由模式 = [
  路径.企业实名认证, 路径.招聘名片, 路径.企业组织申请, 路径.企业邀请加入,
  路径.发布岗位, 路径.编辑岗位模板, 路径.公司档案编辑, 路径.公司档案分区模板,
  路径.企业初始化, 路径.企业主壳, 路径.候选详情模板, 路径.企业往来记录模板,
  路径.企业问AI代理, 路径.企业真人会话, 路径.企业真人会话模板,
  路径.岗位管理, 路径.岗位详情模板, 路径.企业代理详情, 路径.企业代理设置,
  路径.匿名在线简历模板, 路径.企业设置, 路径.企业披露策略, 路径.企业归档,
  路径.已筛候选, 路径.初筛记录, 路径.初筛对话模板,
] as const;

function 匹配任一路由(pathname: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchPath({ path: pattern, end: true }, pathname) !== null);
}
```

- [ ] **Step 2: 计算只读重定向目标**

```tsx
function 角色路由重定向(pathname: string, subject: BFF主体 | null): string | null {
  const 目标角色: BFF角色 | null = 匹配任一路由(pathname, 候选路由模式)
    ? 'candidate'
    : 匹配任一路由(pathname, 招聘路由模式) ? 'recruiter' : null;
  if (目标角色 === null) return null;
  if (subject === null) return 路径.选身份;
  const active = (role: BFF角色) =>
    subject.roles.some((项) => 项.role === role && 项.status === 'active');
  if (active(目标角色) && subject.last_used_role === 目标角色) return null;
  if (!active('candidate') || !active('recruiter') || subject.last_used_role === null) {
    return 路径.选身份;
  }
  return subject.last_used_role === 'candidate'
    ? 路径.切换身份自求职端
    : 路径.切换身份自企业端;
}
```

- [ ] **Step 3: 在组织恢复面和 `<Routes>` 之前同步应用守卫**

保留所有 hooks 的无条件调用。Backend 初始化完成且已登录时计算：

```tsx
const 角色重定向 = 数据源模式 === 'backend' &&
  后端状态.初始化 === '完成' && 后端状态.已登录
  ? 角色路由重定向(位置.pathname, 后端状态.主体)
  : null;

if (角色重定向 !== null) return <Navigate to={角色重定向} replace />;
```

此 return 放在招聘组织失败恢复面之前。不要删改登录落点 effect、候选 onboarding 清理 effect、招聘档案缺失导航或组织失败处理。

- [ ] **Step 4: 运行并提交实现**

```bash
npx vitest run src/应用.test.tsx
git add src/应用.tsx src/应用.test.tsx
git commit -m "fix: enforce backend role route boundaries"
```

Expected: PASS。

### Task 3: 钉死组织恢复、未知路由和 Mock 回归

**Files:**
- Modify: `src/应用.test.tsx`

**Interfaces:**
- Consumes: Task 2 的角色守卫。
- Produces: 组织恢复与 Mock 原型不受守卫影响的回归证据。

- [ ] **Step 1: 增加完整边界回归测试**

使用现有 `后端应用值` 和屏幕桩补齐以下测试；每条都实际 `render` 并断言最终 DOM/路径，不建立只写标题的空用例：

- active recruiter + `/hr/jobs` + 组织失败：显示真实错误和“重试”；
- active recruiter + `/hr/jobs` + 档案缺失：replace 到 `/hr/card`，state 保持 `{ 从注册流: true }`；
- `/hr/not-a-real-screen` 与 `/not-a-real-screen`：交给现有 `*` fallback 到 `/`；
- Mock `/resume` 与 `/hr/jobs`：无主体 roles 也直接挂目标屏；
- `/hr/card`、`/hr/verify`、组织申请和邀请加入仍 recruiter-only。

主体异常态也要显式 fail closed：

```tsx
it('Backend 已登录但主体快照缺失时不挂载角色业务屏', async () => {
  mock应用状态.mockReturnValue(后端应用值({
    初始化: '完成',
    已登录: true,
    主体: null,
  }));
  render(<MemoryRouter initialEntries={['/resume']}><应用 /><位置探针 /></MemoryRouter>);
  await waitFor(() => expect(当前路径()).toBe('/identity'));
  expect(屏幕挂载次数.get('我的简历') ?? 0).toBe(0);
});

it.each(['/resume', '/hr/jobs'])('Mock 不应用主体角色守卫：%s', (path) => {
  mock应用状态.mockReturnValue(Mock应用值());
  render(<MemoryRouter initialEntries={[path]}><应用 /></MemoryRouter>);
  expect(screen.getByTestId(path === '/resume' ? '屏幕:我的简历' : '屏幕:岗位管理')).toBeTruthy();
});
```

- [ ] **Step 2: 运行完整相关测试**

```bash
npx vitest run src/应用.test.tsx src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
npm run typecheck
npm run lint
```

Expected: 全部 PASS / exit 0。

- [ ] **Step 3: 提交回归测试**

```bash
git add src/应用.test.tsx
git commit -m "test: preserve route recovery boundaries"
```

## Plan Completion Check

- [ ] `git diff --check` 无输出，`git status --short` 为空。
- [ ] 单角色错误深链和刷新从未挂载对侧屏幕。
- [ ] 双 active 只进入显式切换路径，`操作.切身份` 调用次数为 0。
- [ ] shared、Mock、招聘档案缺失和组织失败测试全部通过。
