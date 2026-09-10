# P1 职位详情与双端消息列表展示统一 Implementation Plan

> **For agentic workers:** Claude Code 必须调用 `superpowers:subagent-driven-development`；Codex 必须调用 `superpowers:executing-plans`。按依赖执行全部 Task；本文件只规划，新实施 session 才写产品代码。

**Goal:** 独立职位详情和双端消息列表共用各自展示，保持当前 Mockup 视觉与现有真实行为。

**Architecture:** 保留 Mock/Backend 连接层，提取本页专用展示数据与组件。只迁移确有重复的正文、操作区、列表外壳及会话行，复用现有 CSS 声明，不改变通用组件接口或建立通用页面引擎。

**Tech Stack:** React 19、TypeScript、CSS Modules、Vitest/Testing Library、Playwright、既有视觉比较器。

**Spec:** `docs/superpowers/specs/2026-09-10-p1-job-detail-inbox-unification-design.md`，批准 revision `33824d073a6191093d517b12b89717fbeac48993`，blob `986011168fe338040799135a21f4b1b0fe1638c0`。后续仅状态/批准记录追加不替换批准正文。

## Global Constraints

- 仓库 `agxp-a2a-recruiting-web`，target `main`（同步引用 `origin/main`）；工作区 `.`，复用用户选择的现有工作区，不新建第二用户工作区，不自动 stash/reset/clean。规划产品基线 `55c7024fbc98c7565b0eab56745649f310985aac`，实际开工/收尾重新核对目标。
- 完整读取 `CLAUDE.md`、`AGENTS.md`、冻结 Spec；工程原则优先。外部技能按逻辑名发现，scripts/assets/references 按该 skill 根相对位置解析，不写机器绝对路径到交付。
- **用户覆盖：L3 真实栈测试责任 none，N/A（用户显式排除）。** 不启动真实栈、不执行真实账号 dogfood、不把真实栈缺环境作为本计划阻塞、不在 final gate 后恢复默认 L3。保留适用 L0–L2 与 HTTP fixture 验证，未验证的真实集成不记 PASS。该条覆盖 execution/final-integration 默认合同内与其冲突的 L3 步骤。
- 当前 Mockup 是视觉基准；现有 Mock 场景的字号、尺寸、间距、断行、滚动留白和弹层保持。新增占位仅作用于缺失展示，不以重录基线或放宽阈值接受意外差异。
- 展示文件无 Context、运行模式、Mock 运行时导入、路由、请求、业务派发或匹配算法。预格式化数据及能力回调由连接层提供；不把 DTO 转成带假字段的完整 Mock 业务对象。
- 不改 HTTP/BFF schema、Provider、权限、状态机、匹配算法、持久化与已读协议；不添产品配置、依赖或测试框架。操作回执、范围隔离和未加载/失败状态不能被未知占位掩盖。
- 禁止修改 `src/屏幕/在谈详情*`、`src/屏幕/候选详情*`、`src/屏幕/匿名在线简历*`、`src/屏幕/详情控制/`、`src/组件/在谈详情/`、详情展示映射、阶段对话流、双端真人会话及通用公司/匹配组件；不依赖未合并详情分支。`直聊会话.tsx` 只读消费者，不修改。
- 不编辑并行中的 `e2e/数据源模式.spec.ts`、`e2e/视觉回归/场景.ts`。新增本任务独立 spec，复用已有配置、稳定页面 helper 和比较器。不复制巨型全域 BFF fixture；只维护本任务最小允许请求集合。
- 实施开工通过 development-workflow 的 `scripts/task_intents.py start --summary 'P1 职位详情与消息列表展示统一' --target main` 配合下列文件清单逐个 `--path` 登记；读取其他预告/实际 diff。路径或共享符号扩展前 update 并核对；陈旧记录不是无冲突证明。
- 每个 Task 的 brief 连同本节与“冻结展示接口”交给执行者。串行任务；不为了并行增加合并成本。每 Task 修复适用失败后提交；不靠删除隔离断言使测试变绿。

### Task index

Task count: 6
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|Mock 视觉冻结和基线采集；无前置|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|2|职位正文与数据投影；依赖 1|Top 5–10（Claude Code: sonnet）|前沿 / 顶级模型（Claude Code: fable/opus）|Top 5–10（Claude Code: sonnet）|
|3|职位页操作和外壳统一；依赖 2|Top 5–10（Claude Code: sonnet）|前沿 / 顶级模型（Claude Code: fable/opus）|Top 5–10（Claude Code: sonnet）|
|4|双端消息列表与行统一；依赖 1、串行在 3 后|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|5|HTTP fixture、视觉和完整 L0–L2；依赖 2–4|Top 5–10（Claude Code: sonnet）|前沿 / 顶级模型（Claude Code: fable/opus）|Top 5–10（Claude Code: sonnet）|
|6|唯一 final gate：实施异构 review、人工确认及合入；依赖 5|前沿 / 顶级模型（Claude Code: fable/opus）|前沿 / 顶级模型（Claude Code: fable/opus）|Top 5–10（Claude Code: sonnet）|

