# Hosted Agent 与 CRUD Browser Fixture 前端接线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把前端真实后端 browser runner 校准到 receipt v2，立即跑通 Hosted Agent 四类 scene，并让普通 CRUD runner 在后端补齐第五个 `baseline` scene 后无需再改前端即可运行。

**Architecture:** 保留一个 runner 和一套报告，按 journey 选择 fixture scene：Hosted Agent 显式选择 `happy|p4|p5|p6`，普通 CRUD/default 固定选择 `baseline`。两类路径都使用 acceptance stack、同一 run ID 的 `converge → verify → browser → cleanup` 和同一 v2 receipt；当前后端缺 `baseline` 时，只识别精确四-scene usage，并在启动 Vite/browser 前写出现有 `INFRA_BLOCKED` 报告。

**Tech Stack:** Bash 3.2、agent-browser CLI、React 19/Vite 8、TypeScript 6、Vitest 4、现有真实后端报告与视觉比较器、后端 `dev-local.sh`/`browser-fixture.sh` acceptance profile。

**Spec:** `docs/superpowers/specs/2026-09-05-hosted-agent-browser-acceptance-frontend-design.md`

## Global Constraints

- 开始实现前完整阅读 `CLAUDE.md`、`AGENTS.md`、Spec 与本 Plan；在隔离 worktree 中使用 `superpowers:using-git-worktrees`，以包含本 Plan 的 commit 为执行起点。若先同步 `origin/main`，只普通 merge，不 rebase、不 force push。
- 规划基线是前端 `origin/main@6c0c497ddf29915c82821ec96994d9ca131c61e5`、后端 `origin/release/0.2.5@c4d99e2db5d8e9ba3b5387fb66ac07d80584b25e`。执行时先 fetch 并只读核对；若 fixture CLI、receipt exact keys、scene contract version、终止行或页面公开文案已漂移，停止并记录 `dependency_drift: requires_replan`，不得现场放宽。
- 不修改后端 tracked 代码。当前后端只支持 `happy|p4|p5|p6`；本 Plan 只在前端预接 `baseline`，真实 CRUD 在后端支持前必须保持 `BLOCKED_BY_BACKEND_BASELINE_FIXTURE`。真实门必须使用从冻结 remote commit 创建的独立 detached backend worktree，不能直接消费 `/Users/visionclaw/agxp-monorepo` 当前旧且 dirty 的 checkout。
- Hosted 与 CRUD 都只能使用 `dev-local.sh prepare|up|health --acceptance`；`bootstrap` 和 `down` 按后端 CLI 不带 selector。检测到健康 default stack 时阻塞，不擅自 down、切 profile 或删除 volume。
- 同一轮只使用一个 `BROWSER_FIXTURE_RUN_ID` 和 `<run-id>.json` receipt。禁止 per-call ID、`-1` receipt、cleanup 后二次 converge/verify、前端删除 receipt。
- receipt 必须是普通文件且不是 symlink、mode `0600`、schema 2、`scene_contract_version=hosted-agent-browser.v1`、`phase=prepared`、run/scene 精确匹配，top-level exact key set 为 `baseline_fingerprints|cleanup|created_at|lease|phase|pre_state|run_id|scene|scene_contract_version|scene_driver|schema_version|validated_graph`。
- 三条 PASS line 必须逐字匹配 scene 和 receipt；只有前缀相同不能通过。cleanup 是 receipt 唯一退休者；cleanup PASS 但文件仍在必须判 `CLEANUP_FAILED`。
- 当前后端 blocker 只允许匹配：非 Hosted 路径、实际请求 `converge --scene baseline`、rc 64、输出精确为当前三行 usage 且 scene 列表只有 `happy|p4|p5|p6`。其它 rc 64 仍是 usage error 2。
- 不修改产品 API、DTO、strict decoder、P4/P5/P6 文案或业务页面；不新增公开 CRUD API、第二套 receipt/operator、通用 scene DSL、feature flag、报告 schema 或 Hosted 视觉基线。
- 页面、日志、分片、报告和截图不得出现手机号、OTP、Cookie、bearer、global identity、task ID、Provider/model、原始异常、projection、原始简历/JD 或完整模型输出。
- Bash 保持 macOS `/bin/bash` 3.2 兼容：变量名只用 ASCII，不用 associative array、`mapfile`、`${var,,}` 等 Bash 4+ 能力。
- 每个代码 Task 严格 RED → GREEN 并单独提交。遇到失败先使用 `superpowers:systematic-debugging`，不得通过扩大 timeout、宽松 grep、跳过 cleanup 或伪造 UI 状态让门变绿。

## 文件结构与责任边界

- Modify `e2e/真实后端/运行整栈验收.sh`：参数、acceptance stack ownership、scene 选择、receipt v2 lifecycle、blocker 分类、manifest 和单轮报告。
- Modify `e2e/真实后端/运行整栈验收.test.sh`：runner fake runtime；严格模拟 acceptance CLI、五 scene、receipt v2、终止行和 cleanup retirement。
- Create `e2e/真实后端/运行HostedAgent验收.sh`：固定五轮 Hosted suite 和 suite 级 stack ownership；不解释页面状态。
- Create `e2e/真实后端/运行HostedAgent验收.test.sh`：wrapper 顺序、停止条件和 stack ownership 的 hermetic tests。
- Modify `e2e/真实后端/旅程/HostedAgent闭环.sh`：四 scene 的真实页面行为和 happy Case 公开终结。
- Create `e2e/真实后端/旅程/HostedAgent闭环.test.sh`：用最小 fake 公共步骤验证 scene 闭合分发、关键正/负断言和双角色终结动作。
- Modify `package.json`：增加 Hosted suite script，并把新增 shell tests 纳入已有 shell gate。
- Do not modify by default `e2e/真实后端/类型.ts`、`报告.ts`、`报告.test.ts`：稳定 blocker 写进既有 blocked journey failure，`fixtureScene` 只进入 run manifest；如果 RED test 证明现有类型无法表达 Spec，停止并重规划，不在执行中自行扩 schema。

---

### Task 1: 冻结 scene selector 与 acceptance stack

