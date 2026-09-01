# Employer Onboarding 真实后端修复设计

**日期：** 2026-09-01
**状态：** 已确认，待实施
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

另保留一个实现门控的后续能力范围，将全远程空办公地址和 JD PDF 建议稿导入合并为一个后续 Plan。后端设计
合同已由 `agxp-backend` 的
`docs/superpowers/specs/2026-09-01-recruitment-employer-onboarding-backend-fixes-design.md`
（commit `2b19cf230f3dd8c7176f2316d7eb576fbf74f46c`）冻结；该 Plan 不阻塞 P0，但在对应后端 OpenAPI、实现和合同测试
合并并提供可核验 commit 前不得执行。

### 2.1 与前序候选人 onboarding 分支的串行边界

前序前端工作为 `fix/candidate-onboarding-backend-persist`，冻结文档是：

```text
docs/superpowers/specs/2026-09-01-candidate-onboarding-backend-repair-design.md
docs/superpowers/plans/2026-09-01-candidate-onboarding-backend-repair.md
reviewed document HEAD: db9ee9c7
execution prompt HEAD: 6b480862
```

该分支在本设计确认时尚未提交产品实现。它与招聘方 P0 会共同修改
`src/数据/HTTP客户端.ts`、`src/数据/后端映射.ts`、`src/状态/应用状态.tsx`、相关测试以及
`e2e/数据源模式.spec.ts`，因此两个实现不能从各自旧基线独立完成后再盲合并。执行顺序冻结为：

```text
候选人 onboarding 实现 commit
→ 合入招聘方执行 worktree
→ 校准本 Plan 对共享文件的行号和局部上下文
→ 执行招聘方 P0
→ 后端 remote + JD 实现 handoff
→ 执行合并增强 Plan
```

招聘方 P0 消费前序分支的以下产物契约，不重新实现或回滚：

- 复用 `客户端校验错误(field, message)`；本地错误继续由 `取后端错误文案` 返回自身可行动 message。招聘方
  页面只在自己的 Job 表单内把 BFF `fieldErrors` 映射为字段文案，不把候选人页面改回机器 reason；
- 保留 `必需引用(value, label, field)` 和岗位 Catalog call site 的稳定 field 名；招聘方新增的公司、描述、
  要求非空校验是额外文本合同，不得削弱目录引用校验；
- 保留 candidate-only、subject-scoped sessionStorage 草稿、恢复写屏障和清理时序。招聘方 profile/组织水合
  阶段只进入 Backend runtime state，不写候选草稿 codec，也不让 recruiter 状态授权 candidate storage；
- 保留 `VITE_ANNOTATION_ENABLED` 及设备外评审布局。viewport 修复只修改缩放合同，不恢复默认标注入口；
- 保留候选人可变 fixture 和 `@annotation` 场景。招聘方 E2E 使用独立 fixture option、独立可变对象和独立测试
  标题，不能共享或重置候选 fixture。

