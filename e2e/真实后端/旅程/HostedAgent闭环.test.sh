#!/usr/bin/env bash
# HostedAgent闭环.sh 的 hermetic scene 合同测试。
#
# 沙盒里只有被测旅程脚本是真的：它 source 的 公共步骤.sh 是按状态机驱动的最小
# fake（页面文本、按钮集合、URL、草稿值都由 $STATE 下的阶段文件决定，不靠 sleep），
# 真实执行脚本四次，不能只 grep 源码。每个 scene 一条剧本：
#   p6     规则解释公开失败 → 零 active rule、草稿恢复、不确认规则
#   p4     delegation 公开失败 → 零 Case、无「查看进展」、刷新复读
#   p5     recruiter attention → 双 viewer 同一安全说明、零 Agent retry
#   happy  完整闭环 → 双方公开推进、Case 终结、深链复读
# 任何未列出的 button/find/get 操作记 FAKE 并非零退出；happy 页面一旦出现
# safe-failure 文案，脚本必须非零。
#
# 标识符一律 ASCII：macOS /bin/bash 是 3.2。
# 跑法：bash e2e/真实后端/旅程/HostedAgent闭环.test.sh

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
# 本测试在 e2e/真实后端/旅程/ 三层深：仓库根要退三层，沙盒才落在
# 顶层被 gitignore 的 agent-browser-backend-output/ 里。
REPO_ROOT="$(cd "$ROOT_DIR/../../.." && pwd)"
REAL_SCRIPT="$ROOT_DIR/HostedAgent闭环.sh"

FAILURES=0
CURRENT_CASE=''

