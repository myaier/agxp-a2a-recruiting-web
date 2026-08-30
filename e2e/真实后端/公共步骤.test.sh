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

SANDBOX_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/agxp-steps-test.XXXXXX")"
trap 'rm -rf "$SANDBOX_ROOT"' EXIT

new_sandbox(){
  SANDBOX="$SANDBOX_ROOT/$1"
  rm -rf "$SANDBOX"
  mkdir -p "$SANDBOX/bin" "$SANDBOX/state" "$SANDBOX/run/journeys" "$SANDBOX/monorepo/apps/recruitment/.local-dev"
  mkdir -p "$SANDBOX/run/private"
  chmod 700 "$SANDBOX/run/private"

  CALLS="$SANDBOX/calls.txt"; : >"$CALLS"
  FAKE_STATE="$SANDBOX/state"
  FAKE_OTP_FILE="$SANDBOX/monorepo/apps/recruitment/.local-dev/code"
  FAKE_OTP='824913'
  RUN_DIR="$SANDBOX/run"
  FRAGMENT_DIR="$SANDBOX/run/journeys"
  PRIVATE_LEDGER="$SANDBOX/run/private/cleanup.json"
  AGXP_MONOREPO_DIR="$SANDBOX/monorepo"
  FRONTEND_ORIGIN='http://localhost:5173'
  export CALLS FAKE_STATE FAKE_OTP_FILE FAKE_OTP RUN_DIR FRAGMENT_DIR PRIVATE_LEDGER AGXP_MONOREPO_DIR FRONTEND_ORIGIN
  export PATH="$SANDBOX/bin:$PATH"

  # 上一轮留下的旧验证码：新鲜度判定读不到「点过获取验证码之后」的写入就不该用它
  printf '000000\n' >"$FAKE_OTP_FILE"
  touch -t 200001010000 "$FAKE_OTP_FILE"

  printf '%s\n' '浏览器验收候选人 · 真实后端基准摘要' >"$FAKE_STATE/body.txt"
  printf '%s' 'http://localhost:5173/' >"$FAKE_STATE/url.txt"
  : >"$FAKE_STATE/attrs"
  : >"$FAKE_STATE/texts"
  printf '%s\n' '{"success":true,"data":{"requests":[
    {"method":"get","url":"http://localhost:5173/index.html","status":200,"headers":{"Cookie":"绝不能出现"}},
    {"method":"get","url":"http://127.0.0.1:8097/api/v1/me/resume?token=绝不能出现","status":200},
    {"method":"patch","url":"http://127.0.0.1:8097/api/v1/me/privacy","status":200},
    {"method":"get","url":"http://127.0.0.1:8097/api/v1/me/missing","status":404}]},"error":null}' \
    >"$FAKE_STATE/requests.json"
  printf '%s\n' '{"success":true,"data":{"messages":[{"type":"debug","text":"[vite] connected."}]},"error":null}' \
    >"$FAKE_STATE/console.json"
  printf '%s\n' '{"success":true,"data":{"errors":[]},"error":null}' >"$FAKE_STATE/errors.json"

  cat >"$PRIVATE_LEDGER" <<'JSON'
{
  "schema_version": 1,
  "run_id": "20260830T000000Z-ab12cd",
  "candidate_intention_created": false,
  "candidate_resume_file_names": [],
  "recruiter_job_titles": []
}
JSON
  chmod 600 "$PRIVATE_LEDGER"

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

if [ "${1:-}" = '--session' ]; then shift 2; fi

case "${1:-}" in
  get)
    case "${2:-}" in
      text) if [ "${3:-}" = 'body' ]; then cat "$state_dir/body.txt" 2>/dev/null; else lookup texts "${3:-}"; fi ;;
      attr) lookup attrs "${3:-}|${4:-}" ;;
      url) cat "$state_dir/url.txt" 2>/dev/null ;;
      *) : ;;
    esac
    ;;
  network) cat "$state_dir/requests.json" ;;
  console) cat "$state_dir/console.json" ;;
  errors) cat "$state_dir/errors.json" ;;
  eval) cat >/dev/null; printf 'true\n' ;;
  snapshot) printf '%s\n' '- button "浏览器验收候选人"' ;;
  screenshot) : >"${2:-/dev/null}" ;;
  find)
    case "$*" in *'--name 获取验证码'*) printf '%s\n' "$FAKE_OTP" >"$FAKE_OTP_FILE" ;; esac
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
assert_missing '上一轮的旧验证码没有被当成本轮的用' '000000' "$CALLS"
assert_session_and_bans 'backend-local-candidate'

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

# ── 4. 私密清理台账 ─────────────────────────────────────────────────

testcase 'record_cleanup_marker'
new_sandbox ledger
export AGENT_BROWSER_SESSION='backend-local-candidate'
( . "$LIB"
  record_cleanup_marker candidate_intention_created true
  record_cleanup_marker candidate_resume_file_names '浏览器验收临时简历.pdf' ) >/dev/null 2>&1
