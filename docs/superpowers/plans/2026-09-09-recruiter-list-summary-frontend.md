# 招聘端推荐与在谈列表字段补齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 Superpowers executing-plans 顺序执行。复用用户当前 Paseo 工作区，同一执行者完成实现、异构 review 与 final gate；不自动委派实现或创建工作区。Steps 使用 checkbox 跟踪。

**Goal:** 在招聘推荐、在谈 open 列表把真实 candidate_summary 放到 Mock 对应信息位置。

**Architecture:** 复用现有数据源、严格解码、页面映射和卡片，两个消费者共享一个摘要 decoder 和一个格式化映射。各请求决定展开契约，原状态与操作机制保持；不新增缓存或通用卡片框架。

**Tech Stack:** React 19、TypeScript、Vite、Vitest/Testing Library、现有 CSS modules。

**Spec:** `docs/superpowers/specs/2026-09-09-recruiter-list-summary-frontend-design.md`，用户 2026-09-09「好的，然后写0上下文Plan，claude review和写执行提示词吧」批准；revision `5aeb82861d11143c97df5df218f491bc73f3d1d7`，blob `f381411ac0a43b7e6864758da77846284a013733`。不得改写批准基线自证合规。

## Global Constraints

- 阅读 `CLAUDE.md`、`AGENTS.md`；中文文档和沟通，代码标识符与 commit 遵循仓库惯例。
- repository `/Users/visionclaw/.paseo/worktrees/09eyc7i7/resolute-flamingo`；宿主工作区同此路径；分支 `feat/align-recommendation-fields`；target `origin/main`，规划时 tip/merge-base 均为 `28a9c812fbba9c291e3f1b8f8ab506ae6233df7d`。此观察不替代 final gate 获批后的同步。
- 只改招聘推荐主列表与招聘在谈 open 卡；不改候选侧、Mock 数据、详情/历史/已筛卡版式、个人亮点编辑/确认、后端或算法。
- 无逐卡补查，不回填被隐藏的信息。复用男女图标，工作行 title 来自最后工作。推荐保留真实分数，在谈不补造匹配分。
- 默认与展开响应分别严格校验；成功的 null/空数组覆盖旧值。现有 owner/role/scope 栅栏、401/404、游标、阶段状态机和交互不放宽。
- 共用 helper 仅服务当前两个消费者；无新依赖、配置、基础设施。没有发现数据丢失就不改状态生产代码。
- 一个独立交付 Plan，三个内部 Task 按 1→2→3 串行；最终整体合入，Task 1 可先提交而不改变现有行为。回退整体前端接线提交即可停止 include，不触碰后端数据库。

## Task index

| Task | 产物 | 依赖 | 验收边界 |
| --- | --- | --- | --- |
| 1 | 七字段摘要类型、严格 decoder、显示映射与合成样本 | 无 | 纯协议/映射测试通过，原入口行为不变 |
| 2 | 招聘推荐请求到卡片闭环 | 1 | 翻页、主卡、收藏/淘汰/委托、详情与已筛兼容 |
| 3 | 招聘在谈 open 请求到卡片闭环 | 1、2 | 轮询、null 覆盖、scope、阶段/待办、历史与候选侧兼容 |

**计划本身复杂度：中。** 改动跨两条现有链路，严格解码和共享消费者需要定向回归，无新业务子系统。

**零上下文漂移风险：中。** API 和展示已冻结，但共享 fixture 更新范围及真实 local 栈版本/测试数据需现场核实。执行模型只按该风险选择：当前可用的行业 Top 5–10 中高性价比模型。

## 冻结接口与事实

后端权威检出 `/Users/visionclaw/.paseo/worktrees/0yeqiujx/unknown-gecko`，候选提交 `96bb69de7`；OpenAPI `apps/recruitment-bff/openapi/mobile-v1.yaml` blob `a27aa125cdaf7e8e9096845a1d2f0caff49a9bf8`。需要对照时用 git show 读取该版本，不假设现场 HEAD 是同一合同；未部署该接口就记录运行时前置缺口，不去掉 include 或弱化 decoder 绕过。

