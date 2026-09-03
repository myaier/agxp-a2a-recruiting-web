# Hosted Agent 失败合同前端接线与真实 E2E 设计

**日期：** 2026-09-03

**状态：** 已确认，等待书面规格复核

## 1. 结论与基线

本设计消费 Hosted Agent 后端已经合并的三个公开失败合同增量，并在现有 P4/P5/P6 链路中做最小严格接线：

1. P4 delegation 分开业务拒绝与 Hosted Agent 执行失败；
2. P5 `attention_required` 可携带 owner-safe `agent_attention`；
3. P6 failed proposal 可携带 owner-safe `failure_code`；
4. 在真实后端 agent-browser 验收中增加 Hosted Agent happy-path 旅程。

校准基线：

- 前端工作分支：`handoff/hosted-agent-failure-contracts@7f8f0df2b47d764e1749d16eb8316c59091cf37d`
- 调查时前端 `origin/main`：`a99c348d78d5d31ecd2254710758877973e78441`
- 后端：`release/0.2.5@f69fcec265cf634508d6e3236d85e7eeb74d9b37`
- 后端身份核心提交：`68844cab3`
- 后端 Local AI Runtime 提交：`54adf892a`
- 后端失败合同主体、BFF strict projection 与最终修正：`fe5006919`、`ab198f455`、`f69fcec26`
- 前端运行模式：`VITE_DATA_SOURCE=backend`

实现前必须从最新前端主干重校准实际 diff，但后端字段、枚举和矩阵以以上 release 提交的两份 OpenAPI、BFF decoder 与 fixture 为准，不从数据库内部状态设计 UI。

## 2. 现状与实际差异

### 2.1 P4

当前前端 delegation receipt：

- `state` 仍允许 `null`；
- 没有 `failure_code`；
- refusal union 缺少 `recommendation_stale`；
- strict decoder 只接受旧六键；
- operation 只执行部分状态坐标检查；
- UI 只能显示业务 refusal 或通用状态，不能区分 Agent unavailable、evaluation failure 与 generic failure。

后端 `DiscoveryDelegationSummary` 仍只有 `delegation_id/state/case_id`，没有 refusal/failure code。因此刷新推荐卡后，只有通过 row-backed `delegation_id` 单项读取 receipt 才能恢复精确 terminal 原因。

### 2.2 P5

当前 MatchCase exact-key decoder 不认识 `agent_attention`。现有 17 行展示矩阵能够约束 status/step/actions，但 `attention_required` 只有通用“需注意”，列表还可能显示“代理处理中”。现有 `retry_resume_readiness` 是 PDF parse/readiness 命令，不是 Agent task retry。

### 2.3 P6

当前 proposal decoder 和共享卡片不认识 `failure_code`，所有 failed proposal 都显示同一“无法理解”文案。当前初始化只水合 `interpreting` 与 `ready`；failed 只可能由本次创建、单项恢复或轮询结果进入页面。subject-scoped 草稿寄存、accept/dismiss 与 generation fence 已存在。

### 2.4 真实后端验收

仓库已有 `e2e/真实后端` agent-browser 编排、candidate/recruiter 双会话、后端 fixture converge/verify/cleanup、脱敏报告和五条 CRUD/隔离旅程，但没有 Hosted Agent 旅程。

后端当前 `apps/recruitment/testdata/hosted-agent-failure-contracts.json` 是合同映射 fixture，不是浏览器可消费的安全失败场景。现有 browser fixture 也没有公开选择 P4/P5/P6 失败终态的能力。

## 3. 方案选择

采用“按领域做最小严格接线”：

```text
P4/P5/P6 BFF wire
  -> 各领域现有 strict decoder
  -> 各领域现有 operation / polling fence
  -> 各领域现有展示映射与共享组件
  -> 现有页面
```

三个领域的状态矩阵、恢复来源和动作授权不同，因此不建立通用 Hosted Failure enum、service、状态机或组件框架。

不采用页面局部解析：candidate/recruiter 和多个入口会重复并漂移。不采用通用 failure 框架：当前没有第四个 consumer 或共享写模型作为证据，且它会增加把 readiness retry 与 Agent retry 混淆的风险。