Task 1/4 是既有布局和有限状态映射，Top 5–10 足够；2/3/5 的 spec review 需辨别真实证据与展示占位、业务状态与测试替身的边界，使用前沿档位。Task 6 implementer 是同一实施 session 的主控，不额外委派人工 gate；审查角色按已冻结合同核验，不重复全范围 review。

**计划本身复杂度：中。** 两个页面族，职位业务分支多，但不改变请求/协议。
**零上下文漂移风险：中。** 视觉基准和兼容入口可能受到同期主线改动影响，已有冻结接口与停止条件限制风险。
执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。Claude 条件 alias 仅 Claude 解析，Codex 按宿主通用档位配置执行。

## 文件职责与冻结展示接口

新文件限定在 `src/屏幕/职位详情展示/`、`src/屏幕/消息列表展示/` 和本任务测试。现有 `职位详情.module.css` 保留为正文与操作的主样式；双端消息采用原 `消息列表.module.css`，确认无人依赖后删除仅注释不同的 `企业消息.module.css`。内部 helper 可在对应文件内组织，不新增全站抽象。

### 职位正文契约（Task 2 生产，Task 3 消费）

在 `src/屏幕/职位详情展示/类型.ts` 定义以下类型；`对齐行` 从 `src/数据/匹配对齐.ts` type-only 导入，`公司区块资料` 从既有组件 type-only 导入。

```ts
type 图位 = { 种类: '字标'; 字: string } | { 种类: '未知'; 可访问名: string };
type 匹配展示 =
  | { 种类: '核对'; 分: number; 行们: 对齐行[]; 分析: { 墨句: string; 灰句: string } | null }
  | { 种类: '说明'; 分: number | null; 说明: string[] };
interface 职位正文数据 {
  职位: string;
  薪资: string;
  匹配: 匹配展示;
  职位详情标题: string;
  职位事实行: string[];
  职位详情行: string[];
  职位要求标题: string;
  职位要求行: string[];
  公司: { 名称: string; 图: 图位; 简介: string; 资料: 公司区块资料 };
  发布人: { 图: 图位; 姓名: string; 公司: string; 职务: string; 备注: string };
}
interface 职位正文展示属性 {
  数据: 职位正文数据;
  打开公司?: () => void;
  直接聊?: () => void;
}
```

`职位正文展示.tsx` 导出 `职位正文展示(props: 职位正文展示属性): ReactElement`。数据文本已格式化；展示不再判断模式。已知分数沿用原 44px 分析环，说明分支 null 用本页 44×44 中性分数位；核对分支调用原 `匹配分析块`，原零行不绘制内部内容行为保留，不改变通用组件。

`准备职位正文.ts` 导出两个同步函数：`准备Mock职位正文(岗: 市场职位, 简历: 职位核对简历): 职位正文数据`、`准备Backend职位正文(视图: P4候选岗位页面, 简历: 职位核对简历): 职位正文数据`。`职位核对简历` 精确为 `{ 经历: 简历经历段[]; 教育: 简历教育段[]; 技能: string[]; 开始工作年: 基本信息['开始工作年'] }`，这些类型均来自 `src/数据/类型.ts`。函数只准备数据，不请求、不路由；Mock 路径才读模拟详情/静态公司资料；现有匹配计算原样移动，不调整算法。

保留 `src/屏幕/职位详情.tsx` 导出 `职位正文({ 岗, 藏直聊?, P4视图? })` 的现有参数类型，内部成为读取状态/导航和调用上述函数的兼容连接器。Backend 主页面不得在 `P4视图` 缺席时调用 Mock 准备函数；直接嵌入消费者保持当前调用方式，不删除兼容导出。

文案按 Spec §3.2；Backend 缺失发布人也生成占位对象，图片不取 wire 派生首字充当真实图片。Mock 已知字标、原备注/职务空值先按 Task 1 核对现有实际 fixture；Spec §2.1 优先保护已有 Mock 视觉。如应用缺失规则会改变真实既有 Mock 场景，报告精确字段/截图，按批准 Spec 停止相应产品改动并请求修订，不能私设模式开关或改 fixture。

公司资料使用现有 `公司区块` 的显式 `资料`、`标志` 和 `按下` 参数。Mock 连接侧按原静态档规则生成同样介绍/元行（原函数私有时仅在本页复制其必要投影，不导出或修改通用组件）；Backend 生成缺字段元行及图位。禁止在展示层漏传 `资料` 而触发静态兜底。没有 organization ref 则无打开回调。

