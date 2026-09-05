# 纯前端数据污染与错误深链修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不新增后端合同的前提下，阻止无效深链操作错误资源或创建新资源，并确保 Backend 模式只持久化用户明确选择或权威返回的候选资料。

**Architecture:** 保持当前 React Context、数据源和 operation 分层。资源型页面用 URL 中的完整坐标精确选择权威对象；编辑器用 keyed 子组件把局部 state 生命周期绑定到资源 ID；onboarding 用显式“未选择”状态和现有 inline 校验取代业务默认值。所有修改局限在现有页面、领域类型、路由表和测试，不增加后端 API、通用表单框架或新状态库。

**Tech Stack:** React 19.2、React Router 7.18、TypeScript 6.0、Vitest 4.1、Testing Library 16.3、Vite 8.2。

**Spec:** `docs/handoffs/2026-09-04-pure-frontend-completed-modules-bugbash-handoff.md` 的 D3、D4、E0、J、L、M、N、R、S，以及本文“冻结问题与目标行为”中的 D4a 和 onboarding 首屏默认值 Case。

## Global Constraints

- 仓库：`myaier/agxp-a2a-recruiting-web`；计划校准基线：`main@fc0062817bb2dc360934ebec4a11a5c2f4dc1256`；实施前运行 `git fetch origin` 并检查相关文件的新提交。
- 工作模式：问题只存在于或重点约束 `VITE_DATA_SOURCE=backend`；除明确写出的 Mock 回归外，不改变 Mock 演示行为。
- 页面不得直接 `fetch`；继续使用 `use应用状态()` 暴露的 `状态`、`后端状态`、`操作` 与现有 data source。
- Backend 无效 ID、跨主体 ID、已删除 ID 和旧 URL 一律 fail closed：不显示别的资源、不挂载写控件、不发 mutation、不回退 Mock。
- `应用.tsx` 在 Backend `后端状态.初始化 === '进行中'` 时只渲染全局 `路由加载中`，业务路由不会挂载；因此 Task 1–3 收到的空 owner 列表已是初始化完成后的权威空态，不在页面内再造第二套“等待水合”状态。
- 空值不得通过显示默认进入业务 payload。滚轮因组件限制必须显示落点时，用“显示值 + 已确认布尔值”分离；只有已有权威值、真实预填建议或用户操作才能把布尔值设为 true。
- 后端 strict decoder、session/subject/role/scope generation fence、single-flight、CAS、幂等键和 401 清理逻辑保持不变。
- 不修改 CSS、DOM 区块顺序或 PM 文案体系；安全退场复用 `次级页外壳`、`返回栏`、`主按钮`、`轻提示` 和既有返回路由。
- 不实现 candidate onboarding completion guard。该能力缺少权威后端三态合同，不能从简历完整度、意向数量或 sessionStorage 推断。
- 每个 Task 严格 red → green → commit；只提交本 Task 的文件。

## 开始前环境与代码地图

```bash
git fetch origin
git status --short
npm ci
npm run typecheck
```

若工作区已有用户改动，保留并绕开；不能用 reset/checkout 丢弃。`npm ci` 或测试因环境缺失失败时，记录精确错误并停止声称通过。

关键分层：

- `src/路由/路径表.ts`：所有 route builder/template 的唯一入口。
- `src/应用.tsx`：路由注册与既有角色边界。
- `src/屏幕/*.tsx`：页面渲染和局部表单 state；不直接调用 HTTP。
- `src/状态/应用状态.tsx`、`src/状态/领域/候选资料.ts`：Context 组合与候选草稿 reducer。
- `src/数据/后端映射.ts`：BFF wire DTO 与页面领域类型的双向映射。
- `src/数据/资料缓存.ts`：Backend candidate onboarding 草稿的 subject-scoped sessionStorage strict decoder。

## 冻结问题与目标行为

| Case | 当前证据 | 目标行为 |
| --- | --- | --- |
| D3 | `岗位详情.tsx:47-49` 使用 `find(...) ?? 岗位列表[0]`。 | Backend 只接受路由 ID 的精确 owner 岗位；未命中显示安全退场且零 mutation。 |
| D4 | `发布岗位.tsx:294-299` 将“URL 有 ID 但未命中”折叠为 `编辑态=false`。 | 只有无 ID 才是新建；有 ID 未命中不可用。 |
| D4a | `发布岗位.tsx:301-351` 的二十余个 `useState` 仅首次读取 `编辑目标`。 | A→B 路由切换必须销毁 A 的全部草稿、JD 状态、锁与 timer，再以 B 初始化。 |
| E0 | `候选资料.ts:176-181` 未命中意向时返回 `空意向草稿`，保存随后走 create。 | Backend 有 ID 未命中时不挂载表单；`/intentions/new` 才允许 create。 |
| J | `/hr/resume/:id` 只有 recommendation ID；页面却用 `状态.当前岗位编号` 调双坐标 API。 | canonical URL 同时携带 `jobId` 与 `recommendationId`；所有读写与 scope 都只取 URL。 |
| L | `基本信息.tsx:57-58,168-172` 空生日显示并保存 `1998-06`。 | 未确认时保存 `null` 语义，即不向草稿加入出生年月；已有值和真实建议正常 round-trip。 |
| M | `后端映射.ts:84-85` 把空 status 转成“在职”，`求职状态.tsx:45-56` 又自动保存默认档。 | 页面领域允许空身份；用户明确选择到岗档后才写 employed/unemployed/student。 |
| N | `最高学历.tsx:32-46` 空教育默认“本科/本科在读”并创建记录。 | 未选择不高亮、不创建教育记录；下一步给出可见校验。 |
| R | `就读时间段.tsx:29-49,62-70` 空时间用 2021/2025 初始化并保存。 | 显示落点与确认态分离；未确认下一步零保存。 |
| S | `引导问答.tsx:27,1240` 在 Backend 点击按钮写入 Mock `个人优势文本`。 | Mock 保留原型恢复；Backend 只有存在当前轮真实 summary 建议时才显示“恢复简历识别建议”，且只改页面草稿。 |
| 首屏默认 | `学生分流.tsx:114,139-146,205-224` 与 `默认求职初筛偏好()` 自动写身份、类型、办公方式、实习参数、毕业月。 | Backend 初次进入时身份、类型、办公方式及条件字段均未选择；用户明确选择后才进入草稿。 |

## 分阶段执行顺序

