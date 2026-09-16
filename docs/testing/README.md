# 前端测试分层（迁移 / 测量工作区）

这是 2026-09-16 前端测试分层重构的迁移与测量工作区；Task 5 会补齐测量协议并完善本文件。
分层目标与验收口径见 `.superpowers/sdd/2026-09-16-frontend-test-layering/` 下的 spec 与各 task 报告。

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
- 视觉回归目录 `e2e/视觉回归/` 尚未接入统一 `test` 导入与边界（Task 5 同步处理）。
- Task 2 起 BFF fixture 将从 `e2e/数据源模式.spec.ts` 抽取；计时以 Task 1 的离线版本
  为起点，离线修复本身不计入拆分提速。（Task 2 已完成抽取，见上节对账。）
- e2e 目录不在仓库 tsconfig 覆盖内（Playwright 用 esbuild 不做类型检查）。本任务用
  临时 tsc 配置全量核对过：拆分相关文件仅余与基线同源的既有类型噪声（未类型化过的
  用例代码），无缺名/错路径/undefined-return 类装载缺陷。