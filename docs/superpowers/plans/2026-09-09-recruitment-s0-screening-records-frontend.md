# S0 匿名初筛 Agent 问答与总结前端接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让候选与招聘双端的 MatchCase 详情通过冻结展开合同读取并展示真实 S0 Agent Q/A，同时只向候选展示初评与逐轮复评，并保持现有轮询、历史回看、人工动作和 Mock 行为不变。

**Architecture:** 在现有 `读取P5详情` 上固定追加一次 `include=screening_records`，由 MatchCase data source 对 S0 新块做闭合字段与跨记录语义校验。解码结果进入现有 role＋subject＋case 权威详情快照，展示 mapper 独立投影 Agent 消息与候选总结，页面将其适配为共享 `阶段对话流` 的现有左右气泡和小结托盘；不增加第二请求、独立消息 store、跨 API 拼接或新 UI 基础设施。

**Tech Stack:** TypeScript、React 19、Vitest、Testing Library、Vite、现有 BFF HTTP client 与 P5 状态操作层、agent-browser dogfood。

**Spec:** `docs/superpowers/specs/2026-09-09-recruitment-s0-screening-records-frontend-design.md`，用户批准版本 commit `f339828595215f398e058bcf5f5a38b180b0f3a8`，blob `e47632f74f0c6123f40cfb1f696c6c2d5a7e4ca1`。

## Global Constraints

- 前端实施起点以 `origin/main` 的 `1b6543468a0b08b7d16b7b3da117b597a7da24b4` 为冻结基线；执行前记录实际 HEAD 并对相关文件做差异核对。
- 后端合同以 `origin/release/0.2.5` 的 `462367b6571d1bbfc4bb29621a4ea1c741dba762` 和合同名 `s0-screening-records.v1` 为准；合同名不是 wire version 字段。
- 浏览器只能请求 `/api/v1/me/match-cases/{case_id}?include=screening_records` 或 `/api/v1/recruiter/match-cases/{case_id}?include=screening_records`；include 精确一次，case ID 继续 URL 编码，GET 继续 `不缓存: true`。
- 展开详情的 S0 必须显式有 `{messages:[], summaries:[]}`；missing、null、错误阶段带块及招聘非空 summaries 全部 fail closed，不能降级成空态或无 include 重试。
- 新记录 `occurred_at` 必须是以大写 `Z` 结尾的 RFC3339 UTC；正文原样保存，不 trim、截断、翻译、改写或执行 HTML。
- Q/A 可见内容只有正文或未回答状态，加用户本地时区两位 24 小时制 `HH:mm`；不显示 kind、role、round、ID 或技术标题。
- 未回答文案固定为 `declined → 已拒绝回答`、`unknown → 暂无法确认`、`not_available → 暂无可用信息`。
- 候选总结标签固定为 `初评` 与 `第 N 轮复评`，全部历史都展示且不显示总结时间；招聘方不显示总结区域或占位。
- S0 passed 保持现有 `已通过`；只有 S0 终局 outcome 为 `policy_rejected` 或 `semantic_not_fit` 时阶段结果显示 `不匹配`，`user_ended`／`party_account_deleted` 仍显示中性的 `已结束`。
- 新记录只用于展示，不参与状态、动作、`respond_fact`、附件、协调或意向确认判定；screening record ID 永不作为 mutation 坐标。
- 不修改 CSS、Mock 数据／文案／状态机，不跨其它 API 拼固定检查项，不增加请求框架、轮询系统、缓存模式、独立存储或通用 include 注册器。
- 实施复用当前 Paseo 工作区 `/Users/visionclaw/.paseo/worktrees/09eyc7i7/military-jaguar`，不新建第二工作区，不 stash/reset/clean 用户内容。

## 前置条件、文件边界与停止条件

执行前完整阅读 `CLAUDE.md`、`AGENTS.md`、批准 Spec 和本 Plan，并运行：

```bash
git status --short
git rev-parse HEAD
git merge-base HEAD origin/main
```

若相关文件已有未说明改动，保留用户改动并先核对冲突，不能覆盖。核对后端权威 fixture `apps/recruitment-bff/internal/recruitmentclient/testdata/s0_screening_records.json` 的 release 版本；若冻结字段、角色或顺序已变化，停止实施并回到 Spec 评审，不能自行兼容新合同。

预计生产文件：

```text
src/数据/BFF契约.ts
src/数据/类型.ts
src/数据/招聘数据源/MatchCase.ts
src/数据/MatchCase展示映射.ts
src/组件/阶段对话流.tsx
src/屏幕/P5/MatchCase详情.tsx
```

预计测试与证据文件：

```text
src/测试/BFF样本.ts
src/测试/S0筛选记录样本.ts
src/数据/招聘数据源/MatchCase.test.ts
src/状态/后端/MatchCase操作.test.ts
src/数据/MatchCase展示映射.test.ts
src/组件/阶段对话流.test.tsx
src/屏幕/P5/MatchCase详情.test.tsx
docs/superpowers/handoffs/2026-09-09-recruitment-s0-screening-records-frontend.md
dogfood-output/$DOGFOOD_RUN_ID/report.md
dogfood-output/$DOGFOOD_RUN_ID/screenshots/
```

