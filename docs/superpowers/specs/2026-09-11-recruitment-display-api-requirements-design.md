# 双端列表、在线简历与职位详情接线需求

日期：2026-09-11。状态：需求清单/设计候选，待用户审阅；不是已批准的实施 Plan。

用户已确认把必要后端补字段纳入评估，并追加在线简历、职位详情。本文覆盖现有信息位置和相关读取接口，不实施代码、不新增另一套页面。候选端本人的在线简历编辑接口也纳入来源核对，但不将本人简历直接暴露给招聘方。

## 1. 核对依据与结论

核对 FE `d8e69a03c32950574ceee5435e68f84e3cf2cbc5`，BE `release/0.2.5@405d2788c9eb3f21dfdd0a9fdb75990627a2bac0`。

后端文件（以下 BE 路径均相对后端仓库）：

- 浏览器公开合同：`apps/recruitment-bff/openapi/mobile-v1.yaml`。
- recruitment 内部读取合同：`apps/recruitment/openapi/mobile-resources-v1.yaml`；对应 BFF 增量必须同步内部生产者及其真实投影，不能只改 YAML。
- `contracts/api/openapi.yaml` 是 AGXP 公共 API，不是这组移动招聘页面的主合同。
- 实现依据：`apps/recruitment/internal/privacy/projection.go`、`privacy/recruiter_summary.go`、`privacy/service.go`、`discovery/negotiations.go`。

前端依据：`src/数据/发现推荐映射.ts`、`招聘候选摘要映射.ts`、`详情展示映射.ts`，`src/屏幕/P5/MatchCase列表.tsx`，`src/屏幕/匿名在线简历.tsx`，`src/组件/在谈详情/在线简历正文.tsx`，`src/屏幕/职位详情展示/准备职位正文.ts`。现有三类卡片、详情统一 Spec 和 J-PILOT-01 产品规则继续作为布局与业务约束。

静态结论：主体接口已存在；招聘摘要已接；主要缺口是 Case 的展示上下文和结构化在线简历。公司资料、发布人头像有部分现成能力，不能全部列作后端新增。未调用真实 API，不据此判定某个账号的空字段是缺资料还是运行故障。

## 2. 范围与最小方案

覆盖：候选市场、候选在谈、招聘推荐、招聘在谈；市场进入的独立职位详情；推荐进入的匿名在线简历；在谈详情内的职位资料和在线简历 Tab，以及两端详情头部。

方案：复用现有 endpoint；列表只补紧凑展示事实，完整正文只进入详情。公开公司页复用已有读取，不把整份企业档案塞进每张列表卡。新候选在谈以 `/me/negotiations` 为目标入口；招聘在谈继续用 recruiter MatchCase。已接字段保留解码和映射，只修漏接。共享少量确实被多个 endpoint 消费的具体 schema，不增加通用字段引擎、聚合服务或新状态库。

比较：仅前端接线无法提供缺失的 Case 正文/分数；把列表都改成逐卡拉岗位、公司、简历会引入请求放大，还会混入当前资料与历史事实。选择服务端补 Case 上下文、前端复用公开公司读取的方式。

非目标：重新计算推荐算法、生成新的 AI 批注、改阶段决策协议、提前开放真人直聊、把 PDF 解析结果当已确认在线简历、重做公司/个人编辑页。§8 明确列出本次默认不补的展示槽及重新考虑条件。

## 3. 已有字段与接线任务（不要重复新增）

