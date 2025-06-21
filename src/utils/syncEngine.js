const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const EventEmitter = require('events');
const SecurityManager = require('./security');

class SyncEngine extends EventEmitter {  constructor(options = {}) {
    super();
    this.localPath = options.localPath || './sync';
    this.conflictResolution = options.conflictResolution || 'timestamp'; // timestamp, manual, newest
    this.providers = new Map();
    this.watchers = new Map();
    this.syncQueue = [];
    this.isRunning = false;
    this.syncInterval = options.syncInterval || 30000; // 30 seconds
    this.security = new SecurityManager();
    this.syncMetadata = new Map(); // Store file metadata for conflict resolution
    this.metadataPath = null; // Will be set in initializeLocalPath
    
    this.initializeLocalPath();
  }
  async initializeLocalPath() {
    try {
      await fs.ensureDir(this.localPath);
      await fs.ensureDir(path.join(this.localPath, '.drivebox'));
      this.metadataPath = path.join(this.localPath, '.drivebox', 'metadata.json');
      await this.loadMetadata();
    } catch (error) {
      console.error('Failed to initialize local path:', error);
      // Set a fallback metadata path
      this.metadataPath = path.join(this.localPath || './sync', '.drivebox', 'metadata.json');
    }
  }

  async loadMetadata() {
    try {
      if (await fs.pathExists(this.metadataPath)) {
        const metadata = await fs.readJSON(this.metadataPath);
        this.syncMetadata = new Map(Object.entries(metadata));
      }
    } catch (error) {
      console.error('Failed to load metadata:', error);
    }
  }
  async saveMetadata() {
    try {
      if (this.metadataPath) {
        const metadata = Object.fromEntries(this.syncMetadata);
        await fs.writeJSON(this.metadataPath, metadata, { spaces: 2 });
      }
    } catch (error) {
      console.error('Failed to save metadata:', error);
    }
  }

  addProvider(name, provider) {
    this.providers.set(name, provider);
    this.emit('providerAdded', name);
  }

  removeProvider(name) {
    if (this.providers.has(name)) {
      this.providers.delete(name);
      this.stopWatching(name);
      this.emit('providerRemoved', name);
    }
  }

  async startSync() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emit('syncStarted');
    
    // Start file watchers for local changes
    this.startWatching();
    
    // Initial sync
    await this.performFullSync();
    
    // Set up periodic sync
    this.syncTimer = setInterval(() => {
      this.performIncrementalSync();
    }, this.syncInterval);
    
