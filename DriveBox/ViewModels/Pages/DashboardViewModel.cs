using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using DriveBox.Models;
using DriveBox.Models.Download;
using DriveBox.Services;
using Microsoft.Extensions.DependencyInjection;
using System.Collections.ObjectModel;
using System.Net.Http;
using System.Windows;
using System.Windows.Threading;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Security.Principal;
using System.Linq;
using WpfApplication = System.Windows.Application;

namespace DriveBox.ViewModels.Pages
{
    public partial class DashboardViewModel : ObservableObject, IDisposable
    {
        private readonly AppCatalogService _appCatalogService;
        private readonly AppConfigService _configService;
        private readonly CrashRecoveryService _crashRecoveryService;
        private readonly Services.Download.DownloadService _downloadService;
        private readonly DialogService _dialogService;
        private readonly ShortcutService _shortcutService;
        private readonly WindowsRegistrationService _windowsRegistrationService;
        private System.Threading.Timer? _sessionSaveTimer;

        [ObservableProperty]
        private ObservableCollection<AppInfo> _apps = [];

        [ObservableProperty]
        private ObservableCollection<AppInfo> _filteredApps = [];

        [ObservableProperty]
        private string _searchTerm = string.Empty;

        [ObservableProperty]
        private bool _isLoading = false;

        [ObservableProperty]
        private string _statusMessage = string.Empty;

        [ObservableProperty]
        private bool _hasError = false;

        [ObservableProperty]
        private string _errorMessage = string.Empty;


        [ObservableProperty]
        private ObservableCollection<DownloadItem> _activeDownloads = [];

        [ObservableProperty]
        private bool _hasActiveDownloads = false;

        [ObservableProperty]
        private int _totalActiveDownloads = 0;

        [ObservableProperty]
        private bool _isUpdateInProgress = false;

        // UI Control properties
        public bool CanCancelDownloads => HasActiveDownloads && !IsUpdateInProgress;
        public bool CanStartNewDownloads => !IsUpdateInProgress;

        partial void OnHasActiveDownloadsChanged(bool value)
        {
            OnPropertyChanged(nameof(CanCancelDownloads));
            CancelAllDownloadsCommand.NotifyCanExecuteChanged();
        }

        partial void OnIsUpdateInProgressChanged(bool value)
        {
            OnPropertyChanged(nameof(CanCancelDownloads));
            OnPropertyChanged(nameof(CanStartNewDownloads));
            CancelAllDownloadsCommand.NotifyCanExecuteChanged();
        }

        public IRelayCommand<AppInfo> DownloadAppCommand { get; }
        public IAsyncRelayCommand<AppInfo> UninstallAppCommand { get; }
        public IRelayCommand<AppInfo> CheckInstallationStatusCommand { get; }
        public IAsyncRelayCommand<AppInfo> OpenAppCommand { get; }
        public IAsyncRelayCommand<AppInfo> VerifyAppCommand { get; }
        public IAsyncRelayCommand RefreshSizesCommand { get; }
        public IRelayCommand<DownloadItem> CancelDownloadCommand { get; }
        public IRelayCommand<DownloadItem> PauseResumeDownloadCommand { get; }
        public IRelayCommand CancelAllDownloadsCommand { get; }
        public IAsyncRelayCommand SyncManifestCommand { get; }

        public DashboardViewModel(AppCatalogService appCatalogService, AppConfigService configService, CrashRecoveryService crashRecoveryService, Services.Download.DownloadService downloadService, DialogService dialogService, ShortcutService shortcutService, WindowsRegistrationService windowsRegistrationService)
        {
            _appCatalogService = appCatalogService;
            _configService = configService;
            _crashRecoveryService = crashRecoveryService;
            _downloadService = downloadService;
            _dialogService = dialogService;
            _shortcutService = shortcutService;
            _windowsRegistrationService = windowsRegistrationService;
            
            DownloadAppCommand = new RelayCommand<AppInfo>(ExecuteDownloadAppAsync);
            UninstallAppCommand = new AsyncRelayCommand<AppInfo>(UninstallAppAsync);
            CheckInstallationStatusCommand = new RelayCommand<AppInfo>(CheckInstallationStatus);
            OpenAppCommand = new AsyncRelayCommand<AppInfo>(OpenAppAsync);
            VerifyAppCommand = new AsyncRelayCommand<AppInfo>(VerifyAppAsync);
            RefreshSizesCommand = new AsyncRelayCommand(RefreshAppSizesAsync);
            CancelDownloadCommand = new RelayCommand<DownloadItem>(CancelDownload);
            PauseResumeDownloadCommand = new RelayCommand<DownloadItem>(PauseResumeDownload);
            CancelAllDownloadsCommand = new RelayCommand(CancelAllDownloads, () => CanCancelDownloads);
            SyncManifestCommand = new AsyncRelayCommand(SyncManifestAsync);
            

            var isAdmin = IsRunningAsAdministrator();

            
            _sessionSaveTimer = null;
            

            _ = Task.Run(async () => {
                try
                {
                    await Task.Delay(3000);
                    await CheckCrashRecoveryAsync();
                }
                catch (Exception)
                {

                }
            });
        }

        partial void OnSearchTermChanged(string value)
        {
            FilterApps();
        }