| 页面/信息 | 已有公开来源 | 所需工作 |
| --- | --- | --- |
| 招聘两列表的性别、经验、状态、学历、最近工作/教育、个人亮点 | recruiter 推荐列表及 open MatchCase 列表的 `include=candidate_summary` | 已请求并映射；检查真实响应和源资料，不再新增相同字段 |
| 推荐分 | 两端推荐的 `match_score` | 保持真实 0；这是批次分，不是持续谈判分 |
| 市场/独立职位正文 | `CandidateJob.title/description/requirements`、薪资、location、office_location、workplace_mode、annual_salary_months、经验/学历要求及确认字段等 | 已有；按页面逐项完成现有字段映射，不重复设计另一份 JD |
| 公司行业、规模、融资、介绍、地址、福利、Logo | `GET /api/v1/organizations/{organization_id}` 的 `profile.industry/company_size/funding_stage/company_intro/office_address/benefit_codes/logo` | 由真实 `hiring_organization_ref` 读取；同一组织复用现有快照/请求，不按名称猜 ID |
| 发布人姓名、职务、认证、头像 | `CandidateJob.publisher_profile.public_name/title/personal_verification_status/avatar_url` | 头像当前映射未带出，需要 DTO/解码/视图/图片组件全链路接入；不是新增头像接口 |
| 候选本人完整在线简历 | `GET /api/v1/me/resume` 的 profile、summary、skills、experiences[].projects、educations | 作为已有资料来源；招聘方不得调用它获取对方简历 |
| 委托、连续在谈状态及操作资格 | 推荐 delegation；`NegotiationCard.phase/case_state/needs_action/failure/actions/retry_generation` | 前端接入已有新协议，accepted/evaluating 也进入连续在谈；不新增本地假成功 |
| 已开 Case 阶段、待办、可用动作、S0 记录、S1 PDF 和最终会话 | 两端 MatchCase detail 的已有字段及现有展开机制 | 保留原权威来源；本次展示字段不能取代动作授权 |

候选摘要合法空值：源简历未填、披露策略、最近经历自身缺值、个人亮点未确认/失效/被披露规则过滤都可能造成空值。接口本身不能区分所有空因，前端继续中性未知，不把所有 null 称为“未披露”。

## 4. 后端必须补齐的 endpoint 清单

以下字段名是本次建议合同，均不是声称当前已存在。新增展示字段采用固定键和显式 null；准确 schema、枚举和兼容发布方式在批准后的 Plan 冻结。

### R1 候选连续在谈列表与详情

Endpoint：

- `GET /api/v1/me/negotiations`
- `GET /api/v1/me/negotiations/{record_id}`

| 新增字段路径 | 类型/内容 | 用途与来源 |
| --- | --- | --- |
| `job.organization` | 对象或 null，见 §5 | 公司名、行业/融资/规模短行、Logo；不能再只有 job_id |
| `job.required_skills` | string[] 或 null | 保留目前旧在谈列表已能显示的技能；迁移新接口不能把它们丢掉 |
| `job.recruitment_type` | 既有招聘类型枚举或 null | 与市场卡同口径的岗位属性 |
| `job.workplace_mode` | 既有办公方式枚举或 null | 办公方式标签 |
| `job.annual_salary_months` | integer 或 null | 年薪月数标签，缺失不得默认 12 |
| `match_score` | integer 0–100 或 null | 与产生该记录的原始推荐批次关联，规则见 §7 |

详情另外增加 `job_detail`（§5 的完整安全职位正文或 null）；其 `case_detail` 同步消费 R4 的扩展。无 Case 的记录也可打开记录详情，不能强行按空 case_id 跳 Case 页面。

维持现有 `record_id`、phase、shelf、actions、needs_action、游标和去重规则；不把公司资料是否齐全当在谈是否存在的条件。来源不可读时按照现有 availability/权限语义返回 null，不退回当前活跃 Job 冒充原始事实。

### R2 招聘在谈列表

Endpoint：`GET /api/v1/recruiter/match-cases?include=candidate_summary`。

新增 `items[].match_score: integer | null`，来源见 §7。

现有 `candidate_summary` 七组字段不扩成完整简历；继续保留原展开条件、隐私门控、排序和分页。不能为填亮点改用推荐 `highlights` 冒充候选 `personal_highlights`。

### R3 推荐进入的匿名在线简历

Endpoint：`GET /api/v1/recruiter/jobs/{job_id}/candidate-recommendations/{recommendation_id}`。

增加详情专属 `candidate_resume: object | null`，字段见 §6。不要把完整在线简历放进推荐列表的每个元素。

当前该 endpoint 使用与列表相同的 DiscoveryRecruiterCard，明确排除了详情性别且不允许 candidate_summary。因此必须给详情单独命名 response schema，保留已有推荐字段，追加 candidate_resume；同步修订“detail exactly equals card”“gender undisclosed”等冲突说明及严格解码器。不能仅让前端临时携带 `include=candidate_summary`，现有详情不支持该参数。

