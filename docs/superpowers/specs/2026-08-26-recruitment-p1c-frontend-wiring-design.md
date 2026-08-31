# Recruitment P1C 前端接线设计

**日期：** 2026-08-26

**状态：** 核心产品设计沿用已批准草案；本文已按当前前端仓库重新校准，待确认后进入实现

**范围：** `agxp-a2a-recruiting-web` 完整 P1C：招聘方个人名片、Organization/Affiliation、公司档案与媒体、
岗位发布方投影和候选端公司公共页的真实 Recruitment BFF 接线

**前端设计基线：** `origin/main@c836f301f07d6e6693e125ea66b8855cd975ec31`。当前基线已合入确定性 UI
回归系统、招聘头像的 `压成头像` helper、四个岗位详情面共用的 `公司区块`，以及职位详情/在谈详情/真人会话共用的
`匹配对齐卡`。P1C 不复制这些 UI 能力：Mock 头像继续复用 helper；Backend/Mock 公司投影继续落到同一个
`公司区块`；P1C 对上述页面接线时必须保留现有 `匹配对齐卡` 的结构、数据和顺序。Backend 通过显式投影数据和可选
导航避免读取静态公司档案。P0 的 `HTTP招聘数据源` facade、`状态/后端` 操作边界和
`状态/领域/组织岗位.ts` 在当前基线上仍无语义漂移。

**后端契约（只读参考）：** P1A
`recruitment-organization-identity-core@0423e001921bc53338b0a14a73e4cfc894f18e4c` 与 P1B
`origin/release/0.2.5@d82f4f8ee204777dec0c83fd3425bd3b475abcec` 只用于校准前端浏览器契约。参考资料位于
`~/agxp-monorepo` 的 P1A/P1B 历史版本，包括
`docs/superpowers/specs/2026-08-25-recruitment-organization-recruiter-identity-design.md` 和
`apps/recruitment-bff/openapi/mobile-v1.yaml`。本 P1C 不切换该仓库的分支，不创建其 worktree，不修改、启动或测试
后端代码与本地运行栈。

前端按已核验的 P1B runtime 行为冻结以下浏览器边界：组织媒体上传使用 `metadata` JSON part + `media` file part；
招聘方头像上传使用单个 `media` file part；媒体 DELETE 返回 `204 No Content`；suspended Organization 写入返回
`409 organization_suspended`；未设置行业写为 `industry_id: ""`；缺失的
`RecruiterProfile.verified_name/avatar_url` 归一为 `null`。冻结 OpenAPI 对这几处的描述与 runtime 不完全一致，因此
实现和测试以本段边界为准：不得发送 `file` part，不得实现兼容双 body，也不得发明第三种 shape。后端若改变实际
runtime contract，应另行重新校准前端 Spec；它不构成本前端计划中的实现任务。

## 1. 背景与结论

前端 P0 已在 `9495a1abf1fe63aa27ad6d273c573f676da2ba7c` 完成契约校准和静态域接缝：

- `HTTP招聘数据源` 已按真实后端 owner 拆为会话、目录、简历、意向和岗位 facade；
- Provider 操作已拆入 `状态/后端`；
- 公司资料、招聘身份资料和岗位状态已有 `状态/领域/组织岗位.ts` owner；
- 根 Context、`use应用状态()`、action shape 和页面读取方式保持稳定。

当前 Organization 相关页面仍不是真实后端产品：

- `企业实名认证` 用 1.2 秒计时器把姓名与公司同时标成“认证通过”；
- RecruiterProfile、Affiliation 和公司身份被压在本地 `企业认证` 自由文本中；
- 招聘头像、LOGO 和公司资料使用浏览器图片或静态公司档案；
- 公司页通过公司名查静态表，每张卡都能进入一个看似 canonical 的页面；
- 页面无法区分 personal verification、publisher organization 与 hiring organization；
- admin/member 权限、revision 冲突、公开媒体和只读工商快照尚未接线。

