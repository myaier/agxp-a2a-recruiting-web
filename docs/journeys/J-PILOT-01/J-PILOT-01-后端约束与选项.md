# J-PILOT-01 第二阶段：后端约束与产品选择

## 合入校准（2026-09-10）

本轮执行`git fetch origin`后，确认`origin/release/0.2.5`为 **`1ae0b7a46f060e27c7f6db38e0469d15c626e2c5`**，已包含上轮核对提交`f983182e64ebbe4dceb3e7716c14d85f18e11f5b`（祖先检查通过）。两者间只有4个文件变化：plan验证记录、E2E运行索引、测试catalog及其断言；Recruitment/BFF业务代码、OpenAPI无差异。因此下文源码行号与行为结论继续适用；`internal/...`省略`apps/recruitment/`前缀。

合入plan第561行起的Final gate记录取代上轮“最终测试尚未通过”的时态：

- mobile-local required：第3次PASS，receipt `run-20260910T051828-966c86d7`，测试提交`4f486cf4e`。
- Hub G15 PASS；A10修正布尔断言后PASS，receipt `run-20260910T061917-36579186`，测试提交`f983182e6`。
- L0–L2：记录为`PASS_INCREMENTAL`，复用基础证据并补跑受影响delta；不能描述为最终提交全量重跑。
- `real_model_observation: BLOCKED`（未列出可用真实模型／预算）；前端未实施、STG/prod未部署。本轮只核验Git历史与仓库内报告，未独立读取原始测试receipt、未重跑测试。

证据：release提交下`docs/superpowers/plans/2026-09-10-recruitment-agent-task-continuous-negotiation.md` Final gate执行记录、`docs/testing/e2e-runs/README.md`的2026-09-10记录。前两次mobile失败分别为测试注入缺outcome_code、归档时间精度产品缺陷，均有修复记录；不能统称环境问题。记录仍保留的设计冲突与范围外待办不因合入自动关闭。

OpenAPI blob仍为`1093ef54b04f6a3a5e1a23286b791899f94ba4ac`；plan blob更新为`f346394bdcac9943d29b35af707536e2616465be`。本次只校准J-PILOT-01，不扩展为其它旅程定稿。


批准记录入口：`docs/superpowers/plans/2026-09-10-recruitment-agent-task-continuous-negotiation.md:11`记录批准spec revision `e0334358b5da9fdcd66bb3db3fd78f7bc2b59688`。下称“现合同”包括该批准方向及本分支既有冻结协议，不能自动覆盖前端“需用户处理置顶”的另一个已批准目标。

## 一、草稿必须保留的状态与边界

| 场景 | 当前可表达的结果/动作 | 约束与源码证据 |
|---|---|---|
| pre-Case accepted/evaluating | 显示持久化卡片，等待/刷新；**无取消、无归档、无再次retry** | `internal/discovery/negotiations.go:116`及`:450–467`仅给无Case技术failed卡retry/archive。公开API只有list/get/retry/archive（`apps/recruitment-bff/openapi/mobile-v1.yaml:8201/:8238/:8271/:8315`），没有cancel。不要把关闭页面或隐藏卡片称为撤回委托。 |
| pre-Case技术failed | 可在当前架构内显式retry或archive；归档后仍可retry返回active | 当前卡片动作与失败类别分别读取：failure.retryable不代替actions.retry。事务仍可因generation、pair/quota、当前岗位/意向/附件/授权门拒绝。retry恢复同卡及历史，不重选新PDF/新授权；需要新输入不应伪装同任务重试。`internal/discovery/negotiations.go:108–125/:450–467`；`internal/store/discovery_store.go:2650–2664`；plan`:172–180`。 |
| pre-Case refused | 业务拒绝进入history，可回读，不提供技术retry | plan`:143–144`；不要用“AI出错”描述not_fit或业务拒绝。反过来，技术failed不得显示“不匹配”。 |
| v3成功 | 展示公开初评区块；由原委托继续promotion，而非让用户再次批准启动S0 | fit/not_fit/uncertain只要是candidate_agent completed均可沿已授权delegation promotion；独立evaluation next_action不变。不得用v3的stop建议自行截断这条委托。plan`:20`；`internal/discovery/reconciler.go:275–298`的候选推进实现与既有promotion逻辑。 |
| S0 needs_user | 有剩余轮次：补事实或结束；三轮耗尽：只结束；按详情available_actions呈现 | `internal/matchcase/lifecycle.go:509–517`。不能加一个“我觉得合适，直接通过”的continue按钮；`internal/store/case_store_policy.go:14–22`的旧decision入口实际只准许指定条件下的end。 |
| S0 Agent attention_required | 显示安全技术失败、保留已接受记录；**无现成retry，也无适用于attention的人工继续/结束动作** | `internal/matchcase/types.go:55–81`固定retryable=false；`lifecycle.go:496–518`不为attention生成操作；`internal/store/case_store_policy.go:14–22`仅允许needs_user/human_decision或未披露简历特定等待时end。该Case仍open，不可用pre-Case archive假装结束。 |
| S0通过且授权附件ready | 自动披露进入S1；试点可以到此交接观察，但不能暂停服务端或承诺“还需点击一次才递交” | `internal/store/case_store.go:618–646`绑定candidate_delegation授权；`internal/store/case_coordinator_store.go:919–955`消费ready binding并披露，`:941`明确没有单独客户端请求。不增加S0→S1确认。 |
| S0通过但附件未ready | 进入解析等待/需要用户动作，按返回状态检查或换附件；不是已递交 | `internal/matchcase/lifecycle.go:519–530`：披露前等待没有worker自动recheck，解析后来成功需用户显式retry_resume_readiness。该retry与Agent失败retry不同。 |

