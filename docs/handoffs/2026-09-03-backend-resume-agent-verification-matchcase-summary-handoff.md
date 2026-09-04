# 后端 Handoff：简历时间、Agent 成功链路、候选实名与 MatchCase 精确统计

> 本文可以直接发送给另一台机器上的后端 Coding Agent。接收者不需要此前聊天、测试账号、测试材料、浏览器会话、本机路径或其它 Handoff 才能理解需求。开始前必须 fetch 远端并以最新 `release/0.2.5` 为基线核对代码；文中的路径均为仓库相对路径。

## 1. 目标与拆分原则

目标仓库：包含 `apps/recruitment`、`apps/recruitment-bff` 与 `apps/hub` 的后端 monorepo。

本 Handoff 包含四个可分别写 Spec/Plan、建分支和评审的工作包：

1. `BE-RD-01`：把简历中的“至今/current/present”解析为开放结束日期；
2. `BE-AG-01`：跑通 candidate/recruiter 的 Hosted Agent 规则解释成功链路；
3. `BE-IV-01`：提供候选人实名认证的权威异步审核能力；
4. `BE-MC-01`：提供双端 MatchCase 跨页精确统计合同。

建议把四项拆成四份实施 Plan。`BE-RD-01`、`BE-IV-01`、`BE-MC-01` 可以并行；`BE-AG-01` 应在 hosted-agent failure contracts 的最新实现之上集成。不要把四项揉成一个大改动，也不要用一项的迁移阻塞其它三项发布。

共同约束：

- 保持 owner、role、organization 和 global identity 边界；不接受调用方传任意 owner ID。
- 新公开合同同步修改 Recruitment internal API、BFF handler/client、OpenAPI 和合同测试。
- 所有个人资料、审核材料和 Agent 指令日志遵循现有 redaction/no-store 约束。
- 先阅读 `docs/testing/TEST_DESIGN_RULES.md`、`docs/testing/GLOBAL_TEST_CASES.md` 与 `docs/testing/WORKTREE_TEST_HANDOFF.md`，再编写测试计划。
- 测试样本只使用合成姓名、经历、证件和岗位，不提交真实用户资料。

## 2. 与现有工作的边界

### 2.1 已完成或不应重做

- Local Recruitment PDF/JD parser 已支持真实 LLM provider，默认兼容模型已切到 `openai/gpt-5.6-luna`；本批不重做 real/stub mode、provider check 或通用 local stack。
- 简历解析 suggestion API、onboarding 预填和在线简历持久化已有各自 owner；本批只校正“开放结束日期”的解析语义。
- 当前前端“我的”页会诚实显示 `N / N+ / 0 / —`；本批新增精确合同，不回滚或复制该前端过渡实现。
- JD 上传入口由单独的前端设计/实现负责，不在本批。

### 2.2 Hosted Agent failure-contracts 分支

正在进行的 `impl/hosted-agent-failure-contracts` 负责 P4/P5/P6 的公开失败枚举、DTO、OpenAPI、错误映射和失败可观察性。本 Handoff 不修改、复制或撤销这些内容。

`BE-AG-01` 只负责让合法指令在真实 Hosted Agent runtime 中产生符合现有严格业务 schema 的成功结果。若模型输出被拒为 `invalid_agent_control_proposal`，语义上属于解释结果不合法，不应被笼统映射为 `agent_unavailable`。最终失败码映射必须与 failure-contracts 分支集成后核对，但失败合同仍由该分支独占。

### 2.3 历史设置 Handoff

历史 `docs/handoffs/2026-09-01-my-settings-wiring-backend-handoff.md` 中候选实名部分由 `BE-IV-01` 取代。接收者不得同时实施两份文档中的候选实名方案。

## 3. BE-RD-01：开放结束日期的解析语义

### 3.1 已确认现象与根因

中文简历中的“至今”曾被解析为与开始月份相同的 `end_month`。错误在解析结果到达前端前已经存在。

