# 雞肉團購客服 — 6/15 跟進規劃

> 建立時間：2026-06-15 07:30 (Asia/Taipei)
> 維護者：brtclaw
> 狀態：⏸ Planning（80%）— 等 Hubert 檢查
> 性質：6/14 後續問題完整規劃，4 大類共 11 項

---

## 0. 當前狀態摘要（2026-06-15 07:30）

| 項目 | 狀態 | 證據 |
|------|------|------|
| Gateway 重啟 | ✅ 成功 | PID 1850261，於 6/14 重啟 |
| 朋友收到測試訊息 | ✅ 收到 | systemSent: True，21:08 成功送出 |
| 朋友訂單進 CSV | ❌ 沒有 | 只有 6/13.csv 21 筆 PENDING 測試資料 |
| AI 自我介紹 | ❌ 仍自我介紹為 AI | main_idea.md 開頭「AI 小幫手」|
| 街口支付 | ❌ 觸發通用訊息 | Worker PAYMENT_KEYWORDS 包含「街口」|

---

## 1. 問題總覽（4 大類共 11 項）

| ID | 類別 | 問題 | 嚴重度 | 修法複雜度 |
|----|------|------|--------|-----------|
| A1 | 架構 | 移轉到 external-user agent workspace | 🟡 中 | 中 |
| A2 | 架構 | 更新 README.md / 重整零碎檔案 | 🟡 中 | 小 |
| B1 | 儀表板 | 加 config 設定區塊 | 🟡 中 | 中 |
| B2 | 儀表板 | 對外（管理員）存取控制 | 🟡 中 | 中 |
| C1 | 人設 | 不以 AI 自我介紹 | 🔴 高 | 小 |
| C2 | 人設 | 保持服務人員角度 | 🔴 高 | 小 |
| D1 | 業務邏輯 | 開團日期查詢 | 🔴 高 | 小 |
| D2 | 業務邏輯 | 訂單流程（提前寫 CSV）| 🔴 高 | 中 |
| D3 | 業務邏輯 | 配送範圍改「三鶯生活圈」| 🟡 中 | 小 |
| D4 | 業務邏輯 | 街口支付應該輸出 URL | 🔴 高 | 中 |
| D5 | 業務邏輯 | 通知管理員而非顧客 | 🔴 高 | 中 |
| D6 | 業務邏輯 | CSV 沒寫入（朋友訂單）| 🔴 高 | 高 |

---

## 2. 各問題詳細分析

### A1. 移轉到 external-user agent workspace

**Hubert 描述：**
> 目前目錄為 `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service`，是暫存在 main agent 的 others projects 區塊內，我在思考有沒有必要移轉到 external-user agent 自己本身的工作區域

**現況：**
- 雞肉專案位於 main agent 的 `others projects` 區
- 與 external-user agent 跨帳號
- 維護/部署時需要切換目錄

**修法：**
- 移轉到 `/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/`
- **保留向後相容**：原路徑可繼續訪問（symbolic link 或 dual-location）
- 更新所有 require 路徑（但因為使用 `__dirname` 相對路徑，影響不大）
- 規模化時每個 tenant 自己一個子目錄

**實作步驟：**
1. 建立 `/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/`
2. 移動 src/、tests/、knowledge/、config/、data/、docs/、scripts/
3. 在原路徑建立 symlink 指向新位置（向後相容）
4. 測試 8 套測試全部通過
5. 更新 SPEC.md、PHASE1_PROGRESS.md 引用新路徑

**驗證：**
- 從新路徑跑全部測試 0 failure
- 從舊路徑（透過 symlink）也能跑測試

---

### A2. 更新 README.md / 重整零碎檔案

**現況：**
- 根目錄散落多個檔案：`PHASE1_PROGRESS.md`、`SPEC.md`、`REVIEW_GUIDE.md`、`main_idea.md`、`test_server.js`、`.env`、`.env.example`、`dashboard.html`
- 數個舊規劃目錄（01_專案概覽/、02_商業分析/...08_風險管理/）
- README.md 過時（仍是 6/12 之前的版本）

