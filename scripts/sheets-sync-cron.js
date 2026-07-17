#!/usr/bin/env node
'use strict';

/**
 * sheets-sync-cron.js — Google Sheets 同步排程腳本（Session P0 v6 — 2026-07-18）
 *
 * 用途：每日 03:00 自動同步所有訂單 CSV → Google Sheets
 * 觸發：openclaw cron（`openclaw cron add` 設定）
 *
 * 用法：
 *   node scripts/sheets-sync-cron.js          # 執行同步
 *   node scripts/sheets-sync-cron.js dryRun  # 只檢查不寫入
 *
 * 前置：見 scripts/setup-google-sheets.sh
 *   - GCP service account JSON：/home/clawuser/.config/chicken/secrets/google-service-account.json
 *   - chicken.yaml storage.phase2.enabled = true
 *   - chicken.yaml storage.phase2.spreadsheet_id = <spreadsheet_id>
 *   - Sheets API 已啟用 + Sheets 已分享給 service account email
 *
 * 設計：
 *   - 包裝 src/storage/sheetsSync.js syncOrdersToSheets
 *   - 加上 cron 環境的錯誤處理 + 結構化 log
 *   - 支援 --dryRun 模式（驗證用）
 */

const { syncOrdersToSheets } = require('../src/storage/sheetsSync');
const logger = require('../src/utils/logger');

async function main() {
  const isDryRun = process.argv.includes('dryRun') || process.argv.includes('--dry-run');
  const startTime = Date.now();

  logger.info(`[sheets-sync-cron] 開始${isDryRun ? '（dryRun 模式）' : ''}`);

  try {
    const result = await syncOrdersToSheets({ dryRun: isDryRun });
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (result.success) {
      logger.info(`[sheets-sync-cron] 同步成功，耗時 ${elapsed}s`, {
        updatedRows: result.updatedRows,
        totalOrders: result.totalOrders,
        spreadsheetId: result.spreadsheetId,
      });
      console.log(JSON.stringify({
        success: true,
        dryRun: isDryRun,
        elapsedSec: elapsed,
        ...result,
      }, null, 2));
    } else {
      logger.error(`[sheets-sync-cron] 同步失敗: ${result.error}`);
      console.error(JSON.stringify({
        success: false,
        error: result.error,
        hint: result.hint,
      }, null, 2));
      process.exit(1);
    }
  } catch (e) {
    logger.error(`[sheets-sync-cron] 同步異常: ${e.message}`);
    console.error(JSON.stringify({
      success: false,
      error: e.message,
      stack: e.stack,
    }, null, 2));
    process.exit(1);
  }
}

main();
