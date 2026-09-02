# 后端 Handoff：“我”与设置页面缺失能力

> 本文可直接发送给另一台机器上的后端 Coding Agent。接收者不需要原测试账号、测试材料、浏览器会话、截图、前端本地文件或此前聊天记录。所有代码路径均为仓库相对路径，不包含任何本机绝对路径。

## 仓库与目标

- 后端仓库：`myaier/agxp-monorepo`
- 相关模块：`apps/recruitment`、`apps/recruitment-bff`
- 前端仓库仅作合同消费者：`myaier/agxp-a2a-recruiting-web`

本次后端工作只处理当前合同确实缺失、但 UI 已承诺的三类能力：

1. 候选“谁接触过我”的访问审计列表；
2. 候选头像、微信、邮箱的跨设备权威 owner；
3. 双端两个内置 Agent 授权偏好的持久化。

候选实名仅在产品决定继续保留该入口时实施。

大量表面现象已经确认是前端接线错误，本文后半部分明确列出“不要改后端”的项目。不要为消除前端假数而改变现有 P3/P4/P5/P6/P8 合同。

## 已确认的现有后端能力

以下真实回读均正常：

### 求职侧

```text
GET /api/v1/me/resume
GET /api/v1/me/intentions?status=active
GET /api/v1/me/privacy
GET /api/v1/me/credentials
GET /api/v1/me/conversations
GET /api/v1/me/match-cases?limit=50
GET /api/v1/me/match-cases/history?lifecycle=completed&limit=50
GET /api/v1/me/match-cases/history?lifecycle=ended&limit=50
```

### 用人侧

```text
GET /api/v1/recruiter/profile
GET /api/v1/recruiter/affiliations
GET /api/v1/recruiter/jobs
GET /api/v1/recruiter/agent-rules
GET /api/v1/recruiter/conversations
GET /api/v1/recruiter/match-cases?limit=50
GET /api/v1/recruiter/match-cases/history?lifecycle=completed&limit=50
GET /api/v1/recruiter/match-cases/history?lifecycle=ended&limit=50
```

### 其他已正常域

- P3：candidate privacy、disclosure preferences、organization blocks；
- P4：招聘推荐和 rejected 聚合；
- P5：双端 MatchCase open/detail/history；
- P6：双端自定义 Agent rules 和 proposals；
- P8：credentials、sessions、手机号换绑、退出其他设备、数据导出、账号注销、产品反馈与上下文举报。

实测空账号的上述列表能正确返回 0 条。前端显示的 `8/1/5/3` 或 `5/2` 来自 Mock 数组，不是后端计数错误。

## BE-ME-01：候选访问审计列表

**优先级：P0 / 新能力**

### 产品需求

“谁接触过我”只向候选展示：哪家企业、何时、做了什么。不得展示 HR 姓名、头像、职务、停留时长、查看了简历哪一段或其他可重新识别个人的细节。

当前前端合同中没有对应 API，页面因此仍直接显示五条 Mock 记录。

### 推荐合同

发布 candidate-owned、分页、no-store 的只读端点。例如：

```text
GET /api/v1/me/contact-events?limit=50&cursor=...
```

命名可按后端现有规范调整，但资源 owner 必须是当前 candidate，不要接受任意 candidate ID。

建议响应：

```json
{
  "result": {
    "items": [
      {
        "event_id": "cev_...",
        "organization": {
          "organization_id": "org_...",
          "display_name": "示例企业"
        },
        "action": "anonymous_profile_viewed",
        "occurred_at": "2026-09-01T08:00:00Z"
      }
    ],
    "next_cursor": null
  },
  "meta": {
    "request_id": "...",
    "api_version": "v1"
  }
}
```

动作枚举至少覆盖：

- `anonymous_profile_viewed`
- `contact_started`
- `submitted_resume_viewed`

### 服务端约束