相关代码位于：

```text
apps/recruitment/internal/resumeparse/openrouter.go
apps/recruitment/internal/resumeparse/types.go
```

当前 parser prompt/schema 没有明确规定 `至今/current/present/now` 的闭合语义。现有 `Extracted[T]` 已能表达字段缺失；公开 suggestion/resume schema 也允许 `end_month` 缺失。前端已经把空 `end_month` 渲染为“至今”，因此不需要增加新的 wire enum 或布尔字段。

### 3.2 目标行为

- 工作经历和教育经历出现 `至今`、`当前`、`present`、`current`、`now` 或等价表达时，`end_month` 必须 absent/null。
- 文档明确给出结束年月时继续返回规范化 `YYYY-MM`。
- 文档没有结束时间且无法证明仍在进行时，不得臆造开始月或当前月；保持缺失并保留可审计 evidence。
- 不改变 `start_month`、source text、confidence、evidence ID 的既有语义。
- 不改变 suggestion accept、onboarding prefill 或在线简历的公开合同。

### 3.3 实施要求

1. 在 system prompt 与对应 JSON schema 描述中明确开放结束日期规则，工作和教育经历使用同一语义。
2. 若 provider 输出字符串形式的 `至今/present`，在严格解码边界安全归一为 absent，而不是把它当 `YYYY-MM` 或回填开始月。
3. 对真实中文样本增加 parser 合同测试；测试不能只覆盖英文 `present`。
4. 保持 all-null-or-complete `Extracted[T]` 不变量，不引入只填 value、缺 source/confidence 的半残对象。

### 3.4 验收

- `2022-06 至今` 得到 `start_month=2022-06`、`end_month=null/absent`。
- `2022-06—2024-03` 得到两个规范月份。
- `2022-06` 且没有持续语义时不伪造结束月。
- 同一份两页合成简历通过 real Luna provider 解析后，suggestion 与最终在线简历仍保留开放结束日期。
- 既有 parser unit/contract tests 全部通过。

## 4. BE-AG-01：Hosted Agent 规则解释成功链路

### 4.1 已确认现象与根因方向

前端能够创建 Agent 规则解释任务，但真实 local Hub 运行后任务失败为 `invalid_agent_control_proposal`。这说明请求已进入后端，失败发生在模型输出与严格工具参数/业务 schema 的兼容边界。

重点代码与配置：

```text
apps/hub/application-skills/recruitment-v1/SKILL.md
apps/hub/compose/litellm-config.dev-real.yaml
apps/hub/scripts/dev-mt-local.sh
apps/recruitment/internal/mcpgateway/tools.go
apps/recruitment/internal/domain/submissions.go
apps/recruitment/internal/agentcontrol/coordinator.go
```

当前 `agentControlToolSchema` 使用嵌套 `$defs`、`$ref` 与 `oneOf`；业务层还会严格验证 proposal vocabulary。local Hosted Agent 当前可能被脚本固定到 DeepSeek。不能仅凭失败码断言是模型能力问题，也不能通过放宽业务枚举把非法结果当成功。

### 4.2 目标行为

candidate 和 recruiter 各有至少一条合成自然语言规则能完整经历：

```text
create task → interpreting → ready → accept → 持久化规则 → 刷新后查询一致
```

同时保持：

- 非法、含糊或越权指令继续安全失败；
- accepted vocabulary、role fence、idempotency 和 revision/CAS 语义不变；
- 不启用 mock runtime、inline test executor 或隐藏 fallback；
- 不依赖重启、手改数据库或浏览器内存制造成功。

### 4.3 实施顺序

