# Recruitment P7 前端真人会话接线设计

**日期：** 2026-08-30

**状态：** 已批准方向，已按后端 release 校准

**前端基线：** `agxp-a2a-recruiting-web@7e75326f9d5924952783082c8372de39cd9b2a86`

**后端 P7 发布基线：** `agxp-monorepo origin/release/0.2.5@fa0df4ab7c9cba78d8687d6880560d6a987ec9b2`

**后端 P7 最终合同收口：** `aac1284d5`；`fa0df4ab7` 记录最终 L3 与 same-party 已知问题

**上游：** 已落地的前端 P5 MatchCase contract/runtime、后端 P7 S3 真人会话

**后续：** 生成零上下文实施 Plan，并将本 Spec 与 Plan 一起做跨 Agent 文档评审

## 1. 摘要

P7 前端首版把当前仅由 Mock reducer 驱动的真人会话，接到后端已经实现的招聘专用会话面：双角色收件箱、真人消息历史、纯文本发送、已读位置和 WebSocket 失效通知；同时把 P5 的 `completed + handoff_pending` 延伸到 `completed + complete + conversation_ref`，让双方只能在服务端真正发布会话后进入聊天。

采用“契约优先、最小接线”方案：复用现有消息列表、真人会话、操作栏、路由、BFF 客户端和后端状态编排，不引入状态库、query cache、通用消息 SDK或第二套实时事实源。HTTP 始终是权威；WebSocket 只负责提示重拉。Backend 失败不回退 Mock，Mock 的现有视觉和剧情保持不变。

本次审计同时发现一个不能用前端猜测填平的产品缺口：已实现的 P7 `context` 只有职位标题、候选侧地点或招聘侧匿名代号，以及 `job_ref` / `resume_ref`；它明确不含真名、电话、微信、招聘联系人或简历正文。当前 Mock 真人会话顶部却展示这些事实。因此 Backend 首版只呈现后端能授权的会话和 Case 上下文：候选侧保留“看职位”，招聘侧保留 Case 授权的“看简历”；电话/微信不渲染，也不从 Mock、旧快照或本地缓存补值。未来只有权威披露 DTO 落地后再恢复相应入口。

## 2. 现状与契约核对

### 2.1 当前前端

当前前端已经完成 P5，而后端 P7 文档随附的前端计划仍基于更早的 `aa467312`。当前事实是：

- `src/数据/招聘数据源/MatchCase.ts` 严格准入 P5 的 17 行状态矩阵，`completed` 目前只允许 `handoff_pending`；
- `src/屏幕/P5/MatchCase详情.tsx` 已显示“双方已确认，正在创建会话”和恒禁用的“开始私聊”，但把所有 `completed` 都当作停止轮询的终局；
- `消息列表.tsx` / `企业消息.tsx` 仍直接消费 Mock 消息和本地未读表；
- `/chat/human` / `/hr/chat` 是无参 Mock 路由，真人会话内部写死 `J-01` / `A-01`、联系人、消息和本地发送；
- 当前顶部操作栏的“电话 / 微信”需要实值，但 Backend 已接线域没有提供这些实值；
- Backend 模式已经形成严格 data-source facade、raw snapshot、操作层、session/subject/role/scope fence 和无 Mock fallback 的固定架构，P7 应继续沿用。

### 2.2 后端 P7 最终公开面

候选侧使用 `/api/v1/me`，招聘侧使用 `/api/v1/recruiter`：

```text
GET  /api/v1/{me|recruiter}/conversations
GET  /api/v1/{me|recruiter}/conversations/{conversation_id}
GET  /api/v1/{me|recruiter}/conversations/{conversation_id}/messages
POST /api/v1/{me|recruiter}/conversations/{conversation_id}/messages
PUT  /api/v1/{me|recruiter}/conversations/{conversation_id}/read
GET  /api/v1/events/live
```

关键合同：

