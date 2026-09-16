# Dogfood 六项前端修复：新实施会话执行提示词

文档 review：Claude Opus/high 两轮，第二轮 NO FINDINGS。只选择与你启动的新会话宿主相符的一节执行。两节引用同一批准 Spec 和最终 Plan；本分支 L3 none。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的 Plan。target main（远端 origin/main）；宿主工作区固定为当前仓库根 `.`，复用用户选择的工作区，不创建第二个用户工作区，不自动 stash/reset/clean 任何既有内容。仓库文件使用仓库相对路径，不写规划机器绝对目录、home 路径或 file URI。

Task count: 6
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

批准 Spec：docs/superpowers/specs/2026-09-16-dogfood-frontend-fixes-design.md（revision 4e3d42de1a1baa64c623619ecf10a6f1756d0500，blob 44748c767b67e8ca2aeaf0f93567d0efaea321e5）。
执行 Plan：docs/superpowers/plans/2026-09-16-dogfood-frontend-fixes.md（revision 00c1c8da4bb7d193604004504c10746e6f5e0cc2，blob 523686e1991ac1fe657079e970032decdf066988）。

开工顺序：读取 CLAUDE.md、AGENTS.md、docs/testing/README.md；核对上述 Git revision:path 的 blob 及当前工作树对应文件，先读完整 Spec，再读 Plan 的 Global Constraints、Task index、三角色表、测试选择与当前 Task 完整 brief，不一次读取其它 Task 正文。Spec 原行为批准 revision 54d72d4ea2cf9f2a3e2e6383359c068b6a733464；批准记录版只改批准元数据。Plan 第二轮受审 revision 2996c9c37f634958b4989dd9f4bf7f1aaa041202、blob 0203cb666126656a000c2832a341270d7c1c6713 返回 NO FINDINGS；最终版本只追加审查结果。Git 对象或文档缺失时报告，不用未批准的最新文件替代。

外部 skill 按逻辑名发现，允许 superpowers 命名空间别名；资源按实际 skill 根目录解析，路径不写回交付。完整读取 development-workflow skill 根目录的 assets/execution-contract.md。review 共用守约规则在对应 review skill 根目录相对的 ../_shared/review-contract.md。开工用 python3 调用 development-workflow 的 scripts/task_intents.py start（参数按该 CLI 的 --help、Plan 精确路径清单和 target 提供），核对本机并行改动预告；扩大路径前 update，完成后更新本人记录。不创建 manifest、常驻集成角色或额外用户工作区。

本宿主实际调用 superpowers:subagent-driven-development；6 个 Task 大于 3，按 Task 顺序委派独立实施者、spec reviewer、code-quality reviewer，不并行改共享文件。按 Plan 三角色表使用 Claude Code 条件 alias，无法满足时报告，不静默降低档位。

范围和最小实现：DF-005 → DF-002 → DF-014 → DF-015 → DF-004 → DF-011。Task 1 在 optional 头像解码修复后包含 DF-016 画像同源、DF-008 双端 open→ended 跨生产轮询的浏览器 fixture 回归。只在既有 decoder、编辑目标、缓存水合和正文组件中局部修改；不新增接口、依赖、框架或无当前消费者的抽象。DF-011 内联在两端独立详情的匹配区，不做浮窗、不改列表、不修改 Case 匹配；招聘原亮点 producer 保持重复项和旧输出，只在详情入口映射原始原因。个人优势来源只初始化一次，恢复按钮不额外更新来源。各 Task 精确签名、反例、文件范围、命令和停止条件以 Plan 为准，不从聊天推断新设计。

本分支 L3 responsibility: none，用户明确覆盖默认 workflow。确认前和确认后都不跑 L3，不连接真实账号、后端服务或 Agent，不把 fixture PASS 冒充真实后端通过。Browser 回归运行真实产品 Backend 页面，接口使用仓库已有离线 fixture。

实施采用 TDD 和定向反馈，保留既有消费者测试，按实际 diff 与依赖选最小完整覆盖；无证据不增加测试平台或全层重复运行。每 Task 提交后持续推进下一项；遵守执行 skill 必需的宿主内 Task/global review，不在实施过程中调用异构 review。异构 reviewer：Codex，通过以该身份为 reviewer 的多轮只读 review-loop（本宿主对应 claude-review-loop 或 Codex 等价 skill），不得拿宿主内 review 替代。reviewer 默认不跑任何测试，冻结批准版本、候选 SHA 和范围。

