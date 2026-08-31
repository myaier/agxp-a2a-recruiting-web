#!/usr/bin/env bash
# 旅程 D：招聘 CRUD（recruiter-crud）。
#
# 每个业务块只断言「做完之后」和「硬刷新之后」的业务结果，不断言中间 HTTP 序列。
# 临时对象只有一个，用固定保留名称 浏览器验收岗位 · 临时CRUD ——
# 后端 cleanup 的差集是按这个标题逐字比的，多一个空格都会让它拒绝回收，所以这一串绝不能漂。
#
# 名片改的是**职务**（title），不是公开名：公开名在有实名时是只读的
# （招聘名片.tsx:205 可编辑公开名），职务任何时候都可写，是这一屏唯一稳定的可改字段。
# 临时职务 浏览器验收招聘负责人 把基线 招聘负责人 整个包在里面，页面文本断言分不开这两个值，
# 所以「改回来了没有」一律用 assert_value 逐字核输入框的值。
#
# 岗位三个字段在后端建后不可改（title / recruitment_type / category_id / location_id），
# 所以编辑块只动职位描述与加分偏好 —— 这两项正是现有编辑页真会提交的可变字段。
#
# 目录三级按提交进 Catalog 的那份产品数据点（apps/recruitment/internal/catalog/data 的
# job_categories 由本仓库 src/数据/职业分类.ts 生成）：互联网/AI › 前端/移动开发 › 前端开发工程师。
#
# 标识符一律 ASCII：macOS /bin/bash 是 3.2，不认非 ASCII 变量名。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../公共步骤.sh
. "$ROOT_DIR/公共步骤.sh"

export AGENT_BROWSER_SESSION="${AGENT_BROWSER_SESSION:-$RECRUITER_SESSION}"
JOURNEY='recruiter-crud'
MILESTONE='登录'

BASE_RECRUITER_NAME='浏览器验收招聘官'
BASE_RECRUITER_TITLE='招聘负责人'
TEMP_RECRUITER_TITLE='浏览器验收招聘负责人'
BASE_COMPANY_INTRO='浏览器验收科技 · 真实后端企业介绍基线'
TEMP_COMPANY_INTRO='浏览器验收科技 · 临时CRUD介绍'
BASE_ACTIVE_JOB='浏览器验收岗位 · 在招基线'
BASE_ARCHIVED_JOB='浏览器验收岗位 · 归档基线'
TEMP_JOB='浏览器验收岗位 · 临时CRUD'
CATALOG_ROOT='互联网/AI'
CATALOG_GROUP='前端/移动开发'
CATALOG_LEAF='前端开发工程师'
CATALOG_CITY='上海市'
JOB_OFFICE='上海市浦东新区浏览器路 1 号'
JOB_DESC='浏览器验收岗位 · 临时CRUD 的职位描述基线'
JOB_DESC_2='浏览器验收岗位 · 临时CRUD 的职位描述改后'
JOB_SCREEN='浏览器验收临时CRUD的加分偏好'

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

# ── 1. 招聘名片：职务改一次再改回来 ─────────────────────────────────
# 保存成功只弹一条轻提示、不换屏也不改列表，没有业务信号可等（招聘名片.tsx:114），
# 所以保存与硬刷新之间用 settle 等这一屏网络安静，免得刷新把还在飞的写请求打断。
MILESTONE='名片改职务'
click_after_hydrate '我'
click_after_hydrate '设置'
click_after_hydrate '招聘名片' prefix
assert_text "$BASE_RECRUITER_NAME"
assert_value '职务' "$BASE_RECRUITER_TITLE"
find_retry label 职务 fill "$TEMP_RECRUITER_TITLE" >/dev/null
click_button_exact '保存'
settle
reload_and_assert "$TEMP_RECRUITER_TITLE"
assert_value '职务' "$TEMP_RECRUITER_TITLE"

MILESTONE='名片还原职务'
find_retry label 职务 fill "$BASE_RECRUITER_TITLE" >/dev/null
click_button_exact '保存'
settle
reload_and_assert "$BASE_RECRUITER_NAME"
assert_value '职务' "$BASE_RECRUITER_TITLE"

