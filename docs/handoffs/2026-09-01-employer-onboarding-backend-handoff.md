# Employer Onboarding 后端修复 Implementation Plan

> **给 Coding Agent：** REQUIRED SUB-SKILL：使用 `superpowers:test-driven-development`；执行本计划前完整阅读仓库根 `AGENTS.md`、`CLAUDE.md`、`docs/testing/WORKTREE_TEST_HANDOFF.md` 和 `docs/testing/GLOBAL_TEST_CASES.md`。本文自包含，不要索要原测试机器、职位材料、浏览器状态或之前的聊天记录。

> **状态复核（2026-09-04 18:44 +08:00）：已完成。** remote 空办公地址、JD 建议稿导入领域/API/worker 与集成测试已随 `45f7323e` 集成进入后端发布线，其中 JD 公开合同最终提交为 `7f1200a5b`；两者均已确认是后端 `origin/release/0.2.5@21e34ff04` 的祖先。文中“profile 404、公司声明、requirements 属于前端归因”的结论仍有效；后文未勾选框仅作历史实施记录。

**仓库：** `myaier/agxp-monorepo`

**目标：** 只修改确实属于后端的两条能力：让 remote 岗位合法携带空 `office_location`；为招聘方提供安全、异步、只生成可编辑建议稿的 JD PDF 导入 API。不要修改已正确工作的 recruiter profile 首写、岗位公司声明和 `requirements` 合同。

**最小方案：** remote 地址是现有 Job 合同的小范围条件校验变更。JD 导入是独立的新产品能力，沿用现有 PDF 校验、私有对象存储、异步 worker、严格模型 schema、幂等和加密结果模式，但建立 recruiter-owned 新领域；不重构候选简历解析为通用框架，也不把建议稿自动写入 jobs。

## 先冻结归因，避免误修

以下现象不是后端缺陷：

1. `GET /api/v1/recruiter/profile` 对没有 profile 的新账号返回 404 是既有明确语义。
2. `PATCH /api/v1/recruiter/profile` 已支持 `If-Match: "0"` 首写，要求 `public_name` 非空，并返回 revision 1。Hermetic E2E 的 `run_organization_identity_flow` 已覆盖。
3. `hiring_organization_claim.display_name` 非空是 Job 合同和 publisher verification 的必要输入。
4. `description` 与 `requirements` 是两个独立、均必填、各最多 10,000 字符的岗位字段。
5. 没有 verified affiliation 的自由文本公司声明不是 canonical Organization，不应为其合成企业档案。

因此不要：

- 把 profile GET 404 改 200 空对象；
- 新增 profile POST；
- 删除公司显示名或 requirements 校验；
- 让后端复制 description 到 requirements；
- 为未认证公司声明自动建 Organization；
- 增加 `/me` onboarding flag 来掩盖前端路由问题。前端可用 profile 是否存在作为最小完成标记。

## 已知合法与失败请求

Profile 首写的正确合同：

```http
PATCH /api/v1/recruiter/profile
If-Match: "0"
Content-Type: application/json

{"public_name":"Example Recruiter","title":"Hiring Lead"}
```

失败的 JobCreate 关键字段：

```json
{
  "workplace_mode": "remote",
  "office_location": "远程办公，无固定办公地点",
  "hiring_organization_claim": { "display_name": "", "legal_name": null },
  "description": "非空职位描述",
  "requirements": ""
}
```

其中空公司名和空 requirements 应继续 422；唯一需要调整的是 remote 用户不应被迫编造实体地址。

---

## Task 1：把办公地址改成 workplace-aware 条件校验

**Files:**
- Modify: `apps/recruitment/internal/job/types.go`
- Modify: `apps/recruitment/internal/job/service_test.go`
- Modify: `apps/recruitment/internal/job/repository.go`
- Modify: `apps/recruitment/internal/job/repository_test.go`
- Modify: `apps/recruitment/openapi/mobile-resources-v1.yaml`
- Modify: `apps/recruitment-bff/openapi/mobile-v1.yaml`
- Modify as needed: OpenAPI contract tests in both modules

