# S0–S3 历史代谈与详情展示统一 Spec

日期：2026-09-16。流程：development-workflow 阶段一（Brainstorming / Spec）。
状态：产品合同已获用户批准；本轮只编写 Plan、进行文档 review 和生成执行提示词，未实施。

## 1. 目标、范围与证据

以当前 Mock Up 的布局、组件、间距和阅读顺序为视觉基准，Backend 与 Mock 共用一套展示，只分别提供数据、状态和动作回调。改动覆盖：

1. 求职与招聘两端历史代谈列表。
2. 求职与招聘详情中的 S0–S3 代谈进度，包括初评、问答、复评、阶段结果和动作位置。
3. 求职在谈详情的职位详情 Tab。
4. 招聘在谈详情的在线简历 Tab。

包含这些页面共用的顶栏、Tab 初始定位和必要缺失态。不改变业务 API/状态机，不要求所有数据源拥有相同内容，不用演示数据填补真实数据。

### 1.1 核查基线

- 前端仓库 `agxp-a2a-recruiting-web`：`e01291de47e4ade2b66ab681e69145e6e32bade8`。
- 后端参考仓库 `agxp-monorepo`：`4f75b8fc890d3e33cbd23a006779c70844b87712`，本轮只读参考，其仓库相对路径在下文以“后端：”标明。
- 输入证据：用户提供的三张进度截图及完整候选侧 negotiation 响应。Spec 不保存其中私人 ID、简历文件名或完整个人资料；测试使用等价去标识化样本。
- 本轮是源码核查，未启动浏览器复现、未连接实际后端、未执行产品测试。源码版本不是截图环境版本证明。

### 1.2 源码索引

| 区域 | 前端权威入口 | 后端合同证据 |
| --- | --- | --- |
| 历史列表 | `src/屏幕/归档谈判.tsx`、`企业归档.tsx`、`P5/MatchCase历史.tsx`；`src/数据/招聘数据源/连续代谈.ts`、`MatchCase.ts` | 后端：`apps/recruitment/internal/discovery/negotiations.go`；`apps/recruitment/internal/matchcase/workspace.go`；`apps/recruitment-bff/internal/recruitmentclient/matchcase_workspace.go` |
| 详情连接 | `src/屏幕/在谈详情.tsx`、`候选详情.tsx`、`详情控制/后端正常详情.tsx`、`use后端详情控制.ts` | 后端：`apps/recruitment/internal/matchcase/workspace.go` |
| 进度 | `src/组件/阶段对话流.tsx`、`src/数据/详情展示映射.ts`、`MatchCase展示映射.ts`、`连续代谈展示映射.ts` | 后端：`apps/recruitment/internal/candidateevaluation/types.go`、`precheck.go`；`apps/recruitment/internal/matchcase/lifecycle.go`、`continuity_deadlines.go`；`apps/recruitment/internal/store/migrations/000042_case_stage_continuity.up.sql` |
| 职位正文 | `src/组件/在谈详情/职位资料.tsx`、`职位资料.module.css`；`详情展示映射.ts::从冻结职位到资料` | 后端：`apps/recruitment/internal/job/display.go`；`apps/recruitment-bff/internal/recruitmentclient/display.go::SafeJobDetail` |
| 简历正文 | `src/组件/在谈详情/在线简历正文.tsx`、`类型.ts`；`src/数据/在线简历展示映射.ts`；`src/屏幕/匿名在线简历.tsx` 兼容包装 | 后端：`apps/recruitment/internal/privacy/candidate_resume.go`；`apps/recruitment/internal/matchcase/workspace.go::recruiterCaseCandidateResume` |

## 2. 当前差异与选择的最小方案

| 页面 | 已共用的内容 | 仍需修改 |
| --- | --- | --- |
| 历史列表 | 两个 Mock 页面复用归档卡 CSS；Backend 共用自身 P5 历史入口 | Mock 与 Backend 是独立页面壳/卡片 JSX：边距、说明条、结果标签、原因、阶段/时间均不同；提取 Mock 历史展示，Backend 接相同组件 |
| 代谈进度 | 详情外壳、阶段流、动作卡、底栏 | Backend 在阶段上方额外堆状态条/原始公开初评/终局，初评复评堆段底，终局码透出；改为阶段状态＋中文小结＋交错时间流 |
| 职位详情 | 已使用同一职位资料组件、相同 CSS | 有些已返回的安全字段未利用；空薪资直接拼分隔符；公司空字符串被误当缺失；修正局部投影和空值行为，不另建正文 |
| 在线简历 | 已使用同一正文 JSX、匿名简历 CSS | 正文仍接 Mock 档和 Backend 资料两种来源形状；有 Backend 资料却隐藏匹配区；招聘顶栏画像全 null；改为统一局部展示输入，缺失/授权决定内容 |

比较过的方案：

- **推荐：增量收敛已有展示。** 新增历史展示和小型灰色注释共用件，扩展阶段记录输入，将简历已有归一化前移。每个新增边界都有本轮两类实际消费者，减少现存重复。
- 仅统一 CSS：无法修复节点顺序、缺失区块、错误结果来源及重复内容，不满足目标。
- 重建完整详情框架/统一数据 provider：现有共享组件与控制 hooks 已存在，会扩大生命周期和权限回归风险，本轮不采用。