新增类型与函数的公共签名如下。`候选摘要.ts` 按仓库既有 domain-local 惯例内置自己的小 guard；不得导出或上提 `发现推荐.ts`/`MatchCase.ts` 的私有 guard，也不新建公共 guard 模块。Plan 只冻结公共契约，函数内部实现留到实施阶段。

```ts
// src/数据/BFF契约.ts
export interface BFF招聘候选摘要 {
  gender: 'male' | 'female' | null;
  experience_years: number | null;
  job_status: 'student' | 'employed' | 'unemployed' | null;
  degree: string | null;
  latest_experience: { company: string | null; title: string | null } | null;
  latest_education: { institution: string | null; major: string | null } | null;
  personal_highlights: string[];
}
// src/数据/招聘数据源/候选摘要.ts
export function 解招聘候选摘要(
  input: unknown, 契约错误: () => Error,
): BFF招聘候选摘要 | null;
// src/数据/招聘候选摘要映射.ts
export interface 招聘候选摘要视图 {
  性别?: '男' | '女';
  年限: string | null;
  学历: string | null;
  求职状态: string | null;
  工作: string | null;
  教育: string | null;
  个人亮点: string[];
}
export function 映射招聘候选摘要(
  摘要: BFF招聘候选摘要 | null,
): 招聘候选摘要视图 | null;
```

decoder 输入 null 原样输出 null；对象只允许且必须包含七字段，嵌套两键全必返，非负整数年限、闭集枚举和非空 1–24 Unicode 码点亮点字符串，拒绝未知键和 undefined。没有数组数量上限。通过白名单重建，错误用调用方既有 BFF错误 工厂，P4/P5 原 status/code/message 不变化。函数不负责判断 item 键是否存在：调用方按请求模式判定。

BFF招聘候选推荐 与 BFF招聘工作区项 增加 `candidate_summary?: BFF招聘候选摘要 | null`，可选只表示这些共用类型同时服务默认入口；展开 decoder 必须把键作为 required。P4招聘候选页面、P5列表正常视图 增加 `候选摘要?: 招聘候选摘要视图 | null`；P5列表项 的 recruiter 分支增加 `candidateSummary?: BFF招聘候选摘要 | null`。未请求的字段保持缺席，不映射成已请求的 null。不能对默认详情、历史或 candidate 类型开放新 wire 键。

格式化固定遵循 Spec §4：0「不满 1 年」、n>0「n 年」、null 隐藏；employed「在职看机会」、unemployed「离职可到岗」、student「在校」。degree 原展示名 trim；工作=company/title 非空部分 join(' · ')，教育=institution/major 同理；无部分则 null。亮点按 wire 顺序和原字符串保留，不混合旧 highlights、不受 basis 开关控制。null 视图或全部头行信息缺失时，卡片显示「候选信息暂未披露」。头行只有性别时不增加中性文字。中性文案只占头行位置；工作、教育、标签行仍按各自空值规则独立渲染。摘要整体为 null 时摘要信息区域仅剩该文案；在谈阶段和待办、推荐卡真实匹配环及收藏/淘汰/委托操作和状态均不受影响。

## Task 1：共用摘要契约与映射

**Files**
- Modify: `src/数据/BFF契约.ts`（新增摘要类型；消费者可选成员分别在 Task 2/3 加入）。
- Create: `src/数据/招聘数据源/候选摘要.ts`、`src/数据/招聘数据源/候选摘要.test.ts`。
- Create: `src/数据/招聘候选摘要映射.ts`、`src/数据/招聘候选摘要映射.test.ts`。
- Modify: `src/测试/BFF样本.ts`，新增合成数据导出 `招聘候选摘要样本`，不修改默认推荐/工作区样本语义。

