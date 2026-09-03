# Candidate Onboarding 简历解析预填前端接线设计

**日期：** 2026-09-03

**状态：** 设计草案，待产品/工程确认后进入实施 Plan

**冻结责任边界：** PM 负责视觉、样式与设计组件；本 Spec 的实施者只负责数据和交互接线，不修改任何样式。

**前端仓库与基线：** `myaier/agxp-a2a-recruiting-web@25c4f041bccde33c7b21c2cb96f9f9fbadb0140c`（`origin/main`）

**后端合同与冻结提交：** `agxp-monorepo@f2d7af5652c48ed65c96d3db679618c597d1c9fd`（`origin/release/0.2.5`）

**需求来源：**

- `docs/handoffs/2026-09-02-candidate-onboarding-prefill-frontend-handoff.md`
- `docs/handoffs/2026-09-02-resume-suggestion-api-backend-handoff.md`
- 后端 `docs/superpowers/specs/2026-09-02-recruitment-candidate-resume-suggestion-api-design.md`
- 后端公共 fixture：`apps/recruitment-bff/testdata/resume-prefill-v1-success.json`

## 1. 结论

采用“上传页完成解析准备或明确继续手填，后续页面按可见分区逐页取用”的方案：

1. 只有 Backend、candidate、从 `学生分流` 明确上传/替换的附件才激活 onboarding prefill。
2. `学生分流` 在用户准备离开而解析仍未完成时，给出“再等等 / 继续手填”选择；继续手填后本轮不再迟到预填。
3. 建议准备完成后才进入自动预填路径，避免在后续页面为每个本地 `useState` 再造一套迟到响应与 touched-field 合并机制。
4. `resume-prefill.v1` 作为独立、Backend-only 的 onboarding 建议状态存在，不提前写 `/me/resume`，也不一次性灌入现有根简历状态。
5. 每个页面只在首次展示该分区时把建议作为空白控件的初值；用户点击现有“下一步/保存”后才沿用当前 `保存简历`、CAS、最终权威 GET 写入。
6. 服务端已有值、当前页面已有值和用户输入依次优先于建议。列表没有稳定条目 ID，不按下标猜测合并到已有服务端条目；只在对应服务端列表原本为空时创建建议条目。
7. 日常 `我的简历` 上传、替换、重新解析不激活、不读取、不应用建议。

这是满足当前需求的最小方案：复用既有附件轮询、简历分区 diff、目录引用、会话 generation fence 和页面布局；只新增一个只读 facade、一份窄的 onboarding prefill 状态、一个路由恢复边界及各页面的小型初值映射。

## 2. 已校准事实

### 2.1 后端已经冻结的真实合同

Public BFF 路由是：

```http
GET /api/v1/me/resume-files/{file_id}/parse-result?version_id={version_id}&parse_id={parse_id}
```

请求约束：

| 坐标 | grammar |
|---|---|
| `file_id` | `^rf_[0-9a-f]{32}$` |
| `version_id` | `^rfv_[0-9a-f]{32}$` |
| `parse_id` | `^rp_[0-9a-f]{32}$` |

成功响应是标准 `{result, meta}` envelope；`result.schema_version` 固定为 `resume-prefill.v1`。建议包含：

- `source.file_id/version_id/parse_id`；
- `draft.profile`、`summary`、`skills`、`experiences`、`educations`、`certificates`；
- 每个 scalar 的 `{value, confidence}`；
- industry/institution/major 的 `exact | unresolved` 与可空 `match`；
- 六种闭合 warning：`missing_required | unsafe_month | catalog_unresolved | target_limit_exceeded | enum_undetermined | conflicting_sources`。

响应不含联系方式、PDF 原文、证据、页码、对象坐标、SHA、provider/model/prompt/attempt/trace，也没有 ETag。成功和错误均为 `Cache-Control: no-store`。

Public 错误闭集：