### 职位页面契约（Task 3）

同目录 `职位页面展示.tsx` 导出 `职位页面展示(props: 职位页面展示属性): ReactElement`，类型也放 `类型.ts`：

```ts
interface 职位页面展示属性 extends 职位正文展示属性 {
  返回: () => void;
  更多打开: boolean;
  改更多打开: (值: boolean) => void;
  主按钮: { 文案: string; 已委托样式: boolean; 禁用: boolean; 按下: () => void };
  不感兴趣: { 禁用: boolean; 按下: () => void; 菜单可见: boolean; 菜单按下: () => void };
  举报: () => void;
}
```

正常 Mock/Backend 两入口都消费该展示；返回栏、正文、浮动条、更多菜单只有一份。正常页的更多入口恒可见，不引入无消费者的开关。确认/附件/举报层仍在连接层，更多开关受控以保留菜单切换举报/删除行为；失败/加载页可继续留在连接层，不以泛型 children 传入另一套正常页面。

### 消息契约（Task 4）

在 `src/屏幕/消息列表展示/类型.ts` 定义：

```ts
type 消息页签 = '全部' | '仅会话' | '通知';
type 未读展示 = { 种类: '无' } | { 种类: '红点' } | { 种类: '数字'; 数量: number };
interface 会话行数据 {
  键: string;
  标题: string;
  副标题: string;
  时间: string;
  摘要: string;
  头像: { 种类: '代理' } | { 种类: '字标'; 字: string; 底色: string };
  未读: 未读展示;
  未读测试标识?: string;
  按下: () => void;
}
interface 列表提示 {
  键: string;
  行们: string[];
  操作?: { 文案: string; 按下: () => void };
}
interface 消息列表展示属性 {
  页签: 消息页签;
  改页签: (页签: 消息页签) => void;
  搜索词: string;
  改搜索词: (值: string) => void;
  搜索提示: string;
  前置提示: 列表提示[];
  行们: 会话行数据[];
  后置提示: 列表提示[];
  加载更多?: () => void;
}
```

`消息列表展示.tsx` 导出 `消息列表展示(props: 消息列表展示属性): ReactElement`、`会话行({ 数据 }: { 数据: 会话行数据 }): ReactElement`。搜索 input ref 和点击聚焦留在展示；页签/搜索 useState、过滤、S3 门控、首读/分页/重试、快照映射与回调留原连接层。提示数组允许错误与缓存行共存，行内 ReactNode 不作为整片 UI 逃逸口。

`消息行映射.ts` 导出 `从Mock消息行(条: 消息条目, 未读: number | undefined, 按下: () => void): 会话行数据` 和 `从Backend消息行(条: P7会话项, role: P7角色, 按下: () => void): 会话行数据`，类型从原数据类型模块 type-only 导入；不读 Context/fixture/路由。时间、角色标题与 lastMessage 缺省原样移动。保留 `unread-${conversationId}` 测试标识，不将 0 变红点。

### Task 1: 冻结 Mockup 与采集基线

**目标/非目标：** 为当前三页及直聊嵌入正文留下可比较证据，未改产品前捕获。不是重建视觉平台或运行真实后端。

**Files:** Create `e2e/P1展示统一.spec.ts`；只读 `e2e/视觉回归/稳定页面.ts`、`类型.ts`、`比较器.ts`、`src/数据/模拟数据.ts`、`src/数据/公司档案.ts`、三页 CSS；证据写 `ui-regression-output/p1/reference/` 和 `test-results/`（均已忽略），元信息记录在本 Plan 的实施证据节。

**接口/依赖：** 无上游实现依赖。新增 spec 使用既有 `playwright.数据源模式.config.ts`；测试专用 `P1_CAPTURE_DIR` 指定采集目录，不新增产品 env。采集复用现有 `场景采集结果` JSON schema 与比较器，写 `scenes/<id>.json`、`screenshots/<id>.png`。不得 import 原 `e2e/数据源模式.spec.ts` 触发整套测试注册。

