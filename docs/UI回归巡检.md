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

## `agent-browser` 人工补充巡检

`npm run ui:check` 是确定性 Playwright 门禁，决定 CI 退出码。`agent-browser` 巡检是门禁之外的**人工审查材料**：它在同一 mock 服务上走完 16 个场景，收集 console/page error、`/api/v1` 请求与可视化证据（annotated screenshot / 录屏），产出一份独立的 `agent-scan-report.md`。它**不改变 Playwright 退出码**，也不接入 CI——只供分支合并前的 reviewer 参考。

### 前置条件

- 已安装 `agent-browser`（0.27.2 验证通过；直接用二进制 `agent-browser`，不要用 `npx agent-browser`）。先读当前安装版本说明：

  ```bash
  agent-browser skills get core --full
  agent-browser skills get dogfood
  ```

- 产物目录在 `ui-regression-output/` 下，已被 `.gitignore` 忽略，**不得提交截图、视频或报告**。

### 启动 mock 服务

```bash
mkdir -p ui-regression-output/agent-scan/screenshots ui-regression-output/agent-scan/videos
VITE_DATA_SOURCE=mock VITE_BACKEND_ENV=stg npm run dev -- --host 127.0.0.1 --port 4176 --strictPort
```

把 dev server 放在后台运行（`&`/`nohup` 或后台 shell），巡检结束后必须停掉，避免占用 4176 端口。

### 开启会话并设置视口

```bash
agent-browser --session ui-regression open http://127.0.0.1:4176
agent-browser --session ui-regression wait --load networkidle
agent-browser --session ui-regression set viewport 390 844
```

`agent-browser` 命令格式为 `agent-browser --session <name> <command> [args]`；以下命令都带 `--session ui-regression` 前缀，为简洁起见示例中省略。每个会话是独立浏览器，refs（`@eN`）只在最近一次 `snapshot` 内有效。

### 每个场景的固定动作

按 `docs/superpowers/specs/2026-08-26-ui-regression-baseline-design.md` 第 9 节顺序走 16 个场景：

1. `entry-login-default` `/#/`
2. `entry-identity` `/#/identity`
3. `candidate-preferences` `/#/student`
4. `candidate-salary` `/#/wizard?stage=salary`
5. `candidate-resume` `/#/basic`
6. `candidate-market` `/#/app`（→点「市场」）
7. `candidate-negotiations` `/#/app`（默认即在谈首页）
8. `candidate-negotiation-detail` `/#/deal/J-01`（→点「职位详情」Tab）
9. `candidate-messages` `/#/app`（→点「消息」导航）
10. `candidate-me-overlay` `/#/app`（→「我」→「待你拍」→「筛选」）
11. `candidate-profile` `/#/profile`
12. `recruiter-card` `/#/hr/card`
13. `recruiter-post-job-1` `/#/hr/post-job`
14. `recruiter-post-job-2` 从 `/#/hr/post-job` 完成第一步
15. `recruiter-post-job-3` 从 `/#/hr/post-job` 完成第一、二步
16. `recruiter-home-candidate` `/#/hr`（→「推荐」→「查看候选画像」）

到达每个场景前先按状态种子准备 `localStorage`（与 `e2e/视觉回归/稳定页面.ts` 一致）：

- `未登录`（场景 1–2）：清空 `localStorage`/`sessionStorage`。
- `求职端已注册`（场景 3–11）：清空后写入 legacy 种子 `AGXP简历v2` 与 `AGXP求职筛选v1`（JSON 字符串，见 `稳定页面.ts`），应用迁移逻辑会把它迁到账号隔离键。
- `招聘端已注册`（场景 12–16）：只清空，用应用内 Mock 招聘数据。

因为 `agent-browser` 没有先于导航的 `addInitScript`，做法是：先 `open http://127.0.0.1:4176/#/` 建立 origin，再用 `eval` 清空并按需写入 `localStorage`，最后 `open` 到目标 `/#/path` 重新加载。

```bash
# 例：求职端已注册场景
agent-browser --session ui-regression open http://127.0.0.1:4176/#/
agent-browser --session ui-regression eval --stdin <<'EOF'
localStorage.clear(); sessionStorage.clear();
localStorage.setItem('AGXP简历v2', JSON.stringify({基本信息:{真名:'沈亦舟',开始工作年:'2017',身份:'在职'},经历:[],教育:[],技能:['TypeScript','React'],个人优势:'九年前端与平台经验，主导过招聘系统重建。'}));
localStorage.setItem('AGXP求职筛选v1', JSON.stringify({职位:['产品经理'],城市们:['上海'],薪资:{下限:30,上限:45,单位:'月薪K'},筛选偏好:{求职类型:['社招全职'],办公方式:['混合']}}));
EOF
agent-browser --session ui-regression open http://127.0.0.1:4176/#/student
agent-browser --session ui-regression wait --load networkidle
```

### 落定后的固定检查

每次页面落定后执行：

```bash
agent-browser --session ui-regression snapshot -i
agent-browser --session ui-regression errors
agent-browser --session ui-regression console
agent-browser --session ui-regression network requests
agent-browser --session ui-regression screenshot --annotate ui-regression-output/agent-scan/screenshots/<scene-id>.png
```

要点：

- **页面变化后必须重新 `snapshot`**，不复用 stale ref。`@eN` 仅在最近一次 snapshot 有效。
- **静态问题**（文案/占位/裁切/对齐/加载即报的 console error）只保存 annotated screenshot。
- **交互/时序问题**先复验一次确认可复现，再在动作前 `record start`、动作后 `record stop`：

  ```bash
  agent-browser --session ui-regression record start ui-regression-output/agent-scan/videos/issue-NNN-repro.webm
  # 按人类节奏走复现步骤，每步 sleep 1-2s 并截图
  agent-browser --session ui-regression record stop
  ```

- **每页检查 `errors`、`console`、`network requests`；发现 `/api/v1` 请求即记录为 blocker**（mock 下不应有真实后端调用）。
- 在 `agent-scan-report.md` 的 Scene Results 表为每个场景加一行，Issues 段为每个问题加一个 ISSUE-NNN 块。报告模板见 `docs/UI回归报告模板.md`。

### 收尾

```bash
agent-browser --session ui-regression close
# 停止 4176 上的 Vite dev server
```

确认 4176 端口已释放。`agent-browser` 报告位于 ignored 目录，**不提交**；只提交 `docs/UI回归巡检.md` 与 `docs/UI回归报告模板.md` 这两个文档。