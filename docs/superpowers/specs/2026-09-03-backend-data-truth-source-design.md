# Backend 数据真相源修复设计

## 状态

- 2026-09-03 经 `superpowers:brainstorming` 逐节批准。
- Handoff 已验证前端基线：`origin/main@86125819e760468772e562d4c2c0537bf2eee0ea`。
- 设计时前端最新本地 `origin/main` / 当前 HEAD：`ee64c560e2cf02abb092d32ba21d4cbfa4e62119`。
- 已直接核对后端合同提交：`agxp-monorepo release/0.2.5@2be8c27489e9eef8fec20b83eb5fd443faf9dfbf`。
- 实施前仍须按 Handoff 要求 fetch 最新主干，以届时最新前端 HEAD 为实现基线，并按符号而非冻结行号定位代码。
- 验收模式：`VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local`。

## 目标

修复四处 Backend 数据真相源错误：

1. 候选端和招聘端“我的”页只从当前主体、当前角色的权威 P5 MatchCase workspace 统计 open Case；
2. 候选“谁接触过我”只显示 `/api/v1/me/contact-events` 成功快照；
3. 岗位办公方式满足 `remote ↔ 全远程` 的闭合回显和保存；
4. 候选设置页在没有实名合同时不声称“已认证”。

Backend 初始化、加载失败、401、登出、换主体和换角色都不得回退 Mock fixture、legacy reducer 数组或 localStorage。Mock 模式保留现有演示行为。

## 最小方案与取舍

采用“现有域内最小扩展”：

- P5 继续使用现有 data source、operation、scope、单飞和 fence，只新增两个“我的”页共用的纯统计 selector，以及识别快照主体所必需的最小 owner 元数据；
- contact-events 新增一个单一职责的小型 data source + operation/state 域，复用现有会话边界模式，不建立泛型 query/cache 框架；
- 办公方式收敛已有映射，不引入新表单层；
- 实名行只做 Backend/Mock 条件投影，不新增后端或本地状态。

不采用页面各自请求/计数，因为它会复制统计口径和会话竞态处理；不建立通用分页资源框架，因为当前只有一个新增资源，没有证据证明重构 P5/P8 能抵偿风险和认知成本。

## 已核对的后端合同

### MatchCase

- 候选：`GET /api/v1/me/match-cases`；招聘：`GET /api/v1/recruiter/match-cases`；
- 历史分别通过 `.../match-cases/history?lifecycle=ended|completed` 读取；
- open/history 响应均只有 `items` 与 `next_cursor`，没有 `total`；
- 默认页长 20、最大页长 50；`next_cursor: null` 才能证明已到末页；
- 本批统计只读取 `state.lifecycle`、`state.stage`、`state.status` 与 `needs_action`，不从 `step`、文案、时间线、昵称或 legacy reducer 项推断。

### Contact events

- 路由：`GET /api/v1/me/contact-events?limit=&cursor=`；
- 默认/最大页长均为 50，响应只有 `items` 与 `next_cursor`；
- item 精确字段为：
  - `event_id`：`^cev_[0-9a-f]{32}$`；
  - `organization`：只含 `organization_id`（`^org_[0-9a-f]{32}$`）与长度 1–200 的 `display_name`；
  - `action`：`anonymous_profile_viewed | contact_started | submitted_resume_viewed`；
  - `occurred_at`：RFC3339 date-time；
- 所有对象 `additionalProperties: false`；
- cursor 是最大 512 字符的无填充 base64url，不透明、端点/owner 绑定且只能消费一次；错误 cursor 返回 `invalid_request_body` 或 `invalid_cursor`；
- 页面按后端返回的 newest-first 顺序展示，不存在招聘方个人身份、内部 source、浏览时长或详情 ID 合同。

以上合同已经从该后端提交的 OpenAPI、Go handler、client DTO 和测试交叉确认；本批无需等待后端变更。

## A. 两端“我的”页读取权威 MatchCase

### Backend legacy 状态归零

`后端种子状态` 必须显式把以下 legacy 演示数组设为空：

- `在谈列表`；
- `企业候选列表`；
- `归档列表`；
- `企业归档列表`。