不建全局页面 schema、事件总线、通用表单引擎或缺失原因系统。保留现有控制/映射/展示三者边界，不为四页再加一套架构层。

## 3. 全局展示与数据合同

### 3.1 共用规则

- 同角色、同展示数据、同状态必须获得相同组件树、区块顺序和 CSS。mode 判断只在连接入口；共用展示不读 Context、fixture、raw DTO 或发请求。
- 来源允许提供不同文本、图片、权限和回调；不允许通过“整页 Backend JSX/整页 Mock JSX”槽绕过共享。
- 真实资料缺项保留对应区块或信息位置，合法空列表显示暂无；可选细节没有事实时可为空，不复制虚假项目/批注来追求等高。
- `null` 是未知/未提供，`[]` 是已读取但没有条目；0 是合法数值。空字符串是否为已知空按具体字段合同处理，不能全局统一转成缺失。
- 不把缺失、未授权、未披露、请求失败混成同一种状态。合同未给原因时用中性缺失；禁止以字段空值推断阶段或权限。
- 长文本可换行，320px/390px 不横向溢出、不遮按钮。用户可见静态文案、协议枚举用中文；用户或代理生成正文保留原文，不擅自翻译/截改事实。
- 底层解码仍严格；协议错误保留错误视图，不渲染部分不可信数据。

### 3.2 来源与刷新

- Backend 只消费该记录、该角色本次权威响应/同范围有效快照。Case 有效时使用 Case 冻结职位/简历，不补读当前 Job、本人简历或推荐分覆盖历史。
- pre-Case 使用自身 negotiation 的冻结职位；保留 retention 独立只读/不可用状态，不造四阶段完成事实。
- Mock 继续使用现有演示状态和 reducer，映射成相同展示类型，零 P5 请求。
- 同范围刷新失败保留旧内容、显示重试及原有只读保护；初次失败不是“全部字段缺失”。合法有值变空立即清旧内容/图片/回调。
- 切主体/角色/记录清草稿和弹层、丢弃迟到结果；同记录更新不重置手选 Tab 和阶段展开状态。

## 4. 历史代谈列表

### 4.1 统一外观

共用返回栏、说明条、滚动容器、历史卡和空态；视觉来自 Mock `我的功能页.module.css` 与 `企业归档.module.css`：内容 padding `14px 18px 24px`；卡 padding `13px 14px`，横向 gap `11px`，卡下 margin `10px`，字号/圆角沿用现有令牌。

卡片固定顺序：字标/媒体位 → 标题＋结果标签 → 职位 → 招聘侧画像 → 原因灰块 → 阶段说明＋时间＋“回看往来 ›”。公司/候选字段由角色适配，不让展示组件判断来源。

- 求职标题为公司；招聘标题保留当前历史页合法匿名别名，不以其字符推实名或头像字。
- Mock 可提供演示字标；Backend 有真实公司图片则显示，没有媒体给中性图位，不查静态公司表。招聘 Backend 不消费候选 identity 的姓名/头像来填匿名历史卡。
- 原因位置始终存在：有安全原因就中文显示；结束原因无源为“结束原因暂未提供”；completed 无额外原因时给“双方已确认意向”；pre-Case 给现有安全失败/拒绝说明。
- 招聘历史接口不提供 candidate_summary，保留画像位置并显示“画像信息暂未提供”，不额外读 open 列表/详情。
- 结果颜色按明确事实：已谈成用现有成功色；不匹配/未通过用原提醒色；主动结束等中性；未知不能着成功色。细分“我方退出/对方未通过”需要明确归属事实，不能从 generic user_ended 推断。

说明条统一为：“历史代谈保留往来记录，可回看进度与结果；能否继续以详情页当前可用操作为准。”替换旧“所有历史不可恢复”的承诺，两种来源同文案。

### 4.2 数据与交互

- 求职 Backend：单一 negotiations history 分页集合，保持服务端顺序、不透明 cursor；包含终局 Case 与已归档初评失败。
- 招聘 Backend：completed 与 ended 两架，保留独立 scope、请求、游标、重试和标题；共用同款卡。不能为了模仿 Mock 单列表拼接两个未读尽分页，也不新增筛选 Tab。
- Mock 精确数量显示“N 单已结束”；Backend 无 total 时仅显示“已加载 N 单”，包含当前两架已成功加载的正常记录数。加载未开始不显示假零总数，错误行不计为记录。
- ended 的阶段前缀“止步于”；completed 为“完成于”；尚无 Case 的记录显示“初评阶段”，不把初评失败等同 S0 失败。
- finalizedAt 有值显示“结束于”；只有 archived_at 为“归档于”；只有 updated_at/updatedAt 为“更新于”。按同一浏览器时区格式化，不以更新时间冒充结束时间。
- 卡片只做导航：求职 Backend 用 canonical record_id，招聘用 case_id；Mock 保持当前往来记录路由。卡上不增加恢复/决策按钮。
- 首载骨架、空态、失败/重试、旧列表刷新失败、加载更多均作为同一列表的状态；维持现有 owner 隔离和历史零轮询。招聘一架失败不清另一架数据。

## 5. 代谈进度与详情外壳

### 5.1 正常页面的阅读顺序

顶栏 → 两个 Tab → 四阶段流 → 底栏。删除阶段上方独立状态条、公开初评大托盘和通用“终局”卡。请求失败/重试仍是页面级反馈，不塞进某个阶段当业务消息。