匿名内容优先复用已有 `privacy.CandidateContent` 的安全工作、项目、教育投影，扩展浏览器公开出口；不直接序列化 owner Resume。性别仅按与已批准列表摘要相同的授权范围，在新候选简历摘要中提供，不顺带加入年龄、出生日期或其他身份字段。此项是有意识的公开合同扩展。

### R4 在谈中的在线简历与职位详情

Endpoint：

- `GET /api/v1/recruiter/match-cases/{case_id}`
- `GET /api/v1/me/match-cases/{case_id}`

两端 detail 新增：

- `match_score: integer | null`。
- `job_detail: object | null`：完整安全职位正文，见 §5，候选端职位 Tab 直接使用。

招聘端 detail 额外新增：

- `candidate_resume: object | null`：§6，供匿名画像头部和在线简历 Tab；不把推荐详情缓存当 Case 简历。

公司名称、分数同时服务详情头部，不能让顶部未知而正文已知。现有 job 四事实继续保留，新增正文与它们来自同一 Case 绑定版本，不覆盖原字段。现有已结束/已完成 Case、已删除账号的保留规则仍有效；无法合法读取原始资料时返回缺失，不扩大读取权限。

R1 详情嵌套的 `case_detail` 使用同一扩展 schema；重复的分数/职位事实必须同源一致，不分别重算。

### R5 市场与独立职位详情的公司摘要

Endpoint：

- `GET /api/v1/me/job-recommendations`：`recommendations[].job.organization`。
- `GET /api/v1/jobs/{job_id}`：`organization`。

新增 §5 紧凑公司摘要，放入两处共用的 CandidateJob schema。理由是市场列表需要公司短行和 Logo，单页不应为每张卡读取整份公司档案。独立职位详情的完整公司介绍、地址和福利继续通过已有公开公司 endpoint 按需读取。

`publisher_profile.avatar_url` 已存在，仅接线；候选推荐的 refresh 响应若使用相同 CandidateJob schema，也必须同步实际序列化新字段。查询参数、委托入参和写动作不因展示扩展改变。

### R6 旧候选在谈列表的边界

`GET /api/v1/me/match-cases` 不再作为目标连续在谈首页的数据源。本次不为它再做一遍独立公司/分数扩展。其既有消费者在迁移前仍按原合同工作；R4 的 Case 详情必须补齐，因为新连续详情仍会消费。

历史页不是本次页面改版范围，但共享详情 schema 的扩展必须可读，历史/撤回/源不可用都允许 null。不得偷偷用当前 Job 给历史补快照。

## 5. 公司摘要与职位正文的准确内容

### 5.1 `organization` 紧凑公司摘要

| 字段 | 类型 | 语义 |
| --- | --- | --- |
| `organization_id` | string 或 null | 可公开读取的真实组织坐标；未认证声明可能没有 |
| `display_name` | string 或 null | 岗位所属招聘公司名称，不冒充招聘者本人雇主 |
| `industry` | 既有 CatalogReference 或 null | 取 display_name 展示，不发明行业 |
| `company_size` | 既有公司规模码或 null | 前端复用现有公司码表 |
| `funding_stage` | 既有融资码或 null | 同上 |
| `logo` | 既有公开媒体描述或 null | BFF 内容 URL；不下发 object key，不用静态公司名匹配替代真实 Logo |

未认证但已有 company claim 时可以仅有 display_name，其他 null；不能因完整公司档案不存在而丢掉合法公司名。列表“公司简介”实际是行业/规模/融资短行，由真实非空段组合，不新增一个重复存储的 summary 字符串。

### 5.2 `job_detail` 安全职位正文

字段复用 CandidateJob 的既有命名与类型：`title`、`description`、`requirements`、`recruitment_type`、`category`、`location`、`office_location`、`workplace_mode`、`salary_lower`、`salary_upper`、`salary_period`、`annual_salary_months`、`campus_cohort`、`internship_months`、`onsite_days_per_week`、`experience_requirement`、`education_requirement`、`hard_requirements`、`structured_requirements_confirmed`、`keywords`。

另含 §5.1 的 `organization`，以及完整公司展示字段 `company_intro`、`office_address`、`benefit_codes`；含 `publisher_profile`（公开姓名/职务/认证/头像）供对接人卡。公司地址与岗位办公地址是两件事，不互相代填。所有历史缺字段允许 null；已知不限/否定值保留原语义。

