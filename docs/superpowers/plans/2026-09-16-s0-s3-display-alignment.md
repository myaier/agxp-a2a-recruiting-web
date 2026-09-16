# S0–S3 历史代谈与详情展示统一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Claude Code 按 Task count 使用 `superpowers:subagent-driven-development`；Codex 使用 `superpowers:executing-plans`。逐 Task 执行 checkbox，全部完成后进入不计数收尾；本 planning session 不实施。

**Goal:** 历史代谈、S0–S3 进度、职位详情和在线简历以 Mock Up 为视觉基准，两种数据源共享展示，只分别提供数据、状态和回调。

**Architecture:** 复用已有详情外壳、阶段流和资料正文；仅提取历史展示、灰色系统注释，扩展本页有序段内记录。简历归一化从正文搬到数据层。保留现有控制 hooks、DTO decoder、owner 栅栏和动作权限，无新 provider、schema、请求或依赖。

**Tech Stack:** React 19、TypeScript、CSS Modules、React Router、Vitest/Testing Library、现有 Playwright 数据源模式配置。

**Spec:** `docs/superpowers/specs/2026-09-16-s0-s3-display-alignment-design.md`；批准产品版本 revision `31dfb7f013fbf5c689db16cbbe58b00650864638`，blob `4690d718b38fd0df2f69223926b704ba056a3a6d`。2026-09-16 用户批准并追加“本轮不安排 L3 测试”；当前 Spec §12 记录该覆盖。以批准 Git 对象＋这条明确测试覆盖为合同，不以候选最新正文自授范围。

## Global Constraints

- 仓库 `agxp-a2a-recruiting-web`；工作区为用户选定的当前仓库根 `.`；现有分支 `align-s0-s3-backend-mockup`；集成 target `origin/main`（本地 main/origin/main 与分叉基线均为 `e01291de47e4ade2b66ab681e69145e6e32bade8`，不是最终 target 证据）。不自动新建第二工作区，不 stash/reset/clean，不覆盖他人内容。
- 先完整读 `CLAUDE.md`、`AGENTS.md`，核对批准 Spec Git 对象。执行前核对依赖提交及当前真实源码；实现基线若改变，先定位本任务消费者差异，不能把文档行号当保证。后端参考基线 `4f75b8fc890d3e33cbd23a006779c70844b87712` 只读；前端合同足以实施，不要求机器存在原规划目录。
- 外部 skill 按逻辑名解析当地安装目录：`development-workflow` 的 `assets/execution-contract.md`、`references/final-integration.md`、`assets/final-integration-contract.md`；review skill 的真实目录相对 `../_shared/review-contract.md`。开工用 workflow `scripts/task_intents.py start` 登记本任务；扩大编辑路径或接口前 update、检查已有预告；不删除别人的记录。
- 同角色、同展示输入、同状态必须共用组件树与 CSS。Mock 不请求 Backend；Backend 不 import Mock 值表、不得新增逐卡详情请求或跨域补齐。局部展示类型允许 type-only 引用现有类型，不能引入全站 DTO 或配置平台。
- Case 只读当前 Case 已授权冻结职位/简历，pre-Case 只读自身 negotiation；0 有效，null/空数组/已知空字符串分别处理。失败是请求反馈，不能冒充业务缺失。安全 decoder 不放宽；身份/薪资关系/权限不靠阶段、自然语言或空值猜测。
- `fit` 只是公开初评匹配；S0 通过只读该段 state；终局 outcome 只挂实际结束段。初评复评原文仅候选侧时间流一份；公开评估英文 summary 不展示也不自动翻译。未知开放码安全中文回退，用户/代理正文不做下划线替换。
- callbacks/草稿/请求代际/PDF 租约仍由控制层持有。owner、角色、记录更换销毁旧动作；同记录更新保留手选 Tab 和手动折叠；不因切 Tab 卸载控制 hooks。动作权限维持 available_actions 与当前控制条件交集，eligible/next_action 不授予动作。
- 本轮只改 Spec 范围；不改后端 API、状态机、依赖、业务自动翻译或打分算法；不顺便重构真人会话。新增抽象只覆盖本轮实际重复消费者，删除已无消费者的重复 JSX/CSS；尚有消费者的兼容入口保留。
- 用户明确覆盖：development L3 = **none（用户本轮排除）**；不安排真实后端 dogfood、真实账户旅程或实际代理结果验收，记录 N/A（未执行，不是 PASS）。HTTP 全拦截的前端 Playwright 验证只证明布局和前端接线，不升级为真实后端证据。此覆盖适用于 Task、收尾和 final gate 后，不得由默认 workflow 再加入 L3。

## Task index

Task count: 7
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

| Task | 独立交付 | 依赖/验收 |
| --- | --- | --- |
| 1 | 公共初评与终局安全中文字典 | 当前基线；P3、H2 |
| 2 | 两端历史列表共享 Mock 展示 | Task 1 的终局文字接口；H1/H2 |
| 3 | 共用灰注释、有序阶段记录及 Mock 接入 | Task 1 核对类型；P2/P3、X3 |
| 4 | Backend 进度按阶段接线、动作/移交归位 | Task 1、3；P1–P4、X2 |
| 5 | 冻结职位投影、顶栏与 Tab 初始定位 | Task 4；D1/D2、X2 |
| 6 | 简历统一正文输入和匿名顶栏 | Task 5；R1/R2、X3 |
| 7 | 双数据源最小浏览器布局/接线回归 | Task 2、4、5、6；X1–X3及关键 H/P/D/R 跨组件路径 |

按 1→2→3→4→5→6→7 串行，避免多个任务同时改 `详情展示映射.ts`、正文类型或测试大文件。每项提交后可独立编译、通过自身测试；消费上游前记录其精确提交和验证证据，不把未验证草稿当依赖。共享能力先以兼容方式提交于当前分支，再切换消费者；本计划不要求在人工 final gate 前逐项合入 target。

## Task 模型预分配

**计划本身复杂度：高。** 四页、多角色、连续状态与既有隐私/动作控制共用，需检查共享消费者。

