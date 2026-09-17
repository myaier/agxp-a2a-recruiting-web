# AI 助手与真人聊天展示增量执行提示词

选择实际宿主的一节，复制完整正文到新实施 session。两节引用同一份批准 Spec 与完成文档 review 的 Plan。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main（规划基线 30a0d3b24c2257da70c8b54fff4ee0ebb5ad71d0）；实施范围 批准 Spec §10–§12 的展示增量：共用气泡与安全 Markdown、AI 三类结果标题/卡内中文理由/时间、真人页身份及联系方式占位/全屏职位与 PDF 层/短气泡宽度；不改消息业务或后端协议；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 3
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-16-candidate-assistant-chat-design.md（revision 81e12c337596e063e089a6074c6bb2779e5dde60，blob 8eebfc2ec223dab7deaa1d8bbe5afc02675aeb98）、执行 Plan：docs/superpowers/plans/2026-09-16-chat-presentation-refinement.md（版本 dd05ba87943d21747c56f6d2094a84f0d0e17838，blob 7a85a366f17c8b20dca53e3ad03aa661fe4892d3）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow 的 skill 根目录相对 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前按当地发现的 development-workflow skill 根目录定位 scripts/task_intents.py，以 python3 执行其 start 登记；命令参数先读该 CLI 的帮助。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑任何真栈 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow 的 skill 根目录相对 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 本轮 L3 responsibility: none，跳过真栈与其资源清理 → 再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：产品改动按 Plan 精确路径；实施进度/review 裁决就地更新 Plan；原始本地测试日志和截图在 output/chat-presentation-evidence/，不提交预览或敏感原始证据，不新增交接文档。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

用户明确要求：本轮为样式/展示优化，不需要真栈 L3。该覆盖优先于执行合同中的通用 L3 条款；不部署、不准备 STG 账号/资源、不调用真实后端或模型作验收，不因缺少真栈而阻塞本轮，也不声称 L3 PASS。仅做 Plan 指定的必要本地静态、组件、离线浏览器及视觉验证，不能自动升级为全库测试。既有 API 只做批准的展示接线，不扩展业务能力。

已完成 Claude 文档 review 1 轮：1 项 required（时区验证）和 1 项 optional（移除操作栏无调用方分支）均接受并修订，裁决后无未解决有效 required；不误称 reviewer 返回 NO FINDINGS。Task 1–3 不需要重新 brainstorm 或重复规划；若发现范围外真实契约变化，只暂停对应扩展并明确缺口。卡片按钮/原内容不得重画，AI 两侧同轮时间取 created_at，真人按每条 createdAt；发布方企业与用人企业不可混淆；电话微信仅诚实缺失占位，无假号码或复制动作。

工作区已有 output/ 独立预览必须保留，不纳入产品提交；当前任务不依赖预览截图或聊天历史。以 Git 对象核验批准 Spec 与执行 Plan，不以旧版 assistant Plan 或工作树未批准版本替代。任何审批只在实施完成后的具体 final gate 阶段请求，当前提示词不授权 push。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main（规划基线 30a0d3b24c2257da70c8b54fff4ee0ebb5ad71d0）；实施范围 批准 Spec §10–§12 的展示增量：共用气泡与安全 Markdown、AI 三类结果标题/卡内中文理由/时间、真人页身份及联系方式占位/全屏职位与 PDF 层/短气泡宽度；不改消息业务或后端协议；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 3
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-16-candidate-assistant-chat-design.md（revision 81e12c337596e063e089a6074c6bb2779e5dde60，blob 8eebfc2ec223dab7deaa1d8bbe5afc02675aeb98）、执行 Plan：docs/superpowers/plans/2026-09-16-chat-presentation-refinement.md（版本 dd05ba87943d21747c56f6d2094a84f0d0e17838，blob 7a85a366f17c8b20dca53e3ad03aa661fe4892d3）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 development-workflow 的 skill 根目录相对 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前按当地发现的 development-workflow skill 根目录定位 scripts/task_intents.py，以 python3 执行其 start 登记；命令参数先读该 CLI 的帮助。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑任何真栈 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow 的 skill 根目录相对 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 本轮 L3 responsibility: none，跳过真栈与其资源清理 → 再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：产品改动按 Plan 精确路径；实施进度/review 裁决就地更新 Plan；原始本地测试日志和截图在 output/chat-presentation-evidence/，不提交预览或敏感原始证据，不新增交接文档。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

用户明确要求：本轮为样式/展示优化，不需要真栈 L3。该覆盖优先于执行合同中的通用 L3 条款；不部署、不准备 STG 账号/资源、不调用真实后端或模型作验收，不因缺少真栈而阻塞本轮，也不声称 L3 PASS。仅做 Plan 指定的必要本地静态、组件、离线浏览器及视觉验证，不能自动升级为全库测试。既有 API 只做批准的展示接线，不扩展业务能力。

已完成 Claude 文档 review 1 轮：1 项 required（时区验证）和 1 项 optional（移除操作栏无调用方分支）均接受并修订，裁决后无未解决有效 required；不误称 reviewer 返回 NO FINDINGS。Task 1–3 不需要重新 brainstorm 或重复规划；若发现范围外真实契约变化，只暂停对应扩展并明确缺口。卡片按钮/原内容不得重画，AI 两侧同轮时间取 created_at，真人按每条 createdAt；发布方企业与用人企业不可混淆；电话微信仅诚实缺失占位，无假号码或复制动作。

工作区已有 output/ 独立预览必须保留，不纳入产品提交；当前任务不依赖预览截图或聊天历史。以 Git 对象核验批准 Spec 与执行 Plan，不以旧版 assistant Plan 或工作树未批准版本替代。任何审批只在实施完成后的具体 final gate 阶段请求，当前提示词不授权 push。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。
```
