/**
 * Enhanced Update Manager for DriveBox
 * Handles auto-updates with multiple fallback strategies
 */

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');

class UpdateManager {
  constructor() {
    this.store = new Store();
    this.updateCheckInterval = 60 * 60 * 1000; // Check every hour
    this.lastCheckTime = 0;
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
  }

  // Initialize update manager
  async initialize() {
    console.log('Initializing Update Manager...');
    
    // Clean up old update files on startup
    this.cleanupOldUpdates();
    
    // Check for pending updates
    await this.checkPendingUpdates();
    
    // Set up periodic update checks
    this.setupPeriodicChecks();
    
    console.log('Update Manager initialized successfully');
  }

  // Clean up old update files and backups
  cleanupOldUpdates() {
    try {
      // Clean temp update directory
      const tempDir = path.join(require('os').tmpdir(), 'drivebox-update');
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
          const filePath = path.join(tempDir, file);
          const stats = fs.statSync(filePath);
          const age = Date.now() - stats.mtime.getTime();
          
          // Remove files older than 24 hours
          if (age > 24 * 60 * 60 * 1000) {
            try {
              fs.unlinkSync(filePath);
              console.log('Cleaned up old update file:', file);
            } catch (error) {
              console.warn('Could not clean up file:', file, error.message);
            }
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
      
      // Verify the pending update file still exists and is valid
      if (fs.existsSync(pendingUpdate.filePath)) {
        const validation = await this.validateUpdateFile(pendingUpdate.filePath);
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
      
      // Clear invalid pending update
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
      const currentVersion = app?.getVersion ? app.getVersion() : '1.2.4'; // Fallback for testing
      const now = Date.now();
      
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
      console.error('Update check failed:', error);      return {
        hasUpdate: false,
        currentVersion: app?.getVersion ? app.getVersion() : '1.2.4',
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
        return { valid: false, error: 'Update file not found' };
      }
      
      const stats = fs.statSync(filePath);
      
      // Size checks
      if (stats.size < 5 * 1024 * 1024) {
        return { valid: false, error: 'File too small (< 5MB)' };
      }
      
      if (stats.size > 500 * 1024 * 1024) {
        return { valid: false, error: 'File too large (> 500MB)' };
      }
      
      // PE header validation
      const buffer = fs.readFileSync(filePath, { start: 0, end: 64 });
      
      if (buffer[0] !== 0x4D || buffer[1] !== 0x5A) {
        return { valid: false, error: 'Invalid PE header' };
      }
      
      const peOffset = buffer.readUInt32LE(60);
      if (peOffset < 64 || peOffset > stats.size - 4) {
        return { valid: false, error: 'Invalid PE offset' };
      }
      
      return { valid: true };
      
    } catch (error) {
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
      downloadPath: path.join(require('os').tmpdir(), 'drivebox-update')
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
}

module.exports = UpdateManager;
