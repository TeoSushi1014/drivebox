using System.IO;
using System.Reflection;
using System.Windows.Threading;
using DriveBox.Models;
using DriveBox.Services;

using DriveBox.ViewModels.Pages;
using DriveBox.ViewModels.Windows;
using DriveBox.Views.Pages;
using DriveBox.Views.Windows;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Wpf.Ui;
using Wpf.Ui.Abstractions;
using Wpf.Ui.DependencyInjection;

namespace DriveBox
{
    public partial class App
    {
        private static readonly CancellationTokenSource _applicationCancellation = new();
        public static CancellationToken ApplicationCancellation => _applicationCancellation.Token;
        

        public static bool IsReadyToShowMainWindow { get; private set; } = false;
        public static event Action? ReadyToShowMainWindow;

        private static readonly IHost _host = Host
            .CreateDefaultBuilder()
            .ConfigureAppConfiguration(c => { c.SetBasePath(Path.GetDirectoryName(AppContext.BaseDirectory) ?? AppContext.BaseDirectory); })
            .ConfigureServices((context, services) =>
            {
                services.AddNavigationViewPageProvider();

                services.AddHostedService<ApplicationHostService>();

                services.AddSingleton<IThemeService, ThemeService>();

                services.AddSingleton<ITaskBarService, TaskBarService>();

                services.AddSingleton<INavigationService, NavigationService>();
                services.AddSingleton<UpdateService>();
                    
                services.AddSingleton<AppConfigService>();
                services.AddSingleton<SmartCacheService>();

                services.AddSingleton<Lazy<AppCatalogService>>(provider => 
                    new Lazy<AppCatalogService>(() => new AppCatalogService()));
                    
                services.AddSingleton<AppCatalogService>(provider => 
                    provider.GetRequiredService<Lazy<AppCatalogService>>().Value);
                    

                    
                services.AddSingleton<Lazy<CrashRecoveryService>>(provider => 
                    new Lazy<CrashRecoveryService>(() => new CrashRecoveryService(
                        provider.GetRequiredService<AppConfigService>())));
                    
                services.AddSingleton<CrashRecoveryService>(provider => 
                    provider.GetRequiredService<Lazy<CrashRecoveryService>>().Value);


                services.AddSingleton<DriveBox.Services.Download.DownloadService>(provider =>
                    new DriveBox.Services.Download.DownloadService(
                        provider.GetRequiredService<AppConfigService>(),
                        provider.GetRequiredService<WindowsRegistrationService>()));


                services.AddSingleton<DialogService>();
                services.AddSingleton<ShortcutService>();
                services.AddSingleton<WindowsRegistrationService>();
                services.AddSingleton<MainWindowViewModel>();


                                services.AddSingleton<Lazy<DashboardViewModel>>(provider => 
                    new Lazy<DashboardViewModel>(() => new DashboardViewModel(
                        provider.GetRequiredService<AppCatalogService>(),
                        provider.GetRequiredService<AppConfigService>(),
                        provider.GetRequiredService<CrashRecoveryService>(),
                        provider.GetRequiredService<DriveBox.Services.Download.DownloadService>(),
                        provider.GetRequiredService<DialogService>(),
                        provider.GetRequiredService<ShortcutService>(),
                        provider.GetRequiredService<WindowsRegistrationService>())));  
                        
                services.AddSingleton<DashboardViewModel>(provider => 
                    provider.GetRequiredService<Lazy<DashboardViewModel>>().Value);
                        
                services.AddSingleton<INavigationWindow, MainWindow>(provider =>
                    new MainWindow(
                        provider.GetRequiredService<MainWindowViewModel>(),
                        provider.GetRequiredService<Lazy<DashboardViewModel>>(),
                        provider.GetRequiredService<INavigationViewPageProvider>(),
                        provider.GetRequiredService<INavigationService>()));
                        
                services.AddSingleton<DashboardPage>(provider => 
                    new DashboardPage { DataContext = provider.GetRequiredService<Lazy<DashboardViewModel>>().Value });
                services.AddSingleton<DataPage>();
                services.AddSingleton<DataViewModel>();
                services.AddSingleton<SettingsPage>();
                services.AddSingleton<SettingsViewModel>(provider => 
                    new SettingsViewModel(
                        provider.GetRequiredService<UpdateService>(),
                        provider.GetRequiredService<AppConfigService>()));
            }).Build();


        public static IServiceProvider Services
        {
            get { return _host.Services; }
        }

        private static SplashWindow? _splashWindow;
        private static UpdateInfo? _pendingUpdateInfo;


