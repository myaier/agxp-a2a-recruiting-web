# 双端展示字段前端接线 Implementation Plan

> For agentic workers：按下方 Task index 实际调用对应执行 skill；Claude Code 使用 `superpowers:subagent-driven-development`，Codex 使用 `superpowers:executing-plans`。只在新实施会话执行，本规划会话不修改业务代码。

**Goal：** 将后端已实施的展示字段接到四个列表、独立职位/匿名在线简历及在谈资料 Tab；只填现有 Mock Up 的数据、控制和状态。

**Architecture：** 严格 DTO/解码 → 现有领域快照 → 纯映射 → 现有共享组件。详情正文只在详情请求读取，列表零逐卡补读。新增具体数据类型/解码/映射文件用于多个实际消费者，不增加 Provider、通用 schema 引擎、身份服务、视觉组件或 CSS module。

**Tech Stack：** TypeScript、React、Vitest/Testing Library、现有 Playwright 数据源模式入口。后端只读。

## Global Constraints

### 批准合同、基线与开工

- repository：`agxp-a2a-recruiting-web`；工作区：`.`；目标：`main`（远端 `origin/main`）。复用用户选定工作区，不创建第二个用户工作区，不 stash/reset/clean 用户内容。
- 批准 Spec：`docs/superpowers/specs/2026-09-11-recruitment-display-api-requirements-design.md`，revision `24223e382ddb57f6c578104ae65b9070c4856400`，blob `b688b2af82ffe09f3d6ecfacef42e5e2c400c91a`。当前 Spec 页首及 §11 可仅追加批准记录，产品合同仍取冻结对象。
- 前端已无冲突 rebase 的基线：`origin/main@5f6aabbdda0eb0f07550da5acc461aa4340dd3bd`。先读 `CLAUDE.md`、`AGENTS.md`、冻结 Spec、Plan Global Constraints/Task index/角色表和当前 Task，不依赖规划聊天。
- 后端合同已进入 `release/0.2.5@886e06837512bd8b08c4f10e010533baf89649dc`；路径相对外部 `agxp-monorepo`：`apps/recruitment-bff/openapi/mobile-v1.yaml`、`apps/recruitment/openapi/mobile-resources-v1.yaml`。本地位置通过环境 `AGXP_MONOREPO_DIR` 或用户提供的现有 checkout 发现，不硬编码规划机器路径。核对该 Git 对象中的合同；缺少冻结对象先获取，不能用更新的未核对合同替代。生产者已实施，不再提交后端字段需求或修改后端。
- 开工以 `git status --short`、`git rev-parse HEAD`、`git show 24223e382ddb57f6c578104ae65b9070c4856400:docs/superpowers/specs/2026-09-11-recruitment-display-api-requirements-design.md` 核对状态及批准内容；按逻辑 `development-workflow` 的 `scripts/task_intents.py start`（先读其帮助）登记范围，读取 active/paused intents。扩大路径前更新 intent 并检查冲突。不要创建旧批次 manifest/handoff。
- Task 之间串行提交和验证；共享类型与解码先闭环，再接消费者。各 Task 独立可测试，但不要求分批发布合同的两半。执行时若基线已有同等实现，核对接口与证据后跳过已满足步骤，不能重复实现。

### 不可变行为

1. 保持 Mock Up 的顺序、图位、字体、间距、颜色、按钮、原空态。没有槽的字段留在数据层。只扩展既有组件 props/节点；不新增视觉组件/卡片/信息区/CSS module，不调视觉容差，不以更新截图基线掩盖变化。真实内容可自然增高；不把后端字段全部变成标签。
2. 候选首页/历史仍使用 negotiations，全意向省略 `intention_id`；按 canonical `record_id` 导航，保留当前排序、分页、迟到响应围栏、retry/archive、轮询及未知提交核对。招聘在谈保留岗位范围。禁止重做 J-PILOT-01。
3. Case 展示是冻结快照；旧 `job_detail/candidate_resume=null` 不补读当前 Job/Resume/推荐。独立职位可按真实组织 ID 读公开企业；点 Case 公司按钮导航企业页可以读当前公开企业，但不得回写 Case 正文。
4. `match_score` 为当前查看者原推荐批次分；null 不造 0，真实 0 正常显示，不重算、不借对向分。分数不能充当匹配依据/AI 批注。
5. candidate_identity 严格解码并留在 Case DTO；本轮不显示姓名/头像、不请求身份头像、不将 name 传入旧 `真名` prop，不改变权限/披露控制，不接消息列表。自由文本原样转义，不自行脱敏或承诺匿名正文绝无身份事实。
6. 新 required 字段缺键/非法类型/枚举/嵌套仍抛现有协议错误；合法 null、[]、0、false 保留。没有旧后端兼容开关。局部公开企业/图片失败不击穿整页；业务主响应失败沿现有错误态。
7. 在线资料取本人保存内容；personal_highlights 仅取合法 PDF 标签，不能用推荐 highlights 代填。禁止新建发布/确认按钮。公司成立时间、发布人备注、项目独立日期、AI 批注延后；只有未来新增采集合同或 PM 槽位批准才重启。

