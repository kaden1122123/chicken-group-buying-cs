# 下個 Session Prompt（2026-07-24 21:10+ 之後接手雞味客服工作的 agent）

> **作者**：2026-07-22 23:08（Round 1+2 + Sign B + Sign C-all 全部完成 + Session close-out）
> **TL;DR**：Hubert 23:07 收尾指令，session `agent:main:discord:channel:1512213273846485058` (2d 12h+) 完整關閉。
> **本檔對齊系統現況**（2026-07-22 23:08 確認），下個 session 直接用。
> **Round 3~5 + Round 14 + 早期 handoff 歷史保留於 git log + CHANGELOG.md + memory archive**。

## 🎯 用途（Purpose）

此 prompt 是**新 session 開局 prompt**：
1. 讓接手 agent **10 分鐘內進入狀況**（不用重新探索 codebase）
2. 給**完整、開局可跑**的指令（不需要再查文檔）
3. 列出**待辦事項 + 優先度**（避免 agent 漏做或做錯順序）
4. 標明**踩雷紀錄**（省去重複 debug）
5. 提醒**3 層 enforcement**（避免 agent 編錯位置）

## 👥 讀者（Audience）

- **接手雞味客服的 brtclaw session**（首要）
- **Hubert**（手動開新 session 給 brtclaw 時可貼此 prompt）

## 🏁 結束時應該做什麼（End-of-Session Checklist）

1. 跑 `bash scripts/check-quality.sh` 確認 12 checks 全綠
2. 跑 `npm test` 確認 53 unit + integration 全綠
3. git add -A + commit + push（按 `MEMORY.md` §I-1 SOP）
4. 跑 `bash scripts/sync-mirror.sh from-legacy` 同步主鏡像
5. **更新本檔**（當前狀態表 + Round 紀錄 + 待辦事項）與 `HANDOFF.md`（§8 變更歷史 + 必要時 §5 待辦）
6. 寫當日 `memory/YYYY-MM-DD.md`（總結今天做了什麼）
7. 若有 Layer 1 變更，跑 `bash scripts/main-enforce-readonly.sh` 確認 chmod 555 恢復

---

## 開局指令（複製貼到新 session）

```
你是 brtclaw。接手雞味客服專案。Hubert 是老闆。

**先讀這三份文檔**（10 分鐘內可進入狀況）：
1. /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/HANDOFF.md
2. /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/docs/PROJECT_INVENTORY.md
3. /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/docs/handoff/sessions/SESSION_NEXT_PROMPT.md（本檔）

**先跑這 5 個指令驗證環境**：
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
bash scripts/check-quality.sh    # 應 12 通過 0 警告 0 失敗（除 Check 10 known drift）
npm test                          # 應 53 個 test 檔全綠
curl -sS -m 5 http://localhost:3000/healthz   # 應 dashboard:up, api_server:up, worker:up
ls /home/clawuser/.config/chicken/secrets/   # 應有 dashboard-pwd / api-pwd / api-token / line-bot-token

**接著查 KEY 狀態**：
- LINE 月度額度：500 messages/month。下個 reset = 2026-08-01。
- GCP service account key：建立 2026-07-16（剩 84 天寬限 / 60 天 warn / 90 天 critical）
- Worker deploy Version ID: `683f6f9b-ec22-4c1b-b96e-a6b5f39b974c`（Bug #1 雙邊 fix）
```

---

## 當前狀態（2026-07-24 21:10+，Round 20 全部完成後）