`dogfood-output/` 已被 gitignore，只保留本地原始证据；仓库内 handoff 只写脱敏摘要和相对证据路径。`MatchCase操作.ts` 只允许增加本 Plan 冻结的详情 404 隐私清理；若实现必须新增 CSS、建立额外请求、独立 store 或其它状态机制，先停止并证明现有整包替换／栅栏为何不能满足批准 Spec，再请求重新评审。

## 冻结公共类型与数据流

`src/数据/BFF契约.ts` 的 wire 测试类型增加：

```ts
export type BFFS0筛选消息 =
  | { id: string; kind: 'question'; role: 'candidate'; round: number; text: string; occurred_at: string }
  | { id: string; kind: 'answer'; role: 'recruiter'; round: number; text: string; answer_status: 'answered'; occurred_at: string }
  | { id: string; kind: 'answer'; role: 'recruiter'; round: number; answer_status: 'declined' | 'unknown' | 'not_available'; occurred_at: string };

export type BFFS0筛选总结 =
  | { id: string; phase: 'initial'; summary: string; occurred_at: string }
  | { id: string; phase: 'reevaluation'; round: number; summary: string; occurred_at: string };

export interface BFFS0筛选记录 {
  messages: BFFS0筛选消息[];
  summaries: BFFS0筛选总结[];
}
```

`BFFMatchCase阶段区` 增加 optional `screening_records?: BFFS0筛选记录`，因为该 wire interface 同时描述默认与展开响应；是否必须存在由带 include 的 data-source decoder 判定。

`src/数据/招聘数据源/MatchCase.ts` 导出：

```ts
export type P5S0筛选消息 =
  | { id: string; kind: 'question'; role: 'candidate'; round: number; text: string; occurredAt: string }
  | { id: string; kind: 'answer'; role: 'recruiter'; round: number; text: string; answerStatus: 'answered'; occurredAt: string }
  | { id: string; kind: 'answer'; role: 'recruiter'; round: number; answerStatus: 'declined' | 'unknown' | 'not_available'; occurredAt: string };

export type P5S0筛选总结 =
  | { id: string; phase: 'initial'; summary: string; occurredAt: string }
  | { id: string; phase: 'reevaluation'; round: number; summary: string; occurredAt: string };

export interface P5S0筛选记录 {
  messages: P5S0筛选消息[];
  summaries: P5S0筛选总结[];
}
```

`P5阶段区` 增加必需属性 `screeningRecords: P5S0筛选记录 | null`：S0 解码后恒为对象，S1–S3 恒为 `null`，不能用 optional 隐藏展开响应缺块。

`src/数据/MatchCase展示映射.ts` 增加：

```ts
export interface P5S0消息视图 {
  id: string;
  kind: 'question' | 'answer';
  role: P5角色;
  round: number;
  answerStatus: 'answered' | 'declined' | 'unknown' | 'not_available' | null;
  occurredAt: string;
  内容: string;
}

export interface P5S0总结视图 {
  id: string;
  phase: 'initial' | 'reevaluation';
  round: number | null;
  occurredAt: string;
  标签: string;
  内容: string;
}
```

`P5阶段区块视图` 增加 `Agent消息: readonly P5S0消息视图[]` 与 `Agent总结: readonly P5S0总结视图[]`。旧 `摘要`、`清单`、`时间线`、`叮嘱` 和 `附件` 保持原字段与语义。

---

### Task 1: 接入展开请求与严格解码，并证明权威快照整包运输

**Files:**
- Create: `src/测试/S0筛选记录样本.ts`
- Modify: `src/数据/BFF契约.ts:770-815`
- Modify: `src/测试/BFF样本.ts:486-590`
- Modify: `src/数据/招聘数据源/MatchCase.ts:20-155, 220-285, 420-495, 576-610, 805-812`
- Modify: `src/状态/后端/MatchCase操作.ts:130-150, 590-625, 789-825`
- Test: `src/数据/招聘数据源/MatchCase.test.ts:230-330, 555-575`
- Test: `src/状态/后端/MatchCase操作.test.ts:445-500, 700-765`

**Interfaces:**
- Consumes: `P5状态视图.roundBudget`、现有闭合 guards、`P5路径` 和后端 release fixture。
- Produces: 上述 normalized DTO、`P5阶段区.screeningRecords`；`读取P5详情(role, caseId)` 签名不变，但始终请求展开详情。

- [ ] **Step 1: 建立与后端样例语义一致的共享测试记录**

在 `src/测试/S0筛选记录样本.ts` 写明来源路径与 SHA，并导出 exact 新块：

