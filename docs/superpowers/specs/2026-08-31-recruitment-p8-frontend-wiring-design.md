# Recruitment P8 前端账号生命周期与合规接线设计

**日期：** 2026-08-31

**状态：** 已批准，并已按后端 `release/0.2.5` 最终合同校准

**前端基线：** `agxp-a2a-recruiting-web@659de17be7aac4797bd572228179aedfc5768ae3`

**后端发布基线：** `agxp-monorepo release/0.2.5@897468e5221f0078533178a28119bb259dbb676e`

**后端设计来源：** `agxp-monorepo plan/recruitment-backend-p8@a33d5a79c40d7a33416f18e29b321327b3a68aad`

**上游：** 已落地的前端 P0–P7 Backend 接线、后端 P8 账号生命周期与合规设计

**后续：** 依据本校准 Spec 生成零上下文实施 Plan；实施 Task 0 重新验证发布 SHA、OpenAPI 与 canonical L3

## 1. 摘要

P8 前端把当前账号安全、反馈和举报页面中的硬编码数据与本地假成功，接到后端 P8 的真实控制面：masked credential、招聘 Session、手机号换绑、退出其他设备、数据导出、招聘账号注销、普通反馈和上下文举报。

采用“独立 P8 控制面域 + 现有页面 Backend 分支”。P8 增加严格数据源、内存状态、操作层和最小导出恢复句柄；不引入新状态库、通用工作流框架或第二套 HTTP 客户端。账号页、设置页、反馈页、举报层和既有弹层继续作为 PM 定稿的视觉壳，Mock 行为继续隔离，Backend 失败不回退 Mock。

本设计的首要产品约束是保留前端视觉：不重排现有页面、不重做 CSS、不改动效和操作层级。除“导出我的数据”缺少任何产品入口而必须增加一行，以及让既有举报壳获得权威 target 所必需的三个 Backend 入口校正之外，接线只替换数据、提交行为、必要状态和不真实文案。视觉回归把这一约束作为正式验收门。

## 2. 现状与合同核对

### 2.1 当前前端

- `账号安全.tsx` 以组件本地状态保存固定手机号 `138 **** 6021`，固定展示 `iPhone · 上海`，换绑接受任意 4 位数字，退出其他设备只弹本地提示，注销只跳登录页。
- `设置.tsx` 仍显示固定手机号；当前“退出登录”已经通过现有会话操作调用真实 logout，不属于 P8 重做范围。
- `反馈.tsx` 把普通反馈和无目标举报放在同一表单，提交只切本地成功态并显示固定工单号与未经后端承诺的“24 小时内核查”。
- `举报层.tsx` 当前由 Mock 职位详情、Mock 直聊和 Mock 真人会话共用；提交只弹提示，勾选屏蔽时向本地 reducer 派发名称级拉黑。Backend 职位详情没有举报项，且在无 P4 推荐坐标时连“⋯”都不渲染；Backend P7 真人会话的“⋯”只是装饰性 `span`；Backend 直聊则沿用没有权威 P8 target 的 Mock 举报入口。
- 用户协议承诺可以导出简历与协商记录，账号注销提示也建议先导出，但仓库中没有数据导出入口、状态或下载能力。
- P4–P7 已经形成严格 facade、raw snapshot、subject/session/scope fence、幂等意图和无 Mock fallback 的固定架构，P8 应沿用，不在页面内直调 HTTP。

### 2.2 后端 P8 公开合同

账号安全：

```text
GET    /api/v1/security/sessions
DELETE /api/v1/security/sessions/others
GET    /api/v1/me/credentials
POST   /api/v1/me/credential-replacement-attempts
POST   /api/v1/me/credential-replacement-attempts/{attempt_id}/complete
```

账号生命周期：

```text
POST   /api/v1/me/data-exports
GET    /api/v1/me/data-exports/{export_id}
GET    /api/v1/me/data-exports/{export_id}/download
POST   /api/v1/me/account-deletion
```

合规入口：

```text
POST   /api/v1/compliance/feedback
POST   /api/v1/compliance/reports
```

关键合同：

