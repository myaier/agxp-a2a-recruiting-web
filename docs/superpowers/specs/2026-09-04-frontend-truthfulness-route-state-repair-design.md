# 前端真实性、角色路由与状态修复设计

**日期：** 2026-09-04

**状态：** 已获用户书面批准

**目标仓库：** `myaier/agxp-a2a-recruiting-web`

**前端基线：** `origin/main@4ba7c525b864c6293a9ae01c7b2c819906e05e47`

**后端兼容性核验：**

- 规划分支：`agxp-monorepo assess/recruitment-backend-four-packs@82d61714c`
- Plan 01/02 当前组合候选：`integration/recruitment-backend-contracts-20260903@aa150811d`
- Plan 03 当前执行候选：`exec/recruitment-backend-contracts-03-agent-20260904@34b7212fd`

本文把已完成的前端代码走查收成一份可执行设计。目标不是补齐尚未存在的产品能力，而是让 Backend 模式只展示已有权威事实、已允许动作或明确的不可用状态，同时保持 Mock 原型行为。

## 1. 背景与问题

当前前端已经接入会话、简历、岗位、MatchCase、真人会话、Agent 设置和 P8 等后端合同，但仍有若干旧原型路径穿透到 Backend 模式：

1. 单角色账号可以挂载对侧业务屏；
2. 原型直聊、A2A 往来和初筛日志在 Backend 仍读取 fixture，并以本地 state/定时器伪造发送成功；
3. 部分合法后端快照被 decoder 拒绝，或加载失败被表现为空数据；
4. 设置、帮助和“我的”页展示没有合同支持的求职状态、客服、许可证或 Agent 在线状态；
5. 简历完整度、工作年限、岗位无要求和 MatchCase 动作文案把本地推断包装成权威事实；
6. 5xx 和未知 4xx 可能把原始后端英文文本展示给终端用户。

这些问题不需要新增后端路由、字段、迁移、Agent runtime 或视觉方案。修复应停留在现有路由、数据源、operation/state、strict decoder 和页面展示层。

## 2. 后端三份 Plan 的兼容性结论

后端未合入分支包含三份 Plan。本批前端设计与它们没有产品或合同冲突，但必须冻结以下边界，避免实施时抢跑。

### 2.1 Plan 01：开放结束日期与 MatchCase 精确统计

后端将新增：

```text
GET /api/v1/me/match-cases/summary
GET /api/v1/recruiter/match-cases/summary
```

结果是五个严格、非负的 `int64` 计数：

```text
open_total
open_anonymous_screening_total
open_needs_action_total
ended_total
completed_total
```

该 Plan 明确不扩宽旧 `{items,next_cursor}` list/history 响应，也不修改前端。当前前端已有的 `N/N+/0/—` 过渡统计和 owner/session fence 必须保留；本批不新增 summary DTO、数据源、operation 或页面接线。

本批对“我的”页只删除“在线”“并行寻访”等无合同断言，不改当前 MatchCase 统计来源、分页恢复或计数口径。后续只有在上述 summary 合同正式合入并产生独立前端 Handoff 后，才替换过渡统计。

同一 Plan 还会修复简历 parser 对“至今/current/present”的处理。该改动只影响经历/教育的 `end_month`，不改变公开简历合同。本批 E1 只修 `work_start_year → 工作年限` 的前端派生，不解析或改写经历结束月份，因此互不重叠。

### 2.2 Plan 02：候选人实名认证

后端将新增 candidate-owned 实名 aggregate 和 owner API，但明确：

- 不更新全局 identity；
- 不投影到 recruiter `personal_verification_status`；
- 不自动覆盖在线简历 `real_name`；
- 不改变 MatchCase、发现推荐、身份披露和岗位卡；
- reviewer API 不进入公共 BFF。

本批继续执行既有去重边界：不接入实名 summary、申请、上传、取消、历史或 reviewer 流程，不新增 DTO、decoder、operation、页面或 CTA。Backend 设置页中候选实名状态继续保持中性不可推断；不得从 OTP、简历姓名或招聘身份推导候选实名。

