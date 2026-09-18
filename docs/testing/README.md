# 前端测试分层（长期入口）

这是前端测试的总入口：三层责任、Suite 目录、按影响选择测试的精确命令、Case 扩展步骤、
各 Task 的迁移对账与计时证据。完整逐叶 Case 清单在 [`cases.md`](cases.md)（自动生成 +
手写 L3 索引）。分层目标与验收口径见 tracked 的
[`../superpowers/specs/2026-09-16-frontend-test-layering-design.md`](../superpowers/specs/2026-09-16-frontend-test-layering-design.md)
与 [`../superpowers/plans/2026-09-16-frontend-test-layering.md`](../superpowers/plans/2026-09-16-frontend-test-layering.md)；
各 task 报告是会话本地证据，在 git-ignored 的 `test-results/test-layering/`（原始回执/计时件）。

## 三层与总命令

| 层 | 负责证明 | 入口 |
|---|---|---|
| 第一层 · 单元/组件 | 计算/映射、状态转换、请求构造与解码、组件单一交互 | `npm test`（Vitest；原生文件/`-t` 选择） |
| 第二层 · 浏览器 | 页面接线、请求契约、异常恢复、隔离与浏览器交互 | `npm run test:e2e`（mock/fixture/annotation 三 project）＋ `npm run ui:capture`（视觉采集） |
| 第三层 · L3 | 关键旅程跨真实 STG 可完成并持久化 | `docs/dogfood/真实后端行为验收.md`（显式选择，独立凭据/清理合同） |

清单生成（C1/C5，唯一清单真相在 `cases.md` 自动区）：

```bash
npm run test:list              # stdout 输出稳定 Markdown 清单（不写文档、不跑测试）
npm run test:list -- --write   # 全部收集/校验成功后只更新 cases.md 自动区
npm run test:list -- --check   # 只比对自动区是否过期；不同/收集失败非零，不写文件
```

脚本（`脚本/测试清单.mjs`）只包装三次原生只收集调用（`vitest list --json`、
`playwright test --list --reporter=json` 功能与视觉两配置），不执行测试、不启动服务、
不访问网络、不在导入阶段建采集目录。新增未映射测试文件或重复 Case 身份会非零失败并
提示最小补映射；生成失败不覆盖原文档，两次生成结果字节相同。

## Suite 目录

第一层按固定路径前缀归类（脚本冻结表），子目录/模块与既有 describe 构成更细子 Suite：

| Suite | 路径前缀 / 文件 | 当前规模（2026-09-16 清单） |
| --- | --- | --- |
| 数据契约/映射 | `src/数据/` | 1452 例 · 49 文件 |
| 状态 | `src/状态/` | 1227 例 · 30 文件 |
| 流程 | `src/流程/` | 174 例 · 6 文件 |
| 页面/接线 | `src/屏幕/`、`src/路由/`、精确文件 `src/应用.test.tsx` | 2164 例 · 100 文件 |
| 组件 | `src/组件/` | 422 例 · 52 文件 |
| 配置/工具 | `src/配置/`、`脚本/`（`.test.mjs`）、`e2e/视觉回归/*.test.ts` | 39 例 · 7 文件 |

第二层按 C6 文件表归 Suite；保留在 `e2e/` 根的 spec 按补充映射归属（`onboarding.spec.ts`
是「候选建档」「招聘建档与JD」两 Suite 的文件级并集，三个招聘叶子按标题前缀归招聘建档）：

| Suite | 文件 | 当前规模 |
| --- | --- | --- |
| 登录与数据源 / 登录与数据源边界 | `e2e/suites/登录与数据源.spec.ts` / `e2e/离线边界.spec.ts`（边界反例） | 18 + 6 例 |
| 候选建档 / 招聘建档与JD | `e2e/suites/候选建档.spec.ts`、`e2e/suites/招聘建档与JD.spec.ts`、`e2e/onboarding.spec.ts`（并集） | 6 + 6 例 |
| 简历与附件 / 求职意向 / 岗位编辑 | `e2e/suites/简历与附件|求职意向|岗位编辑.spec.ts` | 11 + 6 + 4 例 |
| 招聘组织 / 隐私与实名 / Agent规则 / 发现推荐 / MatchCase / 真人消息 / 账号与支持 | 同名 `e2e/suites/*.spec.ts` | 15 / 13 / 11 / 15 / 12 / 8 / 16 例 |
| 连续委托 | `e2e/suites/连续委托.spec.ts` + `e2e/J-PILOT-02接线.spec.ts` | 8 例 |
| 展示与交互 | `e2e/suites/展示与交互.spec.ts` + `P1展示统一/展示字段接线/抽屉稳定性/换壳无闪屏/问AI代理展示` 五个保留文件 | 137 例 |
| 标注 | `e2e/suites/标注.spec.ts` | 2 例 |
| 视觉采集 | `e2e/视觉回归/采集.spec.ts`（只由视觉配置收集；C3 边界在该文件取 mock） | 18 例 |

清单逐叶明细（含逻辑标题、project 变体、源码链接与选择坐标）见
[`cases.md`](cases.md)；叶子身份 = layer + 文件 + 完整名称 + project，行号只是导航。

## 扩展 Case 的最小步骤

1. 第一层：在同域测试文件内用原生 `describe/it` 加用例（表驱动优先用数组 each 并让
   参数出现在标题里——vitest 4 对象 each 不做 `$var` 插值，同名 Case 会让清单身份重复）；
   跑 `npm run test:list -- --check` 确认清单仍一致（新用例属已映射文件则自动入清单）。
2. 第二层：功能 spec 从 `./fixtures/test` 导入 `test/expect`，按 C6 表把新 spec 放进
   对应 Suite 文件；若新增文件，先在 `脚本/测试清单.mjs` 的映射表补归属（脚本会显式报错提示），
   再 `npm run test:list -- --write`。
3. 每条新 Case 单选可运行（`-t`/`--grep` 精确标题）；业务请求按 C3 坐标显式声明，
   不改产品；涉及慢等待先按 Task 3/4 的口径补计时证据再决定拆分。
4. L3：只在 `cases.md` 手写区/活动指南扩展现有组合；不把 fixture/单元结果冒充 STG PASS。

## 成本观察（拆前拆后）

- 第一层：四个大文件拆分前后用例计时合计持平（±5% 内，见 Task 4 章）；实际提速来自
  受控时钟（城市 2421→54ms、实名 4096→752ms）。拆分目标是可以独立选择，不是全局提速。
- 第二层：C4 拆分净增 8 例（长 Case 拆分表见 Task 3 章），拆前链路均有计时样本存档
  （`test-results/test-layering/`，git-ignored）；离线边界与 fixture 抽取不折算为提速。
- 清单（2026-09-16 生成）：第一层 5478 例 / 244 文件；第二层功能 294 例 + 视觉 18 例。
  计时逐叶记「未知」（清单不含执行计时；Suite 级计时见各 Task 对账章）。

## 现状（Task 1 完成后）

- **唯一功能配置**：`playwright.config.ts`，三个项目共用同一 runner，同一 invocation
  内共享启动三个不可复用 dev server：`mock` → 4181、`fixture` → 4182、`annotation` → 4183。
- **入口**：`npm run test:e2e`（原生文件/完整名称/`--project` 选择）；
  `npm run test:e2e:data-source` 是 deprecated 完全别名（同一 `playwright test`，
  不是第二份配置）；`npm run ui:capture` / `npm run ui:check` 维持视觉入口不变。
- **离线请求边界（C3）**：`e2e/fixtures/离线边界.ts` + `e2e/fixtures/test.ts`。
  功能 spec 统一从 `./fixtures/test` 导入 `test/expect`；业务路径 = URL 前两个非空段
  依次为 `api`、`v1`；未声明业务 HTTP 兜底中止、业务 WS 永不 `connectToServer`
  （fixture/annotation 的 `/api/v1/events/live` 用空闲本地连接）；Case teardown
  `核对()` 以 method/path 定位缺口。反例见 `e2e/离线边界.spec.ts`。
- **旧兜底移除**：`数据源模式.spec.ts` / `J-PILOT-02接线.spec.ts` 的全局 `200 + null`
  兜底与 P1/展接线 fixture 的「白名单外一律 503」已删除；缺席域按坐标显式声明
  空应答（隐私 / 连续代谈 / 收件箱 / 简历教育条目更新），其余未匹配请求由离线边界
  兜底中止并使 Case 失败。

## 基线与对账（Task 1 收集）

- 原始收集件在 `test-results/test-layering/`（git-ignored；Playwright 每次运行会清空
  `test-results/`，复跑后需从当次输出重新落盘）：
  - `旧-默认入口-list.json` / `旧-数据源入口-list.json`：旧两入口 `--list` 只收集；
  - `旧-280责任表.json`：fullTitle → 旧项目去重责任表（337 变体 / 280 唯一 / 57 入口重复）；
  - `新-唯一入口-list.json` 与对账说明：280 原责任 + 离线边界反例（`e2e/离线边界.spec.ts`
    6 例），逐项差额解释见 Task 1 报告。

## Task 2 对账（BFF fixture 分域抽取，C2）

### 选集标识逐项相等

