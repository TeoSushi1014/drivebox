using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using DriveBox.Services;

namespace DriveBox.Views.Windows
{
    
    public partial class RepairProgressWindow : INotifyPropertyChanged
    {
        private string _windowTitle = "Sửa chữa ứng dụng";
        private string _currentAction = "Đang chuẩn bị...";
        private string _progressDetails = "";
        private string _currentFileInfo = "";
        private string _speedInfo = "";
        private string _etaInfo = "";
        private double _progressPercentage = 0;
        private bool _canCancel = false;
        private CancellationTokenSource? _cancellationTokenSource;

        public RepairProgressWindow()
        {
            InitializeComponent();
            DataContext = this;
        }

        public string WindowTitle
        {
            get => _windowTitle;
            set => SetProperty(ref _windowTitle, value);
        }

        public string CurrentAction
        {
            get => _currentAction;
            set => SetProperty(ref _currentAction, value);
        }

        public string ProgressDetails
        {
            get => _progressDetails;
            set => SetProperty(ref _progressDetails, value);
        }

        public double ProgressPercentage
        {
            get => _progressPercentage;
            set => SetProperty(ref _progressPercentage, value);
        }

        public bool CanCancel
        {
            get => _canCancel;
            set => SetProperty(ref _canCancel, value);
        }

        public string CurrentFileInfo
        {
            get => _currentFileInfo;
            set => SetProperty(ref _currentFileInfo, value);
        }

        public string SpeedInfo
        {
            get => _speedInfo;
            set => SetProperty(ref _speedInfo, value);
        }

        public string EtaInfo
        {
            get => _etaInfo;
            set => SetProperty(ref _etaInfo, value);
        }

        public CancellationToken CancellationToken => _cancellationTokenSource?.Token ?? CancellationToken.None;

        public void SetCancellationTokenSource(CancellationTokenSource cancellationTokenSource)
        {
            _cancellationTokenSource = cancellationTokenSource;
            CanCancel = true;
        }

        public void UpdateProgress(string action, string details, double percentage)
        {
            Dispatcher.BeginInvoke(() =>
            {
                CurrentAction = action;
                ProgressDetails = details;
                ProgressPercentage = percentage;
            });
        }

        public void UpdateDetailedProgress(string action, string details, double percentage, 
            string currentFile = "", string speed = "", string eta = "")
        {
            Dispatcher.BeginInvoke(() =>
            {
                CurrentAction = action;
                ProgressDetails = details;
                ProgressPercentage = percentage;
                CurrentFileInfo = currentFile;
                SpeedInfo = speed;
                EtaInfo = eta;
            });
        }

        public void Complete(bool success)
        {
            Dispatcher.BeginInvoke(() =>
            {
                CanCancel = false;
                ProgressPercentage = 100;
                
                if (success)
                {
                    CurrentAction = "Hoàn tất";
                    ProgressDetails = "Sửa chữa đã hoàn thành thành công.";
                }
                else
                {
                    CurrentAction = "Đã hoàn tất với một số vấn đề";
                    ProgressDetails = "Sửa chữa hoàn tất nhưng có thể vẫn thiếu một số thành phần.";
                }

    
                Task.Delay(1500).ContinueWith(_ =>
                {
                    Dispatcher.BeginInvoke(() =>
                    {
                        DialogResult = success;
                        Close();
                    });
                });
            });
        }

        private void CancelButton_Click(object sender, RoutedEventArgs e)
        {
            if (_cancellationTokenSource != null && !_cancellationTokenSource.Token.IsCancellationRequested)
            {

                var result = System.Windows.MessageBox.Show(
                    "Bạn có chắc chắn muốn hủy quá trình sửa chữa?\n\nViệc hủy có thể khiến ứng dụng ở trạng thái không hoàn chỉnh.",
                    "Xác nhận hủy",
                    System.Windows.MessageBoxButton.YesNo,
                    System.Windows.MessageBoxImage.Question);

                if (result == System.Windows.MessageBoxResult.Yes)
                {
                    _cancellationTokenSource.Cancel();
                    CanCancel = false;
                    CurrentAction = "Đang hủy...";
                    ProgressDetails = "Đang dừng quá trình sửa chữa...";
                }
            }
        }

        protected override void OnClosing(CancelEventArgs e)
        {
    
            if (_canCancel)
            {
                e.Cancel = true;
                CancelButton_Click(this, new RoutedEventArgs());
            }
            else
            {
                base.OnClosing(e);
            }
        }

        public event PropertyChangedEventHandler? PropertyChanged;

        protected virtual void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

        protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
        {
            if (EqualityComparer<T>.Default.Equals(field, value)) return false;
            field = value;
            OnPropertyChanged(propertyName);
            return true;
        }
    }
}