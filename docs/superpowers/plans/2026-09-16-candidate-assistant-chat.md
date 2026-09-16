# 求职端 AI 聊天接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Claude Code 使用 `superpowers:subagent-driven-development`；Codex 使用 `superpowers:executing-plans`。按下面六个 Task 连续执行，checkbox 跟踪；收尾另列，不计任务数。

**Goal:** 求职端 Backend 可真实聊天，在简报式回复内嵌原生岗位/在谈卡与在谈详情摘要，支持原生详情跳转、关键词追问和安全恢复。

**Architecture:** 复用现有 HTTP 客户端与 Provider 身份栅栏，增加一个助手域 facade、一个窄会话访问 seam 与页面局部 hook。市场卡提取纯展示，求职在谈卡直接消费，固定结果展示使用现有代理气泡框/简报视觉；不添加框架或新依赖。

**Tech Stack:** React 19、TypeScript、现有 CSS Modules、Vitest/Testing Library、Playwright。

**Spec:** `docs/superpowers/specs/2026-09-16-candidate-assistant-chat-design.md`；批准 revision `22f3d7df7ff60f68e972468b3e36cd3389414d5d`，blob `6cfdacd580bb3a64343c009c50e979b90bed113c`。用户批准后仅更新 Spec 状态，正文不变；不得把候选 Plan 当作扩展批准范围的依据。

## Global Constraints

- repository `myaier/agxp-a2a-recruiting-web`，工作区 `.`，当前任务分支 `enable-ai-agent`；集成 target `origin/main`，由最终人工 final gate 再确认实际 SHA/动作，规划不 fetch/merge/push。
- 前端源基线 `e01291de47e4ade2b66ab681e69145e6e32bade8`。后端契约基线 `agxp-monorepo@719ead0a0a4368b4dc2ff7e85d57ab74f47e9095`，文件 `apps/recruitment-bff/openapi/mobile-v1.yaml`；执行环境用调用者提供的 `AGXP_MONOREPO_DIR` 读取该 Git 对象。它必须可用且真实环境具备对应能力；版本漂移先比较助手合同，不猜未知字段。
- 先读 `AGENTS.md`、`CLAUDE.md`、批准 Spec；通过 `git show`/`git rev-parse` 验证批准对象。只动本任务文件，不覆盖用户改动，不创建第二用户工作区。
- 用户明确要求最小实现：两种列表复用原卡组件/样式，缺字段占位；详情摘要组合现成样式和组件。不得另做列表皮肤、通用卡片引擎、主题系统、配置开关或改后端。
- Backend 不回退 Mock；招聘端禁用保持。不得把 Mock 日报、规则操作、漏斗接入真实助手；不修改 P7 真人会话 DTO、未读或分页。
- 所有 API 字段/错误/空值以精确 OpenAPI 为权威。浏览器只传 text，不拼 system prompt、不回传整个历史、不建立关键词匹配器；已有工具结果包含真实字段/ID，实际模型连续追问必须由真实验收证明。
- 本 Plan 内部 helper 可等价调整，但公共签名、产品行为、数据归属、鉴权/幂等边界与测试责任不能现场重设计。预计路径扩大先更新 task intent；实质范围变化停止并报告。
- 执行 skill 与资源按逻辑名称定位，资源以其真实根的相对路径解析，不写入规划机器路径。

## Task index

Task count: 6
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

串行 1 → 2 → 3 → 4 → 5 → 6；不为理论并行新建工作区。Task 3 依赖 1/2，Task 4 依赖 1，Task 5 集成 3/4，Task 6 验证 5。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|助手协议与数据源；独立合同测试|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|2|市场卡最小提取；原页面回归|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|3|三类结果组合；依赖 1/2|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|4|身份 seam 与轮次 hook；依赖 1|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|5|页面接线与导航；依赖 3/4|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|6|聚焦浏览器旅程；依赖 5|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|

Task 1/4/5 reviewer 用较高档处理严格协议、提交不明与身份迟到响应；其他任务主要是已有组件组合，不需提高档位。Codex 始终按当前宿主配置使用通用档位，不解析 Claude alias。

**计划本身复杂度：中。** 多边界接线，但已有路由、样式、协议与状态模式可复用。
**零上下文漂移风险：中。** 后端精确版本及真实运行环境是外部前置，实施接口和行为在本文冻结。
执行模型只按漂移风险选择：使用当前可用的行业 Top 5–10 中高性价比模型；Task 角色表单独细化。