后端身份路由是 candidate-only，反而进一步证明工作包 A 的前端角色路由边界有必要；但前端边界不把未合入的实名路由纳入本批。

### 2.3 Plan 03：Hosted Agent 规则解释成功链路

该 Plan 修复模型看到的 Agent control clause schema，使合法双端规则可以完成 `create → ready → accept → persist → restart-read`。它明确保持既有公开 Mobile/BFF proposal/rule 合同，不改 P4/P5/P6 failure enum、DTO、OpenAPI 或前端。

因此：

- C1 的 Agent 授权设置 nullable `updated_at` 修复仍按当前公开合同实施；
- C6 仍必须删除“Agent 在线/正在并行寻访”，因为 Plan 03 没有发布 runtime presence/status 合同；
- Backend 帮助页仍不能声称存在 Agent 自由聊天；Plan 03 只提供规则解释任务；
- 本批不得改 Hosted failure CTA、重试、恢复、proposal failure 或模型策略。

### 2.4 从后端确认的 MatchCase 展示闭词

后端详情中的 stage `summary` 是阶段最后一个 step word；checklist `label` 是服务端构造的闭词。公开 OpenAPI 目前仍把两者声明为 `string`，所以前端 decoder 不能擅自收紧成 enum，但展示层可以且应当使用下列已确认词表。

阶段 step 共 17 个：

```text
policy_check
candidate_evaluation
candidate_question
recruiter_answer
candidate_reevaluation
human_decision
complete
awaiting_candidate_resume_invitation
awaiting_resume_parse
screening_resume
awaiting_recruiter_decision
coordinating
awaiting_candidate_decision
awaiting_confirmations
awaiting_candidate_confirmation
awaiting_recruiter_confirmation
handoff_pending
```

checklist label 共 8 个：

```text
anonymous_screening_passed
resume_bound
resume_parse_ready
resume_disclosed
resume_screened
differences_resolved
candidate_confirmed
recruiter_confirmed
```

未知字符串不得原样显示。它们也不得改变状态、阶段、按钮或 mutation 判定。

## 3. 目标与成功标准

完成后：

1. Backend 初始化完成后，错误角色的业务页面不会挂载；双 active 账号不会因 URL 被静默切身份；
2. Backend 的原型消息、往来和初筛深链不读取或展示 fixture，不创建假写入交互或 timer；
3. 合法的 Agent 设置初始快照 `revision=0, updated_at=null` 可读取和保存；
4. 求职状态、接触记录、账户时间、反馈、帮助和“我的”页只展示权威事实或中性状态；
5. 简历完整度、工作年限和岗位对齐不制造不存在的事实、要求或操作入口；
6. MatchCase 每个可见按钮都对应当前角色、状态和 `available_actions` 的合法交集；阶段闭词不会泄漏到 DOM；
7. 5xx、`internal_error` 和未知 BFF 4xx 不泄漏原始 message；
8. Mock 路由、fixture 和原型交互保持原样；
9. 实现不修改 CSS、布局骨架或 className，不新增 React 组件/组件文件。

### 3.1 PM 视觉冻结硬约束

本批是数据真实性与行为修复，不是视觉迭代。所有实现必须同时满足：

- 不修改任何 `.css` / `.module.css` 文件、CSS 变量、className 组合或内联布局样式；
- 不改变现有页面的布局骨架、区块顺序、导航结构或信息层级；
- 不新增 React 组件、组件文件或通用 UI 抽象；
- 只允许在现有组件与现有布局槽位内，按 Backend/Mock 条件切换文案、数据、可见性、禁用态和已有动作；
- 真实性要求必须隐藏原型内容时，保留页面既有壳和内容容器，用最小中性文本替换原槽位内容，不另造卡片、弹层、空态组件或 CTA 样式。

测试除业务断言外，应冻结关键既有容器/导航仍存在，并检查实际 diff 不含样式文件或新增组件文件。若某项修复确实需要新布局或组件，停止该项并转交 PM 设计，不得在本批自行决定。

