# Agent Browser 真实本地后端整栈验收实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一条可重复运行的本地整栈验收：启动或复用 Recruitment 完整 local stack，幂等收敛专用业务数据，以 `backend/local` 启动前端，再由 `agent-browser` 完成候选端和招聘端的数据加载、CRUD、会话隔离与七个像素基线检查。

**Architecture:** 后端 `browser-fixture.sh` 只通过真实 BFF API 和受控 internal review 收敛/验证/清理专用账号数据；前端 Bash 入口负责资源 ownership、两个隔离浏览器 session、四条上层旅程与运行证据。视觉层复用现有 `pixelmatch` 比较核心，但使用独立的真实后端 manifest、reference、candidate 和 diff，不与 Mock 视觉回归混合。

**Tech Stack:** Bash 3.2+、Node.js ESM、TypeScript 6、Vitest 4、Vite 8、`agent-browser` CLI 0.27.2、Chrome、`jq`、`curl`、Docker Compose、`pixelmatch`、`pngjs`。

**Spec:** `docs/superpowers/specs/2026-08-29-agent-browser-real-backend-e2e-design.md`

## Global Constraints

- 前端实施基线冻结为 `agxp-a2a-recruiting-web origin/main@aa467312353eabc5a5445a333a751418c47c442a`；执行 Task 1 前先 fetch 并确认当前 implementation worktree 已包含该提交。
- 后端实施基线冻结为 `agxp-monorepo origin/release/0.2.5@34306f539`，不是后端 `origin/main`；当前前端依赖的公司档案、隐私、附件解析、P4/P5 接口与 `+8613800000001..00005` local 账号都在该发布线上。执行前必须 fetch 并重新核对目标发布线；若接口或固定账号已迁移，先更新本计划与 Spec 的事实基线，不在代码里兼容两套历史合同。
- 后端改动必须在从 `origin/release/0.2.5` 创建的独立 worktree 中完成；不得修改或清理 `/Users/visionclaw/agxp-monorepo` 当前 dirty checkout。
- 页面 Origin 固定为 `http://localhost:5173`，BFF 固定为 `http://127.0.0.1:8097`；不得把页面改成 `127.0.0.1:5173`，不得换端口绕过占用。
- 固定测试账号为候选 `+8613800000001`、招聘 `+8613800000002`，页面输入其 11 位国内号码；本地四位 OTP 从后端 local material 读取并只传给浏览器输入，不进入报告、命令回显、截图说明或持久化 state。
- 不使用 `agent-browser network route`、Playwright `page.route`、service worker stub、HAR、`state save`、持久化 Chrome profile 或 Cookie 导出。
- 浏览器交互优先使用 role、label、heading、可见业务词；`@eN` 只允许人工调试，长期脚本不得保存 snapshot ref、CSS module class、DOM 层级或坐标。
- 业务硬门只断言播种对象可见、操作结果可见、刷新后仍成立、删除后仍不存在；不重复断言 HTTP 次数/顺序、body、headers、ETag、Idempotency-Key 或 toast 原文。
- 固定 viewport `390x844`、`zh-CN`、`Asia/Shanghai`、light、reduced motion、device scale 1；截图前等待业务 ready、`document.fonts.ready` 和两帧 `requestAnimationFrame`，并关闭 animation、transition、caret。
- 七个视觉场景固定为 `candidate-resume-loaded`、`candidate-intentions-loaded`、`candidate-disclosure-loaded`、`candidate-resume-updated`、`recruiter-card-loaded`、`recruiter-company-loaded`、`recruiter-jobs-after-create`；截图可见临时文案使用固定保留名称，run ID 只进私有 journal/receipt。
- 视觉阈值复用现有值：warning `0.005`、blocking `0.05`、最大位移 `16px`、最大尺寸变化比例 `0.15`、pixelmatch threshold `0.2`。默认 `UI_VISUAL_GATE=report`；只有显式 `enforce` 才让 blocked drift 返回 1。
- 运行产物写入 `agent-browser-backend-output/` 并 gitignore；基线写入 `e2e/真实后端/视觉/基线/` 并提交。失败运行不得覆盖已提交基线。
- 退出码固定：`0` 通过；`1` 功能、清理或 enforce 视觉失败；`2` usage/report 错误；`75` 环境阻塞。
- 后端 fixture 不执行业务数据库 SQL、不 reset 数据库、不删除卷、不清理非 fixture 数据。唯一允许的 operator 侧写是已有 internal organization review；Hub bootstrap 的既有窄 SQL 例外仍只属于 `dev-local.sh bootstrap`。
- 第一版不把 AI/匹配异步生命周期作为硬门，不录制默认视频，不加入普通 `npm test` 或 hosted PR CI，不创建通用场景 DSL。

---

## File Map

### 后端仓库 `agxp-monorepo`

**Create**

- `apps/recruitment/scripts/browser-fixture.sh`：`converge|verify|cleanup` 唯一 fixture operator；登录专用账号、查询 Catalog、收敛候选/招聘业务事实、执行受控组织审批、清理本轮临时对象。
- `apps/recruitment/scripts/tests/test-browser-fixture-source.sh`：静态安全合同，禁止 SQL/reset/secret 回显，冻结命令、账号、Origin、ownership 与 internal-review 形状。
- `apps/recruitment/scripts/tests/test-browser-fixture-fake-runtime.sh`：PATH shim 驱动真实 operator，覆盖首次收敛、幂等重放、目录歧义、失败清理与 receipt hygiene。

**Modify**

- `tests/test-suites.json`：注册 `recruitment-browser-fixture-source` L0 suite，使 `tools/test service/affected` 能正式运行两个 hermetic shell tests。
- `apps/recruitment/README.md`：记录 fixture operator 是 local/test-only、专用账号、非 reset、命令与安全边界。

### 前端仓库 `agxp-a2a-recruiting-web`

**Create**

- `e2e/真实后端/类型.ts`：journey、visual、cleanup、manifest 与总报告的可序列化类型。
- `e2e/真实后端/报告.ts`：读取分片、分类 verdict、计算最终退出码、写 JSON/Markdown。
- `e2e/真实后端/报告.test.ts`：退出码优先级、缺失/损坏分片、report/enforce、隐私字段测试。
- `e2e/真实后端/公共步骤.sh`：固定的 `agent-browser` session、登录、语义定位、刷新回读、稳定截图、诊断与私有 cleanup ledger 操作；不是 DSL。
- `e2e/真实后端/公共步骤.test.sh`：fake `agent-browser` 验证 session 隔离、无 route/HAR/state、截图稳定化与脱敏摘要。
- `e2e/真实后端/旅程/候选数据加载.sh`：候选加载旅程和前三张 candidate reference candidate 截图。
- `e2e/真实后端/旅程/候选CRUD.sh`：简历姓名、意向、隐私、附件完整 UI 生命周期和 `candidate-resume-updated` 截图。
- `e2e/真实后端/旅程/招聘数据加载.sh`：招聘名片、企业档案、岗位加载旅程和两张 recruiter 截图。
- `e2e/真实后端/旅程/招聘CRUD.sh`：招聘名片、公司简介、岗位发布/编辑/归档/重开/删除和 `recruiter-jobs-after-create` 截图。
- `e2e/真实后端/视觉/场景清单.ts`：七个稳定场景 ID、图片文件名与 manifest 约束。
- `e2e/真实后端/视觉/比较.ts`：调用现有 `比较图片()`，校验环境 manifest，生成真实后端 visual result。
- `e2e/真实后端/视觉/比较.test.ts`：七场景、环境漂移、阈值边界、report/enforce、基线更新保护测试。
- `e2e/真实后端/视觉/基线清单.json`：提交的 reference 环境清单。
- `e2e/真实后端/视觉/基线/*.png`：在 Task 8 的真实整栈 bootstrap 运行中生成并人工审阅的七张 reference。
- `tsconfig.e2e.json`：只覆盖 `e2e/真实后端/**/*.ts` 的 Node/DOM 类型检查项目。
- `e2e/真实后端/资源/简历-v1.pdf`、`e2e/真实后端/资源/简历-v2.pdf`：无真实个人信息、用于 create/replace 的小型合法 PDF。
- `e2e/真实后端/运行整栈验收.sh`：唯一总入口；preflight、资源 ownership、stack/Vite/session 生命周期、journey 调度、visual/cleanup/report。
- `e2e/真实后端/运行整栈验收.test.sh`：fake backend/Vite/agent-browser 的编排合同测试。
- `docs/AgentBrowser真实后端验收.md`：前置、命令、结果、视觉审批、故障分类、测试频率和非目标。

**Modify**