每阶段使用同一版式：分节标题＋状态胶囊 → 本阶段步骤/轮次/注意说明（有必要时）→ 附件与按时序交错的问答/注释 → 代理小结及核对项 → 本人动作/等待说明。

阶段名沿用 Mock：匿名初筛、递交简历、需要协调、意向确认。内部键不变。后台“差异协同”等同一阶段展示别称统一为“需要协调”，不改 S2 请求语义。

- 已通过段默认折叠；当前段、结束所在段默认展开。可手动覆盖，轮询不反复强制打开；未到达灰段不可展开。
- `passed` 与 `ended` 分开外观：已结束不使用成功勾；终局原因只装入实际结束段。
- 有动作的合法段必须可展开访问，包括 passed 但仍待本人简历邀请等状态；不能以“已通过”隐藏权威动作。
- 初评/复评使用 Mock 居中灰色系统胶囊，左右问答仍使用代理气泡；段底小结只保留阶段结论和中文证据，不放评估长文副本。
- 公共初评决定、完整维度/终局字典、顺序、去重和完整响应字段位置均冻结在附录 A；附录属于本 Spec 正文。

### 5.2 尚未开案与特殊情况

pre-Case 仍保留四阶段骨架；匿名初筛标题旁为“未开始”，下方用同款小结/中文核对项显示“公开初评中/公开初评匹配/不匹配/待确认”。这是开案前信息，不将该段标为 passed，不创建假的阶段消息。初评失败的重试/归档动作位于该区域段尾，仍来自 actions。

retention/权限阻断沿用当前控制语义，不以缺失布局展示不存在或无权访问的 Case。跨响应重复的 condition_confirmation.latest_summary/summaries 不再额外渲染。

S3 的固定四节确认总结和版本提示留在 S3 小结；会话 pending/ready 入口放 S3 段尾，不能因删除顶部终局卡丢失移交能力。

### 5.3 顶栏、Tab 与状态归属

- 求职端沿用 Mock：S0–S2 标题“职位 · 公司”、右侧适配分；S3 标题职位、右侧岗位薪资。副标题用公司/地点等已有事实非空拼接，禁止末尾“·”。缺分为“—”，不是 0。
- 招聘端继续去名：性别、年限、学历、求职状态来自同响应的安全 candidate_resume.summary；最近工作行用于副标题。冻结岗位上下文仍保留为单独可读行，Mock 也按已有岗位事实提供。缺字段原位占位，不把 candidateAlias/真名填顶栏。
- 资料 Tab 始终按角色命名为职位详情/在线简历。首次挂载识别求职 `?tab=job`、招聘 `?tab=resume`；不匹配或未知值进度。后续手动选择不被 query 拉回。同记录 pre-Case→Case 保留 Tab。
- 切回进度及更换记录使用同一阶段定位规则。动作草稿/PDF 租约由控制层持有，不因 Tab 槽卸载丢失。

## 6. 职位详情 Tab

### 6.1 保留现有布局

继续复用 `职位资料` 和 CSS，保持 Mock 的顺序：匹配度分析 → 职位详情（含职位/城市/薪资/技能摘要）→ 职位要求 → 公司信息（图片/名称/介绍/融资/规模/行业/成立/地址/标签）→ 对接人。缺字段仍有原位置，不新建 Backend 简化页。

本轮不新增独立“所有接口字段”清单、匹配打分算法或重复的岗位头部卡。

### 6.2 需要修正的数据投影

1. **岗位薪资。** 当前摘要 public_salary_range 为空而同记录 job_detail 有 salary_lower/upper/period 时，使用已授权冻结结构化值补现有薪资位。优先级：非空原摘要 → 完整合法的冻结结构化三元组 → 缺失。month 沿用现有 K，day 为元/天，hour 为元/时；不补默认上下限/周期、不计算期望薪资。示例 20/30/month→20-30K。本地统一投影同时供顶栏与职位资料消费，不能一处有值一处空。
2. **摘要缺项。** 职位/城市优先同记录已有摘要有效值，缺失时才用同一冻结 job_detail.title/location.display_name；技能仍来自 required_skills，不能用 keywords 或 benefits 冒充技能。Case 只读自身 Case 数据，pre-Case 只读自身 negotiation 数据，不跨响应补齐。
3. **公司简介。** 后端明确 `company_intro=""` 是已知空，显示“暂无公司介绍”；null 为“公司介绍缺失”。当前非空文本清洗把二者混同，需要修正。正文 JD/要求空数组沿用“暂无”；缺源 null 才是缺失。
4. **地址。** 公司元行只用 office_address；office_location 是岗位办公位置，不移入公司地址。当前 Mock Tab 没有单独岗位地址行，本轮不为它新增区块；有需求时另行确认版式。
5. **公司/对接人。** 图片 URL、名称、职位、公司导航使用当前已接入字段。无组织 ID 入口禁用并说明；logo/头像失败回现有中性图位，不能加载演示头像；unverified 不显示已认证。
6. **匹配分析。** match_score 只是一项分数，没有 JD×简历对齐证据时保留匹配分析标题与缺失说明，顶栏仍显示真实分。公开初评 matches 不等同详细匹配对齐表，不能拿来伪造逐条证据。

