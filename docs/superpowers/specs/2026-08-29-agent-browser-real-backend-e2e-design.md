# Agent Browser 真实本地后端整栈验收设计

**日期：** 2026-08-29

**状态：** 已确认，等待书面规格审阅

**适用仓库：** 前端 `agxp-a2a-recruiting-web`，并需要后端 `agxp-monorepo` 提供窄的本地 fixture 收敛入口

**前端基线：** `origin/main@aa467312353eabc5a5445a333a751418c47c442a`

**后端证据：** 本设计只依赖后端现有持久化 Recruitment local dev stack、固定五账号/四位 OTP、`127.0.0.1:8097` BFF、`dev-local.sh prepare|up|health|bootstrap|down` 与现有 internal review 能力。实施前必须在后端目标分支重新核对这些入口，不能复制本地旧 checkout 的内部实现。

## 1. 结论

新增一条本地、显式、慢速的真实前后端整栈验收。它复用后端现有 local dev stack，以 `backend/local` 启动前端，由 `agent-browser` 用两个隔离浏览器会话分别模拟候选人和招聘方，执行四条上层业务旅程：候选数据加载、候选 CRUD、招聘数据加载、招聘 CRUD。

验收只在业务里程碑上断言“数据可见、操作成功、刷新后仍成立、删除后消失”，不重复现有测试对请求 body、请求顺序、ETag、幂等键、DTO 字段、DOM 层级或 CSS class 的细节验证。这样既能发现真实前后端接线和持久化问题，又不会把慢速整栈测试变成经常因实现细节变化而破裂的第二套 component/API 测试。

同一条验收在七个稳定业务状态采集像素基线。真实后端基线与现有 Mock 视觉回归完全分开；第一阶段总是生成 reference/candidate/diff 报告，但视觉差异只报告，业务旅程从第一天起就是硬门。积累稳定运行证据并校准动态区域后，才通过独立决策把视觉门切到 `enforce`。

## 2. 背景与现状

前端已有三类相关验证，但它们没有覆盖本需求：

1. `e2e/数据源模式.spec.ts` 的 `@backend` 项目在浏览器层拦截全部 `/api/v1/*`，只验证前端请求边界与 fixture 解码。README 已明确它不是真实 BFF 联调。
2. `e2e/视觉回归/` 使用 Mock 数据，在目标分支与候选分支间做确定性截图和像素/几何比较。它刻意把任何 `/api/v1` 请求视为结构失败。
3. 后端 `recruitment-mobile-local` L3 Case 已覆盖认证、目录、简历、意向、岗位、组织、隐私、规则等真实 API 生命周期，但不启动本前端，也不点击用户界面。

后端还已有适合本验收的持久化本地开发栈：

- BFF 固定监听 `127.0.0.1:8097`；
- BFF 的 Public Origin 为 `http://localhost:5173`；
- 固定测试手机号 `+8613800000001` 至 `+8613800000005`；
- 本地四位 OTP 为 `3141`；
- `bootstrap` 创建账号/租户和必要平台关系，但刻意不播种业务数据；
- `down` 保留持久卷，且现有入口不提供破坏性的业务数据库 reset。

本设计补齐的正是这两个已有体系之间的上层黑盒验收，不替代任一现有测试层。

## 3. 目标

第一版实现以下目标：

1. 证明前端以 `VITE_DATA_SOURCE=backend`、`VITE_BACKEND_ENV=local` 运行时，真实 BFF 数据能够加载到候选端和招聘端页面。
2. 证明用户通过 UI 发起的主要 CRUD 能写入真实后端，并在硬刷新或重新进入页面后正确回读。
3. 证明两个浏览器会话的身份、Cookie 和私有数据互相隔离。
4. 用少量稳定业务状态建立真实后端像素基线，发现接线或 CRUD 过程中出现的 UI 漂移。
5. 产出可读的业务、视觉、运行时错误和清理证据，不保存认证秘密或私有网络正文。
6. 在持久化开发栈上可重复执行，不清空数据库，不触碰开发者账号或非 fixture 数据。