- `package.json`：加入 `test:agent-browser:backend-local` 与纯报告/视觉测试脚本，不改普通 `test` 的语义。
- `.gitignore`：加入 `/agent-browser-backend-output/`。
- `tsconfig.json`：引用 `tsconfig.e2e.json`，让现有 `npm run typecheck` 真正覆盖新增 TypeScript。
- `src/屏幕/披露偏好.tsx`：给每个披露档按钮补字段化 `aria-label` 与 `aria-pressed`，不改变视觉。
- `src/屏幕/披露偏好.test.tsx`：冻结可访问名称与选中状态。

## Stable Interfaces

后续任务只使用以下名称和 wire shape，不另造同义接口。

### 后端 CLI

```text
apps/recruitment/scripts/browser-fixture.sh converge
apps/recruitment/scripts/browser-fixture.sh verify
apps/recruitment/scripts/browser-fixture.sh cleanup --ledger "$PRIVATE_LEDGER"
```

环境：

```text
BROWSER_FIXTURE_FRONTEND_DIR="$FRONTEND_WORKTREE"
BROWSER_FIXTURE_RUN_ID=20260829T123456Z-ab12cd
```

成功 stdout 只允许安全终止行：

```text
BROWSER_FIXTURE_CONVERGE PASS
BROWSER_FIXTURE_VERIFY PASS
BROWSER_FIXTURE_CLEANUP PASS removed_intentions=N removed_files=N removed_jobs=N
```

失败前缀与退出码：`BLOCKED:`→75、`FAIL:`→1、`usage:`→64（前端 runner 映射为 usage 2）。stdout/stderr 不输出 Cookie、OTP、手机号、response body、raw internal ID、private preference、evidence filename 或 bearer。

### 私有 cleanup journal 与后端 run receipt

运行器创建 mode 0700 的 `$RUN_DIR/private/` 和 mode 0600 的 journal；cleanup 成功后立即删除该目录，不进入 artifacts：

```json
{
  "schema_version": 1,
  "run_id": "20260829T123456Z-ab12cd",
  "candidate_intention_created": false,
  "candidate_resume_file_names": [],
  "recruiter_job_titles": []
}
```

journal 只记录浏览器已完成的业务里程碑和固定保留的临时名称，不保存 raw ID。run ID 只用于关联后端 gitignored 的 `apps/recruitment/.local-dev/browser-fixtures/$RUN_ID.json` mode-0600 receipt；receipt 记录开始时间以及两个专用账号在旅程前拥有的意向、附件和岗位 ID。`cleanup` 重新读取 owner list，与 receipt 做精确差集：附件和岗位还必须匹配固定完整文件名/标题；意向必须是 pre-state 中不存在且完整业务签名等于本轮临时表单的唯一一条。零条表示 UI 已删除，多条、未知新增对象、foreign owner 或签名不符都立即失败。成功后删除 journal、receipt；下一次 `converge` 先以同样规则回收遗留 receipt，不扩大搜索，也不输出 ID。

### 前端报告类型

```ts
export type 旅程ID =
  | 'candidate-load'
  | 'candidate-crud'
  | 'recruiter-load'
  | 'recruiter-crud'
  | 'session-isolation';

export type 失败分类 =
  | 'PASS'
  | 'INFRA_BLOCKED'
  | 'FUNCTIONAL_FAILED'
  | 'VISUAL_DRIFT'
  | 'CLEANUP_FAILED'
  | 'USAGE_ERROR';

export interface 旅程结果 {
  schemaVersion: 1;
  journey: 旅程ID;
  status: 'pass' | 'failed' | 'blocked' | 'skipped';
  milestone: string;
  apiRequests: string[];        // 仅 METHOD + pathname
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];     // 仅 METHOD + pathname
  screenshots: string[];        // 仓库相对 artifact 路径
  failure: string | null;       // 脱敏业务摘要
}

export interface 真实后端视觉Manifest {
  schemaVersion: 1;
  agentBrowserVersion: string;
  chromeBuild: string;
  viewport: { width: 390; height: 844 };
  locale: 'zh-CN';
  timezone: 'Asia/Shanghai';
  colorScheme: 'light';
  deviceScaleFactor: 1;
  scenes: string[];
  baselineCommit: string;
}

export interface 视觉结果 {
  schemaVersion: 1;
  gate: 'report' | 'enforce';
  environment: 'matched' | 'bootstrap' | 'blocked';
  scenes: Array<{
    sceneId: string;
    status: 'pass' | 'warning' | 'blocked' | 'missing';
    pixelDiffRatio: number | null;
    reference: string | null;
    candidate: string | null;
    diff: string | null;
    reasons: string[];
  }>;
}

export interface 整栈报告 {
  schemaVersion: 1;
  classification: 失败分类;
  exitCode: 0 | 1 | 2 | 75;
  frontendCommit: string;
  backendCommit: string;
  agentBrowserVersion: string;
  chromeBuild: string;
  stack: { preexisting: boolean; healthy: boolean };
  fixture: { converge: string; verify: string; cleanup: string };
  journeys: 旅程结果[];
  visual: 视觉结果;
}
```

---

### Task 1: 建立后端 fixture operator 外壳与正式测试入口

**Repository:** `agxp-monorepo` 独立 worktree，base `origin/release/0.2.5@34306f539`。

**Files:**
- Create: `apps/recruitment/scripts/browser-fixture.sh`
- Create: `apps/recruitment/scripts/tests/test-browser-fixture-source.sh`
- Create: `apps/recruitment/scripts/tests/test-browser-fixture-fake-runtime.sh`
- Modify: `tests/test-suites.json`

**Interfaces:**
- Consumes: `apps/recruitment/scripts/dev-local.sh health|bootstrap` 已健康后的 BFF、`jq`、`curl`、Docker CLI。
- Produces: Stable Interfaces 中 `converge|verify|cleanup` CLI、私有 cookie jars、`bff_request()`、`login_account()`、`logout_all()`、`resolve_catalog_exactly_one()`。

- [ ] **Step 1: 创建后端 implementation worktree 并校准发布线**

Run from a clean clone of `agxp-monorepo`:

```bash
git fetch origin release/0.2.5
git worktree add ../agxp-browser-fixture -b agent-browser-real-backend-fixture origin/release/0.2.5
cd ../agxp-browser-fixture
tools/cred-sync.sh worktree
tools/dev-env.sh ensure base
git rev-parse HEAD
git grep -n "BOOTSTRAP_PHONES='+8613800000001" -- apps/recruitment/scripts/dev-local.sh
git grep -n '/api/v1/organizations/{organization_id}/profile' -- apps/recruitment-bff/openapi/mobile-v1.yaml
```

Expected: HEAD contains `34306f539`; both contract probes return one match. If the target branch advanced, record the new SHA in the implementation handoff and rerun both probes before editing.

- [ ] **Step 2: 写 source contract 的失败测试**

Create `test-browser-fixture-source.sh` with these exact assertions:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
SCRIPT="$ROOT/apps/recruitment/scripts/browser-fixture.sh"
fail(){ printf 'FAIL: %s\n' "$*" >&2; exit 1; }

[ -x "$SCRIPT" ] || fail 'browser fixture operator missing or not executable'
for command in converge verify cleanup; do
  grep -Fq "$command)" "$SCRIPT" || fail "command missing: $command"
done
for literal in 'http://127.0.0.1:8097' 'http://localhost:5173' \
  '+8613800000001' '+8613800000002' 'BROWSER_FIXTURE_RUN_ID' \
  'BROWSER_FIXTURE_CONVERGE PASS' 'BROWSER_FIXTURE_VERIFY PASS' 'BROWSER_FIXTURE_CLEANUP PASS'; do
  grep -Fq "$literal" "$SCRIPT" || fail "contract literal missing: $literal"
done
grep -Fq 'mktemp -d' "$SCRIPT" || fail 'private cookie directory missing'
grep -Fq 'chmod 700' "$SCRIPT" || fail 'private directory mode missing'
grep -Fq 'chmod 600' "$SCRIPT" || fail 'private file mode missing'
! grep -Eq 'psql|recruitment_pg|DROP[[:space:]]|TRUNCATE[[:space:]]|down[[:space:]]+--volumes|docker[[:space:]]+volume[[:space:]]+rm' "$SCRIPT" \
  || fail 'business SQL/reset/volume deletion is forbidden'
! grep -Eq '(^|[[:space:]])(-k|--insecure)([=[:space:]]|$)|network route|network har|state save' "$SCRIPT" \
  || fail 'insecure or mocked browser behavior is forbidden'
