# Recruitment P4 前端发现推荐接线设计

**日期：** 2026-08-28

**状态：** 已批准（2026-08-28）

**范围：** `agxp-a2a-recruiting-web` 的 P4 前端接线：候选岗位发现、招聘匿名候选推荐、有限批次刷新、反馈、收藏、淘汰、单对象显式委托、候选披露确认，以及 Mock/Backend 隔离。

**前端基线：** `origin/main@96257a2683dfe775eda61b6076a9aab12ded9c9a`

**后端最终契约基线：** `~/agxp-monorepo` 的 `origin/release/0.2.5@d7353d9162343f95cbf3b70d1e9952c1f17e9ea2`。该 release tip 同时是 P4 最终提交；前端以该提交的 `apps/recruitment-bff/openapi/mobile-v1.yaml`、`apps/recruitment-bff/internal/recruitmentclient/discovery.go` 和 `docs/superpowers/specs/2026-08-27-recruitment-p4-discovery-recommendation-watch-design.md` 为精确真相源。

2026-08-28 校准已完成：从原候选基线 `8e8a0bb66df404cbf7fdf2bac6e085b6df706230` 到 release tip，P4 的 method/path/query/body、DTO、nullable、enum、错误 union、receipt、CandidateJob、cursor 和幂等语义均未漂移；其间 OpenAPI 变化只来自独立的 P2 resume parsing。

## 1. 结论

P4 后端已经提供双端有限推荐、刷新、反馈、委托和 watch 的权威浏览器契约。前端当前虽然已有完整 PM 页面，但发现推荐仍由 Mock 种子和同步 reducer 驱动：切意向/岗位只筛本地数组，刷新不读数据，委托会立即制造本地在谈对象，招聘匿名详情还能从 Mock 档案补身份和薪资信息。

本次采用的最小正确方案是新增独立 P4 数据源、映射和后端操作域：

1. Backend 模式只消费 P4/P1/P3/P6 权威 DTO，不把 Mock ID、公司 slug、身份、薪资或 MatchCase 当作后端事实；
2. 候选推荐按真实 `intention_id` 分区，招聘推荐按真实 `job_id` 分区，页面进入时懒加载当前 scope；
3. 手动刷新创建新的有限批次，下拉刷新只重新读取已有结果；
4. 收藏、淘汰和不感兴趣只在服务端成功后更新页面；
5. 双端委托只保存和轮询真实 delegation，绝不在 P4 里制造 MatchCase；
6. 候选委托每次都先显示披露确认，确认后才发送 `disclosure_acknowledged: true`；
7. Mock 模式继续使用现有 reducer、种子和演示在谈剧情，P4 HTTP 请求恒为零；
8. 普通页面视觉保持，只允许已批准的披露确认层和“只看收藏”开关两个例外。

watch 没有当前前端状态、关闭入口或通知承接，本期明确延期，不把现有“帮我搜”偷偷解释成长期 watch。

## 2. 目标与成功标准

完成后：

1. Backend 候选端按当前权威意向显示有限岗位推荐，招聘端按当前 owned active Job 显示匿名候选推荐；
2. 切意向或岗位不会显示前一个 scope 的数据，迟到响应不会覆盖新 scope；
3. 候选岗位卡、详情和公开公司/Publisher 信息来自 P4 `CandidateJob`，不使用静态公司 slug 猜 Organization；
4. 招聘候选卡和详情只显示 P3/P4 allowlist 数据，不出现 candidate subject、真名、联系方式、年龄、性别或候选薪资数字；
5. 本地搜索只筛当前已加载的有限岗位推荐，不升级为无限市场搜索；
6. 下拉刷新只 GET，双端“帮我搜/再找一批”创建新批次后再 GET；
7. 招聘收藏、取消收藏、四种淘汰原因和撤销淘汰由后端持久化；
8. 招聘筛选抽屉提供“只看收藏”，只过滤当前岗位已经完整加载的权威 available snapshot；
9. 企业“已筛掉”保持跨岗位语义，通过 owned active Jobs 的 rejected 结果聚合并支持撤销；
10. 候选不感兴趣由后端持久化，成功后从当前推荐流移除；
11. 双端委托使用真实 receipt，`accepted/evaluating` 可显示已接手，但不会创建本地在谈对象；
12. 只有服务端返回 `case_started + case_id` 才记录真实 Case 引用，P4 页面不进入未接线的 P5 在谈详情；
13. `needs_user/refused/failed` 不冒充成功，操作入口恢复并显示稳定中文提示；
14. 退出、401、切 subject 或切 role 清空 P4 snapshot、锁和轮询；
15. Mock 页面、Mock 数据、Mock 在谈剧情和现有视觉场景保持不变；
16. Vitest、数据源模式 Playwright、build/typecheck/lint 和 UI gate 提供可重复证据。