**零上下文漂移风险：中。** 已冻结产品来源、字段位置和接口；主要未知是执行时同文件并行改动和局部消费者变化，无外部 schema 开发依赖。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|字典/安全回退；无新增外部依赖|Top 5–10（Claude Code: sonnet）；闭词明确|Top 5–10（Claude Code: sonnet）；核对状态层次|Top 5–10（Claude Code: sonnet）；防重复码表|
|2|历史共享；依赖1|Top 5–10（Claude Code: sonnet）；保留分页控制|Top 5–10（Claude Code: sonnet）；匿名与总数合同|Top 5–10（Claude Code: sonnet）；共享树/分页隔离|
|3|有序记录/Mock；依赖1|Top 5–10（Claude Code: sonnet）；局部可兼容接口|Top 5–10（Claude Code: sonnet）；样式与条数|Top 5–10（Claude Code: sonnet）；折叠/稳定key|
|4|Backend进度；依赖1、3|Top 5–10（Claude Code: sonnet）；固定状态与来源规则|前沿 / 顶级模型（Claude Code: opus）；复核跨阶段权限回归|Top 5–10（Claude Code: sonnet）；保留控制生命周期|
|5|职位/Tab；依赖4|Top 5–10（Claude Code: sonnet）；单响应投影|Top 5–10（Claude Code: sonnet）；空值与冻结来源|Top 5–10（Claude Code: sonnet）；一次初始化与共享投影|
|6|统一简历；依赖5|Top 5–10（Claude Code: sonnet）；搬已有模型|前沿 / 顶级模型（Claude Code: opus）；核查安全资料不能恢复实名|Top 5–10（Claude Code: sonnet）；兼容消费者/删来源分支|
|7|fixture浏览器；依赖2、4、5、6|Top 5–10（Claude Code: sonnet）；可观察验收|Top 5–10（Claude Code: sonnet）；不以fixture证明真实服务|Top 5–10（Claude Code: sonnet）；断言强度与最小范围|

这些是 workflow 档位，不是实时榜单。仅 Claude Code 解析条件 alias；Codex 使用通用档位与本宿主配置，不查 Claude alias。缺必要执行 skill/委派能力时报告具体阻塞，不静默换实施方式。

## 测试选择五问

1. **防什么失败？** 状态错挂/false通过、重复评估、跨段消息/候选私有总结泄漏；分页与owner失隔离；Tab/PDF/动作失效；冻结资料被现值覆盖；同输入异版式和窄屏溢出。纯映射用 Vitest，交互与生命周期用现有组件/hook测试，真实 CSS/路由用全拦截 Playwright。
2. **最小反馈命令？** 每 Task 下列 `npm test -- <精确文件>` 为权威 Vitest 入口；按先失败后实现再通过执行，不为 CSS 复制无意义实现快照。静态改动反馈 `npm run typecheck`，仅在需要时执行；收尾一次 `npm run lint`、`npm run build`（包含 tsc -b，不再同候选额外跑完整 typecheck）及缺失的定向测试。现有仓库无独立 affected selector，按最终 diff 与实际消费者列最小文件选集，记录理由，不新造 runner。
3. **何时提前验证边界？** HTTP shape/owner/权限/在飞状态或PDF控制一旦实质变化，立刻跑既有对应 decoder/hook测试；布局/路由的风险在 Task 7 前无法由 jsdom证明，Task 7 必须浏览器验证。若实施发现必须改后端权限/schema，超出范围先报告，不能以 fixture PASS 掩盖真实边界；本轮不自行启动 L3。
4. **谁最终负责？** 新实施 session 执行者负责全部定向回归、异构代码 review、适用 L0–L2 和 final gate 方案；用户确认后才同步 target/合入/push。X1 浏览器证据由 Task 7提供；真实服务/账户/代理结果边界本轮明确不验证，不能写“全链路通过”。发布不在本任务内。
5. **已有证据/成本？** planning 只核查源码、测试入口和合同，未运行产品测试；耗时未知。复用现有 npm入口、Chrome 和双 Vite fixture模式，不安装新平台，不更新无关全量截图基线。等待保留同一进程句柄，不因工具窗口超时重启套件。

下面各 Task 的测试命令是开发反馈范围；收尾以实际变更与消费者重算，不机械把所有已有效通过命令再跑一次。现有失败先确认是否范围内，不删断言或扩大超时换 PASS。

## 实施任务

### Task 1: 公共初评与终局中文字典

**目标/非目标：** 将本页公开评估、证据、终局可见协议词转为 Spec 附录 A 的中文。保持 decoder/action逻辑；不把公开初评映射为S0通过，不新增总分或后台翻译。

**依赖与入口：** 当前基线。读 `src/数据/连续代谈展示映射.ts::映射公开初评`、`src/数据/MatchCase展示映射.ts` 的终局/阶段文字；批准 Spec A.2/A.4 是完整字典权威。

**预期编辑文件：**
- 新增：`src/数据/代谈结果文案.ts`、`src/数据/代谈结果文案.test.ts`。
- 修改：`src/数据/连续代谈展示映射.ts`、`src/数据/连续代谈展示映射.test.ts`、`src/数据/MatchCase展示映射.ts`、`src/数据/MatchCase展示映射.test.ts`。
- 删除：无。

**接口（同仓库局部纯函数，不接 raw response）：**
```ts
export type 核对结果 = '通过' | '不匹配' | '待确认' | '未完成' | '核对中';
export function 公开初评决定文案(decision: string | null): string;
export function 公开初评过程文案(state: string | null): string;
export function 初评证据文案(
  group: 'matches' | 'conflicts' | 'unknowns',
  evidence: { dimension: string; code: string },
): { 项: string; 结果: 核对结果 };
export function 代谈终局文案(
  outcome: string | null, code: string | null,
): { 状态文: string; 原因: string; 色调: '成功' | '提醒' | '中性' };
```
`completed` 的成功事实由调用者按 lifecycle处理，不传成 outcome猜测。未知 decision/state给“初评结果暂未提供/初评状态暂未提供”；未知 outcome/code为“已结束/结束原因暂未提供”。所有已知映射按 Spec，code具体说明优先、同义去重；不能把未知code原词带出。`项` 是完整可见句（如“招聘类型：匹配”“薪资条件：暂无法比较”“毕业届别：不限”“经验要求：待招聘方确认”“学历要求：待招聘方确认”“信息不足，待确认”）；`结果` 仅决定图标/色调，不作为后缀自动拼接。旧Mock `核对中` 仅在项中未承载检查状态时沿用现有次要状态字，不能给待确认/未完成追加“核对中”。无需另建同义的匹配枚举或结论文案字段。证据项无 source；同一输入恒相同，不读时间、Context或全局表。既有 `映射公开初评` 的原返回结构本 Task 可保留兼容，决定/证据行改为中文，不对其英文 summary造翻译；顶部删除由Task4完整交付。

- [ ] 核对Spec A.2/A.4；写表驱动测试：三decision、四evaluation.state、13维度×三组、七outcome、四附加终局code、五特殊证据code、未知维度/码。断言上述六种完整句仅出现一次且无附加“通过/待确认”重复后缀；状态只控制图标/色调，技术失败无成功勾。
- [ ] 用 `npm test -- src/数据/代谈结果文案.test.ts` 确認失败源是未实现的新行为。
- [ ] 实现最小字典与纯函数；将已有公共初评可见决定/证据和终局文字接上；不做全站翻译模块。阶段内部键不改，详情显示名“需要协调”在详情投影统一，不盲改全站卡色系键。
- [ ] `npm test -- src/数据/代谈结果文案.test.ts src/数据/连续代谈展示映射.test.ts src/数据/MatchCase展示映射.test.ts`。预期全通过；断言 unknown不泄码、known policy细因不丢、fit不改P5 state、不引入动作。
- [ ] 核对diff仅预期文件并提交 `feat: localize negotiation evaluation and outcomes`。