## 4. 设计原则与最小架构

本批采用四个现有边界内的窄模式，不建立新的“真实性框架”。

### 4.1 集中式角色路由分类

在 `src/应用.tsx` 内维护 candidate-only、recruiter-only 和 shared route pattern 三组元数据，并用纯函数根据 `pathname` 分类。Backend 初始化完成且已登录后，在 `<Routes>` 挂载前同步执行角色判定。

不在每个页面增加 effect，不从路径推导并写入 `last_used_role`，不把角色守卫下沉到数据源。

### 4.2 单组件内的模式 gate

不得通过新增 Backend/Mock 子组件完成分流。会读取 fixture、创建消息 state 或启动 timer 的现有页面采用：

```text
现有页面组件（hooks 顺序不变）
├─ Backend：fixture 变量为 null、局部集合为空、effect/timer 立即退出
└─ Mock：按现有 fixture 初始化并保留原交互
```

所有 hooks 仍无条件、同顺序调用；fixture 查找必须受 `数据源模式 === 'mock'` 的同步条件保护，`useState` 的 lazy initializer 在 Backend 只产生 `null`/空集合，不能复制 fixture。effect 开头以 Backend gate 退出并负责清理既有 timer。完成 hooks 后，在现有 JSX 骨架内选择 Backend 中性内容或 Mock 原内容。模式切换测试必须证明旧 Mock state 不进入 Backend DOM，并在切回 Mock 时按既有 fixture 重新初始化。

每个页面复用自身现有壳、内容容器和样式，不新增组件或 class，不改变现有布局层级；不抽取跨页“不可用页”组件。

### 4.3 权威快照 gate 与纯展示映射

已有后端资源继续经过 data source、operation/state 和 owner/session/role fence。页面只补以下纯投影：

- nullable 时间 decoder；
- 本地绝对时间 formatter；
- 权威身份到求职状态文案；
- 简历完整度分类；
- MatchCase step/checklist 文案；
- 岗位“无约束”到 nullable 对齐条件。

展示映射不反向参与服务端状态或动作判定。

### 4.4 不新增基础设施

本批不新增 Context、React 组件、组件文件、缓存、持久化、通用路由 registry、日期库、客服系统、日志管道、API client 层或 CSS；不调整 DOM 布局骨架、区块顺序、className 或内联布局样式。错误对象中已有原始 message 可继续供开发者在调试器中检查；本批只阻止它进入用户文案，不另建“诊断通道”。

## 5. 工作包 A：真实角色路由边界

### 5.1 分类

shared route 至少包括：

- `/`；
- `/identity`；
- `/account`；
- `/feedback`；
- `/terms`；
- `/help`；
- `/company/:id`。

`/visitors` 是 candidate-only；`/settings` 与 `/hr/settings` 分别属于候选和招聘。候选 onboarding、候选主壳及其次级页属于 candidate-only；招聘 onboarding/恢复、招聘主壳和全部 `/hr/...` 业务页，以及 `/hr-init` 属于 recruiter-only。

路由元数据必须使用当前 `路径` 常量和模板，动态段用 `matchPath` 或等价的精确匹配，不用脆弱的字符串包含判断。未知路径仍交给现有 `*` fallback，不在角色分类器中猜成候选或招聘。

### 5.2 判定

角色路由满足两个条件：

1. `主体.last_used_role` 等于目标角色；
2. `主体.roles` 中同角色状态为 `active`。

不满足时：

- 双 active 且当前角色是对侧：replace 到现有显式切身份路径；
- 只拥有对侧 active、目标角色 suspended、目标角色未知或当前角色未知：replace 到 `/identity`，由现有身份选择/开通恢复路径解释；
- 不调用 `操作.切身份`，不修改 `last_used_role`。

角色守卫在招聘组织恢复逻辑之前执行。只有已经通过 recruiter role guard 的请求才进入现有招聘档案缺失、组织水合失败和恢复白名单判定。Mock 完全跳过此守卫。

