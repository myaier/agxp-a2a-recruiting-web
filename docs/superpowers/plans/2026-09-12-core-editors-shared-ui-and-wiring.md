# 核心编辑页展示统一与前端接线 Implementation Plan

> **For agentic workers:** 按 Task index 实际调用对应 skill：Claude Code 使用 superpowers:subagent-driven-development；Codex 使用 superpowers:executing-plans。复用当前工作区，逐项勾选，实施留给新 session。

**Goal:** 修复日常作品集和跨招聘类型薪资接线，并让两种数据模式实际使用符合原 Mock 样式的同一展示组件。

**Architecture:** 只提取六个具体展示文件，沿用页面 CSS 和基础控件。现有页面/数据源承担请求、目录身份、草稿、会话与保存；模拟数据在 Mock 外层驱动相同展示。冻结原页面和样式作为非运行对照，不建立通用表单或目录树。

**Tech Stack:** React、TypeScript、CSS Modules、现有应用 Context、Vitest/Testing Library、Playwright；不新增依赖或测试平台。

**Spec:** `docs/superpowers/specs/2026-09-12-core-editors-shared-ui-and-wiring-design.md`。用户批准设计 v1.0：revision `ca0eaab7ff14811cff1dbda6ff9eb1f0c6f7d9e5` / blob `ee5b3db60116fbf61f99eb4ec579c2aee1d89cd8`。仅审批元数据更新后的执行载体：revision `f64e5e13541e3a3159d7b74944fbf2bfdf09a282` / blob `860e4944d5028762446b82653615443d0c89cda6`，第1–7节与获批版本逐字相同。用户批准语：“可以，继续写0上下文计划，claude review和执行提示词”。Plan 版本由最终执行提示词钉住，不引用工作树最新内容自证批准。

## Global Constraints

- 仓库 `myaier/agxp-a2a-recruiting-web`，工作区 `.`，拟合入 `origin/main`；本规划不 fetch/merge/push。正式 target 与操作在实施 final gate 中具体展示。完整读取 `CLAUDE.md`、`AGENTS.md`。
- 前端审查/Mock 冻结基线 `3ad5d4bf3efff659ebd01188e956000ae5655f9d`。后端只读合同 `agxp-monorepo@bc9d84f87e8537979c70cb8094f2a3378a13995c` 的 `apps/recruitment-bff/openapi/mobile-v1.yaml` 与 `apps/recruitment/openapi/mobile-resources-v1.yaml`；执行环境定位仓库，禁止固定规划机器路径。代码基线变化须先核对本任务依赖及合同，不盲目覆盖已存在实现。
- 用户允许按原 Mock 改造新共用组件，原代码保留对照；两种模式都必须迁移。允许的变化仅 Spec §5：城市行政分组并移除 A–Z，已有候选/多级分页，附件已有动作与确认，岗位既有结构化确认。不得改 PM 未批准的布局、基础组件外观或新增视觉机制。
- 共用组件不得依赖数据源模式、BFF DTO、Context、API、路由或存储。props 只有展示值、稳定键、状态与回调；页面外层闭包保留真实目录引用/文件 ID，禁止按名称反查。
- 不改变 BFF schema、CAS/幂等/会话保护、onboarding 事务或真正保存时机。Mock 不发真实请求，也不伪造解析结果。实习转正服务端字段、年薪月数 UI、关键词等已删除入口均非目标。没有当前用例，不引入通用树/表单、全局模拟后端、能力注册表或新配置。
- 六个新文件放 `src/组件/`，分别为 `备选城市选择正文.tsx`、`岗位职业分类正文.tsx`、`教育目录候选列表.tsx`、`简历行业选择正文.tsx`、`期望行业选择正文.tsx`、`简历附件区.tsx`。直接导入本轮原页面 CSS；不为移动 import 改写 CSS，不另建一套样式。岗位确认已有共用表单，直接消除模式条件，不额外造组件。
- 外层 Mock adapter 留在对应页面：用现有本地目录作种子，稳定模拟键与名称分离；只为本轮分页/展开/附件演示增加局部状态，不建立跨页 Mock service。共享展示内部不含 fixture。Mock 目录不承诺对应真实 ID。
- 默认不删除整个文件。新增组件接线后删除页面内被替换的重复 JSX；保留必要的两模式控制函数。已有 `选工作城市.tsx`、`选期望职位.tsx` 不重写，只回归。未知目录深度或状态无法由已批准控件承载时，列页面、输入、控件缺口供 PM 决策；继续无依赖任务，不能截断数据或自主设计。
- 任务逐项提交，只 stage 本任务文件；不 stash/reset/clean、不创建第二用户工作区、不改他人内容。实施开始用逻辑 skill `development-workflow` 的根相对 `scripts/task_intents.py start` 登记；扩大路径前 update 并检查重叠。
- 每个 brief 与本节、批准 Spec 一起交付给执行者。下述接口是具体页面契约，类型局部导出供测试使用；不是公共领域模型。等价内部 helper 可调整，外部行为/接口/覆盖义务不得自行改变。文档不预写全部内部 JSX。

## Task index

Task count: 8
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