`npm run test:e2e -- --list --reporter=json` 收集 286 项（280 原责任 + 6 离线边界
反例），与 Task 1 及搬迁前（`test-results/test-layering/搬迁前-list.json`）按
「projectId + describe 链 + 用例名」逐项相等，零增减零改名 —— 不拆 Case，全部
fullTitle 原样保留；用例正文（断言）除下述代码搬迁外一字未动。

### 代码搬迁地图（旧 `e2e/数据源模式.spec.ts` 行号 → 新家）

阶段一（8e48ec29，样本/类型/工厂）与阶段二（本任务，路由 handler）：

| 旧行号（搬迁前 spec） | 新文件 · 新符号 |
| --- | --- |
| 329–341 / 2670–2682 / 2913–2964 | `e2e/fixtures/bff/协议.ts`（信封/目录页、键集断言、拦截投影、multipart） |
| 317–327 / 1042–1112 | `账号与目录.ts`（标记值、静态主体/简历/意向样本） |
| 343–488 / 490–1040 | `Agent规则.ts` / `发现推荐.ts`（P6 / P4 样本与工厂） |
| 1114–1440 | `招聘组织.ts` / `隐私与实名.ts`（P1C / P3 样本与工厂） |
| 1582–1639 / 1641–2577 / 2579–2818 | `附件.ts` / `MatchCase.ts` / `账号控制面.ts`（P2 / P5 / P8） |
| 430–465 → `招聘组织.ts 创建组织安装状态`；466–503 → `Agent规则.ts 创建P6安装状态`；403–406 → `发现推荐.ts 创建P4安装状态` | 每次安装独立状态工厂 |
| 541–835 → `候选建档.ts 处理候选建档域`；837–909 + 1947–2020 → `账号与目录.ts 处理账号与目录域`；911–999 → `隐私与实名.ts 处理候选实名域`；1001–1091 → `附件.ts 处理附件域`；1093–1254 → `隐私与实名.ts 处理隐私域`；1256–1418 + 2022–2171 → `招聘组织.ts 处理招聘组织域`；1420–1675 → `Agent规则.ts 处理Agent规则域`；1677–1945 → `发现推荐.ts 处理发现推荐域`；2173–2746 → `MatchCase.ts 处理MatchCase域`；2748–2817 → `真人消息.ts 处理真人消息域`；2819–3118 → `账号控制面.ts 处理账号控制面域` | 域 handler（返回是否已应答） |
| 344–383（interface）、391–402、407–428、504–539、3120–3176 | `安装BFF路由.ts`（薄装配：interface 逐字 + export；prelude/尾段逐字；固定顺序分发） |
| 23 个跨 describe 共用交互 helper（装三级职位目录桩、装P4/P5×3、安装P7事件桩、P7带消息fixture、Mock 登录族、picker 登录/存量候选、抽屉搜企业并选中、走完后端发岗向导、走向导薪资、左滑候选卡/附件行、断言纵序/附件标题几何/意向规则零写入口/登录页无水平溢出、是APIv1路径、Mock源） | `e2e/fixtures/数据源交互.ts`（逐字迁出 + export） |

### 分发顺序的两处等价调整（已核对 path 集不相交）

1. 静态 resume / intentions / catalog（旧 1947–2020）从 P4 之后并入
   `账号与目录域`：这些 path（`/me/resume*`、`/me/intentions`、`/me/account-profile`、
   `/catalog/*`）与 IV（identity-verification*）、P2（`/me/resume-files*`，与
   `/me/resume/...` 字串不相交）、P3、组织、P6（agent-rule*）、P4（recommendation/
   delegation/jobs-子路径）的匹配集均无交集，先后互换不改变任何请求的应答者。
2. recruiter jobs（旧 2022–2171）从 catalog 之后并入 `招聘组织域`（先于 P6/P4/P5）：
   `/recruiter/jobs` 精确 path 与 P4 的 `/recruiter/jobs/{id}/candidate-recommendations`
   等子路径、P6/P5 全部匹配集不相交。组织 fixture 缺席时 jobs GET 仍应答权威空清单
   （`招聘组织.ts` handler 的显式分支，原 `组织fixture ? 岗位可变 : []` 语义）。

### 搬迁中修掉的三处装载/运行缺陷（不改任何断言与产品代码）

- `候选建档.ts` 的 `'../../src/数据/BFF契约'` 在 `e2e/fixtures/bff/` 下解析到
  `e2e/src/`（阶段一遗留），改为 `'../../../src/…'`；
- `隐私与实名.ts` 缺 `解metadata部件` 导入（阶段二拆分遗漏，IV create 会
  ReferenceError），补从 `./协议` 导入；
- 27 处单行 `if (…) { …; return; }` / `if (…) return;` 未随 `return; → return true;`
  归一（MatchCase 6 处、账号控制面 21 处），handler 会返回 undefined 使分发穿透
  已应答路由 —— 全部改为 `return true`。另将 `路由上下文形.请求` /
  `取multipart部件` 的 `Route['request']`（方法签名 `() => Request`）纠正为
  `Request` 实例类型。

### 证据件（git-ignored；Playwright 会清空 `test-results/`，复跑后需重新落盘）

- `test-results/test-layering/搬迁前-list.json` / `拆分后-list.json`：前后 `--list`
  收集（286 逐项相等，对账脚本按 projectId+describe 链+用例名比对）；
- `test-results/test-layering/拆分前-定向链路.json`：C4 拆分前定向链路计时样本
  （本任务拆分后代码、workers=4、retries=0、7 链全绿，总 27.5s 墙钟）。

## Task 3 对账（C6 Suite 拆分 + C4 长 Case 裁剪，2026-09-16）

原 `e2e/数据源模式.spec.ts`（162 收集项、62 个顶层 describe + 1 个裸 test）已整体
迁入 `e2e/suites/` 16 个 Suite 文件并删除；等价迁移先按「projectId + describe 链 +
用例名」逐项对账（162 = 162，标题集合相等），再实施 C4 拆分。最终全量收集 294 项
= 286 − 162（旧 spec）+ 170（新 suites）= 286 + 8（C4 拆分净增），每一条增项见下表。

### C6 迁移地图（原 describe → 新文件；titlePath 原样保留）

| 新文件（e2e/suites/） | 原顶层 describe（旧 spec 行号） |
| --- | --- |
| `登录与数据源.spec.ts` | Mock 数据源回归（89）/ 登录区号 fixture 证据（478）/ Backend 数据源 fixture（569）；`e2e/离线边界.spec.ts` 同属该 Suite 家族（边界反例，保留在 e2e/ 根） |
| `招聘组织.spec.ts` | P1C 招聘组织 fixture（882，含企业名片/公开页统一用例） |
| `隐私与实名.spec.ts` | P3 隐私主链路（1659，C4 拆 3）/ P3 恢复分派（1866）/ P3 Mock 隔离（2304）/ 候选实名（7183）/ 裸 test Mock 候选实名（7241） |
| `Agent规则.spec.ts` | P6 规则域 fixture（2387，全链路 C4 拆 4） |
| `发现推荐.spec.ts` | P4 发现推荐域（2852）/ P4 Mock 隔离（3341） |
| `简历与附件.spec.ts` | P2 附件简历（3418）/ 核心编辑 作品集（5631）/ 教育 @mock·@backend（6475/6560）/ 简历行业 @mock·@backend（6708/6779）/ 候选资料编辑边界（6958）/ 候选个人优势编辑（7021）/ 核心编辑 附件 @mock·@backend（8655/8764） |
| `求职意向.spec.ts` | 核心编辑 意向薪资（5727）/ 候选私有筛选要求（5825）/ 城市 @mock·@backend（5957/6036）/ 期望行业 @mock·@backend（8420/8496） |
| `岗位编辑.spec.ts` | 核心编辑 岗位 @mock（6175，C4 拆 2）/ @backend（6300，C4 拆 2） |
| `候选建档.spec.ts` | 候选 onboarding Backend fixture（5374）；`e2e/onboarding.spec.ts` 是本 Suite 与「招聘建档与JD」的文件级并集（见该文件头注释） |
| `招聘建档与JD.spec.ts` | 招聘方 onboarding（7098）/ JD 建议稿导入（7270，C4 拆 2） |
| `MatchCase.spec.ts` | P5 MatchCase 生命周期（3578）/ P5 Mock 隔离（4378） |
| `连续委托.spec.ts` | J-PILOT-01 连续委托接线（8062）；`e2e/J-PILOT-02接线.spec.ts` 同属该 Suite 家族（保留在 e2e/ 根） |
| `真人消息.spec.ts` | P7 真人会话（4537）/ P7 Mock 隔离（4703） |
| `账号与支持.spec.ts` | P8 控制面（4743）/ P8 Mock 隔离（5280） |
| `展示与交互.spec.ts` | 在谈详情完整布局（4048）/ 卡片统一 Mock 三屏（7678）/ 卡片统一 Backend（7759）/ picker 统一 ×7 组（8905–9650）/ catalog-fullscreen ×9 组（9813–10577）；`P1展示统一/展示字段接线/抽屉稳定性/换壳无闪屏/问AI代理展示` 五个保留文件同属该 Suite 家族 |
| `标注.spec.ts` | 标注评审构建 @annotation（7473） |

单一 describe 专用的局部 helper 随块迁移（填意向表单并提交/以招聘方进入名片/登录区号
路由族/就绪卡动作键/下拉刷新手势/断言重读发生/装P7×2/装候选实名/装P8候选族/卡片几何
族/picker 与 catalog-fullscreen 几何族），无一跨 Suite 共享，未新增共享抽象。

