# 公司档案与教育候选展示统一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Claude Code 使用 superpowers:subagent-driven-development；Codex 使用 superpowers:executing-plans。按以下四个串行 Task 执行，步骤以 checkbox 跟踪。

**Goal:** 公司档案编辑及引导学校／专业两模式共用展示，Mock 为设计源头，Backend 必要增量复用现有设计，保留各自业务规则。

**Architecture:** 在现有公司页面内抽取局部纯展示函数；不拆连接层、不新增状态。学校／专业接现成教育目录候选列表。共有 JSX 只保留一份，额外名称字段、权限、预览通过明确输入补充。

**Tech Stack:** React 19、TypeScript、CSS Modules、Vitest/Testing Library、Playwright；沿用 lockfile，不加依赖。

**Spec:** `docs/superpowers/specs/2026-09-17-company-profile-education-ui-unification-design.md`。用户批准正文 revision `7ec411fb3b0438d6c96e915108e7c97710f5003b`、blob `fcf2bb90a461f3c4f6917e5952a843b128826efb`；后续仅批准记录更新不改变正文合同。

## Global Constraints

- 仓库 `agxp-a2a-recruiting-web`，target `origin/main`；规划产品基线 `bb6ff6e03e6f542a3fe5a0604e6c9ced326a7386`。批准 Git 对象必须存在，用 `git show <revision>:<path>`、`git rev-parse <revision>:<path>` 核对；不可拿工作树最新 Spec 自证批准。
- 完整读 `AGENTS.md`、`CLAUDE.md`、批准 Spec、`docs/testing/README.md`。复用用户选定工作区 `.`，不新建第二工作区，不 stash/reset/clean、不部署。未提交的用户内容保持原样。
- 实际调用宿主 execution skill；外部 skill 按逻辑名发现。完整读 development-workflow 根相对 `assets/execution-contract.md`；实施开工用其 `scripts/task_intents.py --help`、`start/list` 登记与核对，扩大路径前 update，不代写他人预告。
- Mock 是设计源头；Backend 共有部分采用其结构、样式和交互。禁止以组件统一为由让 Mock 增加三名称、目录必选、人数上限或即时相册保存。Backend 的引用校验、权限、协议和媒体发布时机原样保留。
- 不修改 BFF 类型、组织映射、全局状态、路由、目录基础设施或上传操作。不重写行业 hooks；不引入字段 schema、通用表单、通用页面框架。
- 共享展示禁止读取 Context、数据源模式、BFF DTO、路由／存储或调用 API；只消费展示值、能力及回调。React 文件输入 ref 是展示局部状态，可保留。
- 同文件四个公司变化串行，Task 2 → 3 强依赖；所有 Task 顺序 1 → 2 → 3 → 4。两条在办分支范围参见 Spec §5，开工重查，不以文档快照保证无冲突。
- 测试 raw 用 `test-results/company-profile-education-ui/`，必要时先写任务专属临时目录防 Playwright 清空；截图用 `ui-regression-output/company-profile-education-ui/`。持久总结、review 裁决和收尾事实只记本 Plan，不新增报告或 handoff。

## Task index

Task count: 4
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|清单共享；无上游|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|2|基本信息／相册共享；继 Task 1|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|3|分区页面壳／编排；依赖 Task 2 私有展示接口|前沿（Claude Code: opus）|前沿（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|4|学校／专业复用；串行置于 Task 3 后|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|

Task 2/3 虽不改业务，但媒体回调和行业子页挂载／焦点边界容易在提取时漂移，实施与契约检查采用前沿档；其余接口既有且局部。代码质量 review 重点检查有没有引入多余层次。

**计划本身复杂度：中。** 改动局部但公司分区文件较大、媒体与行业子页需保留生命周期。
**零上下文漂移风险：中。** 明确接口与禁止改动层可约束多数判断，仍需现场核对在办分支与视觉。使用当前可用的行业 Top 5–10 中高性价比模型执行；Task 2/3 按角色表提高。