**修法：**
- 重寫 README.md，反映目前最新狀態（架構、SOP、儀表板、規模化）
- 將散落檔案整理進對應目錄
- 刪除或歸檔 01-08 舊規劃目錄（移到 docs/archive/）
- 保留根目錄乾淨：只留 `README.md`、`SPEC.md`、`PHASE1_PROGRESS.md`、`docs/`、`config/`、`knowledge/`、`data/`、`src/`、`tests/`、`scripts/`、`dashboard.html`

**實作步驟：**
1. 寫新的 README.md（v2.0）
2. 將 01-08 移到 `docs/archive/planning-2026-06-12/`
3. 整理根目錄
4. 更新文檔引用路徑

**驗證：**
- README.md 描述與實際架構一致
- 所有舊連結仍可訪問

---

### B1. 儀表板加 config 設定區塊

**Hubert 描述：**
> 儀表板內容除了顯示相關資訊外，也希望搭配可以有 config 設定的區塊

**現況：**
- `dashboard.html` 是唯讀（用 Chart.js 顯示資料）
- 沒有 config 編輯功能

**修法：**

**選項 A：HTML + 編輯表單**（推薦短期）
- 為常用 config 加上編輯表單
  - 開團日期（open_dates）：多行文字輸入
  - 忽略關鍵字（ignored_keywords）：多行文字輸入
  - 配送範圍：可配送清單
  - 商品價格：表格編輯
- 提交後呼叫 Node.js API → 寫入 config/tenants/{tenant}.yaml
- 需要重啟 OpenClaw 才生效（或用 KV 熱重載）

**選項 B：透過 LINE ChatOps**
- 客服管理員透過 LINE 訊息改設定（例如：「把開團日改為 6/20」）
- 在 prompt 中加入 ChatOps 邏輯
- 不需儀表板，但對客服管理員較陌生

**選項 C：分離的後台**
- 建立獨立管理後台 web app（不混在儀表板）
- 完整的 CRUD 介面
- 工作量大

**建議：A（短期）+ 預留 C（長期）**

**實作步驟：**
1. `dashboard.html` 加上「設定」tab
2. 表單欄位：開團日期、忽略關鍵字、配送範圍
3. POST 到 `/api/config/update`
4. 後端讀 config.yaml，改值，寫回
5. （可選）通知 OpenClaw 重載

**驗證：**
- 修改設定後重新生成 dashboard.html 顯示新值
- 設定變更後重啟 OpenClaw 生效

---

### B2. 對外（管理員）存取控制

**Hubert 描述：**
> 如何實現讓客服管理員(外部使用者)可以使用儀表板?

**現況：**
- 儀表板是靜態 HTML，無存取控制
- 如果放到 Cloudflare Pages / Workers，任何知道 URL 的人都能看

**修法：**

**選項 A：HTTP Basic Auth**（推薦短期）
- 環境變數 `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`
- 透過 .htpasswd 或 Cloudflare Access
- 簡單但有效

**選項 B：LINE SSO**（推薦長期）
- 用 LINE 帳號登入
- 檢查 LINE userId 是否為管理員
- 安全但實作複雜

**選項 C：IP 白名單**
- 限制特定 IP 才能訪問
- 適合固定 IP 場景

**建議：A（短期）+ 預留 B（長期）**

**實作步驟：**
1. 為 dashboard.html 加 HTTP Basic Auth
2. 帳號密碼透過環境變數設定
3. 部署到 Cloudflare Pages / Workers
4. 文件化登入資訊

**驗證：**
- 未登入會被擋下
- 用正確帳密可登入

---

### C1. 不以 AI 自我介紹

**Hubert 描述：**
> 雖然這是AI 客服，但是我想讓他先不要以AI 做自我介紹，就單純服務人員角度出發即可，不需要一出來就自我介紹是AI。保持著能不暴露自己是AI 最好的基準設計人設，不然會大幅削減客戶購買欲望(服務態度)。

