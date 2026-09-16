# 前端测试分层重构：新会话执行提示词

只复制与你的执行宿主对应的完整 text 框。两节绑定同一已批准 Spec 与完成两轮文档审查裁决的 Plan；这里不继续做产品设计，不自动启动实施。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行前端测试分层重构 Plan。用户选定的工作区固定为当前仓库根 .，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；只用仓库相对路径，从当前仓库根执行命令，不把本机绝对目录写入交付。

Task count: 6
计数仅含编号实施 Task，收尾不计数。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

批准 Spec：docs/superpowers/specs/2026-09-16-frontend-test-layering-design.md（revision c60dca14a317cb6edee246e3bfd2f818a4979e61，blob 06a9dd7242a7b37df94c9c5a4b4137cb6080aaa2）。用精确 Git 对象读取批准正文，当前文件的批准记录更新不改变该契约。
执行 Plan：docs/superpowers/plans/2026-09-16-frontend-test-layering.md（版本 48aeca9a11347e0397831ca88728d1bf99c33345，blob 4f5e224f791444a31d0af68e4b9349ddc0068127）。核验 Git 对象与文件；缺失对象或实质漂移时报告，不能自行换成最新未批准设计或回退 checkout。

按顺序读取仓库 CLAUDE.md、AGENTS.md 和实际适用规则、批准 Spec、Plan 的 Global Constraints / Task index / 角色表 / 现状核验 / C1–C7 / 测试选择五问，以及当前 Task 全文和预期新增/修改/删除文件清单；按顺序执行时再读后续 Task，不一次向子代理塞入所有 Task 正文。冻结契约与当前 Task brief 必须一起传递，不能假定子代理看过聊天历史。另完整读取 development-workflow 的 skill 根目录相对 assets/execution-contract.md；结束实施后进入 Plan 唯一的“实施后收尾（不计入 Task count）”。文档 review 裁决已经就地记录在 Plan，不重做规划 review。

实施范围固定为三层测试组织、现有 Suite/Case 拆分、重复入口裁剪、已实测慢等待优化、薄原生 Case 清单及旧 local 指引归档。顺序为：1 离线边界与统一功能入口；2 按域抽 fixture；3 浏览器 Suite/长 Case 拆分；4 四组第一层大文件整理；5 原生清单与视觉边界/采集兼容；6 L3 文档收口和两个一次性脚本退役。不得新增业务 L3 Case，不改产品运行逻辑/后端/部署，不升级依赖；src/main.tsx 只允许计划列出的旧配置引用注释修改。复用 Vitest/Playwright，不引入 DSL、测试平台、注册服务、调度器、跨任务缓存或全量 page-object 抽象。

关键冻结：三个功能 project 为 mock/fixture/annotation、端口 4181/4182/4183；旧 data-source npm 命令仅是同一 runner 的 deprecated 别名；功能业务测试先有离线边界再执行。视觉边界接入与 18 场景验证同在 Task 5，此前不执行视觉采集。原生路径＋完整名称＋project/参数是 Case 坐标；280 个旧浏览器变体/57 项重复是基线对账依据，不是最终硬数量。所有独有断言和跨步不变量要有去向；不可用删断言、skip、提高 timeout/retry 或改变产品行为换取绿色。耗时未知就写未知，只按匹配环境的同风险集合实测比较。保持 P1、P1_BACKEND、WIRING 和专用视觉采集协议。现有 STG onboarding 两角色四组合及基础试点语义不变，未承接旧风险明确登记，不能把 fixture 成功或归档记为 STG PASS。

本宿主按 Task count 路由：6 > 3，必须实际调用 superpowers:subagent-driven-development，六个 Task 串行，不在同一工作树并发修改；每 Task 的 implementer / spec reviewer / code-quality reviewer 档位取 Plan 角色表，实际使用 Claude Code 条件 alias，不能静默降档。所需 skill 或委派能力不可用时报告具体阻塞，不改为主 Agent 直接实施。Task review 使用宿主内 reviewer。开工前按逻辑名发现 development-workflow，先读其 skill 根目录相对 scripts/task_intents.py 的 --help，再通过 python3 调用 start 登记并检查活动/暂停 intent；范围扩展前更新并核对重叠，不操作他人的 intent。

外部 skill 用逻辑名称发现，允许宿主实际名称有命名空间差异，资源按本机该 skill 根目录解析，不写回交付。异构 reviewer 为 Codex，使用具备只读、多轮复审能力的宿主对应 review-loop；共用合同为 reviewer skill 根目录相对 ../_shared/review-contract.md，必须解析真实 skill 路径并完整读取。缺少 skill/合同/必需模型时报告，不猜路径或换 reviewer。

