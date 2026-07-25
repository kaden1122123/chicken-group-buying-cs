# 雞肉團購智能客服 — 當前狀態

> 建立時間：2026-06-01
> 最後更新：2026-06-11
> 狀態：知識庫重構階段 → 準備上線

---

## 📍 當前進度

```
[✓] 專案目錄建立
[✓] README.md 規劃書建立
[✓] F1-F8 功能需求清單（已提供審查連結）
[✓] Human Handoff 流程設計（初版）
[✓] 訂單系統整合設計（試算表機制，初版）
[✓] SOUL.md（核心準則，永遠載入）
[✓] AGENTS.md（lazy load 架構說明）
[✓] USER.md（消費者背景）
[✓] memory/（每日記憶）
[✓] knowledge/main_idea.md（完整 Prompt，lazy load）
[✓] LINE Webhook 長訊息 401 修復（2026-06-08）
[✓] 系統架構圖更新（2026-06-08）
[✓] knowledge/base/ 重構（12 個結構化知識檔案，2026-06-11）
[✓] main_idea.md 內容遷移至 knowledge/base/
[✓] 付款規則統一以 main_idea.md 為準（首購超過 NT$1,000 需轉帳）
[ ] Hubert 審查知識庫內容正確性
[ ] Hubert 審查（SOUL.md / Human Handoff / 訂單系統）
[ ] KV 寫入初始付款資訊（待 Cloudflare API Token）
[ ] Human Handoff 通知機制實作（LINE Push Message）
[ ] Rich Menu 設定文件（待 Hubert 提供）
[ ] 測試驗證（rate limiting、prompt injection、SQL injection）
[ ] 上線部署
```

---

## 🏗️ Lazy Load 架構（已實作）

```
SOUL.md（永遠）→ 核心身份、不可錯誤資訊、100% 轉真人觸發條件
     ↓
knowledge/base/（情境觸發，12 個結構化檔案）
  ├ 01_product.md        — 完整菜單（品項、價格、規格、特色）
  ├ 02_order_flow.md     — 下單流程 + 收單時間規則（11:00/13:00/14:00/18:00）
  ├ 03_payment.md        — 付款方式與訂單成立規則
  ├ 04_delivery.md       — 配送範圍與門檻
  ├ 05_promotion.md      — 優惠活動與 LINE 社群公告規則
  ├ 06_faq.md            — 常見問題（擴充至 19 題）
  ├ 07_transfer_rules.md — 必須轉真人的 14 種情況 + 通知格式
  ├ 08_owner_info.md     — Hubert 聯絡資訊（嚴禁對外透露）
  ├ 09_order_standard.md — 接單 10 步驟與標準作業流程
  ├ 10_customer_tags.md  — 客戶標籤規則
  ├ 11_lead_followup.md  — 潛在客戶跟進話術
  └ 12_reply_examples.md — 完整回覆範例全集

main_idea.md（輔助）— 完整 Prompt 原文，供交叉參照用
```

---

## 🔖 Hubert 已確認項目（2026-06-05）

- **F7 售後服務策略：** 統一文字回覆 + 人工處理，不做複雜對話判斷
- **Human Handoff：** AI 無法處理時，通知 Hubert（LINE/Email）
- **訂單系統：** 優先以試算表收集訂單，之後擴充 Gmail 等通知方式
- **Agent 設定檔：** 獨立 SOUL.md, AGENTS.md, USER.md, memory/（已建立）
- **完整知識庫：** `main_idea.md`（Hubert 提供完整版 agent prompt）
- **付款資訊：** config.yaml 已具備，待寫入 KV（需 Cloudflare API Token）
- **配送規則：** 雞肉 1 盒以上免運，小菜滿 NT$350 免運
- **品牌名稱：** 雞味研究所

## ❌ 阻礙項目

- **KV 寫入：** 需要 Hubert 提供 Cloudflare API Token
  - Key: `payment:bank_account`, `payment:jko_qr_code_url`, `payment:line_pay:line_id`
  - 備份位置：`04_技術架構/KV_付款資訊.md`

---

## 📅 更新日誌

### 2026-06-01 — 專案啟動

**事件：** 建立完整規劃目錄結構