**Files:**
- Modify: `e2e/真实后端/运行整栈验收.test.sh:266-394,414-530,853-907`
- Modify: `e2e/真实后端/运行整栈验收.sh:34-81,117-160,587-695,783-821`

**Interfaces:**
- Consumes: CLI `--journey hosted-agent --hosted-scene happy|p4|p5|p6`；普通 journey/default 无新参数。
- Produces: `FIXTURE_SCENE=baseline|happy|p4|p5|p6`；`HOSTED_AGENT_SCENE` 只在 Hosted journey 子进程中存在。
- Stack: `health --acceptance` 成功才可复用；plain `health` 成功而 acceptance health 失败表示 profile mismatch；无健康栈才可 `prepare/up/health --acceptance`。

- [ ] **Step 1: 写 selector 与 acceptance profile RED tests**

用 `apply_patch` 更新 fake `dev-local.sh`：acceptance health 与 plain health 分开记账，`prepare|up` 只接受 exact `--acceptance`，`bootstrap|down` 无参数：

```bash
case "${1:-}" in
  health)
    shift
    case "$#:${1:-}" in
      1:--acceptance)
        n=$(cat "$STATE/acceptance-health-calls" 2>/dev/null || printf 0)
        n=$((n + 1)); printf '%s' "$n" >"$STATE/acceptance-health-calls"
        rc=$(printf '%s\n' ${FAKE_ACCEPTANCE_HEALTH_SEQ:-0} | tr ' ' '\n' | sed -n "${n}p")
        [ -n "$rc" ] || rc=$(printf '%s\n' ${FAKE_ACCEPTANCE_HEALTH_SEQ:-0} | tr ' ' '\n' | tail -1)
        exit "$rc" ;;
      0:) exit "${FAKE_DEFAULT_HEALTH_RC:-1}" ;;
      *) printf 'FAKE dev-local health 参数错误\n' >>"$CALLS"; exit 64 ;;
    esac ;;
  prepare|up)
    command="$1"; shift
    [ "$#" -eq 1 ] && [ "$1" = '--acceptance' ] \
      || { printf 'FAKE dev-local %s 缺少 exact --acceptance\n' "$command" >>"$CALLS"; exit 64; }
    ;;
  bootstrap|down) [ "$#" -eq 1 ] || exit 64 ;;
esac
```

增加以下用例；fake Hosted journey 记录 `journey hosted-agent scene=<value>`：

```bash
testcase '默认 CRUD 固定选择 baseline，并使用 acceptance profile'
reset_case; setup_baseline
run_runner
assert_eq '退出码 0' "$RC" 0
assert_contains 'acceptance health' 'dev-local health --acceptance' "$CALLS"
assert_contains 'baseline converge' 'fixture converge --scene baseline' "$CALLS"
assert_missing 'bootstrap 不带 selector' 'dev-local bootstrap --acceptance' "$CALLS"

testcase 'Hosted scene 参数在任何外部动作前闭合校验'
for args in '--journey hosted-agent' '--journey hosted-agent --hosted-scene future' \
  '--journey candidate-crud --hosted-scene happy' '--hosted-scene happy'; do
  reset_case; setup_baseline
  # shellcheck disable=SC2086
  run_runner $args
  assert_eq "非法组合 $args 退出 2" "$RC" 2
  assert_eq '零外部调用' "$(wc -l <"$CALLS" | tr -d ' ')" 0
done

testcase 'Hosted p5 只把 p5 交给 fixture 与 journey'
reset_case; setup_baseline
run_runner --journey hosted-agent --hosted-scene p5
assert_eq '退出码 0' "$RC" 0
assert_contains 'fixture scene' 'fixture converge --scene p5' "$CALLS"
assert_contains 'journey scene' 'journey hosted-agent scene=p5' "$CALLS"
assert_missing '不跑 CRUD' 'journey candidate-crud' "$CALLS"

testcase '健康 default stack 不被切换成 acceptance'
reset_case; setup_baseline
export FAKE_ACCEPTANCE_HEALTH_SEQ='75' FAKE_DEFAULT_HEALTH_RC=0
run_runner
assert_eq '退出 75' "$RC" 75
assert_missing '不 prepare' 'dev-local prepare' "$CALLS"
assert_missing '不 down' 'dev-local down' "$CALLS"
assert_missing '不碰 fixture' 'fixture ' "$CALLS"
```

- [ ] **Step 2: 运行 RED**

Run: `bash e2e/真实后端/运行整栈验收.test.sh`

Expected: FAIL；旧 runner 不认识 `--hosted-scene`，调用 default profile，converge 没带 `--scene`。

- [ ] **Step 3: 实现闭合 selector 与 scene dispatch**

在参数区加入：

```bash
HOSTED_SCENE=''

# while/case 中
--hosted-scene)
  [ $# -ge 2 ] || usage_error '--hosted-scene 缺少取值'
  HOSTED_SCENE="$2"; shift 2 ;;

if [ "$JOURNEY_ARG" = 'hosted-agent' ]; then
  case "$HOSTED_SCENE" in happy|p4|p5|p6) : ;; *) usage_error 'hosted-agent 必须提供 happy|p4|p5|p6' ;; esac
  FIXTURE_SCENE="$HOSTED_SCENE"
else
  [ -z "$HOSTED_SCENE" ] || usage_error '--hosted-scene 只能与 --journey hosted-agent 同用'
  FIXTURE_SCENE='baseline'
fi
```

converge 改为 `fixture_step converge --scene "$FIXTURE_SCENE"`。`run_journey` 只在 `id=hosted-agent` 时这样调用：

```bash
HOSTED_AGENT_SCENE="$HOSTED_SCENE" FRAGMENT_DIR="$dir" bash "$script"
```

CRUD 子进程继续只接 `FRAGMENT_DIR="$dir"`，不继承 Hosted scene。

- [ ] **Step 4: 实现 acceptance stack ownership**

