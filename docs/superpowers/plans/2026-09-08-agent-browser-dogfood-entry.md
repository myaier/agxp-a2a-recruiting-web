# 真实后端验收迁移到 Agent Dogfood Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 `superpowers:executing-plans`，同一执行者串行完成下列 Task；遵守 development-workflow 的新实施会话合同，不在规划会话实施，不创建第二个用户工作区。

**Goal:** 删除四个旧 agent-browser 测试入口及专属实现，交付 Agent 可独立执行并按关键节点判断的真实后端 dogfood 文档和证据模板。

**Architecture:** 直接复用现有 agent-browser 和后端环境/fixture 工具。前端只维护行为指南、Markdown 报告模板与两份合成 PDF；不增加运行器、自动判分器或新测试框架。

**Tech Stack:** Markdown、现有 Bash 后端工具、agent-browser；保留 React/TypeScript、Vitest、Playwright、Vite 工具链。

**Spec:** `docs/superpowers/specs/2026-09-08-agent-browser-dogfood-entry-design.md`，r2；批准 revision `082aa94b6851c596e9c17856a4eee769b7e6ef51`，blob `8e8f40b4ffcc938069b9b1a58a75cd13d51ad1d4`。用户在该版本交付后回复“可以，然后写0上下文Plan吧”，批准内容以此 Git 对象为准；Spec 文件中的待批准状态是批准前的历史文字，不要求改写已批准对象。

**Plan revision:** r2。最终内容 blob 由文档审查记录和执行提示词冻结，正文不嵌入自身 hash。

## Global Constraints

- 仓库：`https://github.com/myaier/agxp-a2a-recruiting-web`；宿主工作区：`/Users/visionclaw/.paseo/worktrees/09eyc7i7/rural-kangaroo`；当前分支 `audit-e2e-test-cases`；合入目标 `origin/main`。规划仅观察本地 refs，不 fetch/merge/push；实施 final gate 才同步目标。
- 先完整读 `CLAUDE.md`、`AGENTS.md`，再核验批准 Spec 和本 Plan。中文文档；英文标识符/commit 沿用仓库约定。
- 规划源码基线 `968a51f40083b276d9c7cf0bf32f8f403212450f`；此前被撤销的尝试及其测试输出没有当前候选证据效力。
- 只删除 `test:agent-browser:backend-local`、`test:agent-browser:hosted-agent`、`test:agent-browser:unit`、`test:agent-browser:shell`。两份合成 PDF 字节保持；其他测试、共享依赖、CI、应用行为保持。
- 被测业务写入通过 UI；环境准备/清理由现有工具完成。页面与刷新/重开结果为主，同角色只读 API 为补充，不用 API 写成功或管理员视角替代 UI 验证。
- 保留 Spec §6 全部九类行为、七个视觉观察位置、完整范围内 H01 两次独立运行；不保留跨 Case 固定五轮 Shell 顺序。
- `VITE_DATA_SOURCE=backend`、`VITE_BACKEND_ENV=local`；迁移基线 Origin `http://localhost:5173`，先核对 Cookie/CORS，不自动改成 127.0.0.1、其他端口或 Mock。
- 同一 fixture 生命周期 converge → verify → cleanup 共用唯一 `BROWSER_FIXTURE_RUN_ID` 和准确后端 receipt；下一轮换 ID；cleanup 后 receipt 退休。不新增前端编排脚本、自定义 skill、DSL、JSON 报告 schema、LLM wrapper 或虚假 npm 成功入口。
- 不修改后端业务/fixture，不实现 baseline scene，不修改产品代码来消除演练中发现的问题；缺失环境/场景记录 BLOCKED 并交给对应 owner。
- 复用宿主工作区；保留现有未跟踪盘点文档 `docs/前端E2E测试Case清单-20260908.md` 及用户内容，不顺手提交，不 stash/reset/clean。运行私密材料留忽略目录。
- 只有真实消费者证据才允许保留原以为专属的共享依赖，并报告差异；若影响删除范围或验收义务，停止受影响步骤、修订设计并重审，不能自行扩大批准范围。

## Task index 与交付边界

