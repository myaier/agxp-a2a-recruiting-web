# 六维解释、薪资统一与 Case 契约兼容 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Claude Code 使用 superpowers:subagent-driven-development；Codex 使用 superpowers:executing-plans。必须实际调用，按下列 Task 依赖实施，不在规划会话执行。

Revision：1。日期：2026-09-18。

**Goal:** 保留上一轮 S0–S3、身份、在线简历、屏蔽接线，完成新版详情字段兼容、六维批次解释及全页面既有薪资字段统一。

**Architecture:** 扩展现有闭合解码与问答账本；共享一个小型解释解码/中文映射，改造既有匹配分析组件；收拢小型薪资格式函数。继续使用原数据源、状态隔离、详情控制、弹层和错误重试，不新增评分器、金额引擎、缓存、状态机或逐行补读。

**Tech Stack:** React 19、TypeScript、Vite；Vitest/Testing Library、Playwright fixture/Mock 和既有视觉采集。

**Spec:** `docs/superpowers/specs/2026-09-17-match-explanation-wiring-design.md`，批准 Revision 3，blob `e03157e2239104e52c278aadbd71d2c5fb3ef6da`，批准状态提交 `7dc6c265`。先 `git hash-object` 校验；路径相同但 blob 不同不能自动当作批准版本。

## Global Constraints

- 工作区固定为 `.`，target `origin/main`，前端基线 `84fd3c114c6ea41c89f771c69f43a0ab047b81d0`；允许其上的已批准文档提交，不要求执行者 reset 到旧基线。不创建第二个工作区，不 stash/reset/clean，不覆盖他人改动。
- 先完整读 `AGENTS.md`、`CLAUDE.md`、`docs/testing/README.md`、批准 Spec。按逻辑名发现 development-workflow，读取 skill 根目录的 `assets/execution-contract.md`；新任务不使用旧 manifest/batch 流程。
- 开工用 development-workflow skill 根目录的 `scripts/task_intents.py --help` 确认当前 CLI，再 start 登记路径/接口范围；已有预告只提供协作线索。扩大范围前 update，不代写他人记录。
- 用户只授权前端；后端只读、不启动、不修改、不部署、不清库。真实账号、本地真实 Case 与正式 L3 由用户验收，Agent 不执行，不写入账号/验证码。fixture 自动化和静态检查仍要完成。
- 后端只读合同坐标：评分初始 `1e70af23b1041f5ddf11dd68d6ce72dc5f9571a7`；增量进度/引用 `75a318a012bcc36b748b54ab2f4051628ca90d97`。仅从可用的 agxp-monorepo checkout 读取其 `apps/recruitment-bff/openapi/mobile-v1.yaml`、`apps/recruitment/internal/discovery/match_explanation.go` 及评分 Spec；下面已冻结所需前端字段，不依赖规划机器路径。发现合同与冻结文本冲突先报告，不自造兼容层。
- 不重做头像、姓名、手机/邮箱占位、纸身在线简历、S0–S3 请求动作或新主线首屏建档/日常简历编辑/三级岗位分类。
- 历史列表一律不加评分入口；其他指定列表只使原分数环可点击，无环下文字。分析不得混入个人优势、PDF 正文或消息气泡。
- 六维/总分来自同记录同角色；合法 null 保留，0 不变成 null；旧快照不因当前简历/JD 改变；权限仍由服务端决定。
- 薪资只规范已有结构化显示，不披露候选私有金额，不批量替换自然语言/JD/PDF，不补读当前岗位覆盖历史金额。
- 默认写回执不强行要求评分展开；将评分 include 加到规定读取入口，不加到 summary、通用 job、候选底层 Case 列表或写接口。
- 各 Task 采用失败用例→最小改动→定向验证→小提交；不预先改全部 fixture 让旧断言失去反例。共享文件 Task 串行，禁止多个执行者同时编辑。
- 完成标准：Spec 第 6、8A.2、8B 的所有入口有可追溯接线与自动化证据；无新增逐行请求、无权限/动作/分页回归；真实环境明确未验收。

## 冻结的公共合同

### C1. 六维对象与解码边界

在 `src/数据/BFF契约.ts` 定义 `BFF匹配解释` / `BFF匹配维度` 判别联合，保持 snake_case wire 字段。新增小文件 `src/数据/招聘数据源/匹配解释.ts` 导出：

```ts
解匹配解释(input: unknown, matchScore: number | null): BFF匹配解释 | null
```

input=null 直接返回 null（score 可以有值）；对象时 score 必须为有效数字且相等。undefined 不视为 null。调用者各自的闭合键校验负责区分未展开与显式展开：默认键必须缺席，展开键必须存在；以参数明确解码模式，不根据对象有无字段自动猜模式。归一化/展示模型可用可选 `匹配解释?: BFF匹配解释 | null` 保留缺席与 null，DTO 使用 `match_explanation?`，不把所有默认回执伪装成已展开 null。

对象 exact keys：`schema_version, ranking_version, basis, total_points, max_points, dimensions`；固定值 `match-explanation.v1 / discovery-ranking.v2 / batch_snapshot / max_points=100`。dimensions 恰六项且固定顺序 direction/skills/experience/location/workplace_mode/compensation，max_points 25/35/15/10/5/10。各项 exact keys `dimension,status,points,max_points,reason_code`；仅 skills 必有整数 `matched_count,required_count`，其他维度禁止这两个键。所有数值有限整数，0≤points≤max；分项和=total_points=同响应 match_score。

闭表 reason/status 及中文说明（状态 M=matched、P=partially_matched、N=not_matched、U=unknown）：

