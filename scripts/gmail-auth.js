#!/usr/bin/env node
'use strict';

/**
 * gmail-auth.js — Gmail OAuth 2.0 一次性授權腳本（v3 — 加 local HTTP server 接 loopback callback）
 *
 * 用途：取得 Gmail API 的 refresh_token，存到 XDG secrets。
 * 只需跑一次，除非 revoke token 或換 credentials.json。
 *
 * Desktop app loopback flow：
 *   1. 啟動 local HTTP server（127.0.0.1 隨機 port）
 *   2. 產生 auth URL，redirect_uri 指向我們的 server
 *   3. 用戶在 browser 完成授權 → Google redirect 到 /oauth2callback?code=xxx
 *   4. Server 收到 code → getToken → 存 token
 *   5. 關閉 server，結束
 *
 * 使用步驟：
 *   1. GCP console 建立 OAuth 2.0 Client ID（Application type: **Desktop app**）
 *   2. 下載 JSON 放到 /home/clawuser/.config/chicken/secrets/gmail-credentials.json
 *   3. 跑 `node scripts/gmail-auth.js`
 *   4. browser 開啟自動顯示（或複製 URL 手動開）
 *   5. 登入 clawbrt@gmail.com、授權
 *   6. browser 自動跳轉到 localhost → 我們的 server 接住 → 顯示成功頁
 *   7. terminal 看「✓ Token 已存到 ...」
 *
 * 詳見 docs/EMAIL_SETUP.md
 */

const readline = require('readline');
const http = require('http');
const url = require('url');
const {
  getOAuth2Client,
  loadCredentials,
  saveToken,
  SCOPES,
  CREDENTIALS_PATH,
  // TOKEN_PATH, // unused 2026-07-25 Round 26 #2 lint cleanup
} = require('../src/handoff/emailNotifier');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// function prompt(question) { // unused 2026-07-25 Round 26 #2 lint cleanup
//   return new Promise((resolve) => {
//     rl.question(question, (answer) => {
//       resolve(answer.trim());
//     });
//   });
// }

/**
 * 啟動 local HTTP server 接 OAuth callback
 * @returns {Promise<{server: http.Server, redirectUri: string, port: number}>}
 */
function startCallbackServer(oauth2Client) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // 處理 callback
      try {
        const parsedUrl = url.parse(req.url, true);
        if (parsedUrl.pathname === '/oauth2callback') {
          const code = parsedUrl.query.code;
          const error = parsedUrl.query.error;
          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h1>❌ 授權失敗</h1><p>${error}：${parsedUrl.query.error_description || '無說明'}</p>`);
            return;
          }
          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>❌ 授權失敗</h1><p>未收到授權碼。</p>');
            return;
          }
          // 用 code 換 token
          oauth2Client.getToken(code).then(({ tokens }) => {
            saveToken(tokens);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(
              '<!DOCTYPE html><html><head><meta charset="utf-8"><title>授權成功</title></head>'
              + '<body style="font-family:sans-serif;max-width:600px;margin:50px auto;padding:20px;text-align:center;">'
              + '<h1>🎉 授權成功！</h1>'
              + '<p>Token 已存到 <code>/home/clawuser/.config/chicken/secrets/gmail-token.json</code></p>'
              + '<p>可以關閉這個視窗，回到 terminal。</p>'
              + '</body></html>',
            );
            // 1 秒後關 server
            setTimeout(() => {
              server.close();
              rl.close();
              console.log('\n✓ 授權完成，server 已關閉');
              process.exit(0);
            }, 1000);
          }).catch((e) => {
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h1>❌ 換 token 失敗</h1><pre>${e.message}</pre>`);
          });
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Server error: ' + e.message);
      }
    });
    // 隨機 port（0 = OS 自動選）
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
      // 重要：動態設 redirect_uri（Desktop app loopback flow）
      oauth2Client.redirectUri = redirectUri;
      resolve({ server, redirectUri, port });
    });
    server.on('error', reject);
  });
}

async function main() {
  console.log('=== Gmail OAuth 授權腳本（v3 — Desktop app loopback）===');
  console.log('');

  // Step 1: 確認 credentials.json 存在
  try {
    loadCredentials();
    console.log(`✓ 找到 credentials: ${CREDENTIALS_PATH}`);
  } catch (e) {
    console.error(`❌ 錯誤: ${e.message}`);
    console.error('');
    console.error('請先完成下列步驟：');
    console.error('  1. GCP console 建立 OAuth 2.0 Client ID (Application type: **Desktop app**)');
    console.error('  2. 下載 JSON 並放到:');
    console.error(`     ${CREDENTIALS_PATH}`);
    console.error('');
    console.error('詳見 docs/EMAIL_SETUP.md');
    rl.close();
    process.exit(1);
  }

  // Step 2: 啟動 local callback server + 設 redirect_uri
  const oauth2Client = getOAuth2Client();
  const { redirectUri, port } = await startCallbackServer(oauth2Client);
  console.log(`✓ Local callback server 已啟動（127.0.0.1:${port}）`);
  console.log('');

  // Step 3: 產生授權 URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('請在 browser 開啟以下 URL 並完成授權：');
  console.log('');
  console.log(`  ${authUrl}`);
  console.log('');
  console.log('（若 browser 沒自動開啟，請複製貼上）');
  console.log(`（授權後 Google 會 redirect 到 ${redirectUri}）`);
  console.log('');
  console.log('等待 callback...');
  console.log('（按 Ctrl+C 可中斷）');
  console.log('');

  // 給用戶 60 秒決定要不要嘗試自動開 browser（避免額外依賴）
  console.log('💡 提示：直接複製上面 URL 到 browser 開啟即可');
  console.log('');

  // 等待 server.close() 觸發 process exit
  // 如果 5 分鐘沒 callback，提示用戶
  setTimeout(() => {
    console.warn('');
    console.warn('⚠️  5 分鐘內沒收到 callback，請檢查：');
    console.warn('   - browser 是否完成授權');
    console.warn('   - 是否誤按「拒絕」而非「允許」');
    console.warn('   - 防火牆是否擋住 127.0.0.1');
    process.exit(1);
  }, 5 * 60 * 1000);
}

main().catch((e) => {
  console.error('未預期錯誤:', e);
  rl.close();
  process.exit(1);
});