**完成/停止：** 中文接口与消费者测试通过、现有解码边界不变。若必须放宽decoder接纳未知闭合enum才通过，停止并报告合同变化；不得把未知变成功。

### Task 2: 两端历史列表共用 Mock 展示

**目标/非目标：** 提取Mock页壳和卡片，实现相同版式；保留候选单集合、招聘双架独立分页，不新增fetch/筛选或卡上恢复动作。验收H1/H2。

**依赖：** Task1已提交的 `代谈终局文案(outcome, code)` 接口及测试通过证据。读Mock `归档谈判.tsx`/`企业归档.tsx` 和P5 `MatchCase历史.tsx`，保留其owner/request/cursor守卫。

**预期编辑文件：**
- 新增：`src/组件/历史代谈展示.tsx`、`src/组件/历史代谈展示.module.css`、`src/组件/历史代谈展示.test.tsx`、`src/数据/历史代谈展示映射.ts`、`src/数据/历史代谈展示映射.test.ts`。
- 修改：`src/屏幕/归档谈判.tsx`、`src/屏幕/企业归档.tsx`、`src/屏幕/我的功能页.module.css`、`src/屏幕/企业归档.module.css`、`src/屏幕/P5/MatchCase历史.tsx`、`src/屏幕/P5/MatchCase历史.test.tsx`。
- 删除：无整文件；只删全仓搜索确认无消费者的历史专用重复样式。

**接口：** 在 `历史代谈展示.tsx` 导出以下本页类型与组件。壳只持展示；加载与副标题由连接层持有。
```ts
export interface 历史代谈卡信息 {
  键: string; 标题: string; 职位: string; 画像: string | null;
  图片URL: string | null; 字标: string | null;
  结果: { 文案: string; 色调: '成功' | '提醒' | '中性' };
  原因: string; 阶段说明: string; 时间说明: string | null;
  打开: () => void;
}
export function 历史代谈卡(props: { 信息: 历史代谈卡信息 }): React.ReactElement;
export function 历史代谈外壳(props: {
  返回: () => void; 数量说明: string | null; children: React.ReactNode;
}): React.ReactElement;
```
壳包含返回栏、固定说明条、18px滚动内边距。列表状态继续由P5连接器组合现有加载/重试/空态和共享卡；为从P5控制层给壳同次渲染的计数，优先让其直接拥有共享壳（增加 `返回` prop并同步两个路由调用），不建跨层计数Context或effect回传。Mock连接器同样调用壳，精确总数；Backend只已加载数。

映射文件接收现有 `NegotiationCard` 或 `P5列表项` 及 `打开`回调，导出 `从候选历史到卡(card: NegotiationCard, 打开: () => void): 历史代谈卡信息`、`从招聘历史到卡(item: P5列表项, 打开: () => void): 历史代谈卡信息`；只在对应历史分支调用。Mock在其连接器原位映射已有归档条，不把Mock值表导入Backend映射。

- [ ] 添加卡DOM/可访问按钮/媒体失败测试；先断言Backend卡与Mock同props同DOM/CSS，不用快照冻结不同数据整页高度。
- [ ] 添加映射反例：completed无额外原因、ended semantic_not_fit、未知码、无Case初评失败、finalized/archived/updated三级标签、招聘合法alias但无画像、无身份图标、不取identity。
- [ ] 复制Mock卡/说明条样式到共享module，接入四个角色×来源入口。保留 `14px 18px 24px`、卡 `13px 14px`，gap11、margin10；结果成功/提醒/中性按明确事实。Backend缺logo用中性图位；Mock字标允许自带。
- [ ] 保留服务端顺序、canonical record_id/case_id路由、无total不显示假总数；招聘两架标题/独立加载更多/失败不互清，未开始不报0。空态/错误/旧数据刷新失败均在共享壳内。说明替换为Spec §4.1固定中文。
- [ ] `npm test -- src/组件/历史代谈展示.test.tsx src/数据/历史代谈展示映射.test.ts src/屏幕/P5/MatchCase历史.test.tsx`。预期分页/迟到结果隔离、零轮询、单架失败保另一架、点击导航均通过；不因卡造逐条详情请求。
- [ ] 全仓 `rg` 核对抽出类名消费者后仅删无用CSS和重复JSX；提交 `refactor: share mock history layout across data sources`。

**完成/停止：** 四入口同共享展示，控制测试通过；若发现历史DTO不含某字段，按Spec缺失占位，不能补读其他域。任何新增业务请求/身份披露需求停止。

### Task 3: 共用灰色注释与有序阶段记录，迁移 Mock

**目标/非目标：** 保留Mock轴线、气泡与小结，增加一次有序遍历支持；灰注释供原往来记录和阶段流真实复用。此Task不重构真人直聊、不更改Backend动作。验收P2/P3/X3的展示侧。

**依赖：** 当前基线；核对 `阶段对话流.tsx`、两个Mock详情、两个往来记录的所有调用与样式。Task1的 `核对结果` 作为共享核对项类型。

**预期编辑文件：**
- 新增：`src/组件/对话系统注释.tsx`、`src/组件/对话系统注释.module.css`、`src/组件/对话系统注释.test.tsx`。
- 修改：`src/组件/阶段对话流.tsx`、`src/组件/阶段对话流.module.css`、`src/组件/阶段对话流.test.tsx`、`src/屏幕/往来记录.tsx`、`src/屏幕/往来记录.module.css`、`src/屏幕/企业往来记录.tsx`、`src/屏幕/企业往来记录.module.css`、`src/屏幕/在谈详情.tsx`、`src/屏幕/候选详情.tsx`、`src/屏幕/在谈详情.test.tsx`、`src/屏幕/候选详情.test.tsx`。
- 删除：无整文件；去除已迁移的屏内系统胶囊重复JSX/CSS。

**冻结接口：** 在 `阶段对话流.tsx` 导出，保留现有附件/尾部/确认总结等槽。
```ts
export type 段内记录 =
  | { kind: '气泡'; 编号: string; 方: '我方' | '对方';
      角色: string; 时间: string | null; 内容: string;
      附件?: { 文件名: string; 说明?: string } | null }
  | { kind: '注释'; 编号: string; 标签: string | null;
      时间: string | null; 内容: string };
// 分段项增量：
// 态: '已完成' | '当前' | '未到达' | '已结束'
// 记录?: readonly 段内记录[]
// 核对清单?: { 项: string; 结果: 核对结果 }[]
// 默认展开?: boolean (现有字段保留，非新增；只在没有手动覆盖时生效)
// 可展开?: boolean (仅允许显式pre-Case信息/权威动作访问，不改变业务阶段)
// 展开状态?: boolean; 切展开?: (展开: boolean) => void (可选受控；两项配对)
```
`对话系统注释` props `{ 内容: string; 标签?: string | null; 时间?: string | null }`，同一灰色居中CSS，长文换行。新记录无时间排序字段，组件从不排序。`记录`未传才允许暂时使用旧数组兼容入口；传空数组即为空，不能 fallback旧内容。Mock连接器按原剧本顺序把 `对话条` 和用户叮嘱/回执投为记录，保留附件、角色、左右与时间，不能把原附件从气泡丢掉。灰注释不计条数；每条问答/叮嘱/代理回执气泡按现有发言单位计数。

