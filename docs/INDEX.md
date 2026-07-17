# 雞肉團購 AI 客服 — 文檔索引

> 維護者：brtclaw
> 最後更新：2026-07-01 10:10（Session D3+D4 文件一致性收尾）

---

## 📚 必讀文檔（按優先順序）

### 給接手者
1. **[SOP.md](./SOP.md)** — 完整標準作業流程（人工設定、部署、維運、故障排除、接手）
2. **[MULTI_TENANT_DESIGN.md](./MULTI_TENANT_DESIGN.md)** — 多租戶規模化設計

### 給維運者
1. **[SOP.md](./SOP.md)** §五 維運清單
2. **[SOP.md](./SOP.md)** §六 故障排除

### 給開發者
1. **[../SPEC.md](../SPEC.md)** — 完整規格文件
2. **[SOP.md](./SOP.md)** §七 給接手者的指南
3. **[MULTI_TENANT_DESIGN.md](./MULTI_TENANT_DESIGN.md)** §二 檔案結構

---

## 📂 文檔分類

### 規劃與決策
- [SOP.md](./SOP.md) — 完整標準作業流程
- [MULTI_TENANT_DESIGN.md](./MULTI_TENANT_DESIGN.md) — 多租戶設計
- [TODO_2026-06-26.md](./TODO_2026-06-26.md) — 2026-06-26 評估與修整 TODO（14 個問題、利弊分析、決策表）|

### 進度與日誌
- [../PHASE1_PROGRESS.md](../PHASE1_PROGRESS.md) — Phase 1 進度（最後更新 2026-06-29 15:45）
- [DAILY_SUMMARY_2026-06-12.md](./DAILY_SUMMARY_2026-06-12.md) — 2026-06-12 日報
- [DAILY_SUMMARY_2026-06-26.md](./DAILY_SUMMARY_2026-06-26.md) — 2026-06-26 大規模修整日（audit + P0~P2 修整 + prompt 改動）
- [../.task-state/](../.task-state/) — 各 session 狀態檔（goal + steps）

### 規格與審查
- [../SPEC.md](../SPEC.md) — 完整規格
- [../REVIEW_GUIDE.md](../REVIEW_GUIDE.md) — 審查指南
- [production-prompt/](./production-prompt/) — Production prompt 版本控制（雞肉客服 SOUL.md + main_idea.md）|

### 歷史 Review（archive）
- [archive/REVIEW_2026-06-14.md](./archive/REVIEW_2026-06-14.md) — 初次 Review
- [archive/REVIEW_2026-06-14_BUGS_PLANNING.md](./archive/REVIEW_2026-06-14_BUGS_PLANNING.md) — Bug 分析
- [archive/REVIEW_2026-06-14_FINAL_PLAN.md](./archive/REVIEW_2026-06-14_FINAL_PLAN.md) — 完整規劃

---

## 🗂️ 專案結構

