# J-PILOT-01 最小前端接线 Implementation Plan

> **For agentic workers:** Claude Code 实际调用 `superpowers:subagent-driven-development`；Codex 实际调用 `superpowers:executing-plans`。依赖串行执行，所有步骤用 checkbox 跟踪。实施留给用户手动启动的新 session，本规划会话只交付文档。

**Goal:** 让候选人从委托受理开始找到同一条记录，观察初评及双端 S0、恢复允许的初评失败，并准确交接 S1；保持 PM 组件和布局。

**Architecture:** 新增一个窄的 negotiation HTTP facade，接入既有 HTTP招聘数据源；连续记录状态和操作扩展既有 P5 工厂，复用其会话/范围/读代际与单飞。候选详情从聚合读取，招聘保留 Case 读取；所有展示复用现有组件，不建立第二套 Case/消息权威快照或通用命令框架。

**Tech Stack:** React、TypeScript、Vite、现有 HTTP 客户端、Vitest、已有 Playwright 数据源模式配置；不新增依赖。

**Spec:** `docs/superpowers/specs/2026-09-11-j-pilot-01-frontend-wiring-design.md`；批准正文 revision `2da422fe2bf1d4fb17f7706515114b85f51732c2`，blob `21bb5f5fc09a16266be7a3b4eeddada7041977fb`。批准记录提交 `43d01dfe`，仅追加元数据，不改正文。用户另明确“最小接线，非必要不制造额外复杂度”。

**Repository / target:** `agxp-a2a-recruiting-web` / `main`。用户选定工作区 `.`，沿用当前检出，不新建第二工作区。源码基线 `d8e69a03c32950574ceee5435e68f84e3cf2cbc5`；实施开工记录实际 HEAD，核对相关变动，不能覆盖同期工作。

## Global Constraints

- 先完整读 `CLAUDE.md`、`AGENTS.md`、批准 Spec 与当前 Task；本 Plan 细化实现，不扩大 Spec。
- 尽最大可能不动布局和样式，新增展示内容复用已有组件/槽位；不新造视觉组件，不重排页面，不重写 CSS。必要 props 扩展保持其他消费者默认行为；新的视觉取舍须由用户决定，不让实施者自由设计。
- S0 保留原输入框和发送按钮，禁用输入和发送；委托受理后留在岗位页，原按钮变“查看进展”。没有持久回执不能造卡或跳空 ID。
- 不安排 L3、真实后端/模型/STG dogfood、初始化或测试框架建设。用户建设 STG Release 后另行设计；不以 L3 延后阻断本次交付，不把它标 PASS，不改名重加同类测试。
- 未知提交保存原 operation/key/body；不改 PDF、generation 或新 key 重发。不保存正文、文件名或凭据。持久命令生命周期与页面 scope 分离，与认证主体隔离。
- 只调用 BFF；required/nullable 严格解码；依赖坏合同是错误不是空态。不复制一份 OpenAPI，不新增后端 API 或 schema。
- canonical record_id 为连续身份；case_id 只用于真实 Case 动作/PDF。不同委托即使同岗位也不能合并。
- Mock 与招聘方既有非目标行为保持。单元/fixture PASS 不代表跨端真实旅程通过。
- 新增类型/纯函数/控制逻辑限本旅程当前需求，不提炼通用资源框架/离线队列/消息状态机；不顺便拆分大文件或重构其他域。
- 开工按逻辑 skill `development-workflow` 的 `scripts/task_intents.py` 登记改动预告，扩大文件范围前更新；这是协调记录，不是新增基础设施。产品实现结束后按本 Plan 的唯一收尾节执行，不追加另一套 finishing 流程。

## 输入合同与开工核对

外部仓库 `agxp-monorepo` 用执行环境 `AGXP_MONOREPO_DIR` 定位；其实际目录由实施环境提供，不写规划机器路径。冻结 Git revision `405d2788c9eb3f21dfdd0a9fdb75990627a2bac0` 的：

| 文件 | blob | 本 Plan 消费 |
| --- | --- | --- |
| `apps/recruitment-bff/openapi/mobile-v1.yaml` | `a8160b19b73300f9c50c064f8f289eccb31c43f2` | negotiation、delegation、MatchCase、PDF 的浏览器协议 |
| `apps/recruitment/openapi/mobile-resources-v1.yaml` | `89e2657c2d8ef61d6f9466705b2bb0954de4d114` | 状态及权限交叉核对，不调用内部 API |
| `docs/contracts/J-PILOT-01/arazzo.yaml` | `5efbb556405679e35370bea6ce98c3b23ab72e81` | C1–C4 的依赖、未知写入与角色边界 |

阅读同 revision 的 `docs/contracts/J-PILOT-01/README.md` 和后端最小接线 Spec，旧实现状态只作历史。前端产品文档按批准 Spec §2 锁定。本地源码检查不是部署证明。

Task 1 开工前，在既有本地 fixture 记录 Task 7 所需的 320/390 视口原控件几何，作为 PM 布局基准：将关键几何数值、视口、fixture 内容和源码 commit 直接记录在本 Plan 验证表，不能仅存会被 Playwright 清理的 test-results；不新增测试配置或运行真实服务。

开工可用 `git cat-file -e <revision>`、`git rev-parse <revision>:<path>` 核对上表；不能拿新 YAML 静默替代批准合同。必要 Git 对象或文件缺失时先恢复准确输入，只暂停依赖该输入的工作；不启动后端环境。所有后续测试为本地前端范围。

