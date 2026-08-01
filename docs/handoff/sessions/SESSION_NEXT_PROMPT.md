# 下個 Session Prompt（自動生成於 2026-08-01 20:04:20）

> **本檔由 `scripts/generate-next-prompt.sh` 自動生成**（Round 23）
> **手動編輯請注意**：下次跑 script 會被覆蓋靜態 sections
> **重新生成**：`bash scripts/generate-next-prompt.sh`

---

## 🎯 用途

接手 session 第一件事是讀這檔的「當前狀態 + 下次 session 第一件事」兩個 section。其他 section 看需不需要。

## 👥 讀者

接手雞味客服工作的 brtclaw session（首要），Hubert（owner）偶爾查看。

## 🏁 結束時應該做什麼

1. 跑 `bash scripts/check-quality.sh` 確認 12 checks 全綠
2. 跑 `npm test` 確認 61 tests 全綠
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

# 2. 讀必讀（Round 34 單一入口）
cat NEW_SESSION_README.md         # 10 分鐘上手（單一入口）
cat docs/OPERATIONS.md | head -50 # 部署 SOP
cat docs/DEVELOPMENT.md | head -50 # 開發 SOP
cat docs/adr/0001-0005.md         # 5 個架構決策
```

## 當前狀態（自動生成於 2026-08-01 20:04:20）

| 項目 | 狀態 |
|------|------|
| Chicken repo last commit | `819e9e4 docs(handoff): Round 34 handoff + HUBERT_USER_GUIDE.md + main mirror sync` |
| Worker last commit | `148d7df` |
| Worker deploy version | `dfa555f4-855d-4f22-b534-01a9bb3e91cc` |
| Test count | 61 tests |
| Cron jobs | 0 active |
| Check quality | `⚠ 品質檢查通過（含 1 項警告，建議處理）` |
| Staging ready | ✅ (KV `83d36bc57b6b4505aa24ad684483e00c`) |

## 必讀（5 個，Round 34 重整為單一入口）

- `NEW_SESSION_README.md` — **10 分鐘上手手冊**（單一入口，Round 34 取代舊 HANDOFF.md 等多個交接文件）
- `CHANGELOG.md` — commit-level 變更歷史
- `OPERATIONS.md` — LINE bot + staging + secrets
- `DEVELOPMENT.md` — 測試 + 開發 + troubleshooting
- `INDEX.md` — 單一入口（auto-generated）

> **接手變更**：舊 `HANDOFF.md` / `SESSION_NEXT_PROMPT.md` / `ARCHITECTURE_CURRENT_STATE_2026-08-01.md` 內容已併入 `NEW_SESSION_README.md`，標頭已標 LEGACY。

## 最近 5 個 chicken commits

```
819e9e4 docs(handoff): Round 34 handoff + HUBERT_USER_GUIDE.md + main mirror sync
9c27061 perf(handoff): 客戶轉真人通知改 channels: ['email'] — 節省 LINE 額度
ea0e28c docs(fix): 修 CEO_DECISION_GUIDE.md 6 個剩餘 .archive/[/] 格式 broken links
cfb071b docs(fix): 修 CEO_DECISION_GUIDE.md + SPEC.md 7 個 .archive broken links
5b45458 docs(fix): 修 check-quality Check 12 failure — 8 個 .archive broken links
```

## Worker 最近 3 個 commits

```
148d7df fix(worker): Round 31 hotfix #4 — 移除 Workers AI + greeting canned reply（Hubert 18:05）
96bedb4 fix(worker): Round 31 hotfix #3 — TDZ bug 修復（Hubert 17:50）
e426191 fix(worker): Round 31 hotfix #2 — STEP 4.6 semantic match timeout 2s
```

## 下次 session 第一件事（pending tasks）

  - [ ] 翻 OpenClaw source 找 `Exec failed` 源頭
  - [ ] 從 OpenClaw session 重建客戶 context（清污染）
  - [ ] 清理 `agents/external-user/*.bak.*` 18 個檔案
  - [ ] Prune `sessions/` 16384 個 entries
  - [ ] 更新 `HANDOFF.md` + `INDEX.md` + `SESSION_NEXT_PROMPT.md`（stale）

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

_本檔由 `scripts/generate-next-prompt.sh` 自動生成於 2026-08-01 20:04:20_
_取代舊手寫 SESSION_NEXT_PROMPT.md（Round 23 自動化）_
