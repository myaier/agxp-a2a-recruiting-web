# 候选资料编辑与代理卡统一实施计划

> **For agentic workers:** REQUIRED SUB-SKILL：Claude Code 使用 superpowers:subagent-driven-development；Codex 使用 superpowers:executing-plans。按编号 Task 执行，收尾不计数。

**Goal:** 修复简历编辑越界、意向私有文本编辑、技能与证书样式差异、个人优势缺失入口，以及代理卡 Backend 文案。

**Architecture:** 保留现有页面及数据源；URL 显式表达日常编辑来源，资料页只在对应场景结束编辑。一个轻量标签录入组件复用技能与证书 UI；个人优势复用既有向导正文，单独隔离保存行为。城市修复由其它分支承接，不重复实施。

**Tech Stack:** React 19、TypeScript、React Router、Vitest/Testing Library、Playwright，现有 BFF 数据源。

**Spec:** `docs/superpowers/specs/2026-09-15-candidate-profile-edit-boundaries-design.md`；批准 revision `3c48e7d5f3f12056a71f9f6d4b5c5cb1a56b9913`，blob `e06bc1beffb185b39b7978a0f885dbaa375a0af2`。用户确认“在线”字样和绿点固定保留，随后要求按 development-workflow 写计划。

## Global Constraints

- 工作区 `.`，仓库 `myaier/agxp-a2a-recruiting-web`；目标 `origin/main`。规划代码基线 `4939af8a2971a4a918f2e9d5586d9d022ed3c7a3`。仅文档规划，无产品验证 PASS。
- 完整读取 `CLAUDE.md`、`AGENTS.md`。Spec 与 Plan 版本按 Git 对象核对，不能用别处最新文档代替批准版本。
- 保留历史 exclusions，零迁移／清理；首次 onboarding 卡片及原流程保留。私有偏好是文本，不是结构化规则。
- “在线”与绿点按本次明确产品要求保留；不得以历史真实性测试为由恢复“当前 MatchCase”，也不新增 presence API。
- Backend 使用真实已水合值，失败保留草稿与既有错误；不填演示数据。Mock 零 Backend 请求。不得为了复用 UI 将证书对象简化成字符串。
- 不修改后端 API、schema、依赖版本、测试框架、全局表单系统。原有抽屉／全屏选择的内部确认不等于整份简历提交。
- 日期／目录组件与城市名称存在并行任务：`investigate-drawer-background-shift`、`audit-option-components-editors`。规划时已知代码分别为 `9f7610cc`、`d5cddeb0`，只是中途快照，不能冒充最终依赖。开工只读核对实际目标是否已包含两分支最终相关改动及测试；若未包含，不私自合入未完成分支。可先执行不依赖它们的 Task 5；Task 1–4 等相关文件基线明确后实施。将实际依赖提交与核验结果写本 Plan 运行记录，不新增交接文件。仅等价组件演进无需重批；行为/schema/覆盖义务改变须修订契约。
- 城市外部责任：`docs/superpowers/specs/2026-09-15-editor-catalog-fullscreen-design.md` §5.6、对应 Plan Task 6。已知其范围含 22 项权威名称、四处消费者与 Mock 有限兼容。缺少最终实现时城市仍未完成，不将本任务测试当作其完成证明。
- 开工按逻辑 development-workflow skill 的 `scripts/task_intents.py` 登记／更新改动预告；保护其它工作，不 stash/reset/clean、不新建第二个用户工作区。共享固定 E2E 端口 4173/4181/4182/4183 与其它会话错开运行，不杀未知进程。

## Task index

Task count: 5
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|简历编辑来源与保存出口；依赖资料页最终基线|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|2|意向私有筛选文本；依赖抽屉最终基线，串行避免共享文件竞争|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|3|技能证书标签组件；依赖 Task 1 的工作经历版本|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|4|个人优势入口与保存隔离；依赖 Task 1 编辑来源契约|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|5|代理卡文案及真实数字；无产品代码依赖，可先行|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|