- 会话只能由 P5 S3 双方确认后的 durable handoff 发布，浏览器不能创建；
- `completed + handoff_pending` 时无 `conversation_ref`，`completed + complete` 时必须有非空 `conversation_ref`；
- 收件箱 `unread_count` 是显式非负整数，`0` 就是已读，不再代表红点；
- 消息只有 `user_text` 与 `conversation_started`；前者的 ID 是 canonical decimal string，后者固定为 `system:<conversation_id>`；
- 发送正文 trim 后为 1–2000 Unicode code point，必须使用 Idempotency-Key；
- `operation_outcome_unknown` 只能保留原 key 对账或重试，不能自动换 key；
- WebSocket 帧只有 `type`、`conversation_id`、`reason`，不携带正文、未读真相或招聘上下文；
- foreign、wrong-role、generic-thread、missing、unpublished 统一为 `404 conversation_not_found`。

### 2.3 对后端随附前端计划的漂移校准

本前端设计以实际实现与 OpenAPI 为准，不逐字采用旧计划：

1. P5 前端依赖已经落地，不再拆成“未来有条件才做”的 Task；P7 可以一次设计完整入口。
2. 实际消息分页响应字段是 `messages`，不是旧前端计划示例里的 `items`。前端 decoder 必须严格读取 `{ messages, next_cursor }`。
3. 当前 P5 `completed` 会立即停止轮询；P7 必须把“只读终局”和“会话发布完成”拆开，`handoff_pending` 继续低频权威重读，只有 `complete + conversation_ref` 才停止。
4. P7 context 不含当前 Mock 顶部操作栏所需的联系人实值；Backend 不得借 P7 接线继续展示写死的沈亦舟、林澈、电话或微信。
5. P7 不提供 role 级全量未读总数；底部角标只能汇总当前已加载的会话页，不能宣称是跨分页总数。

### 2.4 Release 收口与已知问题

P7 合并到 `release/0.2.5` 前追加了三项直接影响前端的合同修复：Recruitment detail 真实发布 `conversation_ref`，BFF strict client 接受 `completed + complete`，BFF public MatchCase detail 代理该字段。最终公开合同因此与本设计的 P5 handoff 判别联合一致，不再依赖尚未合并的后端分支。

后端同时把 `recruitment-p7-same-party-matchcase-handoff-stuck` 记录为 open known issue：同一个 identity 以 candidate 和 recruiter 两个角色参与自己的 MatchCase 时，P5 允许完成 S3，但 P7 Server 正确拒绝建立双方相同的真人会话。该 Case 会永久保持 `completed + handoff_pending` 且没有 `conversation_ref`。

前端无法也不应从公开 DTO 判断双方是否同一 identity。本期行为冻结为：页面在可见期间继续按普通 pending 详情重读，始终显示准备中和禁用按钮；不设置本地超时、不改写为 ended、不显示内部 `invalid_actor_identity`，也不产生 conversation ID。该产品缺口只能由后端 P5/P7 的后续决策关闭，不属于本前端 Plan。

## 3. 目标与非目标

### 3.1 目标

1. 双角色在 Backend 模式读取各自权威收件箱并进入稳定 `conversation_id` 路由。
2. 真人会话支持直达刷新、历史分页、纯文本发送、结果未知对账和 forward-only 已读。
3. P5 handoff 从“准备中”权威收敛到“开始私聊”，不推导、不伪造 conversation ID。
4. WebSocket 只使对应会话失效并触发 no-store HTTP 重拉，断线可恢复。
5. 全部异步提交受 subject、active role、session generation、scope generation 和 unmount fence 保护。
6. Backend 模式不消费 Mock 会话、联系人、未读或消息；Mock 模式不发任何 P7 HTTP/WebSocket 请求。
7. 保留当前页面视觉语言与主要布局，只为加载、空、失败、发布中和结果未知增加必要状态。

### 3.2 非目标