| 項目 | 狀態 |
|------|------|
| Production runtime 對齊 | ✅ 7 個關鍵 runtime 檔案雙位置 md5 同步（除 Check 10 known drift） |
| Test framework | ✅ **48/48 套已統一為 `node:test` 風格**（Sign C-all done @ 5ca4aba） |
| 測試套件 | ✅ 53 unit + 1 integration（`npm test` 全綠） |
| 品質檢查 | ✅ 11 通過 / 1 警告（Check 10）/ 0 失敗（lint:fix 後 12/1/0） |
| api-server | ✅ 跑（port 3001） |
| dashboard-server | ✅ 跑（port 3000） |
| Dashboard tunnel | ✅ `brt1122-System-09`（systemd 自動管理，PID 1543） |
| Dashboard URL | ✅ `https://dashboard.brt1122.com`（Hubert 已驗證 up） |
| Cloudflare Worker | ✅ deploy v `326f6e31`（Round 20 — 45 KB entries + Workers AI semantic scoring 取代 synonym） |
| 老闆 LINE 通知 | ✅ 重新啟用（notify_owner.enabled=true） |
| LINE push loop 防護 | ✅ HUMAN_HANDOFF guard + 1分鐘 debounce |
| 3 層 enforcement | ✅ chmod 555 + cron 10min + Check 10/11 |
| 4 announce cron delivery | ✅ 統一到 `channel:1528418702167638016` |
| dashboard-watchdog cron | ✅ 已停用（systemd 自動接管） |
| Bug #1 cascade (B08/B10/B13/B17) | ✅ 雙邊 fix 生效 |
| P0 #1 Dashboard 按鈕 | ✅ 5 筆 stale PENDING 移除（commit `8704387`） |
| P0 #2 解除轉真人按鈕 | ✅ 4th button on pending_handoff rows（commit `0a9214a`） |
| P0 #3 轉真人 reply 簡短 | ✅ verify only |
| P0 #4 LLM 日期邏輯 | ✅ main_idea.md hard-call validateDate（commit `6dabe71`） |
| P1 B14 轉帳戶名移除 | ✅ verify only |
| P1 B16 訂單確認前要列完整 | ✅ formatCustomerReply alias + 11 行完整 summary（commit `6dabe71`） |
| 資安 sign-on | ⚠️ gmail-credentials.json / google-service-account.json mode 664 待修（Sign H） |
| LINE 月度額度 | ⚠️ 額滿（reset = 2026-08-01） |

---

## Round 1+2 + Sign B + Sign C-all 完成紀錄（2026-07-20 ~ 22）

### Round 1+2（2026-07-20 22:30 → 07-21 23:18）

- ✅ Bug #1 cascade（4 個 commit + 1 Worker repo commit）
- ✅ P0 #1 Dashboard 按鈕重新生（commit `8704387`，4 amends）
- ✅ P0 #2 解除轉真人按鈕（commit `0a9214a`）
- ✅ P0 #4 main_idea.md 日期強化 + sync-canonical（commit `6dabe71`）
- ✅ P1 B16 formatCustomerReply alias（commit `6dabe71`，同時修 production crash）
- ✅ P2 文件清理 + 資安 .netrc 章節（commit `810c91b`）
- ✅ Sign B done：Worker deploy v `683f6f9b`（commit `e55767c`）

### Sign C-all（2026-07-22 08:55 → 22:30）

- ✅ 48/48 套 test framework 統一為 `node:test` 風格
- ✅ 8 commits: `51e3dcc` → `0a9cd0a` → `9adba15` → `51f4c3c` → `595c557` → `9fe0726` → `097e657` → `a649467`
- ✅ + 1 amend `5ca4aba`（timezone.test.js syntax error fix）

---

## 待辦事項（按優先度，2026-07-22 23:08 整理）

### P0 — 下個 session 第一件事（已 explore / deferred）

1. **Sign D**：Worker FAQ 前處理實作（explore 完成，2-3 hr）
   - `external-user/cloudflare-worker/src/index.ts` 缺 `/api/knowledge` endpoint
   - `chicken.yaml` `knowledge.base_path` 已備好
   - 知識庫 12 個檔案完整（01_product → 12_reply_examples + INDEX.md）
   - 預計：Worker `/api/knowledge?q=<keyword>` + keyword matching + canned reply BEFORE LLM
2. **Sign E**：GCP service account key rotate（deferred，key 84 天寬限）
   - 等 60 天 warn / 90 天 critical 再觸發
   - 或順手跑 `bash scripts/key_age_check.sh` 確認 §7.1 腳本能運作 + 設 §7.2 OpenClaw cron
3. **Sign G**：Check 10 AGENTS.md drift（deferred decision）
   - `docs/SYSTEM_AUDIT_2026-07-19.md` §3.2 列出兩種修法
   - 需 Hubert 決策 production runtime 或 docs/production-prompt 哪邊為 source of truth
4. **Sign H**：`chmod 600` 2 個檔（1 分鐘）
   - `gmail-credentials.json`、`google-service-account.json` mode 664 → 600

