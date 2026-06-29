#!/bin/bash
# scripts/cleanup-test-orders.sh
#
# Session J3/J4 後的 wrapper — 真正的清理邏輯在 cleanup-test-orders.js。
# 保留 .sh 為了向後相容（既有文件、cron 可能引用 .sh）。
#
# 真正的邏輯（含 PRODUCTION_DATA_PROTECTED 單一來源）：
#   scripts/cleanup-test-orders.js
#   tests/helpers/cleanup.js（PRODUCTION_DATA_PROTECTED 定義處）

set -e
cd "$(dirname "$0")/.."
exec node scripts/cleanup-test-orders.js "$@"
