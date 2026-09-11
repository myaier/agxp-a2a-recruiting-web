# 双端列表、在线简历与职位详情前端接线设计

更新：2026-09-12。状态：用户已批准前端接线 Spec，进入零上下文 Plan、Claude 文档审查及执行提示词交付；本规划会话不修改业务代码。

## 1. 目标与冻结基线

把已经统一的四个列表、独立职位详情、匿名在线简历和在谈资料 Tab 接上已实施的后端展示字段。复用现有组件、数据源、状态和真实操作，保留 Mock 布局及最新主线产品行为。

- FE 已按用户要求 fetch 并无冲突 rebase 到 `origin/main@5f6aabbdda0eb0f07550da5acc461aa4340dd3bd`。改写前本分支 HEAD 为 `7535302b`，含本需求的两个文档提交。
- BE 核对版本：`release/0.2.5@886e06837512bd8b08c4f10e010533baf89649dc`。
- BE 浏览器合同：`apps/recruitment-bff/openapi/mobile-v1.yaml`；内部生产者合同：`apps/recruitment/openapi/mobile-resources-v1.yaml`。以下 BE 路径均相对后端仓库。
- BE 实施 Spec：`docs/superpowers/specs/2026-09-11-recruitment-mobile-r1-r5-display-design.md`；实施及 final gate 记录：`docs/superpowers/plans/2026-09-11-recruitment-mobile-r1-r5-display.md`。
- 旧版本文已作为后端需求输入；本版以其实际已实施合同替换“建议新增字段”的措辞，不继续要求后端重复开发。

**结论：原 R1–R5 必要字段以及 candidate_identity 已齐全，可以开始前端接线。** 这是所核对版本的 OpenAPI、生产代码和既有验收记录结论，不代表所有老 Case 都有非空资料，也不代表当前运行环境或前端已联调通过。

最新 FE 已合入 J-PILOT-01 连续在谈接线：候选首页/历史使用 negotiations，全意向列表恒省略 intention_id，canonical record_id 导航、分页、重试/归档、未知提交恢复均已有。不能按旧 Spec 再迁移一次，更不能恢复当前意向过滤。招聘端继续按现有岗位范围读取 MatchCase。

## 2. 后端逐项核对结果

路径均以 `/api/v1` 开头，GET 响应路径相对 result；数组路径在表中明确。

| 原需求 | Endpoint | 已实施字段/Schema | 本轮前端工作 |
| --- | --- | --- | --- |
| R1 连续列表 | `/me/negotiations` | items[].match_score；items[].job 的 organization、required_skills、recruitment_type、workplace_mode、annual_salary_months | 扩展既有连续 DTO/解码/映射，替换卡片固定 null |
| R1 连续详情 | `/me/negotiations/{record_id}` | match_score、job_detail；case_detail 使用扩展后的 CandidateMatchCaseDetail | 接现有详情控制，不新增另一条详情读取链 |
| R2 招聘在谈 | `/recruiter/match-cases` | items[].match_score、candidate_identity；candidate_summary 仍按 include 展开 | 分数上卡；身份解码保留但不展示 |
| R3 推荐简历 | `/recruiter/jobs/{job_id}/candidate-recommendations/{recommendation_id}` | 独立 DiscoveryRecruiterDetail，新增 candidate_resume | 分离列表/详情 DTO，接共享在线简历正文 |
| R4 招聘 Case | `/recruiter/match-cases/{case_id}` | match_score、job_detail、candidate_resume、candidate_identity | 接头部与在线简历/资料区 |
| R4 候选 Case | `/me/match-cases/{case_id}` | match_score、job_detail | 更新共用解码与映射；候选主路由仍优先既有 negotiations 聚合读 |
| R5 市场 | `/me/job-recommendations` | recommendations[].job.organization，CandidateJob 必填键 | 接公司短行/Logo，保留推荐分与操作 |
| R5 独立职位 | `/jobs/{job_id}` | organization，CandidateJob 必填键 | 公司摘要接线；完整企业档案复用现有公开 GET |
| S1 身份头像 | `/recruiter/match-cases/{case_id}/candidate-avatar/content` | 已有新 Case 授权内容出口 | 本轮不展示身份，因此不预加载该头像；未来消费返回的 URL |

