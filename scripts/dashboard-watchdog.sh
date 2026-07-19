#!/bin/bash
# dashboard-watchdog.sh — 雞味客服 dashboard tunnel 健康檢查
# Round 14 (2026-07-19 22:50) 修整：
#   - watchdog cron 已停用（Hubert 22:48 處理）
#   - dashboard tunnel 改用 brt1122-System-09 named tunnel（systemd service 自動管理）
#   - 本 script 改為「監控 + 警報」模式，不再自動重啟
#   - 如需手動介入，用 `bash scripts/manage-tunnel.sh restart`
#
# 用途：
#   - 監控 dashboard /healthz 狀態
#   - 監控 cloudflared.service 狀態
#   - 如有異常，記錄到 watchdog.log（供後續追蹤）
#   - 不再自動重啟（named tunnel 由 systemd 自動管理）

LOG=/home/clawuser/.openclaw/dashboard-watchdog.log
HEALTH_URL="http://localhost:3000/healthz"
SYSTEMD_SERVICE=cloudflared.service
NAMED_TUNNEL_NAME=brt1122-System-09

mkdir -p "$(dirname "$LOG")"

check_healthz() {
  local http_code body
  http_code=$(curl -s --max-time 10 -o /tmp/hz_body.txt -w "%{http_code}" "$HEALTH_URL" 2>/dev/null)
  body=$(cat /tmp/hz_body.txt 2>/dev/null | head -c 200)
  echo "[watchdog] $(date -Iseconds) /healthz HTTP $http_code body=$body" >> "$LOG"

  if [ "$http_code" = "200" ]; then
    return 0
  else
    return 1
  fi
}

check_tunnel_service() {
  if systemctl is-active --quiet $SYSTEMD_SERVICE; then
    return 0
  else
    return 1
  fi
}

# 主邏輯：監控 + 記錄
echo "[watchdog] $(date -Iseconds) === 開始監控檢查 ===" >> "$LOG"

# Check 1: dashboard /healthz
if check_healthz; then
  echo "[watchdog] $(date -Iseconds) ✓ dashboard /healthz ok" >> "$LOG"
else
  echo "[watchdog] $(date -Iseconds) ✗ dashboard /healthz 不健康" >> "$LOG"
fi

# Check 2: cloudflared systemd service
if check_tunnel_service; then
  echo "[watchdog] $(date -Iseconds) ✓ cloudflared.service active（tunnel: $NAMED_TUNNEL_NAME）" >> "$LOG"
else
  echo "[watchdog] $(date -Iseconds) ✗ cloudflared.service inactive（需要手動 systemctl restart cloudflared.service）" >> "$LOG"
fi

# Check 3: cleanup leaked cloudflared（保留原本 P0 v7+ 整合）
echo "[watchdog] $(date -Iseconds) cleanup leaked cloudflared processes..." >> "$LOG"
bash "$(cd "$(dirname "$0")" && pwd)/cleanup-leaked-cloudflared.sh" >> "$LOG" 2>&1 || true

# 總結
echo "[watchdog] $(date -Iseconds) === 監控檢查完成 ===" >> "$LOG"

# 注意：本 script 只做監控 + 記錄，不自動重啟
# 如需手動介入：
#   - systemctl status cloudflared.service
#   - bash scripts/manage-tunnel.sh restart
#   - bash scripts/manage-tunnel.sh info