P1A/P1B 已提供完成 P1C 所需的浏览器契约。满足当前需求的最小方案是沿用 P0 接缝，新增一个
Recruiter/Organization 数据源与操作域，把现有页面的本地事实替换为服务端投影；不建立第二个 React
Context，不引入状态库、请求框架、schema generator、设计系统或通用媒体层。

## 2. 目标与成功标准

P1C 完成后：

1. Backend 招聘方会话按固定顺序水合 RecruiterProfile、Affiliation、当前 Organization 和 owner Jobs；
2. self-declared public name、personal verification、Affiliation 和 Organization verification 分别展示，
   不再由字段非空、动画或公司名相似推导可信状态；
3. 没有 Affiliation 的招聘方仍可用 unverified company claim 发岗；
4. active verified Affiliation 可作为 direct Job 的 publisher；agency publisher 与客户 hiring organization
   始终分别展示；
5. Organization admin 可维护公开公司档案、头像、LOGO 和两类相册；member 只能读取；
6. 候选端只为真实 `organization_id` 打开公开公司页；没有 canonical ref 的 claim 不产生伪页面；
7. 401、409、503、revoked、suspended 和媒体失败保留诚实状态与明确重试，不回退 Mock；
8. Mock 模式现有注册、发岗、公司档案和 PM 视觉保持；
9. private evidence、raw invitation token、subject、object key 和 internal review 数据不进入公开页面或持久化；
10. unit、component、intercepted data-source Playwright 与 UI regression 形成可重复的纯前端验证证据。

## 3. 采用方案与被拒方案

### 3.1 采用：沿用 P0 域接缝

新增 Organization 数据源、wire-to-page 映射和后端操作工厂；扩展现有组织岗位状态域。根 facade、Provider 和
React Context 只做显式组合。页面继续从 `use应用状态()` 读取权威状态并调用 `操作`。

这让 RecruiterProfile、Affiliation、OrganizationProfile 和 Job 投影共享同一会话代际、revision 和失败语义，
也是满足完整 P1C 的最小改动。

### 3.2 拒绝：页面局部请求

招聘名片、企业我的、公司档案和公司公共页分别直接请求 BFF，短期文件较少，但会重复水合、401、409、
Idempotency-Key、草稿保留与 Mock/Backend 分流，并导致页面之间观察到不同 Organization revision。

### 3.3 拒绝：新增 Organization React Context

第二套 Context 会复制会话生命周期、加载状态和账号清理，并违背 P0 已批准的单 Context 接缝。当前没有
独立挂载或性能证据足以抵偿这套状态图的认知成本。

## 4. 架构与文件责任

### 4.1 数据与传输

- `src/数据/BFF契约.ts`：增加冻结的 RecruiterProfile、Affiliation、AdminRequest、Invitation、
  OrganizationProfile、OrganizationMedia、PublicOrganization 和 Job publisher/hiring organization DTO；
  保持一个 browser wire SSOT，不再创建平行 contract 类型。
- `src/数据/招聘数据源/组织.ts`：拥有 P1A/P1B browser route、严格响应解码、multipart、If-Match 和
  Idempotency-Key；不 import React、Mock 或静态公司档案。
- `src/数据/HTTP招聘数据源.ts`：把 `组织数据源` 加入根交集和创建函数，只做 facade 组合。
- `src/数据/组织映射.ts`：集中处理 closed wire enum、中文展示、页面草稿、只包含线上字段的公开公司视图模型和
  Job publisher 映射；权威 BFF DTO 可以保存在 server snapshot，但 React 组件只能消费映射后的 view model，
  不得直接解释 wire enum 或 private/optional 字段。

P1C 不拆出 schema generator。当前只有一个浏览器 consumer，手写闭合 DTO 与现有项目一致；OpenAPI 漂移由
契约测试和计划依赖门检测。

### 4.2 状态与操作

