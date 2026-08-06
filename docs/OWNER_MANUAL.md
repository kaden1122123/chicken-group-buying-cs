# 雞味研究所 Owner 操作手冊

> **對象**：Hubert（雞味研究所老闆）
> **最後更新**：2026-08-06 20:15（Round 37.32 4 大 bug 修整後）
> **本檔定位**：日常操作 SOP（不講程式碼，講操作）

---

## 1. 修改菜單 / 價格 / 免運門檻 / 開團日期

### 1.1 修改品項 / 價格

**位置**：`knowledge/tenants/chicken/01_product.md`

格式範例：
```markdown
| 品項 | 價 | 單位 | 備註 |
| --- | -- | ---- | ---- |
| 鹽水雞 | 380 | 半隻 | - |
| 土雞 | 820 | 整隻 | 需提前 2 天預定 |
```

**重要**：客戶問「土雞多少錢」時，AI 會自動讀這個檔並列出所有相關品項與價格（main_idea.md §三-3a 價格鐵律，Round 37.16 新增）。

### 1.2 修改開團日期（Open Dates）

**位置**：`config/tenants/chicken.yaml`

```yaml
storage:
  open_dates:
    - "2026-08-08"
    - "2026-08-09"
    - "2026-08-15"
```

**或**：在 Dashboard 後台「訂單審核」頁面 → 「開團日期」區塊直接編輯。

> **Round 37.30 修整**：客戶問「最近有哪天開團」時，AI 會自動從這邊讀取並回應，**不再**誤觸「轉真人」。

> **Round 37.30 修整**：客戶問「多少錢」也由 AI 自行讀 `knowledge/tenants/chicken/01_product.md` 回應，**不再**誤觸「轉真人」。但若改完 01_product.md，**記得跑 sync-kb.sh**（§1.5）讓 L3 同步。

### 1.3 修改免運門檻 / 配送範圍

**位置**：`config/tenants/chicken.yaml`

```yaml
delivery:
  minimum_order: 380   # 免運門檻
  hours:
    am: 10:00~12:00
    pm: 16:00~18:00
```

### 1.5 確認 KB 同步到 L3（Round 37.31 新增）

**修法背景**：如果 L3 LLM 說「菜單資料讀不到」或讀不到 01_product.md，可能是 KB 沒同步到 L3。

**修法**：
```bash
# 一次性手動同步
bash scripts/sync-kb.sh

# 加到 cron（讓 KB 每分鐘自動同步）
chmod +x scripts/sync-kb.sh
echo '* * * * * /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/scripts/sync-kb.sh >> /home/clawuser/.openclaw/logs/chicken/sync-kb.log 2>&1' | crontab -
```

**驗證**：
```bash
ls -la /home/clawuser/.openclaw/agents/external-user/knowledge/tenants/chicken/
# 應看到 12 個 KB .md 檔（01_product 到 12_reply_examples + INDEX）
```

---

## 2. 在 Dashboard 後台審核訂單與對帳

### 2.1 進入 Dashboard

- **網址**：https://dashboard.brt1122.com
- **認證**：HTTP Basic Auth
  - Username: `admin`
  - Password: `/home/clawuser/.config/chicken/secrets/dashboard-pwd`（15 chars）

### 2.2 訂單審核（新版操作按鈕 · Round 37.19）

訂單表格的 **「操作」欄**現在有 3 個真實功能按鈕（不再只是靜態假按鈕）：

| 按鈕 | 動作 | 觸發 API |
|------|------|----------|
| ✓ **PAID** | 標記訂單為已收款 | POST `/api/orders/:id/status` body `{date, status:"PAID"}` |
| 🚚 **SHIPPED** | 標記訂單為已出貨 | POST `/api/orders/:id/status` body `{date, status:"CONFIRMED"}` |
| ✕ **CANCEL** | 取消訂單 | POST `/api/orders/:id/status` body `{date, status:"CANCELLED"}` |