**Consumes:** Spec §3–4 的七字段合同。**Produces:** 上述冻结签名与下方固定样本；两个数据源共用解码，两个页面映射共用格式化。

- [ ] 写类型、合成样本及失败测试，以以下样本为完整展示基准：

```ts
export const 招聘候选摘要样本: BFF招聘候选摘要 = {
  gender: 'female', experience_years: 5, job_status: 'employed', degree: '本科',
  latest_experience: { company: '示例公司', title: '软件工程师' },
  latest_education: { institution: '示例大学', major: '计算机科学' },
  personal_highlights: ['带领5人团队交付'],
};
// 映射断言核心：
expect(映射招聘候选摘要(招聘候选摘要样本)).toEqual({
  性别: '女', 年限: '5 年', 学历: '本科', 求职状态: '在职看机会',
  工作: '示例公司 · 软件工程师', 教育: '示例大学 · 计算机科学',
  个人亮点: ['带领5人团队交付'],
});
```

- [ ] 用表驱动输入删除每个必返键、添加未知键、错误枚举、负数/小数/NaN/Infinity、缺嵌套键、亮点空串/25 码点；均抛调用方错误。24 个非 BMP 码点合法，null 和 [] 合法，0 与 null 结果不同。
- [ ] 映射测试覆盖两个性别、三状态、完全空/部分遮蔽、空白字符串；company=null/title 有值时只显示岗位，禁止回查；输入多余身份 canary 不进入输出。
- [ ] 先运行下方命令记录预期失败，再实现最小函数使其通过；不捕获错误改为空摘要。样本和 helper 不连接任何现有生产调用，因此无可见行为变化。

```bash
npm test -- src/数据/招聘数据源/候选摘要.test.ts src/数据/招聘候选摘要映射.test.ts
npm run typecheck
```

- [ ] 定向 PASS 后提交 Task 1，记录命令与候选 commit。停止条件：发现新 API 与冻结合同冲突，先记录具体差异，不自行重设计。

## Task 2：招聘推荐列表闭环

**Files**
- Modify: `src/数据/BFF契约.ts`、`src/数据/招聘数据源类型.ts`、`src/数据/招聘数据源/发现推荐.ts`、`src/数据/发现推荐映射.ts`。
- Modify: `src/屏幕/候选推荐.tsx`、`src/屏幕/候选推荐.module.css`（按需复用已有类）。
- Test/Modify: `src/数据/招聘数据源/发现推荐.test.ts`、`src/数据/发现推荐映射.test.ts`、`src/屏幕/候选推荐.test.tsx`、`src/状态/后端/发现推荐操作.test.ts`、`src/状态/后端/use发现推荐委托轮询.test.tsx`、`src/屏幕/匿名在线简历.test.tsx`、`src/屏幕/已筛候选.test.tsx`、`src/组件/候选筛选抽屉.test.tsx`。
- Conditional Modify: `src/状态/后端/发现推荐操作.ts`，只有下面的状态回归证明摘要丢失或污染时修改；不重构整个操作层。
- Shared fixture: `src/测试/BFF样本.ts` 保留 `BFF招聘候选推荐样本` 为默认形状；新增展开变体或在列表测试显式 spread 新样本，不能全局给详情样本加键。

**Consumes:** Task 1 两个 helper。**Produces:** `读取招聘候选(jobId, state?)` 方法签名不变，所有可用/已筛列表页展开；`读取招聘候选详情(jobId, recommendationId)` 默认不展开。`从P4招聘候选` 保留旧字段供详情/已筛使用，仅有 candidate_summary 时增加候选摘要。