P4 增加一个窄的恢复行为：row-backed terminal summary 在当前 scope 内缺少 receipt 时，单次读取权威 receipt。P5/P6 不增加新的恢复 API 或状态机制。

## 4. 冻结合同与 strict decode

### 4.1 P4 delegation receipt

receipt 精确包含七个 required key：

```text
delegation_id
recommendation_id
state
evaluation_id
case_id
refusal_code
failure_code
```

后端 OpenAPI 为兼容 wire 形状仍把 `state` 写成 required-but-nullable，但其设计和 BFF strict decoder 要求所有新合法响应的 state 非空。前端 strict decoder 按合法响应矩阵拒绝 `null`，不把它解释成 pending 或 generic failure。

最终状态保持六个，不增加 `expired`：

```text
accepted | evaluating | case_started | needs_user | refused | failed
```

`refusal_code` required-but-nullable，闭合为：

```text
recommendation_not_found
recommendation_unavailable
recommendation_stale
delegation_not_allowed
active_case_quota_reached
delegation_cooldown
```

`failure_code` required-but-nullable，闭合为：

```text
delegation_agent_unavailable
delegation_evaluation_failed
delegation_failed
```

合法矩阵：

| state | refusal_code | failure_code | 关键坐标 |
| --- | --- | --- | --- |
| `accepted` | `null` | `null` | `evaluation_id=null`、`case_id=null` |
| `evaluating` | `null` | `null` | `evaluation_id` 非空、`case_id=null` |
| `needs_user` | `null` | `null` | 保持后端现有阶段坐标 |
| `case_started` | `null` | `null` | `case_id` 非空 |
| `refused` | 闭合 refusal，非空 | `null` | 只表达业务拒绝 |
| `failed` | `null` | 闭合 failure，非空 | 只表达 Agent/执行失败 |

create batch 的 per-object `refused` 可合法携带空 `delegation_id`，因为该拒绝可能没有创建 row；其它状态以及单项 GET 的 receipt 必须携带非空 ID。decoder 需要知道 create 与 single-read 上下文，不能把这一例外扩大到所有读取。

未知字段、缺字段、未知 enum、双 code、错位 code 或非法坐标全部进入现有 `invalid_response`/契约错误路径。

### 4.2 P5 `agent_attention`

`MatchCaseView` 增加可选、不可为 `null` 的 `agent_attention`：

```json
{
  "code": "agent_unavailable | agent_result_invalid",
  "retryable": false
}
```

对象 exact key set 为 `code/retryable`。它只允许在 `status=attention_required` 时出现；非 attention 状态携带对象、未知 code、额外字段、`null` 或 `retryable=true` 都是合同错误。

`attention_required` 缺字段始终合法，表示 legacy、普通用户动作或未知安全原因，前端只显示中性说明。candidate/recruiter 只消费各自 list/detail 返回值，不跨 viewer 补齐。terminal/history 行按现有状态矩阵自然不携带该字段。

后端本 release 没有 Agent retry action 或 endpoint，`retryable` 只能为 `false`。

### 4.3 P6 proposal `failure_code`

`AgentRuleProposalView` 增加可选、不可为 `null` 的：

```text
failure_code: agent_unavailable | interpretation_failed
```

该字段只允许出现在 `state=failed`。已知新 failed proposal 必须带 code；legacy 或 unknown durable reason 的 failed proposal 可缺失。非 failed 携带、未知 code、错类型或与现有 proposal shape 不相容均 fail closed。

本设计只在现有创建回执、单项恢复和 polling settle 链路传递该字段。初始化继续只列出 `interpreting` 与 `ready`，不水合历史 failed。

## 5. P4 数据流与刷新恢复

### 5.1 创建与轮询

现有 create、单项 GET、轮询和 operation 保持职责：data source strict-decode，operation 执行状态收敛并写入 receipt cache，页面只消费映射后的安全语义。

