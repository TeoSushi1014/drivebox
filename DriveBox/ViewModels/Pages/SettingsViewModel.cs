using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Wpf.Ui.Abstractions.Controls;
using Wpf.Ui.Appearance;
using DriveBox.Services;
using DriveBox.Models;
using System.IO;
using System.Windows;
using Microsoft.Win32;
using WpfClipboard = System.Windows.Clipboard;

namespace DriveBox.ViewModels.Pages
{
    public partial class SettingsViewModel : ObservableObject, INavigationAware
    {
        private bool _isInitialized = false;
        private readonly UpdateService _updateService;
        private readonly AppConfigService _configService;

        [ObservableProperty]
        private string _appVersion = String.Empty;

        [ObservableProperty]
        private ApplicationTheme _currentTheme = ApplicationTheme.Unknown;

        [ObservableProperty]
        private bool _isUpdateAvailable = false;

        [ObservableProperty]
        private string _updateStatus = string.Empty;

        [ObservableProperty]
        private bool _isCheckingForUpdates = false;

        [ObservableProperty]
        private bool _isDownloadingUpdate = false;

        [ObservableProperty]
        private bool _showProgressBar = false;

        [ObservableProperty]
        private double _updateProgress = 0;

        [ObservableProperty]
        private string _downloadPath = string.Empty;

        /// <summary>
        /// Property to enable/disable all UI elements during update downloads
        /// </summary>
        [ObservableProperty]
        private bool _isUiEnabled = true;

        public SettingsViewModel(UpdateService updateService, AppConfigService configService)
        {
            _updateService = updateService;
            _configService = configService;
        }

        public Task OnNavigatedToAsync()
        {
            if (!_isInitialized)
                InitializeViewModel();

            return Task.CompletedTask;
        }

        public Task OnNavigatedFromAsync() => Task.CompletedTask;

        private void InitializeViewModel()
        {
            CurrentTheme = ApplicationThemeManager.GetAppTheme();
            AppVersion = $"DriveBox - {GetAssemblyVersion()}";
            DownloadPath = _configService.GetConfig().DownloadPath;

            _isInitialized = true;
        }

        [RelayCommand]
        private async Task CheckForUpdatesAsync()
        {
            if (IsCheckingForUpdates) return;

            IsCheckingForUpdates = true;
            UpdateStatus = "Checking for updates...";

            try
            {
                var updateInfo = await _updateService.CheckForUpdatesAsync();

                if (updateInfo == null)
                {
                    UpdateStatus = "Failed to check for updates";
                    return;
                }

                if (updateInfo.IsUpdateAvailable)
                {
                    IsUpdateAvailable = true;
                    UpdateStatus = $"Update available: v{updateInfo.LatestVersion}";
                }
                else
                {
                    IsUpdateAvailable = false;
                    UpdateStatus = "You have the latest version";
                }
            }
            catch (Exception)
            {
                UpdateStatus = "Error checking for updates";

            }
            finally
            {
                IsCheckingForUpdates = false;
            }
        }

        [RelayCommand]
        private async Task DownloadAndInstallUpdateAsync()
        {
            if (IsDownloadingUpdate) return;

            IsDownloadingUpdate = true;
            IsUiEnabled = false; // Disable all UI during update
            ShowProgressBar = true;
            UpdateProgress = 0;
            UpdateStatus = "Preparing to download update...";

            try
            {
                var progress = new Progress<int>(percentage =>
                {
                    UpdateProgress = percentage;
                    UpdateStatus = $"Downloading update... {percentage}%";
                });

                // Manual updates from Settings should auto-exit when complete
                var success = await _updateService.DownloadAndInstallUpdateAsync(progress, autoExit: true);

                if (success)
                {
                    UpdateProgress = 100;
                    UpdateStatus = "Update downloaded successfully. Installing...";
                }
                else
                {
                    UpdateStatus = "Failed to download or install update";
                }
            }
            catch (Exception)
            {
                UpdateStatus = "Error during update process";
            }
            finally
            {
                IsDownloadingUpdate = false;
                IsUiEnabled = true; // Re-enable UI
                ShowProgressBar = false;
                UpdateProgress = 0;
            }
        }

        [RelayCommand]
        private void OpenGitHubReleases()
        {
            _updateService.OpenGitHubReleases();
        }

        private string GetAssemblyVersion()
        {
            return System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString()
                ?? String.Empty;
        }

        [RelayCommand]
        private void OnChangeTheme(string parameter)
        {
            switch (parameter)
            {
                case "theme_light":
                    if (CurrentTheme == ApplicationTheme.Light)
                        break;

                    ApplicationThemeManager.Apply(ApplicationTheme.Light);
                    CurrentTheme = ApplicationTheme.Light;

                    break;

                default:
                    if (CurrentTheme == ApplicationTheme.Dark)
                        break;

                    ApplicationThemeManager.Apply(ApplicationTheme.Dark);
                    CurrentTheme = ApplicationTheme.Dark;

                    break;
            }
        }
        [ObservableProperty]
        private string _zaloPhoneNumber = "0838696697";

        [ObservableProperty]
        private Visibility _zaloCopiedVisibility = Visibility.Collapsed;

        [RelayCommand]
        private async Task CopyZaloPhoneNumberAsync()
        {
            try
            {
                WpfClipboard.Clear();
                WpfClipboard.SetText(ZaloPhoneNumber);
            }
            catch (Exception)
            {
            }

            if (ZaloCopiedVisibility == Visibility.Visible)
                return;

            ZaloCopiedVisibility = Visibility.Visible;

            await Task.Delay(2000);

            ZaloCopiedVisibility = Visibility.Collapsed;
        }

        [RelayCommand]
        private void BrowseDownloadPath()
        {
            var dialog = new System.Windows.Forms.FolderBrowserDialog
            {
                Description = "Chọn thư mục tải xuống mặc định",
                SelectedPath = DownloadPath,
                ShowNewFolderButton = true
            };

            if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK)
            {
                var selectedPath = dialog.SelectedPath;
                _configService.UpdateDownloadPath(selectedPath);
                DownloadPath = _configService.GetConfig().DownloadPath;
            }
        }

        [RelayCommand]
        private void ResetDownloadPath()
        {
            var defaultPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                "TeoSushi",
                "DriveBox"
            );
            
            _configService.UpdateDownloadPath(defaultPath);
            DownloadPath = _configService.GetConfig().DownloadPath;
        }
    }
}
