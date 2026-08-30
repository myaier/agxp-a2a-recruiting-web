#!/usr/bin/env bash
# 公共步骤库与两条候选旅程的命令合同测试。
#
# 用一个假 agent-browser 顶掉 PATH 上的真命令：它把每一条被下达的命令记进 $CALLS
# （手机号与短信验证码的值就地换成 [REDACTED]），并按状态目录里的桩表回放输出。
# 所以这份测试证明的是「脚本到底对浏览器下了哪些命令」，不是真实 UI 会不会应答 ——
# 真实 UI 那一层由 Task 8 的整栈运行覆盖。
#
# 标识符一律 ASCII：macOS /bin/bash 是 3.2，不认非 ASCII 变量名。
# 跑法：bash e2e/真实后端/公共步骤.test.sh

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB="$ROOT_DIR/公共步骤.sh"
SCENE_LIST_TS="$ROOT_DIR/视觉/场景清单.ts"
LOAD_JOURNEY="$ROOT_DIR/旅程/候选数据加载.sh"
CRUD_JOURNEY="$ROOT_DIR/旅程/候选CRUD.sh"
HR_LOAD_JOURNEY="$ROOT_DIR/旅程/招聘数据加载.sh"
HR_CRUD_JOURNEY="$ROOT_DIR/旅程/招聘CRUD.sh"

# 后端仓库的真实位置要在建沙盒**之前**记下来：new_sandbox 会把 AGXP_MONOREPO_DIR
# 指到沙盒里的假 monorepo，之后再读它就只剩假件了。
REAL_MONOREPO_DIR="${AGXP_MONOREPO_DIR:-}"

FAILURES=0
CURRENT_CASE=''

testcase(){ CURRENT_CASE="$1"; printf '\n# %s\n' "$1"; }
ok(){ printf 'ok   %s\n' "$1"; }
bad(){ printf 'FAIL %s · %s\n' "$CURRENT_CASE" "$1" >&2; FAILURES=$((FAILURES + 1)); }

assert_true(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }
assert_false(){ if eval "$2"; then bad "$1"; else ok "$1"; fi; }
assert_contains(){ if grep -Fq -- "$2" "$3"; then ok "$1"; else bad "$1（找不到：$2）"; fi; }
assert_missing(){ if grep -Fq -- "$2" "$3"; then bad "$1（不该出现：$2）"; else ok "$1"; fi; }
assert_line(){ if grep -Fxq -- "$2" "$3"; then ok "$1"; else bad "$1（没有这一整行：$2）"; fi; }
assert_eq(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1（期望 $3，实到 $2）"; fi; }

# ── 沙盒 ────────────────────────────────────────────────────────────

# 沙盒建在仓库内的 gitignore 目录下（/agent-browser-backend-output/）而不是 /tmp：
# 分片的 screenshots 按 类型.ts 必须是仓库相对路径，RUN_DIR 在仓库外就根本走不到那条路径。
REPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
SANDBOX_PARENT="$REPO_ROOT/agent-browser-backend-output"
mkdir -p "$SANDBOX_PARENT"
SANDBOX_ROOT="$(mktemp -d "$SANDBOX_PARENT/steps-test.XXXXXX")"
trap 'rm -rf "$SANDBOX_ROOT"; rmdir "$SANDBOX_PARENT" 2>/dev/null || true' EXIT

new_sandbox(){
  SANDBOX="$SANDBOX_ROOT/$1"
  rm -rf "$SANDBOX"
  mkdir -p "$SANDBOX/bin" "$SANDBOX/state" "$SANDBOX/run/journeys" "$SANDBOX/monorepo/apps/recruitment/.local-dev"
  mkdir -p "$SANDBOX/run/private"
  chmod 700 "$SANDBOX/run/private"

  CALLS="$SANDBOX/calls.txt"; : >"$CALLS"
  FAKE_STATE="$SANDBOX/state"
  FAKE_OTP_FILE="$SANDBOX/monorepo/apps/recruitment/.local-dev/code"
  # 本地 dev 栈的短信验证码是**固定常量**：后端 dev-local.sh 的 prepare_material 一次性写下
  # LOCAL_OTP，之后每次登录都复用同一份（bootstrap 直接拿常量、health 还会断言文件仍等于它）。
  # 刻意不选全 0 一类的值：手机号 13800000001 里就含 000000，拿它去 grep trace 会假阳性。
  FAKE_OTP='824913'
  RUN_DIR="$SANDBOX/run"
  FRAGMENT_DIR="$SANDBOX/run/journeys"
  PRIVATE_JOURNAL="$SANDBOX/run/private/run-journal.json"
  AGXP_MONOREPO_DIR="$SANDBOX/monorepo"
  FRONTEND_ORIGIN='http://localhost:5173'
  export CALLS FAKE_STATE FAKE_OTP_FILE FAKE_OTP RUN_DIR FRAGMENT_DIR PRIVATE_JOURNAL AGXP_MONOREPO_DIR FRONTEND_ORIGIN
  export PATH="$SANDBOX/bin:$PATH"

  # 验证码文件写一次就再也不动，而且 mtime 停在很久以前 —— 真后端就是这样：
  # 它是一个固定常量，没有任何「本轮刚写下」的新鲜版本可等。
  printf '%s\n' "$FAKE_OTP" >"$FAKE_OTP_FILE"
  touch -t 200001010000 "$FAKE_OTP_FILE"

  printf '%s\n' '浏览器验收候选人 · 真实后端基准摘要' >"$FAKE_STATE/body.txt"
  printf '%s' 'http://localhost:5173/' >"$FAKE_STATE/url.txt"
  : >"$FAKE_STATE/attrs"
  : >"$FAKE_STATE/texts"
  # 输入框/文本域的 value 桩表。同一个键允许写多行：按调用次序依次返回，用尽后停在最后一行 ——
  # 招聘 CRUD 会把同一个字段改掉再改回来，两次读到的本来就该是不同的值
  : >"$FAKE_STATE/values"
  # 「永远等不到」的选择器清单：用来证明 ab wait <selector> 失败时断言真的会失败
  : >"$FAKE_STATE/absent"
  printf '%s\n' '{"success":true,"data":{"height":66,"width":320,"x":35,"y":400},"error":null}' \
    >"$FAKE_STATE/box.json"
  printf '%s\n' '{"success":true,"data":{"requests":[
    {"method":"get","url":"http://localhost:5173/index.html","status":200,"headers":{"Cookie":"绝不能出现"}},
    {"method":"get","url":"http://127.0.0.1:8097/api/v1/me/resume?token=绝不能出现","status":200},
    {"method":"patch","url":"http://127.0.0.1:8097/api/v1/me/privacy","status":200},
    {"method":"get","url":"http://127.0.0.1:8097/api/v1/me/missing","status":404}]},"error":null}' \
    >"$FAKE_STATE/requests.json"
  printf '%s\n' '{"success":true,"data":{"messages":[{"type":"debug","text":"[vite] connected."}]},"error":null}' \
    >"$FAKE_STATE/console.json"
  printf '%s\n' '{"success":true,"data":{"errors":[]},"error":null}' >"$FAKE_STATE/errors.json"

  cat >"$PRIVATE_JOURNAL" <<'JSON'
{
  "schema_version": 1,
  "run_id": "20260830T000000Z-ab12cd",
  "candidate_intention_created": false,
  "candidate_resume_file_names": [],
  "recruiter_job_titles": []
}
JSON
  chmod 600 "$PRIVATE_JOURNAL"

  write_fake_cli
}

write_fake_cli(){
  cat >"$SANDBOX/bin/agent-browser" <<'FAKE'
#!/usr/bin/env bash
# 假 agent-browser。只做两件事：把命令记进 ${CALLS}（敏感值就地脱敏），按桩表回放输出。
set -u
state_dir="$FAKE_STATE"
calls="$CALLS"

line=''; p1=''; p2=''; p3=''
for a in "$@"; do
  shown="$a"
  if [ "$p1" = 'fill' ] && [ "$p3" = 'label' ]; then
    case "$p2" in 手机号|短信验证码) shown='[REDACTED]' ;; esac
  fi
  if [ -z "$line" ]; then line="$shown"; else line="$line $shown"; fi
  p3="$p2"; p2="$p1"; p1="$a"
done
printf '%s\n' "$line" >>"$calls"

lookup(){
  local tbl="$state_dir/$1" want="$2" hit='' k v
  [ -f "$tbl" ] || return 0
  while IFS="$(printf '\t')" read -r k v; do
    if [ "$k" = "$want" ]; then hit="$v"; fi
  done <"$tbl"
  printf '%s' "$hit"
}

