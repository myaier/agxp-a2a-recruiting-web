# 聊天与推荐展示修复：纯前端 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Claude Code 调用 superpowers:subagent-driven-development；Codex 调用 superpowers:executing-plans。按依赖连续完成本文件 Task，收尾另列，不在规划 session 实施。

**Goal:** 仅在前端仓库、使用现有后端 API 完成聊天真实资料、统一头像/纸身、有限匹配依据展示及企业屏蔽开关接线。
**Architecture:** 复用 P5/P7/岗位/公开企业和隐私状态操作；新增页面范围的补读编排及小型纯展示模型。保持现有 wire 合同，局部共享 Mock/Backend 展示，不建立通用缓存或评分器。
**Tech Stack:** React / TypeScript / CSS Modules / Vitest / Playwright。
**Spec:** `docs/superpowers/specs/2026-09-17-chat-recommendation-display-design.md` Revision 2；批准 revision `a6d0c8dd0d1f8c6e80dae4e2f2f2a8f61eeebacd`，blob `48605e22481f555811c554674687d26742cf30c5`。用户在“可以，那你也修改Plan吧，然后再做 /claude-review-loop 和写执行提示词”中批准。此前九 Task 跨仓库方案及其审查已废止。

## Global Constraints

- 唯一实施 repository 是当前前端仓库，工作区 `.`；所有文件和命令相对此根。不编辑/提交后端，不改后端 OpenAPI/schema，不运行后端测试/服务/migration，不需要后端新提交作为前置。
- 开工读取 AGENTS.md、CLAUDE.md、`docs/testing/README.md`，核对实际 HEAD 和相关差异。研究基线 `bb6ff6e03e6f542a3fe5a0604e6c9ced326a7386`；批准 Spec revision 如上。现场实施基线记录在本文件末尾，不能用移动分支替代精确 Git 对象。
- 复用用户原工作区，不创建第二用户工作区，不自动 stash/reset/clean。target 规划候选 `main`；真正 target ref/SHA 和同步/push 必须在 final gate 明确批准。
- 外部 skill 按逻辑名称发现，资源按 skill 根目录解析，不写规划机器绝对路径。开工按 development-workflow 的 scripts/task_intents.py 登记并检查重叠。
- 禁止新增 wire counterpart/match_analysis，禁止从 BFF 契约删除 hidden。前端新展示类型只存在于本仓库，不伪装为服务器返回字段。
- 只读当前授权身份。真实姓名缺失用角色缺值文案，头像取真实姓名首个 Unicode 字符或“·”；不从 alias、公司、岗位或提示文案推导姓名首字。
- 招聘聊天副标题“投递企业 · 投递岗位”，企业是用人方；求职聊天“招聘者所属公司 · 职务”，企业是发布方。
- 真人消息头像统一32×32px，列表头像尺寸不变；手机号/邮箱一律“—”。
- 六维分析只解释现有正向依据，不算新分数、不把缺码当未匹配。保持后端总分；不承诺精确部分得分或技能全集。
- 企业开关操作现有组织屏蔽 API；新建/新 PDF 预填经历 hidden=false，旧经历 hidden 原值保留，不批量改旧值，不改后端过滤或权限逻辑。
- 不改亮点生成器，不重解析 PDF，不清库，不回填旧数据，不修后端缺陷。真实接口信息不足时诚实展示，记录后端依赖，不跨仓补实现。
- 每 Task 使用 TDD 覆盖实际变更风险，不为纯文案镜像造测试。先跑新增反例确认失败、实现后复跑；实现以最小改动为准，公共签名和行为按本 Plan，内部 helper 可等价组织。

## Task index 与档位

Task count: 6
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

**计划本身复杂度：中。** 单仓库但涉及身份补读、表单保存及共享展示。
**零上下文漂移风险：高。** P5 读锁/权限新鲜度和隐私写入部分成功需要精确处理；执行模型使用当前可用的行业顶尖模型。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|企业开关接现有 API，独立|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|2|聊天列表与详情资料补读，独立|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|3|32px 双方真实头像，依赖2|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|4|聊天在线纸身，依赖2|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|5|推荐有限依据及公司/亮点，独立|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|6|浏览器接线与视觉，依赖1–5|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|

顺序1→2→3→4→5→6。Task 2 的本地资料模型是 Task 3/4 的前置。共享文件串行编辑，不为并行额外拆工作区。所有新增/修改仅下述前端路径；确需增补消费者文件先更新 intent、在实施记录解释因果，不借此扩大产品范围。

## 共同契约与失败语义

### A. 聊天资料（仅前端模型）

在 `src/屏幕/消息列表展示/会话资料映射.ts` 定义/导出：
```ts
export type 真人对方资料 = {
  姓名: string | null;
  头像URL: string | null;
  企业: string | null;
  职位: string | null;
};
export type 会话资料状态 =
  | { 状态: 'loading' | 'unavailable'; 资料: null }
  | { 状态: 'available'; 资料: 真人对方资料 };
export function 取姓名首字(name: string | null): string; // Array.from(trim)[0] ?? '·'
```
映射纯函数的输入使用既有 P5详情类型、角色及本轮解析的发布企业名（string|null）；不接 wire 新字段。匿名 candidateIdentity 不返回 name/avatar；disclosed 时两字段独立处理，有图无名仍显示图。招聘企业来自同 Case jobDetail.organization.display_name，岗位取冻结 context.job.job.title；候选方沿现有可信 publisher 链。用同一模型组装列表与页头，失败不暴露旧资料。

补读只消费已加载 available P7 项，按 role+caseId 去重，最多4个 Case任务同时运行。每个任务包括必要的 Case→岗位→企业读取；相同岗位/企业在本次页面轮次去重。翻页只追加新项；失败停在局部 unavailable，可显式重试，不无限重试。页面、主体、角色切换使所有在飞回执失效；当前 P7 unavailable、P5拒绝或清空时资料立即撤下。

**新鲜度反例必须防住：** 当前 `读取详情` 遇读锁可能立即返回，Promise fulfilled 不等于完成新授权读取。编排应等待真实在飞读取并核对当前 scope generation 的成功快照；不能用原缓存加一个“已完成”布尔位当本轮成功。优先在既有 P5 读操作内让同 key 复用同一真实 Promise（仍为 Promise<void>，不新增 API），并保持现有主体/代际栅栏。相同约束用于岗位/企业链；不同 key 失败不串联清空其他行。

### B. 企业屏蔽表单