按 1→8 顺序执行；同批文件共享写入，不并行改 `工作经历.tsx` 或 `e2e/数据源模式.spec.ts`。Task 2 无业务前置；Task 3–8 依赖 Task 1 的冻结对照；Task 5/6 接续 Task 1 的页面修改，Task 6 接续 Task 5。不存在需要另行合入的共享基础包，组件与全部真实消费者在各自同一 Task 交付。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|作品集三态及冻结对照；涉及失败水合、建档保护|Top 5–10（Claude Code: sonnet）；边界已冻结|前沿 / 顶级模型（Claude Code: opus）；核对不丢数据|前沿 / 顶级模型（Claude Code: opus）；检查写入与恢复耦合|
|2|意向薪资映射；独立的最终类型判定|Top 5–10（Claude Code: sonnet）；局部改动|Top 5–10（Claude Code: sonnet）；类型矩阵明确|Top 5–10（Claude Code: sonnet）；避免扩大重写|
|3|备选城市共用正文；依赖1快照|Top 5–10（Claude Code: sonnet）；复用已有查询钩子|Top 5–10（Claude Code: sonnet）；视觉例外明确|前沿 / 顶级模型（Claude Code: opus）；分页与引用身份|
|4|岗位分类与确认；依赖1快照|Top 5–10（Claude Code: sonnet）；已有控件提取|前沿 / 顶级模型（Claude Code: opus）；legacy 与 wire 语义|Top 5–10（Claude Code: sonnet）；隔离展示和状态|
|5|教育候选列表；依赖1及当前工作经历页面|Top 5–10（Claude Code: sonnet）；两种候选复用|Top 5–10（Claude Code: sonnet）；引用失效边界|Top 5–10（Claude Code: sonnet）；复用现有查询|
|6|简历行业层；依赖1、5|Top 5–10（Claude Code: sonnet）；具体三层列表|Top 5–10（Claude Code: sonnet）；选择与展开|Top 5–10（Claude Code: sonnet）；禁止通用树|
|7|意向行业正文；依赖1快照|Top 5–10（Claude Code: sonnet）；保留现有保存时机|Top 5–10（Claude Code: sonnet）；三项上限与同名ID|Top 5–10（Claude Code: sonnet）；分页状态边界|
|8|附件共用区与Mock模拟；依赖1快照|Top 5–10（Claude Code: sonnet）；复用已有动作链|前沿 / 顶级模型（Claude Code: opus）；同意门与真实ID|前沿 / 顶级模型（Claude Code: opus）；异步隔离与清理|

**计划本身复杂度：高。** 多个页面、目录状态及附件交互需要联合验证；没有新协议或架构。

**零上下文漂移风险：中。** 设计例外和接口已明确；现场目录版本、旧测试假设及附件动作迁移仍需判断。执行模型只按漂移风险使用当前可用的行业 Top 5–10 中高性价比模型；角色表单独提高高风险 review 档位。Claude alias 只由 Claude Code 解析，Codex 按 host-native 通用档位执行。

## 冻结对照清单与取证

Task 1 在修改运行代码前创建下列 11 个文件。目标统一为 `docs/design-references/2026-09-12-core-editors/` + 下表源路径 + `.txt`；目标路径由此精确确定，逐项 `git show <前端基线>:<源路径>` 原样写入，`git hash-object <目标>` 必须等于所列 blob。不是复制当前已修改文件。没有额外 README、旧版入口或对比路由。

|源路径|新增目标路径|基线 blob|
|---|---|---|
|`src/屏幕/工作经历.tsx`|`docs/design-references/2026-09-12-core-editors/src/屏幕/工作经历.tsx.txt`|`9f7a1c82a6037f682bfc1bb8d6a2f7266491ff43`|
|`src/屏幕/工作经历.module.css`|`docs/design-references/2026-09-12-core-editors/src/屏幕/工作经历.module.css.txt`|`3f72df01a4bd01843672492edf20f94426bef1ee`|
|`src/屏幕/我的简历.tsx`|`docs/design-references/2026-09-12-core-editors/src/屏幕/我的简历.tsx.txt`|`60aadeb3314c97b7de21b9cb3fc73f5d73971b98`|
|`src/屏幕/我的简历.module.css`|`docs/design-references/2026-09-12-core-editors/src/屏幕/我的简历.module.css.txt`|`d3ecaacb1fea4574680582a4de8581c865e20607`|
|`src/屏幕/选择城市.tsx`|`docs/design-references/2026-09-12-core-editors/src/屏幕/选择城市.tsx.txt`|`535b0f4b9a44e3de83740c95c350738a7c2a89e7`|
|`src/屏幕/选择城市.module.css`|`docs/design-references/2026-09-12-core-editors/src/屏幕/选择城市.module.css.txt`|`078dbb03963bf2c64d4fe0affdd6f3a93658125f`|
|`src/屏幕/选期望行业.tsx`|`docs/design-references/2026-09-12-core-editors/src/屏幕/选期望行业.tsx.txt`|`81903d348c3f535061024f513fd25216ac46c380`|
|`src/屏幕/选期望行业.module.css`|`docs/design-references/2026-09-12-core-editors/src/屏幕/选期望行业.module.css.txt`|`c17206b069238c4d879f9ae927484eb8ca4f5c8b`|
|`src/屏幕/发布岗位.tsx`|`docs/design-references/2026-09-12-core-editors/src/屏幕/发布岗位.tsx.txt`|`150733926af2a1c18ad76d41204da5519d0326ee`|
|`src/屏幕/发布岗位.module.css`|`docs/design-references/2026-09-12-core-editors/src/屏幕/发布岗位.module.css.txt`|`ee19efe5fc51bb9978a2640b331be32975e51065`|
|`src/屏幕/入职引导.module.css`|`docs/design-references/2026-09-12-core-editors/src/屏幕/入职引导.module.css.txt`|`45f0b509c0dd7ea939008cd2d38639243e1ec156`|

视觉证据保存在已忽略的 `test-results/core-editors/`，不提交 PNG。Task 1 先运行 `UI_CAPTURE_DIR=test-results/core-editors/before npm run ui:capture -- --grep 'candidate-resume|recruiter-post-job' --workers=1` 获取已有原 Mock 场景；各展示 Task 修改前通过既有浏览器进入该页子层补拍（城市、教育候选、行业层、分类层、附件滑动/确认）。若候选层在旧 Mock 不存在，分别记录旧 Mock 输入位置和旧 Backend 现成控件，不能用新实现截图冒充旧稿。命令失败先查环境，缺 Chrome 等前置报告；不以源码对照代替声称截图通过。

