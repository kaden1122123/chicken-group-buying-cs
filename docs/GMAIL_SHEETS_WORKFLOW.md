# Gmail + Google Sheets 整合 Workflow（真實測試版）

> **建立時間**：2026-08-03 11:30 GMT+8
> **作者**：brtclaw（Hubert 指出先前 health check 過於樂觀後，重做實機測試）
> **目的**：記錄 Gmail OAuth 與 Google Sheets Service Account 的**真實**運作狀態與重置 SOP
> **測試標準**：**禁止將 dryRun 標示為 100% 健康**；唯有真實發出 API 封包並驗證 log 才算 Live Pass，否則必須標註為「僅 Dry-Run 驗證」

---

## §1 測試標準（強制）

### 1.1 Live Pass vs Dry-Run

| 類型 | 條件 | 報告標示 |
|------|------|----------|
| **Live Pass** | 真實發出 HTTPS API 封包、收到 200/2xx 回應 + log 有記錄 | ✅ Live Pass（已驗證 API 呼叫 + log） |
| **Dry-Run** | 僅檢查檔案存在、端點可達、env 設定正確，但沒實際呼叫 API | ⚠️ 僅 Dry-Run 驗證（未實測 API 呼叫） |
| **Fail** | API 回 4xx/5xx 或連線錯誤 | ❌ Fail（[error message]） |

### 1.2 未來健康報告鐵律

- 任何「✅ Gmail 整合健康」之類的敘述**必須**附上 Live Pass 的證據（curl/HTTPS log、API response code、執行時間）
- 「✅ Sheets API 200 OK」≠「✅ Sheets 整合健康」：要列出具體讀寫動作的成功 log
- ❌ 禁止用「檔案存在 + endpoint reachable」當作健康證明

---

## §2 Google Sheets 整合（Service Account JWT）— ✅ Live Pass

### 2.1 認證機制

- **方式**：Service Account JWT（無 OAuth 過期問題）
- **Service Account Email**：`chicken-sheets-sync@chickencustomerservicesheets.iam.gserviceaccount.com`
- **Project ID**：`chickencustomerservicesheets`
- **憑證檔**：`~/.config/chicken/secrets/google-service-account.json`（2416 bytes, 600 權限）

### 2.2 Spreadsheet ID

`12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA`

（公開 URL：https://docs.google.com/spreadsheets/d/12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA/edit?usp=sharing）

### 2.3 Live Test 結果（2026-08-03 11:30）

| API | 結果 | 回應時間 | 備註 |
|-----|------|----------|------|
| `spreadsheets.get` | ✅ Live Pass | 729 ms | 標題「雞味客服訂單」，1 個工作表「工作表1」 |
| `spreadsheets.values.get` | ✅ Live Pass | 430 ms | range「工作表1!A1:Z5」回傳 5 rows |

### 2.4 驗證指令（可重複執行）

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service

node -e "
const { google } = require('googleapis');
(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: '/home/clawuser/.config/chicken/secrets/google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  const result = await sheets.spreadsheets.get({ 
    spreadsheetId: '12sG_0b_sgZcR0mLNYq7J7AJVuOVqDUeBuP14qkHe6kA' 
  });
  console.log('Title:', result.data.properties.title);
})();
"
```

### 2.5 已知問題

- **Service Account 權限**：必須在 GCP console 把 `chicken-sheets-sync@chickencustomerservicesheets.iam.gserviceaccount.com` 加到 Sheet 的「共用對象」（目前已驗證有權讀）
- **寫入權限**：`spreadsheets.values.append` 需要的 scope 是 `spreadsheets`（非 readonly），cron `6033de71` 跑的 `sheets-sync-cron.js` 應已有此 scope

---

## §3 Gmail 整合（OAuth 2.0 Loopback Flow）— ❌ FAIL

### 3.1 認證機制

- **方式**：OAuth 2.0 Desktop App Loopback Flow
- **Client 類型**：`installed`（type=installed）
- **Client ID**：`11296846529-rrb7n92bqco6ng0ted6j5l9u2ars1sm4.apps.googleusercontent.com`
- **Redirect URI**：`http://localhost`
- **OAuth Client 檔**：`~/.config/chicken/secrets/gmail-credentials.json`（416 bytes, 600 權限）
- **Token 檔**：`~/.config/chicken/secrets/gmail-token.json`（556 bytes, 600 權限，mtime 2026-08-03 10:08）

### 3.2 需要的 Scope

```js
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];  // src/handoff/emailNotifier.js:30
```

### 3.3 Live Test 結果（2026-08-03 11:30）

| 動作 | 結果 | 錯誤訊息 |
|------|------|----------|
| `gmail.users.getProfile` | ❌ Fail | `Request had insufficient authentication scopes.`（403） |
| Token 存在 | ✅ 是 | 但 scope 與 emailNotifier.js 要求不符 |

### 3.4 根因分析

