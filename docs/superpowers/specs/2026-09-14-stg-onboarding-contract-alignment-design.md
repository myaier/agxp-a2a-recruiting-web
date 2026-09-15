# 企业命名、MatchCase 与 STG onboarding 前端契约对齐

日期：2026-09-14。状态：已批准（2026-09-14）；本文件不代表实现或验收完成。

## 1. 范围、基线与取舍

前端仓库 agxp-a2a-recruiting-web，工作区 `.`，目标 `origin/main`。本轮 fetch 后 HEAD 与 origin/main 均为 `5825ff47a27600cbe5591fb1a9a5fe43e7201272`；现有未跟踪的后端交接与 STG 复测报告保持原样，不夹带进本 Spec 提交。实施前重新获取 main，核实问题仍在并保留用户改动，不复制旧 hotfix。

后端独立实现，新接口消费其批准 Spec：后端仓库 `docs/superpowers/specs/2026-09-14-recruitment-stg-onboarding-completion-design.md`，revision `286424e2b3b656bea05d7dfc11e0fd50bc1078e1`、blob `fea26097ca2135d516ed4e64247cc623471ba79b`。调查 worktree HEAD `67127df80` 只有规划产物；实现与部署必须另行查证。实施者从用户指定后端 checkout 核验精确 Git 对象，不用未批准的最新文件替换合同。本文复述必要的前端接口，不绑定规划机器绝对路径。

交付四件事：企业常用名/品牌名/工商名接线；MatchCase 空技能数组最小修复；按角色 onboarding 完成接口与分流；一个 STG onboarding Suite、两个角色 Case、每个手填/解析两个独立变体。

选择复用现有 BFF facade、会话代际、候选草稿、招聘名片、公司分区编辑和 agent-browser dogfood。新增一个 onboarding 数据源域及其运行态，是统一真实登录、切端、完成与恢复所需的最小边界；不新建路由框架、状态库或通用测试平台。企业字段增加已有表单控件，不做样式改版。MatchCase 只删错误下界，不放宽其他契约。

非目标：不修改后端、不做部署；不修 recommendations:null，不改 NegotiationJob required_skills 三态；不扩大 JD/简历解析建议字段，不自动生成技能；不启动真实代谈/MatchCase L3；不新增媒体初始化、GC、多企业 fixture 或强制零残留。企业日常编辑、设置 CRUD 和长双角色复合旅程不加入首个 onboarding Suite。只有新增真实 Case 证明必要，才考虑后续扩展。

当前用户授权规划与后续并行开发方向。development-workflow 本会话交付 Spec/Plan/review/新实施 session 提示词；Spec 获批后才写 Plan，实施在新 session。实施完整适用 L0–L2 与代码 review 完成后停在 final gate 确认前，等待后端就绪与具体方案批准再运行正式 L3；不能提前合入、push 或部署。

## 2. 企业命名合同与行为

后端已有依据：`docs/superpowers/specs/2026-09-11-recruitment-open-organizations-and-runtime-fixes-design.md` 及 `apps/recruitment-bff/openapi/mobile-v1.yaml` 的 OrganizationProfile/OrganizationProfileReplacement。实现前核对已有合同与新 onboarding Spec，不根据字段名称猜语义。

| 概念 | 权威字段 | 前端行为 |
|---|---|---|
| 企业常用名 | 目录/公开企业 display_name；profile.display_name | Backend 基本信息增加“企业常用名”，独立编辑与显示 |
| 品牌名 | profile.brand_name | 保持“品牌名称”独立输入，不与常用名串写 |
| 工商全称 | legal_name | 认证事实，只读展示；为空诚实显示未提供，不能回填常用名 |

常用名遵循后端 trim、控制字符约束、80 字符上限及 normalized 唯一性；前端可做即时输入校验，后端仍是唯一冲突权威。品牌名保持既有合法空串/投影 fallback 合同，不把品牌名自动填为工商名。复用现有控件与错误呈现，禁止为了接受新字段而忽略所有未知键。

