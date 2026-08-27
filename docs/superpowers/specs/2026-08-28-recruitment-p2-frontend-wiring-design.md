# Recruitment P2 前端附件简历接线设计

**日期：** 2026-08-28

**状态：** 设计已获用户批准；本文是 Implementation Plan 的冻结依据

**范围：** `agxp-a2a-recruiting-web` 的候选人附件简历前端接线：PDF 文件库、显式处理授权、创建/替换/删除/下载、解析状态和失败后重试；尽量不改变现有页面效果

**前端设计基线：** `origin/main@96257a2683dfe775eda61b6076a9aab12ded9c9a`

**后端只读契约基线：** `agxp-monorepo` 的 `origin/release/0.2.5@83007f1555514c2b427ba337b64118221f4dd4d2`

## 1. 结论

后端 P2 已完整合入 `release/0.2.5`，浏览器可以通过 BFF 管理候选人自己的最多三份 PDF 附件，并在候选人明确确认处理授权后创建异步解析。前端可以直接开始实现，不再等待后端 P2 admission 或 merge。

前端采用独立“附件简历”领域，沿用现有 `HTTP招聘数据源`、`状态/后端` 操作层和根 Provider。PDF 附件不并入现有结构化在线简历，不新增第二个 Context、状态库、请求框架或页面。`完善资料` 仍是一条上传行；`我的简历` 仍是一张附件卡，只把硬编码演示行替换为真实的 0–3 行，并复用现有确认层、轻提示和滑动行。

本设计冻结的首要产品约束是：接线尽量不改变现有页面效果。Mock 模式继续保留现有演示内容和视觉回归基线；Backend 模式只增加完成真实能力所必需的状态文案、标题右侧小型 `＋`、数据驱动行数和隐藏式左滑动作，不新增页面、进度条、骨架屏、说明卡、视觉体系或动画。

## 2. 目标与成功标准

P2 前端完成后：

1. Backend 候选人登录会水合权威附件库；登出、换账号和换角色会清空，不回退 Mock；
2. 候选人可以创建第一份或第二/第三份 PDF，替换现有文件内容、删除文件、打开真实 PDF；
3. 创建、替换和显式解析只有在当前动作已获得用户确认后才发送 `processing_consent_confirmed=true`；取消确认产生零网络 mutation；
4. 列表严格展示后端返回的最多三份文件和 `not_started | pending | processing | succeeded | failed`；
5. `failed` 的四个闭合 `failure_code` 映射为短状态文案；候选人可以显式重新解析；
6. 只在 `完善资料` 或 `我的简历` 可见、且存在 active parse 时轮询；离页、隐藏、终态、登出和换代都会停止；
7. `完善资料` 始终只绑定服务端最近更新的一份：空库时创建，有文件时替换 `items[0]`；
8. `我的简历` 展示完整文件库；点击打开真实 PDF，左滑提供与状态相符的解析/替换/删除动作；
9. 替换遵守后端槽位语义，保留旧 `display_name`；P2 不提供重命名入口；
10. 解析成功不自动写在线简历、不向浏览器返回解析正文、不制造“已经自动填充”的假象；
11. CAS、幂等、结果未知、并发更新、迟到响应和会话失效都有确定的权威恢复路径；
12. Vitest、普通/数据源模式 Playwright 和 UI regression 提供纯前端可重复证据；现有 Mock 视觉场景未经批准不得漂移。

## 3. 非目标与延期项

P2 前端明确不做：

- 读取或展示完整解析结果；
- 将解析内容自动写入在线简历、匹配资料或 onboarding 字段；
- 解析字段校对、差异比较、一键采用或字段级重试；
- “主简历”选择和附件优先级；后端没有 primary 概念；
- 附件重命名；后端虽有 PATCH，本期没有获批交互；
- 招聘方附件披露、S1 原件递交或 MatchCase 流程改造；
- 全局后台轮询、系统通知、进度百分比或新的任务中心；
- 通用上传框架、通用 query cache、通用二进制资源库或 CSS 重构；
- 把当前模拟 `简历原件层` 当作上传 PDF 的真实预览；
- 修改后端仓库。public OpenAPI 的 consent 漂移由后端后续单独补齐。

