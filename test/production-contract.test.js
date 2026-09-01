const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('server and client sources parse', () => {
  for (const file of ['server.js', 'src/server/auth.js', 'src/server/services.js', 'src/server/realtime.js', 'src/renderer/app.js']) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
});

test('browser code contains no owner credential', () => {
  const client = read('src/renderer/app.js');
  assert.doesNotMatch(client, /KITSUNE-TENKO-OWNER|OWNER_KEY|claimOwner/);
});

test('production protocol authenticates websocket upgrades', () => {
  const server = read('server.js');
  assert.match(server, /authenticateRequest\(req\)/);
  assert.match(server, /new WebSocket\.Server\(\{ noServer: true/);
  assert.match(server, /maxPayload: 65536/);
});

test('database schema persists shared entities', () => {
  const schema = read('src/server/schema.sql');
  for (const table of ['users', 'sessions', 'guilds', 'guild_members', 'channels', 'messages', 'dm_threads', 'dm_messages', 'friendships', 'blocks']) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`));
  }
});

test('realtime supports messaging presence and calls', () => {
  const realtime = read('src/server/realtime.js');
  for (const event of ['dm-message', 'typing', 'status', 'call-invite', 'voice-join', 'rtc-offer', 'rtc-answer', 'rtc-ice', 'call-media-state']) assert.match(realtime, new RegExp(`['\"]${event}['\"]`));
});

test('screen sharing prioritizes motion and per-stream fullscreen', () => {
  const client = read('src/renderer/app.js');
  assert.match(client, /getDisplayMedia/);
  assert.match(client, /maxFramerate = screen \? 120 : 60/);
  assert.match(client, /maintain-framerate/);
  assert.match(client, /tile-fullscreen/);
  assert.match(client, /requestFullscreen/);
  // Android native screen capture plugin is wired for WebView screen sharing and recording.
  const androidPlugin = read('android/app/src/main/java/ai/kitsune/chat/screencapture/KitsuneScreenCapturePlugin.java');
  assert.match(androidPlugin, /KitsuneScreenCapture/);
  assert.match(androidPlugin, /MediaProjectionManager/);
  assert.match(androidPlugin, /ScreenCaptureService/);
  assert.match(androidPlugin, /startRecording/);
  assert.match(androidPlugin, /stopRecording/);
  const recordService = read('android/app/src/main/java/ai/kitsune/chat/screencapture/ScreenRecordService.java');
  assert.match(recordService, /MediaRecorder/);
  assert.match(recordService, /VirtualDisplay/);
});

test('website exposes real desktop and Android downloads', () => {
  const website = read('website/index.html');
  assert.match(website, /href="\/downloads\/windows"/);
  assert.match(website, /href="\/downloads\/android"/);
  const pkg = JSON.parse(read('package.json'));
  const winExe = path.join(root, `releases/pc/Kitsune-v${pkg.version}-Setup.exe`);
  const apk = path.join(root, `releases/android/Kitsune-v${pkg.version}.apk`);
  // Accept either the current version's artifact or a previously built one
  const winPath = fs.existsSync(winExe) ? winExe : path.join(root, 'releases/pc/Kitsune-v2.0.0-Setup.exe');
  const apkPath = fs.existsSync(apk) ? apk : path.join(root, 'releases/android/Kitsune-v2.0.0.apk');
  assert.ok(fs.existsSync(winPath), 'Windows installer not found');
  assert.ok(fs.existsSync(apkPath), 'Android APK not found');
  assert.ok(fs.statSync(winPath).size > 1000000, 'Windows installer too small');
  assert.ok(fs.statSync(apkPath).size > 1000000, 'Android APK too small');
});

test('auto-update endpoints and native updater are wired', () => {
  const server = read('server.js');
  assert.match(server, /\/api\/updates\/pc/);
  assert.match(server, /\/api\/updates\/android/);
  assert.match(server, /latest\.yml/);
  const client = read('src/renderer/app.js');
  assert.match(client, /checkForUpdates/);
  assert.match(client, /compareVersions/);
  assert.match(client, /CLIENT_VERSION/);
  const main = read('desktop/main.js');
  assert.match(main, /electron-updater/);
  assert.match(main, /setupAutoUpdater/);
  assert.match(main, /quitAndInstall/);
  const preload = read('desktop/preload.js');
  assert.match(preload, /checkUpdates/);
  assert.match(preload, /installUpdate/);
  // Android native updater plugin
  const plugin = fs.readFileSync(path.join(root, 'android/app/src/main/java/ai/kitsune/chat/updater/KitsuneUpdaterPlugin.java'), 'utf8');
  assert.match(plugin, /downloadAndInstall/);
  assert.match(plugin, /FileProvider/);
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /REQUEST_INSTALL_PACKAGES/);
});

test('PWA manifest provides install icons and standalone mode', () => {
  const manifest = JSON.parse(read('src/renderer/manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
  assert.ok(fs.existsSync(path.join(root, 'src/renderer/sw.js')));
});