```bash
if "$DEV" health --acceptance >/dev/null 2>&1; then
  BACKEND_PREEXISTING=1; STACK_HEALTHY=1
elif "$DEV" health >/dev/null 2>&1; then
  blocked '当前运行的是 default stack；请先由其 owner 执行 down，再运行 acceptance 验收'
else
  BACKEND_OWNED=1
  "$DEV" prepare --acceptance >/dev/null 2>&1 || blocked 'dev-local.sh prepare --acceptance 失败'
  "$DEV" up --acceptance >/dev/null 2>&1 || blocked 'dev-local.sh up --acceptance 失败'
  "$DEV" health --acceptance >/dev/null 2>&1 || blocked 'dev-local.sh health --acceptance 失败'
  STACK_HEALTHY=1
fi
"$DEV" bootstrap >/dev/null 2>&1 || blocked 'dev-local.sh bootstrap 失败'
```

删除旧 `bootstrap_stack` 挪 receipt 目录的绕法及对应两条 tests。后端 v2 的 `KNOWN_DERIVED` 已包含 `browser-fixtures`，继续搬移会破坏 lease/crash recovery。

- [ ] **Step 5: 把 scene 写进现有 manifest**

只给 `run-manifest.json.environment` 增加实际传给 fixture 的 scene：

```json
{"fixtureScene":"<FIXTURE_SCENE>"}
```

使用现有 `jq --arg` 生成，禁止手拼 JSON；不修改最终 report schema。

- [ ] **Step 6: 运行 GREEN 并提交**

```bash
bash e2e/真实后端/运行整栈验收.test.sh
git diff --check
git add e2e/真实后端/运行整栈验收.sh e2e/真实后端/运行整栈验收.test.sh
git commit -m "test(e2e): select acceptance fixture scenes"
```

Expected: shell suite PASS；default 只选择 baseline，Hosted scene 闭合，default stack mismatch 零 mutation。

---

### Task 2: 迁移到 receipt schema v2 的单生命周期

**Files:**
- Modify: `e2e/真实后端/运行整栈验收.test.sh:304-394,414-720,831-842,970-983`
- Modify: `e2e/真实后端/运行整栈验收.sh:17-31,117-293,429-540,654-703`

**Interfaces:**
- Consumes: `BROWSER_FIXTURE_RUN_ID=$RUN_ID`，receipt 固定为 `$FIXTURE_RECEIPT_DIR/$RUN_ID.json`。
- Produces: `validate_receipt_v2 PATH`；只允许 `converge --scene SCENE → verify --ledger PATH → cleanup --ledger PATH`。

- [ ] **Step 1: 把 fake operator 升级为 v2 并写 RED assertions**

fake receipt 必须是以下 exact top-level shape：

```bash
( umask 077; jq -n --arg run "$BROWSER_FIXTURE_RUN_ID" --arg scene "$scene" '{
  schema_version:2,scene_contract_version:"hosted-agent-browser.v1",run_id:$run,scene:$scene,
  phase:"prepared",created_at:"2026-09-05T00:00:00Z",
  lease:{generation:1,proof:"fake-proof"},scene_driver:{armed:true,consumed_steps:0},
  pre_state:{candidate:{intention_ids:[],resume_file_ids:[]},recruiter:{job_ids:[]}},
  baseline_fingerprints:{},validated_graph:null,
  cleanup:{public_terminalized:false,graph_retired:false,final_read_passed:false,
    hub_begin_release:false,recruitment_begin_release:false,hub_released:false,
    recruitment_released:false,lease_released:false}
}' >"$receipt" )
chmod "${FAKE_RECEIPT_MODE:-600}" "$receipt"
```

fake command 必须严格校验五值 scene、absolute ledger、三次相同 run ID；verify 从 receipt 读 scene；cleanup 成功先删除 receipt，再输出 exact line。

替换旧断言为：

```bash
assert_eq '三次算子调用' "$(fixture_runs | wc -l | tr -d ' ')" '3'
assert_eq '三次共用同一 RUN_ID' "$(fixture_runs | sort -u | wc -l | tr -d ' ')" '1'
assert_eq 'receipt 由 cleanup 退休' \
  "$(find "$MONO/apps/recruitment/.local-dev/browser-fixtures" -type f 2>/dev/null | wc -l | tr -d ' ')" '0'
assert_missing 'cleanup 后无二次 converge/verify' 'fixture converge --scene baseline run=' "$STATE/after-cleanup-calls"
```

增加 receipt drift 表格：wrong schema、contract version、run、scene、phase、extra key、missing key、mode 0644、symlink；每例零 browser journey，有 receipt 时使用同 ledger cleanup。

再把既有 SIGINT case 拆成两条，证明重写的 `on_exit` 不会漏掉 lease cleanup：

```bash
testcase 'SIGINT + cleanup PASS：同一 ledger 只清一次，receipt 由后端退休，仍退出 75'
reset_case; setup_baseline
export FAKE_JOURNEY_SIGINT='recruiter-load'
run_runner
assert_eq '信号分类保持 75' "$RC" 75
assert_eq 'cleanup 恰好一次' "$(grep -c 'fixture cleanup --ledger' "$CALLS")" 1
assert_eq '三步使用同一 run id' "$(fixture_runs | sort -u | wc -l | tr -d ' ')" 1
assert_false 'receipt 已退休' "find '$MONO/apps/recruitment/.local-dev/browser-fixtures' -type f 2>/dev/null | grep -q ."

testcase 'SIGINT + cleanup FAIL：同一 ledger 只清一次，receipt 0600 保留，仍退出 75'
reset_case; setup_baseline
export FAKE_JOURNEY_SIGINT='recruiter-load' FAKE_CLEANUP_SEQ='1'
run_runner
assert_eq '信号分类仍为 75' "$RC" 75
assert_eq 'cleanup 恰好一次' "$(grep -c 'fixture cleanup --ledger' "$CALLS")" 1
receipt_path=$(find "$MONO/apps/recruitment/.local-dev/browser-fixtures" -type f | head -1)
assert_true 'receipt 保留' "[ -n '$receipt_path' ] && [ -f '$receipt_path' ]"
assert_eq 'receipt mode 0600' "$(stat -f '%Lp' "$receipt_path" 2>/dev/null || stat -c '%a' "$receipt_path")" 600
assert_contains 'cleanup 状态如实失败' 'FAILED(rc=1)' "$(report_json)"
```