待提交意图只保存在页面草稿 Map<organization_id, boolean>，不是持久的第二份屏蔽状态。同企业各入口共用权威状态加本地待保存意图。现有经历折叠卡“已对该公司隐身”徽标也按有效企业屏蔽派生，不再读hidden；尚未提交的开关意图单独标“待保存”，不能用“已”字样冒充服务端生效。开关“完成”只修改草稿，外层“保存”才写现有 API；没有有效企业或必填不完整，先阻止整份保存，零写请求。

保存先校验并确认所有 derived 来源解除，再按用户明确意图顺序调用现有 `添加组织屏蔽(id,'手动添加')` / `解除组织屏蔽(屏蔽项)`，每个成功后从待提交集合移除并权威回读，然后现有 `保存简历`。失败保留未成功意图和简历草稿，提示未保存，不自动回滚已成功变更、不宣称全部成功；重试核对当前权威状态再跳过已达成项。409不盲重放。修改/删除经历不推导 unblock；取消未提交草稿零写。

inactive derived 屏蔽不是 manual：若总开关关闭但同组织已有 derived 记录，开关不显示生效，也不默默开启全局保护或删除旧来源；引导用户到现有隐私页处理后重读，避免 source conflict。保持既有风险确认和错误恢复语义。

hidden wire/本地字段继续存在：新增经历默认false；旧经历编辑/序列化保留原值。该字段不再由企业屏蔽 UI 改写。本轮无法解除旧 hidden 对公司/亮点的服务端过滤，不在正文自由文本中猜公司。

### C. 有限匹配展示（仅前端模型）

在 `src/数据/招聘匹配依据映射.ts` 定义：
```ts
export type 匹配依据行 = {
  维度: 'category'|'skills'|'experience'|'location'|'workplace_mode'|'compensation';
  状态: 'positive'|'some_skills'|'partial'|'unknown'|'not_provided';
  说明: string;
};
```
输入用现有 card.highlights、structured_requirements_confirmed、compensation_relationship。固定六行；category/experience/location/workplace 对应正向码为 positive（经验还必须 confirmed）；skills_matched 为 some_skills，文案“有技能命中”，不声称全匹配；薪资明确 overlap 为 positive、near_miss 为 partial、unknown 为 unknown。薪资关系与原因矛盾时不拼造一致性，显示 not_provided 并说明判定不完整；disjoint 非正常推荐也不自行构造新扣分。其他缺码 not_provided。

positive 用勾；some_skills 明确“有技能命中”；partial 标部分匹配；unknown“未核对”；not_provided“未提供判定”。不画缺项不匹配叉，不展示逐项分值/满分。未知原因码不显示原始技术 token。保持总分、标签字段和原因字段各自语义；共享旧 亮点文案 的其他消费者不随此任务变算法。

## 测试选择与完成边界

本仓库无后端 tools/test affected 入口，禁止引用或运行它。按 `docs/testing/README.md`：Vitest 文件级负责映射/状态/交互，Playwright fixture负责浏览器接线，视觉场景负责几何和版式。不会用 fixture验证后端真实权限。

1. 防止失败：资料越权/过期缓存、重复补读/并发无限、隐私意图丢失/部分成功假报、hidden旧值误覆盖、缺原因误判不匹配、坏图/纸身误走PDF。
2. 最小开发反馈：各 Task 精确命令；不默认全仓 npm test。
3. 真实边界：无需 PG/后端执行。浏览器用显式离线 BFF routes，不为方便放宽兜底；状态组合放在低层，浏览器不重复全部矩阵。
4. 最终权威验收：聚合 Task 1–6 的受影响 Vitest 文件（去重）+typecheck/build+Task6浏览器与视觉；按完整实际 diff检查关联消费者，新增变化才补缺口。清单用 test:list 更新并check。未做真实E2E不能声称全栈通过。
5. 证据/成本：规划阶段无产品测试；实际耗时未知，沿既有fixture和受控Promise验证，不加sleep/外部服务。L3 selection=`conditional`：仅当用户另行指定已部署环境并授权真实浏览器验收，按 `docs/dogfood/真实后端行为验收.md` 已有活动范围选择；本Plan不运行STG、不启动用户另一环境、不部署后端。本轮默认无正式L3执行，明确保留真实接口授权验证缺口。

替换旧断言的责任：固定“会”/alias→已授权姓名及缺值/失权；26px→32px；原件lease→在线纸身零PDF请求；新增hidden=true→新false/旧值保留；空匹配区+推荐依据→唯一有限六维展示。分页、未读、历史消息、现有Case附件路径的独立责任保留。

---

### Task 1: 经历企业屏蔽接线与新经历默认值

**依赖：** 无。

**预期编辑文件：**

- 修改：`src/屏幕/工作经历.tsx`
- 修改：`src/屏幕/工作经历.行业与企业.test.tsx`
- 修改：`src/屏幕/工作经历.资料与预填.test.tsx`
- 修改：`src/流程/候选Onboarding简历预填.ts`
- 修改：`src/流程/候选Onboarding简历预填.test.ts`
- 修改：`src/数据/后端映射.ts`
- 修改：`src/数据/后端映射.test.ts`
- 修改：`src/状态/后端/隐私操作.ts`
- 修改：`src/状态/后端/隐私操作.test.ts`
- 修改：`src/状态/领域/隐私设置.ts`
- 修改：`src/状态/初始状态.ts`
- 删除：无整文件删除。

**目标与接口：** 实现共同契约B，复用现有 API/权威隐私快照。保留 BFF hidden 合同与旧记录值；不修改服务器，不新增清库或迁移。

**非目标：** 不改变批准Spec，不添加后端工作、迁移兼容或新wire字段。

- [ ] Step 1: 为新手填/PDF经历false、旧true无关保存仍true、同组织同步、取消零写、保存部分成功后重试写用例；包含旧hidden=true但无有效屏蔽不显示已隐身徽标、新屏蔽成功后显示、未提交只显示待保存。通过已有操作入口测试，而不是复制屏蔽规则。
- [ ] Step 2: 将经历编辑底部开关绑定有效企业屏蔽与待提交意图；先读取权威隐私，读取未成功不能把空快照视为无屏蔽。Map按组织去重，编辑完成回上层保留意图，取消仅丢弃尚未提交意图。
- [ ] Step 3: 外层保存按契约B校验→确认→顺序隐私操作→简历保存；每项成功才移除意图。复用既有revision/幂等/网络结果核对，不因void锁让路假报成功；保存按钮锁覆盖整个保存链。derived关闭保留现有确认，inactive derived按契约B提示而非覆盖来源。
- [ ] Step 4: 新建和新PDF预填默认隐藏false，旧条目保持源字段；将既有折叠卡隐身徽标从隐藏字段改为有效企业屏蔽/待保存状态，换公司/删经历不推导解除。Mock走同一可观察规则和已有隐私reducer。
- [ ] Step 5: 按下列定向命令先验证新增反例失败、实现后通过；与本改动无关的失败如实记录并定位，不删除独立断言掩盖问题。