## Task index

Task count: 7
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

顺序 1 → 2 → 3 → 4 → 5 → 6 → 7。都是同一连续接线的依赖，不以并行追求速度；每 Task 独立验证，Task 7 为本地跨页面 fixture 消费者与布局证据，不包括 review/final gate。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|闭合 facade、终局/附件 decoder；冻结 YAML|Top 5–10（Claude Code: sonnet）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|2|连续读取、主体清理、Case 操作回读；依赖 1|前沿 / 顶级模型（Claude Code: opus）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|3|原命令恢复、retry/archive、岗位入口；依赖 1–2|前沿 / 顶级模型（Claude Code: opus）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|4|候选列表/历史/横幅和计数口径；依赖 2–3|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|5|同一详情承接 pre-Case/Case/封闭态；依赖 1–4|前沿 / 顶级模型（Claude Code: opus）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|6|S0 消息/原禁用输入/S1 原授权；依赖 5|Top 5–10（Claude Code: sonnet）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|7|既有本地 HTTP fixture 的跨页面与布局校验；依赖 1–6|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|

**计划本身复杂度：中。** 数据涉及多个现有消费者，但不增加基础设施或后端能力。
**零上下文漂移风险：中。** 主要风险是执行基线变化、旧 Case 回读及页面 scope 与命令恢复混用；以精确合同、文件范围和反例约束。执行模型使用当前可用的行业 Top 5–10 中高性价比模型，Task 2/3/5 的状态与隐私判断单独提高档位，Codex 按宿主配置执行。

## 任务共用协议（供每 Task 单独消费）

### A. facade 与状态接口

新增 `src/数据/招聘数据源/连续代谈.ts`；公开 DTO 用 YAML 原字段名，避免再维护一套逐字段 camelCase 对照。嵌套 `case_detail` 解为既有 `P5详情`，其余按下列 schema 导出同名 TypeScript 类型：NegotiationCard/Detail/Page/RetryReceipt/ArchiveReceipt、NegotiationAgentSummary、JobEvaluationView（仅已有 schema 的本地闭合类型，不新增 evaluation API）。所有 referenced schema 读冻结 YAML，不以 `Record<string, unknown>` 或 `any` 放行 evaluation/evidence。

```ts
type NegotiationShelf = 'active' | 'history';
interface 连续代谈数据源 {
  读取候选连续列表(shelf: NegotiationShelf, cursor: string | null): Promise<NegotiationPage>;
  读取候选连续详情(recordId: string): Promise<NegotiationDetail>;
  重试候选连续记录(recordId: string, generation: number,
    key: string): Promise<NegotiationRetryReceipt>;
  归档候选连续记录(recordId: string): Promise<NegotiationArchiveReceipt>;
}
```

`创建连续代谈数据源(请求)` 采用发现推荐 facade 的请求依赖类型，混入 HTTP招聘数据源。本次没有按意向过滤的连续列表消费者，facade/状态范围键不提供该可选维度；有明确产品入口后再考虑。列表 limit=50、恒省略 intention_id、cursor 为 null 时省略，详情不带 include；retry body `{expected_retry_generation:generation}`＋Idempotency-Key，archive body `{}` 无 key；API 路径固定 `/api/v1/me/negotiations` 及 `/{encodedID}`、`/retry`、`/archive`。

扩展 `P5MatchCase状态`：`P5连续列表: Record<string, 连续列表快照>` 与 `P5连续详情: Record<string, 连续详情快照>`；快照复用现有阶段/刷新/error/generation 形状，分别持有 NegotiationCard[]／NegotiationDetail|null，并带 ownerSubjectId。范围键 `P5范围键.negotiations(shelf)` 与 `P5范围键.negotiation(recordId)`，保留 candidate 角色标识；复用 P5范围代际、P5幂等意图、P5可见范围，不新增全站锁管理器。

```ts
// 加入既有 MatchCase操作，所有写操作的 key 由控制操作层负责。
加载连续列表(shelf: NegotiationShelf, force?: boolean): Promise<void>;
追加连续列表(shelf: NegotiationShelf): Promise<void>;
刷新连续列表(shelf: NegotiationShelf): Promise<void>; // 从首屏重建已载窗口
读取连续详情(recordId: string, force?: boolean): Promise<void>;
重试连续记录(recordId: string): Promise<void>;
归档连续记录(recordId: string): Promise<void>;
核对候选委托(intentionId: string, jobId: string): Promise<void>;
```

读到 alias 后只按返回 ID 保存 canonical 内容，入口通过同次返回值/短的 alias→canonical 对照找到它；对照只在当前主体内存中存在并随 P5 清理。不能用 job_id 猜归属。不要把聚合 case_detail 再镜像成第二个候选 `P5详情` 权威快照。

### B. 最小恢复记录

新增纯 helper `src/状态/后端/委托待核对.ts`（及单测），只读写本域的 sessionStorage 键 `AGXP委托待核对v1:<encoded environment>:<encoded subject>:candidate`，值为有限未决命令数组。接口：`读取待核对(storage, owner)`、`保存待核对(storage, owner, commands)`、`清除待核对(storage, owner)`；storage 使用 `Pick<Storage,'getItem'|'setItem'|'removeItem'> | null`，异常返回持久化失败标记，不吞业务记录、不写正文。owner 为 `{environment:string,subjectId:string,role:'candidate'}`。