## 冻结生产者/消费者合同

### A. 数据源接口

新增 `src/数据/招聘数据源/助手会话.ts`，导出 DTO 名与函数签名如下。DTO 的完整嵌套形状逐字段来自冻结 OpenAPI 的 `Assistant*` schemas，snake_case 保留；无需复制后端全部业务 DTO。

```ts
export interface 助手会话数据源 {
  读取助手历史(cursor?: string): Promise<AssistantMessagePage>;
  发送助手消息(text: string, idempotencyKey: string): Promise<AssistantMessage>;
  读取助手轮次(turnId: string): Promise<AssistantMessage>;
  重试助手轮次(turnId: string, idempotencyKey: string): Promise<AssistantMessage>;
}
export function 创建助手会话数据源(
  请求: BFF客户端['请求'],
): 助手会话数据源;
```

导出 `AssistantMessagePage`、`AssistantMessage`、`AssistantReply`、`AssistantCard`、`AssistantJobItem`、`AssistantNegotiationItem`、`AssistantNegotiationDetail`。详情 agent_summary 复用 `连续代谈.ts` 的 `NegotiationAgentSummary` 和导出后的 `解NegotiationAgentSummary`，不复制其嵌套证据/总结解码器。

四条路由/正文/状态遵循 Spec §3；GET 不缓存；POST 显式传调用方幂等键。历史 cursor 是非零十进制最多19位，不复用真人会话的 base64url 正则。message_id 为 asm_ +32位小写十六进制，turn_id 为 ast_ +32位；record_id 为 dlg_/mc_ +32位。text trim 后按 TextEncoder 字节数校验 1–4096。response ID、日期、枚举、required/null、薪资周期、finite 数值与数组按 schema 校验。`succeeded` 才能有 reply；其他状态 reply=null；retryable=true 只允许 failed；unavailable reply 的 cards=[]。合法缺失事实 null 显示占位，必需键缺失是契约错误。

未知 card.kind 是唯一的前向兼容边界：不把未知 data 强转成任一 DTO；在解 reply 时跳过未知类型，不展示、不跳转；已知 kind 的非法 data 抛 BFF错误 invalid_response。不修改公共 HTTP 客户端的默认解码策略。

### B. 结果展示接口

新增固定组件 `src/组件/问AI代理/查询结果展示.tsx`：

```ts
export interface 查询结果展示属性 {
  回复: AssistantReply;
  打开岗位: (jobId: string) => void;
  打开在谈: (recordId: string) => void;
  解读在谈: (item: AssistantNegotiationItem) => void;
  解读禁用: boolean;
}
export function 查询结果展示(props: 查询结果展示属性): React.ReactElement;
```

组件负责整个成功助手回复：无 cards 用现有代理气泡；有 cards 用 `代理气泡框 外观="求职" 简报`，正文在前，三类结果按原序内嵌。使用现有 `简报展示.module.css` 的简报头/时间/正文等样式，不调用必须带规则建议的 `简报展示`，不新造消息框样式。新增配套 CSS 仅用于内嵌间距、列表排列和摘要段落。

列表逐项用共享原生卡；项目序号在卡片外显示，查询时间对应每个 card.queried_at。每个列表 data.next_cursor 非 null 时，在该结果区域尾部显示“可继续问‘下一批’”；null 不显示。这是静态提示，不增加分页按钮/API。不把整个回复作为点击区。详情摘要用现有 `白卡`、`在谈阶段区` 与既有文字/色彩样式组合，不新增皮肤。未知/空白字段显示明确未知，数组真实为空显示空态。条件确认 latest_summary 与 summaries 使用已有 DTO，历次总结以原生 details/summary 展开，避免新 accordion 基础设施。

### C. 会话访问与页面 hook

Provider 只暴露一个可空访问 seam，不保存聊天消息：

```ts
export interface 助手会话访问 {
  范围键: string; // 后端环境 + subject + candidate角色 + 真实会话代际
  api: 助手会话数据源;
}
// 应用状态值新增：助手会话: 助手会话访问 | null
export function use助手会话(访问: 助手会话访问 | null): {
  消息: AssistantMessage[]; // 旧到新，message_id 唯一
  草稿: string; 设草稿: (value: string) => void;
  首读中: boolean; 加载更早中: boolean; 有更早: boolean;
  输入禁用: boolean; 错误: string | null; 提交待确认: boolean;
  发送: (text?: string) => Promise<void>;
  加载更早: () => Promise<void>;
  重读: () => Promise<void>;
  重试提交: () => Promise<void>;
  重试轮次: (messageId: string) => Promise<void>;
};
```

