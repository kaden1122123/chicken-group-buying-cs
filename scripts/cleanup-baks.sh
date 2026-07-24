#!/bin/bash
# scripts/cleanup-baks.sh
# Round 19 (2026-07-24 10:50+) — 雞味客服 production runtime .bak cleanup
#
# 設計：
#   - L2 SOP §I-5: 7 天 buffer（檔案 > 7 天才清）
#   - 目標目錄：~/.openclaw/agents/external-user/ (production runtime canonical)
#   - 清的對象：AGENTS.md.bak.* / SOUL.md.bak.* / knowledge/main_idea.md.bak.* / SOUL.md.old.bak
#   - 模式：dry-run 預設（不真清，先看會清哪些）
#
# 用法：
#   bash scripts/cleanup-baks.sh           # dry-run，看會清什麼
#   bash scripts/cleanup-baks.sh --force   # 真的清
#   bash scripts/cleanup-baks.sh --verbose # 顯示每個檔案的年齡

set -euo pipefail

PROD_DIR="${PROD_DIR:-/home/clawuser/.openclaw/agents/external-user}"
BUFFER_DAYS="${BUFFER_DAYS:-7}"
DRY_RUN=true
VERBOSE=false

# Parse args
for arg in "$@"; do
  case "$arg" in
    --force) DRY_RUN=false ;;
    --verbose) VERBOSE=true ;;
    --help|-h)
      cat <<EOF
Usage: $0 [--force] [--verbose]

L2 SOP §I-5: cleanup production runtime .bak files older than BUFFER_DAYS (default: 7)

Options:
  --force    Actually delete files (default: dry-run)
  --verbose  Show file ages and details
  --help     Show this help

Environment variables:
  PROD_DIR      Target directory (default: $PROD_DIR)
  BUFFER_DAYS   Days to keep (default: $BUFFER_DAYS)

Examples:
  bash scripts/cleanup-baks.sh --verbose    # dry-run with details
  bash scripts/cleanup-baks.sh --force      # actually delete
EOF
      exit 0
      ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

if [ ! -d "$PROD_DIR" ]; then
  echo "❌ PROD_DIR not found: $PROD_DIR"
  exit 1
fi

# Find .bak files older than BUFFER_DAYS
echo "=== L2 .bak Cleanup ==="
echo "Target: $PROD_DIR"
echo "Buffer: $BUFFER_DAYS days"
echo "Mode:   $([ "$DRY_RUN" = true ] && echo "DRY-RUN (use --force to delete)" || echo "FORCE (deleting)")"
echo ""

TOTAL_DELETED=0
TOTAL_SIZE=0

# Pattern: *.bak.* (e.g., AGENTS.md.bak.20260723-025017) or *.old.bak
PATTERNS=(
  "$PROD_DIR"/*.bak.*
  "$PROD_DIR"/*/*.bak.*
  "$PROD_DIR"/*.old.bak
)

for pattern in "${PATTERNS[@]}"; do
  for file in $pattern; do
    [ -f "$file" ] || continue
    MTIME_EPOCH=$(stat -c %Y "$file" 2>/dev/null || echo 0)
    NOW_EPOCH=$(date +%s)
    AGE_DAYS=$(( (NOW_EPOCH - MTIME_EPOCH) / 86400 ))
    SIZE=$(stat -c %s "$file" 2>/dev/null || echo 0)

    if [ "$AGE_DAYS" -gt "$BUFFER_DAYS" ]; then
      if [ "$VERBOSE" = true ]; then
        echo "🗑️  [$AGE_DAYS 天 old, $SIZE bytes] $file"
      fi
      if [ "$DRY_RUN" = false ]; then
        rm -v "$file" 2>&1 | sed 's/^/   /'
      fi
      TOTAL_DELETED=$((TOTAL_DELETED + 1))
      TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
    elif [ "$VERBOSE" = true ]; then
      echo "⏸️  [$AGE_DAYS 天 old, 在 buffer 內] $file"
    fi
  done
done

echo ""
echo "=== Summary ==="
if [ "$DRY_RUN" = true ]; then
  echo "Files to delete: $TOTAL_DELETED ($TOTAL_SIZE bytes)"
  echo "Run with --force to actually delete."
else
  echo "Files deleted: $TOTAL_DELETED ($TOTAL_SIZE bytes freed)"
fi

# Log to memory
LOG_FILE="${LOG_FILE:-/home/clawuser/.openclaw/workspace/memory/.bak-cleanup.log}"
if [ "$DRY_RUN" = false ] && [ "$TOTAL_DELETED" -gt 0 ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) deleted=$TOTAL_DELETED size=$TOTAL_SIZE" >> "$LOG_FILE"
fi