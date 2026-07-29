# ADR-0005: Session-based 變更流程 + 每 Task 一個 Commit

> **狀態**：Accepted
> **last_updated**：2026-07-29（Round 28 📐 補齊）
> **日期**：2026-06-27（Session C C2 事故後）
> **決策者**：Hubert
> **背景文件**：[MEMORY.md §I 結構性變更 SOP](../../../../.openclaw/workspace/MEMORY.md)（系統層檔案，不在本 repo 內）

---

## 背景（Context）

2026-06-27 Session C 發生 C2 事故：第一次 commit 只改了 1 個檔，漏了 7 個 src/config 改動。後續花 30 分鐘救火（amend 修正）。

這個事故的根因：
1. `git add <single-file>` 而非 `git add -A`
2. commit 前沒驗證 stat
3. 給 Hubert 的方案沒列副作用

Hubert 稱之為「**一環遞迴**」：A 環沒做好，B 環要救火，C 環又衍生新問題。

## 決策（Decision）

**採用 Session-based 變更流程**：
1. 每個 Task（不是 Session）一個 commit
2. 每個 Session 多個 Task，各自 commit
3. Session 結束時統一 push + rsync（不中途）
4. 每個 Task commit 前必跑 3 個 SOP（見下）

### 必跑的 3 個 SOP（MEMORY.md §I）

#### I-1. Commit 前 SOP

```bash
$ git add -A                          # 不是 git add 單檔
$ git status --short                  # 確認所有改動都 staged
$ git diff --cached --stat            # 確認 commit 範圍
$ git commit -m "..."                 # 提交
$ git show HEAD --stat                # 立即驗證 commit 包含預期檔案
```

#### I-2. 事實查核 SOP（每個結構性變更開始前）

1. **引用點 grep**（4 個面向）：
   - 代碼（`*.js`）
   - 文件（`*.md`）
   - 設定（`*.yaml`、`*.json`）
   - production prompt（`docs/production-prompt/*/main_idea.md`）
2. **dead code 與 active 引用分開列**
3. **副作用分析**（改一個常數會連帶影響哪些檔案？）
4. **給 Hubert 的方案必含「會連帶改 X、Y、Z」**

#### I-3. 方案描述 SOP（給 Hubert 確認前）

每個 C 決策給 Hubert 看時，方案必含：
1. **現況摘要**（具體數字）
2. **方案 A 推薦**（含副作用）
3. **方案 B 替代**（含副作用）
4. **推薦理由**（為何 A > B）
5. **改動範圍估計**

## 理由

- **避免 amend 救火**：每個 Task 獨立 commit，amend 不會帶入前一 Task 的問題
- **易於 revert**：單一 Task 出問題可精準 revert
- **清晰 audit**：`git log --stat` 看每個 Task 範圍
- **避免遞迴**：提早發現問題（commit 前 SOP）比救火便宜

## 後果（Consequences）

### 正面

- Session D D1 + D2 共 2 個 commit，每個範圍清楚
- Session C C2 修正後沒再發生類似事故
- `git log --stat` 是完整的 audit 工具

### 負面

- 流程變長（commit 數變多）
- brtclaw 必須嚴格遵守 3 個 SOP（不能跳過）

### 緩解

- MEMORY.md（系統層）把 3 個 SOP 整合成可操作步驟
- Session 啟動 prompt 強調「必跑 SOP」
- Session 結束時統一 push，commit 數多不影響

---

_本 ADR 是 Session-based 變更的基礎，防止「一環遞迴」重演_
