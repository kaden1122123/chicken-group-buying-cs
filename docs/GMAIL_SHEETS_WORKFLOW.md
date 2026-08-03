# Gmail + Google Sheets 整合工作流

> **last_updated**：2026-08-03（OAuth token 修復後整理）
> **適用專案**：chicken-group-buying-customer-service
> **GCP Project**：`chickencustomerservicesheets`

---

## 1. Overview

雞味客服同時整合兩個 Google 服務，使用**兩個獨立 auth 機制**但共用同一個 GCP project：

| 服務 | Auth 機制 | 用途 |
|------|------|------|
| **Gmail** | User OAuth 2.0（Desktop app loopback）| 老闆信箱 `clawbrt@gmail.com` 寄信 |
| **Google Sheets** | Service Account（JWT bearer）| 訂單資料 sync 到 sheet |

---

## 2. 兩個獨立 Auth 機制

### Gmail — User OAuth (Desktop app loopback)

```
User (clawbrt@gmail.com)
  ↓ browser 互動授權
OAuth Client ID (Desktop app)
  ↓ refresh_token 永久
googleapis SDK
  ↓ access_token 每 1hr 重簽
Gmail API (scope: gmail.send)
```

### Google Sheets — Service Account (JWT bearer)

```
Service Account (chicken-sheets-sync@chickencustomerservicesheets.iam.gserviceaccount.com)
  ↓ JSON private key
googleapis SDK
  ↓ JWT bearer assertion（每 1hr 重簽，無 refresh_token）
Google Sheets API (scope: spreadsheets R/W)
```

---

## 3. GCP 設定

| 項目 | 值 |
|------|-----|
| Project 名稱 | `ChickenCustomerServiceSheets` |
| Project ID | `chickencustomerservicesheets` |
| User OAuth Client | `11296846529-rrb7n92bqco6ng0ted6j5l9u2ars1sm4.apps.googleusercontent.com` |
| User OAuth Scope | `https://www.googleapis.com/auth/gmail.send` |
| Service Account | `chicken-sheets-sync@chickencustomerservicesheets.iam.gserviceaccount.com` |
| Service Account Scope | `https://www.googleapis.com/auth/spreadsheets` |
| 啟用 API | Gmail API + Google Sheets API |
| OAuth consent screen | External / Testing / Test user: `clawbrt@gmail.com` |

---

## 4. XDG Secrets（`~/.config/chicken/secrets/`，全部 chmod 600）

| 檔案 | 用途 | 大小 |
|------|------|------|
| `gmail-credentials.json` | OAuth Client ID | 416 B |
| `gmail-token.json` | refresh_token（永久有效除非撤銷）| ~1 KB |
| `google-service-account.json` | Service Account private key（**高危險，別 commit**）| 2416 B |
| `line-bot-token` | LINE bot token（額度 500/月）| 172 B |
| `api-token` / `api-pwd` / `dashboard-pwd` | 雞味客服 API 認證 | — |

---

## 5. Gmail 工作流

### 入口

```javascript
const { notifyHubert } = require('./src/handoff/notifier');
notifyHubert(message, { type: 'handoff' | 'autoOrder' | 'digest' | 'system' });
```

**Hubert 22:53 決定**：Email 不只是 fallback，**LINE + Email 並行**（每次觸發兩條都跑）。

### 4 種版型

| Type | 觸發處 | Subject 前綴 |
|------|------|------|
| `handoff` | `src/states/handoff.js:114` | 【雞味研究所】🔔 轉真人通知 |
| `autoOrder` | `src/handoff/autoOrder.js:94` / `:193` | 【雞味研究所】🤖 B 方案自動建單 |
| `digest` | `scripts/send-digest.js`（cron）| 【雞味研究所】📊 訂單彙總 |
| `system` | `notifier.js testNotification` + default | 【雞味研究所】⚙️ 系統通知 |

### OAuth 設定一次性步驟

完整步驟見 `docs/EMAIL_SETUP.md`（v2 — 2026-07-17，last_updated 2026-07-27）。

Quick reference：

```bash
# 1. cd chicken repo
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service

# 2. 跑 OAuth 授權
node scripts/gmail-auth.js

# 3. Browser 互動：選 clawbrt@gmail.com → Advanced → Go to ... → Allow
# 4. 複製授權碼 → 貼回 terminal

# 5. 驗證 token.json 建立
ls -la /home/clawuser/.config/chicken/secrets/gmail-token.json

# 6. 測試寄信
node -e "
  const { notifyHubert } = require('./src/handoff/notifier');
  notifyHubert('🎉 OAuth 測試', { type: 'system' })
    .then(() => console.log('OK'))
    .catch(e => console.error('ERR:', e.message));
"
```

### Refresh Token 政策

| Token | 壽命 | 備註 |
|------|------|------|
| **access_token** | 1 小時 | 過期前 googleapis SDK 自動用 refresh_token 換新，**無感** |
| **refresh_token** | 永久有效除非撤銷 | Google 官方說法 |

**失效情境**（會讓 refresh_token 死掉）：
1. User 去 https://myaccount.google.com/permissions 移除「雞味客服 Gmail」
2. GCP project 或 OAuth client 被刪除
3. **6 個月沒用** → Google 未公開 threshold，但風險存在

