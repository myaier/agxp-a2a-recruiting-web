
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
