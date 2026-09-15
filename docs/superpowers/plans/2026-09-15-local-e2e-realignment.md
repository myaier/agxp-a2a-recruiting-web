# 本地 E2E 最小修复 Implementation Plan

> **For agentic workers:** 本 Plan 的执行路由为：Claude Code 实际调用 `superpowers:subagent-driven-development`；Codex 实际调用 `superpowers:executing-plans`。按 Task 依赖连续实施，收尾不计 Task，不在本规划 session 自动实施。

**Goal:** 让现有本地 E2E 正确验证后续已批准且已合入的 UI／接口行为，消除配置、fixture 和旧断言噪声，保留有价值的业务覆盖。

**Architecture:** 原位修改 Playwright 配置、现有采集 helper 和测试 fixture／旅程；不改产品源码、不新建测试平台。允许有依据地删除过期／重复测试和补充实际覆盖缺口，实施证据及删除对账集中记在本 Plan。

**Tech Stack:** 现有 React／TypeScript 应用，Playwright 1.62、Google Chrome、Vite；现有 npm scripts、JSON reporter 与 trace。

**Spec:** `docs/superpowers/specs/2026-09-15-local-e2e-realignment-design.md`，批准 revision `65c0c8847da6b079cdb7302d73194c99e38bd038`，blob `7a17f9537e939d2882891833b6e0919f41b990e3`。用户批准 v1.0，并明确补充“做最小修复，不合适的测试可以考虑删除，有价值的测试也可以增加”；v1.1 仅记录该授权。

## Global Constraints

- 仓库规则 `CLAUDE.md`、`AGENTS.md` 必须完整读取。输出与文档中文，代码命名沿用原有约定。
- 调查产品基线 `eeaead9abadfd1e87c4abda19fd3de5a6a66af63`；执行前只读核对当前 diff／提交，不用更新或合并 target 代替基线核验。当前任务工作区为 `.`，不另开用户工作区，不 stash/reset/clean 用户内容。
- 产品行为与生产 decoder 不在修改范围；不能用当前输出自证新产品契约。实际已合入代码、相关测试与 Spec §2 所列产品合同互相校准；实质冲突记录为产品问题，暂停相关责任，继续独立工作。
- 测试数量不是验收指标。删除要求指出退役合同或覆盖相同风险的现有用例；新增要求指出当前缺口。禁止删除仍有效的请求形状、ID、权限、CAS、幂等、恢复、Mock 零 API 断言来取得绿色。
- 不新增全局 fixture 框架、page-object 层、配置文件或 npm 命令，不重写超长 spec，不升级依赖；只允许现有文件内必要局部 helper。各 Task 明确的相同文件按顺序编辑。
- 不强制单 worker、不加全局重试、不用 sleep／批量抬超时掩盖错误。定向 repeat 只用于调查偶发。
- 52 个 Mock 场景与 18 个独立场景是调查基线，默认保留；删除或新增须有对账，不机械维持数量。显式采集目录协议保持可用。
- 功能项目固定 UTC；现有专门采集／P1／代理展示 suite 自己显式指定的 Asia/Shanghai 保持，不改变产品时间格式。
- 开工通过逻辑 skill `development-workflow` 找到其根目录，读取 `assets/execution-contract.md`，用 `scripts/task_intents.py start` 登记预期路径；扩大路径前 update 并检查重叠。全部交付路径仓库相对。
- 所有需复用的证据使用已忽略的 `ui-regression-output/e2e-realignment/`，每个 invocation 显式指定独立 `--output` 子目录；日志/JSON/外部采集目录放该 artifacts 子目录之外。重跑同一命令时在原目录名追加 attempt-2 等后缀，不能覆盖旧 receipt。运行前创建目录并记录其与 commit/命令的对应，不新建 runner。
- 同一候选、相同有效输入下不重复 broad gate；任务测试是最小反馈，正式完整责任在异构代码 review 后一次核算。没有仓库 affected runner，不自建一个。

## Task index

Task count: 6
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

按 1 → 2 → 3 → 4 → 5 → 6 串行。Task 1 修入口；Task 2 提供有效共享依赖；Task 3–5 修业务旅程；Task 6 处理展示稳定性、其余招聘消费者旧断言和覆盖记录，不承载 final gate。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|入口与采集；无依赖。局部配置与输出生命周期|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|2|共享招聘 fixture；依赖 1。闭合 DTO 与恢复消费者较多|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|3|公司／招聘／屏蔽流程；依赖 2。权限与 ID 边界|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|4|规则与退役入口；依赖 3。判断有效覆盖和旧责任退役|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|5|候选／城市／时间；依赖 4。复用现有完成与目录契约|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|6|展示异步条件与覆盖对账；依赖 5。偶发原因可能需现场判断|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|

**计划本身复杂度：中。** 涉及共享 fixture 和多旅程，修改集中在少量既有文件；不改变生产架构。

**零上下文漂移风险：中。** 首个失败后的旧断言仍可能暴露，但允许范围、契约来源和停止条件已经冻结。执行模型使用当前可用的行业 Top 5–10 中高性价比模型。角色表中的前沿 review 用于守住权限、测试删减与不稳定性判断，不扩展实施范围。

## 现状、文件职责与覆盖台账

本机工件 `test-results/e2e-audit-20260915/` 非 Git 跟踪，缺失时不阻塞开工。调查结果：默认 14/84/5（通过/失败/跳过），数据源 132/111/0；补齐目录 52/52 通过，独立采集 18/18 通过，公司名两宽度及 UTC 时间复测 4/4 通过。耗时分别 245.7s、597.4s、38.2s、34.0s、12.3s。上述为旧版本证据，不是实施后 PASS。

`e2e/数据源模式.spec.ts` 持有组织、隐私、规则、建档等可变 fixture 和消费者；`e2e/fixtures/展示字段接线.ts` 持有独立展示 fixture；`e2e/P1展示统一.spec.ts`、`e2e/展示字段接线.spec.ts` 各自持有采集逻辑。只在这些原位置改变职责，不新增统一 runner。

