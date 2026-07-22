#!/bin/bash
# scripts/key_age_check.sh
# Round 14 P2 (2026-07-19) + Round 15 (2026-07-23) — GCP service account key age 提醒
# 每月 1 號檢查 GCP service account key age
# 超過 60 天就 warn，超過 90 天就 critical（建議 rotate）
#
# 觸發方式 1（建議）：OpenClaw cron 每月 1 號 09:00（見 docs/GCP_ROTATION_SOP.md §7.2）
# 觸發方式 2（手動）：`bash scripts/key_age_check.sh`
# 觸發方式 3（CI）：GitHub Actions 排程
#
# Exit code:
#   0 = OK（< 60 天）
#   1 = WARN（>= 60 天，建議 rotate）
#   2 = CRITICAL（>= 90 天，建議立即 rotate）
#   3 = 檔案不存在

set -euo pipefail

KEY_FILE="${KEY_FILE:-/home/clawuser/.config/chicken/secrets/google-service-account.json}"
WARN_DAYS="${WARN_DAYS:-60}"
CRITICAL_DAYS="${CRITICAL_DAYS:-90}"

if [ ! -f "$KEY_FILE" ]; then
  echo "❌ $KEY_FILE 不存在"
  exit 3
fi

# 計算 mtime 到現在的天數
# 注意：mtime 是檔案 modify time，對 service account JSON 來說 rotate 時檔案會被替換，
#       所以 mtime 近似於 rotate time。
KEY_MTIME_EPOCH=$(stat -c %Y "$KEY_FILE")
NOW_EPOCH=$(date +%s)
KEY_AGE_DAYS=$(( (NOW_EPOCH - KEY_MTIME_EPOCH) / 86400 ))

# 額外報告：Gmail credentials
GMAIL_FILE="${GMAIL_FILE:-/home/clawuser/.config/chicken/secrets/gmail-credentials.json}"
GMAIL_AGE_DAYS="N/A"
if [ -f "$GMAIL_FILE" ]; then
  GMAIL_MTIME_EPOCH=$(stat -c %Y "$GMAIL_FILE")
  GMAIL_AGE_DAYS=$(( (NOW_EPOCH - GMAIL_MTIME_EPOCH) / 86400 ))
fi

if [ "$KEY_AGE_DAYS" -ge "$CRITICAL_DAYS" ]; then
  echo "🔴 CRITICAL: GCP service account key 已 ${KEY_AGE_DAYS} 天（>${CRITICAL_DAYS}天，建議立即 rotate）"
  echo "   檔案: $KEY_FILE"
  echo "   mtime: $(stat -c '%y' "$KEY_FILE")"
  echo "   Gmail credentials: ${GMAIL_AGE_DAYS} 天"
  echo "   動作：見 docs/GCP_ROTATION_SOP.md §2 (6 步手動 rotate)"
  exit 2
elif [ "$KEY_AGE_DAYS" -ge "$WARN_DAYS" ]; then
  echo "🟡 WARN: GCP service account key 已 ${KEY_AGE_DAYS} 天（>${WARN_DAYS}天，建議 rotate）"
  echo "   檔案: $KEY_FILE"
  echo "   mtime: $(stat -c '%y' "$KEY_FILE")"
  echo "   Gmail credentials: ${GMAIL_AGE_DAYS} 天"
  echo "   動作：見 docs/GCP_ROTATION_SOP.md §2"
  exit 1
else
  echo "🟢 OK: GCP service account key ${KEY_AGE_DAYS} 天（<${WARN_DAYS}天）"
  echo "   檔案: $KEY_FILE"
  echo "   mtime: $(stat -c '%y' "$KEY_FILE")"
  echo "   Gmail credentials: ${GMAIL_AGE_DAYS} 天"
  exit 0
fi