## 测试选择与验收策略

1. 防止 Mock 被 Backend 反向改版、字段串写、权限放宽、媒体错回调、行业开关重挂丢草稿，以及教育同名错 ID、分页／点选状态变化。
2. 开发期用每 Task 列出的 Vitest 文件／Playwright 精确 grep；改前已有行为用 characterization，不人为制造行为故障。新增共享组件接线断言应先失败再最小提取；已有断言足够时保留并运行，不写仅镜像 JSX 的测试。
3. 本轮不改变真实请求／权限／上传协议，离线 fixture 足以验证组件接线；若必须改变这些层才能实现，先停止扩大范围，报告契约变化，不能用 Mock PASS 代替真实边界验证。
4. 最终权威入口：下文收尾列的静态、受影响单元、浏览器选集、视觉前后核对与清单检查。仓库无 affected 专用脚本，用原生文件／grep 选择和收集结果记录集合，不创建新 selector。L3 responsibility: none；selection: none，记 N/A，不跑 STG、不部署。final gate 时按实际 diff 与届时仓库规则重新分类，新增责任不能伪装既有授权。
5. 现有证据仅源码静态调查，任务时长未知。无需规划时先跑测试填数字。浏览器 mock/fixture/annotation 项目继承现有条件；统一 workers=4、retries=0，不重复跑 deprecated alias。

视觉采集：Task 1 开始、任何产品编辑之前，在当前工作区用既有 Mock 登录／导航 helper 和 Playwright 临时诊断脚本采集批准产品基线；脚本与 PNG 留任务证据目录，不新增框架或 tracked helper。采集用既有离线边界，禁止访问真实 STG。结束以完全相同脚本／数据／视口重采，用原生图片检查或既有比较工具逐图核对，记录实际截图路径与差异原因；只采集不算视觉通过。Mock 基线含清单、基本信息、公司介绍、主营业务、产品介绍、福利、团队、两组相册空／满及学校／专业选中状态。主视口 390×844，再检查 320×568 下基本信息、相册和学校／专业无溢出。Backend 新增态通过 fixture 采集名称错误、只读、相册上传预览、学校副标题／分页。若已有采集场景不覆盖这些页，用任务本地脚本补采，不扩大全站18场景或更新全站像素基线。

### 视觉采集可执行入口（R1 补充）

临时配置和采集用例均放 `ui-regression-output/company-profile-education-ui/`（已忽略），不放 `test-results`，避免 runner 清空脚本。脚本是本任务固定场景诊断材料，不是新 tracked 测试框架。改前／改后使用同一份文件；将文件 hash、数据、浏览器版本、source commit 与截图目录记入本 Plan 执行记录。

先从仓库根运行以下配置生成命令；不修改正式配置：

```bash
node --input-type=module <<'JS'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const dir = 'ui-regression-output/company-profile-education-ui';
mkdirSync(dir, { recursive: true });
const source = readFileSync('playwright.config.ts', 'utf8');
if (!source.includes("testDir: './e2e',") || !source.includes('command:')) throw new Error('配置形状改变，需重新核对');
const config = source
  .replace("testDir: './e2e',", "testDir: '.', testMatch: 'capture.spec.ts', outputDir: 'runs',")
  .replace('command:', 'cwd: process.cwd(), command:');
writeFileSync(`${dir}/capture.config.ts`, config);
const modules = [
  ['{ test, expect }', 'e2e/fixtures/test.ts'],
  ['{ pickerMock登录, pickerBackend存量候选, hash直达 }', 'e2e/fixtures/数据源交互.ts'],
  ['{ 安装BFF路由 }', 'e2e/fixtures/bff/安装BFF路由.ts'],
  ['{ 信封 }', 'e2e/fixtures/bff/协议.ts'],
  ['{ 带企业关系, P1C招聘组织Fixture, P1C管理员关系, P1C成员关系, P1C组织甲, P1C组织乙, P1C标记, 一像素PNG }', 'e2e/fixtures/bff/招聘组织.ts'],
];
// 本机绝对 import 只生成到忽略的临时脚本，不能复制回 tracked Plan/prompt。
const imports = modules.map(([names,path]) => `import ${names} from ${JSON.stringify(resolve(path))};`).join('\n');
writeFileSync(`${dir}/capture.spec.ts`, imports + '\n');
JS
```

