# J-PILOT-02 候选 Onboarding 最小接线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL：Claude Code 实际调用 `superpowers:subagent-driven-development`；Codex 实际调用 `superpowers:executing-plans`。串行完成下列 10 个 Task，checkbox 用于跟踪；不在规划 session 实施。

**Goal:** 新候选人以手填或可选 PDF 完成本人资料和一条首次意向，严格沿现有 Mock 页面经过披露、可选头像及原初始化进入首页。

**Architecture:** 直接修改现有页面的状态、数据与事件参数，Backend 改接已有 Mock 渲染。复用现有 Provider、领域 reducer、session 草稿、数据源分区保存与 HTTP 幂等键能力；只为本旅程补齐有限恢复信息，不新建展示组件、服务层、通用队列或状态机框架。

**Tech Stack:** 现有 React 19 / TypeScript 6 / Vite 8 / Vitest / Playwright；不新增依赖、配置或测试框架。

**Spec:** `docs/superpowers/specs/2026-09-11-j-pilot-02-frontend-wiring-design.md`，批准 v1.1，revision `a0c7e0a5ffb913b9df8bb2216fc40ad700e532b7`，blob `6b1609cae4422c7205fb7668e9d3c6b343af55b7`。用户批准语为“可以，继续写0上下文计划……做最小最简实现”。此后未经明确批准的新导航方案不在本 Plan 授权内。

日期：2026-09-11。仓库 `agxp-a2a-recruiting-web`，工作区 `.`，当前分支 `j-pilot-02-wire-frontend`，目标 `main`。代码研究基线 `d8e69a03c32950574ceee5435e68f84e3cf2cbc5`；本文绑定的上游合同、后端 revision 和产品 blob 见批准 Spec §1。不依赖规划聊天历史。

## Global Constraints

- 开工完整读 `CLAUDE.md`、`AGENTS.md` 和上述批准 Spec，核对 Git 对象及实际文件内容；不以未批准的最新 Spec 自证扩大范围。迁移必须携带对象。外部后端仓库由执行环境定位，不写固定机器路径。
- **零新增 React 组件/组件文件，零提取或包装组件；不改 Mock CSS、布局 className、内联布局、布局 DOM、分区顺序与控件位置。** Backend 可删除重复布局并改接原 Mock 实现。数据、状态、回调、disabled、既有提示是允许的接线，不据此添加节点。任何测试基线更新不能授权设计漂移。
- 保留 `src/屏幕/初始化页.tsx`、对应 CSS、固定“扫描 862 个岗位”和动画。资源完成核对在进入初始化前；不宣称原 AC16 全通过。不改招聘 onboarding、Case 流程或后端生产代码。
- PDF、工作经历、Summary、头像、作品集、技能、证书均可空；至少一条完整教育（含预计/实际毕业时间）才可完成。用户未确认的滚轮默认值不写入。推荐为空/失败不阻塞完成。
- Backend 不用 Mock 值充数；只接受真实目录稳定 ID；用户修改显示文字即失效旧引用。空、失败、结果未知不等于成功。私有诉求不自动写硬排除；已明确选中的组织才可写屏蔽。
- 接口/数据归属：资料和条目归 resume；Summary 归 summary_revision；URL 归 profile_revision；首次意向归 owner intention；屏蔽归 privacy；头像归 account；PDF 预填归 exact source tuple。客户端草稿不是服务端权威；不发明总提交接口或事务回滚。
- 每个异步操作捕获 mode/env/subject/role 与现有 session generation，响应、水合、错误、finally、导航都核对；切换身份、环境、模式、401、退出时清本人当前草稿与内存建议，旧响应不得污染新主体。普通返回不能误当完成/退出。
- 仅扩展现有 `候选引导草稿v1` session 白名单，不引入 localStorage、IndexedDB、跨设备同步、全局 middleware 或后台重放。PDF 字节、原文、完整 parser 输出、token、联系方式不落草稿；用户明确编辑的建档输入可按批准 Spec §7 缓存。
- 每 Task 新增生产文件：无。仅 Task 10 新增本旅程测试文件；其余在原测试中补具体失败反例。不拆文件求整齐，不顺便改日常编辑业务。表中路径是许可边界，确需增改路径先核对消费者和 Spec 范围，不擅自扩设计。
- 工作区复用 `.`，不另建用户 worktree，不 stash/reset/clean 用户内容。当前前端没有 `scripts/task_intents.py`，不为工具要求新建基础设施；实施前检查实际存在的协作登记入口，若仍不存在，以当前工作树和他人改动核对并在会话声明本 Task 文件范围，不伪造登记成功。用户“最小最简、不增架构”覆盖对此缺失入口的自动补建。
- 在授权范围内连续实施、定向验证及收尾 review；人工 final gate 仅在具体候选、证据和合入计划都准备好后请求。正式合入、L3、push 留到该确认之后。

### 已确认的展示复用锚点与局部 PM 缺口

|现有入口（源码证据）|复用方式及边界|
|---|---|
|`src/屏幕/引导问答.tsx` 的 `期望职位题`、`方向细选页`、`城市题`、`城市键`、`排除题`、`优势题`，由本文件向导题条件调用|保留原 Mock 分支的分类、说明卡、方向、城市分组、已选条、排除卡；现有 Backend 提前 return 改接同一渲染。只加现有函数参数/控制，不能新增函数组件。|
|`src/屏幕/选期望职位.tsx`、`src/屏幕/选工作城市.tsx` 默认页面|分别复用各自原 Mock JSX，不合并两个原本不同入口；日常编辑来源、单/多选与返回不变。|
|`src/屏幕/毕业院校.tsx`、`src/屏幕/选专业.tsx` 的原候选行；`src/屏幕/工作经历.tsx` 已有 `教育编辑页`、`经历编辑页` 及原编辑层|真实目录内容接原行；学校地点等只能放已有文字位置，不新增副行。嵌入编辑层若没有现成可用结果选择能力，记录具体缺口，不能造新选择层。|
|`src/屏幕/学生分流.tsx` 已调用的授权确认层/确认层/附件交互；`src/流程/候选Onboarding预填边界.tsx` 已用路由加载中和确认层|复用原上传、授权、等待、重试、手填控件；只改 source、busy 与事件。|
|`src/屏幕/添加头像.tsx` 的原文件框、上传圆位与完成按钮；`src/屏幕/披露说明.tsx` 原按钮|图片读写、保存状态与完成核对接原组件。现有 `轻提示` 是错误出口，不另增错误组件。|