```ts
type 待核对命令 =
 | { operation:'create'; key:string; intention_id:string;
     selection:{items:[{job_id:string}]}; resume_file_id:string;
     resume_file_version_id:string; disclosure_acknowledged:true;
     delegation_id?:string; record_id?:string; 已确认回执?:true }
 | { operation:'retry'; key:string; record_id:string;
     expected_retry_generation:number; 已确认回执?:true };
```

发送前保存内存及存储；同一 intention/job 的 create 或同一 record 的 retry 未决时不另起命令。key/body 固定；scope 卸载不清。主体确认后的恢复每次原命令最多重放一次，无定时 POST 循环。已确认回执只说明 write 已确认，GET 失败后不再重发已确认 write；成功回读持久记录后删 pending。无存储仍能同页核对；硬刷新/换设备丢失原命令时不保证识别未知 write。

GET 查存在记录不证明某个 key 成功；有完整原 body 才可原样重放。无 ID 可读取原意向 recommendation/receipt 和 active/history 辅助核对；无法唯一辨认则保持待核对，禁止按同 job 认定命中或未受理。不得新增 key 查询服务。退出/切主体清存储和内存并停止旧请求；普通 scope 切换只清视图及读栅栏，不清 pending。

### C. 页面与复用约束

候选主列表全意向，history 一个服务端顺序集合；招聘继续旧 Case 列表。现有卡片类型/白卡/阶段区用于新记录，不新建 CSS。候选 URL `/deal/:id` 可为 dlg 或 mc，招聘仍 Case；先判断模式/角色，再选数据源，Mock 不调用 negotiation。

有 case_detail 才调用既有 P5 mapper/动作控制；pre-Case 不构造假的 P5详情。复用 `详情外壳`、`详情顶栏`、`详情状态区`、`阶段对话流`、`详情动作卡`、`职位资料`、`详情底栏`，初评放现有总结槽，失败操作放现有动作区。必要纯投影/控制分支可以新增，不能新造可视组件。所有 S0 总结只显示一次，公开初评不冒充条件确认。retention 清旧资料，不通过独立 GET 绕过。

本地基础验证命令为 `npm test -- <本 Task 明确列出的测试文件>`，配合 `npm run typecheck`；正文每 Task 给出实际列表。不要在写正文中调用不存在的测试入口。开发中首次选择时读 package.json/Vitest 配置；无后端 tools/test，不向本仓库移植该工具。

### Task 1: 闭合连续代谈 HTTP 合同与 Case 新语义

**目标/非目标：** 提供 A 的 facade，复用 Case 解码；不读浏览器状态、不发新增业务请求、不改后端 YAML。
**依赖：** 冻结 YAML 和批准 Spec §2/7/9/10；无前置 Task。
**预期编辑文件：**
- 新增：`src/数据/招聘数据源/连续代谈.ts`、`src/数据/招聘数据源/连续代谈.test.ts`。
- 修改：`src/数据/HTTP招聘数据源.ts`、`src/数据/招聘数据源/MatchCase.ts`、`src/数据/招聘数据源/MatchCase.test.ts`。
- 删除：无。
**消费/产出：** 消费 HTTP 请求函数及导出的 `解P5详情(input,'candidate')`；产出协议 A facade/DTO。必要时导出既有局部 Case decoder，不复制实现。

- [ ] 核对四个 operation 与 schema 及引用闭合边界；在单测写最小请求捕获正反例。卡片完整 fixture 按冻结 schema，case_detail 复用现有 Case wire 样本。
- [ ] 首先断言 `读取候选连续列表('active',null)` 请求不含 intention_id/cursor；`重试候选连续记录('dlg_…',0,'k')` 严格 body 为 `{expected_retry_generation:0}` 且带 key，archive 无 key。用受控请求桩记录参数，不连接后端。
- [ ] 实现 facade，检查 required/nullable、固定枚举、history needs_action=false、嵌套 Case 权限和详情/列表一致性；全量 referenced evaluation/evidence 严格解码，不通过 unknown 保留未校验展示数据。
- [ ] 扩展 S0 信息不足成对 outcome/code 的条件约束，finalized_at 合法、终局动作空；附件双端仅 resume_submission。旧合法其它终局仍可读，S0 私有总结招聘侧严格拒绝。
- [ ] 执行 `npm test -- src/数据/招聘数据源/连续代谈.test.ts src/数据/招聘数据源/MatchCase.test.ts`；预期先出现缺实现失败，再全部通过。额外反例：recommendations/items=null、漏 required、history 待办 true、新终局混 semantic_not_fit、S0/S2 附件。
- [ ] `npm run typecheck`；检查仅修改本 Task 文件后提交 `feat: add candidate negotiation facade`。

**完成/停止：** facade 及新 Case 合同有正反例通过；未知字段的现实语义无法从冻结合同判断时报告具体 schema，不扩大可接受范围。

### Task 2: 连续记录读取与既有 P5 生命周期衔接

**目标/非目标：** 接上 A 的状态/读取接口，保证单一候选聚合来源和会话清理；不写新 UI、不建立第二轮询系统。
**依赖：** Task 1 的 facade，Spec §4/5/10。
**预期编辑文件：**
- 新增：无。
- 修改：`src/状态/后端/MatchCase操作.ts`、`src/状态/后端/MatchCase操作.test.ts`、`src/状态/后端/类型.ts`、`src/状态/应用状态.tsx`、`src/状态/应用状态.test.ts`、`src/状态/后端/会话操作.ts`。
- 删除：无。
**消费/产出：** 消费 A 的 facade，产出 A 的读取方法/快照/范围键及主体隔离 alias 对照；既有 Case mutation/PDF 签名保持。

