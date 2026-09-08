# S0 匿名初筛 Agent 问答与总结前端接入设计

日期：2026-09-09  
状态：待用户批准；本文件不是实施授权或完成报告

## 1. 背景、基线与目标

Mock Up 已在 MatchCase 的四阶段时间线中展示阶段内代理对话、阶段小结和检查项；Backend 模式目前只展示旧 `transcript`、`instruction_receipts`、步骤码 `summary` 与有限 checklist，无法看到 S0 Agent 实际问答及候选 Agent 的初评／复评。原因不是前端漏渲染已有正文，而是旧详情合同没有公开这些记录。

后端已在 `origin/release/0.2.5` 合入冻结合同 `s0-screening-records.v1`。本设计把该合同接入现有详情读取、严格解码、权威快照、展示映射和 Mock 既有阶段组件，形成候选与招聘双端的读取闭环；不修改后端合同、状态机或 Mock 产品设计。

规划时核对的代码基线：

| 仓库 | 分支 | 冻结提交 |
| --- | --- | --- |
| 前端 `agxp-a2a-recruiting-web` | `origin/main` | `1b6543468a0b08b7d16b7b3da117b597a7da24b4` |
| 后端 `agxp-monorepo` | `origin/release/0.2.5` | `462367b6571d1bbfc4bb29621a4ea1c741dba762` |

后端权威资料为：

- `docs/superpowers/specs/2026-09-08-recruitment-stage-records-disclosure-design.md`
- `docs/superpowers/plans/2026-09-08-recruitment-s0-screening-records.md`
- `docs/superpowers/handoffs/2026-09-08-recruitment-s0-screening-records-implementation.md`
- `apps/recruitment-bff/openapi/mobile-v1.yaml`
- `apps/recruitment/openapi/mobile-resources-v1.yaml`
- `apps/recruitment-bff/internal/recruitmentclient/testdata/s0_screening_records.json`

实施时若前端目标分支已推进，先对本设计涉及的接口和消费者做差异检查并记录实际实施 SHA；不得因基线推进扩大合同或产品范围。后端 handoff 只证明代码合入，不证明运行环境已经部署。真实验收前必须记录前端、BFF 与 Recruitment 的实际运行版本并确认展开接口可用。

成功后应满足：

- 同一真实 Case 中，双方看到后端允许公开的相同 S0 Agent 问答；
- 候选人看到候选 Agent 的初评及逐轮复评，招聘方不看到这些私有总结；
- 问题、回答和复评随轮询逐步出现，且不重复、不串主体；
- S0 离开当前阶段、Case 终局或从历史重新打开后仍可回看；
- 人工补充问题、附件、叮嘱、协调和意向确认等既有能力不回归。

## 2. 现状证据与方案选择

规划时已核对以下现状：

| 位置 | 现状 | 设计影响 |
| --- | --- | --- |
| `src/数据/招聘数据源/MatchCase.ts` | `读取P5详情` 已统一覆盖详情读取且使用 `encodeURIComponent(caseId)`、`cache: 'no-store'`；闭合阶段 decoder 尚不允许 `screening_records` | 在同一个请求入口追加唯一 include，并同步扩展严格 decoder |
| `src/状态/后端/MatchCase操作.ts` | 详情按 role、subject、case scope 保存；已有 single-flight、会话／代际栅栏、迟到响应保护和 mutation 后权威重读 | 新数据进入同一详情快照，不新建消息 store 或轮询系统 |
| `src/数据/MatchCase展示映射.ts` | 旧 `summary` 是步骤码映射；checklist 是有限生命周期标签 | 新增总结必须独立传递，不能覆盖或解释旧字段 |
| `src/屏幕/P5/MatchCase详情.tsx` | 首载、轮询、重试和 mutation 后重读最终都走既有详情操作；时间当前以字符串切片显示 | 统一请求即可覆盖所有读取；S0 记录使用本地时区 `HH:mm` |
| `src/组件/阶段对话流.tsx` | Mock 与 Backend 共用阶段、对话和小结结构；对话项当前用页面生成的数字 ID | 增加可选 S0 展示数据并使用后端稳定记录 ID，Mock 调用保持不变 |
| Mock 数据 | S0 有手写小结及“双休／办公方式／到岗”等手写 checklist | 这些项目没有对应的冻结 Backend 结构化事实，不得从其它快照勉强拼接 |

