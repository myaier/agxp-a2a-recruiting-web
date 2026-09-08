# Agent-Browser 真实后端验收（入口说明）

> **2026-09-08 退役说明：** 本文档描述的固定脚本验收体系已退役。npm 入口
> `test:agent-browser:backend-local`、`test:agent-browser:hosted-agent`、
> `test:agent-browser:unit`、`test:agent-browser:shell` 及 `e2e/真实后端/` 下的
> 运行器、旅程、Shell 合同测试、报告/比较器和视觉基线均已删除，下列旧命令不再可执行。
> 旧文档中的退出码合同、`--update-baseline` PNG 安装流程和「每次 fixture 算子调用
> 换新 ID」的规则一并作废；现行 receipt v2 生命周期（一轮 converge → verify →
> cleanup 共用一个 `BROWSER_FIXTURE_RUN_ID`）以新指南为准。

真实后端业务验收现在由 Agent 使用 `agent-browser` 按文档执行，从这里进入：

- **执行指南**：[dogfood/真实后端行为验收.md](dogfood/真实后端行为验收.md) ——
  环境启动（`dev-local.sh` 的 `health/prepare/up --acceptance`）、fixture 数据与
  receipt 生命周期、九类行为场景卡、证据与清理合同。
- **报告模板**：[dogfood/真实后端报告模板.md](dogfood/真实后端报告模板.md)。
- **全新账号注册走查**：[dogfood/backend-local-onboarding.md](dogfood/backend-local-onboarding.md)。

历史运行产物目录 `agent-browser-backend-output/` 仍被 gitignore，保留历史记录，
不再产生新产物；新一轮 dogfood 证据写在 `dogfood-output/<run-id>/`。
