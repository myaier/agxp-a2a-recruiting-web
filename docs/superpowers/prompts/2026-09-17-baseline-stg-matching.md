# 本地基线与 STG 双向匹配执行提示词

复制对应宿主节的完整正文，在当前分支的新实施会话执行。两份正文独立自足。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 本地测试全量基线修复，以及 backend+stg 的 stg-matching 双向 S0–S3 Happy Suite；仅线上 STG，不启动本地后端，不执行旧 STG Suite、不发送真人消息；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 5
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-17-baseline-stg-matching-design.md（revision 40a9c6f35124813902f317ed2c0e6a30944c271d，blob 0ebb68e87c110dc62b388b3f21a06c8e44bb25aa）、执行 Plan：docs/superpowers/plans/2026-09-17-baseline-stg-matching.md（版本 da9cda7ee6d77bc0fcffe239bd8900fe93721b00，blob a13f19d070418fa2a69ebad27667400db32bb0f5）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 逻辑 skill development-workflow 的 skill 根目录相对资源 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主按 `Task count: N` 路由——N > 3 实际调用 `superpowers:subagent-driven-development`，N <= 3 实际调用 `superpowers:executing-plans`，不悄悄改为主 Agent 执行；每 Task 三角色档位取 Plan 角色表，只校验并使用 Claude Code 条件 alias（fable/opus 是备选 alias），无法满足时报告，不静默降档。异构 reviewer：以 Codex 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前解析 development-workflow 的 scripts/task_intents.py，读取 start --help 后用 python3 调用 start 登记，并用 list 核对活动预告。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow 的 skill 根目录相对 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：Plan 所列精确交付文件；本地 raw 在 test-results/baseline-stg-matching/，视觉在 ui-regression-output/baseline-stg-matching/，真实运行在 dogfood-output/ 的各 run 子目录；review 裁决记入 Plan，不另建 handoff 或 review 报告文档。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

本任务的明确覆盖与现场要求：用户已授权 Task 4 在正式 final gate 前直接探索这两个新增 Case（agent-browser 全程观察与操作），最多六个探索 run，包含隔离核验尾轮；探索证据单列，不能替代正式 PASS。每个计数匹配 run 要由后继新身份实测隔离，最后匹配 run 后设不发起匹配的核验尾轮；尾轮业务 NOT_RUN，不能当第三个 Case 或匹配 PASS。所有已创建 run 均 finally cleanup，接受合法 retained，但必须 rc0、CLEANED、当前 residuals=[]、三方对账、占用释放、旧身份失效且无未收敛工作。正式两 Case 的尾轮也纳入人工 final gate 方案。

用户本次明确要求本地全量跑绿，因此 Plan 的完整本地责任包括单元、全部唯一功能 browser（workers=4/retries=0）、静态/build、清单与18场景视觉比较；开发内循环定向，已有有效覆盖按合同复用，不能拿通用“最小覆盖”降低这一明确责任。只用 AGXP_MONOREPO_DIR 定位后端仓库，读取其环境 Skills 和双向匹配合同；专用 YAML/PDF 固定保存，prepare/verify 与 cleanup 用现有 operator，业务写入只经真实 UI。登录秘密不进 argv、报告或截图。前端使用 Plan 冻结的 backend+stg 命令，现场重新 preflight；禁止伪造模型通过、放宽断言或后台写 API 补业务结果。

规划文档 review 已完成两轮 Claude Opus/high 审查，两条 required 均由规划者核实修复，未解决为零；这不替代实施后的异构代码 review。本提示词授权从 Task 1 开始持续实施，直到具备具体 final gate 方案，不重新询问已批准的范围。缺少必要 skill、环境准入或契约变化时报告实际阻塞；不得声称未执行的测试已通过。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的独立交付 Plan。宿主任务工作区 . 固定为当前仓库根 `.`，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；实施范围 本地测试全量基线修复，以及 backend+stg 的 stg-matching 双向 S0–S3 Happy Suite；仅线上 STG，不启动本地后端，不执行旧 STG Suite、不发送真人消息；输入输出用仓库相对路径，不写绝对目录、file URI 或 home 路径。