1. 第一阶段（P0 错误写入）：Task 1–3，先关闭 D3、D4/D4a、E0。
2. 第二阶段（P0/P1 数据污染）：Task 4–7，处理 S、M/首屏默认、L、N/R。
3. 第三阶段（P1 canonical 深链）：Task 8，迁移 J 的完整 URL 坐标。
4. 第四阶段（整批验证）：Task 9。

---

### Task 1: 招聘岗位详情精确命中路由 ID（P0 / D3）

**Files:**
- Modify: `src/屏幕/岗位详情.test.tsx`
- Modify: `src/屏幕/岗位详情.tsx:32-72`

**Interfaces:**
- Consumes: `useParams<{ id: string }>()`、`数据源模式`、`状态.岗位列表`、`路径.岗位管理`。
- Produces: `const 岗` 在 Backend 未命中时为 `undefined`；不可用页不创建任何岗位 mutation target。

- [ ] **Step 1: 写失败测试**

扩展现有 `渲染岗位详情()` harness，给 Backend 状态两条岗位 `job_a`/`job_b`，加入：

```tsx
it.each(['missing', 'deleted_from_previous_snapshot'])('Backend 无效岗位 %s 不回退首项', (id) => {
  渲染岗位详情(id);
  expect(screen.getByText('岗位不存在或已不可用')).toBeTruthy();
  expect(screen.queryByText('岗位 A')).toBeNull();
  expect(screen.queryByText('岗位 B')).toBeNull();
  expect(screen.queryByRole('button', { name: /编辑|关闭职位|重新开放/ })).toBeNull();
  expect(mock更新岗位).not.toHaveBeenCalled();
});
```

保留一条 Mock 随机 ID 测试，明确仍显示原型首项。

- [ ] **Step 2: 运行测试确认 red**

```bash
npx vitest run src/屏幕/岗位详情.test.tsx
```

Expected: Backend 无效 ID 用例 FAIL，因为 DOM 出现列表第一条岗位。

- [ ] **Step 3: 实现模式隔离的精确查找**

把当前查找改为：

```tsx
const 精确岗位 = 状态.岗位列表.find((条) => 条.编号 === 路由岗位编号);
const 岗: 在招岗位 | undefined = 是后端 ? 精确岗位 : (精确岗位 ?? 状态.岗位列表[0]);
```

把 `!岗` 分支补成现有页面壳内的终局不可用页：正文为“岗位不存在或已不可用”，唯一按钮调用 `跳转(路径.岗位管理)`。该 return 必须继续位于 `useEffect` 之后，不能制造条件 hooks。

- [ ] **Step 4: 运行测试确认 green**

```bash
npx vitest run src/屏幕/岗位详情.test.tsx
```

Expected: PASS；Backend 无效 ID 无其它岗位事实或动作，Mock 回归通过。

- [ ] **Step 5: 提交**

```bash
git add src/屏幕/岗位详情.tsx src/屏幕/岗位详情.test.tsx
git commit -m "fix: fail closed on invalid recruiter job links"
```

### Task 2: 岗位编辑区分新建、无效坐标与 A→B（P0 / D4、D4a）

**Files:**
- Modify: `src/屏幕/发布岗位.test.tsx`
- Modify: `src/屏幕/发布岗位.tsx:281-351`

**Interfaces:**
- Produces: default export 只负责解析路由/判定 target；文件内 `岗位编辑表单({ 路由岗位编号 }: { 路由岗位编号?: string })` 承载现有全部 hooks，以 `key={路由岗位编号 ?? 'new'}` 重挂。
- Consumes: 现有 `操作.发布岗位`、`操作.更新岗位`、JD import state 和 owner `岗位列表`。

- [ ] **Step 1: 写无效编辑坐标失败测试**

```tsx
it('Backend 有路由 ID 但 owner 列表未命中时不进入新建', () => {
  render发布岗位('/hr/post-job/missing');
  expect(screen.getByText('岗位不存在或已不可编辑')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '发布岗位并开始寻访' })).toBeNull();
  expect(screen.queryByText(/上传 JD/)).toBeNull();
  expect(mock发布岗位).not.toHaveBeenCalled();
  expect(mock更新岗位).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 写 A→B 生命周期失败测试**

用同一个 `MemoryRouter` 先渲染 `job_a`，修改岗位名称和薪资，再由测试导航按钮进入 `job_b`：

```tsx
expect(screen.getByDisplayValue('岗位 B')).toBeTruthy();
expect(screen.queryByDisplayValue('被修改的岗位 A')).toBeNull();
await 用户.click(screen.getByRole('button', { name: /保存岗位/ }));
expect(mock更新岗位).toHaveBeenCalledWith(expect.objectContaining({ 编号: 'job_b', 名称: '岗位 B' }));
expect(mock发布岗位).not.toHaveBeenCalled();
```

- [ ] **Step 3: 运行测试确认 red**

```bash
npx vitest run src/屏幕/发布岗位.test.tsx
```

Expected: missing 进入新建；A→B 仍显示 A 的局部 state。

- [ ] **Step 4: 用路由 wrapper 隔离无效态与表单 hooks**

目标结构固定为：

```tsx
export default function 发布岗位() {
  const { id: 路由岗位编号 } = useParams<{ id: string }>();
  const { 状态, 数据源模式 } = use应用状态();
  const { 返回, 跳转 } = use导航();
  const 编辑目标 = 路由岗位编号
    ? 状态.岗位列表.find((岗位) => 岗位.编号 === 路由岗位编号)
    : undefined;
  const 无效后端编辑 = 数据源模式 === 'backend' && 路由岗位编号 !== undefined && 编辑目标 === undefined;

  if (无效后端编辑) {
    return (
      <次级页外壳>
        <返回栏 返回={返回} 标题="编辑岗位" />
        <div>岗位不存在或已不可编辑</div>
        <主按钮 文字="返回岗位管理" 按下={() => 跳转(路径.岗位管理)} />
      </次级页外壳>
    );
  }
  return <岗位编辑表单 key={路由岗位编号 ?? 'new'} 路由岗位编号={路由岗位编号} />;
}
```

将当前 `发布岗位` 函数重命名为 `岗位编辑表单`，参数改为 `{ 路由岗位编号 }: { 路由岗位编号?: string }`，删除函数内部原来的 `useParams`；其余 hooks、事件和 JSX 均留在该子组件。然后在其前方加入上面的 default wrapper。`岗位编辑表单` 内仍从 Context 精确取得 `编辑目标`。key 变化必须同时销毁字段 state、JD generation/timer、待确认文件和提交锁；不要另写二十余个 setter 的重置 effect。

- [ ] **Step 5: 运行测试确认 green**

```bash
npx vitest run src/屏幕/发布岗位.test.tsx
```

- [ ] **Step 6: 提交**

```bash
git add src/屏幕/发布岗位.tsx src/屏幕/发布岗位.test.tsx
git commit -m "fix: bind job editor state to route target"
```

### Task 3: 无效意向编辑不能变成新增（P0 / E0）

**Files:**
- Modify: `src/屏幕/添加意向.test.tsx`
- Modify: `src/屏幕/添加意向.tsx:70-115`

**Interfaces:**
- Consumes: `路由编号`、`数据源模式`、`状态.求职意向表`、`状态.后端意向服务端`。
- Produces: 文件内 `意向编辑表单({ 路由编号 })`；Backend 无效 ID 不派发 `开意向草稿`，新增只来自 `/intentions/new`。

- [ ] **Step 1: 写三态失败测试**

```tsx
it.each(['missing', 'archived', 'other_subject'])('Backend 无效意向 %s 不打开空草稿', (id) => {
  render添加意向(`/intentions/${id}`);
  expect(screen.getByText('这条求职意向不存在或已不可编辑')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
  expect(mock保存意向).not.toHaveBeenCalled();
  expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '开意向草稿' }));
});
```

另保留 `/intentions/new` 可 create、有效 active ID 可 update 的对照用例。

- [ ] **Step 2: 运行测试确认 red**

```bash
npx vitest run src/屏幕/添加意向.test.tsx
```

- [ ] **Step 3: 在草稿 effect 之外建立 route gate**

default export 只解析 ID、读取 Context 并做判定；有效态返回 keyed 子组件：

```tsx
const 有后端目标 = 路由编号 !== undefined
  && 状态.后端意向服务端[路由编号]?.status === 'active';
