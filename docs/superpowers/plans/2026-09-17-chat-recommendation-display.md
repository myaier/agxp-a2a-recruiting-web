# 聊天、推荐展示与企业屏蔽 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Claude Code 使用 superpowers:subagent-driven-development；Codex 使用 superpowers:executing-plans。按 Task 依赖连续实施，步骤用 checkbox 记录；本文件不能代替批准 Spec。

**Goal:** 完成双端真实聊天资料、统一头像/在线简历、招聘推荐六维解释及企业屏蔽语义修正。
**Architecture:** 沿用 Recruitment 授权和组织屏蔽，BFF 补紧凑投影；推荐生成时同源保存六维解释；前端以小型展示组件对齐 Mock/Backend。不新增服务、缓存、模型调用或历史数据兼容层。
**Tech Stack:** Go / PostgreSQL / BFF OpenAPI；React / TypeScript / CSS Modules；Vitest / Playwright / 后端 tools/test。
**Spec:** `docs/superpowers/specs/2026-09-17-chat-recommendation-display-design.md`，用户在“继续写0上下文Plan，跑 /claude-review-loop 和写执行提示词”中批准；revision `3ff331f1e62a0507b8a6491fdd2aaafa15e0777e`，blob `2f39a9bb333b8f995f5cb43cd4d9c399d2bd671a`。

## Global Constraints

- 一份 Plan 覆盖两仓库，文档保存在前端仓库。FE 路径相对前端根，BE 路径相对 agxp-monorepo 根；每条命令在所属仓库根执行。用户提供各自已有工作区，均记作 `.`；不硬编码另一仓库位置、不自动创建第二用户工作区、不 stash/reset/clean。
- 前端冻结研究基线 `bb6ff6e03e6f542a3fe5a0604e6c9ced326a7386`，批准 Spec commit 如上；后端研究基线 `719ead0a0a4368b4dc2ff7e85d57ab74f47e9095`。开工记录两仓 HEAD 为实施基线，核验相对研究基线的有关差异。不得在后端用户主分支直接提交；复用用户指定任务分支，同目录可建任务分支，已有未提交改动保留。
- target：前端 `main`、后端 `release/0.2.5` 是当前规划候选，未授权 push；final gate 必须展示并获准两仓具体 ref/SHA 后才同步/合入。若执行环境不同，只读核对并报告，不猜另一个目标。
- 先完整读各仓 AGENTS.md/CLAUDE.md；BE 测试前运行 `tools/cred-sync.sh worktree`、`tools/dev-env.sh ensure base`，读测试三份规则。逻辑 skill 按当地安装发现，不记录规划机器路径。
- 新合同在两仓成对完成后才联调，旧前端严格解码不承诺兼容。Tasks 1–3 完成后在本文件实施记录写 BE commit、实际响应形状和测试 receipt；Tasks 4–8 消费同一实施会话已验证的精确提交（本 Plan 授权此依赖方式），不需要提前合目标。新 session 必须携带 Spec/Plan Git 对象且能读取两仓。
- 姓名和头像只能使用当前授权资料；不拿 alias、职位或其他账号资料补姓名，不拿登录手机号填简历。资料失权即清理。
- 不改变评分、排序及投递建会话准入；六维满分 25/35/15/10/5/10，总和 100。未知为“未核对”，与“未匹配”分开。
- 双端真人消息头像 32×32px 圆形；图片缺失/失败取各自姓名 trim 后首个 Unicode 字符；姓名无值为“·”。列表头像尺寸保持原值。
- 不迁移旧 hidden、不回填旧推荐、不重解析用户 PDF。仅明确的可重建测试环境准备新数据；不自动清空任意现有数据库。
- 只修 Spec 范围。必要结构 migration 保留；不借机重构全站、不新建第二企业屏蔽状态、不修未经证实的亮点生成故障。

## Task index 与执行档位

Task count: 9
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

**计划本身复杂度：高。** 跨仓库协议、隐私投影、持久化和浏览器展示联动。
**零上下文漂移风险：高。** 身份冻结/即时隐私边界及双仓实际版本有差异风险；执行模型使用当前可用的行业顶尖模型。模型要求不替代精确合同。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|BE 移除旧 hidden；无前置|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|2|BE 会话对方资料；依赖 1 权限边界|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|3|BE 六维解释快照；独立后端交付|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|4|FE 企业开关与合同；依赖 1|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|5|FE 会话列表/页头；依赖 2|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|6|FE 双端头像；依赖 5|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|7|FE 聊天纸身；依赖 5|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|8|FE 推荐解释/公司/亮点；依赖 1、3|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|9|浏览器跨页面责任及契约 fixture；依赖 4–8|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|

顺序采用 1→2→3→4→5→6→7→8→9；不为并行增加分支或额外文档。每 Task 只提交明确列出的变更；共同合同文件顺序编辑。收尾不计 Task。

## 冻结接口与错误语义

以下 bff.invalid 仅为路由示例，实际请求使用当前 BFF 同源地址。

1. `GET https://bff.invalid/api/v1/{me|recruiter}/conversations` 与 `.../{conversation_id}`：available context 增加 required `counterpart`，值为 null 或 `{name,avatar_url,company_name,title}`，四字段均 string|null；unavailable 仍无 context。招聘侧 company_name=Case 冻结用人企业，title=投递岗位；求职侧 company_name=可信发布企业，title=招聘者职务。内部四键 `{candidate_identity,publisher_profile,company_name,title}` 按 Spec §3.2；BFF 转换媒体 URL，不泄露内部 media_id。单个资料补读失败不让消息不可用，授权失败维持原拒绝。
2. 经历写入/读取/冻结在线简历移除 hidden 字段；前端闭合解码同步删除。组织屏蔽复用 `POST https://bff.invalid/api/v1/me/privacy/organization-blocks`（organization_id/source=manual、既有 If-Match/幂等键）和 `POST .../{organization_id}/unblock`（risk_acknowledged、If-Match）。不存在时无重复删除；已有非 manual 来源不能改写；409 重读不盲重试；失败保留待提交意图及实际服务端状态的区别，标为未生效并提供重试；不得把待提交值当成功。同企业只对应一份有效屏蔽状态。
3. 推荐详情增加 required `match_analysis={ranking_version:'discovery-ranking.v2',dimensions:[...]}`。六个维度固定次序 `category,skills,experience,location,workplace_mode,compensation`；每行四键 `{dimension,status,score,max_score}`，status 闭合 matched/partial/unmatched/unknown，score 整数合法范围，总和=match_score。列表不新增 match_analysis；两方向新批次存储同源结果，只有招聘详情对外开放。仅 skills/compensation 允许 partial；unknown/unmatched 分数为0，matched 各维取满分，compensation partial=5；技能 partial 允许取整后0分。读到缺失/畸形不能伪装成空，沿既有服务错误路径；FE invalid_response，保留重试，禁止由原因码反推。
4. Case 在线简历复用已有 `candidate_resume` 与独立 `candidate_identity`；手机/邮箱固定占位。没有 PDF 坐标不等于不能读在线简历；真正失权必须拒绝。

