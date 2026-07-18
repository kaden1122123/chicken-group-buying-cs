# Production Prompt 版本摘要

> **目的**：讓接手者一眼看到當前使用哪個 prompt 版本、歷史變更
> **最後更新**：2026-07-18 08:30
> **對應 session**：X1-A（建立 symlink + SUMMARY） + 2026-07-03 完整 codebase audit + 2026-07-15 收尾（AGENTS.md 合併 + config drift）+ 2026-07-18 開頭對齊修正

---

## 當前使用版本

**`latest` symlink** → `2026-07-03/`（Session P0 2026-07-15 audit 收尾 + 2026-07-03 完整 codebase audit 後版本）

| 版本 | 日期 | 對應 Session | 狀態 | 觸發原因 |
|------|------|---------------|------|----------|
| `2026-06-26` | 2026-06-26 | Session A ~ M 前身 | 📦 Archived | Phase 1 初版（quick reply v1）|
| `2026-06-28` | 2026-06-28 | Session N / E A 方案決策 | 📦 Archived | 訂單流程改 A 方案（LLM 純文字 + Hubert 手動建單過渡期）|
| `2026-07-03` | 2026-07-03 | 完整 codebase audit 收尾（AGENTS.md 合併 + config drift）| ✅ **Current**（= latest）| AGENTS.md 首次納入版本控制；🚨 規則/開團截單時間/Session Q 路徑警告合併進主上線端；`bash scripts/sync-config.sh` 同步 config.yaml；新增 Check 9 drift 預防 |
| `latest` | → | symlink → 2026-07-03 | ✅ Current | 自動指向當前版本 |

---

## 變更歷史摘要

### 2026-06-26（v1）
- Phase 1 初版
- 訂單流程：quick reply v1（按鈕架構）
- 知識庫：knowledge/tenants/chicken/ 12 個 .md 檔

### 2026-06-28（v2）
- **Session N 重大變更**：訂單流程從 v1.5 quick reply 改 A 方案
- 原因：v1.5 按鈕沒顯示 + CSV 沒寫入
- Session E 決策 D（Worker 獨立觸發 API）有架構難題：
  - Worker 拿不到 LLM 對話歷史
  - OpenClaw agent 沒 tool calling
- A 方案：LLM 純文字 + 「客戶打『確認』」關鍵字觸發 + Hubert 手動建單

### 2026-07-03（v3 — 當前，Hubert 2026-07-03 17:18 audit + 2026-07-15 收尾）
- **觸發**：完整 codebase audit 發現多處 drift
- **AGENTS.md 首次納入版本控制**（生產 LLM 端的 🚨 規則/開團截單時間/Session Q 路徑警告合併進主上線端 canonical）
- **config.yaml drift 修整**：`bash scripts/sync-config.sh` 同步 chicken.yaml → config.yaml（補上 Session D3-2/3-3 漏的 keys + `tenant:` section）
- **新增 Check 9 drift 預防**：mtime + missing keys 雙重檢查，防下次再 drift
- **三層位置正式對齊**（依 ENGINEERING_HANDBOOK §6.6）：
  - 主上線端 `~/.openclaw/agents/external-user/` — production
  - 測試端 `~/.openclaw/workspace-external-user/` — sandbox / dev
  - 本倉庫 source `docs/production-prompt/{version}/` — version control

---

## 接手 SOP

1. **確認當前版本**：`ls -la docs/production-prompt/` 看 `latest` symlink 指向
2. **變更 prompt 流程**：
   - 新建 `docs/production-prompt/YYYY-MM-DD/` 目錄
   - 複製 `latest/` 內容過去
   - 修改後 commit
   - 改 symlink：`ln -sfn YYYY-MM-DD latest`
   - 更新本檔 SUMMARY.md（加一行 + Current）
3. **驗證 single source of truth**：`bash scripts/check-quality.sh` Check 8 跑 `verify-kb-sources.js`
4. **同步到 LLM agent**：
   - `~/.openclaw/agents/external-user/knowledge/`（symlink 自動）
   - 或手動 rsync / 重新 deploy

---

_本檔由 brtclaw 維護，每次 prompt 版本變更時更新_