已证实一个具体缺口：`引导问答.tsx/排除题` 的“再加一家”只展开自由文本 `行内输入`，没有真实组织结果选择；现有 `src/屏幕/屏蔽名单.tsx` 虽能搜索组织，其 Backend 分段/结果结构与该 Mock 卡不相同。**尚未获批改变“再加一家”导航，Plan 不将新跳转、搬入搜索布局或新增选择层作为实现任务。** Task 7 先完成无需新设计的权威屏蔽回显/解除/禁止假成功，手动新增及不能明确选组织的一键路径记 `PM_BLOCKED`，不宣称屏蔽闭环已完成。只有用户/PM 明确批准现有页面往返等具体方案，才修订对应 Spec/Plan 后补此项；无回答不算批准。此处理执行 Spec §3.1，不删除需求。

同样，城市若现有滚动容器可以接到达底部事件即可增量加载（不加节点）；确无既有分页/滚动承载能力则记录该入口，不添加按钮。已有行可通过同一文字位置表达真实国家/城市消歧；确实不可辨的项禁选并记缺口，不猜选。

### 冻结的局部接线契约

以下是本次函数/类型增量，不是新的架构层。类型放原 `src/数据/招聘数据源类型.ts`、`src/状态/后端/类型.ts` 和 `src/数据/资料缓存.ts`；内部 helper 允许局部实现，但不得产生新 UI 组件。

1. URL：`BFF简历资料.portfolio_url?: string | null`（旧读缺省按 null）；`BFF资料写入.portfolio_url?: string | null`；`页面简历快照.作品集链接: string | null`，`页面简历写入.作品集链接?: string | null`。读取显示空串，写入缺省保留/null 清空/string 设置。普通 profile 编辑不带该字段，不能从旧 GET 顺带覆盖；onboarding 明确编辑才带。profile 其他字段仍按原全量体，不变为局部 PATCH 语义。URL trim、无协议补 https，绝对 http(s)、含点 hostname、禁止空白/BOM、最多 2048 Unicode code points；不抓取 URL。
2. 目录：`BFFTaxonomyItem.has_children: boolean` 来自当前合同，保留 parent_id/selectable。可导航与可选择独立判断：有 children 可下钻；只有 selectable 才能存引用；原控件不能同时表达“选此节点/继续下钻”时保留导航、不得猜选择，并记录具体选择缺口。不得写死层数。Location 默认查询不发送空 q，按服务端 nextCursor 和 catalogVersion 处理，查询变更丢弃旧游标/迟到结果。
3. 首次意向输入新增 `自定义诉求?: string[]`；`排除项` 仅四张固定卡的原标签，自定义输入原样另存。`转首次意向写入` 的 `excluded` 三个数组恒为空，private诉求按 Task 7 固定文案换行拼接，无前缀/模型改写；普通 `转意向写入` 不变。
4. 本旅程只有一个串行未结算写入槽 `待写入`，不是队列。结构只允许 `{种类, 本地编号?, 资源编号?, 父编号?, 请求体?, 幂等键?, ifMatch?, 阶段:'prepared'|'received', 回执?, 文件核对?}`。种类闭合集合：profile、summary、skills、experience/project/education/certificate 的 create/update/delete、first-intention、organization-block/unblock、resume-file-create/replace/parse、avatar。每种请求体使用该域现有 BFF 写 DTO，不接受任意 URL/HTTP 方法；文件操作不存 body 字节，仅 name/type/size/lastModified/SHA-256 供用户重新选文件核对。回执仅存该种类已返回的 ID/revision/aggregate_revision/source tuple，不能存完整响应或解析输出。
5. 原数据源追加可选参数 `跟踪?: 建档写入跟踪`：`发送前(命令: 建档待写入): 建档待写入` 和 `已确认(命令: 建档待写入, 回执: 建档写入回执): void`。发送前同步把白名单命令持久化成功才允许发请求；返回带原幂等键/ifMatch 的命令。已确认同步保存 receipt、把临时条目编号替换为服务器 ID 后才继续下一步或 GET。跟踪接口仅本旅程调用，不改 HTTP 全局重试；普通调用省略保持兼容。持久化失败抛 `BFF错误` 的本地 invalid_request + 中文消息，零 mutation；请求结果未知保持槽，不伪造确定失败。
6. 非文件未知创建：恢复后通过同一域原方法以同一 body/key 重放/取得 receipt；已收到 receipt 则只 GET exact ID。CAS 更新/删除没有幂等合同，不换 revision 盲重试：GET 对应资源，目标字段相同/目标已删除才能结算，否则保留冲突让用户在原编辑入口重审。未知文件创建/替换/头像需用户重选同字节后用原 key/ifMatch；没有字节只可读核对，不能自动重传。解析 source 必须精确，不从 items[0] 推断。一个槽未结算时，禁止另一 mutation 覆盖；读与手填输入不受此限制。
7. 草稿增量挂在现有 `候选引导草稿快照.建档?`：版本 1，`位置:{pathname,search,题序?}`，`资料`（页面简历写入中用户输入字段，不含服务端快照），`编辑中`（现有教育/经历/项目/证书编辑器判别种类、本地编号与原表单字段，允许不完整字符串），`排除项:string[]`、`自定义诉求:string[]`、`首次意向?:{id,revision}`、`待写入?`、`头像状态:'未选'|'待核对'|'已保存'|'已放弃'`。未出现字段兼容旧草稿，字段白名单逐一解码。PDF source/eligibility/confirmed/generation 仍只存原预填恢复元数据，不在这里复制另一份。取消编辑明确丢弃其 `编辑中`；暂时返回/刷新不丢输入。
8. 状态层增加 `更新候选建档草稿(建档: 候选引导草稿快照['建档']): void`（同步写后派发，写失败抛错）；`完成候选Onboarding(): Promise<void>`（Task 9 冻结语义）。原 `保存简历`、`保存个人优势`、`保存首次意向`、`保存候选头像` 签名面向页面保持兼容，操作层仅在当前 active 建档草稿存在时接跟踪。`创建首次意向(input, 跟踪?)` 保持返回 `Promise<页面意向快照>`，新增 `读取意向(id: string): Promise<BFFOwnerIntention>`；POST receipt 在后续 GET 前交跟踪，不丢 ID。文件/隐私数据源在原参数之后追加可选跟踪，HTTP 使用已有显式幂等键字段。

