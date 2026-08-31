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
# 本轮失败属于环境阻塞而不是业务失败（设计稿 §14 INFRA_BLOCKED）。
# 只有明确可归因到环境的那几处才置位 —— 普通断言失败一律仍是 failed，
# 否则「产品坏了」会被一路洗成「环境没准备好」。
JOURNEY_BLOCKED=0
JOURNEY_BLOCKED_REASON=''

# 把当前失败标成环境阻塞。$1 人读原因（进分片的 failure 摘要）。
mark_journey_blocked(){
  JOURNEY_BLOCKED=1
  JOURNEY_BLOCKED_REASON="$1"
}

# 旅程失败收尾的统一收口：按 JOURNEY_BLOCKED 决定写 blocked 还是 failed。
# $1 旅程 ID  $2 里程碑
write_journey_failure(){
  if [ "$JOURNEY_BLOCKED" = '1' ]; then
    write_journey_result "$1" blocked "$2" \
      "旅程在里程碑「${2}」遇到环境阻塞：${JOURNEY_BLOCKED_REASON}"
  else
    write_journey_result "$1" failed "$2" "旅程在里程碑「${2}」失败"
  fi
}

# ── agent-browser 包装 ───────────────────────────────────────────────

ab(){ agent-browser --session "$AGENT_BROWSER_SESSION" "$@"; }

# 文本等待带 3 次有界重试：`wait --text` 的超时写死 25s，而 dev 栈上写请求（保存类
# PATCH 要过 BFF+hub 两跳）实测可以慢过它——#run17 的快照实证断言超时那一刻业务
# 内容明明就绪（编辑弹层开着、35-50K 已写上）。保持 wait --text 的调用形态不变
# （合同测试靠它核对缺席表），只在外面补次数。
wait_text(){
  local tries=0
  while [ "$tries" -lt 3 ]; do
    ab wait --text "$1" >/dev/null 2>&1 && return 0
    tries=$((tries + 1))
  done
  return 1
}

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
  local name="$1" value tries=0
  # 带 15s 有界轮询：#run20 实证披露偏好屏的水合行比首屏慢数秒，裸读一次必然扑空；
  # 切档后的 aria-pressed 翻面也是异步的，读到再判。
  while [ "$tries" -lt 15 ]; do
    value="$(ab get attr "[aria-label=\"$name\"]" aria-pressed 2>/dev/null)" \
      && [ "$value" = 'true' ] && return 0
    tries=$((tries + 1))
    sleep 1
  done
  value="$(ab get attr "[aria-label=\"$name\"]" aria-pressed 2>/dev/null || printf '缺')"
  echo "「${name}」没有处于选中态（实到 aria-pressed=${value}）" >&2
  return 1
}

# 输入框 / 文本域里的值不是页面文本，wait --text 看不见它（React 把 value 写成属性，
# 不写进 innerText）。所以这一类字段按产品自己的可访问名称读 value，并逐字相等比对 ——
# 子串比对在这一轮会出事：招聘名片的基线职务「招聘负责人」正好是临时值
# 「浏览器验收招聘负责人」的后缀，只有逐字相等才分得开「改回来了」和「没改回来」。
# 先 wait 再读：分区编辑页在企业档案水合之前根本不渲染这个文本域（公司档案分区编辑.tsx:244-254），
# 等到它出现就等于等到了权威快照。
assert_value(){
  local sel got tries=0
  sel="[aria-label=\"$1\"]"
  # 与 wait_text 同理：分区编辑页在档案快照水合前不渲染文本域，快照慢时 25s 不够。
  # 三次有界重试保持「先等出现、出现才读值」的原合同；值错了到点后按最终读数判。
  while [ "$tries" -lt 3 ]; do
    if ab wait "$sel" >/dev/null 2>&1; then
      got="$(ab get value "$sel")" || return 1
      [ "$got" = "$2" ] && return 0
    fi
    tries=$((tries + 1))
    sleep 1
  done
  if ab wait "$sel" >/dev/null 2>&1; then
    got="$(ab get value "$sel" 2>/dev/null)"
    echo "字段「$1」的值不是期望值：读到「${got}」" >&2
  fi
  return 1
}

