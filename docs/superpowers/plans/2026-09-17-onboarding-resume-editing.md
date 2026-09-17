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

### 2026-09-17 开工依赖门核验与解锁（Task 1 开始前）

- `predecessor_final`：`fix/chat-recommend-display` tip `445998389aae8e5208eb91220fd2a747aa2deb37`；功能链含 `8326efe1`（Task 1 隐私接线）、`9f2d7a22`（review fix-1 整份保存拦截）、`75547327`/`9f17c061`（Task 2）、`a417e11c`（Task 3）、`1ee77e14`（Task 4）、`f6768171`（Task 5）、`6ba3df17`（Task 6 浏览器接线）、`1b68fb6e`/`ad71e133`（review 修复栅栏与 401）。旧快照 `ccaf7010` 仅调查记录，未用作证明。
- `dependency_target_commit`：`origin/main` = `44599838`，先行合入 merge `cbaf065c` 经 `git merge-base --is-ancestor cbaf065c origin/main` 证明已进入 target；普通 merge、非 squash，无需逐项 diff 替代祖先检查。
- 初始核验时所选工作区 HEAD `de60d5fd` 不含先行合入（merge-base 为规划基线 `acfdab7e`），已按 Plan 报告 DEPENDENCY_BLOCKED。随后用户明确指示执行 Plan「依赖门的具体解锁步骤」：工作树 clean、`git fetch origin`、`git merge --no-edit origin/main` 无冲突完成，merge 前 `de60d5fd` → merge 后 `f6892635`（执行基线 `execution_base`）。merge 后复验：`44599838`、`cbaf065c` 均为 HEAD 祖先；批准 Spec blob `19f720e`、Plan blob `eb460a10` 在 HEAD 树中不变。
- Spec §11.2 合同承接抽查（合入源码）：`src/屏幕/工作经历.tsx` 含 `取有效屏蔽` 派生判定、待提交屏蔽意图 Map、按序隐私写 + 每次成功后 `重读隐私` 权威回读、single-flight `保存整份简历`、新经历 `hidden=false` 默认且开关不改写该字段；`src/流程/候选Onboarding简历预填.ts` 预填不改写 hidden。
- task intent 已登记：task_id `4c110d5b-1cab-4e27-9a04-8417d0451b3e`，68 个预期编辑路径（Task 1–5 文件清单并集 + 本 Plan），4 条冻结合同引用（合同 A/B/C、Spec §11）；本 clone 31 条记录中无其他未完成记录，无路径重叠。

#### 先行最终测试责任登记（Spec §11.2 对应，来自先行最终合入树）

单元（project：vitest；选择器 `npx vitest list <五文件>` 对账 282 条 Case、五文件全非零、无重名歧义）：