以上有限记录是为“服务端已写入、刷新后不能重复创建”的现实故障；不扩展到全站所有 mutation，不新增通用执行器。对同一建档未结算命令，原域操作先结算再按最新草稿算下一步；不一次持久化一串未来步骤。

## Task index

Task count: 10
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

按 1→10 串行执行，共享文件不并行。Task 1 是当前旅程所需的兼容 DTO/映射变更，留在同一候选分支，没有跨仓生产者改动或需另行合入的共享基础设施；上游 API 必须已进入核对过的后端基线，不实施一半前端一半未落地接口。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|URL/目录/诉求契约；无前置 Task|前沿 / 顶级模型（Claude Code: fable/opus）；防三态误覆盖|前沿 / 顶级模型（Claude Code: fable/opus）；查合同|Top 5–10（Claude Code: sonnet）；查局部性|
|2|草稿恢复及隔离；依赖 1 类型|前沿 / 顶级模型（Claude Code: fable/opus）；跨刷新竞态|前沿 / 顶级模型（Claude Code: fable/opus）；隐私边界|前沿 / 顶级模型（Claude Code: fable/opus）；白名单/竞态|
|3|资料分区回执与重试；依赖 1、2|前沿 / 顶级模型（Claude Code: fable/opus）；部分成功|前沿 / 顶级模型（Claude Code: fable/opus）；恢复契约|前沿 / 顶级模型（Claude Code: fable/opus）；控制复杂度|
|4|基本资料/教育/经历接线；依赖 1–3|前沿 / 顶级模型（Claude Code: fable/opus）；多原编辑器|前沿 / 顶级模型（Claude Code: fable/opus）；布局边界|Top 5–10（Claude Code: sonnet）；消费者回归|
|5|职位与城市同展示；依赖 1、2|前沿 / 顶级模型（Claude Code: fable/opus）；目录与视觉|前沿 / 顶级模型（Claude Code: fable/opus）；禁止设计|Top 5–10（Claude Code: sonnet）；删除重复渲染|
|6|PDF exact source；依赖 2、3、4|前沿 / 顶级模型（Claude Code: fable/opus）；异步源竞争|前沿 / 顶级模型（Claude Code: fable/opus）；授权/恢复|前沿 / 顶级模型（Claude Code: fable/opus）；旧响应隔离|
|7|首次意向/隐私接线；依赖 1–5|前沿 / 顶级模型（Claude Code: fable/opus）；防重复和假屏蔽|前沿 / 顶级模型（Claude Code: fable/opus）；私有语义|前沿 / 顶级模型（Claude Code: fable/opus）；最小修改|
|8|头像回执与恢复；依赖 2、3|前沿 / 顶级模型（Claude Code: fable/opus）；文件未知结果|前沿 / 顶级模型（Claude Code: fable/opus）；完成边界|Top 5–10（Claude Code: sonnet）；沿用原组件|
|9|完成/恢复路由门槛；依赖 4–8|前沿 / 顶级模型（Claude Code: fable/opus）；跨域完成事实|前沿 / 顶级模型（Claude Code: fable/opus）；旅程完整性|前沿 / 顶级模型（Claude Code: fable/opus）；竞态及简化|
|10|定向浏览器用例/验收入口；依赖 1–9|前沿 / 顶级模型（Claude Code: fable/opus）；区分真实与 fixture|前沿 / 顶级模型（Claude Code: fable/opus）；覆盖与例外|Top 5–10（Claude Code: sonnet）；测试最小集|

**计划本身复杂度：高。** 页面数量较多，分区写入、身份隔离和视觉限制相互约束；不以新框架降低表面任务数。

**零上下文漂移风险：高。** 真实 provider、目录形态、PM 缺口和部署合同需现场核验，尤其不能用自行补设计解决。

执行模型只按零上下文漂移风险选择，使用当前可用的行业顶尖模型。角色表按判断风险细化；Codex 不解析 Claude alias。

## 验证选择与责任

1. 防的失败：重复创建/跨账号草稿、旧 URL 覆盖、假目录/假屏蔽、预填覆盖手改、未保存就完成、Backend/Mock 布局分叉。每 Task 仅跑列出的 Vitest 文件，采用现有 fixture/fake HTTP，不搭新测试层。
2. 开发最小反馈：`npx vitest run <Task列出的精确测试文件>`，先新增能暴露该行为的反例确认失败，再实现、确认通过。类型交叉调整运行 `npm run typecheck`；不每 Task 都 build/全 suite。不存在的测试路径须按本文“新增”清单创建，不盲跑空 selection。
3. 若实际 BFF body、If-Match、幂等回执、consent、目录层级与锁不同，Task 当场先只读核对 OpenAPI/运行响应。需要真实序列化或授权证据时按现有 dogfood 入口跑该最小分支，不能把 fixture 当证实。无环境记具体 BLOCKED，继续独立任务；不拖到收尾才首次发现接口不支持。正式 L3 不提前跑。
4. 最终权威验收由实施主控负责：review 后重算变更/消费者所需单测并复用有效 Task 证据，运行 typecheck、`npm run build`、对变更 TS/TSX 的 `npx oxlint <精确文件>`，选择 Task 10 的定向浏览器与原 Mock 旅程，及仓库现有 UI gate。UI gate `npm run ui:check -- --base <已记录目标SHA>`，该实参实施时替换为真实 SHA；不在此前重复其内含采集。先读 `脚本/UI回归.mjs` 和 `docs/UI回归巡检.md` 核对选择/环境，report-only 结果不能单独证明零布局漂移。无自动 affected runner，不新建一个；记录文件与消费者选择理由。
5. 已有证据是合同锁/源码研究，**没有本 Plan 产品测试 PASS**；成本未知。浏览器需要新账号、后端、provider 和可见 Chrome，耗时按实际记录，不为填时长先跑一次。

