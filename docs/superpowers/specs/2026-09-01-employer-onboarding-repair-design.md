# Employer Onboarding 真实后端修复设计

**日期：** 2026-09-01
**状态：** 待用户书面批准
**目标仓库：** `agxp-a2a-recruiting-web`

## 1. 背景与失败事实

真实后端模式下，全新招聘方选择角色后会依次读取招聘方档案、企业关系、公开企业和岗位。当前实现把
`GET /api/v1/recruiter/profile` 的 `404 not_found` 当成整条组织水合失败，因此身份选择页不会进入招聘名片，
也不会继续读取 affiliations 和 jobs。重新登录看似能进入招聘端，只是因为应用仅凭
`last_used_role=recruiter` 直接跳到 `/hr`，并没有证明 onboarding 已完成。

即使用户进入招聘名片，Backend 分支也只在失焦时保存未认证公司声明，保存按钮没有首次创建 profile 的能力。
随后发布岗位时，当前映射会在隐藏的 `requirements` 为空时复制 `description`，而公司声明仍可能为空；真实
JobCreate 因此要么被 422 拒绝，要么把两个本应独立的字段错误合并。

仓库当前还存在三个相关的真实性问题：没有企业关系时公司档案长期显示 loading；企业设置硬编码“已认证”；
本地错误或服务端字段错误可能被显示成网络错误或机器码。viewport 同时禁用了浏览器缩放。

后端现有 profile 合同已经支持首次写入：

```http
PATCH /api/v1/recruiter/profile
If-Match: "0"
Content-Type: application/json

{"public_name":"林澈","title":"招聘负责人"}
```

成功响应返回完整 profile 和 `revision: 1`。本设计复用这条 PATCH CAS，不新增 POST，不等待后端改变 profile
语义，也不允许 Backend 失败后回退 Mock。

## 2. 目标与成功标准

本批次首先交付可立即实施的 P0 修复。成功时：

1. profile 的 `404 not_found` 被建模为合法“缺失”态，并继续读取 affiliations 和 jobs；401 统一清账号，
   其他错误诚实失败。
2. 恢复会话、选择招聘身份和直接进入招聘端都使用 profile 是否存在作为最小 onboarding 完成标记。
3. 全新招聘方可在不触发 blur 的情况下保存姓名、职务和公司声明；首次 profile 写入固定使用 PATCH 与
   `If-Match: "0"`。
4. 注册流首次名片保存成功后进入发布岗位；普通名片编辑不被强制送去发岗。
5. JobCreate 的公司名、职位描述和职位要求均为用户确认后的独立、trim 后非空文本。
6. 无可用企业关系、待选择关系、企业读取失败和权威企业档案被明确区分；设置页不再显示虚假认证。
7. 422 字段错误被本地化，本地校验不冒充网络失败；招聘端导出不出现“你的简历”。
8. 页面允许浏览器缩放，且静态合同测试禁止重新加入缩放限制。
9. 数据源模式 E2E 覆盖 profile 404 → revision 0 首写 → 完整岗位 POST → 刷新恢复 `/hr` 的完整链路。

另保留一个合同门控的后续能力范围，将全远程空办公地址和 JD PDF 建议稿导入合并为一个后续 Plan。它不阻塞
P0，也不会在后端合同未知时生成伪实现计划。

## 3. 架构选择与最小性

### 3.1 选择：服务端事实 + 显式水合状态

继续保持 profile、jobs、affiliations 和 organization 为权威事实。页面状态中的 profile 仍只保存成功返回的
DTO 或 `null`；生命周期放在 Backend 状态中，避免让一个 `null` 同时表示未请求、请求中、合法缺失和失败。

新增两个小型闭合状态：

```ts
export type 招聘方档案水合阶段 = '未开始' | '进行中' | '缺失' | '成功' | '失败';

export interface 招聘方组织水合状态 {
  阶段: '未开始' | '进行中' | '成功' | '失败';
  错误: string | null;
}
```

`后端状态` 增加：

```ts
招聘方档案水合阶段: 招聘方档案水合阶段;
招聘方组织水合: 招聘方组织水合状态;
```

档案阶段只描述 profile 资源；聚合组织状态描述
`profile → affiliations → current organization（如有）` 整条链。两者必须分开，因为 profile 合法缺失之后，
affiliations 或 organization 仍可能真实失败。路由只能在聚合组织状态成功后解释 profile 阶段，不能把后续失败
伪装成 onboarding。

