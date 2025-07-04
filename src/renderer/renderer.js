class DriveBoxApp {    constructor() {
        this.apps = [];
        this.installedApps = {};
        this.downloadFolder = 'C:\\Tèo Sushi';
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.downloadQueue = [];
        this.currentDownload = null;
        this.isDownloading = false;
        this.currentUpdateInfo = null; // Store current update information
        this.init();
    }async init() {
        this.initTheme();
        await this.updateFooterVersion(); // Update version display early
        await this.loadApps();
        this.setupEventListeners();
        this.setupProgressListener();
        this.setupContactFooter();
        this.setupAutoUpdate();
        this.updateStatusBar(`Ready - Download folder: ${this.downloadFolder}`);
    }

    initTheme() {
        // Apply saved theme
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        this.updateThemeToggleButton();
        
        // Setup theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('theme', this.currentTheme);
        this.updateThemeToggleButton();
    }

    updateThemeToggleButton() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.innerHTML = this.currentTheme === 'light' ? '🌙 Dark' : '☀️ Light';
        }
    }    setupProgressListener() {
        // Listen for download progress updates
        window.electronAPI.onDownloadProgress((data) => {
            if (data.progress !== undefined) {
                this.updateEnhancedProgressBar(data);
            }
            this.updateStatusBar(data.message);
            
            // Check if download completed successfully
            if (data.message && data.message.includes('completed successfully')) {
                this.onDownloadComplete();
                // Refresh the installed apps list to update button states
                setTimeout(() => {
                    this.loadInstalledApps();
                }, 1000);
            }
        });
          // Listen for update download progress if available
        if (window.electronAPI.onUpdateDownloadProgress) {
            window.electronAPI.onUpdateDownloadProgress((data) => {
                console.log('Update download progress:', data);                // Use the same progress bar for update downloads with enhanced data
                if (data.progress !== undefined && this.isDownloading && this.currentDownload?.app?.id === 'app-update') {
                    this.updateEnhancedProgressBar({
                        progress: data.progress,
                        appName: `Cập nhật DriveBox v${data.version || this.currentUpdateInfo?.latestVersion || 'mới'}`,
                        downloadedSize: data.downloadedBytes || data.transferred || 0,
                        totalSize: data.totalBytes || data.total || this.currentUpdateInfo?.fileSize || 0,
                        speed: data.speed || data.bytesPerSecond || 0,
                        eta: data.eta || 0,
                        message: data.message || `Đang tải cập nhật... ${Math.round(data.progress)}%`
                    });
                }
                
                this.updateStatusBar(data.message || `🔄 Đang tải cập nhật... ${Math.round(data.progress || 0)}%`);
            });
        }
    }updateEnhancedProgressBar(data) {
        try {
            const progressContainer = document.getElementById('downloadProgressContainer');
            const progressFill = document.getElementById('downloadProgressFill');
            const progressText = document.getElementById('downloadProgressText');
            const fileName = document.getElementById('downloadFileName');
            const fileStatus = document.getElementById('downloadFileStatus');

            if (!progressContainer) {
                console.warn('Progress container not found');
                return;
            }            // Debug log to see what data we're getting
            console.log('Progress data:', data);
            console.log('Data types:', {
                downloadedSize: typeof data.downloadedSize, 
                totalSize: typeof data.totalSize,
                speed: typeof data.speed,
                downloadedSizeValue: data.downloadedSize,
                totalSizeValue: data.totalSize,
                speedValue: data.speed
            });

            // Show progress bar when downloading
            if (this.isDownloading) {
                progressContainer.classList.add('active');
            }

            // Update progress
            if (data.progress !== undefined && data.progress >= 0) {
                const percent = Math.min(100, Math.max(0, Math.round(data.progress)));
                if (progressFill) progressFill.style.width = `${percent}%`;
                if (progressText) progressText.textContent = `${percent}%`;
            }

            // Update file info
            if (fileName && data.appName) {
                fileName.textContent = data.appName;
            }

            // Update file status with corrected info
            if (fileStatus) {
                let statusParts = [];
                  try {
                    // Handle different data formats
                    if (data.transferredBytes && data.totalBytes) {
                        const downloaded = this.formatFileSize(data.transferredBytes);
                        const total = this.formatFileSize(data.totalBytes);
                        statusParts.push(`${downloaded} / ${total}`);
                    } else if (data.downloadedSize && data.totalSize) {
                        // Check if the values are already formatted strings (e.g., "60.5 MB")
                        const downloadedStr = data.downloadedSize.toString();
                        const totalStr = data.totalSize.toString();
                        
                        if (downloadedStr.includes('MB') || downloadedStr.includes('GB') || downloadedStr.includes('KB')) {
                            // Already formatted - use as is
                            statusParts.push(`${downloadedStr} / ${totalStr}`);
                        } else {
                            // Parse as numbers (assuming MB if no unit specified)
                            const downloadedNum = parseFloat(downloadedStr.replace(/[^0-9.]/g, ''));
                            const totalNum = parseFloat(totalStr.replace(/[^0-9.]/g, ''));
                            
                            if (!isNaN(downloadedNum) && !isNaN(totalNum)) {
                                // Convert MB to bytes only if values are reasonable (< 1000 MB suggests they're in MB)
                                if (downloadedNum < 1000 && totalNum < 1000) {
                                    const downloaded = this.formatFileSize(downloadedNum * 1024 * 1024);
                                    const total = this.formatFileSize(totalNum * 1024 * 1024);
                                    statusParts.push(`${downloaded} / ${total}`);
                                } else {
                                    // Likely already in bytes
                                    const downloaded = this.formatFileSize(downloadedNum);
                                    const total = this.formatFileSize(totalNum);
                                    statusParts.push(`${downloaded} / ${total}`);
                                }
                            }
                        }
                    }
                      // Handle speed
                    if (data.bytesPerSecond && data.bytesPerSecond > 0) {
                        const speed = this.formatFileSize(data.bytesPerSecond);
                        statusParts.push(`${speed}/s`);
                    } else if (data.speed) {
                        // Check if speed is already formatted (e.g., "2.7 MB/s")
                        const speedStr = data.speed.toString();
                        
                        if (speedStr.includes('MB/s') || speedStr.includes('KB/s') || speedStr.includes('GB/s')) {
                            // Already formatted - use as is
                            statusParts.push(speedStr);
                        } else {
                            // Parse as number (assuming MB/s if no unit specified)
                            const speedNum = parseFloat(speedStr.replace(/[^0-9.]/g, ''));
                            if (!isNaN(speedNum) && speedNum > 0) {
                                // Convert MB/s to bytes/s only for reasonable values
                                if (speedNum < 1000) {
                                    const speed = this.formatFileSize(speedNum * 1024 * 1024);
                                    statusParts.push(`${speed}/s`);
                                } else {
                                    // Likely already in bytes/s
                                    const speed = this.formatFileSize(speedNum);
                                    statusParts.push(`${speed}/s`);
                                }
                            }
                        }
                    }
                    
                    if (data.eta && data.eta !== '--:--' && data.eta !== 'undefined') {
                        statusParts.push(`còn ${data.eta}`);
                    }
                } catch (parseError) {
                    console.warn('Error parsing progress data:', parseError);
                }
                  if (statusParts.length > 0) {
                    fileStatus.textContent = statusParts.join(' • ');
                } else if (data.status === 'running_setup') {
                    fileStatus.textContent = 'Đang chạy các bước cài đặt bổ sung...';
                } else if (data.status === 'setup_step') {
                    fileStatus.textContent = data.message || 'Đang cài đặt...';
                } else if (data.status === 'setup_complete') {
                    fileStatus.textContent = 'Cài đặt hoàn tất!';
                } else if (data.status === 'setup_warning') {
                    fileStatus.textContent = 'Cài đặt hoàn tất (có cảnh báo)';
                } else if (this.isDownloading) {
                    fileStatus.textContent = 'Đang khởi tạo tải xuống...';
                } else {
                    fileStatus.textContent = 'Sẵn sàng';
                }
            }

            // Update queue info
            this.updateQueueDisplay();
        } catch (error) {
            console.error('Error updating progress bar:', error);
        }
    }

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        
        // Convert to number if it's a string
        const size = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const k = 1024;
        
        if (size < k) return size + ' B';
        
        const i = Math.floor(Math.log(size) / Math.log(k));
        const formattedSize = (size / Math.pow(k, i)).toFixed(1);
        
        return formattedSize + ' ' + units[i];
    }updateQueueDisplay() {
        const queueBadge = document.getElementById('queueBadge');
        if (queueBadge) {
            if (this.downloadQueue.length > 0) {
                queueBadge.textContent = `Hàng đợi: ${this.downloadQueue.length}`;
                queueBadge.style.display = 'block';
            } else {
                queueBadge.style.display = 'none';
            }
        }
    }    onDownloadComplete() {
        this.isDownloading = false;
        this.currentDownload = null;
        
        // Update progress bar to show completion
        const progressFill = document.getElementById('downloadProgressFill');
        const progressText = document.getElementById('downloadProgressText');
        const fileStatus = document.getElementById('downloadFileStatus');
        
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = '100%';
        if (fileStatus) fileStatus.textContent = 'Tải xuống hoàn tất';
        
        this.showToast('Tải xuống hoàn tất!', 'success');
        
        // Process next item in queue
        if (this.downloadQueue.length > 0) {
            const nextDownload = this.downloadQueue.shift();
            setTimeout(() => {
                this.processDownload(nextDownload.app, nextDownload.card);
            }, 1000);
        } else {
            // Hide progress bar after completion
            const progressContainer = document.getElementById('downloadProgressContainer');
            setTimeout(() => {
                if (progressContainer) {
                    progressContainer.classList.remove('active');
                }
            }, 3000);
        }
        
        this.updateQueueDisplay();
    }    async addToDownloadQueue(app, card) {
        // Show toast notification
        this.showToast('Đang chuẩn bị tải xuống...', 'warning');
        
        // If currently downloading, add to queue
        if (this.isDownloading) {
            this.downloadQueue.push({ app, card });
            this.updateQueueDisplay();
            this.showToast(`${app.name} đã được thêm vào hàng đợi`, 'success');
            this.updateStatusBar(`${app.name} added to download queue`);
            return;
        }

        // Start download immediately
        this.processDownload(app, card);
    }    async processDownload(app, card) {
        console.log('Starting download for app:', app.name, 'ID:', app.id); // Debug
        this.isDownloading = true;
        this.currentDownload = { app, card };
        
        // Update app card to show downloading status immediately
        this.updateAppCard(card, app);
        
        // Show progress bar immediately
        const progressContainer = document.getElementById('downloadProgressContainer');
        const fileName = document.getElementById('downloadFileName');
        const fileStatus = document.getElementById('downloadFileStatus');
        
        if (progressContainer) progressContainer.classList.add('active');
        if (fileName) fileName.textContent = app.name;
        if (fileStatus) fileStatus.textContent = 'Đang khởi tạo tải xuống...';
        
        this.showToast(`Bắt đầu tải ${app.name}`, 'success');
          try {
            this.showProgress(card, 'Đang bắt đầu tải xuống...');
            this.updateStatusBar(`🔄 Đang tải xuống ${app.name}...`);
            
            // Check if electronAPI is available
            if (!window.electronAPI || typeof window.electronAPI.downloadApp !== 'function') {
                throw new Error('Download function not available');
            }
            
            const result = await window.electronAPI.downloadApp(app);            if (result && result.success) {
                console.log('Download successful for:', app.name, 'Path:', result.path); // Debug
                
                // Update local installed apps immediately
                this.installedApps[app.id] = {
                    version: app.version,
                    installedAt: new Date().toISOString(),
                    path: result.path
                };
                
                console.log('Updated installedApps:', this.installedApps[app.id]); // Debug
                console.log('Full installedApps after update:', this.installedApps); // Debug
                
                this.updateStatusBar(`✅ ${app.name} tải xuống thành công! Vị trí: ${result.path}`);
                this.showToast(`Đã tải xuống thành công ${app.name}`, 'success');
                
                // Force immediate UI update multiple times to ensure it takes effect
                setTimeout(() => {
                    console.log('Force updating card UI after success - attempt 1'); // Debug
                    this.updateAppCard(card, app);
                }, 100);
                
                setTimeout(() => {
                    console.log('Force updating card UI after success - attempt 2'); // Debug
                    this.updateAppCard(card, app);
                }, 500);
                
                setTimeout(() => {
                    console.log('Force updating card UI after success - attempt 3'); // Debug
                    this.updateAppCard(card, app);
                }, 1000);
                
                // Auto-refresh installed apps list after download
                await this.autoRefreshApps();
                
                // Hide progress bar on success with delay
                setTimeout(() => {
                    if (progressContainer) {
                        progressContainer.classList.remove('active');
                    }
                }, 2000); // Reduced delay to 2 seconds
            } else {
                throw new Error(result ? result.error : 'Download failed - unknown error');
            }
        } catch (error) {
            console.error('Download error for', app.name, ':', error);
            this.showToast(`Lỗi tải xuống ${app.name}: ${error.message}`, 'error');
            this.updateStatusBar(`❌ Error downloading ${app.name}: ${error.message}`);
            
            // Hide progress bar on error
            if (progressContainer) {
                setTimeout(() => {
                    progressContainer.classList.remove('active');
                }, 2000);
            }        } finally {
            console.log('Download process finished for:', app.name); // Debug
            
            this.hideProgress(card);
            this.isDownloading = false;
            this.currentDownload = null;
            
            // Force immediate UI update
            console.log('Updating card UI for:', app.name); // Debug
            this.updateAppCard(card, app);
            
            // Additional delay to ensure backend has updated the installed apps
            setTimeout(async () => {
                console.log('Secondary refresh for:', app.name); // Debug
                await this.autoRefreshApps();
            }, 500);
            
            // Process next download in queue if available
            if (this.downloadQueue.length > 0) {
                const nextDownload = this.downloadQueue.shift();
                setTimeout(() => {
                    this.processDownload(nextDownload.app, nextDownload.card);
                }, 1000);
            }
            
            this.updateQueueDisplay();
        }
    }

    async loadApps() {
        try {
            this.updateStatusBar('Loading applications...');
            
            // Load available apps and installed apps
            const [apps, installedApps] = await Promise.all([
                window.electronAPI.getApps(),
                window.electronAPI.getInstalledApps()
            ]);
            
            console.log('=== LOAD APPS DEBUG ===');
            console.log('Available apps:', apps);
            console.log('Installed apps from backend:', installedApps);
            console.log('======================');
            
            this.apps = apps;
            this.installedApps = installedApps;
            
            this.renderApps();
            this.updateStatusBar(`Found ${apps.length} applications`);
        } catch (error) {
            console.error('Error loading apps:', error);
            this.updateStatusBar('Error loading applications');
            this.showEmptyState();
        }
    }    async loadInstalledApps() {
        try {
            console.log('Loading installed apps from backend...'); // Debug
            this.installedApps = await window.electronAPI.getInstalledApps();
            console.log('Loaded installed apps:', this.installedApps); // Debug
            // Don't re-render here to avoid infinite loops
        } catch (error) {
            console.error('Error loading installed apps:', error);
        }
    }// Auto-refresh method to keep UI in sync
    async autoRefreshApps() {
        try {
            console.log('Auto-refreshing apps list...'); // Debug
            
            // Store current state for comparison
            const previousInstalledApps = JSON.stringify(this.installedApps);
            
            // Reload installed apps from backend
            await this.loadInstalledApps();
            
            // Compare and force re-render to ensure UI is in sync
            const currentInstalledApps = JSON.stringify(this.installedApps);
            
            if (previousInstalledApps !== currentInstalledApps) {
                console.log('Installed apps changed, re-rendering...'); // Debug
                this.renderApps();
            } else {
                // Force re-render anyway to ensure UI consistency
                console.log('Force re-rendering to ensure UI consistency...'); // Debug
                this.renderApps();
            }
            
            console.log('Auto-refresh completed'); // Debug
        } catch (error) {
            console.error('Auto-refresh error:', error);
        }
    }

    renderApps() {
        const appsGrid = document.getElementById('appsGrid');
        const template = document.getElementById('appCardTemplate');
        
        if (this.apps.length === 0) {
            this.showEmptyState();
            return;
        }

        appsGrid.innerHTML = '';
          this.apps.forEach(app => {
            const card = template.content.cloneNode(true);
            
            // Fill app info
            const appName = card.querySelector('.app-name');
            const appDesc = card.querySelector('.app-description');
            const versionNumber = card.querySelector('.version-number');
            
            if (appName) appName.textContent = app.name;            if (appDesc) appDesc.textContent = app.description || 'No description available';
            if (versionNumber) versionNumber.textContent = app.version;
            
            // Set app icon
            const iconImg = card.querySelector('.app-icon-img');
            if (iconImg) {
                if (app.icon && app.icon.startsWith('http')) {
                    iconImg.src = app.icon;
                    iconImg.style.display = 'block';                } else {
                    iconImg.style.display = 'none';
                    const iconContainer = iconImg.parentElement;
                    if (iconContainer) {
                        // Use ico files based on app properties (600 sentences -> 1.ico, 200 sentences -> 2.ico)
                        let iconPath = '../../assets/1.ico'; // Default to 1.ico (600 sentences)
                        if (app.sentences === 200 || app.description?.includes('200') || app.name?.includes('200')) {
                            iconPath = '../../assets/2.ico'; // Use 2.ico for 200 sentences
                        }
                        iconContainer.innerHTML = `<img src="${iconPath}" style="width: 48px; height: 48px; border-radius: 8px;" alt="App Icon">`;
                    }
                }
            }
            
            // Set app status and actions
            this.updateAppCard(card, app);
            
            // Add event listeners
            this.setupCardEventListeners(card, app);
            
            appsGrid.appendChild(card);
        });
    }    updateAppCard(card, app) {
        console.log('=== UPDATING CARD DEBUG ===');
        console.log('App:', app.name, 'ID:', app.id);
        console.log('installedApps[app.id]:', this.installedApps[app.id]);
        console.log('Full installedApps:', this.installedApps);
        console.log('Is installed check:', !!this.installedApps[app.id]);
        console.log('Currently downloading:', this.isDownloading && this.currentDownload && this.currentDownload.app.id === app.id);
        console.log('========================');
        
        const statusBadge = card.querySelector('.status-badge');
        const installBtn = card.querySelector('[data-action="install"]');
        const openBtn = card.querySelector('[data-action="open"]');
        const openFolderBtn = card.querySelector('[data-action="open-folder"]');
        const updateBtn = card.querySelector('[data-action="update"]');
        const uninstallBtn = card.querySelector('[data-action="uninstall"]');
        
        const isInstalled = this.installedApps[app.id];
        const installedVersion = isInstalled?.version;
        const hasUpdate = isInstalled && installedVersion !== app.version;
        const isCurrentlyDownloading = this.isDownloading && this.currentDownload && this.currentDownload.app.id === app.id;
        
        console.log('Card update details:', {
            appId: app.id,
            isInstalled: !!isInstalled,
            hasUpdate,
            isCurrentlyDownloading,
            downloadState: this.isDownloading,
            currentDownloadId: this.currentDownload?.app?.id
        }); // Debug
        
        // Reset all buttons - both class and inline style
        // Note: Install button might be removed for installed apps, so handle separately
        [openBtn, openFolderBtn, updateBtn, uninstallBtn].forEach(btn => {
            if (btn) {
                btn.classList.add('hidden');
                btn.style.display = 'none'; // Also set inline style
                btn.disabled = false;
            }
        });
        
        // Handle install button separately since it might be removed
        if (installBtn) {
            installBtn.classList.add('hidden');
            installBtn.style.display = 'none';
            installBtn.disabled = false;
        }
        
        if (isCurrentlyDownloading) {
            // Currently downloading
            console.log('Setting downloading status for:', app.name); // Debug
            if (statusBadge) {
                statusBadge.textContent = 'Đang tải xuống...';
                statusBadge.className = 'status-badge downloading';
            }
            // Disable all buttons during download
            [installBtn, openBtn, openFolderBtn, updateBtn, uninstallBtn].forEach(btn => {
                if (btn) btn.disabled = true;
            });        } else if (!isInstalled) {
            // Not installed - show download button
            console.log('Setting not-installed status for:', app.name); // Debug
            if (statusBadge) {
                statusBadge.textContent = 'Chưa cài đặt';
                statusBadge.className = 'status-badge not-installed';
            }
            if (installBtn) {
                console.log('Showing install button for:', app.name); // Debug
                installBtn.classList.remove('hidden');
                installBtn.style.display = ''; // Remove inline style to use CSS default
                installBtn.textContent = 'Tải xuống';
            }
        } else if (hasUpdate) {
            // Update available - remove download button completely, show other buttons
            console.log('Setting update-available status for:', app.name); // Debug
            if (statusBadge) {
                statusBadge.textContent = 'Có bản cập nhật';
                statusBadge.className = 'status-badge update-available';
            }
            // Xóa hoàn toàn nút download vì app đã được cài đặt
            if (installBtn) {
                console.log('Removing install button (update case) for:', app.name); // Debug
                installBtn.remove(); // Xóa hoàn toàn khỏi DOM
            }
            if (openBtn) {
                openBtn.classList.remove('hidden');
                openBtn.style.display = ''; // Remove inline style
                openBtn.textContent = 'Mở';
            }
            if (openFolderBtn) {
                openFolderBtn.classList.remove('hidden');
                openFolderBtn.style.display = ''; // Remove inline style
                openFolderBtn.textContent = 'Mở thư mục';
            }
            if (updateBtn) {
                updateBtn.classList.remove('hidden');
                updateBtn.style.display = ''; // Remove inline style
                updateBtn.textContent = 'Cập nhật';
            }
            if (uninstallBtn) {
                uninstallBtn.classList.remove('hidden');
                uninstallBtn.style.display = ''; // Remove inline style
                uninstallBtn.textContent = 'Gỡ cài đặt';
            }
        } else {
            // Up to date / Installed - remove download button completely
            console.log('Setting installed status for:', app.name); // Debug
            if (statusBadge) {
                statusBadge.textContent = 'Đã cài đặt';
                statusBadge.className = 'status-badge installed';
            }
            // Xóa hoàn toàn nút download vì app đã được cài đặt
            if (installBtn) {
                console.log('Removing install button for:', app.name, 'Button found:', !!installBtn); // Debug
                installBtn.remove(); // Xóa hoàn toàn khỏi DOM
                console.log('Install button removed from DOM'); // Debug
            } else {
                console.log('Install button not found for:', app.name); // Debug
            }
            if (openBtn) {
                openBtn.classList.remove('hidden');
                openBtn.style.display = ''; // Remove inline style
                openBtn.textContent = 'Mở';
            }
            if (openFolderBtn) {
                openFolderBtn.classList.remove('hidden');
                openFolderBtn.style.display = ''; // Remove inline style
                openFolderBtn.textContent = 'Mở thư mục';
            }
            if (uninstallBtn) {
                uninstallBtn.classList.remove('hidden');
                uninstallBtn.style.display = ''; // Remove inline style
                uninstallBtn.textContent = 'Gỡ cài đặt';
            }
        }
    }setupCardEventListeners(card, app) {
        const installBtn = card.querySelector('[data-action="install"]');
        const openBtn = card.querySelector('[data-action="open"]');
        const openFolderBtn = card.querySelector('[data-action="open-folder"]');
        const updateBtn = card.querySelector('[data-action="update"]');
        const uninstallBtn = card.querySelector('[data-action="uninstall"]');
        
        if (installBtn) {
            installBtn.addEventListener('click', () => this.installApp(app, card));
        }
        if (openBtn) {
            openBtn.addEventListener('click', () => this.openApp(app.id));
        }
        if (openFolderBtn) {
            openFolderBtn.addEventListener('click', () => this.openAppFolder(app.id));
        }
        if (updateBtn) {
            updateBtn.addEventListener('click', () => this.updateApp(app, card));
        }
        if (uninstallBtn) {
            uninstallBtn.addEventListener('click', () => this.uninstallApp(app.id, card));
        }
    }    setupEventListeners() {        
        // Header refresh button
        document.getElementById('refreshBtn').addEventListener('click', async () => {
            console.log('Manual refresh triggered'); // Debug
            this.showToast('Đang làm mới danh sách...', 'info');
            this.updateStatusBar('🔄 Refreshing apps list...');
            
            try {
                await this.loadApps();
                await this.autoRefreshApps();
                this.showToast('Đã làm mới thành công!', 'success');
                this.updateStatusBar('✅ Apps list refreshed successfully');
            } catch (error) {
                console.error('Manual refresh error:', error);
                this.showToast('Lỗi khi làm mới: ' + error.message, 'error');
                this.updateStatusBar('❌ Refresh failed: ' + error.message);
            }
        });

        // Modal close
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('appModal').classList.add('hidden');
        });

        // Close modal on outside click
        document.getElementById('appModal').addEventListener('click', (e) => {
            if (e.target.id === 'appModal') {
                document.getElementById('appModal').classList.add('hidden');
            }
        });        // Progress control buttons (using event delegation for the new progress bar)
        document.addEventListener('click', async (e) => {
            // Check if clicked element is a download action button
            const actionBtn = e.target.closest('.download-action-btn');
            if (actionBtn) {
                e.preventDefault();
                e.stopPropagation();
                
                const action = actionBtn.dataset.action;
                
                try {
                    switch (action) {                        case 'pause':
                            console.log('Pause button clicked, currentDownload:', this.currentDownload); // Debug
                            if (this.currentDownload) {
                                if (window.electronAPI && typeof window.electronAPI.pauseDownload === 'function') {
                                    try {
                                        await window.electronAPI.pauseDownload(this.currentDownload.app.id);
                                        this.showResumeButton();
                                        this.showToast('Đã tạm dừng tải xuống', 'warning');
                                        this.updateStatusBar(`⏸️ Đã tạm dừng tải xuống`);
                                        
                                        const fileStatus = document.getElementById('downloadFileStatus');
                                        if (fileStatus) fileStatus.textContent = 'Đã tạm dừng tải xuống';
                                    } catch (error) {
                                        console.error('Error pausing download:', error);
                                        this.showToast('Lỗi khi tạm dừng tải xuống', 'error');
                                    }
                                } else {
                                    console.error('pauseDownload function not available');
                                    this.showToast('Chức năng tạm dừng chưa được hỗ trợ', 'error');
                                }
                            } else {
                                this.showToast('Không có tải xuống nào đang diễn ra', 'error');
                            }
                            break;                        case 'resume':
                            console.log('Resume button clicked, currentDownload:', this.currentDownload); // Debug
                            if (this.currentDownload) {
                                if (window.electronAPI && typeof window.electronAPI.resumeDownload === 'function') {
                                    try {
                                        await window.electronAPI.resumeDownload(this.currentDownload.app.id);
                                        this.showPauseButton();
                                        this.showToast('Tiếp tục tải xuống', 'success');
                                        this.updateStatusBar(`▶️ Tiếp tục tải xuống`);
                                        
                                        const fileStatus = document.getElementById('downloadFileStatus');
                                        if (fileStatus) fileStatus.textContent = 'Đang tiếp tục tải xuống...';
                                    } catch (error) {
                                        console.error('Error resuming download:', error);
                                        this.showToast('Lỗi khi tiếp tục tải xuống', 'error');
                                    }
                                } else {
                                    console.error('resumeDownload function not available');
                                    this.showToast('Chức năng tiếp tục chưa được hỗ trợ', 'error');
                                }
                            } else {
                                this.showToast('Không có tải xuống nào để tiếp tục', 'error');
                            }
                            break;                        case 'cancel':
                            console.log('Cancel button clicked, currentDownload:', this.currentDownload); // Debug
                            if (this.currentDownload) {
                                if (window.electronAPI && typeof window.electronAPI.cancelDownload === 'function') {
                                    try {
                                        await window.electronAPI.cancelDownload(this.currentDownload.app.id);
                                        this.isDownloading = false;
                                        this.currentDownload = null;
                                        
                                        this.showToast('Đã hủy tải xuống', 'warning');
                                        
                                        // Update UI
                                        const fileStatus = document.getElementById('downloadFileStatus');
                                        if (fileStatus) fileStatus.textContent = 'Đã hủy tải xuống';
                                        
                                        // Hide progress bar after cancellation
                                        const progressContainer = document.getElementById('downloadProgressContainer');
                                        setTimeout(() => {
                                            if (progressContainer) {
                                                progressContainer.classList.remove('active');
                                            }
                                        }, 2000);
                                        
                                        // Process next in queue if available
                                        if (this.downloadQueue.length > 0) {
                                            const nextDownload = this.downloadQueue.shift();
                                            setTimeout(() => {
                                                this.processDownload(nextDownload.app, nextDownload.card);
                                            }, 1000);
                                        }
                                        
                                        this.updateQueueDisplay();
                                        this.updateStatusBar(`❌ Đã hủy tải xuống`);
                                    } catch (error) {
                                        console.error('Error cancelling download:', error);
                                        this.showToast('Lỗi khi hủy tải xuống', 'error');
                                    }
                                } else {
                                    console.error('cancelDownload function not available');
                                    this.showToast('Chức năng hủy tải xuống chưa được hỗ trợ', 'error');
                                }
                            } else {
                                this.showToast('Không có tải xuống nào để hủy', 'error');
                            }
                            break;
                    }
                } catch (error) {
                    console.error('Progress control error:', error);
                    this.updateStatusBar('⚠️ Error controlling download');
                }
            }
        });
        
        // Keyboard shortcuts for download controls
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when downloading
            if (!this.isDownloading || !this.currentDownload) return;
            
            // Ctrl+Space: Pause/Resume
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                const pauseBtn = document.querySelector('[data-action="pause"]');
                const resumeBtn = document.querySelector('[data-action="resume"]');
                
                if (pauseBtn && !pauseBtn.style.display === 'none') {
                    pauseBtn.click();
                } else if (resumeBtn && !resumeBtn.style.display === 'none') {
                    resumeBtn.click();
                }
            }
            
            // Escape: Cancel download
            if (e.code === 'Escape') {
                e.preventDefault();
                const cancelBtn = document.querySelector('[data-action="cancel"]');
                if (cancelBtn) {
                    // Confirm before canceling
                    if (confirm('Bạn có chắc chắn muốn hủy tải xuống?')) {
                        cancelBtn.click();
                    }
                }
            }
        });
        
        // Debug keyboard shortcut (Ctrl+D)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                console.log('=== DEBUG INFO ===');
                console.log('isDownloading:', this.isDownloading);
                console.log('currentDownload:', this.currentDownload);
                console.log('installedApps:', this.installedApps);
                console.log('downloadQueue:', this.downloadQueue);
                console.log('==================');
                
                this.showToast('Debug info logged to console (F12)', 'info');
            }
        });

        // Auto Fix Modal Event Listeners
        try {
            this.setupAutoFixModal();
        } catch (error) {
            console.error('Error setting up auto fix modal:', error);
        }
    }

    setupAutoFixModal() {
        console.log('Setting up auto fix modal...');
        
        // Use setTimeout to ensure DOM is fully loaded
        setTimeout(() => {
            const autoFixBtn = document.getElementById('autoFixBtn');
            const autoFixModal = document.getElementById('autoFixModal');
            const autoFixClose = document.getElementById('autoFixClose');
            const startFixBtn = document.getElementById('startFixBtn');
            const cancelFixBtn = document.getElementById('cancelFixBtn');

            console.log('Auto fix elements found:', {
                autoFixBtn: !!autoFixBtn,
                autoFixModal: !!autoFixModal,
                autoFixClose: !!autoFixClose,
                startFixBtn: !!startFixBtn,
                cancelFixBtn: !!cancelFixBtn
            });

            // Open modal
            if (autoFixBtn) {
                console.log('Adding click listener to auto fix button');
                autoFixBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('Auto fix button clicked!');
                    this.openAutoFixModal();
                });
            } else {
                console.error('Auto fix button not found!');
            }

            // Close modal
            if (autoFixClose) {
                autoFixClose.addEventListener('click', () => {
                    this.closeAutoFixModal();
                });
            }

            // Close modal on outside click
            if (autoFixModal) {
                autoFixModal.addEventListener('click', (e) => {
                    if (e.target === autoFixModal) {
                        this.closeAutoFixModal();
                    }
                });
            }

            // Start fix
            if (startFixBtn) {
                startFixBtn.addEventListener('click', () => {
                    this.startAutoFix();
                });
            }

            // Cancel fix
            if (cancelFixBtn) {
                cancelFixBtn.addEventListener('click', () => {
                    this.closeAutoFixModal();
                });
            }
        }, 1000);
    }

    openAutoFixModal() {
        console.log('Opening auto fix modal...');
        const modal = document.getElementById('autoFixModal');
        if (modal) {
            console.log('Modal found, removing hidden class');
            modal.classList.remove('hidden');
            this.resetAutoFixModal();
        } else {
            console.error('Auto fix modal not found!');
        }
    }

    closeAutoFixModal() {
        const modal = document.getElementById('autoFixModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    resetAutoFixModal() {
        const statusMessage = document.getElementById('fixStatusMessage');
        const progressFill = document.getElementById('fixProgressFill');
        const progressText = document.getElementById('fixProgressText');
        const startBtn = document.getElementById('startFixBtn');
        const cancelBtn = document.getElementById('cancelFixBtn');
        const resultsDiv = document.getElementById('fixResults');

        if (statusMessage) statusMessage.textContent = 'Sẵn sàng để bắt đầu';
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.textContent = '🚀 Bắt đầu Fix';
        }
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.textContent = '❌ Hủy';
        }
        if (resultsDiv) resultsDiv.style.display = 'none';
    }

    async startAutoFix() {
        const statusMessage = document.getElementById('fixStatusMessage');
        const progressFill = document.getElementById('fixProgressFill');
        const progressText = document.getElementById('fixProgressText');
        const startBtn = document.getElementById('startFixBtn');
        const cancelBtn = document.getElementById('cancelFixBtn');
        const resultsDiv = document.getElementById('fixResults');
        const resultsContent = document.getElementById('fixResultsContent');

        try {
            // Disable buttons
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.textContent = '⏳ Đang xử lý...';
            }
            if (cancelBtn) cancelBtn.disabled = true;

            // Start fix process
            if (statusMessage) statusMessage.textContent = 'Đang kiểm tra dependencies...';

            // Listen for progress updates
            const progressListener = (data) => {
                console.log('Fix progress received:', data);
                
                if (statusMessage && data.message) statusMessage.textContent = data.message;
                
                if (data.progress >= 0) {
                    if (progressFill) progressFill.style.width = data.progress + '%';
                    if (progressText) progressText.textContent = data.progress + '%';
                }
            };

            // Set up progress listener
            if (window.electronAPI.onAutoFixProgress) {
                window.electronAPI.onAutoFixProgress(progressListener);
            }

            const results = await window.electronAPI.quickFix();

            // Show results
            if (resultsDiv && resultsContent) {
                resultsContent.innerHTML = this.formatFixResults(results);
                resultsDiv.style.display = 'block';
            }

            if (results.success) {
                this.showToast('Auto-fix hoàn thành thành công!', 'success');
                if (statusMessage) statusMessage.textContent = 'Hoàn thành thành công!';
                if (progressFill) progressFill.style.width = '100%';
                if (progressText) progressText.textContent = '100%';
            } else {
                this.showToast('Auto-fix gặp lỗi: ' + results.message, 'error');
                if (statusMessage) statusMessage.textContent = 'Gặp lỗi: ' + results.message;
            }

        } catch (error) {
            console.error('Auto fix error:', error);
            this.showToast('Lỗi auto-fix: ' + error.message, 'error');
            if (statusMessage) statusMessage.textContent = 'Lỗi: ' + error.message;
        } finally {
            // Remove progress listener
            if (window.electronAPI.removeAutoFixProgressListener) {
                window.electronAPI.removeAutoFixProgressListener();
            }

            // Re-enable buttons
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.textContent = '🔄 Fix lại';
            }
            if (cancelBtn) {
                cancelBtn.disabled = false;
                cancelBtn.textContent = '❌ Đóng';
            }
        }
    }

    formatFixResults(results) {
        let html = '<div class="fix-results-list">';
        
        if (results.details) {
            // Case 1: Dependencies already installed (details from checkDependenciesStatus)
            if (typeof results.details.vcredist === 'boolean') {
                // VCRedist status
                const vcredistInstalled = results.details.vcredist;
                const icon = vcredistInstalled ? '✅' : '❌';
                const className = vcredistInstalled ? 'success' : 'error';
                const text = vcredistInstalled 
                    ? 'Visual C++ Redistributable đã được cài đặt sẵn'
                    : 'Visual C++ Redistributable chưa được cài đặt';
                
                html += `<div class="fix-result-item ${className}">
                    <span class="fix-result-icon">${icon}</span>
                    <span class="fix-result-text">${text}</span>
                </div>`;

                // K-Lite status
                const kliteInstalled = results.details.klite;
                const kliteIcon = kliteInstalled ? '✅' : '❌';
                const kliteClassName = kliteInstalled ? 'success' : 'error';
                const kliteText = kliteInstalled 
                    ? 'K-Lite Codec Pack Mega đã được cài đặt sẵn'
                    : 'K-Lite Codec Pack Mega chưa được cài đặt';
                
                html += `<div class="fix-result-item ${kliteClassName}">
                    <span class="fix-result-icon">${kliteIcon}</span>
                    <span class="fix-result-text">${kliteText}</span>
                </div>`;
            }
            // Case 2: Dependencies installation results (details from autoFixDependencies)
            else {
                if (results.details.vcredist) {
                    const success = results.details.vcredist.success;
                    const alreadyInstalled = results.details.vcredist.alreadyInstalled;
                    const icon = success ? '✅' : '❌';
                    const className = success ? 'success' : 'error';
                    
                    let text;
                    if (success && alreadyInstalled) {
                        text = 'Visual C++ Redistributable đã được cài đặt sẵn';
                    } else if (success) {
                        text = `Visual C++ Redistributable đã được cài đặt thành công (${results.details.vcredist.version || 'latest'})`;
                    } else {
                        text = `Lỗi cài đặt Visual C++ Redistributable: ${results.details.vcredist.error || 'Unknown error'}`;
                    }
                    
                    html += `<div class="fix-result-item ${className}">
                        <span class="fix-result-icon">${icon}</span>
                        <span class="fix-result-text">${text}</span>
                    </div>`;
                }

                if (results.details.klite) {
                    const success = results.details.klite.success;
                    const alreadyInstalled = results.details.klite.alreadyInstalled;
                    const icon = success ? '✅' : '❌';
                    const className = success ? 'success' : 'error';
                    
                    let text;
                    if (success && alreadyInstalled) {
                        text = 'K-Lite Codec Pack Mega đã được cài đặt sẵn';
                    } else if (success) {
                        text = `K-Lite Codec Pack Mega đã được cài đặt thành công (${results.details.klite.version || 'latest'})`;
                    } else {
                        text = `Lỗi cài đặt K-Lite Codec Pack: ${results.details.klite.error || 'Unknown error'}`;
                    }
                    
                    html += `<div class="fix-result-item ${className}">
                        <span class="fix-result-icon">${icon}</span>
                        <span class="fix-result-text">${text}</span>
                    </div>`;
                }
            }
        } else {
            html += `<div class="fix-result-item">
                <span class="fix-result-icon">ℹ️</span>
                <span class="fix-result-text">${results.message || 'Không có thông tin chi tiết'}</span>
            </div>`;
        }
        
        html += '</div>';
        return html;
    }    async installApp(app, card) {
        // Kiểm tra xem app đã được cài đặt chưa trước khi download
        console.log('=== INSTALL APP CHECK ===');
        console.log('App:', app.name, 'ID:', app.id);
        console.log('Current installedApps:', this.installedApps);
        console.log('Is already installed:', !!this.installedApps[app.id]);
        
        if (this.installedApps[app.id]) {
            console.log('App already installed, showing message');
            this.showToast(`${app.name} đã được cài đặt rồi!`, 'warning');
            this.updateStatusBar(`${app.name} đã được cài đặt`);
            
            // Force update card to show installed status
            this.updateAppCard(card, app);
            return;
        }
        
        console.log('App not installed, proceeding with download');
        this.addToDownloadQueue(app, card);
    }

    async updateApp(app, card) {
        this.addToDownloadQueue(app, card);
    }    async openApp(appId) {
        try {
            this.updateStatusBar('Opening application...');
            
            const result = await window.electronAPI.openApp(appId);
            
            if (result.success) {
                this.updateStatusBar(result.message || 'Application opened');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Open error:', error);
            this.updateStatusBar(`Error opening application: ${error.message}`);
        }
    }    async openAppFolder(appId) {
        try {
            // Get the actual installed app path instead of assuming folder structure
            const installedApp = this.installedApps[appId];
            let folderPath;
            
            if (installedApp && installedApp.path) {
                // Use the actual installation path
                folderPath = installedApp.path;
            } else {
                // Fallback to default download folder
                folderPath = `Downloads\\${appId}`;
            }
            
            console.log('Opening folder:', folderPath); // Debug
            this.updateStatusBar('Đang mở thư mục...');
            this.showToast('Đang mở thư mục...', 'info');
            
            if (!window.electronAPI || typeof window.electronAPI.openDownloadFolder !== 'function') {
                throw new Error('Open folder function not available');
            }
            
            const result = await window.electronAPI.openDownloadFolder(folderPath);
            
            if (result && result.success) {
                this.updateStatusBar(`Đã mở thư mục: ${folderPath}`);
                this.showToast('Đã mở thư mục thành công', 'success');
            } else {
                throw new Error(result ? result.error : 'Không thể mở thư mục');
            }
        } catch (error) {
            console.error('Open folder error:', error);
            this.updateStatusBar(`Lỗi mở thư mục: ${error.message}`);
            this.showToast(`Không thể mở thư mục: ${error.message}`, 'error');
        }
    }async uninstallApp(appId, card) {
        const app = this.apps.find(a => a.id === appId);
        if (!app) return;

        if (!confirm(`Bạn có chắc chắn muốn gỡ cài đặt ${app.name}?`)) {
            return;
        }

        try {
            this.showProgress(card, 'Đang gỡ cài đặt...');
            this.updateStatusBar(`Đang gỡ cài đặt ${app.name}...`);
            this.showToast(`Bắt đầu gỡ cài đặt ${app.name}`, 'info');
            
            const result = await window.electronAPI.uninstallApp(appId);
            
            if (result.success) {
                delete this.installedApps[appId];
                this.updateAppCard(card, app);
                this.updateStatusBar(`${app.name} đã được gỡ cài đặt thành công`);
                this.showToast(`Đã gỡ cài đặt thành công ${app.name}`, 'success');
                  // Auto-refresh installed apps list after uninstall
                await this.autoRefreshApps();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Uninstall error:', error);
            this.updateStatusBar(`Lỗi khi gỡ cài đặt ${app.name}: ${error.message}`);
            this.showToast(`Lỗi gỡ cài đặt ${app.name}: ${error.message}`, 'error');
        } finally {
            this.hideProgress(card);
        }
    }showProgress(card, text) {
        // Store the current download ID for progress controls
        const appName = card.querySelector('.app-name')?.textContent;
        this.currentDownloadId = appName?.toLowerCase().replace(/\s+/g, '-');
        
        // Update global progress bar
        const globalProgressBar = document.querySelector('.global-progress-bar');
        if (!globalProgressBar) return;
        
        const progressText = globalProgressBar.querySelector('.progress-text');
        const progressFill = globalProgressBar.querySelector('.progress-fill');
        const progressPercentage = globalProgressBar.querySelector('.progress-percentage .progress-stat-value');
        const progressSpeed = globalProgressBar.querySelector('.progress-speed .progress-stat-value');
        const progressEta = globalProgressBar.querySelector('.progress-eta .progress-stat-value');
        const progressSize = globalProgressBar.querySelector('.progress-size .progress-stat-value');
        const actions = card.querySelector('.app-actions');
        
        if (progressText) {
            progressText.textContent = text;
        }
        if (progressFill) {
            progressFill.style.width = '0%';
        }
        if (progressPercentage) {
            progressPercentage.textContent = '0%';
        }
        if (progressSpeed) {
            progressSpeed.textContent = '0 MB/s';
        }
        if (progressEta) {
            progressEta.textContent = '--:--';
        }
        if (progressSize) {
            progressSize.textContent = '0 MB';
        }
        if (actions) {
            actions.style.opacity = '0.5';
            
            // Disable all buttons
            actions.querySelectorAll('.btn').forEach(btn => {
                btn.disabled = true;
            });
        }
    }

    hideProgress(card) {
        this.resetGlobalProgress();
        this.currentDownloadId = null;
        
        const actions = card.querySelector('.app-actions');
        if (actions) {
            actions.style.opacity = '1';
            
            // Enable all buttons
            actions.querySelectorAll('.btn').forEach(btn => {
                btn.disabled = false;
            });
        }
    }

    resetGlobalProgress() {
        const globalProgressBar = document.querySelector('.global-progress-bar');
        if (!globalProgressBar) return;
        
        const progressText = globalProgressBar.querySelector('.progress-text');
        const progressFill = globalProgressBar.querySelector('.progress-fill');
        const progressPercentage = globalProgressBar.querySelector('.progress-percentage .progress-stat-value');
        const progressSpeed = globalProgressBar.querySelector('.progress-speed .progress-stat-value');
        const progressEta = globalProgressBar.querySelector('.progress-eta .progress-stat-value');
        const progressSize = globalProgressBar.querySelector('.progress-size .progress-stat-value');
        
        // Hide progress controls
        const pauseBtn = globalProgressBar.querySelector('.pause-btn');
        const resumeBtn = globalProgressBar.querySelector('.resume-btn');
        const cancelBtn = globalProgressBar.querySelector('.cancel-btn');
        
        if (pauseBtn) pauseBtn.classList.add('hidden');
        if (resumeBtn) resumeBtn.classList.add('hidden');
        if (cancelBtn) cancelBtn.classList.add('hidden');
          // Reset progress display
        if (progressText) {
            progressText.textContent = 'Ready';
        }
        if (progressFill) {
            progressFill.style.width = '0%';
        }
        if (progressPercentage) {
            progressPercentage.textContent = '0%';
        }        if (progressSpeed) {
            progressSpeed.textContent = '0 MB/s';
        }
        if (progressEta) {
            progressEta.textContent = '--:--';
        }
        if (progressSize) {
            progressSize.textContent = '0 MB';
        }
    }    updateStatusBar(message) {
        // Update the unified progress/status bar text
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = message;
        }
    }

    // Notification system removed - using status bar only

    showEmptyState() {
        const appsGrid = document.getElementById('appsGrid');
        appsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-title">No applications found</div>
                <div class="empty-state-message">
                    There are no applications available to install.<br>
                    Try refreshing the list or check your internet connection.
                </div>
            </div>
        `;
    }

    setButtonLoading(button, loading = true) {
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    // Add loading state to button
    addButtonLoadingState(button, isLoading = true) {
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
            const originalContent = button.innerHTML;
            button.dataset.originalContent = originalContent;
            button.innerHTML = '<div class="button-spinner"></div>';
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            if (button.dataset.originalContent) {
                button.innerHTML = button.dataset.originalContent;
                delete button.dataset.originalContent;
            }
        }
    }

    showPauseButton() {
        const pauseBtn = document.getElementById('pauseBtn');
        const resumeBtn = document.getElementById('resumeBtn');
        
        if (pauseBtn) pauseBtn.style.display = 'flex';
        if (resumeBtn) resumeBtn.style.display = 'none';
    }

    showResumeButton() {
        const pauseBtn = document.getElementById('pauseBtn');
        const resumeBtn = document.getElementById('resumeBtn');
        
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'flex';
    }    showToast(message, type = 'info') {
        // Toast notifications disabled - logging to console instead
        console.log(`Toast (${type}):`, message);
        return;
    }

    // Helper method to check if electronAPI functions are available
    checkElectronAPI() {
        const requiredFunctions = [
            'downloadApp', 'getApps', 'getInstalledApps', 
            'openApp', 'uninstallApp', 'openDownloadFolder'
        ];

        const optionalFunctions = [
            'pauseDownload', 'resumeDownload', 'cancelDownload'
        ];

        const missingRequired = [];
        const missingOptional = [];

        if (!window.electronAPI) {
            console.error('electronAPI not available');
            return { available: false, error: 'electronAPI not found' };
        }

        requiredFunctions.forEach(func => {
            if (typeof window.electronAPI[func] !== 'function') {
                missingRequired.push(func);
            }
        });

        optionalFunctions.forEach(func => {
            if (typeof window.electronAPI[func] !== 'function') {
                missingOptional.push(func);
            }
        });

        if (missingRequired.length > 0) {
            console.error('Missing required electronAPI functions:', missingRequired);
            return { 
                available: false, 
                error: `Missing required functions: ${missingRequired.join(', ')}` 
            };
        }

        if (missingOptional.length > 0) {
            console.warn('Missing optional electronAPI functions:', missingOptional);
        }

        return { 
            available: true, 
            missingOptional,            message: missingOptional.length > 0 ? 
                `Some download control features may not work: ${missingOptional.join(', ')}` : 
                'All functions available'
        };
    }    // Contact Footer Setup
    setupContactFooter() {
        // Handle footer contact links
        const contactLinks = document.querySelectorAll('.contact-link');
        contactLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.href.startsWith('https://zalo.me/')) {
                    // For Zalo, just open the link
                    e.preventDefault();
                    window.open(link.href, '_blank');
                    this.showToast('Mở Zalo...', 'info');
                } else {
                    this.showToast('Mở liên kết...', 'info');
                }
                // Other links will open normally
            });
        });

        // Setup footer update check button
        const checkUpdatesFooterBtn = document.getElementById('checkUpdatesFooterBtn');
        if (checkUpdatesFooterBtn) {
            checkUpdatesFooterBtn.addEventListener('click', () => {
                this.checkForUpdates();
                this.showToast('Kiểm tra cập nhật...', 'info');
            });
        }

        // Update footer version display
        this.updateFooterVersion();
    }    // Update footer version display
    async updateFooterVersion() {
        try {
            const version = await window.electronAPI.getAppVersion();
            const footerVersion = document.getElementById('footerVersion');
            const versionBadge = document.getElementById('versionBadge');
            
            if (footerVersion) {
                footerVersion.textContent = version;
            }
            if (versionBadge) {
                versionBadge.textContent = `v${version}`;
            }
        } catch (error) {
            console.error('Failed to update footer version:', error);
        }
    }

    // Auto-Update System Setup
    async setupAutoUpdate() {
        try {
            // Get and display current version
            const version = await window.electronAPI.getAppVersion();
            const versionBadge = document.getElementById('versionBadge');
            const appVersionSpan = document.getElementById('appVersion');
            
            if (versionBadge) {
                versionBadge.textContent = `v${version}`;
            }
            if (appVersionSpan) {
                appVersionSpan.textContent = version;
            }

            // Setup check updates button
            const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
            if (checkUpdatesBtn) {
                checkUpdatesBtn.addEventListener('click', () => this.checkForUpdates());
            }

            // Auto-check for updates on startup (after a delay)
            setTimeout(() => {
                this.checkForUpdates(true); // true = silent check
            }, 5000);

        } catch (error) {
            console.error('Auto-update setup failed:', error);
        }
    }    // Check for Updates
    async checkForUpdates(silent = false) {
        const updateStatus = document.getElementById('updateStatus');
        const updateSection = document.getElementById('updateSection');
        const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
        const checkUpdatesFooterBtn = document.getElementById('checkUpdatesFooterBtn');

        try {
            // Show checking status
            if (!silent) {
                this.showToast('Đang kiểm tra cập nhật...', 'info');
                this.updateStatusBar('🔄 Đang kiểm tra cập nhật...');
            }

            if (!silent && updateStatus) {
                // Show update section
                if (updateSection) {
                    updateSection.style.display = 'block';
                }
                
                updateStatus.className = 'update-status checking';
                updateStatus.textContent = 'Đang kiểm tra cập nhật...';
            }

            // Disable buttons during check
            if (checkUpdatesBtn) {
                checkUpdatesBtn.disabled = true;
                checkUpdatesBtn.textContent = 'Đang kiểm tra...';
            }
            if (checkUpdatesFooterBtn) {
                checkUpdatesFooterBtn.disabled = true;
                checkUpdatesFooterBtn.textContent = 'Đang kiểm tra...';
            }

            const updateInfo = await window.electronAPI.checkAppUpdates();

            if (updateInfo.error) {
                throw new Error(updateInfo.error);
            }            if (updateInfo.hasUpdate) {
                // Store update info for later use
                this.currentUpdateInfo = updateInfo;
                
                // Update available
                if (updateStatus) {                    // Show update section
                    if (updateSection) {
                        updateSection.style.display = 'block';
                    }
                    
                    updateStatus.className = 'update-status available';
                    updateStatus.innerHTML = `
                        <div class="update-status-header">
                            <span class="update-status-emoji">🎉</span>
                            <span class="update-status-text">Có bản cập nhật mới: ${updateInfo.latestVersion}</span>
                        </div>
                        <div class="update-version-info">
                            Phiên bản hiện tại: ${updateInfo.currentVersion}
                            ${updateInfo.fileSize ? `<br>Dung lượng: ${this.formatFileSize(updateInfo.fileSize)}` : ''}
                        </div>
                        <div style="display: flex; gap: var(--spacing-sm); justify-content: center; flex-wrap: wrap; margin-top: var(--spacing-md);">
                            <button id="downloadUpdateBtn" class="btn btn-primary" style="font-size: var(--font-size-xs); padding: var(--spacing-xs) var(--spacing-sm);">
                                Tải xuống ngay
                            </button>
                            <button id="viewReleaseNotesBtn" class="btn btn-secondary" style="font-size: var(--font-size-xs); padding: var(--spacing-xs) var(--spacing-sm);" data-version="${updateInfo.latestVersion}" data-notes="${(updateInfo.releaseNotes || '').replace(/"/g, '&quot;')}">
                                Xem chi tiết                            </button>
                        </div>
                    `;
                    
                    // Add event listeners for the new buttons
                    setTimeout(() => {
                        const downloadBtn = document.getElementById('downloadUpdateBtn');
                        const releaseNotesBtn = document.getElementById('viewReleaseNotesBtn');                        if (downloadBtn) {
                            downloadBtn.addEventListener('click', (e) => {
                                e.preventDefault();
                                console.log('Download button clicked');
                                
                                // Disable button to prevent multiple clicks
                                downloadBtn.disabled = true;
                                downloadBtn.textContent = 'Đang tải xuống...';
                                downloadBtn.style.opacity = '0.6';
                                
                                // Use stored updateInfo instead of parsing JSON
                                if (this.currentUpdateInfo) {
                                    this.downloadUpdate(this.currentUpdateInfo).finally(() => {
                                        // Re-enable button after download completes (success or fail)
                                        downloadBtn.disabled = false;
                                        downloadBtn.textContent = 'Tải xuống ngay';
                                        downloadBtn.style.opacity = '1';
                                    });
                                } else {
                                    console.error('No update info available');
                                    this.showToast('Không thể tải cập nhật: Thiếu thông tin cập nhật', 'error');
                                    // Re-enable button on error
                                    downloadBtn.disabled = false;
                                    downloadBtn.textContent = 'Tải xuống ngay';
                                    downloadBtn.style.opacity = '1';
                                }
                            });
                        }
                          if (releaseNotesBtn) {
                            releaseNotesBtn.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation(); // Prevent event bubbling
                                
                                // Disable button temporarily to prevent multiple clicks
                                releaseNotesBtn.disabled = true;
                                releaseNotesBtn.style.opacity = '0.6';
                                
                                console.log('Release notes button clicked');
                                
                                setTimeout(() => {
                                    try {
                                        const version = releaseNotesBtn.getAttribute('data-version');
                                        const notesEncoded = releaseNotesBtn.getAttribute('data-notes');
                                        console.log('Version:', version, 'Notes encoded:', notesEncoded);
                                        
                                        // Better decoding of HTML entities
                                        let notes = notesEncoded || '';
                                        if (notes) {
                                            notes = notes
                                                .replace(/&quot;/g, '"')
                                                .replace(/&#39;/g, "'")
                                                .replace(/&amp;/g, '&')
                                                .replace(/&lt;/g, '<')
                                                .replace(/&gt;/g, '>');
                                        }
                                          console.log('Decoded notes:', notes);
                                          if (!notes || notes.trim() === '') {
                                            notes = 'Không có thông tin chi tiết về bản cập nhật này.';
                                        }
                                        
                                        // Show release notes in modal
                                        this.showReleaseNotesModal(version, notes);
                                          } catch (error) {
                                        console.error('Error handling release notes:', error);
                                        this.showToast('Lỗi khi hiển thị thông tin cập nhật', 'error');
                                    } finally {
                                        // Re-enable button after a delay
                                        setTimeout(() => {
                                            releaseNotesBtn.disabled = false;
                                            releaseNotesBtn.style.opacity = '1';
                                        }, 1000);
                                    }
                                }, 50); // Small delay to ensure DOM is ready
                            });
                        }
                    }, 100);
                }
                
                if (!silent) {
                    this.showUpdateNotification(updateInfo);
                    this.showToast(`🔔 Có bản cập nhật mới v${updateInfo.latestVersion} - Nhấp để tải xuống`, 'success');
                    this.updateStatusBar(`✨ Cập nhật có sẵn: v${updateInfo.latestVersion} - Nhấp vào nút để tải xuống`);
                } else {
                    // Silent notification for background checks
                    this.showToast(`🔔 Cập nhật v${updateInfo.latestVersion} có sẵn`, 'info');
                }
            } else {
                if (updateStatus && !silent) {
                    // Show update section even for no update in manual check
                    if (updateSection) {
                        updateSection.style.display = 'block';
                    }
                      updateStatus.className = 'update-status no-update';
                    updateStatus.innerHTML = `
                        <div class="update-status-header">
                            <span class="update-status-emoji">✅</span>
                            <span class="update-status-text">Bạn đang sử dụng phiên bản mới nhất</span>
                        </div>
                        <div class="update-version-info">
                            Phiên bản hiện tại: ${updateInfo.currentVersion}
                        </div>
                    `;
                    
                    // Auto-hide the no update status after 5 seconds
                    setTimeout(() => {
                        if (updateSection && updateStatus.classList.contains('no-update')) {
                            updateSection.style.display = 'none';
                        }
                    }, 5000);
                }
                
                if (!silent) {
                    this.showToast('✅ Bạn đang sử dụng phiên bản mới nhất!', 'success');
                    this.updateStatusBar('✅ Phiên bản hiện tại là mới nhất');
                }
            }

        } catch (error) {
            console.error('Update check failed:', error);
            if (updateStatus && !silent) {
                // Show update section for errors too
                if (updateSection) {
                    updateSection.style.display = 'block';
                }
                  updateStatus.className = 'update-status error';
                updateStatus.innerHTML = `
                    <div class="update-status-header">
                        <span class="update-status-emoji">❌</span>
                        <span class="update-status-text">Lỗi kiểm tra cập nhật</span>
                    </div>
                    <div class="update-version-info">
                        ${error.message}
                    </div>
                    <button id="retryUpdateCheckBtn" class="btn btn-primary" style="font-size: var(--font-size-xs); padding: var(--spacing-xs) var(--spacing-sm); margin-top: var(--spacing-md);">
                        Thử lại
                    </button>
                `;
                
                // Add event listener for retry button
                setTimeout(() => {
                    const retryBtn = document.getElementById('retryUpdateCheckBtn');
                    if (retryBtn) {
                        retryBtn.addEventListener('click', () => this.checkForUpdates());
                    }
                }, 100);
                
                // Auto-hide error after 10 seconds
                setTimeout(() => {
                    if (updateSection && updateStatus.classList.contains('error')) {
                        updateSection.style.display = 'none';
                    }
                }, 10000);
            }
            
            if (!silent) {
                this.showToast(`❌ Lỗi kiểm tra cập nhật: ${error.message}`, 'error');
                this.updateStatusBar(`❌ Kiểm tra cập nhật thất bại: ${error.message}`);
            }
        } finally {
            // Re-enable buttons
            if (checkUpdatesBtn) {
                checkUpdatesBtn.disabled = false;
                checkUpdatesBtn.textContent = 'Kiểm tra cập nhật';
            }
            if (checkUpdatesFooterBtn) {
                checkUpdatesFooterBtn.disabled = false;
                checkUpdatesFooterBtn.textContent = 'Kiểm tra cập nhật';
            }
        }
    }// Show Update Notification
    showUpdateNotification(updateInfo, silent = false) {
        if (!silent) {
            // Create detailed update notification
            const notification = {
                title: 'Cập nhật mới có sẵn',
                message: `Phiên bản ${updateInfo.latestVersion} đã được phát hành`,
                details: updateInfo.releaseNotes || 'Cải thiện hiệu suất và sửa lỗi',
                downloadUrl: updateInfo.downloadUrl
            };

            // Show detailed toast with action
            this.showDetailedUpdateToast(notification);
        }
        
        // Show in status bar
        this.updateStatusBar(`🔔 Update available: v${updateInfo.latestVersion} - Click to download`);
    }    // Show detailed update toast
    showDetailedUpdateToast(notification) {
        // Update toast disabled - showing only status bar notification        console.log('Update notification:', notification);
        return;
    }

    // Download Update
    async downloadUpdate(updateInfo) {
        try {
            console.log('Starting app update download:', updateInfo);
            
            // Show more detailed progress
            this.showToast('🔄 Chuẩn bị tải xuống cập nhật...', 'info');
            this.updateStatusBar(`🔄 Đang tải xuống cập nhật v${updateInfo.latestVersion}...`);
            
            // Show progress bar for update download
            const progressContainer = document.getElementById('downloadProgressContainer');
            const fileName = document.getElementById('downloadFileName');
            const fileStatus = document.getElementById('downloadFileStatus');
            
            if (progressContainer) progressContainer.classList.add('active');
            if (fileName) fileName.textContent = `Cập nhật DriveBox v${updateInfo.latestVersion}`;
            if (fileStatus) fileStatus.textContent = 'Đang khởi tạo tải xuống cập nhật...';
              // Set downloading state for progress bar
            this.isDownloading = true;
            this.currentDownload = { 
                app: { 
                    name: `Cập nhật v${updateInfo.latestVersion}`, 
                    id: 'app-update' 
                } 
            };
            
            // Initialize progress display with default values
            this.updateEnhancedProgressBar({
                progress: 0,
                appName: `Cập nhật DriveBox v${updateInfo.latestVersion}`,
                downloadedSize: 0,
                totalSize: updateInfo.fileSize || 0,
                speed: 0,
                message: 'Đang khởi tạo tải xuống cập nhật...'
            });
            
            // Check if the electronAPI method exists
            if (!window.electronAPI || typeof window.electronAPI.downloadAppUpdate !== 'function') {
                throw new Error('App update download function not available');
            }
            
            const result = await window.electronAPI.downloadAppUpdate(updateInfo);
            
            if (result && result.success) {
                // Update progress to 100%
                const progressFill = document.getElementById('downloadProgressFill');
                const progressText = document.getElementById('downloadProgressText');
                
                if (progressFill) progressFill.style.width = '100%';
                if (progressText) progressText.textContent = '100%';
                if (fileStatus) fileStatus.textContent = 'Tải xuống cập nhật hoàn tất';
                
                // Better success message with next steps
                this.showToast(`✅ Cập nhật v${updateInfo.latestVersion} đã sẵn sàng! Nhấn OK để khởi động lại và cài đặt.`, 'success');
                this.updateStatusBar(`✅ Cập nhật v${updateInfo.latestVersion} sẵn sàng - Khởi động lại để cài đặt`);
                
                // Hide progress bar after showing completion
                setTimeout(() => {
                    if (progressContainer) {
                        progressContainer.classList.remove('active');
                    }
                }, 3000);
                
                // More explicit restart confirmation
                setTimeout(() => {
                    const shouldRestart = confirm(
                        `Cập nhật DriveBox v${updateInfo.latestVersion} đã được tải xuống thành công!\n\n` +
                        `Bạn có muốn khởi động lại ứng dụng ngay để cài đặt cập nhật không?\n\n` +
                        `Lưu ý: Ứng dụng sẽ tự động mở lại sau khi cập nhật hoàn tất.`
                    );
                    
                    if (shouldRestart) {
                        this.updateStatusBar('🔄 Đang khởi động lại để cài đặt cập nhật...');
                        setTimeout(() => {
                            window.electronAPI.restartApp && window.electronAPI.restartApp();
                        }, 1000);
                    }
                }, 2000);
                
            } else {
                throw new Error(result ? result.error : 'Tải xuống thất bại');
            }
            
        } catch (error) {
            console.error('Update download failed:', error);
            
            // Better error messages
            this.showToast(`❌ Lỗi tải cập nhật: ${error.message}\nVui lòng thử lại sau.`, 'error');
            this.updateStatusBar(`❌ Tải cập nhật thất bại: ${error.message}`);
            
            // Hide progress bar on error
            const progressContainer = document.getElementById('downloadProgressContainer');
            if (progressContainer) {
                setTimeout(() => {
                    progressContainer.classList.remove('active');
                }, 2000);
            }
        } finally {
            // Reset downloading state
            this.isDownloading = false;
            this.currentDownload = null;
        }
    }

    // Show Release Notes Modal
    showReleaseNotesModal(version, notes) {
        try {
            // Get modal elements
            const modal = document.getElementById('appModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalBody = document.getElementById('modalBody');
            
            if (!modal || !modalTitle || !modalBody) {
                console.error('Modal elements not found');
                this.showToast('Không thể hiển thị thông tin cập nhật', 'error');
                return;
            }
            
            // Set modal title
            modalTitle.textContent = `Chi tiết cập nhật v${version}`;
            
            // Format and set modal body
            const formattedNotes = this.formatReleaseNotes(notes);
            modalBody.innerHTML = `
                <div style="max-height: 400px; overflow-y: auto; padding: 10px;">
                    <div style="font-size: 14px; line-height: 1.6;">
                        ${formattedNotes}
                    </div>
                </div>
            `;
            
            // Show modal
            modal.classList.remove('hidden');
            
            // Focus on modal for accessibility
            modal.focus();
            
            console.log('Release notes modal displayed for version:', version);
              } catch (error) {
            console.error('Error showing release notes modal:', error);
            this.showToast('Lỗi khi hiển thị thông tin cập nhật', 'error');
        }
    }

    // Format release notes to HTML
    formatReleaseNotes(notes) {
        if (!notes || typeof notes !== 'string') {
            return '<p>Không có thông tin chi tiết.</p>';
        }
        
        console.log('Original notes:', notes);
        
        // Clean up and prepare the text
        let formatted = notes
            .trim()
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
        
        // Convert markdown to HTML step by step
        formatted = formatted
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
            .replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        
        // Clean up empty lines and convert to paragraphs
        const lines = formatted.split('\n');
        const processedLines = [];
        let currentParagraph = '';
        let inList = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check if we're entering or leaving a list
            if (line.includes('<li>')) {
                if (currentParagraph.trim()) {
                    processedLines.push(`<p>${currentParagraph}</p>`);
                    currentParagraph = '';
                }
                if (!inList) {
                    processedLines.push('<ul>');
                    inList = true;
                }
                processedLines.push(line);
            } else if (inList && !line.includes('<li>') && line !== '') {
                processedLines.push('</ul>');
                inList = false;
                currentParagraph = line;
            } else if (line.match(/^<h[1-6]>/) || line === '' || line.match(/^<\/h[1-6]>$/)) {
                // Headers or empty lines
                if (currentParagraph.trim()) {
                    processedLines.push(`<p>${currentParagraph}</p>`);
                    currentParagraph = '';
                }
                if (line !== '') {
                    processedLines.push(line);
                }
            } else {
                // Regular text
                if (currentParagraph) {
                    currentParagraph += ' ' + line;
                } else {
                    currentParagraph = line;
                }
            }
        }
        
        // Close any remaining paragraph or list
        if (currentParagraph.trim()) {
            processedLines.push(`<p>${currentParagraph}</p>`);
        }
        if (inList) {
            processedLines.push('</ul>');
        }
        
        const result = processedLines.join('\n');
        return result || '<p>Không có thông tin chi tiết.</p>';
    }

    // ...existing code...
}

// Initialize the app when DOM is loaded
let app; // Make app globally accessible

document.addEventListener('DOMContentLoaded', () => {
    app = new DriveBoxApp();
      // Expose app to window object for HTML onclick events
    window.app = app;
      // Add global helper functions for button compatibility
    window.downloadUpdate = (updateInfo) => {
        if (app && app.downloadUpdate) {
            app.downloadUpdate(updateInfo);
        }
    };      
    // Check electronAPI availability on startup
    const apiCheck = app.checkElectronAPI();
    if (!apiCheck.available) {
        console.error('DriveBox initialization error:', apiCheck.error);
        app.showToast(`Lỗi khởi tạo: ${apiCheck.error}`, 'error');
    } else if (apiCheck.missingOptional && apiCheck.missingOptional.length > 0) {
        console.warn('DriveBox initialized with limited functionality:', apiCheck.message);
        app.showToast('Một số tính năng có thể không khả dụng', 'warning');
    } else {
        console.log('DriveBox initialized successfully with full functionality');
    }
});
