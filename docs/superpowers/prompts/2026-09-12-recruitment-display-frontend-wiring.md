# 双端展示接线新会话执行提示词

复制对应宿主代码框到新实施会话；二者执行同一份冻结 Plan。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target main（远端 origin/main）；实施范围 双端四列表、独立职位与匿名在线简历、Case/连续在谈资料及顶栏的已批准展示接线；完全复用PM Mock Up，身份只解码不展示，消息本轮不实现；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 7
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-11-recruitment-display-api-requirements-design.md（revision 24223e382ddb57f6c578104ae65b9070c4856400，blob b688b2af82ffe09f3d6ecfacef42e5e2c400c91a）、执行 Plan：docs/superpowers/plans/2026-09-12-recruitment-display-frontend-wiring.md（版本 ba60492c0ec6431a81b7e6ec8f44205fe44048f8，blob 42b170b279fe0170e515e23b49b7b26df2f68cd0）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 逻辑 development-workflow skill 的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前用 python3 由逻辑 development-workflow skill 根目录解析的 scripts/task_intents.py（先读 --help，再按 Plan 登记范围） start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 逻辑 development-workflow skill 的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：本仓库已批准 Plan 的执行/验证记录；真实联调证据用既有 dogfood-output 目录，不新增handoff/review报告文档。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

后端合同基线为 release/0.2.5@886e06837512bd8b08c4f10e010533baf89649dc，外部仓库 agxp-monorepo 的位置从 AGXP_MONOREPO_DIR 或用户已有 checkout 发现；核对 Plan 指定 BFF OpenAPI，不修改后端。新增required字段按冻结schema严格解码；company_size/funding_stage在公司摘要合同中为开放string，不能套用另一企业档案闭集。Mock前图按Plan在任何产品代码变动前采集。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target main（远端 origin/main）；实施范围 双端四列表、独立职位与匿名在线简历、Case/连续在谈资料及顶栏的已批准展示接线；完全复用PM Mock Up，身份只解码不展示，消息本轮不实现；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 7
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-11-recruitment-display-api-requirements-design.md（revision 24223e382ddb57f6c578104ae65b9070c4856400，blob b688b2af82ffe09f3d6ecfacef42e5e2c400c91a）、执行 Plan：docs/superpowers/plans/2026-09-12-recruitment-display-frontend-wiring.md（版本 ba60492c0ec6431a81b7e6ec8f44205fe44048f8，blob 42b170b279fe0170e515e23b49b7b26df2f68cd0）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 逻辑 development-workflow skill 的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前用 python3 由逻辑 development-workflow skill 根目录解析的 scripts/task_intents.py（先读 --help，再按 Plan 登记范围） start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 逻辑 development-workflow skill 的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：本仓库已批准 Plan 的执行/验证记录；真实联调证据用既有 dogfood-output 目录，不新增handoff/review报告文档。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

后端合同基线为 release/0.2.5@886e06837512bd8b08c4f10e010533baf89649dc，外部仓库 agxp-monorepo 的位置从 AGXP_MONOREPO_DIR 或用户已有 checkout 发现；核对 Plan 指定 BFF OpenAPI，不修改后端。新增required字段按冻结schema严格解码；company_size/funding_stage在公司摘要合同中为开放string，不能套用另一企业档案闭集。Mock前图按Plan在任何产品代码变动前采集。
```