新增浏览器场景写入已有 `e2e/数据源模式.spec.ts`，复用本文件 `安装BFF路由`、`创建候选OnboardingFixture`、`创建P2附件fixture`、现有导航和请求断言。新增测试统一标题 `核心编辑 <区域> @mock` / `核心编辑 <区域> @backend`。不要提取新的全局 fixture 框架；需要分支时仅在本文件现有 option/fixture 扩展精确状态，影响原消费者时补验相关旧用例。Backend 项目走符合已审合同的网络桩，明确不是 live 验收。

每个展示 Task 的 E2E 至少实际进入两种模式入口、驱动本 Task 交互并用 `testInfo.outputPath` 留截图；在 iPhone 13 viewport 检查横向溢出≤2px、底部保存/确认不被遮挡、键盘可聚焦、无嵌套 button。按正常/选中态与旧稿对照，对新增的空/加载/错误/忙态核对现有控件；用已有 Vitest 覆盖组合状态，不制造每种状态的全套 E2E。纯组件同一 props 的 DOM 比较只证明展示确定性，还必须由页面测试/浏览器证明两模式消费它。

### Task 1: 日常作品集写入三态，冻结原稿

**目标/非目标：** 日常修改/清空真正保存；不重做简历表单、不创建日常建档草稿、不改变多分区事务。

**预期编辑文件：** 新增“冻结对照清单”的11个精确目标；修改 `src/屏幕/工作经历.tsx`、`src/数据/招聘数据源/简历.ts`、`src/屏幕/工作经历.test.tsx`、`src/数据/招聘数据源/简历.test.ts`、`e2e/数据源模式.spec.ts`。若调用方审计证实展开快照携带 URL，最小修改该调用文件并先更新 intent；不预设全部调用方要改。删除文件：无。

**必读与依赖：** Spec §6.1；`src/数据/招聘数据源类型.ts` 的 `页面简历写入`；`src/状态/后端/候选操作.ts` 的保存与失败水合；页面 `存作品集链接`、`旅程中`、`链接已改`、保存处理。审计 `保存简历` 全部调用：`src/屏幕/个人信息.tsx`、`毕业院校.tsx`、`就读时间段.tsx`、`求职状态.tsx`、`我的简历.tsx`、`选专业.tsx`、`基本信息.tsx`、`最高学历.tsx`、`工作经历.tsx`（后八个同为 `src/屏幕/`），及 `src/状态/后端/候选操作.ts`。依赖现有 revision、错误类型、规范化规则；不创造第二套 URL 校验。

**接口：** 数据源保持 `保存简历(next: 页面简历写入, previous: BFF简历, 跟踪?: 建档写入跟踪): Promise<页面简历快照>`；`next.作品集链接` 缺省/undefined=无写意图，null=清空，字符串=设置。跟踪只负责建档命令/回执，不能作为是否写 URL 的门。页面消费者以本次局部编辑意图构造 next，未编辑普通调用者省略属性。

```ts
// 只表达跨层契约；不替换已有 URL 规范化器或完整 profile 组装。
const 链接已改 = next.作品集链接 !== undefined
  && next.作品集链接 !== (旧页面.作品集链接 ?? null);
// 规范化后的无变化省略；profile 其他事实仍从完整有效的 next.基本信息组装。
```

- [ ] 写数据源失败反例：跟踪缺省、只改 URL，断言 profile PATCH body.portfolio_url 为新 URL，原姓名/身份/生日等完整保留、If-Match 为旧 profile revision，最后 GET。明确清空发 null；省略 URL 的其他资料 PATCH 不含 portfolio_url；规范化等价值不产生 URL-only PATCH。
- [ ] 写页面失败反例：日常链接设置/清空带三态；保存失败且权威水合旧 URL 后输入仍保留，可手动重试；身份空且链接脏时不得 toast 成功或离页；普通编辑不得生成建档草稿。运行 `npm test -- src/屏幕/工作经历.test.tsx src/数据/招聘数据源/简历.test.ts`，确认旧代码因目标断言失败。
- [ ] 创建并核验11个原稿快照及已有场景截图；该步骤先于任何运行代码改动。
- [ ] 页面增加独立于 onboarding 的局部 URL 编辑意图/输入，按现有用户与草稿作用域初始化，未触碰时跟随权威值；已触碰不被失败水合覆盖，退出/切换主体时清理。成功后取权威回显并清意图；失败不清。旅程路径继续从建档草稿恢复与回执，不新增双份建档事实。
- [ ] 数据源取消跟踪门：URL-only 真变化触发 profile；组装 body 仅在有 URL 意图且变化时加入该字段。保留空身份分区策略，但页面 URL 保存先沿现有求职状态入口/提示阻止假成功。审计上述调用方：无意编辑的 snapshot 展开改成显式写入形，避免旧 URL 回写。修订旧注释和相反测试，保留409/401/结果未知的原路径。
- [ ] 补 `核心编辑 作品集 @backend`：日常编辑→保存→网络桩权威回读→重新进入值不丢，再清空；检查未走 onboarding。运行上述两个文件加 `npm test -- src/状态/后端/候选操作.test.ts src/状态/后端/简历预填操作.test.ts`；执行本 Task E2E 选择：`npm run test:e2e:data-source -- --project=backend-stg --grep '核心编辑 作品集' --workers=1`。
- [ ] 核验 snapshot blob、实际请求与失败输入证据；提交本任务文件，建议 `fix: persist portfolio edits outside onboarding`。

**完成/停止：** 所有三态、保留事实、失败重试和建档回归断言通过。若空身份入口不能保留现有草稿且需新设计，或后端实合同拒绝 portfolio_url，报告具体缺口，不扩大本 Task 补后端。

### Task 2: 意向薪资按最终类型过滤年薪月数

**目标/非目标：** 只修正禁用字段泄漏，不增加 UI 或默认12薪。

**预期编辑文件：** 修改 `src/数据/后端映射.ts`、`src/数据/后端映射.test.ts`、`src/屏幕/添加意向.test.tsx`、`e2e/数据源模式.spec.ts`；读取 `src/屏幕/添加意向.tsx`，其类型切换已实现，除已有行为证明错误不改。新增/删除文件：无。