```bash
npm test -- src/屏幕/工作经历.行业与企业.test.tsx src/屏幕/工作经历.资料与预填.test.tsx src/流程/候选Onboarding简历预填.test.ts src/数据/后端映射.test.ts src/状态/后端/隐私操作.test.ts
npm run typecheck
```

**关键断言/失败反例：** 屏蔽/披露独立；409保留意图且无自动重放；取消/校验失败零写；重复点击不假成功；新hidden=false但旧true保留；旧样本公司仍空不宣称后端修复。

- [ ] Step 6: 自检实际diff和消费者，提交本Task明确文件；本文件末尾记录commit、定向结果、现场差异。禁止git add .纳入用户其他内容。

**完成条件：** 接口和断言成立，定向验证通过，无后端依赖新增。**停止条件：** 需要后端变更或改变批准产品语义时记录具体边界，不自行跨仓；普通实现错误继续修复，缺环境不写PASS。

### Task 2: 用现有API补齐聊天列表与详情资料

**依赖：** 无；生产者为现有P7/P5/岗位/企业。

**预期编辑文件：**

- 修改：`src/屏幕/P7/Backend会话列表.tsx`
- 修改：`src/屏幕/P7/Backend会话列表.test.tsx`
- 修改：`src/屏幕/P7/use真人会话资料.ts`
- 修改：`src/屏幕/P7/use真人会话资料.test.tsx`
- 修改：`src/屏幕/消息列表展示/类型.ts`
- 修改：`src/屏幕/消息列表展示/消息行映射.ts`
- 修改：`src/屏幕/消息列表展示/消息行映射.test.ts`
- 修改：`src/屏幕/消息列表展示/消息列表展示.tsx`
- 修改：`src/屏幕/消息列表展示/消息列表展示.test.tsx`
- 修改：`src/屏幕/消息列表.tsx`
- 修改：`src/屏幕/企业消息.tsx`
- 修改：`src/屏幕/消息列表.module.css`
- 修改：`src/状态/后端/MatchCase操作.ts`
- 修改：`src/状态/后端/MatchCase操作.test.ts`
- 修改：`src/状态/后端/发现推荐操作.ts`
- 修改：`src/状态/后端/发现推荐操作.test.ts`
- 修改：`src/状态/后端/组织操作.ts`
- 修改：`src/状态/后端/组织操作.test.ts`
- 新增：`src/屏幕/消息列表展示/会话资料映射.ts`
- 新增：`src/屏幕/消息列表展示/会话资料映射.test.ts`
- 新增：`src/屏幕/P7/use会话列表资料.ts`
- 新增：`src/屏幕/P7/use会话列表资料.test.tsx`
- 删除：无整文件删除。

**目标与接口：** 产出共同契约A，只增加前端展示模型和页面补读hook；保持wire解码不变。详情和列表映射同源，不用匿名代号冒充姓名。

**非目标：** 不改变批准Spec，不添加后端工作、迁移兼容或新wire字段。

- [ ] Step 1: 先构造两角色、hiring≠publisher、匿名/已披露、缺图/缺名、失败和unavailable的映射反例；公司空时招聘只岗位，无孤立分隔符。
- [ ] Step 2: 实现 use会话列表资料(role, items) 页面编排：本轮role+case去重、最多4个任务、分页追加、岗位/企业本轮去重、失败定向重试；不每render重拉，不注册定时轮询或新全局缓存。
- [ ] Step 3: 修现有读取操作的必要单飞等待边界：同key等真实Promise及当前generation快照，捕获主体/会话代际；StrictMode重放和列表跳详情不把读锁立即return误认授权成功。仅修改受此真实竞态影响的方法，不重构全域。
- [ ] Step 4: 在消息行映射增加可选本地资料参数，组装后再用于本地搜索；姓名/副标题/头像取同一个本轮状态。P7失权撤下资料，旧Promise不能复活。详情hook复用纯映射并保留现有P5正文读取。Mock统一三行布局和副标题。
- [ ] Step 5: 按下列定向命令先验证新增反例失败、实现后通过；与本改动无关的失败如实记录并定位，不删除独立断言掩盖问题。

```bash
npm test -- src/屏幕/消息列表展示/会话资料映射.test.ts src/屏幕/消息列表展示/消息行映射.test.ts src/屏幕/消息列表展示/消息列表展示.test.tsx src/屏幕/P7/use会话列表资料.test.tsx src/屏幕/P7/Backend会话列表.test.tsx src/屏幕/P7/use真人会话资料.test.tsx src/状态/后端/MatchCase操作.test.ts src/状态/后端/发现推荐操作.test.ts src/状态/后端/组织操作.test.ts
```

**关键断言/失败反例：** 最多4个Case任务；同Case/岗位/企业去重；翻页不重拉成功旧项；缺名有图保留图；失权/换账号/迟到成功不泄漏；姓名搜索随加载结果更新；分页未读排序不变。

- [ ] Step 6: 自检实际diff和消费者，提交本Task明确文件；本文件末尾记录commit、定向结果、现场差异。禁止git add .纳入用户其他内容。

**完成条件：** 接口和断言成立，定向验证通过，无后端依赖新增。**停止条件：** 需要后端变更或改变批准产品语义时记录具体边界，不自行跨仓；普通实现错误继续修复，缺环境不写PASS。

### Task 3: 真人消息32px头像与本人照片

**依赖：** Task2 真人对方资料/取姓名首字。

**预期编辑文件：**

- 修改：`src/屏幕/P7/Backend真人会话.tsx`
- 修改：`src/屏幕/P7/Backend真人会话.test.tsx`
- 修改：`src/屏幕/直聊会话.tsx`
- 修改：`src/屏幕/直聊会话.module.css`
- 修改：`src/屏幕/直聊会话.test.tsx`
- 修改：`src/屏幕/真人会话.module.css`
- 修改：`src/屏幕/真人会话.tsx`
- 修改：`src/屏幕/企业真人会话.tsx`
- 删除：无整文件删除。

**目标与接口：** 消费共同契约A的真实姓名与授权图，本人用既有账号头像；双方消息头像32px，列表尺寸不动。

**非目标：** 不改变批准Spec，不添加后端工作、迁移兼容或新wire字段。

