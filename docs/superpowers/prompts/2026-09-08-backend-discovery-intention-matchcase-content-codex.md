你在用户选定的宿主任务工作区 /Users/visionclaw/.paseo/worktrees/09eyc7i7/ignorant-cheetah 中，执行一个已批准并完成文档 review 的独立交付 Plan。

按顺序读取 `CLAUDE.md`、`AGENTS.md`、docs/superpowers/specs/2026-09-08-backend-discovery-intention-matchcase-content-design.md（批准版本 e6f4af66c5453c952cea997e2435e55650749165；blob f5839c411825a05987ca5bc8835f057c6b8261f6）、docs/superpowers/plans/2026-09-08-backend-discovery-intention-matchcase-content.md（版本 7ca3f00dd9416703955563be1bd72f44fdb24dab；blob bdbf4508349f3ee23e24fbb480aad0ab8a8476e1）的 Global Constraints 与 Task index、/Users/visionclaw/coding-harness/skills/development-workflow/assets/execution-contract.md。不要一次读取其它 Task 正文。

固定身份：repository /Users/visionclaw/.paseo/worktrees/09eyc7i7/ignorant-cheetah；target origin/main（remote origin，push 目标 refs/heads/main）；实施范围 本 Plan Task 1–6：Backend 招聘文案、意向 ID 与会话恢复、Case PDF 与可见文本、委托成功交互和 P5 缓存失效、新岗位发布后安全选择；以及逐 Task 指定测试。
复用当前宿主工作区：不创建、移动或删除第二个用户工作区，不自动 stash/reset/clean 任何已有内容。
并行预告：开工前用 python3 /Users/visionclaw/coding-harness/skills/development-workflow/scripts/task_intents.py start --summary "Backend 在谈市场与委托内容修复" --target origin/main 登记本任务，并按 Plan 的精确文件清单补全 --path 参数；扩大范围、恢复与收尾时按合同更新。

实施方式：使用 Superpowers executing plans 能力（`$superpowers:executing-plans`）按 Plan 连续执行；同一执行者完成实现、实施 peer review、final gate 与收尾。
异构 reviewer：使用以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准 Spec/Plan 精确版本与共用守约规则；reviewer 默认不跑测试。
测试与收尾责任：按 Plan 测试段执行定向测试与唯一权威验收；真实边界风险及时定向验证。final gate 方案展示后等待用户明确确认，获批后按 /Users/visionclaw/coding-harness/skills/development-workflow/references/final-integration.md 同步 target、在最终候选上完成一次权威验证与必要 development L3，普通 fast-forward push，不得 force push。
输出位置：docs/handoffs/2026-09-08-backend-discovery-intention-matchcase-content-implementation.md（实施期间创建，记录证据、review 裁决、未完成联合验收与合入事实）。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 和 Plan 当前 Task brief；不要从本提示词补充产品设计。

本次用户覆盖项：只改 Backend 的内容与业务接线；不改 Mock、CSS／样式／布局、不新增产品组件。复用 Mock 已有成功状态形态，不重新设计。禁止运行任何浏览器 E2E、Playwright、agent-browser、UI 截图／视觉比较和真实栈浏览器旅程，不修改这些脚本／CI／基线。
最终非浏览器权威命令仅在 final gate 获准后执行：npm test；npm run typecheck；npm run lint；npm run build。此前按各 Task 定向验证。浏览器 L3 为 none；后端空 keywords 修复的部署版本尚未核实，双端真实栈标记待联合验收，不以 Mock 或接口测试 PASS 代替。
用户已明确批准上述 Spec revision；文档 review 为 Claude Opus/high 三轮，R1 两条 required 已修复，R2 NO FINDINGS，R3 对测试路径文字修正复核为 NO FINDINGS。记录见 docs/handoffs/2026-09-08-backend-discovery-intention-matchcase-content-planning-handoff.md。规划文档 review 不能代替实施代码 review。实施 reviewer 技能：/Users/visionclaw/coding-harness/skills/claude-review-loop/SKILL.md；共用守约规则：/Users/visionclaw/coding-harness/skills/_shared/review-contract.md。
开工先核对 Spec／Plan 的 git blob 与上述版本一致；有非本任务改动时保留并检查冲突，不自动覆盖。用 git show 指定 revision 的文档读取批准合同，不能把最新未批准 Spec 当作授权。当前计划分支是 fix/recruit-card-intention-alignment；规划记录的 main 为 968a51f40083b276d9c7cf0bf32f8f403212450f，正式 gate 必须重新观察并冻结实际 target。
这是新实施会话的执行交付，不回到规划、重新生成 Plan 或自动开第二会话。使用 executing-plans 连续执行；不自行委派产品实现。人工 final gate 确认前完成实现、定向验证、异构代码 review 和具体合入方案；确认后在批准范围内自主修复和补验证，只有产品契约／范围变化、target race 或无法取得的外部资源才停止。