printf 'PASS: browser fixture source contract\n'
```

- [ ] **Step 3: 运行失败测试**

Run:

```bash
bash apps/recruitment/scripts/tests/test-browser-fixture-source.sh
```

Expected: FAIL with `browser fixture operator missing or not executable`.

- [ ] **Step 4: 创建最小 operator 外壳**

Create executable `browser-fixture.sh` with this command boundary and finalizer:

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$APP_DIR/../.." && pwd)"
DEV="$APP_DIR/scripts/dev-local.sh"
BFF='http://127.0.0.1:8097'
ORIGIN='http://localhost:5173'
CANDIDATE_PHONE='+8613800000001'
RECRUITER_PHONE='+8613800000002'
RUN_ID="${BROWSER_FIXTURE_RUN_ID:-}"
PRIVATE_DIR=''

blocked(){ printf 'BLOCKED: %s\n' "$*" >&2; exit 75; }
fail(){ printf 'FAIL: %s\n' "$*" >&2; exit 1; }
usage(){ printf 'usage: %s converge|verify|cleanup [--ledger ABSOLUTE_PATH]\n' "$0" >&2; exit 64; }

finish(){
  local rc=$?
  trap - EXIT HUP INT TERM
  if [ -n "$PRIVATE_DIR" ]; then
    logout_all || { [ "$rc" -ne 0 ] || rc=1; }
    rm -rf -- "$PRIVATE_DIR"
  fi
  exit "$rc"
}
trap finish EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

require_ready(){
  [ -n "$RUN_ID" ] || blocked 'BROWSER_FIXTURE_RUN_ID is required'
  "$DEV" health >/dev/null || blocked 'Recruitment local stack is unhealthy'
  command -v jq >/dev/null || blocked 'jq is missing'
  command -v curl >/dev/null || blocked 'curl is missing'
  PRIVATE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/agxp-browser-fixture.XXXXXX")"
  chmod 700 "$PRIVATE_DIR"
}

case "${1:-}" in
  converge) require_ready; converge; printf 'BROWSER_FIXTURE_CONVERGE PASS\n' ;;
  verify) require_ready; verify; printf 'BROWSER_FIXTURE_VERIFY PASS\n' ;;
  cleanup) shift; require_ready; cleanup "$@" ;;
  *) usage ;;
esac
```

Define the named functions above the `case`. Task 1 tests only usage、preflight、private-directory permissions、finalizer and safe failure classification; candidate/recruiter behavior is added test-first in Tasks 2–3. Do not register a known-failing suite or commit an unfinished stub.

- [ ] **Step 5: 注册正式 L0 suite**

Add this object immediately after `recruitment-hub-source` in `tests/test-suites.json`:

```json
{
  "id": "recruitment-browser-fixture-source",
  "owner": "recruitment",
  "layer": "L0",
  "resource_class": "none",
  "modules": ["recruitment"],
  "workdir": ".",
  "command": [
    "bash",
    "-c",
    "bash apps/recruitment/scripts/tests/test-browser-fixture-source.sh && bash apps/recruitment/scripts/tests/test-browser-fixture-fake-runtime.sh"
  ],
  "timeout_seconds": 180
}
```

Create the fake-runtime test as an executable hermetic test for the implemented Task 1 boundary only: unknown command remains 64 without calling logout, missing run ID 75, unhealthy stack 75, private directory mode 0700, logout finalizer, HUP/INT/TERM remain non-zero, and no secret-shaped output. Candidate/recruiter scenario cases are appended in Tasks 2–3.

- [ ] **Step 6: 验证 source test 与正式 suite 转绿**

Run:

```bash
bash apps/recruitment/scripts/tests/test-browser-fixture-source.sh
tools/test service recruitment --suite recruitment-browser-fixture-source
```

Expected: source contract and Task 1 boundary suite PASS.

- [ ] **Step 7: 提交 operator contract**

```bash
git add apps/recruitment/scripts/browser-fixture.sh \
  apps/recruitment/scripts/tests/test-browser-fixture-source.sh \
  apps/recruitment/scripts/tests/test-browser-fixture-fake-runtime.sh \
  tests/test-suites.json
git commit -m "test(recruitment): define browser fixture operator contract"
```

---

### Task 2: 实现候选账号与共享 Catalog 的幂等收敛

**Repository:** `agxp-monorepo` backend worktree。

**Files:**
- Modify: `apps/recruitment/scripts/browser-fixture.sh`
- Modify: `apps/recruitment/scripts/tests/test-browser-fixture-fake-runtime.sh`

**Interfaces:**
- Consumes: Task 1 CLI 与 private directory。
- Produces: `candidate_converge()`、`candidate_verify()`、`cleanup_candidate()`；candidate baseline summary `浏览器验收候选人`、一条 active intention、固定 privacy snapshot、附件空余至少两槽，以及 mode-0600 run receipt 的 candidate pre-state。

- [ ] **Step 1: 写 candidate fake-runtime 场景**

Fake `curl` 必须按 URL + method 回答，并把安全摘要写入 call log。加入以下场景断言：

```bash
run converge
[ "$rc" -eq 0 ] || fail "candidate converge failed: $(cat "$OUT")"
grep -Fq 'BROWSER_FIXTURE_CONVERGE PASS' "$OUT" || fail 'converge terminal line missing'
[ "$(count_call 'PATCH /api/v1/me/resume/profile')" -eq 1 ] || fail 'candidate profile not converged once'
[ "$(count_call 'PATCH /api/v1/me/resume/summary')" -eq 1 ] || fail 'candidate summary not converged once'
[ "$(count_call 'POST /api/v1/me/intentions')" -eq 1 ] || fail 'candidate baseline intention not created'
[ "$(count_call 'PATCH /api/v1/me/privacy')" -eq 1 ] || fail 'candidate privacy not converged'

reset_calls
run converge
[ "$rc" -eq 0 ] || fail 'candidate replay failed'
[ "$(count_call 'POST /api/v1/me/intentions')" -eq 0 ] || fail 'replay duplicated intention'

FAKE_CATALOG_MATCHES=0 run verify
[ "$rc" -eq 75 ] || fail 'zero catalog match must block'
FAKE_CATALOG_MATCHES=2 run verify
[ "$rc" -eq 75 ] || fail 'ambiguous catalog match must block'
```

The fake must reject any request that omits exact Origin on mutation, uses a non-0600 cookie jar, sends an idempotency key shorter than 16 bytes, or prints response bodies/phone/OTP to output.

- [ ] **Step 2: 实现共享登录与请求 helper**

Use a per-account cookie jar; never return the cookie value:

```bash
login_account(){
  local key="$1" phone="$2" jar="$PRIVATE_DIR/$key.cookies" attempt code
  (umask 077; : >"$jar")
  chmod 600 "$jar"
  attempt="$(jq -nc --arg phone "$phone" '{provider:"phone_otp",input:{phone:$phone}}' |
    curl -fsS -c "$jar" -b "$jar" -H "Origin: $ORIGIN" \
      -H "Idempotency-Key: browser-fixture-$RUN_ID-$key-login" \
      -H 'Content-Type: application/json' --data-binary @- \
      "$BFF/api/v1/auth/login-attempts" | jq -er '.result.attempt_id')" || fail 'login begin failed'
  code="$(cat "$APP_DIR/.local-dev/code")" || blocked 'local OTP material is missing'
  jq -nc --arg code "$code" '{proof:{code:$code}}' |
    curl -fsS -c "$jar" -b "$jar" -H "Origin: $ORIGIN" \
      -H "Idempotency-Key: browser-fixture-$RUN_ID-$key-complete" \
      -H 'Content-Type: application/json' --data-binary @- \
      "$BFF/api/v1/auth/login-attempts/$attempt/complete" >/dev/null || fail 'login complete failed'
  printf '%s' "$jar"
}

bff_request(){
  local method="$1" path="$2" jar="$3" body="${4:-}" if_match="${5:-}" idem="${6:-}"
  local args=(-fsS -c "$jar" -b "$jar" -X "$method")
  [ "$method" = GET ] || args+=(-H "Origin: $ORIGIN")
  [ -z "$if_match" ] || args+=(-H "If-Match: \"$if_match\"")
  [ -z "$idem" ] || args+=(-H "Idempotency-Key: $idem")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' --data-binary @-)
    printf '%s' "$body" | curl "${args[@]}" "$BFF$path"
  else
    curl "${args[@]}" "$BFF$path"
  fi
}
```

`logout_all()` iterates only `$PRIVATE_DIR/*.cookies`, POSTs `/api/v1/auth/logout` with exact Origin, then truncates the jar. It must tolerate an already-revoked session but turn transport failures into cleanup failure.

- [ ] **Step 3: 实现 Catalog 唯一解析**

Resolve fixed display names through real `/api/v1/catalog/*?q=` calls. The function must select `status=active` and `selectable=true`, require exactly one exact `display_name` match, and return only the opaque ID to the caller:

```bash
resolve_catalog_exactly_one(){
  local jar="$1" path="$2" display="$3" encoded body count
  encoded="$(jq -nr --arg v "$display" '$v|@uri')"
  body="$(bff_request GET "$path?q=$encoded&limit=50" "$jar")" || blocked 'catalog request failed'
  count="$(jq -r --arg d "$display" '[.result.items[]|select(.display_name==$d and .status=="active" and .selectable==true)]|length' <<<"$body")"
  [ "$count" = 1 ] || blocked 'catalog fixture did not resolve exactly one selectable item'
  jq -er --arg d "$display" '.result.items[]|select(.display_name==$d and .status=="active" and .selectable==true)|.id' <<<"$body"
}
```