        private void FilterApps()
        {
            if (string.IsNullOrWhiteSpace(SearchTerm))
            {
                FilteredApps = new ObservableCollection<AppInfo>(Apps);
            }
            else
            {
                var filtered = Apps.Where(app =>
                    app.TenHienThi.Contains(SearchTerm, StringComparison.OrdinalIgnoreCase) ||
                    app.PhanLoai?.Contains(SearchTerm, StringComparison.OrdinalIgnoreCase) == true ||
                    app.MoTa?.Contains(SearchTerm, StringComparison.OrdinalIgnoreCase) == true
                ).ToList();

                FilteredApps = new ObservableCollection<AppInfo>(filtered);
            }
        }

        private void UpdateAppStateInAllCollections(AppInfo app)
        {

            var appsItem = Apps.FirstOrDefault(a => a.Id == app.Id);
            if (appsItem != null)
            {

                appsItem.Status = app.Status;
                appsItem.ErrorMessage = app.ErrorMessage;
                appsItem.IsInstalled = app.IsInstalled;
                appsItem.InstallPath = app.InstallPath;
            }

            var filteredItem = FilteredApps.FirstOrDefault(a => a.Id == app.Id);
            if (filteredItem != null)
            {
                filteredItem.Status = app.Status;
                filteredItem.ErrorMessage = app.ErrorMessage;
                filteredItem.IsInstalled = app.IsInstalled;
                filteredItem.InstallPath = app.InstallPath;
            }
        }

        [RelayCommand]
        public async Task LoadAppsAsync()
        {
            await LoadAppsProgressiveAsync();
        }


        private async Task LoadAppsProgressiveAsync()
        {
            try
            {
                IsLoading = true;
                HasError = false;
                StatusMessage = "Đang tải ứng dụng quan trọng...";


                var immediateApps = await _appCatalogService.GetAppsProgressiveAsync(LoadPhase.Immediate);
                
                if (immediateApps?.Count > 0)
                {

                    await UpdateUIWithApps(immediateApps, "immediate");
                    StatusMessage = $"Đã tải {immediateApps.Count} ứng dụng cơ bản";


                    _ = Task.Run(async () => await LoadProgressivePhases());
                }
                else
                {
                    StatusMessage = "Không tìm thấy ứng dụng nào";
                    HasError = true;
                    ErrorMessage = "Không thể tải danh sách ứng dụng. Vui lòng kiểm tra kết nối mạng.";
                }

                StartSessionSaveTimer();
            }
            catch (Exception ex)
            {
                HasError = true;
                ErrorMessage = $"Lỗi tải ứng dụng: {ex.Message}";
                StatusMessage = "Lỗi tải danh sách ứng dụng";
            }
            finally
            {
                IsLoading = false;
            }
        }

