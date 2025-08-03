using System.Windows;
using System.Linq;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using DriveBox.Models.Download;
using System.Threading;
using System;
using Wpf.Ui.Controls;

namespace DriveBox.Views.Windows
{

    public partial class DownloadProgressWindow : FluentWindow
    {
        public DownloadProgressWindow()
        {
            InitializeComponent();
            DataContext = new DownloadProgressViewModel();
        }

        public DownloadProgressWindow(string appTitle) : this()
        {
            ((DownloadProgressViewModel)DataContext).AppTitle = appTitle;
        }

        public DownloadProgressViewModel ViewModel => (DownloadProgressViewModel)DataContext;

        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {

            ViewModel.OnWindowClosing();
            base.OnClosing(e);
        }
    }


    public partial class DownloadProgressViewModel : ObservableObject
    {
        private CancellationTokenSource? _cancellationTokenSource;

        [ObservableProperty]
        private string _appTitle = "Đang tải xuống";

        [ObservableProperty]
        private string _currentStatus = "Đang chuẩn bị...";

        [ObservableProperty]
        private string _progressText = "Đang khởi tạo...";

        [ObservableProperty]
        private double _progressPercentage = 0.0;

        [ObservableProperty]
        private string _progressPercentageText = "0%";

        [ObservableProperty]
        private string _downloadSpeed = "-- B/s";

        [ObservableProperty]
        private string _estimatedTimeRemaining = "-- remaining";

        [ObservableProperty]
        private string _sizeInformation = "-- / --";

        [ObservableProperty]
        private string _averageSpeed = "Avg: -- B/s";

        [ObservableProperty]
        private string _currentModule = string.Empty;

        [ObservableProperty]
        private string _currentFileName = string.Empty;

        [ObservableProperty]
        private bool _canCancel = true;

        public CancellationToken CancellationToken => _cancellationTokenSource?.Token ?? CancellationToken.None;

        public DownloadProgressViewModel()
        {
            InitializeCommands();
        }

        private void InitializeCommands()
        {
            CancelCommand = new RelayCommand(OnCancel, () => CanCancel);
        }

        public IRelayCommand CancelCommand { get; private set; } = null!;


        public void SetCancellationTokenSource(CancellationTokenSource cancellationTokenSource)
        {
            _cancellationTokenSource = cancellationTokenSource;
            CanCancel = true;
        }


        public void UpdateProgress(int percentage, DownloadProgressInfo progressInfo)
        {
            System.Windows.Application.Current?.Dispatcher?.BeginInvoke(() =>
            {
                ProgressPercentage = percentage;
                ProgressPercentageText = $"{percentage}%";
                
                CurrentStatus = progressInfo.StatusMessage;
                CurrentModule = progressInfo.CurrentModule;
                CurrentFileName = progressInfo.CurrentFileName;
                
                DownloadSpeed = progressInfo.FormattedSpeed;
                EstimatedTimeRemaining = progressInfo.FormattedEta;
                SizeInformation = progressInfo.FormattedSize;
                AverageSpeed = $"Avg: {progressInfo.FormattedAverageSpeed}";
                

                if (percentage >= 100)
                {
                    ProgressText = "Đang xử lý...";
                    CurrentStatus = "Hoàn tất tải xuống, đang cài đặt...";
                }
                else if (percentage > 0)
                {
                    ProgressText = string.IsNullOrEmpty(progressInfo.CurrentModule) 
                        ? "Đang tải xuống..." 
                        : $"Đang tải {progressInfo.CurrentModule}...";
                }
                else
                {
                    ProgressText = "Đang khởi tạo...";
                }
            });
        }


        public void UpdateProgress(int percentage, string status = "")
        {
            System.Windows.Application.Current?.Dispatcher?.BeginInvoke(() =>
            {
                ProgressPercentage = percentage;
                ProgressPercentageText = $"{percentage}%";
                
                if (!string.IsNullOrEmpty(status))
                {
                    CurrentStatus = status;
                }
            });
        }


        public void Complete(bool success = true)
        {
            System.Windows.Application.Current?.Dispatcher?.BeginInvoke(() =>
            {
                CanCancel = false;
                ProgressPercentage = 100;
                ProgressPercentageText = "100%";
                
                if (success)
                {
                    CurrentStatus = "Hoàn tất";
                    ProgressText = "Cài đặt thành công";
                    DownloadSpeed = "Completed";
                    EstimatedTimeRemaining = "Completed";
                }
                else
                {
                    CurrentStatus = "Có lỗi xảy ra";
                    ProgressText = "Cài đặt thất bại";
                }


                if (success)
                {
                    _ = Task.Run(async () =>
                    {
                        await Task.Delay(2000);
                        System.Windows.Application.Current?.Dispatcher?.BeginInvoke(() =>
                        {
                            if (System.Windows.Application.Current?.MainWindow != null)
                            {
                                var window = System.Windows.Application.Current.Windows.OfType<DownloadProgressWindow>().FirstOrDefault();
                                window?.Close();
                            }
                        });
                    });
                }
            });
        }


        private void OnCancel()
        {
            if (CanCancel)
            {
                // Run cancellation in background to avoid UI freeze
                _ = Task.Run(() =>
                {
                    try
                    {
                        _cancellationTokenSource?.Cancel();
                    }
                    catch (Exception ex)
                    {
        
                    }
                });
                
                // Update UI immediately
                CanCancel = false;
                CurrentStatus = "Đang hủy...";
                ProgressText = "Hủy tải xuống";
                
                // Close window after a short delay to allow cleanup
                _ = Task.Run(async () =>
                {
                    await Task.Delay(1000); // Give time for cleanup
                    System.Windows.Application.Current?.Dispatcher?.BeginInvoke(() =>
                    {
                        try
                        {
                            var window = System.Windows.Application.Current?.Windows.OfType<DownloadProgressWindow>().FirstOrDefault();
                            window?.Close();
                        }
                        catch (Exception ex)
                        {
            
                        }
                    });
                });
            }
        }


        public void OnWindowClosing()
        {
            // Run cancellation in background to avoid blocking window close
            _ = Task.Run(() =>
            {
                try
                {
                    _cancellationTokenSource?.Cancel();
                }
                catch (Exception ex)
                {
    
                }
            });
        }
    }
}