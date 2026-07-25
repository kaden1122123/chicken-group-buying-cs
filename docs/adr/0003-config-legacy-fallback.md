# ADR-0003: config.yaml 是 Legacy Fallback

> **狀態**：Accepted
> **日期**：2026-06-27（Session C C3）
> **決策者**：Hubert
> **背景文件**：[scripts/sync-config.sh](../../scripts/sync-config.sh), [MULTI_TENANT_DESIGN.md](../MULTI_TENANT_DESIGN.md)

---

## 背景（Context）

雞味客服有兩個 YAML 設定檔：

| 檔案 | 角色 |
|------|------|
| `config/tenants/chicken.yaml` | **Single source of truth**（多租戶設計）|
| `config.yaml` | Legacy fallback（向後相容用）|

新環境沒有 `chicken.yaml` 時，系統需要 fallback 機制避免整個崩潰。

## 決策（Decision）

**保留 `config.yaml` 作為 legacy fallback，內容由 `scripts/sync-config.sh` 從 chicken.yaml 同步產生。**

修改設定流程：
1. 改 `config/tenants/chicken.yaml`
2. 跑 `bash scripts/sync-config.sh`
3. 自動同步到 `config.yaml`

`src/config.js` 的 `resolveConfigPath()` 動態決定讀哪個：
- 優先讀 `config/tenants/{TENANT_ID}.yaml`
- 不存在時 fallback 到 `config.yaml`

## 理由

- **避免新環境崩潰**：沒 chicken.yaml 時仍能用 config.yaml 啟動
- **Single source of truth**：chicken.yaml 是「真」，config.yaml 是「影子」
- **不增加複雜度**：sync-config.sh 是單向 sync，加備份與 diff 驗證

## 後果（Consequences）

### 正面

- 設定修改只有一個地方（chicken.yaml）
- 新環境不會因缺 chicken.yaml 而崩潰
- 多租戶規模化時，chicken.yaml 是單一來源

### 負面

- ⚠️ **兩檔案內容可能漂移**（如果直接改 config.yaml 而沒跑 sync）
- ⚠️ **有些欄位只在 chicken.yaml 有**（如 `tenant.id`、`order.field_sequence`）config.yaml 缺這些時 fallback 會出錯

### 緩解

- `scripts/sync-config.sh` 有備份機制（覆蓋前備份）
- config.yaml 開頭明確標註「legacy fallback，請改 chicken.yaml」
- Session J 計畫整合 cleanup helper（PRODUCTION_DATA_PROTECTED）

---

## 補充（2026-07-15）— Drift 預防 SOP

### 問題回顧

2026-07-15 audit 發現 config.yaml 從未被 sync-config.sh 同步過，遺漏：

- `tenant:` section（Session C C3 引入，2026-06-27）
- `delivery.delivery_fee_short_fallback: 80`（Session D3-2 引入）
- `delivery.areas.allowed` 詳細清單「三峽、鶯歌」（Session D3-3 引入）

若 production 環境被降級 fallback 到 `config.yaml`，上述 3 個 Session D3 修整的特性會失效，客戶地址「三峽區」會被誤判為不在配送範圍。

### 預防 SOP（每次改 chicken.yaml 後必跑）

1. **改 chicken.yaml**
2. **立即跑**：`bash scripts/sync-config.sh`（單向鏡像，自動備份 config.yaml → `config.yaml.bak.YYYYMMDD-HHMMSS`）
3. **驗證**：`diff <(grep -v "^#" config/tenants/chicken.yaml) <(grep -v "^#" config.yaml)` 應該無差異（允許 open_dates 日期、ad-hoc 註解等非同步差異）
4. **commit**：`git add -A` + commit（`config.yaml.bak.*` 由 `.gitignore` 排除不會污染 git）

### CI/CD 自動化（Check 9 — Decision 2B）

`scripts/check-quality.sh` Check 9 自動掃：

- **mtime 檢查**：`config.yaml` mtime 必須 ≥ `config/tenants/chicken.yaml` mtime（保證 sync 後才 commit）
- **missing keys 檢查**：`chicken.yaml` 所有 top-level keys 必須出現在 `config.yaml`（防 fallback 功能缺漏）
- **檔案存在性**：兩檔都必須存在才比對
- **緩解強度**：warn 不 fail（不擋 commit 流程）

### backup 政策（Decision 3B）

- `config.yaml.bak.*` 自動產生，**`.gitignore` 排除**（不留 git 雜訊）
- 真的要回退時，從本機端 `cp config.yaml.bak.YYYYMMDD-HHMMSS config.yaml` 即可

---

_本 ADR 防止接手者直接改 config.yaml 造成 drift（v2: 加 drift 預防 SOP + Check 9 + backup 政策）_
