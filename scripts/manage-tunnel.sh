#!/bin/bash
# manage-tunnel.sh - Dashboard tunnel 管理
# Round 14 (2026-07-19 22:50) 修整：dashboard tunnel 改用 brt1122-System-09 named tunnel
#   - 之前：Quick Tunnel (--url) 或新建 chicken-dashboard named tunnel
#   - 現在：reuse 已穩定 78+ 天的 brt1122-System-09 named tunnel
#   - 這個 tunnel 由 systemd service (cloudflared.service) 自動管理
#   - watchdog cron 已停用（22:48 Hubert 處理）
#
# 用途：
#   ./manage-tunnel.sh status   # 查看狀態（推薦用法）
#   ./manage-tunnel.sh info     # 看 tunnel 詳細資訊（包含 Dashboard hostname）
#   ./manage-tunnel.sh restart  # 重啟 systemd service（如果 tunnel 異常）
#   ./manage-tunnel.sh start    # 啟動 systemd service
#   ./manage-tunnel.sh stop     # 停止 systemd service

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

NAMED_TUNNEL_NAME=brt1122-System-09
SYSTEMD_SERVICE=cloudflared.service

start() {
  echo "=== 啟動 $SYSTEMD_SERVICE ==="
  sudo systemctl start $SYSTEMD_SERVICE
  sleep 2
  if systemctl is-active --quiet $SYSTEMD_SERVICE; then
    echo "  ✓ $SYSTEMD_SERVICE 啟動成功"
    systemctl status $SYSTEMD_SERVICE --no-pager | head -5
  else
    echo "  ✗ $SYSTEMD_SERVICE 啟動失敗"
    sudo journalctl -u $SYSTEMD_SERVICE --no-pager -n 20
    return 1
  fi
}

stop() {
  echo "=== 停止 $SYSTEMD_SERVICE ==="
  sudo systemctl stop $SYSTEMD_SERVICE
  sleep 1
  if ! systemctl is-active --quiet $SYSTEMD_SERVICE; then
    echo "  ✓ $SYSTEMD_SERVICE 已停止"
  else
    echo "  ✗ $SYSTEMD_SERVICE 仍在跑"
  fi
}

restart() {
  echo "=== 重啟 $SYSTEMD_SERVICE ==="
  sudo systemctl restart $SYSTEMD_SERVICE
  sleep 3
  if systemctl is-active --quiet $SYSTEMD_SERVICE; then
    echo "  ✓ $SYSTEMD_SERVICE 重啟成功"
  else
    echo "  ✗ $SYSTEMD_SERVICE 重啟失敗"
    sudo journalctl -u $SYSTEMD_SERVICE --no-pager -n 20
    return 1
  fi
}

status() {
  echo "=== cloudflared systemd service 狀態 ==="
  if systemctl is-active --quiet $SYSTEMD_SERVICE; then
    echo "  ✓ $SYSTEMD_SERVICE active"
    systemctl status $SYSTEMD_SERVICE --no-pager | head -15
  else
    echo "  ✗ $SYSTEMD_SERVICE inactive"
  fi
  echo ""
  echo "=== cloudflared processes ==="
  ps -eo pid,etime,args | grep cloudflared | grep -v grep | head -5
  echo ""
  echo "=== dashboard 本地連線 ==="
  curl -s -o /dev/null -w "  http://localhost:3000/healthz → HTTP %{http_code}\n" --max-time 5 http://localhost:3000/healthz 2>&1 || echo "  ✗ 本地無法訪問"
}

info() {
  echo "=== Dashboard tunnel 完整資訊 ==="
  echo ""
  echo "## systemd service"
  systemctl status $SYSTEMD_SERVICE --no-pager | head -20
  echo ""
  echo "## cloudflared process"
  ps -eo pid,etime,args | grep cloudflared | grep -v grep | head -5
  echo ""
  echo "## Dashboard Public Hostname（從 Cloudflare Dashboard 設定）"
  echo "  Hostname: dashboard.brt1122.com"
  echo "  Service: http://localhost:3000"
  echo "  Tunnel: $NAMED_TUNNEL_NAME"
  echo ""
  echo "## 驗證 tunnel 是否真正對外提供服務"
  curl -s -o /dev/null -w "  https://dashboard.brt1122.com/healthz → HTTP %{http_code}\n" --max-time 10 https://dashboard.brt1122.com/healthz 2>&1 || echo "  ✗ tunnel 對外無法訪問（檢查 Cloudflare Dashboard Public Hostname 設定）"
}

case "${1:-status}" in
  start)   start ;;
  stop)    stop ;;
  restart) restart ;;
  status)  status ;;
  info)    info ;;
  *)       echo "用法: $0 {start|stop|restart|status|info}"; exit 1 ;;
esac