# value 桩表按调用次序回放：第 n 次读同一个键就给第 n 行，行用尽后固定在最后一行。
# 序号存盘（每条命令都是独立进程），所以「改掉 → 读到新值 → 改回 → 读到旧值」测得出来。
lookup_value(){
  local tbl="$state_dir/values" want="$1" k v idx idx_file count=0 hit=''
  [ -f "$tbl" ] || return 0
  idx_file="$state_dir/.seq-$(printf '%s' "$want" | cksum | tr -d ' ')"
  idx=0
  [ -f "$idx_file" ] && idx="$(cat "$idx_file")"
  while IFS="$(printf '\t')" read -r k v; do
    if [ "$k" = "$want" ]; then
      if [ "$count" -le "$idx" ]; then hit="$v"; fi
      count=$((count + 1))
    fi
  done <"$tbl"
  if [ "$count" -gt 0 ]; then printf '%s\n' "$((idx + 1))" >"$idx_file"; fi
  printf '%s' "$hit"
}

session=''
if [ "${1:-}" = '--session' ]; then session="$2"; shift 2; fi

case "${1:-}" in
  get)
    case "${2:-}" in
      text) if [ "${3:-}" = 'body' ]; then cat "$state_dir/body.txt" 2>/dev/null; else lookup texts "${3:-}"; fi ;;
      value) lookup_value "${3:-}" ;;
      attr) lookup attrs "${3:-}|${4:-}" ;;
      box) cat "$state_dir/box.json" 2>/dev/null ;;
      # 每个会话可以有自己的落点（url.<会话名>.txt）：双会话隔离门要同时表达
      # 「候选已在求职端主壳」和「招聘已在招聘端主壳」，一份 url.txt 说不出两件事
      url)
        if [ -f "$state_dir/url.$session.txt" ]; then cat "$state_dir/url.$session.txt"
        else cat "$state_dir/url.txt" 2>/dev/null; fi
        ;;
      *) : ;;
    esac
    ;;
  wait)
    # 只有 wait <selector> 这一种形态查缺席表；--text / --fn / --load 一律照旧成功
    case "${2:-}" in
      --*) : ;;
      *) if grep -Fxq -- "${2:-}" "$state_dir/absent" 2>/dev/null; then exit 1; fi ;;
    esac
    ;;
  network) cat "$state_dir/requests.json" ;;
  console) cat "$state_dir/console.json" ;;
  errors) cat "$state_dir/errors.json" ;;
  eval) cat >/dev/null; printf 'true\n' ;;
  snapshot) printf '%s\n' '- button "浏览器验收候选人"' ;;
  screenshot) : >"${2:-/dev/null}" ;;
  find)
    # 点「获取验证码」**不会**改写本地验证码文件：真后端写的是一个固定常量，
    # 每次登录都复用同一份。假件曾经在这里重写它，正好把「等文件变新」的死等藏了起来。
    # 滚轮：find nth <序> [aria-label="列名"] [role="option"] click —— 记住这一列落到哪一档
    if [ "${2:-}" = 'nth' ]; then
      col="$(printf '%s' "${4:-}" | sed -n 's/^\[aria-label="\([^"]*\)"\].*/\1/p')"
      if [ -n "$col" ]; then
        printf '[aria-label="%s"] [role="option"][aria-selected="true"]\t%s\n' \
          "$col" "$(( ${3:-0} + 3 ))" >>"$state_dir/texts"
      fi
    fi
    ;;
  *) : ;;
esac
exit 0
FAKE
  chmod +x "$SANDBOX/bin/agent-browser"
}

set_attr(){ printf '%s|%s\t%s\n' "$1" "$2" "$3" >>"$FAKE_STATE/attrs"; }
# 同一个选择器可以调多次：按调用次序依次回放
push_value(){ printf '%s\t%s\n' "$1" "$2" >>"$FAKE_STATE/values"; }
mark_absent(){ printf '%s\n' "$1" >>"$FAKE_STATE/absent"; }

# 缺席类断言（assert_absent / assert_no_mock_data）都是**单次** `get text body`，不自带等待。
# 紧跟在裸 reload 后面时，「这个东西不在页面上」对一张还没水合完的白页同样成立 ——
# 那是一条永远不会为了正确的理由失败的断言。
# 所以规矩是：每一次读 body 之前，如果中间发生过硬刷新，那么从那次刷新到这次读之间
# 必须至少有一条 wait（wait --text / wait <选择器> 都算）把水合等出来。
# 逐条检查所有 body 读，不只是最后一条 —— 否则把某一条缺席断言挪到「刷新之后、水合门之前」
# 仍然能蒙混过关。
assert_body_reads_gated(){
  local ungated
  ungated="$(awk '
    /^--session [^ ]+ reload$/ { last_reload = NR }
    / wait /                   { last_wait = NR }
    / get text body$/          { if (last_reload > last_wait) printf "%d ", NR }
  ' "$CALLS")"
  if [ -z "$ungated" ]; then
    ok "$1"
  else
    bad "$1（这些行号上的 body 读紧跟硬刷新、中间没有任何 wait：${ungated}）"
  fi
}

# 每条记录到的命令都必须显式带上同一个会话，且不含任何被禁的持久化 / 打桩命令
assert_session_and_bans(){
  if grep -vq "^--session $1 " "$CALLS"; then
    bad "每条命令都带 --session $1"
  else
    ok "每条命令都带 --session $1"
  fi
  assert_false '不出现 network route / har / state save / --profile / --session-name / --state' \
    "grep -Eq 'network[[:space:]]+route|network[[:space:]]+har|state[[:space:]]+save|--profile|--session-name|--state' '$CALLS'"
  assert_false '长期路径不出现 @eN 引用' "grep -Eq '(^| )@e[0-9]+( |\$)' '$CALLS'"
}

# ── 1. 候选登录 ─────────────────────────────────────────────────────

testcase '登录候选'
new_sandbox login-candidate
export AGENT_BROWSER_SESSION='backend-local-candidate'
( . "$LIB"; login_candidate ) >"$SANDBOX/stdout.txt" 2>"$SANDBOX/stderr.txt"
assert_eq 'login_candidate 返回 0' "$?" '0'
assert_contains '从站点根地址开场' '--session backend-local-candidate open http://localhost:5173/' "$CALLS"
assert_contains '手机号按 label 填，且值已脱敏' 'find label 手机号 fill [REDACTED]' "$CALLS"
assert_contains '点获取验证码' 'find role button click --name 获取验证码' "$CALLS"
assert_contains '短信验证码按 label 填，且值已脱敏' 'find label 短信验证码 fill [REDACTED]' "$CALLS"
assert_contains '勾选用户协议' 'find role button click --name 已阅读并同意' "$CALLS"
assert_contains '点进入' 'find role button click --name 进入' "$CALLS"
assert_contains '选身份点我要找工作' 'find role button click --name 我要找工作' "$CALLS"
assert_missing 'OTP 不出现在命令记录里' "$FAKE_OTP" "$CALLS"
assert_missing 'OTP 不出现在 stdout' "$FAKE_OTP" "$SANDBOX/stdout.txt"
assert_missing 'OTP 不出现在 stderr' "$FAKE_OTP" "$SANDBOX/stderr.txt"
assert_session_and_bans 'backend-local-candidate'

# 本地 dev 栈的验证码是一个写死的常量：它在 prepare_material 里被写下一次，之后谁都不再动它。
# 所以「等这个文件比点按钮之前更新」这种新鲜度判定永远等不到，会把每一条旅程都拖成超时阻塞。
# 这条用例就是那面墙：文件全程不被改写、mtime 停在 2000 年，登录仍然必须走得通。
testcase '登录候选 · 本地验证码是固定常量（文件从头到尾没被改写过）'
new_sandbox login-static-otp
export AGENT_BROWSER_SESSION='backend-local-candidate'
otp_mtime(){ stat -f %m "$FAKE_OTP_FILE" 2>/dev/null || stat -c %Y "$FAKE_OTP_FILE" 2>/dev/null || printf '0'; }
OTP_MTIME_BEFORE="$(otp_mtime)"
( . "$LIB"; login_candidate ) >"$SANDBOX/stdout.txt" 2>"$SANDBOX/stderr.txt"
assert_eq '静态验证码也能登录' "$?" '0'
assert_eq '整轮登录没有任何人改写过验证码文件' "$(otp_mtime)" "$OTP_MTIME_BEFORE"
assert_contains '照样填了验证码（记录里是脱敏值）' 'find label 短信验证码 fill [REDACTED]' "$CALLS"
assert_missing 'OTP 不出现在命令记录里' "$FAKE_OTP" "$CALLS"

