# 候选实名认证前端接入设计

**日期：** 2026-09-04  
**工作包：** FE-IV-01  
**目标仓库：** `agxp-a2a-recruiting-web`  
**前端设计基线：** `b4d28ac28d750fbe8cbbe95bb2624bd72e563d27`  
**后端发布基线：** `agxp-monorepo release/0.2.5@21e34ff04`  
**BE-IV-01 最终合同校准：** `617d1fa60`

## 1. 背景与目标

Backend 模式的候选设置页已经停止把 phone OTP 或简历姓名伪装成“已认证”，当前诚实显示中性 `—`。后端现已发布候选 product subject 独有的异步实名认证合同，FE-IV-01 的目标是把该占位升级为完整的 owner 流程：

```text
读取权威状态 → 提交材料 → pending → 刷新审核结果
                         ↘ 取消 → unverified
                         ↘ rejected → 重新提交
                         ↘ verified → 只读展示 verified_name
```

完成后，候选设置页和独立实名页面都只以新 owner API 为真相源。手机号凭证、在线简历姓名、recruiter profile 和本地表单状态都不得推导认证结果。

本任务是架构型改动：它新增招聘 data source facade、受会话栅栏保护的 operation owner、Backend 状态切片、候选路由和材料上传页面。设计批准后应单独编写实施 Plan，不能把它当成设置页的一处条件渲染直接开工。

## 2. 范围与设计原则

### 2.1 本次范围

- 读取候选实名认证 summary；
- 设置页展示权威状态和独立页面入口；
- 提交 legal name、document type 和一组合法材料；
- 展示 pending 状态、提交时间并允许取消；
- 展示闭合拒绝原因并允许重新提交；
- 展示服务端发布的 `verified_name`；
- 处理严格解码、并发、幂等、CAS、会话切换和安全错误文案；
- 保持 Mock 原型行为不变。

### 2.2 最小方案为什么足够

采用一个独立路由和一个四状态页面，不建立多步骤向导、历史记录页或通用上传框架。summary 已包含当前页面完成提交、取消、拒绝重提和 verified 展示所需的全部字段，因此前端不调用后端已经发布但当前产品不需要的申请历史列表 endpoint。

这套边界复用现有 `HTTP招聘数据源 → 后端 operation → 应用状态 → 屏幕` 链路，新增复杂度只服务于当前真实合同：

- 独立页面隔离敏感文件与设置页其它功能；
- operation owner 是 session/subject/role fence 和幂等恢复所必需；
- 全局只保存 owner-safe summary，使设置页与独立页面共享同一真相；
- 姓名草稿和 `File[]` 留在页面，避免敏感输入进入持久化状态。

### 2.3 明确非目标

- 不接入 `GET /api/v1/me/identity-verification-requests`，不展示申请历史；
- 不实现自动 OCR、人脸识别、第三方 KYC 或 reviewer UI；
- 不把实名姓名回写在线简历，也不从简历预填实名表单；
- 不把 candidate verification 投影到 recruiter profile；
- 不改变匿名发现、MatchCase 身份披露或真人会话；
- 不修改 FE-MC-01 的 MatchCase summary、我的页统计或 AI 代理数字；
- 不重画设置页、建设新 CSS 体系或抽象通用文件上传框架；
- 不给 Backend 合同增加客户端猜测字段、状态或文件大小配置；
- 不改变 Mock 数据结构或 Mock 演示的“已认证”交互。

历史页只有在产品出现“用户需要查看多次审核记录”的现实用例后再考虑。动态文件大小提示只有在后端通过公开合同发布限制后再增加；当前部署私有配置不是可硬编码的前端合同。

## 3. 已选方案与备选方案

### 3.1 采用：单一路由、单页状态机

新增候选设置下的独立实名认证路由。设置页只展示权威摘要并导航；独立页面根据 `unverified | pending | verified | rejected` 切换内容。表单、文件、busy 和本地错误属于页面，summary 属于 Backend 状态 owner。

这是当前需求的最小完整闭环，刷新回读、取消确认、文件清理和错误恢复都有明确所有者。

### 3.2 未采用：设置页内展开或弹层

该方案少一个路由，但会让设置页同时承担 credentials、隐私、退出、敏感文件、取消确认和 mutation 恢复，组件生命周期也难以保证离屏清除文件。节省的路由代码不足以抵偿耦合。

### 3.3 未采用：多步骤向导

向导可以增加材料指导，但需要步骤恢复、跨步返回、草稿保存和更多视觉决策。当前只有三个字段组，没有证据证明需要该复杂度。