台账行号锁定调查基线，实施后用 describe + 完整标题关联，不能拿新行号覆盖原坐标。下表覆盖所有 111 个首失败点；每 Task 在对应行补充新位置、保留/替换/删除/新增理由与实际结果，未执行写“未执行”，禁止预填 PASS。

|原失败位置（e2e/ 下）|数|原风险／处理责任|Task|初始处置|
|---|---:|---|---|---|
|P1展示统一.spec.ts:608；展示字段接线.spec.ts:508|52|保留场景，默认隔离目录与显式目录兼容|1|已实施 2026-09-15：52 个场景全保留（P1 Mock视觉 28 + 展接线 Mock视觉 24，标题未变）；采集根目录改 test 回调内 `P1_CAPTURE_DIR ?? testInfo.outputPath('capture')` 沿参数传递，失败 JSON 与正常结果同根目录；默认入口 run-1 52/52 通过且 52 个 capture 目录互不相同，显式目录 run-2（p1-job-top / wiring-job-top 两宽度）JSON+PNG、screenshot 指向与几何字段校验通过|
|展示字段接线.spec.ts:743,779（两宽度）|4|招聘推荐／在谈 consumer 可水合|2,6|Task 2 已实施 2026-09-15：`e2e/fixtures/展示字段接线.ts` 招聘档案 GET 补必需 `organization_ref`（本场景无任职关系、未选目录组织 → 显式 null）后，4 条两宽度 consumer 于 run-1（recruiter-consumers，41 选集 35 过/6 败）全部完整通过；本行 Task 6 余责仅 390 公司名偶发调查|
|数据源模式.spec.ts:6192,6246,6292,6328,6359,6402,6455,6511,6813,6853|10|招聘组织、权限、CAS、媒体、预览与恢复|2,3|Task 2 已实施 2026-09-15：`P1C招聘方档案形` 补必需 `organization_ref`、`P1C管理员申请形` 补必需 `organization_id`（种子 req-fixture-001=组织甲编号）后，6/10 完整通过（6246、6292、6328、6402、6455、6511）；6192 水合已恢复（URL 到 #/hr/card）但卡「已完成账号进注册流名片被反弹到企业主壳」的旧旅程假设，6359、6853 进名片后卡旧「公司」自由输入（6853 可见页面被反弹中拆：`element was detached from the DOM`），6813 卡旧「姓名（已实名，不可修改）」字面标签与旧「公司」自由输入——均归 Task 3 校准，共享输入无再改。Task 3 已实施 2026-09-15，10/10 保留标题完整通过（run-5 attempt-5/6，27/27）：6192 入口改应用内（注册流被守卫弹回主壳=Spec §5 有意行为，首写 If-Match 0 责任由 12244 承载），公司自报改 公司选择抽屉 选中（PATCH 带选中 organization_ref，选中→保存前零档案 PATCH 有断言）；删除旧「发岗 body 整包不得含 organization_ref」正则，改正向 direct 双 ref + 负向键集断言（不得伪造 verification_status/affiliation/claim）；6359 保留 PATCH If-Match "3"→头像 If-Match "4" revision 链（入口改应用内、公司改抽屉选中、按钮变「保存」）；6782 公司输入断言替换为「未选择公司」按钮 + 抽屉取消零写入，并补名片域零写入基线；6813 取消旧「姓名（已实名，不可修改）」字面标签断言，实名只读事实改由 可见姓名槽（沈实名×2）+ 无可编辑姓名输入 + 公开名不上屏 承载，PATCH body 补 organization_ref；6853 入口改应用内、公司改抽屉选中，失败保留输入/所选企业/预览与同键重试保留（「推进发岗」改「成功留屏」）；6246、6292、6328、6402、6455、6511 原样保留|
|数据源模式.spec.ts:7899,8374,8412,8479,8550,9029,9152,9199,9252,9291,9430,9658,9772,10102,10189,10720,11653,12911,12966,13065,13142,13433|22|共享档案阻断的角色切换／发现／Case／会话等|2；后续相应 Task|Task 2 已实施 2026-09-15：21/22 完整通过（P6 7899；P4 8374/8412/8479/8550；P5 9029/9152/9199/9252/9291/9430；在谈 9658/9772；P7 10102/10189；P8 10720；卡片 12911/12966/13065/13142；S0 13433）；11653 水合已恢复但卡名片旧「公司」自由输入（`getByLabel('公司')` 已不存在，公司改选择控件），归 Task 3（其选集含「核心编辑 岗位」）。Task 3 已实施 2026-09-15：11653 入口改应用内名片（注册流入口被已完成账号守卫弹回主壳），公司经 公司选择抽屉 选中后保存，再进发岗向导（档案 organization_ref 按 ID 读回的默认行）；POST body 断言补 direct 双 ref=组织甲编号；其余 21 条不受本次共享输入改动影响，attempt-5/6 仍完整通过|
|数据源模式.spec.ts:118,7636,7786,7841,7950,8018,8043|7|规则生命周期、恢复与隔离|4|Task 4 已实施 2026-09-15，run-6 全绿（15/15，含 3 条保留举报 consumer）。基线实况：8 失败（118、7636→全链路、7841→accept 响应丢失、7950→失败提案卡、8018→首次水合、8043→accept 409、10522、10691）；7786→版本冲突一坐标基线已自行通过（现选择器本就匹配当前 UI，未改动）。按标题距推断的旧坐标映射与现存测试序一致（版本冲突从未失败，重复 cursor 不在这 7 个坐标里；后者的空转断言仍顺手校正：旧「手动添加规则」count-0 换成现行「添加规则」并删掉恒真的「2 条」count-0 死断言）。118：删「4 条/3 条生效」总计与旧「Mock 招聘端零开关」假设（产品已改 Mock 本地可维护），改分区标题（你教它的规则／哪些情况直接排除）+ 精确开关标记（`规则：<正文>` aria-checked）验证；Mock 意向级种子「双休是底线…」改断言本页不渲染且无 编辑／删除／开关 三入口；招聘端改断言开关 checked 与「添加规则」在场。7636 全链路：水合段改精确正文按钮（exact 避开 `显示删除：⋯` 同文键 strict 冲突）；删意向 create 段（`规则范围` 选择器已退役，`意向新建草稿` 标记随之删除）与全部「N 条」总计，改 composer 无范围选择器 + 意向规则三写入口 count 0；「手动添加规则」→「添加规则」；编辑=正文按钮→`编辑规则：<正文>` 预填→「完成」（旧「提交修改」键退役）；归档=键盘揭起 `显示删除：<正文>`（触屏布局 ⋯ 是 1×1 可达键，click 会被正文键拦截，走 P7 同款 focus+Enter）→`删除规则：<正文>`→确认前断言零 DELETE→确认层「删除这条规则？」→「删除」→权威回读（行+开关消失、DELETE 恰 1 次带 If-Match "1"）；「两次创建两把 key」断言随意向 create 删除移除（由 失败提案卡 的两次创建断言承载，无覆盖损失），接受恰 2 次（新建+替换）空 body+各自 key 保留；招聘端 create(no scope)→accept→pause/resume If-Match "1"→"2" 版本链全保留。7841：两处规则行断言改 exact 修复与 `显示删除：⋯` 的 strict 冲突。7950：「手动添加规则」→「添加规则」，删「规则范围」值断言（选择器退役）；创建失败文案按现行合同改「后端服务暂时不可用，请稍后重试」+ fixture 原始 message 不上屏 count 0（该段在基线被旧入口超时掩盖从未跑到，属本次新暴露的过时断言），两次创建新 key 保留。8018：挂起段旧入口 count-0 改「添加规则」；放行段删意向可见与「2 条」，改全局行+开关落地、意向规则不渲染零写入口。8043：「2 条」改 候选全局规则行在场 + 不可执行提案未物化（规则计数不变的意图由清单内容承载）。请求协议保持：POST 提案（候选恒 scope global／招聘恒无 scope）、replacement If-Match、accept 空 body+key、DELETE If-Match、PATCH pause/resume 版本链、503 同键受控重试、409 not_actionable 权威恢复零重放、首次水合无写入口、切角色迟到响应隔离、Mock 零 API 全部原样存证|
|数据源模式.spec.ts:6782,12037,12102,12244,12409|5|公司选择代替旧输入；保存／重入|3|Task 3 已实施 2026-09-15，5/5 完整通过（run-5 attempt-5/6）：6782 见上行（公司输入断言替换为选择入口按钮 + 抽屉取消零写入 + 空值保存零请求）；12037 公司名称改按钮选择（Mock 走本地 模拟企业目录 全程零 API，选 云衢科技），`placeholder='必填'` 断言 2→1（只剩职位名称，标题保留），行业层根集按当前字典更新（互联网平台、智能硬件 / 制造，根可访问名带「⌄」去 exact），根仅展开→点金融科技→选细分叶「支付与清结算」，经历卡回读断言随所选叶更新；12102 公司名称抽屉选中（磐石信息→org-fixture-p3-manual-a），经历 POST 断言补 organization_id（industry_id 原有），共享 `断言经历写入` 守卫对齐合同 C（organization_id 进闭合键集、company 键退役），handler 存储 organization_id；12244 公司抽屉选中组织甲，首写 PATCH If-Match "0" body 补 organization_ref，发岗走 `走完后端发岗向导`（helper 增补当前产品必需的「用人企业」显式选择步）断言 direct 双 ref，刷新恢复保留；12414 名片抽屉选中，consent 前零 POST、202+串行轮询、建议不自动发布全保留，POST body 断言补双 ref（默认读取行），旧「全远程禁用办公地」断言按当前合同替换（输入仍可用、值为空、非必填——src/屏幕/发布岗位.tsx 办公地点注释为现行事实）|
|数据源模式.spec.ts:6913,7165,7219,7379|4|屏蔽写入与搜索／幂等竞态|3|Task 3 已实施 2026-09-15，4/4 完整通过（run-5 attempt-5/6）：6913 屏蔽段改「先点选择要屏蔽的公司→抽屉搜索/选中只回填（补选中后零屏蔽请求断言）→点屏蔽才写入」，来源分段、解除 422/404 分支与幂等键断言保留；候选→招聘切换的固定组织链过滤补 `GET /api/v1/me/onboarding`（J-PILOT-02 预填读与组织链并行，属当前水合合同）；发岗 POST 改正向双 ref + 负向键集（不伪造 verification_status/affiliation/claim）；编辑岗位旧「PATCH 回传完整四员块+immutable 原值」合同已退役，改断言无编辑保存=空稀疏补丁（If-Match "1"，零字段；「岗位已保存」仅在 PATCH 后权威 GET 四员块闭合解码通过才出现）；7165 抽屉化，同键受控重试+新意图换新键保留；7219 抽屉化，503 先生效后失败权威重读保留；7379 抽屉化，代际守卫/无结果空态断言保留，fixture 搜索脚本分支补 `verification_status`（合同 B 四字段闭合解码必需，缺键曾致「服务返回异常」）|
|数据源模式.spec.ts:10253,10353|2|账号时间与导出完整链路|1,5|Task 1 部分已实施 2026-09-15：两配置 `use.timezoneId:'UTC'` 缺省兜底，suite 自带 `Asia/Shanghai` 未覆盖；时间文案与导出链路的实际验证归 Task 5，未实施|
|数据源模式.spec.ts:10522,10691|2|反馈／举报边界与直聊不可用|4|Task 4 已实施 2026-09-15，run-6 全绿：10522 P8 产品反馈——标题改「反馈页无举报入口零 reports 请求」，产品三分类真实工单提交与致谢断言原样保留；删除从反馈页点击「举报虚假岗位／举报骚扰行为」并提交的旧操作段（Backend 反馈分类表只有 功能异常／体验建议／其他，两按钮已不存在，属退役 UI；真实举报路径由 P8 职位举报详情直取与 P7 会话举报两条保留 consumer 承载，均通过），改断言 入口指引文案在场 + 两举报分类按钮 count 0 + 零 reports 请求 + 反馈受理恰 1（不重复整条举报路径）；10691 P8 Backend 直聊——标题改「不可用说明与查看在谈导航，零直接聊天/举报写入」，删「看职位」可见断言（Backend 操作排整排不渲染，属退役 UI），改断言 不可用说明文案、「查看在谈」点击跳主壳 #/app、⋯ 举报入口／操作排／输入条全缺（无权威 target 禁止写入的风险断言保留并加强为三处结构性 count-0）、零 reports；直聊页截图存证保留。请求协议保持：feedback POST body {category,details} 与 P8 变更边界断言原样|
|数据源模式.spec.ts:10896,11391|2|候选完成与城市正确分组|5|未实施|
|展示字段接线.spec.ts:566（390）|1|主体切换后 claim-only 名称，复测过但原因未明|6|未实施|

