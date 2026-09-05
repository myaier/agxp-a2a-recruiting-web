# Hosted Agent 与 CRUD Browser Fixture 前端接线设计

**日期：** 2026-09-05
**状态：** 已完成方案确认，等待书面规格复核

## 1. 目标、范围与冻结基线

本设计把前端真实后端浏览器 runner 一次性校准到后端 receipt schema v2，并覆盖两类互补的验收：

1. 当前后端已经支持的 Hosted Agent `happy | p4 | p5 | p6` scene；
2. 普通 candidate/recruiter CRUD journey 所需的、后端尚未实现的第五个 `baseline` scene。

前端先完成两类接线。Hosted Agent 可立即运行真实 E2E；CRUD 在当前后端上必须在启动浏览器前给出明确的后端依赖阻塞。后端以后只需补齐本设计冻结的 `baseline` scene，前端不再修改即可执行真实 CRUD E2E。

冻结规划基线：

- 前端：`origin/main@6c0c497ddf29915c82821ec96994d9ca131c61e5`；
- 后端：`origin/release/0.2.5@c4d99e2db5d8e9ba3b5387fb66ac07d80584b25e`；
- 后端设计：`docs/superpowers/specs/2026-09-04-recruitment-hosted-agent-browser-acceptance-backend-design.md`；
- 后端算子：`apps/recruitment/scripts/browser-fixture.sh`；
- 前端运行模式：`VITE_DATA_SOURCE=backend`。

从后端首次合入 acceptance fixture 的 `5f87bdac4` 到本次冻结的 `c4d99e2d`，与 browser fixture、`dev-local --acceptance`、Hub/Recruitment acceptance control plane 相关的实现没有变化。后端当前真实合同只有四个 Hosted scene；`converge --scene baseline` 会以 usage `64` 退出。

## 2. 已有能力与真正缺口

### 2.1 后端已有能力

当前后端已经提供：

- 显式 `--acceptance` 本地栈；
- `happy | p4 | p5 | p6` 四个 scene；
- receipt schema v2、跨进程 lease、原子恢复和 mode `0600`；
- owner-safe graph validation、P5 acceptance-only terminalization 与 graph retirement；
- cleanup 后 immediate admission；
- candidate `intention_ids`、`resume_file_ids` 和 recruiter `job_ids` 的 pre-state/delta ownership；
- 对这些 CRUD delta 的 cleanup；
- 默认构建不挂载 acceptance route；
- P4/P5/P6 公开失败合同，以及前端主干中的 strict decoder、operation fence 和安全 UI 文案。

因此，当前缺口不是 CRUD 资源无法归属或无法清理，也不需要增加公开 CRUD delete/list API。

### 2.2 后端唯一缺口

现有四个 scene 都要求一个特定的 Hosted Agent 图：

| scene | proposal | active rule | delegation | MatchCase |
| --- | ---: | ---: | ---: | ---: |
| `happy` | 1 | 1 | 至少 1 | 1 |
| `p4` | 0 | 0 | 1 | 0 |
| `p5` | 0 | 0 | 至少 1 | 1 |
| `p6` | 1 | 0 | 0 | 0 |

普通 CRUD journey 不创建 Hosted proposal、rule、delegation 或 Case。它虽然产生的 intention、resume file、job delta 已经被 receipt v2 owner，但 cleanup 仍会先按 scene 校验 Hosted Agent 终态图，所以不能借用任何现有 scene。

真正缺失的是第五个闭合 scene：`baseline`。它复用同一份 ownership、receipt、lease、恢复和 cleanup 机制，只把 Hosted Agent 图的合法基数冻结为严格的零。

## 3. 成功标准与分阶段结论

### 3.1 前端阶段

前端分支完成时必须满足：

- Hosted Agent runner 与当前四个后端 scene 精确兼容；
- `happy` 连续运行两轮，`p4`、`p5`、`p6` 各运行一轮；
- 普通 CRUD runner 已按 `baseline` 合同完成前端接线和 hermetic tests；
- 面对当前四-scene 后端，CRUD 在零 browser/Vite journey 的前提下稳定给出 `BLOCKED_BY_BACKEND_BASELINE_FIXTURE`；
- 产品代码、公开 DTO 和普通应用行为不因该依赖阻塞而改变。

