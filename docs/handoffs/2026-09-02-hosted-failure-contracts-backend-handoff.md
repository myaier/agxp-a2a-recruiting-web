# 后端 Handoff：Hosted Agent Failure Contracts

> 本文可直接发送给另一台机器上的后端 Coding Agent，用于从零上下文编写 Spec/Plan 并实施。文中只使用仓库相对路径，不依赖此前聊天、测试账号、浏览器会话、截图或本机路径。

> **状态复核（2026-09-04 18:44 +08:00）：已完成。** delegation terminal reason、P4/P5/P6 owner-safe failure/attention 投影及 BFF 严格合同已在 `f69fcec26` 收尾，并已确认进入后端 `origin/release/0.2.5@21e34ff04`。后文仅保留为历史设计、实现和验收依据。

## 1. 目标、基线与前置依赖

- 目标仓库：Recruitment 后端仓库，包含 Mobile API、BFF 与 OpenAPI。
- 核对基线：`origin/release/0.2.5@45f7323e34f6f6db11faee658144e28d338b36be`。
- 目标：把 P4/P5/P6 Hosted Agent 的内部失败稳定投影成少量 owner-safe、可恢复、可 strict-decode 的公开合同。
- 本 Handoff 是 Hosted Agent public failure enums/DTO/OpenAPI 的唯一 owner。

实施前必须拿到并校准：

1. `docs/handoffs/2026-09-02-hosted-identity-core-backend-handoff.md` 的精确实现 commit；
2. `docs/handoffs/2026-09-02-discovery-job-truth-backend-handoff.md` 的最终 Discovery/P4 OpenAPI diff。

原因：先修 canonical target identity，才能区分“Agent 不可用”和“业务拒绝”；同时避免两名 Agent 并发编辑同一 P4 DTO/OpenAPI。

## 2. 设计原则

- public code 表达用户可理解、可采取行动的类别，不暴露 Hub/provider/runtime 细节；
- typed internal reason → 显式 public mapping；禁止靠 error string substring；
- unknown internal reason fail closed 为安全的通用失败，不伪装为业务拒绝；
- latest summary、detail 与 history 使用同一 mapping；
- strict decoder 遇到未知 public enum 继续 fail closed；
- retry CTA 只能由服务端真正支持且授权的 action 驱动。

以下信息不得公开：global identity、enrollment 状态细节、tenant/model、provider、prompt、runtime implementation、raw Hub error、task/work IDs（除非现有合同已明确允许）、stack/trace。

## 3. P4：Discovery delegation/evaluation

### 3.1 状态集合

以当前 P4 API 为基线，Spec 冻结最终状态。目标集合为：

```text
accepted
evaluating
case_started
needs_user
refused
failed
expired
```

若 `expired` 在当前生命周期中没有可达状态，不为凑 enum 新增；但 Spec 必须明确保留还是删除。不能出现多个同义终态。

### 3.2 Owner-safe failure code

至少冻结：

```text
delegation_agent_unavailable
delegation_evaluation_failed
delegation_not_allowed
```

语义：

- `delegation_agent_unavailable`：canonical identity/enrollment/runtime/provider 等导致 Agent 没有实际可用；不泄露具体基础设施原因；
- `delegation_evaluation_failed`：Agent 已被正确受理或运行，但无法生成有效 evaluation/结果；
- `delegation_not_allowed`：真实产品 policy、资格或授权明确拒绝；不能用于掩盖 identity/runtime wiring bug。

Spec 必须冻结 code 位于现有 `refusal_code`、新的 `failure_code` 还是统一 outcome 字段，并给出 state × code 合法组合表。禁止让 `failed` 携带业务 refusal code，或让 `refused` 承载 infrastructure failure。

### 3.3 Mapping

至少覆盖：

- identity mapping missing/inactive；
- Hub not enrolled/capability/model unavailable；
- task submission rejection；
- runtime/provider unavailable；
- evaluation invalid/terminal failure；
- product policy/authorization refusal；
- timeout/expiration；
- unknown internal error。

相同内部原因在 create response、poll/latest、refresh/replay 后必须产生相同 public state/code。

## 4. P5：MatchCase attention

对 applicable 的 `attention_required` row 增加可选 owner-safe 对象；建议语义：

```json
{
  "agent_attention": {
    "code": "agent_unavailable",
    "retryable": false
  }
}
```

约束：

- `agent_attention` 只出现在最终合同允许的 attention row；
- `code` 是闭合 public enum，至少支持 `agent_unavailable`；
- 没有真正实现并授权用户 retry 时，`retryable` 必须固定 `false`；
- 若未来 `retryable=true`，同一 response 必须提供 exact server-authorized action，并且 action 已有实现、幂等、权限和测试；
- 不能把 Hub task rejection detail、global identity/enrollment/provider 直接放进 attention message；
- history 与 latest case projection 一致。

本轮如果没有现成 retry command，不新增 retry 按钮所需的虚假 capability，也不为了字段完整引入半成品 endpoint。

## 5. P6：Agent rule proposal

保持当前 proposal lifecycle/name；只为失败终态新增可选精确原因。目标合同：

```text
failure_code:
  agent_unavailable
  interpretation_failed
```

约束：

- 新产生的 `failed` proposal 必须有 `failure_code`；
- legacy failed row 可以缺失，projection 安全回退为通用失败；
- non-failed proposal 不得携带 `failure_code`；
- `agent_unavailable` 表示未能使用 Hosted Agent；
- `interpretation_failed` 表示 Agent/解释流程已运行但无法形成有效 proposal；
- `TerminalReason` 与 public code 采用显式 exhaustive mapping；
- `accept/dismiss`、owner auth、revision/CAS 和现有 interpreting polling 不改变。

