# 前端测试分层（迁移 / 测量工作区）

这是 2026-09-16 前端测试分层重构的迁移与测量工作区；Task 5 会补齐测量协议并完善本文件。
分层目标与验收口径见 `.superpowers/sdd/2026-09-16-frontend-test-layering/` 下的 spec 与各 task 报告。

## 现状（Task 1 完成后）

- **唯一功能配置**：`playwright.config.ts`，三个项目共用同一 runner，同一 invocation
  内共享启动三个不可复用 dev server：`mock` → 4181、`fixture` → 4182、`annotation` → 4183。
- **入口**：`npm run test:e2e`（原生文件/完整名称/`--project` 选择）；
  `npm run test:e2e:data-source` 是 deprecated 完全别名（同一 `playwright test`，
  不是第二份配置）；`npm run ui:capture` / `npm run ui:check` 维持视觉入口不变。
- **离线请求边界（C3）**：`e2e/fixtures/离线边界.ts` + `e2e/fixtures/test.ts`。
  功能 spec 统一从 `./fixtures/test` 导入 `test/expect`；业务路径 = URL 前两个非空段
  依次为 `api`、`v1`；未声明业务 HTTP 兜底中止、业务 WS 永不 `connectToServer`
  （fixture/annotation 的 `/api/v1/events/live` 用空闲本地连接）；Case teardown
  `核对()` 以 method/path 定位缺口。反例见 `e2e/离线边界.spec.ts`。
- **旧兜底移除**：`数据源模式.spec.ts` / `J-PILOT-02接线.spec.ts` 的全局 `200 + null`
  兜底与 P1/展接线 fixture 的「白名单外一律 503」已删除；缺席域按坐标显式声明
  空应答（隐私 / 连续代谈 / 收件箱 / 简历教育条目更新），其余未匹配请求由离线边界
  兜底中止并使 Case 失败。

## 基线与对账（Task 1 收集）

- 原始收集件在 `test-results/test-layering/`（git-ignored；Playwright 每次运行会清空
  `test-results/`，复跑后需从当次输出重新落盘）：
  - `旧-默认入口-list.json` / `旧-数据源入口-list.json`：旧两入口 `--list` 只收集；
  - `旧-280责任表.json`：fullTitle → 旧项目去重责任表（337 变体 / 280 唯一 / 57 入口重复）；
  - `新-唯一入口-list.json` 与对账说明：280 原责任 + 离线边界反例（`e2e/离线边界.spec.ts`
    6 例），逐项差额解释见 Task 1 报告。

## 已知事项

- `J-PILOT-02接线.spec.ts` 四条手填旅程在基线 HEAD 6b8a71fa（旧入口）即失败
  （期望职位 Backend 双栏 fixture 单 selectable 根与现行产品双栏行为不符），Task 1
  仅保留证据不修产品、不删断言；详见 Task 1 报告「产品缺陷 / 既有失败证据」。
- 视觉回归目录 `e2e/视觉回归/` 尚未接入统一 `test` 导入与边界（Task 5 同步处理）。
- Task 2 起 BFF fixture 将从 `e2e/数据源模式.spec.ts` 抽取；计时以 Task 1 的离线版本
  为起点，离线修复本身不计入拆分提速。