访问对象在账号/角色/环境/会话代际变化时失效，Mock/未登录/非 candidate 为 null。创建 seam 在每次请求前检查当前身份，在响应成功/失败后检查捕获的 subject/role/generation；过时结果抛 AbortError，当前 401 走既有 `清账号状态` 全套依赖（与现有会话操作相同，不能只清目录支持的子集）。同 subject 重新登录也必须失效，不仅比较字符串 subject。hook 对范围键/卸载再加本地请求代际，AbortError 不展示为业务失败。

hook 单页局部状态，只有一个活动轮询 timer、一个在飞写操作、一个待确认请求 `{kind, text或turnId, key}`。不引入 reducer 框架、轮次队列、全局快照或持久化发件箱。生成 UUID 使用现有平台方式/crypto.randomUUID，无新库。

### D. 公共市场卡接口

新增 `src/组件/列表卡片/求职推荐卡.tsx`，属性定义放现有 `类型.ts`：

```ts
export interface 求职推荐卡属性 {
  公司: string | null; 公司简介: string | null;
  公司首字: string | null; 公司图片URL?: string | null;
  职位: string; 薪资: string; 标签: readonly string[];
  匹配分: number | null;
  发布人: string | null; 发布人首字: string | null;
  发布人图片URL?: string | null; 发布人底色: string; 发布人字色: string;
  已委托: boolean; 已委托文字?: string; 委托禁用: boolean;
  委托: () => void; 打开: () => void;
}
```

提取 `看市场.tsx` 内现有市场卡 JSX 和同一 `看市场.module.css` 卡片样式，最小方案直接复用该 CSS module，不复制全套 CSS。use适配分 保留市场页面薄连接包装层传入分；头像加载失败属于展示本地状态可保留。未知分复用已有 `卡片分数`（验证已知分视觉与原适配环一致）；Logo null 用求职在谈卡相同中性空位纪律，Mock 未传 URL 保持原语义；非空分含 0 不误判未知。对原页面布局/按钮/导航不做设计调整。

## 测试选择五问与验收责任

1. 防失败：重复提交、迟到跨账号写入/401 清新账号、错误恢复伪成功、未知字段伪造卡面、卡片指向错 ID、提取市场卡后视觉/委托回归、从详情无法回聊天。通过 DTO、hook、Provider、组件、页面、浏览器分层的最小直接消费者验证。
2. 本仓库已有 npm/Vitest/Playwright 入口，没有 `tools/test affected` 或 atomic suite 映射；不引入后端仓库测试基础设施。定向命令在每 Task，完整受影响清单收尾重算；此 frontend-only Plan 不触发后端 TEST_DELTA/SQL 测试。
3. 提前真实边界：Task 1 校验正式 OpenAPI 与 HTTP mock 请求；Task 4 用真实 Provider + 延迟响应验证身份生命周期；Task 6 用浏览器 HTTP fixture 证明导航/布局。它们不能证明实际 LLM 工具结果进入上下文，后者归正式真实环境旅程。
4. final gate 前完成受影响单测、类型、lint、构建和聚焦 HTTP-fixture 浏览器。正式真实后端集成责任 required：Spec §8.6 的助手连续对话旅程；以 `docs/dogfood/真实后端行为验收.md` 的环境/安全来源/证据原则定向执行，不声称现有 B01–B05/H01–H04 已覆盖它，不全跑旧套件。具体 URL、账号、后端 checkout/部署版本、清理和执行动作在人工 final gate 确认；缺前置记 BLOCKED，不伪造 PASS。
5. 现有证据只有源码/合同调查，无本功能实现 PASS 或计时记录；成本未知。规划不为填表跑测试。旧通过结果不是本次实施证据。

### Task 1: 助手 DTO、严格解码与四个数据源方法

目标：实现合同 A，供页面 hook 使用；不改 UI/Provider 生命周期。先核对冻结后端 Git 对象和 required/error schemas；无法取得精确对象时停止本 Task，不凭聊天摘要补全。

预期编辑文件：
- 新增：`src/数据/招聘数据源/助手会话.ts`、`src/数据/招聘数据源/助手会话.test.ts`。
- 修改：`src/数据/HTTP招聘数据源.ts`、`src/数据/招聘数据源/连续代谈.ts`、`src/数据/招聘数据源/连续代谈.test.ts`（只在复用解码导出需要边界断言时）。
- 删除：无。