| 顺序 | Task | 消费与产物 | 完成条件 |
| --- | --- | --- | --- |
| 1 | 原子迁移文档入口、资源和旧实现 | 消费批准 Spec 和现有源码；产生完整新指南/模板、PDF、四入口退役与配置清理 | 静态迁移检查、共享工具链和用例发现全部通过 |
| 2 | 用新指南做真实演练并记录交付证据 | 消费 Task 1 已完整落盘的入口；产生本地报告和脱敏摘要 | 演练和清理有真实结论；缺环境时明确未完成责任，不能冒充通过 |

本 Plan 是一个独立交付，2 个顶层 Task，串行、无其他 Plan 前置。Task 1 中旧入口删除、PDF 路径和文档切换彼此耦合，拆成不同交付会产生失效入口或附件链接，故在一个迁移提交内完成。Task 2 可独立提交脱敏证据，不承担第二套实现。回退单位是 Task 1 完整迁移提交；真实数据先按记录清理，Git 回退不承担数据恢复。不得只还原 npm scripts 而留下缺失 runner。

**计划本身复杂度：中。** 主要为删除和文档迁移，但涉及资源、构建引用、九类行为与后端生命周期的保真。

**零上下文漂移风险：中。** 文件边界已经冻结；现场后端版本、fixture 能力和账号条件需要执行者核对，已有明确 BLOCKED 规则限制现场重新设计。

执行模型只按零上下文漂移风险选择：使用当前可用的行业 Top 5–10 中高性价比模型。默认同一执行者串行，不以 Task 数触发委派。

## 开工前核对

- [ ] 核验规则、工作区及版本；若批准对象不可读，或范围内已有他人未提交改动，记录并解决契约/写入冲突，不覆盖现场。

```bash
git status --short
git branch --show-current
git show 082aa94b6851c596e9c17856a4eee769b7e6ef51:docs/superpowers/specs/2026-09-08-agent-browser-dogfood-entry-design.md
git rev-parse 082aa94b6851c596e9c17856a4eee769b7e6ef51:docs/superpowers/specs/2026-09-08-agent-browser-dogfood-entry-design.md
```

- [ ] 按执行提示词的真实 `task_intents.py` 路径读取帮助并 start 登记本 Plan 的文件范围；记录实施前 HEAD 为本次证据基线。里程碑/恢复/扩范围时更新自己的 intent，不代写其他任务记录。
- [ ] 先阅读下列相关实现，确认真实消费者及当前约束；只读，不运行旧 backend-local/hosted-agent/unit/shell。

| 读取位置 | 要提取的事实 |
| --- | --- |
| `package.json`、`tsconfig.json`、`tsconfig.e2e.json`、`playwright.config.ts` | 四 scripts、专属 TS 引用、需要保留的 testIgnore |
| `e2e/真实后端/运行整栈验收.sh`、`运行HostedAgent验收.sh`、`公共步骤.sh` | 环境归属、receipt v2、资源命名及退出/清理边界；不把命令序列复制成新 runner |
| `e2e/真实后端/旅程/候选数据加载.sh`、`候选CRUD.sh`、`招聘数据加载.sh`、`招聘CRUD.sh`、`HostedAgent闭环.sh` | 对照 Spec 核实关键行为不会漏迁；UI 中不继续依赖这些文件 |
| `e2e/真实后端/视觉/场景清单.ts`、`资源/简历-v1.pdf`、`资源/简历-v2.pdf` | 七个观察位置和字节迁移源 |
| `docs/AgentBrowser真实后端验收.md`、`docs/dogfood/backend-local-onboarding.md`、`README.md` | 仍适用环境知识、旧文档冲突和入口路由 |
| `e2e/视觉回归/比较器.ts`、`比较命令.ts`、`比较器.test.ts`、`场景.test.ts`、`脚本/UI回归核心.test.mjs` | pixelmatch/pngjs/tsx 的剩余消费者、现有报告与编排测试 |
| `playwright.数据源模式.config.ts`、`playwright.视觉回归.config.ts`、`.github/workflows/ui-regression.yml` | 三套选择规则、保留 CI 权威入口 |

## Task 1：完成可发现、可执行的迁移

**Files / 允许写入：**

