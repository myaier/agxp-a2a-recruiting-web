# 登录区号与 STG 基础试点执行提示词

选择一个宿主章节交给新实施 session。只执行该宿主正文；不在规划 session 自动开始实施。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main（拟合入目标，在具体 final gate 中核对并确认；此前不合入、不 push）；实施范围 默认 +86 的可编辑登录区号、旧前端 E2E 回归、新区号 fixture 验证与现有 dogfood 的 STG 基础双轮流程；不改后端、不扩展 P8 换绑、不迁移附件或 Hosted；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 3
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-12-editable-login-dial-code-stg-pilot-design.md（revision ed25e2329ab8ab9d38ffc6001b58baba559f874c，blob 18300b23ee1faddd80da6c3faacc3f6f18c2a106）、执行 Plan：docs/superpowers/plans/2026-09-12-editable-login-dial-code-stg-pilot.md（版本 bb8dbae6521c45d24ee3e8767913517eb79e4613，blob aba9d1de8b83ab48fb844ade6fa8b1c31fd7d4ce）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根目录相对的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前从 development-workflow skill 根目录解析 scripts/task_intents.py，读取 --help 后用 python3 执行 start，填写本 Plan 的任务、target、精确路径及接口预告。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录相对的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：实现落本 Plan 精确文件清单；执行裁决与验收摘要就地写 Plan；原始证据沿用 test-results/、ui-regression-output/、dogfood-output/，长期脱敏运行记录按 docs/runs/ 既有约定；不另建规划 handoff/review 文件。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

本任务专属约束：
1. Spec 当前文件仅增加批准元信息，行为核对上述 ed25e232 快照。文档 review 为 Claude Opus/high 一轮：2 required、1 optional 全部经主控核实修订，无未解决有效 required；原审查候选 470fd44c，裁决修订 18c466c8。文档 review 不替代实施后的代码 review。
2. 前端没有 tools/test affected；按 Plan U/B/V 显式映射完成适用 L0–L2 和前端 fixture 浏览器责任，按实际完整 diff 校准消费者。旧默认脚本不得加“先选 +86”或改号码绕过默认测试。--list 只确认选择，不是 E2E PASS；视觉 report 模式退出 0 不代表没有差异。
3. 开始手机登录的第二参数可选，省略继续 +86；新增共享登录代际为可选声明但创建会话操作入口必须检查，不使用 fallback 掩盖生产漏接。P8 换绑合同不改。实际换号清旧码/尝试，保留未到期重发等待。
4. 正式 STG 是 Plan S 的 required 验收，按 Task 3 新指南执行两轮：一次性账号 UI 登录、基础 CRUD/刷新/双会话与各轮 CLEANED。后端 checkout 和安全材料通道由调用者提供，缺失时先完成不依赖它的实现与回归，仅询问缺项。按后端 checkout 解析已有环境 skill，不硬编码本机路径，不自动 clone 或部署。
5. STG 前端必须 backend/stg，默认 localhost:5173，独占且端口严格匹配，不能套用旧 local 启动段。只复用既有代理，Cookie/Origin 问题需证据；不注入会话绕过 UI 登录，不放宽后端认证。
6. 不执行附件、发现写入/委托、规则、Hosted、MatchCase、首次 onboarding、导出或反馈等清理未覆盖动作。观察自动副作用；失败同 run 收尾，不改数据库、不抢占他人 run，不把清理失败计作 PASS。认证材料不进聊天、报告、日志或录屏。
7. 正式 STG mutation、target 同步和 push 等待实施 session 的具体 final gate 批准。规划交付不授权跳过该确认。缺 STG 证据时分别报告已通过的代码回归，不能宣称两轮试点成功或整个目标完成。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main（拟合入目标，在具体 final gate 中核对并确认；此前不合入、不 push）；实施范围 默认 +86 的可编辑登录区号、旧前端 E2E 回归、新区号 fixture 验证与现有 dogfood 的 STG 基础双轮流程；不改后端、不扩展 P8 换绑、不迁移附件或 Hosted；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 3
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-12-editable-login-dial-code-stg-pilot-design.md（revision ed25e2329ab8ab9d38ffc6001b58baba559f874c，blob 18300b23ee1faddd80da6c3faacc3f6f18c2a106）、执行 Plan：docs/superpowers/plans/2026-09-12-editable-login-dial-code-stg-pilot.md（版本 bb8dbae6521c45d24ee3e8767913517eb79e4613，blob aba9d1de8b83ab48fb844ade6fa8b1c31fd7d4ce）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow skill 根目录相对的 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前从 development-workflow skill 根目录解析 scripts/task_intents.py，读取 --help 后用 python3 执行 start，填写本 Plan 的任务、target、精确路径及接口预告。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow skill 根目录相对的 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：实现落本 Plan 精确文件清单；执行裁决与验收摘要就地写 Plan；原始证据沿用 test-results/、ui-regression-output/、dogfood-output/，长期脱敏运行记录按 docs/runs/ 既有约定；不另建规划 handoff/review 文件。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

本任务专属约束：
1. Spec 当前文件仅增加批准元信息，行为核对上述 ed25e232 快照。文档 review 为 Claude Opus/high 一轮：2 required、1 optional 全部经主控核实修订，无未解决有效 required；原审查候选 470fd44c，裁决修订 18c466c8。文档 review 不替代实施后的代码 review。
2. 前端没有 tools/test affected；按 Plan U/B/V 显式映射完成适用 L0–L2 和前端 fixture 浏览器责任，按实际完整 diff 校准消费者。旧默认脚本不得加“先选 +86”或改号码绕过默认测试。--list 只确认选择，不是 E2E PASS；视觉 report 模式退出 0 不代表没有差异。
3. 开始手机登录的第二参数可选，省略继续 +86；新增共享登录代际为可选声明但创建会话操作入口必须检查，不使用 fallback 掩盖生产漏接。P8 换绑合同不改。实际换号清旧码/尝试，保留未到期重发等待。
4. 正式 STG 是 Plan S 的 required 验收，按 Task 3 新指南执行两轮：一次性账号 UI 登录、基础 CRUD/刷新/双会话与各轮 CLEANED。后端 checkout 和安全材料通道由调用者提供，缺失时先完成不依赖它的实现与回归，仅询问缺项。按后端 checkout 解析已有环境 skill，不硬编码本机路径，不自动 clone 或部署。
5. STG 前端必须 backend/stg，默认 localhost:5173，独占且端口严格匹配，不能套用旧 local 启动段。只复用既有代理，Cookie/Origin 问题需证据；不注入会话绕过 UI 登录，不放宽后端认证。
6. 不执行附件、发现写入/委托、规则、Hosted、MatchCase、首次 onboarding、导出或反馈等清理未覆盖动作。观察自动副作用；失败同 run 收尾，不改数据库、不抢占他人 run，不把清理失败计作 PASS。认证材料不进聊天、报告、日志或录屏。
7. 正式 STG mutation、target 同步和 push 等待实施 session 的具体 final gate 批准。规划交付不授权跳过该确认。缺 STG 证据时分别报告已通过的代码回归，不能宣称两轮试点成功或整个目标完成。
```
