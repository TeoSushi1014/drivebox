using System.Windows;
using System.Windows.Controls;
using Wpf.Ui.Controls;

namespace DriveBox.Services
{
    public class DialogService
    {
        private ContentPresenter? GetDialogHost()
        {
            var mainWindow = System.Windows.Application.Current.MainWindow;
            if (mainWindow is Views.Windows.MainWindow window)
            {
                return window.FindName("RootContentDialog") as ContentPresenter;
            }
            return null;
        }


        public async Task<ContentDialogResult> ShowInfoAsync(string title, string message)
        {
            var dialog = new ContentDialog
            {
                Title = title,
                Content = message,
                CloseButtonText = "OK",
                DefaultButton = ContentDialogButton.Close,
                DialogHost = GetDialogHost()
            };

            return await dialog.ShowAsync();
        }


        public async Task<ContentDialogResult> ShowConfirmationAsync(string title, string message, string primaryButtonText = "Có", string closeButtonText = "Không")
        {
            var dialog = new ContentDialog
            {
                Title = title,
                Content = message,
                PrimaryButtonText = primaryButtonText,
                CloseButtonText = closeButtonText,
                DefaultButton = ContentDialogButton.Close,
                DialogHost = GetDialogHost()
            };

            return await dialog.ShowAsync();
        }


        public async Task<ContentDialogResult> ShowErrorAsync(string title, string message)
        {
            var dialog = new ContentDialog
            {
                Title = title,
                Content = message,
                CloseButtonText = "OK",
                DefaultButton = ContentDialogButton.Close,
                DialogHost = GetDialogHost()
            };

            return await dialog.ShowAsync();
        }

        public async Task<ContentDialogResult> ShowSuccessAsync(string title, string message)
        {
            var dialog = new ContentDialog
            {
                Title = title,
                Content = message,
                CloseButtonText = "OK",
                DefaultButton = ContentDialogButton.Close,
                DialogHost = GetDialogHost()
            };

            return await dialog.ShowAsync();
        }


        public async Task<ContentDialogResult> ShowWarningAsync(string title, string message, string primaryButtonText = "Có", string closeButtonText = "Không")
        {
            var dialog = new ContentDialog
            {
                Title = title,
                Content = message,
                PrimaryButtonText = primaryButtonText,
                CloseButtonText = closeButtonText,
                DefaultButton = ContentDialogButton.Close,
                DialogHost = GetDialogHost()
            };

            return await dialog.ShowAsync();
        }


        public async Task<ContentDialogResult> ShowYesNoCancelAsync(string title, string message)
        {
            var dialog = new ContentDialog
            {
                Title = title,
                Content = message,
                PrimaryButtonText = "Có",
                SecondaryButtonText = "Không", 
                CloseButtonText = "Hủy",
                DefaultButton = ContentDialogButton.Close,
                DialogHost = GetDialogHost()
            };

            return await dialog.ShowAsync();
        }


        public static bool IsPositiveResult(ContentDialogResult result)
        {
            return result == ContentDialogResult.Primary;
        }


        public static bool IsYesResult(ContentDialogResult result)
        {
            return result == ContentDialogResult.Primary;
        }
    }
}