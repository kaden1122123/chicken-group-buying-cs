# 雞肉客服 — 早期規劃文件（已歸檔）

> ⚠️ **本目錄為歷史歸檔文件，內容可能已過時。**
> **現況以 [`SPEC.md`](../../../SPEC.md) / [`PHASE1_PROGRESS.md`](../../../PHASE1_PROGRESS.md) / [`REVIEW_GUIDE.md`](../../../REVIEW_GUIDE.md) 為準。**

---

## 歸檔說明

- **建立時間**：2026-06-01 ~ 2026-06-11（專案啟動初期）
- **歸檔時間**：2026-06-15
- **歸檔決策**：見 [REVIEW_2026-06-15_FOLLOWUP_PLAN.md](../REVIEW_2026-06-15_FOLLOWUP_PLAN.md) line 89「將 01-08 移到 `docs/archive/planning-2026-06-12/`」
- **歸檔原因**：Phase 1 開發完成（2026-06-12 之後），早期規劃文件被實際實作文件取代
- **保留目的**：歷史參考，追蹤「當初為什麼這樣設計」

---

## 結構（8 個子目錄，18 個檔案）

| 子目錄 | 內容 | 用途 |
|--------|------|------|
| 01_專案概覽 | `PROJECT_STATE.md` | 2026-06-11 專案狀態快照 |
| 02_商業分析 | 商業模式、目標用戶畫像 | 商業層次分析 |
| 03_產品設計 | Human Handoff 流程、功能需求、對話流程 | 產品功能設計 |
| 04_技術架構 | Agent Prompt、設定檔、dmpolicy、KV 付款、LINE Webhook、知識庫、系統架構、訂單系統 | 技術實作設計 |
| 05_數據與資料 | 資料需求清單 | 資料模型 |
| 06_測試計畫 | 測試案例 | 測試策略 |
| 07_部署與維運 | 部署檢查清單 | 部署流程 |
| 08_風險管理 | 風險評估 | 風險管理 |

---

## 現況對應文件

本目錄檔案已被下列現況文件取代或整合：

| 早期規劃 | 現況文件 | 說明 |
|----------|----------|------|
| `01_專案概覽/PROJECT_STATE.md` | [`PHASE1_PROGRESS.md`](../../../PHASE1_PROGRESS.md) | Phase 1 進度追蹤 |
| `03_產品設計/功能需求清單.md` | [`SPEC.md`](../../../SPEC.md) | 規格文件（v1.1 規劃中）|
| `03_產品設計/對話流程設計.md` | [`docs/architecture/NEW_ORDER_FLOW.md`](../../architecture/NEW_ORDER_FLOW.md) | 新訂單流程（⚠️ Failed 6/16，見 NOTES/2026-06-16-issues.md）|
| `03_產品設計/Human_Handoff_流程設計.md` | [`docs/architecture/`](../../architecture/) | 架構文件 |
| `04_技術架構/*` | [`docs/architecture/`](../../architecture/) + `src/` | 實作於 src/ |
| `04_技術架構/知識庫設計.md` | [`docs/INDEX.md`](../../INDEX.md) + `src/knowledge/loader.js` | 知識庫 loader 與索引 |
| `06_測試計畫/測試案例.md` | [`REVIEW_GUIDE.md`](../../../REVIEW_GUIDE.md) | 18 套測試審查指南 |
| `07_部署與維運/部署檢查清單.md` | [`docs/architecture/`](../../architecture/) | 部署架構 |
| `08_風險管理/風險評估.md` | [`docs/TODO_2026-06-26.md`](../../TODO_2026-06-26.md) | 最新問題清單 |

---

## 閱讀建議

- **想了解現況**：直接看 `docs/INDEX.md` 與 `PHASE1_PROGRESS.md`
- **想回查歷史決策**：可以讀本目錄，但要注意內容可能已過時
- **想對照新舊設計**：用「現況對應文件」表交叉比對

---

_本檔由 brtclaw 維護，2026-06-27 Session C C4 變更新增_