| HTTP | `error.type` | 前端语义 |
|---:|---|---|
| 400 | `invalid_request_body` | 前端请求/合同缺陷，失败关闭 |
| 401 | `invalid_session` | 统一账号清理 |
| 403 | `role_required` / `role_suspended` | 当前角色不可消费，停止预填 |
| 404 | `resume_parse_result_not_found` | exact pair 已不可消费，刷新附件库 |
| 409 | `resume_file_selection_stale` | 当前 version 已换，丢弃旧来源并刷新 |
| 503 | `resume_parse_unavailable` | 解析结果暂不可用，可重试 |
| 503 | `identity_service_unavailable` / `recruitment_service_unavailable` | 依赖暂不可用，可重试 |

后端已用单事务验证 owner、current ready version、exact succeeded parse；前端仍必须验证成功响应的 `source` 与请求三元组逐字相等，防止 relay/合同漂移被当成当前建议。

调用方传入不符合 ID grammar 的 source 属于前端 preflight 错误：不得发 HTTP，并沿用现有客户端约定返回 `status:0, code:'invalid_request'`。上表的 `400 invalid_request_body` 只表示服务端实际返回的 Public API 错误，不能由本地校验伪造。

### 2.2 当前前端与 handoff 的三个差异

1. `use附件简历刷新` 只挂在 `学生分流` 和 `我的简历`。用户从 `学生分流` 进入下一页后，当前轮询会卸载；不能假定它会在整个 onboarding 后台继续运行。
2. `个人优势` 不在 `工作经历` 页面，而在 `引导问答` 的“个人优势”题；`draft.summary` 必须在那里取用。
3. `基本信息`、`最高学历`、`毕业院校`、`选专业`、`就读时间段` 和 `引导问答` 都有页面本地状态。允许建议在这些页面挂载后异步迟到，会要求逐字段 touched tracking 和本地状态同步，明显扩大实现面。

当前 `保存简历` 已支持 onboarding 不完整教育/经历暂存在页面状态：缺学校、专业或开始时间的条目不会提前 POST，最终 GET 后会把跳过条目拼回页面快照。设计继续复用这一行为，不另造在线简历写接口。

### 2.3 相邻设计依赖

`origin/fe-backend-mock-fixes@22c3be71510a32d34c0b946e55c6798f7f22b76a` 当前只有 Me/Settings 设计文档，尚无产品代码。它会继续扩展登录水合和统一会话清理。实施 Plan 必须校准其最终 implementation commit；本功能复用相同的 `subject + role + session generation` fence 和清理入口，不复制第二套登录 owner。

## 3. 目标与非目标

### 3.1 目标

- 首次 candidate onboarding 上传 PDF 后，成功解析可预填后续已有表单。
- 任何建议只有在对应页面可见、用户确认后才写在线简历。
- 服务端已有值和用户输入不被建议覆盖。
- replacement、401、换主体、切角色、退出 onboarding 会使旧建议失效。
- pending、failed、stale、网络失败都有可理解状态，且始终可以继续手填。
- Mock 与日常附件维护零新增建议请求。

### 3.2 非目标

- 不修改后端、不增加 `apply=true` 或聚合写接口。
- 不把附件 PDF 与在线简历合并为一个资源。
- 不从联系方式、文件名、PDF 展示文本或相邻字段推断值。
- 不根据 confidence 自动替用户确认；本轮只保留并严格解码 confidence，所有非空建议都仍需页面确认。
- 不做通用表单 dirty/touched 框架。
- 不为 suggestion 条目制造服务端 ID、revision 或“已保存”外观。
- 不让 `我的简历` 的日常上传进入建议流程。
- 不顺便重构根 `应用状态`、`保存简历` diff 或目录选择器。

### 3.3 冻结的 UI 所有权边界

本节是实施硬约束，优先级高于后文任何交互描述：

