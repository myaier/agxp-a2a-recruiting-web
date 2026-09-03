# JD PDF 导入发布岗位前端接线设计

**日期：** 2026-09-03

**状态：** 已批准（2026-09-03）

**前端基线：** `agxp-a2a-recruiting-web@86125819`（`main` / `origin/main`）

**后端合同来源：** `docs/handoffs/2026-09-03-jd-pdf-import-frontend-wiring.md`；该 handoff 记录后端实现核查点 `agxp-server scope/jd-pdf-upload-feature-parity@2be8c2748`。前端仓库不能证明目标环境已经部署该提交、迁移、对象存储、模型配置和 worker，真实联调前必须由发布 owner 确认。

**优先级说明：** 本设计冻结本轮前端行为。它在 JD 导入交互上取代 `docs/superpowers/specs/2026-09-01-employer-onboarding-repair-design.md` 中与“先展示建议、再点击应用”冲突的旧设想；候选人简历上传和预填仍由其各自设计负责。

## 1. 结论

采用“复用简历上传的安全语义、保持 JD 领域独立”的最小方案：

1. 招聘方在新建岗位首屏选择 PDF，通过本地校验并明确同意后，前端创建一次 JD 导入任务。
2. 页面以串行轮询读取结果；表单始终可编辑，不因解析被全屏阻塞。
3. 成功建议自动写入上传后仍未被用户修改的安全字段；用户在等待期间改过的字段或耦合组保持不变。
4. 模型文本不能制造 Catalog ID；类别和城市仍需用户完成真实目录选择。
5. 导入只更新当前页面内存中的可编辑表单，不保存、不发布岗位。
6. 页面卸载只停止前端轮询，不声称取消服务端任务；新合法 PDF 会使旧轮全部结果失效。

本设计复用现有 `HTTP客户端`、应用操作工厂、会话换代栅栏、`校验附件PDF`、`确认层`、`代理横幅` 和 `轻提示`，但不复用附件简历的资源库、替换、下载、浏览器恢复或候选预填全局状态。JD 是一次性页面任务，建立通用“文档导入框架”没有当前用例支撑。

## 2. 已校准的前端事实

### 2.1 当前 UI 只有入口，没有接线

`src/屏幕/发布岗位.tsx` 已在新建岗位第一步显示 PM 提供的 JD 横幅和隐藏文件输入。当前输入仍接受 PDF、DOC、DOCX、TXT，选中文件后只显示轻提示，没有 consent、POST、轮询或预填。

编辑岗位不显示横幅。本轮保持这个边界：JD 导入只服务新建岗位，不给既有岗位增加导入入口。

### 2.2 简历上传可复用的是安全边界，不是领域状态

现有候选人附件和 onboarding 预填已经提供可复用的思路：

- 文件选择后立即清空 input，允许重新选择同一文件；
- 本地 PDF 校验先于确认层，consent 前零 mutation；
- 本地 busy guard 防止重复动作；
- Backend/role guard、`subject + session generation` 栅栏和当前 401 统一清理；
- 旧会话迟到结果及迟到 401 静默丢弃；
- 闭合错误文案，不展示 provider、request ID、原始输出或内部坐标；
- 建议值不能覆盖更高优先级的用户事实或 canonical Catalog 引用。

候选 onboarding 会在消费表单挂载前等待建议稳定，因此无需在表单中合并迟到结果。JD 表单在上传和解析时继续可编辑，必须额外使用上传快照做逐字段 compare-and-fill，不能直接套用候选预填状态机。

### 2.3 HTTP 客户端的现有能力和限制

`src/数据/HTTP客户端.ts` 已支持：

- `FormData` 请求且不手写 multipart boundary；
- 调用方提供的 16–128 位可见 ASCII 幂等键；
- 同一次客户端受控重试复用同一幂等键；
- GET 网络错误的一次受控重试；
- `不缓存: true` 和严格响应信封；
- 标准 `BFF错误` 与当前统一会话清理入口。

