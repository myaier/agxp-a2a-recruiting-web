# P1 职位详情与消息列表统一：新实施会话执行提示词

两个宿主二选一，复制对应章节的完整正文。

## Claude Code

```text
Task count: 6
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

实施宿主 Claude Code：必须实际调用 superpowers:subagent-driven-development（Task count > 3）。每 Task 的 implementer/spec reviewer/code-quality reviewer 档位按 Plan 角色表，仅 Claude Code 解析 sonnet 与 fable/opus 条件 alias（后者为可用备选，不是字面模型名）；无法满足则报告，不静默降档或退回主 Agent 独做。依赖串行；同一主控负责全局与 final gate，不委派人工确认。最终异构 reviewer 为 Codex，按以 Codex 为 reviewer 的只读多轮 review-loop 执行，与 Task 两阶段 review 不相互替代，复用已裁决 findings。

你在全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准且完成文档 review 的 Plan。target main，同步引用 origin/main；工作区固定为用户选择的当前仓库根 .，复用不新建，不创建第二个用户工作区，不自动 stash/reset/clean。路径全部使用仓库相对路径。

批准 Spec：docs/superpowers/specs/2026-09-10-p1-job-detail-inbox-unification-design.md（revision 33824d073a6191093d517b12b89717fbeac48993，blob 986011168fe338040799135a21f4b1b0fe1638c0）。
执行 Plan：docs/superpowers/plans/2026-09-10-p1-job-detail-inbox-unification.md（revision af1954f86db8a3d87108b457595394ad87b66f45，blob 4b4e6201c09137d0244a71d01fdacd2c5fd57658）。

读取当前 CLAUDE.md、AGENTS.md，核对批准 Git 对象和 Plan 版本；先读 Global Constraints、Task index、角色表、冻结展示接口与当前 Task 完整正文，按依赖推进，不自行重新设计。Spec 工作树后续状态记录不替代批准正文。外部 skill 用逻辑名发现，resources/scripts/assets/references 按该 skill 根目录相对路径解析，不将本机安装目录写回交付。完整读取 development-workflow 的 assets/execution-contract.md，final gate 前读取 references/final-integration.md 和 assets/final-integration-contract.md。缺少必要技能或合同则报告具体缺失，不猜路径。

实施范围：独立职位详情正常正文、外壳与操作展示；求职/招聘消息列表与会话行；对应映射、组件测试及独立浏览器用例。不修改双端在谈详情、匿名简历、真人会话、阶段对话流或其共享组件，不编辑并行中的公共 E2E 文件。完整 Mockup 外观是基准，共享 CSS 原值优先保留，只有确认无消费者的旧样式才删除；不得以改基线/阈值接受漂移。兼容职位正文嵌入入口、Backend 真实行为、Mock 未读/S3 门控均按 Plan 保持。

开工前用 development-workflow 的 scripts/task_intents.py start --summary 'P1 职位详情与消息列表展示统一' --target main 按 Plan 文件范围逐项 --path 登记；读取其他活跃/暂停预告和实际 diff，扩范围前 update。task intent 不授权修改他人工作区。Task 1 在产品修改前采集 Mock 基准，证据必须有 source commit；之后全部 Task 连续按依赖执行，最后恰好一个 final gate。HTTP fixture 和隔离文字布局样本各自只证明其声明的边界。

用户明确覆盖：计划及实施、final gate、合入收尾均不包含 L3 真实栈测试。L3 责任 none，记录 N/A（用户显式排除），不运行真实账号 dogfood，不启动真实后端，不把真实栈缺环境变成待补门禁，不在确认后恢复默认 L3。该覆盖优先于上述技能默认合同内的 L3 selection/runner/cleanup 步骤；不得声称真实集成 PASS。适用 L0–L2 和 HTTP fixture/视觉检查仍完整承担。

测试与收尾责任：确认前完成并修复 Plan 适用完整 L0–L2（使用当前仓库正式 npm/Playwright/视觉入口，不发明 affected 命令），冻结候选做异构实施 review；reviewer 只读、默认不跑任何测试，每轮读取对应 review-loop skill 根相对 ../_shared/review-contract.md，绑定批准 Spec/Plan 和固定候选。逐条裁决 required/optional，最多 3 轮；修复后只补失效证据。确认前只读 fetch、不合 target、不 push。展示 candidate commit、pre_gate_target_base、完整责任与证据及具体 merge/push 方案，等待用户明确 final gate 确认；规划批准与启动本 session 不能代替该确认。

确认后按 final-integration 合同并应用本任务 L3 覆盖：fetch 记录 final_target_base → 按批准方案 merge origin/main → 重算最终完整 L0–L2 责任，复用有效 PASS、只补缺口 → 对实际 cleanup/修复影响再次对账 → 再 fetch 核对 target 未推进 → 普通 fast-forward git push origin HEAD:main。不得 force push，不 rebase 已 review 提交；target race 需更新 gate，不自动无限追赶。范围内确定性失败自主修复并补受影响 review/证据，超批准产品/接口范围或必要 L0–L2 外部资源无法获得时报告具体阻塞。L3 环境未准备好不构成本任务阻塞。

输出位置：产品与测试文件按 Plan；实施结果、review 裁决与最终 merge facts 追加到 docs/superpowers/plans/2026-09-10-p1-job-detail-inbox-unification.md 的实施证据记录；日志/截图使用 test-results/ 与 ui-regression-output/p1/ 等既有忽略目录。不得另建 handoff、review report、manifest，不自动启动第二实施 session。push 成功后才报告合入，更新 task intent completed。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。
```