**批准语义：** 字段继续存在于闭合 DTO，避免 wire shape 和数据库列变化；只有非空规则条件化。

```text
workplace_mode=remote           → office_location 可为 "" 或空白，服务端规范保存 ""（不要保存空格）
workplace_mode=onsite|hybrid    → office_location trim 后必须非空
任何模式                        → 非空值最多 300 rune
```

如果代码库现有原则禁止服务端 trim 写入，则要求调用者传 `""`，校验只把全空白视为空；不要悄悄改变所有文本字段的规范化规则。推荐前端提交 `""`，后端原样存空字符串。

- [ ] 在 `service_test.go` 写 create 表格测试：remote + empty 成功；remote + 非空成功；onsite/hybrid + empty 返回 `office_location/must_not_be_blank`；超长在任何模式都失败。
- [ ] 修改 `ValidateCreate`：先判断合法 workplace enum，再调用一个接收 `(workplaceMode, officeLocation)` 的小型校验函数。
- [ ] `ValidateUpdate` 是 sparse 校验，单独看 patch 不能判断有效模式。静态层只检查 office 字符上限；在 `mergeUpdate` 合并 stored row 后，对有效的 `row.workplaceMode + row.officeLocation` 运行同一条件校验。
- [ ] 写 update/repository 测试：onsite→remote 且 address 清空成功；remote→onsite 未提供新地址失败；remote 保持 remote 清空成功；onsite 单独清空失败；失败不 bump revision。
- [ ] 不需要数据库 migration：`jobs.office_location` 是 `TEXT NOT NULL`，空字符串满足现有列约束。
- [ ] 两份 OpenAPI 都保留 `office_location` 在 required property list 中，但 description 明确“remote 可为空，onsite/hybrid 非空”。更新例子至少包含一个 remote + `""`。
- [ ] BFF 只需继续严格解码并透传；如果 handler/client 测试假设非空，更新测试，不在 BFF 重复业务校验。

```bash
tools/cred-sync.sh worktree
tools/dev-env.sh ensure base
tools/test service recruitment
tools/test service recruitment-bff
```

建议提交：

```bash
git add apps/recruitment/internal/job/types.go apps/recruitment/internal/job/service_test.go apps/recruitment/internal/job/repository.go apps/recruitment/internal/job/repository_test.go apps/recruitment/openapi/mobile-resources-v1.yaml apps/recruitment-bff/openapi/mobile-v1.yaml
git commit -m "fix(recruitment): allow empty office for remote jobs"
```

---

## Task 2：先冻结 JD 导入的外部合同

**这是新能力，不与 Task 1 混成一个提交。** 在写 migration/worker 前，先以 OpenAPI + handler contract test 固定最小 API。建议合同如下。

### Public BFF API

```text
POST /api/v1/recruiter/job-draft-imports
  Content-Type: multipart/form-data
  Idempotency-Key: required
  parts:
    file: required application/pdf
    processing_consent_confirmed: required literal true
  → 202 { result: JobDraftImport }

GET /api/v1/recruiter/job-draft-imports/{import_id}
  → 200 { result: JobDraftImport }
  → 404 对 missing/foreign 统一
```

MVP 不需要 list、rename、replace、download 或 cancel。一个上传就是一个短期 import。采用固定 24 小时保留期，过期后删除对象和加密结果；把删除并入已有 worker pass 和代码常量，不为这个单一用例新增运营配置。

### 状态投影

```ts
type JobDraftImport = {
  import_id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  failure_code?:
    | 'invalid_pdf'
    | 'document_too_complex'
    | 'parser_invalid_output'
    | 'parser_temporarily_unavailable';
  suggestion?: JobDraftSuggestion;
  created_at: string;
  updated_at: string;
};
```

