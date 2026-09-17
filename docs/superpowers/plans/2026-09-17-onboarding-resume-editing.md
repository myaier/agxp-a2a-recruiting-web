# Onboarding 与简历编辑修正：零上下文实施 Plan

> **For agentic workers:** 必须实际调用对应 execution skill：Claude Code 使用 `superpowers:subagent-driven-development`；Codex 使用 `superpowers:executing-plans`。按编号 Task 执行，步骤以 checkbox 跟踪；全部 Task 后进入唯一的不计数收尾，不在本规划会话实施。

**Goal:** 统一候选建档的资料/意向职责，修正招聘建档入口与三级分类，完成简历按区编辑、可靠保存返回和真实状态编辑，并同步 Mock/测试/活动验收指南。

**Architecture:** 复用现有 React 页面、数据源操作、薪资层和目录钩子；引入仅供本次消费者使用的日常编辑来源/返回 helper、受控个人优势和状态正文。业务保存仍归现有简历/隐私/意向操作，不增加 schema、状态库、通用编辑事务或路由框架。

**Tech Stack:** React 19、TypeScript、React Router 7、Vite、Vitest/Testing Library、Playwright；依赖版本以当前 lockfile 为准，不升级依赖。

**Spec:** `docs/superpowers/specs/2026-09-17-onboarding-resume-editing-design.md`，批准正文 revision `ad781149019d1197b0211d7fdebd9d329e2a417b`，blob `19f720e212db569eba5c354cecb67fb7b493a766`。用户在认可 v1.0 并指定先行分支后，于本会话明确要求继续 Plan、Claude review 与执行提示词，作为 v1.1（含 §11）的实施范围授权。不得用未来工作树同名文件替代批准版本。

**版本与阶段:** Plan v1.2，已完成两轮 Claude 文档 review，R2 为 NO FINDINGS。当前可完成规划和 review；**尚未满足产品实施依赖**。用户要求现在继续规划，故先冻结行为/接口和依赖核验规则；Spec §11.3 要求的最终已合入代码基线仍须在执行前取得。本文件不是对 `fix/chat-recommend-display` 当前进行中实现的验收。

**计划本身复杂度：高。** 涉及共享经历保存链、onboarding 分区确认与首次意向防重、浏览器历史栈及两数据源一致性。

**零上下文漂移风险：高。** 先行分支仍在变化，经历隐私与简历保存非原子，需现场核对已合入版本和失败恢复。执行模型只按该风险选择，使用当前可用的行业顶尖模型；不因 Plan 篇幅缩短而降档。

## Global Constraints

1. 完整读取 `CLAUDE.md`、`AGENTS.md`；中文输出/文档，保持代码既有命名约定。遵守批准 Spec §1–11，不重写聊天、推荐、公司管理或后端。
2. 当前工作区为用户选定的 `.`；复用，不自动创建第二工作区，不 stash/reset/clean、不覆盖其他工作。最终 target 为 `origin/main`，用户指定先行分支先合入、本分支后合入；未经 final gate 不同步合入 target、不正式 L3、不 push。
3. 外部技能按逻辑名发现，先解析符号链接的真实根，再读取相对 resources/assets/scripts。共享 review 合同为 review skill 根相对 `../_shared/review-contract.md`。技能缺失则报告具体阻塞，不降级工作流。
4. 开工前使用 development-workflow 的 `scripts/task_intents.py start --summary 'onboarding and resume editing' --target origin/main --path src/屏幕/工作经历.tsx --path src/流程 --path e2e` 登记；实际 CLI 路径从 skill 根解析。随后 list，按全部预期编辑路径补 update；扩大路径/合同先 update，不改他人记录。预告不等于准入或无冲突证明。
5. Backend 不回退 Mock，目录引用只用真实 ID；不改 wire 字段、权限、revision、请求幂等、首次意向唯一性。日常编辑不写 onboarding 草稿、分区确认、到岗预填、首次意向或完成接口。
6. 先行分支企业屏蔽合同完整承接：新经历 hidden=false、旧值原样；开关走 organization-blocks；保留 derived/manual 判定、风险确认、写前校验、权威重读与 partial failure。换公司/删经历不隐式解屏蔽。
7. UI 复用现有壳/条目/按钮/字体间距；Mock/Backend 同流程同 DOM 结构，差别仅适配数据。取消未保存编辑不污染全局已保存事实；已有成功写入不能伪回滚。
8. 产品行为/公共签名/持久化兼容/验证义务发生实质改变，停止相关 Task、说明差异并修订批准契约；等价内部组织调整只在本 Plan 执行记录说明，不顺便重构。
9. 定向 TDD，先确认失败来自目标行为再实现。测试入口遵循 `docs/testing/README.md`；不删除断言、抬超时、关闭离线边界或反复重试凑绿。不为文档规划运行产品套件。
10. 只新增一个 Spec、一个 Plan、一个双宿主 prompt；不新建 handoff/review-report/manifest。执行记录、finding 裁决与最终证据摘要追加本 Plan；原始日志落既有 `test-results/`、视觉与 `dogfood-output/`，注意 Playwright 会清空 test-results，跨命令证据先保存到会话临时目录再归档。

## 开工依赖门与基线

规划源码基线 `acfdab7e2cec95609eb82d0dc4ff5a82dc94da04`；Spec 调查记录的先行已提交快照 `ccaf70106f4148765001da0921c4f2533f996bfa`，包含经历修复 `8326efe1` 与校验修复 `9f2d7a22`。它们不是对方最终合入证明；其未提交 Task 6 测试也不能当依赖交付。

执行者在任何产品编辑前只读核验：

```bash
git status --short
git rev-parse HEAD
git fetch origin
git log -12 --oneline origin/main
git log -12 --oneline fix/chat-recommend-display
```

取得对方最终合入记录（精确最终功能 SHA、目标合入 SHA及其实际 review/验收记录），在本 Plan 执行记录登记 `predecessor_final`、`dependency_target_commit`、`execution_base`。以 `git merge-base --is-ancestor` 证明先行版本已进入 target 和当前 `HEAD`；若使用 squash，必须核对最终合入 diff 和 §11 逐项合同，不能仅靠分支名/祖先检查。分支名在迁移机器不存在时，用携带的精确 Git 对象/合入记录核验，不猜另一个分支。

