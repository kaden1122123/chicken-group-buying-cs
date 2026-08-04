# knowledge/tenants/chicken/ — INDEX 對齊清單

> **建立時間**：2026-06-28（Session F）
> **最近對齊**：2026-08-04 12:36（Hubert 12:15 手動修訂 + 12:36 刪除 09 後，brtclaw 對齊本 INDEX）
> **維護者**：Hubert（檔案內容）+ brtclaw（INDEX 同步）
> **目的**：single source of truth — **11 個章節**各自一個主題，避免內容散落

---

## 用途

`knowledge/tenants/chicken/` 是雞味客服 LLM 用的結構化知識庫。每個 .md 檔是「特定主題的 single source of truth」。

**與 production prompt 的關係**：
- `docs/production-prompt/2026-07-03/main_idea.md`（prompt）— **對話規則 + 人設語氣**
- `knowledge/tenants/chicken/*.md`（知識庫）— **領域事實**
- 兩者搭配：prompt 教 LLM 怎麼說話，知識庫告訴 LLM 領域細節

---

## 11 個檔案結構（2026-08-04 12:36 對齊）

| # | 檔案 | 主題 | byte | 章節 |
|---|------|------|------|------|
| 01 | `01_product.md` | 商品（雞肉/小菜/限量加購/保存） | 1850 | 菜單 / 小菜 / 限量加購 / 保存 / 推薦組合 / 製程 / AI 守則 |
| 02 | `02_order_flow.md` | 下單流程與收單時間 | 3225 | 開團日期 / LINE 下單步驟 / 訂購格式 / 時段 / 收單時間規則（核心）/ 訂單確認模板 / 訂單成立步驟 / 訂單成立標準 |
| 03 | `03_payment.md` | 付款方式（4 種） | 1032 | 1. 現金 / 2. 銀行轉帳 / 3. 街口支付 / 4. LINE Pay / 訂單成立核心 / AI 守則 |
| 04 | `04_delivery.md` | 配送規則 | 770 | 時段 / 門檻 / 配送範圍 / AI 判斷 / AI 守則 |
| 05 | `05_promotion.md` | 促銷活動 | 909 | 基本原則 / 開團規則 / LINE 社群 / 公告時程 / 公告語氣 / AI 回覆 |
| 06 | `06_faq.md` | 常見問題 | 1451 | 訂購與保存 / 付款 / 配送 / 訂購流程 / 商品 / 其他 |
| 07 | `07_transfer_rules.md` | 人工介入（Handoff）14 種情況 | 2880 | 核心理念 / 觸發：語意相近就觸發 / 14 種情況分級 / 安全流程（CSV 安全閘）/ 通知格式 / AI 邏輯分流 / 禁止 / 語意觸發四原則 |
| 08 | `08_owner_info.md` | 老闆（Hubert）資訊 | 1052 | 聯絡 / 品牌 / 老闆親自回覆 / AI 定位 / 對外口徑 / 禁止 |
| 10 | `10_customer_tags.md` | 客戶標籤 | 1256 | 客戶身份 / 訂單狀態 / 需注意 / 客戶偏好 / 成交機會 / 範例 / 標籤時機 / 真人交接 |
| 11 | `11_lead_followup.md` | 潛客跟進 | 1430 | 原則 / 7 情境話術 / 禁止 |
| 12 | `12_reply_examples.md` | 回覆範例 | 2402 | 人格 / 開場 / 常用 12 場景回覆 / 禁止 vs 正確回覆 |

**11 檔總 byte**：17,259 bytes（不含本 INDEX）
**含 INDEX**：21,318 bytes

---

## 變更歷史

| 日期 | 變更 |
|------|------|
| 2026-08-04 12:36 | 刪除 `09_order_standard.md`（Hubert 授權），KB 從 12 → 11 |
| 2026-08-04 12:15 | Hubert 手動修訂全部 12 個 KB 檔案的權威版本 |
| 2026-08-04 12:18 | brtclaw INDEX 對齊 12:15 版本 |

---

## Single Source of Truth 鐵律

- 任何「領域事實」（品項/價格/配送/付款/開團日/轉人工條件/客戶標籤）**必須**從 L1 KB 11 檔讀
- LLM prompt（main_idea.md）**不再硬編碼** 領域事實表（避免 double-source-of-truth）
- 改 L1 KB → 同步更新本 INDEX 的「最近對齊」日期
- 11 檔任意改動 → brtclaw 必須重新生成 INDEX 並驗證

---

## 與其他檔案的交叉引用

| 引用本目錄 | 位置 |
|-----------|------|
| `src/knowledge/loader.js` | loadProductMenu/loadOrderFlow/loadPaymentRules/loadDeliveryAreas/loadFAQ/loadTransferRules 6 個函式對應 01-04, 06, 07 檔 |
| `src/knowledge/triggers.js` | INTENT_KB_MAP 對應每個 intent 用的 KB（已移除 09 引用） |
| `scripts/verify-kb-sources.js` | EXPECTED_FILES 11 個（已移除 09） |
| `docs/production-prompt/2026-07-03/main_idea.md`（prompt）| §五 A 開團日期動態讀 config、§九 收單時間規則、§十二 通知管理員守則 → 各章節對應 KB |
| `docs/production-prompt/main_idea_pure.md`（純人設）| Round 37.2 新增；不再硬編碼 KB 涵蓋的價格/配送/付款 |

---

## 待辦

| 項目 | 狀態 | 備註 |
|------|------|------|
| ~~09_order_standard.md 重新設計 or 刪除~~ | ✅ 已刪除 (12:36) | |
| 12_reply_examples.md 加 A 方案範例 | ⏸ 待做 | 客戶「確認」後 LLM reply 範例 |
| 08_owner_info.md 敏感資料保護 | ⚠️ 待評估 | 是否要從 git 移到 env 或加密 |

---

_本 INDEX 由 brtclaw 同步維護；下次 KB 任一檔改動後必須重生成_
_2026-08-04 12:36 對齊 Hubert 12:15 手動修訂版 + 12:36 刪除 09_