        private async Task LoadProgressivePhases()
        {
            try
            {
                await Task.Delay(1000);
                
                var progressiveApps = await _appCatalogService.GetAppsProgressiveAsync(LoadPhase.Progressive);
                var newApps = progressiveApps.Where(app => !Apps.Any(existing => existing.Id == app.Id)).ToList();
                
                if (newApps.Count > 0)
                {
                    await UpdateUIWithApps(newApps, "progressive");
                    
                    WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                    {
                        StatusMessage = $"Đã tải {Apps.Count} ứng dụng";
                    });
                }


                await Task.Delay(2000);
                await RefreshAppSizesAsync();


                await Task.Delay(3000);
                var onDemandApps = await _appCatalogService.GetAppsProgressiveAsync(LoadPhase.OnDemand);
                var onDemandNewApps = onDemandApps.Where(app => !Apps.Any(existing => existing.Id == app.Id)).ToList();
                
                if (onDemandNewApps.Count > 0)
                {
                    await UpdateUIWithApps(onDemandNewApps, "metadata");
                    
                    WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                    {
                        StatusMessage = $"Sẵn sàng! {Apps.Count} ứng dụng có thể cài đặt";
                    });
                }
            }
            catch (Exception ex)
            {


            }
        }

        private async Task UpdateUIWithApps(List<AppInfo> newApps, string phase)
        {
            if (WpfApplication.Current?.Dispatcher != null)
            {
                await WpfApplication.Current.Dispatcher.BeginInvoke(() =>
                {
                    if (phase == "immediate")
                    {
                        Apps.Clear();
                    }
                    
                    foreach (var app in newApps)
                    {

                        CheckInstallationStatus(app);
                        Apps.Add(app);
                    }
                    FilterApps();
                });
            }
        }

        private async Task CheckCrashRecoveryAsync()
        {
            try
            {

                var sessionData = await _crashRecoveryService.LoadSessionStateAsync();
                
                if (sessionData != null)
                {

                    
                    if (sessionData.Apps?.Count > 0)
                    {
                        var dispatcher = WpfApplication.Current?.Dispatcher;
                        if (dispatcher != null)
                        {
                            await dispatcher.BeginInvoke(async () =>
                            {
                                StatusMessage = "Đang khôi phục session trước đó...";
                                

                                foreach (var app in sessionData.Apps)
                                {
                                    var existingApp = Apps.FirstOrDefault(a => a.Id == app.Id);
                                    if (existingApp != null)
                                    {
                                        existingApp.IsInstalled = app.IsInstalled;
                                        existingApp.InstallPath = app.InstallPath;
                                        existingApp.Status = app.Status;
                                    }
                                }
                                
                                await _crashRecoveryService.ClearSessionStateAsync();
                                StatusMessage = "Đã khôi phục session thành công";
                            });
                        }
                    }
                }
            }
            catch (Exception)
            {

            }
        }

        private void StartSessionSaveTimer()
        {
            _sessionSaveTimer ??= new System.Threading.Timer(async _ =>
            {
                try
                {
                    await _crashRecoveryService.SaveSessionStateAsync(Apps, []);
                }
                catch (Exception)
                {

                }
            }, null, TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(2));
        }

        private async Task RefreshAppSizesAsync()
        {
            try
            {

                StatusMessage = "Đang làm mới thông tin dung lượng...";
                await _appCatalogService.RefreshAppSizesAsync();
                
                var appsToCheck = Apps.ToList();
                var tasks = appsToCheck.Select(async app =>
                {
                    try
                    {
                        CheckInstallationStatus(app);
                        await Task.Delay(10);
                    }
                    catch (Exception)
                    {

                    }
                }).ToArray();

                await Task.WhenAll(tasks);
                

                var appsWithSizes = Apps.Count(app => app.TotalSize > 0);
                StatusMessage = $"Đã làm mới dung lượng - {appsWithSizes}/{Apps.Count} ứng dụng có thông tin dung lượng";

            }
            catch (Exception)
            {

            }
        }


        private async Task SyncManifestAsync()
        {
            try
            {
                StatusMessage = "Đang đồng bộ thông tin ứng dụng với GitHub...";


                _appCatalogService.ClearCache();
                var updatedCatalog = await _appCatalogService.LoadAppCatalogAsync();
                
                if (updatedCatalog?.Applications != null)
                {

                    await WpfApplication.Current.Dispatcher.InvokeAsync(() =>
                    {
                        Apps.Clear();
                        foreach (var app in updatedCatalog.Applications)
                        {
                            Apps.Add(app);
                        }
                        FilteredApps.Clear();
                        foreach (var app in updatedCatalog.Applications)
                        {
                            FilteredApps.Add(app);
                        }
                    });


                    foreach (var app in Apps)
                    {
                        CheckInstallationStatus(app);
                    }

                    StatusMessage = "Đã đồng bộ thành công thông tin ứng dụng";

                }
                else
                {
                    StatusMessage = "Không thể đồng bộ thông tin ứng dụng";
                }
            }
            catch (Exception ex)
            {
                StatusMessage = $"Lỗi đồng bộ: {ex.Message}";

            }
        }




        private void ExecuteDownloadAppAsync(AppInfo? app)
        {
            // Prevent app downloads when update is in progress
            if (!CanStartNewDownloads)
            {
                StatusMessage = "Không thể tải ứng dụng khi đang cập nhật DriveBox";
                return;
            }

            _ = Task.Run(async () =>
            {
                try
                {
                    await DownloadAppAsync(app);
                }
                catch (Exception ex)
                {

                }
            });
        }


        private async Task DownloadAppAsync(AppInfo? app)
        {
            if (app == null || app.IsInstalled || app.IsDownloading)
            {
                StatusMessage = app?.IsInstalled == true ? "Ứng dụng đã được cài đặt" : "Không thể tải xuống";
                return;
            }


            var downloadItem = new DownloadItem(app);
            
  
            WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
            {
                ActiveDownloads.Add(downloadItem);
                UpdateDownloadStatus();
                OnPropertyChanged(nameof(ActiveDownloads));
                OnPropertyChanged(nameof(HasActiveDownloads));
                OnPropertyChanged(nameof(TotalActiveDownloads));
            });

            try
            {
                app.IsDownloading = true;
                app.Status = "Đang chuẩn bị tải xuống...";
                StatusMessage = $"Đang tải xuống {app.TenHienThi}... ({ActiveDownloads.Count} downloads)";
                


                



                var basicProgress = new Progress<int>(percentage =>
                {
                    WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                    {
                        app.Status = $"Đang tải xuống... {percentage}%";
                        StatusMessage = $"Đang tải xuống {app.TenHienThi}... {percentage}%";
                    });
                });


                var enhancedProgress = new EnhancedProgress<int>(
                    percentage => ((IProgress<int>)basicProgress).Report(percentage),
                    (percentage, progressInfo) =>
                    {
                        WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                        {
                            downloadItem.UpdateProgress(percentage, progressInfo);
                        });
                    });


                var success = await Task.Run(async () => 
                    await _downloadService.DownloadAppAsync(app, basicProgress, enhancedProgress, downloadItem.CancellationTokenSource.Token, downloadItem));

                if (success)
                {

                    app.Status = "Đang hoàn tất cài đặt...";
                    StatusMessage = $"Đang hoàn tất cài đặt {app.TenHienThi}...";


                    app.InstallPath = _configService.GetAppInstallPath(app);


                    try
                    {
                        app.Status = "Đang tạo shortcuts...";
                        StatusMessage = $"Đang tạo shortcuts cho {app.TenHienThi}...";
                        

                        WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                        {
                            downloadItem.ProgressText = "Đang tạo shortcuts...";
                            downloadItem.ProgressPercentage = 100;
                        });
                        
                        var shortcutSuccess = await _shortcutService.CreateVietnameseShortcutsAsync(app);
                        if (shortcutSuccess)
                        {
                            app.Status = "Đã cài đặt và tạo shortcuts thành công";
                        }
                        else
                        {


                        }
                    }
                    catch (Exception shortcutEx)
                    {


                    }


                    app.IsInstalled = true;
                    app.Status = "Đã cài đặt thành công";
                    StatusMessage = $"Đã cài đặt {app.TenHienThi} thành công";


                    UpdateAppStateInAllCollections(app);


                    WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                    {
                        downloadItem.Complete(true);
                        RemoveCompletedDownload(downloadItem);
                    });


                    _ = Task.Run(async () =>
                    {
                        await _dialogService.ShowSuccessAsync(
                            "Cài đặt thành công",
                            $"{app.TenHienThi} đã được tải xuống và cài đặt thành công!\n\n" +
                            "Bạn có thể bắt đầu sử dụng ứng dụng ngay bây giờ.");
                    });
                }
                else
                {
                    app.Status = "Tải xuống thất bại";
                    StatusMessage = $"Không thể tải xuống {app.TenHienThi}";
                    
                    WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                    {
                        downloadItem.Complete(false);
                        RemoveCompletedDownload(downloadItem);
                    });
                }
            }
            catch (OperationCanceledException)
            {

                app.Status = "Đã hủy tải xuống";
                StatusMessage = $"Đã hủy tải xuống {app.TenHienThi}";
                
                WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                {
                    downloadItem.Complete(false);
                    RemoveCompletedDownload(downloadItem);
                });
            }
            catch (Exception ex)
            {
                app.Status = $"Lỗi tải xuống: {ex.Message}";
                app.ErrorMessage = ex.Message;
                StatusMessage = $"Không thể tải xuống {app.TenHienThi}: {ex.Message}";

                WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                {
                    downloadItem.Complete(false);
                    RemoveCompletedDownload(downloadItem);
                });


                _ = Task.Run(async () =>
                {
                    await _dialogService.ShowErrorAsync(
                        "Lỗi tải xuống",
                        $"Không thể tải xuống {app.TenHienThi}.\n\n" +
                        $"Chi tiết lỗi: {ex.Message}\n\n" +
                        "Vui lòng kiểm tra:\n" +
                        "• Kết nối internet\n" +
                        "• Dung lượng ổ đĩa\n" +
                        "• Quyền ghi file");
                });
            }
            finally
            {
                app.IsDownloading = false;
                downloadItem.Dispose();
                


            }
        }

        private static async Task DownloadModulesAsync(AppInfo app, List<AppModule> modules, string phase)
        {
            var totalModules = modules.Count;
            var completedModules = 0;

            
            var concurrency = phase switch
            {
                "Critical" => 2,     // Sequential for dependencies
                "Essential" => 4,    // Moderate for core app
                "Optional" => 6,     // Higher for background content
                _ => 4
            };

            using var semaphore = new SemaphoreSlim(concurrency, concurrency);
            var downloadTasks = modules.Select(async module =>
            {
                await semaphore.WaitAsync();
                try
                {
    
                    var downloadTime = module.Size > 0 
                        ? Math.Max(500, Math.Min(5000, (int)(module.Size / 1024 / 1024 * 100))) // 100ms per MB
                        : 1000;

                    module.Status = "Đang tải...";
                    await Task.Delay(downloadTime);
                    
                    module.Status = "Hoàn thành";
                    
                    Interlocked.Increment(ref completedModules);
                    
    
                    WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                    {
                        var progress = (double)completedModules / totalModules * 100;
                        app.Status = $"Đang tải {phase} ({progress:F0}%)";
                    });
                }
                catch (Exception ex)
                {
                    module.Status = $"Lỗi: {ex.Message}";
                    throw;
                }
                finally
                {
                    semaphore.Release();
                }
            });

            await Task.WhenAll(downloadTasks);
        }

        private async Task VerifyAppAsync(AppInfo? app)
        {
            if (app == null || !app.IsInstalled)
            {
                StatusMessage = "Không thể kiểm tra ứng dụng chưa cài đặt";
                return;
            }

            try
            {
                app.Status = "Đang kiểm tra & sửa chữa...";
                StatusMessage = $"Đang kiểm tra {app.TenHienThi}...";

                var issuesFound = new List<string>();
                var fixesApplied = new List<string>();

    
                await Task.Run(() =>
                {
                    if (!string.IsNullOrEmpty(app.InstallPath) && Directory.Exists(app.InstallPath))
                    {
                        var files = Directory.GetFiles(app.InstallPath, "*.*", SearchOption.AllDirectories);
                        var hasExecutables = files.Any(f => 
                            f.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ||
                            f.EndsWith(".msi", StringComparison.OrdinalIgnoreCase));

                        if (!hasExecutables)
                        {
                            issuesFound.Add("Không tìm thấy file thực thi");
                            app.Status = "Cài đặt không hoàn chỉnh";
                            app.ErrorMessage = "Không tìm thấy file thực thi";
                            return;
                        }

            
                        var mainExePath = Path.Combine(app.InstallPath, app.FileThucThiChinh);
                        if (!File.Exists(mainExePath))
                        {
                            issuesFound.Add($"Không tìm thấy file chính: {app.FileThucThiChinh}");
                        }
                    }
                    else
                    {
                        app.IsInstalled = false;
                        app.Status = "Chưa cài đặt";
                        app.InstallPath = string.Empty;
                        return;
                    }
                });

                if (!app.IsInstalled) return;

    
                if (app.Id == "mo_phong_lai_xe")
                {
                    StatusMessage = $"Đang kiểm tra dependencies cho {app.TenHienThi}...";
                    app.Status = "Đang kiểm tra dependencies...";
                    
                    var dependencyIssues = await CheckDependenciesAsync(app);
                    issuesFound.AddRange(dependencyIssues);
                }

    
                StatusMessage = $"Đang kiểm tra shortcuts cho {app.TenHienThi}...";
                app.Status = "Đang kiểm tra shortcuts...";
                
                try
                {
        
                    var hasAdminFlag = await _shortcutService.CheckShortcutRunAsAdminAsync(app);
                    
                    if (!hasAdminFlag)
                    {
                        StatusMessage = $"Đang sửa shortcuts cho {app.TenHienThi}...";
                        app.Status = "Đang sửa shortcuts...";
                        
                        var shortcutSuccess = await _shortcutService.RecreateShortcutsAsync(app);
                        if (shortcutSuccess)
                        {
                            fixesApplied.Add("Đã sửa shortcuts (Run as Administrator)");

                        }
                        else
                        {
                            issuesFound.Add("Không thể tái tạo shortcuts (cần quyền Admin)");
                        }
                    }
                    else
                    {
                        
                        fixesApplied.Add("Shortcuts đã có quyền Administrator");
                    }
                }
                catch (Exception ex)
                {
                    issuesFound.Add($"Lỗi kiểm tra/sửa shortcuts: {ex.Message}");

                }

     
                StatusMessage = $"Đang kiểm tra khả năng chạy trực tiếp {app.TenHienThi}...";
                app.Status = "Đang test execution...";
                
                try
                {
                    await TestDirectExecutionAsync(app, issuesFound, fixesApplied);
                }
                catch (Exception ex)
                {
                    issuesFound.Add($"Lỗi test execution: {ex.Message}");
    
                }

    
                if (issuesFound.Count == 0)
                {
                    app.Status = "Đã kiểm tra";
                    app.ErrorMessage = string.Empty;
                    
        
                    await _dialogService.ShowInfoAsync("Kiểm tra hoàn tất", $"{app.TenHienThi} hoạt động bình thường.");
                }
                else
                {
                    app.Status = "Có vấn đề cần khắc phục";
                    app.ErrorMessage = string.Join("; ", issuesFound);
                    
                    var message = "Phát hiện vấn đề:\n";
                    message += "• " + string.Join("\n• ", issuesFound);
                    
                    if (fixesApplied.Count > 0)
                    {
                        message += "\n\nĐã kiểm tra:\n";
                        message += "• " + string.Join("\n• ", fixesApplied);
                    }
                    
                    if (issuesFound.Any(i => i.Contains("quyền Admin") || i.Contains("Administrator")))
                    {
                        message += "\n\nKhuyến nghị: Luôn dùng desktop shortcut thay vì double-click file gốc.";
                        message += "\nDesktop shortcut đã được config 'Run as Administrator' tự động.";
                    }
                    
                    await _dialogService.ShowWarningAsync("Kiểm tra hoàn tất", message);
                }

                StatusMessage = $"Đã kiểm tra {app.TenHienThi}";
                UpdateAppStateInAllCollections(app);
            }
            catch (Exception ex)
            {
                app.Status = "Lỗi kiểm tra";
                app.ErrorMessage = ex.Message;
                StatusMessage = $"Lỗi kiểm tra {app.TenHienThi}: {ex.Message}";
                
                await _dialogService.ShowErrorAsync("Lỗi", $"Có lỗi xảy ra khi kiểm tra:\n{ex.Message}");
            }
        }

        private async Task<List<string>> CheckDependenciesAsync(AppInfo app)
        {
            var issues = new List<string>();
            
            return await Task.Run(() =>
            {
                try
                {
            
                    var vcRedistKeys = new[]
                    {
                        @"SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
                        @"SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"
                    };
                    
                    bool vcRedistFound = false;
                    foreach (var keyPath in vcRedistKeys)
                    {
                        try
                        {
                            using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(keyPath);
                            if (key != null)
                            {
                                var installed = key.GetValue("Installed");
                                if (installed != null && installed.ToString() == "1")
                                {
                                    vcRedistFound = true;
                                    break;
                                }
                            }
                        }
                        catch
                        {
                    
                        }
                    }
                    
                    if (!vcRedistFound)
                    {
                        issues.Add("Chưa cài Microsoft VC++ Redistributable");
                    }

            
                    var qt5Dlls = new[] { "Qt5Core.dll", "Qt5Gui.dll", "Qt5Widgets.dll" };
                    var missingQt5Dlls = qt5Dlls.Where(dll => 
                        !File.Exists(Path.Combine(app.InstallPath, dll))).ToList();
                    
                    if (missingQt5Dlls.Any())
                    {
                        issues.Add($"Thiếu Qt5 DLLs: {string.Join(", ", missingQt5Dlls)}");
                    }

                    return issues;
                }
                catch (Exception ex)
                {
                    issues.Add($"Lỗi kiểm tra dependencies: {ex.Message}");
                    return issues;
                }
            });
        }

        private void CheckInstallationStatus(AppInfo? app)
        {
            if (app == null) return;

            try
            {
                var installPath = _configService.GetAppInstallPath(app);
                
                if (Directory.Exists(installPath))
                {
                    var files = Directory.GetFiles(installPath, "*.*", SearchOption.AllDirectories);
                    if (files.Length > 0)
                    {
                        app.IsInstalled = true;
                        app.InstallPath = installPath;
                        app.Status = "Đã cài đặt";
                        

                        long totalSize = 0;
                        foreach (var file in files)
                        {
                            try
                            {
                                totalSize += new FileInfo(file).Length;
                            }
                            catch { }
                        }
                        
                        app.InstalledSize = totalSize;
                    }
                    else
                    {
                        app.IsInstalled = false;
                        app.Status = "Chưa cài đặt";
                        app.InstallPath = string.Empty;
                        app.InstalledSize = 0;
                    }
                }
                else
                {
                    app.IsInstalled = false;
                    app.Status = "Chưa cài đặt";
                    app.InstallPath = string.Empty;
                    app.InstalledSize = 0;
                }
            }
            catch (Exception ex)
            {
                app.Status = "Lỗi kiểm tra";
                app.ErrorMessage = ex.Message;
            }
        }

        /// <summary>
        /// Test direct execution để phát hiện lỗi quyền truy cập khi chạy file EXE trực tiếp
        /// Tests direct execution to detect permission issues when running EXE directly
        /// </summary>
        private async Task TestDirectExecutionAsync(AppInfo app, List<string> issuesFound, List<string> fixesApplied)
        {
            await Task.Run(() =>
            {
                try
                {
                    var installPath = _configService.GetAppInstallPath(app);
                    var executablePath = Path.Combine(installPath, app.FileThucThiChinh);

                    if (!File.Exists(executablePath))
                    {
                        issuesFound.Add("Không tìm thấy file thực thi chính");
                        return;
                    }

    
                    var canWriteToAppDir = TestWritePermissions(installPath);
                    
    
                    var requiresAdmin = CheckIfRequiresAdminPrivileges(executablePath);
                    
    

                    if (!canWriteToAppDir || requiresAdmin)
                    {
        
                        fixesApplied.Add("File EXE gốc yêu cầu admin privileges (bình thường cho Program Files)");
                        fixesApplied.Add("Desktop shortcut đã được config 'Run as Administrator' tự động");
                        fixesApplied.Add("Khuyến nghị: Luôn dùng desktop shortcut thay vì double-click file gốc");
                        
    
                    }
                    else
                    {
                        fixesApplied.Add("File EXE có thể chạy trực tiếp OK");

                    }
                }
                catch (Exception ex)
                {
                    issuesFound.Add($"Không thể test direct execution: {ex.Message}");
    
                }
            });
        }

        /// <summary>
        /// Test write permissions trong thư mục để xác định có cần admin privileges không
        /// </summary>
        private bool TestWritePermissions(string directoryPath)
        {
            try
            {
                var testFile = Path.Combine(directoryPath, $"temp_write_test_{Guid.NewGuid()}.tmp");
                File.WriteAllText(testFile, "test");
                File.Delete(testFile);
                return true;
            }
            catch (UnauthorizedAccessException)
            {
                return false;
            }
            catch (Exception)
            {
                return false;
            }
        }

        /// <summary>
        /// Kiểm tra nếu file EXE có manifest yêu cầu admin privileges
        /// </summary>
        private bool CheckIfRequiresAdminPrivileges(string executablePath)
        {
            try
            {

                var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
                var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
                
                var isInProgramFiles = executablePath.StartsWith(programFiles, StringComparison.OrdinalIgnoreCase) ||
                                      executablePath.StartsWith(programFilesX86, StringComparison.OrdinalIgnoreCase);
                

                var fileName = Path.GetFileName(executablePath).ToLower();
                var needsAdminNames = new[] { "setup", "install", "updater", "admin" };
                var hasAdminName = needsAdminNames.Any(name => fileName.Contains(name));
                
                return isInProgramFiles || hasAdminName;
            }
            catch
            {
                return true; // Err on the side of caution
            }
        }

        /// <summary>
        /// Kiểm tra xem DriveBox có đang chạy với quyền Administrator không
        /// Checks if DriveBox is running as Administrator
        /// </summary>
        private bool IsRunningAsAdministrator()
        {
            try
            {
                var identity = WindowsIdentity.GetCurrent();
                var principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
            catch
            {
                return false;
            }
        }

        private async Task OpenAppAsync(AppInfo? app)
        {
            if (app == null || !app.IsInstalled) return;

            try
            {
                StatusMessage = $"Đang mở {app.TenHienThi}...";
                
                await Task.Run(() =>
                {
                    if (!string.IsNullOrEmpty(app.InstallPath) && Directory.Exists(app.InstallPath))
                    {

            
                        string mainExe = string.Empty;
                        
                        if (!string.IsNullOrEmpty(app.FileThucThiChinh))
                        {
            
                            var specificExe = Path.Combine(app.InstallPath, app.FileThucThiChinh);
                            if (File.Exists(specificExe))
                            {
                                mainExe = specificExe;
                            }
                            else
                            {
                
                                var foundExe = Directory.GetFiles(app.InstallPath, app.FileThucThiChinh, SearchOption.AllDirectories)
                                    .FirstOrDefault();
                                if (!string.IsNullOrEmpty(foundExe))
                                {
                                    mainExe = foundExe;
                                }
                            }
                        }
                        
        
                        if (string.IsNullOrEmpty(mainExe))
                        {
                            var exeFiles = Directory.GetFiles(app.InstallPath, "*.exe", SearchOption.AllDirectories);
                            
                            if (exeFiles.Length > 0)
                            {
                
                                var appExeFiles = exeFiles.Where(f =>
                                {
                                    var fileName = Path.GetFileName(f).ToLowerInvariant();
                                    return !fileName.Contains("setup") &&
                                           !fileName.Contains("install") &&
                                           !fileName.Contains("uninstall") &&
                                           !fileName.Contains("updater") &&
                                           !fileName.Contains("redist") &&
                                           !fileName.Contains("codec") &&
                                           !fileName.Contains("klite");
                                }).ToArray();
                                

                                mainExe = appExeFiles.FirstOrDefault(f => 
                                    Path.GetFileName(f).Contains(app.TenHienThi, StringComparison.OrdinalIgnoreCase)) ??
                                    appExeFiles.FirstOrDefault() ??
                                    exeFiles.First();
                            }
                        }
                        
                        if (!string.IsNullOrEmpty(mainExe) && File.Exists(mainExe))
                        {
                
                            
                            var startInfo = new ProcessStartInfo
                            {
                                FileName = mainExe,
                                WorkingDirectory = Path.GetDirectoryName(mainExe)
                            };


                            if (IsRunningAsAdministrator())
                            {
    
                                startInfo.UseShellExecute = false;
            
                            }
                            else
                            {
    
                                startInfo.UseShellExecute = true;
            
                            }

                            Process.Start(startInfo);
                        }
                        else
                        {
    
                            var startInfo = new ProcessStartInfo
                            {
                                FileName = app.InstallPath,
                                UseShellExecute = true
                            };

            
                            Process.Start(startInfo);
                        }
                    }
                });
                
                StatusMessage = $"Đã mở {app.TenHienThi}";
            }
            catch (Exception ex)
            {
                StatusMessage = $"Không thể mở {app.TenHienThi}";
    
            }
        }

        private async Task UninstallAppAsync(AppInfo? app)
        {
            if (app == null || !app.IsInstalled) return;

            try
            {
                var result = await _dialogService.ShowConfirmationAsync(
                    "Xác nhận gỡ cài đặt",
                    $"Bạn có chắc chắn muốn gỡ cài đặt {app.TenHienThi}?\n\nToàn bộ dữ liệu sẽ bị xóa vĩnh viễn.",
                    "Gỡ cài đặt", "Hủy");

                if (result != Wpf.Ui.Controls.ContentDialogResult.Primary) return;

                app.Status = "Đang gỡ cài đặt...";
                StatusMessage = $"Đang gỡ cài đặt {app.TenHienThi}...";

                await Task.Run(() =>
                {
                    if (!string.IsNullOrEmpty(app.InstallPath) && Directory.Exists(app.InstallPath))
                    {
                        Directory.Delete(app.InstallPath, true);
                    }
                });


                try
                {
                    app.Status = "Đang xóa shortcuts...";
                    StatusMessage = $"Đang xóa shortcuts của {app.TenHienThi}...";
                    
                    var shortcutRemovalSuccess = await _shortcutService.RemoveShortcutsAsync(app);
                    if (!shortcutRemovalSuccess)
                    {
        

                    }
                }
                catch (Exception shortcutEx)
                {


                }


                try
                {
                    app.Status = "Đang gỏ đăng ký Windows...";
                    StatusMessage = $"Đang gỏ đăng ký {app.TenHienThi} khỏi Windows...";
                    
                    var unregistrationSuccess = await _windowsRegistrationService.UnregisterAppFromWindowsAsync(app);
                    if (!unregistrationSuccess)
                    {

                    }
                    else
                    {

                    }
                }
                catch (Exception regEx)
                {


                }

                app.IsInstalled = false;
                app.InstallPath = string.Empty;
                app.InstalledSize = 0;
                app.Status = "Đã gỡ cài đặt";
                app.ErrorMessage = string.Empty;

                StatusMessage = $"Đã gỡ cài đặt {app.TenHienThi}";
                UpdateAppStateInAllCollections(app);
            }
            catch (Exception ex)
            {
                app.Status = "Lỗi gỡ cài đặt";
                app.ErrorMessage = ex.Message;
                StatusMessage = $"Lỗi gỡ cài đặt {app.TenHienThi}";


                await _dialogService.ShowErrorAsync(
                    "Lỗi gỡ cài đặt",
                    $"Không thể gỡ cài đặt {app.TenHienThi}.\n\n" +
                    $"Chi tiết lỗi: {ex.Message}\n\n" +
                    "Vui lòng thử:\n" +
                    "• Đóng ứng dụng nếu đang chạy\n" +
                    "• Chạy DriveBox với quyền Administrator\n" +
                    "• Xóa thủ công thư mục cài đặt");
            }
        }

        [RelayCommand]
        private async Task RefreshApps()
        {
            await LoadAppsAsync();
        }

        
        private void UpdateDownloadStatus()
        {
            TotalActiveDownloads = ActiveDownloads.Count;
            HasActiveDownloads = ActiveDownloads.Count > 0;
            
            // Notify UI that CanCancelDownloads might have changed
            OnPropertyChanged(nameof(CanCancelDownloads));
            CancelAllDownloadsCommand.NotifyCanExecuteChanged();
        }

        private void RemoveCompletedDownload(DownloadItem downloadItem)
        {
            
            _ = Task.Run(async () =>
            {
                await Task.Delay(3000);
                WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                {
                    ActiveDownloads.Remove(downloadItem);
                    UpdateDownloadStatus();
                    
    
                    OnPropertyChanged(nameof(ActiveDownloads));
                    OnPropertyChanged(nameof(HasActiveDownloads));
                    OnPropertyChanged(nameof(TotalActiveDownloads));
                });
            });
        }

        private void CancelDownload(DownloadItem? downloadItem)
        {
            if (downloadItem != null)
            {
                downloadItem.CancelCommand.Execute(null);
            }
        }

        private void PauseResumeDownload(DownloadItem? downloadItem)
        {
            if (downloadItem != null)
            {
                downloadItem.PauseResumeCommand.Execute(null);
            }
        }

        private void CancelAllDownloads()
        {
            var downloadsToCancel = ActiveDownloads.ToList();
            foreach (var download in downloadsToCancel)
            {
                download.CancelCommand.Execute(null);
            }
        }

        /// <summary>
        /// Start update download using existing download system
        /// </summary>
        public async Task StartUpdateDownloadAsync()
        {
            try
            {
                // Set update in progress flag
                IsUpdateInProgress = true;

                // Get update information for version and size
                var updateService = App.Services.GetRequiredService<UpdateService>();
                var updateInfo = await updateService.CheckForUpdatesAsync();
                
                // Get installer download URL and size
                var installerUrl = await GetInstallerDownloadUrlFromUpdateService(updateService);
                var installerSize = await GetInstallerSizeFromUrl(installerUrl);

                // Create AppInfo for update download with proper version and size
                var updateApp = new AppInfo
                {
                    Id = "drivebox-update",
                    TenHienThi = "Cập nhật DriveBox",
                    ThuMucCaiDat = "DriveBox Update",
                    PhienBan = updateInfo?.LatestVersion ?? "Không rõ",
                    TotalSize = installerSize,
                    IconPath = "pack://application:,,,/Assets/avt.png",
                    IsInstalled = false,
                    IsDownloading = false,
                    Status = "Đang chuẩn bị tải cập nhật..."
                };

                // Add to apps list temporarily for UI display
                WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                {
                    Apps.Insert(0, updateApp);
                    FilteredApps.Insert(0, updateApp);
                });

                // Create download item for update
                var downloadItem = new DownloadItem(updateApp);
                
                WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                {
                    ActiveDownloads.Add(downloadItem);
                    UpdateDownloadStatus();
                    OnPropertyChanged(nameof(ActiveDownloads));
                    OnPropertyChanged(nameof(HasActiveDownloads));
                    OnPropertyChanged(nameof(TotalActiveDownloads));
                });

                // Start update download
                updateApp.IsDownloading = true;
                updateApp.Status = "Đang chuẩn bị tải cập nhật...";
                StatusMessage = $"Đang tải cập nhật DriveBox... ({ActiveDownloads.Count} downloads)";

                // Create progress tracking
                var basicProgress = new Progress<int>(percentage =>
                {
                    WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                    {
                        updateApp.Status = $"Đang tải cập nhật... {percentage}%";
                        StatusMessage = $"Đang tải cập nhật DriveBox... {percentage}%";
                    });
                });

                var enhancedProgress = new EnhancedProgress<int>(
                    (percentage, progressInfo) =>
                    {
                        WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                        {
                            downloadItem.UpdateProgress(percentage, progressInfo);
                        });
                    });

                // Start download using already declared updateService
                var success = await Task.Run(async () => 
                    await updateService.DownloadAndInstallUpdateAsync(basicProgress, enhancedProgress, autoExit: true));

                // Handle completion
                WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                {
                    if (success)
                    {
                        updateApp.Status = "Cập nhật hoàn tất! Installer đã khởi động.";
                        StatusMessage = "Cập nhật DriveBox hoàn tất! Bạn có thể đóng ứng dụng để hoàn tất cài đặt.";
                        downloadItem.ProgressText = "Cập nhật hoàn tất!";
                        downloadItem.ProgressPercentage = 100;
                    }
                    else
                    {
                        updateApp.Status = "Cập nhật thất bại";
                        StatusMessage = "Không thể tải hoặc cài đặt cập nhật";
                        downloadItem.ProgressText = "Cập nhật thất bại";
                    }

                    updateApp.IsDownloading = false;
                    
                    // Remove from downloads after delay
                    RemoveCompletedDownload(downloadItem);
                    
                    // Remove from apps list after some time
                    _ = Task.Run(async () =>
                    {
                        await Task.Delay(5000);
                        WpfApplication.Current?.Dispatcher?.BeginInvoke(() =>
                        {
                            Apps.Remove(updateApp);
                            FilteredApps.Remove(updateApp);
                        });
                    });
                });
            }
            catch (Exception ex)
            {

                StatusMessage = $"Lỗi cập nhật: {ex.Message}";
            }
            finally
            {
                // Always reset update in progress flag
                IsUpdateInProgress = false;
            }
        }

        /// <summary>
        /// Helper method to get installer download URL from UpdateService
        /// </summary>
        private async Task<string> GetInstallerDownloadUrlFromUpdateService(UpdateService updateService)
        {
            try
            {
                // Use reflection to access private method GetInstallerDownloadUrlAsync
                var method = typeof(UpdateService).GetMethod("GetInstallerDownloadUrlAsync", 
                    System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                if (method != null)
                {
                    var task = (Task<string?>)method.Invoke(updateService, null)!;
                    return await task ?? string.Empty;
                }
                return string.Empty;
            }
            catch (Exception ex)
            {

                return string.Empty;
            }
        }

        /// <summary>
        /// Helper method to get installer size from download URL
        /// </summary>
        private async Task<long> GetInstallerSizeFromUrl(string url)
        {
            if (string.IsNullOrEmpty(url))
                return 0;

            try
            {
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Add("User-Agent", "DriveBox-SizeChecker");
                
                using var response = await httpClient.SendAsync(new HttpRequestMessage(HttpMethod.Head, url));
                response.EnsureSuccessStatusCode();
                
                return response.Content.Headers.ContentLength ?? 0;
            }
            catch (Exception ex)
            {

                return 0;
            }
        }

        public void Dispose()
        {
            _sessionSaveTimer?.Dispose();
            _sessionSaveTimer = null;
            GC.SuppressFinalize(this);
        }
    }
}