- 不修改或新增任何 `.css`、`.module.css`、全局样式、CSS variable、inline style 或动画。
- 不移动、重排或包裹现有可视组件，不改变页面已有间距和布局。
- 不修改 `src/组件/**` 下由 PM 维护的设计组件及其视觉 API。
- 可以在现有位置复用现有组件，并只通过它们已有的 props 接入文案、状态和事件；本方案明确复用 `代理横幅`、`确认层`、`轻提示`、`主按钮` 与 `路由加载中`。
- 可以给已有表单控件提供 suggestion 初值，但不得改变控件结构、标签、尺寸、顺序或交互外观。
- 若现有组件/props 无法表达某个状态，该状态记录为 PM 前置依赖；接线方不得自行创建提示条、错误面板、加载组件或临时样式。
- 实施 diff 一旦包含样式文件、inline style 或设计组件改动，视为越界，必须从接线变更中移除并交由 PM 单独处理。

## 4. 方案比较

### 4.1 采用：上传页决策门 + 后续同步分区初值

解析未完成时用户可以等待，也可以明确继续手填。选择等待时停留在上传页；建议 ready 后进入后续页面。选择手填后本轮 prefill 进入 `manual`，迟到结果不再应用。

优点：

- 满足“不永久阻断”与“迟到结果不覆盖输入”；
- 后续页面拿到稳定 suggestion 后再初始化本地状态；
- 不需要在六个页面复制异步 touched-field 状态机；
- 保持“上传不强制阻塞”：用户始终可选手填。

代价是 pending 时多一次明确选择，这是对当前“AI 自动填充”承诺的诚实反馈。

### 4.2 不采用：完整 suggestion 立即写入根简历状态

现有页面保存函数接收整份页面模型。若把 experience、education、skills、certificates 一次性放进根状态，用户在 `基本信息` 点“下一步”时就可能把尚未查看的内容一起 mutation，违反逐页确认。

### 4.3 不采用：后续页面允许 suggestion 异步迟到再合并

这需要为姓名、出生双滚轮、学历单选、学校/专业搜索、时间双滚轮、工作列表和个人优势分别维护 touched 状态，并处理“编辑后清空仍不可被覆盖”。当前需求没有证据值得引入通用 dirty-field 基础设施。

### 4.4 不采用：让后端自动 apply suggestion

后端合同明确是只读建议，且不知道当前 UI 上的用户输入和页面确认进度。自动 apply 会把 Resume CAS 与异步 merge 变成服务端新业务，本轮不授权。

## 5. 数据源接线

新增窄 facade `src/数据/招聘数据源/简历预填.ts`，并组合进 `HTTP招聘数据源`：

```ts
interface 简历预填数据源 {
  读取简历预填(source: BFF简历预填来源): Promise<BFF简历预填建议>;
}
```

请求固定：

```ts
client.请求<unknown>({
  path: `/api/v1/me/resume-files/${encodeURIComponent(fileId)}/parse-result` +
    `?version_id=${encodeURIComponent(versionId)}&parse_id=${encodeURIComponent(parseId)}`,
  不缓存: true,
  严格信封: true,
});
```

decoder 必须覆盖：

- 每层 object exact key set；
- `schema_version` 常量与三个 ID grammar；
- scalar 的 value 类型、confidence 闭集，以及 value/confidence 同空或同在；
- status、gender、resolution、warning reason 闭集；
- exact 必须有 match，unresolved 必须 `match:null`；
- 所有列表必须是数组，不能把 `null` 归一成空数组；
- 成功 source 必须与请求 tuple 相等；
- 任意多余字段，包括 contact/evidence/source_text/provider 等，均 `invalid_response` 失败关闭。

月份只按最终 OpenAPI 解成 string/null；是否能落入当前控件由页面映射另行判断，不在 wire decoder 中编造后端未冻结的额外语法。

前端测试使用一份从后端 `f2d7af565` 公共 fixture 逐字同步的合成 envelope。前端 CI 不读取本机 `~/agxp-monorepo`；fixture 需要进入本仓库，并在注释中记录来源 commit，避免形成隐式跨仓库依赖。

## 6. Onboarding prefill 状态与生命周期

### 6.1 状态模型

新增 Backend-only 状态，不放入候选在线简历 reducer，也不进入 Mock 初始数据：