**接口/依赖：** 保持 `转意向写入(草稿: 意向草稿型, 上下文: 意向映射上下文): BFF意向写入`；内部最终 recruitment_type 计算完成后，仅 range 且 social_full_time/campus 可从原始合法 compensation 保留 annual_salary_months。其他类型及 negotiable 必须属性不存在，不写 null。原上下限、毕业月、实习月份/每周天数现有清理规则不变。独立于 Task 1 业务，但顺序提交避免 E2E 同文件竞争。

```ts
expect(body.compensation).not.toHaveProperty('annual_salary_months');
// negotiable 还需精确等于 { mode: 'negotiable' }；不能携带 lower/upper。
```

- [ ] 参数化失败反例：原社招 range/14薪→兼职有区间、→实习重新填区间不含年薪月数；→面议精确无上下限；社招↔校招合法14保留；新建无来源省略；同类型重复选择保留。页面反例通过实际类型按钮/输入触发提交，不能仅 mock mapper 返回期望值。
- [ ] 运行 `npm test -- src/数据/后端映射.test.ts src/屏幕/添加意向.test.tsx` 确认缺陷反例失败。
- [ ] 在 compensation 组装局部增加目标类型条件；使用现有 schema 约束的合法原值，不加独立 salary 类型层或重写其他映射。
- [ ] 新增 `核心编辑 意向薪资 @backend`，已有14薪意向切兼职并保存/重入，路由断言真实序列化 body 不含禁止字段。运行上述两个测试文件及 `npm run test:e2e:data-source -- --project=backend-stg --grep '核心编辑 意向薪资' --workers=1`。
- [ ] 提交 `fix: omit annual salary months for ineligible intentions`。

**完成/停止：** 五类输入及重复选择通过，其他类型条件没有回归；遇到真实合同与已审类型矩阵冲突停止相关改动并报告，不修改 YAML。

### Task 3: 其他感兴趣城市共用行政区展示

**预期编辑文件：** 新增 `src/组件/备选城市选择正文.tsx`、`src/组件/备选城市选择正文.test.tsx`、`src/屏幕/选择城市.test.tsx`；修改 `src/屏幕/选择城市.tsx`、`e2e/数据源模式.spec.ts`。读取/复用 `src/屏幕/选择城市.module.css`、`src/屏幕/城市查询钩子.ts`（`use城市默认页`、`use城市搜索`、`按行政区分组`）、`src/屏幕/选工作城市.tsx`。删除文件：无。

**接口（本文件局部类型）：**
```ts
type 城市按钮值 = { 键: string; 名称: string; 选中: boolean; 禁用: boolean };
type 备选城市正文Props = {
  搜索词: string; 改搜索词: (词: string) => void;
  位置项们: 城市按钮值[]; 热门项们: 城市按钮值[];
  分组们: { 键: string; 标题: string; 项们: 城市按钮值[] }[];
  搜索项们: 城市按钮值[]; 已选项们: 城市按钮值[];
  加载中: boolean; 还有: boolean; 加载更多: () => void;
  切换: (键: string) => void; 取消: () => void; 保存: () => void;
};
export function 备选城市选择正文(props: 备选城市正文Props): React.JSX.Element;
```

**生产/消费与归属：** 两模式页面控制都映射为该 props，正文承载标题、搜索、位置/热门、行政区或搜索列表、底部已选/保存；搜索词非空选择搜索列表，加载/分页指当前可见列表。Backend ID 映射表由外层维护并保留选中引用，不从可见页重新反查。分组按 admin1_name→country_name，均无则不入分组但热门/搜索可见。位置占位“暂未获取定位”禁用，无真实历史不编造。Mock 同样行政分组和9项上限，局部模拟位置有明确演示值。依赖 Task 1 快照。

- [ ] 改前拍城市旧稿；补组件测试：无右侧字母索引，行政标题、选中标签/9项计数，空/加载显示现有文案，列表尾分页按钮忙时禁用。页面测试在两模式入口验证同一正文可交互；ID不同但同名两城可独立选中。
- [ ] 页面边界反例：Mock 输入“杭”“hangzhou”“hang”仍命中杭州；排除主城市、最多9、取消不派发、保存才提交备选引用；搜索/翻页已选不丢，重复 ID 去重、旧搜索晚到不覆盖新搜索、版本改变重置分页；无 admin/country 的城市不能被编造分组或变为不可搜索。
- [ ] 运行 `npm test -- src/组件/备选城市选择正文.test.tsx src/屏幕/选择城市.test.tsx`，先确认缺组件/新行为失败。
- [ ] 提取原样式正文，删除 A–Z 索引 JSX；保留未使用的原 CSS 可不动，不重排其他区域。Backend 用已存在默认页与搜索钩子；Mock 分组种子复用 `src/数据/城市与行业.ts` 的 `城市字典`，不自造省份；仅移除 A–Z 分节和索引渲染，不删除 `src/数据/城市首字母.ts` 的 `城市拼音`/`全部城市` 搜索用途。搜索沿用中文名或规范化后拼音子串匹配，局部分页可切片模拟相同可见状态。不要删除其他消费者仍用的 `use城市分组`。
- [ ] 增加 `核心编辑 城市 @mock`、`核心编辑 城市 @backend`，覆盖选择→翻页/搜索→取消/保存与截图。运行本 Task 两个测试加 `npm test -- src/屏幕/选工作城市.test.tsx src/屏幕/选期望职位.test.tsx`，以及 `npm run test:e2e:data-source -- --project=mock-stg --project=backend-stg --grep '核心编辑 城市' --workers=1`。
- [ ] 核对已批准视觉差异、两入口 import 与无 Mock fallback；提交 `refactor: share alternate city selection UI`。

**完成/停止：** 同一正文消费链及城市业务边界通过；没有行政数据不发明分类，既有分页能承载。不足以展示必要状态需新控件时交 PM。

