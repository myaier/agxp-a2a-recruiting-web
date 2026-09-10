# Task 5 报告：S0 事实问题、结束初筛与动作展示边界

Commit：见本文件所在提交 `refactor: separate screening action control`（分支 `survey-frequent-pages-component-reuse`，BASE `2808cddc`）

## 实现内容

- **契约 C 两个导出类型**（`src/组件/在谈详情/类型.ts`）：
  - `确认属性 = ComponentProps<typeof 确认层>`（`确认层` 以 `import type` 自 `src/组件/确认层.tsx` 借型，无第二种确认实现；控制模块可 type import）；
  - `简历选择属性` 按合同逐字声明（`职位名/文件们{键,文件名,状态文,禁用说明}/选中键/选择/取消/确认:详情按钮`），注释写明「展示不持 BFF 文件；控制层维护 键→{file_id,file_version_id,displayName} 映射（用既有 `从附件行取选择值`），不得以文件名作身份」。本 Task 只声明合同，hook 返回值恒 null（Task 6 交付）。
- **`详情动作卡.tsx/.module.css`**（新）：`详情动作卡({信息}: {信息: 详情动作卡信息})` 纯展示 —— 标题/说明（null 退场）/正文槽/按钮行，CSS 为原 P5 屏 inline 动作卡样式收编（设计令牌逐值不变，`危险` 外观用 `--紧急描边/--意向`）。导出 `详情按钮位({按钮,前缀})` 作为契约 A 按钮铁律的**唯一实现**：`执行!==null && 禁用说明===null` 才可触发（真实 disabled + `可点` 类），否则真实 disabled；`禁用说明!==null` 时说明以可见文本渲染并经 `aria-describedby` 关联按钮（不塞进按钮名）。无 Provider、无 Context/fixture/env/raw DTO、无控制 import。
- **`事实问题卡.tsx`**（新）：`事实问题卡(props: 事实问题属性)` 纯展示 —— `问：{问题}`（前缀由卡给定，不改写控制层文案）+ `aria-label="回答问题"` 回答框 + 提交键（复用 `详情按钮位`）。提交不可触发时回答框同步锁定（沿用旧「在飞锁回答区」语义，不出现半开态）。
- **`src/屏幕/详情控制/use后端详情动作.ts`**（新）：契约 C 输入/返回逐字实现；本 Task 交付 S0 分支（respond_fact + end_screening），`简历选择/披露确认` 恒 null，返回合同后续 Task 不再变。卡片只从 `视图.actions` 映射交集出卡、标题/说明原样；respond_fact 卡 `按钮们: []`（提交控件归 `事实问题`，不双挂载）；end_screening 候选端一键（`写中` 期间 `执行:null` 禁点）、招聘端零控件（wire 缺 recruiter decisions 臂，fail closed，连禁用键都不画）；`终结确认` 为结束初筛二次确认的完整 `确认属性`（文案与旧实现逐字一致），确认才发 `决定S0(caseId,'end')`，取消/确认都即刻收层。
- **P5 接线**（`src/屏幕/P5/MatchCase详情.tsx`）：`阶段动作区`（原正常控制子组件）**无条件调用** `use后端详情动作`（Task 9 迁入 `后端正常详情`）；渲染按 `视图.actions` 顺序遍历 —— hook 卡（键=动作词）走 `详情动作卡`（respond_fact 卡正文槽组装 `<事实问题卡 {...事实问题}/>`），S1–S3 仍走本文件旧渲染，同一 action 只有一个来源。旧 switch 删除 respond_fact/end_screening 两 case、`发回答/回答草稿/回答提交中/确认结束初筛/回答框样式` 迁出，`待确认终局`（婉拒/不合适，Task 6 迁）与 `准备代际`（S1 栅栏）保留；hook 的 `终结确认` 经 `<确认层 {...终结确认}/>` 透传。

## 回答在飞表生命周期（本 Task 后）

创建位置不变：路由实例 `MatchCase详情` 内 `useRef<Map<string,Promise<void>>>(new Map())`（当前由它扮演 plan 的「父读取控制」角色，Task 9 迁入 `use后端详情控制`），经 `详情主体 → 阶段动作区 → 动作输入.回答在飞表` 传入 hook。因此：动作卡随「当前段无动作/段折叠」整体卸载、跨 Case 往返、正常→错误→正常都不重建表；按 `caseId` 记账（他单在飞不锁本单），回原单时 hook 挂载 effect 查表续锁到旧请求收口（防同键单飞吞稿）；表内存的是已吞错的承诺链，`.finally` 无条件删账（迟到也只清自己的键），状态写回全部过局部代际栅栏。

## 命令调用逐项对照（旧 `阶段动作区` → 新 hook）

- `操作.回答事实(role, caseId, 问题.promptId, 内容)`：参数顺序、`问题.promptId` 取自 `视图.补充问题`、`内容 = 回答草稿.trim()`、空串/缺问题/`caseId===''`/表内已有在飞四重守卫 —— 逐项一致；成功才 `设回答草稿('')`、失败 `轻提示(取后端错误文案)` 且草稿保留、`finally` 删表账并按代际解锁 —— 逐项一致。
- `操作.决定S0(caseId, 'end')`：仍只在二次确认「确认」后发出；`发命令` 包装（`写中||caseId===''` 早退、失败原地提示、成功权威重读归操作层）逐字搬移。旧实现里 end_screening 绝不发 `continue`（继续不是前端授权动作）—— 保持。
- 差异（均无观察行为变化）：① 旧 `确认结束初筛` 把含闭包的确认载荷存 state；新 hook 用 `待结束确认:boolean` 派生 `确认属性`（每渲染新闭包，消除旧写法理论上确认开着时的过期 `写中` 闭包）；② 旧 `写中` 由全部动作共享，新 hook 自持一份（S0 与 S1–S3 卡受矩阵行约束永不共存，行为等价）；③ `准备代际` 拆成 hook 自持 `代际`（S0 回答/确认）与屏内 `准备代际`（S1），触发点相同（卸载 + 换 case）。

