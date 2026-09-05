#!/usr/bin/env bash
# Hosted Agent 闭环旅程 · 四个后端 acceptance scene 的真实页面行为。
#
# HOSTED_AGENT_SCENE（由 运行整栈验收.sh 通过受控环境传入，闭合为四值）：
#   happy  完整闭环：规则 ready/accept、PDF、delegation、candidate target、
#         recruiter screen_resume、双方 coordination/confirmation、公开终结、深链复读
#   p4     delegation 后 Agent 服务不可用：零 Case、无「查看进展」、刷新复读
#   p5     recruiter target attention：双 viewer 同一安全说明、零 Agent retry
#   p6     规则解释失败：零 active rule、草稿保留、失败卡关闭恢复
#
# 终态推进只通过页面当前公开允许的动作（接受 / 确认意向），不从页面外猜 action、
# 不调用 internal hook —— 后端 owner-safe cleanup 的 terminalization 依赖 Case 的
# 公开终态。safe-failure 文案出现在 happy 路径上就是失败，绝不冒充通过。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
. "$ROOT_DIR/公共步骤.sh"

JOURNEY='hosted-agent'
MILESTONE='启动'
# 硬约束表达（与输入框 placeholder 例文同款语义）：真实 Agent 必须把它解释成
# executable 规则才能被「确认规则」沉淀为 active rule —— advisory（偏好排序）或
# unsupported 的 ready 提案按公开合同只能放弃，accept 会 409 not_actionable。
RULE_TEXT='不接受大小周的岗位，直接过滤不要推荐'
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

# S0 候选侧推进：可多轮事实补问；S0 可 fit 直通进 S1。人工停点后端只认补答事实或
# 结束（continue 恒被拒），脚本不点击决策卡。
advance_candidate_s0(){
  local tries=0 body t only_decision=0
  while [ "$tries" -lt 240 ]; do
    body="$(ab get text body 2>/dev/null || printf '')"
    case "$body" in
      *'招聘方 AI 正在初筛已提交简历'*|*'等待招聘方决定'*) return 0 ;;
      *'已结束'*|*'需注意'*)
        echo 'S0 进入公开结束或注意终态' >&2
        return 1 ;;
    esac
    if has_button_exact '提交回答'; then
      only_decision=0
      find_retry label '回答问题' fill '我有 React 与 TypeScript 的真实项目经验，可以接受混合办公。' >/dev/null
      click_button_exact '提交回答'
      t=0
      while [ "$t" -lt 60 ] && has_button_exact '提交回答'; do
        t=$((t + 1)); sleep 1
      done
      if has_button_exact '提交回答'; then
        echo '提交回答 点击后 60 秒仍未从页面消失' >&2
        return 1
      fi
    elif has_button_exact '继续初筛'; then
      only_decision=$((only_decision + 1))
      if [ "$only_decision" -ge 20 ]; then
        echo 'S0 停在不允许继续的人工决定卡（后端只认补答事实或结束）' >&2
        return 1
      fi
    fi
    tries=$((tries + 1))
    sleep 1
  done
  echo '等待 S0 候选侧推进或进入 S1 超时' >&2
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

# P4 专属：只接受「AI 服务暂时不可用，本次没有创建 Case」；evaluation failure、
# policy、quota、cooldown 之类的其它公开拒绝都必须让本 scene 失败。
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

# P5 专属：recruiter / candidate 双 viewer 看到的同一 attention 安全说明。
wait_p5_attention(){
  local tries=0 body
  while [ "$tries" -lt 420 ]; do
    body="$(ab get text body 2>/dev/null || printf '')"
    case "$body" in
      *'AI 服务暂时不可用，本 Case 尚未继续'*) return 0 ;;
    esac
    tries=$((tries + 1)); sleep 1
  done
  echo '等待 P5 attention 公开终态超时' >&2
  return 1
}

# happy 专属：从当前 viewer 的公开动作把 Case 推向终态。
#   0 ＝ 已在公开终态；1 ＝ 已发送一个公开动作，需 reload/轮转后继续；2 ＝ 无法合法推进。
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

# ── 共享页面步骤（只提取真实重复的步骤，不建通用 DSL）──────────────

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
    click_button_exact '确认委托'
  fi
}

# ── scene：p6 规则解释公开失败 ──────────────────────────────────────

