# Hosted Agent 失败合同前端接线与真实 E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 严格接入 Hosted Agent 后端已经冻结的 P4/P5/P6 owner-safe 失败合同，并用现有真实后端 agent-browser 编排证明一个 candidate/recruiter Hosted Agent happy path。

**Architecture:** 保持三个领域各自的 strict decoder、operation fence 和展示映射，不建立跨领域 failure 抽象。P4 只扩展现有页面轮询 hook，给 row-backed terminal summary 做每 scope 每 ID 一次的权威补读；P5 只增加只读 attention 说明；P6 只把 failed code 传到双端共享卡。真实 E2E 作为现有 `e2e/真实后端` runner 的一个显式 journey 接入，不建立第二套 runner、账号或 fixture。

**Tech Stack:** React 19、TypeScript 6、Vitest 4、Testing Library、Bash 3.2、agent-browser、现有 BFF HTTP data source 与 backend-local E2E runner。

**Spec:** `docs/superpowers/specs/2026-09-03-hosted-agent-failure-contracts-frontend-design.md`

## Global Constraints

- 开始实现前完整阅读 `CLAUDE.md`、`AGENTS.md`、Spec 与本 Plan；在隔离 worktree 中使用 `superpowers:using-git-worktrees`，从执行时最新 `origin/main` 创建实现分支。
- 后端合同真相源固定为 `/Users/visionclaw/agxp-monorepo` 的 `release/0.2.5@f69fcec265cf634508d6e3236d85e7eeb74d9b37`；身份、runtime、失败合同对应提交为 `68844cab3`、`54adf892a`、`fe5006919`、`ab198f455`、`f69fcec26`。实现前只读核对这组提交仍可解析；不得修改后端仓库。
- P4 receipt 是七个 required key；P5 `agent_attention` 与 P6 `failure_code` 是 optional-but-non-null；所有未知 key、状态、enum 或非法联合组合 fail closed。
- 不新增 P4/P5 Agent retry，不把 `retry_resume_readiness` 当 Agent retry，不水合历史 P6 failed proposal，不建立长期双 schema、通用 failure framework 或新配置项。
- failure 不创建本地 Case、rule、task，不派发 Mock 成功；`case_started` 只使用 server `case_id`，active rule 只在 accept 成功并权威重读后出现。
- candidate/recruiter 的 role、subject、session、scope/generation、幂等和隐私投影不回归；页面、日志与 E2E evidence 不出现 task ID、global identity、provider/model、HTTP 内部错误、raw exception、clauses/projection、Cookie、bearer、手机号、OTP、原始简历/JD 或完整模型输出。
- 不重复 release/0.2.5 已完成的 truthful copy、Case 导航、Backend/Mock 隔离；不重构真实后端 runner、视觉系统或后端 fixture。
- 每个代码 Task 严格 RED → GREEN 后单独提交。若执行时最新主干改变本文冻结的接口、文件路径、测试入口或 E2E 运行假设，先停止修改，记录 `dependency_drift: requires_replan`，回到原 planning owner 修订并重审 Plan。

## Scope、依赖与完成边界

- 本批次只有一个 Plan。P4/P5/P6 共享 `src/数据/BFF契约.ts`、BFF samples 与最终 E2E，拆分会造成同文件冲突和重复集成，因此串行落在同一实现 owner、同一 branch/worktree。
- 无前序 Plan Handoff；本 Plan 直接消费已经合并的后端 release commit。没有下游 Plan。
- 实现完成标准：Tasks 1–6 的代码、测试和提交完成；异构 code review clean；唯一 authoritative plan-scope gate PASS；Plan Handoff 草稿写全。真实 Hosted Agent L3 只在最后的 Terminal Integration Task、用户明确批准后运行。
- 当前 official browser fixture 的 run receipt/cleanup 只拥有 candidate intention、resume file 与 recruiter job，不拥有 happy path 会新增的 Agent rule、delegation 或 MatchCase；在后端扩展 owner-safe cleanup 或提供每轮唯一隔离数据前，真实 `hosted-agent` 运行同样是 `INTEGRATION_REQUIRED/BLOCKED_BY_BACKEND_FIXTURE_OWNERSHIP`。safe-failure selectable fixture 也不存在，因此 P4 Agent failure、P5 attention、P6 failed proposal 三条真实失败 E2E 保持 `BLOCKED_BY_BACKEND_FIXTURE`。这些外部 blocker 不影响本轮 strict unit/UI 与 runner contract 完成，也不得用数据库、network interception、Mock 或第二套前端清理器伪造通过。
- **计划本身复杂度：高。** 三个不同状态合同共享 wire 类型并牵涉四个 P4 页面、MatchCase 展示、规则提案与真实双会话 E2E，验证面广且有严格安全边界。
- **零上下文漂移风险：高。** 执行时需要同最新前端主干和外部后端 release、真实 Provider/runtime、浏览器 fixture 共同校准，真实 E2E 现场变化需要高质量判断。
- **执行模型档位：当前可用的行业顶尖模型。** 该选择只由高零上下文漂移风险决定。

## 验证分层与静态集成 Handoff

- Task/inner-loop：每个 Task 只运行列出的 Vitest 或 shell contract tests。
- 唯一 authoritative plan-scope gate：本仓库没有正式 affected/service selector；仓库 `package.json` 与 `CLAUDE.md` 的完整隔离门是 `npm run test && npm run typecheck && npm run lint && npm run build && npm run test:agent-browser:unit && npm run test:agent-browser:shell`。Task 6 的 shell/unit 命令属于 inner-loop；异构 review 之后只在 Task 7 运行一次本组合命令作为权威门。
- L3 integration requirement：`required`。
- selection SSOT：`e2e/真实后端/类型.ts` 的 `旅程们` 与 `e2e/真实后端/运行整栈验收.sh` 的 selector 共同定义本 suite 的现有 journey catalog；仓库没有独立只读 selection preview，`selection_gap: none`。
- L3 selection：
  - suite: `frontend-agent-browser-backend-local`
  - impact_class: `case-semantic`
  - mode: `explicit`
  - cases: `[hosted-agent]`
  - case_set: `none`
  - seeds: `[hosted-agent]`
  - closure_reasons: `{hosted-agent: "本 diff 新增的 Hosted Agent browser journey 及其直接 dispatcher/report catalog row"}`
  - cadence_scope: `required`（用户与批准 Spec 明确要求本轮运行真实 Hosted Agent E2E）
  - fallback: `false`
  - fallback_reason: `none`
  - reason: P6 interpretation、candidate-target delegation、recruiter-target `screen_resume`、权威刷新/深链只能由真实 Provider 与双会话整栈证明。
  - prerequisites: 后端 `release/0.2.5@f69fcec265cf634508d6e3236d85e7eeb74d9b37` 健康且 `--llm-mode real`，Hub model access、active tenant 与 `recruitment.v1` enrollment 已由官方 bootstrap 收敛，agent-browser 与 Chrome 版本满足现有 runner preflight；官方 browser fixture 已能按本轮 run receipt owner-safe 收敛新增 Agent rule/delegation/MatchCase，或已提供等价的每轮唯一隔离数据。
  - evidence: `npm run test:agent-browser:backend-local -- --journey hosted-agent` 的脱敏 `report.json/report.md`、journey fragment、METHOD+pathname request set 和页面终态；不新增视觉 baseline。
  - granularity_gap: `none`
- `release_handoff.required: false`、owner/status/mode 均为 `none`；本任务没有 nightly-only 或 release-only 责任，development 结果保持 `release_verdict: PENDING`。

---

### Task 1: 严格解码 P4 七键 delegation receipt

**Files:**
- Modify: `src/数据/BFF契约.ts`（`BFF委托回执`）
- Modify: `src/数据/招聘数据源/发现推荐.ts`（P4 vocabulary、receipt/batch decoder）
- Modify: `src/数据/招聘数据源/发现推荐.test.ts`（delegation decoder/facade cases）
- Modify: `src/测试/BFF样本.ts`（所有 P4 receipt samples）

**Interfaces:**
- Consumes: 后端七键 `DelegationReceipt`，六状态、六 refusal、三个 failure；create batch 允许且只允许 `state='refused'` 的对象携带空 `delegation_id`，single GET 永远要求非空 ID。
- Produces:

```ts
export type BFF委托拒绝码 =
  | 'recommendation_not_found'
  | 'recommendation_unavailable'
  | 'recommendation_stale'
  | 'delegation_not_allowed'
  | 'active_case_quota_reached'
  | 'delegation_cooldown';

export type BFF委托失败码 =
  | 'delegation_agent_unavailable'
  | 'delegation_evaluation_failed'
  | 'delegation_failed';

export interface BFF委托回执 {
  delegation_id: string;
  recommendation_id: string | null;
  state: BFF委托状态;
  evaluation_id: string | null;
  case_id: string | null;
  refusal_code: BFF委托拒绝码 | null;
  failure_code: BFF委托失败码 | null;
}
```

- Matrix：`accepted` 两 code/null、evaluation/case 均 null；`evaluating` 两 code/null、evaluation 非空、case null；`needs_user` 只冻结 row-backed ID 与两 code/null，保留后端已有阶段坐标；`case_started` 两 code/null、case 非空；`refused` refusal 非空/failure null；`failed` refusal null/failure 非空。terminal 的 evaluation/case 坐标不增加后端未冻结的额外约束。所有非 create-time refusal 都要求非空 delegation ID。

- [ ] **Step 1: 写 P4 decoder RED tests**

在 `发现推荐.test.ts` 的 delegation describe 中加入以下 fixture/helper 和 table tests；现有 facade mock 继续使用文件内 `请求Mock` 与 `响应`：