**依赖未进入所选工作区：停止产品实施，报告 DEPENDENCY_BLOCKED。** 不合并工作中的对方分支、不偷跑独立 Task、不在 final gate 前同步 target。用户可在先行分支完成后手动选定已经包含依赖、并携带批准文档 Git 对象的工作区重新启动同一 prompt；执行者仍只复用 `.`。本次交付不把“规划完成”写成“实施已就绪”。如果实际先行最终行为与 §11 不同，列出具体差异并停止受影响实施，不自行扩大产品设计。

### 依赖门的具体解锁步骤（不授权实施者提前合 target）

上述门是外部依赖前置，不是让当前旧基线无限等待 final gate。先行分支完成合入后，用户在**启动本 prompt 之前**可选择已经包含该合入的工作区；若继续使用当前规划分支，则由用户在该工作区手动完成下面的普通基线更新。此手动准备属于用户对本工作区的直接操作，不在实施 prompt 授权中，实施 Agent 不代为执行或绕过 final gate：

```bash
git status --short
git fetch origin
git log -12 --oneline origin/main
git merge --no-edit origin/main
```

运行 merge 的前提是已经从先行分支最终记录核对其确实合入 origin/main，且当前工作区无待保护的未提交内容；有冲突则人工处理并提交，不用 ours/theirs 整文件覆盖，不 stash/reset/clean。记录 merge 前后 SHA，再启动 prompt。执行者仍须核验批准 Spec/Plan 的精确 Git 对象、工作树正文及最终依赖合同。用户不做该准备时保持 DEPENDENCY_BLOCKED，不为解除前置去扩大执行授权。此处只具体化 Spec §11 的工作区前置，不改变实施 session 的 final gate 顺序。

### 先行最终测试责任登记

开工门通过时，从先行最终合入 diff 登记与 Spec §11.2 对应的**测试文件、完整 Case 名、project、保护行为**，写入本 Plan 实施记录，并与本文列出的已知消费者取并集。已知单元文件至少包含 `src/屏幕/工作经历.行业与企业.test.tsx`、`src/屏幕/工作经历.资料与预填.test.tsx`、`src/状态/后端/隐私操作.test.ts`、`src/数据/后端映射.test.ts`、`src/流程/候选Onboarding简历预填.test.ts`；浏览器是先行最终实际的经历屏蔽、partial failure、hidden 保留 Case，不能用规划时观察的标题猜测替代。

先用 `npm run test:list` 取得实际完整清单，再对登记后的每条最终命令运行相同选择器的 `--list`；逐条对账每个登记 Case 被选择、没有重名歧义、没有0条。若 Case 已重命名，更新选择器和命令记录；若被删除，查明承接断言，不静默豁免。该登记是依赖交付核验，不为此新建报告/runner。

## Task index

Task count: 5
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

五个 Task 串行。即使 Task 4 独立，也不为并行增加协调成本；Claude 按 skill 为各 Task 派发执行者并做 spec/code-quality 两阶段审查，Codex 按 executing-plans 连续执行。编号仅计实现/验证交付，异构 review、affected 和 final gate 均在不计数收尾。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|日常来源、返回、基本信息与状态；依赖开工门|前沿 / 顶级模型（Claude Code: opus）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|2|分区简历编辑、个人优势正文、企业屏蔽保存承接；依赖1|前沿 / 顶级模型（Claude Code: opus）|前沿 / 顶级模型（Claude Code: opus）|前沿 / 顶级模型（Claude Code: opus）|
|3|候选 onboarding 薪资/资料/偏好顺序与提交；依赖1、2|前沿 / 顶级模型（Claude Code: opus）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|4|招聘名片范围和类别自动展开；依赖开工门，顺序在3后|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|5|浏览器真实接线、Mock视觉、清单与活动指南；依赖1–4|前沿 / 顶级模型（Claude Code: opus）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|

Task 1–3 的前沿档位理由是历史栈、未保存草稿与多次非原子业务写入耦合；Task 4 复用已存在且有分页守卫的目录钩子，接口冻结后判断负担较低；Task 5 要核验两个分支的消费者与真实验收边界，不能仅更换文案断言。

## 冻结的跨 Task 合同

### A. 日常编辑 URL 与返回

仅增加页面局部参数，不增加应用路由：

|URL|含义|
|---|---|
|`/basic?from=resume`|基本信息日常编辑|
|根路径 `/` + `onboard/status?from=resume` / `?from=intentions`|相同三态编辑，分别回简历/意向管理|
|`/experience?from=resume&section=work&item=<encoded-id>`|已有工作条目，`item=new` 新增|
|`/experience?from=resume&section=education`|教育分区列表；带 item 为直接编辑/新增|
|`/experience?from=resume&section=skills`|专业技能|
|`/experience?from=resume&section=certificates`|证书分区列表；带 item 为指定证书或新增|
|`/wizard?from=resume`|个人优势独立编辑，沿用旧地址|

来源白名单是 resume/intentions，intentions 仅允许状态页使用；URL 中未知来源/section 不得触发写入。旧 `/experience?from=resume` 替换归一为 work 分区列表，保留合法来路，不继续展示所有分区。无 from 的 experience 仍为 onboarding 聚合页。诊断入口也按字段路由，不再所有缺项都指向聚合页。

新增 `src/流程/候选日常编辑.ts`，导出：

```ts
export type 候选编辑来源 = 'resume' | 'intentions';
export type 简历编辑分区 = 'work' | 'education' | 'skills' | 'certificates';
export function 读候选编辑来源(search: string): 候选编辑来源 | null;
export function 创建候选编辑来路(来源: 候选编辑来源): unknown;
export function use候选编辑退出(来源: 候选编辑来源): () => void;
```

`创建候选编辑来路` 由原列表点击时传给现有 `跳转(url, state)`，仅记录固定来源、当前 history idx 和模块本次页面会话标识；不得保存业务草稿/任意 return URL。`use候选编辑退出` 通过 `use导航` 调用现有 返回/替换跳转：仅在 state 会话标识为当前模块、来源匹配且当前 idx 等于来源 idx+1 时退一格；否则替换到来源对应的固定路径（路径表的我的简历/求职意向）。刷新新文档会话无来路证明，即使用安全替换。嵌套条目编辑采用同一页面本地子视图，不额外 push，所以不会需要通用多级退栈算法。