const 无效后端编辑 = 数据源模式 === 'backend' && 路由编号 !== undefined && !有后端目标;

if (无效后端编辑) return <意向不可编辑 返回管理={() => 跳转(路径.求职意向管理)} />;
return <意向编辑表单 key={路由编号 ?? 'new'} 路由编号={路由编号} />;
```

`意向不可编辑({ 返回管理 }: { 返回管理: () => void })` 作为同文件纯展示函数，不调用 hooks；它使用 `次级页外壳`、`返回栏`，正文“这条求职意向不存在或已不可编辑”和文字为“返回求职意向管理”的 `主按钮`。现有 `开意向草稿` effect 只留在 `意向编辑表单`，因此无效 URL 永远不会把 reducer 的空草稿当新建。不要改 reducer 的 Mock 行为。

- [ ] **Step 4: 运行测试确认 green 并提交**

```bash
npx vitest run src/屏幕/添加意向.test.tsx
git add src/屏幕/添加意向.tsx src/屏幕/添加意向.test.tsx
git commit -m "fix: reject invalid intention edit targets"
```

### Task 4: Backend 个人优势移除 Mock 重提取（P0 / S）

**Files:**
- Modify: `src/屏幕/引导问答.test.tsx`
- Modify: `src/屏幕/引导问答.tsx:18-45,100-104,229-230,1207-1243`
- Modify: `src/流程/候选Onboarding简历预填.test.ts`
- Modify: `src/流程/候选Onboarding简历预填.ts:367-375`

**Interfaces:**
- Produces: `取可恢复个人优势建议(state, stage): string | null`；`优势题` 新增 `恢复文案` 与 `恢复`；Backend 分支不再把 `个人优势文本` 作为恢复来源。
- Consumes: 真实 `取个人优势预填(...)` 结果与用户 textarea 输入。

- [ ] **Step 1: 写模式隔离失败测试**

```tsx
it('Backend ready summary 只恢复当前轮真实建议', async () => {
  render引导问答Backend({ 个人优势: '用户改写', summary建议: '当前轮真实建议' });
  expect(screen.queryByText(/9 年高并发交易系统/)).toBeNull();
  await 用户.click(screen.getByRole('button', { name: '恢复简历识别建议' }));
  expect(screen.getByRole('textbox', { name: '个人优势' })).toHaveValue('当前轮真实建议');
  expect(mock保存个人优势).not.toHaveBeenCalled();
});

it('Backend 无可用建议时无恢复动作，手工文本仍可保存', async () => {
  render引导问答Backend({ 个人优势: '', 候选预填阶段: 'manual' });
  expect(screen.queryByRole('button', { name: /恢复|重新从简历提取/ })).toBeNull();
  await 用户.type(screen.getByRole('textbox', { name: '个人优势' }), '用户本人填写');
  await 用户.click(screen.getByRole('button', { name: /下一步|完成/ }));
  expect(mock保存个人优势).toHaveBeenCalledWith('用户本人填写');
});
```

Mock 对照先编辑 textarea，再点击按钮，断言 textarea 恢复为 `个人优势文本`。

- [ ] **Step 2: 运行测试确认 red**

```bash
npx vitest run src/屏幕/引导问答.test.tsx
```

- [ ] **Step 3: 提供唯一的真实建议只读 helper**

在 `候选Onboarding简历预填.ts` 导出：

```ts
export function 取可恢复个人优势建议(state: 候选预填状态, stage: 向导段): string | null {
  if (stage !== '偏好段') return null;
  const 建议 = 可用建议(state, 'summary');
  if (建议 === null || state.eligibility?.summary !== true) return null;
  const 文本 = 建议.draft.summary.value?.trim();
  return 文本 ? 建议.draft.summary.value : null;
}
```

让 `取个人优势预填` 复用该 helper；补单测覆盖 ready/eligible/未确认/非空才返回，manual、loading、failed、confirmed、ineligible 和空建议均返回 `null`。

- [ ] **Step 4: 按模式给现有按钮注入恢复来源**

```tsx
const 预填状态 = 后端状态?.候选预填状态 ?? 创建空候选预填状态();
const 可恢复真实建议 = 取可恢复个人优势建议(预填状态, 段);
const 恢复文本 = 是后端 ? 可恢复真实建议 : 个人优势文本;

<优势题
  文本={自我介绍}
  设文本={设自我介绍}
  恢复文案={是后端 ? '恢复简历识别建议' : '重新从简历提取'}
  恢复={恢复文本 === null ? null : () => 设自我介绍(恢复文本)}
/>

function 优势题({ 文本, 设文本, 恢复文案, 恢复 }: {
  文本: string;
  设文本: (值: string) => void;
  恢复文案: string;
  恢复: (() => void) | null;
})