## 3. 方案选择

### 3.1 采用：独立 P4 facade + scope snapshot + 操作层

新增 `招聘数据源/发现推荐.ts` 负责 P4 path、query、body、strict decoder 与分页；新增 `状态/后端/发现推荐操作.ts` 负责加载、刷新、反馈、委托、恢复和会话/scope fence；新增映射/selector 把 owner-safe DTO 转为现有页面所需视图。

这与已落地的 P1/P3/P6 分层一致。页面不直接请求 BFF，不复制 cursor、幂等、401、轮询和迟到响应处理，也不需要引入通用状态库。

### 3.2 拒绝：页面局部 fetch

四个推荐/详情入口直接 fetch 会重复分页、错误映射、mutation lock、scope fence 和 delegation polling，使卡片、详情、收藏筛选与已筛页面观察不同状态。

### 3.3 拒绝：引入通用 query/cache 框架

通用 cache 会迫使 P1/P3/P6 同时迁移，并把本次业务接线扩大成状态基础设施重构。当前没有第二个真实用例证明现有 raw snapshot + 操作层不足，因此不做。

### 3.4 拒绝：把 delegation 适配成 Mock MatchCase

P4 只拥有 delegation 与启动状态，真实在谈以 `case_id` 为准。用 receipt 或 pending talk 伪造本地 Case 会复制 P5 lifecycle，并让未成立的 Case 出现在在谈列表，因此不做。

## 4. 冻结浏览器契约

### 4.1 Candidate 路由

本期消费：

```text
GET    /api/v1/me/job-recommendations?intention_id=&cursor=&limit=
POST   /api/v1/me/job-recommendation-refreshes
PUT    /api/v1/me/job-recommendations/{recommendation_id}/not-interested

POST   /api/v1/me/job-delegations
GET    /api/v1/me/job-delegations/{delegation_id}

GET    /api/v1/jobs/{job_id}
```

`DELETE .../not-interested` 当前没有可达撤销 UI，本期不创建 dormant 页面入口；后续若产品提供候选负反馈历史页，再消费该 route。

Candidate refresh body 只能是：

```json
{"intention_id":"int_..."}
```

Candidate 单对象 delegation 使用 `items` arm，不使用 `top`：

```json
{
  "intention_id":"int_...",
  "selection":{"items":["job_..."]},
  "disclosure_acknowledged":true
}
```

确认值只来自本次可见确认层，不从偏好、上一次点击或默认值推导。

### 4.2 Recruiter 路由

本期消费：

```text
GET    /api/v1/recruiter/jobs/{job_id}/candidate-recommendations?state=&favorite=&cursor=&limit=
GET    /api/v1/recruiter/jobs/{job_id}/candidate-recommendations/{recommendation_id}

PUT    /api/v1/recruiter/jobs/{job_id}/candidate-recommendations/{recommendation_id}/favorite
DELETE /api/v1/recruiter/jobs/{job_id}/candidate-recommendations/{recommendation_id}/favorite
PUT    /api/v1/recruiter/jobs/{job_id}/candidate-recommendations/{recommendation_id}/rejection
DELETE /api/v1/recruiter/jobs/{job_id}/candidate-recommendations/{recommendation_id}/rejection

POST   /api/v1/recruiter/candidate-recommendation-refreshes
POST   /api/v1/recruiter/candidate-delegations
GET    /api/v1/recruiter/candidate-delegations/{delegation_id}
```

Recruiter refresh body 只能是：

```json
{"job_id":"job_..."}
```

Recruiter 单对象 delegation：

