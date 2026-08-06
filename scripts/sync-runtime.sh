#!/bin/bash
# scripts/sync-runtime.sh
# Round 38 (Hubert 21:11 決定) — 合併 sync-canonical.sh + sync-kb.sh
# 為什麼合併:兩個都是 L1 → L3 runtime,本來就該一起跑,分開容易 drift
#   - sync-canonical.sh 同步 canonical files (AGENTS/SOUL/main_idea.md)
#   - sync-kb.sh 同步 KB files (knowledge/tenants/*/01_product.md 等 12 個檔)
#   - 兩個都走 L1 (dev repo) → L3 (production runtime) 同方向、同頻率
#
# 設計:
#   - Phase 1: 同步 canonical prompt files (AGENTS/SOUL/main_idea.md)
#   - Phase 2: 同步 KB (knowledge/tenants/*.md) via rsync
#   - 失敗任一 phase → exit 1,但 Phase 1 完成不擋 Phase 2
#
# 用法:
#   bash scripts/sync-runtime.sh              # 預設全部跑
#   bash scripts/sync-runtime.sh --canonical  # 只跑 Phase 1
#   bash scripts/sync-runtime.sh --kb         # 只跑 Phase 2
#
# 編輯流程(從今以後):
#   1. 改 docs/production-prompt/latest/ 或 knowledge/tenants/chicken/ (git tracked)
#   2. 跑此 script 同步到 production runtime
#   3. 跑 bash scripts/check-quality.sh 驗證 (Check 11 + KB 同步都應通過)
#
# 加到 cron (讓 prompt + KB 每分鐘自動同步):
#   * * * * * /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/scripts/sync-runtime.sh >> /home/clawuser/.openclaw/logs/chicken/sync-runtime.log 2>&1

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# === 參數解析 ===
PHASE_CANONICAL=true
PHASE_KB=true
case "${1:-}" in
  --canonical)
    PHASE_KB=false
    ;;
  --kb)
    PHASE_CANONICAL=false
    ;;
  --help|-h)
    echo "用法: $0 [--canonical|--kb|--help]"
    echo ""
    echo "  (無參數)  同步 canonical + KB (預設)"
    echo "  --canonical  只同步 canonical files"
    echo "  --kb         只同步 KB files"
    echo "  --help       顯示此說明"
    exit 0
    ;;
  "")
    # 預設跑兩個
    ;;
  *)
    echo "❌ 未知參數: $1"
    echo "   用 $0 --help 看可用參數"
    exit 1
    ;;
esac

# === 設定路徑 ===
PROD_LOC="/home/clawuser/.openclaw/agents/external-user"

# Canonical source: 優先 latest/ symlink,fallback 到 2026-08-04(Round 37.20 後),最後 2026-07-03
PP_LOC="$PROJECT_ROOT/docs/production-prompt/latest"
if [ ! -e "$PP_LOC" ]; then
  PP_LOC="$PROJECT_ROOT/docs/production-prompt/2026-08-04"
fi
if [ ! -e "$PP_LOC" ]; then
  PP_LOC="$PROJECT_ROOT/docs/production-prompt/2026-07-03"
fi

# KB 路徑
L1_KB="$PROJECT_ROOT/knowledge/tenants"
L3_KB="$PROD_LOC/knowledge/tenants"

# === 路徑檢查 ===
if [ ! -d "$PROD_LOC" ]; then
  echo "❌ production runtime 不存在:$PROD_LOC"
  echo "   此 script 只在完整雞味客服環境下使用"
  exit 1
fi

# AGENTS.md 加 14 行 CANONICAL 標頭(production runtime 專用)
# 提醒未來 session「這是 production runtime,改之前先確認應在 dev repo 編」
read -r -d '' AGENTS_CANONICAL_HEADER <<'EOF' || true
# CANONICAL — 此為 production runtime(主上線端)的 AGENTS.md
#
# 路徑結構(依 ENGINEERING_HANDBOOK §6.6):
#   主上線端 (production): ~/.openclaw/agents/external-user/ ← 你在這
#   測試端 (sandbox/dev):  ~/.openclaw/workspace-external-user/
#   本倉庫 source:        docs/production-prompt/2026-08-04/ (或 latest/)
#
# 三層 enforcement(防止新 session 在 production runtime 直接編輯):
#   Layer 1: chattr +i(immutable bit)— 物理擋
#   Layer 2: main-enforce-readonly.sh cron watchdog — 自動 revert
#   Layer 3: scripts/check-cwd.sh 主動檢查
#
# canonical 永遠在這。任何 session 對此檔的 edit 必須先確認「應在 dev repo 編」。