`候选Onboarding预填边界.tsx` 保留 `带简历编辑标记` 原有 resume 语义，另使用新的来源解析器让状态页 from=intentions 也不属于预填/活跃 onboarding；非法来源不得被当作合法日常保存。源页面同一次点击只 push 一格。普通浏览器后退不提交，无来路时应用返回按钮不退外站。

### B. 业务操作与草稿

继续调用 `操作.保存简历(next: 页面简历写入, 来源?: 简历保存来源): Promise<void>`、`保存个人优势(text: string, 来源?: 简历保存来源): Promise<void>` 和 `保存首次意向(input: 首次意向输入): Promise<void>`（类型来自现有数据源/状态文件）。日常传 `'日常编辑'`，onboarding 缺省。无 API 新方法、无新 wire 字段。

日常每个编辑实例初值取已水合快照，输入只进局部草稿；提交时用**本次 next 快照作为显式参数**进入完整保存链，不能 `setState(next)` 后立即调用仍闭包读取旧列表的保存函数。日常的逻辑提交范围是当前分区/条目：以当前已水合权威快照的 `从BFF简历` 页面形态为基底，只应用本次明确字段/条目变更（删除只移除明确目标），未编辑分区及其他条目原样带回、不可少传导致 DELETE。Mock 以已保存态同样合成。保存成功后操作层权威回读更新全局；Mock 只有保存成功路径 dispatch 已保存态。取消/失败不会 dispatch 未确认内容。背景权威刷新不覆盖正在编辑的局部输入。若本次目标已被后台删除，报已不可用，不将编辑变新增。真实 diff 操作仍由现有数据源生成、revision/幂等不变。

Task 2 提取 `src/组件/个人优势编辑正文.tsx`，无业务副作用，props 冻结为 `{文本:string; 修改:(值:string)=>void; 说明?:string; 恢复:(()=>void)|null; 恢复文案:string}`。组件含 textarea（aria-label 个人优势、maxLength=500）和计数/真实恢复按钮，不包含保存/路由或长按删除说明，供 Task 2 日常与 Task 3 聚合页使用。

Task 1 提取 `src/组件/求职状态编辑正文.tsx`，props 为 `{值:''|'在校'|'在职'|'离职'; 修改:(值:'在校'|'在职'|'离职')=>void}`；只绘制三态选择，保存/取消由页面承担。onboarding 继续使用已有到岗选项，不将那些文案映射成新的后端状态值。

### C. Onboarding 页面和持久化

`Onboarding流程` 两候选数组统一为：学生分流 → 基本信息 → 求职状态 → 最高学历 → 毕业院校 → 选专业 → 就读时间段 → 工作经历 → 引导问答 → 披露说明 → 添加头像 → 主壳。引导问答 onboarding 只有补充偏好，日常仍只有优势。旧 stage=salary 在判定日常模式之后才做替换重定向到学生分流，避免恶意/旧组合 query 把日常编辑带进注册。

首屏薪资使用 `引导预填.薪资` 既有结构；undefined=未确认，`{下限:0,上限:0,单位}`=明确面议。给 `存求职筛选偏好` 增加现有薪资字段的条件清除逻辑：有效周期变化即删除薪资属性；同周期不删，草稿其他字段、待写入槽不变。不加新持久化确认位。`启程引导` 继续合并已有对象，不能丢已确认薪资。

现有 `取个人优势预填(state, stage, current)` / `取可恢复个人优势建议(state, stage)` 的 stage 是旧页面职责，Task 3 移除该参数，改为 `(state,current)` / `(state)`；资格/确认/用户已有内容守卫原样保留，只有 onboarding 资料页调用，日常不调。不从 parser 的意向自由文本新增薪资自动识别。

聚合页继续既有简历保存链，该调用的 next.个人优势 保持进入保存前的已存值（本次待保存优势在局部/建档草稿），避免提前写入后再重复保存；成功后 `保存个人优势`，summary 成功才确认 summary。补充偏好提交只调 `保存首次意向`，读最新全局/建档数据；无有效首屏必需数据则替换回首屏补齐，不从空默认串提交。个人优势失败不确认、不前进；意向失败不重存个人优势。

## 测试选择五问

1. **失败与边界：** 页面接错、push 返回循环、取消污染全局、姓名空身份多步草稿丢失、隐私先写后校验、summary/首次意向重复、周期混用、目录父项冒充职位、Mock 与 Backend 分叉；覆盖页面/状态/请求与真实浏览器历史。
2. **最小反馈：** 每 Task 下方有具体 `npm test -- <files> --maxWorkers=4 --retry=0`；浏览器仅在 Task 5 跑明确 Suite 或新增用例前缀，先 `--list` 核对选择；不默认 npm test 全仓。
3. **何时提前验证真实边界：** 本轮不改 SQL/后端/schema；fixture 请求断言可证明前端 payload/次数，浏览器可证明 history。若先行实际接口与本文不符、现有操作无法满足幂等/局部保存，先最小只读核查并停止设计漂移，不能等最后才发现。正式 STG 按 workflow 留在获批 final gate 后，环境能力只读预检可提前。
4. **最终权威责任：** 静态检查、Task 1–5 受影响 Vitest 合集、Task 5 浏览器/视觉及清单完整对账；正式 STG 选择见收尾，不用 fixture 代替权限或真实持久化。发布仅在 gate 后普通 fast-forward push，不部署后端。
5. **证据和成本：** 现有 `docs/testing/README.md` 有历史计时，但本轮源码/先行最终基线尚未验证，不能继承旧 PASS。本轮耗时未知；不为规划测时启动大套件。受影响范围随最终 diff 重算，保留可以证明有效的证据，不无条件重复 broad gate。

### Task 1: 日常来源与返回、基本信息和真实状态

**目标与非目标：** 落地合同 A 的来路、Spec §5 基本信息和 §6 状态；修复日常输入提前 dispatch。暂不改变 onboarding 顺序（Task 3），不改经历编辑器。

**依赖与接口：** 开工依赖门已通过；产出合同 A helper 和合同 B 状态正文供 Task 2/3 使用。消费现有 路径、use导航、保存简历；内部字段仍为中文身份，wire 映射沿既有 student/employed/unemployed。

