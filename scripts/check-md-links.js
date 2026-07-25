#!/usr/bin/env node
/**
 * scripts/check-md-links.js
 *
 * 用途：掃描所有 .md 檔的 markdown 連結，檢查相對路徑目標是否仍存在
 * 對應：check-quality.sh Check 12（Round 26 補齊 — 防止 Round 26 之前累積的 link drift）
 * 對齊：docs/KNOWN_ISSUES.md Round 26 audit findings
 *
 * 排除目錄（不檢查）：
 *   - .archive/、archive/、task-state/（已歸檔或 working memory，連結過期是正常的）
 *   - .git/、node_modules/（外部）
 *
 * 排除連結類型（不視為 MISSING）：
 *   - http://、https://（外部 URL）
 *   - #（錨點）
 *   - mailto:（email）
 *   - 跨 repo 路徑（含 /openclaw-workspace/external-user 或 /openclaw-workspace/.openclaw）
 *
 * 用法：
 *   node scripts/check-md-links.js           # 檢查全部，回傳 0/1
 *   node scripts/check-md-links.js --verbose # 列出所有檢查的連結
 *
 * 退出碼：
 *   0 = 0 個 broken links
 *   1 = 有 broken links（列出檔案 + 連結）
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.archive', 'archive', '.git', 'node_modules', 'task-state']);
const VERBOSE = process.argv.includes('--verbose');

function* walkMd(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // 跳過 .archive, .git, .task-state 等
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMd(full);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      yield full;
    }
  }
}

function extractLinks(content) {
  // 抓所有 ](path) 形式
  const re = /\]\(([^)]+)\)/g;
  const links = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    links.push(m[1].trim());
  }
  return links;
}

function shouldSkip(link) {
  if (!link) return true;
  if (link.startsWith('http://') || link.startsWith('https://')) return true;
  if (link.startsWith('#')) return true;
  if (link.startsWith('mailto:')) return true;
  return false;
}

function isExternalRepoLink(target) {
  // 跨 repo 引用（如 /home/clawuser/openclaw-workspace/external-user/ 或 .openclaw）
  return /\/openclaw-workspace\/(external-user|\.openclaw)/.test(target);
}

function main() {
  const missing = [];
  let totalChecked = 0;

  for (const mdPath of walkMd(ROOT)) {
    const rel = path.relative(ROOT, mdPath);
    const content = fs.readFileSync(mdPath, 'utf-8');
    const links = extractLinks(content);

    for (const link of links) {
      if (shouldSkip(link)) continue;
      // 拆掉 #錨點
      const linkPath = link.split('#')[0];
      if (!linkPath) continue;

      const target = path.resolve(path.dirname(mdPath), linkPath);

      if (isExternalRepoLink(target)) {
        if (VERBOSE) console.log(`  [external] ${rel} → ${link}`);
        continue;
      }

      totalChecked++;
      if (fs.existsSync(target)) {
        if (VERBOSE) console.log(`  [ok] ${rel} → ${link}`);
      } else {
        missing.push({ file: rel, link, target: path.relative(ROOT, target) });
      }
    }
  }

  console.log(`\n=== Markdown Link Check ===`);
  console.log(`檢查範圍: ${ROOT}`);
  console.log(`檢查連結: ${totalChecked} 個（已排除 .archive/、.task-state/、跨 repo 引用）`);

  if (missing.length === 0) {
    console.log(`✓ 0 個 broken links`);
    process.exit(0);
  } else {
    console.log(`✗ ${missing.length} 個 broken links：\n`);
    for (const m of missing) {
      console.log(`  ${m.file}`);
      console.log(`    → ${m.link}`);
      console.log(`    (target: ${m.target})`);
      console.log();
    }
    process.exit(1);
  }
}

main();
