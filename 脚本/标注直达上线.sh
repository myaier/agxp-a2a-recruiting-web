#!/bin/bash
# 标注直达上线：让线上 GitHub Pages（https）上的标注也能直接送达本机。
#
# 做四件事：
#   1. 确保本机收集服务在跑（:8090，落 标注收件箱.jsonl）
#   2. 起 Cloudflare 临时隧道，把 :8090 暴露成一个 https 地址
#   3. 隧道地址写进工程根 .标注端点（本地记录，deploy 时会带进 dist）
#   4. 用 gh api 把 annotate-endpoint.json 单文件推到 gh-pages（立即生效，不用重发整站）
#
# Mac 重启或隧道断掉后重跑一次即可。临时隧道无鉴权，端点公开在 Pages 配置里 ——
# 最坏情况是路人向收件箱塞垃圾文本，Claude 读时忽略即可，风险可接受。

set -euo pipefail
cd "$(dirname "$0")/.."

REPO="myaier/agxp-a2a-recruiting-web"
LOG_DIR="${TMPDIR:-/tmp}"

# ── 1. 收集服务 ──
if ! curl -s -m 2 http://localhost:8090/ > /dev/null 2>&1; then
  nohup node 脚本/标注收集服务.mjs > "$LOG_DIR/标注服务.log" 2>&1 &
  sleep 1
  echo "收集服务已启动 :8090"
else
  echo "收集服务已在跑 :8090"
fi

# ── 2. 隧道 ──
TUNNEL_LOG="$LOG_DIR/标注隧道.log"
EXISTING=$(pgrep -f "cloudflared tunnel --url http://localhost:8090" || true)
if [ -n "$EXISTING" ] && [ -f "$TUNNEL_LOG" ]; then
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
fi
if [ -z "${URL:-}" ]; then
  pkill -f "cloudflared tunnel --url http://localhost:8090" 2>/dev/null || true
  nohup cloudflared tunnel --url http://localhost:8090 > "$TUNNEL_LOG" 2>&1 &
  for i in $(seq 1 20); do
    sleep 1
    URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)
    [ -n "$URL" ] && break
  done
fi
[ -z "${URL:-}" ] && { echo "隧道启动失败，看 $TUNNEL_LOG"; exit 1; }
echo "隧道地址：$URL"

# ── 3. 本地记录（deploy 时 发布到Pages.mjs 会把它写进 dist）──
echo "$URL" > .标注端点

# ── 4. 推单文件到 gh-pages ──
JSON="{\"url\":\"$URL\"}"
CONTENT=$(printf '%s' "$JSON" | base64)
SHA=$(gh api "repos/$REPO/contents/annotate-endpoint.json?ref=gh-pages" --jq .sha 2>/dev/null || true)
if [ -n "$SHA" ]; then
  gh api -X PUT "repos/$REPO/contents/annotate-endpoint.json" \
    -f message="更新标注直达端点" -f content="$CONTENT" -f branch=gh-pages -f sha="$SHA" > /dev/null
else
  gh api -X PUT "repos/$REPO/contents/annotate-endpoint.json" \
    -f message="标注直达端点" -f content="$CONTENT" -f branch=gh-pages > /dev/null
fi
echo "已推送 annotate-endpoint.json 到 gh-pages（Pages 构建约 1 分钟后生效）"
echo "完成：线上标注将直达本机收件箱。"
