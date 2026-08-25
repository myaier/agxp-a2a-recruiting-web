# 招聘已接线 API 跑通与数据层对齐设计（前端）

状态：待用户书面审阅批准

日期：2026-08-25

前端基线：`a6c4432d291337e13f63eca27f200921a91d21fb`

后端审计基线：`/Users/visionclaw/.paseo/worktrees/0yeqiujx/funny-wolf@b4513bbe469b15e9fb719cfac66d0860ea7b1f4b`

关联后端设计：`/Users/visionclaw/.paseo/worktrees/0yeqiujx/funny-wolf/docs/superpowers/specs/2026-08-25-recruitment-wired-api-alignment-design.md`

本文是 `2026-08-24-recruitment-backend-data-source-design.md` 的收敛修订。旧设计的运行配置、同源代理、Cookie、幂等、CAS、Mock/Backend 分流继续有效；本文覆盖其中“全量目录预取、显示名反查 ID、绝对零 UI 变化”等已被真实代码和接口证明不可持续的部分。

## 1. 决策摘要

本阶段只跑通前端已经接线到 Recruitment BFF 的 API，不新增接口消费范围：

- 手机登录、会话恢复、退出；
- principal、角色 ensure、last-used-role；
- 五类 Catalog；
- 结构化简历；
- CandidateIntention 创建、列表、更新、删除；
- Recruiter Job 创建、列表、更新、归档、重开、删除。

Backend 模式把上述域的服务端数据作为唯一业务事实；接口失败不回退 Mock。尚未接线或不能形成完整链路的页面继续使用隔离演示数据。

视觉原则从“任何 UI 都不能动”调整为：

> 优先保持 PM 已确认的布局、样式和交互骨架；当现有 UI 无法表达后端必填事实、受控目录选择或真实错误状态时，允许复用现有控件做最小改动。禁止为了接接口重做页面。

## 2. 当前证据与主要 gap

### 2.1 Catalog 初始化不可运行

`读取目录()` 当前串行遍历五个目录全部 cursor。按审计时数据量和默认 `limit=20`，仅 Location 与院校就约需 13,000 次请求；角色水合结束还会等待这段预取。Taxonomy 又把不可选根节点过滤掉，导致需要树根的职位/行业 UI 得到空结构。

### 2.2 页面保存字符串，提交时反查 ID

当前表单主要只保存中文显示名，再以 `display_name` 完全相等反查 ID。重名、中文/英文展示差异、名称升级和未加载页都会使合法选择无法提交，或形成歧义。后端 ID 才是写入权威，显示名只应负责渲染。

### 2.3 本地目录与后端目录同时作为事实源

城市、职业分类、行业、学校和专业页面仍直接读取本地大表。Backend 模式因此可能显示后端不存在或不可选的值，直到保存时才失败。城市本地是省—市结构，而后端是带 `admin1_*` 元数据的扁平 Location；这属于展示结构差异，不应迫使后端新增省市树。

### 2.4 CandidateIntention 映射制造或丢失事实

- 列表未传 `status=active`，归档项会进入“当前意向”。
- 新建普通意向在没有用户输入时默认 `workplace_modes=['onsite']`。
- 主城市可能再次进入 `alternate_location_ids`。
- 社招/校招区间薪资的 `annual_salary_months` 在 UI 中不存在，当前请求无法通过后端校验；前端不能默填 12。
- 编辑时只有部分字段在稀疏页面模型中，必须从 owner DTO 保留 UI 未表达的服务端字段。

### 2.5 错误契约解析不一致

BFF 的 `error.fields` 是 `{path, reason}[]`，当前前端按键值对象处理，导致 422 无法稳定落到现有轻提示或表单语义。

## 3. 目标

1. Backend 模式启动和角色切换不再下载全量 Catalog，也不因 Catalog 失败阻塞已登录资源水合。
2. 用户在 Backend 模式选择的每个受控目录值，从选择时起就携带真实 ID；提交不再依赖显示名反查。
3. 尽量复用现有城市、职位、行业、学校、专业的视觉骨架，数据项改为按需查询 BFF。
4. CandidateIntention 与 Job/Resume 的创建、读取、编辑、归档/重开/删除在现有 API 范围内保持服务端权威、可重试且不丢未知字段。
5. Mock 模式的 PM 演示流程保持不变；Backend 已支持域失败时不混入 Mock。
6. 让 API 真实校验错误、会话失效和版本冲突通过现有轻提示与重新读取路径被正确处理。

## 4. 非目标

