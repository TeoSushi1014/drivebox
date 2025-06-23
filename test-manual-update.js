/**
 * Test script for manual update functionality
 */

const UpdateManager = require('./src/utils/updateManager');

async function testManualUpdate() {
  console.log('=== Manual Update Test ===');
  
  const updateManager = new UpdateManager();
  
  try {
    // Initialize the update manager
    await updateManager.initialize();
    
    console.log('\n1. Checking for updates...');
    const updateInfo = await updateManager.checkForUpdates(false);
    
    if (updateInfo.hasUpdate) {
      console.log('\n2. Update available!');
      console.log('Current version:', updateInfo.currentVersion);
      console.log('Latest version:', updateInfo.latestVersion);
      console.log('Download URL:', updateInfo.downloadUrl);
      console.log('File size:', Math.round(updateInfo.fileSize / 1024 / 1024) + 'MB');
      
      // Simulate user confirmation
      console.log('\n3. User confirmed update - starting download and installation...');
      
      // This will:
      // 1. Download the update to C:\Tèo Sushi
      // 2. Restart the app with --update-mode flag
      // 3. The new instance will replace the old exe and restart normally
      await updateManager.initiateUpdate(updateInfo);
      
    } else {
      console.log('\n2. No updates available');
      console.log('Current version:', updateInfo.currentVersion);
      if (updateInfo.error) {
        console.log('Error:', updateInfo.error);
      }
    }
    
    // Show update status
    console.log('\n4. Update Status:');
    const status = updateManager.getUpdateStatus();
    console.log('Has pending update:', status.hasPendingUpdate);
    console.log('Update in progress:', status.isUpdateInProgress);
    console.log('Last check:', new Date(status.lastUpdateCheck || 0).toLocaleString());
    
    // Show update history
    console.log('\n5. Update History:');
    const history = updateManager.getUpdateHistory();
    if (history.length > 0) {
      history.forEach((update, index) => {
        console.log(`${index + 1}. ${update.latestVersion} - ${update.status} - ${new Date(update.timestamp).toLocaleString()}`);
      });
    } else {
      console.log('No update history');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Handle update mode if this script is run with --update-mode
if (process.argv.includes('--update-mode')) {
  console.log('Running in update mode...');
  const updateManager = new UpdateManager();
  updateManager.initialize();
} else {
  // Run the test
  testManualUpdate();
}
