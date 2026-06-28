# ADR-0003: config.yaml 是 Legacy Fallback

> **狀態**：Accepted
> **日期**：2026-06-27（Session C C3）
> **決策者**：Hubert
> **背景文件**：[scripts/sync-config.sh](../../scripts/sync-config.sh), [MULTI_TENANT_DESIGN.md](../../MULTI_TENANT_DESIGN.md)

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

_本 ADR 防止接手者直接改 config.yaml 造成 drift_
