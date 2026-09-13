# 七类公司选择与企业认证实施提示词

两节属于同一份 Plan，选择当前宿主的一节复制到新实施 session，不同时启动两个实现。产品范围只由批准 Spec 与完成文档 review 的 Plan 决定。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行已经完成 Claude 文档 review 的 Plan。工作区固定为用户选定的当前仓库根 `.`，不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；这是待 final gate 核实并确认的合入目标，开工不合入目标、不 push。输入输出中的仓库文件统一用仓库相对路径，不写规划机器路径。

Task count: 6
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

批准 Spec：docs/superpowers/specs/2026-09-13-company-picker-and-verification-design.md（revision 4b4edad965ef89e6a59a9927cacab3a94cdbdf37，blob 1aeb99dc03fb2ff343a3fd10cb67a7771aace7d1）。
执行 Plan：docs/superpowers/plans/2026-09-13-company-picker-and-verification.md（revision ce5d0ffc45cc6f74d39bf9415bacb839ae6cebe3，blob a5b26f09d5584e6803c8c54933f19c184a8ec7b4）。

按顺序完整读取 AGENTS.md、CLAUDE.md、精确批准 Spec、Plan 的 Global Constraints、Task index、角色表，以及当前 Task 的完整正文。用 git show 和 git hash-object 核对上述 Git 对象；当前 Spec 仅追加批准状态和现场前置纠正，产品依据仍为批准对象。不要仅按路径取未批准的最新内容。依赖交付必须核对精确字段和可调用方法，不凭上一 Task 口头完成声明继续。

外部技能按逻辑 skill 名发现，并解析符号链接得到真实 skill 根目录；先完整读取 development-workflow 的 assets/execution-contract.md。它的 scripts/task_intents.py 也是相对真实 skill 根目录解析，先读 --help，再通过该脚本 start 登记本机改动预告并读取 active/paused 记录；扩大路径或公共接口前 update，结束时更新状态。预告不授权清理或阻塞其他任务。共用 review 合同为 reviewer skill 根目录旁的 ../_shared/review-contract.md，真实目录解析后必须存在；缺失不得运行无约束 review，不现场编造替代合同。

实施范围：7 类现有页面的公司搜索／添加／选择及最小 ID 读写接线；复用弹层框架、候选列表与组织查询钩子。六个 Task 是组织合同、共用抽屉、名片与认证三页、经历与恢复、屏蔽两页、岗位创建／编辑。没有新架构、状态服务、请求框架、UI 依赖或批量后端 API；不改变邀请目标和公司档案管理目标，不扩大到推荐／初筛架构。

后端合同固定 agxp-monorepo@e2c40ef2ec6cdc8ca5228add4a83d5dde0deb684 的 apps/recruitment-bff/openapi/mobile-v1.yaml；现场定位用户提供的后端 checkout，核对固定对象和正式验收实际部署版本。本任务不修改后端；源码检查不是运行环境 PASS。保持既有依赖锁文件，不为本次升级库。

重点合同：名片公司只从 profile.organization_ref 读回，不从 affiliation 名或本机声明回退；认证请求绑定所选 organization_id，企业认证不等于用户管理员；经历以 organization_id 写入，旧文本仅搜索词且不丢草稿；直招单企业映射双相同 ID、代理已有岗位编辑双企业；旧缺 refs 岗位仅改正文时不强制改企业，改选必须满足双坐标约束；屏蔽用真实 ID、正确来源和连续权威 revision，部分失败不能伪造全部成功。取消父表单不删除已创建的共享目录企业。

本宿主 N=6>3，必须实际调用 superpowers:subagent-driven-development，按 Plan 依赖串行协调 Task implementer、spec reviewer、code-quality reviewer，不把相邻共享文件任务并行写入。角色模型取 Plan 表的 Claude Code 条件 alias，不能满足时报告，不静默降档。

本次文档 review 共 2 轮：首轮 2 条 required 已修复、2 条 optional 经裁决简化，第二轮 Findings 为 NO FINDINGS。首轮 reviewer 曾违规写仓库外临时文件，已记录；第二轮限制 Read/Grep/Glob 并通过 post-round guard。不得把文档 review 当成实施代码 review 或产品测试。实施结束的异构 reviewer 为 Codex，必须调用该身份的多轮只读 review-loop skill，绑定批准 Spec/Plan 与冻结候选 diff，默认不跑测试。