|维度|reason_code → 状态 → 固定说明|
|---|---|
|direction|job_category_missing → U → 岗位方向信息缺失；candidate_category_missing → U → 求职方向信息缺失；category_matched → M → 求职方向与岗位方向匹配；category_not_matched → N → 求职方向与岗位方向不匹配|
|skills|job_keywords_missing → U → 岗位关键词缺失；candidate_skills_missing → U → 候选技能信息缺失；no_keyword_overlap → N → 未命中岗位关键词；partial_keyword_overlap → P → 命中部分岗位关键词；all_keywords_matched → M → 已命中全部岗位关键词|
|experience|requirements_unconfirmed → U → 岗位经验要求尚未确认；candidate_experience_missing → U → 候选经验信息缺失；experience_met → M → 经验满足岗位要求；experience_not_met → N → 经验未满足岗位要求|
|location|job_location_missing → U → 岗位地点信息缺失；candidate_locations_missing → U → 求职地点信息缺失；location_matched → M → 求职地点与岗位地点匹配；location_not_matched → N → 求职地点与岗位地点不匹配|
|workplace_mode|job_workplace_mode_missing → U → 岗位办公方式信息缺失；candidate_workplace_modes_missing → U → 求职办公方式信息缺失；workplace_mode_matched → M → 办公方式匹配；workplace_mode_not_matched → N → 办公方式不匹配|
|compensation|compensation_overlap → M → 薪资范围匹配；compensation_near_miss → P → 薪资范围接近；compensation_disjoint → N → 薪资范围不匹配；compensation_type_mismatch → U → 薪资周期不同，无法直接比较；compensation_negotiable → U → 薪资面议，尚未核对；candidate_compensation_missing → U → 求职薪资信息缺失；job_compensation_missing → U → 岗位薪资信息缺失；compensation_not_annualizable → U → 薪资缺少可比口径；compensation_type_unsupported → U → 当前薪资类型无法比较|

严格复核后端已给数据的一致性，不从 JD/简历重新评分：matched 必为该维满分；unknown/not_matched 必为 0；部分匹配仅 skills/compensation，薪资部分匹配固定 5。skills 0≤matched≤required；job_keywords_missing 要求 required=matched=0；candidate_skills_missing/no_keyword_overlap 要求 required>0、matched=0；partial 要求 0<matched<required；all 要求 matched=required>0。仅校验已给 skills points 等于 required=0 时0，否则 floor(35*matched/required)，不是业务评分入口。反例：1/100 命中、0/35 分必须合法且仍为 P。未知 reason、错维度/状态、额外键均走现有 invalid_response，不降级为合法 null。

### C2. 读取与来源模式

以批准 Spec §6 表为完整请求真相，严格按下表传一个 include，原过滤/游标/limit 保留：

|请求|include|
|---|---|
|招聘推荐列表（含收藏淘汰）|candidate_summary,match_explanation|
|招聘推荐详情|match_explanation|
|求职推荐列表|match_explanation|
|招聘在谈 Case 列表|candidate_summary,match_explanation|
|招聘 Case history|match_explanation|
|双端 Case 详情|screening_records,match_explanation|
|求职 negotiations 列表/详情|match_explanation|

若基线已有 progress_details，合并保留；当前核对未使用。negotiations 禁止 screening_records，嵌套 case_detail 沿已有合同携带 S0，解释展开时外层/存在的嵌套 Case 都必须有键并完整解码；核对 case_id 和当前候选视角评分/解释同源，不能独立寻找别条 Case。

写操作的默认回执仍按原合同读；若某写回执覆盖了列表完整对象，应保留同 ID 的已展开信息直到权威重读，或立即以对应展开读取刷新；不得把旧解释移给新记录，不把回执缺键当合法 null，不将旧解释与变化后的分数拼接。服务端未提供一致上下文时进入既有加载/重读分支。

求职推荐导航用 URL query 精确携带 recommendation_id/batch_id/intention_id，job_id 取路由并核对。已有缓存仅在四坐标全等且当前账号角色一致时可用。刷新可在该 intention 的现有推荐列表分页查找同四坐标（复用已有读取）；批次不符/穷尽未找到则显示原上下文不可用，不能替换为新批次。临时读取失败仍显示重试，不冒充永久不可用。通用详情无坐标不扫描意向；资料权限仍使用现有 job 请求。

### C3. 展示模型与控件

新增 `src/数据/匹配解释展示映射.ts`：固定原因映射和 `匹配分析模型`，包含 `分数: number|null`、`解释: BFF匹配解释|null`、`有限依据: readonly string[]`、`上下文: '有来源'|'无推荐上下文'|'原推荐不可用'`。只有已解码响应才能映射；合法缺失同区显示“暂无该次匹配的详细分析”，有旧依据标“有限依据”，不补六条假状态。

改造现有 `匹配分析块` 为双端与 Mock 共用组件，props 以 `模型: 匹配分析模型; 藏环?: boolean` 为核心；迁移旧调用，不维持一套按证据算状态的隐藏分支。列表以现有弹层框架包同组件；弹层使用文本总分/藏环，不新增通用弹层组件框架。分析外已有总分就藏环；详情必要位置唯一环。行样式严格遵循 Spec §4：左图标/名称/小号 points/max，右弱化原因与状态，长原因换行。

score ring 原组件保持展示职责；卡片接收可选 `查看匹配分析?: () => void`，仅指定入口传入，有回调时外层独立按钮 aria-label=查看匹配分析，键盘可达、44px触摸区、不嵌套按钮、不触发卡片动作；无回调消费者不凭空出现分析入口。null 环显示 — 仍可查看缺失说明。使用 page-local 选中记录 ID 查当前页权威模型，切 scope 关闭，禁止把旧记录对象永久闭包缓存。历史卡永不传此回调。

### C4. 兼容修复与薪资

Spec §8B 完整冻结 step 四词、缺席=null/显式null拒绝、asker/opposite Agent、人工待办不猜人、answer ref 正则/按 stage+asking_role+round 与先前 question 配对及 S0 禁止引用。新增字段不能改变 role/answer_source/text/status 原约束。complete 不是 S3；旧 step 缺席不猜动作。

新增 `src/数据/薪资展示.ts` 小函数：`格式化薪资({下限,上限,周期,年薪月数?,面议?}): string`，合法值返回 Spec §8A 格式；非法/缺失返回“薪资未知”。`规范薪资文本(text: string|null|undefined, 年薪月数?: number|null): string` 仅适配 Spec §8A.3 的有限格式及该格式化函数自己的输出（幂等）；内部输入结构不持久化，不新建金额模型。输入控件仍存数值，不让规范文本破坏旧保存解析；旧 `解析薪资带` 如继续消费展示文本，必须显式支持 en dash/后缀且确认不丢已存年薪月数，或保留结构化提交路径。日/时不追加年薪月数，月薪未填/12省略，否则 ` x N`，同值收成单值，独立 N薪标签全部移除。表单未确认占位不是“薪资未知”。