- 独立通知中心、通知设置、APNs、邮件或短信；
- 候选人主动直聊、陌生人会话或通用社交 Thread；
- 图片、文件、语音、富文本、表情、撤回、编辑；
- 结构化面试邀约、日历、排期或面试状态机；
- P6 AI 代理对话、今日简报或规则控制面；
- 会话搜索 API、置顶、静音、删除、归档和全文检索；
- 用 P7 context 扩张出真名、联系方式或简历正文；
- 修复或掩盖后端 same-party MatchCase 永久 handoff pending；
- 新状态库、通用 query/cache、通用 WebSocket 总线或跨域消息抽象；
- 改写现有 Mock 剧情或为了 Backend 删除 Mock 专用无参路由。

## 4. 方案比较

### 4.1 采用：现有页面双分支 + P7 独立业务域

现有屏幕保留为视觉壳，在入口处按 `数据源模式` 分成 Backend 与 Mock 私有实现。Backend 只读 P7 状态与操作，Mock 保留现有 reducer、静态数据和无参路由。

优点：改动最小；模式边界清楚；能复用现有 P1–P6 的 facade/操作/fence；不迫使 Mock 数据适配真实 wire，也不让 Backend 误吃 Mock。

### 4.2 不采用：先把所有消息统一成一个前端领域模型

当前 AI 代理动态、直聊和 P7 真人会话的 owner、权限与事实源不同。为了让三类行共用一套模型而重构消息中心，会扩大到 P6、Mock 剧情和未接线直聊，没有现实收益。

### 4.3 不采用：等待真名/联系方式接口后再接 P7

P7 已能安全提供会话、消息和未读，缺少的是顶部辅助动作所需的披露投影。阻塞整个消息闭环会让已经完成的后端能力无法使用。首版隐藏没有权威数据的动作，后续按新增合同增量恢复，风险更低。

### 4.4 不采用：前端直连平台 Thread 或自行拼 Case 数据

这会绕过 BFF HttpOnly session、三重授权围栏和 viewer-safe context，并使前端承担身份与 Thread 类型判断。P7 页面只访问招聘 BFF。

## 5. 用户流程

### 5.1 P5 发布到真人会话

```text
第二方确认意向
  → P5 detail = completed + handoff_pending
  → 页面显示“双方已确认，正在创建会话”
  → “开始私聊”在场但禁用，详情继续低频重读
  → P7 publication 完成
  → P5 detail = completed + complete + conversation_ref
  → 页面显示“真人会话已建立”并启用“开始私聊”
  → 按角色进入 /chat/human/:conversationId 或 /hr/chat/:conversationId
```

确认动作本身不再直接导航。服务端尚未发布时停在准备态；用户离开后也可从历史 Case 或消息收件箱进入。

### 5.2 收件箱

- 首次进入当前角色主壳后水合第一页，进入消息 Tab 时可 no-store 刷新；
- 服务器顺序原样呈现，不按本地时间或未读数重排；
- 本地搜索只过滤已加载项，不声称搜索全部历史；
- “加载更多”使用 opaque cursor，稀疏页允许 `items=[]` 且仍有 `next_cursor`；
- `last_message=null` 显示“已建立真人会话”；否则显示后端 `preview`；
- `unread_count=0` 不显示红点，`>0` 显示数字胶囊；
- 点击行只导航，不先本地清零；真正已读由会话页 read-through 回执更新。

Backend 首版只有真人会话数据。“全部”和“仅会话”展示同一已加载集合；“通知”显示明确空态，不把 Mock AI 动态混进来。Mock 三页签行为不变。

### 5.3 真人会话

- 参数路由支持直达刷新，页面并行读取会话详情和最新消息页；
- `conversation_started` 映射为固定中性系统行“双方已确认意向，现在可以直接沟通”，不伪造用户或未读；
- `user_text` 按 `sender_role === 当前角色` 决定左右气泡；
- 第一页和更早页均按服务端顺序渲染，更早页 prepend 后保持当前视口；
- 只有真实渲染到的最新 decimal `user_text` ID 可以作为 read-through target；
- 新消息、发送成功、已读成功和实时事件后以权威 HTTP 快照刷新，不做乐观 append 或本地未读归零。

## 6. Wire DTO 与严格解码

### 6.1 领域类型