新增字段都已进入 required，合法缺值显式 null；不是“键可省略”。例外是既有 candidate_summary 等 opt-in 字段，继续按原展开条件判定。候选推荐 refresh 若返回 CandidateJob，也走同一解码，不漏掉写后读取。

### 2.1 实现证据与验证限度

已核对：

- `apps/recruitment/internal/job/display.go`：具体公司摘要/职位正文模型。
- `apps/recruitment/internal/privacy/candidate_resume.go`：七成员在线简历及结构化隐私投影。
- `apps/recruitment/internal/store/case_store.go`：Case 输入的 display_job/display_resume 冻结保存；旧内容缺区合法空。
- `apps/recruitment/internal/store/case_resume_submission.go`：实际披露事务冻结候选填写姓名。
- `apps/recruitment/internal/store/case_candidate_identity.go`、`matchcase/candidate_identity.go`：当前查看者资格、Case 披露与头像内容授权。
- `apps/recruitment/internal/mobileapi/discovery.go`、`negotiations.go`、`matchcase_workspace.go`：真实序列化出口。
- `apps/recruitment-bff/internal/recruitmentclient/display.go`：required 检查、嵌套解码、受控媒体 URL 投影；两份 OpenAPI 已声明对应字段。

本次用结构化 YAML 检查核对了上述核心 schema 必填字段与 GET response 引用。后端 Plan 记录完整 affected 119 suite（其中一个超时后单独重跑通过），development L3 receipt `run-20260911T195659-424e76d0` 在 `32e18d59a` 上 PASS、450.5s，并记录普通 fast-forward 合入 release/0.2.5。本会话未重跑这些测试、未调用真实 API；引用的后端结果不能代替本轮前端验证。

### 2.2 必须同步的已确认产品口径

后端实施 Spec §2 记录用户确认的变更，本版前端遵循：

1. 在线简历以本人已保存结构化资料为准，不新增确认/发布操作；PDF 解析建议不自动等于已保存在线资料。
2. personal_highlights 使用 PDF 自动标签，推荐读取唯一 active PDF 的有效成功解析来源；Case 使用自身精确绑定来源。零份、多份或无有效来源可返回 []，不再要求候选确认，不用在线简历 revision 猜标签是否失效。
3. 自由文本按后端原样投影，前端正常文本转义展示，不另做关键词/模型脱敏；结构化字段继续执行隐私规则，不宣传“匿名正文保证不含身份信息”。
4. 姓名是 S1 实际披露事务冻结的当时在线 profile.real_name，不是实名认证姓名，也不证明与 PDF 内容核验一致。
5. 尚未正式上线，后端先发布、前端再接；本轮直接支持新 required 合同，不新增旧版本兼容开关、协商协议或全局宽松解码。

## 3. 范围与最小设计

本轮只改前端：DTO/严格解码 → 既有领域快照 → 纯展示映射 → 已统一组件。完整正文只在详情读取，列表不逐卡拉 Job、Resume 或企业完整档案。独立职位详情例外按真实组织 ID 复用既有公开公司读取，为该详情补完整公司资料。

实际消费者包括 `src/屏幕/看市场.tsx`、`候选推荐.tsx`、`职位详情.tsx`、`匿名在线简历.tsx`，`src/屏幕/P5/MatchCase列表.tsx` 及既有详情控制；共享解码涉及历史页，需保护其兼容，但不改版历史页面。

相同展示字段复用已有映射/组件；仅为 nullable 在线简历和真实媒体补具体展示类型。不能把后端对象强转成必填 Mock 简历档，也不为满足类型填假姓名、假薪资、假分数。相比另造 Backend 页面，这样最小且避免卡面再次分叉。相比重新设计 Provider/通用 schema 引擎，此任务没有相应必要性。

非目标：修改后端、重新迁移连续在谈、重写状态机/排序/范围/轮询/幂等恢复、生成 AI 批注、重新算推荐分、提前开放直聊、重做编辑页面、消息列表接线、展示候选姓名头像。本轮只消费 candidate_identity，不据此改变当前去名 UI。

