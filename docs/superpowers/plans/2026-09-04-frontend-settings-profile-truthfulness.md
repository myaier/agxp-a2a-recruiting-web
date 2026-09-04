# 设置与“我的”真实性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让求职状态、产品反馈、帮助 FAQ、设置页和双端“我的”在 Backend 只呈现权威事实或明确不可用状态，并删除没有独立目标的归档岗位入口。

**Architecture:** 页面继续使用现有状态和组件，只在模式/角色边界上选择闭合数据与文案。Backend 求职状态来自已水合简历身份，反馈来自三项闭合映射，FAQ 来自当前角色的小型静态事实表；Mock 原型保持，岗位重复入口直接删除。

**Tech Stack:** React 18、TypeScript、Vitest、Testing Library。

**Spec:** `docs/superpowers/specs/2026-09-04-frontend-truthfulness-route-state-repair-design.md`

## Global Constraints

- 开始前完整阅读 `CLAUDE.md`、`AGENTS.md` 和 Spec。
- Backend 不得把 Mock、localStorage、浏览器局部轮转或 Hosted Agent Plan 03 当成业务事实。
- 不新增客服、Agent status、intention PATCH、实名或 MatchCase summary API。
- 不改 CSS、法律条款、正式运营文案或 `用户协议.tsx`。
- Backend 规则数继续服从现有水合 gate；MatchCase 数字继续服从现有 `取P5Open统计`，不得回退 fixture。
- Mock 的五类反馈、客服演示和求职状态轮转保持；仅“归档岗位”重复入口按已批准设计从两种模式删除。
- PM 视觉冻结：不改 CSS、className、内联布局、DOM 布局骨架或区块顺序，不新增 React 组件/组件文件；只在现有行、卡、页脚和内容槽位内切换文字、可见性、禁用态与数据。
- 每个 Task 严格执行 red → green → commit。

---

### Task 1: 求职意向页读取权威身份

**Files:**
- Create: `src/屏幕/求职意向管理.test.tsx`
- Modify: `src/屏幕/求职意向管理.tsx`

**Interfaces:**
- Consumes: `数据源模式`、`后端状态.简历快照`、`状态.基本信息.身份`。
- Produces: `求职状态文案(身份): string`；Backend 行无本地 mutation。

- [ ] **Step 1: 创建身份矩阵失败测试**

mock `use应用状态` 和 `use导航`，用同一 harness 覆盖：

```tsx
it.each([
  ['在校', '在校 · 看机会'],
  ['在职', '在职 · 保密求职中'],
  ['离职', '离职 · 随时到岗'],
] as const)('Backend %s 显示 %s', (身份, 文案) => {
  渲染Backend({ 身份, 已水合: true });
  expect(screen.getByText(文案)).toBeTruthy();
});

it('Backend 未水合显示中性值且点击不轮转', async () => {
  const user = userEvent.setup();
  渲染Backend({ 身份: '在职', 已水合: false });
  const 行 = screen.getByText('求职状态').closest('button');
  expect(screen.getByText('—')).toBeTruthy();
  if (行) await user.click(行);
  expect(screen.getByText('—')).toBeTruthy();
});
```

Mock 连续点击仍按当前三档 `在职 · 看好机会 → 在职 · 随便看看 → 离职 · 尽快到岗` 循环。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/屏幕/求职意向管理.test.tsx
```

Expected: 当前 Backend 固定本地第一档且可点击，身份矩阵 FAIL。

- [ ] **Step 3: 实现模式分支**

```ts
export function 求职状态文案(身份: '在校' | '在职' | '离职'): string {
  return {
    在校: '在校 · 看机会',
    在职: '在职 · 保密求职中',
    离职: '离职 · 随时到岗',
  }[身份];
}
```

组件读取完整上下文：

```tsx
const { 状态, 数据源模式, 后端状态 } = use应用状态();
const 是后端 = 数据源模式 === 'backend';
const 状态值 = 是后端
  ? 后端状态.简历快照 === null ? '—' : 求职状态文案(状态.基本信息.身份)
  : 求职状态档位[求职状态下标];

<设置行
  标题="求职状态"
  值={状态值}
  按下={是后端 ? undefined : () => 设求职状态下标((旧) => (旧 + 1) % 求职状态档位.length)}
  无分隔线