- `src/状态/领域/组织岗位.ts`：继续拥有岗位，并增加 RecruiterProfile、全部 Affiliation、当前
  Affiliation ID、当前 Organization/PublicOrganization/Profile、admin request 列表及相应水合 action。
- `src/状态/后端/组织操作.ts`：负责组织水合、招聘名片保存、admin request 创建/取消、邀请接受、头像替换、
  公司档案与媒体写入、冲突恢复和公开公司读取。
- `src/状态/后端/类型.ts`：新增 `组织操作` 和最小 server snapshot 类型；根 `应用操作` 仍是域操作交集。
- `src/状态/应用状态.tsx`：组合 `创建组织操作`，把水合挂入既有 recruiter role 流程；不承载新的业务判断。
- `src/状态/初始状态.ts` 与 `src/状态/资料持久化.ts`：Mock fixture 保持；Backend Organization 权威 DTO 不写
  localStorage。current Affiliation ID 和未认证 company claim 只复用现有按环境与 subject 隔离的
  sessionStorage 临时仓，读取后必须用最新 Affiliation 列表重新校验。

### 4.3 页面

页面继续复用现有外壳、表单行、按钮、图片选择和 CSS Modules：

- `企业实名认证`：Backend 模式变为诚实的招聘身份总入口；Mock 保留演示剧情；
- `招聘名片`、`企业我的`：消费 RecruiterProfile/Affiliation/Organization；招聘方头像继续在现有
  `招聘名片` 上传槽完成，不改候选端 `添加头像`；
- `公司档案编辑`、`公司档案分区编辑`：消费 OrganizationProfile 草稿与 admin 权限；
- `企业详情`：按 `organization_id` 读取 PublicOrganization；
- `发布岗位`、招聘方 `岗位详情`：展示 owner Job 的 publisher 与 hiring organization 投影；候选端 `职位详情`、
  `在谈详情`、`真人会话` 在 P4 真实发现 API 前仍属演示域，Backend 模式只保证不把静态 slug/公司名伪装成
  canonical Organization 导航。

新增两个最小次级页，复用现有样式而不建立新视觉系统：

- `/hr/organization-application`：manual admin request 元数据、1–5 份 evidence 和申请状态；
- `/hr/organization-invitation`：只接受 raw token 的输入与提交。

不新增企业成员管理、邀请创建/分享或 roster 页面；后台/运营如何把一次性 token 交给受邀者不属于当前 PM
前端。接受入口只消费现有 token，绝不把 token 放进 URL。

## 5. 权威对象与页面状态

P1C 分开以下事实：

1. **RecruiterProfile**：`public_name`、`title`、personal verification、`verified_name`、`avatar_url`、revision；
2. **Affiliation**：Organization 关系、member/admin、pending/verified/revoked、verification method、revision；
3. **current Affiliation**：前端当前 direct publisher 选择，不是新的服务端权限或 Organization owner；
4. **Organization**：opaque ID、只读工商身份、active/suspended；
5. **OrganizationProfile**：admin 可写公开品牌与内容，使用独立 revision；
6. **OrganizationClaim**：Job 上不可丢失的用人公司声明；没有 canonical ref 时只能 unverified；
7. **Job publisher projection**：发布人和发布组织；不能与 hiring organization 折叠；
8. **页面草稿**：招聘名片、申请和公司档案尚未成功提交的输入，不是服务端成功事实。

不得增加 `isVerified` 之类合并 personal、publisher 与 hiring organization 的模糊布尔值。页面需要的 badge 文案
从明确 status/mode 映射产生。

## 6. Backend 水合与 current Affiliation

招聘方角色的固定水合顺序是：

```text
session / principal
  → GET RecruiterProfile
  → GET own Affiliation list
  → validate/select current active verified direct Affiliation
  → GET current PublicOrganization/Profile（存在 current Organization 时）
  → GET owner Jobs
```

规则如下：