本轮刻意不新增展示能力：公司成立年后端无源，继续缺失；annual_salary_months、招聘类型、办公方式、经验/学历码、校招届别、实习要求、hard_requirements 等没有当前 Mock 对应独立槽的字段不新建整套标签区。description/requirements 原文照常显示，已接入公司福利标签维持。none/unknown 不按词面随意翻译为已满足条件。

## 7. 在线简历 Tab

### 7.1 唯一正文输入

保留匿名简历 CSS 和当前阅读顺序：匿名画像/最近职位行 → 匹配度分析 → 个人优势 → 求职期望 → 工作经历 → 项目经历 → 教育经历 → 专业技能 → 页尾说明。

将当前正文内两种归一化移到数据/连接层，产出一个局部正文模型。模型保留当前真实用到的字段和显式可空项；不引入全站通用简历 DTO。正文不再通过“传了资料/传了档”判断模式或隐藏区块。

详情显式使用完整布局：任何来源都保留上述区块；有 Backend 资料却没有匹配证据时显示匹配分析缺失，不整区消失。独立匿名简历页继续其默认空区策略，使用兼容包装接统一正文，不顺便变更独立页面。

### 7.2 区块映射与空值

| 区块 | Backend 来源 | 展示规则 |
| --- | --- | --- |
| 画像/最近职位 | candidate_resume.summary | 与详情顶栏同一投影，0 年按现有“不满1年”规则；未知性别中性占位，不推姓名 |
| 匹配分析 | 当前 match_score＋已有合法对齐证据 | 无证据保留缺失位；不读其他岗位或实时本人简历重算 |
| 个人优势 | self_description | 正文原样；未知显示缺失，不用 personal_highlights 标签拼造自述 |
| 求职期望 | expectation 招聘类型/职位方向/地点/办公方式＋compensation_relationship | 使用既有中文词典；unknown 薪资关系不作匹配结论；不展示不存在的候选薪资数字 |
| 工作经历 | experiences 的 company/title/start_month/end_month/description | 按返回顺序；公司被安全投影遮蔽时保持未披露，不由 identity 或公司目录恢复；起始未知不造日期，只有已知起始且结束 null 才写至今 |
| 项目 | experiences[].projects 的 name/role/result | 按所属工作及项目原序平铺；没有独立日期，不借工作日期；不添加虚假批注 |
| 教育 | educations 多条 | 保持源序；学校/专业/学历用真实值，缺失不猜；不擅自降为最高学历一条 |
| 技能 | skills | null 缺失，[] 暂无；不借岗位技能填候选技能 |

Mock 的批注、期望偏好、一致性、项目日期仍可作为实际演示数据输入同一模型；Backend 未提供时这些可选细节为空，不生成同数量的空项目。用于期望的安全薪资关系不是“全部条件一致”的证明。

### 7.3 身份与页尾

后端 `recruiterCaseCandidateResume` 使用该 Case 冻结快照，且重新应用当前允许的安全投影；不能用实时简历覆盖，也不能因为 S1 已递交就恢复被屏蔽的公司。PDF 原件和结构化简历是两条独立能力。

页尾由显式展示事实输入：

- 整份结构化资料 null：“在线简历缺失 · 内容不可转发”。
- 真实双方意向确认完成：“双方已确认意向，可进入真人沟通 · 内容不可转发”。私聊是否可点仍以 handoff 为准。
- 其余 Backend 有资料：“这份简历由候选人的AI代理生成 · 内容不可转发”。没有证据不声称“真实性经双向核验”。
- Mock 原有披露/确认文案由适配层依据演示事实提供；两端共用位置和样式，展示组件不根据 mode 推断授权。

## 8. 控制与安全边界

- continuity v1/v2 请求体、本人 pending_action_id、S2 exchange_ref、S3 summary_version 与截止保护全部保留。
- S0/S1 的“继续”不等于接受差异；私有说明只给本人代理；S2 人工补答是双方可见正式回答，unknown 不等于同意。
- S1 选择文件/版本、当次披露确认、取消零请求、提交失败不推进、重读权威状态不变。
- S1 reconsider 的窗口事实不等于当前人的权限：候选样本 eligible=true + 空动作表只读；只有招聘方实际动作允许才显示按钮。pre-Case retry/archive 同理。
- S3 版本冲突仅提示并重读，不自动替用户确认新版；pending 不伪造会话，ready 只用真实 conversation_ref 导航。
- 保留轮询范围、主体隔离、迟到响应栅栏、PDF 单飞及租约释放。此 Spec 不通过隐藏/新增动作改变后端行为。

## 9. 组件边界与工程取舍

允许新增的共用边界仅对应现存重复：

1. 历史页面展示＋历史卡：替代四个数据源/角色组合的独立 JSX。
2. 对话系统注释：提取 Mock 往来记录的现有灰胶囊，供原消费者和阶段流共享；不重构真人会话。
3. 局部有序段内记录与简历正文输入：分别解决问答/复评不能交错、同正文按来源分叉的问题。

优先在现有映射文件中添加小型纯投影。字典在同域共用，避免历史/阶段分别翻译同一 outcome；不为字典创建可配置服务。不新增运行时依赖、环境变量或后端查询。删除被替代 JSX/无消费者 CSS，保留公共消费者默认兼容。

## 10. 非目标、延期及重启条件

不修改服务端代码、BFF schema、数据库、协议白名单、动作授权、业务状态机、匹配算法；不合并招聘历史双架、不重做独立职位/简历全页、不新增姓名头区/身份头像、不重写 Mock 为后端状态机。

