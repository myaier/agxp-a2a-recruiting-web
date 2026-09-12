# 可编辑登录区号 STG 基础试点运行摘要

## 结论

批准范围内的登录区号功能、确定性回归、视觉回归和两轮真实 STG 基础试点均为 PASS。第一轮 cleanup 曾被 UI 读取产生的空实名认证聚合阻塞，经用户明确授权后完成一次受控删除并由官方 cleanup 收敛；第二轮直接清理成功。此摘要只保留安全资源 ID 和结论，不含号码、OTP、Cookie、proof 或完整认证状态。

## 版本与环境

- 批准 Spec：revision `ed25e2329ab8ab9d38ffc6001b58baba559f874c`，blob `18300b23ee1faddd80da6c3faacc3f6f18c2a106`
- Plan：revision `bb8dbae6521c45d24ee3e8767913517eb79e4613`，blob `aba9d1de8b83ab48fb844ade6fa8b1c31fd7d4ce`
- final target base：`aac11606a0830704fa592d87dc0cf8ce5cb59524`
- 合并后代码候选：`61749b5b7bcff00d99b8fb661920f188d5f2480b`
- 后端实际部署：tag `ae56ccfdb457`，source revision `ae56ccfdb4578db9a9ce662c4b6b63239c013866`
- 前端：`VITE_DATA_SOURCE=backend`、`VITE_BACKEND_ENV=stg`，`http://localhost:5173`
- agent-browser：`0.35.2`
- 实际视口 / locale / 时区：`390x844 / en-US（应用为中文界面）/ Asia/Shanghai`

## U / B / V 证据

| 门 | 结果 | 证据摘要 |
| --- | --- | --- |
| U | PASS | 六个精确 Vitest 文件 349/349 通过，10.18s；typecheck 通过；mock/STG build 通过，385 modules、432ms，仅有既有 PostCSS warning |
| B | PASS | `--list` 校准为 mock 3、backend 4、默认 config 10；实跑分别 3/3、4/4、10/10 通过 |
| V | PASS | 以 `aac11606` 为基准的 18 个场景全部通过；0 warning/blocked/new/removed/infrastructure；`entry-login-default` 的 `pixelDiffRatio=0` |

异构代码 review 绑定固定候选 `9f8babdf`，Claude 两轮后最终为 `NO FINDINGS`。随后仅有经用户追加授权的旧 E2E 旅程修复 `70ee1a5c` 和目标同步 merge `61749b5b`；按 final gate 合同没有重新进入异构 review，因此不把最终 review 结论扩张到这两个提交。

## STG 两轮

| 轮次 | run ID | prepare / verify | cleanup | 安全基准资源 |
| --- | --- | --- | --- | --- |
| 1 | `front-dial-20260912T133934Z-r1` | READY / PASS | 受控恢复后 CLEANED，occupancy=free | intention `int_5bf4f56a8a68acfede22dba7a2353db8`；job `job_e83e88a869f84ce995e8f3e96ecd95bd`；org request `ovr_cd0076ddd2bedc9f22f7e537a6b33a2d`；org `org_638f0a70c871b032b0f9356dcd20501e` |
| 2 | `front-dial-20260912T205158Z-r2` | READY / PASS | CLEANED，`residuals=[]`，occupancy=free | intention `int_dab9639b3fe57bf1876e74d674d013d1`；job `job_fa524f916f1942b79a69d692f48aaf42`；org request `ovr_b43731553c90214176b3273f3de7114e`；org `org_4153534d3a735eb4cf627a628cdf32bf` |

### 第一轮

- 候选与招聘两套独立 UI 会话均从默认 `+86` 编辑为 `+999`，经 UI 完成 OTP 登录；受限进程内核对登录描述一致，公开记录不保存登录标识。
- 候选普通简历字段修改后刷新保持；新建意向 `int_c8dbdac7a126b4a405048f6ca2c77189`，编辑薪资、刷新、删除、再刷新，基准意向仍在。
- 招聘名片职务修改后刷新保持；新建岗位 `job_c26b480895e84085a0be4c458d5ec731`，完成编辑、归档、重开、删除及逐步刷新，基准岗位仍在。
- 候选退出后，招聘独立会话刷新仍有效且归属正确。观察到预期 profile/education/intention 和 profile/job 请求副作用，无 MatchCase、Hosted 或 IM 业务资源。

第一轮访问候选设置页以执行 UI 登出时，`GET /api/v1/me/identity-verification` 物化了一个空实名认证 aggregate。operator 将该 verification family 判为 unsupported，导致官方 cleanup 在 freeze/revoke 后阻塞。用户明确授权清理后，执行了以下受控恢复：

- 同 run 行加锁并在事务内重复确认状态为 frozen；
- 确认 aggregate/request/evidence/audit 精确计数为 `1/0/0/0`；
- 仅删除这一个空 aggregate；
- 重新执行同 run 官方 cleanup，结果为 `phase=CLEANED/result=CLEANED`，随后 status 为 occupancy=free。

本地 receipt 在重试成功后仍保留早先 blocked residual，未随最终 ledger 状态清空。这是 operator 的历史残留记账缺陷；实际阻塞记录已删除且 admin cleanup 成功，但不能据此声称第一轮 receipt 自身为 `residuals=[]`。

### 第二轮

- 两角色用全新的独立身份完成 UI `+999` 登录，基准资源 ID 与第一轮全部不同，也未看到第一轮新增或修改的数据。
- 候选通过必要的首次资料入口新建 Golang 意向，刷新可见，删除并再次刷新后只剩本轮基准意向；招聘侧只读取未修改的本轮基准名片和组织。
- 避免进入设置页，因此没有再次物化空实名认证 aggregate。两会话关闭后，官方 cleanup 直接返回 CLEANED，receipt 为 `residuals=[]`，status 为 occupancy=free。
- cleanup 后，以清理前保存在受限临时目录中的本轮材料调用正常 STG 认证入口，candidate 与 recruiter 的 login begin 均返回 HTTP 401；临时材料随后删除。

第一轮材料已在其 cleanup 合同内销毁，无法安全恢复后再直接重放。因此“旧登录失效”证据是第二轮对同一 cleanup 合同的双角色等价复验，并结合第一轮 admin cleanup 的清理确认；本摘要不冒称执行了第一轮材料的直接重放。

## 范围判定

- STG 基础试点：PASS，包含上述第一轮受控恢复和证据边界披露。
- 身份轮换、两轮资源不继承、两轮最终占用释放：PASS。
- 附件/PDF、披露、首次 onboarding、发现/委托、规则、Hosted、MatchCase、IM、实名、导出、反馈、公司资料编辑：`NOT_RUN`。
- 原 B01–B05 与 H01–H04 不在本次选择范围内，保持 `NOT_RUN`；不以本试点节点冒充其 PASS。

原始浏览器截图及细粒度过程报告保存在 gitignored 的 `dogfood-output/front-dial-pilot-20260912T133934Z/`，不进入长期版本库。

## 合入

第二次 fetch 确认 `origin/main` 仍为获批 `final_target_base` `aac11606a0830704fa592d87dc0cf8ce5cb59524`，随后以普通 fast-forward 推送 `aac11606..7b631bb1`，未使用 force push。本节是推送后的仅文档时态收尾，不改变已验证的产品代码、fixture 或配置。
