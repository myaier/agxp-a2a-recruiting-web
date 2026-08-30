#!/usr/bin/env bash
# 整栈运行器的 fake-runtime 合同测试。
#
# 沙盒里搭一个「只有编排层是真的」的最小前端仓库：
#   e2e/真实后端/运行整栈验收.sh   → 符号链接到真实运行器（被测对象）
#   e2e/真实后端/报告命令.ts       → 符号链接到真实报告 CLI（真跑 tsx，真读分片、真比像素）
#   e2e/真实后端/公共步骤.sh       → 薄壳：先 source 真实公共步骤库，只把 会话隔离门 换成可控假件
#   e2e/真实后端/旅程/*.sh         → 四个假旅程：写真分片、拷真 PNG，按环境变量决定成败
#   node_modules                   → 符号链接到真实依赖（tsx / pngjs / pixelmatch）
# PATH 前面挂上假的 agent-browser / npm / curl / docker，AGXP_MONOREPO_DIR 指向假后端脚本。
#
# 所以这份测试证明的是编排：谁被调用、按什么顺序、拿到什么退出码、留下什么产物。
# 假件一律 DENY 形状：命令拼错、少传参数、换端口、换会话名、开第三个会话、down 带 --volumes，
# 假件都会记一条 FAKE 行并非零退出，让回归变红而不是悄悄通过。
#
# 标识符一律 ASCII：macOS /bin/bash 是 3.2，不认非 ASCII 变量名。
# 跑法：bash e2e/真实后端/运行整栈验收.test.sh

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
RUNNER="$ROOT_DIR/运行整栈验收.sh"
REAL_LIB="$ROOT_DIR/公共步骤.sh"

FAILURES=0
CURRENT_CASE=''

testcase(){ CURRENT_CASE="$1"; printf '\n# %s\n' "$1"; }
ok(){ printf 'ok   %s\n' "$1"; }
bad(){ printf 'FAIL %s · %s\n' "$CURRENT_CASE" "$1" >&2; FAILURES=$((FAILURES + 1)); }
assert_true(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }
assert_false(){ if eval "$2"; then bad "$1"; else ok "$1"; fi; }
assert_eq(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1（期望 $3，实到 $2）"; fi; }
assert_contains(){ if grep -Fq -- "$2" "$3" 2>/dev/null; then ok "$1"; else bad "$1（找不到：$2）"; fi; }
assert_missing(){ if grep -Fq -- "$2" "$3" 2>/dev/null; then bad "$1（不该出现：$2）"; else ok "$1"; fi; }

SCENE_LIST='candidate-resume-loaded candidate-intentions-loaded candidate-disclosure-loaded candidate-resume-updated recruiter-card-loaded recruiter-company-loaded recruiter-jobs-after-create'

# ── 沙盒 ────────────────────────────────────────────────────────────

SANDBOX_PARENT="$REPO_ROOT/agent-browser-backend-output"
mkdir -p "$SANDBOX_PARENT"
SANDBOX_ROOT="$(mktemp -d "$SANDBOX_PARENT/runner-test.XXXXXX")"
kill_fake_vite(){
  local pid
  pid="$(cat "$STATE/vite-pid" 2>/dev/null || true)"
  [ -n "$pid" ] && kill "$pid" 2>/dev/null
  rm -f "$STATE/vite-pid"
  return 0
}
cleanup_all(){
  kill_fake_vite
  rm -rf "$SANDBOX_ROOT"
  rmdir "$SANDBOX_PARENT" 2>/dev/null || true
}
trap cleanup_all EXIT

SANDBOX="$SANDBOX_ROOT/repo"
BIN="$SANDBOX_ROOT/bin"
STATE="$SANDBOX_ROOT/state"
MONO="$SANDBOX_ROOT/monorepo"
CALLS="$SANDBOX_ROOT/calls.txt"
RED_PNG="$SANDBOX_ROOT/red.png"
BLUE_PNG="$SANDBOX_ROOT/blue.png"

mkdir -p "$SANDBOX/e2e/真实后端/旅程" "$SANDBOX/e2e/真实后端/视觉" "$BIN" "$STATE" \
  "$MONO/apps/recruitment/scripts" "$MONO/apps/recruitment/.local-dev"
ln -s "$REPO_ROOT/node_modules" "$SANDBOX/node_modules"
ln -s "$RUNNER" "$SANDBOX/e2e/真实后端/运行整栈验收.sh"
ln -s "$ROOT_DIR/报告命令.ts" "$SANDBOX/e2e/真实后端/报告命令.ts"

# 两张真 PNG：同尺寸纯色对比给 pass，异尺寸给 100% 漂移（比较器对尺寸不同直接判 blocked）。
node -e '
const { PNG } = require("'"$REPO_ROOT"'/node_modules/pngjs");
const fs = require("fs");
function solid(w, h, rgb, out) {
  const p = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i += 1) {
    p.data[i * 4] = rgb[0]; p.data[i * 4 + 1] = rgb[1]; p.data[i * 4 + 2] = rgb[2]; p.data[i * 4 + 3] = 255;
  }
  fs.writeFileSync(out, PNG.sync.write(p));
}
solid(8, 8, [200, 30, 30], "'"$RED_PNG"'");
solid(8, 8, [30, 30, 200], "'"$BLUE_PNG"'");
' || { echo '无法生成测试 PNG' >&2; exit 1; }

# ── 假的公共步骤库：真库 + 可控的 会话隔离门 ────────────────────────
cat >"$SANDBOX/e2e/真实后端/公共步骤.sh" <<SHIM
# shellcheck shell=bash
. "$REAL_LIB"
会话隔离门(){
  printf 'isolation session=%s\n' "\${AGENT_BROWSER_SESSION:-unset}" >>"\$CALLS"
  local status='pass' rc=0
  if [ "\${FAKE_ISOLATION_RC:-0}" != '0' ]; then status='failed'; rc=1; fi
  mkdir -p "\$(_fragment_dir)"
  jq -n --arg s "\$status" '{schemaVersion:1,journey:"session-isolation",status:\$s,milestone:"完成",
    apiRequests:["GET /api/v1/me/resume"],consoleErrors:[],pageErrors:[],failedRequests:[],screenshots:[],
    failure:(if \$s=="pass" then null else "双会话隔离门失败" end)}' >"\$(_fragment_dir)/session-isolation.json"
  return "\$rc"
}
SHIM

# ── 四个假旅程 ──────────────────────────────────────────────────────
write_fake_journey(){
  cat >"$SANDBOX/e2e/真实后端/旅程/$1" <<'JOURNEY'
#!/usr/bin/env bash
set -u
case "$(basename "$0")" in
  候选数据加载.sh) J='candidate-load'; ROLE='candidate'; SCENES='candidate-resume-loaded candidate-intentions-loaded candidate-disclosure-loaded' ;;
  候选CRUD.sh)     J='candidate-crud'; ROLE='candidate'; SCENES='candidate-resume-updated' ;;
  招聘数据加载.sh) J='recruiter-load'; ROLE='recruiter'; SCENES='recruiter-card-loaded recruiter-company-loaded' ;;
  招聘CRUD.sh)     J='recruiter-crud'; ROLE='recruiter'; SCENES='recruiter-jobs-after-create' ;;
  *) echo "FAKE journey 未知脚本名 $0" >>"$CALLS"; exit 1 ;;
esac
printf 'journey %s fragmentdir=%s\n' "$J" "${FRAGMENT_DIR:-unset}" >>"$CALLS"

