# 每日總結 — 2026-06-12

> 雞肉團購 AI 客服 Phase 1 開發日誌

---

## 今日完成項目

### 1. Phase 1 核心功能實作（✅ 完成）

**32 個 JS 檔案，完整覆蓋以下模組：**

| 模組 | 檔案數 | 說明 |
|------|--------|------|
| 狀態機 | 7 個 | IDLE→AWAITING_INFO→CONFIRMING→AWAITING_PAYMENT→COMPLETED/HUMAN_HANDOFF |
| 規則引擎 | 8 個 | 地址/電話/品項/日期/時段/付款/金額/總管 |
| 訂單系統 | 4 個 | CSV讀寫/格式化/ID生成 |
| Human Handoff | 3 個 | 14種觸發條件/LINE通知/格式 |
| 知識庫 | 2 個 | 統一載入/觸發對照表 |
| 工具 | 3 個 | 消毒/時間/LINE格式 |
| 主入口 | 1 個 | index.js 整合所有模組 |
| 測試 | 3 個 | 規則34/34✅、Handoff 33/33✅、安全測試✅ |

---

## 決策記錄

### 決策 1：HUBERT_LINE_BOT_TOKEN 簡化

**問題：** 一開始規劃兩個 LINE Bot Token（客服 Bot + Hubert 通知 Bot），但實際上 Hubert 說「我的LINE BOT」就是同一隻客服 Bot。

**結論：** 刪除 `HUBERT_LINE_BOT_TOKEN`，統一使用 `LINE_BOT_TOKEN`。
- 接收客戶訊息 → 使用 `LINE_BOT_TOKEN`
- 通知 Hubert → 也使用同一個 `LINE_BOT_TOKEN`（Push API）

**受影響檔案：**
- `.env` — 移除 `HUBERT_LINE_BOT_TOKEN`
- `.env.example` — 同步移除
- `config.yaml` — 移除 `HUBERT_LINE_BOT_TOKEN` 設定

---

### 決策 2：Human Handoff 觸發條件（14種）

**設計原則：** 語意相近就觸發（Semantic Matching）

| 等級 | 條件數 | 說明 |
|------|--------|------|
| L1 | 6 種 | 立即通知（退款/取消/改天/客訴/爭議/要求真人） |
| L2 | 4 種 | 通知並附摘要（折扣/配送確認/大批/金額異常） |
| L3 | 4 種 | 通知（付款異常/LINE Pay失敗/開團日期/截單後變更） |

**實作方式：**
- 關鍵字表 + 正規表達式（99% 案例）
- 模糊匹配 fallback（1% 案例）
- 未來可升級 MiniMax API 語意分類

---

### 決策 3：CSV 作為 Phase 1 儲存方案

**原因：** 快速建立原型、測試電路、避免 Google Sheets 設定的複雜性

**缺點：** 手動管理、無法多人協作
**Phase 2 解決：** 升級 Google Sheets

---

## Phase 架構總覽

| Phase | 內容 | 系統健全度 | 狀態 |
|-------|------|-----------|------|
| Phase 1 | 核心功能 + CSV | 80% | ✅ 完成 |
| Phase 2 | Google Sheets 取代 CSV | 90% | 📋 下一個目標 |
| Phase 3 | 分析報表/多店支援/庫存 | 95% | 📋 未來 |
| Phase 4+ | 自動化行事曆/更多支付 | 100% | 📋 願景 |

---

## 檔案變更記錄

### 新增
- `REVIEW_GUIDE.md` — 簡易審查指南（5 分鐘內可確認每個模組）
- `.gitignore` — 隔離 `.env`、CSV、logs
- `.env.example` — 環境變數範本
- `PHASE1_PROGRESS.md` — Phase 1 進度報告

### 更新
- `config.yaml` — 完整重寫（14種觸發條件、付款規則、配送規則、收單時間）
- `SPEC.md` — 完整規格文件
- `.env` — 填入真實 LINE Bot Token（Hubert 填寫）

### Git Hub
- Repo 建立：`https://github.com/kaden1122123/chicken-group-buying-cs`
- Initial Commit：`66487f0`（84 檔案，10635 行）
- Second Commit：`bf0cbd5`（.gitignore + .env.example）

---

## 測試結果

```bash
$ node tests/rules.test.js
=== 總結：34/34 通過 ===
✅ 所有規則測試通過！

$ node tests/handoff.test.js
=== 結果：33/33 通過 ===
✅ 所有 Human Handoff 觸發測試通過！
```

---

## 待辨事項

| 項目 | 負責人 | 優先級 |
|------|--------|--------|
| Phase 2：Google Sheets 整合 | brtclaw/Hermes | 高 |
| 對接真實 LINE Bot Webhook | Hubert | 高 |
| 設定開團日期動態讀取 | brtclaw/Hermes | 中 |

---

## 技術債（Phase 1 標記）

1. `transferRules.js` 的「改一下时间」pattern 需要簡體中文協助（已修復）
2. `addressRule.js` 對「三峽北大特區」關鍵字依賴較重，未來可改為 geocode 判定
3. CSV 訂單無備份機制（Phase 2 改為 Sheets 後解決）

---

## 學到的教訓

1. **測試先行**：規格外發現問題，節省重構成本
2. **環境變數不寫死**：`.gitignore` + `.env.example` 是基本防護
3. **不要過度設計**：一開始不確定是否需要兩隻 LINE Bot，結果 Hubert 說同一隻就夠了

---

_最後更新：2026-06-12 13:36_
_更新者：brtclaw