## Task index

Task count: 10
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

顺序执行 1→10；共享文件多，不以并行换取冲突。Task 1 默认合同可独立验证，2 提供共享解释合同，3–7 逐层消费，8–9 薪资自成显示边界，10 汇总浏览器覆盖。每项完成可提交，但不可把半接线状态作为整项功能已交付。

**计划本身复杂度：高。** 跨双角色多路由、严格解码与写后重读，需要系统覆盖。
**零上下文漂移风险：中。** 合同、视觉和接口已冻结，主要风险是旧消费者漏改和权限/来源混用；执行模型使用当前可用的行业 Top 5–10 中高性价比模型。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|详情兼容；无前置|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|2|六维严格解码；1|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|3|展开读取与映射；2|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|4|共享四态与弹层；2|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|5|推荐列表详情精确上下文；3/4|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|6|Case/协商/聊天与权限；1/3/4|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|7|Mock固定快照；4–6|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|8|薪资格式及填写回显；无逻辑前置，串行避冲突|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|9|薪资全部消费者；8|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|10|浏览器/视觉/清单；1–9|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|

档位理由：实现均为冻结需求上的局部接线，Top 5–10 足够；跨合同、来源隔离或全覆盖审查使用前沿档，纯视觉/Mock/格式审查采用 Top 5–10。Claude alias 只在 Claude Code 解析；Codex 使用宿主原生模型，不查 Claude alias。

## 实施 Tasks

### Task 1: 默认详情响应兼容与阶段文案

**预期编辑文件：**

- 新增：无。
- 修改：`src/数据/BFF契约.ts`、`src/数据/招聘数据源/MatchCase.ts`、`src/数据/招聘数据源/MatchCase.test.ts`、`src/数据/招聘数据源/连续代谈.test.ts`、`src/数据/MatchCase展示映射.ts`、`src/数据/MatchCase展示映射.test.ts`、`src/数据/详情展示映射.ts`、`src/数据/详情展示映射.test.ts`、`src/组件/阶段对话流.test.tsx`、`src/测试/BFF样本.ts`。
- 删除：无预定文件；仅在证明旧实现无消费者后删除死代码，不删除历史文档。

**依赖与接口：** 无前置。消费旧 DTO 与服务端阶段响应；产出 P5对话进度.step 闭词|null、所有 answer 分支 exchangeRef:string|null 和分离的当前步骤/轮次文案。实现 Spec §8B，尚不修改 include。

**范围与失败反例：** 新增表驱动 step 合法/缺席/非法测试；新增 S1/S2 两类 answer ref 配对成功、旧缺席兼容、S0/坏格式/错轮错侧失败。补完整包同时含两个字段及 Negotiation 嵌套包。扩展原白名单和账本，不放宽未知字段。映射 assessing 为发问侧、answering 为对端、awaiting_human 中性且按钮继续读待办。将 confirmed_facts 标题/空态改为已回答事项，coordinating 改中性文案。用三条 S1 恢复/继续响应与两侧 S2 finish 响应验证阶段不本地推进；S0 declined/not_available 在后续历史原样展示。

- [ ] 核对当前 Task 文件和依赖产物；若基线已实现部分要求，记录证据而非覆盖重做；公共合同漂移先暂停依赖部分并报告。
- [ ] 在上述已有测试或指定新测试中加入本 Task 失败反例，先运行下列命令；应因目标行为缺失失败，不能因路径/fixture无关损坏失败。

```bash
npm test -- src/数据/招聘数据源/MatchCase.test.ts src/数据/招聘数据源/连续代谈.test.ts src/数据/MatchCase展示映射.test.ts src/数据/详情展示映射.test.ts src/组件/阶段对话流.test.tsx --maxWorkers=2 --retry=0
```

- [ ] 按本 Task 范围完成最小实现/断言迁移，保留未改行为的原测试；不通过宽松白名单、快照盲更新或吞错达成通过。
- [ ] 复跑该定向选集，预期全部通过；必要共享类型变更执行 `npm run typecheck`，记录命令、候选commit、选集/fixture与结果。
- [ ] 自检本 Task 的来源、缺失、权限与错误边界；按宿主执行 skill 完成必要 Task review，处理有效 finding 后只提交本 Task 文件。

**完成/停止条件：** 上述行为及失败反例有证据、依赖产物可供下一 Task 使用才完成；契约冲突、无法保留权限/来源或缺必需执行能力时明确报告，不能改Spec自证正确。非目标为本Task以外的状态机/架构/后端改造。

### Task 2: 六维严格解码器与固定中文映射

**预期编辑文件：**

- 新增：`src/数据/招聘数据源/匹配解释.ts`、`src/数据/招聘数据源/匹配解释.test.ts`、`src/数据/匹配解释展示映射.ts`、`src/数据/匹配解释展示映射.test.ts`。
- 修改：`src/数据/BFF契约.ts`、`src/数据/招聘数据源类型.ts`、`src/测试/BFF样本.ts`。
- 删除：无预定文件；仅在证明旧实现无消费者后删除死代码，不删除历史文档。

**依赖与接口：** 依赖1默认响应不回归；产出 C1 的解匹配解释与 C3 的匹配分析模型，保持 DTO/显示边界。

**范围与失败反例：** 冻结 C1 全闭表与权重；用工厂生成合法六维样本再单字段破坏，不放行未知字段。覆盖 extra key、丢维/乱序/重复、版本、reason/status/count/分数矛盾、match_score=null而对象非null。固定 1/100=0 的技能部分匹配样本。映射 0/null、新解释/有限旧依据/无上下文，不从正文推断。至少构造一个新解释 null 且旧正向依据仍在的输入，不能返回假六行。

- [ ] 核对当前 Task 文件和依赖产物；若基线已实现部分要求，记录证据而非覆盖重做；公共合同漂移先暂停依赖部分并报告。
- [ ] 在上述已有测试或指定新测试中加入本 Task 失败反例，先运行下列命令；应因目标行为缺失失败，不能因路径/fixture无关损坏失败。

```bash
npm test -- src/数据/招聘数据源/匹配解释.test.ts src/数据/匹配解释展示映射.test.ts --maxWorkers=2 --retry=0
```

