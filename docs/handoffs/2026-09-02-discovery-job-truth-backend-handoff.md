# 后端 Handoff：Discovery & Job Truth

> 本文可直接发送给另一台机器上的后端 Coding Agent，用于从零上下文编写 Spec/Plan 并实施。文中只使用仓库相对路径，不依赖此前聊天、浏览器会话、测试账号、截图、其它机器或本机路径。

## 1. 目标、基线与唯一职责

- 目标仓库：Recruitment 后端仓库。
- 核对基线：`origin/release/0.2.5@45f7323e34f6f6db11faee658144e28d338b36be`。
- 目标：让双向发现推荐的资格门槛、岗位结构化要求与公开 match basis 都来自可验证的权威事实。
- 本 Handoff 独占 Job/Discovery 领域 truth；不要同时修改 Hosted Agent global identity、task target、Agent failure enums 或 local runtime。

本轮包含三个紧密耦合的后端能力：

1. 招聘方因缺少已验证组织而不可发现候选人时，返回精确、owner-safe 的错误；
2. 候选人与岗位类别不一致时，在进入评估/排序/持久化前执行双向 hard gate；
3. 经验与学历要求必须显式确认，并把“已确认/未确认”贯穿写模型、公开投影与 match basis。

## 2. 当前问题

### 2.1 组织门槛缺少精确错误

招聘方 owner 对自己的 active job 发起发现请求时，如果 viewer 没有可验证的组织绑定，领域会拒绝请求，但公开合同不能稳定区分这一情况与通用冲突/失败。前端无法给出准确恢复指引。

### 2.2 类别不符仍可能入榜

当前 category mismatch 只参与打分或扣分；高分的跨类别对象仍可能进入推荐结果、后续评估或 match persistence。这与“岗位类别/求职类别是基本资格条件”的产品语义不一致。

### 2.3 自由文本与结构化要求可以互相矛盾

岗位 `requirements` 文本可以写明确经验/学历门槛，但结构化字段仍是空值或默认值。系统随后可能把缺失的结构化事实当作“不要求”，并产生“符合经验/学历要求”的确定性理由。

不能用 regex 或 LLM 从自由文本静默反推结构化 truth。必须让创建/编辑者显式确认。

## 3. 交付 A：精确的组织验证错误

### 3.1 适用条件

只在以下条件全部成立时返回精确 owner-safe 错误：

- 当前 principal 是该 job 的合法 owner；
- job 存在且处于允许发现的 active 状态；
- 当前 owner 缺少发现候选人所需的已验证组织权威事实。

建议公开类型：

```text
organization_verification_required
```

建议 HTTP status 为 `409 Conflict`；若仓库的冻结错误规范要求其它 status，Spec 可以调整 status，但必须保持唯一且稳定的 error type，并同步两份 OpenAPI 与 BFF strict mapping。

### 3.2 Privacy 与授权约束

- foreign job、missing job、无权访问 job 不能通过该错误探测资源或 owner 状态；
- 不得因为发现请求而自动认领、创建或绑定组织；
- 不得把 verification provider、内部 review 状态或组织敏感字段写入 error detail；
- 保持现有 not-found/forbidden privacy envelope。

## 4. 交付 B：双向 category hard gate

类别 gate 必须基于 exact canonical category ID，而不是 label、自由文本或模糊相似度。

两条方向都要覆盖：

- candidate discovers jobs：candidate intention category 与 job category；
- recruiter discovers candidates：job category 与 candidate intention category。

Gate 必须发生在：

1. 进入昂贵 evaluation/LLM 之前；
2. ranking/scoring 之前；
3. recommendation/match persistence 之前。

不匹配对象应被过滤，不是仅扣分。缺失、失效或无法解析的 category 按现有资格规范 fail closed；Spec 要冻结 legacy 数据行为，不能把 unknown 当 match。

同时检查 refresh/reconciliation/async rebuild 路径，确保没有一个后台入口绕过 gate 把跨类别结果重新写回。

除非最终公开 schema 确实变化，本能力不需要新增前端状态；现有列表刷新应自然收到被过滤后的权威结果。

## 5. 交付 C：结构化要求显式确认

### 5.1 写模型

在 job revision/CAS 模型中增加一个与当前 revision 绑定的显式确认事实。最终字段/对象名由 Spec 冻结，例如：

```text
structured_requirements_confirmed
```

约束：

- create/update 必须显式提交确认语义；
- `none` 是合法、明确的结构化选择，但不能由缺字段自动默认；
- confirmation 必须与被确认的经验/学历结构化值处于同一原子 revision；
- 编辑结构化要求或相关自由文本后，不得错误沿用旧 revision 的确认；
- 保持现有 `If-Match`/CAS/幂等语义。

自由文本 `requirements` 继续存在，但只是补充说明，不是可执行 truth 的替代来源。禁止 regex、关键词或 LLM 自动确认。

### 5.2 Legacy 数据

对迁移前已有 job：

- 仍可读取和编辑；
- 未经显式确认时，其经验/学历 match basis 是 `unknown/unconfirmed`；
- 不得显示或返回“满足经验/学历要求”这一确定性结论；
- 下一次相关 edit 必须显式确认后才能进入 confirmed 状态。

