'use strict';

/**
 * 雞肉團購客服 — 結構化 Logger（Session K1）
 *
 * API：
 *   logger.debug(msg, meta?)
 *   logger.info(msg, meta?)
 *   logger.warn(msg, meta?)
 *   logger.error(msg, meta?)
 *
 * 設計：
 * - 輸出格式：JSON（timestamp + level + msg + meta）
 * - Log level 從 process.env.LOG_LEVEL 讀取（預設 'info'）
 *   LOG_LEVEL=debug 時全部輸出
 *   LOG_LEVEL=info 時 debug 不輸出
 *   LOG_LEVEL=warn 時 info/debug 不輸出
 *   LOG_LEVEL=error 時只輸出 error
 * - level 30+（warn/error）走 process.stderr，其餘走 stdout
 * - meta 是 object 會被 spread 進 output entry（不為 object 時忽略）
 * - 不破壞既有 console.log 用法，但**生產環境推薦全部改用 logger**
 *
 * 為什麼不用第三方（pino / winston）？雞味客服規模小，多一層依賴不划算。
 *
 * Session X3-B 新增：
 * - 可選寫入日志檔案 daily JSON Lines
 * - 環境變數 LOG_DIR（預設不寫檔）
 * - 只寫 warn/error（info/debug 只走 stdout/stderr）
 */

const fs = require('fs');
const path = require('path');

const LEVEL_MAP = { debug: 10, info: 20, warn: 30, error: 40 };

const LOG_DIR = process.env.LOG_DIR || null;
let _logFilePathToday = null;
let _logFileDateToday = null;

function getLogFilePath() {
  if (!LOG_DIR) return null;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (_logFileDateToday === today && _logFilePathToday) {
    return _logFilePathToday;
  }
  // 改變日期 -> rotate
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    _logFilePathToday = path.join(LOG_DIR, `${today}.log`);
    _logFileDateToday = today;
    return _logFilePathToday;
  } catch (e) {
    // 寫檔失敗不該 shutdown，只 return null
    process.stderr.write(`[logger] log dir not writable: ${e.message}\n`);
    return null;
  }
}

function parseLevel(s) {
  if (typeof s === 'number') return s;
  if (typeof s !== 'string') return 20;
  const lower = s.toLowerCase();
  return LEVEL_MAP[lower] || 20;
}

function levelName(level) {
  if (level >= 40) return 'error';
  if (level >= 30) return 'warn';
  if (level >= 20) return 'info';
  return 'debug';
}

function getThreshold() {
  // 動態讀（測試可以 process.env.LOG_LEVEL = 'debug' 來測）
  return parseLevel(process.env.LOG_LEVEL || 'info');
}

function emit(level, msg, meta) {
  if (level < getThreshold()) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level: levelName(level),
    msg: (msg === null || msg === undefined) ? '' : (typeof msg === 'string' ? msg : String(msg)),
  };
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    // shallow merge（不覆蓋 timestamp/level/msg）
    for (const key of Object.keys(meta)) {
      if (key === 'timestamp' || key === 'level' || key === 'msg') continue;
      entry[key] = meta[key];
    }
  }
  const line = JSON.stringify(entry);
  // warn/error 走 stderr，其他走 stdout
  if (level >= 30) {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }

  // Session X3-B：寫入 JSON Lines log file（限 warn/error 才寫，避免 disk pressure）
  if (level >= 30) {
    const logFile = getLogFilePath();
    if (logFile) {
      try {
        fs.appendFileSync(logFile, line + '\n', 'utf8');
      } catch (e) {
        // 寫檔失敗 log 到 stderr，不規避主流程
        process.stderr.write(`[logger] file write failed: ${e.message}\n`);
      }
    }
  }
}

module.exports = {
  debug(msg, meta) { emit(10, msg, meta); },
  info(msg, meta) { emit(20, msg, meta); },
  warn(msg, meta) { emit(30, msg, meta); },
  error(msg, meta) { emit(40, msg, meta); },
  // 暴露給測試
  parseLevel,
  levelName,
  getThreshold,
  LEVEL_MAP,
  // Session X3-B：log 路徑
  getLogFilePath,
};
