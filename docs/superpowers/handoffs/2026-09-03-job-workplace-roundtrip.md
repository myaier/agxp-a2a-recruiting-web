# 岗位办公方式 Backend Round-trip Plan Handoff

handoff_version: 5

## Verdict

- 实现：**READY**
- 唯一 plan-scope authoritative verdict：**PASS** —— `npm test` exit 0（152 个测试文件 / 2852 个测试全部通过）。
- 验收模式：`VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local`（单元测试为必需验收，未以浏览器手测代替；`npm run test:e2e:data-source` 属可选 L2 补充，fixture 条件未确认，本批未运行、不冒充证据）。

## Baselines

- Spec：`docs/superpowers/specs/2026-09-03-backend-data-truth-source-design.md`（§C 岗位办公方式闭合映射）。
- Plan：`docs/superpowers/plans/2026-09-03-job-workplace-roundtrip.md`。
- 实施基线：`260d34f6`（= 实施时 `origin/main` tip，含前序 contact-events Plan 全部产出）。实施前 fetch 最新 `origin/main` 后 HEAD 与之完全一致，四个目标文件（`后端映射.ts`、`后端映射.test.ts`、`发布岗位.tsx`、`发布岗位.test.tsx`）与 `origin/main` 逐文件 diff 为空，零漂移、零 merge。

## Task Commits

| Task | Commit | 内容 |
| --- | --- | --- |
| 1 | `7e493525` | `后端映射.ts` 岗位域唯一闭合双向表（`Wire岗位办公方式表`/`页面岗位办公方式表`）+ 导出 `Wire到岗位办公方式`/`岗位办公方式到Wire`；`从BFF岗位` 改用前者，`转岗位创建`/`转岗位补丁` 改用后者；删除旧 `办公方式到岗位后端` 表与两处 `?? 'onsite'` 静默回退；意向域 `后端到办公方式`（remote→远程）原样保留。测试新增三态双向穷举、非法值 fail closed、三态完整 DTO 读入→创建/补丁 round-trip |
| 2 | `50a8d7e3` | `发布岗位.test.tsx` 新增 remote owner job 编辑选中「全远程」（`aria-pressed`）且无修改保存仍提交 `办公方式:'全远程'` 的用例 + `现场/混合` 镜像回归。组件零改动（`发布岗位.tsx` 无 diff）：快捷片 `aria-pressed` 与 `编辑目标.办公方式` state 初始化均在主干已存在，Plan 预期成立 |
| Review r1 | `0b47aa3a` | 1 项修复（见 Review Rounds）：`岗位办公方式到Wire` 键检查改 `Object.prototype.hasOwnProperty.call`，拒绝 `toString`/`constructor`/`__proto__` 原型链键 + 三个失败测试 |

## TDD Evidence（每 Task 严格 RED → GREEN）

| Task | RED | GREEN |
| --- | --- | --- |
| 1 | `npx vitest run src/数据/后端映射.test.ts` → 5 failed / 44 passed（remote 回显「远程」、新导出缺失） | 同命令 → 49 passed |
| 2 | `npx vitest run 发布岗位.test.tsx 后端映射.test.ts` → 3 failed（保存被「请选择职位类别」拦截：fixture 缺 `类别引用`，非产品缺陷，按既有 Backend 编辑守卫口径补齐） | 同命令 → 152 passed |
| Review r1 修复 | `后端映射.test.ts` → 3 failed（原型链键被 `in` 放行） | 两文件 → 155 passed |

## Review Rounds（Codex 多轮，宿主为 Claude Code）

- R1（`codex exec review --base 260d34f6`，gpt-5.6-sol / high）：1 条 [P2]。
  - [P2] `键 in 页面岗位办公方式表` 命中原型链（`toString`/`constructor`/`__proto__` 绕过 fail-closed，继承成员被当 wire code 返回）→ **修复**：改 `Object.prototype.hasOwnProperty.call` 只认自有键（仓库既有 idiom，`转证书` 同款），TDD 补三个原型链键失败测试。提交 `0b47aa3a`。
