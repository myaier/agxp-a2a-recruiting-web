# Backend 候选接触记录（contact-events）前端 Plan Handoff

handoff_version: 5

## Verdict

- 实现：**READY**
- 唯一 plan-scope authoritative verdict：**PASS** —— `npm test` exit 0（152 个测试文件 / 2839 个测试全部通过）。
- 验收模式：`VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local`（单元测试为必需验收，未以浏览器手测代替；`npm run test:e2e:data-source` 属可选 L2 补充，本批未运行——fixture 条件未确认，不冒充证据）。

## Baselines

- Spec：`docs/superpowers/specs/2026-09-03-backend-data-truth-source-design.md`（§B 候选接触记录；经 r1–r3 文档评审冻结）。
- Plan：`docs/superpowers/plans/2026-09-03-contact-events-frontend.md`。
- 实施基线：`97058f2c`（= 当时的 `origin/main` tip，含前序 Backend MatchCase「我的」统计 Plan 的全部产出）。实施前 fetch 最新 `origin/main` 后 HEAD 与之完全一致，零漂移、无需 merge。
- wire 合同冻结：BFF `origin/release/0.2.5@2be8c27489e9eef8fec20b83eb5fd443faf9dfbf` 的 OpenAPI（`limit` 1–50、cursor 非空 base64url ≤512 字节、item/organization 闭合键集、闭合 action、RFC3339）。

## 前序依赖核对（实施前完成）

- `P5列表快照.ownerSubjectId`（`类型.ts`）在场，未被改动。
- 根 action `{ 型: '清后端MatchCase演示状态' }` 及其在 `清账号状态` 与 P5 主体基串 effect 的两处派发在场，未被回退。
- Provider P5 主体基串 effect 的「首个主体到达跳过清理」语义（`d82de7d6`）在场；本 Plan 的接触记录会话基串 effect **显式沿用同一语义**（见「与 Plan 草图的现场校准」第 1 条）。
- 共享 selector `取P5Open统计` / `取P5候选横幅状态` 在场，未触碰。

## Task Commits

| Task | Commit | 内容 |
| --- | --- | --- |
| 1 | `06d24914` | `src/数据/招聘数据源/接触记录.ts` strict facade（页/item/organization 三层闭合键集、闭合 action、event/org ID pattern、1–200 展示名、RFC3339、同页 event ID 去重、next_cursor null 或 ≤512 base64url；调用方 cursor 发请求前校验）+ 组合为根第十六个域 facade |
| 2 | `58eda4b6` | `类型.ts` 增 `接触记录快照`/`接触记录状态`/`接触记录运行时引用`/`接触记录操作` 并入 `应用操作`；`接触记录操作.ts`（subject+candidate 角色+会话代际+域读代际栅栏、同 owner 单飞属主登记/过期接管、首载/force 原子替换、追加原子提交与 cursor 消费纪律、当前 401 统一清账号、迟到成败只释放自己的锁） |
| 3 | `8379d698` | Provider 种子/三个运行时引用/接触记录会话基串 effect（首个主体到达跳过清理）；`清账号状态` 收编本域（state 摊平 + 引用级清理）；操作 shape/暴露 smoke + 登出/切 recruiter/换 subject 三条会话边界用例；11 个既有 `后端状态` 测试 fixture 只补 `...创建空接触记录状态()` 底座 |
| 4 | `6bc13a5c` | `屏幕/接触记录.tsx`：导出纯函数 `格式化接触时间`（本地化绝对时间）与 `接触事件到展示`（三 action 既有字面值映射 + display_name 首 Unicode 字符字标）；Backend 渲染 gate（仅当前 owner 成功快照可见）；挂载触发一次 `加载接触记录`；Mock 分支零 operation 调用 |
| Review r1 | `8c363ece` | 3 项修复（见 Review Rounds） |

## TDD Evidence（每 Task 严格 RED → GREEN）

| Task | RED | GREEN |
| --- | --- | --- |
| 1 | `npx vitest run 接触记录.test.ts HTTP招聘数据源.test.ts` → 新模块解析失败（1 failed） | 同命令 → 56 passed |
| 2 | `接触记录操作.test.ts` → 模块不存在，15 用例无法运行 | → 15 passed |
| 3 | `应用状态.test.ts` → 5 failed / 120 passed（操作 shape 缺两方法、会话边界未清） | 三文件 → 190 passed；fixture 补齐后 `typecheck` exit 0 |
| 4 | `接触记录.test.tsx` → 14 failed / 1 passed（页面直渲染 Mock 常量、无纯映射导出） | 三文件 → 58 passed |
| Review r1 修复 | 三文件 → 7 failed（中性态断言、非法日历、已消费 cursor 用例先失败） | → 63 passed；`typecheck` exit 0 |

## Review Rounds（Codex 多轮，宿主为 Claude Code）