testcase '登录候选 · set -x 下 OTP 不进 trace'
new_sandbox login-xtrace
export AGENT_BROWSER_SESSION='backend-local-candidate'
# xtrace 就是这个控制存在的理由：调试时开 bash -x 不能把本机验证码打出来
( . "$LIB"; set -x; login_candidate ) >"$SANDBOX/stdout.txt" 2>"$SANDBOX/trace.txt"
assert_eq '开着 xtrace 也能登录' "$?" '0'
# 先证明 trace 真的开着，否则下面几条会空过
assert_true 'trace 确实记录了命令（这条用例没有空过）' \
  "grep -q 'find role button click' '$SANDBOX/trace.txt'"
assert_missing 'OTP 不出现在 xtrace' "$FAKE_OTP" "$SANDBOX/trace.txt"
assert_contains '照样填了验证码（记录里是脱敏值）' 'find label 短信验证码 fill [REDACTED]' "$CALLS"

testcase '登录候选 · 已有会话不重登'
new_sandbox login-candidate-restored
export AGENT_BROWSER_SESSION='backend-local-candidate'
printf '%s' 'http://localhost:5173/#/app' >"$FAKE_STATE/url.txt"
( . "$LIB"; login_candidate ) >/dev/null 2>&1
assert_eq '仍然返回 0' "$?" '0'
assert_missing '没有再走一遍验证码' 'find label 短信验证码' "$CALLS"

testcase '登录招聘'
new_sandbox login-recruiter
export AGENT_BROWSER_SESSION='backend-local-recruiter'
( . "$LIB"; login_recruiter ) >/dev/null 2>&1
assert_eq 'login_recruiter 返回 0' "$?" '0'
assert_contains '选身份点我要招人' 'find role button click --name 我要招人' "$CALLS"
assert_session_and_bans 'backend-local-recruiter'

# 设计稿 §14：本机 OTP 材料没准备好是 INFRA_BLOCKED，不是 FUNCTIONAL_FAILED。
# 报成功能失败会让第一个跑这条命令的人去追一个不存在的产品缺陷。
testcase '本地验证码文件缺失：旅程写 blocked 分片，退出 75'
new_sandbox otp-missing
export AGENT_BROWSER_SESSION='backend-local-candidate'
rm -f "$FAKE_OTP_FILE"
bash "$LOAD_JOURNEY" >"$SANDBOX/stdout.txt" 2>"$SANDBOX/stderr.txt"
OTP_RC=$?
assert_eq '旅程按环境阻塞退出 75（不是 1）' "$OTP_RC" '75'
assert_eq '分片记 blocked' "$(jq -r '.status' "$FRAGMENT_DIR/candidate-load.json")" 'blocked'
assert_true '失败摘要说明是环境阻塞' \
  "jq -e '.failure | contains(\"环境阻塞\")' '$FRAGMENT_DIR/candidate-load.json' >/dev/null"
assert_missing 'OTP 值仍然不出现在分片里' "$FAKE_OTP" "$FRAGMENT_DIR/candidate-load.json"

testcase '本地验证码文件为空：同样是环境阻塞，退出 75'
new_sandbox otp-empty
export AGENT_BROWSER_SESSION='backend-local-candidate'
: >"$FAKE_OTP_FILE"
bash "$LOAD_JOURNEY" >"$SANDBOX/stdout.txt" 2>"$SANDBOX/stderr.txt"
OTP_RC=$?
assert_eq '旅程按环境阻塞退出 75（不是 1）' "$OTP_RC" '75'
assert_eq '分片记 blocked' "$(jq -r '.status' "$FRAGMENT_DIR/candidate-load.json")" 'blocked'
assert_true '不曾拿空串当验证码去填' \
  "! grep -q 'find label 短信验证码 fill$' '$CALLS'"

testcase '普通断言失败仍然是功能失败，不会被洗成环境阻塞'
new_sandbox otp-not-blocked
export AGENT_BROWSER_SESSION='backend-local-candidate'
mark_absent '[aria-label="手机号"]'
printf '%s\n' '' >"$FAKE_STATE/body.txt"
bash "$LOAD_JOURNEY" >/dev/null 2>&1
assert_eq '旅程按功能失败退出（非 75）' "$( [ $? -eq 75 ] && echo blocked || echo failed )" 'failed'
assert_eq '分片记 failed' "$(jq -r '.status' "$FRAGMENT_DIR/candidate-load.json")" 'failed'

testcase '会话隔离'
new_sandbox session-guard
export AGENT_BROWSER_SESSION='backend-local-recruiter'
( . "$LIB"; login_candidate ) >/dev/null 2>"$SANDBOX/stderr.txt"
assert_false '候选登录在招聘会话里必须失败' "[ $? -eq 0 ]"
assert_contains '给出会话隔离的原因' '会话隔离' "$SANDBOX/stderr.txt"
assert_eq '一条浏览器命令都没下达' "$(wc -l <"$CALLS" | tr -d ' ')" '0'

# ── 2. 稳定截图 ─────────────────────────────────────────────────────

testcase 'capture_scene'
new_sandbox capture
export AGENT_BROWSER_SESSION='backend-local-candidate'
( . "$LIB"; capture_scene 'candidate-resume-loaded' ) >/dev/null 2>&1
assert_eq 'capture_scene 返回 0' "$?" '0'
assert_true '候选 PNG 落在 $RUN_DIR/visual/candidate 下' \
  "[ -f '$RUN_DIR/visual/candidate/candidate-resume-loaded.png' ]"
assert_contains '钉视口' 'set viewport 390 844' "$CALLS"
assert_contains '钉 light + reduced-motion' 'set media light reduced-motion' "$CALLS"
assert_contains '跑稳定化脚本' 'eval --stdin' "$CALLS"
assert_contains '最后才截图' 'screenshot' "$CALLS"
LINE_VIEWPORT="$(grep -n 'set viewport 390 844' "$CALLS" | head -1 | cut -d: -f1)"
LINE_MEDIA="$(grep -n 'set media light reduced-motion' "$CALLS" | head -1 | cut -d: -f1)"
LINE_STABLE="$(grep -n 'eval --stdin' "$CALLS" | head -1 | cut -d: -f1)"
LINE_SHOT="$(grep -n 'screenshot' "$CALLS" | head -1 | cut -d: -f1)"
assert_true '顺序是 视口 → 媒体 → 稳定化 → 截图' \
  "[ $LINE_VIEWPORT -lt $LINE_MEDIA ] && [ $LINE_MEDIA -lt $LINE_STABLE ] && [ $LINE_STABLE -lt $LINE_SHOT ]"

testcase 'capture_scene 拒绝未知场景'
new_sandbox capture-unknown
export AGENT_BROWSER_SESSION='backend-local-candidate'
( . "$LIB"; capture_scene 'candidate-不存在的场景' ) >/dev/null 2>"$SANDBOX/stderr.txt"
assert_false '未知场景必须失败' "[ $? -eq 0 ]"
assert_contains '说明是未知场景' '未知视觉场景' "$SANDBOX/stderr.txt"
assert_missing '未知场景不许截图' 'screenshot' "$CALLS"

testcase '场景表与 场景清单.ts 单一真相一致'
new_sandbox scene-list
TS_SCENES="$(sed -n '/真实后端场景们 = \[/,/\] as const;/p' "$SCENE_LIST_TS" \
  | sed -n "s/.*'\([a-z-]*\)'.*/\1/p" | tr '\n' ' ' | sed 's/ $//')"
SH_SCENES="$( . "$LIB"; printf '%s' "$SCENE_IDS" )"
assert_eq 'bash 场景表逐字等于 场景清单.ts' "$SH_SCENES" "$TS_SCENES"

# ── 3. 断言原语 ─────────────────────────────────────────────────────

testcase 'assert_pressed'
new_sandbox pressed
export AGENT_BROWSER_SESSION='backend-local-candidate'
set_attr '[aria-label="当前公司：不披露"]' 'aria-pressed' 'true'
set_attr '[aria-label="当前公司：意向确认后"]' 'aria-pressed' 'false'
( . "$LIB"; assert_pressed '当前公司：不披露' ) >/dev/null 2>&1
assert_eq '选中档返回 0' "$?" '0'
( . "$LIB"; assert_pressed '当前公司：意向确认后' ) >/dev/null 2>&1
assert_false '未选中档必须失败' "[ $? -eq 0 ]"
( . "$LIB"; assert_pressed '当前公司：一直允许' ) >/dev/null 2>&1
assert_false '没有 aria-pressed 也必须失败' "[ $? -eq 0 ]"
assert_contains '选择器用产品的可访问名称' 'get attr [aria-label="当前公司：不披露"] aria-pressed' "$CALLS"
assert_missing '不按 CSS module 类名定位' 'class*=' "$CALLS"

testcase 'assert_absent'
new_sandbox absent
export AGENT_BROWSER_SESSION='backend-local-candidate'
( . "$LIB"; assert_absent '浏览器验收招聘官' ) >/dev/null 2>&1
assert_eq '不在页面上时返回 0' "$?" '0'
( . "$LIB"; assert_absent '浏览器验收候选人' ) >/dev/null 2>&1
assert_false '在页面上时必须失败' "[ $? -eq 0 ]"