客户端成功响应没有暴露 HTTP status。为在领域层重复验证 POST 的 `202` 而扩展共享客户端，会增加与业务目标无关的公共改动。本轮严格解码成功 result，合同测试和拦截式 E2E 固定返回 `202`；真实状态码由后端合同与真实联调验证。

### 2.4 当前岗位表单的两个合同缺口

- Backend 第一步只检查类别展示文字，尚未要求真实 `类别引用`。
- 办公地点当前无条件必填；后端合同允许 `workplace_mode=remote` 时为空。

本轮必须随 JD 建议一起闭合这两个缺口，否则模型文本可能绕过 Catalog，或全远程建议无法合法发布。

## 3. 目标与成功标准

### 3.1 目标

- Backend + recruiter 新建岗位可以从一份合法 JD PDF 创建并读取建议稿。
- consent 前没有网络 mutation；同一文件选择意图的显式 POST 重试复用同一幂等键。
- pending/processing 最多只有一个在途 GET，页面隐藏暂停、恢复立即继续。
- POST 可以直接返回四种合法状态中的任意一种。
- 建议自动填入上传后未被用户修改的字段；字段组之间不会因类型或办公方式切换产生隐藏覆盖。
- `null`、未知枚举、额外字段或状态矛盾不会清空字段或应用半份结果。
- 类别和城市建议不会伪造 Catalog ID；发布前仍要求真实引用。
- 全远程地址行为与后端合同一致。
- 解析成功本身不会触发 Job POST；用户仍需核对、补齐并主动发布。
- Mock、编辑岗位和失败路径不产生假建议，也不阻断手填。

### 3.2 完成标准

- 数据源、操作工厂、Provider 和页面运行时接线完整，不存在“只有类型没有 spread”的假接线。
- 新文件、卸载、页面隐藏、会话换代及迟到 401 的行为都有自动化覆盖。
- 定向测试、完整 Vitest、typecheck、lint、build 和数据源模式 E2E 通过。
- 实现 diff 满足第 4 节的 PM 冻结边界。
- 若目标后端环境尚未部署，必须把真实联调记为环境缺口；拦截式 E2E 不得被描述成真实后端已验证。

## 4. PM UI 冻结边界

PM 已完成本轮前端视觉。实施者只负责数据与交互接线，以下均为硬约束：

- 不修改任何 `.css`、`.module.css`、全局样式、CSS variable、inline style 或现有 `className`。
- 不修改 `src/组件/**`，不扩展现有设计组件的 props。
- 不新增任何 UI 组件文件。
- 不移动、重排、包裹现有可视节点，不增加影响页面流式布局的容器、状态行、提示条或常驻文字。
- 不改变现有控件的尺寸、间距、顺序、标签或视觉层级。
- 只允许在原位置复用 `代理横幅` 的现有文案/动作 props、条件渲染现有 `确认层`、调用现有 `轻提示`，以及给现有 DOM/表单控件补充数据或行为属性。
- 全远程时办公地点保留原布局位置，只清空并禁用现有控件；不得通过隐藏该行改变布局。
- `category_source_name` 不新增选择器旁提示节点；成功时用现有 `轻提示` 告知用户“AI 识别的职位类别是「…」，请手动选择”。横幅同时承担持续的成功状态。
- 上传中通过页面本地 guard 拒绝重复上传/确认，并在现有页面容器上设置 `aria-busy`；不为 disabled/busy 状态修改共享组件或新增视觉样式。

实施 diff 一旦触及上述冻结范围，视为越界，必须移除并由 PM 另行处理。预期不需要重录视觉基线。

## 5. 架构边界

### 5.1 数据合同与窄数据源

在 `src/数据/BFF契约.ts` 增加 handoff 冻结的闭合类型，并新增 `src/数据/招聘数据源/JD导入.ts`：

```ts
export interface JD导入数据源 {
  创建JD导入(file: File, idempotencyKey: string): Promise<BFFJD导入>;
  读取JD导入(importId: string): Promise<BFFJD导入>;
}
```

`HTTP招聘数据源` 只把该 facade 作为第十五个领域组合进去；不创建第二套 HTTP 包装器，也不修改其他十四个领域。

