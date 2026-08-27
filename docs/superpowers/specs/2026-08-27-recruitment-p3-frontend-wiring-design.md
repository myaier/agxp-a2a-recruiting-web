# Recruitment P3 前端接线设计

**日期：** 2026-08-27

**状态：** 设计已获用户逐段确认，待用户审阅本文后进入 Implementation Plan

**范围：** `agxp-a2a-recruiting-web` 完整 P3 前端接线：候选人隐私水合与写入、组织搜索与屏蔽、披露偏好、固定企业披露策略，以及招聘方 Job `hard_requirements` 读写

**前端设计基线：** `plan-p3-frontend-integration@eaa561e6a9d76c874804627b4e9a32c71c03419b`

**后端只读契约基线：** `~/agxp-monorepo` 的 `origin/release/0.2.5@a3d725473`。前端实现只读取该分支的 BFF OpenAPI 与行为测试，不修改后端仓库，不把后端测试作为本前端任务的完成前置。

## 1. 结论

P3 后端契约已经闭环。候选人可以读取和修改自己的隐私策略、按稳定 `organization_id` 添加或解除组织屏蔽；新增的候选人组织搜索可以按名称返回可直接提交给 AddBlock 的稳定 ID。Job 创建、OwnerJob、CandidateJob 和 Job PATCH 也已经携带完整四字段 `hard_requirements`。

前端当前仍把隐私设置留在 Mock reducer 中，Backend 登录不会水合 Privacy View，屏蔽名单仍用自由文本和原因文案推断分组，披露偏好仍使用前端旧值，企业披露策略仍表现为可修改的本地策略，Job DTO/映射/表单也没有消费四项硬事实。因此满足 P3 的最小方案是继续沿用 P1 已建立的单一数据源 facade、`状态/后端` 操作层和根应用状态，在其中增加隐私 owner 与组织查询 seam；不新增第二个 Context、状态库、请求框架、通用 query cache 或后端改动。

本设计冻结一个额外产品约束：现有用户可见字样由 PM 设计，P3 接线不得编辑现有页面标题、区块名、选项名、按钮或说明文案。实现只允许改变数据来源、交互是否生效、选择状态和必要的控件；新增的四项岗位事实复用仓库中已经存在的 PM 词汇与视觉原语，不借 P3 重写文案。

## 2. 目标与成功标准

P3 前端完成后：

1. Backend 候选人登录同时水合 Resume、Intention 和 Privacy，Privacy 失败不回退 Mock，也不破坏其它已成功水合的域；
2. `设置`、`披露偏好`、`屏蔽名单` 消费同一份 Privacy snapshot 和 revision，任一页面写入成功后其它页面立即观察到服务端结果；
3. 候选人先选择 block source，再按名称搜索 active Organization，所选稳定 ID 原样提交给 AddBlock；
4. block 列表按服务端 `source` 分组，不解析展示原因；current/related unblock 发送风险确认，manual unblock 不制造额外风险事实；
5. disclosure wire 值严格限定为 `never | resume_submission | anonymous`，现有显示值只在映射层转换；
6. 真实姓名、联系方式、薪资和并行机会数量遵守 P3 固定机制，不由本地控件制造可保存的配置；
7. 企业披露策略不再保存无后端效果的本地选择，同时保持现有 PM 字样；
8. Job create/read/patch 完整往返四项 `hard_requirements`，新建默认全 `unknown`，Backend read 缺失或非法时 fail closed；
9. Mock 隐私剧情继续由 Mock 数据驱动，Backend 与 Mock 的隐私、block、revision、搜索结果和岗位事实互不污染；
10. CAS、幂等、结果未知、迟到搜索响应、账号切换和角色切换都有确定恢复路径；
11. 现有页面结构、导航、CSS token 和用户可见字样没有未经批准的漂移；
12. Vitest、普通/数据源模式 Playwright 与 UI regression 提供可重复的纯前端验证证据。

## 3. 采用方案与被拒方案

### 3.1 采用：扩展现有前端后端状态层

这里的“后端状态层”专指当前前端仓库的 `src/状态/后端/`。Privacy View 与 revision 纳入现有根应用状态；页面通过应用操作调用 Recruitment 数据源。组织搜索是页面临时查询，不进入 Privacy snapshot。Job `hard_requirements` 继续经过现有 Job facade、映射和岗位状态。

该方案与 P1 的会话代际、401 清理、mutation lock 和 Mock/Backend 分流一致，能避免设置页、披露页和屏蔽页各持有不同 revision。

