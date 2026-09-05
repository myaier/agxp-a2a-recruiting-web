# Hosted Agent 与 CRUD Browser Fixture 前端接线 · 集成交接

**日期：** 2026-09-05
**前端分支/commit：** `spec/hosted-agent-browser-acceptance-frontend` @ `92ec99a8`
**后端冻结 commit：** `release/0.2.5` @ `c4d99e2db5d8e9ba3b5387fb66ac07d80584b25e`（= `origin/release/0.2.5`，无合同漂移）
**Spec：** `docs/superpowers/specs/2026-09-05-hosted-agent-browser-acceptance-frontend-design.md`

## 集成结论

```text
hosted_agent_integration: BLOCKED_BY_BACKEND_DEFECTS（见缺陷 A/B）
crud_runner_integration: BLOCKED_BY_BACKEND_BASELINE_FIXTURE（按设计精确复现）
```

- CRUD blocker 是**预期行为**：当前四-scene 后端缺 `baseline`，真实命令在浏览器前以
  `exit 75` / `INFRA_BLOCKED` / `BLOCKED(BLOCKED_BY_BACKEND_BASELINE_FIXTURE)` 精确阻塞，
  零 Vite / 零浏览器 / 零 receipt。后端合入 `baseline` 后用同一前端 commit 重跑即可。
- Hosted 五轮**未通过**，阻塞在两处后端缺陷（非前端 runner 问题）；不得据此写 PASS。

## 前端 gate（全部通过）

`npm run test` / `test:agent-browser:unit` / `test:agent-browser:shell` / `typecheck` /
`lint` / `build` —— 全部 exit 0（hermetic：公共步骤、整栈运行器、Hosted wrapper、
四 scene 旅程四套 shell 合同测试 + 报告/视觉 unit）。

提交序列（每个 task RED→GREEN 独立提交）：

```text
76b62584 test(e2e): select acceptance fixture scenes
06f78221 test(e2e): adopt fixture receipt v2 lifecycle
f237fba3 test(e2e): prewire CRUD baseline fixture
95004bbb test(e2e): add hosted agent acceptance suite
403501cd test(e2e): cover hosted agent acceptance scenes
57653f9a test(e2e): keep journey sandbox under gitignored output root
06d22361 fix(e2e): submit an executable rule text in hosted happy scene
92ec99a8 fix(e2e): reload before reading active rule count after accept
```

## 后端缺陷 A：Hub acceptance state volume 属主写死 10001（已用 runtime 手段绕过）

- 位置：`apps/hub/scripts/dev-mt-local.sh` `ensure_acceptance_state_volume`（`chown 10001:10001`）。
- 冲突：本机 Hub 形态由 `deploy-mt-local.sh` 写 `HUB_UID=501`（部署者 uid），Core 容器以
  501:20 运行 → 无法打开 0700/10001 的 state 目录 → `mountBrowserAcceptance` 的
  `acceptance.Open` 失败后**静默不挂载 route**（fail closed，`browser_acceptance_enabled.go`）
  → `browser-fixture.sh converge` 报 `acceptance_unavailable`（exit 75）。
- 临时处置（本机）：`docker run --rm --user 0:0 -v agxp-hub-dev-browser-acceptance:/target
  alpine:3.20 sh -c 'chown 501:20 /target'` 后重启 core 容器，route 恢复。
- 修复建议：`ensure_acceptance_state_volume` 按 compose 实际 `HUB_UID` chown，或在
  acceptance overlay 中显式将 core 的 user 固定为镜像内 hubcore uid。

## 后端缺陷 B：规则 ID `arr_` 前缀违反冻结 OpenAPI 合同（阻塞 happy/p6，无法在前端修复）

- 合同：`apps/recruitment-bff/openapi/mobile-v1.yaml:16332` 规定
  `rule_id` `pattern: '^rul_[0-9a-f]{32}$'`；前端 strict decoder 同款（`src/数据/招聘数据源/Agent规则.ts`）。
- 违约：`apps/recruitment/internal/store/agent_control_store.go:838`
  `newAgentControlID("arr")` 生成 `arr_*` 规则 ID，BFF 原样透传。
