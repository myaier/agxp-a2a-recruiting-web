# Backend 在谈／市场、委托与 MatchCase 修复 实施 Handoff

日期：2026-09-08

状态：六个实现 Task 已完成并定向验证；异构代码 review 与 final gate 尚未执行。本文件不是完成报告。

## 1. 绑定的批准合同

| 项 | 值 |
| --- | --- |
| Spec | `docs/superpowers/specs/2026-09-08-backend-discovery-intention-matchcase-content-design.md` |
| Spec revision / blob | `e6f4af66c5453c952cea997e2435e55650749165` / `f5839c411825a05987ca5bc8835f057c6b8261f6` |
| Plan | `docs/superpowers/plans/2026-09-08-backend-discovery-intention-matchcase-content.md` |
| Plan revision / blob | `7ca3f00dd9416703955563be1bd72f44fdb24dab` / `bdbf4508349f3ee23e24fbb480aad0ab8a8476e1` |
| 开工时工作树 blob 校验 | 两份均与批准 blob 逐字一致（`git hash-object` 核对） |
| 工作区 | `/Users/visionclaw/.paseo/worktrees/09eyc7i7/ignorant-cheetah`（复用宿主工作区，未创建第二个） |
| 分支 | `fix/recruit-card-intention-alignment` |
| 实施起点 | `68a701f1d50e51edb12986161edfd99135a178a7` |
| 当前候选 | `19c724a5171968fe54ecb7b3f9ff8c1e8dbd5a99`（含两轮 review 修复） |
| 规划记录的 target | `968a51f40083b276d9c7cf0bf32f8f403212450f`（仅为规划基线） |
| 开工时观察到的 `origin/main` | `da7059c7cd220787326eb7d9972aff1e8b1f632c`（final gate 时必须重新观察并冻结） |
| task intent | `50335db1-e7cc-465c-a6d0-ff20bde52686` |

环境：Node 依赖由 `npm ci` 按 lockfile 安装（工作区初始 `node_modules` 为空）；Vitest 4.1.11 + jsdom。

## 2. 实施 commit 与对应 Task

| commit | Task | 交付 |
| --- | --- | --- |
| `26eca354` | 1 | 招聘推荐 machine code 中文化（Spec §3） |
| `a30736f7` | 2 | 当前意向统一 ID、页面 scope 与会话恢复（§4） |
| `cb321054` | 3 | 双端 Case typed PDF 入口与租约生命周期（§5） |
| `e86301a6` | 4 | 隐藏内部意向 ID、终局时间本地化（§6） |
| `510cd176` | 5 | 委托成功展示、列表生命周期、单卡忙态、P5 失效、列表错误行（§7） |
| `f3c85bd8` | 6 | 发布回传真实 job_id 并安全选中新岗（§8） |

## 3. 每个 Task 的定向验证

命令与结果都是本会话实际执行的记录。计时取 Vitest 报告的 Duration；未逐条秒表计时。

### Task 1
- `npm test -- src/数据/发现推荐映射.test.ts` → PASS 56/56。
- 先加 6 条反例（已知/未知/空/混合 highlight、原型属性名、employed→在职），确认旧透传实现 6 条全红，再实现闭合文案表与 `已有键` 自有键查表。
- 连带修正 `src/屏幕/候选推荐.test.tsx` 中断言原 token 在 DOM 的两处旧用例（`full_stack`）。
- 补验：`npm test -- src/数据/发现推荐映射.test.ts src/屏幕/候选推荐.test.tsx` → PASS 104/104。

