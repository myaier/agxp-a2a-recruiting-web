# JD PDF 建议稿导入前端接线 Handoff

> **给前端 Coding Agent：** 这是一个独立、前端侧的实现任务。请从最新 `main` 建功能分支，按 TDD 完成。不要索要此前聊天、截图或测试机器；本文包含实现所需合同、边界和验收标准。

**目标：** 招聘方在“发布岗位”首屏选择一份 JD PDF、明确同意模型处理后，前端调用现有 BFF 创建导入任务并轮询结果，把安全可映射的字段作为**可编辑建议稿**填入当前表单。导入不自动发布岗位；用户仍需补齐 Catalog 选择和其他人工字段并主动点击发布。

**最小方案：** 复用现有 `HTTP客户端`、操作工厂、`确认层` 和发布岗位表单；新增一个小型 JD 导入数据域与操作域。导入运行态只留在发布岗位页面内存，不复制附件简历的库、替换、下载、持久化恢复等能力，也不建立通用“文档导入框架”。

## 0. 基线与分支事实

- 前端仓库：`agxp-a2a-recruiting-web`
- 核查基线：`main` / `origin/main`，commit `86125819`
- 当前 `main` 已有 JD 横幅和隐藏文件框，但选中文件后只显示 toast；`accept` 仍包含 PDF/DOC/DOCX/TXT，没有真实 API 调用。
- 当前所有本地和远端 ref 均没有 `src/数据/招聘数据源/JD导入.ts` 或 `src/状态/后端/JD导入操作.ts`。也就是说，原 onboarding handoff 的 Task 8 **没有独立实现分支，也没有合入 main**。
- 后端合同核查源：`agxp-server` 分支 `scope/jd-pdf-upload-feature-parity`，commit `2be8c2748`，OpenAPI 位于 `apps/recruitment-bff/openapi/mobile-v1.yaml`。
- 后端源码能力已完成；但“某个环境已部署该 commit、迁移、对象存储、模型配置和后台 worker”不由前端仓库证明。真实环境 E2E 前先向发布 owner 确认。

## 1. 用户流程

```text
点击“上传 JD”
  → 只允许选择 PDF
  → 本地预检；尚未发请求
  → 弹出模型处理确认层
  → 用户取消：零 mutation，继续手填
  → 用户同意：POST 创建导入任务
  → pending / processing：页面约每 3 秒 GET 一次
  → succeeded：把建议安全地应用到仍未被用户改动的字段
  → failed：显示可理解错误，保留现有表单和手填路径
  → 用户补齐类别、城市、薪资等字段并主动发布岗位
```

页面卸载时只停止前端轮询，不声称取消服务端任务。新选择一份 PDF 时，上一轮任何迟到成功或失败都必须作废。

## 2. 后端合同（直接按此实现，不自行猜测）

### 2.1 创建导入

```http
POST /api/v1/recruiter/job-draft-imports
Idempotency-Key: <16–128 visible ASCII chars>
Content-Type: multipart/form-data; boundary=...

file=<application/pdf binary>
processing_consent_confirmed=true
```

- 成功状态码：`202`。
- multipart **只能**有 `file` 和 `processing_consent_confirmed` 两个 part；不要发送 `display_name` 或其他字段。
- consent 必须是字符串字面量 `"true"`。
- 不要手写 `Content-Type` boundary，交给浏览器 `FormData`。
- 同一次选文件意图生成一个稳定幂等键；HTTP 客户端的受控重试、用户对同一待处理文件的显式重试都复用该键。选择新文件才生成新键。

### 2.2 读取导入

```http
GET /api/v1/recruiter/job-draft-imports/{import_id}
```

成功状态码为 `200`，响应声明 `Cache-Control: no-store`；前端请求选项也使用现有 `不缓存: true`。状态闭合集合：

```ts
type BFFJD导入状态 = 'pending' | 'processing' | 'succeeded' | 'failed';
type BFFJD导入失败码 =
  | 'invalid_pdf'
  | 'document_too_complex'
  | 'parser_invalid_output'
  | 'parser_temporarily_unavailable';
```

状态不变量必须在 decoder 中 fail closed：

