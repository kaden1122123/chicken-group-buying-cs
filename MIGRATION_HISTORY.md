# 雞肉團購客服專案 — 雙位置架構說明

> **本文件角色**：說明本專案為何有「原位置 + 主位置」雙鏡像、兩者如何分工、如何同步。
> **維護者**：brtclaw
> **最後更新**：2026-06-27（Session C C1 變更：明確化雙位置架構）
> **last_updated**：2026-07-27（Round 27 確認仍適用，無改動）

---

## 為何有兩個位置

本專案同時存在於兩個檔案系統位置，**這是刻意的架構設計，不是遺留問題**。原因：

1. **Git 隔離**：原位置是 git 倉庫（與 GitHub 同步），主位置是 production runtime
2. **Secrets 隔離**：主位置的 `.env`（真實 API keys）不進 git，原位置只有 `.env.example`
3. **私人物料隔離**：Hubert 個人相關資料夾（`./chicken-group-buying-customer-service_Hubert-info/`）保留在原位置，不同步到 production runtime
4. **執行環境純淨**：主位置不帶 `.git` 歷史，部署/執行時不會被 git metadata 污染

---

## 兩位置角色分工

### 原位置（brtclaw 工作目錄 + git 倉庫）

- **路徑**：`/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/`
- **角色**：
  - brtclaw 開發與修改的入口
  - git 倉庫（與 GitHub `kaden1122123/chicken-group-buying-cs` 同步）
  - 存放 Hubert 私人物料（`./chicken-group-buying-customer-service_Hubert-info/`）
  - 存放 session 整理狀態（透過 MIGRATION_HISTORY、INDEX、PHASE1_PROGRESS 等）
- **包含**：
  - `.git/` 目錄
  - `.env.example`（placeholder）
  - `MIGRATION_HISTORY.md`（本檔）
  - Hubert 私人物料

### 主位置（production runtime）

- **路徑**：`/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/`
- **角色**：
  - OpenClaw external-user agent 跑雞味客服 production runtime
  - 外部服務（LINE webhook 處理）透過此位置
  - 環境變數（`.env`）僅在此位置存在
- **不包含**：
  - `.git/` 目錄
  - Hubert 私人物料
  - 任何 MIGRATION_HISTORY 等 brtclaw 整理狀態文件（這些是 brtclaw 工作目錄的工件）

---

## 同步機制

### 工具腳本

`scripts/sync-mirror.sh` 處理雙向同步：

```bash
# 從原位置同步到主位置（brtclaw 改完後推送）
bash scripts/sync-mirror.sh from-legacy

# 從主位置同步回原位置（主位置有改動時拉回）
bash scripts/sync-mirror.sh from-primary
```

**排除項**（兩個方向都排除）：
- `.git/`（避免互相覆蓋 git 歷史）
- `node_modules/`
- `.env`（主位置的真實 secrets，絕不進原位置）
- `dashboard.tmp.html`

### 同步時機

- **brtclaw 修改後**：跑 `from-legacy`（原 → 主）
- **Session 結束時**：必跑一次 `from-legacy`
- **主位置手動改動後**：跑 `from-primary` 把變更拉回原位置
- **衝突處理**：若兩邊都被改過，需手動比對並 merge（目前尚未發生）

### 同步驗證

每次同步後，Hubert 可比對關鍵檔案的 hash 值確認一致：

```bash
# 比對 config/tenants/chicken.yaml
md5sum /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/config/tenants/chicken.yaml
md5sum /home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/config/tenants/chicken.yaml
```

---

## 為何不單一化（2026-06-27 Session C C1 決策紀錄）

**考慮過的另一個方案**：把 `.git` 移到主位置，讓主位置同時是 git 倉庫 + production runtime，達到「單一 workspace」。

**決策結果**：**維持現狀（雙位置）**。理由：

| 單一化的問題 | 影響 |
|------|------|
| 主位置變成 git 倉庫 | 違反 production runtime 慣例（執行時不該帶 git 歷史） |
| `.env` 必須嚴格進 `.gitignore` | 增加誤 commit 風險（真實 secrets 一旦 commit 進 git 難清除） |
| Hubert 私人物料位置要重新決策 | 需決定放主位置（污染 runtime）還是別處（更多路徑） |
| 大量路徑引用要全面更新 | SOP、PHASE1_PROGRESS、MEMORY、AGENTS、TOOLS、session prompts 全部要改 |
| 開發流程要重新學 | Hubert 從「原位置改 → rsync 到主」改成「主位置改 → git commit」需重新適應 |
| 改動風險高 | 影響 production runtime 與外部服務整合 |

**雙位置的成本**：新人需理解兩邊關係、同步需手動。**這個成本可被明確化文件消解**，而單一化的風險無法被接受。

---

## 開發流程（brtclaw 視角）

1. **cd 到原位置**開始工作：
   ```bash
   cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
   ```

2. **修改檔案**（src/、config/、docs/、tests/ 等）

3. **跑測試**驗證：
   ```bash
   npm test
   ```

4. **git commit**（描述清楚變更內容）

5. **rsync 到主位置**：
   ```bash
   bash scripts/sync-mirror.sh from-legacy
   ```

6. **驗證主位置**（必要時）：
   ```bash
   cd /home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service
   npm test
   ```

7. **Session 結束時**：Hubert 統一處理 `git push`（避免 push 被打斷留下半同步狀態）

---

## 開發流程（Hubert 視角）

- **想改雞肉專案**：跟 brtclaw 說「整理雞味專案」或「雞味客服進度更新」，brtclaw 會自動 cd 到原位置開始工作
- **看 production runtime 狀態**：直接看主位置（外部服務打這邊）
- **兩個位置不一致時**：以原位置為準（git history 在這邊），主位置跑 `from-legacy` 同步

---

## 移轉歷史（保留供參考）

| 日期 | 事件 |
|------|------|
| 2026-06-12 | 專案建立於 `openclaw-workspace/others/chicken-group-buying-customer-service/` |
| 2026-06-12 ~ 2026-06-14 | Phase 1 + 階段 1+2 修補（11 個 commit）|
| 2026-06-15 15:48 | 階段 3-A2：根目錄重整 + README v2.0 |
| 2026-06-15 15:50 | 階段 3-A1：依 Hubert 決策移轉到 external-user workspace |
| 2026-06-15 15:55 | 建立鏡像關係（原位置 .git = GitHub）|
| 2026-06-27 | Session C C1：明確化雙位置架構（本檔重寫）|

> 移轉決策原始紀錄見 [docs/archive/REVIEW_2026-06-15_PLAN_V2.md](https://github.com/kaden1122123/chicken-group-buying-cs/blob/main/docs/archive/REVIEW_2026-06-15_PLAN_V2.md)

---

## 相關檔案

- `scripts/sync-mirror.sh` — 雙向同步腳本
- `.openclaw-internal/SESSION_BACKGROUND.md` — 新 session 背景 Prompt
- `docs/INDEX.md` — 專案總覽
- `docs/architecture/NEW_ORDER_FLOW.md` — 新訂單流程
- `docs/TODO_2026-06-26.md` — 6/26 修整 audit 報告

---

_本檔由 brtclaw 維護，結構性變更需跟 Hubert 確認後修改_
