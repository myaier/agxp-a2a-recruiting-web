#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
. "$ROOT_DIR/公共步骤.sh"

JOURNEY='hosted-agent'
MILESTONE='候选登录'
RULE_TEXT='优先考虑支持混合办公并且周末双休的岗位'
RESUME_NAME='浏览器验收临时简历.pdf'
TEMP_PDF_DIR="$(dirname "$PRIVATE_JOURNAL")"

on_exit(){
  local rc=$?
  trap - EXIT
  if [ "$rc" -ne 0 ] && [ "$FRAGMENT_WRITTEN" = '0' ]; then
    capture_failure_snapshot "$JOURNEY"
    write_journey_failure "$JOURNEY" "$MILESTONE" || true
  fi
  if [ "$rc" -ne 0 ] && [ "$JOURNEY_BLOCKED" = '1' ]; then rc=75; fi
  exit "$rc"
}
trap on_exit EXIT

wait_one_of(){
  local first="$1" second="$2" tries=0 body max
  max="${3:-180}"
  while [ "$tries" -lt "$max" ]; do
    body="$(ab get text body 2>/dev/null || printf '')"
    case "$body" in
      *"$first"*|*"$second"*) return 0 ;;
    esac
    tries=$((tries + 1))
    sleep 1
  done
  echo "等待公开终态超时：${first} / ${second}" >&2
  return 1
}

candidate_rule_count_once(){
  local body count
  body="$(ab get text body 2>/dev/null || printf '')"
  count="$(printf '%s\n' "$body" | grep -o '[0-9][0-9]* 条' | head -n 1 | tr -dc '0-9')"
  [ -n "$count" ] || return 1
  printf '%s' "$count"
}

candidate_rule_count(){
  local tries=0 count
  while [ "$tries" -lt 30 ]; do
    count="$(candidate_rule_count_once 2>/dev/null || printf '')"
    if [ -n "$count" ]; then printf '%s' "$count"; return 0; fi
    tries=$((tries + 1))
    sleep 1
  done
  echo '规则页水合后仍未出现 active rule 计数' >&2
  return 1
}

wait_candidate_rule_count(){
  local expected="$1" tries=0 actual
  while [ "$tries" -lt 60 ]; do
    actual="$(candidate_rule_count_once 2>/dev/null || printf '')"
    if [ "$actual" = "$expected" ]; then return 0; fi
    tries=$((tries + 1))
    sleep 1
  done
  echo "等待 active rule 数量变为 ${expected} 超时" >&2
  return 1
}

wait_pdf_parse(){
  local tries=0 status
  while [ "$tries" -lt 180 ]; do
    if ab find role button text --name "$RESUME_NAME 识别完成" --exact >/dev/null 2>&1; then
      return 0
    fi
    for status in '未能读取 · 可重试' '内容过多 · 请替换' '识别失败 · 可重试' '服务繁忙 · 稍后重试'; do
      if ab find role button text --name "$RESUME_NAME $status" --exact >/dev/null 2>&1; then
        echo 'PDF 解析进入公开失败终态' >&2
        return 1
      fi
    done
    tries=$((tries + 1))
    sleep 1
  done
  echo '等待 PDF 解析公开终态超时' >&2
  return 1
}

has_button_exact(){
  ab find role button text --name "$1" --exact >/dev/null 2>&1
}

advance_candidate_s0(){
  local tries=0 body t
  while [ "$tries" -lt 240 ]; do
    body="$(ab get text body 2>/dev/null || printf '')"
    case "$body" in
      *'招聘方 AI 正在初筛已提交简历'*|*'等待招聘方决定'*) return 0 ;;
      *'已结束'*|*'需注意'*)
        echo 'S0 进入公开结束或注意终态' >&2
        return 1 ;;
    esac
    if has_button_exact '提交回答'; then
      find_retry label '回答问题' fill '我有 React 与 TypeScript 的真实项目经验，可以接受混合办公。' >/dev/null
      click_button_exact '提交回答'
      t=0
      while [ "$t" -lt 60 ] && has_button_exact '提交回答'; do
        t=$((t + 1)); sleep 1
      done
    elif has_button_exact '继续初筛'; then
      click_button_exact '继续初筛'
      t=0
      while [ "$t" -lt 60 ] && has_button_exact '继续初筛'; do
        t=$((t + 1)); sleep 1
      done
    fi
    tries=$((tries + 1))
    sleep 1
  done
  echo '等待 S0 候选侧推进或进入 S1 超时' >&2
  return 1
}