- 浏览器只得到服务端生成的 credential 掩码，不能得到手机号明文、identity ID、digest 或 key material。
- Session 只有 `session_id / created_at / expires_at / current`，没有设备名、UA、IP 或地点；前端不得继续展示硬编码设备事实。
- 换绑 begin 只提交新手机号；complete 只提交全产品统一的 4 位 OTP proof。成功后新手机号成为唯一 active `phone_otp` credential，当前招聘 Session 保留，其他招聘 Session 被撤销。
- revoke-others、换绑两步、创建导出、注销、反馈和举报均要求 caller-provided Idempotency-Key。
- 数据导出是 `queued → running → ready | failed`，ready artifact 之后过期；下载由 BFF 同源流式代理，不暴露对象存储坐标。
- 注销冻结 candidate 与 recruiter 共用的 Recruitment principal，清 Cookie 并立即禁止招聘访问；跨域物理清理由后端 durable workflow 完成。
- 普通反馈只有 `bug | suggestion | other`，没有举报 target 或 block 语义。
- 举报 target 是闭合 union：`job | match_case | conversation`。浏览器只提交类型、opaque ref、原因与 `also_block`，不能提交被举报 identity、组织、展示名、证据或 block target。
- `also_block=true` 无合法 block edge 时返回 `block_unavailable`，且不创建半份举报。
- `operation_outcome_unknown` 与 `idempotency_in_progress` 必须使用同一 key 和不可变请求重试。

### 2.3 最终后端基线

P8 四个子面已经合并到同一个发布提交 `release/0.2.5@897468e5221f0078533178a28119bb259dbb676e`：

- `apps/recruitment-bff/openapi/mobile-v1.yaml` 在该 SHA 同时声明 credential、Session、手机号换绑、revoke-others、数据导出、账号注销、反馈和举报全部公开路径。
- 最终错误合同包含各写操作自己的闭合 409/503 union；只有声明 `Retry-After` 的换绑、revoke-others、注销未知结果等分支才允许据此自动重试。
- `tests/l3/recruitment-mobile-local-cases.json` 的 canonical case 在同一 SHA 包含 `account-security`、`compliance-intake`、`typed-report`、`report-evidence`、`data-export`、`object-lifecycle`、`portable-copy`、`account-deletion`、`account-retention` 与 `product-re-registration` 风险标签。
- release 顶部另含账号冻结、举报 subject fence、删除 settled event 与压缩 retention deadline 的集成修正；前端不得回退到四个候选子分支分别取合同。

本 Spec 后续所有“最终 OpenAPI”均特指上述单一 SHA；实施 Plan 的 Task 0 仍要重新 fetch 并验证该 SHA 未漂移，再运行前端接线。

## 3. 目标、视觉约束与非目标

### 3.1 目标

1. 两端共用的账号安全页展示真实 masked phone、当前 Session 时间和其他 Session 数量。
2. 保留现有两步抽屉完成全产品统一的 4 位 OTP 手机号换绑，未知结果可安全重试。
3. 退出其他设备只在后端确认成功后显示真实回执，并权威刷新 Session。
4. 用户可以创建、恢复、查看并下载自己的异步数据导出；刷新或离开页面不重复创建任务。
5. 注销与导出状态正确联动，注销未知结果不伪装成功，成功后清除全部前端账号状态。
6. 普通反馈得到真实工单号；无目标举报不冒充 safety report。
7. 岗位与 P7 真人会话举报使用权威 target，also-block 只相信后端回执。
8. 全部异步提交受 subject、session generation、scope generation 和 unmount fence 保护。
9. Backend 失败不回退 Mock；Mock 不发任何 P8 请求。

### 3.2 PM 视觉不变量

- 不改变既有页面层级、导航结构、卡片形态、按钮形态、弹层类型、色彩、字号、间距和动效。
- 不把账号安全扩张成新的设备管理中心，不新增设备详情列表。
- 换绑继续使用现有两步抽屉；注销继续使用“说明层 → 最终确认”两层交互。
- 反馈继续使用现有分类片、textarea、提交键和成功页。
- 举报继续使用现有原因项、同时屏蔽行、提交键和取消键。
- 账号安全页允许在注销按钮之前增加一组同款卡，内含“导出我的数据”；Backend 职位详情允许在既有更多操作抽屉增加“举报这个职位”，并在存在权威 `jobId` 时显示既有“⋯”（即使没有 P4 推荐坐标）。两处都只复用现有行、按钮与弹层样式，不引入新的视觉体系。
- Backend P7 真人会话允许把当前同样式的装饰性“⋯”变为键盘可访问的真实入口，但像素外观不变；Backend 直聊必须隐藏没有权威 target 的举报入口。Mock 对应入口与行为保持原样。
- 因真实合同必须变化的文案只限：真实时间/数量、导出状态、错误提示、真实工单号以及移除不受支持的 24 小时 SLA；验证码位数继续沿用现有 4 位规则，不产生视觉变化。

### 3.3 非目标

- 设备指纹、设备命名、UA 展示、IP 定位、登录地点、风险评分或安全通知中心；
- 单独注销 candidate 或 recruiter 角色、全局 AGXP identity 删除、账号恢复或账号合并；
- 密码登录、新认证 Provider、credential unlink 或展示 credential 明文；
- 数据导出历史列表、通用报表、PDF 版协商报告、客户端解压或预览 ZIP；
- 合规管理后台、用户可见举报进度列表、24 小时运营 SLA 或用户可见接触审计；
- 为 MatchCase 新增举报按钮，或为没有权威 target 的 Backend 直聊发明举报对象；
- 通用 mutation workflow、通用 query cache、状态库迁移或跨业务域大重构；
- 修改现有 Mock 剧情、样式或为了 Backend 删除 Mock 专用行为。