### 2.1 采用方案：扩展现有 MatchCase 详情链

所有角色的 `读取P5详情` 都请求展开后的同一详情；阶段 decoder 严格验证新块；操作层整包替换同一权威详情快照；展示映射独立投影 S0 消息与候选私有总结；现有页面和阶段组件只增加可选展示槽。

这是满足当前需求的最小方案。它复用已经承担首载、轮询、重试、mutation 后重读、历史回看和身份隔离的链路，不增加第二条请求、双模式缓存、独立消息状态、通用 include 注册器或新聊天工作台。

### 2.2 不采用跨 API 拼接 Mock 固定检查项

本期不从 Job、Intention、Evaluation 或其它 API 拼出“双休／值班安排、办公方式、到岗时间”等固定检查项及匹配结论。现有接口只能提供部分、当前态或单方数据，缺少同一 Case 冻结时点、双方对照、逐项裁决和双角色可见性合同；拼接会让历史 Case 漂移，并可能产生未经后端授权的结论。

现有后端 stage checklist 若包含合法项目，仍按原逻辑展示；本设计不伪造缺失的丰富检查项。若后续产品确认必须展示固定 S0 检查表，优先在现有 `include=screening_records` 的 Case 级冻结块中增加结构化 checks，而不是让前端跨 API 推断。只有 checks 需要独立分页、独立生命周期或独立授权读取时，才有证据考虑单独端点。

## 3. 请求合同

候选与招聘详情分别固定请求：

```text
GET /api/v1/me/match-cases/{encodeURIComponent(case_id)}?include=screening_records
GET /api/v1/recruiter/match-cases/{encodeURIComponent(case_id)}?include=screening_records
```

要求：

- 浏览器只调用既有 BFF 公共接口，不直连 Recruitment internal API；
- `include` 在 URL 中只出现一次，值精确为 `screening_records`；
- 不增加 viewer、角色、字段列表或 wire version 参数；
- 沿用现有认证、错误映射及 `cache: 'no-store'`；
- GET 只读，不启动模型、不推进 Case、不补写历史；
- 不增加“失败后去掉 include 重试”的降级；部署不一致必须显式失败。

`读取P5详情` 是唯一接入口，因此首载、自动轮询、手动重试、mutation 后权威重读、终局首次打开及历史详情重开都会携带相同 include。当前没有保留默认详情模式的真实消费者，因此不引入读取模式参数或双缓存。

## 4. 类型与严格解码

### 4.1 展开字段的存在性

携带合法 include 的成功详情必须满足：

- 只有 `stage === 'anonymous_screening'` 的阶段对象存在 `screening_records`；
- S0 即使没有记录，也必须显式返回闭合对象 `{ messages: [], summaries: [] }`；
- S0 缺失该字段、值为 `null`、数组缺失或为 `null` 均是合同错误；
- S1／S2／S3 出现该字段也是合同错误；
- 旧 `summary`、`transcript`、`state`、`outcome`、`available_actions` 的解码与语义不变。

前端不得把 missing／null 补成空数组，不得静默丢弃非法记录，也不得为接入新字段放宽全局闭合对象规则。

### 4.2 判别联合

新块使用字段专用 decoder，保持以下闭合联合：

