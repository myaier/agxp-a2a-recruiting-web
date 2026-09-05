# Hosted Agent 浏览器验收前端接线设计

**日期：** 2026-09-05
**状态：** 已完成方案确认，等待书面规格复核

## 1. 目标、范围与冻结基线

本设计只把前端现有 Hosted Agent 浏览器旅程接到后端最新的 acceptance-only 合同，形成可重复、可清理的真实 E2E。普通 candidate/recruiter CRUD runner 的旧 fixture 兼容不在本批次范围内，也不作为本批次完成门。

冻结规划基线：

- 前端：`origin/main@6c0c497ddf29915c82821ec96994d9ca131c61e5`；
- 后端：`origin/release/0.2.5@5f87bdac4ea63265cb5cffd4519c68742a3b6896`；
- 后端设计：`docs/superpowers/specs/2026-09-04-recruitment-hosted-agent-browser-acceptance-backend-design.md`；
- 后端算子：`apps/recruitment/scripts/browser-fixture.sh`；
- 前端运行模式：`VITE_DATA_SOURCE=backend`。

后端基线已提供本设计需要的全部能力：

- 显式 `--acceptance` 本地栈；
- `happy | p4 | p5 | p6` 四个 scene；
- receipt schema v2 和跨进程 lease；
- owner-safe graph validation、P5 acceptance-only terminalization 与完整 graph retirement；
- cleanup 后 immediate admission；
- 默认构建不挂载 acceptance route；
- P4/P5/P6 已有公开失败合同，前端主干已有相应 strict decoder、operation fence 和安全 UI 文案。

后端 `apps/recruitment/README.md` 顶部已经给出新 CLI，但其后仍残留部分 v1 receipt/cleanup 说明。该文档漂移不改变运行合同；本设计只以后端已批准 Spec、`browser-fixture.sh@5f87bdac4` 和对应测试为真相源。

## 2. 成功标准

实现完成后，显式 Hosted Agent gate 必须依次证明：

1. `happy` 第一轮通过；
2. 第一轮 cleanup 后下一轮 admission 可立即建立；
3. `happy` 第二轮通过，不受上一轮 rule、delegation、Case、quota、cooldown 或 display fence 影响；
4. `p4` 公开呈现 Agent unavailable delegation failure，刷新后仍一致且没有 Case；
5. `p5` 公开呈现 `attention_required + agent_attention`，candidate/recruiter 安全语义一致且没有 Agent retry；
6. `p6` 公开呈现 failed proposal，输入草稿保留、不自动重发且没有 active rule；
7. 每一轮都完成 `converge → verify → browser journey → cleanup`，cleanup 删除 receipt 并输出 next admission ready；
8. UI、日志、分片、报告和截图不出现手机号、OTP、Cookie、bearer、global identity、task ID、Provider/model、原始异常、projection、原始简历/JD 或完整模型输出。

HTTP 202、Hub 有 task row、页面短暂显示 interpreting/evaluating，均不构成 PASS。PASS 只能来自浏览器看到的公开业务终态、现有前端严格解码，以及后端算子的 owner-safe cleanup verdict。

## 3. 当前前端与新后端合同的差异

当前 `e2e/真实后端/运行整栈验收.sh` 的 Hosted Agent 路径仍按旧 fixture 合同运行：

- `converge` 不传 `--scene`；
- 每次 fixture 调用都生成新的 `BROWSER_FIXTURE_RUN_ID`；
- receipt 路径带第一次调用的 `-1` 后缀；
- cleanup 后再次执行 `converge` 和 `verify`；
- cleanup 成功后前端主动删除后端 receipt；
- 本地栈使用普通 `prepare/up/health`，没有选择 `--acceptance`；
- Hosted Agent 旅程只有一个 happy path，没有 P4/P5/P6 safe-failure scene；
- happy path 只推进到可深链的 Case 状态，没有保证 Case 最终进入 `ended | completed`，因此不能满足新 cleanup 的 terminal graph 校验。