- R2（`codex exec resume` 同会话）：**NO FINDINGS** —— 第 2 轮 clean，循环终止。

## Authoritative 与 Inner-loop Evidence

- Authoritative（唯一 plan-scope gate）：`npm test` → exit 0，152 文件 / 2852 测试通过（含全部既有岗位创建/补丁、意向域、发布岗位页面回归）。
- Inner-loop：见上表；`npm run typecheck`、`npm run lint`、`npm run build` 均 exit 0（review 修复提交后复跑一遍确认）。

## 与 Plan 草图的现场校准（不改变合同，均为最小实现）

1. **`岗位办公方式到Wire` 的键检查采用 `hasOwnProperty` 而非 Plan 草图的直接索引**：实际 `在招岗位['办公方式']` 是 `string | undefined`（Mock 域共用字段，非闭合 union），Plan 草图的 `页面岗位办公方式表[value]` 直接索引 string 无法通过 typecheck；按仓库 `映射经验要求` 同款「键检查 + 抛错」idiom 实现，签名收宽为 `在招岗位['办公方式']`（undefined 落 `(空)` 文案），最终经 R1 修复收敛为 `hasOwnProperty`（拒绝原型链键）。
2. **`satisfies Record<页面岗位办公方式, …>` 在 `办公方式 = string` 下无编译期穷举力**，仅作文档约束保留；三态穷举由测试 `it.each` 钉死（Plan 测试设计本就如此要求）。
3. **Task 2 初版 RED 是 fixture 问题**：`页面岗位样本` 无 `类别引用`，Backend 编辑守卫按既有口径（同「编辑态无 verified affiliation 照常保存」用例）要求编辑目标带真实 `类别引用/地点引用`；补齐后即 GREEN，未为制造产品 diff 而改组件，也无 no-op 空提交。
4. **意向域零触碰**：`从BFF意向草稿` 的 `remote → 远程` 投影与既有断言（`办公方式: ['混合', '远程']`）原样保留，证明岗位修复未改变意向编辑 vocabulary。

## dependency_drift

- 实施前 fetch 最新 `origin/main`：与本地基线完全一致（`260d34f6`），无 merge、无冲突。
- **与 JD 上传分支：无冲突。** `发布岗位.tsx` 产品代码零改动（本 Plan 对它的 diff 为空），JD 上传入口、CSS、布局、控件选项与文案均未触碰；`后端映射.ts` 的改动全部在岗位域，意向域映射原样。
- 计划外现场发现（记录、未触碰）：`映射经验要求` 既有实现用 `键 in 经验要求到后端`，与本批 R1 修复前的 `in` 同源存在原型链键漏洞。它在 `260d34f6` 已存在、不属于本 Plan diff 范围，按 Plan 全局约束不顺手修，留给后续独立小修。

## Residual（记录非缺陷）

- `映射经验要求` 的 `in` 原型链漏洞（见上）：现实触发面与 `岗位办公方式到Wire` 相同（页值来自表单 state/fixture，非用户自由输入），修复约一行 + 一条测试，建议下一批次顺手处理。
- 求职意向页面继续使用 `现场 | 混合 | 远程` vocabulary（Spec 非目标，明确延后；重新考虑需意向任务的 PM 证据）。
- remote 空办公地址条件投影、候选岗位详情事实投影等历史 Handoff 项不在本批（Spec 非目标）。

## Plan-scope testing boundary

- L3/shared environment：`integration_requirement: none`；`selection_ssot: none`；`selection_gap: none`；`l3_selection: []`。三态映射与页面/operation round-trip 由 deterministic tests 判定，无需共享后端。
- 可选 L2：rolling integration owner 可在组合 commit 上运行 fixture Backend E2E；它不得冒充真实 BFF L3。
- Release handoff：`required: false`、`owner: none`、`required_mode: none`、`nightly_only_mode: none`、`status: none`。