# 岗位行落在哪一组。
#
# 岗位管理的分组标（在招 / 已归档）是纯 div，没有任何可访问结构把行归进组里；
# 行自己的可访问名称才是唯一的语义信号 —— 它是「岗位名 + 当前徽 + 薪资/在谈 + 状态徽」
# （src/屏幕/岗位管理.tsx 岗位行名称），末尾那一段状态徽就是它所在的组。
# 中间那一段（薪资带、在谈人数）来自后端、旅程无法预知，所以只钉两头：
# 前缀＝这个岗位的业务身份，后缀＝它现在在哪一组。
# wait 本身就是断言：归档/重开是异步的，等不到就说明这一行没进到目标分组。
assert_job_row(){
  ab wait "[aria-label^=\"$1\"][aria-label\$=\"$2\"]" >/dev/null
}

# 等某一行从列表里真的消失（删除要等服务端回来产品才把行摘掉）。
# 仍然只认产品自己的可访问名称前缀。这里刻意不用 `wait --state hidden`：
# `--state` 是 agent-browser 的浏览器状态持久化开关，本轮明令禁止它出现在长期脚本里，
# 同名的元素状态参数一并避开，免得禁令要靠「后面跟的是不是路径」来分辨。
wait_row_gone(){
  ab wait --fn "document.querySelectorAll('[aria-label^=\"$1\"]').length === 0" >/dev/null
}

# 写操作提交之后、硬刷新之前的收口：等这一屏的网络安静下来。
# 有些保存动作做完不换屏也不改列表（招聘名片、公司介绍分区都只弹一条轻提示），
# 没有任何业务信号可等；紧接着硬刷新就有可能把还在飞的写请求打断。
# 这里只等网络空闲这一个加载态，不读任何请求的方法 / 路径 / 状态码 ——
# 断言仍然只看硬刷新之后页面上的业务结果。
#
# 刻意**不**把它当断言：它只是稳定器。dev 服务器的长连接理论上可能让 networkidle
# 一直等到超时，那属于环境噪音，不该把整条旅程判失败 —— 真正的结论仍然由硬刷新之后
# 的业务断言给出，稳定器等不到就直接往下走。
settle(){ ab wait --load networkidle >/dev/null 2>&1 || true; }

# 按钮一律按可访问名称点。产品里有一类按钮的名称带 CSS ::before 画出来的选中勾
# （如「✓ 全职」），所以默认用子串匹配；名称唯一且要防误配时用 click_button_exact。
#
# 所有 find 都走 find_retry：切屏后 Chrome 的辅助功能树重建是秒级瞬态——DOM 与像素
# 都已就位、`wait --text` 也能过，唯独此刻的 find 会拿旧屏/塌缩树扑空（#run12 的
# 姓名行 find 失败、数秒后同屏同参成功）。单发 find 在真实栈上等于掷骰子。
find_retry(){
  local tries=0
  while [ "$tries" -lt 30 ]; do ab find "$@" && return 0; tries=$((tries + 1)); sleep 1; done
  return 1
}
click_button(){ find_retry role button click --name "$1" >/dev/null; }
click_button_exact(){ find_retry role button click --name "$1" --exact >/dev/null; }

# 返回栏的 ‹ 键（src/组件/通用.tsx 返回栏，可访问名称「返回」）
click_back(){ click_with_retry '返回'; }

# 导航（click_back、底部 tab、返回上级）之后的目标屏要等数据回来才渲染：
# 真实后端每一屏先拉 /me 与业务数据才画菜单行，mock 数据源是同步渲染、
# 这块「find 跟骨架屏赛跑」的竞速从来看不见，真实栈上两连败（#run7）。
# 规矩：屏幕切换后的第一个动作必须是等待，不能是 find —— 这里把它封成一个词，
# 等到目标控件的**可访问名文本**出现再按名点。默认严格匹配；传 prefix 用子串匹配。
click_after_hydrate(){
  wait_text "$1"
  click_with_retry "$1" "${2:-exact}"
}