run_p6(){
  local count_before draft
  MILESTONE='P6 提交规则'
  open_candidate_rules
  count_before="$(candidate_rule_count)"
  click_button '手动添加规则'
  find_retry placeholder '例：不接受大小周的岗位直接过滤' fill "$RULE_TEXT" >/dev/null
  click_button_exact '提交给AI代理理解'
  assert_text 'AI代理正在理解这条规则…'
  MILESTONE='P6 等待公开失败终态'
  wait_p6_rule_failed
  assert_text 'AI 暂时不可用，本次规则没有生效'
  if has_button_exact '确认规则'; then
    echo 'P6 失败终态上不应出现确认规则入口' >&2
    return 1
  fi
  ab reload >/dev/null
  MILESTONE='P6 复读零 active rule'
  if [ "$(candidate_rule_count)" != "$count_before" ]; then
    echo 'P6 reload 后 active rule 计数发生了变化' >&2
    return 1
  fi
  MILESTONE='P6 关闭失败卡恢复草稿'
  click_button_exact '关闭'
  draft="$(ab get value 'textarea[placeholder="例：不接受大小周的岗位直接过滤"]')"
  if [ "$draft" != "$RULE_TEXT" ]; then
    echo 'P6 关闭失败卡后草稿没有恢复为提交前文本' >&2
    return 1
  fi
  ab reload >/dev/null
  if [ "$(candidate_rule_count)" != "$count_before" ]; then
    echo 'P6 草稿恢复后 reload 仍不应产生 active rule' >&2
    return 1
  fi
}

wait_p6_rule_failed(){
  local tries=0 body
  while [ "$tries" -lt 180 ]; do
    body="$(ab get text body 2>/dev/null || printf '')"
    case "$body" in
      *'AI 暂时不可用，本次规则没有生效'*) return 0 ;;
      *'确认规则'*)
        echo 'P6 期待公开失败，规则解释却就绪了' >&2
        return 1 ;;
    esac
    tries=$((tries + 1)); sleep 1
  done
  return 1
}

# ── scene：p4 delegation 公开失败 ────────────────────────────────────

run_p4(){
  MILESTONE='P4 准备简历'
  export AGENT_BROWSER_SESSION="$CANDIDATE_SESSION"
  login_candidate
  prepare_candidate_pdf
  MILESTONE='P4 发起 delegation'
  delegate_candidate
  MILESTONE='P4 等待公开失败终态'
  wait_p4_unavailable
  assert_text 'AI 服务暂时不可用，本次没有创建 Case'
  if has_button_exact '查看进展'; then
    echo 'P4 不应出现查看进展入口（本 scene 没有创建 Case）' >&2
    return 1
  fi
  MILESTONE='P4 刷新复读同一失败原因'
  ab reload >/dev/null
  assert_text 'AI 服务暂时不可用，本次没有创建 Case'
  if has_button_exact '查看进展'; then
    echo 'P4 reload 后仍不应出现查看进展入口' >&2
    return 1
  fi
}

# ── scene：p5 双 viewer attention ────────────────────────────────────

run_p5(){
  local case_url
  MILESTONE='P5 准备并发起委托'
  export AGENT_BROWSER_SESSION="$CANDIDATE_SESSION"
  login_candidate
  prepare_candidate_pdf
  delegate_candidate
  MILESTONE='P5 等待开案'
  wait_delegation_case_started
  click_button_exact '查看进展'
  assert_text '匿名初筛'
  case_url="$(ab get url)"
  case "$case_url" in
    *'#/deal/'*) : ;;
    *) echo '查看进展没有进入 candidate Case 深链' >&2; return 1 ;;
  esac
  MILESTONE='P5 candidate target 完成'
  advance_candidate_s0
  MILESTONE='P5 recruiter 侧 attention'
  export AGENT_BROWSER_SESSION="$RECRUITER_SESSION"
  login_recruiter
  click_after_hydrate '人才'
  click_button_exact '在谈'
  wait_text '简历提交'
  click_button '简历提交'
  wait_p5_attention
  assert_text 'AI 服务暂时不可用，本 Case 尚未继续'
  assert_text '需注意'
  if has_button_exact '重试校验'; then
    echo 'P5 recruiter 侧不应出现 Agent retry（重试校验是 readiness 通道，不是 Agent retry）' >&2
    return 1
  fi
  MILESTONE='P5 recruiter 刷新复读'
  ab reload >/dev/null
  assert_text 'AI 服务暂时不可用，本 Case 尚未继续'
  MILESTONE='P5 candidate 深链复读同一说明'
  export AGENT_BROWSER_SESSION="$CANDIDATE_SESSION"
  ab open "$case_url" >/dev/null
  assert_text 'AI 服务暂时不可用，本 Case 尚未继续'
  if has_button_exact '重试校验'; then
    echo 'P5 candidate 侧同样不应出现 Agent retry' >&2
    return 1
  fi
}