### 5.2 薄应用操作层

在 `src/状态/后端/类型.ts` 和新的 `src/状态/后端/JD导入操作.ts` 暴露：

```ts
export interface JD导入操作 {
  创建JD导入(file: File, idempotencyKey: string): Promise<BFFJD导入 | '已换代'>;
  读取JD导入(importId: string): Promise<BFFJD导入 | '已换代'>;
}
```

操作层只负责：

- 仅 `Backend + recruiter` 调用真实数据源；其他模式返回 `已换代`，且页面不会在 Mock 调用；
- 请求前捕获现有 subject、角色和 session generation；
- 返回或失败时先检查栅栏；已换代时整包静默丢弃；
- 当前栅栏的 401 走现有 `清账号状态`，旧请求迟到的 401 不得清理新会话；
- 当前栅栏的其他错误原样交给页面的 JD 闭合映射。

`src/状态/应用状态.tsx` 必须实际创建并 spread 该工厂；不新增全局 `后端状态`、锁集合或持久化 owner。

### 5.3 页面内运行态

JD 导入状态只在 `发布岗位.tsx` 当前挂载周期存在：

```ts
type JD导入阶段 = 'idle' | 'uploading' | 'pending' | 'processing' | 'succeeded' | 'failed';
type JD重试动作 = 'create' | 'read' | 'none';

interface JD导入页面状态 {
  generation: number;
  phase: JD导入阶段;
  file: File | null;
  idempotencyKey: string | null;
  importId: string | null;
  retry: JD重试动作;
  error: string | null;
}
```

待确认文件、上传快照、mounted 标记、timer 和 in-flight guard 均为页面私有引用或状态。不得把 PDF、建议 DTO、import ID、幂等键或状态写入 localStorage/sessionStorage。

## 6. HTTP 合同与严格解码

### 6.1 创建导入

固定调用：

```http
POST /api/v1/recruiter/job-draft-imports
Idempotency-Key: <16–128 visible ASCII chars>
Content-Type: multipart/form-data; boundary=...

file=<application/pdf binary>
processing_consent_confirmed=true
```

要求：

- FormData 恰好包含 `file` 与 `processing_consent_confirmed`，不发送 `display_name` 或其他 part；
- consent 是字符串字面量 `"true"`；
- 使用 `幂等: true, 幂等键: idempotencyKey, 严格信封: true`；
- 不手写 `Content-Type`；
- `校验附件PDF` 允许部分系统提供空 MIME。合法 `.pdf` 且 `file.type === ''` 时，只在 multipart part 内把文件规范化为 `application/pdf`，保留文件名和 `lastModified`；不增加额外 part；
- 同一次合法文件选择生成一把稳定 key，只有选择另一份合法 PDF 才生成新 key。

### 6.2 读取导入

固定调用：

```http
GET /api/v1/recruiter/job-draft-imports/{import_id}
```

要求：

- `import_id` 必须先匹配 `^jdi_[0-9a-f]{32}$`；非法值在 fetch 前抛 `BFF错误(0, 'invalid_request', ...)`；
- 使用 URL 编码、`不缓存: true` 和 `严格信封: true`；
- 页面重试读取时继续使用同一 import ID，不重新 POST。

### 6.3 DTO 不变量

`status` 只允许 `pending | processing | succeeded | failed`：

- pending/processing：对象中没有 `suggestion` 和 `failure_code`；
- succeeded：必须有完整 `suggestion`，没有 `failure_code`；
- failed：必须有四值闭集中的 `failure_code`，没有 `suggestion`；
- optional 字段必须真正 omitted，不能用 JSON `null` 代替；
- `import_id`、时间字符串、所有枚举、数组成员、每层 exact key set 均严格校验；
- 建议对象完整包含 handoff 冻结的十一个键；其中标为 nullable 的字段才允许 `null`；
- 未知字段、未知枚举、非法时间、非法 ID 或状态矛盾统一抛 `BFF错误(200, 'invalid_response', ...)`；整份响应失败关闭。