```ts
type 预填阶段 =
  | 'inactive'
  | 'arming'
  | 'waiting_parse'
  | 'loading'
  | 'ready'
  | 'failed'
  | 'manual';

interface 候选预填状态 {
  phase: 预填阶段;
  source: { file_id: string; version_id: string; parse_id: string | null } | null;
  eligibility: 候选预填Eligibility | null;
  suggestion: BFF简历预填建议 | null;       // 仅内存
  confirmed: Record<候选预填分区, boolean>;
  error: string | null;
  generation: number;
}
```

`confirmed` 的分区键固定为：

```text
basic
degree
institution
major
education_period
work
summary
```

`work` 对应 `工作经历` 页一次保存的 experiences、additional educations、skills、certificates 四个可见分区；当前保存动作没有四个独立确认边界，因此不伪造更细的 confirmed 状态。

### 6.2 为什么保留 eligibility 快照

source 绑定时，从 `后端状态.简历快照` 的原始 BFF DTO 记录哪些服务端字段/分区当时为空：

- profile 按字段记录；
- summary 按空字符串记录；
- experiences、educations、skills、certificates 分别按列表为空记录。

之后 suggestion 只能用于 `eligible=true` 且当前页面值仍空的目标。不能只看页面中文模型，因为它含有“在职”“本科”“1998/6”等 UI 默认值，这些默认值不等于服务端已有事实。

列表 suggestion 没有在线条目 ID。若服务端对应列表在 source 绑定时已经非空，本轮不按下标把建议拼进已有条目，也不自动 append；用户可继续手工维护。这个保守规则牺牲少量预填率，换取不制造重复/错配经历。

### 6.3 sessionStorage 只存控制面

复用现有候选 onboarding 草稿的范围与清理纪律，但使用独立 key。只在 `Backend + candidate + environment + subject` 下保存：

- auto/manual 模式；
- source tuple；
- eligibility 布尔快照；
- confirmed section IDs。

不把 suggestion payload 写入 sessionStorage。原因：响应携带敏感履历且明确 `no-store`，合法响应上限也远大于浏览器 storage quota。刷新后由 exact tuple 重新读取；路由恢复边界在读取完成前不挂载待预填表单，失败时提供重试/继续手填。

绝不保存 PDF bytes、原文、contact、warning 动态展示文本、provider 数据或请求错误 message。

### 6.4 激活与清理

- 进入 `学生分流` 本身不消费已有附件；只有本页一次明确上传/替换成功后才激活，避免把日常维护的旧附件误当 onboarding 来源。
- 上传开始先进入 `arming` 并递增 generation；旧建议立即不可提交。
- 附件操作完成权威 GET 后，以新 `items[0].file_id + current_version.version_id` 绑定来源；pending/processing 进入 `waiting_parse`。
- 状态变为 succeeded 后，先把 authoritative `current_version.parse.parse_id` 写入内存 source 与 recovery metadata，再以完整 tuple 单飞读取；写 metadata 必须早于 await 读取，以便读取途中刷新仍可恢复。同 tuple 成功只提交一次。
- replace 后新 file/version 重置 suggestion、error 和尚未确认分区；已写入服务端的值会在新 eligibility 快照中变为不可覆盖。
- 401、登出、换 subject、切离 candidate、退出 onboarding 路由集合、完成注册全部清内存和 session key，并递增 generation。
- `我的简历` 的上传、替换和重解析不调用激活方法；其现有轮询与附件操作保持原样。

### 6.5 请求 fence

读取前捕获：

```text
subject_id
last_used_role=candidate
session generation
prefill generation
file_id + version_id + parse_id
```

响应提交时还必须满足：

- 上述值逐项未变；
- 当前 prefill 仍为 auto，不是 manual/inactive；
- 当前附件库仍指向同一 file/version 且 parse succeeded/parse_id 相同；
- 响应 `source` 与请求 tuple 相同。

迟到成功、失败和 401 若 fence 已换代，只释放单飞锁，不提示、不清新会话。

## 7. 上传页交互

