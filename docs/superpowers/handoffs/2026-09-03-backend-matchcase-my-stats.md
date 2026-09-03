# Backend MatchCase「我的」统计 Plan Handoff

handoff_version: 5

## Verdict

- 实现：**READY**
- 唯一 plan-scope authoritative verdict：**PASS** —— `npm test` exit 0（147 个测试文件 / 2621 个测试全部通过）。
- 验收模式：`VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local`（单元测试为必需验收，未以浏览器手测代替；`npm run test:e2e:data-source` 属可选 L2 补充，本批未运行——fixture 条件未确认，不冒充证据）。

## Baselines

- Spec：`docs/superpowers/specs/2026-09-03-backend-data-truth-source-design.md`（`2cddbe8d` 起，经 r1–r3 文档评审冻结于 `2aad86bf`）。
- Plan：`docs/superpowers/plans/2026-09-03-backend-matchcase-my-stats.md`（`7fe2feb2` 起，同上冻结）。
- 实施基线：`7fe2feb2`（Plan 文档冻结终态）。实施前按 Plan 全局约束 fetch 并普通 merge 最新 `origin/main`（`b891e528`，仅登录页 slogan/渐变改动，与本 Plan 零冲突），merge commit：`994bfa8d`。未 rebase 任何已批准文档提交。

## Task Commits

| Task | Commit | 内容 |
| --- | --- | --- |
| 1 | `0ed68aea` | `P5列表快照.ownerSubjectId` 内存标记（类型 + 三个构造器 + 缓存短路 + 追加预检同 owner 才可复用）；根 action `清后端MatchCase演示状态`；Backend 种子四个 legacy 数组归零；`清账号状态` 与 P5 主体基串 effect 各派发一次；MatchCase列表/MatchCase历史 当前主体门控 + effect 依赖 |
| 2 | `2bb799a4` | 新增 `src/状态/后端/MatchCase统计.ts`：`取P5Open统计`（N/N+/0/—）与 `取P5候选横幅状态`（既有四态投影）纯 selector + 测试 |
| 3 | `6871dc44` | 我的/企业我的 注册各自 unfiltered P5 scope 并消费 selector；已归档/意向达成 Backend 固定 —；代理卡复用 openCount；在谈首页/看市场共用 `取P5候选横幅状态`；双端代理详情复用 unfiltered 统计（新建两个测试文件） |
| Review r1 | `d82de7d6` | Codex P2 修复：Provider P5 主体基串 effect 首个主体到达（`'' → 基`）跳过清理，保住同帧子组件注册的 scope（详见下） |

## TDD Evidence（每 Task 严格 RED → GREEN）

| Task | RED | GREEN |
| --- | --- | --- |
| 1 | `npx vitest run` 四文件 → 8 failed / 195 passed（ownerSubjectId 缺失、Backend seed 仍带演示数组、旧 owner 行仍可见；无桩 TypeError） | 同命令 → 203 passed |
| 2 | `npx vitest run src/状态/后端/MatchCase统计.test.ts` → FAIL（模块不存在） | → 6 passed |
| 3 | 七文件 → 11 failed / 103 passed（页面仍读 legacy 数组、无 scope 注册、横幅未共用） | → 114 passed |
| 4 静态 | — | `npm run typecheck`、`npm run lint`、`npm run build` 全部 exit 0 |

Review r1 修复同样 TDD：新增 Provider 级测试「首个主体到达不清掉同帧子组件注册的 P5 scope」先 RED（快照永不落成）后 GREEN（`src/状态/应用状态.test.ts` 120 passed）。

## Review Rounds（Codex 多轮，宿主为 Claude Code）

- R1（`codex exec review --base 7fe2feb2`，gpt-5.6-sol / high）：1 条 [P2] —— 主体切换时页面加载与 Provider P5 主体基串清理的 effect 顺序竞态（子 effect 先注册，父清理把可见范围置 null、清空代际表，在飞读取被 fence 丢弃，无轮询的「我的」页停在 —）。
  处置：**修复可达路径**（mount 恢复 `'' → sub|role`：刷新落在「我的」页时页面与主体同 commit 挂载——`d82de7d6` 跳过首个主体到达的清理，因登出/401 转移已清空过）；**拒绝不可达路径的通用机制**（同角色换主体且页面保持挂载：逐条推演 mount 恢复、登录、切身份、401/登出、P8 注销全部主体变更路径，均先经 `主体=null` 或页面卸载，当前导航流不可达；依赖 `P5工作区` 引用重跑 effect 的方案会因起步快照提交形成无限请求循环，spec 的「成功重试后更新」由 owner 门控 + 重挂载满足）。
- R2（`codex exec resume` 同会话）：**NO FINDINGS** —— 第 2 轮 clean，循环终止（未达 3 轮上限）。

## Authoritative 与 Inner-loop Evidence

- Authoritative（唯一 plan-scope gate）：`npm test` → exit 0，147 文件 / 2621 测试通过（含全部既有 P5 列表/历史/操作、会话边界、Mock 回归）。
- Inner-loop：见上表；`typecheck`/`lint`/`build` exit 0。

## dependency_drift

- `origin/main` 漂移（`b891e528` 登录页两提交）与本 Plan 无交集，merge 无冲突；P5 类型与 Provider 无现场漂移，Plan 冻结的接口全部按原文落地。
- 实施中唯一计划外现场发现：`MatchCase列表.test.tsx` 的两个屏级 helper（`置求职屏状态`/`置招聘屏状态`）与 `MatchCase历史.test.tsx` 的 `置历史状态` 也构造 `P5工作区`/`P5历史` mock 状态，需同样补主体（Plan 只点名了 `置P5状态`/`快照` helper）；按「helper 集中、不改单个用例」的原则补齐，属 Plan 精神内的等价调整。

## 下游 contact-events Plan 的前序契约（必须保留）

- `P5列表快照.ownerSubjectId: string | null`（仅内存，不进持久化）；构造器/缓存短路/追加预检的 owner 核对。
- 根 action `{ 型: '清后端MatchCase演示状态' }` 及其在 `清账号状态` 与 `应用状态.tsx` P5 主体基串 effect 的两处派发。
- **Provider P5 主体基串 effect 的首个主体到达跳过清理语义**（`d82de7d6`）：`'' → 基` 不清、`基 → ''` 与非空基串间转移照清。contact Plan 修改共享状态文件（`类型.ts`/`会话操作.ts`/`应用状态.tsx`/`MatchCase操作.ts`）时不得回退该分支，否则刷新落在 P5 页面的首个加载会被栅栏丢弃。
- 共享 selector `取P5Open统计` / `取P5候选横幅状态`（`src/状态/后端/MatchCase统计.ts`）供后续统计消费方复用。
- Residual（记录非缺陷）：「同角色换主体且页面保持挂载」在当前导航流不可达；若未来新增此类流程，需为主体边界引入可重试的加载信号（届时 spec 的 `N+`/— 语义不变）。

## Release / L3

- Release handoff：`required: false`、`owner: none`、`required_mode: none`、`nightly_only_mode: none`、`status: none`。
- L3/shared environment：`integration_requirement: none`；`selection_ssot: none`；`selection_gap: none`；`l3_selection: []`。