默认入口另有 32 个 Backend 误选（P1 18、展示接线 10、问 AI 4）与 5 个专用建档跳过，由 Task 1 校正路由，数据源入口仍覆盖。原全绿消费者也必须纳入共享输入的影响分析。

## 测试选择五问

1. 防止模式误选、采集目录缺失／串写、过期 DTO 阻断页面、旧交互删掉业务风险、错误时区和异步竞态。主要边界是 Playwright 浏览器 + 本地 Vite + intercepted BFF。
2. 各 Task 下给出 `--list`／`--grep`／精确文件的最小命令。先复现一个代表用例再修；只测试试验性测试修改时，现有失败即 red，不另写镜像单测。
3. 共享 DTO、onboarding、水合／角色门控和幂等协议调整时，立即跑相应真实浏览器 consumer；只做 `tsc` 不能证明这些边界，且当前 tsconfig.app.json 不覆盖 e2e。没有生产 SQL／权限实现改动，不启动数据库／真实后端。
4. 最终权威责任是两个合法功能选集、独立 18 场景及相关 lint／采集 helper 现有单测。不发布；真实 BFF／STG／Hosted L3 为 none。扩展到产品代码时不继续套用这个选择，先取得新授权。
5. 已有成本如上。修复后全量耗时未知，不在规划期为估时重跑。保留修改后选集、commit、运行模式、fixture、浏览器与 trace/log，final gate 只补失效缺口。

