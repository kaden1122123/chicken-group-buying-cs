# Session M — Backup 機制 Prompt

> **業務問題（CEO 視角）**：`data/orders/` 與 `knowledge/tenants/` 沒有自動備份。如果磁碟壞掉或誤刪，真實訂單資料（6/13、6/16）會永久消失。
> **影響**：🟢 低（影響災難恢復）
> **推薦**：做（1 小時、低風險）
> **狀態**：✅ 已完成（K+M backup 已上線）
> **證據**：`scripts/backup.sh` + `scripts/backup_smoke_test.sh` + cron job 已建立
> **涵蓋改動**：M1~M3（backup 腳本 + smoke test + 排程驗證）

---

## Prompt 區段

```
你是 brtclaw。雞味客服 Session M：Backup 機制。

## 必讀文件
1. CEO 決策指南：docs/CEO_DECISION_GUIDE.md（看 Session M 段）
2. 修整計畫：docs/CLEANUP_PHASE_2_PLAN.md（§三 Session M）
3. scripts/cleanup-test-orders.sh 看既有 shell script 風格
4. MEMORY.md §I（SOP）

## Session M 任務（CEO 視角）

開始時問 CEO 決策：

「data/orders/ 與 knowledge/tenants/ 沒自動備份，
磁碟壞掉或誤刪就永久消失。建立每日 backup 機制，做 / 不做？」

如果「做」，執行 3 個項目：

### M1：scripts/backup.sh
- 備份 data/orders/ + knowledge/tenants/ + config/tenants/
- tar.gz 格式
- 目標：~/.backups/chicken/YYYY-MM-DD/
- 含時間戳的歸檔（例：chicken-backup-2026-06-29.tar.gz）

### M2：crontab 每日 02:00 自動跑
- `crontab -e` 加：
  `0 2 * * * /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/scripts/backup.sh`
- 注意：不要 commit crontab（每個使用者不同）

### M3：backup rotation（保留 7 天）
- backup.sh 跑完後刪除超過 7 天的舊備份
- 用 find -mtime +7 -delete
- 保留策略：每日 1 個檔案，超過 7 天刪除

## 必跑 SOP
- I-1：每個 M1~M3 commit 前 git add -A + status + stat + commit + show
- I-2：grep 確認備份路徑引用點
- I-3：每方案含「會連帶改 X、Y、Z」

## 約束
1. 每個 M1~M3 一個獨立 commit（3 commits 預期）
2. M2 不 commit crontab 設定（系統層）
3. M3 rotation 邏輯不可誤刪今日備份
4. 真實訂單保護（Session D SOP）持續生效
5. 不中途 push / rsync

## 執行流程
1. 讀必讀文件
2. 給 Hubert 看決策 → 等回覆
3. M1 backup.sh → bash scripts/backup.sh 驗證 → commit
4. M2 crontab 設定（不 commit，僅說明指令給 Hubert）→ 不 commit
5. M3 rotation 邏輯 → 模擬測試 → commit
6. 跑完整 check-quality.sh + npm test 全綠
7. 統一 push + rsync
8. 通知 Hubert（含 crontab 指令）

開始吧。
```