在生成的 import 后追加本节固定场景，使用既有 `test/expect`（context 自动安装离线边界），每个场景独立 test；Mock 标 `@mock`、Backend 标 `@backend`。配置继承原三服务：4181 Mock、4182 Backend fixture、4183 annotation，`cwd` 固定当前仓库根；本轮只选择 mock/fixture 项目，仍保留原三服务启动方式。端口占用即报告，不能杀他人服务、换端口或复用不明服务。截图路径用 `process.env.UI_CAPTURE_PHASE`，只允许 before/after，缺值抛错；`page.screenshot({ path: ... , fullPage: true, animations: 'disabled' })` 之前等待可见状态及 `document.fonts.ready`，不固定 sleep。

| 场景 | 固定准备步骤与截图前断言 |
| --- | --- |
| Mock 公司清单及七分区 | `pickerMock登录(page)` → 点击“我要招人” → 等待 `http://127.0.0.1:4181/#/hr/card`。用 `hash直达` 访问 `http://127.0.0.1:4181/#/hr/company-profile` 及 `/basic`、`/intro`、`/business`、`/product`、`/welfare`、`/team`、`/album`。分别等待标题／字段可见再截图，不保存；清单标题“编辑品牌信息”，基本信息用 `getByLabel('公司全称')`，其它以对应分区标题确认。每个 test 新 context，使用默认演示档，不种全局存储 |
| Mock 相册满组 | 同上到 album，先截空态；通过 `page.locator('input[type=file]').nth(0/1).setInputFiles({ name:'sample.png', mimeType:'image/png', buffer:一像素PNG })`，每组各三次，每次等待新增对应“删除实景照片第 N 张”／“删除公司照片第 N 张”按钮；两组添加键都不存在后截图，不点保存。该操作只是 Mock 草稿，不走后端 |
| Mock 学校／专业 | 新 test `pickerMock登录` 后 `hash直达(page,'http://127.0.0.1:4181/#/onboard/school')`，输入“大学”，按 `/^清华大学( ✓)?$/` 点选；输入值为清华大学、候选仍可见后截图。专业新 test 去 `http://127.0.0.1:4181/#/onboard/major`，输入“工程”，按 `/^软件工程( ✓)?$/` 点选后截图。沿现有连点用例准备法 |
| Backend 管理员／只读 | `安装BFF路由` 输入 `登录尝试id:'att-ui-company'`、`记录目录请求:()=>undefined`、`主体初始角色:'recruiter'`；管理员用 `带企业关系(P1C招聘组织Fixture,[P1C管理员关系],{[P1C标记.组织甲编号]:P1C组织甲()})`；只读新 test 换成员关系／组织乙。`page.goto('/')` 等待 `http://127.0.0.1:4182/#/hr/` 后 hash直达 basic。管理员三名称在场；只读无保存且可编辑输入 disabled，再截图 |
| Backend 名称错误 | 管理员初始化时，通过既有 `覆盖` 精确键 `['PATCH ', 'api', 'v1', 'organizations', P1C标记.组织甲编号, 'profile'].join('/')` 返回 `{status:409,响应:{error:{type:'organization_name_conflict',message:'名称冲突'}}}`。basic 改常用名为“视觉冲突公司”后保存；等待“这个常用名已被其他企业使用”、保留输入、仍在 basic 后截图 |
| Backend 相册上传预览 | 管理员 fixture 安装后，注册精确 `page.route` 匹配组织甲 `/media`（无后缀）的 POST，在 handler 中 await 一个由 test 控制的 promise，其他 method `route.fallback()`。到 album 后以一像素PNG 上传；等待 `getByAltText('上传预览')` 和添加实景照片按钮隐藏后截图；finally resolve promise，handler `route.fallback()` 交原 fixture 完成，不走网络；等待删除第1张出现后结束。不可永久悬挂 route 或提前关闭 context |
| Backend 学校副标题／分页 | 新 test `pickerBackend存量候选(page,'att-ui-school')`，之后注册精确 `new URL('http://127.0.0.1:4182/api/v1/catalog/education-institutions').pathname` GET 的本地覆盖，所有 query 均用 `route.fulfill({status:200,json:信封({items:[{id:'ins-ui-1',display_name:'视觉大学',location:{id:'loc-ui-1',display_name:'上海市',country_code:'CN',country_name:'中国',admin1_code:null,admin1_name:null,timezone:'Asia/Shanghai',population:0}}],next_cursor:'ui-page-2',catalog_version:'ui-v1'})})` 应答（wire 使用 snake_case，不能用页面模型的 nextCursor）；到 school 输入“视觉”，等待“视觉大学”、“上海市 · 中国”和加载更多按钮后截图。本场景不点分页，分页行为由既有单元用例负责；不能覆盖其它业务路径 |