此阶段允许在明确记录后端依赖的前提下合入前端主干，集成结论必须拆开：

```text
hosted_agent_integration: PASS
crud_runner_integration: BLOCKED_BY_BACKEND_BASELINE_FIXTURE
```

不能把 Hosted PASS 写成整套 browser acceptance PASS，也不能把预接线的 CRUD 单测写成真实 CRUD E2E PASS。

### 3.2 完整集成阶段

后端合入 `baseline` 后，在不修改前端代码的前提下：

- 默认五条普通 CRUD/isolation journey 全部真实通过；
- cleanup 证明 CRUD delta 被 owner-safe 恢复；
- Hosted 五轮仍通过；
- 最终才可把两条 integration status 都写为 PASS。

## 4. 方案选择

采用“同一个 runner、同一套 v2 lifecycle、按 journey 内部选择 scene”的最小方案。

### 4.1 Runner 对 scene 的选择

Hosted Agent 保留显式 scene 参数：

```text
npm run test:agent-browser:backend-local -- \
  --journey hosted-agent \
  --hosted-scene happy|p4|p5|p6
```

规则：

- `--journey hosted-agent` 必须同时提供一个合法 `--hosted-scene`；
- `--hosted-scene` 与其它单 journey 或默认 `all` 同时出现是 usage error；
- runner 只把 scene 通过受控环境变量传给 `HostedAgent闭环.sh`，不进入产品请求、BFF DTO 或页面状态。

普通 journey 与默认 `all` 不新增用户参数，runner 内部固定选择：

```text
fixture scene = baseline
```

这不是可配置的通用 scene routing。当前只有两个真实用例：Hosted 显式选择四个业务 scene，普通 CRUD 固定使用零 Agent 图的 baseline。

### 4.2 Hosted suite wrapper

增加一个很薄的显式 Hosted Agent suite 入口，固定串行执行：

```text
happy-1 → happy-2 → p4 → p5 → p6
```

wrapper 不建立 scenario DSL，不复制页面操作，也不解释后端状态。它只负责：

- 整组复用同一套 acceptance stack，避免五轮重复 build；
- 按固定顺序调用单-scene runner；
- 任一轮非零即停止后续轮次并保留该轮报告；
- 只收尾自己启动的 acceptance stack，不删除 volume，不接触默认或生产环境。

普通默认 gate 不隐式运行真实 Provider 或 Hosted 故障 scene。

### 4.3 为什么不选其它方案

- 不让 CRUD 借用 `happy`：这会把普通 CRUD gate 变成真实 Provider/Agent gate，并制造与 CRUD 无关的 rule、delegation 和 Case；
- 不在前端直接删除 CRUD delta：进程中断和 foreign delta 下无法 owner-safe 判定；
- 不建立第二套 baseline receipt/operator：固定账号、lease、receipt 恢复和跨域 ownership 会出现两套互不识别的状态；
- 不增加公开 Recruitment API：receipt v2 已经拥有并能清理 CRUD delta，公开产品合同不是缺口；
- 不复制五套 runner 或增加通用 scene DSL：当前没有第二个消费者证明这类抽象有必要。

## 5. 统一的 acceptance stack 与资源 ownership

Hosted 与 CRUD 两类运行都只接受后端显式 acceptance profile：

```text
dev-local.sh prepare --acceptance
dev-local.sh up --acceptance
dev-local.sh health --acceptance
dev-local.sh bootstrap
```

行为边界：

- 已存在且 `health --acceptance` 通过：复用，前端不 down；
- 普通/default stack 健康但 acceptance health 不通过：记 `INFRA_BLOCKED`，不擅自 down 或切换；
- 没有运行中的栈：由当前调用 prepare/up acceptance profile，并记录 ownership；
- 当前调用拥有的栈才在收尾执行 `dev-local.sh down`；`down` 不带 `--volumes`；
- acceptance profile 缺失、健康失败、真实 Provider/model access/enrollment 不满足均为 `INFRA_BLOCKED`；
- 算子已经开始并判定 graph/合同不合法则为功能或 cleanup 失败，不能降格成环境阻塞。

