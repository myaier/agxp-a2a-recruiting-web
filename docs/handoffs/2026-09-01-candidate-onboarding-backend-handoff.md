# 可直接转发：Backend Agent 候选简历解析与合同修复 Handoff

> 本文自包含。不要要求访问原测试机器、原 PDF、浏览器认证状态、截图、录屏或之前的聊天记录。

> **状态复核（2026-09-05 05:37 +08:00）：部分已完成，部分旧归因已失效，剩余合同仍待办。** 后端 `origin/release/0.2.5` 仍为 `21e34ff04`。证书年份 nullable、parser failure 分类/安全诊断与合成中文 PDF 证据矩阵已由 `6e27240ed`、`d4c656fca`、`a46b82df2`、`48e292660`、`05f87254c` 等提交落地。原文基于单次“两页中文 PDF”的 `parser_invalid_output` 观测，不能再作为“页数或中文 PDF 导致 parser 缺陷”的当前结论；当前 local runtime 已区分显式 stub 与 real provider。候选披露联系方式合同仍未完成，现由 `2026-09-04-report-remainder-backend-handoff.md` 工作包 1 负责；不要把登录 credential/avatar 的已完成能力误判为该合同已经存在。

## 目标与边界

主任务：定位并修复“可正常下载/预览的两页中文 PDF，异步解析最终进入 `failed/parser_invalid_output`”。

并行合同任务：确认证书年份可空、专业目录别名、候选披露联系方式是否需要新 API。

不要修改经历、技能、证书或意向接口来处理所谓“保存后丢失”：本轮浏览器没有向这些端点发送 mutation。前端保存阻断是独立问题。

## 已知系统行为

附件 API 对浏览器只暴露生命周期，不暴露解析正文：

```text
GET    /api/v1/me/resume-files
POST   /api/v1/me/resume-files
PUT    /api/v1/me/resume-files/{file_id}/content
POST   /api/v1/me/resume-files/{file_id}/parse
GET    /api/v1/me/resume-files/{file_id}/content
DELETE /api/v1/me/resume-files/{file_id}
```

状态闭集：

```text
not_started | pending | processing | succeeded | failed
```

本轮服务端状态：

```json
{
  "status": "failed",
  "failure_code": "parser_invalid_output"
}
```

文件上传、对象存储、authenticated content download 和 PDF 预览均成功。失败发生在上传完成后的解析任务内。

历史坐标仅供共享环境仍保留日志时检索，不作为完成任务的必要条件：

```text
file SHA-256: b45b050e9124c13b64ec3c6aa70ab3bb294cdaf07688980dabd4851b4dbe9c8c
file_id:        rf_5d08c85065b22c2e7540cb91c667d370
version_id:     rfv_55a0bcb5ed85ffdce4d9b0942f39c29b
upload request: 7a2dc4b5afc4390391216561769b97f4
failed poll:    93478a46e9e8433582c3e35db14c697f
```

## 可独立创建的脱敏复现 fixture

不要复制真实候选文件。生成一份合成的两页中文 PDF，保留以下结构特征：

- 第一行：两到三个中文字符姓名；
- 同行或相邻行：年龄、11 位中国大陆手机号、邮箱；
- 两段教育：学校、学历、专业、`YYYY.MM–YYYY.MM`；
- 三段按倒序排列的工作经历：公司、职位、起止月份，其中一段“至今”；
- 工作描述含中文顿号、百分比、括号和多行项目符号；
- 技能段包含英文缩写；
- 证书段包含 `CET-4`、`CET-6`，不提供取得年份；
- 至少一页有多栏或左右对齐布局。

使用明显虚构的姓名、手机号和邮箱。测试目标是结构化解析健壮性，不是复现个人内容。

## Task 1：追踪失败阶段

在后端仓库先运行：

```bash
rg -n "parser_invalid_output|resume-files|version_id|parse_id|processing_consent_confirmed" .
rg -n "json_schema|response_format|structured|finish_reason|markdown" .
```

按 `version_id` 或合成 fixture 的新 job ID 追踪：

```text
upload persisted
  → parse job enqueued
  → worker claimed
  → PDF text/image extraction
  → model/provider request
  → provider response received
  → JSON/schema decode
  → parse record persisted
  → terminal state published
```

必须明确失败属于哪一类：

1. PDF 文本提取为空或乱码；
2. provider 返回 markdown fence、解释前缀或多个 JSON 对象；
3. JSON 语法有效但不符合 schema；
4. 中文字段、日期、数组或 nullability 被 decoder 拒绝；
5. 响应截断、超时或 finish reason 非正常；
6. schema/prompt/model 版本在 producer 与 consumer 之间不一致。

诊断日志只能记录：provider request ID、模型/提示/schema 版本、响应字节数、finish reason、JSON error offset、schema error path、重试次数和耗时。不得记录 PDF 正文、姓名、手机号、邮箱或完整模型响应。

## Task 2：先写失败测试，再修 parser