```json
{
  "job_id":"job_...",
  "selection":{"items":["rec_..."]}
}
```

招聘端不得传 candidate subject、alias 反解值或 disclosure 字段。

### 4.3 分页与查询

- Candidate list 必须带一个 owned active `intention_id`；
- Recruiter available list 省略 `state`，rejected view 明确发送 `state=rejected`；
- “只看收藏”使用已经完整加载的 available snapshot 本地过滤，不维护第二份服务端 page cache；
- 每次 scope load 读取全部 opaque cursor 页；cursor 只 `encodeURIComponent` 一次；
- 空、非字符串、重复、超长 cursor，未知 page key、unknown item 或中途失败都使整轮失败；
- 所有页成功后才原子替换 scope snapshot，不提交 partial page。

### 4.4 Wire DTO

前端冻结以下核心 owner-safe 形状；实现以最终 OpenAPI 的 exact keys 为准，不接受 unknown key 或 unknown enum：

```ts
type BFF委托状态 =
  | 'accepted' | 'evaluating' | 'case_started'
  | 'needs_user' | 'refused' | 'failed';

interface BFF委托摘要 {
  delegation_id: string;
  state: BFF委托状态;
  case_id: string | null;
}

interface BFF岗位推荐 {
  recommendation_id: string;
  batch_id: string;
  intention_id: string;
  rank: number;
  match_score: number;
  match_reasons: string[];
  state: 'available' | 'delegating' | 'delegated';
  job: BFFCandidateJob;
  delegation: BFF委托摘要 | null;
}

type BFF淘汰原因 =
  | 'experience_insufficient'
  | 'direction_mismatch'
  | 'primary_stack_mismatch'
  | 'other';

interface BFF候选推荐 {
  recommendation_id: string;
  batch_id: string;
  job_id: string;
  rank: number;
  match_score: number;
  highlights: string[];
  compensation_relationship: 'overlap' | 'near_miss' | 'disjoint' | 'unknown';
  candidate_alias: string;
  experience_years: number | null;
  job_status: string;
  summary: string;
  skills: string[];
  educations: BFF匿名教育[];
  favorite: boolean;
  rejected: boolean;
  rejection_reason: BFF淘汰原因 | null;
  state: 'available' | 'rejected';
  delegation: BFF委托摘要 | null;
}

interface BFF委托回执 {
  delegation_id: string;
  recommendation_id: string | null;
  state: BFF委托状态 | null;
  evaluation_id: string | null;
  case_id: string | null;
  refusal_code:
    | 'recommendation_not_found'
    | 'recommendation_unavailable'
    | 'delegation_not_allowed'
    | 'active_case_quota_reached'
    | 'delegation_cooldown'
    | null;
}
```

`BFFCandidateJob` 复用 P1 已冻结的公开岗位投影；P4 不另造相似 Job DTO。

## 5. 文件与组件责任

### 5.1 Wire 与数据源

- `src/数据/BFF契约.ts`：增加 P4 Page、Card、Preference、Batch、Delegation DTO 和封闭 enum；不增加 watch DTO；
- `src/数据/招聘数据源/发现推荐.ts`：拥有双端 route、query/body 编码、strict decoder、全分页和 response envelope；
- `src/数据/招聘数据源/发现推荐.test.ts`：冻结 method/path/query/body/Idempotency-Key、分页和坏响应拒绝；
- `src/数据/HTTP招聘数据源.ts`：组合 P4 facade；
- `src/数据/招聘数据源类型.ts`：公开当前页面真正使用的 P4 方法，不暴露任意 URL 或 role prefix；
- `src/数据/发现推荐映射.ts`：把 P4 DTO 转成候选/招聘页面视图，并冻结隐私缺省表现。

继续复用现有 `HTTP客户端`、BFF envelope、session cookie、Origin/App headers 和幂等键生成方式；不新增网络 client。

### 5.2 后端 raw snapshot

`后端状态` 增加 scope 隔离状态：

