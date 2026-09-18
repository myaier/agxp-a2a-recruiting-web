# 六维解释与展示对齐执行提示词

最终交付；选宿主对应章节复制到新实施session。同一Spec/Plan固定版本，真实环境验收由用户负责。

## Claude Code

```text
你在全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的完整计划。当前工作区固定为仓库根 `.`，target 为 origin/main。复用当前工作区，不创建第二个用户工作区，不自动 stash/reset/clean 已有内容，不部署，不修改或启动后端。

批准 Spec：docs/superpowers/specs/2026-09-17-match-explanation-wiring-design.md（revision 3，blob e03157e2239104e52c278aadbd71d2c5fb3ef6da）。
执行 Plan：docs/superpowers/plans/2026-09-18-match-explanation-wiring.md（revision 2，blob ce6d78dab29d7b26a74cae1c5c6abb4b9809adda）。

先检查当前分支、工作区状态与上述两文件的 git hash-object。仓库文件路径均为仓库相对路径；不把规划机器目录写入交付。两份内容须匹配固定blob，文档提交已在本分支；不reset到旧基线。不把其他同名/旧日期计划或本地未跟踪预览作为批准设计。当前源码核对基线为84fd3c114c6ea41c89f771c69f43a0ab047b81d0；在其后实施，差异先核对，不覆盖已存在成果。

Task count: 10
计数仅含编号实施Task；异构review、affected/L0–L2与final gate不计入。
Execution skill: superpowers:subagent-driven-development
Model aliases: Claude Code only

本宿主为Claude Code，10个实施Task必须实际调用superpowers:subagent-driven-development，每Task独立实施者和spec/code-quality两阶段宿主内review，档位按Plan角色表。只在此宿主解析Claude Code条件alias（sonnet/opus；fable/opus是备选，不是字面模型名），不可满足时报阻塞，不静默降档。控制者负责全部Task连续完成与收尾，不创建第二工作区。异构reviewer为Codex，按以Codex为reviewer的多轮只读review-loop调用；绑定批准文档和固定候选，共用合同从该skill 根目录的../_shared/review-contract.md读取。

执行顺序和必须保持的产品边界：
1. 先完整读取AGENTS.md、CLAUDE.md、docs/testing/README.md和批准Spec；再读Plan的Global Constraints、C1–C4、Task index/角色表与当前Task完整正文。每推进一个Task读取其输入、预期新增/修改/删除文件、反例、命令和完成条件，不凭聊天记忆开工。
2. 实际调用本宿主指定execution skill。外部skill用逻辑名发现，资源相对skill 根目录读取；读取development-workflow的assets/execution-contract.md。开工先读取其scripts/task_intents.py --help并start登记，扩范围前update核对重叠，完成/暂停按实际状态更新。缺必需skill或必需委派能力就报告具体阻塞，不能静默跳过。
3. 连续按依赖完成Task1–10：默认Case/Negotiation兼容→六维严格解码→展开读取/状态→共享组件→推荐与精确详情上下文→Case/协商/聊天→Mock固定快照→薪资函数/填写回显→所有薪资消费者→浏览器/视觉/清单。共享文件串行，不能让并行执行者互相覆盖。不因一部分页面可用就停止交付。
4. step缺席归一null，显式null/未知词拒绝；answer exchange_ref只允许S1/S2，按stage+asking_role+round与先前question完全相等，S0禁止。asker仅用于Agent判断/对端回答文案，真人待办仍以pending_actions.role/purpose为准。step=complete不是整个S2完成；阶段和轮次读服务端，S1继续后不能本地跳S3。“已回答事项”不是“真人确认”或“接受全部条件”。
5. 保留六维评分接线，与兼容修复同一交付。字段叫match_explanation；默认不请求时键缺席，显式请求后键必须在场且对象或null。兼容新字段不等于放宽全部未知字段。先测默认合法响应，再测step/ref与评分展开同时存在；默认写回执不得被改成必须带解释。
6. 仅C2读取矩阵加include；保留screening_records，已有progress_details合并一个include；negotiations不能带screening_records，招聘详情/历史不能擅加candidate_summary。分页/筛选/写后重读保留展开，不对每行另起网络请求。
7. 分数、解释同记录同角色；求职推荐详情按recommendation/batch/intention/job四坐标恢复，不能借同公司、同岗位其他意向或新批次。无坐标的通用岗位不扫描推荐。Case/协商/聊天用自己的响应。写回执缺解释不能抹掉或拼接过期分数，依Plan处理权威重读与隔离。
8. 四态来自后端status；技能1/100命中得到0分仍部分匹配。学历不计入六维。只做固定v1结构/一致性校验，不提供运行时评分器，不用当前简历/JD重算。match_score=null显示—，真实0正常；解释null用缺失说明和同来源有限依据，不造六条假状态。
9. 历史/归档列表不加评分UI。其他指定列表只让原分数圆环可点击、无环下文案、按钮可访问且不冒泡；用既有弹层，开弹层零补读。详情单一区、同页不重复环，行样式按Spec紧凑勾选行。招聘聊天完整纸身下方独立分析块，不写入优势或PDF。
10. Mock使用固定记录快照，列表/详情同源，覆盖四态/部分0/总分0/解释null/分数null。移除这些消费者的旧JD/学历/经验演示算分，保留真正的公开岗位要求。不能改成所有记录一份演示对象。
11. 所有已有结构化薪资统一30–45K、300–500 元/天、40–60 元/时；仅月薪明确非12年薪月数才加 x N，同值折单值，未填不当作12，日/时不加后缀，独立N薪标签去掉。输入控件仍数值提交，注意en dash/x后缀不能破坏旧保存解析。未知与面议分开，不将K/day猜成元，不从当前岗位补历史记录，不披露候选私有金额。不扫描修改自由文本/JD/PDF。
12. 新主线首屏薪资三态、日常简历按区编辑、屏蔽部分成功重试、岗位三级分类与上一轮姓名/头像/纸身/S0–S3动作接线保留。hidden本身不再遮蔽服务端返回公司；授权仍由服务端决定，不能本地给全部Case放行。合法空highlights保持空，手机邮箱保持原占位。
13. 最小改动：复用现有数据源、状态、重试、弹层、匹配组件。只允许Plan里的小型解释解码/固定中文映射/薪资函数/Mock数据表，不新建架构、评分引擎、金额引擎、状态机、跨记录缓存或通用框架。删除确无消费者的死代码可以，不能顺便重构。

验证与完成纪律：
- 每Task按Plan先写具体失败反例，确认失败原因，再最小实施并运行定向选集。原有测试文案过时按批准合同迁移，不盲更新快照或删除权限/来源断言。--list和0 tests不是通过。记录每次commit、命令、selection、fixture和结果，复用依赖相同的有效证据。
- Task4/6/7/9还包含review补齐的旧组件/页面回归，Task8包含候选操作中的Mock意向说明；不要只测新函数。Spec §6、8A.2、8B每个入口必须能对应实施和验证证据。
- fixture浏览器用例沿既有离线边界，标题与选择按Plan；视觉在320/360窄屏和普通宽度人工看图，检查长原因、分项分数、分数环点击/焦点/Escape、薪资后缀及纸身独立分析。生成截图不等于视觉验收通过。
- 用户明确真实验收自己负责：不使用任何测试账号登录、不访问/操作真实Case、不运行本地真实E2E栈或正式L3、不启动后端、不清库。L3 selection=none是本任务人工分工覆盖，不是L3 PASS。单元、fixture浏览器、必要typecheck/lint/build仍由你完成，报告必须写“真实环境未验收，由用户负责”。
- 契约冲突/无法维持来源或权限/缺必需工具时具体报告，能独立推进的部分继续；不改Spec自证合规、不悄悄扩大范围、不虚报完成。遇测试失败自主归因并修复范围内问题，不能把未完成验证推给用户当作ready。

收尾顺序与授权边界：
全部编号Task与execution skill要求的宿主内全局review完成→退出Task循环→进入Plan的“实施后收尾（不计入 Task count）”→按宿主路由调用异构reviewer→裁决及必要修复→按实际diff完成最小充分affected/L0–L2→展示具体final gate方案并等待用户明确确认。覆盖默认finishing流程，不追加第二套全仓测试、合入菜单或清理。异构review只在该阶段调用，reviewer默认不跑测试/不改文件；轮间仅轻量验证，轮次及结束条件归review skill。异构review之后的affected修复不重新开启Task/global/异构review。

确认前完成必要npm run typecheck、npm run lint、npm run build、git diff --check、测试清单write/check及适用单测/浏览器/视觉；有效证据可复用，不重复整层测试。可以只读fetch记录target，不合target、不push、不部署。展示候选commit、target SHA、验证证据、缺口和拟合入动作；启动本提示词不等于final gate授权。

确认后读取development-workflow skill 根目录的references/final-integration.md与assets/final-integration-contract.md：同步target记录final_target_base，重算完整测试责任，复用有效PASS只补缺口，核对target未推进后普通fast-forward push，禁止force push；本任务按用户明确覆盖跳过真实环境/L3操作。target竞态或产品契约变更时报告并按该合同处理，不无限追赶。确认后不再次调用异构review。不要把本地合并说成已经push或部署。

输出位置：实施/测试/review裁决摘要更新本Plan相应记录，测试清单用docs/testing/cases.md生成入口，README只记实际证据；runner receipt保留既有ignored目录。不要新增第二份Spec、Plan、review report、handoff或额外执行提示词。最终说明入口覆盖、有意不加评分的页面、接口/展示对齐、命令结果及真实环境未验收边界。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行固定版本Spec/Plan，不从本提示词另行扩展产品设计。
```