`src/数据/BFF契约.ts`、`src/数据/招聘数据源/组织.ts` 的企业 profile 和 replacement 纳入必需 display_name；保持其他闭合字段、null、权限与 revision 约束。扫描组织映射、表单草稿、所有全量替换与媒体操作：基本信息、福利/介绍等分区、logo/图片写入及未知结果回读比较均必须保留常用名。旧 draft 属性“公司全称”曾承载品牌名，允许最小增量增加明确常用名属性，不把一次性修复扩大成 Mock 全局字段改名；Mock 原行为保持。

仅既有 verified admin 可编辑；自报组织、普通成员、只读角色不扩大权限。409 organization_name_conflict 给常用名冲突提示并保留输入；409 version_conflict 复用当前冲突恢复，不以后台重试无意覆盖其他修改。401、403、503/结果未知沿用现有会话和回读边界。

成功后以响应同一 organization_id 的权威常用名刷新当前企业身份、profile、公开缓存与当前关系显示；需重读的目录/关系复用既有接口，不把旧名称和新 profile 拼成混合快照。换账号/企业后迟到结果不得污染当前视图。打开名片或公司选择器时按现有坐标重新读取当前名称，不全局替换字符串。历史岗位 hiring_organization_claim、经历 company 和 MatchCase 快照按后端投影保持，不擅自改历史快照。

## 3. MatchCase WorkspacePublicJob.required_skills

根因：`src/数据/招聘数据源/MatchCase.ts` 的 解工作区职位 错加 length<1；后端 OpenAPI array/maxItems:64、无 minItems，明确数组必须存在且允许为空。后端 BFF list/detail 测试也承认该语义。当前前端 MatchCase.test.ts 把空数组列入非法项，需要先改成成功反例并观察失败。

冻结规则：字段必在；必须 string[]；允许 []；最多64项；维持现有字符串校验。解码结果精确保留 requiredSkills:[]，不产生 null/undefined、不从 title/requirements 合成。缺失、null、非数组、非字符串元素、65项仍 fail closed；不得跳坏行、吞 invalid_response 或返回假空页面。候选/招聘 list、history、detail 共用解码均须受益，角色隔离、闭合对象、candidate_summary 不放松。

回归责任：空数组解码；candidate/recruiter open list、history 与 detail 合法空数组；缺失/null/非数组/混合元素；64合法65拒绝；保留现有严格校验。数据源测试为主要边界，HTTP facade 验证真实路由/解码组合；共享 fixture 更新只为表达合法合同，不修改连续代谈 fixture 的三态。

## 4. Onboarding 产品 API

仅 Backend 消费新增接口，Mock 不发请求。会话、Origin、错误信封和 no-store 复用原 HTTP 客户端。

- `GET /api/v1/me/onboarding`，200 result 为 `{"roles":[{"role":"candidate","status":"active","completed_at":null}]}`。只列实际角色，candidate→recruiter，最多两项无重复；空角色返回 `{"roles":[]}`。role 仅 candidate/recruiter，status 仅 active/suspended，completed_at 必在且为 null 或合法 RFC3339 时间。对象闭合，成功 envelope 保持 result/meta。
- `POST /api/v1/me/onboarding/{role}/complete`，严格 JSON `{}`，无 If-Match/新增幂等键。200 result 是单个 active role 对象，completed_at 必为非空合法时间；角色必须匹配请求。首次与重试返回同一时间。完成调用不修改角色偏好。
- 400 invalid_request_body 为调用错误；401 invalid_session 清当前会话；403 role_required 回选择/刷新角色，role_suspended 显示停用；422 validation_failed 按下面字段定位；503 recruitment_service_unavailable/operation_outcome_unknown 保持未知并允许重试/回读。404 表示部署或接口不匹配，不得当未完成或回退资料推导。
- 422 candidate paths：resume.profile.real_name/required、resume.profile.status/required、resume.educations/complete_entry_required、intentions/active_entry_required；招聘：recruiter.profile/required 或 recruiter.profile.public_name/required。使用已有 BFF fieldErrors；未知合法错误字段仍给一般错误，不猜测写入或清草稿。

后端首次完成条件：候选 active、有效姓名/status、至少一条完整教育和 active 意向；招聘 active、有效非空 public_name 档案，不要求企业/认证/岗位。前端不重新实现永久“完成”判定。候选本轮草稿/待写入/用户明确确认的意向、简介与 URL 一致性检查仍保留，之后才调用完成；这些不新增为后端全局必填。