### 冻结公共数据接口

新增 `src/数据/招聘数据源/展示资料.ts`，仅作具体 schema 解码，共享类型放 `src/数据/BFF契约.ts`。导出签名：`解公司摘要(input: unknown): BFF公司摘要`、`解职位资料(input: unknown): BFF安全职位资料`、`解候选在线简历(input: unknown): BFF候选在线简历`、`解候选身份(input: unknown): BFF候选身份`。函数接非空对象，外层 nullable 由调用方显式分支，不接受 undefined；沿现有协议错误工厂，不另设错误类别。复用现有 Catalog/媒体/摘要/发布人/硬条件类型与校验；必要的复用导出不移动整个模块。

| 类型/响应 | 精确形状与语义 |
| --- | --- |
| BFF公司摘要 / JobOrganizationSummary | 六键全 required：organization_id、display_name、company_size、funding_stage 为 string或null；industry 为 CatalogReference或null；logo 为既有 OrganizationMediaBody或null。媒体使用 BFF URL，不自拼对象存储 URL。 |
| BFF安全职位资料 / SafeJobDetail | 25 个 required 键：title、description、requirements、recruitment_type、category、location、office_location、workplace_mode、salary_lower、salary_upper、salary_period、annual_salary_months、campus_cohort、internship_months、onsite_days_per_week、experience_requirement、education_requirement、hard_requirements、structured_requirements_confirmed、keywords、organization、company_intro、office_address、benefit_codes、publisher_profile；每成员允许 null。枚举沿 CandidateJob；整数不能接受小数，布尔 false保留，keywords/benefit_codes 为 string[]或null；Catalog/硬条件/公司/发布人复用精确嵌套合同。 |
| BFF候选在线简历 / RecruiterCandidateResume | 七键 required：summary 为 RecruiterCandidateSummary或null；self_description 为 string或null；skills 为 string[]或null；experiences/educations 为对应条目数组或null；expectation 为下述对象或null；compensation_relationship 非空闭集 overlap/near_miss/disjoint/unknown。 |
| Experience / Project / Education | 工作八键 required：company、industry、title、start_month、end_month、description 为 string或null，internship 为 boolean或null，projects 为非空类型的数组（允许[]）。项目三键 name/role/result 均 string或null，无 ID/日期；教育五键 institution/major/degree/start_month/end_month 均 string或null。按源顺序多条显示。 |
| Expectation | 四键 required：recruitment_type 枚举或null、job_category CatalogReference或null、locations CatalogReference[]或null、workplace_modes 为 onsite/hybrid/remote 数组或null。没有候选薪资数字/私有偏好/意向ID。 |
| BFF候选身份 / CaseCandidateIdentity | 四键 required：state=anonymous或disclosed；name/avatar_url/disclosed_at 为 string或null（时间沿 date-time 合同）。anonymous 时三值必须为null；disclosed 可三值皆null，状态不得因缺值降级。 |
| DiscoveryRecruiterDetail | 从现有列表 DTO 分离出 `BFF招聘推荐详情`，保留详情原坐标、分数、反馈/委托信息，新增 required candidate_resume: BFF候选在线简历或null；无 candidate_summary opt-in 展开。列表 DTO 保持 include=candidate_summary 规则；类型/解码/缓存不能再让详情经过列表断言。 |
| P5 / 连续在谈 | 保留现有 `解P5详情(input, role)` 签名及角色判别联合；两端详情增加 required match_score/job_detail；招聘详情额外 required candidate_resume/candidate_identity，候选角色拒绝混入这些私有键。招聘列表增加 required match_score/candidate_identity，不强制 candidate_summary 非展开存在。NegotiationDetail 新增 match_score/job_detail，case_detail 复用扩展后的解P5详情。NegotiationItem.job 新增 organization、required_skills、recruitment_type、workplace_mode、annual_salary_months，item增加match_score。 |

字段完整枚举、引用及 additionalProperties:false 以冻结 BFF YAML 为准，禁止 `as unknown as` 绕过解码。新字段同步首次 GET、refresh 输出、写后回读、详情、历史所有复用入口。

### 最小测试选择与责任

