# 候选设置页 Backend 实名真实性 Plan Handoff

handoff_version: 5

## Verdict

- 实现：**READY**
- 唯一 plan-scope authoritative verdict：**PASS** —— `npm test` exit 0（152 个测试文件 / 2855 个测试全部通过）。
- 验收模式：`VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local`（单元测试为必需验收，未以浏览器手测代替；`npm run test:e2e:data-source` 属可选 L2 补充，fixture 条件未确认，本批未运行、不冒充证据）。

## Baselines

- Spec：`docs/superpowers/specs/2026-09-03-backend-data-truth-source-design.md`（§D 候选设置页不伪称实名）。
- Plan：`docs/superpowers/plans/2026-09-03-candidate-verification-truthfulness.md`。
- 实施基线：`a3e13d3f`（= 实施时 `origin/main` tip，含前序 workplace roundtrip Plan 全部产出）。实施前 fetch 最新 `origin/main` 后 HEAD 与之完全一致，两个目标文件（`设置.tsx`、`设置.test.tsx`）与 `origin/main` 逐文件 diff 为空，零漂移、零 merge。

## Task Commits

| Task | Commit | 内容 |
| --- | --- | --- |
| 1 | `e63003ff` | `设置.tsx` 实名行按 `是后端` 分叉：Backend 渲染非交互 `div.行`（标题 `实名认证`、值 `—`、无 button、无尖括号、无 onClick）；Mock 原样保留演示按钮、`已认证` 与 `实名认证 · 已通过，无需重复认证` 提示。`提示` state/timer 保留（Mock 演示回执仍用）。测试新增 `设置 · 实名状态真相源` describe 三条：Backend phone_otp 不伪称已实名且点击无回执、P8 凭证读取不回归；Mock 演示按钮与提示保留且零 credentials 读取；Backend「账号与安全」入口仍 `跳转(路径.账号安全)` |

## TDD Evidence（每 Task 严格 RED → GREEN）

| Task | RED | GREEN |
| --- | --- | --- |
| 1 | `npx vitest run src/屏幕/设置.test.tsx` → 1 failed / 12 passed（新 Backend 用例：`实名认证` 仍是 button、显示 `已认证`） | `npx vitest run src/屏幕/设置.test.tsx src/屏幕/账号安全.test.tsx` → 44 passed |

## Review Rounds（Codex 多轮，宿主为 Claude Code）

- R1（`codex exec review --base a3e13d3f`，gpt-5.6-sol / high）：**无 findings** —— 报告确认变更符合 spec/plan、Mock 行为与 P8 凭证读取保持不变。第 1 轮即 clean，循环终止（无 r2）。

## Authoritative 与 Inner-loop Evidence

- Authoritative（唯一 plan-scope gate）：`npm test` → exit 0，152 文件 / 2855 测试通过（含既有 P8 credentials、账号安全页面、退出确认可访问名称、Mock 设置页全部回归）。
- Inner-loop：`设置.test.tsx` + `账号安全.test.tsx` → 44 passed；`npm run typecheck`、`npm run lint`、`npm run build` 均 exit 0。

## 与 Plan 草图的现场校准（不改变合同，均为最小实现）

1. **既有 P8 用例「凭证未成功时手机号显示中性占位」的 `getByText('—')` 改为 `getAllByText('—').length >= 1`**：本修复使 Backend 实名行也显示 `—`，同屏出现第二个 `—` 触发 TestingLibrary 单元素断言冲突。该用例的真实意图是「中性占位在场、绝不回退硬编码手机号」，AllBy 断言保持该意图不变（与新测试同口径），非放宽。
2. Plan 要求的「账号与安全 Backend 断言」按其指示补为 `设置 · 实名状态真相源` describe 内第三条独立用例，而非塞进前两条——避免点击语义互相污染。

## dependency_drift

- 实施前 fetch 最新 `origin/main`：与本地基线完全一致（`a3e13d3f`），无 merge、无冲突。
- **与同批 MatchCase「我的」统计、contact-events、workplace roundtrip 三条分支：无冲突。** 本 Plan 只改 `设置.tsx` / `设置.test.tsx` 两个文件，全部改动收敛在账号组的实名行一处条件分支及测试；未触碰 P5、contact-events、岗位办公方式或 credentials operation 任何代码。
- 本地 `main` ref 停在旧基线 `86125819`（非本批引入）；review base 因此使用冻结 SHA `a3e13d3f` 而非 `main` 符号。

## Residual（记录非缺陷）

- Backend 实名行显示中性 `—` 是「无实名合同」下的诚实下界；PM 后续确定实名能力或最终文案前不做任何推导（`phone_otp` 只证明登录凭据，简历姓名不参与）。
- Mock 分支继续显示演示 `已认证` 与点击提示（Spec §D：等待 PM 后续决定，本批刻意不改）。
- 账号与安全页、credentials 水合/错误处理及其测试零改动（Plan 不变量，已被既有测试与本批回归共同覆盖）。

## Plan-scope testing boundary

- Task/inner-loop：`设置.test.tsx`、`账号安全.test.tsx`、`typecheck`、`lint`、`build`。
- Authoritative plan-scope gate：唯一 `npm test`。
- L3/shared environment：`integration_requirement: none`；`selection_ssot: none`；`selection_gap: none`；`l3_selection: []`。本 Plan 的目标是删除无合同断言，不需要共享环境。
- Release handoff：`required: false`、`owner: none`、`required_mode: none`、`nightly_only_mode: none`、`status: none`。