三角色选择依据：实现与审查均需识别现有状态、水合及并行改动边界；无需新增架构。默认串行，不制造并行合并成本。

**计划本身复杂度：中。** 跨五处 UI 行为及已存在的恢复边界，均为局部修改。
**零上下文漂移风险：中。** 依赖两个在实施中的分支，需核对最终组件版本；产品输出与数据契约已冻结。
执行模型使用当前可用的行业 Top 5–10 中高性价比模型，仅按漂移风险选择。

## 测试选择与权威验收

1. 要防的失败：简历编辑写首次意向／进入向导、刷新丢模式、清空私有文本却回退旧值、证书元数据丢失、旧主体统计泄露。各 Task 用最小组件／映射用例作反馈，不重复验证框架实现。
2. 最小合法命令见每 Task。先跑新增反例确认红，再最小实现；定向通过后只因新修改／失败扩大范围。读取 e2e 文件与 `--list` 校对 consumer，不能 grep 0 tests 算通过。
3. URL、恢复边界和真实序列化变更必须提前用现有 provider/映射与浏览器覆盖，不能只 tsc。保存个人优势只调用既有操作，但需检查其 side effects；若发现无法隔离引导写入，先定位最小数据源修复，记录范围变化后再写，不能绕过已有认证/revision保护。
4. 最终责任：实施者完成相关组件、类型与浏览器验证，随后人工 final gate；真实 Backend 验收按 `docs/dogfood/真实后端行为验收.md` 的 B01/B02 相关节点与本任务定向扩展执行，不声称跑了完整 B02 附件／披露链。发布另属授权流程。
5. 已有 main 的 E2E realignment 文档说明旧 fixture 修复已合入；它不证明本改动通过。本任务测试耗时未知。无目的全量像素比对、全量 Backend suite 都不安排。

### Task 1: 简历编辑显式来源与保存后返回

预期编辑文件：新增无；修改 `src/屏幕/我的简历.tsx`、`src/屏幕/基本信息.tsx`、`src/屏幕/工作经历.tsx`、`src/屏幕/求职状态.tsx`、`src/流程/候选Onboarding预填边界.tsx`、`src/应用.tsx`、`src/应用.test.tsx`、`src/屏幕/我的简历.test.tsx`、`src/屏幕/基本信息.test.tsx`、`src/屏幕/工作经历.test.tsx`、`src/屏幕/求职状态.test.tsx`、`src/流程/候选Onboarding预填边界.test.tsx`、`e2e/数据源模式.spec.ts`；删除无。应用中三个活跃位置判定调用均须传入 `位置.pathname + 位置.search`；清理 effect 的依赖与去重键同步使用完整位置。不重构路由。

目标：从简历资料入口保存只回简历；非目标：不改首次引导题序、全局未保存拦截或子编辑器保存机制。

输入/输出契约：`from=resume` 是唯一日常编辑标记，使用 useSearchParams/useLocation 读取，不能用 引导预填 非空推断。我的简历的基本信息、工作经历、求职状态全部入口带该参数；显式添加意向入口不带。URL 刷新保留模式。沿用 `保存简历` 参数与 `路径.我的简历`；不新增服务端字段。`是预填消费位置(pathname, search)` 对编辑标记返回 false；活跃位置判定对带编辑参数的完整位置返回 false，保留原无参数结果及应用离开引导清理。