testcase(){ CURRENT_CASE="$1"; printf '\n# %s\n' "$1"; }
ok(){ printf 'ok   %s\n' "$1"; }
bad(){ printf 'FAIL %s · %s\n' "$CURRENT_CASE" "$1" >&2; FAILURES=$((FAILURES + 1)); }
assert_true(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }
assert_eq(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1（期望 $3，实到 $2）"; fi; }
assert_contains(){ if grep -Fq -- "$2" "$3" 2>/dev/null; then ok "$1"; else bad "$1（找不到：$2）"; fi; }
assert_missing(){ if grep -Fq -- "$2" "$3" 2>/dev/null; then bad "$1（不该出现：$2）"; else ok "$1"; fi; }

# ── 沙盒 ────────────────────────────────────────────────────────────

SANDBOX_PARENT="$REPO_ROOT/agent-browser-backend-output"
mkdir -p "$SANDBOX_PARENT"
SANDBOX_ROOT="$(mktemp -d "$SANDBOX_PARENT/hosted-journey-test.XXXXXX")"
cleanup_all(){ rm -rf "$SANDBOX_ROOT"; rmdir "$SANDBOX_PARENT" 2>/dev/null || true; }
trap cleanup_all EXIT

SANDBOX="$SANDBOX_ROOT/repo"
STATE="$SANDBOX_ROOT/state"
CALLS="$SANDBOX_ROOT/calls.txt"
OUT_ROOT_SANDBOX="$SANDBOX_ROOT/out"
FRAG="$OUT_ROOT_SANDBOX/fragments"
RUNDIR="$OUT_ROOT_SANDBOX/rundir"
JOURNAL="$OUT_ROOT_SANDBOX/private/run-journal.json"
SCENE_OUT="$SANDBOX_ROOT/scene-out.txt"
MONO="$SANDBOX_ROOT/monorepo"

mkdir -p "$SANDBOX/e2e/真实后端/旅程" "$SANDBOX/e2e/真实后端/资源" "$STATE" "$MONO"

# 被测对象：真实旅程脚本复制进沙盒（它按 ../公共步骤.sh 相对定位）
cp "$REAL_SCRIPT" "$SANDBOX/e2e/真实后端/旅程/HostedAgent闭环.sh"

# ── fake 公共步骤库（状态机页面）────────────────────────────────────
cat >"$SANDBOX/e2e/真实后端/公共步骤.sh" <<'FAKE'
# shellcheck shell=bash
# 测试专用最小公共步骤库：状态机由 $STATE/stage 驱动，零 sleep。
FRONTEND_ORIGIN='http://localhost:5173'
CANDIDATE_SESSION='backend-local-candidate'
RECRUITER_SESSION='backend-local-recruiter'
FRAGMENT_WRITTEN=0
JOURNEY_BLOCKED=0
JOURNEY_BLOCKED_REASON=''

RULE_TEXT='优先考虑支持混合办公并且周末双休的岗位'
RESUME_NAME='浏览器验收临时简历.pdf'
CASE_URL='http://localhost:5173/#/deal/mc_fake'

read_stage(){ cat "$STATE/stage" 2>/dev/null || printf '%s:init' "${HOSTED_AGENT_SCENE:-none}"; }
set_stage(){ printf '%s' "$1" >"$STATE/stage"; }
rule_count(){ cat "$STATE/rule_count" 2>/dev/null || printf '0'; }

page_body(){
  local stage; stage="$(read_stage)"
  case "$stage" in
    *:init) printf '首页 我 职位 人才' ;;
    *:me|*:me2) printf '首页 我 AI代理规则库 我的简历 职位 人才' ;;
    *:jobs) printf '职位 市场 我' ;;
    *:talent) printf '人才 在谈 我' ;;
    *:rules|*:rules_accepted|p6:rules_closed)
      printf 'AI代理规则库 %s 条 手动添加规则 我' "$(rule_count)" ;;
    *:rule_input) printf '规则草稿 提交给AI代理理解' ;;
    *:interpreting) printf 'AI代理正在理解这条规则…' ;;
    p6:rule_failed) printf 'AI 暂时不可用，本次规则没有生效 关闭 %s 条' "$(rule_count)" ;;
    happy:rule_ready)
      if [ "${FAKE_HAPPY_BREAK:-0}" = '1' ]; then
        printf 'AI 暂时不可用，本次规则没有生效'
      else
        printf '确认规则'
      fi ;;
    *:resume) printf '我的简历 添加附件简历' ;;
    *:consent) printf '允许 AI 识别这份简历？ 同意并继续' ;;
    *:parsing) printf '解析中' ;;
    *:resume_done) printf '我的简历 %s 识别完成 职位' "$RESUME_NAME" ;;
    *:market) printf '市场 让AI代理去谈' ;;
    *:delegation_confirm) printf '选择这次提交的简历 确认并委托' ;;
    *:delegation_sent)
      case "$HOSTED_AGENT_SCENE" in
        p4) printf 'AI 服务暂时不可用，本次没有创建 Case' ;;
        *) printf '查看进展' ;;
      esac ;;
    *:case_s0) printf '匿名初筛' ;;
    *:case_s0_done) printf '招聘方 AI 正在初筛已提交简历 人才' ;;
    *:talks) printf '在谈 简历提交' ;;
    happy:recruiter_wait|p5:recruiter_wait) printf '简历提交详情' ;;
    happy:recruiter_screen) printf '通过初筛' ;;
    p5:attention) printf 'AI 服务暂时不可用，本 Case 尚未继续 需注意' ;;
    happy:coordination) printf '等待双方确认意向 接受' ;;
    happy:s2_cand) printf '等待候选人确认意向 确认意向' ;;
    happy:s2_rec) printf '等待招聘方确认意向 确认意向' ;;
    happy:terminal) printf '双方已确认，正在创建会话' ;;
    *) printf '空白页' ;;
  esac
}

# 异步等待屏在读 body 前推进到该 scene 的公开终态；interpreting / case_s0 必须先让
# 脚本读到进行中文案，读后推进。
pre_advance(){
  case "$(read_stage)" in
    happy:recruiter_wait) set_stage 'happy:recruiter_screen' ;;
    p5:recruiter_wait) set_stage 'p5:attention' ;;
  esac
}
post_advance(){
  case "$(read_stage)" in
    *:interpreting)
      case "$HOSTED_AGENT_SCENE" in
        p6) set_stage 'p6:rule_failed' ;;
        *) set_stage 'happy:rule_ready' ;;
      esac ;;
    *:case_s0) set_stage "${HOSTED_AGENT_SCENE}:case_s0_done" ;;
  esac
}
get_body(){
  pre_advance
  local b; b="$(page_body)"
  printf '%s\n' "$b" >>"$STATE/bodies.log" 2>/dev/null || true
  printf '%s' "$b"
  post_advance
}

