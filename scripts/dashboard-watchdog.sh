#!/bin/bash
# dashboard-watchdog.sh — 每 10 分鐘檢查 dashboard + tunnel
# 2026-07-01 Session X5-B：改用 /healthz 取代只看 dashboard port

LOG=/home/clawuser/.openclaw/dashboard-watchdog.log
DASHBOARD_URL="http://localhost:3000/"
HEALTH_URL="http://localhost:3000/healthz"
TUNNEL_URL_FILE="/tmp/quick-tunnel-url.txt"
PROJECT_DIR="/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service"

mkdir -p "$(dirname "$LOG")"

# Session X5-B：改為檢查 /healthz 統一端點
# /healthz 會 ping api_server + Worker，回報 status ok/degraded
check_healthz() {
  local http_code body
  http_code=$(curl -s --max-time 10 -o /tmp/hz_body.txt -w "%{http_code}" "$HEALTH_URL" 2>/dev/null)
  body=$(cat /tmp/hz_body.txt 2>/dev/null | head -c 300)
  echo "[watchdog] $(date -Iseconds) /healthz HTTP $http_code body=$body" >> "$LOG"

  if [ "$http_code" = "200" ]; then
    return 0
  elif [ "$http_code" = "503" ]; then
    # 503 = degraded：dashboard 還活著但其他 service 有問題
    # 仍視為需要警示
    return 1
  else
    # 完全連不上 / 其他錯誤
    return 1
  fi
}

is_tunnel_up() {
  if [ ! -f "$TUNNEL_URL_FILE" ]; then return 1; fi
  local url
  url=$(cat "$TUNNEL_URL_FILE")
  curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url/" | grep -q "200"
}

restart_dashboard() {
  echo "[watchdog] $(date -Iseconds) dashboard /healthz 不健康，重啟中..." >> "$LOG"
  bash "$PROJECT_DIR/scripts/manage-tunnel.sh" start >> "$LOG" 2>&1
  sleep 8
  if curl -s --max-time 5 -o /dev/null -w "%{http_code}" "$DASHBOARD_URL" | grep -q "200"; then
    echo "[watchdog] $(date -Iseconds) ✅ 重啟成功（dashboard back up）" >> "$LOG"
  else
    echo "[watchdog] $(date -Iseconds) ❌ 重啟失敗，需手動檢查" >> "$LOG"
  fi
}

check_healthz
HEALTH_OK=$?
check_tunnel() { is_tunnel_up; }

if [ $HEALTH_OK -eq 0 ] && check_tunnel; then
  echo "[watchdog] $(date -Iseconds) dashboard /healthz ok + tunnel 都活著" >> "$LOG"
elif [ $HEALTH_OK -eq 0 ]; then
  echo "[watchdog] $(date -Iseconds) /healthz ok 但 tunnel 掛了" >> "$LOG"
  bash "$PROJECT_DIR/scripts/manage-tunnel.sh" start >> "$LOG" 2>&1
else
  restart_dashboard
fi