### 5.3 防闪挂与历史

初始化进行中继续显示 `路由加载中`。初始化完成后，拒绝结果在 `<Routes>` 之前同步返回 `<Navigate replace>` 或现有中性切换面，因此错误业务组件和其 effect 不得挂载一次。

被拒路由使用 replace，浏览器后退不会重新落回刚被拒绝的旧格。测试以屏幕桩的 mount 记录证明，而不是只断言最终 URL。

## 6. 工作包 B：Backend 原型消息与初筛 fail closed

涉及：

- `直聊会话.tsx`
- `往来记录.tsx`
- `企业往来记录.tsx`
- `初筛记录.tsx`
- `初筛对话.tsx`

Backend 分支规则：

1. 不调用 `取直聊对象`、`市场列表`、`我的信息`、`模拟数据` 或 `企业端模拟数据`；
2. 不创建本地消息、输入、叮嘱、回执或提交成功 state；
3. 不启动延迟回执 timer；
4. 不显示姓名、公司、岗位、联系方式、静态对话、输入框、发送按钮或“记成规则”；
5. 无效 ID 与真实但无 transcript 合同的 case ID 都只显示同一个安全不可用状态，不回退首条 fixture。

直聊说明用户当前没有直接聊天能力，并提示从已建立的 MatchCase 进入真人会话。直聊 URL 中的 `:id` 当前是岗位坐标，不能转换成 Case ID，因此不提供猜测式详情跳转。

双端往来记录的 `:id` 是 Case ID，可以分别导航到候选或招聘 MatchCase 详情，但页面仍不展示完整 transcript。初筛日志只说明原型日志没有权威数据源。

Mock 分支保留当前 fixture 查找、无效 ID 兜底、输入和 timer 行为；不得为分流新增 Mock/Backend 子组件。

## 7. 工作包 C：设置、账户与“我的”真实性

### 7.1 Agent 设置 nullable 初始快照

将 `BFF候选Agent设置.updated_at` 和 `BFF招聘Agent设置.updated_at` 改为 `string | null`。该合同已由后端公开 OpenAPI 确认：`revision=0` 的合成默认视图返回 `updated_at:null`。

decoder：

- `null` 合法；
- 非 null 必须是严格 RFC3339；
- 非字符串类型、非法日期分量、未知字段和额外字段继续 `invalid_response`；
- 不把 null 替换为浏览器当前时间。

只修改 Agent 设置自己的 decoder，不顺便统一全仓时间解析器。

### 7.2 求职意向页状态

Mock 保留当前三档本地循环。

Backend 从已水合的权威简历快照和 `状态.基本信息.身份` 投影：

```text
在校 → 在校 · 看机会
在职 → 在职 · 保密求职中
离职 → 离职 · 随时到岗
```

`后端状态.简历快照 === null` 时显示 `—` 或加载中，不读取初始化用的本地默认身份。Backend 行不可点击，不创建本地轮转，也不新增 intention PATCH 字段。

### 7.3 接触记录状态

保留现有 operation、分页、single-flight、owner/session/role fence。页面按当前 owner 显示：

- `进行中`：中性加载态；
- `失败`：已有安全错误文案和重试按钮；
- 当前 owner `成功 + items=[]`：权威空态；
- 当前 owner `成功 + items>0`：业务列表；
- owner 不匹配、未开始或角色不符：不显示旧业务行，显示中性等待/不可用状态。

重试调用已有 `操作.加载接触记录(true)`，不重建数据源。已有成功窗口的 refresh error 继续保留只读列表和错误提示，不把旧成功快照降级为空。

### 7.4 账户本地时间

在 `账号安全.tsx` 内提供可测试纯 formatter：输入 RFC3339，生产默认使用浏览器本地时区，测试可显式传 `timeZone`。

输出统一为 `YYYY-MM-DD HH:mm`；非法值返回 `—`。会话创建、失效和数据导出到期时间全部调用同一个 formatter。无需引入日期库，也不从 `接触记录.tsx` 导入页面内部函数。