The exact display names are taken from the live seeded Catalog after inspecting the response once during implementation, then frozen in the source test. Do not choose `.items[0]` and do not persist raw IDs.

- [ ] **Step 4: 实现 candidate converge**

Algorithm, with every write using the revision just read:

```text
reconcile stale run receipts with the same fail-closed delta rules
login candidate → ensure candidate role → set last-used-role candidate
GET resume → PATCH profile, summary, skills to fixed baseline
GET intentions → keep/update exactly one fixture intention; remove only duplicate fixture-owned intentions; block on every non-baseline row rather than treating a dedicated test account as disposable
GET privacy → PATCH employer/disclosure fixed baseline
GET resume-files → delete only the reserved exact name "浏览器验收临时简历.pdf" when a stale receipt proves it is a post-state delta; otherwise block; require available_slots >= 2
atomically write candidate owner IDs + started_at to the current run receipt with mode 0600
```

Use these frozen baseline facts:

```json
{
  "profile": { "real_name": "浏览器验收候选人", "work_start_year": 2020, "status": "employed" },
  "summary": "浏览器验收候选人 · 真实后端基准摘要",
  "skills": ["TypeScript", "React", "真实后端验收"],
  "intentionPrivateMarker": "browser-fixture-baseline-candidate",
  "privacy": {
    "employer_privacy_enabled": true,
    "disclosure_preferences": {
      "current_employer": "never",
      "education": "resume_submission",
      "portfolio_links": "resume_submission"
    }
  }
}
```

The intention body uses the exact Catalog IDs returned in Step 3, `social_full_time`, one primary location, `workplace_modes:["hybrid"]`, compensation range `30..45` with 14 months, and the private marker. If the baseline exists, replace it with its current revision; if absent, create once with `browser-fixture-baseline-intention` idempotency key scoped to the fixture account, not the run ID.

Freeze one distinct UI temporary-intention signature in the fake-runtime contract: the exact Catalog refs selected by the journey, `social_full_time`, `hybrid`, 14 months, and compensation `30..45` before edit or `35..45` after edit. Cleanup accepts only those two revision states for the sole post-receipt ID; the baseline is excluded by the receipt pre-state and its private marker.

- [ ] **Step 5: 实现 candidate verify 与 cleanup**

`candidate_verify()` re-reads all four domains and uses `jq -e` to prove the exact baseline, exactly one baseline intention, no temp resume filename prefix, and at least two available file slots. It emits no body.

`cleanup_candidate()` loads the mode-0600 run receipt and current owner lists:

```text
compare current IDs with pre-state IDs from the receipt
zero matching delta means the UI already cleaned it
one new intention must match the exact temporary form signature before DELETE with current revision
one new resume file must equal "浏览器验收临时简历.pdf" before DELETE
unknown/multiple deltas, foreign ownership, signature mismatch or transport failure → FAIL without widening the query
```

After deleting, call `candidate_converge` to restore profile/privacy/baseline intention, then `candidate_verify`. A successful cleanup removes the candidate section from the receipt atomically; a failed cleanup retains it mode 0600 for recovery.

- [ ] **Step 6: 跑 candidate tests**

```bash
bash apps/recruitment/scripts/tests/test-browser-fixture-fake-runtime.sh candidate
tools/test service recruitment --suite recruitment-browser-fixture-source
```

Expected: candidate scene PASS；full suite remains FAIL only on the recruiter scene added in Task 3.

- [ ] **Step 7: 提交 candidate fixture**

```bash
git add apps/recruitment/scripts/browser-fixture.sh \
  apps/recruitment/scripts/tests/test-browser-fixture-fake-runtime.sh
git commit -m "test(recruitment): converge candidate browser fixture"
```

---

### Task 3: 实现招聘账号、组织审批、公司档案与岗位基线

**Repository:** `agxp-monorepo` backend worktree。

**Files:**
- Modify: `apps/recruitment/scripts/browser-fixture.sh`
- Modify: `apps/recruitment/scripts/tests/test-browser-fixture-source.sh`
- Modify: `apps/recruitment/scripts/tests/test-browser-fixture-fake-runtime.sh`
- Modify: `apps/recruitment/README.md`

**Interfaces:**
- Consumes: Task 2 login/request/catalog helpers。
- Produces: `recruiter_converge()`、`recruiter_verify()`、`approve_fixture_organization()`、`cleanup_recruiter()`；固定招聘名片、verified admin affiliation、企业档案、一个 active 和一个 archived baseline job，以及 run receipt 的 recruiter job pre-state。

- [ ] **Step 1: 写 recruiter fake-runtime 失败场景**

Add assertions for first converge, replay and cleanup:

```bash
run converge
[ "$rc" -eq 0 ] || fail "recruiter converge failed: $(cat "$OUT")"
[ "$(count_call 'PATCH /api/v1/recruiter/profile')" -eq 1 ] || fail 'recruiter profile missing'
[ "$(count_call 'POST /api/v1/recruiter/organization-admin-requests')" -eq 1 ] || fail 'admin request missing'
[ "$(count_call 'INTERNAL POST /internal/v1/organization-verification-requests/')" -eq 1 ] || fail 'internal approval missing'
[ "$(count_call 'PATCH /api/v1/organizations/')" -eq 1 ] || fail 'company profile missing'
[ "$(count_call 'POST /api/v1/recruiter/jobs')" -eq 2 ] || fail 'baseline jobs missing'
[ "$(count_call 'POST /archive')" -eq 1 ] || fail 'archived baseline missing'

reset_calls
run converge
[ "$rc" -eq 0 ] || fail 'recruiter replay failed'
[ "$(count_call 'POST /api/v1/recruiter/organization-admin-requests')" -eq 0 ] || fail 'replay duplicated admin request'
[ "$(count_call 'POST /api/v1/recruiter/jobs')" -eq 0 ] || fail 'replay duplicated jobs'
```

Add a failure scene where an exact fixed organization exists but belongs to another fixture identity; expected `BLOCKED` 75 and zero review/job mutation.

- [ ] **Step 2: 实现受控 internal approval**

The persistent Compose file does not publish Recruitment Service. Run a one-shot curl container on the private project network and mount only the Recruitment secret volume:

```bash
approve_fixture_organization(){
  local request_id="$1" body
  body="$(jq -nc '{
    reviewer_ref:"platform:browser-fixture",
    reason:"local browser fixture",
    create_organization:{
      legal_name:"浏览器验收科技有限公司",
      display_name:"浏览器验收科技",
      registry_key:"CN-BROWSER-FIXTURE-0001",
      domains:["browser-fixture.invalid"]
    }
  }')"
  docker run --rm --network agxp-recruitment-dev_default \
    -v agxp-recruitment-dev-recruitment-secrets:/run/agxp/local:ro \
    -e REVIEW_PATH="/internal/v1/organization-verification-requests/$request_id/approve" \
    -e REVIEW_BODY="$body" curlimages/curl:8.8.0 sh -eu -c '
      umask 077
      bearer="$(cat /run/agxp/local/recruitment-internal-bearer)"
      printf "header = \"Authorization: Bearer %s\"\n" "$bearer" > /tmp/review.curlrc
      unset bearer
      rc=0
      curl -fsS --cacert /run/agxp/local/recruitment-ca.pem \
        --config /tmp/review.curlrc -H "Content-Type: application/json" \
        --data "$REVIEW_BODY" "https://recruitment:8448$REVIEW_PATH" || rc=$?
      rm -f /tmp/review.curlrc
      exit "$rc"
    '
}
```

The bearer is read and expanded only inside the one-shot container, the config inherits mode 0600 from `umask 077`, and every curl exit path removes it. The source test must prove the host command line/env never contains bearer contents, `/tmp/review.curlrc` is removed, and `--insecure` is absent.

- [ ] **Step 3: 实现 recruiter converge**

Algorithm:

```text
login recruiter → ensure recruiter role → set last-used-role recruiter
GET/PATCH recruiter profile to public_name="浏览器验收招聘官", title="招聘负责人"
GET affiliations
  verified active admin for exact organization exists → reuse it
  exact pending fixture admin request exists → approve it
  neither exists → POST one fixture request with generated 1x1 PNG evidence, approve it
  exact organization is bound to a different non-fixture identity → BLOCKED
GET/PATCH organization profile to fixed visible baseline
GET owner jobs → converge exactly one active and one archived baseline job
atomically append recruiter owner job IDs to the current mode-0600 run receipt
```

Use the organization profile required fields from `apps/recruitment-bff/openapi/mobile-v1.yaml` and these visible values:

```json
{
  "brand_name": "浏览器验收科技",
  "company_intro": "浏览器验收科技 · 真实后端企业介绍基线",
  "office_address": "上海市浦东新区浏览器路 1 号",
  "business_items": ["招聘协作平台"],
  "product_intro": "用真实数据验证稳定的招聘体验",
  "team_members": []
}
```

Use Catalog IDs resolved by exact display name. Baseline jobs:

```text
浏览器验收岗位 · 在招基线     status=active
浏览器验收岗位 · 归档基线     status=archived
```

Both use no candidate/matchcase relation, deterministic salary/description, and a baseline private marker. Existing exact jobs are patched/reopened/archived to the target state; duplicates with the exact fixture prefix are removed only after owner GET proves they are fixture jobs and have no delete fence.

- [ ] **Step 4: 实现 recruiter verify 与 cleanup**

Verify exact profile, one verified active admin affiliation, exact company intro, exactly one active baseline job and one archived baseline job, and no job named `浏览器验收岗位 · 临时CRUD`.

Cleanup compares the current owner job list with the receipt pre-state, requires the only new row to have title `浏览器验收岗位 · 临时CRUD`, deletes it at current revision, then calls `recruiter_converge` and `recruiter_verify`. Zero delta means the UI already deleted it; unknown or multiple deltas fail closed.

- [ ] **Step 5: 完成 fake runtime 与 source security contract**

The complete fake-runtime test must cover:

- first converge and second converge without duplicate creates;
- `verify` success and a missing baseline failure;
- cleanup with 404 already-clean, exact owned temp delete, and foreign ID refusal;
- logout finalizer on success, functional failure and signal-style exit;
- zero phone/OTP/Cookie/bearer/private body in stdout, stderr and safe call ledger;
- internal review happens only for the fixed organization request.

Run:

```bash
tools/test service recruitment --suite recruitment-browser-fixture-source
```

Expected: PASS.

- [ ] **Step 6: 更新后端 README**

Document exact commands, prerequisites (`dev-local.sh ... bootstrap` first), dedicated account ownership, no reset/SQL, safe internal review, cleanup journal/run-receipt rules, and that this operator is not `recruitment-mobile-local` release evidence.

- [ ] **Step 7: 运行 backend L0–L2 selection**

```bash
BASE_SHA=34306f539
tools/test affected --base "$BASE_SHA" --keep-going
```

Expected: all selected L0–L2 suites PASS. Because Task 1 changes `tests/test-suites.json`, handoff must record:

```text
impact_class: case-set
suite: recruitment-mobile-local
case_set: required
formal_command: tools/test global recruitment-mobile-local --case-set required
feature_worktree_status: DEFERRED_TO_INTEGRATION
full_anchor: DEFERRED_TO_RELEASE
```

Do not run the formal L3 in this feature worktree.

- [ ] **Step 8: 提交后端 fixture 完成态**

```bash
git add apps/recruitment/scripts/browser-fixture.sh \
  apps/recruitment/scripts/tests/test-browser-fixture-source.sh \
  apps/recruitment/scripts/tests/test-browser-fixture-fake-runtime.sh \
  apps/recruitment/README.md
git commit -m "test(recruitment): add browser fixture convergence"
git status --short
```

Expected: clean backend worktree. Record both backend commit SHAs for frontend execution handoff.

---

### Task 4: 建立前端报告模型与真实后端视觉比较核心

**Repository:** current frontend worktree。

**Files:**
- Create: `e2e/真实后端/类型.ts`
- Create: `e2e/真实后端/报告.ts`
- Create: `e2e/真实后端/报告.test.ts`
- Create: `e2e/真实后端/视觉/场景清单.ts`
- Create: `e2e/真实后端/视觉/比较.ts`
- Create: `e2e/真实后端/视觉/比较.test.ts`
- Create: `tsconfig.e2e.json`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: existing `e2e/视觉回归/比较器.ts` exports `比较图片` and `默认比较阈值`。
- Produces: Stable Interfaces report types, `读取运行分片()`、`判定整栈结果()`、`写整栈报告()`、`比较真实后端视觉()`、`真实后端场景们`。

- [ ] **Step 1: 写报告与视觉失败测试**

Create tests covering exact exit behavior:

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { 判定整栈结果 } from './报告';

describe('真实后端整栈 verdict', () => {
  it('基础设施阻塞不是 PASS', () => {
    expect(判定整栈结果({ reportParseError: false, infraBlocked: true, functionalFailed: false, cleanupFailed: false, visualBlocked: false, gate: 'report' }))
      .toEqual({ classification: 'INFRA_BLOCKED', exitCode: 75 });
  });
  it('report 模式只报告视觉漂移', () => {
    expect(判定整栈结果({ reportParseError: false, infraBlocked: false, functionalFailed: false, cleanupFailed: false, visualBlocked: true, gate: 'report' }))
      .toEqual({ classification: 'VISUAL_DRIFT', exitCode: 0 });
  });
  it('enforce、功能与清理失败返回 1', () => {
    expect(判定整栈结果({ reportParseError: false, infraBlocked: false, functionalFailed: false, cleanupFailed: false, visualBlocked: true, gate: 'enforce' }).exitCode).toBe(1);
    expect(判定整栈结果({ reportParseError: false, infraBlocked: false, functionalFailed: true, cleanupFailed: false, visualBlocked: false, gate: 'report' }).exitCode).toBe(1);
    expect(判定整栈结果({ reportParseError: false, infraBlocked: false, functionalFailed: false, cleanupFailed: true, visualBlocked: false, gate: 'report' }).exitCode).toBe(1);
  });
  it('报告分片解析错误返回 usage/reporting exit 2', () => {
    expect(判定整栈结果({ reportParseError: true, infraBlocked: false, functionalFailed: false, cleanupFailed: false, visualBlocked: false, gate: 'report' }))
      .toEqual({ classification: 'USAGE_ERROR', exitCode: 2 });
  });
});
```

Visual tests must synthesize 20×20 PNGs and assert 1/400 pass, 20/400 warning, 21+/400 blocked according to the existing comparator's strict boundaries; also assert a mismatched agent-browser version or Chrome build returns environment blocked before reading PNGs.

- [ ] **Step 2: 运行失败测试**

```bash
npm test -- --run e2e/真实后端/报告.test.ts e2e/真实后端/视觉/比较.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: 实现类型、场景清单与 verdict**

Write the Stable Interfaces types verbatim. Define the seven scene IDs as a literal tuple and derive the union:

```ts
export const 真实后端场景们 = [
  'candidate-resume-loaded',
  'candidate-intentions-loaded',
  'candidate-disclosure-loaded',
  'candidate-resume-updated',
  'recruiter-card-loaded',
  'recruiter-company-loaded',
  'recruiter-jobs-after-create',
] as const;

export type 真实后端场景ID = typeof 真实后端场景们[number];
```

`判定整栈结果()` has an explicit `reportParseError` input and priority report parse error 2, infra 75, cleanup 1, functional 1, enforce visual 1, report visual 0 with classification `VISUAL_DRIFT`, otherwise PASS 0. The runner passes the selected journey set to the report reader: a selected fragment missing is `FUNCTIONAL_FAILED`; every unselected journey must have a present `status:'skipped'` fragment. An absent visual manifest is bootstrap, a malformed manifest or an existing incompatible manifest is `INFRA_BLOCKED`.

- [ ] **Step 4: 实现视觉比较**

`比较真实后端视觉()` handles three explicit states. With no committed manifest/reference directory it returns environment `bootstrap`, records the current environment, and returns all seven scenes as `missing` without calling `比较图片`. With a valid manifest it deep-compares environment fields except `baselineCommit`, then loops the seven scene IDs, calls existing `比较图片(reference,candidate,diff,默认比较阈值)`, and returns paths relative to the output root. A malformed or incompatible existing manifest returns `blocked`. It never uses the Mock comparison directory API because that API treats real `/api/v1` requests as structure failures.

Baseline update API is two-phase:

```ts
export function 生成候选基线目录(options: {
  functionalPassed: boolean;
  fixtureVerified: boolean;
  environment: 'matched' | 'bootstrap' | 'blocked';
  candidateDir: string;
  reviewDir: string;
}): void;
```

Functional/fixture false or environment `blocked` throws before copying. `matched` and first-run `bootstrap` copy the seven candidates plus a candidate manifest containing the current environment to `reviewDir`, never to committed `基线/`. Tests cover absent manifest bootstrap success, corrupt manifest refusal and existing-manifest environment mismatch refusal.

- [ ] **Step 5: 添加 scripts 与 ignore**

Add to `package.json`:

```json
"test:agent-browser:backend-local": "bash e2e/真实后端/运行整栈验收.sh",
"test:agent-browser:unit": "vitest run e2e/真实后端/报告.test.ts e2e/真实后端/视觉/比较.test.ts"
```