- [ ] 为数据源加失败测试：available/rejected 第一页与后续页 include 恰好一次；保持 limit、state、cursor。展开每项缺摘要必失败，null 合法；默认单条详情未请求 include，收到新键仍拒绝。
- [ ] 在 recruiterPath 追加 include；`解招聘候选推荐(input, 展开 = false)` 用显式模式扩展 required 键，`解招聘页` 使用展开模式调用，单条详情使用默认模式。不可直接传 `.map(解招聘候选推荐)` 使数组 index 冒充模式参数，使用 lambda。新增可选 DTO 成员只服务默认/展开同类型存储。
- [ ] 映射增加候选摘要字段，并保留旧匿名画像映射结果。更新过时“所有性别均禁见”的注释/测试为仅摘要白名单例外；顶层污染 canary 仍丢弃，详情画面不得因此新增性别/最近工作/个人亮点。
- [ ] 屏幕测试使用展开样本，确认头行女图标、5 年｜本科｜在职看机会，工作/教育/亮点位置与 Spec 一致。将旧的“Backend 无性别”“显示批次亮点/代理摘要”的断言按已批准新卡面调整，Mock 断言保留。basis=false 仍显示 personal_highlights，空数组不回退旧 highlights；旧 summary 文案不上卡。
- [ ] 修改后端推荐卡 JSX：复用 Mock 的性别符、基本行、信息行、标签类和 `性别图标`。头行仅实际项 join 分隔；空工作/教育/标签整行不渲染。推荐真实匹配分与底部按钮、滑动手势不变；不让卡片交互事件重复触发。
- [ ] 状态回归：刷新完整→null/[] 后旧信息消失；收藏更新只改 favorite 保留本次摘要；委托轮询后权威列表仍展开；淘汰重读默认详情后移出 available 并保持既有 rejected 行功能。匿名详情单独缓存不覆盖 available；如发现实际覆盖，使用已有读取招聘候选刷新收敛，不复制旧摘要到默认详情。
- [ ] 在 `候选筛选抽屉.test.tsx` 用展开样本验证「只看收藏」筛选后留下卡片的摘要仍正确；开关继续只筛本地集合、不新增请求；无收藏卡不冒出其他候选摘要。
- [ ] 运行最小反馈和兼容组，确认通过后提交。

```bash
npm test -- src/数据/招聘数据源/发现推荐.test.ts src/数据/发现推荐映射.test.ts src/屏幕/候选推荐.test.tsx
npm test -- src/状态/后端/发现推荐操作.test.ts src/状态/后端/use发现推荐委托轮询.test.tsx src/屏幕/匿名在线简历.test.tsx src/屏幕/已筛候选.test.tsx src/组件/候选筛选抽屉.test.tsx
npm run typecheck
```

失败停止条件：旧路径需新字段才能加载、候选私有字段逃出白名单、旧摘要盖过 null；不得删除回归断言逃避。Task 可单独验证，但本 Plan 最终和 Task 3 一起合入。

## Task 3：招聘在谈 open 列表闭环

**Files**
- Modify: `src/数据/BFF契约.ts`、`src/数据/招聘数据源/MatchCase.ts`、`src/数据/MatchCase展示映射.ts`。
- Modify: `src/屏幕/P5/MatchCase列表.tsx`、`src/屏幕/P5/MatchCase列表.module.css`。
- Test/Modify: `src/数据/招聘数据源/MatchCase.test.ts`、`src/数据/MatchCase展示映射.test.ts`、`src/状态/后端/MatchCase操作.test.ts`、`src/屏幕/P5/MatchCase列表.test.tsx`、`src/屏幕/P5/MatchCase历史.test.tsx`。
- Read/reference only: `src/屏幕/企业在谈候选.tsx`、`src/屏幕/企业在谈候选.module.css`、`src/屏幕/企业在谈候选.test.tsx`。
- Conditional Modify: `src/状态/后端/MatchCase操作.ts`，仅已有替换合并导致摘要丢失/旧值残留时最小修复。
- Shared fixture: `src/测试/BFF样本.ts` 保留 `P5招聘工作区项Wire` 默认形状，open 请求测试显式添加 candidate_summary；历史和详情不变。

**Consumes:** Task 1 helper 与原 P5 state/job/needsAction。**Produces:** 方法签名不变的 `读取P5Open列表(role, filterRef, cursor)`；仅 recruiter open 展开并得到 candidateSummary，`映射P5列表项` 在该字段存在时映射候选摘要，其他公共视图事实保留。

