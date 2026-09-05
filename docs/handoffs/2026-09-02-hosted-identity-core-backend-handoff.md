# 后端 Handoff：Hosted Agent Identity Core

> 本文可直接发送给另一台机器上的后端 Coding Agent，用于从零上下文编写 Spec/Plan 并实施。文中只使用仓库相对路径，不依赖此前聊天、浏览器会话、测试账号、截图或本机路径。

> **状态复核（2026-09-04 18:44 +08:00）：已完成。** Hosted Agent 的 canonical global identity 解析与相关 task target 收敛已由 `68844cab3` 并经 `0a435a931` 集成，且已确认进入后端 `origin/release/0.2.5@21e34ff04`。后文未勾选框仅作历史实施记录。

## 1. 目标、基线与唯一职责

- 目标仓库：包含 Recruitment 与 Hub 的后端仓库。
- 核对基线：`origin/release/0.2.5@45f7323e34f6f6db11faee658144e28d338b36be`。
- 目标：统一修复 Recruitment product subject 被误当成 Hub global identity 的问题，让所有 Hosted Agent task 使用 canonical global identity。
- 本 Handoff 是 product subject → active global identity resolution 与 task target wiring 的唯一 owner。

本轮不改变公开 P4/P5/P6 error schema，不修改 local scripts/Compose/provider，也不改变 Job/Discovery truth。

## 2. 必须理解的双身份模型

认证完成后同时存在两个不同坐标：

- `AuthenticatedPrincipal.SubjectID`：Recruitment 产品域 subject，用于 Recruitment 内 owner/party authorization 与业务数据关联；
- `AuthenticatedPrincipal.IdentityID`：平台 global identity，用于 Hub enrollment、tenant/model access 与 Hosted Agent task target。

当前 `ResolvingVerifier` 的正确行为是：先验证/保留 global identity，再把 `SubjectID` 重写成 Recruitment product subject。account lifecycle 中已有 sealed mapping 可以从 product subject 找回 global identity。

核心 invariant：

```text
Recruitment authorization / ownership => product subject
Hub task target / enrollment          => active global identity
```

二者不能靠字符串形状猜测、不能复用同名字段、不能在 BFF/public DTO 中暴露映射。

## 3. 已确认的错误入口

### 3.1 P4 Candidate evaluation

Candidate evaluation 的 prepared/retry/rebuild 路径把传入的 Recruitment subject 直接写到 `TargetIdentityID`。Hub 随后按 global identity 校验 enrollment，正确地拒绝了该 task。

### 3.2 P6 Agent control interpretation

Agent control 的 `ActorClaims` 目前只携带 product `SubjectID`，task builder 使用该值作为 Hosted Agent target。浏览器请求即使 principal 已含正确 global identity，也在进入 task 前丢失。

### 3.3 P5 MatchCase tasks

MatchCase projection/command 中的 `Candidate.IdentityID`、`Job.RecruiterIdentityID` 等名称实际承载 Recruitment party/product subject。Discovery reconciler 也把 owner/candidate subject 写入 Case。后续 task creation 把这些业务坐标直接发给 Hub。

必须保留 Case authorization/history 的 product subject 语义；不能用一次全局 rename 把所有业务字段改成 global identity。

## 4. 交付 A：窄的 server-side target resolver

在受信服务端边界增加一个明确接口，名称可按代码风格调整，但语义必须冻结：

```go
type HostedAgentTargetResolver interface {
    ResolveActiveGlobalIdentity(ctx context.Context, subjectID string) (string, error)
}
```

要求：

- 输入只接受 Recruitment product subject；
- 通过现有 sealed account lifecycle mapping 解析；
- 只返回 active、仍有效的 global identity；
- 删除、unlink、inactive、缺映射、跨 tenant 均 fail closed；
- 不回退为原 subject；
- 不解析用户提交的任意 global identity；
- global identity 不进入 public DTO、普通日志、metrics label 或 error detail。

优先复用已有映射 store/service，避免建立第二份 identity 表或缓存。如果需要 cache，必须遵循 unlink/deletion invalidation；本轮以正确性优先。

## 5. 交付 B：逐个 task callsite 分轨

### 5.1 P4 Candidate evaluation

显式区分：

- `ownerSubjectID`：authorization、resume ownership、idempotency/business lookup；
- `targetGlobalIdentityID`：只用于 Hub task target。

浏览器同步入口可以使用已验证 principal 的 global identity，但必须验证它确实映射到当前 subject。异步、retry、rebuild 和后台任务不能依赖旧 request claims，必须通过 resolver 解析，或读取此前服务端冻结且仍可验证的 target。

所有首次提交、retry、rebuild、reconcile 路径必须覆盖，不能只修 happy-path handler。

### 5.2 P6 Agent control

给内部 `ActorClaims`/command context 增加非公开的 global identity 字段。权限仍只根据 product subject/role 判断；task builder 只使用已验证的 global identity。

禁止把 `IdentityID` 加到浏览器可写 request body。

### 5.3 P5 MatchCase

