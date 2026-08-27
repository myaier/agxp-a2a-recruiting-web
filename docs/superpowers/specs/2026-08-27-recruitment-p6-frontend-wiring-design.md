# Recruitment P6 前端接线设计校准

**日期：** 2026-08-27

**状态：** 待用户审阅

**范围：** `agxp-a2a-recruiting-web` 的 P6-A 前端接线：候选人与招聘方长期 Agent 规则、异步 proposal、显式确认、规则版本 CAS、账号/角色水合与 Mock/Backend 隔离。

**前端基线：** `origin/main@eaa561e6a9d76c874804627b4e9a32c71c03419b`

**并行 P3 前端契约：** `plan-p3-frontend-integration@e4f156fd846f872a31a597c79979cad7116c7b23` 的 `docs/superpowers/specs/2026-08-27-recruitment-p3-frontend-wiring-design.md` 与实施计划。P6 可以在独立 worktree 并行实现；共享 composition root 由 integration owner 机械组合。

**后端契约基线：** `~/agxp-monorepo` 的 `origin/release/0.2.5@a3d725473f50709e1d92d8bb84afabb9f22961aa`，以 `apps/recruitment-bff/openapi/mobile-v1.yaml` 和 `docs/superpowers/specs/2026-08-26-recruitment-agent-rules-control-design.md` 为真相源。

## 1. 结论

P6 后端已经冻结并交付双端 Rule 与 Proposal 的完整浏览器契约。前端当前仍把规则当作本地同步数组：新增和编辑立即写入 reducer，删除直接消失，招聘方开关直接翻转；Backend 模式也会显示 Mock 规则并允许演示页面修改它们。这个模型与 P6 的不可变版本、异步解释、显式确认、CAS 和 owner 隔离冲突。

本次采用的最小正确方案是继续扩展现有单一 HTTP 数据源、`状态/后端` 操作层和根应用状态：

1. Backend 模式下，Rule 与未完成 Proposal 只认 BFF 权威结果；
2. 新增和编辑先创建 Proposal，`interpreting` 期间不产生规则，`ready` 后由用户接受才创建或替换 Rule；
3. 候选端保留 global 与 intention 分组，招聘端保留 global 分组；
4. 候选端保留编辑/删除体验，招聘端保留 pause/resume 开关；
5. Mock 模式继续走现有 reducer，不发 P6 HTTP；
6. 非规则 owner 页面不得在 Backend 模式下用本地 action 伪造长期规则。

P6 Case instruction 不进入本次计划。当前前端的 MatchCase、往来与阶段仍是演示域，没有来自 BFF 的权威 `case_id`、party 和 stage；把本地 `J-02`/`A-01` 之类编号提交给 `/match-cases/{case_id}/agent-instructions` 只会制造死接线。P6-B 必须在 P5 前端提供权威 Case identity 后另立设计与计划。

## 2. 目标与成功标准

完成后：

1. Backend 候选人登录/切角色水合 candidate rules 与 `interpreting|ready` proposals；Backend 招聘方水合 recruiter rules 与同两类 proposals；
2. 首次水合前不渲染 Mock 规则、Mock 计数或可写控件；
3. candidate rule list 按 `global` 与真实 `intention_id` 分组，组名来自权威求职意向，不再硬编码“AI 产品经理”；
4. recruiter rule list 只显示 global rules；
5. 新建 Rule 必须完成 create proposal → poll/read ready → 用户 accept → Rule 出现；
6. 编辑 Rule 必须完成 replacement proposal → ready → 用户 accept，旧版本在 accept 前继续生效；
7. dismiss 只终止 Proposal，不创建或修改 Rule；
8. candidate delete 使用当前 version 的 `If-Match`，recruiter pause/resume 使用当前 version 的 `If-Match`；
9. 409、404、结果未知和响应丢失通过重读权威 Rule/Proposal 收敛，不自动覆盖新版本；
10. 退出、切 subject、切 role 时清空 P6 snapshot，并丢弃迟到响应；
11. Mock 规则剧情与 Backend P6 状态完全隔离；
12. Case、问 AI、简报、CLI/飞书等演示入口不会在 Backend 模式下伪造真实 Rule；
13. Vitest、数据源模式 Playwright、普通 E2E、build/typecheck/lint 提供可重复证据。

## 3. 方案选择

### 3.1 采用：现有后端状态层 + 独立 P6 facade

