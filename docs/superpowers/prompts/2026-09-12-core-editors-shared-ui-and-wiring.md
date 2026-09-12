# 核心编辑页共用展示与接线：新实施会话提示词

选择当前宿主的一节，复制其完整正文到新 session。两节执行同一份8任务Plan；不在规划会话开始实施。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 `.` 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target `origin/main`（具体同步/合入须在实施 final gate 展示并获批）；实施范围 两处前端接线（日常作品集三态、意向年薪月数过滤）和六个具体展示区域共享；原 Mock 源码/CSS 冻结保留，Mock 与 Backend 同时使用新展示，严格遵守既有 PM 样式及 Spec 明确例外，不修改后端；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 8
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-12-core-editors-shared-ui-and-wiring-design.md（revision f64e5e13541e3a3159d7b74944fbf2bfdf09a282，blob 860e4944d5028762446b82653615443d0c89cda6）、执行 Plan：docs/superpowers/plans/2026-09-12-core-editors-shared-ui-and-wiring.md（版本 6586dec9305634299e4b637a21e12ecf4a913d99，blob 7cbfbf3ea399ea9607c23f1dbce4fed0c78cfc59）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 逻辑 skill `development-workflow` 的根相对资源 `assets/execution-contract.md`；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前发现逻辑 skill `development-workflow`，将其根相对 `scripts/task_intents.py` 解析为本机可调用路径，读取 CLI 帮助后用 python3 调用该脚本的 start 子命令登记（路径仅用于运行，不写回交付）。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 逻辑 skill `development-workflow` 的根相对资源 `references/final-integration.md`：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：当前工作区 `.` 中的 Task 文件；进度、review裁决和验证摘要就地记录在执行 Plan；截图/runner receipt 使用既有忽略产物位置，真实验收沿现有 dogfood 入口，不新增规划 handoff/report 或第二工作区。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

审批溯源：用户批准设计 v1.0 的原始 revision 为 ca0eaab7ff14811cff1dbda6ff9eb1f0c6f7d9e5，blob 为 ee5b3db60116fbf61f99eb4ec579c2aee1d89cd8。上列批准 Spec 载体只更新审批元数据，设计第1–7节逐字不变；先核对Git对象存在和内容，不用当前最新文件替代。Claude Opus/high 文档审查1轮，2条required已由planner核实修复，1条删除父工作流的optional建议有理由拒绝，未解决required为0；修订后未再复审，不将此称为原始NO FINDINGS。具体裁决在Plan末节。

实施前确认所列原Mock快照尚需由Task1创建，六个共用展示仍需实施。本轮不能修改基础组件视觉或自行设计新控件；现有控件无法承载时先列具体页面/输入/限制供PM决策，可继续无依赖工作。类型定义从 src/数据/招聘数据源类型.ts 读取；城市行政分组改造保留原Mock中文/拼音搜索。正式live验收为required，按Plan选B02/B04相关节点及作品集/意向反例；缺环境记录BLOCKED，不宣称完整验收通过。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 `.` 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target `origin/main`（具体同步/合入须在实施 final gate 展示并获批）；实施范围 两处前端接线（日常作品集三态、意向年薪月数过滤）和六个具体展示区域共享；原 Mock 源码/CSS 冻结保留，Mock 与 Backend 同时使用新展示，严格遵守既有 PM 样式及 Spec 明确例外，不修改后端；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 8
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-12-core-editors-shared-ui-and-wiring-design.md（revision f64e5e13541e3a3159d7b74944fbf2bfdf09a282，blob 860e4944d5028762446b82653615443d0c89cda6）、执行 Plan：docs/superpowers/plans/2026-09-12-core-editors-shared-ui-and-wiring.md（版本 6586dec9305634299e4b637a21e12ecf4a913d99，blob 7cbfbf3ea399ea9607c23f1dbce4fed0c78cfc59）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 逻辑 skill `development-workflow` 的根相对资源 `assets/execution-contract.md`；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前发现逻辑 skill `development-workflow`，将其根相对 `scripts/task_intents.py` 解析为本机可调用路径，读取 CLI 帮助后用 python3 调用该脚本的 start 子命令登记（路径仅用于运行，不写回交付）。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 逻辑 skill `development-workflow` 的根相对资源 `references/final-integration.md`：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：当前工作区 `.` 中的 Task 文件；进度、review裁决和验证摘要就地记录在执行 Plan；截图/runner receipt 使用既有忽略产物位置，真实验收沿现有 dogfood 入口，不新增规划 handoff/report 或第二工作区。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

审批溯源：用户批准设计 v1.0 的原始 revision 为 ca0eaab7ff14811cff1dbda6ff9eb1f0c6f7d9e5，blob 为 ee5b3db60116fbf61f99eb4ec579c2aee1d89cd8。上列批准 Spec 载体只更新审批元数据，设计第1–7节逐字不变；先核对Git对象存在和内容，不用当前最新文件替代。Claude Opus/high 文档审查1轮，2条required已由planner核实修复，1条删除父工作流的optional建议有理由拒绝，未解决required为0；修订后未再复审，不将此称为原始NO FINDINGS。具体裁决在Plan末节。

实施前确认所列原Mock快照尚需由Task1创建，六个共用展示仍需实施。本轮不能修改基础组件视觉或自行设计新控件；现有控件无法承载时先列具体页面/输入/限制供PM决策，可继续无依赖工作。类型定义从 src/数据/招聘数据源类型.ts 读取；城市行政分组改造保留原Mock中文/拼音搜索。正式live验收为required，按Plan选B02/B04相关节点及作品集/意向反例；缺环境记录BLOCKED，不宣称完整验收通过。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。
```