未来若要把 P2 解析结果写入在线简历，必须有新的产品设计和后端消费契约；本次不得预埋解析正文类型或伪造结果接口。

## 4. 采用方案与被拒方案

### 4.1 采用：独立附件简历领域接入现有 Provider

数据流固定为：

```text
BFF wire contract
  -> 附件简历数据源（严格解码 / multipart / CAS / 幂等 / PDF Blob）
  -> 附件简历操作层（锁 / 权威重读 / 会话代际 / 错误恢复）
  -> Provider 中的权威附件库
  -> 页面可见期刷新 hook
  -> 完善资料 / 我的简历
```

附件库是两个页面的单一事实来源，避免 onboarding 和简历页各持有一份列表、解析状态或 revision。

### 4.2 拒绝：页面直接请求 BFF

页面局部请求文件较少，但会复制 multipart、严格解码、If-Match、幂等、401 清理、结果未知恢复和轮询竞态；两个页面也会出现不同的附件顺序和状态。

### 4.3 拒绝：塞入现有结构化简历 facade

在线简历是分区 JSON/CAS 保存；附件简历是对象上传、槽位 revision、二进制下载和异步 parse。合并会使 `简历.ts` 同时拥有两个无关生命周期，并为后续解析结果接入制造错误边界。

### 4.4 拒绝：页面各自的局部附件 store

局部 store 会在路由切换时丢失权威状态，也无法复用候选人水合、账号清理和会话代际。当前没有性能证据支持第二套缓存。

## 5. 冻结的浏览器契约

### 5.1 Routes

| 能力 | Route | 浏览器约束 |
| --- | --- | --- |
| 列表 | `GET /api/v1/me/resume-files` | 不分页；`items` 最多 3；返回 limits 与每个 current version 的 parse |
| 创建 | `POST /api/v1/me/resume-files` | multipart；`display_name` + `file` + 已确认时的 consent；Idempotency-Key |
| 替换 | `PUT /api/v1/me/resume-files/{file_id}/content` | multipart；保留 display name；If-Match + Idempotency-Key |
| 删除 | `DELETE /api/v1/me/resume-files/{file_id}` | If-Match；返回删除回执 |
| 下载 | `GET /api/v1/me/resume-files/{file_id}/content` | owner-authenticated `application/pdf`；`private, no-store`；attachment disposition |
| 显式解析 | `POST /api/v1/me/resume-files/{file_id}/parse` | `{version_id, processing_consent_confirmed:true}`；Idempotency-Key；202 status |

P2 不调用 rename route。

### 5.2 文件和 limits

前端 wire DTO 必须精确包含：

```ts
interface BFF附件简历版本 {
  version_id: string;
  version: number;
  size_bytes: number;
  media_type: 'application/pdf';
  sha256: string;
  created_at: string;
  parse: BFF附件解析状态;
}

interface BFF附件简历 {
  file_id: string;
  display_name: string;
  revision: number;
  current_version: BFF附件简历版本;
  created_at: string;
  updated_at: string;
}

interface BFF附件简历库 {
  items: BFF附件简历[];
  limits: {
    max_files: number;
    max_file_bytes: number;
    accepted_media_types: ['application/pdf'];
  };
}
```

`items` 保持后端顺序。冻结基线按 `updated_at DESC, file_id DESC` 返回，页面不得另按本地时间或文件名排序。完整 SHA 可以保留在仅数据/恢复层使用的 wire snapshot 中，但不得渲染、记录或写入浏览器存储。

### 5.3 Parse 判别联合

页面和数据层使用闭合判别联合，不用“全部可选字段”的松散对象：

```ts
type BFF附件解析状态 =
  | { status: 'not_started' }
  | { status: 'pending' | 'processing'; updated_at: string }
  | { status: 'succeeded'; parse_id: string; updated_at: string }
  | {
      status: 'failed';
      failure_code:
        | 'document_unreadable'
        | 'document_too_complex'
        | 'parser_invalid_output'
        | 'parser_temporarily_unavailable';
      updated_at: string;
    };
```

