# Agent-Browser 真实后端整栈验收

这条验收在本机启动或复用 Recruitment local stack，以两个专用账号收敛真实数据，随后在
`http://localhost:5173` 用 `agent-browser` 走候选端和招聘端 UI。它是显式、慢速、本地独占的
发布前检查，不属于普通 `npm test` 或 CI。

## 前置条件

- 前端依赖已安装：`npm ci`。
- `agent-browser doctor` 通过，Docker daemon 可用。
- `localhost:5173` 空闲；验收固定使用这个 Origin，不会自动换端口。
- `AGXP_MONOREPO_DIR` 指向包含本次后端实现的 worktree 或已合并的 release line，而不是一个
  仅有旧版 fixture 脚本的检出。该目录内必须存在可执行的
  `apps/recruitment/scripts/dev-local.sh` 和 `browser-fixture.sh`。
- 平台 server/worker、Hub 与 Recruitment 下游均可健康启动。若栈已健康，运行器会复用它；
  若运行器自行拉起 Recruitment 栈，收尾时才会 down 自己拥有的栈。

建议先做只读检查：

```bash
export AGXP_MONOREPO_DIR=/absolute/path/to/agxp-monorepo
git -C "$AGXP_MONOREPO_DIR" status --short
git status --short
agent-browser doctor
docker info >/dev/null
curl -fsS http://localhost:5173/ >/dev/null 2>&1 && echo '5173 已被占用'
```

平台 mock OTP cooldown 若已通过后端配置降为 3 秒，可在确认运行中 server 容器确实加载该配置后
设置 `FIXTURE_LOGIN_PACE=5` 加速。未确认时保持运行器默认值，不要用更短等待去撞登录限流。

## 常用命令

完整验收：

```bash
AGXP_MONOREPO_DIR="$AGXP_MONOREPO_DIR" UI_VISUAL_GATE=report \
  npm run test:agent-browser:backend-local -- --journey all
```

只跑一条业务旅程（仍会执行它所需的加载前置、fixture 收敛与清理）：

```bash
AGXP_MONOREPO_DIR="$AGXP_MONOREPO_DIR" UI_VISUAL_GATE=report \
  npm run test:agent-browser:backend-local -- --journey candidate-crud
```

可选 journey 为 `candidate-load`、`candidate-crud`、`recruiter-load`、`recruiter-crud` 和
`all`。调试可加 `--headed` 显示浏览器：

```bash
AGXP_MONOREPO_DIR="$AGXP_MONOREPO_DIR" UI_VISUAL_GATE=report \
  npm run test:agent-browser:backend-local -- --journey recruiter-crud --headed
```

无需真实后端的快速检查：

```bash
npm run test:agent-browser:unit
npm run test:agent-browser:shell
```

## 报告门与退出码

`UI_VISUAL_GATE=report` 是日常默认：功能、fixture 或清理失败仍失败；视觉漂移写进报告但不把
进程置红。发布门需要视觉漂移也阻断时显式使用 `UI_VISUAL_GATE=enforce`。

| 退出码 | 含义 |
| --- | --- |
| `0` | 功能、fixture、清理通过；report 模式下可能仍有已记录的视觉漂移 |
| `1` | 功能失败、清理失败，或 enforce 模式下的视觉漂移 |
| `2` | 参数、产物形状或报告生成错误 |
| `75` | Docker、端口、浏览器、依赖栈或渲染环境等基础设施阻塞 |

每轮产物位于 `agent-browser-backend-output/<run-id>/`：

- `report.json` / `report.md`：最终分类、旅程、fixture 与视觉结果；
- `run-manifest.json`：前后端提交、浏览器版本和冻结取景环境；
- `visual/current/`：本轮七张候选图；
- `visual/diff/`：发生像素漂移时的差异图；
- `visual/baseline-review/`：仅在允许的 `--update-baseline` 候选流程中生成；
- `diagnostics/`：失败快照；敏感字面量扫描不通过时会删除对应产物。

`agent-browser-backend-output/` 已被 gitignore，不要提交报告、私密 journal 或后端 run receipt。

## 覆盖范围

四条旅程分别验证：候选数据加载、候选 CRUD、招聘数据加载、招聘 CRUD；`all` 还执行候选/招聘
双会话隔离门。视觉场景固定为：