{恢复 ? (
  <div className={样式.优势工具行}>
    <button className={`${样式.优势工具主} 可点`} onClick={恢复}>
      ◈ {恢复文案}
    </button>
  </div>
) : null}
```

保留 `个人优势文本` import，但它只出现在 `是后端 ? 可恢复真实建议 : 个人优势文本` 的 Mock 分支。第一段的 `预填状态` 同时替换 `自我介绍` 初值里内联构造的预填状态；其余部分替换 `优势题` 的调用和参数签名。第二段 JSX 精确替换当前 `优势工具行` 区块。大标题、textarea、计数区不动。真实 prefill 初值仍由 `取个人优势预填` 提供；Backend 的恢复动作只更新页面 state，仍由“保存并继续”统一 mutation/confirm。

- [ ] **Step 5: 运行测试确认 green 并提交**

```bash
npx vitest run src/流程/候选Onboarding简历预填.test.ts src/屏幕/引导问答.test.tsx
git add src/流程/候选Onboarding简历预填.ts src/流程/候选Onboarding简历预填.test.ts src/屏幕/引导问答.tsx src/屏幕/引导问答.test.tsx
git commit -m "fix: isolate mock resume summary from backend"
```

### Task 5A: 保留空身份并只在 profile 真变化时拦写（P1 / M）

**Files:**
- Modify: `src/数据/类型.ts:453-469`
- Modify: `src/数据/后端映射.ts:39-40,79-92,170-183`
- Modify: `src/数据/后端映射.test.ts`
- Modify: `src/数据/招聘数据源/简历.ts:64-90`
- Modify: `src/数据/招聘数据源/简历.test.ts`
- Modify: `src/状态/初始状态.ts:254-287`
- Modify: `src/状态/后端/会话操作.ts:26-54`
- Modify: `src/状态/后端/会话操作.test.ts`
- Modify: `src/屏幕/基本信息.tsx:50-95,160-190`
- Modify: `src/屏幕/基本信息.test.tsx`
- Create: `src/屏幕/求职状态.test.tsx`
- Modify: `src/屏幕/求职状态.tsx:39-80`
- Modify: `src/屏幕/工作经历.test.tsx`
- Modify: `src/屏幕/我的简历.tsx:35-72,365-400`
- Modify: `src/屏幕/我的简历.test.tsx`

**Interfaces:**
- Produces: `export type 候选身份 = '' | '在校' | '在职' | '离职'`。
- Consumes: BFF read status `'' | student | employed | unemployed`；BFF `ProfileWrite.status` 仍只允许非空三态。
- Write boundary: `保存简历` 先比较页面 profile；profile 未变化时不调用会拒绝空身份的 mapper，技能/经历等独立分区仍可写。非学生在 `/basic` 且身份仍为 `''` 时只更新 Context 草稿；`/onboard/status` 得到明确选择后一次性保存 profile。

- [ ] **Step 1: 写映射和分区写入失败测试**

```ts
expect(从BFF简历(空Profile).基本信息.身份).toBe('');
expect(() => 转资料写入({ 真名: '沈', 开始工作年: '', 身份: '' }))
  .toThrow('请选择求职状态');
