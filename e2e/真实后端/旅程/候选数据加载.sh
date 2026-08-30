#!/usr/bin/env bash
# 旅程 A：候选数据加载（candidate-load）。
#
# 证明求职端的简历、求职意向、披露偏好三屏都来自真实 BFF：每一屏先断言后端 fixture 的固定
# 业务标记，再硬刷新一次证明它不是本地乐观态，然后才拍视觉基线。全程只用语义点击，
# 直接改 hash 只允许出现在失败恢复里，所以这里一次都没有。
#
# 后端固定基准（apps/recruitment/scripts/browser-fixture.sh 的冻结字面量）：
#   真名 浏览器验收候选人 / 摘要 浏览器验收候选人 · 真实后端基准摘要
#   一条意向：前端开发工程师 · 上海市 · 30-45K → 页面派生标题 [上海市] 前端开发工程师
#     （src/数据/后端映射.ts:193 从BFF意向 的 `[城市] 职位` 格式）
#   披露偏好 current_employer=never → 当前公司：不披露
#
# 标识符一律 ASCII：macOS /bin/bash 是 3.2，不认非 ASCII 变量名。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../公共步骤.sh
. "$ROOT_DIR/公共步骤.sh"

export AGENT_BROWSER_SESSION="${AGENT_BROWSER_SESSION:-$CANDIDATE_SESSION}"
JOURNEY='candidate-load'
MILESTONE='登录'

BASE_NAME='浏览器验收候选人'
BASE_SUMMARY='浏览器验收候选人 · 真实后端基准摘要'
BASE_INTENTION_TITLE='[上海市] 前端开发工程师'
RECRUITER_PRIVATE_MARKER='浏览器验收招聘官'

on_exit(){
  local rc=$?
  trap - EXIT
  if [ "$rc" -ne 0 ] && [ "$FRAGMENT_WRITTEN" = '0' ]; then
    capture_failure_snapshot "$JOURNEY"
    # 失败是环境阻塞还是业务失败由 write_journey_failure 按 JOURNEY_BLOCKED 决定：
    # 阻塞写 blocked 分片并把退出码抬成 75，让编排层与报告都看得见这是 INFRA_BLOCKED。
    write_journey_failure "$JOURNEY" "$MILESTONE" || true
  fi
  if [ "$rc" -ne 0 ] && [ "$JOURNEY_BLOCKED" = '1' ]; then rc=75; fi
  exit "$rc"
}
trap on_exit EXIT

login_candidate

MILESTONE='我的简历'
click_button_exact '我'
click_button_exact '我的简历'
assert_text "$BASE_NAME"
assert_text "$BASE_SUMMARY"
reload_and_assert "$BASE_NAME"
assert_text "$BASE_SUMMARY"
assert_no_mock_data
capture_scene 'candidate-resume-loaded'

MILESTONE='求职意向'
click_back
click_button_exact '求职意向'
assert_text "$BASE_INTENTION_TITLE"
# 配额行「1/5」：基准只有一条意向（src/屏幕/求职意向管理.tsx 意向配额上限 = 5）
assert_text '1/5'
reload_and_assert "$BASE_INTENTION_TITLE"
assert_text '1/5'
assert_no_mock_data
capture_scene 'candidate-intentions-loaded'

MILESTONE='披露偏好'
click_back
click_button_exact '披露偏好'
assert_text '当前公司'
assert_pressed '当前公司：不披露'
ab reload >/dev/null
assert_text '当前公司'
assert_pressed '当前公司：不披露'
assert_no_mock_data
capture_scene 'candidate-disclosure-loaded'

# 双盲边界：求职端任何一屏都不该出现招聘方的私有名片标记
MILESTONE='角色隔离'
assert_absent "$RECRUITER_PRIVATE_MARKER"

MILESTONE='完成'
write_journey_result "$JOURNEY" pass "$MILESTONE"