- 新增 `docs/dogfood/真实后端行为验收.md`、`docs/dogfood/真实后端报告模板.md`。
- 迁移 `e2e/真实后端/资源/简历-v1.pdf`、`简历-v2.pdf` 到 `docs/dogfood/resources/`，然后删除整个 `e2e/真实后端/`。
- 删除 `tsconfig.e2e.json`；修改 `package.json`、`tsconfig.json`、`playwright.config.ts`、`README.md`、`docs/AgentBrowser真实后端验收.md`、`docs/dogfood/backend-local-onboarding.md`、`CLAUDE.md`。
- `.gitignore` 仅在需要解释历史产物保留时改注释，不能取消 `dogfood-output/` 或 `/agent-browser-backend-output/` 忽略。
- 历史文档默认不改；若确需退役标记，仅在已被活动入口引用的旧 Spec/Plan/handoff 顶部增加日期和新链接，先登记确切路径，不批量替换历史命令。

**Interfaces：** 消费 Spec §3–8，产出以指南链接、Case ID 和 Markdown 节点记录为人工/Agent 合同；没有新公共函数、HTTP API、schema、数据库或事务。浏览器登录/业务资源属于本轮专用账号与 receipt，环境资源按启动者归属。

- [ ] **1. 写独立指南，冻结行为而非点击脚本。** 指南包含以下内容；由 Spec 各节展开为可执行说明，不只放 Spec 链接让执行者再次设计。

| 指南段落 | 必须落盘的内容 |
| --- | --- |
| 入口与选择 | 输入目标 URL、后端工作区、账号/登录材料安全来源、全部/基础/Hosted/单 Case 范围；9 项都在报告，未选 NOT_RUN。仅选一项可以执行必要前置，但不把前置冒称其他组合 Case 已通过 |
| 准备与工具 | `agent-browser --version`、`agent-browser doctor`、`agent-browser skills get core --full`、`agent-browser skills get dogfood`；现场 CLI 输出为真相。Docker 与 backend health，两个独立具名浏览器会话，记录视口 |
| 环境 | 读取目标后端仓库规则、现有 dev-local/browser-fixture 文档及帮助，确认 `health --acceptance`、必要的 `prepare --acceptance`/`up --acceptance`；记录前后端 commit、profile 与栈归属。前端独占服务用 `VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local npm run dev -- --host localhost --port 5173 --strictPort`，复用前核对配置 |
| 数据与 receipt | 基础基准包含简历/意向/披露/附件槽位、招聘名片/公司介绍、在招/归档岗位。当前后端无 baseline 时不拿 happy 冒充；只有等价专用基准和安全恢复能力才执行，否则 BLOCKED。Hosted happy/p4/p5/p6 必须真实 acceptance fixture；一轮一个 run ID，准确 receipt 供 verify/cleanup，verify 成功再测，退休后不复用。遵守后端实际登录限流，OTP 与 fixture 调用不得成为无界重试手段；旧指南 `FIXTURE_LOGIN_PACE` 知识只在已核实运行中后端 cooldown 配置时适用，不照搬失去消费者的前端参数 |
| 操作方式 | snapshot/截图 → 当前语义或 refs 操作 → 重观察 → 结果与刷新证据；不固定长文案/坐标/点击大脚本。业务写走 UI，同角色只读补充，异步响应未知先回读避免重复写。工具 ref 恢复不等于产品失败，绕过产品缺陷仍保留 FAIL |
| 场景卡 | 下方覆盖表中每个 ID 都写目标、基准/scene、组合节点、刷新/重开、证据和恢复；不复制旧退出码或像素基线合同 |
| 证据与结论 | PASS/FAIL/BLOCKED/NOT_RUN，节点先于组合 Case；已有 FAIL 不被后续阻塞或绕行抹去。启动前记录节点等待预算或环境公开约定，到期记录最后状态和原因待定位，不无限延长，不变成新 SLA |
| 清理与恢复 | 正常/失败都清理；中断或换会话后先核对真实服务与 receipt 状态，再决定继续或清理，不默认重开同一场景；记录准确 receipt/对象/原值/自己的 PID/会话；后端工具 cleanup 或 UI 还原自行准备数据。只关自己的服务与会话，不删卷、不按端口 kill、不 close all；清理失败停止使用同资源的下一轮，记录恢复，不新增 trap/watchdog 保证 |

指南必须展开的业务节点如下，顺序是节点依赖，不是固定跨 Case 脚本：

