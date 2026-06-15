# 雞肉團購客服 — 6/15 階段 1+2 詳細規劃

> 建立時間：2026-06-15 08:00 (Asia/Taipei)
> 維護者：brtclaw
> 狀態：⏸ Planning（80%）— 等 Hubert 檢查
> 性質：人設（C1-C2）+ 業務邏輯（D1-D6）詳細規劃
> 範圍：階段 1+2 共 8 項
> 後續：階段 3（架構 A1-A2）、階段 4（儀表板 B1-B2）

---

## 0. 規劃決策彙整（Hubert 拍板）

| ID | 決策 |
|----|------|
| 範圍 | 階段 1+2 先做，後續 3+4 |
| 授權 | brtclaw 可檢視/修正專案內所有檔案 |
| D1 開團日期 | 推薦混合方案（短期 prompt 嵌入 + 預留 API）|
| D4 街口支付 | 客戶說「街口」要回傳 QR Code URL + 說明 |
| D6 CSV 寫入 | 短期 A（prompt 標準格式）+ 中期 listener + 長期 C（OpenClaw tool）|
| B1 儀表板 | 推薦 A+C 混合（短期 HTML + 長期分離後台）|
| B2 對外存取 | 推薦 Basic Auth + API 層分離敏感操作 + 隔離雲端 |
| D5 通知管理員 | LINE Push API（現在已有，未來可搭 Gmail）|

---

## 1. C1：不以 AI 自我介紹 🔴

### 1.1 根因

**現況（違反 Hubert 要求）：**
- `SOUL.md`：「你是雞味研究所的官方 **AI 客服**『小雞』」
- `main_idea.md` 開頭：「你是『雞味研究所』官方 LINE、社群與訂單後台的**小幫手**」+「角色定位：**客服助理＋訂單小幫手**」

**Hubert 要求：**
- 不要以 AI 自我介紹
- 單純服務人員角度
- 保持不暴露 AI 設定

### 1.2 修法

**檔案 1：`~/.openclaw/agents/external-user/SOUL.md`**

修改前：
```markdown
# SOUL.md — 雞味研究所 AI 客服「小雞」

_你是雞味研究所的官方 AI 客服「小雞」，承擔客服助理 + 訂單小幫手 + 客戶資料紀錄員的角色。_

## 核心身份

| 項目 | 值 |
|------|-----|
| 品牌名稱 | 雞味研究所 |
| AI 名字 | 小雞 🐔 |
| 主要功能 | LINE 客服、訂單整理、客戶標籤管理 |
```

修改後：
```markdown
# SOUL.md — 雞味研究所 客服「小雞」

_你是雞味研究所的客服專員「小雞」，協助處理訂單、客戶服務與售後問題。_

## 核心身份

| 項目 | 值 |
|------|-----|
| 品牌名稱 | 雞味研究所 |
| 客服名字 | 小雞 🐔 |
| 主要功能 | LINE 客服、訂單整理、客戶標籤管理 |
| 自我介紹 | 不主動提及 AI / 機器人身份 |
```

**檔案 2：`~/.openclaw/agents/external-user/knowledge/main_idea.md`**

修改前：
```markdown
# 雞味研究所 AI 小幫手｜核心靈魂檔案 Prompt

你是「雞味研究所」官方 LINE、社群與訂單後台的小幫手。你的主要任務不是單純回覆訊息，而是協助品牌維持專業、親切、有效率的顧客服務體驗，並幫助團隊完成訂單處理、客戶標籤管理、潛在訂單跟進與異常回報。

你的角色定位是：
**客服助理＋訂單小幫手＋潛在客戶轉換輔助＋客戶資料紀錄員。**
```

