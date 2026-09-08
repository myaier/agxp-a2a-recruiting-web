# 2026-09-08 真实后端验收迁移到 Agent Dogfood — 运行摘要

**性质**：脱敏运行摘要（长期保存层）。原始截图/receipt 留本地 `dogfood-output/20260908-migration-drill/`（已 gitignore）。

## 范围与结论

- 迁移交付：四个旧 `test:agent-browser:*` 入口及 `e2e/真实后端/` 整栈实现退役，两份合成 PDF 迁至 `docs/dogfood/resources/`，新增真实后端行为验收指南与报告模板，清理 tsconfig/README/旧指南/CLAUDE 路由。
- **迁移产物检查：通过**。候选 commit `4f7c5ef`；V1 静态核对（四键精确删除、PDF 字节一致 R100、无活动悬空引用、受保护路径零改动）、V2 `npm run build`、V3 定向 Vitest（3 文件 11 用例）、V4a/b/c 用例发现（10/100/18，与规划基线一致）全部 PASS。
- **dogfood 真实演练：部分完成，B02/H01×2/H04 记 BLOCKED**。真实登录前置链路已实证（fixture 账号 + mock-sms OTP 全链路 + 截图）；baseline 场景收敛被后端 Hub acceptance 腿在 Linux rootless 宿主上的结构性冲突阻塞，业务节点未能执行。

## 环境与阻塞（非敏感描述）

- 宿主为 Linux（GNU 用户态 + Docker `userns-remap: default` 共享 daemon）。本轮采用独立 rootless Docker daemon 承载后端栈，未影响同机其他容器。
- 过程中发现并（在本任务授权范围内）修正了后端脚本一组宿主可移植性缺陷（`file_mode` 的 GNU/BSD 行为差异、`mktemp` 模板、`set -u` 未绑定变量、一次性容器/健康探针的运行用户），修改保留在后端工作区**未提交**，明细见实施记录与本轮本地报告第 9 节。
- 剩余阻塞：Hub acceptance 契约要求 Core 以宿主 uid 运行并 bind 挂载 mode-0600 密钥文件；userns 映射下该文件在容器内属主为 0，「宿主可读」与「容器内 uid 可读」不可同时满足。候选修复（阶段拷贝副本后挂载等）由后端 owner 裁决后，演练可从 converge 步骤直接续跑。

## 未完成责任与移交

| 项 | 状态 | owner |
| --- | --- | --- |
| B02 / H01 两次 / H04 真实演练节点 | BLOCKED（前置 baseline 收敛不可用） | 后端 owner 裁决 9.3 方案后，由执行者续跑 |
| 清理 | 不涉及（converge 半路 receipt 空壳，无差集对象） | — |
| 后端兼容修改的 review 与合入 | 未提交，待 owner 审阅 | 后端 owner |

## 命令检查结果

- `npm run build` / 定向 Vitest / 三个 Playwright 入口 `--list`：全部 PASS（数字见实施记录）。
- 本轮不把 `--list` 或迁移检查冒称真实业务验收；完整九类验收仍按指南全范围执行。