| ID | 前置和关键节点 | 主要反例 |
| --- | --- | --- |
| B01 | 候选基准：姓名/摘要、意向职位/城市/薪资/数量、披露档位，逐页刷新 | 空/Mock/对方私有数据被误当真实加载成功 |
| B02 | 改名→刷新→还原；意向创建→调薪→删除，基准仍在；披露改档→还原；v1 PDF 上传→授权/回读→v2 替换→槽位核验→删除/刷新 | 删除时列表尚未加载；保存提示出现但刷新丢失；未知响应重复创建；附件解析终态独立记录，不能由上传 PASS 推断解析质量 |
| B03 | 招聘基准：姓名/职务/公司/介绍，在招与归档分组，刷新 | 混入候选私有摘要、岗位分组或资料错误 |
| B04 | 职务/介绍改后还原；发布→编辑→停止→重开→删除，各状态刷新，基准岗位保留 | 只看到创建 toast，未验证描述持久化/归档/删除 |
| B05 | 双会话分别登录/读资料，只退出候选；招聘刷新仍登录且授权资料正确 | 复用同一个会话伪造角色隔离 |
| H01 / happy | 规则解释/确认且有效规则增加→PDF 成功解析→候选委托开 Case→候选补事实→招聘初筛成功→双方协调/确认→双方同 Case 深链复读，过期动作消失 | 只有提示语没有实体；忽略初筛；把 P7 私聊发送/接收算作已验证。终点为双方确认/创建会话阶段，合法更后状态需实体及确认证据 |
| H02 / p4 | 已准备委托失败：委托后解释 AI 不可用，本次零 Case、无假推进、刷新；必要同角色 API 补零 Case | 只核验错误文案，遗漏误创建 Case |
| H03 / p5 | 开案/候选推进后招聘 attention；Case 存在但没继续，双方原因安全且一致，刷新 | 用 readiness 当 Agent retry、只测一个角色或刷新变假成功 |
| H04 / p6 | 规则解释失败→无确认成功入口/无新增有效规则→刷新→关闭失败卡恢复草稿，再确认无新增规则 | 失败后实际规则生效、原草稿丢失 |

完整范围需 H01 至少两次独立成功，前轮 cleanup 后新 run ID/receipt 再准备；H02/H03/H04 各一次。七个视觉位置为候选简历/意向/披露加载、候选改名并上传附件后、招聘名片/公司介绍加载、新岗位列表；检查文字可读、遮挡、溢出、状态/数据一致性，截图和实际视口留证，不要求固定 PNG 差异率。

- [ ] **2. 写报告模板与指南启动提示词。** 模板是可填写 Markdown，不写解析器；包含环境/提交/工作区状态、范围/角色与材料来源（不含密钥）、等待预算、资源归属与恢复记录、B01–B05/H01–H04 节点表、H01 第一次/第二次各自 scene/receipt/cleanup、七个视觉位置、问题明细、未覆盖项、业务结论及单列清理结论。所有业务/节点初始 NOT_RUN；清理用完成/未完成/不涉及。完整通过只在九类及重复责任 PASS 且清理完成时成立。

每个问题记录预期、实际、影响、步骤、截图/快照、可复现时的视频、再次复现结果与绕行，偶发首证据不可丢；每次业务写要有操作后和刷新证据。只读 API 仅记 method/path、必要脱敏字段与结论，不记 Authorization。产物放 `dogfood-output/<run-id>/report.md` 及 screenshots/videos，持续写入以便中断恢复；不保存 OTP/Cookie/完整认证状态，不在登录材料输入期间录像。私密业务证据不提交，摘要沿用 `docs/runs/`。

指南提供可复制的自然语言启动模板：明确“读取本指南及报告模板，先核对给定 URL/后端工作区/账号来源和范围，调用现有工具准备，由你观察页面执行并判别，按节点留证，清理后报告真实结果”。运行输入由调用者填入，不在仓库写真实账号、机器私密路径或自动推断授权的账号；缺必需输入只询问缺项，继续无依赖的只读准备。