所有 Mock 公司分区及两页候选用 390×844；basic、album（空和满）、学校、专业另以 320×568 复跑，用 `page.setViewportSize` 在准备前固定。Backend 额外态390×844。不额外新增全站视觉场景。截图命名固定为“模式-场景-宽x高.png”，分别落 before/after 子目录；输出前创建目录，截图缺失不能当作无差异。

```bash
npx playwright test --config ui-regression-output/company-profile-education-ui/capture.config.ts --project mock --project fixture --list
UI_CAPTURE_PHASE=before npx playwright test --config ui-regression-output/company-profile-education-ui/capture.config.ts --project mock --project fixture --workers=1 --retries=0
UI_CAPTURE_PHASE=after npx playwright test --config ui-regression-output/company-profile-education-ui/capture.config.ts --project mock --project fixture --workers=1 --retries=0
```

第一条应收集上述场景，第二条必须在产品修改前成功并逐图确认；before 未完整则不得开始产品编辑。第三条在全部变更完成后执行，可在 Task 3 先仅复查公司部分，最终只补未验教育部分。前后必须使用同一脚本与数据版本；脚本修正后尚未改产品则重采受影响基线。已改产品后不得用 after 冒充 before，也不 checkout/reset 改回源码；只允许从本任务先前保存的同版本原始截图备份恢复。若无合法基线证据，记录视觉责任未完成并报告，不宣称 ready，不新建用户工作区或自行重构采集基础设施。

### Task 1: 公司档案清单共用 Mock 展示

**目标／非目标：** 删除两份清单 JSX，保持七分区导航、既有完成度算法和组织门。不要调整基本信息总数或相册分区定义。

**预期编辑文件：**
- 新增：无。
- 修改：`src/屏幕/公司档案编辑.tsx`、`src/屏幕/公司档案编辑.test.tsx`。
- 删除：无。

**契约：** 同文件私有 `公司分区清单({ 分区状态, 选分区 })`：`分区状态: Record<分区键, 分区状态>`（类型从 `src/数据/公司主页资料.ts` 导入并可别名），`选分区: (段: string) => void`，返回 React JSX。固定分区表作为静态数据仍可直接读取；Backend 从真实快照计算、Mock 从静态档与覆盖计算，然后都传入该组件。只读说明放 Backend 连接层，组织门包住其消费者，组件不调用导航 hook。页面标题／返回／滚动区共享为私有 `公司清单页面({ 返回, children })`，输入 `返回: () => void`、`children: ReactNode`，门保持在 children 内。

