#!/bin/bash
# sync-config.sh
# 同步 config/tenants/{tenant}.yaml 到 config.yaml（legacy fallback）
#
# 設計：
#   - 單向同步 chicken.yaml → config.yaml（每次執行替換整個內容）
#   - 不嘗試讀取舊 config.yaml 的 header（避免 separator 累積 bug）
#   - 每次寫固定 header + 1 個 separator + 1 份 chicken.yaml 內容
#
# 修正歷史：
#   - Session C C3 (2026-06-27) 新增
#   - Round 15 (2026-07-23) 修 bug：原本用 awk 提取 config.yaml header，
#     會把舊的 "以下為 tenant.yaml 同步內容" separator 也包進去，
#     每次 sync 都累積一個 separator + chicken block。修法：直接寫固定 header。
#
# 用法：
#   bash scripts/sync-config.sh          # 同步預設 tenant (chicken)
#   bash scripts/sync-config.sh chicken   # 同步指定 tenant

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TENANT="${1:-chicken}"
TENANT_CONFIG="$PROJECT_ROOT/config/tenants/${TENANT}.yaml"
LEGACY_CONFIG="$PROJECT_ROOT/config.yaml"

if [ ! -f "$TENANT_CONFIG" ]; then
  echo "❌ 找不到 tenant config: $TENANT_CONFIG"
  exit 1
fi

# 注意：legacy config 不需要預先存在 — 此 script 會從 chicken.yaml 完全重建
# （Round 15 修法：不用 awk 提取舊 header，每次寫固定 header）

# 備份當前 config.yaml（如存在）
if [ -f "$LEGACY_CONFIG" ]; then
  BACKUP_PATH="${LEGACY_CONFIG}.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$LEGACY_CONFIG" "$BACKUP_PATH"
  echo "📦 備份當前 config.yaml → $BACKUP_PATH"
fi

# 提取 tenant.yaml 內容（跳過 # 開頭的註解，保留純 YAML）
TMP_BODY=$(mktemp)
awk '/^#/{next} {print}' "$TENANT_CONFIG" > "$TMP_BODY"

# 寫入 config.yaml：固定 header + 1 個 separator + chicken.yaml 內容
# 不依賴 awk 從舊 config.yaml 提取 header（避免 separator 累積）
cat > "$LEGACY_CONFIG" <<'HEADER_EOF'
# config.yaml — 雞味客服 legacy fallback
# ============================================================
# 為何保留 config.yaml：legacy fallback for OpenClaw pipeline
# 當外部 OpenClaw agent 透過舊路徑（file-based）讀 config 時，
# 這份檔會被讀取。新版請直接讀 config/tenants/chicken.yaml。
#
# 此檔由 scripts/sync-config.sh 自動產生，
# 每次執行會「替換」（不是 append）成 chicken.yaml 的內容（單向鏡像）。
# Round 15 (2026-07-23) 修法：原本 awk 提取舊 header 導致 separator 累積，
# 改成直接寫固定 header，每次 sync 都是 1 個 separator。
# ============================================================

# ─────────────────────────────────────────
# 以下為 tenant.yaml 同步內容（單向鏡像）
# ─────────────────────────────────────────

HEADER_EOF
cat "$TMP_BODY" >> "$LEGACY_CONFIG"

rm -f "$TMP_BODY"

# 驗證：只應有 1 個 separator
SECTION_COUNT=$(grep -c "以下為 tenant.yaml 同步內容" "$LEGACY_CONFIG" || echo 0)
if [ "$SECTION_COUNT" != "1" ]; then
  echo "⚠️  警告：config.yaml 有 $SECTION_COUNT 個 separator section（預期 1）"
  echo "    請手動檢查或刪除 $LEGACY_CONFIG 後重跑"
fi

echo "✅ 同步完成：$TENANT_CONFIG → $LEGACY_CONFIG"
echo "   separator count: $SECTION_COUNT (預期 1)"
echo ""
echo "💡 如需還原：cp $BACKUP_PATH $LEGACY_CONFIG"