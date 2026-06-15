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
├── README.md                     # 專案入口
├── SPEC.md                       # 完整規格
├── PHASE1_PROGRESS.md            # Phase 1 進度
├── REVIEW_GUIDE.md               # 審查指南
├── docs/                         # 文檔目錄
│   ├── INDEX.md                  # ← 你在這裡
│   ├── SOP.md                    # 完整 SOP
│   ├── MULTI_TENANT_DESIGN.md    # 多租戶設計
│   ├── DAILY_SUMMARY_2026-06-12.md
│   └── archive/                  # 歷史文檔
├── config/                       # 多租戶設定
│   └── tenants/
│       └── chicken.yaml
├── knowledge/                    # 多租戶知識庫
│   ├── base/                     # 向後相容
│   └── tenants/
│       └── chicken/
├── data/                         # 多租戶訂單
│   └── orders/
│       └── chicken/
├── src/                          # 邏輯（共用）
│   ├── config.js
│   ├── knowledge/
│   ├── order/
│   ├── rules/
│   ├── states/
│   ├── handoff/
│   └── utils/
├── tests/                        # 8 套測試
│   ├── rules.test.js
│   ├── handoff.test.js
│   ├── security.test.js
│   ├── states.test.js
│   ├── date.test.js
│   ├── config.test.js
│   ├── whitelist.test.js
│   └── integration.test.js
├── scripts/
│   └── dashboard.js              # 儀表板生成器
└── dashboard.html                # 儀表板輸出
```

---

## 🔗 快速連結

- **Cloudflare Worker**：`~/openclaw-workspace/external-user/cloudflare-worker/`
- **OpenClaw Agent**：`~/.openclaw/agents/external-user/`
- **GitHub**：https://github.com/kaden1122123/chicken-group-buying-cs

---

_最後更新：2026-06-14_
