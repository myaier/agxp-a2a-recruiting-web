# Recruitment“我”与设置前端权威接线设计

**日期：** 2026-09-02

**状态：** 设计已批准；实施 Plan 等待后端三份 Me/Settings Plan 完成并冻结 Handoff

**范围：** `myaier/agxp-a2a-recruiting-web` 的求职侧和用人侧“我”、个人资料、账号设置、认证摘要、公司资料、AI 代理设置、登录水合与相关共享状态

**上游合同：** AGXP 后端仓库 `docs/superpowers/specs/2026-09-01-recruitment-me-settings-missing-capabilities-design.md` 及配套 Plans 01/02/03

## 1. 背景

Backend 模式已经接通 P3/P4/P5/P6/P8 的主要读取和写入，但“我”与设置相关页面仍同时消费两套事实：服务端 owner 快照与早期 Mock/legacy 状态。由此产生以下错误：

- Backend seed 继承演示 MatchCase、候选和归档数组，两端“我”页显示虚构统计；
- 交互式短信登录只读取主体，不调用公共角色水合，刷新前角色资源停在未开始；
- candidate/recruiter 认证状态由硬编码或非权威字段推断；
- recruiter profile 的合法 404 没有稳定建模为首次创建；
- candidate contact events 页面无条件显示 Mock 公司；
- candidate 手机、email、WeChat、头像和 Agent 偏好存在本地假保存；
- 0 affiliation 等合法缺失态被误判为永久 loading；
- 若干固定文案暗示了不存在的合同或错误角色数据。

后端正在新增四组窄 owner 资源：candidate contact events、candidate account profile/avatar、Identity email/WeChat credential 能力、candidate/recruiter role agent settings。本前端设计直接消费这些最终合同，不引入临时兼容 API，也不修改 BFF。

## 2. 目标与成功标准

### 2.1 目标

1. Backend 模式的所有统计、身份、联系方式、头像、组织和 Agent 设置只来自权威资源。
2. 短信登录完成后在进入主壳前完成当前角色的公共水合，不要求刷新。
3. Mock 与 Backend 在状态、持久化和错误路径上完全隔离。
4. 新资源遵守现有 subject/role/session generation fence、CAS、幂等和失败关闭纪律。
5. 保持现有页面样式零像素变化。

### 2.2 可核对成功标准

- 0 P5 case 的 candidate/recruiter “我”页统计均为 0，不出现 `8/1/5/3`、`5/2` 或 `186`；
- 交互登录后 candidate/recruiter 角色资源已结算，根路由是唯一导航 owner；
- contact events、avatar、credentials 和 role agent settings 刷新、换设备和重登后保持；
- recruiter profile 缺失可用 `If-Match: "0"` 首写；
- 0 affiliation、pending、revoked、suspended、member 和 admin 各有诚实状态；
- Backend 不显示 Mock 姓名、联系方式、企业、接触记录或统计；
- Mock 模式现有 fixture 和交互不回归；
- 实施 diff 不包含 CSS 变更，登录页不增加邮箱登录或任何新控件。

## 3. 冻结约束与非目标

### 3.1 零像素约束

本轮不得：

- 修改 `.css`、`.module.css` 或全局样式文件；
- 新增、删除或隐藏常驻页面行、按钮、图标或布局容器；
- 改变尺寸、间距、字号、颜色、圆角、DOM 排布或交互入口位置；
- 通过更新视觉基线掩盖布局变化。

允许替换权威数据、动态文字、加载/失败状态和事件处理器。企业端“发送内部版 JD”现有行保留原尺寸和位置；Backend 模式点击只解释该项没有可配置合同，不修改任何状态。Mock 模式保持原演示行为。

### 3.2 不增加邮箱登录

登录页的手机号输入、四位验证码、按钮、文案和布局保持现状。生产微信按钮改接真实 OAuth；本轮不在登录页暴露 email OTP 登录。Email credential 仅通过个人信息页现有“邮箱”行绑定、回读和解绑。

### 3.3 其它非目标

- 不创建统一 `/me/settings` 前端聚合 owner；
- 不把 role agent settings 存为 P6 Rule；
- 不新增候选实名合同，phone OTP、简历姓名和头像均不等价于实名；
- 不新增 recruiter “内部版 JD”后端字段；
- 不修改已正常接通的 P3 隐私、organization ID block、P4 discovery、P5 详情命令、P6 自定义规则、P7 真人会话和 P8 导出/注销语义；
- 不修改后端仓库或 BFF。