- [ ] **3. 原子迁移 PDF 并删除专属目录/配置。** 先用 `git ls-files e2e/真实后端` 核对待删清单和工作区修改。迁移后 `git rm -r` 只作用该受版本控制的目录，不递归删除忽略产物；若有未跟踪文件留在该目录，检查归属，不能擅自删用户文件以追求目录不存在。

```bash
mkdir -p docs/dogfood/resources
git mv e2e/真实后端/资源/简历-v1.pdf docs/dogfood/resources/简历-v1.pdf
git mv e2e/真实后端/资源/简历-v2.pdf docs/dogfood/resources/简历-v2.pdf
git rm -r e2e/真实后端
git rm tsconfig.e2e.json
```

删 package 四个键，根 references 只去掉 `./tsconfig.e2e.json`，Playwright 只去掉提及退役目录的注释，保留 `testIgnore: ['**/数据源模式.spec.ts', '**/视觉回归/**', '**/*.test.ts']`。不改 lockfile/dependencies，不删除 pixelmatch/pngjs/tsx，不重写其他 TS 配置。

- [ ] **4. 更新可发现入口。** README 真实后端章节链接新指南/模板并说明四入口退役，保留其他测试命令说明。旧指南变短入口说明，明确旧命令不再可执行、链接新指南/onboarding；旧报告退出码、PNG 安装流程及错误的“每次算子调用换 ID”不继续作为操作指引。onboarding 只加存量资源/Hosted 范围区别与互链。CLAUDE 增加“真实后端行为验收读取新指南”的共享路由，保留双写工程原则段落，所以 AGENTS 无需同步改动。

- [ ] **5. 做迁移静态核对。** `git diff --check`；`git diff --name-status 082aa94b6851c596e9c17856a4eee769b7e6ef51`；`rg -n 'test:agent-browser:|e2e/真实后端|tsconfig.e2e' package.json tsconfig*.json playwright*.ts README.md CLAUDE.md docs/AgentBrowser真实后端验收.md docs/dogfood`。rg 无匹配的 exit 1 正常；命令名可作为明确退役说明，活动脚本/import/链接和可执行示例不得依赖已删文件。历史 Spec/Plan 中旧路径不当作活动残留。逐个打开新 Markdown 相对链接并检查资源路径。

用一次性命令比较 package 精确变化和 PDF 字节，不新增自证删除的仓库单测：

```bash
python3 - <<'PY'
import json, pathlib, subprocess
base = '082aa94b6851c596e9c17856a4eee769b7e6ef51'
def old(path):
    return subprocess.check_output(['git', 'show', f'{base}:{path}'])
expected = json.loads(old('package.json'))
for suffix in ('backend-local', 'hosted-agent', 'unit', 'shell'):
    del expected['scripts'][f'test:agent-browser:{suffix}']
assert json.loads(pathlib.Path('package.json').read_text()) == expected
for name in ('简历-v1.pdf', '简历-v2.pdf'):
    assert pathlib.Path('docs/dogfood/resources', name).read_bytes() == old('e2e/真实后端/资源/' + name)
assert not pathlib.Path('tsconfig.e2e.json').exists()
assert all(ref['path'] != './tsconfig.e2e.json' for ref in json.loads(pathlib.Path('tsconfig.json').read_text())['references'])
assert not subprocess.check_output(['git', 'ls-files', 'e2e/真实后端']).strip()
print('迁移静态核对通过')
PY
```

基线后若出现合法并行 package 改动，先辨认并记录实际消费者差异，将此核对的比较基线改为包含已核实并行改动的实施前提交；不简单删除断言。其他受保护路径以 diff 确认未改。

- [ ] **6. 定向验证并提交完整迁移。** 执行下方验证 V1–V4，不写删除镜像测试。失败先定位与本次改动的因果；产品/后端缺陷另记，不借机修复。全部静态/工具链检查通过后仅 stage 本 Task 范围，检查 staged diff，提交 `test: replace legacy backend runners with agent dogfood guide`。不得 git add 整仓带入盘点或私密材料。

**停止条件：** 发现真实共享消费者将被删除；PDF 不匹配；活动引用残留；指南减少必需节点；未知基线变化无法隔离；任一必要检查失败未解释。环境缺失不阻止写完指南和完成迁移检查，但不能宣称 Task 2/真实验证通过。

## Task 2：真实演练、修正文档歧义并保存证据

