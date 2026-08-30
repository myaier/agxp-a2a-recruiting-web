# shellcheck shell=bash
# 真实后端整栈验收 · agent-browser 公共步骤库。
#
# 被 e2e/真实后端/旅程/*.sh 用 `.` 引入，不单独执行。
# 变量名一律 ASCII：macOS 的 /bin/bash 是 3.2，**变量名**只认 [A-Za-z_][A-Za-z0-9_]*
# （`测试=1` 在 3.2 下直接 command not found；变量后面紧跟中文还会把中文吃进变量名，
# 所以紧跟非 ASCII 字符的变量一律写成 `${var}`）。函数名 3.2 允许非 ASCII，
# 只有 左滑行 用了中文名（计划里就叫这个），其余保持 ASCII。
#
# 三条硬规矩，改这个文件前先读：
#   1. 每条 agent-browser 命令都显式带 --session，两个角色的浏览器状态永远不共用。
#      禁止 network route / network har / state save / --profile / --session-name / --state，
#      禁止导出 Cookie —— 这一轮验收要证明的就是「真后端真会话」，任何桩都会把结论作废。
#   2. 定位只用 role / label / 可见业务词。长期脚本里不出现 @eN 引用、CSS module 类名、
#      DOM 层级路径和坐标点击；snapshot -i 只在失败诊断路径上用一次。
#   3. 证据只留 METHOD + pathname、控制台/页面错误首行和截图路径。
#      OTP、手机号、Cookie、请求正文一律不进台账、不进分片、不进 stdout。

FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:5173}"

# 两个隔离会话名与两个专用账号手机号（后端 fixture 收敛的就是这两个账号）
CANDIDATE_SESSION='backend-local-candidate'
RECRUITER_SESSION='backend-local-recruiter'
CANDIDATE_PHONE='13800000001'
RECRUITER_PHONE='13800000002'

# 七个冻结视觉场景。顺序与内容必须与 e2e/真实后端/视觉/场景清单.ts 的 真实后端场景们 一致，
# 公共步骤.test.sh 会逐字核对这两处，漂移即测试失败。
SCENE_IDS='candidate-resume-loaded candidate-intentions-loaded candidate-disclosure-loaded candidate-resume-updated recruiter-card-loaded recruiter-company-loaded recruiter-jobs-after-create'

# Mock 专属数据标记：只存在于本地演示数据，真实后端永远不会返回。
# 任何一条出现在页面上都说明这一屏根本没接线，旅程直接判失败。
#   沈亦舟   —— src/状态/初始状态.ts:124（Mock 候选真名）
#   邵铭     —— src/状态/初始状态.ts:132（Mock 招聘方姓名）
#   云衢科技 —— src/状态/初始状态.ts:132（Mock 招聘方公司）
MOCK_ONLY_MARKERS='沈亦舟 邵铭 云衢科技'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# 本轮已经拍下的场景（仓库相对路径），由 capture_scene 追加、write_journey_result 写进分片
CAPTURED_SCREENSHOTS=''
# 分片只写一次：写完之后旅程脚本的失败收尾不再覆盖它
FRAGMENT_WRITTEN=0

# ── agent-browser 包装 ───────────────────────────────────────────────

ab(){ agent-browser --session "$AGENT_BROWSER_SESSION" "$@"; }

wait_text(){ ab wait --text "$1" >/dev/null; }

assert_text(){ wait_text "$1"; }

assert_absent(){
  local body
  body="$(ab get text body)" || return 1
  case "$body" in *"$1"*) unset body; return 1 ;; esac
  unset body
}

reload_and_assert(){ ab reload >/dev/null; wait_text "$1"; }

# 选中态只读产品自己的 aria-pressed，选择器用产品的可访问名称 —— 不是 CSS module 类名，
# 也不是 DOM 层级。要求严格等于字符串 true：属性缺失、false、空串都算没选中。
assert_pressed(){
  local name="$1" value
  value="$(ab get attr "[aria-label=\"$name\"]" aria-pressed)" || return 1
  [ "$value" = 'true' ]
}

# 按钮一律按可访问名称点。产品里有一类按钮的名称带 CSS ::before 画出来的选中勾
# （如「✓ 全职」），所以默认用子串匹配；名称唯一且要防误配时用 click_button_exact。
click_button(){ ab find role button click --name "$1" >/dev/null; }
click_button_exact(){ ab find role button click --name "$1" --exact >/dev/null; }

