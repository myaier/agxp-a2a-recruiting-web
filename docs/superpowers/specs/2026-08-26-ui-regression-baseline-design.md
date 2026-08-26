# 无后端 UI 回归基线与合并门禁设计

**日期：** 2026-08-26

**状态：** 已确认，待实施计划

**适用仓库：** `agxp-a2a-recruiting-web`

## 1. 背景

项目已经具备以下基础：

- Vite 默认使用 `VITE_DATA_SOURCE=mock`，可以完全不启动后端。
- Playwright 已安装，并已有固定为 iPhone 13 的移动端 E2E 配置。
- 求职注册、招聘注册、Mock 数据源和换壳无闪屏等核心流程已有行为回归测试。
- `docs/runs/` 中保存了大量人工复验截图，但目前没有自动视觉差异判定或 PR 合并门禁。

当前缺口不是再增加一套通用 E2E 框架，而是建立一条稳定、快速、可解释的 UI 回归链路，在大型前端分支准备 push 或 merge 时发现白屏、结构缺失、整体布局漂移和严重运行时错误。

## 2. 目标

本设计实现以下目标：

1. 在不启动后端的情况下检查约 12–15 个高价值移动端状态。
2. 将准备合入的目标分支作为实时 reference，将当前分支作为 candidate，在同一环境中比较。
3. 由 Playwright 提供可重复的结构断言、截图采集和自动合并门禁。
4. 由 `agent-browser` 补充场景清单之外的智能巡检、console 检查和可视化证据。
5. 大失效自动阻止合并，小变化只报告并交由人工判断。
6. 本地提供一个准备 push 前可运行的入口，PR CI 提供最终 required check。

## 3. 非目标

第一版不包含：

- 桌面、平板或多种手机视口；只固定 iPhone 13。
- 穷举全部路由、全部数据组合或全部交互状态。
- 后端、STG 或真实账号集成测试。
- 由 AI 的主观截图判断直接决定 CI 成败。
- 自动接受新的视觉结果或在普通测试中重写基线。
- 新建一套自定义测试 DSL。

## 4. 已确认的策略

### 4.1 门禁策略

采用渐进式分级门禁：

- 引入后的前两周，结构性失效直接拦截，视觉差异只生成报告。
- 稳定后，结构性失效和大面积视觉漂移直接拦截；小范围差异继续只报告。
- 明确的大型 UI 改版可由审查者在查看 diff 后添加 `ui-change-approved` 标签放行。

### 4.2 设备与覆盖

- 第一版只覆盖 iPhone 13。
- 固定约 12–15 个关键状态，不追求全路由截图。
- 现有完整流程 E2E 继续验证行为；视觉回归测试通过少量状态种子快速到达目标画面。

### 4.3 触发方式

- 本地使用 `npm run ui:check` 做准备 push 前的主动检查。
- PR CI 自动运行同一检查并作为最终 merge gate。
- 第一版不强制安装 Git `pre-push` hook。

## 5. 总体架构

系统包含四个边界：

### 5.1 Mock 应用环境

reference 与 candidate 分别在独立端口启动 Vite，并显式使用：

```text
VITE_DATA_SOURCE=mock
VITE_BACKEND_ENV=stg
```

每次采集都使用干净的浏览器 context 和确定的浏览器存储状态。测试不得依赖开发者正在运行的服务、`.env.local` 或后端可用性。

### 5.2 Playwright 确定性门禁

Playwright 负责：

- 到达固定场景并等待稳定条件。
- 断言路由、关键标题、主按钮、导航、弹层和页面根节点。
- 收集关键元素几何信息。
- 捕获 reference 与 candidate 截图。
- 收集 page error、console error、资源失败和 `/api/v1` 请求。

只有这一层能够自动决定 CI 是否通过。

### 5.3 `agent-browser` 智能巡检

`agent-browser` 负责准备合并前的补充检查：

- 按相同场景 ID 浏览页面。
- 读取 accessibility snapshot、console、page errors 和请求。
- 检查固定截图清单之外的明显异常状态。
- 为静态问题保存标注截图。
- 只为交互或时序问题录制复现视频。

它输出审查材料，但其模型判断不直接阻止合并。

### 5.4 报告与门禁

整个链路为：

```text
干净 Mock 环境
  -> reference 采集
  -> candidate 采集
  -> 结构与视觉比较
  -> report + diff + trace
  -> agent-browser 补充巡检
  -> PR 分级门禁
```

## 6. 动态基线