/>
```

现有 `设置行.按下` 已是可选属性：Backend 传 `undefined` 后组件会渲染 `<div>`，无需修改通用组件 API，也不得传空处理器伪装可点击。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/屏幕/求职意向管理.test.tsx
git add src/屏幕/求职意向管理.tsx src/屏幕/求职意向管理.test.tsx
git commit -m "fix: show authoritative candidate status"
```

Expected: PASS。

### Task 2: Backend 反馈只保留三项闭合产品分类

**Files:**
- Modify: `src/屏幕/反馈.tsx`
- Modify: `src/屏幕/反馈.test.tsx`
- Modify: `src/屏幕/设置.tsx`
- Modify: `src/屏幕/设置.test.tsx`
- Modify: `src/屏幕/企业设置.tsx`
- Modify: `src/屏幕/企业设置.test.tsx`

**Interfaces:**
- Consumes: `P8FeedbackCategory`、`操作.提交P8反馈(category, body)`。
- Produces: 单一闭合表 `Backend反馈分类`，同时派生按钮、placeholder 和 wire enum。

- [ ] **Step 1: 改写 Backend 反馈失败测试**

删除“Backend 举报分类仍出现但点击只 Toast”的旧断言，加入：

```tsx
it('Backend 初始即为可提交产品分类且不出现举报', async () => {
  渲染('backend');
  expect(screen.getByRole('button', { name: '功能异常' })).toBeTruthy();
  expect(screen.queryByText('举报虚假岗位')).toBeNull();
  expect(screen.queryByText('举报骚扰行为')).toBeNull();
  expect(screen.getByText(举报入口指引)).toBeTruthy();
  await userEvent.type(screen.getByRole('textbox'), '页面无法打开');
  await userEvent.click(screen.getByRole('button', { name: '提交' }));
  expect(mock提交P8反馈).toHaveBeenCalledWith('bug', '页面无法打开');
});
```

保留三分类 wire 表测、pending 锁、失败保留输入和 Mock 五分类测试。设置两端测试断言 Backend 入口叫“产品反馈”，Mock 仍叫“反馈与举报”。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/屏幕/反馈.test.tsx src/屏幕/设置.test.tsx src/屏幕/企业设置.test.tsx
```

Expected: 当前 Backend 默认举报并显示五分类，新增用例 FAIL。

- [ ] **Step 3: 用一个闭合表派生 Backend UI 与 payload**

```ts
const Backend反馈分类 = [
  { 名称: '功能异常', placeholder: '在哪一屏、做了什么、期望看到什么？', wire: 'bug' },
  { 名称: '体验建议', placeholder: '你希望它变成什么样？', wire: 'suggestion' },
  { 名称: '其他', placeholder: '想说的都可以写在这里。', wire: 'other' },
] as const satisfies readonly {
  名称: string;
  placeholder: string;
  wire: P8FeedbackCategory;
}[];
```

Mock 保留原 `分类表` 和 `占位表`。不增加外层组件或 mode-switch effect；用派生的有效分类保证 Backend 首帧和运行时切源都不会短暂保留举报类别：

```tsx
const [已选分类, 设已选分类] = useState<string>(分类表[0]);
const 可见分类 = 是后端 ? Backend反馈分类 : 分类表;
const 有效分类 = 可见分类.some((项) =>
  (typeof 项 === 'string' ? 项 : 项.名称) === 已选分类)
  ? 已选分类
  : (typeof 可见分类[0] === 'string' ? 可见分类[0] : 可见分类[0].名称);
```

类别按钮、placeholder、可提交条件和 payload 全部读取 `有效分类`；点击类别才更新 `已选分类`。Backend 提交只能从 `Backend反馈分类.find` 取得 wire；找不到时直接不提交并显示持久说明，不能透传 `undefined`。说明精确为“举报需从具体岗位、谈判或真人会话发起”。

设置和企业设置入口按模式显示：

```tsx
<span className={样式.行标题}>{是后端 ? '产品反馈' : '反馈与举报'}</span>
```

Backend 反馈页返回栏同样用“产品反馈”。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/屏幕/反馈.test.tsx src/屏幕/设置.test.tsx src/屏幕/企业设置.test.tsx
git add src/屏幕/反馈.tsx src/屏幕/反馈.test.tsx src/屏幕/设置.tsx src/屏幕/设置.test.tsx src/屏幕/企业设置.tsx src/屏幕/企业设置.test.tsx
git commit -m "fix: limit backend feedback to product reports"
```