- [ ] 核对工作区、版本、预告；完成“视觉采集”中的改前全量页面基线并记录 source commit，不能等 Task 2 后才补基本信息截图。
- [ ] 读清单双分支与既有测试；保持 Backend 零静态档调用、pending/revoked/suspended 空态、member 可进只读分区的断言。
- [ ] 增补最小两模式导航／摘要验证（只有缺口才补）：Mock 七行仍存在；Backend 计数来自快照，点击相同分区调用相同路径。记录改前结果。
- [ ] 从 Mock 搬出上述两个私有展示函数，Backend 在组织门内传真实分区状态；删除旧重复行，保留只读说明现有风格，不改 CSS。
- [ ] 执行 `npm test -- src/屏幕/公司档案编辑.test.tsx`，预期全部通过；失败定位到提取映射或权限门，不改变样本掩盖问题。
- [ ] 核对两模式调用同一函数并检查无 Context/导航依赖；只提交本 Task 文件：`refactor: share company profile section list presentation`。

**完成／停止：** 相同分区同一展示，真实／Mock 数据不串；门或计数算法需要变更则停止扩大范围。下游不依赖本 Task 新导出。

### Task 2: 基本信息字段与相册共享展示

**目标／非目标：** 从 Mock 基本信息和图片组抽共同展示，Backend 注入额外名称／只读／预览；不重构媒体、压图、数据层或保存函数。

**预期编辑文件：**
- 新增：无。
- 修改：`src/屏幕/公司档案分区编辑.tsx`、`src/屏幕/公司档案分区编辑.test.tsx`。
- 删除：无。

**依赖：** Task 1 已提交，改前视觉证据存在。读取当前 Backend/Mock基本信息区、后端媒体组／图片组及媒体操作，不能删原 callback 的清理与目的类型绑定。

**冻结私有接口（同文件，无公共导出）：**

```ts
type 基本信息正文属性 = {
  资料: 资料形;
  改: (补丁: Partial<资料形>) => void;
  名称区: ReactNode;
  可编辑: boolean;
  LOGO地址: string | null;
  选了LOGO: (事件: React.ChangeEvent<HTMLInputElement>) => void;
  开行业层: () => void;
  行业行引用: { current: HTMLButtonElement | null };
};
type 名称输入行属性 = {
  标签: string; 值: string; 上限: number; 禁用: boolean;
  改变: (值: string) => void; 错误?: string | null;
};
type 公司图片组属性 = {
  标签: string;
  图片们: Array<{ 键: string; 地址: string }>;
  预览?: string;
  可编辑: boolean;
  选了图: (文件: File) => void;
  移除一张: (序: number) => void;
  末条?: boolean;
};
```

产生 `基本信息正文`、`名称输入行`、`公司图片组` 三个私有函数，Task 3 使用前两模式适配后的基本信息／相册入口。名称区只含不同名称行：Mock 标签公司全称、40 字；Backend 常用名80、品牌名40（内部公司全称）、只读工商名，原错误／校验函数不变。共有字段不能放回两套完整表单槽位。`公司图片组` 使用既有每组3张上限与 Mock 图格 CSS；可编辑=false 隐藏添加/删除入口，预览存在时沿 Backend 规则抑制添加；文件 input 清 value 后回报首文件。

Backend 映射 media_id/url → 键/地址；删除下标仍回原移除一张(purpose,序)，上传回原校验／发布链。Mock 保留现有 key 算法与压成相册图，成功修改草稿后由原保存提交；LOGO 仍即时本地更新。私有接口不导入 BFF 媒体 DTO。

- [ ] 核对既有测试对三名称、行业选择、长度、团队人数、媒体删除／上传／脱离收据／卸载覆盖；只为新共享回调映射缺口补测试，保持原测试风险。
- [ ] 先提取名称输入行和共同基本信息，两连接层组合名称区。Backend readonly LOGO 仍无可点上传入口，Mock 相机角标和尺寸保持。
- [ ] 再提取公司图片组，移出压图／发布业务到原适配层；验证 upload-preview 的 object URL 回收仍由原 effect/callback 负责，不把卸载变成服务器删除。
- [ ] 检查正常与只读 JSX 均沿 Mock 既有样式，额外提示不影响共有字段布局；不修改 styles 或固定新视觉数值。
- [ ] 执行 `npm test -- src/屏幕/公司档案分区编辑.test.tsx`。所有既有／新增用例通过，特别是合法文件 purpose、满组、发布失败收据、卸载清理与 Mock 保持。
- [ ] 运行 `npm run typecheck`；只提交上述文件：`refactor: share company profile fields and photo groups`。

