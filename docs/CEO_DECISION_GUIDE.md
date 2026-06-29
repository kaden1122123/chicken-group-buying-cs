# 雞味客服 — CEO 決策指南（給 Hubert）

> **目的**：讓 CEO 能在 1 分鐘內理解每個 session 的「做什麼、為什麼做、要不要做」
> **使用方式**：每個 session 開始時，brtclaw 用本指南的格式問你決策
> **撰寫原則**：以「功能性」描述，不列函數 / 變數 / 程式碼

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

### 🔴 Session E：6/16 訂單流程方向（影響 production）

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
**你決定**：______

---

### 🔴 Session D3：客服業務規則統一（5 個硬規則）

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

### 🔴 Session D4：9 個開關無作用

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

### 🟡 Session F：文件一致性 + 6/26 audit 剩餘決策落地

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

### 🟡 Session G：CI/CD + ESLint + .nvmrc

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

### 🟡 Session H：6 個 helper 補 unit test

**業務問題**：
6 個重要的輔助模組（金額計算、訂單 ID 產生、訂單讀取、時間處理、訊息格式）**完全沒有專屬 unit test**。如果有人改壞了，現有測試抓不到。

**影響**：
- 改了 `orderFormatter.js`（金額計算）壞了，沒測試抓
- 改了 `csvReader.js`（讀訂單）壞了，沒測試抓

**做法**：為這 6 個模組補 50+ 個 unit test

**brtclaw 推薦**：做（3-4 小時、中風險）
**你決定**：______

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

_本指南是 CEO 與 brtclaw 溝通決策的橋樑_