```ts
const 七键回执 = {
  delegation_id: 'del_1',
  recommendation_id: 'rec_1',
  state: 'accepted',
  evaluation_id: null,
  case_id: null,
  refusal_code: null,
  failure_code: null,
};

it.each([
  [{ state: 'accepted', evaluation_id: null }, 'accepted'],
  [{ state: 'evaluating', evaluation_id: 'eval_1' }, 'evaluating'],
  [{ state: 'needs_user', evaluation_id: 'eval_1', case_id: 'mc_existing' }, 'needs_user'],
  [{ state: 'case_started', case_id: 'mc_1' }, 'case_started'],
  [{ state: 'refused', refusal_code: 'recommendation_stale' }, 'refused'],
  [{ state: 'failed', evaluation_id: 'eval_1', failure_code: 'delegation_agent_unavailable' }, 'failed'],
] as const)('single GET 接受合法矩阵 %s', async (覆盖, state) => {
  请求Mock.mockResolvedValue(响应({ ...七键回执, ...覆盖 }));
  const result = await source.读取候选岗位委托('del_1');
  expect(result.state).toBe(state);
});

it.each([
  { ...七键回执, state: null },
  { ...七键回执, failure_code: 'future_failure' },
  { ...七键回执, state: 'failed', failure_code: null },
  { ...七键回执, state: 'refused', refusal_code: null },
  { ...七键回执, state: 'refused', refusal_code: 'delegation_cooldown', failure_code: 'delegation_failed' },
  { ...七键回执, state: 'evaluating', evaluation_id: null },
  { ...七键回执, state: 'accepted', evaluation_id: 'eval_1' },
  { ...七键回执, state: 'case_started', case_id: null },
  { ...七键回执, state: 'failed', failure_code: 'delegation_failed', task_id: 'secret' },
] as const)('single GET 非法合同 fail closed', async (receipt) => {
  请求Mock.mockResolvedValue(响应(receipt));
  await expect(source.读取候选岗位委托('del_1'))
    .rejects.toMatchObject({ code: 'invalid_response' });
});

it('create batch 只给 refused 空 delegation_id 例外，single GET 与 failed 均拒绝空 ID', async () => {
  请求Mock.mockResolvedValueOnce(响应({
    receipts: [{ ...七键回执, delegation_id: '', state: 'refused', refusal_code: 'delegation_not_allowed' }],
  }));
  await expect(source.创建招聘候选委托({
    jobId: 'job_1', recommendationId: 'rec_1', idempotencyKey: 'idem_1',
  })).resolves.toMatchObject([{ delegation_id: '', state: 'refused' }]);

  for (const receipt of [
    { ...七键回执, delegation_id: '', state: 'refused', refusal_code: 'delegation_not_allowed' },
    { ...七键回执, delegation_id: '', state: 'failed', failure_code: 'delegation_failed' },
  ]) {
    请求Mock.mockResolvedValueOnce(响应(receipt));
    await expect(source.读取招聘候选委托('del_1')).rejects.toMatchObject({ code: 'invalid_response' });
  }
});
```

把 `BFF样本.ts` 中每个现有 P4 receipt literal 补齐 `failure_code: null`；另导出一个失败样本：

```ts
export const BFF委托失败回执样本: BFF委托回执 = {
  delegation_id: 'del_failure_1',
  recommendation_id: BFF候选岗位推荐样本.recommendation_id,
  state: 'failed',
  evaluation_id: null,
  case_id: null,
  refusal_code: null,
  failure_code: 'delegation_agent_unavailable',
};
```

- [ ] **Step 2: 运行 RED**

```bash
npx vitest run src/数据/招聘数据源/发现推荐.test.ts
```

Expected: FAIL；旧 decoder 拒绝 `failure_code`，接受 `state:null`，缺少 stale/failure unions 与矩阵检查。

- [ ] **Step 3: 实现七键、上下文 ID 规则与完整矩阵**

在 `BFF契约.ts` 写 Interfaces 中的类型；在 `发现推荐.ts` 替换 vocabulary 和 decoder 为：

```ts
const 委托拒绝码全表 = [
  'recommendation_not_found', 'recommendation_unavailable', 'recommendation_stale',
  'delegation_not_allowed', 'active_case_quota_reached', 'delegation_cooldown',
] as const satisfies readonly BFF委托拒绝码[];
const 委托失败码全表 = [
  'delegation_agent_unavailable', 'delegation_evaluation_failed', 'delegation_failed',
] as const satisfies readonly BFF委托失败码[];

type 委托回执读取上下文 = 'create' | 'single';

function 解委托回执(input: unknown, 上下文: 委托回执读取上下文): BFF委托回执 {
  const raw = 要求闭合对象(input, [
    'delegation_id', 'recommendation_id', 'state', 'evaluation_id', 'case_id',
    'refusal_code', 'failure_code',
  ]);
  const state = 要求枚举(raw.state, 委托状态全表);
  const delegation_id = 要求字符串(raw.delegation_id);
  const evaluation_id = 要求可空非空字符串(raw.evaluation_id);
  const case_id = 要求可空非空字符串(raw.case_id);
  const refusal_code = raw.refusal_code === null
    ? null
    : 要求枚举(raw.refusal_code, 委托拒绝码全表);
  const failure_code = raw.failure_code === null
    ? null
    : 要求枚举(raw.failure_code, 委托失败码全表);

  const 允许空ID = 上下文 === 'create' && state === 'refused';
  if (!允许空ID && delegation_id === '') throw 契约错误();
  const 无码 = refusal_code === null && failure_code === null;
  const 坐标合法 =
    (state === 'accepted' && 无码 && evaluation_id === null && case_id === null) ||
    (state === 'evaluating' && 无码 && evaluation_id !== null && case_id === null) ||
    (state === 'needs_user' && 无码) ||
    (state === 'case_started' && 无码 && case_id !== null) ||
    (state === 'refused' && refusal_code !== null && failure_code === null) ||
    (state === 'failed' && refusal_code === null && failure_code !== null);
  if (!坐标合法) throw 契约错误();

  return {
    delegation_id,
    recommendation_id: 要求可空非空字符串(raw.recommendation_id),
    state,
    evaluation_id,
    case_id,
    refusal_code,
    failure_code,
  };
}

function 解委托批次(input: unknown): BFF委托回执[] {
  const raw = 要求闭合对象(input, ['receipts']);
  const receipts = 要求数组(raw.receipts).map((item) => 解委托回执(item, 'create'));
  if (receipts.length !== 1) throw 契约错误('委托批次应恰好返回一条回执');
  return receipts;
}
```

两个 single GET facade 都改为 `解委托回执(result, 'single')`。不要把 create 的空 ID 例外暴露给其它 decoder。

- [ ] **Step 4: 运行 GREEN、typecheck 与提交**

```bash
npx vitest run src/数据/招聘数据源/发现推荐.test.ts
npm run typecheck
git add src/数据/BFF契约.ts src/数据/招聘数据源/发现推荐.ts src/数据/招聘数据源/发现推荐.test.ts src/测试/BFF样本.ts
git commit -m "feat: decode hosted delegation failure receipts"
```

Expected: tests/typecheck PASS；commit 只含 P4 wire 与 samples。

---

### Task 2: 映射并收敛 P4 failure/refusal 安全文案

**Files:**
- Modify: `src/数据/发现推荐映射.ts`
- Modify: `src/数据/发现推荐映射.test.ts`
- Modify: `src/状态/后端/发现推荐操作.ts`
- Modify: `src/状态/后端/发现推荐操作.test.ts`

**Interfaces:**
- Consumes: Task 1 的 non-null `BFF委托回执.state`、`BFF委托拒绝码`、`BFF委托失败码`。
- Produces: `P4失败原因文案(code): string`；`映射P4委托展示` 对 refused/failed 都只在 summary ID 与 receipt ID/state 对齐时显示安全 reason；operation 对所有 terminal receipt 先权威提交再抛安全 `BFF错误`。
- Copy：
  - `delegation_agent_unavailable` → `AI 服务暂时不可用，本次没有创建 Case`
  - `delegation_evaluation_failed` → `本次评估未完成，不代表候选或岗位不合适`
  - `delegation_failed` → `本次委托未完成`
  - `delegation_not_allowed` → `当前政策或资格不允许发起这次委托`
  - `recommendation_stale` → `这条推荐已过期，请刷新后查看`
  - terminal generic 不带“重试”承诺。

- [ ] **Step 1: 写 P4 mapping/operation RED tests**

在 `发现推荐映射.test.ts` 加：

```ts
it.each([
  ['delegation_agent_unavailable', 'AI 服务暂时不可用，本次没有创建 Case'],
  ['delegation_evaluation_failed', '本次评估未完成，不代表候选或岗位不合适'],
  ['delegation_failed', '本次委托未完成'],
] as const)('failed %s 只显示 owner-safe 原因', (failure_code, reason) => {
  const summary = { delegation_id: 'del_1', state: 'failed', case_id: null } as const;
  const receipt = {
    ...BFF委托失败回执样本,
    delegation_id: 'del_1',
    failure_code,
  };
  expect(映射P4委托展示(summary, receipt)).toMatchObject({
    state: 'failed', reason, inProgress: false, caseId: null,
  });
});

it('refused stale/policy 使用业务原因，错 ID receipt 不泄漏 reason', () => {
  const summary = { delegation_id: 'del_1', state: 'refused', case_id: null } as const;
  const stale = 映射P4委托展示(summary, {
    ...BFF委托失败回执样本,
    delegation_id: 'del_1', state: 'refused', refusal_code: 'recommendation_stale', failure_code: null,
  });
  expect(stale?.reason).toBe('这条推荐已过期，请刷新后查看');
  const mismatched = 映射P4委托展示(summary, {
    ...BFF委托失败回执样本,
    delegation_id: 'del_other', state: 'refused', refusal_code: 'delegation_not_allowed', failure_code: null,
  });
  expect(mismatched?.reason).toBeNull();
});
```

在 `发现推荐操作.test.ts` 的委托 describe 加：

```ts
it.each([
  ['delegation_agent_unavailable', 'AI 服务暂时不可用，本次没有创建 Case'],
  ['delegation_evaluation_failed', '本次评估未完成，不代表候选或岗位不合适'],
  ['delegation_failed', '本次委托未完成'],
] as const)('terminal failure %s 先落权威 receipt、清进行中摘要，再抛安全文案', async (failure_code, copy) => {
  env.数据源.创建候选岗位委托.mockResolvedValue([{
    ...BFF委托失败回执样本,
    failure_code,
  }]);
  await expect(env.操作.委托候选岗位({
    intentionId: 'int_1', recommendationId: 'rec_c1', jobId: 'job_1', resumeFileId: 'rf_1',
    resumeFileVersionId: 'rfv_1', disclosureAcknowledged: true,
  })).rejects.toMatchObject({ status: 200, message: copy });
  expect(env.最新状态().P4委托回执.del_failure_1?.failure_code).toBe(failure_code);
  expect(env.最新状态().候选岗位推荐.int_1?.items[0]?.delegation?.state).toBe('failed');
  expect(env.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '委托入谈' }));
});

it('create-time refused 空 ID 显示当前业务拒绝但不写 receipt cache', async () => {
  env.数据源.创建招聘候选委托.mockResolvedValue([{
    delegation_id: '', recommendation_id: 'rec_1', state: 'refused', evaluation_id: null,
    case_id: null, refusal_code: 'delegation_not_allowed', failure_code: null,
  }]);
  await expect(env.操作.委托招聘候选('job_1', 'rec_1')).rejects.toMatchObject({
    message: '当前政策或资格不允许发起这次委托',
  });
  expect(env.最新状态().P4委托回执['']).toBeUndefined();
});
```

