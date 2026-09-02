# 后端 / DevEx Handoff：Local AI Runtime

> 本文可直接发送给另一台机器上的 Coding Agent，用于从零上下文编写 Spec/Plan 并实施。文中只使用仓库相对路径，不依赖此前聊天、测试账号、浏览器会话、截图、本机 secrets 或本机路径。

## 1. 目标、基线与唯一职责

- 目标仓库：包含 Recruitment、Hub 与 local development tooling 的后端仓库。
- 核对基线：`origin/release/0.2.5@45f7323e34f6f6db11faee658144e28d338b36be`。
- 目标：让交互式 local dogfood 默认运行真实 LLM provider，并为 Recruitment PDF 解析与 Hosted Agent 提供可复现、可检查的真实运行环境。
- 本 Handoff 独占 local scripts、Compose、provider/model 配置、stub/real mode、local fixtures 与真实 runtime 验证。

本 Handoff 有两条不同模型通道，不能错误合并成一个 model setting：

1. Recruitment PDF parser / JD import 的 OpenAI-compatible provider；
2. Hub Hosted Agent runtime 的 tenant/model/capability 配置。

## 2. 原则：交互 dogfood 默认 real，自动测试显式 stub

当前 local dev 曾把 parser 固定到 stub，导致两页 PDF 等真实文档出现“无法解析”等误报。切换到真实 provider 后解析正常，说明这不是 PDF 页数能力缺陷，而是 local runtime 选择错误。

必须形成一个闭合、可发现的模式合同：

- 开发者正常启动 local stack 并用于浏览器 dogfood：默认 `real`；
- deterministic unit/integration test：显式选择 `stub`；
- real mode 配置缺失时快速失败并给出安全诊断；
- 禁止因 key/provider/model 不可用而静默回落 stub；
- 日志/命令输出不得打印 secret、Authorization header 或完整 provider response。

建议支持 `--llm-mode real|stub`，或遵循仓库已有 CLI/config convention 的等价单一开关。不要同时保留多个互相覆盖的环境变量。

## 3. 交付 A：Recruitment Parser / JD Import 真实 Provider

### 3.1 Canonical 配置

Resume parser 与 JD draft/import 应复用现有 `LLM_OPENAI_COMPAT_*` 配置族和同一套 provider client，不为每个 consumer 建立重复 client。

交互式 local 默认模型冻结为：

```text
openai/gpt-5.6-luna
```

推理强度：

```text
high
```

使用项目支持的 OpenRouter-compatible endpoint。把 Recruitment parser/JD import 的 `google/gemini-3.7-flash` 默认值、示例、fixture 和脚本引用全部替换为 Luna；同时搜索旧拼写/别名，防止一处仍覆盖新默认。

不要把 Hub Hosted Agent 当前模型顺便改成 Luna，见第 4 节。

### 3.2 Mode 行为

Real mode：

- parser/JD service 只依赖真实 provider；
- parser stub 不参与 health 或 runtime fallback；
- key/base URL/model 缺失时启动或 readiness 失败；
- provider check 能在不打印 secret 的情况下验证 endpoint/model/consumer 配置。

Stub mode：

- 只由显式 flag/config 启用；
- 继续提供 deterministic fixture 给 CI/unit/integration tests；
- 不需要真实 secret 或联网；
- 响应必须被明确标记为 stub 环境，避免被误当 dogfood 证据。

### 3.3 Provider check

实现或校准仓库现有工具，使以下语义可用；精确 CLI 以项目 convention 为准：

```text
tools/llm-provider check --consumer recruitment-parser
```

Check 至少验证：

- mode；
- endpoint 可达；
- model 已配置且 consumer 可用；
- credential 存在但不输出值；
- timeout/auth/model-not-found 分别给出可行动诊断。

## 4. 交付 B：Hosted Agent Local Runtime

### 4.1 不统一两条模型通道