## 4. 非目标

第一版明确不包含：

- staging、生产或远程后端；
- 真实短信、真实微信登录或个人账号；
- AI 规则解释、推荐生成、委托完成时限或 MatchCase 自动阶段推进的硬门；
- 故障注入、409/503、重试、ETag、幂等键、请求 shape 等协议细节；
- 性能、Web Vitals、负载或资源占用门禁；
- 全路由截图、每次点击截图或所有 UI 状态基线；
- 多浏览器、桌面/平板、真机或 Capacitor；
- 通用场景 DSL、AI 自动生成/接受测试或失败后自动更新基线；
- 数据库全量 reset、删除持久卷或清理非 fixture 数据；
- 组织屏蔽/解除的 CRUD；第一版只覆盖披露偏好，避免为一个未进入四条旅程的域额外制造组织关系；
- 把本验收加入普通 `npm test` 或默认 PR hosted-runner CI；
- 重构业务页面、数据源或现有测试框架。

AI/匹配相关页面若有可稳定播种的终态数据，可以作为非阻断的加载观察项，但不得在第一版声称覆盖其异步生命周期。

## 5. 设计原则

### 5.1 业务结果高于实现细节

每个业务动作最多保留三类断言：

1. 操作前看得到播种对象；
2. 操作后看得到预期业务结果；
3. 硬刷新或重新进入页面后，结果仍然正确。

删除类动作再补一条“刷新后对象仍不存在”。不长期断言请求数量、请求顺序、字段 body、内部 ID、toast 逐字文案、DOM 层级或样式类名。

### 5.2 真实边界，不允许伪通过

测试不得使用 `agent-browser network route`、Playwright `page.route`、service worker mock 或浏览器内 response stub。运行期间必须观察到真实同源 `/api/v1` 流量，并在页面上看到只存在于后端 fixture 的可见标记。

Backend 已接线域失败时不得回退 Mock。出现 Mock 专属数据、真实 API 全程零请求或 route mock 即视为功能失败。

### 5.3 上层语义定位

交互优先使用可访问 role、label、heading 和稳定业务关键词，例如“我的简历”“求职意向”“岗位管理”“保存”“删除”。允许关键词或正则，不绑定整段产品文案。

`@eN` 只用于当前 snapshot 的即时动作，绝不写进长期测试文件；任何页面变化后重新 snapshot。等待 URL、标题、按钮或业务数据出现，不用固定 sleep 作为主要同步手段。

### 5.4 视觉只钉稳定里程碑

登录倒计时、toast、瞬时弹层、附件解析轮询、相对时间、AI 简报和动态推荐不建立像素基线。视觉比较只覆盖固定播种数据、固定排序且不含运行时间的稳定页面。

## 6. 总体架构与责任

```text
后端官方 local dev 入口
prepare -> up -> health -> bootstrap
                    |
                    v
          browser fixture converge/verify
                    |
                    v
前端 localhost:5173, backend/local
                    |
                    v
 agent-browser candidate / recruiter 两个 session
          |              |
          +-- 业务旅程 --+
          +-- 刷新回读 --+
          +-- 视觉截图 --+
                    |
                    v
         report + candidate + diff + cleanup
```

### 6.1 后端仓库责任

后端仓库拥有：

- local dev stack 的准备、启动、健康、bootstrap 和普通停止；
- fixture 测试账号、企业关系、组织审批和真实 API 生命周期；
- `browser-fixture.sh converge|verify|cleanup`；
- fixture 的 source/contract 测试；
- 不泄漏 secret/原始私有正文的安全 receipt。

后端入口不得为前端测试复制生产路由或增加通用 seed API。它是 test/local-only operator script，优先调用真实 BFF 公共 API；企业管理员审批等普通用户无法完成的步骤复用已有受控 internal-review 路径。