严格解码要求：

- 对象 exact keys；未知字段 fail closed；
- `not_started` 不得带 `parse_id`、`failure_code`、`updated_at`；
- `pending/processing` 必须带 `updated_at`，不得带 terminal 字段；
- `succeeded` 必须且只能带 `parse_id + updated_at`；
- `failed` 必须且只能带闭集 `failure_code + updated_at`；
- revision、version、size 必须是非负/正整数的契约值；
- `max_files` 必须是 `1..3` 的整数，`items.length <= limits.max_files`，media type 只能是 `application/pdf`；大于 3 是当前产品与 wire 的 breaking change，必须 fail closed；
- limits 和 accepted media types 不得缺失或为 null；
- 任何畸形成功响应转成 `BFF错误(200, 'invalid_response', ...)`，不得回退 Mock。

### 5.4 Consent public OpenAPI 漂移

冻结 release 的 Recruitment 实现、内部 OpenAPI、BFF relay 行为和测试都支持 create/replace multipart 的可选 `processing_consent_confirmed`；但 `apps/recruitment-bff/openapi/mobile-v1.yaml` 的 `ResumeFileUploadCreate/Replace` schema 与 route description 仍把 part set 写成不含 consent。

这不是前端实施阻塞项。前端按已验证运行时契约发送 consent，并用 FormData 测试冻结实际 wire。后端后续必须：

1. 为 public `ResumeFileUploadCreate` 加可选 boolean property；
2. 为 public `ResumeFileUploadReplace` 加同一 property；
3. 修改两条 description，说明 absent=false、raw 值只允许 `true|false`。

该后端文档修复最迟应在正式联调/发布门前完成，但不属于本前端仓库 diff。

## 6. 架构与文件责任

### 6.1 Wire 与数据源

- `src/数据/BFF契约.ts`：增加附件库、文件、版本、parse 判别联合和 failure-code 类型；不增加解析正文类型。
- `src/数据/招聘数据源类型.ts`：定义页面附件库投影和必要输入；不把附件名写进结构化简历快照。
- `src/数据/招聘数据源/附件简历.ts`：拥有六条 route、strict decoder、FormData、If-Match、Idempotency-Key 和 PDF Blob 校验；不 import React、Mock 或页面状态。
- `src/数据/HTTP招聘数据源.ts`：在已含 P6 Agent 规则的八个现有领域后，把 `附件简历数据源` 组合成根数据源的第九个 facade；不改变其它领域 owner。
- `src/数据/HTTP客户端.ts`：在现有 JSON 请求旁增加窄的 authenticated binary GET；复用 credentials、GET 网络重试和 JSON 错误信封解析，不建立第二个 fetch client。

二进制成功响应返回：

```ts
interface BFF二进制响应 {
  blob: Blob;
  contentType: string;
  contentDisposition: string | null;
  requestId: string | null;
}
```

附件数据源只接受 `application/pdf`，否则报 `invalid_response`。Blob 不进入 Provider 或持久化。

### 6.2 根状态与操作

- `src/状态/后端/类型.ts`：`后端状态` 增加 `附件简历库: BFF附件简历库 | null`；`应用操作` 增加附件读取、创建、替换、删除、解析和下载。
- `src/状态/后端/附件简历操作.ts`：负责权威提交、文件/库级锁、会话代际、冲突重读和结果未知收口。
- `src/状态/后端/会话操作.ts`：候选人水合并行加入附件列表；所有账号清理路径将 snapshot 置 null。
- `src/状态/应用状态.tsx`：初始化 snapshot、组合操作；不承载 wire decoder 或页面文案。
- `src/流程/附件简历刷新.ts`：只负责页面可见期的 immediate refresh、单飞 setTimeout 轮询和清理；不拥有另一份列表。