新增一个只供 Backend 会话边界使用的根状态清理动作，原子清空这四个数组。它接入统一登出/当前轮 401 清理，以及主体基串（`subject_id + role`）变化的现有 P5 清理点。本批目标页即使处于过渡渲染也不会读取这些数组；看市场和双端代理详情的展示型在谈数改读共享 P5 selector，不能把清空后的数组长度 `0` 冒充权威零。岗位管理、岗位详情和发布岗位只按岗位编号匹配 legacy 列表作停止/删除保护谓词；Backend 岗位 ID 与 Mock 候选不同源，结果恒为无匹配，本批不把这种布尔守卫扩成统计接线。已有明确 Backend/Mock 分支的历史页和消息页在 Backend 分支本就不读取这些数组。Mock 初始化和 reducer 行为不变。

### Scope 注册与主体隔离

候选“我的”页注册 `P5范围键.open('candidate', null)`，招聘“我的”页注册 `P5范围键.open('recruiter', null)`。Backend 分支通过现有 `设置P5范围` 和 `加载工作区` 读取；页面不复制 HTTP、解码、刷新或重试逻辑。

注册/加载 effect 同时依赖当前 `subject_id` 和角色。离页或换 scope 时注销可见范围；Mock 分支不注册、不加载。

现有 P5 fence 已在请求发送前捕获 subject、role、session generation、scope 和 scope generation，能丢弃迟到结果，但 scope key 本身不含 subject。为避免同角色换主体时在清理 effect 前短暂显示同名旧 scope，P5 列表快照增加最小 owner 标记（至少包含捕获时 `subject_id`，角色仍由 scope key 表达）：

- 成功/加载/失败快照沿用当前 owner；
- `加载工作区` 的“已有成功快照直接返回”只对当前 owner 生效；
- selector 在 owner 与当前主体不匹配时返回不可用；
- open 与 history 的展示组件都在 owner 与当前主体不匹配时拒绝渲染旧 items；
- 既有 session generation fence 继续决定在飞响应能否落位，owner 标记不替代 fence。

这项元数据只存在内存，不进入持久化。

### 共享统计 selector

在 P5 状态/展示域附近新增无 React 副作用的共享 selector。输入为当前主体、unfiltered open scope 快照和角色，输出统一的展示状态与三个 open 计数：

- `openCount`：有效 `state.lifecycle === 'open'` 项总数；
- `anonymousScreeningCount`：其中 `state.stage === 'anonymous_screening'`；
- `needsActionCount`：其中 `needsAction === true`。

即使 open endpoint 理论上只返回 open 行，selector 仍防御性过滤 lifecycle；它不读取 `step`、`status` 文案、时间线或 legacy 数组。AI 代理卡“正在跟进 N 个机会”复用同一个 `openCount` 展示值，规则数继续沿用现有水合门控。

展示规则：

| 快照状态 | 数字展示 |
| --- | --- |
| 当前 owner 的成功快照，`nextCursor === null` | 精确 `N` |
| 当前 owner 的成功快照，仍有 `nextCursor` | 每个派生值显示 `N+`，明确只是已加载窗口下界 |
| 当前 owner 的完整成功空页 | `0` |
| 未开始、加载中、失败或 owner 不匹配 | `—` |

候选“已归档”和招聘“意向达成”本批在 Backend 固定为 `—`，不为装饰性统计额外请求 history，也不把 `completed`、`passed` 等同于页面概念。Mock 模式继续显示原型数字。

“待你拍/待拍板”保留现有点击行为。现有 action 只把页面切到对应角色的在谈 Tab、全部意向/岗位范围和“待我拍板”视图，Backend P5 列表因而读取与统计相同的 unfiltered scope；它不创建业务事实。失败时用户仍能经该入口或底部在谈 Tab 到达既有 P5 重试界面。“我的”页不新增重试组件。

## B. 候选接触记录使用 contact-events

### Data source 与 strict decoder

新增单一职责 contact-events facade，并由 `HTTP招聘数据源` 组合。首屏发送 `limit=50` 且省略 cursor；续页只发送 operation 当前成功状态保存的 cursor。

strict decoder 必须：

- 对页、item 和 organization 逐层检查闭合字段集，未知字段 fail closed；
- 校验 event/organization ID、非空组织展示名、闭合 action、严格 RFC3339 时间；
- 校验 `next_cursor` 为 `null` 或合同允许的无填充 base64url；
- 完整页面解码成功后才返回规范化数据。

规范化 item 只保留 `eventId`、`organizationId`、`organizationDisplayName`、action 与 `occurredAt`。禁止增加或展示招聘方人名、职位、头像、内部 source、浏览时长或详情 ID。

### 内存状态、分页与 fence

新增 candidate-only contact state：

- 当前 owner（candidate `subject_id`）；
- `未开始 | 进行中 | 成功 | 失败`；
- 已成功 items；
- `nextCursor`；
- 首屏/刷新错误与分页错误。

