#!/bin/bash
# manage-tunnel.sh - 管理 Dashboard + Cloudflare Tunnel
# 設計：在 SSH session 內執行（不是 OpenClaw exec 環境）
#
# Round 14 (2026-07-19)：新增 Named Tunnel 優先模式
#   - Named Tunnel: 固定 URL、不 zombie、不會 server-side close（推薦）
#   - Quick Tunnel: 隨機 URL、會 zombie、需要重啟（fallback）
#   - 自動偵測：若 ~/.cloudflared/chicken-dashboard.json 存在 → Named
#                若不存在 → Quick Tunnel fallback
#
# 用法：
#   ./manage-tunnel.sh start    # 啟動 dashboard + tunnel
#   ./manage-tunnel.sh stop     # 停止
#   ./manage-tunnel.sh status   # 查看狀態
#   ./manage-tunnel.sh url      # 拿現在的 tunnel URL
#   ./manage-tunnel.sh test     # 測試 tunnel 訪問

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"  # 專案根目錄（原位置）
# 注意：如果在主位置執行，請把 PROJECT_DIR 改為主位置路徑

PORT=3000
USERNAME=${DASHBOARD_USERNAME:-admin}
PASSWORD=${DASHBOARD_PASSWORD:-***}
DASHBOARD_LOG=/tmp/dashboard.log

# Named Tunnel 設定（Round 14）
NAMED_TUNNEL_NAME=chicken-dashboard
NAMED_CRED_FILE=/home/clawuser/.cloudflared/${NAMED_TUNNEL_NAME}.json
NAMED_CONFIG_FILE=/home/clawuser/.cloudflared/config.yml
NAMED_URL_FILE=/tmp/named-tunnel-url.txt
NAMED_TUNNEL_LOG=/tmp/named-tunnel.log
NAMED_DOMAIN=${NAMED_DOMAIN:-dashboard.brt1122.com}  # 由 Hubert 在 Cloudflare Dashboard 設定

# Quick Tunnel 設定（fallback）
QUICK_URL_FILE=/tmp/quick-tunnel-url.txt
QUICK_TUNNEL_LOG=/tmp/quick-tunnel.log

# 偵測目前使用哪種 tunnel
if [ -f "$NAMED_CRED_FILE" ]; then
  TUNNEL_MODE="named"
  URL_FILE="$NAMED_URL_FILE"
  TUNNEL_LOG="$NAMED_TUNNEL_LOG"
else
  TUNNEL_MODE="quick"
  URL_FILE="$QUICK_URL_FILE"
  TUNNEL_LOG="$QUICK_TUNNEL_LOG"
fi

start() {
  echo "=== 1. 清理舊進程 ==="
  pkill -f "dashboard-server.js" 2>/dev/null || true
  pkill -f "cloudflared tunnel --url http://localhost:$PORT" 2>/dev/null || true
  pkill -f "cloudflared tunnel --config.*$NAMED_TUNNEL_NAME" 2>/dev/null || true
  sleep 2
  ps -ef | grep -E "dashboard-server|cloudflared" | grep -v grep || echo "  ✓ 清理完成"
  echo ""

  echo "=== 2. 啟動 Dashboard Server ==="
  cd "$PROJECT_DIR"

  # Round 10 修整：帶完整 env + 用 _FILE 取代明文密碼
  setsid env \
    DASHBOARD_USERNAME="$USERNAME" \
    DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd \
    API_USERNAME=api-user \
    API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
    X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token \
    WORKER_HEALTH_URL=http://127.0.0.1:3001/api/health \
    PORT=$PORT \
    node scripts/dashboard-server.js > $DASHBOARD_LOG 2>&1 < /dev/null &
  disown
  sleep 2

  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" | grep -q 200; then
    echo "  ✓ Dashboard Server 啟動 (http://localhost:$PORT/)"
  else
    echo "  ✗ Dashboard Server 啟動失敗，看 $DASHBOARD_LOG"
    cat $DASHBOARD_LOG | head -10
    return 1
  fi
  echo ""

  echo "=== 3. 啟動 Cloudflare Tunnel（模式: $TUNNEL_MODE）==="
  if [ "$TUNNEL_MODE" = "named" ]; then
    start_named_tunnel
  else
    start_quick_tunnel
  fi
  echo ""

  echo "=== 4. 測試訪問 ==="
  if [ -f "$URL_FILE" ]; then
    URL=$(cat "$URL_FILE")
    for endpoint in "/" "/admin" "/api/data"; do
      if [ "$endpoint" = "/" ]; then
        code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL$endpoint")
      else
        code=$(curl -s -o /dev/null -w "%{http_code}" -u "$USERNAME:$PASSWORD" --max-time 10 "$URL$endpoint")
      fi
      echo "  GET $endpoint → HTTP $code"
    done
    echo ""
    echo "=== 啟動完成 ==="
    echo "  Tunnel 模式: $TUNNEL_MODE"
    echo "  公開訪問: $URL"
    echo "  管理後台: $URL/admin (帳號 $USERNAME / 密碼 ********)"
    echo ""
    echo "  注意：此腳本退出後，dashboard + tunnel 進程仍會繼續執行"
    echo "  停止：執行 ./manage-tunnel.sh stop"
  else
    echo "  ✗ URL_FILE 不存在，tunnel 啟動失敗"
    return 1
  fi
}