- `pending | processing`：没有 `suggestion`，没有 `failure_code`。
- `succeeded`：有 `suggestion`，没有 `failure_code`。
- `failed`：有 `failure_code`，没有 `suggestion`。
- 后端缺席字段是 omitted，不是 JSON `null`。
- 未知枚举、未知字段、非法 `import_id`、非法时间或状态矛盾统一抛 `BFF错误(200, 'invalid_response', ...)`，不得接受半份建议。

### 2.3 建议 DTO

```ts
interface BFFJD建议 {
  title: string | null;
  recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time' | null;
  workplace_mode: 'onsite' | 'hybrid' | 'remote' | null;
  office_location: string | null;
  description: string | null;
  requirements: string | null;
  education_requirement: 'none' | 'associate' | 'bachelor' | 'master' | 'doctorate' | null;
  experience_requirement:
    | 'none'
    | 'one_to_three_years'
    | 'three_to_five_years'
    | 'five_plus_years'
    | 'ten_plus_years'
    | null;
  category_source_name: string | null;
  location_source_name: string | null;
  keywords: string[];
}

interface BFFJD导入 {
  import_id: string; // ^jdi_[0-9a-f]{32}$
  status: BFFJD导入状态;
  created_at: string;
  updated_at: string;
  suggestion?: BFFJD建议;
  failure_code?: BFFJD导入失败码;
}
```

后端不会返回 Catalog ID、公司声明、薪资、硬性条件或私密筛选偏好。

## 3. 文件地图

| 文件 | 改动 |
| --- | --- |
| `src/数据/BFF契约.ts` | 增加上述 JD import/suggestion 闭合类型 |
| `src/数据/招聘数据源/JD导入.ts` | 新增 POST/GET、严格 decoder |
| `src/数据/招聘数据源/JD导入.test.ts` | multipart、幂等、no-store、DTO 不变量测试 |
| `src/数据/HTTP招聘数据源.ts` | 把 `JD导入数据源` 加入根 facade 并创建实例 |
| `src/状态/后端/类型.ts` | 增加页面可调用的 `JD导入操作`，并入 `应用操作` |
| `src/状态/后端/JD导入操作.ts` | Backend-only 调用、会话 fence、401 统一清理 |
| `src/状态/后端/JD导入操作.test.ts` | Backend/Mock、401、换代、参数透传测试 |
| `src/状态/应用状态.tsx` | import 并 spread `创建JD导入操作(deps)`；这是原 Task 8 遗漏的关键运行时接线 |
| `src/状态/应用状态.test.ts` | 断言 Provider 暴露两个 JD 操作方法 |
| `src/屏幕/发布岗位.tsx` | PDF 选择、consent、页面内存状态、轮询、建议应用、remote 规则 |
| `src/屏幕/发布岗位.test.tsx` | 页面全流程和竞态保护 |
| `e2e/数据源模式.spec.ts` | 真实 HTTP 形状的导入到手动发布回归 |

如仅为状态文案需要少量样式，可修改 `src/屏幕/发布岗位.module.css`；不要为此新建设计系统组件。确认弹层直接复用 `src/组件/确认层.tsx`，PDF 预检可复用 `校验附件PDF(file, null)`，不要硬编码服务端文件大小。

## 4. 数据层与操作层要求

建议的数据源接口：

```ts
export interface JD导入数据源 {
  创建JD导入(file: File, idempotencyKey: string): Promise<BFFJD导入>;
  读取JD导入(importId: string): Promise<BFFJD导入>;
}
```

`创建JD导入` 必须：

- 构造仅含两个 part 的 `FormData`；
- 调用现有 HTTP 客户端并传 `幂等: true, 幂等键: idempotencyKey`；
- 不新增 fetch 包装器，不复制 HTTP 客户端自动重试逻辑；
- 严格解码 `result`，不信任 TypeScript cast。

`读取JD导入` 必须：

- 对 `importId` 做本地 grammar 校验后再拼 URL；
- 使用 `不缓存: true`；
- 严格解码同一 DTO。

建议的操作接口：

```ts
export interface JD导入操作 {
  创建JD导入(file: File, idempotencyKey: string): Promise<BFFJD导入>;
  读取JD导入(importId: string): Promise<BFFJD导入>;
}
```