### Task 4: 岗位分类两栏共用，确认门覆盖 Mock

**预期编辑文件：** 新增 `src/组件/岗位职业分类正文.tsx`、`src/组件/岗位职业分类正文.test.tsx`；修改 `src/屏幕/发布岗位.tsx`、`src/屏幕/发布岗位.test.tsx`、`e2e/数据源模式.spec.ts`；复用 `src/屏幕/发布岗位.module.css`。删除文件：无。

**必读：** Spec §5.2/5.4；页面原 `职业分类层`、`职业分类层后端`、`职位要求步`、`结构化确认缺失`，以及真实变化与 sparse patch 判断。依赖 Task 1 快照。

**接口：**
```ts
type 职业栏项 = { 键: string; 名称: string; 选中: boolean; 可选: boolean; 有子项: boolean };
type 职业栏 = { 项们: 职业栏项[]; 加载中: boolean; 还有: boolean; 加载更多: () => void };
type 岗位职业分类正文Props = {
  根栏: 职业栏; 子栏: 职业栏;
  展开: (键: string) => void; 选定: (键: string) => void; 关闭: () => void;
};
export function 岗位职业分类正文(props: 岗位职业分类正文Props): React.JSX.Element;
```

两栏项携带所有可见选择/展开状态。`可选`源于 selectable，`有子项`源于 has_children，不能互相推导；点击沿现有行为：selectable=true 选定；否则仅在 has_children=true 时下钻，无子项的不可选项不提交。两者均真仍按现有单击选择，不发明第二种点击区；若真实需求要求同时可达选择/展开且现有控件不能承载，交 PM。更深目录沿现有右栏替换下钻；分页/迟到响应/版本由 Backend 原控制管理。Mock 职业分类表在页面映射为同一 props，以稳定模拟键驱动。原弹层标题、尺寸、两栏、勾与既有加载更多样式保持；此组件不读目录 API。

- [ ] 改前拍分类/要求页；组件与页面补根分页、右栏下钻/分页、不可选父项不能提交、同名ID、返回重新打开保留选择；两模式都消费正文。
- [ ] 补 Mock 确认失败反例：新建未确认不成功；点确认可继续；实际改经验/学历/公开要求撤销；重复点同值或改私有筛选不撤销。Backend legacy false 仅改无关字段仍可保存；校招/实习隐藏经验值按最终 wire 判断不误清。
- [ ] 运行 `npm test -- src/组件/岗位职业分类正文.test.tsx src/屏幕/发布岗位.test.tsx` 观察目标失败。
- [ ] 提取分类正文并迁移两个消费者，保留 Backend hooks 外层。共用的 `职位要求步` 直接让当前确认 label/错误提示在两模式都渲染，不新增确认组件；文案逐字保留：“我已确认经验和学历设置将作为自动匹配依据；补充要求不会被自动解析。修改上述内容后需要重新确认。”位置不变。
- [ ] 删除仅 Backend 才重置/校验确认的模式门，按当前是否新建/公开要求是否真实变化控制两模式；Mock 用页面草稿/原始岗位状态模拟，保持新建与 legacy 编辑区别。Backend mutation 仍走原稀疏 patch，不能为模拟改真实协议。
- [ ] 新增 `核心编辑 岗位 @mock` / `@backend`，新建分类→要求确认→发布与编辑公开/私有字段，留截图和请求断言。运行本 Task 两个单测文件及 `npm run test:e2e:data-source -- --project=mock-stg --project=backend-stg --grep '核心编辑 岗位' --workers=1`；既有 Mock 测试因新确认门变化时仅更新获批行为预期。
- [ ] 提交 `refactor: share job category and confirmation UI`。

**完成/停止：** 模式共用分类与确认；legacy例外和最终 wire 语义保留。如果真实目录需要现有两栏不支持的新导航，提供输入交 PM，不增加面包屑。

### Task 5: 教育学校/专业候选行共用

**预期编辑文件：** 新增 `src/组件/教育目录候选列表.tsx`、`src/组件/教育目录候选列表.test.tsx`；修改 `src/屏幕/工作经历.tsx`、`src/屏幕/工作经历.test.tsx`、`e2e/数据源模式.spec.ts`。复用 `src/屏幕/入职引导.module.css`（已有候选样式）及 `src/屏幕/工作经历.module.css`。删除文件：无。

**接口：**
```ts
type 教育候选 = { 键: string; 名称: string; 副文?: string; 选中: boolean };
type 教育目录候选列表Props = {
  项们: 教育候选[]; 加载中: boolean; 还有: boolean;
  选定: (键: string) => void; 加载更多: () => void;
};
export function 教育目录候选列表(props: 教育目录候选列表Props): React.JSX.Element;
```

**归属/依赖：** `工作经历.tsx` 的 `教育编辑页` 为学校和专业各提供该 props；输入框、词、候选显隐、选中引用、250ms查询、目录版本/迟到响应仍在原外层。学校副文沿现有城市/国家表示，专业无副文；保留原 inline 字体/颜色及列表尾加载更多。Mock 在此页面外层使用现有学校/专业演示种子，局部模拟搜索/分页，不修改独立 `毕业院校`/`选专业` 路由，不新增通用候选 hook。依赖 Task 1 URL 已实现，不得覆盖其局部状态。

- [ ] 改前拍教育输入和 Backend 候选；补空/加载/选中/学校副行/分页组件用例；页面两模式输入词、选候选可保存。Backend 同名不同ID准确提交；改输入清旧引用；未重新选有效引用不能提交；旧词迟到响应不能回填。
- [ ] 运行 `npm test -- src/组件/教育目录候选列表.test.tsx src/屏幕/工作经历.test.tsx` 确认新增契约失败。
- [ ] 从现有候选 JSX 提取一个具体组件，学校/专业在两模式都调用；Mock 模拟值只写 Mock 草稿；Backend 回调通过当前 ID map 保存引用，不在展示查 DTO，不改原输入布局。
- [ ] 增加 `核心编辑 教育 @mock` / `@backend`，输入→候选→分页→保存，拍输入及候选截图。运行本 Task 单测与 `npm run test:e2e:data-source -- --project=mock-stg --project=backend-stg --grep '核心编辑 教育' --workers=1`；工作经历文件已有 URL/onboarding 测试必须仍通过。
- [ ] 提交 `refactor: share education catalog suggestions`。