**失败反例：** Backend 传错数组／下标删另一张，Mock 选择文件立即写全局相册，常用名改变 brand_name，或 readonly 能上传，均不得通过。需要修改协议／状态层时停止，不能顺带修。

### Task 3: 统一公司分区外壳及正文编排

**目标／非目标：** 两连接层调用同一份页面壳和分区 switch，保留整屏文本／福利／团队／行业选择正文。不以统一壳为由重挂根层草稿或 hooks。

**预期编辑文件：**
- 新增：无。
- 修改：`src/屏幕/公司档案分区编辑.tsx`、`src/屏幕/公司档案分区编辑.test.tsx`。
- 删除：无。

**依赖与接口：** Task 2 的私有基本信息／图片组已存在并有通过的定向记录。新增同文件 `公司分区页面`，输入：`分区: 分区定义`、`返回: () => void`、`保存: () => void`、`可编辑: boolean`、`保存禁用: boolean`、`行业层开: boolean`、`行业子页: ReactNode`、`提示区?: ReactNode`、`children: ReactNode`。负责次级白底壳、父表单 wrapper、返回／保存栏与大标题，行业子页为父 wrapper 的根层兄弟。父 wrapper 保持挂载，hidden + 显式 display:none 语义不变。

新增 `公司分区正文`，输入 `分区: 分区定义`、`资料: 资料形`、`改: (补丁: Partial<资料形>) => void`、`可编辑: boolean`、`业务上限: number`、`人数上限?: number`、`基本信息: ReactNode`、`相册: ReactNode`。只在这一处分区分派：公司介绍500、产品介绍300、主营业务传入上限、福利和团队复用已有正文，其余消费 Task 2 适配入口。名称／媒体差异仍在连接层，禁止通过数据源模式重新分出整套 switch。

- [ ] 保留 Backend 根层 hooks／草稿／媒体／行业状态和 Mock 根层 hooks；两者只把最终 JSX 改成相同壳与正文调用。
- [ ] Backend 保存回调可包装 `() => void 保存()`，不改异步保存函数；传入原缺行业引用禁用、可编辑和只读／脱离媒体提示；Mock 保存禁用=false，不新增校验。
- [ ] Backend 主营业务传4019（20×200+19）、团队20；Mock 主营业务200、团队undefined。每条业务长度保存校验不移入纯展示。
- [ ] 用既有测试验证行业开闭保留草稿／焦点、读取失败重试、只读分区、保存失败不返回；补缺失的 Mock 返回丢文本草稿与 Backend 额外名称不串写断言，不更改原入口行为。
- [ ] 执行 `npm test -- src/屏幕/公司档案分区编辑.test.tsx src/屏幕/公司档案编辑.test.tsx`。
- [ ] 执行 `npm run test:e2e -- e2e/suites/招聘组织.spec.ts --grep 'P1C member|P1C 企业媒体|P1C 409|P1C Organization 读取失败' --workers=4 --retries=0`，覆盖组织门、媒体目的、保存冲突及无 Mock fallback。
- [ ] 执行 `npm run test:e2e -- e2e/suites/展示与交互.spec.ts --grep '公司档案基本信息「选择行业」|发布岗位「职位类别」与公司档案「选择行业」' --workers=4 --retries=0`；原用例内包含发岗入口，保留该用例责任，不改 fixture 切碎它。
- [ ] 核对 Mock 公司各分区改后截图与 Task 1 改前基线；Backend 额外状态诚实且复用风格；保存证据，提交 `refactor: share company profile editor shell and sections`。

**完成／停止：** 两模式共同编排只有一份，原业务 hooks 未移动/重写；父子挂载／焦点行为不满足则修提取，不扩展全屏选择框架。