`suggestion` 只在 succeeded 存在：

```ts
type JobDraftSuggestion = {
  title: string | null;
  recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time' | null;
  workplace_mode: 'onsite' | 'hybrid' | 'remote' | null;
  office_location: string | null;
  description: string | null;
  requirements: string | null;
  education_requirement: 'none' | 'associate' | 'bachelor' | 'master' | 'doctorate' | null;
  experience_requirement: 'none' | 'one_to_three_years' | 'three_to_five_years' | 'five_plus_years' | 'ten_plus_years' | null;
  category_source_name: string | null;
  location_source_name: string | null;
  keywords: string[];
};
```

刻意不返回：`category_id`、`location_id`、公司声明、薪资、毕业届、实习月数、每周到岗天数、hard requirements、private screening preferences。模型不能安全决定的内容由用户补充；Catalog ID 必须由用户从目录选取。

### 错误与安全边界

- 只接受已激活 recruiter role 和合法 Origin/session/assertion。
- multipart 流式落临时文件，复用 `resumefile.ValidatePDF` 的 MIME、结构、大小和页数上限；不要把整个 PDF 放内存。
- 明确处理同意；没有 `processing_consent_confirmed=true` 在入队前 400，零对象/DB 副作用。
- 同一 subject + Idempotency-Key + 相同文件重放同 import；同 key 不同内容 409 `idempotency_conflict`。
- GET missing 与 foreign 都 404，不泄漏 owner。
- API、日志、审计、outbox 和幂等 receipt 不出现 PDF 正文、模型全文、原始文件名、原始 idempotency key 或对象坐标。
- suggestion 是建议稿，不创建/更新 Job，不触发推荐、MatchCase 或 Agent task。

- [ ] 先修改 `apps/recruitment-bff/openapi/mobile-v1.yaml` 和 `apps/recruitment/openapi/mobile-resources-v1.yaml`。
- [ ] 在两侧 OpenAPI route/required-header/error-set contract test 加入新操作。
- [ ] 在 code review 前确认字段闭集、failure code 和 retention 常量，没有产品歧义。

---

## Task 3：实现 recruiter-owned JD import 领域和持久化

**Files（建议最小落点）：**
- Create: `apps/recruitment/internal/jobdraftimport/types.go`
- Create: `apps/recruitment/internal/jobdraftimport/schema.go`
- Create: `apps/recruitment/internal/jobdraftimport/schema_test.go`
- Create: `apps/recruitment/internal/jobdraftimport/openrouter.go`
- Create: `apps/recruitment/internal/jobdraftimport/openrouter_test.go`
- Create: `apps/recruitment/internal/store/migrations/000028_job_draft_imports.up.sql`
- Create: `apps/recruitment/internal/store/migrations/000028_job_draft_imports.down.sql`
- Create: `apps/recruitment/internal/store/job_draft_import_store.go`
- Create: `apps/recruitment/internal/store/job_draft_import_store_test.go`
- Modify: data export/account deletion owner coverage where repository conventions require it

不要为了“复用”先把 `resumeparse` 重构成通用 document parser。它的 `resume-parse.v1`、候选 owner、Catalog resolution 和正文保留策略都是候选简历专用。可以复制经过验证的小模式，或只复用已有的 PDF validator、blob interface、cipher 和安全 HTTP client 配置。

