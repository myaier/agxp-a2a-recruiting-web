# Mutual Discovery 前端合同接线设计

## 1. 背景与目标

本设计消费 `docs/handoffs/2026-09-02-mutual-discovery-frontend-handoff.md` 中两项后端增量：

1. 招聘方刷新候选推荐时的精确 `organization_verification_required` 错误。
2. 岗位结构化经验/学历要求的显式确认，以及推荐批次冻结的 match basis。

校准基线：

- 前端：`ee64c560`
- 后端：`release/0.2.5@37661dee9`
- 后端合同提交：`c1bb26ce9`
- 后端补强提交：`84d10f1e3`
- 运行模式：`VITE_DATA_SOURCE=backend`

目标是用最小纵切复用现有 DTO → data source → operation → screen 链路：只在用户真实确认时发送确认事实，只在历史推荐批次确实带有 confirmed basis 时展示确定性理由，并在组织认证竞态中以权威重读收敛。

## 2. 工程取舍与边界

采用“合同对齐的最小纵切”：

```text
BFF OpenAPI
  → BFF契约.ts（wire 类型）
  → 岗位/发现推荐 data source（strict decode）
  → 后端映射/发现推荐映射（写入与页面投影）
  → 现有 operation（CAS、幂等、session fence）
  → 现有页面
```

不新建 Job Truth 状态机、第二套 Job draft、页面内 fetch 或临时兼容层。

唯一必要的新 seam 是路由级 strict error contract：现有 HTTP 客户端构造 `BFF错误` 后会丢失原始 error envelope 的 exact-key 信息，无法满足本次 status/type/fixed message/request_id/精确键集的实际要求。因此为请求选项增加仅由 recruiter refresh 启用的严格错误合同，不改变其他请求。它直接防止同名错误的 status/message/envelope 漂移被误解为组织事实。

## 3. 冻结后端合同

### 3.1 岗位确认

- `JobCreate.structured_requirements_confirmed` 必需、非空、`const: true`。
- `JobPatch.structured_requirements_confirmed` 可选、非空、`const: true`。
- Patch 携带 `experience_requirement`、`education_requirement` 或 `requirements` 任一字段时，必须同请求携带 `true`。
- Patch 显式携带 `false` 在任何情况下都非法。
- `OwnerJob` 和 `CandidateJob` 必返 boolean 确认事实。
- legacy Job 经 migration 读取为 `false`，前端不得默认成 `true`。

经验要求闭合为 `none | one_to_three_years | three_to_five_years | five_plus_years | ten_plus_years`；学历要求闭合为 `none | associate | bachelor | master | doctorate`。

### 3.2 历史推荐 basis

- `DiscoveryCandidateCard` 和 `DiscoveryRecruiterCard` 顶层必返 `structured_requirements_confirmed: boolean`。
- 该值是生成不可变批次时冻结的 Job basis，不是岗位当前 revision 的值。
- `DiscoveryBatch.ranking_version` 闭合为 `discovery-ranking.v1 | discovery-ranking.v2`。

### 3.3 组织认证错误

招聘方 `POST /api/v1/recruiter/candidate-recommendation-refreshes` 可返 HTTP 409：

```json
{
  "error": {
    "type": "organization_verification_required",
    "message": "A verified organization is required to discover candidates.",
    "request_id": "<non-empty>"
  }
}
```

根对象和 `error` 对象均 `additionalProperties: false`。该错误只属于 recruiter refresh。

## 4. 数据、解码与错误合同

### 4.1 Wire 类型

`src/数据/BFF契约.ts` 增加：

- OwnerJob、CandidateJob、双端推荐卡的必需 boolean 字段。
- 经验/学历的闭合 union，避免开放 `string` 掩盖漂移。
- DiscoveryBatch 的 v1/v2 union。
- `BFF岗位创建` 将确认建模为字面量 `true`；`BFF岗位补丁` 为可选 `true`。

### 4.2 Success decoder

`src/数据/招聘数据源/岗位.ts` 在 OwnerJob 进入页面快照前校验确认字段和经验/学历枚举。缺失、错类型或未知枚举转为 `invalid_response`。

`src/数据/招聘数据源/发现推荐.ts` 在现有 exact-key decoder 中：

- CandidateJob 必需确认字段并闭合经验/学历枚举。
- 双端推荐卡必需顶层 boolean basis。
- DiscoveryBatch 接受 v1/v2，拒绝其他字符串。
- 不为缺失字段填默认值。

### 4.3 Strict error contract

`src/数据/HTTP客户端.ts` 为 JSON 请求增加 route opt-in 的 strict error contract。启用时，非 2xx 响应在构造 `BFF错误` 前先验证：

