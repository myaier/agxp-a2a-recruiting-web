# Backend + Local Onboarding Dogfood 运行摘要（2026-09-01）

> 本文是可提交的脱敏摘要。它不包含测试手机号、验证码、Cookie、request ID、原始材料文件名、本机路径或真实联系方式；临时截图、视频和网络记录不属于仓库工件。

## 基线与范围

- 前端 commit：`034874fb6d938bf4f02e7e40e0707e00d7eec289`
- 分支：`build-start-frontend-backend-local-manual-test`
- 数据源：`backend/local`
- 工具：可见 Chrome、CDP、`agent-browser`
- 覆盖：全新候选人 onboarding、全新招聘方 onboarding、已有候选人交互登录水合、求职意向增改查、两端“我”与设置页、刷新/重登录恢复和服务端权威回读
- 可复跑测试例：[`docs/dogfood/backend-local-onboarding.md`](../dogfood/backend-local-onboarding.md)

两条首次 onboarding 路径使用不同的新测试账号；后续登录、意向和设置回归使用已建档账号。候选材料和 JD 均在运行时从仓库外提供；本文只保留其业务基线，不保留个人联系方式或文件坐标。

## 候选人侧结论：FAIL

执行范围：上传候选简历、走社招 onboarding、填写基本信息/教育，并按约束只保留 1 条经历、1 个技能和 1 个证书；随后检查在线简历、求职意向、个人信息和权威接口。

主要结果：

- PDF 上传与预览成功，但异步解析终态为 `failed/parser_invalid_output`，没有形成预填。
- 已填写的薪资/到岗草稿会在流程重入或刷新时丢失。
- 经历、技能和证书保存前发生前端阻断，相应 mutation 没有发出；刷新后服务端仍为 0 条。
- 首次 active intention 没有创建。
- 个人信息页没有复用凭证接口已有的掩码手机号。

完整、可独立转交的归因：

- [`docs/handoffs/2026-09-01-candidate-onboarding-triage.md`](../handoffs/2026-09-01-candidate-onboarding-triage.md)
- [`docs/handoffs/2026-09-01-candidate-onboarding-frontend-handoff.md`](../handoffs/2026-09-01-candidate-onboarding-frontend-handoff.md)
- [`docs/handoffs/2026-09-01-candidate-onboarding-backend-handoff.md`](../handoffs/2026-09-01-candidate-onboarding-backend-handoff.md)

## 招聘方侧结论：FAIL

执行范围：上传/对照 JD、选择招聘方身份、填写招聘名片、手工创建 1 条岗位，并检查招聘方个人信息、公司资料、设置、岗位信息和权威接口。

主要结果：

- 新 recruiter profile 的正常 404 被前端当成致命错误，首次角色选择停在身份页；重登录又仅凭 `last_used_role` 跳过 onboarding。
- 招聘名片首次保存发生本地阻断，没有 profile mutation。
- 发布岗位没有 JD 导入入口；手填时 UI 未采集公司 display name 和独立 requirements，JobCreate 被 422 拒绝。
- remote 岗位仍要求虚构实体办公地址。
- 无企业关系时公司资料永久 loading，设置页却固定显示“企业实名认证 已认证”。
- 招聘方账号的数据导出仍使用候选人“简历”文案，页面 viewport 禁止缩放。

完整、可独立转交的归因：

- [`docs/handoffs/2026-09-01-employer-onboarding-triage.md`](../handoffs/2026-09-01-employer-onboarding-triage.md)
- [`docs/handoffs/2026-09-01-employer-onboarding-frontend-handoff.md`](../handoffs/2026-09-01-employer-onboarding-frontend-handoff.md)
- [`docs/handoffs/2026-09-01-employer-onboarding-backend-handoff.md`](../handoffs/2026-09-01-employer-onboarding-backend-handoff.md)

## 追加走查：已有候选人登录与求职意向

首次 onboarding 失败之后，又使用一个服务端已有简历的候选账号执行了独立回归。这条回归证明“交互登录水合失败”和“求职意向写入合同”是两个不同问题：前者失败，后者从正常 UI 可以完整走通。

### 实际路径

```text
/#/settings 退出登录
→ /#/ 完成 OTP 登录
→ /#/app
→ /#/resume
→ /#/intentions
→ /#/intentions/new
→ /#/intentions/cities
→ /#/intentions/industries
→ /#/intentions
→ /#/intentions/:id
→ 保存修改
→ 再次打开 /#/intentions/:id 并刷新
→ 退出、重新登录、再看 /#/resume 与 /#/intentions
```

结果：

- 已有账号短信登录后只完成登录和 `GET /api/v1/me`，没有加载 resume/intentions；不刷新进入简历和意向页时显示空数据。
- 保持登录 Cookie 直接刷新后，冷启动恢复链加载了真实简历和意向，说明服务端数据仍在。
- 从 `/#/intentions/new` 创建 1 条意向成功，POST 返回 201 和 revision 1；列表权威 GET 随后返回 1 条。
- 从 `/#/intentions/:id` 重新打开时字段正确预填；修改并保存时 PATCH 携带 `If-Match: "1"`，返回 revision 2，随后 GET 与页面一致。
- 再次打开和刷新编辑页，修改保持。已确认意向 DTO 映射、创建、更新、CAS revision、权威重读和回显链正常。
- 薪资双滚轮通过连续滚动可以保存，但键盘和直接点击 option 的交互不完整，需作为可访问性回归保留。