- [ ] 核对冻结 Spec blob、工作区/依赖/并行预告。记录 `git rev-parse HEAD` 为本次 `visual_source_candidate`，产品基线变化先说明实际 diff；不合入 target。`node_modules` 缺失才 `npm ci`，不改 lockfile。
- [ ] 源码检查所有现有市场 fixture 的公司/发布人可空字段及已知 fallback，确认 Spec §2.1 与 §3.2 不冲突；发现实际 Mock 视觉冲突在该字段实施前停止，不改 fixture 隐藏差异。
- [ ] 新增带 `P1 Mock视觉 @mock` 标签的 320×844、390×844 场景。使用 `打开稳定页面(page, path, 状态)` 建立原有种子：`/#/job/M-13`、候选 `/#/app` 后点消息、招聘 `/#/hr` 后点消息、`/#/chat/direct/M-13` 后点看职位；招聘真人行通过原 Mock 用户动作推进到 S3，再进消息，不用姓名存在假作完成。
- [ ] 冻结 locale zh-CN、timezone Asia/Shanghai、reducedMotion reduce；等待 fonts.ready 和页面就绪，不用固定长 sleep。截图覆盖职位顶部、公司/发布人滚动段、更多层，消息全部/通知/搜索，直聊覆盖层。另记消息极长标题的隔离布局样本：在测试页面将同一会话标题文本替换为固定 80 个汉字，基准/候选执行完全相同的测试端 DOM 文本替换，记录标题/时间/行框几何；不改 class/style 或产品 fixture。此样本仅证明布局不退化，不作为 HTTP 接线证据。每种滚动状态独立 sceneId，基准和候选相同导航/滚动步骤。
- [ ] 每个场景输出关键元素几何、PNG、console/page/API 诊断。关键元素至少为分数位、JD/公司/发布人卡、浮动按钮、消息标题/页签/搜索/首行/未读。普通 Mock 零新增 API；失败必须写 failed JSON 并抛错。sceneId 包含视口宽度，禁止覆盖另一宽度的证据。
- [ ] 执行：`P1_CAPTURE_DIR=ui-regression-output/p1/reference npm run test:e2e:data-source -- e2e/P1展示统一.spec.ts --project=mock-stg --grep 'P1 Mock视觉' --workers=1`。预期全部场景成功，目录有基准截图/JSON；缺截图不能记 PASS。保留 source commit 与工具链信息，未发生产品修改前提交测试文件。

**完成/停止：** 基准捕获成功且有 source SHA 才进入 Task 2。若当前 Mockup 本身已有溢出，基准忠实记录；报告范围内需处理的具体问题，不擅自修改 CSS 以“修基准”。本 Task 只冻结，不声称已完成两栈验收。

### Task 2: 职位正文展示与缺失投影

**目标/非目标：** 正常正文只有一份 JSX，Backend 缺失位置完整且 Mock 视觉不变。不改委托、举报、请求或通用组件。

**Files:** Create `src/屏幕/职位详情展示/类型.ts`、`准备职位正文.ts`、`准备职位正文.test.ts`、`职位正文展示.tsx`、`职位正文展示.test.tsx`；Modify `src/屏幕/职位详情.tsx`、`src/屏幕/职位详情.module.css`、`src/屏幕/职位详情.test.tsx`。

**接口/依赖：** Task 1 基准已存在。生产“职位正文契约”全部导出，兼容入口参数不变，供 Task 3 消费。原正文位于 `职位详情.tsx` 的 `export function 职位正文`，原业务测试为 `职位详情.test.tsx`。

- [ ] 先写失败断言：无推荐分显示可访问“匹配分未知”、无进度环；真实 0 仍为环；发布人 null 保留姓名/职务/备注未知及图位；部分空、blank、JD 空但事实存在时 JD 仍显示未知；已知公司 ref 与缺 ref 可点击性不同。分别测试有值 rerender 成空无旧数据残留。
- [ ] 映射测试复用现有职位详情测试中的合法 P4 值，禁止从 illegal DTO 强转。用 Spy 验证 Backend 准备不调用 `取市场岗位详情`/静态公司档；Mock 原映射的元行顺序、重复项、文案与匹配结果不变。明确覆盖公司档已补全/未补全、简介拆分不足两段返回空元行、成立/地址有无；以原组件同一输入的可观察输出作对照，不修改原组件。
- [ ] 运行 `npm test -- src/屏幕/职位详情展示/准备职位正文.test.ts src/屏幕/职位详情展示/职位正文展示.test.tsx`，确认失败指向缺失实现/预期行为，不把加载错误当有效失败测试。
- [ ] 原样迁移数据准备和 JSX，连接侧传显式公司资料，渲染只按数据/能力。本页新增 `.未知分数位` 44×44、图位和必要未知文案样式；完整状态原声明值不动，不给原有通用 class 增加会推挤 Mock 的规则。
- [ ] 按 Spec 更新原藏分/藏发布人断言，保留其他业务测试；正文没有 P4 数据时的调用合法性由连接层保证。示例断言：`expect(screen.queryByLabelText('匹配分未知')).toBeNull()` 对真实 0 场景成立，未知场景相反；不能只检查源码含组件名。
- [ ] 运行 `npm test -- src/屏幕/职位详情展示/ src/屏幕/职位详情.test.tsx src/屏幕/直聊会话.test.tsx` 和 `npm run typecheck`。重新采集 Task 1 相同场景到 `ui-regression-output/p1/task2/` 并与 reference 比较；无关消息基线不可改变。
- [ ] `git diff --check`，检查 CSS 实际消费者与被删除选择器，提交正文改造。