### 6.2 前端仓库责任

前端仓库拥有：

- 整栈验收的单一操作入口；
- 四条用户旅程和共享的 `agent-browser` 语义步骤；
- 视觉场景、环境 manifest、基线 PNG、candidate/diff 与报告；
- console/page error、失败请求和 cleanup 判定；
- 真实后端 E2E TypeScript 的独立 typecheck project；
- 为披露偏好分段按钮补真实 accessible name/pressed state，并同步既有数据源 E2E 定位；
- 被 `.gitignore` 排除的运行产物。

前端通过必填的 `AGXP_MONOREPO_DIR` 找后端仓库，不硬编码 `~/agxp-monorepo`，也不直接调用 Docker Compose 内部文件。

## 7. 本地栈编排

运行器只调用两个仓库的公开入口，不复制 Compose 参数、secret 路径或服务拓扑。

固定执行顺序：

1. 检查 Docker、两个仓库、Node 依赖、`agent-browser`、Chrome、端口和工作目录安全。
2. 调用后端官方入口准备并启动完整 local platform/Recruitment stack。
3. 调用 Recruitment `health`；健康失败时停止，不开始播种或浏览器动作。
4. 调用现有 `bootstrap` 创建固定测试账号/租户。
5. 调用 `browser-fixture.sh converge` 和 `verify`。
6. 以 `VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local` 在 `http://localhost:5173` 启动 Vite；不能使用 `127.0.0.1:5173` 冒充页面 Origin。
7. 运行浏览器旅程、视觉比较和最终 fixture verify。
8. 关闭本次创建的浏览器 session 和 Vite。
9. 若后端栈在运行前已健康，则保留；若由本次测试启动，则执行官方普通 `down`，保留持久卷。

运行器必须记录每项资源的“测试前存在/本次创建”，只清理自己创建的进程和 session。不得停止已有开发服务、删除别人的容器/卷或用换端口绕过资源冲突。

## 8. Fixture 收敛

### 8.1 为什么使用 converge 而不是 reset

现有持久化 local stack 刻意没有 reset。增加数据库清空既会破坏开发者数据，也会绕开 API 约束，使测试通过不能证明生产路径正确。因此 fixture 采用“专用账号 + 固定基准对象 + 临时前缀对象”的幂等收敛。

### 8.2 固定账号

第一版使用固定测试身份：

- 候选账号：`+8613800000001`；
- 招聘账号：`+8613800000002`；
- 本地 OTP：后端现有四位测试码。

OTP 只作为本地测试输入，不写入报告、命令回显、截图说明或保存的浏览器 state。两个账号只用于本验收，所有可清理业务对象都归它们所有。

### 8.3 固定基准状态

`converge` 将专用账号收敛到以下可见业务状态：

候选账号：

- 完整简历，摘要含固定“浏览器验收候选人”标记；
- 一条固定求职意向；
- 固定披露偏好；
- 附件库有执行 create/replace/delete 所需的空余槽位。

招聘账号：

- 固定招聘名片；
- 已批准的企业关系；
- 固定企业档案，名称含“浏览器验收科技”标记；
- 一个在招岗位；
- 一个已归档岗位；
- 一个无在谈候选、允许执行完整 CRUD 的测试岗位空间。

固定值必须满足真实业务校验，且 UI 上可辨认；它们不伪造 production ID。

### 8.4 Catalog

Catalog ID 不硬编码。播种器用固定显示名查询真实目录，要求恰好一个 active/selectable 结果，并把返回 ID 用于后续写入。

零结果、多结果、inactive、不可选择或目录版本不兼容都返回环境阻塞；不得猜测第一个结果，也不得直接查库绕过目录合同。原始 Catalog ID 只存在临时运行内存和受限工作目录，不进长期证据。

### 8.5 临时 CRUD 对象

能承载显示名称的临时对象使用固定、保留的验收名称，例如：