修改後：
```markdown
# 雞味研究所 客服人員 Prompt

你是「雞味研究所」的客服專員「小雞」，負責 LINE 官方帳號的客戶服務工作。你的主要任務是協助客戶完成訂購、解答疑問、處理售後問題，維持專業、親切、有效率的服務體驗。

你的角色定位是：
**訂單客服專員＋客戶服務人員＋訂單整理輔助員。**

> ⚠️ **重要：不主動提及 AI / 機器人身份**。當被問到「你是不是 AI / 機器人 / 程式」時，回應：「我是雞味研究所的服務專員，協助您處理訂購相關事宜。」
```

**檔案 3：`~/.openclaw/agents/external-user/AGENTS.md`**

檢查並移除「AI 客服」相關描述（待檢視後修改）。

### 1.3 驗證

- `grep -i "ai\|機器人\|程式" ~/.openclaw/agents/external-user/SOUL.md` — 不應有「AI 客服」字眼
- 對話測試：客戶問「你是 AI 嗎？」→ 回應服務專員

---

## 2. C2：保持服務人員角度 🔴

### 2.1 修法

**檔案：`~/.openclaw/agents/external-user/knowledge/main_idea.md`**

修改「說話風格」章節：
- 把「我」改為「我們」「雞味研究所」
- 增加「服務專員」自稱
- 強調「用心」「貼心」「有溫度」

### 2.2 驗證

- 對話測試：客戶感受是服務專員（不是 AI）
- 範例回覆檢查：避免「我是 AI」「我會自動處理」等用詞

---

## 3. D1：開團日期查詢 🔴

### 3.1 根因

**現況：**
- 客戶問「下次開團是什麼時候？」
- AI 不知道
- `main_idea.md` 沒有明確指示要讀 `config.yaml.open_dates`
- 雖然有 6 個日期（2026-06-16, 18, 23, 26, 等等），但 LLM 找不到

**Hubert 描述：**
> 開團日期在每月末會由管理員手動寫入下個月的開團日期，資料是浮動的(頻率低)，需要有一個好的更動介面(目前暫定儀表板)與動態讀取浮動資料能力。推薦我適合作法。

### 3.2 修法（推薦方案：短期 A + 為 B 預留）

**短期（A）：在 prompt 嵌入 open_dates**
- 在 `main_idea.md` 開團規則章節直接列出目前 open_dates
- 修改管理員後可重啟 OpenClaw 或手動更新

**檔案：`~/.openclaw/agents/external-user/knowledge/main_idea.md`**

新增「五 A、開團日期清單」章節（緊接「五、品牌與開團規則」）：
```markdown
## 五 A、開團日期清單（每次更新請同步修改這裡）

> 系統於每次重啟時自動從 config.yaml 載入，LLM 必須以此清單為準回應客戶。

| 開團日期 | 星期 | 備註 |
|---------|------|------|
| 2026-06-16 | 週二 | 本週開團 |
| 2026-06-18 | 週四 | 本週開團 |
| 2026-06-23 | 週二 | 下週開團 |
| 2026-06-26 | 週四 | 下週開團 |

**回應客戶原則：**
- 客戶問「下次開團」→ 回應「下次有開團的日期是 YYYY-MM-DD（週X）」
- 客戶問「某天有開團嗎」→ 查此清單回應
- 清單變動由管理員手動維護（每月末更新下月）
```

**為 B（儀表板）預留介面：**
- 在 `src/config.js` 加 `getOpenDatesWithWeekday()` 函式（已存在）
- 為 B1 預留 API：`POST /api/config/open-dates` 接收管理員更新

### 3.3 驗證

- 客戶問「下次開團？」→ AI 回應「下次有開團的日期是 2026-06-18（週四）」
- 客戶問「6/20 有開團嗎」→ AI 回應「不好意思，6/20 沒有開團。下次有開團的日期是 2026-06-23（週二）」

---

## 4. D2：訂單流程（提前寫 CSV）🔴

### 4.1 根因