这是满足路由正确性和公司档案四态所需的最小新增状态；不建立通用资源状态框架，不重构 P4/P5/P6/P7/P8
已有生命周期模型。

### 3.2 未选择的方案

- **只看 `招聘方档案 === null`：** 无法区分未请求、合法缺失和失败，正是当前故障来源。
- **只增加 profile phase：** profile 缺失后 affiliations 失败仍可能被路由误判为正常 onboarding，也无法驱动
  公司档案错误态。
- **以 jobs 是否为空判断 onboarding：** 用户删除全部岗位后会被错误送回首次流程。
- **新增 profile POST 或浏览器持久化 profile：** 与现有后端 PATCH CAS 和服务端权威边界冲突。

## 4. P0 详细设计

### 4.1 水合状态、错误和清理

进入招聘方组织水合前：

```text
招聘方档案水合阶段 = 进行中
招聘方组织水合 = { 阶段: 进行中, 错误: null }
```

profile GET 的分支固定为：

- 200：派发完整 profile，档案阶段设为成功。
- 仅 `error instanceof BFF错误 && status === 404 && code === 'not_found'`：派发 `null`，档案阶段设为缺失，
  不 reject，继续 affiliations。
- 401：档案阶段和聚合阶段不得残留失败；走现有统一账号清理，全部恢复到未开始。
- 其他错误：档案阶段设为失败，聚合阶段设为失败并保存用户可读错误；交互水合 reject，恢复水合保留现有提示，
  但路由不得把它当缺失。

affiliations 成功后沿用现有 `选择当前企业关系(affiliations, restoredId)`。无 current 时不读取公开企业，聚合
组织状态直接成功；有 current 时读取一次公开企业，成功后写入权威身份和企业档案，再把聚合状态设为成功。
affiliations 或公开企业失败把聚合状态设为失败。`重新水合招聘方组织()` 作为页面重试入口，从整条链开头重跑，
避免对半完成状态做局部猜测。

聚合组织状态成功后才读取 owner jobs。profile 合法缺失不阻止 jobs GET。交互式 `切身份('招聘方')` 在
profile 缺失且后续组织链、jobs 均成功时 resolve；真正的 500/503 仍 reject。

账号清理、401、登出、换主体、mount 主体转移和角色转移都必须把两个新状态恢复到未开始，清除错误字符串。
subject + generation fence 继续保护所有响应；过时响应不得改变任何阶段。

### 4.2 确定性 recruiter onboarding guard

应用不再仅在登录页凭 `last_used_role` 导航招聘端。Backend 初始化完成且已登录、当前角色为 recruiter 时，
等待聚合组织水合产生终态：

```text
组织水合成功 + profile 缺失 → replace 到 /hr/card，state={从注册流:true}
组织水合成功 + profile 成功 → replace 到 /hr
组织水合失败                 → 不伪装成 onboarding；保留真实错误
```

该判断同时保护恢复会话、身份选择后的导航和直接打开招聘端路由。这样切身份组件即使原本准备进入 `/hr`，
缺失 profile 也会由同一 guard 收口到招聘名片。candidate 和 `last_used_role=null` 的现有路由行为不变。

身份选择页成功选择招聘方时，显式以 `{ 从注册流: true }` 进入招聘名片；普通应用内“编辑招聘名片”不携带该
标记。应用恢复发现 profile 缺失时也携带该标记。不得用 timeout 等待水合。

### 4.3 profile 首写和名片保存

组织数据源继续只暴露：

```ts
保存招聘方档案(patch: BFF招聘方档案补丁, revision: number): Promise<BFF招聘方档案>;
```

显式 `revision=0` 与其他 revision 使用同一 PATCH 路径和 `If-Match: "0"`；不新增方法或 POST。

操作层选择 revision：

```text
档案阶段=缺失 且 profile=null → revision 0
档案阶段=成功 且 profile存在   → profile.revision
未开始/进行中/失败或状态矛盾   → client_validation 本地错误，不发请求
```

PATCH 成功后派发权威 profile，并把档案阶段设为成功。409/503/401 的既有处理边界不削弱。

Backend 招聘名片把未认证公司输入改成受控值，并在主体、权威声明变化时安全同步。保存顺序固定为：

