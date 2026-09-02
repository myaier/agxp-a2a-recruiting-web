# 前端 Handoff：候选人 Onboarding 简历解析预填（后端依赖增量）

> 本文可以直接发送给另一台机器上的前端 Coding Agent，用于编写实施 Spec/Plan。接收者不需要测试账号、测试文件、浏览器会话、截图或此前聊天记录。本文只使用仓库相对路径，不依赖任何本机路径。

## 1. 仓库、基线与本轮边界

- 前端仓库：`myaier/agxp-a2a-recruiting-web`
- 调查时 `origin/main`：`b2827dae16e89b199b487ab1564246b7b66e34f6`
- 已交付的“我/设置”前端设计分支：`origin/fe-backend-mock-fixes`
- 该分支调查时提交：`22c3be7`
- 该分支只有设计文档 `docs/superpowers/specs/2026-09-02-recruitment-me-settings-frontend-wiring-design.md`，没有产品代码；实施前仍须等待其最终 Plan/Handoff 并校准到最新 `origin/main`。

Coding Agent 开始规划前必须 fetch 最新远端并记录实际基线；上面的 SHA 只用于确认本文调查的是哪一版代码，不能代替现场校准。

### 已由 `origin/fe-backend-mock-fixes` 承接，不得重复规划

该设计已经覆盖：

- 求职侧和用人侧“我的”页面 P5 权威统计，包含清除 Backend seed 中的 Mock MatchCase/候选/归档、`N+` 分页下界和移除 `186`；
- candidate contact events、头像、email/WeChat credential、candidate/recruiter role agent settings 的前端接线；
- 交互式短信登录后的角色水合和唯一导航 owner；
- candidate/recruiter 认证摘要、recruiter profile 首写、公司关系合法缺失态；
- 企业披露固定规则文案、招聘角色数据导出文案、组织屏蔽搜索空结果等设置页残余问题。

本 Handoff 现在只保留一个后端依赖交付：候选人首次 onboarding 上传 PDF 后，用解析结果预填后续在线简历表单。原先的“求职意向办公方式必填反馈”不依赖后端，已迁移到 `docs/handoffs/2026-09-02-release-0.2.5-frontend-only-handoff.md`，不得在本文重复规划。

解析预填必须等待对应后端 Handoff 的解析建议读取 API、最终 OpenAPI 和实现提交；当前 `release/0.2.5@45f7323e34f6f6db11faee658144e28d338b36be` 只有 parse status，没有 candidate-visible extracted result，不能提前实施或从其它字段拼装。

本前端工作的唯一 API 依赖是：

`docs/handoffs/2026-09-02-resume-suggestion-api-backend-handoff.md`

`docs/handoffs/2026-09-02-local-ai-runtime-backend-handoff.md` 只提供真实解析的集成环境，不冻结前端 API，也不阻塞基于 deterministic fixture 的实现与合同测试。

## 2. 已确认的当前行为

### 2.1 Onboarding 上传只启动解析，没有预填链路

当前候选 onboarding 第一页是 `src/屏幕/学生分流.tsx`：

- Backend 模式上传调用现有 `创建附件简历` 或 `替换附件简历`；
- 上传时携带处理同意，并自动启动解析；
- `use附件简历刷新` 只轮询附件库里的解析状态；
- 成功状态只包含 `parse_id`，浏览器拿不到结构化解析结果；
- 页面提示“简历已上传，正在识别”，但上传不会阻塞“下一步”；
- 页面文案已经承诺“AI 识别后自动填充”，实际没有任何自动填充发生。

现有前端合同在 `src/数据/BFF契约.ts` 和 `src/数据/招聘数据源/附件简历.ts` 中明确只解码：

```ts
type BFF附件解析状态 =
  | { status: 'not_started' }
  | { status: 'pending' | 'processing'; updated_at: string }
  | { status: 'succeeded'; parse_id: string; updated_at: string }
  | { status: 'failed'; failure_code: string; updated_at: string };
```

在线简历由 `/api/v1/me/resume` 的 profile、summary、skills、experiences、educations、certificates 分区接口持久化。`src/数据/招聘数据源/简历.ts` 会对整份页面模型做 diff，页面每走一步可能保存一次。附件 PDF 与在线简历目前是两个独立 owner。

`src/屏幕/我的简历.tsx` 也允许日常上传、替换、重新解析附件。产品要求是：