确认前：完成全部 Task 的定向开发验证和执行 skill 要求的宿主内全局 review后，退出 Task 循环；进入 Plan 唯一的“实施后收尾（不计入 Task count）”：异构 review skill及必要修复（轮间只跑轻量测试，轮次和停止条件归 skill）→完整 diff 最小 affected/适用 L0–L2 →具体 final gate 等待用户明确确认。实施中和确认后不调用异构 review，不反复进入 Task/global review，不调用默认 finishing 流程或新增合入菜单。按各 Task 的确切 Vitest 文件验证真实风险，不只改 fixture 混过断言；沿既有 typecheck、lint、build 和完整 diff 消费者覆盖，未完成不得宣称 ready。

本仓库没有后端 tools/test affected；按 Plan 用本仓库的 Vitest related 加显式新增/修改测试覆盖完整责任，不借用后端全层 runner。所有测试、浏览器证据记录实际命令、候选、结果与环境，不伪造全绿。产品 UI 回归 CI 沿既有 npm run ui:check；若工具自身临时 reference worktree 与执行限制冲突，按 Plan 记录并在 final gate 决定，不另建实施工作区。

final gate 前允许只读 fetch，但不合 target、不执行正式 L3、不 push。展示候选 commit、实际目标 SHA、完整 L0–L2 责任与可复用证据、七页及三个跨页衔接的精确真实后端验收方案、目标 URL、部署版本、账号安全来源、环境归属、待执行命令及 cleanup、合入和 push 动作，取得明确确认。L3 required 的既有指南为 docs/dogfood/真实后端行为验收.md、docs/dogfood/backend-local-onboarding.md；不默认跑 Hosted 全量、STG 或 release 套件，缺前置如实记 BLOCKED。

确认后：完整读取 development-workflow 的 references/final-integration.md 和 assets/final-integration-contract.md，按批准方案同步 target并记录 final_target_base →按完整目标 diff 重算责任 →复用有效 PASS、仅补缺口 →执行所选正式 L3 →cleanup 后再对账 →核对 target 未推进 →普通 fast-forward push，禁止 force push。获批范围内失败由同一执行者自主诊断、最小修复、补失效证据，无需重复确认；不得再调用异构 review。变更产品契约、target race 或缺不可取得的外部权限时报告具体阻塞，不能无限追赶目标。只有 push 成功后才报告已合入。

输出位置：Task checkbox、实施与验证结论就地维护于 Plan；测试/浏览器证据沿现有忽略目录和 dogfood 指南位置，不新增 handoff、review report 或测试平台。最终报告实际变更、测试、review 裁决、未验证责任及合入结果，更新 task intent。此次执行不再重新设计已冻结的 UI 或接口。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行已经完成 Claude 文档 review 的 Plan。工作区固定为用户选定的当前仓库根 `.`，不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；这是待 final gate 核实并确认的合入目标，开工不合入目标、不 push。输入输出中的仓库文件统一用仓库相对路径，不写规划机器路径。

Task count: 6
Execution skill: superpowers:executing-plans
Model aliases: host-native

批准 Spec：docs/superpowers/specs/2026-09-13-company-picker-and-verification-design.md（revision 4b4edad965ef89e6a59a9927cacab3a94cdbdf37，blob 1aeb99dc03fb2ff343a3fd10cb67a7771aace7d1）。
执行 Plan：docs/superpowers/plans/2026-09-13-company-picker-and-verification.md（revision ce5d0ffc45cc6f74d39bf9415bacb839ae6cebe3，blob a5b26f09d5584e6803c8c54933f19c184a8ec7b4）。

按顺序完整读取 AGENTS.md、CLAUDE.md、精确批准 Spec、Plan 的 Global Constraints、Task index、角色表，以及当前 Task 的完整正文。用 git show 和 git hash-object 核对上述 Git 对象；当前 Spec 仅追加批准状态和现场前置纠正，产品依据仍为批准对象。不要仅按路径取未批准的最新内容。依赖交付必须核对精确字段和可调用方法，不凭上一 Task 口头完成声明继续。

外部技能按逻辑 skill 名发现，并解析符号链接得到真实 skill 根目录；先完整读取 development-workflow 的 assets/execution-contract.md。它的 scripts/task_intents.py 也是相对真实 skill 根目录解析，先读 --help，再通过该脚本 start 登记本机改动预告并读取 active/paused 记录；扩大路径或公共接口前 update，结束时更新状态。预告不授权清理或阻塞其他任务。共用 review 合同为 reviewer skill 根目录旁的 ../_shared/review-contract.md，真实目录解析后必须存在；缺失不得运行无约束 review，不现场编造替代合同。

实施范围：7 类现有页面的公司搜索／添加／选择及最小 ID 读写接线；复用弹层框架、候选列表与组织查询钩子。六个 Task 是组织合同、共用抽屉、名片与认证三页、经历与恢复、屏蔽两页、岗位创建／编辑。没有新架构、状态服务、请求框架、UI 依赖或批量后端 API；不改变邀请目标和公司档案管理目标，不扩大到推荐／初筛架构。