# DENY：编排层必须把这些环境交到旅程手上，少一个就红
for v in RUN_DIR FRAGMENT_DIR PRIVATE_JOURNAL AGXP_MONOREPO_DIR FRONTEND_ORIGIN BROWSER_FIXTURE_RUN_ID; do
  eval "have=\${$v:-}"
  [ -n "$have" ] || { printf 'FAKE journey %s 缺少环境 %s\n' "$J" "$v" >>"$CALLS"; exit 1; }
done
[ "$FRONTEND_ORIGIN" = 'http://localhost:5173' ] || { printf 'FAKE journey %s 页面源非法：%s\n' "$J" "$FRONTEND_ORIGIN" >>"$CALLS"; exit 1; }
[ -f "$PRIVATE_JOURNAL" ] || { printf 'FAKE journey %s 台账不存在\n' "$J" >>"$CALLS"; exit 1; }

status='pass'; rc=0
case " ${FAKE_JOURNEY_FAIL:-} " in *" $J "*) status='failed'; rc=1 ;; esac
# 环境阻塞（设计稿 §14）：旅程写 blocked 分片并以 75 退出，例如本机 OTP 材料超时。
case " ${FAKE_JOURNEY_BLOCK:-} " in *" $J "*) status='blocked'; rc=75 ;; esac

mkdir -p "$FRAGMENT_DIR"
if [ "$status" = 'pass' ]; then
  mkdir -p "$RUN_DIR/visual/$ROLE"
  for s in $SCENES; do cp "${FAKE_SCENE_PNG}" "$RUN_DIR/visual/$ROLE/$s.png"; done
fi
jq -n --arg j "$J" --arg s "$status" \
  '{schemaVersion:1,journey:$j,status:$s,milestone:"完成",
    apiRequests:["GET /api/v1/me/resume"],consoleErrors:[],pageErrors:[],failedRequests:[],
    screenshots:[],failure:(if $s=="pass" then null
                            elif $s=="blocked" then "假旅程按要求环境阻塞"
                            else "假旅程按要求失败" end)}' \
  >"$FRAGMENT_DIR/$J.json"

if [ "${FAKE_LEAK:-0}" = '1' ] && [ "$J" = 'recruiter-crud' ]; then
  printf 'Authorization: Bearer redactme\n' >"$RUN_DIR/leak-diagnostics.log"
fi
# consoleErrors 会被报告原样带进 report.json：种在这里才能证明派生产物也不留泄漏
if [ "${FAKE_LEAK:-0}" = '2' ] && [ "$J" = 'recruiter-crud' ]; then
  jq -n --arg j "$J" '{schemaVersion:1,journey:$j,status:"pass",milestone:"完成",
    apiRequests:["GET /api/v1/me/resume"],
    consoleErrors:["Set-Cookie: __Host-agxp_recruitment_session=leaked"],
    pageErrors:[],failedRequests:[],screenshots:[],failure:null}' >"$FRAGMENT_DIR/$J.json"
fi

if [ "${FAKE_JOURNEY_SIGINT:-}" = "$J" ]; then kill -INT "$PPID" 2>/dev/null || true; sleep 2; fi
exit "$rc"
JOURNEY
  chmod +x "$SANDBOX/e2e/真实后端/旅程/$1"
}
write_fake_journey 候选数据加载.sh
write_fake_journey 候选CRUD.sh
write_fake_journey 招聘数据加载.sh
write_fake_journey 招聘CRUD.sh

# ── 假 agent-browser ────────────────────────────────────────────────
cat >"$BIN/agent-browser" <<'FAKE'
#!/usr/bin/env bash
set -u
printf 'agent-browser %s\n' "$*" >>"$CALLS"
[ "${AGENT_BROWSER_HEADED:-0}" = '1' ] && printf 'headed-env\n' >>"$CALLS"
session=''
while [ $# -gt 0 ]; do
  case "$1" in
    --session) session="${2:-}"; shift 2 ;;
    --version) printf '%s\n' "${FAKE_AB_VERSION:-agent-browser 0.27.2}"; exit 0 ;;
    --json|--headed) shift ;;
    *) break ;;
  esac
done
case "${1:-}" in
  doctor) exit "${FAKE_DOCTOR_RC:-0}" ;;
esac
case "$session" in
  backend-local-candidate|backend-local-recruiter) : ;;
  *) printf 'FAKE agent-browser 非法会话「%s」：%s\n' "$session" "$*" >>"$CALLS"; exit 1 ;;
esac
case "$*" in
  *--all*) printf 'FAKE agent-browser 禁止 --all：%s\n' "$*" >>"$CALLS"; exit 1 ;;
esac
case "$1" in
  open)
    case "${2:-}" in
      http://localhost:5173/*|http://localhost:5173) exit 0 ;;
      *) printf 'FAKE agent-browser 非法地址：%s\n' "${2:-}" >>"$CALLS"; exit 1 ;;
    esac ;;
  eval)
    # 两种探测走同一个 eval：UA（摘 Chrome 构建）与 locale/timezone（核对冻结的取景环境）。
    # 输出照真 CLI 的样子做成 JSON 字符串（真机实测 agent-browser 0.27.2 会带两侧引号），
    # 不带引号的假件会把「运行器忘了剥引号」这种回归藏起来。
    case "${2:-}" in
      *navigator.language*|*resolvedOptions*)
        printf '"%s %s"\n' "${FAKE_LOCALE:-zh-CN}" "${FAKE_TZ:-Asia/Shanghai}" ;;
      *)
        printf '"%s"\n' "${FAKE_UA:-Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.55 Mobile Safari/537.36}" ;;
    esac
    exit 0 ;;
  close) printf 'closed %s\n' "$session" >>"$CALLS"; exit 0 ;;
  reload|wait|find|get|set) exit "${FAKE_LOGOUT_RC:-0}" ;;
  *) printf 'FAKE agent-browser 未预期命令：%s\n' "$*" >>"$CALLS"; exit 1 ;;
esac
FAKE
chmod +x "$BIN/agent-browser"

# ── 假 npm（只认运行器那一条 dev 命令）────────────────────────────
cat >"$BIN/npm" <<'FAKE'
#!/usr/bin/env bash
set -u
printf 'npm %s\n' "$*" >>"$CALLS"
if [ "$*" != 'run dev -- --host localhost --port 5173 --strictPort' ]; then
  printf 'FAKE npm 未预期命令：%s\n' "$*" >>"$CALLS"
  exit 1
fi
[ "${VITE_DATA_SOURCE:-}" = 'backend' ] || { printf 'FAKE npm 缺少 VITE_DATA_SOURCE=backend\n' >>"$CALLS"; exit 1; }
[ "${VITE_BACKEND_ENV:-}" = 'local' ] || { printf 'FAKE npm 缺少 VITE_BACKEND_ENV=local\n' >>"$CALLS"; exit 1; }
[ "${FAKE_VITE_START_RC:-0}" = '0' ] || exit 1
printf '%s' "$$" >"$STATE/vite-pid"
trap 'rm -f "$STATE/vite-up"; exit 0' TERM INT
echo 'VITE FAKE ready on http://localhost:5173/'
: >"$STATE/vite-up"
i=0
while [ "$i" -lt 900 ]; do sleep 0.2; i=$((i + 1)); done
FAKE
chmod +x "$BIN/npm"

# ── 假 curl / docker ────────────────────────────────────────────────
cat >"$BIN/curl" <<'FAKE'
#!/usr/bin/env bash
set -u
printf 'curl %s\n' "$*" >>"$CALLS"
case "$*" in
  *127.0.0.1:5173*|*:5174*|*:5175*) printf 'FAKE curl 禁止的地址：%s\n' "$*" >>"$CALLS"; exit 1 ;;
