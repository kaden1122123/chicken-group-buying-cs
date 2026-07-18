#!/bin/bash
# scripts/sync-canonical.sh
# 同步 docs/production-prompt/2026-07-03/ → ~/.openclaw/agents/external-user/
#
# 用途：
#   解決 production runtime canonical files（AGENTS.md / SOUL.md / main_idea.md）
#   與 docs/production-prompt/ drift（之前未被抓到 12 天，audit 2026-07-19 發現）
#
# 對齊：
#   - check-quality.sh Check 10 canonical drift 檢查
#   - ENGINEERING_HANDBOOK.md §6.6 三層位置架構
#   - 2026-07-19 03:36+ session 修整（Hubert 指示）
#
# 設計：
#   - AGENTS.md 加 14 行 CANONICAL 標頭（production runtime 專用）
#     → 提醒未來 session「這是 production runtime，改之前先確認應在 dev repo」
#   - SOUL.md 直接 cp（無環境特定標頭）
#   - main_idea.md 直接 cp（注意路徑差異：prod 在 knowledge/，docs 在根目錄）
#
# 編輯流程（從今以後）：
#   1. 永遠改 docs/production-prompt/2026-07-03/（git tracked）
#   2. 跑此 script 同步到 production runtime
#   3. 跑 bash scripts/check-quality.sh 驗證

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROD_LOC="/home/clawuser/.openclaw/agents/external-user"
PP_LOC="$PROJECT_ROOT/docs/production-prompt/2026-07-03"

echo "=== sync-canonical.sh — 同步 canonical files 到 production runtime ==="
echo ""

# 檢查路徑存在
if [ ! -d "$PROD_LOC" ]; then
  echo "❌ production runtime 不存在：$PROD_LOC"
  echo "   這個 script 只在完整雞味客服環境下使用"
  exit 1
fi

if [ ! -d "$PP_LOC" ]; then
  echo "❌ docs/production-prompt/2026-07-03 不存在：$PP_LOC"
  exit 1
fi

# AGENTS.md 的 14 行 CANONICAL 標頭（production runtime 專用）
read -r -d '' AGENTS_CANONICAL_HEADER <<'EOF' || true
# CANONICAL — 此為 production runtime（主上線端）的 AGENTS.md
#
# 路徑結構（依 ENGINEERING_HANDBOOK §6.6）：
#   主上線端 (production): ~/.openclaw/agents/external-user/ ← 你在這
#   測試端 (sandbox/dev):  ~/.openclaw/workspace-external-user/
#   本倉庫 source:        docs/production-prompt/2026-07-03/
#
# 三層 enforcement（防止新 session 在 production runtime 直接編輯）：
#   Layer 1: chattr +i（immutable bit）— 物理擋
#   Layer 2: main-enforce-readonly.sh cron watchdog — 自動 revert
#   Layer 3: scripts/check-cwd.sh 主動檢查
#
# canonical 永遠在這。任何 session 對此檔的 edit 必須先確認「應在 dev repo 編」。

EOF

# 備份現有 production runtime 版本（如有 .bak）
backup_if_exists() {
  local file="$1"
  if [ -f "$file" ]; then
    local bak="${file}.bak.$(date +%Y%m%d-%H%M%S)"
    cp "$file" "$bak"
    echo "  ℹ️  備份：$bak"
  fi
}

echo "--- 1. AGENTS.md（加 14 行 CANONICAL 標頭）---"
if [ ! -f "$PP_LOC/AGENTS.md" ]; then
  echo "  ❌ $PP_LOC/AGENTS.md 不存在"
  exit 1
fi
backup_if_exists "$PROD_LOC/AGENTS.md"
# 確保 CANONICAL 標頭結尾有 newline（不然會跟 docs AGENTS.md line 1 黏住）
# 2026-07-19 03:36+ session 修整
{ printf '%s' "$AGENTS_CANONICAL_HEADER"; echo; cat "$PP_LOC/AGENTS.md"; } > "$PROD_LOC/AGENTS.md"
echo "  ✓ AGENTS.md synced（含 CANONICAL 標頭 + docs/production-prompt/2026-07-03/AGENTS.md 內容）"
echo ""

echo "--- 2. SOUL.md（直接 cp）---"
if [ ! -f "$PP_LOC/SOUL.md" ]; then
  echo "  ❌ $PP_LOC/SOUL.md 不存在"
  exit 1
fi
backup_if_exists "$PROD_LOC/SOUL.md"
cp "$PP_LOC/SOUL.md" "$PROD_LOC/SOUL.md"
echo "  ✓ SOUL.md synced"
echo ""

echo "--- 3. knowledge/main_idea.md（注意路徑差異：prod 在 knowledge/，docs 在根目錄）---"
if [ ! -f "$PP_LOC/main_idea.md" ]; then
  echo "  ❌ $PP_LOC/main_idea.md 不存在"
  exit 1
fi
mkdir -p "$PROD_LOC/knowledge"
backup_if_exists "$PROD_LOC/knowledge/main_idea.md"
cp "$PP_LOC/main_idea.md" "$PROD_LOC/knowledge/main_idea.md"
echo "  ✓ knowledge/main_idea.md synced"
echo ""

echo "=== 同步完成 ==="
echo ""
echo "驗證："
echo "  bash scripts/check-quality.sh    # 應 10 通過 / 0 失敗（working tree warn 是 expected）"
echo ""
echo "編輯流程提醒（從今以後）："
echo "  1. 永遠改 docs/production-prompt/2026-07-03/（git tracked）"
echo "  2. 跑此 script 同步到 production runtime"
echo "  3. commit + push（git 自動追蹤 docs/ 變更）"
echo "  4. production runtime 內的 .bak 是歷史 snapshot，視需要清理"