```ts
export type P7角色 = 'candidate' | 'recruiter';

export interface P7会话上下文 {
  primaryLabel: string;
  secondaryLabel: string;
  jobRef: string | null;
  resumeRef: string | null;
}

export interface P7消息预览 {
  messageId: string;
  senderRole: 'candidate' | 'recruiter';
  preview: string;
  createdAt: string;
}

export interface P7会话项 {
  conversationId: string;
  caseId: string;
  kind: 'human_handoff';
  lastMessage: P7消息预览 | null;
  lastActivityAt: string;
  unreadCount: number;
  contextStatus: 'available' | 'unavailable';
  context: P7会话上下文 | null;
}

export type P7消息 =
  | {
      messageId: string;
      kind: 'user_text';
      senderRole: 'candidate' | 'recruiter';
      content: string;
      createdAt: string;
    }
  | {
      messageId: `system:${string}`;
      kind: 'conversation_started';
      senderRole: 'system';
      createdAt: string;
    };
```

### 6.2 闭合校验

- 所有对象拒绝 unknown/missing key、unknown enum、trailing JSON 和跨分支字段；
- `conversation_id` 与真人 `message_id` 按发布坐标的闭合模式 `^[1-9][0-9]{0,63}$` 校验；`case_id` 沿用 P5 opaque Case ID 规则；
- 时间只接受合法 RFC3339，不猜秒/毫秒；
- `unread_count` 必须是安全非负整数；
- `context_status=available` 必须有非空 context，`unavailable` 必须无 context 或为 null；
- `last_message.sender_role` 不允许 `system`；
- `conversation_started` 必须是 `system:<当前 conversation_id>`、`sender_role=system` 且没有 content；
- `user_text` 必须有 content、decimal message ID，sender 只能是 candidate/recruiter；
- 列表分页读取 `{ items, next_cursor }`；消息分页读取实际实现的 `{ messages, next_cursor }`；
- 同一页 conversation ID / message ID 重复按契约错误处理，不静默去重。

### 6.3 数据源方法

在现有 `HTTP招聘数据源` 组合一个 P7 facade：

```ts
interface 真人会话数据源 {
  读取会话列表(role: P7角色, cursor?: string): Promise<P7会话页>;
  读取会话(role: P7角色, conversationId: string): Promise<P7会话项>;
  读取消息(role: P7角色, conversationId: string, cursor?: string): Promise<P7消息页>;
  发送消息(role: P7角色, conversationId: string, content: string, key: string): Promise<P7消息>;
  标为已读(role: P7角色, conversationId: string, messageId: string): Promise<string>;
}
```

所有 GET 使用 `不缓存: true`。role 只决定闭合的 `/me` / `/recruiter` 路径，不进入 body/query。发送复用现有 `幂等键` seam；已读 body 只含 `read_through_message_id`。

## 7. 状态与操作边界

### 7.1 单一内存 owner

P7 状态只放在现有 `后端状态`，不进 reducer、不进 `资料持久化`：

```ts
interface P7会话状态 {
  P7收件箱: Record<P7角色, P7分页快照<P7会话项>>;
  P7会话详情: Record<string, P7详情快照>;
  P7消息页: Record<string, P7分页快照<P7消息>>;
}
```

详情与消息 scope key 必须包含 `subject + role + conversationId`，或由当前后端状态保证等价隔离；不能只以 conversation ID 跨账号复用。退出、401、切角色、换账号和主体变化都清空 P7 snapshot、scope generation、待定发送意图、已读位置（成功 / 在飞 / 终局拒绝）和 socket。

### 7.2 读取与分页

- 首读只在该 scope 没有成功快照时显示全屏加载；刷新保留旧成功内容并显示轻量刷新态；
- refresh 替换第一页，load-more append 收件箱、prepend 更早消息；
- 同 scope 同类读取 single-flight；新 generation 使旧请求整包过时；
- partial success 不撤销其他 P1–P6 水合结果；P7 水合失败只影响 P7 页面并显示重试；
- 详情直达不依赖收件箱已加载。

### 7.3 发送意图与未知结果

每个 `subject + role + conversationId + trim 后正文` 同时最多一个待定意图，保存：

