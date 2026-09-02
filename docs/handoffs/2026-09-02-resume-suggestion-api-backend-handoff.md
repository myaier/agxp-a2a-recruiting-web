# 后端 Handoff：Candidate Resume Suggestion API

> 本文可直接发送给另一台机器上的后端 Coding Agent，用于从零上下文编写 Spec/Plan 并实施。文中只使用仓库相对路径，不依赖聊天记录、测试账号、浏览器会话、截图或本机路径。

## 1. 目标与基线

- 目标仓库：Recruitment 后端仓库。
- 核对基线：`origin/release/0.2.5@45f7323e34f6f6db11faee658144e28d338b36be`。
- 目标：把已经持久化的简历解析结果，投影为候选人本人可读取、可安全用于 onboarding 表单预填的 suggestion DTO。
- 本 Handoff 是该 API 的唯一后端 owner；不要同时实施 local LLM、前端表单或 Hosted Agent 工作。

当前系统能够上传候选人简历、异步解析并保存完整加密解析结果，但 candidate-facing BFF 的 parse status 只暴露状态与 `parse_id`，没有 extracted result。前端因此无法合法取得预填数据。

## 2. 要冻结的产品合同

### 2.1 新增 owner-only suggestion read

新增一个候选人本人读取接口，绑定：

- 当前认证候选人；
- `file_id`；
- `version_id`；
- `parse_id`。

Spec 必须从当前路由风格中选择并冻结精确 method、path、path/query 参数、响应 envelope、HTTP status 和 error enum，然后同步更新 Recruitment Mobile API、BFF client/BFF HTTP API 及两份 OpenAPI。

建议响应语义如下；字段名以最终 Spec 为准：

```json
{
  "source": {
    "file_id": "rf_...",
    "version_id": "rfv_...",
    "parse_id": "rp_..."
  },
  "draft": {
    "profile": {},
    "summary": null,
    "skills": [],
    "experiences": [],
    "educations": [],
    "certificates": []
  },
  "warnings": []
}
```

这是 suggestion/read model，不是在线简历写接口。读取不得改变 resume、onboarding 或 parse 状态。

### 2.2 授权与版本绑定

所有条件必须同时成立，否则 fail closed：

1. 文件属于当前认证候选人；
2. `version_id` 属于该文件；
3. `parse_id` 属于该版本；
4. parse 为可消费的成功终态；
5. 文件、版本和 parse 没有被删除、替换、失效或 supersede。

禁止：

- 只凭 `parse_id` 读取；
- 根据最近一次 parse 猜版本；
- 在版本已替换后返回旧 suggestion；
- 对非 owner 泄露“资源存在但无权访问”；
- 把管理员/内部解析读取接口直接暴露给候选人。

应复用现有 owner lookup、not-found privacy 和 lifecycle 规则。若现有错误词不够，Spec 冻结最小的新 owner-safe 错误集合。

### 2.3 Candidate-visible projection

只投影用户填写在线简历所需的数据。允许的概念范围：

- 基本职业资料；
- 个人简介；
- 技能；
- 工作经历；
- 教育经历；
- 证书。

必须排除：

- `DocumentIdentity` 中的电话、邮箱、地址等原文身份/联系信息；
- source page、evidence span、OCR 坐标、对象存储 key；
- PDF SHA、内部 file/version metadata；
- provider、model、prompt、raw response、attempt、trace、内部 warning；
- 管理员或解析诊断字段。

如果 skill/certificate 等字段需要 catalog ID：

- 只有 exact、唯一、可验证的 catalog match 才能给 ID；
- 未解析项保留为安全的 suggestion/warning，不能伪造 ID；
- 禁止模糊匹配后静默当作已确认事实。

Projection 必须由独立 mapper 生成，不能把内部 parse struct 直接序列化。

### 2.4 Cache 与隐私

候选人解析结果包含敏感履历信息。所有经过 Mobile API 和 BFF 的成功与错误响应都必须遵守仓库现有 privacy/cache 约定；至少验证最终响应包含精确的 `Cache-Control: no-store` 语义，并且日志、metrics、error detail 不包含简历正文或 suggestion 数据。