| 分支 | 必需字段 | 固定值与禁止字段 |
| --- | --- | --- |
| question | `id`、`kind`、`role`、`round`、`text`、`occurred_at` | `kind=question`、`role=candidate`；禁止 `answer_status` |
| answered answer | `id`、`kind`、`role`、`round`、`text`、`answer_status`、`occurred_at` | `kind=answer`、`role=recruiter`、`answer_status=answered` |
| unanswered answer | `id`、`kind`、`role`、`round`、`answer_status`、`occurred_at` | `kind=answer`、`role=recruiter`；状态为 `declined`／`unknown`／`not_available`；禁止 `text`，包括 `text:null` |
| initial summary | `id`、`phase`、`summary`、`occurred_at` | `phase=initial`；禁止 `round`，包括 `round:null` |
| reevaluation summary | `id`、`phase`、`round`、`summary`、`occurred_at` | `phase=reevaluation` |

每个对象拒绝未知字段。`id` 必须是非空 opaque string，前端不解析前缀或从中推导业务坐标。`text`／`summary` 必须是后端已接受的非空、无首尾空白原文；前端不 trim、截断、翻译或改写后再当作合法响应。

新记录的 `occurred_at` 使用独立校验，必须是 RFC3339 UTC 且以大写 `Z` 结尾，允许小数秒；不能直接复用允许时区偏移的宽松旧时间 helper。原始时间保留在 DTO／视图模型中，格式化只发生在渲染边界。

### 4.3 跨记录语义校验

解码整个 S0 块后还必须一次性验证：

- `messages` 与 `summaries` 中所有记录 ID 全局唯一；
- `round` 是整数且位于 `1..state.round_budget`，不接受数字字符串；
- 同一轮每种消息及每种复评最多一条；
- answer 必须存在同轮真实 question，允许只有 question 尚无 answer；
- 允许轮次空档，不重编号；复评允许没有公开 Q/A；
- messages 保持真实 round、question→answer 的业务顺序；
- summaries 保持 initial→真实 round reevaluation 的业务顺序；
- 不按时间将新消息、新总结和旧 transcript 重新混排；
- 不用新记录重算旧阶段的 `occurred_at`。

当前 `round_budget` 为 3，因此正常上限为六条消息和四条总结；校验从响应中的 `state.round_budget` 取得范围，不靠 ID 或数组长度猜轮次。

### 4.4 角色隐私

候选与招聘可以看到允许公开的相同 Q/A。只有候选详情允许非空 `summaries`；招聘详情若收到任何非空 summary，整个详情按合同错误拒绝，不能在 mapper 或组件中静默过滤掩盖越权数据。招聘方合法的 `summaries: []` 不显示加载失败或私有总结占位。

删除保留态由后端返回空数组时，成功快照必须替换本地旧记录，不得继续显示敏感内容。人工 `fact_response` 合成的问答不进入新 messages；候选人随后收到的真实复评仍可正常显示。

## 5. 权威快照、轮询与错误

`screening_records` 随现有 MatchCase 详情一同保存和更新，不建立独立消息数组或 append 日志：

- 每次成功读取都整包替换对应 role＋subject＋case scope 的权威详情；
- 不因为 `state.version` 相同就跳过展示更新，问题、回答或复评可在其它状态字段不变时出现；
- 保留现有 single-flight、scope／subject／role／session generation 栅栏和迟到 success／failure 保护；
- 轮询从 question 变为 question＋answer 时，替换快照而不是 append，稳定 ID 用于渲染身份；
- 当前同一主体、同一 Case 的网络错误、500、503 或坏合同刷新失败，可以沿用现有规则保留只读旧详情并展示错误；
- 详情刷新返回 404 时，无论原因是 Case 不存在还是当前用户已不再是参与方，都立即清空整份旧详情并保留错误提示；不能继续展示旧 S0 记录；
- 切换账号／角色、删除保留态和会话清理不得跨主体保留旧记录；
- 坏合同、500、503 等沿用现有错误处理，不转换为正常空态。

本设计不新增 polling cadence、缓存层、持久化存储或通用资源框架。

## 6. 展示模型与结果语义

阶段视图分别携带：