**完成/停止：** 新纯展示确实被两模式调用、兼容正文可用、业务测试通过且 Mock 无未经批准视觉差异。若必须修改禁止文件或新增公共接口才能继续，报告契约冲突，不能在本任务自行扩展。

### Task 3: 职位页外壳与操作展示统一

**目标/非目标：** 删除两份正常返回栏、浮动条和更多菜单，保持动作与弹层事务归属。不重构 Backend 控制 hook 或改变成功后导航。

**Files:** Create `src/屏幕/职位详情展示/职位页面展示.tsx`、`职位页面展示.test.tsx`；Modify 同目录 `类型.ts`、`src/屏幕/职位详情.tsx`、`src/屏幕/职位详情.test.tsx`；CSS 仅必要迁移清理。

**接口/依赖：** Task 2 全部导出已提交且测试通过。实现“职位页面契约”，复用 `职位正文展示`。已有 `开始委托`、`执行候选委托`、`标记不感兴趣`、`安全返回`、轮询和举报逻辑保持在连接层。

- [ ] 写展示回调测试：返回、更多开关、浮动不感兴趣/菜单不感兴趣、举报、取消各调用指定回调一次；disabled 不触发。展示不能自行通过 ID 拼路由；`菜单按下` 独立承载原收层/toast/返回顺序。
- [ ] 运行 `npm test -- src/屏幕/职位详情展示/职位页面展示.test.tsx` 确认 RED；实现统一展示，原生标签/class/菜单结构原样迁移，尤其避免 span→button 引入默认外观或嵌套 button。
- [ ] 两种正常页面传入数据/回调；错误/加载页面继续原逻辑，附件选择、确认、举报层继续连接侧挂载。Mock 已委托样式与一次点击原型、Backend 六态/进度未知/写中禁用保持。
- [ ] 原 `职位详情.test.tsx` 验证 404 不回 Mock、推荐坐标只取当前意向、空库/单文件/多文件、每次披露确认、取消/迟到结果、服务端失败原地停留、成功禁用零 P5 导航，以及举报 target-not-found 重读；不要复制整套测试，已有断言充分则复用。
- [ ] 运行 `npm test -- src/屏幕/职位详情展示/ src/屏幕/职位详情.test.tsx src/屏幕/直聊会话.test.tsx`、`npm run typecheck`。按 Task 1 命令采集 task3 目录，使用既有比较器核验正常和更多层/直聊覆盖层。
- [ ] 确认重复正常页 JSX 被删除，Backend 错误样式仍有消费者则保留；`git diff --check` 后提交。

**完成/停止：** 展示统一且控制链不变。没有回执不能把占位展示写成委托成功；任何业务协议或未合并详情接口变更需求在此停止扩展。

### Task 4: 双端消息列表与会话行统一

**目标/非目标：** 两端 Mock 与角色化 Backend 共用外壳、列表行和 CSS。只负责列表，导航后真人会话页面不修改。

**Files:** Create `src/屏幕/消息列表展示/类型.ts`、`消息行映射.ts`、`消息行映射.test.ts`、`消息列表展示.tsx`、`消息列表展示.test.tsx`；Modify `src/屏幕/消息列表.tsx`、`src/屏幕/企业消息.tsx`、`src/屏幕/P7/Backend会话列表.tsx` 及这三处对应 test；保留 `消息列表.module.css`，Delete `企业消息.module.css` 仅在全库消费者清零后。

**接口/依赖：** Task 1 基准存在；串行在 Task 3 后执行，避免同一工作区同时修改。生产“消息契约”所有导出，不依赖职位正文接口。

- [ ] 先写映射表驱动测试：Mock undefined/0/2 → 无/红点/数字；Backend 0/2 → 无/数字；两角色标题反转、context 不可用、lastMessage=null、日期短显示与原代码相同，点击回调原样透传。
- [ ] 写展示测试：搜索图标聚焦输入、输入/页签受控回调、文字行与数字/红点正确、前置错误+缓存行+后置提示同时可见、加载更多回调存在才显示。空副标题仍留节点，不生成假姓名或假会话。补充超长标题/副标题/摘要的展示和 CSS class 保留断言，以及 rerender 同一行从已知 context/摘要/正数未读切为不可用 context/lastMessage=null/未读0：旧标题、副标题、摘要、数字徽标均不残留；空副标题节点仍在，时间仍可见。jsdom 不证明几何/截断，真实 320/390 宽布局在 Task 5 验证。
- [ ] `npm test -- src/屏幕/消息列表展示/` 确认 RED；实现共用 JSX/CSS。将原候选 CSS 声明原样复用，代理/字标放原 46px 容器，行没有新业务按钮。
- [ ] 连接层保留页签/搜索状态、过滤顺序、S3 门控和数据域；Backend 仍登记/注销角色可见范围、force 首读、分页和重试，0 未读不派发本地已读。
- [ ] 保留 `消息列表.test.tsx`、`企业消息.test.tsx`、`P7/Backend会话列表.test.tsx` 既有分支测试，补上两端真实消费共享展示的集成断言，不能仅保留 Mock 掉 Backend 的代理测试自证结构统一。
- [ ] 运行 `npm test -- src/屏幕/消息列表展示/ src/屏幕/消息列表.test.tsx src/屏幕/企业消息.test.tsx src/屏幕/P7/Backend会话列表.test.tsx` 和 `npm run typecheck`。再次采集 task4 目录并对比 reference；搜索/页签/两端行样式均保持。
- [ ] `rg -n '企业消息.module.css' src` 应零消费者后才删除该文件。检查不存在新增两份 card/row JSX、Context 泄入展示或 CSS 值变化；`git diff --check` 后提交。

