# 前端测试分层与 Suite/Case 整理实施计划

> **For agentic workers:** Claude Code 按 Task count 路由到 `superpowers:subagent-driven-development`；Codex 实际调用 `superpowers:executing-plans`。全部实施 Task 完成后进入唯一的不计数收尾章节，不调用默认 finishing 流程。

**Goal:** 在保留有效断言的前提下，建立无需完整本地后端的三层测试入口、独立 Suite/Case、可再生成清单，并裁剪长流程和旧执行入口。

**Architecture:** 复用 Vitest、Playwright、现有 HTTP fixture 与 STG operator。按业务域拆测试和局部 fixture；原生文件/完整名称选择就是执行机制。只增加薄清单生成脚本和测试离线边界，不增加 DSL、注册服务、调度平台或缓存。

**Tech Stack:** 仓库锁定的 React、TypeScript、Vitest 4、Playwright 1.62、Vite；不升级依赖。

**批准 Spec：** `docs/superpowers/specs/2026-09-16-frontend-test-layering-design.md`，revision `c60dca14a317cb6edee246e3bfd2f818a4979e61`，blob `06a9dd7242a7b37df94c9c5a4b4137cb6080aaa2`。以该 Git 对象为契约，工作树中批准记录不改变正文。

**Repository / workspace / target:** `myaier/agxp-a2a-recruiting-web`；用户选定的当前仓库根 `.`；合入目标 `origin/main`。只读 fetch 可核对目标，人工 final gate 前不合 target、不跑正式 L3、不 push，不新建第二用户工作区。

## Global Constraints

- 中文文档；代码/命令保持既有约定。完整读取 `CLAUDE.md` 与 `AGENTS.md`，遵守最小改动与有证据才增加复杂度。
- 生产 UI、数据源/decoder、状态逻辑、后端和部署均不改；仅允许 `src/main.tsx` 的旧配置引用注释随入口改名，不改执行代码。不提高超时/重试掩盖失败，不更新像素基线。发现产品缺陷单列证据，不删除断言取得绿色。
- 单元/组件、前端浏览器 fixture、真实 STG L3 三层；前两层不依赖 Docker、完整本地后端、STG 或账号。fixture 成功不是 STG PASS。
- 文件加完整 runner 名称为 Case 标识，project/参数为变体；L3 保留公开 ID。不为所有单测发明编号。Case 独立准备，不能依赖先前 Case 状态。
- 原 280 个浏览器执行变体、全部 Vitest 叶子项逐项对账为保留/拆分/合并/有依据退役；保留 revision、幂等、隐私、迟到隔离、权威回读和跨步不变量。57 项入口重复不算独立覆盖。
- 原 18 场景、P1/展示接线采集协议和消费者继续可用；普通运行不依赖额外采集目录变量。
- 所有路径仓库相对；外部 skill 按逻辑名称发现，resources 按 skill 根目录解析。共用 review 合同为 reviewer skill 根相对 `../_shared/review-contract.md`。
- 开工调用 `development-workflow` 的 `scripts/task_intents.py start`；范围扩大前 update/检查重叠。先读其 `--help`，不猜参数；保护已有工作，不 stash/reset/clean。
- 计划允许内部 helper 等价重构，但冻结本章、下面 C1–C7 与逐 Task 覆盖义务；新增生产行为、层次或测试执行机制不是内部实现选择。

## Task index

Task count: 6
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

串行顺序 1 → 2 → 3 → 4 → 5 → 6。相邻 Task 共享 fixture/入口/清单，串行更简单；Claude 的子代理按 Task 顺序执行，不在同一工作树并发修改。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|先补离线边界并统一浏览器入口|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|2|按域抽取 fixture；依赖 1，原 spec 仍可运行|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|3|业务 Suite 与长 Case 拆分；依赖 2|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|4|第一层四个大文件分域与定向计时|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|5|薄清单生成与长期测试文档；依赖 1–4|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|6|旧 local 执行入口退役与断言归档；依赖 5|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|

角色理由：1–3 需判断跨域状态、路由覆盖顺序与错误语义，4 涉及 mock 提升/异步生命周期，实施漂移风险较高；5–6 输出合同明确，实施档位可降低，spec reviewer 仍需核查完整性。Codex 使用宿主当前模型与通用档位，不解析 Claude alias；角色表不要求 Codex 另建 Task reviewer。

**计划本身复杂度：高。** 影响共享 fixture、多入口、四个大测试模块及文档，验证消费者较多。

**零上下文漂移风险：高。** 存量 Case/fixture 深度耦合、真实耗时未知，拆分时需识别独有不变量与隐式前置。执行模型只按漂移风险选择：当前可用的行业顶尖模型。计划通过精确迁移与停止边界降低风险，不以模型档位替代契约。

## 现状、开工核验与成本

产品基线 `e01291de47e4ade2b66ab681e69145e6e32bade8`；批准 Spec 的提交在其之上。本 Plan 不授权回退当前 checkout。开工保存 HEAD/status 和测试收集结果，核对之后的新增测试；新增内容同样纳入对账，不硬套旧数字。

旧默认 `playwright.config.ts` 收集 81，数据源配置收集 256；按文件+完整名称+语义变体去重 280。`数据源模式.spec.ts` 162，其他七个文件 118。旧两个 project 名的差异本身不是业务变体：同一 Mock Case 在两个配置重复运行应映射到一个新 Mock Case。

当前没有匹配本基线的完整逐 Case 耗时；不把 120–240s timeout 当耗时。旧对齐 Spec 的失败运行 245.7s/597.4s 仅供历史解释。本 planner 没有执行测试。实施前定向采样，最终比较同风险集合和固定 worker/环境，报告单 Case 和 Suite 墙钟；阈值只用于调查：第一层 >1s、浏览器 >10s、常用 Suite 约 >60s，不新增硬门禁。

原生收集基线（不启动浏览器/后端）：

```bash
npx vitest list --json
npx playwright test --list --reporter=json --config=playwright.config.ts
npx playwright test --list --reporter=json --config=playwright.数据源模式.config.ts
```

原始报告/计时写入已忽略的 `test-results/test-layering/`，不提交机器路径。执行者若发现当前 Vitest list JSON 形态不同，查看本机 CLI `--help` 与已安装包；不安装新依赖。旧视觉采集 spec 导入时要求目录并建目录，Task 5 消除此副作用之前不把它加入无副作用收集。

## 冻结契约

### C1. 入口、项目与选择

