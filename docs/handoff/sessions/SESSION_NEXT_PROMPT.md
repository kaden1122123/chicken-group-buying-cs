# 下個 Session Prompt（2026-07-16 06:30 之後接手雞味客服工作的 agent）

> **作者**：2026-07-16 06:30 session（commit d4b0d23 之後；XDG secrets 持久化 + best practices 強化）
> **TL;DR**：Hubert 06:22 提醒「保證 handoff 文件都有完整敘述功能目的」，已強化本檔。接手 session 必讀。

## 🎯 用途（Purpose）

此 prompt 是**新 session 開局 prompt**。功能目的：
1. 讓接手 agent **10 分鐘內進入狀況**（不用重新探索 codebase）
2. 給**完整、開局可跑**的指令（不需要再查文檔）
3. 列出**待修整 + 優先度**（避免 agent 漏做或做錯順序）
4. 標明**踩雷紀錄**（省去重複 debug）
5. 提醒**3 層 enforcement**（避免 agent 編錯位置）

## 👥 讀者（Audience）

- **接手雞味客服的 brtclaw session**（首要）
- **Hubert**（手動開新 session 給 brtclaw 時可貼此 prompt）

## 🛠 何時使用（When to Use）

- 接手雞味客服專案（無論是因為 session timeout、Hubert 開新 session、或其他原因）
- 距上次 session 超過 24 小時（context 可能已 drift）
- 接手後**第一步**就是跑下方「開局指令」5 步

## 🏁 結束時應該做什麼（End-of-Session Checklist）

1. 跑 `bash scripts/check-quality.sh` 確認 10 checks 全綠
2. 跑 `npm test` 確認 47 套全綠
3. git add + commit + push（按 §I-1 SOP）
4. 跑 `bash scripts/sync-mirror.sh from-legacy` 同步 main
5. 更新 `HANDOFF.md`（§8 變更歷史 + 必要時 §5 待辦）
6. 寫當日 `memory/YYYY-MM-DD.md`（總結）
7. 若有 Layer 1 變更，跑 `bash scripts/main-enforce-readonly.sh` 確認 chmod 555 恢復

## 📚 參考的 Best Practices

