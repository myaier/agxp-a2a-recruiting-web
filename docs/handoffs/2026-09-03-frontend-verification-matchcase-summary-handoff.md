# 前端 Handoff：候选实名接入与 MatchCase 精确统计

> 本文可以直接发送给另一台机器上的前端 Coding Agent。接收者不需要此前聊天、测试账号、测试材料、浏览器会话、本机路径或其它 Handoff。开始前必须 fetch 最新主干，并拿到后端已合并的 OpenAPI 与精确 commit；文中的路径均为仓库相对路径。

## 1. 目标、依赖与实施拆分

目标仓库：前端招聘应用。

本 Handoff 包含两个下游工作包，应分别写 Plan、建分支和评审：

1. `FE-IV-01`：接入候选实名认证状态、提交、取消与拒绝后重提；
2. `FE-MC-01`：接入双端 MatchCase summary，替换“我的”页 `N/N+` 过渡统计。

两个 Plan 可在各自后端合同发布后并行实施。不要为了等其中一项阻塞另一项。

后端依赖合同：

```text
GET  /api/v1/me/identity-verification
POST /api/v1/me/identity-verification-requests
GET  /api/v1/me/identity-verification-requests
POST /api/v1/me/identity-verification-requests/{request_id}/cancel

GET /api/v1/me/match-cases/summary
GET /api/v1/recruiter/match-cases/summary
```

只有后端 OpenAPI、handler/client 与合同测试已合并，且实现 commit 已提供时，才能实现对应 Plan。禁止按本文手写一个与最终 OpenAPI 不一致的猜测合同。

## 2. 与其它前端任务的唯一边界

### 2.1 不重做正在执行的纯前端数据真实性任务

`docs/handoffs/2026-09-03-frontend-data-truthfulness-handoff.md` 正在实施以下过渡行为：

- Backend 模式清除“我的”页 Mock 统计；
- 用当前已加载的 MatchCase page 诚实显示 `N / N+ / 0 / —`；
- 候选设置页停止把 phone OTP 或简历姓名伪装为“已实名”；
- contact-events 和 remote workplace 等其它纯前端接线。

本 Handoff 必须以该分支合并后的实现为起点：

- `FE-MC-01` 只用 summary 的精确值替换 `N/N+`，不重写 session fence、Mock 清理、contact-events 或现有 P5 列表。
- `FE-IV-01` 只在真实后端合同上线后增加可操作实名流程，不恢复任何假“已认证”状态。

### 2.2 其它明确非目标

- JD 上传入口及其设计/实现；
- CSS、颜色、间距、视觉重画、组件体系和空态视觉设计；
- 简历“至今”的解析修复；
- Agent runtime、tool schema 或 hosted-agent failure UI；
- recruiter 个人认证；
- 改变匿名发现或 MatchCase 身份披露规则。

## 3. 通用前端约束

1. 页面不得直接 `fetch`；通过现有招聘 data source、HTTP 实现、operation/state 层调用。
2. 新 decoder 保持严格闭合；未知字段、坏 enum、坏 timestamp 和非法数字 fail closed。
3. 复用 session generation、subject/role scope fence、single-flight、AbortSignal 与 401 清理。旧账号/旧角色 response 不得写入当前状态。
4. Backend 请求失败不得回退 Mock、localStorage 或当前分页长度；Mock 模式保持现有演示行为。
5. mutation 使用后端要求的 idempotency key、revision/If-Match 或等价 CAS，不自行发明重试语义。
6. 上传文件不进入 Redux/devtools/localStorage/analytics；错误 UI 不显示对象 key、reviewer note 或原始 server body。
7. 只做数据接线和最小既有组件组合；视觉方案留给 PM/Claude Design。

## 4. FE-IV-01：候选实名认证接入

### 4.1 数据模型与建议代码范围

按仓库现有命名约定增加或扩展：

