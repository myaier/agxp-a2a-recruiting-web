# Agent Dogfood 入口迁移：规划交付与文档审查记录

日期：2026-09-08。状态：Spec 已批准，零上下文 Plan 文档审查收敛，交付新实施会话；尚未实施或运行本次产品测试。

## 冻结契约

| 文档 | 版本 | revision | blob |
| --- | --- | --- | --- |
| [Spec](../specs/2026-09-08-agent-browser-dogfood-entry-design.md) | r2 | `082aa94b6851c596e9c17856a4eee769b7e6ef51` | `8e8f40b4ffcc938069b9b1a58a75cd13d51ad1d4` |
| [Plan](../plans/2026-09-08-agent-browser-dogfood-entry.md) | r2 | `ab0249832b2ff87b413a34ddbef581b3b44d8985` | `978437372fb007b3e9af3f5960a5a6fe8f58ca17` |

用户在 Spec r2 交付后回复“可以，然后写0上下文Plan吧”，批准其内容并授权继续 development-workflow。Spec 未改写自身批准前状态；以上对象才是权威合同。

一个独立交付，2 个串行 Task：入口/资源/文档/专属代码原子迁移；真实演练与脱敏证据。计划复杂度中，零上下文漂移风险中，执行采用当前可用的行业 Top 5–10 中高性价比模型；不创建第二个工作区。仓库 `myaier/agxp-a2a-recruiting-web`，target `origin/main`；规划阶段未 fetch/merge/push。

删除 backend-local、hosted-agent、unit、shell 四入口及专属实现，保留其他测试和共享依赖；Agent 调用现有工具、UI 业务写入、关键节点判断；不新增 runner、DSL、评分系统或后端能力。最小真实演练为 B02、H01 两次（清理隔离）、H04；未跑项与阻塞必须明确，不能冒称全九类通过。

## 文档审查

模式 `WORKFLOW_DOCUMENT_REVIEW`，`scope_approved_by_parent_workflow: true`；精确范围仅上表两文件。宿主 Codex，reviewer 为独立 Claude CLI `opus` / `high`、plan permission mode。两轮均只读，未执行测试。原始本地产物 `/tmp/claude-review-loop/session-7cn5itxx/`；reviewer session `e55a7496-b5cc-4e41-8719-1865efd85570`。首轮与复审均提供批准 Spec、用户目标/非目标、候选指纹、共用 review contract；复审追加原 findings 裁决和修复 diff。

| 轮次 | 候选 | 结果 | 保护检查 |
| --- | --- | --- | --- |
| 1 | Plan r1，commit `b9047f8784514235e895d19a4ccaf1a57ab77abd`，blob `2e74c61cf1a8c7e605eef02f3ab996d071402a20`；Spec 同批准版本 | Minor 3 项：required 1、optional 2 | status/HEAD/两文件内容指纹均未变 |
| 2 | 上表 Plan r2；Spec 同批准版本 | `NO FINDINGS`，三项全部解决，无新问题 | status/HEAD/两文件内容指纹均未变 |

接收者逐条核实，未盲目采纳：

| Finding | 必要性 / 复杂度影响 | 依据与裁决 | 修复 |
| --- | --- | --- | --- |
| R1-1：指南落盘清单缺中断后先核对实际服务/receipt、不默认重开场景 | required / 不变 | 接受；Spec §8 明确要求，单写持续记录不足以保证指南包含恢复决策 | 补 Task 1 清理与恢复行和 V1 核对义务 |
| R1-2：指南数据段未带入 OTP/fixture 限流 | optional / 不变 | 接受最小文字修订；Spec §5.3 已要求，不增加限流配置。旧 FIXTURE_LOGIN_PACE 是即将删除的前端 runner 参数，不复制为新配置 | 明示遵守实际后端限流与禁止无界重试，旧参数只保留适用知识 |
| R1-3：`.gitignore` 引用多写前导斜杠 | optional / 不变 | 接受；实际为 `dogfood-output/`，只校正文档字面量 | 保持忽略规则语义和仅注释修改边界 |

修复 commit `ab0249832b2ff87b413a34ddbef581b3b44d8985`（`docs(review-r1): clarify dogfood recovery and login limits`）。没有修改批准 Spec、增加实现范围或剩余 required findings。第二轮复核三项均已解决。

## 交接与验证

规划验证：源码/配置只读核对，Plan 九类行为/节点/生命周期和文件范围人工自检、占位扫描、`git diff --check`；已实际执行 `validate_prompt_grading.py --plan … --claude-prompt … --codex-prompt …`，返回 `OK: prompt grading parity validated`，退出码 0；两份提示词分级一致。没有本轮实现测试、真实后端验证或合入事实；历史回退尝试的 PASS 不可复用。

- [Claude 独立执行提示词](2026-09-08-agent-browser-dogfood-entry-claude-prompt.md)
- [Codex 独立执行提示词](2026-09-08-agent-browser-dogfood-entry-codex-prompt.md)

两份 prompt 使用技能真实安装位置 `/Users/visionclaw/coding-harness/skills/` 的 execution contract、task intents、final integration 和共用 review contract；全部版本引用固定为上表对象。模型分级一致，用户任选宿主复制到新实施会话。实施完成后仍须代码审查与具体 final gate 确认，本次规划批准不授权直接 push。