- [ ] 对现有 P5 操作测试增加连续列表/详情样本和主体反例，不拷贝整套状态工厂。测试 alias mc 输入返回 dlg 仅保存一个 canonical、同 version 新消息更新、切主体迟到 401 不登出新主体。
- [ ] 将空连续快照和 alias 对照纳入 `创建空P5MatchCase状态`、Provider 初始值、清账号/换角色/换主体的全部既有重置口。不要把业务快照写入资料持久化。
- [ ] 在 P5 工厂增加连续读取，复用读锁与代际：首屏替换、下一页 canonical 去重/upsert、null cursor 零请求；force 手动刷新丢旧 cursor 只重读首屏；`刷新连续列表(shelf)` 复用既有窗口读取语义，从首屏的新 cursor 顺序重建已载页数后一次替换，不重用旧页 cursor、不混旧新分页，不将 5 秒轮询降成只读首屏。旧 cursor 400 仅恢复一次，其他 400 显式失败。
- [ ] 当前主体 401/403、详情 404 清旧敏感详情；普通网络/503/坏合同刷新只保留同主体只读旧快照；retention 响应替换旧 case_detail，不向旧 `P5详情` 留镜像。
- [ ] 逐个核对 `运行命令`/`权威重读详情` 的候选路径：候选 Case 动作成功和未知结果 GET 对账都通过真实 case_id 的 negotiation alias 读取，从其 case_detail 取 P5 判断；招聘继续原 Case GET。POST 已成功、GET 失败不能 reject 成写失败；聚合封闭时不能用空动作表判写成功。
- [ ] 失效/刷新候选已载 continuous active/history；只刷新当前候选已载 Case summary，不强迫加载其它域。调用旧 `读取详情('candidate',caseId)` 的现存消费者也通过 alias 聚合读取，避免漏掉 P7/历史入口。
- [ ] 执行 `npm test -- src/状态/后端/MatchCase操作.test.ts src/状态/应用状态.test.ts` 和 `npm run typecheck`。反例含旧游标、跨页分组移动、迟到旧 GET、成功 POST 后 404、Case 已封闭；确认没有 candidate 双 GET；加载两页后窗口轮询仍保留已载覆盖和正确的下一页 cursor。
- [ ] 提交 `feat: wire continuous negotiation state into P5`。

**完成/停止：** 当前候选连续读取不依赖旧列表记忆；已有招聘/PDF生命周期不回归。发现需要改变后端 alias 语义时停该差异，不能猜映射。

### Task 3: 原命令恢复、失败动作与岗位查看进展

**目标/非目标：** 实现 B 及受理后入口、retry/archive；不设计离线队列/负责人工作台，不修改推荐生成。
**依赖：** Task 1–2 facade/读取；Spec §4/8。
**预期编辑文件：**
- 新增：`src/状态/后端/委托待核对.ts`、`src/状态/后端/委托待核对.test.ts`。
- 修改：`src/状态/后端/发现推荐操作.ts`、`src/状态/后端/发现推荐操作.test.ts`、`src/状态/后端/MatchCase操作.ts`、`src/状态/后端/MatchCase操作.test.ts`、`src/状态/后端/类型.ts`、`src/状态/应用状态.tsx`、`src/状态/应用状态.test.ts`、`src/状态/后端/会话操作.ts`、`src/屏幕/职位详情.tsx`、`src/屏幕/职位详情.test.tsx`。
- 删除：无。
**消费/产出：** 消费 A 读取及已有 `委托候选岗位`；产出 B helper、A 的三个写/核对方法。`核对候选委托` 归发现推荐操作，retry/archive 归 MatchCase操作；pending 内存引用由 Provider 一次初始化并传给两者，存储 helper 无 React。

- [ ] 先写存储白名单/主体分仓/坏 JSON/抛异常测试，以及“POST 无响应→切页面→硬刷新→原 body/key”的操作测试。比较完整 body，不能仅断言同 key。
- [ ] 保存 B 命令后才发 POST；从固定命令生成请求，不再次读取 PDF latest/推荐 top。单飞锁按命令目标，普通页面清 scope 不删该 pending，401/登出/角色或主体切换清旧 owner。
- [ ] 有回执后补 ID、读 canonical 并失效 active 首屏；只在确认命令结果和持久记录后删 pending。业务拒绝无 ID 不造卡。存储失败保留本次内存并提示不能保证刷新恢复。
- [ ] 身份完成后读取 owner pending，先读已知 ID，原 key/body 完整且 write 未确认时每次恢复最多重放一次。仍未知就待核对；用户点原按钮再次核对。本次不新增委托回执列表 facade：无 ID 时仅用已接推荐/continuous 列表辅助核对，写入归属仍由完整原命令重放的回执确认；原命令丢失且无法唯一识别就待核对。Spec 的 receipt 辅助路径是可选能力，不为它新增接线。
- [ ] 实现 retry：新意图取当前权威允许动作与 generation；未决重放不以最新动作或 generation 改写。202 仅受理，随后 GET；archive 严格 `{}` 无 key，归档/retry 竞争回读实际 shelf。存在 pending retry 时允许核对原命令，不自动发下一代。create/retry/archive 的 409 按冻结合同 code 区分幂等冲突、generation 冲突和业务门，回读权威状态；保留原 key/body/generation，不自动换 key、取最新 generation 或再次 POST，不把冲突本身当成已受理或未受理的证明。
- [ ] 岗位详情只改既有主按钮文案/禁用/回调：受理后“查看进展”不跳页，点击导航 `/deal/<knownID>`；无 ID 的未知命令“核对提交结果”，不重新选 PDF。初次委托的 0/1/多 PDF 及确认层布局保持。
- [ ] 执行 `npm test -- src/状态/后端/委托待核对.test.ts src/状态/后端/发现推荐操作.test.ts src/状态/后端/MatchCase操作.test.ts src/状态/应用状态.test.ts src/屏幕/职位详情.test.tsx`，再 `npm run typecheck`。包括取消零 POST、同 job 不等于原命令、GET 404 不证明未受理、storage 失败不自动新 key、三类 409 均只回读不自动另起命令。
- [ ] 提交 `feat: preserve delegation commands and recovery actions`。

