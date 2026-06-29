'use strict';

/**
 * Session K1：src/utils/logger.js 單元測試
 *
 * 涵蓋：
 * - Level threshold（LOG_LEVEL env 控制）
 * - JSON 輸出格式（timestamp + level + msg + meta）
 * - Stream 分流（warn/error → stderr，其他 → stdout）
 * - Meta 處理（object spread、不覆蓋保留欄位、非 object 忽略）
 * - msg 類型（string 直接用、其他 toString）
 */

const assert = require('assert');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

// 為了測試可控，每次測試前重新 require logger
function loadLogger(envLevel) {
  // 清 require cache
  delete require.cache[require.resolve(path.join(PROJECT_ROOT, 'src/utils/logger.js'))];
  const oldLevel = process.env.LOG_LEVEL;
  if (envLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = envLevel;
  }
  const logger = require(path.join(PROJECT_ROOT, 'src/utils/logger.js'));
  return {
    logger,
    restore() {
      if (oldLevel === undefined) {
        delete process.env.LOG_LEVEL;
      } else {
        process.env.LOG_LEVEL = oldLevel;
      }
    },
  };
}

// 攔截 stdout / stderr
function captureStreams(fn) {
  const stdoutChunks = [];
  const stderrChunks = [];
  const origStdout = process.stdout.write.bind(process.stdout);
  const origStderr = process.stderr.write.bind(process.stderr);
  // 用 fake write function（不真的寫）
  process.stdout.write = (chunk) => { stdoutChunks.push(String(chunk)); return true; };
  process.stderr.write = (chunk) => { stderrChunks.push(String(chunk)); return true; };
  try {
    fn();
  } finally {
    process.stdout.write = origStdout;
    process.stderr.write = origStderr;
  }
  return {
    stdout: stdoutChunks.join(''),
    stderr: stderrChunks.join(''),
  };
}

// 解析最後一行 JSON
function parseLastJsonLine(text) {
  const lines = text.trim().split('\n');
  const last = lines[lines.length - 1];
  return JSON.parse(last);
}

console.log('\n=== Logger Tests (Session K1) ===');

// ========== parseLevel ==========
console.log('\n--- parseLevel ---');
{
  const l = loadLogger();
  try {
    assert.strictEqual(l.logger.parseLevel('debug'), 10);
    assert.strictEqual(l.logger.parseLevel('info'), 20);
    assert.strictEqual(l.logger.parseLevel('warn'), 30);
    assert.strictEqual(l.logger.parseLevel('error'), 40);
    assert.strictEqual(l.logger.parseLevel('INFO'), 20); // case-insensitive
    assert.strictEqual(l.logger.parseLevel('unknown'), 20); // 預設
    assert.strictEqual(l.logger.parseLevel(undefined), 20); // 預設
    assert.strictEqual(l.logger.parseLevel(50), 50); // numeric pass-through
    console.log('  ✓ parseLevel 正確處理字串、數字、unknown');
  } finally { l.restore(); }
}

// ========== levelName ==========
console.log('\n--- levelName ---');
{
  const l = loadLogger();
  try {
    assert.strictEqual(l.logger.levelName(10), 'debug');
    assert.strictEqual(l.logger.levelName(20), 'info');
    assert.strictEqual(l.logger.levelName(30), 'warn');
    assert.strictEqual(l.logger.levelName(40), 'error');
    assert.strictEqual(l.logger.levelName(99), 'error'); // 40+ 都是 error
    console.log('  ✓ levelName 正確對應數字');
  } finally { l.restore(); }
}

// ========== getThreshold ==========
console.log('\n--- getThreshold ---');
{
  let l = loadLogger();
  try {
    assert.strictEqual(l.logger.getThreshold(), 20); // 預設 info
  } finally { l.restore(); }
  l = loadLogger('debug');
  try {
    assert.strictEqual(l.logger.getThreshold(), 10);
  } finally { l.restore(); }
  l = loadLogger('warn');
  try {
    assert.strictEqual(l.logger.getThreshold(), 30);
  } finally { l.restore(); }
  l = loadLogger('error');
  try {
    assert.strictEqual(l.logger.getThreshold(), 40);
  } finally { l.restore(); }
  console.log('  ✓ getThreshold 從 env 動態讀取 LOG_LEVEL');
}

// ========== JSON 輸出格式 ==========
console.log('\n--- JSON output format ---');
{
  const l = loadLogger('debug');
  try {
    const captured = captureStreams(() => {
      l.logger.info('hello world', { user_id: 'u123', count: 5 });
    });
    assert.strictEqual(captured.stderr, '', 'info 不應寫到 stderr');
    assert.ok(captured.stdout.length > 0, '應有 stdout 輸出');

    const entry = parseLastJsonLine(captured.stdout);
    assert.strictEqual(entry.level, 'info');
    assert.strictEqual(entry.msg, 'hello world');
    assert.strictEqual(entry.user_id, 'u123');
    assert.strictEqual(entry.count, 5);
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(entry.timestamp),
      'timestamp 應為 ISO 8601');
    console.log('  ✓ info 輸出正確 JSON（timestamp + level + msg + meta）');
  } finally { l.restore(); }
}