建议字段为：岗位名称、招聘类型、办公方式、办公地点、职位描述、职位要求、最低学历、经验要求、类别源文本、地点源文本和关键词数组。后端不会提供 Catalog ID、薪资、公司声明、校招届别、实习条件、硬性事实或私密筛选偏好。

## 7. 上传、轮询和重试状态机

### 7.1 文件选择与 consent

- input 收紧为 `.pdf,application/pdf`，选择后立即清空 value。
- 非法文件只显示 `请选择 PDF 文件`，不增加 generation，也不影响当前合法导入。
- Mock 模式合法选择只显示“已选择，可继续手动填写”，不弹会声称真实处理的 consent，不调用 Backend，不伪造 succeeded。
- Backend 模式选择新的合法 PDF 时立即：增加 generation、停止旧 timer、清除旧 import/error、生成稳定幂等键并保存待确认文件，然后复用现有 `确认层`。
- 确认层文案固定为：
  - 标题：`允许 AI 识别这份职位描述？`
  - 正文：`这份 PDF 将发送给受控模型服务进行职位信息识别。确认后才会上传并开始处理。`
  - 主按钮：`同意并继续`
- 取消只清待确认文件；旧服务端任务即使仍运行，也已被新 generation 作废，不能回填。
- 同意时捕获本轮表单快照并进入 uploading；busy guard 让重复同意和重复上传成为 no-op。

### 7.2 POST 结果

POST 可以返回任一合法状态：

- pending/processing：记录 import ID 并开始轮询；
- succeeded：立即经过快照保护应用建议并进入 succeeded；
- failed：映射 failure code，进入 terminal failed；
- `已换代`：静默结束，不修改新页面状态。

POST 尚未取得 import ID 且发生 `network_error`、HTTP 503、`operation_outcome_unknown`、`storage_unavailable`、`upload_in_progress` 或 `idempotency_in_progress` 时，保留同一 `File + Idempotency-Key`，设 `retry:'create'`。这些情况分别表示传输/服务临时失败、结果未知或同一幂等意图仍在处理；用户显式重试仍调用 POST，让服务端按同一意图 replay。`invalid_pdf`、`document_too_complex`、`processing_consent_required`、`idempotency_conflict` 及其他确定性错误设 `retry:'none'`，只能重新选择/确认或继续手填；不得用同一确定失败意图循环重放，也不得生成新 key 自动制造第二个任务。

### 7.3 串行轮询

- pending/processing 使用约 3 秒的 `setTimeout` 链，不使用可能重叠的 `setInterval`；
- 每次 GET 完成并确认仍需轮询后，才安排下一次；同一时刻最多一个 GET；
- 页面 `document.hidden` 时清 timer，恢复可见后立即 GET；
- 卸载、新合法文件、succeeded 或 terminal failed 时清 timer；
- 每次返回同时核对 mounted、页面 generation 和当前 import ID；任一不符时静默丢弃；
- GET 的 `network_error`、HTTP 503 或 `storage_unavailable` 保留 import ID，设 `retry:'read'`；显式重试只读同一任务，绝不重新 POST；`job_draft_import_not_found`、`invalid_response` 及其他确定性错误设 `retry:'none'`；
- terminal failed 设 `retry:'none'`，只能重新选择 PDF 或继续手填。

操作层 session fence 与页面 generation/import ID fence 缺一不可：前者保护账号边界，后者保护同一挂载周期内的多个文件意图。

## 8. 自动填入与覆盖保护

### 8.1 快照语义

上传 POST 起飞前，捕获全部可建议字段和耦合字段的值。成功时：

- 当前值仍与本轮快照按值相等，表示上传后未被用户修改，可以应用非空建议；
- 当前值与快照不同即视为用户已操作，不应用该字段或字段组；当前值重新等于快照时仍可填，本轮只做值比较，不引入 dirty/touched 历史跟踪；
- 建议为 `null` 时始终保持当前值；
- 普通文本或枚举在上传前已经非空、但上传后未修改，也允许被建议替换。这是本轮已经确认的自动填表语义；
- Catalog canonical 引用是例外：已有真实引用始终优先于模型源文本；
- 不允许用一个整体 `setState` 覆盖整张表，必须按下述字段或组判断。

