# 三类列表卡片统一：新实施会话执行提示词

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 招聘推荐、招聘在谈、求职在谈三类卡片的 Mock/Backend 共享展示，以及合法缺失字段的明显占位；保持原数据范围与操作；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 5
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-10-list-card-unification-design.md（revision 8e2a145523e86550d4984cb48376fb6564159bf6，blob 12009a42b14732645494dca463f6003392015731）、执行 Plan：docs/superpowers/plans/2026-09-10-list-card-unification.md（版本 1810da555fd64f900a8dfa153a20679816fa242b，blob d48466d2614216d60e1399440660fc877b7a241a）的 Global Constraints、Task index、角色表与当前 Task 完整正文，及 development-workflow skill 根目录相对的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前从 development-workflow skill 根目录解析 scripts/task_intents.py 的当地路径，用 python3 调用该脚本的 start 子命令登记。

测试与收尾责任：final gate 确认前经权威入口完成并修复全部适用 L0–L2，review 修复后只补失效项，未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录相对的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：实施与 review 记录写回执行 Plan；测试日志沿用 test-results/、ui-regression-output/、dogfood-output/；不新增 handoff/review report。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

补充执行边界：完整读取 CLAUDE.md 与 AGENTS.md。开工核对 Task count 为 5，Task 1–4 连续按依赖执行，Task 5 由同一执行者主持。Spec 工作树仅批准记录不同，批准正文 §1–§9 用上述 Git 对象核对。真实 local 集成责任为 required，按 docs/dogfood/真实后端行为验收.md 和 Plan Task 5 选定流程执行；环境不足须记录未完成。已 review 候选只 merge target，不 rebase。target 推进或 push rejected 时更新方案再确认，不 force push。规划批准不等于最终合入批准。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 招聘推荐、招聘在谈、求职在谈三类卡片的 Mock/Backend 共享展示，以及合法缺失字段的明显占位；保持原数据范围与操作；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 5
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-10-list-card-unification-design.md（revision 8e2a145523e86550d4984cb48376fb6564159bf6，blob 12009a42b14732645494dca463f6003392015731）、执行 Plan：docs/superpowers/plans/2026-09-10-list-card-unification.md（版本 1810da555fd64f900a8dfa153a20679816fa242b，blob d48466d2614216d60e1399440660fc877b7a241a）的 Global Constraints、Task index、角色表与当前 Task 完整正文，及 development-workflow skill 根目录相对的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，final gate 计入总数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前从 development-workflow skill 根目录解析 scripts/task_intents.py 的当地路径，用 python3 调用该脚本的 start 子命令登记。

测试与收尾责任：final gate 确认前经权威入口完成并修复全部适用 L0–L2，review 修复后只补失效项，未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录相对的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：实施与 review 记录写回执行 Plan；测试日志沿用 test-results/、ui-regression-output/、dogfood-output/；不新增 handoff/review report。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

补充执行边界：完整读取 CLAUDE.md 与 AGENTS.md。开工核对 Task count 为 5，Task 1–4 连续按依赖执行，Task 5 由同一执行者主持。Spec 工作树仅批准记录不同，批准正文 §1–§9 用上述 Git 对象核对。真实 local 集成责任为 required，按 docs/dogfood/真实后端行为验收.md 和 Plan Task 5 选定流程执行；环境不足须记录未完成。已 review 候选只 merge target，不 rebase。target 推进或 push rejected 时更新方案再确认，不 force push。规划批准不等于最终合入批准。
```