```ts
type P4加载阶段 = '未开始' | '进行中' | '成功' | '失败';

interface P4ScopeSnapshot<T> {
  阶段: P4加载阶段;
  项: T[];
  代际: number;
  错误: string | null;
}

候选岗位推荐: Record<string, P4ScopeSnapshot<BFF岗位推荐>>; // intention_id
招聘可用候选: Record<string, P4ScopeSnapshot<BFF候选推荐>>; // job_id
招聘已筛候选: Record<string, P4ScopeSnapshot<BFF候选推荐>>; // job_id
招聘候选详情: Record<string, BFF候选推荐>;                 // job_id/recommendation_id
P4委托回执: Record<string, BFF委托回执>;                  // delegation_id
P4真实Case引用: Record<string, string>;                    // delegation_id -> case_id
```

快照保存 raw DTO，供 strict state、feedback 和 polling 使用。页面模型由 selector/mapping 派生，不复制一份可漂移的后端数组进现有 Mock reducer。

### 5.3 现有 Mock 领域状态

`状态/领域/发现推荐.ts`、根 `委托入谈` 与 `接触推荐候选` 的同步 reducer 继续只服务 Mock。Backend 页面不得派发这些会同时写推荐与 MatchCase 的 action。

Backend 清理使用闭合 action 清 raw P4 snapshot、详情、receipt 与 Case 引用；不清 Mock 种子，也不把后端数据写回 localStorage 演示状态。

### 5.4 后端操作层

新增 `src/状态/后端/发现推荐操作.ts`，公开页面语义而非 HTTP 语义：

```ts
interface 发现推荐操作 {
  加载候选岗位(intentionId: string): Promise<void>;
  刷新候选岗位(intentionId: string): Promise<void>;
  标记岗位不感兴趣(intentionId: string, recommendationId: string): Promise<void>;
  委托候选岗位(input: {
    intentionId: string;
    recommendationId: string;
    jobId: string;
    已确认披露: true;
  }): Promise<BFF委托回执>;

  加载招聘候选(jobId: string): Promise<void>;
  加载招聘已筛(jobIds: string[]): Promise<void>;
  读取招聘候选详情(jobId: string, recommendationId: string): Promise<void>;
  刷新招聘候选(jobId: string): Promise<void>;
  设置候选收藏(jobId: string, recommendationId: string, favorite: boolean): Promise<void>;
  淘汰候选(jobId: string, recommendationId: string, reason: BFF淘汰原因): Promise<void>;
  撤销淘汰候选(jobId: string, recommendationId: string): Promise<void>;
  委托招聘候选(jobId: string, recommendationId: string): Promise<BFF委托回执>;

  刷新委托(role: 'candidate' | 'recruiter', delegationId: string): Promise<void>;
}
```

Mock 分支仍调用现有 reducer；Backend 分支只调用 facade。接口不包含 watch、批量选择或 P5 Case 读取。

## 6. 加载、刷新与投影

### 6.1 页面级懒加载

P4 不加入登录时的全量会话水合：

- 进入候选“看市场”时加载当前 `intention_id`；
- 切意向时递增页面 scope generation 并加载新 scope；
- 进入招聘“候选推荐”时加载当前 `job_id`；
- 切岗位时递增 generation 并加载新 scope；
- 已成功 scope 再次加载时保留旧 rows，阶段不降级成空白；
- 第一次加载失败显示明确重试，不显示 Mock rows 或 Mock 计数。

这样不会在登录时对所有意向和岗位展开推荐请求，也不会让 P4 失败撤销 P1/P3/P6 已成功的账号水合。

### 6.2 Candidate 页面映射

每个 `BFF岗位推荐` 派生现有市场卡需要的岗位、公司、Publisher、薪资带、标签、匹配分和 safe reason。详情优先复用 card 内完整 `CandidateJob`；直接 URL 或缓存缺失时才 GET `/api/v1/jobs/{job_id}`。

Backend route 不再用 `市场列表.find(...) ?? 市场列表[0]`。未知/不可见 Job 显示安全不可用状态，不能回落第一条 Mock 岗位。

本地搜索只对当前 scope 已加载的 card view 做包含匹配。搜索词不会发给后端，也不会创建新的搜索服务。

### 6.3 Recruiter 页面映射

`candidate_alias` 是唯一候选称呼；头像字只能从 alias 的可见字符派生，不能反解身份。经验、求职状态、Summary、skills、education、highlights、match score 和薪资关系分别读取对应 allowlist 字段。

