# J-PILOT-02：Highlights 与作品集合同校准

日期：2026-09-10。状态：只读补充核查，未修改API或业务代码，未运行测试。产品依据为[旅程v1.0](J-PILOT-02-产品旅程与状态规则.md)的D08/D10。前端当前核对 `3e330b9c55b619505a3aa8937ac3c672fe8fb858`，后端release仍为 `1ae0b7a46f060e27c7f6db38e0469d15c626e2c5`。

## 本轮结论与责任

| 项目 | 当前能力 | 最小推进方向 | 是否需要产品再确认 |
|---|---|---|---|
| 作品集／GitHub链接 | 没有准确存储字段，现有披露枚举不是链接本身 | 补单链接字段和本人写入／回读；复用profile是候选，需处理普通资料编辑或旧客户端写入误清链接的兼容问题 | 已确认首版保存；字段归属、CAS、校验及兼容属合同设计，不再询问是否接线 |
| Highlights | PDF自动抽取已有；招聘摘要只读候选PUT确认后的标签，且该PUT允许改字 | 建议招聘只读展示直接使用有来源依据的解析结果，不增加候选确认UI，不暗中冒充本人确认；继续按现有隐私规则过滤 | **B02-H01已确认**：取消候选确认前置，解析产物自动用于获授权的招聘展示；后端尚待实现 |

B02-H01已确认的语义是：PDF解析可产出Highlights；候选端不展示、不编辑、不要求确认；招聘方只在原有允许的场景读取经过来源及隐私过滤的原始解析标签。不得把自动抽取等同已经用户确认，也不得从可编辑Summary重新生成它们。没有有效来源或合法标签时为空，不阻塞onboarding。用户已确认该语义；不扩大原有披露权限，实际读取链尚待实现。

**本轮范围控制**：onboarding只一份PDF，补充研究列出的注册后多PDF来源是共享消费者边界，不是要求02新增多附件选择器或让用户再次讨论已排除的场景。若执行Highlights后端改动，须先在合同方案中说明现有招聘推荐／Case读取哪些来源、如何保持01精确PDF及披露语义；无法沿用且必须改变时才提出具体产品选择，不能任取latest掩盖冲突。

**01交集更新**：作品集本人保存候选没有直接修改01对象，但会触及共享简历返回和FE映射；Highlights招聘展示会触及共享privacy摘要与Case工作区消费者。原[静态交集报告](J-PILOT-02-API范围与隔离核查.md)仅覆盖最初的43个操作，不能继续当作新增范围完全独立的证明。两条可并行，不要求02等待01的全部实现；共享字段／投影的修改应声明影响并定向核对。

## 交接与验收

1. 作品集先完成窄合同设计：准确字段、空值与清空、非链接资料编辑保留、旧客户端行为、本人写入与聚合回读；不增加URL抓取、预览、GitHub OAuth或多链接集合。
2. B02-H01已确认；后续按该目标修订读取链，保留来源与隐私过滤。onboarding接线可独立推进；不能只隐藏候选确认UI就宣称招聘Highlights已可用。
3. 真实保存／刷新回读、普通profile编辑不误清URL、冲突／非法输入需定向验证。Highlights若修改需验证原文、来源、空值、角色和隐私阶段；本次均未运行。
4. 已有真实PDF解析失败issue仍是验证风险；无需用它阻止文档与前端接线，但不得宣称真实解析已通过。

以下为两路详细证据。路径行号按各自精确提交读取；当前产品意图优先于旧实现。

---

## 附件A：Highlights源码证据

本次核实 remote-tracking `origin/release/0.2.5` 仍为 `1ae0b7a46f060e27c7f6db38e0469d15c626e2c5`；此处“最新”限本地已获取的ref，未在本子任务额外fetch。源码从01合同worktree读取，以下业务源码与该release相同；01合同commit `264829174` 没有修改这些业务文件。本次只读、不跑测试、不改仓库。

用户本轮明确要求是新的产品权威：Summary可编辑可空；Highlights只来自PDF解析，候选端onboarding/简历页不展示，招聘者可见且不可编辑。不能用旧“候选确认标签”实现反推用户要加确认UI。

## 现状结论