# 每个 stage 的可见按钮集合（每行一个，多词按钮按整行精确匹配）
stage_buttons(){
  local stage; stage="$(read_stage)"
  case "$stage" in
    *:init) printf '我\n' ;;
    *:me|*:me2) printf '我\nAI代理规则库\n我的简历\n职位\n人才\n' ;;
    *:rules|*:rules_accepted|p6:rules_closed) printf '手动添加规则\n我\n' ;;
    *:rule_input) printf '提交给AI代理理解\n' ;;
    p6:rule_failed) printf '关闭\n' ;;
    happy:rule_ready) printf '确认规则\n' ;;
    *:resume) printf '添加附件简历\n我\n职位\n' ;;
    *:consent) printf '同意并继续\n' ;;
    *:parsing) printf '%s 识别完成\n' "$RESUME_NAME" ;;
    *:resume_done) printf '我\n职位\n' ;;
    *:jobs) printf '市场\n我\n' ;;
    *:market) printf '让AI代理去谈\n' ;;
    *:delegation_confirm) printf '确认并委托\n确认委托\n' ;;
    *:delegation_sent)
      case "$HOSTED_AGENT_SCENE" in
        p4) printf '\n' ;;
        *) printf '查看进展\n' ;;
      esac ;;
    *:case_s0) printf '\n' ;;
    *:case_s0_done) printf '人才\n' ;;
    *:talent) printf '在谈\n我\n' ;;
    *:talks) printf '简历提交\n' ;;
    happy:recruiter_screen) printf '通过初筛\n' ;;
    happy:coordination) printf '接受\n' ;;
    happy:s2_cand|happy:s2_rec) printf '确认意向\n' ;;
    *) printf '\n' ;;
  esac
}
has_stage_button(){ stage_buttons | grep -Fxq -- "$1"; }

fake_click(){
  local name="$1" scene="${HOSTED_AGENT_SCENE:-none}" stage; stage="$(read_stage)"
  case "$stage" in
    *:init)
      case "$name" in 我) set_stage "$scene:me"; return 0 ;; esac ;;
    *:me|*:me2)
      case "$name" in
        AI代理规则库) set_stage "$scene:rules"; return 0 ;;
        我的简历) set_stage "$scene:resume"; return 0 ;;
        职位) set_stage "$scene:jobs"; return 0 ;;
      esac ;;
    *:rules)
      case "$name" in 手动添加规则) set_stage "$scene:rule_input"; return 0 ;; esac ;;
    *:rule_input)
      case "$name" in 提交给AI代理理解) set_stage "$scene:interpreting"; return 0 ;; esac ;;
    p6:rule_failed)
      case "$name" in 关闭) set_stage 'p6:rules_closed'; return 0 ;; esac ;;
    happy:rule_ready)
      case "$name" in 确认规则) printf '1' >"$STATE/rule_count"; set_stage 'happy:rules_accepted'; return 0 ;; esac ;;
    happy:rules_accepted)
      case "$name" in 我) set_stage 'happy:me'; return 0 ;; esac ;;
    *:resume)
      case "$name" in 添加附件简历) set_stage "$scene:consent"; return 0 ;; esac ;;
    *:consent)
      case "$name" in 同意并继续) set_stage "$scene:parsing"; return 0 ;; esac ;;
    *:resume_done)
      case "$name" in 我) set_stage "$scene:me2"; return 0 ;; 职位) set_stage "$scene:jobs"; return 0 ;; esac ;;
    *:jobs)
      case "$name" in 市场) set_stage "$scene:market"; return 0 ;; esac ;;
    *:market)
      case "$name" in 让AI代理去谈) set_stage "$scene:delegation_confirm"; return 0 ;; esac ;;
    *:delegation_confirm)
      case "$name" in 确认并委托|确认委托) set_stage "$scene:delegation_sent"; return 0 ;; esac ;;
    *:delegation_sent)
      case "$name" in 查看进展) set_stage "$scene:case_s0"; return 0 ;; esac ;;
    *:case_s0_done)
      case "$name" in 人才) set_stage "$scene:talent"; return 0 ;; esac ;;
    *:talent)
      case "$name" in 在谈) set_stage "$scene:talks"; return 0 ;; esac ;;
    *:talks)
      case "$name" in 简历提交) set_stage "$scene:recruiter_wait"; return 0 ;; esac ;;
    happy:recruiter_screen)
      case "$name" in 通过初筛) set_stage 'happy:coordination'; return 0 ;; esac ;;
    happy:coordination)
      case "$name" in 接受) set_stage 'happy:s2_cand'; return 0 ;; esac ;;
    happy:s2_cand)
      case "$name" in 确认意向) set_stage 'happy:s2_rec'; return 0 ;; esac ;;
    happy:s2_rec)
      case "$name" in 确认意向) set_stage 'happy:terminal'; return 0 ;; esac ;;
  esac
  printf 'FAKE click 未列出按钮「%s」（stage=%s）\n' "$name" "$stage" >>"$CALLS"
  return 1
}

