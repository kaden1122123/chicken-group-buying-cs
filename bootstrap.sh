#!/bin/bash
# bootstrap.sh
# Round 23 (2026-07-25 12:00+) — 接手 session 5 分鐘上手入口
#
# 設計：
#   - 跑關鍵 5 個動作：git status + check-quality + health + INDEX 摘要 + 下次任務
#   - 自動重新生成 INDEX.md + SESSION_NEXT_PROMPT.md（如果太舊）
#   - 失敗時不中斷（只 warn），讓接手者能看到所有結果
#
# 使用：
#   bash bootstrap.sh              # 接手 session 第一件事

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# 顏色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() { echo -e "${GREEN}✅${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️${NC} $1"; }
err() { echo -e "${RED}❌${NC} $1"; }

echo "🚀 雞味客服 bootstrap — 接手 session 5 分鐘上手"
echo "============================================="
echo ""

# 1. Git status
echo "📊 Step 1/5: Git 狀態"
echo "---"
cd "$PROJECT_ROOT"
git status --short 2>/dev/null | head -10 || warn "git status failed"
git log --oneline -3 2>/dev/null || warn "git log failed"
echo ""

# 2. check-quality
echo "🧪 Step 2/5: check-quality (12 checks)"
echo "---"
if bash scripts/check-quality.sh 2>/dev/null | tail -3; then
  ok "check-quality passed"
else
  warn "check-quality 有失敗，繼續（不中斷 bootstrap）"
fi
echo ""

# 3. Health
echo "💊 Step 3/5: Services health"
echo "---"
HEALTH=$(curl -sS -m 5 http://localhost:3000/healthz 2>/dev/null || echo '{"status":"degraded"}')
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
if echo "$HEALTH" | grep -q '"status": "ok"'; then
  ok "services all up"
else
  warn "services 有問題，檢查 logs"
fi
echo ""

# 4. INDEX 摘要
echo "📚 Step 4/5: 必讀文件摘要（從 INDEX.md）"
echo "---"
if [ -f docs/INDEX.md ]; then
  echo "（前 30 行）"
  head -30 docs/INDEX.md | sed 's/^/  /'
  echo ""
  ok "INDEX.md exists"
else
  warn "docs/INDEX.md not found，run generate-docs-index.sh"
fi
echo ""

# 5. 下次 session 第一件事
echo "🎯 Step 5/5: 下次 session 第一件事（pending tasks）"
echo "---"
if [ -f /home/clawuser/.openclaw/workspace/.task-state/active-tasks.md ]; then
  grep -E "^\s*- \[ \]" /home/clawuser/.openclaw/workspace/.task-state/active-tasks.md 2>/dev/null | head -5 | sed 's/^/  /'
  echo ""
  ok "active-tasks.md loaded"
else
  warn "~/.openclaw/workspace/.task-state/active-tasks.md not found"
fi
echo ""

# 摘要
echo "============================================="
echo "📋 Bootstrap 摘要"
echo "============================================="
echo "  ✅ 5 個必讀文件:"
echo "     1. HANDOFF.md (主要 session 交接)"
echo "     2. CHANGELOG.md (commit-level 變更)"
echo "     3. OPERATIONS.md (LINE bot + staging + secrets SOP)"
echo "     4. DEVELOPMENT.md (測試 + 開發 + troubleshooting)"
echo "     5. INDEX.md (單一入口, auto-generated)"
echo ""
echo "  🔗 快速連結:"
echo "     - Dashboard: http://localhost:3000"
echo "     - Worker prod: https://external-user-line-security.kaden1122123.workers.dev"
echo "     - Worker staging: https://external-user-line-security-staging.kaden1122123.workers.dev"
echo ""
echo "  🛠 工具:"
echo "     - bash scripts/generate-docs-index.sh   # 更新 INDEX.md"
echo "     - bash scripts/generate-next-prompt.sh  # 更新 SESSION_NEXT_PROMPT.md"
echo "     - bash scripts/cleanup-baks.sh          # 7-day buffer (7/26 跑)"
echo ""
ok "Bootstrap 完成。開始工作吧！"