Expected: PASS。

### Task 3: Backend 帮助页按当前角色选择最小 FAQ

**Files:**
- Create: `src/屏幕/帮助与客服.test.tsx`
- Modify: `src/屏幕/帮助与客服.tsx`

**Interfaces:**
- Consumes: `后端状态.主体?.last_used_role`、`数据源模式`、两端 Agent 页面路径。
- Produces: `Backend候选问答`、`Backend招聘问答`；未知角色为空且不猜测。

- [ ] **Step 1: 创建角色与运营事实失败测试**

```tsx
it('Backend candidate 只显示候选 FAQ', () => {
  渲染Backend('candidate');
  expect(screen.getByText('企业什么时候能看到我的资料？')).toBeTruthy();
  expect(screen.queryByText('怎样发布和管理岗位？')).toBeNull();
});

it('Backend recruiter 只显示招聘 FAQ', () => {
  渲染Backend('recruiter');
  expect(screen.getByText('怎样发布和管理岗位？')).toBeTruthy();
  expect(screen.queryByText('企业什么时候能看到我的资料？')).toBeNull();
});

it.each(['400-000-0000', '8:00–22:00', '人力资源服务许可证', '资质证照'])(
  'Backend 不显示占位运营事实 %s', (text) => {
    渲染Backend('candidate');
    expect(screen.queryByText(new RegExp(text))).toBeNull();
    expect(screen.queryByRole('button', { name: '转人工客服' })).toBeNull();
  },
);
```

Mock 继续显示 `常见问答`、人工客服按钮和演示信息。候选 Agent CTA 导航 `路径.问AI代理`；招聘 CTA 导航 `路径.企业问AI代理`。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/屏幕/帮助与客服.test.tsx
```

Expected: recruiter 看到候选 FAQ，Backend 仍显示热线、许可证和无效客服按钮。

- [ ] **Step 3: 实现两份最小 Backend FAQ 和模式派生**

```ts
const Backend候选问答 = [
  { 编号: 'BC-01', 分类: '隐私与披露', 问: '企业什么时候能看到我的资料？', 答: '是否披露以当前 MatchCase 阶段和你的披露选择为准。' },
  { 编号: 'BC-02', 分类: '阶段进展', 问: '在哪里查看匹配进展？', 答: '在“在谈”中打开对应 MatchCase 查看阶段和待处理动作。' },
] as const;

const Backend招聘问答 = [
  { 编号: 'BR-01', 分类: '岗位管理', 问: '怎样发布和管理岗位？', 答: '从招聘端“我的”进入发布岗位或岗位管理。' },
  { 编号: 'BR-02', 分类: '阶段进展', 问: '在哪里查看候选进展？', 答: '在人才页打开对应 MatchCase 查看阶段和待处理动作。' },
] as const;
```

`页面问答` 在 Mock 使用 `常见问答`，Backend 按 role 选一份，null role 用空数组。分类表从 `页面问答` 派生。role/mode 变化时把分类复位“全部”、展开项设为新表首项。Backend 客服区只显示“人工客服暂未开放”的不可点击说明，不渲染 hotline、工作时间、许可证、Toast state 或客服按钮。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/屏幕/帮助与客服.test.tsx
git add src/屏幕/帮助与客服.tsx src/屏幕/帮助与客服.test.tsx
git commit -m "fix: scope backend help by active role"
```

Expected: PASS。

### Task 4: 设置与双端“我的”删除无合同运营/在线断言

**Files:**
- Modify: `src/屏幕/设置.tsx`
- Modify: `src/屏幕/设置.test.tsx`
- Modify: `src/屏幕/我的.tsx`
- Modify: `src/屏幕/我的.test.tsx`
- Modify: `src/屏幕/企业我的.tsx`
- Modify: `src/屏幕/企业我的.test.tsx`
- Test: `src/屏幕/岗位管理.test.tsx`

**Interfaces:**
- Consumes: `是后端`、候选 `Backend统计.open`、招聘 `在招数`、现有规则水合 gate。
- Produces: Backend 事实性 Agent 卡；删除重复“归档岗位”入口。

- [ ] **Step 1: 写 Backend DOM 失败测试**

两端“我的”和候选设置测试至少断言：

```tsx
for (const text of ['在线', '并行寻访', '400-000-0000', '人力资源服务许可证', '资质证照']) {
  expect(screen.queryByText(new RegExp(text))).toBeNull();
}
```