### 3.2 拒绝：页面直接请求 BFF

页面局部请求文件较少，但会复制 session、CAS、幂等、结果未知、账号清理和错误映射；三个隐私页面也容易观察到不同服务端版本。

### 3.3 拒绝：单独建立 P3 store 或 React Context

第二套 store 会复制现有应用状态生命周期，并让 Privacy 与 Resume/Intention 的候选人水合失去统一代际。当前没有独立挂载或性能证据支持这项复杂度。

## 4. 已冻结的后端浏览器契约

### 4.1 Privacy

前端只消费以下现有 BFF route：

| 操作 | Route | 浏览器约束 |
| --- | --- | --- |
| 读取 Privacy View | `GET /api/v1/me/privacy` | active candidate；返回完整 view 与 revision |
| 修改隐私策略 | `PATCH /api/v1/me/privacy` | sparse body；`If-Match` 使用当前 revision；返回完整 view |
| 添加组织屏蔽 | `POST /api/v1/me/privacy/organization-blocks` | `If-Match` + 每次新意图一个 Idempotency-Key；201 创建、200 replay/同 source duplicate；返回 receipt |
| 解除组织屏蔽 | `POST /api/v1/me/privacy/organization-blocks/{organization_id}/unblock` | `If-Match`；body 只有 `risk_acknowledged`；返回完整 view |

Privacy View 的前端权威字段是：

- `employer_privacy_enabled`；
- `disclosure_preferences.current_employer | education | portfolio_links`；
- `organization_blocks[]`，每项恰含 `organization_id`、`organization_display_name`、`organization_status`、`source`、`created_at`；
- `revision`。

wire DTO 仍严格解码 `updated_at`，但页面领域状态不依赖它；block receipt 没有完整 view，不能靠它伪造未返回的 aggregate timestamp。默认未持久化账户由后端回答 revision 0 的 synthetic view，前端不另造一套 Backend 默认值。

Privacy Patch 只允许可变字段：

```text
employer_privacy_enabled?: boolean
disclosure_preferences?: {
  current_employer?: never | resume_submission | anonymous
  education?: never | resume_submission | anonymous
  portfolio_links?: never | resume_submission | anonymous
}
```

真实姓名和联系方式固定在 Resume Submission（S1）披露；薪资与并行机会数量属于固定机制。这四类事实不进入 Patch，也不在前端产生伪 mutation。

### 4.2 候选人 Organization 搜索

前端使用：

```http
GET /api/v1/organizations?q=<query>&limit=<limit>&cursor=<cursor>
```

- `q` 必填，trim 后 1–200 Unicode code points；
- `limit` 可选，1–50，默认 20；
- `cursor` 是最多 4096 bytes 的 opaque token，只能与生成它的同一查询继续使用；
- `items` 永远是数组，每项严格只有 `organization_id`、`display_name`、`legal_name`；
- `next_cursor` 为 string 或末页 `null`；
- 无结果为 200 空页；只有 active candidate 可调用；返回项都是 AddBlock 可重新校验的 active Organization。

前端不从 Resume company 自由文本推断 Organization，不允许输入 UUID，不从 recruiter Affiliation 或静态公司表制造 candidate block ID。

### 4.3 Job hard requirements

四项完整对象为：

```text
hard_requirements: {
  alternate_weekend_work: required | not_required | unknown
  outsourcing_only: required | not_required | unknown
  onsite_only: required | not_required | unknown
  frequent_travel: required | not_required | unknown
}
```

Job create 可以省略后由服务端规范化为全 `unknown`，但本前端一旦提供可编辑控件便显式发送完整对象。Job PATCH 中该字段是 whole-object replacement；OwnerJob 与 CandidateJob 总是返回完整对象。Backend read 缺失成员或出现非法 enum 是契约漂移，不得补默认值掩盖。

## 5. 架构与文件责任

### 5.1 Wire、数据源与映射