### 7.5 产品反馈

Backend 可见分类闭合为：

```text
功能异常 → bug
体验建议 → suggestion
其他     → other
```

默认“功能异常”。可见分类、placeholder、可提交判断和 payload 必须从同一闭合表派生。表单分类附近持久显示“举报需从具体岗位、谈判或真人会话发起”；Backend DOM 不出现两个举报分类，也不存在无目标举报分支。

失败保留分类和正文，成功只使用服务端 ticket ID。Backend 返回栏和设置入口使用“产品反馈”；Mock 保留“反馈与举报”、五分类、本地成功和原型文案。

### 7.6 帮助、设置和双端“我的”

Backend 帮助页不读取 Mock `常见问答`。页面内维护两份最小、角色正确、只描述现有功能边界的 FAQ；招聘 FAQ 不出现候选隐私问题。Agent 功能按钮按当前角色分别进入 `/agent` 或 `/hr/agent`。

Backend 删除或替换为明确不可用的：

- 占位热线和工作时间；
- 人力资源服务许可证、资质证照等未确认文本；
- “转人工客服”本地 Toast 和可点击按钮；
- 无权威来源的版本/原型运营文本。

候选和招聘“我的”页都移除在线绿点与“在线”断言。候选保留当前已接线的真实/过渡 MatchCase 数字，招聘保留权威 `N 个在招岗位`；规则数继续服从既有水合 gate。不得因为 Hosted Agent Plan 03 成功就推断 runtime 当前在线。

Mock FAQ、客服卡、原型页脚和 Agent 在线演示保持原样。

## 8. 工作包 D：岗位入口与安全错误

### 8.1 删除重复归档岗位入口

招聘“我的”保留“岗位管理”，删除指向同一 `/hr/jobs` 的“归档岗位”宫格。岗位管理页现有“已归档”分组及发布、归档、重开、删除行为不变。

本批不新增 `?view=archived`、route state、fragment、自动滚动或专用空态。只有后续行为数据或明确产品需求证明“一键只看归档岗位”是独立场景时，才重新设计该入口。

### 8.2 全局错误文案

`取后端错误文案()` 按以下顺序收口：

1. `客户端校验错误`：显示本地已审核文案；
2. 非 `BFF错误`：`请求失败，请稍后再试`；
3. `network_error`：保留当前网络文案；
4. 任意 5xx 或 `internal_error`：中文安全通用文案；
5. `invalid_response`、`invalid_session`、`invalid_origin`、`version_conflict`、`validation_failed`：保留当前闭合映射；
6. status 0 的本地 `invalid_request`：可保留本地铸造的可行动文案；
7. 其它未知 BFF 4xx：`请求失败，请稍后再试`。

领域模块已有更窄的闭合错误映射可以继续先行返回具体文案。原始 `BFF错误.message` 不再作为全局 UI fallback。

## 9. 工作包 E：简历事实与完整度

### 9.1 工作年限

修正并复用 `折算工作年限()`：

- 空、非有限数、非整数、非正数、未来年份返回 `null`；
- 当前年返回 0；
- 正常过去年份返回当前年减开始年；
- 接受可选 `currentYear` 参数供确定性测试，生产缺省取当前年。

“我的简历”中：

- 在校身份继续显示既有学生文案；
- 非学生且函数返回 null 时显示“未填写”；
- 合法年份显示年限和真实开始年；
- 不用当前年补文本。

岗位匹配与简历页使用同一函数语义。

### 9.2 资料完整度

抽出页面内可测试纯函数，输入现有简历切片，输出：

```ts
{
  待补全: 完整度项[];
  可提升: 完整度项[];
}
```

Backend 标题为“资料完整度检查”，不出现“AI代理诊断”。规则：