示例（两项资料不足，分项不是前端推算）：
```json
{"ranking_version":"discovery-ranking.v2","dimensions":[{"dimension":"category","status":"matched","score":25,"max_score":25},{"dimension":"skills","status":"unknown","score":0,"max_score":35},{"dimension":"experience","status":"matched","score":15,"max_score":15},{"dimension":"location","status":"matched","score":10,"max_score":10},{"dimension":"workplace_mode","status":"unmatched","score":0,"max_score":5},{"dimension":"compensation","status":"unknown","score":0,"max_score":10}]}
```

## 测试选择与 TEST_DELTA

已读后端 `docs/testing/TEST_DESIGN_RULES.md`、`WORKTREE_TEST_HANDOFF.md`、`GLOBAL_TEST_CASES.md`，前端 `docs/testing/README.md`。本轮规划不运行产品测试；历史成功不充当当前证据，实际耗时未知。

- 防止的失败：身份越权/角色混用、屏蔽与披露混淆、冻结分值与即时资料混算、strict JSON 键漂移、头像坏图、纸身误走 PDF。
- 最小开发反馈：各 Task 的定向命令。BE 修改 schema/SQL 时立即用隔离 PG suite 证明真实持久化，不能只用 fake；协议在 BFF 真组件验证；浏览器只验证接线与几何，不重演全部算法组合。
- 最终权威覆盖：BE 按完整 diff `tools/test affected --base <本轮冻结实施基线> --plan --include-working-tree` 校准后提交，收尾运行完整 committed diff affected。此处参数值由开工 Git HEAD 记录，不可凭研究基线当现场基线。FE 用所列文件集合、typecheck/build 和浏览器精确 suite；不全仓机械扫测。
- BE 新生产/测试文件登记 `tests/test-suites.json` 和 `apps/recruitment/scripts/test-layered-groups.json` 现有消费者；出现 SELECTION REVIEW 核实原因，确需广选写在本文件实施记录，不删责任求提速。新 migration 归 schema＋实际读写消费者，不新建 suite。
- FE 测试清单用 `npm run test:list -- --write`，随后 `--check`；新增文件纳入 `脚本/测试清单.mjs`（仅真实新增路径未被前缀映射覆盖时）。

|TEST_DELTA 范围|unique_risk / layer_rationale|authoritative_suite / impact 归属|fixture_key / resource_class|预计增量与证据|
|---|---|---|---|---|
|hidden/公司/亮点|L0 规则、L1 投影、L2 权限及 CAS 数据读取不可用 fake 证明|recruitment-privacy-policy/component/postgres，recruitment-resume-policy/component；路径沿 privacy/resume 的现有 impact rules|现有 privacy PG fixture / isolated；纯逻辑 none|未实测；设计增量 L0 ≤2s、L1 ≤5s、L2 ≤10s，不承诺整体时长|
|会话 counterpart|L1 BFF JSON/媒体、L2 Case 授权真实读取|recruitment-store-case-core-postgres、recruitment-bff-unit；store 会话/BFF 现有 impact rules|既有 Case PG / isolated；BFF none|未实测；L2 增量 ≤10s，BFF ≤5s|
|六维快照|L0 计算，L2 冻结读写与 migration|recruitment-discovery-policy、recruitment-store-discovery-postgres、recruitment-store-schema-policy；discovery/store/schema impact rules|既有 store PG / isolated|未实测；L0 增量 ≤2s，L2 ≤10s|
|前端|Vitest 解码/映射；Playwright 接线与几何，不能代替后端权限|Task 4–9 精确文件|既有离线 BFF fixture / none（无真实后端）|未实测，不新增真实等待|

所有行 duplicate_coverage：较高层只保留协议/事务/浏览器实际边界，不复制纯逻辑排列。timing_receipts：规划阶段三项均 none；实施记录定向、affected、计时证据 locator；没有计时改善证据不宣称提速。

L3 selection：BE `required`，impact_class=`case-semantic`，suite=`recruitment-mobile-local`，mode=`explicit`，cases/seeds=`[foundation:auth-role-session]`，cadence_scope=`development`；理由为本 Case 包含真实 BFF/Recruitment/Server 的 P3/P4/P5/P7 身份与投影链，catalog 当前没有更小 Case。fallback=`case-set required` 仅按 GLOBAL_TEST_CASES.md 在无法确定闭包时使用并记录理由；不得称该 Case 只是 auth smoke，它运行完整 hermetic 业务链。正式运行前同 selector `--plan`；`Handoff == preview == outer receipt == case-summary`。前置为隔离栈/构建产物、全局锁可用及 Case 所需凭据，缺前置记 BLOCKED。正式 L3 只在 final gate 获批后，命令 `tools/test global recruitment-mobile-local --case foundation:auth-role-session`。不运行 release Full Anchor。FE STG `conditional`：只有用户提供确切已部署两仓版本及所需活动场景时按 `docs/dogfood/真实后端行为验收.md` 执行；否则报告未做真实浏览器验收，fixture PASS 不冒充 STG。