```ts
import type { BFFS0筛选记录 } from '../数据/BFF契约';

// Source: agxp-monorepo@462367b6571d1bbfc4bb29621a4ea1c741dba762
// apps/recruitment-bff/internal/recruitmentclient/testdata/s0_screening_records.json
export const S0候选完整记录Wire: BFFS0筛选记录 = {
  messages: [
    { id: 's0q_1', kind: 'question', role: 'candidate', round: 1,
      text: '这个岗位是否需要固定晚班？', occurred_at: '2026-08-23T10:01:00Z' },
    { id: 's0a_1', kind: 'answer', role: 'recruiter', round: 1,
      text: '没有固定晚班。', answer_status: 'answered', occurred_at: '2026-08-23T10:02:00Z' },
  ],
  summaries: [
    { id: 's0s_0', phase: 'initial', summary: '需要确认岗位的值班安排。',
      occurred_at: '2026-08-23T10:00:30Z' },
    { id: 's0s_1', phase: 'reevaluation', round: 1,
      summary: '已确认没有固定晚班，仍需了解其它工作安排。', occurred_at: '2026-08-23T10:03:00Z' },
  ],
};

export const S0招聘完整记录Wire: BFFS0筛选记录 = {
  messages: S0候选完整记录Wire.messages.map((item) => ({ ...item })),
  summaries: [],
};

export const S0仅问题记录Wire: BFFS0筛选记录 = {
  messages: [S0候选完整记录Wire.messages[0]!],
  summaries: [],
};

export const S0未知回答记录Wire: BFFS0筛选记录 = {
  messages: [
    S0候选完整记录Wire.messages[0]!,
    { id: 's0a_1', kind: 'answer', role: 'recruiter', round: 1,
      answer_status: 'unknown', occurred_at: '2026-08-23T10:02:00Z' },
  ],
  summaries: S0候选完整记录Wire.summaries.map((item) => ({ ...item })),
};
```

在 `src/测试/BFF样本.ts` 给 `P5阶段区组Wire` 的 S0 加 `screening_records: { messages: [], summaries: [] }`，其它三段不加。通用 wire 属性保持 optional，生产 decoder 不得 optional。

- [ ] **Step 2: 先写 data-source 正例与请求测试**

在 `MatchCase.test.ts` 增加 helper，以对象展开把共享块放进唯一 S0，并把 state `round` 设为 1。核心断言：

```ts
it('候选完整记录与招聘空总结按角色严格解码', () => {
  const 候选 = 解P5详情(带S0记录(P5候选详情Wire, S0候选完整记录Wire), 'candidate');
  const 招聘 = 解P5详情(带S0记录(P5招聘详情Wire, S0招聘完整记录Wire), 'recruiter');
  expect(候选.stages[0].screeningRecords?.messages).toEqual([
    { id: 's0q_1', kind: 'question', role: 'candidate', round: 1,
      text: '这个岗位是否需要固定晚班？', occurredAt: '2026-08-23T10:01:00Z' },
    { id: 's0a_1', kind: 'answer', role: 'recruiter', round: 1,
      text: '没有固定晚班。', answerStatus: 'answered', occurredAt: '2026-08-23T10:02:00Z' },
  ]);
  expect(招聘.stages[0].screeningRecords?.summaries).toEqual([]);
});

it('详情路径编码 case ID 且 include 精确一次并保持 no-store', async () => {
  请求Mock.mockResolvedValueOnce(响应(P5候选详情Wire));
  await source.读取P5详情('candidate', 'mc/一?');
  expect(请求Mock).toHaveBeenCalledWith({
    path: '/api/v1/me/match-cases/mc%2F%E4%B8%80%3F?include=screening_records',
    不缓存: true,
  });
});
```

再覆盖 only-question、unknown、空 messages＋initial、两数组空、轮次 1→3 空档。`declined` 与 `not_available` 只从 unknown fixture 替换 `answer_status`，不添加 text。候选与招聘解码后的 messages 必须 `toEqual`，现有双角色请求测试必须同时断言 recruiter 路径也只有一个 include。

Run: `npm test -- src/数据/招聘数据源/MatchCase.test.ts`

Expected: FAIL；当前阶段 decoder 拒绝 `screening_records`，请求也没有 include。

- [ ] **Step 3: 写完合同负例**

用小 helper 对合法块做单点破坏并断言 `toThrow(契约漂移)`：

```text
S0 块缺失/null，messages 或 summaries 为 null；S1/S2/S3 错带块
message/summary 缺键、未知键、空或重复 ID（跨两数组也算）
question 错 role 或带 answer_status；answered 缺 text；未回答携带 text/text:null
text/summary 空白或有首尾空白；initial 携带 round；reevaluation 缺 round
round 为 0、超过预算、数字字符串或小数；同轮重复；孤立 answer
messages 倒序或 answer 在同轮 question 前；summaries initial/reevaluation 顺序或轮次倒序
occurred_at 使用小写 z、时区偏移、缺 Z 或无效日期；recruiter 非空 summaries
```

断言失败输入未被 trim 或修改。旧 transcript、旧 summary、checklist 与动作合同测试全部保留。

- [ ] **Step 4: 实现最小 strict decoder 和唯一 include**

增加专用闭词表、`要求S0原文` 和以下 Z-only 校验；不要收紧既有时间 helper：

```ts
const RFC3339UTCZ模式 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
```

`要求S0原文` 同时检查 string、非空和 `value.trim() === value`，返回原字符串。按 `kind`／`phase` 选择 exact keys 后归一化，再按以下算法验证整个块：

1. 一个 ID Set 覆盖 messages＋summaries；重复即抛。
2. messages 顺序扫描：round 必须 `1..roundBudget` 且不下降；同轮 question／answer 各最多一条；question 先登记，answer 必须命中同轮已登记 question。
3. summaries 顺序扫描：initial 最多一条且先于所有 reevaluation；reevaluation round 必须在预算内并严格递增；不要求有对应公开 Q/A。
4. 原数组顺序返回，不 sort、不重编号。