### Task 4: 引导学校与专业接现成候选展示

**目标／非目标：** 两页 Backend/Mock 候选 map 改为同一个教育目录候选列表；不动预填、查询、保存或下一步规则。

**预期编辑文件：**
- 新增：无。
- 修改：`src/屏幕/毕业院校.tsx`、`src/屏幕/选专业.tsx`、`src/屏幕/毕业院校.test.tsx`、`src/屏幕/选专业.test.tsx`。
- 删除：无。

**生产／消费契约：** 导入 `教育目录候选列表` 和 `教育候选`。既有 props 为 `项们: 教育候选[]`、`加载中: boolean`、`还有: boolean`、`选定: (键: string) => void`、`加载更多: () => void`；项为 `{ 键: string; 名称: string; 副文?: string; 选中: boolean }`。Backend 键=id，学校副文=既有学校副标题结果，选中=原引用.id===项.id。Mock 键与名称=原本地名，选中=名===词，不增加副文。Backend 回调从当前候选项按 id 查找并调用原选候选，找不到不提交；Mock 调原选Mock候选。Backend 分页状态原样传入；Mock 还有=false、加载中=false。请求状态提示留页面，不更改组件合同／CSS。

- [ ] 读两页与现有教育候选组件，核对 import 相同入职引导 CSS，不增加另一套候选样式。
- [ ] 保留既有引用、点选不清列表、翻页去重、迟到响应与预填断言；缺少时补 Mock 自由文本和 Backend 同名不同 ID 的页面行为断言。
- [ ] 将两套 map 与加载更多 JSX 替换成上述单个组件调用。只新增展示数组与按键适配，不改查询 effect 依赖、250ms debounce、草稿或保存函数。
- [ ] 执行 `npm test -- src/屏幕/毕业院校.test.tsx src/屏幕/选专业.test.tsx src/组件/教育目录候选列表.test.tsx`，全部通过。
- [ ] 执行 `npm run test:e2e -- e2e/suites/展示与交互.spec.ts --grep '引导 学校/专业 搜索后同项连点两次候选不消失' --workers=4 --retries=0`，实际收集并覆盖 Mock/Backend 两条，选中不新增请求、不丢候选。
- [ ] 核对 Mock 学校／专业改前后截图及窄屏，Backend 副标题／分页；检查可访问名称以学校／专业名称为主，测试不要依赖把副标题拼进 accessible name。
- [ ] 提交本 Task 文件：`refactor: reuse education catalog presentation in onboarding`。

**完成／停止：** 两页无模式各自 map 按钮；Mock 自由文本与 Backend 有效引用规则都保持。不修改工作经历、目录基础组件或预填流程解决测试漂移。

## 实施后收尾（不计入 Task count）

全部 Task 与执行 skill 要求的宿主内全局 review 完成后退出其流程，不再调用默认 finishing。以下由同一实施执行者连续负责：

1. 冻结候选并调用异构 review-loop：Codex 宿主用 Claude，Claude Code 宿主用 Codex。绑定批准 Spec/本 Plan 与固定候选 diff，读对应 skill 的 `../_shared/review-contract.md`；reviewer 默认不跑测试。轮间只跑修复相关快速单元／静态，不跑 affected 全集。轮次、裁决和停止条件归 review skill，结果就地记录，不开启额外审批。
2. review 允许继续后重算最低充分 affected，完成适用 L0–L2。基线计划命令如下；已有有效逐项 receipt 可复用，失败／改动仅补失效项，不机械重跑全部：

```bash
npm run typecheck
npm run lint
npm run build
npm test -- src/屏幕/公司档案编辑.test.tsx src/屏幕/公司档案分区编辑.test.tsx src/屏幕/毕业院校.test.tsx src/屏幕/选专业.test.tsx src/组件/教育目录候选列表.test.tsx
npm run test:e2e -- e2e/suites/招聘组织.spec.ts --grep 'P1C member|P1C 企业媒体|P1C 409|P1C Organization 读取失败' --workers=4 --retries=0
npm run test:e2e -- e2e/suites/展示与交互.spec.ts --grep '公司档案基本信息「选择行业」|发布岗位「职位类别」与公司档案「选择行业」|引导 学校/专业 搜索后同项连点两次候选不消失' --workers=4 --retries=0
npm run test:list -- --check
git diff --check
```