## 4. 方案比较

### 4.1 采用：独立 P8 控制面域 + 现有页面 Backend 分支

新增严格 P8 facade、内存 owner 和操作层。现有页面继续作为视觉壳，按 `数据源模式` 使用 Backend 操作或原 Mock 行为。账号安全资源按需读取；反馈和举报按动作提交；导出通过最小恢复句柄跨刷新续接。

优点：与 P4–P7 架构一致；幂等、未知结果、401、并发栅栏和账号清理只有一个 owner；页面不承担协议判断；Mock 与 Backend 不互相污染。

### 4.2 不采用：页面直接调用 HTTP

这会把换绑两步、导出轮询、注销未知结果和举报重试分别散进组件。页面卸载、切账号或响应丢失时难以统一处理旧响应与幂等键，少量文件改动不能抵消协议重复和安全风险。

### 4.3 不采用：P8 全部加入登录启动水合

凭证与 Session 不是主壳启动必需数据，导出和举报更是低频动作。每次登录读取全部控制面会扩大敏感快照驻留和启动失败面。P8 采用页面按需读取；只有候选设置页需要显示 masked phone 时按需读取 credential，不读取 Session。

### 4.4 不采用：为 P8 新建通用工作流框架

当前只有换绑、导出、注销和合规提交四类闭合流程。各流程共享幂等纪律，但状态与对账证据不同；抽成动态注册框架会隐藏真实差异，并没有第二个前端产品提供复用证据。

## 5. 架构与组件边界

### 5.1 严格数据源

`src/数据/BFF契约.ts` 声明闭合 Wire DTO。新增 `src/数据/招聘数据源/P8控制面.ts`，职责仅包括：

- 严格解码 result envelope 与公开错误；
- 把 snake_case Wire 映射为页面无关的 camelCase 领域类型；
- 固定 URL、方法、no-store、body 和 caller-provided Idempotency-Key；
- 提供同源 data export download URL，不读取对象存储地址；
- 不保存状态、不弹提示、不导航、不生成展示文案。

该 facade 组合进现有 `HTTP招聘数据源`。页面与操作层不得自行拼 `/api/v1` 路径。

### 5.2 单一内存 owner

新增 `src/状态/后端/P8控制面操作.ts`，并在 `后端状态` 增加独立 P8 snapshot：

```ts
interface P8资源快照<T> {
  phase: 'idle' | 'loading' | 'success' | 'error';
  refreshing: boolean;
  data: T | null;
  error: string | null;
  generation: number;
}

interface P8控制面状态 {
  credentials: P8资源快照<P8Credential[]>;
  sessions: P8资源快照<P8Session[]>;
  dataExport: P8资源快照<P8DataExport>;
}
```

反馈和举报只返回 receipt，不建立全局工单列表。换绑、revoke-others、注销、反馈和举报的 pending intent 放在操作层私有 Map/ref，不进 reducer、不进页面状态，也不进入普通资料缓存。

P8 账号资源以 `subject_id + session generation` 为隔离边界，不按 candidate/recruiter 重复保存；同一主体切角色可以复用已确认快照。上下文举报额外受当前 target scope 与页面可见代际保护。

### 5.3 导出恢复句柄

后端没有“列出我的导出”或“读取当前 active export”接口。为了在 create 响应丢失、页面刷新或浏览器重开后恢复，前端使用 subject-scoped `localStorage` 句柄。每个 subject 使用独立 namespaced key，不把多个账号写进同一条可被整体覆盖的记录：

```ts
interface P8导出恢复句柄 {
  subjectId: string;
  createKey: string;
  exportId: string | null;
}
```

纪律：

- POST 前先原子保存 `subjectId + createKey + exportId:null`；响应后补 `exportId`。
- `exportId=null` 时只能用同 createKey 重放创建；有 ID 时只 GET 状态。
- 句柄不保存 ZIP、手机号、credential、Session、举报内容、错误正文或对象存储坐标。
- 普通 logout/401 清 P8 内存与在飞操作，但保留按 subject 隔离的导出句柄，使同一账号重新登录后可以恢复；其他账号不得读取或覆盖该主体状态。
- 202 注销、export 404/expired、用户明确重新生成已失效任务时清当前 subject 句柄。
- 存储解析严格失败时丢弃该条，绝不因此猜测或创建第二个导出。