- status/type 组合属于路由 OpenAPI 白名单。
- 根对象只有 `error`，`error` 键集精确符合匹配 schema。
- fixed message 精确一致，`request_id` 是非空字符串。
- 未知 type、错 status/message、缺键或额外键均转为 `invalid_response`。
- 既有受控幂等重试语义不变。

仅 recruiter refresh 在发现推荐 data source 传入该合同；其他路由继续现有行为。

## 5. 发岗与编辑

### 5.1 表单交互

页面岗位模型增加可选“结构化要求已确认”字段。Backend 水合时从 OwnerJob 原样投影；Mock 不依赖该字段。

Backend 发岗第三步在 `requirements` 补充文字之后显示原生可访问 checkbox：

> 我已确认经验和学历设置将作为自动匹配依据；补充要求不会被自动解析。修改上述内容后需要重新确认。

规则：

- 新建默认不勾选；经验/学历都是“不限”也必须主动确认。
- confirmed OwnerJob 初始勾选；legacy `false` 初始不勾选。
- 经验、学历或 `requirements` 任一值改变时立即取消勾选。
- 无关字段变化不影响确认状态。
- 缺确认时停留第三步，显示“请确认经验和学历将作为自动匹配依据”，零 mutation。
- Mock 不显示 checkbox，不增加 payload 字段。

### 5.2 Create 与 sparse Patch

`src/数据/后端映射.ts` 在确认不为 `true` 时拒绝生成 Create。通过时发送字面量 `structured_requirements_confirmed: true`。`none` 是合法选择，与未确认语义独立。

将 `转岗位补丁(页面岗位, previous)` 收敛为真实 sparse diff：

- 先将页面值转成最终 wire 值，再与 `previous` 比较。
- 只输出实际变化字段。年薪月数、届别等按 OpenAPI absent/null 三态语义生成；`keywords: []` 仍表示清空。
- 页面不可编辑的 immutable 字段和服务端专有 organization 事实不再无条件回传。
- 经验、学历或 trim 后 `requirements` 变化时，变化字段与 `structured_requirements_confirmed: true` 同请求发送。
- 三者均未变化时省略确认字段，服务端保留既有事实。
- 前端永不发送 `false`。
- legacy false 岗位可仅修改无关字段，不伪造确认。

mutation 继续现有 `If-Match` 和幂等规则。成功后只以 Owner Jobs 权威重读的 revision/确认值水合页面，不乐观改写历史推荐。

## 6. 推荐展示

页面投影显式分开：

- `P4岗位事实.结构化要求已确认`：当前 CandidateJob 事实。
- `P4候选岗位页面.匹配依据已确认`：推荐详情来自卡顶层，直接 Job 详情为 `null`。
- `P4招聘候选页面.匹配依据已确认`：来自招聘卡顶层。

不得用嵌入 CandidateJob 的当前值覆盖卡顶层历史值。

| 场景 | 匹配分 | 理由/亮点 |
| --- | --- | --- |
| 推荐卡 basis=`true` | 保留后端历史分数 | 显示后端理由 |
| 推荐卡 basis=`false` | 保留后端历史分数 | 整组收起，显示“经验与学历尚未核对” |
| 直接 CandidateJob 详情 | 不伪造推荐分 | 显示当前岗位事实，匹配分析保持中性 |

岗位详情可显示“结构化设置：已确认/尚未确认”，但没有推荐卡 basis 时不显示“经验符合”“学历符合”等确定性结论。

`match_reasons` 和 `highlights` 是无类型标记的开放字符串数组。basis 为 `false` 时整组收起，不用正则、关键词或文案模板选择性过滤。候选岗位详情、招聘候选卡和匿名简历详情使用同一规则。

## 7. 组织错误收敛

现有 OwnerJob 预检仍是第一道门：verified 和非空 `hiring_organization_ref` 缺任一项就不发 refresh。精确错误收敛“发请时本地仍 ready，但后端事实已变”的竞态。

收到通过 strict contract 的精确 409 后：

1. refresh POST 终止，不自动重试，不换幂等键重发。
2. operation 只执行一次 Owner Jobs GET。
3. 重读受 subject/role/session/scope generation fence 保护；换岗、换角色或登出后的迟到结果整包丢弃。
4. 若权威岗位为 unverified 或缺 ref，通过现有岗位水合动作与后端快照提交新事实。
5. 页面复用现有持久受阻态：“去认证”进入 `/hr/verify`，“加入企业”进入 `/hr/organization-invitation`。
6. 若权威岗位仍为 verified 且有 ref，则转为 `invalid_response`，显示持久“数据状态异常”并禁用当前岗位 refresh。
7. 合同阻断保持为屏幕局部、按 job scope 隔离的状态；切岗或重新进屏后重置。
8. Owner Jobs GET 的 401 统一清会话；503/未知错误保持通用恢复，不显示认证 CTA。