新增 `招聘数据源/Agent规则.ts` 持有 P6 path、query、body、strict decoder 与分页；新增 `状态/后端/Agent规则操作.ts` 持有水合、proposal lifecycle、CAS 恢复和会话代际。页面只调用 `操作`，不直接请求 BFF。

这样与 P1/P3 的 session generation、mutation lock、401 清理、Mock/Backend 分流一致，也使 Rule page、顶部计数和其它只读消费者观察同一份权威状态。

### 3.2 拒绝：页面局部 fetch

页面直接请求会在候选页、招聘页和筛选抽屉复制分页、ETag、幂等、poll、401、冲突重读与 subject fence，且很容易让不同页面观察到不同 RuleVersion。

### 3.3 拒绝：把 interpreting Proposal 当作临时 Rule

Proposal 没有 `rule_id`、version 或 active 状态；把它插进规则数组会让未获确认的自然语言看起来已经生效，并导致计数与自动授权承诺失真。

### 3.4 拒绝：现在接 Case instruction

P6 instruction route 的 party、stage 和 intention 全由权威 MatchCase 决定。当前前端只有演示 Case 编号，没有安全映射。用自由文本 proposal 替代 instruction reference 还会丢掉来源真实性，因此不做 dormant adapter 或 fixture-only 完成声明。

## 4. 冻结浏览器契约

### 4.1 Role 前缀

Candidate：

```text
/api/v1/me
```

Recruiter：

```text
/api/v1/recruiter
```

前端内部 role 只允许 `candidate | recruiter`，由当前 active role 决定前缀。页面不能传任意 URL 前缀。

### 4.2 Rule routes

双端各消费：

```text
GET    /agent-rules
GET    /agent-rules/{rule_id}
PATCH  /agent-rules/{rule_id}
DELETE /agent-rules/{rule_id}
```

- candidate list 可用 `scope=global` 或 `scope=intention&intention_id=int_...`；
- recruiter list 不发送 scope/intention filter；
- list 用 opaque cursor 读完全部页，并拒绝重复 cursor；
- PATCH body 只能是 `{operation:"pause"}` 或 `{operation:"resume"}`；
- PATCH/DELETE 使用列表或单项响应里 `version` 生成 exact quoted `If-Match`；
- GET/PATCH 返回的 ETag 必须能解析为响应 version；不一致视为 `invalid_response`；
- DELETE 204 后再从权威本地 snapshot 移除，失败前不乐观删除。

Rule View 的闭合字段为：

```ts
type BFFAgent规则作用域 =
  | { type: 'global' }
  | { type: 'intention'; intention_id: string };

interface BFFAgent规则 {
  rule_id: string;
  version: number;
  state: 'active' | 'paused' | 'archived';
  scope: BFFAgent规则作用域;
  clause_kinds: (
    | 'information_disclosure' | 'workplace_mode' | 'work_schedule'
    | 'compensation_band' | 'role_domain' | 'candidate_affiliation'
    | 'qualification' | 'contact_cadence'
  )[];
  display_text: string;
  created_at: string;
  updated_at: string;
}
```

浏览器不能得到 clause parameters、effect 或 evaluator verdict，也不得从 `clause_kinds` 猜授权结果。

### 4.3 Proposal routes

双端各消费：

```text
POST /agent-rule-proposals
GET  /agent-rule-proposals
GET  /agent-rule-proposals/{proposal_id}
POST /agent-rule-proposals/{proposal_id}/accept
POST /agent-rule-proposals/{proposal_id}/dismiss
POST /agent-rules/{rule_id}/replacement-proposals
```

Candidate free-text create：

```json
{"text":"大小周不谈","scope":{"type":"intention","intention_id":"int_..."}}
```

Recruiter free-text create：

```json
{"text":"竞对在职候选人不接触"}
```

P6-A 不发送 `input:{type:"case_instruction"}` arm。

`accept` 与 `dismiss` body 都是闭合空对象 `{}`，并带 Idempotency-Key。Replacement create 额外带目标 Rule 当前 `If-Match`。

Proposal View 的闭合字段为：

```ts
interface BFFAgent规则提案 {
  proposal_id: string;
  state: 'interpreting' | 'ready' | 'accepted' | 'dismissed' | 'failed';
  normalized_text?: string;
  consequence?: 'auto_allow' | 'auto_deny' | 'advisory' | 'mixed';
  created_at?: string;
}
```