Append exactly `/agent-browser-backend-output/` to `.gitignore`. Add `tsconfig.e2e.json` with `moduleResolution:"bundler"`, Node/DOM libs and `include:["e2e/真实后端/**/*.ts"]`; add it to root `tsconfig.json` references so `tsc -b --noEmit` checks production and test modules imported by this suite.

- [ ] **Step 6: 运行单测、类型与 lint**

```bash
npm run test:agent-browser:unit
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 7: 提交报告与视觉核心**

```bash
git add package.json .gitignore tsconfig.json tsconfig.e2e.json e2e/真实后端/类型.ts e2e/真实后端/报告.ts \
  e2e/真实后端/报告.test.ts e2e/真实后端/视觉/场景清单.ts \
  e2e/真实后端/视觉/比较.ts e2e/真实后端/视觉/比较.test.ts
git commit -m "test: add real-backend acceptance report core"
```

---

### Task 5: 建立 agent-browser 公共步骤与候选旅程

**Repository:** frontend worktree。

**Files:**
- Create: `e2e/真实后端/公共步骤.sh`
- Create: `e2e/真实后端/公共步骤.test.sh`
- Create: `e2e/真实后端/旅程/候选数据加载.sh`
- Create: `e2e/真实后端/旅程/候选CRUD.sh`
- Create: `e2e/真实后端/资源/简历-v1.pdf`
- Create: `e2e/真实后端/资源/简历-v2.pdf`
- Modify: `src/屏幕/披露偏好.tsx`
- Modify: `src/屏幕/披露偏好.test.tsx`

**Interfaces:**
- Consumes: `AGENT_BROWSER_SESSION`、`RUN_DIR`、`PRIVATE_LEDGER`、`FRONTEND_ORIGIN=http://localhost:5173`。
- Produces: `ab()`、`login_candidate()`、`login_recruiter()`、`wait_text()`、`assert_text()`、`assert_absent()`、`assert_pressed()`、`reload_and_assert()`、`capture_scene()`、`record_cleanup_marker()`、`write_journey_result()`。

- [ ] **Step 1: 写公共步骤 fake CLI 测试**

Create a fake `agent-browser` that records arguments without sensitive field values. Test:

```bash
AGENT_BROWSER_SESSION=backend-local-candidate login_candidate
grep -Fq -- '--session backend-local-candidate open http://localhost:5173/' "$CALLS"
grep -Fq 'find label 手机号 fill [REDACTED]' "$CALLS"
grep -Fq 'find role button click --name 获取验证码' "$CALLS"
grep -Fq 'find label 短信验证码 fill [REDACTED]' "$CALLS"
grep -Fq 'find role button click --name 我要找工作' "$CALLS"
! grep -Eq 'network[[:space:]]+route|network[[:space:]]+har|state[[:space:]]+save|--profile|--session-name' "$CALLS" \
  || fail 'forbidden browser persistence/mock call'
```

Also test `capture_scene` issues viewport/media/eval stabilization before screenshot, writes candidate PNG under `$RUN_DIR/visual/candidate/<scene>.png`, and rejects an unknown scene ID.

Extend `src/屏幕/披露偏好.test.tsx` first so it fails until every segmented button exposes a unique accessible name such as `当前公司：不披露` and the selected button exposes `aria-pressed="true"`; assert changing the backend snapshot moves the pressed state without relying on a CSS class.

- [ ] **Step 2: 运行失败测试**

```bash
bash e2e/真实后端/公共步骤.test.sh
```

Expected: FAIL because `公共步骤.sh` does not exist.

- [ ] **Step 3: 实现固定 agent-browser wrappers**

Use one explicit session on every command:

```bash
ab(){ agent-browser --session "$AGENT_BROWSER_SESSION" "$@"; }
wait_text(){ ab wait --text "$1" >/dev/null; }
assert_text(){ wait_text "$1"; }
assert_absent(){
  local body
  body="$(ab get text body)" || return 1
  case "$body" in *"$1"*) unset body; return 1 ;; esac
  unset body
}
reload_and_assert(){ ab reload >/dev/null; wait_text "$1"; }
```

Implement `assert_pressed()` as `ab get attr "[aria-label=\"$name\"]" aria-pressed` and require the exact string `true`; the selector is the product's accessible name, not a CSS module class or DOM hierarchy. Click the same control through `ab find role button click --name "$name" --exact`. In `披露偏好.tsx`, set the following on the real buttons; this is product accessibility state, not a test-only DOM node, and does not change the screenshot:

```tsx
aria-label={`${项.名称}：${档}`}
aria-pressed={选中}
```

For inputs use `find label`; for buttons use `find role button ... --name`; for long-lived paths never use `@eN`. `ab snapshot -i` is allowed only on failure and its output goes to the ignored artifact directory after a privacy scan.

Login reads the OTP from `"$AGXP_MONOREPO_DIR/apps/recruitment/.local-dev/code"` into a shell variable, disables xtrace around the fill call, and never passes it to `write_journey_result()`. Candidate fills `13800000001`, recruiter fills `13800000002`.

- [ ] **Step 4: 实现稳定截图与诊断**

Before every screenshot:

```bash
ab set viewport 390 844 >/dev/null
ab set media light reduced-motion >/dev/null
ab eval --stdin >/dev/null <<'JS'
await document.fonts.ready;
await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const style = document.createElement('style');
style.dataset.agentBrowserStable = 'true';
style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
document.head.appendChild(style);
window.scrollTo(0, 0);
true;
JS
ab screenshot "$RUN_DIR/visual/candidate/$scene.png" >/dev/null
```

At journey end collect `network requests --json`, `console --json`, and `errors --json`; transform only URL method/path and error message through `jq`, reject query/body/header/cookie fields, and require at least one `/api/v1` request. A Mock-only marker or zero API request makes the journey fail.

- [ ] **Step 5: 实现候选数据加载旅程**

Script path, after `login_candidate()`:

```text
主壳 → 我 → 我的简历 → assert 浏览器验收候选人 + 真实后端基准摘要 → reload
capture candidate-resume-loaded
返回/我 → 求职意向 → assert baseline intention derived title + 1/5 → reload
capture candidate-intentions-loaded
返回/我 → 披露偏好 → assert 当前公司 → assert_pressed 当前公司：不披露 → reload → assert_pressed again
capture candidate-disclosure-loaded
assert recruiter private marker absent
```

Use semantic UI clicks for every arrow. Direct hash navigation is allowed only in failure recovery, not in the passing journey.

- [ ] **Step 6: 实现候选 CRUD 旅程**

Use fixed reserved label `浏览器验收候选人 · 临时CRUD` for the temporary resume name. Ownership still comes from the private run receipt delta, not the visible name alone. The current product exposes personal advantage/summary as read-only on “我的简历”; do not add a test-only editor or direct-nav through onboarding. Use the existing inline name editor as the stable resume update seam:

```text
我的简历 → 姓名（递交简历后披露）→ inline edit to fixed temporary label → blur/Enter save → assert → reload
求职意向 → 添加求职意向 → select exact seeded category/location → save
atomically set candidate_intention_created=true in the private cleanup journal
edit compensation 30–45 to 35–45 → save → reload → delete → reload absent
披露偏好 → click 当前公司：意向确认后 → assert_pressed → reload → assert_pressed → restore 当前公司：不披露 → reload → assert_pressed
copy 简历-v1.pdf inside the private run directory as "浏览器验收临时简历.pdf"
我的简历 → 添加附件简历 → upload the fixed-name copy → consent → assert exact display name
append the exact display name to candidate_resume_file_names in the private cleanup journal
left-swipe only through `agent-browser drag` after locating the row semantically → 替换 → upload 简历-v2.pdf → consent
left-swipe → 删除 → confirm → reload absent
restore baseline name 浏览器验收候选人 through the inline editor → reload
```

Capture `candidate-resume-updated` after the temporary name and attachment row are visible and before restoring/deleting them. Do not wait for parsing terminal state; only the attachment row and refresh persistence are hard assertions.

- [ ] **Step 7: 生成合法 PDF assets**

Create two one-page PDFs with no personal data using a deterministic source script or checked-in binary generation command. Verify:

```bash
file e2e/真实后端/资源/简历-v1.pdf e2e/真实后端/资源/简历-v2.pdf
shasum -a 256 e2e/真实后端/资源/简历-v1.pdf e2e/真实后端/资源/简历-v2.pdf
```

Expected: both report PDF, have different SHA-256, and are below 50 KiB.

- [ ] **Step 8: 跑候选脚本合同**

Extend the fake CLI test to source both candidate journeys and assert the ordered milestone calls, four scene IDs, reload after every mutation block, and atomic private journal updates without stdout IDs.

