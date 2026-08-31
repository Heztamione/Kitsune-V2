const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kitsuneDesktop', {
  getServer: () => ipcRenderer.invoke('kitsune:get-server'),
  setServer: value => ipcRenderer.invoke('kitsune:set-server', value),
  showSetup: () => ipcRenderer.invoke('kitsune:show-setup'),
  checkUpdates: () => ipcRenderer.invoke('kitsune:check-updates'),
  installUpdate: () => ipcRenderer.invoke('kitsune:install-update'),
  onUpdateStatus: callback => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('kitsune:update-status', handler);
    return () => ipcRenderer.removeListener('kitsune:update-status', handler);
  },
});
