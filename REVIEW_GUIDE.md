# 雞肉團購客服 — 實作審查指南

> 快速審查 Phase 1 實作品
> 更新時間：2026-06-12

---

## 審查清單（每項 5 分鐘內可確認）

### ✅ 1. 規則引擎（8個）

| 規則 | 檔案 | 測試覆蓋 |
|------|------|---------|
| 地址驗證（三峽/鶯歌） | `src/rules/addressRule.js` | 7/7 通過 |
| 電話驗證（09開頭10位） | `src/rules/phoneRule.js` | 8/8 通過 |
| 品項驗證 | `src/rules/menuRule.js` | — |
| 日期驗證 | `src/rules/dateRule.js` | — |
| 時段驗證 | `src/rules/timeSlotRule.js` | 11/11 通過 |
| 付款驗證 | `src/rules/paymentRule.js` | 8/8 通過 |
| 金額計算 | `src/rules/priceRule.js` | — |
| 規則總管 | `src/rules/index.js` | — |

**快速驗證：**
```bash
cd ~/openclaw-workspace/others/chicken-group-buying-customer-service
node tests/rules.test.js
```
預期：`34/34 通過`

---

### ✅ 2. Human Handoff 觸發（14 種條件）

**快速驗證：**
```bash
node tests/handoff.test.js
```
預期：`33/33 通過`

**14 種條件對照：**

| 等級 | 條件 | 觸發關鍵字範例 |
|------|------|--------------|
| L1 | 退款要求 | 「我要退款」、「退錢」、「退貨」 |
| L1 | 取消訂單 | 「不訂了」、「取消吧」 |
| L1 | 改天需求 | 「改到明天」、「换日期」 |
| L1 | 抱怨/客訴 | 「雞肉壞了」、「太慢」 |
| L1 | 態度激動 | 「叫你老闆來」 |
| L1 | 明確要求真人 | 「叫真人來」、「不要AI」 |
| L2 | 折扣請求 | 「便宜點」、「打個折」 |
| L2 | 配送範圍確認 | （地址驗證失敗時觸發） |
| L2 | 大批訂單 | 「公司訂購」、「大量採購」 |
| L2 | 金額異常（>$3000） | （金額計算時觸發） |
| L3 | 付款異常 | 「金額不符」、「轉錯」 |
| L3 | LINE Pay 失敗 | 「LINE Pay 失敗」、「付不了」 |
| L3 | 開團日期確認 | 「這週有開嗎」 |
| L3 | 截單後變更 | 「再追加」、「加一盒」 |

---

### ✅ 3. 狀態機（6 個狀態）

```
IDLE → AWAITING_INFO → CONFIRMING → AWAITING_PAYMENT → COMPLETED
                  ↓                      ↓
              REASK_INFO          HUMAN_HANDOFF
```

| 狀態 | 檔案 | 職責 |
|------|------|------|
| IDLE | `src/states/idle.js` | 偵測訂購意圖 |
| AWAITING_INFO | `src/states/awaitingInfo.js` | 收集7個欄位 + 驗證 |
| REASK_INFO | `src/states/reaskInfo.js` | 驗證失敗重問 |
| CONFIRMING | `src/states/confirming.js` | 展示摘要 + 確認 |
| AWAITING_PAYMENT | `src/states/awaitingPayment.js` | 等付款證明 |
| HUMAN_HANDOFF | `src/states/handoff.js` | 安全閘：寫CSV→回覆→通知 |
| COMPLETED | `src/states/completed.js` | 寫入CSV + 感謝 |

---

### ✅ 4. 訂單 CSV Schema

**欄位：** `order_id, order_date, customer_name, phone, address, community, items, quantities, total_amount, time_slot, payment_method, payment_status, order_status, customer_note, created_at, handoff_type, handoff_log`

**驗證方式：**
```bash
head -2 data/orders/orders_2026-06-12.csv
```

---

### ✅ 5. 安全機制

- 輸入消毒：`src/utils/sanitizer.js`
- 狀態單向前進：狀態機強制執行
- 禁止透露資訊：Hubert 電話、私人 LINE 等
- CSV injection 防護：quotes + newlines 消毒

---

## 審查不通過的處理方式

若發現問題，記錄在 `knowledge/learned/` 並回報：
- 問題描述
- 預期行為
- 實際行為
- 截圖或 log

---

## 全部通過後

1. ✅ 確認 `config.yaml` 已更新（完成）
2. ✅ 確認 `SPEC.md` 完整（完成）
3. 建立 GitHub Repo：`chicken-group-buying-cs`
4. Initial Commit
5. 設定 LINE Bot Token 環境變數
6. 對接真實 LINE Bot 測試