测试与收尾责任：完成六个实施 Task 和执行 skill 要求的宿主内全局 review（未要求则不新增）→ 退出 Task 循环 → 同一 session 调用 Codex 异构 review-loop → 完成适用 affected/L0–L2 → 展示 final gate 并等待用户明确确认。异构 review 只在这个收尾位置调用，绑定批准 Spec/Plan 精确版本与冻结 candidate diff，reviewer 默认不跑测试；轮次、裁决和停止按其 skill，轮间只做修复相关轻量单元/静态检查，不跑 broad gate。覆盖默认 finishing-a-development-branch，不追加整套测试/合入菜单/清理；进入 affected 后不重新进入 Task/global/异构 review。

按 Plan 的完整责任选择最小权威验证：功能浏览器共享配置覆盖全部唯一选集；第一层只执行受影响拆分文件/局部 helper 实际消费者、新清单脚本及适用工具测试，不能无依据扩大成全库 Vitest；全库原生 list/迁移对账仍必须完成。计时、视觉输出、P1_BACKEND 采集等已有匹配证据直接复用，只补新增或失效责任；不 raw+alias 连跑、不确认前后各跑一轮完整测试。工具等待超时继续追踪同一进程，不重复启动。产品缺陷或入口限制如实记录，不伪造 PASS。正式 L3 selection 为 none：本次无真实 STG 语义变更，不登录/上传、不声明 L3 PASS；需要改语义则停止扩权并修订契约与 selection。

确认前完成完整适用 L0–L2并修复范围内失败，不合 target、不跑正式 L3、不 push，只允许只读 fetch 核对目标。final gate 展示 candidate SHA、实际 target SHA、完整责任/有效证据/待补增量、拟合入动作与 L3 none 理由，未完成不得宣称 ready，人工确认不得委派替代。

确认后同一执行者完整读取 development-workflow 的 skill 根目录相对 references/final-integration.md 和 assets/final-integration-contract.md：同步 target 并记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3（本任务 none）→ cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，禁止 force push。确认后不再调用异构 review；目标推进/修复只使相关证据失效，不自动整层重跑；用户内容与既有 evidence 不清理。

输出位置：docs/testing/README.md、docs/testing/cases.md 及 Plan 列出的现有/归档文档；原始测试 receipt/计时留在已忽略的 test-results/test-layering/，task intent 用既有本机机制。不要新增第二份 Plan、handoff、review report 或验证总结文档。报告实际改动、断言迁移、耗时/未知项、review 裁决、测试和合入事实；收尾仍由同一主控负责。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词扩展产品设计。保持最小改动；关键行为/接口/覆盖义务变更必须先明确修订契约，内部 helper 等价重构则记录理由即可。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository myaier/agxp-a2a-recruiting-web 执行前端测试分层重构 Plan。用户选定的工作区固定为当前仓库根 .，复用不新建：不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。target origin/main；只用仓库相对路径，从当前仓库根执行命令，不把本机绝对目录写入交付。

Task count: 6
计数仅含编号实施 Task，收尾不计数。
Execution skill: superpowers:executing-plans
Model aliases: host-native

批准 Spec：docs/superpowers/specs/2026-09-16-frontend-test-layering-design.md（revision c60dca14a317cb6edee246e3bfd2f818a4979e61，blob 06a9dd7242a7b37df94c9c5a4b4137cb6080aaa2）。用精确 Git 对象读取批准正文，当前文件的批准记录更新不改变该契约。
执行 Plan：docs/superpowers/plans/2026-09-16-frontend-test-layering.md（版本 48aeca9a11347e0397831ca88728d1bf99c33345，blob 4f5e224f791444a31d0af68e4b9349ddc0068127）。核验 Git 对象与文件；缺失对象或实质漂移时报告，不能自行换成最新未批准设计或回退 checkout。

按顺序读取仓库 CLAUDE.md、AGENTS.md 和实际适用规则、批准 Spec、Plan 的 Global Constraints / Task index / 角色表 / 现状核验 / C1–C7 / 测试选择五问，以及当前 Task 全文和预期新增/修改/删除文件清单；按顺序执行时再读后续 Task，不一次读取所有 Task 正文。冻结契约与当前 Task brief 必须一起核对，不能依赖规划聊天历史。另完整读取 development-workflow 的 skill 根目录相对 assets/execution-contract.md；结束实施后进入 Plan 唯一的“实施后收尾（不计入 Task count）”。文档 review 裁决已经就地记录在 Plan，不重做规划 review。

实施范围固定为三层测试组织、现有 Suite/Case 拆分、重复入口裁剪、已实测慢等待优化、薄原生 Case 清单及旧 local 指引归档。顺序为：1 离线边界与统一功能入口；2 按域抽 fixture；3 浏览器 Suite/长 Case 拆分；4 四组第一层大文件整理；5 原生清单与视觉边界/采集兼容；6 L3 文档收口和两个一次性脚本退役。不得新增业务 L3 Case，不改产品运行逻辑/后端/部署，不升级依赖；src/main.tsx 只允许计划列出的旧配置引用注释修改。复用 Vitest/Playwright，不引入 DSL、测试平台、注册服务、调度器、跨任务缓存或全量 page-object 抽象。