`解P5阶段区(input, viewer, roundBudget)` 的 exact keys 允许 `screening_records`，但 S0 必须存在并解成对象，S1–S3 必须缺席并归一为 null；recruiter summaries 非空立即抛。`解P5详情` 先解 state，再传 `state.roundBudget`。

请求 path 精确改为：

```ts
path: P5路径(role, `/match-cases/${encodeURIComponent(caseId)}?include=screening_records`),
```

签名、认证和 `不缓存: true` 不变，不加 retry。

- [ ] **Step 5: 跑合同测试并修正必需属性的测试工厂**

Run: `npm test -- src/数据/招聘数据源/MatchCase.test.ts`

Expected: PASS。

Run: `npm run typecheck`

若只因 normalized `P5阶段区` 测试工厂缺 `screeningRecords` 失败，在 `MatchCase展示映射.test.ts` 与 `MatchCase详情.test.tsx` 补 `S0 → {messages:[], summaries:[]}`、其它段 → `null`；不得把生产属性改成 optional。重跑 typecheck，Expected: PASS。

- [ ] **Step 6: 增加权威快照替换与隐私栅栏回归**

在 `MatchCase操作.test.ts` 构造相同 `state.updatedAt`／round 的“仅 question”与“question＋answer”详情，断言两次 force read 后 detail 引用与 messages 整包替换为后者。扩展现有 mutation 重读、刷新失败、迟到响应、换 subject／role 与 401 测试，证明旧 records 只可在同 scope 的网络／500／503 刷新失败时只读保留，不能跨主体存在。

详情 404 是隐私清理例外：先成功读入含 records 的详情，再让 force read 返回 `new BFF错误(404, 'case_not_found', ...)`，必须得到 `detail:null` 与可重试 error；不能继续显示旧 records。Mutation 成功后的权威重读若返回同一 404，也必须清掉旧 detail，且 mutation 仍 resolve。实现一个局部 `是详情404` 守卫，在 `读取详情` 和 `权威重读详情` 的现有 401 分支之后，用 `失败详情(undefined, 错误, generation)` 写入无旧 detail 的失败快照。其它非 401／404 同 scope 刷新继续保留旧只读详情。

现有 `成功详情(detail, generation)` 已负责整包替换；除此处 404 分支外不修改快照结构，不建 append/store/version shortcut。

Run: `npm test -- src/状态/后端/MatchCase操作.test.ts`

Expected: PASS。

- [ ] **Step 7: 提交合同与运输切片**

```bash
git add src/数据/BFF契约.ts src/测试/BFF样本.ts src/测试/S0筛选记录样本.ts \
  src/数据/招聘数据源/MatchCase.ts src/数据/招聘数据源/MatchCase.test.ts \
  src/状态/后端/MatchCase操作.test.ts src/数据/MatchCase展示映射.test.ts \
  src/屏幕/P5/MatchCase详情.test.tsx
git commit -m "feat: decode S0 screening records"
```

把上述局部 404 清理一并加入本提交；提交前确认 staged 列表不含 CSS、Mock 产品数据或无关文件。

### Task 2: 映射 S0 展示记录与权威结果文案

**Files:**
- Modify: `src/数据/MatchCase展示映射.ts:1-20, 285-335, 420-465, 540-610`
- Test: `src/数据/MatchCase展示映射.test.ts:170-225, 639-725`

**Interfaces:**
- Consumes: Task 1 的 `P5阶段区.screeningRecords`、`P5详情.role` 与 `P5详情.state.outcome`。
- Produces: `P5S0消息视图`、`P5S0总结视图`、`P5阶段区块视图.Agent消息`、`P5阶段区块视图.Agent总结`，供 Task 3 页面适配。

- [ ] **Step 1: 先写 mapper 的完整投影测试**

让测试工厂的 S0 可注入 normalized records。核心期望固定为：

```ts
expect(S0区.Agent消息).toEqual([
  { id: 's0q_1', kind: 'question', role: 'candidate', round: 1,
    answerStatus: null, occurredAt: '2026-08-23T10:01:00Z',
    内容: '这个岗位是否需要固定晚班？' },
  { id: 's0a_1', kind: 'answer', role: 'recruiter', round: 1,
    answerStatus: 'answered', occurredAt: '2026-08-23T10:02:00Z',
    内容: '没有固定晚班。' },
]);

expect(S0区.Agent总结).toEqual([
  { id: 's0s_0', phase: 'initial', round: null,
    occurredAt: '2026-08-23T10:00:30Z', 标签: '初评', 内容: '需要确认岗位的值班安排。' },
  { id: 's0s_1', phase: 'reevaluation', round: 1,
    occurredAt: '2026-08-23T10:03:00Z', 标签: '第 1 轮复评',
    内容: '已确认没有固定晚班，仍需了解其它工作安排。' },
]);
```

