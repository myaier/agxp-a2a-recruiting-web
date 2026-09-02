# 前端 Handoff：Mutual Discovery 后端新合同接线（后端依赖增量）

> 本文可直接发送给另一台机器上的前端 Coding Agent，但只能在同批后端变更已经合并并提供精确 OpenAPI/commit 后规划实施。接收者不需要此前聊天、测试账号、浏览器会话、其它 Handoff 或任何本机路径。本文已经删去可基于当前 release 独立完成的纯前端工作。

## 1. 仓库、冻结基线与目标

- 前端仓库：`myaier/agxp-a2a-recruiting-web`
- 调查时前端 `origin/main`：`b2827dae16e89b199b487ab1564246b7b66e34f6`
- 当前可用后端基线：`origin/release/0.2.5@45f7323e34f6f6db11faee658144e28d338b36be`
- 运行模式：`VITE_DATA_SOURCE=backend`

当前 release 已足够支持以下纯前端能力，它们已迁移到 `docs/handoffs/2026-09-02-release-0.2.5-frontend-only-handoff.md`，不得在本文重复：

- 根据现有 Owner Job 组织验证字段提前显示推荐前置状态；
- candidate recommendation 深链恢复、安全返回和现有 delegation 状态展示；
- CandidateJob 城市、办公方式、办公地点、年薪月数等详情投影；
- 当前结构化经验/学历与自由文本 JD 的 truthful 说明。

本文只处理后端尚未提供的两个合同增量：

1. 招聘方发现推荐的精确 `organization_verification_required` 错误；
2. 岗位结构化经验/学历显式确认及未确认 match basis 的公开投影。

这两个增量的唯一后端依赖是：

`docs/handoffs/2026-09-02-discovery-job-truth-backend-handoff.md`

Hosted identity、Agent failure contracts 与 local runtime 不是本文的前端依赖，不得据此扩大 Plan。

## 2. 当前 release 的明确缺口

### 2.1 没有精确组织前置错误

`release/0.2.5` 在招聘岗位缺少 verified `hiring_organization_ref` 时可能返回通用：

```text
recommendation_unavailable
```

当前前端可以根据已经读取的 Owner Job 权威事实做预检，但无法在没有该事实的错误恢复路径中把通用错误稳定解释为“需要验证组织”。后端 Handoff 将新增 owner-safe 的 `organization_verification_required`。

### 2.2 没有结构化要求确认事实

当前 Job create/update 和 CandidateJob 只有：

```text
experience_requirement
education_requirement
requirements
```

没有 `structured_requirements_confirmed`、revision marker 或 `match_basis_unconfirmed` 等事实。前端现在只能如实解释字段边界，不能声称用户显式确认过结构化要求，也不能判断 legacy job 的经验/学历 match reason 是否可被表述为“满足”。

## 3. 交付 A：消费精确组织验证错误

### 3.1 前置条件

后端提交必须先冻结并交付：

- Recruiter recommendation refresh/list 的实际响应位置；
- exact HTTP status；
- exact error type `organization_verification_required`；
- fixed public message 与 error envelope；
- 两份 OpenAPI 和 BFF passthrough 测试；
- 一个 verified 控制组和一个 unverified owner-safe fixture。

Coding Agent 不得仅凭本文预先扩展 strict error enum；必须校准最终后端 commit。

### 3.2 前端行为

在现有 `P4错误文案`、data source 和 `src/屏幕/候选推荐.tsx` 中：

1. strict decoder 接受后端最终冻结的精确错误词与 envelope，未知词继续 fail closed；
2. 错误显示为持久 inline state，而不是短暂 toast；
3. 说明匿名候选人推荐需要已验证用人组织，并提供现有认证/加入企业 CTA；
4. 错误态不自动重试、不继续发送 refresh，也不把自由公司 claim 当成 organization ref；
5. 401 走统一会话清理，503/未知错误保持通用恢复，不误归因；
6. 如果页面同时持有 Owner Job，错误和 job verification facts 必须一致；合同矛盾时 fail closed 并禁止 mutation；
7. Mock 模式不解码 Backend error，也不改变 fixture。

### 3.3 测试

- exact HTTP/error envelope 映射持久组织说明；
- CTA 指向当前前端真实存在的角色正确入口；
- 该错误下 refresh 零重复请求；
- verified job 若收到矛盾错误，进入安全合同错误而不是篡改 job 状态；
- generic `recommendation_unavailable`、401、503 和未知词不被混同；
- strict key/enum、session fence 和 Backend/Mock 隔离不回归。

## 4. 交付 B：结构化要求显式确认与 match basis

### 4.1 前置条件

后端提交必须先冻结：

- Job create、full replace、sparse patch 是否新增确认字段；
- 字段 exact name、类型、required/nullability、CAS/revision 和 idempotency 语义；
- OwnerJob/CandidateJob 是否公开确认状态；
- Discovery match reasons 如何表达 confirmed、unconfirmed 或 unknown；
- legacy job 的读取、编辑和重新确认路径；
- exact closed errors，例如缺少确认时 create/update 的 400/409 语义；
- 两份 OpenAPI、migration 行为和 fixture。