同一文件已有四组 nullable-state/错位-code 钉子必须迁移而不是删除覆盖：

- `P4拒绝文案 与 P4委托终态文案 逐项冻结`：补 `recommendation_stale`，把 `delegation_not_allowed` 和 `failed` 期望改为本 Task 的新安全文案。
- `P4委托回执文案 按...`：移除 `state:null` 输入；改为合法 `refused+refusal_code`、`failed+failure_code`、`needs_user+双 code null` 三条。交叉 code 组合归到 operation 的非法合同用例，不让纯文案函数重复 decoder 矩阵职责。
- `case_started 缺 case_id...`：第三个变体从 `state:null` 改成 `state:'refused', refusal_code:null, failure_code:null`，继续证明非法合同不落状态。
- `needs_user/failed 无视拒绝码...`：改成 `needs_user` 双 code null 与 `failed+delegation_evaluation_failed`，断言新的 safe message；原“错槽也忽略”语义不再合法。
- `state null 按已知非空拒绝码...`：由上面的 create-time empty-ID refusal 用例取代，证明兼容点只在合法 `refused`，不再在 operation 层保留 nullable state 分支。

这些迁移与新增 table 一起保留原来的“非法组合不提交、合法 terminal 先落权威状态”覆盖；不要用 `as unknown as BFF委托回执` 继续制造已从 normalized type 删除的 `state:null`。

- [ ] **Step 2: 运行 RED**

```bash
npx vitest run src/数据/发现推荐映射.test.ts src/状态/后端/发现推荐操作.test.ts
```

Expected: FAIL；没有 failure map，policy/stale copy 未冻结，operation 仍依赖 nullable state/generic retry copy，并可能缓存空 ID。

- [ ] **Step 3: 实现安全文案和 terminal 收敛**

在 `发现推荐映射.ts` 加完整闭合表：

```ts
const P4拒绝原因文案表 = {
  recommendation_not_found: '这条推荐当前已不可用，请刷新后查看',
  recommendation_unavailable: '这条推荐当前已不可用，请刷新后查看',
  recommendation_stale: '这条推荐已过期，请刷新后查看',
  delegation_not_allowed: '当前政策或资格不允许发起这次委托',
  active_case_quota_reached: '当前在谈已达到上限，请先处理已有在谈',
  delegation_cooldown: '近期已联系过对方，暂时不能重复发起',
} as const satisfies Record<BFF委托拒绝码, string>;

const P4失败原因文案表 = {
  delegation_agent_unavailable: 'AI 服务暂时不可用，本次没有创建 Case',
  delegation_evaluation_failed: '本次评估未完成，不代表候选或岗位不合适',
  delegation_failed: '本次委托未完成',
} as const satisfies Record<BFF委托失败码, string>;

export function P4失败原因文案(code: BFF委托失败码): string {
  return P4失败原因文案表[code];
}
```

`映射P4委托展示` 的 reason 只用以下逻辑：

```ts
const receiptMatches = receipt?.delegation_id === summary.delegation_id && receipt.state === summary.state;
const reason = summary.state === 'refused' && receiptMatches && receipt.refusal_code !== null
  ? P4拒绝原因文案(receipt.refusal_code)
  : summary.state === 'failed' && receiptMatches && receipt.failure_code !== null
    ? P4失败原因文案(receipt.failure_code)
    : null;
```

在 `发现推荐操作.ts` 删除 nullable-state 分支，完整 replacement 为：

```ts
export function P4委托终态文案(state: 'needs_user' | 'refused' | 'failed'): string {
  const guidance = {
    needs_user: '，请查看当前可用入口',
    refused: '，请查看页面状态',
    failed: '',
  } as const;
  return `${P4委托状态文案(state)}${guidance[state]}`;
}

export function P4委托回执文案(receipt: BFF委托回执): string {
  if (receipt.state === 'refused' && receipt.refusal_code !== null) {
    return P4拒绝文案(receipt.refusal_code);
  }
  if (receipt.state === 'failed' && receipt.failure_code !== null) {
    return P4失败原因文案(receipt.failure_code);
  }
  if (receipt.state === 'needs_user') return P4委托终态文案('needs_user');
  throw 委托契约漂移();
}

function 回执摘要(receipt: BFF委托回执): BFF委托摘要 {
  return {
    delegation_id: receipt.delegation_id,
    state: receipt.state,
    case_id: receipt.case_id,
  };
}
```

`提交委托回执` 只在 `回执.delegation_id !== ''` 时写 `P4委托回执` cache；仍把 create-time 空 ID refusal 落到当前卡摘要以显示当前请求结果。terminal throw code 改为 `回执.failure_code ?? 回执.refusal_code ?? 回执.state`，message 固定来自 `P4委托回执文案`。保留现有 fence、idempotency release、401/404 与 case_started 逻辑。

- [ ] **Step 4: 运行 GREEN、P4 regression 与提交**

```bash
npx vitest run src/数据/发现推荐映射.test.ts src/状态/后端/发现推荐操作.test.ts
npx vitest run src/屏幕/看市场.test.tsx src/屏幕/职位详情.test.tsx src/屏幕/候选推荐.test.tsx src/屏幕/匿名在线简历.test.tsx
git add src/数据/发现推荐映射.ts src/数据/发现推荐映射.test.ts src/状态/后端/发现推荐操作.ts src/状态/后端/发现推荐操作.test.ts
git commit -m "feat: present safe delegation failure reasons"
```

Expected: all listed tests PASS；no Mock reducer or local Case creation is added.

---

### Task 3: 给四个 P4 页面增加 terminal summary 单次权威补读

**Files:**
- Modify: `src/状态/后端/use发现推荐委托轮询.ts`
- Modify: `src/状态/后端/use发现推荐委托轮询.test.tsx`
- Modify: `src/屏幕/看市场.tsx`
- Modify: `src/屏幕/看市场.test.tsx`
- Modify: `src/屏幕/职位详情.tsx`
- Modify: `src/屏幕/职位详情.test.tsx`
- Modify: `src/屏幕/候选推荐.tsx`
- Modify: `src/屏幕/候选推荐.test.tsx`
- Modify: `src/屏幕/匿名在线简历.tsx`
- Modify: `src/屏幕/匿名在线简历.test.tsx`

**Interfaces:**
- Consumes: `刷新(role, delegationId)` 已拥有 role/subject/session/scope generation fence、401 cleanup、404 clear 与 strict decode。
- Produces:

```ts
export interface 待恢复终态委托 {
  role: BFF角色;
  delegationId: string;
  state: 'refused' | 'failed';
}

export function use发现推荐委托轮询(input: {
  开启: boolean;
  委托: 可轮询委托[];
  待恢复终态?: 待恢复终态委托[];
  刷新: (role: BFF角色, delegationId: string) => Promise<void>;
  范围键?: string | null;
  间隔毫秒?: number;
}): ReadonlySet<string>;
```

- 每个 `开启+范围键` scope 对每个 terminal ID 最多一次 immediate GET；无 interval、无自动 retry。mark-before-call 防 rerender 重发；成功/失败都保留“已尝试”。scope change/unmount 清 set；operation fence 决定迟到结果能否提交。

- [ ] **Step 1: 写 hook RED tests**

在 `use发现推荐委托轮询.test.tsx` 加：

```tsx
it('terminal summary 缺 receipt 时立即补读一次，rerender 与时间推进都不重发', async () => {
  const 刷新 = vi.fn().mockResolvedValue(undefined);
  const terminal = [{ role: 'candidate' as const, delegationId: 'del_t1', state: 'failed' as const }];
  const page = renderHook((props: { items: typeof terminal }) => use发现推荐委托轮询({
    开启: true,
    委托: [],
    待恢复终态: props.items,
    刷新,
    范围键: 'int_1',
    间隔毫秒: 20,
  }), { initialProps: { items: terminal } });
  await waitFor(() => expect(刷新).toHaveBeenCalledTimes(1));
  page.rerender({ items: [...terminal] });
  await act(async () => { vi.advanceTimersByTime(100); });
  expect(刷新).toHaveBeenCalledTimes(1);
});

it('换 scope 后同 ID 可补读一次；旧 scope 迟到失败不污染新 scope', async () => {
  const first = deferred<void>();
  const 刷新 = vi.fn()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce(undefined);
  const item = [{ role: 'recruiter' as const, delegationId: 'del_t1', state: 'refused' as const }];
  const page = renderHook((scope: string) => use发现推荐委托轮询({
    开启: true, 委托: [], 待恢复终态: item, 刷新, 范围键: scope,
  }), { initialProps: 'job_1' });
  await waitFor(() => expect(刷新).toHaveBeenCalledTimes(1));
  page.rerender('job_2');
  await waitFor(() => expect(刷新).toHaveBeenCalledTimes(2));
  first.reject(new Error('late'));
  await act(async () => { await Promise.resolve(); });
  expect(刷新).toHaveBeenCalledTimes(2);
});

it('空 ID、关闭状态和非 terminal 输入不发补读', async () => {
  const 刷新 = vi.fn().mockResolvedValue(undefined);
  renderHook(() => use发现推荐委托轮询({
    开启: false,
    委托: [],
    待恢复终态: [{ role: 'candidate', delegationId: '', state: 'failed' }],
    刷新,
    范围键: 'int_1',
  }));
  await act(async () => { await Promise.resolve(); });
  expect(刷新).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行 hook RED**

```bash
npx vitest run src/状态/后端/use发现推荐委托轮询.test.tsx
```

Expected: FAIL；input 没有 `待恢复终态`，也没有 immediate one-shot effect。

- [ ] **Step 3: 实现 one-shot effect**

在 hook 内加入 refs 和稳定 key；不要改现有 active interval：

```ts
const 待恢复引用 = useRef(input.待恢复终态 ?? []);
待恢复引用.current = input.待恢复终态 ?? [];
const 已补读 = useRef<Set<string>>(new Set());
const 恢复键 = JSON.stringify(
  (input.待恢复终态 ?? []).map(({ role, delegationId, state }) => [role, delegationId, state]),
);

