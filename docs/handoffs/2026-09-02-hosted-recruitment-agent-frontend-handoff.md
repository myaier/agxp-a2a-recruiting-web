# 前端 Handoff：Hosted Agent 新失败合同接线与真实 E2E（后端依赖增量）

> 本文可直接发送给另一台机器上的前端 Coding Agent，但只能在 Hosted Agent 后端身份、任务收敛和公开错误合同合并后规划实施。接收者不需要此前聊天、测试账号、浏览器会话、截图、其它 Handoff 或任何本机路径。本文已删除基于当前 release 可独立实施的纯前端工作。

> **状态复核（2026-09-04 18:44 +08:00）：已完成。** 前端 strict failure receipt、P5 attention、P6 failed proposal 呈现及双角色 hosted journey 已由 `1950f860` 至 `4ba7c525` 完成并合入；`4ba7c525` 已确认是前端 `origin/main@26d80923` 的祖先，对应后端合同也已进入 `origin/release/0.2.5@21e34ff04`。后文未勾选框不再代表待领取任务。

## 1. 仓库、冻结基线与目标

- 前端仓库：`myaier/agxp-a2a-recruiting-web`
- 调查时前端 `origin/main`：`b2827dae16e89b199b487ab1564246b7b66e34f6`
- 当前可用后端基线：`origin/release/0.2.5@45f7323e34f6f6db11faee658144e28d338b36be`
- 运行模式：`VITE_DATA_SOURCE=backend`

当前 release 已经提供 P4/P5/P6 的主体 API，但真实 Hosted Agent task 仍因 Recruitment product subject 与 Hub global identity 淆用而在执行前失败。后端/Hub Handoff 将修复 target identity，并新增 owner-safe 失败投影。

依赖已按 capability 拆分：

- 前端 schema/DTO/UI 的唯一直接依赖：`docs/handoffs/2026-09-02-hosted-failure-contracts-backend-handoff.md`；
- 真实 task target 前置：`docs/handoffs/2026-09-02-hosted-identity-core-backend-handoff.md`；
- real-provider 浏览器 E2E 环境前置：`docs/handoffs/2026-09-02-local-ai-runtime-backend-handoff.md`。

前端 Agent 不实施后两份文档中的身份或 runtime 工作。

以下纯前端工作已迁移到 `docs/handoffs/2026-09-02-release-0.2.5-frontend-only-handoff.md`，不得在本文重复：

- P4 accepted/evaluating truthful copy、现有状态恢复、`case_started` 导航与 Case 可发现性；
- P5 Agent step 文案、PDF parse/`screen_resume`/人工决定的展示边界；
- Backend 模式移除假日报、假漏斗、假对话和定时回复；
- 当前 release 下的通用失败空态。

当前前端也已经正确处理 P6 的基础异步状态：`interpreting → ready → accept/dismiss/failed`，并且不会在 HTTP 202 时直接创建 active rule。本 Handoff 不重做该状态机，只接后端新增的失败原因。

本文只保留三个后端依赖增量和一次真实 Agent 集成验收：

1. P4 delegation 的精确 Agent failure/refusal code；
2. P5 MatchCase `attention_required` 的安全 Agent 原因和受控 retry 语义；
3. P6 failed proposal 的安全 `failure_code`；
4. 后端身份/Runtime 修复完成后的 candidate/recruiter/`screen_resume`/P6 真实闭环。

## 2. 当前 release 与目标合同的差异

### 2.1 P4

当前 release 状态：

```text
accepted | evaluating | case_started | needs_user | refused | failed
```

当前 refusal code：

```text
recommendation_not_found
recommendation_unavailable
delegation_not_allowed
active_case_quota_reached
delegation_cooldown
null
```

它不能区分 Hosted Agent 不可用、Agent 已运行但 evaluation 失败和真实业务拒绝。后端将冻结新的 owner-safe code；前端在后端合并前不得扩 enum。

### 2.2 P5

当前 MatchCase 只有：

```text
lifecycle
stage
status
step
needs_action
available_actions
stages
```