- [ ] 核对上游资料／日期控件与测试已在实施基线；读取四屏、预填边界及应用调用。记录版本；未取得最终版本停止相应文件修改。
- [ ] 在现有测试构造 MemoryRouter 带 `from=resume` 入口，覆盖基本信息／工作经历／求职状态学生与社招成功保存、失败留页、刷新模式与完整度跳转；旧无参数成功用例继续断言原出口。断言日常模式零更新建档、零确认分区、零到岗预填。
- [ ] 执行下述 Vitest，确认新增用例因当前旧跳转／副作用失败，不接受桩缺方法造成的红。
- [ ] 入口拼接参数，三页增加窄编辑分支；日常模式旅程判定为 false。基本信息／求职状态按钮为“保存”；保存成功到简历。基本信息空身份保留当前延迟 profile 写入路径，去带参数的求职状态后保存收口，不能跳过必填。求职状态保存成功后在派发到岗预填之前结束日常分支。分区确认仅 onboarding 执行。
- [ ] 修改预填消费／活跃判定，使刷新不恢复建议、已退出的引导状态不因资料路径又被当作活跃。保留所有无参数正常引导恢复用例。在 `src/应用.test.tsx` 增加同 pathname 从无参数切到 `from=resume` 的用例，验证退出引导清理执行、编辑位置不再写入建档，防止只改纯函数却漏接调用方。
- [ ] 浏览器现有“核心编辑 简历行业”用例从我的简历点击进入，保存并重入验证；保留公司/行业目录 ID 与原负例，不用裸 `/experience` 冒充日常入口。新增小用例标签 `候选资料编辑边界 @backend`：已完成候选经基本信息保存回简历，首次意向写入零次；通过真实 UI 流程进入，fixture 使用现有安装函数，不导出新的模拟框架。
- [ ] 跑定向用例后提交 `fix: keep resume edits within resume flow`。

```sh
npx vitest run src/应用.test.tsx src/屏幕/我的简历.test.tsx src/屏幕/基本信息.test.tsx src/屏幕/工作经历.test.tsx src/屏幕/求职状态.test.tsx src/流程/候选Onboarding预填边界.test.tsx
npm run test:e2e:data-source -- e2e/数据源模式.spec.ts --project=backend-stg --grep '核心编辑 简历行业|候选资料编辑边界' --retries=0
```

完成：两种模式及学生／社招分支对应断言通过；如果共用路径恢复导致未授权首次写入，不通过删除断言或直接清全局数据绕过。

### Task 2: 意向私有筛选要求文本编辑

预期编辑文件：新增无；修改 `src/屏幕/添加意向.tsx`、`src/屏幕/添加意向.module.css`、`src/屏幕/添加意向.test.tsx`、`src/数据/后端映射.test.ts`、`e2e/数据源模式.spec.ts`；删除无。生产映射已支持空字符串，本 Task 不修改其逻辑。

目标：新增／编辑意向直接维护完整私有文本；非目标：不改 onboarding 卡片、exclusions、招聘侧字段或其 200 字限制。

输入/输出：从BFF意向草稿的 `私有偏好` 原样作为 textarea value，onChange 派发 `{型:'改意向草稿',补丁:{私有偏好:值}}`；保存仍走完整意向 body 与 If-Match。空串必须落 `private_preferences: ''`。当前规则库排除区不是这张表单，不修改。

- [ ] 读取添加意向草稿、保存与映射，核对上游毕业年月／实习抽屉版本。
- [ ] 替换旧后续卡片测试：文本含前导换行、尾空格及超过200字；完整回显→改写→序列化→保存重开；清空得到空串，原 exclusions 与其他字段不变。使用现有 reducer/映射链，避免只检查 mock setState。
- [ ] 执行下述组件/映射命令，确认 textarea 缺失或无法编辑整段的失败。
- [ ] 删除本页排除选项 import、固定排除键及拆行切换逻辑；增加标签“给 AI 代理的筛选要求”、旁标“选填”、说明“写下你的要求和偏好，AI 代理会据此筛选岗位。”、4行 textarea。按招聘页现有字体／间距／边框做局部 CSS，不直接移植 maxLength=200，不新增通用表单框架。
- [ ] 复用原有错误与草稿保留；浏览器添加 `候选私有筛选要求 @backend`，由意向管理打开现有意向，修改／清空→保存→刷新回读，检查 PATCH revision与其它字段保留；不通过API直接完成被测写入。
- [ ] 定向通过后提交 `feat: edit candidate private screening text`。