- 后果：accept 一条 executable 规则提案后（服务端创建 rule），规则库列表响应含 `arr_` ID
  → 前端按合同 fail closed → 规则库页永久「规则加载失败，重试」→ happy（P6 规则段）与
  p6 旅程无法在页面上完成。
- 复现：accept 后 `fetch("/api/v1/me/agent-rules")` 返回 `rule_id: "arr_8fb5cde9…"`；
  页内 `读取Agent规则("candidate")` 拒绝并提示「服务返回了不符合契约的 Agent 规则数据」。
- 前端处置：**不放宽 decoder**（本 Spec 冻结「不修改 strict decoder」，且合同站在前端侧）。
  proposal ID `arp_` 与合同一致，仅 rule ID 违约。

## 期间发现并已修复的前端 runner 问题

1. happy 规则文本须为 executable 语义：advisory（偏好排序）ready 提案按公开合同只能
   放弃（`accept` → 409 `agent_rule_proposal_not_actionable`）。`06d22361` 改用与输入框
   placeholder 例文同款的硬约束文本。
2. accept 后页面 active rule 计数不自动刷新：`92ec99a8` 调整为 accept → 硬刷新（权威重读）
   → 读计数，与 Spec §9.1 第 3 步一致。

## 真实运行记录

| 运行 | 结果 |
| --- | --- |
| CRUD probe（`test:agent-browser:backend-local`，run `20260905T092301Z-2c7c7f`） | exit 75，`BLOCKED_BY_BACKEND_BASELINE_FIXTURE`，五条 journey blocked，零副作用 —— **Step 3 达成** |
| Hosted suite 第一轮（run `20260905T092333Z-65dae2`） | converge 因缺陷 A `acceptance_unavailable`；修复 A 后同 RUN_ID 恢复 converge PASS；旅程因缺陷 B 卡在规则段（先后表现为 advisory 409 与计数超时） |
| 恢复旅程目录 | `agent-browser-backend-output/recovery-20260905T092333Z/`（journey.log×3、失败快照、journal） |

## 残留状态（后端修复 B 之前无法收口）

- 孤儿 receipt ×2 占用 acceptance lease（Hub lease 无 TTL、无强制释放，新 run converge
  一律 `fixture_state_invalid`）：
  - `apps/recruitment/.local-dev/browser-fixtures/20260905T092333Z-65dae2.json`（happy，
    phase=prepared；图为 1 dismissed proposal + 1 archived rule，均为允许的终态历史）；
  - `apps/recruitment/.local-dev/browser-fixtures/probe-093328.json`（acquiring）。
- 解锁路径：后端修复缺陷 B → 用原 receipt（同 RUN_ID `20260905T092333Z-65dae2`）跑完整
  happy 浏览器旅程 → `cleanup --ledger` 退休（happy 终态断言
  `proposal accepted + rule active + Case completed` 只有完整旅程能满足）→ lease 释放 →
  用同一前端 commit 重跑 `npm run test:agent-browser:hosted-agent` 五轮。
- 本机验收栈保留运行（Server :8080 + Hub `agxp-hub-mt-dev` acceptance + Recruitment
  `agxp-recruitment-dev` acceptance，均未 down、未删 volume）；Vite 已停。
- `probe-093328` 是诊断期创建的试探 run，可与主 receipt 一并在解锁后清理（acquiring
  receipt 的 cleanup 恒 `recovery_required`，需后端确认处置口径）。

## 验收环境备注

- 后端 checkout 已按用户批准 fast-forward 到冻结 SHA `c4d99e2d`（merge --ff-only，源码
  clean，`.local-dev` 未动）。
- 完整 acceptance 环境链：`apps/server/scripts/dev-local.sh up --recruitment`（:8080）→
  `apps/hub/scripts/dev-mt-local.sh up --recruitment --acceptance` →
  `apps/recruitment/scripts/dev-local.sh prepare/up --acceptance` → `bootstrap`。前端
  runner 只编排 Recruitment 侧；Server/Hub 侧由环境 owner 先行就绪（前端 Spec §5 的
  「已存在且 health --acceptance 通过：复用」前提）。