- 要防的失败：required 合同整体拒读；null/0/false丢失；角色身份泄漏；列表 N+1；当前资料覆盖 Case；刷新残留旧数据；共享组件 Mock 视觉回归；推荐/在谈操作坐标回归。
- 开发反馈：每 Task 下的 `npm test -- <精确文件>`；变更类型/解码跨消费者时 `npm run typecheck`。只为新行为/边界写有价值断言，不复制实现测试。
- 真实边界提前检查：接通 fetch/媒体/路由时，用 Task 7 的浏览器网络断言及 Task 4/6 的请求测试确认真实连接层；有实际后端环境时可做小范围开发联调取证。不得用 jsdom 单测宣称真实权限已验，正式 L3留在人工 final gate 后。
- 最终责任：本仓库没有 backend `tools/test affected`；按 `git diff --name-status <base>...HEAD`、共享 fixture消费者和测试导入关系记录 selection、理由、执行 commit、命令、结果。下列定向命令是权威入口，不新造 affected runner；L0–L2完整适用责任见收尾，正式真实后端验证为 required。
- 现有证据：只有 Spec 记录的后端验收和前端代码扫描，本轮前端无 PASS。预计新单测/浏览器/真实联调耗时未知，不为了计时预跑整套。规划只校验文档，不运行产品测试。

## Task index

Task count: 7
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|展示 DTO、岗位/推荐解码；无 Task 依赖|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|2|Case/连续合同及回读闭环；依赖1|Top 5–10（Claude Code: sonnet）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|3|四列表原槽映射、公司媒体；依赖1、2|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|4|独立职位及公开企业；依赖1、3|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|5|共享 nullable 在线简历及推荐详情；依赖1、2|Top 5–10（Claude Code: sonnet）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|6|Case/连续详情正文、头部与公司导航；依赖2、4、5|Top 5–10（Claude Code: sonnet）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|7|浏览器请求/视觉回归场景；依赖3–6|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|

角色理由：实现/质量检查主要是现有链路填空，Top 5–10 足够；Task 2/5/6 的 spec review 额外检查角色隔离、快照与旧真名恢复逻辑，用顶级模型。串行避免共同类型/共享 fixture并行冲突。

**计划本身复杂度：中。** 跨多页但没有新状态机/视觉设计，主要成本在严格合同与共享组件回归。

**零上下文漂移风险：中。** 后端接口已明确，仍需约束新旧快照、nullable 和原 Mock 视觉边界。使用当前可用的行业 Top 5–10 中高性价比模型执行。

### Task 1: 展示 schema、CandidateJob 与推荐详情合同

目标：让岗位/推荐读取新合同，先为后续映射提供真实数据；不改变 UI、请求范围或写命令。

预期编辑文件：
- 新增：`src/数据/招聘数据源/展示资料.ts`、`src/数据/招聘数据源/展示资料.test.ts`、`src/测试/展示资料样本.ts`。
- 修改：`src/数据/BFF契约.ts`、`src/数据/招聘数据源类型.ts`、`src/数据/招聘数据源/岗位.ts`、`src/数据/招聘数据源/岗位.test.ts`、`src/数据/招聘数据源/发现推荐.ts`、`src/数据/招聘数据源/发现推荐.test.ts`、`src/数据/招聘数据源/候选摘要.ts`、`src/测试/BFF样本.ts`、`src/状态/后端/类型.ts`、`src/状态/后端/发现推荐操作.ts`、`src/状态/后端/发现推荐操作.test.ts`。
- 删除：无。

输入/输出：落实 Global Constraints 的四个导出与 BFF 类型；现有 `创建岗位数据源`、`创建发现推荐数据源` 方法名不变，推荐详情返回新 `BFF招聘推荐详情`；P4招聘候选页面显式承载 `candidateResume: BFF候选在线简历 | null`，列表来源该值为null、详情取真实值。保留既有列表 summary；详情页面 summary 来源改取 candidate_resume.summary，不再依赖详情的 candidate_summary。

- [ ] 核对冻结 YAML 的新增 schema 及引用；新增样本工厂完整 required 值，不把缺键默认化。先补缺键/非法嵌套/anonymous夹带身份/合法空值测试并运行观察正确失败。
- [ ] 实现具体解码，复用候选摘要解码必要导出。CandidateJob 在岗位列表/详情/推荐/refresh 所有入口接 organization。推荐列表与详情分别精确检查允许键，详情不带 include=candidate_summary。
- [ ] 状态缓存保留推荐坐标和完整正文，不让较浅列表覆盖已读取详情；主体/岗位/账号切换沿现有 generation/范围键围栏。刷新明确返回null时不得合并残留旧正文。仅修改相关类型和赋值，不重写 Provider。
- [ ] 更新共享工厂及本 Task 定向 fixture：新合同正常样本补显式null；故意缺键的负例保留。对工厂的其余消费者用 `rg -n 'BFF样本|CandidateJob|candidate_summary' src/状态 src/屏幕 e2e` 记录受影响选择，不通过宽松生产解码让旧样本通过。
- [ ] 运行 `npm test -- src/数据/招聘数据源/展示资料.test.ts src/数据/招聘数据源/岗位.test.ts src/数据/招聘数据源/发现推荐.test.ts src/状态/后端/发现推荐操作.test.ts`；运行 `npm run typecheck`。预期：所有新旧调用形状有明确结果，非法值仍协议失败，列表无正文要求。
- [ ] 宿主要求的 Task review 完成后提交本 Task；记录命令与实际结果。