普通 CRUD 因而也需要 acceptance profile 和 fixture 账号的 Hub identity/enrollment/capability。它不会创建或消费 Hosted Agent task；这些能力只用于复用当前唯一安全的 fixture ownership control plane。

## 6. 统一的 receipt v2 lifecycle

每轮生成一个不带调用序号后缀的 run ID：

```text
BROWSER_FIXTURE_RUN_ID=<frontend run id>
RECEIPT=<backend repo>/apps/recruitment/.local-dev/browser-fixtures/<frontend run id>.json
```

同一环境变量值必须贯穿本轮：

```text
converge --scene <scene>
verify --ledger <same absolute receipt>
browser journey
cleanup --ledger <same absolute receipt>
```

runner 必须逐字校验：

```text
BROWSER_FIXTURE_CONVERGE PASS scene=<scene> phase=prepared receipt=<absolute-path>
BROWSER_FIXTURE_VERIFY PASS scene=<scene> admission=ready
BROWSER_FIXTURE_CLEANUP PASS scene=<scene> next_admission=ready receipt=retired
```

并核对：

- converge 返回的 receipt 路径等于预期绝对路径；
- receipt 存在、不是 symlink、mode 为 `0600`；
- receipt 是 schema v2；
- exact top-level key set 为 `baseline_fingerprints`、`cleanup`、`created_at`、`lease`、`phase`、`pre_state`、`run_id`、`scene`、`scene_contract_version`、`scene_driver`、`schema_version`、`validated_graph`；
- `run_id`、`scene`、`scene_contract_version=hosted-agent-browser.v1` 和 `phase=prepared` 与本轮一致；
- verify 和 cleanup 只使用同一 receipt；
- cleanup 成功后 receipt 必须已经不存在；
- cleanup 失败或信号中断时 receipt 必须保留，runner 只输出受限路径供恢复；
- 前端不修改、重写或删除 receipt。

cleanup 是 receipt 的唯一退休者。cleanup PASS 后禁止再次 converge/verify，也禁止前端 unlink receipt。

## 7. 后端后续最小 `baseline` 合同

本节是前端预接线依赖的精确后端合同。后端实现时应重新校准其最新主干，但不需要改变产品 API 或 receipt schema。

### 7.1 CLI 与 receipt

新增唯一 CLI 值：

```text
browser-fixture.sh converge --scene baseline
```

`baseline`：

- 使用现有 receipt schema v2 和相同 exact top-level key set；
- 保持 `scene_contract_version=hosted-agent-browser.v1`；
- 使用相同 run ID、lease、pre-state、delta、crash recovery、verify 和 cleanup；
- 使用与四个现有 scene 完全相同的三条成功终止行；
- receipt 仍为 mode `0600`，仍只由 cleanup 退休。

保留现有 contract version 是有意的闭合枚举扩展：旧前端不会请求 `baseline`；新前端若看到旧后端会在 mutation 前收到 usage 64；任何 consumer 看到未请求的 scene 仍应 fail closed。没有证据需要为一个枚举值升级整份 receipt schema 或 contract version。

### 7.2 Hub 与 Recruitment scene 语义

`baseline` 必须满足：

- Hub expected fault sequence 为空；
- consumed fault step 数为 0；
- 仍按现有 v2 lifecycle acquire、bind 并 arm 空 fault sequence，receipt 保持 `scene_driver.armed=true`；
- 不注入或消费 Hosted Agent task failure；
- 不创建、等待或消费 `application_id=recruitment` 的 Hosted Agent task；
- candidate/recruiter proposal delta 为 0；
- accepted/active rule delta 为 0；
- recommendation delta 为 0；
- delegation delta 为 0；
- candidate/recruiter MatchCase delta 为 0；
- public terminalization proof 集合为空；
- validate、retire 和 next-admission proof 仍完整执行，并对上述集合逐项证明为零。

CRUD journey 仍可触发产品本来就有的 PDF parser/readiness 流程；这不属于 Hosted Agent application task，也不得放宽上述 Agent 图零基数。