运行时引用只承担当前用例需要的责任：owner/session generation、请求 cursor 的单飞属主和已消费 cursor 集。所有内容仅在内存。

操作语义：

- 首载和刷新从第一页读取，完整成功后原子替换；失败时不提交半页；
- 同一 owner + cursor 单飞；过期属主允许新会话接管，旧响应只释放自己的锁；
- 续页只能消费当前状态中的 `nextCursor`，成功后原子追加；
- 重复消费 cursor、服务端返回与请求相同的不前进 cursor、`invalid_cursor` 或坏页均进入分页错误，坏页整页丢弃；
- 续页失败保留此前已验证的成功 items，但不追加任何失败页内容；
- 当前轮 401 进入统一账号清理；迟到 401 不得登出新会话；
- 登出、401、换主体或离开 candidate 角色时清空快照、cursor 和锁；
- 记录不写 localStorage、sessionStorage、Cache API 或 Service Worker。

### 页面投影

Backend 页面只渲染当前 owner 的成功快照：

- 成功空 `items` 复用当前空记录容器；
- 未加载、加载中、初载失败或 owner 不匹配时渲染中性状态，不显示任何 mock 公司；
- 当前页面没有 PM 确认的“加载更多”控件，本批不新增；状态和 operation 保留安全的 `nextCursor`/续页语义，但页面不声称首屏是全量；
- Mock 分支继续使用当前 `接触记录列表`，且零 contact-events 请求。

纯展示映射沿用既有动作语义：

| Wire action | 页面动作 |
| --- | --- |
| `anonymous_profile_viewed` | `匿名画像被查看` |
| `contact_started` | `发起接触` |
| `submitted_resume_viewed` | `递交简历后查看` |

时间使用本地化绝对日期时间，避免增加相对时间计时器和推断；公司字标从 `display_name` 的首个 Unicode 字符派生。动作、时间和字标逻辑均为纯函数。

## C. 岗位办公方式闭合映射

页面 canonical vocabulary 固定为 `现场 | 混合 | 全远程`，wire vocabulary 固定为 `onsite | hybrid | remote`：

| Wire | 页面 |
| --- | --- |
| `onsite` | `现场` |
| `hybrid` | `混合` |
| `remote` | `全远程` |

实现要求：

- 删除 `remote → 远程` 的旧投影；
- job create 和 patch 共用同一反向映射，不保留岗位专用重复表；
- 删除非法页面值静默回退 `onsite` 的行为，映射层 fail closed；
- `发布岗位.tsx` 的办公方式状态收窄为三种 canonical 值加未选择态，选项、文案、布局和 CSS 不变；
- `remote` owner job 进入编辑态时“全远程”精确选中，无修改保存仍发送 `remote`；
- create/patch 其他字段完全沿用现有构造；
- 求职意向页面仍使用其现有 `现场 | 混合 | 远程` vocabulary；本批不改变意向水合或添加意向选项，避免把岗位修复扩大到历史意向任务。

不修改 `发布岗位.tsx` 的 JD 上传入口或相关流程。

## D. 候选设置页不伪称实名

`设置.tsx` 仅按数据源模式分叉实名认证行：

- Backend：保留“实名认证”标签，状态显示 `—`，渲染为不可交互行，不显示进入箭头，不绑定点击，不产生 toast 或 mutation；
- Mock：保留当前“已认证”演示状态和原型交互，等待 PM 后续决定。

`phone_otp` 只表示手机号登录凭据已验证；简历姓名不参与实名判断。账号与安全页及 credentials 水合、错误处理和测试不变。不新增后端请求、字段、状态或配置。

## 错误、并发与隔离原则

- 页面不直接 `fetch`；所有 Backend 读取通过 data source + operation；
- decoder、HTTP 或 operation 失败均不回退 Mock、localStorage 或上一主体快照；
- 新旧资源都保留现有 subject、role、session、scope generation 和单飞纪律；
- 只有通过当前 fence 的 401 才能触发统一账号清理；
- 初始请求失败不渲染业务行；刷新/分页均在完整成功后原子提交；
- 数据源切回 Mock 时只走现有 fixture/reducer 路径，零 Backend 请求；
- 不更改 BFF 参数、错误码、幂等键、`If-Match`、隐私投影或错误文案。

## 预计文件范围

主要运行时代码：

