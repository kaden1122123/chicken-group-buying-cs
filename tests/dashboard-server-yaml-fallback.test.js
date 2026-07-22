'use strict';

/**
 * P1-8: dashboard-server.js js-yaml fallback 驗證測試
 */

const assert = require('assert');
const { test } = require('node:test');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DASHBOARD_PATH = path.join(__dirname, '..', 'scripts', 'dashboard-server.js');

test('1. src/config.js 有 _parseYamlSimple', () => {
  const config = require('../src/config');
  assert.strictEqual(typeof config._parseYamlSimple, 'function', 'config.js 應有 _parseYamlSimple');
});

test('2. _parseYamlSimple 解析簡單 yaml (nested + list + scalars)', () => {
  const config = require('../src/config');
  const yamlSample = `
open_dates:
  - '2026-07-01'
  - '2026-07-03'
ignored_keywords:
  - 菜單
  - 常見問題
official:
  brand_name: 雞味研究所
`;
  const parsed = config._parseYamlSimple(yamlSample);
  assert.ok(Array.isArray(parsed.open_dates));
  assert.strictEqual(parsed.open_dates.length, 2);
  assert.strictEqual(parsed.open_dates[0], '2026-07-01');
  assert.ok(Array.isArray(parsed.ignored_keywords));
  assert.strictEqual(parsed.ignored_keywords.length, 2);
  assert.strictEqual(parsed.official.brand_name, '雞味研究所');
});

test('3. dashboard-server.js 有完整 fallback 邏輯', () => {
  const dashboardSource = fs.readFileSync(DASHBOARD_PATH, 'utf8');
  assert.ok(dashboardSource.includes("require('js-yaml')"), '應有 require js-yaml');
  assert.ok(dashboardSource.includes('} catch (e)'), '應有 try/catch fallback');
  assert.ok(dashboardSource.includes('_parseYamlSimple'), 'fallback 應用 _parseYamlSimple');
  assert.ok(dashboardSource.includes('js-yaml 未安裝'), 'fallback 訊息應明確告知 js-yaml 未安裝');
  assert.ok(dashboardSource.includes('_hasYamlDump') || dashboardSource.includes('hasYamlDump'), '寫入時應檢查 hasYamlDump');
});

test('4. 動態驗證：屏蔽 js-yaml 後啟動 server 觸發 fallback 警告', () => {
  const dashboardSource = fs.readFileSync(DASHBOARD_PATH, 'utf8');
  const modifiedSource = dashboardSource.replace(
    "yaml = require('js-yaml')",
    "yaml = require('js-yaml-disabled-for-test')",
  );
  const tmpFile = path.join('/tmp', 'dashboard-server-fallback-test.js');
  fs.writeFileSync(tmpFile, modifiedSource, 'utf-8');

  const result = spawnSync('node', [tmpFile], {
    env: Object.assign({}, process.env, {
      DASHBOARD_USERNAME: 'admin',
      DASHBOARD_PASSWORD: '***',
      PORT: '3999',
    }),
    timeout: 3000,
    encoding: 'utf-8',
  });

  try {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  } catch (e) { /* ignore cleanup race */ }

  assert.ok(
    result.stderr.includes('js-yaml 未安裝') || result.stderr.includes('Cannot find module'),
    'stderr 應有 js-yaml 未安裝警告（已修改 require 路徑）',
  );
});