advance_case_for_current_role(){
  local tries=0
  while [ "$tries" -lt 120 ]; do
    if has_button_exact '接受'; then
      click_button_exact '接受'
      return 0
    fi
    if has_button_exact '确认意向'; then
      click_button_exact '确认意向'
      return 0
    fi
    tries=$((tries + 1))
    sleep 1
  done
  echo '当前角色未出现可执行的协同或意向决定' >&2
  return 1
}

capture_case_authority_marker(){
  local tries=0 body
  while [ "$tries" -lt 60 ]; do
    body="$(ab get text body 2>/dev/null || printf '')"
    case "$body" in
      *'等待招聘方确认意向'*) CASE_AUTHORITY_MARKER='等待招聘方确认意向'; return 0 ;;
      *'等待候选人确认意向'*) CASE_AUTHORITY_MARKER='等待候选人确认意向'; return 0 ;;
      *'等待双方确认意向'*) CASE_AUTHORITY_MARKER='等待双方确认意向'; return 0 ;;
      *'真人会话已建立'*) CASE_AUTHORITY_MARKER='真人会话已建立'; return 0 ;;
      *'等待招聘方决定'*) CASE_AUTHORITY_MARKER='等待招聘方决定'; return 0 ;;
      *'等待候选人确认协同事项'*) CASE_AUTHORITY_MARKER='等待候选人确认协同事项'; return 0 ;;
    esac
    tries=$((tries + 1))
    sleep 1
  done
  echo '当前 Case 未出现可用于深链复核的权威步骤文案' >&2
  return 1
}

wait_rule_proposal_ready(){
  local tries=0 body
  while [ "$tries" -lt 180 ]; do
    body="$(ab get text body 2>/dev/null || printf '')"
    case "$body" in
      *'确认规则'*) return 0 ;;
      *'AI 暂时不可用，本次规则没有生效'*|*'内容无法可靠转换为规则，可编辑后重新提交'*|*'本次规则没有生效'*)
        echo 'P6 规则解释进入公开失败终态' >&2
        return 1 ;;
    esac
    tries=$((tries + 1))
    sleep 1
  done
  echo '等待 P6 规则解释公开终态超时' >&2
  return 1
}

wait_delegation_case_started(){
  local tries=0 body
  while [ "$tries" -lt 180 ]; do
    body="$(ab get text body 2>/dev/null || printf '')"
    case "$body" in
      *'查看进展'*) return 0 ;;
      *'AI 服务暂时不可用，本次没有创建 Case'*|*'本次评估未完成，不代表候选或岗位不合适'*|*'本次委托未完成'*|*'当前政策或资格不允许发起这次委托'*|*'这条推荐已过期，请刷新后查看'*|*'这条推荐当前已不可用，请刷新后查看'*|*'当前在谈已达到上限，请先处理已有在谈'*|*'近期已联系过对方，暂时不能重复发起'*)
        echo 'P4 委托进入公开拒绝或失败终态' >&2
        return 1 ;;
    esac
    tries=$((tries + 1))
    sleep 1
  done
  echo '等待 P4 委托公开终态超时' >&2
  return 1
}

# P6：candidate natural-language proposal -> ready -> accept -> authoritative active rule.
export AGENT_BROWSER_SESSION="$CANDIDATE_SESSION"
login_candidate
MILESTONE='P6 提交规则'
click_after_hydrate '我'
click_after_hydrate 'AI代理规则库'
RULE_COUNT_BEFORE="$(candidate_rule_count)"
RULE_COUNT_AFTER=$((RULE_COUNT_BEFORE + 1))
click_button '手动添加规则'
find_retry placeholder '例：不接受大小周的岗位直接过滤' fill "$RULE_TEXT" >/dev/null
click_button_exact '提交给AI代理理解'
assert_text 'AI代理正在理解这条规则…'
MILESTONE='P6 等待就绪'
wait_rule_proposal_ready
assert_text '确认规则'
click_button_exact '确认规则'
wait_candidate_rule_count "$RULE_COUNT_AFTER"
ab reload >/dev/null
wait_candidate_rule_count "$RULE_COUNT_AFTER"

