# Backend + Local Onboarding Dogfood 运行摘要（2026-09-01）

> 本文是可提交的脱敏摘要。它不包含测试手机号、验证码、Cookie、request ID、原始材料文件名、本机路径或真实联系方式；临时截图、视频和网络记录不属于仓库工件。

## 基线与范围

- 前端 commit：`034874fb6d938bf4f02e7e40e0707e00d7eec289`
- 分支：`build-start-frontend-backend-local-manual-test`
- 数据源：`backend/local`
- 工具：可见 Chrome、CDP、`agent-browser`
- 覆盖：全新候选人 onboarding、全新招聘方 onboarding、完成后的个人/公司/岗位信息、刷新恢复和服务端权威回读
- 可复跑测试例：[`docs/dogfood/backend-local-onboarding.md`](../dogfood/backend-local-onboarding.md)

两条路径使用不同的新测试账号。候选材料和 JD 均在运行时从仓库外提供；本文只保留其业务基线，不保留个人联系方式或文件坐标。

## 候选人侧结论：FAIL

执行范围：上传候选简历、走社招 onboarding、填写基本信息/教育，并按约束只保留 1 条经历、1 个技能和 1 个证书；随后检查在线简历、求职意向、个人信息和权威接口。

主要结果：

- PDF 上传与预览成功，但异步解析终态为 `failed/parser_invalid_output`，没有形成预填。
- 已填写的薪资/到岗草稿会在流程重入或刷新时丢失。
- 经历、技能和证书保存前发生前端阻断，相应 mutation 没有发出；刷新后服务端仍为 0 条。
- 首次 active intention 没有创建。
- 个人信息页没有复用凭证接口已有的掩码手机号。

完整、可独立转交的归因：

- [`docs/handoffs/2026-09-01-candidate-onboarding-triage.md`](../handoffs/2026-09-01-candidate-onboarding-triage.md)
- [`docs/handoffs/2026-09-01-candidate-onboarding-frontend-handoff.md`](../handoffs/2026-09-01-candidate-onboarding-frontend-handoff.md)
- [`docs/handoffs/2026-09-01-candidate-onboarding-backend-handoff.md`](../handoffs/2026-09-01-candidate-onboarding-backend-handoff.md)

## 招聘方侧结论：FAIL

执行范围：上传/对照 JD、选择招聘方身份、填写招聘名片、手工创建 1 条岗位，并检查招聘方个人信息、公司资料、设置、岗位信息和权威接口。

主要结果：

- 新 recruiter profile 的正常 404 被前端当成致命错误，首次角色选择停在身份页；重登录又仅凭 `last_used_role` 跳过 onboarding。
- 招聘名片首次保存发生本地阻断，没有 profile mutation。
- 发布岗位没有 JD 导入入口；手填时 UI 未采集公司 display name 和独立 requirements，JobCreate 被 422 拒绝。
- remote 岗位仍要求虚构实体办公地址。
- 无企业关系时公司资料永久 loading，设置页却固定显示“企业实名认证 已认证”。
- 招聘方账号的数据导出仍使用候选人“简历”文案，页面 viewport 禁止缩放。

完整、可独立转交的归因：

- [`docs/handoffs/2026-09-01-employer-onboarding-triage.md`](../handoffs/2026-09-01-employer-onboarding-triage.md)
- [`docs/handoffs/2026-09-01-employer-onboarding-frontend-handoff.md`](../handoffs/2026-09-01-employer-onboarding-frontend-handoff.md)
- [`docs/handoffs/2026-09-01-employer-onboarding-backend-handoff.md`](../handoffs/2026-09-01-employer-onboarding-backend-handoff.md)

## 运行方法沉淀

本轮确认有效、已写入复跑测试例的方法：

1. 为每个角色启动独立、可见、CDP-enabled Chrome profile，让用户可观察且账号状态互不污染。
2. 每次页面变化后重新 snapshot，绝不复用 stale `@eN`。
3. 正常步骤不固定 sleep；同一命令连续动作或录制复现视频时约间隔 1 秒。
4. 只通过正常 UI 产生业务 mutation；结束后用同 session 的只读 GET 汇总服务端权威状态。
5. 问题一经确认立即记录；静态问题截图，交互问题复验后再录视频/HAR。
6. dogfood 阶段只按用户视角观察，不读源码；前后端归因在走查完成后单独进行。
7. 临时证据全部进入 `dogfood-output/`，长期文档只保留脱敏、自包含的事实和结论。

## 后续复验入口

修复合并后，在新的全新账号上重跑 `CAND-ONB-001` 和 `EMP-ONB-001`。不得复用本次已污染/部分建档账号判断 onboarding 首次路径。复验摘要另建新日期文档，链接本摘要和精确修复 commit，不回写本次 FAIL 为 PASS。
