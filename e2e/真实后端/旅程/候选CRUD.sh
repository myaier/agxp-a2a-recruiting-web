#!/usr/bin/env bash
# 旅程 B：候选 CRUD（candidate-crud）。
#
# 每个业务块只断言「做完之后」和「硬刷新之后」的业务结果，不断言中间 HTTP 序列。
# 临时对象一律用固定保留名称，做完就自己删掉；私密清理台账只记里程碑和这些固定名称。
#
# 简历更新门用「我的简历」已有的姓名行内编辑（src/屏幕/我的简历.tsx:280 可改条目，
# 标签「姓名（递交简历后披露）」，blur/Enter 走 操作.保存简历）——
# 个人优势/摘要在这一屏是只读展示，不为测试新增产品入口。
#
# 临时意向的薪资取 35-45K → 35-50K，刻意避开基准意向的 30-45K：
# 求职意向列表行只显示「[城市] 职位」+ 薪资（src/数据/后端映射.ts:193 从BFF意向），
# 而临时意向按后端签名必须复用基准的同一个职位/城市目录项，所以薪资是唯一能把两行分开的
# 可见字段。用基准同款 30-45K 会让两行完全同名，按名称点行就可能点到基准那条并把它改掉/删掉。
#
# 标识符一律 ASCII：macOS /bin/bash 是 3.2，不认非 ASCII 变量名。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../公共步骤.sh
. "$ROOT_DIR/公共步骤.sh"

export AGENT_BROWSER_SESSION="${AGENT_BROWSER_SESSION:-$CANDIDATE_SESSION}"
JOURNEY='candidate-crud'
MILESTONE='登录'

BASE_NAME='浏览器验收候选人'
TEMP_NAME='浏览器验收候选人 · 临时CRUD'
TEMP_FILE_NAME='浏览器验收临时简历.pdf'
CATALOG_JOB='前端开发工程师'
CATALOG_CITY='上海市'
BASE_SALARY='30-45K'
TEMP_SALARY_1='35-45K'
TEMP_SALARY_2='35-50K'

on_exit(){
  local rc=$?
  trap - EXIT
  if [ "$rc" -ne 0 ] && [ "$FRAGMENT_WRITTEN" = '0' ]; then
    capture_failure_snapshot "$JOURNEY"
    write_journey_result "$JOURNEY" failed "$MILESTONE" "旅程在里程碑「${MILESTONE}」失败" || true
  fi
  exit "$rc"
}
trap on_exit EXIT

# 薪资双滚轮：档位表是 3–100 千元、步长 1（src/组件/薪资区间层.tsx:15 档位表），
# 所以第 n 项（0 基）就是 n+3 千元。列用产品自己的 aria-label（薪资下限 / 薪资上限）限定，
# 档位用这条恒等式定位；滚轮停下 90ms 才落值，所以要等它真的停在这一档再往下走。
pick_salary_notch(){
  local column="$1" thousands="$2" tries=0 current
  ab find nth "$(( thousands - 3 ))" "[aria-label=\"$column\"] [role=\"option\"]" click >/dev/null
  while [ "$tries" -lt 25 ]; do
    current="$(ab get text "[aria-label=\"$column\"] [role=\"option\"][aria-selected=\"true\"]" 2>/dev/null || printf '')"
    if [ "$current" = "$thousands" ]; then return 0; fi
    tries=$((tries + 1))
    sleep 0.2
  done
  echo "薪资滚轮「${column}」没有停在 $thousands" >&2
  return 1
}

set_salary_range(){
  click_button '薪资要求'
  pick_salary_notch '薪资下限' "$1"
  pick_salary_notch '薪资上限' "$2"
  click_button_exact '确定'
}

login_candidate

# ── 1. 简历：姓名行内编辑 ────────────────────────────────────────────
MILESTONE='简历改名'
click_button_exact '我'
click_button_exact '我的简历'
assert_text "$BASE_NAME"
click_button '姓名（递交简历后披露）'
ab find label '姓名（递交简历后披露）' fill "$TEMP_NAME" >/dev/null
ab press Enter >/dev/null
assert_text "$TEMP_NAME"
reload_and_assert "$TEMP_NAME"

# ── 2. 求职意向：新建 → 编辑 → 删除 ─────────────────────────────────
MILESTONE='新建意向'
click_back
click_button_exact '求职意向'
assert_text '1/5'
click_button '添加求职意向'
assert_text '添加求职期望'
# 求职类型默认就是「全职」（src/状态/领域/候选资料.ts:95 空意向草稿），对应 social_full_time
click_button '混合'
click_button '工作城市'
ab find placeholder '搜索城市 / 省份' fill "$CATALOG_CITY" >/dev/null
click_button_exact "$CATALOG_CITY"
click_button_exact '保存'
click_button '期望职位'
ab find placeholder '搜索职位' fill "$CATALOG_JOB" >/dev/null
click_button_exact "$CATALOG_JOB"
click_button_exact '保存'
set_salary_range 35 45
click_button_exact '保存'
assert_text '2/5'
assert_text "$TEMP_SALARY_1"
reload_and_assert "$TEMP_SALARY_1"
assert_text '2/5'
# 浏览器已经把这条临时意向建出来了，先记台账再往下做，中途崩掉也能被精确回收
record_cleanup_marker candidate_intention_created true

