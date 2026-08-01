#!/bin/bash
# sync-producer-config.sh
# Round 32 Phase 2 (Hubert 2026-08-01 09:58)：LEGACY 為 source of truth，
# 自動 sync chicken.yaml 到 PRIMARY（production runtime）。
#
# 設計：
# - 用戶編輯 LEGACY（/home/clawuser/openclaw-workspace/.../config/tenants/chicken.yaml）
# - 每 1 分鐘 cron 檢查 LEGACY 是否比 PRIMARY 新 → cp 過去
# - chicken.js 每次 getOpenDates() 都會重讀 disk，不需重啟 gateway
# - dashboard admin endpoint 仍可用（line 53-66 updateTenantConfig）作為備援
#
# 加入 cron：
#   * * * * * /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/scripts/sync-producer-config.sh >> /tmp/chicken-config-sync.log 2>&1

set -eu

LEGACY_BASE="/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service"
PRIMARY_BASE="/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service"

LEGACY_CONFIG="${LEGACY_BASE}/config/tenants/chicken.yaml"
PRIMARY_CONFIG="${PRIMARY_BASE}/config/tenants/chicken.yaml"

LOG_PREFIX="[sync-config $(date '+%Y-%m-%d %H:%M:%S')]"

if [ ! -f "$LEGACY_CONFIG" ]; then
  echo "$LOG_PREFIX ERROR: $LEGACY_CONFIG not found"
  exit 1
fi

# Sync chicken.yaml if LEGACY is newer (or PRIMARY doesn't exist)
if [ ! -f "$PRIMARY_CONFIG" ] || [ "$LEGACY_CONFIG" -nt "$PRIMARY_CONFIG" ]; then
  cp "$LEGACY_CONFIG" "$PRIMARY_CONFIG"
  echo "$LOG_PREFIX Synced chicken.yaml → PRIMARY"
  exit 0
fi

# No change needed
echo "$LOG_PREFIX No changes (LEGACY == PRIMARY)"
exit 0
