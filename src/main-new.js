const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs-extra');

// Import our new modules
const SyncEngine = require('./utils/syncEngine');
const SecurityManager = require('./utils/security');
const AuthenticationManager = require('./auth/authManager');
const GoogleDriveProvider = require('./providers/googleDrive');
const DropboxProvider = require('./providers/dropbox');
const configManager = require('./config/configManager');
const logger = require('./utils/logger');

// App state
let mainWindow;
let tray;
let syncEngine;
let authManager;
let isQuiting = false;

// Initialize the application
async function initialize() {
  try {
    logger.info('Initializing DriveBox application');
    
    // Initialize authentication manager
    authManager = new AuthenticationManager();
    
    // Initialize sync engine
    const syncConfig = configManager.get('sync');
    syncEngine = new SyncEngine({
      localPath: path.join(app.getPath('documents'), 'DriveBox'),
      conflictResolution: syncConfig.conflictResolution,
      syncInterval: syncConfig.interval
    });
    
    // Setup sync engine event listeners
    setupSyncEngineEvents();
    
    // Setup IPC handlers
    setupIpcHandlers();
    
    logger.info('Application initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize application', error);
    throw error;
  }
}

// Setup sync engine event listeners
function setupSyncEngineEvents() {
  syncEngine.on('syncStarted', () => {
    logger.sync('sync', 'started');
    sendToRenderer('sync-status', { status: 'started' });
  });

  syncEngine.on('syncStopped', () => {
    logger.sync('sync', 'stopped');
    sendToRenderer('sync-status', { status: 'stopped' });
  });

  syncEngine.on('syncProgress', (data) => {
    logger.sync('progress', data.type, data);
    sendToRenderer('sync-progress', data);
  });

  syncEngine.on('syncError', (error) => {
    logger.error('Sync error occurred', error.error, error);
    sendToRenderer('sync-error', error);
  });

  syncEngine.on('conflictDetected', (conflict) => {
    logger.warn('File conflict detected', conflict);
    sendToRenderer('conflict-detected', conflict);
  });

  syncEngine.on('fileDownloaded', (data) => {
    logger.file('download', data.file.path, 'success', data);
    sendToRenderer('file-downloaded', data);
  });

  syncEngine.on('localChange', (change) => {
    logger.file('change', change.path, 'detected', change);
    sendToRenderer('local-change', change);
  });
}