**Files：** 消费 `docs/dogfood/真实后端行为验收.md`、`真实后端报告模板.md`、`resources/简历-v1.pdf`、`简历-v2.pdf`；输出本地 `dogfood-output/<run-id>/`，可提交 `docs/runs/2026-09-08-agent-browser-dogfood-migration.md`（文件存在则先核对归属，不能覆盖别人的记录）。仅在批准边界内修正指南/模板歧义；不得改应用/后端或增加 runner。

**Interfaces：** 从文档启动，Agent 读取当前工具帮助并执行；不依赖规划聊天、已删脚本或未跟踪盘点。结果四态与清理状态严格按 Spec §7–8。

- [ ] **1. 在启动浏览器业务前保存空报告和环境盘点。** 记录所选 B02、H01、H04，其他 NOT_RUN；确认后端工作区、账号安全来源、Origin、acceptance 场景和服务归属。缺输入询问缺项，缺能力记录对应 BLOCKED，不猜后端路径、不自动对非专用账号造数据。
- [ ] **2. 按新指南演练 B02、H01、H04。** 各自所需 baseline/happy/p6 准备→verify→页面操作和节点留证→cleanup；H01 清理后用新的生命周期再跑一次。没有跨 Case 强制顺序；相同资源始终串行。按 Spec 观察和判别，不回到旧 shell、网络 mock 或源码状态注入。B02/H01/H04 中某项阻塞时仍可完成独立且具备安全前置的其他项。
- [ ] **3. 每个结束/失败路径检查清理。** 业务失败和清理失败独立记录；不能为了清理把业务标 PASS。receipt 与服务归属持续记录，可恢复进度；清理未完成时不继续同资源下一轮。完整报告保持本地；清理诊断敏感内容不进入摘要。
- [ ] **4. 修正文档中真实发现的歧义并验证受影响部分。** 等价措辞/路径错误可在本 Spec 内修正，说明理由；覆盖、写权限或生命周期变化要先修订设计重审。只重验受变化影响的步骤，保留既有有效结果与源 commit，不把环境恢复后成功抹掉先前真实产品 FAIL。
- [ ] **5. 写脱敏摘要并提交。** 包含候选 commit、后端版本/配置的非敏感描述、范围、两次 H01 各自结果、其他项 NOT_RUN、观察到的问题、清理结果、命令检查结果、未完成责任与 owner。没有环境时写“迁移产物检查通过；dogfood 演练 BLOCKED”，不能写任务完全验证。提交只含允许的文档与摘要，raw screenshot/OTP/receipt 不提交。

**完成/停止条件：** B02、H01 两次、H04 与清理的有效证据是实际演练完成标准。缺环境或产品缺陷可以产出完整阻塞/失败记录，但实际验收责任继续未完成，由实施者在 final gate 明示；不能自动降低为仅迁移检查 PASS。

## 验证责任：测试选择五问

### 1. 防止哪些失败、跨哪些边界

删除专属实现不能破坏共享包/构建/用例发现，附件迁移不能损坏材料，文档不能丢九类行为或误教 receipt 生命周期。真实演练证明 UI 写入、刷新持久化、Hosted 成功/失败、清理能由文档驱动执行；静态检查不能证明这些真实边界。

### 2. 最小合法开发反馈命令

依赖已安装且匹配 lockfile 时直接用；缺依赖才 `npm ci`，不能为了本迁移升级包。V1–V4 在同一有效候选各一次，顺序执行并记录退出码/耗时/source commit；不因为单次工具等待超时重启仍在运行的进程。

| ID | 命令 | 必须断言 |
| --- | --- | --- |
| V1 | Task 1 静态核对命令、链接/九 Case 与节点、中断恢复及登录限流规则人工逐条核对 | 四键精确删除，PDF 同字节，无活动悬空引用，受保护路径没改，模板覆盖完整 |
| V2 | `npm run build` | tsc project references 和 Vite build 成功；已包含 `tsc -b`，无需再机械跑一遍 typecheck |
| V3 | `npm test -- e2e/视觉回归/比较器.test.ts e2e/视觉回归/场景.test.ts 脚本/UI回归核心.test.mjs` | 现有 Mock 比较/报告、场景与编排单测全通过；这是 Vitest，不能用 node --test 跑该 mjs |
| V4a | `npm run test:e2e -- --list` | 基线发现 10 例：onboarding 8、无闪屏 2，无真实后端/Vitest 误收 |
| V4b | `npm run test:e2e:data-source -- --list` | 基线发现 100 次执行（含复用 onboarding），按 mock/backend/annotation 项目选取 |
| V4c | `npm run ui:capture -- --list` | 基线发现 18 个 Mock 视觉采集场景，仅采集.spec.ts |