- [ ] 定义严格 `job-draft-import.v1` 模型 schema：闭合字段、`additionalProperties=false`、空值显式 null、数组非 null、禁止 Catalog ID。
- [ ] Provider 使用 strict JSON schema、只返回一个 JSON 对象、无 reasoning、有限响应字节、120 秒上限，并复用现有 HTTPS/config 安全要求。
- [ ] schema 测试覆盖：合法中英文 JD、缺字段用 null、未知 enum、额外字段、模型伪造 Catalog ID、markdown fence/前后解释、截断响应、超长文本。
- [ ] migration 至少存：opaque import ID、owner subject、request digest、状态、attempt/lease、私有 object key/generation、PDF hash/size/page count、加密 suggestion、结果 hash/key version、failure code、时间戳和过期时间。
- [ ] 建立 subject ownership、one active/replay、lease fence、attempt ceiling、succeeded/failed 终态约束；结果明文只在进程内短暂存在。
- [ ] 结果加密沿用 repository 已有 cipher，不把 raw suggestion 写 JSONB/plain text。
- [ ] account deletion 和 data export 按现有 owner 协议处理：删除时清对象/密文；导出若产品合同未要求包含临时建议稿，则明确排除并写测试，不要默默遗漏。

建议提交：

```bash
git add apps/recruitment/internal/jobdraftimport apps/recruitment/internal/store/migrations/000028_job_draft_imports.up.sql apps/recruitment/internal/store/migrations/000028_job_draft_imports.down.sql apps/recruitment/internal/store/job_draft_import_store.go apps/recruitment/internal/store/job_draft_import_store_test.go
git commit -m "feat(recruitment): persist encrypted JD draft imports"
```

---

## Task 4：实现异步解析 worker 和 runtime 接线

**Files:**
- Create: `apps/recruitment/internal/worker/job_draft_import.go`
- Create: `apps/recruitment/internal/worker/job_draft_import_test.go`
- Modify: `apps/recruitment/internal/worker/reconciler.go`
- Modify: `apps/recruitment/internal/runtime/runtime.go`
- Modify: config tests only if no existing Provider config can be safely reused

- [ ] worker 独立 claim 小批量任务；Provider 调用期间不持有数据库 transaction。
- [ ] 从 pinned object generation 读取并再次 `ValidatePDF`；hash/size/page count 与入队记录不一致时失败关闭。
- [ ] transient provider/storage failure 有限重试；无效模型输出重试到上限后 `parser_invalid_output`；非法 PDF/过页数不重试。
- [ ] complete/fail 都由 lease owner fence；lost lease 的迟到结果不得覆盖新 owner。
- [ ] 成功前再次 strict encode/validate；只加密 canonical suggestion。
- [ ] 日志只允许 import ID、request ID、状态、attempt、safe failure code、耗时和响应字节数；禁止正文、公司名、职位名和模型响应。
- [ ] 使用现有 LLM OpenAI-compatible provider 配置即可，不新增第二套 token/model 配置，除非有已批准的运营需求。
- [ ] 添加 hermetic parser stub 场景，不能让正式 L3 访问真实模型或公网。

---

## Task 5：实现 Recruitment internal API、BFF client 和 public API

**Files:**
- Create: `apps/recruitment/internal/mobileapi/job_draft_imports.go`
- Create: `apps/recruitment/internal/mobileapi/job_draft_imports_test.go`
- Modify: `apps/recruitment/internal/mobileapi/handler.go`
- Modify: `apps/recruitment/internal/mobileapi/openapi_test.go`
- Create: `apps/recruitment-bff/internal/recruitmentclient/job_draft_imports.go`
- Create: `apps/recruitment-bff/internal/recruitmentclient/job_draft_imports_test.go`
- Create: `apps/recruitment-bff/internal/httpapi/job_draft_imports.go`
- Create: `apps/recruitment-bff/internal/httpapi/job_draft_imports_test.go`
- Modify: `apps/recruitment-bff/internal/httpapi/api.go`
- Modify: `apps/recruitment-bff/internal/httpapi/openapi_test.go`
- Modify: both OpenAPI documents finalized in Task 2