useEffect(() => {
  已补读.current = new Set();
  return () => {
    已补读.current = new Set();
  };
}, [开启, 范围键]);

useEffect(() => {
  if (!开启) return;
  for (const item of 待恢复引用.current) {
    if (item.delegationId === '') continue;
    const key = `${item.role}:${item.delegationId}`;
    if (已补读.current.has(key)) continue;
    已补读.current.add(key);
    void 刷新引用.current(item.role, item.delegationId).catch(() => undefined);
  }
}, [开启, 范围键, 恢复键]);
```

注意两个 effect 的声明顺序固定为 reset effect 在前、one-shot effect 在后，使同一 commit 的 React effect 顺序先清后读；active interval cleanup 继续只管理 active polling refs。

- [ ] **Step 4: 在四个页面传入 exact terminal candidates 并写页面 RED/GREEN tests**

每个页面从自己已经映射的 summary/receipt 生成 `待恢复终态`。列表页面使用以下完整 predicate，role 分别为 candidate/recruiter：

```ts
const 待恢复终态 = useMemo(
  () => 后端卡们.flatMap(({ 卡 }) => {
    const summary = 卡.delegation;
    if (summary === null || summary.delegation_id === '') return [];
    if (summary.state !== 'refused' && summary.state !== 'failed') return [];
    if (后端状态.P4委托回执?.[summary.delegation_id] !== undefined) return [];
    return [{
      role: 'candidate' as const,
      delegationId: summary.delegation_id,
      state: summary.state,
    }];
  }),
  [后端卡们, 后端状态.P4委托回执],
);
```

`候选推荐.tsx` 把 role 字面量改为 `recruiter`。两个详情页使用单项版本：

```ts
const 待恢复终态 = useMemo(() => {
  if (委托摘要 === null || 委托摘要.delegation_id === '') return [];
  if (委托摘要.state !== 'refused' && 委托摘要.state !== 'failed') return [];
  if (委托回执 !== null) return [];
  return [{
    role: 'candidate' as const,
    delegationId: 委托摘要.delegation_id,
    state: 委托摘要.state,
  }];
}, [委托摘要, 委托回执]);
```

`匿名在线简历.tsx` 把 role 改为 recruiter。四处 hook call 加 `待恢复终态`。

hook test 的 Testing Library import 同步加入 `waitFor`：

```ts
import { act, renderHook, waitFor } from '@testing-library/react';
```

在四个 screen test 文件各加一个用例，先把 summary 设为 terminal、receipt cache 设空，断言 `mock刷新委托` 在 `waitFor` 后恰好一次；rerender 后仍一次；cache 已有同 ID receipt 的 table case 断言零次。每个测试 fixture 的 receipt 必须包含七键和对应 code，不得用 partial `as` 绕 strict type：

```tsx
const failedReceipt: BFF委托回执 = {
  delegation_id: 'del_terminal', recommendation_id: 'rec_1', state: 'failed',
  evaluation_id: null, case_id: null, refusal_code: null,
  failure_code: 'delegation_agent_unavailable',
};
```

- [ ] **Step 5: 运行 GREEN 与提交**

```bash
npx vitest run src/状态/后端/use发现推荐委托轮询.test.tsx src/屏幕/看市场.test.tsx src/屏幕/职位详情.test.tsx src/屏幕/候选推荐.test.tsx src/屏幕/匿名在线简历.test.tsx
git add src/状态/后端/use发现推荐委托轮询.ts src/状态/后端/use发现推荐委托轮询.test.tsx src/屏幕/看市场.tsx src/屏幕/看市场.test.tsx src/屏幕/职位详情.tsx src/屏幕/职位详情.test.tsx src/屏幕/候选推荐.tsx src/屏幕/候选推荐.test.tsx src/屏幕/匿名在线简历.tsx src/屏幕/匿名在线简历.test.tsx
git commit -m "feat: recover terminal delegation reasons once"
```

Expected: PASS；active 两秒轮询、五次暂停、401/404 与 scope fence tests 保持通过，terminal 没有 interval retry。

---

### Task 4: 接入 P5 owner-safe `agent_attention`

**Files:**
- Modify: `src/数据/BFF契约.ts`（`BFFMatchCase视图`）
- Modify: `src/数据/招聘数据源/MatchCase.ts`
- Modify: `src/数据/招聘数据源/MatchCase.test.ts`
- Modify: `src/数据/MatchCase展示映射.ts`
- Modify: `src/数据/MatchCase展示映射.test.ts`
- Modify: `src/屏幕/P5/MatchCase列表.tsx`
- Modify: `src/屏幕/P5/MatchCase列表.module.css`
- Modify: `src/屏幕/P5/MatchCase列表.test.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.test.tsx`
- Modify: `src/屏幕/P5/MatchCase历史.test.tsx`
- Modify: `src/状态/后端/MatchCase统计.test.ts`
- Modify: `src/状态/后端/MatchCase操作.test.ts`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `src/屏幕/代理详情.test.tsx`
- Modify: `src/屏幕/企业代理详情.test.tsx`
- Modify: `src/屏幕/我的.test.tsx`
- Modify: `src/屏幕/企业我的.test.tsx`
- Modify: `src/屏幕/看市场.test.tsx`
- Modify: `e2e/数据源模式.spec.ts`

**Interfaces:**
- Consumes: optional non-null exact `{code,retryable}` only on `status='attention_required'`; code union `agent_unavailable|agent_result_invalid`; this release only admits literal `retryable:false` and no retry action/endpoint.
- Produces:

```ts
export type P5Agent注意码 = 'agent_unavailable' | 'agent_result_invalid';
export interface P5Agent注意 { code: P5Agent注意码; retryable: false }

export interface P5状态视图 {
  caseId: string;
  lifecycle: P5生命周期;
  stage: P5阶段;
  status: P5状态;
  step: P5步骤;
  round: number;
  roundBudget: number;
  needsUser: boolean;
  outcome: string | null;
  outcomeCode: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  agentAttention: P5Agent注意 | null;
}
```

- Both list/detail normal views add only `注意说明:string|null`。attention missing → `本阶段需要注意`; unavailable → `AI 服务暂时不可用，本 Case 尚未继续`; invalid → `本次 AI 结果无法安全用于推进 Case`。non-attention → null；是否需注意直接由 `注意说明 !== null` 推导，不保存第二个同源字段。

- [ ] **Step 1: 写 decoder RED tests**

在 `MatchCase.test.ts` 的 state decoder cases 加；沿用本文件已经导入的 `P5候选详情Wire`、`P5状态视图Wire` 和同步入口 `解P5详情`：

```ts
it.each(['agent_unavailable', 'agent_result_invalid'] as const)(
  'attention 解码合法 code %s',
  (code) => {
    const result = 解P5详情({
      ...P5候选详情Wire,
      state: {
        ...P5状态视图Wire,
        lifecycle: 'open', stage: 'resume_submission', status: 'attention_required',
        step: 'screening_resume', needs_user: false,
        agent_attention: { code, retryable: false },
      },
      needs_action: false,
      available_actions: [],
    }, 'candidate');
    expect(result.state.agentAttention).toEqual({ code, retryable: false });
  },
);

it.each([
  { code: 'future', retryable: false },
  { code: 'agent_unavailable', retryable: true },
  { code: 'agent_unavailable', retryable: false, task_id: 'secret' },
  null,
] as const)('非法 agent_attention %s fail closed', (agent_attention) => {
  expect(() => 解P5详情({
    ...P5候选详情Wire,
    state: {
      ...P5状态视图Wire,
      lifecycle: 'open', stage: 'resume_submission', status: 'attention_required',
      step: 'screening_resume', needs_user: false, agent_attention,
    },
    needs_action: false,
    available_actions: [],
  }, 'candidate')).toThrow(契约漂移);
});

it('非 attention 状态携带对象 fail closed；legacy attention 缺字段合法', () => {
  expect(() => 解P5详情({
    ...P5候选详情Wire,
    state: {
      ...P5状态视图Wire,
      agent_attention: { code: 'agent_unavailable', retryable: false },
    },
  }, 'candidate')).toThrow(契约漂移);

  const legacy = 解P5详情({
    ...P5候选详情Wire,
    state: {
      ...P5状态视图Wire,
      lifecycle: 'open', stage: 'resume_submission', status: 'attention_required',
      step: 'screening_resume', needs_user: false,
    },
    needs_action: false,
    available_actions: [],
  }, 'candidate');
  expect(legacy.state.agentAttention).toBeNull();
});
```

- [ ] **Step 2: 运行 decoder RED**

```bash
npx vitest run src/数据/招聘数据源/MatchCase.test.ts
```

Expected: FAIL；exact-key decoder 不认识 `agent_attention`，normalized DTO 无该字段。

- [ ] **Step 3: 实现 DTO 与 strict decoder**

在 `BFF契约.ts` 加：

```ts
export type BFFMatchCaseAgent注意码 = 'agent_unavailable' | 'agent_result_invalid';
export interface BFFMatchCaseAgent注意 {
  code: BFFMatchCaseAgent注意码;
  retryable: false;
}
```

并在 `BFFMatchCase视图` 加 `agent_attention?: BFFMatchCaseAgent注意`。在 `MatchCase.ts` 增加 Interfaces 中的 normalized types，并将 `解P5状态视图` 的 optional keys 改为 `['finalized_at', 'agent_attention']`。用下面 exact decoder：

```ts
const Agent注意码全表 = ['agent_unavailable', 'agent_result_invalid'] as const
  satisfies readonly P5Agent注意码[];

