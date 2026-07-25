# KV 初始付款資訊

> 建立時間：2026-06-05
> 狀態：已備份，待 Cloudflare API Token 寫入

---

## 待寫入 KV 的付款資訊

**KV Namespace：** `4e2769895f2c48adb7b57e00a335c59f`
**Worker：** `external-user-line-security`

---

### 銀行轉帳

| 欄位 | 值 |
|------|-----|
| 銀行代碼 | 007（第一銀行）|
| 帳號 | 23257030422 |

---

### 街口支付

| 欄位 | 值 |
|------|-----|
| QR Code URL | `https://pub-ce7f744c6a2145a4a3277e8ed2c3f8fd.r2.dev/Payment/%E9%9B%9E%E5%91%B3%E7%A0%94%E7%A9%B6%E6%89%80_%E8%A1%97%E5%8F%A3%E6%94%AF%E4%BB%98_QRcode.jpg` |

---

### LINE Pay

| 欄位 | 值 |
|------|-----|
| 啟用 | true |
| LINE ID | `Willy0221` |

---

## 寫入方式

需要 Cloudflare API Token，透過以下 API 寫入：

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/{key}" \
  -H "Authorization: Bearer {API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '"value"'
```

**需要的 Key：**
- `payment:bank_account` → 銀行代碼與帳號
- `payment:jko_qr_code_url` → 街口支付 QR Code URL
- `payment:line_pay:line_id` → LINE Pay 加入 ID

---

## 現況阻礙

- ❌ 缺少 Cloudflare API Token
- 待 Hubert 提供後可立即寫入

---

_本檔案為備份，實際寫入請使用 Cloudflare API 或 Workers。_