不做在线翻译、AI 自动摘要、跨全站消息框架、额外排序 API 或历史逐条补读。缺失公司成立时间、匹配证据、简历批注/项目日期等只有服务端提供同 Case/角色授权字段后再接入；更多页面出现相同明确需求时再提升局部抽象。

## 11. 验收与测试责任

本阶段不跑测试估时、不以源码核查冒充运行验证。Plan 获批后以最小范围选择已有 Vitest、数据源模式 Playwright 和真实后端 dogfood，不新建测试平台。

| 验收 ID | 必须证明的结果 |
| --- | --- |
| H1 | 双角色 Mock/Backend 的历史卡共享 DOM/CSS，18px 页边距、结果/原因/时间位置一致 |
| H2 | 求职单分页与招聘双分页顺序/游标/失败隔离不变；总数不伪造；未知原因不透码；历史零轮询 |
| P1 | 无顶部原始初评/终局/重复状态条；样本 S0 已通过、S1 不匹配、S2/S3 未开始 |
| P2 | 初评→问→答→复评时间顺序及去重正确；消息归实际 stage；私有总结不泄漏给招聘方 |
| P3 | 全部字典和 unknown 安全回退；技术失败/未完成不显示通过；灰注释不计气泡条数 |
| P4 | v1/v2 动作与在飞状态、S1 文件披露/reconsider、S2 人工答复、S3 版本冲突/移交/PDF 生命周期保持 |
| D1 | 职位资料不新增第二正文；摘要空薪资能由已授权冻结三元组补齐，顶栏一致；已知空简介与缺失区分 |
| D2 | 冻结职位来源不串记录；媒体失败/导航无坐标/全缺/部分缺/0/空数组/有值变空均正确 |
| R1 | 简历详情所有来源保留完整区块，匹配证据缺失不隐藏标题；顶栏画像与正文同源 |
| R2 | 简历冻结快照、公司遮蔽、期望薪资关系、空值语义和页尾确认事实不被 Mock 内容覆盖 |
| X1 | 320/390px 完整/缺失/长文及终局场景可读无溢出；同输入同样式，不要求不同数据整页等高 |
| X2 | Mock 零后端请求，Backend 无新增跨域/逐条补齐；路由深链、换主体/角色/记录及 Tab 回切正确 |
| X3 | 独立匿名简历、往来记录等共享消费者默认行为回归；确认重复 JSX/无用 CSS 实际删除 |

类型检查、lint、定向组件/映射测试、构建与浏览器验收的具体命令和责任在批准后的 Plan 冻结。实现与 review 完成后按 workflow 先完成适用检查，再提交具体 final gate 方案；未获确认不执行正式集成/发布。

真实后端验证沿用 `docs/dogfood/真实后端行为验收.md`，仅选本功能受影响的双角色列表/详情/授权动作，记录版本、URL、截图和未覆盖状态。缺目标 URL/账号/环境时明确未完成，不自动运行全部业务 suite；fixture 不替代真实边界证据。

## 12. Spec 状态与后续

- 本文件是本轮唯一 Spec，已合并前一轮“主设计＋进度字段摆放”草案，不再需要跨两份文档判断优先级。
- 先前提前生成的未批准 Plan 撤回；用户批准本 Spec 的精确 revision/blob 后，才按 development-workflow / writing-plans 生成正式单 Plan。
- 本轮自检覆盖：四页范围、状态/权限、数据源、空态、重复渲染、消费者、非目标与验收。异构文档 review 按 workflow 在正式 Plan 形成后进行，尚未执行。
- 用户于 2026-09-16 明确回复：“可以，继续写0上下文Plan，做 /claude-review-loop 和写执行提示词，本轮不安排L3测试”。批准的产品正文版本为 revision `31dfb7f013fbf5c689db16cbbe58b00650864638`，blob `4690d718b38fd0df2f69223926b704ba056a3a6d`。
- 本次用户覆盖 §11 的真实后端验证安排：本轮 development L3 责任为 none（用户明确排除），不安排真实后端 dogfood，不把未执行记为 PASS；定向单元/组件、静态检查及拦截接口的浏览器验证仍保留。真实服务、账户权限和实际代理结果的端到端正确性本轮不获验证。
- 上述批准记录仅更新流程状态和测试范围，不修改已批准产品正文。本轮交付不执行产品实现、正式集成或发布。

## 附录 A：代谈进度中文字典、Mock 组件与完整响应摆放

以下各节为本 Spec 的可执行产品合同。主文 §6 是薪资与职位字段唯一规则；不按原始 JSON 将每个字段都上屏。

### A.2. 必须分清的三层事实

1. 公开资料初评：`agent_summary.public_evaluation.decision`（是开案前评估）。映射为“公开初评匹配 / 公开初评不匹配 / 公开初评待确认”。
2. S0 阶段结论：`case_detail.stages[anonymous_screening].state`。passed 才显示“匿名初筛已通过”，不能单凭公开初评 fit 标阶段通过。
3. 最终结束结论：`case_detail.state.stage + lifecycle + outcome`（terminal_summary 对应阶段）。本样本结束在 S1，所以“不匹配”只能挂“递交简历”阶段。