```text
trim 姓名、职务、公司
→ 校验姓名
→ 无 verified current affiliation 时校验公司
→ 同步保存未认证公司声明
→ await 保存招聘方档案
→ 如有头像，使用 PATCH 响应 revision 上传头像
→ 从注册流进入发布岗位；否则显示成功提示并停留在招聘名片
```

空姓名提示“请填写姓名”；需要自由文本公司而为空时提示“请填写公司名称”。两种错误都不得发 mutation。
保存期间按钮禁用，handler 同时防重复调用。头像失败保留当前预览和文件供重试，不回滚已成功的 profile；
成功上传继续以响应 profile 为权威。

### 4.4 完整岗位合同

发布岗位第三步恢复独立、可访问名称为“职位要求”的 textarea。职位描述和职位要求是两个独立字段，不互相
复制。新建默认都为空；编辑从权威岗位分别恢复。

发布前设置三层保护：

1. 页面校验把空 description 带到第二步，把空 requirements、公司声明或办公地址带到第三步并显示字段文案；
2. `取发岗声明` 对选择后的企业名或未认证声明执行 trim，空值抛出明确 `client_validation` 错误；
3. `转岗位创建` 和 `转岗位补丁` 对 description、requirements 和 claim 使用 trim 后文本，空值拒绝生成请求。

创建合同必须满足：

```ts
hiring_organization_claim: { display_name: 非空trim文本, legal_name: null | 非空文本 };
description: 非空trim文本;
requirements: 非空trim文本;
```

Catalog 字段只使用用户选择的 `{id, display_name}` 中的 id。页面文本、模型建议或目录首项都不能制造 ID。
Plan 1 保持旧后端办公地址合同：remote、onsite、hybrid 暂时都要求非空地址；全远程空地址只属于后续 Plan。

### 4.5 公司档案五态与认证状态

公司档案清单和分区深链共享以下判定顺序：

1. 聚合组织水合进行中：显示“正在加载企业资料”。
2. 聚合组织水合失败：显示错误与“重试”，调用 `重新水合招聘方组织()`。
3. 没有任何可用 verified+active affiliation：显示说明，以及现有动作“申请成为企业管理员”“使用邀请加入企业”。
4. 存在多个可用 affiliation 但 current 为空：引导去招聘名片选择当前企业，不显示申请空态。
5. current 与权威企业档案存在：显示真实资料；仅 admin+verified+active 可编辑，其余只读。

不得创建合成 Organization，也不得把自由文本公司声明当成企业事实。

企业设置中的“企业实名认证”使用组织映射层纯函数，优先级固定为：

```text
current verified + active affiliation → 已认证
latest admin request pending          → 审核中
latest admin request rejected         → 已拒绝
cancelled request                     → 已撤销
存在 revoked affiliation              → 已解除
其余                                  → 未认证
```

这行描述的是企业关系/申请状态，不用个人 profile 的二态 `personal_verification_status` 代替，也不读取
`未认证公司声明`。

### 4.6 错误、本地化文案与缩放

HTTP 客户端继续完整解析并保留有序 `fieldErrors`。通用错误文案规则调整为：

- 只有 `BFF错误.code === 'network_error'` 才显示网络连接失败；
- `client_validation` 显示它自己的可行动 message；
- 普通本地 `Error` 显示明确 message，不改写成网络失败；
- `validation_failed` 不再直接展示第一个机器 reason，默认显示“填写内容未通过校验”；
- 其他 BFF 状态沿用现有 401、409、502/503/504 和 invalid_response 映射。

发布岗位页面把已知字段 path 与已知 required/blank 类 reason 组合映射为：

```text
hiring_organization_claim.display_name → 请填写公司名称
office_location                         → 请填写办公地点
description                             → 请填写职位描述
requirements                            → 请填写职位要求
未知 path/reason                        → 请检查岗位信息
```

页面可归一化点路径和 JSON Pointer 形式，但不得把未知 reason 原样显示。开发环境用原错误对象输出诊断，生产
用户只看到本地化文案。

账号导出文案统一为中性的“账号资料与业务记录”，适用于两种角色。viewport 固定为：

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

同步修改 README 中“禁缩放”的陈旧说明。新增独立静态测试，断言 index.html 不包含
`user-scalable=no`、`maximum-scale=1` 或 `minimum-scale=1`。

## 5. 测试设计

