Collecting workspace informationDựa trên yêu cầu của bạn, tôi sẽ tạo một todolist chi tiết để nâng cấp DriveBox:

## 🎯 TodoList - Nâng cấp DriveBox với Auto-Update & Contact Info

### 🔄 **Auto-Update System**
- [ ] Tạo version checker service trong main.js
- [ ] Thêm endpoint kiểm tra version mới từ GitHub API
- [ ] Implement auto-update logic khi khởi động app
- [ ] Tạo notification system cho available updates
- [ ] Thêm progress bar cho quá trình update
- [ ] Backup current version trước khi update

````javascript
// Thêm vào phần IPC handlers

// Auto-update checker
ipcMain.handle('check-app-updates', async () => {
  try {
    const currentVersion = app.getVersion();
    const response = await fetch('https://api.github.com/repos/TeoSushi1014/quizdrive/releases/latest');
    const latestRelease = await response.json();
    
    return {
      hasUpdate: latestRelease.tag_name !== `v${currentVersion}`,
      currentVersion,
      latestVersion: latestRelease.tag_name,
      downloadUrl: latestRelease.assets[0]?.browser_download_url,
      releaseNotes: latestRelease.body
    };
  } catch (error) {
    return { hasUpdate: false, error: error.message };
  }
});

// Download and install update
ipcMain.handle('download-app-update', async (event, updateInfo) => {
  // Implementation for downloading and installing update
});
````

### 📋 **App Version Management**
- [ ] Cập nhật package.json với version mới
- [ ] Hiển thị version trong UI header
- [ ] Thêm changelog/release notes viewer
- [ ] Version comparison logic
- [ ] Rollback mechanism nếu update fails

````javascript
// Thêm vào DriveBoxApp class

async checkForUpdates() {
    try {
        const updateInfo = await window.electronAPI.checkAppUpdates();
        if (updateInfo.hasUpdate) {
            this.showUpdateNotification(updateInfo);
        }
    } catch (error) {
        console.error('Update check failed:', error);
    }
}

showUpdateNotification(updateInfo) {
    // Hiển thị notification về update available
    this.showToast(`Có bản cập nhật mới: ${updateInfo.latestVersion}`, 'info');
}
````

### 👤 **Contact Information Integration**
- [ ] Tạo About/Contact modal trong index.html
- [ ] Thêm contact buttons vào header hoặc footer
- [ ] Integrate Zalo, Facebook, GitHub links
- [ ] Thêm developer info section
- [ ] QR code cho Zalo contact (optional)

````html
<!-- Thêm vào modal section -->

<!-- Contact Modal -->
<div id="contactModal" class="modal hidden">
    <div class="modal-content">
        <div class="modal-header">
            <h2>Liên Hệ & Hỗ Trợ</h2>
            <span class="close" id="closeContact">&times;</span>
        </div>
        <div class="modal-body">
            <div class="contact-info">
                <div class="contact-item">
                    <span class="contact-icon">📱</span>
                    <span class="contact-label">Zalo:</span>
                    <a href="https://zalo.me/0838696697" class="contact-link">0838 696 697</a>
                </div>
                <div class="contact-item">
                    <span class="contact-icon">📘</span>
                    <span class="contact-label">Facebook:</span>
                    <a href="https://www.facebook.com/boboiboy.gala.7/" class="contact-link" target="_blank">boboiboy.gala.7</a>
                </div>
                <div class="contact-item">
                    <span class="contact-icon">🐙</span>
                    <span class="contact-label">GitHub:</span>
                    <a href="https://github.com/TeoSushi1014/" class="contact-link" target="_blank">TeoSushi1014</a>
                </div>
                <div class="contact-item">
                    <span class="contact-icon">🚗</span>
                    <span class="contact-label">Project:</span>
                    <a href="https://github.com/TeoSushi1014/quizdrive" class="contact-link" target="_blank">QuizDrive</a>
                </div>
            </div>
            <div class="app-version">
                <p>DriveBox Version: <span id="appVersion">1.0.0</span></p>
                <button id="checkUpdatesBtn" class="btn btn-primary">Kiểm tra cập nhật</button>
            </div>
        </div>
    </div>
</div>
````

### 🎨 **UI/UX Improvements**
- [ ] Thêm version badge vào header
- [ ] Update notification system
- [ ] Contact quick access buttons
- [ ] Improved about section
- [ ] Loading states cho update process

````css
/* Thêm styles cho contact modal và version info */

.contact-info {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-bottom: 20px;
}

.contact-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: var(--card-bg);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
}

.contact-icon {
    font-size: 20px;
    width: 30px;
    text-align: center;
}

.contact-label {
    font-weight: 600;
    min-width: 80px;
}

.contact-link {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
}

.contact-link:hover {
    text-decoration: underline;
}

.app-version {
    text-align: center;
    padding: 15px;
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
}

.version-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    background: var(--primary-color);
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
}
````

### 🔧 **Backend Services**
- [ ] GitHub API integration trong main.js
- [ ] Auto-update scheduler (check on startup + periodic)
- [ ] Update download & install logic
- [ ] Backup & restore system
- [ ] Error handling cho update process

### 🚀 **Startup & Initialization**
- [ ] Auto-check updates on app launch
- [ ] Version display trong splash screen
- [ ] Contact info trong app menu
- [ ] Update notification system
- [ ] Graceful handling of update failures

### 📱 **User Experience**
- [ ] Update progress indicator
- [ ] Restart prompt after update
- [ ] Changelog viewer
- [ ] Contact support shortcuts
- [ ] Feedback system integration

### 🐛 **Error Handling & Testing**
- [ ] Network connectivity checks
- [ ] Fallback mechanisms
- [ ] Update rollback capability
- [ ] Contact link validation
- [ ] Version comparison edge cases

### 📋 **Implementation Priority**
1. **HIGH**: Auto-update checker service
2. **HIGH**: Version display in UI
3. **MEDIUM**: Contact modal implementation
4. **MEDIUM**: Update download/install logic
5. **LOW**: Advanced features (QR codes, changelog viewer)

### 🎯 **Files to Modify**
1. main.js - Auto-update logic, GitHub API
2. renderer.js - UI handlers, update checks
3. index.html - Contact modal, version display
4. styles.css - Contact modal styling
5. package.json - Version management
6. preload.js - API exposure for updates

Tôi recommend bắt đầu với **auto-update checker** và **contact modal** vì đây là những tính năng cơ bản nhất.