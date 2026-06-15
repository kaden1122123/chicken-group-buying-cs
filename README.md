# 雞肉團購客服專案 — 移轉記錄

> ⚠️ **本專案已移轉到 external-user agent 的工作區**

**新位置**：`/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/`

**GitHub**：`https://github.com/kaden1122123/chicken-group-buying-cs`（沿用）

## 為何移轉

依 Hubert 6/15 決策（[REVIEW_2026-06-15_PLAN_V2.md](https://github.com/kaden1122123/chicken-group-buying-cs/blob/main/docs/archive/REVIEW_2026-06-15_PLAN_V2.md)）：

> 雞肉客服專案位於 main agent 的 others projects 區，與 external-user agent 跨帳號。維護/部署時需要切換目錄，較不便。應移轉到 external-user agent 自己的工作區。

## 移轉歷程

| 日期 | 事件 |
|------|------|
| 2026-06-12 | 專案建立於 `openclaw-workspace/others/chicken-group-buying-customer-service/` |
| 2026-06-12 ~ 2026-06-15 | Phase 1 + 階段 1+2 修補（7 個 commit）|
| 2026-06-15 15:48 | 階段 3-A2：根目錄重整 + README v2.0 |
| 2026-06-15 15:50 | 階段 3-A1：移轉到 external-user workspace |

## 完整 commit 歷史（保留在 GitHub）

```
e166afd docs: C1 完整 SOP
1801c83 feat: 多租戶規模化抽離（向後相容）
1f7ca5e fix: Bug 1/2 修補（dateRule + timeSlotRule + tests）
12974eb fix: Phase 1 review + tech debt cleanup
e8454ba feat: Phase 1 P1-1~P1-5 complete
82c2c37 fix: use config.yaml open_dates, trim sanitization, sync ignored keywords
dc41874 feat: add YYYY-MM-DD open dates, ignored keywords, and config loader
bf0cbd5 chore: add .gitignore and .env.example for security
66487f0 Phase 1: 雞肉團購 AI 客服核心功能（84 檔案，10635 行）
```

## 當前狀態

- **雞肉專案完整檔案**：`/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/`
- **GitHub remote**：`https://github.com/kaden1122123/chicken-group-buying-cs`
- **測試**：9 套全綠
- **Hubert 私人物料**：`./chicken-group-buying-customer-service_Hubert-info/`（保留在原位置）

## 快速連結

- 新位置 [README.md](file:///home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/README.md)
- [GitHub 倉庫](https://github.com/kaden1122123/chicken-group-buying-cs)
- [docs/INDEX.md](https://github.com/kaden1122123/chicken-group-buying-cs/blob/main/docs/INDEX.md)（文檔目錄）
- [docs/SOP.md](https://github.com/kaden1122123/chicken-group-buying-cs/blob/main/docs/SOP.md)（完整 SOP）
- [docs/MULTI_TENANT_DESIGN.md](https://github.com/kaden1122123/chicken-group-buying-cs/blob/main/docs/MULTI_TENANT_DESIGN.md)（多租戶設計）