操作层不需要增加全局 `后端状态`。它只负责：

- `backend + recruiter` 才调用数据源；Mock 模式零网络、零假建议；
- 请求前捕获现有 subject/session generation fence；
- 当前 fence 的 401 走既有 `清账号状态`；旧请求迟到的 401 不得登出新会话；
- fence 已换代时不得让返回值污染新页面状态，可返回明确的“已换代”结果或抛内部可识别错误，但页面必须静默丢弃。

页面不得直接调用 `HTTP招聘数据源`；必须经 `应用操作`。不要照搬附件简历的权威库、全局快照、replace/delete/download 或浏览器恢复元数据，它们不是 JD 一次性建议稿的需求。

## 5. 发布岗位页面状态与轮询

运行态仅放在 `发布岗位.tsx` 内存中，建议最小形状：

```ts
type JD导入阶段 = 'idle' | 'uploading' | 'pending' | 'processing' | 'succeeded' | 'failed';

interface JD导入页面状态 {
  generation: number;
  phase: JD导入阶段;
  file: File | null;
  idempotencyKey: string | null;
  importId: string | null;
  error: string | null;
}
```

实现要求：

- input 改为 `accept=".pdf,application/pdf"`；选中文件立即清空 input value，允许重新选同一文件。
- 本地预检后只设置“待确认文件”，**consent 前不得 POST**。
- 确认层文案：
  - 标题：`允许 AI 识别这份职位描述？`
  - 正文：`这份 PDF 将发送给受控模型服务进行职位信息识别。确认后才会上传并开始处理。`
  - 主按钮：`同意并继续`
- `uploading` 时禁用重复同意和重复上传，设置可访问的 `aria-busy`。
- POST 可能直接返回四种状态中的任何一种；不要假设一定先 `pending`。
- `pending | processing` 时约每 3 秒读取一次；使用 `setTimeout` 链而不是重叠的 `setInterval`，同一时刻最多一个 GET。
- 页面不可见时暂停定时读取，恢复可见后立即读一次；卸载、新文件、终局状态时清 timer。
- 每轮选择增加 generation。每次 POST/GET 回来后同时核对 generation、import ID 和页面仍挂载；旧轮成功、失败、401 之外的提示都不得落到新轮。
- 不把 PDF、全文、建议 DTO、import ID 或状态写入 localStorage/sessionStorage。
- Mock 模式可保留现有“已选择，可手动填写”的演示反馈，但绝不能伪造解析成功或请求 Backend。

推荐状态文案：

| 阶段 | 文案 |
| --- | --- |
| uploading | `正在上传 JD` |
| pending / processing | `正在识别 JD` |
| succeeded | `已识别，请检查建议` |
| failed | `识别失败，可重新上传或手动填写` |

页面始终保留手填能力，不要用全屏 loading 锁住岗位表单。

## 6. 建议字段映射与覆盖保护

### 6.1 允许自动写入的字段

| BFF 字段 | 页面字段 / 映射 |
| --- | --- |
| `title` | `岗位名称` |
| `recruitment_type` | `social_full_time→社招全职`、`campus→校园招聘`、`internship→实习生`、`part_time→兼职` |
| `workplace_mode` | `onsite→现场`、`hybrid→混合`、`remote→全远程` |
| `office_location` | `办公地` |
| `description` | `职位描述` |
| `requirements` | `职位要求` |
| `education_requirement` | `none→不限`、`associate→大专`、`bachelor→本科`、`master→硕士`、`doctorate→博士` |
| `experience_requirement` | `none→不限`、`one_to_three_years→1-3 年`、`three_to_five_years→3-5 年`、`five_plus_years→5 年以上`、`ten_plus_years→10 年以上` |

`null` 表示 PDF 没有说，绝不能因此清空页面字段。

### 6.2 不能自动制造的事实