若导出由另一设备创建、本浏览器没有句柄，新的 create 只能得到 `export_in_progress`，现有合同无法发现其 ID。前端显示“已有导出正在生成或等待下载，请稍后重试”，不伪造进度或请求新增 API；这是 P8 首版的明确跨设备限制。

### 5.4 页面边界

| 页面/组件 | Backend 变化 | 视觉边界 |
|---|---|---|
| `设置.tsx` | masked phone 按需读取；logout 不变 | 行结构不变，失败显示中性占位 |
| `企业设置.tsx` | 账号安全入口与 logout 不变 | 不新增账号字段 |
| `账号安全.tsx` | credential、Session、换绑、revoke-others、导出、注销 | 保留现有卡与弹层，仅加导出行 |
| `反馈.tsx` | 普通反馈真实提交；举报分类引导上下文 | 分类片、输入区和成功页不变 |
| `举报层.tsx` | 接收闭合 target 并真实提交 | 原因、屏蔽和按钮结构不变 |
| Backend 职位详情 | 新增真实举报状态与抽屉项，传 `{type:'job',ref:jobId}`；只有成功解码的权威 CandidateJob 快照中的 `job_id`（不是 `useParams` 路由参数）存在时才显示既有“⋯”，不依赖 P4 推荐坐标；无成功快照/加载/失败/404 时隐藏 | 复用既有“⋯”、抽屉项和举报层样式；只新增“举报这个职位”一项 |
| Backend P7 真人会话 | 把装饰性“⋯”变为键盘可访问入口，传 `{type:'conversation',ref:conversationId}` | 保留同一 class、字符与几何，不换未重置样式的原生按钮 |
| Backend 直聊 | 隐藏无权威 target 的举报入口 | 只移除 Backend 的无效入口；Mock 保持原样 |

## 6. Wire 与领域合同

### 6.1 账号安全

```ts
interface P8Credential {
  credentialId: string;
  provider: 'phone_otp' | 'wechat' | 'email_otp';
  display: string;
  verifiedAt: string;
}

interface P8Session {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

interface P8ReplacementAttempt {
  attemptId: string;
  nextAction: {
    type: 'enter_code';
    expiresAt: string | null;
    retryAfterSeconds: number | null;
  };
}

interface P8ReplacementResult {
  credential: P8Credential;
  revokedSessions: number;
  unchanged: boolean;
}
```

Credential 与 Session 列表拒绝 duplicate ID。Session 列表必须恰好有一个 `current=true`；零个或多个 current 均视为合同错误，不能自行选择第一行。手机号展示选择 active credential 列表中唯一 `provider=phone_otp` 的行；缺席显示“未绑定”，重复视为合同错误。设置页和账号安全页只显示服务端 `display`，不对掩码二次加工。

换绑 UI 仍输入中国大陆 11 位号码；facade 按本产品现有手机号规则构造 `+86` E.164 请求。complete proof 复用产品全局 `短信验证码位数=4` 规则；最终 OpenAPI 的 6 位示例不是 schema 约束，后端 `AGXP_MOCK_OTP_CODE` 与 P8 集成测试均以 4 位 proof 为准。`LinkNextAction` 只要求 `type`，时间窗与重发冷却字段缺席时领域层映射为 `null`，页面不得编造倒计时。

### 6.2 数据导出与注销

```ts
interface P8DataExport {
  exportId: string;
  status: 'queued' | 'running' | 'ready' | 'failed' | 'expired';
  createdAt: string;
  expiresAt: string | null;
  downloadReady: boolean;
}

interface P8AccountDeletion {
  deletionId: string;
  status: 'deletion_pending' | 'retention' | 'deleted';
  retentionUntil: string;
}
```

只有 `status=ready && downloadReady=true` 才启用下载。其他组合即使携带 `expiresAt` 也不推断可下载；前端展示服务端 status，不用本地计时把 ready 改写成 expired。GET 返回 404 时才清句柄并显示已失效。

注销成功响应只用于确认 freeze 已受理；前端不轮询 deletion status，也不把 `retention` 或 `deleted` 冒充同步物理清理完成。

### 6.3 反馈与举报

```ts
type P8FeedbackCategory = 'bug' | 'suggestion' | 'other';
type P8ReportReason =
  | 'false_information'
  | 'salary_misrepresentation'
  | 'harassment'
  | 'other';

type P8ReportTarget =
  | { type: 'job'; ref: string }
  | { type: 'match_case'; ref: string }
  | { type: 'conversation'; ref: string };

interface P8FeedbackReceipt {
  ticketId: string;
  status: 'received' | 'reviewing' | 'resolved' | 'dismissed';
}

interface P8ReportReceipt extends P8FeedbackReceipt {
  blockStatus: 'applied' | 'not_requested';
}
```