本样本的公开初评是 fit，S0 复评正文认为存在不匹配，但后续 transcript 有 decision_continue，S0 stage.state=passed：这是不同时间的判断与流程事实。展示原始时间序列，不解析自然语言推翻最终阶段状态，也不把所有证据说成“最终已达成”。

#### A.2.1 字典

| evaluation.decision | 中文 |
| --- | --- |
| fit | 公开初评匹配 |
| not_fit | 公开初评不匹配 |
| uncertain | 公开初评待确认 |

| evaluation.state | 中文（仅尚未开案的初评过程需要） |
| --- | --- |
| pending | 初评中 |
| completed | 初评完成，具体结论读取 decision |
| failed | 初评未完成 |
| expired | 初评超时 |

| stages[].state | 阶段胶囊 |
| --- | --- |
| pending | 未开始 |
| active | 进行中；本人待办存在时按权威输入显示“需要你”，等待他方时“等待对方” |
| passed | 已通过；S3 双方完成时可用“已确认” |
| ended | 从同一结束阶段的 outcome 取下表，缺失为“已结束” |

| outcome | 阶段胶囊 | 必要时段内的一句说明 |
| --- | --- | --- |
| semantic_not_fit | 不匹配 | 本阶段评估不匹配，代谈已结束 |
| policy_rejected | 未通过 | 条件核对未通过；有安全 code 时细化原因 |
| semantic_uncertain_stop | 信息不足 | 信息不足，未能确认条件 |
| agent_failed | 筛选未完成 | 自动筛选未完成，不表示候选人不匹配 |
| response_timeout | 逾期结束 | 逾期未回应，已自动结束 |
| user_ended | 已结束 | 本次代谈已结束；不能仅凭此码推“你退出/对方退出” |
| party_account_deleted | 已结束 | 相关账号已注销，本次代谈已结束 |

`outcome_code` 的额外闭词：compensation_incompatible→薪资条件不匹配；hard_exclusion→必要条件不匹配；screening_incomplete→自动筛选未完成；human_response_timeout→逾期未回应。只消费当前查看者已获准返回的安全码，不能展开隐藏阈值。与 outcome 同义时只显示一次；未知开放码用“已结束/结束原因暂未提供”，绝不原词兜底。原 decoder 对闭合结构的拒绝规则不放宽。

state.status 的 running/needs_user/passed/attention_required/ended/waiting 仍分别代表进行中/待处理/已通过/需注意/已结束/等待中；step 中文用于当前段一句说明，不再与阶段结论重复堆在顶部。complete 仅说明流程步骤完成，不等于通过。

### A.3. Mock 组件盘点与放置方式

| 现有组件或 JSX | 样式位置 | 用途 |
| --- | --- | --- |
| 详情外壳 / 详情顶栏 | `src/组件/在谈详情/详情外壳.module.css` | 岗位、公司上下文、Tab、匹配分；不塞评估原始结果 |
| 阶段对话流：分节条、分节胶囊、轴点 | `src/组件/阶段对话流.module.css` | S0–S3、阶段状态；结束段不能使用成功勾伪装通过 |
| 阶段对话流内部代理气泡 | 同上 | 正式 question/answer，左右按 viewer；保留角色、轮次、时间 |
| 往来记录/企业往来记录的记录条：类型=系统 | `src/屏幕/往来记录.module.css` 的 居中/系统胶囊；企业版亦有同款 | 用户所指居中灰色注释。当前是屏内 JSX，尚非独立共用组件；提取为 `src/组件/对话系统注释.tsx` 供原消费者和阶段流共享 |
| 直聊会话的消息条：系统/代理提醒 | `src/屏幕/直聊会话.tsx` | 同类视觉参考；本任务不重构真人会话 |
| 小结托盘 + 核对列/核对行 | `src/组件/通用.tsx`、阶段对话流 CSS | 段底“代理小结”：阶段结论和中文 bullet。不给初评/复评长文第二份副本 |
| 阶段对话流内部附件行 | 阶段对话流 CSS | S1 PDF 文件名/查看；独立于有无消息常驻，权限和租约仍由控制层持有 |
| 详情动作卡 / 简历选择层 / 确认层 | `src/组件/在谈详情/`、`src/组件/确认层.tsx` | 当前阶段本人待办及恢复动作，不从展示结果推权限 |
| 终局区原有移交部分 | `src/组件/在谈详情/终局区.tsx` | 放 S3 段尾的 pending/ready 私聊入口，保留行为；删除顶部通用“终局”结果卡 |
| 详情底栏 | `src/组件/在谈详情/详情底栏.tsx` | 输入/只读；本样本候选侧只读 |
| 职位资料 | `src/组件/在谈详情/职位资料.tsx` | JD、要求、公司、对接人等，放第二 Tab |

不把所有消息改成灰色注释：问答仍用左右气泡；灰色注释用于候选代理的初评/复评和必要系统事件。候选私有总结继续只在候选侧显示。

### A.4. S0 代理小结中的中文 bullet

使用 evaluation 证据，来源标题/说明明确“公开资料匹配检查”，避免用户把旧公开证据误读成后续问答后的最终一致。不展示 source/code 原始词。