**自动生成已存在，自动成为招聘可见标签的路径不存在。当前必须走候选PUT确认资源，招聘摘要才能读取有效标签；且候选PUT允许改文字，与本轮不可编辑语义不符。只隐藏候选UI，会使未确认的新用户招聘端Highlights一直为空。**

### 生成：真实PDF模型提取并按证据过滤

- `apps/recruitment/internal/worker/resume_parse.go:471-483` 同一次模型抽取产生主解析结果与Highlights sidecar。
- `apps/recruitment/internal/resumeparse/personal_highlights.go:49-93,122-150` 只保留有PDF证据、可归属于经历（含嵌套项目）/教育的条目；profile/summary/skills/certificates等非该来源不生成标签；最多5条、每条24字，非法内容逐条丢弃，合法空数组可完成解析。不是拿用户可编辑summary生成标签。
- `apps/recruitment/internal/store/resume_parse_store.go:300-351` 同一事务加密写入 `resume_file_parses.highlights_encrypted_result`，仅写解析行，不创建 `resume_personal_highlights`。

### 确认：现有唯一业务写入通路属于候选

- `apps/recruitment/internal/mobileapi/handler.go:437-439` 候选角色的来源GET、已确认资源GET、PUT三接口；BFF对应 `apps/recruitment-bff/internal/httpapi/api.go:414-416`。
- `apps/recruitment/internal/mobileapi/personal_highlights.go:289-314` PUT要求If-Match，解码用户items及source，交给service/store。
- `apps/recruitment/internal/store/personal_highlights_store.go:515-574` 同owner/current file+version/succeeded parse，重读建议核实index，绑定在线简历aggregate revision，最后upsert确认表。
- `apps/recruitment/internal/resumefile/personal_highlights.go:98-104,141-185,189-201` 用户可提交编辑后的text；不是只确认原模型原文，修改后扩大disclosure source classes。这与本轮用户“不可编辑”不同。
- 全部非测试Go调用点检索 `PutPersonalHighlights(` 仅 HTTP handler → resumefile service → store，无worker/后台自动确认入口；确认表upsert仅由该store PUT的清空/确认分支调用。不能把自动生成sidecar称为自动发布。

### 招聘读取：读确认表，不回退原解析结果

- `apps/recruitment/internal/store/personal_highlights_store.go:350-375,394-409` 缺确认行=empty；只有active有items。当前active要求源文件仍active、版本仍current ready、parse succeeded、账号active、在线简历aggregate revision仍等于绑定值（同文件:242-251）。修改在线简历可使此旧确认stale。
- `apps/recruitment/internal/privacy/service.go:309-339` 招聘摘要只读该valid confirmed资源，再与本次在线简历快照revision比较；无有效标签返回空数组，绝不读旧parse补齐或再跑模型。
- `apps/recruitment/internal/privacy/recruiter_summary.go:19-28` 字段是摘要下 `personal_highlights: []string`；它与其他推荐card上的 `highlights` 等词汇不能不加核实混用。

## 具体隐私阶段

“招聘者可见”并不等于“任何招聘者任何阶段都可见”。当前仍先经过候选/组织关系与权限围栏，以及标签证据来源的披露规则。

- 招聘推荐卡 `apps/recruitment/internal/discovery/service.go:1165-1197` 只有includeSummary时构建摘要，stage固定 `anonymous`。
- 招聘Case工作区 `apps/recruitment/internal/matchcase/workspace.go:290-322` 以服务端证明 `ValidResumeSubmission` 为准：true才使用 `resume_submission`，否则anonymous；不能仅凭Case阶段名称或客户端参数升级。
- 披露偏好 `apps/recruitment/internal/privacy/policy.go:20-31`：anonymous允许两个阶段，resume_submission仅正式递交阶段，never任何阶段均不允许。
- 来源过滤 `apps/recruitment/internal/privacy/recruiter_summary.go:185-228`：教育标签需要教育披露允许；经历标签需要在线经历非空、没有任何hidden公司且当前雇主披露允许；双来源必须都允许。当前默认 `apps/recruitment/internal/privacy/types.go:175-178` 当前雇主never、教育anonymous，所以默认可能只剩教育类标签，并非解析成功就全显。
- 只更换自动生成/读取方式也必须保留等效来源过滤与权限，不能为了标签可见而提前暴露雇主/学校身份；本轮没有授权变更01投递阶段或隐私偏好。

