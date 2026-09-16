# 本地基线与 STG 双向匹配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Claude Code 实际使用 superpowers:subagent-driven-development；Codex 实际使用 superpowers:executing-plans。按 checkbox 执行。只在新实施会话开工。

**Goal:** 修复本地基线，交付可独立选择、用真实 STG 验证 S0–S3 的双向匹配 Suite。

**Architecture:** 复用既有本地 runner、后端环境 operator 与 agent-browser dogfood 文档。新增一份专用 YAML、一份合成 PDF 和一份 Suite 指南；不引入真实 STG Playwright runner、通用点击框架或后端改动。

**Tech Stack:** React、TypeScript、Vitest、Playwright、Vite backend+stg、agent-browser、后端 stg-env CLI。

**Spec:** `docs/superpowers/specs/2026-09-17-baseline-stg-matching-design.md`，用户批准 revision `40a9c6f35124813902f317ed2c0e6a30944c271d`，blob `0ebb68e87c110dc62b388b3f21a06c8e44bb25aa`。当前文件的批准记录仅为元数据，契约正文用上述 Git 对象核对。

## Global Constraints

- 仓库 `agxp-a2a-recruiting-web`；复用当前工作区 `.`，分支 `baseline-l3-s0-s3-matching`，target `origin/main`。不新建用户工作区、不 stash/reset/clean、不自动部署。既有 ui:check 内部临时 detached 基线由原脚本管理。
- 完整读取 `AGENTS.md`、`CLAUDE.md`、批准 Spec、`docs/testing/README.md`、`docs/dogfood/真实后端行为验收.md`。既有测试证据是调查线索，不是本次 PASS。
- 外部后端通过 `AGXP_MONOREPO_DIR` 定位；先读其仓库规则及 `.claude/skills/agxp-recruitment-e2e-env/SKILL.md`、`.claude/skills/agxp-recruitment-stg-env/SKILL.md`、`apps/recruitment/README.md` 双向匹配节。基线 `aed30bfa984190c47730e39c905d8a1cc23d6429`；线上运行 revision 当时为 `732cd2a5f881bcf915d369260df87d09741f836e`，现场须重新核对。
- 不启动本地后端；真实 STG 只执行 `stg-matching` 两条新 Case。业务操作全程 agent-browser 观察并点击，准备/清理走 operator，只读同角色 API 可补证。
- 用户明确允许 Task 4 提前进行真实 STG 探索。这是 workflow 默认顺序的例外；探索不得作为正式 final gate PASS。正式 L3、合 target、push 仍须收尾人工确认。
- 每 Case 每次新 run、双角色独立浏览器 session、STG 串行独占、finally cleanup。不得运行收藏/拒绝/不感兴趣/watch/规则/助手聊天/反馈/导出等可选写入，不发真人消息。
- 本地禁止删断言、固定 sleep、宽泛 route 兜底、加重试/超时掩盖失败。保留既有视觉工具原有基础设施恢复语义，不新增重试。
- 仅在已批准产品合同内修复真实前端缺陷。扩大文件范围前更新 task intent、写本 Plan 的确切路径和证据；后端缺陷或产品行为变更先清理、报告，不能自行跨仓库实现。
- 本地 raw 保存在 `test-results/baseline-stg-matching/`；防 Playwright 清空可暂存本任务独有临时目录再归档。视觉 `ui-regression-output/baseline-stg-matching/`；真实运行 `dogfood-output/<run-id>/`，这些是运行时动态目录，不是新增文档交付。报告开跑就写，不能等成功才补。
- 使用 `development-workflow` 根相对 `assets/execution-contract.md`。开工用其 `scripts/task_intents.py` 的 start/list，扩大范围前 update，结束更新状态；参数先读 --help。不删除他人预告。每 Task 提交自身变更，不整库 git add。

## Task index

Task count: 5
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