Task count: 5
计数仅含编号实施 Task，收尾步骤不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序读取当前仓库实际存在的规则、批准 Spec：docs/superpowers/specs/2026-09-17-baseline-stg-matching-design.md（revision 40a9c6f35124813902f317ed2c0e6a30944c271d，blob 0ebb68e87c110dc62b388b3f21a06c8e44bb25aa）、执行 Plan：docs/superpowers/plans/2026-09-17-baseline-stg-matching.md（版本 da9cda7ee6d77bc0fcffe239bd8900fe93721b00，blob a13f19d070418fa2a69ebad27667400db32bb0f5）的 Global Constraints、Task index、角色表与当前 Task 完整正文（含预期新增/修改/删除文件清单），及 逻辑 skill development-workflow 的 skill 根目录相对资源 assets/execution-contract.md；不一次读取其它 Task 正文，批准版本用 Git 对象核对。

实施方式：本宿主固定实际调用 `superpowers:executing-plans`，全部 Task 连续按依赖执行，只计实施 Task，收尾不计数，不因 Task 数改用 subagent 模式；每 Task 三角色档位取 Plan 角色表，按通用档位与当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主的说明，本宿主不解析、查找或校验，也不因缺少它们报错。异构 reviewer：以 Claude 为 reviewer 的多轮只读 review-loop，绑定批准版本与共用守约规则，reviewer 默认不跑测试。外部 skill 用逻辑 skill 名发现，资源按该 skill 根目录相对路径解析且不写回交付，共用守约规则为 `../_shared/review-contract.md`；开工前解析 development-workflow 的 scripts/task_intents.py，读取 start --help 后用 python3 调用 start 登记，并用 list 核对活动预告。

测试与收尾责任：确认前全部实施 Task 与执行 skill 要求的宿主内全局 review 完成 → 退出 Task 循环，进入 `实施后收尾（不计入 Task count）`：异构 review skill（轮间只跑轻量测试，轮次及停止条件归该 skill）→ affected（适用 L0–L2）→ final gate 确认；覆盖默认 finishing 流程，不再进入 Task/global review 或自动整套测试、合入菜单、清理；实施过程中及确认后不调用异构 review，Task review 使用宿主内 reviewer；测试按变更风险取最小覆盖，不自动跑整层，入口限制如实报告；未完成不宣称 ready；final gate 前只读 fetch，不合 target、不跑正式 L3、不 push，展示方案等用户明确确认。确认后按 development-workflow 的 skill 根目录相对 references/final-integration.md 与 assets/final-integration-contract.md：同步 target 记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3 → cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，不得 force push。输出位置：Plan 所列精确交付文件；本地 raw 在 test-results/baseline-stg-matching/，视觉在 ui-regression-output/baseline-stg-matching/，真实运行在 dogfood-output/ 的各 run 子目录；review 裁决记入 Plan，不另建 handoff 或 review 报告文档。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词补充产品设计。

本任务的明确覆盖与现场要求：用户已授权 Task 4 在正式 final gate 前直接探索这两个新增 Case（agent-browser 全程观察与操作），最多六个探索 run，包含隔离核验尾轮；探索证据单列，不能替代正式 PASS。每个计数匹配 run 要由后继新身份实测隔离，最后匹配 run 后设不发起匹配的核验尾轮；尾轮业务 NOT_RUN，不能当第三个 Case 或匹配 PASS。所有已创建 run 均 finally cleanup，接受合法 retained，但必须 rc0、CLEANED、当前 residuals=[]、三方对账、占用释放、旧身份失效且无未收敛工作。正式两 Case 的尾轮也纳入人工 final gate 方案。

用户本次明确要求本地全量跑绿，因此 Plan 的完整本地责任包括单元、全部唯一功能 browser（workers=4/retries=0）、静态/build、清单与18场景视觉比较；开发内循环定向，已有有效覆盖按合同复用，不能拿通用“最小覆盖”降低这一明确责任。只用 AGXP_MONOREPO_DIR 定位后端仓库，读取其环境 Skills 和双向匹配合同；专用 YAML/PDF 固定保存，prepare/verify 与 cleanup 用现有 operator，业务写入只经真实 UI。登录秘密不进 argv、报告或截图。前端使用 Plan 冻结的 backend+stg 命令，现场重新 preflight；禁止伪造模型通过、放宽断言或后台写 API 补业务结果。

规划文档 review 已完成两轮 Claude Opus/high 审查，两条 required 均由规划者核实修复，未解决为零；这不替代实施后的异构代码 review。本提示词授权从 Task 1 开始持续实施，直到具备具体 final gate 方案，不重新询问已批准的范围。缺少必要 skill、环境准入或契约变化时报告实际阻塞；不得声称未执行的测试已通过。
```