        private async void OnStartup(object sender, StartupEventArgs e)
        {
            try
            {

                _splashWindow = new SplashWindow();
                _splashWindow.Show();

                _splashWindow.UpdateStatus("Khởi tạo services");
                

                await _host.StartAsync();


                _splashWindow.UpdateStatus("Đang tải dữ liệu");
                await Task.Delay(1000);


                _splashWindow.UpdateStatus("Kiểm tra cập nhật");
                bool hasUpdate = false;
                try
                {
                    hasUpdate = await CheckForUpdatesAsync();
                }
                catch (Exception)
                {

                }


                _splashWindow.UpdateStatus("Khởi động hoàn tất");
                await Task.Delay(800);


                IsReadyToShowMainWindow = true;
                ReadyToShowMainWindow?.Invoke();


                await Task.Delay(500);
                _splashWindow?.CloseSplash();


                if (_pendingUpdateInfo != null)
                {
                    await ShowUpdateDialogAsync(_pendingUpdateInfo);
                    _pendingUpdateInfo = null;
                }
            }
            catch (Exception)
            {
                _splashWindow?.CloseSplash();
                throw;
            }
        }

        /// <summary>
        /// Auto-check for updates on startup
        /// </summary>
        private async Task<bool> CheckForUpdatesAsync()
        {
            try
            {
                var updateService = _host.Services.GetRequiredService<UpdateService>();
                var updateInfo = await updateService.CheckForUpdatesAsync();

                if (updateInfo?.IsUpdateAvailable == true)
                {

                    _pendingUpdateInfo = updateInfo;
                    return true;
                }
                
                return false;
            }
            catch (Exception)
            {

                return false;
            }
        }

        /// <summary>
        /// Show progress during update download from startup
        /// </summary>
        private async Task ShowUpdateProgressAsync()
        {
            try
            {
                await System.Windows.Application.Current.Dispatcher.InvokeAsync(async () =>
                {
                    var dialogService = _host.Services.GetRequiredService<DialogService>();
                    
                    // Show initial progress dialog
                    var progressTask = dialogService.ShowInfoAsync(
                        "Đang tải cập nhật", 
                        "Đang chuẩn bị tải xuống cập nhật...\n\nVui lòng đợi trong giây lát.");

                    // Start the download in background
                    var updateService = _host.Services.GetRequiredService<UpdateService>();
                    
                    var downloadTask = Task.Run(async () =>
                    {
                        try
                        {
                            // Create a progress reporter that updates the UI
                            var progress = new Progress<int>(percentage =>
                            {
                
                                
                                // Update the status message through dispatcher
                                System.Windows.Application.Current.Dispatcher.BeginInvoke(() =>
                                {
                                    // Unfortunately, we can't easily update the dialog content dynamically
                                    // The debug output will show progress, and the download should complete shortly
                                });
                            });

                            var success = await updateService.DownloadAndInstallUpdateAsync(progress, autoExit: true);
                            
                            if (!success)
                            {
                                // Show error on UI thread
                                await System.Windows.Application.Current.Dispatcher.InvokeAsync(async () =>
                                {
                                    await dialogService.ShowInfoAsync(
                                        "Lỗi cập nhật",
                                        "Không thể tải xuống hoặc cài đặt cập nhật.\n\nVui lòng thử lại sau hoặc tải xuống thủ công từ GitHub.");
                                });
                            }
                        }
                        catch (Exception ex)
                        {
            
                            
                            // Show error on UI thread
                            await System.Windows.Application.Current.Dispatcher.InvokeAsync(async () =>
                            {
                                await dialogService.ShowInfoAsync(
                                    "Lỗi cập nhật",
                                    $"Đã xảy ra lỗi khi tải cập nhật:\n\n{ex.Message}\n\nVui lòng thử lại sau hoặc tải xuống thủ công từ GitHub.");
                            });
                        }
                    });

                    // Wait for both tasks (this allows the progress dialog to show while download happens)
                    await Task.WhenAny(progressTask, downloadTask);
                    
                    // If download completes first, we'll let the download's success/error handling take over
                    // If user closes dialog first, download continues in background
                });
            }
            catch (Exception ex)
            {

            }
        }

        /// <summary>
        /// Show update dialog after splash screen closes
        /// </summary>
        private async Task ShowUpdateDialogAsync(UpdateInfo updateInfo)
        {
            try
            {
                await System.Windows.Application.Current.Dispatcher.InvokeAsync(async () =>
                {
                    var dialogService = _host.Services.GetRequiredService<DialogService>();
                    
                    var message = $"Phiên bản mới {updateInfo.LatestVersion} đã có sẵn!\n" +
                                 $"Phiên bản hiện tại: {updateInfo.CurrentVersion}\n\n" +
                                 "Bạn có muốn tải và cài đặt ngay bây giờ không?";

                    var result = await dialogService.ShowConfirmationAsync(
                        "Cập nhật mới có sẵn", 
                        message,
                        "Tải cập nhật", "Để sau");

                    if (result == Wpf.Ui.Controls.ContentDialogResult.Primary)
                    {
                        // Use existing download progress system
                        StartUpdateDownload();
                    }
                });
            }
            catch (Exception)
            {
            }
        }

        /// <summary>
        /// Start update download using existing download system
        /// </summary>
        private void StartUpdateDownload()
        {
            try
            {
                // Get DashboardViewModel and start update download
                var dashboardViewModel = _host.Services.GetService<ViewModels.Pages.DashboardViewModel>();
                if (dashboardViewModel != null)
                {
                    _ = dashboardViewModel.StartUpdateDownloadAsync();
                }
                else
                {
    
                }
            }
            catch (Exception ex)
            {

            }
        }

