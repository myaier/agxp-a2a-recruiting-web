# 2026-09-08 Agent Browser Dogfood 入口迁移 — 实施记录

**执行者**：新实施会话（Claude）。**工作区**：`/home/yzb/.paseo/worktrees/2xxksg7i/kind-impala`，分支 `agent-browser-dogfood-entry`。
**契约**：批准 Spec r2（revision `082aa94b6851c596e9c17856a4eee769b7e6ef51`，blob 核验一致）+ Plan r2（revision `ab0249832b2ff87b413a34ddbef581b3b44d8985`）+ execution contract。
**实施前基线 HEAD**：`bd45565ea54b4a6f6ee7c491c231e7f664e9c4a7`；任务意图 `7400194a`。

## Task 1：原子迁移（完成）

**迁移提交**：`4f7c5ef test: replace legacy backend runners with agent dogfood guide`（40 files，+587/−7595）。

- 新增 `docs/dogfood/真实后端行为验收.md`（入口/启动提示词/准备/环境/receipt v2/操作方式/九类场景卡/七视觉位置/判定/清理）与 `docs/dogfood/真实后端报告模板.md`（NOT_RUN 初始、H01 两轮、清理单列）。
- PDF 经 `git mv` 至 `docs/dogfood/resources/`（diff R100 字节一致）；`e2e/真实后端/` 29 文件与 `tsconfig.e2e.json` 删除。
- `package.json` 恰去四键；`tsconfig.json` 去引用；`playwright.config.ts` 仅清失效注释（testIgnore 保持）；`.gitignore` 两条忽略保持、仅改注释；README 章节改路由并标注退役；旧指南改入口说明；onboarding 加范围区分互链；CLAUDE.md 加共享路由（AGENTS.md 经由 CLAUDE.md 无需改）。

### 定向验证（V1–V4，同一候选各一次）

| ID | 命令/核对 | 结果 |
| --- | --- | --- |
| V1 | Plan 冻结脚本 + `git diff --check` + 链接核对 + 受保护路径 diff | PASS（四键精确删除、PDF 同字节、`rg` 语义核对仅剩退役说明、链接全可达、受保护路径 0 改动、模板覆盖完整） |
| V2 | `npm run build` | PASS（36.7s，tsc -b + vite） |
| V3 | `npm test -- e2e/视觉回归/比较器.test.ts e2e/视觉回归/场景.test.ts 脚本/UI回归核心.test.mjs` | PASS（3 files / 11 tests） |
| V4a | `npm run test:e2e -- --list` | PASS：10 tests / 2 files（onboarding 8 + 无闪屏 2） |
| V4b | `npm run test:e2e:data-source -- --list` | PASS：100 tests |
| V4c | `npm run ui:capture -- --list`（需 `UI_CAPTURE_DIR`，见备注） | PASS：18 tests / 1 file（仅采集.spec.ts） |

备注：V4c 直接 `--list` 报 0 用例，系 `采集.spec.ts` 模块加载即校验 `UI_CAPTURE_DIR`（既有行为，非本次改动引入）；以临时目录注入后 18 例与基线一致，目录已清理。

## Task 2：真实演练（部分完成，如实记录 BLOCKED）

**执行路径**：本机为 Linux + 共享 Docker daemon（`userns-remap: default`）。按用户指示安装宿主依赖（Chrome 系统库、make、uidmap 等）并对后端脚本做**未提交**的最小兼容修改，采用独立 rootless Docker daemon 承载后端（不影响同机其他容器），全部自起：

- Server（4 服务）、Hub（标准栈 9 服务）、Recruitment **acceptance** 栈（6 服务，real 模式）全部 healthy；五账号 bootstrap 完成；BFF :8097 健康。
- 前端按指南命令起 5173（200）；agent-browser 0.27.0 托管 Chrome headless 打开登录页。
- **真实 UI 登录链路 PASS**（截图留本地报告）：fixture 候选账号（号码见后端 allowlist，不入库）→ mock-sms 下发 OTP（值只从本地材料读取输入浏览器，不入库）→ 协议 → 进入 → 角色选择页。首次 401 系执行者误把 `+86` 前缀一并输入（应用侧要求 11 位裸号），修正后成功，已如实记录。
- `converge --scene baseline` FAILED `acceptance_unavailable`：Hub acceptance 腿在 rootless 下的结构性冲突（合同要求 Core 以宿主 uid 运行 + bind 挂载 mode-0600 密钥；userns 映射使「宿主可读」与「容器内 uid 可读」不可同时成立）。**B02 业务节点、H01 两次、H04 因此 BLOCKED**；receipt 为半路空壳、无差集，cleanup 不涉及。
- 三候选修复方案（阶段拷贝副本 / root 运行 / daemon 去 userns-remap）已记录于本地报告第 9 节，交后端 owner 裁决；裁决后演练可从 converge 直接续跑（环境与账号保持就绪）。

**期间对后端仓库（`~/agxp-monorepo`，detached HEAD `f38492581`）的未提交修改**（用户逐项授权的 GNU/rootless 最小兼容）：`recruitment/scripts/dev-local.sh`（file_mode、4 探针用户）、`server/scripts/local-env.sh`（file_mode）、`hub/scripts/dev-mt-local.sh`（private_file_mode、URL 校验加 `http://litellm:*`）、`hub/scripts/deploy-mt-local.sh`（file_mode×2、mktemp×16、set -u 预声明、ensure compose run 用户）、`hub/scripts/deploy-local.sh`（mktemp×5、file_mode×1）。**均未提交，待 owner 审阅**。

### 运行产物

- 本地私密报告与截图：`dogfood-output/20260908-migration-drill/`（已 gitignore，不提交）。
- 可提交脱敏摘要：`docs/runs/2026-09-08-agent-browser-dogfood-migration.md`。

## Peer review 与 final gate

**Peer review（Claude reviewer，只读，2 轮结束）**

- 第 1 轮（候选 `f2dcbbe`）：F1 `契约违反`/Minor/required——实施记录把一次登录 OTP 字面量与 fixture 手机号写入受版本控制文件，违反 Spec §7 无条件证据卫生规则（该值为固定 mock 码、仅作用公开测试号，无实际泄露）。裁决：接受；提交 `459c714` 删除字面量并同步清理本地 report.md（不重写历史）。F2 `真实缺陷`/Minor/optional——模板 §11 摘要命名固定「-migration」后缀，泛化为 `<主题>`。裁决：接受，同提交修复。
- 第 2 轮（候选 `459c714`）：reviewer 独立复核（`git grep` 排除冻结历史文档 0 命中、本地报告 0 命中、修复无夹带、证据链无损失），两条修复成立、无新事实、无重开项。reviewer 报告以「无发现」实质收尾（形式与字面 `NO FINDINGS` 的差异由接收方记录并采纳，不影响实质结论）。
- 无未解决的 required finding；review 循环结束（2/3 轮）。

**Final gate 方案**（详见与用户的确认记录；未获确认前未 fetch/merge/push）。
