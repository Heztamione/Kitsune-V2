const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const WebSocket = require('ws');
const config = require('./src/server/config');
const { pool, migrate } = require('./src/server/db');
const auth = require('./src/server/auth');
const services = require('./src/server/services');
const backup = require('./src/server/backup');
const Realtime = require('./src/server/realtime');

const requireTenko = (req, res, next) => {
  if (!req.user || req.user.platform_role !== 'Tenko') return res.status(403).json({ error: 'Tenko access required.' });
  next();
};

const app = express();
if (config.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://api.dicebear.com'],
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: config.production ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '2mb' }));

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) {
    // Android WebView and some same-origin browser POSTs don't send Origin.
    // Check Referer as a fallback; if neither is present, allow in non-production.
    const referer = req.headers.referer;
    if (referer) {
      try { return new URL(referer).host === req.headers.host; } catch (_) { return !config.production; }
    }
    return !config.production;
  }
  try {
    const parsed = new URL(origin);
    if (config.allowedOrigins.includes(origin)) return true;
    return parsed.host === req.headers.host;
  } catch (_) { return false; }
}

app.use('/api', (req, res, next) => {
  // Auth endpoints can be reached from Android WebView / embedded browsers that don't send Origin.
  const isAuthOpen = (req.path === '/auth/register' || req.path === '/auth/login' || req.path === '/auth/forgot-password') && req.method === 'POST';
  if (isAuthOpen || ['GET', 'HEAD', 'OPTIONS'].includes(req.method) || sameOrigin(req)) return next();
  res.status(403).json({ error: 'Origin rejected.' });
});

const apiLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: 'draft-7', legacyHeaders: false });
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const downloadLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api', apiLimit);
app.use('/downloads', downloadLimit);

const iceServers = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
if (config.turnUrls.length && config.turnUsername && config.turnCredential) iceServers.push({ urls: config.turnUrls, username: config.turnUsername, credential: config.turnCredential });
const realtime = new Realtime(iceServers);
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const APP_VERSION = pkg.version || '2.2.0';
const gradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');
let androidVersionCodeMatch = null;
try { androidVersionCodeMatch = fs.readFileSync(gradlePath, 'utf8').match(/versionCode\s+(\d+)/); } catch (_) { /* android folder optional */ }
const ANDROID_VERSION_CODE = androidVersionCodeMatch ? parseInt(androidVersionCodeMatch[1], 10) : 2200;
const releaseFiles = {
  windows: path.join(__dirname, 'releases', 'pc', `Kitsune-v${APP_VERSION}-Setup.exe`),
  android: path.join(__dirname, 'releases', 'android', `Kitsune-v${APP_VERSION}.apk`),
};

function releaseInfo(file) {
  try { const stat = fs.statSync(file); return { available: stat.isFile(), size: stat.size, updatedAt: stat.mtime.toISOString() }; }
  catch (_) { return { available: false, size: 0, updatedAt: null }; }
}

function readSha256(file) {
  try { return fs.readFileSync(`${file}.sha256`, 'utf8').trim().split(/\s+/)[0]; }
  catch (_) { return null; }
}

app.get('/api/releases', (req, res) => res.json({ version: APP_VERSION, windows: releaseInfo(releaseFiles.windows), android: releaseInfo(releaseFiles.android), pwa: { available: true, url: '/app/' } }));
app.get('/downloads/windows', (req, res) => fs.existsSync(releaseFiles.windows) ? res.download(releaseFiles.windows, `Kitsune-v${APP_VERSION}-Setup.exe`) : res.status(404).type('text').send('Windows build is not available yet.'));
app.get('/downloads/android', (req, res) => fs.existsSync(releaseFiles.android) ? res.download(releaseFiles.android, `Kitsune-v${APP_VERSION}.apk`) : res.status(404).type('text').send('Android build is not available yet.'));