---

### Task 1: 后端移除经历 hidden 的错误语义

**工作仓库：** BE。**依赖：** 无；先核验企业屏蔽现有有效性与权限路径。

**预期编辑文件：**

- 修改：`apps/recruitment/internal/resume/types.go`
- 修改：`apps/recruitment/internal/resume/account_export.go`
- 修改：`apps/recruitment/internal/mobileapi/handler.go`
- 修改：`apps/recruitment/internal/mobileapi/response.go`
- 修改：`apps/recruitment/internal/privacy/service.go`
- 修改：`apps/recruitment/internal/store/case_candidate_identity.go`
- 修改：`apps/recruitment/internal/store/conversation_authorization.go`
- 修改：`apps/recruitment/internal/discovery/service.go`
- 修改：`apps/recruitment/internal/store/discovery_store_postgres_test.go`
- 修改：`apps/recruitment/internal/store/case_candidate_identity_postgres_test.go`
- 修改：`apps/recruitment/internal/store/conversation_authorization_postgres_test.go`
- 修改：`apps/recruitment/internal/privacy/projection.go`
- 修改：`apps/recruitment/internal/privacy/recruiter_summary.go`
- 修改：`apps/recruitment/internal/privacy/candidate_resume.go`
- 修改：`apps/recruitment-bff/internal/httpapi/resume.go`
- 修改：`apps/recruitment-bff/internal/recruitmentclient/types.go`
- 修改：`apps/recruitment/openapi/mobile-resources-v1.yaml`
- 修改：`apps/recruitment-bff/openapi/mobile-v1.yaml`
- 修改：`apps/recruitment/internal/privacy/projection_policy_test.go`
- 修改：`apps/recruitment/internal/privacy/candidate_resume_component_test.go`
- 删除：无整文件删除；旧字段、错误断言和入口代码在上述文件内移除。
- 测试归属维护：`tests/test-suites.json`、`apps/recruitment/scripts/test-layered-groups.json`，仅当新文件/实际影响要求时更新。

**接口与职责：** 消费组织屏蔽和 DisclosureAllowed；产出不带 hidden 的 owner/冻结经历合同。对未屏蔽查看者只按当前披露门遮蔽进行中公司；已结束最近公司可展示。工作亮点不再检查 any Hidden，但保留工作资料存在和当前公司阶段披露门。

**非目标：** 不超出批准 Spec；不添加未列出的产品能力或迁移兼容。

- [ ] Step 1: 先为 anonymous + ongoing company allowed/denied、A 被屏蔽/B 可见、教育与工作标签分开过滤写真实入口用例；确认旧实现的 hidden 反例失败。建立屏蔽前可读→屏蔽后拒绝矩阵：旧推荐详情、Case identity/在线简历/头像/附件各行，分别覆盖 hiring=A/publisher=B 和 hiring=B/publisher=A；在实施记录写已有测试文件/用例与缺口，只为缺口补测。
- [ ] Step 2: 删除 Experience.Hidden、冻结经历 Hidden、BFF 请求/响应字段和所有生产引用；用 rg 核对 resume/privacy/Case 全链消费者，同步既有 fixture 字段和断言，不加兼容默认值。Case 当前经历不存在时既有删除保护仍保留；只移除 hidden=true 这一门，不把删除保护顺便取消。
- [ ] Step 3: 复用企业屏蔽的有效集合及代招双侧检查，按上一步矩阵逐条核验匿名摘要、旧推荐详情、Case identity/在线资料/头像/附件读取路径；确需补检查限上述 discovery/service、privacy/service、store/case_candidate_identity 和 conversation_authorization 已有入口，先记录因果链与受影响测试，不把历史消息删除或重写。
- [ ] Step 4: 定向用例与编译通过后记录合同删除字段及 BE commit；前端完成前不发布。
- [ ] Step 5: 执行定向验证；先记录新增反例失败，再记录实现后的通过。既有失败先确认与本改动关系，不改测试期待来掩盖缺陷。

```bash
tools/test service recruitment --suite recruitment-privacy-policy --suite recruitment-privacy-component --suite recruitment-privacy-postgres --suite recruitment-resume-component --suite recruitment-store-discovery-postgres --suite recruitment-store-case-core-postgres
tools/test service recruitment-bff --suite recruitment-bff-unit
```

**验证断言/失败反例：** A 看不到候选、B 在 always allow 下看到公司；关闭公司披露仍不泄漏；仅取消 hidden 不制造标签；请求残留 hidden 按闭合协议拒绝。

- [ ] Step 6: 自检 diff、提交本 Task 明确文件，在本文件实施记录写 commit/验证证据和发现的现场差异。不得 `git add .` 纳入用户其他改动。

**完成条件：** 本 Task 产出合同与上述断言成立，消费者可用；相关低层测试通过。**停止条件：** 必需前置缺失、需改变批准的产品/隐私合同或需不可逆数据清理时明确报告，不能伪造 fallback；普通实现错误持续修复。

### Task 2: 后端会话对方资料投影

**工作仓库：** BE。**依赖：** Task 1 的权限语义；现有 Case identity 和 frozen DisplayJob。

**预期编辑文件：**

- 修改：`apps/recruitment/internal/matchcase/types.go`
- 修改：`apps/recruitment/internal/store/conversation_authorization.go`
- 修改：`apps/recruitment/internal/mobileapi/conversations.go`
- 修改：`apps/recruitment-bff/internal/recruitmentclient/types.go`
- 修改：`apps/recruitment-bff/internal/recruitmentclient/conversations.go`
- 修改：`apps/recruitment-bff/internal/httpapi/conversations.go`
- 修改：`apps/recruitment/openapi/mobile-resources-v1.yaml`
- 修改：`apps/recruitment-bff/openapi/mobile-v1.yaml`
- 修改：`apps/recruitment/internal/store/conversation_authorization_postgres_test.go`
- 修改：`apps/recruitment-bff/internal/recruitmentclient/conversations_test.go`
- 修改：`apps/recruitment-bff/internal/httpapi/conversations_test.go`
- 删除：无整文件删除；旧字段、错误断言和入口代码在上述文件内移除。
- 测试归属维护：`tests/test-suites.json`、`apps/recruitment/scripts/test-layered-groups.json`，仅当新文件/实际影响要求时更新。