testcase '左滑行'
new_sandbox swipe
export AGENT_BROWSER_SESSION='backend-local-candidate'
set_attr '[aria-label^="浏览器验收临时简历.pdf"]' 'aria-expanded' 'true'
( . "$LIB"; 左滑行 '浏览器验收临时简历.pdf' ) >/dev/null 2>&1
assert_eq '滑开后返回 0' "$?" '0'
# 定位是语义的：按行面的可访问名称前缀找（完整名是「文件名 + 解析状态」，
# 状态那一段是异步的，旅程无法预知），不是 CSS module 类名、不是 DOM 层级
assert_contains '先按可访问名称前缀量这一行的矩形' \
  'get box [aria-label^="浏览器验收临时简历.pdf"] --json' "$CALLS"
# 几何全部从那个矩形算出来：x=35 w=320 → 0.9/0.1 处是 323 / 67；y=400 h=66 → 433
assert_contains '起点落在这一行右侧' 'mouse move 323 433' "$CALLS"
assert_contains '真的按下鼠标' 'mouse down' "$CALLS"
assert_contains '终点落在这一行左侧' 'mouse move 67 433' "$CALLS"
assert_contains '真的松开鼠标' 'mouse up' "$CALLS"
assert_true '中间至少走三步再落点（滑动行要先判定横向）' \
  "[ $(grep -c '^--session backend-local-candidate mouse move ' "$CALLS") -ge 5 ]"
assert_contains '结束后读产品自己的 aria-expanded 自检' \
  'get attr [aria-label^="浏览器验收临时简历.pdf"] aria-expanded' "$CALLS"
assert_missing '绝不用 eval 造输入事件' 'eval' "$CALLS"
assert_missing '没有 @eN 引用' '@e' "$CALLS"

testcase '左滑行 · 没滑开就失败'
new_sandbox swipe-stuck
export AGENT_BROWSER_SESSION='backend-local-candidate'
set_attr '[aria-label^="浏览器验收临时简历.pdf"]' 'aria-expanded' 'false'
( . "$LIB"; 左滑行 '浏览器验收临时简历.pdf' ) >/dev/null 2>"$SANDBOX/stderr.txt"
assert_false 'aria-expanded 不是 true 必须失败' "[ $? -eq 0 ]"
assert_contains '说明是这一行没展开' '左滑之后没有展开' "$SANDBOX/stderr.txt"

testcase 'assert_value'
new_sandbox value
export AGENT_BROWSER_SESSION='backend-local-recruiter'
push_value '[aria-label="职务"]' '招聘负责人'
( . "$LIB"; assert_value '职务' '招聘负责人' ) >/dev/null 2>&1
assert_eq '逐字相等返回 0' "$?" '0'
assert_contains '先等这个字段出现再读值' 'wait [aria-label="职务"]' "$CALLS"
assert_contains '按产品自己的可访问名称读 value' 'get value [aria-label="职务"]' "$CALLS"
new_sandbox value-prefix
export AGENT_BROWSER_SESSION='backend-local-recruiter'
push_value '[aria-label="职务"]' '浏览器验收招聘负责人'
# 招聘负责人 是 浏览器验收招聘负责人 的后缀：页面文本断言分不开这两个值，逐字相等分得开
( . "$LIB"; assert_value '职务' '招聘负责人' ) >/dev/null 2>"$SANDBOX/stderr.txt"
assert_false '只是子串必须失败' "[ $? -eq 0 ]"
assert_contains '说明是哪个字段的值不对' '职务' "$SANDBOX/stderr.txt"
new_sandbox value-missing
export AGENT_BROWSER_SESSION='backend-local-recruiter'
mark_absent '[aria-label="公司介绍"]'
( . "$LIB"; assert_value '公司介绍' '随便什么' ) >/dev/null 2>&1
assert_false '字段根本没出现也必须失败' "[ $? -eq 0 ]"
assert_missing '等不到就不读值' 'get value' "$CALLS"

testcase 'assert_job_row'
new_sandbox job-row
export AGENT_BROWSER_SESSION='backend-local-recruiter'
( . "$LIB"; assert_job_row '浏览器验收岗位 · 在招基线' '在招' ) >/dev/null 2>&1
assert_eq '在目标分组里返回 0' "$?" '0'
# 行的完整可访问名称是「岗位名 + 当前徽 + 薪资/在谈 + 状态徽」，中间那段随后端数据变，
# 所以只钉两头：前缀＝业务身份，后缀＝它现在在哪一组
assert_contains '按可访问名称的前缀 + 后缀定位这一行' \
  'wait [aria-label^="浏览器验收岗位 · 在招基线"][aria-label$="在招"]' "$CALLS"
assert_missing '不按 CSS module 类名定位' 'class' "$CALLS"
new_sandbox job-row-wrong-group
export AGENT_BROWSER_SESSION='backend-local-recruiter'
mark_absent '[aria-label^="浏览器验收岗位 · 在招基线"][aria-label$="已归档"]'
( . "$LIB"; assert_job_row '浏览器验收岗位 · 在招基线' '已归档' ) >/dev/null 2>&1
assert_false '不在目标分组里必须失败' "[ $? -eq 0 ]"

# ── 4. 私密清理台账 ─────────────────────────────────────────────────

testcase 'record_cleanup_marker'
new_sandbox ledger
export AGENT_BROWSER_SESSION='backend-local-candidate'
( . "$LIB"
  record_cleanup_marker candidate_intention_created true
  record_cleanup_marker candidate_resume_file_names '浏览器验收临时简历.pdf' ) >/dev/null 2>&1
assert_eq '两次记录都成功' "$?" '0'
assert_eq '里程碑落到台账' "$(jq -r '.candidate_intention_created' "$PRIVATE_JOURNAL")" 'true'
assert_eq '固定保留名称落到台账' "$(jq -r '.candidate_resume_file_names[0]' "$PRIVATE_JOURNAL")" '浏览器验收临时简历.pdf'
assert_eq '台账仍是 0600' "$(ls -l "$PRIVATE_JOURNAL" | cut -c2-10)" 'rw-------'
assert_eq '原子替换后没有残留临时文件' \
  "$(find "$SANDBOX/run/private" -name '.run-journal.json.*' | wc -l | tr -d ' ')" '0'
( . "$LIB"; record_cleanup_marker recruiter_job_titles '某个原始ID' ) >/dev/null 2>&1
assert_false '非保留名称必须被拒' "[ $? -eq 0 ]"
( . "$LIB"; record_cleanup_marker some_other_field true ) >/dev/null 2>&1
assert_false '未知字段必须被拒' "[ $? -eq 0 ]"

# ── 5. 旅程结果分片 ─────────────────────────────────────────────────

testcase 'write_journey_result'
new_sandbox fragment
export AGENT_BROWSER_SESSION='backend-local-candidate'
( . "$LIB"; capture_scene 'candidate-resume-loaded'; write_journey_result candidate-load pass 完成 ) \
  >"$SANDBOX/stdout.txt" 2>&1
assert_eq 'pass 分片返回 0' "$?" '0'
FRAGMENT="$FRAGMENT_DIR/candidate-load.json"
assert_eq 'schemaVersion' "$(jq -r '.schemaVersion' "$FRAGMENT")" '1'
assert_eq 'journey' "$(jq -r '.journey' "$FRAGMENT")" 'candidate-load'
assert_eq 'status' "$(jq -r '.status' "$FRAGMENT")" 'pass'
assert_eq 'failure 为空时写 null' "$(jq -r '.failure' "$FRAGMENT")" 'null'
assert_eq 'apiRequests 只留 /api/v1 的 METHOD + pathname（含失败的那条）' \
  "$(jq -rc '.apiRequests' "$FRAGMENT")" \
  '["GET /api/v1/me/missing","GET /api/v1/me/resume","PATCH /api/v1/me/privacy"]'
assert_eq 'failedRequests 只留 METHOD + pathname' \
  "$(jq -rc '.failedRequests' "$FRAGMENT")" '["GET /api/v1/me/missing"]'
# 类型.ts:39 说 screenshots 是仓库相对 artifact 路径，这里就按那个形状断言
assert_eq 'screenshots 是仓库相对路径（不是绝对路径）' \
  "$(jq -r '.screenshots[0]' "$FRAGMENT")" \
  "${RUN_DIR#"$REPO_ROOT"/}/visual/candidate/candidate-resume-loaded.png"