- 恢复的 current Affiliation ID 只有在最新列表中仍为 `verified`、Organization 为 `active` 时才有效；
- 没有恢复值且恰好一个有效 Affiliation 时自动选中；
- 有多个有效 Affiliation 时不按响应顺序猜测，通过招聘名片现有公司字段让用户明确选择；
- 选择只决定后续 direct Job 的 company claim 预填与页面展示，不共享或转移该 Organization 下其他成员的
  Job；browser request 不提交 affiliation/Organization ref，可信 publisher verdict 仍由服务端从登录主体、
  `publisher_mode` 与精确 claim 唯一推导；
- current Affiliation 变成 revoked/pending 或 Organization suspended 时立即清空；不自动切到另一家公司替用户发岗；
- 没有 current Affiliation 时，招聘方仍能维护 self-declared public name/title 和未认证 company claim；claim
  只作为新 Job 草稿默认值，填写它不会创建 Organization；
- 所有请求绑定 subject、role 与会话代际；旧账号或旧角色的迟到响应必须丢弃。

## 7. 招聘身份、申请与邀请

### 7.1 RecruiterProfile

`企业实名认证` 在 Backend 模式删除本地人脸计时器与“认证通过”结论，显示：

- self-declared public name；
- personal verification status 与只读 verified name（存在时）；
- current Affiliation/Organization 或 unverified company claim；
- admin request 的最新状态；
- manual admin request 与 invitation token 的入口。

`招聘名片` 保存 `public_name/title`。trusted `verified_name` 存在时姓名槽只读；无可信 KYC provider 时只显示
`unverified`，Organization admin 身份不能把个人姓名升级成 verified。

### 7.2 Manual admin request

申请页面只提交 BFF 冻结 metadata 和 1–5 个 evidence 文件。创建使用一次 Idempotency-Key；页面显示自身申请的
pending/approved/rejected/cancelled，不读取 private evidence、审核员或内部备注。`verification_request_conflict`
触发重新读取既有申请，不重复上传材料。pending 申请可按其 revision 取消。

申请批准后的 Organization/Affiliation 只能通过重新读取列表出现，前端不得在本地直接写 admin。

### 7.3 Invitation acceptance

邀请页的 strict body 只有 `{ "token": "..." }`。token 仅存在于输入组件内存和 POST body；提交完成、失败离页
或账号变化即清空。成功后重读 Affiliation 并按 current selection 规则处理。

P1C 不显示企业邮箱认证发起动作：P1B 候选 OpenAPI 没有 email challenge route。既有 Affiliation 的
`corporate_email` verification method 可以只读展示；未来只有后端提供真实 challenge/delivery 并批准新设计后
才增加入口。

## 8. 公司档案与媒体

### 8.1 完整 replacement

公司档案页面从最新 OrganizationProfile 构造本地完整草稿。admin 可编辑，member 只读；权限判断只控制 UI，
服务端仍是最终授权。保存发送完整 replacement 和当前强 If-Match；成功响应后才替换权威快照。

legal/display identity、`verified_at` 和 active verified Job count 共同组成当前 BFF 可公开的只读工商快照，始终
只读；P1B 没有额外 `registry_snapshot` 对象。Profile 填满不能产生 verified。

### 8.2 Recruiter avatar

头像使用原子 multipart POST，同时带 RecruiterProfile revision 和 Idempotency-Key。成功响应给出新的 Profile；
失败时页面只能保留内存预览，不把 data URL/avatar URL 写成服务端成功。

### 8.3 Organization media

LOGO、office gallery 和 company gallery 使用两步协议。最终 runtime 的 browser multipart 恰好包含：

- 一个名为 `metadata`、`Content-Type: application/json` 的 part，body 为
  `{ "purpose": "organization_logo|office_photo|company_photo" }`；
- 一个名为 `media` 的 PNG/JPEG file part；
- 不包含 query-string purpose、`file` part 或其他字段。

随后执行：