**建議**：每月 1 號寄一封 system log（`scripts/send-digest.js` 23:30 daily + 週日 10:00 已涵蓋）保持 active。

---

## 6. Google Sheets 工作流

### 入口

```javascript
const { syncOrdersToSheets } = require('./src/storage/sheetsSync');
syncOrdersToSheets({ dryRun: true });  // dry-run
syncOrdersToSheets();                 // 實際寫入
```

### Cron 觸發

```
Cron 6033de71（03:00 daily Asia/Taipei）
  └─→ scripts/sheets-sync-cron.js
      └─→ src/storage/sheetsSync.js
          └─→ syncOrdersToSheets({ dryRun: true })
```

### chicken.yaml 設定

```yaml
# config/tenants/chicken.yaml
storage:
  phase2:
    enabled: false   # ← 改 true 才會實際寫入
    spreadsheet_id: "12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA"
```

### Service Account 設定一次性步驟

完整步驟見 `scripts/setup-google-sheets.sh` 內 Step-by-step 說明。

Quick reference：
1. GCP project 已存在（chickencustomerservicesheets）
2. Service account `chicken-sheets-sync` 已建立
3. Google Sheets API 已啟用
4. Service account JSON key 已下載到 `google-service-account.json`
5. **Sheet 必須分享給 service account email 為 Editor**（最常見的失敗原因）
6. `chicken.yaml` 的 `storage.phase2.spreadsheet_id` 填入 sheet ID

### 驗證

```bash
# 1. 驗證 service account + token 取得
bash scripts/setup-google-sheets.sh

# 2. Dry-run
node -e "const {syncOrdersToSheets} = require('./src/storage/sheetsSync'); syncOrdersToSheets({dryRun:true}).then(r => console.log(JSON.stringify(r, null, 2)));"

# 3. 實際 sync
node -e "const {syncOrdersToSheets} = require('./src/storage/sheetsSync'); syncOrdersToSheets().then(r => console.log(JSON.stringify(r, null, 2)));"
```

---

## 7. 常見踩坑

| 問題 | 原因 | 解法 |
|------|------|------|
| **gmail-token.json 找不到** | OAuth 跑完但 token 沒持久化 | 重跑 `node scripts/gmail-auth.js` |
| **Email 沒收到** | refresh_token 失效或被 revoke | 到 https://myaccount.google.com/permissions 檢查；重跑 OAuth |
| **LINE 月度額度滿** | cron 寄太多 | `notifyHubert` 自動 fail LINE 部分；Email 還會跑 |
| **Sheets `permission_denied`** | Sheet 沒分享給 service account | 到 Sheet → Share → 加 `chicken-sheets-sync@...` 為 Editor |
| **Sheets `invalid_grant`** | Service account JSON key 被 rotate | 重下載 JSON key |
| **Sheets `404 not found`** | `spreadsheet_id` 填錯 | 從 sheet URL 重新複製 |

---

## 8. 相關檔案目錄

```
chicken-group-buying-customer-service/
├── docs/
│   ├── EMAIL_SETUP.md                    ← Gmail OAuth 完整指南（v2）
│   ├── GCP_ROTATION_SOP.md              ← GCP key rotation SOP
│   ├── GMAIL_SHEETS_WORKFLOW.md         ← 本檔
│   └── PROJECT_INVENTORY.md
├── src/
│   ├── handoff/
│   │   ├── emailNotifier.js             ← Gmail API client
│   │   └── notifier.js                  ← notifyHubert (LINE + Email 並行)
│   ├── states/handoff.js                ← 觸發 handoff 版型
│   ├── storage/sheetsSync.js            ← Sheets sync 邏輯
│   └── config.js
├── scripts/
│   ├── gmail-auth.js                    ← OAuth 授權 script
│   ├── send-digest.js                   ← 日報/週報 cron
│   ├── sheets-sync-cron.js              ← P9 Sheets wrapper
│   └── setup-google-sheets.sh           ← Setup helper
├── config/tenants/chicken.yaml          ← spreadsheet_id 設定
└── tests/
    ├── emailNotifier.test.js
    └── sheetsSync.test.js

~/.config/chicken/secrets/
├── gmail-credentials.json
├── gmail-token.json
├── google-service-account.json
├── line-bot-token
├── api-token / api-pwd / dashboard-pwd
```

---

## 9. 相關 Cron Jobs

| Cron ID | 名稱 | 頻率 | 用途 |
|------|------|------|------|
| `6033de71` | 雞味客服 P9 Sheets 同步 | 03:00 daily | Sheet sync |
| `796afb16` | 雞味客服日報彙總 | 23:30 daily | 寄 digest 版型 |
| `dc5afd05` | 雞味客服週報彙總 | 週日 10:00 | 寄週報 digest |

---

## 10. 變更紀錄

| 日期 | Round | 變更 |
|------|------|------|
| 2026-07-17 | P0 v0→v7 | Gmail 整合完整鏈（OAuth loopback + 4 種版型）|
| 2026-07-18 | — | 確認可寄信（daily note）|
| 2026-07-16 | P9 | Service Account + Sheets sync 建立 |
| 2026-08-03 | — | OAuth token 缺失修復（重跑 gmail-auth.js）+ 工作流文件化（本檔）|

---

_本檔由 brtclaw 在 2026-08-03 整理，用於雞味客服 Gmail + Google Sheets 整合工作流說明_