```sh
npx vitest run src/屏幕/添加意向.test.tsx src/数据/后端映射.test.ts
npm run test:e2e:data-source -- e2e/数据源模式.spec.ts --project=backend-stg --grep '候选私有筛选要求' --retries=0
```

完成：原文、空串、失败留页与历史字段保留均有断言。若接口拒绝既有合法文本，不自行截断，记录确切契约差异。

### Task 3: 技能和证书共用标签录入组件

预期编辑文件：新增 `src/组件/简历标签录入.tsx`、`src/组件/简历标签录入.module.css`、`src/组件/简历标签录入.test.tsx`；修改 `src/屏幕/工作经历.tsx`、`src/屏幕/工作经历.module.css`、`src/屏幕/工作经历.test.tsx`；删除无。

目标：两种旅程的技能与证书都用现有技能标签形式；非目标：不改证书存储、年份输入、我的简历展示卡或其它标签系统。

依赖：Task 1 最终工作经历版本以及上游教育／行业子视图。输入/输出冻结为轻量受控组件：`项们: {键:string;名称:string;补充?:string}[]`、`草稿:string`、`占位:string`、`删除名称:(项)=>string`、`改草稿:(值:string)=>void`、`添加:()=>void`、`删除:(键:string)=>void`；无内部持久化。技能键是原技能字符串；证书键为原编号，补充为已有年份展示。输入 Enter 且非 composing 才调用添加。布局 CSS 从现有技能卡迁移，避免两个样式副本。

- [ ] 新组件测试添加按钮／Enter／中文组合输入保护、逐项删除回调键、长标签换行；在工作经历现有集成用例中验证同名不同编号证书只删除目标，年份/编号保存不变，新证书年份空。
- [ ] 验证 onboarding `编辑中.certificate` 草稿恢复，添加后清理，日常编辑不写引导草稿。保留原技能去重与证书空白提示，不新增证书去重产品规则。
- [ ] 跑下述命令，确认失败来自新 UI 或真实行为差异。
- [ ] 实现受控 UI，两处调用保留各自数据处理函数；删除被迁移且无消费者的旧证书行/技能卡 CSS，保留仍有消费者的规则。新组件不查询后端、不创建证书 ID。
- [ ] 重跑定向测试；浏览器布局检查随 Task 1/最终资料编辑路径执行，无需新增独立长 onboarding 测试。
- [ ] 提交 `refactor: share resume skill and certificate tag editor`。

```sh
npx vitest run src/组件/简历标签录入.test.tsx src/屏幕/工作经历.test.tsx
```

完成：两种旅程同组件且原数据与恢复义务保持。若需要删除已存在年份或更改身份才能复用，停止并改回仅展示适配。

### Task 4: 个人优势独立编辑入口

预期编辑文件：新增无；修改 `src/屏幕/我的简历.tsx`、`src/屏幕/我的简历.module.css`、`src/屏幕/引导问答.tsx`、`src/屏幕/我的简历.test.tsx`、`src/屏幕/引导问答.test.tsx`、`src/流程/候选Onboarding预填边界.test.tsx`、`e2e/数据源模式.spec.ts`；删除无。

目标：个人优势有值/空值都可进入原优势题编辑界面，保存只改 summary；非目标：不新增整套编辑器、不改首次个人优势完成链、恢复或500字规则。

依赖 Task 1 的编辑标记与预填排除。固定 URL 为 `/wizard?from=resume`；在 wizard 内该参数唯一表示只编辑个人优势，题序直接为个人优势单题，不新增通用 stage 枚举。UI 初始文本为已水合 `全局.个人优势`，不消费候选预填或 Mock 默认建议。`保存个人优势(text)` 成功后到 `路径.我的简历`，不能执行首次意向、确认分区、作品集规范化或引导草稿写入。