1. 上传用途闭合的图片并获得 detached `media_id` 与 BFF public URL；
2. 把 media ID 纳入完整 Profile replacement，在一个 revision mutation 中发布。

前端只接受服务端返回的 media ID/URL，不拼 object key。用户明确移除或放弃本次尚未引用的上传时执行
best-effort DELETE；删除失败不伪造已删除。`media_in_use` 触发 Profile 重读。页面销毁时撤销浏览器 object URL，
但不把页面卸载等同于服务端删除成功。

不增加 crop、resize、thumbnail、WebP、CDN、通用 DAM 或后台 GC。实际性能/带宽证据出现后再重新设计。

## 9. Job publisher 与候选端公司页

### 9.1 Job write/read

新建 direct Job 在有 current active verified Affiliation 时，用该 Organization 的批准 display name 预填
`hiring_organization_claim`；无有效关系时使用用户明确填写的 unverified company claim。`JobCreate` 不允许
browser 提交 affiliation ref、Organization ID 或 verification status；后端仅在登录主体的 active verified
Affiliation 中找到唯一精确名称匹配时返回 verified refs，否则诚实返回 unverified。agency Job 的 publisher
organization 只证明招聘代理自身，客户 hiring organization 保持 claim/unverified；当前前端不新增 agency 创建
控件，只正确展示服务端已有 agency 投影。

有 owner Job snapshot 的招聘方页面分别展示：

- recruiter public profile；
- publisher organization 与 verification；
- hiring organization claim/ref 与 verification。

不得用一个公司名或 badge 覆盖三类事实。既有 Job update 使用服务端快照的 affiliation/ref/status，不从当前
自由文本反推。

候选端 `职位详情/在谈详情/真人会话` 在 P1C 没有 CandidateJob consumer，因此 Backend 模式不展示伪造的后端
publisher/hiring verdict；静态公司槽保持只读且不可导航。P4 提供真实 `job_id + publisher_profile + canonical ref`
后再接入同一投影。

### 9.2 Public Organization

`/company/:id` 在 Backend 模式只把 `id` 当 opaque `organization_id`，读取 PublicOrganization。公开页只消费
legal/display identity、`verified_at`、Profile、public media、active verified Job count 和 revision；不渲染只有
Mock `公司档案` 才有、且线上没有来源的企业文化、发展历程、在职感受、代理风格或代理核对区块。

没有 `hiring_organization_ref` 的 Job 卡仍显示 claim 与 unverified 状态，但公司区域不可导航到 canonical page。
P1C 复用现有 JSX 槽位表达只读/不可点击，不新增 badge、说明行或重新排版。

市场、推荐、MatchCase、消息和历史仍属于演示域。P1C 不为 Mock 市场公司名制造 Organization ID；P4 接入真实
发现 API 后复用本次 public route 和映射。

## 10. 错误、冲突与重试

- `401`：沿用统一会话清理；Organization snapshots、current Affiliation、草稿、token 和内存预览不能泄漏到
  下一个 subject；
- `409 version_conflict`：重读权威 RecruiterProfile/OrganizationProfile，更新 revision，保留用户草稿并提示
  “资料已更新，请检查后重新保存”；只有用户再次点击现有保存按钮才重试；
- `503 operation_outcome_unknown`：读取对应资源确认；无法确认时不显示成功，保留草稿；
- `organization_admin_required`：重读 Affiliation 并切只读，不允许旧前端状态继续写；
- `verified_name_immutable`：重读 RecruiterProfile 并锁定 verified name；
- `organization_suspended | organization_not_found`：停止组织写入并移除 canonical 导航；Job claim 仍可显示；
- `verification_request_conflict`：读取既有申请；
- invitation unknown/expired 服从后端统一 not-found 语义，`invitation_used` 单独提示，但不输出 token；
- `media_invalid | media_limit_reached | media_in_use` 使用闭合文案，失败不写成功状态；
- unknown response field、错误 shape 或网络失败 fail closed，Backend 不回退静态公司档案或 Mock。