### P1 — 可做（不受 LINE 額度限制）

5. ✅ 已 done：P6 邏輯測試（49+1 → 51 套後又擴到 53）
6. ✅ 已 done：test framework 統一（Sign C-all 48/48 套）

### P2 — 文件持續修整

7. ✅ 已 done：CHANGELOG.md Round 14 + Round 1+2 + Sign B + Sign C-all log
8. ✅ 已 done：HANDOFF.md 完整更新 + Round 段對齊
9. ✅ 已 done：SESSION_NEXT_PROMPT.md 完整重寫（本檔）

### P3 — 長期（需求未定）

10. **B 方案優化**（待互動數據累積）
11. **LINE Pay 落後選項整合測試**（Hubert 21:54 確認不主動提供）
12. **OpenClaw Gateway vision endpoint 整合**（P6 analyzer minimax vision fallback）

---

## 3 層 Enforcement 提醒

- **永遠在 dev repo 編輯**：`cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/`
- **commit 前必跑**：`bash scripts/check-quality.sh`（12 checks：11 pass + 1 known Check 10 drift）
- **push 前必跑**：`bash scripts/sync-mirror.sh from-legacy`
- **重啟 dashboard 帶 env**：`DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd`
- **重啟 api-server 帶 env**：`API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd`
- **重啟 dashboard 帶 WORKER_HEALTH_URL**：`WORKER_HEALTH_URL=http://127.0.0.1:3001/api/health`
- **重啟 api-server 帶 B 方案 env**：`X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token`
- **修 chicken.yaml 後必跑**：`bash scripts/sync-config.sh`
- **修 main_idea.md 後必跑**：`bash scripts/sync-canonical.sh`（驗證 Check 11 通過）

---

## 服務重啟 SOP（任何時候 src/config.js 改了）

```bash
# 1. Kill 舊 process（用 PID，不是 pkill -f 避免 self-kill）
APIPID=$(ps -eo pid,comm,args | awk '$2=="node" && $0~/api-server/ {print $1; exit}')
DASHPID=$(ps -eo pid,comm,args | awk '$2=="node" && $0~/dashboard-server/ {print $1; exit}')
[ -n "$APIPID" ] && kill "$APIPID" && echo "killed api $APIPID"
[ -n "$DASHPID" ] && kill "$DASHPID" && echo "killed dashboard $DASHPID"
sleep 2

# 2. 啟動新 process（從 dev repo CWD 確保讀到正確 config）
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
nohup env API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token \
  PORT=3001 \
  node scripts/api-server.js > /tmp/api-server.log 2>&1 &
disown
sleep 1
nohup env DASHBOARD_USERNAME=admin \
  DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd \
  API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  WORKER_HEALTH_URL=http://127.0.0.1:3001/api/health \
  PORT=3000 \
  node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 &
disown

# 3. 驗證
curl -sS -m 5 http://localhost:3000/healthz
# 預期：dashboard=up, api_server=up, worker=up
```

---

## 重要 ID 與路徑

| 用途 | 路徑 / ID |
|------|-----------|
| Dev repo（永遠編輯這） | `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/` |
| Main 鏡像（chmod 555） | `/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` |
| Production runtime（LLM 讀） | `/home/clawuser/.openclaw/agents/external-user/` |
| XDG secrets | `/home/clawuser/.config/chicken/secrets/` |
| Dashboard | `https://dashboard.brt1122.com`（admin / ChickenTest2026） |
| Dashboard（LAN） | `http://192.168.0.104:3000/` |
| 老闆 LINE ID | `Uf56650056d35626deb64165926a26182`（chicken.yaml notify_owner.line_user_id） |
| Tailscale IP | `100.114.197.9` |
| GitHub remote | `github.com/kaden1122123/chicken-group-buying-cs`（private） |
| Worker Version ID | `683f6f9b-ec22-4c1b-b96e-a6b5f39b974c`（Bug #1 雙邊 fix） |

---

## git 當前狀態（2026-07-22 23:08）