**接口与职责：** 消费 Spec §3 的 candidate_identity/publisher_profile 和企业来源；产出冻结接口 §1 的 counterpart。沿用现有 primary/secondary labels 不改旧语义。招聘的 company_name 是用人方，求职的 company_name 是发布方。

**非目标：** 不超出批准 Spec；不添加未列出的产品能力或迁移兼容。

- [ ] Step 1: 增加角色×available/unavailable×disclosed/anonymous×缺名/缺图表驱动协议用例，以及 hiring≠publisher 的反例。
- [ ] Step 2: 在既有 ProjectConversationContext 授权路径复用身份读取，按 Case frozen DisplayJob 取得招聘方所需用人企业/投递岗位；求职侧公司仍按可信当前 publisher ref 解析。单个补充资料读失败给 null，授权错误不降级放行。
- [ ] Step 3: BFF 严格解码内部身份结构，复用 Case/recruiter 媒体转换输出公共 counterpart；两身份同时出现或 Case 媒体坐标不符按协议错误处理。
- [ ] Step 4: 两端列表/详情样例、隐私拒绝反例和 BE 精确 commit 写入实施记录，不新增前端 N+1 请求。
- [ ] Step 5: 执行定向验证；先记录新增反例失败，再记录实现后的通过。既有失败先确认与本改动关系，不改测试期待来掩盖缺陷。

```bash
tools/test service recruitment --suite recruitment-store-case-core-postgres
tools/test service recruitment-bff --suite recruitment-bff-unit
```

**验证断言/失败反例：** 非 disclosed 不返回姓名/头像；资料失败不破坏消息读取；冻结用人企业不变成猎头公司；失权后无旧身份。

- [ ] Step 6: 自检 diff、提交本 Task 明确文件，在本文件实施记录写 commit/验证证据和发现的现场差异。不得 `git add .` 纳入用户其他改动。

**完成条件：** 本 Task 产出合同与上述断言成立，消费者可用；相关低层测试通过。**停止条件：** 必需前置缺失、需改变批准的产品/隐私合同或需不可逆数据清理时明确报告，不能伪造 fallback；普通实现错误持续修复。

### Task 3: 后端同源计算并冻结六维解释

**工作仓库：** BE。**依赖：** 无展示依赖；使用现有 V2 输入与总分算法。

**预期编辑文件：**

- 修改：`apps/recruitment/internal/discovery/ranking.go`
- 修改：`apps/recruitment/internal/discovery/ranking_policy_test.go`
- 修改：`apps/recruitment/internal/discovery/projection.go`
- 修改：`apps/recruitment/internal/discovery/service.go`
- 修改：`apps/recruitment/internal/discovery/types.go`
- 修改：`apps/recruitment/internal/store/discovery_store.go`
- 修改：`apps/recruitment/internal/mobileapi/discovery.go`
- 修改：`apps/recruitment-bff/internal/recruitmentclient/types.go`
- 修改：`apps/recruitment-bff/internal/recruitmentclient/discovery.go`
- 修改：`apps/recruitment-bff/internal/httpapi/discovery.go`
- 修改：`apps/recruitment/openapi/mobile-resources-v1.yaml`
- 修改：`apps/recruitment-bff/openapi/mobile-v1.yaml`
- 修改：`apps/recruitment/internal/store/discovery_store_postgres_test.go`
- 修改：`apps/recruitment-bff/internal/httpapi/discovery_test.go`
- 新增：`apps/recruitment/internal/store/migrations/000045_recommendation_match_analysis.up.sql`、`apps/recruitment/internal/store/migrations/000045_recommendation_match_analysis.down.sql`（编号碰撞按本 Task 顺延）。
- 删除：无整文件删除；旧字段、错误断言和入口代码在上述文件内移除。
- 测试归属维护：`tests/test-suites.json`、`apps/recruitment/scripts/test-layered-groups.json`，仅当新文件/实际影响要求时更新。

**接口与职责：** 产出冻结接口 §3。新增 MatchAnalysis 与 MatchDimensionResult 同域类型；ScoreV2、正向原因及解释消费同一份六维计算结果，现有分数/排序不变。

**非目标：** 不超出批准 Spec；不添加未列出的产品能力或迁移兼容。

- [ ] Step 1: 在 ranking 对真实入口增加无技能/零命中/部分命中/全命中、未确认经验、薪资 unknown/overlap/near_miss；断言分数与原算法一致且状态可区分。
- [ ] Step 2: 将同源结果沿 PreparedRecommendation/插入/读取链保存。新增 migration 文件 apps/recruitment/internal/store/migrations/000045_recommendation_match_analysis.up.sql 及 down.sql；若现场编号已占用，只顺延编号并更新此记录，不改历史 migration。新推荐写完整 JSON；不回填旧行，旧数据不满足新合同走错误而非伪造。
- [ ] Step 3: 招聘详情序列化 required match_analysis；列表和求职详情不增字段。BFF 验证六维唯一/次序/分值范围/总和，以及 Spec §5.1 允许状态及其对应分值，损坏数据走既有 upstream 错误；不输出原始意向或薪资。
- [ ] Step 4: 用 PG 保存后修改当前简历/岗位再读取，解释和总分仍是批次值；新 migration 与 downgrade 结构验证纳入既有 schema/store suite。
- [ ] Step 5: 执行定向验证；先记录新增反例失败，再记录实现后的通过。既有失败先确认与本改动关系，不改测试期待来掩盖缺陷。

```bash
tools/test service recruitment --suite recruitment-discovery-policy --suite recruitment-store-discovery-postgres --suite recruitment-store-schema-policy
tools/test service recruitment-bff --suite recruitment-bff-unit
```

**验证断言/失败反例：** 50/55 样例合计一致；部分技能仍可显示0分但不能标无资料；分数不随当前资料变化；缺分析或重复维度拒绝；无算法权重变化。

