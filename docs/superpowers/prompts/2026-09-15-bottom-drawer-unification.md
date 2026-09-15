# 底部抽屉统一：新 session 执行提示词

仅在新实施 session 使用。Spec v1.0 已批准；Plan v1.1 完成一轮 Claude 文档 review 并修复两项 required finding。当前规划 session 没有实施产品。两个宿主引用同一精确文档版本。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 Spec列出的底部抽屉字段统一和公共背景跳动修复；最小实现，沿用当前项目样式，全屏目录由另一任务负责；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 5
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-15-bottom-drawer-unification-design.md（revision 0e07383dad5e5288ef641a96e5d673bbcceb577f，blob bf3c8383f6dac7147060360111296bd8c5d0ffcb）、执行 Plan：docs/superpowers/plans/2026-09-15-bottom-drawer-unification.md（版本 dd3eafcf9b27d0ad6d385cef26616b186e361e09，blob 8ee5a8bc92dea7773aaa3916cdcdc77c7247cfce）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 逻辑 skill development-workflow 的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前定位 development-workflow skill 根目录中的 scripts/task_intents.py，读取 --help，再用 python3 调用其 start 子命令登记并核对同 clone 改动预告。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 逻辑 skill development-workflow 的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：本 Plan 的实施记录及既有 test-results / dogfood-output 证据目录；不另建 handoff、review report 或第二份 Plan。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

最小实现与样式底线：复用当前选择行、顶栏、CSS Modules、字体/间距/圆角/遮罩和动画；不新建通用picker框架、不新增依赖、不重排无关表单。只按已冻结接口实现，共享文件只改本任务数值/日期区域，保留全屏任务的改动。薪资规则、取值范围和日期精度不得因UI统一而改变。

版本核对：批准Spec从上述revision读取并核对blob；工作树Spec仅批准记录有变化，不改变产品条款。Plan从上述版本读取并核对blob，实施记录追加不得重新定义产品契约。若缺少Git对象或有实质差异，报告具体输入缺失或漂移。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 Spec列出的底部抽屉字段统一和公共背景跳动修复；最小实现，沿用当前项目样式，全屏目录由另一任务负责；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 5
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-15-bottom-drawer-unification-design.md（revision 0e07383dad5e5288ef641a96e5d673bbcceb577f，blob bf3c8383f6dac7147060360111296bd8c5d0ffcb）、执行 Plan：docs/superpowers/plans/2026-09-15-bottom-drawer-unification.md（版本 dd3eafcf9b27d0ad6d385cef26616b186e361e09，blob 8ee5a8bc92dea7773aaa3916cdcdc77c7247cfce）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 逻辑 skill development-workflow 的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前定位 development-workflow skill 根目录中的 scripts/task_intents.py，读取 --help，再用 python3 调用其 start 子命令登记并核对同 clone 改动预告。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 逻辑 skill development-workflow 的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：本 Plan 的实施记录及既有 test-results / dogfood-output 证据目录；不另建 handoff、review report 或第二份 Plan。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

最小实现与样式底线：复用当前选择行、顶栏、CSS Modules、字体/间距/圆角/遮罩和动画；不新建通用picker框架、不新增依赖、不重排无关表单。只按已冻结接口实现，共享文件只改本任务数值/日期区域，保留全屏任务的改动。薪资规则、取值范围和日期精度不得因UI统一而改变。

版本核对：批准Spec从上述revision读取并核对blob；工作树Spec仅批准记录有变化，不改变产品条款。Plan从上述版本读取并核对blob，实施记录追加不得重新定义产品契约。若缺少Git对象或有实质差异，报告具体输入缺失或漂移。
```