定位到 parser/worker 包后，添加以下测试层级。

### 单元测试矩阵

```text
合法结构化 JSON                         → decode success
JSON 被单个 markdown fence 包裹          → 按批准策略成功或明确失败
JSON 前后有解释文本                      → 不得误取错误对象
缺必填字段/错误枚举/错误日期              → parser_invalid_output
响应被截断                              → 有限重试后 terminal failure
证书年份缺失                            → 按批准 schema 处理
```

### Worker 集成测试

```text
合成两页中文 PDF
  → job 只消费一次
  → parse 从 pending/processing 到 succeeded
  → 返回非空 parse_id
  → succeeded 后不回退
```

### 幂等与重试测试

- 同一 `version_id` 并发触发只产生一个有效解析结果。
- 仅对明确可恢复的 provider 非法输出或暂时故障有限重试。
- 同一无效响应不能无限重试。
- 终态写回失败必须遵守既有 outcome-unknown/idempotency 语义。

修复应针对已证明的失败阶段。不要用宽松正则吞掉任意 provider 文本，也不要在 schema 失败时制造空简历并标记 succeeded。

## Task 3：验证外部合同和隐私边界

解析成功验收：

```json
{
  "status": "succeeded",
  "parse_id": "parse_example_01",
  "updated_at": "2026-09-01T04:00:00Z"
}
```

外部 API 继续只返回闭合生命周期字段。解析正文、provider output、对象存储坐标、内部 job ID、prompt 和 schema 错误都不得进入浏览器响应。

运行后端仓库的完整单元、集成、lint、typecheck/build 命令；在交付报告中逐条给出命令和退出码，不得只写“测试通过”。

## 合同决策 A：不要顺手实现自动预填

当前产品合同把“附件 PDF”和“结构化在线简历”定义为两个独立领域：

- 解析成功不自动写 `/api/v1/me/resume`；
- 浏览器不读取完整解析正文；
- 用户手填简历继续使用现有 revision/CAS 分区写入。

因此，修复 parser 后页面仍不自动出现姓名、经历等属于当前预期。若产品要自动预填，必须另起设计，明确解析结果版本、目录 ID 归一、建议稿还是直接写入、用户手填冲突、重复上传、审计删除和 PII 同意边界。未经批准不要让 worker 覆盖用户简历。

## 合同决策 B：证书年份

前端当前产品 UI 只收证书名称，并明确生成空年份；现有写入模型却要求整数 year，导致前端在发请求前失败。

推荐合同：

```ts
type CertificateWrite = {
  name: string;
  year: number | null;
};
```

如果接受该合同，需要同步修改 OpenAPI/schema、请求 decoder、持久层 nullability、owner read DTO、数据导出和兼容测试。读取时 `null` 必须保持缺失，不得替换为当前年或 0。

如果产品坚持 year 必填，则明确拒绝 nullable 方案，由前端恢复显式年份采集。两端必须在同一合同变更中落地，不能各自猜测。

## 合同决策 C：专业目录别名

实测目录搜索行为：

```text
GET /api/v1/catalog/majors?q=新闻与传播&limit=20
→ 200, items=[]

GET /api/v1/catalog/majors?q=新闻&limit=20
→ 200, 返回 selectable “新闻学”

catalog_version=pm-2026-08-22-cffc88bf9a88
```

由 taxonomy owner 判断“新闻与传播”是“新闻学”的别名还是独立专业。若为别名，搜索索引应通过 alias 命中 canonical item，并继续返回稳定 canonical ID；不要让前端按显示名猜 ID。增加 exact alias、分页和 catalog version 测试。

## 合同决策 D：候选联系方式

手机号不是后端缺失：`GET /api/v1/me/credentials` 已返回唯一 `phone_otp.display`，前端个人信息页未复用。

当前缺的是独立的“候选简历披露联系方式”合同。若需要保存邮箱、微信或不同于登录凭证的联系电话，先设计：

- 登录 credential 与披露 contact 的不同语义；
- owner GET/PATCH、字段验证、revision/CAS 和清空语义；
- S0 匿名初筛与 S1 简历递交时分别返回哪些投影；
- 数据导出、删除、审计和访问控制。

不要为了迁就现有本地假保存临时增加无版本、无披露边界的接口。

## 明确排除

- 不手工插入经历、技能、证书或意向来让测试账号看起来完整。
- 不修改 intention POST 解决“0 条意向”；本轮根本没有 POST。
- 不把真实 PDF、浏览器认证状态或 provider 原始响应提交到代码库。
- 不把 parse succeeded 等同于用户已确认并保存在线简历。

## 交付报告必须包含

1. 根因所在阶段及最小证据。
2. 修改的后端文件和 commit SHA。
3. 合成 PDF fixture 覆盖的结构特征。
4. 修复前失败、修复后通过的测试输出。
5. 重试次数、幂等和隐私日志验证结果。
6. 四个合同决策的状态：已批准并实现、拒绝，或仍需产品确认。