- [ ] 读取优势题及 `src/状态/后端/候选操作.ts` 的保存个人优势副作用；日常输入状态应无 active 建档，保持其认证、序列化与权威读取。
- [ ] 编写入口有值/空值、刷新直接个人优势、取消零保存、失败留页、多行保存回读测试；明确 `保存首次意向`、`确认候选Onboarding预填分区`、`更新候选建档草稿` 均零次。用现有正常 onboarding 用例保留首次意向调用。
- [ ] 运行下述 Vitest 观察失败。
- [ ] 我的简历个人优势改 button 与可见编辑指示，空时“还没填写个人优势，去添加”；wizard 在 hooks 稳定顺序下按模式初始化题目及文本，日常保存分支提前结束并复用优势题 UI，按钮“保存”。日常不显示已从上传简历提取的说明和恢复动作；原 onboarding props保持。异步保存禁止重复点击，失败不清文本。
- [ ] 添加 `候选个人优势编辑 @backend` 浏览器用例：从我的简历卡片进入、保存、返回、刷新保持，首次意向POST为零；fixture 记录真实请求而非截断整个保存操作。
- [ ] 定向通过后提交 `feat: open standalone resume summary editing`。

```sh
npx vitest run src/屏幕/我的简历.test.tsx src/屏幕/引导问答.test.tsx src/流程/候选Onboarding预填边界.test.tsx
npm run test:e2e:data-source -- e2e/数据源模式.spec.ts --project=backend-stg --grep '候选个人优势编辑' --retries=0
```

完成：编辑入口无死区、刷新保留模式、日常零首次意向写入，首次引导仍完整。不要只把起始题改个人优势却继续执行原完成处理。

### Task 5: 代理卡保留 Mock 文案与真实数字

预期编辑文件：新增无；修改 `src/屏幕/我的.tsx`、`src/屏幕/我的.test.tsx`；删除无。

目标：Backend 与 Mock 同款卡片，固定在线字样及绿点，Backend换真实数字；非目标：不新增卡片抽象、presence API、不改四项统计或规则语义。

无其它 Task 依赖。N = `取P5Open统计(后端状态.P5摘要.candidate, 当前SubjectId).open`；M = 已水合的全局与意向级生效规则之和。成功N=0显示0，未开始/刷新/失败/owner不匹配继续显示—；M未水合时隐藏整段。Mock仍用在谈列表与其规则值，不借 Backend 发请求。

- [ ] 更新旧“当前 MatchCase”和禁止在线测试为 `在线 · 正在跟进 51 个机会`，保留“页面列表仅一页而 summary=51”的精确计数反例；断言绿点在两模式存在。规则成功但0条显示0，未水合不出现；更新失败/换owner中性数据用例。
- [ ] 跑下述命令确认旧文案造成失败。
- [ ] 共用当前 JSX，去掉在线绿点的模式分支，把机会数作为文案中的唯一模式变量；规则段保持水合 gate。注释说明固定产品展示，不伪称获得实时在线接口。
- [ ] 重跑测试后提交 `fix: align candidate agent card copy with mock`。

```sh
npx vitest run src/屏幕/我的.test.tsx
```

完成：真实数字和固定展示均满足用户选择；不得用 `状态.在谈列表.length` 替代 Backend summary，也不能为满足旧测试隐藏在线。

## 实施后收尾（不计入 Task count）