### C4 长 Case 拆分表（原 → 新；断言去向）

| 原长 Case | 新 Case（净增数） | 断言去向 |
| --- | --- | --- |
| P3 隐私读写、组织屏蔽与岗位硬性条件走 HTTP fixture 主链路（10.1s） | ①披露读改回读：水合并行链 + 隐身开关 + 披露偏好稀疏补丁（If-Match "1"/"2" 原样）；②组织屏蔽与解除：目录搜索 q/limit/cursor、选回填零写、屏蔽幂等键、解除风险确认（If-Match 按独立 fixture 从 "1" 起算，原 "3"/"4"/"6" 是链内累计）；③岗位硬性条件：切换后组织链 + 发布四员完整 + 编辑空稀疏补丁（+2） | 取消零写（选回填零 POST）、revision（quoted If-Match 全链）、真实目录 ID（q/cursor/organization_id/四员）逐条保留；三条 Case 各自初始化账号与 fixture |
| P6 全链路：双端规则生命周期与请求契约（21.5s） | ①候选创建提案→确认（水合/轮询/物化 + 创建与 accept 回执幂等）；②候选替换提案（草稿预填/确认前旧规则在场/accept 后旧规则归档 + accept 幂等）；③候选归档（键盘揭开/确认前零 DELETE/If-Match 当前版本恰一次）；④招聘端创建→确认→pause/resume 版本链 1→2→3（+3） | 跨操作版本链与物化断言保留在 accept 所在 Case；原尾部「候选创建们=1/候选接受们=2」按拆分后各自 Case 收敛为等价计数 |
| JD 建议稿导入大链路（14.3s） | ①授权与轮询：consent 取消零 POST、202、串行轮询、快照合并（未改字段才被替换）；②导入建议发布：GET 首拍即 succeeded（合法已完成导入快照）起步，经同一合并入口 + 城市门禁 + 真实 Catalog 选择 + 确认门后发布（+1） | ①保 consent 前零 POST/轮询两拍/解析零 Job POST/类别建议轻提示/等待期改过描述保留（合并不得覆盖用户已改字段）；②保未改描述由建议填充→用户第二步改写存活到发布 body（canary 建议稿描述按精确匹配缺席）、title/requirements/workplace/office_location/category_id/location_id/双 ref 与轮询收口（GET=1） |
| 核心编辑 岗位 @backend | 新建两栏下钻分类→确认门→发布（目录分页/下钻/死端零请求/同名叶子稳定 ID）；编辑 hydrated confirmed 岗（fixture 预置社招 confirmed 岗，改公开要求撤销确认/稀疏补丁只带变化字段，新增 If-Match "1" 断言）（+1） | body/ID/If-Match/确认门双向撤销逐条保留 |
| 核心编辑 岗位 @mock | 新建分类→确认门→发布进本地列表；编辑 legacy 岗 P-01（私有筛选不撤确认/改公开要求撤销/重新确认后保存 + 重进回读；编辑屏 iPhone 视口块：无横向溢出/输入可聚焦/保存可见）（+1） | Mock 零 API 断言两条 Case 各自保留 |

Fix round 1（spec review 后）：恢复 JD 拆分初版丢失的三条断言（①类别建议轻提示、
①解析零 Job POST、①等待期改过描述保留；②发布 body 的用户改写描述存活 + canary
缺席），恢复 岗位 @mock 编辑 Case 的编辑屏 iPhone 视口块（原 :6262-6267）——
均为旧长 Case 既有断言的回归复位，无新增放宽。

未拆分的裁定：候选 onboarding 完整保存是「社招产品路径的必要完整接线冒烟」（教育恢复/
头像 unknown/首次意向唯一性已作为独立异常 Case 存在于 `J-PILOT-02接线.spec.ts`，学生/
招聘冒烟在 `onboarding.spec.ts`）；P2 附件两条 Case 本就满足「上传→替换→归属→删除 +
解析失败重新授权独立」；J-PILOT-01 三场景与 P3/P4/P6 竞态 Case 按 C4「保留完整竞态/
不拆成无关联快照」原样保留；教育/简历行业的超长 Case 其重入回读段与创建段同一编辑目标
（重入回读是 C4 明令保留的不变量），拆开需伪造新 fixture 状态，收益不抵。

### Task 3 修掉的已知失败（全部只改测试定义）

- 5× `GET /api/v1/organizations/org-fixture-p4` 未声明（P4 详情直取 / 不感兴趣：PUT /
  P8 职位举报详情直取 / J-PILOT-01 场景一·二）：按「P8 举报屏蔽暂不可用」既有写法补
  `覆盖` 声明（按坐标显式空应答 → strict decode 拒绝 → 企业块错误/占位态）。
- `P6 accept 409 not_actionable`：在当前 HEAD 复跑为绿（单选 3×、套件多次），Task 2
  基线的红与本类时序相关（见下条），未做投机性修改。
- ~13 例「hash 直达被在飞水合导航吞掉」时序 flaky（旧 spec 在本机同样随机翻红，
  P3 城市 Case 旧稿单选 3/4 红）：新增共享 helper `hash直达` 加固，对 suites 内 137 处
  post-landing hash 导航统一覆盖；预期重定向的航段（P8 注销后重进 / P8 401 首航 /
  Mock 实名直达）保留普通 goto。全量三项目复验转绿（见下）。review r1（C4）起
  `hash直达` 改为「可观察预等待（应用壳挂载且已离开登录路由）→ 单次 goto → 有界
  段形断言」，不再重试直达/固定 sleep 掩盖竞态；水合期在飞 replace 吞导航的产品缺陷
  仍在此记录（不改产品）。另：核心编辑 城市 @backend 的「取消不写草稿」段旧稿存在
  取消清理与在途草稿写的竞态（旧稿即红，曾在取消前等 400ms 收尾）；review r1 核实
  当前 Backend 选中只落本页 React state（无网络草稿写），取消前以「2/9 计数可见 +
  保存键可见」为收尾可观察条件，固定 sleep 已删，疑似产品侧竞态仍在此记录（不改产品）。
  （2026-09-17 baseline-stg-matching Task 2：两处「疑似产品侧竞态」均已用受控时序
  核实 —— 导航主序排除 + 残留 commit-effect 间隙保留记录、城市取消完全排除，判定与
  证据见「已知事项」对应两条。）

### Task 3 验证（workers=4 / retries=0 固定口径）

- brief 命令一（隐私与实名 + Agent规则 + 招聘建档与JD + 候选建档，fixture）：26 passed；
- brief 命令二（连续委托 + 简历与附件，fixture）：11 passed；
- 其余受影响 Suite：发现推荐 14 / 账号与支持 15 / 岗位编辑 4（mock+fixture）/
  登录与数据源+招聘组织+MatchCase+真人消息+求职意向 48 / 展示与交互 19（fixture）；
- 全 suites 三项目：fixture 135 passed（118.9s）、mock 33 passed（30.5s）、
  annotation 2 passed（4.0s）。

### Task 3 证据件（git-ignored；复跑后需重新落盘）

- `test-results/test-layering/task3-迁移前-list.json`（286 基线）与
  `task3-迁移后-未拆-list.json`（等价对账 162=162 用）；
- `test-results/test-layering/拆分前-JD链路.json`（C4 补项：JD 链拆前 14.3s 绿，
  workers=4/retries=0；P3/P6/候选 onboarding 复用 Task 2 `拆分前-定向链路-r3.json`）；
  ——命名口径统一为「拆分前 = 拆分前代码」，Task 2 的 `拆分前-定向链路.json` 实为
  list 文本输出，以 `-r3.json` 为权威计时样本；
- `test-results/test-layering/task3-验证1/2.json`、`task3-全fixture.json`、
  `task3-全mock.json`、`task3-标注.json`：上述验证的 JSON 回执。

## Task 4 对账（第一层 Vitest 四大文件按冻结归属拆 Suite，2026-09-16）

四个第一层大文件按责任拆为 16 个可独立选择的 Suite + 每文件一个 `测试辅助` 模块；
`城市查询钩子` 与 `企业实名认证` 的计时证实慢等待改受控时钟。叶子标题/断言原样迁移。

### 迁移地图（旧 describe → 新文件）

- `src/状态/应用状态.test.ts`（3949 行，159 例）→
  `归约`（reducer 1 个 describe）、`会话`（后端会话/切身份与退出登录/目录水合与原型缓存
  隔离/review-r1/r2/r3，6 个）、`资料与建档`（候选写操作/招聘方岗位写操作（消歧）/当前
  意向编号/候选当前意向的会话恢复/候选引导草稿持久化，5 个）、`运行域`（接触记录会话
  边界（消歧）/P6 会话水合与清理（消歧）/P4 发现初始状态/P2 附件库快照/P5 MatchCase
  运行时状态/委托待核对运行时接线（消歧）/P8 控制面运行时状态/P4 开案后的 P5 工作区
  失效，8 个）+ `应用状态.测试辅助.ts`（创建后端桩/通过测试手机登录/假 WebSocket/
  Map 存储/连续代谈 DTO 簇等）。`vi.mock('./后端/MatchCase操作')` 透传探针只保留在
  断言它的 `运行域`。