## 5. 状态、分流、提交与恢复

运行态区分未读取、加载、成功、失败；成功内区分角色不存在、未完成、已完成、停用。沿用 subject+会话 generation 作废在飞请求；退出、换账号重置。ensure-role/切端后重读或明确刷新新角色状态，不用旧空 roles 响应判新角色不存在。GET 失败不得用默认 null 合成未完成。

| 情况 | 分流 |
|---|---|
| 未登录 | 原登录入口 |
| 已登录、无角色或 last_used_role=null | 选择身份，选择后读取所选角色状态 |
| 所选角色 active、未完成 | 对应引导；候选恢复本主体有效草稿 |
| 所选角色 active、已完成 | 正常主页；不因资料减少或公司不存在退回引导 |
| 角色停用/不存在或读取失败 | 按角色/会话合同提示与恢复；不擅自激活，不闪入业务主页 |

登录恢复、普通选身份、显式切端、受保护入口使用同一语义。保持已有 URL 角色隔离：访问另一端 URL 不能悄悄修改 last_used_role。只保留实现这些判断所需的共享纯判定，不重写整个 router。

候选最后完成：既有保存确认全部通过 → POST complete → 接受匹配角色的成功结果 → 清本轮 onboarding 草稿与预填恢复信息 → 正常完成落点。网络结果未知时保留草稿并 GET 查证；GET 明确已完成可收口，仍未完成可安全重试，读取失败留错误。后端已完成事实优先于旧草稿的回访拦截，尤其覆盖完成已提交但响应丢失/页面关闭的恢复；只清首次引导所属草稿，不删除普通编辑中的用户输入。已知完成后，旧草稿不能触发自动业务重放。

招聘注册流：用户保存名片及本次选定的头像等现有操作成功后 → POST recruiter complete → 正常进入首岗页面。完成失败留在可重试状态，不重建已有 profile；普通名片编辑不强制进入首岗。保留当前 UI 的公司选择步骤，后端无需公司即可完成的已有完整用户可直接进入主页，不人为补企业。完成后刷新/重新登录允许进入主页，首岗是 Case 的旅程终点，不新增首岗服务端状态，也不因零岗位重开 onboarding。

现有资料水合错误应留在对应错误/重试体验；新完成状态不吞 profile/组织等服务错误。明确替代旧“资料齐备即完成”的回访逻辑与已完成用户的旧草稿拦截，不删除本轮正常输入校验、恢复屏障、角色隔离与请求代际。

## 6. 第一个正式 STG Suite

Suite ID：`stg-onboarding`。Case ID：`stg-onboarding-candidate`、`stg-onboarding-recruiter`。每 Case variant 为 `manual` 或 `parsed`，选择身份为 Case 的步骤，不要求两个角色互相等待。两个 Case × 两个变体共四个独立选择项；每项新 run、新浏览器会话，不复用上一项资料。保持 CLI 两个账号槽位，单 Case 只消费所需 alias，finally 收尾整轮。

复用 `docs/dogfood/真实后端行为验收.md` 的 agent-browser 操作与证据约定，在既有指南中注册独立 Suite、Case/variant 选择和步骤，更新报告模板。允许引用一份专门的 onboarding Case 文档以保持入口简短；不新建 runner、自动判分框架、全局 catalog 或退休的 npm 入口。合成 PDF 作为小型 tracked 测试材料，人工可读、无真实个人信息；不要求新 PDF 生成服务。

| Case / variant | 独立旅程与关键证据 |
|---|---|
| candidate/manual | empty prepare/initial verify → UI 登录/选候选 → 手填基本资料、教育与意向 → 完成 → 简历与意向刷新持久化 → 退出重登录进主页 |
| candidate/parsed | 相同空起点 → 引导内上传合成简历、确认处理 → 真实解析与预填 → UI 确认/补全 → 完成及同上回访 |
| recruiter/manual | 空起点 → UI 登录/选招聘 → 名片、run 唯一公司选择/创建 → 完成 → 手填首岗并发布 → 岗位刷新持久化 → 重登录进主页 |
| recruiter/parsed | 相同空起点/名片完成 → 上传合成 JD → 真实解析建议 → UI 确认补充组织/薪资等未解析字段并发布 → 同上回访 |

