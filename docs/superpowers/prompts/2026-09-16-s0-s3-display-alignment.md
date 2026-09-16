# S0–S3 展示统一执行提示词

Spec 产品版本固定为 `31dfb7f0`；Plan 文档审查 1 轮，裁决后无未解决必修项。用户明确本轮不安排 L3。选择当前宿主章节，将完整代码框交给新实施 session；本文件不自动启动实现。

交付校验：已运行 development-workflow 的 `scripts/validate_prompt_grading.py --plan docs/superpowers/plans/2026-09-16-s0-s3-display-alignment.md --prompt docs/superpowers/prompts/2026-09-16-s0-s3-display-alignment.md`，双宿主 bundle 校验通过；这属于文档结构校验，不是产品测试。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 以 Mock Up 为准统一两端历史代谈、S0–S3 代谈进度、职位详情和在线简历，Backend/Mock共用展示，保留现有数据/状态/动作授权边界；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 7
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-16-s0-s3-display-alignment-design.md（revision 31dfb7f013fbf5c689db16cbbe58b00650864638，blob 4690d718b38fd0df2f69223926b704ba056a3a6d）、执行 Plan：docs/superpowers/plans/2026-09-16-s0-s3-display-alignment.md（版本 8ee7b19e62194091cf6547ff5c6b477a3a2217d9，blob b74c130a1d953f3230f0f10292b9b27da5823be4）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow 的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；将当地解析得到的 development-workflow 真实根目录记为 WORKFLOW_SKILL_ROOT（不写回交付），开工前调用当地解析的 development-workflow scripts/task_intents.py 的 start 子命令登记当前仓库任务（按该入口帮助填参数）。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow 的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 按本次用户覆盖跳过 development L3，记录 N/A（未执行，不是 PASS）→ cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：实施进度、代码 review 裁决、验证和最终合入记录就地写入执行 Plan；测试日志/截图/trace 使用现有 runner 的输出位置，task intent 使用 workflow 既有位置，不增加 handoff/review report/manifest 文档。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

本次明确用户覆盖（2026-09-16）：用户已批准上述产品 Spec 并要求本轮不安排 L3 测试。development L3 responsibility: none。该覆盖优先于 Spec §11 与 workflow 默认的必要 L3 步骤，贯穿实施和 final gate 之后：不启动真实后端 dogfood、真实账户旅程或实际代理结果验收；不能用 fixture 结果冒充真实后端 PASS。仍完成 Plan 的定向 Vitest/组件与控制回归、lint/build、全 HTTP 拦截的 Playwright（@s0-s3-display，mock-stg 与 backend-stg）。浏览器 fixture 只证明前端布局和接线。若发现非改后端 API/权限/schema 不可解决，报告真实范围缺口，不自行扩展或取消用户覆盖。

规划交付仅含文档，未执行产品测试或实现。按 Git 对象核对 Spec 和 Plan 内容；工作树 Spec 仅追加批准/review状态及 no-L3 记录，不能用最新候选正文替代批准产品合同。文档 review 使用 Claude opus/high 1轮，2 required已逐条核实处理、2 optional已裁决，详见Plan末节；这不替代实施后的代码review。先读取 Global Constraints/Task index/角色表，再按当前Task读取完整brief。若 Git 对象或必需skill不存在，明确具体缺失，不猜路径，不静默降档。

任务按1→2→3→4→5→6→7串行，核对上游提交和测试证据；不要并行改共享类型/映射文件。保持 Mock 视觉、匿名授权、既有生命周期与动作；不新增业务请求、依赖或全站抽象。此提示词启动新实施 session，允许持续完成全部已规划实现与确认前收尾；最终同步/合入/push仍等待该 session 展示具体方案后用户明确确认。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 以 Mock Up 为准统一两端历史代谈、S0–S3 代谈进度、职位详情和在线简历，Backend/Mock共用展示，保留现有数据/状态/动作授权边界；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 7
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-16-s0-s3-display-alignment-design.md（revision 31dfb7f013fbf5c689db16cbbe58b00650864638，blob 4690d718b38fd0df2f69223926b704ba056a3a6d）、执行 Plan：docs/superpowers/plans/2026-09-16-s0-s3-display-alignment.md（版本 8ee7b19e62194091cf6547ff5c6b477a3a2217d9，blob b74c130a1d953f3230f0f10292b9b27da5823be4）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow 的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；将当地解析得到的 development-workflow 真实根目录记为 WORKFLOW_SKILL_ROOT（不写回交付），开工前调用当地解析的 development-workflow scripts/task_intents.py 的 start 子命令登记当前仓库任务（按该入口帮助填参数）。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow 的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 按本次用户覆盖跳过 development L3，记录 N/A（未执行，不是 PASS）→ cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：实施进度、代码 review 裁决、验证和最终合入记录就地写入执行 Plan；测试日志/截图/trace 使用现有 runner 的输出位置，task intent 使用 workflow 既有位置，不增加 handoff/review report/manifest 文档。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

本次明确用户覆盖（2026-09-16）：用户已批准上述产品 Spec 并要求本轮不安排 L3 测试。development L3 responsibility: none。该覆盖优先于 Spec §11 与 workflow 默认的必要 L3 步骤，贯穿实施和 final gate 之后：不启动真实后端 dogfood、真实账户旅程或实际代理结果验收；不能用 fixture 结果冒充真实后端 PASS。仍完成 Plan 的定向 Vitest/组件与控制回归、lint/build、全 HTTP 拦截的 Playwright（@s0-s3-display，mock-stg 与 backend-stg）。浏览器 fixture 只证明前端布局和接线。若发现非改后端 API/权限/schema 不可解决，报告真实范围缺口，不自行扩展或取消用户覆盖。

规划交付仅含文档，未执行产品测试或实现。按 Git 对象核对 Spec 和 Plan 内容；工作树 Spec 仅追加批准/review状态及 no-L3 记录，不能用最新候选正文替代批准产品合同。文档 review 使用 Claude opus/high 1轮，2 required已逐条核实处理、2 optional已裁决，详见Plan末节；这不替代实施后的代码review。先读取 Global Constraints/Task index/角色表，再按当前Task读取完整brief。若 Git 对象或必需skill不存在，明确具体缺失，不猜路径，不静默降档。

任务按1→2→3→4→5→6→7串行，核对上游提交和测试证据；不要并行改共享类型/映射文件。保持 Mock 视觉、匿名授权、既有生命周期与动作；不新增业务请求、依赖或全站抽象。此提示词启动新实施 session，允许持续完成全部已规划实现与确认前收尾；最终同步/合入/push仍等待该 session 展示具体方案后用户明确确认。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。
```