terminal receipt 被接受后立即清除进行中状态。`refused/failed` 不创建本地 Case、不派发 Mock reducer；`case_started` 仍只凭 server `case_id` 进入真实 MatchCase。

### 5.2 Terminal summary 单次补读

推荐/推荐详情水合后，对满足全部条件的项发起一次单项 GET：

1. summary state 是 `refused` 或 `failed`；
2. `delegation_id` 非空；
3. 当前 receipt cache 中没有同 ID 的权威 receipt；
4. 同一 role/subject/screen scope/generation 下尚未请求该 ID。

这不是新轮询器：每个 scope 对每个 ID 最多补读一次，成功或失败均不定时重试。401 继续当前 session cleanup；404、503、网络未知和 invalid response 沿用现有安全错误语义，不用 summary state 猜 code。

补读结果只有在 role、subject、session 与 scope generation 仍匹配时才能写入。切角色、登出、切推荐对象或 unmount 后的迟到结果整包丢弃。

create-time 无 row refusal 可能没有 ID，也没有可恢复的单项资源；页面保留本次回执说明，但刷新后不制造持久失败记录。

## 6. UI 与动作语义

### 6.1 P4

| public code | 安全语义 |
| --- | --- |
| `delegation_agent_unavailable` | AI 服务暂时不可用，本次没有创建 Case |
| `delegation_evaluation_failed` | 本次评估未完成，不声称候选或岗位不合适 |
| `delegation_failed` | 本次委托未完成，不解释内部原因 |
| `delegation_not_allowed` | 真实 policy/资格/授权拒绝，不暗示刷新重试 |
| stale/quota/cooldown/unavailable/not-found | 保持各自业务原因 |

后端没有公开 P4 retry action，因此所有 terminal refused/failed 均不显示重新发起 CTA。只有未来合同公开 exact action 并冻结幂等语义后才重议。

### 6.2 P5

list/detail 使用同一展示映射：

- `agent_unavailable`：AI 服务暂时不可用，本 Case 尚未继续；
- `agent_result_invalid`：本次 AI 结果无法安全用于推进 Case；
- 缺 `agent_attention`：本阶段需要注意。

`attention_required` 不显示“代理处理中”等仍在推进的暗示。前端不增加 Agent retry 按钮、action 或 operation。现有 `retry_resume_readiness` 永远只代表 PDF parse/readiness；end、replace、人工决定等既有动作仍由 17 行矩阵与后端 `available_actions` 交集决定。

### 6.3 P6

候选规则库与招聘企业代理设置复用现有共享提案卡：

- `failed + agent_unavailable`：AI 暂时不可用，本次规则没有生效；
- `failed + interpretation_failed`：内容无法可靠转换为规则，可编辑后重新提交；
- legacy failed：本次规则没有生效。

failed proposal 永不进入 active rules。关闭失败卡时恢复当前 subject 下已保存的本地草稿，但不自动重发；刷新后不承诺恢复历史失败卡。`interpreting -> ready -> accept/dismiss` 与 accept 后权威重读不变。

### 6.4 安全错误边界

非法合同组合进入现有契约错误视图，并停用当前相关 mutation。页面和长期日志不得展示 Hub task ID、global identity、对方 enrollment、provider/model、HTTP code、raw exception、clauses、projection 或模型私有输出。

## 7. 权威性、并发与身份不变量

- 所有写操作继续复用现有幂等键、session fence 和 proposal/delegation generation fence。
- HTTP 202、网络未知或页面 unmount 不生成本地 Case、rule、task 或成功终态。
- candidate/recruiter 的 cache、草稿和 receipt 以 role/subject scope 隔离，不跨角色复用。
- 页面切换后迟到的 401 不得清理新会话；当前 fence 内的 401 继续统一清理。
- foreign/missing owner 404、quota、cooldown 与 organization verification 保持原领域语义，不归类为 Agent failure。
- 不从 summary、HTTP 503、task row 或内部 TerminalReason 推断公开 code。

## 8. 自动化测试设计

按 TDD 先增加失败测试，再完成最小实现。

### 8.1 P4