### Task 2
- `npm test -- src/数据/资料缓存.test.ts src/状态/应用状态.test.ts src/状态/后端/会话操作.test.ts src/状态/后端/候选操作.test.ts src/状态/后端/Agent规则操作.test.ts src/屏幕/顶部意向栏.test.tsx src/屏幕/看市场.test.tsx src/屏幕/P5/MatchCase列表.test.tsx` → PASS 443/443（8 文件）。
- `npm run typecheck` → PASS。
- 新增测试文件 `src/屏幕/顶部意向栏.test.tsx`（13 例）。
- Red-check（临时改坏产品代码确认测试真的抓得到）：
  - 关掉恢复接线（`恢复选择` 恒不生效）→ 2 例失败（「水合前不落 ID」「卸载重建仍是第二条」）。
  - 打开持久化写屏障（恒可写）→ 1 例失败（「水合失败不把缓存偏好抹掉」）。
  - 横幅改回按意向名反查 → 看市场「同名两条选第二条」失败。
- 旧的名称-only Backend fixture 已补有效当前 ID（`看市场.test.tsx`、`P5/MatchCase列表.test.tsx`），未保留反查兼容。

### Task 3
- `npm test -- src/屏幕/P5/MatchCase详情.test.tsx src/数据/PDF对象租约.test.ts src/数据/招聘数据源/MatchCase.test.ts` → PASS 111/111。
- `npm run typecheck` → PASS。
- 旧的「候选端无任何 PDF UI」用例已按 Spec §5 替换为双端附件矩阵 + 生命周期用例（有/无附件、角色路径、连点单飞、卸载/换 Case 迟到租约回收、失败仅轻提示且迟到失败不提示）。

### Task 4
- `TZ=Asia/Shanghai npm test -- src/数据/MatchCase展示映射.test.ts src/屏幕/P5/MatchCase详情.test.tsx` → PASS 182/182。
- `TZ=UTC npm test -- src/数据/MatchCase展示映射.test.ts` → PASS 117/117。
- 先加 5 条反例（形状、跨日午夜、两个固定时区快照、异常值兜底、DOM 负断言），确认全红后实现 `格式化终局时间`。
- DOM 负断言直接检查 `document.body.textContent` 不含 `int_0123456789abcdef…` 与 `2026-08-29T03:00:00Z`，并用正则否定任何 RFC3339 形状。

### Task 5
- `npm test -- src/数据/发现推荐映射.test.ts src/数据/招聘数据源/发现推荐.test.ts src/屏幕/候选推荐.test.tsx src/屏幕/看市场.test.tsx src/屏幕/匿名在线简历.test.tsx src/屏幕/职位详情.test.tsx src/状态/后端/发现推荐操作.test.ts src/状态/后端/use发现推荐委托轮询.test.tsx src/状态/后端/MatchCase操作.test.ts src/屏幕/P5/MatchCase列表.test.tsx src/状态/应用状态.test.ts` → PASS 718/718（11 文件）。
- `npm run typecheck` → PASS。
- Red-check：
  - 摘掉创建路径的失效调用 → Provider 接线两例失败。
  - 把 `MatchCase列表` 的错误行条件改回 `视图们.length > 0` → 「成功空缓存 + 刷新失败」失败。
- P5 失效用生产操作工厂 + Provider（`应用状态.test.ts` 两例）验证：POST `case_started` 后对应与全部 scope 真实 GET、别的 scope 仍缓存、失效本身不发 GET、失效前的在飞旧 GET 迟到返回不复活空缓存。

### Task 6
- `npm test -- src/数据/招聘数据源/岗位.test.ts src/状态/后端/岗位操作.test.ts src/屏幕/发布岗位.test.tsx src/屏幕/候选推荐.test.tsx src/屏幕/P5/MatchCase列表.test.tsx src/状态/应用状态.test.ts` → PASS 372/372（6 文件）。
- `npm run typecheck` → PASS。
- Red-check：摘掉页面的意图代际判断 → 两条迟到用例失败；摘掉 `切当前岗位` 派发 → 成功选中用例失败。

## 4. 关键设计取舍（超出 Plan 逐字步骤的判断）