基线已包含 P6：`后端状态` 具有双角色规则/提案快照与 `Agent规则水合`，`应用操作` 已相交 `Agent规则操作`，`水合角色数据` 也会先启动独立的 `p6Promise`。P2 只能在这些 shape 上增量增加附件字段/操作；不得用旧的五域类型联合、三路候选水合或只清 P3 的对象字面量覆盖 P6。账号清理继续复用 `重置Agent规则后端状态`，并在同一次 functional update 中把附件 snapshot 置 null。

附件操作 factory 闭包另持有一个不渲染的读取序号、最近成功提交序号/快照和只串行同步 commit 的 Promise 链。候选登录水合仍由会话层用 generation fence 独立完成；水合后的显式刷新、轮询、安全重读和 mutation 后权威 GET 都立即发出，不被无关的 stalled GET 阻塞。成功响应才进入短 commit 链：序号新于最近成功提交才提交，迟到旧成功返回最近提交快照而不覆盖，失败响应不推进序号也不污染其它调用。mutation 只有在自己的成功响应已提交、或确认有更新的成功读取已经提交后才 resolve。该协调器与 factory 同生命周期，不扩展公共 Provider 状态或其它领域依赖。

`后端状态.附件简历库=null` 表示尚未完成读取，`{items:[], limits}` 才表示权威空库。Backend 页面不再读取或写入 legacy `状态.简历文件名`；该字段只服务 Mock 演示与现有缓存兼容。

四个附件 mutation 操作返回 `Promise<'已提交' | '已换代'>`。`已提交` 表示当前会话已有相同或更新的权威列表提交，页面可以显示成功提示；`已换代` 表示 subject/generation 已变，页面必须静默结束，不显示成功或失败提示。刷新仍返回 `Promise<void>`，下载仍返回 `Promise<Blob>`。

### 6.3 页面责任

- `src/屏幕/学生分流.tsx`：选择文件、本地预检、授权确认、空库 create / 非空 replace 最近项；不实现协议和轮询。
- `src/屏幕/我的简历.tsx`：渲染权威 0–3 行、状态文案、标题 `＋`、滑动动作、删除确认和真实 PDF 预览。
- `src/组件/确认层.tsx`、`src/组件/滑动行.tsx`、`src/组件/弹层框架.tsx`：原样复用，不为 P2 新建视觉体系。
- 允许提取一个无新视觉的 `附件简历行` 小组件，前提是它只复用 `我的简历.module.css` 中既有附件原语。

## 7. Consent 与文件预检

### 7.1 统一确认层

创建、替换和显式解析都复用同一层：

- 标题：`允许 AI 识别这份简历？`
- 内容：`这份 PDF 将发送给受控模型服务进行简历识别，可能包含个人信息。确认后才会上传并开始处理。`
- 按钮：`取消` / `同意并继续`

取消时清除待处理 `File`，不调用 operation。操作签名使用 literal `true`，让调用方不能传 `false` 假装已确认：

```ts
创建附件简历(file: File, processingConsentConfirmed: true): Promise<'已提交' | '已换代'>;
替换附件简历(fileId: string, file: File, processingConsentConfirmed: true): Promise<'已提交' | '已换代'>;
请求附件解析(fileId: string, processingConsentConfirmed: true): Promise<'已提交' | '已换代'>;
```

操作层从 snapshot 取当前 revision/version，页面不手工携带陈旧 CAS 元数据。

### 7.2 本地预检

- input 使用 `accept=".pdf,application/pdf"`；
- 文件名扩展名必须大小写不敏感地以 `.pdf` 结尾；`file.type` 允许空串或 `application/pdf`，其它声明类型先拒绝；
- snapshot 已有 limits 时，`file.size > max_file_bytes` 在确认前提示；未水合 limits 时不硬编码业务上限，由服务端裁决；
- 本地检查不尝试解析 PDF 结构、加密或 active content，服务端仍是最终权威；
- 每次处理完将 file input value 清空，允许再次选择同一文件；
- 不截断或静默改写 `file.name`。create 的 display name 就是原文件名；后端拒绝非法长度时显示错误。

## 8. 页面交互

### 8.1 完善资料

现有上传区仍只有一条相同行高的上传行：

