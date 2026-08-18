#!/bin/bash
# 标注隧道守护：trycloudflare 临时隧道会不定期掉线（进程活着但会话失效，POST 530），
# 用户标注就直达不了。这个守护循环每 60 秒探活一次：
#   通 → 什么都不做；
#   不通 → 杀掉旧 cloudflared 重开一条，新地址写 .标注端点 并用 gh api 单文件
#          推到 gh-pages（annotate-endpoint.json 立即生效，不用重发整站）。
# 前台常驻，交给调用方放后台（Claude 的 Monitor / nohup 均可）。
# 每次换地址会向 stdout 打一行「端点已更新 <url>」，方便外部监听。
#
# 注意：bash 函数名可以用中文，但**变量名必须 ASCII**（新端点= 这种赋值会被
# 当成命令、$新端点 不展开）—— 2026-08-18 踩过，把字面量 "$新端点" 推上了线。

set -uo pipefail
cd "$(dirname "$0")/.."

REPO="myaier/agxp-a2a-recruiting-web"
LOG_DIR="${TMPDIR:-/tmp}"
TUNNEL_LOG="$LOG_DIR/标注隧道.log"

探活() {
  # GET 根路径探活，不 POST —— POST 会往收件箱写探活垃圾，每分钟触发一次
  # Claude 侧的标注通知（2026-08-18 踩过）。隧道会话死时 Cloudflare 回 530/000，
  # 活着时收集服务回什么都行（2xx/3xx/4xx 均证明链路通）。
  local url="$1"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$url/" 2>/dev/null)
  case "$code" in
    2*|3*|4*) return 0 ;;
    *) return 1 ;;
  esac
}

重开隧道() {
  pkill -f "cloudflared tunnel --url http://localhost:8090" 2>/dev/null || true
  sleep 1
  nohup cloudflared tunnel --url http://localhost:8090 > "$TUNNEL_LOG" 2>&1 &
  local url=""
  for _ in $(seq 1 25); do
    sleep 1
    # 两个坑（2026-08-19 都踩过）：
    #   · 日志里有 api.trycloudflare.com（cloudflared 自家 API 域名）→ 排除；
    #   · 日志含控制字节时 grep 视作二进制，stdout 变成「Binary file … matches」
    #     整句被当 URL 推上线 → -a 强制按文本读
    url=$(grep -a -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" | grep -v '://api\.trycloudflare' | head -1 || true)
    [ -n "$url" ] && break
  done
  echo "$url"
}

推端点() {
  local url="$1"
  # 最后一道闸：不是合法隧道地址就拒推（宁可不更新也不能把垃圾推上线）
  case "$url" in
    https://*.trycloudflare.com) ;;
    *) echo "拒推非法端点：$url"; return 1 ;;
  esac
  echo "$url" > .标注端点
  local content sha
  content=$(printf '{"url":"%s"}' "$url" | base64)
  sha=$(gh api "repos/$REPO/contents/annotate-endpoint.json?ref=gh-pages" --jq .sha 2>/dev/null || true)
  if [ -n "$sha" ]; then
    gh api -X PUT "repos/$REPO/contents/annotate-endpoint.json" \
      -f message="守护：更新标注直达端点" -f content="$content" -f branch=gh-pages -f sha="$sha" > /dev/null
  else
    gh api -X PUT "repos/$REPO/contents/annotate-endpoint.json" \
      -f message="守护：标注直达端点" -f content="$content" -f branch=gh-pages > /dev/null
  fi
}

# ── 主循环 ──
CUR_URL=$(cat .标注端点 2>/dev/null || true)
while true; do
  # 收集服务也顺带看护：没在跑就拉起来
  if ! curl -s -m 2 http://localhost:8090/ > /dev/null 2>&1; then
    nohup node 脚本/标注收集服务.mjs > "$LOG_DIR/标注服务.log" 2>&1 &
    sleep 1
    echo "收集服务重启"
  fi

  if [ -z "$CUR_URL" ] || ! 探活 "$CUR_URL"; then
    NEW_URL=$(重开隧道)
    if [ -n "$NEW_URL" ]; then
      推端点 "$NEW_URL"
      CUR_URL="$NEW_URL"
      echo "端点已更新 $NEW_URL"
    else
      echo "隧道重开失败，60 秒后再试"
    fi
  fi
  sleep 60
done