反例/停止条件：详情被错误当列表、null被转换空数组、匿名身份夹带姓名被接受均不完成。冻结后端对象缺失或出现实质合同差异时停在该接口核对，不能发明兼容层；额外路径仅为同合同 fixture修复时先登记，实质范围变化回 Spec。

### Task 2: MatchCase 与连续在谈合同、历史和写后回读

目标：新展示字段经过所有现有 Case/negotiation读取链，无在谈行为迁移。

预期编辑文件：
- 新增：无。
- 修改：`src/数据/招聘数据源/MatchCase.ts`、`src/数据/招聘数据源/MatchCase.test.ts`、`src/数据/招聘数据源/连续代谈.ts`、`src/数据/招聘数据源/连续代谈.test.ts`、`src/状态/后端/类型.ts`、`src/状态/后端/MatchCase操作.ts`、`src/状态/后端/MatchCase操作.test.ts`、`src/测试/BFF样本.ts`、`src/测试/展示资料样本.ts`。
- 删除：无。

依赖验收：Task 1 四解码导出已提交且定向测试通过。保留 `解P5详情(input: unknown, role: P5角色): P5详情`，连续嵌套case只调此入口。列表、详情、嵌套和历史按各自 schema 检查 required，不从页面重解 JSON；candidate_identity不派生新状态动作。

- [ ] 先补两角色详情、招聘列表 include开关、连续列表/详情及嵌套/历史样本。覆盖0分、null快照、disclosed缺姓名头像、candidate角色混入招聘字段被拒绝。
- [ ] 在现有精确键集合和类型扩展 match_score/job_detail/candidate_resume/candidate_identity 等，不取消任何 unknown-key/隐私断言；候选列表 job扩展按 Global Constraints。所有合法空值原样保留。
- [ ] 追踪 MatchCase操作 的首次加载、分页、刷新、写后重读、终局/历史链，确保同一扩展返回类型进入缓存；不得动全意向范围、record_id、操作幂等键或轮询时序。
- [ ] 运行 `npm test -- src/数据/招聘数据源/MatchCase.test.ts src/数据/招聘数据源/连续代谈.test.ts src/状态/后端/MatchCase操作.test.ts`、`npm run typecheck`。预期：现有 retry/archive/unknown-write恢复、全意向/排序/分页测试继续通过；新增字段在回读和历史都保留。
- [ ] 完成本 Task 宿主 review、提交、记录受共享fixture影响的后续消费者。

停止条件：任何恢复当前意向过滤、混用case_id/record_id、旧Case按新Job补空的方案都拒绝；已有动作测试不通过先定位本 Task 引入的差异，不能改期望迎合回归。

### Task 3: 四列表映射与原图位真实媒体

目标：市场/求职在谈/招聘推荐/招聘在谈的权威字段填到原槽位，不新增卡片，不逐卡读详情。

预期编辑文件：
- 新增：无。
- 修改：`src/数据/发现推荐映射.ts`、`src/数据/发现推荐映射.test.ts`、`src/数据/列表卡片映射.ts`、`src/数据/列表卡片映射.test.ts`、`src/数据/连续代谈展示映射.ts`、`src/数据/连续代谈展示映射.test.ts`、`src/数据/MatchCase展示映射.ts`、`src/数据/MatchCase展示映射.test.ts`、`src/组件/列表卡片/类型.ts`、`src/组件/列表卡片/求职在谈卡.tsx`、`src/组件/列表卡片/求职在谈卡.test.tsx`、`src/组件/列表卡片/招聘在谈卡.test.tsx`、`src/组件/列表卡片/招聘推荐卡.test.tsx`、`src/屏幕/看市场.tsx`、`src/屏幕/看市场.test.tsx`、`src/屏幕/候选推荐.tsx`、`src/屏幕/P5/MatchCase列表.tsx`。
- 删除：无。

依赖验收：Task 1/2 新DTO及回读测试已通过。生产者保留 `从P4候选岗位`、`从P4CandidateJob`、`映射连续列表项`、既有 P5列表映射名称；扩展对应页面视图，不从组件读取raw DTO。现有图位类型增加 `型:'图片'; url:string` 分支或等价现有字段扩展，保留原 Mock 字标分支；失败回既有中性图位，换 URL 清除之前失败状态。