后端合同固定 agxp-monorepo@e2c40ef2ec6cdc8ca5228add4a83d5dde0deb684 的 apps/recruitment-bff/openapi/mobile-v1.yaml；现场定位用户提供的后端 checkout，核对固定对象和正式验收实际部署版本。本任务不修改后端；源码检查不是运行环境 PASS。保持既有依赖锁文件，不为本次升级库。

重点合同：名片公司只从 profile.organization_ref 读回，不从 affiliation 名或本机声明回退；认证请求绑定所选 organization_id，企业认证不等于用户管理员；经历以 organization_id 写入，旧文本仅搜索词且不丢草稿；直招单企业映射双相同 ID、代理已有岗位编辑双企业；旧缺 refs 岗位仅改正文时不强制改企业，改选必须满足双坐标约束；屏蔽用真实 ID、正确来源和连续权威 revision，部分失败不能伪造全部成功。取消父表单不删除已创建的共享目录企业。

本宿主必须实际调用 superpowers:executing-plans，按 Plan 依赖连续完成全部 Task，不因 N=6 改用 subagent 模式。角色表按通用档位和宿主配置解释；不解析、查找或校验 Claude Code alias，不因缺少它们阻塞。

本次文档 review 共 2 轮：首轮 2 条 required 已修复、2 条 optional 经裁决简化，第二轮 Findings 为 NO FINDINGS。首轮 reviewer 曾违规写仓库外临时文件，已记录；第二轮限制 Read/Grep/Glob 并通过 post-round guard。不得把文档 review 当成实施代码 review 或产品测试。实施结束的异构 reviewer 为 Claude，必须调用该身份的多轮只读 review-loop skill，绑定批准 Spec/Plan 与冻结候选 diff，默认不跑测试。

确认前：完成全部 Task 的定向开发验证和执行 skill 要求的宿主内全局 review后，退出 Task 循环；进入 Plan 唯一的“实施后收尾（不计入 Task count）”：异构 review skill及必要修复（轮间只跑轻量测试，轮次和停止条件归 skill）→完整 diff 最小 affected/适用 L0–L2 →具体 final gate 等待用户明确确认。实施中和确认后不调用异构 review，不反复进入 Task/global review，不调用默认 finishing 流程或新增合入菜单。按各 Task 的确切 Vitest 文件验证真实风险，不只改 fixture 混过断言；沿既有 typecheck、lint、build 和完整 diff 消费者覆盖，未完成不得宣称 ready。

本仓库没有后端 tools/test affected；按 Plan 用本仓库的 Vitest related 加显式新增/修改测试覆盖完整责任，不借用后端全层 runner。所有测试、浏览器证据记录实际命令、候选、结果与环境，不伪造全绿。产品 UI 回归 CI 沿既有 npm run ui:check；若工具自身临时 reference worktree 与执行限制冲突，按 Plan 记录并在 final gate 决定，不另建实施工作区。

final gate 前允许只读 fetch，但不合 target、不执行正式 L3、不 push。展示候选 commit、实际目标 SHA、完整 L0–L2 责任与可复用证据、七页及三个跨页衔接的精确真实后端验收方案、目标 URL、部署版本、账号安全来源、环境归属、待执行命令及 cleanup、合入和 push 动作，取得明确确认。L3 required 的既有指南为 docs/dogfood/真实后端行为验收.md、docs/dogfood/backend-local-onboarding.md；不默认跑 Hosted 全量、STG 或 release 套件，缺前置如实记 BLOCKED。

确认后：完整读取 development-workflow 的 references/final-integration.md 和 assets/final-integration-contract.md，按批准方案同步 target并记录 final_target_base →按完整目标 diff 重算责任 →复用有效 PASS、仅补缺口 →执行所选正式 L3 →cleanup 后再对账 →核对 target 未推进 →普通 fast-forward push，禁止 force push。获批范围内失败由同一执行者自主诊断、最小修复、补失效证据，无需重复确认；不得再调用异构 review。变更产品契约、target race 或缺不可取得的外部权限时报告具体阻塞，不能无限追赶目标。只有 push 成功后才报告已合入。

输出位置：Task checkbox、实施与验证结论就地维护于 Plan；测试/浏览器证据沿现有忽略目录和 dogfood 指南位置，不新增 handoff、review report 或测试平台。最终报告实际变更、测试、review 裁决、未验证责任及合入结果，更新 task intent。此次执行不再重新设计已冻结的 UI 或接口。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。
```