# Candidate PDF：上传 consented PDF，等待真实 parse succeeded 的公开文案。
MILESTONE='上传并解析 PDF'
click_back
click_after_hydrate '我'
click_after_hydrate '我的简历'
cp "$ROOT_DIR/资源/简历-v1.pdf" "$TEMP_PDF_DIR/$RESUME_NAME"
click_button_exact '添加附件简历'
ab upload 'input[type="file"]' "$TEMP_PDF_DIR/$RESUME_NAME" >/dev/null
assert_text '允许 AI 识别这份简历？'
click_button_exact '同意并继续'
record_cleanup_marker candidate_resume_file_names "$RESUME_NAME"
wait_pdf_parse
assert_text '识别完成'

# P4：candidate market delegation -> server case_started -> open real MatchCase.
MILESTONE='P4 发起 candidate delegation'
click_back
click_after_hydrate '职位'
click_button_exact '市场'
wait_one_of '让AI代理去谈' '让AI代理帮我搜'
if on_screen '让AI代理帮我搜'; then
  click_button_exact '让AI代理帮我搜'
  wait_text '让AI代理去谈'
fi
click_button '让AI代理去谈'
wait_one_of '选择这次提交的简历' '确认委托AI代理？'
if on_screen '选择这次提交的简历'; then
  find_retry role radio click --name "$RESUME_NAME" >/dev/null
  click_button_exact '确认并委托'
else
  assert_text '确认委托AI代理？'
  click_button_exact '确认委托'
fi
MILESTONE='P4 等待开案'
wait_delegation_case_started
assert_text '查看进展'
click_button_exact '查看进展'
assert_text '匿名初筛'
CANDIDATE_CASE_URL="$(ab get url)"
case "$CANDIDATE_CASE_URL" in
  *'#/deal/'*) : ;;
  *) echo '查看进展没有进入 candidate Case 深链' >&2; exit 1 ;;
esac

# Candidate 侧推进 S0：处理可多轮补问与人工继续决定；S0 可不经人工决定 fit 直通进 S1。
MILESTONE='candidate target 完成'
advance_candidate_s0

# Recruiter 读取同一 Case；screen_resume 是 recruiter-target Hosted Agent task。
MILESTONE='招聘方读取同一 Case'
export AGENT_BROWSER_SESSION="$RECRUITER_SESSION"
login_recruiter
click_after_hydrate '人才'
click_button_exact '在谈'
wait_text '匿名初筛'
click_button '匿名初筛'

MILESTONE='recruiter target screen_resume 完成'
wait_one_of '通过初筛' '需注意' 420
assert_text '通过初筛'
click_button_exact '通过初筛'

# 至少一轮 coordination/confirmation；两端各完成公开可用动作，随后硬刷新确认权威状态。
MILESTONE='双方推进协调'
advance_case_for_current_role
settle
ab reload >/dev/null
assert_no_mock_data

export AGENT_BROWSER_SESSION="$CANDIDATE_SESSION"
ab reload >/dev/null
advance_case_for_current_role
settle
ab reload >/dev/null
assert_no_mock_data
CASE_AUTHORITY_MARKER=''
capture_case_authority_marker

# 直接打开先前保存的公开 Case URL，不依赖列表内存；深链重进后须恢复刚才捕获的当前步骤。
MILESTONE='candidate Case 深链重进'
ab open "$CANDIDATE_CASE_URL" >/dev/null
wait_text "$CASE_AUTHORITY_MARKER"
assert_text "$CASE_AUTHORITY_MARKER"
assert_no_mock_data

MILESTONE='完成'
write_journey_result "$JOURNEY" pass "$MILESTONE"