1. 使用脱敏合成指令捕获失败层级：原始模型输出只进受控测试 artifact，不进普通日志；记录是 provider tool-call decode、MCP schema decode 还是 domain semantic validation 拒绝。
2. 为捕获到的合法意图增加最小失败测试，证明当前 producer 输出不能被既有 consumer 接受。
3. 优先修 producer 侧兼容性：校准 Hub skill 指令、工具描述或 provider-facing schema，使模型稳定产生现有领域 vocabulary。若 provider 不可靠支持 `$defs/$ref/oneOf`，可以为 provider 暴露等价但更平坦的工具 schema，再在边界转换并由领域层复验；不得删除领域校验。
4. 用真实 provider 对比当前模型与 `openai/gpt-5.6-luna`。如果 Luna 通过双角色稳定 smoke，而当前 local 模型不能，在 local real Hosted Agent 配置中把 Luna 冻结为 canonical dogfood 模型，并同步脚本、示例和测试。此决定只影响 local real Hosted Agent；生产模型政策不在本 Handoff 中改变。
5. 与 failure-contracts 分支 rebase/merge 后核对终态错误映射：`invalid_agent_control_proposal` 不得被误报为 provider 不可用。

### 4.4 必测场景

- candidate：一条合法筛选/沟通授权规则解释、接受、列表回读。
- recruiter：一条合法筛选/委托洽谈规则解释、接受、列表回读。
- unsupported/越权意图：不会产生可接受 proposal。
- 严格参数错误与领域语义错误：保留准确、稳定、可观察的不同失败原因。
- 重复 accept、旧 revision、跨角色 task、跨 subject task：继续被拒绝。
- runtime 证据同时证明 task source、Hub work record 和 Recruitment 持久化结果一致。
- 连续多次真实模型 smoke 不依赖 fallback；测试记录 provider/model 名称但不包含 key、完整简历或个人资料。

### 4.5 非目标

- 不改 P4/P5/P6 公开失败 enum/DTO/OpenAPI；
- 不新增前端错误 UI；
- 不重写通用 Hub runtime；
- 不把 DeepSeek 或 Luna 的模型政策扩展到 production；
- 不降低业务 schema 严格度来追求表面成功率。

## 5. BE-IV-01：候选人实名认证

### 5.1 产品边界

当前候选侧没有可查询或发起实名认证的权威合同。手机号 OTP 只证明登录凭据，在线简历姓名也不是实名认证。第一版采用异步人工审核：

```text
unverified → pending → verified
                     ↘ rejected
```

该能力属于 Recruitment 中 candidate product subject 的独立 aggregate，不是平台级 universal identity，也不复用/推导 recruiter 的 `personal_verification_status`。同一个 global human 在 candidate 和 recruiter 角色下不会自动互相认证。

### 5.2 推荐公开合同

Owner 端：

```text
GET  /api/v1/me/identity-verification
POST /api/v1/me/identity-verification-requests
GET  /api/v1/me/identity-verification-requests
POST /api/v1/me/identity-verification-requests/{request_id}/cancel
```

Recruitment internal API 提供等价 owner 路由供 BFF 调用；internal reviewer 路由按现有 organization verification 管理模式建立 list/detail/evidence/approve/reject，不暴露到公共 BFF。

Owner summary 使用闭合合同：

```json
{
  "result": {
    "status": "unverified",
    "verified_name": null,
    "current_request": null,
    "revision": 1,
    "updated_at": "2026-09-03T00:00:00Z"
  },
  "meta": { "request_id": "...", "api_version": "v1" }
}
```

`status` 只允许 `unverified | pending | verified | rejected`。`verified_name` 只在 `verified` 时非空。`current_request` 为 null，或只包含 owner 安全的 `request_id`、`status`、`revision`、`submitted_at` 和闭合拒绝原因。拒绝原因只允许：

```text
document_unreadable
identity_mismatch
document_expired
unsupported_document
other
```

不得向 owner 暴露 reviewer 身份或内部自由文本。

### 5.3 提交合同与文件规则

提交使用 multipart：一个 JSON metadata part 加证据文件 part。

Metadata：

```json
{
  "legal_name": "合成姓名",
  "document_type": "national_id"
}
```