**增加已开Case retry的影响（新增建议，尚未获批）**：必须先决定重跑哪个失败阶段/任务、复用还是更新快照、剩余轮次与deadline如何处理、已接收submission/历史如何保留、对方已回答或用户动作的并发优先级、迟到旧结果如何拒绝。不能直接把新`retryCandidateNegotiation`开放给Case：它刻意排除有效Case，且通过既有Evaluation.Retry恢复pre-Case任务。若只需要失败后离开列表，新增“技术失败Case结束”比跨阶段retry范围小，但仍需新业务终局/命令及授权合同，不能称为已有能力。

## 二、刷新与“结果未知”的恢复规则（主稿D06已确认）

用户已确认：提交结果未知先核对已有记录；无法确认则保持待核对并交负责人排查，不显示确定失败或自动新建。以下幂等与读取约束用于下一阶段对齐接线，不意味着客户端已经实现跨刷新恢复。

- **区分三种“未知”**：网络失败导致请求是否被接受未知；任务仍在pending/evaluating；Agent业务回答unknown。三者不能用同一“失败→重新开始”处理。
- 接受过的卡片/Case由服务端存储恢复，刷新读`listCandidateNegotiations/getCandidateNegotiation`，按返回canonical record_id upsert；Case已经commit而delegation.case_id尚未回写的窗口由现有canonical关联弥合。证据：plan`:131–139`；`internal/store/negotiation_store.go:48–80`。
- POST create/retry超时不能换新key盲发。**若保留原请求和原key**，同key同payload重放可读回原receipt；retry还需保留当次expected_retry_generation，不能拿刷新后的generation构造“同一次”重试。证据：`internal/store/discovery_store.go:2691–2708`，receipt先于当前状态门回放。
- 服务端可持久恢复不等于客户端刷新后自动知道原key。产品草稿应写明：未知写入后先“核对处理结果”，通过原请求重放/统一列表恢复；拿不到key或record_id且不能唯一辨认时保持“待核对”，不显示确定失败、不自动新建。客户端原key/请求在刷新后如何保留属于下一阶段接线合同待核项，**本次没有核验前端已实现**。
- worker有稳定的`evaluation-create:<delegation_id>`、`promotion:<delegation_id>`以及显式retry的`delegation-retry:<delegation_id>:<generation>`；重启/重复消费不要求浏览器重新授权。generation fence阻挡旧worker写回；失败历史保留。证据：plan`:28–29/:175–179`及`internal/discovery/reconciler.go:231/:289/:343`对应键构造。
- list基础设施不可用为503，不得降级成“无记录/业务unavailable”；跨请求不是数据库snapshot。新列表按创建时间分页，旧记录恢复后可能需刷新第一页重新找到，重试不改created_at。证据：plan`:138/:145–147`；`internal/store/negotiation_store.go:240–272`。

## 三、已确认选择与剩余产品选择

本附件D2对应主稿D04，用户已确认运行中取消延后；本附件D3对应主稿D02，已获用户确认，见下文。产品决定不等于本轮实施许可。S1自动披露、v3建议性边界及技术/业务失败区分已有规则，不重新请求批准。

### D1：已开Case的S0技术失败——用户已确认，不再开放

首条试点接受：保留已完成进度与结果、明确显示技术故障，由试点负责人排障；用户自助重新执行延后。pre-Case同卡retry仍在试点范围内。该决定不承诺人工排障后一定能继续或结束，不新增结束动作，也不授权内部接口强改状态。现有attention无用户动作的事实保持；详情应允许退出并在之后回查，不能把退出页面称为结束Case。

### D2：pre-Case处理中是否必须允许撤回委托？（主稿D04已确认A）

