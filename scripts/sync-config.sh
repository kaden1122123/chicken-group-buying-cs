#!/bin/bash
# sync-config.sh
# 同步 config/tenants/{tenant}.yaml 到 config.yaml（legacy fallback）
#
# Session C C3 (2026-06-27) 新增：
# 解決「config.yaml 為 legacy fallback，內容可能與 chicken.yaml 漂移」的問題。
# 方向：單向同步 chicken.yaml → config.yaml。
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

if [ ! -f "$LEGACY_CONFIG" ]; then
  echo "❌ 找不到 legacy config: $LEGACY_CONFIG"
  exit 1
fi

# 備份當前 config.yaml
BACKUP_PATH="${LEGACY_CONFIG}.bak.$(date +%Y%m%d-%H%M%S)"
cp "$LEGACY_CONFIG" "$BACKUP_PATH"
echo "📦 備份當前 config.yaml → $BACKUP_PATH"

# 提取 tenant.yaml 內容（去掉 chicken.yaml 沒有的「請改 chicken.yaml」註解）
# 方法：直接複製 tenant.yaml 內容到 config.yaml
# 保留 config.yaml 開頭的 legacy 說明註解
TMP_HEADER=$(mktemp)
TMP_BODY=$(mktemp)

# 提取 config.yaml 開頭的「為何保留」說明（從 # ============================================================ 到第一個非註解、空行前的內容）
awk '/^# ====/{flag=1} flag && /^[a-z_]+:/{exit} flag{print}' "$LEGACY_CONFIG" > "$TMP_HEADER"

# 提取 tenant.yaml 內容（跳過 # 開頭的註解，保留純 YAML）
awk '/^#/{next} {print}' "$TENANT_CONFIG" > "$TMP_BODY"

# 合併
cat "$TMP_HEADER" > "$LEGACY_CONFIG"
echo "" >> "$LEGACY_CONFIG"
echo "# ─────────────────────────────────────────" >> "$LEGACY_CONFIG"
echo "# 以下為 tenant.yaml 同步內容（單向鏡像）" >> "$LEGACY_CONFIG"
echo "# ─────────────────────────────────────────" >> "$LEGACY_CONFIG"
echo "" >> "$LEGACY_CONFIG"
cat "$TMP_BODY" >> "$LEGACY_CONFIG"

rm -f "$TMP_HEADER" "$TMP_BODY"

echo "✅ 同步完成：$TENANT_CONFIG → $LEGACY_CONFIG"
echo ""
echo "📋 驗證差異（僅顯示前 30 行）："
diff -u "$BACKUP_PATH" "$LEGACY_CONFIG" | head -30
echo ""
echo "💡 如需還原：cp $BACKUP_PATH $LEGACY_CONFIG"