- [ ] 数据源测试：仅 recruiter open 在工作区查询附加一次 include；第一页、带 job_id、cursor 都覆盖。`解P5列表项` 仅 role=recruiter 且架子=open 时必需 candidate_summary；candidate open、双方 history 和 detail 都按原白名单。缺键/非法摘要失败，null 成功；仍禁止列表带 resume_submission 或筛选详情块。
- [ ] 实现类型成员、查询和 decoder，输入经过 Task 1 helper。P5 页先完整 decode，非法 wire 沿现有整页错误机制；不要改成部分成功页。
- [ ] 映射测试：仅已展开 recruiter 把 candidateSummary 变为候选摘要，保留阶段标题、状态、待办、注意说明、caseId；默认 recruiter history 不凭空加字段。保持状态矩阵/非法行规则。
- [ ] 重写招聘在谈卡主体为头行/工作/教育/个人亮点，复用图标和 Mock 字体/间距。去掉卡面别名/通用头像和岗位事实段，但 `职位段` 仍供候选卡使用，不能删除共享事实映射；不改全局 `.头行` 等类使候选卡版式漂移，招聘差异用局部类。保留现有待办徽标、阶段段、注意说明、跳转与白卡可点击语义；不添加匹配环。
- [ ] 新卡测试断言无候选代号/招聘职位和城市薪资/岗位技能，实际摘要出现正确行。完整→null/[] 刷新后仍保留 Case 阶段及可打开；各种空值无孤立分隔。男女图标访问名与 Mock 相同，0 年真实显示。原候选卡、历史、错误行、needs_action 档过滤和分页断言仍通过。
- [ ] 在操作层测试通过既有刷新入口证明新 item 覆盖旧摘要，旧 owner/scope 延迟响应不能混入；先复用已有栅栏测试，新增摘要覆盖断言。不新建状态容器或轮询器。

```bash
npm test -- src/数据/招聘数据源/MatchCase.test.ts src/数据/MatchCase展示映射.test.ts src/屏幕/P5/MatchCase列表.test.tsx
npm test -- src/状态/后端/MatchCase操作.test.ts src/屏幕/P5/MatchCase历史.test.tsx src/屏幕/企业在谈候选.test.tsx src/组件/图标.test.tsx
npm run typecheck
npm run lint
```

- [ ] Task 定向通过后提交；将 Spec §7 的每条成功标准映射到测试/观察证据。停止条件：候选侧/历史被迫展开、刷新保留被撤回字段、原 Case 交互不可用。

## 验证选择五问与最终责任

1. **要防的失败/边界：** include 漏传、默认/展开混淆导致列表或详情解码失败；个人隐私字段污染；title 放成技能方向；null/0 混淆；共享 CSS 与缓存更新破坏其他屏幕。Task 1–3 的测试直接覆盖这些边界，不能靠快照变化一键接受。
2. **最小开发反馈：** 各 Task 的 Vitest 文件组；先运行新增用例记录预期失败，再实施并通过该文件组，类型调整运行 typecheck。依赖缺失时 `npm ci`；不升级依赖，不为文档规划运行产品测试。没有改动/失败新依据时不重复跑已通过文件。
3. **提前真实边界：** decoder HTTP fixture 已能验证 serialization/请求路径；但不能证明 local 后端实际支持 include。实现 Task 2 后若已有健康授权栈和专用数据，做一次定向请求/页面观察核对 include 与 null；不为此启动完整 B01–B05 或 Hosted 流程。没有环境时记录缺口，最终真实展示验收仍须补齐。
4. **最终权威验收：** 人工 final gate 获批后重算责任，复用有效定向 PASS；本前端仓库无 `tools/test affected`，不得照抄后端命令。没有可证明的测试依赖选择器时，全量单测权威入口 `npm test`；另 `npm run typecheck`、`npm run lint`、`npm run build`；受影响的现有 e2e `npm run test:e2e:data-source` 和 `npm run test:e2e`（默认配置的实际选择先核对，重复包含的测试只运行一次）。有 PR 时沿用 `.github/workflows/ui-regression.yml` 的 `npm run ui:check -- --base origin/main`，不自行放宽 visual gate 或更新基线。执行前确认 origin/main 指向本轮 final_target_base；此 UI 比较由既有脚本管理临时 baseline 检出，不新建第二用户实施工作区。
5. **已有证据与预计成本：** 规划仅做源码/契约阅读和文档自检，未跑产品测试；后端 handoff 的 PASS 不算本前端候选证据。上述前端命令耗时未知。记录命令、source commit、fixture/runtime、退出码、结果路径；merge 后只有可证明输入相同的 PASS 可复用，无法证明就补跑既有权威入口，不新增证据缓存设施。

