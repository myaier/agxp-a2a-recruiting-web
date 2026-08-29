# Recruitment P5 前端接线设计（最终 HEAD 校准版）

**日期：** 2026-08-29

**状态：** 已按产品校准，等待 P5 四组 backend blocker 的最终公开合同后实施

**范围：** `agxp-a2a-recruiting-web` 的双端 MatchCase workspace/history、四阶段详情、viewer-specific actions、S0–S3 mutation、terminal/archive、原始 PDF 披露与 handoff pending UI。

**前端基线：** `origin/main@636fedefb81998436723ad1585ccdf7b439c5c21`

**后端证据基线：** `recruitment/plan-p5@817d87050f8857dbf0c3cab2ef308d7d5f95df02`。只读取该已提交 HEAD 的 `apps/recruitment-bff/openapi/mobile-v1.yaml`、BFF strict client、Recruitment DTO/projector/store 与测试；后端工作树中未提交的 `apps/recruitment-bff/scripts/local-e2e.sh` 不属于本合同基线。

## 1. 校准结论

前端采用独立 P5 facade、严格 wire decoder、backend-only raw snapshot、closed-code 展示映射和双端共用的 P5 页面组件。Backend 模式不再把 Mock `在谈单` / `候选` reducer 当成 MatchCase，也不从 P4、Job、Organization、Resume 或 timeline 自由文本补齐 P5 没有的数据；Mock 模式保持现有演示剧情。

实施必须先通过四组 backend blocker admission。admission 只接受最终公开 OpenAPI/DTO/合同测试，不根据当前 Go 常量、页面 mock、示例数据或类型草稿猜测 wire shape。blocker 未全部闭合时，本 Plan 保持 `BLOCKED_BY_P5_CONTRACT`，不得先写兼容猜测。

P5 和 P5.1 是两个完成面：P5 Core 与 P5 Minimal Context 可以在四组 blocker 闭合后完成；P5.1 Rich Presentation 只登记依赖，不进入本次代码、测试 gate 或完成声明。

## 2. 合同基线：三类字段与能力

### 2.1 P5 已实现 / 已批准：可直接接线

以下结论由后端最终 HEAD 的公开 route、schema、strict client、projector/store 与测试共同证明：

| 能力 | 最终 HEAD 证据与前端用法 |
|---|---|
| 双端 open workspace | candidate `/api/v1/me/match-cases`；recruiter `/api/v1/recruiter/match-cases`；role-specific filter、limit、opaque cursor 已存在。 |
| 双端 terminal history | `/history?lifecycle=ended|completed` 两个独立 shelf；terminal Case 仍可按 `case_id` 读取 detail。 |
| 四阶段详情 | `state`、四个 `stages`、checklist、transcript、instruction receipts、coordination、intent confirmations、terminal summary 已存在。 |
| viewer-specific detail actions | detail 的 `needs_action` 与 `available_actions` 已按 authenticated viewer 投影；前端只显示服务端给出的 action。 |
| S0 `respond_fact` | 当前 stage transcript 提供 `kind=supplementary_question`、`ref=prompt_id`、`role=owner`、`text=viewer-safe prompt`；提交 `{prompt_id: ref, response}`。不新增 action payload DTO。 |
| S0 结束、S1 resume invitation/readiness/reselection/screening | 已有 candidate decision、resume submission、recruiter screening decision 与原始 PDF content routes；具体按钮只按 `available_actions` 出现。 |
| S2 decision | detail 提供单个 active coordination 与 `issue_id`；双端各有 accept/reject route。 |
| S3 decision | 双端各有 confirm/decline route；intent confirmations 是闭合词。 |
| terminal/archive | `ended` / `completed` detail 为只读，后端投影零 mutation actions。 |
| PDF 披露 fence | recruiter 只有在后端授权的 S1 attachment 出现后，才能通过 Case-scoped content route 打开原始 PDF；binding/parse 本身不授权下载。 |
| Case instruction | 双端 Case instruction POST/GET 与 detail instruction receipts 已存在；底部输入可接线，但提交后必须权威重读，不造本地气泡或长期规则。 |
| no-store | 所有 Case JSON route 返回 `Cache-Control: no-store`，PDF 返回 `private, no-store`；前端还要显式用 `Request.cache='no-store'` 且不持久化 P5 snapshot。 |

当前 HEAD 已经证明 `respond_fact` 可达。除非未来合同测试证明同一当前 stage 会同时出现多个无法区分的 active prompt，否则不得要求后端增加 action payload DTO。