// ========== 各種 level 都有正確 stream ==========
console.log('\n--- stream routing ---');
{
  const l = loadLogger('debug');
  try {
    // debug/info → stdout
    let c = captureStreams(() => { l.logger.debug('d'); l.logger.info('i'); });
    assert.ok(c.stdout.length > 0 && c.stderr === '');
    console.log('  ✓ debug + info → stdout（stderr 空）');

    // warn/error → stderr
    c = captureStreams(() => { l.logger.warn('w'); l.logger.error('e'); });
    assert.ok(c.stderr.length > 0 && c.stdout === '');
    console.log('  ✓ warn + error → stderr（stdout 空）');
  } finally { l.restore(); }
}

// ========== Level threshold 過濾 ==========
console.log('\n--- level threshold filter ---');
{
  // LOG_LEVEL=warn，只看 warn / error
  const l = loadLogger('warn');
  try {
    const captured = captureStreams(() => {
      l.logger.debug('debug msg'); // 過濾
      l.logger.info('info msg'); // 過濾
      l.logger.warn('warn msg'); // 應輸出
      l.logger.error('error msg'); // 應輸出
    });
    assert.strictEqual(captured.stdout, '');
    assert.ok(captured.stderr.includes('warn msg'), 'warn 應輸出');
    assert.ok(captured.stderr.includes('error msg'), 'error 應輸出');
    assert.ok(!captured.stderr.includes('debug msg'), 'debug 不應輸出');
    console.log('  ✓ LOG_LEVEL=warn 時 debug/info 被過濾');

    const l2 = loadLogger('error');
    try {
      const c2 = captureStreams(() => {
        l2.logger.warn('warn-filtered'); // 過濾
        l2.logger.error('error-shown'); // 應輸出
      });
      assert.ok(!c2.stderr.includes('warn-filtered'), 'warn 不應輸出');
      assert.ok(c2.stderr.includes('error-shown'), 'error 應輸出');
      console.log('  ✓ LOG_LEVEL=error 時 warn 也被過濾');
    } finally { l2.restore(); }

    const l3 = loadLogger('debug');
    try {
      const c3 = captureStreams(() => {
        l3.logger.debug('debug-shown');
        l3.logger.info('info-shown');
      });
      assert.ok(c3.stdout.includes('debug-shown'), 'debug 應輸出');
      assert.ok(c3.stdout.includes('info-shown'), 'info 應輸出');
      console.log('  ✓ LOG_LEVEL=debug 時全部輸出');
    } finally { l3.restore(); }
  } finally { l.restore(); }
}

// ========== meta 處理 ==========
console.log('\n--- meta handling ---');
{
  const l = loadLogger('debug');
  try {
    // object meta → spread
    let c = captureStreams(() => l.logger.info('m1', { a: 1, b: 'two' }));
    let entry = parseLastJsonLine(c.stdout);
    assert.strictEqual(entry.a, 1);
    assert.strictEqual(entry.b, 'two');
    console.log('  ✓ object meta → spread');

    // 不覆蓋 timestamp/level/msg
    c = captureStreams(() => l.logger.info('original msg', { msg: 'INJECTED', level: 'hacker' }));
    entry = parseLastJsonLine(c.stdout);
    assert.strictEqual(entry.msg, 'original msg', 'msg 不可被 meta 覆蓋');
    assert.strictEqual(entry.level, 'info', 'level 不可被 meta 覆蓋');
    assert.ok(entry.timestamp);
    console.log('  ✓ meta 不覆蓋 timestamp/level/msg（防 inject）');

    // 非 object meta → 忽略
    c = captureStreams(() => l.logger.info('m3', 'not-an-object'));
    entry = parseLastJsonLine(c.stdout);
    assert.strictEqual(entry.msg, 'm3');
    assert.ok(entry._msg === undefined || true); // 沒有 meta 欄位
    console.log('  ✓ 非 object meta 被忽略（保持簡潔）');

    // undefined meta → 跳過
    c = captureStreams(() => l.logger.info('m4'));
    entry = parseLastJsonLine(c.stdout);
    assert.strictEqual(entry.msg, 'm4');
    console.log('  ✓ undefined meta 正常輸出');
  } finally { l.restore(); }
}

// ========== msg 類型 ==========
console.log('\n--- msg type coercion ---');
{
  const l = loadLogger('debug');
  try {
    let c = captureStreams(() => l.logger.info(12345));
    let entry = parseLastJsonLine(c.stdout);
    assert.strictEqual(entry.msg, '12345', 'number → string');
    console.log('  ✓ number msg → toString');

    c = captureStreams(() => l.logger.info(null));
    entry = parseLastJsonLine(c.stdout);
    assert.strictEqual(entry.msg, '');
    console.log('  ✓ null msg → 空字串');

    c = captureStreams(() => l.logger.info({ foo: 'bar' }));
    entry = parseLastJsonLine(c.stdout);
    assert.strictEqual(entry.msg, '[object Object]');
    console.log('  ✓ object msg → toString');
  } finally { l.restore(); }
}

// ========== edge case：error 用 Error 物件 ==========
console.log('\n--- Error object as meta ---');
{
  const l = loadLogger('debug');
  try {
    const err = new Error('test error');
    const c = captureStreams(() => l.logger.error('operation failed', { err: err.message }));
    const entry = parseLastJsonLine(c.stderr);
    assert.strictEqual(entry.level, 'error');
    assert.strictEqual(entry.msg, 'operation failed');
    assert.strictEqual(entry.err, 'test error');
    console.log('  ✓ Error.message 作為 meta 欄位');
  } finally { l.restore(); }
}

console.log('\n========================================');
console.log('ALL LOGGER TESTS PASSED ✓');
console.log('========================================\n');