| 命令 | 最终含义 |
|---|---|
| `npm test -- <file> -t '<regex>'` | Vitest 原生文件/完整名称选择；无参数是第一层全量 |
| `npm run test:e2e -- --list` | 唯一浏览器功能配置的完整去重选集 |
| `npm run test:e2e -- --project=fixture <file> --grep '<regex>'` | HTTP fixture 子集 |
| `npm run test:e2e -- --project=mock <file> --grep '<regex>'` | Mock 浏览器子集 |
| `npm run test:e2e -- --project=annotation` | 标注构建子集 |
| `npm run test:e2e:data-source -- <原生参数>` | deprecated 完全别名，直接执行同一 `playwright test`；不是第二份配置，不与全量入口连跑 |
| `npm run ui:capture` / `npm run ui:check` | 既有专用视觉入口与 PR 消费协议 |
| `npm run test:list` | 在 stdout 输出稳定 Markdown Case 清单；不写文档、不跑测试 |
| `npm run test:list -- --write` | 全部收集/校验成功后只更新 `docs/testing/cases.md` 的自动区 |
| `npm run test:list -- --check` | 只比对自动区是否过期；不同/收集失败非零退出，不写文件 |

唯一功能配置为 `playwright.config.ts`，三个项目：`mock` → 4181、`fixture` → 4182、`annotation` → 4183。沿用严格端口、禁止复用不明服务、显式 `VITE_DATA_SOURCE`/`VITE_BACKEND_ENV=stg`/标注开关，构建环境不表示使用真实后端。

选择规则：fixture 只选 `@backend`，annotation 只选 `@annotation`；mock 选剩余功能 Case（含原无标签 onboarding/抽屉/换壳）。禁止一个叶子同时携带 backend 和 annotation；视觉目录和 Vitest `.test.*` 不进功能配置。沿用 UTC 缺省及各 Suite 已有 Asia/Shanghai，设备/角色/视口覆盖不丢失。P1/展示接线采集留在各自原文件与 Mock 选集中，每个变体仅一次，避免本轮再搬一套采集体系。三个 Vite 服务同一 invocation 内共享启动即可，不为按 project 少起服务设计动态管理器。

旧 `playwright.数据源模式.config.ts` 删除；旧项目名与 4173 不再是活动指引。历史文档保留历史命令，不批量改写。完整 Case 选择的正则须转义标题元字符；文件名/标题包含空格时按 shell 参数正确引用。

### C2. fixture 入口与行为

公共入口从旧 spec 提取到 `e2e/fixtures/bff/安装BFF路由.ts`，保持既有调用形态：

```ts
export async function 安装BFF路由(
  page: Page,
  选项: BFF路由选项,
): Promise<{ p6: P6FixtureState; p4: P4发现fixture形 | null; p7: P7FixtureState | null }>;
```

`BFF路由选项` 的必填 `记录目录请求`、`登录尝试id`，以及已有覆盖/请求记录、登录状态、角色、组织、招聘 onboarding、P2/P3/P4/P5/P6/P7/P8、候选 onboarding/实名选项名称和语义保持。类型精确形状以产品基线 `e2e/数据源模式.spec.ts` 的原声明为源，不改 DTO 或放宽 decoder。

跨域共享状态由一次安装创建，显式传递原对象引用：P4 委托与 P5 连续记录、P5 handoff 与 P7、P8 举报与 P3 屏蔽不得复制成互不相干的状态。候选 onboarding 先于普通 resume/intentions 路由；自定义覆盖先于域 handler；域内部 path/method 顺序与请求记录/multipart 字节/版本/幂等检查保持。

每个域模块同时持有其样本/状态工厂和路由处理逻辑，薄装配入口按固定顺序调用。局部函数返回是否处理即可，不建立类层次、registry、插件发现或通用路由 DSL。模块内 helper 名和闭包组织可等价调整；外部工厂/选项和消费者断言不可偷换。

### C3. 离线请求边界

新增 `e2e/fixtures/离线边界.ts` 和 `e2e/fixtures/test.ts`，利用现有 Playwright fixture 在导航前为浏览器 context 安装最末级业务 HTTP/WS 防漏边界，普通 spec 从后者导入 `test/expect`。业务路径判定为 URL pathname 的前两个非空路径段依次为 `api`、`v1`（其后为空或继续以斜杠分段），包含 query、下载和事件流，不限制为某个 hostname。

Task 1 先建立该边界，再执行任何功能浏览器业务 Case 或计时；不在旧未保护入口采样。独立视觉采集 spec 在 Task 5 接入同一边界并立即验证，在此之前不执行视觉采集：功能项目名直接映射同名模式，视觉配置现有空项目名仅在该配置对应文件中取 `mock`；其他未知项目名显式失败，不加可配置模式注册机制。

冻结最小接口：

```ts
export type 测试模式 = 'mock' | 'fixture' | 'annotation';
export async function 安装离线边界(
  context: BrowserContext, 模式: 测试模式,
): Promise<{ 核对(): void }>;
// 核对在 Case teardown 调用；发现未声明业务请求抛错，仅含 method/path。
```

HTTP 兜底中止并记录未声明请求；业务 WS 永不 `connectToServer`，fixture/annotation 已声明的 events/live 可用空闲本地连接，未知业务 WS 记录失败；Mock 的业务 HTTP/WS 均不允许。Vite HMR 和静态资源不受影响。已有页面级域 route 优先处理；禁止 handler 用 `continue/fetch` 绕过边界请求真实业务服务。测试程序直接用 `page.request` 访问业务接口同样禁止（它不经过 browser route），原本探测本地根页面的可达性 skip 在 Task 1 删除，以 runner webServer 就绪为准。

P7 原事件桩保留帧/断线控制，但只替换业务 WebSocket，非业务连接透传原浏览器实现；不屏蔽 Vite HMR。测试自行 `browser.newContext` 时显式安装同一边界、finally 核对并关闭，不假定默认 page 的保护覆盖第二 context。

旧通用 `200 + null` 兜底移除：有意测试缺资源/解码错误的场景须对准确 path/method 声明对应空/错误响应；不得用全局“允许未知请求”白名单吞缺口。离线保证止于测试进程，不修改生产代理目标或业务代码。

### C4. Case 拆分与保留的链路

| 原责任 | 新独立 Case 责任；不可丢失断言 |
|---|---|
| P3 隐私主链路 | 披露读改回读；组织屏蔽→解除；岗位硬条件编辑。各自初始化账号/资源，保留取消零写、revision、真实目录 ID |
| P6 双端全链路 | 候选创建提案→确认；候选编辑→替换；候选归档；招聘创建→确认→暂停/恢复。跨操作的版本链和物化仅发生于 accept 保留 |
| JD 导入大链路 | 授权/提交/轮询/建议合并；使用导入建议仍须真实目录与确认后发布。后者用合法已完成导入 fixture 起步，不重跑前者所有步骤 |
| 候选 onboarding 大链路 | 每类产品路径保留必要完整接线冒烟；教育恢复、头像 unknown、首次意向唯一性保持独立异常 Case；目录/日常编辑不重复完整建档 |
| 附件维护 | 保留上传→替换→原件/解析版本归属→删除的必要关联；解析失败重新授权独立 Case |
| 连续委托/Case | 保留受理后同卡、未知写入跨刷新核对、隐私边界、S0→S1 来源与终局，不拆成无关联快照 |
| 第一层竞态 | 同词/改词、页面换代、未知提交重放等一个完整竞态可保留长 Case；说明理由，不按行数硬切 |

