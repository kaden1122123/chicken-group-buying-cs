# Session 結束 SOP（觸發式自動文件收尾）

> **作者**：brtclaw（2026-07-19 08:23 session）
> **觸發**：Hubert 指示建立觸發關鍵字機制，AI 自動執行 Session 結束 SOP
> **目的**：每次 session 結束前（無論主動結束或預期下次繼續），確保系統狀態文件與實際系統對齊，後續 session 開局時能無 drift 跟上

---

## 🎯 為何需要此 SOP

- **避免 drift**：每個 session 做了什麼、目前系統狀態，必須在 `CHANGELOG.md` + `HANDOFF.md` + `SESSION_NEXT_PROMPT.md` 反映
- **避免「回來不知道做了什麼」**：Hubert 經常跨 session 工作（凌晨到深夜），文件是唯一銜接點
- **避免 token 浪費**：後續 session 開局時不需要重新探索 codebase

---

## 🔑 觸發關鍵字清單

### 自動觸發（AI 監聽）

當 user 訊息包含以下任一關鍵字時，AI 應自動執行 Session 結束 SOP（不需要確認）：

```
中文：  新 session / 新分頁 / 下次 / 下次見 / 明天見 / 晚點 / 待會 / 之後 /
        關掉 / 結束 / close / end / goodbye / bye /
        Session 結束 / 文件收尾 / drift 修整

英文：  new session / next time / see you / goodbye / bye / close / end /
        session end / doc cleanup / drift fix
```

### 手動觸發（Hubert 直接說）

- 「跑 Session 結束 SOP」
- 「更新狀態文件」
- 「session close」

---

## 📋 Session 結束 SOP（5 分鐘）

執行以下 7 個步驟：

### 步驟 1：跑品質檢查（30 秒）

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
bash scripts/check-quality.sh
```

預期：**11 通過 / 0 失敗**（warning 可接受，但要記錄處理計畫）

### 步驟 2：更新 `CHANGELOG.md`（30 秒）

新增「### Round N（日期 + 觸發情境）」段，記錄：
- 本次 session 做了什麼（commits / features / fixes）
- 觸發關鍵字（如「新 session」、「文件收尾」）
- 重要決策或發現

### 步驟 3：更新 `HANDOFF.md`（30 秒）

- 修改「最後更新」日期
- 更新 §1「當前 Production 狀態」表格
- 更新 §5「待修整清單」（移除已完成 + 加新發現）

### 步驟 4：更新 `docs/PROJECT_INVENTORY.md`（30 秒）

- 更新「最後更新」日期
- 更新 §8「目前進度」表（如有新 P / 階段完成）
- 更新 §9「待修整清單」

### 步驟 5：更新 `docs/handoff/sessions/SESSION_NEXT_PROMPT.md`（1 分鐘）

- 更新「當前狀態」表（Round N 觸發 + 完成事項）
- 加新發現到「待辦事項」段
- 若有重要架構變更，更新「服務重啟 SOP」段

### 步驟 6：git add + commit + push（1 分鐘）

按 MEMORY.md §I-1 SOP：

```bash
git add -A
git status --short              # 確認所有改動都 staged
git diff --cached --stat         # 確認 commit 範圍
git commit -m "docs(session-close): ..."
git show HEAD --stat             # 立即驗證 commit 包含預期檔案
git push
```

### 步驟 7：同步 main 鏡像（30 秒）

```bash
bash scripts/sync-mirror.sh from-legacy
```

驗證：`~/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` 與 dev repo 同步。

---

## ⚠️ 注意事項

1. **不可跳過步驟**：每個步驟都有其目的（check-quality 防測試壞掉、commit 防檔案掉、sync 防 main mirror drift）
2. **commit 必須驗證**：git show HEAD --stat 後看到所有檔案才安全（避免 C2 漏改事故）
3. **不要混搭其他工作**：Session 結束 SOP 完成後再開新工作，避免 commit 混雜
4. **如果 check-quality 失敗**：先修測試/程式碼，再跑 Session 結束 SOP（不要 commit 壞掉的程式碼）

---

## 🎯 給未來 session 的提醒

當你（未來 AI agent）接手這個專案時：

1. **第一件事**：跑 5 步環境驗證（CWD + check-quality + npm test + /healthz + secrets 檔案）
2. **如果 user 訊息包含觸發關鍵字**：直接執行 Session 結束 SOP（不需要問 user）
3. **如果 user 訊息沒包含觸發關鍵字**：照常工作，不需要主動執行
4. **如果發現 drift**：立即執行 Session 結束 SOP 修正（drift 是高優先度）

---

## 📝 變更歷史

| 日期 | 變更 | 觸發 |
|------|------|------|
| 2026-07-19 08:23 | 初始建立 | Hubert 08:23 指示 |

---

_本檔由 brtclaw 維護，每次 SOP 變更時更新_