- [ ] 先补映射测试：organization.display_name优先、缺名只可回同job公开claim；industry.display_name/规模/融资经现有码表拼短行；无组织坐标不造坐标；match_score=0/null、required_skills、模式、薪资月数、招聘类型落位。
- [ ] 求职在谈、市场原有公司/发布人图位接 BFF URL，图片事件用现有组件实践；不按公司名查Mock图片，不新造下载服务，不改变尺寸/CSS。
- [ ] 招聘两卡仍用candidate_summary，个人标签仅 personal_highlights；identity不进入头像/姓名props。列表无权威信息的槽保持未知，有后端字段但无Mock槽则不显示。
- [ ] 页面仍调现有数据源/操作；不加每卡effect/详情GET，保留原点击、收藏、委托、分页和空/错误态。
- [ ] 运行 `npm test -- src/数据/发现推荐映射.test.ts src/数据/列表卡片映射.test.ts src/数据/连续代谈展示映射.test.ts src/数据/MatchCase展示映射.test.ts src/组件/列表卡片/求职在谈卡.test.tsx src/组件/列表卡片/招聘在谈卡.test.tsx src/组件/列表卡片/招聘推荐卡.test.tsx src/屏幕/看市场.test.tsx`。预期原Mock卡面分支不变，真0可见，身份不显示；图片失败/URL切换断言通过。
- [ ] 完成本 Task 宿主 review 并提交。

停止条件：若现有槽无法容纳新的语义，留数据不加区域；业务字段不得用Mock或静态公司表“补齐”。

### Task 4: 独立职位详情与公开企业资料

目标：保留职位详情统一正文，填公司/发布人/JD/标签；只该独立页面补读真实公开企业。

预期编辑文件：
- 新增：无。
- 修改：`src/屏幕/职位详情.tsx`、`src/屏幕/职位详情.test.tsx`、`src/屏幕/职位详情展示/类型.ts`、`src/屏幕/职位详情展示/准备职位正文.ts`、`src/屏幕/职位详情展示/准备职位正文.test.ts`、`src/屏幕/职位详情展示/职位正文展示.tsx`、`src/屏幕/职位详情展示/职位正文展示.test.tsx`、`src/数据/发现推荐映射.ts`、`src/数据/发现推荐映射.test.ts`。
- 删除：无。

依赖验收：Task 1 CandidateJob.organization与Task 3公司视图存在。保留 `准备Backend职位正文`，允许增加明确可选的公开企业输入（使用既有 `BFF公开企业 | null`），默认null不影响Mock。使用现有 `操作.读取公开企业(id): Promise<void>` 和按id的 `状态.公开企业表`，不新增Provider/缓存。新请求仅由当前独立职位真实 organization_id触发，同一主体键复用已有结果，claim文案不能成为ID。

- [ ] 先补公司完整/局部null、logo失败、发布人头像、企业404/读取失败不影响岗位操作、A→B切换A迟到不显示的测试。
- [ ] 公共组织详情只填同组织的现有公司字段；公司摘要先展示，公开读取成功补已提供事实；未提供仍未知。成立日期/发布人备注没有源就保持缺失。不覆盖岗位JD/薪资及推荐坐标。
- [ ] 在原职位详情图位union增加图片输入，复用现有节点/样式；沿用真实组织企业路由。直达无recommendation_id仍禁用委托/不感兴趣，举报继续按job_id；已有查看进展/核对提交结果逻辑不动。
- [ ] 运行 `npm test -- src/屏幕/职位详情.test.tsx src/屏幕/职位详情展示/准备职位正文.test.ts src/屏幕/职位详情展示/职位正文展示.test.tsx src/数据/发现推荐映射.test.ts`。预期有ID至多按当前既有加载机制请求公开企业，无ID不请求，迟到不串页，分析无证据不伪造。
- [ ] 完成宿主 Task review并提交。

停止条件：公开读取必须局部降级，不能把局部错误转成岗位不存在；需要新UI或绕过现有组织授权则先保留原槽未知。

### Task 5: Nullable 共享在线简历及独立推荐详情

目标：招聘推荐详情使用唯一 `在线简历正文`，各区真实为空、多条内容、隐私脱敏和薪资关系准确；保持原Mock渲染。

预期编辑文件：
- 新增：`src/数据/在线简历展示映射.ts`、`src/数据/在线简历展示映射.test.ts`。
- 修改：`src/组件/在谈详情/类型.ts`、`src/组件/在谈详情/在线简历正文.tsx`、`src/组件/在谈详情/在线简历正文.test.tsx`、`src/屏幕/匿名在线简历.tsx`、`src/屏幕/匿名在线简历.test.tsx`、`src/数据/发现推荐映射.ts`、`src/数据/发现推荐映射.test.ts`。
- 删除：无文件；删除匿名在线简历 Backend 被共享正文替代的重复正文 JSX。