## 4. 后端合同的前端投影

### 4.1 使用的公开 endpoint

```text
GET  /api/v1/me/identity-verification
POST /api/v1/me/identity-verification-requests
POST /api/v1/me/identity-verification-requests/{request_id}/cancel
```

不调用：

```text
GET /api/v1/me/identity-verification-requests
```

### 4.2 前端闭合类型

```ts
type 候选实名状态 = 'unverified' | 'pending' | 'verified' | 'rejected';
type 候选实名申请状态 = 'pending' | 'verified' | 'rejected' | 'cancelled';
type 候选实名拒绝原因 =
  | 'document_unreadable'
  | 'identity_mismatch'
  | 'document_expired'
  | 'unsupported_document'
  | 'other';
type 候选实名证件类型 =
  | 'national_id'
  | 'passport'
  | 'other_government_id';

interface 候选实名申请 {
  requestId: string;
  status: 候选实名申请状态;
  revision: number;
  submittedAt: string;
  rejectionReason: 候选实名拒绝原因 | null;
}

interface 候选实名摘要 {
  status: 候选实名状态;
  verifiedName: string | null;
  currentRequest: 候选实名申请 | null;
  revision: number;
  updatedAt: string;
}
```

wire 的 snake_case 只存在于 data source decoder 边界，屏幕和 operation 使用上述页面域命名。

### 4.3 严格解码规则

summary 必须恰有：

```text
status, verified_name, current_request, revision, updated_at
```

request 必须恰有：

```text
request_id, status, revision, submitted_at, rejection_reason
```

decoder 还必须验证：

- 未知字段、缺字段、未知 enum 一律 `invalid_response`；
- `request_id` 为非空字符串；后端 OpenAPI 未发布更窄 grammar，前端不自行发明；
- revision 是正的 JavaScript safe integer；不接受数字字符串、小数或无穷值；
- timestamp 是分量合法的 RFC3339，不能只依赖会归一化坏日期的 `Date.parse`；
- `verified_name` 只有 verified 时为 trim 后非空字符串，且最多 200 code point；
- rejection reason 只有 rejected request 时非空，其他 request 状态必须为 null；
- summary 与 request 满足下列矩阵，不要求二者 revision 相等：

| summary status | verified_name | current_request |
| --- | --- | --- |
| `unverified` | `null` | `null` 或 `status=cancelled` |
| `pending` | `null` | `status=pending` |
| `verified` | 非空 | `status=verified` |
| `rejected` | `null` | `status=rejected` 且带闭合 reason |

取消后的合法 summary 是 `unverified + current_request.cancelled`，不能按旧 handoff 草图误判为合同错误。

## 5. 数据源与 multipart

新增 `src/数据/招聘数据源/候选实名.ts`，包含本域类型、strict decoder 和三个 data source 方法：

```ts
读取候选实名(): Promise<候选实名摘要>;
创建候选实名申请(input, idempotencyKey): Promise<候选实名摘要>;
取消候选实名申请(requestId, revision): Promise<候选实名摘要>;
```

创建申请组装 `FormData`：

1. `metadata`：`application/json` Blob，内容严格只有 trim 后的 `legal_name` 和 `document_type`；
2. 一个或两个同名 `evidence` part，直接附加页面持有的原始 `File`；
3. 通过现有 HTTP 客户端传入稳定 idempotency key；
4. 不手写 multipart `Content-Type`，让浏览器生成 boundary；
5. 不读取、记录、序列化或复制证件 bytes。

取消申请使用：

```text
POST /api/v1/me/identity-verification-requests/{encodeURIComponent(requestId)}/cancel
If-Match: "<summary.revision>"
body: {}
```

`If-Match` 使用 summary 顶层 revision，不使用嵌套 request revision，也不需要保存 response ETag。创建成功是 `202` 且没有 ETag，response body 仍由现有严格信封读取。

## 6. Backend 状态与 operation owner

### 6.1 状态形状

`后端状态` 新增一个候选实名快照：

```ts
interface 候选实名快照 {
  阶段: '未开始' | '进行中' | '成功' | '失败';
  摘要: 候选实名摘要 | null;
  刷新中: boolean;
  错误: string | null;
}
```

初次加载没有成功数据时，loading/error 都只能显示中性状态。已有成功摘要的后台刷新保持 `阶段=成功`、设置 `刷新中=true`，不清空摘要；刷新失败仍保留最后一次权威数据并写入安全错误，独立页同时显示刷新失败和重试入口。只有从未成功过的读取失败才进入 `阶段=失败`。设置页只有在存在成功摘要时才显示具体实名状态，否则显示 `—`。