所有被测业务写入走 UI，环境 prepare/verify/cleanup 是例外；同角色只读 API 可以补充证据，不能替代页面结果。解析失败不能降级手填后仍报 parsed PASS。不要求模型逐字生成固定文本，验证真实成功、关键合成事实合理预填、用户确认后的保存和刷新一致。

每项生命周期：从后端 checkout 使用 `ephemeral-empty` prepare → verify --stage initial → 浏览器旅程 → verify --stage journey → finally cleanup。实际命令与能力核对后端实现版本；未实现不能执行假命令。journey verify 不代表 UI PASS。新 run 检查未混入上轮资料/引用，占用释放；旧凭据按后端既有合同退休并作受限反证。业务、收尾、隔离分别记录，不为证明两轮隔离强迫每个 Case 再跑长复合旅程；至少两个独立 run 的衔接有证据，单项单独运行不冒称两轮验证已覆盖。

清理以不干扰后续测试为目标。后端允许的终态 JD/唯一隔离资源可 retained，准确记录类别/原因/隔离依据，不要求 residuals=[]、全物理删除或同企业名重建。无法删除本身不构成 BLOCKED；实际干扰下一轮或未知归属才须处理。复用后端支持边界，不在前端私自删除数据库/对象、reset 或接管外部 run。

当前 candidate parsed 仍需后端 B02 附件验收开放，JD parsed 需真实任务及有限保留支持；代码存在不等于部署和验收就绪。四项全部固化，但 final gate 逐项选择与列状态：PASS/FAIL/BLOCKED/NOT_RUN，不把两项手填通过称为四项 Suite 全通过。已有 STG 试点零残留和长 CRUD 规定在新 Suite 中被上述选择与隔离原则替代；local B/H 仍保持独立范围，不顺便运行。

## 7. 验证与交付要求

实施测试先行。企业合同/映射/全量替换与冲突回归；MatchCase 指定失败反例；onboarding 闭合 DTO、调用/字段错误/未知结果、无角色与空偏好、普通选身份/切端/刷新、已完成+旧草稿、未完成恢复、迟到跨主体响应均有确定性覆盖。组件测试证明用户落点和输入保留；数据源测试证明请求和解码，不以重复模拟后端数据库证明事务。

按用户明确要求，确认前完成：`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`；另执行既有 `npm run test:e2e` 与 `npm run test:e2e:data-source`，更新其中受新增查询影响的 Backend route fixtures。这些既有本地/路由替身浏览器 gate 不是真实 STG L3，不得冒称远端通过。不新建测试平台，不重复跑已有效的 broad gate；Plan 再冻结定向反例与消费者文件。样式未改不自动扩展视觉基准；如实际改动触发现有 UI gate，按真实影响执行并说明。

完成实施与所需 review 后停止在 final gate 确认前，提交候选 SHA、适用完整验证及数量、后端契约/实际实现与部署版本、CLI/附件能力、具体 L3 选择和占用/收尾方案。后端未就绪如实等待，不用 mock PASS 替代；获批后才同步目标并按工作流重算责任、执行必要 L3 和批准的合入动作。实际后端契约漂移必须校准，不能忽略未知字段或改写错误兜底。

最终报告包括根因与合同证据、改动文件和关键逻辑、测试场景、每条命令及完整通过数量、失败/跳过/未运行原因、git diff --check、独立 STG 业务与收尾结论及允许保留资源。本 Spec 阶段不填预期通过数；旧复测报告不作为新实现的验收证据。

## 8. 自检与批准

范围与用户确认一致；新增 API 原样引用批准后端合同；无迁移、首岗状态、解析框架或强制清理扩张。四个变体完整固化与环境门控分开，不承诺当前全部能跑。用户已批准提交 dca499e847aa5af528f1d206066fe6999ab4b1ab 的本 Spec（blob 97c81db3980287fa07f3d131d062abc781adc197），并强调只做最小实现、不额外增加复杂度。本次仅更新批准记录，不变更设计。由同一 planning owner 编写一份零上下文 Plan，完成 Claude 异构文档 review，再生成双宿主执行提示词。未改产品代码、未运行测试/L3。
