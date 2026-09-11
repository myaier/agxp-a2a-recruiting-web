# J-PILOT-02 前端接线执行提示词

复制对应宿主的完整正文到新的实施 session。复用当前用户工作区；本文件不启动实施。

## Claude Code

```text
你在 Claude Code 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准 Spec 对应并完成文档 review 的 Plan。target main；工作区固定为当前仓库根 .，不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。所有输入输出使用仓库相对路径，外部后端检出由当前环境定位，不绑定规划机器。

Task count: 10
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

批准 Spec：docs/superpowers/specs/2026-09-11-j-pilot-02-frontend-wiring-design.md（revision a0c7e0a5ffb913b9df8bb2216fc40ad700e532b7，blob 6b1609cae4422c7205fb7668e9d3c6b343af55b7）。
执行 Plan：docs/superpowers/plans/2026-09-11-j-pilot-02-frontend-wiring.md（revision bce302b3a8b8268c522c4f1165de1b3a21e37a5f，blob 80af343ac8a8602c0449cb7d91cb62864f53846b）。

开工完整读取 CLAUDE.md、AGENTS.md、批准 Spec；按 Git 对象核对文件存在和内容一致，不能改用未批准的新版本。读取 Plan 的 Global Constraints、展示锚点/PM缺口、冻结契约、Task index、角色表、验证责任和当前 Task 完整正文；后续按依赖读取对应 Task，不能凭规划聊天历史补行为。外部 skill 按逻辑名称发现，资源按真实 skill 根目录解析，不写机器路径进交付。实际调用 superpowers:subagent-driven-development；连续串行执行10个编号 Task，收尾不计数。按 Plan 三角色表使用当前可用 Claude Code 条件 alias，fable/opus 表示备选而非字面模型名；缺必需委派能力或档位时报告具体阻塞，不静默降档或改主控单独实施。每个 Task 的 implementer、spec reviewer、code-quality reviewer 按执行 skill 独立完成。

同时读取 development-workflow 的 skill 根目录相对资源 assets/execution-contract.md，收尾读取 references/final-integration.md 和 operative 资源 assets/final-integration-contract.md。本仓库规划时没有 scripts/task_intents.py；按 Plan Global 的用户最小实现约束处理：检查当地实际可用登记入口，存在则按既有机制登记/检查重叠，不存在则核对工作树/他人变更并声明本Task文件范围，不新增基础设施、不伪称登记。禁止 stash/reset/clean、删除他人记录或覆盖未授权改动。

实施范围：只接候选学生/社招 onboarding 的资料、目录、PDF、私有诉求/首次意向、隐私状态、头像、恢复与完成核对。严格复用现有 Mock 组件和布局；零新增/提取/包装 React 组件，零新增生产文件，不改 Mock CSS、布局 className、布局 DOM、留白或控件位置。固定“扫描862个岗位”及初始化动画保留。禁止总提交接口、通用队列、缓存平台、全局中间件、新状态机框架或顺手重构；有限命令/回执只扩原状态和数据源。后端生产代码不改。目录用真实ID，URL三态不覆盖普通编辑，首次意向四 exclusions 均 unspecified，JSON未知请求只能由明确用户动作按原身份恢复。

Plan 已记录两处事实：公司“再加一家”尚未批准新导航，真实组织选择缺口为 PM_BLOCKED，不能自己添加结果层或跳转；实际只有工作经历页一个 URL input，向导仅有旧校验控制，不恢复已移除输入行。受阻项不算完成，无关接线继续。真实 PDF parser_invalid_output 如实 FAIL、依赖步骤 BLOCKED，根因另立任务；手填独立验收，fixture不能替代真实provider通过。

测试：每 Task 按精确文件/接口、失败反例与最小命令执行，适当TDD，保留候选/selection/runtime/fixture证据；不自动每Task全套测试。修复局部失败后只验证影响范围，不能更新视觉基线把布局漂移变通过。产品改动不得超出批准 Spec；文档矛盾按用户“只接线、禁止改布局”优先，确需设计交PM，不临场发明。

收尾：确认前全部Task及执行skill要求的宿主内全局review完成 → 退出Task循环 → 进入Plan唯一“实施后收尾（不计入 Task count）”。异构 reviewer 为 Codex，自动调用以该身份为reviewer的多轮只读review-loop；绑定精确Spec/Plan与候选diff，读取该review skill根目录相对 ../_shared/review-contract.md（不是仓库相对），reviewer不跑测试、不改文件。轮次/裁决/停止依该skill，轮间仅修复相关轻量检查。其后完成最小充分 affected / 适用 L0–L2，复用有效Task证据；不回Task/global/review循环、不追加finishing菜单或重复整层测试。

人工 final gate 是实施收尾的最后确认：先备齐candidate SHA、只读fetch得到的target SHA、L0–L2 selection与receipts/复用依据、明确L3分支/前置/顺序/增量命令、PM/后端缺口及合入动作，再等待用户明确确认。确认前不合target、不跑正式L3、不push；review或L0–L2未完成不宣称ready。确认后按final integration合同同步实际target，记录final_target_base，重算完整责任，按INCREMENTAL_EVIDENCE复用有效证据、只补缺失失效子集，再执行Plan选定正式L3；cleanup后再次对账，目标推进则重新核对，普通fast-forward push，禁止force push。确认后不再异构review。没有授权发布/deploy，不扩大为发布任务。

输出位置：实施修改仅Plan当前Task列出的仓库相对路径；证据用 dogfood-output/ 下本次运行目录等已有忽略位置，长期脱敏记录沿仓库现有约定。review裁决原位记录，不新增handoff、review report或validation规划文档。最终报告真实测试/受阻项与Git事实，不把未跑、解析失败或PM缺口说成通过。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行批准Spec、Plan当前Task brief与上述执行合同；本提示词不补充新产品设计。
```