- [ ] Step 6: 自检 diff、提交本 Task 明确文件，在本文件实施记录写 commit/验证证据和发现的现场差异。不得 `git add .` 纳入用户其他改动。

**完成条件：** 本 Task 产出合同与上述断言成立，消费者可用；相关低层测试通过。**停止条件：** 必需前置缺失、需改变批准的产品/隐私合同或需不可逆数据清理时明确报告，不能伪造 fallback；普通实现错误持续修复。

### Task 4: 前端经历开关接企业屏蔽

**工作仓库：** FE。**依赖：** 核对 Task 1 精确 BE commit；沿用现有 privacy API。

**预期编辑文件：**

- 修改：`src/数据/BFF契约.ts`
- 修改：`src/数据/类型.ts`
- 修改：`src/数据/资料缓存.ts`
- 修改：`src/状态/初始状态.ts`
- 修改：`src/状态/后端/候选操作.ts`
- 修改：`src/数据/后端映射.ts`
- 修改：`src/数据/招聘数据源/简历.ts`
- 修改：`src/流程/候选Onboarding简历预填.ts`
- 修改：`src/屏幕/工作经历.tsx`
- 修改：`src/状态/后端/隐私操作.ts`
- 修改：`src/屏幕/工作经历.行业与企业.test.tsx`
- 修改：`src/屏幕/工作经历.资料与预填.test.tsx`
- 修改：`src/状态/后端/隐私操作.test.ts`
- 修改：`src/数据/招聘数据源/隐私.test.ts`
- 删除：无整文件删除；旧字段、错误断言和入口代码在上述文件内移除。

**接口与职责：** 消费无 hidden 的经历与既有 privacy 快照；UI 开关值按选中 organization_id 的有效组织屏蔽派生。不得保存第二份 per-experience 屏蔽位。

**非目标：** 不超出批准 Spec；不添加未列出的产品能力或迁移兼容。

- [ ] Step 1: 增加同组织两经历同步、manual/derived 来源、409、网络失败、尚未选公司、换公司/删除不解封的可观察交互用例。
- [ ] Step 2: 删除本地 隐藏 到 wire hidden 的映射和 PDF 预填默认 true；Mock 与 Backend 从各自隐私状态派生开关，不把所有历史公司默认加入屏蔽。
- [ ] Step 3: 保持现有经历编辑“完成”写草稿、上层“保存”提交的交互。按 organization_id 收集明确的屏蔽/解除待提交意图（仅未提交表单状态，不是第二份持久屏蔽事实），同公司重复意图归一；保存前校验有效公司、表单必填及 derived 解除确认，未通过时不发写请求。随后先顺序提交显式隐私意图，再调用现有简历保存；每条成功后权威回读并移出待提交集合，失败停止并保留未成功意图/简历草稿供重试，不自动回滚已成功隐私变更，不宣称整份保存成功。取消未提交编辑不产生屏蔽写请求。
- [ ] Step 4: existing effective block 视为已开；重复新增不覆盖来源；失败/409 重读服务端实际状态但保留未提交意图并标记“未保存”，需用户重试，禁止盲自动覆写。修改/删除经历不推导旧公司 unblock；只有用户明确关闭该企业开关才产生解除意图。同步求职状态/个人简历 fixture，禁止猜公司 ID。
- [ ] Step 5: 执行定向验证；先记录新增反例失败，再记录实现后的通过。既有失败先确认与本改动关系，不改测试期待来掩盖缺陷。

```bash
npm test -- src/屏幕/工作经历.行业与企业.test.tsx src/屏幕/工作经历.资料与预填.test.tsx src/状态/后端/隐私操作.test.ts src/数据/招聘数据源/隐私.test.ts
npm run typecheck
```

**验证断言/失败反例：** 开关成功才显示已生效；同企业入口一致；披露设置 always allow 不自动解封企业；重登状态保持。

- [ ] Step 6: 自检 diff、提交本 Task 明确文件，在本文件实施记录写 commit/验证证据和发现的现场差异。不得 `git add .` 纳入用户其他改动。

**完成条件：** 本 Task 产出合同与上述断言成立，消费者可用；相关低层测试通过。**停止条件：** 必需前置缺失、需改变批准的产品/隐私合同或需不可逆数据清理时明确报告，不能伪造 fallback；普通实现错误持续修复。

### Task 5: 前端聊天列表和详情共用真实对方资料

**工作仓库：** FE。**依赖：** Task 2 精确 BE commit 和公共样例。

**预期编辑文件：**

- 修改：`src/数据/BFF契约.ts`
- 修改：`src/数据/招聘数据源/真人会话.ts`
- 修改：`src/数据/招聘数据源/真人会话.test.ts`
- 修改：`src/屏幕/消息列表展示/类型.ts`
- 修改：`src/屏幕/消息列表展示/消息行映射.ts`
- 修改：`src/屏幕/消息列表展示/消息列表展示.tsx`
- 修改：`src/屏幕/消息列表展示/消息行映射.test.ts`
- 修改：`src/屏幕/消息列表展示/消息列表展示.test.tsx`
- 修改：`src/屏幕/P7/Backend会话列表.tsx`
- 修改：`src/屏幕/P7/Backend会话列表.test.tsx`
- 修改：`src/屏幕/P7/use真人会话资料.ts`
- 修改：`src/屏幕/P7/use真人会话资料.test.tsx`
- 修改：`src/屏幕/消息列表.tsx`
- 修改：`src/屏幕/企业消息.tsx`
- 删除：无整文件删除；旧字段、错误断言和入口代码在上述文件内移除。

**接口与职责：** 严格解码 counterpart；列表与页头同一资料。招聘 subtitle=投递企业 · 投递岗位，求职=发布公司 · 招聘者职务；company null 招聘只显示岗位。

**非目标：** 不超出批准 Spec；不添加未列出的产品能力或迁移兼容。