- [ ] 写有序输入渲染测试：注释/问/答/注释顺序、标签和长文、灰注释不计条数、空数组不回落旧数据；passed可折叠、ended非成功勾且默认开、未到达默认不可展开。
- [ ] 提取原Mock系统胶囊样式（font11.5/line17/padding4 11/radius9与灰色令牌），先接回两个往来记录消费者；不可只新增无人用组件。
- [ ] 扩展阶段输入和渲染，灰注释走共享件；核对清单明确不匹配、待确认、未完成不同于核对中。原passed图标不套ended；保留真实附件入口常驻能力。
- [ ] 将两个Mock详情适配到 `记录`；公开内容/脚本顺序保持，原用户气泡与回执亦进入相同遍历。维持状态机与本地动作，不引入HTTP。两个Mock详情连接器各自持有按stage的手动展开覆盖，向阶段流传受控对；切Tab保留、换记录重置，不能仅依赖被Tab卸载的阶段组件本地集合。
- [ ] 支持连接层可选受控展开；不传时保留本地手开/手收集合。受控值不被默认展开覆盖；未到达必须显式可展开才允许信息/合法动作区可达。当前段引用应定位实际当前段；无当前但有结束段时定位结束段，不能因增加“已结束”态丢失原自动定位。
- [ ] `npm test -- src/组件/对话系统注释.test.tsx src/组件/阶段对话流.test.tsx src/屏幕/在谈详情.test.tsx src/屏幕/候选详情.test.tsx`。预期上述行为与原Mock动作回归通过；原往来记录灰注释视觉由Task7浏览器检查。
- [ ] 搜索迁移消费者，提交 `refactor: share ordered stage conversation rendering`。

**完成/停止：** Mock和原往来记录已用共享注释，Backend旧输入兼容可编译，新接口有验证。若对话条存在上述接口未覆盖的真实展示字段，先用当前Mock必要字段最小扩展并记录，不删除功能凑类型、不扩大成全站事件协议。

### Task 4: Backend 进度按阶段重排并保留全部控制能力

**目标/非目标：** 删除顶部原始初评/状态/终局堆叠，把状态、初评证据、时序记录、结束原因与移交放正确阶段。保留pre-Case、retention、v1/v2和动作授权；不改变服务器状态。验收P1–P4。

**依赖：** Task1字典，Task3 `段内记录` 与可受控展开接口已验证；源入口 `use后端详情控制.ts` → `后端正常详情.tsx`，投影 `MatchCase展示映射.ts` → `详情展示映射.ts`。确认新接口存在再开始。

**预期编辑文件：**
- 修改：`src/数据/MatchCase展示映射.ts`、`src/数据/MatchCase展示映射.test.ts`、`src/数据/连续代谈展示映射.ts`、`src/数据/连续代谈展示映射.test.ts`、`src/数据/详情展示映射.ts`、`src/数据/详情展示映射.test.ts`、`src/屏幕/详情控制/后端正常详情.tsx`、`src/屏幕/详情控制/后端正常详情.test.tsx`、`src/组件/阶段对话流.tsx`、`src/组件/阶段对话流.test.tsx`、`src/组件/在谈详情/终局区.tsx`、`src/组件/在谈详情/终局区.test.tsx`。
- 新增：无。
- 删除：无整文件；去掉顶部 `公开初评托盘` 及其调用、废弃段底Agent总结重复渲染；其他仍被使用的导出不强删。

**数据/接口合同：**
- 保留 `从P5到详情分段` 的已有调用入口，扩展同文件输入只接已解码P5/Negotiation展示数据；产出 `分段项[]` 的 `记录`。需要保留排序时间时在现有映射视图消息/总结行追加 `发生于: string | null`（原 occurredAt），不能只留HH:mm后猜日期。不得为排序引入第三个事件DTO层。
- `映射公开初评` 增量产出 `决定文: string`、`核对清单: {项:string;结果:核对结果}[]`，只来源 `agent_summary.public_evaluation`。使用Task1函数；停止产出用于上屏的英文summary/原code字符串；所有消费者一并迁移。
- 以消息自身stage归属；候选S0 `screeningRecords.summaries` 唯一时间流来源，招聘不显示；condition_confirmation/latest_summary不重复。用日期epoch毫秒升序，tie稳定按输入遍历序（summaries→messages→有效transcript→receipts）；缺失/非法时间保留原序并放有效时间之后，不造当前时刻；同一来源只按稳定ID去重，不按文本删掉不同事件。
- `case_advanced`无正文不显示；有价值的case_created/decision_continue/resume_submitted用中文注释。case_ended已由阶段结果表达不重复；有正文的系统事件保留语义。接线后的正式回执仍以本人/代理身份而非对端气泡显示；failure_history非空按真实时间的安全中文注释去重，空不占位。
- `分段项.状态文` 承载Spec A.2.1胶囊：pending未开始；active默认进行中，有本人权威待办为需要你、有对方待办为等待对方（不能把所有needs_user当本人）；passed已通过，S3且双方完成事实为已确认；ended按实际结束段outcome。不以summary自然语言决定状态。
- S0摘要=真实阶段结论＋注明“公开资料匹配检查”的决定与证据；S1/S2/S3核对项只反映自身状态。done=false终局未完成，只有明确 semantic_not_fit且resume_screened=false可文案“简历初筛未通过”。技术失败不推不匹配。
- 结束状态/原因/结束时间只入actual ended stage。当前步骤/round来自当前段，round_budget不写死3；无需填零轮假对话。S1 reconsider中性窗口说明保留，按钮继续现有actions权限；S3 confirmation_summary固定四节、version冲突及终局移交保留。
- `终局区`只作现有移交展示复用时传 `摘要:null` 并装S3尾部，pending不可点击、ready有合法坐标才允许。正常页无顶部终局，但retention不擅自造阶段。
- pre-Case四段仍pending，S0为“未开始”，通过 `可展开:true/默认展开:true` 提供初评过程及失败retry/archive动作信息区域。不要为打开区域设active/passed；解析失败视图不走正常骨架。
- 由 `后端详情渲染` 持各stage手动展开覆盖值，给阶段流受控props；记录/owner key更换重置。同记录轮询及切Tab、pre-Case→Case保留覆盖。无手动覆盖时当前或ended默认开、passed默认关；合法动作确保段可展开访问。