try {
  转资料写入({ 真名: '沈', 开始工作年: '', 身份: '' });
} catch (错误) {
  expect(错误).toMatchObject({ field: 'resume.profile.status' });
}
```

在 `招聘数据源/简历.test.ts` 增加三组：

1. previous/next 的 `基本信息.身份` 均为 `''` 且 profile 其余字段相同、只改技能：不抛错、不发 profile PATCH，只发 skills PATCH；
2. 身份仍为 `''` 但姓名变化：在任何 mutation 前抛 `客户端校验错误`；
3. previous status 为 `''`、next 身份为“离职”：发一次 profile PATCH，body status 为 `unemployed`。

- [ ] **Step 2: 写页面边界失败测试**

Backend 非学生、`身份:''` 在 `/basic` 修改姓名后点下一步：派发 `存简历` 保存页面草稿，`操作.保存简历` 零调用，导航到 `/onboard/status`，且不确认 `basic` 预填分区。Backend 学生 `身份:'在校'` 与已有 social 身份仍走既有 operation，成功后仍在本页确认 `basic`。

新建 `求职状态.test.tsx`：未选时点下一步不保存、不确认、不导航；选择“离职 · 随时到岗”写 `身份:'离职'`，选择“在职 · 考虑机会”写 `身份:'在职'`。从空身份进入时，只有保存成功后才确认 `basic`；保存失败不确认、不派发到岗、不导航。

在 `工作经历.test.tsx` 增加空身份但 profile 未变化的完整经历保存用例，断言页面仍把非 profile 修改交给 `操作.保存简历`，没有自行改成“在职”。在 `我的简历.test.tsx` 钉住空身份显示“未填写”且完整度包含“当前状态”。

- [ ] **Step 3: 运行测试确认 red**

```bash
npx vitest run src/数据/后端映射.test.ts src/数据/招聘数据源/简历.test.ts src/状态/后端/会话操作.test.ts src/屏幕/基本信息.test.tsx src/屏幕/求职状态.test.tsx src/屏幕/工作经历.test.tsx src/屏幕/我的简历.test.tsx
```

- [ ] **Step 4: 扩展页面身份类型和 Backend 空种子**

```ts
export type 候选身份 = '' | '在校' | '在职' | '离职';
export interface 基本信息 {
  真名: string;
  开始工作年: string;
  身份: 候选身份;
}
```

`转基本()` 对空 status 保持 `身份:''`。`转资料写入()` 开头加入：

```ts
if (基本.身份 === '') {
  throw new 客户端校验错误('resume.profile.status', '请选择求职状态');
}
```

`初始状态.ts` 的 Backend 种子和 `会话操作.ts` 的 `空简历快照` 都改为 `{ 真名:'', 开始工作年:'', 身份:'' }`；Mock 种子保持“在职”。

- [ ] **Step 5: 只在 profile 真变化时调用写 mapper**

将 `招聘数据源/简历.ts` 的 profile 分区改为先比较页面模型，再构造 body：

```ts
if (JSON.stringify(next.基本信息) !== JSON.stringify(旧页面.基本信息)) {
  const body = 转资料写入(next.基本信息);
  写入步骤们.push(() => 请求<BFF简历>({
    path: '/api/v1/me/resume/profile', method: 'PATCH', body,
    ifMatch: 修订etag(previous.profile_revision),
  }).then((r) => r.result));
}
```

profile 相同时完全不调用 `转资料写入`，所以空身份不会阻断 summary/skills/experiences/educations/certificates；profile 有变化时仍在构造第一个 mutation 前拒绝空身份。

- [ ] **Step 6: `/basic` 延迟空身份 profile，并在状态页收口**

`基本信息.tsx` 继续组装完整 `待存简历`。当 `数据源模式 === 'backend' && 基本.身份 === ''` 时，派发既有 `存简历`，不调用 `操作.保存简历`、不调用 `确认候选Onboarding预填分区('basic')`，随后跳转 `路径.求职状态`。其它身份和 Mock 仍调用既有 operation，成功后照旧确认。页面刷新导致这段未提交 profile 草稿丢失是本批明确非目标，不新增第二套 profile session cache。

`求职状态.tsx` 的 `当前` 改为 `string | null`，只取已有 `引导预填?.到岗 ?? null`。未选时 `轻提示('请选择当前求职状态')` 后 return。选择后算出非空 `新身份`：学生保持“在校”，社会人按选项前缀取“在职/离职”；调用 `操作.保存简历` 保存此前累积的 Context 草稿。若进入页面时身份为空，则保存成功后调用 `确认候选Onboarding预填分区('basic')`；随后才派发到岗并导航。失败时三者都不发生。

- [ ] **Step 7: 给空身份稳定展示**

在 `我的简历.tsx` 的 `状态文案` 增加 `'' : '未填写'`，完整度必填项把空身份计为“当前状态”未填写；不把空状态算成在职。`我的.tsx` 已以服务端 raw status 显示“未填写求职状态”，保持不变。

- [ ] **Step 8: 运行目标测试并提交**

```bash
npm run typecheck
npx vitest run src/数据/后端映射.test.ts src/数据/招聘数据源/简历.test.ts src/状态/后端/会话操作.test.ts src/屏幕/基本信息.test.tsx src/屏幕/求职状态.test.tsx src/屏幕/工作经历.test.tsx src/屏幕/我的简历.test.tsx
git add src/数据/类型.ts src/数据/后端映射.ts src/数据/后端映射.test.ts src/数据/招聘数据源/简历.ts src/数据/招聘数据源/简历.test.ts src/状态/初始状态.ts src/状态/后端/会话操作.ts src/状态/后端/会话操作.test.ts src/屏幕/基本信息.tsx src/屏幕/基本信息.test.tsx src/屏幕/求职状态.tsx src/屏幕/求职状态.test.tsx src/屏幕/工作经历.test.tsx src/屏幕/我的简历.tsx src/屏幕/我的简历.test.tsx
git commit -m "fix: preserve unset candidate status"
```

### Task 5B: 首屏默认与草稿缓存不再虚构候选选择（P1 / 首屏默认）

**Files:**
- Modify: `src/流程/onboarding配置.ts:217-242`
- Modify: `src/流程/onboarding配置.test.ts`
- Modify: `src/状态/领域/候选资料.ts:19-80,209-251`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `src/数据/资料缓存.ts:211-367`
- Modify: `src/数据/资料缓存.test.ts`
- Modify: `src/屏幕/学生分流.tsx:98-146,201-272,330-500`
- Modify: `src/屏幕/学生分流.test.tsx`
- Modify: `src/屏幕/引导问答.tsx:115-135`
- Modify: `src/屏幕/引导问答.test.tsx`
- Modify: `src/屏幕/求职状态.tsx:50-80`
- Modify: `src/屏幕/求职状态.test.tsx`

**Interfaces:**
- Produces: `空求职初筛偏好(): 求职初筛偏好`、`引导预填.在校选择?: boolean`。
- Changes: `存求职筛选偏好`、`存薪资预填`、`存到岗预填` 三个动作都携带当前 `城市们/职位/城市引用们/职位引用们`，reducer 不再有 `['上海']` fallback。

- [ ] **Step 1: 写 helper、reducer 和缓存失败测试**

```ts
expect(空求职初筛偏好()).toEqual({ 求职类型: [], 办公方式: [] });
```

分别从 `引导预填:null` 派发三类动作并传空城市/职位，断言结果城市仍为 `[]`；再传 Mock 当前城市 `['上海']`，断言结果保留 `['上海']`。缓存测试覆盖 `在校选择:true/false` round-trip、非 boolean 整条拒绝、旧 v1 记录无该键仍可读。

- [ ] **Step 2: 写首屏零默认与交互顺序失败测试**

Backend 空 profile + `引导预填:null`：在校/已毕业、四种求职类型和三种办公方式按钮的 `aria-pressed` 全为 false。先点“社招全职”或“全远程”、尚未点身份时，派发动作的 `城市们` 必须是 `[]`，状态与 sessionStorage 都不能出现“上海”。点下一步依次提示身份、求职类型、办公方式或城市/职位引用缺失，且不派发 `启程引导`。

Mock 对照：初始筛选与城市仍使用 `默认求职初筛偏好(...)` 和 `['上海']`；先点偏好再点身份不丢 Mock 城市。

- [ ] **Step 3: 运行测试确认 red**

```bash
npx vitest run src/流程/onboarding配置.test.ts src/状态/应用状态.test.ts src/数据/资料缓存.test.ts src/屏幕/学生分流.test.tsx src/屏幕/引导问答.test.tsx src/屏幕/求职状态.test.tsx
```

- [ ] **Step 4: 新增空偏好并让三个动作自带草稿基底**

```ts
export function 空求职初筛偏好(): 求职初筛偏好 {
  return { 求职类型: [], 办公方式: [] };
}

interface 引导草稿基底动作 {
  城市们: string[];
  职位: string[];
  城市引用们: 目录选择值[];
  职位引用们: 目录选择值[];
}

type 引导草稿动作 =
  | ({ 型: '存求职筛选偏好'; 偏好: 求职初筛偏好; 在校选择?: boolean } & 引导草稿基底动作)
  | ({ 型: '存薪资预填'; 下限: number; 上限: number; 单位: 求职薪资单位 } & 引导草稿基底动作)
  | ({ 型: '存到岗预填'; 到岗: string } & 引导草稿基底动作);
