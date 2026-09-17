# 公司档案与教育候选展示统一 · 新会话执行提示词

批准正文与实施 Plan 的精确 Git 对象均冻结在下文。文档 review 两轮，R2 NO FINDINGS；最终交付版本另含审查记录和等值浏览器 URL 写法，未改变实施契约。按所用宿主复制对应完整 text 代码框。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 公司档案清单、基本信息／相册共享展示、公司分区外壳和引导学校／专业候选展示；Mock 为设计源头，Backend 增量复用现有设计，保留各自权限／校验／保存规则；不含屏蔽、聊天、推荐、数据合同或状态框架重构；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 4
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-17-company-profile-education-ui-unification-design.md（revision 7ec411fb3b0438d6c96e915108e7c97710f5003b，blob fcf2bb90a461f3c4f6917e5952a843b128826efb）、执行 Plan：docs/superpowers/plans/2026-09-17-company-profile-education-ui-unification.md（版本 82c4d3a19e0c790ef947b6b90f3d0952dd7257dc，blob ae2f4bf21a25d8c54d0e7fcbbc40152cab237341）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根目录的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前读取该 skill 根目录 scripts/task_intents.py 的 --help，以当地解析出的脚本路径执行 python3 脚本路径 start/list 登记和核对并行改动；扩大范围前 update。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：实现和测试写 Plan 的精确文件清单；raw 放 test-results/company-profile-education-ui/；临时视觉脚本和前后截图放 ui-regression-output/company-profile-education-ui/；Task／review／验证／合入摘要只追加到本 Plan。不要新建 handoff 或 review report。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

补充执行定位：四 Task 按 1→2→3→4 串行；Task 2/3 的实施与契约审查按 Plan 角色表使用前沿档。Task 1 产品修改前先完成 Plan「视觉采集可执行入口（R1 补充）」的全部 before 基线，不得改后补造。本设计 L3 responsibility=none、selection=none，记 N/A；final gate 按实际 diff 与届时仓库规则重算，不能把 fixture 记为真实 STG PASS。文档审查完成不替代新实施 session 的代码 review。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 公司档案清单、基本信息／相册共享展示、公司分区外壳和引导学校／专业候选展示；Mock 为设计源头，Backend 增量复用现有设计，保留各自权限／校验／保存规则；不含屏蔽、聊天、推荐、数据合同或状态框架重构；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 4
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-17-company-profile-education-ui-unification-design.md（revision 7ec411fb3b0438d6c96e915108e7c97710f5003b，blob fcf2bb90a461f3c4f6917e5952a843b128826efb）、执行 Plan：docs/superpowers/plans/2026-09-17-company-profile-education-ui-unification.md（版本 82c4d3a19e0c790ef947b6b90f3d0952dd7257dc，blob ae2f4bf21a25d8c54d0e7fcbbc40152cab237341）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根目录的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前读取该 skill 根目录 scripts/task_intents.py 的 --help，以当地解析出的脚本路径执行 python3 脚本路径 start/list 登记和核对并行改动；扩大范围前 update。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：实现和测试写 Plan 的精确文件清单；raw 放 test-results/company-profile-education-ui/；临时视觉脚本和前后截图放 ui-regression-output/company-profile-education-ui/；Task／review／验证／合入摘要只追加到本 Plan。不要新建 handoff 或 review report。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

补充执行定位：四 Task 按 1→2→3→4 串行；Task 2/3 的实施与契约审查按 Plan 角色表使用前沿档。Task 1 产品修改前先完成 Plan「视觉采集可执行入口（R1 补充）」的全部 before 基线，不得改后补造。本设计 L3 responsibility=none、selection=none，记 N/A；final gate 按实际 diff 与届时仓库规则重算，不能把 fixture 记为真实 STG PASS。文档审查完成不替代新实施 session 的代码 review。
```