### 7.3 继续复用的 CRUD ownership

`baseline` 不新增 ownership 字段。它直接复用 receipt v2 已有的：

- candidate intention pre-state 与 `intention_ids` delta；
- candidate resume pre-state 与 `resume_file_ids` delta；
- recruiter job pre-state 与 `job_ids` delta；
- profile、privacy、organization/job 等当前 operator 已验证的恢复边界。

cleanup 继续按现有规则验证完整 delta 后才 mutation；发现 unknown、foreign、额外或歧义资源时 fail closed。

### 7.4 后端预计修改边界

后端后续工作只应覆盖支持第五个 scene 所需的最窄路径：

- Hub acceptance scene 闭合枚举与空 expected sequence；
- Recruitment acceptance scene 闭合枚举；
- scene cardinality validation 的严格零 Agent 图；
- `browser-fixture.sh` CLI、receipt scene 校验和 public terminal proof 的空集处理；
- 对应 source-contract 与 fake-runtime tests；
- README 中 scene 列表和 baseline 语义。

不新增公开 route、DTO、OpenAPI、delete endpoint、fixture runner 或通用场景 DSL。

## 8. 当前后端缺少 `baseline` 时的前端行为

前端会固定调用 `converge --scene baseline`，不先通过版本探测或解析后端源码绕开真实合同。

当前四-scene 后端会在任何 fixture mutation 前返回 usage `64` 和精确的四值 usage。runner 只在以下条件全部成立时，把该结果映射为现有报告体系中的依赖阻塞：

- 当前选中的不是 `hosted-agent`；
- 实际调用是内部固定的 `converge --scene baseline`；
- 算子返回 `64`；
- 输出精确表明当前受支持 scene 只有 `happy|p4|p5|p6`，而不是其它参数、路径或脚本错误。

结论为：

```text
classification: INFRA_BLOCKED
reason: BLOCKED_BY_BACKEND_BASELINE_FIXTURE
```

此时必须：

- 不启动 Vite；
- 不启动 agent-browser；
- 不运行任何 product journey；
- 不生成或删除 receipt；
- 不写 fixture PASS、journey PASS 或整体 integration PASS；
- 保留现有 report schema，在已有失败原因/日志边界记录稳定 reason，不为一个依赖新建第二套 verdict schema。

其它 usage `64` 仍是 runner/CLI usage error，不能伪装成后端依赖。后端开始支持 `baseline` 后，同一前端命令自然进入 verify、browser、cleanup，不需要 feature flag 或前端补丁。

## 9. Hosted Agent 浏览器 scene

`HostedAgent闭环.sh` 读取唯一的 `HOSTED_AGENT_SCENE`，并在入口闭合校验四值。四个分支复用已有候选/招聘登录、PDF 上传、delegation、Case 深链和轮询 helper；只提取真实共享步骤，不建立通用 scenario DSL。

### 9.1 `happy`

1. candidate 提交自然语言规则；
2. 观察 `interpreting → ready`；
3. 显式 accept，并在权威重读后看到 active rule；
4. candidate 上传并授权解析测试 PDF，等待公开 parse succeeded；
5. candidate 发起 job delegation，观察 server `case_started`，只使用 server `case_id` 打开 Case；
6. candidate-target evaluation 完成；
7. recruiter 从自己的 Case 列表打开同一 Case，等待 recruiter-target `screen_resume` 完成；
8. 双方至少完成一轮公开 coordination/confirmation；
9. 刷新并深链复读权威状态；
10. 只通过页面当前公开允许的动作把 Case 推进到 `ended | completed`，再复读终态。

第 10 步是后端 owner-safe cleanup 的必要前置。脚本不得从页面外猜 action 或调用 internal hook；若 S3 需要双方确认，就按当前 candidate/recruiter 公开动作完成双方确认。

### 9.2 `p4`

1. candidate 准备完整、已授权且 parse succeeded 的 PDF；
2. 正常发起 job delegation；
3. 等待并断言“AI 服务暂时不可用，本次没有创建 Case”；
4. 断言没有“查看进展”入口，不创建本地 Case；
5. 刷新 recommendation/delegation 后再次看到相同安全原因；
6. 不显示重新发起 CTA，不把 policy/quota/cooldown 文案误判为 Agent failure。