# 返回栏的 ‹ 键（src/组件/通用.tsx 返回栏，可访问名称「返回」）
click_back(){ click_button_exact '返回'; }

# 左滑露出行内操作（滑动行：附件简历行、岗位行）。
#
# 滑动是空间手势，没有任何语义写法能表达「往左滑」。所以这里把两件事分开：
#   · 定位仍然是语义的 —— 按产品给行面的可访问名称找（src/组件/滑动行.tsx 的 名称 → aria-label）。
#     用前缀匹配 `^=` 而不是全等：行的完整可访问名称是「业务名 + 当前状态」，状态那一段
#     （附件解析进度、岗位在招/已归档）是异步的、旅程无法预知；设计稿也明说定位
#     「允许关键词或正则，不绑定整段产品文案」。前缀这一段仍然是那一行唯一的业务身份。
#   · 几何全部从这个元素自己的矩形算出来，没有任何写死的像素常数；
#   · 事件走 Chrome 的真实输入派发（mouse move/down/move/up），不用 eval 造 DOM 事件 ——
#     合成事件绕开的正是这轮验收唯一要证明的东西。
# 结束后读产品自己的 aria-expanded 自检，滑不开就立刻失败而不是让后面的断言瞎猜。
左滑行(){
  local name="$1" sel box x_from x_to y step k
  sel="[aria-label^=\"$name\"]"
  box="$(ab get box "$sel" --json)" || return 1
  x_from="$(printf '%s' "$box" | jq -r '.data | (.x + .width * 0.9 | floor)')" || return 1
  x_to="$(printf '%s' "$box" | jq -r '.data | (.x + .width * 0.1 | floor)')" || return 1
  y="$(printf '%s' "$box" | jq -r '.data | (.y + .height * 0.5 | floor)')" || return 1
  case "$x_from$x_to$y" in *null*|'') echo "读不到行「${name}」的矩形" >&2; return 1 ;; esac

  ab mouse move "$x_from" "$y" >/dev/null
  ab mouse down >/dev/null
  # 分四步走完，保证滑动行先收到位移判定为「横向」再收到落点
  k=1
  while [ "$k" -le 4 ]; do
    step=$(( x_from + (x_to - x_from) * k / 4 ))
    ab mouse move "$step" "$y" >/dev/null
    k=$((k + 1))
  done
  ab mouse up >/dev/null

  if [ "$(ab get attr "$sel" aria-expanded)" != 'true' ]; then
    echo "行「${name}」左滑之后没有展开" >&2
    return 1
  fi
}

# 页面上不允许出现 Mock 专属数据
assert_no_mock_data(){
  local body marker
  body="$(ab get text body)" || return 1
  for marker in $MOCK_ONLY_MARKERS; do
    case "$body" in
      *"$marker"*) echo "页面出现 Mock 专属数据标记：$marker" >&2; unset body; return 1 ;;
    esac
  done
  unset body
}

# ── 登录 ────────────────────────────────────────────────────────────

login_candidate(){ _login "$CANDIDATE_SESSION" "$CANDIDATE_PHONE" '我要找工作' '#/app'; }
login_recruiter(){ _login "$RECRUITER_SESSION" "$RECRUITER_PHONE" '我要招人' '#/hr'; }

# 本地 dev 栈把当轮短信验证码写在这个文件里，只在本机可读。
_otp_file(){ printf '%s' "${AGXP_MONOREPO_DIR:-}/apps/recruitment/.local-dev/code"; }

_otp_mtime(){
  local file
  file="$(_otp_file)"
  if [ ! -f "$file" ]; then printf '0'; return 0; fi
  stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null || printf '0'
}

# 只接受「点过获取验证码之后才写下」的那一份，避免把上一轮的旧码填进去。
_read_fresh_otp(){
  local before="$1" file now value tries=0
  file="$(_otp_file)"
  while [ "$tries" -lt 60 ]; do
    now="$(_otp_mtime)"
    if [ -f "$file" ] && [ "$now" -gt "$before" ]; then
      value="$(tr -d ' \t\r\n' <"$file")"
      if [ -n "$value" ]; then printf '%s' "$value"; return 0; fi
    fi
    tries=$((tries + 1))
    sleep 0.5
  done
  echo '本地 OTP 文件在超时内没有刷新，登录中止' >&2
  return 1
}