依赖验收：Task1详情缓存和candidateResume已经存在；Task2证明Case也可提供同结构。新增纯函数 `从BFF到在线简历展示(resume: BFF候选在线简历 | null): 在线简历展示资料 | null`。`在线简历展示资料` 放现有组件类型文件，按原信息槽组织，头部画像、个人优势、期望、工作、项目、教育、技能分别可空；工作/项目/教育数组保持源序与null/[]；不承载identity/候选薪资/公司实名恢复字段。为既有 `在线简历正文属性` 新增可选 `资料?: 在线简历展示资料 | null`，undefined走既有Mock档，Backend显式传资料并保持 `档={null}`。两种输入只适配到同一组 JSX，不另造Backend视觉分支。

- [ ] 先写映射/组件测试：完整、仅部分区、整份null、每个区null与[]、多教育/多项目/重复日期、false实习、HTML样式文本以文本显示。期待null不是“已读无记录”，[]不是“未提供”；保留当前空态风格。
- [ ] summary画像只进原头行，self_description进个人优势；skills进技能；expectation按招聘类型/类别/地点/办公模式填期望原槽。personal_highlights无正文新槽就只留数据/列表，industry无原槽不加元信息行。
- [ ] 工作公司为空显示中性缺失，不借industry伪装公司名；项目按嵌套源序平铺到原项目区，name/role/result原位，不借工作起止充项目日期。教育从旧单条适配为多条复用原样式；React key用源位置组合，不能仅日期/学校，防止重复值丢条。
- [ ] compensation_relationship只驱动已有薪资关系文案：overlap“薪资区间重叠”、near_miss“薪资区间接近”、disjoint“薪资区间不重叠”、unknown不作结论；不显示候选薪资数字，不把岗位薪资当候选期望。没有后端综合一致性证据就不画绿色勾选/一致条，Mock旧逻辑保持。匹配分析无证据不生成行。
- [ ] Backend独立页删除重复正文，传共享资料；外层真实推荐收藏/委托/返回/分数/附件选择保留。`真名` 不传，末尾中性状态说明不能宣称AI已核验或资料缺失即未披露。
- [ ] 运行 `npm test -- src/数据/在线简历展示映射.test.ts src/组件/在谈详情/在线简历正文.test.tsx src/屏幕/匿名在线简历.test.tsx src/数据/发现推荐映射.test.ts`、`npm run typecheck`。预期完整Mock布局语义原样，Backend全空/部分空正确，刷新有值→null清除旧内容。
- [ ] 完成本 Task 宿主 review并提交。

停止条件：禁止把nullable强转成 `匿名简历档`；出现新卡/新CSS、姓名透传旧真名恢复、私有数字或伪造匹配判断则不完成。原样式无法表达时保留原缺失槽并记录PM差异，不自定新设计。

### Task 6: Case 与连续详情的正文、顶栏和公司导航

目标：在谈第二Tab不再恒null，使用自身冻结快照；列表到详情、pre-case到case状态及头部分数一致。

预期编辑文件：
- 新增：无。
- 修改：`src/数据/详情展示映射.ts`、`src/数据/详情展示映射.test.ts`、`src/数据/连续代谈展示映射.ts`、`src/数据/连续代谈展示映射.test.ts`、`src/数据/MatchCase展示映射.ts`、`src/数据/MatchCase展示映射.test.ts`、`src/组件/在谈详情/类型.ts`、`src/组件/在谈详情/职位资料.tsx`、`src/组件/在谈详情/职位资料.test.tsx`、`src/屏幕/详情控制/use后端详情控制.ts`、`src/屏幕/详情控制/use后端详情控制.test.tsx`、`src/屏幕/详情控制/后端正常详情.tsx`、`src/屏幕/详情控制/后端正常详情.test.tsx`。
- 删除：无。

依赖验收：Task2严格角色详情、Task4职位原图位呈现、Task5 `从BFF到在线简历展示` 和共享资料prop均存在。保留 `从P5到详情顶栏`、`从P5到职位资料`、`从连续到详情顶栏`、`从连续到职位资料`；返回既有 `职位资料信息` 扩展真实组织编号/媒体输入，详情控制增加 `在线简历资料: 在线简历展示资料 | null`，招聘角色映射candidate_resume，候选角色不构造该资料。