function 解Agent注意(input: unknown): P5Agent注意 {
  const raw = 要求闭合对象(input, ['code', 'retryable']);
  if (raw.retryable !== false) throw 契约错误();
  return { code: 要求枚举(raw.code, Agent注意码全表), retryable: false };
}
```

在 state decoder 内：

```ts
const agentAttention = raw.agent_attention === undefined ? null : 解Agent注意(raw.agent_attention);
if (agentAttention !== null && status !== 'attention_required') throw 契约错误();
```

return object 加 `agentAttention`。不要把 missing attention 当 decoder error。

`P5状态视图.agentAttention` 是必需的 normalized 列；把本 Task Files 中直接构造 normalized `P5状态视图` 的既有测试工厂/样本机械补成 `agentAttention: null`。不要将该字段改成 optional 来绕过 typecheck，也不要改变这些测试的业务语义。

- [ ] **Step 4: 写 mapping/UI RED tests**

在 `MatchCase展示映射.test.ts` 加 list/detail table，沿用该文件现有 `造状态`、`造列表项`、`造详情` helper：

```ts
it.each([
  [{ code: 'agent_unavailable', retryable: false } as const, 'AI 服务暂时不可用，本 Case 尚未继续'],
  [{ code: 'agent_result_invalid', retryable: false } as const, '本次 AI 结果无法安全用于推进 Case'],
  [null, '本阶段需要注意'],
])('attention 投影统一安全说明', (agentAttention, copy) => {
  const state = 造状态({
    lifecycle: 'open', stage: 'resume_submission', status: 'attention_required',
    step: 'screening_resume', needsUser: false, agentAttention,
  });
  expect(映射P5列表项(造列表项({ state }))).toMatchObject({
    kind: '正常', 注意说明: copy,
  });
  expect(映射P5详情(造详情({ state }))).toMatchObject({
    kind: '正常', 注意说明: copy,
  });
});

it('attention 行仍优先显示 viewer 待办归属', () => {
  const state = 造状态({
    lifecycle: 'open', stage: 'needs_coordination', status: 'attention_required',
    step: 'coordinating', needsUser: false,
    agentAttention: { code: 'agent_unavailable', retryable: false },
  });
  expect(映射P5列表项(造列表项({ state, needsAction: true }))).toMatchObject({
    kind: '正常', 待办: true, 注意说明: 'AI 服务暂时不可用，本 Case 尚未继续',
  });
});
```

在 `MatchCase列表.test.tsx` 和 `MatchCase详情.test.tsx` 各加入 candidate/recruiter parameterized render：`needsAction=false` 时断言 attention 说明在场、徽标是 `需注意`、`代理处理中` 缺席；`needsAction=true` 时断言徽标仍是 `需要你` 且说明仍在。两类都断言 `重试简历校验`/`重试校验` 与任何新增 Agent retry button 缺席；另用 `retry_resume_readiness` 的既有合法 S1 case 证明其原文案/operation 仍在。

- [ ] **Step 5: 实现展示映射和双屏 UI**

在 `MatchCase展示映射.ts` 加：

```ts
const Agent注意文案表 = {
  agent_unavailable: 'AI 服务暂时不可用，本 Case 尚未继续',
  agent_result_invalid: '本次 AI 结果无法安全用于推进 Case',
} as const satisfies Record<P5Agent注意码, string>;

function 映射Agent注意(state: P5状态视图): string | null {
  if (state.status !== 'attention_required') return null;
  return state.agentAttention === null
    ? '本阶段需要注意'
    : Agent注意文案表[state.agentAttention.code];
}
```

两个 normal view interface 增加 `注意说明`，两个 mapper return 加 `注意说明: 映射Agent注意(state)`。列表徽标替换为：

```tsx
function 待办徽标({ 待办, 注意说明 }: { 待办: boolean; 注意说明: string | null }) {
  const copy = 待办 ? '需要你' : 注意说明 !== null ? '需注意' : '代理处理中';
  const tone = 待办 || 注意说明 !== null ? 样式.徽标待办 : 样式.徽标代理;
  return <span className={`${样式.徽标} ${tone}`}>{copy}</span>;
}
```

列表 `阶段段` 状态头后加：

```tsx
{视图.注意说明 !== null ? (
  <div className={样式.注意说明}>{视图.注意说明}</div>
) : null}
```

CSS 只加：

```css
.注意说明 {
  margin-top: 8px;
  color: var(--次要);
  font-size: 12px;
  line-height: 1.5;
}
```

详情 header badge 同样以 `正常.待办 ? '需要你' : 正常.注意说明 !== null ? '需注意' : '代理处理中'` 计算；在正常详情主体状态行之后渲染同一 `正常.注意说明`，复用 `列表样式.注意说明`。不要增加任何 click handler 或 action。

- [ ] **Step 6: 运行 GREEN 与提交**

```bash
npx vitest run src/数据/招聘数据源/MatchCase.test.ts src/数据/MatchCase展示映射.test.ts src/屏幕/P5/MatchCase列表.test.tsx src/屏幕/P5/MatchCase详情.test.tsx src/屏幕/P5/MatchCase历史.test.tsx
npm run typecheck
git add src/数据/BFF契约.ts src/数据/招聘数据源/MatchCase.ts src/数据/招聘数据源/MatchCase.test.ts src/数据/MatchCase展示映射.ts src/数据/MatchCase展示映射.test.ts src/屏幕/P5/MatchCase列表.tsx src/屏幕/P5/MatchCase列表.module.css src/屏幕/P5/MatchCase列表.test.tsx src/屏幕/P5/MatchCase详情.tsx src/屏幕/P5/MatchCase详情.test.tsx src/屏幕/P5/MatchCase历史.test.tsx src/状态/后端/MatchCase统计.test.ts src/状态/后端/MatchCase操作.test.ts src/状态/应用状态.test.ts src/屏幕/代理详情.test.tsx src/屏幕/企业代理详情.test.tsx src/屏幕/我的.test.tsx src/屏幕/企业我的.test.tsx src/屏幕/看市场.test.tsx e2e/数据源模式.spec.ts
git commit -m "feat: show safe match case agent attention"
```

Expected: all PASS；history 未修改且 regression PASS；没有 Agent retry operation/action。

---

### Task 5: 接入 P6 failed proposal `failure_code`

**Files:**
- Modify: `src/数据/BFF契约.ts`
- Modify: `src/数据/招聘数据源/Agent规则.ts`
- Modify: `src/数据/招聘数据源/Agent规则.test.ts`
- Modify: `src/测试/BFF样本.ts`
- Modify: `src/组件/Agent规则提案卡.tsx`
- Modify: `src/组件/Agent规则提案卡.test.tsx`
- Modify: `src/状态/后端/Agent规则操作.test.ts`
- Modify: `src/屏幕/规则库.test.tsx`
- Modify: `src/屏幕/企业代理设置.test.tsx`

**Interfaces:**
- Consumes: optional non-null `failure_code: agent_unavailable|interpretation_failed` only on `state='failed'`; failed missing is legal legacy; initialization remains `interpreting|ready` only.
- Produces: `BFFAgent规则提案失败码` and optional `BFFAgent规则提案.failure_code`; shared card maps three safe failed messages; pages keep existing subject-scoped draft restore on close, never auto-submit.

- [ ] **Step 1: 写 decoder RED tests**

在 `Agent规则.test.ts` 加：

```ts
const 失败提案ID = 'arp_ffffffffffffffffffffffffffffffff';

it.each(['agent_unavailable', 'interpretation_failed'] as const)(
  'failed proposal 接受 failure_code=%s',
  async (failure_code) => {
    请求Mock.mockResolvedValue({
      result: { proposal_id: 失败提案ID, state: 'failed', failure_code },
      etag: null,
      requestId: 'failed-code',
    });
    await expect(数据源.读取Agent规则提案('candidate', 失败提案ID)).resolves.toEqual({
      proposal_id: 失败提案ID, state: 'failed', failure_code,
    });
  },
);

it('legacy failed 缺 code 合法', async () => {
  请求Mock.mockResolvedValue({
    result: { proposal_id: 失败提案ID, state: 'failed' }, etag: null, requestId: 'legacy-failed',
  });
  await expect(数据源.读取Agent规则提案('candidate', 失败提案ID)).resolves.toEqual({
    proposal_id: 失败提案ID, state: 'failed',
  });
});

it.each([
  { proposal_id: 失败提案ID, state: 'failed', failure_code: 'future' },
  { proposal_id: 失败提案ID, state: 'failed', failure_code: null },
  { proposal_id: 失败提案ID, state: 'interpreting', failure_code: 'agent_unavailable' },
  {
    proposal_id: 失败提案ID, state: 'ready', normalized_text: '规则',
    consequence: 'advisory', created_at: '2026-08-27T02:05:00Z',
    failure_code: 'interpretation_failed',
  },
] as const)('illegal proposal failure shape fail closed', async (result) => {
  请求Mock.mockResolvedValue({ result, etag: null, requestId: 'illegal-failure' });
  await expect(数据源.读取Agent规则提案('candidate', 失败提案ID)).rejects.toMatchObject({
    code: 'invalid_response',
  });
});
```

- [ ] **Step 2: 运行 decoder RED**

```bash
npx vitest run src/数据/招聘数据源/Agent规则.test.ts
```

Expected: FAIL；公开 key set 不接受 `failure_code`，wire type 无字段。

- [ ] **Step 3: 实现 P6 strict union**

在 `BFF契约.ts` 加：

```ts
export type BFFAgent规则提案失败码 = 'agent_unavailable' | 'interpretation_failed';

export interface BFFAgent规则提案 {
  proposal_id: string;
  state: BFFAgent规则提案状态;
  normalized_text?: string;
  consequence?: BFFAgent规则后果;
  created_at?: string;
  failure_code?: BFFAgent规则提案失败码;
}
```

在 `Agent规则.ts`：

```ts
const 提案失败码全表 = ['agent_unavailable', 'interpretation_failed'] as const
  satisfies readonly BFFAgent规则提案失败码[];