## 最小选项与下游合同设计边界（研究时态）

推荐合同阶段首先考虑：**直接消费已持久的PDF Highlights sidecar形成招聘只读投影，去掉候选PUT确认作为前置，保留精确来源与隐私过滤。** 已有抽取结果足够，无需加模型任务或在候选端暗中调用“本人确认”。具体实现仍待合同设计；不应无讨论地删除现有API影响旧消费者。

另一个可行但通常更重的选项：服务端自动维护独立来源绑定/发布记录，再让招聘摘要消费。只有明确需要持久指定展示来源/历史稳定性时才考虑；不能直接把原表所有已编辑标签当作纯PDF原生标签，也不能把系统写入记录命名为本人已确认。

无论哪种，以下为工程方案需要明确的下游来源边界，优先保持既有语义；如必须改变既有产品行为再提出具体冲突：

1. 最多3份PDF时，招聘推荐（还没有01单次委托绑定）使用哪一份的哪个成功解析？不能默认最新上传/任意第一份，也不能把多份合并当成已批准。
2. Case摘要是否必须使用01这次已绑定/已递交的精确PDF，还是使用候选当前档案来源？当前旧实现是subject级确认来源，不等于Case绑定。若选Case精确来源，属于明确的共享读取依赖，要共同校对。
3. 换版本、删除文件、只修改在线summary后，纯PDF标签何时更新/失效？旧确认机制的aggregate revision绑定不能自动成为新的产品规则。
4. 用户“候选端不展示”已明确为UI；若要API层也禁止本人读取或删除所有旧确认接口，这是额外兼容处理问题，需要按接口消费者核查，不能仅由该句推断立即破坏性删除。

## 与01交集

目前01合同修改的Negotiation/MatchCaseView等schema不直接定义 `RecruiterCandidateSummary.personal_highlights`，无需改01已确认S0结局、投递确认或PDF选取交互。02可以继续完成onboarding主体。

但新的Highlights自动招聘展示会进入 **同一个招聘Case工作区投影**（`matchcase/workspace.go:299`）、同一个隐私stage证明及共享PDF资源。因而不能继续笼统声称“所有新增范围都与01完全无交集”。正确边界：02拥有PDF生成与onboarding不展示/summary规则；招聘只读投影的调整声明共享消费者，保留01阶段证明和精确版本语义，必要时定向校准01相关读取验收。此项不要求等待01整条实现，也不等于本轮已授权修改01。

本次只证明代码现状与语义差异，没有真实Highlights自动显示验收通过结论。

---

## 附件B：作品集源码证据

2026-09-10，只读研究；用户已确认首版要真实保存，必要后端可补。未修改代码/Spec、未运行测试。

## 版本

本次已对前后端执行 `git fetch origin --prune`。FE `origin/main@3e330b9c55b619505a3aa8937ac3c672fe8fb858`（导出/tmp/pilot02-fe-current），BE `origin/release/0.2.5@1ae0b7a46f060e27c7f6db38e0469d15c626e2c5`（git show阅读）。01合同 `264829174`。这次FE比前次40464f11更新，相关链接实现结论不变。

## 真实现状

- FE一个简历级字符串，非逐经历列表：`src/状态/领域/候选资料.ts:33` `简历作品集链接`；`:234` reducer仅本地赋值。`src/屏幕/工作经历.tsx:80-83`引用全局并派发；`:453-469`整份简历一个输入，onChange更新、onBlur规范化。注释明确不挂某段经历下。
- URL规则：`src/流程/onboarding配置.ts:78-95` trim，无scheme补https；空串合法；非空用URL解析，仅http/https且hostname含点；不是GitHub专属，可作品集或项目网站。没有已定义长度上限，不验证可达性/所有权，不读取网页。
- `工作经历.tsx:184-200`保存前校验链接，但链接不在页面简历写入payload；`引导问答.tsx:150-151`最后再次本地派发，并不真实写入。`src/状态/资料持久化.ts:48-59`作品集仅Mock存localStorage；Backend回读/水合无该字段：`src/数据/后端映射.ts:157-176`、`src/数据/招聘数据源类型.ts:18-34`、`src/状态/领域/候选资料.ts:301`。
- BE在线简历Profile没有链接：`apps/recruitment/internal/resume/types.go:119-131`。Project结构只有id/name/role/result/revision（:150-159），不是URL条目。
- BFF `ProfileWrite` :12011、`ProfileRead` :12788、`ProjectWrite` :12087、`ProjectRead` :12811、`Resume` :12905（均apps/recruitment-bff/openapi/mobile-v1.yaml）没有URL字段。Service对应ProfileWrite:9101、ProfileRead:9124、ProjectWrite:9191、ResumeResponse:9331（mobile-resources-v1.yaml）亦无准确字段。
- 已有 `privacy.disclosure_preferences.portfolio_links` 是披露档枚举，不是URL存储；BFF schema:14101-14112。`apps/recruitment/internal/privacy/projection.go:39`虽有PortfolioLinks []string，BuildContent:96固定空数组，从未从resume填充。不能以已有同名隐私字段认定链接已经支持。