这里只复用候选可读岗位字段，不复制 OwnerJob 的权限/主体/管理字段。详情有多个实际消费场景才共用这份具体 schema，不做任意实体的通用 snapshot 框架。

### 5.3 当前值与冻结值

- 市场/独立职位：沿用当前 CandidateJob 和当前公开公司资料。
- 未开 Case 的连续记录：跟随其当前可读 Job；不可读按现有 unavailable 处理。
- 已开 Case：JD 正文、结构化要求和公司/发布人展示身份来自 Case 建立时绑定的展示事实。现有快照不足就补生产/保存链路；GET 不重新读当前 Job 拼正文。
- Logo/头像的内容访问仍实时执行现有媒体授权与删除规则，快照不代表永久可下载；图不可用显示占位。
- 老 Case 原快照没有的字段为 null，不做按 job_id 查询当前资料的伪回填。持久化细节在 Plan 核对实际存储后选择最小改动。

## 6. `candidate_resume` 结构化安全在线简历

| 字段 | 建议类型/成员 | 页面用途及边界 |
| --- | --- | --- |
| `summary` | 复用 RecruiterCandidateSummary 的七字段对象或 null | 性别、年限、学历、状态、最近职位与个人亮点，摘要规则一致 |
| `self_description` | string 或 null | 个人优势正文，来源是现有 Resume.summary，不是推荐算法摘要 |
| `skills` | string[] 或 null | 专业技能 |
| `experiences` | array 或 null | 每项 `company/industry/title/start_month/end_month/description/internship/projects`，复用已有匿名投影 |
| `experiences[].projects` | array | 每项 `name/role/result`；作为项目区展示，不带 owner entry ID/revision |
| `educations` | array 或 null | 每项 `institution/major/degree/start_month/end_month`，目录展示名；支持多段 |
| `expectation` | 对象或 null | `recruitment_type`、`job_category`、`locations`、`workplace_modes`；只从该推荐/Case 绑定意向中选择允许披露的事实 |
| `compensation_relationship` | 既有 overlap/near_miss/disjoint/unknown 枚举 | 求职期望旁薪资关系，不发送候选期望薪资数值 |

建议采用的新命名是为了避免“简历 summary”和“七字段摘要”混淆。无来源/未获准展示的整区为 null；成功读取且确无条目的集合为 []。end_month=null 在真实经历中继续表示至今，不混用为未知截止时间；无整个经历时不制造记录。

安全及版本规则：

1. 推荐详情读取当前已确认在线简历，并重新执行当前隐私门控。
2. Case 详情展示 Case 自己绑定的已确认在线资料版本，并叠加当前权限/撤回限制；不得未经说明换成最新简历，也不自动把 S1 PDF 当在线简历。绑定快照未存某区时返回 null。
3. 工作/项目自由文本必须走后端已认可的匿名投影规则；扩展到浏览器时检查已知身份/联系方式的披露边界，不能因为字段在 owner Resume 存在就直接发布。
4. `expectation` 是新增的招聘方安全投影，复用选定意向的公开可披露部分；不发送 intention_id、薪资数字、私人偏好、排除公司/规则。没有唯一绑定意向或授权来源时 null，不选“第一条意向”。
5. 性别按摘要授权范围提供；不新增年龄、真名、电话、候选主体 ID、出生数据。学校/公司按既有披露策略；不能让列表、推荐详情与 Case 阶段权限彼此绕过。
6. 不新增“真实性已双向核验”“一致性已确认”的布尔装饰字段。现有确切阶段记录可供说明，缺证据不显示肯定文案。

## 7. 分数与匹配分析

新增到在谈的 `match_score` 统一定义为“产生该记录的推荐批次匹配分”，不表示谈判成功概率，不实时重算。两端视角分数分别按各自可追溯来源取值；只有一侧有来源时另一侧允许 null，不复制对方私有评估。

- 有原始推荐关联：沿持久 delegation/Case 关联取该批次真实分，可为 0。
- 直接岗位委托、主动接触、缺少该查看者推荐来源、历史关联缺失：null。
- Case 阶段推进、简历后来编辑、岗位后来改薪资不改变批次分。
- 独立职位 `GET /jobs/{job_id}` 仍无意向/推荐坐标，不增加一个无上下文全局分数。页面有原推荐坐标时用该推荐分，硬刷新无法恢复时显示未知。