const 提案公开键 = new Set([
  'proposal_id', 'state', 'normalized_text', 'consequence', 'created_at', 'failure_code',
]);
```

`interpreting`/`ready` 分支都把 `'failure_code' in input` 视为契约错误；terminal 分支写成：

```ts
const receipt: BFFAgent规则提案 = { proposal_id, state };
if ('normalized_text' in input) receipt.normalized_text = 要求字符串(input.normalized_text);
if ('consequence' in input) receipt.consequence = 要求枚举(input.consequence, 后果全表);
if ('created_at' in input) receipt.created_at = 要求日期(input.created_at);
if ('failure_code' in input) {
  if (state !== 'failed') throw 契约错误();
  receipt.failure_code = 要求枚举(input.failure_code, 提案失败码全表);
}
return receipt;
```

在 samples 加：

```ts
export const BFFAgent规则失败提案样本: BFFAgent规则提案 = {
  proposal_id: 'arp_ffffffffffffffffffffffffffffffff',
  state: 'failed',
  failure_code: 'agent_unavailable',
};
```

- [ ] **Step 4: 写共享卡与双页 RED tests**

在 `Agent规则提案卡.test.tsx` 加：

```tsx
it.each([
  ['agent_unavailable', 'AI 暂时不可用，本次规则没有生效'],
  ['interpretation_failed', '内容无法可靠转换为规则，可编辑后重新提交'],
  [undefined, '本次规则没有生效'],
] as const)('failed code %s 使用安全文案', (failure_code, copy) => {
  render(<Agent规则提案卡
    提案={{ proposal_id: 'arp_ffffffffffffffffffffffffffffffff', state: 'failed', failure_code }}
    忙={false}
    接受={vi.fn()}
    放弃={vi.fn()}
    关闭失败={vi.fn()}
  />);
  expect(screen.getByText(copy)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '确认规则' })).toBeNull();
});
```

在 `Agent规则操作.test.ts` 的 `刷新Agent规则提案` cases 加：

```ts
it('failed+code 原位保存，不刷新或新增 active Rules', async () => {
  const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
  const failed = {
    proposal_id: 'arp_ffffffffffffffffffffffffffffffff',
    state: 'failed' as const,
    failure_code: 'agent_unavailable' as const,
  };
  vi.mocked(环境.数据源.读取Agent规则提案).mockResolvedValue(failed);
  const 操作 = 创建Agent规则操作(环境.deps);
  const before = 环境.页面状态.current.全局规则;
  await 操作.刷新Agent规则提案(failed.proposal_id);
  expect(环境.最新后端状态().候选规则提案[failed.proposal_id]).toEqual(failed);
  expect(环境.数据源.读取Agent规则).not.toHaveBeenCalled();
  expect(环境.页面状态.current.全局规则).toBe(before);
});
```

在两个 page test 现有“closing a failed card restores…”用例里，把镜头中的 failed proposal 加 `failure_code: 'interpretation_failed' as const`，把失败文案期望改成 `内容无法可靠转换为规则，可编辑后重新提交`。提交原草稿后先断言 create 调用是一次；关闭 failed 卡、草稿恢复后再断言仍是一次，证明没有自动重发。不要修改 page product code，现有 `关闭失败卡` 应在 shared card GREEN 后直接通过。

- [ ] **Step 5: 实现共享失败文案**

先把该文件的 type import 增加 `BFFAgent规则提案失败码`，再加：

```ts
export const Agent规则失败文案: Record<BFFAgent规则提案失败码, string> = {
  agent_unavailable: 'AI 暂时不可用，本次规则没有生效',
  interpretation_failed: '内容无法可靠转换为规则，可编辑后重新提交',
};
```

failed branch 的正文替换为：

```tsx
<div className={样式.后果}>
  {提案.failure_code === undefined
    ? '本次规则没有生效'
    : Agent规则失败文案[提案.failure_code]}
</div>
```

不修改 `Agent规则操作.ts`、`useAgent规则提案轮询.ts`、`规则库.tsx` 或 `企业代理设置.tsx`；类型传播和 draft restore 已由现有对象存储/共享卡/页面回调完成，测试负责钉住不回归。

- [ ] **Step 6: 运行 GREEN 与提交**

```bash
npx vitest run src/数据/招聘数据源/Agent规则.test.ts src/组件/Agent规则提案卡.test.tsx src/状态/后端/Agent规则操作.test.ts src/状态/后端/useAgent规则提案轮询.test.tsx src/屏幕/规则库.test.tsx src/屏幕/企业代理设置.test.tsx
npm run typecheck
git add src/数据/BFF契约.ts src/数据/招聘数据源/Agent规则.ts src/数据/招聘数据源/Agent规则.test.ts src/测试/BFF样本.ts src/组件/Agent规则提案卡.tsx src/组件/Agent规则提案卡.test.tsx src/状态/后端/Agent规则操作.test.ts src/屏幕/规则库.test.tsx src/屏幕/企业代理设置.test.tsx
git commit -m "feat: explain failed agent rule proposals"
```

Expected: PASS；failed 不进入 active rules、没有自动重发，existing interpreting/ready/accept/dismiss tests 不回归。

---

### Task 6: 在现有真实后端 runner 增加显式 `hosted-agent` journey

**Files:**
- Create: `e2e/真实后端/旅程/HostedAgent闭环.sh`
- Modify: `e2e/真实后端/类型.ts`
- Modify: `e2e/真实后端/报告.test.ts`
- Modify: `e2e/真实后端/视觉/场景清单.ts`
- Modify: `e2e/真实后端/运行整栈验收.sh`
- Modify: `e2e/真实后端/运行整栈验收.test.sh`

**Interfaces:**
- Consumes: 现有 `公共步骤.sh` 的 isolated login、semantic click/wait、failure fragment、privacy scan、fixture ownership 与 runner preflight。新旅程不新增截图 scene、不读 network body、不保存 raw ID；server Case ID 只存在于浏览器 URL 与内存，不进入 fragment。
- Produces: `旅程ID` 增加 `'hosted-agent'`；selector 接受 `--journey hosted-agent`；报告 universe 六条、视觉映射该 journey 为 `[]`；真实命令 `npm run test:agent-browser:backend-local -- --journey hosted-agent`。
- Runner default `all` 仍是原五条 CRUD/隔离验收，避免普通 backend-local gate 隐式消费真实 LLM；`hosted-agent` 只能显式选择。报告 universe 使用 `ALL_JOURNEYS` 六条，default selection 使用 `DEFAULT_JOURNEYS` 五条。
- Safe-failure fixture 未交付，不在该 script 中制造失败状态；script 只编码 happy path。当前 official cleanup 尚不拥有 Agent rule/delegation/MatchCase，因此本 Task 只跑隔离的 unit/shell runner contract；不得提前真跑此 journey。后端 fixture ownership 前置补齐后，Terminal Integration Task 才准入真实 Provider 运行。

- [ ] **Step 1: 写 runner/report RED contract tests**

在 `类型.ts` 预期变更对应的 `报告.test.ts` 所有 hard-coded 全部旅程数组加入 `'hosted-agent'`，`写全部跳过`/完整报告断言期望第六个 skipped/pass row。在 `运行整栈验收.test.sh` 现有 `write_fake_journey` 的 basename case 增加：

```bash
  HostedAgent闭环.sh) J='hosted-agent'; ROLE='candidate'; SCENES='' ;;
```

四个现有 `write_fake_journey` 调用之后追加：

```bash
write_fake_journey HostedAgent闭环.sh
```

现有「单选一条旅程通过」的断言同步从“四条未选旅程”改成“五条未选旅程”，期望数量从 `4` 改成 `5`；其它默认运行用例仍只会得到五条 pass/failed/blocked 与一条 hosted-agent skipped，不要机械把业务运行数改成六。

在现有「单选一条旅程通过」用例附近加两条 runner cases，逐字使用本文件已有 `reset_case`、`setup_baseline`、`run_runner`、`RC`、`assert_contains`、`assert_missing`、`assert_eq` 和 `report_json`：

```bash
testcase '显式 hosted-agent 只运行 Hosted Agent 旅程'
reset_case; setup_baseline
run_runner --journey hosted-agent
assert_eq 'hosted-agent 退出码' "$RC" '0'
assert_contains '运行 Hosted Agent 旅程' 'journey hosted-agent' "$CALLS"
assert_missing '不运行 candidate CRUD' 'journey candidate-crud' "$CALLS"
assert_eq 'hosted-agent 记 pass' \
  "$(jq -r '.journeys[]|select(.journey=="hosted-agent")|.status' "$(report_json)" 2>/dev/null)" 'pass'
assert_eq '原五条均 skipped' \
  "$(jq -r '[.journeys[]|select(.status=="skipped")]|length' "$(report_json)" 2>/dev/null)" '5'

testcase '默认 all 保持原五条，不隐式运行真实 Provider 旅程'
reset_case; setup_baseline
run_runner
assert_eq '默认 all 退出码' "$RC" '0'
assert_missing '默认不运行 hosted-agent' 'journey hosted-agent' "$CALLS"
assert_eq 'hosted-agent 记 skipped' \
  "$(jq -r '.journeys[]|select(.journey=="hosted-agent")|.status' "$(report_json)" 2>/dev/null)" 'skipped'
assert_eq '原五条保持 pass' \
  "$(jq -r '[.journeys[]|select(.status=="pass")]|length' "$(report_json)" 2>/dev/null)" '5'
```

- [ ] **Step 2: 运行 RED**

```bash
npm run test:agent-browser:unit
npm run test:agent-browser:shell
```

Expected: FAIL；`旅程ID`、视觉 Record、selector、fake runner 均没有 hosted-agent。

- [ ] **Step 3: 实现 catalog/dispatcher 最小增量**

`类型.ts` 精确改为：

```ts
export type 旅程ID =
  | 'candidate-load'
  | 'candidate-crud'
  | 'recruiter-load'
  | 'recruiter-crud'
  | 'session-isolation'
  | 'hosted-agent';