- [ ] **Step 2: 运行 RED**

Run: `bash e2e/真实后端/运行整栈验收.test.sh`

Expected: FAIL；旧 runner 轮换 run ID、期待 `<run>-1.json`、只 grep ID、cleanup 后重新 converge/verify 并主动删除 receipt。

- [ ] **Step 3: 实现同一 run ID、exact line 与 receipt validator**

```bash
fixture_step(){
  local rc=0
  export BROWSER_FIXTURE_RUN_ID="$RUN_ID"
  pace_before_login
  set +e
  FIXTURE_OUT="$("$FIXTURE" "$@" 2>&1)"; rc=$?
  set -e
  FIXTURE_RC="$rc"
  printf '%s\n' "$FIXTURE_OUT" >>"$RUN_DIR/fixture.log"
}

RECEIPT="$FIXTURE_RECEIPT_DIR/$RUN_ID.json"
RECEIPT_KEYS='["baseline_fingerprints","cleanup","created_at","lease","phase","pre_state","run_id","scene","scene_contract_version","scene_driver","schema_version","validated_graph"]'

expect_fixture_line(){
  [ "$FIXTURE_RC" = '0' ] && printf '%s\n' "$FIXTURE_OUT" | grep -Fxq -- "$1"
}

validate_receipt_v2(){
  local path="$1" mode
  [ -f "$path" ] && [ ! -L "$path" ] || return 1
  mode="$(stat -f '%Lp' "$path" 2>/dev/null || stat -c '%a' "$path" 2>/dev/null || printf unknown)"
  [ "$mode" = '600' ] || return 1
  jq -e --arg run "$RUN_ID" --arg scene "$FIXTURE_SCENE" --argjson keys "$RECEIPT_KEYS" '
    .schema_version==2 and .scene_contract_version=="hosted-agent-browser.v1" and
    .run_id==$run and .scene==$scene and .phase=="prepared" and
    .scene_driver.armed==true and .scene_driver.consumed_steps==0 and
    ((keys|sort)==$keys)' "$path" >/dev/null 2>&1
}
```

converge/verify 分别逐字要求：

```text
BROWSER_FIXTURE_CONVERGE PASS scene=<scene> phase=prepared receipt=<absolute receipt>
BROWSER_FIXTURE_VERIFY PASS scene=<scene> admission=ready
```

rc 0 但行不精确，或 receipt schema/字段发生 drift，都是 fixture contract error：零 browser、保留 receipt，并让收尾使用同一 ledger 尝试 cleanup；最终按 cleanup 结果优先，否则 exit 2。symlink 不得传给 cleanup，直接保留并 exit 2。

- [ ] **Step 4: 把 on-exit 改为 cleanup-only**

删除收尾二次 converge/verify、`FIXTURE_RECEIPTS`、`FIXTURE_CALLS` 和前端 receipt unlink。有 receipt 时只运行：

```bash
fixture_step cleanup --ledger "$RECEIPT"
if expect_fixture_line "BROWSER_FIXTURE_CLEANUP PASS scene=$FIXTURE_SCENE next_admission=ready receipt=retired"; then
  if [ -e "$RECEIPT" ] || [ -L "$RECEIPT" ]; then
    FIXTURE_CLEANUP_STATUS='FAILED(receipt-not-retired)'; FIXTURE_CLEANUP_OK=0
  else
    FIXTURE_CLEANUP_STATUS='PASS'
  fi
else
  FIXTURE_CLEANUP_OK=0
  # 继续按 classify_fixture_failure 区分 64/75/其它
fi
```

converge 未留下 receipt 时不猜 cleanup target；非法 receipt 不删除，只打印受限路径。

- [ ] **Step 5: 运行 GREEN 并提交**

```bash
bash e2e/真实后端/运行整栈验收.test.sh
git diff --check
git add e2e/真实后端/运行整栈验收.sh e2e/真实后端/运行整栈验收.test.sh
git commit -m "test(e2e): adopt fixture receipt v2 lifecycle"
```

Expected: shell suite PASS；三次 fixture call 共用一个 run ID，cleanup 是唯一 receipt retirer。

---

### Task 3: 预接 CRUD `baseline` 并精确识别当前后端 blocker

**Files:**
- Modify: `e2e/真实后端/运行整栈验收.test.sh`（fake four-scene mode 与 blocker cases）
- Modify: `e2e/真实后端/运行整栈验收.sh`（`baseline_missing_from_backend` 与 converge gate）

**Interfaces:**
- Consumes: 当前后端 exact usage：

```text
usage: <fixture> converge --scene happy|p4|p5|p6
       <fixture> verify --ledger ABSOLUTE_PATH
       <fixture> cleanup --ledger ABSOLUTE_PATH
```

- Produces: existing classification `INFRA_BLOCKED`、exit 75、blocked journey failure 中的稳定 reason `BLOCKED_BY_BACKEND_BASELINE_FIXTURE`。
- Does not produce: 新 report 字段、receipt、Vite、browser session 或 journey mutation。

- [ ] **Step 1: 写 exact blocker RED tests**

让 fake operator 在 `FAKE_FOUR_SCENE_ONLY=1` 且请求 baseline 时逐字输出当前三行 usage 并 exit 64；`FAKE_USAGE_VARIANT=1` 则输出另一条普通 usage 64。

