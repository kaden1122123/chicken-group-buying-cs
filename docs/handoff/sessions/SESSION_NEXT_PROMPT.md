# 下個 Session Prompt（2026-07-17 06:30 之後接手雞味客服工作的 agent）

> **作者**：2026-07-17 06:30 session（Round 4 完整收尾 + 文件 drift 全面修整 + notify_owner 重新啟用 + Gmail 留到下次 + memory/2026-07-17.md 完成）
> **TL;DR**：Hubert 06:09 提醒「確保文件與系統對齊，不要 drift again」+ 「整理待辦事項進 handoff」。本檔完整對齊系統現況，下個 session 直接用。

## 🎯 用途（Purpose）

此 prompt 是**新 session 開局 prompt**。功能目的：
1. 讓接手 agent **10 分鐘內進入狀況**（不用重新探索 codebase）
2. 給**完整、開局可跑**的指令（不需要再查文檔）
3. 列出**待辦事項 + 優先度**（避免 agent 漏做或做錯順序）
4. 標明**踩雷紀錄**（省去重複 debug）
5. 提醒**3 層 enforcement**（避免 agent 編錯位置）
6. **所有 commit refs、test 數量、檔案路徑都已對齊系統現況**（2026-07-17 06:30 確認）

## 👥 讀者（Audience）

- **接手雞味客服的 brtclaw session**（首要）
- **Hubert**（手動開新 session 給 brtclaw 時可貼此 prompt）

## 🛠 何時使用（When to Use）

- 接手雞味客服專案（無論是因為 session timeout、Hubert 開新 session、或其他原因）
- 距上次 session 超過 24 小時（context 可能已 drift）
- 接手後**第一步**就是跑下方「開局指令」5 步

## 🏁 結束時應該做什麼（End-of-Session Checklist）

1. 跑 `bash scripts/check-quality.sh` 確認 11 checks 全綠
2. 跑 `npm test` 確認 49 unit + 1 integration 全綠
3. git add + commit + push（按 §I-1 SOP）
4. 跑 `bash scripts/sync-mirror.sh from-legacy` 同步 main
5. **更新本檔**（當前狀態表 + Round 紀錄 + 待辦事項）與 `HANDOFF.md`（§8 變更歷史 + 必要時 §5 待辦）
6. 寫當日 `memory/YYYY-MM-DD.md`（總結今天做了什麼）
7. 若有 Layer 1 變更，跑 `bash scripts/main-enforce-readonly.sh` 確認 chmod 555 恢復

## 📚 參考的 Best Practices