用 `it.each` 锁定三种未回答正文；技术字段保留在 view，但 Agent summary 不覆盖旧 `摘要`，旧 `清单`、`时间线`、`叮嘱`、`附件` 语义不变。Recruiter 正常输入得到 `Agent总结=[]`；绕过 decoder 注入 recruiter 非空总结或 S1–S3 非 null records 时，mapper 返回 `kind:'契约错误'`，不能静默过滤。

Run: `npm test -- src/数据/MatchCase展示映射.test.ts`

Expected: FAIL；view 尚无新字段与文案映射。

- [ ] **Step 2: 写 S0 结果语义测试**

覆盖以下精确状态，且把旧 summary 改成相反含义文本证明它不参与判定：

```text
S0 active                              → 进行中
S0 passed，top-level outcome=null       → 已通过
ended at S0 + policy_rejected           → 不匹配
ended at S0 + semantic_not_fit          → 不匹配
ended at S0 + user_ended                → 已结束
ended at S0 + party_account_deleted     → 已结束
```

每个 case 的 actions 与 `补充问题` 必须保持原合同结果。

- [ ] **Step 3: 实现最小展示 mapper**

新增闭合表：

```ts
const 未回答文案表 = {
  declined: '已拒绝回答',
  unknown: '暂无法确认',
  not_available: '暂无可用信息',
} as const;
```

question／answered answer 的 `内容` 取原 `text`；未回答 answer 查表。Initial 标签为 `初评`，reevaluation 标签为 `第 ${round} 轮复评`。所有技术字段原样进入 view，不排序、不截断。

让 `映射阶段区` 接收 root state 与 viewer，并验证只有 S0 可有 records、recruiter summaries 必空。结果文案只增加一个分支：当前区为 S0、区 state 为 ended、root lifecycle/stage 是 S0 终局、outcome 属于 `policy_rejected | semantic_not_fit` 时返回 `不匹配`；其它情况仍走 `阶段区状态文案表`。

不要建立通用 outcome 翻译器，不把 Agent summary 写进 `摘要`，不从任何文本或 API 生成 checklist/action。

- [ ] **Step 4: 验证并提交 mapper 切片**

Run: `npm test -- src/数据/MatchCase展示映射.test.ts`

Expected: PASS。

Run: `npm run typecheck`

Expected: PASS；若 Task 3 消费者因新字段发生 exhaustive 错误，只做类型兼容，不删除或 optional 化新 view 字段。

```bash
git add src/数据/MatchCase展示映射.ts src/数据/MatchCase展示映射.test.ts
git commit -m "feat: map S0 screening records for display"
```

### Task 3: 在既有阶段对话与小结托盘中呈现 S0 记录

**Files:**
- Modify: `src/数据/类型.ts:88-110`
- Modify: `src/组件/阶段对话流.tsx:22-55, 100-110, 170-290`
- Create: `src/组件/阶段对话流.test.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.tsx:88-120, 395-440`
- Test: `src/屏幕/P5/MatchCase详情.test.tsx:1-180, 370-455, 700-880`

**Interfaces:**
- Consumes: Task 2 的 `Agent消息` 与 `Agent总结`。
- Produces: `对话条.编号: number | string`、`分段项.Agent总结?: readonly { 编号: string; 标签: string; 内容: string }[]`；视觉继续使用现有气泡与 `小结托盘`。

- [ ] **Step 1: 先写共享组件回归测试**

创建 `阶段对话流.test.tsx`：

1. 旧 Mock 形状只传 numeric 对话、旧小结和 checklist，展开后原正文、清单及条数不变，调用方无需 `Agent总结`。
2. Backend 形状传 string message IDs 与两个总结，展示 `初评：需要确认岗位的值班安排。` 和 `第 1 轮复评：已确认没有固定晚班，仍需了解其它工作安排。`；总结不计入“条数”。
3. `rerender` 从一条 question 更新为同 ID question＋新 answer，question 仍一份、answer 一份、总结不进入气泡区。

只断言 DOM 文本与数量，不依赖 CSS hash、像素或截图。

Run: `npm test -- src/组件/阶段对话流.test.tsx`

Expected: FAIL；`对话条` 还不接 string ID，`分段项` 也没有总结槽。

- [ ] **Step 2: 扩展最小共享渲染缝**

把 `对话条.编号` 改成 `number | string`；现有 numeric Mock 数据继续合法。给 `分段项` 增加：

```ts
Agent总结?: readonly { 编号: string; 标签: string; 内容: string }[];
```

`条数` 仍只计算对话加用户气泡。小结托盘条件变为“旧小结存在或 Agent 总结非空”，内部顺序固定为旧小结 → 旧 checklist → Agent 总结 → 旧链接。每条总结以 `编号` 为稳定 key，显示 `${标签}：${内容}`，复用现有 `小结正文`，不新增 CSS、标题栏、时间或气泡。

Run: `npm test -- src/组件/阶段对话流.test.tsx`

Expected: PASS；旧调用无需新增 props。

- [ ] **Step 3: 先写详情页双角色、时间与动作隔离测试**

给详情页 normalized S0 factory 加完整 records，分别以 candidate/recruiter viewer 渲染同一 messages，断言：