    console.log('Sync engine started');
  }

  async stopSync() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // Stop all watchers
    for (const [name, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
    
    // Clear sync timer
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    await this.saveMetadata();
    this.emit('syncStopped');
    console.log('Sync engine stopped');
  }

  startWatching() {
    const watcher = chokidar.watch(this.localPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true
    });

    watcher
      .on('add', filePath => this.handleLocalFileChange('add', filePath))
      .on('change', filePath => this.handleLocalFileChange('change', filePath))
      .on('unlink', filePath => this.handleLocalFileChange('delete', filePath))
      .on('addDir', dirPath => this.handleLocalFileChange('addDir', dirPath))
      .on('unlinkDir', dirPath => this.handleLocalFileChange('deleteDir', dirPath));

    this.watchers.set('local', watcher);
  }

  stopWatching(name) {
    if (this.watchers.has(name)) {
      this.watchers.get(name).close();
      this.watchers.delete(name);
    }
  }

  async handleLocalFileChange(event, filePath) {
    const relativePath = path.relative(this.localPath, filePath);
    
    // Skip metadata files
    if (relativePath.startsWith('.drivebox')) return;
    
    const changeInfo = {
      type: 'local',
      event,
      path: relativePath,
      fullPath: filePath,
      timestamp: Date.now()
    };

    if (['add', 'change'].includes(event) && !event.includes('Dir')) {
      try {
        const stats = await fs.stat(filePath);
        const hash = await this.security.generateFileHash(filePath);
        changeInfo.size = stats.size;
        changeInfo.hash = hash;
        changeInfo.modified = stats.mtime.getTime();
      } catch (error) {
        console.error('Error getting file stats:', error);
        return;
      }
    }

    this.queueSync(changeInfo);
    this.emit('localChange', changeInfo);
  }

  queueSync(changeInfo) {
    // Remove any existing sync for the same file
    this.syncQueue = this.syncQueue.filter(item => item.path !== changeInfo.path);
    this.syncQueue.push(changeInfo);
    
    // Process queue if not already processing
    if (!this.processingQueue) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.processingQueue || this.syncQueue.length === 0) return;
    
    this.processingQueue = true;
    
    while (this.syncQueue.length > 0) {
      const change = this.syncQueue.shift();
      await this.processSyncChange(change);
      
      // Small delay between operations to prevent overwhelming APIs
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.processingQueue = false;
  }

  async processSyncChange(change) {
    try {
      this.emit('syncProgress', { type: 'processing', change });
      
      for (const [providerName, provider] of this.providers) {
        await this.syncToProvider(providerName, provider, change);
      }
      
      // Update metadata
      this.updateMetadata(change);
      
    } catch (error) {
      console.error('Error processing sync change:', error);
      this.emit('syncError', { change, error });
    }
  }

  async syncToProvider(providerName, provider, change) {
    try {
      switch (change.event) {
        case 'add':
        case 'change':
          await provider.uploadFile(change.fullPath, change.path);
          break;
        case 'delete':
          await provider.deleteFile(change.path);
          break;
        case 'addDir':
          await provider.createFolder(change.path);
          break;
        case 'deleteDir':
          await provider.deleteFolder(change.path);
          break;
      }
      
      this.emit('syncSuccess', { provider: providerName, change });
    } catch (error) {
      console.error(`Sync to ${providerName} failed:`, error);
      this.emit('syncError', { provider: providerName, change, error });
    }
  }

  updateMetadata(change) {
    const metadata = {
      lastSync: Date.now(),
      event: change.event,
      hash: change.hash,
      size: change.size,
      modified: change.modified
    };
    
    this.syncMetadata.set(change.path, metadata);
  }

  async performFullSync() {
    this.emit('syncProgress', { type: 'fullSync', status: 'started' });
    
    try {
      // Sync from all providers
      for (const [providerName, provider] of this.providers) {
        await this.syncFromProvider(providerName, provider);
      }
      
      await this.saveMetadata();
      this.emit('syncProgress', { type: 'fullSync', status: 'completed' });
    } catch (error) {
      console.error('Full sync failed:', error);
      this.emit('syncError', { type: 'fullSync', error });
    }
  }

  async performIncrementalSync() {
    if (this.syncQueue.length > 0) {
      // Process pending local changes first
      await this.processQueue();
    }
    
    // Check for remote changes
    for (const [providerName, provider] of this.providers) {
      try {
        const remoteChanges = await provider.getChanges();
        for (const change of remoteChanges) {
          await this.handleRemoteChange(providerName, change);
        }
      } catch (error) {
        console.error(`Failed to get changes from ${providerName}:`, error);
      }
    }
  }

  async syncFromProvider(providerName, provider) {
    try {
      const files = await provider.listFiles();
      
      for (const file of files) {
        const localPath = path.join(this.localPath, file.path);
        const localExists = await fs.pathExists(localPath);
        
        if (!localExists) {
          // Download new file
          await this.downloadFile(provider, file, localPath);
        } else {
          // Check for conflicts
          const conflict = await this.detectConflict(file, localPath);
          if (conflict) {
            await this.resolveConflict(provider, file, localPath, conflict);
          }
        }
      }
    } catch (error) {
      console.error(`Sync from ${providerName} failed:`, error);
      throw error;
    }
  }

  async downloadFile(provider, file, localPath) {
    try {
      await fs.ensureDir(path.dirname(localPath));
      await provider.downloadFile(file.path, localPath);
      
      this.updateMetadata({
        path: file.path,
        event: 'download',
        hash: file.hash,
        size: file.size,
        modified: file.modified
      });
      
      this.emit('fileDownloaded', { file, localPath });
    } catch (error) {
      console.error('File download failed:', error);
      throw error;
    }
  }

  async detectConflict(remoteFile, localPath) {
    try {
      const localStats = await fs.stat(localPath);
      const localHash = await this.security.generateFileHash(localPath);
      const metadata = this.syncMetadata.get(remoteFile.path);
      
      // No conflict if hashes match
      if (localHash === remoteFile.hash) {
        return null;
      }
      
      // Conflict detected
      return {
        type: 'content',
        local: {
          hash: localHash,
          size: localStats.size,
          modified: localStats.mtime.getTime()
        },
        remote: {
          hash: remoteFile.hash,
          size: remoteFile.size,
          modified: remoteFile.modified
        },
        lastSync: metadata ? metadata.lastSync : 0
      };
    } catch (error) {
      console.error('Conflict detection failed:', error);
      return null;
    }
  }

  async resolveConflict(provider, remoteFile, localPath, conflict) {
    this.emit('conflictDetected', { remoteFile, localPath, conflict });
    
    let resolution;
    
    switch (this.conflictResolution) {
      case 'timestamp':
        resolution = conflict.remote.modified > conflict.local.modified ? 'remote' : 'local';
        break;
      case 'newest':
        resolution = 'remote'; // Always prefer remote for newest strategy
        break;
      case 'manual':
        // Emit event for manual resolution
        resolution = await new Promise(resolve => {
          this.emit('conflictResolution', { 
            remoteFile, 
            localPath, 
            conflict, 
            resolve 
          });
        });
        break;
      default:
        resolution = 'local';
    }
    
    if (resolution === 'remote') {
      // Backup local file and download remote
      const backupPath = `${localPath}.backup.${Date.now()}`;
      await fs.copy(localPath, backupPath);
      await provider.downloadFile(remoteFile.path, localPath);
      this.emit('conflictResolved', { resolution: 'remote', backupPath });
    } else {
      // Upload local file to remote
      await provider.uploadFile(localPath, remoteFile.path);
      this.emit('conflictResolved', { resolution: 'local' });
    }
  }

  async handleRemoteChange(providerName, change) {
    const localPath = path.join(this.localPath, change.path);
    
    try {
      switch (change.event) {
        case 'add':
        case 'change':
          await this.downloadFile(this.providers.get(providerName), change, localPath);
          break;
        case 'delete':
          if (await fs.pathExists(localPath)) {
            await fs.remove(localPath);
            this.syncMetadata.delete(change.path);
          }
          break;
      }
      
      this.emit('remoteChange', { provider: providerName, change });
    } catch (error) {
      console.error('Failed to handle remote change:', error);
      this.emit('syncError', { provider: providerName, change, error });
    }
  }

  // Get sync statistics
  getStats() {
    return {
      isRunning: this.isRunning,
      queueLength: this.syncQueue.length,
      providersCount: this.providers.size,
      watchersCount: this.watchers.size,
      filesTracked: this.syncMetadata.size
    };
  }

  // Force sync specific file
  async forceSyncFile(filePath) {
    const fullPath = path.resolve(this.localPath, filePath);
    if (await fs.pathExists(fullPath)) {
      await this.handleLocalFileChange('change', fullPath);
    }
  }

  // Pause/Resume sync
  pauseSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.emit('syncPaused');
  }

  resumeSync() {
    if (!this.syncTimer && this.isRunning) {
      this.syncTimer = setInterval(() => {
        this.performIncrementalSync();
      }, this.syncInterval);
      this.emit('syncResumed');
    }
  }
}

module.exports = SyncEngine;