Hub real runtime 当前可能通过 OpenRouter 使用 DeepSeek 或其它已登记模型。只要它满足 tenant/model/capability 合同，本 Handoff 不把 Hub 模型强制改成 Luna。

把 Hub 与 parser 的模型统一是独立产品/成本/质量决策，不在本轮发生。本文只验证 Hub 使用的是“真实、已配置、可消费”的模型，而非 mock runtime。

### 4.2 启动模式与 enrollment fixture

校准当前 Hub local dev script，使类似以下意图的启动方式可复现：

```text
apps/hub/scripts/dev-mt-local.sh REAL --recruitment
```

精确参数必须按最新 CLI 冻结。fixture 必须正式建立：

- `application_id=recruitment`；
- `capability_profile=recruitment.v1`；
- candidate 与 recruiter 对应的 active global identity；
- 正确 tenant/model access；
- Recruitment application enrollment；
- 一个 verified organization 与 active job；
- 一个有 PDF 简历、在线简历和求职意向的 candidate。

Fixture 只服务 local/test 环境，不得让产品运行时自动 enrollment 或绕过 Hub 准入。

### 4.3 Formal runtime wire

核对并处理：

```text
docs/known-issues/zeroclaw-runtime-wire-mock-only-recruitment-application.md
```

如果对应 runtime wire 修复已在其它分支/提交中进行：

- 不重复实现；
- 校准到精确提交；
- 将 `verification_pending` 收敛为经过真实 runtime 验证的结论。

真实验收必须证明 task 由 formal Recruitment runtime 消费，不能命中 `mock-recruitment`、测试 inline executor 或隐藏 fallback。

## 5. Local scripts 与 Compose 责任

本 Handoff 是以下配置面的唯一修改 owner：

- local stack 入口脚本，例如 `dev-local.sh`；
- Recruitment/Hub Compose service、profiles、health/readiness；
- parser/JD provider env wiring；
- model defaults/examples；
- parser stub service/profile；
- LLM provider check 工具；
- Hub real runtime dev script；
- local identity/enrollment/job/resume fixtures；
- local dogfood README/runbook。

要求：

- real/stub mode 的服务集合和 health 依赖是显式的；
- `real` 不因为 stub 未启动而失败，也不依赖 stub；
- `stub` 不需要真实 key；
- 不把本地绝对路径或个人 secrets 写入仓库；
- `.env.example` 只写变量名和安全占位，不写有效 key；
- frontend origin/CORS/认证回调使用仓库已批准的 canonical localhost origin。

## 6. 推荐代码范围

按最新主干定位实际文件，重点检查：

```text
dev-local.sh
compose*.yml
.env.example
tools/llm-provider/
apps/recruitment/internal/resumeparse/
apps/recruitment/internal/job*/
apps/recruitment/testdata/
apps/hub/scripts/
apps/hub/config/
apps/hub/testdata/
docs/known-issues/zeroclaw-runtime-wire-mock-only-recruitment-application.md
docs/
```

不要为了配置变更重构 Recruitment product domain 或公开 API。

## 7. 验证矩阵

### 7.1 Parser/JD 配置验证（可在 Wave 1 完成）

1. clean local real mode 缺 credential 时快速、安全失败；
2. real mode provider check 通过且不打印 secret；
3. real mode 上传一份 synthetic 两页简历并得到结构化结果；
4. real mode 上传一份 synthetic JD 并得到 draft；
5. provider/model 是 `openai/gpt-5.6-luna` + `high`；
6. 搜索配置与文档，不再残留 parser/JD 的 Gemini 默认；
7. real mode 关闭/删除 stub service 后仍能工作；
8. explicit stub mode 无 key、无联网仍通过 deterministic tests；
9. provider auth/model/timeout 错误各自有清晰诊断且无 secret。

Synthetic PDF 不包含真实个人/公司信息；可以是两页，以证明“2 页无法解析”不是系统限制。