- Backend 空库：`上传 PDF 简历，确认后开始识别`；
- Backend 非空：显示 `items[0].display_name`；
- 点击后选择文件，完成预检和授权；空库调用 create，非空调用 replace `items[0]`；
- 即使有 2–3 份，这里也只展示/替换最近更新的一份；完整管理在 `我的简历`；
- replace 不发 display name，因此选择 `new.pdf` 替换后仍显示旧槽位名；
- 成功后轻提示 `简历已上传，正在识别`；失败保留原回显；
- 上传和解析不是 onboarding 必填，不阻止“下一步”；
- Backend 不再显示“AI识别后自动填充”，因为 P2 不会预填在线简历；
- Mock 分支保持当前文件名 reducer、提示和视觉场景不变。

### 8.2 我的简历

附件卡按服务端顺序展示 0–3 条现有 PDF 行。空库显示同卡内的轻量空态 `还未上传附件简历`，不新增页面。标题右侧使用小型 `＋`：

- 只在 Backend 且 `items.length < limits.max_files` 时显示；
- `aria-label="添加附件简历"`；
- 不增加标题行高度或卡片外间距；
- 选择文件后走同一预检/授权并 create；
- 达上限时隐藏；并发 409 时重读并提示。

每行点击下载真实 PDF 并打开浏览器原生预览，不再切换“原型演示”说明。每行包进现有 `滑动行`，静止态几何必须与原附件行一致。

动作矩阵：

| 状态 | 左滑动作 |
| --- | --- |
| `not_started` | `解析`、`替换`、`删除` |
| `failed` | `重新解析`、`替换`、`删除` |
| `pending` / `processing` | `替换`、`删除` |
| `succeeded` | `替换`、`删除` |

状态副标题：

| wire 状态 | 文案 |
| --- | --- |
| `not_started` | `尚未识别` |
| `pending` | `等待识别` |
| `processing` | `正在识别` |
| `succeeded` | `识别完成` |
| failed / `document_unreadable` | `未能读取 · 可重试` |
| failed / `document_too_complex` | `内容过多 · 请替换` |
| failed / `parser_invalid_output` | `识别失败 · 可重试` |
| failed / `parser_temporarily_unavailable` | `服务繁忙 · 稍后重试` |

删除确认复用现有确认层：标题 `删除附件简历？`，说明 `删除后无法恢复。`。确认前不移除本地行。

### 8.3 真实 PDF 预览

BFF 下载带 `Content-Disposition: attachment`，直接导航会下载而不是稳定预览。固定流程为：

1. 用户点击行时同步预开空白窗口，立即隔离 opener；
2. 调用 `下载附件简历(fileId)`；
3. 成功后为 PDF Blob 创建 object URL，并把预开窗口导航到该 URL；
4. 预览 load 后延迟回收，另设有界兜底定时回收；组件卸载清理仍存活的 URL/timer；
5. 预开失败时用带 `rel=noopener` 的临时 anchor 兜底；仍被浏览器阻止则轻提示用户允许新窗口；
6. 下载失败关闭空白窗口并显示统一错误；
7. 不把 Blob、object URL、文件名或 SHA 写入日志、Provider、localStorage/sessionStorage。

## 9. 水合、刷新与轮询

候选人 Backend 水合的支持域数组扩展为：

```text
const p6Promise = 水合Agent规则角色数据(...); // 基线已有，先行并发启动
const supportResults = Promise.allSettled(
  GET structured Resume,
  GET Intention list,
  GET Privacy,
  GET Resume File list
);
const p6Results = await p6Promise; // 保持基线三路 P6 结果扫描/401 收口
```

四个支持域独立提交，且与既有 P6 三路读取并行；附件读取失败不撤销其它成功域、不改变 P6 水合阶段，也不加载 Mock 文件名。页面挂载时仍进行一次附件 refresh，使未经过完整登录水合的深链路和长期打开页面可以恢复。

`附件简历刷新` hook 固定行为：