| 文件 | §11.2 对应完整 Case 名（describe › test） | 保护行为 |
|---|---|---|
| `src/屏幕/工作经历.行业与企业.test.tsx`（36 条，其中契约B 组 15 条） | 工作经历 · 经历企业屏蔽（契约B） › Backend 隐私未读：不能把空快照视为无屏蔽，开关退居「核对中」不可写；Mock 同组织同步：保存走既有隐私 reducer（拉黑带组织编号），两段同企业经历徽标同步；derived 屏蔽的解除保留风险确认：确认后才调用现有解除 API，取消零写；derived 随「对现雇主隐身」生效：总开关关时开关不显示生效，开启被引导去隐私页而非改写来源；写操作让路（void 返回未提交）不得假报成功：权威回读未见达成即提示未保存；取消仅丢弃本次编辑的意图：零屏蔽写，之后的保存不带任何屏蔽请求；外层保存先按序调用现有屏蔽 API 再存简历：成功后移除意图并权威回读，徽标随后显示；必填不完整先阻止整份保存：有屏蔽意图也零隐私写请求；新建经历默认 hidden=false，企业屏蔽开关不再改写该字段；旧 hidden=true 但无有效屏蔽：折叠卡不显示「已对该公司隐身」，编辑页开关为关；有效 manual 屏蔽：徽标显示、开关为开；未提交意图只标「待保存」：完成回上层保留意图，卡片不冒充「已对该公司隐身」；缺组织编号的遗留行先拦整份保存：A 行有待提交屏蔽意图也零隐私写（写前守卫）；部分成功后重试只补未达成项：已成功项不再重放，失败保留意图不发存简历；重试核对当前权威状态：意图已在权威名单（他端已屏蔽）时跳过该项，零重放 | §11.2.1–11.2.5 全部 |
| `src/屏幕/工作经历.资料与预填.test.tsx`（43 条） | 工作经历 候选 onboarding 预填（Spec §8） › 旧经历 hidden=true 与企业屏蔽无关：保存原样携带 true；工作经历 保存 single-flight › 保存中按钮禁用显示保存中，重复点击只保存一次，成功后轻提示并跳转 / 保存失败不跳转，轻提示错误文案，按钮恢复为保存；工作经历 · 简历编辑来源（from=resume） › 社招编辑：保存带 日常编辑 来源，成功只回我的简历，零分区确认零建档草稿 等 4 条；工作经历 DF-002 缺项提示与保存首错定位 › 4 条（写前校验与首错定位） | §11.2.4 写前校验、§11.2.1 hidden 原值、保存链 single-flight |
| `src/状态/后端/隐私操作.test.ts`（31 条） | 创建隐私操作 · 添加组织屏蔽回执合并 › 3 条；创建隐私操作 · 冲突按 code 分派：重读权威 + 原样抛出 › 5 条（409/422 风险确认/401）；创建隐私操作 · 变更 status 0/503 只允许一次 GET 校验真实效果 › 7 条；创建隐私操作 · 重读隐私（企业屏蔽表单入口） › 3 条（含读取失败零提交不把空快照当无屏蔽）；创建隐私操作 · 重读隐私 迟到回执栅栏（review-r1） › 2 条；创建隐私操作 · 被写超越的迟到 401 不清当前会话（review-r2） › 1 条；解除组织屏蔽 404 以权威视图为准 › 2 条；归约隐私设置 · 拉黑携带组织编号（Mock 同组织同步） › 2 条 | §11.2.2 权威回读/让路/冲突不重放、§11.2.5 已成功不伪回滚 |
| `src/数据/后端映射.test.ts`（101 条） | 候选人后端映射 › 经历写入按段原值携带 hidden：旧 true 保留 true、新 false 如实落 false；经历写入带真实组织 ID：请求含 organization_id、不含 company；缺组织 ID 的经历写入抛 organization_id 校验错「请选择公司」，不回退公司文本 | §11.2.1 wire hidden 合同、组织 ID 真实性 |
| `src/流程/候选Onboarding简历预填.test.ts`（71 条） | 取工作页预填 › 空服务端且空页面时物化解析经历：exact 行业带引用、隐藏默认关、项目保序；取个人优势预填 › 5 条（summary 资格/已有值守卫）；取可恢复个人优势建议 › 9 条 | §11.2 预填 hidden=false 默认；Task 3 将改签名的两组 helper 现行为基线 |

浏览器（project：fixture；`--list` 对账无 0 条、无歧义）：

| 完整 Case 名 | 保护行为 | --list 回执 |
|---|---|---|
| e2e/suites/隐私与实名.spec.ts:227 › P3 Backend 隐私主链路 @backend › 聊天推荐前端修复 经历企业屏蔽开关跨页：取消零写、保存写隐私 API、徽标与屏蔽名单同权威 @backend | §11.2.2/11.2.5 跨页开关一致、取消零写 | `--grep '聊天推荐前端修复'` → 2 tests in 1 file |
| e2e/suites/隐私与实名.spec.ts:266 › P3 Backend 隐私主链路 @backend › 聊天推荐前端修复 屏蔽部分保存失败：失败保留意图与简历草稿、零简历写，重试补齐不重复 @backend | §11.2.4/11.2.5 partial failure 与重试不重复 | 同上 |
| e2e/suites/简历与附件.spec.ts:1096 › 聊天推荐前端修复 经历 hidden 默认与保留 @backend › 新建经历保存 hidden=false；旧 hidden=true 经历编辑后 PATCH 仍带原值 @backend | §11.2.1 hidden 新 false/旧 true 序列化 | `--grep '聊天推荐前端修复 经历 hidden'` → 1 test in 1 file |