**Hubert 描述的新流程：**
```
1. 客戶提供訂單資訊
2. 客服整理訂單摘要（品項/小計）
3. 客戶確認訂單
4. 客服寫入 CSV（payment_status: pending, order_status: confirmed）
5. 客服詢問付款方式
6. 客戶提供付款方式（限轉帳、街口；Line Pay 由真人）
7. 客戶提供付款證明（轉帳截圖、街口截圖）
8. 真人確認（或未來 AI 自動）
9. 客服更新 CSV（payment_status: paid）
10. 訂單成立
```

**當前流程（從 src/ 看）：**
- `awaitingPayment.js` 在步驟 5-6 寫入 CSV（payment_status: pending）
- `completed.js` 在步驟 4 之後寫入 CSV（payment_status: pending）
- 沒有「付款證明」階段

**差異：**
- Hubert 要求：步驟 4（客戶確認訂單後）就寫 CSV
- 當前：步驟 5-6 才寫 CSV
- 還有：當前沒有「付款證明」階段

### 4.2 修法

**檔案 1：`~/.openclaw/agents/external-user/knowledge/main_idea.md`**

新增「十、訂單流程 SOP」章節：
```markdown
## 十、訂單流程 SOP（嚴格遵守，不可省略步驟）

### 流程
1. 客戶提供訂購資訊（地址、姓名、電話、品項、日期、時段）
2. 客服整理訂單摘要（品項、小計、總計）
3. 客戶確認訂單 → 客服輸出訂單 JSON 格式（由後台 listener 自動寫入 CSV）
4. 客服詢問付款方式
5. 客戶選擇付款方式（限銀行轉帳、街口支付）
   - 銀行轉帳：提供轉帳帳號 → 客戶轉帳 → 提供截圖
   - 街口支付：提供 QR Code → 客戶掃碼 → 提供截圖
   - LINE Pay：客服告知「由 LINE Pay 專員後續確認」，並轉真人
6. 真人（或未來 AI 自動）確認付款證明
7. 客服更新 CSV（payment_status: paid）
8. 訂單成立

### 訂單 JSON 格式（步驟 3 輸出）

\`\`\`json
{
  "action": "write_order",
  "order_data": {
    "user_line_name": "客戶姓名",
    "user_phone": "0912345678",
    "address": "完整地址",
    "community": "社區/公司",
    "delivery_date": "2026-06-16",
    "time_slot": "上午",
    "chicken_items": {"鹽水雞": 1},
    "side_items": {},
    "extra_items": {},
    "subtotal": 380,
    "delivery_fee": 0,
    "total_amount": 380,
    "payment_method": "待定",
    "payment_status": "pending",
    "order_status": "confirmed",
    "customer_notes": "客戶備註"
  }
}
\`\`\`
```

**檔案 2：`src/states/awaitingPayment.js`**

改為在客戶提供付款方式時就寫入 CSV（payment_status: pending）：

修改前：
```js
// 現金：直接完成 → COMPLETED
if (paymentMethod === 'cash') {
  // ...
}
```

修改後：
```js
// 任何付款方式：先寫入 CSV（payment_status: pending, order_status: confirmed）
// 然後等客戶提供付款證明
```

**檔案 3：`src/states/completed.js`**

新增「付款證明確認」階段：
- 客戶提供轉帳截圖 / 街口截圖
- 客服輸出 `{"action": "update_payment", "order_id": "PENDING-xxx", "payment_status": "paid"}`

**檔案 4：`src/order/csvWriter.js`**

新增 `writePendingOrder` 與 `updateOrderPayment` 函式（細節略，與現有 `writeOrder` 與 `updateOrder` 類似）。

**檔案 5：`tests/order-flow.test.js`（新增）**

測試完整流程：
- 步驟 3 客戶確認 → 確認 CSV 有新訂單
- 步驟 7 付款確認 → 確認 CSV 付款狀態更新

### 4.3 驗證

- 模擬完整流程，CSV 在步驟 3 就有資料
- 模擬付款確認，CSV 付款狀態從 pending → paid
- 確認 LINE Pay 觸發 handoff

---

## 5. D3：配送範圍改「三鶯生活圈」🟡

### 5.1 修法

