# FE-MC-01：双端 MatchCase 精确统计前端接入设计

## 1. 背景与目标

前端当前在 Backend 模式下从已加载的 MatchCase open 分页快照推导“我的”页统计。读尽时显示精确 `N`，分页未尽时只能显示下界 `N+`，历史终局统计则显示 `—`。这套过渡行为保证了数据诚实，但不能给出跨页精确值。

后端已经发布 candidate 与 recruiter 两个同形 summary 接口。FE-MC-01 的目标是接入该权威 summary，以精确数字替换 Backend 模式下的 `N/N+` 过渡统计，同时保留现有页面标题、布局、导航、Mock 行为和 P5 列表能力。

本设计对应的后端基线为：

- Recruitment summary 实现：`9c4eff934`
- BFF summary 实现：`5917f71a5`
- `origin/release/0.2.5` 基线：`21e34ff047bf17e20e0fc0e13f1e391460456270`
- BFF OpenAPI：`apps/recruitment-bff/openapi/mobile-v1.yaml`，版本 `1.0.0`

前端设计基线为 `b4d28ac28d750fbe8cbbe95bb2624bd72e563d27`。

## 2. 后端合同

前端读取以下两个无查询参数的接口：

```text
GET /api/v1/me/match-cases/summary
GET /api/v1/recruiter/match-cases/summary
```

两个接口返回同形的闭合 `result`：

```ts
interface MatchCaseSummary {
  open_total: number;
  open_anonymous_screening_total: number;
  open_needs_action_total: number;
  ended_total: number;
  completed_total: number;
}
```

所有字段必须是 finite、safe、非负整数。Decoder 拒绝缺失字段、额外字段、数字字符串、小数、负数、`NaN` 和 `Infinity`。候选“已归档”需要计算 `ended_total + completed_total`；相加结果也必须是安全整数，否则整个响应按坏合同 fail closed。

## 3. 方案选择

### 3.1 采用方案：扩展现有 MatchCase 域

在现有 MatchCase data source、P5 后端状态和 P5 操作层中加入 summary 资源。两个“我的”页只消费同一份角色 summary 快照，现有统计 selector 负责把快照投影成页面值。

这是满足当前需求的最小方案：summary 是 MatchCase 的只读聚合，并且必须复用 P5 已有的 subject、role、session generation、single-flight 与 401 清理纪律。把它留在 P5 域内可以避免复制另一套会话隔离和 mutation 后刷新机制。

### 3.2 未采用方案

独立“我的页统计”域会重复 P5 的状态、栅栏、单飞和清理逻辑；当前只有一个同形资源，没有证据支持新域。

页面本地 hook 虽然表面改动更少，但无法统一处理 P5 mutation 后刷新，容易让 candidate/recruiter 行为漂移，也违反页面通过 data source 与 operation/state 层访问后端的现有约束。

## 4. 组件与职责

### 4.1 Data source 与严格 decoder

在 `src/数据/招聘数据源/MatchCase.ts` 中：

- 增加 `MatchCaseSummary` 类型；
- 增加严格闭合 decoder；
- 在 `MatchCase数据源` 增加按角色读取 summary 的方法；
- candidate 与 recruiter 复用同一 decoder，仅由角色选择不同路径；
- 请求保持 `no-store`，不带查询参数，也不从已有列表计算或补齐字段。

`HTTP招聘数据源` 已组合完整的 MatchCase data source，因此不增加新的 facade 或资源层。

### 4.2 P5 summary 状态

在 `src/状态/后端/类型.ts` 的 P5 状态中增加按角色隔离的 summary 快照。每个快照至少表达：

- 当前加载阶段；
- 是否刷新中；
- `ownerSubjectId`；
- 解码后的 summary 或 `null`；
- owner-safe 错误文案；
- 用于迟到响应判定的 generation。

