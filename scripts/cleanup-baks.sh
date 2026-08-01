#!/bin/bash
# scripts/cleanup-baks.sh
# Round 34 (2026-08-01 13:50+ Hubert 指示) — 雞味客服 production runtime .bak cleanup
#
# 設計：
#   - 保留每個 canonical file 最新的 N 個 .bak 作為 emergency rollback（即時不需 git checkout）
#   - 刪除其他 .bak（避免堆積混淆視聽）
#   - 預設 --keep 1（保留最新 1 個）
#   - 加 --keep 0（或 --all）全部清空
#   - 加 --keep N 保留前 N 個
#   - 預設 dry-run，加 --force 真的清
#   - 預設指向 /home/clawuser/.openclaw/agents/external-user/
#   - 同步給 L1 cleanup-baks.sh（專案內版本）
#
# 用法：
#   bash scripts/cleanup-baks.sh            # dry-run，預設保留 1 個
#   bash scripts/cleanup-baks.sh --force    # 真的清
#   bash scripts/cleanup-baks.sh --keep 0   # 全部清空（dry-run 模式）
#   bash scripts/cleanup-baks.sh --force --keep 0   # 全部清空（真的清）
#   bash scripts/cleanup-baks.sh --keep 3   # 保留 3 個
#   bash scripts/cleanup-baks.sh --verbose  # 顯示每個檔案的 mtime/size

set -euo pipefail

PROD_DIR="${PROD_DIR:-/home/clawuser/.openclaw/agents/external-user}"
KEEP_COUNT=1
DRY_RUN=true
VERBOSE=false

# Parse args (使用 while + shift 模式，確保 --keep N 兩 token 正確處理)
while [ $# -gt 0 ]; do
  case "$1" in
    --force) DRY_RUN=false; shift ;;
    --verbose) VERBOSE=true; shift ;;
    --keep)
      [ -z "${2:-}" ] && { echo "❌ --keep 需要 N 參數"; exit 1; }
      KEEP_COUNT="$2"
      shift 2
      ;;
    --keep=*)
      KEEP_COUNT="${1#--keep=}"
      shift
      ;;
    --all) KEEP_COUNT=0; shift ;;
    --help|-h)
      cat <<EOF
Usage: $0 [--force] [--verbose] [--keep N | --all]

雞味客服 production runtime .bak cleanup

預設行為：dry-run，保留每檔最新 1 個 .bak

Options:
  --force    Actually delete files (default: dry-run)
  --keep N   Keep the latest N .bak files per canonical file (default: 1)
  --all      Same as --keep 0 (delete all .bak files)
  --verbose  Show file ages and details
  --help     Show this help

Environment variables:
  PROD_DIR      Target directory (default: $PROD_DIR)
  KEEP_COUNT    Number of .bak to keep per canonical file (default: 1)

Examples:
  bash scripts/cleanup-baks.sh --verbose           # dry-run with details
  bash scripts/cleanup-baks.sh --force --keep 1    # actually delete, keep 1
  bash scripts/cleanup-baks.sh --force --all       # delete all .bak
EOF
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [ ! -d "$PROD_DIR" ]; then
  echo "❌ PROD_DIR not found: $PROD_DIR"
  exit 1
fi

# Canonical files to clean (每個對應 1 類 .bak)
CANONICALS=(
  "AGENTS.md"
  "SOUL.md"
  "main_idea.md"
)

echo "=== L2 Production Runtime .bak Cleanup ==="
echo "Target: $PROD_DIR"
echo "Keep:   $KEEP_COUNT .bak per canonical file (0 = delete all)"
echo "Mode:   $([ "$DRY_RUN" = true ] && echo "DRY-RUN (use --force to delete)" || echo "FORCE (deleting)")"
echo ""

TOTAL_DELETED=0
TOTAL_SIZE=0
TOTAL_KEPT=0

for canonical in "${CANONICALS[@]}"; do
  # 找所有該檔案的 .bak（AGENTS.md.bak.* / SOUL.md.bak.* / knowledge/main_idea.md.bak.*）
  baks=$(find "$PROD_DIR" -name "${canonical}.bak.*" -type f 2>/dev/null | sort)

  if [ -z "$baks" ]; then
    if [ "$VERBOSE" = true ]; then
      echo "⏸️  $canonical: 沒有 .bak 檔案"
    fi
    continue
  fi

  # 按 mtime 倒序（最新在前）
  sorted_baks=$(echo "$baks" | xargs ls -t 2>/dev/null)

  echo "--- $canonical ---"

  kept=0
  for bak in $sorted_baks; do
    SIZE=$(stat -c %s "$bak" 2>/dev/null || echo 0)
    MTIME=$(stat -c %y "$bak" 2>/dev/null | cut -c1-19)
    kept=$((kept + 1))

    if [ "$kept" -le "$KEEP_COUNT" ]; then
      # 保留
      TOTAL_KEPT=$((TOTAL_KEPT + 1))
      if [ "$VERBOSE" = true ]; then
        echo "  ✓ keep: $bak ($SIZE bytes, $MTIME)"
      fi
    else
      # 刪除
      TOTAL_DELETED=$((TOTAL_DELETED + 1))
      TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
      if [ "$DRY_RUN" = false ]; then
        rm -v "$bak" 2>&1 | sed 's/^/   /'
      elif [ "$VERBOSE" = true ]; then
        echo "  🗑️  delete: $bak ($SIZE bytes, $MTIME)"
      fi
    fi
  done

  if [ "$VERBOSE" = false ] && [ "$kept" -gt "$KEEP_COUNT" ]; then
    DELETED_COUNT=$((kept - KEEP_COUNT))
    echo "  → $DELETED_COUNT 個 .bak 待刪（保留最新 $KEEP_COUNT 個）"
  fi
  echo ""
done

echo "=== Summary ==="
if [ "$DRY_RUN" = true ]; then
  echo "Files to keep: $TOTAL_KEPT"
  echo "Files to delete: $TOTAL_DELETED ($TOTAL_SIZE bytes)"
  echo "Run with --force to actually delete."
else
  echo "Files kept: $TOTAL_KEPT"
  echo "Files deleted: $TOTAL_DELETED ($TOTAL_SIZE bytes freed)"
fi

# Log to memory（真的刪才記）
LOG_FILE="${LOG_FILE:-/home/clawuser/.openclaw/workspace/memory/.bak-cleanup.log}"
if [ "$DRY_RUN" = false ] && [ "$TOTAL_DELETED" -gt 0 ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) deleted=$TOTAL_DELETED kept=$TOTAL_KEPT size=$TOTAL_SIZE" >> "$LOG_FILE"
fi