全部 Task 与执行 skill 要求的宿主内全局 review 完成后，退出 Task 循环，按 Plan 的“实施后收尾（不计入 Task count）”在同一 session 执行：异构 review skill → 最小 affected（适用 L0–L2）→ 人工 final gate。异构 review 的轮次/裁决/停止交给该 skill，轮间只跑修复相关轻量验证；收尾修复不重开 Task/global review 或异构 review。覆盖默认 finishing-a-development-branch，不追加合入菜单、整套测试或工作区清理。清单用既有 test:list 生成器更新，不能手抄。

final gate 确认前：完成所有 applicable L0–L2，保留原始 receipt，明确候选、pre-gate target SHA、已验证与未覆盖项、证据复用/增量范围、同步合入动作。可只读 fetch，不 merge target、不 push。未完成不称 ready；展示具体方案并等待用户明确批准 final gate，规划批准和启动本提示词不替代该次确认。

确认后：完整读取 development-workflow skill 根目录的 references/final-integration.md 与 assets/final-integration-contract.md；同步 target、记录 final_target_base、按最终 diff 重算责任，证据仍有效则零重跑复用，只补失效/新增缺口。L3 none 始终覆盖其中默认正式 L3 条款。cleanup 后对账，核对 target 未推进后普通 fast-forward push，不得 force push。批准范围内最小修复自主恢复，不再次异构 review；target 推进或 push 竞态拒绝时停止自动追赶，保留证据并更新具体 final gate 方案重新确认。实际 push 成功后才能声称合入完成。

输出位置：代码和测试按 Plan 精确文件清单；测试清单 docs/testing/cases.md；review 裁决与简短验证记录就地记在执行 Plan，原始 runner 证据留在既有 ignored 输出位置。不创建额外 handoff/review report/validation summary 文档，不提交真实简历、HAR 或个人信息。运行记录追加导致 Plan 文件变化时，保留批准/受审 Git 对象引用，产品行为实质变化必须重新审阅，不能改 Spec 自证合规。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格按 execution contract 和当前 Task brief 执行最小实现，不扩大架构或顺便重构。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的 Plan。target main（远端 origin/main）；宿主工作区固定为当前仓库根 `.`，复用用户选择的工作区，不创建第二个用户工作区，不自动 stash/reset/clean 任何既有内容。仓库文件使用仓库相对路径，不写规划机器绝对目录、home 路径或 file URI。

Task count: 6
Execution skill: superpowers:executing-plans
Model aliases: host-native

批准 Spec：docs/superpowers/specs/2026-09-16-dogfood-frontend-fixes-design.md（revision 4e3d42de1a1baa64c623619ecf10a6f1756d0500，blob 44748c767b67e8ca2aeaf0f93567d0efaea321e5）。
执行 Plan：docs/superpowers/plans/2026-09-16-dogfood-frontend-fixes.md（revision 00c1c8da4bb7d193604004504c10746e6f5e0cc2，blob 523686e1991ac1fe657079e970032decdf066988）。

开工顺序：读取 CLAUDE.md、AGENTS.md、docs/testing/README.md；核对上述 Git revision:path 的 blob 及当前工作树对应文件，先读完整 Spec，再读 Plan 的 Global Constraints、Task index、三角色表、测试选择与当前 Task 完整 brief，不一次读取其它 Task 正文。Spec 原行为批准 revision 54d72d4ea2cf9f2a3e2e6383359c068b6a733464；批准记录版只改批准元数据。Plan 第二轮受审 revision 2996c9c37f634958b4989dd9f4bf7f1aaa041202、blob 0203cb666126656a000c2832a341270d7c1c6713 返回 NO FINDINGS；最终版本只追加审查结果。Git 对象或文档缺失时报告，不用未批准的最新文件替代。

外部 skill 按逻辑名发现，允许 superpowers 命名空间别名；资源按实际 skill 根目录解析，路径不写回交付。完整读取 development-workflow skill 根目录的 assets/execution-contract.md。review 共用守约规则在对应 review skill 根目录相对的 ../_shared/review-contract.md。开工用 python3 调用 development-workflow 的 scripts/task_intents.py start（参数按该 CLI 的 --help、Plan 精确路径清单和 target 提供），核对本机并行改动预告；扩大路径前 update，完成后更新本人记录。不创建 manifest、常驻集成角色或额外用户工作区。