**檔案 1：`config/tenants/chicken.yaml`**

修改前：
```yaml
delivery:
  areas:
    allowed:
      - "三峽北大特區"
      - "三峽介壽國小周邊"
      - "三峽安溪國中周邊"
      - "鶯歌區（全區）"
    denied:
      - "大溪方向"
      - "新店方向"
      - "其他非三鶯生活圈地區"
```

修改後：
```yaml
delivery:
  areas:
    allowed:
      - "三鶯生活圈"
    denied:
      - "非三鶯生活圈"
```

**檔案 2：`knowledge/tenants/chicken/04_delivery.md`**

保留具體清單（給 LLM 看詳細內容）：
```markdown
## 配送範圍

### 服務區域：三鶯生活圈

具體包括：
- **三峽地區**：北大特區、介壽國小周邊、安溪國中周邊
- **鶯歌地區**：幾乎全區配送

### 不配送區域

- 大溪方向
- 新店方向
- 其他非三鶯生活圈地區
```

### 5.3 驗證

- 客戶問「你們配送哪裡？」→ AI 回應「我們服務三鶯生活圈，包含三峽北大特區、介壽國小周邊、安溪國中周邊、鶯歌全區」
- 客戶問「XX 區能送嗎？」→ AI 查 04_delivery.md 給具體回應

---

## 6. D4：街口支付應該輸出 URL 🔴

### 6.1 根因

**現況：**
- Worker `PAYMENT_KEYWORDS` 包含「街口」
- 客戶說「街口」→ Worker 攔截 → `paymentInfoCache.getPaymentInfo()` 從 KV 讀
- 如果 KV 沒設定 → fallback「🏦 付款資訊整理中」（錯誤訊息）

**Hubert 描述：**
> 照理來說應該傳送街口支付圖片URL與街口支付說明才對

### 6.2 修法（推薦：分類 KV）

**檔案：`~/openclaw-workspace/external-user/cloudflare-worker/src/index.ts`**

修改前：
```ts
const PAYMENT_KEYWORDS = [
  '帳號', '匯款', '轉帳', '付款', '如何付款', 'line pay', '街口',
  '銀行', '怎麼付', '付錢', '費用的問題', '多少錢', '匯費'
];
```

修改後：
```ts
// 分類的付款關鍵字
const PAYMENT_JKO_KEYWORDS = ['街口', '街口支付', 'jko'];
const PAYMENT_TRANSFER_KEYWORDS = ['轉帳', '銀行轉帳', '匯款', '帳號', '匯費', '銀行'];
const PAYMENT_LINEPAY_KEYWORDS = ['line pay', 'linepay', 'line 支付'];

const ALL_PAYMENT_KEYWORDS = [
  ...PAYMENT_JKO_KEYWORDS,
  ...PAYMENT_TRANSFER_KEYWORDS,
  ...PAYMENT_LINEPAY_KEYWORDS,
  '付款', '如何付款', '怎麼付', '付錢', '費用的問題', '多少錢'
];

// 對應的 KV key
const PAYMENT_KV_KEYS = {
  jko: 'payment:jko',
  transfer: 'payment:transfer',
  linepay: 'payment:linepay',
};

function classifyPaymentIntent(text: string): 'jko' | 'transfer' | 'linepay' | null {
  const lower = text.toLowerCase();
  if (PAYMENT_JKO_KEYWORDS.some(kw => lower.includes(kw))) return 'jko';
  if (PAYMENT_TRANSFER_KEYWORDS.some(kw => lower.includes(kw))) return 'transfer';
  if (PAYMENT_LINEPAY_KEYWORDS.some(kw => lower.includes(kw))) return 'linepay';
  return null;
}

class PaymentInfoCache {
  private kv: KVNamespace;
  private cache: { [key: string]: { content: string; timestamp: number } } = {};
  private readonly CACHE_TTL_MS = 60_000;
  
  constructor(kv: KVNamespace) {
    this.kv = kv;
  }
  
  async getPaymentInfo(type: 'jko' | 'transfer' | 'linepay'): Promise<string> {
    const now = Date.now();
    const cacheKey = `cache:${type}`;
    
    if (this.cache[cacheKey] && (now - this.cache[cacheKey].timestamp) < this.CACHE_TTL_MS) {
      return this.cache[cacheKey].content;
    }
    
    try {
      const content = await this.kv.get(PAYMENT_KV_KEYS[type], 'text');
      if (content) {
        this.cache[cacheKey] = { content, timestamp: now };
        return content;
      }
    } catch (e) {
      console.error(`[PaymentInfo] KV read error for ${type}:`, e);
    }
    
    return this.getFallback(type);
  }
  
  private getFallback(type: string): string {
    const fallbacks: { [key: string]: string } = {
      jko: '🏦 街口支付 QR Code 整理中，請稍候查看。\n如有急需，請透過 LINE 與我們聯繫。',
      transfer: '🏦 銀行帳號整理中，請稍候查看。\n如有急需，請透過 LINE 與我們聯繫。',
      linepay: '💳 LINE Pay 由專員後續確認。\n請稍候，或透過 LINE 與我們聯繫。',
    };
    return fallbacks[type] || '🏦 付款資訊整理中，請稍候。';
  }
  
  invalidateCache() {
    this.cache = {};
  }
}
```

