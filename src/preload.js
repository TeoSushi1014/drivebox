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
  checkAppUpdatesManual: () => ipcRenderer.invoke('check-app-updates-manual'),
  downloadAppUpdate: (updateInfo) => ipcRenderer.invoke('download-app-update', updateInfo),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  
  // Update settings
  getUpdateSettings: () => ipcRenderer.invoke('get-update-settings'),
  setUpdateSettings: (settings) => ipcRenderer.invoke('set-update-settings', settings),
  
  // Update history and status
  getUpdateHistory: () => ipcRenderer.invoke('get-update-history'),
  getPendingUpdate: () => ipcRenderer.invoke('get-pending-update'),
  
  // Update progress listeners
  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (event, data) => callback(data));
  },
  onShowReleaseNotes: (callback) => {
    ipcRenderer.on('show-release-notes', (event, data) => callback(data));
  },
  onUpdateDownloadError: (callback) => {
    ipcRenderer.on('update-download-error', (event, data) => callback(data));
  },
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-download-progress');
    ipcRenderer.removeAllListeners('show-release-notes');
    ipcRenderer.removeAllListeners('update-download-error');
  }
});