## Codex

```text
你在 Codex 的全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准 Spec 对应并完成文档 review 的 Plan。target main；工作区固定为当前仓库根 .，不创建第二个用户工作区，不自动 stash/reset/clean 已有内容。所有输入输出使用仓库相对路径，外部后端检出由当前环境定位，不绑定规划机器。

Task count: 10
Execution skill: superpowers:executing-plans
Model aliases: host-native

批准 Spec：docs/superpowers/specs/2026-09-11-j-pilot-02-frontend-wiring-design.md（revision a0c7e0a5ffb913b9df8bb2216fc40ad700e532b7，blob 6b1609cae4422c7205fb7668e9d3c6b343af55b7）。
执行 Plan：docs/superpowers/plans/2026-09-11-j-pilot-02-frontend-wiring.md（revision bce302b3a8b8268c522c4f1165de1b3a21e37a5f，blob 80af343ac8a8602c0449cb7d91cb62864f53846b）。

开工完整读取 CLAUDE.md、AGENTS.md、批准 Spec；按 Git 对象核对文件存在和内容一致，不能改用未批准的新版本。读取 Plan 的 Global Constraints、展示锚点/PM缺口、冻结契约、Task index、角色表、验证责任和当前 Task 完整正文；后续按依赖读取对应 Task，不能凭规划聊天历史补行为。外部 skill 按逻辑名称发现，资源按真实 skill 根目录解析，不写机器路径进交付。实际调用 superpowers:executing-plans；连续串行执行10个编号 Task，收尾不计数。按 Plan 三角色通用档位与当前宿主模型配置执行，不解析、查找或校验 Claude Code alias，不因另一宿主 alias 缺失报错；本宿主不因 Task 数改用 subagent 模式。

同时读取 development-workflow 的 skill 根目录相对资源 assets/execution-contract.md，收尾读取 references/final-integration.md 和 operative 资源 assets/final-integration-contract.md。本仓库规划时没有 scripts/task_intents.py；按 Plan Global 的用户最小实现约束处理：检查当地实际可用登记入口，存在则按既有机制登记/检查重叠，不存在则核对工作树/他人变更并声明本Task文件范围，不新增基础设施、不伪称登记。禁止 stash/reset/clean、删除他人记录或覆盖未授权改动。

实施范围：只接候选学生/社招 onboarding 的资料、目录、PDF、私有诉求/首次意向、隐私状态、头像、恢复与完成核对。严格复用现有 Mock 组件和布局；零新增/提取/包装 React 组件，零新增生产文件，不改 Mock CSS、布局 className、布局 DOM、留白或控件位置。固定“扫描862个岗位”及初始化动画保留。禁止总提交接口、通用队列、缓存平台、全局中间件、新状态机框架或顺手重构；有限命令/回执只扩原状态和数据源。后端生产代码不改。目录用真实ID，URL三态不覆盖普通编辑，首次意向四 exclusions 均 unspecified，JSON未知请求只能由明确用户动作按原身份恢复。

Plan 已记录两处事实：公司“再加一家”尚未批准新导航，真实组织选择缺口为 PM_BLOCKED，不能自己添加结果层或跳转；实际只有工作经历页一个 URL input，向导仅有旧校验控制，不恢复已移除输入行。受阻项不算完成，无关接线继续。真实 PDF parser_invalid_output 如实 FAIL、依赖步骤 BLOCKED，根因另立任务；手填独立验收，fixture不能替代真实provider通过。

测试：每 Task 按精确文件/接口、失败反例与最小命令执行，适当TDD，保留候选/selection/runtime/fixture证据；不自动每Task全套测试。修复局部失败后只验证影响范围，不能更新视觉基线把布局漂移变通过。产品改动不得超出批准 Spec；文档矛盾按用户“只接线、禁止改布局”优先，确需设计交PM，不临场发明。

收尾：确认前全部Task及执行skill要求的宿主内全局review完成 → 退出Task循环 → 进入Plan唯一“实施后收尾（不计入 Task count）”。异构 reviewer 为 Claude，自动调用以该身份为reviewer的多轮只读review-loop；绑定精确Spec/Plan与候选diff，读取该review skill根目录相对 ../_shared/review-contract.md（不是仓库相对），reviewer不跑测试、不改文件。轮次/裁决/停止依该skill，轮间仅修复相关轻量检查。其后完成最小充分 affected / 适用 L0–L2，复用有效Task证据；不回Task/global/review循环、不追加finishing菜单或重复整层测试。

人工 final gate 是实施收尾的最后确认：先备齐candidate SHA、只读fetch得到的target SHA、L0–L2 selection与receipts/复用依据、明确L3分支/前置/顺序/增量命令、PM/后端缺口及合入动作，再等待用户明确确认。确认前不合target、不跑正式L3、不push；review或L0–L2未完成不宣称ready。确认后按final integration合同同步实际target，记录final_target_base，重算完整责任，按INCREMENTAL_EVIDENCE复用有效证据、只补缺失失效子集，再执行Plan选定正式L3；cleanup后再次对账，目标推进则重新核对，普通fast-forward push，禁止force push。确认后不再异构review。没有授权发布/deploy，不扩大为发布任务。

输出位置：实施修改仅Plan当前Task列出的仓库相对路径；证据用 dogfood-output/ 下本次运行目录等已有忽略位置，长期脱敏记录沿仓库现有约定。review裁决原位记录，不新增handoff、review report或validation规划文档。最终报告真实测试/受阻项与Git事实，不把未跑、解析失败或PM缺口说成通过。

本 Plan 计划本身复杂度：高；零上下文漂移风险：高；执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。

严格执行批准Spec、Plan当前Task brief与上述执行合同；本提示词不补充新产品设计。
```
