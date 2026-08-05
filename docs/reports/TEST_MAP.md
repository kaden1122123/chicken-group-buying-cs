# TEST_MAP.md — 雞味客服 60 個測試人話地圖

> **建立時間**：2026-08-04 15:17（Round 37.5 — Hubert 要求）
> **目的**：把 `tests/` 底下 60 個測試檔（60/60 100% 綠燈）用「人話」分類整理，方便新進工程師快速理解每個檔案在測試什麼業務。
> **口徑**：繁體中文白話，**不寫程式碼細節**，只寫「為什麼要有這個測試」+「測試守護的業務邏輯」。

---

## 🗺️ 60 個測試的 6 大分類（業務視角）

| # | 分類 | 測試檔數 | 守護的業務 |
|---|------|---------|-----------|
| 1 | 🍗 **菜單與價格計算** | 10 | 客戶下的訂單算錢算得對不對 |
| 2 | 📍 **配送區域與地址判斷** | 2 | 客戶地址能不能送、地址格式合不合法 |
| 3 | 📋 **訂單格式與 CSV 解析** | 4 | 訂單怎麼轉成 Google Sheet 看得懂的格式 |
| 4 | 💬 **LINE 語氣、狀態與紅線觸發** | 13 | AI 客服在不同情境下怎麼回、要不要轉真人 |
| 5 | 📧 **Email 通知與信件排版** | 3 | 老闆收到信長什麼樣、有沒有寄出去 |
| 6 | 📊 **Google Sheets 同步與儲存** | 4 | 訂單真的寫進 Sheet 沒、有沒有被亂改 |
| — | ⚙️ **基礎建設**（跨多類） | 24 | 設定、log、安全、整合測試 — 上面 6 大類的「地基」 |
| **總計** | | **60** | |

> **為什麼有 24 個「跨類」測試？** — 因為雞味客服系統除了「業務邏輯」外，還需要 `config 載入`、`log 紀錄`、`安全防護`、`整合測試`這些基礎建設。它們是「讓 6 大業務類能跑起來」的隱形地基。

---

## 🍗 類別 1：菜單與價格計算（10 個測試）

**業務一句話**：客戶說「我要 2 隻玉米雞 + 1 份毛豆 + 1 罐雞油」，AI 算得出「2×820 + 1×70 + 1×160 = 1870 元」嗎？湊不滿 1 隻雞可以單買半隻嗎？整隻雞算 1 隻還是 2 盒？

| 測試檔 | 守護的業務邏輯 |
|--------|--------------|
| `rules.test.js` | 5 大規則的入口測試（電話/地址/日期/付款/時間）— 確保所有規則函式都活著 |
| `rules-menu.test.js` | 菜單驗證 — 客戶寫「鹽水雞」AI 認得、寫「炸雞」AI 不認得、寫「煙燻雞」AI 認得（模糊比對） |
| `rules-price.test.js` | 價格規則 — 半隻雞 380 元、整隻 820 元、小菜要湊滿 350 元才外送 |
| `rules-index.test.js` | 5 大規則的 index 對齊 — 加新規則時不能漏 index |
| `orderIdGenerator.test.js` | 訂單編號格式 — 不能重複、不能太短、要含日期 |
| `orderFormatter.test.js` | 訂單格式組裝 — 雞肉 1 隻 = 2 盒、半隻 + 整隻湊出 3 盒 |
| `parse-items-dedup.test.js` | 客戶重複寫「雞 1, 雞 1」AI 去重成「雞 2」 |
| `autoOrder.test.js` | B 方案自動建單 — 客戶講完訂單內容 AI 自動組成完整訂單 |
| `d4-phase2-stub.test.js` | D4 階段 2 stub 測試（暫存） |
| `receiptAnalyzer.test.js` | 客戶傳轉帳截圖，AI 讀金額確認收到錢 |

**為什麼這 10 個最重要**：客戶最在乎的是「我的訂單多少錢」「你有沒有算錯」「你送不送」。這 10 個守護的金流與訂單組成。

---

## 📍 類別 2：配送區域與地址判斷（2 個測試）

**業務一句話**：客戶寫「我在三峽北大特區」AI 立刻說「可以送」；寫「我在新店」AI 立刻說「對不起我們不送新店」；寫「台北市信義區」AI 不知道怎麼辦時立刻轉人工。

