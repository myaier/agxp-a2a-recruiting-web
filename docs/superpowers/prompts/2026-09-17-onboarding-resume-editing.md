# Onboarding 与简历编辑：零上下文执行提示词

批准 Spec 与已完成两轮 Claude 文档 review 的 Plan 已固定版本。选择一个宿主，在包含先行最终合入版本及以下文档 Git 对象的工作区启动全新 session。实施前置与最终人工 gate 分别按 Plan 执行。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 `.` 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target `origin/main`；实施范围 批准 Spec §1–11 所定义的 onboarding、日常简历/求职状态编辑、Mock、测试及活动验收指南；不修改聊天推荐、公司管理或后端；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 5
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-17-onboarding-resume-editing-design.md（revision ad781149019d1197b0211d7fdebd9d329e2a417b，blob 19f720e212db569eba5c354cecb67fb7b493a766）、执行 Plan：docs/superpowers/plans/2026-09-17-onboarding-resume-editing.md（版本 cba7f975e2c4f60abd9b24bbdb0829a81442b758，blob eb460a10f05eabe06216d6f64a1a98fbead04b0c）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根相对 `assets/execution-contract.md`；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前用 python3 由 development-workflow skill 真实根解析的 `scripts/task_intents.py` start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根相对 `references/final-integration.md` 与 `assets/final-integration-contract.md`：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：执行记录、review 裁决与证据摘要追加执行 Plan；原始日志归档既有 `test-results/`，视觉与现场证据用既有视觉目录及 `dogfood-output/`。Playwright 清空输出前先保存会话临时副本，不另建交付文档。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。


开工依赖：先完整读取 Plan「开工依赖门与基线」「依赖门的具体解锁步骤」「先行最终测试责任登记」。fix/chat-recommend-display 必须先完成并合入 target，且用户选定的当前工作区 HEAD 已含最终依赖与批准文档 Git 对象；核验最终功能 SHA、目标合入 SHA、祖先或 squash diff 及 Spec §11 合同。旧的 ccaf70106f4148765001da0921c4f2533f996bfa 只是调查快照，不能当最终交付证明。未满足则报告 DEPENDENCY_BLOCKED，不修改产品、不偷跑独立 Task、不自动合并先行分支或 target。用户在启动 session 之前的手动基线准备按 Plan 执行，不能由实施 Agent 代做。

技能按逻辑名发现并解析符号链接真实根；读取 execution contract 和共用 review contract 后执行，不猜固定安装目录。先按 Plan 的 task_intents.py start/list/update 登记完整路径与合同。每个 Task 只读其完整 brief 和必要依赖；任务执行前核验实际源码，偏离批准公共合同则停止相关工作并报告。当前两个 prompt 是互选入口，不能同时启动两个实施 session。

继承先行企业屏蔽、hidden 与 partial failure 合同；从其最终 diff 登记完整测试 Case/project/行为，所有选择器 --list 与清单逐项对账。实施用定向 TDD；完成 Mock 与测试变更并跑通适用选集，不因本文档 review clean 声称产品验证已通过。required STG 按 Plan 的活动指南和清理规则执行，缺少必需前置时保留 BLOCKED，不虚报 PASS。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 `.` 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target `origin/main`；实施范围 批准 Spec §1–11 所定义的 onboarding、日常简历/求职状态编辑、Mock、测试及活动验收指南；不修改聊天推荐、公司管理或后端；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 5
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-17-onboarding-resume-editing-design.md（revision ad781149019d1197b0211d7fdebd9d329e2a417b，blob 19f720e212db569eba5c354cecb67fb7b493a766）、执行 Plan：docs/superpowers/plans/2026-09-17-onboarding-resume-editing.md（版本 cba7f975e2c4f60abd9b24bbdb0829a81442b758，blob eb460a10f05eabe06216d6f64a1a98fbead04b0c）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根相对 `assets/execution-contract.md`；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前用 python3 由 development-workflow skill 真实根解析的 `scripts/task_intents.py` start 登记。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根相对 `references/final-integration.md` 与 `assets/final-integration-contract.md`：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：执行记录、review 裁决与证据摘要追加执行 Plan；原始日志归档既有 `test-results/`，视觉与现场证据用既有视觉目录及 `dogfood-output/`。Playwright 清空输出前先保存会话临时副本，不另建交付文档。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。


开工依赖：先完整读取 Plan「开工依赖门与基线」「依赖门的具体解锁步骤」「先行最终测试责任登记」。fix/chat-recommend-display 必须先完成并合入 target，且用户选定的当前工作区 HEAD 已含最终依赖与批准文档 Git 对象；核验最终功能 SHA、目标合入 SHA、祖先或 squash diff 及 Spec §11 合同。旧的 ccaf70106f4148765001da0921c4f2533f996bfa 只是调查快照，不能当最终交付证明。未满足则报告 DEPENDENCY_BLOCKED，不修改产品、不偷跑独立 Task、不自动合并先行分支或 target。用户在启动 session 之前的手动基线准备按 Plan 执行，不能由实施 Agent 代做。

技能按逻辑名发现并解析符号链接真实根；读取 execution contract 和共用 review contract 后执行，不猜固定安装目录。先按 Plan 的 task_intents.py start/list/update 登记完整路径与合同。每个 Task 只读其完整 brief 和必要依赖；任务执行前核验实际源码，偏离批准公共合同则停止相关工作并报告。当前两个 prompt 是互选入口，不能同时启动两个实施 session。

继承先行企业屏蔽、hidden 与 partial failure 合同；从其最终 diff 登记完整测试 Case/project/行为，所有选择器 --list 与清单逐项对账。实施用定向 TDD；完成 Mock 与测试变更并跑通适用选集，不因本文档 review clean 声称产品验证已通过。required STG 按 Plan 的活动指南和清理规则执行，缺少必需前置时保留 BLOCKED，不虚报 PASS。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。
```
