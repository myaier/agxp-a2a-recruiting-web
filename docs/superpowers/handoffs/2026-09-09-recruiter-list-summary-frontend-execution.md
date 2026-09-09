# 招聘端推荐与在谈 open 列表 candidate_summary 接线 · 执行记录

状态：实施与定向验证完成；实施 review（Codex，1 轮）收敛；**final gate 未获批**，未 merge、未 push、未跑最终 broad gate。

## 版本锚点

- 批准 Spec：`docs/superpowers/specs/2026-09-09-recruiter-list-summary-frontend-design.md`
  revision `5aeb82861d11143c97df5df218f491bc73f3d1d7`，blob `f381411ac0a43b7e6864758da77846284a013733`（git cat-file 核对一致）。
- 批准 Plan：`docs/superpowers/plans/2026-09-09-recruiter-list-summary-frontend.md`
  blob `41be4807368325c403a2cecd665d01149d06f352`（git hash-object 核对一致）。
- 原始前端基线（origin/main tip，规划冻结）：`28a9c812fbba9c291e3f1b8f8ab506ae6233df7d`。
- 候选 HEAD（本轮实施 + review 修复后）：`b200afc3`。
- 后端合同：`/Users/visionclaw/.paseo/worktrees/0yeqiujx/unknown-gecko` @ `96bb69de7`，
  OpenAPI `apps/recruitment-bff/openapi/mobile-v1.yaml` blob `a27aa125cdaf7e8e9096845a1d2f0caff49a9bf8`（未做现场部署核对）。

## 实施（Task 1→2→3 串行，同一执行者）

| Task | 候选 commit | 产物 |
| --- | --- | --- |
| 1 | `7134cd81` | `BFF招聘候选摘要` 类型、`解招聘候选摘要`（include 模式严格 decoder）、`映射招聘候选摘要` 视图、`招聘候选摘要样本` |
| 2 | `23d8d711` | 招聘推荐 available/rejected 列表 GET 附加 `include=candidate_summary`（首页/后续页各恰一次）；展开模式必需摘要键、默认详情拒绝新键；`从P4招聘候选` 仅有键时映射 `候选摘要`；`后端推荐卡` 重写为 Spec §4 卡面（中性文案/0 年/状态文案/工作教育/个人亮点），去掉批次亮点 basis 门与代理小结 |
| 3 | `ffc54a0a` | 仅 recruiter open 的 `GET /api/v1/recruiter/match-cases` 附加 include（带 job_id/cursor 同串）；`解P5列表项` 仅 recruiter+open 必需摘要键；`招聘在谈卡` 主体换摘要（无代号/无匿名头像/无岗位事实段/无匹配环，阶段/待办/跳转保留）；操作层刷新 null 覆盖断言 |
| review-r1 | `b200afc3` | 重复亮点 React key 修复（下标入 key）+ 双卡测试 |

## 定向验证（全部 PASS，未跑最终 broad gate）

- Task 1：`npm test -- src/数据/招聘数据源/候选摘要.test.ts src/数据/招聘候选摘要映射.test.ts`（29）+ typecheck + lint。
- Task 2：Plan 权威命令组（发现推荐/映射/屏幕 + 操作/轮询/匿名简历/已筛/抽屉）374 用例 + typecheck + lint。
- Task 3：Plan 权威命令组（MatchCase 数据源/映射/屏幕 + 操作/历史/企业在谈候选/图标）315 用例 + typecheck + lint。
- review-r1 修复：`候选推荐.test.tsx` + `MatchCase列表.test.tsx` 94 用例 + typecheck + lint。
- 红灯先行记录：Task 1/2/3 与 review-r1 修复均先跑失败再实现。

## 实施 review（异构：Codex reviewer，codex-review-loop skill）

- 模式 FEATURE_BRANCH_REVIEW；冻结范围 `git diff 28a9c812...<round head>`；reviewer 只读、未跑测试（post-round guard 状态/HEAD 对比通过）。
- 契约输入：批准 Spec/Plan blob + CLAUDE.md 守约规则 + 已有定向 PASS 清单；每轮传入共享 review contract。
- Round 1：1 条 finding（契约违反/Minor/required/复杂度不变：合法重复亮点产生重复 React key）。裁决：接受并修复（`b200afc3`）。无未解决 required 项 → 循环在第 1 轮后结束，未达 3 轮上限。

## 真实 backend+local 展示验收（required，未执行）

- 当前**未执行**：缺已登录招聘账号、匹配数据与确认 local 栈部署版本支持 include 的现场核对；本机后端检出 `96bb69de7` 未验证现场运行版本。
- 责任：final gate 获批后按 `docs/dogfood/真实后端行为验收.md` 做两张招聘卡定向浏览器观察（网络单次 include、卡片位置、交互可用、无假值、0/空/男女边界由自动化样本补充），证据存 `dogfood-output/<run-id>/`，记录前后端 revision 与截图；缺输入时记录缺口，不用 Mock 冒充。

## final gate 方案（等待用户确认）

- 候选：`b200afc3`（分支 `feat/align-recommendation-fields`，base `28a9c812`）。
- 已观察 target：origin/main = `28a9c812fbba9c291e3f1b8f8ab506ae6233df7d`（执行时重新 fetch 核对；若前移按 final-integration reference 更新方案并重新确认）。
- 合并动作：target 同步后普通 fast-forward 合入 `main` 并 push，不 force push。
- 补测责任（final_target_base 上重算）：`npm test`（全量）、`npm run typecheck`、`npm run lint`、`npm run build`、受影响 e2e（`npm run test:e2e:data-source`、`npm run test:e2e`，先核对实际选择）、`npm run ui:check -- --base origin/main`；已有定向 PASS 复用，缺口增量补跑。
- 真实 backend+local 两张卡展示验收 required（见上节）；后端正式 development L3 none。