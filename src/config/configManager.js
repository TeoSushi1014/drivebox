const Store = require('electron-store');
const path = require('path');
const fs = require('fs-extra');
const SecurityManager = require('./security');

class ConfigManager {
  constructor() {
    this.store = new Store({ name: 'config' });
    this.security = new SecurityManager();
    this.encryptedStore = new Store({ name: 'encrypted-config' });
    
    this.initializeDefaults();
  }

  initializeDefaults() {
    const defaults = {
      // Application settings
      app: {
        autoStart: false,
        minimizeToTray: true,
        startMinimized: false,
        closeToTray: true,
        language: 'en',
        theme: 'system', // light, dark, system
        checkForUpdates: true,
        updateChannel: 'stable' // stable, beta
      },
      
      // Sync settings
      sync: {
        enabled: true,
        interval: 30000, // 30 seconds
        conflictResolution: 'timestamp', // timestamp, manual, newest
        excludePatterns: [
          '**/.git/**',
          '**/node_modules/**',
          '**/.DS_Store',
          '**/Thumbs.db',
          '**/*.tmp',
          '**/*.temp'
        ],
        maxFileSize: 100 * 1024 * 1024, // 100MB
        bandwidthLimit: 0, // 0 = unlimited (bytes per second)
        retryAttempts: 3,
        retryDelay: 5000 // 5 seconds
      },
      
      // Security settings
      security: {
        encryptFiles: true,
        encryptionAlgorithm: 'aes-256-gcm',
        hashAlgorithm: 'sha256',
        requireAuth: true,
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        maxFailedAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes
        twoFactorEnabled: false
      },
      
      // Network settings
      network: {
        timeout: 30000, // 30 seconds
        retries: 3,
        proxy: {
          enabled: false,
          host: '',
          port: 0,
          username: '',
          password: '',
          type: 'http' // http, https, socks4, socks5
        },
        userAgent: 'DriveBox/1.0'
      },
      
      // Logging settings
      logging: {
        level: 'info', // error, warn, info, debug
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        enableConsole: false,
        categories: {
          sync: true,
          auth: true,
          security: true,
          network: true,
          file: true,
          performance: true
        }
      },
      
      // UI settings
      ui: {
        windowState: {
          width: 1200,
          height: 800,
          x: null,
          y: null,
          maximized: false
        },
        notifications: {
          enabled: true,
          syncComplete: true,
          errors: true,
          conflicts: true,
          updates: true
        },
        tray: {
          enabled: true,
          showNotifications: true,
          quickActions: ['sync', 'pause', 'settings']
        }
      },
      
      // Performance settings
      performance: {
        concurrentOperations: 3,
        chunkSize: 8 * 1024 * 1024, // 8MB
        memoryLimit: 512 * 1024 * 1024, // 512MB
        cacheSize: 100 * 1024 * 1024, // 100MB
        enableCompression: true,
        compressionLevel: 6
      }
    };
    
    // Set defaults if not already set
    Object.keys(defaults).forEach(section => {
      if (!this.store.has(section)) {
        this.store.set(section, defaults[section]);
      }
    });
  }

  // Get configuration value
  get(key, defaultValue = null) {
    try {
      return this.store.get(key, defaultValue);
    } catch (error) {
      console.error('Failed to get config:', error);
      return defaultValue;
    }
  }

  // Set configuration value
  set(key, value) {
    try {
      this.store.set(key, value);
      return true;
    } catch (error) {
      console.error('Failed to set config:', error);
      return false;
    }
  }

  // Get encrypted configuration value
  getEncrypted(key, password, defaultValue = null) {
    try {
      const encryptedData = this.encryptedStore.get(key);
      if (!encryptedData) {
        return defaultValue;
      }
      
      const decrypted = this.security.decryptData(encryptedData, password);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to get encrypted config:', error);
      return defaultValue;
    }
  }

  // Set encrypted configuration value
  setEncrypted(key, value, password) {
    try {
      const jsonValue = JSON.stringify(value);
      const encrypted = this.security.encryptData(jsonValue, password);
      this.encryptedStore.set(key, encrypted);
      return true;
    } catch (error) {
      console.error('Failed to set encrypted config:', error);
      return false;
    }
  }

  // Get all configuration
  getAll() {
    try {
      return this.store.store;
    } catch (error) {
      console.error('Failed to get all config:', error);
      return {};
    }
  }

  // Update configuration section
  updateSection(section, updates) {
    try {
      const current = this.get(section, {});
      const updated = { ...current, ...updates };
      this.set(section, updated);
      return true;
    } catch (error) {
      console.error('Failed to update config section:', error);
      return false;
    }
  }

  // Reset configuration to defaults
  reset(section = null) {
    try {
      if (section) {
        this.store.delete(section);
      } else {
        this.store.clear();
      }
      this.initializeDefaults();
      return true;
    } catch (error) {
      console.error('Failed to reset config:', error);
      return false;
    }
  }

