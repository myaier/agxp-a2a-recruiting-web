# S0 匿名初筛记录前端接入实施 Handoff

日期：2026-09-09

## 版本

- Implementation base commit: `fc951191e7e05c7a5ec1d5b54e2f6a4d913f720c`（execution prompt 字面量）
- Final target base commit: `1b6543468a0b08b7d16b7b3da117b597a7da24b4`（获批后 fetch 实测，与规划观察一致；merge 为 no-op）
- Frontend source commit: `7eb43ceaa5b7f591d582c1d147ef01732faffa19`（含 handoff 提交前；实现切片 88a5948e → 5265c9c0 → a7441a76 → 42aaed35 → 1c77c7a3 → 7eb43cea）
- BFF runtime commit: 未观察（本次未运行真实 dogfood，见下）
- Recruitment runtime commit: 未观察（同上）；合同权威为 agxp-monorepo@origin/release/0.2.5 `462367b6571d1bbfc4bb29621a4ea1c741dba762`，实施前已逐字段核对 `apps/recruitment-bff/internal/recruitmentclient/testdata/s0_screening_records.json`
- Approved Spec: commit `307fbe003d1bcfc5ca5215b6d6ce2e6a4f6439bd` / blob `9f2ed2dde17860cff269f33ed3ebdc9b140082fc`
- Implementation Plan: commit `fc951191e7e05c7a5ec1d5b54e2f6a4d913f720c` / blob `799608a1ad0da7ccff286e49d0cb27509fde2dac`

## 实施范围

- 请求与严格 decoder：`读取P5详情` 唯一入口固定 `?include=screening_records`（生产代码恰出现一次，`src/数据/招聘数据源/MatchCase.ts`），case ID 继续 URL 编码、GET 保持 `不缓存: true`、无 fallback 重试。S0 展开块按判别联合 exact-keys 解码（question／answered／unanswered answer、initial／reevaluation），`occurred_at` 独立 Z-only 校验（含字段域与 Gregorian 日历有效性，拒绝 `24:00:00Z`、`02-30`、非闰年 `02-29`），跨记录语义（ID 全局唯一、round ∈ 1..state.round_budget、同轮每类唯一、answer 必命中同轮 question、业务顺序、原序返回、initial 唯一且先于复评）；S0 缺块／null、S1–S3 带块、招聘非空 summaries 全部契约错误。归一化 DTO 为 Plan 冻结判别联合（`P5S0筛选消息`／`P5S0筛选总结`），`P5阶段区.screeningRecords: P5S0筛选记录 | null`。
- 权威快照与轮询：records 随现有整包替换详情快照运输（不因 state 相同跳过更新、单飞／会话代际栅栏／迟到保护不变）；详情 404 在三条路径（普通读取、mutation 成功后权威重读、mutation 结果不确定后的对账读取）都清空整份旧 detail 并保留可重试错误，其余同 scope 失败保留只读旧详情，跨主体不保留。`MatchCase操作.ts` 净增 404 守卫相关改动，无新 store。
- 双端展示与隐私：mapper 独立投影 `Agent消息`／`Agent总结`（`P5S0消息视图`／`P5S0总结视图`，未回答文案 declined→已拒绝回答、unknown→暂无法确认、not_available→暂无可用信息；标签 初评／第 N 轮复评；结果语义仅 S0 终局 policy_rejected／semantic_not_fit→不匹配，user_ended／party_account_deleted→已结束）；页面在既有 `阶段对话流` 气泡与小结托盘呈现，稳定 record ID 为 key（`s0:${id}` 前缀），新消息本地时区 `HH:mm`（`Intl.DateTimeFormat` zh-CN h23 + formatToParts，不读 `Date.now()`），旧 transcript／instruction receipt 保持字符串切片；不显示 kind／role／round／ID／技术标题；招聘端总结区域自然不渲染；`respond_fact` 仍只走 transcript ref，screening record ID 永不作 mutation 坐标。
- 明确未做：跨 API 固定检查项、S1–S3 过程记录、CSS／Mock 数据／文案／状态机改动、第二请求、include fallback、viewer／wire-version 参数、通用 outcome 翻译器、新聊天组件、feature flag。

## 自动化验证

| 命令 | 结果 | 耗时 | source commit |
| --- | --- | --- | --- |
| `npm test`（全量） | PASS：168 文件 / 3583 用例 | 20.98s | 7eb43cea |
| `npm run typecheck` | PASS（tsc -b --noEmit 无错误） | ~4s | 7eb43cea |
| `npm run lint` | PASS（oxlint 无告警） | <1s | 7eb43cea |
| `npm run build` | PASS（vite 构建成功） | 620ms | 7eb43cea |
| 定向（Task 4 Step 2：五文件合并） | PASS 334/334 | 2.74s | 1c77c7a3 |
| 定向（review-r1 修复后：操作+数据源） | PASS 127/127 | ~4s | 7eb43cea |
| 定向（组件+详情，TZ=UTC 与 TZ=Asia/Shanghai） | PASS 76/76 双时区 | ~6s×2 | 1c77c7a3 |

注：全量 `npm test` 输出含 Node 环境级 `ExperimentalWarning: localStorage is not available`（Node 运行时提示，非本变更引入的测试噪音）。

过程内评审：每 Task 一次 Claude 子代理任务评审（Task 1 两轮 fix 收敛；Task 2／3 一次通过，Minor 延后记录）；异构代码 review 走 codex-review-loop（gpt-5.6-sol/high，read-only，base 冻结 `fc951191`）：R1 两条 required（对账 404 未清旧详情、S0 时间接受非 RFC3339）均核实成立并修复（`7eb43cea`，TDD），R2 精确 `NO FINDINGS`，两轮 post-round guard 均 PASS。

## 真实双端 dogfood

- Run ID 与本地报告相对路径: 无——未运行。
- Candidate / recruiter 结论: 未运行（非 PASS／FAIL／BLOCKED）。
- 原因：用户在 final gate 批准时明确指示「不用跑 dogfood，我会在单独的环境测试」，本次按用户指示跳过。
- Before vs after: 不适用（无现场观察）。
- Fixture 与真实模型证据边界: 本次交付的全部证据为自动化测试（其合同正例与后端 release fixture 逐字段同源：`src/测试/S0筛选记录样本.ts` 记录来源路径与后端 SHA）；无任何真实浏览器／真实模型证据，不得被引用为 E2E 通过。
- 清理状态: 不涉及（未启动验收栈）。

## 未完成责任

- 真实双端 agent-browser dogfood（Spec §10 八项场景）：未运行，责任移交用户在独立环境执行。恢复入口：`docs/dogfood/真实后端行为验收.md`；验收前需记录前端／BFF／Recruitment 实际运行 SHA 并确认两层后端已部署 `s0-screening-records.v1` 展开合同。在用户环境验收通过前，不得宣称完整 E2E 完成。
