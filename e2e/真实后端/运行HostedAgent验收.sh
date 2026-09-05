#!/usr/bin/env bash
# Hosted Agent acceptance suite · 五轮固定顺序的薄 wrapper。
#
#   npm run test:agent-browser:hosted-agent -- [--headed]
#
# 它只做三件事：确认 acceptance 栈可用（复用或自起）、按固定顺序串行调用单轮 runner
#   happy → happy → p4 → p5 → p6、任一轮非零即停并保留该轮报告。
# 整组复用同一套 acceptance stack，避免五轮重复 build。每轮的 run ID / receipt /
# 报告全部由子 runner 自己拥有，wrapper 不传入、复用或解释这些标识，也不解释页面
# 状态。happy 第二轮本身就是第一轮 cleanup / admission 有效性的真实消费证据：
# 上一轮 cleanup 没 PASS，下一轮 converge 不会放行。
#
# 退出码转发自子 runner（0/1/2/75）；栈没就绪或 default 栈占位是 75。
# 只停自己启动的 acceptance stack；down 永远不带 --volumes。
#
# Bash 3.2 兼容：变量名只用 ASCII，indexed array 可用，不用 associative array。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="$ROOT_DIR/运行整栈验收.sh"
HEADED=0
BACKEND_OWNED=0

case "$#:${1:-}" in
  0:) ;;
  1:--headed) HEADED=1 ;;
  *) printf 'usage: %s [--headed]\n' "$0" >&2; exit 2 ;;
esac

[ -x "$RUNNER" ] || { printf '单轮 runner 不可执行：%s\n' "$RUNNER" >&2; exit 2; }
[ -n "${AGXP_MONOREPO_DIR:-}" ] || { printf 'AGXP_MONOREPO_DIR 未设置\n' >&2; exit 75; }
DEV="$AGXP_MONOREPO_DIR/apps/recruitment/scripts/dev-local.sh"
[ -x "$DEV" ] || { printf 'dev-local.sh 不可执行：%s\n' >&2; exit 75; }

on_exit(){
  local rc=$?
  trap - EXIT INT TERM
  if [ "$BACKEND_OWNED" = '1' ]; then "$DEV" down >/dev/null 2>&1 || true; fi
  exit "$rc"
}
trap on_exit EXIT
trap 'exit 75' INT TERM

if "$DEV" health --acceptance >/dev/null 2>&1; then
  printf 'acceptance 本地栈已健康，整组复用（本轮不会 down）\n'
elif "$DEV" health >/dev/null 2>&1; then
  printf 'Hosted suite 阻塞：default stack 正在运行，请先由其 owner 执行 down\n' >&2
  exit 75
else
  BACKEND_OWNED=1
  "$DEV" prepare --acceptance \
    && "$DEV" up --acceptance \
    && "$DEV" health --acceptance \
    || { printf 'Hosted suite acceptance stack 未就绪\n' >&2; exit 75; }
fi

for scene in happy happy p4 p5 p6; do
  args=(--journey hosted-agent --hosted-scene "$scene")
  [ "$HEADED" = '0' ] || args+=(--headed)
  printf 'Hosted suite round：scene=%s\n' "$scene"
  bash "$RUNNER" "${args[@]}" || exit $?
done
printf 'Hosted suite：五轮全部完成\n'