拆后的初始数据必须能被生产 decoder 合法消费，且不直接伪造要验证的结果。若通过 fixture 直接进入目标页，则仍实际执行目标交互与写入/回读。慢等待优化只改测试：定时行为用受控时钟并断言阈值；其他异步用可控 Promise/可见条件；不全局替换 userEvent 或降低交互真实性。

### C5. 目录与清单输出

唯一长期入口 `docs/testing/README.md`：三层、Suite 目录、命令、扩展方法、风险覆盖迁移表、成本观察及旧 L3 未承接清单。`docs/testing/cases.md` 使用以下标记限定生成区，外侧手写 L3 索引保留：

```text
<!-- BEGIN GENERATED CASES -->
...原生 runner 全部叶子项生成的表格...
<!-- END GENERATED CASES -->
```

生成脚本 `脚本/测试清单.mjs` 只包装三次只收集调用：Vitest list JSON、唯一 Playwright 功能配置 list JSON、视觉配置 list JSON。包括 `.test.mjs` 工具测试；不以正则扫描 `test(` 代替参数展开后的真实清单。不生成第二份持久化 manifest。列为层/Suite、逻辑标题、project/参数执行变体、相对源码链接、可执行文件+名称选择坐标；无有效计时写“未知”。可折叠每 Suite 的明细，仍必须包含每个叶子。

内部最小数据形状冻结为 `{ layer, suite, file, titlePath, project, location }`；`file` 归一为仓库相对 POSIX 路径，`titlePath` 为完整名称数组，project 不适用时为空串，location 为行/列。身份键是 layer+file+titlePath+project，行号只是导航不充当去重键。业务参数若 runner 只体现在标题，保留展开标题，禁止猜测/抹除变量部分来合并；逻辑族用最近 describe/参数化声明的现有上下文呈现，无法无歧义识别时保持独立而非发明 ID。

第一层按固定路径前缀分类：`src/数据/`→数据契约/映射；`src/状态/`→状态；`src/流程/`→流程；`src/屏幕/`、`src/路由/` 及精确文件 `src/应用.test.tsx`→页面/接线；`src/组件/`→组件；`src/配置/`、`脚本/`、`e2e/视觉回归/` 中的 Vitest 文件→配置/工具。保留子目录、模块与 describe 作为可选择子 Suite；不把前缀目录下非 runner 收集的文件加入清单。浏览器按 C6 文件表及其补充映射；新增未映射文件或重复身份非零失败，提示最小补映射。排序不使用 locale/time/random；Markdown 单元格转义换行、管道、反引号；路径不能越出仓库。普通 `test:list` stdout 只含文档；工具诊断走 stderr。任一收集非零、JSON不合法、空集合或身份不明，停止且不覆盖原文档；`--write` 在完整渲染成功后一次更新，不写半成品。无服务启动/认证/网络，导入阶段不建截图目录。

### C6. 精确 Suite 文件迁移

原 `数据源模式.spec.ts` 的所有顶层 describe/叶子按下表归属；相同前缀的 Mock/Backend 一起搬，保留标签。表未单列的 picker/catalog-fullscreen 统一归交互文件；漏项在迁移对账中报错，不能只迁已读过的 Case。

| 新文件 | 原 describe/责任 |
|---|---|
| `e2e/suites/登录与数据源.spec.ts` | Mock 数据源回归；登录区号；Backend 数据源 fixture |
| `e2e/suites/招聘组织.spec.ts` | P1C 招聘组织；企业名片/公开页（嵌套在原 P1C 中） |
| `e2e/suites/隐私与实名.spec.ts` | P3 主链路/恢复/Mock 隔离；候选实名与 Mock 实名 |
| `e2e/suites/Agent规则.spec.ts` | P6 规则域 |
| `e2e/suites/发现推荐.spec.ts` | P4 发现域及 Mock 隔离 |
| `e2e/suites/简历与附件.spec.ts` | P2 附件；核心编辑作品集/简历行业/教育/附件；候选资料编辑与个人优势 |
| `e2e/suites/求职意向.spec.ts` | 意向薪资、私有筛选要求、核心编辑城市/期望行业 |
| `e2e/suites/岗位编辑.spec.ts` | 核心编辑岗位，两模式 |
| `e2e/suites/候选建档.spec.ts` | 候选 onboarding 完整保存 |
| `e2e/suites/招聘建档与JD.spec.ts` | 招聘 onboarding；JD 导入 |
| `e2e/suites/MatchCase.spec.ts` | P5 生命周期、Mock 隔离 |
| `e2e/suites/连续委托.spec.ts` | J-PILOT-01 三场景 |
| `e2e/suites/真人消息.spec.ts` | P7 fixture、Mock 隔离 |
| `e2e/suites/账号与支持.spec.ts` | P8 fixture、Mock 隔离 |
| `e2e/suites/展示与交互.spec.ts` | 在谈详情完整布局、卡片统一、全部 picker 与 catalog-fullscreen 专题 |
| `e2e/suites/标注.spec.ts` | 两个 annotation Case |

保留其他七个现有 spec 的文件名，用完整 describe 作为子 Suite：`e2e/onboarding.spec.ts`、`e2e/J-PILOT-02接线.spec.ts`、`e2e/P1展示统一.spec.ts`、`e2e/展示字段接线.spec.ts`、`e2e/抽屉稳定性.spec.ts`、`e2e/换壳无闪屏.spec.ts`、`e2e/问AI代理展示.spec.ts`。这些文件的结构拆分无证据不扩张，但允许改导入/定位/共享准备以适应冻结入口，更新计时与去重职责。C6 是固定搬迁边界，不要求以独立风险不存在为由再抽第三层目录。

清单补充映射：`e2e/onboarding.spec.ts` 是「候选建档」「招聘建档与 JD」两个既有 Suite 的文件级并集，不创建「建档接线」第三个 Suite；叶子标题以 `walks the recruiter journey`、`publishes an internship`、`Mock 招聘剧情` 开头的三项归招聘建档与 JD，其余五项归候选建档，原 titlePath 不改，目录同时注明该文件涵盖两个 Suite。`e2e/J-PILOT-02接线.spec.ts`→连续委托；其余五个保留文件→展示与交互。`e2e/离线边界.spec.ts`→登录与数据源边界，`e2e/视觉回归/采集.spec.ts`→视觉采集。后者只由视觉配置收集，不能加进功能选集。

### C7. L3 活动/归档合同

活动总指南保持 `docs/dogfood/真实后端行为验收.md`，只列 STG 基础试点与 `stg-onboarding`，逐字保留原 STG 操作、凭据、占用/清理/隔离责任（允许调整章节引用），不改变业务步骤。现有 `stg-onboarding-candidate/recruiter` 的 manual/parsed 仍是四项，STG 基础试点仍需两轮，不能因整理减少第二轮反证。

