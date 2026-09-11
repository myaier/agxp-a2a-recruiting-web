# J-PILOT-02 后端现状证据（只读研究）

研究基线：`origin/release/0.2.5 = 1ae0b7a46f060e27c7f6db38e0469d15c626e2c5`。业务源码从 `/Users/visionclaw/.paseo/worktrees/j-pilot-01-contracts` 读取；该 worktree 的 01 OpenAPI 候选不是 release 合同，本报告未以其新增内容认定既有能力。未运行测试、未改仓库。下列路径行号均相对于后端仓库、上述 release 业务基线；简写 `internal/` 均须补上 `apps/recruitment/` 前缀。

## 结论

上传—异步解析—按精确来源读取建议—用户确认后分块写入在线简历—首次意向—头像的资源能力已存在。不是一个服务端统一 onboarding workflow：未发现招聘 onboarding 完成标记、步骤游标或跨资源原子完成接口。资源可回读、单次写入有并发控制，不能因此断言逐页草稿和整条刷新恢复已经完成。真实 PDF 解析有仍 OPEN 的既知故障，受控 fixture 与真实模型验收必须分开。

## PDF 与异步解析

- `internal/resumefile/types.go:10-11` 最多 3 个文件槽。`service.go:111-134,140-157` 上传/替换携带 `processing_consent_confirmed`；false/省略允许保存原附件但不触发解析。true 在 finalize 同一事务入队（`internal/store/resume_file_store.go:774-802`）。解析授权是发给模型处理的授权，不是投递披露授权。
- 文件槽有不可变版本；替换要求 expectedRevision、上传具有 subject-bound key 摘要（`internal/mobileapi/resume_files.go:146-152`）。不能以 onboarding 方便为由改变 01 已绑定旧版本。
- 对用户仅显示 `not_started/pending/processing/succeeded/failed`；内部 queued/retry_wait 折叠成 pending，只有成功带 parse_id，只有失败带 failure_code。依据 `internal/store/resume_file_store.go:334-356`。不得展示内部 attempt/lease 为业务状态。
- worker 真实接线：`internal/runtime/runtime.go:444-445,483` 创建 OpenRouter parser 并传配置；`internal/worker/resume_parse.go:375-490` 精确打开 pinned object generation、校验 SHA/大小/PDF、调用模型、目录消歧、编码验证、同时存主结果与优势 sidecar。不直接写在线简历。
- `internal/resumeparse/types.go:35,56-65` 解析上限 50 页、最多 3 次 attempt、lease 3 分钟、单 provider 调用 120 秒。这是实现约束，不是用户端完成 SLA。
- `internal/worker/resume_parse.go:189-218` 不可读/过复杂终结；配置错误终结 unavailable；暂时故障及 invalid output 可重试，第三次分别 unavailable/invalid_output。`store/resume_parse_store.go:163-249,371-410` claim/reclaim/fail 的持久化；过期耗尽的 processing 不会取得第四次 lease；旧 owner 无法晚到覆写结果。
- 显式重新解析：`store/resume_file_store.go:969-989,998-1102` 原 key 同请求先回放当前状态；新 key 仅 latest failed 或从未解析允许；active parse -> parse_already_in_progress；已 succeeded -> parse_not_allowed；必须同意解析且所选为当前 ready 版本。不存在用户取消解析状态/入口；页面离开不等于取消 worker。替换后旧解析仍可完成，但 owner 建议读取会拒绝旧版本。
- 建议读取 `store/resume_file_store.go:1105-1147` 验证 subject/file/current ready version/exact succeeded parse，一事务解密与完整性校验，不写状态；外人/删除/错误pair/尚未成功统一 notfound，属于本人但旧版本 stale；HTTP 映射 `mobileapi/resume_parse_result.go:425-464` 为 404/409/503 等。角色测试 `resume_parse_result_handler_test.go:106` 已有。
- 预填内容是建议，目录 `exact/unresolved` 和 warning 如缺必填/不确定 enum/超目标限制，不保证一份 PDF 生成可直接提交的完整表单。`resumeparse/types.go:8-13,139-148` 不截断、不杜撰目录ID；`mobileapi/resume_parse_result.go:302-402` 逐字段映射 profile/经历/教育/证书等。不能把 parse succeeded 当成用户资料已确认或 onboarding 已完成。

## 当前 onboarding 的个人优势与独立标签资源需要区分

前端交叉核实：当前 onboarding 的“个人优势”文本调用 `保存简历summary`，经现有在线简历 summary 分块 PATCH 持久化；依据前端 `src/状态/后端/候选操作.ts:238`、`src/数据/招聘数据源/简历.ts:85`（精确前端基线由前端报告记录）。它可以手填，不以成功 PDF 解析或建议 index 为前置。后端对应 `internal/resume/repository.go:149-190` 的 singleton 更新能力。

后端另外已有 **personal-highlights 标签资源**，与页面同名近似但不是当前 onboarding 的必经接口。这里只记录隔离边界，不把其约束投射到当前页面，也不将接线该资源列为 02 必做：