- [ ] internal routes使用 recruiter role：`POST /internal/v1/recruiter/job-draft-imports` 和 `GET /internal/v1/recruiter/job-draft-imports/{import_id}`。
- [ ] BFF public POST 先校验 Origin/session/idempotency，再流式转发 multipart；不能读全文件到内存。
- [ ] strict multipart 只接收 `file` 和 `processing_consent_confirmed`，重复/未知 part 拒绝。
- [ ] GET 只返回 owner-safe projection。pending/processing 没有 suggestion；failed 只有闭合 failure code；succeeded 才有 suggestion。
- [ ] BFF 对 downstream 稳定错误做显式白名单映射；未知错误折叠成 service unavailable/internal error，不透传内部消息。
- [ ] route table、OpenAPI operation set、required Idempotency-Key、Origin 和 role 测试全部更新。

---

## Task 6：把 JD 导入加入正式 hermetic Case

**Files:**
- Modify: `apps/recruitment-bff/scripts/local-e2e.sh`
- Modify: `apps/recruitment-bff/scripts/tests/test-local-e2e-source.sh`
- Modify: `tests/l3/recruitment-mobile-local-cases.json` only if risk-area metadata must name the new domain
- Modify: `docs/testing/GLOBAL_TEST_CASES.md` only when repository policy requires catalog text to reflect the new responsibility

在现有 atomic Case `foundation:auth-role-session` 中增加 recruiter JD import 小闭环：

```text
无 consent 上传 → 400 且零 row/object
带 consent 的合成 PDF → 202 pending
同 key/同文件重放 → 同 import_id
同 key/不同文件 → 409 idempotency_conflict
hermetic parser stub → processing → succeeded
owner GET 返回 suggestion，但没有 category_id/location_id
foreign recruiter GET → 404
jobs 表和 job CRUD receipt 数量不变（没有自动发布）
日志/DB/receipt 隐私扫描不出现合成正文和原始文件名
过期清理删除对象与密文
```

fixture 使用完全虚构的一页或两页 JD，包含 title、职责、要求、remote 语义和明显 privacy canary。不得提交真实公司材料。

## 正式测试声明

该变更 touch `recruitment` / `recruitment-bff` 产品路径，L3 为 required，且 `recruitment-mobile-local` 是 atomic single Case。

```yaml
TEST_DELTA:
  modules:
    - recruitment
    - recruitment-bff
  l0_l2:
    commands:
      - tools/test service recruitment
      - tools/test service recruitment-bff
  l3:
    decision: required
    suite: recruitment-mobile-local
    impact_class: case-semantic
    mode: explicit
    cases:
      - foundation:auth-role-session
    cadence_scope: development
  release_only:
    recruitment-stg-verify: none
```

先预览选择：

```bash
tools/test global recruitment-mobile-local --case foundation:auth-role-session --plan
```

正式 L3：

```bash
tools/test global recruitment-mobile-local --case foundation:auth-role-session
```

`recruitment-stg-verify` 是部署/远端配置的 suite-only 收敛检查，本产品修复不选择它。独立 implementation worktree 按 `WORKTREE_TEST_HANDOFF.md` 只跑 L0–L2，并把 L3 标记 `DEFERRED_TO_INTEGRATION`；只有 rolling integration owner 在合并 commit 上运行正式 L3。

## 最终验收

Task 1：

- remote + `office_location:""` create/update 成功并保持空字符串。
- onsite/hybrid 空地址仍 422，field path/reason 不变。
- 公司声明和 requirements 空值仍 422。
- Job create/update/replay/CAS/owner projection 没有回归。

Task 2～6：

- recruiter 可上传合成 JD，轮询到 succeeded 并读取严格建议稿。
- 建议稿不含 Catalog ID，不自动创建 Job。
- foreign owner 统一 404；无 consent 零副作用；同 key 幂等。
- PDF、正文、模型输出、对象坐标和 raw key 不进入日志或明文存储。
- parser stub 下 hermetic Case 不依赖公网/真实模型。

交付报告必须包含：根因/设计决策、修改文件、migration、OpenAPI diff、commit SHA、每条测试命令与退出码、正式 L3 的执行者和状态。未执行 L3 时必须写 `DEFERRED_TO_INTEGRATION`，不得声称全绿。
