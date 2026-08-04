# 老闆操作手冊 (OWNER_MANUAL.md)

> **對象**：雞味研究所 Hubert（老闆）
> **範圍**：日常營運、菜單管理、訂單審核、系統維護
> **最後更新**：2026-08-04 22:04（Round 37.10）

---

## 1. 修改菜單 / 價格 / 免運門檻 / 開團日期

### 1.1 修改菜單與價格
- **檔案**：`knowledge/tenants/chicken/01_product.md`
- **格式**：Markdown 表格
  - 第 1 欄：品項名稱（整隻雞標「（整隻）」）
  - 第 2 欄：價格（純數字）
  - 第 3 欄：單位
  - 第 4 欄：備註
- **改完後**：
  ```bash
  bash scripts/sync-mirror.sh from-legacy  # 同步 L1 → L2
  bash scripts/sync-canonical.sh           # 同步 L1 → L3
  ```
  兩條都跑後，立即生效。

### 1.2 修改免運門檻
- **檔案**：`knowledge/tenants/chicken/04_delivery.md`
- **關鍵字**：`免運門檻`、`雞肉：1 盒`、`小菜：滿 NT$350`

### 1.3 修改開團日期
- **檔案**：`config/tenants/chicken.yaml`
- **位置**：
  ```yaml
  storage:
    phase1:
      enabled: true
    open_dates:           ← 這裡
      - '2026-08-04'
      - '2026-08-07'
  ```
- **改完後**：
  ```bash
  bash scripts/sync-config.sh
  bash scripts/sync-mirror.sh from-legacy
  ```

### 1.4 改完後驗證
```bash
curl -H "X-API-Token: $(cat /home/clawuser/.config/chicken/secrets/api-token)" \
     "http://localhost:3001/api/config/open-dates"
# 應回傳：今天日期 + 開團日期陣列
```

---

## 2. 在 Dashboard 後台審核訂單與對帳

### 2.1 進入 Dashboard
- **URL（本機）**：`http://localhost:3001`
- **URL（外網）**：`https://dashboard.brt1122.com`（透過 Cloudflare Tunnel）
- **Auth**：用瀏覽器登入 → 右上「API Token」輸入 `/home/clawuser/.config/chicken/secrets/api-token`

### 2.2 審核訂單流程
1. 開 Dashboard → 看當日訂單
2. 點「標記已收款」→ 訂單狀態 `PENDING` → `PAID`
3. 點「審核通過」→ 訂單狀態 `PAID` → `CONFIRMED`
4. 客戶棄單 → 點「取消訂單」→ 訂單狀態 → `CANCELLED`

### 2.3 變更訂單狀態（API 模式）
```bash
curl -X POST "http://localhost:3001/api/orders/ORD-20260804-001/status" \
  -H "Content-Type: application/json" \
  -H "X-API-Token: $(cat /home/clawuser/.config/chicken/secrets/api-token)" \
  -d '{"date": "2026-08-04", "status": "CONFIRMED"}'
```
- 合法 status：`PENDING` / `CONFIRMED` / `PAID` / `CANCELLED`

### 2.4 對帳
- 每日 23:00 跑 `node scripts/send-digest.js` 寄送當日訂單彙總
- 月底跑 `node scripts/sheets-sync-cron.js` 同步到 Google Sheets
- 在 Dashboard 看 `total_amount` 加總

### 2.5 看當日訂單（API）
```bash
curl -H "X-API-Token: $(cat /home/clawuser/.config/chicken/secrets/api-token)" \
     "http://localhost:3001/api/orders?date=2026-08-04"
# 預設查詢今日；若今日無訂單會自動降級顯示「最新有訂單的日期」
```

---

## 3. 使用 sync-mirror.sh 進行一鍵同步

### 3.1 什麼時候需要同步
- 修改 `knowledge/tenants/chicken/*.md`（菜單/FAQ/規則）
- 修改 `config/tenants/chicken.yaml`（開團日期/免運門檻）
- 修改 `src/` 任一檔案（程式碼）