- 姓名缺失：待补全；
- 非在校且开始工作年无效：待补全；
- 非在校且零工作经历：待补全；
- 已有工作经历但内容为空：待补全；
- 零教育经历：待补全；
- 零技能：待补全，不设置至少五项阈值；
- 全部经历都无项目且至少有一段经历：可提升；
- 零证书：可提升，不增加待补全计数；
- 学生是否豁免工作年/工作经历只认 `基本信息.身份 === '在校'`。

页面用现有结构分别标明待补全与可提升，不新增 CSS。Mock 可继续使用原型标题和原型建议口径，但两种模式不得共用会让 Backend 恢复五技能阈值的计数。

## 10. 工作包 F：MatchCase 动作与闭词

### 10.1 `end_screening`

候选端 `end_screening` 只渲染“结束初筛”及现有确认流程。删除其中调用 `决定S0(caseId, 'continue')` 的“继续初筛”。招聘端没有对应写路径时继续零按钮。

按钮可见性始终是：

```text
当前角色实现的服务端命令 ∩ detail.available_actions ∩ 合法状态矩阵
```

不能从 stage summary、needs_user、其它动作卡或对侧能力推导按钮。

### 10.2 阶段摘要和 checklist

阶段 summary：

- 命中 17 个已知 step 时复用/扩充 `步骤说明表`；
- 空字符串使用阶段状态对应的中性文案；
- 未知非空字符串显示不含原 token 的“阶段信息待更新”；
- 不修改 decoder、状态或动作。

checklist label 使用 8 项闭合展示表。未知 label 不显示原文；可省略该项，或显示统一“核对项状态已更新”，但同一实现只能选一种并由测试冻结。推荐省略未知项，避免多条不可区分的伪清单。

`candidate_question` 映射为“候选方 AI 正在生成补充问题”。只有合法 `human_decision + respond_fact` 才渲染人类补充事实 UI。

### 10.3 回答事实 in-flight

增加独立可渲染状态 `回答提交中`，不复用 S1/S2/S3 的 `写中`：

- 发请求前同步锁 ref 并设为 true；
- pending 时 textarea 和按钮禁用，按钮显示“提交中…”；
- 第二次触发零额外请求；
- 成功后清草稿；
- 失败保留草稿并恢复输入；
- 不本地推进 Case，仍等待权威重读。

## 11. 工作包 G：岗位“无要求”语义

当前 BFF 合同中的经验和学历不是开放字符串，而是 strict enum：

```text
experience_requirement:
none | one_to_three_years | three_to_five_years | five_plus_years | ten_plus_years

education_requirement:
none | associate | bachelor | master | doctorate
```

因此实现必须保持当前 decoder fail closed；不得增加“未知字符串原样透传”的运行时能力。现有映射测试中通过类型逃逸构造的未知值不代表公开合同，相关断言应校正为 strict decoder 边界。

页面投影分成展示和对齐两种语义：

- 市场卡仍可把 `none` 展示为“不限”；
- `P4岗位事实.经验要求/学历要求` 改为 `string | null`，`none → null`；
- Backend 职位详情的对齐生成器读取 `岗位事实`，不再读取卡片中的“不限”；
- nullable 约束不生成经验/学历核对行；
- 事实区可以省略 null 项，不把它描述成简历缺失。

通用 `求职匹配分析()` 对“未提及”只说“简历未提及”，删除“在下方告诉代理即可补上”。Mock 的旗舰岗位手工分析表可保留既有原型文案；Backend 不得走该手工表。

不从自由文本 JD 推断新硬条件，不改变 wire enum、适配分来源或 `structured_requirements_confirmed` gate。

## 12. 数据流与错误处理

### 12.1 Backend 读取

```text
BFF → strict decoder → data source → operation owner/session fence
    → 后端状态阶段/快照 → 页面 gate → 纯展示映射
```

任何一层失败都不得转入 Mock、localStorage、静态数组或局部成功态。

### 12.2 Backend 写入

```text
available_actions / 闭合 UI 分类
    → 现有 operation 单飞与幂等语义
    → 服务端成功
    → 权威重读/快照提交
```

页面 pending state 只负责可见锁定，不充当服务端结果。失败保留用户草稿或输入；成功才清理。

