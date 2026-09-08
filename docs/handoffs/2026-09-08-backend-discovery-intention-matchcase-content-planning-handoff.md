# Backend 在谈／市场修复规划交付记录

日期：2026-09-08。当前会话完成规划与文档审查，不含产品实施、测试或发布。

## 冻结契约

- Spec：`docs/superpowers/specs/2026-09-08-backend-discovery-intention-matchcase-content-design.md`。
- 用户明确批准：“批准Spec，你继续吧”；批准 revision `e6f4af66c5453c952cea997e2435e55650749165`，blob `f5839c411825a05987ca5bc8835f057c6b8261f6`。文件内“待批准”是该冻结快照生成时状态，本记录与用户回复确认其已批准；不得擅自改动该 blob。
- 最终 Plan：`docs/superpowers/plans/2026-09-08-backend-discovery-intention-matchcase-content.md`；revision `7ca3f00dd9416703955563be1bd72f44fdb24dab`，blob `bdbf4508349f3ee23e24fbb480aad0ab8a8476e1`。
- 工作区：`/Users/visionclaw/.paseo/worktrees/09eyc7i7/ignorant-cheetah`，分支 `fix/recruit-card-intention-alignment`；复用，不创建新工作区。
- 目标：`origin/main`／远端 `refs/heads/main`。规划可见 target `968a51f40083b276d9c7cf0bf32f8f403212450f`；final gate 必须重新观察并冻结真实 target。

## 任务与边界

一份 Plan，6 个串行 Task：招聘机器码、意向 ID 与刷新恢复、双端 Case PDF、隐藏 ID 与终局时间、委托成功交互／暂留／P5 失效、新岗位发布后选中。

独立回退边界为意向恢复、委托与在谈、发布选岗、内容／PDF。共享页面与状态接线按同一实施者连续处理；每个 Task 包含相应测试，委托展示与缓存刷新必须整组闭环，不只删掉导航。

复杂度高，零上下文漂移风险中；模型档位只依漂移风险，使用当前可用的行业 Top 5–10 中高性价比模型。两份提示词与 Plan 的分级一致。

用户覆盖项：不改 Mock、CSS／样式／布局，不新增产品组件，不跑浏览器 E2E／Playwright／agent-browser／视觉比较。前端生产接线用 Vitest/jsdom 和现有 HTTP 数据源测试。后端空 keywords 修复部署未经本会话核验，后续真实双端走查仍待联合验收。

## 异构文档 review

模式 `WORKFLOW_DOCUMENT_REVIEW`；父 workflow 已获授权，仅冻结上述 Spec 与 Plan；reviewer 为 Claude Opus，`--effort high --permission-mode plan`。同一审查 session `07aa9c2d-7fcd-4d17-aa77-3dd02b04df4b`，R2／R3 使用 resume。共用合同 `/Users/visionclaw/coding-harness/skills/_shared/review-contract.md`。

| 轮次 | 候选 | Findings 与裁决 |
| --- | --- | --- |
| R1 | `4a10fe1c`，Plan blob `e7bf32f71dcf6af096a1b02054ef4da8a673b668` | 2 条 required：Important 真实缺陷、Minor 契约违反；全部接受并修复，无 optional |
| R2 | `edfb82d2`，Plan blob `75768030e022c27688695efa99ca854599d4613c` | 核实两项修复，无新 finding；`NO FINDINGS` |
| R3 | `7ca3f00dd9416703955563be1bd72f44fdb24dab`，Plan blob `bdbf4508349f3ee23e24fbb480aad0ab8a8476e1` | 只复核现有测试文件误写为新建的两行纠正；`NO FINDINGS` |

R1 finding 1：P5 失效 helper 原 Pick 保留了运行时引用的可选性，与“缺引用不能静默跳过”不够一致。接受，改收完整后端操作依赖并复用既有 `取P5引用` 守卫；不增加新守卫或基础设施，复杂度降低，不改 Spec。

R1 finding 2：Task 2 未显式列出新增不抢选、删非当前、归档回退及胶囊可见内部 ID 负断言。接受并逐项写入，包括消歧序号路径，复杂度不变，不改 Spec。修复 commit：`edfb82d27c9ae7c320783439163ae8e9a8660f7d`。

报告区外缓存重写观察已核实：`写资料缓存` 直接 setItem JSON，不合并旧字段，Plan 的恢复期间保留原选择保护有实际依据，无追加改动。编辑修正 commit：`7ca3f00dd9416703955563be1bd72f44fdb24dab`。

三轮均先通过受审工作树 status／HEAD／文档指纹的 post-round guard 再读取 findings，无 reviewer 写入、未执行产品测试。未解决 required／optional 均为 0。原始报告与基线保存在本机 `/tmp/claude-review-loop/session-37xno776`，本文件保留长期可读裁决摘要；文档 review 不替代实施代码 review。

## 校验与执行交付

三路径分级校验：

```sh
python3 /Users/visionclaw/coding-harness/skills/development-workflow/scripts/validate_prompt_grading.py --plan docs/superpowers/plans/2026-09-08-backend-discovery-intention-matchcase-content.md --claude-prompt docs/superpowers/prompts/2026-09-08-backend-discovery-intention-matchcase-content-claude.md --codex-prompt docs/superpowers/prompts/2026-09-08-backend-discovery-intention-matchcase-content-codex.md
```

结果：PASS。同时核对两份 prompt 各只有一条分级句、无未替换模板占位符、批准 Spec／最终 Plan revision/blob 与磁盘一致，所引用的仓库输入与已解析 skill 路径可读。文档 diff --check 通过。以上均为文档检查，不是产品测试 PASS。

执行提示词：

- Claude：`docs/superpowers/prompts/2026-09-08-backend-discovery-intention-matchcase-content-claude.md`，实施 reviewer 为 Codex。
- Codex：`docs/superpowers/prompts/2026-09-08-backend-discovery-intention-matchcase-content-codex.md`，实施 reviewer 为 Claude。

用户任选一个复制到新实施 session；不同时运行两份。实施者按 Plan 完成后，定向验证与代码 review 收敛，再展示具体 final gate 方案申请确认；批准后才同步 target、跑一次正式非浏览器 gate、普通 fast-forward push。本次尚未开始实施、运行产品测试、浏览器验收、部署或推送。