`status=attention_required` 没有 task 级安全原因。前端目前只能显示中性“需注意”，也没有依据提供 Agent retry。

### 2.3 P6

当前 proposal wire 状态已经闭合：

```text
interpreting | ready | accepted | dismissed | failed
```

但 `AgentRuleProposalView` 没有 `failure_code`。所有 failed proposal 只能显示通用失败，无法区分 Agent/Hub 不可用与内容无法解释。

## 3. 后端提交必须先交付的冻结合同

前端开始前，后端 Handoff 必须提供精确 commit、两份 OpenAPI diff、DTO 表、错误枚举和 fixture。最低目标合同如下；最终字段名只能以后端合并版本为准。

### 3.1 P4 delegation

目标 public union 至少区分：

```text
delegation_agent_unavailable
delegation_evaluation_failed
delegation_not_allowed
```

状态是否新增 `expired`、错误位于 `refusal_code` 还是新字段、latest summary 如何投影，都必须由后端最终 OpenAPI 冻结。前端不得根据内部 `hub_rejected`、task row 或 HTTP 503 猜测。

### 3.2 P5 attention

后端建议合同：

```json
{
  "agent_attention": {
    "code": "agent_unavailable",
    "retryable": false
  }
}
```

最终必须冻结：

- 字段挂在 list/detail 的哪个对象；
- required/nullability 与只允许出现的状态矩阵行；
- closed `code` union；
- `retryable=true` 对应的 exact `available_actions`；
- legacy `attention_required` 缺字段的兼容语义；
- candidate/recruiter viewer 是否得到相同安全词。

### 3.3 P6 failed proposal

保留现有状态名，不新增 `pending` 或 `ready_for_confirmation`。为 failed proposal 增加可选：

```text
failure_code: agent_unavailable | interpretation_failed
```

新产生的 failed proposal 必须返回一个 code；历史 failed 记录允许缺字段，前端显示通用失败。非 failed 状态不得携带 `failure_code`，内部 TerminalReason 不能直接透传。

## 4. 交付 A：P4 精确 Agent 失败原因

### 4.1 Strict contract

在后端合同合并后更新：

```text
src/数据/BFF契约.ts
src/数据/招聘数据源/发现推荐.ts
src/状态/后端/发现推荐操作.ts
```

要求：

- exact key set、状态和错误词严格解码，未知词 fail closed；
- 不长期维护 release/0.2.5 与新合同两套宽松 schema；迁移窗口需要兼容时必须由 Spec 明确结束条件；
- foreign/missing owner 的 404、401 session cleanup、quota/cooldown 等现有错误不回归；
- 不把 Hub task ID、global identity、provider/model 或原始异常放进 browser DTO/日志。

### 4.2 UI 语义

- `delegation_agent_unavailable`：AI 服务暂时不可用，本次没有创建 Case；
- `delegation_evaluation_failed`：本次评估未完成，不声称候选/岗位不合适；
- `delegation_not_allowed`：只用于后端真实 policy/授权拒绝；
- quota/cooldown/recommendation unavailable 继续使用各自业务说明；
- terminal failure 清除进行中状态并保留安全原因；
- 只有后端合同明确允许重新发起时才显示 CTA，候选重发仍需完整 PDF 与披露确认；
- `case_started` 继续只通过 server `case_id` 进入真实 MatchCase。

### 4.3 测试

- 三类 Agent/业务失败的文案和重试行为不同；
- unknown code/state fail closed；
- failure 不生成本地 Case、不派发 Mock reducer；
- 刷新 recommendation/delegation 后安全原因可恢复；
- candidate/recruiter 两端一致且不泄漏内部字段；
- organization verification、quota、cooldown 不被误写为 Agent failure。

## 5. 交付 B：P5 `agent_attention`

### 5.1 Decoder 与矩阵约束

扩展现有 MatchCase strict DTO 和 17 行展示矩阵：