Summary 只保存在内存中，不进入资料状态、Redux/devtools 持久层或 localStorage。Candidate 与 recruiter 使用独立角色槽；快照仍携带 owner，以防同角色换账号时复用旧主体数据。

### 4.3 P5 summary 操作

在 `src/状态/后端/MatchCase操作.ts` 中增加加载与刷新 summary 的操作，复用现有依赖和纪律：

- Backend 模式才发请求，Mock 模式零请求；
- 同角色、同主体的并发读取 single-flight；
- 响应提交前校验 subject、role、session generation 与资源 generation；
- stale success 和 stale failure 整包丢弃；
- 当前会话的 401 进入现有账号与 P5 清理流程；
- 非 401 失败只结算 summary 错误态，不影响 P5 工作区、历史或详情。

页面每次挂载都执行权威刷新。由于主壳在切换 Tab 时卸载并重新挂载“我的”页，重新进入该 Tab 即构成页面重新聚焦；本任务不增加全局 `visibilitychange` 监听。

现有 P5 mutation 确认成功后，如果该角色、该主体曾加载过 summary，则在刷新详情和已加载列表之外再刷新 summary。Summary 刷新使用独立错误边界：失败不得让已经成功的 mutation reject，也不得清空 P5 列表或历史。若此前没有加载过 summary，则不为不可见资源额外发请求；下一次进入“我的”页会直接权威读取。

本任务不增加轮询。用户重新进入“我的”页以及 mutation 后刷新已经覆盖当前数据新鲜度需求；现有 P5 列表的手动刷新行为保持不变。

### 4.4 页面投影

`src/状态/后端/MatchCase统计.ts` 继续承担页面统计投影，但 Backend 精确统计改为读取 summary 快照。与 P5 open 列表有关的候选横幅 selector 保持原行为，不改为 summary。

候选“我的”映射：

| 现有标题 | 权威字段 |
| --- | --- |
| 在谈 | `open_total` |
| 初筛中 | `open_anonymous_screening_total` |
| 待你拍 | `open_needs_action_total` |
| 已归档 | `ended_total + completed_total` |

招聘方“我的”映射：

| 现有标题 | 权威来源 |
| --- | --- |
| 在招岗位 | 现有 Job 权威状态 |
| 在谈 | `open_total` |
| 待拍板 | `open_needs_action_total` |
| 意向达成 | `completed_total` |

页面现有统计标题、布局、颜色和点击行为不变。候选 AI 代理卡保留当前可见标题与文案，只把其中数字来源改为同一份 `open_total`。招聘方代理卡目前没有 MatchCase 跟进数字，因此保持原文，不追加 `MatchCase` 或其它新文本。

## 5. 加载、失败与会话边界

Summary 的展示语义如下：

- 首次加载：所有 summary 驱动的数字显示 `—`；
- 刷新中：显示 `—`，不继续展示旧 summary；
- 成功：显示精确十进制数字，不加 `+`；
- 成功值为零：明确显示 `0`；
- 超时、网络错误、500 或坏 schema：清除旧 summary 数据并显示 `—`；
- 重试成功：以最新权威结果替换 `—`；
- owner、role 或 session 不匹配：旧响应不得写入当前页面。

Summary 错误与 P5 列表错误保持分离。Summary 失败不能清空已经成功加载的工作区、历史或详情，也不能阻止用户进入现有 open/history 页面。Backend 失败时不得回退 Mock、localStorage、当前分页长度或历史页长度。

## 6. 预计代码范围

预计修改：

```text
src/数据/招聘数据源/MatchCase.ts
src/数据/招聘数据源/MatchCase.test.ts
src/状态/后端/类型.ts
src/状态/后端/MatchCase操作.ts
src/状态/后端/MatchCase操作.test.ts
src/状态/后端/MatchCase统计.ts
src/状态/后端/MatchCase统计.test.ts
src/屏幕/我的.tsx
src/屏幕/我的.test.tsx
src/屏幕/企业我的.tsx
src/屏幕/企业我的.test.tsx
```