**预期编辑文件：**
- 新增：`src/流程/候选日常编辑.ts`、`src/流程/候选日常编辑.test.tsx`、`src/组件/求职状态编辑正文.tsx`、`src/组件/求职状态编辑正文.test.tsx`。
- 修改：`src/流程/候选Onboarding预填边界.tsx`、`src/流程/候选Onboarding预填边界.test.tsx`、`src/屏幕/我的简历.tsx`、`src/屏幕/我的简历.test.tsx`、`src/屏幕/基本信息.tsx`、`src/屏幕/基本信息.test.tsx`、`src/屏幕/求职状态.tsx`、`src/屏幕/求职状态.test.tsx`、`src/屏幕/求职意向管理.tsx`、`src/屏幕/求职意向管理.test.tsx`。
- 删除：无。

- [ ] Step 1: 补失败测试：姓名/工龄均进 basic，当前状态进 status；日常改名后取消 dispatch/保存调用均为0；三个状态、空状态及两个来源；from=intentions 不预填；旧 history 标识和越级 idx 使用安全替换。浏览器来路真实性的完整覆盖留 Task 5，不能把 mocked navigate 单测作为历史栈证据。
- [ ] Step 2: 运行下列命令确认目标断言失败（不是 import/config 错），保存输出；没有重现则先查原因，不写猜测性修复。
- [ ] Step 3: 实现来源 helper 和三态正文；姓名统一导航并删除专用改名输入/保存路径，修改状态文本只显示在校/在职/离职（空值未填写）。基本信息日常局部草稿，标题“编辑基本信息”，保留生日成对确认和起始年规则；onboarding 原派发暂保持。
- [ ] Step 4: 基本信息日常空身份保存时，在**同一挂载页面**切换到状态收口子视图（复用状态正文），保留局部基本草稿，不 push 新页或写全局。选择合法状态后点保存用合并后的基本信息一次进入保存简历；成功退出原编辑链，返回/取消退出整链不写。失败保持草稿；刷新丢弃未保存输入并读权威值（不承诺日常草稿持久化）。
- [ ] Step 5: 独立状态页日常模式只读 profile 三态，保存 single-flight，传日常编辑并正确退出；不派发到岗、不确认 basic。意向管理删除本地循环状态，Mock/Backend 共用当前 profile。不能修改意向类型/薪资或清空经历。
- [ ] Step 6: 回跑定向测试；自检 scope、可达性和取消事实；仅提交本 Task 文件（不 `git add .`），追加本 Plan 执行记录。

```bash
npm test -- src/流程/候选日常编辑.test.tsx src/流程/候选Onboarding预填边界.test.tsx src/组件/求职状态编辑正文.test.tsx src/屏幕/我的简历.test.tsx src/屏幕/基本信息.test.tsx src/屏幕/求职状态.test.tsx src/屏幕/求职意向管理.test.tsx --maxWorkers=4 --retry=0
```

**完成/停止：** 全部定向 PASS，两个来源读写同一状态，失败/取消无假保存；需要新后端状态或全局草稿平台则停止。Mock 日常不得继续 onChange 写已保存态。

### Task 2: 简历按区编辑并承接企业屏蔽保存链

**目标与非目标：** 落地 Spec §5 的条目直达/分区编辑和 §11 保存承接；提取个人优势正文。onboarding 聚合结构与原出口暂保持，Task 3 再移动优势。

**依赖与接口：** Task 1 helper 可用，先行最终工作经历保存链已核验。消费 A 的 section/item、B 的 next 快照与既有隐私操作；产出个人优势正文，不暴露新的公共保存 API。`工作经历.tsx` 内部 `执行保存` 接受实际 next 与本次屏蔽意图，形式可为局部参数对象；任何调用不得依赖刚 setState 的旧闭包。

**预期编辑文件：**
- 新增：`src/组件/个人优势编辑正文.tsx`、`src/组件/个人优势编辑正文.test.tsx`、`src/屏幕/工作经历.日常编辑.test.tsx`。
- 修改：`src/屏幕/我的简历.tsx`、`src/屏幕/我的简历.test.tsx`、`src/屏幕/我的简历.module.css`、`src/屏幕/工作经历.tsx`、`src/屏幕/工作经历.module.css`、`src/屏幕/工作经历.测试辅助.tsx`、`src/屏幕/工作经历.行业与企业.test.tsx`、`src/屏幕/工作经历.资料与预填.test.tsx`、`src/屏幕/工作经历.教育目录.test.tsx`、`src/屏幕/工作经历.作品集与标签.test.tsx`、`src/屏幕/引导问答.tsx`、`src/屏幕/引导问答.test.tsx`、`src/屏幕/引导问答.module.css`、`src/数据/招聘数据源/简历.test.ts`。
- 删除：无；移除不再消费的旧姓名/加意向样式只限本 Task 已列文件。

- [ ] Step 1: 在真实组件 harness 中补失败用例：已有条目 item 按编号直达；不存在 id 不落“新增”；skills 只显示技能；certificate 指定项可编辑；取消后全局与保存调用不变；直接保存只一次；两次连续编辑不回旧页（单测检查状态，Task 5 检查实际浏览器栈）。
- [ ] Step 2: 加屏蔽回归：未点保存零隐私写、onboarding 全量经历不完整则隐私零写、日常当前条目无效则零写；两条以上旧不完整经历/教育并存，分别修复或删除一条时不会被其他未改条目拦住，未改条目零写且不删除；隐私成功/简历失败时留页且已成功事实保留，重试仅补简历；旧 hidden=true 不改、新段 false；更换组织不隐式解除旧组织。运行下方命令捕获目标失败。
- [ ] Step 3: 日常进入工作经历页后按 section/item 初始化局部列表草稿和子编辑器。work 无 item 显示工作分区列表，education/certificates 无 item 显示其列表；skills 为受控标签编辑。基本信息卡最高学历进入 education，诊断缺项带相应 section。直接条目保存回原简历，列表内条目保存回本地分区列表；列表没有第二次“总保存”，返回原简历即可，已成功条目不回滚。
- [ ] Step 4: 复用现有条目编辑器，仅日常把“完成”绑定完整异步保存并显示“保存”；删除沿现有允许删除条件执行明确提交。新增条目保存成功用权威 ID，不以临时编号生成新 API ID；取消只丢局部草稿。证书保留已有名称/年份字段，无需创建新证书 schema。
- [ ] Step 5: 重排局部保存函数：onboarding 保留先行全量经历/教育等校验；日常按合同 B 合成局部差异，只校验本次将新增/修改的条目或分区（当前已改行缺项则定位字段并拦下，删除目标不要求补齐被删除条目），再 derived 确认，再顺序隐私操作/权威重读，再保存简历。未改旧条目按权威对象原样带回，使现有数据源 diff 不生成 PATCH/DELETE；不是少传其他条目或放宽被修改条目的校验。若检测出当前分区之外的意外差异，先修正 next 构造，不能默许它写入。保存锁覆盖全过程、确认弹层不丢 next；失败保留明确 next 与未达成意图，不能再次从旧全局构造覆盖用户输入。不改先行操作的 If-Match/幂等。onboarding 条目“完成”仍仅回填建档草稿，聚合“保存”才走完整链。
- [ ] Step 6: 提取个人优势受控正文给 `/wizard?from=resume`；标题“编辑个人优势”，初值仅权威现值，保存个人优势带日常编辑并用统一退出。删长按说明及简历添加意向行，保留字数和真实恢复语义（本模式恢复=null）。
- [ ] Step 7: 回跑定向测试、自检 next 实参/取消/partial failure，提交明确文件并追加执行记录。

