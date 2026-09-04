# 前端 Handoff：Backend 数据真相源修复（不含 JD 上传与 UI 设计）

> 本文可以直接交给另一台机器上的前端 Coding Agent。接收者不需要此前聊天、测试账号、截图、浏览器会话、本机路径或其它 Handoff。开始前请先 fetch 最新主干并以最新前端 HEAD 实施；本文只依赖已经存在的 HTTP 合同，不要求后端新增字段、路由或迁移。

## 1. 目标、基线与边界

- 前端仓库：`myaier/agxp-a2a-recruiting-web`
- 已验证前端基线：`origin/main@86125819e760468772e562d4c2c0537bf2eee0ea`
- 已验证后端基线：`origin/release/0.2.5@2be8c27489e9eef8fec20b83eb5fd443faf9dfbf`
- 运行模式：`VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local`

目标：Backend 模式只显示已经从权威 API 水合的数据；不得把 Mock 初始状态、静态 fixture 或自由文本伪装成真实业务事实。

本 Handoff **明确不包含**：

- JD 文件上传、解析、轮询和岗位表单预填；该能力由另一条独立前端分支实施，禁止改动 `src/屏幕/发布岗位.tsx` 的 JD 上传入口；
- CSS、颜色、字体、间距、组件重画、空态视觉方案、信息层级与普通文案设计；这些交由 PM/Claude Design，见同日 PM Handoff；
- 候选人真实身份认证能力；当前候选侧没有可读取/发起实名的权威合同，不能由前端猜测；
- 简历“至今”日期解析和 Hub Agent 任务失败；二者是后端/运行时问题；
- 企业披露策略是否应该可配置；当前代码定义为产品固定规则，不在本批改为可写功能；
- “归档岗位”入口；岗位管理页已有在招/已归档分组，后端也支持 archived 列表，这不是待修接线问题。

### 与历史 Handoff 的唯一归属

本文**取代** `docs/handoffs/2026-09-01-my-settings-wiring-frontend-handoff.md` 中尚未完成的 `FE-ME-01`、`FE-ME-05` 和候选侧 `FE-ME-10`。旧文档已加执行范围标记，实施者不得从两份文档重复领取这些编号。

本文的办公方式任务只修复 `remote ↔ 全远程` 的值映射和无修改保存 round-trip，不包含以下历史任务：

- `2026-09-01-employer-onboarding-frontend-handoff.md` 的 remote 空办公地址条件；
- `2026-09-02-release-0.2.5-frontend-only-handoff.md` 的候选岗位详情事实投影。

三者虽然可能触达 `后端映射.ts` 或 `发布岗位.tsx`，但合同、验收和行为不同。若这些历史分支并行实施，应通过普通 Git 串行合并/冲突复核，不得把另外两项扩大进本文。

全局约束：

1. Backend 分支失败、未加载或切换账号/角色时，绝不回退 Mock 数字、Mock 卡片或 localStorage 旧值。
2. 保持既有 session generation、role/scope fence、单飞和 strict decoder；页面不得直接 `fetch`，通过现有 data source + operation 层访问后端。
3. Mock 模式保留现有演示行为；所有新增逻辑必须显式受 `数据源模式 === 'backend'` 保护。
4. 不更改 BFF schema、参数、幂等键、If-Match、隐私投影或后端错误词。

## 2. 已有合同与前端基础设施

不需要等待后端。以下能力已经存在：

| 能力 | 已有 BFF 合同 | 已有前端基础设施 |
| --- | --- | --- |
| 候选/招聘方在谈 Case | `GET /api/v1/me/match-cases`、`GET /api/v1/recruiter/match-cases`，可按意向/岗位过滤或不带过滤 | `src/数据/招聘数据源/MatchCase.ts`、`src/状态/后端/MatchCase操作.ts`、`src/屏幕/P5/MatchCase列表.tsx` |
| 历史 Case | 双端 `.../match-cases/history?lifecycle=ended|completed` | 同一 MatchCase data source / operation |
| 候选人“谁接触过我” | `GET /api/v1/me/contact-events`，返回企业快照、闭合 action、时间和分页 cursor | 当前前端没有 data source；页面错误地直接 import 模拟记录 |
| 招聘方岗位办公方式 | Owner Job 返回 `workplace_mode: onsite | hybrid | remote` | `src/数据/后端映射.ts` 已承担 wire → 页面字段转换 |
| 账号凭据 | `GET /api/v1/me/credentials`，只说明已验证登录凭据 | P8 credential 状态/账号安全页面已经读取该合同 |
| 屏蔽组织 | 组织搜索 + 稳定 `organization_id` 创建屏蔽项 | 现有屏蔽名单页面已经拒绝把自由文本作为 ID |

## 3. 根因：为什么“我的”页此前修过仍然错误

此前提交确实处理过部分“我的”页问题，但没有完成 Backend P5 统计接线：