- 不处理 4 位验证码；另一分支负责。
- 不接入任何“后端已有但前端尚未使用”的 API。
- 不补齐市场发现、匹配、评价、消息、规则、AI 简报、会话、历史、文件或 S1 等域。
- 不实现微信登录的缺失验证链；Backend 模式只诚实提示当前不可完成，不伪造输入或会话。
- 不增加 Redux、React Query、通用 SDK、IndexedDB 目录镜像、离线同步或新的全局错误系统。
- 不把全部 Catalog 下载到浏览器，也不构建前端搜索索引。
- 不重做 PM 页面、CSS、导航、文案体系或视觉层级。
- 不把前端附属字段谎称为后端已持久化。

## 5. 方案比较

### 方案 A：保留现状，在保存前按显示名补查

改动最少，但仍有双事实源、重名歧义和“最后一步才失败”的问题，也无法解决全量预取。拒绝。

### 方案 B：首次登录同步全部目录到全局缓存

可以保留现有同步页面，却需要约万级请求、复杂缓存失效和版本协调，移动端不可接受。拒绝。

### 方案 C：Backend 按需目录 + 选择即保存引用（采用）

- 资源 owner DTO 自带的 `{id, display_name}` 直接用于回显。
- 用户打开选择器或输入搜索词时才请求相应目录。
- taxonomy 按父节点懒加载；Location 按行政区或搜索加载；院校/专业按查询加载。
- 表单同时保存引用和显示值，写入直接取 ID。
- Mock 模式仍走本地字典，不要求为演示数据制造后端 ID。

这是消除真实故障的最小数据层改造。它会触及少量页面状态与选择器事件，但不需要重做视觉组件或引入框架。

## 6. 数据源与状态边界

### 6.1 域归属

| 域 | Mock 模式 | Backend 模式 |
| --- | --- | --- |
| 本文列出的已接线 API | 现有 Mock | 只使用 BFF；失败不回退 |
| 未接线/不完整业务域 | 现有 Mock | 明确的演示模块 |
| 五类选择器 | 本地目录 | 按需 BFF Catalog |
| UI 排序、推荐位、行政区导航顺序 | 当前前端展示配置 | 可保留为展示配置，但不能产生可提交目录值 |

省级导航的中文标签、顺序和 `admin1_code` 可以留在前端作为 PM 视图配置；具体城市名称、可选性和 ID 必须来自 `GET /catalog/locations`。因此前端不再维护一份可直接提交的 Backend 城市列表。

### 6.2 目录选择值

新增最小公共值类型，复用 BFF 已有引用形状：

```ts
interface 目录选择值 {
  id: string;
  display_name: string;
}
```

Backend 表单中受控字段同时保存该引用；UI 只读取 `display_name`。资源水合时直接复用 owner DTO 中的引用，用户重新选择时用查询结果替换引用。禁止通过 `display_name` 在缓存或全量目录中反查 ID。

为控制改动面，不要求把所有 Mock 页面模型一次性改成对象。现有字符串字段可继续负责渲染与 Mock 行为，但 Backend 元数据必须与相应草稿/条目同生命周期保存，且 reducer 更新时原子替换，不能维护一个脱离表单生命周期的全局“名称→ID”表。

需要携带引用的当前字段：

- Resume Experience `industry`；
- Resume Education `institution`、`major`；
- CandidateIntention `job_category`、primary/alternate locations、industries；
- Recruiter Job `category`、`location`。

### 6.3 目录查询服务

将 `读取目录(): Promise<目录索引>` 替换为有边界的查询能力：

```ts
查询Taxonomy(kind, { parentId?, q?, cursor?, limit? })
查询Location({ q?, countryCode?, admin1Code?, cursor?, limit? })
查询Institution({ q?, countryCode?, locationId?, cursor?, limit? })
```

行为约束：

- 调用方显式请求下一页；数据源不得自动追完 cursor。
- 缓存只按 endpoint + filter + cursor 保存已请求页面，并受当前会话生命周期约束；退出登录清空。
- 相同 in-flight 查询可去重；不增加持久化缓存或通用缓存框架。
- taxonomy 的不可选节点保留为导航节点，只有 `selectable=true` 的项可写入。
- owner DTO 自带显示引用时，页面回显不依赖 Catalog 查询成功。
- 角色水合只请求简历/意向或岗位，不预取 Catalog。

## 7. 保持视觉的选择器适配

### 7.1 城市