- Candidate 下 question 为我方、answer 为对方；recruiter 下左右相反。用现有气泡行 DOM 结构判断，不靠角色文案。
- 只出现正文／状态和时间；不出现 `question`、`answer`、`candidate`、`recruiter`、`round 1`、`s0q_1` 或 `Agent问答`。
- Candidate 出现初评与所有逐轮复评且无 summary 时间；recruiter 不出现总结正文、失败占位或空托盘。
- 三种未回答只显示固定文案，没有伪造正文或新增输入框。
- S0 新消息在旧 transcript／instruction receipts 前；不按时间混排。
- Question-only、空 messages、零问答但 initial、轮次空档合法；轮询式 rerender 不重复。
- 旧步骤摘要、checklist、附件、叮嘱、`respond_fact` 与动作仍在；fact response 继续提交 transcript ref `prompt_1`，永不提交 `s0q_1`。

以两个进程时区运行，对 `2026-08-23T10:01:00Z` 分别断言 UTC=`10:01`、Asia/Shanghai=`18:01`；用不同的 fake current time 证明显示不读 `Date.now()`：

```bash
TZ=UTC npm test -- src/屏幕/P5/MatchCase详情.test.tsx
TZ=Asia/Shanghai npm test -- src/屏幕/P5/MatchCase详情.test.tsx
```

Expected: FAIL；页面尚未合并新消息，旧 formatter 仍切 UTC 字符串。

- [ ] **Step 4: 实现本地 HH:mm 与页面适配**

用任务内聚的 `Intl.DateTimeFormat('zh-CN', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' })` 替换 `iso.slice(11,16)`，由 `formatToParts` 拼两位 `HH:mm`；非法值防御性显示 `时间待确认`。不固定产品时区、不硬编码加八小时、不改 DTO。

`段内对话` 顺序固定：

1. `区.Agent消息`：编号 `s0:${item.id}`，方位由 `item.role === viewer` 决定，正文用 mapper `内容`，时间用 `occurredAt`。
2. 旧 transcript：保持原顺序，使用稳定 `eventId` 前缀 key。
3. 旧 instruction receipts：保持原顺序，使用稳定 `instructionId` 前缀 key。

不要显示 kind、role、round 或 ID。把 `区.Agent总结` 原样适配为 `分段项.Agent总结`；招聘方自然得到空数组。服务端文本继续作为 React 文本节点，不用 `dangerouslySetInnerHTML`，不按正文触发操作。附件、尾部 action、用户气泡与空说明保持。

- [ ] **Step 5: 验证并提交 UI 切片**

Run: `TZ=UTC npm test -- src/组件/阶段对话流.test.tsx src/屏幕/P5/MatchCase详情.test.tsx`

Expected: PASS。

Run: `TZ=Asia/Shanghai npm test -- src/组件/阶段对话流.test.tsx src/屏幕/P5/MatchCase详情.test.tsx`

Expected: PASS。

Run: `npm test -- src/数据/MatchCase展示映射.test.ts src/状态/后端/MatchCase操作.test.ts`

Expected: PASS。

```bash
git add src/数据/类型.ts src/组件/阶段对话流.tsx src/组件/阶段对话流.test.tsx \
  src/屏幕/P5/MatchCase详情.tsx src/屏幕/P5/MatchCase详情.test.tsx
git commit -m "feat: render S0 screening records in case timeline"
```

提交前确认 staged 列表不含 CSS 或 Mock 产品数据；`src/测试/BFF样本.ts` 是 Backend 合同样本，不属于 Mock 产品数据。

### Task 4: 范围审计、异构代码 Review 与最终非浏览器门禁

**Files:**
- Review only: Task 1–3 的固定候选 diff
- Modify only for verified required findings: Task 1–3 已列文件

**Interfaces:**
- Consumes: 三个实现切片及其定向 PASS。
- Produces: 无未解决有效 required finding 的候选 commit，以及一次有效最终权威 gate 证据。

- [ ] **Step 1: 做 Spec 覆盖与范围审计**

```bash
git status --short
git diff --check f339828595215f398e058bcf5f5a38b180b0f3a8..HEAD
git diff --name-status f339828595215f398e058bcf5f5a38b180b0f3a8..HEAD
rg -n "include=screening_records|screeningRecords|Agent消息|Agent总结|已拒绝回答|暂无法确认|暂无可用信息" src
rg -n "dangerouslySetInnerHTML|screening.*fact|fact.*screening" src/屏幕/P5 src/组件 src/数据
```

核对没有第二详情 GET、无 include fallback、无跨 API 请求、无独立 store、无 CSS／Mock 产品改动；新记录只作展示和 key，`respond_fact` 仍只来自 transcript ref。

- [ ] **Step 2: 运行最小定向回归候选**

```bash
npm test -- src/数据/招聘数据源/MatchCase.test.ts \
  src/状态/后端/MatchCase操作.test.ts \
  src/数据/MatchCase展示映射.test.ts \
  src/组件/阶段对话流.test.tsx \
  src/屏幕/P5/MatchCase详情.test.tsx
```

Expected: PASS。记录命令、commit、结果与耗时；失败时使用 `superpowers:systematic-debugging` 定位根因，只在对应 Task 边界做最小修复并重跑失效测试。

- [ ] **Step 3: 按父工作流执行 Claude 异构代码 review**

