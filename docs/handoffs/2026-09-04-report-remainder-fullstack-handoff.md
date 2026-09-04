# 前后端配合 Handoff：运行报告未被 completed-modules Handoff 覆盖的剩余项

> 可直接交给前后端协作的 Coding Agent。本文仅定义跨层接口与接线，不依赖任何本机路径、账号或截图。

## 目标

在候选披露联系方式与 onboarding 状态合同上线后，前端把当前诚实的“未接入”占位和无边界深链替换为权威交互；在合同未上线前不得提交本地假成功。

## 工作包 1：候选披露联系方式接线

后端交付独立 contact-profile 合同后，前端在 `src/屏幕/个人信息.tsx` 读取并编辑披露手机号、微信号和邮箱。账号手机号仍只来自 OTP credential，不能与披露手机号混用。

前端要求：加载、空值、读取失败和保存失败均有可见状态；保存成功后以服务端回包回写；换主体/登出/迟到响应不得污染新会话；Backend 不读取 Mock 联系方式切片。后端要求：owner-safe DTO、权限和并发语义见对应后端 Handoff。

验收：candidate 写入并刷新后回显；清空语义正确；recruiter 无法读取原始值；失败不显示本地成功；Mock 原型不回归。

## 工作包 2：onboarding 深链边界

后端交付 candidate onboarding state 后，`src/应用.tsx` 建立集中式候选 onboarding route guard：`in_progress` 允许恢复，`not_started` 允许开始，`completed` replace 到候选主壳。不得让每个 onboarding 屏自行判断，也不得从简历字段、意向数量或 sessionStorage 推断。

验收：三种状态分别深链、刷新、后退、重新登录；completed 不挂载可写 onboarding 屏；in_progress 不被误拦；主体/角色切换后的迟到状态不回写旧路由。

## 联合发布顺序

1. 后端先发布 OpenAPI、BFF、权限和合同测试；
2. 前端 strict decoder 先接受新合同，但在未成功水合时保持中性/不可写；
3. 合同可用后启用写入与路由 guard；
4. 用真实 Backend 端到端回归，再移除“未接入”与无 guard 的过渡路径。