- Idempotency-Key；
- 发送前最新消息 watermark；
- 不可变的待定正文；
- 是否至少有一次权威重拉成功。

发送不乐观追加。成功后刷新消息与收件箱，看到权威消息才清草稿与 key。

收到 `operation_outcome_unknown` 时立即 no-store 重拉消息和收件箱：

1. 若在 watermark 之后看到“当前角色 + 完全相同 trim 正文”的权威消息，收敛为成功；
2. 若重拉成功但没看到，保留原 key，返回 `reason=outcome_unknown`，显示“重新确认发送结果 / 放弃本次发送”；
3. 若重拉失败，保留原 key，返回 `reason=outcome_unknown`，只允许重试同一意图，不允许放弃或换 key；
4. 用户显式放弃后只清该不可变正文对应的待定 key，保留当前编辑中的草稿；下一次点击才生成新 key。

最终 `idempotency_in_progress` 表示同一 effect 仍在执行：保留原 key 与不可变正文，返回 `reason=in_progress` 的不可放弃 unknown 状态，只允许稍后同 key 重试；页面据此显示“消息仍在处理中，请稍后重试”，不得落入“其余 4xx 释放 key”的默认路径。

`idempotency_conflict` 是终局冲突：不自动重试，刷新权威消息并提示用户重新确认正文。

### 7.4 已读

会话页按服务端渲染顺序取得“当前实际渲染的最后一个 user_text message ID”。它与上一次成功、在飞或已被终局拒绝的 ID 不同时提交一次 read-through；不把可能超出 JavaScript 安全整数范围的十进制 ID 转成 `number` 比大小，系统行也永不提交。`role_required` / `role_suspended` 把该 target 记为终局拒绝，重渲染同一批消息不再重发；新 target 仍可尝试，subject/role/session 切换会随 P7 引用清理全部复位。成功后刷新当前会话和收件箱。新消息在提交之后到达不会被误读，服务端 forward-only 保证重复提交幂等。

## 8. 页面设计

### 8.1 路由

```ts
真人会话: '/chat/human',
真人会话路径: (id: string) => `/chat/human/${encodeURIComponent(id)}`,
真人会话模板: '/chat/human/:conversationId',
企业真人会话: '/hr/chat',
企业真人会话路径: (id: string) => `/hr/chat/${encodeURIComponent(id)}`,
企业真人会话模板: '/hr/chat/:conversationId',
```

现有 `真人会话` / `企业真人会话` 无参常量保持字符串语义，Mock 调用点无需迁移；Backend 导航只使用新增的 `真人会话路径` / `企业真人会话路径` builder。Backend 访问无参路由显示会话不可用，不读取默认 `J-01/A-01`。

### 8.2 收件箱字段映射

候选侧：

- 标题：`context.primary_label`（职位名）；
- 副标题：`context.secondary_label`（地点）；
- context 不可用：标题“会话信息暂不可用”，副标题留空；
- 摘要：`last_message.preview ?? '已建立真人会话'`。

招聘侧：

- 标题：`context.secondary_label`（后端给出的 Case 候选代号）；
- 副标题：`context.primary_label`（职位名）；
- context 不可用与摘要规则同候选侧。

头像使用中性首字占位；Backend 不从 Mock 姓名派生头像或首字。

### 8.3 会话页头与上下文动作

候选侧 page header 使用职位名，副标题使用地点与“真人会话”；招聘侧使用候选代号，副标题使用职位名。`context_status=unavailable` 时标题统一为“真人会话”，消息仍可读写，并提供“重新加载会话信息”。

可用动作遵守后端事实边界：

- 候选侧“看职位”：仅在 context available 且 `context.job_ref` 在场时，进入现有 Backend 岗位详情路由；该页面已经能按 job ID 读取权威 CandidateJob，不借 `case_id` 猜岗位；
- 招聘侧“看简历”：仅在 context available 且 `context.resume_ref` 在场时，使用 Case 授权的 `读取简历PDF('recruiter', caseId)`，复用当前 PDF 租约和预览层，不按 `resume_ref` 自造下载 URL；
- 电话 / 微信：Backend 首版不渲染。P7 context 不提供这些字段，不能显示 Mock 值；
- context 不可用，或对应 `job_ref` / `resume_ref` 缺席时，隐藏缺少授权坐标的“看职位 / 看简历”；context 不可用时只保留刷新上下文入口。