### 6.1 基线来源

基线不是长期维护的一组唯一 PNG，而是当前准备合入的目标分支：

```text
PR 目标分支，例如 origin/main -> reference
当前功能分支 HEAD              -> candidate
```

PR CI 自动读取 base ref。本地允许通过 `UI_BASE_REF` 或命令行参数指定；缺省为 `origin/main`。

### 6.2 双版本采集

reference 与 candidate 分别运行各自版本中的采集器，再按稳定场景 ID 比较：

```text
base checkout      -> reference/<scene-id>.png
candidate checkout -> candidate/<scene-id>.png
                   -> comparator
                   -> report.json + report.md + diff/*.png
```

这样 candidate 对场景实现的修改不会被用来强行操作旧版页面。

### 6.3 场景集合变化

- 两边都有同一场景 ID：正常比较。
- candidate 新增场景：标记为“待建立 reference”，只报告。
- candidate 删除 reference 已有场景：视为覆盖减少并阻止合并，除非经过显式 UI 变更审批。

### 6.4 Bootstrap

首次引入系统时，目标分支还没有采集器。首个 PR 进入 bootstrap 模式：只采集 candidate、运行结构断言并产出人工审查材料，不进行双分支像素裁决。系统合入目标分支后，后续分支自动启用双版本比较。

## 7. 稳定性控制

reference 与 candidate 必须在同一 runner 中使用相同的：

- Playwright/Chromium 版本。
- iPhone 13 viewport、device scale factor 和 user agent。
- 时区、语言、颜色模式和缩放。
- Mock 数据与 localStorage/sessionStorage 初始值。
- 动画、transition、光标和闪烁元素禁用规则。
- 字体就绪条件和页面稳定条件。

不得使用固定 `sleep` 作为主要稳定手段。每个场景定义明确的 ready 条件，并等待 `document.fonts.ready`。只有无法固定且不属于主要内容的动态区域可以 mask。

reference 与 candidate 使用独立端口。运行器无论成功失败都必须退出浏览器、停止服务并清理临时 detached worktree。

## 8. 场景模型

每个场景定义：

```text
scene ID
状态种子
到达步骤
稳定条件
关键元素
几何检查项
截图范围
允许 mask
```

状态种子仅保留少量公共类型，例如：

- 未登录。
- 求职端已完成注册。
- 招聘端已完成注册。

每个场景使用新的 browser context，禁止依赖上一场景的浏览器存储、滚动位置或弹层状态。

## 9. 第一批场景

### 9.1 注册与入口

1. `entry-login-default`：登录页默认态。
2. `entry-identity`：身份选择页。
3. `candidate-preferences`：求职类型与偏好页。
4. `candidate-salary`：期望薪资页。
5. `candidate-resume`：在线简历页。

### 9.2 求职端

6. `candidate-market`：主壳“市场”首页。
7. `candidate-negotiations`：主壳“在谈”首页。
8. `candidate-negotiation-detail`：在谈详情。
9. `candidate-messages`：消息列表。
10. `candidate-me-overlay`：“我的”首页及关键弹层。

### 9.3 招聘端

11. `recruiter-card`：招聘名片。
12. `recruiter-post-job-1`：发布岗位第一步。
13. `recruiter-post-job-2`：发布岗位第二步。
14. `recruiter-post-job-3`：发布岗位第三步。
15. `recruiter-home-candidate`：企业主壳及候选详情弹层。

场景 ID 是跨版本和报告之间的稳定接口；页面文案允许演进，但 ID 不应随意改名。

## 10. 判定规则

### 10.1 结构性失效

以下情况始终阻止合并：

- 页面白屏、根节点为空或未到达预期路由。
- 关键标题、主按钮、导航或目标弹层缺失。
- 出现未捕获异常、严重 console error 或关键资源加载失败。
- 出现明显横向溢出。
- 关键元素相对 reference 位移超过约 16px。
- 关键元素宽高相对 reference 变化超过约 15%。
- Mock 巡检过程中出现任何 `/api/v1` 请求。

### 10.2 视觉差异

初始默认值：

- 差异像素比例大于约 5%：大漂移。
- 差异像素比例约 0.5%–5%：警告。
- 差异像素比例低于约 0.5%：噪声。

单像素比较先应用感知颜色阈值，降低抗锯齿、轻微阴影和字体渲染差异造成的噪声。所有阈值集中配置，前两周依据真实样本校准，不允许散落在场景文件中。

