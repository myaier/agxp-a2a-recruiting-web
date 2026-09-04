# Backend 原型消息与初筛隔离 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Backend 的直聊、A2A 往来和初筛日志深链在读取任何 fixture、建立本地消息 state 或启动 timer 前 fail closed，同时完整保留 Mock 原型。

**Architecture:** 每个页面保留当前唯一的 default 组件和 JSX 布局骨架。hooks 继续无条件、同顺序调用，但 fixture 查找受 Mock 条件保护，Backend 的 lazy state 只初始化为空集合/`null`，effect 与 timer 立即退出；现有内容槽位按模式显示中性说明或原型内容。不新增 React 组件、transcript DTO、operation、通用不可用页或路由层特例。

**Tech Stack:** React 18、React Router 6、TypeScript、Vitest、Testing Library、fake timers。

**Spec:** `docs/superpowers/specs/2026-09-04-frontend-truthfulness-route-state-repair-design.md`

## Global Constraints

- 开始前完整阅读 `CLAUDE.md`、`AGENTS.md`、Spec 和 `2026-09-04-frontend-role-route-boundary.md`。
- 必须在角色路由 Plan 合入后执行；保留其集中式 guard 和 `应用.test.tsx` 覆盖。
- 页面不得直接 `fetch`，不得新增消息/transcript API、DTO、operation、localStorage 或 Backend 本地成功 state。
- Backend 不得读取 Mock fixture、回退列表首项、启动 timer 或显示联系人、公司、岗位、联系方式、消息、输入和发送动作；允许为保持 hooks 顺序创建空数组/`null` 的中性局部 state，但不得用 fixture 初始化或将其当成功态。
- Mock fixture、无效 ID 兜底、发送、叮嘱、举报和 timer 行为保持。
- PM 视觉冻结：不改 CSS、className、内联布局、DOM 布局骨架或区块顺序，不新增 React 组件/组件文件；复用每屏现有页面壳、返回栏、内容容器、按钮和导航钩子。
- 每个 Task 严格执行 red → green → commit。

---

### Task 1: 直聊会话在 Backend 完整退场

**Files:**
- Modify: `src/屏幕/直聊会话.test.tsx`
- Modify: `src/屏幕/直聊会话.tsx`

**Interfaces:**
- Consumes: `use应用状态().数据源模式`、`use导航()`、`路径.主壳`。
- Produces: 现有 `直聊会话()` 内部的模式 gate；Backend 中性 state 与现有槽位说明。

- [ ] **Step 1: 写 Backend 失败测试**

保留现有 Mock 举报测试，删除“Backend 消息流本体照常渲染”的期待。新增无参和带岗位 ID 的用例：

```tsx
it.each(['/chat/direct', '/chat/direct/M-01'])(
  'Backend %s 不展示原型消息或写入口',
  (url) => {
    渲染('backend', url);
    expect(screen.getByText('当前暂不提供直接聊天')).toBeTruthy();
    expect(screen.queryByText(对方.姓名)).toBeNull();
    expect(screen.queryByText(对方.岗位公司)).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /发送/ })).toBeNull();
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock提交P8举报).not.toHaveBeenCalled();
  },
);
```