- `src/屏幕/发布岗位.test.tsx`（3736 行，170 例）→ `提交`（Backend 提交/Mock 发岗/
  确认门覆盖两模式/取岗位提交错误文案/无效编辑坐标与 A→B 生命周期（消歧）/职位要求 Tab
  删「硬性条件」展示（消歧），6 个）、`目录`（Backend 选择器（消歧：整个 describe 不再
  拆叶子）/两模式共用职业分类正文/职位类别全屏子视图/职业分类层分页与代际，4 个）、
  `JD导入`（JD 导入生命周期/JD 建议合并，2 个）、`薪资地点`（全远程地址与 Catalog 门禁
  （消歧）/全页城市选择/月薪选择行/日薪时薪双轮，4 个）+ `发布岗位.测试辅助.tsx`
  （mock 桩函数/组织域桩状态构造/抽屉与薪资交互/JD 导入入口辅助）。Mock 发岗
  （公司声明前置校验不生效）按主要断言主体（提交被拦与派发内容）就近归 `提交`。
- `src/屏幕/工作经历.test.tsx`（2607 行，92 例）→ `资料与预填`（保存 single-flight/
  简历编辑来源/候选 onboarding 预填/空身份经历保存/Task 4 资料接线，5 个）、`教育目录`
  （教育学校/专业全屏子视图，1 个）、`行业与企业`（行业弹层 Backend/行业无自由文本/
  行业必填引用/行业共用正文/行业全屏子视图/行业展开失败可重试/经历真实企业 ID，7 个）、
  `作品集与标签`（证书与语言 Backend/日常作品集写入/证书行内输入/技能证书共用标签录入/
  日常作品集输入边界，5 个）+ `工作经历.测试辅助.tsx`。onboarding 预填簇（全可预填/
  readyWork/映射变体/空列表页/抽屉选公司）仅 `资料与预填` 使用，留在该 suite 文件内；
  `deferred` 仅行业弹层 Backend 用例使用，留在 `行业与企业`。
- `src/屏幕/P5/MatchCase详情.test.tsx`（3057 行，90 例）→ `展示与隐私`（直达刷新与
  隐私/资料 Tab 与完整缺失区/招聘端在线简历 Tab/S1 步骤文案三态/owner-safe
  agent_attention/S0 screening records 呈现，6 个）、`阶段动作`（Case 叮嘱输入/S0S1
  动作/S2S3 动作/控制收口（消歧：整个 describe），4 个）、`附件与移交`（P7 移交两步
  接线/授权原始 PDF/completed 移交只读，3 个）、`连续委托`（J-PILOT-01 Task 5 候选
  连续承接（pre-Case 及未知核对），1 个）+ `MatchCase详情.测试辅助.tsx`（mock 桩 +
  状态/阶段区组/各阶段详情 DTO/渲染辅助）。S1 步骤文案三态按主要断言主体（步骤文案
  呈现）归 `展示与隐私`；DTO 夹具簇高度互相引用（候选详情DTO 为核心），作为一整族
  保留在 `测试辅助`。

### helper 形态与 vi.mock 工厂（不改全局环境）

每个 `测试辅助` 模块只被同目录 suite import；vitest 按测试文件隔离模块图，桩状态不跨
文件共享（不导出任何进程级可变状态）。两个结构约束：

- **helper 不静态 import 被测组件**（`工作经历`/`MatchCase详情` 的渲染辅助需要组件，
  否则会与 suite 的 `vi.mock` 工厂成环死锁）：suite 加载后调用 `登记工作经历(工作经历)` /
  `登记详情组件(MatchCase详情)` 注入，helper 仅 `import type`。
- suite 保留原文件的同步 `vi.mock` 工厂形态，`测试辅助` import 排在最前（工厂在组件
  import 时才执行，绑定已初始化）。`MatchCase详情` 控制收口两条 Case 原先直接
  `mock应用状态 = {...}` 重绑（import 绑定只读），改走 helper 的 `设应用状态(...)`，
  对象内容不变；其余文件均无此形态。

### 受控时钟（计时证实的慢等待；不变量保持）

基线（maxWorkers=4 / retry=0，`基线-六文件.json`）证实两类真实等待：

- `城市查询钩子.test.ts`：9 处 260ms 实睡等 250ms 搜索防抖（stale guard/全球搜索/换词
  旧页迟到/catalogVersion 重同步/错误与重试）。改 4 个 describe 局部 fake timers
  （`beforeEach(useFakeTimers)` + `afterEach(useRealTimers)` + `vi.advanceTimersByTimeAsync`），
  并补「防抖未到不发请求」断言（原不变量：debounce 前未请求、到阈值请求、改词迟到丢弃）。
  用例计时 2421ms → 54ms（45 例全绿）。
- `企业实名认证.test.tsx`：抽屉候选 250ms 防抖 7 处 300ms 实睡 + Mock 分支 1.2 秒认证
  计时器（原 findByText 实等 3 秒窗口）。防抖窗口在 `fireEvent.change` 前局部启用 fake
  timers、推进后立即恢复真实时钟（describe 内其余 findBy 不受影响）；Mock 用例的 1.2 秒
  计时器同样窗口化推进，保留「计时器未到不提前落全局」断言。用例计时 4096ms → 752ms
  （18 例全绿）。不改造之处：`userEvent` 在 fake 时钟下会挂死（本仓 userEvent v14 +
  vitest 4 实测，见探针记录），Mock 用例抽屉候选的防抖等待保留真实时钟 findByRole。
- 四个拆分大文件不含计时器等待（`grep` 证实零实睡/零 userEvent delay），慢在渲染体量，
  受控时钟不适用、未改。

### 拆分收益 / 无收益（同一口径：maxWorkers=4 / retry=0）

- **风险集合对账**：新旧并存同跑（`task4-命令一-新旧并存.json`，1022 例全绿）中旧
  4 文件 511 例与新 16 套件 511 例的 title 集合逐项相等，且与基线四文件集合相等；删除
  旧文件后 brief 命令一 16 文件 511 例全绿。每个新 Suite 单选运行全绿（16/16）；单选
  Case（`-t` 过滤）验证可运行。
- **计时**：拆分目标是可独立选择，非提速——四个文件拆分前后用例计时合计持平
  （应用状态 8602→8999ms、发布岗位 31649→32275ms、工作经历 9786→10203ms、
  MatchCase 2014→2419ms，±5% 内；含 16 文件各自的模块装载/桩构建重复成本）。
  实测提速来自受控时钟：城市 2421→54ms、实名 4096→752ms。
- **保留长 Case 的理由**：发布岗位 Backend 选择器 describe 含混合提交/城市断言，按消歧
  规则整块归 `目录` 不拆叶子（单 Case 大而职责完整）；应用状态 候选引导草稿持久化 与
  发布岗位 JD 导入生命周期等长 Case 的段落互为前置（同 fixture 状态推进），拆开需伪造
  新 fixture，违反「不删断言/不伪造」约束，原样保留。

### Task 4 证据件（git-ignored；复跑后需重新落盘）

- `基线-六文件.json`：四旧文件 + 城市 + 实名的迁移前基线（556 例全绿，含各 Case 计时）；
- `迁移后-十六套件.json`：16 新套件组合运行（511 例全绿）；
- `task4-命令一-新旧并存.json`：新旧并存对账（1022 例全绿，title 集合相等）；
- `task4-命令二-城市实名.json`：城市/实名受控时钟后（45 例全绿）。

## Task 5 对账（原生 Case 清单 + 视觉边界接入，2026-09-16）

### 清单（C5）

- `docs/testing/cases.md` 自动区由 `脚本/测试清单.mjs` 生成（三次原生只收集调用包装，
  `npm run test:list [--write|--check]`）；脚本行为由 `脚本/测试清单.test.mjs` 冻结
  （解析/归一/重复身份/未知文件/空集合/坏 JSON/Markdown 转义/稳定排序/失败不覆盖，
  17 例，全部用小内联样例与临时目录）。
- 当前清单：第一层 5478 例 / 244 文件；第二层 294 功能 + 18 视觉。两次生成字节相同，
  `--check` 通过；过期/收集失败/未知文件/重复身份在临时目录样例中验证为非零且不覆盖。

### 清单验证暴露的既有同名 Case（只改标题形式，断言不变）

vitest 4 对象 `it.each` 不做 `$var` 标题插值、部分表驱动用例参数不在标题里，产生 14 组
同名 Case（清单身份重复）。逐组给标题补区分标签（数组 each + `%s`）：

| 文件 | 组（同名列数） |
| --- | --- |
| `src/屏幕/招聘名片.test.tsx` / `src/屏幕/发布岗位.提交.test.tsx` / `src/屏幕/看市场.test.tsx` / `src/屏幕/职位详情.test.tsx`（×2 表） | 各 1 表（2–4 行） |
| `src/数据/招聘数据源/MatchCase.test.ts`（%j 双 null）、`发现推荐.test.ts`（9）、`候选实名.test.ts`（33）、`P8控制面.test.ts`（10）、`Agent规则.test.ts`（4） | 1 表 |
| `src/数据/MatchCase展示映射.test.ts`（3）、`src/数据/发现推荐映射.test.ts`（2）、`src/数据/招聘数据源/接触记录.test.ts`（18） | 1 表 |
| `src/配置/运行配置.test.ts`（2+2）、`src/流程/附件简历交互.test.ts`（3）、`src/状态/后端/MatchCase统计.test.ts`（4） | 各 1 表 |

