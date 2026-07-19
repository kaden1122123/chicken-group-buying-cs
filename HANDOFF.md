# Session Handoff — 雞味客服專案

> **最後更新**：2026-07-19 23:25+ session（Round 14 收尾：Named Tunnel 轉移 + 4 個 cron delivery 修復 + 狀態文件 drift 全面更新）

## 🎯 用途（Purpose）

此檔是**雞味客服專案的 session 交接手冊**。功能目的：
1. 讓新 session 在 **10 分鐘內進入狀況**（不需要重新探索 codebase）
2. 避免**新 agent 重複踩雷**（文件列出已知問題與已做修整）
3. 確保**知識不隨 session 結束而消失**（commit history + 這個 handoff 持久化）
4. 提供**清楚的下一步**（pending work 有優先度 + 估時）
5. 防止 **dual-location 編輯**（3 層 enforcement 設計）

## 👥 讀者（Audience）

- **接手工作的 brtclaw session**（首要讀者）
- **Hubert**（老闆）偶爾查看（驗證系統狀態）
- **未來 audit 的工程師**（理解設計決策）

## 🛠 怎麼用（How to Use）

**接手 session 第一件事**（5 步）：
1. 讀本檔 §1（當前狀態）+ §5（待辦清單）
2. 讀 `docs/PROJECT_INVENTORY.md`（完整系統地圖）
3. 讀 `docs/handoff/sessions/SESSION_NEXT_PROMPT.md`（新 session 開局 prompt）
4. 跑 `bash scripts/check-quality.sh` 確認環境
5. 跟 Hubert 確認從哪個 P0/P1 開始

**結束 session 最後一件事**：
1. 跑 `bash scripts/check-quality.sh` 確認 10 checks 全綠
2. 更新本檔「變更歷史」+ 必要時 §5 待辦
3. 寫當日 `memory/YYYY-MM-DD.md`（總結今天做了什麼）
4. 跑 `bash scripts/sync-mirror.sh from-legacy` 同步 main 鏡像

## 📚 參考的 Best Practices

