/**
 * Enhanced Update Manager for DriveBox
 * Handles auto-updates with multiple fallback strategies
 */

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');

class UpdateManager {  constructor() {
    this.store = new Store();
    this.updateCheckInterval = 60 * 60 * 1000; // Check every hour
    this.lastCheckTime = 0;
    this.customDownloadPath = 'C:\\Tèo Sushi';
    this.updateSources = [
      {
        name: 'GitHub API',
        url: 'https://api.github.com/repos/TeoSushi1014/drivebox/releases/latest',
        type: 'api'
      },
      {
        name: 'GitHub Releases Page',
        url: 'https://github.com/TeoSushi1014/drivebox/releases/latest',
        type: 'html'
      }
    ];
    
    this.downloadMirrors = [
      'https://github.com/TeoSushi1014/drivebox/releases/download',
      // Add more mirrors here if needed
    ];

    // Auto-fix dependencies configuration
    this.autoFixSources = {
      vcredist: {
        name: 'Visual C++ Redistributable',
        url: 'https://api.github.com/repos/abbodi1406/vcredist/releases/latest',
        type: 'api',
        filePattern: /VisualCppRedist_AIO_x86_x64\.exe$/i,
        installArgs: ['/ai']
      },
      klite: {
        name: 'K-Lite Codec Pack Mega',
        url: 'https://www.codecguide.com/download_k-lite_codec_pack_mega.htm',
        type: 'html',
        directUrl: 'https://files2.codecguide.com/K-Lite_Codec_Pack_1805_Mega.exe',
        filePattern: /K-Lite_Codec_Pack_.*_Mega\.exe$/i,
        installArgs: ['/VERYSILENT', '/NORESTART']
      }
    };
  }
  // Initialize update manager
  async initialize() {
    console.log('Initializing Update Manager...');
    
    // Check if this is an update startup
    const isUpdateMode = process.argv.includes('--update-mode');
    if (isUpdateMode) {
      await this.handleUpdateMode();
      return;
    }
    
    // Clean up old update files on startup
    this.cleanupOldUpdates();
    
    // Check for pending updates
    await this.checkPendingUpdates();
    
    // Set up periodic update checks
    this.setupPeriodicChecks();
    
    // Ensure custom download directory exists
    this.ensureDownloadDirectory();
    
    console.log('Update Manager initialized successfully');
  }
  // Clean up old update files and backups
  cleanupOldUpdates() {
    try {
      // Clean custom download directory
      if (fs.existsSync(this.customDownloadPath)) {
        const files = fs.readdirSync(this.customDownloadPath);
        files.forEach(file => {
          const filePath = path.join(this.customDownloadPath, file);
          try {
            const stats = fs.statSync(filePath);
            const age = Date.now() - stats.mtime.getTime();
            
            // Remove files older than 24 hours
            if (age > 24 * 60 * 60 * 1000) {
              fs.unlinkSync(filePath);
              console.log('Cleaned up old update file:', file);
            }
          } catch (error) {
            console.warn('Could not clean up file:', file, error.message);
          }
        });
      }
      
      // Clean temp update directory (fallback)
      const tempDir = path.join(require('os').tmpdir(), 'drivebox-update');
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
          const filePath = path.join(tempDir, file);
          try {
            const stats = fs.statSync(filePath);
            const age = Date.now() - stats.mtime.getTime();
            
            // Remove files older than 24 hours
            if (age > 24 * 60 * 60 * 1000) {
              fs.unlinkSync(filePath);
              console.log('Cleaned up old temp update file:', file);
            }
          } catch (error) {
            console.warn('Could not clean up temp file:', file, error.message);
          }
        });
      }

      // Clean up old backups
      const currentDir = path.dirname(process.execPath);
      if (fs.existsSync(currentDir)) {
        const files = fs.readdirSync(currentDir);
        const backupPattern = /DriveBox-backup-(\d+)\.exe$/;
        
        files.forEach(file => {
          const match = file.match(backupPattern);
          if (match) {
            const timestamp = parseInt(match[1]);
            const age = Date.now() - timestamp;
            
            // Remove backups older than 7 days
            if (age > 7 * 24 * 60 * 60 * 1000) {
              try {
                const filePath = path.join(currentDir, file);
                fs.unlinkSync(filePath);
                console.log('Cleaned up old backup:', file);
              } catch (error) {
                console.warn('Could not clean up backup:', file, error.message);
              }
            }
          }
        });
      }
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  }

  // Check for pending updates from previous sessions
  async checkPendingUpdates() {
    const pendingUpdate = this.store.get('pendingUpdate');
    if (pendingUpdate) {
      console.log('Found pending update:', pendingUpdate);
      if (fs.existsSync(pendingUpdate.filePath)) {
        const validation = await this.validateUpdateFile(pendingUpdate.filePath);
        console.log('Validation result for pending update:', validation); // Log validation result
        if (validation.valid) {
          console.log('Pending update is valid and ready for installation');
          return pendingUpdate;
        } else {
          console.log('Pending update file is invalid, cleaning up...');
          try {
            fs.unlinkSync(pendingUpdate.filePath);
          } catch (error) {
            console.warn('Could not remove invalid update file:', error.message);
          }
        }
      }
      this.store.delete('pendingUpdate');
    }
    return null;
  }

  // Set up automatic periodic update checks
  setupPeriodicChecks() {
    const settings = this.store.get('updateSettings', {
      autoCheck: true,
      checkInterval: this.updateCheckInterval,
      autoDownload: false,
      autoInstall: false
    });

    if (settings.autoCheck) {
      setInterval(() => {
        this.checkForUpdates(true); // Silent check
      }, settings.checkInterval);
      
      // Initial check after app startup (with delay)
      setTimeout(() => {
        this.checkForUpdates(true);
      }, 30000); // Wait 30 seconds after startup
    }
  }
  // Enhanced update checking with multiple sources
  async checkForUpdates(silent = false) {
    try {
      const currentVersion = app?.getVersion ? app.getVersion() : '1.2.5'; // Fallback for testing
      const now = Date.now();

      // Nếu đã có pending update hợp lệ thì không check nữa, tránh loop
      const pendingUpdate = this.store.get('pendingUpdate');
      if (pendingUpdate && pendingUpdate.filePath && fs.existsSync(pendingUpdate.filePath)) {
        const validation = await this.validateUpdateFile(pendingUpdate.filePath);
        if (validation.valid) {
          if (!silent) {
            console.log('Pending update exists, skip check.');
          }
          return {
            hasUpdate: false,
            currentVersion,
            latestVersion: pendingUpdate.version || currentVersion,
            message: 'Update already downloaded and ready to install.'
          };
        }
      }

      // Rate limiting - don't check too frequently
      if (now - this.lastCheckTime < 5 * 60 * 1000) { // 5 minutes minimum
        console.log('Update check rate limited');
        return this.store.get('lastUpdateInfo', { hasUpdate: false, currentVersion });
      }

      this.lastCheckTime = now;

      if (!silent) {
        console.log('Checking for updates, current version:', currentVersion);
      }

      let lastError = null;

      for (const source of this.updateSources) {
        try {
          if (!silent) {
            console.log(`Checking update source: ${source.name}`);
          }

          const updateInfo = await this.checkUpdateSource(source, currentVersion);

          if (updateInfo) {
            // Cache the update info
            this.store.set('lastUpdateInfo', updateInfo);
            this.store.set('lastUpdateCheck', now);

            if (!silent) {
              console.log('Update check successful:', updateInfo);
            }

            return updateInfo;
          }

        } catch (error) {
          console.warn(`Update source ${source.name} failed:`, error.message);
          lastError = error.message;
          continue;
        }
      }

      // All sources failed
      const errorResult = {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        error: lastError || 'All update sources failed'
      };

      this.store.set('lastUpdateInfo', errorResult);
      return errorResult;

    } catch (error) {
      console.error('Update check failed:', error);
      return {
        hasUpdate: false,
        currentVersion: app?.getVersion ? app.getVersion() : '1.2.5',
        error: error.message
      };
    }
  }

  // Check a specific update source
  async checkUpdateSource(source, currentVersion) {
    const fetch = require('node-fetch');
    
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'DriveBox-App',
        'Accept': source.type === 'api' ? 'application/vnd.github.v3+json' : 'text/html'
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (source.type === 'api') {
      // Parse GitHub API response
      const latestRelease = await response.json();
      const latestVersion = latestRelease.tag_name.replace('v', '');
      
      return {
        hasUpdate: this.compareVersions(latestVersion, currentVersion) > 0,
        currentVersion,
        latestVersion: latestRelease.tag_name,
        downloadUrl: latestRelease.assets[0]?.browser_download_url,
        fileSize: latestRelease.assets[0]?.size || 0,
        fileName: latestRelease.assets[0]?.name || 'DriveBox-Setup.exe',
        releaseNotes: latestRelease.body || 'No release notes available',
        publishedAt: latestRelease.published_at,
        source: source.name
      };
    } else {
      // Parse HTML response (fallback)
      const html = await response.text();
      const versionMatch = html.match(/tag\/(v?[\d.]+)/);
      
      if (versionMatch) {
        const latestVersion = versionMatch[1].replace('v', '');
        return {
          hasUpdate: this.compareVersions(latestVersion, currentVersion) > 0,
          currentVersion,
          latestVersion: versionMatch[1],
          downloadUrl: `https://github.com/TeoSushi1014/drivebox/releases/download/${versionMatch[1]}/DriveBox-Setup.exe`,
          fileSize: 0,
          fileName: 'DriveBox-Setup.exe',
          releaseNotes: 'Update information from HTML source',
          source: source.name
        };
      } else {
        throw new Error('Could not parse version from HTML');
      }
    }
  }

  // Compare two version strings
  compareVersions(a, b) {
    const parseVersion = (version) => {
      return version.replace(/[^\d.]/g, '').split('.').map(Number);
    };
    
    const versionA = parseVersion(a);
    const versionB = parseVersion(b);
    
    for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
      const numA = versionA[i] || 0;
      const numB = versionB[i] || 0;
      
      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }
    
    return 0;
  }

  // Enhanced file validation
  async validateUpdateFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn('[validateUpdateFile] File does not exist:', filePath);
        return { valid: false, error: 'Update file not found' };
      }
      const stats = fs.statSync(filePath);
      if (stats.size < 5 * 1024 * 1024) {
        console.warn('[validateUpdateFile] File too small:', stats.size);
        return { valid: false, error: 'File too small (< 5MB)' };
      }
      if (stats.size > 500 * 1024 * 1024) {
        console.warn('[validateUpdateFile] File too large:', stats.size);
        return { valid: false, error: 'File too large (> 500MB)' };
      }
      // PE header validation
      const buffer = fs.readFileSync(filePath, { start: 0, end: 64 });
      if (buffer[0] !== 0x4D || buffer[1] !== 0x5A) {
        console.warn('[validateUpdateFile] Invalid PE header:', buffer[0], buffer[1]);
        return { valid: false, error: 'Invalid PE header' };
      }
      const peOffset = buffer.readUInt32LE(60);
      if (peOffset < 64 || peOffset > stats.size - 4) {
        console.warn('[validateUpdateFile] Invalid PE offset:', peOffset);
        return { valid: false, error: 'Invalid PE offset' };
      }
      return { valid: true };
    } catch (error) {
      console.warn('[validateUpdateFile] Exception:', error.message);
      return { valid: false, error: error.message };
    }
  }
  // Get update settings
  getUpdateSettings() {
    return this.store.get('updateSettings', {
      autoCheck: true,
      checkInterval: this.updateCheckInterval,
      autoDownload: false,
      autoInstall: false,
      downloadPath: this.customDownloadPath
    });
  }

  // Update settings
  setUpdateSettings(settings) {
    const currentSettings = this.getUpdateSettings();
    const newSettings = { ...currentSettings, ...settings };
    this.store.set('updateSettings', newSettings);
    return newSettings;
  }

  // Get update history
  getUpdateHistory() {
    return this.store.get('updateHistory', []);
  }

  // Add to update history
  addToUpdateHistory(updateInfo) {
    const history = this.getUpdateHistory();
    history.unshift({
      ...updateInfo,
      timestamp: Date.now(),
      status: 'completed'
    });
    
    // Keep only last 10 updates
    if (history.length > 10) {
      history.splice(10);
    }
    
    this.store.set('updateHistory', history);
  }

  // Handle update mode when app starts with --update-mode flag
  async handleUpdateMode() {
    console.log('Running in update mode...');
    
    try {
      // Wait for old process to fully terminate
      await this.waitForOldProcessTermination();
      
      // Get update configuration
      const updateConfig = this.store.get('updateConfig');
      if (!updateConfig) {
        throw new Error('Update configuration not found');
      }
      
      console.log('Update config:', updateConfig);
      
      // Perform the update process
      await this.performSelfReplacement(updateConfig);
      
      // Clean up update files
      await this.cleanupUpdateFiles(updateConfig);
      
      // Update version history
      this.addToUpdateHistory({
        ...updateConfig.updateInfo,
        status: 'completed',
        installedAt: Date.now()
      });
      
      // Clear update configuration
      this.store.delete('updateConfig');
      this.store.delete('pendingUpdate');
      
      console.log('Update completed successfully');
      
      // Restart app normally
      app.relaunch();
      app.exit(0);
      
    } catch (error) {
      console.error('Update failed:', error);
      
      // Attempt rollback if possible
      await this.attemptRollback();
      
      // Exit with error
      process.exit(1);
    }
  }

  // Wait for old process to terminate
  async waitForOldProcessTermination() {
    console.log('Waiting for old process to terminate...');
    
    // Wait a few seconds to ensure old process is fully closed
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const updateConfig = this.store.get('updateConfig');
    if (updateConfig?.oldProcessId) {
      // Check if old process is still running (Windows specific)
      try {
        const { exec } = require('child_process');
        const checkProcess = (pid) => {
          return new Promise((resolve) => {
            exec(`tasklist /FI "PID eq ${pid}"`, (error, stdout) => {
              const isRunning = !error && stdout.includes(pid.toString());
              resolve(isRunning);
            });
          });
        };
        
        let attempts = 0;
        while (attempts < 10) {
          const isRunning = await checkProcess(updateConfig.oldProcessId);
          if (!isRunning) {
            console.log('Old process terminated');
            break;
          }
          
          console.log(`Old process still running, waiting... (attempt ${attempts + 1})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      } catch (error) {
        console.warn('Could not check old process status:', error.message);
      }
    }
  }

  // Perform the actual file replacement
  async performSelfReplacement(updateConfig) {
    const { oldExePath, newExePath } = updateConfig;
    
    console.log(`Replacing ${oldExePath} with ${newExePath}`);
    
    // Create backup of old version
    const backupPath = `${oldExePath}.backup-${Date.now()}`;
    try {
      if (fs.existsSync(oldExePath)) {
        fs.copyFileSync(oldExePath, backupPath);
        console.log('Created backup:', backupPath);
      }
    } catch (error) {
      console.warn('Could not create backup:', error.message);
    }
    
    // Delete old executable
    let deleteAttempts = 0;
    while (deleteAttempts < 5) {
      try {
        if (fs.existsSync(oldExePath)) {
          fs.unlinkSync(oldExePath);
          console.log('Deleted old executable');
        }
        break;
      } catch (error) {
        deleteAttempts++;
        console.warn(`Delete attempt ${deleteAttempts} failed:`, error.message);
        if (deleteAttempts < 5) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw new Error('Could not delete old executable after 5 attempts');
        }
      }
    }
    
    // Move new executable to target location
    try {
      fs.copyFileSync(newExePath, oldExePath);
      console.log('Copied new executable to target location');
      
      // Verify the copy was successful
      const validation = await this.validateUpdateFile(oldExePath);
      if (!validation.valid) {
        throw new Error(`New executable validation failed: ${validation.error}`);
      }
      
    } catch (error) {
      // Attempt to restore backup if copy failed
      if (fs.existsSync(backupPath)) {
        try {
          fs.copyFileSync(backupPath, oldExePath);
          console.log('Restored backup due to copy failure');
        } catch (restoreError) {
          console.error('Could not restore backup:', restoreError.message);
        }
      }
      throw error;
    }
    
    // Clean up backup after successful update (keep for a while)
    updateConfig.backupPath = backupPath;
  }

  // Clean up temporary update files
  async cleanupUpdateFiles(updateConfig) {
    try {
      // Remove the temporary new executable
      if (fs.existsSync(updateConfig.newExePath)) {
        fs.unlinkSync(updateConfig.newExePath);
        console.log('Cleaned up temporary update file');
      }
      
      // Clean up update scripts
      if (updateConfig.scriptPath && fs.existsSync(updateConfig.scriptPath)) {
        fs.unlinkSync(updateConfig.scriptPath);
        console.log('Cleaned up update script');
      }
      
      // Clean up old backup after a delay (optional)
      if (updateConfig.backupPath) {
        setTimeout(() => {
          try {
            if (fs.existsSync(updateConfig.backupPath)) {
              fs.unlinkSync(updateConfig.backupPath);
              console.log('Cleaned up backup file');
            }
          } catch (error) {
            console.warn('Could not clean up backup:', error.message);
          }
        }, 60000); // Clean up backup after 1 minute
      }
      
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  }

  // Ensure custom download directory exists
  ensureDownloadDirectory() {
    try {
      // Always set to C:\Tèo Sushi first
      this.customDownloadPath = 'C:\\Tèo Sushi';
      if (!fs.existsSync(this.customDownloadPath)) {
        fs.mkdirSync(this.customDownloadPath, { recursive: true });
        console.log('Created download directory:', this.customDownloadPath);
      }
    } catch (error) {
      console.warn('Could not create download directory:', error.message);
      // Fallback to temp directory
      this.customDownloadPath = path.join(require('os').tmpdir(), 'drivebox-update');
      console.warn('Falling back to temp download directory:', this.customDownloadPath);
      if (!fs.existsSync(this.customDownloadPath)) {
        fs.mkdirSync(this.customDownloadPath, { recursive: true });
      }
    }
  }

  // Download update file
  async downloadUpdate(updateInfo, progressCallback = null) {
    console.log('Starting download:', updateInfo.fileName);

    const fileName = updateInfo.fileName || 'DriveBox-Setup.exe';
    const filePath = path.join(this.customDownloadPath, fileName);

    try {
      const fetch = require('node-fetch');
      const response = await fetch(updateInfo.downloadUrl);

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const totalSize = parseInt(response.headers.get('content-length') || '0');
      let downloadedSize = 0;

      // Create write stream
      const fileStream = fs.createWriteStream(filePath);

      // Download with progress tracking
      return new Promise((resolve, reject) => {
        response.body.on('data', (chunk) => {
          downloadedSize += chunk.length;

          if (progressCallback && totalSize > 0) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            progressCallback(progress, downloadedSize, totalSize);
          }
        });

        response.body.on('error', (error) => {
          fileStream.destroy();
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(error);
        });

        response.body.on('end', async () => {
          fileStream.end();

          // Validate downloaded file
          const validation = await this.validateUpdateFile(filePath);
          if (validation.valid) {
            console.log('Download completed and validated:', filePath);
            // Xóa cache update info để tránh báo update liên tục
            this.store.delete('lastUpdateInfo');
            this.lastCheckTime = 0;
            resolve(filePath);
          } else {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            reject(new Error(`Downloaded file validation failed: ${validation.error}`));
          }
        });

        response.body.pipe(fileStream);
      });

    } catch (error) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
  }

  // Prepare and initiate update
  async initiateUpdate(updateInfo) {
    console.log('Initiating update process...');
    
    try {
      // Download the update file if not already downloaded
      let updateFilePath;
      const pendingUpdate = this.store.get('pendingUpdate');
      
      if (pendingUpdate && fs.existsSync(pendingUpdate.filePath)) {
        console.log('Using existing downloaded update file');
        updateFilePath = pendingUpdate.filePath;
      } else {
        console.log('Downloading update file...');
        updateFilePath = await this.downloadUpdate(updateInfo, (progress, downloaded, total) => {
          console.log(`Download progress: ${progress}% (${Math.round(downloaded / 1024 / 1024)}MB / ${Math.round(total / 1024 / 1024)}MB)`);
        });
      }
      
      // Prepare update configuration
      const updateConfig = {
        updateInfo,
        oldExePath: process.execPath,
        newExePath: updateFilePath,
        oldProcessId: process.pid,
        timestamp: Date.now()
      };
      
      // Store update configuration
      this.store.set('updateConfig', updateConfig);
      this.store.set('pendingUpdate', {
        filePath: updateFilePath,
        version: updateInfo.latestVersion,
        downloadedAt: Date.now()
      });
      
      console.log('Update prepared, restarting in update mode...');
      
      // Restart app in update mode
      app.relaunch({
        args: process.argv.slice(1).concat(['--update-mode'])
      });
      app.exit(0);
      
    } catch (error) {
      console.error('Update initiation failed:', error);
      throw error;
    }
  }

  // Attempt rollback in case of update failure
  async attemptRollback() {
    console.log('Attempting rollback...');
    
    try {
      const updateConfig = this.store.get('updateConfig');
      if (updateConfig?.backupPath && fs.existsSync(updateConfig.backupPath)) {
        fs.copyFileSync(updateConfig.backupPath, updateConfig.oldExePath);
        console.log('Rollback successful');
        
        // Add to update history
        this.addToUpdateHistory({
          ...updateConfig.updateInfo,
          status: 'rolled_back',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Rollback failed:', error);
    }
  }

  // Get current update status
  getUpdateStatus() {
    const pendingUpdate = this.store.get('pendingUpdate');
    const updateConfig = this.store.get('updateConfig');
    const lastUpdateInfo = this.store.get('lastUpdateInfo');
    
    return {
      hasPendingUpdate: !!pendingUpdate,
      isUpdateInProgress: !!updateConfig,
      pendingUpdate,
      lastUpdateCheck: this.store.get('lastUpdateCheck'),
      lastUpdateInfo,
      updateHistory: this.getUpdateHistory()
    };
  }

  // Auto-fix system dependencies
  async autoFixDependencies(progressCallback = null) {
    console.log('Starting auto-fix for system dependencies...');
    
    const results = {
      vcredist: { success: false, error: null },
      klite: { success: false, error: null }
    };

    try {
      // Ensure download directory exists
      this.ensureDownloadDirectory();

      // Fix Visual C++ Redistributable first (sequential execution)
      try {
        if (progressCallback) progressCallback('Downloading Visual C++ Redistributable...', 10);
        results.vcredist = await this.fixVCRedist((subProgress) => {
          if (progressCallback) progressCallback(`Visual C++ Redistributable: ${subProgress}%`, 10 + Math.round(subProgress * 0.4));
        });
        console.log('VCRedist fix completed:', results.vcredist);
      } catch (error) {
        console.error('VCRedist fix failed:', error);
        results.vcredist = { success: false, error: error.message };
      }

      // Add delay between installations to prevent EBUSY
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Fix K-Lite Codec Pack second (sequential execution)
      try {
        if (progressCallback) progressCallback('Downloading K-Lite Codec Pack...', 50);
        results.klite = await this.fixKLiteCodec((subProgress) => {
          if (progressCallback) progressCallback(`K-Lite Codec Pack: ${subProgress}%`, 50 + Math.round(subProgress * 0.4));
        });
        console.log('K-Lite fix completed:', results.klite);
      } catch (error) {
        console.error('K-Lite fix failed:', error);
        results.klite = { success: false, error: error.message };
      }

      if (progressCallback) progressCallback('Auto-fix completed', 100);
      
      // Log results
      console.log('Auto-fix results:', results);
      
      // Store fix history
      this.addToFixHistory({
        timestamp: Date.now(),
        results: results,
        success: results.vcredist.success && results.klite.success
      });

      return results;

    } catch (error) {
      console.error('Auto-fix failed:', error);
      if (progressCallback) progressCallback(`Auto-fix failed: ${error.message}`, -1);
      throw error;
    }
  }

  // Fix Visual C++ Redistributable
  async fixVCRedist(progressCallback = null) {
    try {
      console.log('Fixing Visual C++ Redistributable...');
      
      // Check if already installed
      const isInstalled = await this.checkVCRedistInstalled();
      if (isInstalled) {
        console.log('Visual C++ Redistributable is already installed');
        if (progressCallback) progressCallback('Visual C++ Redistributable already installed', 100);
        return { success: true, version: 'already_installed', alreadyInstalled: true };
      }
      
      // Get latest VCRedist release
      if (progressCallback) progressCallback('Getting Visual C++ Redistributable info...', 10);
      const vcredistInfo = await this.getVCRedistInfo();
      if (!vcredistInfo.downloadUrl) {
        throw new Error('Could not find VCRedist download URL');
      }

      // Download VCRedist
      if (progressCallback) progressCallback('Downloading Visual C++ Redistributable...', 20);
      const filePath = await this.downloadDependency(
        vcredistInfo,
        'vcredist',
        (progress) => {
          if (progressCallback) {
            progressCallback(`Downloading Visual C++ Redistributable: ${progress}%`, 20 + Math.round(progress * 0.6));
          }
        }
      );

      // Install VCRedist silently
      if (progressCallback) progressCallback('Installing Visual C++ Redistributable...', 80);
      await this.installDependency(filePath, this.autoFixSources.vcredist.installArgs);

      // Clean up
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupError) {
        console.warn('Could not clean up VCRedist file:', cleanupError.message);
      }

      if (progressCallback) progressCallback('Visual C++ Redistributable installed successfully', 100);
      console.log('Visual C++ Redistributable installed successfully');
      return { success: true, version: vcredistInfo.version };

    } catch (error) {
      console.error('VCRedist fix failed:', error);
      if (progressCallback) progressCallback(`VCRedist installation failed: ${error.message}`, -1);
      return { success: false, error: error.message };
    }
  }

  // Fix K-Lite Codec Pack
  async fixKLiteCodec(progressCallback = null) {
    try {
      console.log('Fixing K-Lite Codec Pack...');
      
      // Check if already installed
      const isInstalled = await this.checkKLiteInstalled();
      if (isInstalled) {
        console.log('K-Lite Codec Pack is already installed');
        if (progressCallback) progressCallback('K-Lite Codec Pack already installed', 100);
        return { success: true, version: 'already_installed', alreadyInstalled: true };
      }
      
      // Get K-Lite download info
      if (progressCallback) progressCallback('Getting K-Lite Codec Pack info...', 10);
      const kliteInfo = await this.getKLiteInfo();
      if (!kliteInfo.downloadUrl) {
        throw new Error('Could not find K-Lite download URL');
      }

      // Download K-Lite
      if (progressCallback) progressCallback('Downloading K-Lite Codec Pack...', 20);
      const filePath = await this.downloadDependency(
        kliteInfo,
        'klite',
        (progress) => {
          if (progressCallback) {
            progressCallback(`Downloading K-Lite Codec Pack: ${progress}%`, 20 + Math.round(progress * 0.6));
          }
        }
      );

      // Install K-Lite silently
      if (progressCallback) progressCallback('Installing K-Lite Codec Pack...', 80);
      await this.installDependency(filePath, this.autoFixSources.klite.installArgs);

      // Clean up
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupError) {
        console.warn('Could not clean up K-Lite file:', cleanupError.message);
      }

      if (progressCallback) progressCallback('K-Lite Codec Pack installed successfully', 100);
      console.log('K-Lite Codec Pack installed successfully');
      return { success: true, version: kliteInfo.version };

    } catch (error) {
      console.error('K-Lite fix failed:', error);
      if (progressCallback) progressCallback(`K-Lite installation failed: ${error.message}`, -1);
      return { success: false, error: error.message };
    }
  }

  // Get VCRedist release information
  async getVCRedistInfo() {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(this.autoFixSources.vcredist.url, {
        headers: {
          'User-Agent': 'DriveBox-App',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const release = await response.json();
      const asset = release.assets.find(asset => 
        this.autoFixSources.vcredist.filePattern.test(asset.name)
      );

      if (!asset) {
        throw new Error('VCRedist executable not found in release assets');
      }

      return {
        version: release.tag_name,
        downloadUrl: asset.browser_download_url,
        fileName: asset.name,
        fileSize: asset.size
      };

    } catch (error) {
      console.error('Failed to get VCRedist info:', error);
      throw error;
    }
  }

  // Get K-Lite download information
  async getKLiteInfo() {
    try {
      // Use direct download URL for K-Lite (more reliable)
      const directUrl = this.autoFixSources.klite.directUrl;
      const fileName = path.basename(directUrl);

      // Verify the URL is accessible
      const fetch = require('node-fetch');
      const response = await fetch(directUrl, { method: 'HEAD', timeout: 10000 });
      
      if (!response.ok) {
        throw new Error(`K-Lite download URL not accessible: ${response.status}`);
      }

      const fileSize = parseInt(response.headers.get('content-length') || '0');

      return {
        version: 'latest',
        downloadUrl: directUrl,
        fileName: fileName,
        fileSize: fileSize
      };

    } catch (error) {
      console.error('Failed to get K-Lite info:', error);
      throw error;
    }
  }

  // Download dependency file
  async downloadDependency(dependencyInfo, type, progressCallback = null) {
    console.log(`Downloading ${type}:`, dependencyInfo.fileName);

    const filePath = path.join(this.customDownloadPath, dependencyInfo.fileName);

    try {
      const fetch = require('node-fetch');
      const response = await fetch(dependencyInfo.downloadUrl, {
        headers: {
          'User-Agent': 'DriveBox-App'
        },
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const totalSize = dependencyInfo.fileSize || parseInt(response.headers.get('content-length') || '0');
      let downloadedSize = 0;

      // Create write stream
      const fileStream = fs.createWriteStream(filePath);

      // Download with progress tracking
      return new Promise((resolve, reject) => {
        response.body.on('data', (chunk) => {
          downloadedSize += chunk.length;

          if (progressCallback && totalSize > 0) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            progressCallback(progress);
          }
        });

        response.body.on('error', (error) => {
          fileStream.destroy();
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(error);
        });

        response.body.on('end', () => {
          fileStream.end();
          console.log(`${type} download completed:`, filePath);
          resolve(filePath);
        });

        response.body.pipe(fileStream);
      });

    } catch (error) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
  }

  // Install dependency silently
  async installDependency(filePath, installArgs, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Installing attempt ${attempt}/${maxRetries}:`, filePath, 'with args:', installArgs);
        
        return await new Promise((resolve, reject) => {
          const { spawn } = require('child_process');
          
          // Add random delay to prevent simultaneous access
          setTimeout(() => {
            try {
              const installer = spawn(filePath, installArgs, {
                stdio: 'pipe',
                windowsHide: true,
                detached: false
              });

              let output = '';
              let errorOutput = '';

              installer.stdout.on('data', (data) => {
                output += data.toString();
              });

              installer.stderr.on('data', (data) => {
                errorOutput += data.toString();
              });

              installer.on('close', (code) => {
                if (code === 0) {
                  console.log(`Installation completed successfully on attempt ${attempt}`);
                  resolve();
                } else {
                  console.error(`Installation failed with code: ${code} on attempt ${attempt}`);
                  console.error('Error output:', errorOutput);
                  reject(new Error(`Installation failed with exit code: ${code}\nError: ${errorOutput}`));
                }
              });

              installer.on('error', (error) => {
                console.error(`Installation process error on attempt ${attempt}:`, error);
                reject(error);
              });

              // Set timeout for installation (10 minutes)
              setTimeout(() => {
                try {
                  installer.kill('SIGTERM');
                  setTimeout(() => {
                    try {
                      installer.kill('SIGKILL');
                    } catch (e) {
                      // Process already killed
                    }
                  }, 5000);
                } catch (e) {
                  // Process already terminated
                }
                reject(new Error('Installation timeout'));
              }, 10 * 60 * 1000);
              
            } catch (spawnError) {
              reject(spawnError);
            }
          }, attempt * 1000); // Incremental delay
        });
        
      } catch (error) {
        lastError = error;
        console.warn(`Installation attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Wait before retry, with exponential backoff
          const delay = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Installation failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
  }

  // Get fix history
  getFixHistory() {
    return this.store.get('fixHistory', []);
  }

  // Add to fix history
  addToFixHistory(fixInfo) {
    const history = this.getFixHistory();
    history.unshift(fixInfo);
    
    // Keep only last 10 fixes
    if (history.length > 10) {
      history.splice(10);
    }
    
    this.store.set('fixHistory', history);
  }

  // Check if dependencies need fixing
  async checkDependenciesStatus() {
    const status = {
      vcredist: await this.checkVCRedistInstalled(),
      klite: await this.checkKLiteInstalled(),
      needsFix: false
    };

    status.needsFix = !status.vcredist || !status.klite;
    
    return status;
  }

  // Check if VCRedist is installed
  async checkVCRedistInstalled() {
    try {
      const { exec } = require('child_process');
      
      return new Promise((resolve) => {
        exec('reg query "HKLM\\SOFTWARE\\Classes\\Installer\\Dependencies" /s /f "Microsoft Visual C++"', 
          (error, stdout) => {
            const hasVCRedist = !error && stdout.includes('Microsoft Visual C++');
            resolve(hasVCRedist);
          }
        );
      });
    } catch (error) {
      console.warn('Could not check VCRedist status:', error.message);
      return false;
    }
  }

  // Check if K-Lite is installed
  async checkKLiteInstalled() {
    try {
      const kliteDir = 'C:\\Program Files (x86)\\K-Lite Codec Pack';
      const kliteDir64 = 'C:\\Program Files\\K-Lite Codec Pack';
      
      return fs.existsSync(kliteDir) || fs.existsSync(kliteDir64);
    } catch (error) {
      console.warn('Could not check K-Lite status:', error.message);
      return false;
    }
  }

  // Quick fix method for UI integration
  async quickFix(progressCallback = null) {
    try {
      if (progressCallback) progressCallback('Checking system dependencies...', 0);
      
      // Check current status
      const status = await this.checkDependenciesStatus();
      
      if (!status.needsFix) {
        if (progressCallback) progressCallback('All dependencies are already installed', 100);
        return {
          success: true,
          message: 'All dependencies are already installed',
          details: status
        };
      }

      // Perform auto-fix
      const results = await this.autoFixDependencies(progressCallback);
      
      return {
        success: results.vcredist.success && results.klite.success,
        message: 'Dependencies installation completed',
        details: results
      };

    } catch (error) {
      console.error('Quick fix failed:', error);
      if (progressCallback) progressCallback(`Quick fix failed: ${error.message}`, -1);
      
      return {
        success: false,
        message: error.message,
        details: null
      };
    }
  }
}

// NOTE: For release notes popup, ensure your renderer/UI uses a Markdown renderer (e.g. marked) to display updateInfo.releaseNotes in a modal.

module.exports = UpdateManager;