- `agent_attention` 只在后端最终允许的 `attention_required` row 出现；
- 非允许状态携带字段、未知 code、非法 retry/action 组合全部进入现有契约错误视图并停用 mutation；
- legacy `attention_required` 缺字段继续显示中性“本阶段需要注意”，不能猜 Agent 原因；
- candidate/recruiter 只消费各自 detail/list 返回值，不跨 viewer 补齐。

### 5.2 展示与 retry

- `agent_unavailable` 显示“AI 服务暂时不可用，本 Case 尚未继续”；
- 其它闭合 code 使用后端批准的中性文案；
- `retryable=false` 不显示重试按钮，可保留刷新及原有 end/replace 等合法动作；
- `retryable=true` 只有 `available_actions` 同时包含后端冻结的 exact retry action 时才显示；
- 调用现有 operation 层执行幂等命令，不从页面重发旧 Hub task；
- `retry_resume_readiness` 永远只是 PDF parse/readiness，不得被解释为 Agent task retry；
- 不展示对方 enrollment、Hub HTTP code、task ID、provider/model 或原始错误。

如果后端本轮没有实现用户主动 retry，应固定 `retryable=false`，前端不得自行增加按钮。

### 5.3 测试

- 合法 attention code 显示安全说明；
- legacy 无字段保持中性；
- `retryable=false` 无 Agent retry；
- `retryable=true` 但 action 缺失时 fail closed；
- exact action 存在时只发一次幂等请求；
- `retry_resume_readiness` 与 Agent retry 不混淆；
- list/detail、candidate/recruiter 和 terminal/history 行为一致。

## 6. 交付 C：P6 failed proposal 原因

### 6.1 Strict decoder

在后端合同合并后扩展：

```text
src/数据/BFF契约.ts
src/数据/招聘数据源/Agent规则.ts
src/状态/后端/Agent规则操作.ts
src/状态/后端/useAgent规则提案轮询.ts
```

要求：

- `failure_code` 只允许 `agent_unavailable | interpretation_failed`；
- 新 failed 带 code；历史 failed 缺字段进入通用兼容路径；
- 非 failed 携带字段、未知 code 或 illegal normalized fields 继续 fail closed；
- role/subject/session/proposal generation fence 不回归。

### 6.2 展示行为

候选 `规则库` 与招聘 `企业代理设置` 使用同一安全语义：

- `failed + agent_unavailable`：AI 暂时不可用，本次规则没有生效；保留本地输入供用户修改/重新明确提交，但不进入规则列表；
- `failed + interpretation_failed`：内容无法可靠转换为规则，允许编辑后重试；
- legacy failed 无 code：通用“本次规则没有生效”；
- `interpreting` 继续等待，`ready` 继续显式 accept/dismiss，只有 accept 成功并权威重读后 rule 才显示 active；
- 202、network unknown、刷新、unmount、切角色不得生成本地规则或跨角色污染；
- 不显示 task、identity、provider、clauses、raw projection 或内部 TerminalReason。

### 6.3 测试

- 两个 failure code 和 legacy missing code 三条文案路径；
- 非 failed 携带 code、unknown code 和非法 shape fail closed；
- failed 永不进入 active rules；
- 输入草稿保留但不会自动重发；
- candidate/recruiter 页面语义一致；
- existing interpreting/ready/accept/dismiss 流程不回归。

## 7. 推荐修改范围

```text
src/数据/BFF契约.ts
src/数据/招聘数据源/发现推荐.ts
src/数据/招聘数据源/MatchCase.ts
src/数据/招聘数据源/Agent规则.ts
src/数据/MatchCase展示映射.ts
src/状态/后端/发现推荐操作.ts
src/状态/后端/use发现推荐委托轮询.ts
src/状态/后端/MatchCase操作.ts
src/状态/后端/useMatchCase轮询.ts
src/状态/后端/Agent规则操作.ts
src/状态/后端/useAgent规则提案轮询.ts
src/屏幕/看市场.tsx
src/屏幕/职位详情.tsx
src/屏幕/候选推荐.tsx
src/屏幕/P5/MatchCase列表.tsx
src/屏幕/P5/MatchCase历史.tsx
src/屏幕/P5/MatchCase详情.tsx
src/屏幕/规则库.tsx
src/屏幕/企业代理设置.tsx
src/组件/Agent规则提案卡.tsx
```