**現況：**
- `main_idea.md` 開頭：「你是『雞味研究所』官方 LINE、社群與訂單後台的小幫手」
- SOUL.md：「AI 客服『小雞』」
- AGENTS.md 可能也有類似

**修法：**
- 移除所有「AI 客服」「AI 小幫手」「AI」字眼
- 改為「服務專員」「客服」「小雞」等中性詞
- 不主動說「我是 AI」
- 當被問「你是不是 AI/機器人」時，回應：「我是雞味研究所的服務專員，協助您處理訂購相關事宜。」

**實作步驟：**
1. 修改 `~/.openclaw/agents/external-user/SOUL.md`
   - 標題：去掉「AI」
   - 身份：服務專員
2. 修改 `~/.openclaw/agents/external-user/AGENTS.md`
   - 移除「AI 客服」相關描述
3. 修改 `~/.openclaw/agents/external-user/knowledge/main_idea.md`
   - 開頭：服務專員身份
   - 新增「被問到 AI 身份」回應指引

**驗證：**
- 開頭不再有「AI」字眼
- 對話測試：問「你是 AI 嗎？」回應是服務專員

---

### C2. 保持服務人員角度

**修法：**
- 不用「我是」「我」當主詞的「AI 化」語氣
- 用「雞味研究所」「我們」等團隊視角
- 增加人情味、體貼感

---

### D1. 開團日期查詢

**Hubert 描述：**
> 當客人提及`開團日期`是幾月幾號的時候，應該去 config.yaml 尋找 `open_dates` 區塊後顯示，或者有方法收錄並更新知識庫。不然剛剛測試客服時，得到的回應竟然是他不知道。

**現況：**
- 客戶問「下次開團是什麼時候？」
- AI 不知道（沒讀到 config.yaml）
- `main_idea.md` 沒有明確指示要讀 config.yaml

**修法：**

**選項 A：在 prompt 中嵌入 open_dates**（推薦）
- 每次 system prompt 直接包含「目前開團日期：2026-06-16, 2026-06-18, ...」
- 缺點：每次重啟才更新（或寫個 wrapper 自動 inject）

**選項 B：在 prompt 明確指示讀 config.yaml**（推薦長期）
- prompt 寫「開團日期請讀取 config.yaml 的 open_dates 區塊」
- 缺點：需要 OpenClaw 支援 function calling

**選項 C：用 KV 即時同步**
- Worker 定時從 config.yaml 同步到 KV
- prompt 透過 KV 讀取
- 缺點：複雜

**建議：A（短期）+ 預留 B（長期）**

**實作步驟：**
1. 修改 `~/.openclaw/agents/external-user/knowledge/main_idea.md`
2. 在「五、品牌與開團規則」加：
   ```
   目前開團日期（請優先用此清單回應客戶）：
   - 2026-06-16（週二）
   - 2026-06-18（週四）
   - 2026-06-23（週一）
   - 2026-06-26（週四）
   ```
3. 加指示：「開團日期若有變動，會由系統自動更新到本區塊」

**驗證：**
- 客戶問「下次開團」→ AI 回應正確日期
- 修改 config.yaml 後，重啟 OpenClaw，新的日期生效

---

### D2. 訂單流程（提前寫 CSV）

**Hubert 描述：**
> 通常顧客會傳送訂購資訊給客服，客服基本的流程會先請顧客確認完訂單、品項小計，確認完後就可以將資訊輸入對應 CSV，後續才會詢問/接受付款資訊(限銀行轉帳、街口支付...，先金當面給:不用，Line Pay 由其他專員確認)，(目前為真人確認，未來有機會由你自動確認)確認完付款資訊後會在 CSV 內更動顧客的付款狀態。