现有 `推荐候选`/匿名详情页面模型需要允许 Backend 可选内容：

- `experience_years=null` 显示现有未披露表现；
- education 为空时不制造学校和专业；
- 没有工作经历明细时隐藏/显示既有空态，不从 `匿名简历表` 补段落；
- 薪资只使用 `compensation_relationship` 生成“有交集/接近/无交集/待核对”，不调用需要候选薪资数字的 Mock 算法；
- Backend 详情必须按 `job_id + recommendation_id` 重新 GET，使当前 P3 gate 生效。

生产内容少于 Mock 不等于视觉漂移；用 Mock 身份补满页面才是隐私缺陷。

### 6.4 Manual refresh

- 下拉刷新只重新 GET 当前 scope；
- 候选空态“让AI代理帮我搜”创建新 candidate batch，再重新 GET；
- 招聘“让代理再找一批”创建新 recruiter batch，再重新 GET；
- refresh 进行时保留旧成功 snapshot；
- POST 成功但 follow-up GET 失败时保留旧 rows，显示“已发起新一轮，结果暂未刷新”，允许下拉重读；
- 相同用户意图的受控重试沿用同一 Idempotency-Key，不能因网络不确定重复创建批次。

`下拉刷新` 组件可以接受 async callback，并在真实 settle 前保持现有刷新动画；不改变布局、手势或常态 DOM。

## 7. 反馈、收藏与已筛候选

### 7.1 Candidate 不感兴趣

卡片/详情点击“不感兴趣”后等待 PUT 成功，再从当前 scope snapshot 移除。失败前不乐观隐藏。404 按统一不可用收口并重读当前 scope；网络/503 保留卡片并提示。

当前没有候选负反馈历史或撤销入口，本期不新增页面。

### 7.2 Recruiter 收藏

卡片与匿名详情的星标调用同一个 operation。服务端返回的 Preference 是权威结果；成功后同步更新 available/rejected snapshot 和 detail cache 中同一 recommendation。

筛选抽屉顶部新增“只看收藏”开关：

- 只影响当前岗位 available snapshot；
- 不修改 P6 企业规则，不持久化为长期筛选条件；
- 关闭抽屉后本次页面 mount 保留，离开页面后无需跨会话保存；
- 与规则只读列表明确分区，不把 favorite 伪装成 Agent Rule；
- Mock 使用现有 `收藏候选` 数组完成相同可见过滤，仍不发 HTTP。

### 7.3 Recruiter 淘汰与撤销

现有四个中文原因固定映射：

```text
年限不足 → experience_insufficient
方向不符 → direction_mismatch
主栈不符 → primary_stack_mismatch
其他     → other
```

PUT 成功后从当前 available snapshot 移除；Preference 中 favorite 与 rejection 相互独立，淘汰不能清收藏。

“已筛掉”从企业“我的”进入，语义继续是跨岗位：读取全部 owned active Jobs，对每个 Job 执行 `state=rejected` 全分页，全部成功后按权威 Job 顺序、再按 card rank 稳定聚合。某一 Job 失败时不把其它 Job 的局部结果伪装成完整清单；已有成功聚合则保留旧数据并提示。

撤销成功后从 rejected snapshot 移除，但不会把旧推荐卡直接塞回 available；后端语义是允许它进入未来批次，页面提示不得承诺立即回到当前推荐流。

## 8. 委托与披露确认

### 8.1 Candidate 披露确认

复用现有 `确认层`，每次候选委托都显示，不记忆、不写全局偏好：

- 标题明确这是“让 AI 代理去谈”的本次确认；
- 正文明确 S0 通过后可向该招聘方提交默认/已选简历 PDF，并披露姓名和联系方式；
- 取消/关闭为零请求、零状态变化；
- 确认后才调用 operation，并在 body 写 literal `true`；
- 请求失败后下次点击必须重新确认，上次确认不能复用。

招聘方委托不显示该确认，也不得发送 disclosure 字段。

### 8.2 Receipt 与页面状态

create 的每个 receipt 独立判定：

