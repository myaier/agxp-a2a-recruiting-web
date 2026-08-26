# UI 回归巡检

本文档说明 UI 视觉回归门禁的运作方式，以及仓库管理员需要完成的两个外部设置步骤。代码无法自行完成这些步骤——它们必须在 GitHub 仓库设置中手动配置。

## 门禁机制概览

`npm run ui:check` 执行一次完整的视觉回归：

1. 解析基准引用（`--base <git-ref>`，默认 `origin/main`）。
2. 为基准创建 detached git worktree，运行 `npm ci` 并采集参考场景（端口 4174）。
3. 在当前工作区采集候选场景（端口 4175）。
4. 运行比较器，输出 `ui-regression-output/latest/` 下的 `report.json`、`report.md`、`reference/`、`candidate/`、`diff/`，并在基础设施异常时写 `infrastructure-error.json`。
5. 返回退出码：`0` 通过、`1` 视觉差异未放行、`2` 基础设施错误。

退出码与门禁模式由环境变量驱动：

- `UI_VISUAL_GATE`：`report`（默认，仅生成报告不阻塞）或 `enforce`（未放行的视觉差异导致退出码 1，阻塞合并）。
- `UI_CHANGE_APPROVED`：字面量 `'true'` 表示审查者已放行预期的视觉变更；其他任何值（空、`false`、未知字符串）均视为未放行。

GitHub Actions workflow（`.github/workflows/ui-regression.yml`）在 PR 上自动运行 `ui:check`，并把 `UI_VISUAL_GATE`、`UI_CHANGE_APPROVED` 从仓库变量与 PR 标签解析后传入。

## 仓库管理员必须完成的两步设置

以下两步只能在 GitHub 仓库设置中完成，代码无法自行服务。

### 1. 创建 repository variable `UI_VISUAL_GATE`

- 路径：仓库 Settings → Secrets and variables → Actions → Variables → New variable。
- 名称：`UI_VISUAL_GATE`
- 初始值：`report`

在 `report` 阶段，CI 仅生成报告，不会因视觉差异阻塞 PR。团队在此期间校准阈值、观察噪声、积累基线。校准完成、阈值稳定后，管理员把该变量改为 `enforce`。此后未放行的视觉差异将以退出码 1 阻塞合并。

workflow 中 `UI_VISUAL_GATE: ${{ vars.UI_VISUAL_GATE || 'report' }}` 会读取该变量；未设置时回落到 `report`。

### 2. 创建 label `ui-change-approved` 并设置 branch protection

- 路径：仓库 Issues/PR 设置 → New label。
- 名称：`ui-change-approved`
- 颜色/描述：按团队约定。

然后在 branch protection（Settings → Branches → branch protection rule）中把 **`UI Regression / ui-regression`** 设为 required status check。这样未通过的 UI 回归会阻塞合并到默认分支。

workflow 通过 `UI_CHANGE_APPROVED: ${{ contains(github.event.pull_request.labels.*.name, 'ui-change-approved') }}` 把该标签存在性传入门禁。

## 标签使用规则（重要）

`ui-change-approved` 标签 **只能由审查者在查看 diff 后添加**。审查者必须打开 `ui-regression-evidence` 产物，逐个确认 `diff/` 中的差异都是预期内的变更（样式调整、文案、布局重构等），才能添加该标签。

**以下三类错误不会被 `ui-change-approved` 标签放行**，即使标签存在，门禁仍会阻塞：

1. **结构差异**：DOM 结构/组件树变化导致的像素差异。这类差异通常意味着渲染输出本身改变，不属于纯视觉样式调整，需要修复或重新采集基线，不能用标签跳过。
2. **API 隔离差异**：采集依赖 mock 数据，任何由 API 行为变化引入的差异都表明 mock/数据契约发生变化，必须先修正 mock 与采集器，不得用标签放行。
3. **基础设施错误**：退出码 `2` 表示依赖安装、worktree、采集命令或比较器异常。这类错误必须修复基础设施，`ui-change-approved` 不影响退出码 2 的判定。

标签只对 `report`/`enforce` 下的退出码 1（预期内视觉差异）生效；对结构、API 隔离、基础设施错误一律无效。

## 本地使用

在本地复现 CI 门禁：

```bash
# 默认基准 origin/main
npm run ui:check

# 指定基准引用
npm run ui:check -- --base origin/release

# 模拟 CI（同提交比较，期望退出 0）
CI=true UI_VISUAL_GATE=report UI_CHANGE_APPROVED=false \
  npm run ui:check -- --base HEAD --output ui-regression-output/ci-simulation
```

阅读报告：打开 `ui-regression-output/latest/report.md`，其中汇总每个场景的通过/差异状态与门禁判定。`report.json` 为结构化结果，包含 `visualGate`、`uiChangeApproved` 与各场景结果，便于脚本化消费。

证据产物：差异场景的参考图、候选图与 diff 图位于 `ui-regression-output/latest/reference`、`candidate`、`diff` 下，便于本地查看；CI 失败时作为 artifact 上传。