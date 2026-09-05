# 后端 Handoff：运行报告未被 completed-modules Handoff 覆盖的剩余项

> 可直接交给另一台机器上的后端 Coding Agent。本文不依赖前端仓库路径、测试账号或本地运行目录。

> **状态复核（2026-09-05 05:37 +08:00）：三个工作包仍未完成。** 后端 `origin/release/0.2.5` 仍为 `21e34ff04`；在 `apps/recruitment` 与 `apps/recruitment-bff` 中仍没有 candidate contact-profile 或 onboarding-state 路由/领域。`runtime_export_composition_test.go` 仍明确要求 Conversation 与 AccountLifecycle 同时装配才挂载 export pass，而 local compose 仍刻意不装配 Conversation。因此本文没有可关闭或失效的工作包；当天新增的 hosted-agent browser acceptance 分支不覆盖这些产品合同。

## 工作包 1：候选披露联系方式合同

候选个人信息页可安全展示登录凭证手机号，但候选向招聘方披露的手机号、微信号与邮箱没有独立读写合同。前端目前正确显示“未接入”，不能把登录凭证或浏览器本地值冒充披露联系方式。

新增 owner-scoped candidate contact-profile resource：三种联系方式均可为空，读写语义、授权/披露边界、审计与删除策略必须明确；不得复用 phone OTP credential。提供 OpenAPI、BFF DTO/decoder、handler/service/store、CAS 或等价并发控制和合同测试。写入/读取必须只对当前 candidate 主体有效，recruiter 不得通过该资源读取未披露的原始值。

## 工作包 2：本地数据导出依赖完整装配

`POST /api/v1/me/data-exports` 在本地栈返回 503，因为 Conversation 与 AccountLifecycle 两组导出依赖未装配。前端的错误显示与重试已验证正常，故不要以改前端掩盖问题。

使 local dev composition 注入生产同语义的导出依赖或显式的本地实现；导出任务应按既有合同创建、轮询、下载、失效和清理。补本地集成测试：请求导出不返回依赖缺失 503，任务可进入允许的后续状态；缺依赖仍应在启动/健康检查中明确暴露，而非请求时静默失败。

## 工作包 3：可刷新判定的候选 onboarding 状态

已完成候选仍可深链进入可写 onboarding 页面。前端当前无法安全判断这是合法中断恢复还是已经完成后误入旧链接：主体合同只有 role 与 last-used-role，没有按角色的 onboarding completion/recovery state。

为 candidate 提供权威、可刷新、owner-safe 的 onboarding state，至少能区分 `not_started`、`in_progress` 与 `completed`，并明确恢复令牌/轮次的有效条件。补 OpenAPI、BFF、handler 与状态转换测试。不要让前端以简历字段齐全、意向数量或 sessionStorage 推断完成状态。

## 验收

- 合同测试覆盖空联系方式、写入、清空、跨主体拒绝和 recruiter 越权拒绝；
- local export 从创建到终态无依赖装配 503；
- candidate onboarding state 在刷新、重新登录与角色切换后保持正确，完成态与中断恢复态不混淆。