```text
浏览器验收岗位 · 临时CRUD
```

正常路径通过 UI 删除。run ID 只进入私有 journal/receipt，不进入截图内的业务文案。`converge` 在浏览器运行前把专用账号的 owner-list ID 与开始时间写入 mode-0600、gitignored 的本轮 receipt；长期报告不保存这些 ID。若旅程中途失败，`cleanup` 只允许在同一 owner list 中处理 receipt 之后出现的精确差集：附件和岗位还必须匹配各自完整的保留验收名称；没有名称字段的意向必须是唯一新增行，并完整匹配本旅程冻结的 Catalog、工作方式和薪资签名。零条视为 UI 已清理，多条、未知差集、foreign owner 或签名不符都失败关闭。它不得按模糊前缀跨账号删除，也不得清理没有 fixture ownership 证明的对象。

账号、企业主体和不可删除关系不尝试销毁；下一次 `converge` 把它们覆盖回固定基准状态。cleanup 失败会使整次验收失败，但下一次运行仍先通过 converge 修复孤儿对象。

### 8.6 附件

前端仓库提供两份小型、合法、无真实个人信息的 PDF fixture。上传/替换/删除只断言附件库行的业务状态和刷新后存在性，不等待或断言 AI 解析完成时间。每次运行结束删除临时附件，避免占满三份配额。

## 9. 浏览器会话

创建两个隔离 session：

```text
backend-local-candidate
backend-local-recruiter
```

它们分别从登录页输入专用手机号和本地 OTP，真实获取 HttpOnly Cookie。测试不使用 `state save`、不共享 Chrome profile、不导出 Cookie，也不把登录状态写进仓库。

两个 session 可同时保持登录，用于证明：

- 各自硬刷新后仍保持会话；
- 候选页面不出现招聘方私有标记；
- 招聘页面不出现候选简历私有标记；
- 退出其中一个 session 不影响另一个 session。

## 10. 四条业务旅程

四条旅程独立报告；一个旅程失败后，运行器继续执行仍安全且不依赖其状态的旅程，以收集完整证据。共享 stack/fixture 健康失败则整体停止。

### 10.1 A：候选数据加载

路径：登录 -> 求职端 -> 我的简历 -> 求职意向 -> 设置/披露偏好。

证明：

- 当前身份和会话来自真实 BFF；
- 简历、附件、意向和隐私页面出现固定后端标记；
- 硬刷新后标记仍存在；
- 没有 Mock 专属候选内容混入已接线域。

### 10.2 B：候选 CRUD

路径：修改简历中现有的可编辑姓名 -> 新建意向 -> 编辑意向 -> 删除意向 -> 修改并恢复隐私设置 -> 上传附件 -> 替换附件 -> 删除附件。

每个业务块只在完成后和硬刷新后验证结果，不验证中间 HTTP 序列。当前产品的个人优势/摘要在“我的简历”页是只读展示，因此第一版选择已有行内编辑入口“姓名”作为简历更新门，不为测试新增产品入口。新建意向和附件使用临时对象；基准简历/隐私在旅程结束时恢复，最终由 `verify` 再确认。

### 10.3 C：招聘数据加载

路径：独立登录 -> 招聘端 -> 招聘名片 -> 公司资料 -> 岗位管理。

证明：

- 招聘身份、企业关系、企业档案和岗位来自真实 BFF；
- 固定在招/归档岗位按业务分组出现；
- 硬刷新后仍保持；
- 不出现候选账号的私有简历标记。

### 10.4 D：招聘 CRUD

路径：修改招聘名片 -> 修改并恢复公司简介 -> 发布岗位 -> 编辑岗位 -> 停止招聘 -> 重新开放 -> 删除岗位。

临时岗位没有在谈候选，允许走完整生命周期。每次状态转换只检查业务状态和硬刷新后状态；不检查内部版本、请求次数或 toast 原文。最终删除后岗位在刷新后的在招和归档清单都不存在。