// ---- Auto-update endpoints ----
// PC: electron-updater generic provider reads latest.yml from this URL
app.get('/api/updates/pc/latest.yml', (req, res) => {
  const info = releaseInfo(releaseFiles.windows);
  if (!info.available) return res.status(404).type('text').send('No Windows build available.');
  const sha = readSha256(releaseFiles.windows) || '';
  const fileName = `Kitsune-v${APP_VERSION}-Setup.exe`;
  // electron-updater's Provider.resolveFiles expects either 'sha2' (legacy alias for sha256) or 'sha512'
  const yml = `version: ${APP_VERSION}\nfiles:\n  - url: ${fileName}\n    sha2: ${sha}\n    size: ${info.size}\npath: ${fileName}\nsha2: ${sha}\nreleaseDate: '${info.updatedAt}'\n`;
  res.type('text/yaml').set('Cache-Control', 'no-cache').send(yml);
});
app.get('/api/updates/pc/:file', (req, res) => {
  if (req.params.file === `Kitsune-v${APP_VERSION}-Setup.exe`) {
    if (fs.existsSync(releaseFiles.windows)) return res.download(releaseFiles.windows, req.params.file);
  }
  res.status(404).type('text').send('File not found.');
});
// Android: version metadata for in-app update checker
app.get('/api/updates/android', (req, res) => {
  const info = releaseInfo(releaseFiles.android);
  res.set('Cache-Control', 'no-cache').json({
    version: APP_VERSION,
    versionCode: ANDROID_VERSION_CODE,
    url: '/downloads/android',
    size: info.size,
    sha256: readSha256(releaseFiles.android),
    updatedAt: info.updatedAt,
    available: info.available,
  });
});
// PC: version metadata for in-app update checker (lightweight, no yml parsing)
app.get('/api/updates/pc', (req, res) => {
  const info = releaseInfo(releaseFiles.windows);
  res.set('Cache-Control', 'no-cache').json({
    version: APP_VERSION,
    url: '/downloads/windows',
    size: info.size,
    sha256: readSha256(releaseFiles.windows),
    updatedAt: info.updatedAt,
    available: info.available,
  });
});

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', websocketClients: realtime.clients.size, baccaratViewers: baccaratViewerCount(), turnConfigured: iceServers.length > 1 });
  } catch (error) { next(error); }
});
app.post('/api/auth/register', authLimit, auth.register);
app.post('/api/auth/login', authLimit, auth.login);
app.post('/api/auth/forgot-password', authLimit, auth.forgotPassword);
app.post('/api/auth/logout', auth.requireAuth, auth.logout);
app.post('/api/auth/change-password', authLimit, auth.requireAuth, auth.changePassword);
app.post('/api/auth/regenerate-recovery', authLimit, auth.requireAuth, auth.regenerateRecovery);
app.get('/api/auth/me', auth.requireAuth, (req, res) => res.json({ user: auth.publicUser(req.user) }));

