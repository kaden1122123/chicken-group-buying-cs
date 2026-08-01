# knowledge/tenants/chicken/ — INDEX 驗證清單

> **建立時間**：2026-06-28（Session F）
> **維護者**：brtclaw
> **目的**：列出所有 chicken tenant 知識檔案的 single source of truth 狀態

---

## 用途

`knowledge/tenants/chicken/` 是雞味客服 LLM 用的結構化知識庫，分為 12 個章節。每個章節是「特定主題的 single source of truth」，避免內容散落。

**與 production prompt 的關係**：
- `~/.openclaw/agents/external-user/knowledge/main_idea.md`（prompt）— **對話規則**
- `knowledge/tenants/chicken/*.md`（知識庫）— **領域知識**
- 兩者搭配使用：prompt 告訴 LLM 怎麼對話，知識庫告訴 LLM 領域細節

---

## 檔案清單（12 個）

| # | 檔案 | 主題 | 大小 | 最後修改 | 驗證狀態 |
|---|------|------|------|----------|----------|
| 01 | `01_product.md` | 產品（雞肉品項、重量、價格）| 3620 | 2026-06-14 | ✅ Active |
| 02 | `02_order_flow.md` | 訂單流程（含 A 方案）| 3835 | 2026-06-14 | ✅ Active（待 A 方案後更新）|
| 03 | `03_payment.md` | 付款方式（4 種）| 2904 | 2026-06-14 | ✅ Active |
| 04 | `04_delivery.md` | 配送規則 | 2092 | 2026-06-15 | ✅ Active |
| 05 | `05_promotion.md` | 促銷活動 | 2200 | 2026-06-14 | ✅ Active |
| 06 | `06_faq.md` | 常見問題 | 4438 | 2026-06-14 | ✅ Active |
| 07 | `07_transfer_rules.md` | 轉帳規則 | 8966 | 2026-06-14 | ✅ Active |
| 08 | `08_owner_info.md` | 老闆資訊（敏感）| 1578 | 2026-06-14 | ⚠️ 含敏感資料，需保護 |
| 09 | `09_order_standard.md` | 訂單整理標準 | 3220 | 2026-06-14 | ✅ Active |
| 10 | `10_customer_tags.md` | 客戶標籤規則 | 2905 | 2026-06-14 | ✅ Active |
| 11 | `11_lead_followup.md` | 潛在客戶跟進 | 3876 | 2026-06-14 | ✅ Active |
| 12 | `12_reply_examples.md` | 回覆範例 | 4037 | 2026-06-14 | ✅ Active |

**總計**：12 個檔案，43,571 bytes（約 42.5 KB）

---

## 驗證 SOP（每次更新後）

```
1. 改動某檔案 → 更新本 INDEX 對應行的「最後修改」
2. 跑 grep 確認該檔案無 duplicate content（避免散落）
3. 跑 check-knowledge.sh（待建立）確認檔案結構
4. commit + push + rsync
```

---

## 待辦事項

| 項目 | 狀態 | 備註 |
|------|------|------|
| 02_order_flow.md 更新 A 方案內容 | ⏸ 待做 | Session N A 方案改的是 main_idea.md prompt，但 02 可能也有相關內容需同步 |
| 12_reply_examples.md 加 A 方案範例 | ⏸ 待做 | 客戶打「確認」後的 LLM reply 範例 |
| check-knowledge.sh 驗證腳本 | ⏸ 待做 | Session G 之後評估 |
| 08_owner_info.md 敏感資料保護 | ⚠️ 待評估 | 是否要從 git 移到 env 或加密 |

---

## 與其他檔案的交叉引用

| 引用本目錄 | 位置 |
|-----------|------|
| `~/.openclaw/agents/external-user/knowledge/main_idea.md`（prompt）| 多處章節引用（§十一菜單 → 01_product.md）|
| `SPEC.md` line 225 | 知識庫重構記錄 |

---

_本檔由 brtclaw 維護，Session F 2026-06-28 建立_