- `accepted/evaluating`：记录 receipt，当前 mount 显示现有“AI代理已接手/已接触”状态；
- `case_started`：同时记录非空 `case_id`，但不生成本地 Case、不跳 P5 页面；
- `needs_user/refused/failed` 或 `state=null + refusal_code`：不显示已接手，恢复按钮并显示稳定原因；
- receipt 的 `recommendation_id` 可空，候选直接 Job 委托不能依赖它作唯一 key。

Backend 的 `职位详情` 委托成功后留在当前详情或返回推荐列表，不执行现有 Mock `替换跳转(在谈详情)`。Recruiter 继续留在推荐/匿名详情，不切换在谈子视图。

Mock 模式仍执行现有 `委托入谈`/`接触推荐候选`，立即生成演示在谈对象。

### 8.3 页面域短轮询

新增与 P6 proposal poll 同型但类型独立的 delegation polling hook：

- 页面可见时每 2 秒 GET 当前可见 `accepted/evaluating` delegation；
- 每个 delegation 同时最多一个在飞 GET；
- terminal 后停止该 delegation；
- unmount、role/subject/scope 变化立即停止并增加周期 generation；
- 不在根 Provider 建永久 interval；
- 轮询失败不把已接手改成失败，下一拍可重试；401 仍走统一账号清理；
- 重新进入页面由 recommendation card 的 delegation summary 恢复，不依赖旧 interval。

P4 只缓存 `case_id` 供未来 P5 接线校准；本期没有 Case list/detail、决策、S1 PDF 或阶段页面写入。

## 9. 并发、幂等与恢复

### 9.1 Fence

每个异步读写捕获：

```text
subject_id + active role + session generation + scope id + scope generation
```

任一不匹配时，迟到结果只释放本轮锁，不写 snapshot、不派发、不弹旧提示。迟到 401 也不得清除新登录会话。

### 9.2 Single-flight 与锁

- scope 全量 GET 与 refresh 按 scope 串行；
- 同一 recommendation 的 favorite/rejection/not-interested 写单飞；
- 不同 recommendation 可以并行；
- delegation create 按 candidate-intention-job 或 recruiter-job-recommendation pair 单飞；
- delegation GET 不获取 create mutation lock，其安全由 polling single-flight、receipt generation 和 session/scope fence 保证；
- logout/401/role switch 清锁、快照与 polling generation。

### 9.3 Idempotency-Key

refresh 和 delegation 的 key 绑定一次用户点击意图：

- HTTP 客户端受控重试沿用原 key；
- outcome unknown 时用户对同一 pending 操作重试沿用原 key；
- 明确成功、明确拒绝、取消或 scope 改变后释放；
- `idempotency_conflict` 不换新 key 强发，先重读权威 scope/receipt并提示冲突。

PUT/DELETE feedback 使用资源状态操作，不新增客户端 receipt framework。

## 10. 错误语义

P4 页面不直接显示后端英文 message。`发现推荐操作.ts` 导出闭合错误映射，至少冻结：

```text
recommendation_not_found/unavailable   → 这条推荐当前已不可用，请刷新后查看
recommendation_stale                   → 推荐信息已更新，请刷新后重试
delegation_not_found                   → 这次委托已不可用，请刷新后查看
delegation_not_allowed                 → 当前无法发起委托，请刷新后重试
disclosure_acknowledgement_required    → 请先确认简历与联系方式披露说明
active_case_quota_reached              → 当前在谈已达到上限，请先处理已有在谈
delegation_cooldown                    → 近期已联系过对方，暂时不能重复发起
idempotency_conflict                   → 这次操作与之前的请求冲突，请刷新后重试
source_unavailable                     → 服务暂时不可用，请稍后再试
```

其它错误回落现有 `取后端错误文案`。

- 401：统一 `清账号状态`，清 P4 状态与 poll；
- 403：不改变现有数据，显示当前角色无权执行；
- 404 list item：按不可用收口并重读 scope，不泄露 block/organization/candidate 差异；
- 404 detail：显示安全不可用页；
- 409 stale/conflict：保留旧数据，重读后让用户再次明确操作；
- 422 disclosure required 是前端契约缺陷，绝不能 catch 后自动补 `true`；
- 503/network/invalid response：Backend 不回落 Mock；首次加载显示失败重试，已有 snapshot 保持可见；
- 分页中途失败：不提交 partial page；
- feedback 失败：不移动卡片；
- refresh follow-up 失败：不清旧列表；
- delegation terminal refusal：不生成 Case、不显示已接手。