页面映射闭合为：

| UI | Wire |
|---|---|
| 功能异常 | `bug` |
| 体验建议 | `suggestion` |
| 其他 | `other` |
| 虚假信息 | `false_information` |
| 薪资不实 | `salary_misrepresentation` |
| 骚扰 | `harassment` |
| 其他 | `other` |

反馈 details trim 后按 Unicode code point 校验 5–500。举报层不新增正文输入，因此首版省略 optional details。展示名、公司名和屏蔽名称都只留在组件展示属性中，不能进入 data source request。

## 7. 用户流程

### 7.1 账号安全读取

进入账号安全页时并行读取 credentials 与 sessions，两块独立结算：

- 无成功快照时保留页面外壳，相关值显示中性占位，按钮禁用；
- 已有成功快照刷新时保留旧内容，只设置轻量刷新态；
- credential 失败不清 Session，Session 失败不回退硬编码 credential；
- “当前设备”说明只显示创建时间和失效时间，不出现型号、地点或 IP；
- “退出其他设备”显示 `sessions.filter(!current).length`，不渲染逐设备列表。

候选设置页需要显示手机号时只按需读取 credentials。企业设置页没有手机号行，不额外读取。

### 7.2 手机号换绑

```text
打开现有换绑抽屉
  → 输入 11 位新号
  → 首次提交前铸造 begin key
  → POST begin
  → 保存 attempt_id，进入现有验证码抽屉（4 位）
  → 首次 complete 前铸造 complete key
  → POST complete
  → 成功后权威重读 credentials + sessions
  → 关闭抽屉，显示服务端 masked phone
```

- begin/complete 的 `idempotency_in_progress` 或 `operation_outcome_unknown` 都保留原输入、attempt 与 key。
- complete 不乐观更新手机号，不用用户输入自行生成最终展示掩码。
- replacement conflict、验证码错误或过期使用最终公开错误合同的固定文案并允许用户回到可修改步骤；换绑 complete 不声明 `credential_already_bound`，前端不得自行增加该分支。
- 成功回执的 `revoked_sessions` 可用于轻提示；列表仍以随后 GET 为权威。
- 当前 Session 按合同必须保留；任何 401 仍走统一账号清理，不能解释为“换绑成功”。

### 7.3 退出其他设备

- 无其他 Session 时按钮禁用或按原视觉显示“没有其他登录”。
- 点击时生成 pending intent 与 key，进行中禁用重复点击。
- 成功只使用 `revoked_sessions` 回执显示提示，并权威重读 Session。
- 未知或进行中使用同 key 重试；不把第二次返回 0 冒充第一次真实结果。
- 操作不影响当前 Session，不清账号状态，不影响代理后台任务。

### 7.4 数据导出

账号安全页在注销按钮之前新增“数据”同款卡，唯一一行为“导出我的数据”。点击打开复用现有弹层：

```text
无恢复句柄
  → 先持久化 create key
  → POST create
  → 保存 export_id
  → queued/running：显示生成中并轮询
  → ready：显示可下载与过期时间
  → 同源 download

有 key 无 export_id
  → 用同 key 重放 POST create

有 export_id
  → GET status
```

- 关闭弹层或离开账号页只停止前端轮询，服务端任务继续。
- 弹层或账号页重新可见时立即 GET；仍为 queued/running 时依次等待 2、4、8 秒，之后以 10 秒为上限继续轮询。状态变化或重新可见时重置退避；不得重叠请求或常驻后台计时器。
- failed 提供“重新生成”；expired/404 清句柄后回到可创建态。
- ready 下载使用同源 URL 和浏览器下载能力，让响应流式落盘；ZIP 不进入 React state、localStorage 或对象 URL 池。
- 下载前先 GET 确认 `ready + downloadReady`。下载与过期竞态由同源 endpoint 的 404 诚实呈现，不把错误 JSON 当 ZIP 成功。

### 7.5 账号注销

保持“注销说明 → 最终确认”两层：

- 导出 queued/running 时仍允许进入说明层；最终 POST 返回 `export_in_progress` 后留在弹层，提示等待导出完成。
- ready 未下载时，说明层增加“注销后将无法下载”的文本和同款先下载入口，但用户仍可继续。
- 最终确认首次提交前生成并保存 deletion key，进行中锁定执行键。
- 202 后清 P4–P8 快照、对象 URL、轮询、WebSocket、待定意图、当前 subject 导出句柄和本地账号资料，然后 replace 到登录页。
- 未知结果最多自动重试两次，始终使用同 key/body；有 `Retry-After` 就服从，没有则分别等待 1 秒、2 秒。仍无法确认时停止自动请求，保留现有弹层并提供“重试”。
- 未知结果之后若 Session 变成 401，按统一账号失效流程进入登录页，但不额外宣称删除 workflow 已完成。
- 绝不在 POST 失败时只做本地 logout 冒充注销成功。