### Task 1: 修正模式选择、默认采集路径与时区

预期编辑文件：
- 新增：无。
- 修改：`playwright.config.ts`、`playwright.数据源模式.config.ts`、`e2e/P1展示统一.spec.ts`、`e2e/展示字段接线.spec.ts`、`README.md`。
- 删除：无文件；默认入口移出专属用例不等于删除测试。

目标：普通入口无需 shell 采集变量，Backend 不误跑 Mock，重复与并发采集不互相覆盖。非目标：不改采集场景、产品时区或独立视觉配置。

依赖与接口：无上游。消费现有 Playwright TestInfo.outputPath 与两份 `采集场景/写结果/取采集目录`；生产每次测试独立的采集根目录，显式环境目录仍为原入口协议。不增加公共跨模块 API。

- [ ] 读两份配置、两份采集 helper 与 `e2e/J-PILOT-02接线.spec.ts` 的端口探测，记录两个 `--list` 清单。确认默认专属文件不包含应该保留的未标记 Mock 用例。
- [ ] 默认配置在原 testIgnore 加 `**/J-PILOT-02接线.spec.ts`，保留数据源 spec／视觉目录／Vitest 排除；增加 `grepInvert: /@backend|@annotation/`。默认 server 显式 `VITE_DATA_SOURCE=mock VITE_BACKEND_ENV=stg VITE_ANNOTATION_ENABLED=false`，4173 `--strictPort` 且 `reuseExistingServer:false`。数据源 4181/4182 显式 annotation=false，4183 保留 true；三个 server 仍不可复用。
- [ ] 两配置 use 加 `timezoneId:'UTC'`，不覆盖 suite 自带的 `Asia/Shanghai`。
- [ ] 采集根目录在 test 回调内计算并沿函数参数传递，不用模块级可变缓存记住第一个用例的 TestInfo。只需按现有函数增加 `根目录: string` 参数：

```ts
// 分别应用于 P1 与展示接线；保留原 sceneId 和相对截图路径。
const 根目录 = process.env.P1_CAPTURE_DIR ?? testInfo.outputPath('capture');
await 采集场景(page, 场景, 宽度, 根目录);
// 展示接线使用 WIRING_CAPTURE_DIR，目录创建仍用 mkdirSync({recursive:true})。
```

- [ ] 正常写结果与 catch 写失败 JSON 使用同一根目录，不能让“写错误结果”遮住原始错误。显式目录为本次 invocation 专用，由调用者负责不与另一 invocation 共用；scene ID 保持原语义，不通过更名规避冲突。
- [ ] 按下列命令核对合法选集与采集。默认预期移出 37 个专属条目，在未删测试前为 66 个；数据源仍为 243 个。数字变化必须按标题解释。

```sh
npm run test:e2e -- --list
npm run test:e2e:data-source -- --list
npm run test:e2e -- e2e/P1展示统一.spec.ts e2e/展示字段接线.spec.ts --grep 'Mock视觉' --workers=4 --output=ui-regression-output/e2e-realignment/run-1/artifacts
P1_CAPTURE_DIR=ui-regression-output/e2e-realignment/explicit-p1 WIRING_CAPTURE_DIR=ui-regression-output/e2e-realignment/explicit-wiring npm run test:e2e -- --grep '采集 (p1-job-top|wiring-job-top)' --workers=2 --output=ui-regression-output/e2e-realignment/run-2/artifacts
```

检查默认不同用例输出目录不同，显式两目录各有 320/390 的 JSON 和 PNG，JSON screenshot 指向真实文件，关键几何和诊断字段未消失。不必为路径拼装引入新单测框架。

- [ ] README 写清两个入口、18 场景实际数量、默认输出与显式采集，保留 fixture 不等于真实 BFF 的说明。记录处置和最小验证，提交 `fix(e2e): isolate modes and default capture output`。

完成条件：选集合法、两种采集路径通过，正常运行不再因缺变量失败。无法证明移出用例仍有合法消费者入口则停止该删选操作。

### Task 2: 对齐共享招聘／组织 fixture 的完整水合契约

