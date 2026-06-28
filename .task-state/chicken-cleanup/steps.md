# Session E Steps — 6/16 訂單流程方向決策

> **建立時間**：2026-06-28 18:57
> **完成時間**：2026-06-28 19:03
> **狀態**：✅ 完成

## 進行中

- [x] 讀必讀文件（CEO_DECISION_GUIDE、6/16 issues、NEW_ORDER_FLOW、CLEANUP_PHASE_2_PLAN、§I SOP）
  - ✅ 2026-06-28 18:57 完成
- [x] 給 Hubert 看 CEO 視角決策（問 1 + 問 2）→ 等回覆
  - ✅ 2026-06-28 19:00 收到回覆：D 純 postback + systemd
- [x] 決策後落實文件：
  - [x] E1：重寫 `docs/architecture/NEW_ORDER_FLOW.md` v2（純 postback + systemd 設定）
  - [x] E2：更新 `docs/NOTES/2026-06-16-issues.md` 標記決策完成
  - [x] E3：更新 `docs/CLEANUP_PHASE_2_PLAN.md` 標記 Session E 完成
  - [x] 順手更新 `docs/KNOWN_ISSUES.md`（active known issues）
- [x] 跑 `bash scripts/check-quality.sh`（Session E 範圍 clean，剩餘失敗為 D3/D4 工作）
- [x] 統一 push + rsync
  - ✅ Commit 16f96b9 pushed
  - ✅ rsync from-legacy 完成
- [x] 通知 Hubert（含決策摘要 + 後續實作 Session 建議）

## Commit 紀錄

| Commit | 說明 |
|--------|------|
| `16f96b9` | docs(architecture): Session E - 6/16 訂單流程方向決策（D 純 postback + systemd）|

## 變更檔案（6 個）

| 檔案 | 變更 |
|------|------|
| `.task-state/chicken-cleanup/goal.md` | 新增 |
| `.task-state/chicken-cleanup/steps.md` | 新增 |
| `docs/architecture/NEW_ORDER_FLOW.md` | v1 → v2（純 postback + systemd）|
| `docs/NOTES/2026-06-16-issues.md` | 標記決策完成 |
| `docs/CLEANUP_PHASE_2_PLAN.md` | A1/A3/G1/G3 + Session E 標記完成 |
| `docs/KNOWN_ISSUES.md` | 6/16 訂單流程方向未定 → 已決策 |

## 後續建議

**Session N — v2 流程實作（9 小時）**：
- N1: Worker postback 偵測邏輯
- N2: Worker 對話 context 訂單資料取出
- N3: api-server.js 連線驗證
- N4: 雞肉 prompt 更新（main_idea.md + SOUL.md）
- N5: 刪除 v1 監聽式遺留（order-listener.js）
- N6: end-to-end 整合測試
- N7: systemd service 設定（需 Hubert sudo）
- N8: 實測（Hubert 用真實 LINE 帳號）

**執行順序**：Session N 必須先於 F~M（否則 production 訂單流程仍卡住）。