## 4. 架构选择

采用按资源 owner 扩展现有状态域的方案：

- P5 继续持有 MatchCase 原始 scope 快照，并提供角色级统计 selector；
- 新建窄的“我与设置”数据源和后端操作域，管理 contact events、candidate account profile/avatar 和 role agent settings；
- Identity credentials 继续归现有 P8 subject-scoped 控制面；
- Resume 姓名、P3 privacy、recruiter profile 和 organization 保留各自 owner；
- 页面只消费权威快照和 selector，不自行拼 URL、revision、幂等键或跨 owner 写入。

拒绝页面本地 fetch：它会复制请求、破坏跨页面一致性并绕开 session fence。也拒绝统一大 Profile：它会把 Resume、Recruitment 和 Identity 的 revision/error 语义错误揉成前端分布式事务。

## 5. 数据源合同

### 5.1 新的窄数据源模块

新增 `src/数据/招聘数据源/我与设置.ts`，由 `HTTP招聘数据源` 组合暴露业务方法。该模块严格解码 exact key set、闭合枚举、RFC3339、opaque ID、cursor 和 revision。

#### Candidate contact events

```text
GET /api/v1/me/contact-events?limit=50[&cursor=...]
```

响应包含 `items` 与 `next_cursor`。Action 仅接受：

```text
anonymous_profile_viewed
contact_started
submitted_resume_viewed
```

前端映射到现有中文标签“查看匿名画像”“发起接触”“递交简历后查看”。公司首字从服务端 event-time `display_name` 计算；不接受 recruiter PII 或访问细节字段。

#### Candidate account profile/avatar

```text
GET    /api/v1/me/account-profile
POST   /api/v1/me/avatar
DELETE /api/v1/me/avatar
GET    /api/v1/me/avatar/content
```

GET 无行时必须返回 `{avatar_url:null, revision:0, updated_at:null}`，404 是合同错误。`avatar_url` 只接受 `null` 或固定同源 `/api/v1/me/avatar/content`。

上传使用当前 revision、`If-Match`、`Idempotency-Key` 和恰好一个名为 `media` 的 multipart part。前端不把文件内容写入 React 全局状态、localStorage 或 sessionStorage。删除合同进入操作层能力，但由于现有 UI 没有删除入口，本轮不新增可见控件。

#### Role agent settings

```text
GET/PATCH /api/v1/me/agent-settings
GET/PATCH /api/v1/recruiter/agent-settings
```

Candidate DTO：

```json
{
  "material_submission": "ask_first",
  "out_of_authority_concession": "ask_first",
  "revision": 0,
  "updated_at": null
}
```

Recruiter DTO：

```json
{
  "out_of_authority_concession": "ask_first",
  "revision": 0,
  "updated_at": null
}
```

闭合枚举：

```text
candidate.material_submission: ask_first | auto_send
candidate.out_of_authority_concession: ask_first | reject
recruiter.out_of_authority_concession: ask_first | reject
```

默认值必须由 GET 返回，客户端不得猜 revision 0 默认对象。PATCH 是 sparse patch，至少一个合法字段，并携带当前 `If-Match` 与稳定 `Idempotency-Key`。

### 5.2 P8 credentials 扩展

现有 credential provider union 保持：

```text
phone_otp | email_otp | wechat
```

复用既有路径：

```text
POST   /api/v1/me/credential-link-attempts
POST   /api/v1/me/credential-link-attempts/{attempt_id}/complete
GET    /api/v1/me/credentials
DELETE /api/v1/me/credentials/{credential_id}
```

- Phone 只使用 replacement begin/complete，不允许通用 unlink；
- Email 从个人信息页现有邮箱行发起 OTP link；
- WeChat 从个人信息页现有微信行发起 redirect link；
- unlink 只用于 `email_otp | wechat`，成功后权威重读 credentials；
- 服务端 `display` 原样上屏，前端不二次掩码；
- production WeChat 只接受固定 HTTPS host/path/query allowlist，不发送 Mock openid。

后端 link callback 固定跳 `/settings/security`，而应用使用 `HashRouter`。入口只对这个固定 pathname 做一次安全归一化并进入 `/#/account`；不接受 caller 提供的任意 redirect target。

## 6. Backend 状态模型

### 6.1 新域快照

`后端状态` 增加：

- candidate contact events 分页快照：phase、refreshing、items、nextCursor、已加载页数、error、generation；
- candidate account profile 资源快照：phase、refreshing、data、error、generation；
- candidate/recruiter agent settings 独立资源快照：phase、refreshing、data、error、generation。