// Backup/restore — Tenko only. Backup contains password hashes; keep it secure.
app.get('/api/admin/export', auth.requireAuth, requireTenko, (req, res, next) => {
  try {
    const data = backup.exportDb();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="kitsune-backup.json"');
    res.send(JSON.stringify(data, null, 2));
  } catch (error) { next(error); }
});
app.post('/api/admin/import', auth.requireAuth, requireTenko, express.json({ limit: '50mb' }), (req, res, next) => {
  try {
    backup.importDb(req.body);
    res.json({ success: true });
  } catch (error) { next(error); }
});
app.patch('/api/users/me', auth.requireAuth, async (req, res, next) => {
  try {
    const username = String(req.body.name || '').trim().replace(/\s+/g, ' ');
    const bio = String(req.body.bio || '').slice(0, 500);
    const avatar = String(req.body.avatar || '');
    if (!/^[a-zA-Z0-9_\- ]{2,24}$/.test(username)) return res.status(400).json({ error: 'Invalid display name.' });
    if (avatar.length > 1500000 || (avatar && !avatar.startsWith('https://api.dicebear.com/') && !/^data:image\/(png|jpeg|webp|gif);base64,/.test(avatar))) return res.status(400).json({ error: 'Invalid avatar.' });
    // Protected accounts cannot change their username (would break protection)
    if (auth.isProtectedUsername(req.user.username_key) && username.toLowerCase() !== req.user.username_key) {
      return res.status(403).json({ error: 'Protected accounts cannot change their username.' });
    }
    const updated = await pool.query('UPDATE users SET username = $1, username_key = $2, bio = $3, avatar = $4, updated_at = now() WHERE id = $5 RETURNING *', [username, username.toLowerCase(), bio, avatar, req.user.id]);
    await realtime.broadcastRelevant(req.user.id, 'profile-update', { user: auth.publicUser(updated.rows[0]) });
    res.json({ user: auth.publicUser(updated.rows[0]) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That display name is already in use.' });
    next(error);
  }
});

app.get('/api/bootstrap', auth.requireAuth, async (req, res, next) => {
  try { res.json(await services.bootstrap(req.user, realtime.isOnline, iceServers)); } catch (error) { next(error); }
});

app.post('/api/guilds', auth.requireAuth, async (req, res, next) => {
  try { const guild = await services.createGuild(req.user.id, req.body.name, req.body.icon); res.status(201).json({ guild }); }
  catch (error) { next(error); }
});

app.get('/api/channels/:channelId/messages', auth.requireAuth, async (req, res, next) => {
  try { res.json({ messages: await services.listChannelMessages(req.user.id, req.params.channelId, req.query.limit, req.query.before) }); } catch (error) { next(error); }
});
app.post('/api/channels/:channelId/messages', auth.requireAuth, async (req, res, next) => {
  try {
    const created = await services.createChannelMessage(req.user, { ...req.body, channelId: req.params.channelId });
    await realtime.broadcastGuild(created.guildId, 'message', { serverId: created.guildId, channelId: created.channelId, payload: created.message });
    res.status(201).json(created);
  } catch (error) { next(error); }
});

app.patch('/api/messages/:messageId', auth.requireAuth, async (req, res, next) => {
  try { const updated = await services.editChannelMessage(req.user, req.params.messageId, req.body.content); await realtime.broadcastGuild(updated.guildId, 'message-update', updated); res.json(updated); }
  catch (error) { next(error); }
});
app.delete('/api/messages/:messageId', auth.requireAuth, async (req, res, next) => {
  try { const deleted = await services.deleteChannelMessage(req.user.id, req.params.messageId); await realtime.broadcastGuild(deleted.guildId, 'message-delete', deleted); res.status(204).end(); }
  catch (error) { next(error); }
});
app.post('/api/messages/:messageId/reaction', auth.requireAuth, async (req, res, next) => {
  try { const reaction = await services.toggleMessageReaction(req.user.id, req.params.messageId, req.body.emoji); await realtime.broadcastGuild(reaction.guildId, 'reaction-update', reaction); res.json(reaction); }
  catch (error) { next(error); }
});

app.post('/api/dms', auth.requireAuth, async (req, res, next) => {
  try { res.status(201).json({ threadId: await services.openDm(req.user.id, String(req.body.userId || '')) }); } catch (error) { next(error); }
});
app.get('/api/dms/:threadId/messages', auth.requireAuth, async (req, res, next) => {
  try { res.json({ messages: await services.listDmMessages(req.user.id, req.params.threadId, req.query.limit, req.query.before) }); } catch (error) { next(error); }
});
app.post('/api/dms/:threadId/messages', auth.requireAuth, async (req, res, next) => {
  try {
    const created = await services.createDmMessage(req.user, { ...req.body, threadId: req.params.threadId });
    const members = await pool.query('SELECT user_id FROM dm_members WHERE thread_id = $1', [created.threadId]);
    for (const row of members.rows) realtime.sendToUser(row.user_id, 'dm-message', created);
    res.status(201).json(created);
  } catch (error) { next(error); }
});

app.patch('/api/dm-messages/:messageId', auth.requireAuth, async (req, res, next) => {
  try {
    const updated = await services.editDmMessage(req.user, req.params.messageId, req.body.content);
    const members = await pool.query('SELECT user_id FROM dm_members WHERE thread_id = $1', [updated.threadId]);
    for (const row of members.rows) realtime.sendToUser(row.user_id, 'dm-message-update', updated);
    res.json(updated);
  } catch (error) { next(error); }
});
app.delete('/api/dm-messages/:messageId', auth.requireAuth, async (req, res, next) => {
  try {
    const deleted = await services.deleteDmMessage(req.user.id, req.params.messageId);
    const members = await pool.query('SELECT user_id FROM dm_members WHERE thread_id = $1', [deleted.threadId]);
    for (const row of members.rows) realtime.sendToUser(row.user_id, 'dm-message-delete', deleted);
    res.status(204).end();
  } catch (error) { next(error); }
});

app.post('/api/friends', auth.requireAuth, async (req, res, next) => {
  try {
    const userId = await services.addFriend(req.user.id, req.body.username);
    realtime.sendToUser(userId, 'friend-update', { action: 'request', user: auth.publicUser(req.user) });
    res.status(201).json({ userId });
  } catch (error) { next(error); }
});
app.post('/api/friends/:userId/accept', auth.requireAuth, async (req, res, next) => {
  try {
    await services.acceptFriend(req.user.id, req.params.userId);
    realtime.sendToUser(req.params.userId, 'friend-update', { action: 'accepted', user: auth.publicUser(req.user) });
    res.status(204).end();
  } catch (error) { next(error); }
});
app.delete('/api/friends/:userId', auth.requireAuth, async (req, res, next) => {
  try { await services.removeFriend(req.user.id, req.params.userId); realtime.sendToUser(req.params.userId, 'friend-update', { action: 'removed', userId: req.user.id }); res.status(204).end(); } catch (error) { next(error); }
});
app.post('/api/blocks/:userId', auth.requireAuth, async (req, res, next) => {
  try { await services.blockUser(req.user.id, req.params.userId); realtime.sendToUser(req.params.userId, 'friend-update', { action: 'removed', userId: req.user.id }); res.status(204).end(); } catch (error) { next(error); }
});
app.delete('/api/blocks/:userId', auth.requireAuth, async (req, res, next) => {
  try { await pool.query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [req.user.id, req.params.userId]); res.status(204).end(); } catch (error) { next(error); }
});

app.delete('/api/guilds/:guildId/messages', auth.requireAuth, async (req, res, next) => {
  try {
    const count = await services.clearGuildMessages(req.user.id, req.params.guildId);
    await realtime.broadcastGuild(req.params.guildId, 'guild-messages-cleared', { serverId: req.params.guildId });
    res.json({ count });
  } catch (error) { next(error); }
});
app.patch('/api/guilds/:guildId/members/:userId/role', auth.requireAuth, async (req, res, next) => {
  try {
    await services.updateMemberRole(req.user.id, req.params.guildId, req.params.userId, req.body.role);
    await realtime.broadcastGuild(req.params.guildId, 'member-update', { serverId: req.params.guildId, userId: req.params.userId, role: req.body.role });
    res.status(204).end();
  } catch (error) { next(error); }
});
app.post('/api/guilds/:guildId/members/:userId/kick', auth.requireAuth, async (req, res, next) => {
  try { await services.removeGuildMember(req.user.id, req.params.guildId, req.params.userId, false); await realtime.broadcastGuild(req.params.guildId, 'member-remove', { serverId: req.params.guildId, userId: req.params.userId }); res.status(204).end(); } catch (error) { next(error); }
});
app.post('/api/guilds/:guildId/members/:userId/ban', auth.requireAuth, async (req, res, next) => {
  try { await services.removeGuildMember(req.user.id, req.params.guildId, req.params.userId, true, req.body.reason); await realtime.broadcastGuild(req.params.guildId, 'member-remove', { serverId: req.params.guildId, userId: req.params.userId, banned: true }); res.status(204).end(); } catch (error) { next(error); }
});

const renderer = path.join(__dirname, 'src', 'renderer');
const website = path.join(__dirname, 'website');
const baccarat = path.join(__dirname, '..', 'Kitsune Baccarat');

// Explicitly serve the landing page at the root so reverse proxies (Render, etc.)
// that normalize the request path still hit index.html.
app.get('/', (req, res) => res.sendFile(path.join(website, 'index.html')));
const baccaratAvailable = fs.existsSync(baccarat);
app.use('/app', express.static(renderer, { index: 'index.html', maxAge: config.production ? '1h' : 0, setHeaders(res, file) { if (/\.(html|js|css)$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); } }));
if (baccaratAvailable) {
  app.use('/baccarat', express.static(baccarat, { index: 'index.html', maxAge: config.production ? '1h' : 0, setHeaders(res, file) { if (/\.(html|js|css)$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); } }));
} else {
  app.use('/baccarat', (req, res) => res.status(404).type('text').send('Baccarat module is not installed on this server.'));
}
app.use('/', express.static(website, { index: 'index.html', maxAge: config.production ? '1h' : 0 }));
app.use((req, res) => res.status(404).type('text').send('Not found'));
app.use((error, req, res, next) => {
  const status = Number(error.status) || (['22P02', '22007'].includes(error.code) ? 400 : 500);
  if (status >= 500) console.error(error);
  if (res.headersSent) return next(error);
  res.status(status).json({ error: status < 500 ? error.message : 'Internal server error.' });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true, maxPayload: 65536, perMessageDeflate: false });

// ---- Baccarat public presence (anonymous, no auth) ----
// Lightweight channel so anyone viewing /baccarat/ sees who else is at the table.
const BACCARAT_MAX_CLIENTS = 500;
const baccaratClients = new Map(); // ws -> { name, alive }
const FOX_PREFIXES = ['Fox', 'Kitsune', 'Vixen', 'Tod', 'Zorro', 'Sona', 'Reynard', 'Toddy'];
function guestName() {
  const p = FOX_PREFIXES[Math.floor(Math.random() * FOX_PREFIXES.length)];
  const h = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `${p}-${h}`;
}
function baccaratViewerCount() { return baccaratClients.size; }
function baccaratBroadcast(type, data, excludeWs) {
  const msg = JSON.stringify({ type, ...data });
  for (const ws of baccaratClients.keys()) {
    if (ws === excludeWs || ws.readyState !== 1) continue;
    ws.send(msg);
  }
}
function baccaratSend(ws, type, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...data }));
}
function baccaratDisconnect(ws) {
  const client = baccaratClients.get(ws);
  if (!client) return;
  baccaratClients.delete(ws);
  try { ws.terminate(); } catch (_) {}
  const viewers = baccaratViewerCount();
  baccaratBroadcast('baccarat-leave', { name: client.name, viewers });
}
// Periodic heartbeat to drop dead connections.
const baccaratHeartbeat = setInterval(() => {
  for (const [ws, client] of baccaratClients) {
    if (!client.alive) { baccaratDisconnect(ws); continue; }
    client.alive = false;
    try { ws.ping(); } catch (_) { baccaratDisconnect(ws); }
  }
}, 30000);
baccaratHeartbeat.unref();