## 11. 上层断言合同

每个里程碑允许使用：

- 当前 URL 的稳定业务段；
- 页面 heading/landmark；
- 一个或两个固定 fixture 可见标记；
- 业务对象存在/不存在；
- 稳定状态词，如“在招”“已归档”；
- 硬刷新后的同一结果；
- console/page error/失败请求为空。

不得作为长期合同：

- `@eN` ref；
- CSS module class；
- DOM 子节点次序；
- 完整长文案或提示停留时间；
- 精确卡片数量，除非它本身是业务上限/配额验收；
- API 请求精确数量和顺序；
- JSON body、headers、内部 ID、ETag 或 Idempotency-Key；
- 动画帧、滚动像素或脆弱坐标点击。

若无稳定可访问名称或状态导致旅程只能依赖坐标或 CSS，实施应给对应产品控件补真实的 accessible name 与 ARIA state，而不是增加测试专用 DOM 层级。披露偏好分段按钮第一版补包含字段名的 `aria-label` 与 `aria-pressed`，让旅程能证明选中档，而不是只证明三个常驻文案存在。

## 12. 视觉基线

### 12.1 场景

第一版固定七个场景：

1. `candidate-resume-loaded`
2. `candidate-intentions-loaded`
3. `candidate-disclosure-loaded`
4. `candidate-resume-updated`
5. `recruiter-card-loaded`
6. `recruiter-company-loaded`
7. `recruiter-jobs-after-create`

前四个复用候选加载/CRUD 旅程，后三个复用招聘加载/CRUD 旅程。视觉场景不是第五套业务旅程，不为截图重复登录和 CRUD。

### 12.2 稳定环境

采集固定：

- viewport `390x844`；
- 固定 `agent-browser` CLI 与 Chrome build；
- 固定语言、时区、颜色模式和 device scale；
- 等待 `document.fonts.ready` 和页面业务 ready 条件；
- 注入样式关闭 animation、transition、caret 和非业务闪烁；
- 每个场景固定滚动位置；
- 固定播种文案、固定临时 CRUD 文案、分组和排序；run ID 不得出现在七张截图的可见区域。

基线 manifest 记录 CLI 版本、Chrome build、viewport、时区/语言、场景 ID 和基线生成 commit。环境不一致时返回 `INFRA_BLOCKED`，不把浏览器渲染器变化误报为产品 UI 漂移。

### 12.3 比较

复用现有 `pixelmatch`/PNG 比较核心和报告格式，初始阈值沿用已有视觉回归：

- diff ratio `< 0.005`：pass；
- `0.005 <= diff ratio <= 0.05`：warning；
- diff ratio `> 0.05`：blocked。

第一阶段 `UI_VISUAL_GATE=report`：所有 warning/blocked 都产出 diff 和报告，但不改变功能验收退出码。稳定运行并由团队显式切到 `enforce` 后，blocked 视觉差异返回失败；warning 继续报告。

### 12.4 基线更新

基线 PNG 和 manifest 提交到前端仓库。candidate、diff、annotated screenshot 和运行报告全部写入 gitignored artifact 目录。

只有显式 `--update-baseline` 可以生成候选基线，且它只接受 `--journey all`，因为七张 reference 是一个原子集合。命令必须先通过全部功能旅程和 fixture verify。首次 bootstrap 要求 manifest 与 reference 目录同时不存在；半存在状态按损坏处理。已有 manifest 时通常还必须通过环境一致性检查；唯一可恢复例外是差异只限 `agent-browser`/Chrome renderer 版本，此时命令仍保持 `INFRA_BLOCKED` exit 75，但允许生成七图 review 目录，并同时记录安全的旧/新 renderer 元数据供人工审批。viewport、语言、时区、颜色、scale、schema、scene 清单不一致，manifest 损坏或期望图片缺失都不允许借更新命令绕过。命令不能直接覆盖已提交基线，最终更新仍需人工查看全部图片后显式安装并提交 manifest/PNG；不得只删除 manifest 来伪造 bootstrap。