### 3.1 PM 视觉约束（2026-09-12 用户明确补充）

本轮是按现有 Mock Up 填充数据，控制和状态按后端合同接线。页面布局、组件视觉和样式由 PM 控制，不由实施者重新设计。

- 不发明新的视觉组件、卡片、信息区、弹层或样式体系，不新增独立展示组件/CSS module 来承载 Backend 数据。优先修改现有组件的具体 props、数据适配和原位节点；数据类型、解码与映射函数不属于新增视觉组件。
- 现有 Mock Up 的信息顺序、字号、颜色、间距、图位尺寸、圆角、按钮和空状态样式保持。真实图片只填入既有图位，复用项目已有图片呈现方式；不得为图片接线自行调大图位或新增装饰。
- 尚未完成统一的 Backend 页面按其对应 Mock Up 及现有共享组件完成复用，删除被替代的重复正文；不借统一机会改 Mock 分支的设计。
- 后端新增字段不等于必须新增展示位置。只填原有语义对应的槽；没有对应槽的字段本轮保留在数据层，不挪到不相干区域，不因为后端返回更多字段就加标签、元信息行或推荐说明区。
- 多条工作/项目/教育数据重复使用既有条目样式，自然增长内容高度；不另设计新卡。无权威匹配证据、批注或一致性结论时复用既有未知/缺失状态，不用 Mock 内容制造业务事实。
- 如果某项行为确实需要现有界面未定义的新交互或无法复用的视觉变化，记录具体差异交 PM 决定；本轮先保留既有样式与权限边界，不由实施者代替 PM 作设计决定。

### 3.2 本轮代码扫描结果

| 页面/区域 | 实际代码状态 | 接线方式 |
| --- | --- | --- |
| 市场卡 | 看市场的 Mock/Backend 已共用本页市场卡 | 原位补公司/图片/发布人数据，不再抽新卡 |
| 招聘推荐、招聘在谈、求职在谈 | 已分别调用现有三类共享卡 | 接原 props；图片输入作最小扩展，不改变卡面 |
| 独立职位详情 | 已共用职位页面展示/职位正文展示 | 替换准备函数的未知值，扩展现有图位输入 |
| 在谈职位资料 | 已共用职位资料，正文映射仍有大量固定 null，已有公司详情按钮被固定禁用 | 填入 job_detail；真实组织 ID 具备时接既有公司路由，否则保持原禁用状态；跳转公司页不回写 Case 冻结资料 |
| 在谈在线简历 | 已调用在线简历正文，但档恒 null | 适配 candidate_resume，支持各区可空和多段数据 |
| 独立匿名在线简历 | Mock 使用共享简历正文；Backend 仍有头区、概览、教育、技能、推荐亮点等单独 JSX | Backend 改调现有在线简历正文，沿 Mock Up 原信息顺序；外层真实收藏/委托控制保留 |

特别注意：在线简历正文当前以 `匿名简历档` 必填结构驱动，且用真名非空推断披露后文案及公司还原；不能直接把新 identity.name 传入该旧逻辑。Backend 仅显示服务端实际允许的正文事实，本轮身份不展示。职位资料的分析区只有有分且有证据才画分析，不能因分数已齐而伪造证据。

## 4. 前端合同与解码

落点以现有 `src/数据/BFF契约.ts`、`招聘数据源/发现推荐.ts`、`招聘数据源/MatchCase.ts`、`招聘数据源/连续代谈.ts` 及其消费类型为基础。新增具体展示 schema 可共用解码，但不新建通用反射校验框架。

| 后端 schema | 必须消费的字段 |
| --- | --- |
| JobOrganizationSummary | organization_id、display_name、industry、company_size、funding_stage、logo；六键必填，成员可空 |
| SafeJobDetail | title、description、requirements、recruitment_type、category、location、office_location、workplace_mode、salary_lower、salary_upper、salary_period、annual_salary_months、campus_cohort、internship_months、onsite_days_per_week、experience_requirement、education_requirement、hard_requirements、structured_requirements_confirmed、keywords、organization、company_intro、office_address、benefit_codes、publisher_profile |
| RecruiterCandidateResume | summary、self_description、skills、experiences、educations、expectation、compensation_relationship |
| SafeResumeExperience | company、industry、title、start_month、end_month、description、internship、projects |
| SafeResumeProject | name、role、result；无项目独立日期 |
| SafeResumeEducation | institution、major、degree、start_month、end_month |
| SafeCandidateExpectation | recruitment_type、job_category、locations、workplace_modes |
| CaseCandidateIdentity | state、name、avatar_url、disclosed_at；anonymous/disclosed 闭集 |