## 11. 页面与视觉边界

本期不是市场/推荐 UI 重设计：

- 保留现有路由、Tab、卡片、列表、搜索、规则抽屉、详情结构、设计 token 和常态文案；
- 允许新增并仅新增候选委托确认层，以及筛选抽屉“只看收藏”开关；
- loading/error/未披露属于 Backend 状态，不得用 Mock 内容掩盖；
- Backend 内容字段减少时复用现有空态/未披露表现，不增加假字段；
- 不新增 watch 页面、批量选择条、通知红点、Case 占位卡或推荐算法说明；
- 不用 `ui-change-approved` 掩盖常态结构、关键按钮或错误态缺失；
- 普通视觉场景必须保持；两个批准例外由定向组件/E2E 断言覆盖。

## 12. 测试策略

### 12.1 Wire 与 facade 单测

- 双端全部本期 route 的 method/path/query/body；
- exact Idempotency-Key、Origin/App headers 和闭合 empty/no-body；
- candidate `intention_id`、recruiter `job_id`、state/favorite/limit/cursor 编码；
- Card/Page/Preference/Batch/Receipt exact keys、conditional null、enum、rank/score 和 malformed envelope；
- 全分页、重复/空/非串/超长 cursor、中途失败、unknown item；
- Candidate body 必须 literal disclosure true，Recruiter body 禁止 disclosure/candidate subject；
- watch route 不进入 P4 前端 facade。

### 12.2 Mapping、state 与 operation 单测

- CandidateJob → 市场卡/详情，不读 Mock company slug；
- recruiter alias/education/summary/skills/compensation relation 安全映射；
- forbidden identity/salary canary 在 Backend view 零命中；
- scope 原子提交、旧成功 snapshot 保留、跨 scope/role/subject 迟到响应丢弃；
- refresh GET/POST+GET 区分、follow-up 失败保留旧数据；
- favorite/rejection/preference 同步更新 card/detail cache；
- rejected 跨 active Jobs 聚合与一腿失败 fail closed；
- candidate not-interested、404 收口与无乐观移除；
- delegation create、receipt/refusal、2 秒 poll、single-flight、terminal/unmount 停止；
- `case_started` 只写真实引用，不派发 Mock MatchCase action；
- 401 清理与 stale 401 fence；
- 幂等键在同意图重试中稳定，scope 改变后失效。

### 12.3 页面与组件测试

- 候选切意向、搜索、空态 refresh、下拉 GET、详情直达；
- 招聘切岗位、有限推荐、收藏切换、只看收藏、四原因淘汰；
- 已筛候选跨岗位加载、原因显示、撤销后不承诺立即回流；
- recruiter detail 每次重读且不出现 Mock 姓名/薪资/经历；
- 披露确认取消零请求、确认 body true、失败后下次重新确认；
- recruiter delegation 无确认层；
- accepted/evaluating/case_started/needs_user/refused/failed 全状态；
- Backend 不跳 Mock 在谈、不写本地 Case；Mock 仍立即进入演示在谈；
- 初次失败有重试，已有成功 snapshot 刷新失败不闪空；
- 稳定中文错误映射和按钮锁。

### 12.4 数据源模式 Playwright

扩展 `e2e/数据源模式.spec.ts` 的可变 BFF fixture，至少覆盖：

```text
candidate login
→ current intention recommendation 全分页
→ local search
→ pull GET
→ manual refresh POST + GET
→ not-interested
→ disclosure cancel (zero request)
→ disclosure confirm + delegation accepted/evaluating/case_started
→ 不产生 Mock 在谈

role switch recruiter
→ current Job available recommendations
→ favorite + only-favorite
→ rejection + cross-Job screened view + undo
→ recruiter refresh
→ recruiter delegation without disclosure
→ detail/privacy canary
```

fixture 标记值只存在于拦截响应，页面断言必须证明渲染来自 HTTP。另覆盖 401 cleanup、404 unavailable、503 保留旧 snapshot、invalid page、idempotency-key 稳定与 stale scope response。