引用对象比较 `id + display_name`，不依赖对象引用相等。

### 8.2 独立字段

闭合映射：

| 后端建议 | 页面字段 |
| --- | --- |
| `title` | 岗位名称 |
| `description` | 职位描述 |
| `requirements` | 职位要求 |
| `education_requirement` | `none→不限`、`associate→大专`、`bachelor→本科`、`master→硕士`、`doctorate→博士` |
| `experience_requirement` | `none→不限`、`one_to_three_years→1-3 年`、`three_to_five_years→3-5 年`、`five_plus_years→5 年以上`、`ten_plus_years→10 年以上` |

经验要求受招聘类型影响：

- 建议不改变招聘类型时，只在当前类型为社招全职/兼职且经验字段未修改时应用；
- 建议同时改变招聘类型时，经验要求按第 8.3 节的招聘类型组一起决定；校园招聘/实习生不把隐藏经验值写成模型事实。

### 8.3 招聘类型耦合组

组内包含：招聘类型、薪资上下限、年薪月数、校招届别、实习月数、每周天数、实习转正和经验要求。

- `social_full_time→社招全职`、`campus→校园招聘`、`internship→实习生`、`part_time→兼职`；
- 只有组内全部当前值仍等于快照时，才允许应用非空 recruitment type；
- 手动切换与建议切换调用同一个页面本地函数，沿用现有清理：清空薪资上下限和年薪月数；切到实习生时把实习转正重置为未确认；
- 建议不提供薪资、届别、实习月数、每周天数或转正事实，不能自行补值；
- 组内任一项在解析期间被用户修改，保留整组，避免新类型隐藏或改变用户刚编辑字段的含义。

### 8.4 办公方式耦合组

组内包含办公方式和办公地点：

- `onsite→现场`、`hybrid→混合`、`remote→全远程`；
- 组内任一字段被用户修改时，两条建议都不应用；
- 建议为全远程时，设全远程、清空办公地点，并禁用原位置的办公地点控件；
- 建议为现场/混合时，只在 `office_location` 非空时填入地址；
- 只有地址建议、没有办公方式建议时，可以在组仍等于快照时只填地址；
- 用户手动选择全远程走同一清理函数；从全远程切回现场/混合时重新启用地址，但不恢复旧地址；
- 全远程发布校验不要求地址，payload 发送空字符串；其他办公方式地址必填。

### 8.5 工作城市与 Catalog

工作城市文本与 `地点引用` 是一个耦合组：

- 上传时已有 canonical 地点引用，本轮 location source suggestion 不覆盖该组；
- 上传时没有引用，且当前城市文本和引用仍等于快照时，把非空 `location_source_name` 写入城市搜索框、保持引用为空并触发现有候选查询；
- 用户必须点击真实 Location 候选取得引用后才能发布；模型文本不能算选择完成。

`category_source_name` 不进入岗位字段，也不修改类别引用：

- succeeded 时若该值非空，复用 `轻提示` 显示 `AI 识别的职位类别是「…」，请手动选择`；
- 不增加常驻 UI，不自动打开选择层，不选择搜索第一项；
- Backend 第一步必须同时要求类别展示值与真实 `类别引用`；没有引用不能进入下一步；
- 新轮、失败或发布 payload 不保存该提示文本。

`keywords` 在当前 UI 无合法编辑入口，本轮忽略，不恢复关键词控件。

## 9. 状态与错误呈现

### 9.1 原位置横幅

只改变现有 `代理横幅` 的 props，不增加页面节点：

| 状态 | 横幅语义 |
| --- | --- |
| idle | `把 JD 给我，这张表我来填` / `上传 JD ›` |
| uploading | `正在上传 JD`；动作 guard 为 no-op |
| pending/processing | `正在识别 JD`；允许重新上传开始新轮 |
| succeeded | `已识别，请检查建议` / `重新上传 ›` |
| create/read 可重试失败 | 第 9.2 节对应安全文案 / `重试 ›` |
| create/read 不可重试错误（`retry:'none'` 且 `error` 非空） | 第 9.2 节对应安全文案 / `重新上传 ›` |
| 后端 terminal failed | `failure_code` 对应的第 9.2 节安全文案 / `重新上传 ›` |