**完成/停止：** 可从未知提交恢复或明确留待核对，无原命令则不猜；不新增跨设备恢复保证。真实数据/环境不具备不是启用 L3 的理由。

### Task 4: 候选在谈与历史接连续集合

**目标/非目标：** 受理即在谈可见、历史可恢复、全意向及真实计数口径；不新设计卡片或筛选 UI。
**依赖：** Task 2–3 的读取/动作；Spec §5。
**预期编辑文件：**
- 新增：`src/数据/连续代谈展示映射.ts`、`src/数据/连续代谈展示映射.test.ts`。
- 修改：`src/屏幕/P5/MatchCase列表.tsx`、`src/屏幕/P5/MatchCase列表.test.tsx`、`src/屏幕/P5/MatchCase历史.tsx`、`src/屏幕/P5/MatchCase历史.test.tsx`、`src/屏幕/在谈首页.tsx`、`src/屏幕/看市场.tsx`、`src/屏幕/归档谈判.tsx`、`src/屏幕/我的.tsx`、`src/屏幕/代理详情.tsx`、`src/状态/后端/MatchCase统计.ts`、`src/状态/后端/MatchCase统计.test.ts`、`src/数据/列表卡片映射.ts`。
- 删除：无。
**消费/产出：** 消费 A 列表快照及 C 页面规则；产出 `映射连续列表项(card)` 的候选卡投影，复用现有 `候选在谈卡`/白卡/阶段组件接受的展示数据，不强制转成 P5列表项。

- [ ] 增加 accepted/evaluating/evaluation_failed/refused/case_started 的列表 fixture。比较渲染顺序与服务端输入；主列表未选意向也读全意向。不依据 case_state=null 隐藏卡。
- [ ] 用数据源模式/角色分支只替换候选 Backend 读取与投影，招聘/Mock 继续原入口；列表 5 秒可见轮询通过既有 hook 的 callback 调 `刷新连续列表(shelf)`，不新增永久 timer。既有“加载更多”按钮接 `追加连续列表(shelf)`；手动刷新用 force 首屏，动作后刷新用已载窗口方法。history 无运行 timer。
- [ ] 历史按单一服务端分页原序渲染原卡片组件；显示结果/失败原因并点击同详情，retry 在详情动作槽出现。旧 Case 已结束不可恢复，归档初评失败由权威 actions.retry 决定。
- [ ] 候选首页和市场横幅改读同一全意向连续快照；“需要你处理”，首载/失败/未读尽不伪精确计数；替换无条件“已谈完”的前文为“代谈进度持续更新，”。顶部意向选择器仍服务市场，不改变其已选值；在谈明确显示全部范围。
- [ ] 统计格不新增请求、不改布局：候选“在谈”标“已开案”，“待你拍”标“开案待办”，“已归档”标“开案归档”；初筛/完成仍为 Case 口径。代理详情同样注明已开案，招聘统计保持。计数入口进入全意向在谈，不声称是全量委托计数。
- [ ] 执行 `npm test -- src/数据/连续代谈展示映射.test.ts src/屏幕/P5/MatchCase列表.test.tsx src/屏幕/P5/MatchCase历史.test.tsx src/状态/后端/MatchCase统计.test.ts`，再 `npm run typecheck`。反例：history needs_action=false 仍可进恢复详情；较早待办在最新运行卡前；网络失败不是空列表。
- [ ] 提交 `feat: show continuous negotiations in candidate shelves`。

**完成/停止：** 无需 Case 即可出卡，原卡视觉/招聘分支保持，统计不偷换意义；所需文本装不下时先利用原截断/换行能力，不擅改字号间距。

### Task 5: 复用同一详情承接初评与 Case

**目标/非目标：** 让 `/deal/:id` 的受理、开案、历史和封闭态可直达；不加可视组件/第二详情页，不补公司/JD/在线简历接口。
**依赖：** Task 1–4；Spec §4/6/10，协议 A/C。
**预期编辑文件：**
- 新增：无。
- 修改：`src/屏幕/P5/MatchCase详情.tsx`、`src/屏幕/P5/MatchCase详情.test.tsx`、`src/屏幕/详情控制/use后端详情控制.ts`、`src/屏幕/详情控制/use后端详情控制.test.tsx`、`src/屏幕/详情控制/后端正常详情.tsx`、`src/屏幕/详情控制/后端正常详情.test.tsx`、`src/数据/连续代谈展示映射.ts`、`src/数据/连续代谈展示映射.test.ts`、`src/数据/详情展示映射.ts`、`src/数据/详情展示映射.test.ts`、`src/路由/路径表.ts`。
- 删除：无。
**消费/产出：** 消费 A detail 及 Task 3 动作；现有控制结果增加 pre-Case/retained 分支，Case 分支仍交现有 `后端正常详情` 使用 P5 展示和动作。不新造 P5 DTO。