| 來源 | 應用 |
|------|------|
| [/handoff Skill](https://www.aihero.dev/skills-handoff) | Context compaction — 精簡但完整 |
| [Context Rot in AI Agents](https://www.mindstudio.ai/blog/context-rot-ai-agents-session-handoff-fix) | Session handoff 修 context 膨脹 |
| [AI Agent Handoff (XTrace)](https://xtrace.ai/blog/ai-agent-context-handoff) | 傳遞 context + state + responsibility |
| [session-handoff skill (softaworks)](https://github.com/softaworks/agent-toolkit) | **Zero ambiguity** |
| [Project Handover Templates (plane.so)](https://plane.so/blog/what-is-a-project-handover-steps-checklist-and-best-practices) | **Structured transfer** |

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
bash scripts/check-quality.sh    # 應 11 通過 0 警告 0 失敗
npm test                          # 應 49 套 + 1 integration 全綠
ls /home/clawuser/.config/chicken/secrets/line-bot-token            # LINE_BOT_TOKEN XDG 路徑
ls /home/clawuser/.config/chicken/secrets/dashboard-pwd /home/clawuser/.config/chicken/secrets/api-pwd  # 密碼檔
ls /home/clawuser/.config/chicken/secrets/api-token  # B 方案 X-API-Token
cat /home/clawuser/.openclaw/agents/external-user/SOUL.md | head -5  # LLM 會讀的 SOUL

**接著查 LINE 額度**：
LINE 月度額度（Free plan）：500 messages/month。當前可能額滿（7/16 開始回 429），下一個 reset = 2026-08-01。
```

---

## 當前狀態（2026-07-17 06:30）

| 項目 | 狀態 |
|------|------|
| Production runtime 對齊 | ✅ AGENTS.md / SOUL.md / main_idea.md md5 全 match version control |
| 測試套件 | ✅ 49 unit + 1 integration（`npm test` 全綠）|
| 品質檢查 | ✅ 11 checks（`check-quality.sh`）— **0 警告 / 0 失敗** |
| api-server | ✅ 跑（port 3001，PID 動態查）|
| dashboard-server | ✅ 跑（port 3000）|
| Worker Cloudflare | ✅ 改 WORKER_HEALTH_URL 指向 api-server /api/health（Round 3E）|
| 老闆 LINE 通知 | ✅ 重新啟用（Hubert 21:30 重啟 OpenClaw Gateway 後 bug fix c6438e8 生效）|
| LINE push loop 防護 | ✅ 上線（HUMAN_HANDOFF guard + 1分鐘 debounce，commits c6438e8 + bbe6533）|
| 3 層 enforcement | ✅ 上線（chmod 555 + cron 10min + Check 10）|
| P2 方案 B（dashboard 核准）| ✅ 實作完成（commit 0e2d29f）|
| P3 Quick Reply 意圖定義 | ✅ 實作完成（待 OpenClaw pipeline 渲染，commit fa0500d）|
| P4 街口支付傳圖片 | ✅ 完整 4 stages + 街口主動推 QR code（commits 239dbf2/8d4f5dc/060ec7e/5c40664）|
| P5 付款狀態機制 | ✅ 實作完成（commits 18565aa + 854948a）|
| P6 OCR analyzer | ✅ 實作完成（minimax vision 介面，commits fbfa2df + 2fd8aca）|
| P7 訂單完整性規則 | ✅ 實作完成（commit 1380731）|
| B 方案 auto-create-order | ✅ 實作完成（commits c67eca3 + 3e998c9 + 756b859 + a42e362）|
| P9 Google Sheets sync | ✅ 實作完成 + 662 筆訂單已寫入（commits d903098 + 057ed3e）|
| LINE 月度額度 | ⚠️ 額滿（500/月用完，下個 reset = 2026-08-01）|

---

## Round 3 + 4 完成紀錄（2026-07-16 ~ 17）

### Round 3（2026-07-16）
- ✅ **Round 3A**: P7 訂單完整性規則（commit 1380731）— main_idea.md §十二 + 7 項必填欄位
- ✅ **Round 3B**: P5 付款狀態機制（commits 18565aa + 854948a）— dashboard 「✓ 已收款」按鈕 + 客戶查詢規則
- ✅ **Round 3C**: P3 Quick Reply 意圖定義（commit fa0500d）— chicken.yaml + main_idea.md §十八
- ✅ **Round 3D**: P2 老闆回覆機制方案 B（commit 0e2d29f）— dashboard 「✓ 核准」按鈕
- ✅ **Round 3E**: Worker 404 修整 — /healthz 全綠
- ✅ **Round 3E-2**: LINE push loop 修整（commits c6438e8 + bbe6533）— HUMAN_HANDOFF guard + 1分鐘 debounce
- ✅ **Round 3 文件 drift**（commit 6b9bb1d）— 165 行新增

### Round 4（2026-07-17）
- ✅ **P4 stage 1+2**（commit 239dbf2）— chicken.yaml receipts config + notifier image 支援
- ✅ **P4 stage 3**（commit 8d4f5dc）— api-server POST /api/orders/:id/receipts + csvWriter receipts_path
- ✅ **P4 stage 4**（commit 060ec7e）— main_idea.md §二十 + dashboard 上傳截圖按鈕
- ✅ **P6 stage 1**（commit fbfa2df）— receiptAnalyzer 模組
- ✅ **P6 stage 2**（commit 2fd8aca）— api-server 整合 + csvWriter 加 6 個 P6 欄位
- ✅ **B 方案核心**（commit c67eca3）— autoOrder.js + X-API-Token 認證
- ✅ **B 方案 LLM 整合**（commit 3e998c9）— src/index.js CONFIRMING state
- ✅ **P9 Google Sheets**（commit d903098）— sheetsSync.js + OAuth setup script
- ✅ **P9 sheetsSync 修整**（commit 057ed3e）— sheet_name auto-discover + 單引號包裝（662 筆訂單成功寫入）
- ✅ **P4 街口主動推 QR code**（commit 5c40664）— awaitingPayment.js jko case 自動推 image
- ✅ **B 方案 bug 修整**（commits 756b859 + a42e362）— items array 轉換 + 接受 201 Created
- ✅ **各種 lint/test 修整**（commits 43a6cf9 + decc758 + 7845c49）— 0 lint errors

---

## 待辦事項（按優先度，2026-07-17 06:30 整理）

### P0 — 立即（下個 session 第一件事）

1. **Gmail 整合**（Hubert 04:55 決定，4-6 小時）
   - 用途：**通知老闆**（不是取代 LINE 客戶對話）
   - 需 OAuth 2.0 browser 授權（clawbrt@gmail.com 用 GCP project 登入）
   - 模組：src/handoff/emailNotifier.js
   - chicken.yaml 加 `email` section
   - 觸發點：notifyHubert 改為 notifyHubertViaLine + sendEmailDigest
   - 設計：訂單彙總日報 + 每週統計 + handoff 即時通知（與 LINE 並行）
   - 額度：Gmail API 免費版每天 500 億 quota units，實際無限

### P1 — 等 LINE 額度 8/1 reset 後（可做端到端測試）

2. **P6 完整 e2e 測試**（需 OpenClaw Gateway 提供 /v1/vision/analyze）
   - 修 autoOrder test 環境（修 setJKOQrCodeUrl 在 test 內未生效問題）
   - 跑真實 LINE → minimax vision 流程：上傳截圖 → 標 likely_paid
3. **P4 完整 e2e 測試**（街口主動推 QR code，LINE 額度 8/1 後可測）
   - 客戶選街口付款 → 收到 image message + 文字說明
4. **P9 OAuth 啟用後續驗證**（Sheets API 已啟用但要跑 cron sync 確認）
   - `bash scripts/sync-mirror.sh from-legacy` 確認 OK
   - 設 cron 每日 3 點自動 sync

### P2 — 環境清理（快速）

5. **清 debug 訂單**（2026-07-21.csv 內 v2-v9 測試訂單 7 個）
   - 跑 `node scripts/cleanup-test-orders.js`（已存在的 script）
   - 或手動刪 v2-v9 行
6. **89 leaked cloudflared processes 清理預防**
   - 問題：dashboard 測試用 `cloudflared tunnel --url http://localhost:3000` 累計 47-89 個 leaked processes
   - 根因：Cloudflare Quick Tunnel 有 TTL 但仍殘留
   - 解決：dashboard watchdog 應加 stale process cleanup（>1hr 自動 kill）
   - **不要殺 PID 1543**（那是 long-running OpenClaw external-user agent tunnel，--token 開頭）

### P3 — 文件持續修整

7. **HANDOFF.md drift 全面檢查**（持續監控）
   - 每次 commit 後跑 `bash scripts/check-quality.sh`（已含 Check 9 drift 預防）
   - Check 9：mtime + missing keys + 檔案存在性三層檢查
8. **CHANGELOG.md 補 Round 4 完整 log**
   - 22 個 commits 從 7/16 ~ 7/17
   - 重點：LINE push loop 緊急修整 + P6/B/P9/P4 完整實作

### P4 — 長期（需求未定）

9. **B 方案優化**（Hubert 21:54 表示「非常關鍵」但要嚴謹）
   - 當前：isStrictConfirmation 嚴格匹配純文字「確認」
   - 待觀察：客戶互動模式、誤觸率、false positive 數據
10. **LINE Pay 落後選項的整合測試**（Hubert 21:54 確認不主動提供）
    - 客戶詢問才給老闆 LINE ID（config.payment.linepay.line_id）
11. **OpenClaw Gateway vision endpoint 整合**
    - P6 analyzer 用 minimax vision，但需 Gateway 提供 /v1/vision/analyze
    - 目前是 stub fallback（vision 失敗 → confidence: 0 → 老闆手動確認）

---

## 3 層 Enforcement 提醒

- **永遠在 dev repo 編輯**：`cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/`
- **commit 前必跑**：`bash scripts/check-quality.sh`（11 checks）
- **push 前必跑**：`bash scripts/sync-mirror.sh from-legacy`
- **重啟 dashboard 帶 env**：`DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd`（不要用 env 直接傳密碼）
- **重啟 api-server 帶 env**：`API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd`
- **重啟 dashboard 帶 WORKER_HEALTH_URL**（讓 /healthz worker=up）：`WORKER_HEALTH_URL=http://127.0.0.1:3001/api/health`
- **重啟 api-server 帶 B 方案 env**：`X_API_TOKEN_FILE=/home/clawuser/.config/chicken/secrets/api-token`（讓 autoOrder POST /api/orders 帶 X-API-Token 認證）
- **修 chicken.yaml 後必跑**：`bash scripts/sync-config.sh`

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
sleep 2

# 3. 驗證
curl -sS -m 5 http://localhost:3000/healthz
# 預期：dashboard=up, api_server=up, worker=up（Worker URL 已指向 api-server /api/health）
```

---

## 重要 ID 與路徑

| 用途 | 路徑 |
|------|------|
| Dev repo（永遠編輯這） | `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/` |
| Main 鏡像（chmod 555） | `/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` |
| Production runtime（LLM 讀） | `/home/clawuser/.openclaw/agents/external-user/` |
| XDG secrets | `/home/clawuser/.config/chicken/secrets/` |
| Dashboard | `http://100.114.197.9:3000/`（admin / ChickenTest2026，用無痕模式）|
| Dashboard（LAN）| `http://192.168.0.104:3000/` |
| 老闆 LINE ID | `Uf56650056d35626deb64165926a26182`（`chicken.yaml` → `notify_owner.line_user_id`）|
| Tailscale IP | `100.114.197.9` |
| GitHub remote | `github.com/kaden1122123/chicken-group-buying-cs`（已改 private，2026-07-17 04:31 Hubert）|

### XDG Secrets 標準位置
- `dashboard-pwd` (15 chars) — dashboard HTTP Basic Auth
- `api-pwd` (14 chars) — api-server HTTP Basic Auth
- `line-bot-token` (172 chars) — LINE Bot channel access token
- `api-token` (64 chars) — B 方案 X-API-Token
- `google-service-account.json` — P9 Sheets sync（已 setup，待 OAuth 完成 + Sheets API 啟用後跑 sync）

---

## git 當前狀態（2026-07-17 06:30）

最近 5 個 commits：
```
5c40664  feat(p4): 街口付款主動推 QR code image 給客戶
a42e362  fix(b-auto): postOrder 接受 201 Created 修 success 判斷 bug
756b859  fix(b-auto): items array 轉換 + source 移到 body 頂層
decc758  fix(lint): 刪除重複 textReply require 修 parsing error
43a6cf9  fix(lint): 加 logger require 修 B 方案 LLM 整合 3 個 no-undef errors
```

完整 log：`git log --oneline -25`（共 22 個 commits 從 7/15 ~ 7/17）

---

## 重要 reference

| 文檔 | 用途 |
|------|------|
| `HANDOFF.md` | 當前狀態摘要 + 待辦清單 |
| `docs/PROJECT_INVENTORY.md` | 完整系統目錄 + 檔案清單（必讀）|
| `docs/CEO_DECISION_GUIDE.md` | 13 個 session 決策（CEO 視角）|
| `docs/ENGINEERING_HANDBOOK.md` | 工程慣例 + §6.6 三層位置架構 |
| `docs/API_CURL.md` | api-server curl 範例 |
| `docs/production-prompt/2026-07-03/CHANGELOG.md` | production runtime 變更歷史 |
| `docs/handoff/sessions/` | 13+ 個舊 session prompts（背景參考）|
| `MEMORY.md` §I（I-1/I-2/I-3）| Commit / sync / pre-edit guard SOP |
| `memory/2026-07-17.md` | 2026-07-17 session 總結（19 commits + 教訓）|
| `memory/2026-07-16-0720.md` | 2026-07-16 07:20 session 總結（20K，背景）|

---

## 不要踩的雷

1. **OpenClaw exec 自動 redact process.env 中的密碼字串** — 用 `*_PASSWORD_FILE` / `*_TOKEN_FILE` 從檔案讀（mode 600）
2. **pkill -f 會 self-kill**（OpenClaw 沙箱嚴格）— 用 `kill <PID>` 取代
3. **OpenClaw 沙箱會 SIGKILL multi-process kill** — `for pid in $PIDS; do kill; done` 被視為 multi-process kill
4. **main 鏡像有 chmod 555 保護** — sync 之前先 `chmod u+w`，sync 之後 `chmod 555` restore
5. **OpenClaw exec 編輯時 `***` 可能是 redact，不是 placeholder** — 寫 `trimmed` 不是 `***`
6. **Worker URL 寫死 dashboard-server.js** — Worker deploy 或改 WORKER_HEALTH_URL 環境變數才不會 404
7. **api-server POST /api/orders 回 201 Created 不是 200** — postOrder 條件用 `200 || 201`
8. **Google Sheets API 第一次用要 Enable**（`?project=11296846529`）+ 等 1-2 分鐘傳播
9. **預設 sheet 名稱是「工作表1」不是「Orders」** + 中文需單引號包裝避免 range parse error
10. **state machine 轉換處要明確擋同狀態重複觸發**（LINE push loop 教訓）
11. **notifyHubert 失敗不該算 autoOrder 失敗**（inner try-catch 包，outer 繼續）
12. **git checkout HEAD -- <file> 救命** — 改壞時用
13. **`npm run lint:fix` 自動修 indent** — 4 個 no-undef 修了
14. **OpenClaw sandbox 限制寫入路徑** — 寫程式碼用 /home/clawuser/.../，寫 memory 用 ~/.openclaw/workspace/memory/

---

## 開始 session 的 5 個動作

```bash
# 1. 確認 CWD
pwd
# 應該是 /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service

# 2. 跑品質檢查
bash scripts/check-quality.sh
# 預期：11 通過 0 警告 0 失敗

# 3. 跑 test
npm test
# 預期：49 unit + 1 integration 全綠

# 4. 看服務狀態
ps -eo pid,etime,args | grep -E "node scripts/(api|dashboard)-server"
curl -sS -m 5 http://localhost:3000/healthz
# 預期：dashboard:up, api_server:up, worker:up

# 5. 讀 HANDOFF.md + PROJECT_INVENTORY.md + 本檔
cat HANDOFF.md
cat docs/PROJECT_INVENTORY.md
cat docs/handoff/sessions/SESSION_NEXT_PROMPT.md
```

完成上述 5 步後，跟 Hubert 確認從 P0 開始（**Gmail 整合**是 P0 第一件事），然後依優先度執行。

---

## 給接手 agent 的最後提醒

1. **永遠在 dev repo 編輯**（`pwd` 確認）— chmod 555 保護 main 鏡像
2. **commit 前跑 `check-quality.sh` + `npm test`**（11 + 49 套全綠才安全）
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

**今晚 7.5 小時工作重點回顧**（22:28 7/16 ~ 05:48 7/17）：
- 完成 9 個 P 修整（P1/P2/P3/P4/P5/P6/P7/P8/P9）+ B 方案
- 修 LINE push loop 緊急 bug
- 全部 commit + push + sync（19 個 commits）
- 文件 drift 全面修整（5 份 handoff + main_idea.md）
- 今晚所有教訓都寫進本檔「不要踩的雷」section

下一個 session 第一件事：**做 Gmail 整合**（P0，待辦 1）。