# ── 2. 公司介绍：改一次再改回来 ─────────────────────────────────────
MILESTONE='公司介绍改文'
# 连环返回的落点在真实栈上不可控（AX 常落后一屏）：回站点根重新走一遍语义路径
root_back(){
  ab open "$FRONTEND_ORIGIN/" >/dev/null
  ab reload >/dev/null
  ab wait --fn "location.hash === '#/hr'" >/dev/null 2>&1 || true
}
_stamp(){ printf '[改文·%s] %s\n' "$(date +%T)" "$1" >&2; }
_stamp root_back前
root_back
_stamp root_back后
click_after_hydrate '我'
_stamp 我后
click_until_screen '公司资料' '编辑品牌信息'
_stamp 公司资料后
enter_company_intro
_stamp 分区后
find_retry label 公司介绍 fill "$TEMP_COMPANY_INTRO" >/dev/null
_stamp fill后
click_button_exact '保存'
settle
_stamp 保存后
ab reload >/dev/null
_stamp reload后
enter_company_intro
_stamp 二次分区后
assert_value '公司介绍' "$TEMP_COMPANY_INTRO" || { click_row_geometry '公司介绍'; assert_value '公司介绍' "$TEMP_COMPANY_INTRO"; }
_stamp 断言后

MILESTONE='公司介绍还原'
find_retry label 公司介绍 fill "$BASE_COMPANY_INTRO" >/dev/null
click_button_exact '保存'
settle
ab reload >/dev/null
enter_company_intro
assert_value '公司介绍' "$BASE_COMPANY_INTRO" || { click_row_geometry '公司介绍'; assert_value '公司介绍' "$BASE_COMPANY_INTRO"; }

# ── 3. 发布临时岗位：三步向导全部走语义控件 ─────────────────────────
MILESTONE='发布岗位'
_stamp 发布岗位root前
root_back
_stamp 发布岗位root后
click_after_hydrate '我'
_stamp 发布岗位我后
click_until_screen '岗位管理' '已归档' prefix
_stamp 发布岗位岗位管理后
click_until_screen '发布新岗位' '岗位基础信息' prefix
_stamp 发布新岗位后
assert_text '岗位基础信息'
_stamp 向导屏后
click_button '职位类别'
# 目录树从后端 catalog 异步拉，等根节点出现再逐级点
wait_text "$CATALOG_ROOT"
click_button_exact "$CATALOG_ROOT"
click_button_exact "$CATALOG_GROUP"
click_button_exact "$CATALOG_LEAF"
# 选完叶子产品会拿叶子名预填岗位名称（发布岗位.tsx:601-604），所以名称必须在选类别之后再写
find_retry placeholder '必填，如：资深后端工程师 · 交易网关' fill "$TEMP_JOB" >/dev/null
click_button_exact '混合'
click_button_exact '下一步'
assert_text '职位描述'
find_retry label 职位描述 fill "$JOB_DESC" >/dev/null
click_button_exact '下一步'
assert_text '职位要求'
find_retry label 薪资下限 fill '30' >/dev/null
find_retry label 薪资上限 fill '45' >/dev/null
# 社招全职必须确认年薪月数（发布岗位.tsx:251）；滚轮初值就是 12 薪，直接点完成收下这一档
click_button '年薪月数'
click_button_exact '完成'
find_retry placeholder '搜索城市名，从下方候选选择' fill "$CATALOG_CITY" >/dev/null
wait_text "$CATALOG_CITY"
click_button_exact "$CATALOG_CITY"
find_retry placeholder '如：浦东新区世纪大道 1568 号中建大厦 28 层' fill "$JOB_OFFICE" >/dev/null
click_button_exact '发布岗位并开始寻访'
# 发布成功之后产品自己把我们送回企业主壳（发布岗位.tsx:357 进企业主壳）——
# 底部导航的「我」出现就是服务端已经收下这个岗位的信号
click_after_hydrate '我'
# 浏览器已经把这个固定保留名称建出来了，先记台账再往下做，中途崩掉也能被精确回收
record_cleanup_marker recruiter_job_titles "$TEMP_JOB"
click_after_hydrate '岗位管理'
assert_job_row "$TEMP_JOB" '在招'
assert_no_mock_data
capture_scene 'recruiter-jobs-after-create'
ab reload >/dev/null
assert_job_row "$TEMP_JOB" '在招'