新后端合同恰好相反：

```text
同一 BROWSER_FIXTURE_RUN_ID
  converge --scene <scene>
  verify --ledger <同一 receipt>
  browser journey
  cleanup --ledger <同一 receipt>
```

`cleanup` 是 receipt 唯一退休者；成功后禁止再次 converge/verify，也禁止前端 unlink receipt。

## 4. 方案选择

采用“现有 runner 的 Hosted Agent 专用分支 + 单 scene 运行 + 薄 suite wrapper”。

### 4.1 单 scene runner

保留现有入口和报告体系，为 Hosted Agent 增加显式 scene：

```text
npm run test:agent-browser:backend-local -- \
  --journey hosted-agent \
  --hosted-scene happy|p4|p5|p6
```

规则：

- `--journey hosted-agent` 必须同时提供一个合法 `--hosted-scene`；
- `--hosted-scene` 与其它 journey 或默认 `all` 同时出现时为 usage error；
- runner 只把 scene 通过受控环境变量传给 `HostedAgent闭环.sh`，不把 scene 注入产品请求、BFF DTO 或页面状态；
- 每次单 scene 运行产生自己的前端 run directory、后端 receipt、旅程分片和报告；
- 现有 `hosted-agent` 旅程 ID 保持不变，不扩张现有视觉基线集合。

### 4.2 五轮 suite wrapper

增加一个很薄的显式 Hosted Agent suite 入口，固定串行执行：

```text
happy-1 → happy-2 → p4 → p5 → p6
```

wrapper 不建立场景 DSL，不复制页面操作，也不解释后端状态。它只负责：

- 保证整组运行使用同一套 acceptance stack，避免五轮重复 build；
- 按固定顺序调用单 scene runner；
- 任一轮非零即停止后续轮次并保留该轮报告；只有 cleanup 未成功时才保留后端 receipt；
- 自己启动的 acceptance stack 才在最终收尾执行普通 `down`，预先存在的健康 acceptance stack 原样保留；
- 不删除 volume，不接触默认或生产环境。

该 wrapper 对应一个显式 npm script。普通 `npm run test:agent-browser:backend-local` 默认集合不会隐式运行真实 Provider 或故障 scene。

### 4.3 为什么这是最小方案

现有 runner 已经拥有 Vite、agent-browser 双会话、报告、退出码、脱敏扫描和资源 ownership；现有 Hosted Agent journey 已经覆盖 happy path 主体。最小改动是给这两处增加 scene-aware 分支，再用薄 wrapper 固定五轮顺序。

不选择以下方案：

- 不把五轮塞进一个新的通用状态机：会重写现有报告、trap 和资源 ownership，当前没有第二个消费者支持这种抽象；
- 不复制五套完整 runner：会重复栈、Vite、session、receipt 和脱敏逻辑；
- 不用 Playwright、network interception、数据库修改或前端 Mock 制造失败：它们不能证明真实 Hosted Agent 状态被 Recruitment 消费；
- 不让默认 CRUD gate隐式跑 happy scene：真实 Provider 不应成为普通前端 gate 的隐藏前置。

## 5. Acceptance stack 与资源 ownership

Hosted Agent 单 scene 和 suite 只接受后端显式 acceptance profile：

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
- 算子已经开始并判定 graph/合同不合法则为 `FUNCTIONAL_FAILED` 或 `CLEANUP_FAILED`，不能降格成环境阻塞。

wrapper 可以拥有整组五轮的 stack 生命周期；单 scene runner 在 wrapper 内看到的是预先存在的健康 acceptance stack，因此不得自行 down。wrapper 未参与时，单 scene runner仍必须能够独立拥有并安全收尾自己的 stack。

## 6. Receipt 与 CLI 接线

每个 scene 生成一个不带调用序号后缀的 run ID：