- `category_source_name`：只在职位类别选择器附近展示 `AI 识别建议：…`。不得写入 `类别引用`，不得按文本猜 ID，不得自动选择搜索第一项。
- `location_source_name`：可以填入“工作城市”搜索框并触发现有候选查询，但必须清空 `地点引用`，用户点击真实候选后才算有效。
- `keywords`：当前岗位 UI 已刻意移除关键词编辑，本期忽略；不要恢复关键词控件。
- 薪资、年薪月数、公司声明、校招届别、实习周期/出勤/转正、硬性条件、私密筛选均由用户手填。

### 6.3 防止覆盖用户在解析期间的编辑

用户同意上传、POST 起飞前，捕获所有可建议字段及耦合字段的表单快照。成功时只应用“当前值仍等于该轮快照”的字段；不同说明用户在等待期间改过，保留用户值。

- 文本字段逐字段 compare-and-fill。
- `招聘类型 + 薪资上下限 + 年薪月数 + 实习转正` 作为一个耦合组。只有整组仍等于快照时才应用建议，并复用手动切换招聘类型的既有清理规则。
- `办公方式 + 办公地` 作为一个耦合组，避免 remote 建议清掉用户刚输入的地址。
- `工作城市 + 地点引用` 作为一个耦合组；只有两者仍等于快照才写建议文本并清引用。
- `category_source_name` 只是当前导入轮的提示文字，新一轮开始或失败时更新/清除，不进入 Job payload。

不要用一个迟到结果整体 `setState` 覆盖整张表。

## 7. 同步闭合 remote 地址规则

这是本功能必须一起完成的接线，不再等待后端：后端已允许 `workplace_mode=remote` 时 `office_location` 为空。

- 选择或导入 `全远程`：清空并隐藏/禁用“办公地点”，表单校验不要求该字段。
- 从 `全远程` 切回 `现场/混合`：办公地点恢复可填且必填，不恢复旧地址。
- Job payload 在全远程时发送合同允许的空办公地址。
- 现有 Backend 发布校验除 `地点引用` 外，还必须要求真实 `类别引用`；不能让 `category_source_name` 或展示字符串绕过 Catalog 选择。

## 8. 错误文案闭合集合

不得直接上屏后端英文 message、request ID、provider 名、模型原始输出或堆栈。

| code / 情况 | 用户文案 |
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
| `storage_unavailable` / 503 / 网络错误 | `JD 服务暂时不可用，请稍后重试或手动填写` |
| `invalid_response` | `服务返回异常，请稍后重试` |

对结果未知或临时网络失败，保留内存中的同一 `File + Idempotency-Key`，允许显式重试创建，以便后端 replay 原 import；不要换 key 自动制造第二份任务。

## 9. 分任务实施清单

### Task 1：冻结数据合同并接入根 HTTP facade

- [ ] 先写 `JD导入.test.ts` 失败测试。
- [ ] 验证 POST 路径、稳定幂等键和 multipart 恰好两个 part；数据源模式 E2E 返回合同要求的 `202`。
- [ ] 验证 GET path grammar、URL 编码和 `不缓存: true`。
- [ ] 覆盖四个合法状态与所有状态矛盾、未知枚举、额外字段。
- [ ] 在 `HTTP招聘数据源.ts` 加入第十五个域，不改变其他十四个域。

```bash
npm test -- src/数据/招聘数据源/JD导入.test.ts src/数据/HTTP招聘数据源.test.ts
```

### Task 2：增加应用操作的真实运行时接线

- [ ] 先写 `JD导入操作.test.ts`。
- [ ] 实现 Backend-only、recruiter guard、session fence 和 401 清理。
- [ ] 修改 `类型.ts` 的 `应用操作` 交集。
- [ ] 修改 `应用状态.tsx`，实际 import/spread factory。
- [ ] 修改 `应用状态.test.ts`，防止“类型存在但 Provider 没暴露”的假接线。

```bash
npm test -- src/状态/后端/JD导入操作.test.ts src/状态/应用状态.test.ts
```

### Task 3：接发布岗位页面上传、确认和轮询

- [ ] 将 input 收紧到 PDF。
- [ ] 复用 `确认层`；取消确认时零请求。
- [ ] 实现页面内存状态、稳定幂等键、busy 防重、单飞轮询和 generation fence。
- [ ] 失败后保留手填与重新上传；卸载停止轮询。
- [ ] Mock 模式零真实请求、零假解析。

