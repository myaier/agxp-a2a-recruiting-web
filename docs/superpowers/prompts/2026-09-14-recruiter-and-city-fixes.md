# 招聘与城市前端修复：零上下文执行提示词

文档review已结束，无未解决required。选择当前宿主对应章节，在新实施session执行；本文件不自动启动实现。

## Claude Code

```text
你在Claude Code的全新实施session，为repository agxp-a2a-recruiting-web执行已批准并完成文档review的最小接线Plan。工作区固定为当前仓库根 .，target origin/main（最终远端refs/heads/main）。复用当前用户工作区，不创建第二个用户工作区，不stash/reset/clean已有改动。仓库文件路径必须使用仓库相对路径；本提示词和Plan足以执行，不依赖先前聊天。

Task count: 4
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

批准 Spec：docs/superpowers/specs/2026-09-14-recruiter-and-city-fixes-design.md（revision 855800e28a9523ea69abda811914d67ae9328dd7，blob 0d19bf56241fab334d53b9b8cfec121351a848ed）。产品正文v1.2由用户批准，原批准revision为7b6e51221a51aac3d52c6c23920ff3237faf1da0、blob为9a76a1c34c1d76cdd810f578ebe8ae133e9ee4ed；前者仅补批准状态。
执行 Plan：docs/superpowers/plans/2026-09-14-recruiter-and-city-fixes.md（revision dae28f5a6657c9c7648b8f181210c1d5d0819288，blob 0ee7d3788420ad68b9bf2469546558654fa17981）。用git对象验证精确版本，工作树已有编辑不能自动替代批准内容；缺对象或文件明确报告，不猜最新文件。

依次读取当前CLAUDE.md、AGENTS.md、批准Spec、Plan的Global Constraints/Task index/角色表及当前Task完整brief（含预期新增/修改/删除文件、接口、测试、完成和停止条件），不先一次读取其他Task正文。外部技能按逻辑skill名称发现，资源按该skill 根目录解析，不固定本机安装路径。开工完整读取development-workflow的assets/execution-contract.md；收尾读取references/final-integration.md和assets/final-integration-contract.md。共同review合同按对应review skill 根目录相对路径../_shared/review-contract.md读取，缺必需skill或合同即报告缺失。

开工记录git状态与HEAD，读取当前remote事实并git fetch origin main，核对规划源码基线5825ff47a27600cbe5591fb1a9a5fe43e7201272后的变化。用户已明确要求从最新origin/main开始，因此仅开工建立START_BASE时允许在当前工作区普通merge最新origin/main并保留批准文档；这是Plan明确的一次起点例外，不授予最终合入/push权。冲突涉及用户改动或产品契约时先报告，不reset/rebase抹掉内容。START_BASE冻结后，确认前只读fetch，不再合target、不执行正式L3、不push。仓库视觉runner内部短期参考worktree按其现有行为运行，不是第二个实施工作区。

登记改动预告：先读取development-workflow的scripts/task_intents.py start --help，再用python3调用该脚本start，--summary描述本任务、--target origin/main、重复--path列Plan全部预期编辑路径，并记录批准契约；检查其他active/paused记录。扩大路径或接口前update，长暂停恢复核对记录，不删除或代写他人记录。所有这些脚本路径都相对于已解析的skill 根目录，不向产品仓库复制工作流基础设施。

本宿主4个Task，必须实际调用superpowers:subagent-driven-development。按Plan逐Task分配implementer、spec reviewer、code-quality reviewer，使用角色表中的Claude Code条件alias；不能因模型或委派不可用偷偷改为主控独自实施，缺能力报告具体阻塞。 实施只计4个编号Task，review/验证/final gate均不计数；不要自动启动其他宿主session。当前工作属于最小前端接线，禁止无关重构。

产品约束：
1. 推荐只保留在招owner job、已水合和非空hiring_organization_ref前提；unverified正常进入注册/读取/下拉/补给/轮询。缺ref只引导编辑岗位选用人企业；无认证CTA。旧精确认证错误保留严格解码，删专用Owner Jobs重读和页面吞错，按失败显示；其他P4幂等/单飞/ID/栅栏/401不改。
2. 未实名公开名预览直接用本地草稿，实名用verifiedName；保存/revision/错误/onboarding跳转原样。招聘者“我”页用已有头像与本人名，失败fallback以主体+URL隔离，职务公司关系独立；不新增档案或企业请求。
3. 城市默认四国独立分页，三入口共用规则；12个大陆+10个海外精选均不含港澳台。标题固定台湾省、香港特别行政区、澳门特别行政区，组内接受API原始英文/拼音。全球搜索保留，不给长尾翻译，不动后端。精选保存canonical ID，复用目录选择值，不造完整BFF字段。向导城市题补加载更多，其他布局与保存上限/历史保持。
4. 不修企业管理员申请、公司信息、名片公司信息或岗位企业读取的后端故障，不伪造组织、默认认证或吞真错误，不通过切Mock声称Backend成功。

真实环境：使用执行环境的AGXP_MONOREPO_DIR定位用户提供的agxp-monorepo checkout，先读后端规则和local启动/fixture文档。若变量未设置，可从环境已知仓库位置核实该checkout；无法可靠定位时只询问缺失路径，不猜测，不在文档写入本机路径。按既有规则准备/复用健康local栈、独立测试账号与agent-browser会话，不能关闭他人服务。22个精选ID在Spec中只有后端快照证据，必须按Task4用真实GET逐项核验国家/城市/ID；CN首页仅快捷路径，未命中继续分页或搜索至精确ID命中或穷尽。核验不属于页面首次加载请求。没有真实核验或新后端推荐成功证据，相关任务/整体交付保持未完成；中文港澳台目录不属于依赖。

验证与收尾顺序：先各Task新增目标断言RED，再最小实现GREEN与定向保护测试，保存证据并提交。全部Task及本宿主执行skill要求的内部全局review完成后，退出Task循环，进入Plan“实施后收尾（不计入Task count）”，覆盖默认finishing-a-development-branch菜单。异构reviewer为Codex，通过相应多轮只读review-loop绑定批准Spec/Plan和固定候选diff；实际读取该skill与共用合同，默认reviewer不跑测试。轮次/裁决/停止归该skill，轮间只跑修复相关轻量测试，不跑完整gate；规划文档review不代替此代码review。

代码review结束后核对实际diff的生产者/消费者/新增删除路径，完成适用L0–L2责任。本前端没有tools/test affected，采用Plan指定的现有npm入口和实际diff清单，不复制后端runner。用户明确要求npm test完整单元、npm run typecheck、npm run lint、npm run build；加现有npm run ui:check并传冻结START_BASE。读视觉报告与diff，不用report模式exit0冒称无差异，不改阈值、基准、授权标签绕过。Backend+local定向浏览器验收在确认前按Plan执行，覆盖未认证企业推荐、名片两入口、我页头像姓名、三城市入口的默认/搜索/分页/真实ID保存回读；正式后端development L3 selection为none，不跑release或Hosted全套。只有已实际运行的路径才可标PASS。

final gate人工确认前完成上述实现、review、完整前端验证和定向dogfood；失败继续归因与范围内最小修复，保留旧证据并只补失效项，不重新进入Task/global或异构review。缺环境/新版后端/真实ID证据记录BLOCKED，不称ready。可就绪时展示候选commit、pre-gate target、完整验证证据、review版本/后续修复差异、复用与增量命令、最终merge/push动作和自主恢复边界，等待用户明确确认。此次规划批准及复制提示词不代替final gate批准。

确认后按development-workflow的final integration合同同步target、记录final_target_base、普通merge、按完整最终diff重算责任，复用仍有效PASS只补缺口；本任务无正式后端L3，真实边界因合入变化时补对应dogfood。cleanup后再次核对证据，核对target未推进再普通fast-forward push至main，不得force push；同一授权范围内故障自主最小修复，不重复索要机械确认，target race/新产品范围/外部权限缺失才报告。确认后不调用异构review，不将未review修复冒称已review。

输出位置：实际Task提交、代码review裁决、验证摘要、START_BASE/final_target_base及合入状态就地记录在Plan“实施记录”；原始日志、截图、网络证据放既有忽略的dogfood-output和ui-regression-output目录，不提交认证材料，不另建handoff/review report/validation summary。最终中文报告根因、实际修改文件、取舍、测试变化、每条命令与结果、后端依赖和实际合入事实；未完成不宣称全部通过。完成或取消更新task intent。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行批准Spec与Plan，不从聊天或本提示词扩展产品设计。
```