- [ ] 路由测试先从空缓存打开 dlg 及 mc alias，GET 成功后只保留 canonical 身份并 replace 地址（保留 tab query）；同卡从 pre-Case→Case 不加历史条目、不重置 Tab。
- [ ] 候选控制只读 continuous detail；招聘继续 `读取详情`。复用 3 秒可见轮询 callback；accepted/evaluating 继续观察，pre-Case 已失败/refused/归档无自动推进时停，Case 沿旧 ended 或已发布会话停止口径，completed+handoff pending 继续，不以 history 一概停表。
- [ ] 复用详情外壳顶栏、两个 Tab、状态区、四阶段流和底栏。pre-Case 状态与四个未到达阶段为展示数据，不提交为业务 state；无轮次不造 0/3。公开初评用现有总结组件/槽位标来源，保留 result/evidence，不生成评分或条件裁决。pre-Case 底栏 placeholder 与禁用标记由连续代谈展示映射产出，按 Spec §7 区分“AI 代理正在进行公开信息初评”和失败/拒绝后的真实文案；Task 6 的原控件禁用能力就绪后联合验证，不落回只读 div。
- [ ] 有 Case 时只显示一次 S0 总结，公开初评与 S0 各自独立来源；retention 只显示公开残留状态，清旧 case_detail/附件/PDF，不发补全 GET。两个 Tab 缺失槽照原 Spec 保留。
- [ ] 失败操作复用 `详情动作卡` 和原按钮样式：重试／归档仅权威允许时提供，重试受理显示真实评估状态；history 恢复同卡。不新增 modal 工作流，归档以现有确认层描述“移入历史，不是取消”。
- [ ] 执行 `npm test -- src/屏幕/P5/MatchCase详情.test.tsx src/屏幕/详情控制/use后端详情控制.test.tsx src/屏幕/详情控制/后端正常详情.test.tsx src/数据/连续代谈展示映射.test.ts src/数据/详情展示映射.test.ts`，再 `npm run typecheck`。反例包括 mc 旧链、开案时 Tab 不跳、S1 后回看 S0、retention 清露出、同 version 新消息、招聘无公开初评请求。
- [ ] 提交 `feat: connect continuous records to existing detail layout`。

**完成/停止：** 所有入口读同一聚合，Case 只取已解析嵌套详情，UI 不依赖市场缓存。现组件确实缺槽只做最小 props 扩展，不造另一个面板。

### Task 6: S0 只读输入、消息语义与 S1 原授权交接

**目标/非目标：** 按批准行为纠正旧 S0 输入和 S1 确认，保留 PM 外观；不删其它阶段有效动作，不修改后端。
**依赖：** Task 1/5；Spec §7/9。
**预期编辑文件：**
- 新增：`src/组件/通用.test.tsx`（只补真输入条的禁用行为用例，若执行基线已有则修改）。
- 修改：`src/组件/通用.tsx`、`src/组件/在谈详情/详情底栏.tsx`、`src/组件/在谈详情/详情底栏.test.tsx`、`src/组件/在谈详情/类型.ts`、`src/组件/阶段对话流.tsx`、`src/组件/阶段对话流.test.tsx`、`src/数据/详情展示映射.ts`、`src/数据/详情展示映射.test.ts`、`src/数据/MatchCase展示映射.ts`、`src/数据/MatchCase展示映射.test.ts`、`src/数据/列表卡片映射.ts`、`src/屏幕/详情控制/use后端详情动作.ts`、`src/屏幕/详情控制/use后端详情动作.test.tsx`、`src/屏幕/详情控制/use后端详情控制.ts`、`src/屏幕/详情控制/use后端详情控制.test.tsx`、`src/屏幕/详情控制/后端正常详情.tsx`、`src/屏幕/详情控制/后端正常详情.test.tsx`。
- 删除：无；仅删除本试点 S0 不再可达的呈现/回调，不清全站旧接口。
**消费/产出：** 在现有 `真输入条` 增加 `禁用?:boolean`（默认 false）；底栏输入分支可保留禁用控件。消息项在现有对话联合上增加角色标识/系统分支，仍由同一阶段组件渲染。Case submitResume/PDF API 不变。