## 13. 运行时错误与网络证据

每个旅程收集：

- page error；
- console error；
- failed request；
- `/api/v1` 方法与路径的脱敏摘要；
- 当前 URL、业务里程碑和截图路径。

不使用 HAR，因为它会保存 Cookie、认证 headers 和响应正文。网络证据不保存 request/response body、query 中的私有值、Cookie、Authorization 或完整内部 ID。

## 14. 失败分类

| 分类 | 示例 | 结果 |
|---|---|---|
| `INFRA_BLOCKED` | Docker/仓库/依赖缺失，端口冲突，栈不健康，Chrome 版本不匹配，Catalog 无唯一匹配 | 不开始或停止相关旅程；exit 75 |
| `FUNCTIONAL_FAILED` | 后端数据未加载，CRUD 刷新后丢失，删除无效，跨账号泄漏，Mock 回退 | 业务硬门失败；exit 1 |
| `VISUAL_DRIFT` | 功能通过但像素超过阈值 | report 模式只报告；enforce 模式 blocked 时 exit 1 |
| `CLEANUP_FAILED` | 临时意向、附件或岗位未清理，基准状态未恢复 | 整体失败；exit 1 |
| `USAGE_ERROR` | 参数冲突、未知 journey、报告无法解析 | exit 2 |

测试报告不能把 `INFRA_BLOCKED` 写成 PASS，也不能用 fixture、Mock 或旧截图冒充真实联调通过。

## 15. 证据与隐私

每次运行报告包含：

- 前端 commit、后端 commit；
- `agent-browser` 和 Chrome 版本；
- stack health、fixture converge/verify；
- 四条旅程的 verdict 与失败里程碑；
- 每个视觉场景的 diff ratio 和 reference/candidate/diff 路径；
- console/page error 和失败请求摘要；
- cleanup verdict；
- 最终退出码及失败分类。

报告、截图、视频和日志不得包含：

- Cookie、session state 或 bearer；
- OTP；
- Authorization；
- 原始 request/response body；
- 真实个人数据；
- 后端 secret、对象存储 key 或内部 review token。

自动运行默认不录视频。只有人工复现交互/时序问题时才显式录制，并在分享前检查画面；视频仍属于 ignored artifact。

## 16. 前端目录与命令

第一版不建立 DSL，直接使用少量可执行 journey script：

```text
e2e/真实后端/
├── 类型.ts
├── 报告.ts
├── 报告.test.ts
├── 运行整栈验收.sh
├── 运行整栈验收.test.sh
├── 公共步骤.sh
├── 公共步骤.test.sh
├── 旅程/
│   ├── 候选数据加载.sh
│   ├── 候选CRUD.sh
│   ├── 招聘数据加载.sh
│   └── 招聘CRUD.sh
├── 视觉/
│   ├── 场景清单.ts
│   ├── 比较.ts
│   ├── 比较.test.ts
│   ├── 基线清单.json
│   └── 基线/*.png
└── 资源/
    ├── 简历-v1.pdf
    └── 简历-v2.pdf

tsconfig.e2e.json
src/屏幕/披露偏好.tsx
src/屏幕/披露偏好.test.tsx
e2e/数据源模式.spec.ts
```

后端新增窄入口：

```text
apps/recruitment/scripts/browser-fixture.sh
apps/recruitment/scripts/tests/test-browser-fixture-source.sh
```

前端 package command：

```bash
AGXP_MONOREPO_DIR=/path/to/agxp-monorepo \
npm run test:agent-browser:backend-local

npm run test:agent-browser:backend-local -- --journey candidate-crud
npm run test:agent-browser:backend-local -- --headed
npm run test:agent-browser:backend-local -- --update-baseline
```