- R1（`codex exec review --base 97058f2c`，gpt-5.6-sol / high）：4 条 —— 1×[P1] + 3×[P2]。
  - [P1] 未知快照显示空态文案（把未知冒充权威零）→ **修复**：页面 gate 拆出 `快照可见`，空态文案只属于当前 owner 的成功空快照；未开始/进行中/失败/owner 不匹配渲染零业务行。
  - [P2] 清理后作废新主体首载 → **拒绝**：该路径要求「/visitors 保持挂载且非空基串间转移」。当前导航流不可达——401/登出后 `应用.tsx` 强制 `Navigate` 登录页（页面卸载）；登录与切身份均发生在其他屏；mount 恢复的首个主体到达（'' → 基）已按 P5 `d82de7d6` 同款语义跳过清理。与前序 MatchCase Plan r1 已记录的 residual 同源，不为其引入重试机制。
  - [P2] `Date.parse` 归一化非法时间（2026-02-30 / 24:00 / :60）→ **修复**：`要求RFC3339` 改为分量往返校验（按原时区偏移还原逐一比对），与 Go 后端解析同口径。
  - [P2] 响应返回更早已消费过的 cursor 仍整页追加 → **修复**：追加提交前新增 `接触记录已消费游标.has(页.nextCursor)` 拒绝，坏页整页不提交。
  - 修复提交：`8c363ece`。
- R2（`codex exec resume` 同会话）：1 条 [Important] —— 要求为未知状态渲染加载/暂不可用提示文案 → **拒绝**：新增提示文案是 Plan 冻结范围外的新文案设计（spec 非目标「不改空态视觉或普通文案设计」、Plan 全局约束「不修改 CSS、空态设计文案」），本屏无语义正确的既有中性文案可复用；当前「零业务行 + 不冒充空结果」是冻结约束内对「渲染中性状态」的最小实现。
- R3（同会话 resume）：**NO FINDINGS** —— 第 3 轮 clean，循环终止（达到 3 轮上限前以无 finding 收口；R2 的拒绝经 reviewer 复核被接受）。

## Authoritative 与 Inner-loop Evidence

- Authoritative（唯一 plan-scope gate）：`npm test` → exit 0，152 文件 / 2839 测试通过（含全部既有会话边界、Mock 回归与 P5 域回归）。
- Inner-loop：见上表；`npm run typecheck`、`npm run lint`、`npm run build` 均 exit 0。

## 与 Plan 草图的现场校准（不改变合同，均为最小实现）

1. **接触记录会话基串 effect 采用「首个主体到达跳过清理」语义**（Plan Task 3 草图未含该分支）：刷新落在 `/visitors` 时页面与主体同 commit 挂载，子 effect 先于父 effect 发出首载；无跳过分支时父清理会把首载按域代际整包作废，页面停在缺失态——与 MatchCase r1 P2 完全同构的可达竞态。前序 Handoff 明确要求修改共享状态文件时不得回退该语义；同源竞态照搬其修法（`'' → 基` 不清、`基 → ''` 与非空基串间转移照清）是该契约的最小校准。
2. **调用方 cursor 校验的拒绝形态**：`读取接触事件` 是 async 方法，`BFF错误(0, 'invalid_request')` 以 promise rejection 抛出；测试用 `rejects` 断言（语义与 Plan 的「请求前抛、零请求」等价）。
3. **`创建空接触记录状态` 返回 state slice `{ 接触记录: 快照 }`** 而非裸快照：与 `创建空P5MatchCase状态` 同款纪律，Provider 首帧种子与 `清账号状态` 才能按 Plan 要求直接 spread。
4. **RFC3339 超出 Plan 草图下限的严格化**（R1 [P2] 修复）：Plan 草图写「RFC3339 正则且 `Date.parse` 有效」，spec 写「严格 RFC3339」；分量往返校验满足 spec 的严格口径，域内 ~12 行，无共享框架。

## dependency_drift

- 实施前 fetch 最新 `origin/main`：与本地基线完全一致（`97058f2c`），无 merge、无冲突。
- 前序 MatchCase Plan 产出场（owner 字段、legacy 清理 action、Provider 清理接线、P5 基串 effect 首主体跳过语义）逐项核对在场，全部保留。
- 计划外现场发现：`后端状态` 新增必选成员后 11 个既有测试文件构造完整对象需补 `...创建空接触记录状态()` 底座（Plan 已预期「受影响 fixture 只补底座」）；其中 `应用状态.test.ts` 后端桩的 `读取接触事件` 返回类型按 `接触事件页` 收窄。均属 Plan 精神内的等价调整，不改任何用例行为。

## Residual（记录非缺陷）

- 未知状态（未开始/进行中/失败/owner 不匹配）渲染零业务行、无提示文案——中性提示文案是 Plan 冻结范围外的设计项，待 PM 确认后另立批次；首载失败的重试路径是重新进入页面（Plan 冻结）。
- 「页面保持挂载 + 非空基串间主体转移」在当前导航流不可达；若未来新增此类流程，需为主体边界引入可重试的加载信号（与 MatchCase Handoff residual 同款，届时 spec 的中性状态语义不变）。
- 分页 `nextCursor`/追加能力在状态与 operation 中保留，但页面无「加载更多」控件（Plan 非目标，不新增未经设计确认的控件）。

## Plan-scope testing boundary

- L3/shared environment：`integration_requirement: none`；`selection_ssot: none`；`selection_gap: none`；`l3_selection: []`。BFF 合同已由后端 OpenAPI/BFF 测试冻结，本 Plan 不要求共享后端才能判定前端实现。
- 可选 L2：rolling integration owner 可在组合 commit 上运行 fixture Backend E2E；它不得冒充真实 BFF L3。
- Release handoff：`required: false`、`owner: none`、`required_mode: none`、`nightly_only_mode: none`、`status: none`。