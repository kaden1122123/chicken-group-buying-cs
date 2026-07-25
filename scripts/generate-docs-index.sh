#!/bin/bash
# scripts/generate-docs-index.sh
# Round 23 (2026-07-25 12:00+) — 自動生成 docs/INDEX.md
#
# 設計：
#   - 掃描 docs/ 目錄（chicken repo）
#   - 掃描 ~/.openclaw/workspace/ （system-level 狀態文件）
#   - 掃描 Worker repo docs/（cloudflare-worker）
#   - 依檔名 + 檔案大小智能分類
#   - 輸出到 docs/INDEX.md
#
# 使用：
#   bash scripts/generate-docs-index.sh          # 自動寫到 docs/INDEX.md
#   bash scripts/generate-docs-index.sh --stdout # 只 print 不寫

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="${HOME}/.openclaw/workspace"
WORKER_REPO="${WORKER_REPO:-/home/clawuser/openclaw-workspace/external-user/cloudflare-worker}"

OUTPUT_FILE="$PROJECT_ROOT/docs/INDEX.md"
STDOUT_ONLY=false
[ "${1:-}" = "--stdout" ] && STDOUT_ONLY=true

# 統計
chicken_md_count=$(find "$PROJECT_ROOT/docs" -maxdepth 1 -name "*.md" -not -name "INDEX.md" 2>/dev/null | wc -l)
chicken_md_lines=$(find "$PROJECT_ROOT/docs" -maxdepth 1 -name "*.md" -not -name "INDEX.md" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
workspace_count=$(find "$WORKSPACE" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l)
worker_md_count=$(find "$WORKER_REPO/docs" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l)

generate() {
  cat <<HEADER
# 雞味客服 文件 INDEX（自動生成於 $(date '+%Y-%m-%d %H:%M:%S')）

> **本檔由 \`scripts/generate-docs-index.sh\` 自動生成**（Round 23）
> **手動編輯請注意**：下次跑 script 會被覆蓋
> **重新生成**：\`bash scripts/generate-docs-index.sh\`

## 📊 統計

| 類別 | 檔案數 | 行數 |
|------|-------|------|
| Chicken repo docs/ (md, 不含 INDEX) | ${chicken_md_count} | ${chicken_md_lines:-?} |
| System-level (~/.openclaw/workspace/) | ${workspace_count} | - |
| Worker repo docs/ | ${worker_md_count} | - |
| **總計** | $((chicken_md_count + workspace_count + worker_md_count)) | - |

---

## 🔥 必讀（5 個）

| 檔案 | 用途 |
|------|------|
| \`HANDOFF.md\` | 主要 session 交接手冊（§1 現狀 + §7 變更歷史）|
| \`CHANGELOG.md\` | Commit-level 變更歷史 |
| \`OPERATIONS.md\` (Round 22 新) | LINE bot + staging + secrets SOP |
| \`DEVELOPMENT.md\` (Round 22 新) | 測試 + 開發 + Troubleshooting |
| \`INDEX.md\` (本檔) | 單一入口（auto-generated）|

---

## 📋 Chicken repo docs/

HEADER

  # 列出 chicken repo docs/*.md（按檔名排序）
  find "$PROJECT_ROOT/docs" -maxdepth 1 -name "*.md" -not -name "INDEX.md" 2>/dev/null | sort | while read -r f; do
    name=$(basename "$f")
    lines=$(wc -l < "$f" 2>/dev/null)
    # 自動分類
    if echo "$name" | grep -qE "HANDOFF|CHANGELOG|SESSION_END|OPERATIONS|DEVELOPMENT|INDEX"; then
      cat="🔥 必讀"
    elif echo "$name" | grep -qE "SOP|AGENT_PROJECT"; then
      cat="📋 SOP"
    elif echo "$name" | grep -qE "TESTING|API_CURL|EMAIL|GCP|MULTI_TENANT|REVIEW_GUIDE"; then
      cat="🛠 開發"
    elif echo "$name" | grep -qE "PROJECT_INVENTORY|MAIN_DIR|SPEC|README|MIGRATION"; then
      cat="📚 通用"
    elif echo "$name" | grep -qE "PHASE1_PROGRESS|CLEANUP_PHASE|TODO_2026|DAILY_SUMMARY|SYSTEM_AUDIT|LEGACY"; then
      cat="🗑 LEGACY（不讀）"
    else
      cat="📄 其他"
    fi
    echo "| \`$name\` | $cat | $lines 行 |"
  done

  cat <<MIDDLE

---

## 🤖 System-level 狀態（\`~/.openclaw/workspace/\`）

| 檔案 | 用途 |
|------|------|
| \`HEARTBEAT.md\` | Cron jobs + 系統狀態 |
| \`memory/heartbeat-state.json\` | 系統狀態 JSON |
| \`.task-state/active-tasks.md\` | 進行中的任務 |
| \`memory/YYYY-MM-DD.md\` | 每日 session summary |
| \`MEMORY.md\` | brtclaw 長期記憶 + 工作方法論 |
| \`SOUL.md\` | brtclaw 人格設定 |

---

## 🔧 Worker repo docs/（\`external-user-line-security\`）

MIDDLE

  # 列出 Worker repo docs/
  find "$WORKER_REPO/docs" -maxdepth 1 -name "*.md" 2>/dev/null | sort | while read -r f; do
    name=$(basename "$f")
    lines=$(wc -l < "$f" 2>/dev/null)
    echo "| \`$f\` | $lines 行 |"
  done

  cat <<FOOTER

---

## 🔗 快速連結

- **Worker prod**: \`https://external-user-line-security.kaden1122123.workers.dev\`
- **Worker staging**: \`https://external-user-line-security-staging.kaden1122123.workers.dev\`
- **Dashboard**: \`https://dashboard.brt1122.com\`
- **LINE Developer Console**: https://developers.line.biz/console/
- **Cloudflare Dashboard**: https://dash.cloudflare.com

---

_本檔由 \`scripts/generate-docs-index.sh\` 自動生成_
_對應 Round 23 「自動生成腳本」_
FOOTER
}

if [ "$STDOUT_ONLY" = true ]; then
  generate
else
  generate > "$OUTPUT_FILE"
  echo "✅ Updated $OUTPUT_FILE (${chicken_md_count} chicken + ${workspace_count} workspace + ${worker_md_count} worker = $((chicken_md_count + workspace_count + worker_md_count)) files)"
fi