# 「点过去、到屏为准」：某些点击命令在页面换屏后以非零退出（点击已派发、
# 命令收尾扫到新屏的 AX），调用方若按退出码硬判就会把成功的导航当失败重试 30 次
# （#run25-28 实证）。这里封装：语义点击 → 屏面标记在不在 → 不在再语义/几何补点。
click_until_screen(){
  local button="$1" marker="$2" mode="${3:-exact}"
  if on_screen "$marker"; then return 0; fi
  if [ "$mode" = 'prefix' ]; then click_button "$button" || click_row_geometry "$button"; else click_button_exact "$button" || click_row_geometry "$button"; fi
  on_screen "$marker" && return 0
  return 1
}

# set -e 安全的屏面判断：当前页面文本是否包含语义标记。[ x ] && cmd 的裸 && 在
# 条件不成立时返回 1，会把整条旅程错杀；所有「按屏面二选一」都走这里 + if。
on_screen(){
  local hit
  hit="$(ab eval "document.body.innerText.includes($(jq -Rn --arg t "$1" '$t|@json'))" 2>/dev/null | tr -d '"')"
  [ "$hit" = 'true' ]
}

# 切屏后 Chrome 会有一段辅助功能树重算窗口：期间整棵 AX 塌成一个以全文为名的
# generic + 壳外那枚「标注模式」（manual-run 失败快照实证：像素正常渲染、wait --text
# 走的 DOM 文本不受影响，唯独 role find 必然扑空），数秒后自愈。所以屏幕切换后的
# 点击一律带有限重试，单次 find 撞上重算窗口就把整条旅程错杀。成功即返回；
# 30 次仍未点上＝真找不到，按失败落地（错误信息由 find 自己打）。
click_with_retry(){
  local name="$1" mode="${2:-exact}" tries=0
  while [ "$tries" -lt 30 ]; do
    if [ "$mode" = 'prefix' ]; then click_button "$name" && return 0; else click_button_exact "$name" && return 0; fi
    tries=$((tries + 1))
    sleep 1
  done
  printf '按钮「%s」重试 30 秒仍未点上\n' "$name" >&2
  return 1
}

# AX 兜底点击：长会话后段的 AX 树会对整屏返回别的 tab（#run25：DOM 在公司资料列表，
# role find 的 Names seen 仍是 主壳 tab，30s 不追平）。对这类「语义名稳定、AX 却看
# 不到」的行，允许最后一层兜底：按 aria-label 前缀取**行自己的矩形**，走真实鼠标
# 派发——授权与 左滑行 相同（几何取自语义定位的元素自身，事件是 Chrome 真实输入，
# 不合成 DOM 事件）。语义定位仍然优先于它，这里只给调用方在语义路径失败后用。
click_row_geometry(){
  local name="$1" sel box x y tries=0
  sel="[aria-label^=\"$name\"]"
  while [ "$tries" -lt 5 ]; do
    if box="$(ab get box "$sel" --json 2>/dev/null)"; then
      x="$(printf '%s' "$box" | jq -r '.data | (.x + .width / 2 | floor)')"
      y="$(printf '%s' "$box" | jq -r '.data | (.y + .height / 2 | floor)')"
      case "$x$y" in *null*|'') tries=$((tries + 1)); sleep 1; continue ;; esac
      ab mouse move "$x" "$y" >/dev/null
      ab mouse down >/dev/null
      ab mouse up >/dev/null
      return 0
    fi
    tries=$((tries + 1))
    sleep 1
  done
  echo "行「$name」取不到几何，几何兜底点击失败" >&2
  return 1
}

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
  # 整体带 10 次重试：硬刷新后行还在水合（#run22 实证 get box 拿旧屏扑空），
  # 滑开自检不过就整段重滑，10 秒仍未滑开才按失败落地。
  local tries=0
  while [ "$tries" -lt 10 ]; do
    _左滑一次 "$1" && return 0
    tries=$((tries + 1))
    sleep 1
  done
  echo "行「$1」10 次重试后仍未滑开" >&2
  return 1
}