assert_false 'screenshots 里没有绝对路径' "jq -r '.screenshots[]' '$FRAGMENT' | grep -q '^/'"
assert_eq '_repo_relative_path 把仓库内路径转成相对' \
  "$( . "$LIB"; _repo_relative_path "$ROOT_DIR/资源/简历-v1.pdf" )" 'e2e/真实后端/资源/简历-v1.pdf'

assert_missing '分片里没有查询串' 'token=' "$FRAGMENT"
assert_missing '分片里没有 Cookie' 'Cookie' "$FRAGMENT"
assert_missing '分片里没有 host' '127.0.0.1' "$FRAGMENT"
assert_eq '分片字段集合与 旅程结果 完全一致' \
  "$(jq -rc '[keys_unsorted[]]|sort|join(",")' "$FRAGMENT")" \
  'apiRequests,consoleErrors,failedRequests,failure,journey,milestone,pageErrors,schemaVersion,screenshots,status'

testcase 'capture_scene · artifact 落在仓库外必须硬失败'
new_sandbox outside-repo
export AGENT_BROWSER_SESSION='backend-local-candidate'
OUTSIDE_RUN="$(mktemp -d "${TMPDIR:-/tmp}/agxp-outside.XXXXXX")"
( RUN_DIR="$OUTSIDE_RUN"; . "$LIB"; capture_scene 'candidate-resume-loaded' ) \
  >/dev/null 2>"$SANDBOX/stderr.txt"
assert_false '写不出仓库相对路径时不许静默通过' "[ $? -eq 0 ]"
assert_contains '说明原因' '写不出 类型.ts 要求的仓库相对路径' "$SANDBOX/stderr.txt"
rm -rf "$OUTSIDE_RUN"

testcase 'write_journey_result · 零 API 请求判失败'
new_sandbox fragment-no-api
export AGENT_BROWSER_SESSION='backend-local-candidate'
printf '%s\n' '{"success":true,"data":{"requests":[{"method":"get","url":"http://localhost:5173/index.html","status":200}]},"error":null}' \
  >"$FAKE_STATE/requests.json"
( . "$LIB"; write_journey_result candidate-load pass 完成 ) >/dev/null 2>&1
assert_false '没有 /api/v1 请求时返回非 0' "[ $? -eq 0 ]"
assert_eq '分片记为 failed' "$(jq -r '.status' "$FRAGMENT_DIR/candidate-load.json")" 'failed'
assert_contains '写明原因' '没有观测到任何 /api/v1 请求' "$FRAGMENT_DIR/candidate-load.json"

testcase 'write_journey_result · Mock 专属标记判失败'
new_sandbox fragment-mock
export AGENT_BROWSER_SESSION='backend-local-candidate'
printf '%s\n' '沈亦舟' >"$FAKE_STATE/body.txt"
( . "$LIB"; write_journey_result candidate-load pass 完成 ) >/dev/null 2>&1
assert_false 'Mock 标记在屏上时返回非 0' "[ $? -eq 0 ]"
assert_eq '分片记为 failed' "$(jq -r '.status' "$FRAGMENT_DIR/candidate-load.json")" 'failed'
assert_contains '写明原因' 'Mock 专属数据' "$FRAGMENT_DIR/candidate-load.json"

# ── 6. 候选数据加载旅程合同 ─────────────────────────────────────────

testcase '候选数据加载旅程'
new_sandbox journey-load
unset AGENT_BROWSER_SESSION
set_attr '[aria-label="当前公司：不披露"]' 'aria-pressed' 'true'
bash "$LOAD_JOURNEY" >"$SANDBOX/stdout.txt" 2>"$SANDBOX/stderr.txt"
assert_eq '旅程返回 0' "$?" '0'
assert_eq '分片记为 pass' "$(jq -r '.status' "$FRAGMENT_DIR/candidate-load.json")" 'pass'
assert_eq '终止行只报旅程 / 状态 / 里程碑' "$(cat "$SANDBOX/stdout.txt")" 'JOURNEY candidate-load pass 完成'
assert_session_and_bans 'backend-local-candidate'
for scene in candidate-resume-loaded candidate-intentions-loaded candidate-disclosure-loaded; do
  assert_true "拍下 $scene" "[ -f '$RUN_DIR/visual/candidate/$scene.png' ]"
done
assert_eq '只拍属于本旅程的三个场景' "$(ls "$RUN_DIR/visual/candidate" | wc -l | tr -d ' ')" '3'
assert_contains '进「我」这一 Tab' 'find role button click --name 我 --exact' "$CALLS"
assert_contains '语义点进我的简历' 'find role button click --name 我的简历' "$CALLS"
assert_contains '语义点进求职意向' 'find role button click --name 求职意向' "$CALLS"
assert_contains '语义点进披露偏好' 'find role button click --name 披露偏好' "$CALLS"
assert_contains '断言基准摘要' 'wait --text 浏览器验收候选人 · 真实后端基准摘要' "$CALLS"
assert_contains '断言基准意向派生标题' 'wait --text [上海市] 前端开发工程师' "$CALLS"
assert_contains '断言意向配额 1/5' 'wait --text 1/5' "$CALLS"
assert_contains '读披露档的 aria-pressed' 'get attr [aria-label="当前公司：不披露"] aria-pressed' "$CALLS"
assert_true '每个场景之前都硬刷新过一次' \
  "[ $(grep -c '^--session backend-local-candidate reload$' "$CALLS") -ge 3 ]"
assert_false '通过路径的 open 只开站点根地址，不直接改 hash' \
  "grep -E '^--session [^ ]+ open ' '$CALLS' | grep -q '#'"
assert_missing '通过路径不用 snapshot' 'snapshot' "$CALLS"

# ── 7. 候选 CRUD 旅程合同 ───────────────────────────────────────────

testcase '候选 CRUD 旅程'
new_sandbox journey-crud
unset AGENT_BROWSER_SESSION
set_attr '[aria-label="当前公司：不披露"]' 'aria-pressed' 'true'
set_attr '[aria-label="当前公司：意向确认后"]' 'aria-pressed' 'true'
set_attr '[aria-label^="浏览器验收临时简历.pdf"]' 'aria-expanded' 'true'
bash "$CRUD_JOURNEY" >"$SANDBOX/stdout.txt" 2>"$SANDBOX/stderr.txt"
assert_eq '旅程返回 0' "$?" '0'
assert_eq '分片记为 pass' "$(jq -r '.status' "$FRAGMENT_DIR/candidate-crud.json")" 'pass'
assert_eq '终止行不带任何 ID' "$(cat "$SANDBOX/stdout.txt")" 'JOURNEY candidate-crud pass 完成'
assert_session_and_bans 'backend-local-candidate'
assert_true '拍下 candidate-resume-updated' "[ -f '$RUN_DIR/visual/candidate/candidate-resume-updated.png' ]"
assert_eq '本旅程只拍这一个场景' "$(ls "$RUN_DIR/visual/candidate" | wc -l | tr -d ' ')" '1'
assert_contains '用已有的姓名行内编辑做简历更新门' \
  'find label 姓名（递交简历后披露） fill 浏览器验收候选人 · 临时CRUD' "$CALLS"
assert_contains '保存姓名走 Enter' 'press Enter' "$CALLS"
assert_contains '新建意向选冻结的目录城市' 'find role button click --name 上海市 --exact' "$CALLS"
assert_contains '新建意向选冻结的目录职位' 'find role button click --name 前端开发工程师 --exact' "$CALLS"
assert_contains '办公方式选混合（hybrid）' 'find role button click --name 混合' "$CALLS"
assert_contains '薪资下限按 aria-label 限定的那一列定位' \
  'find nth 32 [aria-label="薪资下限"] [role="option"] click' "$CALLS"
assert_contains '新建时薪资上限落 45' 'find nth 42 [aria-label="薪资上限"] [role="option"] click' "$CALLS"
assert_contains '编辑把薪资上限改到 50' 'find nth 47 [aria-label="薪资上限"] [role="option"] click' "$CALLS"
assert_contains '删除临时意向' 'find role button click --name 删除 --exact' "$CALLS"
assert_contains '披露档改到意向确认后' 'find role button click --name 当前公司：意向确认后 --exact' "$CALLS"
assert_contains '披露档还原成不披露' 'find role button click --name 当前公司：不披露 --exact' "$CALLS"
assert_contains '上传固定保留名称的临时 PDF' 'upload input[type="file"]' "$CALLS"
assert_contains '过 AI 识别授权层' 'find role button click --name 同意并继续 --exact' "$CALLS"
assert_contains '左滑附件行（语义定位 + 自身矩形 + 真实鼠标输入）' \
  'get box [aria-label^="浏览器验收临时简历.pdf"] --json' "$CALLS"