const baccaratWss = new WebSocket.Server({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
function baccaratConnect(ws) {
  if (baccaratClients.size >= BACCARAT_MAX_CLIENTS) { ws.close(1013, 'Table is full'); return; }
  const name = guestName();
  const client = { name, alive: true };
  baccaratClients.set(ws, client);
  ws.on('pong', () => { client.alive = true; });
  ws.on('message', raw => {
    // Public channel is receive-silent: clients may send pings/nick requests,
    // but we intentionally ignore arbitrary input to prevent abuse.
    try {
      const msg = JSON.parse(raw.toString());
      if (msg && msg.type === 'baccarat-nick' && typeof msg.name === 'string') {
        const nick = String(msg.name).trim().slice(0, 20).replace(/[<>]/g, '');
        if (/^[A-Za-z0-9 _\-]{2,20}$/.test(nick)) {
          const old = client.name;
          client.name = nick;
          baccaratBroadcast('baccarat-nick', { old, name: nick, viewers: baccaratViewerCount() });
        }
      }
    } catch (_) { /* ignore malformed */ }
  });
  ws.on('close', () => baccaratDisconnect(ws));
  ws.on('error', () => baccaratDisconnect(ws));
  // Greet the newcomer with their own name + current crowd, then tell everyone else.
  baccaratSend(ws, 'baccarat-hello', { you: name, viewers: baccaratViewerCount() });
  baccaratBroadcast('baccarat-join', { name, viewers: baccaratViewerCount() }, ws);
}

server.on('upgrade', async (req, socket, head) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    // Anonymous public presence for the baccarat table (no auth, same-origin only).
    if (url.pathname === '/baccarat-ws') {
      if (!sameOrigin(req)) return socket.destroy();
      baccaratWss.handleUpgrade(req, socket, head, ws => baccaratConnect(ws));
      return;
    }
    if (url.pathname !== '/ws' || !sameOrigin(req)) return socket.destroy();
    const user = await auth.authenticateRequest(req);
    if (!user) return socket.destroy();
    wss.handleUpgrade(req, socket, head, ws => realtime.connect(ws, user, req).catch(error => { console.error(error); ws.close(1011, 'Initialization failed'); }));
  } catch (_) { socket.destroy(); }
});

async function start() {
  await migrate();
  await pool.query('DELETE FROM sessions WHERE expires_at <= now()');
  await backup.restoreFromUrlIfEmpty();
  await auth.seedProtectedAccounts();
  server.listen(config.port, '0.0.0.0', () => {
    console.log(`Kitsune v2 running at http://localhost:${config.port}/`);
    console.log(`App at http://localhost:${config.port}/app/`);
    console.log(`WebSocket at ws://localhost:${config.port}/ws`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  for (const ws of realtime.clients.keys()) ws.close(1001, 'Server shutting down');
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', error => console.error('Unhandled rejection', error));
if (require.main === module) start().catch(error => { console.error('Kitsune failed to start:', error.message); process.exit(1); });

module.exports = { app, server, start };