在这些字段合并前，前端不得预埋猜测名称或发送未知 key。

### 4.2 发岗与编辑

最终合同合并后：

1. 经验和学历仍由现有结构化选择器产生；
2. 用户必须显式确认当前结构化选择是自动匹配依据；`none` 是合法选择，但不能由默认值静默确认；
3. 确认事实必须与当前表单 revision/选择绑定；修改经验或学历后旧确认失效并要求重新确认；
4. `requirements` textarea 继续只是补充文字，不被浏览器解析或自动同步；
5. mutation 只发送后端最终 schema，继续使用现有幂等、`If-Match`、错误恢复和权威重读；
6. legacy 未确认岗位可以读取和编辑，但不能在未确认时由前端伪造 confirmed；
7. 可访问反馈必须说明缺少的是“确认自动匹配依据”，而不是把用户合法的“不限”判成空值。

### 4.3 Candidate detail 与推荐理由

- confirmed 的结构化经验/学历可以继续以“按岗位设置的要求核对”呈现；
- unconfirmed/unknown 必须显示“该项尚未核对”或后端最终指定的安全文案；
- 不从 `requirements`、description、标签、match score 或历史推荐推断确认状态；
- 后端没有提供 match basis 时 fail closed，不显示“经验符合”“学历符合”等确定性理由；
- 更新岗位完成确认后，页面必须通过权威重读获得新 revision，不能本地乐观改写历史 recommendation。

### 4.4 测试

- create/edit 缺显式确认时零 mutation 或按最终后端合同显示精确错误；
- 用户显式选择 `none` 并确认可以保存；
- 修改结构化值使旧确认失效；
- textarea 中出现“本科/3 年”不改变结构化值或确认状态；
- legacy unconfirmed job 不显示确定性 match claim；
- confirmed 控制组继续显示后端允许的 reason；
- stale revision、idempotency replay、401 和未知 enum fail closed；
- Mock 行为不回归。

## 5. 不需要前端工作的同批后端能力

以下后端修改若不改变公开 schema，合并后由现有 refresh/list 自动生效，不应在本文制造前端任务：

- candidate→job 与 recruiter→candidate 的 category exact-match hard gate；
- recommendation ranking、cursor、持久化清理和 evaluator 调用阻断；
- Hub identity/enrollment 修复；该部分前端失败语义由 Hosted Agent 前端 Handoff 承接。

只有最终 OpenAPI 或 owner-visible behavior 实际变化时，后端 Handoff 才应给出明确下游 delta；前端 Agent 不从后端内部实现推断新 UI。

## 6. 推荐修改范围

```text
src/数据/BFF契约.ts
src/数据/招聘数据源/发现推荐.ts
src/数据/招聘数据源/岗位.ts
src/数据/发现推荐映射.ts
src/状态/后端/发现推荐操作.ts
src/屏幕/候选推荐.tsx
src/屏幕/发布岗位.tsx
src/屏幕/职位详情.tsx
```

测试文件跟随实际 owner。继续复用现有 data source、operation、strict decoder、session fence 和表单保存链，不在页面内新建 fetch 或第二套 Job draft。

## 7. 实施顺序与串行依赖

1. 后端先按 `2026-09-02-discovery-job-truth-backend-handoff.md` 完成相关 schema、OpenAPI、migration 和测试；
2. 后端 Handoff 提供精确 commit、DTO/error 表、legacy 行为和 fixture；
3. 前端 Agent fetch 最新前端主干，并先合入/校准纯前端 release/0.2.5 批次的提交；
4. 前端只对后端实际 diff 做 strict decoder、表单和显示增量；
5. 最后使用真实 Backend fixture 验证 verified/unverified 与 confirmed/unconfirmed 四个控制组。

本 Handoff 不能与尚未冻结的后端 schema 并行实施。若字段名、error status 或 match basis 仍未定，停止并要求后端提供最终合同，不建立临时兼容层。

## 8. 完成标准

- [ ] 前端只在后端合同合并后消费精确 `organization_verification_required`；
- [ ] 组织错误有稳定 CTA，且不把其它错误误归因；
- [ ] 发岗/编辑对结构化经验学历进行真实、revision-bound 的显式确认；
- [ ] `none` 与“未确认”语义分离；
- [ ] legacy unconfirmed job 不产生虚假的经验/学历满足结论；
- [ ] 自由文本 JD 不被浏览器解析为结构化 match basis；
- [ ] category hard gate 等无公开 delta 的后端修复没有制造额外前端状态；
- [ ] strict decoder、CAS、幂等、session fence、Mock 隔离和隐私边界不回归；
- [ ] 定向 Vitest、typecheck、lint、build 及后端提交对应的浏览器验收通过。