- [ ] 建去标识化等价fixture于现有测试：public fit，S0 passed且initial/reeval两条；screening_records混有S1两条消息；S1 ended semantic_not_fit；S2/S3 pending；eligible=true但candidate动作空。断言中文、逐条一次及S1消息不留S0；另覆盖active本人待办/对方待办和S3双确认已确认、仅到S3尚未双确认的反例。
- [ ] 先跑 `npm test -- src/数据/详情展示映射.test.ts src/屏幕/详情控制/后端正常详情.test.tsx` 得到对应新行为失败。
- [ ] 更新来源投影和排序/去重，接上Task3记录渲染；结束阶段状态、时间/轮次/证据归位。阶段上方只剩请求反馈，删除三块重复UI。
- [ ] pre-Case/retention各自安全处理；阶段尾部继续组装原动作卡和S1附件、S3移交；不得把PDF hook移入资料Tab。迁移受控展开，保留手选状态。
- [ ] 核对所有消费者后，移除已不再使用的段底Agent总结入口；旧独立数组如还有真实消费者只在连接侧适配，不保留两套正式记录渲染。更新注释，不留“初评必须段底”的旧承诺。
- [ ] 跑 `npm test -- src/数据/MatchCase展示映射.test.ts src/数据/连续代谈展示映射.test.ts src/数据/详情展示映射.test.ts src/组件/阶段对话流.test.tsx src/组件/在谈详情/终局区.test.tsx src/屏幕/详情控制/后端正常详情.test.tsx`。
- [ ] 跑受影响控制消费者 `npm test -- src/屏幕/详情控制/use后端详情控制.test.tsx src/屏幕/详情控制/use后端详情动作.test.tsx src/屏幕/详情控制/useCasePDF预览.test.tsx src/屏幕/P5/MatchCase详情.test.tsx`。沿用v1只读/S0S1私有note/S2 exchange_ref及unknown/S3 summary_version/409/PDF授权与revoke断言；如出现界面挂载回归，在本Task修复，不重写协议。
- [ ] 提交 `feat: align backend negotiation progress with mock stages`。

**完成/停止：** 示例有“初评→问→答→复评”且无顶部大段，S0 passed与S1不匹配同时正确；候选零重新考虑按钮，初评建议不生成待办。若需要改decoder/actions白名单才能摆放，停止检查设计，不扩大授权。

### Task 5: 冻结职位统一投影、顶栏与资料 Tab 深链

**目标/非目标：** 同记录摘要/冻结资料补现有槽；顶栏同薪资，空简介语义正确，首次深链定位。职位正文继续一份；不新增字段面板、不拉当前职位补历史。验收D1/D2及X2。

**依赖：** Task4正常/pre-Case连接与Tab owner保持；读 `src/数据/详情展示映射.ts`、`连续代谈展示映射.ts`、`职位资料.tsx` 和路由query现有读取方式。

**预期编辑文件：**
- 修改：`src/数据/详情展示映射.ts`、`src/数据/详情展示映射.test.ts`、`src/数据/连续代谈展示映射.ts`、`src/数据/连续代谈展示映射.test.ts`、`src/组件/在谈详情/职位资料.tsx`、`src/组件/在谈详情/职位资料.test.tsx`、`src/屏幕/详情控制/后端正常详情.tsx`、`src/屏幕/详情控制/后端正常详情.test.tsx`、`src/屏幕/P5/MatchCase详情.test.tsx`。
- 新增：无。
- 删除：无。

**接口：** 在现有 `详情展示映射.ts` 导出 `投影冻结职位摘要(摘要: {职位:string;城市:string;薪资:string;技能:readonly string[]|null}, 冻结: BFF安全职位资料|null): {职位:string;城市:string;薪资:string;技能:readonly string[]|null}`。它用于 `从冻结职位到资料` 与两种Backend顶栏映射，所有输入来自同一记录同一次响应。原摘要有效非空优先；冻结title/location补空；skills只摘要原值。薪资完整合法 lower/upper/period且lower<=upper才格式化，0不当false；单值上下限相等用既有简洁格式，month K/day 元/天、hour 元/时，示例20-30K。缺成员、非法数字或倒置保持缺失，不猜period；无需年薪乘月数。

- [ ] 映射测试固定矩阵：public非空优先；20/30/month；日/时；0；缺上下限/周期；倒置；冻结null；只缺title/city；两个record异值不串。Case与pre-Case均验证顶栏/Tab使用同投影。
- [ ] 投影摘要并接线，S0–S2候选顶栏职位·公司和分数；S3职位与薪资，副标题非空拼接无尾随分隔符。match_score=null为“—”，0保留。
- [ ] 公司简介 `''`显示“暂无公司介绍”，null为缺失；其他字段不被全局非空清洗改语义。office_address仍只公司地址，不用office_location补。无公司ID按钮禁用、有值变空撤旧回调；logo/avatar坏图沿用中性图位。
- [ ] `后端详情渲染` 的useState懒初始化读query：candidate只job，recruiter只resume，否则进度。后续同记录query不抢手选Tab，换record按新query初始化；pre-Case→Case不重置。保留现有router，不加导航历史。
- [ ] `npm test -- src/数据/详情展示映射.test.ts src/数据/连续代谈展示映射.test.ts src/组件/在谈详情/职位资料.test.tsx src/屏幕/详情控制/后端正常详情.test.tsx src/屏幕/P5/MatchCase详情.test.tsx`。断言无第二正文/新HTTP，缺匹配证据仍保留分析标题，正文原文不翻译，媒体/导航/null清空正确。
- [ ] 提交 `fix: align frozen job details and initial detail tabs`。

**完成/停止：** 单一投影同时服务顶栏和Tab，深链与刷新规则通过；若需要当前Job补齐或擅改薪资单位合同，停止而非猜测。

### Task 6: 在线简历唯一展示输入及招聘匿名顶栏

**目标/非目标：** 移出正文双归一化，统一正文模型；Backend详情保留匹配分析缺失区和完整布局；画像同safe resume来源。保持独立匿名简历的默认隐藏空段行为。验收R1/R2/X3；不新增实名恢复权限、薪资数字或项目日期。

**依赖：** Task5顶栏/资料接线稳定；读取 `在线简历正文.tsx` 的 `正文内容` 和两归一函数、`在线简历展示映射.ts`、独立 `匿名在线简历.tsx::简历正文`。保留BFF→安全展示映射已有授权语义。