**操作流程**：
1. 點按鈕
2. 瀏覽器彈出確認框（confirm）
3. 確認後送 POST 帶 X-API-Token
4. 成功 → 右上角 Toast「✅ 訂單 ORD-xxx 狀態已更新為 PAID！」（3 秒）
5. 表格自動重新載入（30 秒內也會自動刷新）

**匯率**：無匯率（都是 NT$）

> **Round 37.29 修整**：操作按鈕成功觸發後，後台 `staff_notes` 欄位會記錄「⚠️ 老闆通知失敗：LINE=...」等狀態，**Dashboard 顯示給你**（如果 LINE + Email 都失敗）。

### 2.3 對帳流程

每筆訂單會出現在 Google Sheet `12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA`。

**事件驅動同步**（Round 37.17 新架構）：
- 每次客戶新訂單寫入 CSV → 5 秒內背景自動同步到 Sheet
- 每次操作按鈕變更狀態 → 5 秒內背景同步
- **不需手動跑任何 sync 指令**

如果發現 Sheet 與 CSV 不一致，可手動觸發：
```bash
cd ~/openclaw-workspace/others/chicken-group-buying-customer-service
node -e "require('./src/storage/sheetsSync').syncOrdersToSheets({dryRun:false, forceSync:true})"
```

### 2.4 查看 Dashboard 即時資訊

**頂部時間**：每 30 秒自動更新「最後更新：YYYY/MM/DD 下午 HH:MM:SS」

**3 張統計卡片**（動態計算）：
- 💰 **總銷售額**：所有訂單 total_amount 加總
- 📦 **總訂單數**：當前載入的訂單數
- ⏳ **待對帳訂單數**：payment_status = pending / pending_verify 的筆數

**3 張圖表**（動態渲染，30 秒更新）：
- 每日訂單數趨勢（最近 7 天）
- 訂單狀態分佈（doughnut chart）
- 熱門品項 Top 10（橫向 bar chart，Y 軸顯示商品名稱，X 軸整數刻度）

---

## 3. 使用 sync-mirror.sh 進行一鍵同步

### 3.1 程式碼改完後必跑

```bash
cd ~/openclaw-workspace/others/chicken-group-buying-customer-service
bash scripts/sync-mirror.sh from-legacy   # dev → primary mirror
pkill -9 -f "node.*dashboard-server"       # 重啟 dashboard
sleep 2
cd /home/clawuser/.openclaw/workspace-external-user/projects/chicken-group-buying-customer-service
nohup node scripts/dashboard-server.js > /tmp/dashboard-server.log 2>&1 &
sleep 3
curl -s http://localhost:3000/healthz       # 確認 up
```

### 3.2 Prompt 改完後必跑

```bash
cd ~/openclaw-workspace/others/chicken-group-buying-customer-service
bash scripts/sync-canonical.sh             # dev → L3 runtime
bash bin/check-drift 2>&1 | tail -10       # 0 Missing 驗證
```

### 3.3 Sheets 事件驅動同步（Round 37.17+）

不用手動跑。系統會在以下時機自動觸發：
1. `csvWriter.writeOrder()` 後（背景 `setImmediate`）
2. `dashboard-server` POST `/api/orders/:id/status` handler 後
3. `scripts/sync-mirror.sh` 完成後（cron 也會跑）

---

## 4. 緊急聯絡 / 維護

### 4.1 brtclaw 失聯 / 系統崩潰

1. SSH 到 `brt1122-System-09` (Hubert 主機)
2. 看 `/tmp/dashboard-server.log`
3. 看 `/home/clawuser/.openclaw/openclaw.log`
4. 重啟 OpenClaw：`openclaw gateway restart`

### 4.2 LINE Bot 沒回應

1. 看 `~/openclaw-workspace/external-user/cloudflare-worker/` 的 `src/index.ts`
2. 確認 Cloudflare Worker `external-user-line-security` 已部署
3. 看 Worker logs：https://dash.cloudflare.com/

### 4.3 Gmail / Sheets 失敗

1. 看 `/home/clawuser/.config/chicken/secrets/` 是否有過期 token
2. Service account JSON 是否還在（`google-service-account.json`）
3. Gmail token 是否需要重新 OAuth：
   ```bash
   node scripts/gmail-auth.js   # 會彈瀏覽器，請在有 GUI 的環境跑
   ```

