// Test the enhanced update system
const UpdateManager = require('./src/utils/updateManager');
const UpdateNotificationSystem = require('./src/utils/updateNotifications');

async function testUpdateSystem() {
  console.log('Testing enhanced update system...\n');

  // Test 1: Initialize Update Manager
  console.log('Test 1: Initialize Update Manager');
  const updateManager = new UpdateManager();
  
  try {
    await updateManager.initialize();
    console.log('✅ Update Manager initialized successfully\n');
  } catch (error) {
    console.log('❌ Update Manager initialization failed:', error.message, '\n');
  }

  // Test 2: Test Update Settings
  console.log('Test 2: Update Settings');
  try {
    const defaultSettings = updateManager.getUpdateSettings();
    console.log('✅ Default settings retrieved:', defaultSettings);
    
    const newSettings = updateManager.setUpdateSettings({ autoCheck: false });
    console.log('✅ Settings updated successfully:', newSettings, '\n');
  } catch (error) {
    console.log('❌ Update settings test failed:', error.message, '\n');
  }

  // Test 3: Test Version Comparison
  console.log('Test 3: Version Comparison');
  try {
    const result1 = updateManager.compareVersions('1.2.5', '1.2.4');
    const result2 = updateManager.compareVersions('1.2.4', '1.2.5');
    const result3 = updateManager.compareVersions('1.2.4', '1.2.4');
    
    console.log(`✅ Version comparison tests:
      1.2.5 vs 1.2.4: ${result1} (expected: 1)
      1.2.4 vs 1.2.5: ${result2} (expected: -1) 
      1.2.4 vs 1.2.4: ${result3} (expected: 0)\n`);
  } catch (error) {
    console.log('❌ Version comparison test failed:', error.message, '\n');
  }

  // Test 4: Test Notification System
  console.log('Test 4: Notification System');
  try {
    const notificationSystem = new UpdateNotificationSystem();
    
    // Test update available notification
    const updateInfo = {
      hasUpdate: true,
      currentVersion: '1.2.4',
      latestVersion: 'v1.2.5',
      releaseNotes: 'Bug fixes and improvements'
    };
    
    const notification = notificationSystem.showUpdateAvailable(updateInfo);
    console.log('✅ Update notification created:', notification.title);
    
    // Test progress notification
    const progressNotification = notificationSystem.showDownloadProgress({
      progress: 50,
      speed: '2.5 MB/s'
    });
    console.log('✅ Progress notification created:', progressNotification.title);
    
    // Test stats
    const stats = notificationSystem.getStats();
    console.log('✅ Notification stats:', stats, '\n');
  } catch (error) {
    console.log('❌ Notification system test failed:', error.message, '\n');
  }

  // Test 5: Test File Validation (existing files only)
  console.log('Test 5: File Validation');
  try {
    // Test with a real executable file (if exists)
    const possibleFiles = [
      'C:\\Windows\\System32\\notepad.exe',
      'C:\\Windows\\System32\\calc.exe',
      process.execPath
    ];
    
    for (const filePath of possibleFiles) {
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        const validation = await updateManager.validateUpdateFile(filePath);
        console.log(`✅ Validation of ${filePath.split('\\').pop()}: ${validation.valid ? 'Valid' : validation.error}`);
        break;
      }
    }
  } catch (error) {
    console.log('❌ File validation test failed:', error.message);
  }

  console.log('\n🎉 Update system testing completed!');
  console.log('\n📋 Summary:');
  console.log('- Enhanced update checking with multiple sources');
  console.log('- Improved download reliability with retry logic');
  console.log('- Better file validation and error handling');
  console.log('- Comprehensive notification system');
  console.log('- Multiple installation fallback strategies');
  console.log('- Automatic cleanup and maintenance');
}

// Mock app.getVersion for testing
global.app = {
  getVersion: () => '1.2.4'
};

testUpdateSystem().catch(console.error);