L3 静态责任：**required** 是本前端候选真实浏览器旅程的最终集成验证，入口 `docs/dogfood/真实后端行为验收.md` → `docs/dogfood/backend-local-onboarding.md` 的 `CAND-ONB-001` 学生/社招变体，以及本 Plan Task 10 的只读招聘 Highlights/隔离核对。前置为明确 Origin、匹配合同的 BFF/Service、测试账号和授权真实 provider；顺序为手填学生→手填社招→可选 PDF→招聘只读已有合法场景，不为02创建岗位/Case。**conditional**：共享目录/URL/意向日常消费者发生改动则选择 `CAND-INT-001`、`CAND-AUTH-001` 对应受影响断言。**none**：招聘 onboarding、B01–B05 全套、Hosted H01–H04、后端未受影响 suite 及发布全序列。缺某只读招聘场景/环境为该项 BLOCKED（owner 实施主控协调测试环境），不能改跑全套或记空 selection PASS。所有正式 L3 在 final gate 后；前期必要定向现场核验不代替其责任。

每 Task 的完成均指其可实现的接线与定向证据，不代表旅程全部 PASS。PM_BLOCKED 和真实解析受阻独立保留；可在现有设计内修复的前端错误必须修。

### Task 1: 对齐 URL、目录 DTO 与首次诉求映射

目标：把现有已落地 BFF 合同准确带入前端，保持普通资料/意向编辑兼容。依赖：Global 的批准对象与后端锁核对；不修改后端或 UI。

预期编辑文件：新增：无。删除：无。修改：`src/数据/BFF契约.ts`、`src/数据/招聘数据源类型.ts`、`src/数据/后端映射.ts`、`src/数据/招聘数据源/目录.ts`、`src/流程/onboarding配置.ts`、`src/数据/后端映射.test.ts`、`src/数据/HTTP招聘数据源.test.ts`、`src/流程/onboarding配置.test.ts`。

接口：生产 Global 契约 1–3，消费现有 `转资料写入`/`从BFF简历`/`转首次意向写入` 和目录页。`转资料写入(基本信息, 作品集链接?: string | null)` 保持原单参数调用合法；URL 有意编辑才由 Task 3 传第二参数。BFF read schema 缺省 URL 兼容；has_children 不从 parent_id 推算。

- [ ] 在原映射/配置测试新增：URL 省略/null/规范化字符串三态、2048/2049 Unicode 字符、空白和 javascript 协议；普通 profile 修改不携带旧 URL；固定四卡+自定义诉求映射准确，日常硬排除不变。
- [ ] 运行 `npx vitest run src/数据/后端映射.test.ts src/数据/HTTP招聘数据源.test.ts src/流程/onboarding配置.test.ts`，确认新反例因当前行为失败。
- [ ] 按 Global 1–3 补原类型/映射/校验。用“有无属性”区分省略与 null，不以 truthy 判断清空。消费已有 BFF has_children；默认 Location 查询省略 q，不加 catalog 缓存服务。
- [ ] 重跑同命令与 `npm run typecheck`，确认旧调用无必填字段破坏；记录 API 锁匹配结果。
- [ ] 只提交本 Task 文件，commit `feat: align onboarding field contracts`。

完成/停止：三态及日常回归均有证据才完成；若后端部署未包含已锁合同，不编造兼容响应，记录具体依赖阻塞并先完成可独立的类型工作，不宣称真实连通。

### Task 2: 扩展原 session 草稿，保留输入与写入坐标

目标：未提交输入、编辑层和单个未结算请求跨刷新恢复，隔离账号/环境，不新增持久化架构。依赖：Task 1 类型；使用 Global 4–8。

预期编辑文件：新增：无。删除：无。修改：`src/数据/资料缓存.ts`、`src/数据/资料缓存.test.ts`、`src/状态/领域/候选资料.ts`、`src/状态/初始状态.ts`、`src/状态/资料持久化.ts`、`src/状态/后端/类型.ts`、`src/状态/后端/会话操作.ts`、`src/状态/应用状态.tsx`、`src/状态/应用状态.test.ts`、`src/状态/后端/会话操作.test.ts`、`src/数据/招聘数据源类型.ts`。

接口：生产 Global 的建档类型和 `更新候选建档草稿`；在原 `引导预填` 里携带可选 `建档`，不复制权威 resume。将与现有预填 storage adapter 同模式的同步草稿读写能力放入 `后端操作依赖`；操作调用写入失败直接抛错，useEffect 仅负责普通输入持久化补齐，不能作为 mutation 前的保障。

- [ ] 原缓存测试增加旧 v1 无建档兼容、完整新草稿/不完整编辑字段回读、损坏/未知字段拒绝、PDF/凭据拒绝、存储抛错返回失败；原 Provider 测试增加 active intention 已存在但仍有草稿不被清掉。
- [ ] 运行 `npx vitest run src/数据/资料缓存.test.ts src/状态/应用状态.test.ts src/状态/后端/会话操作.test.ts` 确认反例。
- [ ] 逐字段白名单读写 Global 7；移除 `资料持久化` 中“任一 active 意向即删除草稿”的判断。保持首次读取完成前禁止把空初始态覆盖存储的原 barrier。
- [ ] 原会话清理路径清当前 owner 草稿和内存，模式/环境/role 隔离；hydrate authoritative 与本地 draft 分开，恢复后 draft 只供原编辑表单，不假写 server snapshot。让同步更新函数与 ref 立即一致，不等 React 下一帧。
- [ ] 测试 A→B 后迟到响应/旧 effect 不写 B、不恢复 A；刷新教育编辑层保留只填了一半的字段；未知命令槽不被第二次请求覆盖。重跑所列测试与 typecheck。
- [ ] 提交 `feat: retain scoped onboarding drafts`。

完成/停止：同步 write-before-send 可用、旧缓存兼容、隔离通过。若 storage 不可用，不删除内存输入或照发需要恢复保障的 mutation；用既有轻提示告知失败，不能新建缓存降级框架。

### Task 3: 资料分区部分成功与原命令恢复

目标：保留所有成功条目的真实 ID/revision，GET 失败或刷新后不重复 POST，不把未保存部分吞掉。依赖：Task 1 URL 类型、Task 2 同步草稿/跟踪类型。

预期编辑文件：新增：无。删除：无。修改：`src/数据/招聘数据源/简历.ts`、`src/数据/招聘数据源/简历.test.ts`、`src/状态/后端/候选操作.ts`、`src/状态/后端/候选操作.test.ts`、`src/状态/后端/类型.ts`。