- `669665b` 处理候选人头像/姓名；
- `0cf8fa8` 处理统计数字的点击副作用；
- `859e94a` 让招聘方“在招岗位”从真实 `岗位列表` 计算；
- `853a485` 之后才加入 Backend MatchCase（P5）权威状态，但没有同时改两个“我的”页。

现在 `src/状态/初始状态.ts` 的 `后端种子状态` 展开 `初始状态`，却没有清空 legacy 的 `在谈列表`、`企业候选列表`、`归档列表`。`src/屏幕/我的.tsx` 和 `src/屏幕/企业我的.tsx` 又直接读取这些 legacy Mock 数组。因此页面注释所称“从真实状态算”只在 Mock reducer 中成立；Backend 模式仍展示演示种子。

P5 权威行的可用事实为：

```ts
state.lifecycle // open | ended | completed
state.stage     // anonymous_screening | resume_submission | needs_coordination | intent_confirmation
state.status
needs_action    // 列表 viewer 的权威待办布尔值
```

不要从 `step` 文案、时间线文字、昵称或旧 reducer 条目推断统计。

## 4. 交付 A：两端“我的”页改读权威 MatchCase

### 修改范围

- `src/状态/初始状态.ts`
- `src/屏幕/我的.tsx`
- `src/屏幕/企业我的.tsx`
- 如有必要，新增一个无 React 副作用的 P5 聚合 selector；放在现有 MatchCase 展示/状态域附近，并由两个页面共用。
- 对应单元测试；不得仅靠浏览器手测。

### 要求

1. Backend 种子、登出、401、换账号和换角色后，legacy `在谈列表`、`企业候选列表`、`归档列表` 必须为空，不能残留 mock 数组。
2. 候选人“我的”页注册 candidate 的无过滤 open scope，并读取对应 P5 workspace 快照；招聘方镜像注册 recruiter 的无过滤 open scope。复用 `P5范围键.open(role, null)`、`设置P5范围`、`加载工作区`/`刷新工作区` 的既有 fence，不复制请求逻辑。
3. 统计口径必须来自同一个纯 selector：
   - “在谈”：当前角色无过滤 open workspace 的有效权威项总数；
   - “初筛中”（候选侧）：`state.stage === 'anonymous_screening'` 的有效 open 项；
   - “待你拍”/“待拍板”：`needs_action === true` 的有效 open 项；
   - “已归档”或“意向达成”：如当前 UI 没有已载对应 history scope，就不显示模拟数字；可显示中性缺失态/零，或在不影响首屏的前提下读取匹配的 history scope。不得把 `completed` 等同于“已归档”，也不得把 `passed` 等同于“意向达成”。
4. P5 快照尚未开始/正在加载时，页面不得短暂显示 mock 数字；使用中性加载值或现有非视觉占位。加载失败时不得显示假统计，且必须保留已有可访问的重试路径或转入已有在谈页重试。
5. AI 代理卡的“正在跟进 N 个机会”只复用该 selector 的 open 总数。规则数维持当前已水合门控，不在本任务改变规则逻辑。
6. 统计按钮若保留，必须导航到与统计同一 role/scope 的 Backend 在谈页；不能再派发只影响 Mock reducer 的动作。
7. Mock 模式保留当前演示卡片、统计和 reducer 行为。

### 必测用例

- Backend、新账号、两个 open/history API 均为空：候选侧和招聘侧“我的”页绝不出现 8/1/5/3 或 5/2 等演示数；代理跟进数为权威零/中性加载态。
- candidate/recruiter 各有混合 `anonymous_screening`、其他 open 和 `needs_action` Case：两个页面按上述口径正确计数。
- workspace 请求失败：不回退 legacy 数组；重试使用现有 operation，成功后更新数字。
- 切换 candidate/recruiter、登出再登录、切换 subject：旧 scope response 不能污染当前统计。
- Mock 模式快照不请求 Backend，原型统计不回归。

## 5. 交付 B：候选人接触记录改为后端 contact-events

### 修改范围

- 新增 `src/数据/招聘数据源/接触记录.ts`（或与现有 me-settings data source 合并；必须保持单一职责）
- `src/数据/HTTP招聘数据源.ts`
- `src/状态/后端/类型.ts`、新的 operation/state 文件，以及会话清理注入点
- `src/屏幕/接触记录.tsx`
- 对应 decoder、operation 和页面测试

### 要求