// Setup IPC handlers
function setupIpcHandlers() {
  // Authentication handlers
  ipcMain.handle('auth-register', async (event, userData) => {
    try {
      const result = await authManager.registerUser(userData);
      logger.auth('register', userData.username, true);
      return result;
    } catch (error) {
      logger.auth('register', userData.username, false, { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('auth-login', async (event, credentials) => {
    try {
      const result = await authManager.authenticateUser(
        credentials.username,
        credentials.password,
        credentials.twoFactorCode
      );
      logger.auth('login', credentials.username, true);
      return result;
    } catch (error) {
      logger.auth('login', credentials.username, false, { error: error.message });
      throw error;
    }
  });

  ipcMain.handle('auth-logout', async (event, sessionToken) => {
    try {
      authManager.logout(sessionToken);
      logger.auth('logout', 'user', true);
      return { success: true };
    } catch (error) {
      logger.auth('logout', 'user', false, { error: error.message });
      throw error;
    }
  });

  // Provider management handlers
  ipcMain.handle('provider-add-google-drive', async (event, credentials) => {
    try {
      const provider = new GoogleDriveProvider(credentials);
      const testResult = await provider.testConnection();
      
      if (testResult.connected) {
        syncEngine.addProvider('googleDrive', provider);
        configManager.setProviderConfig('googleDrive', credentials);
        logger.info('Google Drive provider added successfully');
        return { success: true, user: testResult.user };
      } else {
        throw new Error(testResult.error);
      }
    } catch (error) {
      logger.error('Failed to add Google Drive provider', error);
      throw error;
    }
  });

  ipcMain.handle('provider-add-dropbox', async (event, credentials) => {
    try {
      const provider = new DropboxProvider(credentials);
      const testResult = await provider.testConnection();
      
      if (testResult.connected) {
        syncEngine.addProvider('dropbox', provider);
        configManager.setProviderConfig('dropbox', credentials);
        logger.info('Dropbox provider added successfully');
        return { success: true, user: testResult.user };
      } else {
        throw new Error(testResult.error);
      }
    } catch (error) {
      logger.error('Failed to add Dropbox provider', error);
      throw error;
    }
  });

  ipcMain.handle('provider-remove', async (event, providerName) => {
    try {
      syncEngine.removeProvider(providerName);
      configManager.removeProviderConfig(providerName);
      logger.info(`Provider removed: ${providerName}`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to remove provider: ${providerName}`, error);
      throw error;
    }
  });

  // Sync management handlers
  ipcMain.handle('sync-start', async () => {
    try {
      await syncEngine.startSync();
      return { success: true };
    } catch (error) {
      logger.error('Failed to start sync', error);
      throw error;
    }
  });

  ipcMain.handle('sync-stop', async () => {
    try {
      await syncEngine.stopSync();
      return { success: true };
    } catch (error) {
      logger.error('Failed to stop sync', error);
      throw error;
    }
  });

  ipcMain.handle('sync-pause', async () => {
    try {
      syncEngine.pauseSync();
      return { success: true };
    } catch (error) {
      logger.error('Failed to pause sync', error);
      throw error;
    }
  });

  ipcMain.handle('sync-resume', async () => {
    try {
      syncEngine.resumeSync();
      return { success: true };
    } catch (error) {
      logger.error('Failed to resume sync', error);
      throw error;
    }
  });

  ipcMain.handle('sync-force-file', async (event, filePath) => {
    try {
      await syncEngine.forceSyncFile(filePath);
      return { success: true };
    } catch (error) {
      logger.error('Failed to force sync file', error, { filePath });
      throw error;
    }
  });

  ipcMain.handle('sync-get-stats', async () => {
    try {
      return syncEngine.getStats();
    } catch (error) {
      logger.error('Failed to get sync stats', error);
      throw error;
    }
  });

  // Configuration handlers
  ipcMain.handle('config-get', async (event, key) => {
    try {
      return configManager.get(key);
    } catch (error) {
      logger.error('Failed to get config', error, { key });
      throw error;
    }
  });

  ipcMain.handle('config-set', async (event, key, value) => {
    try {
      configManager.set(key, value);
      return { success: true };
    } catch (error) {
      logger.error('Failed to set config', error, { key, value });
      throw error;
    }
  });

  ipcMain.handle('config-get-all', async () => {
    try {
      return configManager.getAll();
    } catch (error) {
      logger.error('Failed to get all config', error);
      throw error;
    }
  });

  ipcMain.handle('config-export', async (event, filePath) => {
    try {
      return await configManager.exportConfig(filePath);
    } catch (error) {
      logger.error('Failed to export config', error, { filePath });
      throw error;
    }
  });

  ipcMain.handle('config-import', async (event, filePath) => {
    try {
      return await configManager.importConfig(filePath);
    } catch (error) {
      logger.error('Failed to import config', error, { filePath });
      throw error;
    }
  });

  // File management handlers
  ipcMain.handle('file-select-folder', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Sync Folder'
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, path: result.filePaths[0] };
      }
      
      return { success: false, canceled: true };
    } catch (error) {
      logger.error('Failed to select folder', error);
      throw error;
    }
  });

  ipcMain.handle('file-get-hash', async (event, filePath) => {
    try {
      const security = new SecurityManager();
      const hash = await security.generateFileHash(filePath);
      return { success: true, hash };
    } catch (error) {
      logger.error('Failed to get file hash', error, { filePath });
      throw error;
    }
  });

  // Logging handlers
  ipcMain.handle('logs-get-files', async () => {
    try {
      return await logger.getLogFiles();
    } catch (error) {
      logger.error('Failed to get log files', error);
      throw error;
    }
  });

  ipcMain.handle('logs-read-file', async (event, fileName, lines) => {
    try {
      return await logger.readLogFile(fileName, lines);
    } catch (error) {
      logger.error('Failed to read log file', error, { fileName });
      throw error;
    }
  });

  ipcMain.handle('logs-search', async (event, query, options) => {
    try {
      return await logger.searchLogs(query, options);
    } catch (error) {
      logger.error('Failed to search logs', error, { query });
      throw error;
    }
  });

  // Window management handlers
  ipcMain.handle('window-minimize', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.restore();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window-close', () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });
}

// Create main window
function createMainWindow() {
  const windowState = configManager.get('ui.windowState');
  
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    icon: path.join(__dirname, '../assets/icon.png')
  });

  if (windowState.maximized) {
    mainWindow.maximize();
  }

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    const startMinimized = configManager.get('app.startMinimized');
    if (!startMinimized) {
      mainWindow.show();
    }
  });

  // Save window state on close
  mainWindow.on('close', (event) => {
    const closeToTray = configManager.get('app.closeToTray');
    
    if (!isQuiting && closeToTray) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }

    // Save window state
    const bounds = mainWindow.getBounds();
    configManager.updateSection('ui.windowState', {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      maximized: mainWindow.isMaximized()
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create system tray
function createTray() {
  if (!configManager.get('ui.tray.enabled')) {
    return;
  }

  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  tray = new Tray(nativeImage.createFromPath(iconPath));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show DriveBox',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Sync Status',
      submenu: [
        {
          label: 'Start Sync',
          click: async () => {
            try {
              await syncEngine.startSync();
            } catch (error) {
              logger.error('Failed to start sync from tray', error);
            }
          }
        },
        {
          label: 'Stop Sync',
          click: async () => {
            try {
              await syncEngine.stopSync();
            } catch (error) {
              logger.error('Failed to stop sync from tray', error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Sync Stats',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.webContents.send('show-sync-stats');
            }
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('show-settings');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('DriveBox - Cloud Sync');

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Send message to renderer process
function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

// App event handlers
app.whenReady().then(async () => {
  try {
    await initialize();
    createMainWindow();
    createTray();
    
    logger.info('DriveBox application started successfully');
  } catch (error) {
    logger.error('Failed to start application', error);
    dialog.showErrorBox('Startup Error', `Failed to start DriveBox: ${error.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuiting = true;
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('before-quit', async () => {
  isQuiting = true;
  
  try {
    if (syncEngine) {
      await syncEngine.stopSync();
    }
    
    logger.info('DriveBox application shutting down');
    logger.close();
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Handle unhandled exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', reason, { promise });
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { app, mainWindow, syncEngine, authManager };
