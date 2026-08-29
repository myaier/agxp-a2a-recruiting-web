
## 注册流程分叉口径（用户 2026-08-20 拍板）

- 「你是学生吗」是注册流程的**分叉口**。
- 2026-08-20 用户发的 11 张 BOSS 截图序列（完善资料 → 期望月薪 → 创建在线简历 → 求职状态 → 最高学历 → 毕业院校 → 专业 → 就读时间段 → 个人优势 → 添加头像）对应的是**选了「不是学生」**之后的流程。
- **学生分支的流程与此不同，尚未设计**——等用户后续提供学生分支的截图/画稿再实现，实现前学生分支暂沿用现状，不得按非学生序列当作学生流程宣称。

## 功能对标口径（用户 2026-08-20，二次澄清后）

用户："我建议你直接把所有的功能一比一模仿，无非就是设计上会有一些区别" → 随后澄清：
**只针对用户发来的 onboarding 截图**（非学生注册序列）一比一克隆功能、视觉用自家风格；
**其他页面先不动**，不要自行扩大对标范围。

## 2026-08-24 · 验证链漏洞：1 failed 也被当成绿

推名片就地输入那单时，e2e 实际 1 failed / 8 passed，但命令链
`npx playwright test | grep -E "passed|failed"` 匹配到输出就返回 0，
`&&` 没拦住，红着推出去了（约 6 分钟后补上对齐测试的提交）。
教训：**验证命令必须以退出码为准**——playwright 失败时进程本身退出非 0，
应该直接 `npx playwright test && git push`，不要在中间插会吞状态码的
grep 管道；要摘要就 `tee` 出来另行 grep。

## 2026-08-29 · P5 前端地基切片验收门（Task 5）

- 执行前前端 SHA：`1f249ddd67a75d8ee1206c0af6aea4912d161fa7`（分支
  `brainstorm/frontend-p5-integration` 在 Task 1 之前的 HEAD）。
- Step 1 范围禁写扫描（两条 `scan_forbidden`，rg 退出码 1＝干净）：**两条均通过，
  exit 0，生产文件零匹配**。测试文件不在扫描范围（brief 原文允许）。
- Step 2 验证链逐条以退出码记录：
  - 聚焦套件 `npm test -- --run <8 个测试文件>` → 8 files / **217 passed**，exit 0
  - 全量 `npm test` → 92 files / **1231 passed**，exit 0
  - `npm run typecheck`（`tsc -b --noEmit`）→ exit 0
  - `npm run lint`（oxlint）→ exit 0
  - `npm run build` → built in 666ms，exit 0
- 移交口径（brief 逐字）：

  ```text
  P5 frontend foundation complete; contract-gated wiring not started.
  Delivered: opt-in no-store transport, exact P4 resume file/version selection,
  closed supplementary-prompt resolver, and one-shot PDF object URL lease.
  Excluded: P5 list/history/detail DTOs, state enum/matrix, polling, page routes and actions.
  ```

## 2026-08-29 · P5 前端 Plan 2 最终 backend 合同校准

- 校准 verdict：`PASS — READY_FOR_EXECUTION`；本次只改前端 spec/plan/日志，未修改后端代码。
- 精确 backend 候选：worktree `/Users/visionclaw/.paseo/worktrees/recruitment-p5-contract-completion`，分支 `impl/recruitment-p5-contract-completion`，clean SHA `34306f53984ff1624f857d05b9925f36da721b40`；校准时 `origin/release/0.2.5` 指向同一 SHA。
- BFF 公开 schema：candidate open/history 复用 `CandidateWorkspacePageEnvelope → CandidateMatchCaseWorkspacePage → CandidateMatchCaseWorkspaceItem`；recruiter 复用 `RecruiterWorkspacePageEnvelope → RecruiterMatchCaseWorkspacePage → RecruiterMatchCaseWorkspaceItem`；history 没有另造 item。detail 分别是 `CandidateMatchCaseDetailEnvelope → CandidateMatchCaseDetail` 与 `RecruiterMatchCaseDetailEnvelope → RecruiterMatchCaseDetail`。
- required / nullable：candidate item required `state, needs_action, intention_id, job`，recruiter item required `state, needs_action, job, candidate_alias`；page required `items, next_cursor`，其中 `next_cursor: string | null`。candidate detail required `state, needs_action, available_actions, stages, intent_confirmations, intention_id, job`；recruiter detail required 同一生命周期块加 `job, candidate_alias`。`current_coordination` / `terminal_summary` 只能 absent，不能显式 `null`；`MatchCaseView.outcome/outcome_code` required nullable，`finalized_at` optional nullable；cross-role/extra/missing 字段 fail closed。
- `MatchCaseStep` 已发布 exact 17 词 closed enum；`apps/recruitment/testdata/matchcase-state-matrix.json` 的 exact 17 行 `lifecycle + stage + status → steps` 映射（展开为 32 个合法四元组）同时约束 Recruitment validator/OpenAPI 与 BFF validator/OpenAPI，unknown/非法 tuple 拒绝。
- viewer action 证据：open SELECT、keyset predicate、order 共用 viewer-specific `needs_action` 表达式，顺序固定 `needs_action DESC, updated_at DESC, case_id DESC`；history cursor 只含 `updated_at + case_id`。same-Case 双角色分歧、tie-break、无重复/遗漏测试均存在。
- handoff 证据：完成事务把 completed row 与 durable outbox 原子写入；公开读、`case_completed` event metadata、timeline 全部输出 `completed/intent_confirmation/passed/handoff_pending`，rollback 不会泄露无 outbox 的 completed；ended 保持 `complete`。
- 最小 context：candidate detail 只有 `intention_id + frozen job`，recruiter detail 只有 `frozen job + candidate_alias`；直接 detail 不依赖 list memory，missing/cross-role/extra 字段均 fail closed。
- 精确 SHA 验证结果：
  - `tools/test service recruitment-bff --suite recruitment-bff-unit --suite recruitment-bff-build --suite recruitment-bff-source --keep-going` → PASS，receipt `run-20260829T092114-7b7afff2`。
  - `tools/test service recruitment --suite recruitment-unit --suite recruitment-build --keep-going` → PASS，receipt `run-20260829T092126-283ff96b`。
  - 同 `test-postgres.sh` 临时 PostgreSQL 环境下定向运行 8 个 P5 store 顶层测试 → 全部 PASS，`ok recruitment.agxp.ai/internal/store 14.164s`。
  - broad `recruitment-postgres` suite → `FAIL reason=timeout`，610.4s，receipt `run-20260829T092213-3deee8ab`；没有断言失败，不伪装 PASS。后端 authoritative affected receipt `run-20260829T083945-22fa739e` 在相同 production/store 代码上该 suite 396.3s PASS；之后仅 `apps/recruitment-bff/scripts/local-e2e.sh` 有测试脚本提交。因此本次归类为非合同 performance flake，不阻断已通过的 P5 focused admission。
- 稳定能力未重设计：`supplementary_question.ref` 仍是 `prompt_id`；保留 `fact-responses`、Case-scoped `resume-submission/content`、`agent-instructions`；没有 action payload DTO、`next_step`、`conversation_ref` 或 `handoff.published`。
