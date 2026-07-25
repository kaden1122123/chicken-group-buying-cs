# docs/.archive/ — 歸檔文件目錄

> **建立**：2026-07-25 13:00+ Round 25（Hubert 11:33 指示）
> **目的**：保留歷史記錄但不污染主要 docs/ 入口
> **注意**：這裡的檔案**不再維護**，新資訊請更新到 `docs/INDEX.md` 列的正式文件

---

## 📁 歸檔清單

| 檔案 | 大小 | 歸檔時間 | 原因 |
|------|------|----------|------|
| `PHASE1_PROGRESS.md` | 41KB | 2026-07-25 13:00+ | Phase 1 進度（2026-06-29 完）已被 Round 19+ `OPERATIONS.md` 取代 |
| `CLEANUP_PHASE_2_PLAN.md` | 22KB | 2026-07-25 13:00+ | Phase 2 cleanup 計劃（已執行完）|
| `TODO_2026-06-26.md` | 27KB | 2026-07-25 13:00+ | 6/26 舊 TODO（已過時）|
| `DAILY_SUMMARY_2026-06-26.md` | 7.5KB | 2026-07-25 13:00+ | 6/26 舊日誌（取代：`memory/2026-06-26.md`）|
| `SOP.md` | 16KB | 2026-07-25 13:00+ | 舊 SOP（已被 `OPERATIONS.md` + `DEVELOPMENT.md` 取代）|
| `SYSTEM_AUDIT_2026-07-19.md` | 33KB | 2026-07-25 13:00+ | 7/19 完整 audit 報告（671 行摘要已併入 `HANDOFF.md` §7）|

**總計**：6 個檔案，~147KB 從主要 docs/ 移到歸檔

---

## 🔍 怎麼找歷史資訊

如果需要看舊版本：

```bash
# 用 git 找歷史
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
git log --all --full-history -- docs/.archive/PHASE1_PROGRESS.md

# 直接看（不推薦，但可以）
ls docs/.archive/
cat docs/.archive/SOP.md  # 舊 SOP（已合併到 OPERATIONS.md + DEVELOPMENT.md）
```

## 🚫 請勿 read

這些檔案已**過時**，新資訊在：
- `docs/OPERATIONS.md`（取代 STAGING.md + LINE_BOT_SETUP.md + STAGING_SECRETS_SETUP.md）
- `docs/DEVELOPMENT.md`（取代 TESTING_GUIDE.md + TESTING_TROUBLESHOOTING.md）
- `docs/HANDOFF.md` §7 變更歷史（取代 CHANGELOG.md 細節）
- `docs/INDEX.md`（單一入口）

---

_本目錄由 brtclaw 維護_
_Round 25 任務 1 — LEGACY 歸檔_
_最後更新：2026-07-25 13:00+_