**新流程（Hubert 描述）：**
```
1. 客戶提供訂單資訊
2. 客服整理訂單摘要（品項/小計）
3. 客戶確認訂單
4. 客服寫入 CSV（payment_status: pending, order_status: confirmed）
5. 客服詢問付款方式
6. 客戶提供付款方式（限轉帳、街口；Line Pay 由真人）
7. 客戶提供付款證明（轉帳截圖、街口截圖）
8. 真人確認（或未來 AI 自動）
9. 客服更新 CSV（payment_status: paid）
10. 訂單成立
```

**當前流程（雞肉專案 src/）：**
```
1. AWAITING_INFO 收集欄位
2. CONFIRMING 客戶確認
3. AWAITING_PAYMENT 付款方式
4. COMPLETED 寫 CSV（payment_status: pending）
5. （無付款證明階段）
```

**差異：**
- 新流程：CSV 在步驟 4 寫入（confirmed）
- 當前：CSV 在步驟 5 寫入（completed）

**修法：**
- 修改 `src/states/awaitingPayment.js`：在客戶提供付款方式後，立即寫入 CSV（payment_status: pending）
- 修改 `src/states/completed.js`：付款證明確認後，更新 CSV（payment_status: paid）
- 加入新的 handoff 條件：「付款方式 = Line Pay」→ 轉真人確認
- 限制：銀行轉帳、街口支付才由 AI 處理

**但！** src/ 在 production 沒跑！實際上是 OpenClaw agent 在執行 LLM 邏輯。所以我需要：
- 在 `main_idea.md` 中明確指示這個新流程
- 確認 LLM 知道要呼叫 `writeOrder` / `updateOrder` 函式
- 或者建立 OpenClaw function calling 機制

**這是架構性問題，見 D6。**

**實作步驟：**
1. 修改 `main_idea.md`：新增「訂單流程 SOP」章節，明確指示：
   - 步驟 4：客戶確認訂單後，呼叫 `writeOrder` 寫入 CSV
   - 步驟 6：客戶提供付款方式
   - 步驟 7：客戶提供付款證明
   - 步驟 8：（目前真人確認）→ 未來 AI 自動
   - 步驟 9：呼叫 `updateOrder` 更新付款狀態
2. 修改 `src/order/csvWriter.js`：增加 `writePendingOrder` 函式（payment_status: pending）
3. 修改 `src/order/csvWriter.js`：增加 `updateOrderPayment` 函式
4. 新增 `tests/order-flow.test.js`

**驗證：**
- 模擬完整流程，確認 CSV 在步驟 4 寫入
- 模擬付款證明後，CSV 付款狀態更新

---

### D3. 配送範圍改「三鶯生活圈」

**Hubert 描述：**
> 部分區域可能誤導，所以改`三鶯生活圈`比較好

**現況：**
- `config.yaml.delivery.areas.allowed`：
  - 三峽北大特區
  - 三峽介壽國小周邊
  - 三峽安溪國中周邊
  - 鶯歌區（全區）
- `delivery.areas.denied`：
  - 大溪方向
  - 新店方向
  - 其他非三鶯生活圈地區

**修法：**
- 改 `allowed` 為「三鶯生活圈」（單一描述）
- 改 `denied` 為「非三鶯生活圈地區」
- 保留具體清單在 `knowledge/04_delivery.md`（給 LLM 看詳細內容）

**實作步驟：**
1. 修改 `config/tenants/chicken.yaml`（與 config.yaml）
2. 修改 `knowledge/tenants/chicken/04_delivery.md`（保留具體清單）

**驗證：**
- 客戶問「你們配送哪裡？」→ AI 回應「三鶯生活圈」
- 客戶問「XX 區能送嗎？」→ AI 查 04_delivery.md 給具體回應

---

### D4. 街口支付應該輸出 URL

**Hubert 描述：**
> 當客戶提及`街口支付`的`街口`時，會自動跑出 `🏦 付款資訊: 請稍後,付款資訊整理中。如有急需,請透過 LINE 與我們聯繫,謝謝!` 的自動傳送訊息，這是錯誤的，應該要由openclaw 思考過後並輸出街口支付的URL供顧客轉帳。