成员类型、枚举、可空性逐项以冻结 BFF OpenAPI 为准，不把所有内容粗略声明成 string 或任意对象。`logo` 使用既有公开媒体结构（media_id/media_type/size_bytes/width/height/url）；发布人头像消费已有 publisher_profile.avatar_url。

- 新增必填键缺失、非法枚举、越界分数、非法嵌套结构仍是协议错误；不能降级成一张正常未知卡。
- 合法 null、[]、0、false 区分保留；整区 null 与已读空数组不混用。
- DiscoveryRecruiterDetail 与列表分离：详情有 candidate_resume、没有 candidate_summary 展开；列表不被迫要求整份简历。现有默认详情拒绝新字段的断言改成新合同，隐私和未知键断言继续保留。
- MatchCase 详情和 NegotiationDetail.case_detail 使用同一扩展解码，不复制两份角色校验。候选响应不能混入 recruiter 的 candidate_resume/identity。
- 所有共享响应入口一次更新，包括刷新、写后回读、直达详情及历史复用；不能只改首次列表 GET。

## 5. 列表接线

### 5.1 市场与招聘推荐

市场的公司名优先使用合法 organization.display_name；对象/名称缺失时可保留同一 CandidateJob 已有公开 claim 名。公司短行由 industry.display_name、funding_stage、company_size 经现有码表组合，只保留已知段。真实 Logo 取 organization.logo.url；不可用保留中性图位，不按公司名命中静态图片。薪资、推荐分、标签、发布人和委托继续使用原权威来源，接通 publisher_profile.avatar_url。

招聘推荐继续使用 include=candidate_summary 和现有七字段映射，分数取 match_score；个人标签只用 personal_highlights，不用推荐 highlights 代填。按新 PDF 来源规则调整说明/测试，不新增确认按钮。

### 5.2 两端在谈

候选列表继续全意向 active、恒省略 intention_id，按 record_id 导航。将固定公司/分数 null 替换为 job.organization 与 match_score。标签只填既有标签行，沿对应 Mock Up 的岗位属性顺序与现有技能展示规则，不因新字段增加新的行或类别；未知成员不补默认。pre-Case 的 location 与 Case 冻结 location 语义保持服务端原文，不把办公地点推断为行政城市。

招聘列表继续 job 范围与服务端排序，匹配分取该行 match_score，摘要仍取该行展开的 candidate_summary。candidate_identity 完整解码进入主体/Case 隔离的数据域，但不向卡面输出姓名头像、不预加载身份图片。

保留阶段、待办、故障、轮询、分页和空/错态。公司或简历为空不改变 Case 是否存在；刷新变空清除旧展示值；暂时读取失败沿用已有明确错误和只读缓存策略，不冒充权限已确认。

## 6. 职位详情接线

### 6.1 独立职位

复用 `src/屏幕/职位详情展示/准备职位正文.ts` 与现有展示组件。CandidateJob 供职位事实、正文、公司摘要及发布人；成功获得真实 hiring_organization_ref 后复用公开组织 GET 取 profile.company_intro/office_address/benefit_codes 等完整资料。

组织补读作为详情局部状态，不阻塞已成功读取的职位或委托能力；失败保留岗位已知内容，局部提示与重试，不称作公司资料本来为空。换岗位/主体/组织时旧响应不得写回；有真实 ID 才导航，不按名称猜坐标。不在市场列表逐卡触发完整公司读取。

头像与 Logo 使用显式真实 URL 图位，加载失败中性占位；不把姓名首字说成真实照片。职位详情直取没有推荐坐标时分数仍未知，不创建无意向全局分数。匹配行继续原有结构化要求核对，明确与推荐批次分并非同一计算。