| dimension | 中文 |
| --- | --- |
| recruitment_type | 招聘类型 |
| job_category | 职位方向 |
| location | 工作地点 |
| workplace_mode | 办公方式 |
| compensation | 薪资条件 |
| campus_cohort | 毕业届别 |
| internship_months | 实习时长 |
| skills | 专业技能 |
| experience | 工作经验 |
| education | 学历要求 |
| work_arrangement | 工作安排 |
| job_requirements | 岗位要求 |
| information | 信息完整性 |

三组决定 bullet 外观：matches→✓“匹配”，conflicts→“不匹配/存在差异”，unknowns→中性“待确认”。现有核对清单只有“通过/核对中”，要增加明确“不匹配”展示态；unknown 不冒充正在执行检查，ended + done=false 也不继续显示“核对中”。

具体 code 优先于通用维度后缀：compensation_not_comparable→“薪资条件：暂无法比较”；campus_cohort_unrestricted→“毕业届别：不限”；experience_requirement_unconfirmed→“经验要求：待招聘方确认”；education_requirement_unconfirmed→“学历要求：待招聘方确认”；insufficient_information→“信息不足，待确认”。其余已核实的 match/mismatch、skills/experience/education/work_arrangement 的 match/gap、other_material_gap 按所属组和维度翻译。未知维度不透出原词，显示“其他条件”及组态，不从英文替换下划线猜业务含义。

本样本清单为：招聘类型、职位方向、工作地点、办公方式、专业技能、工作经验、学历要求、工作安排共八项匹配；薪资条件暂无法比较。没有证据的维度不新造一项，不显示“无冲突”作为额外绿色承诺。

公开评估的英文 summary 不再整段上屏，也不让前端在线翻译/生成新总结。本次以中文决定+证据取代它；候选 S0 screening summaries 的初评/复评原文保留在灰色注释，长文允许换行。本轮不加自动摘要和新的“展开全文”交互，阶段本身已有折叠能力。

### A.5. 段内顺序与去重

- 以消息自身 stage 分组，不能把 S0 screening_records.messages 整包归入 S0。现有 `映射阶段区` 已正确分段，保留。
- 候选 S0 summaries（initial/reevaluation）与 S0 问答合并，按原始 occurred_at 升序；不用 HH:mm 排序，避免跨日期/时区错误。相同毫秒保留稳定源序，不制造虚假的更高精度排序；同一来源已有的问答顺序保留，不使用当前时间补缺失。
- 展示顺序是时间事实，不硬编码每一轮一定存在问、答、复评。未回答/不完整状态也占其真实消息位置，不造缺席回答。
- 本样本 S0：初评 22:28:34Z → 候选问 22:28:47Z → 招聘答 22:28:57Z → 第1轮复评 22:29:10Z → 必要的继续流程系统事件 → 段底小结。显示时统一采用浏览器本地时间，不把服务器 UTC 切片与本地时间混用。
- `agent_summary.condition_confirmation.summaries/latest_summary` 与 screening_records.summaries 是同批信息投影，选后者为唯一时间流来源；latest_summary 不再多渲染。公开评估只选 agent_summary.public_evaluation，evaluation.result 不重复显示。
- transcript 仅把确有用户价值的事件变成简短中文注释，如开始代谈、继续、已递交简历；重复的 case_advanced 不逐条列出；case_ended 若已由阶段胶囊+结束时间表达，不再显示第二个同义块。有 text 保留其原始含义，不能把系统事件投成对方说话。
- 正式叮嘱回执仍标本人/代理回执，若参与时间流排序需保留角色属性；Mock 无绝对时间的旧剧本保留传入顺序，展示组件本身不排序或猜日期。
- 阶段“条数”统一计问答/叮嘱消息，灰色注释不计为双方发言；附件、阶段小结、动作卡也不计入。

为了实现交错，新增局部 `段内记录` 有序联合（气泡/灰色注释），把当前分散 Agent对话、系统消息、Agent总结 的渲染归为一次遍历。只适用于本页，不建立跨全站事件总线；原 Mock 气泡由连接层适配到相同输入。

### A.6. 完整响应字段去向

