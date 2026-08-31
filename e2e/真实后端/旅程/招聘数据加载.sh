#!/usr/bin/env bash
# 旅程 C：招聘数据加载（recruiter-load）。
#
# 证明招聘端的名片、公司主页资料、岗位管理三屏都来自真实 BFF：每一屏先断言后端 fixture 的
# 固定业务标记，再硬刷新一次证明它不是本地乐观态，然后才拍视觉基线。全程只用语义点击，
# 直接改 hash 只允许出现在失败恢复里，所以这里一次都没有。
#
# 后端固定基准（apps/recruitment/scripts/browser-fixture.sh 的冻结字面量）：
#   招聘方档案 public_name=浏览器验收招聘官 / title=招聘负责人
#   组织 display_name=brand_name=浏览器验收科技
#   company_intro=浏览器验收科技 · 真实后端企业介绍基线
#   两个基线岗位：浏览器验收岗位 · 在招基线（active）/ 浏览器验收岗位 · 归档基线（archived）
#
# 两处只能读 value、不能读页面文本的字段（React 的 value 不进 innerText）：
#   职务     —— 招聘名片.tsx:228 的 aria-label="职务" 输入框
#   公司介绍 —— 公司档案分区编辑.tsx:858 的 aria-label={标题} 文本域
# 名片预览副行（招聘名片.tsx:199）把职务与公司拼成可见文本，所以这两个值页面上也看得到，
# 逐字核 value 是为了防「基线职务是临时值的后缀」这类子串误判。
#
# 标识符一律 ASCII：macOS /bin/bash 是 3.2，不认非 ASCII 变量名。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../公共步骤.sh
. "$ROOT_DIR/公共步骤.sh"

export AGENT_BROWSER_SESSION="${AGENT_BROWSER_SESSION:-$RECRUITER_SESSION}"
JOURNEY='recruiter-load'
MILESTONE='登录'

BASE_RECRUITER_NAME='浏览器验收招聘官'
BASE_RECRUITER_TITLE='招聘负责人'
BASE_BRAND='浏览器验收科技'
BASE_COMPANY_INTRO='浏览器验收科技 · 真实后端企业介绍基线'
BASE_ACTIVE_JOB='浏览器验收岗位 · 在招基线'
BASE_ARCHIVED_JOB='浏览器验收岗位 · 归档基线'
CANDIDATE_PRIVATE_MARKER='浏览器验收候选人 · 真实后端基准摘要'

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

login_recruiter

# ── 1. 招聘名片 ─────────────────────────────────────────────────────
# 走「我 › 设置 › 招聘名片」（企业设置.tsx:38-40）而不是「我」页的头像行：
# 头像行的可访问名称是公司名 + 两枚服务端状态胶囊拼出来的（企业我的.tsx:154-172），
# 随任职状态变；设置里这一行的名称是固定的产品文案。
MILESTONE='招聘名片'
click_button_exact '我'
click_after_hydrate '设置'
click_after_hydrate '招聘名片' prefix
assert_text "$BASE_RECRUITER_NAME"
assert_text "$BASE_RECRUITER_TITLE"
assert_text "$BASE_BRAND"
reload_and_assert "$BASE_RECRUITER_NAME"
assert_value '职务' "$BASE_RECRUITER_TITLE"
assert_no_mock_data
capture_scene 'recruiter-card-loaded'

# ── 2. 公司主页资料 · 公司介绍 ──────────────────────────────────────
# 清单页右侧只给 12 字截断摘要（数据/公司主页资料.ts:190 截断），看不到完整基线；
# 进「公司介绍」分区页才是那段基线的权威落点，而且它自带一个硬门：
# 企业档案快照没水合时这一屏根本不渲染文本域（公司档案分区编辑.tsx:244-254）。
MILESTONE='公司资料'
click_back
click_back
click_after_hydrate '公司资料'
assert_text '编辑品牌信息'
click_button '公司介绍'
assert_value '公司介绍' "$BASE_COMPANY_INTRO"
ab reload >/dev/null
assert_value '公司介绍' "$BASE_COMPANY_INTRO"
assert_no_mock_data
capture_scene 'recruiter-company-loaded'

# ── 3. 岗位管理：两个基线岗位各在各的组 ─────────────────────────────
MILESTONE='岗位管理'
click_back
click_back
click_after_hydrate '岗位管理'
assert_job_row "$BASE_ACTIVE_JOB" '在招'
assert_job_row "$BASE_ARCHIVED_JOB" '已归档'
ab reload >/dev/null
assert_job_row "$BASE_ACTIVE_JOB" '在招'
assert_job_row "$BASE_ARCHIVED_JOB" '已归档'
assert_no_mock_data

# 双盲边界：招聘端任何一屏都不该出现候选人的私有摘要
MILESTONE='角色隔离'
assert_absent "$CANDIDATE_PRIVATE_MARKER"

MILESTONE='完成'
write_journey_result "$JOURNEY" pass "$MILESTONE"