## Codex

```text
你在全新实施 session 中，为 repository agxp-a2a-recruiting-web 执行已批准并完成文档 review 的完整计划。当前工作区固定为仓库根 `.`，target 为 origin/main。复用当前工作区，不创建第二个用户工作区，不自动 stash/reset/clean 已有内容，不部署，不修改或启动后端。

批准 Spec：docs/superpowers/specs/2026-09-17-match-explanation-wiring-design.md（revision 3，blob e03157e2239104e52c278aadbd71d2c5fb3ef6da）。
执行 Plan：docs/superpowers/plans/2026-09-18-match-explanation-wiring.md（revision 2，blob ce6d78dab29d7b26a74cae1c5c6abb4b9809adda）。

先检查当前分支、工作区状态与上述两文件的 git hash-object。仓库文件路径均为仓库相对路径；不把规划机器目录写入交付。两份内容须匹配固定blob，文档提交已在本分支；不reset到旧基线。不把其他同名/旧日期计划或本地未跟踪预览作为批准设计。当前源码核对基线为84fd3c114c6ea41c89f771c69f43a0ab047b81d0；在其后实施，差异先核对，不覆盖已存在成果。

Task count: 10
计数仅含编号实施Task；异构review、affected/L0–L2与final gate不计入。
Execution skill: superpowers:executing-plans
Model aliases: host-native

本宿主为Codex，必须实际调用superpowers:executing-plans，按依赖连续完成10个Task，不因Task数改用subagent模式。角色档位使用Plan通用档位与当前宿主配置；不解析、查找或校验Claude Code alias，不因另一宿主alias不存在而阻塞。异构reviewer为Claude，收尾实际调用claude-review-loop；绑定批准文档和固定候选，共用合同从该skill 根目录的../_shared/review-contract.md读取。实施过程中仅做执行skill规定的宿主内review，不提前调用Claude异构review。

执行顺序和必须保持的产品边界：
1. 先完整读取AGENTS.md、CLAUDE.md、docs/testing/README.md和批准Spec；再读Plan的Global Constraints、C1–C4、Task index/角色表与当前Task完整正文。每推进一个Task读取其输入、预期新增/修改/删除文件、反例、命令和完成条件，不凭聊天记忆开工。
2. 实际调用本宿主指定execution skill。外部skill用逻辑名发现，资源相对skill 根目录读取；读取development-workflow的assets/execution-contract.md。开工先读取其scripts/task_intents.py --help并start登记，扩范围前update核对重叠，完成/暂停按实际状态更新。缺必需skill或必需委派能力就报告具体阻塞，不能静默跳过。
3. 连续按依赖完成Task1–10：默认Case/Negotiation兼容→六维严格解码→展开读取/状态→共享组件→推荐与精确详情上下文→Case/协商/聊天→Mock固定快照→薪资函数/填写回显→所有薪资消费者→浏览器/视觉/清单。共享文件串行，不能让并行执行者互相覆盖。不因一部分页面可用就停止交付。
4. step缺席归一null，显式null/未知词拒绝；answer exchange_ref只允许S1/S2，按stage+asking_role+round与先前question完全相等，S0禁止。asker仅用于Agent判断/对端回答文案，真人待办仍以pending_actions.role/purpose为准。step=complete不是整个S2完成；阶段和轮次读服务端，S1继续后不能本地跳S3。“已回答事项”不是“真人确认”或“接受全部条件”。
5. 保留六维评分接线，与兼容修复同一交付。字段叫match_explanation；默认不请求时键缺席，显式请求后键必须在场且对象或null。兼容新字段不等于放宽全部未知字段。先测默认合法响应，再测step/ref与评分展开同时存在；默认写回执不得被改成必须带解释。
6. 仅C2读取矩阵加include；保留screening_records，已有progress_details合并一个include；negotiations不能带screening_records，招聘详情/历史不能擅加candidate_summary。分页/筛选/写后重读保留展开，不对每行另起网络请求。
7. 分数、解释同记录同角色；求职推荐详情按recommendation/batch/intention/job四坐标恢复，不能借同公司、同岗位其他意向或新批次。无坐标的通用岗位不扫描推荐。Case/协商/聊天用自己的响应。写回执缺解释不能抹掉或拼接过期分数，依Plan处理权威重读与隔离。
8. 四态来自后端status；技能1/100命中得到0分仍部分匹配。学历不计入六维。只做固定v1结构/一致性校验，不提供运行时评分器，不用当前简历/JD重算。match_score=null显示—，真实0正常；解释null用缺失说明和同来源有限依据，不造六条假状态。
9. 历史/归档列表不加评分UI。其他指定列表只让原分数圆环可点击、无环下文案、按钮可访问且不冒泡；用既有弹层，开弹层零补读。详情单一区、同页不重复环，行样式按Spec紧凑勾选行。招聘聊天完整纸身下方独立分析块，不写入优势或PDF。
10. Mock使用固定记录快照，列表/详情同源，覆盖四态/部分0/总分0/解释null/分数null。移除这些消费者的旧JD/学历/经验演示算分，保留真正的公开岗位要求。不能改成所有记录一份演示对象。
11. 所有已有结构化薪资统一30–45K、300–500 元/天、40–60 元/时；仅月薪明确非12年薪月数才加 x N，同值折单值，未填不当作12，日/时不加后缀，独立N薪标签去掉。输入控件仍数值提交，注意en dash/x后缀不能破坏旧保存解析。未知与面议分开，不将K/day猜成元，不从当前岗位补历史记录，不披露候选私有金额。不扫描修改自由文本/JD/PDF。
12. 新主线首屏薪资三态、日常简历按区编辑、屏蔽部分成功重试、岗位三级分类与上一轮姓名/头像/纸身/S0–S3动作接线保留。hidden本身不再遮蔽服务端返回公司；授权仍由服务端决定，不能本地给全部Case放行。合法空highlights保持空，手机邮箱保持原占位。
13. 最小改动：复用现有数据源、状态、重试、弹层、匹配组件。只允许Plan里的小型解释解码/固定中文映射/薪资函数/Mock数据表，不新建架构、评分引擎、金额引擎、状态机、跨记录缓存或通用框架。删除确无消费者的死代码可以，不能顺便重构。

验证与完成纪律：
- 每Task按Plan先写具体失败反例，确认失败原因，再最小实施并运行定向选集。原有测试文案过时按批准合同迁移，不盲更新快照或删除权限/来源断言。--list和0 tests不是通过。记录每次commit、命令、selection、fixture和结果，复用依赖相同的有效证据。
- Task4/6/7/9还包含review补齐的旧组件/页面回归，Task8包含候选操作中的Mock意向说明；不要只测新函数。Spec §6、8A.2、8B每个入口必须能对应实施和验证证据。
- fixture浏览器用例沿既有离线边界，标题与选择按Plan；视觉在320/360窄屏和普通宽度人工看图，检查长原因、分项分数、分数环点击/焦点/Escape、薪资后缀及纸身独立分析。生成截图不等于视觉验收通过。
- 用户明确真实验收自己负责：不使用任何测试账号登录、不访问/操作真实Case、不运行本地真实E2E栈或正式L3、不启动后端、不清库。L3 selection=none是本任务人工分工覆盖，不是L3 PASS。单元、fixture浏览器、必要typecheck/lint/build仍由你完成，报告必须写“真实环境未验收，由用户负责”。
- 契约冲突/无法维持来源或权限/缺必需工具时具体报告，能独立推进的部分继续；不改Spec自证合规、不悄悄扩大范围、不虚报完成。遇测试失败自主归因并修复范围内问题，不能把未完成验证推给用户当作ready。

收尾顺序与授权边界：
全部编号Task与execution skill要求的宿主内全局review完成→退出Task循环→进入Plan的“实施后收尾（不计入 Task count）”→按宿主路由调用异构reviewer→裁决及必要修复→按实际diff完成最小充分affected/L0–L2→展示具体final gate方案并等待用户明确确认。覆盖默认finishing流程，不追加第二套全仓测试、合入菜单或清理。异构review只在该阶段调用，reviewer默认不跑测试/不改文件；轮间仅轻量验证，轮次及结束条件归review skill。异构review之后的affected修复不重新开启Task/global/异构review。

确认前完成必要npm run typecheck、npm run lint、npm run build、git diff --check、测试清单write/check及适用单测/浏览器/视觉；有效证据可复用，不重复整层测试。可以只读fetch记录target，不合target、不push、不部署。展示候选commit、target SHA、验证证据、缺口和拟合入动作；启动本提示词不等于final gate授权。

确认后读取development-workflow skill 根目录的references/final-integration.md与assets/final-integration-contract.md：同步target记录final_target_base，重算完整测试责任，复用有效PASS只补缺口，核对target未推进后普通fast-forward push，禁止force push；本任务按用户明确覆盖跳过真实环境/L3操作。target竞态或产品契约变更时报告并按该合同处理，不无限追赶。确认后不再次调用异构review。不要把本地合并说成已经push或部署。

输出位置：实施/测试/review裁决摘要更新本Plan相应记录，测试清单用docs/testing/cases.md生成入口，README只记实际证据；runner receipt保留既有ignored目录。不要新增第二份Spec、Plan、review report、handoff或额外执行提示词。最终说明入口覆盖、有意不加评分的页面、接口/展示对齐、命令结果及真实环境未验收边界。

本 Plan 计划本身复杂度：高；零上下文漂移风险：中；执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

严格执行固定版本Spec/Plan，不从本提示词另行扩展产品设计。
```
