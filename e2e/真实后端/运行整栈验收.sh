#!/usr/bin/env bash
# 真实后端整栈验收 · 一条命令的编排入口。
#
#   npm run test:agent-browser:backend-local -- [--journey <id>] [--headed] [--update-baseline]
#
# 它负责的只有编排：起或复用本地栈、收敛 fixture、起 Vite、按顺序跑四条业务旅程与双会话隔离门、
# 收尾清理、扫敏感字面量、把结果交给 报告命令.ts 生成 report.json/report.md，并转发退出码。
# 断言、截图、分片、视觉比较分别属于 旅程/*.sh、公共步骤.sh、视觉/比较.ts —— 这里一律不重复实现。
#
# 退出码：0 功能与清理通过且没有 enforce 视觉阻断 / 1 功能、清理或 enforce 视觉失败 /
#         2 用法或报告错误 / 75 环境阻塞。
#
# 资源归属三条硬规矩：
#   1. 自己没起过的本地栈绝不 down；down 永远不带 --volumes。
#   2. 只终止自己启动、且 kill -0 确认过的那一个 Vite PID —— 不按端口、不按进程名杀。
#   3. 只关 backend-local-candidate 与 backend-local-recruiter 两个具名会话，绝不 close --all。
#
# 两份记录，不要混：
#   · **run receipt**（后端写在 apps/recruitment/.local-dev/browser-fixtures/<run id>.json）
#     是 `browser-fixture.sh cleanup --ledger` 唯一合法的实参。它带 candidate / recruiter
#     两段收敛后 owner-list，是设计稿 §8.5 差集清理的全部依据。本文件里**每一次**算子
#     调用（converge/verify/cleanup 都算）都发一个全新 RUN_ID，所以这份 ledger 特指
#     旅程开始前那一次 converge 写下的收条（2026-08-31 重校准，见计划文档）。
#   · **私密 journal**（$PRIVATE_JOURNAL，$RUN_DIR/private/run-journal.json）是本仓库自己的
#     人读证据：旅程按里程碑往里记固定保留名称，清理失败时由 print_private_journal 念出来。
#     它**永远不是**后端算子的输入 —— 把它当 --ledger 传过去会让差集清理整段空转。
#
# 标识符一律 ASCII：macOS 的 /bin/bash 是 3.2，变量名只认 [A-Za-z_][A-Za-z0-9_]*。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONT_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"

ALL_JOURNEYS='candidate-load candidate-crud recruiter-load recruiter-crud session-isolation'

usage_error(){
  printf '%s\n' "usage: $1" >&2
  printf '%s\n' 'usage: 运行整栈验收.sh [--journey candidate-load|candidate-crud|recruiter-load|recruiter-crud|all] [--headed] [--update-baseline]' >&2
  exit 2
}

# ── 参数（任何 stack 变更之前解析完毕）────────────────────────────

JOURNEY_ARG='all'
HEADED=0
UPDATE_BASELINE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --journey)
      [ $# -ge 2 ] || usage_error '--journey 缺少取值'
      JOURNEY_ARG="$2"
      shift 2
      ;;
    --headed) HEADED=1; shift ;;
    --update-baseline) UPDATE_BASELINE=1; shift ;;
    *) usage_error "未知参数：$1" ;;
  esac
done

case "$JOURNEY_ARG" in
  candidate-load|candidate-crud|recruiter-load|recruiter-crud|all) : ;;
  *) usage_error "未知旅程：$JOURNEY_ARG" ;;
esac

# 已提交的基线是七个场景的原子集合：只跑一条旅程时最多能拍出其中两三张，
# 拿它去更新基线必然写出半套。所以这个组合在动任何环境之前就拒绝。
if [ "$UPDATE_BASELINE" = '1' ] && [ "$JOURNEY_ARG" != 'all' ]; then
  usage_error '--update-baseline 只能与 --journey all（或默认）同用：基线是七个场景的原子集合'
fi

# 选中集合在动任何环境之前就定下来：阻塞路径上的报告也要如实写出本轮选了哪几条旅程
# （报告读取端要求 selectedJourneys 非空，否则整份上下文不合法）。
case "$JOURNEY_ARG" in
  all) SELECTED="$ALL_JOURNEYS" ;;
  *) SELECTED="$JOURNEY_ARG" ;;
esac

GATE="${UI_VISUAL_GATE:-report}"
case "$GATE" in
  report|enforce) : ;;
  *) usage_error "UI_VISUAL_GATE 只能是 report 或 enforce，实到：$GATE" ;;
esac

# shellcheck source=公共步骤.sh
. "$ROOT_DIR/公共步骤.sh"

# 页面源头写死：真实后端验收只在 http://localhost:5173 上成立（后端 CORS 与 Cookie 域按它签发），
# 换成 127.0.0.1 或别的端口都会把结论作废，所以这里覆盖任何继承来的取值。
FRONTEND_ORIGIN='http://localhost:5173'

# 会话与状态一律由脚本自己指定：继承来的 AGENT_BROWSER_* 会把两个角色串到同一个会话，
# 或者悄悄打开被公共步骤库明令禁止的状态持久化（--profile / --session-name / --state）。
unset AGENT_BROWSER_SESSION AGENT_BROWSER_PROFILE AGENT_BROWSER_SESSION_NAME AGENT_BROWSER_STATE 2>/dev/null || true

# ── 运行期状态 ──────────────────────────────────────────────────────

BLOCKED_REASON=''
# 后端 fixture 算子在旅程开始之前就判 FAIL（rc 1）时的功能中止原因。
# 它与 BLOCKED_REASON 是两条不同的结论：75 说「环境没准备好」，1 说「数据本身不对」。
FUNCTIONAL_ABORT_REASON=''
USAGE_FAILED=0
TEARDOWN_DONE=0
FINAL_EXIT=0
BACKEND_PREEXISTING=0
BACKEND_OWNED=0
STACK_HEALTHY=0
FIXTURE_TOUCHED=0
FIXTURE_VERIFIED=0
FIXTURE_CONVERGE_STATUS='SKIPPED'
FIXTURE_VERIFY_STATUS='SKIPPED'
FIXTURE_CLEANUP_STATUS='SKIPPED'
FIXTURE_CLEANUP_OK=1
HYGIENE_OK=1
JOURNEYS_STARTED=0
BROWSER_TOUCHED=0
JOURNEY_RCS=''
FIXTURE_OUT=''
FIXTURE_RC=0
VITE_PID=''
DEV=''
FIXTURE=''
RUN_DIR=''
RECEIPT=''
CHROME_BUILD=''
AB_VERSION=''
FIXTURE_CALLS=0
FIXTURE_RECEIPTS=''
LAST_LOGIN_EPOCH=0
FRONTEND_COMMIT='unknown'
FRONTEND_COMMIT='unknown'
BACKEND_COMMIT='unknown'