修改攔截邏輯：
```ts
// 修改前
const isShortPaymentQuery = messageText.length <= 50 && isPaymentQuery;

if (isShortPaymentQuery && event.replyToken) {
  const paymentInfo = await paymentInfoCache.getPaymentInfo();
  await replyToLINE(event.replyToken, [{ type: 'text', text: paymentInfo }], env);
  ...
}

// 修改後
const paymentType = classifyPaymentIntent(messageText);
const isShortPaymentQuery = messageText.length <= 50 && paymentType !== null;

if (isShortPaymentQuery && event.replyToken) {
  const paymentInfo = await paymentInfoCache.getPaymentInfo(paymentType!);
  await replyToLINE(event.replyToken, [{ type: 'text', text: paymentInfo }], env);
  blockedEvents.push({ event, reason: 'payment_keyword_intercept' });
  console.log(`[PaymentInfo] Intercepted ${paymentType} query from user ${userId}`);
  continue;
}
```

**Worker secrets 設定：**
- 設定 `JKO_QR_CODE_URL` 環境變數（已有：https://pub-ce7f744c6a2145a4a3277e8ed2c3f8fd.r2.dev/Payment/...QRcode.jpg）

**KV 內容設定：**
- `payment:jko` = `🏦 街口支付\n\n請掃描以下 QR Code 完成付款：\n${JKO_QR_CODE_URL}\n\n付款完成後請提供截圖給我們確認，謝謝！`
- `payment:transfer` = `🏦 銀行轉帳\n\n銀行代碼：007（第一銀行）\n帳號：23257030422\n\n戶名：雞味研究所\n\n轉帳完成後請提供截圖給我們確認，謝謝！`
- `payment:linepay` = `💳 LINE Pay 付款\n\nLINE Pay code 請稍候由 LINE Pay 專員確認，會主動聯繫您。\n\n如有疑問，請透過 LINE 與我們聯繫，謝謝！`

### 6.3 部署 + 驗證

- 部署 Worker（wrangler deploy）
- 設定 KV 三個 key
- 客戶說「街口」→ 收到 QR Code URL + 說明
- 客戶說「轉帳」→ 收到銀行帳號
- 客戶說「Line Pay」→ 收到轉真人訊息

---

## 7. D5：通知管理員而非顧客 🔴

### 7.1 根因

**現況（已驗證）：**
- `src/handoff/notifier.js` 是正確的：呼叫 LINE Push Message API（POST `/v2/bot/message/push`），目標是 `HUBERT_LINE_USER_ID`
- Push API 與 Reply API 不同：Push 主動推送給特定 userId，Reply 是回覆當前對話用戶