### 7.6 普通反馈与无目标举报

普通分类映射后提交真实 feedback：

- 提交时捕获 trim 后分类与正文，生成 key 并冻结本次 intent；
- 成功页显示真实 ticket ID；
- 成功文案保留现有视觉，改为“我们会尽快核查”，不承诺 24 小时；
- 未知结果保留表单，用同 key 重试，不生成第二张工单。

用户选择“举报虚假岗位”或“举报骚扰行为”时保留现有分类与输入视觉，但提交不调用 feedback 或 report。现有弹层说明必须从具体岗位、在谈或真人会话的上下文入口举报；不得把自由文本、显示名或本地代谈编号伪装成 report target。

### 7.7 上下文举报

- Backend 岗位详情传 `{ type:'job', ref: 权威岗位 ID }`。
- Backend P7 真人会话传 `{ type:'conversation', ref: conversationId }`。
- 当前 MatchCase 页面没有举报入口，P8 不新增按钮；后端 union 只为已有或后续已批准入口保留。
- Backend 直聊没有权威对象，隐藏举报入口；Mock 直聊保持原型行为。
- 举报层打开时捕获 immutable target；提交期间 target、原因和 also-block 不可变。
- 成功只相信 `block_status`。`applied` 后在当前角色具备 P3 隐私读取能力时刷新隐私，并使来源页的权威业务 scope 失效重读；不派发本地名称级“拉黑”，也不预设举报对象一定会从当前页消失。
- `block_unavailable` 保持举报层打开，提示取消勾选；用户取消后构成新请求，使用新 key。
- `report_target_not_found` 关闭已失效举报层并刷新来源页面，不区分缺失、越权或已不可见。
- 未知结果保持弹层和原 key；限流或服务错误使用现有轻提示，不显示伪造工单号。

## 8. 状态、并发与清理

### 8.1 读取纪律

- credentials、sessions、data export 各自 single-flight。
- force refresh 提升 scope generation，使旧在飞读取整包过时。
- 已成功资源刷新时保持旧 data，不降级为空。
- 所有 GET 显式 no-store。
- 页面卸载使 UI scope 不可见；迟到失败不弹全局提示，迟到成功只有在 subject/session fence 仍成立时才能更新共享账号快照。

### 8.2 写意图纪律

- key 由 `crypto.randomUUID()` 铸造，满足后端可见 ASCII 长度合同。
- pending intent 保存 key、不可变请求、subject、session generation 和 scope generation。
- 同一用户动作进行中时重复点击只加入同一 Promise 或禁用，不铸造第二个 key。
- `idempotency_in_progress` 与 `operation_outcome_unknown` 只复用原 key/body。
- 用户明确改变语义才终结旧 intent 并产生新 key；举报取消 also-block 是典型例子。
- `idempotency_conflict` 视为终局合同/客户端错误，不自动换 key 掩盖。

### 8.3 账号与模式清理

普通 logout、401、换账号和 provider unmount：

- 提升 session generation；
- 清 credentials/sessions/export 内存快照；
- 清换绑、revoke、注销、反馈和举报 pending intents；
- 停导出轮询和 P7 WebSocket；
- 撤销仍持有的 PDF/object URLs；
- 不把任何 Backend 数据写入 Mock reducer。

subject-scoped export handle 只作为无授权能力的恢复坐标保留；后续登录主体不匹配时不可读取。注销 202 与 export 失效会删除当前 subject handle。

### 8.4 错误语义

- 401：统一清账号状态并进入既有登录恢复路径。
- 400：保留用户可修改输入；合同解码错误显示通用后端合同错误，不猜默认值。
- 403 invalid_origin：固定安全错误，不重试。
- 404 export：清句柄；404 report target：关闭失效入口并刷新来源。
- 409 export_in_progress：注销时阻塞；create 时说明已有 active export，但无本地句柄时不猜 ID。
- 409 block_unavailable：不创建半份举报，不自动降级。
- 409 replacement/idempotency conflict：终结自动重试，保留 UI 供用户明确重新开始。
- 429：保持输入并显示固定限流提示；P8 合规 429 不声明 `Retry-After`，不得伪造倒计时或自动重试。
- 503 unknown/in-progress：同 key、同请求重试；普通 downstream unavailable 可让用户重试，但不得伪造成功。

## 9. 严格解码

所有 P8 JSON 使用闭合对象校验：

