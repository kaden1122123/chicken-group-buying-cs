#!/usr/bin/env node
'use strict';

/**
 * verify-kb-sources.js — 驗證 knowledge base single source of truth
 *
 * 目的（Session X1-D）：
 * 1. 確認 12 個 KB 檔案都存在
 * 2. 確認內容大小 > 0（不是空檔）
 * 3. 確認沒有 2 個 KB 檔案內容完全相同（避免內容重複）
 * 4. 與 knowledge/base/ 對比（若有），確認已無 legacy duplicate
 * 5. 與 knowledge/tenants/chicken/INDEX.md 對比（檔名清單必須一致）
 *
 * 整合：scripts/check-quality.sh Check 8
 *
 * 退出碼：
 *   0 = all checks passed
 *   1 = check failed
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.join(__dirname, '..');
const KB_DIR = path.join(PROJECT_ROOT, 'knowledge', 'tenants', 'chicken');
const INDEX_PATH = path.join(KB_DIR, 'INDEX.md');

// 預期的 12 個 KB 檔案（從 INDEX.md 表格抓）
const EXPECTED_FILES = [
  '01_product.md',
  '02_order_flow.md',
  '03_payment.md',
  '04_delivery.md',
  '05_promotion.md',
  '06_faq.md',
  '07_transfer_rules.md',
  '08_owner_info.md',
  '10_customer_tags.md',
  '11_lead_followup.md',
  '12_reply_examples.md',
];

let pass = 0;
let fail = 0;

function check(label, condition, msg) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.error(`  ✗ ${label} — ${msg}`);
    fail++;
  }
}

console.log('\n=== KB Source of Truth 驗證 (Session X1-D) ===');

// Check 1: 所有預期檔案存在
console.log('\n--- Check 1: 12 個 KB 檔案存在且非空 ---');
const fileHashes = [];
EXPECTED_FILES.forEach((filename) => {
  const filePath = path.join(KB_DIR, filename);
  const exists = fs.existsSync(filePath);
  if (exists) {
    const content = fs.readFileSync(filePath, 'utf8');
    const size = content.length;
    check(`${filename} 存在且非空`, size > 0, `size=${size}`);
    // 計算 hash 用於後續去重檢查
    const hash = crypto.createHash('md5').update(content).digest('hex');
    fileHashes.push({ filename, size, hash });
  } else {
    check(`${filename} 存在`, false, '檔案不存在');
    fileHashes.push({ filename, size: 0, hash: '' });
  }
});

// Check 2: 沒有 2 個檔案內容完全相同
console.log('\n--- Check 2: 沒有內容完全重複的 KB 檔案 ---');
const hashMap = new Map();
let duplicateFound = false;
fileHashes.forEach(({ filename, hash }) => {
  if (!hash) return;
  if (hashMap.has(hash)) {
    check(`無重複：${filename} ≠ ${hashMap.get(hash)}`, false, '內容與其他 KB 檔完全相同');
    duplicateFound = true;
  } else {
    hashMap.set(hash, filename);
  }
});
if (!duplicateFound) {
  check('無內容重複', true, '所有 12 個 KB 檔案內容互不相同');
}

// Check 3: 與 INDEX.md 對比（檔名清單一致）
console.log('\n--- Check 3: 與 INDEX.md 對比 ---');
if (fs.existsSync(INDEX_PATH)) {
  const indexContent = fs.readFileSync(INDEX_PATH, 'utf8');
  let filesInIndex = 0;
  EXPECTED_FILES.forEach((filename) => {
    if (indexContent.includes(filename)) {
      filesInIndex++;
    }
  });
  check(`INDEX.md 列出所有 12 個檔案`, filesInIndex === 11, `got ${filesInIndex}/11`);
} else {
  check('INDEX.md 存在', false, '找不到 INDEX.md');
}

// Check 4: 沒有 legacy knowledge/base/ 殘留
console.log('\n--- Check 4: 沒有 legacy knowledge/base/ 殘留 ---');
const legacyBaseDir = path.join(PROJECT_ROOT, 'knowledge', 'base');
if (fs.existsSync(legacyBaseDir)) {
  const baseFiles = fs.readdirSync(legacyBaseDir).filter((f) => f.endsWith('.md'));
  if (baseFiles.length > 0) {
    // 檢查是否與 tenants/chicken/ 重複
    let legacyDuplicates = 0;
    baseFiles.forEach((baseFile) => {
      const baseContent = fs.readFileSync(path.join(legacyBaseDir, baseFile), 'utf8');
      const baseHash = crypto.createHash('md5').update(baseContent).digest('hex');
      const tenantFile = EXPECTED_FILES.find((ef) => ef === baseFile);
      if (tenantFile) {
        const tenantFileContent = fs.readFileSync(path.join(KB_DIR, tenantFile), 'utf8');
        const tenantHash = crypto.createHash('md5').update(tenantFileContent).digest('hex');
        if (baseHash === tenantHash) {
          check(`base/${baseFile} ≠ tenants/chicken/${tenantFile}`, false, '內容仍重複（未清理）');
          legacyDuplicates++;
        }
      }
    });
    if (legacyDuplicates === 0) {
      check('無 legacy 重複', true, 'knowledge/base/ 與 knowledge/tenants/chicken/ 無重複');
    }
  } else {
    check('knowledge/base/ 為空', true, '已無 legacy 內容');
  }
} else {
  check('knowledge/base/ 已移除', true, '目錄不存在（已清理）');
}

// 結果
console.log(`\n=== 結果: ${pass} 通過 / ${fail + pass} 總計 ===`);
if (fail > 0) {
  console.error(`\n✗ KB Source of Truth 驗證失敗 (${fail} 項)`);
  process.exit(1);
}
console.log(`\n✓ KB Source of Truth 驗證通過\n`);