**現況：**
- Worker PAYMENT_KEYWORDS 包含「街口」
- 客戶說「街口」→ Worker 攔截 → `paymentInfoCache.getPaymentInfo()` 從 KV 讀
- 如果 KV 沒設定 → fallback「🏦 付款資訊整理中」

**修法：**

**選項 A：把街口 QR Code URL 設定到 KV**
- 設定 `payment:jko` KV key
- Worker 攔截時根據關鍵字回傳對應 URL
- 缺點：需要 KV 設定流程

**選項 B：把街口從 PAYMENT_KEYWORDS 移除**
- Worker 不攔截
- OpenClaw agent 處理，從 prompt 知識庫輸出 QR Code URL
- 缺點：失去 Worker 攔截的好處（節省 LLM 成本），但更精準

**選項 C：分開的 KV 處理**
- 為每種付款方式建立獨立 KV key
- `payment:jko`、`payment:transfer`、`payment:linepay`
- Worker 根據關鍵字回傳對應 KV

**建議：C（推薦）**

**實作步驟：**
1. 修改 Worker source code：
   - 拆分 PAYMENT_KEYWORDS 為 3 個分類（jko / transfer / linepay）
   - 為每種方式建立獨立 KV key
   - 攔截時根據關鍵字回傳對應 URL
2. 設定 KV：
   - `payment:jko` = `https://pub-ce7f744c6a2145a4a3277e8ed2c3f8fd.r2.dev/Payment/..._QRcode.jpg`
   - `payment:transfer` = 銀行帳號資訊
   - `payment:linepay` = Line Pay ID（由真人後續處理）
3. 部署 Worker
4. 設定環境變數 `JKO_QR_CODE_URL` 等

**驗證：**
- 客戶說「街口」→ 收到 QR Code URL
- 客戶說「轉帳」→ 收到銀行帳號
- 客戶說「Line Pay」→ 收到 Line Pay ID（轉真人）

---

### D5. 通知管理員而非顧客

**Hubert 描述：**
> 當通知管理員時，客服輸出的`AI客服轉報通知`、`緊急轉報`的目的地錯誤(傳送到顧客)，應當傳送給Hubert(管理員)。

**現況：**
- 雞肉專案 `src/handoff/notifier.js` 設計為送 LINE Push Message 給管理員
- 但「AI客服轉報通知」「緊急轉報」可能因為某些原因被當成回覆送到顧客端

**根因分析（需要在執行階段深入）：**
- 可能是 notificationFormat.js 訊息內容被誤送到 reply
- 可能是 notifier.js 呼叫的 LINE API 錯誤（呼叫 reply 而不是 push）
- 可能是 OpenClaw 內部把 Push 當作 Reply

**修法：**
- 確認 `src/handoff/notifier.js` 正確呼叫 LINE Push API（不是 Reply）
- 確認 `src/handoff/notificationFormat.js` 訊息內容標明「Hubert 通知」
- 在 `main_idea.md` 強調「通知管理員」與「回覆顧客」的分別
- 強調：通知管理員時**不要**附帶「我們已回覆客戶」的內容（因為那是指 Hubert 自己）

**實作步驟：**
1. 檢查 `src/handoff/notifier.js`：應該呼叫 Push API（不是 Reply）
2. 檢查 `src/handoff/notificationFormat.js`：訊息格式
3. 檢查 OpenClaw 內部是否有 bug
4. 修補後測試

**驗證：**
- 觸發 handoff → 確認管理員收到 Push 訊息、客戶收到 Reply 訊息（兩者分開）

---

### D6. CSV 沒寫入（朋友訂單）

**Hubert 描述：**
> 我有透過朋友的 Line 嘗試訂購訂單，但是訂單貌似沒有進入CSV檔案，請明察(`user:U117a0f0c89dcb4084df3c983bd863524`)。

