# Session X2 — SESSION prompt 狀態欄統一 + 接手友善化

> **業務問題（CEO 視角）**：完整系統掃描（2026-07-01）發現 11 個 SESSION prompt 檔沒「狀態」欄。接手者打開 prompt 看到「⏸ 待執行」就誤以為沒做過。
> **影響**：🟡 中（影響接手效率，但低風險快速收尾）
> **推薦**：做（30 分鐘、超低風險）
> **狀態**：⏸ 待執行
> **優先**：🟢 低（cosmetic，但便宜）

---

## 必讀文件
1. `docs/handoff/sessions/SESSION_E_PROMPT.md`（已加 ✅ 狀態欄的範例）
2. `docs/handoff/sessions/SESSION_N_PROMPT.md`（另一個範例）

## 待修補的 11 個檔（缺狀態欄）

```
SESSION_D3_PROMPT.md  → ✅ 已完成（2026-07-01）
SESSION_D4_PROMPT.md  → ✅ 已完成（2026-07-01）
SESSION_F_PROMPT.md   → ✅ 已完成（2026-07-01）
SESSION_G_PROMPT.md   → ✅ 已完成（2026-06-28 + 2026-07-01 G4 lint gate）
SESSION_H_PROMPT.md   → ⏸ 待執行 + 證據文件引用
SESSION_I_PROMPT.md   → ⏸ 待執行
SESSION_J_PROMPT.md   → ✅ 已完成（2026-06-29 改動 + 2026-07-01 regression test）
SESSION_K_PROMPT.md   → ⏸ 待執行
SESSION_L_PROMPT.md   → ⏸ 待執行
SESSION_M_PROMPT.md   → ✅ 已完成（K+M backup 已上線）
SESSION_Q_PROMPT.md   → ✅ 已完成（2026-07-01）
```

## Session X2 任務（CEO 視角）

開始時問 CEO 決策：

「11 個 SESSION prompt 沒狀態欄，順手補（30 min）。做 / 不做？」

如果「做」，執行 1 個 commit：

### X2：批次補 11 個 prompt 狀態欄

- 每個 prompt 檔上方加：
  ```
  > **狀態**：✅ 已完成（日期）→ 證據：[commit hash 或 docs 連結]
  > **狀態**：⏸ 待執行 → 觸發：何時該做
  ```
- 對齊 SESSION_E_PROMPT.md 的格式
- 一致性檢查：每個狀態必須對應 CEO_GUIDE.md 的標記（✅ / ⏸）

## 必跑 SOP
- I-1：1 個 commit（所有 11 個檔一起）
- I-2：grep 確認所有 SESSION_*_PROMPT.md 都有狀態欄
- I-3：每個變更檔的影響（文件性質，無 code 影響）

## 約束
1. 純文件變更
2. 不改 prompt 內容（只在 header 加狀態）
3. 真實訂單保護
4. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. 批次編輯 11 個檔（用 edit 或 write）
4. grep 驗證每個檔都有狀態
5. 1 個 commit
6. 統一 push + rsync
7. 通知 Hubert

## 預期效益
- 接手者打開 prompt 就知道狀態，不會誤以為未做
- 與 CEO_GUIDE.md 表格狀態對齊（single source of truth）
- 順手清理未來 X 編號新 prompt 的範本