# ── 4. 编辑：只动职位描述与加分偏好 ─────────────────────────────────
MILESTONE='编辑岗位'
左滑行 "$TEMP_JOB"
click_button_exact '编辑'
assert_text '编辑岗位'
click_button_exact '职位描述'
find_retry label 职位描述 fill "$JOB_DESC_2" >/dev/null
click_button_exact '职位要求'
find_retry placeholder '用你自己的话写' fill "$JOB_SCREEN" >/dev/null
click_button_exact '保存'
# 保存成功产品才返回岗位管理（发布岗位.tsx:344-346），行重新出现就是写已经落库
assert_job_row "$TEMP_JOB" '在招'
ab reload >/dev/null
assert_job_row "$TEMP_JOB" '在招'
# 硬刷新之后再进一次编辑页：这时读到的描述来自服务端发回来的那份，不是刚才的本地草稿
左滑行 "$TEMP_JOB"
click_button_exact '编辑'
click_button_exact '职位描述'
assert_value '职位描述' "$JOB_DESC_2"
click_back

# ── 5. 停止招聘 → 重新开放 ──────────────────────────────────────────
# 临时岗位没有在谈候选，停止招聘不弹二次确认（岗位管理.tsx:76），直接落库
MILESTONE='停止招聘'
左滑行 "$TEMP_JOB"
click_button_exact '停止招聘'
assert_job_row "$TEMP_JOB" '已归档'
ab reload >/dev/null
assert_job_row "$TEMP_JOB" '已归档'

MILESTONE='重新开放'
左滑行 "$TEMP_JOB"
click_button_exact '重新开放'
assert_job_row "$TEMP_JOB" '在招'
ab reload >/dev/null
assert_job_row "$TEMP_JOB" '在招'

# ── 6. 删除：走二次确认，两组都不再有它 ─────────────────────────────
MILESTONE='删除岗位'
左滑行 "$TEMP_JOB"
click_button_exact '删除'
# 行内那个同名的「删除」此刻已经不在可访问树里，所以下面这一下只可能点到确认键 ——
# 靠的是 滑动行 的 aria-hidden（组件/滑动行.tsx:93 操作区 aria-hidden={!打开}）：
# 操作按钮的 onClick 先 请求打开(false) 再 项.按下()，两个 setState 同一帧提交，
# 行收起（操作区被整块 aria-hidden 剪掉）与确认层弹出是同时发生的。
# 注意**不是**靠 aria-modal：弹层框架用的是 <dialog open>（组件/弹层框架.tsx:62-64），
# 那是非模态的，页面其余部分既不 inert 也不会被剪枝，aria-modal 在这里挡不住任何东西。
assert_text "删除「${TEMP_JOB}」？"
click_button_exact '删除'
# 删除落库成功产品才把行摘掉，等这一行真的消失＝服务端已经收下
wait_row_gone "$TEMP_JOB"

# 缺席断言只读一次 body，不自带等待。硬刷新之后 BFF 还没把岗位列表送回来的那一小段里，
# 「临时岗位不在页面上」对一张根本还没加载完的白页同样成立 —— 那是一条**永远不会**
# 为了正确的理由失败的断言。所以每次硬刷新之后都先用基线岗位把水合等出来，
# 再问「临时岗位还在不在」；assert_no_mock_data 同样是读一次 body，一并放在门后面。
ab reload >/dev/null
assert_job_row "$BASE_ACTIVE_JOB" '在招'
assert_job_row "$BASE_ARCHIVED_JOB" '已归档'
assert_absent "$TEMP_JOB"
ab reload >/dev/null
assert_job_row "$BASE_ACTIVE_JOB" '在招'
assert_absent "$TEMP_JOB"
assert_no_mock_data

MILESTONE='完成'
write_journey_result "$JOURNEY" pass "$MILESTONE"