1. 为 `GET /api/v1/me/contact-events?limit=&cursor=` 建立 strict decoder。仅接受 BFF 已定义的 `event_id`、组织快照、`anonymous_profile_viewed | contact_started | submitted_resume_viewed`、`occurred_at` 与 `next_cursor`；未知字段、动作或坏时间戳 fail closed。
2. Backend 模式下页面只能渲染该资源的成功快照；删除对 `接触记录列表` 模拟常量的直接依赖。
3. operation 必须有 candidate subject/session fence、单飞和分页 cursor 语义；登出、401、换主体时清空快照。不得把记录写入 localStorage。
4. 复用页面已有的空记录容器；当 API 返回空 `items` 时显示该空态，而不是演示公司。空态的视觉/文案细节不在本 Handoff 规定。
5. 时间与 action 的具体中文标签通过一个纯映射层完成；不暴露招聘方个人身份、内部 source、浏览时长或详情 ID。
6. 分页如果已有设计容器则接入；若当前页面没有经过 PM 确认的“加载更多”交互，不要擅自新增视觉组件：至少保证首屏记录真实，保留 `next_cursor` 的状态而不伪称全量。
7. Mock 模式继续使用现有模拟数据。

### 必测用例

- Backend 空页：零业务记录、零 mock 公司。
- 三个合法 action 分别映射为正确的既有展示语义，且不显示 recruiter 人名/职位。
- 坏 enum、坏 `occurred_at`、重复/错误 cursor：进入安全错误态，绝不混入旧记录。
- subject/会话切换期间旧 response 丢弃。
- Mock 页面仍渲染原演示记录，且不请求 contact-events。

## 6. 交付 C：岗位办公方式的 `remote` 回显与保存正确性

### 修改范围

- `src/数据/后端映射.ts`
- `src/屏幕/发布岗位.tsx` 及其测试

### 要求

1. 建立单一、双向、闭合的页面办公方式映射。页面 vocabulary 已经是 `现场 | 混合 | 全远程`；wire vocabulary 是 `onsite | hybrid | remote`。
2. 修复 `remote -> 远程` 与 UI 选项 `全远程` 不一致的问题。既有岗位 `workplace_mode: remote` 进入编辑表单后必须选中“全远程”。
3. 用户不改办公方式直接保存时，PATCH 必须仍发送 `remote`；不得因未选中而回退 `onsite`，也不得改写其他岗位字段。
4. 所有三种模式都应满足 round-trip：wire → 页面 → create/patch wire。
5. 不改变任何 CSS、按钮样式、控件布局或展示文案。

### 必测用例

- 三种 mode 的正反向映射穷举测试。
- `remote` owner job 进入编辑态后，“全远程”被选择；无修改保存仍传 `remote`。
- onsite/hybrid 不回归。

## 7. 交付 D：候选设置页不得伪称实名已认证

### 修改范围

- `src/屏幕/设置.tsx`
- 对应测试

### 要求

1. 删除 Backend 模式固定显示“实名认证 已认证”及“已通过，无需重复认证”的点击回执。
2. `phone_otp` 凭据只意味着手机号登录凭据已验证，简历中的姓名也不等于实名；不得用二者推导实名状态。
3. 在没有候选实名合同时，使用一个不作真实性承诺的稳定状态，并使该行不再伪装成可完成的认证流程。具体文案、图标、布局由 PM/Claude Design Handoff 决定；本任务只提供数据/交互正确性。
4. Mock 模式是否保留演示状态由 PM 决定；Backend 模式绝不显示“已认证”。

### 必测用例

- 仅有 phone OTP 的 Backend 候选：页面不出现“实名认证已认证”或“已通过”。
- 页面点击不会产生假成功 toast 或伪 mutation。
- 账号与安全页面的真实 credentials 读取不受影响。

## 8. 本批明确不修的观察项

以下项已经被确认，但不应被本 Coding Agent 顺手纳入：

| 项 | 原因 | 去向 |
| --- | --- | --- |
| JD 上传 | 独立实现分支正在进行 | 独立前端分支 |
| 屏蔽组织无命中时的空态说明 | 稳定 ID 行为正确，剩余是 UI/空态设计 | PM/Claude Design Handoff |
| 招聘方“我的”卡是否展示姓名/职位 | 后端资料已保存，剩余是信息层级设计 | PM/Claude Design Handoff |
| 企业披露策略禁用控件与页脚语义 | 当前是固定产品机制，剩余是 UI/copy 设计 | PM/Claude Design Handoff |
| 对比度、样式与组件布局 | 非数据接线问题 | PM/Claude Design Handoff |
| “至今”被解析为结束月 | 后端解析 prompt/schema 语义 | 后端 Handoff |
| AI 规则委托 `invalid_agent_control_proposal` | Hub 模型/工具调用 schema 兼容性 | 后端/运行时 Handoff |

## 9. 完成定义

在 Backend 模式下，新账号、空 MatchCase、空 contact-events、phone OTP 登录、一个 `remote` 岗位这五个控制条件同时成立时：

1. 两端“我的”页不展示任何 mock 在谈/待办/归档统计；
2. 候选接触记录不展示虚构公司；
3. 编辑岗位准确回显并保留“全远程”；
4. 设置页不声称候选已实名；
5. Network 中不存在由上述页面造成的 Mock fallback；
6. Mock 模式现有原型行为、现有 Backend P5 列表/历史页、账号安全页和岗位 CRUD 测试均保持通过。