esac
case "$*" in
  *http://localhost:5173*) : ;;
  *) printf 'FAKE curl 未预期地址：%s\n' "$*" >>"$CALLS"; exit 1 ;;
esac
if [ "${FAKE_PORT_BUSY:-0}" = '1' ] || [ -f "$STATE/vite-up" ]; then exit 0; fi
exit 7
FAKE
chmod +x "$BIN/curl"

cat >"$BIN/docker" <<'FAKE'
#!/usr/bin/env bash
set -u
printf 'docker %s\n' "$*" >>"$CALLS"
exit "${FAKE_DOCKER_RC:-0}"
FAKE
chmod +x "$BIN/docker"

# ── 假后端入口 ──────────────────────────────────────────────────────
cat >"$MONO/apps/recruitment/scripts/dev-local.sh" <<'FAKE'
#!/usr/bin/env bash
set -u
printf 'dev-local %s\n' "$*" >>"$CALLS"
case "${1:-}" in
  health)
    n=$(cat "$STATE/health-calls" 2>/dev/null || printf '0'); n=$((n + 1)); printf '%s' "$n" >"$STATE/health-calls"
    rc="$(printf '%s\n' ${FAKE_HEALTH_SEQ:-0} | tr ' ' '\n' | sed -n "${n}p")"
    [ -n "$rc" ] || rc="$(printf '%s\n' ${FAKE_HEALTH_SEQ:-0} | tr ' ' '\n' | tail -1)"
    exit "$rc" ;;
  prepare) exit "${FAKE_PREPARE_RC:-0}" ;;
  up) exit "${FAKE_UP_RC:-0}" ;;
  bootstrap) exit "${FAKE_BOOTSTRAP_RC:-0}" ;;
  down)
    case "$*" in *--volumes*) printf 'FAKE dev-local down 带了 --volumes\n' >>"$CALLS"; exit 1 ;; esac
    exit 0 ;;
  *) printf 'FAKE dev-local 未预期子命令：%s\n' "$*" >>"$CALLS"; exit 64 ;;
esac
FAKE
chmod +x "$MONO/apps/recruitment/scripts/dev-local.sh"

# 假 browser-fixture.sh。除了记调用，它还复刻真算子的两条关键语义：
#   · 退出码分层：64 usage / 75 BLOCKED（环境）/ 1 FAIL（功能）；
#   · `--ledger` 只认**本轮的 run receipt**（带 candidate / recruiter 两段 owner-list）。
#     传别的文件（比如前端自己的私密 journal）时，两条 reconcile 手臂全部空转，
#     于是本轮留下的临时对象没人清，下一次 converge 就撞上「没有 receipt 能解释它」。
#     这里把这条因果关系原样做出来，正常路径看不出差别、中断路径立刻见红。
cat >"$MONO/apps/recruitment/scripts/browser-fixture.sh" <<'FAKE'
#!/usr/bin/env bash
set -u
printf 'fixture %s\n' "$*" >>"$CALLS"
if [ -z "${BROWSER_FIXTURE_RUN_ID:-}" ]; then echo 'usage: 缺少 BROWSER_FIXTURE_RUN_ID' >&2; exit 64; fi
receipt_dir="$AGXP_MONOREPO_DIR/apps/recruitment/.local-dev/browser-fixtures"
receipt="$receipt_dir/$BROWSER_FIXTURE_RUN_ID.json"
stale="$STATE/stale-temp-object"

# 按调用次序回放退出码，和假 dev-local health 用的是同一套：'1 0' 表示第一次失败、之后成功
seq_rc(){
  local name="$1" seq="$2" n rc
  n=$(cat "$STATE/$name-calls" 2>/dev/null || printf '0'); n=$((n + 1))
  printf '%s' "$n" >"$STATE/$name-calls"
  rc="$(printf '%s\n' $seq | tr ' ' '\n' | sed -n "${n}p")"
  [ -n "$rc" ] || rc="$(printf '%s\n' $seq | tr ' ' '\n' | tail -1)"
  printf '%s' "$rc"
}

