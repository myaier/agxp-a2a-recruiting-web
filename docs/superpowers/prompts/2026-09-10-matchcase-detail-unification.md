# 双端在谈详情实施启动提示词

使用当前用户工作区，选择对应宿主章节的完整代码框启动新实施 session；两节绑定同一组已审阅文档版本。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 双端在谈详情共用展示、完整缺失布局、P5控制与展示分离；不包括列表、onboarding或其他管理页面；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 11
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-10-matchcase-detail-unification-design.md（revision ec45087d90534298ce7d9f9d7b9f4e02e9d13106，blob 22245cf802b92f867990d9da646b792029822a67）、执行 Plan：docs/superpowers/plans/2026-09-10-matchcase-detail-unification.md（版本 dfa2abafe189da71e23f80d02c52f4b6bb4846d6，blob 47494d6e1ed46ed14a501281bf85a22985be2b87）的 Global Constraints、Task index、角色表与当前 Task 完整正文，及 development-workflow skill 根相对的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工先解析 development-workflow 的 scripts/task_intents.py 实际路径，再调用其 start 子命令登记。

测试与收尾责任：final gate 确认前经权威入口完成并修复全部适用 L0–L2，review 修复后只补失效项，未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根相对的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：本 Plan 的实施记录；浏览器与工具证据沿用 dogfood-output/、test-results/、ui-regression-output/，不另建手写交接或审查报告。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

批准输入说明：上述 Spec 版本包含批准与 Task 数量覆盖记录；产品批准正文为 revision dc86b11686011a87c3778d917f9cd3ef59cace22、blob dfc599b50d605df288597154cf76b5110ed9db30。用户随后明确允许按实际和 skills 拆 Task，不绑定 8–10。不得把此覆盖解释为扩大页面范围。Plan 文档 review 为 Claude 两轮，第二轮 NO FINDINGS，3 条 required 均已修复；实施代码仍需本宿主映射的异构 review。

并行边界：按 Spec §9 和 Plan 核对 audit-frontend-data-wiring 的实际状态。不要改其列表组件/映射/列表 CSS；详情迁入自有 CSS，候选头行不并行编辑。新参数只有已验证提交进入基线才使用，合入时收敛本页临时未知性别标记。E2E 公共文件保留双方用例，测试资源不能并发复用同一 fixture 生命周期；合入串行。

真实 local 前置尚未确认：在实施阶段提前询问缺失的目标 URL、后端工作区与专用账号/OTP 安全来源，不猜测、不把秘密写入仓库。H01/H03 的选中节点和 NOT_RUN/BLOCKED 记录按 Plan；确认前不运行正式 local L3。只做规划时没有任何产品测试或浏览器 PASS 可复用。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 双端在谈详情共用展示、完整缺失布局、P5控制与展示分离；不包括列表、onboarding或其他管理页面；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 11
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-10-matchcase-detail-unification-design.md（revision ec45087d90534298ce7d9f9d7b9f4e02e9d13106，blob 22245cf802b92f867990d9da646b792029822a67）、执行 Plan：docs/superpowers/plans/2026-09-10-matchcase-detail-unification.md（版本 dfa2abafe189da71e23f80d02c52f4b6bb4846d6，blob 47494d6e1ed46ed14a501281bf85a22985be2b87）的 Global Constraints、Task index、角色表与当前 Task 完整正文，及 development-workflow skill 根相对的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，final gate 计入总数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工先解析 development-workflow 的 scripts/task_intents.py 实际路径，再调用其 start 子命令登记。

测试与收尾责任：final gate 确认前经权威入口完成并修复全部适用 L0–L2，review 修复后只补失效项，未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根相对的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：本 Plan 的实施记录；浏览器与工具证据沿用 dogfood-output/、test-results/、ui-regression-output/，不另建手写交接或审查报告。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

批准输入说明：上述 Spec 版本包含批准与 Task 数量覆盖记录；产品批准正文为 revision dc86b11686011a87c3778d917f9cd3ef59cace22、blob dfc599b50d605df288597154cf76b5110ed9db30。用户随后明确允许按实际和 skills 拆 Task，不绑定 8–10。不得把此覆盖解释为扩大页面范围。Plan 文档 review 为 Claude 两轮，第二轮 NO FINDINGS，3 条 required 均已修复；实施代码仍需本宿主映射的异构 review。

并行边界：按 Spec §9 和 Plan 核对 audit-frontend-data-wiring 的实际状态。不要改其列表组件/映射/列表 CSS；详情迁入自有 CSS，候选头行不并行编辑。新参数只有已验证提交进入基线才使用，合入时收敛本页临时未知性别标记。E2E 公共文件保留双方用例，测试资源不能并发复用同一 fixture 生命周期；合入串行。

真实 local 前置尚未确认：在实施阶段提前询问缺失的目标 URL、后端工作区与专用账号/OTP 安全来源，不猜测、不把秘密写入仓库。H01/H03 的选中节点和 NOT_RUN/BLOCKED 记录按 Plan；确认前不运行正式 local L3。只做规划时没有任何产品测试或浏览器 PASS 可复用。
```