### 2.2 P5 明确漏项：backend blocker

仅以下四组是本次前端 P5 admission blocker，四组的 necessity 均为 `required`：

1. open list 的 viewer-specific `needs_action`，以及基于同一 viewer-specific 值的服务端排序和 cursor；前端不得用 `state.needs_user` 替代。
2. `state.step` 的公开 closed enum，以及 `lifecycle + stage + status + step` 的合法组合矩阵；前端不得根据当前 Go 常量自行冻结未发布合同。
3. 双方确认完成且 handoff outbox 已写入时，公开读模型必须返回 `lifecycle=completed`、`step=handoff_pending`；当前 HEAD 仍投影 `step=complete`。
4. detail 恢复此前批准的最小 role context，使直接刷新不依赖列表内存：
   - candidate：`intention_id + frozen WorkspaceJob`；
   - recruiter：`frozen WorkspaceJob + candidate_alias`。

前端可以依赖这四项，但只能写“等待 P5 最终合同”。admission 必须检查公开 OpenAPI 的 exact property name、nesting、required/nullable、enum 和 route response；本设计不预先规定新增字段在 wire 上如何嵌套。

### 2.3 P5.1 新需求：不阻塞 P5

以下全部是 product/contract decision，不是 P5 bug，也不得由前端伪造、聚合或推导：

- 完整 CandidateJob 字段；
- organization public profile；
- publisher profile；
- match score、reasons、highlights；
- compensation relationship；
- recruiter 侧完整匿名在线简历；
- experiences、certificates、portfolio links；
- P4 alias 与 P5 alias 跨页面连续；
- Case-bound presentation snapshot；
- 结构化 `candidate_identity`；
- P7 conversation ref 与 handoff published 状态。

缺少这些合同时，相关 section 不渲染。不得填 mock 值、从 timeline 文本重建、解析 PDF、或偷偷调用 P4/Job/Organization/Resume API 做页面聚合。

## 3. 方案选择

### 3.1 采用：独立 P5 facade + raw snapshot + closed UI mapper

新增 `招聘数据源/MatchCase.ts` 拥有 path、query/body、strict decoder 与 no-store；新增 `状态/后端/MatchCase操作.ts` 拥有 scope snapshot、mutation lock、幂等意图、session/role/scope fence 与刷新；新增 `MatchCase展示映射.ts` 把已批准的 P5 DTO 转为页面只读 view。

双端列表、历史和详情使用共用 P5 组件并传入 authenticated role。已有中文屏幕在 Backend 模式渲染 P5 组件；Mock 分支继续运行原实现。这样可以复用既有 CSS 和交互外壳，同时避免把 P5 生命周期塞进 Mock `归约MatchCase`。

### 3.2 不采用：把 P5 DTO 水合成现有 Mock `在谈单` / `候选`

Mock 类型强制需要公司、score、下一步自由文案、完整候选信息和本地决策字段。水合它必然伪造 P5.1 数据、复制服务端状态机，并使刷新后的权威状态与 reducer 冲突。

### 3.3 不采用：详情页聚合 P4 / Job / Organization / Resume

这些资源有不同授权、版本和 alias 语义。聚合会产生漂移的 presentation、泄露风险和直接刷新竞态，也把 P5.1 需求伪装成已实现合同。

### 3.4 不采用：新增 `next_step` 或解析 timeline

UI 的标题、阶段标签、说明和按钮只由 closed `state.lifecycle/stage/status/step`、`needs_action`、`available_actions` 与 typed blocks 决定。timeline 的 `text` 只展示，不能决定权威状态或 action。

## 4. 前端内部模型与权威边界

wire DTO 必须逐项复制 admission 后的最终 OpenAPI；下面只冻结前端内部语义，不声明新增 backend wire nesting：

```ts
type P5RoleContext =
  | { role: 'candidate'; intentionId: string; job: P5WorkspaceJob }
  | { role: 'recruiter'; candidateAlias: string; job: P5WorkspaceJob };

interface P5CaseDetailView {
  caseId: string;
  context: P5RoleContext;
  state: P5CaseState;
  needsAction: boolean;
  availableActions: readonly P5Action[];
  stages: readonly P5StageSection[];
  currentCoordination: P5Coordination | null;
  intentConfirmations: P5IntentConfirmations;
  terminalSummary: P5TerminalSummary | null;
}
```

`P5WorkspaceJob` 只承载最终 P5 合同提供的 frozen workspace job；它不是 P1/P4 CandidateJob，也不触发额外 GET。