case "${1:-}" in
  converge)
    case "$(seq_rc converge "${FAKE_CONVERGE_SEQ:-0}")" in
      0) : ;;
      75) echo 'BLOCKED: 本地栈没起来'; exit 75 ;;
      *) echo 'FAIL: the recruiter baseline jobs are not in place'; exit 1 ;;
    esac
    # 上一轮/本轮留下、又没有任何 run receipt 能解释的临时对象：fail closed，绝不猜。
    if [ -f "$stale" ]; then
      echo 'BLOCKED: the candidate fixture account holds an intention no run receipt accounts for'
      exit 75
    fi
    mkdir -p "$receipt_dir"
    ( umask 077; jq -nc --arg run "$BROWSER_FIXTURE_RUN_ID" \
        '{schema_version:1,run_id:$run,
          candidate:{started_at:"2026-08-30T00:00:00Z",intention_ids:[],file_ids:[]},
          recruiter:{started_at:"2026-08-30T00:00:00Z",job_ids:[]}}' >"$receipt" )
    chmod "${FAKE_RECEIPT_MODE:-600}" "$receipt"
    [ "${FAKE_RECEIPT_MISSING:-0}" = '1' ] && rm -f "$receipt"
    # 「本轮被中断」：浏览器没来得及自己删掉临时对象。只在**第一次** converge 时造，
    # 收尾那一次代表「清理之后重新收敛」，再造一个就模拟不出自愈了。
    if [ "${FAKE_INTERRUPTED:-0}" = '1' ] && [ "$(cat "$STATE/converge-calls" 2>/dev/null)" = '1' ]; then
      : >"$stale"
    fi
    echo 'BROWSER_FIXTURE_CONVERGE PASS' ;;
  verify)
    case "$(seq_rc verify "${FAKE_VERIFY_SEQ:-0}")" in
      0) : ;;
      75) echo 'BLOCKED: verify 期间栈不健康'; exit 75 ;;
      *) echo 'FAIL: the candidate resume baseline is not in place'; exit 1 ;;
    esac
    echo 'BROWSER_FIXTURE_VERIFY PASS' ;;
  cleanup)
    shift
    [ "${1:-}" = '--ledger' ] || { echo 'usage: cleanup 必须带 --ledger'; exit 64; }
    ledger="${2:-}"
    case "$ledger" in /*) : ;; *) echo 'usage: --ledger 必须是绝对路径'; exit 64 ;; esac
    [ -f "$ledger" ] || { echo 'FAIL: 台账文件不存在'; exit 1; }
    # DENY：--ledger 必须是本轮那一份 run receipt，路径与形状都要对得上
    [ "$ledger" = "$receipt" ] \
      || printf 'FAKE fixture cleanup --ledger 不是本轮 run receipt 的路径：%s\n' "$ledger" >>"$CALLS"
    jq -e --arg run "$BROWSER_FIXTURE_RUN_ID" \
      '.run_id == $run and has("candidate") and has("recruiter")' "$ledger" >/dev/null 2>&1 \
      || printf 'FAKE fixture cleanup --ledger 的形状不是 run receipt：%s\n' "$ledger" >>"$CALLS"
    case "$(seq_rc cleanup "${FAKE_CLEANUP_SEQ:-0}")" in
      0) : ;;
      75) echo 'BLOCKED: 拆台过程中本地栈不健康'; exit 75 ;;
      *) echo 'FAIL: cleanup 失败'; exit 1 ;;
    esac
    removed=0
    # 只有 receipt 里真的有这个 role 的段，才有权判定差集并删除。
    if jq -e 'has("candidate")' "$ledger" >/dev/null 2>&1 && [ -f "$stale" ]; then
      rm -f "$stale"; removed=1
    fi
    printf 'BROWSER_FIXTURE_CLEANUP PASS removed_intentions=%s removed_files=%s removed_jobs=%s\n' \
      "$removed" "$removed" "$removed" ;;
  *) echo 'usage: 未知子命令'; exit 64 ;;
esac
FAKE
chmod +x "$MONO/apps/recruitment/scripts/browser-fixture.sh"

export CALLS STATE SANDBOX_ROOT
export PATH="$BIN:$PATH"

# 「运行期工具缺失」那一条用例需要一个除了假件之外什么都没有的 PATH。
# jq 与 node 得单独软链进来：报告本身就是 jq + tsx 写的，而 tsx 的 shebang 是 /usr/bin/env node。
SHIM="$SANDBOX_ROOT/shim"
mkdir -p "$SHIM"
for c in jq node; do ln -sf "$(command -v "$c")" "$SHIM/$c"; done

# ── 每个用例的复位 ──────────────────────────────────────────────────

# 已提交基线的安装布局照设计稿 §「目录树」：清单是 基线/ 的**兄弟**，不在 PNG 目录里面。
#   视觉/基线清单.json
#   视觉/基线/*.png
BASELINE_DIR="$SANDBOX/e2e/真实后端/视觉/基线"
BASELINE_MANIFEST="$SANDBOX/e2e/真实后端/视觉/基线清单.json"
OUT_ROOT="$SANDBOX/agent-browser-backend-output"

reset_case(){
  kill_fake_vite
  rm -rf "$OUT_ROOT" "$BASELINE_DIR" "$MONO/apps/recruitment/.local-dev/browser-fixtures"
  rm -f "$BASELINE_MANIFEST"
  : >"$CALLS"
  rm -f "$STATE/health-calls" "$STATE/vite-up" "$STATE/stale-temp-object"
  rm -f "$STATE/converge-calls" "$STATE/verify-calls" "$STATE/cleanup-calls"
  export AGXP_MONOREPO_DIR="$MONO"
  export FAKE_HEALTH_SEQ='0' FAKE_PREPARE_RC=0 FAKE_UP_RC=0 FAKE_BOOTSTRAP_RC=0
  export FAKE_CONVERGE_SEQ='0' FAKE_VERIFY_SEQ='0' FAKE_CLEANUP_SEQ='0' FAKE_INTERRUPTED=0
  export FAKE_JOURNEY_FAIL='' FAKE_JOURNEY_BLOCK='' FAKE_JOURNEY_SIGINT='' FAKE_ISOLATION_RC=0
  export FAKE_PORT_BUSY=0 FAKE_DOCKER_RC=0 FAKE_DOCTOR_RC=0 FAKE_VITE_START_RC=0 FAKE_LOGOUT_RC=0
  export FAKE_AB_VERSION='agent-browser 0.27.2'
  export FAKE_UA='Mozilla/5.0 (iPhone) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.55 Mobile Safari/537.36'
  # 冻结的取景环境（视觉清单里就是这两个字面量）。agent-browser 0.27.2 没有任何
  # locale / timezone 开关，只能读机器上真实解析出来的值再核对。
  export FAKE_LOCALE='zh-CN' FAKE_TZ='Asia/Shanghai'
  export FAKE_SCENE_PNG="$RED_PNG"
  export FAKE_RECEIPT_MODE=600 FAKE_RECEIPT_MISSING=0 FAKE_LEAK=0
  export UI_VISUAL_GATE='report'
  unset AGENT_BROWSER_HEADED 2>/dev/null || true
}

# $1..: 基线场景 PNG 源；写出七张基线 + 基线清单
setup_baseline(){
  local png="${1:-$RED_PNG}" ab_version="${2:-0.27.2}" s
  mkdir -p "$BASELINE_DIR"
  for s in $SCENE_LIST; do cp "$png" "$BASELINE_DIR/$s.png"; done
  jq -n --arg v "$ab_version" --argjson scenes "$(printf '%s\n' $SCENE_LIST | jq -R . | jq -s .)" \
    '{schemaVersion:1,agentBrowserVersion:$v,chromeBuild:"Chrome/141.0.7390.55",
      viewport:{width:390,height:844},locale:"zh-CN",timezone:"Asia/Shanghai",colorScheme:"light",
      deviceScaleFactor:1,scenes:$scenes,baselineCommit:"0000000"}' >"$BASELINE_MANIFEST"
}

RC=0
OUT="$SANDBOX_ROOT/stdout.txt"
run_runner(){
  RC=0
  bash "$SANDBOX/e2e/真实后端/运行整栈验收.sh" "$@" >"$OUT" 2>&1 || RC=$?
}

# 假 Vite 起过（记下过 PID）而且现在真的没了：只看 vite-up 标记会让「根本没起 Vite」
# 这种回归也算通过。
vite_dead(){
  local pid
  pid="$(cat "$STATE/vite-pid" 2>/dev/null || true)"
  [ -n "$pid" ] || return 1
  kill -0 "$pid" 2>/dev/null && return 1
  return 0
}

run_dir(){ ls -d "$OUT_ROOT"/*/ 2>/dev/null | head -1 | sed 's#/$##'; }
report_json(){ printf '%s' "$(run_dir)/report.json"; }

# ── 用例 ────────────────────────────────────────────────────────────

testcase '已健康的本地栈被复用：不 prepare / 不 up / 不 down'
reset_case; setup_baseline
run_runner
assert_eq '退出码 0' "$RC" 0
assert_contains '探过 health' 'dev-local health' "$CALLS"
assert_missing '没有 prepare' 'dev-local prepare' "$CALLS"
assert_missing '没有 up' 'dev-local up' "$CALLS"
assert_missing '没有 down（不停别人起的栈）' 'dev-local down' "$CALLS"
assert_contains '仍然 bootstrap' 'dev-local bootstrap' "$CALLS"
assert_contains 'fixture converge' 'fixture converge' "$CALLS"
assert_contains 'fixture verify' 'fixture verify' "$CALLS"
assert_contains '用文档里那一条命令起 Vite' 'npm run dev -- --host localhost --port 5173 --strictPort' "$CALLS"
assert_missing '假件没有报告任何未预期调用' 'FAKE ' "$CALLS"
assert_true '报告写出来了' "[ -f '$(report_json)' ]"
assert_eq '分类 PASS' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'PASS'
assert_eq '报告里的退出码 0' "$(jq -r .exitCode "$(report_json)" 2>/dev/null)" '0'
assert_eq '五条旅程都通过' "$(jq -r '[.journeys[]|select(.status=="pass")]|length' "$(report_json)" 2>/dev/null)" '5'
assert_eq '七个视觉场景都通过' "$(jq -r '[.visual.scenes[]|select(.status=="pass")]|length' "$(report_json)" 2>/dev/null)" '7'
assert_eq '栈被记为预先存在' "$(jq -r .stack.preexisting "$(report_json)" 2>/dev/null)" 'true'
assert_true '清理成功后私密目录被删除' "[ ! -d '$(run_dir)/private' ]"
assert_eq '清理成功后后端运行回执被删除' "$(ls "$MONO/apps/recruitment/.local-dev/browser-fixtures" 2>/dev/null | wc -l | tr -d ' ')" '0'
assert_contains '运行 manifest 记了 Chrome 构建' 'Chrome/141.0.7390.55' "$(run_dir)/run-manifest.json"

