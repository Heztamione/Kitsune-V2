/**
 * Kitsune v2 Auto-Backup Tool
 *
 * Runs on your PC, logs in as the configured Tenko account, downloads the
 * full server backup (users, shrines, messages, friends, etc.), and saves
 * it locally every N minutes. Keeps a rolling number of backups.
 *
 * Environment variables:
 *   KITSUNE_URL      - https://kitsune-v2-1.onrender.com
 *   KITSUNE_USERNAME - Tenko username (e.g. asa_diaries)
 *   KITSUNE_PASSWORD - Tenko password
 *   KITSUNE_BACKUP_DIR - Where to save backups (default: %APPDATA%/kitsune/backups)
 *   KITSUNE_BACKUP_INTERVAL_MS - Milliseconds between backups (default: 900000 = 15 minutes)
 *   KITSUNE_BACKUP_KEEP - Number of backups to keep (default: 10)
 *
 * Run:
 *   node tools/auto-backup.js
 *
 * Or on Windows:
 *   tools\auto-backup.bat
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const baseUrl = new URL((process.env.KITSUNE_URL || '').replace(/\/$/, ''));
const username = process.env.KITSUNE_USERNAME || '';
const password = process.env.KITSUNE_PASSWORD || '';
const backupDir = process.env.KITSUNE_BACKUP_DIR || path.join(process.env.APPDATA || process.env.HOME || '.', 'kitsune', 'backups');
const intervalMs = parseInt(process.env.KITSUNE_BACKUP_INTERVAL_MS, 10) || 15 * 60 * 1000;
const keepCount = parseInt(process.env.KITSUNE_BACKUP_KEEP, 10) || 10;

if (!baseUrl.href || !username || !password) {
  console.error('[auto-backup] Set KITSUNE_URL, KITSUNE_USERNAME, and KITSUNE_PASSWORD first.');
  console.error('Example:');
  console.error('  set KITSUNE_URL=https://kitsune-v2-1.onrender.com');
  console.error('  set KITSUNE_USERNAME=asa_diaries');
  console.error('  set KITSUNE_PASSWORD=yourpassword');
  process.exit(1);
}

function request(method, pathname, body, cookie) {
  return new Promise((resolve, reject) => {
    const reqUrl = new URL(pathname, baseUrl);
    const client = reqUrl.protocol === 'https:' ? https : http;
    const options = {
      method,
      hostname: reqUrl.hostname,
      port: reqUrl.port || (reqUrl.protocol === 'https:' ? 443 : 80),
      path: reqUrl.pathname + reqUrl.search,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
    };
    if (cookie) options.headers.Cookie = cookie;
    const req = client.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || [];
        resolve({ status: res.statusCode, headers: res.headers, body: data, cookies });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login() {
  const res = await request('POST', '/api/auth/login', { username, password });
  if (res.status !== 200) {
    throw new Error(`Login failed: ${res.status} ${res.body.slice(0, 200)}`);
  }
  const cookie = res.cookies.map(c => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('Login succeeded but no session cookie was returned.');
  return cookie;
}

async function exportBackup(cookie) {
  const res = await request('GET', '/api/admin/export', null, cookie);
  if (res.status !== 200) {
    throw new Error(`Export failed: ${res.status} ${res.body.slice(0, 200)}`);
  }
  return res.body;
}

function cleanOldBackups() {
  if (!fs.existsSync(backupDir)) return;
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('kitsune-backup-') && f.endsWith('.json'))
    .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  while (files.length > keepCount) {
    const old = files.pop();
    fs.unlinkSync(path.join(backupDir, old.name));
    console.log(`[auto-backup] Removed old backup ${old.name}`);
  }
}

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const cookie = await login();
  const data = await exportBackup(cookie);
  const file = path.join(backupDir, `kitsune-backup-${timestamp}.json`);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(file, data);
  console.log(`[auto-backup] Saved ${file} (${Buffer.byteLength(data)} bytes)`);
  cleanOldBackups();
}

async function runOnce() {
  try {
    await backup();
  } catch (error) {
    console.error('[auto-backup] Error:', error.message);
  }
}

async function runLoop() {
  await runOnce();
  setInterval(runOnce, intervalMs);
}

if (process.argv.includes('--once')) {
  runOnce().then(() => process.exit(0));
} else {
  runLoop();
}