Consumes：BFF客户端['请求']、连续代谈 NegotiationAgentSummary；Produces：合同 A 的 DTO/facade，并入 HTTP招聘数据源 的交集/创建组合。不得给其他域添加假实现。

- [x] 写表驱动协议测试：4 路由、无正文 retry、调用方 key 原样、GET no-store、200/202 合同、分页、三种已知 card、未知 kind 跳过、非法已知 card 拒绝。
- [x] 增加反例：成功无 reply、unavailable 带 cards、处理中 retryable=true、坏 ID、缺 nullable 必需键、把“中”重复1366次导致4098字节，应在发请求前失败；1365次合法。复用真实 summary decoder 对嵌套证据做校验。
- [x] 运行 `npm test -- src/数据/招聘数据源/助手会话.test.ts`，确认失败由未实现/合同缺口引起。
- [x] 最小实现 facade 和解码，导出既有 `解NegotiationAgentSummary` 不搬迁/改写整个连续代谈域。错误用现有 BFF错误，错误语义遵循 Spec §3 与 OpenAPI status/type；已接受却解码失败由上层视为提交待确认。
- [x] 运行 `npm test -- src/数据/招聘数据源/助手会话.test.ts src/数据/招聘数据源/连续代谈.test.ts`、`npm run typecheck`。预期全部通过，确认该导出不改变既有详情解码。
- [x] 仅提交本 Task 文件：`feat: add candidate assistant data source`。完成条件为调用/解码测试通过；遇后端 schema 与批准契约实质冲突停止报告。

### Task 2: 提取并复用原生市场岗位卡

目标：交付合同 D，保留市场页面行为与原布局。非目标：重做市场、提取其他无关卡片、统一双端样式。

预期编辑文件：
- 新增：`src/组件/列表卡片/求职推荐卡.tsx`、`src/组件/列表卡片/求职推荐卡.test.tsx`。
- 修改：`src/组件/列表卡片/类型.ts`、`src/屏幕/看市场.tsx`、`src/屏幕/看市场.module.css`、`src/屏幕/看市场.test.tsx`。
- 删除：无。

Consumes：现有市场卡 JSX/CSS、卡片分数、公司字标；Produces：合同 D 的纯展示组件。先读取现有 use适配分 与页面两种调用点，不改变字段来源。

- [x] 对原市场用例建立提取前证据：已知公司/职位/分数/薪资/头像、委托按钮状态与导航；必要时补一个缺失分/图片占位的组件行为用例，不做类名大快照。
- [x] 新组件测试先失败，再移入原 JSX，直接复用原 CSS；用 null 控制占位，不构造假的完整市场职位。
- [x] 页面保留薄包装计算真实/Mock 分值，将展示 props 与原回调传给新卡；其他页面逻辑不搬动。
- [x] 运行 `npm test -- src/组件/列表卡片/求职推荐卡.test.tsx src/屏幕/看市场.test.tsx src/组件/列表卡片/卡片分数.test.tsx`。预期原市场行为保持、null/0 明确区分、禁用委托不调用回调、头像失败中性回退。
- [x] 提交 `refactor: share existing candidate job card`。若仅靠复用无法保持既有市场已知值布局，先修提取，不用重新设计样式规避。

### Task 3: 简报式助手回复与三类查询结果

目标：实现合同 B；Spec §4 全字段映射及占位，使用 Task 1 DTO 和 Task 2 原生市场卡。非目标：自由搜索、业务写入、从完整详情 API 补数据。

预期编辑文件：
- 新增：`src/组件/问AI代理/查询结果展示.tsx`、`src/组件/问AI代理/查询结果展示.module.css`、`src/组件/问AI代理/查询结果展示.test.tsx`。
- 修改：`src/组件/列表卡片/求职在谈卡.tsx`、`src/组件/列表卡片/类型.ts`、`src/组件/列表卡片/求职在谈卡.test.tsx`（只新增可选 `禁用?: boolean` 并保持默认可点，以支持不可查看项目）；`src/数据/发现推荐映射.ts`（仅导出既有 `薪资文案`）、`src/数据/发现推荐映射.test.ts`（验证现有薪资格式保持）。
- 删除：无。

Consumes：AssistantReply、求职推荐卡、求职在谈卡、代理气泡框、简报样式、白卡/在谈阶段区；Produces：查询结果展示属性 固定签名。展示组件通过 props 回调导航，不读 Provider。