# ── scene：happy 完整闭环 ────────────────────────────────────────────

run_happy(){
  local count_before candidate_case_url recruiter_case_url
  MILESTONE='happy 提交并确认规则'
  open_candidate_rules
  count_before="$(candidate_rule_count)"
  click_button '手动添加规则'
  find_retry placeholder '例：不接受大小周的岗位直接过滤' fill "$RULE_TEXT" >/dev/null
  click_button_exact '提交给AI代理理解'
  assert_text 'AI代理正在理解这条规则…'
  wait_rule_proposal_ready
  assert_text '确认规则'
  click_button_exact '确认规则'
  # 权威重读：accept 后页面计数不自动刷新，先硬刷新再读 active rule 数。
  ab reload >/dev/null
  wait_candidate_rule_count "$((count_before + 1))"

  MILESTONE='happy 上传并解析 PDF'
  click_back
  prepare_candidate_pdf
  assert_text '识别完成'

  MILESTONE='happy 发起 delegation'
  delegate_candidate
  wait_delegation_case_started
  click_button_exact '查看进展'
  assert_text '匿名初筛'
  candidate_case_url="$(ab get url)"
  case "$candidate_case_url" in
    *'#/deal/'*) : ;;
    *) echo '查看进展没有进入 candidate Case 深链' >&2; return 1 ;;
  esac

  MILESTONE='happy candidate target 完成'
  advance_candidate_s0

  MILESTONE='happy recruiter 读取同一 Case'
  export AGENT_BROWSER_SESSION="$RECRUITER_SESSION"
  login_recruiter
  click_after_hydrate '人才'
  click_button_exact '在谈'
  wait_text '简历提交'
  click_button '简历提交'
  MILESTONE='happy recruiter target screen_resume 完成'
  wait_one_of '通过初筛' '需注意' 420
  assert_text '通过初筛'
  recruiter_case_url="$(ab get url)"
  click_button_exact '通过初筛'

  MILESTONE='happy 双方推进协调'
  local cand_terminal=0 rec_terminal=0 round=0 rc
  while [ "$round" -lt 6 ]; do
    if [ "$rec_terminal" = '0' ]; then
      rc=0
      advance_to_terminal_for_role "$RECRUITER_SESSION" "$recruiter_case_url" || rc=$?
      case "$rc" in
        0) rec_terminal=1 ;;
        1) ;;
        *) echo 'recruiter Case 无法合法推进到终态' >&2; return 1 ;;
      esac
    fi
    if [ "$cand_terminal" = '0' ]; then
      rc=0
      advance_to_terminal_for_role "$CANDIDATE_SESSION" "$candidate_case_url" || rc=$?
      case "$rc" in
        0) cand_terminal=1 ;;
        1) ;;
        *) echo 'candidate Case 无法合法推进到终态' >&2; return 1 ;;
      esac
    fi
    if [ "$cand_terminal" = '1' ] && [ "$rec_terminal" = '1' ]; then
      break
    fi
    round=$((round + 1))
  done
  if [ "$cand_terminal" != '1' ] || [ "$rec_terminal" != '1' ]; then
    echo 'happy Case 未在 6 轮内到达公开终态' >&2
    return 1
  fi

  MILESTONE='happy 深链复读终态'
  local pair_session pair_url
  for pair_session in "$CANDIDATE_SESSION|$candidate_case_url" "$RECRUITER_SESSION|$recruiter_case_url"; do
    pair_url="${pair_session#*|}"
    pair_session="${pair_session%%|*}"
    export AGENT_BROWSER_SESSION="$pair_session"
    ab open "$pair_url" >/dev/null
    assert_text '双方已确认，正在创建会话'
    if has_button_exact '接受' || has_button_exact '确认意向' || has_button_exact '婉拒意向'; then
      echo '终态上不应再出现任何推进动作按钮' >&2
      return 1
    fi
    assert_no_mock_data
  done
}

# ── 闭合分发（任何登录之前）────────────────────────────────────────

case "${HOSTED_AGENT_SCENE:-}" in
  happy) run_happy ;;
  p4) run_p4 ;;
  p5) run_p5 ;;
  p6) run_p6 ;;
  *) printf 'HOSTED_AGENT_SCENE 必须是 happy|p4|p5|p6\n' >&2; exit 2 ;;
esac

MILESTONE='完成'
write_journey_result "$JOURNEY" pass "$MILESTONE"