- [ ] 按本 Task 范围完成最小实现/断言迁移，保留未改行为的原测试；不通过宽松白名单、快照盲更新或吞错达成通过。
- [ ] 复跑该定向选集，预期全部通过；必要共享类型变更执行 `npm run typecheck`，记录命令、候选commit、选集/fixture与结果。
- [ ] 自检本 Task 的来源、缺失、权限与错误边界；按宿主执行 skill 完成必要 Task review，处理有效 finding 后只提交本 Task 文件。

**完成/停止条件：** 上述行为及失败反例有证据、依赖产物可供下一 Task 使用才完成；契约冲突、无法保留权限/来源或缺必需执行能力时明确报告，不能改Spec自证正确。非目标为本Task以外的状态机/架构/后端改造。

### Task 3: 读取展开、嵌套解码、状态与展示映射保真

**预期编辑文件：**

- 新增：无。
- 修改：`src/数据/招聘数据源/发现推荐.ts`、`src/数据/招聘数据源/发现推荐.test.ts`、`src/数据/招聘数据源/MatchCase.ts`、`src/数据/招聘数据源/MatchCase.test.ts`、`src/数据/招聘数据源/连续代谈.ts`、`src/数据/招聘数据源/连续代谈.test.ts`、`src/数据/发现推荐映射.ts`、`src/数据/发现推荐映射.test.ts`、`src/数据/MatchCase展示映射.ts`、`src/数据/连续代谈展示映射.ts`、`src/数据/连续代谈展示映射.test.ts`、`src/数据/招聘数据源类型.ts`、`src/状态/后端/发现推荐操作.ts`、`src/状态/后端/发现推荐操作.test.ts`、`src/状态/后端/MatchCase操作.ts`、`src/状态/后端/MatchCase操作.test.ts`、`src/测试/BFF样本.ts`。
- 删除：无预定文件；仅在证明旧实现无消费者后删除死代码，不删除历史文档。

**依赖与接口：** 依赖2，消费解匹配解释；产出精确记录的可选/可空解释字段并传过现有状态、映射。按 C2 分开默认/展开解码参数，外层与嵌套一并传模式。

**范围与失败反例：** 先给 Spec §6 所有请求做 URL 断言：各列表分页/过滤、详情展开合并、写接口不加 include，明确不支持展开的 API 不变。展开模式缺键必须失败、null成功；默认携带展开键失败。Negotiation 嵌套 case_detail 非null时完整校验与外层同源，pre-Case不制造Case。确认写回执更新方式，防止替换对象丢解释，必要时用已有刷新。新增账号/角色/意向/岗位切换迟到、加载下一页和刷新null清旧解释反例，复用现有栅栏而非增加通用状态层。

- [ ] 核对当前 Task 文件和依赖产物；若基线已实现部分要求，记录证据而非覆盖重做；公共合同漂移先暂停依赖部分并报告。
- [ ] 在上述已有测试或指定新测试中加入本 Task 失败反例，先运行下列命令；应因目标行为缺失失败，不能因路径/fixture无关损坏失败。

```bash
npm test -- src/数据/招聘数据源/发现推荐.test.ts src/数据/招聘数据源/MatchCase.test.ts src/数据/招聘数据源/连续代谈.test.ts src/状态/后端/发现推荐操作.test.ts src/状态/后端/MatchCase操作.test.ts src/数据/发现推荐映射.test.ts src/数据/连续代谈展示映射.test.ts --maxWorkers=2 --retry=0
```

- [ ] 按本 Task 范围完成最小实现/断言迁移，保留未改行为的原测试；不通过宽松白名单、快照盲更新或吞错达成通过。
- [ ] 复跑该定向选集，预期全部通过；必要共享类型变更执行 `npm run typecheck`，记录命令、候选commit、选集/fixture与结果。
- [ ] 自检本 Task 的来源、缺失、权限与错误边界；按宿主执行 skill 完成必要 Task review，处理有效 finding 后只提交本 Task 文件。

**完成/停止条件：** 上述行为及失败反例有证据、依赖产物可供下一 Task 使用才完成；契约冲突、无法保留权限/来源或缺必需执行能力时明确报告，不能改Spec自证正确。非目标为本Task以外的状态机/架构/后端改造。

### Task 4: 共用紧凑六维组件与可点击分数入口

**预期编辑文件：**

- 新增：`src/组件/匹配分析块.test.tsx`。
- 修改：`src/组件/匹配分析块.tsx`、`src/组件/匹配分析块.module.css`、`src/组件/匹配对齐卡.tsx`、`src/组件/招聘匹配依据.tsx`、`src/组件/列表卡片/求职推荐卡.tsx`、`src/组件/列表卡片/求职推荐卡.test.tsx`、`src/组件/列表卡片/求职在谈卡.tsx`、`src/组件/列表卡片/求职在谈卡.test.tsx`、`src/组件/列表卡片/招聘推荐卡.tsx`、`src/组件/列表卡片/招聘推荐卡.test.tsx`、`src/组件/列表卡片/招聘在谈卡.tsx`、`src/组件/列表卡片/招聘在谈卡.test.tsx`。
- 删除：无预定文件；仅在证明旧实现无消费者后删除死代码，不删除历史文档。

**依赖与接口：** 依赖2。实现 C3 模型/props 和可选卡片回调；适配旧消费者至后续Task迁移完成，不新建评分或弹层基础设施。

**范围与失败反例：** 先测试四态图标+文字、points/max、技能计数、长原因、有限依据、null和0；按 Spec §4 改造匹配分析块。旧招聘依据仅保留合法缺失时有限依据职责，不同时渲染重复分析。卡片按钮只能触发回调，不触发卡片导航/动作，必须无嵌套button。无回调维持既有消费方式，历史组件不改。复用弹层焦点/遮罩/Escape能力，确认44px点击区不挤薪资。

- [ ] 核对当前 Task 文件和依赖产物；若基线已实现部分要求，记录证据而非覆盖重做；公共合同漂移先暂停依赖部分并报告。
- [ ] 在上述已有测试或指定新测试中加入本 Task 失败反例，先运行下列命令；应因目标行为缺失失败，不能因路径/fixture无关损坏失败。

