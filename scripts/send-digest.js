#!/usr/bin/env node
'use strict';

/**
 * send-digest.js — 訂單彙總日報/週報排程腳本（Session P0 v6 — 2026-07-18）
 *
 * 用途：每日 23:00 寄當日訂單彙總、週日 10:00 寄本週彙總
 * 觸發：openclaw cron（`openclaw cron add` 設定）
 *
 * 用法：
 *   node scripts/send-digest.js daily   # 寄當日訂單彙總
 *   node scripts/send-digest.js weekly  # 寄本週訂單彙總
 *
 * 設計：
 *   - 讀取 data/orders/{tenant}/{YYYY-MM-DD}.csv
 *   - 解析 CSV → orders 陣列
 *   - 呼叫 emailNotifier.sendOrderDigest
 *   - digest_to 從 chicken.yaml email.digest_to 讀取
 *
 * 排程設定見 chicken.yaml → email.digest_schedule：
 *   daily:  '0 23 * * *'   # 每日 23:00 Asia/Taipei
 *   weekly: '0 10 * * 0'   # 週日 10:00 Asia/Taipei
 */

const fs = require('fs');
const path = require('path');
const { sendOrderDigest } = require('../src/handoff/emailNotifier');
const logger = require('../src/utils/logger');

const TENANT = process.env.TENANT_ID || 'chicken';
const DATA_DIR = path.join(__dirname, '..', 'data', 'orders', TENANT);

/**
 * 取得 Asia/Taipei 當天的 YYYY-MM-DD 字串
 */
function getTodayStr() {
  const now = new Date();
  // 用 sv-SE locale 拿到 ISO 格式，再切日期
  const taipeiStr = now.toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' });
  return taipeiStr.slice(0, 10);
}

/**
 * 取得本週所有日期（週日到週六，含當天）
 */
function getThisWeekDates() {
  const dates = [];
  const now = new Date();
  const taipeiStr = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const dayOfWeek = taipeiStr.getDay(); // 0=週日, 6=週六
  const sunday = new Date(taipeiStr);
  sunday.setDate(taipeiStr.getDate() - dayOfWeek);
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const isoStr = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Taipei' })).toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' });
    dates.push(isoStr.slice(0, 10));
  }
  return dates;
}

/**
 * 簡易 CSV 解析（支援引號、逗號）
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * 載入指定日期的所有訂單（從多個 CSV 合併）
 * @param {string[]} dates
 * @returns {object[]}
 */
function loadOrders(dates) {
  const allOrders = [];
  for (const date of dates) {
    const filePath = path.join(DATA_DIR, `${date}.csv`);
    if (!fs.existsSync(filePath)) {
      logger.warn(`[send-digest] ${date}.csv 不存在，跳過`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim());
    if (lines.length < 2) {
      logger.warn(`[send-digest] ${date}.csv 只有 header，無訂單`);
      continue;
    }
    const headers = parseCsvLine(lines[0]);
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      if (values.length !== headers.length) {
        logger.warn(`[send-digest] ${date}.csv 第 ${i+1} 行欄位數不符，跳過`);
        continue;
      }
      const order = {};
      headers.forEach((h, idx) => {
        order[h] = values[idx];
      });
      allOrders.push(order);
    }
  }
  return allOrders;
}

async function main() {
  const mode = process.argv[2] || 'daily';
  if (!['daily', 'weekly'].includes(mode)) {
    console.error('用法: node scripts/send-digest.js [daily|weekly]');
    process.exit(1);
  }

  let dates, label;
  if (mode === 'daily') {
    dates = [getTodayStr()];
    label = '今日';
  } else {
    dates = getThisWeekDates();
    label = '本週';
  }

  logger.info(`[send-digest] 開始載入 ${label} 訂單 (${dates.length} 天: ${dates.join(', ')})`);
  const orders = loadOrders(dates);
  logger.info(`[send-digest] 載入 ${orders.length} 筆訂單`);

  if (orders.length === 0) {
    logger.warn(`[send-digest] ${label} 無訂單，跳過寄送`);
    return;
  }

  try {
    const result = await sendOrderDigest({ orders, type: mode });
    if (result.success) {
      logger.info(`[send-digest] ${label} 訂單彙總寄送成功`);
      console.log(JSON.stringify({ success: true, mode, count: orders.length, dates }, null, 2));
    } else {
      logger.error(`[send-digest] 寄送失敗: ${result.error || '未知錯誤'}`);
      console.error(JSON.stringify({ success: false, error: result.error }, null, 2));
      process.exit(1);
    }
  } catch (e) {
    logger.error(`[send-digest] 寄送異常: ${e.message}`);
    console.error(JSON.stringify({ success: false, error: e.message }, null, 2));
    process.exit(1);
  }
}

main();