1. `candidate-resume-loaded`
2. `candidate-intentions-loaded`
3. `candidate-disclosure-loaded`
4. `candidate-resume-updated`
5. `recruiter-card-loaded`
6. `recruiter-company-loaded`
7. `recruiter-jobs-after-create`

本验收不证明 AI 推理、匹配质量或异步 MatchCase 业务正确；这些属于后端集成层与 L3 全局测试。
长期浏览器脚本默认不使用 network route mock、HAR、浏览器 state save 或视频录制，也不把 OTP、
Cookie 或业务正文写入报告。

以下改动应触发本验收：登录/会话、候选或招聘角色切换、目录选择器、简历/意向/隐私/附件、
招聘名片/企业档案/岗位、BFF 请求映射、fixture 收敛/清理、Vite proxy、浏览器或截图环境、以及七个
场景涉及的 UI/样式变更。

## 基线候选流程

普通运行永不改写已提交基线。确需建立或更新基线时：

```bash
AGXP_MONOREPO_DIR="$AGXP_MONOREPO_DIR" UI_VISUAL_GATE=report \
  npm run test:agent-browser:backend-local -- --journey all --update-baseline
```

只有功能旅程、fixture verify 和 cleanup 全部通过，运行器才会在本轮
`visual/baseline-review/` 生成七张 PNG 与候选 `基线清单.json`。逐张人工确认：业务标记正确、
390×844、完整水合，且没有 OTP、toast、倒计时、弹层、解析 spinner、相对时间、私密信息、空白页、
加载页或错误页；文件清单必须恰好等于上述七场景。审阅通过后才显式复制到：

```text
e2e/真实后端/视觉/基线/*.png
e2e/真实后端/视觉/基线清单.json
```

复制后重新跑 `npm run test:agent-browser:unit` 和完整真实整栈验收；七场景应全部为 `pass`，再提交
PNG 与清单。失败运行和未经人工审阅的候选图不得覆盖仓库基线。

### 浏览器渲染器升级

浏览器或 `agent-browser` 版本与清单不一致时，普通运行保持 `INFRA_BLOCKED`，避免把环境变化误报
成产品像素漂移。使用上面的 `--journey all --update-baseline` 重跑；预期仍退出 `75`，但在安全的
renderer-only 变化下会额外生成七文件审阅目录与 `environment-review.json`，其中只记录旧/新渲染器
元数据。人工审完全部图片后，显式安装并提交新的候选清单和 PNG。

不要只删除 `基线清单.json` 来伪装首次 bootstrap；不要接受只有部分 PNG 的基线。清单损坏、场景
缺失或半套基线都应先修复为完整一致的基线集。

## 清理失败恢复

运行器使用后端首次 converge 生成的 0600 run receipt 精确清理由本轮创建的 fixture 对象。若收尾
失败，它会打印两类路径：

- 前端本轮私密 cleanup journal：人读证据，不能作为算子输入；
- 后端 run receipt：`browser-fixture.sh cleanup --ledger` 的唯一合法输入。

先保留两者，不要按名称手工批量删除，更不要在没有 receipt 时猜测 fixture 对象。修好后端/数据库
健康状态后，使用打印出的精确 receipt：

```bash
BROWSER_FIXTURE_RUN_ID="manual-cleanup-$(date -u +%Y%m%dT%H%M%SZ)" \
  "$AGXP_MONOREPO_DIR/apps/recruitment/scripts/browser-fixture.sh" \
  cleanup --ledger /exact/printed/backend-receipt.json
```

每次 fixture 算子调用必须使用全新的 `BROWSER_FIXTURE_RUN_ID`。清理完成后再跑一次完整验收，让
开场 converge/verify 确认专用账号已回到基准；只有报告确认 cleanup PASS 后才删除残留 journal/receipt。

## 常见阻塞

- `localhost:5173 已被占用`：关闭占用者；不要改端口。
- 浏览器 locale/timezone 不匹配：关闭旧验收会话，确保专属 daemon 以 `zh-CN` / Asia/Shanghai
  启动；不要在另一套环境生成基线。
- `down_status=0 kind=transport`：检查 BFF 日志、平台 server/worker 与其数据库，不要用前端延时
  掩盖下游瞬断。
- bootstrap 因 `.local-dev/browser-fixtures` 拒绝：当前运行器自带挪出再归回的兼容路径；若归回
  失败，按阻塞信息恢复精确目录后再运行。
- `清理未完成`：按上一节使用打印出的 receipt；私密 journal 只用于核对，不传给后端算子。