全局状态不得保存 legal name 草稿、document type 草稿、文件名、`File`、FormData、对象坐标或原始错误 body。

### 6.2 operation 接口

```ts
加载候选实名(force?: boolean): Promise<void>;
提交候选实名(input): Promise<'已提交' | '状态已更新' | '已换代'>;
取消候选实名(): Promise<'已取消' | '状态已更新' | '已换代'>;
重置候选实名提交意图(): void;
```

operation 只允许 Backend、已登录 candidate 调用。每次请求前捕获：

```text
subject_id + last_used_role=candidate + session generation
```

响应成功、失败和 401 在影响状态或页面前都重新检查该 fence。过时响应整包丢弃；只有当前 fence 的 401 才进入现有统一 `清账号状态`。

### 6.3 single-flight、mutation 锁与幂等

- summary GET 使用本域单飞锁；并发设置页和实名页只发一个请求；
- create 和 cancel 分别持有 mutation 锁，重复点击不会产生第二个请求；
- operation 内部为 create 生成 16–128 可见 ASCII 的稳定 key；调用页面不接触 key；
- operation 的待定意图只保存 key，不保存姓名、document type、文件名或 `File`；
- 页面在姓名、证件类型或文件集合发生任何变化时调用 `重置候选实名提交意图`；未编辑表单的失败重试复用原 key，编辑后再提交才铸新 key；
- 页面卸载、成功、session 清理或换角色后删除待定 key；
- 不自动重放 create。

这种最小内存恢复只支持当前页面存活且表单未编辑期间的安全重试，同时保证敏感字段和文件引用仍只归页面所有。离开页面会清文件和 key，因而不承诺跨刷新恢复敏感上传；后端的一次 pending 约束和下一次权威 GET 负责收敛刷新后的不确定结果。

### 6.4 mutation 后收敛

- create `202`：直接提交 response summary，清空待定意图；
- cancel `200`：直接提交 response summary；
- create `version_conflict`：立即强制 GET；若权威状态已变成 pending/verified 等不可提交状态，提交快照并返回 `状态已更新`，否则保留原冲突错误；
- cancel `404` 或 `version_conflict`：立即强制 GET；若原 pending 已改变，提交快照并返回 `状态已更新`，否则保留原错误；
- cancel `operation_outcome_unknown`：不重放 cancel，先强制 GET；若原 pending 已改变则返回 `状态已更新`，仍为原 pending 时保留安全错误并允许用户再次操作；
- create `operation_outcome_unknown` 或没有确定响应的网络失败：保留同一 key 和页面文件，提示使用原材料重试或刷新状态；
- 权威重读失败时不宣称 mutation 成功。

## 7. 页面与交互

### 7.1 设置页

Backend 设置页挂载时触发一次 summary 刷新；它与既有 credentials 读取互不阻塞。实名行始终可进入独立页面，行尾映射为：

| 快照 | 行尾 |
| --- | --- |
| 无成功摘要 | `—` |
| `unverified` | `未认证` |
| `pending` | `审核中` |
| `verified` | `已认证` |
| `rejected` | `未通过` |

Mock 分支逐意图保留现有按钮、`已认证` 和点击提示，不触发路由或 Backend 请求。

### 7.2 独立页面

新增并冻结候选设置路由：

```text
/settings/identity-verification
```

直接进入该路由时，如果没有成功摘要则加载；从设置页进入时复用同一 single-flight/成功快照。Mock、未登录或 recruiter 访问不展示伪状态、不发请求，并安全返回对应设置入口。

页面按 summary 状态渲染：

#### unverified

- 展示简短用途与隐私说明；
- 展示空白证件姓名、证件类型、材料选择；
- `current_request.cancelled` 不作为历史记录展示；
- 表单有效且未提交中时允许提交；
- 请求在飞时禁用姓名、证件类型、文件操作和提交按钮，避免中途改写待定意图。

#### pending

- 展示“审核中”和服务端 `submitted_at`；
- 不展示姓名、document type、文件名或任何内部审核信息；
- 提供“刷新状态”；
- 提供“取消申请”，点击后先进入现有可访问确认层；
- pending 时不渲染第二份提交表单。

#### verified

- 只展示“已认证”和服务端 `verified_name`；
- 不允许重复提交；
- 不修改在线简历。

#### rejected