自由公司 claim 不得当作 organization ref。旧 `recommendation_unavailable` 不再解释为组织认证错误。组织错误使用持久 inline state，不仅弹 toast。

## 8. 权威性与并发不变量

- Create 继续现有幂等键，Patch 继续现有 `If-Match`/CAS；不引入第二 revision marker。
- stale revision 沿用岗位 operation 权威重读，表单本地值不被失败响应静默改写。
- 组织对账不重发 refresh POST；受控幂等重试只保留现有 OpenAPI 允许的语义。
- 当前 fence 内的 401 清账号，迟到 401 不清新会话。
- 未知 success enum/key 与 strict error contract 漂移都 fail closed。
- 页面不直接显示后端英文 message；未知 HTTP error 收敛为通用错误文案。

## 9. 测试与验收

### 9.1 Mapper 与岗位 data source

- Create 未确认时请求前拒绝；确认后 body 携带字面量 `true`。
- `none` + 显式确认生成合法 Create。
- Patch 只携带变化字段；三个相关字段的变化都携带 `true`。
- 无关编辑省略确认字段，legacy false 不被改写。
- null/空数组 sparse 语义按 OpenAPI 保持。
- OwnerJob 确认字段 true/false 接受，缺失/错类型拒绝。
- 经验/学历合法枚举接受，未知值拒绝。

### 9.2 发岗页

- Backend 新建默认未确认，点提交零 mutation。
- 保留“不限”并勾选后可发布。
- 勾选后分别修改经验、学历、`requirements`，checkbox 均取消。
- textarea 中出现“本科”“3 年”不改变结构化选择。
- confirmed 编辑初始勾选，legacy false 初始未勾选。
- legacy false 仅修改无关字段可保存且不携带确认。
- Mock 不出现 checkbox，原行为不变。

### 9.3 发现推荐 decoder 与页面

- CandidateJob 与双端卡的 basis true/false 接受，缺失/错类型/多键拒绝。
- ranking v1/v2 接受，`v2` 等非法缩写拒绝。
- 历史 false + 嵌入 Job 当前 true 时仍收起理由。
- confirmed 控制组显示 reasons/highlights。
- unconfirmed 候选详情、招聘卡和匿名详情均不显示确定性理由。
- 直接 CandidateJob 不拿当前 true 伪造历史 basis。

### 9.4 组织错误与 operation

- 精确 409/error envelope 进入组织对账。
- status、type、message、request_id、根键或 error 键任一漂移进入 `invalid_response`。
- 每次用户意图最多一次 refresh POST + 一次 Owner Jobs GET，零重复 POST。
- 重读后 unverified/缺 ref 提交岗位快照并显示两个 CTA。
- 重读后仍 verified+ref 进入持久合同阻断，refresh 禁用。
- Owner Jobs GET 的 401/503/迟到响应覆盖统一清会话、通用恢复和 fence 丢弃。
- `recommendation_unavailable`、401、503 和未知 type 不显示组织 CTA。

### 9.5 完整验证

执行定向 Vitest、全量测试、typecheck、lint 和 build。Backend fixture 验收四组：

```text
verified organization + confirmed basis
verified organization + unconfirmed legacy basis
unverified organization + confirmed Job
unverified organization + unconfirmed legacy Job
```

同时确认 Mock 不解码 Backend error、不增加确认 UI、不改变 fixture。

## 10. 非目标与延后条件

本次不做：

- 不为 category exact-match hard gate 制造新前端状态。
- 不处理 Hosted Agent failure contracts、watch 或 local runtime。
- 不解析 `requirements`、description、标签或推荐理由文字。
- 不追溯改写 legacy Job 或历史推荐的确认事实。
- 不用当前 Job 重新解释旧批次。
- 不引入新全局状态机、通用 schema 框架、第二套 Job draft 或页面内 fetch。
- 不改变 Mock 产品语义。

只在出现以下证据时重新考虑更通用的抽象：多个独立路由都需要同类 route-specific strict error schema，或多个业务域都开始维护“当前事实 vs 历史冻结 basis”状态机。

## 11. 完成标准

- 只消费后端已冻结的字段、枚举和错误合同。
- 新建和相关编辑需要真实显式确认；`none` 与未确认独立。
- sparse Patch 不迫使 legacy 岗位在无关编辑中伪造确认。
- 历史 unconfirmed 推荐不展示经验/学历等确定性理由。
- 组织错误提供持久 CTA，且不将其他错误误归因。
- 合同矛盾、未知字段/枚举/错误词均 fail closed。
- CAS、幂等、session fence、隐私边界与 Backend/Mock 隔离不回归。
- 定向测试、全量测试、typecheck、lint、build 和四组 Backend fixture 验收通过。