blocked(){
  BLOCKED_REASON="$1"
  printf '整栈验收阻塞：%s\n' "$1" >&2
  exit 75
}

# 后端算子在旅程开始之前判功能失败（例如「基准岗位不在位」，README 里有明确的换键补救）。
# 它不是环境阻塞：报成 75 会让人去查 Docker 和端口，而真正要做的是按 README 修 fixture。
functional_abort(){
  FUNCTIONAL_ABORT_REASON="$1"
  printf '整栈验收功能失败：%s\n' "$1" >&2
  exit 1
}

# 后端 fixture 算子的退出码是**有意分层**的（apps/recruitment/README.md「三条成功终止行」）：
#   64 usage / 75 BLOCKED（环境） / 1 FAIL（功能） / 0 通过。
# 这张表是两个调用点（旅程前的 converge+verify、收尾的 cleanup+converge+verify）唯一的翻译，
# 缺了它同一个 rc 会在一处被报成 INFRA_BLOCKED、在另一处被报成 CLEANUP_FAILED。
classify_fixture_failure(){
  case "$1" in
    0) printf 'ok' ;;
    64) printf 'usage' ;;
    75) printf 'infra' ;;
    *) printf 'functional' ;;
  esac
}

# ── preflight 之一：写得出报告的最低工具链 ──────────────────────────
#
# 这一段是唯一「只留 stderr、不产 report.json」的阻塞路径，因为报告本身就是由
# jq 与 node_modules/.bin/tsx 实现的：它们不在，任何证据合同都无从谈起。
# 其余每一条 preflight 都排在运行目录与收尾 trap 之后，好让阻塞也带着报告落地。

# 七个视觉场景冻结 Asia/Shanghai 取景（报告端逐字核对）。agent-browser 0.27.2 没有
# timezone 开关，Chrome 的 Intl 解析跟随**浏览器进程**的 TZ：本导出保证 daemon 冷启动
# 时解析出冻结值。daemon 已被别处（无 TZ）拉起时，后面的取景门会照常以 mismatch 阻塞，
# 那是环境问题，不被这里悄悄吞掉。
export TZ='Asia/Shanghai'

need_command(){ command -v "$1" >/dev/null 2>&1 || blocked "缺少命令：$1"; }

[ -x "$FRONT_ROOT/node_modules/.bin/tsx" ] || blocked '前端依赖未安装：node_modules/.bin/tsx'
need_command jq