```bash
testcase '四-scene 后端缺 baseline：浏览器前精确依赖阻塞'
reset_case; setup_baseline
export FAKE_FOUR_SCENE_ONLY=1
run_runner
assert_eq '退出 75' "$RC" 75
assert_eq '分类 INFRA_BLOCKED' "$(jq -r .classification "$(report_json)")" INFRA_BLOCKED
assert_contains '稳定 blocker' 'BLOCKED_BY_BACKEND_BASELINE_FIXTURE' "$OUT"
assert_contains 'report 也带 blocker' 'BLOCKED_BY_BACKEND_BASELINE_FIXTURE' "$(report_json)"
assert_missing '不起 Vite' 'npm run dev' "$CALLS"
assert_missing '不开浏览器' 'agent-browser --session' "$CALLS"
assert_missing '不 cleanup' 'fixture cleanup' "$CALLS"
assert_false '没有 receipt' "find '$MONO/apps/recruitment/.local-dev/browser-fixtures' -type f 2>/dev/null | grep -q ."

testcase '其它 usage 64 不得冒充 baseline blocker'
reset_case; setup_baseline
export FAKE_USAGE_VARIANT=1
run_runner
assert_eq '退出 2' "$RC" 2
assert_missing '没有 backend blocker' 'BLOCKED_BY_BACKEND_BASELINE_FIXTURE' "$OUT"

testcase '五-scene 后端直接进入 CRUD browser 与 cleanup'
reset_case; setup_baseline
run_runner
assert_eq '退出 0' "$RC" 0
assert_contains 'baseline verify' 'fixture verify --ledger' "$CALLS"
assert_eq '五条普通 journey PASS' \
  "$(jq -r '[.journeys[]|select(.status=="pass")]|length' "$(report_json)")" 5
```

- [ ] **Step 2: 运行 RED**

Run: `bash e2e/真实后端/运行整栈验收.test.sh`

Expected: FAIL；rc 64 仍被通用 usage 分支翻译成 exit 2。

- [ ] **Step 3: 实现精确旧合同探测**

只比较本次 converge 已捕获的输出；禁止先运行额外 version/source probe：

```bash
baseline_missing_from_backend(){
  local expected
  [ "$JOURNEY_ARG" != 'hosted-agent' ] || return 1
  [ "$FIXTURE_SCENE" = 'baseline' ] || return 1
  [ "$FIXTURE_RC" = '64' ] || return 1
  expected="$(printf 'usage: %s converge --scene happy|p4|p5|p6\n       %s verify --ledger ABSOLUTE_PATH\n       %s cleanup --ledger ABSOLUTE_PATH' \
    "$FIXTURE" "$FIXTURE" "$FIXTURE")"
  [ "$FIXTURE_OUT" = "$expected" ]
}
```

在 converge failure 分支、通用 `fixture_gate` 前处理：

```bash
if baseline_missing_from_backend; then
  FIXTURE_CONVERGE_STATUS='BLOCKED(BLOCKED_BY_BACKEND_BASELINE_FIXTURE)'
  blocked 'BLOCKED_BY_BACKEND_BASELINE_FIXTURE'
fi
```

不要把这个判断放进 verify/cleanup，也不要用包含式 grep 匹配 scene 列表。

- [ ] **Step 4: 运行 GREEN 并提交**

```bash
bash e2e/真实后端/运行整栈验收.test.sh
```

Expected: hermetic suite PASS；four-scene fake 精确阻塞，five-scene fake 进入完整 CRUD journey。真实后端 probe 统一留到 Task 6 的 detached backend worktree，不能消费本机旧且 dirty 的 checkout。

```bash
git diff --check
git add e2e/真实后端/运行整栈验收.sh e2e/真实后端/运行整栈验收.test.sh
git commit -m "test(e2e): prewire CRUD baseline fixture"
```

---

### Task 4: 增加固定五轮 Hosted suite wrapper

**Files:**
- Create: `e2e/真实后端/运行HostedAgent验收.sh`
- Create: `e2e/真实后端/运行HostedAgent验收.test.sh`
- Modify: `package.json:19-21`

**Interfaces:**
- CLI: `运行HostedAgent验收.sh [--headed]`；其它参数 exit 2、零 stack mutation。
- Child sequence: `happy happy p4 p5 p6`。
- Stack: wrapper 自己启动才 plain `down`；健康 acceptance stack 原样保留；健康 default stack exit 75。

- [ ] **Step 1: 写 wrapper RED tests**

新测试在 gitignored `agent-browser-backend-output` 下建临时目录，动态放置 fake `dev-local.sh` 与 fake child runner。child 记录参数，由 `FAKE_CHILD_FAIL_AT` 控制第 N 轮退出。覆盖：

```bash
testcase '固定顺序跑五轮并复用预先存在的 acceptance stack'
run_wrapper
assert_eq '退出 0' "$RC" 0
assert_eq '五轮' "$(grep -c '^child ' "$CALLS")" 5
assert_eq '顺序' "$(grep '^child ' "$CALLS" | sed 's/.*--hosted-scene /scene=/' | tr '\n' ' ')" \
  'scene=happy scene=happy scene=p4 scene=p5 scene=p6 '
assert_missing '不 down 别人的栈' 'dev-local down' "$CALLS"

testcase '第二轮失败后不启动第三轮，自己启动的栈仍收尾'
reset_case
export FAKE_ACCEPTANCE_HEALTH_SEQ='1 0' FAKE_DEFAULT_HEALTH_RC=1 FAKE_CHILD_FAIL_AT=2
run_wrapper
assert_eq '保留 child 退出码 1' "$RC" 1
assert_eq '只启动两轮' "$(grep -c '^child ' "$CALLS")" 2
assert_contains '自己起的栈自己 down' 'dev-local down' "$CALLS"

testcase 'default stack 在位时零切换'
reset_case
export FAKE_ACCEPTANCE_HEALTH_SEQ='75' FAKE_DEFAULT_HEALTH_RC=0
run_wrapper
assert_eq '退出 75' "$RC" 75
assert_missing '零 child' 'child ' "$CALLS"
assert_missing '零 prepare' 'dev-local prepare' "$CALLS"
assert_missing '零 down' 'dev-local down' "$CALLS"
```

- [ ] **Step 2: 运行 RED**

Run: `bash e2e/真实后端/运行HostedAgent验收.test.sh`

Expected: FAIL；wrapper 尚不存在。

- [ ] **Step 3: 实现薄 wrapper**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="$ROOT_DIR/运行整栈验收.sh"
HEADED=0
BACKEND_OWNED=0

case "$#:${1:-}" in
  0:) ;;
  1:--headed) HEADED=1 ;;
  *) printf 'usage: %s [--headed]\n' "$0" >&2; exit 2 ;;
esac

