/**
 * Example integration of UpdateManager in your main application
 * Add this to your main.js or renderer process
 */

const UpdateManager = require('./src/utils/updateManager');

class AppUpdateIntegration {
  constructor() {
    this.updateManager = new UpdateManager();
  }

  async initialize() {
    // Initialize the update manager
    await this.updateManager.initialize();
    
    // Set up update event listeners
    this.setupUpdateListeners();
  }

  setupUpdateListeners() {
    // Example: Check for updates when user clicks a menu item
    // In your menu setup:
    /*
    {
      label: 'Check for Updates',
      click: () => this.checkForUpdates()
    }
    */
  }

  // Method to be called from your UI
  async checkForUpdates() {
    try {
      console.log('Checking for updates...');
      const updateInfo = await this.updateManager.checkForUpdates(false);
      
      if (updateInfo.hasUpdate) {
        // Show update available dialog to user
        const userWantsUpdate = await this.showUpdateDialog(updateInfo);
        
        if (userWantsUpdate) {
          await this.startUpdate(updateInfo);
        }
      } else {
        // Show "no updates available" message
        this.showNoUpdatesMessage(updateInfo);
      }
    } catch (error) {
      console.error('Update check failed:', error);
      // Show error message to user
      this.showUpdateError(error);
    }
  }

  // Show update available dialog (implement with your UI framework)
  async showUpdateDialog(updateInfo) {
    // Example implementation with Electron dialog
    const { dialog } = require('electron');
    
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `A new version of DriveBox is available!`,
      detail: `Current version: ${updateInfo.currentVersion}\nNew version: ${updateInfo.latestVersion}\n\nSize: ${Math.round(updateInfo.fileSize / 1024 / 1024)}MB\n\nWould you like to download and install it now?`,
      buttons: ['Update Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    });
    
    return result.response === 0;
  }

  // Start the update process
  async startUpdate(updateInfo) {
    try {
      // Show progress dialog
      this.showUpdateProgress('Preparing update...');
      
      // Start the update process
      // This will download the file and restart the app
      await this.updateManager.initiateUpdate(updateInfo);
      
    } catch (error) {
      console.error('Update failed:', error);
      this.showUpdateError(error);
    }
  }

  // Show update progress (implement with your UI)
  showUpdateProgress(message) {
    console.log('Update progress:', message);
    // Implement with your UI framework
    // Example: show a progress dialog or notification
  }

  // Show no updates message
  showNoUpdatesMessage(updateInfo) {
    const { dialog } = require('electron');
    
    dialog.showMessageBox({
      type: 'info',
      title: 'No Updates Available',
      message: 'You are running the latest version of DriveBox!',
      detail: `Current version: ${updateInfo.currentVersion}`,
      buttons: ['OK']
    });
  }

  // Show update error
  showUpdateError(error) {
    const { dialog } = require('electron');
    
    dialog.showMessageBox({
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates',
      detail: error.message,
      buttons: ['OK']
    });
  }

  // Get update status for UI
  getUpdateStatus() {
    return this.updateManager.getUpdateStatus();
  }

  // Get update settings for UI
  getUpdateSettings() {
    return this.updateManager.getUpdateSettings();
  }

  // Update settings from UI
  setUpdateSettings(settings) {
    return this.updateManager.setUpdateSettings(settings);
  }
}

module.exports = AppUpdateIntegration;

// Usage example:
/*
// In your main.js:
const AppUpdateIntegration = require('./path/to/this/file');

app.whenReady().then(async () => {
  const updateIntegration = new AppUpdateIntegration();
  await updateIntegration.initialize();
  
  // Check for updates on startup (optional)
  setTimeout(() => {
    updateIntegration.checkForUpdates();
  }, 30000); // Check after 30 seconds
});
*/
