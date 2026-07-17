#!/usr/bin/env node
'use strict';

/**
 * gmail-auth.js — Gmail OAuth 2.0 一次性授權腳本
 *
 * 用途：取得 Gmail API 的 refresh_token，存到 XDG secrets。
 * 只需跑一次，除非 revoke token 或換 credentials.json。
 *
 * 使用步驟：
 *   1. 到 GCP console（https://console.cloud.google.com/）
 *   2. 啟用 Gmail API（API & Services → Library → 搜尋 Gmail → Enable）
 *   3. 建立 OAuth 2.0 Client ID：
 *      - APIs & Services → Credentials → Create Credentials → OAuth client ID
 *      - Application type: Desktop app
 *      - Name: 雞味客服 Gmail
 *      - 下載 JSON（不要用 Web application，本地 callback 簡單）
 *   4. 把下載的 JSON 放到：
 *      /home/clawuser/.config/chicken/secrets/gmail-credentials.json
 *   5. 跑：node scripts/gmail-auth.js
 *   6. browser 會自動開啟（或複製 URL 手動開）
 *   7. 登入 clawbrt@gmail.com（或你想用的 Gmail 帳號）
 *   8. 授權「Send email on your behalf」權限
 *   9. 複製授權碼貼回 terminal
 *  10. 完成！refresh_token 存到 /home/clawuser/.config/chicken/secrets/gmail-token.json
 *
 * 詳見 docs/EMAIL_SETUP.md
 */

const readline = require('readline');
const {
  getOAuth2Client,
  loadCredentials,
  saveToken,
  SCOPES,
  CREDENTIALS_PATH,
  TOKEN_PATH,
} = require('../src/handoff/emailNotifier');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('=== Gmail OAuth 授權腳本 ===');
  console.log('');

  // Step 1: 確認 credentials.json 存在
  try {
    loadCredentials();
    console.log(`✓ 找到 credentials: ${CREDENTIALS_PATH}`);
  } catch (e) {
    console.error(`❌ 錯誤: ${e.message}`);
    console.error('');
    console.error('請先完成下列步驟：');
    console.error('  1. 到 GCP console 建立 OAuth 2.0 Client ID (Desktop app)');
    console.error('  2. 下載 JSON 並放到:');
    console.error(`     ${CREDENTIALS_PATH}`);
    console.error('');
    console.error('詳見 docs/EMAIL_SETUP.md');
    rl.close();
    process.exit(1);
  }

  // Step 2: 產生授權 URL
  const oauth2Client = getOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // 一定要 offline 才會拿到 refresh_token
    scope: SCOPES,
    prompt: 'consent', // 強制重新授權（確保 refresh_token 被核發）
  });

  console.log('');
  console.log('請在 browser 開啟以下 URL 並完成授權：');
  console.log('');
  console.log(`  ${authUrl}`);
  console.log('');
  console.log('（若 browser 沒自動開啟，請複製貼上）');
  console.log('');

  // Step 3: 等待使用者貼上授權碼
  const code = await prompt('請貼上授權碼：');
  rl.close();

  if (!code) {
    console.error('❌ 未輸入授權碼');
    process.exit(1);
  }

  // Step 4: 用授權碼換 token
  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      console.warn('⚠️  警告：沒拿到 refresh_token');
      console.warn('   可能原因：這個 GCP project 之前已授權過同樣 scope');
      console.warn('   解法：到 https://myaccount.google.com/permissions 撤銷權限後重跑');
      console.warn('   或把 GCP project 的 OAuth consent screen 設為「Testing」並加入自己為 test user');
    }
    saveToken(tokens);
    console.log('');
    console.log(`✓ Token 已存到: ${TOKEN_PATH}`);
    console.log('');
    console.log('Token 內容：');
    console.log(JSON.stringify(tokens, null, 2));
    console.log('');
    console.log('🎉 Gmail 授權完成！現在可以寄信了。');
  } catch (e) {
    console.error(`❌ 換 token 失敗: ${e.message}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('未預期錯誤:', e);
  process.exit(1);
});