```bash
npm test -- src/组件/匹配分析块.test.tsx src/组件/列表卡片/求职推荐卡.test.tsx src/组件/列表卡片/求职在谈卡.test.tsx src/组件/列表卡片/招聘推荐卡.test.tsx src/组件/列表卡片/招聘在谈卡.test.tsx --maxWorkers=2 --retry=0
```

- [ ] 按本 Task 范围完成最小实现/断言迁移，保留未改行为的原测试；不通过宽松白名单、快照盲更新或吞错达成通过。
- [ ] 复跑该定向选集，预期全部通过；必要共享类型变更执行 `npm run typecheck`，记录命令、候选commit、选集/fixture与结果。
- [ ] 自检本 Task 的来源、缺失、权限与错误边界；按宿主执行 skill 完成必要 Task review，处理有效 finding 后只提交本 Task 文件。

**完成/停止条件：** 上述行为及失败反例有证据、依赖产物可供下一 Task 使用才完成；契约冲突、无法保留权限/来源或缺必需执行能力时明确报告，不能改Spec自证正确。非目标为本Task以外的状态机/架构/后端改造。

### Task 5: 推荐列表、匿名简历与职位详情精确上下文

**预期编辑文件：**

- 新增：无。
- 修改：`src/屏幕/看市场.tsx`、`src/屏幕/候选推荐.tsx`、`src/屏幕/匿名在线简历.tsx`、`src/屏幕/匿名在线简历.test.tsx`、`src/屏幕/职位详情.tsx`、`src/屏幕/职位详情.test.tsx`、`src/屏幕/职位详情展示/类型.ts`、`src/屏幕/职位详情展示/准备职位正文.ts`、`src/屏幕/职位详情展示/准备职位正文.test.ts`、`src/屏幕/职位详情展示/职位正文展示.tsx`、`src/屏幕/职位详情展示/职位正文展示.test.tsx`、`src/数据/在线简历正文映射.ts`、`src/数据/在线简历正文映射.test.ts`、`src/数据/招聘匹配依据映射.ts`。
- 删除：无预定文件；仅在证明旧实现无消费者后删除死代码，不删除历史文档。

**依赖与接口：** 依赖3/4。消费记录解释和C3组件，导航坐标采用C2四坐标；不新增API。

**范围与失败反例：** 招聘推荐收藏/淘汰和求职市场列表原圆环打开行内已有数据弹层，网络请求计数保持不变；scope切换清选中ID。推荐进入职位详情传精确坐标，替换现有按当前意向/岗位可能命中另一批的查找；刷新只恢复原记录，失败/不可用分支区分，通用job直达不扫描推荐。匿名简历及职位详情分析直接展开，新解释存在删除重复推荐依据/部分提示，总分位置保持唯一。验证同岗位双意向双批次分数各异，不能串值；保留委托、不感兴趣和匿名权限门。

- [ ] 核对当前 Task 文件和依赖产物；若基线已实现部分要求，记录证据而非覆盖重做；公共合同漂移先暂停依赖部分并报告。
- [ ] 在上述已有测试或指定新测试中加入本 Task 失败反例，先运行下列命令；应因目标行为缺失失败，不能因路径/fixture无关损坏失败。

```bash
npm test -- src/屏幕/匿名在线简历.test.tsx src/屏幕/职位详情.test.tsx src/屏幕/职位详情展示/准备职位正文.test.ts src/屏幕/职位详情展示/职位正文展示.test.tsx src/数据/在线简历正文映射.test.ts --maxWorkers=2 --retry=0
```

- [ ] 按本 Task 范围完成最小实现/断言迁移，保留未改行为的原测试；不通过宽松白名单、快照盲更新或吞错达成通过。
- [ ] 复跑该定向选集，预期全部通过；必要共享类型变更执行 `npm run typecheck`，记录命令、候选commit、选集/fixture与结果。
- [ ] 自检本 Task 的来源、缺失、权限与错误边界；按宿主执行 skill 完成必要 Task review，处理有效 finding 后只提交本 Task 文件。

**完成/停止条件：** 上述行为及失败反例有证据、依赖产物可供下一 Task 使用才完成；契约冲突、无法保留权限/来源或缺必需执行能力时明确报告，不能改Spec自证正确。非目标为本Task以外的状态机/架构/后端改造。

### Task 6: Case/协商/历史详情及真人聊天资料分析

**预期编辑文件：**

- 新增：无。
- 修改：`src/屏幕/P5/MatchCase列表.tsx`、`src/屏幕/P5/MatchCase列表.test.tsx`、`src/屏幕/P5/MatchCase历史.tsx`、`src/屏幕/P5/MatchCase历史.test.tsx`、`src/屏幕/P5/MatchCase详情.tsx`、`src/屏幕/详情控制/use后端详情控制.ts`、`src/屏幕/详情控制/use后端详情控制.test.tsx`、`src/屏幕/详情控制/后端正常详情.tsx`、`src/屏幕/详情控制/后端正常详情.test.tsx`、`src/组件/在谈详情/类型.ts`、`src/组件/在谈详情/职位资料.tsx`、`src/组件/在谈详情/职位资料.test.tsx`、`src/组件/在谈详情/在线简历正文.tsx`、`src/数据/详情展示映射.ts`、`src/数据/详情展示映射.test.ts`、`src/屏幕/P7/use真人会话资料.ts`、`src/屏幕/P7/use真人会话资料.test.tsx`、`src/屏幕/P7/Backend真人会话.tsx`、`src/屏幕/P7/Backend真人会话.test.tsx`、`src/组件/真人在线简历正文.tsx`。
- 删除：无预定文件；仅在证明旧实现无消费者后删除死代码，不删除历史文档。

**依赖与接口：** 依赖1/3/4。Case/协商用自己的响应，聊天只用会话Case。历史列表仅解码不加入口；历史详情展示自己的分析。

**范围与失败反例：** 在谈各非历史架子接圆环弹层，pre-Case资料与已有Case资料Tab直接展示单一区。Negotiation转Case和切record时清旧解释，权限失效时不保留旧分析；外层/嵌套不同来源不能拼接。招聘聊天完整纸身之后独立白区分析，不改纸身正文/PDF；求职聊天用现有职位资料版式。补hidden=true且无有效屏蔽显示服务端公司/合法空highlights用例，更新过期fixture说明；已投递Case权限仍读服务端，不能本地全放行。覆盖阶段新step与评分同时存在整页成功，保留S0、动作、PDF和迟到栅栏。