1. 只返回当前登录 candidate 的事件，禁止 caller-supplied owner ID。
2. 不返回 recruiter subject、个人姓名、头像、联系方式和浏览细节。
3. organization 在事件发生后改名或删除时要有明确展示策略；建议事件保留当时 display snapshot，同时保留稳定 organization ID。
4. 应用 candidate 的 organization blocks：被屏蔽组织不应继续出现在可见列表中。
5. 明确保留期。现有 UI 声称 90 天；若后端不是 90 天，应先改产品文案再上线。
6. opaque cursor、稳定排序、上限 50、`Cache-Control: no-store`。
7. 组织被 suspend/delete、事件撤回、数据保留到期时必须有闭合行为。

### 必测

- owner 隔离与跨账号 404/403；
- 空列表、单页、多页和 cursor 失效；
- 三种动作枚举和未知枚举 fail closed；
- organization block 过滤；
- 不泄漏 recruiter PII；
- 90 天边界或最终采用的保留期；
- 401、no-store、稳定排序。

## BE-ME-02：候选账号资料 owner

**优先级：P1 / 合同设计**

### 当前问题

前端候选“个人信息”同时展示姓名、头像、手机号、微信和邮箱，但目前资源 owner 不一致：

- 姓名：candidate resume profile，已有权威 PATCH；
- 手机号：P8 `phone_otp` credential，已有 replacement begin/complete；
- 微信/邮箱：credential 列表枚举允许 `wechat` / `email_otp`，但当前前端合同没有对应绑定/解绑 mutation；
- 候选头像：Backend 模式只存浏览器 sessionStorage，没有服务端 API。

### 先冻结 owner

建议：

- 姓名继续归 resume profile；
- 登录与恢复账号的联系方式归 security credential；
- 候选头像归 candidate account profile 或 resume profile，二选一，不要双写；
- 招聘过程中向对方披露的联系方式应引用经过验证的 credential 或独立 disclosure snapshot，不要读前端自由文本。

### 微信/邮箱 credential 合同

若产品支持绑定，至少需要：

- begin/link attempt；
- OTP 或 redirect complete；
- unlink；
- 当前凭证列表权威重读；
- 幂等键；
- attempt 过期、proof 错误、凭证冲突、重复绑定、最后一个登录凭证保护；
- 是否撤销其他会话的明确语义。

保持现有 `provider` 闭合枚举，不要让自由字符串进入响应。

### 候选头像合同

若头像需要跨设备，发布上传/替换/删除能力，建议包含：

- PNG/JPEG allowlist；
- 文件大小和像素边界；
- 服务端处理后的权威 URL；
- revision/If-Match 或等价并发控制；
- 旧对象回收；
- 内容安全扫描与审核状态；
- 删除后中性占位。

不要让 data URL 进入 JSON profile，也不要依赖浏览器 local/session storage 作为后端成功。

### 必测

- credential owner 隔离；
- begin/complete 幂等与 attempt 生命周期；
- provider 冲突和重复操作；
- 最后一个可登录凭证不可误删；
- 头像类型、大小、扫描、替换 CAS、旧文件回收；
- 账号删除和数据导出是否包含这些资源。

## BE-ME-03：内置 Agent 授权偏好

**优先级：P1 / 合同设计**

### 当前 UI

求职侧：

- 发送正式简历：`先问我 | 自动发送`
- 对方要求的让步超出授权：`先问我 | 直接回绝`

用人侧：

- 发送内部版 JD：`先问我 | 自动发送`
- 对方要求的让步超出授权：`先问我 | 直接回绝`

当前前端只派发本地 `设先问偏好`，刷新即恢复默认值。现有 P6 自定义规则与提案合同没有这两个稳定系统策略的读写资源。

### 需要产品与后端共同决定

二选一：

1. **版本化 role settings**：为 candidate/recruiter 提供独立 GET/PATCH；或
2. **系统 Agent Rules**：把这两项建模成具有稳定系统 key 的 P6 规则。

推荐独立 role settings，因为它们是闭合枚举的授权开关，不是自然语言规则提案。

建议形状：

```json
{
  "material_submission": "ask_first",
  "out_of_authority_concession": "ask_first",
  "revision": 3,
  "updated_at": "2026-09-01T08:00:00Z"
}
```