- 旧步骤码 `summary` 的既有中文投影；
- 旧 checklist；
- S0 Agent messages 的稳定 ID、round、kind、role、answer status、原始时间与显示正文；
- 候选可见 summaries 的稳定 ID、phase、可选 round、原始时间与原文。

这些字段只服务展示，不决定阶段、成功与否、动作或人工待办。尤其不能用模型 summary 正文推断是否匹配。

S0 的可见“是否匹配”沿用权威阶段语义：

- 阶段已经通过并进入后续阶段时显示既有通过／匹配结果；
- 当前仍在 S0 时保持进行中；
- Case 在 S0 终局且 `outcome` 为 `policy_rejected` 或 `semantic_not_fit` 时，才可显示不匹配；
- `user_ended`、`party_account_deleted` 等非适配性终止不能标成“不匹配”；
- top-level `outcome` 在正常推进到后续阶段时可能为 `null`，不能要求它承担通过判断。

本期不会为了模拟 Mock 的丰富检查清单，从自由文本或其它 API 生成逐项“匹配／不匹配”。

## 7. 页面与 Mock Up 对齐

复用 `阶段对话流` 的四阶段时间线、左右代理气泡和小结托盘，不新建聊天工作台、不改 CSS 或 Mock 数据行为。

### 7.1 S0 Q/A

S0 Agent Q/A 位于匿名初筛阶段的对话区域，先于既有 transcript／instruction receipts 展示，但两类记录保持各自业务顺序，不按时间全量混排。

每条新消息的可见内容严格对齐 Mock：

- 只显示 Q/A 正文或无回答状态文案，以及一条本地时区 `HH:mm`；
- 不显示“Agent 问答”、question／answer、角色名、round、记录 ID 或其它技术标签；
- `candidate` 表示候选 Agent，`recruiter` 表示招聘 Agent；根据 viewer 决定我方／对方左右位置并复用现有我方 Agent 标识，不标成人工聊天；
- 服务端正文按普通安全文本渲染，不执行 HTML，也不因正文内容触发操作；
- `id` 作为 React 稳定 key，轮询后不重复、错位或无意义重建；
- 页面读取时间不能替代原始 `occurred_at`，也不能硬编码加八小时。

未回答 answer 不编造正文，只在招聘 Agent 气泡中显示已确认文案：

| `answer_status` | 可见文案 |
| --- | --- |
| `declined` | 已拒绝回答 |
| `unknown` | 暂无法确认 |
| `not_available` | 暂无可用信息 |

只有 question 的快照只展示问题，不生成等待回答输入框。空 messages 是合法空态，不等于失败。

### 7.2 候选 Agent 总结

候选私有总结继续使用阶段的既有小结托盘，位于旧步骤小结／checklist 之后：

- initial 显示标签“初评”；
- reevaluation 显示标签“第 N 轮复评”；
- 展示全部合法历史，不只保留最后一条；
- 只显示原文与上述产品标签，不显示 summary 时间；
- 总结是本方 Agent 评估，不伪装成对方发言；
- 招聘方数组为空时整个区域不渲染，不显示失败或权限占位。

旧 `summary` 和旧 checklist 继续展示且不能被新总结覆盖。附件入口、阶段动作、叮嘱回执、协调和意向确认控件保持现有顺序与可用性。

### 7.3 时间格式

S0 气泡时间使用用户运行环境本地时区，显示两位 24 小时制 `HH:mm`。实现应加入只服务 S0 新消息的任务内聚 formatter，以 `Intl.DateTimeFormat` 的 parts 组成稳定结果；不改变 DTO 原始时间，不引入全局日期框架。旧 transcript／instruction receipt 的既有时间格式不在本任务中改变，避免借 S0 接线扩大其它阶段显示行为。测试固定 UTC 与 Asia/Shanghai，证明同一 S0 UTC 时间按本地时区正确显示，并证明旧时间线仍保持现状。

