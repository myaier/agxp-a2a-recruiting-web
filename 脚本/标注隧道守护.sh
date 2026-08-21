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
  pkill -f "cloudflared tunnel" 2>/dev/null || true
  sleep 1
  # v6（2026-08-20）：--edge-ip-version 4 绕开坏的 IPv6 路径；
  # --protocol http2 走 TCP 443（QUIC/UDP 在本网络会出现「注册成功但隧道 000」）
  nohup cloudflared tunnel --edge-ip-version 4 --protocol http2 --url http://localhost:8090 > "$TUNNEL_LOG" 2>&1 &
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
  # v7（2026-08-20）：先验活再推 —— 注册成功≠隧道能服务（Clash fake-ip 拦截边缘连接时
  # 就是「拿到地址但 000」）。给 30 秒预热窗口，验不过就不推，留待下轮重试。
  local ok=""
  for _ in $(seq 1 10); do
    sleep 3
    if 探活 "$url"; then ok=1; break; fi
  done
  if [ -z "$ok" ]; then
    echo "新隧道注册成功但服务不通，拒推：$url"
    return 1
  fi
  # v8（2026-08-21）：PUT 必须验成功。旧版把 gh api 的输出丢进 /dev/null 且不看返回码，
  # 于是 `npm run deploy` 强推 gh-pages 之后 sha 失效、PUT 报 409，脚本却照样宣布成功 ——
  # 线上从此指着一个死地址，而主循环以为已经更新过，再也不会重推。
  # 每次都重取 sha 后再 PUT，最多三轮；PUT 完回读 gh-pages 上的实际内容做确认。
  local content ROUND
  content=$(printf '{"url":"%s"}' "$url" | base64)
  for ROUND in 1 2 3; do
    # sha 现取现用：deploy 的整站强推随时会让上一轮取到的 sha 作废。
    # 不用数组传参 —— macOS 自带 bash 3.2，分支写开最稳。
    local sha PUT_OK=""
    sha=$(gh api "repos/$REPO/contents/annotate-endpoint.json?ref=gh-pages" --jq .sha 2>/dev/null || true)
    if [ -n "$sha" ]; then
      gh api -X PUT "repos/$REPO/contents/annotate-endpoint.json" \
        -f message="守护：更新标注直达端点" -f content="$content" -f branch=gh-pages -f sha="$sha" \
        > /dev/null 2>&1 && PUT_OK=1
    else
      gh api -X PUT "repos/$REPO/contents/annotate-endpoint.json" \
        -f message="守护：标注直达端点" -f content="$content" -f branch=gh-pages \
        > /dev/null 2>&1 && PUT_OK=1
    fi
    if [ -n "$PUT_OK" ]; then
      # gh api 返回 0 就是权威成功信号 —— GitHub 已经回了新 commit。
      # 这里**不再**立刻回读比对：GitHub contents API 写后立刻读会拿到旧内容
      # （读写一致性有延迟），第一版 v8 把这个当成失败，结果连锁触发
      # CUR_URL="" → 下一轮杀掉健康隧道重开 → 每分钟换一条地址的抖动循环。
      # 对账交给主循环下一轮做，那时延迟早已过去，且不会误伤隧道。
      # .标注端点 只在推成功后才写：deploy 会拿它填 dist/annotate-endpoint.json，
      # 写早了会让下一次 deploy 把没推成功的地址当成真相带上线。
      echo "$url" > .标注端点
      return 0
    fi
    sleep 2
  done
  echo "端点 PUT 三轮均未确认成功，拒绝宣布更新：$url"
  return 1
}

# ── 主循环 ──
#
# v8 的核心教训（2026-08-21 栽过一次）：**「隧道活不活」与「线上发布对不对」是两件事，
# 必须分成两个状态变量。** 第一版 v8 把它们混在一个 CUR_URL 里，发布失败就把它清空，
# 下一轮探活自然不过 → 杀掉一条**完全健康**的隧道重开 → 新地址又发布失败 →
# 每分钟换一条地址的抖动循环。发布出问题，永远不该动隧道。
#
#   隧道URL   —— 当前这条隧道的地址，只在它真的探不活时才换
#   已发布URL —— 已确认推上 gh-pages 的地址，只影响「要不要再推一次」
TUNNEL_URL=""
PUBLISHED_URL=$(cat .标注端点 2>/dev/null || true)
# 进程刚起来时先认领已有的隧道：脚本重启不该无谓地把在跑的隧道也换掉
if [ -n "$PUBLISHED_URL" ] && 探活 "$PUBLISHED_URL"; then
  TUNNEL_URL="$PUBLISHED_URL"
fi

while true; do
  # 收集服务也顺带看护：没在跑就拉起来
  if ! curl -s -m 2 http://localhost:8090/ > /dev/null 2>&1; then
    nohup node 脚本/标注收集服务.mjs > "$LOG_DIR/标注服务.log" 2>&1 &
    sleep 1
    echo "收集服务重启"
  fi

  # ① 隧道健康：只有真的探不活才重开
  if [ -z "$TUNNEL_URL" ] || ! 探活 "$TUNNEL_URL"; then
    NEW_URL=$(重开隧道)
    if [ -n "$NEW_URL" ]; then
      TUNNEL_URL="$NEW_URL"
      PUBLISHED_URL=""   # 换了隧道，之前发布的必然过期
    else
      echo "隧道重开失败，60 秒后再试"
      sleep 60
      continue
    fi
  fi

  # ② 线上对账：拿 gh-pages 上的实际内容比，而不是比脚本自己的记账 ——
  #    npm run deploy 的整站强推会把端点文件冲回旧值，只信记账就发现不了。
  ONLINE_URL=$(gh api "repos/$REPO/contents/annotate-endpoint.json?ref=gh-pages" --jq '.content' 2>/dev/null | base64 -d 2>/dev/null | sed 's/.*"url":"\([^"]*\)".*/\1/' || true)

  if [ "$ONLINE_URL" != "$TUNNEL_URL" ]; then
    [ -n "$ONLINE_URL" ] && echo "线上端点与当前隧道不一致（线上 $ONLINE_URL），重推"
    if 推端点 "$TUNNEL_URL"; then
      PUBLISHED_URL="$TUNNEL_URL"
      echo "端点已更新 $TUNNEL_URL"
    fi
    # 推失败什么都不做：隧道照旧活着，下一轮再试。绝不因发布失败去动隧道。
  else
    PUBLISHED_URL="$TUNNEL_URL"
  fi

  sleep 60
done