  // Validate configuration
  validate() {
    const errors = [];
    
    try {
      // Validate sync settings
      const sync = this.get('sync');
      if (sync.interval < 5000) {
        errors.push('Sync interval must be at least 5 seconds');
      }
      if (sync.maxFileSize < 1024) {
        errors.push('Max file size must be at least 1KB');
      }
      
      // Validate security settings
      const security = this.get('security');
      if (security.sessionTimeout < 60000) {
        errors.push('Session timeout must be at least 1 minute');
      }
      if (security.maxFailedAttempts < 1) {
        errors.push('Max failed attempts must be at least 1');
      }
      
      // Validate network settings
      const network = this.get('network');
      if (network.timeout < 1000) {
        errors.push('Network timeout must be at least 1 second');
      }
      if (network.proxy.enabled) {
        if (!network.proxy.host) {
          errors.push('Proxy host is required when proxy is enabled');
        }
        if (network.proxy.port < 1 || network.proxy.port > 65535) {
          errors.push('Proxy port must be between 1 and 65535');
        }
      }
      
      // Validate logging settings
      const logging = this.get('logging');
      const validLevels = ['error', 'warn', 'info', 'debug'];
      if (!validLevels.includes(logging.level)) {
        errors.push('Invalid logging level');
      }
      
      // Validate performance settings
      const performance = this.get('performance');
      if (performance.concurrentOperations < 1) {
        errors.push('Concurrent operations must be at least 1');
      }
      if (performance.chunkSize < 1024) {
        errors.push('Chunk size must be at least 1KB');
      }
      
      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error('Config validation failed:', error);
      return {
        valid: false,
        errors: ['Configuration validation failed']
      };
    }
  }

  // Export configuration
  async exportConfig(filePath, includeEncrypted = false, password = null) {
    try {
      const config = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        config: this.getAll()
      };
      
      if (includeEncrypted && password) {
        config.encrypted = this.encryptedStore.store;
      }
      
      await fs.writeJSON(filePath, config, { spaces: 2 });
      return { success: true, path: filePath };
    } catch (error) {
      console.error('Failed to export config:', error);
      throw error;
    }
  }

  // Import configuration
  async importConfig(filePath, password = null) {
    try {
      const data = await fs.readJSON(filePath);
      
      if (!data.config) {
        throw new Error('Invalid configuration file format');
      }
      
      // Validate imported config
      const tempStore = new Store({ name: 'temp-import' });
      tempStore.store = data.config;
      
      // Apply configuration
      this.store.store = data.config;
      
      // Import encrypted data if available
      if (data.encrypted && password) {
        this.encryptedStore.store = data.encrypted;
      }
      
      // Clean up temp store
      tempStore.clear();
      
      return { success: true };
    } catch (error) {
      console.error('Failed to import config:', error);
      throw error;
    }
  }

  // Backup configuration
  async backupConfig(backupDir = null) {
    try {
      if (!backupDir) {
        backupDir = path.join(this.store.path, '..', 'backups');
      }
      
      await fs.ensureDir(backupDir);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(backupDir, `config-backup-${timestamp}.json`);
      
      await this.exportConfig(backupFile);
      
      // Clean old backups (keep last 10)
      const backupFiles = (await fs.readdir(backupDir))
        .filter(file => file.startsWith('config-backup-') && file.endsWith('.json'))
        .sort()
        .reverse();
      
      if (backupFiles.length > 10) {
        for (const file of backupFiles.slice(10)) {
          await fs.remove(path.join(backupDir, file));
        }
      }
      
      return { success: true, path: backupFile };
    } catch (error) {
      console.error('Failed to backup config:', error);
      throw error;
    }
  }

  // Get cloud provider configurations
  getProviderConfigs() {
    return {
      googleDrive: this.getEncrypted('providers.googleDrive', 'default-password', {}),
      dropbox: this.getEncrypted('providers.dropbox', 'default-password', {}),
      oneDrive: this.getEncrypted('providers.oneDrive', 'default-password', {})
    };
  }

  // Set cloud provider configuration
  setProviderConfig(provider, config, password = 'default-password') {
    return this.setEncrypted(`providers.${provider}`, config, password);
  }

  // Remove cloud provider configuration
  removeProviderConfig(provider) {
    try {
      this.encryptedStore.delete(`providers.${provider}`);
      return true;
    } catch (error) {
      console.error('Failed to remove provider config:', error);
      return false;
    }
  }

  // Get sync folders
  getSyncFolders() {
    return this.get('sync.folders', []);
  }

  // Add sync folder
  addSyncFolder(folder) {
    const folders = this.getSyncFolders();
    const exists = folders.some(f => f.path === folder.path);
    
    if (!exists) {
      folders.push({
        id: this.security.generateSecureToken(8),
        path: folder.path,
        name: folder.name || path.basename(folder.path),
        enabled: folder.enabled !== false,
        providers: folder.providers || [],
        excludePatterns: folder.excludePatterns || [],
        created: Date.now()
      });
      
      this.set('sync.folders', folders);
    }
    
    return folders;
  }

  // Remove sync folder
  removeSyncFolder(folderId) {
    const folders = this.getSyncFolders();
    const updated = folders.filter(f => f.id !== folderId);
    this.set('sync.folders', updated);
    return updated;
  }

  // Update sync folder
  updateSyncFolder(folderId, updates) {
    const folders = this.getSyncFolders();
    const index = folders.findIndex(f => f.id === folderId);
    
    if (index !== -1) {
      folders[index] = { ...folders[index], ...updates };
      this.set('sync.folders', folders);
    }
    
    return folders;
  }

  // Get application statistics
  getStats() {
    return {
      configSize: JSON.stringify(this.getAll()).length,
      encryptedConfigSize: JSON.stringify(this.encryptedStore.store).length,
      syncFolders: this.getSyncFolders().length,
      providers: Object.keys(this.getProviderConfigs()).length,
      lastModified: this.store.get('_lastModified', null)
    };
  }

  // Watch for configuration changes
  onChange(callback) {
    this.store.onDidChange('config', callback);
  }

  // Get file path for config
  getConfigPath() {
    return this.store.path;
  }
}

// Create singleton instance
const configManager = new ConfigManager();

module.exports = configManager;