```
chicken-group-buying-customer-service/
├── MIGRATION_HISTORY.md          # 移轉記錄（原 README.md，記錄原位置與主位置鏡像關係）
├── SPEC.md                       # 完整規格
├── PHASE1_PROGRESS.md            # Phase 1 進度
├── REVIEW_GUIDE.md               # 審查指南
├── docs/                         # 文檔目錄
│   ├── INDEX.md                  # ← 你在這裡
│   ├── SOP.md                    # 完整 SOP
│   ├── MULTI_TENANT_DESIGN.md    # 多租戶設計
│   ├── TODO_2026-06-26.md        # 2026-06-26 評估與修整 TODO
│   ├── DAILY_SUMMARY_2026-06-12.md
│   └── archive/                  # 歷史文檔
├── config/                       # 多租戶設定
│   └── tenants/
│       └── chicken.yaml
├── knowledge/                    # 多租戶知識庫
│   ├── base/                     # 向後相容
│   ├── learned/                  # 學習記錄（空）
│   └── tenants/
│       └── chicken/
├── data/                         # 多租戶訂單
│   └── orders/
│       └── chicken/
├── src/                          # 邏輯（設計驗證 + 測試對象，**不是 production runtime**）
│   ├── config.js
│   ├── knowledge/
│   ├── order/
│   ├── rules/
│   ├── states/
│   ├── handoff/
│   └── utils/
├── tests/                        # 49 套 unit + 1 套 integration（共 50 套，2026-07-18 +B 方案 v2 +send-digest）
│   ├── rules.test.js                       # 34+ 案例
│   ├── states.test.js                      # 狀態機轉換
│   ├── handoff.test.js                     # 14 種觸發條件
│   ├── security.test.js                    # SQL/Prompt injection 防禦
│   ├── date.test.js                        # 12+ 時間邊界
│   ├── config.test.js                      # YAML 載入 + ignored_keywords
│   ├── whitelist.test.js                   # 白名單機制
│   ├── integration.test.js                 # Worker 攔截 mirror
│   ├── address-handoff.test.js             # P0-1：配送範圍觸發 handoff
│   ├── handoff-customer-reply.test.js      # P0-2：customer_reply 讀 config
│   ├── state-trimmed-value.test.js         # P0-3：trimmed 值不被覆蓋
│   ├── address-dynamic-keywords.test.js    # 動態關鍵字
│   ├── community-field.test.js             # community 欄位驗證
│   ├── config-interface-adoption.test.js   # config interface 採用
│   ├── csv-writer-concurrency.test.js      # CSV 寫入併發控制
│   ├── dashboard-server-yaml-fallback.test.js  # dashboard-server yaml fallback
│   ├── dashboard-server-yaml-patch.test.js     # dashboard-server I5 yaml patch (Session I)
│   ├── api-server-hardening.test.js           # api-server I1-I4 hardening (Session I)
│   ├── parse-items-dedup.test.js           # 解析品項去重
│   ├── api-server.test.js                  # API server 整合測試（含 MOCK_TODAY）
│   ├── logger.test.js                      # 結構化 logging (Session K)
│   ├── csv-writer-retry.test.js            # csvWriter retry (Session X4)
│   ├── triggers-cache.test.js              # triggers TTL cache (Session X4)
│   ├── session-j-architecture.test.js      # J regression test
│   ├── d3-payment-options-dynamic.test.js  # Session D3
│   ├── d4-phase2-stub.test.js              # Session D4 Phase 2
│   └── ...（完整 49 套 unit test，2026-07-18 從 47 → 49（含 autoOrder v2 + send-digest））
├── scripts/
│   ├── api-server.js               # HTTP API（+ /api/docs Swagger UI · Session L）
│   ├── dashboard.js                # 儀表板生成器
│   ├── dashboard-server.js         # 儀表板 + admin 伺服器
│   ├── admin.html                  # 管理後台 UI（P0-4）
│   ├── backup.sh                   # 每日備份（Session M）
│   ├── backup_smoke_test.sh        # 5 步煙霧測試（Session M）
│   ├── sync-mirror.sh              # 雙位置同步（Session J 加 --dry-run + .rsync-filter）
│   ├── cleanup-test-orders.{sh,js} # 清理測試訂單（Session J 重構,PROTECTED 單一來源）
│   └── dashboard-server-test.js    # 整合測試（CSV 讀取,跑在 npm run test:all）
├── openapi.yaml                    # OpenAPI 3.0 spec（Session L）
├── docs/API_CURL.md                # curl 範例文件（Session L）
└── dashboard.html                # 儀表板輸出
```

---

## 🔗 快速連結

- **Cloudflare Worker**：`~/openclaw-workspace/external-user/cloudflare-worker/`
- **OpenClaw Agent**：`~/.openclaw/agents/external-user/`
- **GitHub**：https://github.com/kaden1122123/chicken-group-buying-cs

---

_最後更新：2026-07-01 12:40（Phase 3 全部 6 sessions 完成 + 測試套數 32→47）_
_最近評估：見 [TODO_2026-06-26.md](./TODO_2026-06-26.md)_
_Session 修整進度：見 [CLEANUP_PHASE_2_PLAN.md](./CLEANUP_PHASE_2_PLAN.md) §四 優先順序彙總_