## Codex

```text
你在Codex的全新实施session，为repository agxp-a2a-recruiting-web执行已批准并完成文档review的最小接线Plan。工作区固定为当前仓库根 .，target origin/main（最终远端refs/heads/main）。复用当前用户工作区，不创建第二个用户工作区，不stash/reset/clean已有改动。仓库文件路径必须使用仓库相对路径；本提示词和Plan足以执行，不依赖先前聊天。

Task count: 4
Execution skill: superpowers:executing-plans
Model aliases: host-native

批准 Spec：docs/superpowers/specs/2026-09-14-recruiter-and-city-fixes-design.md（revision 855800e28a9523ea69abda811914d67ae9328dd7，blob 0d19bf56241fab334d53b9b8cfec121351a848ed）。产品正文v1.2由用户批准，原批准revision为7b6e51221a51aac3d52c6c23920ff3237faf1da0、blob为9a76a1c34c1d76cdd810f578ebe8ae133e9ee4ed；前者仅补批准状态。
执行 Plan：docs/superpowers/plans/2026-09-14-recruiter-and-city-fixes.md（revision dae28f5a6657c9c7648b8f181210c1d5d0819288，blob 0ee7d3788420ad68b9bf2469546558654fa17981）。用git对象验证精确版本，工作树已有编辑不能自动替代批准内容；缺对象或文件明确报告，不猜最新文件。

依次读取当前CLAUDE.md、AGENTS.md、批准Spec、Plan的Global Constraints/Task index/角色表及当前Task完整brief（含预期新增/修改/删除文件、接口、测试、完成和停止条件），不先一次读取其他Task正文。外部技能按逻辑skill名称发现，资源按该skill 根目录解析，不固定本机安装路径。开工完整读取development-workflow的assets/execution-contract.md；收尾读取references/final-integration.md和assets/final-integration-contract.md。共同review合同按对应review skill 根目录相对路径../_shared/review-contract.md读取，缺必需skill或合同即报告缺失。

开工记录git状态与HEAD，读取当前remote事实并git fetch origin main，核对规划源码基线5825ff47a27600cbe5591fb1a9a5fe43e7201272后的变化。用户已明确要求从最新origin/main开始，因此仅开工建立START_BASE时允许在当前工作区普通merge最新origin/main并保留批准文档；这是Plan明确的一次起点例外，不授予最终合入/push权。冲突涉及用户改动或产品契约时先报告，不reset/rebase抹掉内容。START_BASE冻结后，确认前只读fetch，不再合target、不执行正式L3、不push。仓库视觉runner内部短期参考worktree按其现有行为运行，不是第二个实施工作区。

登记改动预告：先读取development-workflow的scripts/task_intents.py start --help，再用python3调用该脚本start，--summary描述本任务、--target origin/main、重复--path列Plan全部预期编辑路径，并记录批准契约；检查其他active/paused记录。扩大路径或接口前update，长暂停恢复核对记录，不删除或代写他人记录。所有这些脚本路径都相对于已解析的skill 根目录，不向产品仓库复制工作流基础设施。

本宿主始终实际调用superpowers:executing-plans，按依赖连续执行4个Task，计数不改变路由。角色档位按Plan通用档位与宿主模型配置执行；不解析、查找或校验Claude Code的alias，也不因缺少它们报错。不因角色表自行增加subagent流程。 实施只计4个编号Task，review/验证/final gate均不计数；不要自动启动其他宿主session。当前工作属于最小前端接线，禁止无关重构。

产品约束：
1. 推荐只保留在招owner job、已水合和非空hiring_organization_ref前提；unverified正常进入注册/读取/下拉/补给/轮询。缺ref只引导编辑岗位选用人企业；无认证CTA。旧精确认证错误保留严格解码，删专用Owner Jobs重读和页面吞错，按失败显示；其他P4幂等/单飞/ID/栅栏/401不改。
2. 未实名公开名预览直接用本地草稿，实名用verifiedName；保存/revision/错误/onboarding跳转原样。招聘者“我”页用已有头像与本人名，失败fallback以主体+URL隔离，职务公司关系独立；不新增档案或企业请求。
3. 城市默认四国独立分页，三入口共用规则；12个大陆+10个海外精选均不含港澳台。标题固定台湾省、香港特别行政区、澳门特别行政区，组内接受API原始英文/拼音。全球搜索保留，不给长尾翻译，不动后端。精选保存canonical ID，复用目录选择值，不造完整BFF字段。向导城市题补加载更多，其他布局与保存上限/历史保持。
4. 不修企业管理员申请、公司信息、名片公司信息或岗位企业读取的后端故障，不伪造组织、默认认证或吞真错误，不通过切Mock声称Backend成功。

真实环境：使用执行环境的AGXP_MONOREPO_DIR定位用户提供的agxp-monorepo checkout，先读后端规则和local启动/fixture文档。若变量未设置，可从环境已知仓库位置核实该checkout；无法可靠定位时只询问缺失路径，不猜测，不在文档写入本机路径。按既有规则准备/复用健康local栈、独立测试账号与agent-browser会话，不能关闭他人服务。22个精选ID在Spec中只有后端快照证据，必须按Task4用真实GET逐项核验国家/城市/ID；CN首页仅快捷路径，未命中继续分页或搜索至精确ID命中或穷尽。核验不属于页面首次加载请求。没有真实核验或新后端推荐成功证据，相关任务/整体交付保持未完成；中文港澳台目录不属于依赖。

验证与收尾顺序：先各Task新增目标断言RED，再最小实现GREEN与定向保护测试，保存证据并提交。全部Task及本宿主执行skill要求的内部全局review完成后，退出Task循环，进入Plan“实施后收尾（不计入Task count）”，覆盖默认finishing-a-development-branch菜单。异构reviewer为Claude，通过相应多轮只读review-loop绑定批准Spec/Plan和固定候选diff；实际读取该skill与共用合同，默认reviewer不跑测试。轮次/裁决/停止归该skill，轮间只跑修复相关轻量测试，不跑完整gate；规划文档review不代替此代码review。

代码review结束后核对实际diff的生产者/消费者/新增删除路径，完成适用L0–L2责任。本前端没有tools/test affected，采用Plan指定的现有npm入口和实际diff清单，不复制后端runner。用户明确要求npm test完整单元、npm run typecheck、npm run lint、npm run build；加现有npm run ui:check并传冻结START_BASE。读视觉报告与diff，不用report模式exit0冒称无差异，不改阈值、基准、授权标签绕过。Backend+local定向浏览器验收在确认前按Plan执行，覆盖未认证企业推荐、名片两入口、我页头像姓名、三城市入口的默认/搜索/分页/真实ID保存回读；正式后端development L3 selection为none，不跑release或Hosted全套。只有已实际运行的路径才可标PASS。

final gate人工确认前完成上述实现、review、完整前端验证和定向dogfood；失败继续归因与范围内最小修复，保留旧证据并只补失效项，不重新进入Task/global或异构review。缺环境/新版后端/真实ID证据记录BLOCKED，不称ready。可就绪时展示候选commit、pre-gate target、完整验证证据、review版本/后续修复差异、复用与增量命令、最终merge/push动作和自主恢复边界，等待用户明确确认。此次规划批准及复制提示词不代替final gate批准。

确认后按development-workflow的final integration合同同步target、记录final_target_base、普通merge、按完整最终diff重算责任，复用仍有效PASS只补缺口；本任务无正式后端L3，真实边界因合入变化时补对应dogfood。cleanup后再次核对证据，核对target未推进再普通fast-forward push至main，不得force push；同一授权范围内故障自主最小修复，不重复索要机械确认，target race/新产品范围/外部权限缺失才报告。确认后不调用异构review，不将未review修复冒称已review。

输出位置：实际Task提交、代码review裁决、验证摘要、START_BASE/final_target_base及合入状态就地记录在Plan“实施记录”；原始日志、截图、网络证据放既有忽略的dogfood-output和ui-regression-output目录，不提交认证材料，不另建handoff/review report/validation summary。最终中文报告根因、实际修改文件、取舍、测试变化、每条命令与结果、后端依赖和实际合入事实；未完成不宣称全部通过。完成或取消更新task intent。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行批准Spec与Plan，不从聊天或本提示词扩展产品设计。
```
