# 求职端 AI 聊天执行提示词

本文件为同一 Plan 的双宿主独立入口；只复制对应宿主正文，不拼接另一节。文档审查完成：Claude opus/high 一轮，3条修复、2条核实后不作为required；详细裁决见Plan。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 `.` 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main（具体 SHA 与最终合入动作由人工 final gate 确认）；实施范围 求职端 Backend 四个助手接口、历史/轮询/幂等重试、简报式消息内嵌原生岗位与在谈卡、在谈详情摘要与原生页返回；最小实现，复用当前组件/样式，不改后端、不开放招聘端、不创建新卡片体系；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 6
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-16-candidate-assistant-chat-design.md（revision 22f3d7df7ff60f68e972468b3e36cd3389414d5d，blob 6cfdacd580bb3a64343c009c50e979b90bed113c）、执行 Plan：docs/superpowers/plans/2026-09-16-candidate-assistant-chat.md（版本 6b0d405214a3724045d2458f7b1cd9fcf2dc9262，blob e61e70f3f08c8dce12e6d702a2930ac0ce263881）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根目录下的 `assets/execution-contract.md`；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；先通过逻辑 skill 发现将 `WORKFLOW_ROOT` 设为该 skill 的真实根目录，再于开工前用 python3 "$WORKFLOW_ROOT/scripts/task_intents.py" start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录下的 `references/final-integration.md` 与 `assets/final-integration-contract.md`：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：本 Plan 的 checkbox/实施记录以及既有测试 runner 输出位置；真实行为证据放既有 dogfood-output 的本次运行目录，不新增独立 handoff/review report 文档。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

额外执行边界（不扩产品范围）：
- 批准 Spec Git 对象是设计权威。工作树 Spec blob 98f5dd0c82763c805932a735291f981c0f65e458 仅增加批准记录，正文与批准 blob 相同；核验后使用设计正文，不因状态段差异重新设计。
- 后端合同来自调用者提供的 AGXP_MONOREPO_DIR 所指 checkout，精确 revision 719ead0a0a4368b4dc2ff7e85d57ab74f47e9095，仓库内文件 apps/recruitment-bff/openapi/mobile-v1.yaml。缺对象/环境不得猜测或把Mock当真实证据。
- 市场卡只提取展示并复用原CSS；求职在谈卡直接复用；详情摘要与消息框组合现有白卡、阶段区、代理气泡和简报样式。缺字段占位，不能算假分、补假图、从完整详情请求偷偷补成最新快照。
- 真实字段和ID已由后端工具结果提供给LLM；前端不回传整个历史或拼系统提示词。关键词追问是否选中正确record_id必须由真实助手旅程证明，不以HTTP fixture宣称模型理解成功。
- 本仓库没有 tools/test affected；收尾按 Plan 的去重文件清单使用 npm/Vitest/Playwright 入口完成受影响覆盖，再加类型/lint/build。不引入后端测试基础设施，不自动全跑浏览器套件。
- 文档review裁决已冻结在Plan：不重开无新证据的可选逐卡降级与不可查看入口放开建议；不得修改Spec来让超范围实现自证合规。
- 当前任务是执行已完成规划的产品实现。连续完成所有Task、适用宿主内review、异构代码review及最小覆盖验证，直到可提交具体final gate方案；此时等待用户批准。不要在只有计划或部分实现时交付完成。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 `.` 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main（具体 SHA 与最终合入动作由人工 final gate 确认）；实施范围 求职端 Backend 四个助手接口、历史/轮询/幂等重试、简报式消息内嵌原生岗位与在谈卡、在谈详情摘要与原生页返回；最小实现，复用当前组件/样式，不改后端、不开放招聘端、不创建新卡片体系；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 6
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-16-candidate-assistant-chat-design.md（revision 22f3d7df7ff60f68e972468b3e36cd3389414d5d，blob 6cfdacd580bb3a64343c009c50e979b90bed113c）、执行 Plan：docs/superpowers/plans/2026-09-16-candidate-assistant-chat.md（版本 6b0d405214a3724045d2458f7b1cd9fcf2dc9262，blob e61e70f3f08c8dce12e6d702a2930ac0ce263881）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根目录下的 `assets/execution-contract.md`；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；先通过逻辑 skill 发现将 `WORKFLOW_ROOT` 设为该 skill 的真实根目录，再于开工前用 python3 "$WORKFLOW_ROOT/scripts/task_intents.py" start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录下的 `references/final-integration.md` 与 `assets/final-integration-contract.md`：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：本 Plan 的 checkbox/实施记录以及既有测试 runner 输出位置；真实行为证据放既有 dogfood-output 的本次运行目录，不新增独立 handoff/review report 文档。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

额外执行边界（不扩产品范围）：
- 批准 Spec Git 对象是设计权威。工作树 Spec blob 98f5dd0c82763c805932a735291f981c0f65e458 仅增加批准记录，正文与批准 blob 相同；核验后使用设计正文，不因状态段差异重新设计。
- 后端合同来自调用者提供的 AGXP_MONOREPO_DIR 所指 checkout，精确 revision 719ead0a0a4368b4dc2ff7e85d57ab74f47e9095，仓库内文件 apps/recruitment-bff/openapi/mobile-v1.yaml。缺对象/环境不得猜测或把Mock当真实证据。
- 市场卡只提取展示并复用原CSS；求职在谈卡直接复用；详情摘要与消息框组合现有白卡、阶段区、代理气泡和简报样式。缺字段占位，不能算假分、补假图、从完整详情请求偷偷补成最新快照。
- 真实字段和ID已由后端工具结果提供给LLM；前端不回传整个历史或拼系统提示词。关键词追问是否选中正确record_id必须由真实助手旅程证明，不以HTTP fixture宣称模型理解成功。
- 本仓库没有 tools/test affected；收尾按 Plan 的去重文件清单使用 npm/Vitest/Playwright 入口完成受影响覆盖，再加类型/lint/build。不引入后端测试基础设施，不自动全跑浏览器套件。
- 文档review裁决已冻结在Plan：不重开无新证据的可选逐卡降级与不可查看入口放开建议；不得修改Spec来让超范围实现自证合规。
- 当前任务是执行已完成规划的产品实现。连续完成所有Task、适用宿主内review、异构代码review及最小覆盖验证，直到可提交具体final gate方案；此时等待用户批准。不要在只有计划或部分实现时交付完成。
```