MILESTONE='编辑意向'
click_button "$TEMP_SALARY_1"
assert_text '编辑求职期望'
set_salary_range 35 50
click_button_exact '保存'
assert_text "$TEMP_SALARY_2"
reload_and_assert "$TEMP_SALARY_2"
assert_absent "$TEMP_SALARY_1"
assert_text '2/5'
# 基准那条一直没被动过
assert_text "$BASE_SALARY"

MILESTONE='删除意向'
click_button "$TEMP_SALARY_2"
assert_text '编辑求职期望'
click_button_exact '删除'
assert_text '1/5'
reload_and_assert '1/5'
assert_absent "$TEMP_SALARY_2"
assert_text "$BASE_SALARY"

# ── 3. 披露偏好：改一档再改回来 ─────────────────────────────────────
MILESTONE='披露偏好改档'
click_back
click_button_exact '披露偏好'
assert_pressed '当前公司：不披露'
click_button_exact '当前公司：意向确认后'
assert_pressed '当前公司：意向确认后'
ab reload >/dev/null
assert_text '当前公司'
assert_pressed '当前公司：意向确认后'

MILESTONE='披露偏好还原'
click_button_exact '当前公司：不披露'
assert_pressed '当前公司：不披露'
ab reload >/dev/null
assert_text '当前公司'
assert_pressed '当前公司：不披露'

# ── 4. 附件简历：上传固定保留名称的临时 PDF ─────────────────────────
MILESTONE='上传附件'
TEMP_PDF_DIR="$(dirname "$PRIVATE_LEDGER")"
cp "$ROOT_DIR/资源/简历-v1.pdf" "$TEMP_PDF_DIR/$TEMP_FILE_NAME"
click_back
click_button_exact '我的简历'
assert_text "$TEMP_NAME"
click_button_exact '添加附件简历'
# 隐藏的 file input 没有可访问名称，只能按元素类型选；这不是 CSS module 类名也不是层级路径。
ab upload 'input[type="file"]' "$TEMP_PDF_DIR/$TEMP_FILE_NAME" >/dev/null
assert_text '允许 AI 识别这份简历？'
click_button_exact '同意并继续'
assert_text "$TEMP_FILE_NAME"
# 附件行已经在权威列表里了，把固定名称记进台账（不记任何 ID）
record_cleanup_marker candidate_resume_file_names "$TEMP_FILE_NAME"
reload_and_assert "$TEMP_FILE_NAME"
assert_text "$TEMP_NAME"

# 临时姓名与临时附件行同时在屏上，先拍基线，再往下还原
capture_scene 'candidate-resume-updated'

# ── 5. 附件替换 / 删除 ──────────────────────────────────────────────
# NEEDS_CONTEXT（Task 5 实现者留给控制方裁决，本轮未实现）：
# 计划要求「先按语义定位附件行，再只用 agent-browser drag 左滑」露出 替换 / 删除。
# 在 agent-browser 0.27.2 + 本产品上实测不可行，两条原因各自独立：
#   1. drag 在 pointerup 之后还会补一个 click。滑动行（src/组件/滑动行.tsx）在 松手 里
#      请求打开(true) 打开行，紧接着行面的 onClick 看到 打开=true 又请求打开(false)，
#      行开了立刻关。实测：drag 之后 aria-expanded 仍是 false，且 document 上确实收到
#      一个落在行内的 click。
#   2. 就算 1 修好，drag 的两个端点必须都落在行面里（mouse 的 pointer 事件不做隐式捕获），
#      而行内可用的稳定语义句柄只有 [data-testid="附件简历行"] 和行面自己，两者同心，
#      水平位移恒为 0；其余靠左的元素只有 CSS module 类名可选，是明令禁止的定位方式。
# 可选出路（都要控制方拍板）：(a) 修 滑动行 的滑后 click 抑制，并给行左端一个语义句柄；
# (b) 允许用 ab eval 派发一次真实 PointerEvent 手势（实测可行）；(c) 让行内操作键在行展开后
# 可直接按可访问名称点击。在此之前临时附件由后端 cleanup 按台账里的固定名称精确回收。

# ── 6. 还原基准姓名 ─────────────────────────────────────────────────
MILESTONE='还原姓名'
click_button "$TEMP_NAME"
ab find label '姓名（递交简历后披露）' fill "$BASE_NAME" >/dev/null
ab press Enter >/dev/null
assert_text "$BASE_NAME"
reload_and_assert "$BASE_NAME"
assert_absent "$TEMP_NAME"
assert_no_mock_data

MILESTONE='完成'
write_journey_result "$JOURNEY" pass "$MILESTONE"