- 七键 receipt、六状态、六个 refusal、三个 failure 的合法样例；
- missing/extra key、null/unknown state、unknown enum、双 code、错位 code 和非法坐标 fail closed；
- create refused 空 ID 只在 create decoder 合法，single GET 拒绝；
- terminal receipt 清除进行中态，不创建本地 Case，不调用 Mock reducer；
- terminal summary 缺 cache 时只 GET 一次，成功恢复精确原因；
- 已有 receipt、空 ID、非 terminal summary 不补读；
- 401、404、503、invalid response 与迟到响应遵守既有 session/scope fence；
- candidate/recruiter 三个入口使用相同安全映射；organization、quota、cooldown 不被误写为 Agent failure。

### 8.2 P5

- 两个合法 code 和 legacy missing field；
- 非 attention 状态携带、unknown code、extra key、`null`、`retryable=true` fail closed；
- list/detail 显示相同安全说明，attention 不显示“代理处理中”；
- `retryable=false` 无 Agent retry；`retry_resume_readiness` 的文案和 operation 不变；
- existing end/replace/人工决定仍只按矩阵与 `available_actions` 开放；
- candidate/recruiter、list/detail/history/terminal shape 保持一致。

### 8.3 P6

- 两个 failure code 与 legacy missing code 的三条文案路径；
- non-failed 携带、unknown code、`null`、非法 shape fail closed；
- failed 不进入 active rules，关闭恢复草稿但零自动重发；
- 初始化不请求 failed 列表，刷新不制造失败卡恢复承诺；
- interpreting/ready/accept/dismiss、generation fence 和跨角色隔离不回归；
- candidate/recruiter 页面通过共享卡片得到相同语义。

### 8.4 验证入口

先运行本轮相关 Vitest，收敛后执行：

```sh
npm run test -- <本轮相关测试文件>
npm run typecheck
npm run lint
npm run build
```

若真实后端验收编排发生修改，再执行：

```sh
npm run test:agent-browser:unit
npm run test:agent-browser:shell
```

## 9. 真实 Hosted Agent E2E

### 9.1 承载方式

在现有 `e2e/真实后端` 编排中增加一条 `hosted-agent` journey，复用：

- `http://localhost:5173` 的 backend/local 前端；
- candidate/recruiter 两个具名、隔离的 agent-browser session；
- 后端官方 local stack 与 browser fixture converge/verify/cleanup；
- 当前 report、退出码分类、资源 ownership 与脱敏扫描。

不建立第二套 Playwright runner、场景 DSL、账号系统或清理器。现有 CRUD 旅程和视觉基线不因本任务重写。

### 9.2 环境门

旅程开始前必须确认：

- 后端 release 包含 identity target 修复；
- Recruitment/Hub recruitment runtime 健康；
- Hub model access 已由官方入口收敛；
- candidate 有 active intention 与可提交/成功 parse 的 PDF；
- recruiter 有 verified organization、active job 与 `hiring_organization_ref`；
- 两个 global identity 对应 active tenant 与 `recruitment.v1` enrollment。

缺少工具、真实 Provider、健康、model access、identity/enrollment 或 fixture 前置时记为 `INFRA_BLOCKED`；已经开始业务旅程后出现非法合同或错误终态记为 `FUNCTIONAL_FAILED`。启动成功和 HTTP 202 都不构成通过。

### 9.3 Happy-path journey

单条旅程按以下顺序执行：

1. candidate 提交自然语言规则，观察 `interpreting -> ready -> accept -> active rule`；
2. candidate 发起 job delegation，观察 `accepted/evaluating -> case_started`，并通过 server `case_id` 打开 Case；
3. recruiter 读取同一 Case，并触发一次 recruiter-target delegation/task；
4. candidate 完成 PDF 提交与 readiness；
5. recruiter 观察真实 `screen_resume` completion 并作人工决定；
6. 至少推进一轮补问/回答或差异协调，覆盖 candidate/recruiter 两个 target；
7. 刷新与深链后重新确认 P4/P5/P6 权威终态；
8. 扫描页面、控制台、报告和截图中的私有/内部词。

