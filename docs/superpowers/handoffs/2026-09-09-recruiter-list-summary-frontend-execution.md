# 招聘端推荐与在谈 open 列表 candidate_summary 接线 · 执行记录

状态：实施、定向验证、实施 review（Codex 1 轮）与 final gate 完成；合入 **origin/main**（fast-forward，普通 push，未 force）。真实 backend+local 浏览器展示验收**未执行**（用户批准 final gate 时明确豁免该项；责任如实记录，见下）。

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

## 真实 backend+local 展示验收（required → 用户豁免，NOT_RUN）

- **未执行**，且 final gate 获批时用户明确「不做真实浏览器验收」。缺项仍成立：无招聘账号登录材料、专用合成数据与现场 include 支持核对（后端检出 `96bb69de7` 未验证现场运行版本）。本项**不记为 PASS**，是遗留未完成责任：下次涉及这两张卡的任务应先补此观察（网络单次 include、卡片位置、交互可用、无假值），证据入 `dogfood-output/<run-id>/`。
- 后端正式 development L3 责任：none → N/A。

## final gate（已获批执行，2026-09-09）

- `final_target_base = 28a9c812fbba9c291e3f1b8f8ab506ae6233df7d`（merge 前与 push 前两次 fetch 均 `Already up to date`，target 未移动）。
- `git merge --no-edit origin/main`：no-op；`final_affected_base = final_target_base`。
- 权威 gate 证据（全部在候选 `0f37105a` 上执行）：

| 项 | 结果 |
| --- | --- |
| `npm test`（全量） | PASS，170 文件 / 3632 用例 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:e2e:data-source` | PASS，67 用例（覆盖受影响的后端推荐/在谈屏） |
| `npm run ui:check -- --base origin/main` | PASS，18/18 场景，gate=report，退出码 0（报告 `ui-regression-output/latest/report.md`） |
| `npm run test:e2e`（默认） | **非 PASS**：4 失败 + serial 中断 1 条未运行，5 通过 |

- 默认 e2e 失败归因：`onboarding.spec.ts:42/86/178`（向导卡在 `#/onboard/status`、毕业时间存值为空）与 `换壳无闪屏.spec.ts:118`。已在 final_target_base `28a9c812` 用临时检出逐条复现，**4 条全部同样失败**（分类：main 预存失败，疑似日期相关产品逻辑），与本候选 diff（招聘推荐/在谈卡接线）无交集；修复超出本任务批准范围。用户裁决（2026-09-09）：以「预存失败已归因并记录、由 main 既有债承担」继续合入；该债务未修复，不是本候选的 PASS 项。
- 真实浏览器展示验收：NOT_RUN（用户豁免，见上）。

## 最终证据汇总（reconciliation receipt）

```yaml
final_target_base: 28a9c812fbba9c291e3f1b8f8ab506ae6233df7d
final_affected_base: 28a9c812fbba9c291e3f1b8f8ab506ae6233df7d
candidate_commit: 0f37105a3556f4421dd7d8e2b90be139334e3ad1
required_items: [npm-test(全量), typecheck, lint, build, test:e2e:data-source, test:e2e(默认), ui:check]
reused_items: []   # 定向组为子集证据，不充当全量项收据；全量项全部按 final_affected_base 重跑
executed_items: 上述 7 项，全部于 0f37105a 执行；默认 e2e 预存 4 失败已归因（同基线复现）并经用户批准继续
invalidated_items: []
fallback_reason: 前端仓库无 affected 选择器；全量 npm test 为权威整体项
final_evidence_mode: PASS_INCREMENTAL   # 默认 e2e 项除外——该项记 PREEXISTING_FAIL(28a9c812 同因)，用户批准带记录合入
development_L3: N/A (none)
真实浏览器展示验收: NOT_RUN（用户豁免）
合入: origin/main fast-forward（普通 push，无 force）
```