Mock 继续完整显示现有“看职位/看简历、电话、微信”操作排。

### 8.4 加载、空、失败

- 收件箱首读：`正在读入会话…`；成功空页：`还没有真人会话`；
- 会话直达 404：`这段会话不存在或已不可访问`，不显示上一次会话残留；
- 下游 503：保留已有成功快照并显示重试；没有快照时显示整页失败；
- context unavailable 是展示降级，不等于消息失败；
- 加载更多失败不清第一页，按钮原位重试；
- socket 断线不显示“消息已丢失”，只显示短暂“正在重新连接”，HTTP 重拉失败时才呈现可操作错误。

## 9. P5 handoff 接线

### 9.1 Decoder

保持 17 个 lifecycle/stage/status 行，不新造第 18 行；把 `completed | intent_confirmation | passed` 的合法 steps 从仅 `handoff_pending` 扩为：

```text
handoff_pending → conversation_ref 必须 absent
complete        → conversation_ref 必须匹配 ^[1-9][0-9]{0,63}$
```

open、ended、其他 completed 组合带 `conversation_ref` 全部 fail closed；不增加 `published` boolean，也不从文本或本地状态推导。

### 9.2 展示投影

`P5移交视图` 改为判别联合：

```ts
type P5移交视图 =
  | { state: 'pending'; copy: '双方已确认，正在创建会话' }
  | { state: 'ready'; copy: '真人会话已建立'; conversationId: string };
```

pending 显示禁用“开始私聊”；ready 启用同一个按钮并按角色导航。Case list/history 不加 conversation ID；用户仍先按 `case_id` 进入 detail，再从 detail 获取权威 ref。

### 9.3 轮询停止条件

P5 的 mutation/input 终局仍是 `lifecycle !== open`，但详情轮询停止条件改为：

```text
ended
或 completed + complete + conversation_ref
```

`completed + handoff_pending` 只读但继续 3 秒详情重读。页面隐藏时沿用现有跳拍，卸载即停。

same-party 已知问题在公开 wire 上也是这一合法 pending 形态，因此沿用同一行为，绝不增加“等待 N 秒后视为失败”的前端定时器。

## 10. 实时失效

新增独立、很薄的事件源 adapter，连接同源 `ws(s)://<current-host>/api/v1/events/live`，不传 token、role、subject、conversation query 或自定义身份 header。

当前 Backend 模式只允许 Vite dev，因此同源事件能否到达 BFF 也属于本期接线合同：`vite.config.ts` 的 `/api/v1` 代理必须启用 `ws: true`；stg 代理在 `proxyReqWs` 上把握手 `Origin` 改为配置的 public origin，local 代理保持浏览器原 Origin。HTTP 的 `proxyReq` 改写继续保留，两条事件不能互相替代。验收至少用一次不 stub WebSocket 的真实 upgrade 请求证明请求越过 Vite，且不会因未改写 Origin 得到 `invalid_origin`。

严格接受且只接受：

```json
{
  "type": "recruitment.conversation_changed",
  "conversation_id": "3003",
  "reason": "message_created"
}
```

处理规则：

- 帧不直接 append 消息或修改未读，只使当前角色 inbox 和对应 conversation stale；
- 若对应会话正在显示，立即重拉 detail + 最新消息页；无论是否显示都重拉 inbox；
- 连接成功与每次重连后无条件重拉当前角色 inbox 和当前会话；
- unknown/extra/invalid 帧忽略且不关闭健康 socket；
- 指数退避从 1 秒开始，封顶 30 秒；页面隐藏、卸载、退出、401、角色或主体变化关闭并取消 timer；
- React StrictMode 下同一有效 scope 只能保留一条连接；
- Mock 模式永不创建 socket。

## 11. 未读与底部角标