预期编辑文件：
- 新增：无。
- 修改：`e2e/数据源模式.spec.ts`、`e2e/fixtures/展示字段接线.ts`。
- 删除：无。

目标：恢复 36 条被招聘档案阻断的消费者，最小修复共同输入。非目标：不修改生产 decoder，不统一所有 fixture，不为每个可选字段造值。

依赖：Task 1 合法 Backend 项目。消费 `src/数据/招聘数据源/组织.ts` 中 closed-object decoder、`src/数据/BFF契约.ts`、`src/状态/后端/组织操作.ts`、现有正确样本 `src/测试/BFF样本.ts`、`e2e/fixtures/P1展示统一.ts`；生产保持原函数签名的 `安装BFF路由(page, 选项)` 和 `安装展接线路由(page, options)`。

- [ ] 从两个招聘展示标题选一条复现水合阻断，检查响应与 decoder；核对 `P1C招聘方档案形`、`P1C管理员申请形`、`P1C企业档案形` 的所有生产消费字段。特别是 `organization_ref`（档案）、`organization_id`（管理员申请）、`display_name`（企业 profile）。现有 profile 已有 display_name 的地方不要重复重构。
- [ ] 在 `P1C招聘方档案形` 加必需 `organization_ref: string | null`；逐个构造成功档案时按场景显式给 null 或 fixture 组织 ID；展示 fixture 同样补键。初始 GET、PATCH 后 GET、切角色 GET、头像回执引用的 revision 均保持一致。404 首写仍是缺档案，不伪造成空成功档案。
- [ ] 对照当前消费者补齐实际使用的管理员申请 organization_id、企业 profile display_name、目录和 onboarding 响应。复用已有 `创建招聘方OnboardingFixture` 和路由分支，保持每 test 独立可变状态。不要改“未知字段拒绝”负例。
- [ ] 当前招聘名片保存会 PATCH 档案、必要时上传头像、注册态再 complete。fixture 的完成事实必须由完成请求推进；读取完成快照不能自动完成。已有完成场景的种子则显式 completed_at。公司选择 ID 不得赋予 affiliation 管理权限。
- [ ] 如果 trace 表明事件 WebSocket 逃逸：在已有路由安装处只拦 `events/live`，复用现有事件桩能力；专用 P7 的 `__emitP7/__P7断开` 事件驱动不得被第二层静默桩覆盖。不得对所有 WebSocket 一刀切或修改 Vite HMR。无逃逸证据则不改事件桩。
- [ ] 修复共享输入后运行全部原 36 条受影响消费者（该选择还含相关 P1C 空档案用例），先 --list 核对台账完整标题，不能仅跑代表样本。第一次运行可暴露旧 UI 失败；按原因分配：fixture 本身由 Task 2 修并定向验证；公司/屏蔽归 Task 3；规则/退役入口归 Task 4；候选/城市归 Task 5；其余发现、Case、PDF、真人会话、卡片几何和 S0 旧断言由 Task 6 修并验证。不得把这些已知受影响消费者第一次运行推迟到异构代码 review 之后。

```sh
npm run test:e2e:data-source -- e2e/数据源模式.spec.ts e2e/展示字段接线.spec.ts --project=backend-stg --grep 'P1C|企业名片统一|招聘 推荐列表与匿名简历|招聘 在谈列表与 Case|P6 切换招聘端|招聘端列表与详情渲染匿名|收藏本地过滤|招聘端委托无确认层|招聘端简历详情 404|同一 Case 双端 needs_action|招聘详情直达刷新|披露前与解析中|已披露招聘端|S2/S3 每步|登出与角色切换清空可见 P5|招聘端画像全缺|同 Case 附件|招聘端经内容无关失效事件|P5 发布后招聘端|P8 切换身份|新建两栏下钻分类|卡片统一 .*@backend|场景三：双端 S0' --workers=4 --retries=0 --output=ui-regression-output/e2e-realignment/recruiter-consumers/artifacts
```

期望：成功档案解码与水合；记录每个 consumer 的完整结果。将后续失败交接给上述明确 Task，不伪称该旅程通过。Task 6 结束前全部当前有效消费者须已通过；按变动依赖复用或定向补跑，不机械再跑该整个选择。

- [ ] 台账记录哪些消费者已完整通过、哪些只有前置已恢复，提交 `fix(e2e): align recruiter fixtures with current contracts`。

完成条件：所有成功档案构造符合当前契约、代表 consumer 可消费；任何必须放宽生产契约才能通过的地方记录产品/合同冲突，不继续自行放宽。

### Task 3: 迁移公司、招聘及屏蔽旅程，保留写入边界

预期编辑文件：新增无；修改 `e2e/数据源模式.spec.ts`；删除无文件，可删除该文件中被替代的旧断言／重复测试并记录理由。

目标：通过现有公司选择交互恢复 P1C、简历行业、招聘建档、JD 导入和 P3 屏蔽。非目标：不重做公司选择 UI，不增加真实组织或后台。

依赖：Task 2 合法档案／目录／完成 fixture。读取 `src/组件/公司选择层.tsx`、`src/组件/招聘名片/招聘名片展示.tsx`、`src/屏幕/招聘名片.tsx`、`src/屏幕/工作经历.tsx`、`src/屏幕/屏蔽名单.tsx`、`src/屏幕/公司档案编辑.tsx`、`src/屏幕/公司档案分区编辑.tsx` 及对应测试。生产仍为现有可变 fixture 与 UI 旅程，不导出新公共 API。

