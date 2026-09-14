# 本地 E2E 最小修复执行提示词

仅复制与你的实施宿主对应的一节。Plan 已完成一次 Claude 文档审查；两条 required 与两条 optional 均由 planner 核实修订，未再次请求 Claude 复审。当前尚未实施。

## Claude Code

```text
你在 Claude Code 的全新实施 session，为 repository agxp-a2a-recruiting-web 执行最小 E2E 修复 Plan。用户工作区固定为当前仓库根 `.`，复用现有分支，不创建第二个用户工作区，不自动 stash/reset/clean 用户内容。target：实施时只读检测父分支与远端，最终精确 remote/ref/SHA 由用户在 final gate 方案中确认；未确认不猜 main、不同步 target、不 push。调查代码基线为 eeaead9abadfd1e87c4abda19fd3de5a6a66af63，先核对当前差异。

Task count: 6
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

按顺序完整读取 CLAUDE.md、AGENTS.md。批准 Spec：docs/superpowers/specs/2026-09-15-local-e2e-realignment-design.md（revision 65c0c8847da6b079cdb7302d73194c99e38bd038，blob 7a17f9537e939d2882891833b6e0919f41b990e3）。执行 Plan：docs/superpowers/plans/2026-09-15-local-e2e-realignment.md（revision c5f074afa496215cd5cd65bee254a72e8aa281ed，blob f50e73d51d848e3812fafb4ba3c7d560c6d15909）。用 Git 对象验证文件存在和精确内容；只读批准版本与当前 Global Constraints、Task index、角色表及当前 Task 的完整正文，不一次读取其他 Task 全文。开始修改后本地 Plan 进度记录可追加，但不得改写批准契约。迁移到其他机器必须携带相应 Git 对象，不能用最新工作树文件冒充批准版本。

实施范围是测试、Playwright 配置与相关运行文档；不改产品 UI、生产 decoder/状态、后端或部署，不升级依赖、不新建框架。用户允许最小修复、删除不合适测试及增加有价值测试：删除必须指出退役依据或精确替代覆盖；新增必须指出当前独立风险缺口。保留仍有效的 ID、权限、CAS、幂等、权威回读与 Mock 零 API 责任，不用跳过、全局 retry、固定 sleep 或增加超时取得绿色。

本宿主 N=6>3，必须实际调用 superpowers:subagent-driven-development；按依赖串行派发，Task 内分别做 spec/code-quality review；只校验 Plan 角色表的 Claude Code 条件 alias。sonnet 为实施基线，若对应 review 为前沿则用可用的 opus/fable；不可擅自降档，缺必需能力报告具体阻塞。 只计编号实施 Task，以下收尾不计数；不因同一大文件而并行修改。开工用逻辑 skill 名发现 development-workflow，解析其本机 skill 根目录并读取 assets/execution-contract.md；运行该 skill 的 scripts/task_intents.py start 登记，扩大路径前 update 并核对重叠。所有外部 skill 资源按逻辑名加 skill 根目录相对路径解析，禁止把规划机器目录写入交付。共用审查规则是 review-loop skill 根目录相对 ../_shared/review-contract.md，缺失则报告具体输入缺口。

异构 reviewer：Codex 的多轮只读 review-loop。确认前：全部 Task 连续完成、执行 skill 要求的宿主内全局 review 完成（未要求则不新增）→ 退出 Task 循环 → Plan 的实施后收尾：调用上述异构 review skill，绑定批准 Spec/Plan 与固定候选，reviewer 不跑测试；轮间仅轻量单元/静态核对，轮次和裁决按 review skill → 运行 Plan 选择的最小完整 affected/L0–L2 → 展示 final gate 方案并等待用户明确确认。不得在实施中途或确认后追加异构 review；不得回到默认 finishing 流程、Task/global review 或自动执行整层测试。

测试依 Plan 的精确选择命令进行，先 --list 验证消费范围。原 111 条失败和解除阻断后的新增问题在 Plan 同一台账记录；Task 2 运行全部受影响招聘 consumer，Task 3–5 分域修复，Task 6 修其余消费者，不能留到审查后才首跑。Playwright 每 invocation 使用独立 output 子目录，保留日志/JSON/显式采集在该目录之外；证据根 ui-regression-output/e2e-realignment/，重跑用独立 attempt 后缀。已有本地调查工件缺失不阻塞，重新生成最小必要证据；旧版本 PASS 不能替代本次验收。

确认前适用 L0–L2 必须完成；只读 fetch 可以取 target 事实，不能合 target、跑正式 L3 或 push。真实 Backend/STG/Hosted L3 在本测试范围内为 none，不冒充真实接口验收、不部署。发现产品缺陷单列证据，暂停相关责任，继续无关任务；没有全部责任证据时不宣称 ready。

确认后同一执行者读取 development-workflow 的 references/final-integration.md 与 assets/final-integration-contract.md，按批准方案同步 target、记录 final_target_base、重算完整责任；按源码/配置/fixture/runtime/选集复用仍有效 PASS，只补失效或缺失消费者，cleanup 后再对账。基准和依赖不变时零重跑已有 L0–L2。必要 development L3 依重算责任（原范围 none）；确认后不再异构 review，标明原已审查 commit 与后续修复差异。核对 target 未推进后才普通 fast-forward push，禁止 force push；target race、需要扩产品范围或缺外部权限时报告，不无限追赶。规划批准和本 prompt 启动不等于批准 final gate。

输出位置：实施进度、测试选择、每条删改依据、代码 review 裁决与合入事实写入 docs/superpowers/plans/2026-09-15-local-e2e-realignment.md；runner 原始工件放 ui-regression-output/e2e-realignment/。不另建 handoff/review report，不自动创建第二份 Plan。仓库文件和聊天交付使用仓库相对路径。完成后刷新本任务 intent，不删除其他任务记录。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行批准 Spec、Plan 当前 Task 与 execution contract，不从提示词自行补产品设计。
```