**完成/停止：** 三入口使用同一组件树且未读/门控/导航均通过；不能把通知空态补成模拟 AI 动态，不能误把错误+缓存状态拆没。

### Task 5: HTTP fixture 浏览器与完整 L0–L2 验证

**目标/非目标：** 证明实际页面加载共享展示及 CSS，保护 Mock 基准和真实模式前端接线。HTTP fixture 不是真实栈，不触发 L3。

**Files:** Modify `e2e/P1展示统一.spec.ts`；Create `e2e/fixtures/P1展示统一.ts`；产品失败仅回到 Tasks 2–4 允许路径修复。输出 `ui-regression-output/p1/`、`test-results/`，本 Plan 记录结果，不新增 handoff/review report 文档。

**接口/依赖：** Tasks 2–4 完成；使用既有数据源配置的 mock-stg/backend-stg 项目，不改公共 E2E 文件或配置。新 fixture 导出 `安装P1路由(page: Page, options: { role: 'candidate' | 'recruiter'; 场景: '完整' | '缺失' | '长文' | '错误带缓存' }): Promise<{ 请求: { method: string; path: string; body: unknown }[] }>`，仅测试使用。

- [ ] 从既有 `e2e/数据源模式.spec.ts` 的 P4/P7 场景只读核对当前合法 wire 合同/会话恢复种子，新增小型 path+method 白名单 fixture，覆盖应用启动必要会话/角色/资料/列表读取，以及本任务岗位/推荐/会话读取；未知 API 必须记录并返回受控错误，不放行真实网络，不泛化所有 GET 成功。复用现有 fixture 值语义，不复制其全域状态机或导出带 test 注册的文件。
- [ ] 新增 `P1 Backend展示 @backend` 测试：职位推荐缓存路径、详情直取缺分/缺发布人、真实分 0、合法空/部分空/长文、失败不正常占位；消息双角色/无上下文/无 lastMessage/未读0和正数/错误带缓存/分页/超长标题、副标题及摘要/同一会话刷新为空。每个数据场景在 320 和 390 宽检查无旧值残留；职位及普通消息场景检查卡片/按钮不溢出。消息长副标题/摘要场景保持正常长度标题，验证既有单行截断、时间不被挤出或遮住。极长标题属于既有非收缩且不换行的限制，仅按 Task 1 同文本隔离布局样本检查标题/时间/行几何不退化；记录旧有溢出/裁切为已知限制，不新增“时间必须可见”或零溢出的绝对门禁，不将其写为已修复。HTTP 长标题场景仍验证字段如实上屏，不能用测试端 DOM 替换冒充数据接线。刷新为空后无旧文本或旧未读标记。
- [ ] 交互核验职位更多/举报入口、无推荐坐标禁用、公司有 ref/无 ref；Mock 原一次点击委托与既有 E2E P4/P7 回归共同保护动作。消息搜索聚焦、页签、点击参数路由，点击前不产生读消息请求；到真人页后的正常 read-through 属于原页面行为，不误判为列表违规。
- [ ] 使用相同可展示文本/能力的两栈场景对照各区域几何，位置误差 ≤1px；无法构造等价业务态的分支分别验证，不对不同内容硬比全页。完整 Backend 字段之外的未知区单独与缺失场景断言，不期待假数据补成 Mock。
- [ ] 运行 `npm run test:e2e:data-source -- e2e/P1展示统一.spec.ts --project=backend-stg --grep 'P1 Backend展示' --workers=1`；所有 API 请求被 route fixture 捕获，零真实栈访问。
- [ ] 运行 `P1_CAPTURE_DIR=ui-regression-output/p1/candidate npm run test:e2e:data-source -- e2e/P1展示统一.spec.ts --project=mock-stg --grep 'P1 Mock视觉' --workers=1`，然后 `UI_VISUAL_GATE=enforce UI_CHANGE_APPROVED=false npm run ui:compare -- --reference ui-regression-output/p1/reference --candidate ui-regression-output/p1/candidate --output ui-regression-output/p1/compare`。比较结果不得有缺失/new/removed/infrastructure；退出 0 仍逐项查看 warning 与图片，任何意外 Mock 视觉差异修复，不放宽阈值。
- [ ] 在最终候选一次完成 `npm test`、`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:e2e:data-source -- e2e/数据源模式.spec.ts --grep 'P4|P7' --workers=1`。前者覆盖所有纯逻辑/组件与视觉比较器单测，后者只运行已有 HTTP fixture P4/P7 业务回归，非真实栈。
- [ ] 运行既有 `UI_VISUAL_GATE=enforce UI_CHANGE_APPROVED=false npm run ui:check -- --base 55c7024fbc98c7565b0eab56745649f310985aac --output ui-regression-output/p1/existing`，保护已有全站 Mock 消费者。该既有 runner 自管临时 detached 参考采集目录并 cleanup，不是新用户实施工作区；不得手动新建持久化工作区。若基线实际产品已变化，以 Task 1 核准的产品基线更新命令并记录理由，不能指向改造后提交自证。
- [ ] 记录精确 commit、命令、退出码、日志/截图目录、运行时和 fixture 来源。未知测试成本如实记录；范围内失败诊断后仅补失效项，不能靠重复跑到偶然通过。提交用例与必要修复。