### 5.1 单元与组件测试

测试按 Task 执行 RED → GREEN，并覆盖：

- profile 404 合法缺失、继续 affiliations/jobs、无 current 不读公开企业；
- profile 401 统一清理、500/503 失败、subject/generation stale 响应不提交；
- 新状态在账号、主体和角色边界回未开始；
- revision 0 PATCH、已有 revision CAS、非法阶段零请求；
- 缺失/成功/失败三种恢复路由，以及直接招聘路由 guard；
- 名片不 blur 保存、空姓名/公司、busy、注册流与普通编辑、头像 revision 串联；
- 独立 requirements 输入和三层非空保护；
- 创建/补丁 body 三个关键文本均已 trim 且非空；
- 公司档案加载、失败、无关系、待选择、权威资料五态与分区深链；
- 企业认证优先级纯函数；
- fieldErrors 保留、本地错误不冒充网络、发布字段本地化；
- 中性导出文案和 viewport 静态合同。

当前 `src/应用.test.tsx` 不存在，需要创建；`src/屏幕/岗位详情.test.tsx` 和
`src/屏幕/企业设置.test.tsx` 已存在。viewport 测试新建为 `src/配置/viewport合同.test.ts`。

### 5.2 数据源模式 E2E

`e2e/数据源模式.spec.ts` 增加可变新招聘方 fixture：

```text
首次 GET /recruiter/profile → 404 not_found
PATCH /recruiter/profile + If-Match:"0" → 200 revision 1
后续 GET /recruiter/profile → 200 revision 1
GET affiliations → []
GET jobs 初始 → []
POST jobs → 校验完整 body，返回 201，并写入可变岗位集合
```

完整场景从身份选择使用真实页面和数据源方法，不 mock `操作.发布岗位`：

```text
选择招聘方
→ profile 404 仍进入招聘名片
→ 输入姓名、职务、公司，不 blur 直接保存
→ 断言 PATCH + If-Match:"0"
→ 进入发岗，分别填写 description 与 requirements
→ 拦截并检查 JobCreate 三个关键文本非空
→ 返回 201，检查水合后的岗位
→ 刷新，profile 已存在，恢复进入 /hr
```

`e2e/onboarding.spec.ts` 和现有 helper 同步恢复 requirements 输入，删除“职位要求已删”的旧假设。

### 5.3 验证边界

Task 内使用定向 Vitest 命令。Plan 1 唯一 authoritative plan-scope gate 为 `npm test`；仓库没有正式
affected selector，因此不同时追加另一条等价 broad gate。随后运行：

```bash
npm run typecheck
npm run lint
npm run build
npm run test:e2e:data-source -- --grep "新招聘方 onboarding"
```

数据源模式 Playwright 是 intercepted integration，不是真实 BFF。真实后端 smoke 作为条件集成交接：只有本地后端、
fixture 账号和 OTP 前置可用时运行对应 recruiter onboarding/CRUD 旅程；不可用时记录 `ENV_BLOCKED` 或
`NOT RUN` 及原因，不能用 intercepted fixture 冒充真实联调 PASS。

规划时仓库依赖尚未安装，基线定向测试曾以 exit 127 结束，诊断为 `vitest: command not found`；这不是产品
失败。执行 Plan 前必须安装锁文件规定的依赖，再取得有效 RED/GREEN evidence。

## 6. 后续合同门控 Plan：remote 地址 + JD 导入

这两个能力合并为一个后续 Plan，并依赖 P0 Plan。只有以下两项都可核验时才写零上下文实施计划：

1. 后端 OpenAPI、实现 commit 和合同测试明确 `workplace_mode=remote` 时 `office_location` 可为空，
   onsite/hybrid 时非空；
2. JD 导入 OpenAPI、实现 commit 和合同测试明确 multipart 创建任务、GET 状态、终态 DTO、错误码、限制和缓存策略。

### 6.1 remote 行为边界

- 选择 remote 立即清空地址并隐藏或禁用输入；
- remote 提交 `office_location: ""`；
- 切回 onsite/hybrid 必须重新填写，不恢复已清除的旧值；
- 岗位详情在 remote + 空地址时不渲染空分隔符；
- 新建和编辑均覆盖 workplace 两个方向的切换。

### 6.2 JD 建议稿边界