- [x] 编写三类结果与 unavailable/空列表/缺失事实测试，先运行确认失败；用自造 DTO，不引用演示业务 fixture。
- [x] 组合同一回复内正文+结果。岗位真实字段映射到原卡：薪资复用导出的 `薪资文案(salary_lower, salary_upper, salary_period)`，不另写格式化；标签按 `[office_location, annual_salary_months !== null 时的“n 薪”]` 顺序组成，空地点显示“地点未知”，未提供的招聘类型/办公方式不制造事实。safe_reasons 在每项附属区显示；发布人/Logo/简介/分数未知占位，委托固定 `已委托=false`、`委托禁用=true`，附属区使用现有次要文字样式显示“请进入岗位详情操作”，不得借已委托回执分支改文案。nullable 不等于非法 required 键缺失（Task 1 已负责拒绝）。
- [x] 在谈卡公司/分数占位，城市/薪资/职位真实；phase 映射 accepted=已受理、evaluating=评估中、evaluation_failed=评估失败、refused=未进入在谈、case_started=已进入在谈。只映射现有阶段色系，不编 S0–S3；needs_action 真才显示需要你。每个项目外加序号与“让 AI 解读”，不嵌套 button。
- [x] 列表 next_cursor 非 null 时显示“可继续问‘下一批’”，null 时不显示；并入组件测试验证该文案以及月/日/时薪、年薪月数与地点映射，不增加另一分页入口。
- [x] 详情摘要用白卡+现有阶段/文字样式，展示完整初评证据组及 next_action 的中文文案、最新条件确认；历次摘要可展开。null 区块显式暂无，内部标识 ID 不作正文结论。字段真实值优先，不用前端生成评语。
- [x] `availability=unavailable` 禁用该项目导航及解读；reply unavailable 只显示 text；解读禁用控制所有次级动作；列表和详情都把 record_id 交给打开在谈。
- [x] 运行 `npm test -- src/组件/问AI代理/查询结果展示.test.tsx src/组件/问AI代理/对话展示.test.tsx src/组件/问AI代理/简报展示.test.tsx src/组件/列表卡片/求职在谈卡.test.tsx src/数据/发现推荐映射.test.ts`。验证 cards 顺序、各自时间、无请求/状态副作用、回调精确 ID、没有假统计或假图。
- [x] 提交 `feat: render assistant results with existing cards`；公共签名与 Task 5 一致，否则停下校准接口而非让消费者猜测。

### Task 4: 身份隔离访问 seam 与页面轮次状态

目标：实现合同 C 和 Spec §3，可靠恢复而不建全局聊天状态。依赖 Task 1；只处理数据行为，不设计新 UI。

预期编辑文件：
- 新增：`src/状态/后端/助手会话访问.ts`、`src/状态/后端/助手会话访问.test.ts`、`src/状态/后端/use助手会话.ts`、`src/状态/后端/use助手会话.test.tsx`。
- 修改：`src/状态/应用状态.tsx`、`src/状态/应用状态.test.ts`。
- 删除：无。

Consumes：助手会话数据源、现有 Provider 的 subject/role/会话代际及清账号状态；Produces：合同 C。`创建助手会话访问` 仅封装四方法的真实身份 fence；完整清理回调由 Provider 绑定既有依赖，避免再引入大型 deps 抽象。

- [x] 先写延迟 Promise + fake timers 用例：首次加载→发送→2秒轮询→成功；卸载停止；scope 变化后旧成功/401 丢弃；同账号重登代际变化也丢弃。测试未实现失败后再写代码。
- [x] Provider 增加 `助手会话` 属性，candidate 有效会话才提供；范围键含环境/主体/角色/会话代际。每次请求检查真实代际，当前401统一清账号状态，旧401不清新账号。对原 Provider 测试构造器作最小兼容调整，不绕过门控。
- [x] hook 旧到新去重分页：首读失败输入锁；成功空页允许发送。历史分页以 message_id 合并，新结果只能更新当前已知最新尝试，旧页不能覆盖已经由 retry 更新的 turn_id。首读 processing 恢复轮询。
- [x] 写入用 ref 同步锁，确认受理才清草稿；提交不明保存请求原 key/text 或 retry turnId。重试提交重放同一请求；业务轮次重试才生成新 key。快速双击只一个 POST，失败轮次原 message_id 更新，不重复用户气泡。
- [x] 轮询成功终态停止；读取失败暂停并显示错误，通过重读恢复，不擅自释放 processing 输入锁。提交待确认时重读只读历史，不生成新 key；发现该操作返回权威轮次后才解除待确认。409 in-progress 重读并跟踪活动轮次，不把未受理草稿显示为已发送。
- [x] 覆盖 `uncertain` 无重试、failed 不可重试、retry_not_allowed 重读、unavailable 保留草稿、当前/旧代401、503 同键、成功坏体同键、重试 POST 超时同键、两个响应乱序。
- [x] 运行 `npm test -- src/状态/后端/助手会话访问.test.ts src/状态/后端/use助手会话.test.tsx src/状态/应用状态.test.ts`、`npm run typecheck`。预期所有状态断言和既有 Provider 隔离通过。
- [x] 提交 `feat: manage assistant turns within the current session`。无法沿用现有清理或 fence 时报告具体边界，不新增独立登录状态管理。