`document_type` 只允许 `national_id | passport | other_government_id`。证据只允许一份 PDF，或一至两张 PNG/JPEG；复用现有 upload 大小、MIME sniffing、malware scan 和对象存储约束。不要把证件号码作为独立结构化字段接收或保存。

### 5.4 状态机、安全与一致性

- 每个 candidate 同时最多一个 pending request；重复提交使用现有 idempotency convention。
- owner 只能取消自己的 pending request；cancel 使用 revision/CAS，不能覆盖已终审状态。
- approve/reject 是 serializable terminal action；重复 reviewer action 幂等或明确 conflict。
- approve 保存 `verified_name`、opaque verification source reference、verified_at；不保存可公开枚举的原始对象 key。
- request、review action 和状态转换写不可变 audit；敏感 metadata/evidence 加密存储，禁止进入普通日志、tracing attribute 或 analytics payload。
- terminal decision 或 cancel 后 30 天内删除证据 bytes；保留 digest、opaque source reference、状态和审计元数据直到账号删除。
- 纳入现有账号导出与账号删除流程：导出只包含 owner 安全状态/历史，不包含证据 bytes 或 reviewer note；删除时清理 aggregate、audit 中可识别字段和对象存储证据。
- 所有 owner response 使用 `Cache-Control: no-store`。

### 5.5 明确不联动的域

- verified name 不自动覆盖在线简历 `real_name`。
- 不改变匿名发现、MatchCase 身份披露或岗位卡片展示。
- 不把 candidate verification 投影到 recruiter profile。
- 本批不实现自动 OCR、人脸比对或第三方 KYC。

### 5.6 必测场景

- 初始 unverified；合法提交后 pending；owner 列表/summary 一致。
- 非法 MIME、伪装扩展名、超大小/数量、含恶意内容被拒且无对象泄漏。
- 第二个 pending、重复 idempotency key、跨 owner 读取/取消被正确处理。
- approve/reject/cancel 的竞态只有一个终态获胜，revision 单调递增。
- rejected 仅返回闭合 owner-safe reason；verified 只返回 verified name。
- 30 天证据清理、账号导出、账号删除和 audit redaction 有自动测试。
- candidate/recruiter 同一 global identity 的验证状态互不推导。

## 6. BE-MC-01：MatchCase 跨页精确统计

### 6.1 为什么必须新增专用 endpoint

当前 list/history response 严格闭合为 `{items,next_cursor}`。已发布前端 decoder 明确拒绝未知 `total` 字段。因此后端先在旧分页响应中增加字段会使旧前端整体解码失败，不是兼容发布。

必须新增专用静态路由，不修改现有 list/history response：

```text
GET /api/v1/me/match-cases/summary
GET /api/v1/recruiter/match-cases/summary
```

Recruitment internal API 提供镜像路由。路由注册时确保静态 `/summary` 不被 `/{case_id}` 捕获。

### 6.2 响应合同

```json
{
  "result": {
    "open_total": 123,
    "open_anonymous_screening_total": 31,
    "open_needs_action_total": 4,
    "ended_total": 18,
    "completed_total": 7
  },
  "meta": { "request_id": "...", "api_version": "v1" }
}
```

五个字段均 required、non-negative int64，response `additionalProperties: false`。第一版不接受 cursor、limit、job/intention filter 或任意 owner ID；统计当前角色当前 owner 的全部 MatchCase。

### 6.3 权威口径

- `open_total`：`lifecycle=open`。
- `open_anonymous_screening_total`：`lifecycle=open AND stage=anonymous_screening`。
- `open_needs_action_total`：使用现有 list 中同一个 viewer-relative `needs_action` predicate；candidate 和 recruiter 结果可能不同，不能用通用 status 代替。
- `ended_total`：`lifecycle=ended`。
- `completed_total`：`lifecycle=completed`。

前端产品映射据此冻结：

