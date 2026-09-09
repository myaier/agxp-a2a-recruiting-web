# 招聘端列表字段补齐：规划交付与文档审查记录

2026-09-09。用户已批准招聘推荐与在谈列表 Spec，并要求零上下文 Plan、Claude review 与执行提示词。本交付只修改文档，没有实施产品代码、运行产品测试、部署或 push。

## 冻结交付

- Spec：`docs/superpowers/specs/2026-09-09-recruiter-list-summary-frontend-design.md`；批准 revision `5aeb82861d11143c97df5df218f491bc73f3d1d7`，blob `f381411ac0a43b7e6864758da77846284a013733`，审查全程未改。
- 最终 Plan：`docs/superpowers/plans/2026-09-09-recruiter-list-summary-frontend.md`；revision `17a1ded2c8d6809faa8e9a9f388dfd6d14fe8ee9`，blob `41be4807368325c403a2cecd665d01149d06f352`。
- 一个独立交付，3 个顺序 Task：共用摘要契约、推荐闭环、在谈闭环；同一执行者完成，不拆独立实施工作区。
- 计划本身复杂度：中；零上下文漂移风险：中；模型档位：当前可用的行业 Top 5–10 中高性价比模型。
- 宿主：`/Users/visionclaw/.paseo/worktrees/09eyc7i7/resolute-flamingo`；target `origin/main`，最终同步须经实施 final gate 明确确认。

## Review 合同与证据

模式 `WORKFLOW_DOCUMENT_REVIEW`，`scope_approved_by_parent_workflow: true`。scope 仅上列 Spec 和 Plan；不审整个 branch，不运行测试。遵守 `/Users/visionclaw/coding-harness/skills/_shared/review-contract.md`。

Reviewer：Claude CLI `2.1.263`，每轮 `--model opus --effort high --permission-mode plan --agent reviewer`；第 2 轮 resume 同一 session `91ccdc15-bc78-4503-96ac-37ba3c6c8b56`。

本机原始产物 `/tmp/claude-review-loop/session-613hts9b/`：r1/r2 的 prompt、JSON、stderr、可读报告和每轮 baseline/after 状态、HEAD、文档指纹。两个进程均 exit 0、is_error=false；两轮 guard 全部 PASS，未出现审查期间的工作树或文档变化。

| 轮次 | Plan 候选 | 结论与裁决 |
| --- | --- | --- |
| 1 | revision `14adaa6243a978142ebab09b931d662df12a62c0`；blob `99efe316308482028f929d3595204bac0461f594` | 2 Important/required、3 Minor/optional；逐条裁决如下 |
| 2 | revision `97dee40900f78ef203f47de2fc9559d708890be5`；blob `53816e233a38dd092272050dae568e3f84f34881` | 确认 2 required 已解决；新增 1 Minor/optional 文案澄清 |

### Round 1 逐条裁决

1. **收藏入口测试遗漏**（必要性：required；复杂度影响：不变）：接受。核实 `src/组件/候选筛选抽屉.test.tsx` 的 backend 收藏筛选确实消费推荐集合，Plan 原命令未覆盖。补入 Task 2 文件与命令，并要求展开样本、摘要仍正确以及切开关零新增请求断言。
2. **内部 guard 措辞误读风险**（review 标必要性：required；复杂度影响：降低）：接受最小澄清。原句指 Plan 不复制内部实现，并非禁止局部 guard 重复，review 的「只能抽取公共 guard」前提不成立；但明确 domain-local guard、禁止上提旧私有 guard 和新建公共 guard 模块可以消除误读。第 2 轮 reviewer 接受此裁决。
3. **中性文案作用位置**（必要性：optional；复杂度影响：不变）：接受。只占头行，其他已披露工作/教育/亮点独立呈现，遵守批准 Spec 每行独立空值语义。
4. **样本文件分散**（必要性：optional；复杂度影响：降低）：接受。摘要样本作为既有 `BFF样本.ts` 的新导出，默认样本语义不变，不另建样本文件。
5. **final reference 路径**（必要性：optional；复杂度影响：不变）：部分接受，补 reference 与 operative contract 绝对路径。拒绝「仓库不采用 development-workflow」「现行 reference 引入 manifest」两项错误前提；用户明确授权该 workflow，当前合同明确不创建新 manifest。第 2 轮 reviewer 撤回错误前提并确认路径有效。

以上 Plan 修复提交 `97dee409`；另自行补清 target race 必须更新具体方案并重新确认，遵守父 workflow，不改变产品契约。

### Round 2 裁决与结束

新增 optional：「摘要主体仅剩文案」可能被误读为隐藏推荐匹配环。接受并在 `17a1ded2` 精确改为「摘要信息区域」，明确推荐匹配环和收藏/淘汰/委托操作状态不受影响。该句只是重复批准 Spec §4 和 Task 2 已有不变式，planner 核对最终 diff 后通过，无产品契约变化。

结束依据是共用 review 合同 §5 的「接收者核实后无未解决的有效 required finding」，不是声称 reviewer 输出 NO FINDINGS。两轮结束，没有未解决 required；optional 均已作最小澄清/简化，不为追求零建议再跑第三轮。最后一句 optional 修订由 planner 自检，未再送第三轮 Claude。

## 执行提示词与校验

- Claude：`docs/superpowers/prompts/2026-09-09-recruiter-list-summary-frontend-claude.md`，实施后使用 Codex reviewer。
- Codex：`docs/superpowers/prompts/2026-09-09-recruiter-list-summary-frontend-codex.md`，实施后使用 Claude reviewer。
- 两份均绑定最终 Spec/Plan revision/blob，使用真实安装目录的 execution/final-integration/task-intents/review-contract 路径，复用宿主工作区。
- 已运行 `/Users/visionclaw/coding-harness/skills/development-workflow/scripts/validate_prompt_grading.py --plan`，三路径（Plan + 两 prompt）分级校验 PASS，exit 0。
- 文档静态自检与 staged diff whitespace 检查通过；产品测试未运行。backend+local 两卡真实展示验收为实施 required，后端正式 development L3 为 none，发布责任不属于本任务。

用户手动选择一份 prompt 启动新实施 session；规划 owner 不自动启动实施。规划批准不等于实施 final gate 批准。