- **A（推荐，沿现合同）**：accepted/evaluating仅等待/刷新，技术失败后可归档或重试；页面说明离开页面不撤销已给出的委托和后续S1授权。
- **B（新增）**：提供明确cancel；必须覆盖与task接受、evaluation完成、Case创建、自动S1披露竞争的成功/太晚边界，不能用archive替代，也不能保证点了就撤回已披露材料。

### D3：统一列表如何满足“需用户处理置顶”？（主稿D02已确认）

用户已确认选项A：全局需要本人处理优先，同组按创建时间从新到旧。S0待本人补事实、pre-Case技术失败且允许retry/archive属于待办；已开Case仅交负责人排障的技术故障不属于用户待办，仍标出故障。服务端排序、游标与分页合同须在后续阶段对齐，当前创建序合同不能视为已满足。本节其余选项仅保留讨论依据，不再开放选择。

现冲突是**合同目标冲突，不是现后端实现违约**：新协议固定created_at/record_id DESC（plan`:145`、`negotiation_store.go:272`）；旧Case活跃列表按viewerNeedsAction、updated_at、case_id排序（`internal/store/case_workspace_store.go:242–250`）。

- **A（推荐，如果置顶指整个统一活跃列表）**：明确修改尚未合并的新列表合同，让服务端统一排序。需定义pre-Case失败是否属于“需用户处理”，并同步cursor和动态状态翻页边界；复用现有Case viewer动作判断，不新增通用排序配置。
- **B（需产品明确收窄）**：统一流保持创建时间；另保留已有Case待办入口/区域，清楚标注它不覆盖全部pre-Case失败。此选项不等同“所有需处理统一置顶”，不能默默替代原目标。
- **C（需明确临时范围）**：第一试点只围绕刚发起的一张卡做详情/刷新/恢复，暂不宣布统一列表置顶完成；记录D3为后续列表接线阻塞。适合先验证单条旅程，但不是最终列表体验。

不推荐把当前已加载的一页在浏览器里重排后宣称全局待办置顶；分页之外的旧待办或技术失败仍可能不可见。也不建议为第一试点一次性抓完无界历史或建立新工作流系统。

## 自主投递讨论补充（主稿D05，原Q06已关闭）

release `1ae0b7a46`下，`apps/recruitment/internal/discovery/reconciler.go:275–298`对candidate_agent completed推进S0，不按v3 fit/not_fit/uncertain拦截。S0转换在`apps/recruitment/internal/store/case_coordinator_store.go:1036–1064`：首轮evaluate_job或问答后reevaluate_job的not_fit直接ended，fit为passed，uncertain才进入问答或needs_user。该文件`:919–955`处理通过后的自动原件披露。`apps/recruitment/internal/store/case_store_policy.go:14–22`的旧decision只允许特定状态end，不支持用户覆盖not_fit后投递。

v3与v2职责可参见同提交`apps/hub/application-skills/recruitment-v1/SKILL.md:13–15`和连续代谈plan`:19–22/:80`。用户已决定本版本不增加自主投递，保持S0 not_fit直接结束，v3建议性判断仍按既有委托继续核实。此前讨论的持久用户决定及合法披露路径均明确延后；如以后重启，不能只增加浏览器弹窗、复用技术retry或伪造fit。本轮无此实施要求。

## 等待规则确认（主稿D07）

用户已确认首条试点不承诺固定完成或人工响应时间，展示真实进度并支持刷新；不按前端计时判定失败，服务端报告超时/故障时据实显示，按既有失败类别保留动作并交负责人排障。额外通知渠道延后。该决定不取消服务端现有任务deadline，也不新增后端SLA或通知接口。

## D08澄清后的新增语义冲突

本试点S0不请求双方用户额外输入。上文记录的现有needs_user/respond_fact是实现事实，已不属于目标路径。release `1ae0b7a46`的`apps/recruitment/internal/matchcase/lifecycle.go:509–517`在尚有预算时给补事实/结束、耗尽只给结束；`apps/recruitment/internal/store/case_coordinator_store.go:1054–1064`在uncertain/stop时仍进入needs_user。仅隐藏表单会留下无法自动收敛的Case。主稿D09（原Q07）已由用户确认“信息不足自动结束、保留结果、不递交”，不能等同semantic_not_fit或技术失败；需要下一阶段对齐转换、结果与历史状态。S0聊天显示己方右、对方左，PDF递交展示归S1，不改变现有授权或提前披露。

用户另确认人工补充事实归S2“需要协调”，详见[S2阶段澄清](../S2/S2-需要协调阶段产品澄清.md)。当前S2的decide_coordination不能视为已具备补事实闭环，本轮仅记产品方向，不实施S2。