assert_contains '滑开后点替换' 'find role button click --name 替换 --exact' "$CALLS"
assert_contains '滑开后点删除' 'find role button click --name 删除 --exact' "$CALLS"
assert_contains '过删除确认层' 'find role button click --name 删除附件简历 --exact' "$CALLS"
# 删除后只断言「这一行消失」。断言空态文案会把「账号里另有一份合法既有附件」
# 误判成旅程失败 —— candidate_converge 只保证还剩 >=2 个空槽位，不保证附件库是空的。
assert_contains '删完只断言这一行消失' \
  'wait --fn document.querySelectorAll('"'"'[aria-label^="浏览器验收临时简历.pdf"]'"'"').length === 0' "$CALLS"
assert_missing '不再拿附件库空态文案当断言' 'wait --text 还未上传附件简历' "$CALLS"
assert_true '左滑发生两次（替换一次、删除一次）' \
  "[ $(grep -c 'get box \[aria-label\^=' "$CALLS") -eq 2 ]"
assert_missing '旅程里不用 eval 造输入事件' 'eval --stdin' "$SANDBOX/stderr.txt"
assert_line '还原基准姓名（整行精确匹配，不是临时名的前缀）' \
  '--session backend-local-candidate find label 姓名（递交简历后披露） fill 浏览器验收候选人' "$CALLS"
assert_eq '台账记下已建意向' "$(jq -r '.candidate_intention_created' "$PRIVATE_JOURNAL")" 'true'
assert_eq '台账记下临时附件的固定名称' \
  "$(jq -r '.candidate_resume_file_names[0]' "$PRIVATE_JOURNAL")" '浏览器验收临时简历.pdf'
assert_eq '台账没有多出任何字段' \
  "$(jq -rc '[keys_unsorted[]]|sort|join(",")' "$PRIVATE_JOURNAL")" \
  'candidate_intention_created,candidate_resume_file_names,recruiter_job_titles,run_id,schema_version'
assert_eq '台账仍是 0600' "$(ls -l "$PRIVATE_JOURNAL" | cut -c2-10)" 'rw-------'
assert_eq '原子替换后没有残留临时文件' \
  "$(find "$SANDBOX/run/private" -name '.run-journal.json.*' | wc -l | tr -d ' ')" '0'
# 每个写块做完都硬刷新一次：改名 / 建意向 / 改意向 / 删意向 / 改档 / 还原档 /
# 传附件 / 替换附件 / 删附件 / 还原姓名
assert_true '每个 mutation 块之后都硬刷新' \
  "[ $(grep -c '^--session backend-local-candidate reload$' "$CALLS") -ge 10 ]"
assert_missing '通过路径不用 snapshot' 'snapshot' "$CALLS"

# ── 8. 招聘数据加载旅程合同 ─────────────────────────────────────────

# 招聘两条旅程共用的桩：页面文本换成招聘侧的，候选私有摘要绝不出现
seed_recruiter_page(){
  printf '%s\n' '浏览器验收招聘官 招聘负责人 浏览器验收科技 浏览器验收岗位 · 在招基线 浏览器验收岗位 · 归档基线' \
    >"$FAKE_STATE/body.txt"
}

testcase '招聘数据加载旅程'
new_sandbox journey-hr-load
unset AGENT_BROWSER_SESSION
seed_recruiter_page
push_value '[aria-label="职务"]' '招聘负责人'
push_value '[aria-label="公司介绍"]' '浏览器验收科技 · 真实后端企业介绍基线'
push_value '[aria-label="公司介绍"]' '浏览器验收科技 · 真实后端企业介绍基线'
bash "$HR_LOAD_JOURNEY" >"$SANDBOX/stdout.txt" 2>"$SANDBOX/stderr.txt"
assert_eq '旅程返回 0' "$?" '0'
assert_eq '分片记为 pass' "$(jq -r '.status' "$FRAGMENT_DIR/recruiter-load.json")" 'pass'
assert_eq '终止行只报旅程 / 状态 / 里程碑' "$(cat "$SANDBOX/stdout.txt")" 'JOURNEY recruiter-load pass 完成'
assert_session_and_bans 'backend-local-recruiter'
for scene in recruiter-card-loaded recruiter-company-loaded; do
  assert_true "拍下 $scene" "[ -f '$RUN_DIR/visual/recruiter/$scene.png' ]"
done
assert_eq '只拍属于本旅程的两个场景' "$(ls "$RUN_DIR/visual/recruiter" | wc -l | tr -d ' ')" '2'
assert_false '不碰候选侧的任何目录' "[ -d '$RUN_DIR/visual/candidate' ]"
assert_contains '进「我」这一 Tab' 'find role button click --name 我 --exact' "$CALLS"
assert_contains '语义点进设置' 'find role button click --name 设置 --exact' "$CALLS"
assert_contains '语义点进招聘名片' 'find role button click --name 招聘名片' "$CALLS"
assert_contains '断言名片上的固定公开名' 'wait --text 浏览器验收招聘官' "$CALLS"
assert_contains '断言名片上的固定职务' 'wait --text 招聘负责人' "$CALLS"
assert_contains '断言名片上的固定品牌' 'wait --text 浏览器验收科技' "$CALLS"
assert_contains '职务逐字核到输入框的值' 'get value [aria-label="职务"]' "$CALLS"
assert_contains '语义点进公司资料' 'find role button click --name 公司资料 --exact' "$CALLS"
assert_contains '语义点进公司介绍分区' 'find role button click --name 公司介绍' "$CALLS"
assert_contains '公司介绍逐字核到文本域的值' 'get value [aria-label="公司介绍"]' "$CALLS"
assert_contains '语义点进岗位管理' 'find role button click --name 岗位管理 --exact' "$CALLS"
assert_contains '在招基线要落在「在招」组' \
  'wait [aria-label^="浏览器验收岗位 · 在招基线"][aria-label$="在招"]' "$CALLS"
assert_contains '归档基线要落在「已归档」组' \
  'wait [aria-label^="浏览器验收岗位 · 归档基线"][aria-label$="已归档"]' "$CALLS"
assert_true '名片 / 公司资料 / 岗位管理 三屏都硬刷新过' \
  "[ $(grep -c '^--session backend-local-recruiter reload$' "$CALLS") -ge 3 ]"
assert_false '通过路径的 open 只开站点根地址，不直接改 hash' \
  "grep -E '^--session [^ ]+ open ' '$CALLS' | grep -q '#'"
assert_missing '通过路径不用 snapshot' 'snapshot' "$CALLS"
assert_body_reads_gated '每一条缺席断言都排在硬刷新之后的水合门后面'
assert_missing '不下达候选专属的求职屏入口' '--name 我的简历' "$CALLS"
assert_missing '不下达候选专属的意向屏入口' '--name 求职意向' "$CALLS"
assert_missing '不下达候选专属的披露屏入口' '--name 披露偏好' "$CALLS"
assert_missing '不选候选身份大卡' '--name 我要找工作' "$CALLS"

# ── 9. 招聘 CRUD 旅程合同 ───────────────────────────────────────────

testcase '招聘 CRUD 旅程'
new_sandbox journey-hr-crud
unset AGENT_BROWSER_SESSION
seed_recruiter_page
set_attr '[aria-label^="浏览器验收岗位 · 临时CRUD"]' 'aria-expanded' 'true'
push_value '[aria-label="职务"]' '招聘负责人'
push_value '[aria-label="职务"]' '浏览器验收招聘负责人'
push_value '[aria-label="职务"]' '招聘负责人'
push_value '[aria-label="公司介绍"]' '浏览器验收科技 · 真实后端企业介绍基线'
push_value '[aria-label="公司介绍"]' '浏览器验收科技 · 临时CRUD介绍'
push_value '[aria-label="公司介绍"]' '浏览器验收科技 · 真实后端企业介绍基线'
push_value '[aria-label="职位描述"]' '浏览器验收岗位 · 临时CRUD 的职位描述改后'
bash "$HR_CRUD_JOURNEY" >"$SANDBOX/stdout.txt" 2>"$SANDBOX/stderr.txt"
assert_eq '旅程返回 0' "$?" '0'
assert_eq '分片记为 pass' "$(jq -r '.status' "$FRAGMENT_DIR/recruiter-crud.json")" 'pass'
assert_eq '终止行不带任何 ID' "$(cat "$SANDBOX/stdout.txt")" 'JOURNEY recruiter-crud pass 完成'
assert_session_and_bans 'backend-local-recruiter'
assert_true '拍下 recruiter-jobs-after-create' \
  "[ -f '$RUN_DIR/visual/recruiter/recruiter-jobs-after-create.png' ]"
assert_eq '本旅程只拍这一个场景' "$(ls "$RUN_DIR/visual/recruiter" | wc -l | tr -d ' ')" '1'
# 名片：职务改一次再改回来，两头都逐字核
assert_line '职务改成临时值' \
  '--session backend-local-recruiter find label 职务 fill 浏览器验收招聘负责人' "$CALLS"
