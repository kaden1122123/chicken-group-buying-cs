#!/bin/bash
# scripts/sync-kb.sh
# Round 37.31 (Hubert 16:04) 修：同步 L1 KB 到 L3
# 為什麼：sync-canonical.sh 只同步 canonical files（AGENTS/SOUL/main_idea）
# 缺漏：knowledge/tenants/chicken/*.md（菜單、流程、付款、配送等）沒同步到 L3
# 結果：LLM 在 L3 執行時讀不到菜單 → 說「菜單資料讀不到」
# 修法：開新 sync-kb.sh 把 L1 的 knowledge/ 整個 mirror 到 L3

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
L1_KB="$PROJECT_ROOT/knowledge/tenants"
L3_KB="/home/clawuser/.openclaw/agents/external-user/knowledge/tenants"

if [ ! -d "$L1_KB" ]; then
  echo "❌ L1 KB 不存在：$L1_KB"
  exit 1
fi

# 確保 L3 目標目錄存在
mkdir -p "$L3_KB"

# 用 rsync mirror L1 → L3（保留子目錄結構）
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$L1_KB/" "$L3_KB/"
  echo "✅ rsync mirror 完成：L1 → L3"
else
  echo "⚠️  rsync 不可用，用 cp fallback"
  cp -r "$L1_KB"/* "$L3_KB/"
fi

# 驗證：列 L3 的 KB 檔案
echo ""
echo "=== L3 KB 驗證 ==="
ls -la "$L3_KB/chicken/" 2>/dev/null | head -15
echo ""
echo "總計：$(find "$L3_KB" -name '*.md' 2>/dev/null | wc -l) 個 KB .md 檔案已同步到 L3"
