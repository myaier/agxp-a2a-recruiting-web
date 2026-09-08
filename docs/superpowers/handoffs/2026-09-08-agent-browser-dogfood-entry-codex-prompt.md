你在用户选定的宿主任务工作区 /Users/visionclaw/.paseo/worktrees/09eyc7i7/rural-kangaroo 中，执行一个已批准并完成文档 review 的独立交付 Plan。

按顺序读取 `CLAUDE.md`、`AGENTS.md`、docs/superpowers/specs/2026-09-08-agent-browser-dogfood-entry-design.md（批准版本 r2；revision 082aa94b6851c596e9c17856a4eee769b7e6ef51；blob 8e8f40b4ffcc938069b9b1a58a75cd13d51ad1d4）、docs/superpowers/plans/2026-09-08-agent-browser-dogfood-entry.md（版本 r2；revision ab0249832b2ff87b413a34ddbef581b3b44d8985；blob 978437372fb007b3e9af3f5960a5a6fe8f58ca17）的 Global Constraints 与 Task index、/Users/visionclaw/coding-harness/skills/development-workflow/assets/execution-contract.md。不要一次读取其它 Task 正文。

固定身份：repository https://github.com/myaier/agxp-a2a-recruiting-web；target origin/main；实施范围 该 Plan 的 Task 1–2：四个旧 agent-browser 入口及专属目录退役、两份 PDF 迁移、行为指南/报告模板/路由和配置清理、定向验证与真实演练证据；不修改应用和后端业务，不新增 runner/DSL/评分系统。
复用当前宿主工作区：不创建、移动或删除第二个用户工作区，不自动 stash/reset/clean 任何已有内容。
并行预告：开工前用 python3 /Users/visionclaw/coding-harness/skills/development-workflow/scripts/task_intents.py start 登记本任务；扩大范围、恢复与收尾时按合同更新。

实施方式：使用 Superpowers executing plans 能力（`$superpowers:executing-plans`）按 Plan 连续执行；同一执行者完成实现、实施 peer review、final gate 与收尾。
异构 reviewer：使用以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准 Spec/Plan 精确版本与共用守约规则；reviewer 默认不跑测试。
测试与收尾责任：确认前只做 Plan 的必要定向反馈，不提前完整跑 affected；真实边界风险及时定向验证。final gate 方案展示后等待用户明确确认，获批后按 /Users/visionclaw/coding-harness/skills/development-workflow/references/final-integration.md 同步 target、重算完整责任，复用有效 PASS 并增量补测 affected 与必要 development L3；merge 和修复后均只补证据缺口，汇总最终权威 PASS 后普通 fast-forward push，不得 force push。
输出位置：实施进展与最终证据记录于 docs/superpowers/handoffs/2026-09-08-agent-browser-dogfood-entry-implementation.md；演练私密材料只留 dogfood-output/<run-id>/，脱敏摘要按 Plan 写入 docs/runs/2026-09-08-agent-browser-dogfood-migration.md；规划审查记录位于 docs/superpowers/handoffs/2026-09-08-agent-browser-dogfood-entry.md。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 和 Plan 当前 Task brief；不要从本提示词补充产品设计。

执行前核对上述 revision:path 与 blob；工作树文档内容不匹配时读取固定 Git 对象并说明差异，不能把未批准改稿当基线。Spec 中“待批准”是批准前历史文字，用户已批准上述 r2。受审 Plan r2 已由 Claude Opus/high 两轮文档审查收敛，最终 NO FINDINGS；新会话仍须在实现后完成对应异构代码 review，不能用文档 review 替代。

真实演练最低责任为 B02、H01 清理后两次独立运行、H04 与各自清理；缺少后端/fixture/账号时记录 BLOCKED 与未完成责任，继续独立可做的迁移检查，不以单测或 --list PASS 代替。当前未跟踪盘点文件 docs/前端E2E测试Case清单-20260908.md 不属于本任务，不提交或清理。

共用 peer-review 守约规则：/Users/visionclaw/coding-harness/skills/_shared/review-contract.md。reviewer 只读、默认不跑测试，冻结批准契约和候选，逐条裁决，最多三轮。