assert_line '职务还原成基线值（整行精确匹配，不是临时值的后缀）' \
  '--session backend-local-recruiter find label 职务 fill 招聘负责人' "$CALLS"
# 公司介绍：改一次再改回来
assert_line '公司介绍改成临时值' \
  '--session backend-local-recruiter find label 公司介绍 fill 浏览器验收科技 · 临时CRUD介绍' "$CALLS"
assert_line '公司介绍还原成基线值' \
  '--session backend-local-recruiter find label 公司介绍 fill 浏览器验收科技 · 真实后端企业介绍基线' "$CALLS"
# 发布：三步都走语义控件，目录三级按冻结的 display_name 点
assert_contains '从岗位管理进发布新岗位' 'find role button click --name 发布新岗位' "$CALLS"
assert_contains '打开职位类别选择层' 'find role button click --name 职位类别' "$CALLS"
assert_contains '目录大类' 'find role button click --name 互联网/AI --exact' "$CALLS"
assert_contains '目录分组' 'find role button click --name 前端/移动开发 --exact' "$CALLS"
assert_contains '目录叶子' 'find role button click --name 前端开发工程师 --exact' "$CALLS"
assert_contains '岗位名称用冻结的保留名称' \
  'find placeholder 必填，如：资深后端工程师 · 交易网关 fill 浏览器验收岗位 · 临时CRUD' "$CALLS"
assert_contains '办公方式选混合' 'find role button click --name 混合 --exact' "$CALLS"
assert_contains '工作城市从候选里选' 'find role button click --name 上海市 --exact' "$CALLS"
assert_contains '最后一步是发布' 'find role button click --name 发布岗位并开始寻访 --exact' "$CALLS"
assert_eq '临时岗位标题逐字等于后端 cleanup 的差集名' \
  "$(jq -r '.recruiter_job_titles[0]' "$PRIVATE_JOURNAL")" '浏览器验收岗位 · 临时CRUD'
assert_eq '台账只记这一个名称' \
  "$(jq -r '.recruiter_job_titles | length' "$PRIVATE_JOURNAL")" '1'
assert_eq '台账没有多出任何字段' \
  "$(jq -rc '[keys_unsorted[]]|sort|join(",")' "$PRIVATE_JOURNAL")" \
  'candidate_intention_created,candidate_resume_file_names,recruiter_job_titles,run_id,schema_version'
assert_eq '台账仍是 0600' "$(ls -l "$PRIVATE_JOURNAL" | cut -c2-10)" 'rw-------'
# 编辑只动描述与加分偏好：标题 / 类别 / 城市在后端不可改，一个字都不许碰
assert_contains '滑开临时岗位行（语义定位 + 自身矩形 + 真实鼠标输入）' \
  'get box [aria-label^="浏览器验收岗位 · 临时CRUD"] --json' "$CALLS"
assert_contains '滑开后点编辑' 'find role button click --name 编辑 --exact' "$CALLS"
assert_contains '编辑改职位描述' 'find label 职位描述 fill 浏览器验收岗位 · 临时CRUD 的职位描述改后' "$CALLS"
assert_contains '编辑改加分偏好' 'find placeholder 用你自己的话写 fill' "$CALLS"
assert_contains '硬刷新之后回编辑页逐字核描述' 'get value [aria-label="职位描述"]' "$CALLS"
# 岗位名称在后端建后不可改，编辑页也把它设成只读。这里按「placeholder + fill」计数：
# 整条旅程只允许发生一次（发布那一步）。原来那条断言找的是一个任何代码路径都发不出来的
# 字符串（发布填的是裸标题，不带「 的」），因此它对「编辑页又填了一次」这件事恒为真、
# 抓不到自己声称要防的回归。
assert_eq '岗位名称全程只在发布那一步填过一次（编辑页不许重填不可改字段）' \
  "$(grep -c 'find placeholder 必填，如：资深后端工程师 · 交易网关 fill' "$CALLS")" '1'
# 归档 → 重开 → 删除
assert_contains '停止招聘' 'find role button click --name 停止招聘 --exact' "$CALLS"
assert_contains '归档后落在「已归档」组' \
  'wait [aria-label^="浏览器验收岗位 · 临时CRUD"][aria-label$="已归档"]' "$CALLS"
assert_contains '重新开放' 'find role button click --name 重新开放 --exact' "$CALLS"
assert_contains '重开后落回「在招」组' \
  'wait [aria-label^="浏览器验收岗位 · 临时CRUD"][aria-label$="在招"]' "$CALLS"
assert_contains '删除走二次确认' 'wait --text 删除「浏览器验收岗位 · 临时CRUD」？' "$CALLS"
assert_contains '等这一行真的从列表里消失再往下' \
  "wait --fn document.querySelectorAll('[aria-label^=\"浏览器验收岗位 · 临时CRUD\"]').length === 0" "$CALLS"
assert_true '左滑发生五次（编辑 / 复核 / 停止 / 重开 / 删除）' \
  "[ $(grep -c 'get box \[aria-label\^=' "$CALLS") -eq 5 ]"
assert_contains '删完基线在招岗仍在' \
  'wait [aria-label^="浏览器验收岗位 · 在招基线"][aria-label$="在招"]' "$CALLS"
assert_contains '删完基线归档岗仍在' \
  'wait [aria-label^="浏览器验收岗位 · 归档基线"][aria-label$="已归档"]' "$CALLS"
assert_body_reads_gated '每一条缺席断言都排在硬刷新之后的水合门后面'
# 终局那两条尤其要紧：它们是本旅程「删掉了、硬刷新之后仍然没有」的最终主张
assert_contains '删完之后仍用基线在招岗把水合等出来' \
  'wait [aria-label^="浏览器验收岗位 · 在招基线"][aria-label$="在招"]' "$CALLS"
# 每个写块之后都硬刷新：改职务 / 还原职务 / 改介绍 / 还原介绍 / 发布 / 编辑 / 归档 / 重开 / 删除
assert_true '每个 mutation 块之后都硬刷新' \
  "[ $(grep -c '^--session backend-local-recruiter reload$' "$CALLS") -ge 9 ]"
assert_missing '通过路径不用 snapshot' 'snapshot' "$CALLS"
assert_missing '不下达候选专属的求职屏入口' '--name 我的简历' "$CALLS"
assert_missing '不选候选身份大卡' '--name 我要找工作' "$CALLS"

# ── 10. 双会话隔离门合同 ────────────────────────────────────────────

testcase '双会话隔离门'
new_sandbox isolation
export AGENT_BROWSER_SESSION='backend-local-candidate'
# 两侧都要断言「对方的私有标记不在自己屏上」，假 CLI 的页面文本是同一份，
# 所以这份桩里两个私有标记都不出现
printf '%s\n' '浏览器验收科技' >"$FAKE_STATE/body.txt"
# 这道门的前提是两个会话都已经登录（运行器在四条旅程之后才叫它），
# 所以两个会话各自已经落在自己的主壳上
printf '%s' 'http://localhost:5173/#/app' >"$FAKE_STATE/url.backend-local-candidate.txt"
printf '%s' 'http://localhost:5173/#/hr' >"$FAKE_STATE/url.backend-local-recruiter.txt"
( . "$LIB"; 会话隔离门 ) >"$SANDBOX/stdout.txt" 2>"$SANDBOX/stderr.txt"
assert_eq '隔离门返回 0' "$?" '0'
assert_missing '两个会话都还在，这道门不重登任何一个' 'find label 短信验证码' "$CALLS"
assert_eq '分片记为 pass' "$(jq -r '.status' "$FRAGMENT_DIR/session-isolation.json")" 'pass'
assert_eq '终止行只报旅程 / 状态 / 里程碑' \
  "$(cat "$SANDBOX/stdout.txt")" 'JOURNEY session-isolation pass 完成'
assert_eq '这道门不拍任何截图' "$(jq -rc '.screenshots' "$FRAGMENT_DIR/session-isolation.json")" '[]'
assert_false '只用得到这两个命名会话' \
  "grep -Ev '^--session backend-local-(candidate|recruiter) ' '$CALLS' | grep -q ."
assert_contains '候选侧硬刷新我的简历' \
  '--session backend-local-candidate find role button click --name 我的简历 --exact' "$CALLS"
assert_contains '招聘侧硬刷新招聘名片' \
  '--session backend-local-recruiter find role button click --name 招聘名片' "$CALLS"
assert_line '候选侧硬刷新' '--session backend-local-candidate reload' "$CALLS"
assert_line '招聘侧硬刷新' '--session backend-local-recruiter reload' "$CALLS"
assert_contains '只退候选：退出触发键走候选会话' \
  '--session backend-local-candidate find role button click --name 退出登录 --exact' "$CALLS"