export const 旅程们: readonly 旅程ID[] = [
  'candidate-load',
  'candidate-crud',
  'recruiter-load',
  'recruiter-crud',
  'session-isolation',
  'hosted-agent',
];
```

`视觉/场景清单.ts` Record 加 `'hosted-agent': []`。runner 顶部改为：

```bash
ALL_JOURNEYS='candidate-load candidate-crud recruiter-load recruiter-crud session-isolation hosted-agent'
DEFAULT_JOURNEYS='candidate-load candidate-crud recruiter-load recruiter-crud session-isolation'
```

usage/validation 加 `hosted-agent`；`all) SELECTED="$DEFAULT_JOURNEYS"`。`journey_script()` 加：

```bash
hosted-agent) printf '%s' "$ROOT_DIR/旅程/HostedAgent闭环.sh" ;;
```

现有 skipped initialization 仍遍历 `ALL_JOURNEYS`，因此默认 report 有 hosted-agent skipped row；主调度 default branch 直接 `run_journey`。不让 hosted-agent 参与 CRUD precondition 或 session-isolation dependency。

- [ ] **Step 4: 写 Hosted Agent browser journey**

新 shell 文件必须是 Bash 3.2-compatible，并使用这个完整骨架；业务文字允许只取公开 UI 文案，禁止输出变量内的 rule/case/raw response：

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
. "$ROOT_DIR/公共步骤.sh"

JOURNEY='hosted-agent'
MILESTONE='候选登录'
RULE_TEXT='优先考虑支持混合办公并且周末双休的岗位'
RESUME_NAME='浏览器验收临时简历.pdf'
TEMP_PDF_DIR="$(dirname "$PRIVATE_JOURNAL")"

on_exit(){
  local rc=$?
  trap - EXIT
  if [ "$rc" -ne 0 ] && [ "$FRAGMENT_WRITTEN" = '0' ]; then
    capture_failure_snapshot "$JOURNEY"
    write_journey_failure "$JOURNEY" "$MILESTONE" || true
  fi
  if [ "$rc" -ne 0 ] && [ "$JOURNEY_BLOCKED" = '1' ]; then rc=75; fi
  exit "$rc"
}
trap on_exit EXIT

wait_one_of(){
  local first="$1" second="$2" tries=0 body
  while [ "$tries" -lt 180 ]; do
    body="$(ab get text body 2>/dev/null || printf '')"
    case "$body" in
      *"$first"*|*"$second"*) return 0 ;;
    esac
    tries=$((tries + 1))
    sleep 1
  done
  echo "等待公开终态超时：${first} / ${second}" >&2
  return 1
}

candidate_rule_count_once(){
  local body count
  body="$(ab get text body 2>/dev/null || printf '')"
  count="$(printf '%s\n' "$body" | sed -n 's/.*\([0-9][0-9]*\) 条.*/\1/p' | head -n 1)"
  [ -n "$count" ] || return 1
  printf '%s' "$count"
}

candidate_rule_count(){
  local tries=0 count
  while [ "$tries" -lt 30 ]; do
    count="$(candidate_rule_count_once 2>/dev/null || printf '')"
    if [ -n "$count" ]; then printf '%s' "$count"; return 0; fi
    tries=$((tries + 1))
    sleep 1
  done
  echo '规则页水合后仍未出现 active rule 计数' >&2
  return 1
}

wait_candidate_rule_count(){
  local expected="$1" tries=0 actual
  while [ "$tries" -lt 60 ]; do
    actual="$(candidate_rule_count_once 2>/dev/null || printf '')"
    if [ "$actual" = "$expected" ]; then return 0; fi
    tries=$((tries + 1))
    sleep 1
  done
  echo "等待 active rule 数量变为 ${expected} 超时" >&2
  return 1
}

wait_pdf_parse(){
  local tries=0 body
  while [ "$tries" -lt 180 ]; do
    body="$(ab get text body 2>/dev/null || printf '')"
    case "$body" in
      *'识别完成'*) return 0 ;;
      *'未能读取 · 可重试'*|*'内容过多 · 请替换'*|*'识别失败 · 可重试'*|*'服务繁忙 · 稍后重试'*)
        echo 'PDF 解析进入公开失败终态' >&2
        return 1 ;;
    esac
    tries=$((tries + 1))
    sleep 1
  done
  echo '等待 PDF 解析公开终态超时' >&2
  return 1
}

wait_rule_proposal_ready(){
  local tries=0 body
  while [ "$tries" -lt 180 ]; do
    body="$(ab get text body 2>/dev/null || printf '')"
    case "$body" in
      *'确认规则'*) return 0 ;;
      *'AI 暂时不可用，本次规则没有生效'*|*'内容无法可靠转换为规则，可编辑后重新提交'*|*'本次规则没有生效'*)
        echo 'P6 规则解释进入公开失败终态' >&2
        return 1 ;;
    esac
    tries=$((tries + 1))
    sleep 1
  done
  echo '等待 P6 规则解释公开终态超时' >&2
  return 1
}

# P6：candidate natural-language proposal -> ready -> accept -> authoritative active rule.
export AGENT_BROWSER_SESSION="$CANDIDATE_SESSION"
login_candidate
MILESTONE='P6 提交规则'
click_after_hydrate '我'
click_after_hydrate 'AI代理规则库'
RULE_COUNT_BEFORE="$(candidate_rule_count)"
RULE_COUNT_AFTER=$((RULE_COUNT_BEFORE + 1))
click_button '手动添加规则'
find_retry placeholder '例：不接受大小周的岗位直接过滤' fill "$RULE_TEXT" >/dev/null
click_button_exact '提交给AI代理理解'
assert_text 'AI代理正在理解这条规则…'
MILESTONE='P6 等待就绪'
wait_rule_proposal_ready
assert_text '确认规则'
click_button_exact '确认规则'
wait_candidate_rule_count "$RULE_COUNT_AFTER"
ab reload >/dev/null
wait_candidate_rule_count "$RULE_COUNT_AFTER"

# Candidate PDF：上传 consented PDF，等待真实 parse succeeded 的公开文案。
MILESTONE='上传并解析 PDF'
click_back
click_after_hydrate '我'
click_after_hydrate '我的简历'
cp "$ROOT_DIR/资源/简历-v1.pdf" "$TEMP_PDF_DIR/$RESUME_NAME"
click_button_exact '添加附件简历'
ab upload 'input[type="file"]' "$TEMP_PDF_DIR/$RESUME_NAME" >/dev/null
assert_text '允许 AI 识别这份简历？'
click_button_exact '同意并继续'
record_cleanup_marker candidate_resume_file_names "$RESUME_NAME"
wait_pdf_parse
assert_text '识别完成'

# P4：candidate market delegation -> server case_started -> open real MatchCase.
MILESTONE='P4 发起 candidate delegation'
click_back
click_after_hydrate '职位'
click_button_exact '市场'
wait_one_of '让AI代理去谈' '让AI代理帮我搜'
if on_screen '让AI代理帮我搜'; then
  click_button_exact '让AI代理帮我搜'
  wait_text '让AI代理去谈'
fi
click_button '让AI代理去谈'
wait_one_of '选择这次提交的简历' '确认委托AI代理？'
if on_screen '选择这次提交的简历'; then
  find_retry role radio click --name "$RESUME_NAME" >/dev/null
  click_button_exact '确认并委托'
fi
assert_text '确认委托AI代理？'
click_button_exact '确认委托'
MILESTONE='P4 等待开案'
wait_one_of '查看进展' '本次委托未完成'
assert_text '查看进展'
click_button_exact '查看进展'
assert_text '匿名初筛'
CANDIDATE_CASE_URL="$(ab get url)"
case "$CANDIDATE_CASE_URL" in
  *'#/deal/'*) : ;;
  *) echo '查看进展没有进入 candidate Case 深链' >&2; exit 1 ;;
esac

# Candidate 侧完成当前公开动作；补问存在时回答，否则按 S0 可用动作继续。
MILESTONE='candidate target 完成'
wait_one_of '回答问题' '继续初筛'
if ab wait '[aria-label="回答问题"]' >/dev/null 2>&1; then
  find_retry label '回答问题' fill '我有 React 与 TypeScript 的真实项目经验，可以接受混合办公。' >/dev/null
  click_button_exact '提交回答'
fi
wait_one_of '继续初筛' '接受邀请'
if on_screen '继续初筛'; then click_button_exact '继续初筛'; fi

# Recruiter 读取同一 Case；screen_resume 是 recruiter-target Hosted Agent task。
MILESTONE='招聘方读取同一 Case'
export AGENT_BROWSER_SESSION="$RECRUITER_SESSION"
login_recruiter
click_after_hydrate '人才'
click_button_exact '在谈'
wait_text '匿名初筛'
click_button '匿名初筛'
wait_one_of '通过初筛' '招聘方 AI 正在初筛已提交简历'

# Candidate 接受简历邀请并提交同一 PDF；公开 readiness 推动 recruiter screen_resume。
MILESTONE='candidate 提交简历'
export AGENT_BROWSER_SESSION="$CANDIDATE_SESSION"
ab reload >/dev/null
wait_one_of '接受邀请' '确认递交'
if on_screen '接受邀请'; then click_button_exact '接受邀请'; fi
if on_screen '选择这次递交的简历'; then
  find_retry role radio click --name "$RESUME_NAME" >/dev/null
  click_button_exact '选定这份'
fi
assert_text '确认递交这份简历？'
click_button_exact '确认递交'

MILESTONE='recruiter target screen_resume 完成'
export AGENT_BROWSER_SESSION="$RECRUITER_SESSION"
ab reload >/dev/null
wait_one_of '通过初筛' '本次 AI 结果无法安全用于推进 Case'
assert_text '通过初筛'
click_button_exact '通过初筛'

# 至少一轮 coordination/confirmation；两端各完成公开可用动作，随后硬刷新确认权威状态。
MILESTONE='双方推进协调'
wait_one_of '接受' '确认意向'
if on_screen '接受'; then click_button_exact '接受'; fi
if on_screen '确认意向'; then click_button_exact '确认意向'; fi
ab reload >/dev/null
assert_no_mock_data

export AGENT_BROWSER_SESSION="$CANDIDATE_SESSION"
ab reload >/dev/null
wait_one_of '回应协同事项' '确认意向'
if on_screen '接受'; then click_button_exact '接受'; fi
if on_screen '确认意向'; then click_button_exact '确认意向'; fi
ab reload >/dev/null
assert_no_mock_data

# 直接打开先前保存的公开 Case URL，不依赖列表内存；深链重进后仍由后端详情水合。
MILESTONE='candidate Case 深链重进'
ab open "$CANDIDATE_CASE_URL" >/dev/null
assert_text '匿名初筛'
assert_no_mock_data

MILESTONE='完成'
write_journey_result "$JOURNEY" pass "$MILESTONE"
```

在落地前机械核对 UI 当前公开解析终态文案：`附件状态文案.succeeded` 必须逐字是 `识别完成`；若最新主干只改了该公开文案而没有改变状态/动作合同，可把脚本字面量同步为新文案并在同 commit 更新 shell contract test，这属于现场校准而非新设计。其它流程分支、action 或 fixture 前提变化属于 dependency drift，必须停下重规划。

- [ ] **Step 5: 运行 shell/unit GREEN 与提交**