使用当前可用的 Claude review-loop，模式为 implementation code review，scope 固定为 `f339828595215f398e058bcf5f5a38b180b0f3a8..HEAD` 中 Task 1–3 的产品和测试 diff；传入批准 Spec commit/blob、本 Plan 最终 commit/blob、用户目标／非目标和定向测试证据。Reviewer 只读、不运行测试、不扩大到整个 branch 或无关文档。

逐条核实 finding，按仓库规则记录 `必要性` 与 `复杂度影响`。只修复成立的 required；optional 不阻塞，增加复杂度且无现实故障证据的建议拒绝。每轮修复单独 commit，只重跑被改动失效的定向测试，直至无未解决有效 required 或达到 review-loop 上限。上限后仍有 required 时停止，不进入 final gate。

- [ ] **Step 4: 运行一次最终权威非浏览器 gate**

Code review 收敛后，在最终候选 commit 上依次运行：

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 四项全部 exit 0。长命令超过单次等待窗口时继续追踪同一进程，不重新启动。保存每项 source commit、命令、结果和耗时；review 修复若使某项证据失效，只补失效项，不机械重复仍有效的 broad gate。

### Task 5: 真实双端 dogfood、证据边界与实施 Handoff

**Files:**
- Create locally, ignored: `dogfood-output/$DOGFOOD_RUN_ID/report.md`
- Create locally, ignored: `dogfood-output/$DOGFOOD_RUN_ID/screenshots/`
- Create: `docs/superpowers/handoffs/2026-09-09-recruitment-s0-screening-records-frontend.md`

**Interfaces:**
- Consumes: Task 4 最终候选、`docs/dogfood/真实后端行为验收.md`、报告模板、后端展开合同与双角色账号。
- Produces: 真实页面 PASS／FAIL／BLOCKED 证据，以及脱敏、可提交的完成／阻塞 handoff。

- [ ] **Step 1: 使用 agent-browser 技能准备并核对环境**

实施会话先完整读取 `agent-browser` skill 和两份 dogfood 文档。取得指南要求的目标 URL、后端工作区和安全账号材料来源；缺项时完成可做的只读核对，相关浏览器结论记 `BLOCKED`，不能用 fixture 单测补成 PASS。

现场运行并记录：

```bash
agent-browser --version
agent-browser doctor
agent-browser skills get core --full
agent-browser skills get dogfood
git rev-parse HEAD
git -C "$AGXP_MONOREPO_DIR" rev-parse HEAD
"$AGXP_MONOREPO_DIR/apps/recruitment/scripts/dev-local.sh" health --acceptance
```

确认 BFF 与 Recruitment 的运行版本都包含 `s0-screening-records.v1`，再以 Backend local 环境启动或复用前端。记录栈归属、前端／BFF／Recruitment SHA、视口、locale 与时区。不得把“release 已合入”记成“环境已部署”。

- [ ] **Step 2: 用两个独立会话验证同一个真实 Case**

按指南建立 candidate 与 recruiter 两个独立具名浏览器会话，生成唯一 `DOGFOOD_RUN_ID`。优先使用后端现有授权 `happy` scene 或等价真实 Case，所有业务写入走 UI。

逐节点观察并留截图／快照摘要：

1. S0 question 先出现，后续 answer 与 reevaluation 随权威轮询出现，旧问题不重复。
2. 两端同一 Case 的 Q/A 正文与记录时间对应一致，candidate/recruiter 我方／对方镜像正确。
3. 候选显示初评及实际产生的逐轮复评；招聘不显示这些正文、失败占位或空托盘。
4. 人工补充事实仍由旧问题卡提交，真实 Agent Q/A 不被重复或误标。
5. 进入 S1 后仍能回看 S0；ended／completed Case 从历史重开仍显示。
6. 刷新、失败重试和角色切换不重复、不串 Case／主体。
7. 简历附件、叮嘱、协调与意向动作按权威状态保持。

保存关键截图，并写固定 before vs after：`Before：Backend 详情只有阶段状态／旧小结；After：匿名初筛阶段内显示真实 Agent Q/A，候选端另显示初评与逐轮复评。`

真实模型零轮结束是合法结果，不能伪造对话。若没有自然产生多轮、未回答或轮次空档，标为“fixture 合同／组件 PASS，真实模型 NOT_RUN”，不得冒充真实证据。环境未部署、scene 不支持、账号或数据不足写精确 `BLOCKED`。

- [ ] **Step 3: 清理资源并完成本地报告**

按 receipt 生命周期 verify／cleanup；只关闭本轮自己启动的前端、栈和浏览器会话，不用 `close --all`、不按端口批量 kill、不删卷。清理失败单列并保留准确 receipt 与恢复步骤。

在本地 report 写每个节点状态、运行 SHA、请求路径观察、截图路径、before vs after、真实／fixture 边界及清理状态。OTP、Cookie、Authorization、手机号与完整联系方式不得进入文件名、报告或提交。

- [ ] **Step 4: 写脱敏实施 handoff**

创建 `docs/superpowers/handoffs/2026-09-09-recruitment-s0-screening-records-frontend.md`，填写以下 schema；不能提交空栏：