```text
BROWSER_FIXTURE_RUN_ID=<frontend run id>
RECEIPT=<backend repo>/apps/recruitment/.local-dev/browser-fixtures/<frontend run id>.json
```

同一个环境变量值必须用于本 scene 的 converge、verify 和 cleanup。登录调用的 per-invocation nonce 由后端算子自己生成，前端不得再通过轮换 run ID 规避旧 session replay。

runner 必须逐字校验成功终止行：

```text
BROWSER_FIXTURE_CONVERGE PASS scene=<scene> phase=prepared receipt=<absolute-path>
BROWSER_FIXTURE_VERIFY PASS scene=<scene> admission=ready
BROWSER_FIXTURE_CLEANUP PASS scene=<scene> next_admission=ready receipt=retired
```

并核对：

- converge 返回的 receipt 路径等于预期绝对路径；
- receipt 存在、不是 symlink、mode 为 `0600`；
- receipt 是 schema v2，`run_id`、`scene`、`scene_contract_version` 和 `phase=prepared` 与本轮一致；
- verify 只接受同一 receipt；
- cleanup 成功后 receipt 必须已经不存在；
- cleanup 失败或信号中断时 receipt 必须保留，runner只输出受限路径供恢复；
- 前端不修改、重写或删除 receipt。

退出码继续使用现有分类：

- `0`：对应终止行精确匹配；
- `64`：usage/report error；
- `75`：环境或 acceptance control plane 不可用；
- 其它非零：功能或 cleanup 失败。

## 7. 浏览器 scene

`HostedAgent闭环.sh` 读取唯一的 `HOSTED_AGENT_SCENE`，并在脚本入口闭合校验。四个分支复用已有候选/招聘登录、PDF 上传、delegation、Case 深链和轮询 helper；只保留真实共享步骤，不建立通用 scenario DSL。

### 7.1 `happy`

沿用并收紧现有 happy journey：

1. candidate 提交自然语言规则；
2. 观察 `interpreting → ready`；
3. 显式 accept，并在权威重读后看到 active rule；
4. candidate 上传并授权解析测试 PDF，等待公开 parse succeeded；
5. candidate 发起 job delegation，观察到 server `case_started`，只使用 server `case_id` 打开 Case；
6. candidate-target evaluation 完成；
7. recruiter 从自己的 Case 列表打开同一 Case，等待 recruiter-target `screen_resume` 完成；
8. 双方至少完成一轮公开 coordination/confirmation；
9. 刷新并深链复读权威状态；
10. 通过页面当前公开允许的终结动作把 Case 推进到 `ended | completed`，再复读终态，为 owner-safe cleanup 提供合法前置。

最后一步不得从页面外猜 action，也不得调用内部接口。脚本只点击当前 viewer 实际显示的终结动作，并保留现有二次确认语义。

### 7.2 `p4`

1. candidate 准备完整、已授权且 parse succeeded 的 PDF；
2. 正常发起 job delegation；
3. 等待并断言“AI 服务暂时不可用，本次没有创建 Case”；
4. 断言没有“查看进展”入口，不创建本地 Case；
5. 刷新 recommendation/delegation 后再次看到相同安全原因；
6. 不显示重新发起 CTA，不把 policy/quota/cooldown 文案误判为 Agent failure。

### 7.3 `p5`

1. candidate 使用完整 PDF 正常发起 delegation；
2. candidate-target evaluation 真实完成并创建 server Case；
3. recruiter 从自己的列表进入同一 Case；
4. 等待 `screen_resume` 进入 `attention_required`；
5. 断言“AI 服务暂时不可用，本 Case 尚未继续”；
6. 断言没有 Agent retry，且 `retry_resume_readiness` 不被当作 Agent retry；
7. recruiter 刷新后仍看到相同安全原因；
8. candidate 从自己的 Case detail 看到同一 owner-safe 语义，不跨 viewer 补数据。