```
5ca4aba  test(p1): fix timezone.test.js syntax error — missing closing paren
a649467  test(p1): Sign C-all 第 8 批 3 套 — 48/48 套全部完成
097e657  test(p1): Sign C-all 第 7 批 8 套 (40/48 套)
9fe0726  test(p1): Sign C-all 第 6 批 6 套 (32/48 套)
595c557  test(p1): Sign C 第 5 批 states 系列 4 套 (26/48 套)
51f4c3c  test(p1): Sign C-4 rules 系列 9 套 (22/48 套)
9adba15  test(p1): 統一 node:test 風格 — Sign C 第 3 批 5 套 (13/48 套)
0a9cd0a  test(p1): 統一 node:test 風格 — Sign C 第 2 批 3 套 (8/48 套)
e55767c  docs(handoff): Sign B done — Worker Bug #1 fix 部署上 Cloudflare production
810c91b  docs(testing+handoff): Round 2 文件清理 + 資安
6dabe71  feat(formatter+prompt): P1 B16 + P0 #4 — formatCustomerReply alias + main_idea.md 日期強化
0a9214a  feat(dashboard): P0 #2 解除轉真人按鈕 — stateMachine reverseIndex + clear-handoff endpoint
8704387  fix(dashboard): 重新生 dashboard.html (P0 #1 fix) — final amend (click test 還原)
23091c4  test(integration): 改用 Worker source check 取代 bundle check (Bug #1 最終)
e5f8564  test(bug1): config.test.js + integration.test.js 適配 Bug #1 fix
98151cf  fix(config): 移除「我要訂購」from ignored_keywords（Bug #1 root cause）
```

完整 log：`git log --oneline -25`（共 17 個 commits 從 7/20 22:30 → 7/22 23:08）

---

## 重要 reference

| 文檔 | 用途 |
|------|------|
| `HANDOFF.md` | 當前狀態摘要 + 待辦清單（Round 1+2 更新 @ 7/22 07:06） |
| `docs/PROJECT_INVENTORY.md` | 完整系統目錄 + 檔案清單（必讀） |
| `docs/CEO_DECISION_GUIDE.md` | 13 個 session 決策（CEO 視角） |
| `docs/ENGINEERING_HANDBOOK.md` | 工程慣例 + §6.6 三層位置架構 |
| `docs/API_CURL.md` | api-server curl 範例 |
| `docs/production-prompt/2026-07-03/` | git-managed 版本控制（含 Check 10 known drift vs production runtime） |
| `docs/handoff/sessions/SESSION_*_PROMPT.md` | 歷史 session prompts（X1-X5, A-Q 為背景參考） |
| `MEMORY.md` §I (I-1/I-2/I-3) | Commit / sync / pre-edit guard SOP |
| `memory/2026-07-22.md` | 本 session 總結（Round 1+2 + Sign B + Sign C-all） |
| `memory/archive/2026-07-2{0,1}.md` | 前次 session 總結 |
| `docs/SYSTEM_AUDIT_2026-07-19.md` | 完整系統 audit（含 AGENTS.md drift §3.2） |

---

## 不要踩的雷（精選 14 條，完整見 git log）

1. **PRODUCTION CRASH ALREADY EXISTED** — `orderFormatter.js` exports `formatOrderSummary`,但 `src/index.js` + `confirming.js` require undefined `formatCustomerReply`。Hubert 報 B16 之前 production crash。
2. **LLM 自己推理時間邏輯是 anti-pattern** — Hard-call `validateDate`（main_idea.md §強 + 列 7 reject 路徑）。
3. **OpenClaw exec 自動 redact process.env 中的密碼字串** — 用 `*_PASSWORD_FILE` / `*_TOKEN_FILE` 從檔案讀（mode 600）。
4. **pkill -f 會 self-kill**（OpenClaw 沙箱嚴格）— 用 `kill <PID>` 取代。
5. **OpenClaw 沙箱會 SIGKILL multi-process kill** — `for pid in $PIDS; do kill; done` 被視為 multi-process kill。
6. **main 鏡像有 chmod 555 保護** — sync 之前先 `chmod u+w`，sync 之後 `chmod 555` restore。
7. **OpenClaw exec 編輯時 `***` 可能是 redact，不是 placeholder** — 寫 `trimmed` 不是 `***`。
8. **Worker URL 寫死 dashboard-server.js** — 改 `WORKER_HEALTH_URL` 環境變數才不會 404。
9. **api-server POST /api/orders 回 201 Created 不是 200** — postOrder 條件用 `200 || 201`。
10. **Google Sheets API 第一次用要 Enable** — 等 1-2 分鐘傳播。
11. **state machine 轉換處要明確擋同狀態重複觸發**（LINE push loop 教訓）。
12. **notifyHubert 失敗不該算 autoOrder 失敗** — inner try-catch 包，outer 繼續。
13. **test 轉換用 `node:test` pattern 易踩 syntax** — 轉換完每個檔立即 `node -c` 驗證 syntax。
14. **lint:fix 是 session 收尾 SOP 的好朋友** — CI push 阻擋需 0 errors。