- `src/数据/BFF契约.ts`：增加 Privacy、OrganizationSearch 与 HardRequirements 的闭合 wire DTO；扩展 Job create/patch/owner/candidate DTO。CandidateJob 在 P3 只保留类型边界，不新增无消费者的请求方法或运行时 decoder。
- `src/数据/招聘数据源/隐私.ts`：拥有四条 Privacy route、严格信封解码、If-Match、Idempotency-Key 与 200/201 receipt 处理；不 import React、Mock 或页面中文状态。
- `src/数据/招聘数据源/组织.ts`：在现有公开 Organization 与 recruiter organization 能力旁增加 candidate search；query 参数白名单与分页 DTO 不与 Catalog 混用。
- `src/数据/HTTP招聘数据源.ts` 与 `src/数据/招聘数据源类型.ts`：把 Privacy facade 组合进现有根数据源，扩充 Organization query 和 Job 类型，不改变既有 facade owner。
- `src/数据/隐私映射.ts`：集中处理 disclosure/source wire enum 与现有隐私页面模型转换；页面不得直接解释英文 wire enum。
- `src/数据/后端映射.ts`：继续拥有 Job wire/page 转换，并加入 hard-requirement 完整对象映射；不得把缺失或非法 Backend 成员补成 `unknown`。
- `src/数据/类型.ts`：为前端 block 增加稳定组织 ID、source、status，为岗位增加独立 typed `hard_requirements`；不得把四项事实压进 legacy `硬性条件: string[]` 后丢失三态。

现有 `HTTP客户端` 已支持 If-Match、mutation Idempotency-Key、同 key 受控重试、200/201 成功和 BFF 错误信封；P3 复用这些能力，不建立第二个网络 client。

### 5.2 根状态与操作

- `src/状态/后端/类型.ts`：增加候选人 Privacy snapshot、Privacy 操作和必要的搜索调用类型。
- `src/状态/后端/隐私操作.ts`：负责 GET/PATCH/AddBlock/Unblock、revision fence、receipt 合并、冲突重读和结果未知确认。
- `src/状态/后端/会话操作.ts`：候选人水合并行加入 Privacy；退出、清账号、换 subject、换 role 时清除 Privacy snapshot，并用既有 session generation 丢弃迟到响应。
- `src/状态/初始状态.ts`：Backend seed 显式清空 Mock `屏蔽名单`、`披露偏好` 和隐私设置开关；Backend 页面只能在 Privacy GET 成功后得到服务端事实。
- `src/状态/应用状态.tsx`：组合 Privacy 操作；不承载 wire enum、CAS 或页面分组判断。
- `src/状态/领域/隐私设置.ts`：保留 Mock reducer 的演示职责；Backend 页面不再通过这些 action 宣称服务端写入成功。

Privacy snapshot 只保存页面所需的 employer flag、三项 disclosure、完整 blocks 和 revision。完整 Privacy View 成功时整体替换；AddBlock receipt 以 `organization_id` upsert receipt 中的完整 block，并把 `privacy_revision` 写入 snapshot。receipt 未返回的字段不得猜测。Unblock 和 Patch 返回完整 view，直接整体替换。

### 5.3 查询临时状态

Organization 搜索不进入根 Privacy snapshot。新增的 `src/屏幕/组织查询钩子.ts` 参照现有城市查询 hook，只拥有：

- 当前 query 与 source；
- items、next cursor、首屏/更多请求状态；
- query generation，用于丢弃上一查询的迟到响应；
- 当前明确选择的 SearchItem。

query 为空时不请求；输入采用与现有城市查询一致的 250ms debounce。query 改变时原子清空旧 items/cursor/selection；加载更多只使用当前 generation 的 cursor。离页、账号或角色变化清除全部搜索临时状态。

## 6. 候选人水合与页面数据流

候选人 Backend 水合为：

```text
session / principal
  -> Promise.allSettled(
       GET Resume,
       GET Intention list,
       GET Privacy View
     )
  -> 各域独立提交成功 snapshot
```

Privacy 失败时不派发 Mock 值，也不撤销 Resume/Intention 成功结果。首次没有 Privacy snapshot 的页面保持原有外壳，但不展示可交互的伪设置；依赖服务端事实的控件不可写，错误继续走现有轻提示/重试入口，不新增产品说明文案。已有同会话 snapshot 在一次刷新失败时可以保持最后成功事实，但不能跨 subject 或 role 保留。

### 6.1 设置与披露偏好

- employer privacy 开关调用 sparse Patch：`{ employer_privacy_enabled }`；关闭前继续使用现有确认交互；
- 三项可配置披露字段只提交发生变化的一个 inner member；
- 显示值与 wire enum 的映射集中在数据层；现有前端“意向确认后”等 PM 字样保持原样，不把显示字符串写入 BFF；
- 成功 View 整体替换 snapshot；失败不先切换全局状态；
- 真实姓名、联系方式、薪资和并行机会数量只按固定政策展示，任何现有可点外观都不能产生本地持久化或网络写入。

### 6.2 企业披露策略