## 测试与 TDD 证据

新增测试：`详情动作卡.test.tsx`（8 例：结构/说明 null/零按钮卡/多键顺序独立禁用/可触发单击一次/禁用说明可见+aria 关联+点击零回调/执行 null 无说明仍真禁用/三外观样式位）、`事实问题卡.test.tsx`（4 例：文案原样/改草稿透传+提交一次/在飞锁键与回答框/禁用说明关联+整体锁）、`use后端详情动作.test.tsx`（10 例：空回答零请求、参数逐项、在飞锁「提交中…」+父级表记账、失败保留草稿+成功才清、**重挂载续锁不能重发（全程一次 POST）**、换 Case 旧单迟到不改新单草稿+他单在飞不锁本单、结束需确认（取消零请求/确认才 `决定S0('end')`/确认即收层）、招聘端零控件、S1 合同恒 null、卡片交集与顺序）。夹具走真实 `映射P5详情`（不造假视图）。屏幕测试 +1 例钉「S0 迁移后单挂载」（两卡各只渲染一次、问题与回答框同卡、标题/说明保留）。

RED（实现前，brief 指定命令）：
`npm test -- src/组件/在谈详情/详情动作卡.test.tsx src/组件/在谈详情/事实问题卡.test.tsx src/屏幕/详情控制/use后端详情动作.test.tsx`
→ `Test Files 3 failed (3), Tests no tests`，三文件均 `Error: Failed to resolve import "./详情动作卡"/"./事实问题卡"/"./use后端详情动作"` —— 组件/hook 尚不存在（plan 允许的「缺组件」红，非缺依赖/配置错误）。

GREEN：
- 同上命令 → `3 files / 22 tests passed`（中途 2 例失败是测试夹具自身文案与卡标题同词导致 `getByText` 多命中，改夹具按钮文案后过 —— 组件无改动）；
- brief 全量命令 `npm test -- src/组件/在谈详情/详情动作卡.test.tsx src/组件/在谈详情/事实问题卡.test.tsx src/屏幕/详情控制/use后端详情动作.test.tsx src/屏幕/P5/MatchCase详情.test.tsx src/状态/后端/MatchCase操作.test.ts` → `5 files / 179 tests passed`；
- 详情相关面（在谈详情组件全套 + P5 屏 + 两 Mock 详情屏 + 详情展示映射）→ `12 files / 195 tests passed`；
- 全套 `npm test` → `178 files / 3735 tests passed`；`npm run typecheck` 通过（0 error）；`npm run lint`（oxlint）通过。

既有 P5 屏回归（安全网）全部未改断言通过：promptId 绑定与精确调用、在飞「提交中…」锁定、失败留稿、跨 Case deferred 代际栅栏、**离开又回原单续锁**、**经无动作单往返锁不丢**、结束初筛二次确认（取消零请求）、招聘端零控件、零/多条补充问题整页契约错误、S1/S2/S3 旧路径（接受/婉拒/重试/更换/通过/不合适/S2/S3）不重复执行。

## 文件清单

新增：`src/组件/在谈详情/详情动作卡.tsx`、`详情动作卡.module.css`、`详情动作卡.test.tsx`、`事实问题卡.tsx`、`事实问题卡.test.tsx`、`src/屏幕/详情控制/use后端详情动作.ts`、`use后端详情动作.test.tsx`、本报告
修改：`src/组件/在谈详情/类型.ts`（+契约 C 两类型）、`src/屏幕/P5/MatchCase详情.tsx`（S0 控制迁出+接线）、`src/屏幕/P5/MatchCase详情.test.tsx`（+1 用例）

并行边界未触碰（`列表卡片/`、`列表卡片映射.ts`、`候选头行.tsx`、`候选推荐.tsx`、`企业在谈候选.tsx`、`在谈首页.tsx`、`P5/MatchCase列表.tsx/.module.css`；git status 核对）；未写 task intent（沿用 97975bb6）；`npm ci` 未执行（依赖已在）。

## 自检结论（brief 完成标准）

- S0 展示无 raw/操作接口：✅ 两纯卡 props 全部来自 `类型.ts` 局部展示类型，不 import 控制/状态/BFF。
- 旧 S1–S3 暂存不重复执行：✅ 渲染按 `视图.actions` 顺序单一来源分派，旧 switch 已删 S0 两 case；既有 S1–S3 用例全绿。
- 跨 Case 在飞回归通过：✅（屏级 1291/1348 用例 + hook 级重挂载/换 Case 用例）。
- 禁止同一 action 双挂载：✅（屏级单挂载用例钉 各 1）。
- 不改动作允许矩阵 / BFF schema / 授权 / 状态机：✅（映射、decoder、操作层零改动）。

## 顾虑（不阻塞）

- 事实问题卡的 `问：` 前缀使当前问题在 S0 段内出现两次（时间线气泡 + 卡内），是契约 A `问题: string` 的自然消费；若后续视觉评审要去重，可由 P5 连接层决定时间线侧呈现，不属于本 Task。
- S1–S3 仍走旧 inline 样式渲染（含共享 `写中`），与 S0 新卡在 DOM 层并存到 Task 6/8；矩阵保证不同段动作不共存，无并行可点窗口。