### Task 5: 求职聊天页面、固定入口和原生详情返回

目标：将 Task 3/4 接进求职 Backend 页面；招聘端/Mock 保持。原生详情点击和返回是本 Task 完成标准。

预期编辑文件：
- 修改：`src/屏幕/问AI代理.tsx`、`src/屏幕/问AI代理.module.css`、`src/屏幕/问AI代理.test.tsx`、`src/屏幕/P7/Backend会话列表.tsx`、`src/屏幕/P7/Backend会话列表.test.tsx`、`src/屏幕/职位详情.tsx`、`src/屏幕/职位详情.test.tsx`、`src/路由/导航钩子.ts`。
- 新增：无。
- 删除：无。

Consumes：查询结果展示、use助手会话、应用状态.助手会话；Produces：可访问的完整聊天页面及 candidate-assistant 来源窄返回行为。Mock 容器不挂助手 hook。

- [x] 替换求职 Backend 的禁用输入断言为历史加载门/真实发送/轮询结果，保留 Mock 定时器隔离、真实导航与招聘端禁止输入测试。
- [x] Backend 页面使用现有返回栏/真输入条/我方气泡/滚动容器，成功助手回复用查询结果展示；错误/处理中/重试以现有文本按钮语义呈现。顶部加载更早按钮不遮底部输入；接近底部阈值固定80px，旧页加载前后保存 scrollHeight 差值，用户阅读旧消息时新回复不抢滚动。
- [x] 输入及次级解读动作服从 hook 输入禁用。解读发送 Spec §5 可见模板文本（精确可信 record_id），不混入占位事实或注入 prompt。保留原“去市场/看在谈/规则库”导航，快捷能力说明不声称自由筛选/规则修改。
- [x] 求职固定入口摘要改为“查看岗位推荐和在谈进展”，招聘端原文案保留；不新增时间/未读/最近消息来源，不改变P7排序、分类、搜索和已读。
- [x] 岗位项目跳转带 `{来源:'candidate-assistant'}`，在现有导航钩子增加与市场证据对称的窄内存标记/查询/测试复位。职位详情只有匹配来源且存在会话证据时 返回()；刷新证据丢失时助手来源替换跳转到已受保护的 路径.问AI代理，不盲退栈；普通无来源深链保持原兜底，不能借用市场标记。在谈跳转用 record_id 和现有详情返回，不要求 case_id。
- [x] 运行 `npm test -- src/屏幕/问AI代理.test.tsx src/屏幕/企业问AI代理.test.tsx src/屏幕/P7/Backend会话列表.test.tsx src/屏幕/职位详情.test.tsx src/屏幕/在谈详情.test.tsx`。覆盖卡片导航、正确返回、刷新兜底、不可查看、未知提交 UI、重试按钮条件；目标页现有404无需另建错误页。
- [x] 提交 `feat: enable candidate assistant chat and detail navigation`。停止条件：业务页必须靠伪造来源或Mock数据才能打开时，报告真实导航约束，不掩盖。

### Task 6: 聚焦浏览器旅程与展示回归

目标：证明完整页面 HTTP 接线、导航和嵌套布局；不把模拟响应宣称真实 LLM 成功。依赖全部产品 Task 完成。

预期编辑文件：
- 修改：`e2e/问AI代理展示.spec.ts`、`e2e/fixtures/P1展示统一.ts`（仅添加四个助手路径白名单/响应能力）、`e2e/P1展示统一.spec.ts`（仅修改求职入口文案相关断言）。
- 新增：`e2e/fixtures/助手会话.ts`、`e2e/助手会话.spec.ts`。
- 删除：无。