| 測試檔 | 守護的業務邏輯 |
|--------|--------------|
| `address-dynamic-keywords.test.js` | 配送範圍動態關鍵字 — 從 `04_delivery.md` 讀「北大特區」「介壽國小周邊」等關鍵字，不寫死 |
| `address-handoff.test.js` | 地址模糊時的紅線 — 客戶地址不在清單內，立刻轉人工不亂回答 |

**為什麼只有 2 個但很重要**：配送範圍是**老闆自己決定的**（三峽、鶯歌），不是系統寫死的。這 2 個測試守護「改配送規則時，AI 客服會即時跟著改」這件事。

---

## 📋 類別 3：訂單格式與 CSV 解析（4 個測試）

**業務一句話**：客戶的訂單要被存成 Google Sheet 看得懂的格式 — 標題列要固定、金額千分位、日期 `2026-08-04` 不能寫成 `2026/8/4`。

| 測試檔 | 守護的業務邏輯 |
|--------|--------------|
| `csvReader.test.js` | CSV 讀取 — Sheets 給的 CSV 要解析正確（千分位、換行、引號 escape） |
| `csv-writer-concurrency.test.js` | CSV 並發寫入 — 100 張訂單同時寫不能掉資料、不能 deadlock |
| `csv-writer-retry.test.js` | CSV 寫入重試 — 網路斷了要重試 3 次才放棄 |
| `whitelist.test.js` | 白名單測試 — 特定客戶（如公司客戶）有優惠 |

**為什麼這 4 個關鍵**：CSV 是「雞味客服」對「Google Sheets」的橋樑。CSV 壞了 = 整個訂單資料庫壞了 = 老闆看不到訂單。

---

## 💬 類別 4：LINE 語氣、狀態與紅線觸發（13 個測試）

**業務一句話**：AI 客服講話要像人、要分得清現在客戶在哪個階段（剛開始聊/正在下單/已付款/要轉真人）、要會在「客戶要退款」「客戶罵人」時立刻轉真人。

| 測試檔 | 守護的業務邏輯 |
|--------|--------------|
| `states.test.js` | 4 個狀態轉換 — IDLE → AWAITING_INFO → CONFIRMING → AWAITING_PAYMENT → COMPLETED |
| `states-idle.test.js` | 剛開始聊天狀態 |
| `states-awaitingPayment.test.js` | 等客戶付款狀態 |
| `states-completed.test.js` | 完成訂單狀態 |
| `state-trimmed-value.test.js` | 狀態值清理 — 不留多餘空白 |
| `lineReply.test.js` | LINE 回覆語氣 — A 問 A 答、不冗長、emoji 適中 |
| `lineProfileCache.test.js` | LINE 用戶 profile 快取 — 避免每次都打 LINE API |
| `triggers.test.js` | 紅線觸發 — 客戶說「退款」「叫真人來」時觸發轉真人流程 |
| `triggers-cache.test.js` | 觸發器快取 — 避免重複判斷 |
| `knowledgeTriggers.test.js` | 知識庫觸發 — 客戶問「菜單」自動載入 KB 01_product.md |
| `handoff.test.js` | 轉真人完整流程 — 寫 CSV → 回覆制式訊息 → push 老闆 LINE |
| `handoff-customer-reply.test.js` | 轉真人後客戶繼續講的處理 |
| `session-j-architecture.test.js` | Session J 架構驗證 — 整體狀態機對齊 |

**為什麼這 13 個是核心**：AI 客服的**人格**與**判斷力**全在這。客戶感受「這個 AI 會不會太冷淡」「這個 AI 會不會胡說八道」「這個 AI 會不會處理到一半當機」全靠這些測試守護。

---

## 📧 類別 5：Email 通知與信件排版（3 個測試）

**業務一句話**：老闆（Hubert）會收到 LINE 通知 + Email 通知，信件要排版漂亮、不能漏寄、不能寄錯人。

| 測試檔 | 守護的業務邏輯 |
|--------|--------------|
| `emailNotifier.test.js` | Gmail 寄信 — OAuth token 載入、MIME 編碼、daily digest、disabled 跳過 |
| `notifier.test.js` | LINE push + Email 雙通道 — LINE 失敗 fallback Email、Email 失敗 throw |
| `buildEmailContent.test.js` | 信件內容排版 — handoff/autoOrder/system 3 種版型、v3 完整重要欄位 |

**為什麼這 3 個特別**：Hubert 個人信箱 `k.chang.8844@gmail.com` 會每天收 1 封 digest + 多封 handoff 通知。如果寄錯、漏寄、重複寄，老闆就會漏接重要訂單。

