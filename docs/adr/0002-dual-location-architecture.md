# ADR-0002: 雙位置架構（原位置 + 主位置）

> **狀態**：Accepted
> **日期**：2026-06-27（Session C C1）
> **決策者**：Hubert
> **背景文件**：[MIGRATION_HISTORY.md](../../MIGRATION_HISTORY.md)

---

## 背景（Context）

雞味客服同時存在於兩個檔案系統位置，看似冗餘，但這是刻意的架構設計：

| 位置 | 路徑 |
|------|------|
| 原位置 | `/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/` |
| 主位置 | `/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/` |

考慮過另一個方案：把 `.git` 移到主位置，達到「單一 workspace」。

## 決策（Decision）

**維持現狀（雙位置），不同步單一化。**

## 理由

| 單一化的問題 | 影響 |
|-------------|------|
| `.env` 必須嚴格進 `.gitignore` | 增加誤 commit 真實 secrets 的風險（一旦 commit 難清除）|
| Hubert 私人物料位置要重新決策 | 放主位置（污染 runtime）還是別處（更多路徑）？|
| 大量路徑引用要全面更新 | SOP、PHASE1_PROGRESS、MEMORY、AGENTS、TOOLS、session prompts 全部要改 |
| 開發流程要重新學 | 「原位置改 → rsync 到主」改成「主位置改 → git commit」需重新適應 |

雙位置的優勢：
1. **Git 隔離**：原位置是 git，主位置不帶 `.git` 歷史
2. **Secrets 隔離**：主位置的 `.env` 不進 git
3. **私人物料隔離**：Hubert 個人資料夾（`./chicken-group-buying-customer-service_Hubert-info/`）保留在原位置
4. **執行環境純淨**：主位置不帶 git metadata，部署/執行不被污染

## 後果（Consequences）

### 同步機制

- `scripts/sync-mirror.sh from-legacy`：原位置 → 主位置（單向）
- 同步時排除：`.git`、`.env`、`node_modules`、`dashboard.tmp.html`
- rsync 使用 `--delete` 會清掉主位置 untracked 檔案（如測試 CSV）⚠️

### 已知風險

- rsync 可能覆蓋主位置測試資料（Session J 計畫改善）
- 兩位置內容可能漂移（雖然都有 git 作 single source of truth，但 sync 有時機差）

### 緩解

- Session J 計畫加 `--dry-run` 與 `.rsync-filter` 排除測試 CSV
- MIGRATION_HISTORY.md 詳細說明同步流程

---

_本 ADR 解釋「為何有兩個資料夾」，接手者常見疑問_