## Codex

```text
Task count: 6
Execution skill: superpowers:executing-plans
Model aliases: host-native

实施宿主 Codex：必须实际调用 superpowers:executing-plans，按依赖在当前 session 推进全部 Task，不因 Task count 改用 subagent 模式。角色表按通用档位与当前宿主配置执行，不解析、查找或校验 Claude Code alias，不因缺少它们报错。最终异构 reviewer 为 Claude，使用 claude-review-loop 对冻结实现候选做只读多轮代码 review；reviewer 默认不运行测试。

你在全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准且完成文档 review 的 Plan。target main，同步引用 origin/main；工作区固定为用户选择的当前仓库根 .，复用不新建，不创建第二个用户工作区，不自动 stash/reset/clean。路径全部使用仓库相对路径。

批准 Spec：docs/superpowers/specs/2026-09-10-p1-job-detail-inbox-unification-design.md（revision 33824d073a6191093d517b12b89717fbeac48993，blob 986011168fe338040799135a21f4b1b0fe1638c0）。
执行 Plan：docs/superpowers/plans/2026-09-10-p1-job-detail-inbox-unification.md（revision af1954f86db8a3d87108b457595394ad87b66f45，blob 4b4e6201c09137d0244a71d01fdacd2c5fd57658）。

读取当前 CLAUDE.md、AGENTS.md，核对批准 Git 对象和 Plan 版本；先读 Global Constraints、Task index、角色表、冻结展示接口与当前 Task 完整正文，按依赖推进，不自行重新设计。Spec 工作树后续状态记录不替代批准正文。外部 skill 用逻辑名发现，resources/scripts/assets/references 按该 skill 根目录相对路径解析，不将本机安装目录写回交付。完整读取 development-workflow 的 assets/execution-contract.md，final gate 前读取 references/final-integration.md 和 assets/final-integration-contract.md。缺少必要技能或合同则报告具体缺失，不猜路径。

实施范围：独立职位详情正常正文、外壳与操作展示；求职/招聘消息列表与会话行；对应映射、组件测试及独立浏览器用例。不修改双端在谈详情、匿名简历、真人会话、阶段对话流或其共享组件，不编辑并行中的公共 E2E 文件。完整 Mockup 外观是基准，共享 CSS 原值优先保留，只有确认无消费者的旧样式才删除；不得以改基线/阈值接受漂移。兼容职位正文嵌入入口、Backend 真实行为、Mock 未读/S3 门控均按 Plan 保持。

开工前用 development-workflow 的 scripts/task_intents.py start --summary 'P1 职位详情与消息列表展示统一' --target main 按 Plan 文件范围逐项 --path 登记；读取其他活跃/暂停预告和实际 diff，扩范围前 update。task intent 不授权修改他人工作区。Task 1 在产品修改前采集 Mock 基准，证据必须有 source commit；之后全部 Task 连续按依赖执行，最后恰好一个 final gate。HTTP fixture 和隔离文字布局样本各自只证明其声明的边界。

用户明确覆盖：计划及实施、final gate、合入收尾均不包含 L3 真实栈测试。L3 责任 none，记录 N/A（用户显式排除），不运行真实账号 dogfood，不启动真实后端，不把真实栈缺环境变成待补门禁，不在确认后恢复默认 L3。该覆盖优先于上述技能默认合同内的 L3 selection/runner/cleanup 步骤；不得声称真实集成 PASS。适用 L0–L2 和 HTTP fixture/视觉检查仍完整承担。

测试与收尾责任：确认前完成并修复 Plan 适用完整 L0–L2（使用当前仓库正式 npm/Playwright/视觉入口，不发明 affected 命令），冻结候选做异构实施 review；reviewer 只读、默认不跑任何测试，每轮读取对应 review-loop skill 根相对 ../_shared/review-contract.md，绑定批准 Spec/Plan 和固定候选。逐条裁决 required/optional，最多 3 轮；修复后只补失效证据。确认前只读 fetch、不合 target、不 push。展示 candidate commit、pre_gate_target_base、完整责任与证据及具体 merge/push 方案，等待用户明确 final gate 确认；规划批准与启动本 session 不能代替该确认。

确认后按 final-integration 合同并应用本任务 L3 覆盖：fetch 记录 final_target_base → 按批准方案 merge origin/main → 重算最终完整 L0–L2 责任，复用有效 PASS、只补缺口 → 对实际 cleanup/修复影响再次对账 → 再 fetch 核对 target 未推进 → 普通 fast-forward git push origin HEAD:main。不得 force push，不 rebase 已 review 提交；target race 需更新 gate，不自动无限追赶。范围内确定性失败自主修复并补受影响 review/证据，超批准产品/接口范围或必要 L0–L2 外部资源无法获得时报告具体阻塞。L3 环境未准备好不构成本任务阻塞。

输出位置：产品与测试文件按 Plan；实施结果、review 裁决与最终 merge facts 追加到 docs/superpowers/plans/2026-09-10-p1-job-detail-inbox-unification.md 的实施证据记录；日志/截图使用 test-results/ 与 ui-regression-output/p1/ 等既有忽略目录。不得另建 handoff、review report、manifest，不自动启动第二实施 session。push 成功后才报告合入，更新 task intent completed。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。
```
