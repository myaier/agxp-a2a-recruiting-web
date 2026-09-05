#!/usr/bin/env bash
# Hosted suite wrapper（运行HostedAgent验收.sh）的 hermetic 合同测试。
#
# 沙盒里只有 wrapper 是真的：dev-local 与单轮 runner（运行整栈验收.sh）都是假件。
# 证明的是 wrapper 的三件事：五轮固定顺序 happy happy p4 p5 p6、任一轮非零即停、
# acceptance stack ownership（复用不 down / 自己起的自己 down / default 栈零切换）。
# wrapper 不解释页面状态，这里也不测任何页面行为；每轮的 run ID / receipt 由子
# runner 自己拥有，wrapper 不传入、复用或解释这些标识。
#
# 标识符一律 ASCII：macOS /bin/bash 是 3.2。
# 跑法：bash e2e/真实后端/运行HostedAgent验收.test.sh

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
WRAPPER="$ROOT_DIR/运行HostedAgent验收.sh"

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
SANDBOX_ROOT="$(mktemp -d "$SANDBOX_PARENT/hosted-wrapper-test.XXXXXX")"
cleanup_all(){ rm -rf "$SANDBOX_ROOT"; rmdir "$SANDBOX_PARENT" 2>/dev/null || true; }
trap cleanup_all EXIT

SANDBOX="$SANDBOX_ROOT/repo"
STATE="$SANDBOX_ROOT/state"
MONO="$SANDBOX_ROOT/monorepo"
CALLS="$SANDBOX_ROOT/calls.txt"
OUT="$SANDBOX_ROOT/stdout.txt"

mkdir -p "$SANDBOX/e2e/真实后端" "$STATE" "$MONO/apps/recruitment/scripts"

# 被测对象：真实 wrapper 复制进沙盒。wrapper 按同目录定位单轮 runner，
# 所以沙盒里再放一个 fake 运行整栈验收.sh 当 child。
cp "$WRAPPER" "$SANDBOX/e2e/真实后端/运行HostedAgent验收.sh" 2>/dev/null \
  || printf '被测 wrapper 不存在：%s\n' "$WRAPPER" >&2

# fake child runner：记录参数，按 FAKE_CHILD_FAIL_AT 让第 N 轮退出 1。
cat >"$SANDBOX/e2e/真实后端/运行整栈验收.sh" <<'FAKE'
#!/usr/bin/env bash
set -u
printf 'child %s\n' "$*" >>"$CALLS"
n=$(cat "$STATE/child-calls" 2>/dev/null || printf 0)
n=$((n + 1)); printf '%s' "$n" >"$STATE/child-calls"
if [ -n "${FAKE_CHILD_FAIL_AT:-}" ] && [ "$n" -eq "${FAKE_CHILD_FAIL_AT}" ]; then
  exit 1
fi
exit 0
FAKE
chmod +x "$SANDBOX/e2e/真实后端/运行整栈验收.sh"

# fake dev-local.sh：与 运行整栈验收.test.sh 同一套（acceptance/plain 分账，
# prepare|up 只认 exact --acceptance，bootstrap|down 无参）。
cat >"$MONO/apps/recruitment/scripts/dev-local.sh" <<'FAKE'
#!/usr/bin/env bash
set -u
printf 'dev-local %s\n' "$*" >>"$CALLS"
case "${1:-}" in
  health)
    shift
    case "$#:${1:-}" in
      1:--acceptance)
        n=$(cat "$STATE/acceptance-health-calls" 2>/dev/null || printf 0)
        n=$((n + 1)); printf '%s' "$n" >"$STATE/acceptance-health-calls"
        rc=$(printf '%s\n' ${FAKE_ACCEPTANCE_HEALTH_SEQ:-0} | tr ' ' '\n' | sed -n "${n}p")
        [ -n "$rc" ] || rc=$(printf '%s\n' ${FAKE_ACCEPTANCE_HEALTH_SEQ:-0} | tr ' ' '\n' | tail -1)
        exit "$rc" ;;
      0:) exit "${FAKE_DEFAULT_HEALTH_RC:-1}" ;;
      *) printf 'FAKE dev-local health 参数错误\n' >>"$CALLS"; exit 64 ;;
    esac ;;
  prepare|up)
    command="$1"; shift
    [ "$#" -eq 1 ] && [ "$1" = '--acceptance' ] \
      || { printf 'FAKE dev-local %s 缺少 exact --acceptance\n' "$command" >>"$CALLS"; exit 64; }
    exit 0 ;;
  bootstrap)
    [ "$#" -eq 1 ] || { printf 'FAKE dev-local bootstrap 不接受参数\n' >>"$CALLS"; exit 64; }
    exit 0 ;;
  down)
    case "$*" in *--volumes*) printf 'FAKE dev-local down 带了 --volumes\n' >>"$CALLS"; exit 1 ;; esac
    [ "$#" -eq 1 ] || { printf 'FAKE dev-local down 不接受参数\n' >>"$CALLS"; exit 64; }
    exit 0 ;;
  *) printf 'FAKE dev-local 未预期子命令：%s\n' "$*" >>"$CALLS"; exit 64 ;;