浏览器层只通过公开 BFF 和 UI 判断 Recruitment 已消费结果：规则进入权威 active、delegation 得到 server Case、Case step/action 因完成结果推进。网络证据只保留 `METHOD + pathname`，不保存请求/响应正文。

### 9.4 安全失败场景 blocker

本轮不把 `testdata/hosted-agent-failure-contracts.json` 当浏览器 fixture，也不通过数据库、内部 task row、前端 Mock 或 network interception 制造失败。

P4/P5/P6 的失败合同先由 strict decoder、operation 和 UI 测试完整覆盖。以下真实浏览器验收保持阻塞：

- P4 Agent failure；
- P5 agent attention；
- P6 failed proposal。

只有后端提供浏览器可消费、可选择、owner-safe 且能由官方 cleanup 收敛的 fixture 后，才把三条失败场景加入同一个 `hosted-agent` journey。该 fixture 还必须保证证据不包含手机号、OTP、Cookie、bearer、global identity、原始简历/JD、projection 或完整模型输出。

## 10. 最小修改范围

implementation plan 必须按最新主干再次缩窄。预计只涉及：

- P4/P5/P6 wire 类型与各自 strict decoder；
- P4 展示映射、operation/恢复 hook 与实际承载四个页面（`看市场`、`职位详情`、`候选推荐`、`匿名在线简历`）；
- MatchCase 展示映射以及 list/detail 的 attention 说明；
- Agent rule proposal 共享卡片及其 decoder/operation 类型传播；
- 对应 fixtures 和测试；
- 现有真实后端验收的 journey、类型、报告和 shell contract tests（仅实现 happy path 所需的增量）。

手写 plan 不得机械修改 handoff 推荐清单中的每个文件；没有行为或类型 diff 的文件不碰。

## 11. 非目标与延后条件

本次不做：

- 不修改后端 identity resolver、runtime、storage、OpenAPI 或 public mapping；
- 不新增 P4/P5 Agent retry；
- 不把 `retry_resume_readiness` 改成 Agent retry；
- 不水合或归档 P6 历史 failed proposal；
- 不建立通用 Hosted Failure 框架、长期双 schema 或新配置项；
- 不透传内部 TerminalReason、Hub 错误、provider/model 或 task identity；
- 不重做 release/0.2.5 前端独立批次已经处理的 truthful copy、Case 导航、Mock/backend 隔离；
- 不重构现有真实后端验收编排、视觉系统或后端 fixture；
- 不以数据库手工修改、network mock 或前端假状态完成真实失败 E2E。

只有出现以下证据才重议：

- 后端新增 exact retry action 和幂等 endpoint，才设计 Agent retry；
- 后端新增“未确认失败”或 archive/ack 合同，才水合 P6 failed 历史；
- 后端提供正式 safe-failure browser fixture，才解除三条失败 E2E blocker；
- 多个额外领域共享相同 lifecycle、恢复与动作授权，才考虑通用 failure 抽象。

## 12. 完成标准

- [ ] P4 strict receipt 精确区分三个 failure 与六个 business refusal；
- [ ] P4 row-backed terminal summary 可单次恢复安全原因，且 session/scope fence 不回归；
- [ ] P5 attention code 闭合、安全，legacy 保持中性且没有 Agent retry；
- [ ] P6 failed proposal 区分 unavailable、interpretation failure 与 legacy generic；
- [ ] unknown state/code/key/非法组合全部 fail closed；
- [ ] failure 不生成本地 Case、rule、task 或 Mock 成功；
- [ ] candidate/recruiter 权限、身份隔离、幂等与隐私投影不回归；
- [ ] 定向 Vitest、typecheck、lint、build 通过；
- [ ] 若 E2E 编排有变，agent-browser unit/shell contract gates 通过；
- [ ] 真实 Hosted Agent happy-path journey 覆盖 P6、candidate target、recruiter target、`screen_resume` 和刷新/深链；
- [ ] 三条真实安全失败场景在后端 fixture 未交付前明确保持 blocked，不以假 fixture 伪通过。