testcase '收尾：招聘方按企业账号的确认名退出，只关两个具名会话'
assert_contains '招聘确认键用 确认退出企业账号 --exact' '--name 确认退出企业账号 --exact' "$CALLS"
assert_missing '不用候选那一个确认名' '确认退出当前账号' "$CALLS"
assert_eq '候选会话被关一次' "$(grep -c 'closed backend-local-candidate' "$CALLS")" '1'
assert_eq '招聘会话被关一次' "$(grep -c 'closed backend-local-recruiter' "$CALLS")" '1'
assert_eq '一共只关了两个会话' "$(grep -c '^closed ' "$CALLS")" '2'
assert_true '假 Vite 进程已经被终止' "vite_dead"

testcase '不健康的本地栈：prepare/up/health/bootstrap，收尾 down'
reset_case; setup_baseline
export FAKE_HEALTH_SEQ='1 0'
run_runner
assert_eq '退出码 0' "$RC" 0
assert_contains 'prepare' 'dev-local prepare' "$CALLS"
assert_contains 'up' 'dev-local up' "$CALLS"
assert_contains 'bootstrap' 'dev-local bootstrap' "$CALLS"
assert_contains '自己起的栈自己停' 'dev-local down' "$CALLS"
assert_missing 'down 绝不带 --volumes' 'FAKE dev-local down 带了 --volumes' "$CALLS"
assert_eq '报告记录栈不是预先存在' "$(jq -r .stack.preexisting "$(report_json)" 2>/dev/null)" 'false'
assert_true 'prepare 在 up 之前' "[ \$(grep -n 'dev-local prepare' '$CALLS' | head -1 | cut -d: -f1) -lt \$(grep -n 'dev-local up' '$CALLS' | head -1 | cut -d: -f1) ]"

testcase 'health 起不来：不碰 fixture、不起 Vite、不开浏览器，退出 75，仍然出报告'
reset_case; setup_baseline
export FAKE_HEALTH_SEQ='1 1 1'
run_runner
assert_eq '退出码 75' "$RC" 75
assert_missing '没有 fixture' 'fixture ' "$CALLS"
assert_missing '没有起 Vite' 'npm run dev' "$CALLS"
assert_missing '没有跑旅程' 'journey ' "$CALLS"
assert_missing '没有开会话' 'agent-browser --session' "$CALLS"
assert_contains '自己起的栈仍然被停掉' 'dev-local down' "$CALLS"
# 设计稿 §15：每次运行的报告都带栈健康与 fixture converge/verify —— 阻塞那一次最需要它。
assert_true '栈阻塞也写出了 report.json' "[ -f '$(report_json)' ]"
assert_eq '分类 INFRA_BLOCKED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'INFRA_BLOCKED'
assert_eq '报告记下栈不健康' "$(jq -r .stack.healthy "$(report_json)" 2>/dev/null)" 'false'
assert_eq 'fixture 三步都记 SKIPPED' \
  "$(jq -rc '[.fixture.converge,.fixture.verify,.fixture.cleanup]|join(",")' "$(report_json)" 2>/dev/null)" \
  'SKIPPED,SKIPPED,SKIPPED'

testcase '5173 被占用：不换端口，退出 75，仍然出报告'
reset_case; setup_baseline
export FAKE_PORT_BUSY=1
run_runner
assert_eq '退出码 75' "$RC" 75
assert_missing '没有起 Vite' 'npm run dev' "$CALLS"
assert_missing '没有动本地栈' 'dev-local ' "$CALLS"
assert_missing '没有碰 fixture' 'fixture ' "$CALLS"
assert_missing '没有尝试别的端口' 'FAKE curl 禁止的地址' "$CALLS"
assert_true 'preflight 阻塞也写出了 report.json' "[ -f '$(report_json)' ]"
assert_eq '分类 INFRA_BLOCKED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'INFRA_BLOCKED'
assert_eq '版本读不到时如实写 unknown' \
  "$(jq -r .agentBrowserVersion "$(report_json)" 2>/dev/null)" 'unknown'

testcase 'fixture converge 判 BLOCKED（rc 75）：不起 Vite，退出 75，并且照样出报告'
reset_case; setup_baseline
export FAKE_CONVERGE_SEQ='75 0'
run_runner
assert_eq '退出码 75' "$RC" 75
assert_missing '没有起 Vite' 'npm run dev' "$CALLS"
assert_true '阻塞路径也写出了 report.json' "[ -f '$(report_json)' ]"
assert_eq '分类 INFRA_BLOCKED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'INFRA_BLOCKED'
assert_eq '五条旅程如实记 blocked（不是 pass）' \
  "$(jq -r '[.journeys[]|select(.status=="blocked")]|length' "$(report_json)" 2>/dev/null)" '5'
assert_eq '一条都没被记成 pass' \
  "$(jq -r '[.journeys[]|select(.status=="pass")]|length' "$(report_json)" 2>/dev/null)" '0'
assert_contains '报告带上了栈健康' 'stack' "$(report_json)"
assert_eq 'fixture converge 状态如实入报告' \
  "$(jq -r .fixture.converge "$(report_json)" 2>/dev/null)" 'FAILED(rc=75)'
assert_missing '没有拿假版本号造出渲染器不一致' 'renderer-version-mismatch' "$(report_json)"

# 后端把 FAIL(1) 和 BLOCKED(75) 分得很清楚：基准岗位不在位是**功能**问题，
# README 里有明确的换键补救，报成 INFRA_BLOCKED 会把人引去查 Docker 和端口。
testcase 'fixture converge 判 FAIL（rc 1）：报功能失败退出 1，不报环境阻塞'
reset_case; setup_baseline
export FAKE_CONVERGE_SEQ='1 0'
run_runner
assert_eq '退出码 1（不是 75）' "$RC" 1
assert_missing '没有起 Vite' 'npm run dev' "$CALLS"
assert_contains '打印的是功能失败而不是阻塞' '整栈验收功能失败' "$OUT"
assert_true '功能失败路径也写出了 report.json' "[ -f '$(report_json)' ]"
assert_eq '分类 FUNCTIONAL_FAILED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'FUNCTIONAL_FAILED'
assert_eq '五条旅程如实记 failed' \
  "$(jq -r '[.journeys[]|select(.status=="failed")]|length' "$(report_json)" 2>/dev/null)" '5'
assert_missing '没有 run receipt 时不去调 cleanup' 'fixture cleanup' "$CALLS"
assert_contains '仍然收敛回基准' 'fixture converge' "$CALLS"
assert_contains '仍然收尾 verify' 'fixture verify' "$CALLS"

testcase 'fixture verify 判 FAIL（rc 1）：退出 1，不报环境阻塞'
reset_case; setup_baseline
export FAKE_VERIFY_SEQ='1 0'
run_runner
assert_eq '退出码 1（不是 75）' "$RC" 1
assert_contains '打印的是功能失败' '整栈验收功能失败' "$OUT"
assert_contains '有 run receipt，所以清理照做' 'fixture cleanup --ledger' "$CALLS"

testcase 'fixture verify 判 BLOCKED（rc 75）：退出 75'
reset_case; setup_baseline
export FAKE_VERIFY_SEQ='75 0'
run_runner
assert_eq '退出码 75' "$RC" 75
assert_eq '分类 INFRA_BLOCKED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'INFRA_BLOCKED'

testcase '后端运行回执缺失：拒绝开始旅程'
reset_case; setup_baseline
export FAKE_RECEIPT_MISSING=1
run_runner
assert_eq '退出码 75' "$RC" 75
assert_missing '没有跑旅程' 'journey ' "$CALLS"

testcase '后端运行回执权限不是 0600：拒绝开始旅程'
reset_case; setup_baseline
export FAKE_RECEIPT_MODE=644
run_runner
assert_eq '退出码 75' "$RC" 75
assert_missing '没有跑旅程' 'journey ' "$CALLS"