P5 Case 的最终收敛由后端 cleanup 在已验证 graph 上使用 acceptance-only terminalization 完成；浏览器不得调用 internal hook。

### 7.4 `p6`

1. candidate 记录提交前 active rule 数；
2. 提交自然语言规则并观察 interpreting；
3. 等待“AI 暂时不可用，本次规则没有生效”；
4. 断言没有确认规则入口，active rule 数没有增加；
5. 断言输入草稿仍可编辑，但页面不会自动重新提交；
6. 导航离开再返回或按当前前端既有恢复边界复读草稿，仍不产生 active rule。

前端当前不承诺在冷启动时水合全部历史 failed proposal，本批次不借 E2E 扩张该产品语义。后端 cleanup 会从 owner-safe public API 证明本轮 proposal 的权威 failed 终态和零 active rule。

## 8. 报告与证据

每个单 scene 运行继续生成现有：

- `run-manifest.json`；
- 六条 journey 分片，其中只有 `hosted-agent` 为选中项；
- `report.json` 与 `report.md`；
- 失败快照和受限 private journal。

运行 manifest 增加本轮 `hostedScene`，fixture 报告继续记录 converge/verify/cleanup 三态。无需把四个 scene 扩成新的产品 journey ID，也不增加 Hosted Agent 视觉基线：本批次验证的是异步业务终态和安全文案，不是视觉像素稳定性。

suite wrapper 的成功条件是五次单 scene 命令全部返回 0。它只输出每轮 scene、round、退出码和对应前端运行目录，不复制各 report 内容，也不生成第二套 verdict schema。

敏感信息扫描沿用现有策略：普通 evidence 只保存 `METHOD + pathname`；任何命中敏感字面量的文本 artifact 都删除并把本轮判为 cleanup failure。后端 receipt 自始至终留在后端 gitignored、mode `0600` 的目录，且不被复制到前端报告。

## 9. 错误、中断与恢复

- converge 未留下合法 receipt：不启动浏览器，不猜测 cleanup target；
- converge 已留下 receipt但未 PASS：保留 receipt，报告精确路径；
- verify 失败：不启动浏览器，使用同一 receipt 尝试 cleanup；
- browser journey 失败或收到信号：仍使用同一 receipt cleanup；
- cleanup 返回 75：结论为 `INFRA_BLOCKED`，receipt 保留；
- cleanup 返回功能失败或终止行漂移：结论为 `CLEANUP_FAILED`，优先级高于 journey failure；
- cleanup PASS 但 receipt 仍存在：`CLEANUP_FAILED`；
- cleanup 已 PASS：不再调用任何 fixture 命令；
- 重新执行失败轮次时使用保留下来的原 receipt 和原 run ID恢复 cleanup；不得以新 run 覆盖未知 delta。

wrapper 只在上一轮 cleanup PASS 后开始下一轮。因此 `happy-2` 本身就是第一轮 cleanup/admission 有效性的真实消费证据。

## 10. 自动化测试设计

实现按 TDD 更新现有 shell contract tests，并补最窄的 TypeScript 单测。

### 10.1 CLI 与 receipt contract

- Hosted Agent 缺 scene、未知 scene、scene 配其它 journey：usage 2，零外部调用；
- acceptance profile 的 prepare/up/health 参数逐字正确；
- 默认健康栈不能被当作 acceptance 栈复用；
- converge/verify/cleanup 三次调用使用同一 run ID和同一 receipt；
- converge 携带 exact scene，verify/cleanup 只携带 absolute ledger；
- receipt schema/version/scene/run/phase/mode/symlink 校验 fail closed；
- 三条成功终止行逐字匹配，只有前缀相同不能通过；
- cleanup 后零二次 converge/verify、零前端 unlink；
- cleanup failure与信号路径保留 receipt并维持现有退出分类。

### 10.2 Scene dispatch