**完成/停止：** 所有适用 L0–L2 有有效证据且当前 Mock 无意外视觉差异，才进入 ready gate。Browser/依赖缺失属于对应 L0–L2 未完成，不与用户豁免 L3 混淆；无需也不得索取真实栈。

### Task 6: 唯一 final gate、实施异构 review 与合入

**目标/非目标：** 同一实施者负责 review、证据对账、人工 gate、合入；本 Task 不发布站点、不运行 L3、不补其他 P2/P3 功能。

**Files:** 仅本 Plan 的实施证据记录及 Tasks 2–5 范围内 review 修复；task intent 更新走 skill 既有位置。

**接口/依赖：** Task 5 全部责任通过。完整读取 development-workflow `references/final-integration.md`、`assets/final-integration-contract.md` 与 `assets/execution-contract.md`，严格应用 Global Constraints 中 L3 用户覆盖。

- [ ] 冻结候选 commit；Codex 调用 Claude review-loop，Claude Code 调用 Codex review-loop；绑定批准 Spec revision/blob、本 Plan 精确版本和固定 base/head。Reviewer 只读、不运行测试，读取 skill 根相对 `../_shared/review-contract.md`；逐条标注 required/optional 与复杂度，最多 3 轮。
- [ ] 核实并记录每条 finding 的接受/拒绝/延后理由；范围内修复自主执行，补其失效证据并对新候选更新 review。没有未解决有效 required 才继续。
- [ ] 只读 `git fetch origin`，记录 `pre_gate_target_base`、`candidate_commit`、完整测试责任与证据出处、实际 CSS 删除/保留、Mock 视觉比较、L3=N/A 用户排除。展示具体 `git merge --no-edit origin/main` 与 `git push origin HEAD:main` 方案以及需补验条件，等待用户对 final gate 明确确认；此前不合 target、不 push。
- [ ] 确认后 fetch、记录 `final_target_base`，按方案 merge；只解决范围内机械冲突，不 rebase 已 review 候选。按最终 diff 重算完整 L0–L2 责任。仓库当前没有 affected 选择器，不发明此命令；用本计划列明的 npm/Playwright 正式入口及对应消费者对账。未变更候选/输入/环境可零重跑复用，有改动只补可证明失效部分，无法证明则重跑该正式套件并记录 fallback 原因。
- [ ] 对账记录每项 source candidate、runner/config、源码及依赖、fixture、运行时、外部前置、cleanup/修复影响；旧失败不能被更早 PASS 覆盖。本任务 L3 始终 N/A，不执行默认 L3 selection/runner/cleanup 步骤；对本次实际发生的 cleanup 仍核对 L0–L2 影响。
- [ ] 再次 fetch 确认 target 没推进，普通 fast-forward push；target race 或拒绝时保留证据，更新 gate 方案，不强推、不无限追赶。push 成功才报告合入并把 task intent 标 completed。

**Autonomous recovery boundary：** 人工 gate 后范围内确定性修复、受影响 review 和最小补验由同一执行者完成，不重复请求常规修复许可；涉及批准产品/接口改变、target race 需新 gate、或无法取得必要 L0–L2 外部资源时报告具体阻塞。L3 未准备好不是阻塞条件。

## 测试选择五问与责任结论