若实现时发现 summary 无法复用现有 P5 栅栏或会话清理，而必须引入新的跨域机制，则属于隐藏复杂度，应停止实现并重新评审设计，不能在 Plan 或实现中自行扩展架构。

## 7. 测试与验证

### 7.1 Data source 合同测试

- candidate 与 recruiter 选择正确 endpoint；
- 合法五字段响应成功解码；
- 缺失字段、额外字段、坏类型、数字字符串、小数、负数、非 finite 或非 safe 数字全部失败；
- `ended_total + completed_total` 不安全时 fail closed；
- 0 和大于单页上限的精确值原样保留。

### 7.2 操作层测试

- Backend 首载、强制刷新、失败与重试；
- Mock 模式零请求；
- 同 owner/role single-flight；
- candidate/recruiter 角色隔离；
- 同角色 A → B 换主体时旧响应不提交；
- 快速切角色时迟到 success/failure 不污染当前状态；
- 当前 401 清理账号与 P5，stale 401 不清新会话；
- 非 401 失败只清 summary 数据，不影响 P5 列表、历史和详情；
- mutation 成功后刷新已经加载的当前角色 summary；
- mutation 后 summary 刷新失败不改变 mutation 成功结果。

### 7.3 页面测试

- 候选四项按合同映射，已归档为两个终局字段之和；
- 招聘方三项 MatchCase 数字按合同映射，在招岗位继续读取 Job；
- `0` 与未加载/失败的 `—` 可区分；
- 大于一页的 open 显示精确值，不显示 `N+`；
- 两端切换时只显示当前角色 summary；
- 候选代理卡与候选“在谈”使用同一个 `open_total`；
- 现有标题、导航与待处理卡点击动作不变；
- Mock 模式保留现有演示数字和文案，零 Backend summary 请求。

### 7.4 交付验证

按仓库现有脚本执行：

```text
npm test -- <新增或修改的测试文件>
npm run typecheck
npm run lint
npm run build
```

Backend local dogfood 至少记录：

- candidate 与 recruiter summary 请求路径和 200 状态；
- 页面重新进入后的重新请求；
- candidate/recruiter 切换后数字互不复用；
- 0 与非零精确值展示；
- summary 失败不影响现有 P5 列表导航；
- Mock 模式回归。

## 8. 非目标与延期项

本任务明确不包含：

- `FE-IV-01` 候选实名认证；
- CSS、颜色、间距、统计标题、代理卡标题或页面布局变更；
- P5 列表、历史、分页、详情 decoder 或轮询重写；
- 用 summary 合成或裁剪任何 MatchCase 列表；
- 新的通用 query/cache 框架；
- 浏览器全局聚焦监听或 summary 轮询；
- 修改招聘方“在招岗位”的 Job 数据来源；
- 其它 handoff、顺手重构或未来扩展预留。

只有出现当前设计无法覆盖的真实 freshness 故障，才重新考虑浏览器聚焦监听或轮询；只有出现第二类需要复用相同资源框架的独立聚合查询，才重新考虑抽取通用 query/cache 抽象。

## 9. 完成定义

- Backend 模式下，候选和招聘方“我的”页显示 summary 提供的跨页精确数字；
- 候选“已归档”正确显示 `ended_total + completed_total`；
- `N+` 从这两个页面的 Backend MatchCase 统计中消失；
- loading/error 显示 `—`，0 显示 `0`，失败不回退任何非权威来源；
- candidate/recruiter、subject 与 session 边界下没有迟到数据污染；
- 候选代理卡数字与 `open_total` 一致，现有可见标题和文案不变；
- 招聘方“在招岗位”继续来自 Job，招聘方代理卡文案不变；
- Mock 模式、P5 列表/历史/详情与现有导航不回归；
- 定向测试、typecheck、lint、build 和 Backend local dogfood 通过。