- **首次 onboarding 上传：** 解析成功后预填后续表单；
- **日常简历维护上传：** 只维护附件和解析状态，不自动预填、不覆盖在线简历、不弹出应用建议流程。

## 3. 交付：Onboarding 专用解析预填

### 3.1 产品语义

采用“只读建议稿 + 用户逐页确认”的最小方案：

1. 用户可以不上传 PDF，继续手工完成 onboarding。
2. 用户在 `学生分流` 上传或替换 PDF 后，页面继续轮询当前 `file_id + version_id` 的解析状态。
3. 当状态为 `succeeded` 时，只有 onboarding 上下文可以读取对应的候选人可见解析建议。
4. 建议只预填后续 onboarding 表单控件，不直接调用在线简历 mutation。
5. 用户仍按现有页面顺序核对、修改并点击“下一步/保存”；这些动作继续使用既有 `/me/resume` 分区写入和 CAS 语义。
6. 从“我的简历”日常上传、替换或重新解析时，不读取建议、不修改表单状态、不写在线简历。

不得把“解析成功”解释成“用户已经确认并保存在线简历”。

### 3.2 依赖的后端合同

后端将新增 owner-only 的解析建议读取接口。前端 Plan 必须以最终后端 OpenAPI 和实现 Handoff 为准，至少冻结：

- public route、query/path 参数和 exact response envelope；
- `file_id`、`version_id`、`parse_id` 的绑定及 stale 语义；
- profile、summary、skills、experiences、educations、certificates 的字段；
- catalog 引用的 `{id, display_name}` 或 unresolved 状态；
- closed error union；
- 响应不包含手机号、邮箱、微信、地址、PDF 原文、证据摘录、模型信息或内部对象坐标。

前端必须严格解码 exact key set 和闭合枚举，合同漂移时失败关闭，不能回退 Mock，也不能从 PDF 文件名或展示文本猜字段。

### 3.3 Onboarding 状态所有权

不要直接把整份解析建议一次性写进现有在线简历根状态后立刻调用 `保存简历`。现有页面保存函数接收整份页面模型；若所有建议先进入根状态，用户在第一个“基本信息”页面点下一步时，未查看的经历、教育、技能和证书也可能被一起写入服务端。

前端应使用独立的 onboarding 建议状态，至少带：

```text
subject_id
backend environment
file_id
version_id
parse_id
suggestion payload
每个分区是否已应用/是否被用户修改
```

该状态可以复用现有 candidate onboarding session draft 的作用域和清理纪律，但不能混入 Mock 持久化：

- 只存在于 Backend + candidate + 当前 subject；
- 登出、当前会话 401、换 subject、切离 candidate、完成 onboarding 时清除；
- 不保存 PDF bytes、PDF 原文、contact information 或 provider output；
- 同一个 `file/version/parse` 最多应用一次；替换附件后旧建议立即失效；
- 迟到响应必须受现有 subject/role/session generation fence 保护。

### 3.4 分区预填与合并规则

建议按页面首次进入时“逐分区应用”，而不是整份提前落在线简历状态：

- `基本信息`：姓名、开始工作年和其他已有 profile 控件；
- 学历四连页：教育经历中的学历、学校、专业和时间；
- `工作经历`：经历、技能、证书、个人优势等该页可见内容；
- 未被当前 onboarding UI 收集的解析字段不应为了“全量利用”新增页面或隐藏写入。

合并必须遵守：

1. 只填仍为空且未被用户编辑的字段；
2. 已有 `/me/resume` 权威值优先，不能被建议覆盖；
3. 用户在解析等待期间手工填写的值优先；
4. 缺失值保持空，不根据当前日期、默认档或相邻文本推断；
5. 不把解析到的手机号、邮箱、微信、地址写入在线简历或账号 credential；
6. catalog exact match 才能写稳定引用；unresolved 可以显示原文供用户确认，但保存前仍必须通过现有目录选择器取得 canonical ID；
7. 证书年份等目标合同允许缺失时保持缺失；前端不得填当前年或 `0`。

用户离开 onboarding 后再从日常页面上传新 PDF，不得重新触发上述合并。

### 3.5 Pending、失败与重试

- 无附件：直接走手填。
- `pending/processing`：明确显示“正在识别”，不得悄悄以空建议继续并声称已预填。
- 解析在用户准备进入简历表单时仍未完成：允许等待/刷新状态，也必须提供继续手填的路径，不能永久阻断 onboarding。
- `failed`：显示现有闭合失败文案并允许重新上传或继续手填。
- 建议读取 401：走统一账号清理。
- stale version/parse：丢弃旧建议，重读附件库，不把旧 PDF 内容应用到新版本。
- 网络失败：保留当前手工输入并允许重试；不得清空表单或回退 Mock。

