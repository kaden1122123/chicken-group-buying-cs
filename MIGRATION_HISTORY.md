# 雞肉團購客服專案 — 移轉記錄

> ⚠️ **本專案已移轉到 external-user agent 的工作區**

**主位置（OpenClaw agent 跑這個）**：
```
/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/
```

**原位置（保留為移轉記錄）**：
```
/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/
```

**GitHub**：`https://github.com/kaden1122123/chicken-group-buying-cs`（沿用）

**鏡像關係**：
- 主位置是**檔案系統層**的工作區，沒有 .git（純鏡像）
- 原位置是**git 倉庫**，是 GitHub 的 mirror
- 兩個位置檔案相同，跑 9 套測試都全綠
- 修改時要 cd 到原位置做 git commit

## 為何移轉

依 Hubert 6/15 決策（見 [REVIEW_2026-06-15_PLAN_V2.md](https://github.com/kaden1122123/chicken-group-buying-cs/blob/main/docs/archive/REVIEW_2026-06-15_PLAN_V2.md)）：

> 雞肉客服專案位於 main agent 的 others projects 區，與 external-user agent 跨帳號。維護/部署時需要切換目錄，較不便。應移轉到 external-user agent 自己的工作區。

## 移轉歷程

| 日期 | 事件 |
|------|------|
| 2026-06-12 | 專案建立於 `openclaw-workspace/others/chicken-group-buying-customer-service/` |
| 2026-06-12 ~ 2026-06-14 | Phase 1 + 階段 1+2 修補（11 個 commit）|
| 2026-06-15 15:48 | 階段 3-A2：根目錄重整 + README v2.0 |
| 2026-06-15 15:50 | 階段 3-A1：移轉到 external-user workspace |
| 2026-06-15 15:55 | 建立鏡像關係（原位置 .git = GitHub）|

## 完整 commit 歷史（GitHub）

```
8b6f89f (HEAD) 階段 3-A1 移轉記錄（標記已移轉）
d4b76b5 階段 3-A2 重整根目錄 + 更新 README
98d914a 階段 2 - D5 通知管理員 + D6 CSV 寫入 + D2 訂單流程
0f620c2 階段 1 - C1-C2 人設 + D1 開團日期 + D3 配送範圍
57ba8fc docs: PHASE1_PROGRESS 加入 21:09 OpenClaw delivery bug 記錄
8db08d8 feat: D1 儀表板 MVP + E1-E2 文檔整理
e166afd docs: C1 完整 SOP
1801c83 feat: 多租戶規模化抽離
1f7ca5e fix: Bug 1/2 修補
12974eb fix: Phase 1 review + tech debt cleanup
...
```

## 開發流程

### 修改檔案
1. cd 到主位置：`/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/`
2. 修改 src/、tests/、config/ 等
3. 跑 9 套測試
4. **手動同步**到原位置（鏡像）：
   ```bash
   rsync -av --delete \
     /home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/ \
     /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/
   ```
5. cd 到原位置，git add + commit + push

### 或更簡單（推薦）
1. 直接在原位置編輯
2. 改完後**手動複製**到主位置：
   ```bash
   rsync -av --delete \
     /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/ \
     /home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/
   ```

（兩個目錄是鏡像，可以從任一邊 sync 到另一邊。）

## 為何不用 git worktree？

曾嘗試用 `git worktree add` 在主位置 checkout，但因為主位置已有完整檔案，會衝突。如果未來需要更好的同步，可以考慮：
- 用 `git worktree add -f` 強制覆蓋
- 或把原位置整個 `.git` 移到主位置（純粹改路徑）

## 當前狀態

- **GitHub 倉庫**：`https://github.com/kaden1122123/chicken-group-buying-cs`（與原倉庫同步）
- **主位置**：`/home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/`（鏡像）
- **原位置**：`/home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/`（移轉記錄 + .git）
- **測試**：9 套全綠（兩個位置都能跑）
- **Hubert 私人物料**：`./chicken-group-buying-customer-service_Hubert-info/`（保留在原位置）