每个浏览器 grep 先用同参数 `--list` 检查非零且与上述风险匹配。视觉按前述采集责任完成。测试项新增导致清单过期才执行 `npm run test:list -- --write`，修改路径仅 `docs/testing/cases.md`，与并行任务协调，不手写自动区、不修改测试框架。收尾可修改本 Plan 记录；产品缺陷仅按既定 scope 修复。若测试宣告数量变化，依据 runner，不抄历史数字。

3. 记录 pre_gate_target_base、候选 SHA、每条 selection/命令/receipt/运行环境、原始 PASS 的 source_candidate 和可复用依据。没有统一 affected 脚本时使用上述原生入口与 `--list`，明确记录从实际 diff 到消费者及选集的映射，缺依据不回退整层蛮跑。出现失败修复后不回到 Task/global/异构 review；记录实际 review 后 delta，只补无效证据。
4. 确认前只允许只读 fetch，禁止合 target、正式 L3、push。向用户展示具体 final gate 方案，只有完整 L0–L2 与 review disposition 允许时才称 ready。用户明确批准后完整读取 development-workflow 根相对 `references/final-integration.md` 与 `assets/final-integration-contract.md`。
5. 获批后同步 `origin/main`，记录 final_target_base，按实际 target→候选差异重算完整责任，符合六维有效性则零 runner 复用，不成立只补缺口；完整选择基准 final_affected_base 必须等于 final_target_base。按最终仓库规则核对 L3，本设计 none 记 N/A，不记 PASS。再次核对证据及 target，target 未推进才普通 fast-forward push `HEAD:main`，禁止 force。推进则停止并给新 gate，不自动追赶。只在 push 成功后报告合入，刷新本机 intent。

## 文档审查与执行记录

规划阶段：用户已批准 Spec 精确版本并授权 Claude 文档 review。候选范围仅本 Plan 与 Spec；不审分支业务 diff。

- R1：Claude opus/high，候选 `4884d834`，只读 guard 通过，无测试执行。Important/required 1 项：视觉基线未冻结运行入口及特殊状态准备。核实成立，已补临时 config、准确命令、原三服务端口／离线模式、场景输入与失败停止边界；不增加 tracked 基础设施。Minor/optional 1 项：教育浏览器选集理由不明确，接受文档澄清。均不改变批准 Spec。
- R2：沿同一 Claude reviewer 会话复审，候选 `b8c8dc29715dded0208e8c854234a8a8939ef7c5`，Plan blob `9999414d`（短标识；完整版本以该候选 Git 对象读取）。返回精确 `NO FINDINGS`；两轮均通过 HEAD/status/受审文件指纹 guard，无测试执行，无未解决 required。提示词校验阶段仅把视觉方案中的浏览器路由改写成同端口完整 URL／等值路径表达式，避免路径校验器误判为规划机器绝对文件路径；无行为或选集变更。R1 修复提交 `b8c8dc29`；本条及 Spec 状态更新仅记审查事实，不改变已审实施契约。
- 教育浏览器取舍：`e2e/suites/候选建档.spec.ts` 的完整建档保存链不在本轮变更内；四页 Vitest 覆盖保存／引用映射，所选展示与交互用例直接覆盖本次候选行的点击、重复点选和请求不变。学校 getByText、专业 exact 名称仍受所选用例覆盖，不为纯展示接入重跑整个建档旅程。final gate 若实际修改到保存或初始化合同，必须重算该消费者责任。

实施记录由新实施 session 在本节追加 Task 完成、验证、review 裁决与 final gate 事实，保持规划与执行证据分开。