接口：`简历数据源.保存简历(next, previous, 跟踪?)` 使用 Global 5；面向页面 `操作.保存简历(next)` 不变。原条目 mutation 的 `entry.kind`、对应 entry.id/revision、aggregate_revision 先交回执，再下一步；profile/summary/skills 的返回按现有 BFF简历提取对应 revision。输入/回执类型在现有类型文件中使用闭合域枚举，不增加随意 path 的恢复方法。

- [ ] 用原 fake 请求测试“education POST 201→下一条失败→GET 失败→重试”、“experience 成功→project 未知”、“POST 回执后刷新”。断言同本地条目始终一条服务器资源、原 key/body 保持、已收 receipt 不再 POST。
- [ ] 运行 `npx vitest run src/数据/招聘数据源/简历.test.ts src/状态/后端/候选操作.test.ts` 看到新增反例失败。
- [ ] 仍在原分区 diff 中先物化/校验全部 body；每个实际请求前走跟踪，成功后立即保留条目映射及 revision，之后才 GET。完整教育参与保存；不完整输入仍是草稿，不用 GET 抹掉；新经历 ID 在项目发出前落存储。
- [ ] 跟踪存在且槽未结算，原保存方法先按闭合种类结算该步骤；创建复用原 key，CAS 只读核对目标字段，冲突保留用户编辑并报错。禁止本次整体重跑已确认条目，禁止把意外其他资源的 revision 当本命令 receipt。
- [ ] 保留旧非 onboarding 保存调用；原 `简历保存` 锁冲突不能 `return` 假成功，返回明确 busy 错误且页面不推进。补 subject/session fence，Summary 保存不覆盖草稿 URL 或其他未提交字段。
- [ ] 同命令通过、typecheck 通过；提交 `fix: retain onboarding resume write receipts`。

完成/停止：新增/嵌套/部分成功/重复点击/切账号反例均能证实。无可安全核对的 CAS 冲突留在原页，不改为覆盖别人数据，不实现跨资源回滚。

### Task 4: 在现有资料页与编辑层接入草稿及保存

目标：学生/社招完整教育可保存、无经历可下一步、刷新返回不丢输入，原 Mock 布局不变。依赖：Task 1–3 的映射、草稿、保存方法。

预期编辑文件：新增：无。删除：无。修改：`src/屏幕/基本信息.tsx`、`src/屏幕/求职状态.tsx`、`src/屏幕/最高学历.tsx`、`src/屏幕/毕业院校.tsx`、`src/屏幕/选专业.tsx`、`src/屏幕/就读时间段.tsx`、`src/屏幕/工作经历.tsx`、`src/屏幕/基本信息.test.tsx`、`src/屏幕/求职状态.test.tsx`、`src/屏幕/最高学历.test.tsx`、`src/屏幕/毕业院校.test.tsx`、`src/屏幕/选专业.test.tsx`、`src/屏幕/就读时间段.test.tsx`、`src/屏幕/工作经历.test.tsx`、`src/流程/onboarding配置.ts`、`src/流程/onboarding配置.test.ts`。

接口：消费 `更新候选建档草稿`、`保存简历`、原预填 confirmed 分区；每次输入更新对应草稿字段，保存只处理本次明确提交的输入。编辑器原字段映射到 Global 7 的 `编辑中`，保存成功清该层草稿，取消明确丢弃该层；不新增编辑组件。

- [ ] 原页面测试补：学生预计毕业、社招无工作经历、未选出生年月不写、缺学校/专业引用阻止提交、选后修改文字取消旧引用、刷新未完成编辑恢复、保存失败不推进。
- [ ] 运行 `npx vitest run src/屏幕/基本信息.test.tsx src/屏幕/求职状态.test.tsx src/屏幕/最高学历.test.tsx src/屏幕/毕业院校.test.tsx src/屏幕/选专业.test.tsx src/屏幕/就读时间段.test.tsx src/屏幕/工作经历.test.tsx src/流程/onboarding配置.test.ts` 确认新增失败。
- [ ] 保留已有题序/路由，只替换 state 初始化、onChange、save、next。学校/专业 Backend 搜索结果接原 Mock 行，删 Backend 多出的副行；真实地点通过已有文字位置表达，同名按 ID 选择。无承载能力记具体 PM_BLOCKED，不设计层。
- [ ] 复用 `教育编辑页`、`经历编辑页` 和已有项目/证书字段控制；还原打开层和输入。空工作经历不创建空条目；不完整教育不得靠 next 跳过最后门槛。保存错误经既有轻提示，按钮 busy 不产生成功导航。
- [ ] 重跑同命令，检查所有修改没有 CSS/Mock 布局变化。普通 `我的简历` 消费若被影响补跑 `npx vitest run src/屏幕/我的简历.test.tsx`，不为通过改其业务规则。
- [ ] 提交 `feat: wire existing candidate profile forms`。

完成/停止：真实数据选择/保存控制有证据，无需工作经历即可前进；PM 缺口独立记录不算通过。组件不够用时停止该控件实现，其他页面继续。

### Task 5: 职位与城市接原 Mock 展示和真实目录

目标：消除本轮职位/城市 Backend 重复展示，实现稳定 ID、多层目录、分页及返回；不统一原本不同的页面设计。依赖：Task 1 has_children/Location 契约、Task 2 草稿。

预期编辑文件：新增：无。删除：无。修改：`src/屏幕/引导问答.tsx`、`src/屏幕/选期望职位.tsx`、`src/屏幕/选工作城市.tsx`、`src/屏幕/城市查询钩子.ts`、`src/屏幕/引导问答.test.tsx`、`src/屏幕/选期望职位.test.tsx`、`src/屏幕/选工作城市.test.tsx`、`src/屏幕/城市查询钩子.test.ts`。

接口：原 `期望职位题`/`方向细选页`/`城市题` 只加目录数据和事件参数；选中引用仍 `{id,display_name}`。同名两条可独立移除，目录页 `{items,nextCursor,catalogVersion}`；已有 query hook 防迟到结果，默认 q 缺省。给现有滚动容器加事件不改 DOM，不新建通用目录 hook。