| 來源 | 應用 |
|------|------|
| [/handoff Skill](https://www.aihero.dev/skills-handoff) | Context compaction — 精簡 |
| [Context Rot in AI Agents](https://www.mindstudio.ai/blog/context-rot-ai-agents-session-handoff-fix) | Session handoff 修 context 膨脹 |
| [AI Agent Handoff (XTrace)](https://xtrace.ai/blog/ai-agent-context-handoff) | 傳遞 context + state + responsibility |
| [session-handoff skill (softaworks)](https://github.com/softaworks/agent-toolkit) | **Zero ambiguity** |
| [Project Handover Templates (plane.so)](https://plane.so/blog/what-is-a-project-handover-steps-checklist-and-best-practices) | **Structured transfer** |

---



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
bash scripts/check-quality.sh    # 應 10 通過 0 警告 0 失敗
npm test                          # 應 47 套全綠
ls /home/clawuser/.config/chicken/secrets/line-bot-token            # 看 Hubert 是否已寫 LINE_BOT_TOKEN
ls /home/clawuser/.config/chicken/secrets/dashboard-pwd /home/clawuser/.config/chicken/secrets/api-pwd     # 確認密碼檔存在
cat /home/clawuser/.openclaw/agents/external-user/SOUL.md | head -5  # 確認 LLM 會讀的 SOUL
```

---

## 當前狀態（2026-07-16 03:00）

| 項目 | 狀態 |
|------|------|
| Production runtime 對齊 | ✅ AGENTS.md / SOUL.md / main_idea.md md5 全 match version control |
| 測試套件 | ✅ 47 unit + 1 integration（`npm test` 全綠）|
| 品質檢查 | ✅ 10 checks（`check-quality.sh`）— **0 警告 / 0 失敗** |
| api-server | ✅ 跑（port 3001, PID 動態查）|
| dashboard-server | ✅ 跑（port 3000）|
| Worker Cloudflare | ❌ 404（healthz degraded，不擋 line bot 對話）|
| 老闆 LINE 通知 | ✅ **已設**（d4b0d23 commit 寫入 XDG secrets, 172 chars）|
| 3 層 enforcement | ✅ 上線（chmod 555 + cron 10min + Check 10）|

---

## 待修整清單（按優先度）

### P0 — 立即（1-2 小時）
- [x] ✅ **P1 LINE_BOT_TOKEN 修整**（2026-07-15 d01359f + d4b0d23 commits 完成）
  - 確認：Hubert 已寫 `/home/clawuser/.config/chicken/secrets/line-bot-token`（mode 600, 172 chars, d4b0d23 commit 從 /tmp 搬過來）
  - 重啟 api-server，看 log 有 "LINE_BOT_TOKEN loaded from /home/clawuser/.config/chicken/secrets/line-bot-token (172 chars)" 而非 warning
  - Test：模擬 LLM 觸發 notifyHubert()，看 LINE push 是否到 Hubert 手機（待 Hubert 手動驗證）
  - 詳見 `src/handoff/notifier.js` line 7-17 (getLineBotToken → config.js)

- [ ] **Worker 404 修整**（HANDOFF.md 緊急段已有）
  - deploy Cloudflare Worker `external-user-line-security` 帳號
  - 或改 `WORKER_HEALTH_URL` 環境變數
  - 修完 healthz 變全綠

### P1 — 下個 session（半天）
- [ ] **P5 付款狀態機制**（30 分鐘）
  - 確認 `payment_status` 欄位在 orders CSV 已 active
  - dashboard 加「已收款」按鈕（目前訂單頁有「編輯」但無「標記已付款」）
  - 客戶問"我付款了嗎" → bot 讀 csv 回答「老闆已確認 ✓」或「尚未收到老闆確認」

- [ ] **P7 訂單完整性規則**（5 分鐘）
  - 加 main_idea.md §十二規則：客戶下訂若只給部分資訊，LLM 必須列缺項清單請補完（不要直接說"好，訂單收到"）
  - 範例：「好的，品項和日期我記下來了。請補：① 收件人姓名 ② 電話 ③ 地址 ④ 配送時段 ⑤ 付款方式」
  - 測：客戶說 "我要一個雞屁股" → 補問所有必填欄位

- [ ] **P2 老闆回覆機制**（1 小時，較複雜）
  - 方案 A：LINE 對話內老闆 command（"OK" 或 "OK #3" 觸發 api-server POST /api/orders）— 需辨識「訊息是來自老闆不是客戶」（看 line_user_id == chicken.yaml 的 notify_owner.line_user_id）
  - 方案 B（推薦）：dashboard「核准並建單」按鈕 — 跟現有 A 方案 flow 差最少
  - 實作：src/handoff/notifier.js + scripts/dashboard-server.js 加核准 API endpoint

- [ ] **P3 統一回覆（Quick Reply）**（1-2 小時）
  - chicken.yaml 加 `quick_replies: { menu: [按鈕...], payment: [按鈕...], hours: [按鈕...], delivery: [按鈕...] }`
  - main_idea.md 加規則：LLM 偵測對應關鍵字時回傳 Quick Reply 結構（LINE 原生功能）
  - 詳見 main_idea.md §四「詢問菜單」的 Quick Reply 範例

### P2 — 中期
- [ ] **P4 街口支付傳圖片**（2-3 小時）
  - notifier 加 image 接收器
  - 存到 `data/receipts/{order_id}/`
  - forward 給老闆（push + 縮圖）

- [ ] **P6 OCR 轉帳截圖**（半天）
  - LLM vision API 直接讀 image 提取金額/帳號末五碼
  - 對比訂單 expected amount → 標記 `likely_paid`（需老闆最終確認）
  - 不用 OCR library，純 LLM 視覺

- [ ] **P9 試算表（Google Sheets）**（30 分鐘）
  - `chicken.yaml` → `storage.phase2.enabled: true` + Google Sheets credentials

### P3 — 長期
- [ ] **B 方案（LLM 自動觸發 POST /api/orders）**（4-6 小時設計 + 實作）
  - A 方案過渡期（current）：LLM 純文字 + push 給 Hubert + 手動建單
  - B 方案：LLM 偵測「客戶確認」關鍵字後，自動 call api-server POST /api/orders
  - 設計需考慮：觸發機制（哪個關鍵字觸發）、error handling、auth（HANDOFF_TOKEN?）

- [ ] **89 leaked cloudflared processes 清理**（5 分鐘）
  - `pkill -9 cloudflared`
  - 重啟 dashboard 時用 manage-tunnel.sh 自動建 1 條

---

## 3 層 Enforcement 提醒

- **永遠在 dev repo 編輯**：`cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/`
- **commit 前必跑**：`bash scripts/check-quality.sh`
- **push 前必跑**：`bash scripts/sync-mirror.sh from-legacy`
- **重啟 dashboard 帶 env**：`DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd`（不要用 env 直接傳密碼）
- **重啟 api-server 帶 env**：`API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd`

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
nohup env API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd PORT=3001 \
  node scripts/api-server.js > /tmp/api-server.log 2>&1 &
disown
sleep 1
nohup env DASHBOARD_USERNAME=admin \
  DASHBOARD_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/dashboard-pwd \
  API_USERNAME=api-user API_PASSWORD_FILE=/home/clawuser/.config/chicken/secrets/api-pwd \
  PORT=3000 \
  node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 &
disown
sleep 2

# 3. 驗證
curl -sS -m 5 http://localhost:3000/healthz
# 預期：dashboard=up, api_server=up, worker=down:404（Worker 未 deploy，正常）
```

---

## 重要參考文檔

| 文檔 | 用途 |
|------|------|
| `HANDOFF.md` | 當前狀態摘要 + 待修整清單 |
| `docs/PROJECT_INVENTORY.md` | 完整系統目錄 + 檔案清單（必讀）|
| `docs/CEO_DECISION_GUIDE.md` | 13 個 session 決策 |
| `docs/ENGINEERING_HANDBOOK.md` | 工程慣例 + 3 層位置架構 |
| `docs/API_CURL.md` | api-server curl 範例 |
| `docs/production-prompt/2026-07-03/CHANGELOG.md` | production runtime 變更歷史 |
| `docs/handoff/sessions/` | 13+ 個舊 session prompts（背景參考）|
| `MEMORY.md` §I（I-1/I-2/I-3）| Commit / sync / pre-edit guard SOP |

---

## 重要 ID 與路徑

- **老闆 LINE ID**（`chicken.yaml` → `notify_owner.line_user_id`）：`Uf56650056d35626deb64165926a26182`
- **Tailscale IP**（你 PC 跟 server 同 mesh）：`100.114.197.9`
- **LAN IP**：`192.168.0.104`
- **GitHub remote**：`github.com/kaden1122123/chicken-group-buying-customer-service`
- **老闆 = Hubert 自己的 LINE**（老闆通知就是 push 到這個 ID）

---

## git 當前狀態（2026-07-16 03:00）

最近 8 commits：
```
953da66  fix(check-quality): 補 Check 8 X1-D + Check 9 缺 pass 訊息
47baeae  docs(audit): AGENTS.md × 2 收尾 + config drift 修整 + Check 9 drift 預防
b6bab76  feat(enforcement): 3 層強制防止 dual-location confusion
705a724  fix(prod-validation): 修正 healthz degraded + SOUL.md identity + open_dates 規則
39499f2  fix(prod-runtime): 部署 SOUL.md AI banner + open_dates 規則 + 重啟 + healthz 修
4cac8f5  chore(cleanup): 移除 Session I5 測試 fixture (test-yaml-patch-i5.yaml)
8b363b9  fix(config): 遷移 open_dates 到 chicken.yaml + 修 date.test.js + HANDOFF 加 Worker 404
```

下次 commit 用 LINE_BOT_TOKEN_FILE 修整（修整這 5 個檔 + 驗證 + commit + push）。

---

## 不要踩的雷

1. **OpenClaw exec 自動 redact process.env 中的密碼字串** — 用 `*_PASSWORD_FILE` / `*_TOKEN_FILE` 從檔案讀（mode 600）
2. **pkill -f 會 self-kill** — 當 exec script 內含 pattern 時，shell process 也會被 match。用 `kill <PID>` 取代
3. **main 鏡像有 chmod 555 保護** — sync 之前先 `chmod u+w`，sync 之後 `chmod 555` restore
4. **OpenClaw exec 編輯時 `***` 可能是 redact，不是 placeholder** — 寫 `trimmed` 不是 `***`
5. **Worker URL 寫死 dashboard-server.js** — Worker deploy 或改環境變數才不會 404

---

## 開始 session 的 5 個動作

```bash
# 1. 確認 CWD
pwd
# 應該是 /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service

# 2. 跑品質檢查
bash scripts/check-quality.sh
# 預期：10 通過 0 警告 0 失敗

# 3. 跑 test
npm test
# 預期：47 套全綠

# 4. 看服務狀態
ps -eo pid,etime,args | grep -E "node scripts/(api|dashboard)-server"
curl -sS -m 5 http://localhost:3000/healthz
# 預期：dashboard:up, api_server:up, worker:down:404

# 5. 讀 HANDOFF.md + PROJECT_INVENTORY.md + 本檔
cat HANDOFF.md
cat docs/PROJECT_INVENTORY.md
cat docs/handoff/sessions/SESSION_NEXT_PROMPT.md
```

完成上述 5 步後，跟 Hubert 確認他想從哪個 P0/P1 開始，然後依優先度執行。