保留旧文件路径避免历史链接断裂：`docs/dogfood/backend-local-onboarding.md` 首行显著标“历史归档、非活动执行入口”，正文作为历史参考；新增 `docs/dogfood/archive/local-behavior.md` 与 `docs/dogfood/archive/local-report-template.md` 保存移出的 B/H 行为和 local 报告段，修正相对链接。原总指南/报告模板保留的 STG 部分引用不断，移出内容的旧 ID 和关键断言进入 docs/testing/README 的迁移表。没有 STG 覆盖的标“未承接”，归档不算 PASS。

## 测试选择五问

1. 防的失败：收集漏项/重复；fixture 跨 Case 串状态或语义变化；业务网络逃逸；拆分丢跨步不变量；清单过期/参数漏列；STG 凭据/清理合同损失。生产业务正确性变化不在本次范围。
2. 最小反馈：原生 list 对账 → 当前域 spec/组件文件与 `-t/--grep` → 共用 fixture 实际消费者。清单脚本用存量样例的解析/失败用例，不镜像测试业务规则。
3. 提前真实边界验证：改 route/context/WS 立即用本地浏览器验证，改 mock 提升/定时器立即执行受影响组件；不要用类型检查代替。这里“真实边界”是本地浏览器/runtime，不是 STG。
4. 最终责任：适用静态检查、受影响第一层及其实际消费者、唯一去重浏览器集合、18 场景与原采集协议、全部原生叶子清单/迁移对账；分阶段已有有效证据可复用。第一层全量收集用于证明覆盖去向，不等于全量执行。目标 origin/main 的合入发布由同一新实施 session 在人工 final gate 后完成。
5. 成本：旧收集 280+独立视觉18；第一层 Case 数/耗时以原生报告为准。当前耗时未知，优先定向样本；确认前最后一次完整运行即权威证据，不 raw+wrapper 连跑、不确认前后各一轮。

## 实施 Task

### Task 1: 先补离线边界，收敛浏览器配置与模式隔离

**目标/非目标：** 在任何浏览器业务执行/计时前实现 C3 无真实业务网络逃逸和 C1 唯一入口；保留原 spec/Case 结构与设备/视口/时区/采集职责。依赖仅为冻结基线、原生只收集结果和仓库规则。边界针对现有真实代理/WS 风险，不建通用网络代理服务。

**预期编辑文件：**

- 修改：`playwright.config.ts`、`package.json`、`README.md`、`src/main.tsx`（仅旧配置引用注释）。
- 新增：`e2e/fixtures/离线边界.ts`、`e2e/fixtures/test.ts`、`e2e/离线边界.spec.ts`、`docs/testing/README.md`（迁移/测量工作区，Task 5 完善）。
- 修改：`e2e/数据源模式.spec.ts`、`e2e/onboarding.spec.ts`、`e2e/J-PILOT-02接线.spec.ts`、`e2e/P1展示统一.spec.ts`、`e2e/展示字段接线.spec.ts`、`e2e/抽屉稳定性.spec.ts`、`e2e/换壳无闪屏.spec.ts`、`e2e/问AI代理展示.spec.ts`。
- 修改：`e2e/fixtures/P1展示统一.ts`、`e2e/fixtures/展示字段接线.ts`。
- 删除：`playwright.数据源模式.config.ts`。

**接口：** C1 命令/project/端口，C3 `安装离线边界` 与原生扩展 `test`。此时 BFF 装配与 P7 事件桩还在原 `数据源模式.spec.ts`，先原地修边界，Task 2 才抽取。不新增 Vite 产品配置。

- [ ] 保存旧两入口 list JSON、HEAD、runtime 到 `test-results/test-layering/`；建立旧 fullTitle/project→去重责任表。只做收集，不在未保护的旧入口执行业务 Case。
- [ ] 先增加本地浏览器反例：未声明 HTTP、下载/带 query、业务 WS、新 context 均被阻止并记录；已声明 route 可应答；HMR/静态不受影响；Mock 业务请求记录非空要失败。用本地 context 的 `核对()` 异常作为可断言结果，不调用真实远端验证；这些反例只用本地受控目标。
- [ ] 安装 context 级末级路由与 teardown 核对，全部功能 spec 导入统一 test；视觉 spec 留至 Task 5 同步接入和验证。P7 假 WebSocket 限定业务路径；J-PILOT-02 第二 context 显式安装/核对/关闭。边界自身测试可从原生 Playwright 导入并独立调用 helper，以断言预期违例；这是唯一无自动检查的明确例外。
- [ ] 原地移除 BFF 通用 200-null 兜底，逐个把故意无资料/解码失败消费改为精确路径的受控响应。未声明请求不能被新增宽泛 default、无限白名单或忽略错误掩盖。保持原业务断言、Case 拆分前结构不动。
- [ ] 按 C1 合并配置，取消对原数据源 spec/J-PILOT-02 的排除及可达性探测 skip；服务不启动时由 runner 报基础设施失败。保留 browser/viewport/timezone，CI 不强制本机 Chrome。无需过渡期 suites 排除、双配置或旧新 project 映射。
- [ ] 更新 alias/README/旧配置注释；list 对账为 280 原责任加边界反例，差额逐项解释，原双角色/双宽度不丢。无单个叶子混入两个项目。
- [ ] 确认边界反例通过后才执行登录、P7、跨 context 接线和缺响应的实际消费者；Mock 定向覆盖登录/零业务请求，以及原无标签 onboarding、抽屉、换壳各一个已有 Case；annotation 执行原两例。不能只用 list 证明改挂项目可运行。缺应答只修测试定义，不改产品。Task 2/3 计时以这个离线、安全且尚未拆分的版本为起点；不把离线修复本身算作拆分提速。

```bash
npm run test:e2e -- --list --reporter=json
npm run test:e2e -- e2e/离线边界.spec.ts --workers=4 --retries=0
npm run test:e2e -- e2e/数据源模式.spec.ts e2e/J-PILOT-02接线.spec.ts --project=fixture --grep 'Backend 数据源 fixture|P7|J-PILOT-02' --workers=4 --retries=0
npm run test:e2e -- e2e/数据源模式.spec.ts e2e/onboarding.spec.ts e2e/抽屉稳定性.spec.ts e2e/换壳无闪屏.spec.ts --project=mock --grep '登录区号|Mock 数据源回归|walks the social-hire journey|390×844 逐帧：抽屉打开背景不跳动，焦点落取消|求职端：头像页' --workers=4 --retries=0
npm run test:e2e -- e2e/数据源模式.spec.ts --project=annotation --workers=4 --retries=0
npm run test:e2e:data-source -- --list
```

视觉原文件的 test 导入与目录初始化均在 Task 5 同步修改并验证，本 Task 不修改/运行它，也不运行其无目录 list；因此没有把本 Task 新改动的视觉接入验证推迟。