- [ ] Step 1: 为双方img error回退各自首字、空名字为·、新URL重试、删图以及有图无名写组件用例。首字从原始姓名取，不从回退标题取。
- [ ] Step 2: 我方按角色读取已存在的候选账号/招聘档案头像，直达页面也复用现有资料读取；保留候选头像revision缓存机制，账户切换清理失败状态和旧图片。
- [ ] Step 3: 统一32px圆形并去掉我方2px偏移，镜像气泡净空按32px与既有gap调整；检查共享CSS消费者，限定真人聊天，不改AI专用头像。
- [ ] Step 4: Mock两端同步回退与尺寸；不拿演示人像填Backend缺图。
- [ ] Step 5: 按下列定向命令先验证新增反例失败、实现后通过；与本改动无关的失败如实记录并定位，不删除独立断言掩盖问题。

```bash
npm test -- src/屏幕/P7/Backend真人会话.test.tsx src/屏幕/直聊会话.test.tsx src/屏幕/真人会话.test.tsx src/屏幕/企业真人会话.test.tsx
npm run typecheck
```

**关键断言/失败反例：** 两侧坏图均首字回退；直接进入会话能读本人图；换账号不串图；浏览器Task6证明尺寸和长消息几何。

- [ ] Step 6: 自检实际diff和消费者，提交本Task明确文件；本文件末尾记录commit、定向结果、现场差异。禁止git add .纳入用户其他内容。

**完成条件：** 接口和断言成立，定向验证通过，无后端依赖新增。**停止条件：** 需要后端变更或改变批准产品语义时记录具体边界，不自行跨仓；普通实现错误继续修复，缺环境不写PASS。

### Task 4: 招聘聊天在线简历纸身

**依赖：** Task2 当前Case授权资料，既有candidate_resume。

**预期编辑文件：**

- 修改：`src/屏幕/P7/Backend真人会话.tsx`
- 修改：`src/屏幕/P7/Backend真人会话.test.tsx`
- 修改：`src/屏幕/企业真人会话.tsx`
- 修改：`src/屏幕/企业真人会话.test.tsx`
- 修改：`src/组件/简历预览层.tsx`
- 修改：`src/组件/简历预览层.module.css`
- 修改：`src/组件/简历预览层.test.tsx`
- 新增：`src/组件/真人在线简历正文.tsx`
- 新增：`src/组件/真人在线简历正文.test.tsx`
- 删除：无整文件删除。

**目标与接口：** 提取纯展示纸身；输入name/title/experienceYears/experiences/educations/selfDescription/onClose，不读取应用状态。区段null和[]区分，加载/错误/重试在消费者外层。

**非目标：** 不改变批准Spec，不添加后端工作、迁移兼容或新wire字段。

- [ ] Step 1: 先写“看在线简历”打开纸身且零PDF lease请求、继续沟通关闭、手机邮箱—、缺区段与合法空不同的用例。
- [ ] Step 2: 从现有简历纸身提取仅本轮两个消费者需要的结构。Backend映射同Case身份+candidate_resume；Mock映射独立演示数据，真实联系人不取Mock。
- [ ] Step 3: 按截图布局姓名→职位年限→联系方式占位→工作→教育→优势→继续沟通；日期右对齐，经历源顺序，不从描述补被隐藏公司。
- [ ] Step 4: 删除该入口PDF租约代码，其他Case附件入口不动；无resume_ref但结构化可读仍能打开；失权/换会话清空关闭旧层，错误显示定向重试。
- [ ] Step 5: 按下列定向命令先验证新增反例失败、实现后通过；与本改动无关的失败如实记录并定位，不删除独立断言掩盖问题。

```bash
npm test -- src/组件/真人在线简历正文.test.tsx src/组件/简历预览层.test.tsx src/屏幕/P7/Backend真人会话.test.tsx src/屏幕/企业真人会话.test.tsx
```

**关键断言/失败反例：** 不改后端字段；真实手机邮箱永远—；不存在PDF回退；旧会话内容不闪现；其他附件用例保持。

- [ ] Step 6: 自检实际diff和消费者，提交本Task明确文件；本文件末尾记录commit、定向结果、现场差异。禁止git add .纳入用户其他内容。

**完成条件：** 接口和断言成立，定向验证通过，无后端依赖新增。**停止条件：** 需要后端变更或改变批准产品语义时记录具体边界，不自行跨仓；普通实现错误继续修复，缺环境不写PASS。

### Task 5: 推荐有限匹配依据和公司/亮点展示

**依赖：** 无；只消费现有响应。

**预期编辑文件：**

- 修改：`src/数据/发现推荐映射.ts`
- 修改：`src/数据/发现推荐映射.test.ts`
- 修改：`src/数据/招聘候选摘要映射.ts`
- 修改：`src/数据/招聘候选摘要映射.test.ts`
- 修改：`src/数据/企业端模拟数据.ts`
- 修改：`src/屏幕/匿名在线简历.tsx`
- 修改：`src/屏幕/匿名在线简历.test.tsx`
- 修改：`src/组件/在谈详情/在线简历正文.tsx`
- 修改：`src/组件/在谈详情/在线简历正文.test.tsx`
- 修改：`src/组件/列表卡片/招聘推荐卡.tsx`
- 修改：`src/组件/列表卡片/招聘推荐卡.test.tsx`
- 新增：`src/数据/招聘匹配依据映射.ts`
- 新增：`src/数据/招聘匹配依据映射.test.ts`
- 新增：`src/组件/招聘匹配依据.tsx`
- 新增：`src/组件/招聘匹配依据.test.tsx`
- 删除：无整文件删除。

**目标与接口：** 产出共同契约C六行只读展示，不新增wire match_analysis、不保存快照、不按当前资料或总分推算。现有分数作为唯一顶栏总分。

**非目标：** 不改变批准Spec，不添加后端工作、迁移兼容或新wire字段。

- [ ] Step 1: 表驱动测试四类正向码、技能有命中但不知全匹配、薪资overlap/near_miss/unknown、经验未确认、原因缺席、重复/未知码；明确missing!=unmatched。
- [ ] Step 2: 实现局部映射与纯展示组件：缺码未提供判定，明确unknown未核对，技能有技能命中，部分薪资部分匹配；附“当前接口仅提供部分匹配依据”，不显示各项得分。不要扩共享旧亮点文案导致求职/助手页面改行为。
- [ ] Step 3: 仅在招聘推荐详情接新组件，合并独立推荐依据与空分析区；Case正文及求职匹配保持原行为。Mock同布局及有限信息模型，不重写原排名，不让Mock虚构判定冒充Backend能力。
- [ ] Step 4: 个人亮点空为暂无可展示亮点，有值原样；company/title正常拼接，null只职位，无公司不从历史/正文补。新hidden=false资料正常展示和旧true仍空均属前端诚实接线。
- [ ] Step 5: 按下列定向命令先验证新增反例失败、实现后通过；与本改动无关的失败如实记录并定位，不删除独立断言掩盖问题。