testcase '一条旅程失败：不依赖它的后续旅程照跑，清理与 verify 照做，退出 1'
reset_case; setup_baseline
export FAKE_JOURNEY_FAIL='candidate-crud'
run_runner
assert_eq '退出码 1' "$RC" 1
assert_contains '招聘数据加载照跑' 'journey recruiter-load' "$CALLS"
assert_contains '招聘 CRUD 照跑' 'journey recruiter-crud' "$CALLS"
assert_missing '依赖候选写入状态的隔离门不跑' 'isolation session=' "$CALLS"
assert_contains '收尾清理' 'fixture cleanup --ledger' "$CALLS"
assert_contains '清理后重新收敛' 'fixture converge' "$CALLS"
assert_contains '收尾 verify' 'fixture verify' "$CALLS"
assert_eq '分类 FUNCTIONAL_FAILED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'FUNCTIONAL_FAILED'
assert_eq '失败旅程记 failed' "$(jq -r '.journeys[]|select(.journey=="candidate-crud")|.status' "$(report_json)" 2>/dev/null)" 'failed'
assert_eq '招聘 CRUD 仍记 pass' "$(jq -r '.journeys[]|select(.journey=="recruiter-crud")|.status' "$(report_json)" 2>/dev/null)" 'pass'

testcase '清理失败：旅程全过也退出 1，私密目录与回执按 0600 保留'
reset_case; setup_baseline
export FAKE_CLEANUP_SEQ='1'
run_runner
assert_eq '退出码 1' "$RC" 1
assert_eq '分类 CLEANUP_FAILED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'CLEANUP_FAILED'
assert_true '私密目录保留' "[ -d '$(run_dir)/private' ]"
assert_eq '台账仍是 0600' "$(stat -f '%Lp' "$(run_dir)/private/run-journal.json" 2>/dev/null)" '600'
assert_true '后端运行回执保留' "[ \$(ls '$MONO/apps/recruitment/.local-dev/browser-fixtures' | wc -l) -eq 1 ]"
assert_contains '打印了私密目录的绝对路径' "$(run_dir)/private" "$OUT"
assert_contains '打印了回执路径' "$MONO/apps/recruitment/.local-dev/browser-fixtures" "$OUT"
assert_contains '把 journal 里的固定保留名称念给人听（它唯一的读者）' '本轮 journal 记下的里程碑' "$OUT"

# 后端 cleanup 判 BLOCKED 是「拆台过程中栈不健康」，不是「临时对象没清掉」。
# 报成 CLEANUP_FAILED 会让人去翻残留数据，而真正坏的是本地栈。
testcase '清理判 BLOCKED（rc 75）：报环境阻塞退出 75，不报清理失败'
reset_case; setup_baseline
export FAKE_CLEANUP_SEQ='75'
run_runner
assert_eq '退出码 75' "$RC" 75
assert_eq '分类 INFRA_BLOCKED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'INFRA_BLOCKED'
assert_contains '清理状态记成 BLOCKED' 'BLOCKED(rc=75)' "$(report_json)"

# C1：`--ledger` 的实参必须是后端自己写的本轮 run receipt。
# 传前端私密 journal 时形状对不上，两条 reconcile 手臂全部空转 —— 正常路径完全看不出来。
testcase 'cleanup 的 --ledger 就是本轮 run receipt（路径与形状都对得上）'
reset_case; setup_baseline
run_runner
assert_eq '退出码 0' "$RC" 0
assert_contains '清理带的是 .local-dev/browser-fixtures 下的回执' \
  "fixture cleanup --ledger $MONO/apps/recruitment/.local-dev/browser-fixtures/" "$CALLS"
assert_missing '绝不把前端私密 journal 当 --ledger' 'private/run-journal.json' "$CALLS"
assert_missing '假件没有报告 ledger 形状问题' 'FAKE fixture cleanup --ledger' "$CALLS"

# 中断过的那一轮：临时对象还在账号里。只有拿 run receipt 做差集才清得掉；
# 拿别的文件当 ledger 会让它留到收尾 converge，撞上「没有 receipt 能解释它」直接关门。
testcase '中断过的运行：收尾按 receipt 差集清掉临时对象，而不是被 converge 关在门外'
reset_case; setup_baseline
export FAKE_INTERRUPTED=1
run_runner
assert_eq '退出码 0（临时对象被差集清掉，收敛与复验都过）' "$RC" 0
assert_eq '分类 PASS' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'PASS'
assert_contains '清理真的按差集删了东西' 'removed_intentions=1' "$(run_dir)/fixture.log"
assert_missing '没有撞上「没有回执能解释这条意向」' 'no run receipt accounts for' "$(run_dir)/fixture.log"
assert_true '临时对象已经不在了' "[ ! -f '$STATE/stale-temp-object' ]"

testcase 'report 门禁下的视觉阻断：只报告，退出 0'
reset_case; setup_baseline "$RED_PNG"
export FAKE_SCENE_PNG="$BLUE_PNG"
run_runner
assert_eq '退出码 0' "$RC" 0
assert_eq '分类 VISUAL_DRIFT' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'VISUAL_DRIFT'
assert_eq '七个场景都判 blocked' "$(jq -r '[.visual.scenes[]|select(.status=="blocked")]|length' "$(report_json)" 2>/dev/null)" '7'

testcase 'enforce 门禁下的视觉阻断：退出 1'
reset_case; setup_baseline "$RED_PNG"
export FAKE_SCENE_PNG="$BLUE_PNG" UI_VISUAL_GATE='enforce'
run_runner
assert_eq '退出码 1' "$RC" 1
assert_eq '分类 VISUAL_DRIFT' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'VISUAL_DRIFT'
assert_eq '门禁记 enforce' "$(jq -r .visual.gate "$(report_json)" 2>/dev/null)" 'enforce'

testcase '渲染器版本不一致且没有 --update-baseline：不产候选基线，退出 75'
reset_case; setup_baseline "$RED_PNG" '0.26.0'
run_runner
assert_eq '退出码 75' "$RC" 75
assert_eq '分类 INFRA_BLOCKED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'INFRA_BLOCKED'
assert_eq '环境问题是 renderer-version-mismatch' "$(jq -r .visual.environmentIssue "$(report_json)" 2>/dev/null)" 'renderer-version-mismatch'
assert_true '没有候选基线目录' "[ ! -d '$(run_dir)/visual/baseline-review' ]"

testcase '渲染器版本不一致 + --update-baseline + 功能全过：产七张候选基线与新旧环境元数据，仍退出 75'
reset_case; setup_baseline "$RED_PNG" '0.26.0'
run_runner --update-baseline
assert_eq '退出码 75' "$RC" 75
assert_eq '候选基线目录里七张 PNG' "$(ls "$(run_dir)"/visual/baseline-review/*.png 2>/dev/null | wc -l | tr -d ' ')" '7'
assert_true '候选基线清单存在' "[ -f '$(run_dir)/visual/baseline-review/基线清单.json' ]"
assert_true '环境审阅文件存在' "[ -f '$(run_dir)/visual/baseline-review/environment-review.json' ]"
assert_contains '记了旧 agent-browser 版本' '0.26.0' "$(run_dir)/visual/baseline-review/environment-review.json"
assert_contains '记了新 agent-browser 版本' '0.27.2' "$(run_dir)/visual/baseline-review/environment-review.json"
assert_true '绝不写进已提交基线目录' "[ \$(ls '$BASELINE_DIR'/*.png | wc -l) -eq 7 ] && ! [ -f '$BASELINE_DIR/environment-review.json' ]"