```

把 `引导草稿动作` 的三员并入现有 `候选资料动作` union。三个 reducer case 都用动作里的四项基底覆盖对应字段，再写自己的偏好/薪资/到岗；只有 `在校选择 !== undefined` 时写它。删除三处 `旧.引导预填 ?? { 城市们:['上海'], 职位:[] }`。修改三个调用点：学生分流传页面当前选择，向导传本地城市/职位和目录引用，求职状态传全局草稿值（缺席则各用空数组）。

- [ ] **Step 5: 严格缓存接受可选在校选择**

在 `候选资料状态['引导预填']`、`候选引导草稿快照` 和 `候选草稿根键们` 增加 `在校选择?: boolean`；decoder 只接受 boolean，encoder 仅在 defined 时复制。旧 v1 无此键仍兼容，不改缓存分类。

- [ ] **Step 6: 首屏改为三态身份与 Backend 空偏好**

```tsx
const 在校选择 = 全局.引导预填?.在校选择
  ?? (全局.基本信息.身份 === '在校' ? true
    : 全局.基本信息.身份 === '' ? null : false);
const 是学生 = 在校选择 === true;
const 筛选偏好 = 全局.引导预填?.筛选偏好
  ?? (是后端 ? 空求职初筛偏好() : 默认求职初筛偏好(是学生));
```

身份按钮的 `aria-pressed` 分别用 `在校选择 === true/false`；重复点击守卫用 `在校选择 === 选了是`。选择“在校”写身份“在校”，选择“已毕业”若旧值为“在校”则写空身份，否则保留已有值。随后派发 `存求职筛选偏好`，携带 `在校选择`、当前四项草稿基底和模式专属偏好：Backend 空偏好，Mock 原默认。

删除毕业时间 mount effect；只有弹层“完成”才写值。移除 `主按钮` 的 `禁用` 表达式，让 `下一步()` 依次检查身份、偏好、Backend 城市/职位引用并用 `轻提示` 给出原因；任一失败均不派发 `启程引导`。

- [ ] **Step 7: 运行目标测试并提交**

```bash
npm run typecheck
npx vitest run src/流程/onboarding配置.test.ts src/状态/应用状态.test.ts src/数据/资料缓存.test.ts src/屏幕/学生分流.test.tsx src/屏幕/引导问答.test.tsx src/屏幕/求职状态.test.tsx
git add src/流程/onboarding配置.ts src/流程/onboarding配置.test.ts src/状态/领域/候选资料.ts src/状态/应用状态.test.ts src/数据/资料缓存.ts src/数据/资料缓存.test.ts src/屏幕/学生分流.tsx src/屏幕/学生分流.test.tsx src/屏幕/引导问答.tsx src/屏幕/引导问答.test.tsx src/屏幕/求职状态.tsx src/屏幕/求职状态.test.tsx
git commit -m "fix: remove candidate onboarding defaults"
```

### Task 6: 空生日不保存显示落点（P1 / L）

**Files:**
- Modify: `src/屏幕/基本信息.test.tsx`
- Modify: `src/屏幕/基本信息.tsx:48-59,126-143,161-185`

**Interfaces:**
- Produces: `出生年月已确认: boolean`；Backend 保存草稿只在确认时含完整出生年月，Mock 保持原型默认。
- Consumes: 已有 profile `出生年/出生月` 或真实 `基本预填` 建议。

- [ ] **Step 1: 写未确认、已有值、真实建议三组测试**

```tsx
it('空生日直接下一步不写 1998-06', async () => {
  render基本信息({ mode: 'backend', 基本信息: { 身份: '在职', 出生年: undefined, 出生月: undefined } });
  await 用户.click(screen.getByRole('button', { name: '下一步' }));
  expect(mock保存简历).toHaveBeenCalledWith(expect.objectContaining({
    基本信息: expect.not.objectContaining({ 出生年: '1998', 出生月: '6' }),
  }));
});
```

增加四个对照：已有完整 `2000/9` 与完整真实预填建议均保存对应双值；只有单边已有/单边建议时保存体不含两项；Mock 空资料仍保存既有 `1998/6` 演示默认；Backend 用户滚动任一轮后保存当前双值。

- [ ] **Step 2: 运行测试确认 red**

```bash
npx vitest run src/屏幕/基本信息.test.tsx
```

- [ ] **Step 3: 分离滚轮显示值与确认态**

```tsx
const 有已有生日 = 基本.出生年 !== undefined && 基本.出生月 !== undefined;
const 有建议生日 = 基本预填.出生年 !== undefined && 基本预填.出生月 !== undefined;
const [出生年月已确认, 设出生年月已确认] = useState(!是后端 || 有已有生日 || 有建议生日);
```

从 `use应用状态()` 取得现有 `数据源模式` 并定义 `是后端`。两个滚轮 setter 均包装成“更新本轮值 + `设出生年月已确认(true)`”；任一滚轮交互代表用户确认屏上显示的完整年月。保存前先移除可能存在的半边旧值，再按确认态成对加入：

```tsx
const 待存基本: 基本信息类型 = { ...基本 };
delete 待存基本.出生年;
delete 待存基本.出生月;
if (出生年月已确认) {
  待存基本.出生年 = String(出生年);
  待存基本.出生月 = String(出生月);
}
```

将当前 `操作.保存简历` 或 Task 5A 的本地 `存简历` payload 中 `基本信息` 替换为 `待存基本`；个人优势、技能、经历、教育、证书仍传当前全局切片。不要因为 1998/6 仍是滚轮视觉落点就把它写入。

- [ ] **Step 4: 运行测试确认 green 并提交**

```bash
npx vitest run src/屏幕/基本信息.test.tsx
git add src/屏幕/基本信息.tsx src/屏幕/基本信息.test.tsx
git commit -m "fix: preserve an unset candidate birthday"
```

### Task 7: 学历与就读时间必须显式确认（P1 / N、R）

**Files:**
- Modify: `src/屏幕/最高学历.test.tsx`
- Modify: `src/屏幕/最高学历.tsx:25-62`
- Modify: `src/屏幕/就读时间段.test.tsx`
- Modify: `src/屏幕/就读时间段.tsx:26-81`
- Modify: `src/流程/候选Onboarding简历预填.test.ts:336-383`
- Modify: `src/流程/候选Onboarding简历预填.ts:177-211`

**Interfaces:**
- Produces: `当前: string | null`；`取就读年份预填(...): { start: number | null; end: number | null }`；`入学年已确认/毕业年已确认`。
- Consumes: 既有教育段或真实候选预填建议。

- [ ] **Step 1: 写空学历失败测试**

Backend 无教育、无建议时所有学历按钮 `aria-pressed=false`；点下一步显示“请选择最高学历/在读学历”，`操作.保存简历` 与导航均零调用。已有教育或真实建议仍预选并可保存。Mock 空教育仍保留“本科/本科在读”演示默认。

- [ ] **Step 2: 写空就读时间失败测试**

Backend 教育段的 `开始/结束` 为空且无建议时，直接下一步显示“请选择入学时间和毕业时间”，零保存；只有一侧已有或建议时仍不保存；已有完整年月原样保存；用户操作缺失轮后保存 `${year}-09` / `${year}-06`。Mock 空时间保持 2021/2025 演示默认。

- [ ] **Step 3: 运行测试确认 red**

```bash
npx vitest run src/屏幕/最高学历.test.tsx src/屏幕/就读时间段.test.tsx
```

- [ ] **Step 4: 学历使用 nullable selection**

```tsx
const [当前, 设当前] = useState<string | null>(() => {
  const 既有 = 在校中
    ? (全局.基本信息.在读学历 && 在读选项.includes(全局.基本信息.在读学历)
      ? 全局.基本信息.在读学历 : null)
    : (首段 && 学历选项.includes(首段.学历) ? 首段.学历 : null);
  const 建议 = 取最高学历预填(预填状态, 在校中, 既有 ?? '');
  return 建议 ?? 既有 ?? (是后端 ? null : (在校中 ? '本科在读' : '本科'));
});
```

从 Context 取得 `数据源模式` 并定义 `是后端`、`预填状态`。`下一步` 首行拒绝 `当前 === null`，文案按身份选择“请选择在读学历”或“请选择最高学历”；只有选择后才计算 `落档学历` 和 `新教育`，不得在校验前生成 `edu${Date.now()}`。

- [ ] **Step 5: 让年份 helper 返回真实缺失状态**

将 `取就读年份预填` 的 `currentStart/currentEnd` 改为 `number | null`，返回值也改为 nullable。结果初始为传入的已有值；只有 eligible、未确认的真实建议命中 `2000..2030` 时覆盖对应一侧。缺失、越界、ineligible、confirmed 不补常量。修正 helper 测试：原来期望回落 `2021/2025` 的用例改为 `null`；完整建议、单边建议和学生 `graduation_year` 合法回退分别钉死。

- [ ] **Step 6: 就读时间使用显示值 + 确认态**

把屏幕 `取年` 改为返回 `number | null`，不再收兜底值：

```tsx
function 取年(值: string | undefined): number | null {
  const 年 = Number((值 ?? '').slice(0, 4));
  return 年档.includes(年) ? 年 : null;
}

