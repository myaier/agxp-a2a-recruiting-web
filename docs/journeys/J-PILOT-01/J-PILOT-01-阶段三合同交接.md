# J-PILOT-01 阶段三合同交接

2026-09-10 · 合同候选0.1.0。产品v1.0已确认；本轮OpenAPI/Arazzo已完成双端静态核对，待用户审阅，未开始阶段四实现。

产品权威仍为[J-PILOT-01产品旅程与状态规则](J-PILOT-01-产品旅程与状态规则.md)。接口与工作流候选位于后端repo分支`contracts/j-pilot-01`，路径`docs/contracts/J-PILOT-01/`；本机工作区为`/Users/visionclaw/.paseo/worktrees/j-pilot-01-contracts`。

- [合同说明与实施差异](/Users/visionclaw/.paseo/worktrees/j-pilot-01-contracts/docs/contracts/J-PILOT-01/README.md)
- [Arazzo工作流](/Users/visionclaw/.paseo/worktrees/j-pilot-01-contracts/docs/contracts/J-PILOT-01/arazzo.yaml)
- [版本与内容锁定](/Users/visionclaw/.paseo/worktrees/j-pilot-01-contracts/docs/contracts/J-PILOT-01/contract-lock.yaml)
- [静态验证证据](/Users/visionclaw/.paseo/worktrees/j-pilot-01-contracts/docs/contracts/J-PILOT-01/validation.md)

## 本次对齐结果

| 项目 | 合同处理 | 当前支持 |
| --- | --- | --- |
| S0无人工输入、信息不足自动结束 | 复用semantic_uncertain_stop为终局，保留原结果且不递交 | 后端待实现；不能只隐藏前端输入框 |
| 全局待办优先 | NegotiationCard/Detail新增needs_action，分页前计算；v2游标 | 后端待实现；前端连续列表待接 |
| S0聊天及PDF展示 | 既有role/id/summary；系统状态不冒充对方；附件两端仅归S1 | 已有主要能力，投影/展示尚需对齐 |
| 未知提交恢复 | 限定原命令标识按主体保留，同key同body重放；无法确认人工排查 | 前端硬刷新接线缺失，不新增后端服务 |
| S1附件等待 | 复用submitResume检查原绑定就绪，可实际执行披露 | 已有接口，不能视为只读刷新 |

Arazzo含13个API片段、18步骤，均属于本条旅程；没有新增其它完整旅程。`provide-fact`按批准产品停用，不误接S2。后端worker/Agent负责业务推进，浏览器负责观察与已授权用户动作；单次HTTP成功不代表旅程通过。

本轮核对FE origin/main=`d9b6d170b82921479d8e0e9f8ada7cd17f7728f8`，BE origin/release/0.2.5=`1ae0b7a46f060e27c7f6db38e0469d15c626e2c5`。已批准产品文档保留其当时观察；当前消费差异以本轮后端合同包中的frontend-evidence.md为准。contract-lock.yaml记录产品文档的准确提交及内容SHA-256/Git blob；候选合同以文件哈希锁定，所属提交从后端Git历史查询，避免在文件内自引用自身commit。

## 验证与限制

官方Arazzo schema、operation/参数/29处响应路径、候选schema正反例、文档链接检查通过；双端静态审阅发现的“强制单意向过滤”已修正为全意向首/续页。现有OpenAPI全量标准校验仍有BFF19、内部9项基线错误，候选无新增；具体限制在后端validation.md及机器结果，不宣称整份全绿。

未调用真实API、模型、容器或浏览器；未改业务代码、未部署/合入。当前后端通过的L3不能证明新目标已实现或本旅程已真实验收。

下一步：用户审阅合同候选；阶段四另行授权后，Agent据后端README C1–C4及锁定版本准备实施范围与测试责任。需覆盖历史S0等待收敛、严格DTO/decoder、跨页排序、未知提交不重复、角色隐私及准确PDF；不扩展S2实现或已延后的能力。
