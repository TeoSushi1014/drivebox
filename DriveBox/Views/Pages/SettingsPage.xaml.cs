using DriveBox.ViewModels.Pages;
using Wpf.Ui.Abstractions.Controls;
using System.Windows;
using WpfClipboard = System.Windows.Clipboard;

namespace DriveBox.Views.Pages
{
    public partial class SettingsPage : INavigableView<SettingsViewModel>
    {
        public SettingsViewModel ViewModel { get; }

        public SettingsPage(SettingsViewModel viewModel)
        {
            ViewModel = viewModel;
            DataContext = this;

            InitializeComponent();
        }

        private void GithubIcon_Click(object sender, RoutedEventArgs e)
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("https://github.com/TeoSushi1014/drivebox") { UseShellExecute = true });
        }

        private void FacebookIcon_Click(object sender, RoutedEventArgs e)
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("https://www.facebook.com/boboiboy.gala.7/") { UseShellExecute = true });
        }

        private void ZaloIcon_Click(object sender, RoutedEventArgs e)
        {
            WpfClipboard.SetText("0838696697");
        }
    }
}