**完成/停止：** 同一候选列表支持两类数据/两模式，引用与输入失效完整；若学校必要属性超出现有主副行，报告而不自行增加标签。

### Task 6: 简历经历行业选择共用

**预期编辑文件：** 新增 `src/组件/简历行业选择正文.tsx`、`src/组件/简历行业选择正文.test.tsx`；修改 `src/屏幕/工作经历.tsx`、`src/屏幕/工作经历.test.tsx`、`e2e/数据源模式.spec.ts`。复用 `src/屏幕/工作经历.module.css`。删除文件：无。

**接口：**
```ts
type 简历行业行 = {
  键: string; 名称: string; 层级: 0 | 1 | 2;
  选中: boolean; 可选: boolean; 可展开: boolean; 展开中: boolean;
};
type 简历行业分段 = {
  键: string; 行们: 简历行业行[];
  加载中: boolean; 还有: boolean; 加载更多: () => void;
};
type 简历行业选择正文Props = {
  分段们: 简历行业分段[]; 展开: (键: string) => void;
  选定: (键: string) => void; 关闭: () => void;
  自填?: { 值: string; 修改: (值: string) => void; 确认: () => void };
};
export function 简历行业选择正文(props: 简历行业选择正文Props): React.JSX.Element;
```

**归属：** 经历编辑页把现有根/子/孙三层展开状态转换为按当前渲染顺序的分段；分段是已有列表及其分页尾部的展示批次，不是新树存储。各列表独立 busy/还有/回调保持原位置。Mock 常见行业作为模拟目录，同一正文；原 Mock 自填输入通过可选 `自填` 提供，Backend 不提供（当前真实引用不可自由文本提交）。此能力差异来自现有业务，不在组件读 mode。点击沿现有优先级：可选则选择，否则有子项才展开；两者均真不新增第二种点击控件，需要同时可达两种操作时交 PM。依赖 Task 1、5，保留同文件 URL/教育改变。

- [ ] 补组件三层缩进/现有展开控件、选中、分页忙态；页面两模式选择回填与取消不保存经历条目；Backend selectable=false 父项只展开，同名ID精确提交，搜索/输入导致旧引用失效规则保留。测试 Mock 自填仍可用而 Backend 不暴露自由文本保存。
- [ ] 运行 `npm test -- src/组件/简历行业选择正文.test.tsx src/屏幕/工作经历.test.tsx` 确认新增失败。
- [ ] 改前拍行业层；提取既有底部层正文和行，两个外层映射共同接口，不新建通用递归树、不改所属行业输入行。保留原单选关闭/回填时机、查询版本与错误轻提示。
- [ ] 增加 `核心编辑 简历行业 @mock` / `@backend`，展开→选行业→经历保存并截图。运行本 Task 单测及 `npm run test:e2e:data-source -- --project=mock-stg --project=backend-stg --grep '核心编辑 简历行业' --workers=1`。
- [ ] 提交 `refactor: share resume industry picker UI`。

**完成/停止：** 现有3层目录与单选引用正确、无新增视觉；出现更深实际目录无法表达，交 PM，不能默默截掉或把父项当叶子。

### Task 7: 期望行业推荐/手风琴/标签共用

**预期编辑文件：** 新增 `src/组件/期望行业选择正文.tsx`、`src/组件/期望行业选择正文.test.tsx`；修改 `src/屏幕/选期望行业.tsx`、`src/屏幕/选期望行业.test.tsx`、`e2e/数据源模式.spec.ts`。复用 `src/屏幕/选期望行业.module.css`。删除文件：无。

**接口：**
```ts
type 期望行业项 = { 键: string; 名称: string; 选中: boolean; 可选: boolean; 可展开: boolean };
type 期望行业组 = {
  键: string; 标题: string; 层级: 0 | 1 | 2; 已展开: boolean;
  项们: 期望行业项[]; 加载中: boolean; 还有: boolean; 加载更多: () => void;
};
type 期望行业选择正文Props = {
  已选项们: 期望行业项[]; 推荐项们: 期望行业项[]; 分组们: 期望行业组[];
  根加载中: boolean; 根还有: boolean; 根加载更多: () => void;
  展开: (键: string) => void; 切换: (键: string) => void; 返回: () => void; 保存: () => void;
};
export function 期望行业选择正文(props: 期望行业选择正文Props): React.JSX.Element;
```

**归属/依赖：** 页面外层控制3项上限、目录根/子/孙分页和展开；已有推荐根条目不可选时点击走展开，不混成写入。稳定 ID 同名分离；已选不依赖当前可见项。标题计数、推荐、现有手风琴/标签/底部共用。与城市不同，本页沿原业务选择即写意向草稿，保存负责返回；不把它改成取消回滚新事务。Mock 原行业表模拟同样目录行为。依赖 Task 1 快照；不消费 Task 6 的专用单选接口。

- [ ] 改前拍行业页面；补组件推荐/分组/选中/加载/分页状态；页面两模式点击多选与第四项上限，已选项移除；同名ID不覆盖，非selectable父项不可写，翻页和重开已选保留；错误不回退 Mock 数据。
- [ ] 运行 `npm test -- src/组件/期望行业选择正文.test.tsx src/屏幕/选期望行业.test.tsx` 确认新契约失败。
- [ ] 提取共同正文，移除原按显示名决定身份的展示接口；原两模式外层负责 ID→引用/名称映射与保存归属。逐层展开沿现有层级与样式，不复用 Task 6 单选组件强造通用配置。
- [ ] 增加 `核心编辑 期望行业 @mock` / `@backend`，推荐/展开→选3→返回重入并截图；运行本 Task 单测及 `npm run test:e2e:data-source -- --project=mock-stg --project=backend-stg --grep '核心编辑 期望行业' --workers=1`。
- [ ] 提交 `refactor: share preferred industry selection UI`。