表单在所有状态下都可编辑；不新增全屏 loading、进度条、状态卡或结果面板。

### 9.2 JD 专用闭合错误文案

不得把未知后端 message、request ID、provider、模型输出或堆栈交给通用回退直接上屏：

| code / 情况 | 文案 |
| --- | --- |
| 本地扩展名/MIME 不合法 | `请选择 PDF 文件` |
| `invalid_pdf` | `仅支持有效、未加密且不含主动内容的 PDF` |
| `job_draft_import_too_large` | `文件过大，请选择较小的 PDF` |
| `document_too_complex` | `内容过多或过于复杂，请换一份 PDF` |
| `processing_consent_required` | `请重新确认后再继续` |
| `upload_in_progress` / `idempotency_in_progress` | `JD 正在上传，请稍后重试` |
| `idempotency_conflict` | `上传意图已变化，请重新选择文件` |
| `parser_invalid_output` | `未能识别这份 JD，可重新上传或手动填写` |
| `parser_temporarily_unavailable` | `识别服务繁忙，请稍后重试或手动填写` |
| `job_draft_import_not_found` | `这次识别已失效，请重新上传` |
| `storage_unavailable`、HTTP 503、网络错误 | `JD 服务暂时不可用，请稍后重试或手动填写` |
| `invalid_response` | `服务返回异常，请稍后重试` |
| 其他未登记错误 | `JD 服务暂时不可用，请稍后重试或手动填写` |

错误不会清空表单、回退 Mock 或应用半份建议。当前 401 由操作层统一清账号；页面不重复 toast 登录错误。

## 10. 测试设计

### 10.1 数据源合同测试

新增 `src/数据/招聘数据源/JD导入.test.ts`，覆盖：

- POST path、显式稳定幂等键、严格信封和 multipart 恰好两个 part；
- consent 字符串值、浏览器 boundary、不发送 display name；
- 空 MIME PDF 规范为 `application/pdf`；
- GET path grammar、URL 编码和 `不缓存: true`；
- 四个合法状态及 succeeded 完整建议；
- 每种状态矛盾、JSON null 代替 omitted、未知字段/枚举、非法 ID/时间和错误数组成员全部 `invalid_response`。

根 facade 测试断言第十五个领域存在且其他领域不变。

### 10.2 操作和 Provider 测试

新增 `src/状态/后端/JD导入操作.test.ts` 并扩充 `src/状态/应用状态.test.ts`：

- Backend + recruiter 参数原样透传；Mock、无后端、非 recruiter 零网络；
- 当前会话 401 调统一清理；旧请求迟到成功、失败或 401 返回 `已换代` 且不污染新会话；
- Provider 同时暴露创建和读取方法，防止只添加 TypeScript 接口而漏掉运行时 spread。

### 10.3 页面测试

扩充 `src/屏幕/发布岗位.test.tsx`：

- 非 PDF 零副作用、input 可重选同文件、Mock 零 consent/零请求；
- consent 取消零 mutation，双击确认只发一次 POST；
- POST 的四种初始状态、pending→processing→succeeded、四个 parser failure code；
- POST 失败复用 File/key，GET 失败只重试同一 import ID；
- setTimeout 不重叠，页面隐藏暂停、恢复立即读、卸载停止；卸载后再次派发 `visibilitychange` 也必须零 GET；
- POST/GET 仅对第 7 节闭合集合中的临时错误显示对应重试动作；确定性失败不得暴露会重复同一失败请求的“重试”；
- 新合法文件使旧轮迟到成功、失败和提示全部失效；
- 普通字段 compare-and-fill、`null` 不清空、invalid response 零部分应用；
- 招聘类型、办公方式和城市组任一成员被用户修改时整组不覆盖；
- 已有 canonical Location ref 不被 source text 覆盖；类别建议只调用轻提示且不造 ref；
- Backend 没有类别/地点引用不能继续或发布；
- 全远程地址控件仍占原位置但为空且禁用，切回后恢复必填且不恢复旧地址；
- import succeeded 不调用 `发布岗位`，只有用户最终点击发布才调用。