- [ ] 核对当前 Task 文件和依赖产物；若基线已实现部分要求，记录证据而非覆盖重做；公共合同漂移先暂停依赖部分并报告。
- [ ] 在上述已有测试或指定新测试中加入本 Task 失败反例，先运行下列命令；应因目标行为缺失失败，不能因路径/fixture无关损坏失败。

```bash
npm test -- src/屏幕/P5/MatchCase列表.test.tsx src/屏幕/P5/MatchCase历史.test.tsx src/屏幕/详情控制/use后端详情控制.test.tsx src/屏幕/详情控制/后端正常详情.test.tsx src/组件/在谈详情/职位资料.test.tsx src/屏幕/P7/use真人会话资料.test.tsx src/屏幕/P7/Backend真人会话.test.tsx src/数据/详情展示映射.test.ts --maxWorkers=2 --retry=0
```

- [ ] 按本 Task 范围完成最小实现/断言迁移，保留未改行为的原测试；不通过宽松白名单、快照盲更新或吞错达成通过。
- [ ] 复跑该定向选集，预期全部通过；必要共享类型变更执行 `npm run typecheck`，记录命令、候选commit、选集/fixture与结果。
- [ ] 自检本 Task 的来源、缺失、权限与错误边界；按宿主执行 skill 完成必要 Task review，处理有效 finding 后只提交本 Task 文件。

**完成/停止条件：** 上述行为及失败反例有证据、依赖产物可供下一 Task 使用才完成；契约冲突、无法保留权限/来源或缺必需执行能力时明确报告，不能改Spec自证正确。非目标为本Task以外的状态机/架构/后端改造。

### Task 7: Mock固定六维快照与全部演示消费者迁移

**预期编辑文件：**

- 新增：`src/数据/Mock匹配快照.ts`、`src/数据/Mock匹配快照.test.ts`。
- 修改：`src/数据/模拟数据.ts`、`src/数据/企业端模拟数据.ts`、`src/数据/匹配对齐.ts`、`src/数据/匹配对齐.test.ts`、`src/屏幕/看市场.tsx`、`src/屏幕/职位详情.tsx`、`src/屏幕/在谈首页.tsx`、`src/屏幕/在谈详情.tsx`、`src/屏幕/候选详情.tsx`、`src/屏幕/真人会话.tsx`、`src/屏幕/企业在谈候选.tsx`、`src/屏幕/企业真人会话.tsx`。
- 删除：无预定文件；仅在证明旧实现无消费者后删除死代码，不删除历史文档。

**依赖与接口：** 依赖4–6。新增固定记录ID→BFF匹配解释|null的小型Mock数据表，非运行时评分器；分数与表内total_points同源。

**范围与失败反例：** 逐一rg算适配分/匹配对齐/旧学历计分的消费者，将本次分析入口改用固定快照，列表和详情共享同一记录数据。至少四态、1/100技能0分、真实0、null解释有分和null分演示记录，账号/角色记录分开。编辑简历/JD不改变这些快照。Mock与Backend渲染同组件，历史列表仍无分数入口；清除已无消费者的旧计分路径，不删除其他仍用于公开JD展示的学历要求。

- [ ] 核对当前 Task 文件和依赖产物；若基线已实现部分要求，记录证据而非覆盖重做；公共合同漂移先暂停依赖部分并报告。
- [ ] 在上述已有测试或指定新测试中加入本 Task 失败反例，先运行下列命令；应因目标行为缺失失败，不能因路径/fixture无关损坏失败。

```bash
npm test -- src/数据/Mock匹配快照.test.ts src/数据/匹配对齐.test.ts src/屏幕/职位详情.test.tsx --maxWorkers=2 --retry=0
```

- [ ] 按本 Task 范围完成最小实现/断言迁移，保留未改行为的原测试；不通过宽松白名单、快照盲更新或吞错达成通过。
- [ ] 复跑该定向选集，预期全部通过；必要共享类型变更执行 `npm run typecheck`，记录命令、候选commit、选集/fixture与结果。
- [ ] 自检本 Task 的来源、缺失、权限与错误边界；按宿主执行 skill 完成必要 Task review，处理有效 finding 后只提交本 Task 文件。

**完成/停止条件：** 上述行为及失败反例有证据、依赖产物可供下一 Task 使用才完成；契约冲突、无法保留权限/来源或缺必需执行能力时明确报告，不能改Spec自证正确。非目标为本Task以外的状态机/架构/后端改造。

### Task 8: 薪资显示函数与填写回显统一

**预期编辑文件：**

- 新增：`src/数据/薪资展示.ts`、`src/数据/薪资展示.test.ts`。
- 修改：`src/数据/后端映射.ts`、`src/数据/后端映射.test.ts`、`src/屏幕/学生分流.tsx`、`src/屏幕/学生分流.test.tsx`、`src/屏幕/添加意向.tsx`、`src/屏幕/添加意向.test.tsx`、`src/屏幕/发布岗位.tsx`、`src/屏幕/发布岗位.薪资地点.test.tsx`、`src/屏幕/求职意向管理.tsx`、`src/屏幕/顶部意向栏.tsx`、`src/屏幕/岗位管理.tsx`、`src/屏幕/岗位详情.tsx`。
- 删除：无预定文件；仅在证明旧实现无消费者后删除死代码，不删除历史文档。

**依赖与接口：** 独立薪资边界，按顺序执行避免共享文件冲突。实现C4两个格式函数，消费数值/有限字符串，输出Spec §8A的文本，不改DTO写入类型。

**范围与失败反例：** 表驱动覆盖month/day/hour、12/14/缺失、同值、面议、空白、未知格式、K/day与K/hour不猜元、幂等；结构化数据和显示字符串冲突不择一拼接。保留填写控件数值/单位/年薪月数输入布局，统一选后摘要、管理列表/顶栏回显。检查保存解析路径，en dash和x后缀不得造成保存失败或年薪月数丢失；测试选择→保存请求体仍数值→读取一致。表单未确认、面议三态不改变。