## 6. Discovery/Organization 错误边界

`organization_verification_required` 属于 Discovery & Job Truth Handoff，不由本文定义或实现。

因为 P4 Discovery DTO/OpenAPI 可能与本文共享文件，实施步骤必须是：

1. rebase/merge 已完成的 Discovery & Job Truth commit；
2. 读取其最终 OpenAPI 与 generated code；
3. 只在同一基线上追加 Hosted failure delta；
4. 不改组织 gate、category gate 或 structured requirement schema。

## 7. Storage 与历史兼容

优先从现有 typed terminal reason/source facts 派生 public code。若现有持久化不足以在 refresh 后稳定重建：

- 新增最窄的 typed terminal reason persistence；
- 提供 migration/legacy behavior；
- 不持久化 raw provider/Hub error 作为 public truth；
- 不在 projection 时依赖日志或 ephemeral in-memory error。

Spec 必须说明：

- 哪些 code 是持久化，哪些可稳定派生；
- legacy P4/P5/P6 row 如何投影；
- unknown/new internal reason 的安全回退；
- history/latest 的一致性规则。

## 8. API 与 BFF 要求

更新并保持一致：

- Recruitment Mobile API handler/DTO；
- BFF client strict decoder；
- BFF HTTP API projection；
- Recruitment public OpenAPI；
- BFF public OpenAPI；
- generated code与schema drift检查。

BFF 不根据 HTTP 503、message 文本或 internal fields 猜 code；它只 strict-map 后端冻结的公开 enum。

所有 errors/attention/proposals 遵守现有 owner authorization、privacy、no-store 与日志脱敏规则。

## 9. 推荐代码范围

按最新主干定位实际文件，重点检查：

```text
apps/recruitment/internal/candidateevaluation/
apps/recruitment/internal/discovery/
apps/recruitment/internal/matchcase/
apps/recruitment/internal/agentcontrol/
apps/recruitment/internal/store/
apps/recruitment/internal/mobileapi/
apps/recruitment/internal/bff/
apps/recruitment/openapi/
apps/recruitment/internal/bff/openapi/
apps/recruitment/migrations/
apps/recruitment/testdata/
```

不要修改 Hub target resolver/callsites；这些必须已经由 Identity Core commit 完成。

## 10. 必须覆盖的测试

### 10.1 P4

1. identity/enrollment/runtime unavailable → `failed` + `delegation_agent_unavailable`；
2. Agent运行后 evaluation terminal failure → `delegation_evaluation_failed`；
3. 真实 policy/资格拒绝 → `refused` + `delegation_not_allowed`；
4. 不得把 unavailable 映射成 not_allowed；
5. create/poll/latest/refresh/history mapping 一致；
6. timeout/expired 与 unknown reason 按冻结表安全投影。

### 10.2 P5

1. applicable attention row 返回闭合 `agent_attention`；
2. 无 retry command 时 `retryable=false`；
3. 普通 user-action attention 不被错误标为 Agent unavailable；
4. non-attention row 不携带对象；
5. history/latest 一致且无内部 detail 泄露。

### 10.3 P6

1. 新 failed row 必有精确 code；
2. legacy failed 缺 code 可安全读取；
3. nonfailed 无 code；
4. TerminalReason exhaustive mapping；
5. unavailable 与 interpretation failure 不混淆；
6. accept/dismiss/CAS 回归通过。

### 10.4 Contract

- Mobile API/BFF/两份 OpenAPI enum、nullable/optional、合法组合一致；
- unknown enum strict decoder fail closed；
- errors/cache/log redaction 测试；
- deterministic fixtures 覆盖每个 public code；
- 项目要求的 migration、unit、integration、生成检查通过。

## 11. 独占边界与非目标

本 Handoff 不修改：

- product subject → global identity resolver；
- P4/P5/P6 task target、retry/rebuild callsite；
- Hub enrollment/runtime/provider/model/local scripts；
- organization/category/structured requirements；
- 前端错误 UI。

对应 owner：

```text
docs/handoffs/2026-09-02-hosted-identity-core-backend-handoff.md
docs/handoffs/2026-09-02-local-ai-runtime-backend-handoff.md
docs/handoffs/2026-09-02-discovery-job-truth-backend-handoff.md
docs/handoffs/2026-09-02-hosted-recruitment-agent-frontend-handoff.md
```

## 12. 实施顺序与交付物

本工作属于 Wave 2：

1. 先取得 Identity Core 精确 commit；
2. 合并/校准 Discovery & Job Truth 的 P4/OpenAPI diff；
3. 写 mapping table 与 schema tests；
4. 实施 store/projection/Mobile API/BFF/OpenAPI；
5. 提供 fixtures 给前端；
6. 交给 Local AI Runtime owner 做 Wave 3 real-provider E2E。

交付物：

- 精确 commit；
- P4 state × code 合法矩阵；
- internal reason → public code mapping table；
- P5 attention/retry action 表；
- P6 TerminalReason mapping；
- legacy behavior；
- 两份 OpenAPI diff 与 deterministic fixtures。

## 13. 完成标准

- [ ] P4 unavailable/evaluation failure/business refusal 不再混淆；
- [ ] P5 attention 原因 owner-safe，retry 与真实 action 一致；
- [ ] P6 failed proposal 有稳定、闭合原因；
- [ ] latest/history/refresh 后投影一致；
- [ ] Mobile API、BFF、两份 OpenAPI strict contract 一致；
- [ ] 未泄露 Hub/provider/identity/runtime detail；
- [ ] 已校准而未覆盖 Discovery & Job Truth 的 P4 diff；
- [ ] 定向测试与后端验证门通过；
- [ ] 前端可仅凭 commit、OpenAPI、mapping 与 fixtures 实施。