- [ ] Step 1: 先补 counterpart null/闭合字段/失权与 hiring≠publisher fixture；更新旧“会”/alias 预期为真实身份，保留分页、未读与排序断言。
- [ ] Step 2: 扩充列表头像为图片+首字回退，使用各自姓名；搜索使用最终姓名/副标题/摘要，不再用技术代号；共用三行布局。
- [ ] Step 3: 详情 hook 从 P7 取得页头资料，P5 仅服务正文资料；移除为页头额外读取公司链，保留 P5 失权清理，不增加轮询或跨会话身份缓存。
- [ ] Step 4: Mock 数据映射同布局、副标题和缺值策略；只用已有演示人物资源。
- [ ] Step 5: 执行定向验证；先记录新增反例失败，再记录实现后的通过。既有失败先确认与本改动关系，不改测试期待来掩盖缺陷。

```bash
npm test -- src/数据/招聘数据源/真人会话.test.ts src/屏幕/消息列表展示/消息行映射.test.ts src/屏幕/消息列表展示/消息列表展示.test.tsx src/屏幕/P7/Backend会话列表.test.tsx src/屏幕/P7/use真人会话资料.test.tsx
```

**验证断言/失败反例：** 有资料不见 candidate alias；公司缺失无孤立分隔符；列表和页头一致；失权不从旧 P5 缓存恢复真名。

- [ ] Step 6: 自检 diff、提交本 Task 明确文件，在本文件实施记录写 commit/验证证据和发现的现场差异。不得 `git add .` 纳入用户其他改动。

**完成条件：** 本 Task 产出合同与上述断言成立，消费者可用；相关低层测试通过。**停止条件：** 必需前置缺失、需改变批准的产品/隐私合同或需不可逆数据清理时明确报告，不能伪造 fallback；普通实现错误持续修复。

### Task 6: 双端真人消息头像统一

**工作仓库：** FE。**依赖：** Task 5 提供对方姓名/头像；本人已有 candidate account/recruiter profile。

**预期编辑文件：**

- 修改：`src/屏幕/P7/Backend真人会话.tsx`
- 修改：`src/屏幕/P7/Backend真人会话.test.tsx`
- 修改：`src/屏幕/直聊会话.tsx`
- 修改：`src/屏幕/直聊会话.module.css`
- 修改：`src/屏幕/真人会话.module.css`
- 修改：`src/屏幕/真人会话.tsx`
- 修改：`src/屏幕/企业真人会话.tsx`
- 修改：`src/屏幕/直聊会话.test.tsx`
- 删除：无整文件删除；旧字段、错误断言和入口代码在上述文件内移除。

**接口与职责：** 双方图片优先，缺图/error 回退各自姓名首个码点；本人 role 使用候选账号头像/招聘档案 avatar_url；没有姓名为“·”。

**非目标：** 不超出批准 Spec；不添加未列出的产品能力或迁移兼容。

- [ ] Step 1: 用组件触发双方 img error 验证各自首字，换 URL 后重试，删图回退，不用 DOM CSS 字符串测试替代尺寸验收。
- [ ] Step 2: 本人资料直达页面时复用既有读取和水合操作；候选 revision cache-buster 保留；不能读取对方名填本人，也不能因一侧失败把另一侧图清掉。
- [ ] Step 3: 32px 圆形统一、去除我方2px偏移，双方气泡镜像净空均按头像32+既有间距计算；共享 CSS 的直聊消费者同步，不扩大到其他 AI 专用头像。
- [ ] Step 4: Mock 两真人页面同样渲染规则；本地失败状态按 URL/角色/会话复位。
- [ ] Step 5: 执行定向验证；先记录新增反例失败，再记录实现后的通过。既有失败先确认与本改动关系，不改测试期待来掩盖缺陷。

```bash
npm test -- src/屏幕/P7/Backend真人会话.test.tsx src/屏幕/直聊会话.test.tsx
npm run typecheck
```

**验证断言/失败反例：** 未先去个人页也显示本人图；双方失败用本人各自字；32px/长气泡几何由 Task 9 浏览器验证。

- [ ] Step 6: 自检 diff、提交本 Task 明确文件，在本文件实施记录写 commit/验证证据和发现的现场差异。不得 `git add .` 纳入用户其他改动。

**完成条件：** 本 Task 产出合同与上述断言成立，消费者可用；相关低层测试通过。**停止条件：** 必需前置缺失、需改变批准的产品/隐私合同或需不可逆数据清理时明确报告，不能伪造 fallback；普通实现错误持续修复。

### Task 7: 招聘聊天在线简历纸身

**工作仓库：** FE。**依赖：** Task 5 授权资料；已有 P5 candidate_resume。

**预期编辑文件：**

- 修改：`src/屏幕/P7/Backend真人会话.tsx`
- 修改：`src/屏幕/P7/Backend真人会话.test.tsx`
- 修改：`src/屏幕/企业真人会话.tsx`
- 修改：`src/组件/简历预览层.tsx`
- 修改：`src/组件/简历预览层.module.css`
- 修改：`src/组件/简历预览层.test.tsx`
- 新增：`src/组件/真人在线简历正文.tsx`、`src/组件/真人在线简历正文.test.tsx`。
- 删除：无整文件删除；旧字段、错误断言和入口代码在上述文件内移除。

**接口与职责：** 新增纯展示 真人在线简历正文（src/组件/真人在线简历正文.tsx），输入 name/title/experienceYears/experiences/educations/selfDescription 和关闭回调；仅数据，不读应用状态。experiences/educations 用 null 表示区域缺失、[] 表示合法空；加载/错误及定向重试由消费者在纸身外层管理，不把请求状态塞进纯正文。两个消费者分别映射 Case 与 Mock。

**非目标：** 不超出批准 Spec；不添加未列出的产品能力或迁移兼容。