- `完善资料` 或 `我的简历` mount 且 document visible 时立即 GET；
- snapshot 中存在 `pending|processing` 才启动下一次刷新；
- 每次请求 settle 后 3 秒使用 `setTimeout` 发下一次，禁止 `setInterval` 和重叠请求；
- active 状态变化只更新轮询控制器并安排/取消下一次 3 秒刷新，不触发第二次 immediate GET；单飞标志跨 React effect 重跑存活；visibility 恢复若遇在飞请求，单独登记一次“settle 后立即刷新”，不得与 3 秒轮询标志混用；
- hidden、unmount、全部 terminal、登出、角色改变或 session generation 改变时清 timer；
- `visibilitychange` 回到 visible 时立即刷新一次，再按最新结果决定是否继续；
- 每次请求捕获 subject + generation；不匹配的迟到成功或失败都不提交、不提示；
- 初次显式读取失败可以提示一次；后台轮询失败保留最后成功 snapshot，不连续 toast；下一次 visibility 恢复或用户动作再重试。

不存在全局常驻 timer。

## 10. 写入一致性、锁与恢复

### 10.1 通用规则

- 不做乐观写；服务端响应或权威 GET 先于 Provider 提交；
- create 使用库级锁 `resume-files:create`；replace/delete/parse 使用文件级锁 `resume-file:{id}`；download 只读，不与 mutation 共用写锁；
- 同一动作执行中页面使用本地 `aria-busy/disabled` 防双击，但不新增可见 spinner；
- mutation 成功后统一 GET 列表再 resolve，确保 order、limits、revision、version 和 parse 来自同一权威视图；
- 登录水合以外的列表 GET 立即并发发出，但只有成功响应的同步 commit 通过 factory-local 短队列；提交序号只前进，迟到旧成功不能覆盖，失败不反向影响其它调用；
- 401 走现有 `清账号状态`，同时清 snapshot、timer 和待处理文件；
- 不自动生成新幂等键重放一次结果未知的 mutation。

### 10.2 CAS、404 与 stale selection

`resume_file_version_conflict`、`resume_file_selection_stale` 或 `resume_file_not_found`：

1. 安全重读附件库；
2. 提交最新列表；
3. 不重放原操作；
4. 保留尚未发送的新 `File` 只到当前交互收口，提示用户根据最新行重新选择动作；离页即释放。

### 10.3 幂等与结果未知

现有 HTTP 客户端对 `idempotency_in_progress` 和 `operation_outcome_unknown` 使用同一 key 受控重试一次。最终仍失败、网络中断或 503 时，操作层只做一次权威 GET：

- delete 后目标已不存在：目标状态已达成，可收口为成功；
- parse 后同一 current version 已是 `pending|processing|succeeded`，或 terminal `updated_at` 已变化：目标已达成；
- create/replace 出现新的权威 file/version：刷新页面，但不能仅凭同名或版本变化声称一定是本设备成功；提示 `附件状态已更新，请确认`；
- 无法确认：保留权威列表并抛原始错误，用户明确重试才生成新意图。

错误恢复中的权威读取若因 subject/generation 已换代而返回 `null`，不得读取 `items` 或把 null 解释为“已删除”；跳过效果判定并返回 `已换代`，不能把原始错误再抛给页面形成 stale toast。成功 mutation 的收尾读取若换代也返回 `已换代`。两页只有收到 `已提交` 才显示 mutation 成功提示，`已换代` 不向新会话提交或向旧页面提示。

不得为了确认上传结果在 UI 或日志输出 SHA。若未来需要精确本地 digest 对账，应另有性能/隐私设计，本期不增加浏览器哈希。

### 10.4 稳定错误分派

| code | 前端行为 |
| --- | --- |
| `invalid_pdf` | 提示仅支持有效、未加密且无主动内容的 PDF；不改变列表 |
| `resume_file_too_large` | 使用当前 limits 提示大小上限；无 limits 时使用服务端 message |
| `resume_file_limit_reached` | 重读，隐藏 `＋`，提示最多可上传当前 max_files |
| `upload_in_progress` | 重读后仍抛原 code，不做集合差异收口，不换 key 自动重试，提示稍后再试 |
| `idempotency_in_progress` | HTTP 同 key 受控重试仍失败后按结果未知重读，不换 key 自动重试 |
| `resume_file_version_conflict` | 重读，不重放 |
| `parse_already_in_progress` | 重读；若已 active，按目标达成收口 |
| `parse_not_allowed` | 重读；若 succeeded 保持成功，否则提示当前状态不可解析 |
| `resume_file_selection_stale` | 重读，不用旧 version 重试 |
| `storage_unavailable` | 保留旧状态，提示稍后重试 |
| `parser_temporarily_unavailable` | 保留旧状态，允许稍后显式重试 |
| `processing_consent_required` | 视为前端契约错误；不自动补发，提示重新确认 |
| `invalid_response` | fail closed，保留最后权威 snapshot |

