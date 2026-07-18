# 雞味客服 — Knowledge Base 備份記錄

> 記錄 `knowledge/base/` 的備份，用於 Session C C2 結構性變更。
> 維護者：brtclaw
> 最後更新：2026-06-27

---

## 備份清單

### 2026-07-19：Round 10 H/L 修整 — 重要備份紀錄

| 備份檔案 | 位置 | 大小 | 備份時間 | 用途 |
|----------|------|------|----------|------|
| `AGENTS.md.bak.20260719-034307` | `/home/clawuser/.openclaw/agents/external-user/` | 9583 bytes | 2026-07-19 03:43 | Round 10 同步前備份 AGENTS.md |
| `SOUL.md.bak.20260719-034307` | `/home/clawuser/.openclaw/agents/external-user/` | 13117 bytes | 2026-07-19 03:43 | Round 10 同步前備份 SOUL.md |
| `knowledge/main_idea.md.bak.20260719-034307` | `/home/clawuser/.openclaw/agents/external-user/knowledge/` | 51540 bytes | 2026-07-19 03:43 | Round 10 同步前備份 main_idea.md |

**備份原因**：Round 10 H2 擴展 Check 10 canonical drift 檢查發現 production runtime 跟 docs/production-prompt/ drift 12 天，撰寫 `scripts/sync-canonical.sh` 同步前自動備份。

**驗證方式**：每個 .bak 的 md5 跟 git tracked 的 `docs/production-prompt/2026-07-03/` 對應檔案 md5 一致（已驗證）。

**保留建議**：可保留 30 天（2026-08-19 後清理）。如需提早清理，詳見 `docs/SYSTEM_AUDIT_2026-07-19.md` §6 L2 待處理。

### 2026-06-27：Session C C2 變更前備份

| 備份檔案 | 位置 | 大小 | 備份時間 | 用途 |
|----------|------|------|----------|------|
| `knowledge-base-2026-06-27_pre-C2-deletion.tar.gz` | `/home/clawuser/.openclaw/workspace/.backups/chicken/` | 15,652 bytes | 2026-06-27 20:05 | Session C C2 刪除前完整備份 `knowledge/base/` 12 個檔案 |

**備份內容**（12 個 markdown 檔案）：
- `01_product.md`、`02_order_flow.md`、`03_payment.md`
- `04_delivery.md`、`05_promotion.md`、`06_faq.md`
- `07_transfer_rules.md`、`08_owner_info.md`、`09_order_standard.md`
- `10_customer_tags.md`、`11_lead_followup.md`、`12_reply_examples.md`

**驗證方式**：解開 tarball 後對每個檔案比對 md5sum，與原始 `knowledge/base/` 內檔案一致（12/12 通過）。

**還原指令**（如需回滾 C2 變更）：
```bash
cd /home/clawuser/openclaw-workspace/others/chicken-group-buying-customer-service
tar xzf /home/clawuser/.openclaw/workspace/.backups/chicken/knowledge-base-2026-06-27_pre-C2-deletion.tar.gz
```

---

## 備份位置設計

- **brtclaw 系統級備份目錄**：`/home/clawuser/.openclaw/workspace/.backups/chicken/`
- **為何不放專案內**：避免 git 操作意外影響備份
- **為何不放主位置**：避免 rsync 同步時覆蓋（備份獨立於雙位置架構）
- **命名規則**：`{模組}-{日期}_{用途}.tar.gz`
  - 例：`knowledge-base-2026-06-27_pre-C2-deletion.tar.gz`

---

_本檔由 brtclaw 維護，每次有重要備份時追加記錄_