### 12.3 数据源模式切换

模式切换后不能沿用另一模式的局部选择、消息或成功态。所有页面都在现有组件内保持 hooks 顺序，以条件化 lazy initializer、effect gate 和派生视图实现；不得新增外层、Backend 或 Mock 子组件。测试应覆盖 rerender 切换，防止 Backend 短暂出现 Mock 内容。

## 13. 测试设计

所有工作包遵循测试先行。优先测试纯函数和页面边界，不复制 operation 已有并发/fence 覆盖。

### 13.1 路由

在 `src/应用.test.tsx` 增加表驱动矩阵：

- candidate-only、recruiter-only、双 active、suspended、未知角色；
- candidate-only、recruiter-only、shared、未知 route；
- 深链、刷新、replace、后退；
- 被拒页面 mount 次数为 0；
- 双角色不调用切身份 mutation；
- 招聘档案缺失、组织失败和恢复白名单不回归；
- Mock 路由保持原样。

### 13.2 原型隔离

补充或新增五类页面测试。Backend 对每条深链断言：

- 无 fixture 人名、公司、岗位、联系方式和对话；
- 无 textarea、发送、叮嘱和“记成规则”；
- 无相关 mutation；
- fake timer 推进后 DOM 不变化；
- 真实/无效 ID 均不回退首项。

Mock 断言原型仍可渲染和交互。

### 13.3 设置与账户

- candidate/recruiter Agent 设置：null 初始、合法时间、非法类型/日历时间、额外字段、保存；
- 求职状态：三种身份、未水合、Backend 点击不变、Mock 循环；
- 接触记录：loading、503、decoder error、成功空/非空、owner 切换、retry；
- 时间：UTC+8 跨日、`America/New_York` 夏令时、非法值、会话与导出同口径；
- 反馈：Backend 三分类和 payload、无举报 DOM/请求、失败保留输入、Mock 五分类；
- FAQ：两角色不串内容，Backend 无热线/许可证/人工客服按钮，Agent 路由正确；
- 双端“我的”：Backend 无在线断言，真实/过渡计数和规则水合 gate 不回归；
- 归档入口：只剩一个岗位管理入口，岗位 CRUD 测试保持通过。

### 13.4 简历、MatchCase 与岗位

- `折算工作年限`：空、非法、小数、未来、当前年、正常年份；
- 完整度纯函数：身份 × 经历数量/内容 × 证书 × 技能的表驱动矩阵；
- MatchCase：17 个 step、8 个 checklist label、空值、未知值，DOM 无原 token；
- `respond_fact + end_screening` 时没有继续按钮；招聘端无借用动作；
- 回答事实 pending/resolve/reject/重复点击；
- 经验/学历 none 的四种组合；真实约束有证据、未提及、不满足三态；
- Backend 分析无不存在的“下方代理”操作，Mock 旗舰分析不回归。

## 14. 实施拆分与冲突控制

建议按以下七个独立提交实施，每个提交包含对应测试：

1. 角色路由 boundary；
2. Backend 原型消息/往来/初筛隔离；
3. Agent 设置 nullable、接触记录状态、账户时间和全局错误；
4. 求职状态、反馈、帮助、双端“我的”和归档入口；
5. 简历年限与完整度；
6. MatchCase 动作、闭词和回答 pending；
7. 岗位无要求与对齐文案。

实施开始前再次 fetch 前后端目标分支：

- 前端以届时最新 `origin/main` 为实际实现基线；
- 若后端三 Plan 尚未合入，仍不得在本批提前接入；
- 若已合入，只复核合同未漂移，本批去重边界不自动扩大；
- 若其它前端分支已修改 session/subject/role fence、strict decoder、single-flight 或 Mock/Backend 分支，按较新实现逐项合并，不覆盖。

本批不需要多 worktree 基础设施或跨包重构。共享大文件冲突通过提交顺序解决。

## 15. 验收

实现完成后至少运行：