**現況：**
- 朋友訂單完全沒寫入 CSV
- 只有 6/13 的 21 筆 PENDING 測試資料

**根因分析：**
- OpenClaw agent 的 LLM 邏輯不會自己呼叫 `csvWriter.writeOrder()`
- 需要 LLM 知道有這個 tool/function 並主動呼叫
- OpenClaw 預設可能沒有把 `writeOrder` 註冊為 LLM 可用的 tool

**修法：**

**選項 A：在 prompt 中加工具呼叫指引**
- 在 `main_idea.md` 中說明：「完成訂單時，呼叫 `writeOrder` 函式，參數為訂單資料的 JSON」
- 缺點：LLM 不一定會真的呼叫，可能只是輸出文字

**選項 B：建立 OpenClaw function calling 機制**
- 把 `writeOrder`、`updateOrder` 註冊為 LLM tools
- LLM 可以主動呼叫這些函式
- 這是架構性改動

**選項 C：建立後端 API**
- OpenClaw 透過 HTTP 呼叫 `http://localhost:PORT/writeOrder`
- 需要雞肉專案暴露 HTTP API
- 複雜

**建議：B（推薦長期）** + A（短期）

**短期修法：**
- 在 `main_idea.md` 中明確指示：「完成訂單後，**請輸出**訂單的 JSON 格式，由後台程式自動寫入 CSV」
- 由後台程式（OpenClaw 或其他 listener）監聽 LLM 輸出，自動呼叫 `writeOrder`

**長期修法：**
- 透過 OpenClaw 註冊 tool（writeOrder, updateOrder）
- 讓 LLM 可以直接呼叫

**實作步驟：**
1. 修改 `main_idea.md`：新增「訂單寫入」流程
2. 建立「後台 listener」：監聽 LLM 輸出，自動寫入 CSV
3. 測試

**驗證：**
- 朋友完成訂單流程 → CSV 有新訂單

---

## 3. 實作優先順序建議

依嚴重度和依賴關係，建議實作順序：

### 第一階段：核心修正（1 天）
- **C1 + C2**：人設修改（小、高優先）
- **D1**：開團日期查詢（小、高優先）
- **D3**：配送範圍改「三鶯生活圈」（小、中優先）
- **D5**：通知管理員（高優先，但需先看 notifier 程式碼）

### 第二階段：業務邏輯（1-2 天）
- **D2**：訂單流程提前寫 CSV（中、高優先）
- **D4**：街口支付 URL（中、高優先）
- **D6**：CSV 寫入（高優先但複雜，可能需 2 天）

### 第三階段：架構整理（0.5 天）
- **A1**：移轉 workspace（小、中優先）
- **A2**：更新 README.md（小、中優先）

### 第四階段：儀表板（1-2 天）
- **B1**：config 設定區塊
- **B2**：對外存取控制

---

## 4. 修法選擇決策（給 Hubert）

每個問題可能有多個修法，請 Hubert 拍板：

| 問題 | 選項 |
|------|------|
| D1 開團日期 | A（prompt 嵌入）/ B（讀 config）/ C（KV 同步）|
| D2 訂單流程 | 請詳述新流程細節（已詳述）|
| D4 街口支付 | A（KV 設定）/ B（移出 PAYMENT_KEYWORDS）/ C（分類 KV）|
| D5 通知管理員 | 需要先看 notifier 程式碼才能確定 |
| D6 CSV 寫入 | A（prompt 輸出 JSON）+ B（後台 listener）/ C（OpenClaw tool）|
| B1 儀表板 | A（HTML 表單）/ B（LINE ChatOps）/ C（分離後台）|
| B2 對外存取 | A（Basic Auth）/ B（LINE SSO）/ C（IP 白名單）|

---

## 5. 待 Hubert 決策

1. **實作順序**（按上述優先順序，還是其他？）
2. **每個問題的修法選擇**（見上表）
3. **範圍**：11 項全部做，還是分批？

---

_本檔案由 brtclaw 於 2026-06-15 07:30 規劃完成_