- 展示一条 owner-safe 拒绝原因；
- 下方提供与 unverified 相同的全新空白表单；
- 不回填上次提交姓名或材料，因为 owner summary 没有发布这些字段。

### 7.3 拒绝原因文案

| reason | 页面文案 |
| --- | --- |
| `document_unreadable` | 证件内容无法清晰识别，请重新上传清楚的材料 |
| `identity_mismatch` | 填写的信息与证件不一致，请核对后重新提交 |
| `document_expired` | 证件已过有效期，请更换有效证件 |
| `unsupported_document` | 暂不支持这类证件，请更换支持的政府签发证件 |
| `other` | 本次认证未通过，请重新提交材料 |

未知 reason 在 decoder 边界失败，页面永远不拼接 reviewer note 或自由文本。

## 8. 表单验证与文件生命周期

### 8.1 姓名与证件类型

- legal name 始终由用户本次手动输入；
- trim 后不能为空；
- 最多 200 Unicode code point，不能用 UTF-16 `string.length` 冒充 code point 数；
- document type 必须是闭合集合中的一个；
- 不读取简历姓名作默认值。

### 8.2 文件集合

客户端接受：

- 恰好一个 PDF；或
- 一张 PNG/JPEG；或
- 两张 PNG/JPEG。

拒绝：

- 零文件或超过两个文件；
- PDF 与任何其它文件混选；
- 两份 PDF；
- 扩展名不在 `.pdf | .png | .jpg | .jpeg`；
- 声明 MIME 不在 `application/pdf | image/png | image/jpeg`；
- 扩展名与声明 MIME 明显矛盾。

客户端检查只提供早期反馈。后端继续对真实 bytes 做嗅探、恶意内容扫描和大小裁决。

当前公开 OpenAPI 没有发布 per-file max。后端默认 10 MiB 但可配置为 1–50 MiB，BFF 的 51 MiB 只是 transport cap；前端不得硬编码任一个值冒充环境业务上限。服务端 `request_too_large` 映射为安全提示。将来只有公开合同发布稳定 limit 后才增加精确客户端大小预检。

### 8.3 文件生命周期

- 文件名只在当前页面短暂显示；
- 文件选择允许键盘操作并有可读 label；
- 用户可以在提交前移除文件；
- 重新选择同一文件有效，原生 input value 在读取后清空；
- 任一表单字段或文件集合变化时重置 operation 持有的待定 key；
- submit 成功、离开页面、role/subject/session 变化时清除所有文件引用，并在页面 cleanup 中重置待定 key；
- history、toast、错误详情、Redux/devtools、localStorage 和 analytics 都不包含文件或文件名。

## 9. 错误与可访问性

### 9.1 错误映射

页面只消费闭合的安全分类：

- `invalid_request_body`：提交内容不完整，请检查后重试；
- `media_invalid`：材料格式或内容无法识别，请更换文件；
- `request_too_large`：材料超过服务端允许的大小；
- `validation_failed`：只映射已知 `legal_name | document_type | evidence` 及闭合 reason；
- `version_conflict`：状态已变化，权威重读后按新状态展示；
- `idempotency_conflict`：本次提交状态冲突，请重新选择材料后重试；
- `identity_verification_unavailable`：实名认证暂时不可用，请稍后再试；
- `operation_outcome_unknown`：提交结果暂未确认，请保留原材料后重试或刷新状态；
- 其它服务、网络或未知错误：请求失败，请稍后再试。

`idempotency_key` 字段错误属于前端实现缺陷，不把内部字段名展示给用户。未知 field path/reason 不透传，统一落安全通用文案。

### 9.2 可访问性

- 所有输入与文件控件都有可见 label；
- 错误与状态更新使用现有可读提示机制；
- submit/cancel/refresh 的 busy 与 disabled 状态可由辅助技术感知；
- 取消确认层有明确标题、后果和取消按钮；
- 不只靠颜色表达 pending、verified 或 rejected；
- 页面返回、重试和文件移除均可用键盘完成。

## 10. 清理与隔离

实名状态和运行时引用必须加入现有统一清理路径：

- 登出；
- 当前会话 401；
- candidate A → candidate B；
- candidate → recruiter；
- 新登录 session generation；
- Provider 卸载。

清理内容包括 summary 快照、GET single-flight、mutation 锁和只含 key 的待定 idempotency intent。过时 401 不得登出新会话。切回 candidate 后重新读取，不复用 recruiter 可见期或旧 generation 的数据。

## 11. 预计文件范围

新增：