Consumes：Spec 的可观察 UI/HTTP/导航；Produces：有 @backend 标记的聚焦旅程与截图，复用既有完成态用户 fixture，不绕 onboarding，不改全局 Playwright 配置。

- [x] 先编写失败场景：空历史发送→202→processing→三类卡片；点击原生职位/record详情并返回；加载更早消息；切页重进恢复processing；重试消息不重复。fixture 拒绝非白名单 API；不可用目标给真实404页面响应。
- [x] 稳定准备两个同名项目、长职位名、真实0分测试留在原生卡测试、缺图片/薪资nullable与各自查询时间；模拟“第二个”回复只证明前端承载与请求，不称为模型理解测试。
- [x] 更新旧求职 Backend 禁用与入口文案断言，招聘端继续断言disabled；保留两端Mock零助手请求与原简报样式。320/390视口检查页面无横溢出，嵌入原卡区域/头像/字号不重新设计，输入可见、一个消息滚动容器、无按钮嵌套。
- [x] 运行 `npx playwright test --config=playwright.数据源模式.config.ts e2e/助手会话.spec.ts e2e/问AI代理展示.spec.ts e2e/P1展示统一.spec.ts --project=backend-stg`。
- [x] 运行 `npx playwright test e2e/问AI代理展示.spec.ts e2e/P1展示统一.spec.ts --project=mobile-chromium`，复核Mock展示与原市场卡消费者。截图经 runner 输出位置保存并实际查看，不为项目另建报告文件。
- [x] 提交 `test: cover assistant chat cards and native navigation`。浏览器前置缺失时明确阻塞，不改端口/跳过断言拿绿；真实模型旅程仍在后续人工 final gate。

## 实施后收尾（不计入 Task count）

1. 完成执行 skill 要求的宿主内全局 review（未要求则不新增），退出 Task 循环。调用宿主映射的异构 review-loop：Codex→Claude，Claude Code→Codex；绑定批准 Spec 精确版本、最终 Plan 版本与固定候选 diff，共用合同按 review skill 真实根的 `../_shared/review-contract.md` 解析。reviewer 默认不跑测试，轮次/裁决/停止归 review skill；轮间仅修复相关轻量检查。
2. 异构 review 后重算完整 diff 的受影响验证，复用同候选有效证据；该仓库没有 affected wrapper，使用现有 npm 入口跑 Task 1–5 列出的去重测试集合、Task 6 两条聚焦浏览器命令，加 `npm run typecheck`、`npm run lint`、`npm run build`。如 diff 超出上述消费者则按实际补覆盖并解释；不跑全量单测/全量浏览器来替代选择。修复后仅重跑失效子集，不重入 Task/global/异构 review。
3. 展示具体 final gate：候选 commit、目标ref/已知SHA、测试命令与结果、复用证据、部署版本、真实助手旅程及账号/环境/清理前置、拟合入和push动作，等待用户明确确认。此前不 merge target、不正式真实环境验收、不push；缺前置标 BLOCKED。
4. 获批后读取 development-workflow 的 `references/final-integration.md` 和 `assets/final-integration-contract.md`，同步实际 target、记录 final_target_base、重算责任，复用有效验证只补缺口；执行所批准的真实助手定向旅程（普通问答→推荐→在谈列表→关键词/序号选中→详情卡→原生页/返回，同名澄清与重进追问）。日志不记录凭据，不以fixture冒充真实；结论与截图放既有 dogfood 输出位置。
5. 清理后再对账、检查 target 未推进，普通 fast-forward 合入/push，不force。任何后端上下文/查询缺陷不在前端增加假上下文修复；报告边界阻塞，不声称端到端打通。无无关重构/额外文档。维护 task intent 完成状态。

## Spec 覆盖自检

Spec §1–2/7：Global Constraints、Tasks 2/3/5；§3：Tasks 1/4/5；§4：Tasks 1/2/3；§5：Tasks 3/5/6；§6：Task 5 可见ID追问、收尾真实工具链验收；§8：每Task与收尾；§9：本Plan及文档review/双宿主prompt交付。没有增加后端实现、聊天基础设施或新样式体系。

## 实施记录（2026-09-16，Claude Code 宿主）

执行方式：subagent-driven-development，每 Task 独立 implementer + spec/quality 双 reviewer，Plan 角色表档位（Task 1/4/5 spec reviewer opus，其余 sonnet）。