---

## Dashboard Tunnel SOP（named tunnel）

Dashboard tunnel 使用 `brt1122-System-09` named tunnel（systemd service 自動管理，PID 1543 從 5/02 穩定跑 80+ 天）。

```bash
# 查看 tunnel 狀態
bash scripts/manage-tunnel.sh status
# 查看完整 tunnel 資訊（包含 Dashboard hostname）
bash scripts/manage-tunnel.sh info
# 如 tunnel 異常，手動重啟 systemd service
bash scripts/manage-tunnel.sh restart
# 詳細 SOP：docs/NAMED_TUNNEL_MIGRATION.md
```

---

## 🔑 Session 結束 SOP 觸發關鍵字

當 user 訊息包含以下任一關鍵字時，**直接自動執行 `docs/SESSION_END_SOP.md`**（不需要確認）：

```
中文觸發：新 session / 新分頁 / 下次 / 下次見 / 明天見 / 晚點 / 待會 / 之後 /
        關掉 / 結束 / close / end / goodbye / bye /
        Session 結束 / 文件收尾 / drift 修整 / session 儲存

英文觸發：new session / next time / see you / goodbye / bye /
        session end / doc cleanup / drift fix / session close

手動觸發：「跑 Session 結束 SOP」/「更新狀態文件」/「session close」
```

SOP 內容見 `docs/SESSION_END_SOP.md`（7 步 / 5 分鐘：check-quality → 更新 CHANGELOG/HANDOFF/PROJECT_INVENTORY/SESSION_NEXT_PROMPT → commit + push + sync）。

**如果發現 drift**（文件與系統不一致）：立即執行 Session 結束 SOP 修正（drift 是高優先度）。

---

## ⚠️ 接手者必跳過清單（LEGACY 區塊）

**請勿 read 以下 3 個檔案**（已由 `CHANGELOG.md` 取代，讀這些只會浪費 session token）：

1. `PHASE1_PROGRESS.md`（875 行，6/7/3 最後更新）— Phase 1 進度報告
2. `docs/TODO_2026-06-26.md`（432 行，6/26 最後更新）— 評估與修整 TODO
3. `docs/CLEANUP_PHASE_2_PLAN.md`（481 行，6/28 最後更新）— Cleanup Phase 2 修整計畫

**判斷依據**：
- 這 3 個檔案都已標 `<!-- ⚠️ LEGACY -->` 開頭標頭
- 內容是舊 session 進度（2026-06~07），最新狀態以 `CHANGELOG.md` 為準
- 完整 audit 報告見 `docs/SYSTEM_AUDIT_2026-07-19.md`
- 詳見 `docs/SYSTEM_AUDIT_2026-07-19.md` §6 L1

**如果你只是要快速了解系統現狀**：直接讀 `CHANGELOG.md` + `HANDOFF.md` + `docs/SYSTEM_AUDIT_2026-07-19.md` 就夠了。

---

## 給接手 agent 的最後提醒

