#!/bin/bash
# scripts/cleanup-test-orders.sh
# 清理測試建立的訂單 CSV（不含真實訂單）
#
# 真實訂單（保留）：
#   - 2026-06-13.csv (PHASE1 第一筆)
#   - 2026-06-16.csv
#
# 測試訂單（刪除）：
#   - 2026-06-18.csv (api-server.test.js mock 用)
#   - 2026-06-26.csv (api-server.test.js 模擬當天)
#   - 其他未來測試建的 .csv
#
# 警告：千萬不要用 'rm data/orders/chicken/2026-06-*.csv' 會把真實訂單也刪掉！

set -e

cd "$(dirname "$0")/.."

ORDERS_DIR="data/orders/chicken"
PROTECTED=("2026-06-13.csv" "2026-06-16.csv")

echo "=== 清理測試訂單 ==="

for f in "$ORDERS_DIR"/*.csv; do
  if [ -f "$f" ]; then
    filename=$(basename "$f")
    skip=false
    for p in "${PROTECTED[@]}"; do
      if [ "$filename" = "$p" ]; then
        skip=true
        break
      fi
    done
    if [ "$skip" = true ]; then
      echo "  保留: $filename（真實訂單）"
    else
      echo "  刪除: $filename（測試訂單）"
      rm "$f"
    fi
  fi
done

echo ""
echo "=== 當前檔案 ==="
ls -la "$ORDERS_DIR"