**但 Hubert 報告：**
> 客服輸出的`AI客服轉報通知`、`緊急轉報`的目的地錯誤(傳送到顧客)

**可能原因：**
- 雖然 `notifier.js` 是 Push API，但雞肉專案 `src/` 在 production 沒跑
- OpenClaw agent 自己的 LLM 邏輯可能把「通知管理員」當成「回覆當前對話」（因為 LLM 看到 handoff 就直接回覆用戶端）
- 雞肉專案設計正確，但 OpenClaw runtime 沒用，所以 handoff 通知機制壞了

### 7.2 修法

**短期（修 prompt）：**

**檔案：`~/.openclaw/agents/external-user/knowledge/main_idea.md`**

新增「十一、通知管理員（Hubert）守則」章節：
```markdown
## 十一、通知管理員（Hubert）守則

當觸發轉真人（handoff）時，**必須同時執行兩個動作**：

### 動作 1：回覆客戶（制式話術）

> 「感謝您的提問！您的問題已轉交給老闆處理，將儘快回覆您，請留意 LINE 通知，謝謝！ 🐔」

這是「回覆當前對話的客戶」（reply message）。

### 動作 2：通知 Hubert（用 Push Message，不是回覆）

- **使用 Push Message**（不是 Reply）
- **目標是 Hubert 的 LINE user_id**：`Uf56650056d35626deb64165926a26182`
- 通知內容包含：客戶名稱、問題摘要、訂單 ID（如果有）

### 禁止事項

- ❌ **不要把通知 Hubert 的內容發給客戶**
- ❌ **不要把制式話術「已轉交老闆」當作 Push 內容**
- ❌ **不要把 AI 客服轉報通知 / 緊急轉報當作 Reply 訊息**

### 範例（正確）

客戶：「我要退款」
1. 回覆客戶：「感謝您的提問！您的問題已轉交給老闆處理，將儘快回覆您，請留意 LINE 通知，謝謝！ 🐔」
2. Push 給 Hubert：「🔔 【退款】客戶王小明說：『我要退款』，order_id: PENDING-xxx」

### 範例（錯誤）

- ❌ 把 Push 內容「🔔 【退款】客戶王小明說：...」當作 Reply 給客戶
- ❌ 把制式話術當作 Push 給 Hubert（Hubert 會以為是客戶訊息）
```

**長期（修程式碼，後續）：**
- 在 `src/handoff/notifier.js` 改為更精準的 function（確保不混淆）
- 確認 `notificationFormat.js` 訊息區分為「客戶話術」與「管理員通知」兩個不同函式

### 7.3 驗證

- 觸發 handoff → 確認**客戶**收到「感謝您的提問...」reply
- 確認 **Hubert** 收到「🔔 【XX】客戶...」Push
- 兩者訊息內容不同，目的地不同

---

## 8. D6：CSV 沒寫入（核心問題）🔴

### 8.1 根因

**Hubert 描述：**
> 我有透過朋友的 Line 嘗試訂購訂單，但是訂單貌似沒有進入CSV檔案

**現況：**
- 朋友 U117a0f0c89dcb4084df3c983bd863524 的訂單**完全沒寫入** CSV
- 只有 6/13 的 21 筆 PENDING 測試資料（從 `2026-06-13.csv` 來看）

**根因分析：**
- 雞肉專案 `src/order/csvWriter.js` 有 `writeOrder` 函式
- `src/states/awaitingPayment.js` 與 `src/states/completed.js` 有呼叫 `writeOrder`
- **但 src/ 在 production 沒跑！**
- 實際執行的是 OpenClaw agent 的 LLM 邏輯
- LLM 邏輯**不會自己呼叫** `writeOrder`（因為它根本不知道這個函式存在）

**Hubert 擔心：**
> 經過 prompt 後資料有機率會變動

**這是真的**：LLM 透過 prompt 指示輸出的 JSON 格式，可能會有幻覺或格式錯誤。