# 确认键必须按它自己的可访问名称点。弹层框架是 <dialog open>（非模态），层开着时
# 背景里那枚同名的「退出登录」仍在可访问树里，再点一次同名只会点回背景那枚，
# 候选根本退不出去 —— 而后面的断言会以一个完全看不出病因的方式失败。
assert_contains '退出确认点的是确认键自己的可访问名称，不是可见文案' \
  '--session backend-local-candidate find role button click --name 确认退出当前账号 --exact' "$CALLS"
assert_eq '同名的「退出登录」全程只点一次（那一次是触发键）' \
  "$(grep -c -- 'find role button click --name 退出登录 --exact' "$CALLS")" '1'
assert_false '招聘会话绝不退出登录' \
  "grep -q -- '--session backend-local-recruiter find role button click --name 退出登录' '$CALLS'"
assert_contains '退出后停在登录页的手机号输入' \
  '--session backend-local-candidate wait [aria-label="手机号"]' "$CALLS"
assert_contains '招聘会话之后仍读得到自己的名片' \
  '--session backend-local-recruiter wait --text 浏览器验收招聘官' "$CALLS"
assert_true '招聘侧的名片断言排在候选退出之后' \
  "[ $(grep -n -- '--session backend-local-candidate find role button click --name 退出登录 --exact' "$CALLS" | tail -1 | cut -d: -f1) -lt $(grep -n -- '--session backend-local-recruiter wait --text 浏览器验收招聘官' "$CALLS" | tail -1 | cut -d: -f1) ]"
assert_missing '这道门不用 snapshot' 'snapshot' "$CALLS"

testcase '双会话隔离门 · 招聘会话被退掉就判失败'
new_sandbox isolation-broken
export AGENT_BROWSER_SESSION='backend-local-candidate'
printf '%s\n' '浏览器验收科技' >"$FAKE_STATE/body.txt"
printf '%s' 'http://localhost:5173/#/app' >"$FAKE_STATE/url.backend-local-candidate.txt"
printf '%s' 'http://localhost:5173/#/hr' >"$FAKE_STATE/url.backend-local-recruiter.txt"
# 候选点完退出却没落到登录页 = 退出根本没生效，这道门必须判失败
mark_absent '[aria-label="手机号"]'
( . "$LIB"; 会话隔离门 ) >"$SANDBOX/stdout.txt" 2>"$SANDBOX/stderr.txt"
assert_false '任一步不成立就必须返回非 0' "[ $? -eq 0 ]"
assert_eq '仍然写出分片，记为 failed' \
  "$(jq -r '.status' "$FRAGMENT_DIR/session-isolation.json")" 'failed'
assert_contains '分片写明卡在哪个里程碑' '双会话隔离门' "$FRAGMENT_DIR/session-isolation.json"
# 四条业务旅程失败时都留一份失败快照；这道门最容易因为非显而易见的原因失败，
# 少了它就是唯一一条「失败但零诊断」的路径。
assert_contains '失败路径留下失败快照' 'snapshot -i' "$CALLS"
assert_true '快照落在诊断目录里' "[ -f '$RUN_DIR/diagnostics/session-isolation-snapshot.txt' ]"

# ── 10.5 与后端 fixture 共享的冻结业务字面量 ────────────────────────

# 这 13 条业务字符串在两个仓库里各写一份：后端 browser-fixture.sh 把账号收敛成它们，
# 前端旅程照着它们断言。任何一侧改一个字都会让整套验收在真实后端上假失败，
# 而两边的单测各自都是绿的。做法与上面「场景表 vs 场景清单.ts」那一条一样：
# 逐字比对两处，漂移即测试失败。AGXP_MONOREPO_DIR 没设置时干净跳过（本套件不需要后端仓库）。
FROZEN_LITERALS='浏览器验收候选人
浏览器验收候选人 · 真实后端基准摘要
浏览器验收临时简历.pdf
浏览器验收招聘官
招聘负责人
浏览器验收科技
浏览器验收科技 · 真实后端企业介绍基线
浏览器验收岗位 · 在招基线
浏览器验收岗位 · 归档基线
浏览器验收岗位 · 临时CRUD
前端开发工程师
上海市
上海市浦东新区浏览器路 1 号'

testcase '冻结业务字面量：前端旅程与后端 fixture 逐字一致'
FRONT_SOURCES="$LIB $LOAD_JOURNEY $CRUD_JOURNEY $HR_LOAD_JOURNEY $HR_CRUD_JOURNEY"
# 先证明这张表确实是前端在用的（否则下面对后端的比对可能在比一张过时的表）
MISSING_FRONT=''
while IFS= read -r literal; do
  [ -n "$literal" ] || continue
  # 带上两侧的单引号做**整词**比对：只 grep 裸串时，把后端改成
  # 「浏览器验收岗位 · 临时CRUD2」这种加后缀的漂移会因为子串命中而漏过。
  if ! grep -qF -- "'$literal'" $FRONT_SOURCES; then MISSING_FRONT="$MISSING_FRONT[$literal]"; fi
done <<EOF
$FROZEN_LITERALS
EOF
assert_eq '每一条都真的出现在前端长期脚本里' "$MISSING_FRONT" ''

BACKEND_FIXTURE="$REAL_MONOREPO_DIR/apps/recruitment/scripts/browser-fixture.sh"
if [ -z "$REAL_MONOREPO_DIR" ] || [ ! -f "$BACKEND_FIXTURE" ]; then
  printf 'skip 未设置 AGXP_MONOREPO_DIR（或后端 fixture 不在），跳过跨仓库字面量比对\n'
else
  MISSING_BACK=''
  while IFS= read -r literal; do
    [ -n "$literal" ] || continue
    if ! grep -qF -- "'$literal'" "$BACKEND_FIXTURE"; then MISSING_BACK="$MISSING_BACK[$literal]"; fi
  done <<EOF
$FROZEN_LITERALS
EOF
  assert_eq '每一条都逐字出现在后端 browser-fixture.sh 里' "$MISSING_BACK" ''
fi

# ── 11. 长期脚本的静态禁令 ──────────────────────────────────────────

testcase '长期脚本静态检查'
for f in "$LIB" "$LOAD_JOURNEY" "$CRUD_JOURNEY" "$HR_LOAD_JOURNEY" "$HR_CRUD_JOURNEY"; do
  n="$(basename "$f")"
  # 只查可执行行：注释里本来就要写清哪些命令被禁、为什么禁
  CODE="$SANDBOX_ROOT/$n.code"
  grep -v '^[[:space:]]*#' "$f" >"$CODE"
  assert_false "$n 不含 CSS module 类名定位" "grep -Eq 'class\\*=|class\\^=|_module__' '$CODE'"
  assert_false "$n 不含 @eN 引用" "grep -Eq '@e[0-9]+' '$CODE'"
  assert_false "$n 不含被禁的浏览器持久化 / 打桩命令" \
    "grep -Eq 'network[[:space:]]+route|network[[:space:]]+har|state[[:space:]]+save|--profile|--session-name|--state|cookies|record[[:space:]]+start' '$CODE'"
  # 坐标点击仍然禁止：写死像素的 mouse move 一律不许。
  # 库里唯一的例外是 左滑行 —— 滑动是空间手势，坐标只能从被语义定位到的那一行的
  # 矩形推出来，所以那里的 mouse move 参数必须是变量/算式，不能是字面数字。
  assert_false "$n 不含写死坐标的鼠标命令" "grep -Eq 'mouse[[:space:]]+move[[:space:]]+[0-9]' '$CODE'"
  assert_false "$n 不用 eval 造输入事件" "grep -Eq 'dispatchEvent|new (Pointer|Mouse|Touch)Event' '$CODE'"
  # 非 ASCII 标识符不用单独查：整份测试就跑在 macOS 的 /bin/bash 3.2 上，
  # 那个版本只认 [A-Za-z_][A-Za-z0-9_]* 的变量名，写错了这里全线报错。
done
for f in "$LOAD_JOURNEY" "$CRUD_JOURNEY" "$HR_LOAD_JOURNEY" "$HR_CRUD_JOURNEY"; do
  n="$(basename "$f")"
  assert_false "$n 自己不下鼠标命令（走 左滑行）" \
    "grep -v '^[[:space:]]*#' '$f' | grep -Eq 'ab mouse|agent-browser mouse'"
done
assert_eq 'snapshot -i 只被下达一次' "$(grep -c 'ab snapshot -i' "$LIB")" '1'
assert_true '而且只在失败诊断函数里' "grep -q 'ab snapshot -i >' '$LIB'"

# ── 汇总 ────────────────────────────────────────────────────────────

if [ "$FAILURES" -eq 0 ]; then
  printf '\n全部通过\n'
  exit 0
fi
printf '\n失败 %d 项\n' "$FAILURES" >&2
exit 1