const 年份初始 = 取就读年份预填(预填状态, 取年(首段?.开始), 取年(首段?.结束), 在校中);
const [入学年, 设入学年] = useState(年份初始.start ?? 2021);
const [毕业年, 设毕业年] = useState(年份初始.end ?? 2025);
const [入学年已确认, 设入学年已确认] = useState(!是后端 || 年份初始.start !== null);
const [毕业年已确认, 设毕业年已确认] = useState(!是后端 || 年份初始.end !== null);
```

给两个滚轮传包装 setter，各自更新值并置对应确认态。`下一步` 在任何拼接和 mutation 前检查两项确认态；缺失时 `轻提示('请选择入学时间和毕业时间')` 并 return。只有两者确认且 `校验起止年月` 通过才调用 `保存简历`；学生的 `毕业年` 也只在此时写入。

- [ ] **Step 7: 运行测试确认 green 并提交**

```bash
npx vitest run src/流程/候选Onboarding简历预填.test.ts src/屏幕/最高学历.test.tsx src/屏幕/就读时间段.test.tsx
git add src/流程/候选Onboarding简历预填.ts src/流程/候选Onboarding简历预填.test.ts src/屏幕/最高学历.tsx src/屏幕/最高学历.test.tsx src/屏幕/就读时间段.tsx src/屏幕/就读时间段.test.tsx
git commit -m "fix: require explicit education facts"
```

### Task 8: 匿名候选详情使用完整 canonical 坐标（P1 / J）

**Files:**
- Modify: `src/路由/路径表.ts:136-143`
- Modify: `src/应用.tsx:119-132,430-442`
- Modify: `src/屏幕/候选推荐.tsx:470-500`
- Modify: `src/屏幕/候选推荐.test.tsx`
- Modify: `src/屏幕/匿名在线简历.test.tsx`
- Modify: `src/屏幕/匿名在线简历.tsx:321-423`
- Modify: `src/应用.test.tsx`
- Modify: `e2e/数据源模式.spec.ts:7068,7234`

**Interfaces:**
- Produces: 保留 Mock 的 `路径.匿名在线简历(id)` → `/hr/resume/{id}`；新增 `路径.后端匿名在线简历(jobId, recommendationId)` → `/hr/jobs/{job}/recommendations/{recommendation}` 及模板 `/hr/jobs/:jobId/recommendations/:recommendationId`。
- Consumes: existing operations `读取招聘候选详情(jobId, recommendationId, force?)`、`设置候选收藏(jobId, recommendationId, favorite)`、`委托招聘候选(jobId, recommendationId)`。

- [ ] **Step 1: 写 builder 与卡片导航失败测试**

```ts
expect(路径.后端匿名在线简历('job/a', 'rec/b'))
  .toBe('/hr/jobs/job%2Fa/recommendations/rec%2Fb');
```

候选推荐页 Backend 点击卡片应导航 `路径.后端匿名在线简历(活跃岗位, 视图.recommendationId)`；Mock 点击仍导航 `路径.匿名在线简历(人.编号)`。

- [ ] **Step 2: 写刷新与跨岗位失败测试**

以 Backend URL `/hr/jobs/job_a/recommendations/rec_1` 渲染详情，同时把 `状态.当前岗位编号` 故意设成 `job_b`；断言读取、收藏和委托都使用 `job_a, rec_1`。随机 recommendation 显示不可用；Backend 旧 `/hr/resume/rec_1` 显示“链接已失效，请从对应岗位推荐列表重新打开”且不请求 API。另用 Mock 渲染旧 `/hr/resume/A-01`，断言原型详情仍可用。同步修改 `e2e/数据源模式.spec.ts` 两条 `@backend`：列表点卡后的 URL 期望改为 canonical 双坐标；旧 URL 直达用例改断言失效提示和零详情 GET。

- [ ] **Step 3: 运行测试确认 red**

```bash
npx vitest run src/屏幕/匿名在线简历.test.tsx src/屏幕/候选推荐.test.tsx src/应用.test.tsx
```

- [ ] **Step 4: 修改 builder、模板和唯一调用点**

```ts
后端匿名在线简历: (jobId: string, recommendationId: string) =>
  `/hr/jobs/${encodeURIComponent(jobId)}/recommendations/${encodeURIComponent(recommendationId)}`,
