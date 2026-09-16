# 聊天与推荐展示修复：纯前端执行提示词

本文件替代已撤销的跨仓库提示词；仅以下两节可用于新的实施 session。文档审查两轮结束，结论 NO FINDINGS；未开始业务实施。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository 当前前端仓库（.） 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 （.） 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target main（仅规划候选；实际 ref/SHA 在 final gate 确认）；实施范围 仅前端六项 Task，使用现有 API；不修改后端代码、OpenAPI、schema，不运行后端测试、服务或迁移，不以新增后端提交为前置；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 6
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-17-chat-recommendation-display-design.md（revision a6d0c8dd0d1f8c6e80dae4e2f2f2a8f61eeebacd，blob 48605e22481f555811c554674687d26742cf30c5）、执行 Plan：docs/superpowers/plans/2026-09-17-chat-recommendation-display.md（版本 14e87e24f6b2d734922c17d01a15e37b5b7f38d2，blob 92be80403f25ff027af8c5bb91680d9c33ddf836）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根目录相对 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前用 python3 按 development-workflow skill 根目录解析的 scripts/task_intents.py start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ 前端受影响测试核对（affected，适用 L0–L2；按 Plan 的实际前端入口，不调用后端 tools/test）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录相对 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：本 Plan 末尾的实施记录（记录实际 commit、验证证据及缺口），不生成额外 handoff/review 文档。

本 Plan 计划本身复杂度：中；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

范围约束：只执行本版纯前端 Plan；旧跨仓库 Plan/prompt 和旧 review 结论均已废止。API 缺失只能按 Spec 降级展示并记录后端依赖，禁止补造字段、绕过权限或转去后端实现。现有 hidden 原值保留，新建默认 false；已有服务端过滤造成的缺公司/亮点不冒充本轮已修复。真实环境、正式 L3、部署、清库均不因 Plan 批准自动授权。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository 当前前端仓库（.） 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 （.） 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target main（仅规划候选；实际 ref/SHA 在 final gate 确认）；实施范围 仅前端六项 Task，使用现有 API；不修改后端代码、OpenAPI、schema，不运行后端测试、服务或迁移，不以新增后端提交为前置；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 6
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-17-chat-recommendation-display-design.md（revision a6d0c8dd0d1f8c6e80dae4e2f2f2a8f61eeebacd，blob 48605e22481f555811c554674687d26742cf30c5）、执行 Plan：docs/superpowers/plans/2026-09-17-chat-recommendation-display.md（版本 14e87e24f6b2d734922c17d01a15e37b5b7f38d2，blob 92be80403f25ff027af8c5bb91680d9c33ddf836）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根目录相对 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前用 python3 按 development-workflow skill 根目录解析的 scripts/task_intents.py start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ 前端受影响测试核对（affected，适用 L0–L2；按 Plan 的实际前端入口，不调用后端 tools/test）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录相对 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：本 Plan 末尾的实施记录（记录实际 commit、验证证据及缺口），不生成额外 handoff/review 文档。

本 Plan 计划本身复杂度：中；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

范围约束：只执行本版纯前端 Plan；旧跨仓库 Plan/prompt 和旧 review 结论均已废止。API 缺失只能按 Spec 降级展示并记录后端依赖，禁止补造字段、绕过权限或转去后端实现。现有 hidden 原值保留，新建默认 false；已有服务端过滤造成的缺公司/亮点不冒充本轮已修复。真实环境、正式 L3、部署、清库均不因 Plan 批准自动授权。
```