```bash
chmod +x e2e/真实后端/旅程/HostedAgent闭环.sh
bash -n e2e/真实后端/旅程/HostedAgent闭环.sh e2e/真实后端/运行整栈验收.sh e2e/真实后端/运行整栈验收.test.sh
npm run test:agent-browser:unit
npm run test:agent-browser:shell
npm run typecheck
git add e2e/真实后端/旅程/HostedAgent闭环.sh e2e/真实后端/类型.ts e2e/真实后端/报告.test.ts e2e/真实后端/视觉/场景清单.ts e2e/真实后端/运行整栈验收.sh e2e/真实后端/运行整栈验收.test.sh
git commit -m "test: add hosted agent backend journey"
```

Expected: all isolated gates PASS；本 Task 不运行真实 Provider journey，不产生 L3 evidence。

---

### Task 7: 异构实现 review、唯一 plan-scope gate 与 Plan Handoff 草稿

**Files:**
- No repository product changes expected.
- Write outside repo: manifest 分配的唯一 Plan Handoff path。

**Interfaces:**
- Consumes: Tasks 1–6 clean commits、manifest v5 的 execution revision/SHA/L3 selection、当前分支 clean state。
- Produces: Claude reviewer clean verdict；authoritative plan-scope evidence；完整 v5 Plan Handoff 草稿。真实 `hosted-agent` 写 `INTEGRATION_REQUIRED/BLOCKED_BY_BACKEND_FIXTURE_OWNERSHIP`，三条安全失败 browser cases 写 `BLOCKED_BY_BACKEND_FIXTURE` 而不是 PASS。

- [ ] **Step 1: 核对实现 diff 与 clean state**

```bash
git status --short
git diff --check origin/main...HEAD
git log --oneline --decorate origin/main..HEAD
```

Expected: status empty；只有批准范围的 P4/P5/P6/E2E files；无 whitespace errors。

- [ ] **Step 2: 运行异构 code review 并处理 findings**

调用当前 Codex 可用的 `claude-review-loop`，scope 为 `origin/main...HEAD`，审查 correctness、strict contracts、privacy/fences、测试充分性与不必要复杂度。逐条使用 `superpowers:receiving-code-review` 核实；所有 valid required findings 与低风险 minor 一并修复、定向验证、提交；对无证据增加复杂度的建议记录拒绝理由。继续同一 review session 直到 clean 或达到 review-loop 上限。

Expected: reviewer 最终 clean；若 required finding 无法在批准 Spec 内解决，写 `implementation_status: NOT_READY` 并停止，不运行权威门。

- [ ] **Step 3: 运行唯一 authoritative plan-scope gate**

```bash
npm run test && npm run typecheck && npm run lint && npm run build && npm run test:agent-browser:unit && npm run test:agent-browser:shell
```

Expected: 全部 PASS。任何失败先按 test/environment/flaky/product 分类；修复改变 candidate commit 后重跑受影响定向 test，再从头运行这一个权威组合命令。不要把早期 Task tests 冒充权威 PASS。

- [ ] **Step 4: 写并复读 v5 Plan Handoff**

Handoff 使用 manifest 分配的绝对路径与 v5 schema，至少写：实际 branch/commit/worktree/base、`implementation_status: READY`、`implementation_gap: none`、`plan_scope_validation.status: PASS`、每条 tests_run 的 category/command/commit/evidence、review summary、manifest 冻结的完整 L3 selection、`integration_requirement: required`、`release_handoff.required:false`、`dependency_drift:none`。performance observation 只在真实触发阈值/selection warning 时写，不猜时长或 receipt。

Expected: 文件可重新解析，commit 可解析，worktree clean；`hosted-agent` 是 `INTEGRATION_REQUIRED/BLOCKED_BY_BACKEND_FIXTURE_OWNERSHIP`，safe-failure browser fixture gap 只记外部 E2E blocker，不误写为产品 implementation gap。

---

### Terminal Integration Task: 用户批准后同步 target、运行最终 L0–L3 并普通 push

**Files:**
- Write outside repo: manifest 分配的 admission sidecar、`integration-ledger.md`、`integration-result.md`。
- No new product behavior; only mechanical merge/conflict repair, test evidence, structured result and push.

**Interfaces:**
- Consumes: Task 7 的 clean implementation commit、PASS plan-scope evidence、完整 Plan Handoff、manifest target `origin/main`、static explicit L3 case `hosted-agent`。
- Produces: final candidate generation ledger；结构性 admission sidecar；同步后最终 L0–L3 evidence；普通 fast-forward push；仅 push 成功后写 `integration_status: PASS` 与 `release_verdict: PENDING`。

- [ ] **Step 1: 展示人工 final gate 并停止等待明确批准**

向用户展示：target ref `origin/main`、当前观察到的 target HEAD、candidate branch/worktree/HEAD、Task 7 authoritative PASS、获批后将执行的 merge、最终 authoritative gate、真实 `hosted-agent` L3 和普通非强制 push。提醒“本次完成前不要批准另一个面向同一 target 的 final gate”。未获明确批准不得 fetch/merge、运行最终 gate、真实 L3 或 push。

- [ ] **Step 2: 获批后 fetch 并 merge，不 rebase**

```bash
git fetch origin main
TARGET_HEAD="$(git rev-parse origin/main)"
git merge --no-edit "$TARGET_HEAD"
git status --short
```

Expected: mechanical clean merge and empty status。冲突若涉及 schema、UI action、runner semantics 或新产品判断，停止并报告；不得猜测。每次 HEAD 变化在 ledger 增加 `candidate_generation`。

- [ ] **Step 3: 重算 final diff/fingerprints 与 L3 selection**

```bash
git diff --name-only "$TARGET_HEAD"...HEAD
git diff --check "$TARGET_HEAD"...HEAD
```

Expected: actual diff 仍落在批准范围，L3 仍为 explicit `[hosted-agent]`。如果 intervening target/merge repair 触及 suite 顶层 selection algorithm、catalog schema/parser、shared setup/cleanup 或 global evidence infrastructure，把该 suite 重分类为 `suite-infrastructure` 并按 current catalog 运行 required Case Set；这是最终 candidate 独立集成触发，不改写 Plan 静态 selection。无法证明 selection 时 fail closed，不运行模糊 all-L3。

- [ ] **Step 4: 运行最终 authoritative L0–L2 gate**

```bash
npm run test && npm run typecheck && npm run lint && npm run build && npm run test:agent-browser:unit && npm run test:agent-browser:shell
```

Expected: PASS on final merged candidate。merge/repair 后不得复用旧 commit 的 Task 7 PASS。

- [ ] **Step 5: 串行运行真实 Hosted Agent L3**

先只读确认后端精确 commit、real health，以及 official browser fixture receipt/cleanup 已显式拥有 Agent rule、delegation 与 MatchCase（或后端 Handoff 明确给出每轮唯一隔离数据）。当前冻结 `f69fcec265cf634508d6e3236d85e7eeb74d9b37` 不满足最后一项；如果执行时仍未补齐，唯一处置是写 `integration-result.md` 为 `integration_status: BLOCKED`、`release_verdict: PENDING`、原因 `BLOCKED_BY_BACKEND_FIXTURE_OWNERSHIP`，保留 candidate branch/worktree 并向用户返回，不启动旅程、不写 admission PASS、不 push。后端补齐后可从本 Terminal Task Step 2 重新 fetch/merge 并重跑最终 gates；若用户要在 L3 缺席时仍集成，必须由 planning owner 修改本 Plan/manifest cadence 后重新审查，执行者不得临场降级：

```bash
git -C /Users/visionclaw/agxp-monorepo rev-parse HEAD
rg -n 'agent_rule|delegation|match_case' /Users/visionclaw/agxp-monorepo/apps/recruitment/scripts/browser-fixture.sh
/Users/visionclaw/agxp-monorepo/apps/recruitment/scripts/dev-local.sh health --llm-mode real
npm run test:agent-browser:backend-local -- --journey hosted-agent
```

Expected: backend HEAD 是已校准 release 后继且包含冻结提交；fixture ownership probe 明确命中 receipt、delta reconciliation 与 cleanup，而不只是产品代码里的同名字样；health PASS；runner exit 0，report classification PASS，只有 hosted-agent selected/pass，其它 journey skipped，P6 active rule、candidate-target Case、recruiter-target `screen_resume`、至少一轮双端推进和 refresh/deep-link 权威终态均由公开 UI 证明。环境前置缺失写 `ENV_BLOCKED`，公开终态/合同失败写 `PRODUCT_BLOCKED`，evidenced 摆动写 `FLAKY`；任何非 PASS 都不得继续 push。

三条真实失败场景没有安全 backend browser fixture，继续在 ledger/result 写：

```yaml
safe_failure_browser_cases:
  status: BLOCKED_BY_BACKEND_FIXTURE
  cases: [p4_agent_failure, p5_agent_attention, p6_failed_proposal]
  owner: recruitment-backend
  unblock_condition: owner-safe selectable fixture is shipped and official cleanup converges it
```

这不是 happy-path PASS，也不得被写成已运行。

- [ ] **Step 6: 写结构性 admission、再次核对 target 并普通 push**

单 Plan 没有 downstream consumer，admission sidecar 原子写：

```yaml
admission_version: 1
plan_id: hosted-agent-failure-contracts-frontend
upstream_commit: <final candidate SHA>
status: BLOCKED
validation_status: PASS
known_gaps: []
allowed_downstream: []
release_effect: none
updated_at: <current RFC3339 timestamp>
```

这里的 BLOCKED 只表示没有下游 consumer，ledger/result 记录 `admission: N/A`，不阻断 final gate/push。随后：

```bash
git fetch origin main
test "$(git rev-parse origin/main)" = "$TARGET_HEAD"
git push origin HEAD:main
```

Expected: target 未移动，normal fast-forward push succeeds；不得 force push。若 target 移动或 push race 被拒绝，立即停止，不自动追赶，保留仍匹配 fingerprint 的 evidence，重新展示人工 final gate 并等待再次批准。

- [ ] **Step 7: push 成功后定稿 ledger/result**

`integration-result.md` 记录 target base、final generation/HEAD、input/review/repair commits、每项 L0–L3 command/result/evidence、PASS reuse/失效原因、safe-failure blocker、admission N/A、push SHA/result：

```yaml
integration_status: PASS
release_verdict: PENDING
```

任何 BLOCKED、FLAKY、NOT_SELECTED、soft observation 或未运行项不得写成 PASS。最终确认 repo worktree clean、Handoff/sidecar/ledger/result 四个运行期文件存在且字段完整。
