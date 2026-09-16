# 聊天与推荐修复执行提示词

任选与实施宿主对应的一个章节，在新实施 session 使用；两个章节执行同一份九任务 Plan。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository 当前前端仓库及 agxp-monorepo 后端仓库（同一 Plan、各自原有用户工作区） 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target 前端 main、后端 release/0.2.5（规划候选，实际 ref/SHA 在 final gate 明确确认）；实施范围 Spec 的八项修复和 Plan 的九个实施 Task；先后端合同，再前端接线；不清库、不补历史兼容、不改亮点生成器；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 9
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-17-chat-recommendation-display-design.md（revision 3ff331f1e62a0507b8a6491fdd2aaafa15e0777e，blob 2f39a9bb333b8f995f5cb43cd4d9c399d2bd671a）、执行 Plan：docs/superpowers/plans/2026-09-17-chat-recommendation-display.md（版本 0f9329d4c0e9b704383332dc1ed4388572ac81d9，blob 84896e4a8df014ff7b5404d05594599470d98bed）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根目录相对 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前用 python3 按 development-workflow skill 根目录解析的 scripts/task_intents.py start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录相对 references/final-integration.md 及 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：docs/superpowers/plans/2026-09-17-chat-recommendation-display.md 的实施记录；runner 原始证据使用既有位置，不新增 handoff/review 报告。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

跨仓库定位：本提示词、Spec、Plan 均从前端根读取，并用该仓库 Git 对象核对版本。后端文件路径在 agxp-monorepo 根解析；使用用户指定的已有后端工作区，不从当前目录拼造另一仓库路径。若新 session 未提供后端位置，先定位当前可用项目；仍无法定位时只询问后端工作区位置，不重新讨论设计。可以先做不依赖该位置的文档核验。
审批状态：用户已批准 Spec 并要求本 Plan 与执行交付；Claude 文档 review 两轮完成，第二轮 NO FINDINGS，记录在 Plan。不得把“启动实施”当作 final gate、正式 L3、同步目标或 push 的批准。
最关键的防漂移点：企业屏蔽与公司字段披露分离；经历开关沿用完成→保存流程、失败保留意图；招聘聊天副标题取用人企业及投递岗位，求职聊天取发布方公司及招聘者职务；双方头像32px、坏图回退各自首字；在线简历手机邮箱为占位；六维解释同源冻结，不用当前资料重算；已有测试数据允许重建不等于自动清理未知环境。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository 当前前端仓库及 agxp-monorepo 后端仓库（同一 Plan、各自原有用户工作区） 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target 前端 main、后端 release/0.2.5（规划候选，实际 ref/SHA 在 final gate 明确确认）；实施范围 Spec 的八项修复和 Plan 的九个实施 Task；先后端合同，再前端接线；不清库、不补历史兼容、不改亮点生成器；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 9
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-17-chat-recommendation-display-design.md（revision 3ff331f1e62a0507b8a6491fdd2aaafa15e0777e，blob 2f39a9bb333b8f995f5cb43cd4d9c399d2bd671a）、执行 Plan：docs/superpowers/plans/2026-09-17-chat-recommendation-display.md（版本 0f9329d4c0e9b704383332dc1ed4388572ac81d9，blob 84896e4a8df014ff7b5404d05594599470d98bed）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根目录相对 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前用 python3 按 development-workflow skill 根目录解析的 scripts/task_intents.py start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录相对 references/final-integration.md 及 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：docs/superpowers/plans/2026-09-17-chat-recommendation-display.md 的实施记录；runner 原始证据使用既有位置，不新增 handoff/review 报告。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

跨仓库定位：本提示词、Spec、Plan 均从前端根读取，并用该仓库 Git 对象核对版本。后端文件路径在 agxp-monorepo 根解析；使用用户指定的已有后端工作区，不从当前目录拼造另一仓库路径。若新 session 未提供后端位置，先定位当前可用项目；仍无法定位时只询问后端工作区位置，不重新讨论设计。可以先做不依赖该位置的文档核验。
审批状态：用户已批准 Spec 并要求本 Plan 与执行交付；Claude 文档 review 两轮完成，第二轮 NO FINDINGS，记录在 Plan。不得把“启动实施”当作 final gate、正式 L3、同步目标或 push 的批准。
最关键的防漂移点：企业屏蔽与公司字段披露分离；经历开关沿用完成→保存流程、失败保留意图；招聘聊天副标题取用人企业及投递岗位，求职聊天取发布方公司及招聘者职务；双方头像32px、坏图回退各自首字；在线简历手机邮箱为占位；六维解释同源冻结，不用当前资料重算；已有测试数据允许重建不等于自动清理未知环境。
```