### 视觉边界与采集验证

- `e2e/视觉回归/采集.spec.ts`：接 C3 离线边界（空项目名在该文件取 mock，其他项目名显式失败）；
  `UI_CAPTURE_DIR` 检查与 mkdir 移到执行期。`--list` 无副作用收集通过（不建目录）。
- 18 场景复跑：18/18 captured、每场景 JSON 的 apiRequests 为空、`核对()` 全过
  （`test-results/test-layering/visual/`）；candidate-salary 一处关键元素定位按
  carry-forward 更新为薪资选择行（产品已统一为 bottom-drawer 抽屉，见 场景.ts 注释）。
- P1/展接线显式目录协议不变：`P1_CAPTURE_DIR`/`WIRING_CAPTURE_DIR`（mock 52 例全绿，
  p1 28 + wiring 24 张场景 JSON）与 `P1_BACKEND_CAPTURE_DIR`（fixture 分支）产物在
  `test-results/test-layering/{p1,wiring,p1-backend}`；无显式目录仍走 testInfo.outputPath。

## Task 6 对账（L3 文档入口收敛、local 归档与一次性脚本退役，2026-09-16）

### 活动入口收敛（只走 STG）

- [真实后端行为验收](../dogfood/真实后端行为验收.md)只保留两个 STG 范围：
  `STG 基础试点`（两轮 `ephemeral-baseline`，第二轮含旧凭据反证）与
  `STG Onboarding` Suite（`stg-onboarding-candidate/recruiter` × `manual/parsed`
  四个独立选择项）。STG 操作、凭据、占用/清理/隔离责任逐字保留；仅章节编号调整
  （旧 4.3→4、7→6、9→7、10→8、11→9、12→10），跨文件引用已同步（stg-onboarding、
  报告模板）。
- [真实后端报告模板](../dogfood/真实后端报告模板.md)只呈现 STG 范围：两轮生命周期、
  四选择项表、隔离/收尾结论均保留；local 报告段（B/H 节点表、local fixture 生命
  周期表、七个视觉观察位置、local 等待预算行）移入
  [archive/local-report-template.md](../dogfood/archive/local-report-template.md)。
  STG 字段未因删除 local 表格丢失。
- 旧 local 行为内容（local 栈启动、fixture 数据与 receipt v2 生命周期、九类场景卡、
  七个视觉观察位置、local 完整通过定义）移入
  [archive/local-behavior.md](../dogfood/archive/local-behavior.md)；章节编号沿用
  原指南，历史引用不断。
- [backend-local-onboarding.md](../dogfood/backend-local-onboarding.md) 首行标
  「历史归档、非活动执行入口」，正文与历史运行事实不改写；
  [docs/AgentBrowser真实后端验收.md](../AgentBrowser真实后端验收.md)、`README.md`、
  `CLAUDE.md` 的指向已更新为 STG 入口 + 归档提示。

### 15 个旧 ID 迁移表

「现有覆盖」只列精确文件/标题方向；fixture/单元 PASS 不冒称真实 STG 证据。
「未承接」= 该真实验证当前没有活动场景或受控 STG 场景，**归档不等于验收完成**。
「后续归属」只指业务 Suite 方向，本轮不创建新 Case。

| 旧 ID | 原风险 | 现有覆盖 | 未承接（真实验证缺口） | 后续归属 |
| --- | --- | --- | --- | --- |
| B01 候选基准加载 | 存量候选简历/意向/披露三屏真实加载与刷新持久化；Mock 或对方私有资料混入 | `e2e/suites/简历与附件.spec.ts`、`求职意向.spec.ts`、`隐私与实名.spec.ts`（契约/解码/回读）；单元 `src/数据/` 简历/意向映射；stg-onboarding-candidate/manual 覆盖空账号完成后的刷新持久化与回访 | 存量账号基准字面量（披露档位、意向配额行）的真实读取；无真实存量账号场景 | 候选资料/求职意向 Suite 方向 |
| B02 候选 CRUD | 改名/意向增改删/披露改档/附件上传替换删除的写链路与刷新回读 | 「核心编辑」系列（简历与附件/求职意向 的 @mock·@backend）、`简历与附件.spec.ts` P2 附件；STG 基础试点第一轮覆盖简历字段修改+意向新建/编辑/删除 | 披露改档还原、附件上传/替换/删除在真实后端的全链路（candidate/parsed 只覆盖 onboarding 内上传+解析） | P2 附件/候选资料 Suite 方向 |
| B03 招聘基准加载 | 名片/公司介绍/在招归档分组真实加载；不混入候选私有资料 | `e2e/suites/招聘组织.spec.ts`（P1C）；stg-onboarding-recruiter/manual 覆盖名片+首岗回访 | 存量招聘账号公司介绍/归档分组真实读取 | 招聘组织 Suite 方向 |
| B04 招聘 CRUD | 名片/公司介绍改还原；岗位发布→编辑→停止→重开→删除全链路 | `e2e/suites/岗位编辑.spec.ts`、`招聘组织.spec.ts`（multipart/If-Match）；STG 基础试点第一轮覆盖岗位新建→编辑→归档→重开→删除 | 名片职务/公司介绍修改还原的真实链路（试点只改职务一次）；删除产品二次确认的真实行为 | 岗位编辑/招聘组织 Suite 方向 |
| B05 双会话隔离 | 双账号各见授权数据、退出单端生效 | 各域 Mock 隔离用例（隐私与实名/发现推荐/MatchCase/真人消息/账号与支持）；STG 基础试点两轮（候选退出招聘仍有效、identity 轮换+旧凭据反证）；stg-onboarding 隔离两轮衔接证据 | local acceptance 栈双账号隔离无活动场景；真实 STG 隔离由试点/Onboarding 两轮证据承担，不另建 | STG 基础试点与 stg-onboarding 既有隔离合同 |
| H01 happy 闭环 | 规则确认→PDF 解析→委托→补充事实→初筛→协调确认→深链复读全链路 | `Agent规则.spec.ts`（P6 提案/确认/版本链）、`简历与附件.spec.ts`（P2）、`MatchCase.spec.ts`（S0–S3/深链）、`连续委托.spec.ts`（委托→S0→S1）；单元 MatchCase详情 组 | 真实 STG 完整闭环（试点明确排除规则/附件/委托；无受控 STG happy 场景）；旧 H01「候选补充事实（回答补问）」与 J-PILOT-01 S0 无用户输入规则冲突，记为需更新的历史预期，不迁入活动流程 | 既有 P5/P6/P2/连续委托 fixture Suite；真实闭环缺口保留本表 |
| H02 委托失败零 Case（p4） | 委托失败被诚实解释、零 Case、无「查看进展」假进展 | `发现推荐.spec.ts`（503 受控重试/失败展示/404 安全不可用页）、`连续委托.spec.ts` 场景二（写响应丢失→原命令核对→失败→归档回读） | 「AI 不可用→解释→零 Case→无假进展→刷新一致」受控真实失败场景的闭环（p4 scene 无 STG 等价） | 发现推荐/连续委托 Suite 方向 |
| H03 初筛 attention（p5） | 招聘 Agent 需注意双端一致且 owner-safe；刷新不假成功 | `MatchCase.spec.ts`（fail-closed/权威重读）；单元 `MatchCase详情.展示与隐私`（owner-safe agent_attention）、`MatchCase列表`（attention/零 retry） | 真实双端一致性与安全原因展示的 STG 闭环 | MatchCase Suite 方向 |
| H04 规则解释失败与草稿恢复（p6） | 解释失败诚实呈现、无成功入口、草稿恢复、计数不变 | `Agent规则.spec.ts`（草稿预填/确认前旧规则在场/accept 幂等/规则加载失败重试） | 「解释失败→关闭失败卡→原草稿恢复→刷新零新增规则」完整恢复链（真实服务失败闭环无受控场景，不随机制造故障） | Agent规则 Suite 方向 |
| CAND-ONB-001 候选 onboarding | 全新账号手填/PDF 四分支、完成门槛、恢复与隔离 | stg-onboarding-candidate manual/parsed（社招合成基线）；`e2e/suites/候选建档.spec.ts` + `e2e/J-PILOT-02接线.spec.ts`（手填接线、教育恢复/首次意向唯一/头像 unknown）；单元 `工作经历.资料与预填`（预填） | 学生分支（stg-onboarding 只有社招基线）、屏蔽公司/目录中间层 PM_BLOCKED 观察、Highlights 检查、头像恢复细节 | stg-onboarding Suite（已承接部分）；学生分支如需真实验收另定 |
| EMP-ONB-001 招聘方 onboarding | 名片/公司声明/首岗发布、JD 导入入口、空态与隔离 | stg-onboarding-recruiter manual/parsed；`e2e/suites/招聘建档与JD.spec.ts`（名片+首岗+JD 建议稿导入） | 无 verified affiliation 公司资料空态的真实链路；存量账号多页巡检 | stg-onboarding + 招聘组织 Suite 方向 |
| CAND-AUTH-001 交互登录水合 | 登录后支持域水合不靠临时补读；刷新一致性 | `登录与数据源.spec.ts`（Backend 数据源 fixture 水合）；单元 `src/状态/会话` 套件 | 真实 STG 存量多资源账号重登水合（stg-onboarding 只覆盖首次完成后的回访） | 登录与数据源 Suite 方向 |
| CAND-INT-001 意向增改查 | 意向创建/编辑/revision/回读闭环 | `求职意向.spec.ts`（If-Match 与权威回读）；STG 基础试点两轮覆盖意向新建/编辑/删除+刷新回读 | 5 条 active 上限腾挪等存量账号边界 | 求职意向 Suite 方向 |
| CAND-ME-001 候选「我」与设置巡检 | 跨页接线与权威空态（访客/历史代谈/屏蔽名单等） | `账号与支持.spec.ts`（P8）、`隐私与实名.spec.ts`（P3）、`Agent规则.spec.ts`；单元各屏用例 | 谁接触过我/历史代谈/帮助反馈工单等页面的真实空态巡检（无受控 STG 场景） | 账号与支持/隐私与实名 Suite 方向 |
| EMP-ME-001 招聘方「我」与设置巡检 | 招聘端跨页接线与权威空态 | `招聘组织.spec.ts`、`账号与支持.spec.ts`；单元企业屏用例 | 空账号多页巡检、认证摘要三态的真实核对 | 招聘组织/账号与支持 Suite 方向 |

