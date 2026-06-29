#!/bin/bash
# sync-mirror.sh
# 同步雞肉專案兩個鏡像位置
#
# 用法：
#   $0 from-primary|from-legacy [--dry-run] [其他 rsync 選項]
#
# --dry-run：只顯示會動到的檔案清單，不真的同步（Session J1 - 安全改善）
# 其他 rsync 選項：直接傳遞給 rsync（例如 --exclude-from、--exclude）
#
# 範例：
#   $0 from-legacy --dry-run               # 預覽從原位置同步到主位置會做什麼
#   $0 from-legacy --dry-run --exclude='*.tmp'

set -e

PRIMARY=/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service
LEGACY=/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service

DIRECTION=""
DRY_RUN=false
RSYNC_EXTRA=()

# 解析參數
while [[ $# -gt 0 ]]; do
  case "$1" in
    from-primary|from-legacy)
      DIRECTION="$1"
      shift
      ;;
    --dry-run|-n)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      echo "用法: $0 [from-primary|from-legacy] [--dry-run] [rsync 選項]"
      echo ""
      echo "  from-primary: 從主位置（external-user workspace）同步到原位置（openclaw-workspace）"
      echo "  from-legacy:  從原位置同步到主位置"
      echo "  --dry-run:    只顯示會動到的檔案，不真的同步（安全先試）"
      echo "  其他參數：    透傳給 rsync（--exclude、--exclude-from、--include 等）"
      exit 0
      ;;
    *)
      # 其他參數直接透傳給 rsync
      RSYNC_EXTRA+=("$1")
      shift
      ;;
  esac
done

# 驗證 direction
if [ -z "$DIRECTION" ]; then
  echo "用法: $0 [from-primary|from-legacy] [--dry-run] [rsync 選項]" >&2
  echo "  $0 --help 看完整說明" >&2
  exit 1
fi

# rsync flags（Session J1 加 --dry-run 支援）
RSYNC_FLAGS=(-av --delete)
if [ "$DRY_RUN" = true ]; then
  RSYNC_FLAGS+=(-n)
  echo "[DRY-RUN] 預覽模式：不會真的同步，只顯示會動到的檔案" >&2
  echo "" >&2
fi

# 固定排除項（防止 sync 出意外）
RSYNC_FLAGS+=(
  --exclude='.git'
  --exclude='node_modules'
  --exclude='.env'
  --exclude='dashboard.tmp.html'
)

# 透傳其他 rsync 選項
if [ ${#RSYNC_EXTRA[@]} -gt 0 ]; then
  RSYNC_FLAGS+=("${RSYNC_EXTRA[@]}")
fi

# Session J2：源端 .rsync-filter（如果存在）
# sync 時如果 source 有 .rsync-filter（rsync exclude pattern file），
# 會自動套用，避免主位置被 sync 進測試 fixtures / tmp 檔案。
if [ "$DIRECTION" = "from-legacy" ] && [ -f "$LEGACY/.rsync-filter" ]; then
  RSYNC_FLAGS+=(--exclude-from="$LEGACY/.rsync-filter")
  echo "[exclude-from] 使用 $LEGACY/.rsync-filter" >&2
elif [ "$DIRECTION" = "from-primary" ] && [ -f "$PRIMARY/.rsync-filter" ]; then
  RSYNC_FLAGS+=(--exclude-from="$PRIMARY/.rsync-filter")
  echo "[exclude-from] 使用 $PRIMARY/.rsync-filter" >&2
fi

if [ "$DIRECTION" = "from-primary" ]; then
  echo "同步：主位置 → 原位置"
  rsync "${RSYNC_FLAGS[@]}" "$PRIMARY/" "$LEGACY/"
elif [ "$DIRECTION" = "from-legacy" ]; then
  echo "同步：原位置 → 主位置"
  rsync "${RSYNC_FLAGS[@]}" "$LEGACY/" "$PRIMARY/"
fi