Backend 的消息 Tab 角标只来自当前角色 `P7收件箱.items` 的 `unreadCount` 求和：

```ts
const 已加载未读 = items.reduce((sum, item) => sum + item.unreadCount, 0);
```

它是“已加载会话的未读”，不是全账号总数。UI 不新增“共 N 条未读”之类会暗示全量的文字。加载更多后自然扩大统计范围；read-through 后以收件箱权威刷新下降。Mock 继续用现有 `消息未读` / `企业消息未读` reducer 与 `数未读`。

## 12. 错误、文案与隐私

至少冻结以下中文映射：

| 服务错误 | 用户文案 |
|---|---|
| `conversation_not_found` | 这段会话不存在或已不可访问 |
| `invalid_request_body` | 当前消息无法发送，请检查内容后重试 |
| `idempotency_conflict` | 发送状态发生冲突，请刷新后确认 |
| `operation_outcome_unknown` | 暂时无法确认是否发送成功 |
| `request_too_large` | 消息太长，请缩短后再发送 |
| `idempotency_in_progress` | 消息仍在处理中，请稍后重试 |
| `invalid_origin` | 当前后端环境配置不正确 |
| `role_required` | 当前身份不可用，请切换身份或重新登录 |
| `role_suspended` | 当前身份不可用，请切换身份或重新登录 |
| `identity_service_unavailable` | 账号服务暂时不可用，请重试 |
| `recruitment_service_unavailable` | 招聘信息暂时不可用，请重试 |
| `message_service_unavailable` | 消息服务暂时不可用，请重试 |

平台内部的 muted / moderation 拒绝在当前 BFF 实现里统一投影为公开 `invalid_request_body`，前端不猜内部原因，也不依赖未公开错误词。`idempotency_in_progress` 与结果未知同样保留原 key，但不允许放弃仍在处理的意图；`role_required` / `role_suspended` 是当前角色的终局拒绝，不清除仍有效的登录会话、不自动重试发送，并停止对同一 read target 的自动重发，直到用户切换身份、重新登录或消息 target 改变。

公开错误的后端英文 message 不直接显示。P7 可以复用 `取后端错误文案` 已闭合的断网、通用 502/503/504、invalid response/session 等中文分支，但未知错误码必须覆盖其最后的 `error.message` 路径并统一显示“请求失败，请稍后重试”。日志、测试样本与持久化不得包含 session token、Idempotency-Key、完整消息正文、电话、微信、简历正文或 identity subject。前端只把消息正文保存在当前内存状态与输入草稿，不写 localStorage。

## 13. 模块与改动边界

预计新增：

- `src/数据/招聘数据源/真人会话.ts`：严格 DTO、路径和请求；
- `src/状态/后端/真人会话操作.ts`：snapshot、分页、发送对账、已读和 fence；
- `src/数据/招聘事件源.ts`：WebSocket frame decoder 与连接生命周期；
- `src/状态/后端/use真人会话事件.ts`：当前账号/角色 scope 的失效重拉；
- 对应单元测试。

预计修改：

- `BFF契约.ts`、`HTTP招聘数据源.ts`、后端状态类型/初值/会话清理/应用操作组合；
- `vite.config.ts`：Backend dev 的 HTTP + WebSocket 同源代理与 stg Origin 改写；
- `消息列表.tsx`、`企业消息.tsx`、`真人会话.tsx`、`企业真人会话.tsx`、双端主壳未读；
- `路径表.ts`、`应用.tsx`；
- P5 MatchCase decoder、展示映射、详情轮询和按钮；
- 数据源模式 E2E fixture 与 `DEV_LOG.md`。

不修改 P7 后端，不把 P7 状态塞进 Mock reducer，不重构现有 P1–P6 业务模块，不新建通用消息/实时基础设施。

## 14. 测试策略

### 14.1 数据与操作层