_左滑一次(){
  local name="$1" sel box x_from x_to y step k
  sel="[aria-label^=\"$name\"]"
  # 硬刷新恢复滚动位后，行的矩形可能在视口外（#run23 的 10 连败：坐标全打在空处）。
  # 先按语义把行滚到视口里再取几何做手势。scrollintoview 是 agent-browser 的
  # 正规命令（不是 eval 造事件），合同里「滑行上下文禁 eval」依旧成立。
  ab scrollintoview "$sel" >/dev/null 2>&1 || true
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

# 本地 dev 栈把短信验证码写在这个文件里，只在本机可读。
_otp_file(){ printf '%s' "${AGXP_MONOREPO_DIR:-}/apps/recruitment/.local-dev/code"; }

# 这个码是**固定常量**，不是「当轮验证码」：后端 apps/recruitment/scripts/dev-local.sh 在
# prepare_material 里一次性写下 LOCAL_OTP，之后 bootstrap 直接复用同一个常量，health
# 还会断言这个文件仍然等于它。没有任何环节会按次重写它。
# 所以这里不做新鲜度判定 —— 等一个永远不会前进的 mtime 只会把每一条旅程都拖成超时阻塞。
#
# 文件不在或为空＝本机 dev 材料没准备好，是本机环境的问题，不是产品的问题：
# 报成 FUNCTIONAL_FAILED 会让第一个跑这条命令的人去追一个不存在的产品缺陷。
# 这个函数只在命令替换里被调用（子 shell），置全局标志出不来，所以结论走退出码：
# 75 = 环境阻塞，由 _login 在父 shell 里翻译成 JOURNEY_BLOCKED。
_read_local_otp(){
  local file value
  file="$(_otp_file)"
  if [ ! -f "$file" ]; then
    echo '本地 OTP 文件不存在，登录中止' >&2
    return 75
  fi
  value="$(tr -d ' \t\r\n' <"$file")"
  if [ -z "$value" ]; then
    echo '本地 OTP 文件为空，登录中止' >&2
    return 75
  fi
  printf '%s' "$value"
}

# 敏感值只经过这一个出口。
#
# xtrace 必须由调用方在**进入这个函数之前**就关掉，在函数体里关已经晚了一整帧：
# bash 先把调用行连同展开后的实参打出来（`+ _fill_secret 短信验证码 824913`），
# 才开始执行函数体；而 `local value="$2"` 还会把值再打一次
# （`+ local label=… value=824913 …`）。所以这里既不收 local 也不自己关 xtrace，
# 直接用 $2 传进去 —— 抑制的责任完全落在 _login 那一段。
_fill_secret(){
  find_retry label "$1" fill "$2" >/dev/null
}

# $1 会话名 $2 手机号 $3 身份大卡名 $4 该角色主壳的 hash
_login(){
  local want_session="$1" phone="$2" identity="$3" shell_hash="$4" code otp_xtrace otp_rc
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

  find_retry label 手机号 fill "$phone" >/dev/null
  find_retry role button click --name 获取验证码 >/dev/null
  # backend 模式下 begin 是一次真实的 BFF 网络往返，验证码格要等响应成功才渲染
  # （src/屏幕/登录.tsx：剩余秒 非 null 才渲染验证码格）。读 OTP 文件只要几毫秒，
  # 中间不先等格出现，就是在拿毫秒赌一次后端往返 —— mock 模式同步渲染看不出来，
  # 真实后端上两连败。等格出现再继续。
  ab wait '[aria-label="短信验证码"]' >/dev/null

  # ── OTP 段：从读码到清掉，全程关 xtrace ──
  # 必须在 code=$(...) **之前**关。开着 set -x 时，这一段会连泄五处：
  # _read_local_otp 里的 `value=<码>` 与 `printf %s <码>`（命令替换是子 shell，同样被 trace）、
  # 赋值行 `code=<码>`、调用行 `_fill_secret 短信验证码 <码>`、以及被调函数里的 `local value=<码>`。
  # 在被调函数体里关掉一个都拦不住，所以抑制只能落在这里。
  otp_xtrace=0
  case "$-" in *x*) otp_xtrace=1; set +x ;; esac
  otp_rc=0
  code="$(_read_local_otp)" || otp_rc=$?
  # 75 是 _read_local_otp 专门用来表达「本机 OTP 材料没准备好」的环境结论（见那个函数）。
  if [ "$otp_rc" = '75' ]; then
    mark_journey_blocked '本地 dev 栈没有写出可读的短信验证码文件'
  fi
  if [ "$otp_rc" = '0' ]; then _fill_secret 短信验证码 "$code" || otp_rc=1; fi
  code=''
  unset code
  if [ "$otp_xtrace" = '1' ]; then set -x; fi
  [ "$otp_rc" = '0' ] || return 1

  click_button '已阅读并同意'
  click_button_exact '进入'
  # 登录后有两个落点：已建档的真实账号直接进对应主壳（无身份大卡）；mock / 新档案
  # 才落身份选择屏。等「大卡出现或主壳 hash 到手」二者其一，再按 url 分叉——干等
  # 大卡文本会把真实账号的每条旅程拖成 25 秒超时（#run6 实测）。
  ab wait --fn "document.body.innerText.includes('$identity') || location.hash === '$shell_hash'" >/dev/null
  case "$(ab get url)" in
    *"$shell_hash") : ;;
    *) click_button_exact "$identity" ;;
  esac

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

