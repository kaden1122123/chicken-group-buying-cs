# 雞味客服 — CEO 決策指南（給 Hubert）

> **目的**：讓 CEO 能在 1 分鐘內理解每個 session 的「做什麼、為什麼做、要不要做」
> **使用方式**：每個 session 開始時，brtclaw 用本指南的格式問你決策
> **撰寫原則**：以「功能性」描述，不列函數 / 變數 / 程式碼
> **last_updated**：2026-07-27（Round 27 確認仍適用，無改動）

---

## 決策模式（給 CEO）

brtclaw 問決策時，格式：

```
🔴 / 🟡 / 🟢  [業務問題]
影響：[對客戶 / 對你的影響]
做法：[簡單描述要做什麼]
預估：[時間 / 風險]
你決定：做 / 不做 / 之後做 / 換做法
```

**你要做的**：回 `做` / `不做` / `換做法：xxxx`

---

## 為什麼不用函數描述

函數 / 變數 / 行號對 CEO 沒意義 — 你想知道的是：

| 你關心的 | brtclaw 不該說 | brtclaw 應該說 |
|---------|---------------|--------------|
| 客戶會不會收到錯誤資訊 | 「paymentRule.js line 57」 | 「客戶拿 1001 元現金訂雞，系統會接受」|
| 改 config 有沒有用 | 「dead config flag」 | 「你改 chicken.yaml 不會生效」|
| 修這個要多久 | 「8 files changed」 | 「2 小時、低風險、不影響 production」|

---

## 目前待你決策的 sessions（CEO 視角）

> 每個 session 開始前，brtclaw 會貼對應段落問你。

---

### ✅ Session E：6/16 訂單流程方向（已完成）

**業務問題**：
客戶訂完雞、看完摘要，要按「確認訂購」按鈕才會真的寫進訂單系統。但按鈕現在沒顯示，所以訂單根本沒成立。

**影響**：
- 客戶以為訂到了，但你後台沒收到
- 你需要手動看 LINE 訊息建立訂單
- 營收損失風險

**5 個做法**：
| 做法 | 描述 | 優缺 |
|------|------|------|
| A | LLM 完成立即調 API（自動）| 不可靠（LLM 會出錯）|
| B | LLM 自動辨識 action block | 同 A |
| C | LINE webhook 註冊 | 按鈕問題沒解決 |
| **D（推薦）** | 純 postback，不用按鈕，客戶打「確認」 | 簡單可靠 |
| E | 完全手動 trigger | 客戶要打字，UX 差 |

**brtclaw 推薦**：D（純 postback）
**預估**：1-2 小時決策 + 1-2 天實作
**你決定**：✅ **D（純 postback）— 2026-06-28 19:00 決策**
**狀態**：✅ **已完成 + 上線（2026-06-28 19:30 Session N 修正為 A 方案，因 D 方案 Worker 拿不到 LLM 對話歷史）**

---

### ✅ Session D3：客服業務規則統一（5 個硬規則）— 已完成 2026-07-01

### ✅ Session D3：客服業務規則統一（5 個硬規則）— 已完成 2026-07-01

**業務問題**：
你改 `chicken.yaml` 的某些設定（運費門檻、付款上限、配送範圍）**沒效果**，因為程式碼寫死了。這代表你想調整業務規則時，要請工程師改程式碼。

**影響**：
- 想擋掉大額現金訂單？改 config 沒用，要改 src/
- 想調整運費規則？改 config 沒用
- 想加配送區？改 config 沒用
- **改程式碼有風險**（要 deploy、要測試）

**做法**：
把 5 個 hardcode 改成「讀 config」：
1. 現金上限（1000 元）
2. 滿額免運（350 元、運費 80 元）
3. 配送範圍（三峽、鶯歌 fallback）
4. 銀行帳號（007 / 23257030422）
5. LINE Pay ID（Willy0221）

之後你改 config 就會生效。