- 所有 DTO exact-key、枚举、ID、时间、context 组合与分页字段；
- 候选/招聘路径隔离，全部 GET no-store，send/read body 与 key；
- 首读、刷新、稀疏页、加载更多、重复 ID 和直达详情；
- subject/role/session/scope/unmount stale success/failure 丢弃；
- same-key replay、unknown 三分支、显式放弃、冲突和 no optimistic append；
- read-through 单调且不以系统行作为 target；
- logout、401、切角色、换账号完整清理。

### 14.2 页面

- Backend 收件箱只消费 P7 snapshot，`unread=0` 无红点，稳定 conversation route；
- context unavailable 保留消息但隐藏上下文动作；
- 双角色直达刷新、sender 对齐、system row、早页 prepend、输入长度与 Enter/Shift+Enter；
- P5 pending 按钮禁用且继续轮询，ready ref 启用并按角色跳转；
- 404/503 不泄漏上一会话；
- Mock 双端原路径、联系人、未读和本地剧情不变，且 P7 HTTP/socket 为零。

### 14.3 实时与浏览器验收

- 合法帧只触发 HTTP 重拉；非法帧不污染状态；
- 断线重连、StrictMode 单连接、隐藏/退出/切角色关闭；
- candidate 发消息，recruiter 经 invalidation 后 HTTP 重拉看到并回复；
- 未读从 1 经 read-through 收敛为 0；
- 发送 same-key replay 只出现一条；
- P5 handoff pending 无聊天入口，complete ref 进入精确角色路由；
- same-party/长期 pending fixture 跨多次轮询仍保持禁用、零 conversation 导航且不显示内部错误；
- Backend/Mock 双模式浏览器旅程均覆盖。

基础 gate 为定向 Vitest、`npm run typecheck`、`npm run lint`、`npm run build`、数据源模式 Playwright；最终权威前端广测为 `npm test`。视觉未主动改版，但双端消息列表与真人会话应补视觉回归截图，确认 Backend 分支没有破坏现有壳。

## 15. 验收标准

1. Backend 双角色收件箱、详情、消息、发送、已读均只消费 P7 BFF，零 Mock fallback。
2. `/chat/human/:conversationId` 与 `/hr/chat/:conversationId` 可直达刷新，foreign/wrong-role 不泄漏旧内容。
3. P5 只有在合法 `complete + conversation_ref` 时启用聊天；pending 继续轮询且不推导 ID。
4. `operation_outcome_unknown` 从不自动换 key或乐观造消息；能通过权威重拉、同 key 重试或显式放弃收敛。
5. WebSocket 帧不进入消息状态，只触发 no-store 重拉；断线、漏帧、重复帧不破坏最终一致性。
6. `unread_count=0` 无红点，角标只汇总已加载 P7 items，不冒充跨分页总数。
7. Backend 不显示 Mock 真名、电话、微信或写死简历；无权威上下文时安全降级。
8. Mock 双端页面、无参路由、视觉与 reducer 剧情保持不变，并证明零 P7 请求/连接。
9. 全部 session/subject/role/scope/unmount fence 和账号清理测试通过。
10. 类型检查、lint、build、定向测试、数据源模式 E2E 与完整 `npm test` 通过。
11. same-party 或其他长期 pending Case 不被前端超时改写，始终没有伪造 conversation ref 或聊天入口。

## 16. 已批准的产品判断

用户已通过“校准 Spec → 编写零上下文 Plan → 评审 Spec/Plan”的指令批准以下收敛结论：

1. P7 Backend 首版先上线安全的真人消息闭环，不等待真名/联系方式投影；
2. Backend 顶部不显示电话/微信；候选“看职位”走 `job_ref` 权威岗位详情，招聘“看简历”走 Case 授权的 PDF 接口；
3. 收件箱保留现有三页签视觉，但 Backend 的“通知”为空，不混入 Mock AI 动态；
4. 底部角标是已加载会话的未读和，不宣称账号全量；
5. 后端实际 `{ messages, next_cursor }` 是消息分页真相源，覆盖旧计划示例的 `{ items, ... }`；
6. 后端 same-party known issue 保持诚实 pending，本前端批次不新增超时终态；
7. Spec 校准后生成零上下文实施 Plan，但在计划阶段不改产品代码。