不在现有上传横幅下增加新节点。只在原位置复用 `代理横幅`，通过它已有的 `前文/强调/动作文/按下` props 切换文案与动作：

| 状态 | 展示/动作 |
|---|---|
| 无 onboarding 来源 | 不展示解析承诺状态，按当前流程手填 |
| pending/processing | 原横幅显示“正在识别简历”；离页选择由现有 `确认层` 承担 |
| loading suggestion | 原横幅显示“正在准备可填写内容” |
| ready | 原横幅显示“已识别，将填写空白项”；上传/重新上传动作保持原位置 |
| parse failed | 复用现有 `附件错误文案` + `轻提示`；原横幅保留重新上传动作 |
| suggestion read failed | 复用 `轻提示` 告知暂时无法预填；原横幅保留重新上传动作，离页可继续手填 |

用户点“下一步”时：

- 无附件、ready 或 manual：按现有路由继续；
- pending/processing/loading：用现有 `确认层` 展示“再等等 / 继续手填”；继续手填把 phase 置为 `manual` 后立即走现有路由；
- parse/read failed：本次点击视为继续手填，同时保留页面上的重试/重新上传入口。

“继续手填”必须是本轮明确 opt-out。解析稍后成功时不 toast“已自动填充”，也不修改任何表单。

## 8. 分页应用规则

共同规则：

1. 服务端非空值优先；当前页面非空值优先；suggestion 最后。
2. `value:null` 保持缺失，不补默认年、当前年、`0` 或相邻文本。
3. low/medium/high 均只作为建议来源，不自动变成“已确认”；本轮不做置信度着色。
4. 页面点击现有确认按钮并完成权威保存后，才标记对应 section confirmed。
5. 若保存失败，不标记 confirmed；保留当前页面输入供用户修正/重试。

### 8.1 `基本信息`

可映射：

- `real_name` → `真名`；
- 非学生的 `work_start_year` → `开始工作年`；
- `male/female` → `男/女`；
- 控件范围内的 `birth_year/birth_month` → 双滚轮初值。

不应用 `profile.status`。当前“是否在校”和后续求职状态会改变 onboarding 分支及意向语义，继续要求用户显式选择，不让 PDF 替用户决定当前状态。

页面本地出生滚轮必须用“当前页面值 → suggestion → 既有 UI 默认”的顺序初始化；mapper 为滚轮输出 number，并分别限制在 `1970..2010`、`1..12`。姓名、性别、开始工作年继续使用页面既有的根 Resume 客户端草稿与逐次 `存简历` dispatch，避免返回再进入页面时丢失非空编辑；页面首次挂载只把 eligible 且当前为空的这三个 basic 字段一次性种入根草稿。该动作只更新客户端 draft，不调用 `/me/resume`，也不能顺带写出生值、教育、经历、技能或证书。

本轮明确接受一个窄边界：`basic` 确认前，若用户把建议字段清空、离页、再进入，auto 模式会把这个仍为空的字段再次建议；非空用户值始终优先，选择“继续手填”进入 manual 后则完全不再建议。为这个低风险边界不引入持久化逐字段 touched 状态，也不把 §4.3 已拒绝的通用异步 touched 合并框架带回设计。

### 8.2 `最高学历`

- 学生：优先使用 exact 命中现有四档的 `profile.current_education`；否则仅在 `education[0].degree` 精确命中“大专/本科/硕士/博士”时，结合用户已明确的在校身份展示相应“X在读”。
- 非学生：只接受 `education[0].degree` 精确命中当前七档。
- 未命中 UI 词表时不翻译、不猜档，保留页面现有选择并要求用户确认。

本页仍只形成不完整 education draft；沿用现有“跳过不完整条目、最终 GET 后拼回”的行为。

### 8.3 `毕业院校`

- exact：使用 `match.display_name` 和 `{id, display_name}` 引用，输入框可直接通过现有守卫；
- unresolved：只把 `source_name.value` 放入输入框，不制造引用；现有搜索自动给出候选，用户必须点击 canonical item 才能继续；
- missing：保持空。