- [ ] 原测试补真实根→中间→可选节点、selectable 与 has_children 分离、同名不同 ID、换词后旧页迟到；Backend 当前定位“暂未获取定位”不能选出上海；默认热门/行政区均来自返回字段。
- [ ] 运行 `npx vitest run src/屏幕/引导问答.test.tsx src/屏幕/选期望职位.test.tsx src/屏幕/选工作城市.test.tsx src/屏幕/城市查询钩子.test.ts` 验证新增失败。
- [ ] 删除独立 Backend 早返回布局，数据映射接原 Mock JSX/现有函数。缺说明传空内容不补 Mock 描述；根/子/搜索均走目录 API，不硬编码层数或全国全量预取。
- [ ] 页尾继续加载只用现有分页位置或滚动事件；游标归原查询，加载中锁防重入，异常可用既有提示后再次滚动/原动作重试。不能滚动且无分页能力的入口记 PM 缺口，不加“加载更多”节点。
- [ ] 测试日常来源参数、单/多选、返回路径不变；原上限不变，仅首次意向消费首选职位而非批量。重跑同命令并对照 Mock JSX/className diff。
- [ ] 提交 `refactor: reuse onboarding mock directory views`。

完成/停止：两模式实际共用各自原入口展示，真实引用与加载反例通过；不得以视觉近似的两份 JSX 交付，不通过更新截图授权改布局。

### Task 6: PDF 授权、exact source 与手填恢复

目标：真实上传/替换/解析精确关联本次源，预填不覆盖手改；manual 分支独立通行。依赖：Task 2 跟踪及原 `候选预填恢复元数据`，Task 3 回执语义，Task 4 表单确认字段。

预期编辑文件：新增：无。删除：无。修改：`src/屏幕/学生分流.tsx`、`src/屏幕/学生分流.test.tsx`、`src/数据/招聘数据源/附件简历.ts`、`src/数据/招聘数据源/附件简历.test.ts`、`src/状态/后端/附件简历操作.ts`、`src/状态/后端/附件简历操作.test.ts`、`src/状态/后端/简历预填操作.ts`、`src/状态/后端/简历预填操作.test.ts`、`src/状态/后端/类型.ts`、`src/流程/候选Onboarding预填边界.tsx`、`src/流程/候选Onboarding预填边界.test.tsx`、`src/流程/候选Onboarding简历预填.ts`、`src/流程/候选Onboarding简历预填.test.ts`、`src/数据/候选Onboarding预填恢复.ts`、`src/数据/候选Onboarding预填恢复.test.ts`。

接口：文件数据源原参数后加可选跟踪；FormData create/replace 继续 `processing_consent_confirmed=true`，parse body `{version_id,processing_consent_confirmed:true}`，已有 Origin/key/If-Match 规则不变。`激活候选Onboarding预填(source?: 候选预填绑定来源)` 允许明确 source；无 source 的 arming 只等本次上传 receipt，不能认领 items[0]。已有 exact source 元数据是唯一持久化来源。

- [ ] 原测试补未授权零上传/parse，fileA→fileB 后 A 迟到失效、receipt 后 GET 失败仍保留 file/version/parse、刷新处理中恢复/手填、正文建议不进 session、用户手改已 confirmed 不被自动替换。
- [ ] 运行 `npx vitest run src/屏幕/学生分流.test.tsx src/数据/招聘数据源/附件简历.test.ts src/状态/后端/附件简历操作.test.ts src/状态/后端/简历预填操作.test.ts src/流程/候选Onboarding预填边界.test.tsx src/流程/候选Onboarding简历预填.test.ts src/数据/候选Onboarding预填恢复.test.ts` 确认反例。
- [ ] 原上传/替换/parse 请求接跟踪；解析只针对 receipt 的版本，版本变化作废旧轮。unknown 文件恢复需原字节核对并沿原输入重新授权/选择，不因库最新行与名称相似认定本次创建。
- [ ] 原确认/等待层接 retry/manual，继续手填作废本轮自动消费但不声称取消后台解析。手填后迟到结果不覆盖，恢复来源不可用则明确失败/手填，不静默换源。
- [ ] 同命令通过；按最小现场验证读取实际 BFF consent/source 响应，真实 provider `parser_invalid_output` 单记 FAIL，后续依赖 BLOCKED，fixture PASS 不能抵扣。
- [ ] 提交 `fix: bind onboarding pdf to exact source`。

完成/停止：前端 source/授权/恢复确定性证据通过；真实解析失败按批准边界留后端另立任务，不能为达到“完成”绕过授权或冒用建议。

### Task 7: 首次意向、私有诉求与权威屏蔽状态

目标：只创建并核对本次首条意向；四张偏好卡进入私有诉求；屏蔽不假成功。依赖：Task 1 映射、Task 2 跟踪草稿、Task 3 回执、Task 4/5 用户输入。手动新增选择 UI 受 Global PM_BLOCKED 约束，不引入新导航。

预期编辑文件：新增：无。删除：无。修改：`src/屏幕/引导问答.tsx`、`src/屏幕/引导问答.test.tsx`、`src/数据/招聘数据源/意向.ts`、`src/数据/HTTP招聘数据源.test.ts`、`src/状态/后端/候选操作.ts`、`src/状态/后端/候选操作.test.ts`、`src/数据/招聘数据源/隐私.ts`、`src/数据/招聘数据源/隐私.test.ts`、`src/状态/后端/隐私操作.ts`、`src/状态/后端/隐私操作.test.ts`、`src/状态/后端/类型.ts`、`src/数据/后端映射.test.ts`。

接口：Global 3、5、8；`读取意向(id)` GET `/api/v1/me/intentions/{id}`，`创建首次意向` 原返回类型不变，但 POST 的 id/revision 必须先写草稿。屏蔽只用稳定 organization_id + source=manual + privacy revision + 原 key，解除沿已有风险确认/来源推导；不把字符串公司名传作 ID。

固定拼接按卡片顺序：`大小周`→`不接受大小周`；`纯外包 / 乙方`→`不接受纯外包/乙方`；`全现场办公`→`不接受全现场办公`；`频繁出差`→`不接受频繁出差`。已选行随后附用户自定义原文，分隔符 `\n`；不添加“其他排除：”，不拆改用户原文内部换行。自定义全空白段不产生诉求。不得将历史自定义字串按名称误当卡片；不迁移既有历史硬排除。

