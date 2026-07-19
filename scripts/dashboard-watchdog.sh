#!/bin/bash
# dashboard-watchdog.sh — 定期檢查 dashboard + tunnel
# 2026-07-01 Session X5-B：改用 /healthz 取代只看 dashboard port
# 2026-07-19 Round 14：新增 Named Tunnel 邏輯（避免不必要重啟 stable named tunnel）

LOG=/home/clawuser/.openclaw/dashboard-watchdog.log
DASHBOARD_URL="http://localhost:3000/"
HEALTH_URL="http://localhost:3000/healthz"
NAMED_TUNNEL_URL_FILE="/tmp/named-tunnel-url.txt"
QUICK_TUNNEL_URL_FILE="/tmp/quick-tunnel-url.txt"
NAMED_TUNNEL_NAME=chicken-dashboard
NAMED_CRED_FILE=/home/clawuser/.cloudflared/${NAMED_TUNNEL_NAME}.json
PROJECT_DIR="/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service"

mkdir -p "$(dirname "$LOG")"

# Round 14：偵測 tunnel mode
if [ -f "$NAMED_CRED_FILE" ]; then
  TUNNEL_MODE="named"
  TUNNEL_URL_FILE="$NAMED_TUNNEL_URL_FILE"
else
  TUNNEL_MODE="quick"
  TUNNEL_URL_FILE="$QUICK_TUNNEL_URL_FILE"
fi

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
    return 1
  else
    return 1
  fi
}

# Round 14：tunnel 檢查邏輯分流
is_tunnel_up() {
  if [ ! -f "$TUNNEL_URL_FILE" ]; then return 1; fi
  local url
  url=$(cat "$TUNNEL_URL_FILE")
  curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url/" | grep -q "200"
}

# Round 14：Named Tunnel process 檢查（PID 1543 模式穩定，不應隨意重啟）
is_named_tunnel_process_alive() {
  pgrep -f "cloudflared tunnel run ${NAMED_TUNNEL_NAME}" > /dev/null
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

# Round 14：Named Tunnel 重啟（如果 process 不在跑但 URL 還有效 → 不重啟）
restart_named_tunnel_if_needed() {
  if ! is_named_tunnel_process_alive; then
    echo "[watchdog] $(date -Iseconds) Named Tunnel process 不在跑，重啟..." >> "$LOG"
    cloudflared --no-autoupdate tunnel --config /home/clawuser/.cloudflared/config.yml run "${NAMED_TUNNEL_NAME}" >> /tmp/named-tunnel.log 2>&1 &
    disown
    sleep 5
    if is_named_tunnel_process_alive; then
      echo "[watchdog] $(date -Iseconds) ✅ Named Tunnel 重啟成功" >> "$LOG"
    else
      echo "[watchdog] $(date -Iseconds) ❌ Named Tunnel 重啟失敗" >> "$LOG"
    fi
  else
    echo "[watchdog] $(date -Iseconds) Named Tunnel 持續穩定（不需重啟）" >> "$LOG"
  fi
}

check_healthz
HEALTH_OK=$?
check_tunnel() { is_tunnel_up; }

# Session P0 v7+：整合 cloudflared leaked processes cleanup
echo "[watchdog] $(date -Iseconds) cleanup leaked cloudflared processes..." >> "$LOG"
bash "$PROJECT_DIR/scripts/cleanup-leaked-cloudflared.sh" >> "$LOG" 2>&1 || true

# Round 14：決策樹分流
if [ $HEALTH_OK -ne 0 ]; then
  # /healthz 不健康 → 重啟 dashboard
  restart_dashboard
elif [ "$TUNNEL_MODE" = "named" ]; then
  # Named Tunnel 模式：/healthz 健康時只檢查 tunnel process
  if ! check_tunnel; then
    echo "[watchdog] $(date -Iseconds) /healthz ok 但 tunnel URL 不可訪問，重啟 Named Tunnel" >> "$LOG"
    restart_named_tunnel_if_needed
  else
    echo "[watchdog] $(date -Iseconds) dashboard /healthz ok + Named Tunnel 都活著（PID stable）" >> "$LOG"
  fi
elif check_tunnel; then
  echo "[watchdog] $(date -Iseconds) dashboard /healthz ok + Quick Tunnel 都活著" >> "$LOG"
else
  # Quick Tunnel 模式：tunnel URL 不可訪問 → 重啟（Quick Tunnel 常掛）
  echo "[watchdog] $(date -Iseconds) /healthz ok 但 Quick Tunnel 掛了，重啟" >> "$LOG"
  bash "$PROJECT_DIR/scripts/manage-tunnel.sh" start >> "$LOG" 2>&1
fi