raw snapshot 只能驻留 React 内存。key 使用 `role + case_id` 或 `role + role-specific filter`；`candidate_alias` 绝不作为 React key、请求参数、业务 ID、scope key 或缓存主键。

## 5. closed-code → UI 映射

最终 `state.step` enum 和合法组合发布后，前端建立一张穷举映射表，输入至少包含：

```text
state.lifecycle
state.stage
state.status
state.step
needs_action
available_actions
```

映射输出阶段中文、状态胶囊、说明文案、允许的 action card 和 terminal/handoff 展示。编译期用 `satisfies` / `never` 保证已知 code 穷举；运行时 decoder 对 unknown code、非法组合、terminal actions、`needs_action`/actions 不一致全部 fail closed，显示合同错误与重试，不显示 mutation 控件。

禁止：

- 新增 `next_step`；
- 根据 transcript/summary 的自由文本选择按钮；
- 用全局 `state.needs_user` 替代 viewer-specific `needs_action`；
- 在客户端推进 stage 或猜测 mutation 后的新状态。

## 6. `respond_fact` 的唯一取值规则

仅当 `available_actions` 包含 `respond_fact` 时，在当前 `state.stage` 对应 section 的 transcript 中查找：

```text
kind = supplementary_question
role = 当前 viewer
ref = 非空 prompt_id
text = 非空 viewer-safe prompt
```

恰好一条时显示问题和回答框，并把该条 `ref` 作为 `prompt_id`。零条或多条都 fail closed：禁用提交、显示合同错误、允许重新 GET；不得选第一条、用 event_id、解析 text 或要求一个尚未证明必要的新 action payload。

mutation 使用一次用户意图的稳定 Idempotency-Key。成功或 replay 后立即重新 GET detail；旧 question 可以作为历史 transcript 展示，但 action 消失后不得继续显示可提交输入。

## 7. handoff 与真人聊天

P5 当前只设计：

```text
lifecycle = completed
step = handoff_pending
```

页面固定显示“双方已确认，正在创建会话”，禁用“开始私聊”跳转。前端不生成、不缓存、不从 Case/P4/alias 推导 conversation ID，也不以 completed、双方 confirm 或 handoff outbox 的存在声称“可聊天”。

只有未来公开合同返回真实非空 conversation ref，并经过独立 P7 设计与 admission，才允许启用跳转。`published` 不属于当前 P5 UI、DTO、测试或完成标准。

## 8. 身份与在线简历是两个能力

### 8.1 P5 原始 PDF

- disclosure 前：招聘端只显示 Case alias；不显示姓名、联系方式或 PDF 入口。
- parse pending/failed：仍保持匿名，且不显示下载入口。
- disclosure 后：只有 detail 的后端授权 attachment 出现时，才允许用该 Case 的 role-scoped content route 打开原始 PDF。
- PDF blob 只存在弹层生命周期；关闭/unmount 时 revoke object URL，不进缓存或持久化。

### 8.2 P5.1 结构化身份

未来另行评审：

```text
RecruiterCandidateIdentity {
  real_name
  phones[]
  emails[]
  messaging_accounts[]
}
```

在该结构化合同批准前，招聘端 header 始终使用 opaque `candidate_alias`，页面不渲染结构化联系方式。禁止前端解析 PDF 提取身份或联系方式。

## 9. alias 规则

P5 workspace alias 是 Case display alias；P4 alias 是 candidate × viewer organization alias。当前不假定二者相等或连续。

前端把 P5 alias 当 opaque display string：只原样展示，不解析格式、不截取、不推导头像或其他字段，也不作为 key/ID/request/cache coordinate。列表与详情 React key 一律使用 `case_id`；头像使用与 alias 无关的匿名通用图标。若产品未来要求跨 P4/P5 连续，进入 P5.1 合同变更评审，不作为 P5 验收。

## 10. 列表、历史、详情与轮询

### 10.1 Open list

- candidate 当前范围传 `intention_id`，全部范围省略 filter；recruiter 当前范围传 owned `job_id`，全部范围省略 filter。
- 保留服务端 viewer-specific 排序；不得客户端重排成另一个权威顺序。
- cursor 完全 opaque，只 encode 一次，不 decode；重复、空、坏类型或超限 cursor 使整次读取失败。
- snapshot 按页原子提交；“加载更多”追加同一 scope。刷新从第一页开始，重读当前已加载窗口，防止 action 变化后 cursor 漂移产生重复/遗漏。
- `待我拍板/代理处理中` 只按 list item 的 `needs_action` 过滤当前已加载结果；未读完所有页时不声称全量总数。