|Task|提交|review 结果|
|---|---|---|
|1|8e5d9b9f feat: add candidate assistant data source|spec ✅/quality ✅（22+88 用例、typecheck；偏离：HTTP招聘数据源.test.ts 同步 4 方法名，先例内）|
|2|7f97ed35 refactor: share existing candidate job card|双 ✅（82 用例回归）|
|3|39522fb7 feat: render assistant results with existing cards|双 ✅（126 用例 + 消费方 138）|
|4|21b44c16 + 65aaaec4（fix round 1：待确认结算基线 id 集、拍判空）|re-review clean（191 用例）|
|5|10372111 + fba84ed4（fix round 1：解读暂存跨待确认恢复）|re-review clean（160 用例）|
|6|ac13f7a7 + 9d98d2d8（fix round 1：布局用例补「下一批」断言、报告更正）|re-review clean（backend-stg 29 + mobile-chromium 32）|

全局 review（opus whole-branch）：Ready to merge，2 Important（旧范围 finally 清新代际锁、解读暂存残留复活）+ 2 Minor，fix wave 62464f24 四条全 ADDRESSED（62 用例 + 两反例 RED 验证），scoped re-review 无新破坏。25 条 deferred minor 已逐条 triage：2 升格入 fix wave，其余可延后或裁定不作为 finding（裁决记录在 session ledger）。

真实 LLM 连续追问旅程（Spec §8.6）未执行，归人工 final gate 定向验收；现有 e2e 为 HTTP fixture，不证明模型理解。

模式：`WORKFLOW_DOCUMENT_REVIEW`，parent scope 已授权。冻结清单只有本 Plan 与对应 Spec；首轮候选 revision `84b56ba8a2645f573d3f331d41984d2658c37d2e`，批准 Spec revision/blob 见头部。Reviewer：独立 Claude CLI，`opus` / `high` / `permission-mode plan`。一轮完成，报告 2 Important + 3 Minor；未运行产品测试，驱动方的 status/HEAD/受审文件指纹 post-round guard 全部通过。

按 receiving-code-review 核实后的逐条裁决：

|Finding|裁决与依据|必要性/复杂度结果|
|---|---|---|
|R1-1：非法已知卡片应降级为逐卡 sentinel，避免首读失败阻止输入|不采纳为 required。批准 Spec §3 要求非法已知数据“显示数据读取失败”，没有规定逐卡降级或允许带病历史发送；Spec §3 同时明确首读失败可重试、首读完成后发送。Plan 的整响应拒绝显示错误满足此约定。后端冻结 BFF 本身严格解码已知卡片，报告给出的新增枚举/坏字段是合同漂移假设，不是当前合法响应反例。引入 sentinel 和新的部分成功语义属于可选增强，本期延后。|optional；避免增加联合状态和部分成功机制|
|R1-2：岗位不可查看时仍允许打开在谈记录/解读|不采纳为 required。核实后端 record 读取确实可能独立于岗位可用性，但用户已批准 Spec §5 对 availability=unavailable 项目的显式禁用例外；同节一般 record 导航规则服从该例外，不存在无法实现的矛盾。提议放开该入口会改变明确批准的交互，且本轮无用户要求覆盖例外；维持原约定。卡面使用“岗位信息不可查看”，不把 unavailable 翻译成未证实的“已下架”。后续产品决定可另行放开，不能借 review 改写 Spec 自证。|optional 产品增强；本轮不变|
|R1-3：next_cursor 提示未落到Task|接受并修复：合同B与Task3补静态“下一批”提示和非空/null断言，不增加分页API。|required 已解决；不变|
|R1-4：地点/薪资映射未冻结|接受并修复：Task3明确地点与年薪月数进标签，导出复用既有薪资文案与测试，避免两套格式化。|required 已解决；降低|
|R1-5：禁用委托槽缺解释|接受并修复：保持未委托+禁用，在项目附属区显示“请进入岗位详情操作”，不扩充组件状态。|required 已解决；不变|

停止依据：驱动方核实后无未解决的有效 required finding，按 shared review contract §5 及 claude-review-loop Step3 一轮结束；不是 reviewer 输出 NO FINDINGS。修复仅为 Plan 细化，未更改批准 Spec 正文；不为 optional 增强循环加复杂度。最终双宿主提示词绑定修订提交与blob，生成后运行 workflow 的 `validate_prompt_grading.py --plan ... --prompt ...`；实际校验结果在交付摘要报告。