**完成/停止：** 两消费者与原即时草稿保存行为保留，目录身份不丢；需要新导航呈现更深层时停止该能力交 PM。

### Task 8: 简历附件区共用与 Mock 动作模拟

**预期编辑文件：** 新增 `src/组件/简历附件区.tsx`、`src/组件/简历附件区.test.tsx`；修改 `src/屏幕/我的简历.tsx`、`src/屏幕/我的简历.test.tsx`、`e2e/数据源模式.spec.ts`。复用 `src/屏幕/我的简历.module.css`、`src/组件/滑动行.tsx`、`src/组件/确认层.tsx`，不修改基础控件。读取 `src/状态/后端/附件简历操作.ts` 的原动作/会话边界。删除文件：无。

**接口：**
```ts
import type { 滑动操作 } from './滑动行';
type 附件展示行 = { 键: string; 名称: string; 说明: string; 操作们: 滑动操作[]; 打开: () => void };
type 简历附件区Props = {
  行们: 附件展示行[]; 可添加: boolean; 忙: boolean; 添加: () => void;
  展开键: string | null; 请求展开: (键: string | null) => void;
};
export function 简历附件区(props: 简历附件区Props): React.JSX.Element;
```

**归属：** 标题/＋、现有空态、PDF行、说明、箭头、滑动容器均共用，调用原 `滑动行`。文件 input、待授权文件/动作、确认层、preview、错误、锁留页面外层；确认层同一调用结构由待处理动作提供 props，不维护两套 modal JSX。Backend 操作闭包捕获真实 file ID，不因重排变为数组 index；原轮询、权威刷新、会话代际及 Blob URL 清理保留。

Mock 模拟状态留 `我的简历.tsx` 局部控制：以原 Mock 附件名称作为首条；最多3条（与既有附件上限一致），本页生命周期内添加、替换、删除、parse状态可观察；离页后允许回到演示初值，不宣称持久化。选择文件后沿现有验证和同意步骤，确认前无变更；替换保留点击目标身份并重置解析状态；模拟解析可从 not_started→processing→succeeded，使用局部受清理的异步状态，测试注入 failed，不生成内容/PDF。缺真实PDF使用既有原型预览提示。无需模拟HTTP/CAS/解析服务。

- [ ] 改前拍原附件行与 Backend 滑动/确认层；组件覆盖0/1/3行、busy禁操作、状态说明与点击目标；页面两模式添加/替换/删除/解析调用相同可见结构。
- [ ] 失败反例覆盖 Backend 授权前零上传/parse请求、取消无 mutation、失败仍保留权威行、替换/删除所点真实ID、主体切换后迟到响应不更新新用户、忙时不能重复提交。解析动作矩阵：not_started有解析、failed有重试、pending/processing/succeeded无额外解析；替换/删除沿已有锁规则。Mock 同意/取消/上限/替换目标/模拟状态/预览提示验证且真实请求数为0。
- [ ] 运行 `npm test -- src/组件/简历附件区.test.tsx src/屏幕/我的简历.test.tsx` 确认新增缺口失败。
- [ ] 提取附件展示、迁移两个消费者；Mock 外层按上述生命周期模拟，Backend 原动作不复制到新 service；保留 input reset、回读/轮询清理与同意门，删除旧 Mock 单独附件按钮分支。
- [ ] 增加 `核心编辑 附件 @mock` / `@backend`，添加→同意→替换→解析→删除并截图。Backend 复用现有 `创建P2附件fixture` 和文件选择机制。运行本 Task 单测加 `npm test -- src/状态/后端/附件简历操作.test.ts`，以及 `npm run test:e2e:data-source -- --project=mock-stg --project=backend-stg --grep '核心编辑 附件' --workers=1`。
- [ ] 提交 `refactor: share resume attachment UI across data modes`。

**完成/停止：** 动作矩阵、同意/失败/主体隔离通过，两模式结构与原稿可核对。现有控件无法承载必要状态时提供具体缺口；不造上传进度条、解析内容或新模态设计。

## 实施后收尾（不计入 Task count）

全部编号 Task 与宿主执行 skill 要求的宿主内全局 review 完成后，退出 Task 循环；没有该要求就不额外加全局 review。本节由同一实施者完成，覆盖默认 finishing-a-development-branch，不开合入菜单，不在异构 review 后重新回到 Task/global review。

- [ ] 冻结实现候选与准确 base/head，按宿主发现对应异构只读 review-loop：Codex→Claude，Claude Code→Codex。绑定上述用户批准 Spec 原版与仅元数据更新载体、最终 Plan 版本、差异范围和已有证据；每轮读取逻辑 skill 根相对 `../_shared/review-contract.md`。reviewer 不运行测试，不改文件；按该 skill 裁决、修复与停止，轮间只做修复相关单元/静态检查。记录实际 reviewed commit，后续修复不得冒称已 review。
- [ ] 然后完成下面“测试选择”中的最小完整受影响覆盖；本仓库没有 `tools/test affected`，不得调用后端入口替代。以实际变更/消费者/fixture影响记录 selection、命令、candidate、结果及既有 runner receipt；有效 Task PASS 可复用，变更使其失效才补。无缺口且 review允许交付才说 ready。
- [ ] 只读 fetch/ls-remote 取得 pre-gate target SHA，展示具体 final gate：候选、target、已通过与可复用证据、需要增补的命令、正式 live责任、账号/环境、cleanup、merge/push范围与风险。这里等待用户对具体方案明确批准；规划批准及复制prompt不是此批准。确认前不合 target、不跑正式 L3、不 push。
- [ ] 获批后完整读取逻辑 skill `development-workflow` 根相对 `references/final-integration.md`，执行其同步/证据规则：记录 final_target_base，merge target，按最终diff重算完整责任；原候选/基准/依赖/环境及证据有效时零个 L0–L2 runner，变化仅补失效或新增项；正式 development L3 完成后检查cleanup影响，再对账。范围内修复自主继续、只补失效证据，不再异构review；产品契约变化、资源权限缺失或target race需报告。
- [ ] 最后核对target未推进，以普通 fast-forward push合入；禁止force push。race或拒绝保留证据并更新具体方案后重新确认，不无限追赶。更新task intent completed及真实合入结果；无live环境记BLOCKED，不能声称完整验收或已合入。