```text
src/状态/初始状态.ts
src/状态/应用状态.tsx
src/状态/后端/类型.ts
src/状态/后端/会话操作.ts
src/状态/后端/MatchCase操作.ts
src/状态/后端/MatchCase统计.ts（新，或同域等价命名）
src/屏幕/我的.tsx
src/屏幕/企业我的.tsx

src/数据/招聘数据源/接触记录.ts（新）
src/数据/HTTP招聘数据源.ts
src/状态/后端/接触记录操作.ts（新）
src/屏幕/接触记录.tsx

src/数据/后端映射.ts
src/屏幕/发布岗位.tsx
src/屏幕/设置.tsx
```

相应单元测试随实现新增或修改。除非最新主干的实际结构要求等价调整，不新增共享视觉组件，不修改 CSS。

## 测试设计

### MatchCase 与“我的”页

- Backend 种子四个 legacy 数组为空；登出、当前轮 401、换 subject/role 后仍为空；
- candidate/recruiter 空 open 页均显示权威 `0`，不出现 8/1/5/3、5/2 等 fixture 数字；
- 混合 stage/needsAction 的完整页分别精确计数；有 next cursor 时所有派生统计为 `N+`；
- 未开始、加载、失败和 owner 不匹配显示 `—`，AI 跟进数同口径；
- 切角色、登出重登、同角色换 subject 时旧快照/迟到响应不可见；成功重试后更新；
- P5 open/history 组件都拒绝 owner 不匹配快照；看市场与双端代理详情在 Backend 复用已在内存的 selector，未载快照时显示中性缺失态且不自行请求；
- 点击待办统计落到对应角色的 unfiltered Backend P5 列表；
- Mock 不请求 P5，并保留原统计、卡片和 reducer 行为。

### Contact events

- decoder 接受三个合法 action，拒绝未知字段、坏 ID、坏 enum、坏 RFC3339 和坏 cursor；
- HTTP 首屏/续页查询参数正确；
- 空成功页零业务记录、零 mock 公司；三个 action 映射为既有页面语义且无招聘方个人身份；
- 首载/刷新原子替换，分页原子追加；重复、不前进或服务端拒绝的 cursor 进入安全错误且不混入失败页；
- 同页单飞，subject/session/role 变化丢弃旧响应；当前 401 清理、迟到 401 无副作用；
- Mock 继续渲染演示记录且零 contact-events 请求。

### 办公方式与实名

- 三种办公方式正反向穷举；非法页面值 fail closed；
- remote 编辑态选中“全远程”，无修改 patch 仍发送 `remote`，其他字段不变；onsite/hybrid 不回归；
- 仅有 phone OTP 的 Backend 候选不出现“实名认证已认证”或“已通过”，实名行为无 button 语义、无 toast/mutation；
- Mock 设置行为及账号安全 credentials 读取不回归。

### 最终验证

依次运行针对性 Vitest，然后运行：

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

fixture 条件允许时再运行 `npm run test:e2e:data-source`。单元测试是必需验收，不以浏览器手测代替。

## 明确非目标

- 不实现 JD 文件上传、解析、轮询或岗位预填；
- 不改 CSS、颜色、字体、间距、组件布局、空态视觉或普通文案设计；
- 不实现候选真实身份认证，也不从 phone OTP 或简历姓名推断；
- 不修简历“至今”解析、Hub Agent 任务失败、企业披露配置或其它后端/运行时问题；
- 不新增归档岗位入口；
- 不纳入 remote 空办公地址或候选岗位详情事实投影等历史 Handoff；
- 不为接触记录新增未经设计确认的加载更多控件；
- 不在本批请求 history 统计；
- 不更改后端 schema。

## 后续 TODO：后端先行的精确统计合同

本批诚实显示 `N / N+ / 0 / —`。后续若产品需要“我的”页跨页精确数字，应按“先后端、后前端”的顺序另立任务：

1. 后端为 MatchCase open/history 合同增加权威总数能力，并完成 OpenAPI、handler/client 和合同测试；
2. 前端 strict decoder 接受新字段后，open 总数改读服务端 `total`；
3. 单独的 `total` 不能推导 `anonymous_screening` 或 `needs_action` 子集总数；若这两项也必须跨页精确，后端还需提供对应聚合字段或等价的可过滤计数合同；
4. 产品明确“已归档”和“意向达成”分别对应哪些 lifecycle/outcome 后，后端提供相同口径的聚合，前端再接入 history 指标；
5. 新合同上线并经端到端验证后，删除前端 `N+` 过渡展示。

触发这一后续工作的证据是：产品要求在分页未尽时仍显示精确统计，或真实数据量经常超过一页。当前合同与本批目标不足以支持为此自动拉完全部分页。