结构断言与截图比较必须同时存在。重要按钮消失可能只占少量像素，应由结构断言拦截；整体配色或布局漂移则由视觉比较拦截。

### 10.3 合法 UI 变化

当大漂移属于明确批准的 UI 改版时：

1. CI 仍生成完整 reference、candidate 和 diff。
2. 审查者查看产物。
3. 审查者添加 `ui-change-approved` 标签。
4. 工作流重新运行后允许视觉大漂移通过。

结构性运行错误、白屏或 Mock 隔离失败不应被该标签自动豁免。

## 11. 代码边界

计划中的主要文件：

- `playwright.视觉回归.config.ts`：设备、浏览器、串行策略和采集环境。
- `e2e/视觉回归/场景.ts`：场景定义与少量公共状态种子。
- `e2e/视觉回归/采集.spec.ts`：单版本采集器。
- `e2e/视觉回归/比较器.ts`：图片、几何和运行时结果比较。
- `脚本/UI回归.mjs`：base 发现、临时 worktree、进程编排、比较和清理。
- `docs/UI回归巡检.md`：本地命令与 `agent-browser` 补充巡检手册。
- `.github/workflows/ui-regression.yml`：PR 自动门禁和产物上传。
- `package.json`：公开命令和内部采集命令。

场景使用普通 TypeScript 函数和 Playwright 语义定位器。第一版不引入自定义 DSL，也不让 Playwright 与 `agent-browser` 共用脆弱的动态元素引用。

## 12. 命令与 CI

公开入口：

```bash
npm run ui:check
npm run ui:check -- --base origin/main
```

内部采集、比较和 bootstrap 命令只供运行器与 CI 调用。

PR workflow 必须：

1. 使用完整或足够深的 Git 历史取得 base ref。
2. 安装锁定依赖和固定 Chromium。
3. 执行 UI 回归检查。
4. 无论成功失败都上传报告和诊断日志。
5. 失败时上传 reference、candidate、diff 和 Playwright trace。
6. 成功时只保留摘要，避免长期存储大量重复截图。

失败产物建议保留 14 天。完整运行时间目标为五分钟以内。

## 13. `agent-browser` 巡检流程

大型分支准备合并时，按以下顺序执行：

1. 启动 candidate 的 Mock 环境。
2. 按场景 ID 浏览核心页面。
3. 每页获取 accessibility snapshot。
4. 检查 console、page errors 和网络请求。
5. 正常页面只记录摘要。
6. 静态异常保存 annotated screenshot。
7. 交互或时序问题验证可重复后，保存逐步截图和复现视频。
8. 生成 `agent-scan-report.md` 供 PR 审查。

该流程补充固定测试清单，但不能取代确定性的 Playwright 门禁。

## 14. 错误处理

结果分为：

- **产品失效：** 结构异常或达到门禁阈值的大漂移。
- **巡检警告：** 小范围视觉变化或新增场景无 reference。
- **基础设施错误：** base 不存在、依赖安装失败、服务未启动、浏览器崩溃、场景超时或比较器无法读取产物。

基础设施错误必须单独标识，不能伪装成产品 UI 失败；CI 仍停止合并，要求重跑或修复环境。基础设施错误最多自动重试一次，真实截图差异不重试。

## 15. 验证策略

实施时至少验证：

1. 同一提交与自身比较时不产生大漂移。
2. 比较器使用合成小图正确区分噪声、警告和大漂移阈值。
3. 人为移动关键元素超过 16px 时能够拦截。
4. 人为制造大面积样式变化时生成正确 diff。
5. 删除关键按钮、制造白屏或 console exception 时能够拦截。
6. candidate 删除已有场景时能够识别覆盖减少。
7. bootstrap 模式只报告、不进行无基线像素裁决。
8. 整个过程不启动后端，也不发出 `/api/v1` 请求。
9. 失败后浏览器、服务和临时 worktree 均被清理。
10. 本地与 PR CI 的公开入口和报告结构一致。

## 16. 推进顺序

1. 实现单版本采集器和 15 个场景。
2. 实现双版本编排与比较器。
3. 实现 Markdown/JSON 报告和失败产物。
4. 接入公开 npm 命令。
5. 接入 PR CI，先以报告模式运行两周。
6. 校准阈值后启用大漂移门禁。
7. 补充 `agent-browser` 巡检手册并完成一次真实大型分支演练。

本设计完成后，下一步应先编写零上下文实施计划，再开始修改测试和 CI 代码。