未迁移断言（上表「未承接」列）按缺口跟踪；文档归档与本地 fixture PASS 不冒称真实验收完成。

### 一次性脚本退役（Spec §8.2）

| 删除文件 | 覆盖的历史风险 | 现有承接 | 未承接 |
| --- | --- | --- | --- |
| `脚本/全流程爬测.mjs` | 全站路由可达/白屏/console 报错穷举；「每个可点元素点一遍+返回一步验证」捕捉状态类 bug（历史发现：返回键需历史垫层、缺字段白屏、选中态需指纹判变化） | 第二层按 Suite 定向保留精确路径/标题：`e2e/suites/展示与交互.spec.ts`（抽屉稳定性/换壳无闪屏/卡片几何）、各域 spec 的渲染与恢复断言、`e2e/离线边界.spec.ts`；单元 `src/屏幕/` 用例覆盖具体渲染分支 | 全站机械穷举的广度（每按钮×返回验证）无等价物；按 Spec 不重建机械爬虫，需要广度取证时用 agent-browser dogfood 按需执行 |
| `脚本/问题截图.mjs` | 把一批已确认的未修问题（计数、红点、超宽、零入口类）逐条截图给产品负责人 | 一次性取证配图工具，不构成回归断言；相关页面的当前行为由第二层展示与交互及对应单元用例按现产品断言维护 | 历史问题编号与新断言之间不建立逐一映射（不把截图工具当回归）；新一轮问题取证按 dogfood 指南用 agent-browser 产出，不恢复脚本 |

两脚本未出现在 package.json/其他脚本的调用链（仅 spec/plan 历史文本引用，按合同保留）。
不清理用户 evidence 目录；历史运行报告的 PASS/FAIL 不改写。

### L3 未承接清单

活动 L3 现有 STG 三范围（见 [`cases.md`](cases.md) 手写区；`stg-matching` 于
2026-09-17 注册，见文末「baseline-stg-matching 对账」）；上表「未承接」列即
L3 未承接项。本轮 L3 selection 为 `none`：无产品/后端/真实 STG 操作语义变化，
不执行真实登录/上传，不记 L3 PASS。

## 已知事项

- `J-PILOT-02接线.spec.ts` 四条手填旅程的历史失败（曾记录于基线 HEAD 6b8a71fa，
  旧入口）已于 2026-09-17 定位修复，产品零修改。实际根因：该 spec 自带的
  job-categories fixture 对任何 query 都应答同一个 selectable 根，而现行
  期望职位选择正文（B 契约双栏）把二级节点渲染为右栏 heading、只有三级
  selectable 叶子才是职位按钮 —— 单根 fixture 因此没有可点叶子，
  `进完善资料` 的 count=2 选择助手必然失败（`getByRole('button', …) 收到 1`）。
  修复只改测试定义：fixture 按 `parent_id` 应答真三级（根 → 组 → 统一
  selectable 叶 `job-fixture-001`，口径对齐 `e2e/fixtures/数据源交互.ts` 的
  装三级职位目录桩），选择动作点真实叶按钮，并断言左根是 button、右组标题是
  heading 绝不是 button；另按离线边界「缺应答只修测试定义」补声明旅程修好后
  才触达的 `GET /me/negotiations`（新账号权威空页 `items:[]`/`next_cursor:null`）
  与 `GET /me/avatar/content`（1×1 PNG）。目录选择真实 ID 等风险断言不减；
  五条用例 workers=4 / retries=0 两轮全绿。raw 证据（初始 306 passed/5 failed、
  修复后 310 passed/1 failed 的 JSON 回执与逐命令日志）：
  `test-results/baseline-stg-matching/`（git-ignored，Playwright 复跑会清空
  `test-results/`，落盘件以此为准）。
- 「hash 直达被在飞水合导航吞掉」（曾按 ~13 例 e2e 偶发翻红记录的疑似竞态，见
  下方 Task 3 对账）已于 2026-09-17 用受控时序核实：主序「开始水合（初始化=
  进行中）→ 用户导航深链 → 水合返回（已登录 + 分流落定）」与反向对照序
  「先 resolve 落点落定 → 再导航」均保留用户目的地（`src/应用.test.tsx`
  「应用路由：水合在飞期的用户导航保留（疑点①受控时序）」两条用例：深页挂载、
  主壳零挂载、路径记录从未被改写回落点）。因果链：会话代际栅栏（会话操作.ts
  是当前水合）使过时轮水合整包丢弃、根本写不了 已登录/主体，能落地的只有当前轮；
  登录落点 effect 只在「本次渲染的 pathname 仍是登录」时 replace —— 用户已导航
  则该条件不成立。残留理论窗口：导航若恰好落在「水合 commit 已发生、落点 effect
  尚未执行」的间隙，effect 闭包里的位置仍是登录、replace 会吞掉它；该间隙在
  单测 harness 中被 act 语义原子化、无法确定性复现（写不出能击中原故障的回归），
  按 Spec §9 不加猜测性防护，维持已知事项记录。e2e 侧 `hash直达` 的可观察
  预等待（hash 离开登录路由后才单次 goto）正是把测试导航放在该窗口之外。
- 「核心编辑 城市 取消不写草稿」疑似竞态（同见 Task 3 对账）已于 2026-09-17
  用受控时序排除：「进入选择（草稿带原选中）→ 局部再选城市 → 取消（✕ 关闭 +
  卸载）→ 在飞目录页迟到返回」全程零草稿写（`src/屏幕/选择城市.test.tsx`
  「局部选城市→取消→迟到目录返回：零草稿写」：派发从未发生）；消费侧链路
  「取消会话后保存原草稿 → 请求体城市 ID 不变」由
  `src/状态/领域/候选意向编辑.test.ts`「取消的选城会话不落草稿」钉住（对照臂
  证明若取消会话写了草稿，`alternate_location_ids` 必然变化 —— 断言可检出泄漏，
  非恒真）。旧稿「取消清理与在途草稿写的竞态」判定不成立：Backend 选择只落本页
  React state，目录读迟到经页面级代际守卫丢弃，草稿唯一写入口是 保存 的同步
  `改意向草稿` 派发，意向草稿也不进任何持久层。e2e 回归
  `e2e/suites/求职意向.spec.ts` 6/6 passed（workers=4 / retries=0，含取消与
  保存回读保持真实 ID）。
- `e2e/suites/助手会话.spec.ts` 的「卡片点原生详情并返回 @backend」随 2026-09-16
  30a0d3b2 合入进入仓库即红（该合并收尾口径 306 passed / 5 failed 之一，与上面
  四条同批），在 2026-09-17 基线修复前后复跑均为同一失败：`getByText('结论：fit')`
  在在谈详情页 15s 不可见。属该合并自带、非 J-PILOT-02 四条范围，本 Task 仅归因
  记录不修，待定夺；证据同上目录。
- **抽取前基线（4825e759）即红的 6 例**（Task 2 全量冒烟发现、经基线 worktree
  复跑证实，非 Task 2 回归）：`P4 详情直取` / `不感兴趣：PUT` / `P8 职位举报
  （详情直取）` / `J-PILOT-01 场景一` / `场景二`（离线边界报
  `GET /api/v1/organizations/org-fixture-p4` 未声明 —— 岗位详情按
  hiring_organization_ref 补读公开企业，用例未给组织域 fixture 也未按坐标声明
  覆盖）＋ `P6 accept 409 not_actionable`。修法是按同 spec「P8 举报屏蔽暂不可用」
  的既有写法补 `覆盖` 声明，属独立小修。另有 ~13 例时序 flaky（hash 直达被
  在飞水合导航吞掉类），双方树同样随机翻转。
- 视觉回归目录已接入 C3 边界（Task 5）：`e2e/视觉回归/采集.spec.ts` 以同一个
  `离线边界` helper 做文件级 extend（视觉配置空项目名在该文件取 mock），目录检查与
  mkdir 移到执行期（`--list` 不再要求 `UI_CAPTURE_DIR`）；18 场景采集已按新边界复跑
  （18/18 captured、零未声明业务请求），candidate-salary 场景的关键元素定位随
  bottom-drawer 薪资选择行统一更新（carry-forward，只改测试定位）。