1. 防什么：展示重复导致 Mock CSS 漂移、缺值收行/假分、Backend 混 Mock、当前意向/授权/已读语义被展示抽取改变。边界在连接层→展示、HTTP fixture→真实模式页面及 DOM→CSS。
2. 最小反馈：Tasks 2–4 的定向 Vitest；CSS 改动即定向 Mock 采集/比较，不等 final gate 才发现漂移。
3. 何时提前验证真实边界：本次不改服务端、协议或事务。若纯前端重构影响请求/序列化/权限，立即用既有 HTTP fixture 与集成测试核对；若修复需要改公开协议或运行真实栈才可判定，停止该扩展、记录重新规划条件，不偷偷恢复 L3。
4. 最终权威：Task 5 的现有 npm、Playwright、视觉比较入口共同覆盖适用 L0–L2，Task 6 review 与最终候选对账；真实栈未验收，发布流程另行负责。L3 none/N/A，不能写真实集成 PASS。
5. 已有证据/成本：规划仅源码和文档检查，已有职位详情及 P7 单测/HTTP fixture/视觉入口可复用；本任务运行时间未知，没有先跑重测试测时。实施记录实际成本，不机械重复 broad gate。

## 文档 review 记录

候选文档范围固定为本 Plan 和本次 Spec。批准 Spec 对象见 header；review 结果与逐条裁决在此追加，不新增独立报告。文档 review 已于第三轮收敛，无未解决有效 required。最后一条 optional 按下方裁决删去冗余记录要求；未改产品范围、批准 Spec 正文或公共接口。

- R1 reviewer：Claude Opus/high，WORKFLOW_DOCUMENT_REVIEW；冻结候选 `c7274929d3b4ea002f34b97dca666e27a8af42b0`，Spec blob `50d47904841ff57b1001b798912b493b82b8db1d`，Plan blob `b545fe50366a64b7aecb59d81791828a17777149`。批准契约仍为 header 精确对象。前后工作树、HEAD、文档指纹 guard 均通过；reviewer 未运行测试。
- R1-1 Important，契约违反，required，复杂度增加：接受。Task 4 补消息长文本/有值变空断言，Task 5 补双宽浏览器场景与时间/截断约束；只扩充现有用例，维护成本对应 Spec §6 已要求的具体布局风险。
- R1-2 Important，可选增强，optional，复杂度降低：拒绝可选的 Mock `资料=undefined` 方案。批准 Spec §3.1 明确将 Mock 公司档读取移到连接侧并向展示传显式资料，建议会保留展示子树静态兜底，不符合本次冻结契约。保留必要的本页投影、不改通用接口；Task 2 补已补全/未补全、不足两段、成立/地址分支的输出对照，覆盖 reviewer 提到的现实漂移风险。
- R1-3 Minor，可选增强，optional，复杂度降低：接受。删除仅正常页面消费、恒 true 的 `更多可用` prop；更多按钮无条件保留，加载/错误页仍由连接层负责。
- planner 自检：Task 标题统一为校验器要求的 `### Task N:`，不改变任务数量或范围。产品/Spec 正文未变。
- R2 reviewer：同一 Claude Opus/high 会话；候选 `5ddf068aaf8a8c81d71e40a8a2208663433db13c`、Plan blob `8bb707073ad12c1c68d6593af0859fa0a9f20f09`。前后 guard 通过、未运行测试。确认 R1 修复与拒绝理由成立；新增 1 条 Important 契约违反/required/复杂度不变：极长标题的绝对零溢出要求与保留原 flex:none/nowrap 冲突。接受，Task 5 改成极长标题相对基准不退化、普通标题下长副标题/摘要继续绝对截断验收；Task 1 补同文本隔离布局样本，并明确其不证明 HTTP 接线。按用户 Mockup 优先约束澄清验收，不改 Spec 或 CSS。

- R3 reviewer：同一 Claude Opus/high 会话；候选 `109ede27b7b812087091eac7a32e9f9811bf9f68`。前后工作树/HEAD/文档指纹 guard 通过，未运行测试；确认 R2 修复成立、R1 裁决保持，无未解决 required。新增 1 条 Minor 可选增强/optional/复杂度降低：既有视觉 schema 和比较器不消费 computed style。接受最小方案，删除 computed style 的额外采集/比较要求，保留标题/时间/行几何及截图；不扩展 schema 或比较器。此纯删除经 planner 核对，不启动超出上限的第四轮。
- 汇总：共 3 轮，2 条 required 均修复并复审核实；3 条 optional 中 2 条接受、1 条拒绝且理由获复审核实。产品测试未运行（规划阶段），文档只读审查不替代实施代码 review。

## 实施证据记录

当前未实施、未运行产品测试。新实施 session 在此记录 Task 完成提交、视觉基准 source SHA、正式命令/receipt、CSS 消费者删除依据、review 裁决、pre_gate_target_base、final_target_base、最终候选和 push 结果。日志及截图放既有忽略目录，不把测试替身记成真实栈验收。