---

## 📊 類別 6：Google Sheets 同步與儲存（4 個測試）

**業務一句話**：客戶的訂單會被同步到 `12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA` 這份 Google Sheet，老闆每天看 Sheet 就知道今天賺多少、哪些客戶要跟進。

| 測試檔 | 守護的業務邏輯 |
|--------|--------------|
| `sheetsSync.test.js` | Sheets 同步 — service account JWT 認證、values.append/get 完整路徑 |
| `api-server.test.js` | API server — POST /api/orders 完整建立訂單流程 |
| `api-server-hardening.test.js` | API server 加固 — 認證、限流、錯誤處理 |
| `dashboard-server-yaml-patch.test.js` | Dashboard 後台 + YAML 設定 patch |
| `dashboard-server-yaml-fallback.test.js` | Dashboard YAML fallback（js-yaml 缺失時） |

**為什麼這 4 個守護「收入」**：Sheets 是「訂單」對「金流」的真相來源。同步失敗 = 老闆以為今天沒訂單 = 漏出貨。

---

## ⚙️ 基礎建設（24 個跨類測試）

**這 24 個不歸上面 6 大類，但沒有它們其他類也跑不起來**：

| 類別 | 測試檔 | 守護 |
|------|--------|------|
| **設定載入** | `config.test.js` / `config-feature-flag.test.js` / `config-interface-adoption.test.js` | chicken.yaml 載入、feature flag 切換 |
| **時間/日期** | `date.test.js` / `rules-date.test.js` / `rules-timeSlot.test.js` / `timeUtils.test.js` / `timezone.test.js` | 上午/下午時段、收單時間、MOCK_TODAY 注入 |
| **付款方式** | `rules-payment.test.js` / `d3-payment-options-dynamic.test.js` | 現金/轉帳/街口/LINE Pay 4 種 |
| **電話/通訊** | `rules-phone.test.js` / `community-field.test.js` | 電話格式、社團欄位 |
| **Logger** | `logger.test.js` | log 結構化、info/warn/error 層級 |
| **安全/防護** | `security.test.js` / `sanitizer-extended.test.js` | 敏感資料遮罩、XSS 防護 |
| **整合測試** | `integration.test.js` | 端到端完整流程 |
| **架構驗證** | `session-j-architecture.test.js` | Session J 重構後的整體對齊 |
| **其他** | `rules-address.test.js`（地址規則）/ `transferRules.test.js`（轉帳規則）/ `notificationFormat.test.js`（通知格式）/ `send-digest.test.js`（寄送彙總）/ `sendImageMessage.test.js`（寄圖片訊息） | 各功能小單元 |

---

## 🗺️ 業務 → 測試對照速查表

| 業務問題 | 對標測試檔 |
|---------|-----------|
| 「客戶下單算錢會不會錯？」 | `rules-price.test.js` / `orderFormatter.test.js` |
| 「客戶寫的地址我們送不送？」 | `address-dynamic-keywords.test.js` / `rules-address.test.js` |
| 「訂單有沒有寫進 Google Sheet？」 | `sheetsSync.test.js` / `api-server.test.js` |
| 「AI 客服會不會講錯話？」 | `lineReply.test.js` / `triggers.test.js` |
| 「客戶罵人或要退款有沒有轉真人？」 | `handoff.test.js` / `triggers.test.js` |
| 「老闆今天有沒有收到 Email 通知？」 | `emailNotifier.test.js` / `notifier.test.js` |
| 「時間到了客戶還能下單嗎？」 | `rules-date.test.js` / `date.test.js` / `timeUtils.test.js` |
| 「客戶重複點按會不會重複建單？」 | `csv-writer-concurrency.test.js` / `parse-items-dedup.test.js` |
| 「客戶傳轉帳截圖 AI 認得出金額嗎？」 | `receiptAnalyzer.test.js` |
| 「整個系統從頭到尾跑得起來嗎？」 | `integration.test.js` |

---

## 📊 60 個測試統計

```
跑過:     60 個測試檔
通過:     60 個 ✅
失敗:     0 個
0 封真實信: ✅ (googleapis.com|api.line.me = 0 次)
```

**最後更新**：2026-08-04 15:17（Round 37.5 — 100% 綠燈里程碑）

_本檔由 brtclaw 自動產生（依 Hubert 15:17 階段 1 任務要求）_
_未來加新測試時，請更新本檔的 6 大分類對照表_