direct user action 的错误使用现有 `轻提示`；轮询错误静默保留旧状态。后端 raw message、provider status、对象坐标和 SQL/GCS 信息不得进入 UI。

## 11. Mock / Backend 隔离

Mock 模式继续使用：

- `状态.简历文件名`；
- `学生分流` 当前本地选择和轻提示；
- `我的简历` 当前硬编码附件行及“原型演示”说明；
- 当前视觉回归场景和截图。

Backend 模式只使用 `后端状态.附件简历库`。Backend 初始状态不得带 `沈亦舟_简历_2026.pdf`，GET 失败不得回落到该字符串。Mock 不构造伪 revision、file_id、version_id、parse_id 或 limits。数据源模式切换/不同 Provider 实例不得跨模式持久化附件 snapshot。

## 12. UI 与视觉防漂移

### 12.1 允许的 Backend 可见差异

- onboarding 空态从虚假的“自动填充”改为 `上传 PDF 简历，确认后开始识别`；
- `我的简历` 附件卡标题右侧小型 `＋`；
- 行数随权威 0–3 份数据变化；
- 原固定副标题改为短解析状态；
- 左滑后出现既有样式的动作按钮；
- 现有确认层承载 consent 和删除确认。

### 12.2 禁止漂移

- 不改路由、壳层、页面顺序、标题、主按钮位置或滚动区 padding；
- 不改卡片宽度、圆角、PDF 图标、字号、颜色 token、行高或静止态尖括号；
- 不新增页面、进度条、骨架屏、badge、说明卡、浮动按钮或动画；
- 不改 Mock `candidate-preferences` 场景的可见内容和关键元素几何；
- 不借接线重写其它简历区块、在线简历或招聘方页面文案；
- 多文件导致的页面自然增高是数据驱动结果，不得伴随全局布局调整。

标题 `＋` 使用绝对/同高布局或现有标题行 flex，在缺少 `＋` 时不得改变标题位置。`滑动行` 包装后的未滑动几何必须与原 `.附件行` 相同。

## 13. 测试策略

### 13.1 HTTP 客户端与数据源

- binary GET 携带 credentials，GET 网络错误只重试一次；
- PDF success 返回 Blob 和固定 headers；JSON/error response 仍映射为 `BFF错误`；错误 Content-Type fail closed；
- list/create/replace/delete/parse/download 的 exact method/path/body/formData/If-Match/idempotency；
- create FormData 精确含 `display_name,file,processing_consent_confirmed="true"`；replace 精确含 `file,processing_consent_confirmed="true"`，不含 display name；
- strict decoder 覆盖每种合法 parse union，以及 extra/missing/null/unknown enum/非法组合/超过三项/非法 limits；
- 根 `HTTP招聘数据源` 加入第九个 facade 后不丢已有八域方法，尤其不得删除 P6 Agent 规则/提案方法。

### 13.2 后端操作与水合

- candidate 四个支持域 partial success，同时保留 P6 三路并发水合与错误扫描；招聘方不读附件；
- logout、401、subject change、role change 清空附件 snapshot；
- create/replace/delete/parse 成功后权威 GET；
- 文件/库锁拒绝重复提交；
- 409/404/503/network unknown 的重读和不重放规则；
- 旧轮询 GET 在 mutation + 权威 GET 之后到达时不得覆盖最新列表；
- stale generation 响应不能提交或提示；
- Backend 不使用 legacy Mock 文件名。