**完成/停止：** 无真实业务连接；等价 alias；模式/标注互不混跑；未声明请求可定位失败，HMR 不受损。未经保护的入口不运行；故意错误消费须显式保持错误语义，不能改成成功 fixture。

### Task 2: 抽取业务域 fixture，保持原 spec 消费合同

**目标/非目标：** 将模型/路由/helper 从巨型 spec 分域，原 Case 继续可执行；不拆 Case、不修改产品、不新增模拟后端框架。依赖 Task 1 的 C1/C3 入口、离线保证与原责任对账。

**预期编辑文件：**

- 修改：`e2e/数据源模式.spec.ts`、`docs/testing/README.md`。
- 新增：`e2e/fixtures/bff/安装BFF路由.ts`、`e2e/fixtures/bff/协议.ts`、`e2e/fixtures/bff/账号与目录.ts`、`e2e/fixtures/bff/候选建档.ts`、`e2e/fixtures/bff/招聘组织.ts`、`e2e/fixtures/bff/隐私与实名.ts`、`e2e/fixtures/bff/附件.ts`、`e2e/fixtures/bff/Agent规则.ts`、`e2e/fixtures/bff/发现推荐.ts`、`e2e/fixtures/bff/MatchCase.ts`、`e2e/fixtures/bff/真人消息.ts`、`e2e/fixtures/bff/账号控制面.ts`、`e2e/fixtures/数据源交互.ts`。
- 删除：无。

**消费者/生产者：** 消费原 spec 全部类型/工厂/安装函数；提供 C2 同形入口及已有符号，继承 Task 1 精确错误应答和业务 WS 隔离。协议文件只承载重复信封/multipart/请求记录；域间仅共享明确状态引用。交互 helper 按现有调用迁出，不包装整条业务流程为黑箱。

- [ ] 保存搬迁前 list；建立旧 fullTitle→目标路径→断言保留对账表，不能仅比较总数。
- [ ] 先提取纯样本/类型/工厂，再分域处理器，最后装配路由；每步只搬迁当前负责代码，不增加分支，不恢复已移除的通用 null 兜底。
- [ ] 遵守 C2 跨域状态关系/覆盖先后顺序；测试自持 fixture 与 handler 共用同一对象，序号/Map/Set 每次安装独立。
- [ ] list 确认与 Task 1 选集标识/参数逐项相等；定向执行候选 onboarding、P6、P3、P4 委托、P5 handoff、P7、P8 举报覆盖域交接。将相同环境下的 C4 原长链路时间作为拆分前样本，避免 Task 3 重跑同一有效样本。

```bash
npm run test:e2e -- --list --reporter=json
npm run test:e2e -- e2e/数据源模式.spec.ts --project=fixture --grep '候选 onboarding 完整保存|P6 全链路|P3 隐私读写|候选委托：|completed 移交两步|招聘端经内容无关|举报屏蔽暂不可用' --workers=4 --retries=0
```

**完成/停止：** 入口符号和选集相同、所选跨域链路实际通过，无新增状态串扰。若需改 production decoder 或共享对象语义才能搬迁，停止受影响项并报告；不复制 fixture 绕过。提交独立变更，对账记录就地写入长期文档。

### Task 3: 拆业务浏览器 Suite 与多目标长 Case

**目标/非目标：** 把原 162 个数据源收集项按 C6 搬迁，并实施 C4 长 Case 裁剪；保留独有链路，不为每个 click 建 Case。依赖 Task 1 的统一离线入口和 Task 2 的 C2 路由/域状态；不再改名入口或新增配置。

**预期编辑文件：**

- 新增：`e2e/suites/登录与数据源.spec.ts`、`e2e/suites/招聘组织.spec.ts`、`e2e/suites/隐私与实名.spec.ts`、`e2e/suites/Agent规则.spec.ts`、`e2e/suites/发现推荐.spec.ts`、`e2e/suites/简历与附件.spec.ts`、`e2e/suites/求职意向.spec.ts`、`e2e/suites/岗位编辑.spec.ts`、`e2e/suites/候选建档.spec.ts`、`e2e/suites/招聘建档与JD.spec.ts`、`e2e/suites/MatchCase.spec.ts`、`e2e/suites/连续委托.spec.ts`、`e2e/suites/真人消息.spec.ts`、`e2e/suites/账号与支持.spec.ts`、`e2e/suites/展示与交互.spec.ts`、`e2e/suites/标注.spec.ts`。
- 修改：`e2e/fixtures/数据源交互.ts`、`e2e/fixtures/bff/候选建档.ts`、`e2e/fixtures/bff/招聘组织.ts`、`e2e/fixtures/bff/隐私与实名.ts`、`e2e/fixtures/bff/Agent规则.ts`、`e2e/J-PILOT-02接线.spec.ts`、`e2e/onboarding.spec.ts`、`docs/testing/README.md`。
- 删除：`e2e/数据源模式.spec.ts`，仅在全部迁移对账后删除。

**接口：** Case 选择用 C6 文件+完整 title，保留 `@mock/@backend/@annotation` 和统一 test 导入。合法目标状态由域 fixture 选项准备；不向产品增加测试专用入口或 globals。

- [ ] 修改前对 C4 原长链路补齐有效定向时长：P3、P6、JD、候选 onboarding；复用 Task 2 匹配的证据，只补缺项。记录准备/等待/交互占比，运行失败不能当速度基线。
- [ ] 先等价迁移 describe/hooks/helper，再按 C4 拆责任；各新 Case 构造自己的可变状态。删除重复准备时保留社招/学生/招聘冒烟、首次意向唯一性、附件版本关联与跨刷新未知结果。
- [ ] JD 第二条独立 Case 提供已成功导入建议快照，并经正常合并/确认入口走发布，不只填最终结果；授权与轮询由第一条实际覆盖。
- [ ] 对 Job/教育/行业等超长 Case，拆开独立目录与日常编辑目标；完整竞态不拆。保持 body/ID/If-Match、取消零写、重入回读。
- [ ] 新旧文件搬迁时不得同时保留重复叶子；每个新 Case 单选通过，再固定 4 workers/零重试复验受影响 Suite。比较同风险集合，记录原→新 fullTitle、断言去向、耗时/原因，再移除旧 spec。

```bash
npm run test:e2e -- e2e/suites/隐私与实名.spec.ts e2e/suites/Agent规则.spec.ts e2e/suites/招聘建档与JD.spec.ts e2e/suites/候选建档.spec.ts --project=fixture --workers=4 --retries=0
npm run test:e2e -- e2e/suites/连续委托.spec.ts e2e/suites/简历与附件.spec.ts --project=fixture --workers=4 --retries=0
```

**完成/停止：** 原叶子均有去向；原生单 Case 可选且不依赖顺序；跨步不变量有证据；不抬 timeout。必要 UI 等待不能在测试边界降低时，保留计时/理由，不改产品等待或制造提速结论。

### Task 4: 四个第一层大文件按责任拆 Suite，处理已证实慢等待