- 拒绝 missing/unknown key、unknown enum、trailing JSON、重复 ID 与跨分支字段；
- 时间只接受合法 RFC3339；不猜秒/毫秒；
- 计数必须是安全非负整数；
- opaque ID 必须满足最终 OpenAPI 的精确 pattern/minLength；其中 data export 为 `^exp_[0-9a-f]{32}$`、account deletion 为 `^del_[0-9a-f]{32}$`，session、credential、attempt 与 report target ref 按 `minLength: 1`；合规 `ticket_id` 只声明 `type: string`，前端不得自行声称后端发布了更严格 pattern/minLength；
- envelope 必须同时具有 closed `result` 与 `meta`；
- credential provider 只接受最终合同枚举；
- Session 必须恰有一个 current；
- replacement next action 首版只接受 `enter_code`；
- feedback/report status 和 block status 不映射未知未来值；
- data export 只有 `ready + download_ready=true` 可下载；
- download 响应不经过 JSON decoder，不把 headers 或字节写入状态。

最终实现 Plan 必须从发布基线 P8 OpenAPI 重抄精确错误 union、response status、body/no-body 语义与每个 `Retry-After`；本节的通用规则不能替代逐端点契约测试。

## 10. 文件边界

| 责任 | 文件 |
|---|---|
| Wire DTO 与严格 facade | `src/数据/BFF契约.ts`、新增 `src/数据/招聘数据源/P8控制面.ts`、`src/数据/HTTP招聘数据源.ts` 及测试 |
| P8 runtime owner | 新增 `src/状态/后端/P8控制面操作.ts`、`src/状态/后端/类型.ts`、`src/状态/应用状态.tsx` 及测试 |
| 导出恢复句柄 | 新增 `src/数据/P8导出恢复.ts` 及测试 |
| 账号 UI | `src/屏幕/账号安全.tsx`、`src/屏幕/设置.tsx`、`src/屏幕/企业设置.tsx` 及测试 |
| 普通反馈 | `src/屏幕/反馈.tsx` 及测试 |
| 上下文举报 | `src/组件/举报层.tsx`、Backend 职位详情、Backend P7 真人会话、Backend 直聊入口及测试 |
| 错误文案 | `src/数据/HTTP客户端.ts` 或现有固定错误映射落点及测试 |
| 浏览器验收 | `e2e/数据源模式.spec.ts`、视觉回归现有采集入口、`docs/DEV_LOG.md` |

不为 P8 修改页面 CSS，除非新增导出行无法完全复用现有 class；任何 CSS 变化必须在实施 Task 中逐条解释并通过前后截图比较。

## 11. 测试与验收

### 11.1 契约测试

- credential/session/replacement/export/deletion/feedback/report 的 valid fixture；
- missing/extra key、unknown enum、非法 RFC3339、负数/unsafe count、重复 ID；
- Session 零 current、多 current；credential 零 phone、多 phone；
- data export 五种 status 与 downloadReady 组合；
- report target 三分支、feedback/report receipt 差异；
- 固定错误 envelope 与精确 HTTP union。

### 11.2 请求形状测试

- 每条路径、method、body、Origin、Idempotency-Key、no-store；
- replacement begin 只含 E.164 phone，complete 只含 proof；
- revoke-others 与 create export 无伪造 subject；
- deletion body 精确遵循最终 OpenAPI；
- report body 不含 identity、role、organization、display name、evidence 或 block target；
- download URL 同源且只含已严格校验的 export ID。

### 11.3 操作层测试

- 读取 single-flight、refresh generation、旧成功刷新不降级；
- unmount、换主体、401、logout 后迟到响应不提交；
- begin/complete 双 key 不混用，复用全局 4 位验证码规则；
- revoke-others lost response 同 key 重放真实 count；
- export create key 先落盘、create replay、ID 恢复、轮询不重叠、隐藏停止、重新可见恢复；
- export 404/expired/deletion 清句柄，普通 logout 后同 subject 可恢复；
- deletion unknown 自动重试、持久未知手动重试、export_in_progress 不登出；
- feedback/report immutable intent、unknown 同 key、改变 also-block 新 key；
- block applied 只由 receipt 触发刷新，不派发本地假成功。

### 11.4 组件测试

- Mock 账号安全、反馈与举报行为保持现有原型；Mock 不调用 P8 source。
- Backend 不显示固定手机号、iPhone、上海、固定工单号或本地注销成功。
- 加载失败保留页面外壳和中性占位；相关动作禁用。
- 设置页显示真实 masked phone 或中性占位。
- 换绑仍使用现有两步抽屉和既有 4 位验证码视觉与规则。
- 导出只新增批准的一行和复用弹层，状态闭合。
- 无目标举报显示引导，不发送 feedback/report。
- Backend job/P7 target 精确，Backend 直聊没有举报入口。
- block_unavailable 保持举报层；真实 ticket ID 进入原成功页。
- 候选和招聘角色共享同主体账号快照，但不同主体不串数据。