全部串行：1 → 2 → 3 → 4 → 5，避免共享文件与独占 STG 冲突。Task review 使用宿主内角色，异构 review 只在不计数收尾。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|历史四失败定位修复；无上游|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|2|两类时序疑点验证；依赖 1 的基线记录|前沿（Claude Code: opus）|前沿（Claude Code: opus）|前沿（Claude Code: opus）|
|3|固定 YAML/PDF 与准入指南；依赖 2 的稳定本地行为|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|4|双向探索及收敛证据；依赖 3 的数据合同|前沿（Claude Code: opus）|前沿（Claude Code: opus）|前沿（Claude Code: opus）|
|5|Suite 注册与最终文档一致；依赖 4 的真实流程|Top 5–10（Claude Code: sonnet）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|

角色理由：1 的根因不能仅凭历史推定；2 涉及异步归属；3 涉及 schema、文本与 PDF 一致性；4 需要真实模型、权限、清理判断，采用前沿档。1/3/5 的文件组织检查边界明确，可由 Top 5–10 完成，5 的契约审查仍需防止探索冒充正式 PASS。

**计划本身复杂度：高。** 两类本地回归、真实附件及双角色异步状态、清理隔离使验证成本较高。

**零上下文漂移风险：高。** 实际入口、模型追问和 STG 生命周期须现场判断；使用当前可用的行业顶尖模型。档位按漂移风险选择，不按计划复杂度取高；Claude alias 仅在 Claude 宿主解析。

## 测试选择与权威责任

1. 防止四条手填旅程失真、过期水合覆盖导航、取消误写，以及匹配假通过、附件错版、跨 run 泄露和错误 cleanup verdict。
2. 内循环分别使用下列 Task 的定向 Vitest/Playwright；fixture 改动核对所有消费者。`test:e2e:data-source` 是同 runner 别名，不算第二份覆盖。
3. UI/fixture 不能证明真实 PDF、模型、认证失效或清理隔离，因此 Task 4 在用户已授权范围内提前探索这两个 Case。阶段时序先本地可控 deferred 验证，不靠 STG 碰运气。
4. 用户明确要求本地全量跑绿：初始记录一次当前完整基线；修复后在收尾完成全量单元、唯一功能 browser、静态/build、清单和视觉比较。适用有效证据可复用，不强制 review 前后各全跑一次。正式 L3 responsibility=required，selection 恰为 `stg-matching-recruiter`、`stg-matching-candidate`，按本指南逐 Case agent-browser 执行；不存在 npm 一键入口，不编造命令。旧 Suite NOT_SELECTED，不记 PASS。
5. 历史功能结果 290 passed/4 failed，真实时长本任务未知；18 视觉场景沿现有入口。探索最多六 run、每 run 发起至会话观察最多40分钟，另计准备/解析/清理；不能承诺短时完成。