因此，同一 S0 阶段内可能暂时同时出现“新 Agent 消息按本地时区格式化、旧 transcript／instruction receipt 沿用字符串切片”的时间显示。这是本期保持既有行为的刻意兼容边界；真实 dogfood 需记录是否造成实际误读，只有出现明确用户证据时才另立任务统一旧时间线。

## 8. 人工补充问题保持独立

`screening_records` 是只读 Agent 记录，不是用户待办来源：

- 人工补充问题仍由旧 transcript/ref、`available_actions` 与 `respond_fact` 合同决定；
- 不用 screening record ID 提交 fact response；
- 不因 Agent question 尚无答案生成输入框；
- 不根据总结正文推进 Case 或改变 action；
- 不把人工合成问答重复显示为 Agent 发言；
- 不把底部 Case 叮嘱改造成 Agent 自由聊天。

## 9. 测试设计

### 9.1 Fixture 与合同测试

前端测试仓库保存一份与后端 release 样例语义一致的 fixture，并在文件或测试说明中记录来源路径及后端 SHA。正例优先直接复用后端 `s0_screening_records.json` 的 candidate full、recruiter no summaries、partial question、unknown answer、zero output、retained 与 default 语义，不另造冲突合同。后端样例没有覆盖的 `declined`／`not_available` 只做最小分支变体。

数据源测试必须证明：

- 两角色 path 正确、case ID 保持 URL 编码、query 精确出现一次、GET 仍为 `no-store`；
- 完整候选 Q/A 与总结、招聘同 Q/A 且空总结、仅 question、三种未回答、零问答但 initial summary、两数组均空、跨轮空档均可正确解码；
- S0 新块缺失／null、错误阶段携带新块、非法／额外字段、错误角色、非法 round、数字字符串、重复 ID、同轮重复、孤立 answer、错误业务顺序、招聘非空 summaries 全部失败；
- 默认模式响应与展开模式的字段存在性不匹配时失败，不回退请求或伪装空态。

### 9.2 状态、映射与组件测试

状态测试覆盖：

- 首载、轮询、重试、mutation 后重读、终局首次打开和历史回看都携带 include；
- question→question＋answer 使用快照替换且不重复；
- 即使旧 state/version 相同，新记录仍更新；
- single-flight、迟到响应、账号／角色／主体切换、404 与删除保留态的隐私边界；
- 同 scope 的网络／500／503／坏合同刷新失败保留只读旧详情及错误；详情 404 立即清空整份旧详情并保留错误；跨主体绝不保留。

映射和组件测试覆盖：

- candidate／recruiter viewer 下左右代理映射互换正确；
- 可见 Q/A 只有正文／状态与本地 `HH:mm`，没有技术标签；
- 三种未回答文案精确且没有伪造正文／输入框；
- 稳定 key 与整包更新不产生重复；
- 候选显示初评与全部逐轮复评，招聘不渲染总结区域；
- 新数据不覆盖旧步骤码、checklist、动作、附件、叮嘱或人工回答入口；
- Mock 原有调用和可见行为不变。

时间测试固定 UTC 与 Asia/Shanghai；合同层拒绝非 Z 时间，渲染层验证本地 `HH:mm`，不能以当前页面读取时间作为断言来源。

### 9.3 实施期命令

Plan 应按实际文件冻结精确的定向测试命令。实现收尾至少执行：

```text
npm test -- <本任务修改或新增的精确测试文件>
npm test
npm run typecheck
npm run lint
npm run build
```

规划阶段不把尚未运行的命令记录为 PASS。

## 10. 真实双端 dogfood

实现完成后从 `docs/dogfood/真实后端行为验收.md` 进入，并使用仓库规定的 agent-browser 流程。验收前先记录实际运行的前端、BFF 与 Recruitment SHA，确认两层后端均已部署展开合同。

使用真实双角色 Case 验证：

