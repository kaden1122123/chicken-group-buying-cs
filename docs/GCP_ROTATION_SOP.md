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
| 2026-07-16 | 2026-07-16（3 天前）| `e4894458f811ee29b3c396f7dacac57dfcca684f` | Hubert | Hubert 在 2026-07-16 創建新 key（audit 誤判為「2+ 個月未 rotate」，修正見 §6）|
| _（待 rotate）_ | 2026-05（建立）| _待建立_ | _待操作_ | 2+ 個月未 rotate（2026-07-19 audit 發現）|

**注意**：Hubert 在 2026-07-16 已創建新 key 並在 Sheet 加編輯者權限，目前 `/home/clawuser/.config/chicken/secrets/google-service-account.json` 是 3 天前的 fresh key，**無需 rotate**。本檔§6 詳述 audit drift。

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

- `~/.config/chicken/secrets/google-service-account.json` — 目前 service account key（**3 天前建立，fresh，無需 rotate**）
- `~/.config/chicken/secrets/gmail-credentials.json` — Gmail OAuth credentials（獨立於 service account）
- `scripts/sheets-sync-cron.js` — P9 Sheets sync script
- `scripts/setup-google-sheets.sh` — 初次 GCP setup script
- GCP project：`chickencustomerservicesheets`
- GCP Console：https://console.cloud.google.com/iam-admin/serviceaccounts

---

## 6.5 Audit Drift 說明（2026-07-19）

**事件**：2026-07-19 03:36+ session audit 誤判 `google-service-account.json` 為「2+ 個月未 rotate」。

**實際情況**：
- Hubert 在 2026-07-16 已創建新 service account key（在 `chickencustomerservicesheets` project，`client_email: chicken-sheets-sync@chickencustomerservicesheets.iam.gserviceaccount.com`）
- Hubert 在 Sheet 把 `chicken-sheets-sync@chickencustomerservicesheets.iam.gserviceaccount.com` 加為編輯者
- 2026-07-19 08:14 驗證：原本 key 可訪問 Sheets（包含 600+ 筆訂單資料），**無需 rotate**

**修法**：
- §3 Rotate 歷史表更新（記錄 Hubert 2026-07-16 創建新 key）
- §6 相關資源狀態改為「fresh，無需 rotate」
- `docs/SYSTEM_AUDIT_2026-07-19.md` §6 待後續 session M2（**取消** GCP rotate 項目，改為「已驗證無需 rotate」）

**教訓**：audit 時不要只看檔案 metadata（private_key_id），要實際驗證（curl Sheets API 確認能訪問）+ 詢問 user 最新狀態。

---

_本檔由 brtclaw 維護，每次 rotate 後更新 §3 歷史_

---

## 7. 自動化建議（Round 14 23:48 P2）

### 7.1 提醒腳本（key_age_check.sh）

```bash
#!/bin/bash
# scripts/key_age_check.sh
# 每月 1 號檢查 GCP service account key age
# 超過 60 天就 warn，超過 90 天就 critical（建議 rotate）

KEY_FILE=/home/clawuser/.config/chicken/secrets/google-service-account.json
WARN_DAYS=60
CRITICAL_DAYS=90

if [ ! -f "$KEY_FILE" ]; then
  echo "❌ $KEY_FILE 不存在"
  exit 1
fi

KEY_AGE_DAYS=$(( ($(date +%s) - $(stat -c %Y "$KEY_FILE")) / 86400 ))

if [ "$KEY_AGE_DAYS" -ge "$CRITICAL_DAYS" ]; then
  echo "🔴 CRITICAL: GCP service account key 已 ${KEY_AGE_DAYS} 天（>${CRITICAL_DAYS}天，建議立即 rotate）"
  exit 2
elif [ "$KEY_AGE_DAYS" -ge "$WARN_DAYS" ]; then
  echo "🟡 WARN: GCP service account key 已 ${KEY_AGE_DAYS} 天（>${WARN_DAYS}天，建議 rotate）"
  exit 1
else
  echo "🟢 OK: GCP service account key ${KEY_AGE_DAYS} 天（<${WARN_DAYS}天）"
  exit 0
fi
```

### 7.2 加進 OpenClaw cron（每月 1 號 09:00）

```bash
openclaw cron add \
  --name "GCP service account key age check（每月提醒）" \
  --schedule "cron 0 9 1 * *" \
  --tz Asia/Taipei \
  --agent-id agent:main:discord:channel:1512213273846485058 \
  --payload agentTurn \
  --message "bash /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service/scripts/key_age_check.sh" \
  --delivery-mode announce \
  --delivery-channel discord \
  --delivery-to "channel:1528418702167638016"
```

### 7.3 自動 rotate 腳本（Round 14 future）

**狀態**：未實作（需要 GCP 訪問權限 + 風險評估）

**建議未來實作**：
```bash
#!/bin/bash
# scripts/gcp-rotate-key.sh（Round 14 future）
# 自動建立新 key + 替換 + 驗證 + 刪舊 key
# 需要：gcloud CLI 安裝 + GCP 服務帳號 IAM 權限 + CLOUDFLARE_API_TOKEN 加密儲存
```

### 7.4 業界 best practices 整合（更新 §5）

- **Google Cloud IAM Best Practices**：
  - Service account key 90 天 rotate
  - 最小權限原則（只用需要的 scope）
  - 不要把 key commit 到 git
- **OWASP Secrets Management**：
  - 定期 rotate
  - 使用 secret manager（如果預算允許）
- **本專案現況**：
  - Key 3 天前建立（仍 fresh）
  - 用 XDG secrets 標準位置
  - mode 600
  - 定期提醒（建議加 cron）

---

_最後更新：2026-07-19 23:48（Round 14 P2 補自動化建議）_