**目标/非目标：** 保留源码邻近布局，切出可独立选择的 Suite；以局部计时决定时钟优化。不全量重命名单测，不修改生产代码或全局测试环境。依赖仅为初始 Vitest 收集/相关证据，执行顺序仍在 Task 3 后以避免同时修改总清单。

**预期编辑文件：**

- 删除：`src/状态/应用状态.test.ts`、`src/屏幕/发布岗位.test.tsx`、`src/屏幕/工作经历.test.tsx`、`src/屏幕/P5/MatchCase详情.test.tsx`（迁移完成才删）。
- 新增：`src/状态/应用状态.归约.test.ts`、`src/状态/应用状态.会话.test.ts`、`src/状态/应用状态.资料与建档.test.ts`、`src/状态/应用状态.运行域.test.ts`、`src/状态/应用状态.测试辅助.ts`。
- 新增：`src/屏幕/发布岗位.提交.test.tsx`、`src/屏幕/发布岗位.目录.test.tsx`、`src/屏幕/发布岗位.JD导入.test.tsx`、`src/屏幕/发布岗位.薪资地点.test.tsx`、`src/屏幕/发布岗位.测试辅助.tsx`。
- 新增：`src/屏幕/工作经历.资料与预填.test.tsx`、`src/屏幕/工作经历.教育目录.test.tsx`、`src/屏幕/工作经历.行业与企业.test.tsx`、`src/屏幕/工作经历.作品集与标签.test.tsx`、`src/屏幕/工作经历.测试辅助.tsx`。
- 新增：`src/屏幕/P5/MatchCase详情.展示与隐私.test.tsx`、`src/屏幕/P5/MatchCase详情.阶段动作.test.tsx`、`src/屏幕/P5/MatchCase详情.附件与移交.test.tsx`、`src/屏幕/P5/MatchCase详情.连续委托.test.tsx`、`src/屏幕/P5/MatchCase详情.测试辅助.tsx`。
- 修改：`src/屏幕/城市查询钩子.test.ts`、`src/屏幕/企业实名认证.test.tsx`（仅实测等待成本/受控时钟适用时修改）；`docs/testing/README.md`。无 vitest 全局配置改动。

**冻结归属：** 应用状态 reducer→归约，登录/切主体/目录水合/历史 review 会话边界→会话，资料写入/意向选择恢复/建档草稿→资料与建档，P2/P4/P5/P6/P8/接触记录运行时→运行域。发布岗位按文件后缀职责归属，错误文案与确认门→提交；工作经历预填保存→资料与预填、公司 canonical ID→行业与企业、证书技能→作品集与标签；MatchCase S0记录呈现/Tab/attention→展示与隐私，叮嘱/S0–S3命令→阶段动作，PDF/发布前后移交→附件与移交，pre-Case及未知核对→连续委托。

消歧规则优先于上述关键词：应用状态「招聘方岗位写操作」→资料与建档，「接触记录会话边界」和「P6 会话水合与清理」→运行域，「委托待核对运行时接线」→运行域。发布岗位「Backend 选择器」整个 describe→目录（保留其混合提交/城市断言，不为纯分类再拆叶子）；「全远程地址与 Catalog 门禁」→薪资地点；「无效编辑坐标与 A→B 生命周期」及「职位要求 Tab 删『硬性条件』展示」→提交。MatchCase「控制收口（Task 9）」整个 describe→阶段动作。未显式命名的 describe 在这四组既定文件中按主要断言主体就近归属，记录迁移理由；不新增目标文件/层次，不删除或改写断言；出现真实冲突才停止确认。

**接口/隔离：** helper 只提取真正共用 DTO/构造/渲染函数。`vi.mock` hoisting 保留在需要的文件或使用 Vitest 已有 `vi.hoisted` 合法形态，不能导出一个进程级 mutable 应用状态让不同文件共用。每 Case 新建 fixture，afterEach 恢复时钟/spy/全局 DOM，保留现有 storage 降级场景，不全局清除其故意状态。

- [ ] 对四个旧文件及城市/实名等待测试采集一次原生 JSON（固定 maxWorkers=4、零 retry），取得实际慢项；未跑成功的 Case 记录失败而非性能值。保留原 title 与 describe 对账。
- [ ] 按冻结归属提取 Suite，原则上保持叶子标题/断言，单文件大而单 Case 简短不强行拆叶子。确保 TypeScript app include 覆盖新测试且 helper 不被 runner 当 Case。
- [ ] 对计时证实的 debounce/polling 测试用局部 fake timers＋`userEvent.setup({ advanceTimers })`、`act` 或显式 Promise 推进；验证 debounce 前未请求、到阈值请求、改词迟到丢弃等原不变量。不把真实竞态测试改成同步顺序自证。
- [ ] 单选迁移后的一个 Case 与每个新 Suite，再同配置组合运行所有迁移文件；比较风险集合、计时、失败/跳过，无丢失才删四个旧文件。文档记录保留长 Case 原因和收益/无收益。

```bash
npm test -- src/状态/应用状态. src/屏幕/发布岗位. src/屏幕/工作经历. src/屏幕/P5/MatchCase详情. --maxWorkers=4 --retry=0
npm test -- src/屏幕/城市查询钩子.test.ts src/屏幕/企业实名认证.test.tsx --maxWorkers=4 --retry=0
npm run typecheck
```

**完成/停止：** 每个原 leaf 有迁移去向；新 Suite 可独立运行；无 mock/计时器跨 Case 污染；真实性能改善有可比数据。遇需要修改生产时间策略才能提速时停止该优化，保留测试及理由，不扩大范围。

### Task 5: 原生 Case 清单与测试总文档

**目标/非目标：** 完整列出实际叶子而非手抄概要；提供稳定生成/检查入口与最小执行命令。不新建注册服务、调度层或结果数据库。依赖 Tasks 1–4 的最终文件/project 语义与迁移表。

**预期编辑文件：**

- 新增：`脚本/测试清单.mjs`、`脚本/测试清单.test.mjs`、`docs/testing/cases.md`。
- 修改：`package.json`、`docs/testing/README.md`、`README.md`、`CLAUDE.md`、`e2e/视觉回归/采集.spec.ts`、`e2e/P1展示统一.spec.ts`、`e2e/展示字段接线.spec.ts`。
- 删除：无。

**接口：** C5 数据形状/自动区/错误和排序规则；C1 `test:list` 三种操作。脚本直接以参数数组调用已安装原生 CLI，不拼接待执行 shell 字符串。测试只验证本脚本解析/归一/失败行为，复用小内联 JSON 样例，不创建通用 reporter。