登记来源为先行最终合入树（HEAD `f6892635`）实际代码与 `npm run test:list` 生成的 manifest，非标题猜测。上述 e2e 的「点两次经历 → 完成 → 外层保存」入口路径按 §11.2.6 在 Task 5 迁移到日常新入口，保护断言保留。本轮实施中不重跑上述先行 Case 作为「产品验证」；其作为依赖交付核验的运行责任在 Task 2/5 定向命令与收尾 affected 选集中体现。

### Task 1 执行记录（2026-09-17）

- 依赖基线：开工门后 `cadb0464`（含用户授权的 origin/main merge `f6892635` 与门记录）。实施 commit `5a3f9628`（14 文件：新增 src/流程/候选日常编辑.ts/.test.tsx、src/组件/求职状态编辑正文.tsx/.test.tsx + 10 个修改，全在 Task 1 清单内）。
- 定向 TDD 回执：RED `npm test -- src/流程/候选日常编辑.test.tsx … --maxWorkers=4 --retry=0` 64 failed/142 passed（目标断言失败）；GREEN 同命令 7 files / 209 passed；全仓 263 files / 6055 tests passed（exit 0）；typecheck、oxlint、`git diff --check` 全清。
- 宿主内 review（两阶段）：spec reviewer Approved（1 Important required）+ quality reviewer Approved（0 Critical/Important、5 Minor 递延）。Important：`是日常编辑位置(search)` 只看来源白名单不看路径，`/basic?from=intentions` 在边界层（视作离开活跃 onboarding）与页面层（注册旅程渲染 + 空身份 `派发 存简历` 裸跳状态页）语义矛盾，违反冻结合同「intentions 仅允许状态页使用」。
- fix round 1 commit `ff358f82`（4 文件 +86/−20）：`是日常编辑位置` 改为 `(pathname, search)` 并按路径限定（resume 简历域各屏、intentions 仅 `路径.求职状态`）；`基本信息.tsx` 页面判定收口为「`/basic` 只认 from=resume」，错配来源在两层均等同无来源；新增 4 例（边界对拍 + 页面错配用例）。定向回执 7 files / 213 passed；全仓 6059 passed；typecheck/lint 清。scoped re-review 判定 ADDRESSED、无新破坏，五条合法链路（`/basic?from=resume`、`/onboard/status?from=resume|intentions`、`/experience?from=resume`、`/basic?from=evil`）语义逐一核对未变。
- 现场差异（与 brief 假设的偏差，已由 review 裁定）：合同 A 未加 intentions 构造器导出（合同只冻结 4 个导出，字面量在 求职意向管理.tsx 一处）；姓名/状态空值展示「未填写」（brief Step 3 空值未填写的一贯化）；`带简历编辑标记` 保持 resume 单义、位置判定另走共享白名单解析（避免 工作经历/引导问答 被 intentions 误纳）。`docs/testing/cases.md` 过期待 Task 5 `test:list --write`；`.编辑条目*` 死样式待 Task 2（清单内）。
- 递延 minor（登记供收尾/最终 review triage）：①`候选日常编辑.ts:79-81` 注释「回调跨渲染稳定」与 `useCallback` 依赖每渲染变的事实不符（行为影响零）；②日常保存缺 出生年/出生月 负向断言（`基本信息.test.tsx` 用 objectContaining 未钉住不写演示默认）；③三态展示文案两处并列（我的简历/求职意向管理）+ 保存载荷六字段重复切片三处；④我的.tsx Mock「在职 · 保密求职中」为既有原型兜底投影（Backend 已读权威身份），Spec §7 范围外不改。
- 浏览器真实历史栈证据留 Task 5；`我的.tsx` 归属裁定为范围外。