### 3.2 一鍵同步指令
```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service

# L1 (dev repo) → L2 (mirror)：所有改動推過去
bash scripts/sync-mirror.sh from-legacy

# L1 (dev repo) → L3 (production runtime)：prompt 與 canonical 檔
bash scripts/sync-canonical.sh

# L1 (chicken.yaml) → L1 (config.yaml)：config 統一
bash scripts/sync-config.sh

# 一鍵跑三條（最常用）
bash scripts/sync-mirror.sh from-legacy && \
bash scripts/sync-config.sh && \
bash scripts/sync-canonical.sh
```

### 3.3 同步後驗證
```bash
# 看 L2 mirror 8/4 CSV 是否同步
diff -q data/orders/chicken/2026-08-04.csv \
        /home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/data/orders/chicken/2026-08-04.csv
# 沒輸出 = 一致

# 看 L3 production runtime prompt 是否同步
ls -la /home/clawuser/.openclaw/agents/external-user/knowledge/main_idea.md
```

### 3.4 同步失敗怎麼辦
| 症狀 | 解法 |
|------|------|
| `sync-mirror.sh` 報權限錯 | `chmod +x scripts/sync-mirror.sh` |
| `sync-canonical.sh` 找不到 `latest/` | `ln -sf 2026-08-04 docs/production-prompt/latest` |
| `sync-config.sh` 報 separator count 不對 | 確認 chicken.yaml 沒特殊字元 |

---

## 4. 緊急聯絡 / 維護

### 4.1 重啟服務
```bash
# 重啟 Dashboard
systemctl --user restart dashboard-server   # 若有 systemd
# 或
pkill -f dashboard-server.js && cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service && nohup node scripts/dashboard-server.js > /tmp/dashboard.log 2>&1 &

# 重啟 OpenClaw Gateway
systemctl --user restart openclaw-gateway
```

### 4.2 看 log
```bash
# Dashboard log
tail -f /tmp/openclaw/openclaw-2026-08-04.log

# Worker deploy log
cd ~/openclaw-workspace/external-user/cloudflare-worker
wrangler tail  # 即時看 Cloudflare Worker log
```

### 4.3 緊急撤銷 / 重跑 sync
- **撤銷最近一次 sync**：`bash scripts/sync-mirror.sh from-legacy --delete`（慎用）
- **手動強制覆蓋 L2**：`rsync -avz --delete data/ /home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service/data/`

---

## 5. 重要檔案位置速查

| 用途 | 路徑 |
|------|------|
| 菜單 | `knowledge/tenants/chicken/01_product.md` |
| 訂單流程 | `knowledge/tenants/chicken/02_order_flow.md` |
| 付款方式 | `knowledge/tenants/chicken/03_payment.md` |
| 配送規則 | `knowledge/tenants/chicken/04_delivery.md` |
| 優惠活動 | `knowledge/tenants/chicken/05_promotion.md` |
| FAQ | `knowledge/tenants/chicken/06_faq.md` |
| 轉真人規則 | `knowledge/tenants/chicken/07_transfer_rules.md` |
| 客戶標籤 | `knowledge/tenants/chicken/10_customer_tags.md` |
| 主設定 | `config/tenants/chicken.yaml` |
| 純人設 prompt | `docs/production-prompt/2026-08-04/main_idea.md` |
| Secrets | `/home/clawuser/.config/chicken/secrets/` |
| Dashboard | `http://localhost:3001`（外網 `dashboard.brt1122.com`） |
| Cloudflare Worker | `~/openclaw-workspace/external-user/cloudflare-worker/` |
| Chicken Repo | `~/openclaw-workspace/others/chicken-group-buying-customer-service/` |

---

_本檔由 brtclaw 自動產生（Round 37.10 Hubert 21:55 大翻修）_
_下次更新：當系統架構變更時_
