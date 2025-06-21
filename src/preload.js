const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getApps: () => ipcRenderer.invoke('get-apps'),
  getInstalledApps: () => ipcRenderer.invoke('get-installed-apps'),
  downloadApp: (app) => ipcRenderer.invoke('download-app', app),
  openApp: (appId) => ipcRenderer.invoke('open-app', appId),
  checkForUpdates: (appId) => ipcRenderer.invoke('check-for-updates', appId),
  uninstallApp: (appId) => ipcRenderer.invoke('uninstall-app', appId),
  showDownloadProgress: (message, progress) => ipcRenderer.invoke('show-download-progress', message, progress),
  openDownloadFolder: (folderPath) => ipcRenderer.invoke('open-download-folder', folderPath),
  
  // Download control
  pauseDownload: (appId) => ipcRenderer.invoke('pause-download', appId),
  resumeDownload: (appId) => ipcRenderer.invoke('resume-download', appId),
  cancelDownload: (appId) => ipcRenderer.invoke('cancel-download', appId),
    // Listen for progress updates
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  removeDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  },
  
  // Auto-update APIs
  checkAppUpdates: () => ipcRenderer.invoke('check-app-updates'),
  downloadAppUpdate: (updateInfo) => ipcRenderer.invoke('download-app-update', updateInfo),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