- [ ] 补测试 POST 201 后 GET 失败、刷新后 exact ID 读取、503 同 key 重试；列表有另一 active 意向不视作本次成功；快速双击不重复创建；Summary 失败不重建意向。
- [ ] 补四卡顺序+自定义多行逐字对比、excluded 空数组；社招公司名称不默认已屏蔽/不自动写，失败不加成功 chip，解除成功才移除。
- [ ] 运行 `npx vitest run src/屏幕/引导问答.test.tsx src/数据/HTTP招聘数据源.test.ts src/状态/后端/候选操作.test.ts src/数据/招聘数据源/隐私.test.ts src/状态/后端/隐私操作.test.ts src/数据/后端映射.test.ts` 确认新增反例。
- [ ] 原向导 state 接草稿，个人优势/URL 在原输入位置保存。已 receipt 的意向只 GET exact ID，不“列表非空就 return”。unknown 不换 key，普通意向 CRUD 不接本轮草稿逻辑。
- [ ] `排除题` 原 chip 用真实确认屏蔽快照派生，待提交/错误用现有禁用/提示承载。一键无法明确组织时阻止写并提示须明确选择，禁止自动搜索首命中；新增选择缺口原位记录，不能宣布该部分闭环通过。
- [ ] 同命令通过，普通消费者追加 `npx vitest run src/屏幕/添加意向.test.tsx src/屏幕/求职意向管理.test.tsx src/屏幕/屏蔽名单.test.tsx` 仅证明共享行为未破坏；提交 `feat: wire first intention without duplicate creation`。

完成/停止：首次意向 ID/revision 与私有语义准确；真实屏蔽新增仍 PM_BLOCKED 时如实保留，不把普通屏蔽名单 fixture 通过当 onboarding 新增通过。

### Task 8: 头像沿原控件保存并准确处理未知结果

目标：头像可选，已选文件不能静默丢弃；unknown 不凭 revision 变大猜成功。依赖：Task 2 单槽、Task 3 跟踪规则。

预期编辑文件：新增：无。删除：无。修改：`src/屏幕/添加头像.tsx`、`src/屏幕/添加头像.test.tsx`、`src/数据/招聘数据源/候选账号.ts`、`src/数据/招聘数据源/候选账号.test.ts`、`src/状态/后端/候选操作.ts`、`src/状态/后端/候选操作.test.ts`、`src/状态/后端/类型.ts`。

接口：`保存候选头像(file):Promise<void>` 不变；数据源 `替换候选头像(file: File, revision: number, 跟踪?: 建档写入跟踪): Promise<BFF候选账号档案>`。POST multipart `media`，沿原 MIME/10MiB 限制，保存原 revision/key 与文件 SHA-256 metadata；字节只在内存。

- [ ] 原测试增加未选可完成、提交中锁住完成、503 后 account revision 增且 avatar 非空仍不能证明本文件成功、用户重选同 bytes 复用原 key/ifMatch、不同比特拒绝重放、切账号迟到不水合。
- [ ] 运行 `npx vitest run src/屏幕/添加头像.test.tsx src/数据/招聘数据源/候选账号.test.ts src/状态/后端/候选操作.test.ts` 确认新增反例。
- [ ] 删除 `revision增加 && avatar_url非空` 的成功推断，只使用已确认原请求 receipt 或原 key 重放 receipt；读 account 仅为权威回显。原上传圆位/文件框允许重选，原提示说明恢复所需操作，不添加新按钮。
- [ ] 若用户明确放弃使用既有确认层的已存在能力；如果原控件没有合法放弃入口，则该放弃交互记具体 PM 缺口，保持“待核对”不能静默完成。未选始终不受影响。不得把稳定头像 URL 当文件内容哈希。
- [ ] 同命令通过；提交 `fix: preserve onboarding avatar write identity`。

完成/停止：未选与成功上传路径正常；未知结果不伪成功。不得为恢复持久化 raw/data URL，不修改头像布局。

### Task 9: 完成资源核对与恢复落点

目标：原“完成注册”先核对本人真实资源，再进入原初始化；刷新/重登正确恢复，不被任一意向存在跳过。依赖：Task 4–8；生产 Global 8 的完成操作。

预期编辑文件：新增：无。删除：无。修改：`src/屏幕/添加头像.tsx`、`src/屏幕/添加头像.test.tsx`、`src/屏幕/披露说明.tsx`、`src/状态/后端/候选操作.ts`、`src/状态/后端/候选操作.test.ts`、`src/状态/后端/类型.ts`、`src/应用.tsx`、`src/应用.test.tsx`、`src/流程/候选Onboarding预填边界.tsx`、`src/流程/候选Onboarding预填边界.test.tsx`、`src/状态/资料持久化.ts`。

接口：`完成候选Onboarding():Promise<void>` 在当前 scope 和无未结算/未明确放弃输入时，读取 resume 与草稿首次意向 exact ID；验证必填 profile、至少一条完整教育、对应 active 意向与本次选择/薪资/初筛/private诉求、已选附件/头像/屏蔽等变更有确认事实。summary/URL 非空并已提交的输入回读一致。未选可选项无需创建资源。成功才同步删建档与预填恢复、返回；页面 await 后沿原 `进初始化()`，失败仍在原页面，经既有提示指出缺项，不另造完成页。

- [ ] 原测试新增 active intention 已有但教育不完整/待写入未知/Summary 失败时不进初始化；真实完成后空推荐和推荐错误均不阻塞；重复完成只一次导航；换账号期间 GET 完成不导航。
- [ ] `应用` 测试覆盖刷新任一候选页恢复 pathname/search/题序/编辑中；直接访问主壳/初始化且 active 草稿未完成不能绕过；已完成老账号无草稿继续主壳，不因为没有“本次 id”重做 onboarding。
- [ ] 运行 `npx vitest run src/屏幕/添加头像.test.tsx src/状态/后端/候选操作.test.ts src/应用.test.tsx src/流程/候选Onboarding预填边界.test.tsx` 验证新增失败。
- [ ] 实现上述完成方法与已有路由恢复边界，水合未结束不先挂空表单又卸载；用现有加载/确认能力。保留学生/社招题序；常规返回/选择子页不清草稿。披露按钮仅接已有披露规则和保存控制，不新增披露项。
- [ ] 无当前草稿的新候选按必要资源是否完备落既有开始页；已有完整资源无草稿按原主壳。局部保存中的用户只能从明确保存动作继续，不设置客户端“completed”假服务端事实。
- [ ] 同命令通过并 `npm run typecheck`；确认初始化文件无 diff；提交 `fix: verify candidate resources before onboarding completion`。

