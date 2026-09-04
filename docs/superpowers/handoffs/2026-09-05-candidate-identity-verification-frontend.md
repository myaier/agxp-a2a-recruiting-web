# FE-IV-01 候选实名认证前端接入 Handoff

**日期：** 2026-09-05
**工作包：** FE-IV-01
**分支：** `fe-iv-01-frontend-fixes`

## 基线

- 前端实现基线：`origin/main@280f83ef0670d07465e87fd56a2a4b0b843be04e`（开工前 `git fetch origin main` 复核未前进）
- 后端合同冻结：`agxp-monorepo release/0.2.5@21e34ff047bf17e20e0fc0e13f1e391460456270`，BFF OpenAPI `apps/recruitment-bff/openapi/mobile-v1.yaml`（开工时 HEAD 恰为该 SHA，逐项核对 summary/request 键集、四枚举、revision minimum 1、create 202、cancel 200 + quoted If-Match、Idempotency-Key 16–128 可见 ASCII，无漂移）
- Spec：`docs/superpowers/specs/2026-09-04-candidate-identity-verification-frontend-design.md`
- Plan：`docs/superpowers/plans/2026-09-05-candidate-identity-verification-frontend.md`

## Task commits（每 Task 单独提交，严格 RED → GREEN）

| Task | Commit | 内容 |
| --- | --- | --- |
| 1 | `d4f6e152` feat: add candidate identity verification data source | 严格 decoder + 三方法 + 根 facade 组合 |
| 2 | `fcb3583e` feat: manage candidate identity verification state | 快照/operation owner/fence/单飞/幂等 key/对账 + 全部会话清理口 |
| 3 | `3040daf4` feat: add candidate identity verification flow | 设置页五状态映射 + `/settings/identity-verification` 路由 + 四状态页面 |
| 4 | `747009af` test: cover candidate identity verification journey | data-source E2E 两旅程 + handoff |
| review-r1 | `b826d3c4` fix(review-r1) | 对账后复查会话栅栏 + pending 刷新失败反馈（codex review round 1） |
| review-r2 | `df7abe38` fix(review-r2) | 刷新开始清旧页面错误（codex review round 2） |

各 Task 的 RED 均先运行并确认失败原因正确（模块不存在 / 断言缺失 / fixture 未定义）后才实现。

## 验证结果（全部在本 worktree 实际运行）