不增加全局错误总线。复用现有 `BFF错误`、轻提示、写锁、会话代际与页面保存按钮已经足够满足当前恢复路径。

## 11. 安全与隐私

- 所有 browser write 继续由同源 BFF client 携带 cookie、Origin 与 app headers；
- Idempotency-Key 每个新 effect 生成一次，并在受控重试中复用；新 effect 不复用旧 key；
- raw invitation token 不进入 URL、query、history state、日志、错误详情、localStorage 或 sessionStorage；
- admin request evidence 不生成浏览器持久副本，提交后释放文件引用；
- public DTO 不声明或透传 subject、registry key、verification source、domains、申请/evidence、审核备注、bucket、
  object key 或 generation；
- media public URL 只使用 BFF 返回值；禁止根据 media ID 猜 object path；
- foreign private resource 和 token not-found 不在前端转译成可枚举信息；
- strict decoder 拒绝多余字段，避免服务端意外把 private 字段带入页面状态；
- Mock 与 Backend 继续按数据源、环境和 subject 隔离；Backend 已接线域失败不能读取 Mock 公司资料。

## 12. 测试策略

### 12.1 数据源与映射单测

- 每条 P1A/P1B route 的 method、URL、body、If-Match、Idempotency-Key 和 multipart；
- closed request/response decode 及 private/unknown field 拒绝；
- RecruiterProfile、Affiliation、OrganizationProfile、media 与 PublicOrganization 映射；
- direct/agency publisher 与 hiring organization 不折叠；
- 根 `HTTP招聘数据源` 组合六个域且不丢现有公开方法。

### 12.2 reducer 与 Provider 操作测试

- fixed recruiter hydration order；
- current Affiliation 单个自动选、多项不猜、revoked/suspended 清空、不自动切换；
- Mock/Backend 初始状态与账号缓存隔离；
- session generation 丢弃迟到响应；
- 401 全清理、409 保留草稿并重读、503 outcome confirmation；
- admin/member、verified name immutable、admin request conflict；
- avatar/profile/media 成功后才提交权威状态；
- 上传失败、删除 `media_in_use` 与页面离开清理 object URL。

### 12.3 页面组件测试

- Backend `企业实名认证` 不执行计时器假成功，不显示虚假 KYC；
- Mock 招聘方注册剧情、布局和导航保持；
- verified name 锁定，public name/title/avatar 可保存；
- company 来自 current Affiliation 或明确的 unverified claim；
- admin 可编辑、member 只读；
- company profile conflict 保留草稿并允许现有保存按钮重试；
- 上传失败不把 data URL 当服务端成功；
- canonical organization 可导航，无 ref 的 claim 不可导航；
- public page 不读取静态公司档案或 private fields。

### 12.4 Playwright 与前端验证

现有 `playwright.数据源模式.config.ts` 继续运行两条不可复用的 Vite server：

- `@mock` 冻结 PM 招聘注册、发岗和公司展示；
- `@backend` 用 `page.route` 覆盖招聘身份、组织水合、admin/member、媒体、conflict 和 public page；fixture
  只证明前端请求、响应、恢复和渲染边界，不宣称真实 BFF 联调。

本计划的验证范围止于当前前端仓库。真实后端联调、跨仓库 smoke、后端 fixture 与服务启动属于独立集成工作，不是
P1C 前端实现的完成前置。新前端 worktree 若尚未安装依赖，先运行 `npm ci`，不能把依赖缺失造成的命令失败归为产品
基线失败。