```markdown
# S0 匿名初筛记录前端接入实施 Handoff

## 版本
- Frontend source commit: 精确 SHA
- BFF runtime commit: 精确 SHA 或 BLOCKED 原因
- Recruitment runtime commit: 精确 SHA 或 BLOCKED 原因
- Approved Spec: commit f339828595215f398e058bcf5f5a38b180b0f3a8 / blob e47632f74f0c6123f40cfb1f696c6c2d5a7e4ca1
- Implementation Plan: 最终 commit / blob

## 实施范围
- 请求与严格 decoder: 实际文件与行为
- 权威快照与轮询: 实际测试结论
- 双端展示与隐私: 实际行为
- 明确未做: 跨 API 固定检查项、S1–S3 记录、CSS／Mock 改造

## 自动化验证
| 命令 | 结果 | 耗时 | source commit |
| --- | --- | --- | --- |

## 真实双端 dogfood
- Run ID 与本地报告相对路径: 实际值
- Candidate / recruiter 结论: PASS、FAIL 或 BLOCKED
- Before vs after: 实际观察
- Fixture 与真实模型证据边界: 实际范围
- 清理状态: 完成、未完成或不涉及

## 未完成责任
- 无，或逐项写 FAIL／BLOCKED、已完成节点、原因与恢复入口。
```

真实 dogfood 若 BLOCKED，自动化 PASS 可如实交付，但不得宣称完整 E2E 完成；若观察到产品 FAIL，先完成安全清理并回到相应实现 Task 修复和复验，不能提交“已完成”handoff。

- [ ] **Step 5: 提交 handoff 并完成前核验**

```bash
git add docs/superpowers/handoffs/2026-09-09-recruitment-s0-screening-records-frontend.md
git commit -m "docs: record S0 screening records verification"
git status --short
git log --oneline -5
```

Expected: 工作树没有本任务未提交文件，`dogfood-output/` 不在 staged files。使用 `superpowers:verification-before-completion` 对 handoff 中每条 PASS 回查原始命令和报告证据后再声明结果。

## 测试选择五问

1. **要防的失败与边界：** 漏／重复 include、decoder 漏校验、招聘私有总结泄露、轮询 append 重复或同 state 不更新、主体迟到污染、技术字段或错误时间进入 DOM、Agent question 被误接成人工 `respond_fact`、新内容遮挡附件／动作，以及 Mock 共享组件回归。
2. **开发反馈的最小合法命令：** 合同用 `npm test -- src/数据/招聘数据源/MatchCase.test.ts`；快照用 `npm test -- src/状态/后端/MatchCase操作.test.ts`；mapper 用 `npm test -- src/数据/MatchCase展示映射.test.ts`；UI 用 UTC 与 Asia/Shanghai 两个进程运行 `阶段对话流.test.tsx` 和 `MatchCase详情.test.tsx`。
3. **需提前验证的真实边界：** 浏览器到 BFF 的 query、双角色权限、轮询增量和历史回看不能由 jsdom 证明；code review 与非浏览器 gate 收敛后立即 dogfood。多轮／未回答依赖自然输出，无法触发时与 fixture 分栏。
4. **最终权威验收与发布责任：** 实施者负责一次最终 `npm test`、typecheck、lint、build，以及真实双端 agent-browser dogfood或精确 BLOCKED；发布顺序是 Recruitment → BFF → frontend，回滚先停 frontend 消费。正式部署／合入由发布 owner 决定。
5. **已有证据与预计成本：** 规划阶段只有源码、后端合同和 fixture 的只读核对，没有本任务测试或浏览器 PASS。定向、完整 gate 与 dogfood 耗时均未知，不能缩短观察或用 fixture 冒充真实来“提速”。

## 计划分级与执行模型

- **计划本身复杂度：中。** 改动集中在一条现有详情链，但 decoder 有多分支闭合对象、跨记录顺序／关联和双角色隐私不变量，共享阶段组件还需保持 Mock 回归。
- **零上下文漂移风险：中。** Spec 与接口已冻结，代码路径明确；现场不确定性主要是分支差异、实际后端部署、双角色账号和模型是否自然产生多轮／未回答。
- **执行模型：使用当前可用的行业 Top 5–10 中高性价比模型。** 只按中等漂移风险选择，不因计划复杂度升级；Claude 与 Codex 执行 prompt 必须保持同一分级。

## 完成判定与回退

- Task 1–3 定向测试通过，三个实现切片可独立回退。
- Claude 异构代码 review 无未解决有效 required finding。
- 最终 `npm test`、typecheck、lint、build 在最终候选 commit 上有效。
- 真实双端 dogfood 全部要求节点通过，或 handoff 精确记录环境／数据 BLOCKED。
- 招聘 summaries 泄露、跨主体陈旧记录、screening ID mutation、include fallback 等反例被测试或现场证据否定。
- 实际前后端运行 SHA、截图、before vs after、真实／fixture 边界与范围限制已记录。
- 没有扩展丰富固定检查项、S1–S3、CSS／Mock 或其它独立问题。

回退按提交逆序：先撤 Task 3 UI 消费，再撤 Task 2 mapper，最后撤 Task 1 include 与 decoder；后端合同可继续向后兼容存在。不能只撤 decoder 而保留 include，也不能先回退后端而让生产前端继续请求展开字段。