**目前 `gmail-token.json` 取得的 scope 不足以做 `gmail.send`（emailNotifier.js 要求）**。

可能原因：
- Token 是用 `gmail.readonly` 或其他 scope 取得的（早期 OAuth flow）
- 之後 `emailNotifier.js` 改 scope 到 `gmail.send`，但 token 沒重跑 OAuth

**結論**：Gmail 整合目前**處於中斷狀態** — 程式碼可以載入 token，但實際寄信會 403 fail。

### 3.5 修復 SOP（需 Hubert 互動式執行）

⚠️ **這是 OAuth Desktop App flow，無法純命令列完成** — 需要 Hubert 在 browser 互動授權：

```bash
# Step 1: 確認 OAuth client 是「Desktop app」類型（GCP console）
#   路徑：APIs & Services → Credentials → OAuth 2.0 Client IDs
#   必須是「Desktop app」（不是 Web application）

# Step 2: 確認 redirect_uris 包含 http://localhost
#   已在 gmail-credentials.json 內：「redirect_uris":["http://localhost"]

# Step 3: 確認 GCP project 已啟用 Gmail API
#   路徑：APIs & Services → Library → 搜尋 "Gmail API" → Enable

# Step 4: 確認 OAuth consent screen 已加入 gmail.send scope
#   路徑：APIs & Services → OAuth consent screen → Scopes for Google APIs
#   必須有 https://www.googleapis.com/auth/gmail.send

# Step 5: 跑 OAuth flow（需 browser 互動）
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
node scripts/gmail-auth.js
# → terminal 顯示「Please visit this URL: https://accounts.google.com/...」
# → browser 開啟，登入 clawbrt@gmail.com（不是 kaden1122123@gmail.com）
# → 授權「Send email on your behalf」
# → browser 跳轉到 localhost → terminal 顯示「✓ Token 已存到 ...」

# Step 6: 驗證 token 有 gmail.send scope
node -e "
const fs = require('fs');
const t = JSON.parse(fs.readFileSync('/home/clawuser/.config/chicken/secrets/gmail-token.json', 'utf8'));
console.log('scope:', t.scope);
console.log('expected: https://www.googleapis.com/auth/gmail.send');
"
```

### 3.6 驗證指令（修完後跑）

```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service

node -e "
const fs = require('fs');
const { google } = require('googleapis');
(async () => {
  const creds = JSON.parse(fs.readFileSync('/home/clawuser/.config/chicken/secrets/gmail-credentials.json', 'utf8'));
  const token = JSON.parse(fs.readFileSync('/home/clawuser/.config/chicken/secrets/gmail-token.json', 'utf8'));
  const oauth2 = new google.auth.OAuth2(creds.installed.client_id, creds.installed.client_secret, creds.installed.redirect_uris[0]);
  oauth2.setCredentials(token);
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  console.log('✅ Gmail Live Pass:');
  console.log('  email:', profile.data.emailAddress);
})();
"
```

**預期結果**：`email: clawbrt@gmail.com`，無 403 錯誤。

### 3.7 寄信實測（修完後跑）

```bash
node -e "
const { sendEmail } = require('./src/handoff/emailNotifier');
sendEmail({
  to: 'k.chang.8844@gmail.com',
  subject: '[Test] Gmail 整合健康檢查',
  body: '本信件由 SYSTEM_HEALTH_CHECK 自動寄出，驗證 Gmail API 是否真的運作。',
}).then(r => console.log('✅ 寄信成功:', r)).catch(e => console.log('❌ 寄信失敗:', e.message));
"
```

---

## §4 整合現況對照表

| 整合 | 認證方式 | 目前狀態 | 修復所需 |
|------|----------|----------|----------|
| Google Sheets | Service Account JWT | ✅ Live Pass（已驗證 API 呼叫）| 維持現狀 |
| Gmail | OAuth 2.0 Loopback | ❌ Fail（scope 不足） | 重跑 `scripts/gmail-auth.js` |

---

## §5 歷史教訓（為何這份文件存在）

**2026-08-02 之前的 SYSTEM_HEALTH_CHECK.md** 報告：
- ❌ 錯誤：「Gmail API fallback 路徑... 因 token 缺失可能 fail」
- ❌ 錯誤：「Sheets 整合透過 service account JWT（無 OAuth 過期問題）運作，主要功能正常」

**2026-08-03 實測發現**：
- ✅ Sheets：Live Pass（service account JWT 完全沒問題）
- ❌ Gmail：token 確實**存在**（不是缺失），但 scope 不足導致 403
- ❌ 「token 缺失」是基於「檔案不存在」的推測，**完全沒實際呼叫 API 驗證**

**結論**：未來 health check 必須**真實打 API**，不能用「檔案存在 / 端點可達 / env 設定正確」當證據。

---

_本檔由 Hub Session 2026-08-03 11:30 實測產出_
_下次 health check 必須重跑 §2.4、§3.6、§3.7 三段驗證指令並貼 log_