Case parties、owner checks、history 与业务 projection 继续保存 product subjects。在创建 Hosted Agent task 的服务边界解析相关 party 的 active global identity。

至少核对以下 task type 的 target 选择：

```text
evaluate_job
evaluate_candidate
generate_screening_question
answer_screening_question
reevaluate_job_match
interpret_agent_control
screen_resume
coordinate_difference
```

如果某个 task type 由系统 actor 运行，Spec 必须根据 Hub 现有合同明确 actor/target，而不是随意选择 candidate 或 recruiter。`evaluate_candidate` 只在其现有可用/启用路径中修改，不顺便开放未启用功能。

## 6. Hub 边界

Hub 对以下情况的拒绝是正确行为，不应放宽：

- target 不是 global identity；
- identity 未 enrollment 到 `application_id=recruitment`；
- tenant/model/capability 不匹配；
- identity 已删除或失效。

本 Handoff 不让产品运行时自动 enrollment，也不新增“收到 task 时自动注册”的越权旁路。local fixture/enrollment 由 Local AI Runtime Handoff 负责。

## 7. 错误处理边界

内部必须保留可诊断的 typed error/metric（例如 identity mapping missing、inactive、Hub rejected），但公开 API 继续使用当前合同，直到 Hosted Failure Contracts Handoff冻结 owner-safe P4/P5/P6 code。

本提交不得提前新增或改名：

```text
delegation_agent_unavailable
delegation_evaluation_failed
delegation_not_allowed
agent_attention
failure_code
```

若修复后错误行为自然变化，只在交付说明中列出 observed delta，公开 schema 由下游 Handoff统一处理。

## 8. 推荐代码范围

按最新主干校准，重点检查：

```text
apps/recruitment/internal/authn/
apps/recruitment/internal/accountlifecycle/
apps/recruitment/internal/candidateevaluation/
apps/recruitment/internal/agentcontrol/
apps/recruitment/internal/matchcase/
apps/recruitment/internal/discovery/
apps/recruitment/internal/store/
apps/recruitment/internal/mobileapi/
apps/recruitment/internal/bff/
apps/hub/
```

Hub 仅用于验证准入与 task contract，除非代码证据表明现有 Hub consumer 错误，否则不要通过放宽 Hub 校验来掩盖 Recruitment target bug。

## 9. 必须覆盖的测试

### 9.1 Resolver

1. active subject 映射到正确 global identity；
2. missing/inactive/deleted/unlinked mapping fail closed；
3. 不回退到 subject；
4. 跨 tenant/错误映射拒绝；
5. error/log/public DTO 不泄露 global ID。

### 9.2 Callsites

1. P4 首次 evaluation 使用 global target，owner lookup 仍用 subject；
2. P4 retry/rebuild/async 路径同样使用 global target；
3. P6 claims 权限仍基于 subject，task target 为 global identity；
4. P5 每个适用 task type 都有 target table-driven test；
5. candidate/recruiter parties 不会交叉选择；
6. mapping 在请求后被删除时，后台 task fail closed；
7. Case history/authorization 不因 target wiring 改变；
8. Hub 保持拒绝 product subject 的控制组。

### 9.3 Regression

- Recruitment 普通 profile/job/resume authorization 不受影响；
- idempotency key 与业务 ownership 不改用 global identity；
- 不新增公开 schema diff；若生成物发生无关 diff 必须撤回。

## 10. 独占边界与非目标

本 Handoff 不修改：

- Job organization/category/structured requirements；
- P4/P5/P6 owner-visible failure enum/DTO/OpenAPI；
- `dev-local.sh`、Compose、Provider、model、parser stub；
- Hub local enrollment fixture 或 formal runtime 配置；
- 前端。

相关 owner：

```text
docs/handoffs/2026-09-02-discovery-job-truth-backend-handoff.md
docs/handoffs/2026-09-02-hosted-failure-contracts-backend-handoff.md
docs/handoffs/2026-09-02-local-ai-runtime-backend-handoff.md
```

## 11. 依赖与交付顺序

本工作是 Wave 1，可与 Discovery & Job Truth、Resume Suggestion API 和 Local AI Runtime 的配置部分并行。

Hosted Failure Contracts 必须基于本 Handoff 的精确 commit 实施。Local AI Runtime 的最终真实 task E2E 也必须在本提交合并后执行。

交付时必须给下游：

- 精确 commit；
- resolver invariant 与 error table；
- 每个 task type 的 owner subject / target global identity 选择表；
- retry/rebuild/deletion 行为；
- 表明公开 OpenAPI 未改变的验证结果。

## 12. 完成标准

- [ ] product subject 与 global identity 的 invariant 在代码中显式表达；
- [ ] 只有窄 resolver 负责 active global identity lookup；
- [ ] P4/P5/P6 所有 task creation/retry/rebuild callsite 使用 canonical target；
- [ ] Case/ownership/history 继续使用 product subject；
- [ ] Hub enrollment 校验未被放宽；
- [ ] global identity 不进入 public DTO 或敏感日志；
- [ ] 定向测试和后端验证门通过；
- [ ] 未接管 failure schema、Job truth 或 local runtime 的范围。
