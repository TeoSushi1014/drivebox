using System;
using System.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace DriveBox.Models.Download
{

    public partial class DownloadItem : ObservableObject
    {
        [ObservableProperty]
        private string _appName = string.Empty;

        [ObservableProperty]
        private string _appTitle = string.Empty;

        [ObservableProperty]
        private double _progressPercentage = 0.0;

        [ObservableProperty]
        private string _progressText = "Đang khởi tạo...";

        [ObservableProperty]
        private string _downloadSpeed = "-- B/s";

        [ObservableProperty]
        private string _estimatedTimeRemaining = "-- còn lại";

        [ObservableProperty]
        private string _sizeInformation = "-- / --";

        [ObservableProperty]
        private string _currentFileName = string.Empty;

        [ObservableProperty]
        private bool _canCancel = true;

        [ObservableProperty]
        private bool _isPaused = false;

        [ObservableProperty]
        private bool _canPauseResume = true;

        [ObservableProperty]
        private bool _isCompleted = false;

        [ObservableProperty]
        private bool _isFailed = false;

        public string Id { get; }
        public CancellationTokenSource CancellationTokenSource { get; }
        public AppInfo AppInfo { get; }
        
        private readonly ManualResetEventSlim _pauseResetEvent = new(true);

        public IRelayCommand CancelCommand { get; }
        public IRelayCommand PauseResumeCommand { get; }

        public DownloadItem(AppInfo appInfo)
        {
            Id = Guid.NewGuid().ToString();
            AppInfo = appInfo ?? throw new ArgumentNullException(nameof(appInfo));
            AppName = appInfo.TenHienThi;
            AppTitle = appInfo.TenHienThi;
            CancellationTokenSource = new CancellationTokenSource();

            CancelCommand = new RelayCommand(Cancel, () => CanCancel);
            PauseResumeCommand = new RelayCommand(PauseResume, () => CanPauseResume);
        }

        public void UpdateProgress(int percentage, DownloadProgressInfo progressInfo)
        {
            ProgressPercentage = percentage;
            DownloadSpeed = progressInfo.FormattedSpeed;
            EstimatedTimeRemaining = progressInfo.FormattedEta;
            SizeInformation = progressInfo.FormattedSize;
            CurrentFileName = progressInfo.CurrentFileName;

            if (percentage >= 100)
            {
                ProgressText = "Đang xử lý...";
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
        }

        public void Complete(bool success = true)
        {
            IsCompleted = true;
            IsFailed = !success;
            CanCancel = false;
            CanPauseResume = false;
            ProgressPercentage = 100;

            if (success)
            {
                ProgressText = "Cài đặt thành công";
                DownloadSpeed = "Completed";
                EstimatedTimeRemaining = "Hoàn tất";
            }
            else
            {
                ProgressText = "Cài đặt thất bại";
            }

            CancelCommand.NotifyCanExecuteChanged();
            PauseResumeCommand.NotifyCanExecuteChanged();
        }

        private void Cancel()
        {
            if (CanCancel)
            {

                if (IsPaused)
                {

                    _pauseResetEvent.Set();
                    IsPaused = false;
                }
                
                CancellationTokenSource.Cancel();
                CanCancel = false;
                CanPauseResume = false;
                ProgressText = "Đang hủy...";
                CancelCommand.NotifyCanExecuteChanged();
                PauseResumeCommand.NotifyCanExecuteChanged();
            }
        }

        private void PauseResume()
        {

            
            if (CanPauseResume)
            {
                IsPaused = !IsPaused;
                if (IsPaused)
                {
                    ProgressText = "Đã tạm dừng";
                    _pauseResetEvent.Reset();
                }
                else
                {
                    ProgressText = "Đang tiếp tục...";
                    _pauseResetEvent.Set();
                }
                PauseResumeCommand.NotifyCanExecuteChanged();
            }
            else
            {

            }
        }
        

        public async Task WaitIfPausedAsync(CancellationToken cancellationToken = default)
        {
            if (IsPaused && !cancellationToken.IsCancellationRequested)
            {

                try
                {
                    await Task.Run(() => _pauseResetEvent.Wait(cancellationToken), cancellationToken);

                }
                catch (OperationCanceledException)
                {
                    _pauseResetEvent.Set();
                    throw;
                }
            }
        }
        

        public void WaitIfPaused(CancellationToken cancellationToken = default)
        {
            if (IsPaused && !cancellationToken.IsCancellationRequested)
            {

                try
                {
                    _pauseResetEvent.Wait(cancellationToken);

                }
                catch (OperationCanceledException)
                {
                    _pauseResetEvent.Set();
                    throw;
                }
            }
        }

        public void Dispose()
        {
            CancellationTokenSource?.Dispose();
            _pauseResetEvent?.Dispose();
        }
    }
}