```bash
npm test -- src/屏幕/工作经历. src/屏幕/我的简历.test.tsx src/屏幕/引导问答.test.tsx src/组件/个人优势编辑正文.test.tsx src/数据/招聘数据源/简历.test.ts src/状态/后端/隐私操作.test.ts src/数据/后端映射.test.ts src/流程/候选Onboarding简历预填.test.ts --maxWorkers=4 --retry=0
```

**完成/停止：** 分区和条目入口都正确，完整保存链一次提交，onboarding 聚合编辑不退化。旧缺项的多行修复由日常局部 diff 逐条完成，不新增日常聚合“总保存”或批量修复向导。数据源现有相等判定确实使未改条目零写须由上述数据源/页面测试共同证明；无法做到则停查 next 归一化，不能取消写前校验。若现有数据源会将合法未改字段误清空，先定位并记录需要的精确文件/现有接口修复；不得自行引入后端 endpoint 或泛化事务。仅设置局部状态再调用旧保存、仅把完成改文案，均不合格。

### Task 3: 候选 Onboarding 意向、资料、偏好归位

**目标与非目标：** 执行合同 C、Spec §3；首屏采薪资，资料页采优势，后段补充偏好创建首次意向。保留 PDF 授权/恢复、学历四页、完成/头像流程及唯一首次意向。

**依赖与接口：** Task 1 日常分支隔离、Task 2 优势正文/完整保存链可用。修改 C 中列明的两个人优势 helper 签名，所有调用者同步；B 三个业务操作签名不变，目录/薪资 wire 不改。

**预期编辑文件：**
- 新增：无。
- 修改：`src/流程/onboarding配置.ts`、`src/流程/onboarding配置.test.ts`、`src/流程/候选Onboarding预填边界.tsx`、`src/流程/候选Onboarding预填边界.test.tsx`、`src/流程/候选Onboarding简历预填.ts`、`src/流程/候选Onboarding简历预填.test.ts`、`src/屏幕/学生分流.tsx`、`src/屏幕/学生分流.module.css`、`src/屏幕/学生分流.test.tsx`、`src/屏幕/基本信息.tsx`、`src/屏幕/基本信息.test.tsx`、`src/屏幕/求职状态.tsx`、`src/屏幕/求职状态.test.tsx`、`src/屏幕/工作经历.tsx`、`src/屏幕/工作经历.资料与预填.test.tsx`、`src/屏幕/引导问答.tsx`、`src/屏幕/引导问答.test.tsx`、`src/状态/领域/候选资料.ts`、`src/状态/应用状态.归约.test.ts`、`src/状态/应用状态.资料与建档.test.ts`、`src/应用.tsx`、`src/应用.test.tsx`。
- 删除：无；去掉旧题目正文/废弃题序逻辑时保留 salary 地址兼容，不删除其他页面仍引用的薪资组件。

- [ ] Step 1: 流程数组和首屏组件失败用例先行：两身份同主序；新薪资确认前不可下一步，显式面议可行；确定/取消、同周期保留/跨周期清除、启程不丢薪资、返回修改读最新值。旧 salary 入口替换回首屏并保留待写入槽；无草稿不假造值。运行下方命令验证失败。
- [ ] Step 2: 首屏添加与岗位同样式选择行，复用薪资区间层及现有档位，用 undefined/0 区分未确认与面议；存薪资动作携带当前城市/职位 refs。不从解析文本补出结构化薪资；身份切换导致偏好重置时按实际周期同步作废旧薪资。下一步在既有校验后校验薪资，再走原解析等待/继续手填决策，最后去基本信息。
- [ ] Step 3: 统一流程数组与实际出口：basic 成功均 status，status 均最高学历，就读时间仍工作经历，工作经历均偏好 wizard。维持空身份 profile 延迟/学生身份已知分支的正确 basic 确认。应用注释、预填消费集合、活跃/恢复位置同步；日常标记优先且零预填。
- [ ] Step 4: 将优势正文挂聚合资料页，改两个人优势 helper 签名及全部调用/测试。局部优势输入同时按现有建档草稿字段恢复，用户已输入（包括清空后的明确空串）不被迟到建议覆盖。取得当前轮有效建议后允许现有恢复按钮，不把 Mock 文本带 Backend；保留先行 PDF hidden=false。
- [ ] Step 5: 聚合保存全链（Task 2）成功后保存个人优势并确认 summary，再进入补充偏好；summary 失败保留草稿，不重确认已成功分区，重试不重复已落地隐私命令。把首次意向调用从个人优势题迁到补充偏好的明确继续动作，采用最新引导预填 refs/薪资/类型与本页偏好；缺项回首屏，成功才披露说明。单槽/请求身份沿现有操作，不能每次点击 create 一个意向。
- [ ] Step 6: 覆盖 summary 成功意向失败→只重试意向、双击一次命令、旧草稿恢复、当前轮确认后不再应用建议、四分支手填/PDF 与真实引用。回跑下方测试，提交明确文件及记录。

