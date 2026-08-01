# 下個 Session Prompt（自動生成於 2026-07-25 11:41:30）

> **本檔由 `scripts/generate-next-prompt.sh` 自動生成**（Round 23）
> **last_updated**：2026-07-29（Round 28 📐 補齊）
> **手動編輯請注意**：下次跑 script 會被覆蓋靜態 sections
> **重新生成**：`bash scripts/generate-next-prompt.sh`

---

## 🎯 用途

接手 session 第一件事是讀這檔的「當前狀態 + 下次 session 第一件事」兩個 section。其他 section 看需不需要。

## 👥 讀者

接手雞味客服工作的 brtclaw session（首要），Hubert（owner）偶爾查看。

## 🏁 結束時應該做什麼

1. 跑 `bash scripts/check-quality.sh` 確認 12 checks 全綠
2. 跑 `npm test` 確認 54 tests 全綠
3. git add -A + commit + push（按 §I-1 SOP）
4. 跑 `bash scripts/sync-mirror.sh from-legacy` 同步主鏡像
5. 寫當日 `~/.openclaw/workspace/memory/YYYY-MM-DD.md`
6. 跑 `bash scripts/generate-next-prompt.sh` 重新生成本檔
7. 跑 `bash scripts/generate-docs-index.sh` 更新 INDEX.md

## 📚 參考 Best Practices

- [session-handoff skill](https://github.com/softaworks/agent-toolkit) — Zero ambiguity
- [Project Handover Templates (plane.so)](https://plane.so/blog/what-is-a-project-handover-steps-checklist-and-best-practices) — Structured transfer

## 開局指令（複製貼到新 session）

```
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
```

## 當前狀態（自動生成於 2026-07-25 11:41:30）

| 項目 | 狀態 |
|------|------|
| Chicken repo last commit | `0f61a39 refactor(docs): Round 22 — 合併 5 個 SOP（刪 3 + 新 3）減少 67% token` |
| Worker last commit | `e08b2cc` |
| Worker deploy version | `f9d39dfa-3990-4f32-a06c-e93b4dbaba0d` |
| Test count | 54 tests |
| Cron jobs | 0 active |
| Check quality | `  - 真實訂單消失：git checkout HEAD -- data/orders/chicken/` |
| Staging ready | ✅ (KV `83d36bc57b6b4505aa24ad684483e00c`) |

## 必讀（5 個，Round 22 合併後精簡）

- `HANDOFF.md` — §1 現狀 + §7 最近 3 rounds
- `CHANGELOG.md` — commit-level 變更歷史
- `OPERATIONS.md` — LINE bot + staging + secrets
- `DEVELOPMENT.md` — 測試 + 開發 + troubleshooting
- `INDEX.md` — 單一入口（auto-generated）

## 最近 5 個 chicken commits

```
0f61a39 refactor(docs): Round 22 — 合併 5 個 SOP（刪 3 + 新 3）減少 67% token
e2131ba feat(dashboard): Round 21 Task 4 — /api/customer-tags/:userId endpoint + dashboard UI panel
4ee8b7f docs(handoff): SESSION_NEXT_PROMPT.md Round 20 收尾狀態更新
56db907 docs(scripts): Round 19/20 累積文件 + .env.example 更新
```

## Worker 最近 3 個 commits

```
e08b2cc refactor(docs): Round 22 — 刪除 STAGING.md + STAGING_SECRETS_SETUP.md（已合併到 chicken docs/OPERATIONS.md）
a800020 docs(worker): STAGING_SECRETS_SETUP.md — staging Worker secrets 設定 SOP
b5c9d1a feat(worker): Round 20 C1 — Workers AI embeddings 取代 synonym dictionary
```

## 下次 session 第一件事（pending tasks）

(無 pending tasks，可自由接續)

---

## 服務重啟 SOP（任何時候 src/config.js 改了）

```bash
# Kill 舊 process（用 PID，不是 pkill -f 避免 self-kill）
APIPID=$(ps -eo pid,comm,args | awk '$2=="node" && $0~/api-server/ {print $1; exit}')
DASHPID=$(ps -eo pid,comm,args | awk '$2=="node" && $0~/dashboard-server/ {print $1; exit}')
[ -n "$APIPID" ] && kill "$APIPID" && echo "killed api $APIPID"
[ -n "$DASHPID" ] && kill "$DASHPID" && echo "killed dashboard $DASHPID"
sleep 2

# 啟動新 process
nohup env API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token PORT=3001 \
  node scripts/api-server.js > /tmp/api-server.log 2>&1 & disown

nohup env DASHBOARD_USERNAME=admin DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd \
  API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  WORKER_HEALTH_URL=https://external-user-line-security.kaden1122123.workers.dev/api/knowledge/stats \
  PORT=3000 node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 & disown

# 驗證
sleep 2 && curl http://localhost:3000/healthz
```

## 重要 ID 與路徑

| 用途 | 路徑 / ID |
|------|-----------|
| Dev repo | `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/` |
| Main mirror | `/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` |
| Production runtime | `/home/clawuser/.openclaw/agents/external-user/` |
| Worker repo | `/home/clawuser/openclaw-workspace/external-user/cloudflare-worker/` |
| XDG secrets | `/home/clawuser/.config/chicken/secrets/` |
| Dashboard | `https://dashboard.brt1122.com` (admin / ChickenTest2026) |
| Worker prod | `https://external-user-line-security.kaden1122123.workers.dev` |
| Worker staging | `https://external-user-line-security-staging.kaden1122123.workers.dev` |
| 老闆 LINE ID | `Uf56650056d35626deb64165926a26182` (chicken.yaml notify_owner.line_user_id) |
| Tailscale IP | `100.114.197.9` |

## ⚠️ 接手者必跳過清單（LEGACY 區塊）

- `PHASE1_PROGRESS.md` (Round 1 前進度，2026-06-29 標 LEGACY)
- `docs/TODO_2026-06-26.md`
- `docs/CLEANUP_PHASE_2_PLAN.md`
- `docs/DAILY_SUMMARY_2026-06-26.md`
- `docs/SYSTEM_AUDIT_2026-07-19.md` (完整 audit 已併入 HANDOFF.md §7)

判斷依據：這些檔案都已標 `<!-- ⚠️ LEGACY -->` 開頭標頭，或已被 Round 22 文件合併取代。

---

_本檔由 `scripts/generate-next-prompt.sh` 自動生成於 2026-07-25 11:41:30_
_取代舊手寫 SESSION_NEXT_PROMPT.md（Round 23 自動化）_