P3 没有企业可配置 disclosure profile。该页继续呈现现有 PM 内容，但 Backend 和 Mock 都不再保存无效选项，不把本地点击解释成服务端政策变更。固定政策由窄前端常量/投影提供，不加入 root mutable state，不新增 API。

### 6.3 添加与解除组织屏蔽

新增 block 的固定交互顺序是：

1. 选择 `current_employer | related_organization | manual`；
2. 搜索并明确选择一个 active Organization；
3. 用所选稳定 ID、source、当前 Privacy revision 与一次新幂等键创建；
4. 以 receipt 更新 block 与 revision；
5. 根据服务端 block `source` 放入对应现有分区。

不得根据名称文本、Resume 经历或原因文案自动选择 source/Organization。搜索结果只用于选择，不因出现一条结果自动提交。

解除 `current_employer` 或 `related_organization` 时，现有风险确认完成后发送 `risk_acknowledged: true`；manual block 发送 `false`。服务端仍以存储的 source 为最终判断。成功 View 整体替换；失败前不从列表移除。

## 7. Job hard requirements 接线

`hard_requirements` 在前端是独立 typed object，不与以下既有字段合并：经验要求、学历要求、届别、办公方式、职位要求文本、筛选要求文本、legacy `硬性条件: string[]`。

发布/编辑页继续使用现有三步结构、现有“硬性条件”区块与 CSS 原语，不重命名区块，不改变其它 PM 文案。四项事实使用仓库已经出现的 PM 条件词（大小周、纯外包 / 乙方、全现场办公、频繁出差）与现有 selectable-chip 视觉语言表达三态；不得为解释 wire enum 新增说明段落。具体控件必须能无损区分 required、not_required、unknown，并提供等价的可访问状态，不得把未触碰与明确“不要求”折叠。

- 新建：四项初始化为 `unknown`，用户未触碰也发送完整对象；
- 编辑：从 OwnerJob 完整回显，任何保存都保留四项；若发生修改，PATCH 发送完整 replacement；
- Mock：为每个当前本地岗位 fixture 显式提供同一完整 typed object；当前没有岗位持久化/水合 seam，不新增虚构的历史归一化路径；
- Backend：缺失/非法 hard requirement 直接触发契约错误，不补默认；
- CandidateJob：DTO 类型和共享 hard-requirement 映射保留该对象，供未来真实 consumer 使用；本 P3 不提前新增 `GET /api/v1/jobs/{id}` facade、运行时 decoder、P4 岗位发现、推荐或 Recruiter candidate projection。

岗位详情等现有消费 legacy `硬性条件` 的页面保持原展示；是否在未来展示四项 typed facts 需要另一个 PM 设计，不在本次接线中顺便新增文案或版式。

## 8. 并发、冲突与恢复

### 8.1 通用规则

- 不做乐观写入：服务端成功后才改变全局 Privacy/Job 状态；
- 每个页面 effect 使用现有 ref lock 拒绝重复点击，不用新按钮状态改写 PM 视觉；
- 401 走统一会话清理；Privacy snapshot、搜索词、selection、cursor 和岗位草稿的 server refs 不能泄漏给下一 subject；
- unknown wire enum、未知字段、畸形信封或网络异常 fail closed，Backend 不回退 Mock。

### 8.2 Privacy CAS

所有 Privacy mutation 使用提交瞬间 snapshot 的 revision。`409 version_conflict` 时：

1. 重读 Privacy View；
2. 用最新 View 替换 snapshot；
3. 保留页面尚未提交的目标值、搜索词和已选 Organization；
4. 不自动重放；用户检查最新状态后再次执行原操作。

这避免陈旧页面覆盖另一页面或另一设备的更新。

### 8.3 AddBlock 幂等与结果未知

同一次用户意图及其网络层受控重试复用同一 Idempotency-Key；用户重新确认的新意图生成新 key。

- 201/200 receipt：按 Organization ID upsert block，采用 receipt revision；
- `organization_already_blocked`：重读 Privacy，不猜 source 或本地改写；
- `organization_unavailable`：清除已选失效组织并重跑当前搜索；
- 网络中断、503 或 outcome unknown：先重读 Privacy；目标 Organization/source 已存在则确认成功，否则保留选择供用户明确重试；
- 无法确认时不得显示成功。

### 8.4 Unblock