## 推荐最小合同候选（尚未设计批准）

当前明确需求是本人建档时保存/修改/清空一条URL、刷新回读。优先在既有简历profile block增加可空 `portfolio_url`，复用profile revision/CAS、聚合GET和现有保存通道，不新增链接集合、爬取服务、预览、GitHub OAuth或解析PDF新字段。一个字段对应当前一个输入，不能将URL塞进summary/project.result以避免补合同。

涉及公开操作：`replaceResumeProfile`（PATCH /api/v1/me/resume/profile，BFF:2215）与`getResume`（GET /api/v1/me/resume，BFF:2168）；内部对应 `patchResumeProfile`（Service:49）与`getResume`（:23）。写请求ProfileWrite和读ProfileRead增加字段，Resume/ResumeEnvelope、Service ResumeResponse通过引用承载；其他返回整份Resume的写操作会间接受新响应字段影响，需合同兼容核查。新增后端保存/读取、校验和FE映射是必要实现，当前无可直接调用完成此需求的字段。

建议请求值为规范化绝对http/https URL或null，空输入统一转null；长度上限和URL细则于合同阶段确定，不在产品草稿假称既有标准。沿用FE真实规则作为起点，服务端仍必须验证。不要扩展为请求远端URL验证可达性。

**必须处理现有全量替换语义**：当前ProfileWrite明确“省略可选字段和null都清空”（BFF:12016-12018）；直接加可空字段后，任何旧版客户端或没带此字段的资料页保存会清空新链接。这是现实写入风险。最小方案要求同步所有现行FE profile写入路径，使非链接编辑保留权威字段、清空只有显式操作，并在发布安排中明确旧客户端写入是否仍被接受。不能把仅新增字段称作无条件向后兼容，也不能偷偷改现有replace语义。如果必须容忍旧客户端持续写profile且保留链接，则应在合同阶段比较窄独立singleton（独立revision/专属写口）与显式字段存在性策略；不要现在直接引入新通用资源层。当前证据不支持擅自确定发布兼容决策。

## 与01隔离和可见性边界

01 `1ae0b7a46..264829174` 修改的是NegotiationCard/Detail、MatchCaseView/StageSection、委托示例及相关GET排序描述；没有修改ProfileWrite/ProfileRead或getResume/replaceResumeProfile。因此该候选在OpenAPI对象改动上无直接交集，虽然仍编辑同两份大YAML。02不需要依赖01新字段/终局实现。

但简历是01共享上游，aggregate revision会随修改变化；使用01预置候选/02独立新候选隔离验收数据，保留已冻结PDF版本，不把链接改动包装为PDF替换。FE共享后端映射/资料切片需小块协调。

保存本人链接不自动决定招聘方或Agent何时看得到。已有portfolio_links披露策略和匿名投影空数组证明这个消费链并未真实完成。如果本次产品确认也要求对方或己方Agent消费URL，需要明确范围并补受控投影，按现有披露阶段验证；那会触及01共享匿名材料/身份泄露边界，必须重新标交集。仅完成本人保存/回读时不自动修改该投影，不宣称后续Agent已能访问链接，更不自动抓取GitHub内容。

## 合同阶段最小验收要点

真实保存单URL→聚合GET回读→刷新恢复；修改→再次回读；清空；普通基本信息编辑不误清URL；非法scheme等422不写入；CAS冲突不覆盖他处新值；本人以外不可通过建档API读取。上述为建议检查范围，本次未运行，也未为其新增测试基础设施。