| 门 | 命令 | 结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run`（本任务 8 个直接相关测试文件） | **453 passed**（review 修复后相关文件合计更多） |
| 类型 | `npm run typecheck` | exit 0 |
| Lint | `npm run lint`（oxlint） | exit 0 |
| 构建 | `npm run build` | exit 0（614ms） |
| **权威单测门** | `npm test` | review 修复后终态 **3380 passed，0 failed**（初版 3376 + 4 个 review 修复测试） |
| 定向 E2E | `npm run test:e2e:data-source -- --grep "候选实名"` | 2 passed（Backend 闭环 + Mock 隔离） |
| 全量 E2E | `TZ=UTC npm run test:e2e:data-source` | 77 passed / 23 failed（见下） |

### 全量 E2E 的 23 个失败与本变更的关系

23 个失败全部为**基线 `280f83ef` 的既有失败**，与本变更无关。对照实验：在纯净基线 `280f83ef`（stash 全部本分支变更后 checkout）以同一命令 `TZ=UTC npm run test:e2e:data-source` 运行，结果同为 **23 failed / 75 passed**；本分支为 23 failed / 77 passed（多出的 2 个通过即本任务新增的候选实名旅程）。失败集逐类核对一致：

1. **账号安全时间显示类**（P8 账号安全首屏 / 数据导出 / 招聘方名片时间等）：基线提交 `2bf49f8b "fix: format account timestamps locally"` 把 `格式化账户时间` 从固定时区改为浏览器本地时区，单测同步更新但 E2E 的硬编码期望文本（如 `创建 2026-09-01 08:00`）未同步 —— 在 UTC+8 本地时区必失败，`TZ=UTC` 下部分恢复（fixture `08:00Z` 与期望 `08:00` 在 UTC 恰好重合）。
2. **发岗向导跳转类**（P1C/P3/P4/P5/P6/招聘方 onboarding 等长旅程的 `toHaveURL(/#\/hr$/)`）：发岗三步向导走完后停在 `/hr/post-job` 未跳主壳，基线同样失败，属既有待修问题。

本变更新增的两条 E2E（`候选实名提交刷新取消闭环 @backend`、`Mock 候选实名保持原型且零实名请求 @mock`）在两种时区下均通过。

## E2E fixture 契约（route fixture，非真实 BFF）

`安装BFF路由` 新增可选 `候选实名域`：

- `GET /api/v1/me/identity-verification` → 当前严格摘要信封 + no-store + ETag；
- `POST /api/v1/me/identity-verification-requests` → 校验 Idempotency-Key（16–128 可见 ASCII）、part 名恰 `metadata + 1–2 evidence`、metadata 恰两键；首次写 pending（revision 1→2），同键同输入重放同 summary，异输入 409 `idempotency_conflict`；202 不伪造 ETag；
- `POST .../{request_id}/cancel` → 校验 body `{}` 与等于顶层 revision 的 quoted If-Match，错 revision 409；成功回 `unverified + cancelled`（revision +1）。

fixture 只记录 part 名、metadata JSON、headers 与请求计数；合成姓名与测试进程内合成 PNG bytes，不把文件 bytes/文件名写进任何断言或交付记录。不实现 reviewer 终审路由；verified/rejected 已由组件 fixture 覆盖。

## Review 轮次

- Plan 本身在开工前已经过两轮 review（`5b0bc7ea` close FE-IV-01 plan gaps、`7ecbd722` align upload and reconciliation rules）。
- 跨 agent 交付 review：codex-review-loop（reviewer：Codex `gpt-5.6-sol` high effort，3 轮，范围冻结 `280f83ef...HEAD`）：
  - Round 1（3 findings）：P1「HTTP 客户端自动重放实名创建」**拒绝**（见下）；P2「对账完成后未复查会话栅栏」修复（`b826d3c4`，create 409 / cancel 404·409·503 对账后复查 fence，过时返回 `已换代`，2 个新测试）；P2「pending 刷新失败无反馈」修复（同提交，pending 分支渲染 `快照.错误`，1 个新测试）。
  - Round 2（2 findings）：Important「自动重放」重申——**再次拒绝**（评审未回应合同/spec/plan 三层依据，仅重申立场）；Minor「取消错误遮蔽后续刷新失败」修复（`df7abe38`：刷新开始清 `页面错误`，用可区分文案的测试钉住）。
  - Round 3：**NO FINDINGS**（clean after round 3，含对拒绝项的默认）。
- 已核实后拒绝的 finding（记录理由，按 CLAUDE.md Code Review Rules）：「为实名创建禁用 HTTP 客户端受控重试」。拒绝理由：OpenAPI 冻结合同 `IdempotencyKeyHeader` 原文 *"The client reuses the SAME key for every retry of one user intent"* 钦定同键重试是收敛路径；spec §6.3「不自动重放」约束 operation 层不铸新意图（§6.4 恰要求「保留同一 key」供重试）；plan Task 1 经两轮 review 冻结的请求选项断言即 `幂等: true`；仓库全部幂等 mutation（JD 导入、P8 导出等）共享同一受控重试语义。为单一调用点新增 opt-out 开关自认「复杂度影响：增加」且指不出它防止的现实故障，违反工程原则。

## 真实 reviewer 终审前置（未执行）

真实 reviewer approve/reject 的浏览器闭环**未执行**：现有 local 测试环境未提供安全的 reviewer seed/接口。按 spec §12.4 记录前置条件而不冒充证据 —— 需要后端发布安全的 reviewer 演练入口（或 DB 级 seed 流程）后才可作为集成证据补充；在此之前 verified/rejected 的 UI 行为由组件级严格 fixture 覆盖。

## 范围核对

`git diff --stat origin/main...HEAD` 只包含 FE-IV-01 的 spec、plan、实现、测试、handoff 与两处 review 修复（spec/plan 文档），没有 FE-MC 重写、历史页、自动轮询或通用上传基础设施。FE-MC-01 的 `P5摘要`/`P5摘要快照`/`加载摘要` 原样保留（根 facade 能力表与 Provider 形状断言仍通过）。全局状态、浏览器存储、toast、日志均不含姓名草稿、文件名或 `File` 引用；待定意图只保存幂等 key。

## 交付后流程

按既有工作流：codex-review-loop 审查 → drift 检查 → 直接 fast-forward 推 origin main（不开 PR）。