再以 `vi.useFakeTimers()` 渲染 Backend，执行 `vi.runAllTimers()`，断言没有回执、弹层或 operation。`afterEach` 恢复 real timers。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/屏幕/直聊会话.test.tsx
```

Expected: FAIL；当前 Backend 仍出现 fixture 联系人、消息和输入。

- [ ] **Step 3: 在现有组件内隔离 fixture、state 与 effect**

```tsx
export default function 直聊会话() {
  const { 返回, 跳转 } = use导航();
  const { 数据源模式 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  const { id: 岗位编号 } = useParams<{ id: string }>();
  const 对方 = 是后端 ? null : 取直聊对象(岗位编号);
  const 岗 = 是后端 ? null
    : 市场列表.find((条) => 条.编号 === 岗位编号) ?? 市场列表[0];
  const [消息, 设消息] = useState<会话条[]>(() => 对方?.消息 ?? []);
  const [草稿, 设草稿] = useState('');
  const [已换, 设已换] = useState<('电话' | '微信')[]>([]);
  const [举报层开, 设举报层开] = useState(false);
  const 底部锚 = use自动滚到底(消息, !是后端);

  useEffect(() => {
    if (是后端) {
      设消息([]); 设草稿(''); 设已换([]); 设举报层开(false);
      return;
    }
    设消息(对方?.消息 ?? []);
    设草稿(''); 设已换([]); 设举报层开(false);
  }, [是后端, 岗位编号, 对方?.消息]);

  // 其余事件处理器保持现有定义；入口均先以 是后端 或 对方/岗 null 返回。
  // return 仍是现有 次级页外壳 → 返回栏 → 操作排/旁听条 → 滚动区 → 输入条 骨架。
}
```

把现有 `use自动滚到底` 增加可选 `启用 = true` 参数，effect 在 `!启用` 时直接返回；`真人会话.tsx` 的既有调用不传参，行为不变。Backend 在同一 return 的现有内容槽位只显示“当前暂不提供直接聊天。请从已建立的 MatchCase 进入真人会话。”；复用当前旁听条右侧的 `交回` 按钮槽位，把文案改为“查看在谈”并导航 `路径.主壳`，不增加按钮或布局节点。操作排、联系人、消息 map、输入条和举报层按 `!是后端 && 对方 !== null && 岗 !== null` 条件隐藏。不得新建 `Backend直聊不可用`、`Mock直聊会话` 或其它组件。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/屏幕/直聊会话.test.tsx
git add src/屏幕/直聊会话.tsx src/屏幕/直聊会话.test.tsx
git commit -m "fix: isolate direct chat fixtures from backend"
```

Expected: PASS。

### Task 2: 双端往来记录在 Backend 只提供 Case 导航

**Files:**
- Create: `src/屏幕/往来记录.test.tsx`
- Create: `src/屏幕/企业往来记录.test.tsx`
- Modify: `src/屏幕/往来记录.tsx`
- Modify: `src/屏幕/企业往来记录.tsx`

**Interfaces:**
- Consumes: URL `:id` 作为 opaque Case ID；`路径.在谈详情(id)`、`路径.候选详情(id)`；`use导航()`。
- Produces: 两个现有页面组件内的模式 gate；Backend CTA 只导航同一 `case_id`，Mock 分支保留原行为。

- [ ] **Step 1: 创建候选往来记录失败测试**

测试 harness mock `use应用状态`、`use导航`，分别以 `/thread/mc_real`、`/thread/not-found` 渲染：

```tsx
it.each(['mc_real', 'not-found'])('Backend case %s 不回退 fixture', async (caseId) => {
  const user = userEvent.setup();
  渲染('backend', '/thread/' + caseId);
  expect(screen.getByText('完整 A2A 往来暂未提供查看器')).toBeTruthy();
  expect(screen.queryByText('抖音')).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByText(/记成规则/)).toBeNull();
  await user.click(screen.getByRole('button', { name: '查看阶段进展' }));
  expect(mock跳转).toHaveBeenCalledWith(路径.在谈详情(caseId));
  expect(mock派发).not.toHaveBeenCalled();
});
```

用 fake timers 推进 500ms，断言没有“拿不准”弹层。Mock `/thread/J-01` 仍显示既有对话、可发送叮嘱并延迟显示原型弹层；无效 ID 不崩溃。

- [ ] **Step 2: 创建招聘往来记录失败测试**

镜像 harness 和断言：

```tsx
it.each(['mc_real', 'not-found'])('Backend recruiter case %s 不回退 fixture', async (caseId) => {
  const user = userEvent.setup();
  渲染('backend', '/hr/thread/' + caseId);
  expect(screen.getByText('完整 A2A 往来暂未提供查看器')).toBeTruthy();
  expect(screen.queryByText(在谈候选列表[0].代号)).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  await user.click(screen.getByRole('button', { name: '查看阶段进展' }));
  expect(mock跳转).toHaveBeenCalledWith(路径.候选详情(caseId));
  expect(mock派发).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: 运行测试确认失败**

```bash
npx vitest run src/屏幕/往来记录.test.tsx src/屏幕/企业往来记录.test.tsx
```

Expected: FAIL；当前页面仍回退静态第一项并建立本地消息 state。

- [ ] **Step 4: 在两个现有组件内增加中性 state 与模式 gate**

候选端：

```tsx
export default function 往来记录() {
  const { id = '' } = useParams<{ id: string }>();
  const { 返回, 跳转 } = use导航();
  const { 状态, 派发, 数据源模式 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  const 单 = 是后端 ? null : (
    状态.在谈列表.find((条) => 条.编号 === id) ??
    在谈列表.find((条) => 条.编号 === id) ??
    在谈列表[0]
  );
  const 委托初始记录: 往来条目[] | null = 是后端 ? null : [{
    编号: 2,
    类型: '我方',
    时间: '刚刚',
    内容: '您好，我代表一位匿名候选人：与贵岗硬性画像高度对口（方向 / 年限 / 城市均符合）。请求核对城市、年限与薪资带交集 —— 数值互不披露，仅判断有无。',
  }];
  const [记录, 设记录] = useState<往来条目[]>(() =>
    是后端 ? [] : (id.startsWith('M-') ? 委托初始记录 ?? [] : 初始记录));
  // 其余 state/ref hooks 保持原顺序；fixture 初始化函数只在 Mock 分支调用。
  // mode/id effect：Backend 清空记录/草稿/弹层并清 timer；Mock 重置为现有 fixture。
  // 自动滚动、延迟弹层与写处理器的 effect/入口首行均在 是后端 时 return。

  // return 保留现有 次级页外壳 → 返回栏 → 滚动内容 → 底部输入/弹层 骨架；
  // Backend 在滚动内容槽位显示说明和既有按钮，隐藏底部输入与弹层。
}
```

招聘端把其当前查找候选、选择初始记录的表达式用同样的 `是后端 ? null/[] : 现有表达式` 保护，CTA 调 `路径.候选详情(id)`。fixture import 可留模块顶层，但 Backend 不能执行 `单`、`该候选`、`初始记录` 的查找或复制；不新增普通 helper 或 React 组件。

- [ ] **Step 5: 运行并提交**

```bash
npx vitest run src/屏幕/往来记录.test.tsx src/屏幕/企业往来记录.test.tsx
git add src/屏幕/往来记录.tsx src/屏幕/往来记录.test.tsx src/屏幕/企业往来记录.tsx src/屏幕/企业往来记录.test.tsx
git commit -m "fix: hide prototype threads in backend"
```

Expected: PASS。

### Task 3: 初筛列表与对话在 Backend 退场

**Files:**
- Create: `src/屏幕/初筛记录.test.tsx`
- Create: `src/屏幕/初筛对话.test.tsx`
- Modify: `src/屏幕/初筛记录.tsx`
- Modify: `src/屏幕/初筛对话.tsx`

**Interfaces:**
- Consumes: `use应用状态().数据源模式`、现有 `返回栏`。
- Produces: 两个现有组件中的 Backend 最小只读说明；Mock 分支继续使用 `本周初筛记录`、`初筛对话表` 和 `在招岗位列表`。

- [ ] **Step 1: 写两屏失败测试**

```tsx
it('Backend 初筛列表不显示 fixture', () => {
  渲染列表('backend', '/hr/screening-log');
  expect(screen.getByText('该原型日志没有权威数据源')).toBeTruthy();
  expect(screen.queryByText(本周初筛记录[0].代号)).toBeNull();
});

it.each(['S-01', 'not-found'])('Backend 初筛对话 %s 不读取 fixture', (id) => {
  渲染对话('backend', '/hr/screening-log/' + id);
  expect(screen.getByText('该原型日志没有权威数据源')).toBeTruthy();
  expect(screen.queryByText(本周初筛记录[0].画像)).toBeNull();
  expect(screen.queryByText(/硬性 [0-9]/)).toBeNull();
});
```

Mock 列表仍按岗位分组并导航到 `路径.初筛对话(id)`；合法对话显示结论和 transcript；无效 ID 显示既有“没有这条初筛记录”。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/屏幕/初筛记录.test.tsx src/屏幕/初筛对话.test.tsx
```

Expected: FAIL；当前页面直接读取企业 fixture。

- [ ] **Step 3: 在现有布局槽位内分流**

```tsx
export default function 初筛记录() {
  const { 跳转, 返回 } = use导航();
  const { 数据源模式 } = use应用状态();
  const 分组们 = 数据源模式 === 'backend' ? [] : 按岗位分组(本周初筛记录);
  // 保留现有 次级页外壳 / 返回栏 / 滚动区 / 列表容器；
  // Backend 在列表容器显示中性文案，Mock 继续渲染分组。
}

export default function 初筛对话() {
  const { id = '' } = useParams<{ id: string }>();
  const { 返回 } = use导航();
  const { 数据源模式 } = use应用状态();
  const 记录 = 数据源模式 === 'backend'
    ? undefined
    : 本周初筛记录.find((条) => 条.编号 === id);
  const 对话 = 数据源模式 === 'backend' || 记录 === undefined
    ? []
    : 初筛对话表[记录.编号] ?? [];
  // 保留现有页面壳、返回栏和内容容器；Backend 只替换内容槽位。
}
```

两个现有组件都精确显示“该原型日志没有权威数据源”。`按岗位分组` 和现有 `记录行`/结论渲染只供 Mock 分支使用；不新增 `初筛日志不可用`、Mock 子组件或共享组件，不改现有 className 与布局。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/屏幕/初筛记录.test.tsx src/屏幕/初筛对话.test.tsx
git add src/屏幕/初筛记录.tsx src/屏幕/初筛记录.test.tsx src/屏幕/初筛对话.tsx src/屏幕/初筛对话.test.tsx
git commit -m "fix: fail closed prototype screening logs"
```

Expected: PASS。

### Task 4: 补齐应用深链回归并验证整组

**Files:**
- Modify: `src/应用.test.tsx`

**Interfaces:**
- Consumes: 前一个 Plan 的角色 guard 和本 Plan 三组模式分流。
- Produces: Backend 深链仍注册且按正确角色可达的路由证据。

- [ ] **Step 1: 增加应用深链表测**

```tsx
it.each([
  ['candidate', '/chat/direct'],
  ['candidate', '/chat/direct/M-01'],
  ['candidate', '/thread/mc_real'],
  ['recruiter', '/hr/thread/mc_real'],
  ['recruiter', '/hr/screening-log'],
  ['recruiter', '/hr/screening-log/S-01'],
] as const)('%s 可以进入已注册的 %s 安全页面', async (role, url) => {
  const 当前主体 = role === 'candidate'
    ? 主体('candidate', 'active', null)
    : 主体('recruiter', null, 'active');
  mock应用状态.mockReturnValue(后端应用值({
    初始化: '完成', 已登录: true, 主体: 当前主体,
    招聘方组织水合: { 阶段: '成功', 错误: null },
    招聘方档案水合阶段: '成功',
  }));
  render(<MemoryRouter initialEntries={[url]}><应用 /><位置探针 /></MemoryRouter>);
  await waitFor(() => expect(当前路径()).toBe(url));
});
```

复用角色路由 Plan 已加入的 `主体()` 工厂。页面具体 DOM 由本 Plan 的页面测试覆盖；不要从 Backend 路由表删除这些路径，否则 Mock 会回归。

- [ ] **Step 2: 运行定向验证**

```bash
npx vitest run   src/应用.test.tsx   src/屏幕/直聊会话.test.tsx   src/屏幕/往来记录.test.tsx   src/屏幕/企业往来记录.test.tsx   src/屏幕/初筛记录.test.tsx   src/屏幕/初筛对话.test.tsx
npm run typecheck
npm run lint
```

Expected: 全部 PASS / exit 0。

- [ ] **Step 3: 提交集成回归**

```bash
git add src/应用.test.tsx
git commit -m "test: cover backend prototype deep links"
```

## Plan Completion Check

- [ ] `git diff --check` 无输出，`git status --short` 为空。
- [ ] Backend 五类屏幕不展示 fixture 业务事实或输入动作。
- [ ] Backend fake timers 推进后无消息、回执或弹层变化。
- [ ] 真实和无效 ID 都不回退另一条 fixture。
- [ ] Mock 页面仍可渲染 fixture 并完成原型交互。
- [ ] 实现范围的 `git diff --name-only` 不含 CSS/产品组件新文件；非测试产品代码的 diff 不含 className、内联布局或页面骨架改动，也没有新增 React 组件声明。