ab(){
  printf 'ab --session %s %s\n' "$AGENT_BROWSER_SESSION" "$*" >>"$CALLS"
  case "$1" in
    open) return 0 ;;
    reload) return 0 ;;
    upload) return 0 ;;
    wait)
      shift
      case "${1:-}" in
        --text)
          local body; body="$(get_body)"
          case "$body" in *"$2"*) return 0 ;; *) return 1 ;; esac ;;
        *) return 0 ;;
      esac ;;
    get)
      case "$2" in
        text)
          [ "$3" = 'body' ] || { printf 'FAKE ab get text 只认 body：%s\n' "$*" >>"$CALLS"; return 1; }
          get_body ;;
        url)
          case "$(read_stage)" in
            *:case_s0|*:case_s0_done|*:recruiter_wait|*:recruiter_screen|*:coordination|*:s2_cand|*:s2_rec|happy:terminal|p5:attention)
              printf '%s\n' "$CASE_URL" ;;
            *) printf 'http://localhost:5173/#/app\n' ;;
          esac ;;
        value)
          case "$(read_stage)" in
            *:rule_input|*:rules|p6:rules_closed) printf '%s\n' "$RULE_TEXT" ;;
            *) printf '\n' ;;
          esac ;;
        *) printf 'FAKE ab get 未预期目标：%s\n' "$*" >>"$CALLS"; return 1 ;;
      esac ;;
    find)
      local kind="$2" name='' verb=''
      shift
      case "$kind" in
        placeholder|label)
          # find placeholder P fill V / find label L fill V
          local target="$2" value="$4"
          printf 'fill %s\n' "$target" >>"$CALLS"
          case "$(read_stage)" in *:rule_input) return 0 ;; esac
          printf 'FAKE fill 时机不对（stage=%s）\n' "$(read_stage)" >>"$CALLS"; return 1 ;;
        role)
          case "$2:$3" in
            radio:click)
              name="${5#--name }"
              printf 'click radio %s\n' "$name" >>"$CALLS"
              case "$(read_stage)" in *:delegation_confirm) return 0 ;; esac
              return 1 ;;
            button:*)
              # find role button text --name X [--exact]（无 click＝存在性查询）
              local i name=''
              shift 2
              while [ $# -gt 0 ]; do
                case "$1" in --name) name="$2"; shift 2 ;; *) shift ;; esac
              done
              if has_stage_button "$name"; then
                case "$(read_stage)" in *:parsing) set_stage "${HOSTED_AGENT_SCENE}:resume_done" ;; esac
                return 0
              fi
              return 1 ;;
          esac ;;
        *) printf 'FAKE ab find 未预期类型：%s\n' "$kind" >>"$CALLS"; return 1 ;;
      esac ;;
    *) printf 'FAKE ab 未预期命令：%s\n' "$*" >>"$CALLS"; return 1 ;;
  esac
}