# ── 私密运行 journal ────────────────────────────────────────────────

# 只记录「浏览器已经做完」的里程碑和固定保留名称，永远不写 raw ID。
# 写入用同目录临时文件 + mv 原子替换，保持 0600。
#
# 它是**人读证据**，不是后端算子的输入：`browser-fixture.sh cleanup --ledger`
# 只接受后端自己写的 run receipt（带 candidate / recruiter 两段 owner-list），
# 把这份 journal 传过去会让设计稿 §8.5 的差集清理整段空转。唯一的读者是
# 运行整栈验收.sh 的 print_private_journal：清理失败时把这几个固定保留名称念给人听。
record_cleanup_marker(){
  local key="$1" value="$2" result tmp
  if [ -z "${PRIVATE_JOURNAL:-}" ] || [ ! -f "$PRIVATE_JOURNAL" ]; then
    echo '私密清理台账不存在，拒绝记录里程碑' >&2
    return 1
  fi
  case "$key" in
    candidate_intention_created)
      if [ "$value" != 'true' ]; then echo "$key 只接受 true" >&2; return 1; fi
      result="$(jq '.candidate_intention_created = true' "$PRIVATE_JOURNAL")" || return 1
      ;;
    candidate_resume_file_names|recruiter_job_titles)
      case "$value" in
        浏览器验收*) : ;;
        *) echo '台账只记录固定保留的验收名称' >&2; return 1 ;;
      esac
      result="$(jq --arg k "$key" --arg v "$value" '.[$k] = ((.[$k] // []) + [$v])' "$PRIVATE_JOURNAL")" || return 1
      ;;
    *)
      echo "未知清理台账字段：$key" >&2
      return 1
      ;;
  esac
  tmp="$(dirname "$PRIVATE_JOURNAL")/.$(basename "$PRIVATE_JOURNAL").$$"
  ( umask 077; printf '%s\n' "$result" >"$tmp" ) || return 1
  chmod 600 "$tmp" || return 1
  mv -f "$tmp" "$PRIVATE_JOURNAL"
}

# ── 旅程结果分片 ────────────────────────────────────────────────────

# 分片路径合同：<FRAGMENT_DIR>/<旅程ID>.json，字段与 e2e/真实后端/类型.ts 的 旅程结果 一致。
# status 取 pass / failed / blocked / skipped 四种；blocked 表示环境阻塞（设计稿 §14），
# 由 write_journey_failure 在 JOURNEY_BLOCKED 置位时写出，报告读取端据此升级成 exit 75。
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

# ── 双会话隔离门 ────────────────────────────────────────────────────

# 这道门不是一条旅程（不登录新账号、不做 CRUD、不拍截图），但它要写一份自己的分片，
# 所以旅程 ID 用 session-isolation（e2e/真实后端/类型.ts 旅程们 里就有这一个）。
#
# 它证明三件事：
#   1. 两个会话各看各的 —— 求职端硬刷新看不到招聘方的私有名片标记，反之亦然；
#   2. 退出是会话级的 —— 只退候选，招聘会话一点没被牵连；
#   3. 招聘方的退出**不在这里做** —— 那属于运行器的全局收尾（Task 7 teardown），
#      在这里退掉会让后面的清理没有可用会话。
#
# 里程碑记在这个全局里：下面的步骤串成一条 && 链（这个函数不假设调用方开了 set -e），
# 中间任何一步失败都会当场断链，链断在哪一步这个变量就停在哪一步。
ISOLATION_MILESTONE='候选登录'

