'use strict';

const path = require('path');
const fs = require('fs');
const { formatDate, getTodayString } = require('../utils/timeUtils');
const { FILENAME_PATTERN } = require('./csvWriter');

// 規模化：與 csvWriter 共用路徑
const DEFAULT_TENANT = process.env.TENANT_ID || 'chicken';
const ORDERS_ROOT = path.join(__dirname, '../../data/orders');
const TENANT_DATA_DIR = path.join(ORDERS_ROOT, DEFAULT_TENANT);
const LEGACY_DATA_DIR = ORDERS_ROOT;

function resolveDataDir() {
  if (fs.existsSync(TENANT_DATA_DIR)) return TENANT_DATA_DIR;
  return LEGACY_DATA_DIR;
}

const DATA_DIR = resolveDataDir();

/**
 * 取得當日最大流水號
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {number}
 */
function getMaxSequence(dateStr) {
  const filename = FILENAME_PATTERN.replace('{date}', dateStr);
  const csvPath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(csvPath)) return 0;

  try {
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.trim().split('\n').filter((l) => l.length > 0);
    let maxSeq = 0;
    for (const line of lines) {
      const cols = line.split(',');
      if (cols[0] && cols[0].startsWith('ORD-')) {
        const seq = parseInt(cols[0].split('-').pop()) || 0;
        if (seq > maxSeq) maxSeq = seq;
      }
    }
    return maxSeq;
  } catch (e) {
    return 0;
  }
}

/**
 * 產生新訂單編號
 * 格式：ORD-YYYYMMDD-XXX（例：ORD-20260612-001）
 * @returns {string}
 */
function generateOrderId() {
  const today = getTodayString().replace(/-/g, ''); // YYYYMMDD
  const dateStr = getTodayString();
  const maxSeq = getMaxSequence(dateStr);
  const nextSeq = maxSeq + 1;
  return `ORD-${today}-${String(nextSeq).padStart(3, '0')}`;
}

/**
 * 產生待轉交的暫掛訂單編號
 * @returns {string}
 */
function generatePendingOrderId() {
  const ts = Date.now();
  return `PENDING-${ts}`;
}

module.exports = {
  generateOrderId,
  generatePendingOrderId,
  getMaxSequence,
};