1. 完成宿主执行 skill 要求的 Task/global review 后退出实施循环；按宿主调用异构 review-loop（Codex→Claude，Claude Code→Codex），绑定上述批准 Spec 和固定候选 diff，使用逻辑 skill 根相对 `../_shared/review-contract.md`，reviewer 不跑测试。轮次、裁决与停止条件归该 skill；轮间只跑修复相关轻量验证。随后不返回 Task/global review，不调用默认 finishing 菜单。
2. 计算本次最终 affected，复用输入不变的 Task 证据，缺失项补验。基础静态命令 `npm run typecheck`、`npm run lint`、`git diff --check`。合并运行有失效输入的组件文件；不自动跑全部 Vitest。
3. 浏览器最小联合选集：`npm run test:e2e:data-source -- e2e/数据源模式.spec.ts --project=backend-stg --grep '候选资料编辑边界|候选私有筛选要求|候选个人优势编辑|核心编辑 简历行业' --retries=0`；先同命令 `--list` 确認非空。首次建档 consumer 为 `npm run test:e2e:data-source -- e2e/J-PILOT-02接线.spec.ts --project=backend-stg --retries=0` 与 `npm run test:e2e -- e2e/onboarding.spec.ts --retries=0`，前者覆盖恢复/写入，后者覆盖Mock正常出口。上游改变控件时先更新本任务实际消费者，不放宽业务断言。浏览器检查390与1280宽下标签长名称、证书年份、个人优势入口、文本框及代理卡，不做无目的全量视觉基线更新。
4. 城市 integration conditional：若城市分支已合入且本候选修改其共同消费者（工作经历等不算城市消费者，wizard算），核对最终城市实现版本与外部验收；最低检查 `npx vitest run src/屏幕/选工作城市.test.tsx src/屏幕/选择城市.test.tsx` 并在真实UI验证旧短名回显一致。若其未实现，记录城市外部责任未完成，不阻止五项独立修复的评审，但不能声明原全部问题完成；不擅自实施城市任务。
5. 以上适用 L0–L2 完成后，展示变更、异构 review 裁决、证据、依赖状态及具体合入方案，等待人工 final gate。确认前允许只读 fetch，不同步/合入 target、不正式L3、不push。
6. 确认后完整读取逻辑 development-workflow 的 `references/final-integration.md` 与 operative `assets/final-integration-contract.md`：同步target、记录 final_target_base、重算责任、有效证据零重跑，基准变化只补失效项；不自动重复全量测试。
7. development L3 **required**：依 `docs/dogfood/真实后端行为验收.md` 的账号/环境/资源/清理规范，选择 B01 资料与意向回读，B02候选资料/意向相关节点的定向扩展：从简历基本信息保存返回、证书添加删除还原、个人优势修改刷新还原、测试意向私有文本修改与清空刷新、代理卡对照summary和规则。逐节点记录，不把未测附件/披露记PASS。使用专用账号与受控临时对象，缺环境标BLOCKED，不拿intercepted E2E充当真实后端。学生/社招首次完整引导的真实重跑仅在恢复／首次写入代码被实质修改且组件/浏览器无法证明实际边界时选中；如发生此条件按该指南 onboarding范围执行并记录，不默认全跑。
8. cleanup后再次对账，核对 target未推进，普通fast-forward push，禁止force push。发布不在范围。修改、证据与最终提交记录到本Plan运行记录；runner输出沿用 `ui-regression-output/` 或真实指南指定位置，不新增独立总结文件。

## 文档 review 与运行记录

- 规划 owner 已自检五项 Spec 对应五个 Task，城市为外部依赖；用户明确在线覆盖旧断言。
- 文档 review：Claude opus/high，WORKFLOW_DOCUMENT_REVIEW，1轮。冻结候选 revision `342b14f4`，Spec blob `e06bc1beffb185b39b7978a0f885dbaa375a0af2`、Plan blob `79dcf46c`（完整指纹保存在该轮本机审查产物）；只读守卫通过，HEAD、工作树状态和文档指纹未变化，未运行产品测试。
- Finding R1-1：Minor／可选增强／optional／复杂度不变。活跃位置调用写成“仅当”会给执行者留下遗漏 search 的空间。已核对应用三处调用，接受并修正文档：明确三处传完整位置、清理依赖与去重同步，并补应用层回归义务。未改变批准产品契约。无有效 required 未解决项，按 review-loop 结束条件结束；无其它 finding。
- 实施依赖、每 Task 验证与 final gate 记录由执行者在发生时追加；本节不代表未运行事项通过。