| 來源 | 應用到本檔的原則 |
|------|---------------|
| [/handoff Skill](https://www.aihero.dev/skills-handoff) | Context compaction — 精簡但完整 |
| [Context Rot in AI Agents](https://www.mindstudio.ai/blog/context-rot-ai-agents-session-handoff-fix) | Session handoff 修 context window 膨脹 |
| [AI Agent Handoff (XTrace)](https://xtrace.ai/blog/ai-agent-context-handoff) | 傳遞 context + state + responsibility |
| [session-handoff skill](https://github.com/softaworks/agent-toolkit) | **Zero ambiguity** — 不留模糊空間 |
| [Project Handover Templates (plane.so)](https://plane.so/blog/what-is-a-project-handover-steps-checklist-and-best-practices) | **Structured transfer** of: responsibilities + deliverables + documentation + decisions + working context |

---



---

## 1. 當前 Production 狀態（綠燈）

| 項目 | 狀態 | 證據 / 驗證指令 |
|------|------|----------------|
| Production runtime 三檔 | ✅ 對齊 | AGENTS.md / SOUL.md / main_idea.md md5 與 production-prompt/2026-07-03/ 完全一致 |
| 測試套件 | ✅ 全綠 | `npm test` → 49 unit + 1 integration |
| 品質檢查 | ✅ 全綠 | `bash scripts/check-quality.sh` → 11 checks, 0 fail |
| api-server | ✅ 跑中 | PID 3558773, port 3001 |
| Dashboard-server | ✅ 跑中 | port 3000, /home/clawuser/.config/chicken/secrets/dashboard-pwd fallback |
| LINE push 通知 | ✅ 恢復 | 2026-07-16 21:30 Hubert 重啟 OpenClaw Gateway 後，`handoff.notify_owner.enabled` 重新啟用（bug fix c6438e8 HUMAN_HANDOFF guard + 1分鐘 debounce 已生效）|
| LINE push loop 防護 | ✅ 上線 | HUMAN_HANDOFF guard + 1分鐘 debounce（src/index.js + src/states/handoff.js，commits c6438e8 + bbe6533）|
| P3 Quick Reply | ✅ 意圖定義 | chicken.yaml `quick_replies` + main_idea.md §十八（待 OpenClaw pipeline 支援渲染）|
| P5 付款狀態機制 | ✅ 已實作 | dashboard 「✓ 已收款」按鈕 + POST /api/orders/:id/mark-paid（commits 18565aa + 854948a）|
| P2 老闆回覆機制 | ✅ 方案 B 已實作 | dashboard 「✓ 核准」按鈕 + POST /api/orders/:id/approve（commit 0e2d29f）|
| P7 訂單完整性規則 | ✅ 已實作 | main_idea.md §十二「訂單完整性規則」（commit 1380731）|
| **P0 Gmail 整合** | ✅ 完整實作 | 5 個 commits：ee04932 → ea64832 → b823dd7 → 1dc9b4d → 6cc05a8 |
| Gmail OAuth | ✅ 完成授權 | clawbrt@gmail.com + GCP project `chickencustomerservicesheets` |
| Email 版型 v5 | ✅ 4 種版型 | handoff / autoOrder / digest / system + 中文付款標籤 + 大小標題簡化 |
| 日報/週報 cron script | ✅ 程式完成 | `scripts/send-digest.js`（待 `openclaw cron add` 設排程）|
| P9 Sheets cron script | ✅ 程式完成 | `scripts/sheets-sync-cron.js`（待 `openclaw cron add` 設排程）|

---

## 2. 最近 6 個 Commits（2026-07-17 ~ 18 — Round 5 Gmail 整合）

- **6cc05a8** feat(p0-v5): 版型移除 box chars 改用大小標題（Hubert 04:32 反饋）
- **1dc9b4d** feat(p0-v4): OAuth loopback callback + 版型退款/地址確認 + 付款中文
- **b823dd7** feat(p0-v3): 版型 v3 純文字精美 + 重要欄位全加
- **ea64832** feat(p0-v2): Gmail 永遠 LINE+Email 並行 + 4 種版型 + 詳細 OAuth 步驟
- **ee04932** feat(p0): Gmail 整合 — Email fallback 給老闆（LINE 額滿備援）
- **d5dd954** docs(handoff): v4 全面對齊系統現況 + SESSION_NEXT_PROMPT 重寫 + 待辦整理

完整 log: `git log --oneline -10`

完整 log: `git log --oneline -10`

---

## 3. 三層位置架構（ENGINEERING_HANDBOOK §6.6）

| 層級 | 路徑 | 角色 |
|------|------|------|
| 測試端 (sandbox) | `~/.openclaw/workspace-external-user/` | Claude Code workspace |
| **主上線端 (production)** | `~/.openclaw/agents/external-user/` | **LLM 真的在這跑**（AGENTS.md / SOUL.md / main_idea.md canonical） |
| 本倉庫 source | `docs/production-prompt/{version}/`（`latest` symlink） | git-managed 版本控制 |
| **Dev repo** | `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/` | **永遠在這編輯** |
| Main 鏡像 | `~/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` | 自動同步 dev → main（sync-mirror.sh） |

**記憶口訣**：dev 是 source、main 是 mirror、production 是 runtime。三者之間用 sync 工具銜接。

---

## 4. 此 Session 完成（2026-07-15 + 2026-07-16 Round 2-3）

### 完整 audit（11 維度）
- REVIEW_GUIDE 套數 30 → 49
- CEO_GUIDE 5 個 session 狀態對齊（H/X1/X2/X3/X5）
- HEARTBEAT.md 18 個 cron jobs 完整對齊
- INDEX.md 套數更新（47→48）
- .env.example 6 → 30 env
- ENGINEERING_HANDBOOK 移除不存在腳本引用
- ADR-0003 加 drift 預防 SOP + backup 政策

### AGENTS.md × 2 合併
- 以主上線端 `agents/external-user/AGENTS.md` 為 canonical（8880 bytes md5 `f4542f4c`）
- 合併 🚨 嚴厲禁止規則 + 開團截單時間 + Session Q 路徑警告
- workspace-external-user/AGENTS.md 加 cross-reference（測試端）
- main → test 端分層明確

### Config drift 修整
- `bash scripts/sync-config.sh` 同步 chicken.yaml → config.yaml（10328→6332 bytes）
- 補上 Session D3-2/D3-3 漏的 keys + `tenant:` section
- ADR-0003 v2 加 drift 預防 SOP

### Check 完整性修整
- **Check 8（KB Source of Truth）** 補回實作（原 X1-D commit 3cd7e1f 只有 header 註解沒插實作）
- **Check 9（config drift 預防）** mtime + missing keys + 檔案存在性三層檢查
- **Check 10（雙位置檔案 md5 一致）** 新增，依 SSoT + Git mirror pattern

### Dashboard 密碼修整
- Root cause：OpenClaw exec 工具自動 redact process.env 中密碼字串
- commit 3e3e993：dashboard-server.js 加 DASHBOARD_PASSWORD_FILE 支援
- **本次新增** `/home/clawuser/.config/chicken/secrets/dashboard-pwd` 預設 fallback：dashboard-watchdog 透過 manage-tunnel.sh 重啟無 env 時仍能讀到密碼

### 2026-07-16 Round 2-3 完成項目

#### Round 2: 文件 drift 修整 + secrets 清理
- fbb797b docs(handoff): 三份 handoff 文件 drift 修整 — /tmp/ → XDG secrets
- 清掉 /tmp/dash-pwd + /tmp/api-pwd 冗餘檔（d4b0d23 commit 從 /tmp 搬到 XDG，舊檔留著污染）
- running services 自動 fallthrough 到 XDG secrets，無重啟影響

#### Round 3A: P7 訂單完整性規則
- 1380731 main_idea.md §十二 加「訂單完整性規則」
- 7 項必填欄位檢查清單（日期、品項、姓名、電話、地址、時段、付款）
- ❌/✅ 範例對照 + 4 條原則
- 客戶只給部分資訊 → 列缺項請補完，不要說「好，訂單收到」

#### Round 3B: P5 付款狀態機制
- 18565aa + 854948a dashboard-server.js：加 `POST /api/orders/:orderId/mark-paid` endpoint
- 跨檔案查找 readAllOrders + 傳 delivery_date 給 updateOrder
- dashboard.js template 加「付款」+「操作」兩欄
- 「✓ 已收款」按鈕（橘色，payment_status=pending 時顯示）
- main_idea.md §六加「💰 客戶查詢付款狀態」規則

#### Round 3C: P3 Quick Reply 統一回覆（意圖定義，待 OpenClaw 支援渲染）
- fa0500d chicken.yaml 加 `quick_replies` section（4 種情境：menu/payment/hours/delivery）
- main_idea.md §十八 Quick Reply 統一回覆（使用原則、範例）
- config.yaml 從 chicken.yaml sync

#### Round 3D: P2 老闆回覆機制方案 B
- 0e2d29f dashboard-server.js：加 `POST /api/orders/:orderId/approve` endpoint
- dashboard.js：加 `needApprove` 變數 + 藍色「✓ 核准」按鈕（order_status=pending_handoff 時顯示）
- main_idea.md §十九「老闆回覆機制（P2 方案 B）」
- 方案 A（LINE 對話 command）放棄（Hubert 21:30 確認風險太大，雖然 line_user_id 辨別管理者可行但負擔大）

#### Round 3E: Worker 404 修整
- WORKER_HEALTH_URL 環境變數指向 `http://127.0.0.1:3001/api/health`
- 重啟 SOP 加 WORKER_HEALTH_FILE 路徑
- /healthz 從 `degraded` 變 `ok`（三服務都 up）

#### Round 3E-2: P3-emergency LINE push infinite loop 修整
- c6438e8 雙層保護：
  1. `src/index.js` 加 HUMAN_HANDOFF guard（line 50-58 條件加 `state !== STATES.HUMAN_HANDOFF`）
  2. `src/states/handoff.js` 加 1 分鐘 debounce（同 userId + 同訊息 hash 1 分鐘內只 push 1 次）
- bbe6533 lint:fix 自動修 7 個 indent errors
- 根因：客戶在 HUMAN_HANDOFF 狀態下重發訊息 → 每次都觸發 handoff → push
- 暫時止血：`handoff.notify_owner.enabled: false`（保留磁碟狀態，未 commit）
- 2026-07-16 21:30 Hubert 重啟 OpenClaw Gateway 後，重新啟用 `notify_owner.enabled: true`

---

## 5. ⚠️ 待修整項目（依緊急度排序）

### 緊急（30 分鐘內）
- [x] ✅ **Worker 404 修整**（Round 3E 2026-07-16 完成）：`WORKER_HEALTH_URL=http://127.0.0.1:3001/api/health` 環境變數，重啟後 /healthz 從 `degraded` 變 `ok`（三服務都 up）
- [x] ✅ Dashboard PASSWORD_FILE fallback（XDG secrets 已上線，dashboard-watchdog 透過 manage-tunnel.sh 重啟無 env 時仍能讀到密碼）
- [ ] **清理 89 個 leaked cloudflared processes**：`pkill -9 cloudflared` 即可清理
- [ ] **Manual Test Plan 11 步驟**（從 LINE bot 測試開始）— 見 [reference note]

### 中優先（今日內）
- [ ] ENGINEERING_HANDBOOK.md 加 §雙位置段落（講清 main 不是編輯目標、dev 才編）
- [ ] Pre-commit hook 自動跑 sync-mirror.sh
- [ ] Pre-edit guard hook（Claude Code settings.json 或 git pre-commit 整合 check-cwd.sh）
- [ ] Manual Test Plan 文件化到 `docs/handoff/TEST_PLAN.md`

### 長期（下 session）
- [ ] dashboard-server.js 改 session-based auth（避免瀏覽器 cache HTTP Basic 的 quirk）
- [ ] /home/clawuser/.config/chicken/secrets/dashboard-pwd backup SOP（重啟 vs 持久性）
- [ ] 包成 Helm/systemd service 統一管理 3 個 services
- [ ] cloudflare-worker code 完整 review（之前測試發現只有 `cloudflare-worker` 在 `/home/clawuser/openclaw-workspace/external-user/` 不在本 repo）

---

## 6. 檔案指引（給下個 session）

### 核心位置
- **Production runtime**: `~/.openclaw/agents/external-user/`
- **Dev repo**: `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/`
- **Main 鏡像**: `~/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/`
- **Git remote**: https://github.com/kaden1122123/chicken-group-buying-cs

### 重要文檔
- `docs/CEO_DECISION_GUIDE.md` — 13 個 session 決策（CEO 視角）
- `docs/ENGINEERING_HANDBOOK.md` — 工程慣例（含 §6.6 三層位置架構）
- `docs/INDEX.md` — 文檔索引
- `docs/handoff/sessions/SESSION_X_PROMPT.md` — 13 個 session prompts
- `docs/production-prompt/2026-07-03/CHANGELOG.md` — production runtime 變更記錄
- `HANDOFF.md`（**此檔**）— session handoff 摘要

### 下個 session 開頭必跑指令

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
bash scripts/check-quality.sh    # 11 checks 應全綠
npm test                          # 49 unit + 1 integration
git log --oneline -10             # 看最近 commit
cat HANDOFF.md                    # 讀此檔
```

### Q&A（常見問題快速答）

**Q: Dashboard 登入帳密？**
A: `admin / ChickenTest2026`，檔於 `/home/clawuser/.config/chicken/secrets/dashboard-pwd`（mode 600）

**Q: api-server 帳密？**
A: `api-user / 環境變數 API_PASSWORD`（在 OpenClaw SERVICE_MANAGED_ENV_KEYS 清單）

**Q: 怎麼改 chicken.yaml？**
A: 編輯 `config/tenants/chicken.yaml` 後跑 `bash scripts/sync-config.sh`

**Q: 怎麼動 prompt？**
A: 開新版 `docs/production-prompt/YYYY-MM-DD/`，commit 後改 `latest` symlink 指向

**Q: Tailscale 怎麼用？**
A: 從任一登入 Tailscale 的 PC 瀏覽 `http://100.114.197.9:3000/admin`，用 `admin / ChickenTest2026`，**用無痕模式避免瀏覽器 cache 舊 `***` 憑證**

**Q: 怎麼確認現在是 dev repo 不是 main？**
A: `pwd`，應為 `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service`。或 `bash scripts/check-cwd.sh <要編的檔>`（已存在但尚未 commit）

---

## 7. 整潔紀律提醒

1. **永遠在 dev repo 編輯**（`pwd` 確認）
2. **commit 前**：跑 `bash scripts/check-quality.sh`
3. **push 前**：跑 `bash scripts/sync-mirror.sh from-legacy`（避免 main drift）
4. **重啟 dashboard**：`env PORT=3000 node scripts/dashboard-server.js`（無密碼，自動 fallback `/home/clawuser/.config/chicken/secrets/dashboard-pwd`）
5. **清測試訂單**：`node scripts/cleanup-test-orders.js`（保護 6/13 + 6/16 真實訂單）
6. **心跳檢查**：`dashboard-watchdog`（cron `36d2ca19`）每 10 分鐘檢查 /healthz 並重啟
7. **預防未來 session 搞混目錄**：用 `scripts/check-cwd.sh <file>` 或整合到 Claude Code hooks

---

## 8. 變更歷史

| 版本 | 日期 | 主要變更 |
|------|------|----------|
| v1 | 2026-07-15 17:09 | 初次建立 |
| v2 | 2026-07-16 03:00 | 加 9 個未修整清單 + B 方案規劃 + 新增 doc/PROJECT_INVENTORY.md + doc/handoff/sessions/SESSION_NEXT_PROMPT.md + src/config.js LINE_BOT_TOKEN_FILE 支援 |
| v3 | 2026-07-16 21:30 | 文件 drift 全面修整 + Round 2-3 全部 commit 記錄 + P2-P3-P5-P7 完成狀態 + LINE push loop bug fix (c6438e8/bbe6533) + notify_owner 重新啟用 |
| v4 | 2026-07-17 06:30 | 全部 9 個 P 修整完成（P4 街口主動推 QR code 完整、P6 receipt analyzer、P9 Google Sheets sync 662 筆訂單寫入、B 方案 autoOrder + X-API-Token + LLM 端整合）+ Round 4 19 個 commits + SESSION_NEXT_PROMPT.md 全面重寫對齊 + memory/2026-07-17.md 完整 session 總結 + 待辦事項（P0 Gmail 整合）|
| v5 | 2026-07-18 05:00 | Gmail 整合 P0 完整實作（5 個 commits：ee04932 → ea64832 → b823dd7 → 1dc9b4d → 6cc05a8）— OAuth Desktop app loopback callback + 永遠 LINE+Email 並行 + 4 種版型（handoff / autoOrder / digest / system）+ 中文付款標籤（現金 / 轉帳 / 街口支付 / LINE Pay）+ 大小標題簡化（移除 ╔═══╗ box chars）+ 後續自動化腳本（`scripts/send-digest.js` 日報/週報 + `scripts/sheets-sync-cron.js` P9 Sheets sync）+ HANDOFF.md §1 / §2 / §8 更新 + memory/2026-07-18.md 建立 |

---

## 9. 9 個未修整清單（Hubert 2026-07-15 22:35 提出，2026-07-16 03:00 狀態）

| # | 問題 | 難度 | 狀態 | 建議時程 |
|---|------|------|------|----------|
| **P1** | 為何老闆沒收到通知？ | 簡單 | ✅ **已修**：src/config.js 加 `LINE_BOT_TOKEN_FILE` fallback（commit 待 push） | 立刻 |
| **P2** | 客戶無權限確認訂單，老闆如何回覆 | 中 | ✅ **方案 B 已修**（commit 0e2d29f，dashboard 「✓ 核准」按鈕）；方案 A 放棄（Hubert 21:30 確認風險太大） | — |
| **P3** | 統一回覆（Quick Reply） | 中 | ✅ **已修意圖定義**（commit fa0500d，chicken.yaml `quick_replies` + main_idea.md §十八），待 OpenClaw pipeline 支援渲染 | — |
| **P4** | 街口支付傳圖片 | 中高 | ✅ **已完整實作**（commits 239dbf2 + 8d4f5dc + 060ec7e + 5c40664，4 stages + 街口主動推 QR code image）| — |
| **P5** | 老闆確認付款狀態 | 簡單 | ✅ **已修**（commits 18565aa + 854948a，dashboard 「✓ 已收款」按鈕 + POST /api/orders/:id/mark-paid）| — |
| **P6** | OCR 轉帳截圖 | 中 | ✅ **已實作 receiptAnalyzer 模組**（commits fbfa2df + 2fd8aca，minimax vision 介面 + 4 種支付方式 flow + api-server 整合 + csvWriter 加 6 個 P6 欄位）| — |
| **P7** | 訂單不完整時要求完整表格 | 簡單 | ✅ **已修**（commit 1380731，main_idea.md §十二「訂單完整性規則」+ 7 項必填欄位檢查清單）| — |
| **P8** | Dashboard 何時更新？ | 已說明 | ✅ **已答**：A 方案需老闆手動建單；2026-07-15 訂單都是測試 fixture | — |
| **P9** | 試算表 | 簡單 | ✅ **已實作 Google Sheets sync**（commits d903098 + 057ed3e，sheetsSync.js + 662 筆訂單成功寫入 + 獨立 google email clawbrt@gmail.com）| — |

---

## 10. 下階段規劃（按優先度）

### A. 立即（2026-07-16 全部完成）
- [x] ✅ **LINE_BOT_TOKEN 整合驗證**（2026-07-15 d4b0d23 commit 完成）
- [x] ✅ **P5 付款狀態機制**（commit 18565aa + 854948a 完成）
- [x] ✅ **P7 訂單完整性規則**（commit 1380731 完成）

### B. 下個 session（全部完成）
- [x] ✅ **P2 老闆回覆機制方案 B**（commit 0e2d29f 完成）
- [x] ✅ **P3 統一回覆（Quick Reply）意圖定義**（commit fa0500d 完成，待 OpenClaw 支援渲染）
- [x] ✅ **Worker 404 修整**（Round 3E 完成，/healthz 從 degraded 變 ok）
- [x] ✅ **LINE push loop 修整**（commits c6438e8 + bbe6533 完成）

### C. 中期（Hubert 21:30 詳細需求已確認，**全部完成**）

#### P4：街口支付傳圖片 ✅ 全部完成（2026-07-17）
- 街口支付有固定 QR code（老闆的收款碼）→ P4 是「push 這個 QR code 給客戶」
- 顧客回傳支付截圖（轉帳/街口）：儲存到 `data/receipts/{order_id}/`（萬一糾紛備份）
- order_id 對應：訂單建立時加 `receipts_path` 欄位（CSV 存路徑，圖片存檔案系統）
- 區分兩種 image：
  - **老闆 QR code**（送給客戶看）→ notifier 推 LINE image message
  - **客戶轉帳截圖**（客戶送來）→ 存檔 + 標記 likely_paid

#### P6：OCR 轉帳截圖（半天，4-5 小時）
- 4 種支付方式具體 flow：
  1. **現金**：依現金規則，後續貨到付款（不用 OCR）
  2. **轉帳**：傳送轉帳資訊，客戶轉帳後回傳截圖 → 對比 expected amount + likely_paid
  3. **街口支付**：P4 完成後傳老闆 QR code image，客戶付款後回傳截圖 → 對比 expected amount + likely_paid
  4. **Line pay**：落後選項不主動提供；客戶詢問才給老闆 LINE ID（config 內有）→ 完全老闆作業程序
- **走 minimax vision**（不引入新 LLM，與 Discord 傳圖片同原理）
- 統一介面 `analyzeReceiptImage(imageUrl, orderData) → { likely_paid, detected_amount, detected_account_last5, confidence }`
- 不引入 OCR library

#### P9：Google Sheets 試算表（30 分鐘）
- 待 Hubert 確認 external-user 是否用獨立 google email
- chicken.yaml 加 `storage.phase2.enabled: true`
- Google Sheets credentials（service account JSON 或 OAuth refresh token）
- 自動 sync CSV → Sheets

#### B 方案：LLM 自動觸發 POST /api/orders（4-6 小時）
- **嚴格規則**：客戶必須回覆「確認」才建單
- 排除：line 貼圖（格式 `(*****)`）、其他非純文字 → 重新請客戶回覆「確認」
- 流程：客戶「確認」 → 自動 call api-server `POST /api/orders`（X-API-Token auth）→ push 通知老闆
- error handling：POST 失敗 → fallback push 通知老闆手動建單
- **auth 安全**（Hubert 強調）：X-API-Token 從 XDG secrets 讀，**禁止 commit 到 git**
- **repo 應設為 private**（Hubert 強調）

### D. 下一步明確行動（Hubert 21:30 確認後啟動）

1. **P9 google email 確認**：Hubert 需回答「external-user agent 要不要用獨立 google email」
2. **P4 實作啟動**：先做 image storage 路徑設計（order_id 對應）
3. **P6 實作啟動**：先做 minimax vision adapter（4 種支付方式 flow）
4. **B 方案實作**：先做「確認」關鍵字 detector（嚴格規則：純文字、排除 line 貼圖）
5. **repo private 設定**：Hubert 確認 GitHub repo 是否已設為 private

### E. 環境清理
- [ ] **89 個 leaked cloudflared processes 清理**（5 分鐘）：`pkill -9 cloudflared`
- [ ] 各種 docs drift 修整（docs/KNOWN_ISSUES 等）

---

## 11. 重要檔案位置（給 new session 接手用）

| 檔案 | 用途 |
|------|------|
| `docs/PROJECT_INVENTORY.md` | **完整系統目錄 + 檔案清單**（必讀） |
| `docs/handoff/sessions/SESSION_NEXT_PROMPT.md` | **下個 session 開局 prompt**（直接貼到新 session） |
| `docs/CEO_DECISION_GUIDE.md` | 13 個 session 決策（CEO 視角）|
| `docs/ENGINEERING_HANDBOOK.md` | 工程慣例 + §6.6 三層位置架構 |
| `docs/API_CURL.md` | api-server curl 範例 |
| `MEMORY.md` §I-1/I-2/I-3 | commit / sync / pre-edit guard SOP |

**記得先讀 PROJECT_INVENTORY.md**（路徑、cron、3 層 enforcement）— 這是 2026-07-16 03:00 後新 session 的 first stop。

---

**由 2026-07-15 17:09 session 建立，2026-07-16 03:00 大幅更新**
更新方式：每次 session 結束時覆寫，或加日期版本（`docs/handoff/SESSION_HANDOFF_<date>.md`）