**產出：**
- `README.md` — 專案規劃書入口
- `01_專案概覽/PROJECT_STATE.md` — 當前狀態（本檔案）
- `02_商業分析/` — 商業模式與用戶畫像（待填寫）
- `03_產品設計/` — 功能需求、對話流程、UX（待填寫）
- `04_技術架構/` — 架構圖、知識庫、Prompt、dmpolicy（待填寫）
- `05_數據與資料/` — 資料需求清單（待填寫）
- `06_測試計畫/` — 測試案例、驗收標準（待填寫）
- `07_部署與維運/` — 部署檢查、監控（待填寫）
- `08_風險管理/` — 風險評估（待填寫）

### 2026-06-08 — LINE Webhook 長訊息 401 修復 ✅

**問題：**
- 長訊息（100字以上）→ Cloudflare Worker → OpenClaw → **401 Unauthorized**
- 短訊息（0-20字）✅ 正常

**根本原因：**
1. Worker 驗證 LINE signature ✅（使用 Worker 的 `LINE_CHANNEL_SECRET`）
2. Worker 修改 body（過濾 blocked events）後轉發到 OpenClaw
3. 轉發時仍使用**原始 signature**（針對原始 body 計算的）
4. OpenClaw 收到 modified body + 原始 signature → signature 驗證失敗 → 401

**修復內容：**
1. **新增 `generateLINESignature` 函數** — 為修改過的 body 產生新 signature
2. **修改 Step 5 轉發邏輯** — 使用 `newSignature` 而非原始 `signature`
3. **付款關鍵字攔截邏輯** — 短訊息（≤50字）才攔截，長訊息放行
4. **OpenClaw LINE 設定** — `534zsteg` 帳號加上 `webhookPath: "/line/534zsteg"`

**技術細節：**
- Worker 版本：`2eb126a9-7041-4f86-aa8a-c99ff73ec0d5`
- OpenClaw 設定：`channels.line.accounts.534zsteg.webhookPath = "/line/534zsteg"`
- LINE Webhook URL：`https://external-user-line-security.kaden1122123.workers.dev/webhook`（不變）

**修復後架構：**
```
LINE → /webhook → Worker 驗證 signature ✅
                    ↓
              過濾 blocked events
              產生 newBody
                    ↓
              產生 newSignature = generateLINESignature(newBody, LINE_CHANNEL_SECRET)
                    ↓
              POST /line/534zsteg
              Header: X-Line-Signature: newSignature
                    ↓
              OpenClaw 用 534zsteg 驗證 ✅ → 200
```

**關鍵學教：**
- 任何修改 body 的 middleware，都必須為新 body 重新計算 signature
- 轉發時不能使用原始 signature

### 2026-06-11 — 知識庫重構 ✅

**事件：** 將 `main_idea.md` 內容結構化遷移至 `knowledge/base/`（12 個檔案）

**變更原因：**
- Hubert 反映：不用 RAG 的話，很多流程、規則客服不會遵守
- `main_idea.md` 是單一龐大 Prompt，Agent 難以精準觸發對應規則
- 結構化後每個檔案對應一個明確主題，Agent 可根據情境讀取特定檔案

**遷移產出（12 個檔案）：**

| 檔案 | 內容 |
|------|------|
| `01_product.md` | 完整菜單（19 項商品，含價格、規格、特色） |
| `02_order_flow.md` | 下單流程 + 收單時間規則（11:00/13:00/14:00/18:00） |
| `03_payment.md` | 付款方式與訂單成立規則（統一以 main_idea.md 為準） |
| `04_delivery.md` | 配送範圍與門檻 |
| `05_promotion.md` | 優惠活動與 LINE 社群公告規則 |
| `06_faq.md` | 常見問題（從 10 題擴充至 19 題） |
| `07_transfer_rules.md` | 必須轉真人的 14 種情況 + 完整通知格式 |
| `08_owner_info.md` | Hubert 聯絡資訊（禁止對外透露） |
| `09_order_standard.md` | 接單 10 步驟與各種情境標準作業流程 |
| `10_customer_tags.md` | 客戶標籤規則（身份/狀態/偏好/成交機會） |
| `11_lead_followup.md` | 潛在客戶跟進話術（7 種情境） |
| `12_reply_examples.md` | 完整回覆範例全集（含禁止話術） |

**保留：**
- `main_idea.md` — 完整 Prompt 原文，供交叉參照，不作為主要知識觸發來源

**技術決策：**
- Phase 1 採用純 Prompt 架構（不上 Cognee RAG）
- RAG 為未來擴充選項（當 SOP 複製到其他商業類別、知識庫膨脹後再評估）

---

_本檔案為滾動式更新，每次變更後立即更新。_