```bash
bash e2e/真实后端/公共步骤.test.sh
npm test -- --run src/屏幕/披露偏好.test.tsx
npm run test:agent-browser:unit
```

Expected: PASS.

- [ ] **Step 9: 提交候选旅程**

```bash
git add e2e/真实后端/公共步骤.sh e2e/真实后端/公共步骤.test.sh \
  e2e/真实后端/旅程/候选数据加载.sh e2e/真实后端/旅程/候选CRUD.sh \
  e2e/真实后端/资源/简历-v1.pdf e2e/真实后端/资源/简历-v2.pdf \
  src/屏幕/披露偏好.tsx src/屏幕/披露偏好.test.tsx
git commit -m "test: add candidate real-backend browser journeys"
```

---

### Task 6: 实现招聘旅程与双 session 隔离门

**Repository:** frontend worktree。

**Files:**
- Create: `e2e/真实后端/旅程/招聘数据加载.sh`
- Create: `e2e/真实后端/旅程/招聘CRUD.sh`
- Modify: `e2e/真实后端/公共步骤.sh`
- Modify: `e2e/真实后端/公共步骤.test.sh`

**Interfaces:**
- Consumes: Task 5 helpers, recruiter baseline from backend Task 3。
- Produces: recruiter load/CRUD fragments and `session-isolation` fragment。

- [ ] **Step 1: 写 recruiter fake CLI 失败断言**

Assert the recruiter session is always `backend-local-recruiter`, never uses candidate refs/storage, captures exactly three recruiter scene IDs, and performs reload after company/job mutations. Assert the isolation guard logs out candidate only, then proves recruiter can still reload `浏览器验收招聘官`.

- [ ] **Step 2: 实现招聘数据加载旅程**

Path:

```text
login recruiter → 我要招人 → 企业主壳 → 我
招聘名片 → assert 浏览器验收招聘官 + 招聘负责人 → reload
capture recruiter-card-loaded
公司资料 → assert 浏览器验收科技 + 真实后端企业介绍基线 → reload
capture recruiter-company-loaded
岗位管理 → assert 在招基线 under 在招 + 归档基线 under 已归档 → reload
assert candidate private summary absent
```

- [ ] **Step 3: 实现招聘 CRUD 旅程**

Use fixed reserved title `浏览器验收岗位 · 临时CRUD` and exact steps; run ownership comes from the pre-state receipt delta:

```text
招聘名片 → change public title to 浏览器验收招聘负责人 → save → reload → restore 招聘负责人 → reload
公司资料 → 公司介绍 → change to 浏览器验收科技 · $RUN_ID → save → reload
restore 真实后端企业介绍基线 → reload
岗位管理 → 发布新岗位 → complete three semantic form steps with exact Catalog choices → publish
append exact title 浏览器验收岗位 · 临时CRUD to recruiter_job_titles in the private cleanup journal
assert new job under 在招 → capture recruiter-jobs-after-create → reload
left-swipe row → 编辑 → change description/requirements only → save → reload
left-swipe row → 停止招聘 → assert under 已归档 → reload
left-swipe row → 重新开放 → assert under 在招 → reload
left-swipe row → 删除 → confirm → assert absent in both groups → reload absent
```

Title/category/location are immutable in backend; the edit block changes only fields the existing UI sends as mutable. The temp job has no candidate/matchcase relationship, so delete must be available.

- [ ] **Step 4: 实现 session isolation guard**

With both sessions logged in:

```text
candidate reload 我的简历 → recruiter marker absent
recruiter reload 招聘名片 → candidate summary absent
candidate 打开设置→退出登录→确认
candidate sees 手机号 login label
recruiter reload → still sees 浏览器验收招聘官
```

Write a separate `session-isolation` fragment. Logout recruiter during the global finalizer, not inside this guard.

- [ ] **Step 5: 跑脚本合同**

```bash
bash e2e/真实后端/公共步骤.test.sh
npm run test:agent-browser:unit
```

Expected: PASS with all four journeys and five report fragments represented.

- [ ] **Step 6: 提交招聘旅程**

```bash
git add e2e/真实后端/公共步骤.sh e2e/真实后端/公共步骤.test.sh \
  e2e/真实后端/旅程/招聘数据加载.sh e2e/真实后端/旅程/招聘CRUD.sh
git commit -m "test: add recruiter real-backend browser journeys"
```

---

### Task 7: 编排完整 stack、资源 ownership、cleanup 与报告

**Repository:** frontend worktree。

**Files:**
- Create: `e2e/真实后端/运行整栈验收.sh`
- Create: `e2e/真实后端/运行整栈验收.test.sh`
- Modify: `e2e/真实后端/报告.ts`
- Modify: `e2e/真实后端/报告.test.ts`

**Interfaces:**
- Consumes: backend `dev-local.sh`、`browser-fixture.sh`、four journey scripts、visual comparator/reporter。
- Produces: one-command entry, ownership-aware teardown, final `report.json`/`report.md`, fixed exit code。

- [ ] **Step 1: 写 runner fake-runtime 测试**

Fake backend, Vite, curl and agent-browser; cover:

```text
healthy preexisting backend → no prepare/up/down
unhealthy backend → prepare/up/health/bootstrap; final down
health failure → no fixture/browser/Vite; exit 75
port 5173 occupied → no alternate port; exit 75
one journey fails → later independent journey still runs; cleanup+verify run; exit 1
cleanup fails → exit 1 even when journeys pass
report mode visual blocked → exit 0 classification VISUAL_DRIFT
enforce mode visual blocked → exit 1
SIGINT/failure → close only two named sessions and owned Vite; preserve preexisting backend
unknown journey/argument → exit 2 before mutations
single selected journey passes → emit four unselected/session-isolation fragments as skipped; exit 0
```

- [ ] **Step 2: 运行失败测试**

```bash
bash e2e/真实后端/运行整栈验收.test.sh
```

Expected: FAIL because runner does not exist.

- [ ] **Step 3: 实现参数与 preflight**

Accepted arguments only:

```text
--journey candidate-load|candidate-crud|recruiter-load|recruiter-crud|all
--headed
--update-baseline
```

Preflight requires absolute existing `AGXP_MONOREPO_DIR`, cleanly executable backend entrypoints, `node_modules/.bin/vite`, `agent-browser`, Chrome doctor, `jq`, `curl`, Docker daemon, free `localhost:5173`, and safe output path under the frontend root. Generate run ID from UTC timestamp plus six random hex chars; create `$RUN_DIR/private` mode 0700 and cleanup journal mode 0600.

- [ ] **Step 4: 实现 stack ownership**

```bash
if "$DEV" health >/dev/null 2>&1; then
  BACKEND_PREEXISTING=1
else
  BACKEND_PREEXISTING=0
  "$DEV" prepare || infra_blocked
  "$DEV" up || infra_blocked
  "$DEV" health || infra_blocked
fi
"$DEV" bootstrap || infra_blocked
"$FIXTURE" converge || classify_fixture_failure
"$FIXTURE" verify || classify_fixture_failure
```

`converge` writes the backend run receipt before handing control to the browser. The runner refuses to start journeys unless the receipt exists at the documented gitignored path with mode 0600 and the same run ID.

Start Vite exactly:

```bash
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local \
  npm run dev -- --host localhost --port 5173 --strictPort >"$RUN_DIR/vite.log" 2>&1 &
VITE_PID=$!
```

Poll `http://localhost:5173/` with bounded curl attempts; no unbounded sleep and no alternate port. Record the PID as owned only after `kill -0` succeeds.

- [ ] **Step 5: 实现 journey 调度与 session isolation**

Run load preconditions before CRUD per role without falsely reporting the load journey as selected. `--journey candidate-crud` emits `candidate-crud` plus four explicit `status:'skipped'` fragments; `all` runs four journeys plus isolation. The report reader receives the selected set and treats only a missing selected fragment as functional failure. Capture each exit without aborting independent later journeys:

```bash
set +e
bash "$journey_script"
journey_rc=$?
set -e
record_journey_rc "$journey_id" "$journey_rc"
```

An infra failure stops all remaining work; a functional failure continues only journeys that do not depend on its mutated state.

- [ ] **Step 6: 实现 teardown 顺序**

The EXIT trap must be idempotent and run once:

```text
backend fixture cleanup --ledger private cleanup journal
backend fixture converge
backend fixture verify
close backend-local-candidate and backend-local-recruiter only
terminate owned Vite PID; wait it; never kill by port/process name
if backend was owned → dev-local.sh down
if cleanup succeeded → remove private directory and backend run receipt
if cleanup failed → retain both mode 0600 and record only their paths
run report writer with collected statuses
return computed exit code
```

If cleanup fails, retain the private cleanup journal and backend run receipt until the report has recorded `CLEANUP_FAILED`, print only their restricted absolute locations, and keep both mode 0600 for manual recovery. On cleanup success delete both before report generation.

