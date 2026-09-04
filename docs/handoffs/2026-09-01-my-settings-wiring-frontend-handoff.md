# 前端 Handoff：“我”与设置页面 Backend 接线修复

> 本文可直接发送给另一台机器上的前端 Coding Agent。接收者不需要原测试账号、测试材料、浏览器会话、截图或此前聊天记录。所有代码路径均为仓库相对路径，不包含任何本机绝对路径。

> **2026-09-03 执行范围更新（优先于本文其它章节）：** 本文已经部分实施、部分迁移，不能再按原 14 项整包执行。唯一仍由本文负责的未完成范围是 `FE-ME-06/07`（个人信息的资源 owner）与 `FE-ME-09`（内置 Agent 偏好不得假保存）。`FE-ME-01`、`FE-ME-05` 和候选侧 `FE-ME-10` 已迁移到 `docs/handoffs/2026-09-03-frontend-data-truthfulness-handoff.md`；`FE-ME-12`、`FE-ME-14` 及候选实名的 UI 决策已迁移到 `docs/handoffs/2026-09-03-pm-claude-design-dogfood-ui-handoff.md`。`FE-ME-02`、用人侧 `FE-ME-03`、`FE-ME-04`、`FE-ME-08`、`FE-ME-11`、`FE-ME-13` 已在当前主干实现或经本轮 dogfood 验证，不得重复改造。后文保留原始调查背景，但所有标为迁移/完成的编号均为非执行项。

## 仓库与目标

- 前端仓库：`myaier/agxp-a2a-recruiting-web`
- 运行模式：`VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local npm run dev`
- 前端只请求同源 `/api/v1`；Backend 模式禁止失败后回退 Mock。

目标是修复求职侧和用人侧“我”、个人资料、账号设置、认证摘要、公司资料和 AI 代理设置中的 Mock 数据泄漏、角色资源未水合、可编辑控件假保存和合法缺失态永久 loading。

本文已排除现有后端 P3/P4/P5/P6/P8 路由故障。除文末明确列出的待新合同能力外，本轮前端修复不需要修改 BFF。

## 权威复现基线

### 求职侧

一个已有候选资料和 1 条 active 求职意向、但没有 MatchCase 和真人会话的账号，权威回读为：

```text
GET /api/v1/me/resume                                      200
GET /api/v1/me/intentions?status=active                    200，1 条
GET /api/v1/me/conversations                               200，0 条
GET /api/v1/me/match-cases?intention_id=...&limit=50       200，0 条
GET /api/v1/me/privacy                                     200
GET /api/v1/me/credentials                                 200，1 条 phone_otp
```

实际“我”页却显示：

```text
8 在谈 / 1 初筛中 / 5 待你拍 / 3 已归档
AI 代理正在跟进 8 个机会
```

其他现象：

- “谁接触过我”进入时没有业务请求，却显示五家演示公司的访问记录。
- 个人信息页姓名来自简历，但手机号、微信和邮箱为空。
- 同一账号的设置页通过 `/me/credentials` 能正确显示手机号。
- 个人信息页编辑手机号、微信、邮箱只改 React 内存，不发 mutation。
- 设置页固定显示“实名认证 已认证”，但当前没有候选实名权威资源。

### 用人侧

一个尚未完成首次招聘名片和企业加入的账号，权威回读为：

```text
GET /api/v1/recruiter/profile          404，档案尚未首次创建
GET /api/v1/recruiter/affiliations     200，0 条
GET /api/v1/recruiter/jobs             200，0 条
GET /api/v1/recruiter/agent-rules      200，0 条
GET /api/v1/recruiter/conversations    200，0 条
```

实际 UI：