- [ ] Step 1: 写有完整资料/空区段/缺姓名/加载失败及 retry 用例；点击“看在线简历”必须零 PDF lease 请求。
- [ ] Step 2: 从现有简历纸身提取上述小型展示组件；按截图姓名、职位年限、手机邮箱—、工作、教育、个人优势、继续沟通排布。完整经历按源顺序；缺公司不从描述挖取。
- [ ] Step 3: Backend 从同 Case 授权身份和 candidate_resume 映射；resume_ref 缺席不单独禁用；真正失权、换角色或会话关闭并清空。
- [ ] Step 4: 移除该入口 PDF 请求/lease 生命周期，仅保留其他 MatchCase 附件入口；不改求职查看岗位入口。
- [ ] Step 5: 执行定向验证；先记录新增反例失败，再记录实现后的通过。既有失败先确认与本改动关系，不改测试期待来掩盖缺陷。

```bash
npm test -- src/屏幕/P7/Backend真人会话.test.tsx src/组件/简历预览层.test.tsx src/组件/真人在线简历正文.test.tsx src/屏幕/企业真人会话.test.tsx
```

**验证断言/失败反例：** 手机邮箱仅—；继续沟通关闭层；无旧会话内容闪现；Mock/Backend 同版式。

- [ ] Step 6: 自检 diff、提交本 Task 明确文件，在本文件实施记录写 commit/验证证据和发现的现场差异。不得 `git add .` 纳入用户其他改动。

**完成条件：** 本 Task 产出合同与上述断言成立，消费者可用；相关低层测试通过。**停止条件：** 必需前置缺失、需改变批准的产品/隐私合同或需不可逆数据清理时明确报告，不能伪造 fallback；普通实现错误持续修复。

### Task 8: 招聘推荐六维分析及公司/亮点展示

**工作仓库：** FE。**依赖：** Task 1、3 后端精确版本；两份 JSON 新样例。

**预期编辑文件：**

- 修改：`src/数据/BFF契约.ts`
- 修改：`src/数据/招聘数据源/发现推荐.ts`
- 修改：`src/数据/招聘数据源/发现推荐.test.ts`
- 修改：`src/数据/发现推荐映射.ts`
- 修改：`src/数据/发现推荐映射.test.ts`
- 修改：`src/数据/招聘候选摘要映射.ts`
- 修改：`src/数据/招聘候选摘要映射.test.ts`
- 修改：`src/屏幕/匿名在线简历.tsx`
- 修改：`src/数据/企业端模拟数据.ts`
- 修改：`src/屏幕/匿名在线简历.test.tsx`
- 修改：`src/组件/在谈详情/在线简历正文.tsx`
- 修改：`src/组件/在谈详情/在线简历正文.test.tsx`
- 修改：`src/组件/列表卡片/招聘推荐卡.tsx`
- 新增：`src/组件/招聘匹配分析.tsx`、`src/组件/招聘匹配分析.test.tsx`。
- 删除：无整文件删除；旧字段、错误断言和入口代码在上述文件内移除。

**接口与职责：** 招聘推荐详情消费 required match_analysis；新增纯展示 招聘匹配分析（src/组件/招聘匹配分析.tsx），输入 analysis；不改求职端评分组件。个人标签只来自 personal_highlights。

**非目标：** 不超出批准 Spec；不添加未列出的产品能力或迁移兼容。

- [ ] Step 1: 新增缺分析/畸形/重复/总和不符、维度不允许的状态、unknown/unmatched 非0分的解码反例；构造全中/部分/未匹配/未知真实合同 fixture。
- [ ] Step 2: 将唯一“匹配度分析”渲染六行状态和得分/满分，去除该推荐页面独立“推荐依据”重复块；共享正文仅在推荐入口启用，其他 Case 消费者保留原合同。
- [ ] Step 3: Mock 招聘推荐使用同模型组件，样例分数由同六行相加；不拿旧 Mock JD 行冒充后端评分。
- [ ] Step 4: 亮点空改“暂无可展示亮点”，有值原样；公司按已授权 latest_experience 拼 company · title，缺公司只职位，不借旧公司；生成器、源附件规则不变。
- [ ] Step 5: 执行定向验证；先记录新增反例失败，再记录实现后的通过。既有失败先确认与本改动关系，不改测试期待来掩盖缺陷。

```bash
npm test -- src/数据/招聘数据源/发现推荐.test.ts src/数据/发现推荐映射.test.ts src/数据/招聘候选摘要映射.test.ts src/屏幕/匿名在线简历.test.tsx src/组件/在谈详情/在线简历正文.test.tsx src/组件/招聘匹配分析.test.tsx
npm run typecheck
```

**验证断言/失败反例：** 单个总分、唯一分析标题；未知不画不匹配；0分部分命中不混为unknown；真实个人标签不混匹配原因。

- [ ] Step 6: 自检 diff、提交本 Task 明确文件，在本文件实施记录写 commit/验证证据和发现的现场差异。不得 `git add .` 纳入用户其他改动。

**完成条件：** 本 Task 产出合同与上述断言成立，消费者可用；相关低层测试通过。**停止条件：** 必需前置缺失、需改变批准的产品/隐私合同或需不可逆数据清理时明确报告，不能伪造 fallback；普通实现错误持续修复。

### Task 9: 浏览器接线与 Mock 视觉验收

**工作仓库：** FE。**依赖：** Tasks 4–8；真实 API 合同 fixture 已冻结。

**预期编辑文件：**

- 修改：`e2e/fixtures/bff/真人消息.ts`
- 修改：`e2e/fixtures/bff/发现推荐.ts`
- 修改：`e2e/fixtures/bff/隐私与实名.ts`
- 修改：`e2e/fixtures/bff/账号与目录.ts`
- 修改：`e2e/suites/真人消息.spec.ts`
- 修改：`e2e/suites/发现推荐.spec.ts`
- 修改：`e2e/suites/隐私与实名.spec.ts`
- 修改：`e2e/suites/简历与附件.spec.ts`
- 修改：`e2e/视觉回归/采集.spec.ts`
- 修改：`docs/testing/cases.md`
- 删除：无整文件删除；旧字段、错误断言和入口代码在上述文件内移除。

**接口与职责：** 离线 fixture 精确模拟新 BFF shape，不允许未声明业务请求；浏览器负责跨页、尺寸和实际点击链，算法/权限组合留低层。