```text
src/数据/招聘数据源/候选实名.ts
src/数据/招聘数据源/候选实名.test.ts
src/状态/后端/候选实名操作.ts
src/状态/后端/候选实名操作.test.ts
src/屏幕/候选实名认证.tsx
src/屏幕/候选实名认证.test.tsx
```

窄改：

```text
src/数据/HTTP招聘数据源.ts
src/状态/后端/类型.ts
src/状态/应用状态.tsx
src/状态/后端/会话操作.ts
src/屏幕/设置.tsx
src/屏幕/设置.test.tsx
src/路由/路径表.ts
src/应用.tsx
src/应用.test.tsx
e2e/数据源模式.spec.ts（仅必要的 Backend fixture 与用户路径）
```

优先复用 `我的功能页.module.css`、通用页面外壳、表单条目、轻提示与确认层。只有现有样式确实无法表达文件列表或状态区域时，才允许增加候选页面私有的最小样式；不得借本任务重构共享 CSS。

FE-MC-01 并行分支可能同样机械修改 `HTTP招聘数据源.ts`、`状态/后端/类型.ts` 或 `应用状态.tsx`。本分支不接触任何 MatchCase summary 类型、operation 或页面，集成时只合并两个 facade/state composition，不能用一方覆盖另一方。

## 12. 测试与验收

### 12.1 data source

- 四种 summary 状态与 cancelled 投影；
- 五种拒绝原因；
- unknown/missing/extra keys、坏 enum、坏 timestamp、坏 revision；
- verified name 与 request reason 的非法组合；
- multipart 恰含 metadata 和一至两个 evidence；
- metadata 只有两个键且为 `application/json`；
- create 使用稳定 key，cancel 使用 summary revision 的 quoted If-Match；
- response 信封与错误 union 保持严格。

### 12.2 operation

- candidate Backend guard，Mock/recruiter/未登录零请求；
- GET single-flight 与 force refresh；
- create/cancel 重复点击锁；
- 未编辑表单的失败重试复用 key；姓名、证件类型或文件集合变化及页面卸载会重置 key；
- mutation response 直接提交 summary；
- create 409、cancel 404/409/unknown 的权威重读；
- 当前 401 统一清理，迟到 401 不影响新会话；
- 登出、换账号、切角色期间迟到成功/失败整包丢弃；
- 所有清理入口复位实名状态和运行时引用。

### 12.3 页面与路由

- 设置页 `— / 未认证 / 审核中 / 已认证 / 未通过` 映射；
- Mock 保持原按钮、提示和零实名请求；
- unverified 空白表单；
- pending 禁止重复提交、展示 submitted time、刷新和取消确认；
- verified 只展示服务端 verified name，不修改简历；
- rejected 五种安全文案与空白重提；
- PDF、单图、双图通过，混合/数量/MIME/扩展名错误提前提示；
- server size/media/validation 错误安全呈现；
- submit/cancel busy、键盘访问和离屏文件清理；
- direct route 的 session/role/Mock guard。

### 12.4 验证层级

实施 Plan 至少包含：

```text
npx vitest run <本任务新增和直接相关测试>
npm run typecheck
npm run lint
npm run build
npm test
```

Backend data-source E2E 使用合成姓名和合成材料，证明：

1. 初始 summary 可读；
2. 创建返回 pending；
3. 页面刷新仍从后端读到 pending；
4. 取消后读到 `unverified + cancelled current_request`；
5. session/role/subject 切换不泄漏旧状态；
6. Mock 模式不访问新 endpoint。

verified/rejected 组件矩阵可由严格 fixture 覆盖。真实 reviewer 终审浏览器闭环只有在现有 local 测试环境提供安全 reviewer seed/接口时才作为集成证据；不得为了本前端任务新增 reviewer UI 或手改数据库。

## 13. 完成定义

- Backend 设置页的实名认证行完全由新 summary API 驱动；
- 候选可以提交合法材料、查看 pending、刷新状态、取消、在 rejected 后重提；
- verified 只显示服务端 verified name，且不联动简历或 recruiter；
- 严格 decoder 拒绝所有合同漂移；
- mutation 具备稳定幂等、CAS、冲突重读和 session fence；
- 敏感文件只存在于页面生命周期，不进入全局状态或持久化；
- 初始 loading/error 中性，Backend 失败不回退 Mock；
- Mock 原型行为不变；
- FE-MC-01、MatchCase、UI 重画和历史记录不进入本分支；
- focused tests、typecheck、lint、build、完整单测与可执行的 Backend data-source E2E 通过，无法执行的真实 reviewer 终审明确记录前置而不冒充证据。
