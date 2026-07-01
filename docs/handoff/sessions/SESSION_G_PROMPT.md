# Session G — CI/CD + ESLint + .nvmrc Prompt

> **業務問題（CEO 視角）**：沒有自動化測試（每次 push 要手動跑 `npm test`）、沒有 ESLint（程式碼風格靠記憶維持）、沒有 `.nvmrc`（不同人用不同 Node 版本可能踩雷）。
> **影響**：🟡 中（改壞了程式碼沒人第一時間發現，品質靠記憶維持）
> **推薦**：做（2-3 小時、中風險）
> **狀態**：✅ 已完成（2026-06-28 + 2026-07-01 G4 lint gate）
> **證據**：1 commit `475416d` (G4 lint gate) + pre-existing 2026-06-28 基礎建設
> **涵蓋改動**：G1~G4（npm test 套件、ESLint、CI、lint auto-fix）

---

## Prompt 區段

```
你是 brtclaw。雞味客服 Session G：CI/CD + ESLint + .nvmrc。

## 必讀文件
1. CEO 決策指南：docs/CEO_DECISION_GUIDE.md（看 Session G 段）
2. 修整計畫：docs/CLEANUP_PHASE_2_PLAN.md（§三 Session G）
3. 工程手冊：docs/ENGINEERING_HANDBOOK.md（§六 開發流程、§七 品質檢查）
4. MEMORY.md §I（SOP）

## Session G 任務（CEO 視角）

開始時問 CEO 決策：

「沒有自動化測試、ESLint、.nvmrc。
加 3 個東西（2-3 小時、中風險），做 / 不做？」

如果「做」，執行 3 個項目：

### G1：.nvmrc（無風險，1 分鐘）
- 內容：`22`（對應 Node 22.x，目前系統用 Node 22.22.2）
- 用途：統一開發環境 Node 版本，避免「在我電腦能跑」問題

### G2：ESLint（推薦 standard 風格）
- 為何用 standard：src/ 已完全合規 ESLint standard 風格（0 ==、0 var、100% use strict、single quotes）
- 安裝：
  ```bash
  npm install --save-dev \
    eslint \
    eslint-config-standard \
    eslint-plugin-standard \
    eslint-plugin-promise \
    eslint-plugin-import \
    eslint-plugin-node
  ```
- 建立 `.eslintrc.json`：
  ```json
  {
    "extends": "standard",
    "env": { "node": true, "es2022": true },
    "parserOptions": { "ecmaVersion": 2022, "sourceType": "script" }
  }
  ```
- 建立 `.eslintignore`：
  ```
  node_modules/
  .git/
  data/orders/
  knowledge/tenants/_csv_concurrency_test/
  tests/fixtures/
  dashboard.tmp.html
  ```
- `package.json` 加 `lint` script：
  ```json
  "lint": "eslint src/ tests/ scripts/"
  ```
- 預期：`npm run lint` 應該零錯誤（src/ 已 100% 合規）
- 若有違規：先告知 CEO 是哪些檔案，由 CEO 決定是否修正

### G3：GitHub Actions workflow
- 建立 `.github/workflows/test.yml`：
  ```yaml
  name: Test
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version-file: '.nvmrc'
            cache: 'npm'
        - run: npm ci
        - run: npm test
        - run: npm run lint
  ```
- 觸發：push 與 pull_request
- 內容：checkout + Node 22（從 .nvmrc 讀）+ cache npm + npm ci + npm test + npm run lint

## 必跑 SOP
- I-1：git add -A + status + stat + commit + show
- I-2：grep 引用點（確認 .eslintignore 沒漏、workflow 沒漏檔案）
- I-3：每方案含「會連帶改 X、Y、Z」

## 約束
1. G1、G2、G3 三個子任務可以分開 commit，也可以一個 commit（推薦一個 commit，因彼此關聯）
2. ESLint 設定後必須跑 `npm run lint` 確認零錯誤（src/ 已合規，應無錯誤）
3. GitHub Actions workflow 必須能被 github 觸發（需要 CEO 去 repo enable，但 workflow 本身可先建立）
4. `.gitignore` 不需改（已排除 node_modules 等）
5. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 CEO 看決策 → 等回覆
3. 建立 `.nvmrc`
4. 安裝 ESLint devDependencies
5. 建立 `.eslintrc.json` 與 `.eslintignore`
6. `package.json` 加 `lint` script
7. 跑 `npm run lint` 確認零錯誤
8. 跑 `npm test` 確認仍全綠（19 套）
9. 建立 `.github/workflows/test.yml`
10. 跑 `bash scripts/check-quality.sh` 確認全綠
11. 更新 PHASE1_PROGRESS.md（新增 CI/CD 段）
12. 更新 REVIEW_GUIDE.md（新增 lint 段）
13. 更新 ENGINEERING_HANDBOOK.md（§七 加 npm run lint 指令）
14. 1 個 commit（包含所有 G1+G2+G3 變更）
15. 統一 push + rsync
16. 通知 CEO 完成（含 GitHub Actions enable 提醒）

## 已知風險
- ESLint 套件下載時間：~30 秒
- GitHub Actions enable：CEO 需去 repo https://github.com/kaden1122123/chicken-group-buying-cs → Settings → Actions → enable
- ESLint 可能對 tests/fixtures/ 或 scripts/ 有 false positive → 用 .eslintignore 排除

## 真實訂單保護
絕對不能刪 `data/orders/chicken/2026-06-13.csv` 或 `2026-06-16.csv`。

開始吧。
```