- 发布岗位首屏提供 PDF 上传、明确模型处理同意和“手动填写”；
- multipart 创建导入任务，轮询到 succeeded/failed；离页只停止前端轮询，不伪造服务端取消；
- 结果只填入 title、description、requirements、workplace 等自由文本或合法枚举建议；
- Catalog 建议只展示文字，用户必须选择真实 `{id, display_name}`；不得猜 ID 或自动选首项；
- 不自动发布，用户必须逐步确认并点击发布；
- 上传、解析或部分字段失败都保留手填路径；Backend 失败不回退 Mock；
- PDF 字节、全文、模型响应和导入结果不进入 localStorage/sessionStorage。

合同到齐前不冻结端点、DTO、轮询间隔、重试策略或错误码。任一未知项都要求回到本 Spec 的规划 owner 校准，
不得留给执行 Agent 现场设计。合并 Plan 的代价是其中一份后端合同先到时也不提前执行半个 Plan；这是用户明确
接受的串行门。

## 7. 非目标

- 不新增 profile POST，不改变后端 profile 404 语义。
- 不以岗位数量、企业声明或本地缓存判断 onboarding 完成。
- 不创建合成 Organization，不让未认证公司声明获得认证含义。
- 不削弱 BFF JobCreate、Catalog 或 CAS 合同。
- P0 不放宽 remote 地址，不添加 provisional JD 导入 DTO/UI。
- 不引入通用状态机、表单框架、错误国际化框架或无关重构。
- 不改变 Mock 产品流程，除恢复独立职位要求、导出中性文案和允许缩放这些明确的跨模式行为。

## 8. 未来重新考虑条件

- 只有后端提供显式 onboarding/completion 字段时，才重新考虑用 profile 存在性作为完成标记。
- 只有产品要求跨设备保留未认证公司声明，且后端提供对应账号字段时，才迁移当前账号作用域本地状态。
- 只有多个表单出现相同结构化字段错误需求并产生重复维护证据时，才考虑通用字段错误框架。
- 只有 remote 和 JD 两份合同均满足第 6 节前置，才生成合并后续 Plan。

## 9. 实施拓扑与分级

### Plan 1：即时 P0

预计 7 个顶层实现 Task，顺序为：

1. 水合状态与组织链；
2. profile 首写与路由 guard；
3. 招聘名片受控保存；
4. 完整岗位合同；
5. 组织空态与认证状态；
6. 错误、导出文案与 viewport；
7. 新招聘方数据源 E2E 与基本验证。

最后追加一个 `Terminal Integration Task`。本 Plan 内不做 Task 级并行，因为多个 Task 共享水合状态、
`招聘名片.tsx`、`发布岗位.tsx` 和数据源 fixture；串行执行能避免用临时接口制造返工。

- **计划本身复杂度：高。** 跨越会话、路由、组织、岗位和错误呈现，并包含完整 onboarding E2E。
- **零上下文漂移风险：中。** 当前代码和 P0 合同可核验，未知后端能力已移出，但多个既有状态边界仍要求严格
  遵守本文接口。
- **执行模型档位：Top 5–10 中高性价比模型。** 仅由中等漂移风险决定。

### Plan 2：合同门控增强

当前只冻结范围与准入条件，不生成 Implementation Plan。两份后端合同到齐后重新校准并单独 review。

- **预计计划本身复杂度：高。** 同时包含 workplace 编辑迁移和异步 PDF 导入。
- **预计零上下文漂移风险：高，直至合同到齐。** 因端点、DTO、错误和轮询语义尚不可核验；合同冻结后重新评级。
- **当前执行模型档位：不适用。** 未形成可执行 Plan。

## 10. 完成定义与交付证据

P0 完成必须同时满足：

- 批准范围产品代码和测试已提交，worktree 无意外改动；
- 每个 Task 有先失败后通过的定向测试证据；
- 异构 code review 的 required findings 已处理；
- `npm test`、typecheck、lint、build 和指定 data-source E2E 有命令、退出码与 commit 对应关系；
- 未运行的真实后端 E2E 明确写 `NOT RUN`/`ENV_BLOCKED` 及原因；
- 最终报告列出修改文件、commit SHA、每条验证命令和退出码；
- 新招聘方 profile 404、revision 0 PATCH、无 blur 公司保存、独立 requirements、完整 JobCreate、刷新恢复、
  公司空态、认证状态、导出文案和缩放合同全部有可核验证据。