start_named_tunnel() {
  echo "  使用 Named Tunnel（固定 URL，穩定）"
  if [ ! -f "$NAMED_CONFIG_FILE" ]; then
    echo "  ✗ $NAMED_CONFIG_FILE 不存在"
    echo "  請參考 docs/NAMED_TUNNEL_MIGRATION.md 建立 named tunnel"
    return 1
  fi

  # 啟動 named tunnel
  > $TUNNEL_LOG
  setsid cloudflared --no-autoupdate tunnel --config "$NAMED_CONFIG_FILE" run "$NAMED_TUNNEL_NAME" > $TUNNEL_LOG 2>&1 < /dev/null &
  disown
  sleep 3

  # Named Tunnel 用固定 hostname（從 config.yml 讀取）
  # 簡化版：使用環境變數或預設值
  URL="https://${NAMED_DOMAIN}"
  echo "$URL" > "$URL_FILE"
  echo "  ✓ Named Tunnel 啟動，URL: $URL"

  # 驗證連線
  for i in 1 2 3 4 5; do
    sleep 2
    if grep -q "Connection established" $TUNNEL_LOG 2>/dev/null; then
      echo "  ✓ 連線已建立（$((i*2+3)) 秒）"
      break
    fi
  done
}

start_quick_tunnel() {
  echo "  使用 Quick Tunnel（隨機 URL，fallback）"
  > $TUNNEL_LOG
  setsid cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" > $TUNNEL_LOG 2>&1 < /dev/null &
  disown
  echo "  ✓ Quick Tunnel 啟動（背景執行）"

  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    sleep 1
    if grep -q "Registered tunnel connection" $TUNNEL_LOG 2>/dev/null; then
      echo "  ✓ 連線已建立（$i 秒）"
      break
    fi
  done

  local URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" $TUNNEL_LOG | head -1)
  if [ -z "$URL" ]; then
    echo "  ✗ 沒拿到 URL，看 $TUNNEL_LOG"
    tail -20 $TUNNEL_LOG
    return 1
  fi
  echo "$URL" > "$URL_FILE"
  echo "  Tunnel URL: $URL"
}

stop() {
  echo "=== 停止所有進程 ==="
  pkill -f "dashboard-server.js" 2>/dev/null && echo "  ✓ Dashboard Server 停止" || echo "  - Dashboard Server 未在跑"
  pkill -f "cloudflared tunnel --url" 2>/dev/null && echo "  ✓ Quick Tunnel 停止" || echo "  - Quick Tunnel 未在跑"
  pkill -f "cloudflared tunnel --config.*$NAMED_TUNNEL_NAME" 2>/dev/null && echo "  ✓ Named Tunnel 停止" || echo "  - Named Tunnel 未在跑"
  sleep 1
  rm -f "$NAMED_URL_FILE" "$QUICK_URL_FILE"
  echo "  ✓ 清理完成"
}

status() {
  echo "=== 進程狀態 ==="
  ps -ef | grep -E "dashboard-server|cloudflared" | grep -v grep || echo "  （無進程在跑）"
  echo ""
  echo "=== 本地可訪問 ==="
  curl -s -o /dev/null -w "  http://localhost:$PORT/ → HTTP %{http_code}\n" "http://localhost:$PORT/" 2>&1 || echo "  ✗ 本地無法訪問"
  echo ""
  echo "=== Tunnel 模式 ==="
  echo "  當前: $TUNNEL_MODE"
  echo "  Named credentials: $([ -f "$NAMED_CRED_FILE" ] && echo "存在" || echo "缺失（fallback 到 Quick Tunnel）")"
  echo ""
  if [ -f "$URL_FILE" ]; then
    URL=$(cat "$URL_FILE")
    echo "=== Tunnel URL ==="
    echo "  $URL"
    curl -s -o /dev/null -w "  → HTTP %{http_code}\n" --max-time 10 "$URL/"
  else
    echo "  （未啟動）"
  fi
}

url() {
  if [ -f "$URL_FILE" ]; then
    cat "$URL_FILE"
  else
    echo "（未啟動）" >&2
    return 1
  fi
}

test_tunnel() {
  if [ -f "$URL_FILE" ]; then
    URL=$(cat "$URL_FILE")
    echo "=== 測試 $URL ==="
    echo "  GET /:           $(curl -s -o /dev/null -w 'HTTP %{http_code}' --max-time 10 $URL/)"
    echo "  GET /admin:      $(curl -s -o /dev/null -w 'HTTP %{http_code}' -u $USERNAME:$PASSWORD --max-time 10 $URL/admin)"
    echo "  GET /api/data:   $(curl -s -o /dev/null -w 'HTTP %{http_code}' -u $USERNAME:$PASSWORD --max-time 10 $URL/api/data)"
  else
    echo "  ✗ URL_FILE 不存在，請先 start"
    return 1
  fi
}

case "${1:-status}" in
  start)   start ;;
  stop)    stop ;;
  status)  status ;;
  url)     url ;;
  test)    test_tunnel ;;
  *)       echo "用法: $0 {start|stop|status|url|test}"; exit 1 ;;
esac