### 9.3 `p5`

1. candidate 使用完整 PDF 正常发起 delegation；
2. candidate-target evaluation 真实完成并创建 server Case；
3. recruiter 从自己的列表进入同一 Case；
4. 等待 `screen_resume` 进入 `attention_required`；
5. 断言“AI 服务暂时不可用，本 Case 尚未继续”；
6. 断言没有 Agent retry，且 `retry_resume_readiness` 不被当作 Agent retry；
7. recruiter 刷新后仍看到相同安全原因；
8. candidate 从自己的 Case detail 看到同一 owner-safe 语义，不跨 viewer 补数据。

P5 Case 的最终收敛由后端 cleanup 在已验证 graph 上使用 acceptance-only terminalization 完成；浏览器不得调用 internal hook。

### 9.4 `p6`

1. candidate 记录提交前 active rule 数；
2. 提交自然语言规则并观察 interpreting；
3. 等待“AI 暂时不可用，本次规则没有生效”；
4. 断言没有确认规则入口，active rule 数没有增加；
5. 断言输入草稿仍可编辑，但页面不会自动重新提交；
6. 导航离开再返回或按前端既有恢复边界复读草稿，仍不产生 active rule。

后端 cleanup 从 owner-safe public API 证明本轮 proposal 的权威 failed 终态和零 active rule。前端不借 E2E 扩张冷启动水合全部历史 failed proposal 的产品语义。

## 10. 普通 CRUD journey

现有默认集合保持不变：

```text
candidate-load
candidate-crud
recruiter-load
recruiter-crud
session-isolation
```

它们继续验证现有页面与公开 API 行为，包括：

- candidate intention 临时修改及恢复；
- candidate 临时 resume/PDF 创建、读取及清理；
- recruiter 临时 job 创建、读取及清理；
- candidate/recruiter profile、privacy、organization/job pre-state 恢复；
- 双 session 和角色隔离。

本设计不改这些 product journey 的业务断言。唯一接线变化是它们在开始前通过 `baseline` 建立 v2 ownership，在结束后由同一 receipt cleanup。runner 不把 baseline 当作 Hosted Agent journey，也不等待真实 Provider 输出。

## 11. 报告、错误与恢复

### 11.1 报告与证据

每次单-scene 运行继续生成现有 manifest、journey 分片、`report.json`、`report.md`、失败快照和受限 private journal。manifest 只增加实际传给 fixture 的 `fixtureScene`；Hosted scene 可由该字段直接读取，不再保存一份可推导的 `hostedScene`。fixture 报告继续记录 converge/verify/cleanup 三态。

不把四个 Hosted scene 扩成新的 product journey ID，也不增加 Hosted 视觉基线。suite wrapper 只输出每轮 scene、round、退出码和运行目录，不复制 report 内容，不生成第二套 verdict schema。

敏感信息扫描沿用现有边界：普通 evidence 只保存 `METHOD + pathname`；不得记录手机号、OTP、Cookie、bearer、global identity、task ID、Provider/model、原始异常、projection、原始简历/JD 或完整模型输出。后端 receipt 不复制到前端报告。

`hosted_agent_integration` 与 `crud_runner_integration` 是发布/交接结论，不是新增的每轮 runtime report schema 字段。

### 11.2 错误与恢复

- converge 未留下合法 receipt：不启动浏览器，不猜 cleanup target；
- converge 已留下 receipt 但未 PASS：保留 receipt，报告精确受限路径；
- verify 失败：不启动浏览器，使用同一 receipt 尝试 cleanup；
- browser journey 失败或收到信号：仍使用同一 receipt cleanup；
- cleanup 返回 75：结论为 `INFRA_BLOCKED`，receipt 保留；
- cleanup 返回功能失败或终止行漂移：结论为 `CLEANUP_FAILED`，优先级高于 journey failure；
- cleanup PASS 但 receipt 仍存在：`CLEANUP_FAILED`；
- cleanup 已 PASS：不再调用任何 fixture 命令；
- 重跑失败轮次前，先用保留的原 receipt 和原 run ID 恢复 cleanup，不以新 run 覆盖 unknown delta。