字段条件必须严格验证：

- `interpreting` 不得携带 settled facts；
- `ready` 必须携带 `normalized_text`、`consequence`、`created_at`；
- terminal state 的可选字段只按 OpenAPI 接受，不制造缺失默认；
- unknown state/consequence、unknown key、trailing JSON、畸形 envelope 一律拒绝。

### 4.4 Proposal 恢复查询

每次 role 水合分别读取 `state=interpreting` 与 `state=ready` 的全部分页，并按 `proposal_id` 合并。不能只读无过滤第一页：历史 terminal proposal 可能把仍需用户处理的 proposal 挤出首屏。

规则页挂载后，对当前可见的 `interpreting` proposal 每 2 秒 GET 单项：

- ready/terminal 后停止该 proposal 的轮询；
- 页面卸载、role/subject 变化或没有 interpreting proposal 时停止；
- 不在根 Provider 建永久 interval；
- 重新进入页面时由 proposal list 恢复；
- 同一 proposal 同时最多一个 GET，迟到响应受 session generation 与 proposal generation 双重约束。

## 5. 前端状态与文件责任

### 5.1 Wire 与数据源

- `src/数据/BFF契约.ts`：增加 Rule、Scope、Proposal、Page 与 create/mutation 闭合 DTO；不加入 instruction DTO。
- `src/数据/招聘数据源/Agent规则.ts`：拥有双端 Rule/Proposal routes、role→prefix、query 编码、分页、strict decoder、ETag/version fence。
- `src/数据/招聘数据源/Agent规则.test.ts`：冻结 method/path/query/body/If-Match/Idempotency-Key、200/202/204、分页和坏响应拒绝。
- `src/数据/HTTP招聘数据源.ts`：把 Agent rule facade 组合进根数据源。
- `src/数据/Agent规则映射.ts`：只把 owner-safe Rule View 转成页面 Rule；不解释 clause、参数或 consequence。

现有 `HTTP客户端` 已生成并在受控重试中复用 Idempotency-Key；P6 不新增网络 client。数据源无需依赖 HTTP status 判断 proposal 是否完成，必须以 response `state` 为准。

### 5.2 页面领域状态

扩展现有 `规则`：

```ts
interface 规则 {
  编号: string;
  内容: string;
  来源: string;
  生效: boolean;
  作用域?: { 类型: '全局' } | { 类型: '意向'; 意向编号: string };
  服务端版本?: number;
  服务端状态?: 'active' | 'paused' | 'archived';
}
```

新增字段可选是为了保持 Mock fixture 简洁；Backend 映射出的 Rule 必须全部带作用域、版本和服务端状态。

`Agent规则` reducer 保留现有 Mock CRUD action，并新增闭合 Backend hydration/clear action：

```ts
| { 型: '水合后端候选规则'; 规则: 规则[] }
| { 型: '水合后端招聘规则'; 规则: 规则[] }
| { 型: '清后端Agent规则' }
```

Backend 页面只通过 hydration action 改规则数组；任何 mutation 都在服务端成功或权威重读后触发整体替换，不把 create proposal 直接 append 成 Rule。

### 5.3 后端原始 snapshot

`后端状态` 增加：

```ts
候选规则快照: Record<string, BFFAgent规则>;
招聘规则快照: Record<string, BFFAgent规则>;
候选规则提案: Record<string, BFFAgent规则提案>;
招聘规则提案: Record<string, BFFAgent规则提案>;
```

raw Rule snapshot 提供 version/CAS；proposal snapshot 提供 async lifecycle。页面展示 Rule 使用领域映射，proposal 卡直接消费 closed owner-safe proposal view，不复制 machine data。

### 5.4 后端操作

新增 `src/状态/后端/Agent规则操作.ts`，公开：

```ts
interface Agent规则操作 {
  刷新Agent规则(): Promise<void>;
  创建Agent规则提案(input: { 文本: string; 作用域?: BFFAgent规则作用域 }): Promise<string>;
  创建Agent规则替换提案(ruleId: string, text: string): Promise<string>;
  刷新Agent规则提案(proposalId: string): Promise<void>;
  接受Agent规则提案(proposalId: string): Promise<void>;
  放弃Agent规则提案(proposalId: string): Promise<void>;
  切换Agent规则(ruleId: string, operation: 'pause' | 'resume'): Promise<void>;
  删除Agent规则(ruleId: string): Promise<void>;
}
```