### 8.2 修法（推薦：短期 A + 為長期 C 預留）

**短期 A：標準化 JSON 格式 + 後台 listener**

步驟 1：在 `main_idea.md` 定義「標準訂單 JSON 格式」
步驟 2：後台 listener 監聽 LLM 輸出，自動呼叫 `writeOrder`
步驟 3：listener 失敗時通知 Hubert（不依賴 LLM 正確輸出）

**檔案 1：`~/.openclaw/agents/external-user/knowledge/main_idea.md`**

新增「十二、訂單寫入機制」章節（緊接 D2 的「十、訂單流程 SOP」）：
```markdown
## 十二、訂單寫入機制

### 標準訂單 JSON 格式

完成訂單確認時，**請嚴格使用以下 JSON 格式**輸出（後台 listener 會自動寫入 CSV）：

\`\`\`json
{
  "action": "write_order",
  "data": {
    "user_line_name": "王小明",
    "user_phone": "0912345678",
    "address": "新北市三峽區...",
    "community": "社區名稱",
    "delivery_date": "2026-06-16",
    "time_slot": "上午",
    "chicken_items": {"鹽水雞": 1},
    "side_items": {},
    "extra_items": {},
    "subtotal": 380,
    "delivery_fee": 0,
    "total_amount": 380,
    "payment_method": "待定",
    "payment_status": "pending",
    "order_status": "confirmed",
    "customer_notes": "備註"
  }
}
\`\`\`

### 付款更新格式

付款確認時，輸出：
\`\`\`json
{
  "action": "update_payment",
  "data": {
    "order_id": "PENDING-xxx",
    "payment_status": "paid"
  }
}
\`\`\`

### ⚠️ 重要提醒

- **JSON 格式錯誤會被後台 listener 拒絕**，訂單不會寫入
- **請嚴格按照格式輸出**，不要加任何多餘文字
- **如果資料不完整**（如缺電話），請在寫入前先詢問客戶補齊
```

**檔案 2：`scripts/order-listener.js`（新增）**

```js
'use strict';

/**
 * 訂單 Listener
 * 監聽 LLM 輸出，自動解析 JSON 並寫入 CSV
 * 
 * 運作方式：
 * 1. 從 OpenClaw sessions 目錄讀取最新的 assistant output
 * 2. 解析包含 "action": "write_order" 或 "update_payment" 的 JSON
 * 3. 呼叫對應的雞肉專案函式
 * 4. 失敗時發 LINE Push 給 Hubert
 */

const fs = require('fs');
const path = require('path');
const { writeOrder, updateOrder } = require('../src/order/csvWriter');
const { getOrdersByDate } = require('../src/order/csvReader');

// 從環境變數取得 OpenClaw sessions 目錄
const SESSIONS_DIR = process.env.OPENCLAW_SESSIONS_DIR || 
                     '/home/clawuser/.openclaw/agents/external-user/sessions/';

// 簡單實作：定期檢查新 session
// TODO: 改為 OpenClaw hook 觸發
setInterval(() => {
  // ... 實作略
}, 5000);
```

**為長期 C 預留介面：**

**檔案 3：`src/order/csvWriter.js`**

新增 `writeOrderStructured` 與 `updatePaymentStructured` 函式（從 LLM 輸出 JSON 直接呼叫）：
```js
function writeOrderStructured(orderJson) {
  // 驗證 JSON 格式
  if (typeof orderJson !== 'object' || !orderJson.action || !orderJson.data) {
    throw new Error('Invalid order JSON format');
  }
  if (orderJson.action === 'write_order') {
    return writeOrder(orderJson.data);
  } else if (orderJson.action === 'update_payment') {
    return updateOrder(orderJson.data.order_id, { payment_status: orderJson.data.payment_status });
  } else {
    throw new Error(`Unknown action: ${orderJson.action}`);
  }
}
```

### 8.3 驗證