- “我”页显示 `0 在招岗位`，却同时显示 `5 在谈 / 2 待拍板`。
- 设置页固定显示“企业实名认证 已认证”。
- 仓库已有的 `/#/hr/verify` 权威摘要页对同一账号正确显示“未实名 / 个人身份未认证 / 任职暂无 / 管理员申请暂无”。
- 招聘名片在 profile 404 状态下填写姓名、职务后点保存，零 profile mutation，并显示“网络连接失败”。
- 公司资料页永久显示“正在加载企业资料”，没有请求也没有可操作空态。

### 交互登录与刷新差异

短信登录成功只出现登录完成和 `GET /me`。直接进入 AI 代理设置会永久停在“规则加载中”；刷新后才请求角色支持域并显示真实的 0 条规则。求职侧简历、意向、隐私、附件和 Agent 规则存在同一问题。

## 修复任务与归因

| 编号 | 优先级 | 现象 | 归因 |
| --- | --- | --- | --- |
| FE-ME-01 | P0 | 【已迁移】两端“我”页显示 Mock 的在谈、待办、归档和代理跟进数 | 由 2026-09-03 数据真相源 Handoff 独占 |
| FE-ME-02 | P0 | 【已完成】短信登录后角色资源未加载，刷新才正常 | 当前主干已在登录完成前调用角色水合 |
| FE-ME-03 | P0 | 【用人侧已完成；候选侧已迁移】设置页认证事实 | 候选侧由 2026-09-03 数据/PM Handoff 分工 |
| FE-ME-04 | P0 | 【已完成】profile 404 时招聘名片无法首写 | 当前主干已支持首写并经 dogfood 验证 |
| FE-ME-05 | P0 | 【已迁移】“谁接触过我”显示虚构公司 | 由 2026-09-03 数据真相源 Handoff 独占 |
| FE-ME-06 | P1 | 个人信息手机号为空且编辑不换绑 | 本页仍读写 `状态.联系方式`，未复用 P8 credential/replacement |
| FE-ME-07 | P1 | 头像、微信、邮箱看似保存但不跨设备 | Backend 下头像仅 sessionStorage，微信/邮箱仅内存 |
| FE-ME-08 | P1 | 【已完成】公司资料在无 affiliation 时永久 loading | 当前主干已展示合法缺失态 |
| FE-ME-09 | P1 | 两端“先问我”偏好刷新后丢失 | 只派发本地 reducer，没有读写合同 |
| FE-ME-10 | P1 | 【已迁移】求职设置固定显示“实名认证 已认证” | 数据门控与 UI 设计由两份 2026-09-03 Handoff 分工 |
| FE-ME-11 | P2 | 【已完成】求职状态胶囊固定“在职 · 保密求职中” | 当前主干已隔离 Backend 与 Mock 身份文案 |
| FE-ME-12 | P2 | 【已迁移 PM】用人披露页全部禁用却写“改动即时生效” | 由 PM/Claude Design Handoff 独占设计 |
| FE-ME-13 | P2 | 【已完成】用人导出文案仍说“你的简历” | 当前主干已使用角色中性业务记录文案 |
| FE-ME-14 | P2 | 【已迁移 PM】屏蔽名单搜索无命中时没有解释 | 由 PM/Claude Design Handoff 独占设计 |

## FE-ME-01：已迁移，不在本文执行

两端“我的”页 MatchCase 统计及代理跟进数已由 `docs/handoffs/2026-09-03-frontend-data-truthfulness-handoff.md` 独占。该文档基于当前 P5 状态补充了精确统计口径、加载/失败语义和回归要求。执行本文的 Agent 不得修改 `我的.tsx`、`企业我的.tsx` 或 P5 聚合 selector 来处理这一编号。

## FE-ME-02：让交互登录完成角色水合

关键代码：

- `src/状态/后端/会话操作.ts`
- `src/状态/应用状态.tsx`
- `src/屏幕/登录.tsx`
- `src/应用.tsx`

`创建会话操作().完成手机登录` 当前只完成 attempt、读取主体、清跨账号状态、写 subject fence/generation 并设置登录态。它没有调用同文件已有的 `水合角色数据(...)`。冷启动恢复和切身份均已调用该函数。