- **`提交候选意向快照` 作为唯一意向提交口**：会话水合、候选 CRUD、409/503 重读、Agent `scope_denied` 重读四处全部改走它。理由：写屏障靠「Provider 接纳的服务端对象引用」判断成功水合是否已进 React commit，任何绕过它的直接派发都会让选择改了却写不进会话缓存。依赖声明为可选（沿用仓库既有「可选成员只为测试桩编译兼容」纪律），但在 `会话操作`／`候选操作`／`Agent规则操作` 三个入口显式收窄，缺回调即抛接线错误。
- **`取有效当前意向编号` 提取为共享 selector**：顶栏、市场 P4、市场横幅、在谈 P5 四处必须引用同一个有效 ID，这正是本轮修复的缺陷本身；三个真实调用点重复同一段判断的分歧风险高于一个 6 行纯函数的成本。
- **胶囊消歧的城市/薪资两级是对碰撞组无条件追加**（Spec §4.2 规则 2、3 的字面读法），序号只在最终仍相同时追加。Spec 举的 `产品经理 · 上海（1）` 对应薪资说明为空的情形，已单独钉一条用例。
- **发布页的意图有效性刻意不把 `状态.当前岗位编号` 当触发源**：本页没有切岗入口，用户要选别的岗必须先离开（卸载即失效）；而发布自己的 `水合后端岗位` 会改这个值，把它算进来会让正常发布自我作废。触发源是路由 key、主体、角色与卸载。
- **`MatchCase列表` 在错误行在场时不再渲染「暂时没有在谈职位」**：那不是事实，只是这次没读到。这超出「不能只显示正常空态」的字面要求，但同一段代码里保留一句假定论会让修复本身失去意义。

## 5. 已完成 / 未完成

已完成：
- 六个 Task 的实现与逐 Task 定向测试全部 PASS。
- `npm run typecheck` 在每个 Task 收尾处 PASS（最后一次在 `f3c85bd8`）。
- 范围审核：`git diff --name-only origin/main...HEAD` 未出现任何 `.css`、视觉基线、E2E/CI 脚本、Mock reducer 语义或 wire 契约变更；`src/状态/领域/候选资料.ts` 只改 Backend 的 `水合后端意向` 分支并新增一个导出 selector，Mock 的 `改意向/删意向/新增意向/选新当前意向` 逐字未动。

未完成 / 未运行：
- 异构代码 review（Codex）已完成三轮并干净收敛，见 §8。
- **Final gate 的四项权威非浏览器验收**（`npm test`、`npm run typecheck`、`npm run lint`、`npm run build` 在最终候选上跑一次）—— 未执行，等待用户明确确认。`npm run lint` 与 `npm run build` 本会话一次都没跑过。
- **合入 target** —— 未 merge、未 push。

## 6. 浏览器与真实栈：明确未运行

- 本轮浏览器 L3 责任为 `none`（用户显式豁免）。**没有**运行任何 Playwright、agent-browser、UI 截图采集、视觉比较或真实后端浏览器旅程，也未修改这些脚本、CI 配置与视觉基线。
- 视觉排版效果**不宣称已验收**，交 PM 后续确认。
- 后端 `feat/recruitment-p7-screening-keywords` 的空 keywords 修复**部署版本本会话未核实**。所有 Vitest/接口层 PASS 都不能替代双端真实栈走查。

## 7. 待联合验收

- 委托 → 在谈 → 详情的双端真实栈走查：`conditional`，owner 为后续联合验收执行者。
- 前置：先记录已部署后端修复的精确版本，再验证链路。不改前端空关键词业务输入、不吞 500、不补假列表。
- 本轮所有前端接口测试 PASS 一律标记为「待联合验收」，不作为真实栈结论。

## 8. 异构代码 review 裁决记录