        private async void OnExit(object sender, ExitEventArgs e)
        {
            try
            {

                _applicationCancellation.Cancel();

                await Task.Delay(500);
                

                try
                {
                    var dashboardViewModel = _host.Services.GetService<DashboardViewModel>();
                    dashboardViewModel?.Dispose();

                }
                catch (Exception)
                {

                }
                

                await _host.StopAsync(TimeSpan.FromSeconds(2));
                _host.Dispose();
                

                _applicationCancellation.Dispose();
                

            }
            catch (Exception)
            {

                Environment.Exit(0);
            }
        }


        private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
        {
            try
            {

                var errorMessage = $"Unhandled exception: {e.Exception.Message}\nStackTrace: {e.Exception.StackTrace}";

                LogCrashToFile(e.Exception);
                

                var canRecover = AttemptGracefulRecovery(e.Exception);
                
                if (canRecover)
                {

                    e.Handled = true;
                    

                    if (Current?.MainWindow != null)
                    {
                        Current.Dispatcher.BeginInvoke(() =>
                        {
                            var dialogService = Services.GetService<DialogService>();
                            _ = dialogService?.ShowInfoAsync(
                                "Khôi phục tự động",
                                "Ứng dụng đã gặp lỗi nhưng đã được khôi phục tự động.\n\n" +
                                                "Session của bạn vẫn được lưu\n" +
                "Bạn có thể tiếp tục sử dụng bình thường\n\n" +
                                "Nếu vấn đề tiếp tục xảy ra, hãy khởi động lại ứng dụng.");
                        });
                    }
                }
                else
                {

                    PrepareControlledShutdown(e.Exception);
                    e.Handled = false;
                }
            }
            catch (Exception)
            {

                e.Handled = false;
            }
        }
        
        private void LogCrashToFile(Exception exception)
        {
            try
            {
                var logPath = Path.Combine(AppContext.BaseDirectory, "crash.log");
                var logEntry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] CRASH: {exception.Message}\n" +
                              $"Type: {exception.GetType().Name}\n" +
                              $"StackTrace: {exception.StackTrace}\n" +
                              $"InnerException: {exception.InnerException?.Message}\n" +
                              new string('=', 80) + "\n";
                
                File.AppendAllText(logPath, logEntry);
            }
            catch
            {

            }
        }
        
        private bool AttemptGracefulRecovery(Exception exception)
        {
            try
            {

                if (exception is OutOfMemoryException || 
                    exception.Message.Contains("memory") ||
                    exception.Message.Contains("Memory"))
                {
                    GC.Collect(2, GCCollectionMode.Forced);
                    GC.WaitForPendingFinalizers();
                    GC.Collect(2, GCCollectionMode.Forced);

                    return true;
                }
                

                if (exception is System.Runtime.InteropServices.COMException comEx && 
                    (comEx.Message.Contains("UCEERR_RENDERTHREADFAILURE") || comEx.HResult == unchecked((int)0x88980406)))
                {

                    GC.Collect();
                    return true;
                }
                

                if (exception is InvalidOperationException invalidOpEx && 
                    invalidOpEx.Message.Contains("render thread"))
                {

                    return true;
                }
                

                if (exception.StackTrace?.Contains("SyncFlush") == true ||
                    exception.StackTrace?.Contains("NotifyPartitionIsZombie") == true ||
                    exception.StackTrace?.Contains("WaitForNextMessage") == true ||
                    exception.StackTrace?.Contains("SynchronizeChannel") == true)
                {

                    return true;
                }
                

                if (exception.StackTrace?.Contains("System.Windows") == true ||
                    exception.StackTrace?.Contains("Dispatcher") == true ||
                    exception.StackTrace?.Contains("PresentationFramework") == true ||
                    exception.StackTrace?.Contains("PresentationCore") == true)
                {

                    return true;
                }
                

                

                if (exception is IOException || 
                    exception is UnauthorizedAccessException ||
                    exception.Message.Contains("file") ||
                    exception.Message.Contains("directory"))
                {

                    return true;
                }
                

                if (exception.Message.Contains("network") ||
                    exception.Message.Contains("connection") ||
                    exception.Message.Contains("timeout") ||
                    exception is System.Net.Http.HttpRequestException ||
                    exception is TaskCanceledException)
                {

                    return true;
                }
                

                if (exception is StackOverflowException ||
                    exception is AccessViolationException ||
                    exception is InvalidOperationException && exception.Message.Contains("cross-thread"))
                {

                    return false;
                }
                

                return true;
            }
            catch
            {
                return false;
            }
        }
        
        private void PrepareControlledShutdown(Exception exception)
        {
            try
            {

                var configService = Services.GetService<AppConfigService>();
                configService?.SaveConfig();
                

            }
            catch (Exception)
            {

            }
        }


    }
}
