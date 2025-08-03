using System.Windows;
using System.Windows.Threading;

namespace DriveBox.Views.Windows
{
    public partial class SplashWindow : Window
    {
        private readonly DispatcherTimer _timer;
        private int _dotCount = 0;
        private string _baseMessage;

        public SplashWindow()
        {
            InitializeComponent();
            _baseMessage = "Đang khởi động";
            
    
            _timer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(500)
            };
            _timer.Tick += Timer_Tick;
            _timer.Start();
        }

        private void Timer_Tick(object? sender, EventArgs e)
        {
            _dotCount = (_dotCount + 1) % 4;
            var dots = new string('.', _dotCount);
            StatusText.Text = _baseMessage + dots;
        }

        public void UpdateStatus(string message)
        {
            Dispatcher.BeginInvoke(() =>
            {
                _baseMessage = message;
                StatusText.Text = message;
            });
        }

        public void CloseSplash()
        {
            Dispatcher.BeginInvoke(() =>
            {
                _timer?.Stop();
                this.Close();
            });
        }

        protected override void OnClosed(EventArgs e)
        {
            _timer?.Stop();
            base.OnClosed(e);
        }
    }
}