### 6.2 在谈内职位资料

候选正常详情从现有 NegotiationDetail.job_detail 映射，已开 Case 的嵌套值同源；共用 P5 详情入口则消费其 job_detail。标题公司名、分数与正文保持同源；字段只有旧 job 四事实时继续展示它们，不因 job_detail=null 抹去旧事实。

接入完整 JD、结构化要求、薪资、公司简介/元信息/福利、发布人姓名职务与头像。公司地址与岗位办公地址分开。**Case 不补读当前 Job/组织替换冻结正文**；旧 Case 缺内容照常保留未知。

有 Case 的匹配分析只能使用同一 Case 授权可读的绑定事实。当前响应未提供完整对齐证据时只显示权威分数及现有阶段结果，不用当前简历、本地 Mock 算法或推荐缓存补一份分析。pre-Case 公开初评继续已有 agent_summary/evaluation 托盘，不重算或合成新结论。

## 7. 在线简历接线

推荐详情读取当前候选已保存的 candidate_resume；招聘 Case 详情读取该 Case 冻结 candidate_resume。两入口使用同一共享在线简历正文，连接侧负责不同数据来源与操作，不保留 Backend 独立正文副本。

- 头行取 resume.summary 的性别/年限/学历/求职状态，最近工作组合职位行；仍不显示代号、真名或头像。
- 个人优势取 self_description；summary.personal_highlights 保留为候选摘要事实，列表已有亮点槽照常使用。在线简历 Mock Up 没有独立亮点标签区，本轮不另加该区，也不把标签覆盖个人优势正文或恢复旧 Backend 推荐亮点区。
- 工作经历按既有公司/职位/起止/说明槽填 company/title/日期/description；industry 无独立槽时不新增行业行。项目按所属工作顺序展开 name/role/result，不拿工作日期当项目日期。多个教育条目逐条复用现有教育条目样式，不能截成第一段。
- 求职期望只显示 expectation 的招聘类型/职位方向/地点/办公方式；compensation_relationship 仅显示闭合薪资关系。没有候选薪资数字就不造带宽，无依据不出“一致”绿条。
- 技能取 skills；整区 null 给未知，合法 [] 给无条目状态。只有有真实开始时间的经历才将 end_month=null 显示为至今；起始也缺失时显示日期未知，不造一段任职。
- 组件使用具体可空展示类型，允许部分资料已知；不要把 candidate_resume=null 转成空 Mock 档。身份状态不通过“真名非空”或“简历对象非空”推断。
- 显示来源说明遵循已保存在线资料/PDF 标签的事实，不保留“由 AI 生成且真实性经双向核验”等无依据承诺。自由文本以文本节点展示，不解释成可执行 HTML。
- S1 原件 PDF 继续精确 file/version 与实际披露控制；在线简历读取不自动打开 PDF、不提前建立真人沟通。

## 8. 姓名与头像：本轮仅消费协议

后端已实现 candidate_identity：仅本 Case 实际 S1 披露且当前查看者有权时 disclosed；仅上传/保存/授权/进入 S1 都不足。anonymous 的 name/avatar_url/disclosed_at 全 null；disclosed 允许缺姓名头像。name 在 S1 冻结，头像是当前可读头像，disclosed_at 是真实持久披露时间。

前端严格校验、按主体和 Case 存储，后续返回 anonymous 时覆盖并清除旧身份；不得日志/持久化扩散姓名、复用到别的推荐或 Case。当前卡面、在线简历不新增姓名头像，也不因 disclosed 解除结构化正文隐私或开放直聊。

头像路由由响应给出，后端在内容请求上再次授权；本轮不显示所以不发身份图片请求。未来消息列表可复用 CaseCandidateIdentity 和 Case 授权规则，本轮不改消息接口/列表/通知，也不预建通用身份服务。

## 9. 剩余未知与延后项

以下均不阻塞当前接线，不是本轮遗漏的后端必填合同：

