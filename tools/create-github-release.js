/**
 * Create a GitHub release and upload built installers.
 * Usage: GITHUB_TOKEN=... node tools/create-github-release.js
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const token = process.env.GITHUB_TOKEN;
const owner = 'Heztamione';
const repo = 'Kitsune-V2';
const version = require('../package.json').version;
const tag = `v${version}`;

if (!token) {
  console.error('Set GITHUB_TOKEN before running.');
  process.exit(1);
}

function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = { method, hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, headers };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function createRelease() {
  const body = JSON.stringify({
    tag_name: tag,
    name: `Kitsune ${tag}`,
    body: `Windows installer and Android APK for Kitsune ${tag}.\n\nInstall the Windows desktop client for notifications, voice, video, and screen sharing, or install the Android APK for mobile chat and calls.`,
    draft: false,
    prerelease: false,
  });
  const res = await request(
    'POST',
    `https://api.github.com/repos/${owner}/${repo}/releases`,
    {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'kitsune-release',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
    body
  );
  if (res.status >= 400) {
    console.error('Failed to create release:', res.status, res.body);
    process.exit(1);
  }
  console.log('Release created:', res.body.html_url);
  return res.body;
}

async function uploadAsset(release, filePath, assetName, contentType) {
  const data = fs.readFileSync(filePath);
  const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(assetName)}`);
  const res = await request(
    'POST',
    uploadUrl,
    {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'kitsune-release',
      'Content-Type': contentType,
      'Content-Length': data.length,
    },
    data
  );
  if (res.status >= 400) {
    console.error(`Failed to upload ${assetName}:`, res.status, res.body);
    process.exit(1);
  }
  console.log('Uploaded:', res.body.browser_download_url);
  return res.body.browser_download_url;
}

(async () => {
  const release = await createRelease();
  const root = path.join(__dirname, '..', 'releases');
  const pc = path.join(root, 'pc', `Kitsune-v${version}-Setup.exe`);
  const android = path.join(root, 'android', `Kitsune-v${version}.apk`);

  if (fs.existsSync(pc)) await uploadAsset(release, pc, `Kitsune-v${version}-Setup.exe`, 'application/x-msdownload');
  else console.warn('PC installer not found:', pc);

  if (fs.existsSync(android)) await uploadAsset(release, android, `Kitsune-v${version}.apk`, 'application/vnd.android.package-archive');
  else console.warn('Android APK not found:', android);
})();