**预期编辑文件：**
- 新增：`src/数据/在线简历正文映射.ts`、`src/数据/在线简历正文映射.test.ts`。
- 修改：`src/组件/在谈详情/类型.ts`、`src/组件/在谈详情/在线简历正文.tsx`、`src/组件/在谈详情/在线简历正文.test.tsx`、`src/数据/详情展示映射.ts`、`src/数据/详情展示映射.test.ts`、`src/屏幕/候选详情.tsx`、`src/屏幕/候选详情.test.tsx`、`src/屏幕/匿名在线简历.tsx`、`src/屏幕/匿名在线简历.test.tsx`、`src/屏幕/详情控制/后端正常详情.tsx`、`src/屏幕/详情控制/后端正常详情.test.tsx`。
- 删除：无整文件；正文内两归一函数和 `资料模式` 分支移除，旧 `在线简历展示资料` 保留作为安全数据适配边界而非第二正文props。

**接口：** 将现有内部 `正文内容`（头区、适配分、自述、期望、经历、项目、教育、技能）及其子类型原字段搬到 `类型.ts` 导出为 `在线简历正文内容`；不是新建另一份字段近似DTO。将经历的 `公司/公司实名` 收敛为已授权显示的 `公司`， renderer不做实名决定；Mock原 `真名` 对公司字段的合法恢复逻辑在Mock适配时执行，Backend永不读identity恢复。
```ts
// src/数据/在线简历正文映射.ts
export function 从Mock到简历正文(输入: {
  档: 匿名简历档 | null; 真名: string | null;
  求职状态: string | null; 薪资结论: string;
}): 在线简历正文内容 | null;
export function 从安全资料到简历正文(
  资料: 在线简历展示资料 | null,
): 在线简历正文内容 | null;
// 类型.ts；替换旧双源props，函数名 在线简历正文 保留
export interface 在线简历正文属性 {
  内容: 在线简历正文内容 | null;
  对齐行们?: 对齐行[] | null;
  已确认?: boolean;
  完整布局?: boolean;
  缺失说明?: string | null;
}
```
`从安全资料到简历正文`保留null/[]、遮蔽公司“未披露”、日期未知/有开始才至今、项目日期null、批注null、未知薪资关系null和无一致性条；不读Mock表。`内容.适配分`可空不影响完整布局显示匹配标题；对齐证据不存在时明确缺失，不从公开matches重建。独立 `简历正文` 导出保留调用者旧props形状，只在包装中调用Mock适配+新正文，默认 `完整布局:false`。Mock详情显式true。

招聘顶栏在 `从P5到详情顶栏` 用同一 `candidate_resume` 安全摘要/最近职位；必要时复用现有 `从BFF到在线简历展示` 产物，禁止拉open/current resume补齐；标题不填真名/alias，岗位上下文单独保留。页尾“已确认”只来自双方确认完成事实，不能stage===S3。Mock也从既有双方状态传，不扩充事实。

- [ ] 先写两来源归一化测试：等价输入同内容、Backend遮蔽公司不复原/无项目日期/无薪资数字，已知空/缺失分别保持；逐段对比原Mock归一语义。
- [ ] 搬已有模型与归一化并修改正文props，保留单份JSX/CSS；正文不再识别数据源。完整布局即使Backend资料有值也保留分析标题与缺失提示。
- [ ] 同时迁移Mock详情、Backend详情与独立匿名页兼容包装，避免半迁移破坏类型；仅连接器决定来源，Mock真名参数不进入Backend模型。
- [ ] 招聘匿名顶栏与正文同源安全摘要；合法有值变null立即清旧画像。修正双方完成页尾条件，未双确认/仅进入S3不得宣称可直接沟通。
- [ ] `npm test -- src/数据/在线简历正文映射.test.ts src/数据/在线简历展示映射.test.ts src/数据/详情展示映射.test.ts src/组件/在谈详情/在线简历正文.test.tsx src/屏幕/匿名在线简历.test.tsx src/屏幕/候选详情.test.tsx src/屏幕/详情控制/后端正常详情.test.tsx`。预期顺序/完整缺失块/独立默认/冻结隐私全部通过。
- [ ] `rg` 检查正文无 `资料模式`、Mock值import或raw DTO；所有旧props调用只存在兼容包装边界。提交 `refactor: normalize resume data before shared presentation`。

**完成/停止：** 一个正文输入，双来源一致完整布局，独立页原默认不变；若要求恢复Backend公司实名或填候选薪资数字，超Spec隐私边界停止。

### Task 7: 双数据源定向浏览器回归

**目标/非目标：** 补足CSS、真实路由和跨组件可用性的证据；全量拦截HTTP，拒绝意外真实请求。不是L3，不证明后台真实状态推进，不扩大为全站视觉平台。

**依赖：** Task2/4/5/6精确提交与定向测试已通过。读 `playwright.数据源模式.config.ts`、`e2e/数据源模式.spec.ts` 现有P5 fixture/handler与“在谈详情完整布局”用例。复用同文件helper，不另抽整个巨大fixture框架。

**预期编辑文件：**
- 修改：`e2e/数据源模式.spec.ts`。
- 新增：无。
- 删除：无。

**Fixture/验收合同：** 新增describe标签 `S0-S3展示统一 @s0-s3-display`，每条另带准确 `@mock` 或 `@backend`；使用现有严格wire envelope/真实decoder，不能stub React hook绕过解码。既有P5 fixture默认continuity_version=1；本Task显式给v2样本补全必需连续字段，不能只改version。测试匿名合成ID/文案，禁止保存用户完整个人payload。

- [ ] 增补/更新旧断言：公开summary大段和段底初评被删除是有意变更，改为中文证据+有序灰注释；不要让旧用例仅以不存在无意义断言通过。更新受本次界面影响的旧测试时也添加 `@s0-s3-display`，纳入同一次最小选集，不夹带未改全域旅程。
- [ ] 历史双角色、双来源：同一共享卡/壳布局；Backend候选单架、招聘双架一侧失败可重试；已加载数无假total；点击canonical路由。量测18px页边距、13/14卡padding、gap11和margin10，检视卡字段顺序，不逐像素要求不同文本等高。
- [ ] 候选v2核心样本：默认S1 ended展开且非勾，手开S0验证初评→问→答→复评各一次，顶部无公开大段/终局/重复轮次；S1 question/unknown answer只在S1；candidate eligible但无action按钮。刷新及Tab来回不丢手动折叠，消息条数不算灰注释。
- [ ] 招聘查看同案仅安全公开事实，无候选私有summaries；S1已授权PDF入口常驻，资料Tab切换不丢动作草稿/租约（实际revoke细节由hook单测负责）；S3固定总结和移交pending禁用/ready可用保持。
- [ ] job深链验证20-30K回退、已知空intro与缺失、无公司ID禁用；resume深链验证顶栏同safe summary、匹配区缺失但标题在、遮蔽公司/无项目日期/未双确认不承诺沟通。模拟有值→空、切记录不闪前记录内容。
- [ ] pre-Case四段未开始但初评/合法retry可访问；Mock同props共享版式且对/api请求计数为0。往来记录原系统胶囊与新段内注释共用样式，独立匿名简历默认行为保持。
- [ ] 上述核心四页在320×568与390×844各覆盖完整、部分缺失、长文/终局代表场景，断言document与主要滚动容器scrollWidth不大于clientWidth（允许1px取整误差）、按钮可达、长注释换行。保存定向截图到Playwright现有test-results，不改全量视觉基线。
- [ ] 先 `npm run test:e2e:data-source -- e2e/数据源模式.spec.ts --project=mock-stg --project=backend-stg --grep '@s0-s3-display' --list` 核查双项目选集非空且仅本轮用例；再去掉 `--list` 加 `--retries=0` 执行。预期所有被选用例通过，意外网络请求使测试失败。不能把选择0条记PASS。
- [ ] 提交 `test: cover shared S0-S3 layouts across data sources`。记录实际选集、候选SHA、截图/trace路径和失败修复，不提前启动真实后端。