闭合枚举：

```text
material_submission: ask_first | auto_send
out_of_authority_concession: ask_first | reject
```

要求：

- candidate/recruiter owner 隔离；
- GET no-store；
- PATCH 稀疏更新 + `If-Match`；
- 默认值由服务端明确返回，不让客户端猜；
- 审计 who/when/old/new；
- 正在进行的 MatchCase 从哪个时点读取新策略要有明确语义；
- 与 P6 自定义规则冲突时定义优先级。

### 必测

- 双角色独立状态；
- 默认值与首次 GET；
- PATCH CAS、409、幂等重试；
- 枚举闭合；
- 规则冲突优先级；
- 策略更新对在途 MatchCase 的生效边界；
- 账号切换不串数据。

## BE-ME-04：候选实名，仅在产品确认后实施

**优先级：待产品决定**

手机号 OTP 验证不等于实名认证。如果产品继续保留候选设置中的“实名认证”，需要独立权威状态，至少包括：

- `unverified | pending | verified | rejected | revoked`；
- verification method；
- verified/reviewed timestamp；
- 用户可见的拒绝或撤销原因；
- 隐私、数据导出和账号删除语义。

如果产品不要求候选实名，前端应删除该入口，本任务不要实现。

## 明确不要修改的后端行为

以下现象已归因为前端，不要通过改变后端响应来迁就：

1. **“我”页假统计**：P5 空列表正确返回 0；前端 Backend 种子继承了 Mock 数组。
2. **短信登录后不水合**：前端 `完成手机登录` 漏调已有角色水合编排。
3. **企业设置谎报已认证**：后端已有 profile/affiliation/admin request 权威事实，前端硬编码。
4. **profile 404**：404 是合法“尚未创建”。现有 `PATCH /recruiter/profile` + `If-Match: "0"` 是首写协议；不要新增 profile POST，也不要把 GET 404 改成合成空 profile。
5. **公司资料永久 loading**：0 affiliation 是合法事实，前端应显示申请/邀请空态。
6. **用人导出文案说简历**：P8 导出本身正常，只有前端角色文案错误。
7. **用人披露策略全部禁用**：当前是固定产品机制。若继续固定，只改前端标题和说明；只有产品决定可编辑时才新增合同。
8. **屏蔽名单自由文本不能提交**：正确行为是先从 `/organizations` 选择稳定 organization ID；不要放宽为服务端接收任意公司字符串。
9. **产品反馈与举报**：`/compliance/feedback` 已正常；无目标举报必须从具体 job、MatchCase 或 conversation 发起，不要接受无法核实的泛化举报。

## 后端交付顺序

1. BE-ME-01 访问审计：先冻结 owner、事件枚举、屏蔽过滤和保留期，再实现列表。
2. BE-ME-03 Agent 授权偏好：先做产品决策，优先独立版本化 role settings。
3. BE-ME-02 候选账号资料：先冻结 owner，再分别实现 credential 和头像能力。
4. BE-ME-04 候选实名：仅在产品明确要求后排期。

每个新合同先更新 OpenAPI/契约测试，再实现 service/BFF，最后让前端接线。不要把三个能力合成一个不可审查的“大 profile”接口。

## 验收标准

- [ ] 候选访问审计 API 只返回当前 candidate 可见的组织事件，支持分页、屏蔽过滤和保留期。
- [ ] 响应不泄漏 recruiter 个人身份或浏览细节。
- [ ] 微信/邮箱如上线，具备完整验证、幂等、冲突和解绑语义。
- [ ] 候选头像如上线，跨设备可回读，并有类型、扫描、并发和对象回收约束。
- [ ] 双端内置 Agent 偏好可 GET/PATCH，刷新和换设备后保持，双角色互不串数据。
- [ ] 新能力包含数据导出和账号删除语义。
- [ ] 现有 P3/P4/P5/P6/P8 回归测试全部通过。
- [ ] profile 404/首写、0 affiliation、P5 空统计等现有合同未被错误改写。