独立修复入口：

- [`docs/handoffs/2026-09-01-candidate-login-hydration-and-intention-handoff.md`](../handoffs/2026-09-01-candidate-login-hydration-and-intention-handoff.md)

## 追加走查：候选人“我”与设置页

### 实际路径

```text
/#/app 的“我”Tab
├─ /#/profile
├─ /#/resume
├─ /#/intentions
├─ /#/rules
├─ /#/archived
└─ /#/settings
   ├─ /#/account
   ├─ /#/disclosure-prefs
   ├─ /#/blocklist
   ├─ /#/visitors
   ├─ /#/help
   ├─ /#/feedback
   └─ /#/terms
```

权威基线为 1 条 active intention、0 conversation、0 MatchCase；页面/接口对照结果：

- “我”页仍显示 `8 在谈 / 1 初筛中 / 5 待你拍 / 3 已归档`，AI 卡显示正在跟进 8 个机会，来自前端 Mock 种子。
- `/#/profile` 能显示简历姓名，但没有复用 credentials 已有的掩码手机号；微信、邮箱和头像的编辑没有跨设备权威持久化。
- `/#/settings` 手机号能够从 P8 credentials 显示，但固定写“实名认证 已认证”，当前没有候选实名权威资源。
- `/#/visitors` 没有发业务请求，却显示五条演示公司记录。
- `/#/disclosure-prefs` 的 P3 GET/PATCH、`/#/account` 的 P8 会话/换绑/导出/注销、反馈提交和上下文举报链已确认可用，不应因为周边假数据而重写后端。
- `/#/blocklist` 使用稳定 organization ID 的约束正确，但目录搜索无结果时缺少解释。
- `/#/rules` 的自定义 P6 规则合同存在；系统内置“先问我”偏好只改本地状态，刷新丢失。

## 追加走查：招聘方“我”与设置页

### 实际路径

```text
/#/hr 的“我”Tab
├─ /#/hr/card
├─ /#/hr/jobs
├─ /#/hr/company-profile
├─ /#/hr/agent-settings
├─ /#/hr/disclosure
├─ /#/hr/archived
├─ /#/hr/verify（直接打开，与设置摘要对照）
└─ /#/hr/settings
   ├─ /#/account
   ├─ /#/hr/agent-settings
   ├─ /#/hr/disclosure
   ├─ /#/help
   ├─ /#/feedback
   └─ /#/terms
```

权威基线为 recruiter profile 404、0 affiliation、0 job、0 Agent rule、0 conversation、0 MatchCase；页面/接口对照结果：

- “我”页在 0 岗位状态仍显示 `5 在谈 / 2 待拍板`，来自前端演示候选数组。
- `/#/hr/card` 把合法 profile 404 当成不可保存状态；填写姓名和职务后没有 profile mutation。后端现有 PATCH + `If-Match: "0"` 已支持首写。
- `/#/hr/company-profile` 在 0 affiliation 时永久 loading，且没有业务请求；应显示未加入/未认证组织的空态。
- `/#/hr/settings` 固定写“企业实名认证 已认证”，但同账号的 `/#/hr/verify` 正确显示个人未实名、无任职和无管理员申请。
- `/#/hr/agent-settings` 在交互登录后永久显示规则加载中；刷新触发角色水合后正确显示 0 条。系统内置授权偏好仍只存本地。
- `/#/hr/disclosure` 所有档位均为固定禁用，却仍写“改动即时生效”，把产品规则伪装成设置。
- 共用 `/#/account` 的招聘方数据导出文案仍写“简历”；P8 API 本身正常。

两端“我”与设置接线的独立修复入口：

- [`docs/handoffs/2026-09-01-my-settings-wiring-frontend-handoff.md`](../handoffs/2026-09-01-my-settings-wiring-frontend-handoff.md)
- [`docs/handoffs/2026-09-01-my-settings-wiring-backend-handoff.md`](../handoffs/2026-09-01-my-settings-wiring-backend-handoff.md)

## 运行方法沉淀

本轮确认有效、已写入复跑测试例的方法：

1. 为每个角色启动独立、可见、CDP-enabled Chrome profile，让用户可观察且账号状态互不污染。
2. 每次页面变化后重新 snapshot，绝不复用 stale `@eN`。
3. 正常步骤不固定 sleep；同一命令连续动作或录制复现视频时约间隔 1 秒。
4. 只通过正常 UI 产生业务 mutation；结束后用同 session 的只读 GET 汇总服务端权威状态。
5. 问题一经确认立即记录；静态问题截图，交互问题复验后再录视频/HAR。
6. dogfood 阶段只按用户视角观察，不读源码；前后端归因在走查完成后单独进行。
7. 临时证据全部进入 `dogfood-output/`，长期文档只保留脱敏、自包含的事实和结论。

## 后续复验入口

修复合并后，在新的全新账号上重跑 `CAND-ONB-001` 和 `EMP-ONB-001`；再使用已建档账号重跑 `CAND-AUTH-001`、`CAND-INT-001`、`CAND-ME-001` 和 `EMP-ME-001`。不得复用本次已污染/部分建档账号判断 onboarding 首次路径。复验摘要另建新日期文档，链接本摘要和精确修复 commit，不回写本次 FAIL 为 PASS。