后端匿名在线简历模板: '/hr/jobs/:jobId/recommendations/:recommendationId',
```

保留既有 `匿名在线简历` builder/template。把新模板加入 `应用.tsx` 的招聘路由模式，并为旧、新两个模板都注册 `<匿名在线简历 />`；模式分流留在页面，不能让应用 wildcard 把 Mock 旧路由吃掉。

- [ ] **Step 5: 页面所有 scope 只读 URL params**

```tsx
const { id: Mock编号, jobId, recommendationId } =
  useParams<{ id?: string; jobId?: string; recommendationId?: string }>();
const 岗位编号 = 是后端 ? (jobId ?? '') : 状态.当前岗位编号;
const 推荐编号 = 是后端 ? (recommendationId ?? '') : (Mock编号 ?? '');
```

页面顶层先读取 `数据源模式`。Backend 且 `jobId/recommendationId` 任一缺失时直接渲染旧链接失效页，不挂载 `Backend匿名简历`，因此 effect、scope 和 action 均零调用。有效 Backend 把完整 pair 作为 props 传给 keyed 子组件；子组件的 effect、重试、收藏、委托和 `P4范围键.招聘详情` 全部只用 props。Mock 分支继续按 `Mock编号` 使用原 fixture；`状态.当前岗位编号` 只能服务列表/Mock 原型，不能再进入 Backend 详情资源坐标。

- [ ] **Step 6: 运行测试确认 green 并提交**

```bash
npx vitest run src/屏幕/匿名在线简历.test.tsx src/屏幕/候选推荐.test.tsx src/应用.test.tsx
npx playwright test --config=playwright.数据源模式.config.ts e2e/数据源模式.spec.ts --grep "招聘端列表与详情渲染匿名别名|招聘端简历详情 404"
git add src/路由/路径表.ts src/应用.tsx src/应用.test.tsx src/屏幕/候选推荐.tsx src/屏幕/候选推荐.test.tsx src/屏幕/匿名在线简历.tsx src/屏幕/匿名在线简历.test.tsx e2e/数据源模式.spec.ts
git commit -m "fix: make recommendation links carry job scope"
```

### Task 9: 整批验证与污染扫描

**Files:**
- Test: 本计划列出的全部测试文件

**Interfaces:**
- Consumes: Task 1–8 的提交。
- Produces: 可复核的测试、类型、lint 与静态污染扫描证据。

- [ ] **Step 1: 运行定向测试**

```bash
npx vitest run \
  src/屏幕/岗位详情.test.tsx \
  src/屏幕/发布岗位.test.tsx \
  src/屏幕/添加意向.test.tsx \
  src/屏幕/引导问答.test.tsx \
  src/屏幕/基本信息.test.tsx \
  src/屏幕/求职状态.test.tsx \
  src/屏幕/最高学历.test.tsx \
  src/屏幕/就读时间段.test.tsx \
  src/屏幕/学生分流.test.tsx \
  src/屏幕/候选推荐.test.tsx \
  src/屏幕/匿名在线简历.test.tsx \
  src/数据/后端映射.test.ts \
  src/数据/招聘数据源/简历.test.ts \
  src/数据/资料缓存.test.ts \
  src/流程/候选Onboarding简历预填.test.ts \
  src/流程/onboarding配置.test.ts \
  src/状态/后端/会话操作.test.ts \
  src/状态/应用状态.test.ts \
  src/屏幕/我的简历.test.tsx \
  src/应用.test.tsx
```

- [ ] **Step 2: 运行静态门**

```bash
npm run typecheck
npm run lint
git diff --check
```

- [ ] **Step 3: 运行完整单元测试**

```bash
npm test -- --run
```

- [ ] **Step 4: 运行数据源模式 E2E**

```bash
npm run test:e2e:data-source
```

- [ ] **Step 5: 扫描已禁止模式**

```bash
rg -n "find\(.*路由岗位编号.*\).*\?\?.*岗位列表\[0\]|资料\.status === '' \? '在职'|设文本\(个人优势文本\)|路径\.匿名在线简历\(视图\.recommendationId\)" src --glob '!*.test.*'
```

Expected: 零命中。随后人工确认旧 `/hr/resume/:id` 只服务 Mock 或 Backend 失效提示，`默认求职初筛偏好` 的生产调用只位于 Mock 分支。

- [ ] **Step 6: 记录结果并修复归属明确的回归**

如果完整 suite 暴露由本批类型扩展造成的真实回归，回到引入该行为的 Task，修正该 Task 已列明的生产文件或测试并重跑失败 suite；不得删除断言、放宽 strict decoder 或顺手修改本计划外功能。每一修正追加到对应 Task 的提交，不另建范围不明的“测试修正”提交。

## TEST_DELTA

```yaml
test_delta:
  unique_risk: 无效 URL 会操作另一真实岗位或创建新岗位/意向；空表单会持久化用户未选择的身份、生日、学历、年份和偏好；匿名推荐刷新后会使用错误岗位 scope。
  layer_rationale: 风险发生在 React 路由、组件 state 生命周期和 payload 组装边界；Vitest + Testing Library 是能直接证明 DOM 隔离与零 mutation 的最低成本层。
  impact_keys: []
  fixture_key: none
  resource_class: none
  expected_duration_delta_seconds: 10，预计不越过单 suite 60 秒目标。
  authoritative_suite: 各页面现有 Vitest 文件；新增 src/屏幕/求职状态.test.tsx 只拥有求职状态显式选择责任。
  duplicate_coverage: src/应用.test.tsx 只拥有 route registration；各页面测试拥有资源和写入边界，二者不重复。
  timing_receipts: []
```

## 非目标与重新评估条件

- 不修 A1、C3b、C3c、C7、D5、D6、E3、H、I、K、O、P、Q、S1、T；它们留在原 handoff。
- 不实现候选 onboarding completion state、contact-profile、本地数据导出或企业认证。
- 不迁移全部页面到通用 resource boundary。只有第二个编辑器出现相同 keyed 生命周期缺陷，才评估抽取通用 helper。
- 不为旧 `/hr/resume/:id` 猜 job ID。只有后端未来提供 recommendation→job 的无歧义 owner lookup，才评估兼容跳转。