## 3. Onboarding 边界

后端接口不得接收 `onboarding=true` 一类控制参数，也不得自动把 suggestion 写入在线简历。

- onboarding 首次填写时是否采用 suggestion，由前端决定；
- 日常“附件简历维护”上传/重传只能解析和读取，不得自动覆盖在线简历；
- 用户编辑后的字段永远优先，前端只能预填空白 draft；
- 本轮不新增“apply suggestion to resume”聚合写接口。

这样可以复用同一个安全 read contract，同时避免日常维护误覆盖已有履历。

## 4. 数据生命周期

- 不新增第二份解析结果持久化。
- 复用当前加密 parse result 和删除链路。
- 删除文件/版本/parse 后 suggestion 必须不可读。
- 替换版本后旧结果必须按现有 lifecycle 规则不可消费。
- 不延长解析结果保留期，不建立额外搜索索引。

如果当前 store 无法原子验证 owner + file + version + parse + lifecycle，增加窄的 store/service query，不要在 HTTP handler 中拼多次不一致查询。

## 5. 推荐代码范围

按最新主干校准，重点检查：

```text
apps/recruitment/internal/resumeparse/types.go
apps/recruitment/internal/store/resume_parse_store.go
apps/recruitment/internal/resumefile/service.go
apps/recruitment/internal/mobileapi/resume_files.go
apps/recruitment/internal/bff/resume_files.go
apps/recruitment/internal/bff/client/
apps/recruitment/internal/bff/httpapi/
apps/recruitment/openapi/
apps/recruitment/internal/bff/openapi/
```

不要因为示例路径不同而机械新增平行抽象；以仓库实际 owner/resource/service 边界为准。

## 6. 必须覆盖的测试

至少包含：

1. owner + 当前 file/version/成功 parse 返回安全 projection；
2. 非 owner、跨候选人、随机 ID 均按 privacy 约定 fail closed；
3. file/version/parse 任一绑定不一致时拒绝；
4. queued/running/failed/cancelled parse 不可读取 suggestion；
5. 被删除、替换、supersede 的版本/parse 不可读取；
6. DTO 不含 contact、evidence、page、SHA、provider/model/prompt/attempt 等内部字段；
7. catalog exact match 与 unresolved suggestion 行为；
8. Mobile API 与 BFF auth、error、cache header 一致；
9. 两份 OpenAPI 与生成/strict decoder 测试通过；
10. read 不产生在线简历 mutation；
11. 日常重传附件不会自动覆盖在线简历。

增加一组含 profile、summary、一个 experience、一个 skill、一个 certificate 和 unresolved item 的 deterministic fixture，供后续前端合同测试消费；fixture 不得包含真实个人信息。

## 7. 非目标与独占边界

本 Handoff 不修改：

- `dev-local.sh`、Compose、LLM provider、默认模型或 parser stub；这些由 `docs/handoffs/2026-09-02-local-ai-runtime-backend-handoff.md` 独占；
- 前端 onboarding 表单、merge policy 或日常附件 UI；
- 在线简历写模型；
- Hosted Agent identity、task 或错误合同；
- JD parsing/import。

## 8. 下游依赖与交付物

本工作可作为 Wave 1 独立实施。完成后必须向前端 owner 提供：

- 精确后端 commit；
- 两份 OpenAPI diff；
- method/path/DTO/error/cache 表；
- lifecycle 与 legacy 行为说明；
- deterministic fixture 与调用示例。

依赖本合同的前端工作见：

`docs/handoffs/2026-09-02-candidate-onboarding-prefill-frontend-handoff.md`

## 9. 完成标准

- [ ] owner-only suggestion read 的 route、DTO、errors、cache 已冻结并实现；
- [ ] file/version/parse/owner/lifecycle 绑定 fail closed；
- [ ] candidate projection 不泄露内部解析信息；
- [ ] read 无任何 resume mutation；
- [ ] Mobile API、BFF、两份 OpenAPI 一致；
- [ ] 定向测试、生成检查及 Recruitment 后端要求的验证门通过；
- [ ] 下游前端拿到精确 commit 和 fixture 后无需参考其它上下文即可规划。