完成/停止：只按真实必要资源放行，剩余输入事实明确；不查推荐作为门槛。PM 缺口不能绕过后写“旅程全完成”。

### Task 10: 固化定向浏览器与真实验收断言

目标：补本旅程确定性浏览器反例及真实场景指引，覆盖两个分流/恢复/展示；不新增测试平台、不在 Task 内执行收尾全套。

预期编辑文件：新增：`e2e/J-PILOT-02接线.spec.ts`。删除：无。修改：`e2e/onboarding.spec.ts`、`docs/dogfood/backend-local-onboarding.md`。本 Task 不修改生产组件、CSS、视觉基线或 CI 配置。

接口：沿已有 Playwright app 启动配置和 request interception，以稳定测试 id/name 使用现有 UI；fixture HTTP 仅用于可复现边界，真实 dogfood 所有业务 mutation 经 UI，同主体 GET 可验证，不能脚本补资料/意向绕过。

- [ ] 新文件沿原 `e2e/onboarding.spec.ts` 的装载方式补学生/社招手填、education POST 后读取失败刷新不重复、头像 unknown 不能完成、同数据 Mock/Backend 共用布局四类场景；使用测试专用数据，route mock 绝不作为真实 provider 证据。
- [ ] 更新原 Mock 旅程断言仅修选择器/合法状态差异，不改布局预期。新增精确断言：零工作经历可以下一步，至少一教育，首次意向仅一 POST/一个 id，URL 清空/省略行为正确，恢复题序/编辑文本不丢。
- [ ] 运行 `npx playwright test e2e/onboarding.spec.ts e2e/J-PILOT-02接线.spec.ts`；新增用例先体现缺陷/断言必要性，已有实现已通过时不人为改坏产品制造 RED。证据注明 fixture 模式。
- [ ] 在现有 dogfood 文档 `CAND-ONB-001` 增学生/社招/no-PDF/PDF 分支，取消把恰好一工作经历/技能/证书当完成门槛的旧断言。只读回查教育完整、exact intention、URL、privacy、头像，刷新/重登/换角色隔离；不改招聘方 case 规则。
- [ ] 增可见 Chrome 390×844 与320窄屏检查，当前定位缺失状态、真实长名称、滚动/返回、Mock 基线无布局 diff。对比 same display fixture 两模式；真实 Backend 单独验可用性。记录已知 PM_BLOCKED 控件并禁止统计为 PASS。
- [ ] 增 Highlights 只读检查：候选 onboarding/本人简历无新增标签；既有合法招聘 reader/projection 的 stable 标签与来源 exact file/version/parse 一致；无合法招聘场景即该分支 BLOCKED，不创建岗位/Case。不发送 Highlights 候选编辑 PUT。真实 parser_invalid_output 明确 FAIL，依赖步骤 BLOCKED，固定862注明本轮延期。
- [ ] 提交 `test: cover candidate onboarding wiring boundaries`。开始收尾前自查 Spec §9 覆盖映射：AC1–15 对应 Task 1–9 及本 Task；AC16仅资源门槛；AC17/18及 Highlights按真实证据独立结论，绝不汇总成无例外全通过。

完成/停止：确定性浏览器用例与真实入口可执行且断言一致；不宣称尚未执行的 L3 或 provider 通过。缺环境不创建第二套 runner，交收尾记录具体责任。

## 实施后收尾（不计入 Task count）

1. 完成执行 skill 要求的宿主内全局 review（未要求则不额外添加），退出 Task 循环；以下覆盖其默认 finishing-a-development-branch，不再加合入菜单或整套测试。
2. 同一主控自动调用异构只读 review-loop（Codex→Claude，Claude Code→Codex），输入固定候选 diff、批准 Spec、本文最终对象和共用 `../_shared/review-contract.md`；reviewer 不跑测试。轮次、裁决、停止依该 skill，轮间仅修复相关单测/静态检查，不运行完整 affected。不得为凑零建议扩大设计。没有未解决有效 required finding 后继续。
3. 计算本次变更与消费者的最小充分 affected，按“验证选择与责任”完成适用 L0–L2，复用有效 Task 证据，不重复 raw/wrapper。修复后只重算失效项，不重新进入 Task/global/review 循环。证据缺口、PM_BLOCKED、真实后端依赖逐项明示，不把缺证据写 ready。
4. **人工 final gate**：准备具体 candidate SHA、只读 fetch 后目标 SHA、测试 selection/receipt/复用依据、L3 选择/环境/顺序/预期证据、当前 PM/后端阻塞和预计合入动作，再请用户明确确认。为何需此确认：`development-workflow` 的 `assets/execution-contract.md` §7 要求 final gate；只在实施收尾提出，不在写 Plan 时额外审批。确认前不合 target、不正式 L3、不 push。
5. 获批后按该 skill `references/final-integration.md`：fetch 实际 target，记录 final_target_base，合 target 到候选；按 INCREMENTAL_EVIDENCE 重算完整责任，核对依赖输入/runtime/fixture/cleanup 后复用有效 L0–L2，只补缺失失效子集。入口不支持所需子集时报告限制，不自动整层重跑。
6. 执行本 Plan 选定的 required/conditional 正式 L3；实际问题按批准范围修复，后端根因和 PM 缺口保持独立结论。cleanup 后再次对账证据失效，必要时只补受影响项；确认后不再异构 review。目标若推进重新同步核对，不 force push，普通 fast-forward push 成功后才报告已合入。发布/deploy 不在本轮。
7. 测试 runtime 证据放 `dogfood-output/<run-id>/` 等现有忽略位置，长期脱敏记录沿仓库既有约定；不新建额外 planning handoff/review/validation 文档。最终说明已做/未做、PASS/FAIL/BLOCKED/PM_BLOCKED、862延期、真实PDF结论及 Git 合入事实。

## 文档 review 与裁决记录

规划自检：本文只有10个编号实施 Task；生产代码/组件新文件为零，不修改 CSS、初始化与视觉基线；新增文件仅本 Plan、后续唯一双宿主 prompt 及实施 Task 10 的测试。已明确组织选择尚未批准，不把待定方案暗写成实施授权。未运行产品测试或浏览器。

异构文档 review：尚未执行；冻结候选后按 development-workflow 自动调用 Claude 只读 review，裁决在本节原位追加，完成后才生成执行 prompt。