- current/related 的确认只影响 request body，不提前删除 block；
- `risk_acknowledgement_required` 表明本地 source 可能过期，重读 Privacy，以后端 source 为准；
- 该错误在冻结 BFF 契约中是 HTTP 422，恢复按 error code 分派，不能只挂在 409 分支；
- 404 或 version conflict 重读；若目标已不存在，可按重读结果收口，但不伪造一次成功 mutation；
- manual block 不在前端自动升级为 derived source。

### 8.5 Organization 搜索

query generation 决定响应归属。旧 generation 的成功、失败和 cursor 都被丢弃；加载更多期间不重复请求同一 cursor。搜索失败保留输入和已有页，不污染全局 Privacy error。新 query 不复用旧 cursor。

### 8.6 Job

沿用 P1 Job revision 冲突策略：409 重读 owner snapshot、保留组件表单、禁止自动覆盖或自动重提。保存失败不修改岗位列表；strict decode 失败不把四项变成 unknown。

## 9. PM 文案与 UI 边界

本次批准的是数据接线和必要交互，不是 UI 重设计：

- 不编辑现有用户可见 string literal；
- 不重命名“硬性条件”等现有区块；
- 不调整导航、页面顺序、标题、按钮、说明、颜色 token 或全局布局；
- Organization 搜索复用现有候选列表/加载更多/输入视觉；
- 风险确认复用现有弹层；
- hard-requirement 三态复用现有 chip/选中视觉和仓库已有条件词，不创建解释卡或新设计系统；
- 为真实数据不可用、保存失败和冲突继续复用现有轻提示与错误文案映射，不自创新错误文案。

必要的新交互差异必须局限于：组织搜索候选与选择状态、根据 source 的真实分组/风险行为、固定策略控件不再伪保存、四项 hard-requirement 三态控件。其它视觉差异视为回归。

## 10. 测试策略

### 10.1 Wire 与数据源单测

- Privacy View/Patch/BlockCreate/BlockReceipt/Unblock 的 method、path、body、If-Match 和 Idempotency-Key；
- AddBlock 200/201 都严格解码 receipt；
- Organization search 的 q 编码、limit/cursor、空页、nullable cursor 与 exact three-field item；
- Privacy/Search 的缺字段、unknown field、unknown enum、null items、trailing JSON 与畸形信封拒绝；
- HardRequirements 在 create/patch/OwnerJob 的完整四字段写入/strict read；CandidateJob 用闭合 DTO 类型和同一纯映射 fixture 冻结四项，不在无消费者时增加网络 decoder；
- 根 `HTTP招聘数据源` 加入 Privacy 后不丢现有六个 facade 方法。

### 10.2 映射、reducer 与后端操作测试

- display disclosure 与 wire enum 双向无损映射；现有显示字样不进入 request；
- Privacy full View 整体替换，receipt upsert 和 revision 更新；
- source→分组、status→展示状态不解析 reason；
- candidate hydration partial success；Backend seed 无 Mock privacy；
- logout、subject/role 切换和 session generation 清理/丢弃迟到响应；
- 409 重读但不自动重放，503/outcome unknown 读后确认；
- 同 intent 复用幂等键，新 intent 换 key；
- 搜索 debounce、generation、分页合并、query change reset 和 stale response discard；
- Job 新建全 unknown、OwnerJob 回显、whole-object PATCH、Mock fixtures 显式完整与 Backend fail closed。

### 10.3 页面组件测试

- `设置` employer toggle 在 Backend 调用 Privacy 操作，成功前不改全局状态，关闭确认保留；
- `披露偏好` 三项映射正确，固定事实不能触发 mutation；
- `屏蔽名单` 按 source 分组，搜索明确选择后才 AddBlock，current/related 与 manual unblock body 不同；
- `企业披露策略` 不写本地假政策；
- `发布岗位` 新建/编辑无损往返四项，legacy 硬性条件和其它岗位字段不丢；
- 上述页面的既有 PM 标题、区块、选项、按钮和说明文本由断言冻结。

### 10.4 Playwright 与 UI regression

扩展 `playwright.数据源模式.config.ts` 使用不可复用的 Mock/Backend Vite server：

- `@mock`：现有隐私、岗位和导航剧情不受 Backend fixture 污染；
- `@backend`：登录水合 Privacy → 修改 employer/disclosure → 搜索 Organization → AddBlock → risk/manual Unblock → 发布并编辑带完整 HardRequirements 的岗位；
- fixture 同时覆盖 409、结果未知确认、迟到搜索响应、空页和账号切换；
- intercepted Backend Playwright 只证明浏览器契约、状态和恢复，不宣称真实后端联调。