[ -n "${AGXP_MONOREPO_DIR:-}" ] || { echo 'AGXP_MONOREPO_DIR 未设置' >&2; exit 75; }
DEV="$AGXP_MONOREPO_DIR/apps/recruitment/scripts/dev-local.sh"
[ -x "$DEV" ] || { echo 'dev-local.sh 不可执行' >&2; exit 75; }

on_exit(){
  local rc=$?
  trap - EXIT INT TERM
  if [ "$BACKEND_OWNED" = '1' ]; then "$DEV" down >/dev/null 2>&1 || true; fi
  exit "$rc"
}
trap on_exit EXIT
trap 'exit 75' INT TERM

if "$DEV" health --acceptance >/dev/null 2>&1; then
  :
elif "$DEV" health >/dev/null 2>&1; then
  echo 'Hosted suite 阻塞：default stack 正在运行' >&2
  exit 75
else
  BACKEND_OWNED=1
  "$DEV" prepare --acceptance && "$DEV" up --acceptance && "$DEV" health --acceptance \
    || { echo 'Hosted suite acceptance stack 未就绪' >&2; exit 75; }
fi

for scene in happy happy p4 p5 p6; do
  args=(--journey hosted-agent --hosted-scene "$scene")
  [ "$HEADED" = '0' ] || args+=(--headed)
  bash "$RUNNER" "${args[@]}" || exit $?
done
```

Indexed array 在 Bash 3.2 可用；不要换成 associative array。

- [ ] **Step 4: 接入 npm scripts**

`package.json` 增加：

```json
"test:agent-browser:hosted-agent": "bash e2e/真实后端/运行HostedAgent验收.sh",
"test:agent-browser:shell": "bash e2e/真实后端/公共步骤.test.sh && bash e2e/真实后端/运行整栈验收.test.sh && bash e2e/真实后端/运行HostedAgent验收.test.sh"
```

Task 5 创建 journey test 后再把它追加到 shell script；本 Task 不提交指向不存在文件的命令。

- [ ] **Step 5: 运行 GREEN 并提交**

```bash
bash e2e/真实后端/运行HostedAgent验收.test.sh
npm run test:agent-browser:shell
git diff --check
git add package.json e2e/真实后端/运行HostedAgent验收.sh e2e/真实后端/运行HostedAgent验收.test.sh
git commit -m "test(e2e): add hosted agent acceptance suite"
```

Expected: wrapper tests与现有 shell tests PASS；没有真实 Provider 调用。

---

### Task 5: 实现 P4/P5/P6 与可清理的 happy 浏览器旅程

**Files:**
- Modify: `e2e/真实后端/旅程/HostedAgent闭环.sh:7-308`
- Create: `e2e/真实后端/旅程/HostedAgent闭环.test.sh`
- Modify: `package.json`（把新 journey test 接入 shell gate）

**Interfaces:**
- Consumes: `HOSTED_AGENT_SCENE=happy|p4|p5|p6`；现有 `公共步骤.sh` 的两具名 session、登录、点击、等待、分片和脱敏 helper。
- Produces: 单个 `hosted-agent.json` 分片；PASS 只来自对应公开终态。
- Happy terminal: candidate/recruiter 同一 server Case，最终页面进入“双方已确认，正在创建会话”或“真人会话已建立”，双方无 action；backend cleanup 再权威证明 lifecycle `completed|ended`。

- [ ] **Step 1: 写 scene journey RED contract test**

新测试建立临时目录，把真实 `HostedAgent闭环.sh` 复制进去并放置 fake `公共步骤.sh`，同时创建非空 `资源/简历-v1.pdf` 和 mode `0600` 的 fake private journal。fake `ab` 返回安全页面文本和固定 server Case URL，所有 click/open/session 写入 `$CALLS`；`write_journey_result` 写最小分片。测试要真实执行脚本四次，不能只 grep 源码。

fake 页面用 `$STATE/<scene>-phase` 驱动，不靠 sleep：点击“确认规则”后 rule count 从 `0 条` 变 `1 条`；点击“查看进展”后进入 Case；点击两端“接受”后进入 S3；candidate/recruiter 各点击一次“确认意向”后，两个 session 都返回“双方已确认，正在创建会话”。`ab get value` 在 p6 点击“关闭”后返回原 `RULE_TEXT`。任何未列出的 button/find/get 操作都记录 `FAKE` 并非零退出。

四个 case 的输入和断言固定为：

```bash
run_scene p6 '0 条 AI 暂时不可用，本次规则没有生效'
assert_contains 'P6 提交规则' 'click 提交给AI代理理解' "$CALLS"
assert_contains 'P6 关闭失败卡恢复草稿' 'click 关闭' "$CALLS"
assert_missing 'P6 不确认规则' 'click 确认规则' "$CALLS"

run_scene p4 'AI 服务暂时不可用，本次没有创建 Case'
assert_contains 'P4 发起 delegation' 'click 让AI代理去谈' "$CALLS"
assert_missing 'P4 不进 Case' 'click 查看进展' "$CALLS"

run_scene p5 '查看进展 AI 服务暂时不可用，本 Case 尚未继续 需注意'
assert_contains 'P5 recruiter 查看同一 Case' 'session backend-local-recruiter' "$CALLS"
assert_missing 'P5 零重试简历校验' 'click 重试校验' "$CALLS"

run_scene happy '查看进展 通过初筛 等待双方确认意向 双方已确认，正在创建会话'
assert_contains 'happy 双方推进协调' 'click 接受' "$CALLS"
assert_eq '双方各确认一次意向' "$(grep -c 'click 确认意向' "$CALLS")" 2
assert_contains '深链使用 server Case URL' 'open http://localhost:5173/#/deal/mc_fake' "$CALLS"
```

另测空值/未知 scene 都 exit 2、零登录。fake happy 页面一旦返回任一 safe-failure 文案，脚本必须非零，证明失败不能冒充 happy。

- [ ] **Step 2: 运行 RED**

Run: `bash e2e/真实后端/旅程/HostedAgent闭环.test.sh`

Expected: FAIL；现有脚本不分 scene，happy 停在非终局深链 marker。

- [ ] **Step 3: 把共享页面步骤提取成文件内函数**

只在同一脚本内增加以下函数，不新建通用库：

```bash
open_candidate_rules(){
  export AGENT_BROWSER_SESSION="$CANDIDATE_SESSION"
  login_candidate
  click_after_hydrate '我'
  click_after_hydrate 'AI代理规则库'
}