```bash
npm run typecheck
npm run lint
npx vitest run \
  src/应用.test.tsx \
  src/屏幕/直聊会话.test.tsx \
  src/屏幕/往来记录.test.tsx \
  src/屏幕/企业往来记录.test.tsx \
  src/屏幕/初筛记录.test.tsx \
  src/屏幕/初筛对话.test.tsx \
  src/数据/招聘数据源/Agent设置.test.ts \
  src/屏幕/求职意向管理.test.tsx \
  src/屏幕/接触记录.test.tsx \
  src/屏幕/账号安全.test.tsx \
  src/屏幕/反馈.test.tsx \
  src/屏幕/帮助与客服.test.tsx \
  src/屏幕/设置.test.tsx \
  src/屏幕/我的.test.tsx \
  src/屏幕/企业我的.test.tsx \
  src/屏幕/我的简历.test.tsx \
  src/屏幕/岗位管理.test.tsx \
  src/屏幕/P5/MatchCase详情.test.tsx \
  src/数据/MatchCase展示映射.test.ts \
  src/数据/发现推荐映射.test.ts \
  src/数据/匹配对齐.test.ts \
  src/屏幕/职位详情.test.tsx \
  src/数据/HTTP客户端.test.ts
npm run build
```

不存在的测试文件在对应工作包中创建。测试文件名可按最终纯函数落点微调，但覆盖语义不得删除。

Backend 最小手测：

1. candidate-only、recruiter-only、双 active 和 suspended 账号深链双方页面；
2. 打开五类原型消息/初筛深链；
3. 读取两端 Agent 设置初始 null 时间；
4. 检查三种求职身份、接触失败/重试、跨时区账户时间和三类产品反馈；
5. 检查双角色 FAQ、双端“我的”状态和招聘岗位入口；
6. 检查 `respond_fact + end_screening`、未知 stage/checklist token 和回答 pending；
7. 检查未填工作年、学生/非学生完整度和经验/学历 `none`。

Mock 回归同时确认 fixture、五类反馈、原型客服和消息交互未被 Backend 修复影响。

## 16. 非目标与延后条件

本批不做：

- JD 上传、解析或岗位预填；
- Hosted Agent failure contract 或成功链路前端接线；
- 候选实名认证 UI；
- 新 MatchCase summary endpoint 接线；
- 精确 MatchCase rich summary、完整 A2A transcript 或 Agent 自由聊天；
- 联系方式披露合同；
- 简历 PDF 解析质量、经历“至今”解析或真实 provider 调整；
- 客服系统、运营配置、许可证/法务文案、CSS、布局或视觉重画；
- 公司福利与作息空卡的产品取舍；
- 通用路由、时间、错误、不可用页或诊断基础设施。

只有出现以下证据才重新考虑延后能力：

- 后端 summary/identity 合同正式合入并产生独立前端接入 Handoff；
- PM 明确批准新组件/布局，且第二批页面需要完全相同的不可用视图与行为，才重新考虑共享组件；
- 产品明确保留“一键只看归档岗位”且有独立使用价值，才增加 query/route state；
- 后端将 stage summary/checklist 正式收成 OpenAPI enum，才收紧 decoder 类型；
- 至少第二个页面需要同一可配置时间格式 API，才抽共享时间模块。

## 17. 完成定义

1. A–G 的必测项全部由自动化测试覆盖；
2. Backend 不挂载错误角色屏、不渲染 Mock 业务事实、不产生本地假成功；
3. 所有用户可见动作都来自当前角色可执行命令与 `available_actions` 的交集；
4. 所有失败、未加载、未知 token 和无约束场景都显示安全中文或中性状态；
5. Mock 行为保持；
6. 后端三 Plan 的 summary、candidate verification 和 Hosted Agent 边界未被提前接入或重定义；
7. typecheck、lint、定向 Vitest 和 build 全部通过；
8. 实际 diff 不包含 API、迁移、CSS、className/内联布局改动、无关重构、新增 React 组件/组件文件或其它基础设施。