- [ ] 逐项校准原 P1C 6192–6853、核心行业 12037/12102、招聘 12244/12409、P3 6913/7165/7219/7379；不要只改 line 1 的等待。使用现有公司按钮打开弹层，然后在弹层内填 `输入公司名称`、点确切目录候选。公司控件在 Mock 名片仍有既有差异时按实际合同处理，不强改所有页面成一个 helper。
- [ ] 名片选择只改草稿，保存前零档案 PATCH；保存 body 包括选中 `organization_ref`。新建注册首写 If-Match 为 0，后续头像使用 PATCH 新 revision，complete 成功后才去发岗。保留失败草稿／头像与重试责任。
- [ ] 工作经历公司输入改为按钮选择，职位名称仍使用唯一 `placeholder='必填'`；选企业后再选行业并补时间。断言 POST 的 organization_id／industry_id，保存、重入及空行业/未选企业的禁止写入按已有有效覆盖保留。
- [ ] 招聘组织测试区分自报企业与可管理关系：多关系不默认猜管理目标；member 不出现管理写入；管理员申请只在认证入口加载；企业分区修改携带正确当前企业与 revision。名片预览姓名从当前可见姓名槽验证，取消旧“姓名（已实名，不可修改）”字面标签但保留实名只读事实。保留媒体 metadata/media 与头像单 media 断言。
- [ ] 发岗仍走当前两种 publisher_mode，验证选中发布方／用人方 ID，禁止客户端伪造 verification_status／affiliation；删除旧“请求完全不得含 organization_ref”的整包正则。JD 导入的 consent、串行轮询、导入建议不自动发布仍保留。
- [ ] 屏蔽页先点“选择要屏蔽的公司”，搜索／选中只回填，点“屏蔽”才发生业务写入。保留同键受控重试、503 先生效后失败的权威重读、搜索旧词晚到拒绝覆盖等原断言；不把多个不同幂等分支合并删掉。
- [ ] 如原用例没有单独证明“选择企业不等于获得管理权限”或“选择前后无业务写入”，优先在现有对应旅程补断言；相同风险已由本文件某个浏览器用例覆盖则不重复增加。

```sh
npm run test:e2e:data-source -- e2e/数据源模式.spec.ts --grep 'P1C|企业名片统一|核心编辑 简历行业|核心编辑 岗位|招聘方 onboarding|JD 建议稿导入|P3 隐私读写|AddBlock|组织搜索竞态' --workers=4 --output=ui-regression-output/e2e-realignment/run-5/artifacts
```

期望：以上所有仍有当前风险的用例完整通过，两种数据源模式守住 ID／零 API 边界。删除用例不能使 grep 得到 0 tests 并被记为成功。

- [ ] 台账逐条列保留／替换／删除和替代标题，提交 `fix(e2e): follow current company selection journeys`。

完成条件：前置与后续保存／刷新均验证。若要新造产品按钮或放松权限才能完成，停止该责任并记录具体冲突。

### Task 4: 更新规则生命周期与已退役反馈／直聊入口

预期编辑文件：新增无；修改 `e2e/数据源模式.spec.ts`；删除无文件，可合并/删除已退役测试片段。

目标：P6／Mock 规则与 P8 的当前有效职责可验证。非目标：不恢复意向规则旧编辑 UI，不恢复退役直聊，不改变产品举报路径。

依赖：Task 2 的切角色水合、Task 3 的现有文件版本。读取 `src/屏幕/规则库.tsx`、`src/屏幕/企业代理设置.tsx`、`src/组件/可编辑规则行.tsx` 及对应测试，`src/屏幕/直聊会话.tsx` 及测试；产品反馈依据当前路由对应页面和原 P8 10522/10561/10596 的有效举报用例。

- [ ] 移除旧意向规则可编辑、总计“2 条/4 条”的断言，改按当前规则分区与精确规则标记验证全局规则；历史意向规则存在于后端数据时断言本页不提供其写入口。保留全局规则新增→提案→接受→编辑→删除确认→权威回读，以及招聘端同类独立作用域。
- [ ] `手动添加规则` 改为当前“添加规则”入口；编辑用 `编辑规则：<正文>`，更多用 `显示删除：<正文>`，删除用 `删除规则：<正文>`，正文按钮 exact 匹配，开关仍为 `规则：<正文>`。确认前零删除请求，确认后才归档。只定位不存在的旧按钮不得靠 `.first()` 糊过去。
- [ ] P6 CAS 冲突用当前仍可编辑的 global/recruiter 规则承载，保留“只一次权威重读，零自动重放”；accept 409/503、失败草稿恢复、首次水合无写入口、切角色迟到响应隔离均保留。移除仅针对退役意向维护的操作片段，不连带删除全链路。
- [ ] P8 产品反馈保留工单提交与真实返回；删除从反馈页点击“举报虚假岗位”的旧操作，因为当前具体职位举报已在 10561/10596 覆盖。原反馈用例补“此页无举报入口／零 reports”断言即可，不重复整条举报路径。
- [ ] 原 hash 路由 `chat/direct/J-01`（根路径） 用例改验证不可用说明、“查看在谈”导航、零直接聊天／举报写入。不能将它改成 Mock 直聊，也不能删掉无权威 target 禁止写入风险。

```sh
npm run test:e2e:data-source -- e2e/数据源模式.spec.ts --grep 'Mock 双端规则页|P6 |P8 产品反馈|P8 Backend 直聊|P8 .*举报' --workers=4 --output=ui-regression-output/e2e-realignment/run-6/artifacts
```

期望：原 7 个规则失败、2 个退役入口失败及保留的举报 consumer 通过；新场景删除确认或禁止写入若已有覆盖只加精准断言。

- [ ] 记录删除/合并依据和所有请求协议保持情况，提交 `fix(e2e): align rules and retired entry assertions`。

完成条件：有效生命周期与错误恢复不减少，所有删除都有明确覆盖说明。产品行为与原批准规则合同冲突则记录，不靠改 fixture 语义隐藏。

### Task 5: 校准候选建档、城市目录与时间验收

预期编辑文件：新增无；修改 `e2e/数据源模式.spec.ts`；删除无文件，允许在证明覆盖等价后移除重复候选完整旅程。

目标：恢复候选旧默认假设及城市分组，证实 Task 1 时区生效。非目标：不改产品默认值、日期格式或城市组件。

依赖：Task 1 UTC、Task 2 有效建档 fixture；前序任务对共享文件的修改。读取 `src/屏幕/学生分流.tsx`／测试、`src/屏幕/城市查询钩子.ts`／测试、`src/屏幕/账号安全.tsx`／测试、`e2e/J-PILOT-02接线.spec.ts`。

