#!/bin/bash
# dashboard-watchdog.sh — 每 10 分鐘檢查 dashboard + tunnel
# 2026-07-01 Session R 修整：log 寫到 home（避免 /tmp 被清）

LOG=/home/clawuser/.openclaw/dashboard-watchdog.log
DASHBOARD_URL="http://localhost:3000/"
TUNNEL_URL_FILE="/tmp/quick-tunnel-url.txt"
PROJECT_DIR="/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service"

mkdir -p "$(dirname "$LOG")"

is_dashboard_up() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$DASHBOARD_URL" | grep -q "200"
}

is_tunnel_up() {
  if [ ! -f "$TUNNEL_URL_FILE" ]; then return 1; fi
  local url
  url=$(cat "$TUNNEL_URL_FILE")
  curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url/" | grep -q "200"
}

restart_dashboard() {
  echo "[watchdog] $(date -Iseconds) dashboard/tunnel 掛了，重啟中..." >> "$LOG"
  bash "$PROJECT_DIR/scripts/manage-tunnel.sh" start >> "$LOG" 2>&1
  sleep 8
  if is_dashboard_up && is_tunnel_up; then
    echo "[watchdog] $(date -Iseconds) ✅ 重啟成功" >> "$LOG"
  else
    echo "[watchdog] $(date -Iseconds) ❌ 重啟失敗，需手動檢查" >> "$LOG"
  fi
}

if is_dashboard_up && is_tunnel_up; then
  echo "[watchdog] $(date -Iseconds) dashboard + tunnel 都活著" >> "$LOG"
else
  restart_dashboard
fi