- [ ] 在脚本测试中冻结：Vitest 含参数展开的两 Case、Playwright 一逻辑标题两视口/角色变体、相同 title 不同文件、重复身份、未知路径、空集合、CLI 非零/坏 JSON、Markdown 特殊字符、稳定排序；失败时原清单保持不变，手写 L3 区保留。只对真实脚本责任新增测试。
- [ ] 实现 C5 三次 collection 和完整解析，使用已安装 CLI 的实际结构。Vitest list 有完整名称但无独立参数字段时保留展开名；位置可用 runner 数据，缺行号只链接文件，不靠扫描猜错位置。
- [ ] 视觉采集 spec 接入 Task 1 的统一 test 与 C3 离线边界（原空项目名在此文件取 mock）；将目录必填检查和 mkdir 移至实际测试执行期，`--list` 不需要 `UI_CAPTURE_DIR`，执行仍在缺少必需目录时清楚失败。本 Task 立即用下面的 18 场景采集验证新边界，要求 captured 且无未声明业务请求。P1/展示接线无显式目录仍使用原 testInfo.outputPath；有目录保持原 scene ID/JSON/PNG 协议。
- [ ] 完善 README Suite 表、拆前拆后映射与计时、Case 扩展步骤；生成全部第一/二层明细。L3 手写区只列现有四个 onboarding 组合和基础试点范围，静态清单不登记永久 PASS。
- [ ] 两次生成结果字节相同，`--check` 通过；临时改一个标题或清单自动区时 check 必须非零（在脚本测试临时目录内验证，不改产品源码作实验）。核对 CLI 成功但零项、未知文件都不能产成功空清单。
- [ ] 运行一次原 18 场景实际采集及 P1/展示接线显式目录子集，包含 `P1_BACKEND_CAPTURE_DIR` 的 fixture 采集分支，验证移动目录初始化没有改变消费者输入；已有完整浏览器选集证据可复用不再全跑。

```bash
npm test -- 脚本/测试清单.test.mjs e2e/视觉回归/场景.test.ts e2e/视觉回归/比较器.test.ts 脚本/UI回归核心.test.mjs
npm run test:list -- --write
npm run test:list -- --check
UI_CAPTURE_DIR=test-results/test-layering/visual npm run ui:capture
P1_CAPTURE_DIR=test-results/test-layering/p1 WIRING_CAPTURE_DIR=test-results/test-layering/wiring npm run test:e2e -- e2e/P1展示统一.spec.ts e2e/展示字段接线.spec.ts --project=mock --workers=1 --retries=0
P1_BACKEND_CAPTURE_DIR=test-results/test-layering/p1-backend npm run test:e2e -- e2e/P1展示统一.spec.ts --project=fixture --workers=1 --retries=0
```

显式采集 workers=1 是既有相同目录协议的执行约束，不用于掩盖功能并发问题。输出目录由本次 invocation 独占，不复用他人运行目录。专用比较器用既有单测验证 JSON/PNG 读取消费，不为本次重构重新采集历史 main 或更新基线。

**完成/停止：** 第一/二层每个 leaf 都能反查执行坐标，未知文件失败可定位；native list 不启动服务/产生采集目录；文档与 runner 一致；生成过程失败不覆盖。解析 API 不满足合同先查已安装 runner 本地源码/帮助，不另引依赖或把静态 grep 计数当替代。

### Task 6: 收敛 L3 文档入口，归档旧 local 并删除一次性脚本

**目标/非目标：** 活动真实验收只走 STG，保留全部原断言去向与凭据/清理规则；不创建新 L3 Case，不改变实际业务旅程，不跑 STG。依赖 Task 5 长期文档/清单。

**预期编辑文件：**

- 修改：`docs/dogfood/真实后端行为验收.md`、`docs/dogfood/真实后端报告模板.md`、`docs/dogfood/stg-onboarding.md`（仅链接/章节引用/静态状态说明）、`docs/dogfood/backend-local-onboarding.md`、`docs/AgentBrowser真实后端验收.md`、`docs/testing/README.md`、`docs/testing/cases.md`（仅 L3 手写区）、`README.md`、`CLAUDE.md`。
- 新增：`docs/dogfood/archive/local-behavior.md`、`docs/dogfood/archive/local-report-template.md`。
- 删除：`脚本/全流程爬测.mjs`、`脚本/问题截图.mjs`。

**接口与风险：** C7 是文档整理的上限；受限凭据、operator 版本真相、两轮隔离、cleanup、retained/residuals、NOT_RUN/BLOCKED/PASS 区分与已有材料路径保持。报告模板的 STG 字段不能因删除 local 表格一同丢失。

- [ ] 逐项归档 B01–B05、H01–H04 和 local 六 Case；README 迁移表列出旧 ID、现有覆盖、未承接风险、后续业务 Suite 方向（非创建新 Case）。H01 的过期补事实步骤明确历史冲突，不能推荐执行。
- [ ] 活动总指南只保留 STG 基础试点与 onboarding，报告模板只呈现被选 STG 范围；更新跨文件章节引用，保留旧路径的归档提示，历史报告链接仍可追溯。
- [ ] 删除两个一次性脚本前检查调用方和各历史风险；已有定向测试填精确路径/标题，没有承接的写清缺口，不制造已覆盖结论。只删除这两个受控文件，不清理用户 evidence 目录。
- [ ] 对活动链接、STG 命令/关键规则和 15 旧 ID 做逐项 diff 审核。Spec/Plan/历史报告中允许保留旧命令作为历史文本，不把 rg 命中一律删除。

```bash
git diff --check
rg -n '全流程爬测|问题截图|dev-local|browser-fixture|backend-local-onboarding' README.md CLAUDE.md docs/testing docs/dogfood docs/AgentBrowser真实后端验收.md
npm run test:list -- --check
```

**完成/停止：** 活动指引没有启动完整本地后端的必需步骤；归档断言和 L3 未承接项可追溯；STG 语义未变。若需要改 operator 命令或实测才知道如何改业务流程，则停止该语义改动，保持旧 STG 合同并报告，不偷偷纳入正式 L3。

## 实施后收尾（不计入 Task count）

1. 完成全部六个 Task 和执行 skill 要求的宿主内全局 review；无该要求则不额外增加。退出 Task 循环，不调用 `finishing-a-development-branch` 默认合入菜单或附加整套测试。
2. 同一执行者调用宿主映射的异构代码 review-loop：Codex→Claude、Claude Code→Codex，绑定批准 Spec 与执行 Plan 精确版本/固定 candidate diff；reviewer 只读且默认不跑测试。内部轮数/裁决交给 review skill，轮间仅相关快速单元/静态验证，不跑完整 gate。后续修复不重新进入 Task/global review。
3. review 裁决后，按实际 diff 重算完整责任并补齐有效 affected/L0–L2。共享 Playwright 配置/fixture 重构的责任是全部新原生功能选集。第一层没有改全局配置/生产代码，责任为 Task 4 四组拆分文件及 helper 的全部实际消费者、确实优化过的城市/实名测试、Task 5 清单脚本与视觉工具消费者；不能仅因涉及多个文件就扩大到全部 Vitest。全库 native list 对账仍必需，但它不是测试执行。存在有效同输入证据则复用，缺失才执行，不 raw+alias 连跑。