实际修改必须按后端最终 diff 和最新前端主干缩窄。纯文案、Case 导航、Backend/Mock 页面隔离已经由 release/0.2.5 前端独立批次处理，不得在本 Plan 重做。

## 8. 串行依赖与实施顺序

1. `2026-09-02-hosted-identity-core-backend-handoff.md` 先修复 product subject → global identity target；
2. `2026-09-02-hosted-failure-contracts-backend-handoff.md` 冻结 P4/P5/P6 public schema、OpenAPI、fixture 和精确 commit；
3. 前端 Agent fetch 最新主干，并校准 release/0.2.5 纯前端批次的已合并提交；
4. 先机械更新 strict DTO/decoder 与数据源测试；
5. 再更新 P4/P5/P6 展示和允许动作；
6. `2026-09-02-local-ai-runtime-backend-handoff.md` 提供真实 runtime/fixture 后，定向测试及前端 broad gate 通过，才执行真实 Agent browser E2E。

后端任一字段、enum、retry action 或 fixture 未冻结时停止，不预埋兼容词，不通过数据库内部状态设计 UI。

## 9. 真实 Agent E2E

### 9.1 前置条件

- candidate 带在线简历、成功 parse 的 PDF 和 active intention；
- recruiter 带 verified organization、active job 和 `hiring_organization_ref`；
- 双方 global identity 均拥有 active Hub tenant、model access 和 `recruitment.v1` enrollment；
- Hub 使用真实 LLM Provider 与正式 `application_id=recruitment`；
- 后端 fixture 提供一个安全失败场景，不要求前端手工改数据库。

### 9.2 Agent-browser 顺序

1. candidate 提交自然语言规则：观察 interpreting → ready → accept → active rule；
2. candidate 发起 job delegation：观察 accepted/evaluating → case_started，打开 server case ID；
3. recruiter 读取同一 Case；另执行一次 recruiter-target delegation 或 task；
4. candidate 完成 PDF 提交/readiness；
5. recruiter 观察真实 `screen_resume` completion 并作人工决定；
6. 至少推进一轮补问/回答或差异协调，覆盖 candidate/recruiter 两个 target；
7. 刷新与深链后 P4/P5/P6 状态仍来自后端；
8. 使用安全失败 fixture 分别验证 P4 Agent failure、P5 attention 和 P6 failed proposal；
9. UI 不出现 Hub/provider/task/identity 或模型私有内容。

通过标准不是 HTTP 202 或数据库有 task row。至少一个 candidate-target task、一个 recruiter-target task、一个 `screen_resume` 和一个 P6 interpretation 必须真实完成并被 Recruitment 消费，UI 呈现对应权威终态。

## 10. 验证要求

每项先运行对应 Vitest；实现收敛后运行仓库当前有效的：

```text
npm run test -- <target test files>
npm run typecheck
npm run lint
npm run build
```

若仓库有正式 affected/changed-files gate，以仓库规则指定入口作为唯一 plan-scope broad gate。真实 Agent E2E 的截图和网络 evidence 不得包含手机号、验证码、Cookie、bearer、global identity、原始简历/JD、projection 或完整模型输出。

## 11. 完成标准

- [ ] P4 精确区分 Agent unavailable、evaluation failure 和业务拒绝；
- [ ] P5 attention 原因闭合、安全，retry 只由后端 action 授权；
- [ ] P6 failed proposal 区分 Agent unavailable、interpretation failure 和 legacy generic failure；
- [ ] 未知状态/字段组合全部 fail closed，不建立双 schema 长期分支；
- [ ] failure 不生成本地 Case、task、rule 或 Mock 成功；
- [ ] candidate/recruiter 权限、session fence、幂等、隐私投影不回归；
- [ ] release/0.2.5 纯前端批次已经处理的文案、导航和 Mock 隔离没有重复实现；
- [ ] 定向测试、typecheck、lint、build 和真实 Hosted Agent E2E 通过。