reviewer：Codex（`codex-cli 0.153.4`，`gpt-5.6-sol`，`model_reasoning_effort=high`，`-s read-only`）。
共用守约规则：`/Users/visionclaw/coding-harness/skills/_shared/review-contract.md`。
冻结范围：`git diff 68a701f1...<该轮 HEAD>`（仅实施代码；规划文档已在规划阶段单独完成三轮 Claude review，不重复审）。
绑定合同：Spec `e6f4af66` / blob `f5839c41`，Plan `7ca3f00d` / blob `bdbf4508`。
reviewer 未跑任何测试（合同要求）。每轮结束都先跑 post-round guard，三轮均确认工作树状态与 HEAD 未被 reviewer 改动。
artifacts：`/tmp/codex-review-loop/session-Fyb2aH9d`，thread `01a07ff7-a146-7ec0-b29f-dbd98a5cd1de`。

### 第 1 轮（候选 `b5830eb9`）——2 条 finding，均 required

**[1] 权威重读未包含新岗位时仍被当作发布成功** — 必要性 required，复杂度影响 不变 → **采纳并修复**

- 核实：`切当前岗位` reducer 不校验编号；`候选推荐` 的 `活跃岗位` 要求岗位在 `岗位列表` 且 `状态 === '在招'`；
  Spec §8 明确「同时保证其对应的服务端岗位已经水合」。失败场景成立：重读没带回新岗时用户看到
  「岗位已发布」并进入当前岗指向幽灵坐标的主壳（胶囊不高亮、P4 无 scope）。
  原实现漏了这一条，且原新增测试把该错误行为固定成了预期。
- 修复：`src/数据/招聘数据源/岗位.ts` 的 `创建岗位` 在权威重读后要求列表中存在该编号且状态为在招，
  否则抛 `BFF错误(200, 'invalid_response')` 走既有错误恢复。测试改为断言拒绝，另加 archived 用例。

**[2] 绕过 decoder 的非字符串终局时间没有安全降级** — 必要性 required，复杂度影响 不变 → **采纳（部分保留）**

- 核实：`new Date(null)` / `new Date(0)` 是合法的 1970 时间，null 或数字的 `finalizedAt` 会渲染成
  `1970-01-01 08:00` 而不是「时间待确认」，属编造终局时刻。Spec §6.2 明确要求异常值兜底。成立。
- 修复：`格式化终局时间` 在构造 `Date` 前加 `typeof 原文 !== 'string'` 守卫；补 mapper 反例注入
  `null` / `0` / 大数字 / 对象 / 数组。
- **拒绝的部分**：Codex 另建议给 `Intl.formatToParts` 包 try/catch。排除 NaN 日期后未识别出会真实抛错的
  输入，`CLAUDE.md` 禁止为理论完备性增加防御代码。已在第 2、3 轮提示中请其给出会抛错的具体输入，
  两轮均未给出，故维持拒绝。

修复 commit：`a4f01870`。受影响范围复验 476/476 PASS，typecheck PASS。

### 第 2 轮（候选 `a4f01870`）——1 条 finding，required

**[1] `job_id` 仍被 `trim()` 改写，未满足精确回传契约** — 必要性 required，复杂度影响 不变 → **采纳并修复**

- 核实：这条抓的正是第 1 轮修复自身的不一致 —— 裁决记录写「逐字比对，只用 trim 判空」，
  代码却是 `创建岗位编号 = result.job_id.trim()`，并拿改写值当附属存储键、权威列表匹配键与回传值。
  首尾带空白的 opaque ID 会把附属写在 trim 后的键上（读取路径按原始 `dto.job_id` 查，附属丢失），
  随后逐字匹配失败并误抛 `invalid_response`。成立。
- 修复：`创建岗位编号` 直接取 `result.job_id` 原始值，`trim()` 只用于判空；补首尾空白 ID 的逐字用例。

修复 commit：`19c724a5`。定向复验 150/150 PASS，typecheck PASS。

### 第 3 轮（候选 `19c724a5`）

**`NO FINDINGS`** —— 干净收敛，未触及 3 轮上限。

### 结论

无未解决的 required finding。唯一未采纳项是第 1 轮 [2] 的 try/catch 建议，理由与两轮追问结果已记录在上。