Mock 分支继续派发现有 action；Backend 分支只调用 P6 facade。Replacement、accept、dismiss 不在 Mock 伪造异步状态，Mock 保持当前即时原型。

每个 effect 使用现有 shared lock：`Agent规则:new:<role>`、`Agent规则:<rule_id>`、`Agent提案:<proposal_id>`。401 统一走 `清账号状态`；role/subject fence 与 P3 共用 session generation。

## 6. 水合与并行 P3 组合

P6 不要求等待 P3 实现完成，但最终 composition root 必须合并两者：

```text
candidate hydration
  -> Promise.allSettled(
       Resume,
       Intentions,
       Privacy,                 // P3
       Candidate Rules,
       Candidate interpreting proposals,
       Candidate ready proposals
     )

recruiter hydration
  -> Promise.allSettled(
       Jobs,
       Organization domain,
       Recruiter Rules,
       Recruiter interpreting proposals,
       Recruiter ready proposals
     )
```

各域独立提交成功 snapshot。P6 失败不撤销 Resume/Privacy/Job 成功结果，也不回退 Mock。首次没有对应 role 的 P6 snapshot 时，规则页保留外壳但不显示 Mock rows、计数或可写控件。

退出、401、切 subject、切 role 时：

1. 清 raw Rule/Proposal snapshot；
2. 清对应页面 Rule arrays；
3. 停止 proposal polling；
4. 增加 session generation；
5. 丢弃旧 role/subject 的迟到响应。

P3 与 P6 会同时修改 `BFF契约.ts`、`HTTP招聘数据源.ts`、`状态/后端/类型.ts`、`会话操作.ts`、`初始状态.ts`、`应用状态.tsx`、`BFF样本.ts` 和数据源模式 E2E。它们是已声明的机械共享入口，不为消除几处 merge conflict 创建 registry 或第二个 Context。Integration owner 以 P3/P6 两份设计的联合状态为准逐项组合。

## 7. 页面与交互

### 7.1 Candidate 规则库

保留 `/rules`、现有页面结构、卡片视觉和添加入口，改变数据与生命周期：

- 全局组显示 global Rule；
- 意向组按真实 `intention_id` 分组，标题使用对应权威求职意向名称；孤儿 intention scope fail closed，不并入 global；
- 添加时默认 global，并提供“全局 / 某条意向”的明确 scope 选择；
- 保存编辑创建 replacement proposal，旧 Rule 在 accept 前继续显示；
- 删除使用 current version，成功后权威刷新；
- Backend 不显示后端没有提供的“来自某单叮嘱”来源。副行只投影 scope 与 `updated_at`；Mock 保持原来源文案；
- archived Rule 不进入当前列表；paused Rule 可按服务端状态显示为未生效，但本期不新增 candidate pause/resume 控件。

### 7.2 Recruiter Agent 设置

保留 `/hr/agent-settings`、授权范围卡、global 单组和现有开关：

- active→pause、paused→resume；
- mutation 成功后以响应 Rule 更新，冲突则重读；
- 手动添加经过 Proposal；
- 本期不新增 recruiter 编辑/删除 UI，因为冻结前端契约只要求 recruiter pause/resume；
- Backend 副行使用 global scope 与更新时间，不伪造“建岗时设定/来自某候选”；Mock 保持现有来源；
- 旧“任何叮嘱都会沉淀”改成显式确认口径。

### 7.3 Proposal 确认卡

新增双端复用的 `src/组件/Agent规则提案卡.tsx`：

- `interpreting`：显示“AI代理正在理解这条规则…”；无 accept/dismiss；
- `ready`：显示 `normalized_text` 和 consequence 的固定安全摘要；提供“放弃”和“确认规则”；
- `failed`：显示“这条规则暂时无法理解，请换一种说法”；关闭后保留用户原草稿供再次明确提交；
- `accepted|dismissed`：不继续显示，操作层刷新 Rule/Proposal snapshot；
- 不显示 confidence、clauses、parameters、effect、Agent task 或影响人数估算。

Consequence 显示映射冻结为：

```text
auto_allow → 符合条件时，AI代理可以自动推进
auto_deny  → 命中条件时，AI代理会自动拦下
advisory   → 这是一条参考偏好，不会单独触发自动决定
mixed      → 这条规则同时包含推进、拦截或参考条件
```