**完成/停止：** H/P/D/R关键跨组件路径与X1-X3已有浏览器证据；端口/Chrome/依赖不可用记录环境阻塞，不连接真后台替代、不自动装新测试平台。

## 实施后收尾（不计入 Task count）

1. 全部Task提交与执行skill要求的宿主内全局review完成后，退出Task循环。冻结候选commit；Codex调用 `claude-review-loop`，Claude Code调用对应Codex异构只读review-loop，固定批准Spec revision/blob、用户no-L3覆盖及本Plan版本。reviewer不跑测试、不写文件；轮次/裁决/停止按review skill及其共用合同。轮间仅修复相关轻量单元/静态检查，不提前整轮affected。结果和accepted/rejected/deferred逐条记录本Plan，不生成额外review文档。
2. review允许继续后，按实际target到candidate差异及消费者重算适用L0–L2最小集合。没有affected runner：用仓库权威npm命令，保留Task测试receipt，只补无证据/失效项；对上述相交文件必须包含映射、共享组件、两个详情、控制hooks、历史页、独立匿名简历、两原往来记录浏览器覆盖。最终一次 `npm run lint`、`npm run build`，再执行尚缺的Vitest精确文件与Task7精确Playwright选集。build含tsc，勿重复完整typecheck。改动若扩大到decoder/data source等，新增对应已有测试文件责任并记录理由，不全库盲跑。
3. 适用L0–L2完成且review允许交付后，展示具体人工final gate方案：候选SHA、只读核实的target SHA、已验证/未验证范围、review裁决、精确证据、同步/合入动作与增量命令。等待用户明确确认；本轮planning批准不是未来push批准。确认前不合target、不正式L3、不push。
4. 确认后完整读取workflow `references/final-integration.md` 和 `assets/final-integration-contract.md`；同步target记录 `final_target_base`，按该基线重算完整责任、逐项核对输入/selection/runtime/fixture/外部前置/cleanup六维证据，只补失效缺口。不得以旧分叉点冒充最终选择基线，不额外异构review；无变化且证据有效则零runner复用，不前后重复整套。
5. **本次用户覆盖：development L3=none，N/A（用户要求本轮不安排；真实后端未验证）**。即使默认合同写必要L3，本任务也不运行；不把空选集、未运行或fixture结果写为真实PASS。cleanup后再核对证据；第二次核对target未推进才普通fast-forward push，禁止force。target推进/拒绝push保留证据并提出新gate，不自动追赶。
6. 真实成功后记录merge/push事实、实际验证范围与残余未验证风险，更新task intent completed。收尾修复只补受影响验证，不重新进入Task/global/异构review；实质产品合同变化才停止寻求新设计批准。不自动发布或清理用户工作区。

## 文档审查记录

候选文档为本Plan和唯一Spec，review mode `WORKFLOW_DOCUMENT_REVIEW`，parent scope已批准。批准Spec固定为 `31dfb7f013fbf5c689db16cbbe58b00650864638` / `4690d718b38fd0df2f69223926b704ba056a3a6d`，叠加用户no-L3覆盖。不得把文档审查当实施代码审查或产品测试。

- 2026-09-16 第1轮：Claude CLI `opus` / `high` / `permission-mode plan`，只读reviewer persona；候选revision `c781c366a65f027e3f8c62bb34dead9018a82bc3`，Plan blob `01ca54c19b6e48d0845f03e96efd3ce9a22cf357`，候选Spec blob `a0d3d5ef`（完整指纹保存在该轮临时receipt）；批准产品Spec仍为上列精确对象。
- 进程正常exit 0、is_error=false；父会话在读取findings前核对HEAD、porcelain-z与两份文档hash-object均未改变。reviewer未运行测试、未改文件。

| Finding | 级别/必要性/复杂度 | 核实与裁决 |
| --- | --- | --- |
| R1-1 证据文案无法由闭合结果枚举表达 | Important / required / 不变 | 接受零上下文文案合同需更清楚，已补完整句样例、结果仅管图标/色调及不重复后缀断言。拒绝新增结论字段/同义枚举的具体建议：现有 `阶段对话流.tsx` 直接渲染 `条.项`，仅核对中有额外字；`项` 能承载完整句，原报告的“必然拼成两个后缀”前提不成立。澄清即可，无需增加重复状态。 |
| R1-2 day/hour单位偏离批准Spec | Minor / required / 不变 | 接受并修复Task5为“元/天、元/时”，与Spec §6.2一致。 |
| R1-3 active/passed胶囊缺显式任务责任 | Minor / optional / 不变 | 采纳：Task4明确 `状态文` 来源和本人/对方待办、S3双确认反例；无新接口。 |
| R1-4 默认展开不在接口 | Minor / optional / 不变 | 拒绝不存在的判断：基线 `分段项.默认展开?: boolean` 已存在，Task3接口是增量。为零上下文在接口注释明确保留现有字段；不采用每次pre-Case强制受控true，否则会覆盖手动折叠。 |

另据自检补充Task3两个Mock连接器实际持有折叠覆盖及结束段定位；这是Spec §3.2/§5.3既有责任，不扩产品范围。所有改动仅Plan合同澄清/文案修正。按review skill“核实后无未解决有效required finding”结束，1轮，无未解决必修项；这不是修订后又收到NO FINDINGS，也不声称产品测试通过。最终Plan revision/blob由执行提示词冻结，不在正文自引用造成循环。

## 执行记录（2026-09-16，Claude Code 宿主）

执行方式：`superpowers:subagent-driven-development`，7 个实施 Task 串行，每 Task 独立 implementer + 任务级 review（spec+quality）；模型按角色表（T1–T3/T5/T7 sonnet，T4/T6 spec 档 opus）。基线 origin/main = e01291de。