最终前端验证至少包括：

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:e2e:data-source
```

## 13. 非目标与刻意延后

- 企业邮箱 challenge/delivery：当前冻结 BFF 没有 browser route；真实后端能力出现后再设计；
- 可信个人 KYC、人脸 SDK 或第三方工商供应商；
- 企业成员管理、邀请创建/分享、roster、部门、席位、RBAC 或企业工作台；
- 组织拥有 Job、共享候选人、共享 MatchCase 或跨成员协作；
- P2 在线简历/PDF 解析、P3 隐私、P4 发现推荐、P5 MatchCase、P6 Agent 规则、P7 消息、P8 控制面；
- 市场、推荐、消息、会话和历史真实 API；
- 图片 crop/resize/thumbnail/CDN/WebP、病毒扫描、通用 DAM 或 orphan GC；
- 新状态库、Query 框架、schema generator、第二个 React Context、设计系统或 CSS 重构；
- 为没有 canonical ref 的公司 claim 创建静态或本地 Organization 页面；
- 以完成 Profile、公司名相似、Affiliation 或前端动画推导 verified。

重新考虑这些能力需要真实产品需求、冻结的后端契约或可测量的性能/运营故障；不能在 P1C Plan 中顺便加入。

## 14. 实施拆分约束

P1C 是一份完整计划，但任务按可独立审阅的责任拆分：

1. wire DTO、strict decode、Organization data source 与映射；
2. Organization state、固定水合、current Affiliation 与账号清理；
3. 招聘身份、RecruiterProfile、admin request 与 invitation acceptance；
4. avatar、OrganizationProfile 和 public media；
5. Job publisher/hiring organization 与 public company page；
6. Mock/intercepted Backend Playwright、完整前端验证与实现分支收口。

每个任务必须先写失败测试，再写最小实现，再运行定向验证并提交。不能把 setup、scaffold 或“以后补测试”拆成
独立任务；不能在 Plan 中增加已批准 Spec 之外的抽象或重构。

## 15. 完成条件

P1C 只有同时满足以下条件才算完成：

1. Implementation Plan 绑定前端 `c836f30`，并把 P1A/P1B 历史版本仅作为只读契约参考；所有实现与验证变更只发生在
   当前前端仓库；
2. 本 Spec 第 2 节十项成功标准都有明确实现任务和测试；
3. 招聘身份、Affiliation、公司档案、媒体、Job projection 与公开公司页没有 Backend→Mock 回退；
4. admin/member、personal/publisher/hiring verification 和 canonical/claim 边界可由测试证明；
5. 401/409/503、revoked/suspended、media/invitation 错误有确定恢复行为；
6. Mock PM 视觉与演示路径保持，现有 `匹配对齐卡`、`公司区块` 及其页面顺序不被接线改写，未发生无批准
   CSS/导航/分区结构变化；
7. typecheck、lint、Vitest、build、普通 Playwright、数据源模式 Playwright，以及相对实际 frontend base 的
   `UI_VISUAL_GATE=enforce npm run ui:check` 全部 PASS；
8. intercepted Backend Playwright 明确标注为前端边界测试，不把 fixture 证据表述成真实后端联调；
9. private evidence、token、subject 和 object coordinate 没有进入前端持久化或公开投影；
10. 工作区干净，提交只包含本 Spec 与 Plan 约定的前端变更。

## 16. 下一步

1. 使用当前仓库内的 `docs/superpowers/plans/2026-08-26-recruitment-p1c-frontend-wiring.md` 作为唯一实现 Plan；
2. Plan 自审覆盖本 Spec、无依赖聊天上下文的占位符，且路径、类型、方法名和 npm 命令与当前仓库一致；
3. 文档确认后，在独立实现 session 使用 `superpowers:subagent-driven-development`（推荐）或
   `superpowers:executing-plans` 按 Task 1→6 执行；
4. 每个任务使用 `superpowers:test-driven-development`，先写失败测试、实现最小改动、运行定向验证并提交；
5. Task 1→6 完成后使用 `superpowers:requesting-code-review`，处理发现并重跑完整前端验证；
6. 验证通过后使用 `superpowers:finishing-a-development-branch` 选择合并、PR、保留或丢弃实现分支。
