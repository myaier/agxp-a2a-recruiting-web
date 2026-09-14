# 固定 AI 代理与展示组件：新实施 Session 执行提示词

Spec 已批准并校准；Claude 文档 review 共2轮，最终 NO FINDINGS。按实际宿主复制对应完整正文，两个章节引用同一版本。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 双端 Backend 固定 AI 动态入口、可见但禁用的聊天外壳、Mock 问 AI 展示组件受控提取及定向浏览器回归；不实现真实助手会话/API/持久化；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 4
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-14-agent-session-and-display-components-design.md（revision b969b267de0cac54dbd68c17c1a7544b67413fa0，blob 6df343758e71b2921080a1d3ccae7c86286d973b）、执行 Plan：docs/superpowers/plans/2026-09-14-agent-session-and-display-components.md（版本 a8fef7dfe5aa9bd753e4e97ad606d943c4ba597c，blob 9bbf21b64c82f06488468c5eea95790620bb28a6）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 逻辑 skill development-workflow 的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前从逻辑 skill development-workflow 安装根解析 scripts/task_intents.py，先读取 CLI help，再用 python3 调用 start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 逻辑 skill development-workflow 的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：实施进度、review裁决及验收责任对账写入 docs/superpowers/plans/2026-09-14-agent-session-and-display-components.md；测试/截图使用既有 test-results/ 与 ui-regression-output/，不新建handoff/review报告。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

产品边界：AI 行沿用“AI代理动态”，全部第一条、通知可见、仅会话隐藏，搜索照旧可过滤；Backend 不伪造时间、未读、最近消息或 P7 会话坐标。聊天栏可见但输入/发送 disabled，说明与原导航保持；Mock退出重进恢复演示，不增加持久化或清空功能。

校准前提：目标基线 1f8c223739deb8fb14fdfba51ca8240f081ab089；现有 P1 fixture 已含完成 onboarding 响应，不绕过产品 guard。Task 4 的 P1 selection 必须为五种消息用例×两宽度，共10条，不能退回只 grep“消息”。正式 development L3 selection 当前为 none；不得以此掩盖实施中越界变更，发生范围扩大先按批准契约处理。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 双端 Backend 固定 AI 动态入口、可见但禁用的聊天外壳、Mock 问 AI 展示组件受控提取及定向浏览器回归；不实现真实助手会话/API/持久化；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 4
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-14-agent-session-and-display-components-design.md（revision b969b267de0cac54dbd68c17c1a7544b67413fa0，blob 6df343758e71b2921080a1d3ccae7c86286d973b）、执行 Plan：docs/superpowers/plans/2026-09-14-agent-session-and-display-components.md（版本 a8fef7dfe5aa9bd753e4e97ad606d943c4ba597c，blob 9bbf21b64c82f06488468c5eea95790620bb28a6）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 逻辑 skill development-workflow 的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前从逻辑 skill development-workflow 安装根解析 scripts/task_intents.py，先读取 CLI help，再用 python3 调用 start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 逻辑 skill development-workflow 的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：实施进度、review裁决及验收责任对账写入 docs/superpowers/plans/2026-09-14-agent-session-and-display-components.md；测试/截图使用既有 test-results/ 与 ui-regression-output/，不新建handoff/review报告。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

产品边界：AI 行沿用“AI代理动态”，全部第一条、通知可见、仅会话隐藏，搜索照旧可过滤；Backend 不伪造时间、未读、最近消息或 P7 会话坐标。聊天栏可见但输入/发送 disabled，说明与原导航保持；Mock退出重进恢复演示，不增加持久化或清空功能。

校准前提：目标基线 1f8c223739deb8fb14fdfba51ca8240f081ab089；现有 P1 fixture 已含完成 onboarding 响应，不绕过产品 guard。Task 4 的 P1 selection 必须为五种消息用例×两宽度，共10条，不能退回只 grep“消息”。正式 development L3 selection 当前为 none；不得以此掩盖实施中越界变更，发生范围扩大先按批准契约处理。
```