| Task | 提交 | review 结果 |
| --- | --- | --- |
| 1 公共初评与终局中文字典 | ff3e918a | clean（5 minor 递延） |
| 2 两端历史列表共用 Mock 展示 | a90a92f2 | clean（6 minor 递延） |
| 3 共用灰注释与有序阶段记录 | a7d54438 | clean（2 minor 递延；冻结接口唯一扩展 `来自?:'代理'|'用户'` 经核实必要且最小） |
| 4 Backend 进度按阶段重排 | 94be6952 + ccf5d8a3 | fix round 1（pre-Case 可展开 S0「未开始」标签）后 clean |
| 5 冻结职位投影与 Tab 深链 | 7915d9f1 | clean（3 minor 递延；`职位资料.tsx` 未改豁免核实成立） |
| 6 简历统一正文与匿名顶栏 | 4f1b8b82 | clean（1 minor 递 Task 7；两处自报越界裁决成立且最小：`use后端详情控制.ts` 接线、`页尾说明?` 可选槽） |
| 7 双源浏览器回归 | 75ca0018 + e4ae87d4 | fix round 1（X3 独立匿名简历默认行为证据）后 clean |

整分支最终 review（e01291de..e4ae87d4，8 域分遍）：With fixes → 唯一 fix wave `68ef3b4c`（v1 needs_action 恢复当前段「需要你」胶囊 + 死代码删除），scoped re-review 全 ADDRESSED 无新增破坏。24 条递延 minor 经 triage 全部「可留/已消解」，明细见任务级 review 记录；其中值得后续留意：completed S3 默认折叠（产品可定夺显式例外）、`阶段展示名表` 三份闭表合并、时序去重键加来源前缀、v2 当前段对端待办+本人动作并存时「等待对方」优先的既有排序。

验证证据（候选 68ef3b4c）：全量 Vitest 235 文件 / 5588 tests 全绿（含 Task 1→4 过渡期 6 红全部迁移修复）；tsc、oxlint 干净；`@s0-s3-display` Playwright 双 project（mock-stg/backend-stg）24/24 通过（全 HTTP 拦截，--retries=0）。本记录不为最终 fix wave 后的全量 lint/build 重复旧证据——按收尾第 2 步在 affected 阶段统一执行一次 `npm run lint`、`npm run build`。

用户覆盖生效：development L3 = none（未执行，非 PASS）；未启动真实后端/真实账户/实际代理结果验收；fixture 证据只覆盖前端布局与接线。

候选 commit 冻结：`68ef3b4c`。后续收尾按「实施后收尾」1–6 执行：异构 Codex 只读 review-loop → affected L0–L2 最小重算 → final gate 方案等用户确认。

### 异构 Codex 只读 review-loop（2026-09-16）

模式 FEATURE_BRANCH_REVIEW，固定 base e01291de，共用守约 `../_shared/review-contract.md`，reviewer gpt-5.6-sol/high 只读不跑测试；thread 01a0a934（session /tmp/codex-review-loop/session-G2GiLfB7）。每轮后基线核对（status/HEAD）均无变化。

| 轮次 | Findings | 裁决与处置 |
| --- | --- | --- |
| R1 | 4 条 Important/required 契约违反 | 全部核实成立、接受并修复（提交 `01c458d8`）：①pre-Case 顶部状态区与 S0 重复（accepted/refused/retention 的 S0 无落点分支按但书保留顶部区，零信息丢失）②Mock 招聘岗位上下文硬编码 null（改为按岗位编号本地投影，缺失才 null）③transcript 带正文事件语义被固定句替换/丢弃（改为正文优先）④叮嘱回执 `角色:''` 丢身份（本人→`来自:'用户'`、对端→「X方本人」标签） |
| R2 | 2 条 required（均为 R1 修复引入） | 全部核实成立、接受并修复（提交 `e4b5c65c`）：①`supplementary_question` 同时渲染为问答气泡+系统注释（通用正文保留加 `role===''` 限定，正式问答只显示一次）②本人回执时间只留映射数据不显示（用户气泡分支对非空时间渲染右对齐时间戳，Mock 不传时间视觉不变） |
| R3 | NO FINDINGS | 结束（3 轮上限内，精确 NO FINDINGS） |

轮间仅修复相关轻量测试：R1 后相关 10 文件 336 tests + 全量 235 文件/5592 全绿；R2 后相关 3 文件 162 tests + 全量 5593 全绿；tsc、oxlint 干净。无 rejected/deferred 项。

### Affected L0–L2 与 final gate 前 evidence（2026-09-16）

- `npm run lint`（oxlint）：干净（候选 9ad9c030）。
- `npm run build`（含 tsc -b）：通过（候选 9ad9c030）。
- Vitest：全量 235 文件 / 5593 tests 全绿（source_candidate e4b5c65c；其后仅 e2e 断言提交 9ad9c030，未触及任何 Vitest 覆盖文件，六维有效性成立，PASS_REUSED）。
- Playwright `@s0-s3-display`（mock-stg + backend-stg，--retries=0）：24/24 passed（候选 9ad9c030）。首次重跑 4 failed 均为 r1 行为变更后的断言过期（顶部状态区删除/未知系统事件正文保留），按 PRE_GATE_L0_L2 自主修复为等价断言（9ad9c030），零产品代码改动，未重开异构 review。
- development L3：N/A（用户覆盖本轮排除；未执行，非 PASS）。真实后端/账户/代理结果端到端未验证。
- pre-gate target 核对（只读 fetch）：origin/main 已由规划基线 e01291de 推进至 **d1989e4b**（另一会话「候选助手会话」特性，16 commits，40 文件 +6336/−241）；与本分支改动文件**交集为空**。本分支 merge-base 仍为 e01291de。

### Final gate 执行记录（2026-09-16，用户已确认）

- 用户确认本方案后执行；确认后未调用异构 review。
- `final_target_base = d1989e4b`；`git merge --no-edit origin/main` 零冲突，合并提交 **3800ed24**。
- 按 `final_target_base..3800ed24` 重算责任（INCREMENTAL_EVIDENCE）：target 合入改动（连续代谈.ts、HTTP招聘数据源.ts、应用状态.tsx、导航钩子.ts 等）进入本分支测试依赖闭包 → 失效集按 Plan 收尾清单精确重跑：
  - Vitest 23 文件 / 652 tests 全绿（映射×6、共享组件×6、两个详情屏、控制 hooks×4、历史页、独立匿名简历、两往来记录、终局区、MatchCase 详情）；
  - `npm run lint`（oxlint）干净；`npm run build`（含 tsc -b）通过；
  - Playwright `@s0-s3-display`（mock-stg + backend-stg，--retries=0）24/24 passed（合并树）；
  - 可复用项：`代谈结果文案.test.ts` 等纯函数测试（依赖闭包不含合入改动，PASS_REUSED）。
- development L3：**N/A**（用户覆盖，未执行≠PASS）。真实后端/账户/代理结果端到端、真机视觉本轮未验证——残余未验证风险。
- 二次 fetch：origin/main 仍为 d1989e4b（未推进）→ 普通 push 执行：**origin/main d1989e4b → 3800ed24（fast-forward，无 force）**。push 成功后本记录提交。