### 13.3 Hook 与组件

- mount/visible immediate refresh；只有 active parse 启动 3 秒单飞 timer；
- hidden/unmount/terminal/logout 清 timer；恢复 visible 立即刷新；轮询错误不刷 toast；
- onboarding 空库 create、非空 replace `items[0]`、多文件只回显第一项、取消 consent 零 mutation、上传不阻塞下一步；
- `我的简历` 0–3 行、`＋` 上限、动作矩阵、失败码文案、删除确认；
- replace 后展示名不变；P2 无 rename 控件；
- PDF 预开、Blob URL 导航、失败关闭、fallback 和 URL/timer cleanup；
- Mock 两屏保持现有行为。

### 13.4 E2E 与视觉门

- `e2e/数据源模式.spec.ts` 增加 Backend 可变附件 fixture：列表、multipart create/replace、DELETE、parse 202、状态轮询和 PDF bytes；
- Backend E2E 覆盖 consent cancel、创建、pending→processing→succeeded、failed retry、替换保名、删除和 max=3；
- Mock E2E 证明没有请求 `/api/v1/me/resume-files`，原上传演示仍工作；
- 普通 onboarding/换壳测试继续通过；
- `npm run ui:check` 以 `origin/main` 为 base，在 `UI_VISUAL_GATE=required` 且未授权漂移模式验证现有 Mock 场景；
- Backend 新能力使用 DOM/geometry 断言验证标题高度、附件行静止矩形和无新常驻元素，不用放宽 Mock 视觉门。

最终命令：

```bash
npm test
npm run lint
npm run build
npm run test:e2e
npm run test:e2e:data-source
UI_VISUAL_GATE=required UI_CHANGE_APPROVED=false npm run ui:check -- --base origin/main
```

## 14. 实施前基线与完成证据

2026-08-28 在校准后的前端基线 `96257a2` 已验证：

- `npm test`：76 files、764 tests PASS；
- `npm run typecheck`：PASS；
- `npm run lint`：PASS；
- `npm run build`：PASS；
- 验证 worktree clean；
- `plan-p2-frontend-integration` 已 rebase 到 `origin/main@96257a2`，其上仅有 P2 Spec/Plan 与审查/校准文档提交。

实施完成不能只以单测或 build 宣称成功；必须同时提供 data-source E2E 和 UI regression verdict。浏览器/Chrome 基础设施缺失属于环境阻塞，不得写成产品 PASS；若 UI gate 报未授权漂移，必须定位并恢复几何，不能通过放宽阈值或设置 `UI_CHANGE_APPROVED=true` 绕过。

## 15. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| public OpenAPI 未声明 upload consent | 前端 FormData 测试冻结真实 runtime；后端发布前补 schema/description |
| 两页持有不同列表 | Provider 单一 snapshot；所有 mutation 后权威 GET |
| 轮询泄漏或请求重叠 | 页面可见 hook + settle 后 setTimeout + generation fence |
| 替换误改展示名 | replace FormData 禁止 display name；UI 明示保留槽位名 |
| PDF 下载被 attachment disposition 强制保存 | authenticated binary fetch + Blob URL 原生预览 |
| popup 被拦截或 object URL 泄漏 | 同步预开 + anchor fallback + load/timeout/unmount cleanup |
| 网络错误后重复创建/解析 | 同 key 受控重试；最终只权威 GET，不自动换 key 重放 |
| 后端错误/解析结果泄露隐私 | 闭合 decoder、短文案、禁日志/持久化 Blob/SHA/result |
| 视觉门被真实接线破坏 | Mock 分支零漂移；Backend 只复用现有原语并加 geometry/component 断言 |

## 16. 最小性说明

该设计只新增一个与后端资源边界一致的附件领域、一个窄 binary GET seam、一个页面可见期刷新 hook 和两处现有页面接线。没有新增路由、后端、依赖、状态库、解析结果模型或设计系统。独立领域是 multipart、CAS、幂等、Blob 和异步 parse 生命周期所需的最小隔离；再少会把协议复制进页面或污染结构化简历域，再多则没有当前需求和证据。
