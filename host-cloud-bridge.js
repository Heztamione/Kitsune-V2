const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const dns = require('dns');

const ROOT = __dirname;
const TOOLS_DIR = path.join(ROOT, 'tools');
const CLOUDFLARED = path.join(TOOLS_DIR, 'cloudflared.exe');
const CLOUDFLARED_URL = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';

function log(...args) { console.log(...args); }

async function downloadCloudflared() {
  if (fs.existsSync(CLOUDFLARED) && fs.statSync(CLOUDFLARED).size > 0) return;
  if (fs.existsSync(CLOUDFLARED)) { try { fs.rmSync(CLOUDFLARED); } catch (_) {} }
  log('Downloading Kitsune Cloud Bridge (cloudflared) ...');
  log(CLOUDFLARED_URL);
  fs.mkdirSync(TOOLS_DIR, { recursive: true });
  try {
    const res = await fetch(CLOUDFLARED_URL);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100000) throw new Error('Downloaded file is too small or invalid');
    fs.writeFileSync(CLOUDFLARED, buf);
    log('Cloudflared saved.');
  } catch (e) {
    throw new Error(`Could not download cloudflared: ${e.message}`);
  }
}

async function ensureCloudflared() {
  if (fs.existsSync(CLOUDFLARED)) return;
  await downloadCloudflared();
}

function openBrowser(url) {
  if (process.platform === 'win32') exec(`start "" "${url}"`);
  else exec(`open "${url}" || xdg-open "${url}"`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function resolveHost(host) {
  return Promise.race([
    new Promise((resolve, reject) => {
      dns.resolve4(host, { ttl: true }, (err, addrs) => {
        if (err) reject(err); else resolve(addrs.map(a => typeof a === 'string' ? a : a.address));
      });
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), 8000))
  ]);
}

function testPublicUrl(url) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      resolveHost(u.hostname).then(ips => {
        if (!ips.length) { resolve(false); return; }
        const req = https.get({
          hostname: ips[0],
          servername: u.hostname,
          path: u.pathname || '/',
          headers: { Host: u.hostname, 'User-Agent': 'Kitsune-Bridge-Check/1.0' },
          timeout: 15000
        }, (res) => { resolve(res.statusCode === 200); });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
      }).catch(() => resolve(false));
    } catch (_) { resolve(false); }
  });
}

async function main() {
  await ensureCloudflared();

  const occupied = await new Promise(resolve => {
    const req = http.get('http://localhost:8080/api/health', () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
  if (occupied) throw new Error('Port 8080 is already in use. Close the previous Kitsune server or bridge before starting a new one.');

  log('Starting local server ...');
  const server = spawn('node', ['server.js'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const serverLog = fs.createWriteStream(path.join(ROOT, 'server.log'), { flags: 'a' });
  server.stdout.pipe(serverLog);
  server.stderr.pipe(serverLog);

  server.on('close', (code) => { log(`Server exited with code ${code}`); process.exit(0); });

  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:8080/', (res) => { if (res.statusCode === 200) resolve(); else reject(); });
        req.on('error', reject);
        req.setTimeout(1000, () => reject());
      });
      ready = true;
      break;
    } catch (_) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (!ready) {
    log('Server did not start. Check server.log');
    process.exit(1);
  }

  log('Starting Kitsune Cloud Bridge ...');
  const tunnel = spawn(CLOUDFLARED, ['tunnel', '--url', 'http://localhost:8080'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let publicUrl = null;
  function tryExtractUrl(str) {
    if (publicUrl) return;
    const m = str.match(/(https:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com)/);
    if (m) {
      publicUrl = m[1];
      (async () => {
        log('');
        log('========================================');
        log('  KITSUNE V2 CLOUD BRIDGE READY');
        log('========================================');
        log('  Public URL:', publicUrl);
        log('  Web app:   ', publicUrl + '/app/');
        log('========================================');
        log('');
        log('The tunnel starts in a few seconds.');
        log('Opening browser in 10 seconds ...');
        log('');

        await sleep(10000);
        openBrowser(publicUrl + '/app/');

        log('Checking tunnel reachability (this may take a moment) ...');
        let reachable = false;
        for (let i = 0; i < 20; i++) {
          reachable = await testPublicUrl(publicUrl);
          if (reachable) break;
          await sleep(2500);
          process.stdout.write('.');
        }
        log('');

        if (reachable) log('Tunnel is reachable from the internet.');
        else {
          log('');
          log('The page may need 30-60 seconds to become reachable.');
          log('Try refreshing the browser, or use a public DNS like 1.1.1.1 / 8.8.8.8.');
          log('If it still fails, your network or firewall may be blocking Cloudflare.');
        }

        log('');
        log('Share this URL with anyone on any network.');
        log('Keep this window open — the URL stops working if you close it.');
        log('Press Enter to stop.');
      })();
    }
  }

  tunnel.stdout.on('data', (data) => tryExtractUrl(data.toString()));
  tunnel.stderr.on('data', (data) => tryExtractUrl(data.toString()));

  tunnel.on('close', (code) => { log(`Cloud bridge exited with code ${code}`); });

  process.stdin.setEncoding('utf8');
  process.stdin.resume();
  process.stdin.on('data', () => {
    tunnel.kill();
    server.kill();
    process.exit(0);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
