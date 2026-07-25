# bin/ CLI 工具集使用指南

> **建立**：2026-07-25（Round 26）
> **維護者**：brtclaw
> **last_updated**：2026-07-25
> **範圍**：`bin/` 內 6 個工具的用途、適用情境、限制

---

## 工具總覽

| 工具 | 用途 | 何時用 |
|------|------|--------|
| `bin/test-quick` | 跑 5 個關鍵 test 檔（< 10 秒）| 開發中快速驗證 |
| `bin/check-drift` | 檢查 3 層位置檔案一致性 | session 開頭 + commit 前 |
| `bin/sync-all` | 跑 3 個 sync 腳本 | 改完 config/canonical/mirror 任一後 |
| `bin/deploy-all` | 品質檢查 + commit + push + Worker deploy | 程式碼完成、要上 staging/prod |
| `bin/swap-line-bot` | 切換 LINE bot staging ↔ production | 換 bot token、staging→prod 升級 |
| `bin/cron-list` | 列出所有雞味客服 cron | 排查 cron 問題、查定期任務 |

---

## 各工具詳細說明

### 1. `bin/test-quick` — 快速 subset 測試

**設計**（Round 25）：只跑 5 個關鍵 test，跳過大型 integration。

**5 個跑的**：
1. `tests/triggers.test.js`（KB 觸發）
2. `tests/config.test.js`（config 介面）
3. `tests/customer-tags.test.js`（客戶標籤 — 跳過若不存在）
4. `tests/address.test.js` + `tests/whitelist.test.js`（地址 + 白名單）
5. `tests/pending.test.js` + `tests/verify-kb-sources.js`（pending + KB 來源 — 跳過若不存在）

**使用**：
```bash
bash bin/test-quick           # 快速 subset（< 10 秒）
bash bin/test-quick --full    # 跑全部（等同 npm test）
```

**何時用**：
- 改完 KB / config / customer tags 後快速驗證
- 不想跑全部 51 個 test 檔時
- 開發 loop 中每 5-10 分鐘跑一次

---

### 2. `bin/check-drift` — 3 層位置漂移檢查

**設計**（Round 24）：檢查 3 個位置（dev repo / main mirror / prod runtime）的關鍵檔案是否一致。

**檢查 3 個面向**：
1. dev repo ↔ main mirror（rsync consistency）
2. dev repo `docs/production-prompt/` ↔ prod runtime（canonical files）
3. `config.yaml` ↔ `config/tenants/chicken.yaml` drift

**使用**：
```bash
bash bin/check-drift
```

**何時用**：
- session 開頭第一件事（檢查當前環境是否乾淨）
- 改完 config 或 prompt 後（驗證 drift）
- 推 PR 前最後確認

---

### 3. `bin/sync-all` — 3 個 sync 一次跑

**設計**（Round 25）：一次跑 `sync-canonical` + `sync-config` + `sync-mirror`。

**使用**：
```bash
bash bin/sync-all                  # 跑全部 3 個
bash bin/sync-all --only=canonical # 只 sync canonical files
bash bin/sync-all --only=config    # 只 sync config.yaml
bash bin/sync-all --only=mirror    # 只 sync main mirror
```

**何時用**：
- 改完 canonical 檔（AGENTS.md / SOUL.md / main_idea.md）→ `--only=canonical`
- 改完 chicken.yaml（tenant config）→ `--only=config`
- 改完程式碼（src/、scripts/、tests/）→ `--only=mirror`
- 不確定就跑全部

---

### 4. `bin/deploy-all` — 一鍵 deploy

**設計**（Round 25）：品質檢查 + commit + push + sync + Worker deploy。

**流程**：
1. 跑 `check-quality`（11 項檢查）
2. 跑 `test-quick`（5 個關鍵 test）
3. `git add -A` + `git commit` + `git push`
4. 跑 `sync-mirror.sh from-legacy`（同步主位置）
5. Worker staging deploy
6. Worker prod deploy（**僅 `--prod` 模式**）

**使用**：
```bash
bash bin/deploy-all              # 預設 staging（不 deploy prod）
bash bin/deploy-all --prod       # 含 prod deploy（會互動確認）
bash bin/deploy-all --skip-test  # 跳過測試（緊急 hotfix）
```

**何時用**：
- 程式碼完成、要推到 staging 測試
- 確認沒問題後用 `--prod` 上 production

**限制**：
- 必須先設定 `~/.config/chicken/secrets/google-service-account.json`（P9 同步需要）
- 必須先登入 `gh` CLI（push 需要）
- prod deploy 會互動確認，但仍要小心

---

### 5. `bin/swap-line-bot` — 切換 LINE bot

**設計**（Round 24）：一行切換 staging ↔ production LINE bot。

**使用**：
```bash
bash bin/swap-line-bot staging    # 換 staging bot
bash bin/swap-line-bot production # 換 production bot
```

**流程**（staging）：
1. 建 staging KV namespace（首次）
2. 設定 staging secrets（LINE_BOT_TOKEN、CHANNEL_SECRET）
3. Deploy staging Worker

**何時用**：
- 新建 staging 環境（首次）
- 換 LINE bot token
- staging → production 升級

**限制**：
- 首次跑 staging 需手動填 token（用 placeholder `YOUR_STAGING_LINE_BOT_TOKEN`）
- 需先 `cd /home/clawuser/openclaw-workspace/external-user/cloudflare-worker`

---

### 6. `bin/cron-list` — 列出雞味客服 cron

**設計**（Round 24）：列出所有 OpenClaw crons + system crontab 中雞味相關項目。

**使用**：
```bash
bash bin/cron-list
```

**顯示**：
- OpenClaw crons（雞味客服、backup、cleanup、sheets、keyage、cloudflared）
- Linux system crontab（chicken 相關）

**何時用**：
- 排查 cron 沒跑的問題
- 查定期任務清單（取代 `openclaw cron list` 全文）
- 確認新加的 cron 是否生效

---

## 工具間的協作流程

**典型 session 流程**：
```bash
# 1. 開頭：檢查環境
bash bin/check-drift

# 2. 開發中：快速驗證
bash bin/test-quick

# 3. 完成：sync
bash bin/sync-all

# 4. 部署
bash bin/deploy-all              # 先 staging
bash bin/deploy-all --prod       # 確認後 prod
```

**新增 cron 後**：
```bash
bash bin/cron-list  # 確認新 cron 生效
```

---

## 設計原則

1. **薄封裝** — `bin/*` 都是薄殼，主要邏輯在 `scripts/*` 或 `src/*`
2. **互動確認** — 破壞性操作（deploy prod、swap prod）會互動確認
3. **獨立可跑** — 每個工具可單獨跑，沒有順序依賴
4. **可跳過** — `--skip-test`、`--only=xxx` 讓緊急情況可跳過部分

---

_本檔由 brtclaw 維護，Round 26 2026-07-25 建立_
