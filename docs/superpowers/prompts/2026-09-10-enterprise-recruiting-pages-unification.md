# 企业公开页与招聘名片统一执行提示词

仅复制适用宿主章节的完整代码框到新实施会话。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 企业公开页与招聘名片各自共用展示、缺字段占位、原保存与权限保留及验证；不改后端接口、其他页面或状态系统；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 4
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-10-enterprise-recruiting-pages-unification-design.md（revision afbb2c67bcf04c3a692a6e9f0442a711bb282676，blob 90798f9001235e811e9b66896896ebf040516570）、执行 Plan：docs/superpowers/plans/2026-09-10-enterprise-recruiting-pages-unification.md（版本 af3e51307a0c96c15b313e6dbd3d6c8af88f51ab，blob a624e6d018f7585372fb210136ae2f4c2c8b5fdb）的 Global Constraints、Task index、角色表与当前 Task 完整正文，及 development-workflow skill 根相对的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前解析 development-workflow skill 根下 scripts/task_intents.py，用 python3 运行该文件的 --help，再按实际参数 start 登记。

测试与收尾责任：final gate 确认前经权威入口完成并修复全部适用 L0–L2，review 修复后只补失效项，未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根相对的 references/final-integration.md（并读取 assets/final-integration-contract.md）：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：本 Plan 的验证记录与既有 ui-regression-output/、test-results/、dogfood-output/；不新增 handoff 或审查文档。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 企业公开页与招聘名片各自共用展示、缺字段占位、原保存与权限保留及验证；不改后端接口、其他页面或状态系统；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 4
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-10-enterprise-recruiting-pages-unification-design.md（revision afbb2c67bcf04c3a692a6e9f0442a711bb282676，blob 90798f9001235e811e9b66896896ebf040516570）、执行 Plan：docs/superpowers/plans/2026-09-10-enterprise-recruiting-pages-unification.md（版本 af3e51307a0c96c15b313e6dbd3d6c8af88f51ab，blob a624e6d018f7585372fb210136ae2f4c2c8b5fdb）的 Global Constraints、Task index、角色表与当前 Task 完整正文，及 development-workflow skill 根相对的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，final gate 计入总数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前解析 development-workflow skill 根下 scripts/task_intents.py，用 python3 运行该文件的 --help，再按实际参数 start 登记。

测试与收尾责任：final gate 确认前经权威入口完成并修复全部适用 L0–L2，review 修复后只补失效项，未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根相对的 references/final-integration.md（并读取 assets/final-integration-contract.md）：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：本 Plan 的验证记录与既有 ui-regression-output/、test-results/、dogfood-output/；不新增 handoff 或审查文档。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。
```