### Task 2 执行记录（2026-09-17）

- 依赖基线：Task 1 收口后 `0d18e64f`（含 Task 1 执行记录提交）。实施 commit `9bb4c81c`（16 文件：新增 src/组件/个人优势编辑正文.tsx/.test.tsx、src/屏幕/工作经历.日常编辑.test.tsx + 13 修改；清单 17 项中 `工作经历.module.css` 经核验无需改动——所需样式均已存在）。
- 定向 TDD 回执：RED 5 份日志（/tmp/task2-red/，条目直达/取消零写/屏蔽回归/优势正文等目标断言失败）；GREEN brief 定向命令 12 files / 528 passed；全仓 265 files / 6108 passed（Task 1 后基线 6059）；typecheck、oxlint、`git diff --check` 全清。数据源侧 `简历.test.ts` 新增 8 例以精确 HTTP 调用序列证明未改条目零写、明确删除恰一次 DELETE、遗留不完整行零写不误删。
- 宿主内 review（两阶段，均 opus）：spec Approved（0 Critical/Important）+ quality Approved（0 Critical/Important），无需 fix loop。实施者自检曾修两个真缺陷（日常视图漏挂 derived 解除确认层、确认后丢成功落点），均已在结构上修复并有回归钉住。
- 现场差异裁定（spec reviewer 复核后接受）：(a) 未引入日常局部列表草稿——条目保存即走完整保存链+权威回读，仅 skills 有分区级局部草稿；brief Step 3「局部列表草稿」在合同 B 权威回读语义下属第三份真相，实现改为「列表读权威切片 + 本次变更叠加 next」，可观测要求全满足，属 Plan 允许的内部等价组织。(b) `无 section` 的 `item` 参数在归一为 work 列表时被丢弃——合同只定义 item 与 section 同现，站内入口均同带 section，无可达路径。
- Plan 缺口裁决：`e2e/suites/展示与交互.spec.ts` 的 catalog-fullscreen 候选侧三入口用例（2824/2885/2911 行断言 `#/experience\?from=resume$`）不在 Task 5 预期清单，但归一化会使其变红。裁定：Task 5 范围扩展并入该文件同一迁移动作（依据 Spec §5 归一合同），task intent 路径已同步 update。
- 递延 minor（供收尾/最终 review triage）：工作经历.tsx 增至 2452 行（+581，分区清晰但为结构债，建议后续动本页时提取日常编辑子模块）；证书年份校验与映射层双份口径需同步；Backend 日常教育/证书保存守卫无页面测试；证书区数据来源约定不一致；删除路径无「目标已不在权威列表」守卫；技能用例 DOM 遍历定位；报告 RED/GREEN 计数不自洽（527/528）。Task 5 需补浏览器证据：条目保存后回原简历、两次连续编辑不回旧页（brief Step 2 已含）。

### Task 3 执行记录（2026-09-17）