prepare_candidate_pdf(){
  click_after_hydrate '我'
  click_after_hydrate '我的简历'
  cp "$ROOT_DIR/资源/简历-v1.pdf" "$TEMP_PDF_DIR/$RESUME_NAME"
  click_button_exact '添加附件简历'
  ab upload 'input[type="file"]' "$TEMP_PDF_DIR/$RESUME_NAME" >/dev/null
  assert_text '允许 AI 识别这份简历？'
  click_button_exact '同意并继续'
  record_cleanup_marker candidate_resume_file_names "$RESUME_NAME"
  wait_pdf_parse
}

delegate_candidate(){
  click_after_hydrate '职位'
  click_button_exact '市场'
  wait_one_of '让AI代理去谈' '让AI代理帮我搜'
  if on_screen '让AI代理帮我搜'; then click_button_exact '让AI代理帮我搜'; wait_text '让AI代理去谈'; fi
  click_button '让AI代理去谈'
  wait_one_of '选择这次提交的简历' '确认委托AI代理？'
  if on_screen '选择这次提交的简历'; then
    find_retry role radio click --name "$RESUME_NAME" >/dev/null
    click_button_exact '确认并委托'
  else
    click_button_exact '确认委托'
  fi
}
```

- [ ] **Step 4: 实现 `p6` 与 `p4` 公开失败分支**

`p6`：记录 active rule 数，提交后只接受 `AI 暂时不可用，本次规则没有生效`；reload 后计数不变；点击失败卡“关闭”，用 `ab get value 'textarea[placeholder="例：不接受大小周的岗位直接过滤"]'` 断言恢复为 `RULE_TEXT`；再 reload 仍无 active rule。不得点击确认规则或自动重发。

`p4`：准备 PDF、发起 delegation，只接受精确 unavailable 文案；断言没有“查看进展”；reload 后再次断言相同文案和零 Case CTA。evaluation failure、policy、quota、cooldown、recommendation unavailable 都必须失败。闭合 helper：

```bash
wait_p4_unavailable(){
  local tries=0 body
  while [ "$tries" -lt 180 ]; do
    body="$(ab get text body 2>/dev/null || printf '')"
    case "$body" in
      *'AI 服务暂时不可用，本次没有创建 Case'*) return 0 ;;
      *'本次评估未完成，不代表候选或岗位不合适'*|*'当前政策或资格不允许发起这次委托'*|*'当前在谈已达到上限'*|*'近期已联系过对方'*) return 1 ;;
    esac
    tries=$((tries + 1)); sleep 1
  done
  return 1
}
```

- [ ] **Step 5: 实现 `p5` 双 viewer attention 分支**

准备 PDF、委托并从 server `case_started` 打开 candidate deep link；保存 URL。切 recruiter session，从“人才 → 在谈 → 简历提交”打开同一 Case，等待并断言：

```text
AI 服务暂时不可用，本 Case 尚未继续
需注意
```

recruiter 不得出现 exact button `重试校验`。reload 后复读；再切 candidate，打开保存的 URL，复读同一说明并断言同样没有 `重试校验`。浏览器不得调用 internal terminalization；cleanup owner 负责 P5 收敛。

- [ ] **Step 6: 收紧 `happy` 到公开 terminal**

保留当前 P6 ready/accept、PDF、delegation、candidate evaluation、recruiter `screen_resume` 和双方 S2 协调。保存 candidate/recruiter 两个公开 Case URL，然后最多循环 6 轮：

```bash
advance_to_terminal_for_role(){
  local session="$1" url="$2" body
  export AGENT_BROWSER_SESSION="$session"
  ab open "$url" >/dev/null
  body="$(ab get text body 2>/dev/null || printf '')"
  case "$body" in
    *'双方已确认，正在创建会话'*|*'真人会话已建立'*|*'已结束'*) return 0 ;;
  esac
  if has_button_exact '接受'; then click_button_exact '接受'; return 1; fi
  if has_button_exact '确认意向'; then click_button_exact '确认意向'; return 1; fi
  echo 'Case 尚未终结且当前 viewer 没有合法推进动作' >&2
  return 2
}
```

调用方分别推进两端并 reload，直到两端都看到 terminal marker；`2` 立即失败，`1` 表示已发送一个公开动作后继续。最终两端都断言没有 `接受`、`确认意向`、`婉拒意向`。深链只使用从页面取得的 server URL。

由于宿主脚本启用 `set -e`，调用点必须在条件上下文中捕获返回码，不能裸调用：

```bash
rc=0
advance_to_terminal_for_role "$session" "$url" || rc=$?
case "$rc" in
  0) terminal=1 ;;
  1) terminal=0 ;;
  *) echo "${session} Case 无法合法推进到终态" >&2; return 1 ;;
esac
```

- [ ] **Step 7: 加入闭合 dispatcher**

所有函数定义之后、任何登录之前：

```bash
case "${HOSTED_AGENT_SCENE:-}" in
  happy) run_happy ;;
  p4) run_p4 ;;
  p5) run_p5 ;;
  p6) run_p6 ;;
  *) echo 'HOSTED_AGENT_SCENE 必须是 happy|p4|p5|p6' >&2; exit 2 ;;
esac