- 保留现有标题、搜索框、热门区、省级导航、选择计数和底部 chips。
- Mock 模式继续读本地 `城市字典/热门城市`。
- Backend 模式热门区读取 Location 默认/featured 页；搜索框 debounce 后发送 `q`，不在浏览器扫全表。
- 打开某省级导航时，以其 `admin1_code` 调用 `country_code=CN&admin1_code=...`，按用户请求加载下一页。
- 只有 BFF 返回的 Location 能被选择；选择态保存 `{id, display_name}`。
- 后端配套 spec 保证当前 PM 覆盖集的中文 display/search。后端尚未部署该变更时，英文结果仍可显示，但不得退回本地城市并提交猜测 ID。

### 7.2 职位分类与行业

- 保留现有左栏/右栏或手风琴外壳。
- 首次打开只读取 root；展开节点时按 `parent_id` 加载 children。
- 不过滤非 selectable 根节点；它们负责导航。只有 selectable leaf 响应点击并进入已选区。
- 搜索直接用 `q`，结果可跨当前展开分支；提交保存结果 ID。
- 现有“推荐”位置可以继续存在，但 Backend 模式的可点击项必须来自已返回的 BFF 项，不能直接用本地字符串提交。

### 7.3 院校、专业和简历行业

- 保留现有输入框、候选行和行业弹层样式。
- Backend 模式输入 debounce 后远程查询；点候选才形成合法目录引用。
- 用户继续输入后，清除旧引用；未选择候选时阻止服务端保存并复用现有轻提示。
- 编辑既有资源时，owner DTO 自带引用可直接作为当前合法选择，不必重新搜索。

### 7.4 岗位地点

当前发布岗位的工作城市是自由输入，但 BFF 要求 `location_id`。Backend 模式为该输入增加复用既有候选行样式的远程建议；必须选择结果后才能发布。办公详细地址继续为自由文本。

以上是数据正确性所需的最小 UI 行为变化；不新增页面、弹层类型、视觉 token 或 CSS 体系。

## 8. 初始化与资源水合

Backend 启动顺序调整为：

1. 恢复 session；
2. 读取 principal/last-used-role；
3. candidate 并行读取 Resume 与 `status=active` 的 Intention，或 recruiter 读取 Job pages；
4. 各资源独立提交水合结果；
5. Catalog 仅在具体选择器打开时请求。

目录失败不能阻塞已有资源回显。资源失败继续使用最后一次服务端确认快照和现有轻提示，不回退 Mock。角色切换在目标角色的权威资源完成或明确失败后决定是否导航，延续现有策略。

## 9. CandidateIntention 对齐

### 9.1 列表与生命周期

- 当前意向页调用 `GET /api/v1/me/intentions?status=active`。
- 归档意向不混入当前列表；本阶段不新增归档管理 UI，也不接线后端已有但当前前端未用的归档/重开端点。
- 删除继续使用当前已接线 DELETE + If-Match；成功后以重新读取的 active 列表为准。

### 9.2 创建与更新

- primary location 与 alternate locations 由 ID 去重，主地点不得进入 alternates；仍保留用户选择顺序。
- 新建意向不得默认 `onsite`。添加意向页复用现有选择行/片组，增加最小的办公方式选择；未选择时不提交。首次 onboarding 继续使用用户已经回答的办公方式。
- 编辑已有意向时，UI 未表达的 `recruitment_type` 细分、graduation/internship 条件字段、exclusions、private preferences、workplace modes 和已存在的 annual months 均从最新 owner DTO 保留，除非用户实际修改了对应可见字段。
- 新建社招/校招区间意向不伪造 `annual_salary_months`；依赖配套后端变更后省略该字段。若目标后端尚未支持，显示真实 422，不做默认值或 Mock 回退。
- `compensation.mode=negotiable` 时不携带 lower/upper/annual months。

## 10. Resume 与 Job 对齐

### 10.1 Resume

- 保存 Experience/Education 时直接使用表单中保存的目录引用 ID。
- 未完成的 onboarding 草稿继续留在前端草稿态，不作为服务端已保存数据；服务端分区成功后用返回 ID/revision 原子替换。
- 分区保存中途失败时继续重读权威 Resume；目录查询错误与 BFF 写入错误不得被伪装成整体成功。
- 不在本轮扩大到附件/文件 API。

### 10.2 Recruiter Job

- 创建时直接提交已选 category/location ID，不按岗位类别或城市字符串反查。
- 读取后使用 owner DTO 的引用回显；更新继续遵守 immutable 字段和 If-Match。
- 列表 cursor 仍按需读完当前 recruiter 的 Job 列表；该列表规模受 owner 约束，不等同于全量 Catalog。
- 归档、重开、删除成功后重新读取权威列表，保留真实 status/revision。
- `加分关键词`、`实习转正` 等无后端字段继续由现有附属存储承担，文档明确其仅为本地原型数据。