### 8.4 `选专业`

与毕业院校同形：exact 直接带 canonical ref；unresolved 只显示原名并要求用户点选目录项。

### 8.5 `就读时间段`

- 从 `education[0].start_month/end_month` 读取年份；仅当年份落在当前控件 `2000..2030` 才预选。
- 学生 end month 缺失时，可使用 profile 的显式 `graduation_year`，仍须落在控件范围。
- 当前控件只表达年份并固定写 `09/06`。设计不新增月份控件；超出范围或无法表达的建议保持页面默认并由用户确认。

### 8.6 `工作经历`

进入列表页时一次展示该页实际可见的 suggestion 分区：

- experiences；
- additional educations（`education[1...]`；第 0 条由前四页处理）；
- skills；
- certificates。

experiences、skills、certificates 只在 source 绑定时对应服务端列表为空、当前页面对应列表仍为空且 `work` 尚未 confirmed 时物化。additional educations 使用同一个 source-time `educations` eligibility，但它的页面空条件是“已有前四页形成的 `education[0]`，且 `current.educations.slice(1)` 为空”；满足时保留第 0 条并追加 `suggestion.educations.slice(1)`。若当前已有任意 additional education，则完全不追加。顺序保持后端 parser 顺序，不排序、不去重、不按下标合并已有条目（唯一例外是 skills：页面按原始字符串逐条作 React key，重复技能会撞键，skills 必须保序去重）。

映射规则：

- suggestion 条目使用仅供 React key/diff 的确定性临时编号；不得伪装成服务端 ID/revision；
- exact industry/institution/major 带 canonical ref；unresolved 保留 `source_name` 且引用为空；
- certificate `year:null` → 页面空字符串，不补年份；
- experience `hidden` 不来自解析；沿用当前 UI 新建条目的隐私默认 `true`，不得因预填改成公开；
- internship missing 保持未设置；
- projects 保留 parser 顺序和空字段。

unresolved 或 missing required 条目仍显示原始建议。页面不新增顶部提示节点；用户点击现有完成/保存动作时，复用 `轻提示` 给出“还有 N 处需要选择目录或补充必填项”（N 对当前列表实时重数，用户补齐或删除物化条目后即放行）。现有编辑页完成守卫和 `保存简历` 同步预检继续阻止无 canonical ref 的 mutation；不得静默丢弃或猜 ID。

与 §8.1 同类的已接受窄边界（挂载域）：`work` 确认前用户清空物化条目、离页再进入，物化空条件再次成立时会重新物化建议；非空用户内容始终优先，进入 manual 后完全不再播种。为这个低风险边界不引入持久化 touched 状态。

### 8.7 `引导问答` 的个人优势

`draft.summary` 只在偏好段的“个人优势”题作为 `自我介绍` 初值，不在社招首次薪资段应用。`保存个人优势` 成功后标记 summary confirmed；随后首次意向创建失败不应把已经成功写入的 summary 伪装成未保存。

## 9. 路由恢复边界

新增一个窄的 `候选Onboarding预填边界`，只包装可能消费 suggestion 的 onboarding 页面：

```text
/basic
/onboard/degree
/onboard/school
/onboard/major
/onboard/eduyears
/experience
/wizard（仅个人优势题消费）
```

边界只在 session metadata 表明本轮 auto prefill 活跃、且内存 round 是 pristine `inactive`（`source:null`、`suggestion:null`）时工作。已有 `arming`、`waiting_parse`、`loading`、`ready`、`failed` 或 `manual` round 时不调用恢复；恢复操作本身重复这个 no-op guard，避免正常路由切换覆盖活状态或重复读取：

1. 等 candidate 水合完成并取得附件库；
2. 验证 metadata source 仍是当前附件 exact tuple；
3. 重新读取 suggestion；
4. 读取期间复用现有 `路由加载中`，ready 后再挂载实际表单；
5. 失败复用现有 `确认层` 提供重试与继续手填，不能把空建议冒充恢复成功。