1. **永遠在 dev repo 編輯**（`pwd` 確認）— chmod 555 保護 main 鏡像
2. **commit 前跑 `check-quality.sh` + `npm test`**（12 checks + 53 test 全綠）
3. **push 前跑 `sync-mirror.sh from-legacy`**（避免 main drift）
4. **notify_owner.enabled 控制 push**（bug fix 後可正常啟用）
5. **任何檔案路徑變更先 grep 全專案**（chicken.yaml / main_idea.md / routes 都互相引用）
6. **OpenClaw exec redact `***`** — 寫 `trimmed` 不是 `***`
7. **api-server POST 回 201**（POST 建立資源標準）— postOrder 條件用 200||201
8. **state machine guard**（HUMAN_HANDOFF + 1分鐘 debounce）— 防止 LINE push loop
9. **inner try-catch 包外部副作用**（notifyHubert 失敗不影響主流程 success）
10. **file mode 555/664 差異** — Layer 1 chmod 555 保護 main 鏡像，production runtime 是 664
11. **OpenClaw 沙箱限制 multi-process kill** — 一次殺一個 PID
12. **89 cloudflared leaked processes** — 不要殺 PID 1543（agent），只殺 --url tunnel
13. **lint:fix 是 session close 必跑**（CI push 阻擋 0 errors）
14. **node:test 轉換後跑 `node -c <file>` 驗 syntax**（避免 timezone.test.js style syntax error）

完成上述 5 步後，跟 Hubert 確認從 Sign D（Worker FAQ 前處理）開始，這是 explore 完成 + 待實作的 P0。

---

## 🆕 Round 19+20 收尾（2026-07-24 21:10+）

**已 commit**: `56db907`（chicken, final）+ Worker `b5c9d1a` deploy v `326f6e31` (prod) / `1056d177` (staging)
**每日總結**: `memory/2026-07-24.md`（Round 19 全部 + Round 20 partial）
**check-quality**: 13 pass / 1 warn / 0 fail
**npm test**: 30 / 30 pass（含 Round 19 C5 inverted index + cache + Round 18 Bug 1+2 fix tests）
**/healthz**: dashboard / api_server / worker 全 up

### Round 19 完成（Hubert 10:49 指示 8 個 task）
- **Task A**: `docs/TESTING_TROUBLESHOOTING.md` (`9efdb1a`) — 7 種常見問題 + P0/P1/P2 分級
- **Task B**: LINE bot config 整合 (`8ef89be`) — 修 `LINE_BOT_TOKEN` drift + `.env.example` + `docs/LINE_BOT_SETUP.md`
- **Task C1**: Semantic scoring via synonyms (Worker `aa31757` + deploy v `f2458aee`)
- **Task C2**: 客戶標籤自動判斷 (`d5a7604`) — `scripts/customer-tags.js` (rule-based 5 類 23 規則)
- **Task C3**: L2 .bak cleanup (`846fc76`) — `scripts/cleanup-baks.sh` 7-day buffer
- **Task C4**: Worker staging 環境 (Worker `23bf5da`) — `wrangler.staging.toml` + `docs/STAGING.md`
- **Task C5**: KB inverted index + LRU cache (Worker `6c3e2a7`) — 30/30 tests pass
- **Task D**: `docs/AGENT_PROJECT_SOP.md` (`7ec11ac`) — 18 個建置步驟 + 完成清單
- **Task E**: 狀態文件更新防 drift

### Round 20 完成（Hubert 21:10 指示 4 個補齊任務）
- **Task 2**: wrangler staging setup (`2ac093d` + `83d36bc57b6b4505aa24ad684483e00c` KV) + deploy v `12a5bd4d`
- **Task 3**: Workers AI embeddings 取代 synonym (Worker `b5c9d1a` + deploy v `326f6e31` prod / `1056d177` staging) — `@cf/baai/bge-m3` multilingual
- **Task 4**: `/api/customer-tags/:userId` endpoint (`2486033`) — integrate `scripts/customer-tags.js` rule-based
- **Task 5**: `bash scripts/cleanup-baks.sh --force` — 0 files deleted (全部在 1-5 天 buffer 內)
- **Status files**: HANDOFF.md + CHANGELOG.md + .env.example + docs/LINE_BOT_SETUP.md (`56db907`)

### 下次 session 第一件事
1. **設定 staging Worker secrets**（LINE_BOT_TOKEN / LINE_CHANNEL_SECRET for staging）
2. **Workers AI embeddings 上線 24hr 監控**（看實際 LINE 訊息 semantic match 命中率）
3. **真實 LINE Bot 帳號測試**（換 `LINE_BOT_TOKEN` secret 用真實帳號）
4. **加 `/api/customer-tags` 整合測試**（手動測試幾個用戶 ID）
5. **`/api/customer-tags` 加到 dashboard**（UI 顯示客戶標籤）