```bash
npm test -- src/流程/onboarding配置.test.ts src/流程/候选Onboarding预填边界.test.tsx src/流程/候选Onboarding简历预填.test.ts src/屏幕/学生分流.test.tsx src/屏幕/基本信息.test.tsx src/屏幕/求职状态.test.tsx src/屏幕/工作经历.资料与预填.test.tsx src/屏幕/引导问答.test.tsx src/状态/应用状态.归约.test.ts src/状态/应用状态.资料与建档.test.ts src/应用.test.tsx src/状态/后端/候选操作.test.ts --maxWorkers=4 --retry=0
```

**完成/停止：** 页面顺序与流程数组相同，首次意向唯一/正确，已确认 summary 不重复建议。不能以删掉旧恢复测试代替适配；如果需要新持久字段或改变现有首次意向幂等合同，停下来说明 Spec 差异。

### Task 4: 招聘名片去维护入口、职位三级自动展开

**目标与非目标：** Spec §4。只调整 onboarding 公司维护能力与发布岗位分类；不动公司关系权限、发布字段锁定、JD 导入或求职多选规则。

**依赖与接口：** 开工依赖通过，Task 3 后顺序执行。`招聘名片展示属性.打开公司资料` 改为可选 `?: () => void`；缺省不渲染该行。已有 `use期望职位目录({查询,搜索词,已选键们})` 返回根/组/尾态/按键取项，签名不变，直接复用不搬整个模块。岗位正文 props 改为下面的局部合同，类型复用期望职位正文已导出类型：

```ts
type 岗位职业分类正文Props = {
  根项们: {键:string;名称:string;选中:boolean}[];
  切换根: (键:string)=>void;
  根尾态: 目录尾态;
  组们: 期望职位组[];
  右尾态: 目录尾态;
  选定: (键:string)=>void;
  关闭: ()=>void;
};
```

**预期编辑文件：**
- 新增：无。
- 修改：`src/组件/招聘名片/招聘名片展示.tsx`、`src/组件/招聘名片/招聘名片展示.test.tsx`、`src/屏幕/招聘名片.tsx`、`src/屏幕/招聘名片.test.tsx`、`src/组件/岗位职业分类正文.tsx`、`src/组件/岗位职业分类正文.test.tsx`、`src/屏幕/发布岗位.tsx`、`src/屏幕/发布岗位.module.css`、`src/屏幕/发布岗位.目录.test.tsx`。
- 删除：无；移除发布岗位中被现有 hook 替代的独立 roots/child 状态机，不顺便重写 hook。

- [ ] Step 1: 失败测试：无公司回调不显示行、有回调日常可进入；Mock 和 Backend 从注册流隐藏。分类二级 heading 非 button，默认一级自动出现三级，点击叶子仅一次关闭/回填，失败组重试不影响成功组；已发布字段仍不可打开。
- [ ] Step 2: 招聘名片两适配按现有从注册流事实省略公司维护回调，不能依据 backend/mock 决定。Mock 若现有代码所有场景都推断注册，核对应用既有入口的 state，补成与 Backend 同一来源；保持用户已有日常公司入口。刷新沿已存在的 history.state/登录分流事实，不新建完成标记。
- [ ] Step 3: 岗位正文保留全屏外壳，用分组 h3+叶按钮，呈现每组尾态。Backend 传 `搜索词:''` 和当前类别 ID 给 hook，`按键取项(id)` 查到且 selectable 合法才回填。Mock 从 `职业分类树` 的真实本地分组映射，不再用扁平分类表丢二级标题。
- [ ] Step 4: 删除旧下钻控制器；保留页内选择子视图、父页隐藏/焦点滚动恢复、单选即回填、岗位名联动以及锁定字段。分页/换版/迟到由 hook 原样负责，不加预取或并发池。
- [ ] Step 5: 跑下列包含候选消费者的回归，证明复用不改变候选多选/搜索；提交明确文件及执行记录。

```bash
npm test -- src/组件/招聘名片/招聘名片展示.test.tsx src/屏幕/招聘名片.test.tsx src/组件/岗位职业分类正文.test.tsx src/屏幕/发布岗位.目录.test.tsx src/屏幕/期望职位目录钩子.test.tsx src/屏幕/选期望职位.test.tsx --maxWorkers=4 --retry=0
```

**完成/停止：** 两角色真实目录叶语义不变、招聘只单选，日常公司入口保留。若实际目录不满足已有 hook 支持的层级，保留错误/证据并说明差异，不靠名称拼 ID 或自己加通用树层。

### Task 5: 浏览器交互、视觉与活动验收同步

**目标与非目标：** 把 Spec §8/§11 变成真实接线断言及活动验收检查点，更新 Mock 视觉和测试清单。此 Task 是测试交付，不是正式 STG 执行或 final gate，也不是再跑全仓。

**依赖与接口：** Task 1–4 完成，先行最终测试已纳入。只使用现有 e2e fixtures/test 的离线边界和 BFF fixture；不改全局未知请求兜底，不新增 runner。

**预期编辑文件：**
- 新增：无。
- 修改：`e2e/onboarding.spec.ts`、`e2e/J-PILOT-02接线.spec.ts`、`e2e/suites/候选建档.spec.ts`、`e2e/suites/招聘建档与JD.spec.ts`、`e2e/suites/简历与附件.spec.ts`、`e2e/suites/求职意向.spec.ts`、`e2e/suites/岗位编辑.spec.ts`、`e2e/suites/隐私与实名.spec.ts`、`e2e/fixtures/数据源交互.ts`、`e2e/fixtures/bff/候选建档.ts`、`e2e/视觉回归/场景.ts`、`e2e/视觉回归/场景.test.ts`、`docs/testing/cases.md`、`docs/testing/README.md`、`docs/dogfood/stg-onboarding.md`、`docs/dogfood/真实后端行为验收.md`、`docs/dogfood/真实后端报告模板.md`。
- 删除：无。