| 响应字段组 | 去向/规则 |
| --- | --- |
| job.title、organization.display_name、location | 共用顶栏和职位资料摘要；本例“产品经理 · 快手”“北京市” |
| job.public_salary_range、match_score | 顶栏相应位置；摘要薪资空按主文 §6 回退，仍无值才标缺失。分数 null 不补 0、真实 0 正常显示；不留尾随“·”，不由证据条数计算 |
| job_detail 的 description/requirements/category/location/office_location/recruitment_type/workplace_mode/annual_salary_months/经验学历/结构化要求 | description/requirements 进现有正文；title/location 按主文 §6 补摘要。其余未有 Mock 对应槽的字段本轮不新增展示，不进入进度对话；none/unknown 不映射为严格限制 |
| job_detail.salary_lower/upper/period | 按主文 §6 的唯一薪资投影规则填摘要和详情顶栏；仅使用本记录已授权冻结职位资料，不改薪资匹配证据 |
| organization、company_intro/office_address/benefit_codes/publisher_profile | 公司区/对接人；logo/avatar 真实 URL，空值中性占位；unverified 不显示已认证 |
| record_id/case_id/delegation_id/evaluation_id/intention_id/job_id/organization_id 等 | 请求、缓存、导航、稳定 key；不上屏，不互相替代 |
| record_kind/shelf/phase/created_at/updated_at/archived_at/retry_generation | 连接层选视图、历史分页/时间、重试代际；不要直接输出 delegation/history/case_started/数字代际 |
| needs_action、actions、available_actions、pending_actions | 控制层决定本人动作和需要你状态；本例 available_actions=[]，候选侧零恢复按钮，open_case=true 只是可打开详情 |
| evaluation.state/failure、result.decision/evidence | 初评过程或 S0 小结；失败原因中文映射，不把技术失败当不匹配 |
| evaluation.inputs、source、coverage、next_action、input_warnings、promotion、revision/contract_version | inputs/revision/source/coverage 不直接展示；next_action 是建议不授予按钮；有输入警示时用安全中文提示相关缺项；promotion 只按现有路由语义，不产生第二个流程 |
| agent_summary.public_evaluation | 本次唯一公开初评展示源；决定/证据进小结，summary 不再大段渲染，completed_at 不冒充 S0 通过时间 |
| agent_summary.condition_confirmation | 与真实阶段状态/summary 同源投影；不重复显示 latest_summary 和 summaries |
| case_state、case_detail.state | Case 状态/当前阶段，stage+outcome 决定结束阶段胶囊；不整块展示，也不把 round=1 标成 S0 全局轮次 |
| stages[].state/summary/checklist | 分节胶囊与简短小结、核对项；complete→本阶段已完成仅在无更具体结论时使用；done=false 在终局为未完成，在未到达段不造一堆未完成任务 |
| screening_records.messages | 依自身 stage 的正式左右气泡；answer_status unknown→暂时无法回答，不能解释成拒绝或同意；answer_source=human 显示本人回答 |
| screening_records.summaries | 候选侧 S0 内的居中灰色初评/复评，按时间交错，段底不留副本 |
| transcript / instruction_receipts | 必要系统注释/叮嘱回执；无正文的未知事件码不直接露出；重复推进事件不刷屏 |
| attachment | S1 原始 PDF 附件行；只给授权查看，文件版本 ID 不上屏 |
| terminal_summary | outcome 中文归对应阶段胶囊；原因（不同义才显示）与 finalized_at 放该段小结/时间行；不保留顶部独立终局卡 |
| dialogue_progress | 对应当前阶段的轮次提示。本例“S1 招聘方第1轮 / 共3轮”，candidate_round=0 不显示假问答；预算读服务端，不能全局写死3 |
| intent_confirmations、confirmation_summary | S3 双方状态及固定四节总结；本例为空且未到达，零确认事实 |
| reconsideration | S1 中性说明窗口事实；eligible=true 不等于当前人有动作。候选可显示“招聘方可在期限内重新考虑”，不可给候选按钮；招聘方也须 available_actions 允许 |
| failure_history | 非空时必要中文失败/重试历史注释，按实际时间和来源去重；本例空数组不占块 |
| meta.request_id/api_version | 诊断信息不上产品正文 |

### A.7. 本样本最终阅读结构

```text
产品经理 · 快手                       适配 —
北京市
代谈进度 | 职位详情

匿名初筛  [已通过]
  灰色居中注释：初评 · 时间 + 原文
  右气泡：候选 Agent · 第1轮问题
  左气泡：招聘 Agent · 第1轮回答
  灰色居中注释：第1轮复评 · 时间 + 原文
  （必要的继续事件注释）
  代理小结
    匿名初筛已通过
    公开资料匹配检查：公开初评匹配
    ✓ 招聘类型：匹配
    …其余七项匹配…
    · 薪资条件：暂无法比较

递交简历  [不匹配]
  PDF 附件行
  招聘方第1轮 / 共3轮
  左气泡：招聘 Agent · 问个人在产品迭代中的职责
  右气泡：候选 Agent · 暂时无法回答
  代理小结
    本阶段评估不匹配，代谈已结束
    ✓ 简历已绑定 / 已解析 / 已披露
    · 简历初筛未通过
    结束时间（本地格式）
    招聘方可在指定期限内重新考虑（只读说明）

需要协调  [未开始]
意向确认  [未开始]

当前在谈已结束，仅可查看
```

示意展开已通过的 S0 和已结束的 S1以说明内容位置；正常入口仍保留 Mock 的已过阶段折叠规则，结束所在阶段默认展开便于回看。本例的“简历初筛未通过”由 ended+semantic_not_fit 和 checklist 联合决定，不将所有 false 通用翻译为未通过。

### A.8. 验收增量

- 本样本的枚举/证据字段不出现 fit/recruitment_type/structured_precheck/semantic_not_fit 等协议词（代理正文中的原文不做字符串替换）；没有公开初评英文大段、顶部终局卡、顶部重复轮次状态条。
- S0 已通过与 S1 不匹配同时成立；复评原文即使不匹配也不篡改 S0 的最终阶段状态。
- 初评→问→答→复评顺序正确且每条只出现一次；S1 两条消息不进入 S0；招聘方不得看到候选私有总结。
- 13 个维度、三种决定、四种 evaluation.state、七种终局 outcome 及特殊 code 均有中文映射/安全未知行为；false checklist/技术失败不显示成功勾。
- 同毫秒稳定序、跨日期、缺一轮回答、轮询去重、手动折叠、合法空清单均稳定。
- eligible=true + available_actions=[] 的候选样本无重新考虑按钮；公开 next_action=review 不产生人工待办。
- 320/390px 长灰注释可读不溢出；Mock 和 Backend 同输入同样式，初评/复评不再出现在阶段小结。
