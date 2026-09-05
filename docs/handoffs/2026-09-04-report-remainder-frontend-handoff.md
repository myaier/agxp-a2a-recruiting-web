# 前端 Handoff：运行报告未被 completed-modules Handoff 覆盖的剩余项

> 可直接交给另一台机器上的前端 Coding Agent。所有文件路径均相对前端仓库；不需要测试账号、浏览器会话、截图或此前 Handoff。

> **状态复核（2026-09-05 05:37 +08:00）：仍未完成。** 前端 `origin/main` 已前进到 `280f83ef`，但 `src/屏幕/用户协议.tsx` 的 blob 与 `26d80923` 完全相同，新增提交中也没有该文件变更；招聘方协议正文隔离仍是有效待办。

## 范围与边界

本文件只包含运行报告中未由 `2026-09-04-pure-frontend-completed-modules-bugbash-handoff.md` 覆盖的、可由前端单独实现的项。

不新增 API、后端字段、运行时能力或正式法务文案。正式协议文案由 PM/法务提供前，前端只能做到角色隔离与安全占位。

## 工作包 1：招聘方不能看到候选人专属协议正文

### 问题

招聘账号打开通用 `/terms` 时，页面复用候选人协议，出现候选人专属的求职、简历、现雇主及候选权利表述。该页面是共享路由，但正文不能靠“共享页面”推断为同一受众。

### 根因

`src/屏幕/用户协议.tsx` 只有一份静态候选文案，未读取已水合的 active role；`src/应用.tsx` 也没有给共享路由传入角色化正文。当前没有角色中性或招聘方专属的受审正式文案资源。

### 修改要求

1. 以 `后端状态.主体.last_used_role` 为唯一角色来源；不得根据来路、URL 前缀或缓存猜角色。
2. candidate 继续显示现有候选正文。recruiter 不得显示候选专属段落。
3. 在正式招聘方文本尚未交付时，recruiter 显示最小中性占位：明确当前正文待发布，并提供返回；不要复制、改写或臆造法律承诺、时限、许可证、数据处理规则。
4. Mock 可保持原型正文，但 Backend 的 recruiter 分支必须执行上述隔离。

### 必测

- candidate/recruiter 分别打开、刷新、后退 `/terms`，正文不串角色；
- recruiter DOM 不含候选简历、求职、现雇主等候选专属段落；
- candidate 原有正文不回归；Mock 行为不因 Backend 分支受损；
- active role 缺失或未水合时显示中性状态，不回退候选文案。

建议修改：`src/屏幕/用户协议.tsx`、对应组件测试。

## 验收

```bash
npx vitest run src/屏幕/用户协议.test.tsx
npm run typecheck
npm run lint
npm run build
```
