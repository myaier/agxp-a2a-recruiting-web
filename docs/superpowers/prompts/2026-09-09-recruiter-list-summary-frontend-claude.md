你在用户选定的宿主任务工作区 /Users/visionclaw/.paseo/worktrees/09eyc7i7/resolute-flamingo 的全新 Claude Code session 中，执行一个已批准并完成文档 review 的独立交付 Plan。

按顺序读取 CLAUDE.md、AGENTS.md、docs/superpowers/specs/2026-09-09-recruiter-list-summary-frontend-design.md（批准版本 revision 5aeb82861d11143c97df5df218f491bc73f3d1d7；blob f381411ac0a43b7e6864758da77846284a013733）、docs/superpowers/plans/2026-09-09-recruiter-list-summary-frontend.md（版本 revision 17a1ded2c8d6809faa8e9a9f388dfd6d14fe8ee9；blob 41be4807368325c403a2cecd665d01149d06f352）的 Global Constraints 与 Task index、/Users/visionclaw/coding-harness/skills/development-workflow/assets/execution-contract.md。不要一次读取其它 Task 正文。

固定身份：repository /Users/visionclaw/.paseo/worktrees/09eyc7i7/resolute-flamingo；target origin/main（remote target refs/heads/main）；实施范围 招聘端推荐和在谈 open 列表的 candidate_summary 接线与卡面补齐，三个 Task 顺序执行，作为一个独立交付；不改候选侧、详情/历史/已筛版式、Mock 数据、个人亮点确认或后端。
复用当前宿主工作区：不创建、移动或删除第二个用户工作区，不自动 stash/reset/clean 任何已有内容。
并行预告：开工前用 python3 /Users/visionclaw/coding-harness/skills/development-workflow/scripts/task_intents.py start 登记本任务；扩大范围、恢复与收尾时按合同更新。

实施方式：使用当前可用的 Superpowers executing plans 能力按 Plan 连续执行；同一执行者完成实现、实施 peer review、final gate 与收尾。
异构 reviewer：使用以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准 Spec/Plan 精确版本与共用守约规则；reviewer 默认不跑测试。
测试与收尾责任：确认前只做 Plan 的必要定向反馈，不提前跑 Plan 列出的最终 broad gate；真实边界风险及时定向验证。final gate 方案展示后等待用户明确确认，获批后按 /Users/visionclaw/coding-harness/skills/development-workflow/references/final-integration.md 同步 target、重算完整责任，复用有效 PASS 并增量补测 Plan 的权威命令；本任务后端正式 development L3 为 none，真实 backend+local 两张卡展示验收为 required；merge 和修复后均只补证据缺口，汇总最终权威 PASS 后普通 fast-forward push，不得 force push。
输出位置：docs/superpowers/handoffs/2026-09-09-recruiter-list-summary-frontend-execution.md；真实浏览器证据放 dogfood-output/<run-id>/（run-id 在运行时生成，不含凭据）。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 和 Plan 当前 Task brief；不要从本提示词补充产品设计。

版本与边界核对：用 git cat-file/git hash-object 核对上述 Spec/Plan blob。若工作树文档内容与冻结版本不一致，先说明差异，不把新内容自动当作批准契约。当前原始前端基线为 28a9c812fbba9c291e3f1b8f8ab506ae6233df7d；最终验证使用获批后实际 final_target_base。
异构 review skill 的本机入口：/Users/visionclaw/coding-harness/skills/codex-review-loop/SKILL.md；每轮须读取并传入 /Users/visionclaw/coding-harness/skills/_shared/review-contract.md。已完成的文档 review 不能替代实施代码 review。
仓库验证适配：本前端无 tools/test affected，不运行后端的该命令；必要定向命令和最终 npm 验收以 Plan 为准。真实环境缺账号、支持 include 的健康栈或匹配数据时明确记录未完成责任，不用 Mock 代替，不自动部署后端。
用户本次批准的是规划与执行交付，尚未批准 final gate：实施和定向 review 完成后展示具体方案再等待确认；target race 按 final-integration reference 更新方案并重新确认，不无限追赶。operative contract 绝对路径为 /Users/visionclaw/coding-harness/skills/development-workflow/assets/final-integration-contract.md。
文档审查记录：docs/superpowers/handoffs/2026-09-09-recruiter-list-summary-frontend-planning-review.md。