- 依赖基线：Task 2 收口后 `b92db623`。实施 commit `97af38cf`（22 文件：清单 21 + 清单外 `src/屏幕/工作经历.测试辅助.tsx` harness 适配，经 spec review 裁定未夹带产品改动；清单内 `学生分流.module.css` 经裁定无需改——首屏薪资行沿用本页既有「节问+选择行」版式，薪资区间层/档位/面议语义/抽屉布局等合同硬要求全满足，Spec §3.2「遵循发布岗位样式」的字面像素口径偏离留 Task 5 视觉场景与产品确认）。净删约 2866 行：旧向导五题、段/题序导出（`onboarding配置`）结构性移除。
- 落地：两身份统一 `候选主序`（求职状态移到基本信息后）+ 四出口同步；首屏薪资三态（undefined 未确认 / `{0,0}` 面议 / 区间）共用 `引导预填.薪资`，`存求职筛选偏好` 在 reducer 单点按有效周期条件清除（同周期保留、其余字段与待写入槽不变、无新持久化位）；旧 `?stage=salary` 判定日常之后替换回首屏、零草稿写；两优势 helper 去 stage 签名、调用者全同步（生产仅 工作经历.tsx 三处）；优势正文挂简历资料页、挂载冻结初值、建档草稿「有键即用户输入」三态；向导单题化为补充偏好、首次意向迁至明确继续动作（单槽/幂等操作未触碰，调用点字段与 `完成候选Onboarding` 核对同源）；聚合链 简历→优势→summary→引导问答。
- 定向 TDD 回执：RED 5 文件 49 failed/166 passed（流程数组不等、薪资未清、首屏无薪资行、资料页无优势正文、向导未单题化）；GREEN 定向 12 files / 611 passed；全仓 6095 passed；typecheck/lint/`git diff --check` 清。删除约 120 条旧向导用例经 spec review 逐类抽查：期望职位/城市、薪资抽屉接线、优势预填/恢复、作品集校验、题序恢复、无引用默认串的保护断言均有承接落点（选期望职位/选工作城市/学生分流/工作经历.资料与预填/薪资区间层），非「以删测试代替适配」。
- 宿主内 review：spec Approved（0 Critical/Important）+ quality Needs fixes（1 Important）。Important：`简历已保存` 粘性 ref 在个人优势保存失败后把整条简历链与五道写前校验在本次挂载内永久短路——用户按页面设计「失败后继续改再点保存」时 `保存简历` 静默不发却照常前进；原用例（资料与预填.test.tsx:1140）固化了错误行为。
- fix round 1 commit `11f84343`（工作经历.tsx + 资料与预填.test.tsx）：ref 声明上移并写明前提；三个链上输入写入口（`存()`、`存作品集链接`、`写屏蔽意图`）各加复位；优势输入刻意不复位（「未改输入的紧接重试只补优势」逐字保留）；原用例改钉正确语义（断言 `确认分区` 恰为 `['work','summary']`），新增两条网（改经历再保存→`保存简历` 第 2 次携带新职位；非法作品集链接→校验恢复拦下零二次写不跳转），移除复位可复现 RED 2 failed/60 passed。定向 613 passed；全仓 6097 passed。scoped re-review 判定 ADDRESSED、无新破坏；两具名风险核过——三个复位入口覆盖全部 next 载荷写路径（经历/教育/技能/证书/作品集/屏蔽意图），隐私「重试只补未达成项」不受复位影响（链内调用只移除已达成意图，且链内复位为 no-op）。
- 递延 minor（9 项，登记供收尾/最终 review triage）：/wizard 上 `候选Onboarding预填边界` 死包装与 应用.tsx 注释「六条」错；路径表.ts 注释过时且引用已删导出（报告声称已改但未改——报告与实现不一致，证据卫生）；首屏薪资行后缀与抽屉周期取「当前偏好周期」而非「已确认薪资自己的单位」；aria-label=期望薪资 挤掉已确认值可访问名（Task 5 e2e 选择器注意）；缺项回首屏丢已敲偏好且提交锁后上；候选操作.ts:1222 完成提示文案指向已迁走页面；学生分流.test 两用例名比断言宽；候选Onboarding简历预填.ts 末尾缺换行；问AI代理注释/引导问答.module.css 死类（清单外递延正确）。
- 浏览器级证据（真历史栈、视觉、旧向导 e2e 旅程按新流程）归 Task 5；spec review 确认当前 HEAD 上 Mock 浏览器旅程预期为红，不得当成本 Task 失败，final gate 前须由 Task 5 落地。

### Task 4 执行记录（2026-09-17）

