# Session G — CI/CD + ESLint + .nvmrc

> **建立時間**：2026-06-28 19:50 (Asia/Taipei)
> **完成時間**：2026-06-28（兩個 commit：`ef54879` + `df8e7a9`）
> **維護者**：brtclaw
> **觸發**：Hubert 2026-06-28 19:48 開 Session G（CEO_GUIDE.md §G）
> **狀態**：✅ 已完成（2026-06-28 ef54879 + df8e7a9）
> **後續修整**：2026-06-29 11:00 lint 警告 64 → 0（clean state）

---

## 為何做 Session G

**業務問題**（CEO 視角）：
- 沒有自動化測試：每次 push 要手動跑 `npm test`（19 套）
- 沒有 ESLint：程式碼風格靠記憶維持
- 沒有 `.nvmrc`：不同人用不同 Node 版本可能踩雷

**影響**：
- 改壞了程式碼沒人第一時間發現
- 程式碼品質不一致（新人接手無規範）

---

## 範圍與產出

| # | 子任務 | 預估時間 | 風險 |
|---|--------|----------|------|
| G1 | `.nvmrc`（固定 Node 22） | 1 分鐘 | 無 |
| G2 | ESLint 設定 + `npm run lint` script | 30 分鐘 | 中 |
| G3 | GitHub Actions workflow（`.github/workflows/test.yml`）| 30 分鐘 | 低 |

---

## 事實查核（重要修正）

**初次誤判**：我原本以為 src/ 有 105 個 `==` 違規（會與 ESLint standard 風格衝突）。
**修正後真實情況**（2026-06-28 19:51 Python 精準統計）：

| 指標 | 數量 | 結論 |
|------|------|------|
| `===` 使用次數 | 93 | ✅ 完全用 `===` |
| 真實 `==` 使用次數 | **0** | ✅ 零違規 |
| `var` 使用次數 | **0** | ✅ 全部 `const`/`let` |
| `'use strict'` 覆蓋率 | 31/31 (100%) | ✅ 全部檔案 |
| single quotes | 100% | ✅ standard 風格 |
| `console.error` 數量 | 11 | ⚠️ src/ 允許（設計驗證用途） |

**結論**：src/ 已完全合規 ESLint standard 風格，**裝上去 0 修改**！這是好消息。

---

## 3 個子決策方案

### G1: .nvmrc（無決策，直接做）

**內容**：`22`（對應 Node 22.22.2）

### G2: ESLint 配置（推薦 A）

| 方案 | 描述 | 優 | 劣 |
|------|------|----|----|
| **A（推薦）** | `eslint-config-standard` | 業界共識、零修改 src/、含 `===` 強制 | npm install 多 1 個依賴 |
| B | custom relaxed（只檢查 var/eval） | 簡單 | linting 效益低、與業界脫節 |
| C | standard + smart eqeqeq | 與 A 幾乎相同 | 這個 codebase 沒 == null/undefined 問題，A 已涵蓋 |

**推薦 A 理由**：src/ 風格已 100% 合規，套 standard preset 零修改，立即有完整 linting。

### G3: GitHub Actions（推薦 A）

| 方案 | 描述 | 優 | 劣 |
|------|------|----|----|
| **A（推薦）** | 跑 `npm test` + `npm run lint`，Node 22 | 完整 CI | workflow 較長 |
| B | 只跑 `npm test` | 簡單 | 不抓 lint 違規 |
| C | A + cache（`actions/setup-node@v4`）| 更快 | workflow 複雜 |

**推薦 A 理由**：完整、簡單、可讀，符合 CEO_GUIDE.md 描述「每次 push 自動跑 npm test」。

---

## 待決策（請 Hubert 確認）

- G2：走方案 A（standard）還是 B（custom relaxed）？
- G3：走方案 A（test + lint）還是 B（只 test）？

**brtclaw 推薦**：G2=A、G3=A（理由：完整、最符合專案需求）

---

## 完成後產出

- [ ] `.nvmrc`（1 行）
- [ ] `.eslintrc.json`（standard preset）
- [ ] `.eslintignore`（排除 node_modules 等）
- [ ] `.github/workflows/test.yml`（Node 22 + npm ci + npm test + npm run lint）
- [ ] `package.json` 加 `lint` script
- [ ] `npm install eslint eslint-config-standard eslint-plugin-standard eslint-plugin-promise eslint-plugin-import eslint-plugin-node --save-dev`
- [ ] `npm test` 與 `npm run lint` 都全綠
- [ ] `scripts/check-quality.sh` 仍全綠
- [ ] 真實訂單 2026-06-13.csv + 2026-06-16.csv 保護 ✅
- [ ] 1 個 commit
- [ ] Push GitHub
- [ ] rsync 主位置
- [ ] 更新 PHASE1_PROGRESS.md / REVIEW_GUIDE.md / ENGINEERING_HANDBOOK.md

---

## 相關檔案

- `docs/CEO_DECISION_GUIDE.md` §G — 業務問題與影響
- `docs/ENGINEERING_HANDBOOK.md` §七 — 品質檢查現況
- `package.json` — 加 lint script 與 devDependencies
- `.gitignore` — 不需改（已排除 node_modules 等）

---

_本檔由 brtclaw 維護，Session G 已於 2026-06-28 完成。檔案內容為當時計畫紀錄，保留供 audit。_

## 完成摘要

Session G 範圍已全部完成並 commit：
- ✅ G1：`.nvmrc` = `22`（Node 22 版本鎖定）
- ✅ G2：ESLint + `.eslintrc.json`（src/ 100% 合規，套上零修改）
- ✅ G3：`.github/workflows/test.yml`（push + PR 觸發，Node 22 + cache npm + lint + test）

**為何檔頭誤寫「⏳ 等待決策」**：建立 goal.md 時 G 還沒做完，但實際 G 在 2026-06-28 已經完成 commit（ef54879 + df8e7a9）。本檔於 2026-06-29 更新狀態為 ✅。

**2026-06-29 補充修整**：H session 改的 6 個 helper 測試沒跑 `lint:fix`，累積 64 warnings。今日清理完成（0 errors, 0 warnings），`npm test` 3 次連跑全綠。