**brtclaw 推薦**：做
**預估**：2-3 小時、中風險、有 unit test 守門
**你決定**：______

---

### ✅ Session D4：9 個開關無作用 — 已完成 2026-07-01

**業務問題**：
`chicken.yaml` 有 9 個「啟用/未啟用」開關（payment.*.enabled、storage.phase2.enabled 等），但程式永遠當「啟用」處理。意思是改這些開關**完全沒效果**。

**影響**：
- 你以為某功能已關閉（看 config 寫 false），實際是開的
- 想暫停某付款方式？改 config 沒用，要改程式
- 想測試某功能關閉的行為？沒辦法（永遠是啟用）

**做法**：
建立統一介面 `config.isFeatureEnabled('payment.cash')`，所有 flag 都生效。

**brtclaw 推薦**：做（與 D3 一起做，效益最高）
**預估**：2 小時、低風險
**你決定**：______

---

### ✅ Session F：文件一致性 + 6/26 audit 剩餘決策落地 — 已完成 2026-07-01

**業務問題**：
有些文件寫的東西跟實際狀況對不上（例如 `INDEX.md` 寫「11 套測試」但實際 19 套）。

**影響**：
- 接手的人（或新 brtclaw session）看舊文件會誤導
- 6/26 audit 有些事當時沒決定，現在累積著
- 文件不一致 = 協作成本增加

**做法**（6 個低風險動作）：
1. 修 `INDEX.md` 測試套數
2. 修 `PHASE1_PROGRESS.md` 測試套數
3. `api-server.test.js` 用 mock time（修測試壞掉問題）
4. 刪除 cognee placeholder + 更新 MEMORY.md
5. 處理 `knowledge/learned/` 空目錄
6. 為 `knowledge/tenants/chicken/` 10 個 md 加 INDEX 驗證清單

**brtclaw 推薦**：做（1.5 小時、低風險）
**你決定**：______

---

### ✅ Session G：CI/CD + ESLint + .nvmrc — 已完成 2026-06-28 + 2026-07-01 (G4 lint gate)

**業務問題**：
- 沒有自動化測試（每次 push 要手動跑 `npm test`）
- 沒有 ESLint（程式碼風格不一致，新人寫 code 不一定符合既有風格）
- 沒有 `.nvmrc`（不同人用不同 Node 版本可能踩雷）

**影響**：
- 改壞了程式沒人發現（push 就壞了）
- 程式碼品質靠記憶維持（不可靠）

**做法**：
1. 加 GitHub Actions（每次 push 自動跑 `npm test`）
2. 加 ESLint（standard 風格）
3. 加 `.nvmrc`（固定 Node 22）

**brtclaw 推薦**：做（2-3 小時、中風險）
**附註**：GitHub Actions 需要你去 repo enable。
**你決定**：______

---

### ✅ Session H：6 個 helper 補 unit test（與 H8 合併完成 2026-07-01）

**業務問題**：
6 個重要的輔助模組（金額計算、訂單 ID 產生、訂單讀取、時間處理、訊息格式）**完全沒有專屬 unit test**。如果有人改壞了，現有測試抓不到。

**影響**：
- 改了 `orderFormatter.js`（金額計算）壞了，沒測試抓
- 改了 `csvReader.js`（讀訂單）壞了，沒測試抓

**做法**：為這 6 個模組補 50+ 個 unit test

**brtclaw 推薦**：✅ 已完成（與 Session H8 合併執行，2026-07-01）

---

### 🔴 Session H8：補 13 個 src/ 模組專屬單元測試（2026-07-01 完整系統掃描衍生）

**業務問題**：
完整系統掃描（2026-07-01）發現除 Session H 已覆蓋的 6 個 helper 外，還有 13 個 src/ 模組沒有專屬單元測試：

- `src/states/{idle,awaitingPayment,completed}.js`（3 個 state handler）
- `src/handoff/transferRules.js`（14 觸發條件只測 3 個）
- `src/rules/*.js`（8 個 rule 只在 bundle test）
- `src/knowledge/triggers.js`
- `src/middleware/whitelist.js`
- `src/utils/{sanitizer,lineProfileCache}.js`