- 依赖基线：Task 3 收口后 `d8493cad`。实施 commit `5453e3bd`（11 文件：清单 9 + 控制器裁决的 2 个必要测试桩适配 `发布岗位.JD导入.test.tsx`、`发布岗位.薪资地点.test.tsx`——其 job-categories 桩只有两层且点击二级当叶子，是 hook 三级冻结合同的直接消费者，桩各 +13 行加中间分组、叶子与用例体/断言逐字未动）。
- 落地：`招聘名片展示属性.打开公司资料` 改可选、缺省整行不渲染；两适配按既有 `history.state.从注册流` 事实隐藏（写该 state 的只有 选身份.tsx:128 注册流落点与 应用.tsx 守卫 replace；日常入口 企业我的/企业设置 无 state，行保留；Mock 新增 useLocation 判定与 Backend 同源，非按数据源分支）；刷新不新建完成标记。岗位类别改用 `use期望职位目录`（`搜索词:''` + 当前类别 ID，`按键取项(id)` 且 `selectable` 才回填），二级 h3 非 button、默认一级自动出现三级、叶子单次关闭回填、失败组重试不伤成功组（请求计数证明）；删除旧 roots/child 下钻状态机约 200 行及失效 import；Mock 从 `职业分类树` 真实分组映射；候选消费者（选期望职位/期望职位目录钩子/期望职位选择正文）未触碰。
- 定向 TDD 回执：RED 4f/2p → 46f/111p（实现前）；GREEN brief 定向 157 passed；受影响选集 11 文件 388 passed；typecheck/lint/`git diff --check` 清。
- 宿主内 review（两阶段，均 sonnet）：spec Approved + quality Approved，0 实现级 Critical/Important。两条 Important 均为 Task 5 交接登记准确性（e2e 归 Task 5，reviewer 亦标注本 Task 不修）：①`e2e/onboarding.spec.ts:355-356` 经 `进入Mock招聘名片`（注册流 state）进名片后断言「公司主页资料」行，新实现下必红——Mock 侧唯一真正破的既有断言，需改日常入口腿或迁移分区导航断言（`招聘组织.spec.ts:166/351`、`视觉回归/场景.ts:256` 直连无 state 已核不受影响）；②`e2e/suites/岗位编辑.spec.ts:215-244` @backend 断言的正是被删除的下钻/死端/分页/整栏替换能力，需按新语义重写而非改桩；`招聘建档与JD.spec.ts:200-204` 类键 count=2 依赖两级桩可选叶子。以上并入 Task 5 派发为 required 交接输入。
- 递延 minor：尾态反馈约 28 行与候选正文近似复制（brief 冻结不搬候选组件，留第三消费者出现时合并）；`职业分类.ts:8` 与 `岗位编辑.spec.ts:15` 过时注释（后者文件在 Task 5 清单内可顺手修）；两条注册流否定断言缺正向锚点；Mock/Backend 重开根行为不对称与真实目录「二级 selectable 叶」风险——留 Task 5/STG 真实目录取证，brief 完成条件明确「保留证据不靠猜」。

### Task 5 执行记录（2026-09-17）