### Task 4：应用建议并闭合 Catalog / remote 边界

- [ ] 按第 6 节表格完成闭合枚举映射。
- [ ] 用上传起飞快照防止覆盖解析期间的用户编辑。
- [ ] 类别只显示文本建议；城市只触发候选搜索，均不制造 ID。
- [ ] Backend 下一步/发布必须要求 `类别引用` 和 `地点引用`。
- [ ] 完成全远程办公地址条件逻辑。
- [ ] 成功只预填，不调用 `发布岗位`。

```bash
npm test -- src/屏幕/发布岗位.test.tsx
```

### Task 5：数据源模式 E2E 与全量验证

- [ ] E2E 拦截 POST，断言 multipart 两个 part 和幂等 header。
- [ ] GET 依次返回 `pending → processing → succeeded`。
- [ ] 断言建议进入表单、Catalog 仍要求用户选真实候选。
- [ ] 用户补齐字段后手动点击发布；只有此时才出现 Job POST。
- [ ] 增加 failed 分支，断言手填仍可用。

```bash
npm run test:e2e:data-source -- --grep "JD 建议稿导入"
npm test
npm run typecheck
npm run lint
npm run build
```

建议单一功能提交：

```bash
git add src/数据/BFF契约.ts src/数据/招聘数据源/JD导入.ts src/数据/招聘数据源/JD导入.test.ts src/数据/HTTP招聘数据源.ts src/状态/后端/类型.ts src/状态/后端/JD导入操作.ts src/状态/后端/JD导入操作.test.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts src/屏幕/发布岗位.tsx src/屏幕/发布岗位.test.tsx src/屏幕/发布岗位.module.css e2e/数据源模式.spec.ts
git commit -m "feat: import editable job drafts from JD PDFs"
```

## 10. TEST_DELTA

新增一个外部可见行为，必须补数据源合同测试、操作接线测试、页面竞态/覆盖保护测试和数据源模式 E2E；不新增测试基础设施，不要求视觉基线重录，除非实现实际改变了既有页面布局而非只增加状态文案。

关键页面用例至少覆盖：

- 非 PDF 零副作用；consent 取消零 mutation；双击确认只发一个 POST。
- POST 四种初始状态、轮询成功、四个 parser failure code、GET 404/503。
- 新文件使旧轮所有迟到回包失效；卸载后不再 GET；隐藏页暂停、恢复页立即继续。
- 用户在 parsing 时编辑 title/类型/薪资/城市/办公地，成功建议不得覆盖这些修改。
- `null` 不清字段；未知枚举导致整包 `invalid_response`，不应用半份结果。
- 类别/城市建议不制造 ID；没有用户 Catalog 选择不能发布。
- remote 可空办公地址；切回 onsite/hybrid 后恢复必填。
- import 成功本身不调用 Job POST。

## 11. 明确非目标

- 不改后端 API、数据库、worker、对象存储或模型 prompt。
- 不支持 DOC/DOCX/TXT；后端合同目前只接受 PDF。
- 不增加导入列表、rename、replace、download、cancel 或刷新恢复。
- 不把 JD 文件或模型建议持久化到浏览器。
- 不自动发布岗位，不自动选 Catalog 第一项，不让模型文本冒充权威 ID。
- 不恢复当前已移除的关键词 UI。
- 不重构附件简历/简历预填，也不抽象通用 document-import 框架。

## 12. 完成定义

只有以下条件同时满足，Task 8 才算完成：

1. 最新 frontend `main` 上新建的功能分支包含全部数据源、操作、Provider 和页面接线。
2. PDF 在 consent 前零上传；成功建议可编辑且不覆盖解析期间用户修改。
3. Catalog ID 全由用户真实选择；全远程地址规则与后端一致。
4. 任意导入失败都保留手填路径，Backend 失败不回退 Mock。
5. 没有任何路径因“识别成功”自动发布岗位。
6. 本文 Task 1–5 的测试和最终验证命令通过；真实环境 E2E 若因后端目标环境未部署而阻塞，明确记录环境 commit/缺失项，不得把 mocked E2E 当作真实后端已验证。