- [ ] Step 1: 更新原流程 helper 与断言，学生/社招 × 手填/PDF 走新顺序且真实 refs、summary、首次意向仅一条；既有上传失败/恢复/单槽断言保留。新增相互独立的用例前缀 `Onboarding简历修正`，避免把所有风险塞进一个长用例。
- [ ] Step 2: 在真实 browser history 走“我→简历→姓名/工龄/经历→保存→返回我”，另走取消、连续两个分区编辑、教育列表子编辑、空身份基本信息收口；失败后按钮可重试且未返回。不要 hash直达伪造有来路的栈；深链/硬刷用独立 Case 验证安全替换和重新读取已保存事实。
- [ ] Step 3: 状态两来源保存和刷新一致、取消零写；招聘名片无公司维护行且可完成、三级直接单选及父页草稿保留。为实际触达的 API 坐标在已有 fixture 精确声明，不加通配成功应答。
- [ ] Step 4: 迁移先行简历/隐私 Case 的双点击和“完成→保存”路径到新日常入口，保持隐私写次数、来源/If-Match/hidden 原值/跨页一致性。增加“屏蔽成功→经历 PATCH失败→留页→重试仅经历 PATCH”的真实拦截反例；取消未提交仍零写。若仅改调用路径，不删除先行逻辑断言。
- [ ] Step 5: 视觉保留现有场景 ID，`candidate-salary` 改为首屏打开薪资抽屉，`candidate-preferences` 展示新首屏，`candidate-resume` 明确落日常新编辑布局。新增 `onboarding-resume-basic-edit`、`onboarding-resume-status-edit`、`onboarding-recruiter-category` 三个场景，加入场景ID数组/唯一性测试；保留先行所有 chat-recommend-frontend 场景。不用固定旧数量覆盖对方新增项。
- [ ] Step 6: 运行以下选择预览，确认目标 Case 实际非零；随后功能选择，visual 采集并逐张核对标题、薪资、三级标题/叶子、保存短屏可达与无横向溢出。静态截图不是交互通过的替代。

```bash
npm run test:e2e -- e2e/onboarding.spec.ts e2e/J-PILOT-02接线.spec.ts e2e/suites/候选建档.spec.ts e2e/suites/招聘建档与JD.spec.ts e2e/suites/简历与附件.spec.ts e2e/suites/求职意向.spec.ts e2e/suites/岗位编辑.spec.ts --list
npm run test:e2e -- e2e/onboarding.spec.ts e2e/J-PILOT-02接线.spec.ts e2e/suites/候选建档.spec.ts e2e/suites/招聘建档与JD.spec.ts e2e/suites/简历与附件.spec.ts e2e/suites/求职意向.spec.ts e2e/suites/岗位编辑.spec.ts --workers=4 --retries=0
npm run test:e2e -- e2e/suites/隐私与实名.spec.ts --grep '聊天推荐前端修复|Onboarding简历修正' --list
npm run test:e2e -- e2e/suites/隐私与实名.spec.ts --grep '聊天推荐前端修复|Onboarding简历修正' --workers=4 --retries=0
npm test -- e2e/视觉回归/场景.test.ts --maxWorkers=4 --retry=0
UI_CAPTURE_DIR=test-results/onboarding-resume-visual npm run ui:capture -- --grep 'candidate-preferences|candidate-salary|candidate-resume|recruiter-card|onboarding-resume-|onboarding-recruiter-category'
```

七个功能文件是本轮改动的完整旅程/日常消费者，文件级覆盖可防 helper 变更损坏已有断言；隐私只选经历相关 Case。上列 grep 是当前已观察标题的初始选择器，执行时必须按开工门的最终 Case 登记更新为能覆盖每一项的精确并集，并对更新后的同一命令先 --list；不能“非零就算全覆盖”。共用 helper 若影响文件外调用者，用 `rg` 找消费者并追加实际受影响 Case，不自动选择整层。`--list` 不证明执行通过，所有运行 retries=0。

- [ ] Step 7: 更新活动 `stg-onboarding` 指南为 §3 新流程（两 manual + 能力开放时 parsed），保留两角色不同 cleanup/retained 规则；更新基础试点第6.2首轮第3节点：候选依次改基本字段、工作/教育条目、技能、证书、优势、三态，再分别刷新回读，保留原意向 CRUD 和第二轮隔离责任。真实试点保持两轮完整范围，不把新增局部检查声明为另一个 Suite；不在试点中额外测试企业屏蔽/披露写操作（该部分用 fixture 回归，避免超出现有排除范围）。报告模板增加上述逐项结果与取消/返回记录，不预写 PASS。
- [ ] Step 8: 测试总入口补本轮迁移对账/选集说明，更新手写 L3 节点说明而不改 runner 的案例身份定义；执行 `npm run test:list -- --write` 和 `npm run test:list -- --check`。新文件全在既有流程/屏幕/组件分类内，若清单校验报告实际映射缺口，先定位后按原入口扩展精确映射并更新 task intent，不能手工改自动区。
- [ ] Step 9: 自检先行用例/场景未丢、真实验收状态诚实；提交本 Task 文件与执行记录。

**完成/停止：** 选集全部实际 PASS、截图逐项查看、清单一致、活动指南匹配目标。无关基线失败必须有复现证据并明确遗漏，不可称 full PASS；先行最终基线/新增Case未获取或 STG 指南与前端 schema 不一致时报告具体缺口，不造 mock 事实。

## 实施后收尾（不计入 Task count）

1. **退出实现阶段。** 全部编号 Task 及 execution skill 要求的宿主内全局 review 完成；未要求的审查不额外新增。冻结候选和批准文档引用；不调用默认 finishing-a-development-branch，不再回 Task/global review。
2. **异构代码 review。** Codex→claude-review-loop，Claude Code→对应 Codex review-loop。绑定批准 Spec/Plan 和固定候选 diff，带共享守约合同；reviewer 不跑测试。轮次、裁决、终止归 review skill，轮间只跑修复涉及的轻量单元/静态。只读文档 review 不替代这一步。review 返回允许继续后进入 affected。
3. **affected/L0–L2。** 本仓库没有通用 affected CLI。以 `docs/testing/README.md` 的原生 Vitest/Playwright/visual 入口和 `--list`/`test:list` 收集为权威，记录 actual diff→消费者→精确选集、候选/依赖/runtime/fixture 指纹及原始回执。合并 Task1–4 定向 Vitest 文件去重，Task2 的 `工作经历.` 包含新增日常与原四测试；Task5 功能/视觉/清单责任去重。运行 `npm run lint`、`npm run typecheck`、`npm run build`、`git diff --check`，收尾取完整有效记录，不因多 Task 改了同文件重复跑 broad gate。Task5 有效证据可复用，后续修复只补失效项；缺选择粒度或依赖证明则说明 `fallback_reason`、gate 未完成，不自动全层测试。
4. **人工 final gate。** 全部适用 L0–L2 有有效证据且 review 无未解决 required 后，展示候选 SHA、只读 fetch 的 `pre_gate_target_base`、先行最终合入证明、受影响选集、可复用证据、必要新增运行、下述 L3 前置/清理与普通合入计划，等待用户明确确认。当前用户要求规划不等于此 gate 获批。
5. **确认后集成与 L3。** 完整读取 development-workflow 的 `references/final-integration.md` 及 `assets/final-integration-contract.md`，记录实际 `final_target_base`，合入配置的 origin/main（不 rebase 已审候选），完整重算责任，复用有效 L0–L2 只补缺口；不再异构 review。正式 development L3 串行按以下选择，业务 UI 写入，后端只用现有 operator，无额外部署或权限放宽：