# 敏感值只经过这一个出口。
#
# xtrace 必须由调用方在**进入这个函数之前**就关掉，在函数体里关已经晚了一整帧：
# bash 先把调用行连同展开后的实参打出来（`+ _fill_secret 短信验证码 824913`），
# 才开始执行函数体；而 `local value="$2"` 还会把值再打一次
# （`+ local label=… value=824913 …`）。所以这里既不收 local 也不自己关 xtrace，
# 直接用 $2 传进去 —— 抑制的责任完全落在 _login 那一段。
_fill_secret(){
  ab find label "$1" fill "$2" >/dev/null
}

# $1 会话名 $2 手机号 $3 身份大卡名 $4 该角色主壳的 hash
_login(){
  local want_session="$1" phone="$2" identity="$3" shell_hash="$4" before code otp_xtrace otp_rc
  if [ "${AGENT_BROWSER_SESSION:-}" != "$want_session" ]; then
    echo "会话隔离：本旅程只允许 ${want_session}，当前是 ${AGENT_BROWSER_SESSION:-未设置}" >&2
    return 1
  fi

  ab open "$FRONTEND_ORIGIN/" >/dev/null
  ab reload >/dev/null
  # 初始化跑完之后只有两种落点：会话还在 → 直接进主壳；没有会话 → 停在登录页。
  # 第二条旅程复用同一个浏览器会话，所以已登录时这里就返回，不重登。
  ab wait --fn "location.hash === '$shell_hash' || document.body.innerText.includes('获取验证码')" >/dev/null
  case "$(ab get url)" in *"$shell_hash") return 0 ;; esac

  ab find label 手机号 fill "$phone" >/dev/null
  before="$(_otp_mtime)"
  ab find role button click --name 获取验证码 >/dev/null

  # ── OTP 段：从读码到清掉，全程关 xtrace ──
  # 必须在 code=$(...) **之前**关。开着 set -x 时，这一段会连泄五处：
  # _read_fresh_otp 里的 `value=<码>` 与 `printf %s <码>`（命令替换是子 shell，同样被 trace）、
  # 赋值行 `code=<码>`、调用行 `_fill_secret 短信验证码 <码>`、以及被调函数里的 `local value=<码>`。
  # 在被调函数体里关掉一个都拦不住，所以抑制只能落在这里。
  otp_xtrace=0
  case "$-" in *x*) otp_xtrace=1; set +x ;; esac
  otp_rc=0
  code="$(_read_fresh_otp "$before")" || otp_rc=1
  if [ "$otp_rc" = '0' ]; then _fill_secret 短信验证码 "$code" || otp_rc=1; fi
  code=''
  unset code
  if [ "$otp_xtrace" = '1' ]; then set -x; fi
  [ "$otp_rc" = '0' ] || return 1

  click_button '已阅读并同意'
  click_button_exact '进入'
  wait_text "$identity"
  click_button_exact "$identity"

  # 选身份落的是注册引导入口（src/流程/onboarding配置.ts 身份首次入口），
  # 而专用账号早就建过档。回站点根地址硬刷新，让真实会话恢复把我们送进对应主壳 ——
  # 这一步本身就是「硬刷新后会话仍在」的第一份证据。
  ab open "$FRONTEND_ORIGIN/" >/dev/null
  ab reload >/dev/null
  ab wait --fn "location.hash === '$shell_hash'" >/dev/null
}

# ── 稳定截图 ────────────────────────────────────────────────────────

capture_scene(){
  local scene="$1" role dir rel
  case " $SCENE_IDS " in
    *" $scene "*) : ;;
    *) echo "未知视觉场景：$scene" >&2; return 1 ;;
  esac
  case "$scene" in
    candidate-*) role='candidate' ;;
    recruiter-*) role='recruiter' ;;
    *) echo "场景 $scene 没有归属角色" >&2; return 1 ;;
  esac
  dir="$RUN_DIR/visual/$role"
  mkdir -p "$dir"

  ab set viewport 390 844 >/dev/null
  ab set media light reduced-motion >/dev/null
  # 字体就位 + 连续两帧 + 关掉动画/过渡/光标 + 滚到顶：七张基线的像素稳定性全靠这一段。
  # agent-browser 0.27.2 的 eval 不接受顶层 await，脚本必须自己包一层 async。
  ab eval --stdin >/dev/null <<'JS'