**影響**：
- 「客戶可能拿到錯誤金額」（rules）
- 「客戶可能誤觸轉真人」（transferRules 11 個 trigger 未測）
- 「客戶可能被當新客」（csvReader 是 H 範圍）
- 改壞了現有測試抓不到

**做法**：
- H8-A：3 個 state 模組
- H8-B：handoff/transferRules 14 觸發條件
- H8-C：8 個 rules/* 拆出獨立 test
- H8-D：knowledge + middleware + utils

**brtclaw 推薦**：做（1.5-2 小時、中風險、高 ROI）
**你決定**：______

**詳見**：[`SESSION_H8_PROMPT.md`](./.archive/handoff/sessions/SESSION_H8_PROMPT.md)

---

### ✅ Session X1：生產 prompt 版本管理 + CHANGELOG（已完成 2026-07-01，4 commits）

**業務問題**：
5 個版本管理問題：
1. `docs/production-prompt/` 兩個版本並存沒當前標記
2. 沒 `latest` symlink，新接手不知讀哪個
3. 沒 `CHANGELOG.md`，commit hash 對應 prompt 變更需手動查
4. sandbox 與本機端點 sync 機制不明
5. KB single-source-of-truth 沒自動驗證

**影響**：
接手者浪費時間找當前 prompt 版本；commit 後 sync 易失憶

**做法**：4 個低風險改動（1 hr）
- ✅ X1-A：加 `latest` symlink + SUMMARY 索引（`c6e2c89`）
- ✅ X1-B：建立 `CHANGELOG.md` 回溯從 Session A 起（`06d7a36`）
- ✅ X1-C：sandbox sync SOP 寫進 ENGINEERING_HANDBOOK（`9a8e79b`）
- ✅ X1-D：KB single-source-of-truth 驗證腳本（`3cd7e1f`）

**brtclaw 推薦**：✅ 已完成

**詳見**：[`SESSION_X1_PROMPT.md`](./.archive/handoff/sessions/SESSION_X1_PROMPT.md)

---

### ✅ Session X2：SESSION prompt 狀態欄統一（2026-07-01 衍生，便宜）（已完成 2026-07-01）

**業務問題**：
11 個 `SESSION_*_PROMPT.md` 缺狀態欄，打開 prompt 看到「⏸ 待執行」誤以為沒做過（其實已完成）。

**影響**：接手者易混淆（cosmetic 但便宜）

**做法**：批次補 11 個 prompt 狀態欄，對齊 `CEO_GUIDE.md` 表格

**brtclaw 推薦**：✅ 已完成（11 個 SESSION prompt 狀態欄補齊）

**詳見**：[`SESSION_X2_PROMPT.md`](./.archive/handoff/sessions/SESSION_X2_PROMPT.md)

---

### ✅ Session X3：觀察工具增強（dashboard 加 log/錯誤率 panel）（已完成 2026-07-01，3 commits）

**業務問題**：
dashboard 只看訂單。故障排查要翻 logs/ 目錄。比讀檔案慢且看不到錯誤率趨勢。

**影響**：故障排查效率低

**做法**：3 個改動（1-1.5 hr）
- ✅ X3-A：`GET /api/recent-orders` 端點（`bb87319`）
- ✅ X3-B：結構化日誌查詢 `GET /api/logs`（`1269722`）
- ✅ X3-C：錯誤率趨勢 widget（Chart.js）（`ff6462a`）

**brtclaw 推薦**：✅ 已完成

**詳見**：[`SESSION_X3_PROMPT.md`](./.archive/handoff/sessions/SESSION_X3_PROMPT.md)

---

### 🟢 Session X4：csvWriter retry + trigger cache（2026-07-01 衍生）

**業務問題**：
2 個小漏洞：
1. `csvWriter`：偶發 lock 衝突會掉訂單（無 retry）
2. `triggers`：每次 LLM 觸發重讀 KB，浪費 IO

**影響**：偶發失敗 + 多餘 IO load

**做法**：2 個改動（1.5 hr）
- X4-A：csvWriter retry with backoff
- X4-B：trigger 結果 30 秒 TTL cache

**brtclaw 推薦**：做（1.5 小時、低風險）
**你決定**：______

**詳見**：[`SESSION_X4_PROMPT.md`](./.archive/handoff/sessions/SESSION_X4_PROMPT.md)

---

### 🟢 Session X5：Worker + api-server 健康檢查端點 + watchdog 延伸（2026-07-01 衍生）

**業務問題**：
- 3 個 service（Worker / api-server / dashboard）無統一健康端點
- watchdog 只看 dashboard port 3000，不知 Worker / api-server 是否活著

**影響**：故障察覺依賴個別看 log，無法統一

**做法**：3 個改動（1 hr）
- ✅ X5-A：`GET /healthz` 統一健康端點（`fb77a7e`）
- ✅ X5-B：watchdog 改用 /healthz（`4811708`）
- ✅ X5-C：api-server background 啟動 SOP 寫進 ENGINEERING_HANDBOOK §6.7（`4d4570c`）

**brtclaw 推薦**：✅ 已完成（無獨立 `start-api-server.sh`，SOP 內化）

**詳見**：[`SESSION_X5_PROMPT.md`](./.archive/handoff/sessions/SESSION_X5_PROMPT.md)

---

### 🟢 Session I：api-server + dashboard-server production hardening（已完成 2026-06-29）

**業務問題**：
`api-server.js` 還沒 production-ready。沒有 graceful shutdown、沒有 CORS 白名單、沒有 rate limiting、沒有 input validation schema。
`dashboard-server.js` 的 `yaml.dump` 會破壞 yaml 格式（P1-9，例如加不必要的引號、改 key 順序）。

**影響**：
- production 重啟可能讓客戶 in-flight request 突然斷線
- 跨域請求會被 Worker 端瀏覽器擋下（dev 環境 `*` 在 prod 有風險）
- 沒 rate limit → 單一來源 DDoS 可能打爆 api-server
- 沒 input validation → 任意超長字串 / 任意型別都能寫進 CSV
- yaml.dump 把檔案讀不出原本格式 → admin 改個 open_dates 整個檔案重洗

**做法**：
api-server.js 5 個 hardening + dashboard-server.js 1 個 yaml 修整：
1. graceful shutdown（SIGTERM + 10s timeout + in-flight wait）
2. CORS 白名單從 `API_CORS_ORIGINS` env 讀（預設關閉）
3. IP-based rate limit（預設 60 req/min，env 可調）
4. input validation schema（必填 + 型別 + 長度上限）
5. yaml 字串 patch 取代 yaml.dump（P1-9）

**brtclaw 推薦**：做（2-3 小時、中風險）
**實際**：完成、6 commits（I1-I5 + tests）、npm test 連 3 次全綠、lint 0 errors

---

### 🟢 Session J：雙位置架構強化（已完成 2026-06-29）

**業務問題**：
`scripts/sync-mirror.sh` 同步時會**自動刪除主位置的測試資料**。意思是如果你不小心跑錯，主位置的真實資料可能被清掉。

**影響**：
- sync 指令要小心用（沒有 dry-run）
- 不熟悉的人可能誤刪資料
- `cleanup-test-orders.sh` 跟 `tests/helpers/cleanup.js` 兩處定義 PROTECTED 清單，容易 drift

**做法**：
1. sync-mirror.sh 加 `--dry-run` 選項（先看會動什麼）
2. sync-mirror.sh 加 `.rsync-filter` 排除測試 CSV
3. `cleanup-test-orders.sh` 整合 helper（避免重複定義 protected 清單）

**brtclaw 推薦**：做
**預估**：1-2 小時、低風險
**實際**：完成、3 commits、npm test 28 套全綠 + lint 0 errors、rsync --exclude-from 驗證 fixture 不會 sync 到 production

---

### 🟢 Session L：API 文件化（已完成 2026-06-29）

**業務問題**：
`api-server.js` 對外 HTTP API 沒有文件。Hubert 或未來工程師不知道有哪些端點、怎麼呼叫、要帶什麼 request。

**影響**：
- 改完 API 文件要靠口述 / grep source code
- Worker 整合要讀 api-server.js 才知道 schema
- 客戶或外部 debugging 沒對外文件

**做法**：
1. `openapi.yaml` — OpenAPI 3.0 spec for 5 個 endpoints
2. `GET /api/docs` Swagger UI 互動式文件（需 auth）
3. `docs/API_CURL.md` — curl 範例 + e2e 流程 + 常見錯誤對照表

**brtclaw 推薦**：做
**預估**：1-2 小時、低風險
**實際**：完成、3 commits（純文件 + 1 個 endpoint）、0 npm 依賴、Swagger UI 從 unpkg CDN

---

### 🟢 Session K：結構化 logging（已完成 2026-06-29）

**業務問題**：
程式裡到處 `console.log` / `console.error`，訊息格式不一致。出問題很難找原因。

**影響**：
- 客戶回報錯誤，你要 grep 一堆 console 訊息
- 沒辦法依「嚴重程度」過濾 log

**做法**：
建立 `src/utils/logger.js`，提供 `logger.info/warn/error()`，JSON 格式輸出。

**brtclaw 推薦**：做（2 小時、中風險）
**實際**：完成、4 commits（99e44e5/2c983b0/c5435df/6d6925f）、src/ + scripts/ 共 91 個 console 改用 logger、29 套測試全綠、0 npm 依賴、JSON output 讓 journald/log aggregator 好 parse

---

### 🟡 Session Q：客戶實測 4 個 production bug 修整（**部分完成**）

**業務問題**：
Hubert 2026-06-30 10:46 實測真實 LINE 帳號，發現 4 個 production bug。

**影響**：
- 🔴 客戶問「菜單」沒傳圖片（LINE 平台 fallback 純文字菜單）
- 🟡 `~/.openclaw/workspace-external-user/memory/` 路徑錯誤（AGENTS.md 與實際位置不一致）
- 🟡 回覆卡住（LINE 推送延遲 / reply token 過期）
- 🔵 Dashboard 未啟動（要手動 `node scripts/dashboard-server.js`）

**brtclaw 推薦**：做（2-3 小時、🔴 高優先）

**實際狀態**（2026-07-03 結論收斂 + drift 修整）：
- ✅ Q1：菜單從 ignored_keywords 移除（commit `4e2376f`）
- ✅ Q2：memory 路徑（2026-06-30 修整已完成，純文件 drift）— `~/.openclaw/workspace-external-user/AGENTS.md` 第 60-73 行已標註使用 `/workspace/memory/`；`main_idea.md` 已是 symlink
- ✅ Q3：回覆卡住（結論收斂：不是 bug）— session `65bdbccd` 顯示 LLM 全部 `stopReason: stop` 立即回應，「卡住」是 LINE 平台體驗問題
- 🟡 Q4：dashboard watchdog cron job 加了（`2d4c90f`），但「首次啟動 SOP」未正式化（X5-C §6.7 涵蓋類似情境）

**為何 Q2/Q3 標記 ✅**：原本被視為「未處理」實際上是程式碼已完成但狀態欄沒對齊（文件 drift）。Hubert 2026-07-03 13:05 詢問時 brtclaw 誠實回報並驗證。

**剩餘優化項（Q4 背景啟動 SOP 正式化）**：估 30 分鐘
- 不需獨立 session，可在下次「文件一致性收尾」順手補
- 或下次需要 dashboard 自動重啟時一起處理

---

### 🟢 Session M：Backup 機制（已完成 2026-06-29）

**業務問題**：
`data/orders/` 與 `knowledge/tenants/` 沒有自動備份。如果磁碟壞掉或誤刪，真實訂單資料（6/13、6/16）會永久消失。

**影響**：
🟢 低（影響災難恢復）

**做法**：
新增 `scripts/backup.sh` — tar.gz 打包核心資料到 `~/.backups/chicken/`，配 7 天 rotation。寫 `scripts/backup_smoke_test.sh` 驗證備份邏輯。

**brtclaw 推薦**：做（1 小時、低風險）
**實際**：完成、2 commits (acecd3e/c87cd87)、backup_smoke_test.sh 5 步測試全綠、crontab 設定命令寫在 PHASE1_PROGRESS（看下記「Hubert 需決策」）

**Hubert 需決策**：
- 排程方案 A — OpenClaw cron（推薦，與你環境整合）
- 排程方案 B — 系統 crontab（傳統做法）
- 預設時間：每天 02:00（避開營業時間）

**實際（2026-06-29）**：Hubert 選擇**方案 A**，brtclaw 用 cron.add 加 job
- Job ID `bd933551-4774-4533-91b9-8599777bd6d3`
- Force run 驗證成功（archive 20K / 27 檔含真實訂單）

---

## 你的決策輸入格式

直接在 Discord 回：

```
E: D（純 postback）
D3: 做
D4: 做
F: 做
G: 之後做
H: 做
J: 做
K: 做
```

brtclaw 收到後會：
1. 寫入 `docs/DECISIONS_NEEDED.md`
2. 更新 `docs/CLEANUP_PHASE_2_PLAN.md` 標記已決策
3. 通知你「可以 renew session 處理」

---

### ✅ Session P0：Gmail 整合（已完成 2026-07-18）

**業務問題**：
老闆接收 LINE handoff 通知、autoOrder 建單、訂單彙總—— 目前全部靠 LINE push API，每月 500 則額度上限。7/16-7/31 已額滿，8/1 reset。如果 line bot 有 100 則以上客戶訊息要走 handoff，老闆會收不到。

**影響**：
- 客戶触發 handoff 後老闆收不到通知（客戶、訂單、付款狀態都看不到）
- 訂單彙總無法自動寄送（要手動問）
- LINE 500/月是硬限制，不可超越

**做法**：
1. Gmail API 整合：OAuth 2.0 Desktop app flow，refresh_token 永久有效（不限額）
2. notifyHubert 永遠 LINE + Email 並行（不取代 LINE，只備援/備份）
3. 4 種 Email 版型：handoff / autoOrder / digest / system
4. 日報/週報 cron 腳本（send-digest.js）：每日 23:00、週日 10:00 Asia/Taipei

**預估**：初次 4-6 hr、後續維護 0 hr（refresh_token 永久）

**架構更正（Session 中）**：
- LINE 500/月只影響 outbound push，inbound webhook 無限（LINE 只是 gateway，外部限制不影響內部處理）
- Email 是主要通知管道（無限額），LINE 是備援
- GCP project `chickencustomerservicesheets`（獨立 project，與 main 分離）

**版本演進（v0→v7）**：
- v0：基礎 Gmail fallback（LINE 失敗才寄）
- v1：永遠 LINE+Email 並行
- v2：4 種版型 + OAuth loopback callback
- v3：純文字精美 + 重要欄位全加（box header）
- v4：handoff 退款/地址確認 + 中文付款標籤
- v5：移掉 box chars，純文字大標題（Hubert 04:32 反饋）
- v6：日報/週報 cron + Sheets sync + 文件對齊
- v7：89 cloudflared 清理預防 + B 方案 v2 false positive 統計

**你決定**：「做」 ✓ 完成

---

_本指南是 CEO 與 brtclaw 溝通決策的橋樑_

_最後更新：2026-07-18 06:15（Session P0 v7 Gmail 整合完成）_