- `HOSTED_AGENT_SCENE` 闭合为四值；
- 每个 scene 只执行自己的页面路径；
- `happy` 覆盖 P6、PDF、P4、candidate target、recruiter `screen_resume`、双端推进、深链和 Case terminal；
- `p4` 断言 Agent failure、刷新恢复和零 Case；
- `p5` 断言双端 attention、安全文案与零 Agent retry；
- `p6` 断言 failed 文案、草稿保留、零 accept 与零 active rule；
- 未知/业务拒绝文案不能冒充指定 safe-failure scene PASS。

### 10.3 Suite wrapper

- 顺序精确为 `happy happy p4 p5 p6`；
- 五轮共享 acceptance stack，但每轮使用不同 run ID/receipt；
- 任一轮失败时不启动后续轮；
- wrapper 只 down 自己启动的 stack；
- 预先存在的 acceptance stack不被 down；
- 不运行默认 CRUD journeys，不更新视觉基线。

### 10.4 基础门与真实 E2E

定向测试：

```sh
npm run test:agent-browser:unit
npm run test:agent-browser:shell
npm run typecheck
npm run lint
npm run build
```

真实有效性门必须在前端实现 commit 与后端 `5f87bdac4` 或其经重新校准的后继 commit组合上运行：

```sh
npm run test:agent-browser:hosted-agent
```

该命令显式运行真实 Provider 和四个 acceptance scene，不属于普通快速 gate。只有五轮 report、五轮 cleanup 和最终退出码全部通过，才可声称 Hosted Agent 浏览器验收已打通。

## 11. 预计修改范围

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

若 `hostedScene` 只需进入既有 manifest 而不进入最终报告，则不得机械修改 TypeScript 报告文件。Plan 应按实际测试缺口进一步缩窄。

## 12. 非目标与延后条件

本批次明确不做：

- 不修复或重写普通 candidate/recruiter CRUD runner 的旧 fixture 兼容；
- 不修改 P4/P5/P6 产品 API、DTO、OpenAPI、strict decoder 或现有安全文案；
- 不新增 Agent retry，不把 `retry_resume_readiness` 改成 Agent retry；
- 不新增通用 scene DSL、fixture coordinator、锁服务或第二套报告 schema；
- 不修改后端仓库、acceptance hooks、receipt schema 或 cleanup 语义；
- 不通过数据库、network interception、Playwright mock 或前端本地状态伪造 Agent 终态；
- 不增加 Hosted Agent 视觉像素基线；
- 不发布、不部署、不执行 release/promote。

只有出现以下证据才重新考虑：

- 普通 CRUD gate被重新纳入同一完成门，才设计 baseline-only fixture 兼容；
- 多个产品域需要相同 scene 编排，才抽象通用 acceptance coordinator；
- 产品合同正式增加 Agent retry action，才设计重试 UI/E2E；
- Hosted Agent 页面出现稳定且需要审查的视觉回归风险，才增加对应视觉基线；
- 真实五轮 L3 稳定暴露新的产品缺陷，才另立最小产品修复 Spec，不在 runner Plan 里现场扩张。

## 13. 完成定义

- [ ] Hosted Agent runner 显式使用 acceptance profile；
- [ ] 每个 scene 的 run ID、receipt 和 CLI 生命周期完全符合后端 v2 合同；
- [ ] `happy` 连续两轮通过且 Case 在 cleanup 前已公开终结；
- [ ] P4/P5/P6 safe-failure browser journey 各通过一次；
- [ ] 每轮 cleanup PASS 并由后端自行退休 receipt；
- [ ] 不以 202、内部 task、Mock 或数据库状态冒充 PASS；
- [ ] shell/unit、typecheck、lint、build 通过；
- [ ] `npm run test:agent-browser:hosted-agent` 五轮真实 E2E 通过；
- [ ] evidence 不泄漏认证材料、身份、任务或模型私有内容；
- [ ] 普通 CRUD runner 未被声称兼容或纳入本批次 verdict。
