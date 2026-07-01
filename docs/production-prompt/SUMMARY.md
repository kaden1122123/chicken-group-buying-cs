# Production Prompt 版本摘要

> **目的**：讓接手者一眼看到當前使用哪個 prompt 版本、歷史變更
> **最後更新**：2026-07-01
> **對應 session**：X1-A（建立 symlink + SUMMARY）

---

## 當前使用版本

**`latest` symlink** → `2026-06-28/`（Session N / Session E A 方案決策後版本）

| 版本 | 日期 | 對應 Session | 狀態 | 觸發原因 |
|------|------|---------------|------|----------|
| `2026-06-26` | 2026-06-26 | Session A ~ M 前身 | 📦 Archived | Phase 1 初版（quick reply v1）|
| `2026-06-28` | 2026-06-28 | Session N / E A 方案決策 | ✅ **Current**（= latest）| 訂單流程改 A 方案（LLM 純文字 + Hubert 手動建單過渡期）|
| `latest` | → | symlink → 2026-06-28 | ✅ Current | 自動指向當前版本 |

---

## 變更歷史摘要

### 2026-06-26（v1）
- Phase 1 初版
- 訂單流程：quick reply v1（按鈕架構）
- 知識庫：knowledge/tenants/chicken/ 12 個 .md 檔

### 2026-06-28（v2 — 當前）
- **Session N 重大變更**：訂單流程從 v1.5 quick reply 改 A 方案
- 原因：v1.5 按鈕沒顯示 + CSV 沒寫入
- Session E 決策 D（Worker 獨立觸發 API）有架構難題：
  - Worker 拿不到 LLM 對話歷史
  - OpenClaw agent 沒 tool calling
- A 方案：LLM 純文字 + 「客戶打『確認』」關鍵字觸發 + Hubert 手動建單

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