**非目标：** 不超出批准 Spec；不添加未列出的产品能力或迁移兼容。

- [ ] Step 1: 更新既有 fixture 的 hidden 删除、counterpart 与详情 analysis；一处工厂统一，不放宽全局 HTTP 兜底。
- [ ] Step 2: 在现有 suites 用前缀“聊天推荐修复”增加：双角色姓名副标题/搜索、32px两侧头像及坏图首字、聊天在线纸身零PDF请求、屏蔽公司跨页面同步及失败、六维分析唯一标题/合法空亮点。
- [ ] Step 3: Mock 采集覆盖招聘/求职聊天、列表及招聘推荐纸身；检查文字截断、长公司/岗位、窄屏、气泡留白。不要用 fixture 证明真实隐私授权。
- [ ] Step 4: 更新清单并运行下面精确项目命令；记录截图定位与实际结果，不生成独立 review/handoff 文档。
- [ ] Step 5: 执行定向验证；先记录新增反例失败，再记录实现后的通过。既有失败先确认与本改动关系，不改测试期待来掩盖缺陷。

```bash
npm run test:e2e -- e2e/suites/真人消息.spec.ts e2e/suites/发现推荐.spec.ts e2e/suites/隐私与实名.spec.ts e2e/suites/简历与附件.spec.ts --project=fixture --grep 聊天推荐修复
npm run ui:capture -- --grep 聊天推荐修复
npm run test:list -- --write
npm run test:list -- --check
npm run build
```

**验证断言/失败反例：** 截图与DOM几何共同证明32px；Mock与Backend相同布局；没有多余资料请求或未声明业务HTTP；编译和清单一致。

- [ ] Step 6: 自检 diff、提交本 Task 明确文件，在本文件实施记录写 commit/验证证据和发现的现场差异。不得 `git add .` 纳入用户其他改动。

**完成条件：** 本 Task 产出合同与上述断言成立，消费者可用；相关低层测试通过。**停止条件：** 必需前置缺失、需改变批准的产品/隐私合同或需不可逆数据清理时明确报告，不能伪造 fallback；普通实现错误持续修复。

## 实施后收尾（不计入 Task count）

1. 完成执行 skill 要求的宿主内全局 review 后退出 Task 循环；同一实施者调用异构 review-loop（Codex→Claude，Claude Code→Codex），绑定批准 Spec 与两仓固定 diff；reviewer 不跑测试，轮间只做修复相关轻量反馈。依据接收规则核实 findings，不将 optional 强行升级。两仓 review 串行，各自冻结候选，记录在本文件。
2. 对两仓完整 diff 对账。BE authoritative affected 不能被定向 suite 代替；FE 聚合本 Plan 各 Task 文件集/typecheck/build/浏览器实际受影响责任。有效结果可复用，新增或失效责任只补缺口；不要重复 broad gate。先修范围内缺陷再展示 final gate。
3. 读取 development-workflow 的 `references/final-integration.md` 和 `assets/final-integration-contract.md`。给出两仓 candidate commits、target ref/观察SHA、preview、可复用 receipt、待执行命令和 L3 范围；等用户明确批准。规划批准不等于 final gate；确认前不合 target、不正式 L3、不 push。
4. 获批后同步各 target，记录各 `final_target_base`，按各完整 diff 重算受影响责任；复用有效 PASS，仅补新缺口；按批准选择串行跑 development L3，cleanup 后再次对账，二次核验 target 未推进，普通 fast-forward push。竞态/目标变化需重新确认，不 force push、不扩大清理。实际执行必要 known-issues/ideas 维护及 e2e-runs 记录遵守后端仓库规则，不另造报告。
5. 本文件记录最终实施状态、证据和未完成项；prompt 文件不替代权威 receipt。正式 STG/发布不在默认范围。

## 文档 Review 记录

模式 WORKFLOW_DOCUMENT_REVIEW；scope 仅本 Plan 与 Spec；批准 Spec revision/blob 见 header。

Round 1：Claude Opus / high / plan mode，session `685b696b-de05-4b00-ab2f-e663ac63f4aa`；候选 `9cd21482`，Spec blob `2f39a9bb333b8f995f5cb43cd4d9c399d2bd671a`。未跑测试；HEAD/status/文件指纹 guard 通过。

|Finding|必要性 / 复杂度|裁决|
|---|---|---|
|R1-1 清单遗漏 Mock 数据、ranking test、权限入口|required / 不变|接受；补精确文件；同时静态检索补齐 hidden 的 mobileapi/export/cache 消费者|
|R1-2 旧推荐/Case 资料及代招双侧屏蔽验证无明确归属|required / 不变|接受；Task 1 增加读取矩阵、已有覆盖记录和缺口补测，加入 store discovery/Case PG suite|
|R1-3 Plan 擅自引入即时保存并丢失失败意图|required / 不变|接受；恢复现有完成→保存流程，保留失败待提交意图；不增加即时保存新文案|
|R1-4 纸身缺失/空/加载边界不清|optional / 不变|采纳；null/[] 区分，重试在消费者外层|
|R1-5 状态/分值组合校验不全|optional / 不变|采纳；按批准 Spec §5.1 校验允许状态与分值|

全部修订维持批准 Spec，不修改产品范围。另将 API 示例标为 bff.invalid URL，以避免路径校验器误认文件绝对路径；接口未变。无产品测试 PASS 声明。

Round 2：同一 Claude reviewer session，以 `55a8970d`（Plan blob `572a2b5b`）复审，返回 `## Findings / NO FINDINGS`；三项 required 全部修复、两项 optional 已采纳，无未解决项。两轮 HEAD/status/指纹 guard 均通过，reviewer 未执行测试、未修改文件。本次结论追加不改变受审实施合同。

## 实施记录（执行时追加）

当前：仅规划，Task 1–9 均未执行；无后端代码提交、无清库、无部署、无测试 PASS。执行时逐 Task 追加两仓基线、合同产物 commit、定向/affected receipt、真实 L3 selection 与结果；保持原始失败和后续修复分别可追溯。