本宿主固定实际调用 superpowers:executing-plans，按 Plan 顺序执行全部 Task，不因 Task 数改用 subagent 模式。按通用模型档位和当前宿主配置执行；不解析、查找或校验 Claude Code alias，不因缺少其 alias 阻塞。

范围和最小实现：DF-005 → DF-002 → DF-014 → DF-015 → DF-004 → DF-011。Task 1 在 optional 头像解码修复后包含 DF-016 画像同源、DF-008 双端 open→ended 跨生产轮询的浏览器 fixture 回归。只在既有 decoder、编辑目标、缓存水合和正文组件中局部修改；不新增接口、依赖、框架或无当前消费者的抽象。DF-011 内联在两端独立详情的匹配区，不做浮窗、不改列表、不修改 Case 匹配；招聘原亮点 producer 保持重复项和旧输出，只在详情入口映射原始原因。个人优势来源只初始化一次，恢复按钮不额外更新来源。各 Task 精确签名、反例、文件范围、命令和停止条件以 Plan 为准，不从聊天推断新设计。

本分支 L3 responsibility: none，用户明确覆盖默认 workflow。确认前和确认后都不跑 L3，不连接真实账号、后端服务或 Agent，不把 fixture PASS 冒充真实后端通过。Browser 回归运行真实产品 Backend 页面，接口使用仓库已有离线 fixture。

实施采用 TDD 和定向反馈，保留既有消费者测试，按实际 diff 与依赖选最小完整覆盖；无证据不增加测试平台或全层重复运行。每 Task 提交后持续推进下一项；遵守执行 skill 必需的宿主内 Task/global review，不在实施过程中调用异构 review。异构 reviewer：Claude，通过以该身份为 reviewer 的多轮只读 review-loop（本宿主对应 claude-review-loop 或 Codex 等价 skill），不得拿宿主内 review 替代。reviewer 默认不跑任何测试，冻结批准版本、候选 SHA 和范围。

全部 Task 与执行 skill 要求的宿主内全局 review 完成后，退出 Task 循环，按 Plan 的“实施后收尾（不计入 Task count）”在同一 session 执行：异构 review skill → 最小 affected（适用 L0–L2）→ 人工 final gate。异构 review 的轮次/裁决/停止交给该 skill，轮间只跑修复相关轻量验证；收尾修复不重开 Task/global review 或异构 review。覆盖默认 finishing-a-development-branch，不追加合入菜单、整套测试或工作区清理。清单用既有 test:list 生成器更新，不能手抄。

final gate 确认前：完成所有 applicable L0–L2，保留原始 receipt，明确候选、pre-gate target SHA、已验证与未覆盖项、证据复用/增量范围、同步合入动作。可只读 fetch，不 merge target、不 push。未完成不称 ready；展示具体方案并等待用户明确批准 final gate，规划批准和启动本提示词不替代该次确认。

确认后：完整读取 development-workflow skill 根目录的 references/final-integration.md 与 assets/final-integration-contract.md；同步 target、记录 final_target_base、按最终 diff 重算责任，证据仍有效则零重跑复用，只补失效/新增缺口。L3 none 始终覆盖其中默认正式 L3 条款。cleanup 后对账，核对 target 未推进后普通 fast-forward push，不得 force push。批准范围内最小修复自主恢复，不再次异构 review；target 推进或 push 竞态拒绝时停止自动追赶，保留证据并更新具体 final gate 方案重新确认。实际 push 成功后才能声称合入完成。

输出位置：代码和测试按 Plan 精确文件清单；测试清单 docs/testing/cases.md；review 裁决与简短验证记录就地记在执行 Plan，原始 runner 证据留在既有 ignored 输出位置。不创建额外 handoff/review report/validation summary 文档，不提交真实简历、HAR 或个人信息。运行记录追加导致 Plan 文件变化时，保留批准/受审 Git 对象引用，产品行为实质变化必须重新审阅，不能改 Spec 自证合规。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格按 execution contract 和当前 Task brief 执行最小实现，不扩大架构或顺便重构。
```