## Codex

```text
你在 Codex 的全新实施 session，为 repository agxp-a2a-recruiting-web 执行最小 E2E 修复 Plan。用户工作区固定为当前仓库根 `.`，复用现有分支，不创建第二个用户工作区，不自动 stash/reset/clean 用户内容。target：实施时只读检测父分支与远端，最终精确 remote/ref/SHA 由用户在 final gate 方案中确认；未确认不猜 main、不同步 target、不 push。调查代码基线为 eeaead9abadfd1e87c4abda19fd3de5a6a66af63，先核对当前差异。

Task count: 6
Execution skill: superpowers:executing-plans
Model aliases: host-native

按顺序完整读取 CLAUDE.md、AGENTS.md。批准 Spec：docs/superpowers/specs/2026-09-15-local-e2e-realignment-design.md（revision 65c0c8847da6b079cdb7302d73194c99e38bd038，blob 7a17f9537e939d2882891833b6e0919f41b990e3）。执行 Plan：docs/superpowers/plans/2026-09-15-local-e2e-realignment.md（revision c5f074afa496215cd5cd65bee254a72e8aa281ed，blob f50e73d51d848e3812fafb4ba3c7d560c6d15909）。用 Git 对象验证文件存在和精确内容；只读批准版本与当前 Global Constraints、Task index、角色表及当前 Task 的完整正文，不一次读取其他 Task 全文。开始修改后本地 Plan 进度记录可追加，但不得改写批准契约。迁移到其他机器必须携带相应 Git 对象，不能用最新工作树文件冒充批准版本。

实施范围是测试、Playwright 配置与相关运行文档；不改产品 UI、生产 decoder/状态、后端或部署，不升级依赖、不新建框架。用户允许最小修复、删除不合适测试及增加有价值测试：删除必须指出退役依据或精确替代覆盖；新增必须指出当前独立风险缺口。保留仍有效的 ID、权限、CAS、幂等、权威回读与 Mock 零 API 责任，不用跳过、全局 retry、固定 sleep 或增加超时取得绿色。

本宿主必须实际调用 superpowers:executing-plans，6 个 Task 按依赖连续实施。按 Plan 通用档位与宿主实际配置执行；不解析、查找、验证 Claude Code alias，不因未安装 sonnet/opus/fable 阻塞，也不因 Task 数改成 subagent 模式。 只计编号实施 Task，以下收尾不计数；不因同一大文件而并行修改。开工用逻辑 skill 名发现 development-workflow，解析其本机 skill 根目录并读取 assets/execution-contract.md；运行该 skill 的 scripts/task_intents.py start 登记，扩大路径前 update 并核对重叠。所有外部 skill 资源按逻辑名加 skill 根目录相对路径解析，禁止把规划机器目录写入交付。共用审查规则是 review-loop skill 根目录相对 ../_shared/review-contract.md，缺失则报告具体输入缺口。

异构 reviewer：Claude 的多轮只读 review-loop。确认前：全部 Task 连续完成、执行 skill 要求的宿主内全局 review 完成（未要求则不新增）→ 退出 Task 循环 → Plan 的实施后收尾：调用上述异构 review skill，绑定批准 Spec/Plan 与固定候选，reviewer 不跑测试；轮间仅轻量单元/静态核对，轮次和裁决按 review skill → 运行 Plan 选择的最小完整 affected/L0–L2 → 展示 final gate 方案并等待用户明确确认。不得在实施中途或确认后追加异构 review；不得回到默认 finishing 流程、Task/global review 或自动执行整层测试。

测试依 Plan 的精确选择命令进行，先 --list 验证消费范围。原 111 条失败和解除阻断后的新增问题在 Plan 同一台账记录；Task 2 运行全部受影响招聘 consumer，Task 3–5 分域修复，Task 6 修其余消费者，不能留到审查后才首跑。Playwright 每 invocation 使用独立 output 子目录，保留日志/JSON/显式采集在该目录之外；证据根 ui-regression-output/e2e-realignment/，重跑用独立 attempt 后缀。已有本地调查工件缺失不阻塞，重新生成最小必要证据；旧版本 PASS 不能替代本次验收。

确认前适用 L0–L2 必须完成；只读 fetch 可以取 target 事实，不能合 target、跑正式 L3 或 push。真实 Backend/STG/Hosted L3 在本测试范围内为 none，不冒充真实接口验收、不部署。发现产品缺陷单列证据，暂停相关责任，继续无关任务；没有全部责任证据时不宣称 ready。

确认后同一执行者读取 development-workflow 的 references/final-integration.md 与 assets/final-integration-contract.md，按批准方案同步 target、记录 final_target_base、重算完整责任；按源码/配置/fixture/runtime/选集复用仍有效 PASS，只补失效或缺失消费者，cleanup 后再对账。基准和依赖不变时零重跑已有 L0–L2。必要 development L3 依重算责任（原范围 none）；确认后不再异构 review，标明原已审查 commit 与后续修复差异。核对 target 未推进后才普通 fast-forward push，禁止 force push；target race、需要扩产品范围或缺外部权限时报告，不无限追赶。规划批准和本 prompt 启动不等于批准 final gate。

输出位置：实施进度、测试选择、每条删改依据、代码 review 裁决与合入事实写入 docs/superpowers/plans/2026-09-15-local-e2e-realignment.md；runner 原始工件放 ui-regression-output/e2e-realignment/。不另建 handoff/review report，不自动创建第二份 Plan。仓库文件和聊天交付使用仓库相对路径。完成后刷新本任务 intent，不删除其他任务记录。

本 Plan 计划本身复杂度：中；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行批准 Spec、Plan 当前 Task 与 execution contract，不从提示词自行补产品设计。
```