assert_eq '两次记录都成功' "$?" '0'
assert_eq '里程碑落到台账' "$(jq -r '.candidate_intention_created' "$PRIVATE_LEDGER")" 'true'
assert_eq '固定保留名称落到台账' "$(jq -r '.candidate_resume_file_names[0]' "$PRIVATE_LEDGER")" '浏览器验收临时简历.pdf'
assert_eq '台账仍是 0600' "$(ls -l "$PRIVATE_LEDGER" | cut -c2-10)" 'rw-------'
assert_eq '原子替换后没有残留临时文件' \
  "$(find "$SANDBOX/run/private" -name '.cleanup.json.*' | wc -l | tr -d ' ')" '0'
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
assert_eq 'screenshots 记下这一轮拍的那张' \
  "$(jq -r '.screenshots[0]' "$FRAGMENT")" "$RUN_DIR/visual/candidate/candidate-resume-loaded.png"
assert_eq 'RUN_DIR 落在仓库里时截图路径转成仓库相对' \
  "$( . "$LIB"; _repo_relative_path "$ROOT_DIR/资源/简历-v1.pdf" )" 'e2e/真实后端/资源/简历-v1.pdf'
assert_missing '分片里没有查询串' 'token=' "$FRAGMENT"
assert_missing '分片里没有 Cookie' 'Cookie' "$FRAGMENT"
assert_missing '分片里没有 host' '127.0.0.1' "$FRAGMENT"
assert_eq '分片字段集合与 旅程结果 完全一致' \
  "$(jq -rc '[keys_unsorted[]]|sort|join(",")' "$FRAGMENT")" \
  'apiRequests,consoleErrors,failedRequests,failure,journey,milestone,pageErrors,schemaVersion,screenshots,status'

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
assert_line '还原基准姓名（整行精确匹配，不是临时名的前缀）' \
  '--session backend-local-candidate find label 姓名（递交简历后披露） fill 浏览器验收候选人' "$CALLS"
assert_eq '台账记下已建意向' "$(jq -r '.candidate_intention_created' "$PRIVATE_LEDGER")" 'true'
assert_eq '台账记下临时附件的固定名称' \
  "$(jq -r '.candidate_resume_file_names[0]' "$PRIVATE_LEDGER")" '浏览器验收临时简历.pdf'
assert_eq '台账没有多出任何字段' \
  "$(jq -rc '[keys_unsorted[]]|sort|join(",")' "$PRIVATE_LEDGER")" \
  'candidate_intention_created,candidate_resume_file_names,recruiter_job_titles,run_id,schema_version'
assert_eq '台账仍是 0600' "$(ls -l "$PRIVATE_LEDGER" | cut -c2-10)" 'rw-------'
assert_eq '原子替换后没有残留临时文件' \
  "$(find "$SANDBOX/run/private" -name '.cleanup.json.*' | wc -l | tr -d ' ')" '0'
# 每个写块做完都硬刷新一次：改名 / 建意向 / 改意向 / 删意向 / 改档 / 还原档 / 传附件 / 还原姓名
assert_true '每个 mutation 块之后都硬刷新' \
  "[ $(grep -c '^--session backend-local-candidate reload$' "$CALLS") -ge 8 ]"
assert_missing '通过路径不用 snapshot' 'snapshot' "$CALLS"

# ── 8. 长期脚本的静态禁令 ───────────────────────────────────────────

testcase '长期脚本静态检查'
for f in "$LIB" "$LOAD_JOURNEY" "$CRUD_JOURNEY"; do
  n="$(basename "$f")"
  # 只查可执行行：注释里本来就要写清哪些命令被禁、为什么禁
  CODE="$SANDBOX_ROOT/$n.code"
  grep -v '^[[:space:]]*#' "$f" >"$CODE"
  assert_false "$n 不含 CSS module 类名定位" "grep -Eq 'class\\*=|class\\^=|_module__' '$CODE'"
  assert_false "$n 不含 @eN 引用" "grep -Eq '@e[0-9]+' '$CODE'"
  assert_false "$n 不含被禁的浏览器持久化 / 打桩命令" \
    "grep -Eq 'network[[:space:]]+route|network[[:space:]]+har|state[[:space:]]+save|--profile|--session-name|--state|cookies|record[[:space:]]+start' '$CODE'"
  assert_false "$n 不含坐标点击" "grep -Eq 'mouse[[:space:]]+(move|down|up)' '$CODE'"
  # 非 ASCII 标识符不用单独查：整份测试就跑在 macOS 的 /bin/bash 3.2 上，
  # 那个版本只认 [A-Za-z_][A-Za-z0-9_]* 的变量名，写错了这里全线报错。
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