资源阶段遵循：

```text
idle → loading → success
               ↘ error
success → refreshing → success / error-with-stale-data
```

首次加载不能展示旧数据。刷新保持上一份权威快照；刷新失败保留旧数据并记录可重试错误。

### 6.2 Legacy 状态隔离

Backend seed 必须显式清空：

- `在谈列表`；
- `企业候选列表`；
- `归档列表`；
- `企业归档列表`；
- 与这些演示对象关联的决策/缓存。

同一清理底座用于登出、当前会话 401、换 subject 和切角色。Backend 页面不得读取 legacy 切片兜底；Mock reducer 和持久化保持不变。

### 6.3 运行时 fence

新域请求发送前捕获：

```text
subject_id
last_used_role
session generation
resource generation
scope key
```

响应提交时全部仍匹配才允许写入。迟到的成功、失败和 401 只释放本轮锁，不修改新会话。清理同时递增 generation、清空读锁和 pending idempotency intents。

Credentials 仍按 subject scope 隔离；candidate/recruiter agent settings 即使属于同一 subject 也按 role 独立保存和 CAS。

## 7. P5 角色级统计

### 7.1 权威 scope

角色水合读取三个无业务过滤 scope：

```text
P5范围键.open(role, null)
P5范围键.history(role, 'completed', null)
P5范围键.history(role, 'ended', null)
```

现有按意向/岗位列表继续复用这些无过滤快照，避免同资源重复 GET。

### 7.2 统一 selector

新增纯 selector，从上述快照计算：

- open 数：open items 总数；
- 初筛中：`state.stage === 'anonymous_screening'`；
- 待处理：`needsAction === true`；
- 意向达成：`state.stage === 'intent_confirmation'` 的 open items；
- 历史数：completed 与 ended items 之和；
- 代理跟进数：open 数；
- 累计代谈数：open + completed + ended，按 `caseId` 去重。

Selector 返回加载、成功或失败状态与展示字符串。任一参与列表有 `nextCursor` 时，计数使用真实下界 `N+`，不把首 50 条伪装成完整总数。页面统计、代理卡、待办入口和双端代理详情必须复用同一 selector。代理详情现有第三格保留尺寸和位置，把等长标签“累计筛过岗位/候选”改成“累计代谈岗位/候选”，数值使用该累计代谈数；不能在旧标签下把 P5 Case 数冒充被筛对象数。

Mock selector 继续从现有演示数组计算，保持演示页面。

## 8. 登录水合与导航

### 8.1 交互登录顺序

`完成手机登录` 固定执行：

```text
完成 attempt
→ 读取主体 GET /me
→ 清理旧 subject/role 状态
→ 更新 subject fence 与 session generation
→ last_used_role 非空时调用公共 水合角色数据
→ 水合 Promise 全部结算且会话仍有效
→ 设置 已登录=true
→ 根路由执行唯一导航
```

Candidate 水合包括既有 Resume、intentions、privacy、attachments、P6，加上 P5 三个无过滤 scope、candidate account profile、candidate agent settings 和 credentials。

Recruiter 水合包括既有 profile/affiliations/jobs/P6，加上 P5 三个无过滤 scope、recruiter agent settings 和 credentials。

Contact events 只在“谁接触过我”页面按需加载，不阻塞每次登录。

`last_used_role=null` 时不读取角色域，进入身份选择。

### 8.2 失败与导航 owner

- 当前水合中的 401 统一清账号，绝不落已登录；
- 非 401 单资源失败保留失败快照，整轮结算后允许登录，页面提供重试；
- 登录页 Backend 成功处理器不主动跳身份选择；
- 根 `应用` 是唯一导航 owner：candidate → 求职主壳；recruiter 已建档 → 企业主壳；recruiter profile 缺失 → 招聘名片首次创建；null role → 身份选择。

冷启动恢复、切身份和交互登录必须调用同一公共水合函数，不复制资源清单。

## 9. 页面投影与交互

### 9.1 Candidate“我”与个人信息

- “我”页四项统计、代理跟进数和代理详情只读 P5 selector；
- 姓名只读 Resume profile，Backend 不用 Mock 姓名兜底；
- 状态胶囊由 Resume 工作状态与 P3 privacy 组合，任一资源未就绪时显示中性状态；
- 头像读取 candidate account profile；选择现有头像控件后上传服务端，成功响应权威回写；
- 手机号读取唯一 `phone_otp` display，点击进入现有账号安全 replacement；
- 简历披露手机号没有写合同，保持不可编辑“未接入”；
- 微信与邮箱现有行读取相应 credential display，并承担 link/unlink 行为；
- Backend 不派发 `存联系方式`，不读 sessionStorage 头像。