恢复时 authoritative current attachment 是 parse 真相源。若它已 `succeeded`，使用其当前非空 `parse_id` 升级内存 source 和 recovery metadata，再进入 `loading` 并重新读取；stored metadata 的 `parse_id:null` 本身不能触发降级。若 authoritative parse 仍是 pending/processing，消费页面立即把本轮转为 `manual` 并挂载原表单，因为这里没有 `use附件简历刷新` poller；`学生分流` 则用同一恢复操作的“允许等待解析”策略恢复 `waiting_parse`，由该页已挂载的 poller 推进。换言之，`waiting_parse` 只允许存在于实际挂载 `use附件简历刷新` 的路由，不能恢复到无 poller 的页面。

manual/inactive 或普通从 `我的简历` 进入同路径时直接渲染原页面。

这里要区分“消费 suggestion 的页面”和“保持 onboarding 会话活跃的页面”：前者是上面的窄集合；后者必须覆盖 `Onboarding流程.学生求职`、`Onboarding流程.社招求职` 中进入主壳前的并集，并额外包含 `学生分流` 打开的 `/onboard/city`、`/onboard/job` 子页。经过薪资段、求职状态、披露说明或头像页时只保留状态，不读取 suggestion。进入 `/app`、切到其它产品路由，或在头像页完成注册时才清理。这样既不会在注册中途误清，也能防止中断注册后从主壳进入 `/basic` 被误判为 onboarding。

## 10. 错误恢复

- 401：复用统一 `清账号状态`，同时清 prefill 内存、single-flight 与 session key。
- 404：刷新附件库；若 source 已变则重绑新 current source，若同 tuple 仍不可读则进入 failed，不循环请求。
- 409 stale：立即丢弃旧 suggestion，刷新附件库，再按新 current parse 状态进入 waiting/loading/failed。
- 503 与网络失败：保留 source、eligibility、confirmed metadata，允许显式重试或继续手填。
- `invalid_response`：失败关闭并允许手填；不使用部分 decode 数据。
- parse failed：不请求 suggestion。
- 所有失败均保留已确认的在线简历和当前页面输入，不清空表单、不回退 Mock。

## 11. 代码责任范围

建议实施 Plan 校准后的最小文件面：

```text
src/数据/BFF契约.ts
src/数据/招聘数据源/简历预填.ts
src/数据/招聘数据源/简历预填.test.ts
src/数据/招聘数据源/简历预填.fixture.ts
src/数据/HTTP招聘数据源.ts
src/数据/HTTP招聘数据源.test.ts
src/数据/候选Onboarding预填恢复.ts
src/数据/候选Onboarding预填恢复.test.ts
src/状态/后端/类型.ts
src/状态/后端/简历预填操作.ts
src/状态/后端/简历预填操作.test.ts
src/状态/后端/会话操作.ts
src/状态/后端/会话操作.test.ts
src/状态/应用状态.tsx
src/流程/候选Onboarding简历预填.ts
src/流程/候选Onboarding简历预填.test.ts
src/流程/候选Onboarding预填边界.tsx
src/流程/候选Onboarding预填边界.test.tsx
src/流程/附件简历刷新.test.tsx
src/屏幕/学生分流.tsx
src/屏幕/学生分流.test.tsx
src/屏幕/基本信息.tsx
src/屏幕/基本信息.test.tsx
src/屏幕/最高学历.tsx
src/屏幕/最高学历.test.tsx
src/屏幕/毕业院校.tsx
src/屏幕/毕业院校.test.tsx
src/屏幕/选专业.tsx
src/屏幕/选专业.test.tsx
src/屏幕/就读时间段.tsx
src/屏幕/就读时间段.test.tsx
src/屏幕/工作经历.tsx
src/屏幕/工作经历.test.tsx
src/屏幕/引导问答.tsx
src/屏幕/引导问答.test.tsx
src/屏幕/添加头像.tsx
src/屏幕/添加头像.test.tsx
src/屏幕/我的简历.test.tsx
src/应用.tsx
src/应用.test.tsx
```

