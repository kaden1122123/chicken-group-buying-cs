# GCP Service Account Key Rotation SOP

> **作者**：brtclaw（2026-07-19 03:36+ 整理 session）
> **觸發**：audit 2026-07-19 發現 `google-service-account.json` 已 2+ 個月沒 rotate（建立時間 2026-05 之前）
> **目的**：建立定期 rotate SOP，避免 service account key 過期/外洩導致 Sheets sync 失敗
> **對齊**：GCP 官方 best practices + goldbergyoni/nodebestpractices

---

## 1. 為何需要 rotate

- **GCP 官方建議**：service account key 應 **90 天 rotate 一次**（最長）
- **資安風險**：長期不 rotate 增加外洩風險
- **系統影響**：如果 key 被 revoke，Sheets sync 會立即失敗（每日 cron 03:00 Asia/Taipei）
- **本專案現況**：`google-service-account.json` 自 2026-05 建立後未 rotate（已 2+ 個月）

---

## 2. Rotate 流程（手動 6 步）

### 步驟 1：建立新 service account key

```bash
# 在 GCP Console → IAM & Admin → Service Accounts
# 找到專案 chickencustomerservicesheets 的 service account
# 點進去 → Keys → Add Key → Create new key → JSON
# 下載後命名為 google-service-account.json.new
```

或者用 gcloud CLI：

```bash
gcloud iam service-accounts keys create \
  google-service-account.json.new \
  --iam-account=<SERVICE_ACCOUNT_EMAIL> \
  --project=chickencustomerservicesheets
```

### 步驟 2：驗證新 key 有效

```bash
# 在 dev repo 跑驗證腳本
node -e "
  const {google} = require('googleapis');
  const auth = new google.auth.GoogleAuth({
    keyFile: '/home/clawuser/.config/chicken/secrets/google-service-account.json.new',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  auth.getClient().then(c => console.log('✓ New key valid')).catch(e => console.error('✗', e.message));
"
```

### 步驟 3：替換 production runtime 的 key

```bash
# 備份舊 key
cp /home/clawuser/.config/chicken/secrets/google-service-account.json \
   /home/clawuser/.config/chicken/secrets/google-service-account.json.bak.$(date +%Y%m%d)

# 替換為新 key
mv /home/clawuser/.config/chicken/secrets/google-service-account.json.new \
   /home/clawuser/.config/chicken/secrets/google-service-account.json

# 設定權限（mode 600）
chmod 600 /home/clawuser/.config/chicken/secrets/google-service-account.json
```

### 步驟 4：驗證 Sheets sync 仍正常

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
node scripts/sheets-sync-cron.js dryRun
# 預期：找到 sheet、列出訂單數、不實際寫入
```

### 步驟 5：刪除 GCP 上的舊 key

```bash
# GCP Console → Service Account → Keys → 找到舊 key（看 created time）→ Delete
# 或者用 gcloud：
gcloud iam service-accounts keys delete \
  <OLD_KEY_ID> \
  --iam-account=<SERVICE_ACCOUNT_EMAIL>
```

### 步驟 6：更新本檔（記錄 rotate 紀錄）

在 §3「Rotate 歷史」加一行：
```
| 2026-XX-XX | 2026-05-XX | new_key_id | brtclaw | ... |
```

---

## 3. Rotate 歷史

| 日期 | 舊 key 建立 | 新 key ID | 操作者 | 備註 |
|------|------------|-----------|--------|------|
| _（待 rotate）_ | 2026-05（建立）| _待建立_ | _待操作_ | 2+ 個月未 rotate（2026-07-19 audit 發現）|

---

## 4. 自動化建議（未來實作）

### 方案 A：建立提醒 cron

```bash
# 每月 1 號檢查 key age，超過 60 天就 warn
KEY_AGE_DAYS=$(( ($(date +%s) - $(stat -c %Y ~/.config/chicken/secrets/google-service-account.json)) / 86400 ))
if [ "$KEY_AGE_DAYS" -gt 60 ]; then
  echo "⚠️ GCP service account key 已 ${KEY_AGE_DAYS} 天，建議 rotate（>90 天會強制失效）"
fi
```

### 方案 B：建立 rotate script

```bash
#!/bin/bash
# scripts/gcp-rotate-key.sh
# 自動建立新 key + 替換 + 驗證 + 刪除舊 key（需要 gcloud + GCP project 訪問權限）
```

（**注意**：方案 A/B 需要 `gcloud` CLI 安裝 + GCP project 訪問權限，目前環境未配置）

---

## 5. 業界 best practices 整合

- **Google Cloud IAM Best Practices**：service account key 應 90 天 rotate
- **OWASP Secrets Management**：定期 rotate 降低長期外洩風險
- **HashiCorp Vault**：動態 secrets 自動 rotate（本專案暫不需要此複雜度）

---

## 6. 相關資源

- `~/.config/chicken/secrets/google-service-account.json` — 目前 service account key（待 rotate）
- `~/.config/chicken/secrets/gmail-credentials.json` — Gmail OAuth credentials（獨立於 service account）
- `scripts/sheets-sync-cron.js` — P9 Sheets sync script
- `scripts/setup-google-sheets.sh` — 初次 GCP setup script
- GCP project：`chickencustomerservicesheets`
- GCP Console：https://console.cloud.google.com/iam-admin/serviceaccounts

---

_本檔由 brtclaw 維護，每次 rotate 後更新 §3 歷史_
