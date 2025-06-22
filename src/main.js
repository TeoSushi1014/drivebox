/**
 * DriveBox - App Installer & Updater
 * Author: Hoàng Việt Quang (Tèo Sushi)
 * GitHub: https://github.com/TeoSushi1014/drivebox
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const fetch = require('node-fetch');
const extractZip = require('extract-zip');
const open = require('open');
const os = require('os');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Set proper encoding for console output
if (process.platform === 'win32') {
  try {
    // Set console code page to UTF-8 for proper Unicode display
    const { execSync } = require('child_process');
    
    // Set Windows console to UTF-8 code page
    execSync('chcp 65001', { stdio: 'ignore' });
    
    // Set environment variables for proper UTF-8 handling
    process.env.PYTHONIOENCODING = 'utf-8';
    
    console.log('Console encoding configured for UTF-8');
  } catch (e) {
    console.log('Could not set UTF-8 encoding for console:', e.message);
  }
}

// Initialize electron-store
const store = new Store();

// Helper function to read apps.json with proper path resolution
function getAppsData() {
  try {
    let appsPath;
    
    if (app.isPackaged) {
      // In production, files are in asar package
      appsPath = path.join(__dirname, '../data/apps.json');
      console.log('Production mode - Looking for apps.json at:', appsPath);
    } else {
      // In development, use direct path
      appsPath = path.join(app.getAppPath(), 'data', 'apps.json');
      console.log('Development mode - Looking for apps.json at:', appsPath);
    }
    
    if (fs.existsSync(appsPath)) {
      const appsData = fs.readFileSync(appsPath, 'utf8');
      const parsedData = JSON.parse(appsData);
      console.log(`Successfully loaded ${parsedData.length} apps from apps.json`);
      return parsedData;
    } else {
      console.error('apps.json not found at:', appsPath);
      
      // Try alternative paths
      const altPaths = [
        path.join(__dirname, '../data/apps.json'),
        path.join(app.getAppPath(), 'data', 'apps.json'),
        path.join(process.resourcesPath, 'data', 'apps.json'),
        path.join(process.resourcesPath, 'app', 'data', 'apps.json')
      ];
      
      for (const altPath of altPaths) {
        console.log('Trying alternative path:', altPath);
        if (fs.existsSync(altPath)) {
          const appsData = fs.readFileSync(altPath, 'utf8');
          const parsedData = JSON.parse(appsData);
          console.log(`Successfully loaded ${parsedData.length} apps from alternative path`);
          return parsedData;
        }
      }
    }
    
    console.error('apps.json not found in any expected location');
    console.log('Available paths:');
    console.log('  __dirname:', __dirname);
    console.log('  app.getAppPath():', app.getAppPath());
    console.log('  process.resourcesPath:', process.resourcesPath);
    
    return [];
  } catch (error) {
    console.error('Error reading apps.json:', error);
    return [];
  }
}

// Download management
const activeDownloads = new Map();

let mainWindow;

// Helper function to get direct download URL from MediaFire
async function getDirectDownloadUrl(url) {
  try {
    console.log('Attempting to parse MediaFire URL:', url);
    
    // Set proper headers to mimic a browser request
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log('MediaFire page loaded, parsing for download link...');
    
    // Multiple patterns to find the download link
    const patterns = [
      /href="(https:\/\/download\d+\.mediafire\.com[^"]+)"/,
      /"(https:\/\/download\d+\.mediafire\.com[^"]+)"/,
      /window\.location\.href\s*=\s*["'](https:\/\/download\d+\.mediafire\.com[^"']+)["']/,
      /DownloadUrl["']?\s*:\s*["'](https:\/\/download\d+\.mediafire\.com[^"']+)["']/
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        console.log('Found MediaFire direct link:', match[1]);
        return match[1];
      }
    }
    
    // If no direct link found, try to find the file ID and construct the link
    const fileIdMatch = url.match(/\/file\/([^\/]+)\//);
    if (fileIdMatch) {
      console.log('Trying alternative MediaFire approach with file ID:', fileIdMatch[1]);
      // Sometimes MediaFire uses a different pattern
      const alternativePattern = new RegExp(`https://download\\d+\\.mediafire\\.com/[^"']+${fileIdMatch[1]}[^"']*`, 'i');
      const altMatch = html.match(alternativePattern);
      if (altMatch) {
        console.log('Found alternative MediaFire link:', altMatch[0]);
        return altMatch[0];
      }
    }
    
    console.error('MediaFire HTML content (first 1000 chars):', html.substring(0, 1000));
    throw new Error('Could not find direct download link in MediaFire page');
  } catch (error) {
    console.error('MediaFire parse error:', error);
    throw new Error(`Failed to parse MediaFire link: ${error.message}`);
  }
}

// Function to parse MediaFire link and get direct download URL
async function getDirectDownloadUrlOld(url) {
  try {
    // If it's already a direct link, return as is
    if (!url.includes('mediafire.com/file/')) {
      return url;
    }
    
    // Parse MediaFire page to get direct download link
    const response = await fetch(url);
    const html = await response.text();
    
    // Look for the download link in the HTML
    const downloadMatch = html.match(/href="(https:\/\/download\d+\.mediafire\.com[^"]+)"/);
    if (downloadMatch) {
      return downloadMatch[1];
    }
    
    // Alternative pattern
    const altMatch = html.match(/window\.location\.href = "([^"]+)"/);
    if (altMatch) {
      return altMatch[1];
    }
    
    throw new Error('Could not find direct download link in MediaFire page');
  } catch (error) {
    console.error('Error parsing MediaFire URL:', error);
    throw error;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      // Disable cache to avoid permission issues
      cache: false
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  console.log('App is ready, creating window...');
  console.log('App path:', app.getAppPath());
  console.log('Is packaged:', app.isPackaged);
  
  // Test loading apps data on startup
  const appsData = getAppsData();
  console.log(`Loaded ${appsData.length} apps from configuration`);
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  // Ensure download directory exists
  const downloadDir = 'C:\\Tèo Sushi';
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-apps', async () => {
  try {
    return getAppsData();
  } catch (error) {
    console.error('Error in get-apps handler:', error);
    return [];
  }
});

ipcMain.handle('get-installed-apps', async () => {
  return store.get('installedApps', {});
});

// Helper: Check if all required files exist and are valid
function isAppAlreadyDownloaded(app, appDir) {
  // List of required files (main exe, setup files, etc.)
  const requiredFiles = [
    app.mainExecutable || 'OnTapMoPhong.exe',
    'install_all.bat',
    'K-Lite_Codec_Pack_1875_Mega.exe'
  ];
  try {
    for (const file of requiredFiles) {
      const filePath = path.join(appDir, file);
      if (!fs.existsSync(filePath)) {
        safeLogWarn(`Missing file: ${filePath}`);
        return false;
      }
      // Optionally, check file size > 0
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        safeLogWarn(`File is empty: ${filePath}`);
        return false;
      }
    }
    return true;
  } catch (e) {
    safeLogWarn('Error checking files:', e.message);
    return false;
  }
}

ipcMain.handle('download-app', async (event, app) => {
  try {
    safeLog('Starting download for app:', app.name);
    
    // Initialize download state
    const downloadState = {
      appId: app.id,
      paused: false,
      cancelled: false,
      controller: new AbortController()
    };
    activeDownloads.set(app.id, downloadState);
    
    // Thay đổi đường dẫn tải về thành C:\Tèo Sushi
    const baseDir = 'C:\\Tèo Sushi';
    
    // Extract filename from URL or use app fileName
    const fileName = app.fileName || `${app.id}.zip`;
    const folderName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
    const appDir = path.join(baseDir, folderName);
    
    // Tạo thư mục nếu chưa có
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }

    // Check if already downloaded and valid
    if (isAppAlreadyDownloaded(app, appDir)) {
      safeLog(`App already downloaded and valid: ${app.name}`);
      // Optionally, send progress to UI
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
          appId: app.id,
          progress: 100,
          status: 'already_downloaded',
          message: 'Đã có đủ file, bỏ qua tải lại.'
        });
      }
      // Create desktop shortcut
      let shortcutPath = null;
      try {
        shortcutPath = await createDesktopShortcut(app, appDir);
        safeLog('Desktop shortcut created successfully');
      } catch (shortcutError) {
        safeLogWarn('Failed to create desktop shortcut:', shortcutError.message);
      }
      // Update installed apps
      const installedApps = store.get('installedApps', {});
      installedApps[app.id] = {
        version: app.version,
        installedAt: new Date().toISOString(),
        path: appDir,
        needsExtraction: fileName.endsWith('.rar'),
        fileName: fileName,
        shortcutPath: shortcutPath,
        appName: app.name
      };
      store.set('installedApps', installedApps);
      // Register app with Windows (Add/Remove Programs)
      try {
        // Find the actual executable file using recursive search
        const findExecutable = (dir) => {
          try {
            const files = fs.readdirSync(dir, { withFileTypes: true });
            const executables = [];
            
            // Collect all .exe files in current directory
            for (const file of files) {
              if (file.isFile() && file.name.endsWith('.exe')) {
                const fullPath = path.join(dir, file.name);
                executables.push({
                  path: fullPath,
                  name: file.name.toLowerCase()
                });
              }
            }
                // Prioritize main app executables over installers/codecs
          const priorities = [
            'ontapmophong.exe',  // Main app for this specific case
            app.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.exe', // App name based exe
            folderName.toLowerCase() + '.exe' // Folder name based exe
          ];
            
            // First, try to find priority executables
            for (const priority of priorities) {
              const found = executables.find(exe => exe.name === priority.toLowerCase());
              if (found) {
                safeLog(`Found priority executable: ${found.path}`);
                return found.path;
              }
            }
            
            // Exclude common installer/codec patterns
            const excludePatterns = [
              'install',
              'setup',
              'codec',
              'k-lite',
              'vcredist',
              'redist',
              'uninstall'
            ];
            
            // Find non-installer executables
            for (const exe of executables) {
              const isInstaller = excludePatterns.some(pattern => 
                exe.name.includes(pattern)
              );
              if (!isInstaller) {
                safeLog(`Found main executable: ${exe.path}`);
                return exe.path;
              }
            }
            
            // If no main executable found, return the first one (fallback)
            if (executables.length > 0) {
              safeLog(`Using fallback executable: ${executables[0].path}`);
              return executables[0].path;
            }
            
            // If not found in current directory, search in subdirectories
            for (const file of files) {
              if (file.isDirectory()) {
                const subPath = path.join(dir, file.name);
                const found = findExecutable(subPath);
                if (found) return found;
              }
            }
          } catch (err) {
            safeLogWarn(`Error reading directory ${dir}:`, err.message);
          }
          return null;
        };
        
        const exePath = findExecutable(appDir);
        
        if (exePath) {
          safeLog('Registering app with Windows:', app.name);
          safeLog('Executable path:', exePath);
          
          // Try primary registration method first
          let registered = false;
          try {
            registered = await registerAppWithWindows(app, appDir, exePath);
            if (registered) {
              safeLog('App registered with Windows successfully (PowerShell method)');
            }
          } catch (regError) {
            safeLogWarn('PowerShell registration failed, trying alternative method...', regError.message);
            
            // Try direct registry method as fallback
            try {
              registered = await registerAppDirectly(app, appDir, exePath);
              if (registered) {
                safeLog('App registered with Windows successfully (direct method)');
              }
            } catch (altError) {
              safeLogWarn('Alternative registration also failed:', altError.message);
            }
          }
          
          if (!registered) {
            safeLogWarn('Both registration methods failed - app may not appear in Control Panel');
          }
        } else {
          safeLogWarn('No executable found in app directory or subdirectories, skipping Windows registration');
        }
      } catch (regError) {
        safeLogWarn('Failed to register app with Windows:', regError.message);
      }
      // Run setup steps if required
      if (app.requiresSetup && app.setupSteps && app.setupSteps.length > 0) {
        safeLog(`Running setup steps for: ${normalizeUnicode(app.name)}`);
        
        // Send setup start event to UI
        if (mainWindow) {
          mainWindow.webContents.send('download-progress', {
            appId: app.id,
            progress: 95,
            status: 'running_setup',
            message: 'Đang chạy các bước cài đặt bổ sung...'
          });
        }
        
        try {
          await runSetupSteps(app, appDir, mainWindow);
          safeLog('Setup steps completed successfully');
          
          // Send setup complete event
          if (mainWindow) {
            mainWindow.webContents.send('download-progress', {
              appId: app.id,
              progress: 100,
              status: 'setup_complete',
              message: 'Cài đặt hoàn tất!'
            });
          }
        } catch (setupError) {
          safeLogWarn('Setup steps failed:', setupError.message);
          
          // Send setup error event
          if (mainWindow) {
            mainWindow.webContents.send('download-progress', {
              appId: app.id,
              progress: 100,
              status: 'setup_warning',
              message: 'Cài đặt hoàn tất nhưng có lỗi setup'
            });
          }
        }
      }
      // Clean up download state
      activeDownloads.delete(app.id);

      console.log('App installation completed successfully (skipped download)');
      return { 
        success: true,
        path: appDir,
        needsExtraction: fileName.endsWith('.rar'),
        fileName: fileName,
        shortcutPath: shortcutPath,
        appName: app.name
      };    }    console.log('Starting file download...');
    
    // Get download URL from app config
    let downloadUrl = app.downloadUrl;
    if (!downloadUrl) {
      throw new Error('No download URL specified in app configuration');
    }
    
    // If it's a MediaFire link, get the direct download URL
    if (downloadUrl.includes('mediafire.com')) {
      console.log('Processing MediaFire URL...');
      try {
        downloadUrl = await getDirectDownloadUrl(downloadUrl);
        console.log('Got direct MediaFire URL');
      } catch (mediaFireError) {
        console.error('Failed to get MediaFire direct URL:', mediaFireError.message);
        throw new Error(`Failed to process MediaFire URL: ${mediaFireError.message}`);
      }
    }
    
    console.log('Download URL:', downloadUrl);
    const filePath = path.join(appDir, fileName);
      try {
      console.log('Downloading directly to file (streaming method)...');
      console.log('Memory usage before download:', getMemoryUsage());
      
      await downloadToFileStream(downloadUrl, filePath, (progressData) => {
        if (mainWindow) {
          mainWindow.webContents.send('download-progress', {
            ...progressData,
            message: `Đang tải... ${progressData.progress}% (${progressData.speed} MB/s)`
          });
        }
      });
      
      console.log('Download completed successfully. File saved to:', filePath);
      console.log('Memory usage after download:', getMemoryUsage());
      
      // Force garbage collection after large downloads
      forceGarbageCollection();
    } catch (streamError) {
      console.log('Streaming download failed, trying legacy method:', streamError.message);
      
      // Fallback to old method only for small files (limit to 500MB to prevent crashes)
      try {
        const response = await fetch(downloadUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Download failed: HTTP ${response.status} - ${response.statusText}`);
        }        const contentLength = parseInt(response.headers.get('content-length') || '0');
        if (contentLength > 500 * 1024 * 1024) { // 500MB limit
          throw new Error(`File too large for fallback method (${Math.round(contentLength/1024/1024)}MB > 500MB). Use streaming download.`);
        }

        console.log('Using fetch buffer method for small file...');
        console.log('Memory usage before buffer allocation:', getMemoryUsage());
        
        const buffer = await response.buffer();
        fs.writeFileSync(filePath, buffer);
        
        console.log('Download completed via fallback method. File size:', buffer.length, 'bytes');
        console.log('Memory usage after buffer method:', getMemoryUsage());
        
        // Clear buffer reference and force garbage collection
        buffer.length = 0;
        forceGarbageCollection();
        
        // Send completion update
        if (mainWindow) {
          mainWindow.webContents.send('download-progress', {
            progress: 100,
            downloadedSize: buffer.length,
            totalSize: buffer.length,
            speed: '0',
            eta: '00:00',
            message: 'Tải hoàn thành!'
          });
        }
      } catch (fallbackError) {
        console.error('Both streaming and fallback methods failed:', fallbackError.message);
        throw fallbackError;
      }
    }// Extract if it's a zip file only
    if (fileName.endsWith('.zip')) {
      console.log('Extracting ZIP file...');
      await extractZip(filePath, { dir: appDir });
      // Remove zip file after extraction
      fs.unlinkSync(filePath);
      console.log('ZIP extraction completed');
    }
    // For RAR files, keep them for manual extraction
    
    // Create desktop shortcut
    let shortcutPath = null;
    try {
      shortcutPath = await createDesktopShortcut(app, appDir);
      console.log('Desktop shortcut created successfully');
    } catch (shortcutError) {
      console.log('Failed to create desktop shortcut:', shortcutError.message);
      // Don't fail the entire installation for shortcut errors
    }
      // Update installed apps
    const installedApps = store.get('installedApps', {});
    installedApps[app.id] = {
      version: app.version,
      installedAt: new Date().toISOString(),
      path: appDir,
      needsExtraction: fileName.endsWith('.rar'),
      fileName: fileName,
      shortcutPath: shortcutPath,
      appName: app.name
    };
    store.set('installedApps', installedApps);    // Register app with Windows (Add/Remove Programs)
    try {      // Find the actual executable file using recursive search
      const findExecutable = (dir) => {
        try {
          const files = fs.readdirSync(dir, { withFileTypes: true });
          const executables = [];
          
          // Collect all .exe files in current directory
          for (const file of files) {
            if (file.isFile() && file.name.endsWith('.exe')) {
              const fullPath = path.join(dir, file.name);
              executables.push({
                path: fullPath,
                name: file.name.toLowerCase()
              });
            }
          }
            // Prioritize main app executables over installers/codecs
          const priorities = [
            'ontapmophong.exe',  // Main app for this specific case
            app.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.exe', // App name based exe
            folderName.toLowerCase() + '.exe' // Folder name based exe
          ];
          
          // First, try to find priority executables
          for (const priority of priorities) {
            const found = executables.find(exe => exe.name === priority.toLowerCase());
            if (found) {
              console.log(`Found priority executable: ${found.path}`);
              return found.path;
            }
          }
          
          // Exclude common installer/codec patterns
          const excludePatterns = [
            'install',
            'setup',
            'codec',
            'k-lite',
            'vcredist',
            'redist',
            'uninstall'
          ];
          
          // Find non-installer executables
          for (const exe of executables) {
            const isInstaller = excludePatterns.some(pattern => 
              exe.name.includes(pattern)
            );
            if (!isInstaller) {
              console.log(`Found main executable: ${exe.path}`);
              return exe.path;
            }
          }
          
          // If no main executable found, return the first one (fallback)
          if (executables.length > 0) {
            console.log(`Using fallback executable: ${executables[0].path}`);
            return executables[0].path;
          }
          
          // If not found in current directory, search in subdirectories
          for (const file of files) {
            if (file.isDirectory()) {
              const subPath = path.join(dir, file.name);
              const found = findExecutable(subPath);
              if (found) return found;
            }
          }
        } catch (err) {
          console.warn(`Error reading directory ${dir}:`, err.message);
        }
        return null;
      };
      
      const exePath = findExecutable(appDir);
      
      if (exePath) {        safeLog('Registering app with Windows:', app.name);
        console.log('Executable path:', exePath);
        
        // Try primary registration method first
        let registered = false;
        try {
          registered = await registerAppWithWindows(app, appDir, exePath);
          if (registered) {
            console.log('App registered with Windows successfully (PowerShell method)');
          }
        } catch (regError) {
          console.log('PowerShell registration failed, trying alternative method...', regError.message);
          
          // Try direct registry method as fallback
          try {
            registered = await registerAppDirectly(app, appDir, exePath);
            if (registered) {
              console.log('App registered with Windows successfully (direct method)');
            }
          } catch (altError) {
            console.log('Alternative registration also failed:', altError.message);
          }
        }
        
        if (!registered) {
          console.log('Both registration methods failed - app may not appear in Control Panel');
        }
      } else {
        console.log('No executable found in app directory or subdirectories, skipping Windows registration');
      }
    } catch (regError) {
      console.log('Failed to register app with Windows:', regError.message);
      // Don't fail the installation if registration fails
    }    // Run setup steps if required
    if (app.requiresSetup && app.setupSteps && app.setupSteps.length > 0) {
      safeLog(`Running setup steps for: ${normalizeUnicode(app.name)}`);
      
      // Send setup start event to UI
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
          appId: app.id,
          progress: 95,
          status: 'running_setup',
          message: 'Đang chạy các bước cài đặt bổ sung...'
        });
      }
      
      try {
        await runSetupSteps(app, appDir, mainWindow);
        safeLog('Setup steps completed successfully');
        
        // Send setup complete event
        if (mainWindow) {
          mainWindow.webContents.send('download-progress', {
            appId: app.id,
            progress: 100,
            status: 'setup_complete',
            message: 'Cài đặt hoàn tất!'
          });
        }
      } catch (setupError) {
        safeLogWarn('Setup steps failed:', setupError.message);
        
        // Send setup error event
        if (mainWindow) {
          mainWindow.webContents.send('download-progress', {
            appId: app.id,
            progress: 100,
            status: 'setup_warning',
            message: 'Cài đặt hoàn tất nhưng có lỗi setup'
          });
        }
      }
    }
    // Clean up download state
    activeDownloads.delete(app.id);

    console.log('App installation completed successfully');
    return { 
      success: true,
      path: appDir,
      needsExtraction: fileName.endsWith('.rar'),
      fileName: fileName
    };  } catch (error) {
    console.error('Download error details:', error);
    // Clean up download state on error
    activeDownloads.delete(app.id);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-app', async (event, appId) => {
  try {
    const installedApps = store.get('installedApps', {});
    const appInfo = installedApps[appId];
    
    if (!appInfo) {
      throw new Error('App not installed');
    }    // Get app configuration to check for executablePath
    const appsData = getAppsData();
    const appConfig = appsData.find(a => a.id === appId);
    
    let executablePath = null;
      // First, check if app config has executablePath
    safeLog(`App config found: ${appConfig ? 'Yes' : 'No'}`);    if (appConfig && appConfig.executablePath) {
      safeLog(`Configured executable path: ${appConfig.executablePath}`);
      
      // Handle both absolute and relative paths
      let fullExecutablePath;
      if (path.isAbsolute(appConfig.executablePath)) {
        fullExecutablePath = appConfig.executablePath;
      } else {
        // Relative path - combine with app directory
        fullExecutablePath = path.join(appInfo.path, appConfig.executablePath);
      }
      
      safeLog(`Full executable path: ${fullExecutablePath}`);
      safeLog(`Path exists: ${fs.existsSync(fullExecutablePath)}`);
        if (fs.existsSync(fullExecutablePath)) {
        executablePath = fullExecutablePath;
        safeLog(`Using configured executable path: ${executablePath}`);
      } else {
        safeLogWarn(`Configured executable path does not exist: ${fullExecutablePath}`);
        // Try fallback search even if configured path exists but is wrong
        safeLog('Falling back to automatic search...');
      }
    }
    
    // If no valid executable found from config, or config path is wrong, search automatically
    if (!executablePath) {
      safeLog('No executablePath configured, searching in app directory');
      // Fallback to searching in app directory (recursive search)
      const appPath = appInfo.path;
      
      const findExecutableRecursive = (dir, depth = 0) => {
        if (depth > 3) return null; // Limit recursion depth
        
        try {
          const files = fs.readdirSync(dir, { withFileTypes: true });
          const executables = [];
          
          // Collect all .exe files in current directory
          for (const file of files) {
            if (file.isFile() && file.name.endsWith('.exe')) {
              const fullPath = path.join(dir, file.name);
              executables.push({
                path: fullPath,
                name: file.name.toLowerCase(),
                priority: 0
              });
            }
          }
            // Prioritize main app executables over installers/codecs
          const priorities = [
            { pattern: 'ontapmophong.exe', priority: 10 },
            { pattern: 'ontap', priority: 8 },
            { pattern: 'mophong', priority: 7 },
            { pattern: appId.toLowerCase(), priority: 6 }
          ];
          
          // Exclude patterns (lower priority)
          const excludePatterns = [
            'install', 'setup', 'codec', 'k-lite', 'vcredist', 'redist', 'uninstall'
          ];
          
          // Calculate priorities
          for (const exe of executables) {
            // Check priority patterns
            for (const { pattern, priority } of priorities) {
              if (exe.name.includes(pattern)) {
                exe.priority = Math.max(exe.priority, priority);
              }
            }
            
            // Check exclude patterns (reduce priority)
            for (const excludePattern of excludePatterns) {
              if (exe.name.includes(excludePattern)) {
                exe.priority = Math.max(0, exe.priority - 5);
              }
            }
          }
          
          // Sort by priority (highest first)
          executables.sort((a, b) => b.priority - a.priority);
          
          // Return highest priority executable
          if (executables.length > 0 && executables[0].priority >= 0) {
            safeLog(`Found executable: ${executables[0].path} (priority: ${executables[0].priority})`);
            return executables[0].path;
          }
          
          // If no good executable found in current directory, search subdirectories
          for (const file of files) {
            if (file.isDirectory() && !file.name.startsWith('.')) {
              const subPath = path.join(dir, file.name);
              const found = findExecutableRecursive(subPath, depth + 1);
              if (found) return found;
            }
          }
        } catch (err) {
          safeLogWarn(`Error reading directory ${dir}:`, err.message);
        }
        return null;
      };
      
      executablePath = findExecutableRecursive(appPath);
    }    if (executablePath && fs.existsSync(executablePath)) {
      safeLog(`Attempting to open: ${executablePath}`);
      try {
        // Use spawn instead of open for better Windows compatibility
        const { spawn } = require('child_process');
        
        // Set working directory to the directory containing the executable
        const workingDir = path.dirname(executablePath);
        safeLog(`Working directory: ${workingDir}`);
        
        const process = spawn(executablePath, [], {
          detached: true,
          stdio: 'ignore',
          cwd: workingDir, // Set proper working directory
          windowsHide: false // Allow window to show
        });
        
        process.unref(); // Allow parent process to exit independently
        
        // Wait a bit to check if process started successfully
        setTimeout(() => {
          safeLog(`Successfully launched: ${executablePath}`);
        }, 1000);
        
        return { success: true };
      } catch (openError) {
        safeLogError(`Failed to open executable: ${openError.message}`);
        
        // Try alternative method using 'start' command
        try {
          safeLog('Trying alternative launch method...');
          const { exec } = require('child_process');
          exec(`start "" "${executablePath}"`, { 
            cwd: path.dirname(executablePath),
            windowsHide: true
          }, (error) => {
            if (error) {
              safeLogError(`Alternative launch also failed: ${error.message}`);
            } else {
              safeLog('Alternative launch succeeded');
            }
          });
          return { success: true, message: 'Launched using alternative method' };
        } catch (altError) {
          safeLogError(`Alternative launch failed: ${altError.message}`);
          return { success: false, error: `Both launch methods failed: ${openError.message}` };
        }
      }    } else {
      // If no executable found, provide detailed error info
      safeLogError('No executable found!');
      safeLogError(`Configured path (raw): ${appConfig?.executablePath || 'None'}`);
      
      if (appConfig?.executablePath) {
        const fullPath = path.isAbsolute(appConfig.executablePath) 
          ? appConfig.executablePath 
          : path.join(appInfo.path, appConfig.executablePath);
        safeLogError(`Configured path (full): ${fullPath}`);
        safeLogError(`Configured path exists: ${fs.existsSync(fullPath)}`);
      }
      
      safeLogError(`App directory: ${appInfo.path}`);
      safeLogError(`App directory exists: ${fs.existsSync(appInfo.path)}`);
      
      // List files in app directory for debugging
      try {
        const listFilesRecursive = (dir, depth = 0) => {
          if (depth > 2) return []; // Limit depth
          let files = [];
          const items = fs.readdirSync(dir, { withFileTypes: true });
          
          for (const item of items) {
            const itemPath = path.join(dir, item.name);
            const relativePath = path.relative(appInfo.path, itemPath);
            
            if (item.isFile()) {
              files.push(`FILE: ${relativePath}`);
            } else if (item.isDirectory()) {
              files.push(`DIR:  ${relativePath}/`);
              // Recursively list subdirectory files
              const subFiles = listFilesRecursive(itemPath, depth + 1);
              files = files.concat(subFiles);
            }
          }
          return files;
        };
        
        const allFiles = listFilesRecursive(appInfo.path);
        safeLogError(`Files structure:`);
        allFiles.forEach(file => safeLogError(`  ${file}`));
      } catch (listError) {
        safeLogError(`Cannot list app directory: ${listError.message}`);
      }
      
      // Open the folder instead
      const appPath = appInfo.path;
      await open(appPath);
      return { 
        success: false, 
        error: 'Executable not found. Opened app folder instead.',
        debug: {
          configuredPath: appConfig?.executablePath,
          appDirectory: appInfo.path,
          searchPerformed: !appConfig?.executablePath
        }
      };
    }
  } catch (error) {
    console.error('Open app error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-for-updates', async (event, appId) => {
  try {
    const appsData = getAppsData();
    if (appsData.length === 0) {
      return { success: false, error: 'Could not read apps configuration' };
    }
    const app = appsData.find(a => a.id === appId);
    
    if (!app) {
      throw new Error('App not found');
    }

    const installedApps = store.get('installedApps', {});
    const installedVersion = installedApps[appId]?.version;

    return {
      hasUpdate: installedVersion !== app.version,
      currentVersion: installedVersion,
      latestVersion: app.version
    };
  } catch (error) {
    console.error('Check updates error:', error);
    return { hasUpdate: false, error: error.message };
  }
});

ipcMain.handle('uninstall-app', async (event, appId) => {
  try {
    const installedApps = store.get('installedApps', {});
    const appInfo = installedApps[appId];
    
    if (appInfo) {
      safeLog(`Starting uninstall for app: ${appInfo.appName || appId}`);
      safeLog(`App directory: ${appInfo.path}`);
      
      // Step 1: Remove desktop shortcut if exists
      if (appInfo.appName) {
        try {
          await removeDesktopShortcut(appInfo.appName);
          safeLog('Desktop shortcut removed for:', appInfo.appName);
        } catch (shortcutError) {
          safeLogWarn('Failed to remove desktop shortcut:', shortcutError.message);
        }
      }
      
      // Step 2: Try to terminate any running processes from this app
      try {
        const { exec } = require('child_process');
        const appDirName = path.basename(appInfo.path);
        safeLog(`Attempting to close any running processes from: ${appDirName}`);
        
        // Kill any processes that might be running from this directory
        await new Promise((resolve) => {
          exec(`taskkill /F /FI "IMAGENAME eq OnTapMoPhong.exe" /T`, { windowsHide: true }, (error) => {
            if (error) {
              safeLog('No running processes found to terminate (normal)');
            } else {
              safeLog('Successfully terminated running processes');
            }
            resolve();
          });
        });
        
        // Wait a bit for processes to fully terminate
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (processError) {
        safeLogWarn('Error terminating processes:', processError.message);
      }
      
      // Step 3: Remove app directory with better error handling
      if (fs.existsSync(appInfo.path)) {
        try {
          safeLog(`Attempting to remove directory: ${appInfo.path}`);
          
          // First try normal removal
          fs.rmSync(appInfo.path, { recursive: true, force: true });
          safeLog('Directory removed successfully');
          
        } catch (removeError) {
          safeLogError('Direct removal failed:', removeError.message);
          
          // Try alternative methods
          try {
            safeLog('Trying alternative removal method...');
            
            // Method 1: Use PowerShell Remove-Item with Force
            const { spawn } = require('child_process');
            await new Promise((resolve, reject) => {
              const powershell = spawn('powershell.exe', [
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-Command', `Remove-Item -Path "${appInfo.path}" -Recurse -Force -ErrorAction SilentlyContinue`
              ], { windowsHide: true });
              
              powershell.on('close', (code) => {
                if (code === 0) {
                  safeLog('PowerShell removal succeeded');
                  resolve();
                } else {
                  reject(new Error(`PowerShell removal failed with code ${code}`));
                }
              });
              
              powershell.on('error', reject);
            });
            
          } catch (psError) {
            safeLogError('PowerShell removal also failed:', psError.message);
            
            // Method 2: Try Windows rmdir command
            try {
              safeLog('Trying Windows rmdir command...');
              const { exec } = require('child_process');
              await new Promise((resolve, reject) => {
                exec(`rmdir /s /q "${appInfo.path}"`, { windowsHide: true }, (error) => {
                  if (error) {
                    reject(error);
                  } else {
                    safeLog('Windows rmdir succeeded');
                    resolve();
                  }
                });
              });
              
            } catch (rmdirError) {
              safeLogError('Windows rmdir also failed:', rmdirError.message);
              
              // Final fallback: Mark individual files for deletion
              try {
                safeLog('Attempting to mark files for deletion on reboot...');
                const { exec } = require('child_process');
                
                await new Promise((resolve) => {
                  exec(`schtasks /create /tn "DriveBox_Cleanup_${Date.now()}" /tr "rmdir /s /q \\"${appInfo.path}\\"" /sc onstart /ru SYSTEM /f`, 
                    { windowsHide: true }, (error) => {
                    if (error) {
                      safeLogWarn('Could not schedule cleanup task:', error.message);
                    } else {
                      safeLog('Scheduled cleanup task created - directory will be removed on next reboot');
                    }
                    resolve();
                  });
                });
                
              } catch (scheduleError) {
                safeLogError('Failed to schedule cleanup:', scheduleError.message);
              }
            }
          }
        }
        
        // Check if directory was actually removed
        if (fs.existsSync(appInfo.path)) {
          safeLogWarn('Directory still exists after removal attempts');
          safeLogWarn('This may be due to files being in use or permission issues');
          safeLogWarn('Some files may be removed after system restart');
        } else {
          safeLog('Directory successfully removed');
        }
      }
    }

    // Step 4: Remove from installed apps registry (always do this)
    delete installedApps[appId];
    store.set('installedApps', installedApps);
    safeLog('App removed from installed apps registry');

    // Step 5: Unregister app from Windows (if registered)
    if (appInfo && appInfo.appName) {
      try {
        await unregisterAppFromWindows(appInfo.appName);
        safeLog('App unregistered from Windows registry:', appInfo.appName);
      } catch (unregError) {
        safeLogWarn('Failed to unregister app from Windows:', unregError.message);
      }
    }

    safeLog(`Uninstall completed for: ${appInfo?.appName || appId}`);
    return { success: true };
    
  } catch (error) {
    safeLogError('Uninstall error:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler for progress updates
ipcMain.handle('show-download-progress', async (event, message, progress = 0) => {
  // Send progress update to renderer
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', { message, progress });
  }
});

// IPC Handler to open download folder
ipcMain.handle('open-download-folder', async (event, folderPath) => {
  try {
    await open(folderPath);
    return { success: true };
  } catch (error) {
    console.error('Error opening folder:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler to pause download
ipcMain.handle('pause-download', async (event, appId) => {
  try {
    const download = activeDownloads.get(appId);
    if (download && download.controller) {
      download.paused = true;
      console.log(`Download paused for app: ${appId}`);
      return { success: true };
    }
    return { success: false, error: 'Download not found' };
  } catch (error) {
    console.error('Error pausing download:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler to resume download
ipcMain.handle('resume-download', async (event, appId) => {
  try {
    const download = activeDownloads.get(appId);
    if (download && download.paused) {
      download.paused = false;
      console.log(`Download resumed for app: ${appId}`);
      return { success: true };
    }
    return { success: false, error: 'Download not found or not paused' };
  } catch (error) {
    console.error('Error resuming download:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler to cancel download
ipcMain.handle('cancel-download', async (event, appId) => {
  try {
    const download = activeDownloads.get(appId);
    if (download) {
      if (download.controller) {
        download.controller.abort();
      }
      activeDownloads.delete(appId);
      console.log(`Download cancelled for app: ${appId}`);
      return { success: true };
    }
    return { success: false, error: 'Download not found' };
  } catch (error) {
    console.error('Error cancelling download:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to create desktop shortcut
async function createDesktopShortcut(app, appPath) {
  try {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    // Create safe filename
    const safeName = createSafeFilename(app.name);
    const shortcutPath = path.join(desktopPath, `${safeName}.lnk`);
      safeLog(`Creating shortcut: "${normalizeUnicode(app.name)}" -> "${safeName}.lnk"`);
    
    // Find executable file in app directory (recursive search)
    let executablePath = null;
      const findExecutable = (dir) => {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        const executables = [];
        
        // Collect all .exe files in current directory
        for (const file of files) {
          if (file.isFile() && file.name.endsWith('.exe')) {
            const fullPath = path.join(dir, file.name);
            executables.push({
              path: fullPath,
              name: file.name.toLowerCase()
            });
          }
        }
          // Prioritize main app executables over installers/codecs
        const priorities = [
          'ontapmophong.exe',  // Main app for this specific case
          app.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.exe', // App name based exe
        ];
        
        // First, try to find priority executables (exact match)
        for (const priority of priorities) {
          const found = executables.find(exe => exe.name === priority.toLowerCase());
          if (found) {
            safeLog(`Found priority executable: ${found.path}`);
            return found.path;
          }
        }
        
        // Exclude common installer/codec patterns (more comprehensive)
        const excludePatterns = [
          'install',
          'setup',
          'codec',
          'k-lite',
          'klite',
          'k_lite',
          'vcredist',
          'redist',
          'uninstall',
          'mega.exe', // Specifically exclude K-Lite Mega
          '_mega.exe'
        ];
        
        // Find non-installer executables
        const validExecutables = [];
        for (const exe of executables) {
          const isInstaller = excludePatterns.some(pattern => 
            exe.name.includes(pattern.toLowerCase())
          );
          if (!isInstaller) {
            safeLog(`Found valid executable: ${exe.path}`);
            validExecutables.push(exe);
          } else {
            safeLog(`Excluded installer/codec: ${exe.path}`);
          }
        }
        
        // Return the first valid executable
        if (validExecutables.length > 0) {
          safeLog(`Using main executable: ${validExecutables[0].path}`);
          return validExecutables[0].path;
        }
        
        // If no main executable found, return the first non-installer one (fallback)
        if (executables.length > 0) {
          safeLog(`Using fallback executable: ${executables[0].path}`);
          return executables[0].path;
        }
        
        // If not found, search in subdirectories
        for (const file of files) {
          if (file.isDirectory()) {
            const subPath = path.join(dir, file.name);
            const found = findExecutable(subPath);
            if (found) return found;
          }
        }} catch (err) {
        safeLogWarn(`Error reading directory ${dir}:`, err.message);
      }
      return null;
    };
    
    executablePath = findExecutable(appPath);
    safeLog(`Executable search result: ${executablePath}`);
    if (executablePath && fs.existsSync(executablePath)) {
      // Use PowerShell for better Unicode and path handling
      const { spawn } = require('child_process');      // Create PowerShell script with proper Unicode handling
      const safeName = createSafeFilename(app.name);
      const safeDescription = removeVietnameseDiacritics(app.description || app.name); // Remove diacritics for PowerShell
      
      const powershellScript = `
# Set console encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\')}")
$Shortcut.TargetPath = "${executablePath.replace(/\\/g, '\\')}"
$Shortcut.WorkingDirectory = "${path.dirname(executablePath).replace(/\\/g, '\\')}"
$Shortcut.Description = "${safeDescription}"
$Shortcut.IconLocation = "${executablePath.replace(/\\/g, '\\')},0"
$Shortcut.WindowStyle = 1
$Shortcut.Save()
Write-Host "Shortcut created successfully: ${safeName}.lnk"
Write-Host "Target: ${executablePath.replace(/\\/g, '\\')}"
Write-Host "Working Directory: ${path.dirname(executablePath).replace(/\\/g, '\\')}"
      `.trim();      
      safeLog(`Creating shortcut for: ${normalizeUnicode(app.name)}`);
      safeLog('PowerShell script prepared');
      
      return new Promise((resolve, reject) => {
        const powershell = spawn('powershell.exe', [
          '-NoProfile',
          '-ExecutionPolicy', 'Bypass',
          '-Command', `& { ${powershellScript} }`  // Use -Command with script block for better control
        ], { 
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
          encoding: 'utf8'
        });
        
        let stdout = '';
        let stderr = '';
        
        powershell.stdout.on('data', (data) => {
          stdout += data.toString('utf8');
        });
        
        powershell.stderr.on('data', (data) => {
          stderr += data.toString('utf8');
        });
          powershell.on('close', (code) => {
          if (code === 0) {
            safeLog('Desktop shortcut created:', shortcutPath);
            safeLog('PowerShell output:', stdout);
            resolve(shortcutPath);
          } else {
            safeLogError('PowerShell error:', stderr);
            safeLogError('PowerShell output:', stdout);
            reject(new Error(`PowerShell exited with code ${code}: ${stderr || stdout}`));
          }
        });
        
        powershell.on('error', (error) => {
          safeLogError('PowerShell spawn error:', error);
          reject(error);
        });
      });
    } else {
      throw new Error('No executable file found for shortcut creation');
    }  } catch (error) {
    safeLogError('Error creating desktop shortcut:', error);
    throw error;
  }
}

// Helper function to remove desktop shortcut
async function removeDesktopShortcut(appName) {
  try {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    // Create safe filename (same logic as createDesktopShortcut)
    const safeName = createSafeFilename(appName);
    const shortcutPath = path.join(desktopPath, `${safeName}.lnk`);
    
    safeLog(`Attempting to remove shortcut for: ${normalizeUnicode(appName)}`);
    safeLog(`Shortcut path: ${shortcutPath}`);
    
    if (fs.existsSync(shortcutPath)) {
      fs.unlinkSync(shortcutPath);
      safeLog('Desktop shortcut removed:', shortcutPath);
      return true;
    } else {
      safeLog('Desktop shortcut not found:', shortcutPath);
      return false;
    }
  } catch (error) {
    safeLogError('Error removing desktop shortcut:', error);
    throw error;
  }
}

// Helper function to transliterate Vietnamese characters to ASCII
function transliterateVietnamese(str) {
  const vietnameseMap = {
    'á': 'a', 'à': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ắ': 'a', 'ằ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ấ': 'a', 'ầ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'é': 'e', 'è': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ế': 'e', 'ề': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'í': 'i', 'ì': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ó': 'o', 'ò': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ố': 'o', 'ồ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ớ': 'o', 'ờ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ú': 'u', 'ù': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ứ': 'u', 'ừ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ý': 'y', 'ỳ': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
    'đ': 'd', 'Đ': 'D',
    'Á': 'A', 'À': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
    'Ă': 'A', 'Ắ': 'A', 'Ằ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
    'Â': 'A', 'Ấ': 'A', 'Ầ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
    'É': 'E', 'È': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
    'Ê': 'E', 'Ế': 'E', 'Ề': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
    'Í': 'I', 'Ì': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
    'Ó': 'O', 'Ò': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
    'Ô': 'O', 'Ố': 'O', 'Ồ': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
    'Ơ': 'O', 'Ớ': 'O', 'Ờ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
    'Ú': 'U', 'Ù': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
    'Ư': 'U', 'Ứ': 'U', 'Ừ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
    'Ý': 'Y', 'Ỳ': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y'
  };
  
  return str.replace(/[^\x00-\x7F]/g, (char) => {
    return vietnameseMap[char] || char;
  });
}

// Helper function to create safe filename
function createSafeFilename(name) {
  return transliterateVietnamese(name)
    .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid filename characters
    .replace(/\s+/g, ' ')           // Normalize spaces
    .trim()
    .substring(0, 100);             // Limit length to avoid path issues
}

// Utility functions for Unicode handling
function removeVietnameseDiacritics(str) {
  if (typeof str !== 'string') return str;
  
  const diacriticsMap = {
    'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',
    'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
    'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
    'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',
    'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
    'đ': 'd',
    'À': 'A', 'Á': 'A', 'Ạ': 'A', 'Ả': 'A', 'Ã': 'A',
    'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ậ': 'A', 'Ẩ': 'A', 'Ẫ': 'A',
    'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ặ': 'A', 'Ẳ': 'A', 'Ẵ': 'A',
    'È': 'E', 'É': 'E', 'Ẹ': 'E', 'Ẻ': 'E', 'Ẽ': 'E',
    'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ệ': 'E', 'Ể': 'E', 'Ễ': 'E',
    'Ì': 'I', 'Í': 'I', 'Ị': 'I', 'Ỉ': 'I', 'Ĩ': 'I',
    'Ò': 'O', 'Ó': 'O', 'Ọ': 'O', 'Ỏ': 'O', 'Õ': 'O',
    'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ộ': 'O', 'Ổ': 'O', 'Ỗ': 'O',
    'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ợ': 'O', 'Ở': 'O', 'Ỡ': 'O',
    'Ù': 'U', 'Ú': 'U', 'Ụ': 'U', 'Ủ': 'U', 'Ũ': 'U',
    'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ự': 'U', 'Ử': 'U', 'Ữ': 'U',
    'Ỳ': 'Y', 'Ý': 'Y', 'Ỵ': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y',
    'Đ': 'D'
  };
  
  return str.replace(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/g, char => diacriticsMap[char] || char);
}

function normalizeUnicode(str) {
  if (typeof str !== 'string') return str;
  
  try {
    // Remove diacritics for console display
    return removeVietnameseDiacritics(str);
  } catch (e) {
    return str;
  }
}

function safeLog(message, ...args) {
  // Safe logging function that removes Vietnamese diacritics
  try {
    const cleanMessage = normalizeUnicode(message);
    const cleanArgs = args.map(arg => 
      typeof arg === 'string' ? normalizeUnicode(arg) : arg
    );
    console.log(cleanMessage, ...cleanArgs);
  } catch (e) {
    console.log('[Encoding Error]', message, ...args);
  }
}

function safeLogWarn(message, ...args) {
  try {
    const cleanMessage = normalizeUnicode(message);
    const cleanArgs = args.map(arg => 
      typeof arg === 'string' ? normalizeUnicode(arg) : arg
    );
    console.warn(cleanMessage, ...cleanArgs);  } catch (e) {
    console.warn('[Encoding Error]', message, ...args);
  }
}

function safeLogError(message, ...args) {
  try {
    const cleanMessage = normalizeUnicode(message);
    const cleanArgs = args.map(arg => 
      typeof arg === 'string' ? normalizeUnicode(arg) : arg
    );
    console.error(cleanMessage, ...cleanArgs);
  } catch (e) {
    console.error('[Encoding Error]', message, ...args);
  }
}

// Memory optimization utilities
function forceGarbageCollection() {
  if (global.gc) {
    try {
      global.gc();
      console.log('Garbage collection forced');
    } catch (e) {
      console.log('Garbage collection failed:', e.message);
    }
  }
}

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
    external: Math.round(usage.external / 1024 / 1024) + ' MB'
  };
}

// Note: Old downloadWithProgress function removed to prevent memory issues with large files
// Use downloadToFileStream instead for all downloads

// Helper function to download large files directly to disk (streaming)
async function downloadToFileStream(url, outputPath, onProgress = null, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }
    
    try {
      const https = require('https');
      const http = require('http');
      const fs = require('fs');
      
      const protocol = url.startsWith('https:') ? https : http;
      
      const request = protocol.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            reject(new Error('Redirect without location header'));
            return;
          }
          
          console.log(`Redirecting to: ${redirectUrl}`);
          return downloadToFileStream(redirectUrl, outputPath, onProgress, maxRedirects - 1)
            .then(resolve)
            .catch(reject);
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length'] || '0');
        let downloadedSize = 0;
        let lastProgressTime = Date.now();
        let lastDownloadedSize = 0;
        
        // Create write stream with error handling
        const writeStream = fs.createWriteStream(outputPath);
        
        writeStream.on('error', (error) => {
          console.error('Write stream error:', error);
          reject(error);
        });
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          
          // Write directly to file (no memory accumulation)
          if (!writeStream.write(chunk)) {
            // Handle backpressure - pause the response until drain
            response.pause();
            writeStream.once('drain', () => {
              response.resume();
            });
          }
          
          // Throttle progress updates to every 500ms to reduce CPU usage
          const now = Date.now();
          if (now - lastProgressTime >= 500) {
            if (onProgress && totalSize > 0) {
              const progress = (downloadedSize / totalSize) * 100;
              const timeDiff = (now - lastProgressTime) / 1000;
              const sizeDiff = downloadedSize - lastDownloadedSize;
              const speed = sizeDiff / timeDiff;
              
              const remaining = totalSize - downloadedSize;
              const eta = remaining / speed;
              
              onProgress({
                progress: Math.min(99, Math.round(progress)), // Cap at 99% until complete
                downloadedSize,
                totalSize,
                speed: (speed / 1024 / 1024).toFixed(2),
                eta: isFinite(eta) ? `${Math.floor(eta / 60)}:${Math.floor(eta % 60).toString().padStart(2, '0')}` : '0:00'
              });
            }
            
            lastProgressTime = now;
            lastDownloadedSize = downloadedSize;
          }
        });
        
        response.on('end', () => {
          writeStream.end();
          
          writeStream.on('finish', () => {
            // Final progress update
            if (onProgress && totalSize > 0) {
              onProgress({
                progress: 100,
                downloadedSize: totalSize,
                totalSize,
                speed: '0.00',
                eta: '0:00'
              });
            }
            
            console.log(`Download completed: ${outputPath} (${downloadedSize} bytes)`);
            resolve(outputPath);
          });
          
          writeStream.on('error', (error) => {
            console.error('Write stream finish error:', error);
            reject(error);
          });
        });
        
        response.on('error', (error) => {
          console.error('Response error:', error);
          writeStream.destroy();
          // Try to clean up partial file
          try {
            if (fs.existsSync(outputPath)) {
              fs.unlinkSync(outputPath);
            }
          } catch (cleanupError) {
            console.warn('Could not clean up partial file:', cleanupError.message);
          }
          reject(error);
        });
      });
      
      request.on('error', (error) => {
        console.error('Request error:', error);
        reject(error);
      });
      
      request.setTimeout(120000, () => { // Increased timeout for large files
        request.destroy();
        reject(new Error('Download timeout (120s)'));
      });
    } catch (error) {
      console.error('Download setup error:', error);
      reject(error);
    }
  });
}

// Helper function to register app with Windows (Add/Remove Programs)
async function registerAppWithWindows(app, appPath, executablePath) {
  try {
    const { spawn } = require('child_process');
    
    // App info for registry - properly handle Unicode
    const appName = app.name;
    const appId = appName.replace(/[^a-zA-Z0-9]/g, ''); // Clean ID for registry
    const appVersion = app.version || '1.0.0';
    const appPublisher = app.publisher || 'DriveBox';
    const appDescription = app.description || app.name;
    const installDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // Calculate app size (in KB)
    let appSize = 0;
    try {
      const getDirectorySize = (dirPath) => {
        let size = 0;
        const files = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const file of files) {
          const filePath = path.join(dirPath, file.name);
          if (file.isDirectory()) {
            size += getDirectorySize(filePath);
          } else {
            size += fs.statSync(filePath).size;
          }
        }
        return size;
      };      appSize = Math.round(getDirectorySize(appPath) / 1024); // Convert to KB
    } catch (sizeError) {
      safeLogWarn('Could not calculate app size:', sizeError.message);
      appSize = 1024; // Default 1MB
    }
    
    safeLog(`Registering app: ${normalizeUnicode(app.name)}`);
    safeLog('App ID:', appId);
    safeLog('App path:', appPath);
    safeLog('Executable:', executablePath);
      // Create safe versions of text for registry (remove diacritics)
    const safeAppName = removeVietnameseDiacritics(appName);
    const safeDescription = removeVietnameseDiacritics(appDescription);
    
    // Use PowerShell for better Unicode handling
    const powershellScript = `
# Set console encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RegistryPath = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appId}"
if (-not (Test-Path $RegistryPath)) {
    New-Item -Path $RegistryPath -Force | Out-Null
}
Set-ItemProperty -Path $RegistryPath -Name "DisplayName" -Value "${safeAppName}" -Type String
Set-ItemProperty -Path $RegistryPath -Name "DisplayVersion" -Value "${appVersion}" -Type String
Set-ItemProperty -Path $RegistryPath -Name "Publisher" -Value "${appPublisher}" -Type String
Set-ItemProperty -Path $RegistryPath -Name "InstallLocation" -Value "${appPath.replace(/\\/g, '\\')}" -Type String
Set-ItemProperty -Path $RegistryPath -Name "DisplayIcon" -Value "${executablePath.replace(/\\/g, '\\')},0" -Type String
Set-ItemProperty -Path $RegistryPath -Name "UninstallString" -Value "\\"${process.execPath.replace(/\\/g, '\\')}\\" --uninstall \\"${appId}\\"" -Type String
Set-ItemProperty -Path $RegistryPath -Name "InstallDate" -Value "${installDate}" -Type String
Set-ItemProperty -Path $RegistryPath -Name "EstimatedSize" -Value ${appSize} -Type DWord
Set-ItemProperty -Path $RegistryPath -Name "NoModify" -Value 1 -Type DWord
Set-ItemProperty -Path $RegistryPath -Name "NoRepair" -Value 1 -Type DWord
Set-ItemProperty -Path $RegistryPath -Name "Comments" -Value "${safeDescription}" -Type String
Write-Host "App registered successfully: ${safeAppName}"
Write-Host "Registry path: $RegistryPath"
    `.trim();
      safeLog('PowerShell registration script prepared');
    
    return new Promise((resolve, reject) => {
      // Use PowerShell with direct command execution
      const powershell = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command', `& { ${powershellScript} }`
      ], { 
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf8'
      });
      let stdout = '';
      let stderr = '';
      
      powershell.stdout.on('data', (data) => {
        stdout += data.toString('utf8');
      });
      
      powershell.stderr.on('data', (data) => {
        stderr += data.toString('utf8');
      });
      
      powershell.on('close', (code) => {        if (code === 0) {
          safeLog(`App registered with Windows successfully: ${normalizeUnicode(app.name)}`);
          safeLog('PowerShell output:', stdout);
          resolve(true);
        } else {
          safeLogWarn('Registry registration failed:', stderr);
          safeLogWarn('PowerShell output:', stdout);
          // Don't reject here - app can still work without registry registration
          resolve(false);
        }
      });
      
      powershell.on('error', (error) => {
        safeLogWarn('Registry registration error:', error);
        // Don't reject here - app can still work without registry registration
        resolve(false);
      });
    });  } catch (error) {
    safeLogWarn('Error registering app with Windows:', error);
    return false;
  }
}

// Alternative direct registry registration (fallback method)
async function registerAppDirectly(app, appPath, executablePath) {
  try {
    const { spawn } = require('child_process');
    
    const appId = app.name.replace(/[^a-zA-Z0-9]/g, '');
    const regKey = `HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appId}`;
    
    safeLog('Trying direct registry registration for:', app.name);
    
    // Calculate app size
    let appSize = 1024;
    try {
      const stats = fs.statSync(executablePath);
      appSize = Math.round(stats.size / 1024);
    } catch (e) {
      console.warn('Could not get file size:', e.message);
    }
    
    const registryCommands = [
      ['reg', 'add', regKey, '/f'],
      ['reg', 'add', regKey, '/v', 'DisplayName', '/t', 'REG_SZ', '/d', app.name, '/f'],
      ['reg', 'add', regKey, '/v', 'DisplayVersion', '/t', 'REG_SZ', '/d', app.version || '1.0.0', '/f'],
      ['reg', 'add', regKey, '/v', 'Publisher', '/t', 'REG_SZ', '/d', 'DriveBox', '/f'],
      ['reg', 'add', regKey, '/v', 'InstallLocation', '/t', 'REG_SZ', '/d', appPath, '/f'],
      ['reg', 'add', regKey, '/v', 'DisplayIcon', '/t', 'REG_SZ', '/d', `${executablePath},0`, '/f'],
      ['reg', 'add', regKey, '/v', 'UninstallString', '/t', 'REG_SZ', '/d', `"${process.execPath}" --uninstall "${appId}"`, '/f'],
      ['reg', 'add', regKey, '/v', 'EstimatedSize', '/t', 'REG_DWORD', '/d', appSize.toString(), '/f'],
      ['reg', 'add', regKey, '/v', 'NoModify', '/t', 'REG_DWORD', '/d', '1', '/f'],
      ['reg', 'add', regKey, '/v', 'NoRepair', '/t', 'REG_DWORD', '/d', '1', '/f'],
      ['reg', 'add', regKey, '/v', 'Comments', '/t', 'REG_SZ', '/d', app.description || app.name, '/f']
    ];
    
    for (const cmd of registryCommands) {
      await new Promise((resolve, reject) => {
        const process = spawn(cmd[0], cmd.slice(1), {
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
          stdout += data.toString('utf8');
        });
        
        process.stderr.on('data', (data) => {
          stderr += data.toString('utf8');
        });
        
        process.on('close', (code) => {
          if (code === 0) {
            console.log('Registry command success:', cmd.join(' '));
            resolve();
          } else {
            console.warn('Registry command failed:', cmd.join(' '), stderr);
            resolve(); // Don't fail entire process for one command
          }
        });
        
        process.on('error', (error) => {
          console.warn('Registry command error:', cmd.join(' '), error.message);
          resolve(); // Don't fail entire process for one command
        });
      });
    }
    
    safeLog('Direct registry registration completed for:', app.name);
    return true;
  } catch (error) {
    console.warn('Direct registry registration failed:', error.message);
    return false;
  }
}

// Helper function to unregister app from Windows
async function unregisterAppFromWindows(appName) {
  try {
    const { spawn } = require('child_process');
    
    const appId = appName.replace(/[^a-zA-Z0-9]/g, ''); // Same cleaning as registration    safeLog(`Unregistering app from Windows: ${normalizeUnicode(appName)}`);
    safeLog('App ID:', appId);
      // Create safe version without diacritics
    const safeAppName = removeVietnameseDiacritics(appName);
    
    // Use PowerShell for consistent Unicode handling
    const powershellScript = `
# Set console encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RegistryPath = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appId}"
if (Test-Path $RegistryPath) {
    Remove-Item -Path $RegistryPath -Recurse -Force
    Write-Host "App unregistered successfully: ${safeAppName}"
} else {
    Write-Host "Registry entry not found: ${safeAppName}"
}
    `.trim();    
    return new Promise((resolve, reject) => {
      const powershell = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command', `& { ${powershellScript} }`
      ], { 
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf8'
      });
      let stdout = '';
      let stderr = '';
      
      powershell.stdout.on('data', (data) => {
        stdout += data.toString('utf8');
      });
      
      powershell.stderr.on('data', (data) => {
        stderr += data.toString('utf8');
      });
        powershell.on('close', (code) => {
        if (code === 0) {
          safeLog(`App unregistered from Windows successfully: ${normalizeUnicode(appName)}`);
          safeLog('PowerShell output:', stdout);
          resolve(true);
        } else {
          safeLogWarn('Registry unregistration failed:', stderr);
          safeLogWarn('PowerShell output:', stdout);
          // Don't reject - continue with uninstall process
          resolve(false);
        }
      });
      
      powershell.on('error', (error) => {
        safeLogWarn('Registry unregistration error:', error);
        // Don't reject - continue with uninstall process
        resolve(false);
      });
    });  } catch (error) {
    safeLogWarn('Error unregistering app from Windows:', error);
    return false;
  }
}

// Helper function to handle post-install setup steps
async function runSetupSteps(app, appPath, mainWindow = null) {
  const { spawn, exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  safeLog(`Starting setup for: ${normalizeUnicode(app.name)}`);
  
  for (let i = 0; i < app.setupSteps.length; i++) {
    const step = app.setupSteps[i];
    const stepNum = i + 1;
    
    safeLog(`Setup Step ${stepNum}/${app.setupSteps.length}: ${step.description}`);
    
    // Send progress to UI
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', {
        appId: app.id,
        progress: 95 + (stepNum / app.setupSteps.length) * 4, // 95-99% range for setup
        status: 'setup_step',
        message: `Bước ${stepNum}/${app.setupSteps.length}: ${step.description}`
      });
    }const filePath = path.join(appPath, step.file);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      safeLogWarn(`Setup file not found: ${step.file}`);
      continue;
    }
    
    try {
      if (step.type === 'runAsAdmin') {
        // Run as administrator using PowerShell
        safeLog(`Running as admin: ${step.file}`);
        
        const powershellCommand = `Start-Process -FilePath "${filePath}" -Verb RunAs -Wait`;
        
        await new Promise((resolve, reject) => {
          const powershell = spawn('powershell.exe', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-Command', powershellCommand
          ], {
            windowsHide: false, // Show window for admin prompt
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let stdout = '';
          let stderr = '';
          
          powershell.stdout.on('data', (data) => {
            stdout += data.toString();
          });
          
          powershell.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          powershell.on('close', (code) => {
            if (code === 0) {
              safeLog(`Admin setup completed: ${step.file}`);
              resolve();
            } else {
              safeLogWarn(`Admin setup failed with code ${code}:`, stderr);
              resolve(); // Don't fail entire setup for one step
            }
          });
          
          powershell.on('error', (error) => {
            safeLogWarn(`Admin setup error for ${step.file}:`, error.message);
            resolve(); // Don't fail entire setup for one step
          });
        });
        
      } else if (step.type === 'runSilent') {
        // Run silently
        safeLog(`Running silently: ${step.file}`);
        
        await new Promise((resolve, reject) => {
          // Common silent install parameters
          const args = ['/S', '/SILENT', '/VERYSILENT'];
          
          const process = spawn(filePath, args, {
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let stdout = '';
          let stderr = '';
          
          process.stdout.on('data', (data) => {
            stdout += data.toString();
          });
          
          process.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          process.on('close', (code) => {
            if (code === 0) {
              safeLog(`Silent install completed: ${step.file}`);
            } else {
              safeLogWarn(`Silent install finished with code ${code} for: ${step.file}`);
            }
            resolve(); // Don't fail for non-zero exit codes as some installers return non-zero even on success
          });          process.on('error', (error) => {
            safeLogWarn(`Silent install error for ${step.file}:`, error.message);
            resolve(); // Don't fail entire setup for one step
          });
        });
        
      } else {
        safeLogWarn(`Unknown setup step type: ${step.type}`);
      }
      
      // Add small delay between steps
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      safeLogWarn(`Setup step ${stepNum} failed:`, error.message);
      // Continue with next step
    }
  }
  
  safeLog(`Setup completed for: ${normalizeUnicode(app.name)}`);
}

// Test setup steps handler
ipcMain.handle('test-setup-steps', async (event, app, appPath) => {
  try {
    safeLog('Testing setup steps...');
    await runSetupSteps(app, appPath, mainWindow);
    return { success: true, message: 'Setup completed successfully' };
  } catch (error) {
    safeLogError('Setup test failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Auto-update system handlers
ipcMain.handle('check-app-updates', async () => {
  try {
    const currentVersion = app.getVersion();
    console.log('Checking for updates, current version:', currentVersion);
    
    // Allow update check in development mode
    
    const response = await fetch('https://api.github.com/repos/TeoSushi1014/drivebox/releases/latest', {
      headers: {
        'User-Agent': 'DriveBox-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      // Handle different HTTP status codes
      if (response.status === 403) {
        console.warn('GitHub API rate limit exceeded or access denied');
        return { 
          hasUpdate: false, 
          currentVersion,
          latestVersion: currentVersion,
          error: 'Rate limit exceeded or access denied. Try again later.'
        };
      } else if (response.status === 404) {
        console.warn('Repository not found or releases not available');
        return { 
          hasUpdate: false, 
          currentVersion,
          latestVersion: currentVersion,
          error: 'Repository releases not found'
        };
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const latestRelease = await response.json();
    const latestVersion = latestRelease.tag_name.replace('v', '');
    
    console.log('Latest version from GitHub:', latestVersion);
      return {
      hasUpdate: latestVersion !== currentVersion,
      currentVersion,
      latestVersion: latestRelease.tag_name,
      downloadUrl: latestRelease.assets[0]?.browser_download_url,
      fileSize: latestRelease.assets[0]?.size || 0,
      fileName: latestRelease.assets[0]?.name || 'DriveBox-Setup.exe',
      releaseNotes: latestRelease.body || 'No release notes available'
    };} catch (error) {
    console.error('Update check failed:', error);
    
    // More specific error handling
    if (error.message.includes('403')) {
      return { 
        hasUpdate: false, 
        currentVersion: app.getVersion(),
        error: 'GitHub API access denied. This may be due to rate limiting or repository access restrictions.'
      };
    } else if (error.message.includes('fetch')) {
      return { 
        hasUpdate: false, 
        currentVersion: app.getVersion(),
        error: 'Network error: Unable to connect to GitHub. Please check your internet connection.'
      };
    }
    
    return { 
      hasUpdate: false, 
      currentVersion: app.getVersion(),
      error: `Update check failed: ${error.message}`
    };
  }
});

// Helper function to calculate download speed
let downloadStartTime = null;
function calculateDownloadSpeed(downloadedBytes) {
  if (!downloadStartTime) {
    downloadStartTime = Date.now();
    return 0;
  }
  
  const elapsedTime = (Date.now() - downloadStartTime) / 1000; // in seconds
  if (elapsedTime === 0) return 0;
  
  const bytesPerSecond = downloadedBytes / elapsedTime;
  
  // Convert to appropriate unit
  if (bytesPerSecond < 1024) {
    return `${Math.round(bytesPerSecond)} B/s`;
  } else if (bytesPerSecond < 1024 * 1024) {
    return `${Math.round(bytesPerSecond / 1024)} KB/s`;
  } else {
    return `${Math.round(bytesPerSecond / (1024 * 1024))} MB/s`;
  }
}

// Download and install update
ipcMain.handle('download-app-update', async (event, updateInfo) => {
  try {
    if (!updateInfo.downloadUrl) {
      throw new Error('No download URL provided');
    }
    console.log('Starting app update download...');
    
    // Reset download start time for accurate speed calculation
    downloadStartTime = null;
    
    // Create temp directory for update
    const tempDir = path.join(os.tmpdir(), 'drivebox-update');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const fileName = `drivebox-${updateInfo.latestVersion}.exe`;
    const filePath = path.join(tempDir, fileName);
    
    // Format release notes (Markdown to HTML) first
    let formattedReleaseNotes = updateInfo.releaseNotes || 'No release notes available.';
    try {
      // Enhanced Markdown to HTML conversion
      formattedReleaseNotes = formattedReleaseNotes
        .replace(/\r\n|\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        // Headers
        .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
        .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
        .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Lists
        .replace(/^\s*-\s(.+)$/gm, '<li>$1</li>')
        .replace(/^\s*\*\s(.+)$/gm, '<li>$1</li>')
        .replace(/^\s*\d+\.\s(.+)$/gm, '<li>$1</li>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Paragraphs
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
      
      // Wrap consecutive list items in ul tags
      formattedReleaseNotes = formattedReleaseNotes.replace(/(<li>.*<\/li>)/gs, (match) => {
        return `<ul>${match}</ul>`;
      });
      
      // Clean up nested ul tags
      formattedReleaseNotes = formattedReleaseNotes.replace(/<\/ul>\s*<ul>/g, '');
      
      // Wrap in paragraph if not already wrapped
      if (!formattedReleaseNotes.startsWith('<') && !formattedReleaseNotes.includes('</')) {
        formattedReleaseNotes = `<p>${formattedReleaseNotes}</p>`;
      } else if (!formattedReleaseNotes.startsWith('<p>') && !formattedReleaseNotes.startsWith('<h')) {
        formattedReleaseNotes = `<p>${formattedReleaseNotes}</p>`;
      }
    } catch (e) {
      console.warn('Release notes formatting failed:', e);
      formattedReleaseNotes = `<p>${updateInfo.releaseNotes || 'No release notes available.'}</p>`;
    }
    
    // Send formatted release notes to renderer immediately for display
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('show-release-notes', {
        version: updateInfo.latestVersion,
        notes: formattedReleaseNotes,
        downloadUrl: updateInfo.downloadUrl
      });
    }
    
    // Start download with progress tracking
    const response = await fetch(updateInfo.downloadUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText} (${response.status})`);
    }
    
    const contentLength = parseInt(response.headers.get('content-length'), 10);
    let downloadedBytes = 0;
    
    const fileStream = fs.createWriteStream(filePath);
    
    return new Promise((resolve, reject) => {      response.body.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        
        // Send progress update to renderer
        if (contentLength && mainWindow && mainWindow.webContents) {
          const progress = Math.round((downloadedBytes / contentLength) * 100);
          const speed = calculateDownloadSpeed(downloadedBytes);
          
          // Calculate ETA
          let eta = 0;
          if (downloadStartTime && downloadedBytes > 0) {
            const elapsedTime = (Date.now() - downloadStartTime) / 1000;
            const avgSpeed = downloadedBytes / elapsedTime; // bytes per second
            const remainingBytes = contentLength - downloadedBytes;
            eta = avgSpeed > 0 ? Math.round(remainingBytes / avgSpeed) : 0;
          }
          
          mainWindow.webContents.send('update-download-progress', {
            progress,
            downloadedBytes,
            totalBytes: contentLength,
            speed,
            eta,
            version: updateInfo.latestVersion
          });
        }
      });
      
      response.body.pipe(fileStream);
      
      fileStream.on('finish', () => {
        console.log('Update downloaded successfully');
        
        // Final progress update
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('update-download-progress', {
            progress: 100,
            downloadedBytes,
            totalBytes: contentLength || downloadedBytes,
            speed: 0,
            version: updateInfo.latestVersion,
            completed: true
          });
        }
        
        resolve({ 
          success: true, 
          filePath: filePath,
          message: 'Update downloaded successfully',
          releaseNotes: formattedReleaseNotes,
          version: updateInfo.latestVersion
        });
      });
      
      fileStream.on('error', (error) => {
        console.error('Update download error:', error);
        
        // Send error to renderer
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('update-download-error', {
            error: error.message,
            version: updateInfo.latestVersion
          });
        }
        
        reject(error);
      });
      
      response.body.on('error', (error) => {
        console.error('Update download stream error:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Update download failed:', error);
    return { success: false, error: error.message };
  }
});

// Get app version
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

// Restart application for update
ipcMain.handle('restart-app', async () => {
  try {
    console.log('Restarting application for update...');
    app.relaunch();
    app.exit(0);
    return { success: true };
  } catch (error) {
    console.error('Failed to restart app:', error);
    return { success: false, error: error.message };
  }
});