(async () => {
  await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const style = document.createElement('style');
  style.dataset.agentBrowserStable = 'true';
  style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(style);
  window.scrollTo(0, 0);
  return true;
})()
JS
  ab screenshot "$dir/$scene.png" >/dev/null

  rel="$(_repo_relative_path "$dir/$scene.png")" || return 1
  CAPTURED_SCREENSHOTS="$CAPTURED_SCREENSHOTS $rel"
}

# 分片里的 screenshots 记的是**仓库相对** artifact 路径（e2e/真实后端/类型.ts:39 旅程结果）。
# 落在仓库外就没有仓库相对写法可言，这时必须硬失败：静默回落成绝对路径会写出一份
# 不符合自己声明的分片，报告和视觉审阅都拿它没办法，而且路径里还可能夹带用户名。
# 运行器负责把 RUN_DIR 放在前端仓库里（Task 7 preflight 的「安全输出路径」那一条）。
_repo_relative_path(){
  case "$1" in
    "$REPO_ROOT"/*) printf '%s' "${1#"$REPO_ROOT"/}" ;;
    *)
      echo "artifact 路径不在前端仓库内，写不出 类型.ts 要求的仓库相对路径：$1" >&2
      return 1
      ;;
  esac
}

# 失败诊断：唯一允许出现 snapshot -i 的地方。先落到被 gitignore 的产物目录，
# 再逐条扫敏感字面量；命中就整份删掉，宁可没有诊断也不留证据泄漏。
capture_failure_snapshot(){
  local journey="$1" dir file
  dir="$RUN_DIR/diagnostics"
  mkdir -p "$dir"
  file="$dir/$journey-snapshot.txt"
  ab snapshot -i >"$file" 2>/dev/null || true
  [ -s "$file" ] || { rm -f "$file"; return 0; }
  if grep -Eq '__Host-agxp_recruitment_session|Authorization:|Bearer |"proof":\{"code|Cookie:|Set-Cookie:' "$file"; then
    rm -f "$file"
    echo '失败快照命中敏感字面量，已删除，不留存' >&2
  fi
  return 0
}

# ── 私密清理台账 ────────────────────────────────────────────────────

# 只记录「浏览器已经做完」的里程碑和固定保留名称，永远不写 raw ID。
# 写入用同目录临时文件 + mv 原子替换，保持 0600。
record_cleanup_marker(){
  local key="$1" value="$2" result tmp
  if [ -z "${PRIVATE_LEDGER:-}" ] || [ ! -f "$PRIVATE_LEDGER" ]; then
    echo '私密清理台账不存在，拒绝记录里程碑' >&2
    return 1
  fi
  case "$key" in
    candidate_intention_created)
      if [ "$value" != 'true' ]; then echo "$key 只接受 true" >&2; return 1; fi
      result="$(jq '.candidate_intention_created = true' "$PRIVATE_LEDGER")" || return 1
      ;;
    candidate_resume_file_names|recruiter_job_titles)
      case "$value" in
        浏览器验收*) : ;;
        *) echo '台账只记录固定保留的验收名称' >&2; return 1 ;;
      esac
      result="$(jq --arg k "$key" --arg v "$value" '.[$k] = ((.[$k] // []) + [$v])' "$PRIVATE_LEDGER")" || return 1
      ;;
    *)
      echo "未知清理台账字段：$key" >&2
      return 1
      ;;
  esac
  tmp="$(dirname "$PRIVATE_LEDGER")/.$(basename "$PRIVATE_LEDGER").$$"
  ( umask 077; printf '%s\n' "$result" >"$tmp" ) || return 1
  chmod 600 "$tmp" || return 1
  mv -f "$tmp" "$PRIVATE_LEDGER"
}

# ── 旅程结果分片 ────────────────────────────────────────────────────

# 分片路径合同：<FRAGMENT_DIR>/<旅程ID>.json，字段与 e2e/真实后端/类型.ts 的 旅程结果 一致。
# apiRequests / failedRequests 只留 METHOD + pathname，形状不合规的条目直接丢弃 ——
# 报告读取端（e2e/真实后端/报告.ts 请求形状）见到一条脏数据就把整轮判成 USAGE_ERROR。
_fragment_dir(){ printf '%s' "${FRAGMENT_DIR:-$RUN_DIR/journeys}"; }

_JQ_PATH_HELPERS='def only_path: sub("^[A-Za-z][A-Za-z0-9+.-]*://[^/]*"; "") | sub("[?#].*"; "");
  def well_formed: test("^[A-Z]+ /[A-Za-z0-9._~%/-]*$");'

write_journey_result(){
  local journey="$1" status="$2" milestone="$3" failure="${4:-}"
  local dir raw_requests raw_console raw_errors
  local api failed console_errors page_errors marker body

  dir="$(_fragment_dir)"
  mkdir -p "$dir"

  raw_requests="$(ab network requests --json 2>/dev/null)" || raw_requests=''
  raw_console="$(ab console --json 2>/dev/null)" || raw_console=''
  raw_errors="$(ab errors --json 2>/dev/null)" || raw_errors=''
  [ -n "$raw_requests" ] || raw_requests='{}'
  [ -n "$raw_console" ] || raw_console='{}'
  [ -n "$raw_errors" ] || raw_errors='{}'

  # 只保留 /api/v1 的业务请求；headers / query / body 一个字段都不读。
  api="$(printf '%s' "$raw_requests" | jq -r "$_JQ_PATH_HELPERS"'
    [ .data.requests[]? | ((.method // "") | ascii_upcase) + " " + ((.url // "") | only_path) ]
    | map(select(well_formed)) | map(select(test("^[A-Z]+ /api/v1"))) | unique | .[]' 2>/dev/null)" || api=''
  failed="$(printf '%s' "$raw_requests" | jq -r "$_JQ_PATH_HELPERS"'
    [ .data.requests[]? | select((.status // 0) == 0 or (.status // 0) >= 400)
      | ((.method // "") | ascii_upcase) + " " + ((.url // "") | only_path) ]
    | map(select(well_formed)) | unique | .[]' 2>/dev/null)" || failed=''
  console_errors="$(printf '%s' "$raw_console" | jq -r '
    [ .data.messages[]? | select(.type == "error") | ((.text // "") | split("\n")[0] | .[0:200]) ]
    | map(select(length > 0)) | unique | .[]' 2>/dev/null)" || console_errors=''
  page_errors="$(printf '%s' "$raw_errors" | jq -r '
    [ .data.errors[]? | ((.text // "") | split("\n")[0] | .[0:200]) ]
    | map(select(length > 0)) | unique | .[]' 2>/dev/null)" || page_errors=''

  # 两道功能门：一条 /api/v1 都没看到，或页面上还挂着 Mock 专属数据，都不算通过。
  if [ "$status" = 'pass' ] && [ -z "$api" ]; then
    status='failed'
    failure='本轮旅程没有观测到任何 /api/v1 请求'
  fi
  if [ "$status" = 'pass' ]; then
    body="$(ab get text body 2>/dev/null)" || body=''
    for marker in $MOCK_ONLY_MARKERS; do
      case "$body" in
        *"$marker"*) status='failed'; failure='页面仍在展示 Mock 专属数据'; break ;;
      esac
    done
    unset body
  fi

  jq -n \
    --arg journey "$journey" \
    --arg status "$status" \
    --arg milestone "$milestone" \
    --arg failure "$failure" \
    --arg api "$api" \
    --arg failed "$failed" \
    --arg console "$console_errors" \
    --arg page "$page_errors" \
    --arg shots "$CAPTURED_SCREENSHOTS" \
    'def lines: split("\n") | map(select(length > 0));
     def words: split(" ") | map(select(length > 0));
     {
       schemaVersion: 1,
       journey: $journey,
       status: $status,
       milestone: $milestone,
       apiRequests: ($api | lines),
       consoleErrors: ($console | lines),
       pageErrors: ($page | lines),
       failedRequests: ($failed | lines),
       screenshots: ($shots | words),
       failure: (if $failure == "" then null else $failure end)
     }' >"$dir/$journey.json"

  FRAGMENT_WRITTEN=1
  printf 'JOURNEY %s %s %s\n' "$journey" "$status" "$milestone"
  [ "$status" = 'pass' ]
}