wait_text(){ ab wait --text "$1"; }
assert_text(){ wait_text "$1"; }
on_screen(){ local b; b="$(get_body)"; case "$b" in *"$1"*) return 0 ;; esac; return 1; }
settle(){ :; }
click_button(){ printf 'click %s\n' "$1" >>"$CALLS"; fake_click "$1"; }
click_button_exact(){ printf 'click %s\n' "$1" >>"$CALLS"; fake_click "$1"; }
click_after_hydrate(){ wait_text "$1"; click_button_exact "$1"; }
click_back(){ printf 'click 返回\n' >>"$CALLS"; return 0; }
find_retry(){ ab find "$@"; }
login_candidate(){ printf 'login candidate\n' >>"$CALLS"; AGENT_BROWSER_SESSION="$CANDIDATE_SESSION"; return 0; }
login_recruiter(){ printf 'login recruiter\n' >>"$CALLS"; AGENT_BROWSER_SESSION="$RECRUITER_SESSION"; return 0; }
record_cleanup_marker(){
  local result
  [ -f "$PRIVATE_JOURNAL" ] || return 1
  result="$(jq --arg k "$1" --arg v "$2" '.[$k] = ((.[$k] // []) + [$v])' "$PRIVATE_JOURNAL")" || return 1
  printf '%s\n' "$result" >"$PRIVATE_JOURNAL"
  chmod 600 "$PRIVATE_JOURNAL"
}
capture_failure_snapshot(){ printf 'snapshot %s\n' "$1" >>"$CALLS"; return 0; }
write_journey_result(){
  local journey="$1" status="$2" milestone="$3" failure="${4:-}"
  mkdir -p "$FRAGMENT_DIR"
  jq -n --arg j "$journey" --arg s "$status" --arg m "$milestone" --arg f "$failure" \
    '{schemaVersion:1,journey:$j,status:$s,milestone:$m,
      apiRequests:["GET /api/v1/me/resume"],consoleErrors:[],pageErrors:[],failedRequests:[],screenshots:[],
      failure:(if $f=="" then null else $f end)}' >"$FRAGMENT_DIR/$journey.json"
  FRAGMENT_WRITTEN=1
  printf 'JOURNEY %s %s %s\n' "$journey" "$status" "$milestone"
  [ "$status" = 'pass' ]
}
write_journey_failure(){ write_journey_result "$1" failed "$2" "旅程在里程碑「${2}」失败" || return 0; }
assert_no_mock_data(){ return 0; }
FAKE

# ── 每个用例的复位 ──────────────────────────────────────────────────

export CALLS STATE
SCENE_RC=0

reset_case(){
  : >"$CALLS"
  rm -f "$STATE/stage" "$STATE/rule_count" "$STATE/bodies.log"
  rm -rf "$OUT_ROOT_SANDBOX"
  mkdir -p "$FRAG" "$RUNDIR" "$(dirname "$JOURNAL")"
  ( umask 077; jq -n --arg id 'hosted-journey-test' \
    '{schema_version:1,run_id:$id,candidate_intention_created:false,candidate_resume_file_names:[],recruiter_job_titles:[]}' \
    >"$JOURNAL" )
  chmod 600 "$JOURNAL"
  printf 'not-a-real-pdf-but-nonempty' >"$SANDBOX/e2e/真实后端/资源/简历-v1.pdf"
  unset FAKE_HAPPY_BREAK || true
}

run_scene(){
  reset_case
  SCENE_RC=0
  HOSTED_AGENT_SCENE="$1" FRAGMENT_DIR="$FRAG" RUN_DIR="$RUNDIR" \
  PRIVATE_JOURNAL="$JOURNAL" AGXP_MONOREPO_DIR="$MONO" \
  FRONTEND_ORIGIN='http://localhost:5173' \
    bash "$SANDBOX/e2e/真实后端/旅程/HostedAgent闭环.sh" >"$SCENE_OUT" 2>&1 || SCENE_RC=$?
}

saw_keywords(){
  local scene="$1" kw
  shift
  for kw in "$@"; do
    assert_contains "${scene} 页面公开文案「${kw}」" "$kw" "$STATE/bodies.log"
  done
}

# ── 用例 ────────────────────────────────────────────────────────────

testcase 'p6：规则解释公开失败，零 active rule，草稿恢复，不确认规则'
run_scene p6
assert_eq 'p6 退出 0' "$SCENE_RC" 0
saw_keywords p6 '0 条' 'AI 暂时不可用，本次规则没有生效'
assert_contains 'P6 提交规则' 'click 提交给AI代理理解' "$CALLS"
assert_contains 'P6 关闭失败卡恢复草稿' 'click 关闭' "$CALLS"
assert_missing 'P6 不确认规则' 'click 确认规则' "$CALLS"
assert_missing '假件没有报告任何未预期调用' 'FAKE ' "$CALLS"
assert_eq 'p6 分片 pass' "$(jq -r .status "$FRAG/hosted-agent.json" 2>/dev/null)" 'pass'

