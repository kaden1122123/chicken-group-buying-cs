'use strict';

/**
 * D4-7 測試：驗證 storage.phase2.enabled flag stub 防誤啟用
 *
 * 背景：
 * - chicken.yaml 的 storage.phase2.enabled 控制「Phase 2 = Google Sheets 寫入」
 * - Phase 2 是「未來」功能，目前 src/ 完全沒有 Google Sheets 程式碼
 * - 若雞味老闆不小心設 enabled = true，會以為有啟用但實際沒作用（靜默失敗）
 * - Session D4-7 修整：在 csvWriter.js 加 stub，啟用時拋明確錯誤
 *
 * 測試情境：
 * 1. csvWriter.js 含 storage.phase2.enabled 檢查（防 regression）
 * 2. 錯誤訊息明確說「未實作」+ 提示如何修正
 * 3. chicken.yaml 確實定義了 storage.phase2.enabled = false（防誤啟用目前設定）
 * 4. config.js 的 FEATURE_FLAGS 包含 storage.phase2.enabled
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n=== D4-7: storage.phase2.enabled stub 測試 ===');

const CSV_WRITER_PATH = path.join(__dirname, '..', 'src', 'order', 'csvWriter.js');
const CONFIG_PATH = path.join(__dirname, '..', 'src', 'config.js');
const CHICKEN_YAML_PATH = path.join(__dirname, '..', 'config', 'tenants', 'chicken.yaml');
const csvWriterSource = fs.readFileSync(CSV_WRITER_PATH, 'utf8');
const configSource = fs.readFileSync(CONFIG_PATH, 'utf8');
const chickenYaml = fs.readFileSync(CHICKEN_YAML_PATH, 'utf8');

console.log('\n--- 1. csvWriter.js 包含 storage.phase2.enabled 檢查 ---');
assert.ok(
  csvWriterSource.includes("isFeatureEnabled('storage.phase2.enabled')"),
  'csvWriter.js 應檢查 storage.phase2.enabled',
);
console.log('  ✓ csvWriter.js 有 storage.phase2.enabled 檢查');

console.log('\n--- 2. 錯誤訊息明確（「未實作」+ 修正提示）---');
assert.ok(
  /尚未實作|未實作|not implemented/i.test(csvWriterSource),
  '錯誤訊息應明確說「未實作」',
);
assert.ok(
  /storage\.phase2\.enabled 應設為 false/.test(csvWriterSource),
  '錯誤訊息應提示「應設為 false」',
);
console.log('  ✓ 錯誤訊息明確（未實作 + 修正提示）');

console.log('\n--- 3. chicken.yaml 定義 storage.phase2.enabled = false ---');
assert.ok(
  /phase2:[\s\S]*?enabled:\s*false/.test(chickenYaml),
  'chicken.yaml 應定義 storage.phase2.enabled = false',
);
console.log('  ✓ chicken.yaml storage.phase2.enabled = false（預設安全）');

console.log('\n--- 4. config.js FEATURE_FLAGS 包含 storage.phase2.enabled ---');
assert.ok(
  configSource.includes("'storage.phase2.enabled'"),
  'config.js FEATURE_FLAGS 應包含 storage.phase2.enabled',
);
console.log('  ✓ config.js FEATURE_FLAGS 已暴露 storage.phase2.enabled');

console.log('\n--- 5. 完整 stub 邏輯（檢查在 phase1 後、ensureDataDir 前）---');
// 取得 phase1 check 後到 ensureDataDir() 前的程式碼區段
const phase1Match = csvWriterSource.match(/storage\.phase1\.enabled[\s\S]{0,200}throw new Error[\s\S]{0,200}\}/);
const phase2Match = csvWriterSource.match(/storage\.phase2\.enabled[\s\S]{0,300}throw new Error[\s\S]{0,200}\}/);
assert.ok(phase1Match, 'phase1 check 應存在');
assert.ok(phase2Match, 'phase2 check 應存在');
assert.ok(phase1Match.index < phase2Match.index, 'phase2 check 應在 phase1 之後');
console.log('  ✓ phase2 check 在 phase1 之後執行');

console.log('\n=== D4-7 測試: ALL PASSED ✓ ===');