## 11. 错误、重试与会话

`BFF错误.fieldErrors` 改为有序数组：

```ts
Array<{ path: string; reason: string }>
```

- 解析并保留服务端顺序；表单只对当前能定位的 path 做语义提示，其余走现有通用轻提示。
- 401 清理 Backend 会话数据和查询缓存，返回现有登录流程。
- 409 version conflict 重新读取对应 Resume/Intention/Job，不覆盖服务端更新。
- `idempotency_in_progress` 与 `operation_outcome_unknown` 继续复用同一 Idempotency-Key；不能生成新 key 重复创建。
- 网络错误只对幂等读取做有限重试，mutation 继续遵守现有 outcome-unknown 处理。
- Backend 微信入口保留现有视觉；当前链路不可完成时只使用现有轻提示说明不可用，不展示 mock code 输入或生成假会话。

## 12. 测试与验收

### 12.1 数据层单测

- 初始化和角色切换不调用全量 `读取目录`。
- 每个查询只取请求页，cursor 由调用方继续；相同 in-flight 可去重，退出清缓存。
- taxonomy root 不因 `selectable=false` 被丢弃，leaf 才可提交。
- Location 正确携带 `admin1_code/name`，城市按真实 ID 选择；主地点不会重复进入 alternates。
- Resume/Intention/Job 写入使用选择时保存的 ID，不调用显示名精确反查。
- active intention 查询带 `status=active`，服务端隐藏字段在无相关 UI 修改时保持。
- 普通意向无办公方式时拒绝提交，不再默认 onsite；社招/校招不伪造 annual months。
- `error.fields` 数组、401、409、503 和网络失败保持真实语义且不触发 Mock。

### 12.2 组件与视觉回归

- Mock 模式关键 DOM、样式、路由和选择上限保持当前行为。
- Backend 城市/职位/行业复用现有布局，异步结果不会让已选 chips 或计数丢失。
- 院校/专业/行业/岗位地点只有选中远程候选后才可保存。
- 新增的办公方式只复用当前片组/选择行样式；除这一必要字段及异步结果/错误状态外不新增视觉设计。
- 未接线演示域不因已接线域请求失败而清空或切换来源。

### 12.3 联调场景

- candidate：手机登录 → 角色恢复/ensure → 简历读取与至少一次目录引用写入 → active 意向创建/读取/编辑/删除。
- recruiter：切换角色 → 岗位创建/读取/编辑 → 归档 → 重开 → 删除（若无 in-use 围栏）。
- Catalog：中文城市搜索、省级导航过滤、taxonomy root→leaf、院校/专业搜索。
- 失败：401、422 字段数组、409、503 outcome unknown、断网，均无 Mock 回退和重复 mutation。
- 微信、未接线业务域和 4 位验证码不作为本计划通过条件；验证码由外部分支合入后再执行完整手机登录验收。

## 13. 最小性、延期项与重新评估证据

本设计沿用现有 Context、HTTP 客户端、数据源和页面组件，只把“全量同步 + 字符串反查”替换为按需查询与引用随表单保存。新增状态只对应当前真实受控目录用例，不引入通用状态库或缓存框架。

刻意延期：

- 新 API 域：只有前端产品流程决定接线且后端链路完整时再单独规划。
- 归档意向管理：当前 UI 出现明确入口需求后再接已有 archive/reopen API。
- 完整全球城市本地化或服务端行政区 facets：由真实搜索失败率、多客户端复用需求决定。
- 目录离线缓存、预取和虚拟列表：只有实测请求延迟或长列表渲染达到问题阈值后再引入。
- 将本地附属字段迁入后端：等待正式后端字段，而不是本轮新建旁路协议。

## 14. 完成标准

1. Backend 登录/角色水合不再全量下载五类 Catalog。
2. 所有 Backend 受控目录写入都来自用户选择时保存的真实 ID，没有显示名反查或本地值提交。
3. 城市保留 PM 的二级导航体验，具体选项由扁平 Location API 按行政区/搜索提供。
4. CandidateIntention 不混入 archived、不重复主城市、不默认 onsite、不伪造年薪月数，并保留 UI 未表达的服务端字段。
5. Resume 与 Job 当前已接线 CRUD 场景使用真实引用、revision、幂等和状态。
6. BFF 字段错误数组、401/409/503 被正确处理，Backend 已支持域从不回退 Mock。
7. Mock 模式和未接线演示域保持当前 PM 体验；除受控选择、真实错误状态和办公方式必填外，没有额外 UI 改版。
