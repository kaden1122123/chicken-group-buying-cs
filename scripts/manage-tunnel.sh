#!/bin/bash
# manage-tunnel.sh - 管理 Dashboard + Cloudflare Quick Tunnel
# 設計：在 SSH session 內執行（不是 OpenClaw exec 環境）
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
TUNNEL_LOG=/tmp/quick-tunnel.log
URL_FILE=/tmp/quick-tunnel-url.txt
DASHBOARD_LOG=/tmp/dashboard.log

start() {
  echo "=== 1. 清理舊進程 ==="
  pkill -f "dashboard-server.js" 2>/dev/null || true
  pkill -f "cloudflared tunnel --url http://localhost:$PORT" 2>/dev/null || true
  sleep 2
  ps -ef | grep -E "dashboard-server|cloudflared.*tunnel --url" | grep -v grep || echo "  ✓ 清理完成"
  echo ""

  echo "=== 2. 啟動 Dashboard Server ==="
  cd "$PROJECT_DIR"

  # Session E (2026-07-19) 修整：帶完整 env + 用 _FILE 取代明文密碼
  # 修法理由：
  #   1. dashboard-watchdog.sh 在 /healthz 不健康時會 call 此 start()，
  #      必須帶 WORKER_HEALTH_URL 才能讓 worker=up
  #   2. 用 _FILE 從 ~/.config/chicken/secrets/ 讀檔，避免 process.env 被
  #      OpenClaw exec 自動 redact（明文 PASSWORD 會被遮罩）
  #   3. 帶完整 api-server 相關 env，dashboard-server 才能正確 proxy
  # 對齊：SESSION_NEXT_PROMPT.md「服務重啟 SOP」
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

  # 確認本地可訪問
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" | grep -q 200; then
    echo "  ✓ Dashboard Server 啟動 (http://localhost:$PORT/)"
  else
    echo "  ✗ Dashboard Server 啟動失敗，看 $DASHBOARD_LOG"
    cat $DASHBOARD_LOG | head -10
    return 1
  fi
  echo ""

  echo "=== 3. 啟動 Cloudflare Quick Tunnel ==="
  > $TUNNEL_LOG
  setsid cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" > $TUNNEL_LOG 2>&1 < /dev/null &
  disown
  echo "  ✓ Quick Tunnel 啟動（背景執行）"

  # 等連線
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    sleep 1
    if grep -q "Registered tunnel connection" $TUNNEL_LOG 2>/dev/null; then
      echo "  ✓ 連線已建立（$i 秒）"
      break
    fi
  done

  URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" $TUNNEL_LOG | head -1)
  if [ -z "$URL" ]; then
    echo "  ✗ 沒拿到 URL，看 $TUNNEL_LOG"
    tail -20 $TUNNEL_LOG
    return 1
  fi
  echo "$URL" > $URL_FILE
  echo ""
  echo "  Tunnel URL: $URL"
  echo "  $URL_FILE 已儲存"
  echo ""
  echo "=== 4. 測試訪問 ==="
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
  echo "  公開訪問: $URL"
  echo "  管理後台: $URL/admin (帳號 $USERNAME / 密碼 ********)"
  echo ""
  echo "  注意：此腳本退出後，dashboard + tunnel 進程仍會繼續執行"
  echo "  停止：執行 ./manage-tunnel.sh stop"
}

stop() {
  echo "=== 停止所有進程 ==="
  pkill -f "dashboard-server.js" 2>/dev/null && echo "  ✓ Dashboard Server 停止" || echo "  - Dashboard Server 未在跑"
  pkill -f "cloudflared tunnel --url http://localhost:$PORT" 2>/dev/null && echo "  ✓ Quick Tunnel 停止" || echo "  - Quick Tunnel 未在跑"
  sleep 1
  rm -f $URL_FILE
  echo "  ✓ 清理完成"
}

status() {
  echo "=== 進程狀態 ==="
  ps -ef | grep -E "dashboard-server|cloudflared.*tunnel --url" | grep -v grep || echo "  （無進程在跑）"
  echo ""
  echo "=== 本地可訪問 ==="
  curl -s -o /dev/null -w "  http://localhost:$PORT/ → HTTP %{http_code}\n" "http://localhost:$PORT/" 2>&1 || echo "  ✗ 本地無法訪問"
  echo ""
  if [ -f $URL_FILE ]; then
    URL=$(cat $URL_FILE)
    echo "=== Tunnel URL ==="
    echo "  $URL"
    curl -s -o /dev/null -w "  → HTTP %{http_code}\n" --max-time 10 "$URL/"
  else
    echo "  （未啟動）"
  fi
}

url() {
  if [ -f $URL_FILE ]; then
    cat $URL_FILE
  else
    echo "（未啟動）" >&2
    return 1
  fi
}

test_tunnel() {
  if [ -f $URL_FILE ]; then
    URL=$(cat $URL_FILE)
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
