# 雞味客服 — New Session 精簡手冊（v1 draft）

> **目的**：接手 brtclaw session 的 5 分鐘入口。**比 NEW_SESSION_README.md 更精簡**（<200 行），給已熟悉雞味客服、只需快速對齊狀態的 session。
> **正式版**：以 `NEW_SESSION_README.md` 為主（10 分鐘版，含詳細 ID + Round history）。本檔為補充。

---

## §1 環境驗證（5 步，30 秒）

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service

git status --short              # 1. 應為空
git log --oneline -3            # 2. 看最近 commit
bash scripts/check-quality.sh   # 3. 預期 12 pass / 0-2 warn / 0 fail
npm test --silent 2>&1 | tail -5 # 4. 預期 67 套全綠
bash bin/check-drift            # 5. 預期 3 層位置無 drift
```

若步驟 1 不為空 → 看一下是不是測試 CSV 殘留（先 `node scripts/cleanup-test-orders.js`）。

## §2 3 層位置架構

```
L1: openclaw-workspace/others/chicken-group-buying-customer-service/  ← 編輯 + git
L2: ~/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/  ← services 跑
L3: ~/.openclaw/agents/external-user/  ← LLM 真正讀（AGENTS.md / SOUL.md / main_idea.md）
```

**鐵律**：永遠在 L1 編輯，sync 自動推到 L2、L3。改 L2/L3 不會回到 L1。

`node_modules/` 在 L2 是 symlink → L1。`.env` 只在 L2（有 secrets）。`.git` 只在 L1。

## §3 5 必讀檔案

| 檔案 | 用途 |
|------|------|
| `NEW_SESSION_README.md` | 完整 10 分鐘版（含詳細 ID、Round history） |
| `docs/OPERATIONS.md` | LINE bot + staging + secrets SOP |
| `docs/DEVELOPMENT.md` | 測試 + 開發 + Troubleshooting |
| `docs/INDEX.md` | auto-generated 文件總覽 |
| `docs/KNOWN_ISSUES.md` | 未關問題（U1-U4） |

## §4 已知陷阱（必看）

| ID | 問題 | 處理 |
|----|------|------|
| U1 | 客戶「客服邏輯錯亂」 | Round 33 sanitizeReplyText 只防 outbound，污染源可能在 OpenClaw pipeline / LLM context |
| U2 | `Exec failed` 原始來源 | 全 src/ grep 找不到，推測在 OpenClaw pipeline |
| U3 | LLM 沒動態讀 chicken.yaml | 目前靠 prompt 引導（`docs/production-prompt/2026-07-03/main_idea.md`） |
| U4 | main_idea.md drift | check-quality Check 11 警告，cron `sync-canonical.sh` 每分鐘跑 |

**Race condition**：`data/orders/chicken/YYYY-MM-DD.csv` 在 L1/L2 可能 lag 1 小時內（rsync 每小時）。測試 row 殘留用 `cleanup-test-orders.js`。

## §5 服務入口速查

| 任務 | 進入點 |
|------|--------|
| 修改 LINE 回覆邏輯 | `src/utils/lineReply.js` + `src/states/*.js` |
| 修改訂單流程 | `src/order/orderFormatter.js` + `src/order/csvWriter.js` |
| 修改規則（地址/日期/付款） | `src/rules/*.js`（addressRule、dateRule、paymentRule...） |
| 修改轉人工判斷 | `src/handoff/transferRules.js` + `src/states/handoff.js` |
| 修改 Gmail/Sheets 通知 | `src/handoff/emailNotifier.js` + `src/storage/sheetsSync.js` |
| 修改 Dashboard 後台 | `scripts/dashboard-server.js` |
| 修改 Cloudflare Worker | `~/openclaw-workspace/external-user/cloudflare-worker/`（**獨立 repo**） |
| 修改 Knowledge Base | `knowledge/tenants/chicken/01_product.md` ~ `12_reply_examples.md` |

## §6 部署與同步指令

```bash
# 部署（staging → prod）
bash bin/deploy-all              # staging only
bash bin/deploy-all --prod       # 含 prod deploy

# 同步 L1 → L2
bash scripts/sync-mirror.sh from-legacy
bash scripts/sync-config.sh

# 同步 L1 → L3（runtime prompt）
bash scripts/sync-canonical.sh

# 緊急：清理測試 row
node scripts/cleanup-test-orders.js

# 看 cron 狀態
bash bin/cron-list
```

## §7 外部服務 ID 速查

| 服務 | 識別碼 |
|------|--------|
| Worker prod URL | `https://external-user-line-security.kaden1122123.workers.dev` |
| Worker staging URL | `https://external-user-line-security-staging.kaden1122123.workers.dev` |
| Dashboard URL | `https://dashboard.brt1122.com` |
| 老闆 LINE ID | `Uf56650056d35626deb64165926a26182` |
| 客戶 ID | `U13921951a8873b3e84412a9c14a22c9a` |
| GitHub 主倉庫 | `kaden1122123/chicken-group-buying-cs` |
| GitHub Worker | `kaden1122123/external-user-line-security` |

## §8 Session 結束必跑（5 動作）

```bash
# 1. 主位置 cleanup（測試 row）
node scripts/cleanup-test-orders.js

# 2. 原位置 cleanup（如果 npm test 跑過）
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
node scripts/cleanup-test-orders.js

# 3. 驗證主位置乾淨
ls data/orders/chicken/          # 只剩 6/13 + 6/16 + 真實訂單
ls config/tenants/               # 只剩 chicken.yaml
ls knowledge/tenants/            # 只剩 chicken/

# 4. rsync from-legacy
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
bash scripts/sync-mirror.sh from-legacy

# 5. 跑 health check + commit
npm test --silent
git status --short && git add -A && git commit -m "..."
```

## §9 不要做的事 🚫

- 改 `.env`（Hubert 永久邊界）
- 在 L2/L3 直接編輯（不會 sync 回 L1）
- 改 `data/orders/chicken/2026-06-13.csv`、`2026-06-16.csv`（PROTECTED）
- commit 前忘 `git add -A`（C2 事故教訓）
- 改 code 但不更新 `docs/`（drift 會誤導未來 session）

## §10 文件同步鐵律（2026-08-03 Round 36 新增）

> **未來任何程式碼或工作流改動，必須同步更新 `docs/` 與 Handbook 才能 Commit。**

### 10.1 觸發條件（必須同步更新的情境）

| 改動類型 | 必更新的文件 |
|---------|-------------|
| 新增 / 修改 `src/` 規則邏輯 | `knowledge/tenants/chicken/*.md`（對應章節）+ `docs/INDEX.md` |
| 新增 / 修改 `scripts/` 工具 | `README.md` 工具列表 + 該工具的 docstring |
| 修改外部服務整合（Gmail / Sheets / Worker / Dashboard） | `docs/GMAIL_SHEETS_WORKFLOW.md` 或對應 workflow 文件 |
| 修改 KB 內容（價格 / 截止時間 / 規則） | `knowledge/tenants/chicken/*.md` + `docs/PROJECT_INVENTORY.md` |
| 修改部署 / cron / sync 流程 | `docs/OPERATIONS.md` + 本檔 §6 部署指令 |
| 修改 3 層位置規則 | `docs/handoff/ARCHITECTURE_CURRENT_STATE_*.md` + 本檔 §2 |
| Round handoff 完成 | `docs/handoff/rounds/ROUND_X_YYYY-MM-DD.md` + `CHANGELOG.md` |

### 10.2 Commit 前 Checklist（必跑）

```bash
# 1. 確認 docs/ 與 code 同步
diff <(grep -E "function|const" src/path/changed.js) <(grep -E "function|const" docs/path/changed.md)

# 2. 確認沒 stale 引用
grep -rn "TODO\|待執行\|未完成" docs/ 2>/dev/null | head -5

# 3. 跑文檔完整性檢查
bash scripts/check-md-links.js   # 確認沒有 broken links

# 4. 更新 INDEX.md（如有新增 / 刪除檔案）
bash scripts/generate-docs-index.sh

# 5. 更新 CHANGELOG.md（commit message 也要寫）
```

### 10.3 違反後果

- **commit 會被 reject**（若啟用 husky/lint-staged hook）
- **未來 session 會誤讀**（文件 vs 程式碼 drift）
- **Hubert 會在 review 抓出**（已發生多次）

### 10.4 健康檢查新鐵律（2026-08-03）

> **禁止將 dryRun 標示為 100% 健康**。唯有真實發出 API 封包並驗證 Log 才算 Live Pass，否則必須標註為「僅 Dry-Run 驗證」。

詳見 `docs/GMAIL_SHEETS_WORKFLOW.md` §1。

## §11 求助順序

1. `docs/INDEX.md` → 文件總覽
2. `docs/handoff/rounds/ROUND_X_YYYY-MM-DD.md` → 對應 round 的 handoff
3. `docs/handoff/sessions/SESSION_NEXT_PROMPT.md`（雖 LEGACY 標頭但仍可查）
4. `git log --oneline --all | head -30` → commit 歷史
5. `docs/KNOWN_ISSUES.md` → 已記錄的問題
6. **最後**：才問 Hubert

---

_本檔由 SYSTEM_MASTER_AUDIT.md Phase 1 產出（2026-08-03）_
_目標：取代舊的多份 handoff，提供新 session 一個 <200 行的單一精簡入口_
_若發現內容已過時，請同步更新 NEW_SESSION_README.md（本檔為精簡版，README 為完整版）_