```text
src/数据/招聘数据源/候选实名.ts
src/数据/HTTP招聘数据源.ts
src/状态/后端/类型.ts
src/状态/后端/候选实名操作.ts
src/屏幕/设置.tsx
src/屏幕/候选实名认证.tsx
src/路由.tsx
```

实际文件名可遵循当前中文模块结构，但必须保持一个 contract decoder、一个 HTTP implementation 和一个受 session fence 保护的 operation owner。

前端闭合状态：

```text
unverified
pending
verified
rejected
```

拒绝原因只接受：

```text
document_unreadable
identity_mismatch
document_expired
unsupported_document
other
```

不得从 `phone_otp` credential、在线简历姓名、recruiter profile 或本地提交表单推导 verified。

### 4.2 页面行为

- 进入候选设置时加载 summary；加载中与失败时使用中性状态，不显示“已认证”。
- `unverified`：设置行进入提交页。
- `pending`：展示已提交状态和 submitted time；允许按合同取消，不允许创建第二个 pending request。
- `verified`：只展示后端返回的 `verified_name` 与 verified 状态；不提供重复提交，不自动改在线简历。
- `rejected`：把闭合 reason 映射为 owner-safe 文案，并允许重新提交；不展示 reviewer 身份或自由文本。
- 提交页只收集 legal name、document type 和允许的证据文件。客户端做 MIME/数量/大小的早期提示，但以后端校验为准。
- submit/cancel 成功后以 mutation response 或立即 revalidate 的权威状态更新；刷新页面结果一致。
- 409/revision conflict 时重新读取 summary，不把本地乐观状态强写为成功。

本任务不规定新视觉。优先复用已有设置行、表单、文件选择、loading/error 和确认组件；不要顺手改整个设置页布局。

### 4.3 隐私与可访问性

- 文件名可以在当前页面短暂展示，但不持久化，不发送 analytics。
- 浏览器 history、toast 和错误详情不得包含证件内容、对象 key 或原始 multipart body。
- 文件控件有 label、允许键盘操作；提交/取消中的 disabled 与 busy 状态可读。
- 离开页面或 session 失效时清除选中文件引用与 owner state。

### 4.4 必测场景

- 仅有 phone OTP、summary=unverified：绝不显示已认证。
- 合法 PDF、单图、双图分别按合同提交；非法扩展名/MIME/数量在客户端提示且服务器错误仍可安全呈现。
- pending 禁止重复提交；cancel 成功、冲突、网络失败分别正确处理。
- rejected reason 五个 enum 全覆盖，未知 enum decoder fail closed。
- verified 只显示服务端 verified name，不修改在线简历。
- 登出、401、candidate 切 recruiter、subject 切换期间旧 response 和旧文件被丢弃。
- Mock 模式不误调用 Backend，现有设置页其它 credential/session 功能不回归。

## 5. FE-MC-01：双端精确统计接入

### 5.1 合同与映射

两个 summary endpoint 返回同形闭合结果：

```ts
type MatchCaseSummary = {
  open_total: number
  open_anonymous_screening_total: number
  open_needs_action_total: number
  ended_total: number
  completed_total: number
}
```

所有数字必须是 finite、safe、non-negative integer。不要接受数字字符串、小数、负数、NaN/Infinity 或额外字段。

页面映射：

| 页面 | 指标 | 权威字段 |
| --- | --- | --- |
| 候选“我的” | 在谈 | `open_total` |
| 候选“我的” | 初筛中 | `open_anonymous_screening_total` |
| 候选“我的” | 待你拍 | `open_needs_action_total` |
| 候选“我的” | 已归档 | `ended_total + completed_total` |
| 招聘方“我的” | 在谈 | `open_total` |
| 招聘方“我的” | 待拍板 | `open_needs_action_total` |
| 招聘方“我的” | 意向达成 | `completed_total` |

招聘方“在招岗位”继续读取 Job 权威列表/合同，不改为 MatchCase summary。AI 代理卡的“正在跟进 N”复用当前角色的 `open_total`。

### 5.2 建议代码范围