- [ ] 旧候选 10896 先明确 Backend 初始偏好为空：点击“已毕业”不会替选求职类型；显式点击“社招全职”及“现场”等目标办公方式，走当前城市/职位选择。不要保留“三档默认全亮”的注释和倒置点击。
- [ ] 对照 J-PILOT-02 的社招 637、学生 712、教育恢复 765、头像 unknown 805 等：若旧长旅程仍独有经历写入、工资滚轮后退恢复等责任，迁移保留这些责任；只有每个独立风险已有明确用例时才删除整条重复长旅程。否则在原用例修复完整建档，首次意向 POST 恰一次、完成事实回读仍验证。
- [ ] 城市 11391 的 `省份城` 改为显式 `admin1_code` 参数或在本地按省名映射：浙江 33、江苏 32。构造杭州/苏州各归其省，宁波/绍兴归浙江；保留默认/分页/搜索/取消/保存原 ID 断言。不得通过只要求出现任一省名放宽验证。
- [ ] 时间 10253/10353 维持原 UTC 文案和完整导出下载。使用宿主 TZ=Asia/Singapore 验证配置内 UTC 生效，不写产品时间强制 UTC。

```sh
npm run test:e2e:data-source -- e2e/数据源模式.spec.ts --grep '候选 onboarding 完整|核心编辑 城市' --workers=3 --output=ui-regression-output/e2e-realignment/run-7/artifacts
TZ=Asia/Singapore npm run test:e2e:data-source -- e2e/数据源模式.spec.ts --project=backend-stg --grep 'P8 账号安全首屏|P8 数据导出：创建无 body' --workers=2 --output=ui-regression-output/e2e-realignment/run-8/artifacts
npm run test:e2e:data-source -- e2e/J-PILOT-02接线.spec.ts --project=backend-stg --workers=3 --output=ui-regression-output/e2e-realignment/run-9/artifacts
```

最后一条用于建档删除/迁移的替代责任核对与入口转移验证；如果未改建档且同候选已有有效 PASS 可复用，不再重复跑。期望合法选集全过，删除前后独立风险对应明确。

- [ ] 更新台账、提交 `fix(e2e): align onboarding city and time assumptions`。

完成条件：候选默认语义正确、分组数据自洽、宿主 TZ 不影响功能断言；不因其他新建档测试过而未经对照就删旧用例。

### Task 6: 核查展示偶发并完成最小覆盖对照

预期编辑文件：新增无；修改 `e2e/展示字段接线.spec.ts`、`e2e/fixtures/展示字段接线.ts`、`e2e/数据源模式.spec.ts`、`README.md`、本 Plan；无原因证据时前两文件不作猜测性修改。删除无文件。

目标：处理全量 390px 公司名偶发，修复 Task 2 运行暴露且不属于 Task 3–5 的发现、Case/PDF、真人会话、卡片及 S0 旧断言，清楚记录所有旧测试如何迁移。非目标：不增加全局 retry、不重构展示业务、不把汇总当作正式 final gate。

依赖：前五个 Task；消费 Task 2 fixture，Task 1 采集路径。读取 `e2e/展示字段接线.spec.ts` 的 566 用例、fixture claim-only B 卡与 `src/屏幕/职位详情.tsx`（只读）；生产原用例更精确的可观察等待／数据隔离，保持标题和 320/390 责任。

- [ ] 用现有 trace 或下列有界重复记录公司名丢失的页面、目标 Job ID、请求/响应顺序；场景步骤必须仍经过 A→B 切换。原单 worker 通过仅证明未复现，不叫修复。

```sh
npm run test:e2e:data-source -- e2e/展示字段接线.spec.ts --project=backend-stg --grep '候选 市场列表与独立职位详情' --workers=4 --repeat-each=3 --retries=0 --output=ui-regression-output/e2e-realignment/run-10/artifacts
```

- [ ] 已证实是就绪条件竞态时，导航前注册目标响应等待、导航后等目标 Job ID/详情标题与 claim-only 公司名稳定；仅等请求计数不能证明 response 已消费。已证实是测试共享可变对象则在原 fixture 构造点独立实例化；不得 clone 整个测试框架或重写产品缓存。
- [ ] 未复现且源码无确定性缺陷则不改产品或猜改等待，记录 6 次采样结果与根因未定；若仍失败且无法在测试范围内修复，该责任未完成，不能标记已就绪。
- [ ] 完成 Task 2 交接的其余消费者：保留列表分页/匿名字段、PDF 披露边界、S2/S3 权威动作、角色清理、会话读取、卡片几何和 S0 禁用输入的原有效断言，只迁移旧入口与过时文案。针对失败标题运行 `npm run test:e2e:data-source -- e2e/数据源模式.spec.ts --project=backend-stg --grep <该条完整标题转义后的正则> --workers=4 --retries=0 --output=ui-regression-output/e2e-realignment/consumer-repair-N/artifacts`，N 为该次补验序号；精确标题来自 Task 2 记录而不是自行猜测。共享 fixture 再改则重算所有消费者，全部在 Task 结束前验证，不能只记账或留至收尾。
- [ ] 核对本 Plan 台账全部组，增补解除前置后暴露的失败：每个删除指明退役依据或精确替代测试，每个新增指明独立风险。不新增单独 review/report/handoff 文档，不把 trace 的机器绝对路径写入交付。
- [ ] README 删除过期“只有两项目”“公司只能填 claim”等说明，写当前 mock/backend/annotation 三入口与边界；只修与本任务有关的说明。
- [ ] 提交 `fix(e2e): tighten display readiness and reconcile coverage`；无测试代码变动时用 docs commit，禁止为满足 commit 名义编造修改。

完成条件：展示责任可验证或具体受阻记录清楚、覆盖对照无遗漏。后续完整验证与合入严格转入以下不计数收尾。

## 实施后收尾（不计入 Task count）