Spec 必须冻结 migration/backfill 策略。不能把所有 legacy row 直接 backfill 为 confirmed；若需要区分“历史结构化字段明确存在”和“默认零值”，必须用可审计规则并保守处理。

### 5.3 读模型与 match basis

确认状态必须贯穿：

- owner job detail/list projection；
- create/update response；
- candidate-visible job projection中允许公开的要求事实；
- Discovery/evaluation 输入；
- recommendation/match reason projection；
- BFF strict DTO 与两份 OpenAPI。

未确认时必须安全表达为 unknown/unconfirmed，或完全省略相关正向 reason；绝不能默认为 satisfied。前端不应从 `requirements` 文本自行解析。

## 6. 数据与接口设计要求

Spec 必须冻结：

- migration 名称与 up/down/rollback 约束；
- job command、domain model、revision/CAS 行为；
- exact confirmation field 和 enum；
- legacy projection；
- match basis DTO；
- `organization_verification_required` 的 method/path/status/envelope；
- Mobile API、BFF API 和两份 OpenAPI 的对应 diff。

所有新增公开枚举必须 strict decode；unknown server value 保持 fail closed，不能静默转成“符合”。

## 7. 推荐代码范围

按最新主干定位实际文件，重点检查：

```text
apps/recruitment/internal/job/
apps/recruitment/internal/store/
apps/recruitment/internal/discovery/
apps/recruitment/internal/candidateevaluation/
apps/recruitment/internal/matchcase/
apps/recruitment/internal/mobileapi/
apps/recruitment/internal/bff/
apps/recruitment/openapi/
apps/recruitment/internal/bff/openapi/
apps/recruitment/migrations/
apps/recruitment/testdata/
```

实际路径以代码为准，优先扩展现有 Job/Discovery 服务与 projection，不建立第二套推荐 truth。

## 8. 必须覆盖的测试

### 8.1 组织错误

1. owner + active owned job + 无 verified org 返回精确错误；
2. verified org 控制组继续发现；
3. foreign/missing/inactive job 不泄露组织状态；
4. 请求不会自动创建/claim/bind org；
5. Mobile API、BFF、两份 OpenAPI status/envelope 一致。

### 8.2 Category gate

1. 两个方向 exact same category 可继续；
2. 两个方向 mismatch 在 evaluation/ranking/persist 前过滤；
3. missing/invalid category 按冻结规则 fail closed；
4. refresh、reconcile、async rebuild 不会重新写回 mismatch；
5. 验证 mismatch 不产生 Hosted Agent task 或 match row。

### 8.3 Structured requirements

1. create/update 缺显式确认时按冻结合同拒绝；
2. 显式 `none` 合法；
3. CAS 冲突不能让 confirmation 与 requirement 跨 revision；
4. legacy unconfirmed 可读/可编辑但不产生正向经验/学历 reason；
5. confirmed job 正确产生允许的 basis；
6. 编辑相关字段后 confirmation 不被错误继承；
7. projection、BFF DTO、OpenAPI strict enum 一致；
8. 自由文本中的数字/学历词不会自动改写结构化 truth。

## 9. 独占边界与非目标

本 Handoff 不修改：

- principal product subject → global identity 映射；
- Hub `target_identity_id`、enrollment 或 Hosted Agent task creation；
- P4/P5/P6 Agent failure code/DTO；
- `dev-local.sh`、Compose、LLM provider/model 或 fixtures 的 runtime owner；
- 前端展示、表单和 strict decoder。

上述能力分别由以下 Handoff 负责：

```text
docs/handoffs/2026-09-02-hosted-identity-core-backend-handoff.md
docs/handoffs/2026-09-02-hosted-failure-contracts-backend-handoff.md
docs/handoffs/2026-09-02-local-ai-runtime-backend-handoff.md
```

## 10. 并行关系与下游交付

本工作可作为 Wave 1 与 Resume Suggestion API、Hosted Identity Core、Local AI Runtime 的配置部分并行。

Hosted Failure Contracts 需要校准本 Handoff 最终的 P4/Discovery OpenAPI，但不得接管组织、category 或 Job schema。依赖本合同的前端工作是：

`docs/handoffs/2026-09-02-mutual-discovery-frontend-handoff.md`

完成时交付：

- 精确 commit；
- migration 与 rollback 说明；
- 两份 OpenAPI diff；
- error/DTO/legacy/match basis 表；
- verified/unverified、category match/mismatch、confirmed/unconfirmed fixtures。

## 11. 完成标准

- [ ] owner-safe `organization_verification_required` 精确且不泄露；
- [ ] 双向 category mismatch 在 evaluation/ranking/persist 前 hard gate；
- [ ] structured requirements 与 confirmation 原子绑定 revision；
- [ ] legacy unconfirmed 不被表述为 satisfied；
- [ ] migrations、commands、projections、Discovery、BFF 与两份 OpenAPI 一致；
- [ ] 定向测试和后端仓库验证门通过；
- [ ] 没有修改 global identity、Hosted failure contract 或 local runtime owner 范围。