确认卡只呈现后端 safe summary，不自行承诺某个具体 MatchCase 动作。

### 7.4 筛选抽屉和其它规则消费者

所有规则计数继续读取同一权威领域数组。

- `看市场` 的规则抽屉和企业 `候选筛选抽屉`：Mock 保持可编辑；Backend 改为只读列表，并保留现有“管理规则”入口跳到 canonical Rule page，避免在多个抽屉复制 proposal/CAS UI；
- `问AI代理`、`企业问AI代理`：仍是明确演示聊天，不创建 Backend Rule；相关按钮只保留 Mock action；
- `往来记录`、`企业往来记录`、`在谈详情`、`候选详情`：属于 P6-B/P5 Case instruction 后续范围；Backend 不得把本地决定或叮嘱直接 append 到权威 Rule 数组，也不得复制文本走 free-text arm伪造 case source；Mock 保持现有剧情；
- `代理详情`、`企业代理详情`、`我的`、`企业我的`、市场/候选顶部计数：Backend 只显示已水合 active Rule 数；未水合时不显示 Mock 数字。

## 8. 并发、冲突与恢复

### 8.1 通用规则

- 不做乐观 Rule mutation；
- Proposal interpreting 不改变 Rule 数组或生效计数；
- unknown wire shape fail closed，Backend 不回退 Mock；
- page draft、scope selection 和 edit text 是组件临时状态，不写 raw snapshot；
- refresh 只替换对应 role 的 P6 state，不清另一 role 已隔离的 snapshot。

### 8.2 Rule version conflict

PATCH/DELETE/replacement create 遇 `409 version_conflict`：

1. GET list 重读当前 role 全部 Rule；
2. 替换 raw/domain snapshot；
3. 保留本地 edit text 和 scope；
4. 不自动重放 mutation；
5. 用户检查最新规则后重新明确提交。

404 同样重读；目标已不存在时按权威结果移除，但不伪造原 mutation 成功。

### 8.3 Proposal create

同一次 HTTP 调用及客户端受控重试复用同一 Idempotency-Key。若最终网络错误、503 或 outcome unknown：

1. 重读 `interpreting` 与 `ready` proposal list；
2. 能按已知 `proposal_id` 或创建响应恢复则继续跟踪；
3. 没有 receipt 时保留输入，不显示成功；
4. 用户再次提交是新意图，生成新 key。

前端不通过文本相等猜哪条 proposal 属于这次创建。

### 8.4 Accept/dismiss

accept/dismiss 使用幂等 POST。错误或响应丢失后 GET proposal：

- `accepted`：刷新 Rules，Rule 出现后收口；
- `dismissed`：从 actionable snapshot 移除；
- `ready|interpreting`：保留卡片，不宣称完成；
- `failed`：进入失败 UI；
- not found：重读 actionable lists，无法确认则保留错误提示。

`agent_rule_proposal_not_ready`、`agent_rule_proposal_not_actionable`、`agent_rule_proposal_terminal` 都先读 proposal，再按权威 state 恢复；不把所有 409 当 version conflict。

### 8.5 Pause/resume/archive

这些 effect 没有创建幂等 receipt。409/503/网络异常后重读 Rule list：

- 服务端状态已是目标状态或 Rule 已归档，可按权威结果收口；
- 否则保持原状态并向用户显示错误；
- 不自动再次发送 mutation。

## 9. 文案与 UI 边界

本期不是全站 UI 重设计：

- 保留现有路由、页面顺序、设计 token、卡片、输入行、开关和弹层原语；
- 允许且必须修改“叮嘱自动沉淀”这类与后端事实冲突的文案；
- 允许新增 scope 选择、proposal interpreting/ready/failed 状态和 consequence safe summary；
- 删除 Backend 模式下伪造的来源/影响估算；
- 不新增 clause 参数编辑器、规则 DSL、授权 verdict UI 或 Agent task 调试信息；
- 不借 P6 修改市场、推荐、Case、消息或简报版式。

## 10. 测试策略

### 10.1 Wire 与 facade 单测

- 双端 role prefix、Rule list/get/patch/delete、Proposal create/list/get/accept/dismiss/replacement；
- scope/intention/cursor query encoding，未知或重复 cursor 防护；
- exact If-Match、Idempotency-Key、empty body、204；
- Rule/Proposal exact keys、conditional fields、enum、ID/date/version、trailing JSON 与 malformed envelope；
- all-page pagination、duplicate cursor、actionable proposal 两状态合并；
- ETag/version 一致性。

