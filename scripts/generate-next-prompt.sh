#!/bin/bash
# scripts/generate-next-prompt.sh
# Round 23 (2026-07-25 12:00+) — 自動生成 docs/handoff/sessions/SESSION_NEXT_PROMPT.md
#
# 設計：
#   - 從 git log + heartbeat-state.json + cron list + health 自動抓現狀
#   - 動態產生「當前狀態」「下個 session 第一件事」等 sections
#   - 靜態內容（如何用、怎麼讀等）保留 hardcoded template
#
# 使用：
#   bash scripts/generate-next-prompt.sh          # 自動寫到 docs/handoff/sessions/SESSION_NEXT_PROMPT.md
#   bash scripts/generate-next-prompt.sh --stdout # 只 print 不寫

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_FILE="$PROJECT_ROOT/docs/handoff/sessions/SESSION_NEXT_PROMPT.md"
STDOUT_ONLY=false
[ "${1:-}" = "--stdout" ] && STDOUT_ONLY=true

# 收集狀態
cd "$PROJECT_ROOT"

# 1. 當前 last commit
LAST_COMMIT=$(git log -1 --pretty=format:"%h %s" 2>/dev/null || echo "unknown")

# 2. Worker deploy 版本（從 git log 找最近的 deploy commit）
WORKER_DEPLOY=$(cd /home/clawuser/openclaw-workspace/external-user/cloudflare-worker 2>/dev/null && wrangler deployments list 2>/dev/null | grep "100%" | head -1 | awk '{print $3}' | tr -d '()')

# 3. 統計測試
TEST_COUNT=$(find tests -name "*.test.js" 2>/dev/null | wc -l || echo 0)

# 4. cron 數量
CRON_COUNT=$(openclaw cron list 2>/dev/null | grep -E "^-" | wc -l || echo 0)

# 5. check-quality
CHECK_QUALITY=$(bash scripts/check-quality.sh 2>/dev/null | tail -1 || echo "unknown")

# 6. 最近 5 commits
LAST_5_COMMITS=$(git log --oneline -5 2>/dev/null | head -5 || echo "")

# 7. Pending tasks
PENDING_TASKS=$(grep -E "^\s*- \[ \]" /home/clawuser/.openclaw/workspace/.task-state/active-tasks.md 2>/dev/null | head -5 || echo "")

# 8. Worker recent commits
WORKER_COMMITS=$(cd /home/clawuser/openclaw-workspace/external-user/cloudflare-worker 2>/dev/null && git log --oneline -3 2>/dev/null | head -3 || echo "")