### 真实 backend+local 展示验收责任

责任 **required**：按 `docs/dogfood/真实后端行为验收.md` 的环境/会话/证据规则，做本任务两张招聘卡的定向浏览器观察，非完整 Hosted L3。执行 owner 是本 Plan 实施者。前置为目标 Origin（优先 localhost:5173）、支持冻结 include 合同的后端检出/健康栈、专用招聘账号登录材料及有推荐与 open Case 的合成候选数据。缺输入时列明缺项并请用户提供，允许先完成代码与定向测试，不声明整体验收完成。不能改用 Mock 冒充。

观察：网络请求只发一次 include；返回摘要与对应卡片男女图标/年限/学历/状态、公司岗位、学校专业、个人亮点一致；点击推荐详情、收藏、在谈详情与待办仍可用；无分数的在谈不出现环；缺失字段无假值。0/空值/男女不能在真实数据同时凑齐时使用上述自动化证据，真实浏览器至少完成两个列表的真实完整摘要展示。记录前后端 commit 与截图，未执行 B01–B05/H01–H04 按指南记 NOT_RUN。

正式后端 development L3 责任 **none**（无后端产品变更）；发布/STG/生产验收 **none**，归独立发布工作。本任务真实卡片验收不伪称任何完整后端 suite PASS。

## 实施 review 与收尾（不计入 Task 数）

- 输出记录：`docs/superpowers/handoffs/2026-09-09-recruiter-list-summary-frontend-execution.md`；浏览器证据 `dogfood-output/<run-id>/`，凭据不入文档/提交。
- same executor 使用 executing-plans；先登记本机 task intent，再修改代码。先用 CLI --help 获取 task_intents 的真实参数，不猜 schema。
- 定向验证收敛后，以 Claude 宿主→Codex reviewer / Codex 宿主→Claude reviewer 做一次固定候选的多轮实施 review，输入批准 Spec blob、本 Plan 最终 blob、固定 base/head 与已有证据；reviewer 不运行测试；逐条裁决，最多三轮，optional 不阻塞。
- 展示候选 SHA、已观察 target SHA、合并和测试责任的具体方案后等待用户 final gate 确认；此前不同步 target、不 merge、不执行最终 broad gate/正式 L3/push。
- 获批后完整读取 `/Users/visionclaw/coding-harness/skills/development-workflow/references/final-integration.md` 及其 operative contract `/Users/visionclaw/coding-harness/skills/development-workflow/assets/final-integration-contract.md`，在当前宿主工作区同步 origin/main、重算 final_target_base 责任，复用有效证据并补缺口，最后普通 fast-forward push 到 main，不 force push。push 前目标前移或 push 因竞态被拒绝时，保留证据，报告新旧 target 与变化，更新具体 final gate 方案并重新取得用户确认后才同步和补验；不自动追赶、不覆盖他人提交。
- 回退边界是 Task 1–3 的前端改动；不 down migration。任何新增产品行为或后端协议变化超出本 Plan，先修订并重新批准契约。