实现要求：

1. 读到主体后，先完成现有跨账号清理和 generation 更新。
2. `last_used_role` 非空时调用公共 `水合角色数据`，不要复制各资源 GET。
3. 水合结算且会话未失效后才设置 `已登录=true`，防止根路由提前进入空主壳。
4. `last_used_role=null` 不读角色域，进入身份选择。
5. Backend 登录后的导航只保留一个所有者；删除登录页和根路由的竞争跳转。
6. 保持现有 401 清理、stale response fence、同/跨 subject、StrictMode 语义。

## FE-ME-03：认证状态只显示权威事实

### 用人侧

关键代码：

- `src/屏幕/企业设置.tsx`
- `src/屏幕/企业实名认证.tsx`
- `src/数据/组织映射.ts`
- `src/路由/路径表.ts`

要求：

- 删除企业设置中的固定“已认证”。
- 复用 `从BFF招聘身份(...)`，分别展示个人验证、当前任职和管理员申请状态；或让整行进入现有 `路径.企业实名认证`。
- 不得根据公司名非空推断已认证。

### 求职侧

关键代码：

- `src/屏幕/设置.tsx`

候选侧认证真相门控已迁移到 `docs/handoffs/2026-09-03-frontend-data-truthfulness-handoff.md`，具体呈现由 `docs/handoffs/2026-09-03-pm-claude-design-dogfood-ui-handoff.md` 决定。本文执行者不得重复修改。

## FE-ME-04：支持 recruiter profile 首写

关键代码：

- `src/屏幕/招聘名片.tsx`
- `src/状态/后端/组织操作.ts`
- `src/数据/招聘数据源/组织.ts`
- `src/状态/后端/会话操作.ts`

现有 BFF 合同使用：

```text
PATCH /api/v1/recruiter/profile
If-Match: "0"   # profile 尚不存在时首写
```

实现要求：

1. `GET /recruiter/profile` 的 404 映射成合法“尚未创建”水合态，继续 affiliations/jobs 水合。
2. 保存时 profile 缺失走 `If-Match: "0"`，不要在操作层同步抛 `招聘方档案尚未水合`。
3. 首写成功后用响应 revision 权威回写；后续保存继续正常 CAS。
4. 失败保留输入并显示真实错误；普通本地 Error 不得映射成“网络连接失败”。
5. 首次保存和已有档案编辑的导航行为分开：首次完成进入发布岗位，编辑保存留页或返回。

## FE-ME-05：已迁移，不在本文执行

后端 contact-events 合同现已上线，旧的“新 API 上线前只隐藏 Mock”方案已经过期。完整 data source、operation、分页和页面接线由 `docs/handoffs/2026-09-03-frontend-data-truthfulness-handoff.md` 独占。执行本文的 Agent 不得同时处理接触记录。

## FE-ME-06/07：按资源 owner 重做个人信息

关键代码：

- `src/屏幕/个人信息.tsx`
- `src/屏幕/设置.tsx`
- `src/屏幕/账号安全.tsx`
- `src/状态/资料持久化.ts`
- `src/数据/招聘数据源/P8控制面.ts`

要求：

1. 姓名继续由候选简历 profile 的 PATCH 管理；该链已正常。
2. 手机号展示读取 P8 credentials 中唯一 `phone_otp` 的服务端 `display`。
3. 点手机号编辑必须复用账号安全的 replacement 两步流或跳转该流程，不能派发 `存联系方式`。
4. 微信和邮箱若已有 credential，可按 `wechat` / `email_otp` 展示服务端掩码；没有绑定 mutation 前显示“未绑定/暂不支持”，不要显示可保存输入框。
5. Backend 候选头像当前只写 sessionStorage。新合同上线前应明确标为仅本机临时，或在 Backend 模式隐藏上传；不能提示成跨设备保存成功。
6. Backend 模式不得使用 Mock 联系方式或 Mock 人名兜底。