- [ ] **Step 7: 实现运行 manifest 与隐私扫描**

Record frontend/backend commit, `agent-browser --version`, Chrome build from a safe `navigator.userAgent` parse, viewport and environment. Before finalizing artifacts run a literal scan for:

```text
__Host-agxp_recruitment_session
Authorization:
Bearer followed by one ASCII space
"proof":{"code"
Cookie:
Set-Cookie:
```

Any match outside the private directory becomes `CLEANUP_FAILED`/artifact hygiene failure and exit 1. Do not scan PNG bytes as text; scan JSON, Markdown and logs, and ensure journey diagnostic JSON contains only the allowed schema.

- [ ] **Step 8: 跑 runner contract**

```bash
bash e2e/真实后端/运行整栈验收.test.sh
npm run test:agent-browser:unit
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 9: 提交 runner**

```bash
git add e2e/真实后端/运行整栈验收.sh e2e/真实后端/运行整栈验收.test.sh \
  e2e/真实后端/报告.ts e2e/真实后端/报告.test.ts
git commit -m "test: orchestrate real-backend browser acceptance"
```

---

### Task 8: 首次真实整栈运行、审阅并提交七个视觉基线

**Repository:** backend implementation worktree + frontend worktree；需要独占本地 Docker/Chrome 资源。

**Files:**
- Create: `e2e/真实后端/视觉/基线清单.json`
- Create: seven `e2e/真实后端/视觉/基线/*.png`

**Interfaces:**
- Consumes: Tasks 1–7 completed commits and healthy local platform prerequisites。
- Produces: reviewed reference PNGs and manifest；first real functional evidence。

- [ ] **Step 1: 确认后端 commit 与本地资源独占**

```bash
: "${AGXP_MONOREPO_DIR:?set AGXP_MONOREPO_DIR to the Task 1 backend implementation worktree}"
AGXP_MONOREPO_DIR="$(cd "$AGXP_MONOREPO_DIR" && pwd)"
export AGXP_MONOREPO_DIR
git -C "$AGXP_MONOREPO_DIR" status --short
git status --short
agent-browser doctor --offline --quick
docker info >/dev/null
```

Expected: both trees clean, doctor and Docker PASS. If another integration run holds the global lock or port 5173/8097, stop as `INFRA_BLOCKED`; do not change ports.

- [ ] **Step 2: 跑功能模式，不生成基线**

```bash
AGXP_MONOREPO_DIR="$AGXP_MONOREPO_DIR" UI_VISUAL_GATE=report \
  npm run test:agent-browser:backend-local -- --journey all
```

Expected on first run: four functional journeys, session isolation, fixture verify and cleanup PASS; visual result reports missing baselines but does not overwrite anything. If functional work exposes a real frontend/backend incompatibility, diagnose and fix it in the owning task with TDD, commit, then rerun from clean state.

- [ ] **Step 3: 生成候选基线目录**

```bash
AGXP_MONOREPO_DIR="$AGXP_MONOREPO_DIR" UI_VISUAL_GATE=report \
  npm run test:agent-browser:backend-local -- --journey all --update-baseline
```

Expected: functional/verify/cleanup all PASS, seven images copied only to `agent-browser-backend-output/<run>/baseline-review/`, and a candidate manifest records both commit SHAs and exact browser environment.

- [ ] **Step 4: 人工审阅七张 reference**

Open every PNG and verify the expected stable business marker, no OTP/toast/countdown/modal/parse spinner/relative time/private secret, correct 390×844 size, and no blank/loading/error page. Compare the seven-file list against `真实后端场景们`; reject any extra or missing scene.

- [ ] **Step 5: 显式安装基线**

Copy the reviewed seven PNGs and manifest from the exact printed review directory into `e2e/真实后端/视觉/基线/` and `基线清单.json`. This is the only manual copy in the workflow; the runner never writes committed baseline paths.

Run:

```bash
npm run test:agent-browser:unit
AGXP_MONOREPO_DIR="$AGXP_MONOREPO_DIR" UI_VISUAL_GATE=report \
  npm run test:agent-browser:backend-local -- --journey all
```

Expected: functional PASS; seven visual results contain no `missing`; warning/blocked is allowed only if explicitly explained as a rendering-noise defect and fixed before commit. The initial committed baseline run should normally be seven pass.

- [ ] **Step 6: 提交 baseline**

```bash
git add e2e/真实后端/视觉/基线清单.json e2e/真实后端/视觉/基线/*.png
git commit -m "test: establish real-backend visual baselines"
```

---

### Task 9: 文档、最终验证与跨仓库交付

**Repository:** both worktrees。

**Files:**
- Create: `docs/AgentBrowser真实后端验收.md`
- Modify: `README.md` only if the repository's test command index already lists explicit E2E commands; otherwise leave it unchanged。

**Interfaces:**
- Consumes: completed implementation and real-run report。
- Produces: operator documentation, final verification evidence, backend TEST_DELTA and two-repo commit handoff。

- [ ] **Step 1: 写用户文档**

Document:

- `AGXP_MONOREPO_DIR` must point to the backend implementation worktree/merged release line;
- one-command run, one-journey run, headed debug, baseline candidate workflow;
- default report vs explicit enforce;
- exit 0/1/2/75 meaning;
- existing healthy stack preservation and owned-stack down behavior;
- where report/candidate/diff live;
- cleanup recovery using the printed private cleanup journal and backend run receipt paths;
- no route mocks/HAR/state save/video by default;
- four journeys, seven scenes and explicit AI/matching non-goal;
- feature changes that should trigger this test.

- [ ] **Step 2: 跑前端完整非真实栈验证**

```bash
npm run test:agent-browser:unit
bash e2e/真实后端/公共步骤.test.sh
bash e2e/真实后端/运行整栈验收.test.sh
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all PASS.

- [ ] **Step 3: 跑最终真实整栈验收**

```bash
AGXP_MONOREPO_DIR="$AGXP_MONOREPO_DIR" UI_VISUAL_GATE=report \
  npm run test:agent-browser:backend-local -- --journey all
```

Expected: exit 0, functional/cleanup PASS, seven visual results present, no hygiene match. Record report path and both commit SHAs; do not commit the ignored report.

- [ ] **Step 4: 跑后端 L0–L2 最终门**

```bash
git -C "$AGXP_MONOREPO_DIR" status --short
git -C "$AGXP_MONOREPO_DIR" diff --check 34306f539...HEAD
cd "$AGXP_MONOREPO_DIR"
tools/test affected --base 34306f539 --keep-going
```

Expected: clean tree, diff check PASS, all selected L0–L2 PASS. Formal L3 remains `DEFERRED_TO_INTEGRATION` with `recruitment-mobile-local --case-set required`; no feature-worktree PASS claim.

- [ ] **Step 5: 写 backend TEST_DELTA handoff**

Use this exact structure with actual commit/results substituted:

```text
TEST_DELTA
- 新增/修改的测试：browser fixture source + fake runtime；frontend agent-browser real-backend acceptance
- owner / layer / resource class：recruitment / L0 / none；frontend local explicit slow E2E / global-exclusive local resources
- 当前 worktree 已运行的命令与结果：tools/test affected --base 34306f539 --keep-going = PASS；真实整栈命令 = PASS/报告路径
- DEFERRED_TO_INTEGRATION 的 L3：recruitment-mobile-local --case-set required
- L3 的完整命令、前置条件、预期 case 和证据：tools/test global recruitment-mobile-local --case-set required；Docker/build toolchain；case-summary/evidence-path
- 使用或新增的端口、Compose project、容器、卷、数据库：localhost:5173；127.0.0.1:8097；agxp-recruitment-dev；仅复用既有持久卷；新增一次性 curl review container
- 修改过的公共 gate/runner 入口：tests/test-suites.json 新增 recruitment-browser-fixture-source；无既有 gate 降级
- old → new 入口映射（如有）：无
- 建议登记的 paths/modules/suite：apps/recruitment/scripts/browser-fixture.sh → recruitment → recruitment-browser-fixture-source
```

- [ ] **Step 6: 提交前端文档与最终修正**

```bash
git add docs/AgentBrowser真实后端验收.md README.md
git diff --cached --check
git commit -m "docs: document real-backend browser acceptance"
```

If `README.md` was intentionally unchanged, omit it from `git add`.

- [ ] **Step 7: 最终工作树与提交清单验证**

```bash
git status --short
git log --oneline aa46731..HEAD
git -C "$AGXP_MONOREPO_DIR" status --short
git -C "$AGXP_MONOREPO_DIR" log --oneline 34306f539..HEAD
```

Expected: both trees clean; frontend log contains report core, candidate journeys, recruiter journeys, runner, baselines and docs; backend log contains operator contract, candidate convergence and recruiter convergence. Hand off the exact two commit ranges together because neither side alone constitutes the promised real-backend acceptance.