执行现有 UI regression。批准的必要交互页面允许有明确归因的结构差异；未涉及页面、所有既有用户可见字样、导航和 CSS token 必须相对实际 frontend base 保持。不得自动更新或提交视觉产物。

最终前端验证至少包括：

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:e2e:data-source
UI_VISUAL_GATE=enforce npm run ui:check -- --base eaa561e6a9d76c874804627b4e9a32c71c03419b
```

## 11. 安全与隐私

- Privacy blocks 和搜索只在 active candidate session 下消费；
- Organization ID 只来自 BFF SearchItem/Privacy View，不从名称、路径 slug、Resume 或静态 fixture 推断；
- block source 由用户明确选择并由服务端复核，前端不根据 Resume 自动声称 current employer；
- Idempotency-Key 不写日志、URL、localStorage 或 UI；
- Privacy snapshot、搜索结果和 selection 不持久化到 localStorage；
- strict decoder 防止 Organization 私有字段、subject 或后端扩张字段进入页面；
- real name/contact 的固定阶段不被本地配置绕过；
- recruiter Job hard requirements 进入 owner write/read，但 private screening preferences 仍不进入 CandidateJob 展示；
- Backend 数据失败不读取 Mock 隐私和静态 Organization。

## 12. 非目标与刻意延后

- 后端代码、数据库、OpenAPI 或 release 分支修改；
- P4 岗位发现、推荐、Recruiter candidate projection 或真实 CandidateJob 页面接线；
- P5 Case 策略变更、阶段推进或消息消费；
- 从 Resume company 自动解析 Organization、组织创建/认领/关系/别名；
- fuzzy/pinyin/全文组织搜索、搜索缓存或通用 query library；
- 可配置企业 disclosure profile；
- 修改固定 S0/S1 披露政策、salary mechanism 或 parallel count mechanism；
- 新状态库、React Context、schema generator、网络框架、设计系统或 CSS 重构；
- 改写 PM 文案、导航、页面顺序或为四项事实重做岗位详情；
- 把 intercepted Playwright fixture 表述成真实跨仓库联调。

## 13. 实施拆分约束

Implementation Plan 应按可独立审阅的责任拆分：

1. wire DTO、strict decoder、Privacy/Organization search facade 与 Job hard-requirement contract；
2. Privacy mapping、Backend seed、snapshot、候选人水合、清理与 CAS/幂等恢复；
3. 设置、披露偏好与固定企业策略接线；
4. Organization 搜索 hook、block 添加/分组/unblock；
5. Job hard requirements 类型、映射与发布/编辑接线；
6. Mock/Backend fixture、Playwright、UI regression 和完整验证。

每个任务必须先写失败测试，再写最小实现，再运行定向验证并提交。不能增加本 Spec 之外的产品文案、页面重设计或后端工作；实施中若发现现有 PM UI 无法无损表达 hard-requirement 三态，必须停下报告具体冲突并取得 PM/用户决定，不得自行发明显示语义。

## 14. 完成条件

P3 前端只有同时满足以下条件才算完成：

1. 所有实现只发生在当前前端仓库，后端 `origin/release/0.2.5@a3d725473` 仅作只读契约基线；
2. Privacy、Search、AddBlock、Unblock 和 Job hard requirements 均有 strict browser contract 与操作测试；
3. 三个候选人隐私页面观察同一 snapshot/revision，Backend 不执行本地假成功；
4. 搜索返回的稳定 Organization ID 可以原样创建 block，列表以服务端 source/status/name 为准；
5. CAS、幂等、结果未知、搜索竞态和会话切换恢复可由测试证明；
6. Job create/read/patch 无损往返四项三态，未与 legacy strings 混淆；
7. Mock/Backend 互不污染，Backend 已接线域失败不回退 Mock；
8. 固定 disclosure policy 没有本地伪配置；
9. 既有 PM 字样、页面结构、导航与未涉及视觉没有未经批准的变化；
10. typecheck、lint、Vitest、build、普通 Playwright、数据源模式 Playwright 和 UI regression 全部 PASS；
11. intercepted fixture 证据与真实后端联调边界表述准确；
12. 工作区干净，提交只包含 Spec/Plan 约定的前端变更。

## 15. 下一步

用户审阅并批准本文后，使用 `superpowers:writing-plans` 基于当前代码路径写出零聊天上下文的 Implementation Plan。Plan 必须绑定上述前后端基线、逐任务列出测试先行步骤与定向命令，并把完整前端验证作为最终门禁；在此之前不开始实现。
