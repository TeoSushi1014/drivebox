using DriveBox.ViewModels.Windows;
using DriveBox.ViewModels.Pages;
using Wpf.Ui;
using Wpf.Ui.Abstractions;
using Wpf.Ui.Appearance;
using Wpf.Ui.Controls;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using WpfApplication = System.Windows.Application;

namespace DriveBox.Views.Windows
{
    public partial class MainWindow : INavigationWindow
    {
        public MainWindowViewModel ViewModel { get; }

        public MainWindow(
            MainWindowViewModel viewModel,
            Lazy<DashboardViewModel> dashboardViewModelLazy,
            INavigationViewPageProvider navigationViewPageProvider,
            INavigationService navigationService
        )
        {
            ViewModel = viewModel;
    
            ViewModel.DashboardViewModelLazy = dashboardViewModelLazy;
            DataContext = this;

            SystemThemeWatcher.Watch(this);

            InitializeComponent();
            SetPageService(navigationViewPageProvider);

            navigationService.SetNavigationControl(RootNavigation);
            
            RootNavigation.Navigated += (_, args) =>
            {
                if (args?.Page is Wpf.Ui.Controls.NavigationViewItem nvi && nvi.Content is string content)
                {
                    ViewModel.UpdateCurrentPage(content);
                }
            };
            
        }

        #region INavigationWindow methods

        public INavigationView GetNavigation() => RootNavigation;

        public bool Navigate(Type pageType) => RootNavigation.Navigate(pageType);

        public void SetPageService(INavigationViewPageProvider navigationViewPageProvider) => RootNavigation.SetPageProviderService(navigationViewPageProvider);

        public void SetServiceProvider(IServiceProvider serviceProvider) => RootNavigation.SetServiceProvider(serviceProvider);

        public void ShowWindow() => Show();

        public void CloseWindow() => Close();

        #endregion INavigationWindow methods


        protected override void OnClosed(EventArgs e)
        {
            base.OnClosed(e);


            WpfApplication.Current.Shutdown();
        }


        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {

            base.OnClosing(e);
        }

    }
}
