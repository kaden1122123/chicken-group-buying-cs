# 雞肉團購 AI 客服 — 文檔索引

> 維護者：brtclaw
> 最後更新：2026-06-14 14:50

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

### 進度與日誌
- [../PHASE1_PROGRESS.md](../PHASE1_PROGRESS.md) — Phase 1 進度
- [DAILY_SUMMARY_2026-06-12.md](./DAILY_SUMMARY_2026-06-12.md) — 2026-06-12 日報

### 規格與審查
- [../SPEC.md](../SPEC.md) — 完整規格
- [../REVIEW_GUIDE.md](../REVIEW_GUIDE.md) — 審查指南

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
├── tests/                        # 11 套單元測試 + 2 套整合測試
│   ├── rules.test.js                  # 34+ 案例
│   ├── states.test.js                  # 狀態機轉換
│   ├── handoff.test.js                 # 14 種觸發條件
│   ├── security.test.js                # SQL/Prompt injection 防禦
│   ├── date.test.js                    # 12+ 時間邊界
│   ├── config.test.js                  # YAML 載入 + ignored_keywords
│   ├── whitelist.test.js               # 白名單機制
│   ├── integration.test.js             # Worker 攔截 mirror
│   ├── address-handoff.test.js         # P0-1：配送範圍觸發 handoff
│   ├── handoff-customer-reply.test.js  # P0-2：customer_reply 讀 config
│   └── state-trimmed-value.test.js     # P0-3：trimmed 值不被覆蓋
├── scripts/
│   ├── api-server.js               # HTTP API
│   ├── dashboard.js                # 儀表板生成器
│   ├── dashboard-server.js         # 儀表板 + admin 伺服器
│   ├── admin.html                  # 管理後台 UI（P0-4）
│   └── dashboard-server-test.js    # 整合測試
└── dashboard.html                # 儀表板輸出
```

---

## 🔗 快速連結

- **Cloudflare Worker**：`~/openclaw-workspace/external-user/cloudflare-worker/`
- **OpenClaw Agent**：`~/.openclaw/agents/external-user/`
- **GitHub**：https://github.com/kaden1122123/chicken-group-buying-cs

---

_最後更新：2026-06-26_
_最近評估：見 [TODO_2026-06-26.md](./TODO_2026-06-26.md)_