_isolation_steps(){
  # ── 候选侧：硬刷新我的简历，招聘方的私有名片标记一个字都不该出现 ──
  AGENT_BROWSER_SESSION="$CANDIDATE_SESSION" &&
  login_candidate &&
  ISOLATION_MILESTONE='候选侧硬刷新' &&
  click_after_hydrate '我' &&
  click_after_hydrate '我的简历' &&
  reload_and_assert '浏览器验收候选人' &&
  assert_absent '浏览器验收招聘官' &&

  # ── 招聘侧：硬刷新招聘名片，候选人的私有摘要一个字都不该出现 ──
  AGENT_BROWSER_SESSION="$RECRUITER_SESSION" &&
  login_recruiter &&
  ISOLATION_MILESTONE='招聘侧硬刷新' &&
  click_after_hydrate '我' &&
  click_after_hydrate '设置' &&
  click_after_hydrate '招聘名片' prefix &&
  reload_and_assert '浏览器验收招聘官' &&
  assert_absent '浏览器验收候选人 · 真实后端基准摘要' &&

  # ── 只退候选 ──
  AGENT_BROWSER_SESSION="$CANDIDATE_SESSION" &&
  ISOLATION_MILESTONE='候选退出登录' &&
  click_back &&
  click_after_hydrate '我' &&
  click_after_hydrate '设置' &&
  click_button_exact '退出登录' &&
  assert_text '退出当前账号？' &&
  # 确认键点的是它自己的可访问名称「确认退出当前账号」（src/屏幕/设置.tsx:225 的 aria-label），
  # 不是可见文案「退出登录」—— 那个名字上面那枚触发键也叫，而弹层框架用的是
  # <dialog open>（组件/弹层框架.tsx:62-64），非模态，页面其余部分既不 inert 也不剪枝，
  # 再点一次「退出登录」只会重新点到背景里那枚触发键，候选根本退不出去。
  click_button_exact '确认退出当前账号' &&
  # 登录页的手机号输入面（src/屏幕/登录.tsx:184 aria-label="手机号"）出现＝真的回到未登录
  ab wait '[aria-label="手机号"]' >/dev/null &&

  # ── 招聘会话不受影响：此刻硬刷新仍然读得到自己的公开名 ──
  AGENT_BROWSER_SESSION="$RECRUITER_SESSION" &&
  ISOLATION_MILESTONE='招聘会话仍在' &&
  reload_and_assert '浏览器验收招聘官' &&
  assert_no_mock_data &&
  ISOLATION_MILESTONE='完成'
}

会话隔离门(){
  local rc=0
  ISOLATION_MILESTONE='候选登录'
  _isolation_steps || rc=1
  # 分片一律按招聘会话收口：这道门的最后一句话就是「招聘会话还在」，
  # 证据（/api/v1 请求、控制台错误）也该取自那一侧。
  AGENT_BROWSER_SESSION="$RECRUITER_SESSION"
  if [ "$rc" -eq 0 ]; then
    write_journey_result 'session-isolation' pass "$ISOLATION_MILESTONE"
  else
    # 四条业务旅程失败时都会留一份失败快照，这道门最容易因为非显而易见的原因失败，
    # 少了它就是唯一一条「失败但零诊断」的路径。
    capture_failure_snapshot 'session-isolation'
    if [ "$JOURNEY_BLOCKED" = '1' ]; then
      write_journey_result 'session-isolation' blocked "$ISOLATION_MILESTONE" \
        "双会话隔离门在里程碑「${ISOLATION_MILESTONE}」遇到环境阻塞：${JOURNEY_BLOCKED_REASON}"
    else
      write_journey_result 'session-isolation' failed "$ISOLATION_MILESTONE" \
        "双会话隔离门在里程碑「${ISOLATION_MILESTONE}」失败"
    fi
  fi
}