### 3.6 必须覆盖的前端测试

Coding Agent 的 Plan 至少要安排以下失败测试和最小实现：

1. 新解析建议数据源：exact URL、参数、strict decoder、closed error mapping。
2. onboarding 上传成功、解析成功后只读取一次建议，并按 `file/version/parse` 绑定。
3. `pending/processing` 不提前应用；`failed` 可以继续手填。
4. 用户先手填、解析后返回时不覆盖用户字段。
5. 已有在线简历字段不被建议覆盖，只补空字段。
6. unresolved 学校/专业/行业不伪造目录 ID，保存前仍要求用户点选 canonical item。
7. 替换附件后旧 parse 的迟到响应不能修改新 onboarding 草稿。
8. 登出、401、切角色和换账号清除建议状态。
9. 完成 onboarding 后清除建议，刷新主壳不会再次应用。
10. `src/屏幕/我的简历.tsx` 的上传、替换、显式重新解析均不调用建议接口，也不改在线简历。
11. Mock 模式零新增请求，现有 fixture 行为不变。
12. 用户逐页确认前没有在线简历 mutation；确认后继续走既有 `If-Match`/幂等和最终权威 GET。

建议重点检查和规划的仓库相对路径：

```text
src/屏幕/学生分流.tsx
src/屏幕/学生分流.test.tsx
src/屏幕/基本信息.tsx
src/屏幕/最高学历.tsx
src/屏幕/毕业院校.tsx
src/屏幕/选专业.tsx
src/屏幕/就读时间段.tsx
src/屏幕/工作经历.tsx
src/屏幕/我的简历.tsx
src/数据/BFF契约.ts
src/数据/招聘数据源/附件简历.ts
src/数据/招聘数据源/简历.ts
src/状态/领域/候选资料.ts
src/状态/后端/附件简历操作.ts
src/状态/资料持久化.ts
src/状态/应用状态.tsx
src/流程/onboarding配置.ts
```

实际文件拆分由 Coding Agent 基于最新主干确定；不要为了本功能创建统一“大 Profile”或重写已有简历 owner。

## 4. 依赖、实施顺序与冲突面

推荐顺序：

1. 后端先按 `2026-09-02-resume-suggestion-api-backend-handoff.md` 完成解析建议读取合同与实现，并提交精确 commit、OpenAPI 与 fixture。
2. `origin/fe-backend-mock-fixes` 的实施 owner 完成其 Spec/Plan，给出最终前端提交。
3. 本轮解析预填前端 Plan 同时校准上述两个精确提交后再实施。

解析预填与 `fe-backend-mock-fixes` 可能共同修改 `src/状态/应用状态.tsx`、会话 fence、数据源组合和 candidate hydration。不要让两个 Agent 在未冻结接口和未校准基线时并行修改同一个前端 worktree。

## 5. 明确非目标

- 不重复实现 `origin/fe-backend-mock-fixes` 已覆盖的“我的”假统计或设置页接线。
- 不实现求职意向办公方式必填反馈；该纯前端任务已迁移到 release/0.2.5 前端独立批次。
- 不实现用人侧 JD 上传 UI；产品经理会另行提供前端设计。
- 不调整附件简历替换/删除入口的可发现性。
- 不让日常简历维护自动应用解析结果。
- 不由 worker 或前端自动覆盖 `/me/resume`。
- 不把附件 PDF 和在线简历合并成一个资源。
- 不新增 candidate 实名推断。
- 不回退 Mock，不提交真实简历、测试账号、认证状态或 provider 原始输出。

## 6. 完成标准

- [ ] 首次 candidate onboarding 上传 PDF 后，解析成功可以预填后续表单。
- [ ] 用户逐页看到、修改并确认后才写入在线简历。
- [ ] 已有服务端值和用户手填值不会被迟到建议覆盖。
- [ ] 日常“我的简历”上传/替换/重新解析不会预填或覆盖在线简历。
- [ ] 解析失败、未完成或建议读取失败时仍能明确选择继续手填。
- [ ] Backend 与 Mock 行为完全隔离。
- [ ] 定向测试、`npm run typecheck`、`npm run lint`、`npm run build` 通过。