列表数字来自规划基线，合法目标分支新增用例需解释选择变化，不删用例凑数。`--list` 只证明发现/配置，不能记浏览器执行 PASS。删除的 unit/shell 永不作为验证入口；不新增只验证删除动作的长期测试。

### 3. 何时提前验证真实边界

指南/模板落盘且迁移检查通过后立即做 Task 2 最小演练，不拖到 final gate 首次发现 receipt 或登录协议失效。它是本次替换方式的定向演练，不是正式全范围门；scene 版本不匹配记录 BLOCKED，不能偷偷换协议。若改动扩大到产品请求/权限/代理/fixture，停止范围扩大、重审契约并重算测试责任。

### 4. 最终权威验收与发布责任

- 迁移产物权威责任：V1–V4 无缺口；新方式最小真实演练责任：B02、H01 两次、H04、对应清理。责任 owner 均为新实施会话执行者；后端能力阻塞由目标后端 owner 解决，执行者保持跟踪，不用历史测试代偿。
- 完整业务 dogfood 是九类全部 PASS、H01 两次且清理成功。本迁移最小演练不自动声称全覆盖；用户选择全部或后续真实全范围验收时才执行完整范围，并列出额外成本/前置。
- 静态 L3 集成责任：`conditional`。本仓库没有名为 L3 的固定 npm suite；本地普通迁移不发明该入口。PR 的现有真实浏览器 CI 门是 `.github/workflows/ui-regression.yml` 中 `npm run ui:check -- --base "origin/<PR目标分支>"`，PR 触发时仍由 CI 执行并保存 report/evidence，不修改 workflow、不用 --list 替代它。没有 PR 且无共享 UI/配置行为变化时，不机械增加完整 Playwright/视觉执行；若最终实际 diff 改到共享 UI/视觉配置或 CI 选择，实施者在 final gate 列出精确新增责任并解释因果。
- final gate 确认前只做上述必要定向反馈和实施 peer review；不得提前同步 target、正式全范围门或 push。先展示 candidate SHA、观察到的 target SHA、PASS/FAIL/BLOCKED 与证据有效性、增量命令和合入方案，等待用户明确确认。
- 获批后按 execution prompt 指向的 final-integration 合同 fetch/merge target，重算完整责任。复用证据必须能核对依赖输入、selection、runtime、fixture/profile、前置与 cleanup；只补缺失/失效项。HEAD 改变不自动作废一切，证明不了的条目重新验证；不建立新缓存。
- 仍有 required 验证阻塞或有效缺陷时如实报告未就绪，不静默跳过后 push。普通 fast-forward push 成功后才报告合入，release/deploy 不在本任务。

### 5. 已有证据与预计成本

规划阶段只有源码/配置检查和文档自检；没有本次实现测试 PASS、正在运行的 backend 保证或有效 dogfood receipt。V1–V4 与真实演练耗时未知；不为填时间先跑重测试。预计成本由两次 Hosted 成功链路和后端准备/清理主导，执行时记录实际耗时和阻塞点。

## 收尾与回退

实施完成且定向反馈收敛后，由同一执行者按宿主映射做异构只读代码 review（Codex → Claude，Claude → Codex），绑定批准 Spec、最终 Plan 版本和固定候选；reviewer 不跑测试，最多三轮，逐条核实 required/optional，不另起重复全面 review。输出实施记录和 final gate 方案，流程细节按执行提示词所引 execution contract。

需要回退时先清理本轮实际资源并保护其他改动，针对本任务完整迁移提交提出 `git revert` 方案；不 reset/clean，也不还原其他人的工作。迁移删除只改变测试入口，不改变数据库 schema，无数据迁移回滚。当前延后的自动调度/自动评分/崩溃回收只有出现 Spec §9 所述实际成本或漏项证据时再评估。