前序实现 Handoff 必须给出可解析 commit、干净 worktree、共享文件实际 diff 和验证结果。若实际实现改变上述
接口、文件路径、清理时序或 E2E fixture 入口，本 Plan 在写产品代码前停止并回到规划 owner 校准；纯行号漂移、
import 排序或保持接口的内部变化可机械调整，不构成重新设计。

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
组织水合失败                 → 登录/受保护招聘路径显示真实错误与“重试”，不伪装成 onboarding
```

缺失 profile 的 guard 只拦登录路径和需要完成 onboarding 才能使用的 `/hr` 业务路径。`/account`、`/identity`、
`/hr/card`、`/hr/organization-application` 与 `/hr/organization-invitation` 是恢复/退出路径，必须放行，避免用户
被锁在名片页而无法退出、换角色或建立企业关系；`/hr/verify` 也是可达这两个企业关系动作的恢复入口，必须放行。
组织水合失败时登录路径或受保护招聘路径渲染一个显式恢复面，依次重跑组织链和 owner jobs；恢复面同时提供
“切换身份”，持续故障不能把用户锁死。重试成功后由同一 guard 导航或恢复当前路径。candidate 和任何非
candidate/recruiter 的角色值继续回落身份选择页。

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
3. `转岗位创建` 对 description、requirements 和创建上下文里的 claim 使用 trim 后文本，空值拒绝生成请求；
   `转岗位补丁` 保持既有两参签名与服务端 previous claim，只对用户可编辑的 description、requirements 做同一
   非空保护，不让用户无法修正的历史 claim 阻断普通岗位编辑。

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
- 普通本地 `Error` 显示通用“请求失败，请稍后再试”，不改写成网络失败，也不把内部异常文本直接交给用户；
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
- 缺失/成功恢复路由、失败恢复面与重试，以及直接招聘路由 guard 的恢复路径白名单；
- 名片不 blur 保存、空姓名/公司、busy、注册流与普通编辑、头像 revision 串联；
- 独立 requirements 输入和三层非空保护；
- 创建 body 的 claim/description/requirements 均已 trim 且非空，补丁的 description/requirements 独立非空；
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

职位要求 textarea 是预期 UI 变化。终局验证另以 `UI_VISUAL_GATE=report` 运行 `npm run ui:check`，审查
`recruiter-post-job-3` 的 reference/candidate/diff 产物并记录人工 verdict；本仓库的 UI 门禁按 base 动态采集，
不提交一份伪造的静态基线，也不使用标签跳过结构/API/基础设施错误。

数据源模式 Playwright 是 intercepted integration，不是真实 BFF。真实后端 smoke 作为条件集成交接：只有本地后端、
fixture 账号和 OTP 前置可用时运行对应 recruiter onboarding/CRUD 旅程；不可用时记录 `ENV_BLOCKED` 或
`NOT RUN` 及原因，不能用 intercepted fixture 冒充真实联调 PASS。

规划时仓库依赖尚未安装，基线定向测试曾以 exit 127 结束，诊断为 `vitest: command not found`；这不是产品
失败。执行 Plan 前必须安装锁文件规定的依赖，再取得有效 RED/GREEN evidence。

## 6. 后续实现门控 Plan：remote 地址 + JD 导入

这两个能力按用户决定合并为一个后续 Plan，并依赖 P0 Plan。后端设计合同已冻结，本节据此冻结前端 wire contract
和交互边界；它不是后端能力已经部署的证据。只有以下两项在同一个后端 handoff 中都可核验时，才生成并执行
零上下文 Implementation Plan：

1. 两份 OpenAPI、后端实现 commit 和合同测试已经落地
   `workplace_mode=remote` 时 `office_location` 可为空、onsite/hybrid 时非空；
2. 两份 OpenAPI、后端实现 commit 和合同测试已经落地本节的 JD multipart、投影、错误与保留合同。

若实现 commit 与后端设计 commit 不一致，先回到本 Spec 的规划 owner 做一次合同 diff；执行 Agent 不自行猜测。

### 6.1 remote 行为边界

- 选择 remote 立即清空地址并隐藏或禁用输入；
- remote 提交 `office_location: ""`；
- 切回 onsite/hybrid 必须重新填写，不恢复已清除的旧值；
- 岗位详情在 remote + 空地址时不渲染空分隔符；
- 新建和编辑均覆盖 workplace 两个方向的切换。

这是一组比后端更窄、但完全合法的前端行为。后端 wire shape 继续把 `office_location` 保留为 required string，
数据库也继续非 null；remote 的全空白值由后端规范为 `""`，remote 非空地址仍允许且最多 300 rune。
onsite/hybrid 的空白地址稳定返回 field error
`path="office_location", reason="must_not_be_blank"`。更新是 sparse patch，但后端以合并后的最终
`workplace_mode + office_location` 组合校验；失败不写入也不 bump revision。前端编辑页仍显式发送两字段，
remote 切换必须显式发送空地址，不能依赖省略字段清除旧值。

### 6.2 JD public wire contract

浏览器只调用 public BFF：

```http
POST /api/v1/recruiter/job-draft-imports
Content-Type: multipart/form-data
Idempotency-Key: <一次上传意图的一把稳定键>