MILESTONE='完成'
write_journey_result "$JOURNEY" pass "$MILESTONE"
```

每个 `run_*` 只在全部正/负断言通过后 return 0；分片只在统一出口写一次。

- [ ] **Step 8: 运行 GREEN 并提交**

```bash
bash e2e/真实后端/旅程/HostedAgent闭环.test.sh
npm run test:agent-browser:shell
bash -n e2e/真实后端/旅程/HostedAgent闭环.sh
git diff --check
git add package.json e2e/真实后端/旅程/HostedAgent闭环.sh e2e/真实后端/旅程/HostedAgent闭环.test.sh
git commit -m "test(e2e): cover hosted agent acceptance scenes"
```

Expected: hermetic scene tests与完整 shell gate PASS；没有真实 Provider 调用。

---

### Task 6: 运行前端权威门与真实双轨集成验收

**Files:**
- Verify only: Tasks 1-5 修改的全部文件
- Evidence only: gitignored `agent-browser-backend-output/<run-id>/...`

**Interfaces:**
- Hosted: 只有五轮 child 和五轮 cleanup 都通过才能写 `hosted_agent_integration: PASS`。
- CRUD before baseline: `crud_runner_integration: BLOCKED_BY_BACKEND_BASELINE_FIXTURE`。
- CRUD after baseline: 同一前端 commit 跑完五条普通 journey 和 cleanup 才能 PASS。

- [ ] **Step 1: 核对最终差异没有越界**

```bash
git status --short
git diff --stat "$(git merge-base HEAD origin/main)"...HEAD
git diff --name-only "$(git merge-base HEAD origin/main)"...HEAD
git diff --check "$(git merge-base HEAD origin/main)"...HEAD
```

Expected: 除已批准 Spec/Plan 外，只出现本 Plan 文件结构列出的 E2E/package 文件；不出现 `src/`、视觉 PNG、后端文件或 tracked runtime evidence。

- [ ] **Step 2: 运行完整前端 gate**

```bash
npm run test
npm run test:agent-browser:unit
npm run test:agent-browser:shell
npm run typecheck
npm run lint
npm run build
```

Expected: 全部 exit 0。串行运行，不复用旧 PASS。

- [ ] **Step 3: 核对后端并运行真实 CRUD dependency probe**

```bash
git -C /Users/visionclaw/agxp-monorepo fetch origin release/0.2.5
BACKEND_E2E_SHA="$(git -C /Users/visionclaw/agxp-monorepo rev-parse origin/release/0.2.5)"
[ "$BACKEND_E2E_SHA" = 'c4d99e2db5d8e9ba3b5387fb66ac07d80584b25e' ] \
  || { echo 'dependency_drift: requires_replan' >&2; exit 1; }
BACKEND_E2E_PARENT="$(mktemp -d /tmp/agxp-backend-e2e.XXXXXXXX)"
BACKEND_E2E_DIR="$BACKEND_E2E_PARENT/backend"
git -C /Users/visionclaw/agxp-monorepo worktree add --detach "$BACKEND_E2E_DIR" "$BACKEND_E2E_SHA"
AGXP_MONOREPO_DIR="$BACKEND_E2E_DIR" npm run test:agent-browser:backend-local
```

不得清理或修改原 backend dirty checkout。当前冻结 SHA 的 Expected 固定为 exit 75：五条普通 journey blocked、fixture converge 为 `BLOCKED(BLOCKED_BY_BACKEND_BASELINE_FIXTURE)`、零 Vite/browser/receipt。记录 `BACKEND_E2E_SHA` 和 `BACKEND_E2E_DIR`，Step 4 必须复用同一目录。未来 baseline commit 合入后，先把本 Plan 的后端基线重新冻结到已审查的精确 SHA；这只更新集成输入，不需要修改前端代码。

- [ ] **Step 4: 运行真实 Hosted 五轮 suite**

确认无 default stack 占用 profile、`localhost:5173` 未占用，真实 Provider/model access/enrollment 已由 backend bootstrap 准备；不得打印凭据。运行：

```bash
AGXP_MONOREPO_DIR="$BACKEND_E2E_DIR" npm run test:agent-browser:hosted-agent
```

Expected: `happy, happy, p4, p5, p6`；每轮独立 report，fixture 都是 `converge=PASS verify=PASS cleanup=PASS`。任一轮失败就保留 receipt/evidence，使用 `superpowers:systematic-debugging`；不得继续后续轮或写 PASS。

只有 CRUD/Hosted 两次运行都没有遗留 receipt、wrapper 已安全 down 自己的 stack 时，才执行：

```bash
case "$BACKEND_E2E_DIR" in
  /tmp/agxp-backend-e2e.*/backend) : ;;
  *) echo '拒绝移除未验证的 backend worktree 路径' >&2; exit 1 ;;
esac
[ ! -e "$BACKEND_E2E_DIR/apps/recruitment/.local-dev/browser-fixtures" ] \
  || [ -z "$(find "$BACKEND_E2E_DIR/apps/recruitment/.local-dev/browser-fixtures" -type f -print -quit 2>/dev/null)" ] \
  || { echo 'backend receipt 尚未退休，保留 worktree' >&2; exit 1; }
git -C /Users/visionclaw/agxp-monorepo worktree remove --force "$BACKEND_E2E_DIR"
rmdir "$BACKEND_E2E_PARENT"
```

`--force` 只用于上面刚由 `mktemp` 创建、路径和 receipt 都已验证的 disposable detached worktree，以清掉 `dev-local` 生成的 ignored material；cleanup 未完成时保留 worktree 和 receipt，交接中报告路径，不得强制 remove。

- [ ] **Step 5: 检查 evidence hygiene 与工作树**

```bash
rg -n '__Host-agxp_recruitment_session|Authorization:|Bearer |Cookie:|Set-Cookie:|task_id|global_identity|provider|model' \
  agent-browser-backend-output --glob '*.{json,md,log,txt}'
git status --short
```

Expected: `rg` 无敏感命中；工作树只有 gitignored evidence，不含 tracked 改动。

- [ ] **Step 6: 写真实交接结论**

交接写前端/后端 commit、各 gate 命令与退出码、Hosted 五轮 run directory，并如实选择：

```text
hosted_agent_integration: PASS
crud_runner_integration: BLOCKED_BY_BACKEND_BASELINE_FIXTURE
```

或后端 baseline 已合入且真实 CRUD 通过时：

```text
hosted_agent_integration: PASS
crud_runner_integration: PASS
```

如果验证没有产生 tracked 修复，不创建空 commit。若发现实现缺陷，回到对应 Task 做 RED→GREEN并提交，然后从 Step 2 重跑全部最终 gate。