# 生成內容
generate() {
  cat <<HEADER
# 下個 Session Prompt（自動生成於 $(date '+%Y-%m-%d %H:%M:%S')）

> **本檔由 \`scripts/generate-next-prompt.sh\` 自動生成**（Round 23）
> **手動編輯請注意**：下次跑 script 會被覆蓋靜態 sections
> **重新生成**：\`bash scripts/generate-next-prompt.sh\`

---

## 🎯 用途

接手 session 第一件事是讀這檔的「當前狀態 + 下次 session 第一件事」兩個 section。其他 section 看需不需要。

## 👥 讀者

接手雞味客服工作的 brtclaw session（首要），Hubert（owner）偶爾查看。

## 🏁 結束時應該做什麼

1. 跑 \`bash scripts/check-quality.sh\` 確認 12 checks 全綠
2. 跑 \`npm test\` 確認 ${TEST_COUNT} tests 全綠
3. git add -A + commit + push（按 §I-1 SOP）
4. 跑 \`bash scripts/sync-mirror.sh from-legacy\` 同步主鏡像
5. 寫當日 \`~/.openclaw/workspace/memory/YYYY-MM-DD.md\`
6. 跑 \`bash scripts/generate-next-prompt.sh\` 重新生成本檔
7. 跑 \`bash scripts/generate-docs-index.sh\` 更新 INDEX.md

## 📚 參考 Best Practices

- [session-handoff skill](https://github.com/softaworks/agent-toolkit) — Zero ambiguity
- [Project Handover Templates (plane.so)](https://plane.so/blog/what-is-a-project-handover-steps-checklist-and-best-practices) — Structured transfer

## 開局指令（複製貼到新 session）

\`\`\`
# 1. 確認環境
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
bash scripts/check-quality.sh    # 應 12 pass / 0 warn / 0 fail
npm test                          # 應 30+ tests 全綠
curl -s http://localhost:3000/healthz

# 2. 讀必讀
cat docs/INDEX.md                 # 單一入口
cat HANDOFF.md | head -100         # 當前狀態
cat OPERATIONS.md | head -50       # 部署 SOP
cat DEVELOPMENT.md | head -50      # 開發 SOP
\`\`\`

## 當前狀態（自動生成於 $(date '+%Y-%m-%d %H:%M:%S')）

| 項目 | 狀態 |
|------|------|
| Chicken repo last commit | \`${LAST_COMMIT}\` |
| Worker last commit | \`$(echo "${WORKER_COMMITS}" | head -1 | awk '{print $1}')\` |
| Worker deploy version | \`${WORKER_DEPLOY:-unknown}\` |
| Test count | ${TEST_COUNT} tests |
| Cron jobs | ${CRON_COUNT} active |
| Check quality | \`${CHECK_QUALITY}\` |
| Staging ready | ✅ (KV \`83d36bc57b6b4505aa24ad684483e00c\`) |

## 必讀（5 個，Round 22 合併後精簡）

- \`HANDOFF.md\` — §1 現狀 + §7 最近 3 rounds
- \`CHANGELOG.md\` — commit-level 變更歷史
- \`OPERATIONS.md\` — LINE bot + staging + secrets
- \`DEVELOPMENT.md\` — 測試 + 開發 + troubleshooting
- \`INDEX.md\` — 單一入口（auto-generated）

## 最近 5 個 chicken commits

\`\`\`
${LAST_5_COMMITS}
\`\`\`

## Worker 最近 3 個 commits

\`\`\`
${WORKER_COMMITS}
\`\`\`

## 下次 session 第一件事（pending tasks）

${PENDING_TASKS:-(無 pending tasks，可自由接續)}

---

## 服務重啟 SOP（任何時候 src/config.js 改了）

\`\`\`bash
# Kill 舊 process（用 PID，不是 pkill -f 避免 self-kill）
APIPID=\$(ps -eo pid,comm,args | awk '\$2=="node" && \$0~/api-server/ {print \$1; exit}')
DASHPID=\$(ps -eo pid,comm,args | awk '\$2=="node" && \$0~/dashboard-server/ {print \$1; exit}')
[ -n "\$APIPID" ] && kill "\$APIPID" && echo "killed api \$APIPID"
[ -n "\$DASHPID" ] && kill "\$DASHPID" && echo "killed dashboard \$DASHPID"
sleep 2

# 啟動新 process
nohup env API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \\
  X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token PORT=3001 \\
  node scripts/api-server.js > /tmp/api-server.log 2>&1 & disown

nohup env DASHBOARD_USERNAME=admin DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd \\
  API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \\
  WORKER_HEALTH_URL=https://external-user-line-security.kaden1122123.workers.dev/api/knowledge/stats \\
  PORT=3000 node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 & disown

# 驗證
sleep 2 && curl http://localhost:3000/healthz
\`\`\`

## 重要 ID 與路徑

| 用途 | 路徑 / ID |
|------|-----------|
| Dev repo | \`/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/\` |
| Main mirror | \`/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/\` |
| Production runtime | \`/home/clawuser/.openclaw/agents/external-user/\` |
| Worker repo | \`/home/clawuser/openclaw-workspace/external-user/cloudflare-worker/\` |
| XDG secrets | \`/home/clawuser/.config/chicken/secrets/\` |
| Dashboard | \`https://dashboard.brt1122.com\` (admin / ChickenTest2026) |
| Worker prod | \`https://external-user-line-security.kaden1122123.workers.dev\` |
| Worker staging | \`https://external-user-line-security-staging.kaden1122123.workers.dev\` |
| 老闆 LINE ID | \`Uf56650056d35626deb64165926a26182\` (chicken.yaml notify_owner.line_user_id) |
| Tailscale IP | \`100.114.197.9\` |

## ⚠️ 接手者必跳過清單（LEGACY 區塊）

- \`PHASE1_PROGRESS.md\` (Round 1 前進度，2026-06-29 標 LEGACY)
- \`docs/TODO_2026-06-26.md\`
- \`docs/CLEANUP_PHASE_2_PLAN.md\`
- \`docs/DAILY_SUMMARY_2026-06-26.md\`
- \`docs/SYSTEM_AUDIT_2026-07-19.md\` (完整 audit 已併入 HANDOFF.md §7)

判斷依據：這些檔案都已標 \`<!-- ⚠️ LEGACY -->\` 開頭標頭，或已被 Round 22 文件合併取代。

---

_本檔由 \`scripts/generate-next-prompt.sh\` 自動生成於 $(date '+%Y-%m-%d %H:%M:%S')_
_取代舊手寫 SESSION_NEXT_PROMPT.md（Round 23 自動化）_
HEADER
}

if [ "$STDOUT_ONLY" = true ]; then
  generate
else
  generate > "$OUTPUT_FILE"
  echo "✅ Updated $OUTPUT_FILE"
fi