实施时可把纯 page mapper 收在 `src/流程/候选Onboarding简历预填.ts`，但不建立通用表单框架或统一“大 Profile”。

文件面明确排除所有样式文件和 `src/组件/**`。上表中的页面文件只允许接入状态、现有组件 props、事件和表单初值；不得在 TSX 内新增 inline style。若 PM 后续提供新组件，其交付必须作为独立前置变更进入基线，本接线分支只消费其冻结 API。

## 12. 测试策略

### 12.1 数据源合同

- exact method/path/query 顺序、`不缓存`、严格 envelope；
- 完整后端公共 fixture strict decode；
- 每层多键/少键、null list、坏 enum、坏 scalar pair、exact/null 与 unresolved/match 错配均失败；
- source echo 不等于请求 tuple 失败；
- contact/evidence/provider 等禁止 key 失败关闭。

### 12.2 状态、fence 与持久化

- 只有 Student 页明确上传成功才能激活；已有日常附件不自动激活；
- pending/processing 不提前读 suggestion；succeeded 同 tuple 单飞只读一次；
- replacement 从 mutation 开始即作废旧 generation；旧响应不能提交；
- subject/role/session/prefill generation 任一变化都会丢弃迟到成功、失败和 401；
- sessionStorage 只有控制 metadata，没有 suggestion/body/contact；
- 刷新可按 exact tuple 恢复；登出、401、换主体、切角色、退出 onboarding、完成注册清理；
- Mock 零 prefill key、零请求。

### 12.3 页面合并与确认

- 服务端已有 profile/summary/list 不被建议覆盖；
- 当前页面非空值优先；
- pending 时选择继续手填后，迟到成功不改字段；
- basic、教育四页、工作页、summary 只应用各自分区；
- 前一页确认前不存在对应 Resume mutation；确认后继续走现有 If-Match/幂等/最终 GET；
- unresolved 学校/专业/行业显示 source name 但没有 ID，保存前必须点 canonical item；
- certificate missing year 保持空；unsupported degree/month 不猜值；
- 工作页只对空服务端列表物化 suggestion，不与已有条目按下标合并；
- 完成 onboarding 后重进 `/basic` 不再应用建议。

### 12.4 日常附件回归

`我的简历` 的上传、替换、显式重解析只调用现有附件接口；断言从未调用 `读取简历预填`、不改在线简历、不创建 onboarding session metadata。

### 12.5 UI 所有权回归

- `git diff --name-only` 不包含 `.css`、`.module.css` 或 `src/组件/**`；
- TSX diff 不新增 `style={{...}}`；
- 新提示只通过既有 `代理横幅`、`确认层`、`轻提示`、`主按钮`、`路由加载中` 的冻结 props/API 表达；
- 现有页面组件顺序和 DOM 布局不因 prefill 接线改变。

### 12.6 验证门

实施 Plan 至少包含定向 Vitest、`npm run typecheck`、`npm run lint`、`npm run build`。真实后端 E2E 只有在 deterministic parser fixture 和后端 `f2d7af565` 已进入目标环境时追加；没有环境前置时以数据源合同 fixture + 页面状态测试为权威，不伪造整栈通过。

## 13. 完成标准

- [ ] Student onboarding 上传的 exact succeeded parse 可读取并预填后续已有控件。
- [ ] pending 用户可等待或明确继续手填；手填后迟到结果不应用。
- [ ] 每个页面确认前不产生该分区在线简历 mutation。
- [ ] 服务端值、用户值、目录引用和附件 replacement fence 均不被破坏。
- [ ] unresolved 项不伪造 ID，缺失值不补默认事实。
- [ ] refresh、401、登出、换主体、切角色、退出/完成 onboarding 的清理闭环成立。
- [ ] `我的简历` 与 Mock 行为无变化、零 suggestion 请求。
- [ ] 接线 diff 不含样式、inline style、设计组件或现有组件位置改动；新增反馈全部复用冻结组件 API。
- [ ] 定向测试、typecheck、lint、build 通过。