testcase 'p4：delegation 公开失败，零 Case，刷新复读'
run_scene p4
assert_eq 'p4 退出 0' "$SCENE_RC" 0
saw_keywords p4 'AI 服务暂时不可用，本次没有创建 Case'
assert_contains 'P4 发起 delegation' 'click 让AI代理去谈' "$CALLS"
assert_missing 'P4 不进 Case' 'click 查看进展' "$CALLS"
assert_missing '假件没有报告任何未预期调用' 'FAKE ' "$CALLS"
assert_eq 'p4 分片 pass' "$(jq -r .status "$FRAG/hosted-agent.json" 2>/dev/null)" 'pass'

testcase 'p5：双 viewer 同一 attention 说明，零 Agent retry'
run_scene p5
assert_eq 'p5 退出 0' "$SCENE_RC" 0
saw_keywords p5 '查看进展' 'AI 服务暂时不可用，本 Case 尚未继续' '需注意'
assert_contains 'P5 recruiter 查看同一 Case' 'session backend-local-recruiter' "$CALLS"
assert_missing 'P5 零重试简历校验' 'click 重试校验' "$CALLS"
assert_contains 'P5 candidate 深链复读同一说明' 'open http://localhost:5173/#/deal/mc_fake' "$CALLS"
assert_missing '假件没有报告任何未预期调用' 'FAKE ' "$CALLS"
assert_eq 'p5 分片 pass' "$(jq -r .status "$FRAG/hosted-agent.json" 2>/dev/null)" 'pass'

testcase 'happy：完整闭环，双方公开推进，深链复读终态'
run_scene happy
assert_eq 'happy 退出 0' "$SCENE_RC" 0
saw_keywords happy '查看进展' '通过初筛' '等待双方确认意向' '双方已确认，正在创建会话'
assert_contains 'happy 双方推进协调' 'click 接受' "$CALLS"
assert_eq '双方各确认一次意向' "$(grep -c 'click 确认意向' "$CALLS")" 2
assert_contains '深链使用 server Case URL' 'open http://localhost:5173/#/deal/mc_fake' "$CALLS"
assert_contains 'happy 确认了规则' 'click 确认规则' "$CALLS"
assert_missing '假件没有报告任何未预期调用' 'FAKE ' "$CALLS"
assert_eq 'happy 分片 pass' "$(jq -r .status "$FRAG/hosted-agent.json" 2>/dev/null)" 'pass'

testcase '空值或未知 scene：exit 2，零登录'
for scene in '' 'future'; do
  reset_case
  SCENE_RC=0
  HOSTED_AGENT_SCENE="$scene" FRAGMENT_DIR="$FRAG" RUN_DIR="$RUNDIR" \
  PRIVATE_JOURNAL="$JOURNAL" AGXP_MONOREPO_DIR="$MONO" \
  FRONTEND_ORIGIN='http://localhost:5173' \
    bash "$SANDBOX/e2e/真实后端/旅程/HostedAgent闭环.sh" >"$SCENE_OUT" 2>&1 || SCENE_RC=$?
  assert_eq "scene「${scene}」退出 2" "$SCENE_RC" 2
  assert_missing "scene「${scene}」零登录" 'login ' "$CALLS"
done

testcase 'happy 页面出现 safe-failure 文案：不得冒充 happy 通过'
reset_case
export FAKE_HAPPY_BREAK=1
SCENE_RC=0
HOSTED_AGENT_SCENE='happy' FRAGMENT_DIR="$FRAG" RUN_DIR="$RUNDIR" \
PRIVATE_JOURNAL="$JOURNAL" AGXP_MONOREPO_DIR="$MONO" \
FRONTEND_ORIGIN='http://localhost:5173' \
  bash "$SANDBOX/e2e/真实后端/旅程/HostedAgent闭环.sh" >"$SCENE_OUT" 2>&1 || SCENE_RC=$?
assert_true 'happy 失败路径退出非零' "[ '$SCENE_RC' != '0' ]"
assert_missing '没有写下 pass 分片' '"status":"pass"' "$FRAG/hosted-agent.json"

printf '\n'
if [ "$FAILURES" -eq 0 ]; then
  printf '全部通过\n'
  exit 0
fi
printf '%s 条断言失败\n' "$FAILURES" >&2
exit 1