### 10.2 Mapping/reducer/operation 单测

- global/intention/recruiter 分组与 orphan intention fail closed；
- Backend hydration 不含 Mock Rule，Mock action 保持原行为；
- create/edit proposal 不改变 Rule list；accept 才刷新 Rule；dismiss 不创建 Rule；
- candidate delete、recruiter pause/resume；
- 409/404/503/network reconciliation 不自动 replay；
- accept/dismiss terminal recovery；
- subject/role switch 丢弃迟到 rules/proposals；
- polling single-flight、2 秒推进、unmount/terminal 停止。

### 10.3 页面测试

- candidate 真实 intention 分组、scope 选择、manual create、replacement、delete；
- recruiter global、active count、pause/resume、manual create；
- interpreting/ready/failed card 与 consequence 文案；
- Backend 未水合无 Mock rows/count/mutation；
- Backend 筛选抽屉只读并导航 canonical page；Mock 仍可编辑；
- Backend 问 AI/Case 不污染 Rule state；Mock 剧情不回归；
- 所有按钮在中文输入法 composing Enter 时不误提交。

### 10.4 数据源模式 Playwright

Backend intercepted fixture 覆盖：

```text
candidate restore
→ rules + interpreting/ready proposal hydration
→ global create → interpreting → ready → accept → active rule
→ intention create with real intention_id
→ replacement with If-Match → accept
→ archive with If-Match
→ role switch recruiter
→ recruiter create → accept
→ pause/resume with advancing versions
```

另覆盖 version conflict 无重放、accept response-loss 收敛、stale role/subject response discard、failed proposal 和分页。Mock 场景访问双端规则页及两个筛选抽屉并断言 P6 `/api/v1/*agent-rule*` 请求为零。

### 10.5 Delivery gates

实施最终依次运行：

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:e2e:data-source
UI_VISUAL_GATE=enforce npm run ui:check -- --base <implementation-base>
```

规则页当前不在固定视觉场景中；若实施增加场景，必须按 UI regression harness 的既有规则采集，不把生成物提交 Git。

## 11. 明确非目标

本计划不实现：

- P6 Case instruction、instruction polling 或 case_instruction proposal arm；
- P4 搜索/推荐/盯盘的真实结果；
- P5 MatchCase 状态、决策、归档或权威 Case ID；
- P7 消息、通知、未读、push、SSE/WebSocket；
- 问 AI、简报、影响人数估算的真实后端；
- 飞书/IM binding、CLI、Agent provisioning；
- clause/effect/parameter 展示或编辑；
- Authorization evaluator 浏览器 API；
- 从 Mock Rule 自动迁移到服务端；
- 通用状态库、query cache、规则 DSL 或新请求框架；
- 后端仓库修改、STG 发布或生产 readiness。

## 12. 验收标准

1. Backend 双端 Rule 与 actionable Proposal 由 BFF 权威水合；
2. 未 accept proposal 不产生 Rule 或生效计数；
3. create/replacement/accept/dismiss/pause/resume/archive 严格匹配最终 OpenAPI；
4. Candidate global/intention 与 Recruiter global scope 无串用；
5. CAS、幂等、响应丢失和终态恢复不自动覆盖服务端；
6. 账号/角色切换无 Rule/Proposal 泄漏；
7. Backend 不显示或修改 Mock Rule；Mock 不发 P6 HTTP；
8. 非 canonical 规则入口在 Backend 不伪造长期规则；
9. P3/P6 composition root 在 integration commit 上联合成立；
10. 所有 focused/full gates 有新鲜通过证据；
11. 前端 diff 不含后端修改或生成型测试产物；
12. P6-B 的 unmet dependency 被明确保留，没有 fixture-only 完成声明。

## 13. 冻结结论

P6-A 前端的核心不是把本地 CRUD 换成 HTTP CRUD，而是把“一句话规则”接入真实的异步解释与显式批准生命周期。Rule 是用户接受后的不可变版本，Proposal 只是待确认解释；两者必须在状态、计数、页面和错误恢复中保持分离。

该范围可以与 P3 前端并行实现。P6-B 在 P5 提供权威 Case identity 后再接，届时复用本期的 Rule/Proposal facade 与确认组件，不重新设计长期规则 owner。
