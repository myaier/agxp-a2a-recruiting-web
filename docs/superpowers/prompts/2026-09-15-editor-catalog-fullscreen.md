# 第一批目录选择全屏化：新会话执行提示词

选择当前宿主对应章节；每个代码框均可独立复制执行。工作区为当前仓库根 `.`。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 `.` 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 五个编辑字段（岗位类别、简历教育学校/专业、简历经历行业、公司档案行业）全屏化；onboarding 学校/专业重复点选修复；22 个热门城市规范名及有限别名兼容；期望职位页 Backend 复用现有 Mock 布局并分离展示与数据/状态。做最小实现、遵循当前项目样式，不改公司对象选择、数值日期选择、后端 API/schema，不新增通用目录框架；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 8
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-15-editor-catalog-fullscreen-design.md（revision 711ebfbddf34c5c646aeef2dda79a782addf45d2，blob 5bae22b7414f0df573bfffa2e25860c3bcec2326）、执行 Plan：docs/superpowers/plans/2026-09-15-editor-catalog-fullscreen.md（版本 v1.1，revision 2d3dbd92c1b4fd9b26facb77e69af9b5435a5f0c，blob 4f3f6ffa2fd085eb12102074c8f95a89cd01dc48）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前用 解析 development-workflow 的 scripts/task_intents.py 后，以 python3 调用其 start 子命令登记（先读 --help 与现有 intent）。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 的 references/final-integration.md 及 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：产品与测试文件按 Plan 精确路径修改；review 裁决就地记录于现有 Plan，原始测试产物沿 runner 既有位置保留，task intent 沿 skill 默认存储，不新增 handoff、review report 或 validation summary 文档。当前 Plan 已经 1 轮 Claude 文档审查并完成 3 项裁决修正，无未解决有效 required；它不代替实施后的产品代码 review。读取冻结 Plan 后允许追加执行记录，不能悄悄替换其批准实现合同。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

先完整读取 CLAUDE.md、AGENTS.md。校验固定 Git 对象与路径存在；当前 Spec 只允许批准记录与冻结正文有差异。外部 skill 名允许本机前缀差异，以能力与提供者匹配；缺必需 skill/合同则明确阻塞，不猜安装路径。实施 Task 按依赖连续推进，常规可逆修改无需另问许可；只有实施后的具体 final gate 才等待用户明确确认。

正式 L3 与真实服务验证按 Plan 的 conditional/none 责任判定，不运行整套后端测试、不猜账号、不把 fixture 冒称真实服务验收。移动软键盘未实测须如实记录。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 `.` 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 五个编辑字段（岗位类别、简历教育学校/专业、简历经历行业、公司档案行业）全屏化；onboarding 学校/专业重复点选修复；22 个热门城市规范名及有限别名兼容；期望职位页 Backend 复用现有 Mock 布局并分离展示与数据/状态。做最小实现、遵循当前项目样式，不改公司对象选择、数值日期选择、后端 API/schema，不新增通用目录框架；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 8
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-15-editor-catalog-fullscreen-design.md（revision 711ebfbddf34c5c646aeef2dda79a782addf45d2，blob 5bae22b7414f0df573bfffa2e25860c3bcec2326）、执行 Plan：docs/superpowers/plans/2026-09-15-editor-catalog-fullscreen.md（版本 v1.1，revision 2d3dbd92c1b4fd9b26facb77e69af9b5435a5f0c，blob 4f3f6ffa2fd085eb12102074c8f95a89cd01dc48）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前用 解析 development-workflow 的 scripts/task_intents.py 后，以 python3 调用其 start 子命令登记（先读 --help 与现有 intent）。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 的 references/final-integration.md 及 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：产品与测试文件按 Plan 精确路径修改；review 裁决就地记录于现有 Plan，原始测试产物沿 runner 既有位置保留，task intent 沿 skill 默认存储，不新增 handoff、review report 或 validation summary 文档。当前 Plan 已经 1 轮 Claude 文档审查并完成 3 项裁决修正，无未解决有效 required；它不代替实施后的产品代码 review。读取冻结 Plan 后允许追加执行记录，不能悄悄替换其批准实现合同。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

先完整读取 CLAUDE.md、AGENTS.md。校验固定 Git 对象与路径存在；当前 Spec 只允许批准记录与冻结正文有差异。外部 skill 名允许本机前缀差异，以能力与提供者匹配；缺必需 skill/合同则明确阻塞，不猜安装路径。实施 Task 按依赖连续推进，常规可逆修改无需另问许可；只有实施后的具体 final gate 才等待用户明确确认。

正式 L3 与真实服务验证按 Plan 的 conditional/none 责任判定，不运行整套后端测试、不猜账号、不把 fixture 冒称真实服务验收。移动软键盘未实测须如实记录。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。
```
