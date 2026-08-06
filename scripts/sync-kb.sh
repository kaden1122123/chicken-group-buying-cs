#!/bin/bash
# DEPRECATED — Round 38: 合併到 scripts/sync-runtime.sh
# 保留此檔是為了 cron / 舊文件的向後相容,實際工作已由 sync-runtime.sh 完成。
#
# 用法:仍可執行,會自動 delegate 到 sync-runtime.sh

echo "⚠️  sync-kb.sh 已 deprecated (Round 38 整合)"
echo "    請改用: bash scripts/sync-runtime.sh"
echo ""
exec "$(dirname "$0")/sync-runtime.sh" --kb "$@"