Hosted wrapper 只在上一轮 cleanup PASS 后开始下一轮。`happy-2` 本身就是第一轮 cleanup/admission 有效性的真实消费证据。

## 12. 自动化测试设计

实现按 TDD 更新现有 shell contract tests，并只在实际报告类型变化时补 TypeScript 单测。

### 12.1 统一 CLI 与 receipt contract

- acceptance profile 的 prepare/up/health 参数逐字正确；
- 默认健康栈不能被当作 acceptance 栈复用；
- converge/verify/cleanup 三次使用同一 run ID 和同一 receipt；
- Hosted converge 携带 exact scene，CRUD/default 携带 exact `baseline`；
- verify/cleanup 只携带 absolute ledger；
- receipt exact key set、schema/version/scene/run/phase/mode/symlink 校验 fail closed；
- 三条成功终止行逐字匹配，只有前缀相同不能通过；
- cleanup 后零二次 converge/verify、零前端 unlink；
- 信号路径仍执行 cleanup：cleanup PASS 时由后端退休 receipt；cleanup 失败时保留 receipt 并把 cleanup 状态记为失败。两种情况都保持既有信号分类 `INFRA_BLOCKED`/75；“cleanup 高于 journey failure”不覆盖信号这一基础设施分类。

### 12.2 当前后端依赖阻塞

- fake operator 模拟四-scene usage 时，CRUD/default 精确得到 `BLOCKED_BY_BACKEND_BASELINE_FIXTURE`；
- 该路径为 `INFRA_BLOCKED`，零 Vite、零 browser journey、零 cleanup、零 receipt 删除；
- 缺参数、错误 ledger、不可执行文件或其它 usage 64 不得匹配该 blocker；
- Hosted 四个 scene 不受 baseline blocker 分支影响。

### 12.3 未来 `baseline` 成功合同

- fake operator 支持第五个 scene 后，默认五条 journey 正常执行；
- receipt scene 为 `baseline`，其余 v2 字段不分叉；
- browser 前 verify PASS、browser 后 cleanup PASS；
- cleanup 自行退休 receipt；
- baseline 运行不调用 Hosted Agent journey，不等待 Provider task；
- candidate/recruiter CRUD 原有断言和 session isolation 不回归。

### 12.4 Hosted scene 与 wrapper

- Hosted 缺 scene、未知 scene、scene 配其它 journey：usage 2，零外部调用；
- `HOSTED_AGENT_SCENE` 闭合为四值，每个 scene 只执行自己的页面路径；
- `happy` 覆盖 P6、PDF、P4、candidate target、recruiter `screen_resume`、双端推进、深链和 Case terminal；
- `p4` 断言 Agent failure、刷新恢复和零 Case；
- `p5` 断言双端 attention、安全文案与零 Agent retry；
- `p6` 断言 failed 文案、草稿保留、零 accept 与零 active rule；
- wrapper 顺序精确为 `happy happy p4 p5 p6`；
- 五轮共享 acceptance stack；每个子 runner 独立生成自己的 run ID/receipt，wrapper 不传入、复用或解释这些标识；
- 任一轮失败不启动后续轮；
- wrapper 只 down 自己启动的 stack；
- Hosted suite 不运行普通 CRUD journey，不更新视觉基线。

### 12.5 门与真实 E2E

真实门复用拥有 Recruitment `.local-dev`、且与持久 Docker volume 配对的后端 checkout；一次性 detached worktree 会丢失这份状态真相，因此禁止用于本验收。开始前只读确认该 checkout 的 HEAD 等于文档冻结 SHA，且 `apps/recruitment`、`apps/recruitment-bff` 没有 tracked 修改；不满足就以 dependency drift 停止，不在验收流程中 checkout、rebase、reset、clean、复制 `.local-dev` 或重置 volume。后端基线变更后必须先重新审查并冻结精确 SHA。

前端定向和 broad gate：