Mock 场景完成双端推荐、收藏、淘汰和委托，断言所有 P4 `/job-recommendation*|candidate-recommendation*|job-delegation*|candidate-delegation*` 请求为零。

### 12.5 Delivery gates

实施最终运行：

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e:data-source
npm run ui:check -- --base 96257a2683dfe775eda61b6076a9aab12ded9c9a
```

若实际修改影响普通 E2E，再运行 `npm run test:e2e`。视觉产物位于现有 ignored 目录，不提交截图或视频。

## 13. 明确非目标

本期不实现：

- watch create/list/delete、24 小时调度状态或 P7 通知；
- P5 MatchCase list/detail、S0–S3 阶段、S1 PDF、决策、归档或真人会话；
- 1–3 对象批量选择 UI、`top` selection 或自动批量委托；
- 候选负反馈历史/撤销页面；
- 无限市场搜索、全文检索、向量检索、LLM 推荐或推荐解释生成；
- 动态 ranking、quota、cooldown 或 cadence 配置；
- 通用 query cache、状态库迁移或 P1/P3/P6 重构；
- 从 Mock 推荐、收藏、淘汰或委托迁移到后端；
- 后端仓库修改、STG/Production 联调、发布或 release readiness。

未来重新考虑条件：

- P7 已有可消费 watch outbox 的通知与关闭入口时，单独设计 watch UI；
- P5 前端已冻结真实 Case identity 和阶段页面时，用本期缓存的 `case_id` 接线；
- 产品明确需要批量选择且有可观察的逐项失败体验时，设计 1–3 对象 selection；
- 候选需要撤销负反馈时，先设计可回看的候选侧历史入口；
- 现有 snapshot/facade 在另一个领域再次出现相同重复问题时，再评估通用 query cache。

## 14. 后端最终提交校准记录

本设计原绑定后端候选提交 `8e8a0bb66df404cbf7fdf2bac6e085b6df706230`；实施 Plan 前已将它与最终 P4 提交 `d7353d9162343f95cbf3b70d1e9952c1f17e9ea2` 逐项比较：

1. 本期消费 route 的 method/path/query/body；
2. OpenAPI exact schema、nullable 字段和 enum；
3. status→error union 与 200 receipt refusal 语义；
4. CandidateJob 公开投影；
5. recruiter available/rejected 默认查询语义；
6. delegation summary、receipt、`case_id` 和 polling 终态；
7. Idempotency-Key、cursor 长度和分页规则。

比较结论为完全一致，无需修订产品或架构设计。Spec/Plan 统一绑定 `origin/release/0.2.5@d7353d9162343f95cbf3b70d1e9952c1f17e9ea2`；执行者不得现场猜测或改写接口。

## 15. 验收标准

1. Backend 双端推荐、详情、刷新、反馈、收藏、淘汰和单对象委托由 BFF 权威驱动；
2. Candidate 与 Recruiter scope 不串用，切换和迟到响应安全；
3. Backend 不显示或读取 Mock 推荐、身份、薪资、公司 slug 或 MatchCase；
4. disclosure acknowledgement 只来自本次显式确认；
5. delegation 全状态与 refusal 准确，只有真实 `case_id` 被记录；
6. P4 不制造在谈，不扩大到 P5/P7/watch；
7. 已筛候选、收藏筛选和反馈撤销符合服务端真实语义；
8. 401、404、409、422、503、网络不确定和 invalid response 均 fail closed；
9. Mock 模式不发 P4 HTTP，原型剧情和视觉不回归；
10. 常态视觉零漂移，仅包含两个已批准交互例外；
11. focused/full gates 有新鲜通过证据；
12. Plan 开始前已完成最终后端 commit 校准。

## 16. 冻结结论

P4 前端接线的核心不是把 Mock 数组换成一次 GET，而是让有限推荐、反馈和显式委托各自服从正确 owner：推荐与 delegation 归 P4，隐私归 P3，规则归 P6，真实在谈归 P5。前端必须保留这四条边界，才能在不泄露身份、不重复触达、不制造假 Case 的前提下复用现有 PM 页面。

本期只增加支撑当前页面的最小 facade、scope snapshot、操作和两个已批准交互，不建设通用推荐平台、通用 cache 或未来通知基础设施。