## 测试选择与权威责任

1. **防止什么：** 两处错误序列化/草稿丢失；目录真实ID、异步版本/分页与选择身份；附件授权/锁/主体隔离；两模式真正共享DOM且仅有获批视觉差异。单元/页面断言负责状态矩阵，双模式浏览器负责入口/布局，live负责真实持久化，不互相替代。
2. **最小开发反馈：** 各 Task 已列精确 Vitest 与 E2E grep；先失败反例再实现。静态使用 `npm run typecheck`、`npm run lint`；最终构建 `npm run build` 已含 `tsc -b`，同一有效候选不为仪式重复单独typecheck。新增组件须通过现有编译、lint，无新增依赖；全仓既有入口强制其范围时如实说明，不能换成空选择。
3. **提前验证边界：** Task 1/2 当场断言实际请求体/If-Match与回读；Task 3–7分页/目录引用在页面与Backend网络桩验证；Task 8当场验证授权前无请求及主体切换。没有数据库/SQL/后端事务变更，不启动后端测试。若这些桩无法表达实际序列化/权限故障，应指出命题与最小验证需求；不等收尾才首次检验，也不提前运行正式live final gate。
4. **最终范围与权威入口：** 异构 review 后汇总实际受影响最小选择。初始责任是上述6个新组件test、`工作经历/选择城市/添加意向/发布岗位/选期望行业/我的简历`页面test、`后端映射`、`招聘数据源/简历`、`状态/后端/候选操作/简历预填操作/附件简历操作`及已共享城市/职位消费者；有有效PASS不整批重跑。E2E初始责任为 `npm run test:e2e:data-source -- --project=mock-stg --project=backend-stg --grep '核心编辑' --workers=1` 中对应新增用例，Task有效结果可复用。若修改共享fixture，核对原受影响用例，增加其精确标题选择而非全文件全suite。`npm run lint`与`npm run build`在最终候选各保留一次有效证据，构建产物中不含冻结快照。UI原稿与双模式截图人工对照记入本Plan进度，不只做字符串快照测试。
5. **现有证据/成本：** 规划旧基线8个相关测试文件371项通过（17.46秒），URL-only无PATCH、14薪跨类型泄漏已复现；不能当新实现通过。新用例、构建、浏览器和live耗时未知，不为估时先跑完整套件。本次文档规划不运行产品测试。

**正式集成责任：required。** 实施者承担 final gate 获批后的真实验收，入口 `docs/dogfood/真实后端行为验收.md`，选 B02 的候选简历编辑/附件与 B04 的岗位编辑相关节点，并补“日常作品集设置/清空→保存→刷新”“已有14薪意向改兼职/实习及面议→保存→重入”。不把节点通过说完整B02/B04通过，不启动H系列或发布full sequence。执行前核实实际目标URL、frontend/backend版本、专用账号、安全材料和清理归属，按该文档用agent-browser真实UI操作；不通过直写API替代用户流程。证据包含输入前态、关键交互/请求、刷新后态、错误与cleanup结果，用现有dogfood产物/模板，不新建规划交付文档。缺环境前置记录BLOCKED；selection_gap仅可针对现场无法匹配节点的明确部分，由同一实施者提供精确替代观察方案，不能跑全部L3或写PASS。

## 文档审查与执行记录

规划自检：Spec §4对照与展示边界→全局/Task1及3–8；§5各展示→Task3–8；§6接线→Task1–2；§7分层验收/停止条件→各Task及收尾。无额外产品设计、后端变更或通用框架。

Claude 文档 review 已完成1轮（Opus/high，plan权限，WORKFLOW_DOCUMENT_REVIEW）。受审候选 revision `7b8caf5dcf9a2940f602ed8ab6bcacf886121869`，Plan blob `39b6d84b8699ea6d841fc57dd1233555b9ae65ef`，Spec审批载体与本Plan header一致；批准契约仍为原 v1.0。review前后 status、HEAD、两份文档指纹一致，未执行测试、未改文件。报告另含源码符号/命令存在性核验，不作为实现代码review或产品验证通过证据。

|Finding|核实与裁决|最终状态|
|---|---|---|
|Minor / 真实缺陷 / required / 复杂度不变：Task1类型定义路径错误|核对 `页面简历写入` 实际定义于 `src/数据/招聘数据源类型.ts:41`，已修正必读路径|接受并修复；批准契约不变|
|Minor / 契约违反 / required / 复杂度不变：Task3可能误删拼音搜索，Mock行政种子不明确|核对原页面确有中文/全拼/拼音子串搜索；明确保留搜索用途、行政分组取现有城市字典，并增加“杭 / hangzhou / hang”回归断言|接受并修复；只澄清删除A–Z展示边界，批准契约不变|
|Minor / 可选增强 / optional / 复杂度降低：建议删除intent登记及final-integration引用|用户明确选择development-workflow，其执行合同要求这两个步骤；这不是本Plan额外自创机制，删除会违反父流程|拒绝，不改变已批准工作流|

结论：两条有效required已由planner核实并局部修复，未解决required为0；按review-loop停止规则结束。本次不是Claude原始NO FINDINGS，也未声称修订后再次复审。修复范围仅类型路径、Mock搜索/种子说明与相应断言、此裁决记录；未改Spec设计正文。实施者后续仅在此记录实际进度/证据/偏差，不改写已批准版本以自证合规。