## FE-ME-08：公司资料合法缺失态

关键代码：

- `src/屏幕/公司档案编辑.tsx`
- `src/屏幕/公司档案分区编辑.tsx`
- `src/屏幕/企业实名认证.tsx`

要求：

- 0 affiliation：显示“尚未加入企业”，提供“申请企业管理员/输入邀请口令”入口。
- pending：显示审核中。
- revoked/suspended：显示不可用状态与处理入口。
- verified member：只读。
- verified admin + active organization：加载并允许编辑企业档案。
- 只有请求确实进行中才显示 loading；`企业档案快照 === null` 不能单独等价为加载中。

## FE-ME-09：内置 Agent 偏好不得假保存

关键代码：

- `src/屏幕/规则库.tsx`
- `src/屏幕/企业代理设置.tsx`
- `src/状态/领域/Agent规则.ts`

“发送材料先问我/自动发送”和“超授权让步先问我/直接回绝”当前直接派发 `设先问偏好`，Backend 刷新后回默认值。

在新合同上线前，Backend 模式应禁用并解释，或暂时隐藏。新合同上线后必须使用服务端快照、revision/If-Match 和失败回滚，不能继续把本地 reducer 当权威。

## FE-ME-11～14：已实施或迁移，不在本文执行

1. `FE-ME-11` 候选身份文案已在当前主干做 Backend/Mock 隔离。
2. `FE-ME-12` 企业固定披露机制的 UI/copy 设计已迁移到 PM/Claude Design Handoff。
3. `FE-ME-13` 账号导出已使用角色中性业务记录文案。
4. `FE-ME-14` 屏蔽搜索无结果的 UI/空态设计已迁移到 PM/Claude Design Handoff。

## 已确认正常，不要重复改造

| 能力 | 权威链路 | 结论 |
| --- | --- | --- |
| 求职披露偏好、现雇主隐身 | `GET/PATCH /api/v1/me/privacy` + `If-Match` | 已接通 |
| 求职屏蔽名单 | `/organizations` + privacy organization-block mutation | 已接通，必须选择稳定组织 ID |
| 双端历史代谈 | P5 completed/ended history | 已接通 |
| 用人已筛掉 | P4 各在招岗位 rejected 推荐聚合 | 已接通 |
| 岗位管理、归档、重开、删除 | owner jobs API | 已接通；同页分“在招/已归档”是设计行为 |
| 自定义 Agent 规则与提案 | 双端 P6 | 已接通；问题是登录水合和内置偏好 |
| 会话、退出其他设备、换绑、导出、注销 | P8 | 已接通 |
| 产品反馈 | `POST /api/v1/compliance/feedback` | 已接通，实测返回真实工单号 |
| 无目标举报不提交 | 具体 job/MatchCase/conversation 才可举报 | 正确行为 |

## 必须先写的回归测试

1. `个人信息.test.tsx`：Backend 手机号来自 P8；编辑不派发 `存联系方式`；微信/邮箱无 mutation 时不伪造成功。
2. 双端规则页：新合同前内置偏好不可产生已保存假象；合同上线后刷新仍保持。

## 浏览器验收

1. candidate 个人信息页的手机号来自凭据；没有服务端 owner 的微信、邮箱和头像不产生已保存假象。
2. 双端内置 Agent 偏好不再把本地 reducer 当成 Backend 已保存事实。
3. 求职披露、屏蔽名单、历史、岗位管理、已筛掉、账号安全和产品反馈不回归。

## 验证命令

```bash
npm test -- src/状态/初始状态.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
npm test -- src/屏幕/个人信息.test.tsx src/屏幕/账号安全.test.tsx
npm test -- src/屏幕/规则库.test.tsx src/屏幕/企业代理设置.test.tsx src/屏幕/账号安全.test.tsx
npm run typecheck
npm run lint
npm run build
```

不存在的测试文件应按本文创建，不要从长期验证命令中删掉。