- [ ] 核对当前 Task 文件和依赖产物；若基线已实现部分要求，记录证据而非覆盖重做；公共合同漂移先暂停依赖部分并报告。
- [ ] 在上述已有测试或指定新测试中加入本 Task 失败反例，先运行下列命令；应因目标行为缺失失败，不能因路径/fixture无关损坏失败。

```bash
npm test -- src/数据/薪资展示.test.ts src/数据/后端映射.test.ts src/屏幕/学生分流.test.tsx src/屏幕/添加意向.test.tsx src/屏幕/发布岗位.薪资地点.test.tsx --maxWorkers=2 --retry=0
```

- [ ] 按本 Task 范围完成最小实现/断言迁移，保留未改行为的原测试；不通过宽松白名单、快照盲更新或吞错达成通过。
- [ ] 复跑该定向选集，预期全部通过；必要共享类型变更执行 `npm run typecheck`，记录命令、候选commit、选集/fixture与结果。
- [ ] 自检本 Task 的来源、缺失、权限与错误边界；按宿主执行 skill 完成必要 Task review，处理有效 finding 后只提交本 Task 文件。

**完成/停止条件：** 上述行为及失败反例有证据、依赖产物可供下一 Task 使用才完成；契约冲突、无法保留权限/来源或缺必需执行能力时明确报告，不能改Spec自证正确。非目标为本Task以外的状态机/架构/后端改造。

### Task 9: 所有既有薪资展示消费者对齐

**预期编辑文件：**

- 新增：无。
- 修改：`src/数据/发现推荐映射.ts`、`src/数据/发现推荐映射.test.ts`、`src/数据/连续代谈展示映射.ts`、`src/数据/连续代谈展示映射.test.ts`、`src/数据/详情展示映射.ts`、`src/数据/详情展示映射.test.ts`、`src/数据/企业公开页展示映射.ts`、`src/数据/企业公开页展示映射.test.ts`、`src/组件/列表卡片/求职推荐卡.tsx`、`src/组件/列表卡片/求职在谈卡.tsx`、`src/组件/在谈详情/职位资料.tsx`、`src/组件/问AI代理/查询结果展示.tsx`、`src/屏幕/职位详情展示/准备职位正文.ts`、`src/数据/模拟数据.ts`、`src/数据/企业端模拟数据.ts`、`src/屏幕/真人会话.tsx`、`src/屏幕/企业真人会话.tsx`。
- 删除：无预定文件；仅在证明旧实现无消费者后删除死代码，不删除历史文档。

**依赖与接口：** 依赖8，并保留5–7解释接线。逐行落实Spec §8A.2，输入限本记录当前/冻结公开薪资；不是解释compensation维度。

**范围与失败反例：** 让推荐、代谈、Case顶栏/资料、聊天、企业公开职位和助手结构化查询卡使用同函数；移除JSX零散replace和独立N薪标签，12也不保留。Case优先同源可用结构化字段；只有字符串的按有限识别，未知显示薪资未知，不补读新JD。不把统一格式变成统一版式，列表保留原紧凑绿色薪资，资料页仍资料行。Mock薪资记录规范且后缀仅一次；保留招聘候选数字不披露，历史无薪资的行不新造字段。

- [ ] 核对当前 Task 文件和依赖产物；若基线已实现部分要求，记录证据而非覆盖重做；公共合同漂移先暂停依赖部分并报告。
- [ ] 在上述已有测试或指定新测试中加入本 Task 失败反例，先运行下列命令；应因目标行为缺失失败，不能因路径/fixture无关损坏失败。

```bash
npm test -- src/数据/发现推荐映射.test.ts src/数据/连续代谈展示映射.test.ts src/数据/详情展示映射.test.ts src/数据/企业公开页展示映射.test.ts src/组件/在谈详情/职位资料.test.tsx --maxWorkers=2 --retry=0
```

- [ ] 按本 Task 范围完成最小实现/断言迁移，保留未改行为的原测试；不通过宽松白名单、快照盲更新或吞错达成通过。
- [ ] 复跑该定向选集，预期全部通过；必要共享类型变更执行 `npm run typecheck`，记录命令、候选commit、选集/fixture与结果。
- [ ] 自检本 Task 的来源、缺失、权限与错误边界；按宿主执行 skill 完成必要 Task review，处理有效 finding 后只提交本 Task 文件。

**完成/停止条件：** 上述行为及失败反例有证据、依赖产物可供下一 Task 使用才完成；契约冲突、无法保留权限/来源或缺必需执行能力时明确报告，不能改Spec自证正确。非目标为本Task以外的状态机/架构/后端改造。

### Task 10: 浏览器接线、视觉场景与测试清单

**预期编辑文件：**

- 新增：无。
- 修改：`e2e/fixtures/bff/发现推荐.ts`、`e2e/fixtures/bff/MatchCase.ts`、`e2e/fixtures/bff/隐私与实名.ts`、`e2e/fixtures/bff/真人消息.ts`、`e2e/suites/发现推荐.spec.ts`、`e2e/suites/MatchCase.spec.ts`、`e2e/suites/连续委托.spec.ts`、`e2e/suites/真人消息.spec.ts`、`e2e/suites/展示与交互.spec.ts`、`e2e/视觉回归/场景.ts`、`e2e/视觉回归/场景.test.ts`、`docs/testing/README.md`、`docs/testing/cases.md`。
- 删除：无预定文件；仅在证明旧实现无消费者后删除死代码，不删除历史文档。

**依赖与接口：** 依赖1–9。通过现有离线边界fixture和Mock端口验证实际页面，不使用真实账号。更新现有Suite，不另建runner。

**范围与失败反例：** 新增用例统一标题前缀六维展示对齐，分别覆盖招聘筛选卡/匿名详情、市场精确上下文硬刷、Case非历史与历史详情、pre-Case→Case嵌套、聊天两端资料、step+ref整页、写后重读和迟到隔离。断言URL include且弹层零额外请求、null/0和错误重试；薪资用同记录跨页断言并检查后缀重复。视觉新增match-explanation-*场景，覆盖四态长原因、技能部分0、缺失、弹层和招聘纸身独立分析，320/360窄屏及普通宽度人工看图。场景清单单测同步；README记实际命令结果/环境边界，cases用生成器。