### 11.5 浏览器验收

Backend fixture 至少覆盖：

1. 真实 masked phone 与 Session 时间；
2. 退出其他设备并刷新 count；
3. 4 位换绑成功、业务冲突和 unknown 重试；
4. 创建导出、关闭弹层、重新进入恢复、ready 下载；
5. queued/running export 阻塞注销，ready 未下载警示；
6. 注销 202 清状态并进入登录；
7. 普通反馈显示真实 ticket；
8. 无目标举报只引导；
9. 岗位举报与 P7 会话举报；
10. also-block 不可用后取消勾选重提；
11. Backend 直聊无无效举报；
12. 401、换账号和迟到响应不泄漏旧主体状态。

视觉回归以当前前端基线截图为准，允许差异只有：导出行、真实 masked phone/时间/数量、真实导出状态、真实工单号、已批准的合规提示，以及三个明确的 Backend 举报入口校正（职位详情显示既有“⋯”并增加一个抽屉项、P7 真人会话同像素“⋯”变为可访问入口、Backend 直聊隐藏无 target 入口）。换绑继续保持现有 4 位验证码视觉；布局、CSS、弹层尺寸、色彩、字号、间距和操作层级出现其他差异即失败。

真实后端验收固定使用 `release/0.2.5@897468e5221f0078533178a28119bb259dbb676e` 的 BFF、OpenAPI 和 canonical L3 环境。route fixture 通过不能冒充真实后端联调通过。

## 12. 实施前硬门

零上下文 Plan 的 Task 0 必须全部通过：

1. 前端仍从本 Spec 基线可追溯，审计 P8 File Map 漂移并保护 P7 并发/会话清理合同。
2. 执行 `git fetch origin release/0.2.5`，并确认 `origin/release/0.2.5` 仍解析为 `897468e5221f0078533178a28119bb259dbb676e`；如发布分支前移，停止实施并重新校准，不静默追随。
3. 从该 SHA 读取 `apps/recruitment-bff/openapi/mobile-v1.yaml`，确认本 Spec §2.2 的全部公开路径仍共存于同一合同。
4. 精确核对 response status、错误 union、`^exp_[0-9a-f]{32}$`、`^del_[0-9a-f]{32}$`、4 位 OTP、account deletion 的 `{}`、data export create 的 no-body、download headers 与逐端点 `Retry-After`。
5. 从该 SHA 读取 `tests/l3/recruitment-mobile-local-cases.json`，确认 §2.3 的 P8 风险标签仍在 canonical case 中；记录实际 L3 命令与 PASS 证据，不能只引用 route fixture。
6. 确认前端执行工作树不夹带未审查修改；实施只消费单一 release SHA，不分别读取四个历史候选分支。
7. 如上述检查改变本 Spec 的用户行为、错误恢复或文件边界，先修订 Spec 并重新取得批准，再执行后续任务。

## 13. 已知限制与后续证据

- 后端没有设备元数据，前端只能诚实展示 Session 时间与 current/other；未来只有正式设备管理需求和隐私设计通过后才扩展。
- 后端没有 active export discovery。另一设备创建的未过期导出无法在本浏览器恢复；首版只显示 conflict。只有真实跨设备需求证明该限制不可接受时，才新增 owner-scoped current/list API。
- Backend 直聊没有权威 report target，P8 不接；只有独立直聊 owner 与授权合同落地后恢复。
- MatchCase 虽是合法 target 类型，但当前页面没有 PM 批准的举报入口，P8 不新增视觉。
- 举报处理没有 24 小时 SLA，前端不承诺；只有运营责任与可观测 SLA 建立后再恢复具体时限。
- 数据导出只下载 ZIP，不在浏览器预览；只有真实用户研究证明下载不可用时才设计预览或分享能力。

## 14. 设计自检结论

- P8 账号资源与 P4–P7 业务状态分离，所有单元有单一 owner 和闭合接口。
- PM 视觉不变量与获批入口校正不矛盾；除导出行与三个 Backend 举报入口校正外没有页面重构。
- 换绑与登录复用产品全局 4 位 OTP 规则，不因 OpenAPI 非规范性示例另造常量或改变 PM 视觉。
- 导出恢复、注销阻塞和 ready 未下载警示形成闭合流程；未知结果没有本地假成功。
- 普通反馈、无目标举报和上下文举报三者语义分离；浏览器不能发明 target 或 block edge。
- Mock/Backend、subject、session 与 scope 边界明确；退出和注销清理不把旧响应留给新账号。
- 后端已冻结为单一 `release/0.2.5` SHA；Task 0 会阻止静默跟随分支漂移或回退到候选合同。
- 本设计没有扩大到设备风控、全局 identity 删除、管理后台、通用工作流或视觉改版。
