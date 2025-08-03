using CommunityToolkit.Mvvm.ComponentModel;
using System.Collections.ObjectModel;
using Wpf.Ui.Controls;
using DriveBox.ViewModels.Pages;

namespace DriveBox.ViewModels.Windows
{
    public partial class MainWindowViewModel : ObservableObject
    {
        [ObservableProperty]
        private string _applicationTitle = "WPF UI - DriveBox";

        [ObservableProperty]
        private ObservableCollection<object> _menuItems = 
        [
            new NavigationViewItem()
            {
                Content = "Home",
                Icon = new SymbolIcon { Symbol = SymbolRegular.Home24 },
                TargetPageType = typeof(Views.Pages.DashboardPage)
            },
            new NavigationViewItem()
            {
                Content = "Coming soon...",
                Icon = new SymbolIcon { Symbol = SymbolRegular.DataHistogram24 },
                TargetPageType = typeof(Views.Pages.DataPage)
            }
        ];

        [ObservableProperty]
        private ObservableCollection<object> _footerMenuItems = 
        [
            new NavigationViewItem()
            {
                Content = "Settings",
                Icon = new SymbolIcon { Symbol = SymbolRegular.Settings24 },
                TargetPageType = typeof(Views.Pages.SettingsPage)
            }
        ];

        [ObservableProperty]
        private ObservableCollection<MenuItem> _trayMenuItems = 
        [
            new MenuItem { Header = "Home", Tag = "tray_home" }
        ];

        [ObservableProperty]
        private DashboardViewModel? _dashboardViewModel;
        

        public Lazy<DashboardViewModel>? DashboardViewModelLazy { get; set; }
        

        public DashboardViewModel GetDashboardViewModel()
        {
            if (DashboardViewModel is null && DashboardViewModelLazy is not null)
            {
                DashboardViewModel = DashboardViewModelLazy.Value;
            }
            return DashboardViewModel ?? throw new InvalidOperationException("DashboardViewModel not initialized");
        }

        [ObservableProperty]
        private bool _isHomePage;

        partial void OnDashboardViewModelChanged(DashboardViewModel? value)
        {

        }

        public void UpdateCurrentPage(string pageKey)
        {
            IsHomePage = pageKey == "Home";
        }
    }
}