- 朋友 U117a0f0c89... 重發訂單訊息
- LLM 輸出標準 JSON 格式
- 後台 listener 自動解析並寫入 CSV
- 確認 `data/orders/chicken/{date}.csv` 有新資料

---

## 9. 階段 1+2 執行總結

### 9.1 修改檔案清單

| 檔案 | 修改內容 |
|------|---------|
| `~/.openclaw/agents/external-user/SOUL.md` | 移除「AI 客服」字眼，標題改為「客服『小雞』」|
| `~/.openclaw/agents/external-user/AGENTS.md` | 移除「AI」描述 |
| `~/.openclaw/agents/external-user/knowledge/main_idea.md` | 開頭改為服務專員、新增 D1/D2/D5/D6 章節 |
| `config/tenants/chicken.yaml` | 配送範圍改「三鶯生活圈」|
| `knowledge/tenants/chicken/04_delivery.md` | 保留具體清單，標題改「三鶯生活圈」|
| `~/openclaw-workspace/external-user/cloudflare-worker/src/index.ts` | 分類 KV 處理付款關鍵字 |
| `src/states/awaitingPayment.js` | 提前寫 CSV |
| `src/states/completed.js` | 新增付款證明階段 |
| `src/order/csvWriter.js` | 新增 writeOrderStructured |
| `src/handoff/notifier.js` | （可能）新增更精準的 function |
| `tests/order-flow.test.js` | 新增測試 |
| `tests/payment.test.js` | 新增測試 |

### 9.2 KV 設定

| KV Key | 內容 |
|--------|------|
| `payment:jko` | 街口 QR Code + 說明 |
| `payment:transfer` | 銀行帳號 + 說明 |
| `payment:linepay` | LINE Pay 轉真人訊息 |

### 9.3 環境變數設定

| 變數 | 值 |
|------|-----|
| `JKO_QR_CODE_URL` | `https://pub-ce7f744c6a2145a4a3277e8ed2c3f8fd.r2.dev/Payment/...QRcode.jpg` |

### 9.4 部署步驟

1. 修 OpenClaw prompt 檔案（不需要重啟，立即生效）
2. 修改 config.yaml、knowledge/04_delivery.md
3. 修改 src/ 程式碼 + 測試
4. 設定 Worker KV（`payment:jko`、`payment:transfer`、`payment:linepay`）
5. 部署 Worker（`wrangler deploy`）
6. 啟動 order-listener（後台 listener）

### 9.5 驗證清單

- [ ] C1：grep SOUL.md 無「AI 客服」字眼
- [ ] C2：對話測試感受服務專員語氣
- [ ] D1：客戶問開團日 → AI 回應正確
- [ ] D2：模擬完整流程，CSV 在步驟 3 就有資料
- [ ] D3：客戶問配送 → AI 回應「三鶯生活圈」
- [ ] D4：客戶說「街口」→ 收到 QR Code URL
- [ ] D5：觸發 handoff → 確認客戶收 reply、Hubert 收 push
- [ ] D6：朋友 U117... 重發訂單 → CSV 有新資料
- [ ] 8 套測試全綠

---

## 10. 待 Hubert 確認的決策

1. **D1 方案**：短期 A（prompt 嵌入）+ 為 B 預留介面 ✅
2. **D2 流程**：客戶確認訂單就寫 CSV（payment_status: pending）✅
3. **D3 配送範圍**：改「三鶯生活圈」✅
4. **D4 街口支付**：分類 KV（jko/transfer/linepay）✅
5. **D5 通知管理員**：短期修 prompt，強調 Push vs Reply ✅
6. **D6 CSV 寫入**：短期 A（prompt 標準格式 + 後台 listener）✅
7. **範圍**：8 項全部做（階段 1+2）✅
8. **後台 listener 是否需要立即實作**：短期 A 必需要，否則 D6 修不完整

---

_本檔案由 brtclaw 於 2026-06-15 08:00 規劃完成，等 Hubert 檢查後再 execute_