- [ ] 写 DOM 行为断言：S0 textbox 与发送按钮存在且 disabled，placeholder 为 Spec §7 文案；Enter、点击、状态切换迟到回调均零 POST。普通输入的中文 IME/Shift+Enter/发送默认语义保持。
- [ ] 真输入条在 textarea/button 设置 disabled，键盘回调先挡禁用；底栏不将 S0 disabled 分支换成 div。清 S0 旧草稿，不仅用 CSS 隐藏或灰化；其它阶段只读分支保持。
- [ ] S0 respond_fact 不再出输入/提交；旧 S0 needs_user 卡仅错误/待核实提示、无代结束行为，保留允许的其他既有 end 路径。新终局文案成对映射，不能直接露 semantic_uncertain_stop 原始码。
- [ ] Q/A 相对 viewer 左右及角色标签按原组件槽位呈现；系统事件使用原阶段的状态文本布局，不放对方气泡；历史叮嘱不伪装 Agent Q/A。S0 总结顺序/来源及三种无正文回答保持。
- [ ] S1 标题改“递交简历”，同步依赖标题的色系映射；附件只投 S1。retry_resume_readiness 使用阶段中原绑定 pair 直接执行已授权检查，不重新展示披露确认；接受邀请/换文件仍维持自己的选择和授权规则。Case metadata 不当下载许可。
- [ ] 执行 `npm test -- src/组件/通用.test.tsx src/组件/在谈详情/详情底栏.test.tsx src/组件/阶段对话流.test.tsx src/数据/详情展示映射.test.ts src/数据/MatchCase展示映射.test.ts src/屏幕/详情控制/use后端详情动作.test.tsx src/屏幕/详情控制/use后端详情控制.test.tsx src/屏幕/详情控制/后端正常详情.test.tsx`，再 `npm run typecheck`。PDF 反例用原预览 hook 测试证明 409 不改用 latest、租约回收；该 hook 没有变化则复用已有断言，不新增同义用例。
- [ ] 检查无新增 CSS／布局文件，必要 props 默认兼容；提交 `feat: align S0 read-only controls and S1 handoff`。

**完成/停止：** DOM 是原控件不是替代只读条，S0 双端零人工输入，S1 检查不是重选；如确需新视觉布局先报告具体组件不足，不自行实现。

### Task 7: 现有前端 fixture 消费者与局部布局验证

**目标/非目标：** 更新受影响的本地浏览器 fixture，证明真实页面消费 negotiation 与保留布局；没有真实服务、模型、STG、初始化或新测试框架。
**依赖：** Task 1–6；Spec §11 用户 L3 延后覆盖。
**预期编辑文件：**
- 新增：无。
- 修改：`e2e/数据源模式.spec.ts`、`src/测试/BFF样本.ts`，以及本 Plan 各 Task 已列出的失效测试文件（不扩大到无关测试）。
- 删除：无。
**消费/产出：** 复用该文件 `装P5双角色`、P5 fixture 路由和已存在 P4 委托场景，只添加 negotiation 回答臂及本旅程最小状态转换；不抽取通用模拟服务。产出 3 个局部场景，命名统一包含 `J-PILOT-01` 和 `@backend`。

- [ ] 修正现有候选 P5 fixture 的请求契约以满足新读取；保留招聘原 Case 端点。所有 `/api/v1/**` 请求由本地 route 处理，未声明请求记错并拒绝，不能穿透到真实后端。`backend-stg` 是现有配置项目名，不代表访问 STG。
- [ ] 场景一：UI 选择 PDF/确认→POST accepted→仍在岗位页→原按钮查看进展→在谈同卡→初评→S0→S1；断言原 PDF pair、来源区分、无第二张卡/第二个候选 Case GET。
- [ ] 场景二：写响应丢失→同标签页 reload→原命令核对→失败→retry 原 generation→归档竞争回读；只用本场景需要的 fixture 相位，不建设可配置编排器。原命令缺失时待核对、无新 key 的反例由 Task 3 操作测试覆盖。
- [ ] 场景三：320/390 两个视口的双端 S0，原输入和发送 DOM 存在禁用、Tab/阶段/附件位置保持、长 placeholder 不溢出；几何基准在 Task 1 开工前用既有本地 fixture 捕获，Task 7 比较同视口同内容区；不以改完后的界面作为自己的基准。关键几何比较本 Plan 已记录的改前数值（实施时可抄为此用例断言常量），截图仅作当轮辅助证据存既有测试输出目录，不批量接受无关基准。招聘屏无候选私有总结/初评。
- [ ] 执行 `npm run test:e2e:data-source -- e2e/数据源模式.spec.ts --project=backend-stg --grep 'J-PILOT-01' --workers=1`。所有 API 必须被 fixture 拦截；发现任何真实服务前置立即停止这一测试，不准备 STG/local 后端。不运行整个配置所有项目。
- [ ] 对已改 shared consumer 的现有 `卡片统一 双端在谈卡`、`卡片统一 在谈卡超长职位名` 执行同入口精确 `--grep '卡片统一 (双端在谈卡|在谈卡超长职位名)'`，仅当其受新候选读取实际影响；结果记录在本 Plan 验证记录，不另建 handoff 报告。
- [ ] 提交 `test: cover J-PILOT-01 wiring with existing frontend fixtures`。

**完成/停止：** 局部 fixture 能验证 UI 请求及布局，明确证据不是 L3。浏览器缺失可记录具体本地前置，不能换成真实环境，也不能跳过后声称通过。

## 实施后收尾（不计入 Task count）

1. 完成全部 Task 与宿主执行 skill 要求的宿主内全局 review，然后退出 Task 循环；不在实施途中调用异构 reviewer。
2. 调用异构只读 review-loop：Codex 宿主用 Claude，Claude Code 宿主用 Codex；冻结批准 Spec 和最终候选 diff，reviewer 默认不跑测试。核实 findings，只修必要问题，轮间只跑修复相关轻量测试，不因 optional 制造新复杂度。轮次/停止条件由该 skill 负责。
3. 按完整实现 diff 核算最小非 L3 覆盖。当前仓库没有 `tools/test affected`：用 git diff 文件清单、import 消费者和以上 Task 精确测试的并集人工核算，记入下方记录，不移植后端工具。复用同一最终候选有效结果，只补缺项/失效项；执行一次最终 `npm run typecheck`、`npm run lint`、`npm run build`。不默认跑 `npm test` 全仓或所有 Playwright project。
4. 展示具体 final gate 方案：候选 commit、实际 main target、最小覆盖及证据复用、未执行项、拟普通 fast-forward 合入/push。L3 明确“用户要求延后，本次不安排，不作为必过项”；禁止附加初始化、真实模型或 STG 工作。
5. 用户明确确认后读取 development-workflow 的 `references/final-integration.md` 和 `assets/final-integration-contract.md`，按批准目标同步/重新核算，只补因基线变化失效的非 L3 验证；cleanup 只清自己创建的已知产物、不 stash/reset/clean 用户现场，核对 target 后普通 fast-forward push。若原协议默认要求 L3，以本 Plan 明确用户覆盖为准；不默认部署。