1. 完成上述全部 Task 与执行 skill 要求的宿主内全局 review（未要求则不新增）后，退出 Task/global review 流程。绑定本 Plan 和批准 Spec 的精确版本：Codex 使用 Claude `claude-review-loop`；Claude Code 使用以 Codex 为 reviewer 的多轮只读 review-loop。按其共用 `../_shared/review-contract.md` 核实 findings，reviewer 默认不跑测试。异构 review 只在此处调用，轮间修复仅跑轻量静态/单元检查，不跑整套 E2E；轮次与结束条件归 review skill。
2. Review 返回允许继续后核算适用 L0–L2（仓库没有 affected runner）：运行 `git diff --check`、针对实际修改文件的 `npx oxlint <files>`；不把 app-only typecheck 误记为 E2E 类型覆盖。采集 helper 改动时选择 `npm test -- e2e/视觉回归/比较器.test.ts e2e/视觉回归/场景.test.ts`，不自动全量 npm test/build。
3. 最终功能责任最小组合：完整 `PLAYWRIGHT_JSON_OUTPUT_NAME=ui-regression-output/e2e-realignment/final-data.json npm run test:e2e:data-source -- --workers=4 --retries=0 --reporter=list,json --output=ui-regression-output/e2e-realignment/final-data-artifacts`；默认独有与代理 Mock 入口 `PLAYWRIGHT_JSON_OUTPUT_NAME=ui-regression-output/e2e-realignment/final-default.json npm run test:e2e -- e2e/onboarding.spec.ts e2e/换壳无闪屏.spec.ts e2e/问AI代理展示.spec.ts --workers=4 --retries=0 --reporter=list,json --output=ui-regression-output/e2e-realignment/final-default-artifacts`；默认 52 采集的配置依赖由 Task 1 的默认运行证据覆盖。若后续修改了两采集文件中的采集步骤、目录 helper、依赖 fixture 或配置，则相应场景证据失效，需要补跑这些场景；仅 Backend 测试块修改可通过 diff 证明不影响独立 Mock 采集。对于默认与数据源重叠用例，只有 server 模式、suite 配置、fixture 与内容相同才复用业务 PASS，两个 `--list` 和默认实际运行证明入口路由。无法证明等价的重叠条目单独补跑，不把 data-source 全绿直接称默认全绿。两命令若意外 0 tests 则覆盖失败。
4. `UI_CAPTURE_DIR=ui-regression-output/e2e-realignment/visual PLAYWRIGHT_JSON_OUTPUT_NAME=ui-regression-output/e2e-realignment/final-visual.json npm run ui:capture -- --retries=0 --reporter=list,json --output=ui-regression-output/e2e-realignment/final-visual-artifacts` 覆盖独立 18 场景；Task 1 显式目录样本证据若依赖未变复用，不重跑 52 场景第二遍。选择实际 JSON output 文件和 output 目录，每次 suite 使用不同路径，保存 exit code、commit、时区、Chrome/Node、选集和 trace；记录到本 Plan。任何后续修复只补对应失效消费者，不能省掉受共享 fixture 影响的消费者。
5. 范围内失败自主归因修复；affected 开始后不重新跑 Task/global/异构 review，标明已 review commit 与后续修复差异。仅在适用责任无缺口后准备 final gate。真实后端 development L3：none（仅改 intercepted E2E，无生产代码/真实后端边界变化）；release-only 不属于本任务。
6. Final gate 确认前允许只读 fetch 获取 remote 状态，target 由实施者检测候选 parent／远端并把精确 ref/SHA 纳入待批准方案；用户未指定时不得静默假定 main 或 push。展示候选 commit、测试/审查事实、复用与增量范围、目标和普通合入动作、自主恢复边界，等待明确确认。不在此前合 target、跑正式 L3、push。
7. 确认后同一执行者完整读取逻辑 skill `development-workflow` 的 `references/final-integration.md` 与 `assets/final-integration-contract.md`：同步已确认 target 记录 final_target_base、重算完整责任、只补无效证据、执行必要 L3（本范围 none）、cleanup 后再对账、确认 target 未推进后普通 fast-forward push。禁止 force push；target race、产品范围扩大或外部资源不可得时报告，不无限追赶。确认后不再异构 review，保留原 review 版本。任务 intent 完成状态只在事实完成后刷新。

## 文档审查与规划校验记录

规划自检：6 个 Task、宿主路由及角色表齐全；全部修改限定测试/配置/文档，删除新增均有责任边界；原 111 个失败和默认误选/跳过均有 Task 映射。规划期未重复运行产品测试。

Claude Opus/high 第 1 轮（WORKFLOW_DOCUMENT_REVIEW），冻结候选 revision `59b691767faac7ca7fbe2f7a9e7c5f9cd226d58e` / Plan blob `6fe595f0f7b5fb12201baf001829d1e773ede34e`；批准 Spec 为文首版本。审查前后 status、HEAD 与两文档指纹相同，未运行测试。

|Finding|裁决与修复|必要性|复杂度影响|
|---|---|---|---|
|R1-1 证据落默认 test-results 会被后续运行清空|接受；所有复用证据搬至 ui-regression-output，每次 invocation 独立 --output artifacts，JSON/显式采集为其外部兄弟路径；重跑换 attempt 后缀|required|不变|
|R1-2 部分共享 fixture 消费者未分配完整任务级修复|接受责任缺口；不依赖报告中的近似条数。Task 2 选择覆盖全部 36 条并记录新失败，Task 3–5 分域处理，Task 6 明确承担其余发现/Case/PDF/会话/卡片/S0 旧断言，全部在代码 review 前验证|required|不变|
|R1-3 替代举报 10561 未被 Task 4 grep 选中|接受；使用 P8 .*举报 覆盖替代 consumer|optional|不变|
|R1-4 list,json 未指定独立 JSON 文件|接受；三条最终命令显式 PLAYWRIGHT_JSON_OUTPUT_NAME，文件不在 runner 清理目录内|optional|不变|

本轮所有有效 required 已修订，未改变批准产品范围；4 项均为文档局部修订，没有产品测试或产品代码改动。按 review skill 的“核实后无未解决的有效 required”停止规则结束，共 1 轮，无未解决 required；修订由 planner 静态核对，不宣称修订后另有 Claude 复审。

执行提示词校验记录：单文件 Claude Code／Codex 两节，使用 development-workflow 的 scripts/validate_prompt_grading.py 校验；已将旧直聊路由写为根 hash 路由，避免把路由误判为机器绝对目录。具体运行结果随 prompt 提交记录，未执行产品测试。