file=<恰好一个 application/pdf>
processing_consent_confirmed=true
```

`processing_consent_confirmed` 是恰好一个文本 part，值必须是字面量 `true`。数据源传 `FormData`，不得手工写
multipart `Content-Type`，由浏览器生成 boundary。成功为 `202 { result: JobDraftImport }`。查询固定为：

```http
GET /api/v1/recruiter/job-draft-imports/{import_id}
-> 200 { result: JobDraftImport }
```

POST 的 202 投影必须是 pending 且不带 suggestion/failure code；GET 使用现有“不缓存”请求选项，避免轮询读到
浏览器缓存。

Public DTO 冻结为：

```ts
type JobDraftImport = {
  import_id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  failure_code?:
    | 'invalid_pdf'
    | 'document_too_complex'
    | 'parser_invalid_output'
    | 'parser_temporarily_unavailable';
  suggestion?: JobDraftSuggestion;
  created_at: string;
  updated_at: string;
};

type JobDraftSuggestion = {
  title: string | null;
  recruitment_type:
    | 'social_full_time' | 'campus' | 'internship' | 'part_time' | null;
  workplace_mode: 'onsite' | 'hybrid' | 'remote' | null;
  office_location: string | null;
  description: string | null;
  requirements: string | null;
  education_requirement:
    | 'none' | 'associate' | 'bachelor' | 'master' | 'doctorate' | null;
  experience_requirement:
    | 'none' | 'one_to_three_years' | 'three_to_five_years'
    | 'five_plus_years' | 'ten_plus_years' | null;
  category_source_name: string | null;
  location_source_name: string | null;
  keywords: string[];
};
```

解码必须验证状态分支：pending/processing 不带 suggestion/failure code；failed 只带闭合 failure code；
succeeded 只带 suggestion。建议稿所有 key 都存在，未知标量用 `null`，`keywords` 始终是数组；未知枚举、
额外字段或非法分支按 `invalid_response` 诚实失败，不能尽力猜测。

### 6.3 JD 前端状态、幂等和轮询

- 发布岗位首屏提供 PDF 上传、明确模型处理同意和“手动填写”；
- 未同意、未选文件或文件 `type !== 'application/pdf'` 时本地拒绝且零请求；大小、页数和 PDF 结构仍由后端
  权威校验，前端提示不能替代后端约束；
- 同一上传意图在内存中保存不可变的 File 引用、`consent=true` 和一把 `crypto.randomUUID()` 幂等键。网络结果
  未知、503 或 `upload_in_progress` 后重试同一文件时复用该键；用户更换文件或明确重新开始才生成新键。绝不
  用同一键配不同文件，也不把 raw key 写入浏览器持久化或日志；
- 同 subject + 同 key + 同文件的顺序重放必须接受同一个 import；同 key + 不同文件按冲突呈现；不同 key 即使
  文件相同也视为新的导入。前端不做跨 key 文件去重；
- POST 回包立即成为当前权威 import；pending/processing 使用 settle 后 2 秒的单飞 `setTimeout` 轮询，禁止
  重叠 GET。页面 hidden 时停排，重新 visible 立即读一次；subject、角色、import ID 变化或组件卸载时作废旧
  generation，并停止后续调度；
- 单次 network/500/503 查询失败保留最后状态并继续下一拍，连续 5 次后暂停自动轮询、显示“暂时无法获取解析
  进度”和手动重试；401 沿用统一账号清理；
- succeeded/failed、404 或离页都停轮询。GET 的 missing、foreign、24 小时 expired 均为
  `404 job_draft_import_not_found`；页面显示“建议稿已失效，请重新上传”，清除当前 import 引用但保留用户已填
  的手工表单内容；
- 离页只停止前端轮询，不调用不存在的服务端 cancel。刷新后也不恢复 import：后端没有 list/recovery API，且
  浏览器不得持久化 import ID、文件、正文、模型响应或建议稿；
- failed 按闭合 `failure_code` 显示可行动文案并保留手填路径；不得把解析失败冒充网络失败。

### 6.4 建议稿应用边界

- succeeded 后先展示建议稿，由用户点击“应用建议稿”后才把非 null 值写入仍为空的表单字段；已手填字段不被
  覆盖，用户可从预览中自行采用不同内容。解析完成和应用动作都不得触发 Job mutation；
- 可应用字段为 title、recruitment type、workplace mode、office location、description、requirements、
  education requirement 和 experience requirement；用户应用后仍可逐项编辑；
- 建议为 remote 时按前端 remote 规则忽略 suggestion 的非空 office location 并清空地址；onsite/hybrid
  可填入非 null 地址，但最终仍走发布前校验；
- Catalog 建议只展示文字，用户必须选择真实 `{id, display_name}`；不得猜 ID 或自动选首项；
- `keywords` 按 wire contract 严格解码，但当前发布页没有已批准的关键词编辑入口，因此本次不暗中回填或随
  JobCreate 提交；若以后恢复关键词 UI，再以单独产品变更决定如何应用；
- 不自动发布，用户必须逐步确认并点击发布；
- 上传、解析或部分字段失败都保留手填路径；Backend 失败不回退 Mock；
- PDF 字节、全文、模型响应和导入结果不进入 localStorage/sessionStorage。

### 6.5 错误映射和前后端责任

POST 同步错误按稳定 code 映射：

```text
processing_consent_required                → 请先同意模型处理这份 JD
invalid_request_body                       → 上传请求无效，请重新选择文件
invalid_pdf                                → 请选择有效的 PDF 文件
document_too_complex                       → PDF 页数或结构超出处理范围，请精简后重试
job_draft_import_too_large                 → PDF 文件过大，请压缩后重试
idempotency_conflict                       → 上传内容已变化，请重新选择文件
upload_in_progress                         → 文件仍在上传处理中，保留同一意图稍后重试
parser_invalid_output                      → 未能生成有效建议稿，请手动填写或重新上传
parser_temporarily_unavailable             → 解析服务暂时不可用，请稍后重试或手动填写
role_required / role_suspended             → 沿用招聘方角色错误处理
未知 400 / 409 / 500 / 503                 → 通用安全文案，不显示内部 message
```

后端负责 workplace 组合校验、multipart/PDF 安全校验、owner 隔离、幂等、异步 worker、建议 schema、加密、
24 小时清理、账号删除和日志/导出隐私；这些不在浏览器重复实现。前端负责精确请求形状、闭合响应解码、在内存
持有同一上传意图、轮询生命周期、错误文案、建议稿显式应用、Catalog 不猜 ID、不自动发布和零浏览器持久化。

前端单元/组件测试覆盖 FormData part/header、幂等键复用与换键、各 DTO 分支、单飞轮询/visibility/unmount/
stale generation、错误映射、建议应用和 Catalog/keyword 边界。数据源模式 E2E 拦截真实 public POST/GET 并
覆盖 pending → processing → succeeded，断言没有 Job POST，直到用户完成表单并点击发布。后端 hermetic
PDF、store/worker、加密/清理、role/owner、OpenAPI 和正式 L3 由后端仓库负责；前端不得用拦截 E2E 冒充该
后端证据。

合并 Plan 的代价是其中一份后端实现先到时也不提前执行半个 Plan；这是用户明确接受的串行门。

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
- 只有 remote 和 JD 两份后端实现均满足第 6 节 handoff 前置，才生成合并后续 Plan；设计合同本身已冻结。

## 9. 实施拓扑与分级

### Plan 1：即时 P0

这是前序候选人 onboarding 实现的串行下游。执行基线必须包含其最终实现 commit；不得直接在当前仅含文档的
`fix-recruiter-onboarding-frontend` HEAD 上启动产品修改。前序产物保持第 2.1 节契约时，Plan 只做机械上下文
校准；发生契约漂移则先修订并重新 review Plan。

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

当前已冻结设计合同、范围与准入条件，不生成 Implementation Plan。两份后端实现、OpenAPI 与合同测试到齐后，
按实际 handoff commit 做一次 diff，再单独规划和 review。

- **预计计划本身复杂度：高。** 同时包含 workplace 编辑迁移和异步 PDF 导入。
- **预计零上下文漂移风险：中高，直至实现 handoff 到齐。** 端点、DTO、错误和前端轮询语义已经冻结，剩余风险
  来自跨仓实现/OpenAPI 是否与设计一致及异步 UI 生命周期；handoff diff 后重新评级。
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