匹配分析首先复用已有真实结构化岗位要求与授权简历事实，并明确核对来源；不把推荐批次分解释为当前本地核对的计算结果。Case 分析只核对同一 Case 的绑定资料；证据不足则保留未知。S0/S1 的真实结论继续使用阶段专属记录，候选的 `agent_summary` 不公开给招聘方。

本次不新增 match_analysis 生成服务，不为了填满 Mock 的自然语言批注要求后端现场调用模型。

## 8. 无可靠来源的槽位：完整登记，默认延后

这些位置已评估，但不是“加一个读字段”能解决；默认保持未知/无该说明，避免把本次接线扩大成新的资料采集和内容生成系统。

| 槽位 | 现状 | 本次处理；重新考虑条件 |
| --- | --- | --- |
| 公司成立日期/年份 | OrganizationProfile 没有该字段 | 保持未知；确需填写时再给组织 profile 的 GET/PUT 增加 `founded_date`，并同步公开 GET 与管理表单；不能用 verified_at 代填 |
| 发布人备注 | RecruiterProfile/PublicRecruiterProfile 无对应正文 | 保持未知；产品确认其含义与编辑入口后，在 recruiter profile GET/PATCH 增加 `bio` 并投影到 publisher_profile |
| 项目独立起止时间 | ProjectRead 只有 name/role/result 等，无独立时间 | 保持未知；确需采集时给经历下 projects 的 POST/PUT、ProjectRead、匿名项目增加 start_month/end_month；不能直接挪用雇佣时间 |
| 项目/经历 AI 批注、求职期望一致性绿条 | 无对应已保存权威事实 | 不生成；未来有定义明确的生成、确认与失效来源再接 |
| 招聘端候选薪资数字、年龄、提前直聊 | 现有匿名/阶段合同明确限制 | 不作为缺字段补齐；修改需独立产品与权限契约 |

若用户要求所有槽位都能录入真实值，前三项可以加入本 Spec 修订版，但必须同时包含写入/采集/读取链路，不能只给响应增加永远为空的字段。

## 9. 发布兼容与验收要求

新增字段需贯穿内部 OpenAPI、实际来源投影、BFF DTO/校验与媒体映射、BFF OpenAPI、前端 DTO/严格解码、视图映射、共享展示组件。现有 strict decoder 可能拒绝新字段，应冻结协调发布方案或明确版本/展开边界，不把“JSON 添加字段”假定为天然兼容；不引入全局宽松解码。

最低验收清单：

- 每个 R1–R5 endpoint 有合法完整/部分空/历史缺值的序列化与消费证据；列表无完整简历大对象、无逐卡资料请求放大。
- 改岗位/公司/简历后，独立页显示当前事实，已有 Case 仍显示其绑定事实；旧快照不伪回填。
- 推荐列表→匿名简历→在谈列表→Case 在线简历，字段在同一授权/版本条件下保持一致，隐私收紧后不残留旧内容。
- company claim 无组织 ID、组织不可读、媒体删除、候选不可见、无匹配来源、真实 0 分、多段经历教育、空亮点均正确展示。
- 新连续列表含 accepted/evaluating/失败/Case；切意向、换主体、分页去重、待办排序、重试/归档按现有合同；旧游标失效按已有规则重读。
- 页面组件保留现有布局；320px/390px 验证真实图片、长文本、部分空值；不通过假数据或变更权限消除占位。
- 文档核对不等于真实后端验收；实施 Plan 按两仓库测试规则选择受影响测试，不在需求阶段宣布通过。

## 10. 审阅与后续

2026-09-11：用户要求完整 endpoint/字段需求列表，并把在线简历与职位详情纳入评估。该要求授权本需求清单，不等于已批准上述新公开字段的最终 schema 或实施。

请审阅 R1–R5、§5–§7 的数据来源与 §8 延后边界。批准 Spec 后才编写实施 Plan、执行异构文档 review、生成新会话实施提示词。本会话没有修改两仓库业务代码或运行真实业务动作。