```bash
npm test -- src/数据/招聘匹配依据映射.test.ts src/组件/招聘匹配依据.test.tsx src/数据/发现推荐映射.test.ts src/数据/招聘候选摘要映射.test.ts src/屏幕/匿名在线简历.test.tsx src/组件/在谈详情/在线简历正文.test.tsx src/组件/列表卡片/招聘推荐卡.test.tsx
npm run typecheck
```

**关键断言/失败反例：** 唯一分析标题/总分；50/55只原样显示不拆分；缺原因无不匹配叉；标签不混原因；公司null不恢复。

- [ ] Step 6: 自检实际diff和消费者，提交本Task明确文件；本文件末尾记录commit、定向结果、现场差异。禁止git add .纳入用户其他内容。

**完成条件：** 接口和断言成立，定向验证通过，无后端依赖新增。**停止条件：** 需要后端变更或改变批准产品语义时记录具体边界，不自行跨仓；普通实现错误继续修复，缺环境不写PASS。

### Task 6: 前端浏览器接线及Mock视觉

**依赖：** Task1–5；所有fixture仍为既有wire。

**预期编辑文件：**

- 修改：`e2e/fixtures/bff/真人消息.ts`
- 修改：`e2e/fixtures/bff/MatchCase.ts`
- 修改：`e2e/fixtures/bff/发现推荐.ts`
- 修改：`e2e/fixtures/bff/隐私与实名.ts`
- 修改：`e2e/fixtures/bff/账号与目录.ts`
- 修改：`e2e/fixtures/bff/招聘组织.ts`
- 修改：`e2e/suites/真人消息.spec.ts`
- 修改：`e2e/suites/发现推荐.spec.ts`
- 修改：`e2e/suites/隐私与实名.spec.ts`
- 修改：`e2e/suites/简历与附件.spec.ts`
- 修改：`e2e/视觉回归/场景.ts`
- 修改：`e2e/视觉回归/场景.test.ts`
- 修改：`docs/testing/cases.md`
- 删除：无整文件删除。

**目标与接口：** 现有离线HTTP边界显式声明新增补读请求；fixture不加counterpart/match_analysis，不能证明服务端权限。

**非目标：** 不改变批准Spec，不添加后端工作、迁移兼容或新wire字段。

- [ ] Step 1: 在既有域fixture添加Case identity/frozen job/现有岗位与公开企业响应和头像成功/失败样本；新建经历接收hidden=false，已有true保持，拒绝API形状被悄悄改变。
- [ ] Step 2: 以“聊天推荐前端修复”为用例前缀添加双端列表/页头/搜索、补读失败、两侧32px/坏图首字、纸身零PDF、屏蔽跨页及部分保存失败、唯一六维有限展示。场景按独立失败拆分，不造全功能超级用例。
- [ ] Step 3: 在视觉场景表追加前缀chat-recommend-frontend的两端列表/聊天/招聘纸身场景，复用原采集runner；同步场景.test.ts的精确ID清单及数量断言，保留唯一性校验；截图检查长公司岗位截断、窄屏、气泡对齐、图与首字同尺寸。
- [ ] Step 4: 更新测试清单并校验；本Task是实际浏览器接线交付，不包含异构review/final gate。
- [ ] Step 5: 按下列定向命令先验证新增反例失败、实现后通过；与本改动无关的失败如实记录并定位，不删除独立断言掩盖问题。

```bash
npm run test:e2e -- e2e/suites/真人消息.spec.ts e2e/suites/发现推荐.spec.ts e2e/suites/隐私与实名.spec.ts e2e/suites/简历与附件.spec.ts --project=fixture --grep 聊天推荐前端修复
npm test -- e2e/视觉回归/场景.test.ts
npm run ui:capture -- --grep chat-recommend-frontend
npm run test:list -- --write
npm run test:list -- --check
npm run build
```

**关键断言/失败反例：** 接口补读均声明、无新字段；几何实测双方32px；取消隐私编辑零写；Mock同版式；没有声称真实后端权限或生成器通过。

- [ ] Step 6: 自检实际diff和消费者，提交本Task明确文件；本文件末尾记录commit、定向结果、现场差异。禁止git add .纳入用户其他内容。

**完成条件：** 接口和断言成立，定向验证通过，无后端依赖新增。**停止条件：** 需要后端变更或改变批准产品语义时记录具体边界，不自行跨仓；普通实现错误继续修复，缺环境不写PASS。

## 实施后收尾（不计入 Task count）

1. 全部Task及执行skill要求的宿主内全局review完成后退出Task循环。同一实施者调用异构review-loop：Codex→Claude，Claude Code→Codex，冻结批准Spec及前端候选diff；reviewer不跑测试，轮间仅修复相关轻量验证。不得回到Task/global review或追加finishing默认流程。
2. 完整diff核对受影响前端测试：本Plan全部Task定向Vitest去重集合（含Task6场景.test.ts）＋新增实际消费者、typecheck/build、Task6浏览器/视觉、清单。没有tools/test affected；不能执行后端命令。复用仍有效结果，仅补缺口，关联失败修好后再展示final gate。
3. 读取development-workflow的 references/final-integration.md 与 assets/final-integration-contract.md。确认前只读fetch，不合target、不正式L3、不push；展示前端candidate commit、target观察SHA、测试选择/证据、缺口、拟执行动作，等用户明确批准。
4. 确认后在原工作区同步前端target，记录final_target_base、重算完整责任，复用有效PASS仅补缺口；仅执行明确获批且前置成立的前端真实验收，cleanup后再对账；核对target未推进后普通fast-forward push，不force push。后端repo始终不操作。
5. 报告真实证据和未验证边界。部署/清库/后端联调不因Plan批准而自动授权。不生成独立handoff/review报告。

## 文档审查记录

模式 WORKFLOW_DOCUMENT_REVIEW；scope仅本Plan与Spec Revision2，批准revision/blob见header；原跨仓库review不适用。

Round 1：Claude Opus/high/plan，session `b978bd42-d87a-4e7d-86d3-1a5c8a9f7714`，候选 `3ae9899c`；工作树/HEAD/指纹guard通过，未跑测试、未改文件。