esac
FAKE
chmod +x "$MONO/apps/recruitment/scripts/dev-local.sh"

export CALLS STATE

RC=0
reset_case(){
  : >"$CALLS"
  rm -f "$STATE/acceptance-health-calls" "$STATE/child-calls"
  export AGXP_MONOREPO_DIR="$MONO"
  export FAKE_ACCEPTANCE_HEALTH_SEQ='0' FAKE_DEFAULT_HEALTH_RC=1 FAKE_CHILD_FAIL_AT=''
}
run_wrapper(){
  RC=0
  bash "$SANDBOX/e2e/真实后端/运行HostedAgent验收.sh" "$@" >"$OUT" 2>&1 || RC=$?
}

# ── 用例 ────────────────────────────────────────────────────────────

testcase '固定顺序跑五轮并复用预先存在的 acceptance stack'
reset_case
run_wrapper
assert_eq '退出 0' "$RC" 0
assert_eq '五轮' "$(grep -c '^child ' "$CALLS")" 5
assert_eq '顺序' "$(grep '^child ' "$CALLS" | sed 's/.*--hosted-scene /scene=/' | tr '\n' ' ')" \
  'scene=happy scene=happy scene=p4 scene=p5 scene=p6 '
assert_missing '不 down 别人的栈' 'dev-local down' "$CALLS"
assert_missing '假件没有报告任何未预期调用' 'FAKE ' "$CALLS"

testcase '第二轮失败后不启动第三轮，自己启动的栈仍收尾'
reset_case
export FAKE_ACCEPTANCE_HEALTH_SEQ='1 0' FAKE_DEFAULT_HEALTH_RC=1 FAKE_CHILD_FAIL_AT=2
run_wrapper
assert_eq '保留 child 退出码 1' "$RC" 1
assert_eq '只启动两轮' "$(grep -c '^child ' "$CALLS")" 2
assert_contains '自己起的栈自己 down' 'dev-local down' "$CALLS"
assert_missing 'down 绝不带 --volumes' 'FAKE dev-local down 带了 --volumes' "$CALLS"

testcase 'default stack 在位时零切换'
reset_case
export FAKE_ACCEPTANCE_HEALTH_SEQ='75' FAKE_DEFAULT_HEALTH_RC=0
run_wrapper
assert_eq '退出 75' "$RC" 75
assert_missing '零 child' 'child ' "$CALLS"
assert_missing '零 prepare' 'dev-local prepare' "$CALLS"
assert_missing '零 down' 'dev-local down' "$CALLS"

testcase '--headed 透传给每一轮'
reset_case
run_wrapper --headed
assert_eq '退出 0' "$RC" 0
assert_eq '每轮都带 headed' "$(grep -c -- '^child .*--headed' "$CALLS")" 5

testcase '未知参数：exit 2，零 stack mutation'
reset_case
run_wrapper --nope
assert_eq '退出 2' "$RC" 2
assert_eq '零外部调用' "$(wc -l <"$CALLS" | tr -d ' ')" 0

printf '\n'
if [ "$FAILURES" -eq 0 ]; then
  printf '全部通过\n'
  exit 0
fi
printf '%s 条断言失败\n' "$FAILURES" >&2
exit 1