# 安全输出路径：产物必须落在前端仓库内被 gitignore 的目录下 ——
# 分片里的 screenshots 按 类型.ts 是仓库相对路径，落到仓库外 公共步骤.sh 会硬失败。
OUT_ROOT="$FRONT_ROOT/agent-browser-backend-output"
rand6="$(hexdump -n 3 -v -e '/1 "%02x"' /dev/urandom 2>/dev/null || true)"
[ -n "$rand6" ] || rand6="$(printf '%06x' $(( (RANDOM * 32768 + RANDOM) % 16777216 )))"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$rand6"
RUN_DIR="$OUT_ROOT/$RUN_ID"
case "$RUN_DIR" in
  "$FRONT_ROOT"/*) : ;;
  *) blocked "运行目录不在前端仓库内：$RUN_DIR" ;;
esac

FRAGMENT_DIR_MAIN="$RUN_DIR/journeys"
PRECONDITION_DIR="$RUN_DIR/preconditions"
mkdir -p "$FRAGMENT_DIR_MAIN" "$PRECONDITION_DIR" "$RUN_DIR/visual"
mkdir -p "$RUN_DIR/private"
chmod 700 "$RUN_DIR/private"
PRIVATE_JOURNAL="$RUN_DIR/private/run-journal.json"
( umask 077; jq -n --arg id "$RUN_ID" \
  '{schema_version:1,run_id:$id,candidate_intention_created:false,candidate_resume_file_names:[],recruiter_job_titles:[]}' \
  >"$PRIVATE_JOURNAL" )
chmod 600 "$PRIVATE_JOURNAL"

printf '运行目录：%s\n' "$RUN_DIR"

# ── 分片写入原语（收尾也要用，所以定义在 trap 之前）────────────────

is_selected(){ case " $SELECTED " in *" $1 "*) return 0 ;; esac; return 1; }

# 未选中的旅程写 skipped 分片：报告读取端要求五个分片齐全，缺一个就是报告错误。
write_skipped(){
  jq -n --arg j "$1" --arg m "$2" \
    '{schemaVersion:1,journey:$j,status:"skipped",milestone:$m,apiRequests:[],consoleErrors:[],
      pageErrors:[],failedRequests:[],screenshots:[],failure:null}' \
    >"$FRAGMENT_DIR_MAIN/$1.json"
}

# 被选中却因**环境阻塞**没能执行的旅程写 blocked 分片。
# 这条路径和 write_skipped 只差一个 status，但结论完全相反：报告读到 blocked 升级成
# INFRA_BLOCKED（75），读到被选中的 skipped 则判「已选旅程未执行」＝FUNCTIONAL_FAILED（1）。
# 环境问题写成 skipped 就是设计稿 §14 分类学违规。
write_blocked(){
  jq -n --arg j "$1" --arg m "$2" --arg f "$3" \
    '{schemaVersion:1,journey:$j,status:"blocked",milestone:$m,apiRequests:[],consoleErrors:[],
      pageErrors:[],failedRequests:[],screenshots:[],failure:$f}' \
    >"$FRAGMENT_DIR_MAIN/$1.json"
}

# ── 收尾（幂等，只跑一次）──────────────────────────────────────────

on_signal(){
  BLOCKED_REASON="收到 $1 信号，提前收尾"
  printf '%s\n' "$BLOCKED_REASON" >&2
  exit 75
}

# 2026-08-31 重校准：后端 0.2.5 实测两件硬事实改写了算子的调用姿势。
#   1. 同一 RUN_ID 的第二次算子调用，登录命中 24h 幂等键，重放出已 logout 的死
#      token，首个 catalog 请求必 401（后端已实锤并在交接里确认）——所以每一次
#      算子调用都发全新 RUN_ID，绝不复用。
#   2. mock SMS 的 begin 接收桶是「同手机号一分钟一次」；换新 ID 紧接着调用就会
#      429。所以每次调用前都对齐到距上一次登录锚点 ≥ PACE_SECS 秒（锚点＝相邻
#      的算子调用起点与隔离门结束时刻；旅程之间复用会话不重登，不另设锚）。
PACE_SECS="${FIXTURE_LOGIN_PACE:-70}"

pace_before_login(){
  local now remain
  # 锚点跨进程持久化：上一轮的**收尾** verify 就在退出前一刻登录过，新进程若不读
  # 持久锚点，第一次 converge 必撞 429（#run11 实测间隔 44s）。mtime 即窗口时刻。
  local anchor_file="$OUT_ROOT/.fixture-pace-anchor"
  if [ "$LAST_LOGIN_EPOCH" = '0' ] && [ -f "$anchor_file" ]; then
    LAST_LOGIN_EPOCH="$(stat -f %m "$anchor_file" 2>/dev/null || stat -c %Y "$anchor_file" 2>/dev/null || printf '0')"
  fi
  if [ "$LAST_LOGIN_EPOCH" -gt 0 ] && [ "$PACE_SECS" -gt 0 ]; then
    now="$(date +%s)"
    # date +%s 是秒级截断：锚点可能在窗口尾（X.9 记成 X），按裸差值算会少睡一截。
    # 补 1s 余量，保证实测间隔 ≥ PACE - 2s（默认 70 时 ≥68s），限流窗是整 60s 足够。
    remain=$(( LAST_LOGIN_EPOCH + PACE_SECS + 1 - now ))
    if [ "$remain" -gt 0 ]; then
      printf '错峰等待 %ss：同手机号的登录限流窗口是每分钟一次\n' "$remain"
      sleep "$remain"
    fi
  fi
  LAST_LOGIN_EPOCH="$(date +%s)"
  touch "$anchor_file" 2>/dev/null || true
}

fixture_step(){
  local rc=0
  FIXTURE_CALLS=$((FIXTURE_CALLS + 1))
  export BROWSER_FIXTURE_RUN_ID="$RUN_ID-$FIXTURE_CALLS"
  pace_before_login
  set +e
  FIXTURE_OUT="$("$FIXTURE" "$@" 2>&1)"
  rc=$?
  set -e
  FIXTURE_RC="$rc"
  printf '%s\n' "$FIXTURE_OUT" >>"$RUN_DIR/fixture.log"
  # 每一次 converge 都会在 STATE 目录落一份 run receipt。收尾成功时它们全部退休；
  # 失败时全部按 0600 留给人手工处置 —— 所以每一次调用后都把「确实落了盘」的
  # 那份记进名单。
  if [ -f "$FIXTURE_RECEIPT_DIR/$BROWSER_FIXTURE_RUN_ID.json" ]; then
    FIXTURE_RECEIPTS="$FIXTURE_RECEIPTS $FIXTURE_RECEIPT_DIR/$BROWSER_FIXTURE_RUN_ID.json"
  fi
  return 0
}

close_session(){ agent-browser --session "$1" close >/dev/null 2>&1 || true; }

# 招聘方的退出属于全局收尾：双会话隔离门只退候选（公共步骤.sh 会话隔离门），
# 招聘会话要留到这里，清理阶段才有可用会话。确认键用它自己的可访问名称
# 「确认退出企业账号」并且必须 --exact：弹层框架给遮罩自动起名 关闭${标签}，
# 名称匹配又是子串匹配，不加 --exact 会点到遮罩上。收尾失败不改判结论，只记一行。
recruiter_logout(){
  AGENT_BROWSER_SESSION="$RECRUITER_SESSION"
  ab open "$FRONTEND_ORIGIN/" >/dev/null 2>&1 || return 0
  {
    click_button_exact '我' &&
    click_after_hydrate '设置' &&
    click_after_hydrate '退出登录' &&
    click_button_exact '确认退出企业账号' &&
    ab wait '[aria-label="手机号"]' >/dev/null
  } >/dev/null 2>&1 || printf '收尾提示：招聘会话没能走完退出流程，直接关闭会话\n'
  return 0
}

hygiene_scan(){
  local file hits='' listing
  listing="$(find "$RUN_DIR" -type f \( -name '*.json' -o -name '*.md' -o -name '*.log' -o -name '*.txt' \) 2>/dev/null || true)"
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    case "$file" in "$RUN_DIR/private/"*) continue ;; esac
    if grep -Eq '__Host-agxp_recruitment_session|Authorization:|Bearer |"proof":\{"code|Cookie:|Set-Cookie:' "$file" 2>/dev/null; then
      # 命中就整份删掉，和 公共步骤.sh 的失败快照同一条规矩：宁可没有这份产物，
      # 也不把证据留在盘上。删在报告生成**之前**是关键 —— report.json / report.md
      # 完全派生自这些分片（consoleErrors / pageErrors 各带 200 字页面文本），
      # 先删源头，派生产物才不会把同一段泄漏再抄一份出去。
      hits="$hits $file"
      rm -f "$file"
    fi
  done <<EOF
$listing
EOF
  if [ -n "$hits" ]; then
    HYGIENE_OK=0
    printf '产物命中敏感字面量，已删除（判 CLEANUP_FAILED）：%s\n' "$hits" >&2
  fi
}

collect_candidate_scenes(){
  local role file
  mkdir -p "$RUN_DIR/visual/current"
  for role in candidate recruiter; do
    [ -d "$RUN_DIR/visual/$role" ] || continue
    for file in "$RUN_DIR/visual/$role"/*.png; do
      [ -f "$file" ] || continue
      cp "$file" "$RUN_DIR/visual/current/$(basename "$file")"
    done
  done
}

write_report(){
  local rc=0 cleanup_failed='false' infra='false' ab_version="$AB_VERSION" chrome="$CHROME_BUILD"
  if [ "$FIXTURE_CLEANUP_OK" != '1' ] || [ "$HYGIENE_OK" != '1' ]; then cleanup_failed='true'; fi
  if [ -n "$BLOCKED_REASON" ]; then infra='true'; fi
  # 旅程开始前就阻塞的那一轮读不到渲染器版本；上下文要求这两个字段非空，
  # 所以显式写 unknown —— 报告里「不知道」必须是可见的，不能是空串。
  [ -n "$ab_version" ] || ab_version='unknown'
  [ -n "$chrome" ] || chrome='unknown'
  jq -n \
    --argjson selected "$(printf '%s\n' $SELECTED | jq -R . | jq -s .)" \
    --arg fragmentDir "$FRAGMENT_DIR_MAIN" \
    --arg outputDir "$RUN_DIR" \
    --arg gate "$GATE" \
    --argjson updateBaseline "$([ "$UPDATE_BASELINE" = '1' ] && echo true || echo false)" \
    --argjson cleanupFailed "$cleanup_failed" \
    --argjson infraBlocked "$infra" \
    --argjson fixtureVerified "$([ "$FIXTURE_VERIFIED" = '1' ] && echo true || echo false)" \
    --argjson journeysStarted "$([ "$JOURNEYS_STARTED" = '1' ] && echo true || echo false)" \
    --arg frontendCommit "$FRONTEND_COMMIT" \
    --arg backendCommit "$BACKEND_COMMIT" \
    --arg agentBrowserVersion "$ab_version" \
    --arg chromeBuild "$chrome" \
    --argjson preexisting "$([ "$BACKEND_PREEXISTING" = '1' ] && echo true || echo false)" \
    --argjson healthy "$([ "$STACK_HEALTHY" = '1' ] && echo true || echo false)" \
    --arg converge "$FIXTURE_CONVERGE_STATUS" \
    --arg verify "$FIXTURE_VERIFY_STATUS" \
    --arg cleanup "$FIXTURE_CLEANUP_STATUS" \
    --arg baselineManifestPath "$ROOT_DIR/视觉/基线清单.json" \
    --arg baselineDir "$ROOT_DIR/视觉/基线" \
    --arg candidateDir "$RUN_DIR/visual/current" \
    --arg diffDir "$RUN_DIR/visual/diff" \
    --arg reviewDir "$RUN_DIR/visual/baseline-review" \
    '{selectedJourneys:$selected,fragmentDir:$fragmentDir,outputDir:$outputDir,gate:$gate,
      updateBaseline:$updateBaseline,cleanupFailed:$cleanupFailed,infraBlocked:$infraBlocked,
      fixtureVerified:$fixtureVerified,journeysStarted:$journeysStarted,
      frontendCommit:$frontendCommit,backendCommit:$backendCommit,
      agentBrowserVersion:$agentBrowserVersion,chromeBuild:$chromeBuild,
      stack:{preexisting:$preexisting,healthy:$healthy},
      fixture:{converge:$converge,verify:$verify,cleanup:$cleanup},
      visual:{baselineManifestPath:$baselineManifestPath,baselineDir:$baselineDir,
              candidateDir:$candidateDir,diffDir:$diffDir,reviewDir:$reviewDir}}' \
    >"$RUN_DIR/report-input.json"

  set +e
  "$FRONT_ROOT/node_modules/.bin/tsx" "$ROOT_DIR/报告命令.ts" "$RUN_DIR/report-input.json"
  rc=$?
  set -e
  return "$rc"
}

# 旅程一条都没开始就结束时，五个分片仍要齐全（报告读取端缺一个就判 USAGE_ERROR），
# 但绝不能写成 pass：被选中的记 blocked（环境阻塞）或 failed（fixture 功能失败），
# 未选中的照常记 skipped。这样 report.json 里「没跑成」是看得见的事实而不是空白。
write_pre_journey_fragments(){
  local status="$1" milestone="$2" failure="$3" journey
  for journey in $ALL_JOURNEYS; do
    if is_selected "$journey"; then
      jq -n --arg j "$journey" --arg s "$status" --arg m "$milestone" --arg f "$failure" \
        '{schemaVersion:1,journey:$j,status:$s,milestone:$m,apiRequests:[],consoleErrors:[],
          pageErrors:[],failedRequests:[],screenshots:[],failure:$f}' \
        >"$FRAGMENT_DIR_MAIN/$journey.json"
    else
      write_skipped "$journey" '未选中'
    fi
  done
}

# 清理没走完时，把本轮私密 journal 里的固定保留名称念给人听。
# journal 本身**不是**后端算子的输入（那是 run receipt，见 on_exit 第 1 步），
# 它只有这一个读者：清理失败时告诉人「本轮到底造过哪几样东西」。
print_private_journal(){
  local created files jobs
  [ -f "$PRIVATE_JOURNAL" ] || return 0
  created="$(jq -r '.candidate_intention_created' "$PRIVATE_JOURNAL" 2>/dev/null || printf 'unknown')"
  files="$(jq -r '.candidate_resume_file_names | join("、")' "$PRIVATE_JOURNAL" 2>/dev/null || printf '')"
  jobs="$(jq -r '.recruiter_job_titles | join("、")' "$PRIVATE_JOURNAL" 2>/dev/null || printf '')"
  printf '  本轮 journal 记下的里程碑：临时意向已创建=%s 临时附件=%s 临时岗位=%s\n' \
    "$created" "${files:-无}" "${jobs:-无}"
}

on_exit(){
  local rc=$?
  if [ "$TEARDOWN_DONE" = '1' ]; then exit "$FINAL_EXIT"; fi
  TEARDOWN_DONE=1
  trap - EXIT INT TERM

  # 1. 后端 fixture：先清掉本轮临时对象，再收敛回基准并 verify。
  #
  #    `--ledger` 收的是**后端自己写的 run receipt**（converge 在交出控制权之前落盘的
  #    收敛后 pre-state），不是本前端的私密 journal —— 只有 receipt 里有 candidate /
  #    recruiter 两段 owner-list，delta 清理（设计稿 §8.5）才有权判定哪一行是临时对象。
  #    传 journal 会让 receipt_has_role 恒假、owned=0，两条 reconcile 手臂全部空转：
  #    正常路径看不出来（UI 已经删干净了），中断过的那一轮却会在 cleanup 的 converge 里
  #    撞上「没有任何 run receipt 能解释这条意向」而 BLOCKED，孤儿留在账号里。
  #    没有 receipt（converge 还没写就失败了）＝后端根本没记录过 pre-state，
  #    也就没有任何差集可清；这时跳过 cleanup，仍然照常收敛回基准并 verify。
  if [ "$FIXTURE_TOUCHED" = '1' ]; then
    if [ -n "$RECEIPT" ] && [ -f "$RECEIPT" ]; then
      fixture_step cleanup --ledger "$RECEIPT"
      case "$FIXTURE_OUT" in
        *'BROWSER_FIXTURE_CLEANUP PASS'*) FIXTURE_CLEANUP_STATUS='PASS' ;;
        *) FIXTURE_CLEANUP_STATUS="FAILED(rc=$FIXTURE_RC)"; FIXTURE_CLEANUP_OK=0 ;;
      esac
      # 后端把 75 和 1 分得很清楚，收尾这一侧也必须照分：栈在拆台过程中变不健康是
      # 环境阻塞（75），残留对象清不掉才是 CLEANUP_FAILED（1），参数错是 usage（2）。
      case "$(classify_fixture_failure "$FIXTURE_RC")" in
        ok) : ;;
        usage)
          FIXTURE_CLEANUP_STATUS="USAGE(rc=$FIXTURE_RC)"
          FIXTURE_CLEANUP_OK=0
          USAGE_FAILED=1
          ;;
        infra)
          FIXTURE_CLEANUP_STATUS="BLOCKED(rc=$FIXTURE_RC)"
          # 环境阻塞不是清理失败：清理压根没能开始，报成 CLEANUP_FAILED 会把人
          # 引去翻残留数据，而真正坏掉的是本地栈。
          [ -n "$BLOCKED_REASON" ] || BLOCKED_REASON='收尾清理期间本地栈不健康（后端算子 BLOCKED）'
          ;;
        *)
          FIXTURE_CLEANUP_STATUS="FAILED(rc=$FIXTURE_RC)"
          FIXTURE_CLEANUP_OK=0
          ;;
      esac
    else
      FIXTURE_CLEANUP_STATUS='SKIPPED(无运行回执)'
      printf '收尾提示：后端没有留下本轮 run receipt，没有可清理的差集，直接收敛回基准\n'
    fi
    fixture_step converge
    case "$(classify_fixture_failure "$FIXTURE_RC")" in
      ok) : ;;
      usage) USAGE_FAILED=1; FIXTURE_CLEANUP_OK=0 ;;
      infra) [ -n "$BLOCKED_REASON" ] || BLOCKED_REASON='收尾收敛期间本地栈不健康（后端算子 BLOCKED）' ;;
      *) FIXTURE_CLEANUP_OK=0 ;;
    esac
    fixture_step verify
    case "$(classify_fixture_failure "$FIXTURE_RC")" in
      ok) : ;;
      usage) USAGE_FAILED=1; FIXTURE_CLEANUP_OK=0 ;;
      infra) [ -n "$BLOCKED_REASON" ] || BLOCKED_REASON='收尾复验期间本地栈不健康（后端算子 BLOCKED）' ;;
      *) FIXTURE_CLEANUP_OK=0 ;;
    esac
  fi

  # 2. 浏览器：招聘方退出登录，然后只关这两个具名会话
  if [ "$BROWSER_TOUCHED" = '1' ]; then
    recruiter_logout || true
    close_session "$CANDIDATE_SESSION"
    close_session "$RECRUITER_SESSION"
  fi

  # 3. 只终止自己启动并确认过的那一个 Vite PID
  if [ -n "$VITE_PID" ]; then
    kill "$VITE_PID" 2>/dev/null || true
    local waited=0
    while [ "$waited" -lt 20 ] && kill -0 "$VITE_PID" 2>/dev/null; do
      sleep 0.5
      waited=$((waited + 1))
    done
    if kill -0 "$VITE_PID" 2>/dev/null; then kill -KILL "$VITE_PID" 2>/dev/null || true; fi
    wait "$VITE_PID" 2>/dev/null || true
  fi

  # 4. 自己起的栈才停；预先存在的栈原样保留
  if [ "$BACKEND_OWNED" = '1' ]; then
    "$DEV" down >/dev/null 2>&1 || printf '收尾提示：dev-local.sh down 返回非零\n'
  fi

  # 5. 清理成功就删私密目录与后端运行回执；失败就按 0600 留着并只打印受限路径
  if [ "$FIXTURE_CLEANUP_OK" = '1' ]; then
    rm -rf "$RUN_DIR/private"
    # 清理成功：本轮全部 run receipt 退休（主 converge 一份、收尾重新收敛一份）。
    if [ -n "$FIXTURE_RECEIPTS" ]; then
      for receipts_path in $FIXTURE_RECEIPTS; do rm -f "$receipts_path"; done
    fi
    if [ -n "$RECEIPT" ]; then rm -f "$RECEIPT"; fi
  else
    chmod 700 "$RUN_DIR/private" 2>/dev/null || true
    chmod 600 "$PRIVATE_JOURNAL" 2>/dev/null || true
    printf '清理未完成，以下两处按 0600 保留待人工处置：\n'
    printf '  本轮私密 journal（只读证据，不是后端算子的输入）：%s\n' "$PRIVATE_JOURNAL"
    print_private_journal
    if [ -n "$RECEIPT" ] && [ -f "$RECEIPT" ]; then
      chmod 600 "$RECEIPT" 2>/dev/null || true
      printf '  后端运行回执：%s\n' "$RECEIPT"
    fi
    for receipts_path in $FIXTURE_RECEIPTS; do
      case "$receipts_path" in "$RECEIPT") continue ;; esac
      [ -f "$receipts_path" ] || continue
      chmod 600 "$receipts_path" 2>/dev/null || true
      printf '  后端算子其他回执（本轮重新 converge 落下的，同样待人工处置）：%s\n' "$receipts_path"
    done
  fi

  # 6. 定稿前扫敏感字面量并删掉命中文件（只扫 JSON / Markdown / 日志，绝不把 PNG 当文本读）。
  #    必须排在第 7 步写报告之前：报告只派生自这些分片与本运行器自己生成的元数据，
  #    源头清干净了，report.json / report.md 就不可能再带出泄漏。
  hygiene_scan

  # 7. 报告与退出码
  local report_rc=0
  if [ "$JOURNEYS_STARTED" = '1' ]; then
    collect_candidate_scenes
    write_report || report_rc=$?
    FINAL_EXIT="$report_rc"
  elif [ -n "$BLOCKED_REASON" ] || [ -n "$FUNCTIONAL_ABORT_REASON" ]; then
    # 设计稿 §15：每一次运行的报告都要带栈健康与 fixture converge/verify 状态。
    # 第一条旅程都没跑成的那一轮最需要这份证据，所以这里照样出报告 ——
    # 分片如实记 blocked / failed，绝不记 pass。退出码仍由本编排层给定：
    # 报告生成失败只是少了一份证据，不该把 75 悄悄改写成 2。
    if [ -n "$BLOCKED_REASON" ]; then
      write_pre_journey_fragments blocked '未开始' "整栈验收在旅程开始前阻塞：$BLOCKED_REASON"
      FINAL_EXIT=75
    else
      write_pre_journey_fragments failed '未开始' "整栈验收在旅程开始前功能失败：$FUNCTIONAL_ABORT_REASON"
      FINAL_EXIT=1
    fi
    collect_candidate_scenes
    write_report >/dev/null 2>&1 || report_rc=$?
    if [ "$report_rc" != '0' ] && [ ! -f "$RUN_DIR/report.json" ]; then
      printf '提示：阻塞路径上的报告没能生成（rc=%s），退出码仍按编排层结论给出\n' "$report_rc" >&2
    fi
  elif [ "$rc" = '0' ]; then
    FINAL_EXIT=2
    printf '没有跑成任何旅程却没有阻塞原因，按报告错误处理\n' >&2
  else
    FINAL_EXIT="$rc"
  fi
  if [ "$USAGE_FAILED" = '1' ]; then FINAL_EXIT=2; fi
  if [ -n "$BLOCKED_REASON" ] && [ "$FINAL_EXIT" = '0' ]; then FINAL_EXIT=75; fi

  printf '整栈验收退出码：%s\n' "$FINAL_EXIT"
  exit "$FINAL_EXIT"
}

trap on_exit EXIT
trap 'on_signal INT' INT
trap 'on_signal TERM' TERM

# ── preflight 之二：环境 ────────────────────────────────────────────
#
# 这些检查全部排在 trap 之后，所以它们的阻塞也会走 on_exit：写出一份 journeys
# 全记 blocked 的 report.json（设计稿 §15 要求每一次运行的报告都带栈健康与
# fixture converge/verify 状态，阻塞的那一次尤其需要）。

# 其余运行期工具都查在这里：它们缺席同样是 75，但这一侧的 75 会带着一份 report.json 落地。
[ -x "$FRONT_ROOT/node_modules/.bin/vite" ] || blocked '前端依赖未安装：node_modules/.bin/vite'
for cmd in agent-browser curl npm docker; do need_command "$cmd"; done

[ -n "${AGXP_MONOREPO_DIR:-}" ] || blocked 'AGXP_MONOREPO_DIR 未设置'
case "$AGXP_MONOREPO_DIR" in
  /*) : ;;
  *) blocked "AGXP_MONOREPO_DIR 必须是绝对路径：$AGXP_MONOREPO_DIR" ;;
esac
[ -d "$AGXP_MONOREPO_DIR" ] || blocked "AGXP_MONOREPO_DIR 不存在：$AGXP_MONOREPO_DIR"

DEV="$AGXP_MONOREPO_DIR/apps/recruitment/scripts/dev-local.sh"
FIXTURE="$AGXP_MONOREPO_DIR/apps/recruitment/scripts/browser-fixture.sh"
FIXTURE_RECEIPT_DIR="$AGXP_MONOREPO_DIR/apps/recruitment/.local-dev/browser-fixtures"
[ -x "$DEV" ] || blocked "后端入口不可执行：$DEV"
[ -x "$FIXTURE" ] || blocked "后端 fixture 算子不可执行：$FIXTURE"
agent-browser doctor >/dev/null 2>&1 || blocked 'agent-browser doctor 不通过（Chrome 未就绪）'
docker info >/dev/null 2>&1 || blocked 'Docker 守护进程不可用'

# 端口只认 5173：占用就阻塞，绝不退让到别的端口（换端口＝换 Origin＝换会话域）。
port_probe=0
curl -sS -o /dev/null --max-time 2 "$FRONTEND_ORIGIN/" >/dev/null 2>&1 || port_probe=$?
[ "$port_probe" = '7' ] || blocked "localhost:5173 已被占用（curl rc=${port_probe}），本验收不换端口"

# ── 本地栈归属 ──────────────────────────────────────────────────────

if "$DEV" health >/dev/null 2>&1; then
  BACKEND_PREEXISTING=1
  STACK_HEALTHY=1
  printf '本地栈已健康，复用它（本轮不会 down）\n'
else
  BACKEND_OWNED=1
  "$DEV" prepare >/dev/null 2>&1 || blocked 'dev-local.sh prepare 失败'
  "$DEV" up >/dev/null 2>&1 || blocked 'dev-local.sh up 失败'
  "$DEV" health >/dev/null 2>&1 || blocked 'dev-local.sh health 失败'
  STACK_HEALTHY=1
fi
# 后端已知缺陷（0.2.5）：.local-dev/browser-fixtures 目录不在 dev-local validate_material
# 白名单里；validate_material 会拒绝 .local-dev 下**任何**白名单外条目——所以改名成同级
# 的 .lockbak 也没用，必须把整个目录挪出 .local-dev（放本轮 run 目录里）。绕法：挪出 →
# bootstrap → **无论成败**都原样挪回；挪不回来就把 receipt 滞留的事实报成阻塞，绝不静默
# 丢收条。
bootstrap_stack(){
  if "$DEV" bootstrap >/dev/null 2>&1; then return 0; fi
  if [ ! -d "$FIXTURE_RECEIPT_DIR" ]; then
    blocked 'dev-local.sh bootstrap 失败'
    return 0
  fi
  local moved="$RUN_DIR/browser-fixtures.lockbak"
  mv "$FIXTURE_RECEIPT_DIR" "$moved" || blocked 'dev-local.sh bootstrap 失败（回执目录挪出失败）'
  if "$DEV" bootstrap >/dev/null 2>&1; then
    if mv "$moved" "$FIXTURE_RECEIPT_DIR" 2>/dev/null; then
      return 0
    fi
    blocked "bootstrap 成功，但回执目录没能归回原位：$moved（请手工挪回 $FIXTURE_RECEIPT_DIR）"
  fi
  mv "$moved" "$FIXTURE_RECEIPT_DIR" 2>/dev/null || true
  blocked 'dev-local.sh bootstrap 失败（挪走回执目录后仍然失败）'
}
bootstrap_stack

# ── fixture 收敛 ────────────────────────────────────────────────────

# 后端运行回执的路径是纯派生量（STATE 目录 + converge 那一次的 RUN_ID，见
# fixture_step 的发号规则：第一次算子调用是 <run id>-1），在第一次 converge **之前**
# 就定下来：收尾阶段的 delta 清理要拿它当 --ledger，而 converge 可能半路失败，
# 那时也必须知道该去哪里找这一轮的回执。
RECEIPT="$FIXTURE_RECEIPT_DIR/$RUN_ID-1.json"
FIXTURE_TOUCHED=1

# 后端算子失败时按它自己的分层给结论：75 环境阻塞 / 1 功能失败 / 64 用法。
# $1 步骤名（写进消息）
fixture_gate(){
  case "$(classify_fixture_failure "$FIXTURE_RC")" in
    ok) return 0 ;;
    usage) USAGE_FAILED=1; exit 2 ;;
    infra) blocked "browser-fixture.sh $1 阻塞（rc=${FIXTURE_RC}）" ;;
    *) functional_abort "browser-fixture.sh $1 判功能失败（rc=${FIXTURE_RC}）：专用账号的基准数据不在位，按后端 README 的恢复一节处理" ;;
  esac
}

fixture_step converge
case "$FIXTURE_OUT" in
  *'BROWSER_FIXTURE_CONVERGE PASS'*) FIXTURE_CONVERGE_STATUS='PASS' ;;
  *) FIXTURE_CONVERGE_STATUS="FAILED(rc=$FIXTURE_RC)" ;;
esac
if [ "$FIXTURE_RC" != '0' ] || [ "$FIXTURE_CONVERGE_STATUS" != 'PASS' ]; then
  fixture_gate converge
  # rc=0 却没打出终止行：算子的输出合同坏了，这是报告层面的问题。
  USAGE_FAILED=1
  exit 2
fi

fixture_step verify
case "$FIXTURE_OUT" in
  *'BROWSER_FIXTURE_VERIFY PASS'*) FIXTURE_VERIFY_STATUS='PASS' ;;
  *) FIXTURE_VERIFY_STATUS="FAILED(rc=$FIXTURE_RC)" ;;
esac
if [ "$FIXTURE_RC" != '0' ] || [ "$FIXTURE_VERIFY_STATUS" != 'PASS' ]; then
  fixture_gate verify
  USAGE_FAILED=1
  exit 2
fi
FIXTURE_VERIFIED=1

# 回执门：converge 在把控制权交给浏览器之前写下它。没有它、权限不对、
# 或者不是本轮的 run id，就说明后端根本没为这一轮准备好数据，不能开始旅程。
[ -f "$RECEIPT" ] || blocked "后端运行回执缺失：$RECEIPT"
receipt_mode="$(stat -f '%Lp' "$RECEIPT" 2>/dev/null || stat -c '%a' "$RECEIPT" 2>/dev/null || printf 'unknown')"
[ "$receipt_mode" = '600' ] || blocked "后端运行回执权限不是 0600（实到 ${receipt_mode}）"
grep -Fq "$RUN_ID-1" "$RECEIPT" || blocked '后端运行回执里没有本轮 run id'

# ── 起 Vite ─────────────────────────────────────────────────────────

cd "$FRONT_ROOT"
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local \
  npm run dev -- --host localhost --port 5173 --strictPort >"$RUN_DIR/vite.log" 2>&1 &
vite_candidate=$!
# kill -0 通过才算「我拥有这个进程」；没通过就当没起过，收尾阶段一个进程都不动。
if kill -0 "$vite_candidate" 2>/dev/null; then
  VITE_PID="$vite_candidate"
else
  blocked 'Vite 没有启动成功'
fi

vite_ready=0
attempt=0
while [ "$attempt" -lt 60 ]; do
  kill -0 "$VITE_PID" 2>/dev/null || break
  if curl -sS -o /dev/null --max-time 2 "$FRONTEND_ORIGIN/" >/dev/null 2>&1; then
    vite_ready=1
    break
  fi
  sleep 1
  attempt=$((attempt + 1))
done
[ "$vite_ready" = '1' ] || blocked "Vite 在 ${attempt}s 内没有在 $FRONTEND_ORIGIN 就绪（本验收不换端口）"

# ── 运行 manifest ───────────────────────────────────────────────────

AB_VERSION="$(agent-browser --version 2>/dev/null | head -1 | awk '{print $NF}')"
[ -n "$AB_VERSION" ] || blocked '读不到 agent-browser 版本'

# Chrome 构建只从 navigator.userAgent 里安全地摘 `Chrome/<版本>` 一段，
# 不把整条 UA 写进产物（UA 里还有机型等与结论无关的环境细节）。
if [ "$HEADED" = '1' ]; then export AGENT_BROWSER_HEADED=1; fi
# 浏览器一旦被真正打开就要在收尾里关；在这之前阻塞的话一个会话都没建，收尾也不该去建。
BROWSER_TOUCHED=1
agent-browser --session "$CANDIDATE_SESSION" open "$FRONTEND_ORIGIN/" >/dev/null 2>&1 \
  || blocked '无法在候选会话里打开前端页面'
CHROME_BUILD="$(agent-browser --session "$CANDIDATE_SESSION" eval 'navigator.userAgent' 2>/dev/null \
  | grep -o 'Chrome/[0-9][0-9.]*' | head -1 || true)"
[ -n "$CHROME_BUILD" ] || blocked '读不到 Chrome 构建版本'

# 视觉清单把取景环境的 locale / timezone 冻死成 zh-CN / Asia/Shanghai
# （e2e/真实后端/报告.ts 构造候选视觉清单，两个字面量在类型里也是冻结的）。
# 而 agent-browser 0.27.2 没有任何开关能设定它们 —— capture_scene 只管得了视口与 media。
# 所以只能读这台机器上真实解析出来的值再逐字核对：核不上就是环境阻塞（设计稿 §14），
# 不核对的话，两台渲染环境本来就不同的机器会照样把七个场景比成 matched。
# eval 的输出是 JSON 编码的字符串（真机实测：`"en-US | Asia/Singapore"`），先剥掉两侧引号。
FROZEN_LOCALE='zh-CN'
FROZEN_TIMEZONE='Asia/Shanghai'
browser_env="$(agent-browser --session "$CANDIDATE_SESSION" \
  eval 'navigator.language + " " + Intl.DateTimeFormat().resolvedOptions().timeZone' 2>/dev/null \
  | head -1 | tr -d '\r' | sed 's/^"//; s/"$//' || true)"
browser_locale="${browser_env%% *}"
browser_timezone="${browser_env##* }"
case "$browser_env" in
  *' '*) : ;;
  *) blocked '读不到浏览器的 locale 与 timezone' ;;
esac
[ -n "$browser_locale" ] && [ -n "$browser_timezone" ] || blocked '读不到浏览器的 locale 与 timezone'
[ "$browser_locale" = "$FROZEN_LOCALE" ] \
  || blocked "浏览器 locale 不是冻结值 ${FROZEN_LOCALE}（实到 ${browser_locale}）：七张基线只在这一套取景环境下成立"
[ "$browser_timezone" = "$FROZEN_TIMEZONE" ] \
  || blocked "浏览器 timezone 不是冻结值 ${FROZEN_TIMEZONE}（实到 ${browser_timezone}）：七张基线只在这一套取景环境下成立"

FRONTEND_COMMIT="$(git -C "$FRONT_ROOT" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
BACKEND_COMMIT="$(git -C "$AGXP_MONOREPO_DIR" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"

jq -n --arg runId "$RUN_ID" --arg front "$FRONTEND_COMMIT" --arg back "$BACKEND_COMMIT" \
  --arg ab "$AB_VERSION" --arg chrome "$CHROME_BUILD" --arg origin "$FRONTEND_ORIGIN" \
  --arg gate "$GATE" --arg journey "$JOURNEY_ARG" \
  --argjson headed "$([ "$HEADED" = '1' ] && echo true || echo false)" \
  --argjson preexisting "$([ "$BACKEND_PREEXISTING" = '1' ] && echo true || echo false)" \
  '{schemaVersion:1,runId:$runId,frontendCommit:$front,backendCommit:$back,
    agentBrowserVersion:$ab,chromeBuild:$chrome,
    viewport:{width:390,height:844},locale:"zh-CN",timezone:"Asia/Shanghai",colorScheme:"light",deviceScaleFactor:1,
    environment:{origin:$origin,dataSource:"backend",backendEnv:"local",gate:$gate,journey:$journey,
                 headed:$headed,backendPreexisting:$preexisting}}' \
  >"$RUN_DIR/run-manifest.json"

# ── 旅程调度 ────────────────────────────────────────────────────────

export RUN_DIR PRIVATE_JOURNAL FRONTEND_ORIGIN AGXP_MONOREPO_DIR
export FRAGMENT_DIR="$FRAGMENT_DIR_MAIN"

journey_script(){
  case "$1" in
    candidate-load) printf '%s' "$ROOT_DIR/旅程/候选数据加载.sh" ;;
    candidate-crud) printf '%s' "$ROOT_DIR/旅程/候选CRUD.sh" ;;
    recruiter-load) printf '%s' "$ROOT_DIR/旅程/招聘数据加载.sh" ;;
    recruiter-crud) printf '%s' "$ROOT_DIR/旅程/招聘CRUD.sh" ;;
    *) return 1 ;;
  esac
}

record_journey_rc(){
  JOURNEY_RCS="$JOURNEY_RCS $1=$2"
  printf '旅程 %s 退出码 %s\n' "$1" "$2"
}

journey_rc(){
  local item
  for item in $JOURNEY_RCS; do
    case "$item" in "$1="*) printf '%s' "${item#*=}"; return 0 ;; esac
  done
  printf 'none'
}

# $1 旅程 ID，$2 分片目录。前置旅程的分片写进 preconditions/，不进正式分片集合 ——
# 报告读取端只按「选中集合」判定，前置旅程不是被选中的旅程，不能顶替它的 skipped 分片。
run_journey(){
  local id="$1" dir="$2" script rc=0
  script="$(journey_script "$id")" || blocked "没有这条旅程的脚本：$id"
  JOURNEYS_STARTED=1
  mkdir -p "$dir"
  set +e
  FRAGMENT_DIR="$dir" bash "$script"
  rc=$?
  set -e
  record_journey_rc "$id" "$rc"
}

run_isolation(){
  local rc=0
  JOURNEYS_STARTED=1
  set +e
  ( . "$ROOT_DIR/公共步骤.sh" && 会话隔离门 )
  rc=$?
  set -e
  record_journey_rc 'session-isolation' "$rc"
  # 隔离门的最后一登是候选退出后重新登录（全新的 begin）；这是收尾 cleanup 的
  # 登录锚点——离它不足一分钟就去 converge 登录，会撞 429。
  LAST_LOGIN_EPOCH="$(date +%s)"
}

# 未选中的旅程先写 skipped 分片：报告读取端要求五个分片齐全，缺一个就是报告错误。
# 第一条业务旅程的开场就是候选登录（begin 限流同手机号一分钟一次），这里先错峰。
pace_before_login
for journey in $ALL_JOURNEYS; do
  is_selected "$journey" || write_skipped "$journey" '未选中'
done

# 同角色的加载前置：CRUD 依赖那一屏先被读出来，但前置不是被选中的旅程，
# 分片另存 preconditions/，正式分片集合里它仍然是 skipped。
run_precondition(){
  local load="$1" crud="$2"
  is_selected "$crud" || return 0
  is_selected "$load" && return 0
  run_journey "$load" "$PRECONDITION_DIR"
  return 0
}
run_precondition 'candidate-load' 'candidate-crud'
run_precondition 'recruiter-load' 'recruiter-crud'

# 前置失败＝这一屏的数据本来就读不出来，依赖它的 CRUD 不再跑。
precondition_ok(){
  local load="$1" rc
  rc="$(journey_rc "$load")"
  [ "$rc" = 'none' ] || [ "$rc" = '0' ]
}

# 前置的分片写在 preconditions/ 里，报告读取端永远看不到它 —— 所以「前置是怎么败的」
# 只能由这里翻译进被选 CRUD 的那一份分片，而且必须按设计稿 §14 分两路：
#   · 前置以 75 退出＝环境阻塞（本机 OTP 材料超时、Chrome 没起来一类），
#     CRUD 记 blocked，报告升级成 INFRA_BLOCKED（75）；
#   · 前置以其它非零码退出＝真实功能失败，CRUD 照旧记 skipped，
#     报告判「已选旅程未执行」＝FUNCTIONAL_FAILED（1）。
# 一律写 skipped 会把环境问题报成业务失败；一律写 blocked 会把业务失败藏进 75。
skip_crud_for_precondition(){
  local crud="$1" load="$2" rc
  rc="$(journey_rc "$load")"
  if [ "$rc" = '75' ]; then
    write_blocked "$crud" '未开始' "同角色加载前置环境阻塞（$load 退出码 75），未执行"
  else
    write_skipped "$crud" '同角色加载前置失败，未执行'
  fi
}

for journey in $ALL_JOURNEYS; do
  is_selected "$journey" || continue
  case "$journey" in
    candidate-crud)
      if precondition_ok 'candidate-load'; then
        run_journey "$journey" "$FRAGMENT_DIR_MAIN"
      else
        skip_crud_for_precondition "$journey" 'candidate-load'
      fi
      ;;
    recruiter-crud)
      if precondition_ok 'recruiter-load'; then
        run_journey "$journey" "$FRAGMENT_DIR_MAIN"
      else
        skip_crud_for_precondition "$journey" 'recruiter-load'
      fi
      ;;
    session-isolation)
      # 隔离门断言的是两侧被 CRUD 改回来的基准值：任何一条 CRUD 没跑完，
      # 它的失败只反映残留的中间态，不反映隔离本身，所以这时不跑它。
      if [ "$(journey_rc 'candidate-crud')" = '0' ] && [ "$(journey_rc 'recruiter-crud')" = '0' ]; then
        run_isolation
      else
        write_skipped "$journey" '依赖的 CRUD 旅程未通过，未执行'
      fi
      ;;
    *)
      run_journey "$journey" "$FRAGMENT_DIR_MAIN"
      ;;
  esac
done

exit 0