1. S0 question 先出现，后续 answer 与 reevaluation 通过轮询逐步出现；
2. 同一 Case 两端问答内容与时间一致，左右“我方／对方”映射正确；
3. 候选人有初评／复评，招聘方无私有总结或占位；
4. 人工补充事实仍可正常提交，且不被标成 Agent Q/A；
5. 进入 S1 后仍可回看 S0；
6. ended／completed Case 可从历史重新打开；
7. 刷新、角色切换和失败重试不重复、不串号；
8. 简历附件、叮嘱、协调和意向确认动作无回归。

保存关键页面截图，并为验收报告写一句 before vs after。真实模型可能零轮问答即结束，不能为通过验收伪造对话；无法自然触发的多轮或未回答状态使用项目授权 fixture 单独验证，并明确标记为 fixture 证据，不能冒充真实模型证据。环境未部署、无双角色账号或无可用 Case 时记录 `BLOCKED` 与精确阻塞项，不宣称完整通过。

## 11. 发布、回滚与错误边界

发布顺序保持：Recruitment 支持合同 → BFF 支持合同 → 前端启用 include。前端启用前需要用运行版本和一次展开请求确认后端能力，不能只引用合入记录。

回滚顺序相反：先停止前端消费新合同，再回退 BFF／Recruitment。前端不增加运行时开关、静默兼容模式或无 include 重试；当前只有一个冻结发布顺序，没有证据为此建立通用 feature flag 或 include 管理系统。

include 空值、重复、未知值导致的 400，非参与方／不存在 Case 的 404，Recruitment 数据完整性 500，以及 BFF 下游解码／语义错误映射的 503 都沿用现有错误展示与会话规则；其中详情 404 的快照处置以第 5 节为准，必须清空旧详情。它们均不得转换成正常空记录。

## 12. 非目标、延期与重新考虑条件

本任务不包含：

- 修改后端接口、公开合同、端点或状态机；
- S1／S2／S3 的新增过程记录；
- JD／在线简历详情 Tab 的资料投影；
- 自由聊天、日报、漏斗、快捷执行或独立消息存储；
- 修改 Mock 数据、文案、CSS、布局或新建聊天组件；
- 市场／推荐委托卡片改造；
- 浏览器翻译、prompt／task payload／私有规则披露；
- 自动替任何一方确认意向；
- 重复实现候选 PDF 入口或发布岗位选择等已合入修复；
- 新请求框架、轮询系统、通用 include 注册机制或双模式缓存。

只有 PM 明确固定检查维度、结果状态和展示规则，且后端提供 Case 级、历史稳定、双角色权限明确的结构化 checks 后，才重新设计丰富 S0 checklist。只有出现第二个真实 include 消费者或独立分页需求后，才考虑通用 include／资源抽象。仅凭未来可能需要，不在本次 Plan 或实现中预留架构。

## 13. 完成定义

只有同时满足以下条件，才可声明完成：

- 所有详情读取链路均携带唯一的 `include=screening_records`；
- 新字段及跨记录规则严格解码并进入同一权威详情快照；
- 双端按 Mock 既有阶段结构展示真实 S0 Q/A，候选展示全部初评／复评；
- Q/A 可见内容与时间格式对齐 Mock，稳定 ID 保证轮询不重复；
- 候选私有总结、账号／角色切换和删除保留态的隐私边界成立；
- 轮询、历史回看、人工补充问题、附件与既有动作不回归；
- 合同、状态、映射、组件测试及 `test`／`typecheck`／`lint`／`build` 通过；
- 完成真实双端浏览器验收，或明确列出尚未完成的 `BLOCKED` 项；
- 记录前后端运行 SHA、测试结果、截图路径、before vs after 与 fixture／真实证据边界。

完成后只可关闭旧对照报告 AT-01 的“S0 真实问答与候选人总结未展示”部分；不得据此关闭 S1／S2 过程内容、完整资料披露、英文输出或 Agent 自由聊天工作台等独立问题。

本 Spec 经用户明确批准后，planning owner 才编写零上下文实施 Plan；当前阶段不修改产品代码、不发布、不部署。