关键冻结：三个功能 project 为 mock/fixture/annotation、端口 4181/4182/4183；旧 data-source npm 命令仅是同一 runner 的 deprecated 别名；功能业务测试先有离线边界再执行。视觉边界接入与 18 场景验证同在 Task 5，此前不执行视觉采集。原生路径＋完整名称＋project/参数是 Case 坐标；280 个旧浏览器变体/57 项重复是基线对账依据，不是最终硬数量。所有独有断言和跨步不变量要有去向；不可用删断言、skip、提高 timeout/retry 或改变产品行为换取绿色。耗时未知就写未知，只按匹配环境的同风险集合实测比较。保持 P1、P1_BACKEND、WIRING 和专用视觉采集协议。现有 STG onboarding 两角色四组合及基础试点语义不变，未承接旧风险明确登记，不能把 fixture 成功或归档记为 STG PASS。

本宿主固定实际调用 superpowers:executing-plans，六个 Task 按依赖连续执行，不因 Task 数改成 subagent 模式。每 Task 三角色档位取 Plan 角色表的通用档位，按当前宿主模型配置执行；Claude Code 条件 alias 只是另一宿主说明，本宿主不解析、查找或校验，也不因缺少它们报错。不得静默降低通用档位，所需 skill 不可用则报告具体阻塞。Task review 遵循执行 skill 的宿主内要求，不自行添加并行代理流程。开工前按逻辑名发现 development-workflow，先读其 skill 根目录相对 scripts/task_intents.py 的 --help，再通过 python3 调用 start 登记并检查活动/暂停 intent；范围扩展前更新并核对重叠，不操作他人的 intent。

外部 skill 用逻辑名称发现，允许宿主实际名称有命名空间差异，资源按本机该 skill 根目录解析，不写回交付。异构 reviewer 为 Claude，调用 claude-review-loop 的多轮只读代码审查；共用合同为 reviewer skill 根目录相对 ../_shared/review-contract.md，必须解析真实 skill 路径并完整读取。缺少 skill/合同/必需模型时报告，不猜路径或换 reviewer。

测试与收尾责任：完成六个实施 Task 和执行 skill 要求的宿主内全局 review（未要求则不新增）→ 退出 Task 循环 → 同一 session 调用 Claude 异构 review-loop → 完成适用 affected/L0–L2 → 展示 final gate 并等待用户明确确认。异构 review 只在这个收尾位置调用，绑定批准 Spec/Plan 精确版本与冻结 candidate diff，reviewer 默认不跑测试；轮次、裁决和停止按其 skill，轮间只做修复相关轻量单元/静态检查，不跑 broad gate。覆盖默认 finishing-a-development-branch，不追加整套测试/合入菜单/清理；进入 affected 后不重新进入 Task/global/异构 review。

按 Plan 的完整责任选择最小权威验证：功能浏览器共享配置覆盖全部唯一选集；第一层只执行受影响拆分文件/局部 helper 实际消费者、新清单脚本及适用工具测试，不能无依据扩大成全库 Vitest；全库原生 list/迁移对账仍必须完成。计时、视觉输出、P1_BACKEND 采集等已有匹配证据直接复用，只补新增或失效责任；不 raw+alias 连跑、不确认前后各跑一轮完整测试。工具等待超时继续追踪同一进程，不重复启动。产品缺陷或入口限制如实记录，不伪造 PASS。正式 L3 selection 为 none：本次无真实 STG 语义变更，不登录/上传、不声明 L3 PASS；需要改语义则停止扩权并修订契约与 selection。

确认前完成完整适用 L0–L2并修复范围内失败，不合 target、不跑正式 L3、不 push，只允许只读 fetch 核对目标。final gate 展示 candidate SHA、实际 target SHA、完整责任/有效证据/待补增量、拟合入动作与 L3 none 理由，未完成不得宣称 ready，人工确认不得委派替代。

确认后同一执行者完整读取 development-workflow 的 skill 根目录相对 references/final-integration.md 和 assets/final-integration-contract.md：同步 target 并记录 final_target_base → 重算完整责任 → 复用有效 PASS、只补缺口 → 必要 development L3（本任务 none）→ cleanup 后再次对账 → 核对 target 未推进 → 普通 fast-forward push，禁止 force push。确认后不再调用异构 review；目标推进/修复只使相关证据失效，不自动整层重跑；用户内容与既有 evidence 不清理。

输出位置：docs/testing/README.md、docs/testing/cases.md 及 Plan 列出的现有/归档文档；原始测试 receipt/计时留在已忽略的 test-results/test-layering/，task intent 用既有本机机制。不要新增第二份 Plan、handoff、review report 或验证总结文档。报告实际改动、断言迁移、耗时/未知项、review 裁决、测试和合入事实；收尾仍由同一主控负责。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行 execution contract 与 Plan 当前 Task brief，不从本提示词扩展产品设计。保持最小改动；关键行为/接口/覆盖义务变更必须先明确修订契约，内部 helper 等价重构则记录理由即可。
```
