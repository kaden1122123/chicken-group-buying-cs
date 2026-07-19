#!/usr/bin/env node
/**
 * scripts/check-ignored-keywords-sync.js
 *
 * 用途：自動檢查 Worker src/index.ts 的 DEFAULT_IGNORED_KEYWORDS 與
 *       chicken.yaml 的 ignored_keywords 是否同步（防止 drift）
 *
 * Round 14 (2026-07-19 23:38) 新增：Hubert 要求自動同步機制
 *
 * 對齊：scripts/check-quality.sh Check 11
 *       docs/SYSTEM_AUDIT_2026-07-19.md §3.4
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORKER_INDEX = '/home/clawuser/openclaw-workspace/external-user/cloudflare-worker/src/index.ts';
const CHICKEN_YAML = path.join(ROOT, 'config/tenants/chicken.yaml');

// 讀 Worker 的 DEFAULT_IGNORED_KEYWORDS
function readWorkerKeywords() {
  if (!fs.existsSync(WORKER_INDEX)) {
    console.error('Worker index.ts 不存在：' + WORKER_INDEX);
    return [];
  }
  const content = fs.readFileSync(WORKER_INDEX, 'utf8');
  const match = content.match(/const DEFAULT_IGNORED_KEYWORDS = \[([\s\S]*?)\];/);
  if (!match) {
    console.error('DEFAULT_IGNORED_KEYWORDS 找不到於 ' + WORKER_INDEX);
    return [];
  }
  const arrayContent = match[1];
  const keywords = [];
  // 匹配帶引號的字串
  const regex = /'([^']*)'/g;
  let m;
  while ((m = regex.exec(arrayContent)) !== null) {
    keywords.push(m[1]);
  }
  return keywords;
}

// 讀 chicken.yaml 的 ignored_keywords
function readConfigKeywords() {
  if (!fs.existsSync(CHICKEN_YAML)) {
    console.error('chicken.yaml 不存在：' + CHICKEN_YAML);
    return [];
  }
  const content = fs.readFileSync(CHICKEN_YAML, 'utf8');
  // 找到 ignored_keywords section
  const match = content.match(/ignored_keywords:[\s\S]*?(?=\n[a-z_]+:|Z)/);
  if (!match) {
    console.error('ignored_keywords 找不到於 ' + CHICKEN_YAML);
    return [];
  }
  const section = match[0];
  const keywords = [];
  // 匹配 YAML list item: "- 我要訂購" 或 '- "我要訂購"'
  // 用更寬鬆的 regex，支援引號或無引號
  const lines = section.split('\n');
  for (const line of lines) {
    // 匹配 "  - keyword" 或 '  - "keyword"' 或 "  - 'keyword'"
    const m = line.match(/^\s*-\s+['"]?([^'"]+?)['"]?\s*$/);
    if (m && m[1] && !m[1].startsWith('ignored_keywords')) {
      keywords.push(m[1]);
    }
  }
  return keywords;
}

// 比對
function compare(workerKeywords, configKeywords) {
  const workerSet = new Set(workerKeywords);
  const configSet = new Set(configKeywords);

  const onlyInWorker = [...workerSet].filter((k) => !configSet.has(k));
  const onlyInConfig = [...configSet].filter((k) => !workerSet.has(k));

  return { onlyInWorker, onlyInConfig };
}

function main() {
  const workerKeywords = readWorkerKeywords();
  const configKeywords = readConfigKeywords();

  console.log('Worker DEFAULT_IGNORED_KEYWORDS (' + workerKeywords.length + '):');
  workerKeywords.forEach((k) => console.log('  - ' + k));
  console.log('');
  console.log('chicken.yaml ignored_keywords (' + configKeywords.length + '):');
  configKeywords.forEach((k) => console.log('  - ' + k));
  console.log('');

  const { onlyInWorker, onlyInConfig } = compare(workerKeywords, configKeywords);

  if (onlyInWorker.length === 0 && onlyInConfig.length === 0) {
    console.log('OK Ignored Keywords 完全同步（' + workerKeywords.length + ' 個）');
    process.exit(0);
  } else {
    console.error('FAIL Ignored Keywords drift 發現：');
    if (onlyInWorker.length > 0) {
      console.error('  只有 Worker 有 (' + onlyInWorker.length + '）：');
      onlyInWorker.forEach((k) => console.error('    - ' + k));
    }
    if (onlyInConfig.length > 0) {
      console.error('  只有 chicken.yaml 有 (' + onlyInConfig.length + '）：');
      onlyInConfig.forEach((k) => console.error('    - ' + k));
    }
    console.error('');
    console.error('修法：手動同步兩邊');
    process.exit(1);
  }
}

main();