## 测试选择五问与覆盖记录

1. 风险是新 HTTP 合同、canonical 连续性、原命令重放、权限清理和原 UI 不变；由 Task 1–7 的分层反例覆盖，不是每个 helper 镜像一份测试。
2. 开发反馈最小命令是当前 Task 列出的测试文件；typecheck 用于公共类型消费者，不以全仓测试替代精准定位。
3. 请求 body、清理、跨刷新和浏览器禁用控件必须在对应本地边界验证；真实服务权限和模型结果本次不可证明，按用户要求延后。
4. 当前权威验收仅为最小接线实现、review 与非 L3 检查；AC01–AC14 的真实旅程由用户后续 STG Release/初始化/测试框架方案负责。发布和部署不在当前授权中。
5. 本规划只做静态文档/代码核对；未跑产品测试、未计时。旧后端 L3 和旧前端测试不作为新接线通过证据；实施结果只在下表追加。

|范围|执行状态|证据/限制|
|---|---|---|
|PM 改前布局基准|待 Task 1 开工前记录|源码 commit、fixture、320/390 视口及关键控件几何数值直接记本表，不仅存一次性截图|
|Task 1–7 本地检查|未执行（规划阶段）|实施者追加候选 commit、命令、结果和复用依据|
|最终 typecheck/lint/build 与受影响用例并集|未执行（规划阶段）|不重复已有效覆盖|
|L3/真实旅程/STG/初始化/测试框架|用户明确延后，本次不安排|不能记录 PASS，不作为当前 final gate 必过项|

## Spec 覆盖与最小性自检

|Spec|Task|
|---|---|
|§1–3 范围、权威、布局复用|Global Constraints、所有 Task 文件及复用边界|
|§4 委托、canonical、导航|1/2/3/5|
|§5 列表、history、计数|2/4|
|§6 详情、初评来源、retention|1/2/5|
|§7 S0 消息、结果、原输入|1/5/6|
|§8 未知写入与恢复|2/3/5|
|§9 PDF 与 S1|1/2/6|
|§10 读取与隐私|1/2/3/5|
|§11 非 L3 验证|各 Task、7、唯一收尾节|
|§12 非目标/后续|Global Constraints，无额外实施 Task|

新增生产文件仅 facade、pending helper 和纯展示投影各一份；其余复用既有控制和组件。没有新依赖、新路由外形、新 CSS、新后端端点、新测试配置或新消息存储。需要扩大范围时必须证明现有组件无法表达批准行为，不把“更清晰/未来可用”当依据。

## 文档 review 记录

已完成 1 轮 Claude Opus/high 文档 review，模式 WORKFLOW_DOCUMENT_REVIEW；候选 commit `677e168f`、Plan blob `7cbf02e5`，范围仅本 Plan 与对应 Spec，批准正文仍绑定头部的完整 revision/blob。未跑测试、未改文件；驱动侧审后核对 HEAD、工作树状态和两文件指纹均不变。审查进行了引用文件/符号的存在性只读核对，未评审产品代码实现。

按 receiving-code-review 核实后，3 条 Important/required 和 3 条 Minor/optional 全部采纳；没有新增需求、未决 required 或待决 optional。以下裁决均不改变批准 Spec，复杂度均不增加；修正文档后按无未决有效 required 的停止条件结束，不将其描述成 reviewer 返回 NO FINDINGS。

|Finding|必要性 / 复杂度|核实与裁决|
|---|---|---|
|5 秒 force 只读首屏导致追加页消失|required / 不变|成立；现有 P5 有窗口刷新机制。补刷新连续列表及加载更多绑定，窗口从首屏顺序重建；手动 force 保留首屏语义，新增两页后轮询反例。|
|409 冲突处理未落实|required / 不变|成立；Spec §8 明确要求。Task 3 补三类 code 的只读回查和原命令保护，禁止自动新 generation/key。|
|改前几何可能被输出目录清理|required / 不变|成立；既有 fixture 注释明确 test-results 每轮清理。关键数值及基线 commit 直接记本 Plan，截图只作当轮辅助，无新管线。|
|intentionId 过滤没有消费者|optional / 降低|采纳；主/历史列表都全意向，删 facade 形参与范围键维度，未来明确入口后再考虑。|
|可选回执 facade 留设计分叉|optional / 降低|采纳；不新增该接口及 decoder，用已知 ID/已接读取/原命令回执恢复；无法确认就待核对，移除额外数据源文件改动范围。|
|pre-Case placeholder 归属不明确|optional / 不变|采纳；Task 5 明确由连续代谈映射产出文案/禁用标记，与 Task 6 原控件能力联合验证。|

本轮只修 Plan，批准 Spec 正文未改；实际产品验证仍未执行。