单旅程模式仍写出五个固定 journey fragment；未选旅程显式记为 `skipped`，只把已选择但缺失的 fragment 判为功能失败。视觉层同样只比较所选旅程对应的 scene，其他 scene 记为 `skipped`；已有基线模式下，所选 scene 缺 reference/candidate 是 `INFRA_BLOCKED`，首次 bootstrap 的所选 scene 才允许记为 `missing`。

固定退出码：

- `0`：功能和清理通过，视觉无 enforce 阻断；
- `1`：功能、清理或 enforce 视觉失败；
- `2`：usage/reporting error；
- `75`：环境阻塞。

## 17. 测试分层与运行频率

| 层 | 责任 |
|---|---|
| Vitest/unit/component | 映射、状态机、错误恢复、字段和组件细节 |
| intercepted Playwright `@backend` | 请求 shape、信封解码、ETag、幂等、错误分支 |
| 现有 Mock 视觉回归 | 16 个固定 Mock 场景和 PR 视觉门禁 |
| 后端 `recruitment-mobile-local` | 认证、BFF/API、隐私和底层资源生命周期 |
| 新 agent-browser 整栈验收 | 真实前后端连接、上层用户旅程、持久化 CRUD、真实数据 UI 漂移 |

新验收是本地、显式、慢速入口，适用于：

- 前后端接线或 DTO 映射变更完成后；
- 候选/招聘主要 CRUD 页面变更合入前；
- 发布候选形成时；
- 需要真实 UI 联调证据时。

它不进入普通 `npm test`，第一版不假定 GitHub hosted runner 能运行完整 Docker/Chrome 本地栈。只有后续具备稳定自托管 runner、连续运行时长和视觉噪声数据，才另行设计 CI 门禁。

后端仓库的 fixture script 变更必须按其 `GLOBAL_TEST_CASES.md` 在实施计划中精确选择 L0–L2 和 `recruitment-mobile-local` L3 责任；本设计不提前把 feature worktree 的正式 L3 写成 PASS。

## 18. 验收标准

第一版完成必须同时满足：

1. 一个命令能通过官方入口启动/复用健康的本地后端栈并以 `backend/local` 启动前端。
2. fixture converge 连续运行两次结果相同，不创建重复基准对象，不清理非 fixture 数据。
3. candidate/recruiter 两个 `agent-browser` session 真实登录且互相隔离。
4. 四条业务旅程可独立选择运行，并按本设计的上层断言完成真实加载和 CRUD 刷新回读。
5. 任何 Mock 回退、route mock、真实 API 零请求或跨身份数据泄漏都会失败。
6. 七个视觉场景在固定环境下生成 candidate/diff/report，基线只能显式更新。
7. 功能失败、视觉漂移、环境阻塞和清理失败有不同 verdict/exit code。
8. 成功和失败路径都关闭本次创建的浏览器/Vite；只停止本次启动的后端栈，并保留持久卷。
9. 报告和 artifacts 通过 secret/隐私检查，不包含 Cookie、OTP、body、HAR 或真实个人数据。
10. README 说明入口、前置、运行频率、视觉审批和明确非目标，不把本验收宣传成 AI/MatchCase 全生命周期覆盖。

## 19. 延后能力的重新评估条件

只有出现以下证据，才重新考虑扩展第一版：

- AI/匹配流程已有完全本地、确定性、无需真实模型的终态 fixture，才加入硬门；
- 至少积累一段连续稳定运行记录和 diff 噪声数据，才把视觉模式切到 `enforce`；
- 有稳定自托管 runner 且能独占 Docker/Chrome 资源，才接入 CI；
- 发现重要回归反复逃过四条旅程，才增加旅程或视觉场景；
- 两个以上真实用例需要共享描述格式，才考虑场景 DSL。

在这些证据出现前，保持四条旅程、七个视觉状态和一个整栈入口，避免提前增加测试基础设施。
