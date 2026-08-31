const { app, BrowserWindow, Menu, ipcMain, net, session, shell } = require('electron');
const fs = require('fs');
const path = require('path');

let window;
let serverUrl;
let updateAvailable = null;
let autoUpdater = null;

function settingsPath() { return path.join(app.getPath('userData'), 'settings.json'); }

function loadServerUrl() {
  try { return normalizeUrl(JSON.parse(fs.readFileSync(settingsPath(), 'utf8')).serverUrl); }
  catch (_) { return null; }
}

function normalizeUrl(value) {
  const parsed = new URL(String(value || '').trim());
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Use an HTTPS URL. HTTP is allowed only for localhost or local network testing.');
  if (parsed.username || parsed.password) throw new Error('URLs containing credentials are not allowed.');
  if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(parsed.hostname) && !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname)) throw new Error('Public Kitsune servers must use HTTPS.');
  parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.origin;
}

async function validateServer(value) {
  const url = normalizeUrl(value);
  const response = await net.fetch(`${url}/api/health`, { method: 'GET' });
  if (!response.ok) throw new Error(`Kitsune server returned HTTP ${response.status}.`);
  const health = await response.json();
  if (health.status !== 'ok') throw new Error('This is not a healthy Kitsune server.');
  return url;
}

function saveServerUrl(url) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify({ serverUrl: url }, null, 2));
}

// ---- Auto-update (credentials in userData are preserved by NSIS updates) ----
function setupAutoUpdater() {
  if (!serverUrl) return;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (e) {
    console.error('electron-updater failed to load:', e.message);
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL({ provider: 'generic', url: `${serverUrl}/api/updates/pc` });
  autoUpdater.logger = console;
  autoUpdater.on('update-available', (info) => {
    updateAvailable = info;
    if (window && !window.isDestroyed()) window.webContents.send('kitsune:update-status', { event: 'available', info });
  });
  autoUpdater.on('update-not-available', () => {
    if (window && !window.isDestroyed()) window.webContents.send('kitsune:update-status', { event: 'not-available' });
  });
  autoUpdater.on('download-progress', (progress) => {
    if (window && !window.isDestroyed()) window.webContents.send('kitsune:update-status', { event: 'progress', percent: Math.round(progress.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateAvailable = info;
    if (window && !window.isDestroyed()) window.webContents.send('kitsune:update-status', { event: 'downloaded', info });
  });
  autoUpdater.on('error', (error) => {
    if (window && !window.isDestroyed()) window.webContents.send('kitsune:update-status', { event: 'error', message: error?.message || String(error) });
  });
  autoUpdater.checkForUpdates().catch(() => {});
  // Re-check every 30 minutes
  setInterval(() => { if (serverUrl && autoUpdater) autoUpdater.checkForUpdates().catch(() => {}); }, 30 * 60 * 1000);
}

function registerIpcHandlers() {
  ipcMain.handle('kitsune:check-updates', () => { if (serverUrl && autoUpdater) autoUpdater.checkForUpdates().catch(() => {}); return true; });
  ipcMain.handle('kitsune:install-update', () => {
    if (updateAvailable && autoUpdater) { autoUpdater.quitAndInstall(); return true; }
    return false;
  });
  ipcMain.handle('kitsune:show-setup', (event) => {
    if (!event.senderFrame.url.startsWith('file:') && !event.senderFrame.url.startsWith(serverUrl || 'file:')) throw new Error('Not allowed.');
    showSetup();
    return true;
  });
  ipcMain.handle('kitsune:get-server', event => event.senderFrame.url.startsWith('file:') ? serverUrl : null);
  ipcMain.handle('kitsune:set-server', async (event, value) => {
    if (!event.senderFrame.url.startsWith('file:')) throw new Error('Not allowed.');
    const url = await validateServer(value);
    serverUrl = url;
    saveServerUrl(url);
    loadApp();
    setupAutoUpdater();
    return url;
  });
}

function createWindow() {
  window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: '#07070a',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:') && serverUrl && !url.startsWith(`${serverUrl}/`)) event.preventDefault();
  });
  configurePermissions();
  installMenu();
  serverUrl = loadServerUrl();
  if (serverUrl) { loadApp(); setupAutoUpdater(); } else showSetup();
}

function configurePermissions() {
  const ses = session.defaultSession;
  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return Boolean(serverUrl && requestingOrigin.startsWith(serverUrl) && ['media', 'notifications', 'fullscreen', 'clipboard-sanitized-write'].includes(permission));
  });
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(Boolean(serverUrl && webContents.getURL().startsWith(serverUrl) && ['media', 'notifications', 'fullscreen', 'clipboard-sanitized-write'].includes(permission)));
  });
  ses.setDisplayMediaRequestHandler((_request, callback) => callback({}), { useSystemPicker: true });
}

function installMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Kitsune', submenu: [
      { label: 'Change Server', click: showSetup },
      { label: 'Reload', accelerator: 'Ctrl+R', click: () => window?.webContents.reload() },
      { type: 'separator' },
      { role: 'quit' },
    ]},
    { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'toggleDevTools' }] },
  ]));
}

function showSetup() {
  if (!window) return;
  window.loadFile(path.join(__dirname, 'setup.html'));
}

function loadApp() {
  window.loadURL(`${serverUrl}/app/`);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