testcase '基线清单不合法 + --update-baseline：不产候选基线，退出 75'
reset_case; setup_baseline "$RED_PNG"
printf '%s\n' '{"schemaVersion":1,"agentBrowserVersion":"0.27.2"}' >"$BASELINE_MANIFEST"
run_runner --update-baseline
assert_eq '退出码 75' "$RC" 75
assert_eq '环境问题是 manifest-invalid' "$(jq -r .visual.environmentIssue "$(report_json)" 2>/dev/null)" 'manifest-invalid'
assert_true '没有候选基线目录' "[ ! -d '$(run_dir)/visual/baseline-review' ]"

testcase '基线缺图 + --update-baseline：不产候选基线，退出 75'
reset_case; setup_baseline "$RED_PNG"
rm -f "$BASELINE_DIR/recruiter-jobs-after-create.png"
run_runner --update-baseline
assert_eq '退出码 75' "$RC" 75
assert_eq '环境问题是 expected-file-missing' "$(jq -r .visual.environmentIssue "$(report_json)" 2>/dev/null)" 'expected-file-missing'
assert_true '没有候选基线目录' "[ ! -d '$(run_dir)/visual/baseline-review' ]"

# 人按设计稿的目录树装完基线之后，清单是 基线/ 的**兄弟**（视觉/基线清单.json），
# 不在 PNG 目录里面。运行器要是去 基线/ 里面找清单，比较器就会看到「有 PNG 没清单」的
# 半存在状态，把装好基线之后的每一次运行都判成 manifest-invalid → 75。
testcase '按文档布局安装的基线（清单与 基线/ 平级）：不判 manifest-invalid'
reset_case; setup_baseline
assert_true '清单装在 视觉/ 下，与 基线/ 平级' "[ -f '$BASELINE_MANIFEST' ]"
assert_true 'PNG 装在 视觉/基线/ 下' "[ -f '$BASELINE_DIR/candidate-resume-loaded.png' ]"
assert_false '清单不在 PNG 目录里面' "[ -f '$BASELINE_DIR/基线清单.json' ]"
run_runner
assert_eq '退出码 0' "$RC" 0
assert_eq '视觉环境判 matched' "$(jq -r .visual.environment "$(report_json)" 2>/dev/null)" 'matched'
assert_eq '没有环境问题' "$(jq -r '.visual.environmentIssue // "null"' "$(report_json)" 2>/dev/null)" 'null'
assert_missing '报告里没有 manifest-invalid' 'manifest-invalid' "$(report_json)"

# 视觉清单把 locale / timezone 冻死成 zh-CN / Asia/Shanghai，而 agent-browser 0.27.2
# 没有任何开关能设定它们 —— 只能读机器上真实解析出来的值再核对。核不上就是环境阻塞：
# 不核对的话，两台渲染环境其实不同的机器会照样比成 matched。
testcase '浏览器 locale 与冻结值不符：退出 75，仍然出报告'
reset_case; setup_baseline
export FAKE_LOCALE='en-US'
run_runner
assert_eq '退出码 75' "$RC" 75
assert_contains '说清是 locale 对不上' 'locale' "$OUT"
assert_contains '把实到的值念出来' 'en-US' "$OUT"
assert_missing '一条旅程都没跑' 'journey ' "$CALLS"
assert_true '仍然写出了 report.json' "[ -f '$(report_json)' ]"
assert_eq '分类 INFRA_BLOCKED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'INFRA_BLOCKED'

testcase '浏览器时区与冻结值不符：退出 75，仍然出报告'
reset_case; setup_baseline
export FAKE_TZ='America/New_York'
run_runner
assert_eq '退出码 75' "$RC" 75
assert_contains '说清是 timezone 对不上' 'timezone' "$OUT"
assert_contains '把实到的值念出来' 'America/New_York' "$OUT"
assert_true '仍然写出了 report.json' "[ -f '$(report_json)' ]"
assert_eq '分类 INFRA_BLOCKED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'INFRA_BLOCKED'

testcase 'locale 与 timezone 都对得上：照常跑完，退出 0'
reset_case; setup_baseline
run_runner
assert_eq '退出码 0' "$RC" 0
assert_contains '真的探过 locale 与 timezone' 'navigator.language' "$CALLS"

# 只有 jq 与 tsx 有资格排在收尾 trap 前面（报告本身就是它们实现的）。
# 其余运行期工具的检查一旦排在 trap 之前，缺一个就会 75 且一份报告都不留 ——
# 那正是前一轮专门补上的证据缺口。
testcase '运行期工具缺失（agent-browser 不在 PATH）：退出 75，且仍然出报告'
reset_case; setup_baseline
mv "$BIN/agent-browser" "$BIN/agent-browser.off"
SAVED_PATH="$PATH"
PATH="$BIN:$SHIM:/usr/bin:/bin"
run_runner
PATH="$SAVED_PATH"
mv "$BIN/agent-browser.off" "$BIN/agent-browser"
assert_eq '退出码 75' "$RC" 75
assert_contains '说清缺的是哪一个命令' '缺少命令：agent-browser' "$OUT"
assert_true '仍然写出了 report.json' "[ -f '$(report_json)' ]"
assert_eq '分类 INFRA_BLOCKED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'INFRA_BLOCKED'
assert_eq '五条旅程都记 blocked' \
  "$(jq -r '[.journeys[]|select(.status=="blocked")]|length' "$(report_json)" 2>/dev/null)" '5'

testcase 'SIGINT：只关两个具名会话与自己起的 Vite，别人的栈原样保留'
reset_case; setup_baseline
export FAKE_JOURNEY_SIGINT='recruiter-load'
run_runner
assert_eq '按环境阻塞退出 75' "$RC" 75
assert_contains '记下了中断信号' '收到 INT 信号' "$OUT"
assert_eq '候选会话被关一次' "$(grep -c 'closed backend-local-candidate' "$CALLS")" '1'
assert_eq '招聘会话被关一次' "$(grep -c 'closed backend-local-recruiter' "$CALLS")" '1'
assert_eq '没有第三个会话' "$(grep -c '^closed ' "$CALLS")" '2'
assert_missing '没有 close --all' 'FAKE agent-browser 禁止 --all' "$CALLS"
assert_missing '预先存在的栈没被停' 'dev-local down' "$CALLS"
assert_true '假 Vite 已经退出' "vite_dead"

testcase '--headed 通过环境交给 agent-browser，默认不带'
reset_case; setup_baseline
run_runner --headed
assert_eq '退出码 0' "$RC" 0
assert_contains '浏览器侧看到 headed 环境' 'headed-env' "$CALLS"
reset_case; setup_baseline
run_runner
assert_missing '默认不开 headed' 'headed-env' "$CALLS"

testcase '未知参数：任何 stack 变更之前就退出 2'
reset_case; setup_baseline
run_runner --nope
assert_eq '退出码 2' "$RC" 2
assert_eq '一条外部命令都没调' "$(wc -l <"$CALLS" | tr -d ' ')" '0'
assert_true '没有建运行目录' "[ ! -d '$OUT_ROOT' ]"

testcase '未知 journey 值：退出 2'
reset_case; setup_baseline
run_runner --journey candidate-everything
assert_eq '退出码 2' "$RC" 2
assert_eq '一条外部命令都没调' "$(wc -l <"$CALLS" | tr -d ' ')" '0'

testcase '--update-baseline 搭配非 all 的单旅程：退出 2'
reset_case; setup_baseline
run_runner --journey candidate-crud --update-baseline
assert_eq '退出码 2' "$RC" 2
assert_eq '一条外部命令都没调' "$(wc -l <"$CALLS" | tr -d ' ')" '0'
assert_true '没有建运行目录' "[ ! -d '$OUT_ROOT' ]"