### 10.2 History

`completed` 与 `ended` 分两组、两条独立 shelf query。Backend 历史卡按 `case_id` 打开同一个四阶段详情组件并进入只读态；不从 Mock 归档条重建 timeline 或原因。

### 10.3 Detail

详情只凭 URL `case_id` + authenticated role 发 GET。不得要求用户先经过列表，也不得读取列表 snapshot 补 context。detail 每 3 秒权威重读；open list 每 5 秒重读当前加载窗口。页面 hidden、unmount、session/role/scope 变化时停止；terminal detail 停止 polling。

每次 mutation 后立即重读 detail，并刷新相关 open/history scope；mutation response 的 bare state 不能替代完整 detail。

### 10.4 no-store 与生命周期

所有 P5 JSON/PDF fetch 显式 `cache: 'no-store'`，并继续验证服务端 no-store response。P5 snapshot 不写 `localStorage`、`sessionStorage`、Cache API、service worker 或持久化 reducer。退出、401、切 subject/role 清空 P5 snapshot、锁、幂等意图和 object URL。

## 11. 页面批次

### 11.1 P5 Core

- workspace/history list；
- 四阶段状态、viewer-specific actions、timeline/checklist；
- `respond_fact`；
- S0/S1/S2/S3 已批准 decisions；
- Case instruction 输入与 receipt 重读；
- terminal/archive；
- completed + `handoff_pending`。

### 11.2 P5 Minimal Context

- candidate：intention + frozen WorkspaceJob；
- recruiter：frozen WorkspaceJob + Case alias；
- detail 直接刷新；
- 缺少合同的 section 不渲染。

### 11.3 P5.1 Rich Presentation

只维护 dependency ledger，不创建 DTO、请求、mapper、placeholder 或测试 fixture。它不进入 P5 Core / Minimal Context 的完成标准。

## 12. 错误、并发与 mutation 纪律

- Backend 失败绝不回退 Mock；首次读失败显示失败态，已有成功 snapshot 刷新失败保留旧只读内容并显示错误。
- GET 可以使用现有一次网络重试；mutation 不因普通网络错误换 key 重发。
- 同一 `role + case_id + action + target/ref` mutation 单飞；不同 Case 可并行。
- 409/503 outcome uncertainty 保留同一用户意图 key；先权威 GET 决定 action 是否仍存在，再允许同 key replay。
- 迟到响应必须通过 subject + role + session generation + scope/case generation fence 才能提交。
- terminal、unknown contract、缺 prompt、缺 issue、缺 attachment authorization 一律零 mutation。

## 13. P5 前端验收

必须覆盖：

1. 同一 Case 的 candidate/recruiter `needs_action` 不同，列表排序/cursor 仍各自正确；
2. unknown lifecycle/stage/status/step 或非法组合 fail closed；
3. detail 在无列表内存、浏览器直接刷新时完整呈现最小 role context；
4. S0 supplementary prompt 的 `ref` 正确提交并支持 same-key replay，零条/多条拒绝提交；
5. disclosure 前不显示姓名、联系方式或 PDF；
6. parse pending/failed 仍匿名且不可下载；
7. disclosure 后只通过 Case-scoped content route 打开授权原始 PDF；
8. completed + `handoff_pending` 显示准备中且不跳聊天；
9. 无真实 conversation ref 永不声称“可聊天”；
10. ended/completed 无 mutation actions；
11. 所有 Case JSON/PDF 请求和内存状态按 no-store 处理；
12. alias 只显示，所有 key/request/scope 使用真实 `case_id` 或批准的 role filter；
13. Backend 零 Mock fallback，Mock 零 P5 请求且原演示行为不变。

暂不作为 P5 gate：P4/P5 alias 完全一致、rich score/profile snapshot 永不漂移、结构化 candidate identity、完整在线简历字段、`handoff.published`。

## 14. 明确非目标

- 不修改后端；
- 不提出四组 blocker 以外的新 P5 backend field；
- 不新增 `next_step`；
- 不发布/消费 P7 conversation；
- 不从 PDF 或 timeline 提取身份、score、公司、薪资或权威状态；
- 不接入通用 query/cache 框架；
- 不把 P5 snapshot 写入现有资料持久化；
- 不重做页面视觉，只有缺数据 section 隐藏、合同错误、loading/retry、handoff pending 与已批准 action card 属于必要状态。