- `internal/resumefile/personal_highlights.go:12-25,141-185` 标签状态 empty/active/stale；非空确认绑定 file/version/parse/resume aggregate revision，从 1–5 个建议按 index 选择，可修改短 text，每条 1–24 字符。空 items 且无 source 是清空。
- `internal/store/personal_highlights_store.go:242-251` 标签有效性要求当前文件版本、成功解析、账号 active、在线简历 aggregate revision 一致；后续简历写入可使**这份独立标签确认** stale，并非使 summary 失效。
- `resumefile/personal_highlights.go:18-25` stale 隐去标签 source/items；`store/personal_highlights_store.go:111-114` 旧成功解析无 sidecar 读空数组。
- `resumefile/personal_highlights.go:189-201` 修改标签建议文本会扩大其 disclosure source sections 到经历+教育。02 当前无需改动该机制。

## 在线简历、意向、头像与恢复

- 在线简历 `internal/resume/repository.go:124-141,149-190,196-290,434-584` 支持 owner GET、singleton 分块更新（HTTP PATCH）、经历/项目/教育/证书增改删；分块/条目revision CAS与总revision，新增条目 key 回放。`627-710` 未写过返回合成空文档，首写创建root。这可支撑手填和已保存资料恢复，但多个步骤不是一个原子事务，用户未保存的本地输入不由后端恢复。
- 意向 `internal/intention/service.go:45-50` 调repository create；`repository.go:98-157` 创建serializable事务+主体配额5+key/body receipt；`224-262` 写active/revision1及 private_preferences。**CreateIntention 本身没有推荐刷新、watch创建、委托或S0触发**。推荐刷新独立 `internal/discovery/service.go:510-560`，委托是独立接口路径。02首页交接不应宣称建档完成必然已自动初筛。
- 同时创建简历root（含 summary）、首次意向、头像并非整体幂等完成动作。首次意向 unknown response 若换新 key 重发，可能多建一条直到配额；应冻结原请求/回读，而不是“列表有数据就一定是本次成功”。是否跨设备/注销恢复待产品限定。
- 头像 `internal/candidateaccount/types.go:69-90` owner profile 仅 avatar_url/revision/updated_at，空profile revision0。`service.go:63-126` 图片校验后上传、CAS、同key/body回放，失败补偿；`129-147` 删除幂等；`156+` 读取当前generation。头像不是简历profile的一部分，不能用“有头像”推断建档完成。
- 在 `apps/recruitment/internal`、`apps/recruitment-bff/internal` 搜索 onboarding/Onboarding，仅命中一条 Case 排除入职阶段注释，没有招聘候选 onboarding_complete/step cursor 实现。与 Hub/Portal 的 onboarding_stage 是不同产品流程，不能挪用它判断招聘建档完成。

## 测试与实际证据分层

已存在测试源码（本次未执行）：

- `internal/store/resume_parse_store_postgres_test.go:17,50,79,118,137,216,265,363-593` lease/密文/来源/幂等/并发/sidecar原子性与legacy。
- `internal/mobileapi/resume_parse_result_handler_test.go:50,106,120,147,179,195` DTO/headers/候选角色/query错误/错误映射/挂载。
- `internal/store/personal_highlights_store_postgres_test.go:196-584` 确认回读、owner围栏、旧版本、在线简历revision漂移、坏index、竞态、清空、stale、冻结账号。
- `internal/resume/repository_postgres_test.go:20,59,83,156,367,422,452,490` 首写/分块不丢更新/幂等/过期revision/证书null/回滚/并发。
- `apps/recruitment-bff/scripts/local-e2e.sh:4,121,410-415,2039-2040` L3 canonical foundation:auth-role-session，接入真实Service/DB但模型是 parser-stub。`apps/recruitment/cmd/recruitment-parser-stub/main.go:1-22` 明确生产镜像不包含；dev-local显式profile，L3 always-on。它稳定返回抽取结果，不代表真实模型质量。

历史实际执行证据：

- `docs/known-issues/recruitment-resume-parser-invalid-output.md:1-4,16-18` 仍 OPEN，2026-09-01外部自动化真实上传/下载/浏览器PDF预览成功，但中文两页解析最终 failed/parser_invalid_output。
- 同文 `:35-49,79-82` 已记录 hermetic synthetic worker及4个真实Postgres并发/幂等测试实际PASS；live test因三个LLM变量缺失 ENV_BLOCKED，exit1，**没有发出provider请求**。根因阶段未知。它不是“解析根因已修复”。
- 现有01基线L3通过只能复用其明示覆盖，并不能当作02真实浏览器onboarding通过。没有发现可证明完整学生/社招两条真实浏览器onboarding在本基线通过的证据。

## 分支校准与并行边界

`git branch -r --no-merged origin/release/0.2.5` 的在途分支主要为测试/runtime/eigenflux/release0.3等。进一步 `git log --all --not origin/release/0.2.5 -- <resume/resumefile/resumeparse/intention/candidateaccount 5域路径>` 无输出：当前本地已知refs中未发现这些实现域尚未合入的commit。此结论限已获取refs，不涵盖他人未push修改。

建议02保持消费已有解析与资源API，先解决FE保存/恢复与状态语义；避免修改解析来源有效性、PDF版本与披露状态、自动委托推进。若产品要求跨设备逐页草稿或持久完成确认，则列具体待决策/合同缺口，不能默认为当前已支持。当前 summary 手填能力已有，不应误列为缺失标签 API。