```bash
git diff --check
npm run typecheck
npm run lint
npm test -- src/状态/应用状态. src/屏幕/发布岗位. src/屏幕/工作经历. src/屏幕/P5/MatchCase详情. 脚本/测试清单.test.mjs --maxWorkers=4 --retry=0
npm run test:e2e -- --workers=4 --retries=0
npm run test:list -- --check
```

城市/实名若实际修改且缺有效证据，补 Task 4 对应两文件子集（仅变化的一项可只选一项）；视觉工具与 18 场景/采集兼容责任若 Task 5 的源码/runtime/fixture/selection 未失效可直接复用，否则只补 Task 5 对应命令，不机械跑完整历史像素比较。已有独立 `.test.mjs` 必须被全库 Vitest list 收集，不能漏工具清单；测试执行只要求真实受影响消费者。不以 280/18 固定数量替代逐项覆盖对账。上述命令是无证据时的责任入口，不要求重复跑已有效部分。

4. 记录每条命令源码、选集、runtime、fixture、结果、耗时与跳过原因。将最终迁移/计时摘要写入 docs/testing/README，原始证据留 test-results/test-layering。没有满足条件的基线就写未知；失效证据只补对应责任。本仓库无 affected 选择器，必要子集缺支持时说明限制，不能自动以整层重跑作替代。
5. 正式 L3 selection 为 `none`：本次无产品/后端/真实 STG 操作语义变化，不执行真实登录/上传，不记 L3 PASS。若发现必须扩大语义，停止扩大并修订契约/精确 selection，不退化成“全跑 STG”。
6. 展示具体 final gate：candidate SHA、只读核对的 target SHA、L0–L2 完整责任与有效证据、待补增量、拟合入动作、L3 none 理由；等待用户明确确认。此前不合 target、不跑正式 L3、不 push；未完成验证不得宣称 ready。
7. 确认后同一执行者完整读取 `development-workflow` skill 根相对 `references/final-integration.md`，遵循 `assets/final-integration-contract.md`：同步 target/记录 final_target_base → 重算完整责任 → 复用有效 PASS/只补缺口 → 必要 development L3（本任务 none）→ cleanup 后再次对账 → 核对目标未推进 → 普通 fast-forward push，绝不 force push。确认后不再调用异构 review；目标竞争只补失效责任。
8. 刷新本机 task intent 状态，报告真实 review、测试和合入结果。实施只在用户选定工作区进行，不新建第二个用户工作区，不清理他人内容。

## 文档 Review 与交付记录

本节记录 planning review，不替代实施代码 review。review 模式固定 `WORKFLOW_DOCUMENT_REVIEW`、`scope_approved_by_parent_workflow: true`；scope 仅当前 Spec 与本 Plan，精确候选由 Git revision/blob 冻结。reviewer 为独立 headless Claude，`opus/high`、plan permission mode，禁止测试/写入/扩大分支 diff；共用合同从 skill 真实目录解析。

每轮先保存 status/HEAD/两文件指纹，结束先核对未变化再读 findings。批准 Spec 始终固定为本文开头的 `c60dca14` / `06a9dd72`，候选 Spec 仅含批准记录更新。最终 prompt 只绑定完成裁决后的 Plan 精确版本，未完成 review 不生成执行 prompt。

### Round 1 与修订裁决

- 冻结候选：revision `df45303cd76fff8292f74381937b799a12079dec`；Spec blob `06503c9395c6c280994c83d0299fefc98a457966`；Plan blob `2ee961e0c7ef055046dac7a25946421cca035c8f`。reviewer `opus/high`，正常返回，轮后 status/HEAD/两文件指纹均与轮前一致。
- 报告为 4 条 Minor：1 required、3 optional。主控按 receiving-code-review 独立核实后全部采纳，均不改变批准 Spec：①补 Task 4 歧义 describe 的明确后缀及有限兜底规则；②补 C5/C6 非 src/视觉/边界文件归属；③仅补 `src/main.tsx` 的退役配置引用注释；④补实际受影响的 `P1_BACKEND_CAPTURE_DIR` 采集验证。①②④复杂度不变，③降低悬空引用；没有新增基础设施。
- 主控自检补充：原顺序在离线边界安装前执行业务 Case，违反本地验证隔离目标。将原入口/边界任务前移为 Task 1，抽 fixture/拆 Case 顺延，删除临时 suites 排除和双配置过渡；离线保证同时覆盖视觉采集。Task 总数仍为 6；实现复杂度降低。
- 范围偏差：reviewer 为核验事实读取了 scope 外实现文件，违反本轮仅 Spec/Plan＋仓库规则的读取边界；未修改文件、未跑测试、未做分支 diff review。此轮不能记作完全守约审查。主控独立核实上述事实，下一轮仅复审冻结文档修订，禁止读取任何实现文件或外部实现资料。
- 本阶段产品测试 `NOT_RUN`；只做文档/源码只读核实。修订提交后冻结候选，复用同一 reviewer session 做第二轮文档审查；是否结束遵循 review-loop 裁决规则。

### Round 2 与最终裁决

- 冻结候选：revision `c7e74057094084d84ca8cbdc522b4b95424251f0`；Spec blob 仍为 `06503c9395c6c280994c83d0299fefc98a457966`；Plan blob `1869d5bef7d04633de576f5f4037ddef0bb1fb0e`。同一 session `opus/high` 正常返回；主控轮后 status/HEAD/两文件指纹检查通过。本轮遵守仅冻结文档/Git 对象/规则的读取边界，无新源码读取或测试执行。
- 首轮 4 项修正均经 reviewer 确认。新增 2 条 Important required、1 条 Minor optional，均采纳并局部修正：①Task 1 补 Mock 登录/零请求及原无标签三文件各一例、原两个 annotation 的定向命令；②视觉 spec 的边界接入整体移至 Task 5，与原 18 场景验证同 Task，Task 1 不再改该 spec；③onboarding 文件明确是已有两个 Suite 的并集，三条招聘叶子归招聘，其余归候选，不新增 Suite 名。
- 主控最小覆盖复核：第一层只拆局部测试/局部 helper，未改全局 Vitest 配置或生产逻辑，缺乏要求全量执行的证据。收尾改为受影响第一层文件和实际消费者的完整责任；全库收集/迁移对账仍保留，浏览器因共享配置仍负责全部唯一功能选集。没有降低断言/覆盖要求，没有新增 runner。
- 逐项修正后核对 C3、Task 1/5 编辑清单与验证同位关系、两个宿主路由及最终测试责任；`git diff --check` 通过。结论为「2 轮、经裁决修正后无未解决 required」，不是声称 reviewer 原文 `NO FINDINGS`。依 review-loop 结束规则停止，不机械发起第三轮。所有变更仅为规划文档，产品测试仍 `NOT_RUN`；最终执行 prompt 在本次修订提交后另行绑定精确 Plan revision/blob 并校验。