|责任|选择/条件|前置与证据|
|---|---|---|
|required|`stg-onboarding-candidate/manual`|现有空账号场景、来源/完成API；首屏薪资、资料优势、首次意向唯一与回访，按指南cleanup/retained|
|required|`stg-onboarding-recruiter/manual`|真实组织/类别目录；无公司维护入口、直接选三级、完成首岗及回访|
|conditional|candidate/parsed 与 recruiter/parsed|现有附件/解析或JD导入能力开放；同合成材料、真实suggestion和人工确认；能力未开放记NOT_RUN原因，不替换手填冒充通过|
|required|`STG 基础试点` 第6节两轮，含 Task5 扩展首轮日常编辑节点|沿 ephemeral-baseline、安全输入、双角色会话和第二轮隔离；逐分区操作后/刷新证据，两轮 CLEANED/零残留/占用释放|
|none|stg-matching、学生专用真实材料、后端/发布级全序列|不选择，不记PASS|

   执行前所需目标 URL、安全登录输入、后端 checkout/skill、STG 空闲占用与能力由实施者按活动指南核验。缺失时向用户只询问缺项，独立只读准备可继续；BLOCKED/NOT_RUN 保留，required 未完成不得 push 或声称全验收完成。解析 conditional 一旦具备前提并被选择，其失败也不能豁免。两种 Suite cleanup 规则不同，不统一成零残留。
6. **cleanup 后对账与 push。** 遵循 INCREMENTAL_EVIDENCE，累计失效，不拿更早 PASS 覆盖新失败；正式 L3 后再对账其清理是否使运行证据失效，只补必要项。最后第二次 fetch，target 前进则保留证据并提出新 gate，不自动追赶。target 未动、所有所选责任成立后普通 fast-forward push；push 成功才报告合入。将 task intent 标 completed 并给结果定位。

## Spec 覆盖与自检

|Spec|实施落点|
|---|---|
|§1/§2 最小方案/非目标|Global、各Task非目标|
|§3 候选流程/薪资/优势/首次意向/恢复|Task3、Task5|
|§4 招聘名片与三级目录|Task4、Task5|
|§5 简历按区/保存/取消/返回/清理|Task1、Task2、Task5|
|§6 全局三态真实状态|Task1、Task5|
|§7 Mock及旧合同|所有页面Task与Task5视觉|
|§8 测试/STG|各Task定向命令、Task5指南、不计数收尾|
|§9/§10 完成与阶段|Global及不计数收尾|
|§11 先行分支/隐私/hidden/测试迁移|开工门、Task2、Task3、Task5|

内部实现可以等价组织，URL、公开局部签名、数据归属、错误/返回行为与验证义务不可临场重设计。文档路径全部相对；Plan 不承诺未运行的产品验证。

## 文档 review 与裁决记录

R1：Claude Opus / high，WORKFLOW_DOCUMENT_REVIEW。批准 Spec revision/blob 见文首，候选 HEAD `760c9b89ac6ed885ca5f20e126f393424144384c`，Spec blob `19f720e212db569eba5c354cecb67fb7b493a766`，Plan blob `4532ee85a41327a15585d7359ba9ea351e97abf5`。审查前后 status/HEAD/两文档指纹一致；reviewer 未运行测试、未修改文件。报告3条 Important/required，无 optional。

|Finding|裁决与核实|修正与批准范围|
|---|---|---|
|R1-1 开工门无法更新旧工作区|接受“解锁操作需具体化”；不采纳让实施Agent在gate前自行merge target的建议，因为workflow明确禁止|增加用户在启动实施前的精确手动基线准备步骤；仍允许选已有合入版本的工作区，仍保留DEPENDENCY_BLOCKED。只是具体化外部前置，不改变产品/执行授权|
|R1-2 单条保存被其他旧缺项永久阻断|接受；源码核对现有简历数据源只映射真正变化的经历/教育，未改项可原样跳过|日常以权威快照叠加本次条目/分区差异，只预检将写条目；onboarding保留全量预检。增加两条旧缺项修复/删除与零旁路写的回归，不新建批量修复流程；符合Spec §11.2.4“本次真正将提交范围”|
|R1-3 先行用例选择靠临时标题|接受；先行已提交有隐私操作/映射测试，未提交e2e标题不能当最终依据|开工登记最终diff中的实际文件/完整Case/project及行为，选择器与清单逐条对账；补隐私 --list 和已知漏选单测，不只看非零|

R1 的3条均已在 Plan 修正，批准 Spec 未改。R2 使用同一 Claude 会话复核，候选 HEAD `a61cb7578bee939c7f3bf08cb0a0d37539b40185`，Plan blob `c369c21c6aa2c82db924bf1e2fc15088f17e4ae7`；审查前后 status、HEAD、两份文档指纹一致。R2 明确逐条确认修复，最终 `NO FINDINGS`，无未关闭 required 或 optional。reviewer 未运行测试、未修改文件。本次 v1.2 只更新阶段、审查记录及根路径的等价文字表示（避免可移植性校验器将应用 URL 误判为机器路径），不改变已复核的实施合同。规划、修复及审查均未运行产品测试。

## 实施记录

当前全部 Task 未开始，未执行产品测试/正式 STG、未合 target、未 push。实施者逐 Task 在本节追加精确依赖基线、修改/提交、最小验证回执、现场差异；收尾登记 review 候选与后续修复 delta、全选集/复用证明、final gate/实际L3/cleanup/push事实。文档 review 的完成不能代替实施完成。
