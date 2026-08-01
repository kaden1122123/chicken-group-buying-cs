# Session Index — 雞味客服（Round 34 重整）

> **最後更新**：2026-08-01 14:10+（Round 34 — 重生）
> **最後更新先決**：Hubert 13:50 確認方案 A（精簡、單一入口）

---

## 結構變更（2026-08-01 Round 34）

**新 session 開局入口**：根目錄 `NEW_SESSION_README.md`（單一入口 10 分鐘手冊）

**舊 session 交接文件**（已標 LEGACY 指向新檔）：
- `HANDOFF.md`（內容已併入 NEW_SESSION_README.md）
- `docs/handoff/sessions/SESSION_NEXT_PROMPT.md`（內容已併入 NEW_SESSION_README.md）
- `docs/handoff/ARCHITECTURE_CURRENT_STATE_2026-08-01.md`（內容已併入 NEW_SESSION_README.md）

**docs/.archive/ 整個目錄已刪除**（Round 34 整合 71 個檔案變更）：
- 22 個 session prompt（D3, D4, E, F, G, H, H8, I, J, K, L, M, N, O, P, Q, X1-X5）
- 13 個 legacy 計劃文件（PHASE1_PROGRESS, TODO_2026-06-26, CLEANUP_PHASE_2_PLAN, etc.）
- 21 個 planning-2026-06-12/ 歷史計劃
- 完整 audit 報告（SYSTEM_AUDIT_2026-07-19.md）

**完整 rationale 與細節**：見 `CHANGELOG.md` Round 34 段、`NEW_SESSION_README.md`、git log。

---

## 啟動新 session

新 session 直接從根目錄 `NEW_SESSION_README.md` 開始：

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
cat NEW_SESSION_README.md                 # 10 分鐘上手
bash scripts/check-quality.sh              # 12 項檢查
npm test                                   # 30+ 套全綠
curl http://localhost:3000/healthz         # 服務健康
```

---

## 必讀（5 個）

- `NEW_SESSION_README.md` — 單一入口 10 分鐘上手手冊
- `CHANGELOG.md` — commit-level 變更歷史
- `docs/OPERATIONS.md` — LINE bot + staging + secrets SOP
- `docs/DEVELOPMENT.md` — 測試 + 開發 + troubleshooting
- `docs/INDEX.md` — 單一入口（auto-generated）

---

## 詳細 handoff 紀錄

**Rounds 15-33**（最近 9 個詳細 handoff）：
- `docs/handoff/rounds/ROUND_15+16_2026-07-22.md`
- `docs/handoff/rounds/ROUND_18_2026-07-23.md`
- `docs/handoff/rounds/ROUND_19_2026-07-24.md`
- `docs/handoff/rounds/ROUND_28_2026-07-29.md`
- `docs/handoff/rounds/ROUND_29_2026-07-29.md`
- `docs/handoff/rounds/ROUND_30_2026-07-30.md`
- `docs/handoff/rounds/ROUND_31_2026-07-31.md`
- `docs/handoff/rounds/ROUND_32_2026-08-01.md`
- `docs/handoff/rounds/ROUND_33_2026-08-01.md`

**架構現況快照**：
- `docs/handoff/ARCHITECTURE_CURRENT_STATE_2026-08-01.md`（⚠ 已標 LEGACY，內容已併入 NEW_SESSION_README.md）

---

_本檔由 brtclaw 維護，Round 34 14:10+ 重寫_