```text
src/数据/招聘数据源/MatchCase.ts
src/数据/HTTP招聘数据源.ts
src/状态/后端/MatchCase操作.ts
src/屏幕/我的.tsx
src/屏幕/企业我的.tsx
```

如当前状态域已有 summary/query resource convention，应按该 convention 扩展，不要在两个页面各写一次 fetch 或统计逻辑。

### 5.3 加载、失败与刷新语义

- candidate/recruiter 分别使用独立 role/subject scope key；换角色不能复用另一端 summary。
- 初次加载与失败显示 `—` 或现有中性 placeholder，绝不暂时显示 Mock 或当前 page 长度。
- 成功响应即显示精确十进制数字，不再加 `+`。
- 数字为 0 时明确显示 `0`，不能与未加载 `—` 混淆。
- 页面重新聚焦、从 MatchCase mutation 返回或手动 refresh 时，按现有 stale/revalidation convention 刷新 summary；不要为了实时性轮询。
- summary 失败不应清空已经成功加载的 P5 list，也不能阻塞进入在谈/历史页；统计资源错误与列表资源错误分离。
- 统计卡导航继续进入现有 role 对应的 open/history 页面；不要用统计值合成卡片列表。
- 后端没有任何相关 case 时显示全 0，不显示 `N+`。

### 5.4 必测场景

- 空账号：所有 MatchCase 指标为 0，无演示数字。
- 服务端返回 51+ open，而列表首屏 50：页面显示精确 summary，不显示 `50+` 或 50。
- 混合 open/stage/ended/completed：所有产品标签按表映射。
- candidate/recruiter 的 `open_needs_action_total` 不同：换角色后显示各自数字。
- loading、timeout、500、坏 schema：显示中性状态，不回退旧分页计数；重试成功后更新。
- 先登录 A 再登录 B、candidate/recruiter 快速切换：迟到 response 不污染当前页面。
- AI 代理卡与“在谈”使用同一个 `open_total`。
- Mock 模式保持原型数据；现有 MatchCase list/history strict decoder 不因新 endpoint 放宽。

## 6. 实施与发布顺序

1. 分别记录 `FE-IV-01`、`FE-MC-01` 对应的后端 release commit 和 OpenAPI version。
2. 先合并正在执行的纯前端数据真实性分支，解决冲突后保留其 Mock 清理与诚实过渡状态。
3. 后端 verification 发布后实现 `FE-IV-01`；后端 summary 发布后实现 `FE-MC-01`。两项互不等待。
4. Backend mode 完成自动测试和浏览器 dogfood；Mock mode 做回归。
5. summary E2E 通过后删除 `N+` 过渡计算；不要提前删除失败/未加载的中性显示。

## 7. 验证命令与交付物

使用仓库 package scripts 运行对应测试，并至少完成：

```text
npm test -- <新增或修改的测试文件>
npm run typecheck
npm run lint
npm run build
```

若仓库实际 package manager/script 名称不同，使用 lockfile 与 `package.json` 中的 canonical 命令，不新增重复脚本。

每个 Plan 的交付说明必须包含：

- 前端与后端精确基线 commit；
- 新增 decoder/data source/operation/route 与页面改动；
- 自动测试命令及结果；
- Backend local dogfood 的 network/status/刷新证据；
- session/role/subject 切换、Mock mode 与隐私回归结果；
- 没有重做纯前端数据真实性、JD 上传、UI 设计或 hosted failure UI 的说明。

## 8. 完成定义

- 候选设置页的实名认证完全由新 owner API 驱动，提交、pending、取消、拒绝重提、verified 与刷新回读闭环，无任何假认证。
- 候选和招聘方“我的”页显示跨页精确 MatchCase 数字；loading/error 为中性状态，0 与未加载可区分，`N+` 已删除。
- AI 代理跟进数字与当前角色 `open_total` 一致；招聘方在招岗位仍来自 Job 合同。
- 两项都通过 strict decoder、会话 fence、角色切换、失败恢复、Mock mode、typecheck、lint、build 和 Backend dogfood 验证。