EOF

# 備份現有 production runtime 版本
backup_if_exists() {
  local file="$1"
  if [ -f "$file" ]; then
    local bak="${file}.bak.$(date +%Y%m%d-%H%M%S)"
    cp "$file" "$bak"
    echo "    ℹ️  備份:$bak"
  fi
}

# === Phase 1: Canonical Files ===
if [ "$PHASE_CANONICAL" = true ]; then
  echo "=== Phase 1/2: 同步 canonical files (AGENTS/SOUL/main_idea.md) ==="
  echo "    source: $PP_LOC"
  echo "    target: $PROD_LOC"
  echo ""

  # AGENTS.md
  if [ ! -f "$PP_LOC/AGENTS.md" ]; then
    echo "  ❌ $PP_LOC/AGENTS.md 不存在"
    exit 1
  fi
  backup_if_exists "$PROD_LOC/AGENTS.md"
  { printf '%s\n' "$AGENTS_CANONICAL_HEADER"; cat "$PP_LOC/AGENTS.md"; } > "$PROD_LOC/AGENTS.md"
  echo "  ✓ AGENTS.md synced(含 14 行 CANONICAL 標頭)"

  # SOUL.md
  if [ ! -f "$PP_LOC/SOUL.md" ]; then
    echo "  ❌ $PP_LOC/SOUL.md 不存在"
    exit 1
  fi
  backup_if_exists "$PROD_LOC/SOUL.md"
  cp "$PP_LOC/SOUL.md" "$PROD_LOC/SOUL.md"
  echo "  ✓ SOUL.md synced"

  # main_idea.md(prod 在 knowledge/,docs 在根目錄)
  if [ ! -f "$PP_LOC/main_idea.md" ]; then
    echo "  ❌ $PP_LOC/main_idea.md 不存在"
    exit 1
  fi
  mkdir -p "$PROD_LOC/knowledge"
  backup_if_exists "$PROD_LOC/knowledge/main_idea.md"
  cp "$PP_LOC/main_idea.md" "$PROD_LOC/knowledge/main_idea.md"
  echo "  ✓ knowledge/main_idea.md synced"
  echo ""
fi

# === Phase 2: KB Files ===
if [ "$PHASE_KB" = true ]; then
  echo "=== Phase 2/2: 同步 KB (knowledge/tenants/*.md) ==="
  echo "    source: $L1_KB"
  echo "    target: $L3_KB"
  echo ""

  if [ ! -d "$L1_KB" ]; then
    echo "  ❌ L1 KB 不存在:$L1_KB"
    exit 1
  fi
  mkdir -p "$L3_KB"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$L1_KB/" "$L3_KB/"
    echo "  ✓ rsync mirror 完成:L1 → L3"
  else
    echo "  ⚠️  rsync 不可用,用 cp fallback"
    cp -r "$L1_KB"/* "$L3_KB/"
  fi

  # 驗證
  KB_COUNT=$(find "$L3_KB" -name '*.md' 2>/dev/null | wc -l)
  echo "  ✓ L3 KB 共 $KB_COUNT 個 .md 檔案已同步"
  echo ""
fi

# === 總結 ===
echo "=== 同步完成 ==="
echo ""
echo "驗證:"
echo "  bash scripts/check-quality.sh         # 確認 Check 11 + KB 同步"
echo "  bash bin/check-drift                  # 確認三層 MD5 一致"
echo ""
echo "編輯流程提醒(從今以後):"
echo "  1. 永遠改 dev repo 的 docs/production-prompt/latest/ 或 knowledge/tenants/"
echo "  2. 跑此 script 同步到 production runtime"
echo "  3. commit + push (git 自動追蹤 docs/ 變更)"
echo "  4. production runtime 內的 .bak 是歷史 snapshot,視需要清理"