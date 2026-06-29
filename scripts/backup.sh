#!/bin/bash
# scripts/backup.sh — Session M1
#
# 備份雞味客服的關鍵資料：
#   - data/orders/         訂單 CSV（包含真實訂單）
#   - knowledge/tenants/   知識庫 baseline
#   - config/tenants/      tenant 配置
#
# 目標位置：~/.backups/chicken/YYYY-MM-DD/chicken-backup-YYYYMMDD-HHMMSS.tar.gz
#
# 用法：
#   bash scripts/backup.sh           # 預設備份到 ~/.backups/chicken/
#   BACKUP_ROOT=/tmp/backups bash scripts/backup.sh  # 自訂備份根目錄
#
# Session M3（含 rotation）：
#   跑完備份後，刪除 7 天前的備份目錄（find -mtime +7 -type d -exec rm -rf）
#   保留策略：每日 1 個檔案，7 天後自動清掉。

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

BACKUP_ROOT="${BACKUP_ROOT:-$HOME/.backups/chicken}"
TODAY="$(date +%Y-%m-%d)"
TS="$(date +%Y%m%d-%H%M%S)"
DEST_DIR="${BACKUP_ROOT}/${TODAY}"
ARCHIVE="${DEST_DIR}/chicken-backup-${TS}.tar.gz"

mkdir -p "$DEST_DIR"

echo "[backup] 開始備份"
echo "[backup]   source: $PROJECT_ROOT (data/orders, knowledge/tenants, config/tenants)"
echo "[backup]   target: $ARCHIVE"

# Step 1：建立 archive
tar -czf "$ARCHIVE" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dashboard.tmp.html' \
    -C "$PROJECT_ROOT" \
    data/orders/ \
    knowledge/tenants/ \
    config/tenants/

# Step 2：驗證 archive 可解
if ! tar -tzf "$ARCHIVE" > /dev/null 2>&1; then
    echo "[backup] ERROR: archive verification failed: $ARCHIVE" >&2
    exit 1
fi

# Step 3：統計
size=$(du -h "$ARCHIVE" | cut -f1)
file_count=$(tar -tzf "$ARCHIVE" | wc -l)
echo "[backup] 成功"
echo "[backup]   archive: $ARCHIVE"
echo "[backup]   size: $size"
echo "[backup]   files: $file_count"

# Step 4：rotation — 刪除超過 7 天的備份（Session M3）
# 用 -mtime +7 匹配修改時間超過 7*24 小時前的目錄
# 用 -maxdepth 1 確保只刪 BACKUP_ROOT 直接子目錄（YYYY-MM-DD/），
# 不影響其他位置的東西
DELETED=$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +7 -print -exec rm -rf {} + 2>/dev/null | wc -l || echo "0")
echo "[backup] rotation: 刪除 $DELETED 個超過 7 天的備份目錄"