- [ ] 先测试旧Case双区null、新Case完整、pre-case job_detail、嵌套case、当前资料更新但case不变；测试0/null分数、S1前后identity变而UI仍去名。
- [ ] job_detail映射职位描述/要求/标签/公司/发布人原槽，null就未知；顶栏取当前详情match_score，只有同一响应已有基础摘要可填同义槽，不能外查/拼其他记录分数。无匹配证据只保留未知分析。
- [ ] 招聘case资料页改传共享 `资料`；独立和case相同结构走同一映射。候选Case与连续详情复用职位资料；pre-case同样用它自身job_detail，不能因为没有case_id不显示已给的冻结职位。
- [ ] 公司按钮有真实 organization_id时调用现有 `路径.企业详情(id)`，否则仍禁用；没有额外自动公司/Job/Resume请求，导航企业页不能改Case缓存。复用原外壳、Tab、动作权限，不改PDF附件预览授权。
- [ ] 运行 `npm test -- src/数据/详情展示映射.test.ts src/数据/连续代谈展示映射.test.ts src/数据/MatchCase展示映射.test.ts src/组件/在谈详情/职位资料.test.tsx src/屏幕/详情控制/use后端详情控制.test.tsx src/屏幕/详情控制/后端正常详情.test.tsx src/屏幕/详情控制/useCasePDF预览.test.tsx`。预期展示值抵达真实Tab；旧Case不发补读，S1姓名头像不显示/不请求，附件仍精确授权。
- [ ] 完成宿主 Task review并提交。

停止条件：任何用live Job/Resume修补Case、identity改变旧真名/披露操作、为分数造分析的实现都不接受；字段缺失的合法老Case不作为错误页面。

### Task 7: 浏览器接线、请求边界与 Mock 视觉回归场景

目标：形成可重复的端到端展示/网络证据；使用现有 Playwright入口，不新建测试框架。这是测试交付 Task，不含异构review或final gate。

预期编辑文件：
- 新增：`e2e/展示字段接线.spec.ts`、`e2e/fixtures/展示字段接线.ts`。
- 修改：`e2e/fixtures/P1展示统一.ts`、`e2e/P1展示统一.spec.ts`、`e2e/J-PILOT-02接线.spec.ts`、`e2e/数据源模式.spec.ts`（后三者仅补它们拥有的旧协议fixture/受影响断言）、`src/测试/BFF样本.ts`。
- 删除：无。

依赖验收：Task3–6提交存在且各自定向测试通过。新spec以 `@backend`/`@mock` 标签接 `playwright.数据源模式.config.ts` 的现有项目；不改config/server/runner。fixtures明确模拟新协议，不冒充真实后端验收。

- [ ] 在改动前基线相同Mock数据、视口、路径、Tab和操作状态保存比较截图（可在实施开始时提前采集，复用既有本地资源，不能为取图创建第二用户worktree或重置当前内容）；若无法获得可靠前图先记证据缺口，不更新golden充当通过。Task7把后图与已留前图对比。
- [ ] fixtures覆盖四列表、独立两详情、两端Case资料以及pre-case：完整/局部空/老Case全空，真实0，长公司/文本、多段教育/项目，真实媒体URL/失败、数据刷新有→空。
- [ ] 网络断言：列表每次只读其列表/既有必要请求，零逐卡Job/Resume/公开企业补读；独立职位有组织ID读取该公开企业、无ID零请求，主体切换无旧数据显示；Case无当前Job/Resume补读；anonymous/disclosed均零候选头像请求。已有头像URL响应仍须被解码而不使用。
- [ ] 在320px/390px检查 `scrollWidth <= clientWidth`、按钮/Tab可操作、不遮挡；现有Mock全资料截图对比同fixture同状态，正文不出现新区域/样式。真实长文本自然增高可接受，不接受缩小字号/扩宽容差。
- [ ] 更新本 Task 范围内受新required合同影响的旧e2e正常fixture；保留精确附件权限、不同账号/记录隔离、连续全意向及恢复行为测试，不为展示任务改这些产品断言。
- [ ] 运行 `npm run test:e2e:data-source -- e2e/展示字段接线.spec.ts --project=backend-stg --project=mock-stg`。对修改过fixture的既有文件，运行 `npm run test:e2e:data-source -- e2e/P1展示统一.spec.ts e2e/J-PILOT-02接线.spec.ts e2e/数据源模式.spec.ts --project=backend-stg --project=mock-stg`；如果只有某个文件受影响，只保留该文件参数并记录selection理由，不加入annotation项目。
- [ ] 查看截图/网络断言结果，记录执行commit、实际用例数、失败/未跑和证据路径；宿主 Task review后提交测试代码。不在此跑异构review或真实L3。

停止条件：无浏览器/端口占用先报告具体环境缺口，不停止他人server、不自动扩大整套。截图只有后图/未看图不得宣称Mock视觉完全一致；缺失覆盖进入收尾责任，不能虚记PASS。

## 实施后收尾（不计入 Task count）