### 10.4 数据源模式 E2E

在 `e2e/数据源模式.spec.ts` 增加一条拦截式回归：

- POST fixture 返回合同要求的 202，并断言 multipart 两个 part 和幂等 header；
- GET 依次返回 pending、processing、succeeded；
- 建议进入可编辑表单，类别与城市仍需真实候选；
- 用户补齐其他字段并主动发布后才出现 Job POST；
- terminal failed 后手填仍可用。

这条 E2E 验证浏览器到 HTTP 形状，不证明真实后端已经部署。

### 10.5 验证与冻结门禁

实施至少运行：

```bash
npm test -- src/数据/招聘数据源/JD导入.test.ts src/数据/HTTP招聘数据源.test.ts
npm test -- src/状态/后端/JD导入操作.test.ts src/状态/应用状态.test.ts
npm test -- src/屏幕/发布岗位.test.tsx
npm run test:e2e:data-source -- --grep "JD 建议稿导入"
npm test
npm run typecheck
npm run lint
npm run build
```

并以 diff 门禁确认：没有 CSS、`src/组件/**`、新增 UI 组件或布局结构变化。测试不得通过更新视觉基线掩盖越界。

## 11. 非目标与刻意延后

- 不修改后端 API、数据库、worker、对象存储或模型 prompt。
- 不支持 DOC、DOCX、TXT；后端合同只有 PDF。
- 不增加导入历史、rename、replace、download、cancel 或跨刷新恢复。
- 不持久化文件、建议、import ID、幂等键或页面状态。
- 不自动保存、自动发布岗位或自动选择 Catalog 第一项。
- 不恢复关键词 UI，不消费建议中的 keywords。
- 不重构附件简历、候选预填、HTTP 客户端或整张岗位表单。
- 不建立通用文档导入、通用 dirty/touched 表单或全局轮询框架。
- 不新增配置项、依赖、状态基础设施或设计系统能力。
- 不修改编辑岗位流程；编辑态继续没有 JD 入口。
- 不在本轮处理导入任务的服务端取消语义。

只有出现至少第二个具有相同“创建任务—轮询—页面快照合并”生命周期的真实产品功能、JD 明确要求跨刷新继续、或页面级实现产生已测量的重复故障时，才重新评估通用抽象、全局持久化或取消能力。只有后端新增可信的 canonical Catalog ID 合同，才重新评估自动目录选择。

## 12. 最小性说明

本方案新增的每个边界都有当前用例：

- 窄 JD 数据源用于严格隔离新 POST/GET 合同；
- 薄操作工厂用于复用既有账号/角色/session 安全边界；
- 页面 generation、import ID 和 mounted fence 用于隔离同页多轮与卸载竞态；
- 页面快照用于保护解析等待期间的用户编辑；
- 三个耦合组用于防止类型、办公方式和 Catalog 字段产生真实隐藏覆盖；
- `retry:create|read|none` 用于保证结果未知时不会错误创建第二个任务。

仓库已有的 `useP8导出轮询` 不直接复用：它的公开输入绑定 `P8DataExport` 状态，打开即先 GET，并冻结为 2/4/8/10 秒退避；JD 必须先完成 consent/POST，随后才按固定约 3 秒读取，还要把结果交给页面 generation/import ID/快照合并。为复用而给该 P8 hook 增加状态和节拍配置会修改已稳定的共享机制，并为本轮唯一新用例增加公共参数面。因此本轮保留页面本地轮询；只有出现第二个同样需要“固定节拍 + 页面快照合并”的生产用例时再评估抽取。

除此之外不新增公共抽象、全局状态、持久化、视觉组件或样式。该范围能够完整满足当前 JD PDF 自动填表需求，同时保持 PM 已交付 UI 不变。