- 依赖基线：Task 4 收口后 `8d5b7000`。交付 commit `d9962706`（19 文件：e2e 七文件旅程迁移与 `Onboarding简历修正` 独立前缀用例、先行隐私 Case 日常入口迁移与真实拦截反例、视觉场景 3 改 3 增（26 ID/唯一性测试更新、先行 chat-recommend/P8/企业公开页场景全保留）、展示与交互三入口迁移、cases.md 重生成、stg-onboarding/基础试点/报告模板更新、职业分类.ts 与 岗位编辑.spec.ts 过时注释修正、清单外 候选日常编辑.test.tsx 仅标题改动〔清单重复身份〕）。
- 定向回执（全部 --retries=0，先 --list 对账）：七文件选集 46 条 → 首轮 45p/1f；隐私 grep '聊天推荐前端修复|Onboarding简历修正' 3p；展示与交互 --project=fixture 25p；场景.test 4p；ui:capture 7 场景逐张人工核对（薪资行 30-45K、三级分组标题+行、编辑标题、保存短屏可达、overflow=0）；test:list --write/--check 一致；lint/typecheck/diff-check 清。
- **产品缺陷发现与裁决**：首轮唯一红例「候选建档 完整保存」经取证（mutation 序列 + 源码走查 + reload 终态）判定为 Task 3 区域真实数据丢失缺陷——资料页聚合链成功续 `保存个人优势` 用渲染期才更新的 `后端状态引用` 旧快照合成 next，`简历域保存` diff 出技能回退 `PATCH /me/resume/skills {"skills":[]}` 清空本轮新增技能（经历/教育/证书有缺项保护、裸数组技能没有）。控制器裁决不接受为已知缺口，派回 Task 3 实施者 fix round 2：commit `e8206931`（`候选操作.ts` 新增 `设权威简历快照` 在五处权威落地同步推进镜像引用 + 单测「镜像滞后」harness 复刻修复前时序，RED [] vs ['Go'] → GREEN；红例 e2e 修复后 1 passed）。修复后 Task 5 选集复跑 46/46 全绿。
- 宿主内 review（spec opus + quality sonnet）：本体判定 Step 1–9 与九条交接输入完整落地、e2e 断言真实行为（URL/历史、mutation 计数、wire 合同）、隐私迁移是加强非削弱、产品修复最小且结构性；两席位各报 Important（去重 5 项 required）：招聘组织.spec.ts:84 共享 helper 漏装三级桩（实测红）、抽屉稳定性.spec.ts:514 仍走已删 `#/wizard?stage=salary` 入口（实测红）、换壳无闪屏.spec.ts:127/142 断言已删薪资段/向导优势题（静态确定红）、cases.md 在 e8206931 后未再 --write（实测 --check 非零）、README「已知缺口」失真；另两席位对「深链/硬刷独立 Case」结论矛盾派为核实项。
- fix round 1 commit `fc409445`：五项 required 全修 + 核实项实查确认首轮确为合并 Case，拆为「取消零写/失败重试」与「深链与硬刷」两条独立 Case（选集 46→47）；抽屉稳定性改首屏薪资行断言零删减、换壳无闪屏旅程迁新流程逐帧断言未动、README 已知缺口小节替换、cases.md 重生成（6105/367）。复跑：七文件 47/47、招聘组织 15p、抽屉稳定性 15p、换壳无闪屏 2p、隐私 3p、场景 4p、ui:capture 7p、lint/typecheck 清。scoped re-review 判定 6/6 ADDRESSED、hash直达 改用为测试定义修正、无新 Critical/Important 破坏。
- 明确遗漏（非 PASS）：未跑全仓单测套件/`ui:compare` 像素比对/其余未列 Suite（报告 §4.2 逐条理由，其中隐私与实名「岗位硬性条件」补装三级桩后未执行——已登记）；正式 STG/L3 全 NOT_RUN（归收尾 final gate 后）。
- 递延 minor：候选操作.test.ts 模拟渲染死代码、候选日常编辑.test.tsx it.each 注释机制说错、视觉场景前缀分组测试冗余、会话操作.ts:333/661 镜像未同步（既有、无可达路径，建议注释收窄）、隐私与实名.spec.ts:251 注释与断言不一致、场景.ts 三处注入重复、岗位编辑.spec.ts 小类勾 类名子串断言、README:604/613/628 旧数字做旧、UI回归巡检.md 场景路径陈旧、引导问答.test.tsx 同名用例超集、简历与附件.spec.ts:1389 注释口径过宽。Task 4 递延的真实目录「二级 selectable 叶」风险留 STG 取证。

### SDD 宿主内最终 review 与候选冻结（2026-09-17）