- candidate “在谈” = `open_total`；
- candidate “初筛中” = `open_anonymous_screening_total`；
- candidate “待你拍” = candidate viewer 的 `open_needs_action_total`；
- candidate “已归档” = `ended_total + completed_total`；
- recruiter “在谈” = `open_total`；
- recruiter “待拍板” = recruiter viewer 的 `open_needs_action_total`；
- recruiter “意向达成” = `completed_total`。

招聘方“在招岗位”继续来自 Job 合同，不属于该 summary。

### 6.4 实施要求

- 在 owner fence 内由数据库聚合完成；不得在 BFF 拉完所有分页后计数。
- 五项来自同一查询或同一一致性快照，避免 lifecycle 转换时出现互相矛盾的数字。
- 复用 list 的 lifecycle/stage/needs-action 领域谓词，避免统计口径漂移。
- candidate/recruiter role 隔离；错误角色按现有认证约定返回 403/安全错误。
- response 使用 `Cache-Control: no-store`；不得写静态缓存或跨主体缓存。
- 更新 domain/repository、internal handler/client、BFF handler 和双方 OpenAPI/contract tests。

### 6.5 必测场景

- 空账号五项均为 0。
- 超过默认分页大小（至少 51 条）仍返回精确总数，证明不是首屏长度。
- 混合 open/ended/completed、多个 stage 的统计准确。
- 同一 case 在 candidate/recruiter 视角有不同 `needs_action` 时，两端分别准确。
- lifecycle 并发转换期间 response 是一个自洽快照。
- owner/organization/role 隔离；跨主体不可观察数量。
- 大数据量不溢出，OpenAPI integer format 与实现类型一致。
- 现有 list/history 的 response bytes/schema 不新增字段，旧 strict decoder 仍通过。

## 7. 发布顺序与兼容性

1. `BE-RD-01` 可独立发布，不需要前端版本门控。
2. `BE-AG-01` 在 failure-contracts 最新提交上集成并执行真实 provider 双角色 smoke；成功链路和失败合同可以分别评审，但最终 release 必须同时通过。
3. `BE-IV-01` 先发布后端合同；旧前端没有调用，不受影响。新前端接入后再开放候选入口。
4. `BE-MC-01` 先发布专用 summary endpoint；旧前端继续 `N/N+`。新前端接入成功后才删除过渡显示。

不得用 feature flag 向旧 list/history response 偷加字段。公开 OpenAPI 先由后端落地，前端以精确后端 commit 生成/实现 decoder。

## 8. 验证与交付物

至少执行并保存脱敏结果：

```text
tools/test service recruitment --keep-going
tools/test service recruitment-bff --keep-going
```

完成 code review 后按仓库规则运行 affected tests；涉及 Hub 的 Plan 还需运行 Hub 自身 unit/integration tests，并在 local real provider 栈执行 candidate/recruiter 双角色 smoke。真实 provider smoke 不能替代 deterministic tests，stub tests 也不能替代真实成功链路证据。

每个 Plan 的交付说明必须包含：

- 基线和精确 commit；
- 修改的 OpenAPI/routes/domain/repository 文件；
- migration 与回滚方式；
- 所有测试命令及结果；
- 未打印 secret/PII 的证据；
- 与 failure-contracts、旧前端 strict decoder 和在途纯前端分支的兼容性说明。

## 9. 完成定义

- 中文“至今”通过 real provider 解析为开放 `end_month`，公开简历合同不变。
- 双角色合法 Agent 指令在 formal real runtime 中可解释、接受并持久化，且失败合同没有被重写或掩盖。
- candidate 能提交、查询、取消实名认证申请，reviewer 能安全终审，状态与证据生命周期受测试保护。
- candidate/recruiter summary 在跨页、混合状态和 viewer-relative 待办场景返回精确、自洽、隔离的数字。
- 四项均没有引入旧前端解码回归、Mock fallback、真实个人 fixture 或 production 模型政策变更。