|Finding|必要性/复杂度|裁决|
|---|---|---|
|R1-1 经历折叠卡隐身徽标仍消费hidden|required/不变|核实工作经历.tsx现有条件，接受；契约B/Task1明确按真实有效屏蔽显示，未提交意图单列待保存，旧hidden不得冒充已隐身|
|R1-2 新增视觉场景遗漏场景清单单测|required/不变|核实场景.test.ts精确18个ID断言，接受；Task6补文件/断言更新/定向命令，最终集合包含该单测|

修订提交 `e4c9cd4e` 不改变批准Spec。Round 2：同一 Claude Opus/high/plan session 复审候选 `e4c9cd4e`，确认两条修复成立，结论 `NO FINDINGS`；工作树/HEAD/指纹guard通过。两轮合计2条required Important，全部接受并修订，无遗留required、无拒绝或延期项。reviewer未运行测试、未修改文件；本规划不声明产品测试PASS。

## 实施记录

当前Task1–6均未执行，无业务代码改动、后端改动、清库或部署。执行时在此逐Task追加实际基线、commit、验证命令/结果/证据、消费者文件调整及真实验收缺口；不得把本规划的文档校验写成产品PASS。

### Task 1 执行记录（2026-09-17）

- **现场基线：** 分支 `fix/chat-recommend-display`，基于 6ed6a984（研究基线 bb6ff6e0 以来 src/e2e/package.json 零漂移）。
- **Commits：** `8326efe1`（契约B 接线 + hidden=false 默认）、`9f2d7a22`（review fix-1：遗留缺组织行写前守卫）。
- **定向结果：** `npm test -- src/屏幕/工作经历.行业与企业.test.tsx src/屏幕/工作经历.资料与预填.test.tsx src/流程/候选Onboarding简历预填.test.ts src/数据/后端映射.test.ts src/状态/后端/隐私操作.test.ts` → 5 files / 279 passed；`npm run typecheck` 零错误。（全量单测为 implementer 额外自查：256 files / 5867 passed，非本 Task 要求入口。）
- **TDD：** 反例先 RED（契约B 开关/徽标/保存链 13 例、重读隐私 3 例、物化隐藏默认关、拉黑组织编号、守卫混合场景等共 21 项新增断言），实现后全绿。
- **现场差异（超出「预期编辑文件」的增补，含因果）：**
  - `src/状态/后端/类型.ts`：`隐私操作` interface 宿主，契约B「先读取权威隐私」入口 `重读隐私()` 须落在此接口。
  - `src/屏幕/工作经历.测试辅助.tsx`：组件新读 `状态.屏蔽名单/设置开关`，共用该桩的测试文件缺默认值会 TypeError。
  - `src/状态/应用状态.会话.test.ts`：冻结「应用操作公开 shape」清单需登记 `重读隐私`。
- **Review：** 宿主内 spec（opus）+ quality（sonnet）双档；Important#1（混合场景隐私写先于简历校验）经 fix round 1 修复并由 scoped re-review 核实 ADDRESSED。递延 minor 见会话 ledger（引导文案三处复制、Mock 双去重键等，均不阻塞）。
- **环境备注：** worktree 无 node_modules，按本分支 lockfile `npm ci` 安装（lockfile/package.json 零改动）。

### Task 2 执行记录（2026-09-17）

- **现场基线：** 分支 `fix/chat-recommend-display`，基于 cb0e6f34（Task 1 收口后 HEAD）。
- **Commits：** `75547327`（契约A + 编排 hook + 单飞等待边界修复 + 三行版式，20 文件）。
- **定向结果：** `npm test -- src/屏幕/消息列表展示/会话资料映射.test.ts src/屏幕/消息列表展示/消息行映射.test.ts src/屏幕/消息列表展示/消息列表展示.test.tsx src/屏幕/P7/use会话列表资料.test.tsx src/屏幕/P7/Backend会话列表.test.tsx src/屏幕/P7/use真人会话资料.test.tsx src/状态/后端/MatchCase操作.test.ts src/状态/后端/发现推荐操作.test.ts src/状态/后端/组织操作.test.ts` → 9 files / 451 passed；`npm run typecheck` 零错误；oxlint 改动目录零告警。消费者回归（消息列表/企业消息/Backend真人会话/会话操作/应用状态.会话/企业详情/企业代理设置/职位详情/规则库/组织/HTTP招聘数据源/发现推荐）12 files / 481 passed。
- **TDD：** 反例先 RED（两新文件 import 失败 + 既有 7 文件 27 失败，含「读锁让路立即兑现」「迟到 401 清新会话」「资料缺名/失败文案」反例），实现后全绿。
- **现场差异（清单内未改动的 2 项，含因果）：** `src/屏幕/消息列表.tsx`、`src/屏幕/企业消息.tsx` 无需编辑 —— Mock 行经共享 消息列表展示 自动获得三行版式，副标题语义由既有 fixture 承担；两文件是 Backend/Mock 分发连接层，本轮无新接线。无清单外增补文件。
- **实现要点：** 契约A 纯映射（会话资料映射.ts）列表与详情同源；use会话列表资料 编排（available-only / role+case 去重 / ≤4 并发 / 岗位·企业本轮去重 / 翻页追加 / 失败定向重试 / 轮键=主体:role 隔离迟到回执）；操作层三方法同 key 复用真实在飞 Promise（读取详情、读取候选岗位详情）与 读取公开企业 会话栅栏+同 id 在飞表；Backend会话列表 行/搜索同源消费资料并出「部分会话资料暂不可用」重试提示。替换旧断言：招聘 detail 副标题改「投递企业 · 投递岗位」、`对方首字` 缺名回退「·」（旧「招」）、disclosed 缺名有图仍显示图（契约两字段独立）。
- **缺口备注：** jsdom 不证明三行版式/46px 图片头像几何（Task 6 浏览器/视觉验收）；招聘端 loading 窗口仍按既有语义显示 P7 viewer-safe 标签（含代号位），资料落地/失败后绝不显示代号 —— 如需加载窗口也匿名属产品语义变更，未自行更改。
- **Fix round 1（quality review，spec review 无 finding）：** Commits `9f17c061`（+本 docs 提交记录）。Important#1 重试无差别 `链.岗位/企业.clear()` 会把其他成功行的发布企业名当帧抹成 null（memo 随轮变化重算）→ 改为只定向摘除「失败」结算坐标，成功坐标保留零重读；Important#2 调度空位只数已提交 state，StrictMode 双执行可放行至 8 个在飞 → `轮链` 增 `在飞Case`（ref 侧真相）计数，完成删除带轮键守卫。两条各补 RED→GREEN 反例（「重试不抹其他成功行企业名」`expected null to be '星桥乙'`；「StrictMode 双执行不突破 ≤4」`called 8 times ≠ 4`）。optional minors 顺手落：`非空` 从 会话资料映射 导出复用（三处）、不可达守卫注释收窄为实际行为。定向 9 文件 453 passed（+2）、typecheck/oxlint 零错误、消费者回归（消息列表/企业消息/Backend真人会话）34 passed。初版执行记录顾虑#3 表述已更正（原「多一笔读」未披露用户可见回退，缺陷即 Important#1）。