本地完整命令（从前端根依次执行并保留每条退出码/时长/commit/runtime）：

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e -- --workers=4 --retries=0
npm run build
npm run test:list -- --check
UI_VISUAL_GATE=enforce npm run ui:check -- --base 30a0d3b24c2257da70c8b54fff4ee0ebb5ad71d0 --output ui-regression-output/baseline-stg-matching
```

ui:check 已包含采集与比较，不另跑 ui:capture 算第二轮覆盖。不设置 UI_CHANGE_APPROVED 绕过；核对18场景、差异报告与退出码，不能用采集成功替代比较通过。使用冻结产品基线和同一 harness；新视觉决策才交用户确认。

### Task 1: 复现并修复历史四条手填旅程

**目标/非目标：** 以当前完整基线确认真实失败，修复 J-PILOT fixture/选择接线；不重构测试框架、不改页面布局。

**预期编辑文件：**
- 新增：无。
- 修改：`e2e/J-PILOT-02接线.spec.ts`、`docs/testing/README.md`。
- 删除：无。
- 条件修改（只有定向证据证明产品根因）：`src/屏幕/期望职位目录钩子.ts`、`src/屏幕/选期望职位.tsx`、`src/屏幕/选期望职位.test.tsx`、`src/组件/期望职位选择正文.tsx`、`src/组件/期望职位选择正文.test.tsx`。

**输入/输出契约：** 输入现有公开职位目录请求 query/parent_id 分页及统一 selectable leaf `job-fixture-001`；输出仍选中该真实叶 ID。双栏左根、右组标题/叶按钮必须反映真实目录层级，不能把 heading 当 button。生产给后续 Task 的是当前基线失败清单和修复后的五条文件用例结果，不输出新公共 API。

- [ ] 核对依赖安装/lockfile 和现有进程，不自动更新依赖。运行“本地完整命令”一次记录初始结果；失败后仍记录其余入口，保存 raw，不能在首个错误后漏掉其他责任。
- [ ] 读历史 `docs/superpowers/plans/2026-09-16-frontend-test-layering.md` 与 README 已知问题，只把四条失败和两疑点作为本次范围，既修公开组织 GET/P6 409 不预判仍失败。
- [ ] 执行 `npm run test:e2e -- e2e/J-PILOT-02接线.spec.ts --workers=4 --retries=0`。核对约445行目录 fixture、约516行 `count=2` 选择助手及四条旅程；记录实际 locator/响应因果链。
- [ ] 若 fixture 不符双栏层级，最小修改根/组/叶及 parent_id 查询响应和选择动作，维持 `job-fixture-001`。不修改产品适应错误 fixture。若产品错误，先在上述既有测试中加入可击中原行为的断言，看到失败再修复。
- [ ] 重跑该文件五条用例，断言社招/学生全旅程、零经历、URL 清空/未改语义、首次意向恰一、教育 POST 后读取失败重进不重复 POST、头像 unknown 不伪成功且同 key/ifMatch 重放；保留 Mock/Backend 共用布局对照。
- [ ] 有产品修改再定向 `npm test -- src/屏幕/选期望职位.test.tsx src/组件/期望职位选择正文.test.tsx`；更新 README 的实际根因与证据位置，提交 `fix(test): align manual onboarding fixtures with job catalog`。

**完成/停止：** 五例通过且原风险断言不减为完成。初始其他失败逐项归因，现有范围可修；需新产品合同或大范围框架改造时报告，不宣称全绿。不能通过默认全局 retries 结案。

### Task 2: 用受控时序验证水合导航与城市取消

**目标/非目标：** 对两疑点给出确定性证据，有缺陷才最小修复；不添加猜测性防护或泛化请求框架。

**预期编辑文件：**
- 新增：无。
- 修改：`docs/testing/README.md`。
- 条件修改：`src/应用.tsx`、`src/应用.test.tsx`、`src/状态/后端/会话操作.ts`、`src/状态/后端/会话操作.test.ts`、`src/状态/应用状态.tsx`、`src/状态/应用状态.会话.test.ts`、`src/屏幕/选择城市.tsx`、`src/屏幕/选择城市.test.tsx`、`src/状态/领域/候选意向编辑.test.ts`、`e2e/fixtures/数据源交互.ts`、`e2e/suites/求职意向.spec.ts`。
- 删除：无。

**依赖/契约：** Task 1 的实际基线记录已存在。`hash直达` 只导航一次并允许 canonical ID 等价，不增加重试；当前请求代次与位置决定导航权限。城市页选择是局部状态，仅保存提交，取消不能写候选意向 draft/API；消费方是意向编辑及其保存回读。

- [ ] 读应用分流 effect、会话水合 generation fencing、hash直达以及城市局部 state/返回。列出“开始水合→用户导航→旧水合返回”和“进入选择→局部选城市→取消→保存原草稿”的可控事件顺序。
- [ ] 在最接近现有单元 harness 中用 deferred promise/明确 resolve 顺序验证上述顺序，断言最终路由保留用户目的地、取消后原城市 ID 与 API 请求体不变。反向先 resolve 再导航作正常对照；不靠 sleep 或调大等待。
- [ ] 若失败，记录失败再修最小根因（过期异步结果必须失去本次导航写权；城市取消不提交局部值），重跑所选单元文件。若现有实现已正确，不添产品 guard，保留证明旧推断不成立的可控测试/结果。
- [ ] 按实际改动选 `npm test -- src/应用.test.tsx src/状态/应用状态.会话.test.ts src/状态/后端/会话操作.test.ts` 或 `npm test -- src/屏幕/选择城市.test.tsx src/状态/领域/候选意向编辑.test.ts`，不无关全跑。
- [ ] 执行 `npm run test:e2e -- e2e/suites/求职意向.spec.ts --workers=4 --retries=0`，断言默认行政分组、翻页、搜索、取消、保存回读全部保持真实 ID。共享 hash 助手若有改动，列出消费者，收尾全量覆盖其风险。
- [ ] README 逐疑点写已证实修复或已排除及证据，提交 `fix: resolve onboarding navigation and city cancellation evidence`（无产品修复则用 test/docs 类型）。

**完成/停止：** 两疑点均有受控结果，不能只用全量偶然通过结案；无法定位因果时保留未解决，不乱加 fence。契约外行为变化先报告。

### Task 3: 固定专用匹配材料与操作准入

**目标/非目标：** 产出可 validate、可解析的完整双角色材料及运行骨架；不创建匹配结果、不实际 prepare 账号。

**预期编辑文件：**
- 新增：`docs/dogfood/fixtures/stg-matching-happy.yaml`、`docs/dogfood/fixtures/stg-matching-resume.pdf`、`docs/dogfood/stg-matching.md`。
- 修改/删除：无。

**依赖/接口：** Task 2 的产品边界稳定。复用后端 `apps/recruitment/testdata/stg-ephemeral/complete.yaml` 完整结构和 `case.schema.json`，不复制 schema 入前端。YAML 为 scene=`ephemeral-baseline`、schema_version=1；双方 complete_onboarding/set_role_preference=true。生产下表固定数据、PDF 与 Suite 输入；账号/组织 ID/登录材料仍属于 operator。

|字段组|冻结值/语义|
|---|---|
|候选|real_name=`林知行`；status=`employed`；work_start_year=2020；其他可空档案字段沿样例|
|学历|清华大学、计算机科学与技术、本科，2016-09 至2020-06|
|经历|行业 `软件与信息技术服务业`，测试工程师，2020-07 至今，internship=false；不写公司名，组织引用让 operator 替换|
|经历/项目事实|持续负责 Python/pytest 自动化、HTTP API 测试与 SQL 数据校验；项目“接口自动化回归”，role=测试工程师，result=建立接口回归并验证数据库一致性；不编造量化成绩|
|意向|social_full_time、测试工程师、北京市；alternate_locations/industries 空；workplace_modes=[hybrid]；compensation range lower=20 upper=25 annual_salary_months=13；四项 exclusions 均 excluded|
|候选偏好/PDF|北京混合办公、20–25K/月13薪、双休、非外包、无需频繁出差、非纯现场，两周到岗；合成资料，无电话/邮箱/真实证件|
|招聘者/组织|public_name=`周明远`、title=`招聘负责人`；组织沿合法占位结构，brand_name=`云极测试`；真实 run 名由 operator 替换|
|岗位|title=`测试工程师（接口自动化）`；direct/social_full_time；测试工程师、北京市；office_location=`北京市海淀区中关村软件园（合成测试地址）`；hybrid；salary20–25，13薪；experience_requirement=five_plus_years；education_requirement=bachelor|
|JD与四问|Python/pytest/HTTP API/SQL 与经历逐项吻合；本科且5年以上；双休、非外包、无需频繁出差、非纯现场、可两周到岗；hard_requirements 四项均 not_required；structured_requirements_confirmed=true|

PDF 用中文真实文本层，和 YAML 完全一致；经历雇主栏省略，不能虚构与 run 组织矛盾的历史。只写合成事实，不写模型“必须匹配”指令。字段枚举以上游 schema 为准；目录不存在/歧义记录 BLOCKED，不能静默改职业/地点绕过。

- [ ] 读取后端两 Skills 和 schema，复制样例合法字段后按冻结表替换，所有金额/年月/技能在 summary、description、requirements、PDF 一致。
- [ ] 使用可用 PDF skill 生成单页简历，保存原件；用 `pdftotext docs/dogfood/fixtures/stg-matching-resume.pdf -` 校对全文，用 `pdftoppm -png -singlefile docs/dogfood/fixtures/stg-matching-resume.pdf test-results/baseline-stg-matching/resume` 渲染并实际查看，确认无缺字/裁切。生成临时代码留本任务忽略目录，不新增通用生成器。
- [ ] 在前端根设置 `MATCHING_CONFIG="$(realpath docs/dogfood/fixtures/stg-matching-happy.yaml)"`，进入 `AGXP_MONOREPO_DIR` 后依次执行 `tools/dev-env.sh exec -- apps/recruitment/scripts/stg-env.sh validate --config "$MATCHING_CONFIG" --offline` 与去掉 `--offline` 的在线命令。须 rc0、目录唯一解析；不安装临时后端依赖，不改变 fingerprint。
- [ ] 指南写 preflight/status→validate→prepare→verify→两端浏览器→finally cleanup/status 顺序与每次新 run；标记流程细节尚待 Task 4 探索，不能提前写已通过。
- [ ] 指南写安全输入具体做法：agent-browser 0.35.2 支持 `batch` stdin JSON 命令数组。受限本地进程读取 login.json，生成 fill 命令，经 subprocess stdin 传给具名 session 的 `batch --bail`；不把值放 shell argv，不输出 payload/登录页面快照/trace。先以非秘密假值核对 batch 输出不会回显 fill 内容；失败时隔离原始输出、不展示，报告阻塞。只保留脱敏操作结果；无安全通道不继续。
- [ ] 记录 YAML/PDF 的 SHA256、前后端 revision、validate 结果与字典解析摘要，提交 `test(dogfood): add dedicated happy matching fixtures`。

**完成/停止：** 两种 validate、PDF文本及渲染均通过；无账号创建。资料矛盾、目录缺失、安全输入不可用即不进入 Task 4。

### Task 4: 全程浏览器探索并稳定两个 Case

**目标/非目标：** 找出双向真实入口/人工待办差异，并在最终相同材料与流程下各得两个独立 PASS；不是正式 L3，不测旧 Suite 或真人消息。

**预期编辑文件：**
- 新增：无（raw 用既有忽略目录）。
- 修改：`docs/dogfood/stg-matching.md`；有证据的材料修正才修改 `docs/dogfood/fixtures/stg-matching-happy.yaml`、`docs/dogfood/fixtures/stg-matching-resume.pdf`。
- 删除：无。
- 若发现前端既有合同内缺陷，先记录失败与涉及的精确文件，更新本 Plan 和 intent 后用 TDD 最小修复；不能用本条件授权任意重构。后端缺陷先 cleanup，再报告阻塞。

**依赖/接口：** Task 3 三文件存在且 validate/PDF已通过。Suite=`stg-matching`，Case=`stg-matching-recruiter`/`stg-matching-candidate`；每 Case 独立新账号、组织、岗位、意向、PDF版本、委托及 Case，不能共用 run。报告分别记录基础设施/业务/cleanup/隔离 verdict，引用安全 ID，不含 Cookie/号码/验证码/proof。

- [ ] `agent-browser doctor`；确认5173空闲、本任务独占 STG，preflight 为 OK、matching cleanup recruitment=1/server=1、无 foreign占用/lock/reset，字段合同一致。预先建立 run 报告及原 receipt 路径，finally 责任在 prepare 之前登记。
- [ ] 在前端启动 `VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=stg npm run dev -- --host localhost --port 5173 --strictPort`，核对代理为线上 STG；只拥有本进程，不杀已有服务，不换 Origin。
- [ ] 从后端根经开发环境包装执行 preflight/status/validate，然后 `prepare --run-id "$MATCHING_RUN_ID" --config "$MATCHING_CONFIG"` 和 `verify --run-id "$MATCHING_RUN_ID"`。run 格式 front-match-方向-UTC时间，创建失败也读 status/receipt 判断是否需要同 run cleanup。
- [ ] 为 candidate/recruiter 各建不同具名 session，安全登录后才截图；逐屏核对实际资料、role、run岗位、薪资、四问。真实 UI 上传专用 PDF，等待解析成功，记录 file/version/parse ID与资料一致性；不手填替代失败解析。
- [ ] 候选发起：本轮职位入口→准确 PDF 版本与披露→委托；招聘发起：本轮岗位的候选推荐→确认本轮候选→委托，候选附件确认由本人真实待办执行。目标不在推荐时可正常刷新，在预算内调查，不能选别人或注入推荐。
- [ ] 每一步 snapshot 后按当时 ref 操作，失效 ref 重新观察；记录受理→持久委托→真实 Case对应，刷新恢复同记录，不重复发起。逐 S0/S1/S2/S3 记录两端状态/历史/本人待办；S0真筛选，S1准确附件，S2仅按固定事实回答（自动完成时读历史），S3双方读最新总结分别确认，不重放旧同意。
- [ ] 双方刷新重进核对同 Case完成、无本人待办；实际入口各打开正确真人会话，**不发送消息**。只到一方确认/回执/移交待就绪不算完成。普通节点30秒、PDF/单模型阶段10分钟、发起至会话总40分钟，较短后端deadline优先；跟踪同一后台进程，不因工具窗口超时重新发起。
- [ ] 无论结果如何执行同 run `cleanup --run-id "$MATCHING_RUN_ID"` 和 status。验收 rc0+CLEANED+当前residuals=[]+固定kind/count/reason retained三方对账+占用释放+无未收敛任务。retained非空允许；CLEANED_WITH_RESIDUAL不允许。Hub running仅沿operator60秒/10秒重试；预算后可同run有界重试一次，仍阻塞则保留占用/证据报告，不开新run。
- [ ] 退出浏览器前保留受限 Cookie，cleanup后原样认证只读重放得到401，按后端受限流程验证旧login不能建会话；不把秘密贴入命令行或报告，核验后销毁受限材料。只关闭本轮会话与自建服务。
- [ ] 后续新run分别查 owner列表、推荐/评估、Case历史/投影、任务、通知、会话不含旧资源；以新身份正常角色只读入口访问旧Case/附件版本/评估/投影/会话ID被拒，旧组织公开读不可见。不存在资源记不涉及，不能把未知读取当空。迟到任务安全引用后端L2，浏览器仅记异常观察。
- [ ] 第一轮 recruiter→candidate，两条顺序独立；第二轮同顺序、全新run重验。两个方向在同最终 YAML/PDF/流程 hash下各两个独立业务+cleanup+隔离PASS；发生事实/流程改动旧受影响证据失效，补受影响方向，最多六个探索run（含失败和中断）。每个计入稳定性的匹配run，其对后继身份的隔离必须由下一个新run实际核验，核验前只记待验证，不能引用其他run证明代替。四个匹配run后安排第五个新run作为隔离核验尾轮：仍使用本Suite专用配置、prepare/verify和双角色浏览器，只检查第四个及此前匹配run的旧资源不可见/不可读，不发起新的匹配、不上传新附件、不创建真人会话。该尾轮业务记NOT_RUN、不得计入双向匹配PASS；完成隔离核验后照常finally cleanup、verify/status对账及旧身份失效。尾轮仅有结构化准备资源，执行同一cleanup验收（rc0+CLEANED+当前residuals=[]+合法retained三方对账+占用释放+旧Cookie401/旧登录材料失效+无未收敛工作）；允许冻结主体锚点合法保留，不要求物理消失。尾轮不留下待后继验证的新匹配历史，避免无限追加。尾轮也计入六run上限；若材料调整或失败耗尽预算而无额度完成尾轮，稳定性仍未完成，报告给用户，不降低标准。
- [ ] 固化真实入口文字/可观察定位依据、自动/人工分界、预算、证据字段和失败恢复。不能固定模型整段输出、问答轮数、分数或秒数。每轮失败保留，模型拒绝是Happy未通过，归因不明如实记原因未定；超过六run未收敛报告未完成。提交 `test(dogfood): stabilize bidirectional matching journeys`。

**完成/停止：** 两方向各两次有效PASS且每个已创建run已收尾。收到后端阻塞、合同外新问题、未知事实不能回答或环境占用未释放，先确保finally记录再停止依赖工作；不能把下轮成功抹掉前轮残留。

### Task 5: 注册 Suite 并对齐索引与报告

**目标/非目标：** 将已探索的两个 Case 变成可独立选择的活动指南；不改旧Suite结论、不增加自动runner。

**预期编辑文件：**
- 新增：无。
- 修改：`docs/dogfood/stg-matching.md`、`docs/dogfood/真实后端行为验收.md`、`docs/dogfood/真实后端报告模板.md`、`docs/testing/README.md`、`docs/testing/cases.md`、`CLAUDE.md`。
- 删除：无。

**依赖/契约：** Task 4 已达到稳定性或诚实记录未完成；未完成不能作为最终交付ready。本Suite两精确Case名对应两入口，任取一条仍需双角色、独立run/finally。生成清单区归 runner，L3手写区才登记dogfood；AGENTS/CLAUDE双写工程原则不修改。

- [ ] 总指南与CLAUDE活动路由加入stg-matching链接及范围，两个Case分别入口、数据依赖、A终点、预算、清理；旧B02/Onboarding不因本Suite取证就宣称通过。
- [ ] 模板增加方向、探索/正式标记、前后端/tool版本、数据/流程hash、run/receipt安全坐标、阶段/附件版本证据、角色操作、业务/准入/cleanup/隔离独立verdict、跨轮对应、原始失败及证据失效原因。
- [ ] README登记已修本地问题和新Suite；cases手写L3区登记恰好两Case，可独立选择。用 `npm run test:list -- --write` 更新实际runner自动区（仅确有变化时保留），再 `npm run test:list -- --check`；不将人工L3伪装为runner收集项。
- [ ] `rg -n 'stg-matching|CLEANUP_BLOCKED|CLEANED_WITH_RESIDUAL' docs/dogfood docs/testing CLAUDE.md` 人工核对链接、大小写、Case选择及清理语义；`git diff --check`，确认未提交凭据、原始登录输出或截图隐私。
- [ ] 提交 `docs(testing): register STG matching suite and evidence contract`。仅给出已有探索结论，正式L3仍NOT_RUN。

**完成/停止：** 索引/指南/报告模板一致且清单校验通过。未达探索稳定性或仍有cleanup未收敛，不可标实施完成。

## 实施后收尾（不计入 Task count）

1. 完成全部Task及宿主执行skill要求的宿主内全局review（未要求则不加）。退出Task循环，覆盖默认finishing-a-development-branch流程。
2. 冻结候选。Codex宿主调用claude-review-loop，Claude宿主调用以Codex为reviewer的对应多轮只读skill；绑定批准Spec和最终Plan精确revision/blob、候选diff、已知证据。reviewer不跑测试。接收者用receiving-code-review逐条裁决；轮间仅修复定向单元/静态，不跑全量affected，不回到Task/globalreview。
3. 完成“测试选择与权威责任”的全部本地入口；用户要求全量是本任务适用完整责任，不能降成只测变更文件。初始有效覆盖按六维证据复用，失败项及失效依赖补齐。对账实际runner收集项、静态/build及视觉18场景；历史数目不硬编码。仓库无affected wrapper时直接用原生命令/原报告，不新增gate或跨任务缓存。缺少权威子集/依赖证明则调查并报告覆盖缺口，不自动重跑整层掩盖未知。
4. 全部责任通过且review处置允许后，读取development-workflow根相对 `references/final-integration.md` 与 `assets/final-integration-contract.md`，向用户展示 candidate_commit、只读fetch所得pre_gate_target_base、测试selection/receipt、可复用与待补项、正式L3恰两Case、cleanup计划和普通推送方案。此时才请求final gate确认；此前不合target、不跑正式L3、不push。
5. 获明确确认后，fetch并记录final_target_base，按获批方案合origin/main（不rebase）。以实际target→candidate重算完整责任，final_affected_base必须等于final_target_base；依source/transitive inputs、selection/config、runtime、fixture、外部前置、cleanup/repair六维复用，有缺口才补。基准/候选/环境未变且merge无变化可零次本地runner复用。
6. 冻结正式selection：required=`stg-matching-recruiter`与`stg-matching-candidate`，按最终指南各新run串行agent-browser；最后一个正式匹配run清理后，同样准备一个不发起匹配的隔离核验尾轮，核验该run实际留下的历史不可被新身份访问，再清理尾轮自身结构化资源/身份。尾轮是两Case的隔离验收辅助，不增加第三个业务Case、不算匹配PASS；其环境操作与预算纳入final gate方案。旧Suite NOT_SELECTED；探索不能替代正式。全部finally后再次对账本地与L3证据，记录PASS_EXECUTED/INCREMENTAL/REUSED的真实来源与失效项。范围内修复自主继续定向验证，不再调用异构review；合同变化/环境不可用诚实阻塞。
7. 第二次fetch核对target未推进；若推进或fast-forward拒绝，保留证据展示新gate，不自动追赶。未推进且全部责任有效才普通fast-forward push到获批target，禁止force。推送成功才报告合入；更新intent完成状态与结果位置。不在本规划会话启动上述实施。

## 文档 review 与交付记录

批准正文引用：Spec revision `40a9c6f35124813902f317ed2c0e6a30944c271d` / blob `0ebb68e87c110dc62b388b3f21a06c8e44bb25aa`。

文档 review 范围仅本 Plan 与对应 Spec，采用 WORKFLOW_DOCUMENT_REVIEW。结果在此追加；本阶段不运行产品测试、不实施 Task、不创建真实 STG run。

R1（Claude Opus/high，WORKFLOW_DOCUMENT_REVIEW）：候选 `63cdb535`；Spec/Plan 指纹与 HEAD/status 后置保护均通过。1 条 Important / required / 契约违反：最后匹配 run 缺少后继新身份隔离核验。按 receiving-code-review 核对批准 Spec §§7–8/10 后接受并修复：每个计数 run 必须实测后继隔离；安排不产生新匹配历史的核验尾轮，仍计入六 run 探索上限，业务 NOT_RUN，不冒充匹配 PASS。正式验收也明确同一责任。未改批准 Spec，无产品测试执行。

R2（同一 Claude Opus/high 会话）：候选 `3422179946ad`；后置 status/HEAD/文件指纹保护通过，R1 缺口确认已修复。新增 1 条 Minor / required / 契约违反：尾轮“核验其消失”可能误拒合法冻结锚点。对照批准 Spec §8 与本 Task 通用 cleanup 条件核实后接受，替换为同一 rc0/CLEANED/空 residuals/合法 retained 三方对账/占用释放/身份失效/无未收敛工作的验收，明确不要求物理消失。修复为文字口径统一，无新机制、无批准契约变化。

终止裁决：两轮共 2 条 required 均已核实并修复；0 条拒绝、0 条 optional 延后、0 条未解决有效 required，按 review-loop 的“核实后无未解决 required”条件结束，并非声称 R2 原报告为 NO FINDINGS。执行提示词在此结论后生成。文档校验：源码/测试引用文件存在、5 个 Task/单一不计数收尾、无占位、git diff --check 通过；本阶段无产品测试或 STG 业务运行。

交付校验：单文件双宿主 validate_prompt_grading.py 通过（5 Task、Claude Code subagent-driven-development、Codex executing-plans、高复杂度/高漂移/前沿模型）；配置路径示例改用 realpath 从仓库相对路径求运行时路径，避免校验器将拼接文本识别为固定绝对路径，行为合同不变。最终执行提示词在 docs/superpowers/prompts/2026-09-17-baseline-stg-matching.md，精确引用本 Plan 提交后的 revision/blob；仅文档交付，产品测试仍未执行。