```sh
npm run test:agent-browser:unit
npm run test:agent-browser:shell
npm run typecheck
npm run lint
npm run build
```

当前后端可运行的真实门：

```sh
npm run test:agent-browser:hosted-agent
```

只有五轮 report、五轮 cleanup 和最终退出码全部通过，才可写 `hosted_agent_integration: PASS`。

后端 `baseline` 合入后再运行：

```sh
npm run test:agent-browser:backend-local
```

当前后端上这条命令的正确结果是精确 blocker，不是 PASS。后端合入后必须用同一前端 commit 重跑；若仍需修改前端，说明本设计冻结的合同没有被实现，不能静默放宽 decoder 或兼容分支。

## 13. 预计前端修改范围

实施 Plan 必须以执行时主干再次校准，但预计只涉及：

```text
package.json
e2e/真实后端/运行整栈验收.sh
e2e/真实后端/运行整栈验收.test.sh
e2e/真实后端/运行HostedAgent验收.sh
e2e/真实后端/旅程/HostedAgent闭环.sh
e2e/真实后端/类型.ts
e2e/真实后端/报告.ts
e2e/真实后端/报告.test.ts
```

若稳定 blocker 和 `fixtureScene` 能写入现有日志/manifest 而不改变最终 report 类型，则不得机械修改 TypeScript 报告文件。Plan 应按测试证明的真实缺口进一步缩窄。

## 14. 非目标与延后条件

本批次明确不做：

- 不修改 P4/P5/P6 产品 API、DTO、OpenAPI、strict decoder 或现有安全文案；
- 不重写普通 candidate/recruiter CRUD product journey；
- 不新增 Agent retry，不把 `retry_resume_readiness` 改成 Agent retry；
- 不新增公开 CRUD delete/list endpoint；
- 不新增第二套 receipt、fixture operator、scene DSL、coordinator、锁服务或报告 schema；
- 不通过数据库、network interception、Playwright mock 或前端本地状态伪造 Agent 终态；
- 不增加 Hosted Agent 视觉像素基线；
- 不把当前 CRUD blocker 冒充真实 E2E PASS；
- 不发布、不部署、不执行 release/promote。

只有出现以下证据才重新考虑：

- 多个产品域需要相同 scene 编排，才抽象通用 acceptance coordinator；
- receipt v2 无法 owner-safe 恢复某个实际 CRUD delta，才考虑新增最窄后端 ownership 字段或 operator hook；
- 产品合同正式增加 Agent retry action，才设计重试 UI/E2E；
- Hosted 页面出现稳定且需要审查的视觉回归风险，才增加对应视觉基线；
- 真实五轮 L3 暴露新的产品缺陷，才另立最小产品修复 Spec，不在 runner Plan 里现场扩张。

## 15. 完成定义

### 15.1 前端可合入状态

- [ ] Hosted 与 CRUD 都显式使用 acceptance profile；
- [ ] 每轮 run ID、receipt 和 CLI lifecycle 完全符合 v2 合同；
- [ ] `happy` 连续两轮通过且 Case 在 cleanup 前公开终结；
- [ ] P4/P5/P6 safe-failure browser journey 各通过一次；
- [ ] 每个 Hosted scene cleanup PASS，并由后端自行退休 receipt；
- [ ] CRUD baseline 成功路径的 hermetic contract tests 通过；
- [ ] 当前后端缺 baseline 时，真实 CRUD command 在浏览器前精确阻塞；
- [ ] shell/unit、typecheck、lint、build 通过；
- [ ] evidence 不泄漏认证材料、身份、任务或模型私有内容；
- [ ] 交接明确记录 Hosted PASS 与 CRUD backend blocker，不写整体 PASS。

### 15.2 完整集成状态

- [ ] 后端实现本设计第 7 节的第五个 `baseline` scene；
- [ ] 同一前端 commit 无修改运行默认五条 CRUD/isolation journey；
- [ ] CRUD cleanup PASS，并由后端证明 Agent 图严格为零及 CRUD delta 已恢复；
- [ ] Hosted suite 回归通过；
- [ ] `hosted_agent_integration` 与 `crud_runner_integration` 均为 PASS。