### 9.2 Contact events

Backend 页面挂载读取第一页；现有滚动区触底时按 cursor 追加：

- success + 空 items：真实空态；
- loading：现有中性加载容器；
- error：现有容器内重试；
- invalid cursor：保留已加载数据，停止追加，重试从第一页重建；
- 任一状态均不得显示 Mock 公司。

Mock 模式继续显示现有 fixture，零 contact-events 请求。

### 9.3 认证摘要

Candidate 设置没有实名 authority，显示“暂未认证”或“暂未提供”，不根据 phone OTP、简历姓名或头像推断。

Recruiter 设置复用 `从BFF招聘身份(...)`，分别解释 personal verification、current affiliation 和 admin request；整行继续进入现有 `/hr/verify`。公司名非空不能推断已认证。

### 9.4 Recruiter profile 与公司资料

Recruiter profile 只有 `404 not_found` 映射为合法“缺失”：

- 招聘名片保留输入；
- 首次保存 PATCH `If-Match: "0"`；
- 成功后用响应 revision 回写；
- 首次创建进入发布岗位，已有档案编辑沿用现有返回/留页行为；
- 失败保留输入，普通本地错误不得冒充网络失败。

公司资料按组织水合阶段投影：

- 请求进行中才显示 loading；
- 0 affiliation：尚未加入企业，并使用现有申请管理员/邀请口令入口；
- pending：审核中；
- revoked/suspended：不可用及现有处理入口；
- verified member：只读；
- verified admin + active organization：可编辑。

`企业档案快照 === null` 本身不再等价于 loading。

### 9.5 Role agent settings

Candidate 现有两行分别映射：

- “发送正式简历”：`ask_first | auto_send`；
- “超授权让步”：`ask_first | reject`。

Recruiter 只有“超授权让步”有服务端合同。现有“发送内部版 JD”行因零像素约束继续保留；Backend 点击只弹出固定解释，不派发 reducer、不 PATCH、不显示保存成功。Mock 仍走本地演示。

有合同的选项必须服务端先行：成功后显示响应完整快照；失败保持旧值。P6 自定义规则继续使用独立页面数组和提案流。

### 9.6 文案与中性状态

- 企业披露页保持固定机制，标题使用等长的“披露规则”，删除“改动即时生效”的可编辑含义，但不改布局；
- 招聘角色的数据导出使用“账号数据与协商记录”，不出现“你的简历”；
- 双角色账号可使用中性“账号数据与协商记录”；
- 屏蔽名单目录搜索无命中时，在现有结果区域解释必须选择目录企业；不把自由文本发给后端。

## 10. Mutation、错误与并发

### 10.1 稳定幂等意图

操作层以资源坐标、action 和不可变请求体构造 pending intent。首次生成 `Idempotency-Key`；网络错误、5xx 或结果未知保留同一 key；明确成功或明确业务拒绝后释放。同 key 不允许配不同 body。

页面不能持有或生成幂等键。

### 10.2 CAS 冲突

Avatar、agent settings 和 recruiter profile 使用权威 revision：

- `409 version_conflict` 自动重读最新资源；
- 保留用户输入；
- 提示重新确认；
- 不自动用新 revision 重放旧意图。

普通网络错误不清空输入、不导航、不产生成功提示。普通本地 `Error` 显示可理解信息或通用“操作失败”，不得统一映射成“网络连接失败”。

### 10.3 特殊错误

- account profile GET 404：合同错误；
- contact invalid cursor：保留当前页并从第一页重试；
- duplicate credential provider 或未知 provider：失败关闭；
- phone unlink：禁止；
- `last_login_credential`：保留列表并解释不能解绑；
- production WeChat `provider_unavailable`：诚实提示，不回退 Mock；
- organization 缺失/审核/撤销/暂停：业务状态，不是网络错误；
- 当前会话 401：统一清账号；迟到 401：忽略。

## 11. 测试策略

### 11.1 数据源合同测试

为新模块及 P8 扩展覆盖：

- exact URL、method、query、body；
- `If-Match`、`Idempotency-Key`、multipart `media`；
- strict envelope/DTO；
- contact action、credential provider、agent setting 枚举；
- OAuth URL allowlist 与固定 callback 落点；
- extra/missing/malformed 字段失败关闭。