| 情况 | 前端规则 |
| --- | --- |
| 老 Case 未保存新展示快照 | job_detail/candidate_resume 可为 null；禁止按当前资料伪回填 |
| 无该查看者原推荐关联 | match_score=null，真实 0 正常显示；不借对向或最新推荐分 |
| 公司档案不全、合法隐私隐藏、无有效 PDF 标签 | 展示已知部分和既有未知/空状态，不扩大读取权限 |
| 公司成立时间、发布人备注、项目独立起止 | 后端本轮按批准范围延后，保留未知；未来另做采集读写链 |
| 工作/项目 AI 批注、确定性匹配分析缺证据 | 不现场生成，不用模拟内容填槽 |
| candidate_identity 已披露但无姓名快照/头像 | 状态不降级；本轮本就不展示身份 |

## 10. 验收与完成条件

1. DTO/解码测试覆盖全部新 required 字段、合法 null/[]/0/false、非法嵌套/枚举/分数、角色隔离、anonymous 夹带身份、列表/详情不同形状。共享历史和写后读取不可遗漏。
2. 纯映射与共享组件覆盖完整/部分空/全空、多段经历教育、公司媒体失败、长文本、刷新从有值变空。Mock 既有完整场景布局保持；后端未提供的事实不得被补成已知。
3. 页面集成覆盖市场/两端在谈/推荐详情/独立职位/在谈资料 Tab，确认新字段到达真实消费位置；保留 J-PILOT-01 的全意向、排序、record_id、分页、迟到响应围栏、未知提交恢复、retry/archive 与 S1 精确附件权限测试。
4. 网络边界验证：列表零逐卡资料补读；独立职位按真实组织 ID 补读，换主体丢迟到响应；Case 资料零当前 Job/Resume 回填；候选身份零新增显示/图片请求。
5. 复用当前 npm test、typecheck、lint、build 和既有 Playwright 入口，Plan 按实际影响冻结定向命令。320px/390px 核验真实媒体、多段资料、长文本和未知状态，无横向溢出/遮挡；不直接更新视觉基线掩盖变化。
   以修改前相同 Mock fixture、视口和交互状态比较截图，完整 Mock 布局不得因数据接线变化；代码审查核对没有新增视觉组件/CSS module/无对应 Mock 槽的信息区。必要的新数据状态使用已有样式，不以扩宽视觉容差接受布局改动。
6. 真实后端联调按 `docs/dogfood/真实后端行为验收.md` 选择相关流程：新 Case 与旧 Case、S1 前后、源资料更新后 Case 冻结、不同查看者。后端已有 L3 记录可作前置，不能替代本前端的实际请求证据；无环境时如实记录未验证，不称全部通过。

完成标准：原有固定缺口中有权威数据的字段已实际显示；合法未知保持正确；新 required 合同不再被旧解码误拒绝；所有现有操作/权限/范围规则不回归；本轮身份只消费、消息不实现。无需为了消除全部占位增加后端能力。

## 11. 批准与改写记录

- 2026-09-11：用户要求 endpoint/字段完整需求清单，追加在线简历与职位详情；原版形成后端输入。
- 2026-09-11：用户确认本 Case S1 实际披露后可向对应招聘方提供姓名/头像，授权写入；前端显示另定，消息列表本轮不实现。
- 2026-09-12：用户告知后端已实施，要求核查并改写为前端接线 Spec；随后要求先 rebase 最新 origin/main。已完成无冲突 rebase，核查后端字段，按最新主线和后端已批准变化重写本文。
- 2026-09-12：用户明确接线以 Mock Up 框架填空，数据/控制/状态按后端合同；未统一页面按现有页面方式改造；禁止自行发明组件和样式，视觉由 PM 控制。已落实 §3.1/§3.2、列表与简历字段落位及视觉验收；本次扫描未发现必须新增视觉设计才能接入的阻塞项。
- 2026-09-12：用户明确“好的，按照 /development-workflow，然后接着写0上下文Plan，做claude review和写执行提示词”，批准本版并授权规划、文档审查和执行提示词交付。批准内容：revision `24223e382ddb57f6c578104ae65b9070c4856400`，blob `b688b2af82ffe09f3d6ecfacef42e5e2c400c91a`；本条及页首状态仅记录批准，不改变 §1–§10 产品合同。实施在新会话开始，本会话不实施业务代码。