- 五个编号 Task 全部完成（各含两阶段宿主内 review 与 fix round：Task 1 一轮、Task 3 两轮〔第二轮为 Task 5 验证发现的技能清空缺陷〕、Task 5 一轮〔产品缺陷修复 e8206931 计入其循环〕，Task 2/4 无需 fix）。
- 最终全分支 review（opus，范围 `f6892635..d70f4470`）：With fixes——0 Critical；跨 Task 不变式（来源单义、保存链单一入口、next 由最新权威快照合成、日常零 onboarding 副作用）逐条核过成立；reviewer 独立实跑全仓 265 文件/6105 例单测全过、`test:list --check` 一致、typecheck/lint/`diff --check` 清、Task 1–4 定向选集与 场景.test 全过。Playwright 层未由该 reviewer 重跑（收尾 affected 责任）。
- 最终 review 递延 triage：blocks merge 仅 README:613/628 冻结计数失真（required）；其余 30+ 项递延全部给出「现在不必修」依据；三条早前递延被推翻——首屏薪资单位取值（同周期保留时单位恒等，不构成缺陷）、候选操作完成提示「请回引导问答重试」（与目标流程一致，指向正确）、招聘名片注册流正向锚点（同组已存在 Mock/Backend 各一条日常正向用例）。真实目录「二级 selectable 叶」为批准后的行为替代，首个 STG 真实岗位必须取证并写报告（已登记为 STG 取证点）。
- fix wave commit `dcb34f61`：README 两处计数对齐 47/6105/367（章内与 cases.md 自动区自洽）；`应用.tsx:509` 删除 `/wizard` 上恒 no-op 的 候选Onboarding预填边界 包装并改写「六条」注释与实际相符（删除经边界组件代码路径核实行为恒等，包装仍被六条路由使用、组件仍受直测）。scoped re-review 判定 2/2 ADDRESSED、无新破坏。
- 候选冻结：`dcb34f61`（`f6892635..dcb34f61` 共 16 commits：10 产品/测试 + 1 docs 计划门记录 + 4 Task 执行记录 + 1 最终 review fix wave）。进入不计数收尾：异构 review → affected（L0–L2）→ 人工 final gate。

### 异构 review 记录（收尾步骤 2，2026-09-17）

- 执行方式：codex-review-loop（Codex gpt-5.6-sol high 为 reviewer，read-only，共用守约规则 `../_shared/review-contract.md`），冻结范围 `44599838..HEAD`，最多 3 轮，reviewer 未运行任何测试；每轮前后基线 guard 全过（HEAD/工作树无 reviewer 侧变化）。
- R1（3 findings，全部 required/Important/契约违反，控制器逐条代码核实后 3/3 接受）：①日常新增条目在保存末尾权威回读失败后重复创建——数据源成功路径的最终 `GET /me/resume` 在 try 之外，日常分支无跟踪/权威重读，失败时镜像不更新，重试以新幂等键二次 POST；②旧 `/experience?from=resume` 归一化 `替换跳转` 丢 `location.state`，违反合同 A「保留合法来路」；③`from=resume` 在边界层不限路径，`/onboard/degree?from=resume` 两层语义矛盾（与 Task 1 已修的 intentions 同类）。fix `ab5ee5c1`（8 文件 +229/−21）：日常分支失败时 best-effort 权威重读+设权威简历快照（BFF错误且无权威简历且栅栏仍立才触发）；`替换跳转` 可选 state 第二参、归一化原样转交；`是日常编辑位置` 把 resume 限定到合同 A 四类路径。定向 411p、全仓 6108p、e2e Onboarding简历修正 5p（新增真实历史栈用例：同一文档 pushState+popstate 推入旧地址，第二次返回到「我」）。
- R2（1 new required，接受）：教育/证书/两条嵌套项目 create 路径不回写服务端 ID 到本地对象（经历主体有），POST 成功+最终 GET 失败+补救重读后，保留临时编号草稿重试会「再 POST + 把首次创建的服务端条目判缺失发 DELETE」；r1 经历回归还从权威快照重建页面、未测真实保留草稿窗口。fix `a3b8f37f`（4 文件 +338/−37）：四条 create 路径响应成功即回写 ID 到正在编辑的本地对象（证书编辑器改为先 设草稿 再保存使回写落在幸存草稿）；5 条新用例按「同一保留草稿重试→零 POST 零 DELETE」口径，r1 用例同步改造。onboarding 路径条目为 `准备写入` 副本、有意不回写（靠已存身份/单槽跟踪，语义零变化）。定向 267p、全仓 6113p、e2e 5p。
- R3：精确 `NO FINDINGS`，闭环。修复 commit：`ab5ee5c1`、`a3b8f37f`。裁决摘要：R1 3/3 接受修复、R2 1/1 接受修复、无拒绝/递延项。reviewer 提出的验证需求均由实施侧以定向回归落证（不因格式跑产品套件）。