### Task 3 执行记录（2026-09-17）

- **现场基线：** 分支 `fix/chat-recommend-display`，基于 0aae1295（Task 2 fix round 1 收口后 HEAD）。
- **Commits：** `a417e11c`（32px 真人消息头像 + 我方账号照片 + 镜像净空调整，5 文件 +288/−32）。
- **定向结果：** `npm test -- src/屏幕/P7/Backend真人会话.test.tsx src/屏幕/直聊会话.test.tsx src/屏幕/真人会话.test.tsx src/屏幕/企业真人会话.test.tsx` → 4 files / 53 passed；`npm run typecheck` 零错误；`npm run lint`（oxlint）零告警。消费者回归（Backend会话列表/use会话列表资料/use真人会话资料/会话资料映射/消息列表展示/消息行映射/聊天气泡/问AI代理·对话展示）8 files / 120 passed。
- **TDD：** 反例先 RED —— 新增 10 例中 8 例失败（候选直达读本人图 `expected null to be truthy`；招聘档案图+revision `expected undefined to be '…?v=5'`；双方坏图各回退各自首字；有图无名坏图回退「·」不取回退标题首字；新 URL 重试；删图/换账号旧图与失败态清理；直聊 32px 源码合同 `expected 'width: 26px…' to contain 'width: 32px'`；真人会话 对侧留白 41px 源码合同），既有 36 例全绿；实现后 53/53 全绿。两条回归锁（缺图缺名「·」、Mock 字标无演示人像）实现前已绿，如实记录。
- **现场差异（清单内未改动的 3 项，含因果）：** `src/屏幕/直聊会话.tsx`、`src/屏幕/真人会话.tsx`、`src/屏幕/企业真人会话.tsx` 无需编辑 —— Step 4 对 Mock 的要求是「同步回退与尺寸」：尺寸/去偏移/镜像净空全部落在共用 直聊会话.module.css（三屏与 Backend 同一类，改动自动同步）；Mock 无授权图源，字标回退即同规则，消息条的 首字/对方首字 由既有 fixture 真名承担，无 tsx 可改。图片渲染与回退唯一消费者是 Backend真人会话，新 消息头像 组件私有于该文件（镜像既有 消息列表展示 私有 图片头像 模式），不预抽象到共享件（无第二消费者）。无清单外增补文件。
- **实现要点：** 我方按角色读既有资料（候选 = `状态.求职头像`，commit 时已带 `?v=revision`；招聘 = `招聘方档案.avatar_url` + 当前 revision 组同样缓存戳，`非空` 收口），mount 水合与入口无关故直达会话可用，零新读取；双方头像统一走 `消息头像`（URL key 重挂：换图重试、删图/换账号/换会话不残留旧图与失败态）；首字统一契约A `取姓名首字`（我方原 `.charAt(0)` 不拆代理对，一并修正）；对方资料继续消费 Task 2 `use真人会话资料`。CSS：`.我头像` 26px/13px 圆角方/2px 下移 → 32px/50% 圆（字号 11.5→13 与对方一致）、`.我气泡` 75→81、`.时间戳带头像` 34→40、Backend `.对方消息行 .对侧留白` 35→41（两侧对称 41）。共享类消费者核查：直聊会话/真人会话/企业真人会话/Backend真人会话 四处皆真人聊天；AI 专用头像（问AI代理·对话展示.module.css、助手会话）与列表 46px 容器各自独立模块，零触碰。
- **缺口备注：** jsdom 不证明 32px 几何与长消息换行版式 —— 按规划由 Task 6 浏览器/视觉验收证明（CSS 源码合同只锁「26px 尺寸退役 + 32px 在场 + 净空数值」，不替代版式验证）；我方候选头像来源 `状态.求职头像` 的账号隔离沿用既有 清账号资料/清后端组织状态 清理（本次未改 reducer）。

### Task 4 执行记录（2026-09-17）

- **现场基线：** 分支 `fix/chat-recommend-display`，基于 3a146cab（Task 3 收口后 HEAD）。
- **Commits：** `1ee77e14`（招聘聊天在线简历纸身：真人在线简历正文 提取 + 两端接线 + 该入口 PDF 租约删除，9 文件 +713/−191）。
- **定向结果：** brief 定向命令 `npm test -- src/组件/真人在线简历正文.test.tsx src/组件/简历预览层.test.tsx src/屏幕/P7/Backend真人会话.test.tsx src/屏幕/企业真人会话.test.tsx` → 4 files / 56 passed；`npm run typecheck` 零错误；`npm run lint`（oxlint）零告警。消费者回归：真人会话操作栏/原始PDF层/use真人会话资料/真人会话/直聊会话 5 files 53 passed、在谈详情 14 passed、候选详情 20 passed、详情控制 4 files 113 passed、P7 目录 4 files 93 passed。
- **TDD：** 反例先 RED —— 新增/改写 12 例失败 + 新组件文件 import 失败（组件不存在；「看在线简历」按钮缺席；纸身字段/「手机：—」缺席；Mock 原件联系方式 `138 0217 6021` 仍被旧纸身渲染；企业真人会话 源码合同仍 import 简历预览层；Backend 源码合同仍含 读取简历PDF；失权/换会话改写例断言新行为），既有 36 例全绿；实现后 56/56 全绿。
- **实现要点：** 新组件 `真人在线简历正文`（纯展示：props 姓名/最近职位/经验年限/工作经历/教育经历/个人优势，不读应用状态不请求数据；联系方式恒「—」且组件无联系方式输入；区段 null=暂未提供、[]=暂无、优势空白串=暂无；公司槽缺省只省公司名不从描述反推；日期右对齐）。Backend 映射（Backend真人会话 私有 纯函数）：同 Case `candidateIdentity`（disclosed 真名 → 回落 Case 代号，与页头同口径）+ `candidateResume`（既有 wire 七键；`candidate_resume=null` 各区段暂未提供；最近职位=summary.latest_experience.title 回落 experiences[0]；年限=summary.experience_years）；层内三态（读取中/暂不可用+定向重试=重读资料/纸身）由 `use真人会话资料.资料状态` 驱动；`招聘可看简历` 收窄为「授权在场」，不再以 resume_ref 为打开前提。Mock 映射（企业真人会话 私有）：候选专属原件投影 → 同一纸身，投影手机/邮箱不进映射。该入口 PDF 租约代码整块删除（PDF预览/失败/租约引用/在飞/代际/回收/失效/开PDF/主项打开/主项关闭/失权 effect），失权与换会话关层由操作栏既有授权 key 重挂承担；主项名改「看在线简历」（Backend+Mock）。简历预览层 仅注释 + CSS（`.区段空` 新类、`.经历时间` 加 `margin-left:auto` 使公司/学校槽缺省时日期仍右贴，有槽时行为不变），PDF 附件原件层及其纸身原样保留（在谈详情/候选详情 零触碰）。
- **接口偏差（onClose，如实记录）：** brief 接口清单含 `onClose`、Step 3 布局含「继续沟通」；实现把「底部继续沟通」落在 真人会话操作栏 层壳的既有固定底栏（它是唯一能真正关闭该层的路径 —— 层壳不向消费者暴露关闭命令，纸身自带按钮既无法生效又会与层壳按钮重名导致 getByRole 多匹配、破坏既有独立断言）。故纸身组件未带 `onClose`（纯展示提取口径：关闭属层壳交互非展示），如裁定必须落在纸身上需连带决定层壳去重方案。
- **删除的既有测试（行为已随功能移除，非掩盖）：** review-r1 F1 迟到租约回收、F7 卸载迟到租约、R2-4 换会话在飞取件 —— 三例的主语（PDF 租约生命周期）在本入口已不存在，各改写/新增等价保障（换会话/失权/卸载后旧纸身不闪现、零 PDF 请求源码合同）。
- **缺口备注：** jsdom 不证明纸身版式几何（日期右贴有 CSS 源码合同锁数值，视觉归 Task 6）；真人在线简历正文 与 在谈详情/在线简历正文 家族的合并归 Task 5（本轮按规划只提取聊天两消费者所需部分，不动其他简历页面）。

