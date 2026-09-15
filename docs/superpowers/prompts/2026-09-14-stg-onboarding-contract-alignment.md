# 前端契约对齐执行提示词

文档review已裁决完成；只选择与你的实施宿主对应的一节。启动实施不是final gate授权。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 企业三名接线、MatchCase空技能修复、冻结onboarding接口与恢复、STG两个Case四变体；只做最小实现；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 5
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-14-stg-onboarding-contract-alignment-design.md（revision 7a7eaaab89b40f2a6b8aba84ed3ae55096e62f2e，blob 6fbf0e9913a23bcf495b13ca01bcfe18e2da1433）、执行 Plan：docs/superpowers/plans/2026-09-14-stg-onboarding-contract-alignment.md（版本 8616dd1e2a896f2666c74ba928afe8b056640abd，blob 3fa11af075a389dfd60d13e452d7245a460b1378）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根目录的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前用 python3 按实际安装位置解析的 development-workflow skill 根目录 scripts/task_intents.py start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ 适用 L0–L2 完整验证（本仓库无 affected runner，按 Plan 六条 npm 命令执行）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录 references/final-integration.md 及 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：实施记录写入执行Plan；L3证据用dogfood-output和现有docs/runs；不新建review报告。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

后端冻结契约引用见批准Spec§1/§4，用户提供checkout只读核验精确文档版本；不能自行修改后端或部署。前端可按冻结设计并行实现。完成实现、review及完整适用验证后停在final gate确认前，等待后端API与CLI部署能力就绪，再给用户具体L3方案。没有额外批准不跑正式STG L3、不合入、不push；本地route-fixture Playwright按Plan在确认前运行且不冒称STG。允许已证明隔离的retained，不以零残留阻塞。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 企业三名接线、MatchCase空技能修复、冻结onboarding接口与恢复、STG两个Case四变体；只做最小实现；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 5
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-14-stg-onboarding-contract-alignment-design.md（revision 7a7eaaab89b40f2a6b8aba84ed3ae55096e62f2e，blob 6fbf0e9913a23bcf495b13ca01bcfe18e2da1433）、执行 Plan：docs/superpowers/plans/2026-09-14-stg-onboarding-contract-alignment.md（版本 8616dd1e2a896f2666c74ba928afe8b056640abd，blob 3fa11af075a389dfd60d13e452d7245a460b1378）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根目录的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前用 python3 按实际安装位置解析的 development-workflow skill 根目录 scripts/task_intents.py start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ 适用 L0–L2 完整验证（本仓库无 affected runner，按 Plan 六条 npm 命令执行）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录 references/final-integration.md 及 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：实施记录写入执行Plan；L3证据用dogfood-output和现有docs/runs；不新建review报告。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

后端冻结契约引用见批准Spec§1/§4，用户提供checkout只读核验精确文档版本；不能自行修改后端或部署。前端可按冻结设计并行实现。完成实现、review及完整适用验证后停在final gate确认前，等待后端API与CLI部署能力就绪，再给用户具体L3方案。没有额外批准不跑正式STG L3、不合入、不push；本地route-fixture Playwright按Plan在确认前运行且不冒称STG。允许已证明隔离的retained，不以零残留阻塞。
```