- Task 2 起 BFF fixture 将从 `e2e/数据源模式.spec.ts` 抽取；计时以 Task 1 的离线版本
  为起点，离线修复本身不计入拆分提速。（Task 2 已完成抽取，见上节对账。）
- e2e 目录不在仓库 tsconfig 覆盖内（Playwright 用 esbuild 不做类型检查）。本任务用
  临时 tsc 配置全量核对过：拆分相关文件仅余与基线同源的既有类型噪声（未类型化过的
  用例代码），无缺名/错路径/undefined-return 类装载缺陷。

## 最终验证记录（2026-09-16 收尾）

六个实施 Task、宿主内 final review（一轮修复波）、Codex 异构 review（3 轮：
R1 四条 required 修复于 4b33b08b、R2 一条 required 修复于 e1cacaa6、R3 NO
FINDINGS）后的最终责任运行，全部在候选 HEAD d746327a（含其前的 4b33b08b/e1cacaa6）
与本机固定环境（macOS、Node 24、Playwright 1.62、workers=4、retries=0）执行：

| 责任 | 命令 | 结果 |
|---|---|---|
| 静态检查 | `npm run lint` / `npm run typecheck` / `git diff --check` | 0 警告 / 零错 / 通过 |
| 第一层受影响选集 | `npm test -- src/状态/应用状态. src/屏幕/发布岗位. src/屏幕/工作经历. src/屏幕/P5/MatchCase详情. 脚本/测试清单.test.mjs --maxWorkers=4 --retry=0` | 17 文件 / 530 passed（24.43s） |
| 第二层全部唯一功能选集 | `npm run test:e2e -- --workers=4 --retries=0` | 290 passed / 4 failed（3.6m）——4 例即「已知事项」首条的 J-PILOT-02 期望职位双栏基线红，无任何新回归 |
| 清单对账 | `npm run test:list -- --write` 后 `--check` | 一致（第一层 5480 项 + 第二层 312 项） |
| 城市/实名受控时钟 | Task 4 证据 + 实名 afterEach 修复后 `npm test -- src/屏幕/企业实名认证.test.tsx` | 18/18（城市 45/45 见 Task 4 对账，文件此后未变） |
| 视觉 18 场景与 P1/接线采集 | Task 5 对账（采集 spec 不消费 `hash直达`，边界与协议未失效） | 18/18 captured、零未声明业务请求；复用 |

- 收尾两处新增修复的事实记录：`hash直达` 从「重导航×5＋固定 400ms」改为
  「可观察预等待（根节点有子节点且 hash 离开登录路由）→ 单次 goto → 5s 有界段形
  poll」；城市 Backend 取消路径删除固定 400ms（选中写无网络草稿请求，以既有
  「2/9 与保存可见」断言为收尾可观察条件）。两处产品竞态维持「已知事项」记录，
  测试不再掩盖；全量运行无竞态显形。
- `换壳无闪屏.spec.ts` 删除文件级 `channel: 'chrome'`（继承统一配置，CI 不再
  强制本机 Chrome）。
- `脚本/测试清单.mjs` Vitest 坐标改为 `titlePath.join(' > ')` 转义后放宽
  `' (> )?'`（vitest `-t` 按 getTaskFullName 单空格连接匹配，逐字含 ' > ' 的
  模式收 0 例；含字面 `' > '` 的标题行复制执行恰好选中目标叶）。
- 原始回执与计时在 `test-results/test-layering/`（git-ignored；Playwright 每次运
  行会清空 `test-results/`，先落 `/tmp/tl/` 再复制归档）。
- 正式 L3 selection：`none`——本轮仅整理测试代码/目录/文档，无产品、后端或真实
  STG 操作语义变化；不执行真实登录/上传，不记 L3 PASS。

## baseline-stg-matching 对账（stg-matching Suite 注册与已修本地问题，2026-09-17）

- **新 L3 Suite**：`stg-matching`（真实 STG 双向匹配 S0–S3）注册为第三个活动 STG
  范围：两个独立可单选 Case `stg-matching-recruiter`（招聘者发起）/
  `stg-matching-candidate`（求职者发起），每 Case 一轮全新 run。登记位置：
  [`cases.md`](cases.md) 手写 L3 区（恰好两条，不进 runner 自动区）、
  [`../dogfood/真实后端行为验收.md`](../dogfood/真实后端行为验收.md) 第 11 节入口、
  专门指南 [`../dogfood/stg-matching.md`](../dogfood/stg-matching.md)（材料、生命周期、
  S0–S3 观察点、cleanup 判定与能力缺口）。本 Suite 不增加自动 runner；不改变旧
  B02/Onboarding/试点任何既有结论。
- **当前状态（诚实记录）**：两个 Case 均无 PASS，按验收状态语义分列：
  `stg-matching-recruiter` 业务 `BLOCKED`——2026-09-17 探索 run
  `front-match-recruiter-20260916T235043` 招聘者方向实测到 S1 即被当前 STG 部署的
  Hub enrollment 缺失决定性阻断（S0/S1 agent 任务全部 `hub_rejected`），该 run
  cleanup 停 `CLEANUP_BLOCKED` 且占用保持、隔离 `NOT_RUN`（无后继 run）；
  `stg-matching-candidate` 业务 `NOT_RUN`（本轮未执行；STG 占用未释放使新 run
  无法创建）。解锁
  路径归后端 owner，解锁前不得重跑或写任何通过（指南第 11 节）。
- **已修本地问题（合同内缺陷，TDD 最小修复，Task 4 扩大范围）**：
  `src/数据/招聘数据源/展示资料.ts` 的 `解发布人档案` 把 PublicRecruiterProfile 的
  `avatar_url` 当必填键，而冻结 openapi 合同 required 仅
  `[public_name,title,personal_verification_status]`（avatar_url 可选），BFF Go 侧
  `*string omitempty` 无头像时整键缺席 → Case 详情整页 invalid_response（STG 实测
  复现）。修复：avatar_url 移入可选键、缺席归一 `null`（契约侧「BFF公开发布人档案」
  形状不变），commit 8b34f899；新增失败先行测试 1 条，展示资料.test 40/40，全套
  `npm test` 全绿、tsc 干净。证据：task-4-report §5 与
  `dogfood-output/front-match-recruiter-20260916T235043/`（均 git-ignored）。

## Task 5 对账（onboarding 与简历编辑：浏览器接线、视觉与清单同步，2026-09-17）

本轮是测试交付（Task 1–4 的产品改动落成接线断言、Mock 视觉、清单与活动验收指南），
不是正式 STG 执行、不在本 Task 跑全仓；所有 e2e/视觉运行 `--retries=0`，选择器一律先
`--list` 预览再执行。

### 合同变更 → 断言迁移（文件级，逐项对账）

| 变更（合同） | 迁移的既有断言 | 文件 |
| --- | --- | --- |
| 薪资并入首屏、`/wizard?stage=salary` 只作兼容（合同 C） | 社招/学生两条 Mock 旅程改首屏三态（未确认被拦 / 面议 / 区间）；J-PILOT-02 四条手填旅程、候选建档主链与 DF-002、展示与交互「就读年份」改 `选首屏薪资` | `e2e/onboarding.spec.ts`、`e2e/J-PILOT-02接线.spec.ts`、`e2e/suites/候选建档.spec.ts`、`e2e/suites/展示与交互.spec.ts`、`e2e/fixtures/数据源交互.ts` |
| 个人优势移到简历资料页，保存链收口（合同 C §3.3） | 向导只剩补充偏好一题；优势在 `/experience` 随简历链保存（J-PILOT-02 断言 `PATCH summary` 恰一次） | 同上 + `e2e/suites/候选建档.spec.ts` |
| 日常简历按区/条目编辑 + 保存退一格（合同 A/B） | 「点两次经历 → 完成 → 外层保存」改为「点条目 → 保存」，落点回我的简历；聚合页仅留 onboarding | `e2e/suites/简历与附件.spec.ts`、`e2e/suites/隐私与实名.spec.ts`、`e2e/suites/展示与交互.spec.ts` |
| 招聘职位类别改为三级自动展开（Spec §4.2） | 岗位编辑 @backend 的「下钻/死端零请求/右栏分页/整栏替换」按三级语义重写（一级自动展开、二级 h3 非按钮、组内分页、空组零请求、禁用叶不提交、同名叶子按 ID）；发布岗位的分类桩换成既有 `装三级职位目录桩` | `e2e/suites/岗位编辑.spec.ts`、`e2e/suites/招聘建档与JD.spec.ts`、`e2e/suites/隐私与实名.spec.ts`、`e2e/suites/展示与交互.spec.ts`、`e2e/fixtures/数据源交互.ts` |
| 注册流名片不渲染公司维护行（Spec §4.1） | Mock 招聘剧情 Case 改「注册流无名片维护行 + 日常入口仍可进公司档案」两段 | `e2e/onboarding.spec.ts` |

新增的独立用例（前缀 `Onboarding简历修正`，互不塞进一个长用例）：