### 7.2 Hosted Runtime 配置验证（可在 Wave 1 完成）

1. candidate/recruiter global identity active；
2. 两者 enrollment 到 `recruitment` + `recruitment.v1`；
3. tenant/model access 正确；
4. job/org/resume/intention fixture 可幂等重建；
5. Hub real runtime ready；
6. 未启动 `mock-recruitment` 或等价 fallback。

### 7.3 最终真实 Agent E2E（Wave 3）

此阶段依赖以下后端提交先完成：

```text
docs/handoffs/2026-09-02-hosted-identity-core-backend-handoff.md
docs/handoffs/2026-09-02-hosted-failure-contracts-backend-handoff.md
```

至少执行并保存脱敏证据：

- candidate P4 AI 筛选/委托；
- recruiter P4 AI 筛选/委托；
- P5 至少一个 `screen_resume` 或当前正式可用的 screening task；
- P6 `interpret_agent_control` 从 interpreting 到成功/安全失败终态；
- task source、work record、runtime/provider completion 三层记录一致；
- 刷新后产品 API 返回持久化状态，不依赖浏览器内存。

E2E 失败时区分 identity/enrollment、runtime wire、provider、product contract，不用重启/手改数据库把失败掩盖成成功。

## 8. 测试要求

- CLI flag/env precedence table tests；
- real/stub Compose/profile snapshot 或 shell tests；
- readiness dependency tests；
- provider check 的 auth/model/timeout/redaction tests；
- fixture 幂等与 cleanup tests；
- no-secret/no-absolute-path repository scan；
- parser/JD consumer config tests；
- Hub task source/work/runtime integration tests；
- 项目要求的 lint/unit/integration/compose config validation。

真实 provider 测试若不能进常规 CI，应有显式 opt-in gate 和可复现 runbook；stub CI 不能替代交付前的一次真实验证。

## 9. 独占边界与非目标

本 Handoff 不修改：

- candidate suggestion API、online resume persistence；
- Job organization/category/structured requirements；
- product subject → global identity resolver 或 task callsite；
- P4/P5/P6 public failure enum/DTO/OpenAPI；
- 前端页面。

对应 owner：

```text
docs/handoffs/2026-09-02-resume-suggestion-api-backend-handoff.md
docs/handoffs/2026-09-02-discovery-job-truth-backend-handoff.md
docs/handoffs/2026-09-02-hosted-identity-core-backend-handoff.md
docs/handoffs/2026-09-02-hosted-failure-contracts-backend-handoff.md
```

## 10. 实施波次与交付物

- Wave 1：模式开关、Luna parser/JD config、Compose/readiness、provider check、Hub fixture/runtime readiness，可与其它 capability 并行。
- Wave 3：Identity Core 与 Failure Contracts 合并后，执行唯一一次完整 real-provider Hosted Agent E2E。

交付物：

- 精确 commit；
- real/stub 配置矩阵；
- 不含 secret 的启动/检查/清理命令；
- fixture IDs 的生成规则而不是个人环境值；
- parser/JD real run 的脱敏证据；
- Hosted task source/work/runtime 的脱敏证据；
- known issue 的最终状态与所依赖提交。

## 11. 完成标准

- [ ] 交互式 local dogfood 默认 real，test stub 必须显式选择；
- [ ] parser/JD 默认 Luna + high，且不存在 Gemini 默认残留；
- [ ] real mode 不依赖/回落 parser stub；
- [ ] Hub 与 parser 模型通道没有被错误统一；
- [ ] Hub Recruitment enrollment/fixture 幂等且只作用 local/test；
- [ ] formal runtime 无 mock bypass；
- [ ] secrets 与个人路径未进入代码、日志或交付文档；
- [ ] Wave 1 配置测试与 Wave 3 真实 E2E 均有可复核证据；
- [ ] 未修改 product API、identity resolver 或 public failure schema。