testcase '单选一条旅程通过：另外四条写成 skipped 分片，退出 0'
reset_case; setup_baseline
run_runner --journey candidate-crud
assert_eq '退出码 0' "$RC" 0
assert_contains '先跑了同角色的加载前置' 'journey candidate-load' "$CALLS"
assert_contains '跑了被选中的 CRUD' 'journey candidate-crud' "$CALLS"
assert_missing '没有跑招聘旅程' 'journey recruiter-' "$CALLS"
assert_missing '没有跑隔离门' 'isolation session=' "$CALLS"
assert_eq '被选旅程 pass' "$(jq -r '.journeys[]|select(.journey=="candidate-crud")|.status' "$(report_json)" 2>/dev/null)" 'pass'
assert_eq '前置加载仍记 skipped' "$(jq -r '.journeys[]|select(.journey=="candidate-load")|.status' "$(report_json)" 2>/dev/null)" 'skipped'
assert_eq '四条未选旅程都是 skipped' "$(jq -r '[.journeys[]|select(.status=="skipped")]|length' "$(report_json)" 2>/dev/null)" '4'
assert_eq '分类 PASS' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'PASS'
assert_eq '只比这一条旅程的场景' "$(jq -r '[.visual.scenes[]|select(.status=="pass")]|length' "$(report_json)" 2>/dev/null)" '1'
assert_true '前置旅程的真实分片另存一处' "[ -f '$(run_dir)/preconditions/candidate-load.json' ]"

# R2 / 设计稿 §14 失败分类学：前置加载的失败成因必须分两路报。
# 前置分片写进 preconditions/，报告永远读不到它，所以「前置怎么败的」只能由
# 编排层翻译进被选 CRUD 的那一份分片 —— 一律写 skipped 就会把环境问题
# （本机 OTP 材料超时之类）洗成「已选旅程未执行」＝FUNCTIONAL_FAILED/1。
testcase '单旅程模式：加载前置环境阻塞（75）判 INFRA_BLOCKED 退出 75'
reset_case; setup_baseline
export FAKE_JOURNEY_BLOCK='candidate-load'
run_runner --journey candidate-crud
assert_eq '退出码 75（不是 1）' "$RC" 75
assert_eq '分类 INFRA_BLOCKED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'INFRA_BLOCKED'
assert_eq '被选 CRUD 记 blocked（不是 skipped）' \
  "$(jq -r '.journeys[]|select(.journey=="candidate-crud")|.status' "$(report_json)" 2>/dev/null)" 'blocked'
assert_contains '前置确实跑过' 'journey candidate-load' "$CALLS"
assert_missing '前置阻塞后不再跑 CRUD' 'journey candidate-crud' "$CALLS"

# 反方向：前置是普通功能失败时结论必须仍是 FUNCTIONAL_FAILED/1。
# 「前置没过就一律报环境阻塞」会把真实业务失败藏进 75，同样是分类学违规。
testcase '单旅程模式：加载前置功能失败（1）判 FUNCTIONAL_FAILED 退出 1'
reset_case; setup_baseline
export FAKE_JOURNEY_FAIL='candidate-load'
run_runner --journey candidate-crud
assert_eq '退出码 1（不是 75）' "$RC" 1
assert_eq '分类 FUNCTIONAL_FAILED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'FUNCTIONAL_FAILED'
assert_eq '被选 CRUD 记 skipped' \
  "$(jq -r '.journeys[]|select(.journey=="candidate-crud")|.status' "$(report_json)" 2>/dev/null)" 'skipped'
assert_missing '前置失败后不再跑 CRUD' 'journey candidate-crud' "$CALLS"

testcase '产物里出现敏感字面量：判 CLEANUP_FAILED 退出 1'
reset_case; setup_baseline
export FAKE_LEAK=1
run_runner
assert_eq '退出码 1' "$RC" 1
assert_eq '分类 CLEANUP_FAILED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'CLEANUP_FAILED'
assert_contains '打印了卫生扫描命中' '敏感字面量' "$OUT"
assert_true '命中的日志已经删掉' "[ ! -f '$(run_dir)/leak-diagnostics.log' ]"

testcase '泄漏在分片里：分片被删掉，派生的 report.json 里也不留痕'
reset_case; setup_baseline
export FAKE_LEAK=2
run_runner
assert_eq '退出码 1' "$RC" 1
assert_eq '分类 CLEANUP_FAILED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'CLEANUP_FAILED'
assert_true '命中的分片已经删掉' "[ ! -f '$(run_dir)/journeys/recruiter-crud.json' ]"
assert_true '报告仍然写了出来' "[ -f '$(report_json)' ]"
assert_missing '报告里没有 Set-Cookie' 'Set-Cookie:' "$(report_json)"
assert_missing '报告里没有会话 Cookie 名' '__Host-agxp_recruitment_session' "$(report_json)"
assert_missing 'Markdown 报告里也没有' 'Set-Cookie:' "$(run_dir)/report.md"
assert_contains '打印了被删除的文件路径' 'journeys/recruiter-crud.json' "$OUT"

testcase '隔离门失败：按分片判功能失败，收尾照做'
reset_case; setup_baseline
export FAKE_ISOLATION_RC=1
run_runner
assert_eq '退出码 1' "$RC" 1
assert_contains '隔离门真的跑过' 'isolation session=' "$CALLS"
assert_eq '分类 FUNCTIONAL_FAILED' "$(jq -r .classification "$(report_json)" 2>/dev/null)" 'FUNCTIONAL_FAILED'
assert_eq '隔离门分片记 failed' "$(jq -r '.journeys[]|select(.journey=="session-isolation")|.status' "$(report_json)" 2>/dev/null)" 'failed'
assert_eq '四条业务旅程仍记 pass' "$(jq -r '[.journeys[]|select(.status=="pass")]|length' "$(report_json)" 2>/dev/null)" '4'
assert_contains '收尾清理照做' 'fixture cleanup --ledger' "$CALLS"
assert_true '清理成功仍然删私密目录' "[ ! -d '$(run_dir)/private' ]"

testcase '与真实公共步骤库的静态契约'
assert_contains '真库定义了 会话隔离门' '会话隔离门(){' "$REAL_LIB"
assert_contains '真库定义了候选会话名' "CANDIDATE_SESSION='backend-local-candidate'" "$REAL_LIB"
assert_contains '真库定义了招聘会话名' "RECRUITER_SESSION='backend-local-recruiter'" "$REAL_LIB"
assert_contains '真库定义了 SCENE_IDS' 'SCENE_IDS=' "$REAL_LIB"
assert_contains '运行器按库函数方式调隔离门' '会话隔离门' "$RUNNER"
assert_contains '运行器用企业账号确认名收尾' '确认退出企业账号' "$RUNNER"
assert_missing '运行器不按进程名杀进程' 'pkill' "$RUNNER"
assert_missing '运行器不按端口找进程' 'lsof' "$RUNNER"
# C1 的静态护栏：--ledger 只跟 $RECEIPT，私密 journal 永远不进这个参数。
assert_contains '清理用的是后端运行回执' 'cleanup --ledger "$RECEIPT"' "$RUNNER"
assert_missing '私密 journal 绝不当 --ledger' '--ledger "$PRIVATE_JOURNAL"' "$RUNNER"
assert_contains '两个调用点共用同一张退出码翻译表' 'classify_fixture_failure' "$RUNNER"

printf '\n'
if [ "$FAILURES" -eq 0 ]; then
  printf '全部通过\n'
  exit 0
fi
printf '%s 条断言失败\n' "$FAILURES" >&2
exit 1