### 11.2 状态与操作测试

新增或扩展：

- `src/状态/初始状态.test.ts`；
- `src/状态/后端/会话操作.test.ts`；
- `src/状态/后端/MatchCase操作.test.ts`；
- 新“我与设置”操作测试；
- `src/状态/应用状态.test.ts`。

必须覆盖：

- Backend seed 的 MatchCase/候选/归档演示数组全空；
- candidate/recruiter 无过滤 P5 scope 与 0、精确 N、`N+` selector；
- 交互登录完整水合、null role 不水合、401 不登录；
- 水合结算前不提前落已登录；
- 换主体/切角色/登出和迟到响应隔离；
- avatar、agent settings 和 credential unlink 的 CAS、幂等、重读与错误保留。

### 11.3 页面测试

补齐当前不存在的：

- `src/屏幕/我的.test.tsx`；
- `src/屏幕/接触记录.test.tsx`。

扩展既有：

- `企业我的.test.tsx`；
- `个人信息.test.tsx`；
- `设置.test.tsx`；
- `企业设置.test.tsx`；
- `招聘名片.test.tsx`；
- `公司档案编辑.test.tsx`；
- `规则库.test.tsx`；
- `企业代理设置.test.tsx`；
- `账号安全.test.tsx`；
- `登录.test.tsx`；
- 应用路由测试。

断言包括：Backend 不出现 Mock 数字、姓名、公司或联系方式；Mock fixture 不变；手机号/email/WeChat 只来自 credentials；头像跨刷新；认证只认 authority；profile 404 首写 revision 0；0 affiliation 不永久 loading；Agent 设置刷新保持、失败不改；recruiter 内部 JD 行不假保存；登录页不出现邮箱登录。

### 11.4 零像素验证

实施 Plan 以开始实现时的提交为 `PLAN_BASE`，最终要求：

```bash
git diff --name-only PLAN_BASE...HEAD -- '*.css' '*.module.css'
```

输出为空。

运行现有视觉回归：Mock fixture 页面和登录页不得更新基线；Backend 页面允许权威业务文字和数字不同，但组件 bounding box、间距、字号、颜色和尺寸不变。

### 11.5 工程门禁

至少运行 handoff 指定的所有定向 Vitest，以及：

```bash
npm run typecheck
npm run lint
npm run build
```

不存在的测试文件必须创建，不得从长期验证命令删除。

## 12. 浏览器验收

后端 Plans 01/02/03 完成并集成后执行：

1. Candidate 0 MatchCase/0 conversation：短信登录无需刷新，“我”统计为 0，手机号来自 credential，avatar/settings 为权威快照。
2. Recruiter profile 缺失、0 affiliation、0 job：短信登录无需刷新，“我”统计为 0，AI 设置为真实默认值。
3. Recruiter 设置认证摘要与 `/hr/verify` 一致，不从公司名推断。
4. 首次招聘名片发 PATCH + `If-Match: "0"`，随后 GET profile 为 200。
5. 公司资料 0 affiliation 显示现有申请/邀请入口；其它 affiliation 状态逐一符合设计。
6. Contact events 空、非空、分页和失败均无 Mock 公司。
7. Candidate 头像跨刷新/设备回读；email/WeChat 在现有个人信息行完成绑定、回读和解绑。
8. Candidate/recruiter agent settings 刷新、换设备和切角色不丢失，recruiter 内部 JD 行不假保存。
9. 生产微信按钮只走真实 OAuth；登录页没有邮箱登录和视觉变化。
10. 既有 P3/P4/P5/P6/P7/P8 正常能力不回归。

## 13. 后端依赖与 Plan 门槛

本设计完成后不立即写实施 Plan。必须等待后端三份 Me/Settings Plan 的最终 Handoff，并核对：

- 精确 public OpenAPI route、DTO、enum、header 和 error union；
- contact cursor 与 retention 行为；
- avatar 201/200 replay、ETag 和 content URL；
- candidate/recruiter agent settings 的 role isolation 和 revision 0 默认值；
- email/WeChat link callback、unlink 与 production prerequisite；
- 后端集成提交和可消费状态。

若最终差异只属于字段名或 envelope 的机械校准，在前端 Plan 记录 exact upstream commit。若 owner、route、revision、幂等、OAuth redirect 或安全边界改变，先修订并重新批准本 Spec，再调用 `superpowers:writing-plans`。

前端实施不允许同时猜测旧、新两套合同，也不允许用临时 Mock fallback 绕过未完成的后端依赖。