- [ ] 核对当前 Task 文件和依赖产物；若基线已实现部分要求，记录证据而非覆盖重做；公共合同漂移先暂停依赖部分并报告。
- [ ] 在上述已有测试或指定新测试中加入本 Task 失败反例，先运行下列命令；应因目标行为缺失失败，不能因路径/fixture无关损坏失败。

```bash
npm run test:e2e -- e2e/suites/发现推荐.spec.ts e2e/suites/MatchCase.spec.ts e2e/suites/连续委托.spec.ts e2e/suites/真人消息.spec.ts e2e/suites/展示与交互.spec.ts --grep 六维展示对齐 --list
```

- [ ] 上述 --list 仅核对选择非空；随后去掉 --list，加 `--workers=2 --retries=0` 执行所选新增用例。按 fixture 数据源分别选择场景，不访问真实后端。
- [ ] 按本 Task 范围完成最小实现/断言迁移，保留未改行为的原测试；不通过宽松白名单、快照盲更新或吞错达成通过。
- [ ] 复跑该定向选集，预期全部通过；必要共享类型变更执行 `npm run typecheck`，记录命令、候选commit、选集/fixture与结果。
- [ ] 自检本 Task 的来源、缺失、权限与错误边界；按宿主执行 skill 完成必要 Task review，处理有效 finding 后只提交本 Task 文件。

**完成/停止条件：** 上述行为及失败反例有证据、依赖产物可供下一 Task 使用才完成；契约冲突、无法保留权限/来源或缺必需执行能力时明确报告，不能改Spec自证正确。非目标为本Task以外的状态机/架构/后端改造。

## 实施后收尾（不计入 Task count）

1. 全部编号 Task 和执行 skill 要求的宿主内全局 review 完成后退出 Task 循环。立即调用异构 review：Codex→claude-review-loop，Claude Code→以 Codex 为 reviewer 的多轮只读 review-loop。绑定本 Spec/Plan 精确版本、固定候选 base/head 与用户非目标；共用合同按 skill 根目录的 `../_shared/review-contract.md` 读取。reviewer 不运行测试、不改文件；轮次/裁决/上限由该 skill 决定。轮间仅修复相关轻量测试，不运行整套 affected。
2. 异构 review 返回后，按实际diff重算最小充分的 affected/L0–L2。Task 通过证据输入相同可以复用，不能在这之后再次调用 Task/global/异构 review。完成 `npm run typecheck`、`npm run lint`、`npm run build`、`git diff --check`，不把build成功等同浏览器成功。
3. 汇总单元责任：Task 1–9所列选集加实际受影响的已存测试，复用有效通过项，仅补变更或未覆盖的项。浏览器先 --list：Task10标题选集；另外对原发现推荐、MatchCase、真人消息Suite中受影响旧例选择最小回归，不能只跑新测试而忽略默认协议fixture变更。若共享fixture变化影响更多Suite，按调用者实际集合补测，不默认跑整个仓库。
4. 视觉命令：`npm test -- e2e/视觉回归/场景.test.ts`；`UI_CAPTURE_DIR=test-results/match-explanation-visual npm run ui:capture -- --grep 'match-explanation-' --workers=2 --retries=0`。先用同命令 --list 确认场景非空，再执行；人工看图并记录窄屏/长原因/弹层/纸身/薪资布局，不能只说截图生成成功。复跑可能清理test-results，按README保存本轮证据。
5. 执行 `npm run test:list -- --write`、`npm run test:list -- --check` 更新/校验清单。测试清单只是收集证据，不等于运行通过。把实际结果摘要写回本Plan实施记录和README既有记录位置，不额外创建review report/handoff文档。
6. 人工 final gate 前展示具体候选commit、target读到的SHA、实际选集/结果、可复用证据和未验收边界及拟合入动作，等待用户明确确认。当前规划授权不等于push授权；确认前只读fetch，不合target、不push、不部署。
7. 确认后读 development-workflow skill 根目录 `references/final-integration.md` 和 `assets/final-integration-contract.md`：同步target记录final_target_base→重算完整责任→有效PASS零重跑、只补变化缺口→再次核对target→普通fast-forward push，禁止force push。用户明确接手真实验收覆盖默认L3步骤：Agent不运行正式L3/真实登录/真实Case操作，写“真实环境未验收，由用户负责”；不声称真实验收PASS。target继续推进时重新对账，不绕过保护强推。

## 测试选择五问与环境边界

1. 防止的失败：闭合解码拒绝合法新字段、误收损坏评分、不同批次/角色串解释、写后丢展开、S2提前显示S3、薪资单位错误/重复后缀、权限失效残留、窄屏交互不可达。
2. 开发反馈命令已逐Task给出；新增行为先失败再实现，测试选择采用原生路径/-t/--grep，必须检查0 tests/跳过不算通过。
3. 真实边界：本次无SQL/后端事务改动；wire一致性由固定OpenAPI/验证器只读核对及fixture证明。部署服务实际版本、真实Case与授权效果未由fixture证明；如出现只能真实环境确认的问题，记录精确页面/API/字段交由用户，不自行操作账号或启动后端。
4. 自动化完成责任归实施Agent；真实环境验收归用户，L3 selection=none（用户明确覆盖），不是L3 PASS。发布/部署不在授权内，合入遵守final gate。
5. 已有证据：rebase后旧薪资定向24 passed/252 skipped，约1.74s，仅说明旧现状，不证明新代码。各新选集和视觉成本未知，运行后记实测，不为填时长先跑全套。规划阶段不跑产品测试。

## Spec 对账与文档 review 记录

覆盖关系：Spec §3/4→Task4–7；§5/6→Task2/3/5/6；§7→Task7；§8→Task6/10；§8A→Task8/9/10；§8B→Task1/3/6/10；§9/10→Global Constraints及不计数收尾。

文档 review 候选：本 Plan Revision 1 与已批准 Spec Revision 3。review_mode=WORKFLOW_DOCUMENT_REVIEW；scope_approved_by_parent_workflow=true；精确范围仅本Plan与上述Spec。审查结果由planning owner在本节逐轮记录；没有实际报告前不得标clean，不生成执行prompt。