### 4.4 訂單資料消失 / 損壞

```bash
# 從 git 恢復
cd ~/openclaw-workspace/others/chicken-group-buying-customer-service
git checkout HEAD -- data/orders/chicken/

# 重啟 Sheets 同步
bash scripts/sync-mirror.sh from-legacy
node -e "require('./src/storage/sheetsSync').syncOrdersToSheets({dryRun:false, forceSync:true})"
```

---

## 5. 重要檔案位置速查

### 5.1 主目錄（dev repo）
```
~/openclaw-workspace/others/chicken-group-buying-customer-service/
├── src/
│   ├── rules/
│   │   ├── paymentRule.js         # 付款白名單（Round 37.16）
│   │   └── ...
│   ├── order/
│   │   ├── csvWriter.js           # _triggerSheetsSync 事件驅動（Round 37.17）
│   │   ├── orderFormatter.js      # formatItemsForCsv 多品項格式（Round 37.16）
│   │   └── ...
│   ├── storage/
│   │   └── sheetsSync.js          # 動態表頭映射 headerMap（Round 37.18）
│   ├── handoff/
│   │   ├── emailNotifier.js
│   │   └── notifier.js
│   └── config.js
├── scripts/
│   ├── dashboard-server.js        # checkAuth X-API-Token（Round 37.19）
│   ├── sync-mirror.sh
│   ├── sync-canonical.sh
│   └── check-quality.sh
├── tests/                          # 60 個測試檔（npm test）
├── dashboard.html                  # Dashboard 前端（圖表、按鈕、Toast）
├── docs/                            # 4 個永久手冊 + reports/
├── data/orders/chicken/             # CSV 訂單
└── knowledge/tenants/chicken/       # KB（01_product.md 等）
```

### 5.2 配置文件
| 用途 | 路徑 |
|------|------|
| 主設定 | `config/tenants/chicken.yaml` |
| 知識庫 | `knowledge/tenants/chicken/01_product.md` |
| L3 Prompt | `docs/production-prompt/2026-08-04/{AGENTS,SOUL,main_idea}.md` |
| Sheets 對應 | `spreadsheet_id: 12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA` |
| 銀行帳號 | 007-23257030422（第一銀行） |

### 5.3 Secret 檔（不要動）
| 用途 | 路徑 |
|------|------|
| Gmail OAuth token | `/home/clawuser/.config/chicken/secrets/gmail-token.json` |
| Gmail OAuth credentials | `/home/clawuser/.config/chicken/secrets/gmail-credentials.json` |
| Google Sheets service account | `/home/clawuser/.config/chicken/secrets/google-service-account.json` |
| **API Token（Dashboard X-API-Token 用）** | `/home/clawuser/.config/chicken/secrets/api-token` |
| Dashboard HTTP Basic Auth 密碼 | `/home/clawuser/.config/chicken/secrets/dashboard-pwd` |
| LINE Bot token | `/home/clawuser/.config/chicken/secrets/line-bot-token` |

---

## 6. 日常檢查 SOP（每日 1 次，5 分鐘）

```bash
# 1. Dashboard 健康
curl -s http://localhost:3000/healthz | head -5

# 2. 最近 5 筆訂單
ls -lt data/orders/chicken/ | head -7

# 3. Sheets 同步狀態（事件驅動通常自動，這裡只是 sanity check）
curl -s 'https://docs.google.com/spreadsheets/d/12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA/export?format=csv&gid=0' 2>&1 | head -5

# 4. Cloudflare Worker 健康
curl -s -o /dev/null -w "%{http_code}" https://external-user-line-security.kaden1122123.workers.dev
# 預期：200

# 5. OpenClaw Gateway 健康
curl -s https://openclaw.brt1122.com/healthz 2>&1 | head -5
```

---

_本檔由 Round 37.20（2026-08-05 13:12）大更新_
_下次操作 SOP 變更必同步更新 §2-§5_