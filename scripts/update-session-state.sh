#!/bin/bash
# scripts/update-session-state.sh
# Round 34 (2026-08-01 19:21+ Hubert 指示) — 自動更新 session docs
#
# 目的：
#   - 每次 commit 後（或 Session 結束 SOP）自動更新 session 相關文件
#   - 保證接手 session 看到的文件永遠是最新
#   - 從 git log + 當前 state 自動生成內容
#
# 設計：
#   - 不修改 SESSION_RULES.md 與 NEW_SESSION_PROMPT.md 本體（這些由 Hubert/brtclaw 維護）
#   - 只自動更新「當前狀態」段（從 git log + check-quality 抽資料）
#   - 觸發時機：Session End SOP 步驟 6（見 docs/SESSION_END_SOP.md）
#
# 使用：
#   bash scripts/update-session-state.sh           # 更新所有 session docs
#   bash scripts/update-session-state.sh --dry-run  # 預覽不真寫

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

cd "$PROJECT_ROOT"

echo "=== update-session-state.sh — Round 34 ==="
echo ""

UPDATED_FILES=()

# 1. 重新生成 SESSION_NEXT_PROMPT.md（auto-generated，git log 抽資料）
echo "--- 1. 重新生成 SESSION_NEXT_PROMPT.md ---"
if [ -f "scripts/generate-next-prompt.sh" ]; then
  if [ "$DRY_RUN" = false ]; then
    bash scripts/generate-next-prompt.sh 2>&1 | head -3
  else
    bash scripts/generate-next-prompt.sh --stdout 2>&1 | head -5
  fi
  UPDATED_FILES+=("docs/handoff/sessions/SESSION_NEXT_PROMPT.md")
fi

# 2. 重新生成 INDEX.md（auto-generated，掃描 docs/）
echo ""
echo "--- 2. 重新生成 INDEX.md ---"
if [ -f "scripts/generate-docs-index.sh" ]; then
  if [ "$DRY_RUN" = false ]; then
    bash scripts/generate-docs-index.sh 2>&1 | head -3
  else
    bash scripts/generate-docs-index.sh --stdout 2>&1 | head -5
  fi
  UPDATED_FILES+=("docs/INDEX.md")
fi

# 3. 同步 production runtime canonical files（docs → production）
echo ""
echo "--- 3. 同步 production runtime canonical ---"
if [ -f "scripts/sync-canonical.sh" ] && [ "$DRY_RUN" = false ]; then
  bash scripts/sync-canonical.sh 2>&1 | grep -E "synced|✓" | head -5
fi

# 4. 同步 main mirror（dev → mirror）
echo ""
echo "--- 4. 同步 main mirror ---"
if [ -f "scripts/sync-mirror.sh" ] && [ "$DRY_RUN" = false ]; then
  # 暫時 chmod u+w main mirror（rsync 需要寫）
  MAIN_LOC="/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service"
  if [ -d "$MAIN_LOC" ]; then
    chmod u+w "$MAIN_LOC" 2>/dev/null || true
  fi
  bash scripts/sync-mirror.sh from-legacy 2>&1 | tail -3
fi

# 5. 跑品質檢查（驗證所有同步沒破壞）
echo ""
echo "--- 5. 跑品質檢查 ---"
if [ "$DRY_RUN" = false ]; then
  bash scripts/check-quality.sh 2>&1 | tail -5
fi

echo ""
echo "=== 摘要 ==="
echo "更新的檔案："
for f in "${UPDATED_FILES[@]}"; do
  echo "  - $f"
done
if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "DRY-RUN 模式 — 上面只是預覽，沒真寫入"
fi

echo ""
echo "✓ update-session-state.sh 完成"
echo ""
echo "💡 Tip：這個 script 應該加到 Session End SOP 步驟 6（見 docs/SESSION_END_SOP.md）"
