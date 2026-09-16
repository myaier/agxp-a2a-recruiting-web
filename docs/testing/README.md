# 前端测试分层（长期入口）

这是前端测试的总入口：三层责任、Suite 目录、按影响选择测试的精确命令、Case 扩展步骤、
各 Task 的迁移对账与计时证据。完整逐叶 Case 清单在 [`cases.md`](cases.md)（自动生成 +
手写 L3 索引）。分层目标与验收口径见
`.superpowers/sdd/2026-09-16-frontend-test-layering/` 下的 spec 与各 task 报告。

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
  P3 城市 Case 旧稿单选 3/4 红）：新增共享 helper `hash直达`（重试直达直到路由段形
  落定；P5 深链的 canonical ID 改写按段形判定不误伤），对 suites 内 137 处 post-landing
  hash 导航统一加固；预期重定向的航段（P8 注销后重进 / P8 401 首航 / Mock 实名直达）
  保留普通 goto。全量三项目复验转绿（见下）。另：核心编辑 城市 @backend 的「取消不写
  草稿」段存在取消清理与在途草稿写的竞态（旧稿即红），测试侧在取消前等 400ms 收尾，
  疑似产品侧竞态已在此记录（不改产品）。

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

## 已知事项

- `J-PILOT-02接线.spec.ts` 四条手填旅程在基线 HEAD 6b8a71fa（旧入口）即失败
  （期望职位 Backend 双栏 fixture 单 selectable 根与现行产品双栏行为不符），Task 1
  仅保留证据不修产品、不删断言；详见 Task 1 报告「产品缺陷 / 既有失败证据」。
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