候选“我的”应显示 `当前 MatchCase：N/N+/—` 和已水合规则数；招聘“我的”应显示 `N 个在招岗位`，但无在线绿点与“并行寻访”。Mock 仍显示原型在线文案和页脚。

招聘“我的”新增：

```tsx
expect(screen.getAllByText('岗位管理')).toHaveLength(1);
expect(screen.queryByText('归档岗位')).toBeNull();
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/屏幕/设置.test.tsx src/屏幕/我的.test.tsx src/屏幕/企业我的.test.tsx
```

Expected: Backend 仍显示在线/运营事实，招聘有重复入口。

- [ ] **Step 3: 用模式分支收口 JSX**

候选设置与企业设置都先补测试：Backend 不渲染“当前版本”整行及 `0.9.0（原型）`，Mock 保持；这是删除没有权威版本来源的原型断言，不替换成另一版本号。

候选 Agent 卡：

```tsx
{!是后端 ? <span className={样式.在线点} /> : null}
<span className={'单行 ' + 样式.代理状态}>
  {是后端
    ? '当前 MatchCase：' + Backend统计.open
    : '在线 · 正在跟进 ' + 状态.在谈列表.length + ' 个机会'}
  {可显示候选规则数 ? <> · 规则 {生效规则数} 条生效</> : null}
</span>
```

招聘 Agent 卡：

```tsx
{!是后端 ? <span className={样式.在线点} /> : null}
<span className={'单行 ' + 样式.代理状态}>
  {是后端 ? 在招数 + ' 个在招岗位' : '在线 · 正为 ' + 在招数 + ' 个岗位并行寻访'}
  {可显示招聘规则数 ? <> · 规则 {生效规则数} 条生效</> : null}
</span>
```

三处占位运营页脚（`设置.tsx`、`我的.tsx`、`企业我的.tsx`）只在 Mock 渲染；`设置.tsx` 和 `企业设置.tsx` 的“当前版本”行也只在 Mock 渲染。不要删除 CSS。删除 `企业我的.tsx` 的 `{ 名称: '归档岗位', ... }` 项；岗位管理页不新增 query、state、fragment、自动滚动或假归档数据。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/屏幕/设置.test.tsx src/屏幕/我的.test.tsx src/屏幕/企业我的.test.tsx src/屏幕/岗位管理.test.tsx
git add src/屏幕/设置.tsx src/屏幕/设置.test.tsx src/屏幕/我的.tsx src/屏幕/我的.test.tsx src/屏幕/企业我的.tsx src/屏幕/企业我的.test.tsx
git commit -m "fix: remove unsupported backend status claims"
```

Expected: PASS；岗位 CRUD 测试保持。

### Task 5: 运行本 Plan 联合验证

**Files:**
- Test: all files changed by this Plan

**Interfaces:**
- Consumes: Tasks 1–4。
- Produces: Backend/Mock 真实性回归证据。

- [ ] **Step 1: 运行定向测试**

```bash
npx vitest run   src/屏幕/求职意向管理.test.tsx   src/屏幕/反馈.test.tsx   src/屏幕/帮助与客服.test.tsx   src/屏幕/设置.test.tsx   src/屏幕/企业设置.test.tsx   src/屏幕/我的.test.tsx   src/屏幕/企业我的.test.tsx   src/屏幕/岗位管理.test.tsx
npm run typecheck
npm run lint
```

Expected: 全部 PASS / exit 0。

- [ ] **Step 2: 检查范围**

```bash
git diff --check
git status --short
```

Expected: 无未提交文件；未修改 `用户协议.tsx`、CSS、后端合同或 operation。

## Plan Completion Check

- [ ] Backend 求职状态只来自已水合身份，点击不产生假变更。
- [ ] Backend 反馈首帧可提交、只见三分类，失败保留输入。
- [ ] candidate/recruiter FAQ 不串角色且无占位客服事实。
- [ ] Backend 双端“我的”无在线断言；招聘在招数与规则 gate 正确。
- [ ] “归档岗位”重复入口消失，岗位 CRUD 不回归。
- [ ] 实现范围的 `git diff --name-only` 不含 CSS/产品组件新文件；非测试产品代码的 diff 不含 className、内联布局或页面骨架改动，也没有新增 React 组件声明。