同一实施 session 完成，以下覆盖执行 skill 的默认 finishing-a-development-branch。所有实施Task及宿主skill要求的全局review先结束；未要求全局review则不额外增加。退出Task循环，不再新增Task/角色或自动合入菜单。

1. **异构代码 review：** 固定候选commit/diff、批准Spec与本Plan；Codex宿主以Claude、Claude Code宿主以Codex调用对应多轮只读review-loop和其 `../_shared/review-contract.md`。reviewer不运行测试、不写文件；轮次/停止/裁决归该skill，轮间只跑修复相关轻量单测/静态检查，不跑affected/整层。逐条标必要性和复杂度影响；拒绝扩Spec、假想基建/视觉改造。记录本Plan；后续affected开始后不再进入Task/global/异构review。
2. **affected及适用L0–L2：** `git diff --name-status <实现前base>...HEAD` 重算真实文件、删除项、共享fixture消费者。至少包含Tasks1–6列出的新增/修改单元测试以及实际受影响的既有调用方测试，Task7定向浏览器集；执行 `npm run lint -- <实际变更的TS/TSX文件>`、`npm run typecheck`、`npm run build`（构建为跨模块编译/打包责任，避免同一有效候选重复跑），不得直接 `npm test` 全套。保存selection理由、commit、命令、实际结果和Screenshot/network证据。已有Task receipt依赖/配置/fixture完全有效的复用，不重复。共享fixture波及清单超出预期先登记路径/选择，不能略过失败或修改生产decoder迁就旧fixture。若入口无法合法表达必要子集，如实报coverage limitation，不自动整层兜底。未完成全部适用责任不称ready。
3. **人工 final gate：** 只读fetch最新origin/main，列出候选SHA、pre-gate target SHA、完整选择与可复用receipt、缺口/增量命令、下述required真实联调前置、预计目标合入与普通push动作，等待用户明确批准。此前不合target、不跑正式L3、不push。本轮规划批准不代替实施合入批准。
4. **获批后验证合入：** 按逻辑 `development-workflow` 的 `references/final-integration.md`，fetch记录真实final_target_base，安全同步target、重算完整责任；执行INCREMENTAL_EVIDENCE：复用仍有效PASS，仅补新选中/失效/缺失项，保存累计失效理由；确认后修复不再触发异构review。执行下面required L3。cleanup后再对账，核对target未推进后普通fast-forward push，禁止force；只有push成功才声称合入。仅清理本任务创建资源，不动别人工作区/server/数据。

### 正式真实边界责任

**L3责任：required。** 入口：`docs/dogfood/真实后端行为验收.md` 的实际前端+后端 agent-browser验收；读取当前文档及其skill/doctor要求，使用专用账号、独立候选/招聘session。它是操作指南，不是可伪造的 `npm L3`命令。所需输入：可用前端URL（按指南cookie origin规则）、匹配新合同的后端checkout/运行环境、两角色专用账号和OTP来源、可供验证的新/旧Case及S1前后数据。缺少只询问缺项并记录BLOCKED，不能将后端历史PASS等同前端PASS，不绕过权限或修改他人数据。

范围选择为指南B05隔离风险的相关部分，加本任务“展示接线”定向流程，不盲跑全部业务旅程：
- 双端四列表→对应详情→资料Tab，验证公司/分数/多段在线资料/图片与合法缺失。
- 新Case与无新快照旧Case；源职位/在线资料变更后同Case正文不变（只能在专用数据上操作）。
- S1实际披露前后及另一无资格招聘查看者：identity响应受Case权限限制，本轮双方UI继续去名/零候选头像请求；不替代/改变现有精确PDF附件权限流程。
- 不复制旧H01里已被J-PILOT-01替换的S0“补事实”流程；既有指南与当前批准合同冲突时以批准合同为产品真相，记录不适用步骤。

输出到既有 `dogfood-output/<run-id>/`：report、必要截图、脱敏网络/操作证据、候选/后端版本、选中项与PASS/FAIL/BLOCKED，其余指南用例标NOT_RUN。此路径是runner证据，不新增docs review/handoff文件。不记录OTP、cookie、token或私人简历原文。实际部署/发布不在本任务授权内。

## 文档审查与规划验证记录

- 2026-09-12：用户批准 Spec 并要求零上下文Plan、Claude review、执行提示词。文档审查限定本Spec与本Plan，不审业务代码、不跑产品测试。
- Claude审查：待按固定候选提交执行；最终裁决与修复记录在此，不另建review报告。
- 规划验证：待审查闭环后生成双宿主prompt并运行 `development-workflow` 的 `scripts/validate_prompt_grading.py --plan docs/superpowers/plans/2026-09-12-recruitment-display-frontend-wiring.md --prompt docs/superpowers/prompts/2026-09-12-recruitment-display-frontend-wiring.md`。