| 用例 | 文件 | 覆盖 |
| --- | --- | --- |
| 旧薪资地址替换回首屏：首屏薪资三态与确认闸门 @mock | `e2e/onboarding.spec.ts` | 合同 C 兼容 + 三态 + 闸门 + 替换不插历史 |
| 屏蔽成功但经历 PATCH 失败：留页保留待重试，重试只补经历 PATCH @backend | `e2e/suites/隐私与实名.spec.ts` | §11.2.4/§11.2.5 partial failure 反例（已成功项不重放） |
| 求职状态两来源 @backend / 状态行不再轮转假状态 @mock | `e2e/suites/求职意向.spec.ts` | Spec §6：两来源共用同一编辑、保存回各自来源、取消零写、刷新读权威 |
| 日常编辑历史栈 / 日常取消、失败与深链 / 空身份基本信息收口 @backend | `e2e/suites/简历与附件.spec.ts` | Spec §5：真实 browser history、连续两分区编辑、取消零写、失败留页可重试、深链安全替换并重读权威、空身份同页收口与分区列表子编辑 |

### 选集与执行结果（同一固定口径：workers=4 / retries=0）

功能选集（七个文件是 Task 1–4 的完整旅程/日常消费者）：

```bash
npm run test:e2e -- e2e/onboarding.spec.ts e2e/J-PILOT-02接线.spec.ts e2e/suites/候选建档.spec.ts \
  e2e/suites/招聘建档与JD.spec.ts e2e/suites/简历与附件.spec.ts e2e/suites/求职意向.spec.ts \
  e2e/suites/岗位编辑.spec.ts --list      # 47 tests in 7 files
```

隐私只选经历相关 Case（先行最终登记的两条 + 本轮新增一条）：

```bash
npm run test:e2e -- e2e/suites/隐私与实名.spec.ts --grep '聊天推荐前端修复|Onboarding简历修正' --list   # 3 tests in 1 file
```

视觉：`npm test -- e2e/视觉回归/场景.test.ts`（4 例，场景 ID 26 个、唯一性 + 前缀分组）
与 `UI_CAPTURE_DIR=… npm run ui:capture -- --grep 'candidate-preferences|candidate-salary|candidate-resume|recruiter-card|onboarding-resume-|onboarding-recruiter-category'`（7 场景 captured）。
逐张人工核对结论与原始截图在当次运行目录（`test-results/onboarding-resume-visual/`，Playwright 复跑会清空）。

### 清单（Task 5 收尾）

- `npm run test:list -- --write` → 第一层 6105 项 / 第二层 367 项（功能 341 + 视觉 26）；`--check` 一致。
- 生成时暴露一处**既有**重复 Case 身份（`src/流程/候选日常编辑.test.tsx` 的
  `it.each([undefined, null, …])` 用 `%j` 打印两个值同名，Task 1 引入）：按既有做法
  （README 上一节「清单验证暴露的既有同名 Case」）给参数表加区分标签，只改标题、
  断言不变；不手工改自动区。

### 已知缺口

- 无。（首轮登记的 `候选 onboarding 完整保存并创建首次意向 @backend` 技能回退缺陷，
  已由 Task 3 实施者在 `e8206931` 修复 —— `候选操作.ts` 的 `设权威简历快照` 让权威简历
  快照落地时同步推进 `后端状态引用.current`；本 Task 在 `e8206931` 上复跑选择集全绿，
  取证与复跑回执见 Task 5 报告 §2.2/§4.1。）

### fix round 1（Task 5 review 后）

- 补迁三处「合同坐标仍停在旧流程」的消费者：`招聘组织.spec.ts` 的 P1C 全链路（补装三级
  职位目录桩）、`抽屉稳定性.spec.ts` 的引导薪资抽屉 Case（helper 改首屏薪资行，采样按
  aria-label 兜底匹配）、`换壳无闪屏.spec.ts` 求职端换壳旅程（首屏薪资 + 补充偏好单题）。
- 按 brief「深链/硬刷用独立 Case」拆出 `Onboarding简历修正 日常深链与硬刷 @backend`
  （原与取消/失败同一 Case）。
- 清单：本次 `test:list -- --write` 后 `--check` 归零（第一层 6105 项，第二层 367 项 =
  功能 341 + 视觉 26）；`e8206931` 新增的「创建候选操作 · 聚合链收尾的 next 基底（fix-r2）」
  一行已入清单。

## Task 10 对账（六维解释浏览器接线、视觉场景与清单，2026-09-18）

### 基线与修复（fixture 层）

- Task 1–9 交付后，`e2e/fixtures/bff` 三个域 fixture 尚未携带 `match_explanation`
  展开键：C2 展开读取在 strict decode 上整包拒绝，五个数据源 Suite 的 @backend
  选集基线为 **73 failed / 102 passed**（`--grep 六维展示对齐` 为 0 tests）。
- 修复：`发现推荐.ts` 新增 `P4匹配解释` 构造器（总分 0–100 按 C1 闭表确定性分解，
  本轮以 tsx 对全部总分复核 分项和=总分=match_score、matched=满分、U/N=0、
  技能分=floor(35·命中/总数)；tsx 脚本一次性验证后未入库）；候选/招聘卡工厂按
  最终 match_score 同源生成展开键，覆盖键显式在场（含 null）原样下发。
  `MatchCase.ts` 的招聘 open/history 行、双端详情、聚合卡与嵌套 case_detail 同批接线。
- 顺带修一处 Task 4 层次缺陷（浏览器实测）：`求职在谈卡.module.css` 的 `.右列`
  传回调态挂卡根且先于白卡渲染，同为 positioned 的 `.卡` 按 DOM 序盖住环，
  点环被白卡吃掉变成打开详情 —— `z-index: 1` 提回上层（Spec §3.1 点击不触发卡动作）。

### 选集与执行结果（workers=2 / retries=0）

```bash
npm run test:e2e -- e2e/suites/发现推荐.spec.ts e2e/suites/MatchCase.spec.ts \
  e2e/suites/连续委托.spec.ts e2e/suites/真人消息.spec.ts e2e/suites/展示与交互.spec.ts \
  --grep 六维展示对齐 --list    # 9 tests in 4 files（0 tests 不算过的对照）
# 实跑 9 passed（复跑两次稳定；其中一次并行负载下 1 例纵序翻红，已改为层内定位）
```

Task 9 递延的基线红遮蔽断言随 8B fixture 落地复验：五个 Suite 全量（95 tests）在
fixture 修复前 20 failed，断言迁移（URL 四坐标锚、include 矩阵串、卡传回调态 DOM
顺序、退役文案「未提供判定/匹配分析缺失/推荐依据」、旧合并轮次行）后全绿；
`e2e/展示字段接线.spec.ts` 全量 34 passed（候选侧 4 例基线红根因有二：URL `$` 锚
未容纳四坐标 query、嵌套候选 case_detail 缺解释键，均已修）；`e2e/P1展示统一.spec.ts`
中义务点名的 `p1-job-top`（含 `匹配度分析标题` 关键元素，Mock 320/390）通过。
P1 Backend 消息层 12 例（双端消息行/无上下文/长文/错误带缓存/长标题 × 320/390）
维持基线红：根因是 P1 fixture 未声明会话页 Case 聚合详情坐标
（`GET /me/negotiations/{id}?include=match_explanation` 落离线边界），与 Task 8/9
基线红集合逐例相同（本轮零新增、零修复 —— 修法需在 P1 fixture 内建完整聚合详情
wire，超出本 Task 迁移范围，留待 P1 fixture 责任方）。

### 视觉（Task 4/10 义务）

- 清单单测：`npm test -- e2e/视觉回归/场景.test.ts`（5 例，场景 38 个、唯一性 +
  Task 10 前缀分组：四态/技能部分 0/缺失/弹层/招聘纸身独立分析 + 传回调态卡入口）。
- 采集：`UI_CAPTURE_DIR=test-results/match-explanation-visual npm run ui:capture --
  --grep 'match-explanation-' --workers=2 --retries=0`（12 场景 captured；复跑会清理
  该目录，本轮证据以逐张看图结论为准）。
- 逐张人工看图结论（320/360 窄屏与 390 普通宽度）：四态行图标/计数/状态文字齐备、
  320 下技能行长说明行内换行不溢出；技能 1/100 → 0/35 仍部分匹配；缺失场景「—」+
  「暂无该次匹配的详细分析」无假六行；弹层藏环文本总分与岗位上下文行在位；
  招聘纸身层分析在纸身之后独立白区（须滚动入画后采集）；三档宽度的市场/在谈卡
  薪资串与 44px 入口环同排不互挤、公司名按省略号截断；招聘在谈卡匿名头行 + 环入口
  正常。第一版招聘纸身场景未滚动导致分析截不入图，已改为就绪时 scrollIntoView。

### 清单（Task 10 收尾）

`npm run test:list -- --write` 后 `--check` 归零（第一层 6331 项，第二层 389 项 =
功能 351 + 视觉 38）；`docs/testing/cases.md` 仅自动区变更。

### 已知边界

- 视觉采集固定 mock 源：招聘推荐卡的传回调态入口只在 Backend 数据源存在（Mock
  人才库卡按 Task 7 as-built 无入口），该卡的 44px 入口几何与截图证据由
  展示与交互「卡片统一 招聘推荐卡两模式」用例承担（44×44 实测断言 + 截图）。
- 真实后端行为（OpenAPI 实际下发 match_explanation/step/exchange_ref）未由
  fixture 证明；真实环境未验收，由用户负责。