### Task 5 执行记录（2026-09-17）

- **现场基线：** 分支 `fix/chat-recommend-display`，基于 713d5b8d（Task 4 收口后 HEAD）。
- **Commits：** `f6768171`（契约C 六行映射 + 唯一匹配度分析 + Mock 同布局 + 亮点/公司诚实展示，16 文件 +698/−135）。
- **定向结果：** brief 定向命令 `npm test -- src/数据/招聘匹配依据映射.test.ts src/组件/招聘匹配依据.test.tsx src/数据/发现推荐映射.test.ts src/数据/招聘候选摘要映射.test.ts src/屏幕/匿名在线简历.test.tsx src/组件/在谈详情/在线简历正文.test.tsx src/组件/列表卡片/招聘推荐卡.test.tsx` → 7 files / 208 passed；`npm run typecheck` 零错误；`npm run lint`（oxlint）零告警。消费者回归（候选推荐/在线简历正文映射/候选信息主体/候选详情/在谈详情/详情控制四件/企业真人会话/Backend真人会话/简历预览层/真人在线简历正文/企业在谈候选/P5 MatchCase列表/职位详情/职位详情展示/视觉场景）15 files / 378 passed；implementer 额外全量自查 261 files / 5972 passed（非本 Task 要求入口）。
- **TDD：** 反例先 RED —— 新增 招聘匹配依据映射.test（表驱动：四正向码/技能 some_skills/薪资三态/经验未确认/原因缺席/重复与未知码/矛盾七组/disjoint/missing≠unmatched）+ 招聘匹配依据.test.tsx（六行布局/记号/无逐项分值）两文件 import 失败，改写 在线简历正文.test DF-011 段与 匿名在线简历.test DF-011 段共 8 例失败（六行文案缺席；Mock 用例旧版式仍渲染『Go 主栈』对齐卡），招聘推荐卡.test 新增 2 例失败（『暂无可展示亮点』缺席）；实现后 208/208 全绿。
- **现场差异（超出「预期编辑文件」的增补/未改，含因果）：**
  - 增补 `src/组件/在谈详情/类型.ts`：在线简历正文属性 是 推荐依据→匹配依据行们 prop 合同的唯一宿主（单一消费者）。
  - 增补 `src/组件/列表卡片/候选信息主体.tsx(+test)`：亮点空行渲染器在共享主体内；加可选 `亮点空文案`（默认『亮点信息未知』逐字不变），仅 招聘推荐卡 传『暂无可展示亮点』，在谈卡与全部既有断言零改动。
  - 增补 `src/数据/在线简历正文映射.test.ts`：Mock 档夹具补新增必填 推荐依据 字段（形状与 wire 三键一致）。
  - 增补 `src/屏幕/候选推荐.test.tsx`：3 处推荐卡亮点空占位断言按批准 Spec §6 由『亮点信息未知』改『暂无可展示亮点』（其中一例恰是 personal_highlights=[] 合法空）。
  - 清单内未改动 `src/数据/发现推荐映射.ts(+test)`：映射推荐依据 仍被求职端 准备职位正文 消费（求职匹配保持原行为），亮点/匹配分投影零改动，定向命令按回归跑绿。
  - 清单内未改动 `src/数据/招聘候选摘要映射.ts(+test)`：Step 4 的 company·职位 拼接、null 只职位、亮点原样/合法空语义已由既有实现与测试覆盖，本轮仅复核无缺口。
- **实现要点：** 契约C 映射纯函数（说明与 亮点文案/薪资关系文案 同源闭表）；在线简历正文 匹配依据行们 传入即唯一『匹配度分析』+六行+统一说明，未传保持对齐卡/缺失块（Case 与求职端零变化）；Backend 详情从同 scope 权威卡 wire 三键 useMemo 落六行，顶栏 匹配 N 仍是唯一总分；Mock 详情 档.推荐依据（11 档 wire 同形三键演示事实）经同一 映射招聘匹配依据 落六行，退役 JD 逐项对齐卡（薪资初筛结论/原始评分/推荐排名不动）。
- **缺口备注：** e2e `发现推荐.spec.ts` 463-466/622-651（暂无逐条匹配证据/暂无推荐依据）与 `展示与交互.spec.ts` ~1443（Backend 推荐卡 亮点信息未知）断言被本任务按批准语义变更淘汰 —— 前者在 Task 6 编辑清单内随接线更新，后者不在任何 Task 清单，记录为 final gap；视觉场景 recruiter-home-candidate 的『匹配度分析』文本锚点仍唯一有效，像素基线变化归 Task 6 重采集。六行版式几何（一致条/期望副行 复用类）jsdom 不证明，归 Task 6。
